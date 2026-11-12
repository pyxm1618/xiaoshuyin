/**
 * S8-FINAL-02 / S8-FINAL-03 / S8-FINAL-05 — targeted remediation regressions.
 *
 * These run through the real application service + PostgreSQL (RLS enforced):
 *  - F02: authoritative conflict groups must be reverse-covered by `conflicts`;
 *  - F03: Confirm revalidates every determinable stored dependency, not only
 *         the server-mandatory subset;
 *  - F05: structural no-op corrections use canonical JSON equality (object key
 *         order ignored, array order preserved) and replay their 422 exactly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  confirmProblemFormulation,
  correctProblemFormulation,
  getCurrentProblemFormulationView,
  presentProblemFormulation,
  startAssessment,
} from '../../apps/server/api/src/services/problem-formulations.js';

const PREFIX = 't8final_';

describe('Slice 8 final merge-audit remediation (F02/F03/F05)', () => {
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
      const fam = `(SELECT id FROM families WHERE display_name LIKE 'T8FINAL-%')`;
      await admin.query(`DELETE FROM problem_formulations WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM cases WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM dialogue_messages WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM assertions WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM observations WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T8FINAL-%'`);
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
        'idempotency-key': `t8final-f-${label}-${Date.now()}-${seq++}`,
      },
      payload: {
        displayName: `T8FINAL-${label}`,
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
        'idempotency-key': `t8final-c-${label}-${Date.now()}-${seq++}`,
      },
      payload: {},
    });
    expect(created.statusCode).toBe(201);
    const caseRow = created.json() as { id: string; version: number };

    const msg = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseRow.id}/messages`,
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': `t8final-m-${label}-${Date.now()}-${seq++}`,
      },
      payload: { content: '基础陈述' },
    });
    expect(msg.statusCode).toBe(201);

    const started = await startAssessment(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: caseRow.id,
      expectedCaseVersion: caseRow.version,
      idempotencyKey: `t8final-s-${label}-${Date.now()}-${seq++}`,
    });
    expect(started.status).toBe(200);

    return {
      owner,
      familyId,
      caseId: caseRow.id,
      caseVersion: started.body.caseVersion as number,
      messageId: msg.json().id as string,
    };
  }

  function actorOf(owner: { accountId: string; personId: string }) {
    return { accountId: owner.accountId, personId: owner.personId };
  }

  async function insertAssertion(input: {
    familyId: string;
    caseId: string;
    subjectPersonId: string;
    sourcePersonId: string;
    content: string;
    conflictGroupId?: string | null;
    supersedesId?: string | null;
    validUntil?: string | null;
  }): Promise<string> {
    const row = await admin.query(
      `INSERT INTO assertions
        (family_id, case_id, subject_person_id, source_kind, source_person_id,
         occurred_time_state, confirmation_status, kind, content, conflict_group_id,
         valid_until, supersedes_id)
       VALUES ($1,$2,$3,'SELF_STATEMENT',$4,'UNKNOWN','UNCONFIRMED','STATEMENT',$5,$6,$7,$8)
       RETURNING id`,
      [
        input.familyId,
        input.caseId,
        input.subjectPersonId,
        input.sourcePersonId,
        input.content,
        input.conflictGroupId ?? null,
        input.validUntil ?? null,
        input.supersedesId ?? null,
      ]
    );
    return row.rows[0].id as string;
  }

  function baseContent(messageId: string) {
    const messageRef = { type: 'DIALOGUE_MESSAGE' as const, id: messageId };
    return {
      primaryProblem: { text: '主问题', evidenceRefs: [messageRef] },
      keyFactors: [] as { text: string; evidenceRefs: { type: string; id: string }[] }[],
      evidenceRefs: [messageRef] as { type: string; id: string }[],
      unknowns: [] as { topic: string; state: string; evidenceRefs: { type: string; id: string }[] }[],
      conflicts: [] as { topic: string; conflictGroupId?: string; evidenceRefs?: { type: string; id: string }[] }[],
      sceneFit: 'family_common_core',
      alternativeExplanations: [{ text: '替代解释 A' }],
      reassessmentConditions: [{ text: '出现新证据' }],
      exitConditions: [{ text: '已超出范围' }],
      dependencyRefs: [{ type: 'EVIDENCE' as const, evidence: messageRef }] as unknown[],
    };
  }

  async function present(
    p: Awaited<ReturnType<typeof prepare>>,
    content: unknown
  ) {
    return presentProblemFormulation(pool, {
      actor: actorOf(p.owner),
      familyId: p.familyId,
      caseId: p.caseId,
      expectedCaseVersion: p.caseVersion,
      idempotencyKey: `t8final-p-${Date.now()}-${seq++}`,
      content: content as never,
    });
  }

  async function counts(caseId: string) {
    const result = await admin.query(
      `SELECT
         (SELECT count(*)::int FROM problem_formulations WHERE case_id = $1) AS formulations,
         (SELECT count(*)::int FROM case_events WHERE case_id = $1 AND event_type = 'CASE_PROBLEM_FORMULATION_CORRECTED') AS corrected_events,
         (SELECT count(*)::int FROM business_audit_events WHERE resource_id = $1 AND event_type = 'CASE_PROBLEM_FORMULATION_CORRECTED') AS corrected_audits,
         (SELECT count(*)::int FROM case_events WHERE case_id = $1 AND event_type = 'CASE_PROBLEM_FORMULATION_CONFIRMED') AS confirmed_events,
         (SELECT count(*)::int FROM business_audit_events WHERE resource_id = $1 AND event_type = 'CASE_PROBLEM_FORMULATION_CONFIRMED') AS confirmed_audits`,
      [caseId]
    );
    return result.rows[0] as Record<string, number>;
  }

  // ── S8-FINAL-02 ────────────────────────────────────────────
  describe('S8-FINAL-02 conflict reverse coverage', () => {
    async function conflictFixture(label: string) {
      const p = await prepare(label);
      const groupId = crypto.randomUUID();
      const a = await insertAssertion({
        familyId: p.familyId,
        caseId: p.caseId,
        subjectPersonId: p.owner.personId,
        sourcePersonId: p.owner.personId,
        content: '冲突 A',
        conflictGroupId: groupId,
      });
      const b = await insertAssertion({
        familyId: p.familyId,
        caseId: p.caseId,
        subjectPersonId: p.owner.personId,
        sourcePersonId: p.owner.personId,
        content: '冲突 B',
        conflictGroupId: groupId,
      });
      return { p, groupId, a, b };
    }

    it('rejects Present when top-level refs keep the group but conflicts is empty', async () => {
      const { p, groupId, a, b } = await conflictFixture('f02-present');
      const content = baseContent(p.messageId);
      content.evidenceRefs.push({ type: 'ASSERTION', id: a }, { type: 'ASSERTION', id: b });
      content.dependencyRefs.push(
        { type: 'EVIDENCE', evidence: { type: 'ASSERTION', id: a } },
        { type: 'EVIDENCE', evidence: { type: 'ASSERTION', id: b } }
      );
      // conflictGroupId is intentionally NOT represented in conflicts.
      expect(groupId).toBeTruthy();

      const res = await present(p, content);
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'PROBLEM_FORMULATION_EVIDENCE_INVALID' });
      expect((await counts(p.caseId)).formulations).toBe(0);
    });

    it('rejects Correction that removes the ConflictItem but keeps both sides', async () => {
      const { p, groupId, a, b } = await conflictFixture('f02-correction');
      const content = baseContent(p.messageId);
      content.evidenceRefs.push({ type: 'ASSERTION', id: a }, { type: 'ASSERTION', id: b });
      content.dependencyRefs.push(
        { type: 'EVIDENCE', evidence: { type: 'ASSERTION', id: a } },
        { type: 'EVIDENCE', evidence: { type: 'ASSERTION', id: b } }
      );
      content.conflicts.push({ topic: '来源冲突', conflictGroupId: groupId });

      const presented = await present(p, content);
      expect(presented.status).toBe(200);
      const before = await counts(p.caseId);
      const caseBefore = await admin.query('SELECT version, phase FROM cases WHERE id = $1', [
        p.caseId,
      ]);

      const corrected = await correctProblemFormulation(pool, {
        actor: actorOf(p.owner),
        familyId: p.familyId,
        caseId: p.caseId,
        expectedCaseVersion: presented.body.caseVersion,
        idempotencyKey: `t8final-f02-corr-${Date.now()}-${seq++}`,
        formulationVersion: 1,
        changes: { conflicts: [] } as never,
      });
      expect(corrected.status).toBe(422);
      expect(corrected.body).toMatchObject({ code: 'PROBLEM_FORMULATION_EVIDENCE_INVALID' });

      const after = await counts(p.caseId);
      expect(after).toEqual(before);
      expect(after.formulations).toBe(1);
      expect(after.corrected_events).toBe(0);
      expect(after.corrected_audits).toBe(0);

      const row = await admin.query(
        'SELECT version, status, conflicts FROM problem_formulations WHERE case_id = $1',
        [p.caseId]
      );
      expect(row.rows[0]).toMatchObject({ version: 1, status: 'PRESENTED' });
      expect(row.rows[0].conflicts).toEqual([
        { topic: '来源冲突', conflictGroupId: groupId },
      ]);

      const caseAfter = await admin.query('SELECT version, phase FROM cases WHERE id = $1', [
        p.caseId,
      ]);
      expect(caseAfter.rows[0]).toEqual(caseBefore.rows[0]);
    });

    it('rejects Confirm when persisted current no longer preserves the conflict', async () => {
      const { p, groupId, a, b } = await conflictFixture('f02-confirm');
      const content = baseContent(p.messageId);
      content.evidenceRefs.push({ type: 'ASSERTION', id: a }, { type: 'ASSERTION', id: b });
      content.dependencyRefs.push(
        { type: 'EVIDENCE', evidence: { type: 'ASSERTION', id: a } },
        { type: 'EVIDENCE', evidence: { type: 'ASSERTION', id: b } }
      );
      content.conflicts.push({ topic: '来源冲突', conflictGroupId: groupId });

      const presented = await present(p, content);
      expect(presented.status).toBe(200);

      // Simulate persisted current truth that is conflict-preservation invalid.
      await admin.query(
        `UPDATE problem_formulations SET conflicts = '[]'::jsonb WHERE case_id = $1`,
        [p.caseId]
      );

      const confirmed = await confirmProblemFormulation(pool, {
        actor: actorOf(p.owner),
        familyId: p.familyId,
        caseId: p.caseId,
        expectedCaseVersion: presented.body.caseVersion,
        idempotencyKey: `t8final-f02-confirm-${Date.now()}-${seq++}`,
        formulationVersion: 1,
        body: {},
      });
      expect(confirmed.status).toBe(422);
      expect(confirmed.body).toMatchObject({ code: 'PROBLEM_FORMULATION_EVIDENCE_INVALID' });

      const row = await admin.query(
        'SELECT status FROM problem_formulations WHERE case_id = $1',
        [p.caseId]
      );
      expect(row.rows[0].status).toBe('PRESENTED');
      const caseRow = await admin.query('SELECT phase, version FROM cases WHERE id = $1', [
        p.caseId,
      ]);
      expect(caseRow.rows[0]).toEqual({ phase: 'PROBLEM_FORMULATION', version: presented.body.caseVersion });
      const c = await counts(p.caseId);
      expect(c.confirmed_events).toBe(0);
      expect(c.confirmed_audits).toBe(0);
    });
  });

  // ── S8-FINAL-03 ────────────────────────────────────────────
  describe('S8-FINAL-03 stored dependency revalidation', () => {
    async function dependencyFixture(label: string) {
      const p = await prepare(label);
      const extra = await insertAssertion({
        familyId: p.familyId,
        caseId: p.caseId,
        subjectPersonId: p.owner.personId,
        sourcePersonId: p.owner.personId,
        content: '额外依赖证据',
      });
      const messageRef = { type: 'DIALOGUE_MESSAGE' as const, id: p.messageId };
      const content = baseContent(p.messageId);
      // The extra Evidence is a dependency snapshot only; it is deliberately not
      // part of top-level evidenceRefs, so only F03 revalidation can catch it.
      content.dependencyRefs.push({
        type: 'EVIDENCE',
        evidence: { type: 'ASSERTION', id: extra },
      });
      const presented = await present(p, content);
      expect(presented.status).toBe(200);
      return { p, extra, messageRef, presented };
    }

    it('rejects Confirm when a stored extra Evidence dependency expires', async () => {
      const { p, extra, presented } = await dependencyFixture('f03-expire');
      await admin.query(`UPDATE assertions SET valid_until = now() - interval '1 minute' WHERE id = $1`, [
        extra,
      ]);

      const confirmed = await confirmProblemFormulation(pool, {
        actor: actorOf(p.owner),
        familyId: p.familyId,
        caseId: p.caseId,
        expectedCaseVersion: presented.body.caseVersion,
        idempotencyKey: `t8final-f03-expire-${Date.now()}-${seq++}`,
        formulationVersion: 1,
        body: {},
      });
      expect(confirmed.status).toBe(409);
      expect(confirmed.body).toMatchObject({ code: 'PROBLEM_FORMULATION_DEPENDENCY_INVALID' });

      const row = await admin.query('SELECT status FROM problem_formulations WHERE case_id = $1', [
        p.caseId,
      ]);
      expect(row.rows[0].status).toBe('PRESENTED');
      const caseRow = await admin.query('SELECT phase, version FROM cases WHERE id = $1', [
        p.caseId,
      ]);
      expect(caseRow.rows[0]).toEqual({
        phase: 'PROBLEM_FORMULATION',
        version: presented.body.caseVersion,
      });
      const c = await counts(p.caseId);
      expect(c.confirmed_events).toBe(0);
      expect(c.confirmed_audits).toBe(0);
    });

    it('rejects Confirm when a stored extra Evidence dependency is superseded', async () => {
      const { p, extra, presented } = await dependencyFixture('f03-supersede');
      await insertAssertion({
        familyId: p.familyId,
        caseId: p.caseId,
        subjectPersonId: p.owner.personId,
        sourcePersonId: p.owner.personId,
        content: '取代证据',
        supersedesId: extra,
      });

      const confirmed = await confirmProblemFormulation(pool, {
        actor: actorOf(p.owner),
        familyId: p.familyId,
        caseId: p.caseId,
        expectedCaseVersion: presented.body.caseVersion,
        idempotencyKey: `t8final-f03-sup-${Date.now()}-${seq++}`,
        formulationVersion: 1,
        body: {},
      });
      expect(confirmed.status).toBe(409);
      expect(confirmed.body).toMatchObject({ code: 'PROBLEM_FORMULATION_DEPENDENCY_INVALID' });
    });

    it('still rejects a missing mandatory dependency before Confirm derivation', async () => {
      const p = await prepare('f03-mandatory');
      const content = baseContent(p.messageId);
      content.dependencyRefs = [];
      const presented = await present(p, content);
      expect(presented.status).toBe(409);
      expect(presented.body).toMatchObject({ code: 'PROBLEM_FORMULATION_DEPENDENCY_INVALID' });
    });
  });

  // ── S8-FINAL-05 ────────────────────────────────────────────
  describe('S8-FINAL-05 canonical structural no-op', () => {
    it('rejects a semantically identical correction submitted with a different object key order', async () => {
      const p = await prepare('f05-noop');
      const presented = await present(p, baseContent(p.messageId));
      expect(presented.status).toBe(200);

      const view = await getCurrentProblemFormulationView(pool, {
        actor: actorOf(p.owner),
        familyId: p.familyId,
        caseId: p.caseId,
      });
      const current = view.current!;

      // Same values, different object key order than the JSONB round-trip.
      const changes = {
        primaryProblem: {
          evidenceRefs: current.primaryProblem.evidenceRefs.map((ref) => ({
            id: ref.id,
            type: ref.type,
          })),
          text: current.primaryProblem.text,
        },
        evidenceRefs: current.evidenceRefs.map((ref) => ({ id: ref.id, type: ref.type })),
        dependencyRefs: current.dependencyRefs.map((dep) =>
          dep.type === 'EVIDENCE'
            ? { evidence: { id: dep.evidence.id, type: dep.evidence.type }, type: dep.type }
            : dep
        ),
      };

      const before = await counts(p.caseId);
      const caseBefore = await admin.query('SELECT version, phase FROM cases WHERE id = $1', [
        p.caseId,
      ]);
      const key = `t8final-f05-noop-${Date.now()}-${seq++}`;

      const first = await correctProblemFormulation(pool, {
        actor: actorOf(p.owner),
        familyId: p.familyId,
        caseId: p.caseId,
        expectedCaseVersion: view.caseVersion,
        idempotencyKey: key,
        formulationVersion: 1,
        changes: changes as never,
      });
      expect(first.status).toBe(422);
      expect(first.body).toMatchObject({ code: 'VALIDATION_ERROR' });

      // Exact 422 replay under the same idempotency key.
      const replay = await correctProblemFormulation(pool, {
        actor: actorOf(p.owner),
        familyId: p.familyId,
        caseId: p.caseId,
        expectedCaseVersion: view.caseVersion,
        idempotencyKey: key,
        formulationVersion: 1,
        changes: changes as never,
      });
      expect(replay.status).toBe(422);
      expect(replay.body).toEqual(first.body);

      const after = await counts(p.caseId);
      expect(after).toEqual(before);
      expect(after.formulations).toBe(1);
      expect(after.corrected_events).toBe(0);
      expect(after.corrected_audits).toBe(0);
      const caseAfter = await admin.query('SELECT version, phase FROM cases WHERE id = $1', [
        p.caseId,
      ]);
      expect(caseAfter.rows[0]).toEqual(caseBefore.rows[0]);
    });

    it('a genuinely substantive correction still succeeds', async () => {
      const p = await prepare('f05-real');
      const presented = await present(p, baseContent(p.messageId));
      expect(presented.status).toBe(200);

      const corrected = await correctProblemFormulation(pool, {
        actor: actorOf(p.owner),
        familyId: p.familyId,
        caseId: p.caseId,
        expectedCaseVersion: presented.body.caseVersion,
        idempotencyKey: `t8final-f05-real-${Date.now()}-${seq++}`,
        formulationVersion: 1,
        changes: { sceneFit: 'family_common_core_v2' } as never,
      });
      expect(corrected.status).toBe(201);
      expect(corrected.body.current?.version).toBe(2);
      expect(corrected.body.current?.sceneFit).toBe('family_common_core_v2');
    });

    it('does not globally sort arrays: a reordered array is substantive', async () => {
      const p = await prepare('f05-array');
      const content = baseContent(p.messageId);
      content.alternativeExplanations = [{ text: '解释 A' }, { text: '解释 B' }];
      const presented = await present(p, content);
      expect(presented.status).toBe(200);

      const corrected = await correctProblemFormulation(pool, {
        actor: actorOf(p.owner),
        familyId: p.familyId,
        caseId: p.caseId,
        expectedCaseVersion: presented.body.caseVersion,
        idempotencyKey: `t8final-f05-array-${Date.now()}-${seq++}`,
        formulationVersion: 1,
        changes: {
          alternativeExplanations: [{ text: '解释 B' }, { text: '解释 A' }],
        } as never,
      });
      expect(corrected.status).toBe(201);
      expect(corrected.body.current?.alternativeExplanations).toEqual([
        { text: '解释 B' },
        { text: '解释 A' },
      ]);
    });
  });
});