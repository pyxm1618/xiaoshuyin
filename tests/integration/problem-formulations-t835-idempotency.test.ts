/**
 * T835 — complete six-command idempotency matrix.
 *
 * For Start / Present / Confirm / Dispute / Correction / Reassess this file
 * proves: same-key replay, same-key mismatch, concurrent same-key convergence,
 * deterministic post-auth 4xx persistence, and exact event/audit non-duplication
 * against the command's real audit resource.
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
type Label = 'start' | 'present' | 'confirm' | 'dispute' | 'correct' | 'reassess';

describe('T835 complete six-command idempotency', () => {
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

  async function prepare(label: string, phase: 'INTAKE' | 'ASSESSMENT' | 'PROBLEM_FORMULATION', withMessage = true) {
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
    const caseId = created.json().id as string;
    let messageId: string | null = null;
    if (withMessage) {
      const msg = await app.inject({
        method: 'POST', url: `/api/v1/cases/${caseId}/messages`,
        headers: { authorization: `Bearer ${owner.sessionToken}`, 'idempotency-key': `t835-m-${label}-${Date.now()}-${seq++}` },
        payload: { content: '问题陈述' },
      });
      messageId = msg.json().id as string;
    }
    const actor = { accountId: owner.accountId as string, personId: owner.person.id as string };
    let caseVersion = created.json().version as number;
    if (phase !== 'INTAKE') {
      const started = await startAssessment(pool, { actor, familyId, caseId, expectedCaseVersion: caseVersion, idempotencyKey: `t835-s-${label}-${Date.now()}-${seq++}` });
      expect(started.status).toBe(200);
      caseVersion = started.body.caseVersion;
    }
    const content = (variant?: string) => {
      const ref = { type: 'DIALOGUE_MESSAGE' as const, id: messageId! };
      return {
        primaryProblem: { text: '主问题', evidenceRefs: [ref] },
        keyFactors: [], evidenceRefs: [ref], unknowns: [], conflicts: [],
        sceneFit: variant ?? 'family_common_core',
        alternativeExplanations: [{ text: '替代解释' }],
        reassessmentConditions: [{ text: '出现新证据' }],
        exitConditions: [{ text: '退出条件' }],
        dependencyRefs: [{ type: 'EVIDENCE' as const, evidence: ref }],
      };
    };
    if (phase === 'PROBLEM_FORMULATION') {
      const presented = await presentProblemFormulation(pool, {
        actor, familyId, caseId, expectedCaseVersion: caseVersion,
        idempotencyKey: `t835-p-${label}-${Date.now()}-${seq++}`, content: content(),
      });
      expect(presented.status).toBe(200);
      caseVersion = presented.body.caseVersion;
    }
    return { actor, familyId, caseId, caseVersion, content, messageId };
  }

  function call(label: Label, key: string, s: any, variant?: string) {
    const base = { actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion, idempotencyKey: key };
    switch (label) {
      case 'start':
        return startAssessment(pool, base);
      case 'present':
        return presentProblemFormulation(pool, { ...base, content: s.content(variant) });
      case 'confirm':
        return confirmProblemFormulation(pool, { ...base, formulationVersion: 1, body: {} });
      case 'dispute':
        return disputeProblemFormulation(pool, { ...base, formulationVersion: 1, body: {} });
      case 'correct':
        return correctProblemFormulation(pool, { ...base, formulationVersion: 1, changes: { sceneFit: variant ?? 'family_common_core_v2' } });
      case 'reassess':
        return reassessFromFormulation(pool, { ...base, formulationVersion: 1, basis: { kind: 'REASSESSMENT_CONDITION', text: '出现新证据' } });
    }
  }

  function phaseFor(label: Label): 'INTAKE' | 'ASSESSMENT' | 'PROBLEM_FORMULATION' {
    if (label === 'start') return 'INTAKE';
    if (label === 'present') return 'ASSESSMENT';
    return 'PROBLEM_FORMULATION';
  }

  async function auditCount(label: Label, caseId: string, result: any): Promise<number> {
    const map: Record<Label, { event: string; resource: 'CASE' | 'PROBLEM_FORMULATION' }> = {
      start: { event: 'CASE_ASSESSMENT_STARTED', resource: 'CASE' },
      present: { event: 'CASE_PROBLEM_FORMULATION_PRESENTED', resource: 'PROBLEM_FORMULATION' },
      confirm: { event: 'CASE_PROBLEM_FORMULATION_CONFIRMED', resource: 'PROBLEM_FORMULATION' },
      dispute: { event: 'CASE_PROBLEM_FORMULATION_DISPUTED', resource: 'PROBLEM_FORMULATION' },
      correct: { event: 'CASE_PROBLEM_FORMULATION_CORRECTED', resource: 'PROBLEM_FORMULATION' },
      reassess: { event: 'CASE_REASSESSMENT_STARTED', resource: 'CASE' },
    };
    const spec = map[label];
    const resourceId = spec.resource === 'CASE' ? caseId : result.body.current.id;
    const row = await admin.query(
      `SELECT count(*)::int AS n FROM business_audit_events
        WHERE event_type=$1 AND resource_type=$2 AND resource_id=$3`,
      [spec.event, spec.resource, resourceId]
    );
    return row.rows[0].n;
  }

  async function businessCounts(caseId: string) {
    const r = await admin.query(
      `SELECT (SELECT count(*)::int FROM problem_formulations WHERE case_id=$1) AS f,
              (SELECT count(*)::int FROM case_events WHERE case_id=$1) AS e,
              (SELECT version FROM cases WHERE id=$1) AS v,
              (SELECT phase FROM cases WHERE id=$1) AS p`,
      [caseId]
    );
    return r.rows[0];
  }

  const labels: Label[] = ['start', 'present', 'confirm', 'dispute', 'correct', 'reassess'];

  it.each(labels)('%s: same-key replay, concurrent same-key, exact audit', async (label) => {
    const s = await prepare(`replay-${label}`, phaseFor(label));
    const key = `t835-${label}-replay-${Date.now()}-${seq++}`;
    const first = await call(label, key, s);
    expect(first.status).toBeGreaterThanOrEqual(200);
    expect(first.status).toBeLessThan(300);
    expect(await auditCount(label, s.caseId, first)).toBe(1);

    const before = await businessCounts(s.caseId);
    const replay = await call(label, key, s);
    expect(replay.status).toBe(first.status);
    expect(replay.body).toEqual(first.body);
    expect(await businessCounts(s.caseId)).toEqual(before);
    expect(await auditCount(label, s.caseId, first)).toBe(1);

    const s2 = await prepare(`concurrent-${label}`, phaseFor(label));
    const key2 = `t835-${label}-concurrent-${Date.now()}-${seq++}`;
    const beforeConc = await businessCounts(s2.caseId);
    const [a, b] = await Promise.all([call(label, key2, s2), call(label, key2, s2)]);
    expect(a.status).toBeGreaterThanOrEqual(200);
    expect(b.status).toBeGreaterThanOrEqual(200);
    expect(a.status).toBeLessThan(300);
    expect(b.status).toBeLessThan(300);
    expect(a.body).toEqual(b.body);
    const after = await businessCounts(s2.caseId);
    expect(after.f - beforeConc.f).toBeLessThanOrEqual(1);
    expect(after.e - beforeConc.e).toBeLessThanOrEqual(1);
    expect(await auditCount(label, s2.caseId, a)).toBe(1);
  });

  it.each(labels)('%s: same key + different payload is a mismatch with no mutation', async (label) => {
    const s = await prepare(`mismatch-${label}`, phaseFor(label));
    const key = `t835-${label}-mismatch-${Date.now()}-${seq++}`;
    const first = await call(label, key, s);
    expect(first.status).toBeLessThan(300);
    const baseline = await businessCounts(s.caseId);
    const audits = await auditCount(label, s.caseId, first);

    let mismatch: Promise<any>;
    switch (label) {
      case 'start':
        mismatch = startAssessment(pool, { actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion + 1, idempotencyKey: key });
        break;
      case 'present':
        mismatch = presentProblemFormulation(pool, { actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion, idempotencyKey: key, content: s.content('different-scene') });
        break;
      case 'confirm':
        mismatch = confirmProblemFormulation(pool, { actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion, idempotencyKey: key, formulationVersion: 1, body: { note: 'different' } });
        break;
      case 'dispute':
        mismatch = disputeProblemFormulation(pool, { actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion, idempotencyKey: key, formulationVersion: 1, body: { note: 'different' } });
        break;
      case 'correct':
        mismatch = correctProblemFormulation(pool, { actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion, idempotencyKey: key, formulationVersion: 1, changes: { sceneFit: 'different-scene' } });
        break;
      case 'reassess':
        mismatch = reassessFromFormulation(pool, { actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion, idempotencyKey: key, formulationVersion: 1, basis: { kind: 'ALTERNATIVE_EXPLANATION', text: '替代解释' } });
        break;
    }
    await expect(mismatch).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' });
    expect(await businessCounts(s.caseId)).toEqual(baseline);
    expect(await auditCount(label, s.caseId, first)).toBe(audits);
  });

  it.each(labels)('%s: deterministic post-auth 4xx is persisted and replays after world change', async (label) => {
    if (label === 'start') {
      const s = await prepare('det-start', 'INTAKE', false);
      const payload = { actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion, idempotencyKey: `t835-det-${Date.now()}-${seq++}` };
      const first = await startAssessment(pool, payload);
      expect(first.status).toBe(422);
      expect(first.body).toMatchObject({ code: 'TRACEABLE_PROBLEM_STATEMENT_REQUIRED' });
      const before = await businessCounts(s.caseId);
      await admin.query(
        `INSERT INTO dialogue_messages (family_id, case_id, actor_account_id, source_person_id, content)
         VALUES ($1,$2,$3,$4,'post-failure truth change')`,
        [s.familyId, s.caseId, s.actor.accountId, s.actor.personId]
      );
      const replay = await startAssessment(pool, payload);
      expect(replay.status).toBe(first.status);
      expect(replay.body).toEqual(first.body);
      expect((await businessCounts(s.caseId)).p).toBe(before.p);
      return;
    }

    if (label === 'present') {
      const s = await prepare('det-present', 'INTAKE');
      const payload = { actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion, idempotencyKey: `t835-det-${Date.now()}-${seq++}`, content: s.content() };
      const first = await presentProblemFormulation(pool, payload);
      expect(first.status).toBe(409);
      expect(first.body).toMatchObject({ code: 'CASE_PHASE_CONFLICT' });
      await startAssessment(pool, { actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion, idempotencyKey: `t835-det-s-${Date.now()}-${seq++}` });
      const replay = await presentProblemFormulation(pool, payload);
      expect(replay.status).toBe(first.status);
      expect(replay.body).toEqual(first.body);
      return;
    }

    const s = await prepare(`det-${label}`, 'ASSESSMENT');
    const key = `t835-det-${label}-${Date.now()}-${seq++}`;
    const payload = { actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion, idempotencyKey: key, formulationVersion: 1 };
    const invoke = () => label === 'correct'
      ? correctProblemFormulation(pool, { ...payload, changes: { sceneFit: 'x' } })
      : label === 'reassess'
        ? reassessFromFormulation(pool, { ...payload, basis: { kind: 'REASSESSMENT_CONDITION', text: '出现新证据' } })
        : label === 'confirm'
          ? confirmProblemFormulation(pool, { ...payload, body: {} })
          : disputeProblemFormulation(pool, { ...payload, body: {} });
    const first = await invoke();
    expect(first.status).toBe(409);
    expect(first.body).toMatchObject({ code: 'CASE_PHASE_CONFLICT' });
    await presentProblemFormulation(pool, {
      actor: s.actor, familyId: s.familyId, caseId: s.caseId, expectedCaseVersion: s.caseVersion,
      idempotencyKey: `t835-det-present-${Date.now()}-${seq++}`, content: s.content(),
    });
    const replay = await invoke();
    expect(replay.status).toBe(first.status);
    expect(replay.body).toEqual(first.body);
  });
});