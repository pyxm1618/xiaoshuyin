/**
 * Slice 8 — real concurrent command races.
 *
 * Present/Present, Confirm/Confirm, Correction/SwitchPrimaryCase and
 * Reassess/SwitchPrimaryCase must serialize on Family → Case → current
 * formulation and leave exactly one valid outcome.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  confirmProblemFormulation,
  correctProblemFormulation,
  presentProblemFormulation,
  reassessFromFormulation,
  startAssessment,
} from '../../apps/server/api/src/services/problem-formulations.js';

const PREFIX = 't8race_';

describe('problem formulation concurrency (Slice 8)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let pool: pg.Pool;
  let seq = 0;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'], max: 20 });
  });

  afterAll(async () => {
    try {
      await admin.query(`DELETE FROM problem_formulations WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8RACE-%')`);
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8RACE-%')`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8RACE-%')`);
      await admin.query(`DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8RACE-%')`);
      await admin.query(`DELETE FROM dialogue_messages WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8RACE-%')`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8RACE-%')`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T8RACE-%'`);
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

  async function family(owner: { token: string }, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t8race-f-${label}-${Date.now()}-${seq++}` },
      payload: { displayName: `T8RACE-${label}`, creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' } },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function createCase(owner: { token: string }, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t8race-c-${label}-${Date.now()}-${seq++}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number };
  }

  async function message(owner: { token: string }, caseId: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/messages`,
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t8race-m-${label}-${Date.now()}-${seq++}` },
      payload: { content: '并发测试消息' },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  function content(messageId: string) {
    const ref = { type: 'DIALOGUE_MESSAGE' as const, id: messageId };
    return {
      primaryProblem: { text: '并发主问题', evidenceRefs: [ref] },
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

  async function prepare(label: string) {
    const owner = await login(label);
    const familyId = await family(owner, label);
    const created = await createCase(owner, label);
    const messageId = await message(owner, created.id, label);
    const started = await startAssessment(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: created.id,
      expectedCaseVersion: created.version,
      idempotencyKey: `t8race-start-${Date.now()}-${seq++}`,
    });
    return { owner, familyId, caseId: created.id, caseVersion: started.body.caseVersion, messageId };
  }

  it('concurrent Present/Present yields one version and one current row', async () => {
    const { owner, familyId, caseId, caseVersion, messageId } = await prepare('present');
    const results = await Promise.allSettled([
      presentProblemFormulation(pool, {
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId,
        expectedCaseVersion: caseVersion,
        idempotencyKey: `t8race-p1-${Date.now()}-${seq++}`,
        content: content(messageId),
      }),
      presentProblemFormulation(pool, {
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId,
        expectedCaseVersion: caseVersion,
        idempotencyKey: `t8race-p2-${Date.now()}-${seq++}`,
        content: content(messageId),
      }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);

    const rows = await admin.query(
      `SELECT count(*)::int AS n FROM problem_formulations WHERE case_id = $1`,
      [caseId]
    );
    expect(rows.rows[0].n).toBe(1);
    const current = await admin.query(
      `SELECT count(*)::int AS n FROM problem_formulations
       WHERE case_id = $1 AND status <> 'SUPERSEDED'`,
      [caseId]
    );
    expect(current.rows[0].n).toBe(1);
  });

  it('concurrent Confirm/Confirm yields exactly one confirmation and one GOALS transition', async () => {
    const { owner, familyId, caseId, caseVersion, messageId } = await prepare('confirm');
    const presented = await presentProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId,
      expectedCaseVersion: caseVersion,
      idempotencyKey: `t8race-p-${Date.now()}-${seq++}`,
      content: content(messageId),
    });
    const results = await Promise.allSettled([
      confirmProblemFormulation(pool, {
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId,
        expectedCaseVersion: presented.body.caseVersion,
        idempotencyKey: `t8race-c1-${Date.now()}-${seq++}`,
        formulationVersion: 1,
        body: {},
      }),
      confirmProblemFormulation(pool, {
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId,
        expectedCaseVersion: presented.body.caseVersion,
        idempotencyKey: `t8race-c2-${Date.now()}-${seq++}`,
        formulationVersion: 1,
        body: {},
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const cases = await admin.query(
      'SELECT phase, version FROM cases WHERE id = $1',
      [caseId]
    );
    expect(cases.rows[0].phase).toBe('GOALS');
    const events = await admin.query(
      `SELECT count(*)::int AS n FROM case_events
       WHERE case_id = $1 AND event_type = 'CASE_PROBLEM_FORMULATION_CONFIRMED'`,
      [caseId]
    );
    expect(events.rows[0].n).toBe(1);
  });

  it('Correction vs SwitchPrimaryCase never leaves a split state', async () => {
    const owner = await login('corr-switch');
    const familyId = await family(owner, 'corr-switch');
    const caseA = await createCase(owner, 'corr-switch-a');
    const caseB = await createCase(owner, 'corr-switch-b');
    const messageId = await message(owner, caseA.id, 'corr-switch');
    const started = await startAssessment(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: caseA.id,
      expectedCaseVersion: caseA.version,
      idempotencyKey: `t8race-start-${Date.now()}-${seq++}`,
    });
    const presented = await presentProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: caseA.id,
      expectedCaseVersion: started.body.caseVersion,
      idempotencyKey: `t8race-p-${Date.now()}-${seq++}`,
      content: content(messageId),
    });

    const viewA = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${caseA.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    const caseAView = viewA.json() as { version: number; primary: boolean };

    const results = await Promise.allSettled([
      correctProblemFormulation(pool, {
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId: caseA.id,
        expectedCaseVersion: presented.body.caseVersion,
        idempotencyKey: `t8race-corr-${Date.now()}-${seq++}`,
        formulationVersion: 1,
        changes: { sceneFit: 'family_common_core_v2' },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/cases/${caseB.id}/switch-primary`,
        headers: {
          authorization: `Bearer ${owner.token}`,
          'idempotency-key': `t8race-sw-${Date.now()}-${seq++}`,
        },
        payload: {
          reason: 'race to secondary case',
          expectedPrimaryCaseId: caseA.id,
          expectedPrimaryVersion: caseAView.version,
        },
      }),
    ]);

    const rows = await admin.query(
      `SELECT version, status, supersedes_version FROM problem_formulations
       WHERE case_id = $1 ORDER BY version`,
      [caseA.id]
    );
    const current = rows.rows.filter((r: any) => r.status !== 'SUPERSEDED');
    expect(current).toHaveLength(1);

    const correctionOk = results[0].status === 'fulfilled';
    if (correctionOk) {
      expect(rows.rows).toHaveLength(2);
      expect(rows.rows[0].status).toBe('SUPERSEDED');
      expect(current[0].version).toBe(2);
      expect(current[0].supersedes_version).toBe(1);
    } else {
      expect(rows.rows).toHaveLength(1);
      expect(current[0].version).toBe(1);
    }
  });

  it('Reassess vs SwitchPrimaryCase leaves one consistent phase', async () => {
    const { owner, familyId, caseId, caseVersion, messageId } = await prepare('reassess');
    const presented = await presentProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId,
      expectedCaseVersion: caseVersion,
      idempotencyKey: `t8race-p-${Date.now()}-${seq++}`,
      content: content(messageId),
    });
    const other = await createCase(owner, 'reassess-b');
    const viewA = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${caseId}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    const results = await Promise.allSettled([
      reassessFromFormulation(pool, {
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId,
        expectedCaseVersion: presented.body.caseVersion,
        idempotencyKey: `t8race-re-${Date.now()}-${seq++}`,
        basis: 'user correction requires reassessment',
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/cases/${other.id}/switch-primary`,
        headers: {
          authorization: `Bearer ${owner.token}`,
          'idempotency-key': `t8race-sw2-${Date.now()}-${seq++}`,
        },
        payload: {
          reason: 'race to other case',
          expectedPrimaryCaseId: caseId,
          expectedPrimaryVersion: viewA.json().version,
        },
      }),
    ]);

    const rows = await admin.query(
      `SELECT phase, is_primary FROM cases WHERE id = $1`,
      [caseId]
    );
    const reassessOk = results[0].status === 'fulfilled';
    if (reassessOk) {
      expect(rows.rows[0].phase).toBe('ASSESSMENT');
    } else {
      expect(['PROBLEM_FORMULATION', 'ASSESSMENT']).toContain(rows.rows[0].phase);
    }
    expect(rows.rows).toHaveLength(1);
  });
});