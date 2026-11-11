/**
 * Remediation evidence: S8-H02, S8-M01–M05.
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

const PREFIX = 't8rem_';

describe('S8 remediation evidence rules', () => {
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
      const fam = `(SELECT id FROM families WHERE display_name LIKE 'T8REM-%')`;
      await admin.query(`DELETE FROM problem_formulations WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM cases WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM dialogue_messages WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM assertions WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM observations WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T8REM-%'`);
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
    const b = res.json();
    return { token: b.sessionToken as string, personId: b.person.id as string, accountId: b.accountId as string };
  }

  async function prepare(label: string) {
    const owner = await login(label);
    const fam = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t8rem-f-${label}-${Date.now()}-${seq++}` },
      payload: { displayName: `T8REM-${label}`, creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' } },
    });
    expect(fam.statusCode).toBe(201);
    const familyId = fam.json().id as string;
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t8rem-c-${label}-${Date.now()}-${seq++}` },
      payload: {},
    });
    expect(created.statusCode).toBe(201);
    const caseRow = created.json() as { id: string; version: number };
    const msg = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseRow.id}/messages`,
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t8rem-m-${label}-${Date.now()}-${seq++}` },
      payload: { content: '基础陈述' },
    });
    expect(msg.statusCode).toBe(201);
    const started = await startAssessment(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: caseRow.id,
      expectedCaseVersion: caseRow.version,
      idempotencyKey: `t8rem-s-${Date.now()}-${seq++}`,
    });
    expect(started.status).toBe(200);
    return {
      owner,
      familyId,
      caseId: caseRow.id,
      caseVersion: started.body.caseVersion,
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
    confirmation?: string;
    kind?: string;
    validFrom?: string | null;
    validUntil?: string | null;
    supersedesId?: string | null;
  }) {
    const row = await admin.query(
      `INSERT INTO assertions
        (family_id, case_id, subject_person_id, source_kind, source_person_id,
         occurred_time_state, confirmation_status, kind, content, conflict_group_id,
         valid_from, valid_until, supersedes_id)
       VALUES ($1,$2,$3,'SELF_STATEMENT',$4,'UNKNOWN',$5,$6,$7,NULL,$8,$9,$10)
       RETURNING id`,
      [
        input.familyId,
        input.caseId,
        input.subjectPersonId,
        input.sourcePersonId,
        input.confirmation ?? 'UNCONFIRMED',
        input.kind ?? 'STATEMENT',
        input.content,
        input.validFrom ?? null,
        input.validUntil ?? null,
        input.supersedesId ?? null,
      ]
    );
    return row.rows[0].id as string;
  }

  async function insertObservation(input: {
    familyId: string;
    caseId: string;
    subjectPersonId: string;
    sourcePersonId: string;
    valueState: 'KNOWN' | 'UNKNOWN' | 'NOT_COLLECTED' | 'DECLINED';
    confirmation?: string;
    code?: string;
  }) {
    const known = input.valueState === 'KNOWN';
    const row = await admin.query(
      `INSERT INTO observations
        (family_id, case_id, subject_person_id, source_kind, source_person_id,
         occurred_time_state, confirmation_status, observation_code,
         value_state, value_type, value_text)
       VALUES ($1,$2,$3,'SELF_STATEMENT',$4,'UNKNOWN',$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        input.familyId,
        input.caseId,
        input.subjectPersonId,
        input.sourcePersonId,
        input.confirmation ?? 'UNCONFIRMED',
        input.code ?? `obs_${seq++}`,
        input.valueState,
        known ? 'TEXT' : null,
        known ? 'known' : null,
      ]
    );
    return row.rows[0].id as string;
  }

  function baseContent(messageId: string) {
    const ref = { type: 'DIALOGUE_MESSAGE' as const, id: messageId };
    return {
      primaryProblem: { text: '主问题', evidenceRefs: [ref] },
      keyFactors: [] as { text: string; evidenceRefs: { type: string; id: string }[] }[],
      evidenceRefs: [ref] as { type: string; id: string }[],
      unknowns: [] as { topic: string; state: string; evidenceRefs: { type: string; id: string }[] }[],
      conflicts: [] as { topic: string; conflictGroupId?: string }[],
      sceneFit: 'family_common_core',
      alternativeExplanations: [{ text: '替代解释 A' }],
      reassessmentConditions: [{ text: '出现新证据' }],
      exitConditions: [{ text: '已超出范围' }],
      dependencyRefs: [{ type: 'EVIDENCE' as const, evidence: ref }] as {
        type: string;
        evidence?: { type: string; id: string };
      }[],
    };
  }

  async function present(owner: { accountId: string; personId: string }, familyId: string, caseId: string, caseVersion: number, content: unknown) {
    return presentProblemFormulation(pool, {
      actor: actorOf(owner),
      familyId,
      caseId,
      expectedCaseVersion: caseVersion,
      idempotencyKey: `t8rem-p-${Date.now()}-${seq++}`,
      content: content as never,
    });
  }

  // ── S8-H02 ────────────────────────────────────────────────
  it('rejects DISPUTED assertion / observation as primary and key-factor support', async () => {
    for (const mode of ['assertion-primary', 'assertion-factor', 'observation-primary'] as const) {
      const p = await prepare(`h02-${mode}`);
      const disputed =
        mode === 'observation-primary'
          ? await insertObservation({
              familyId: p.familyId,
              caseId: p.caseId,
              subjectPersonId: p.owner.personId,
              sourcePersonId: p.owner.personId,
              valueState: 'KNOWN',
              confirmation: 'DISPUTED',
            })
          : await insertAssertion({
              familyId: p.familyId,
              caseId: p.caseId,
              subjectPersonId: p.owner.personId,
              sourcePersonId: p.owner.personId,
              content: '争议证据',
              confirmation: 'DISPUTED',
            });
      const ref = {
        type: mode === 'observation-primary' ? 'OBSERVATION' : 'ASSERTION',
        id: disputed,
      };
      const content = baseContent(p.messageId);
      content.evidenceRefs.push(ref);
      content.dependencyRefs.push({ type: 'EVIDENCE', evidence: ref });
      if (mode === 'assertion-factor') {
        content.keyFactors.push({ text: '因子', evidenceRefs: [ref] });
      } else {
        content.primaryProblem.evidenceRefs = [ref];
      }
      const res = await present(p.owner, p.familyId, p.caseId, p.caseVersion, content);
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'PROBLEM_FORMULATION_EVIDENCE_INVALID' });
    }
  });

  it('Confirm and Correction revalidation cannot bypass a mutated DISPUTED status', async () => {
    const p = await prepare('h02-revalidate');
    const assertionId = await insertAssertion({
      familyId: p.familyId,
      caseId: p.caseId,
      subjectPersonId: p.owner.personId,
      sourcePersonId: p.owner.personId,
      content: '后来被争议',
    });
    const ref = { type: 'ASSERTION' as const, id: assertionId };
    const content = baseContent(p.messageId);
    content.evidenceRefs.push(ref);
    content.dependencyRefs.push({ type: 'EVIDENCE', evidence: ref });
    content.primaryProblem.evidenceRefs = [ref];
    const presented = await present(p.owner, p.familyId, p.caseId, p.caseVersion, content);
    expect(presented.status).toBe(200);

    await admin.query('UPDATE assertions SET confirmation_status=$2 WHERE id=$1', [
      assertionId,
      'DISPUTED',
    ]);

    const confirm = await confirmProblemFormulation(pool, {
      actor: actorOf(p.owner),
      familyId: p.familyId,
      caseId: p.caseId,
      expectedCaseVersion: presented.body.caseVersion,
      idempotencyKey: `t8rem-confirm-${Date.now()}-${seq++}`,
      formulationVersion: 1,
      body: {},
    });
    expect(confirm.status).toBe(422);
    expect(confirm.body).toMatchObject({ code: 'PROBLEM_FORMULATION_EVIDENCE_INVALID' });

    const correction = await correctProblemFormulation(pool, {
      actor: actorOf(p.owner),
      familyId: p.familyId,
      caseId: p.caseId,
      expectedCaseVersion: presented.body.caseVersion,
      idempotencyKey: `t8rem-corr-${Date.now()}-${seq++}`,
      formulationVersion: 1,
      changes: { sceneFit: 'family_common_core_v2' },
    });
    expect(correction.status).toBe(422);
    expect(correction.body).toMatchObject({ code: 'PROBLEM_FORMULATION_EVIDENCE_INVALID' });
  });

  // ── S8-M01 ────────────────────────────────────────────────
  it('UnknownItem must reference its concrete Evidence and preserve state', async () => {
    const unknownPair = async (label: string) => {
      const p = await prepare(`m01-${label}`);
      const a = await insertObservation({
        familyId: p.familyId, caseId: p.caseId,
        subjectPersonId: p.owner.personId, sourcePersonId: p.owner.personId,
        valueState: 'UNKNOWN',
      });
      const b = await insertObservation({
        familyId: p.familyId, caseId: p.caseId,
        subjectPersonId: p.owner.personId, sourcePersonId: p.owner.personId,
        valueState: 'UNKNOWN',
      });
      return { p, a, b };
    };

    // only one of two UNKNOWN observations referenced
    {
      const { p, a } = await unknownPair('partial');
      const content = baseContent(p.messageId);
      content.evidenceRefs.push({ type: 'OBSERVATION', id: a });
      content.unknowns.push({ topic: '未知', state: 'UNKNOWN', evidenceRefs: [{ type: 'OBSERVATION', id: a }] });
      const res = await present(p.owner, p.familyId, p.caseId, p.caseVersion, content);
      expect(res.status).toBe(422);
    }

    // wrong Evidence ref: UNKNOWN item points at a statement ref
    {
      const { p, a } = await unknownPair('wrong');
      const content = baseContent(p.messageId);
      content.evidenceRefs.push({ type: 'OBSERVATION', id: a });
      content.unknowns.push({
        topic: '未知', state: 'UNKNOWN',
        evidenceRefs: [{ type: 'DIALOGUE_MESSAGE', id: p.messageId }],
      });
      const res = await present(p.owner, p.familyId, p.caseId, p.caseVersion, content);
      expect(res.status).toBe(422);
    }

    // nonexistent ref
    {
      const { p } = await unknownPair('missing');
      const content = baseContent(p.messageId);
      content.evidenceRefs.push({ type: 'OBSERVATION', id: '11111111-1111-4111-8111-111111111111' });
      content.unknowns.push({
        topic: '未知', state: 'UNKNOWN',
        evidenceRefs: [{ type: 'OBSERVATION', id: '11111111-1111-4111-8111-111111111111' }],
      });
      const res = await present(p.owner, p.familyId, p.caseId, p.caseVersion, content);
      expect(res.status).toBe(422);
    }

    // DECLINED represented as UNKNOWN
    {
      const p = await prepare('m01-declined-as-unknown');
      const declined = await insertObservation({
        familyId: p.familyId, caseId: p.caseId,
        subjectPersonId: p.owner.personId, sourcePersonId: p.owner.personId,
        valueState: 'DECLINED',
      });
      const content = baseContent(p.messageId);
      content.evidenceRefs.push({ type: 'OBSERVATION', id: declined });
      content.unknowns.push({ topic: '拒绝', state: 'UNKNOWN', evidenceRefs: [{ type: 'OBSERVATION', id: declined }] });
      const res = await present(p.owner, p.familyId, p.caseId, p.caseVersion, content);
      expect(res.status).toBe(422);
    }

    // DECLINED correct provenance passes
    {
      const p = await prepare('m01-declined-ok');
      const declined = await insertObservation({
        familyId: p.familyId, caseId: p.caseId,
        subjectPersonId: p.owner.personId, sourcePersonId: p.owner.personId,
        valueState: 'DECLINED',
      });
      const content = baseContent(p.messageId);
      content.evidenceRefs.push({ type: 'OBSERVATION', id: declined });
      content.dependencyRefs.push({ type: 'EVIDENCE', evidence: { type: 'OBSERVATION', id: declined } });
      content.unknowns.push({ topic: '拒绝', state: 'DECLINED', evidenceRefs: [{ type: 'OBSERVATION', id: declined }] });
      const res = await present(p.owner, p.familyId, p.caseId, p.caseVersion, content);
      expect(res.status).toBe(200);
    }

    // explicit NOT_COLLECTED with empty refs passes when no such Evidence exists
    {
      const p = await prepare('m01-not-collected');
      const content = baseContent(p.messageId);
      content.unknowns.push({ topic: '未采集', state: 'NOT_COLLECTED', evidenceRefs: [] });
      const res = await present(p.owner, p.familyId, p.caseId, p.caseVersion, content);
      expect(res.status).toBe(200);
    }
  });

  // ── S8-M02 ────────────────────────────────────────────────
  it('StartAssessment accepts only a current-visible STATEMENT carrier', async () => {
    const run = async (
      label: string,
      setup: (ids: { familyId: string; caseId: string; owner: { token: string; personId: string; accountId: string } }) => Promise<void>
    ) => {
      const owner = await login(label);
      const fam = await app.inject({
        method: 'POST', url: '/api/v1/families',
        headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t8rem-sf-${label}-${Date.now()}-${seq++}` },
        payload: { displayName: `T8REM-${label}`, creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' } },
      });
      expect(fam.statusCode).toBe(201);
      const familyId = fam.json().id as string;
      const created = await app.inject({
        method: 'POST', url: '/api/v1/cases',
        headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t8rem-sc-${label}-${Date.now()}-${seq++}` },
        payload: {},
      });
      expect(created.statusCode).toBe(201);
      const caseId = created.json().id as string;
      await setup({ familyId, caseId, owner });
      const result = await startAssessment(pool, {
        actor: actorOf(owner), familyId, caseId,
        expectedCaseVersion: created.json().version as number,
        idempotencyKey: `t8rem-ss-${label}-${Date.now()}-${seq++}`,
      });
      return { result, caseId };
    };

    const single = async (ids: { familyId: string; caseId: string; owner: { personId: string } }, overrides: Record<string, unknown>) =>
      insertAssertion({
        familyId: ids.familyId, caseId: ids.caseId,
        subjectPersonId: ids.owner.personId, sourcePersonId: ids.owner.personId,
        content: '陈述', ...overrides,
      });

    {
      const { result, caseId } = await run('m02-superseded', async (ids) => {
        const old = await single(ids, { content: '旧' });
        await single(ids, { content: '新', kind: 'HYPOTHESIS', supersedesId: old });
      });
      expect(result.status).toBe(422);
      expect(result.body).toMatchObject({ code: 'TRACEABLE_PROBLEM_STATEMENT_REQUIRED' });
      const row = await admin.query('SELECT phase, version FROM cases WHERE id=$1', [caseId]);
      expect(row.rows[0]).toEqual({ phase: 'INTAKE', version: 1 });
    }

    for (const [label, overrides] of [
      ['expired', { validFrom: '2000-01-01T00:00:00Z', validUntil: '2001-01-01T00:00:00Z' }],
      ['future', { validFrom: '2999-01-01T00:00:00Z' }],
    ] as const) {
      const { result } = await run(`m02-${label}`, async (ids) => {
        await single(ids, overrides);
      });
      expect(result.status).toBe(422);
      expect(result.body).toMatchObject({ code: 'TRACEABLE_PROBLEM_STATEMENT_REQUIRED' });
    }

    const valid = await run('m02-valid', async (ids) => {
      await single(ids, { content: '当前有效陈述' });
    });
    expect(valid.result.status).toBe(200);

    const messageCase = await run('m02-message', async (ids) => {
      const res = await app.inject({
        method: 'POST', url: `/api/v1/cases/${ids.caseId}/messages`,
        headers: { authorization: `Bearer ${ids.owner.token}`, 'idempotency-key': `t8rem-mm-${Date.now()}-${seq++}` },
        payload: { content: '消息载体' },
      });
      expect(res.statusCode).toBe(201);
    });
    expect(messageCase.result.status).toBe(200);
  });

  // ── S8-M03 ────────────────────────────────────────────────
  it('Reassess validates basis against the locked current formulation', async () => {
    const p = await prepare('m03');
    const presented = await present(p.owner, p.familyId, p.caseId, p.caseVersion, baseContent(p.messageId));
    expect(presented.status).toBe(200);
    const caseVersion = presented.body.caseVersion;

    const valid = await reassessFromFormulation(pool, {
      actor: actorOf(p.owner), familyId: p.familyId, caseId: p.caseId,
      expectedCaseVersion: caseVersion,
      formulationVersion: 1,
      idempotencyKey: `t8rem-re-ok-${Date.now()}-${seq++}`,
      basis: { kind: 'REASSESSMENT_CONDITION', text: '出现新证据' },
    });
    expect(valid.status, JSON.stringify(valid.body)).toBe(200);

    // second reassess is invalid by phase; prepare a fresh case for invalid bases
    const q = await prepare('m03-invalid');
    const presentedQ = await present(q.owner, q.familyId, q.caseId, q.caseVersion, baseContent(q.messageId));
    expect(presentedQ.status).toBe(200);

    for (const basis of [
      { kind: 'REASSESSMENT_CONDITION', text: '任意字符串' },
      { kind: 'REASSESSMENT_CONDITION', text: '' },
      { kind: 'ALTERNATIVE_EXPLANATION', text: '不存在的解释' },
      { kind: 'CONFLICT', topic: '不存在的冲突' },
    ]) {
      const res = await reassessFromFormulation(pool, {
        actor: actorOf(q.owner), familyId: q.familyId, caseId: q.caseId,
        expectedCaseVersion: presentedQ.body.caseVersion,
        formulationVersion: 1,
        idempotencyKey: `t8rem-re-bad-${Date.now()}-${seq++}`,
        basis: basis as never,
      });
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    }

    const alt = await reassessFromFormulation(pool, {
      actor: actorOf(q.owner), familyId: q.familyId, caseId: q.caseId,
      expectedCaseVersion: presentedQ.body.caseVersion,
        formulationVersion: 1,
      idempotencyKey: `t8rem-re-alt-${Date.now()}-${seq++}`,
      basis: { kind: 'ALTERNATIVE_EXPLANATION', text: '替代解释 A' },
    });
    expect(alt.status).toBe(200);
  });

  // ── S8-M04 ────────────────────────────────────────────────
  it('no-op Correction is 422 while real state conflicts stay 409', async () => {
    const p = await prepare('m04');
    const presented = await present(p.owner, p.familyId, p.caseId, p.caseVersion, baseContent(p.messageId));
    expect(presented.status).toBe(200);

    const empty = await correctProblemFormulation(pool, {
      actor: actorOf(p.owner), familyId: p.familyId, caseId: p.caseId,
      expectedCaseVersion: presented.body.caseVersion,
      idempotencyKey: `t8rem-noop-${Date.now()}-${seq++}`,
      formulationVersion: 1,
      changes: {},
    });
    expect(empty.status).toBe(422);
    expect(empty.body).toMatchObject({ code: 'VALIDATION_ERROR' });

    const identical = await correctProblemFormulation(pool, {
      actor: actorOf(p.owner), familyId: p.familyId, caseId: p.caseId,
      expectedCaseVersion: presented.body.caseVersion,
      idempotencyKey: `t8rem-same-${Date.now()}-${seq++}`,
      formulationVersion: 1,
      changes: { sceneFit: 'family_common_core' },
    });
    expect(identical.status).toBe(422);

    const stale = await correctProblemFormulation(pool, {
      actor: actorOf(p.owner), familyId: p.familyId, caseId: p.caseId,
      expectedCaseVersion: presented.body.caseVersion,
      idempotencyKey: `t8rem-wrongver-${Date.now()}-${seq++}`,
      formulationVersion: 99,
      changes: { sceneFit: 'x' },
    });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ code: 'PROBLEM_FORMULATION_VERSION_CONFLICT' });

    const real = await correctProblemFormulation(pool, {
      actor: actorOf(p.owner), familyId: p.familyId, caseId: p.caseId,
      expectedCaseVersion: presented.body.caseVersion,
      idempotencyKey: `t8rem-real-${Date.now()}-${seq++}`,
      formulationVersion: 1,
      changes: { sceneFit: 'family_common_core_v2' },
    });
    expect(real.status).toBe(201);
  });

  // ── S8-M05 ────────────────────────────────────────────────
  it('public compliance blocks map to the frozen formulation contract, never 403', async () => {
    const p = await prepare('m05');
    const stranger = await admin.query(
      'INSERT INTO persons (account_id, created_by_account_id) VALUES (NULL,$1) RETURNING id',
      [p.owner.accountId]
    );
    const strangerId = stranger.rows[0].id as string;
    await admin.query('INSERT INTO family_members (family_id, person_id) VALUES ($1,$2)', [
      p.familyId, strangerId,
    ]);
    const observationId = await insertObservation({
      familyId: p.familyId, caseId: p.caseId,
      subjectPersonId: strangerId, sourcePersonId: p.owner.personId,
      valueState: 'KNOWN',
    });
    const presented = await present(p.owner, p.familyId, p.caseId, p.caseVersion, baseContent(p.messageId));
    expect(presented.status).toBe(200);
    // Simulate an authoritative Evidence set that now includes a person without
    // a compliance profile (the write path is denied to runtime on purpose).
    await admin.query(
      `UPDATE problem_formulations
          SET evidence_refs = evidence_refs || $2::jsonb,
              dependency_refs = dependency_refs || $3::jsonb
        WHERE case_id = $1`,
      [
        p.caseId,
        JSON.stringify([{ type: 'OBSERVATION', id: observationId }]),
        JSON.stringify([{ type: 'EVIDENCE', evidence: { type: 'OBSERVATION', id: observationId } }]),
      ]
    );

    for (const [label, call] of [
      ['confirm', () => confirmProblemFormulation(pool, {
        actor: actorOf(p.owner), familyId: p.familyId, caseId: p.caseId,
        expectedCaseVersion: presented.body.caseVersion,
        idempotencyKey: `t8rem-m05-confirm-${Date.now()}-${seq++}`,
        formulationVersion: 1, body: {},
      })],
      ['dispute', () => disputeProblemFormulation(pool, {
        actor: actorOf(p.owner), familyId: p.familyId, caseId: p.caseId,
        expectedCaseVersion: presented.body.caseVersion,
        idempotencyKey: `t8rem-m05-dispute-${Date.now()}-${seq++}`,
        formulationVersion: 1, body: {},
      })],
      ['correct', () => correctProblemFormulation(pool, {
        actor: actorOf(p.owner), familyId: p.familyId, caseId: p.caseId,
        expectedCaseVersion: presented.body.caseVersion,
        idempotencyKey: `t8rem-m05-corr-${Date.now()}-${seq++}`,
        formulationVersion: 1, changes: { sceneFit: 'family_common_core_v2' },
      })],
    ] as const) {
      const res = await call();
      expect(res.status, label).toBe(409);
      expect(res.body, label).toMatchObject({
        code: 'PROBLEM_FORMULATION_DEPENDENCY_INVALID',
      });
    }
  });
});