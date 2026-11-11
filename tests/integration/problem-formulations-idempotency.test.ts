/**
 * Slice 8 — idempotency replay/mismatch and current-version conflicts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  presentProblemFormulation,
  startAssessment,
} from '../../apps/server/api/src/services/problem-formulations.js';

const PREFIX = 't8idem_';

describe('problem formulation idempotency (Slice 8)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let pool: pg.Pool;
  let seq = 0;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
  });

  afterAll(async () => {
    try {
      await admin.query(`DELETE FROM problem_formulations WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8IDEM-%')`);
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8IDEM-%')`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8IDEM-%')`);
      await admin.query(`DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8IDEM-%')`);
      await admin.query(`DELETE FROM dialogue_messages WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8IDEM-%')`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8IDEM-%')`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T8IDEM-%'`);
      await admin.query(`DELETE FROM persons WHERE created_by_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE '${PREFIX}%'`);
    } catch {
      // best-effort
    }
    await pool.end();
    await admin.end();
    await app.close();
  });

  async function login(label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `${PREFIX}${label}_${Date.now()}_${seq++}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    return { token: body.sessionToken as string, personId: body.person.id as string, accountId: body.accountId as string };
  }

  async function prepare(label: string) {
    const owner = await login(label);
    const fam = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t8idem-f-${label}-${Date.now()}-${seq++}` },
      payload: { displayName: `T8IDEM-${label}`, creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' } },
    });
    expect(fam.statusCode).toBe(201);
    const familyId = fam.json().id as string;
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t8idem-c-${label}-${Date.now()}-${seq++}` },
      payload: {},
    });
    expect(created.statusCode).toBe(201);
    const caseRow = created.json() as { id: string; version: number };
    const msg = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseRow.id}/messages`,
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t8idem-m-${label}-${Date.now()}-${seq++}` },
      payload: { content: '消息' },
    });
    expect(msg.statusCode).toBe(201);
    const started = await startAssessment(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: caseRow.id,
      expectedCaseVersion: caseRow.version,
      idempotencyKey: `t8idem-start-${Date.now()}-${seq++}`,
    });
    return { owner, familyId, caseId: caseRow.id, caseVersion: started.body.caseVersion, messageId: msg.json().id as string };
  }

  function content(messageId: string, text = '主问题') {
    const ref = { type: 'DIALOGUE_MESSAGE' as const, id: messageId };
    return {
      primaryProblem: { text, evidenceRefs: [ref] },
      keyFactors: [],
      evidenceRefs: [ref],
      unknowns: [],
      conflicts: [],
      sceneFit: 'family_common_core',
      alternativeExplanations: [],
      reassessmentConditions: [],
      exitConditions: [],
      dependencyRefs: [{ type: 'EVIDENCE' as const, evidence: ref }],
    };
  }

  it('same key + same payload replays the original result without a second version', async () => {
    const { owner, familyId, caseId, caseVersion, messageId } = await prepare('replay');
    const key = `t8idem-p-${Date.now()}-${seq++}`;
    const first = await presentProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId,
      expectedCaseVersion: caseVersion,
      idempotencyKey: key,
      content: content(messageId),
    });
    const replay = await presentProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId,
      expectedCaseVersion: caseVersion,
      idempotencyKey: key,
      content: content(messageId),
    });
    expect(replay.status).toBe(first.status);
    expect(replay.body.current?.id).toBe(first.body.current?.id);
    expect(replay.body.caseVersion).toBe(first.body.caseVersion);

    const rows = await admin.query(
      'SELECT count(*)::int AS n FROM problem_formulations WHERE case_id = $1',
      [caseId]
    );
    expect(rows.rows[0].n).toBe(1);
  });

  it('same key + different payload is rejected without mutation', async () => {
    const { owner, familyId, caseId, caseVersion, messageId } = await prepare('mismatch');
    const key = `t8idem-mm-${Date.now()}-${seq++}`;
    await presentProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId,
      expectedCaseVersion: caseVersion,
      idempotencyKey: key,
      content: content(messageId),
    });
    await expect(
      presentProblemFormulation(pool, {
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId,
        expectedCaseVersion: caseVersion,
        idempotencyKey: key,
        content: content(messageId, '不同内容'),
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' });

    const rows = await admin.query(
      'SELECT count(*)::int AS n FROM problem_formulations WHERE case_id = $1',
      [caseId]
    );
    expect(rows.rows[0].n).toBe(1);
  });

  it('a second Present with a different key conflicts and keeps a single current', async () => {
    const { owner, familyId, caseId, caseVersion, messageId } = await prepare('double');
    await presentProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId,
      expectedCaseVersion: caseVersion,
      idempotencyKey: `t8idem-a-${Date.now()}-${seq++}`,
      content: content(messageId),
    });
    await expect(
      presentProblemFormulation(pool, {
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId,
        expectedCaseVersion: caseVersion,
        idempotencyKey: `t8idem-b-${Date.now()}-${seq++}`,
        content: content(messageId),
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: expect.stringMatching(/^(CASE_PHASE_CONFLICT|STALE_CASE_VERSION)$/),
    });

    const rows = await admin.query(
      `SELECT count(*)::int AS n FROM problem_formulations
       WHERE case_id = $1 AND status <> 'SUPERSEDED'`,
      [caseId]
    );
    expect(rows.rows[0].n).toBe(1);
  });
});