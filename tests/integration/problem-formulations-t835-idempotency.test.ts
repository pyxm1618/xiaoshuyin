/**
 * T835 — six-command idempotency matrix.
 * same key/same request replay, concurrent same key convergence, and
 * no duplicate formulation / Case transition / event / audit rows.
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

const PREFIX = 't835_';

describe('T835 six-command idempotency', () => {
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
    const fam = `(SELECT id FROM families WHERE display_name LIKE 'T835-%')`;
    try {
      await admin.query(`DELETE FROM problem_formulations WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM cases WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM dialogue_messages WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T835-%'`);
      await admin.query(`DELETE FROM persons WHERE created_by_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE '${PREFIX}%'`);
    } catch {}
    await pool.end();
    await admin.end();
    await app.close();
  });

  async function prepare(label: string, phase: 'INTAKE' | 'ASSESSMENT' | 'PROBLEM_FORMULATION') {
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/wechat', payload: { code: `${PREFIX}${label}_${Date.now()}_${seq++}` } });
    const owner = login.json();
    const fam = await app.inject({
      method: 'POST', url: '/api/v1/families',
      headers: { authorization: `Bearer ${owner.sessionToken}`, 'idempotency-key': `t835-f-${label}-${Date.now()}-${seq++}` },
      payload: { displayName: `T835-${label}`, creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' } },
    });
    const familyId = fam.json().id as string;
    const created = await app.inject({
      method: 'POST', url: '/api/v1/cases',
      headers: { authorization: `Bearer ${owner.sessionToken}`, 'idempotency-key': `t835-c-${label}-${Date.now()}-${seq++}` },
      payload: {},
    });
    const caseRow = created.json() as { id: string; version: number };
    const msg = await app.inject({
      method: 'POST', url: `/api/v1/cases/${caseRow.id}/messages`,
      headers: { authorization: `Bearer ${owner.sessionToken}`, 'idempotency-key': `t835-m-${label}-${Date.now()}-${seq++}` },
      payload: { content: '问题陈述' },
    });
    const actor = { accountId: owner.accountId as string, personId: owner.person.id as string };
    let caseVersion = caseRow.version;
    if (phase !== 'INTAKE') {
      const started = await startAssessment(pool, { actor, familyId, caseId: caseRow.id, expectedCaseVersion: caseVersion, idempotencyKey: `t835-s-${label}-${Date.now()}-${seq++}` });
      expect(started.status).toBe(200);
      caseVersion = started.body.caseVersion;
    }
    const content = () => {
      const ref = { type: 'DIALOGUE_MESSAGE' as const, id: msg.json().id as string };
      return {
        primaryProblem: { text: '主问题', evidenceRefs: [ref] },
        keyFactors: [], evidenceRefs: [ref], unknowns: [], conflicts: [],
        sceneFit: 'family_common_core',
        alternativeExplanations: [{ text: '替代解释' }],
        reassessmentConditions: [{ text: '出现新证据' }],
        exitConditions: [{ text: '退出条件' }],
        dependencyRefs: [{ type: 'EVIDENCE' as const, evidence: ref }],
      };
    };
    if (phase === 'PROBLEM_FORMULATION') {
      const presented = await presentProblemFormulation(pool, {
        actor, familyId, caseId: caseRow.id, expectedCaseVersion: caseVersion,
        idempotencyKey: `t835-p-${label}-${Date.now()}-${seq++}`, content: content(),
      });
      expect(presented.status).toBe(200);
      caseVersion = presented.body.caseVersion;
    }
    return { actor, familyId, caseId: caseRow.id, caseVersion, content };
  }

  async function counts(caseId: string) {
    const r = await admin.query(
      `SELECT (SELECT count(*)::int FROM problem_formulations WHERE case_id=$1) AS f,
              (SELECT count(*)::int FROM case_events WHERE case_id=$1) AS e,
              (SELECT count(*)::int FROM business_audit_events WHERE resource_id=$1) AS a,
              (SELECT version FROM cases WHERE id=$1) AS v,
              (SELECT phase FROM cases WHERE id=$1) AS p`,
      [caseId]
    );
    return r.rows[0];
  }

  async function assertReplayAndConcurrent(
    make: (key: string, state: any) => Promise<any>,
    prepareState: () => Promise<any>,
    label: string
  ) {
    const s1 = await prepareState();
    const key1 = `t835-${label}-replay-${Date.now()}-${seq++}`;
    const first = await make(key1, s1);
    expect(first.status, label).toBeGreaterThanOrEqual(200);
    expect(first.status, label).toBeLessThan(300);
    const before = await counts(s1.caseId);
    const replay = await make(key1, s1);
    expect(replay.status).toBe(first.status);
    expect(replay.body).toEqual(first.body);
    expect(await counts(s1.caseId)).toEqual(before);

    const s2 = await prepareState();
    const key2 = `t835-${label}-concurrent-${Date.now()}-${seq++}`;
    const beforeConc = await counts(s2.caseId);
    const results = await Promise.all([make(key2, s2), make(key2, s2)]);
    expect(results[0].status).toBeGreaterThanOrEqual(200);
    expect(results[1].status).toBeGreaterThanOrEqual(200);
    expect(results[0].status).toBeLessThan(300);
    expect(results[1].status).toBeLessThan(300);
    expect(results[0].body).toEqual(results[1].body);
    const after = await counts(s2.caseId);
    expect(after.f - beforeConc.f, label).toBeLessThanOrEqual(1);
    expect(after.e - beforeConc.e, label).toBeLessThanOrEqual(1);
    expect(after.a - beforeConc.a, label).toBeLessThanOrEqual(1);
  }

  it('StartAssessment converges on replay and concurrent same key', async () => {
    await assertReplayAndConcurrent(
      (key, s) => startAssessment(pool, { actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion, idempotencyKey: key }),
      () => prepare('start', 'INTAKE'),
      'start'
    );
  });

  it('PresentProblemFormulation converges on replay and concurrent same key', async () => {
    await assertReplayAndConcurrent(
      (key, s) => presentProblemFormulation(pool, { actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion, idempotencyKey: key, content: s.content() }),
      () => prepare('present', 'ASSESSMENT'),
      'present'
    );
  });

  it('ConfirmProblemFormulation converges on replay and concurrent same key', async () => {
    await assertReplayAndConcurrent(
      (key, s) => confirmProblemFormulation(pool, { actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion, idempotencyKey: key, formulationVersion: 1, body: {} }),
      () => prepare('confirm', 'PROBLEM_FORMULATION'),
      'confirm'
    );
  });

  it('DisputeProblemFormulation converges on replay and concurrent same key', async () => {
    await assertReplayAndConcurrent(
      (key, s) => disputeProblemFormulation(pool, { actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion, idempotencyKey: key, formulationVersion: 1, body: {} }),
      () => prepare('dispute', 'PROBLEM_FORMULATION'),
      'dispute'
    );
  });

  it('CorrectProblemFormulation converges on replay and concurrent same key', async () => {
    await assertReplayAndConcurrent(
      (key, s) => correctProblemFormulation(pool, { actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion, idempotencyKey: key, formulationVersion: 1, changes: { sceneFit: 'family_common_core_v2' } }),
      () => prepare('correct', 'PROBLEM_FORMULATION'),
      'correct'
    );
  });

  it('ReassessFromFormulation converges on replay and concurrent same key', async () => {
    await assertReplayAndConcurrent(
      (key, s) => reassessFromFormulation(pool, { actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion, idempotencyKey: key, formulationVersion: 1, basis: { kind: 'REASSESSMENT_CONDITION', text: '出现新证据' } }),
      () => prepare('reassess', 'PROBLEM_FORMULATION'),
      'reassess'
    );
  });
});