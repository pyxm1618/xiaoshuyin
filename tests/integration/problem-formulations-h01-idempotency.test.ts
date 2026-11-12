/**
 * S8-H01 — deterministic business 4xx outcomes must be persisted as the
 * idempotent result with zero business mutation, and exact replay must return
 * the same status/body even after the world could have changed.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  confirmProblemFormulation,
  correctProblemFormulation,
  disputeProblemFormulation,
  presentProblemFormulation,
  reassessFromFormulation,
  startAssessment,
} from '../../apps/server/api/src/services/problem-formulations.js';

const PREFIX = 't8h01_';

describe('S8-H01 deterministic business idempotency', () => {
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
      await admin.query(`DELETE FROM problem_formulations WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8H01-%')`);
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8H01-%')`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8H01-%')`);
      await admin.query(`DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8H01-%')`);
      await admin.query(`DELETE FROM dialogue_messages WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8H01-%')`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8H01-%')`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T8H01-%'`);
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
    return {
      token: body.sessionToken as string,
      personId: body.person.id as string,
      accountId: body.accountId as string,
    };
  }

  async function prepare(label: string) {
    const owner = await login(label);
    const fam = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': `t8h01-f-${label}-${Date.now()}-${seq++}`,
      },
      payload: {
        displayName: `T8H01-${label}`,
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
      },
    });
    expect(fam.statusCode).toBe(201);
    const familyId = fam.json().id as string;
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': `t8h01-c-${label}-${Date.now()}-${seq++}`,
      },
      payload: {},
    });
    expect(created.statusCode).toBe(201);
    return {
      owner,
      familyId,
      caseId: created.json().id as string,
      caseVersion: created.json().version as number,
    };
  }

  async function addMessage(owner: { token: string }, caseId: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/messages`,
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': `t8h01-m-${label}-${Date.now()}-${seq++}`,
      },
      payload: { content: '问题陈述' },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  function content(messageId: string) {
    const ref = { type: 'DIALOGUE_MESSAGE' as const, id: messageId };
    return {
      primaryProblem: { text: '主问题', evidenceRefs: [ref] },
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

  async function counts(caseId: string) {
    const rows = await admin.query(
      `SELECT
        (SELECT count(*)::int FROM problem_formulations WHERE case_id=$1) AS formulations,
        (SELECT count(*)::int FROM case_events WHERE case_id=$1) AS events,
        (SELECT count(*)::int FROM business_audit_events WHERE resource_id=$1) AS audits`,
      [caseId]
    );
    return rows.rows[0];
  }

  function actorOf(owner: { accountId: string; personId: string }) {
    return { accountId: owner.accountId, personId: owner.personId };
  }

  it('StartAssessment persists TRACEABLE_PROBLEM_STATEMENT_REQUIRED and replays it', async () => {
    const { owner, familyId, caseId, caseVersion } = await prepare('start');
    const key = `t8h01-start-${Date.now()}-${seq++}`;
    const payload = {
      actor: actorOf(owner),
      familyId,
      caseId,
      expectedCaseVersion: caseVersion,
      idempotencyKey: key,
    };
    const before = await counts(caseId);
    const first = await startAssessment(pool, payload);
    expect(first.status).toBe(422);
    expect(first.body).toMatchObject({ code: 'TRACEABLE_PROBLEM_STATEMENT_REQUIRED' });
    expect(await counts(caseId)).toEqual(before);

    await addMessage(owner, caseId, 'start');
    const afterMessage = await counts(caseId);
    const replay = await startAssessment(pool, payload);
    expect(replay.status).toBe(422);
    expect(replay.body).toMatchObject({ code: 'TRACEABLE_PROBLEM_STATEMENT_REQUIRED' });
    expect(await counts(caseId)).toEqual(afterMessage);

    const cases = await admin.query('SELECT phase, version FROM cases WHERE id=$1', [caseId]);
    expect(cases.rows[0]).toEqual({ phase: 'INTAKE', version: caseVersion });
  });

  it('PresentProblemFormulation persists CASE_PHASE_CONFLICT and replays it', async () => {
    const { owner, familyId, caseId, caseVersion } = await prepare('present');
    const messageId = await addMessage(owner, caseId, 'present');
    const key = `t8h01-present-${Date.now()}-${seq++}`;
    const payload = {
      actor: actorOf(owner),
      familyId,
      caseId,
      expectedCaseVersion: caseVersion,
      idempotencyKey: key,
      content: content(messageId),
    };
    const before = await counts(caseId);
    const first = await presentProblemFormulation(pool, payload);
    expect(first.status).toBe(409);
    expect(first.body).toMatchObject({ code: 'CASE_PHASE_CONFLICT' });
    expect(await counts(caseId)).toEqual(before);

    await startAssessment(pool, {
      actor: actorOf(owner),
      familyId,
      caseId,
      expectedCaseVersion: caseVersion,
      idempotencyKey: `t8h01-start2-${Date.now()}-${seq++}`,
    });
    const beforeReplay = await counts(caseId);
    const replay = await presentProblemFormulation(pool, payload);
    expect(replay.status).toBe(409);
    expect(replay.body).toMatchObject({ code: 'CASE_PHASE_CONFLICT' });
    expect(await counts(caseId)).toEqual(beforeReplay);
  });

  it.each([
    ['confirm', confirmProblemFormulation],
    ['dispute', disputeProblemFormulation],
    ['correct', correctProblemFormulation],
    ['reassess', reassessFromFormulation],
  ] as const)('%s persists a no-current failure and replays it after a formulation exists', async (label, command) => {
    const { owner, familyId, caseId, caseVersion } = await prepare(label);
    const messageId = await addMessage(owner, caseId, label);
    const started = await startAssessment(pool, {
      actor: actorOf(owner),
      familyId,
      caseId,
      expectedCaseVersion: caseVersion,
      idempotencyKey: `t8h01-start-${label}-${Date.now()}-${seq++}`,
    });
    expect(started.status).toBe(200);

    const key = `t8h01-${label}-${Date.now()}-${seq++}`;
    const common = {
      actor: actorOf(owner),
      familyId,
      caseId,
      expectedCaseVersion: started.body.caseVersion,
      idempotencyKey: key,
      formulationVersion: 1,
    };
    const invoke = () => {
      if (label === 'correct') {
        return command(pool, {
          ...common,
          changes: { sceneFit: 'family_common_core_v2' },
        } as never);
      }
      if (label === 'reassess') {
        return command(pool, {
          ...common,
          basis: { kind: 'REASSESSMENT_CONDITION', text: '新证据' },
        } as never);
      }
      return command(pool, { ...common, body: {} } as never);
    };

    const before = await counts(caseId);
    const first = await invoke();
    expect(first.status).toBe(409);
    expect(await counts(caseId)).toEqual(before);

    await presentProblemFormulation(pool, {
      actor: actorOf(owner),
      familyId,
      caseId,
      expectedCaseVersion: started.body.caseVersion,
      idempotencyKey: `t8h01-present-${label}-${Date.now()}-${seq++}`,
      content: content(messageId),
    });

    const beforeReplay = await counts(caseId);
    const replay = await invoke();
    expect(replay.status).toBe(409);
    expect(replay.body).toEqual(first.body);
    expect(await counts(caseId)).toEqual(beforeReplay);

    const rows = await admin.query(
      'SELECT count(*)::int AS n FROM problem_formulations WHERE case_id=$1',
      [caseId]
    );
    expect(rows.rows[0].n).toBe(1);
  });

  it('same key + different payload is a mismatch, not a persisted outcome', async () => {
    const { owner, familyId, caseId, caseVersion } = await prepare('mismatch');
    const key = `t8h01-mismatch-${Date.now()}-${seq++}`;
    const base = {
      actor: actorOf(owner),
      familyId,
      caseId,
      expectedCaseVersion: caseVersion,
      idempotencyKey: key,
    };
    await startAssessment(pool, base);
    await expect(
      startAssessment(pool, { ...base, expectedCaseVersion: caseVersion + 1 })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' });
  });
});