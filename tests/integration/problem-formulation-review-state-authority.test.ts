/**
 * AUTH-006 regression-first counterfactuals.
 *
 * These tests intentionally land before the production reconciliation. On the
 * pre-AUTH-006 runtime they prove the authority violation mechanically:
 * Problem Formulation exposes no independent review state and an upstream
 * Evidence correction cannot preserve lifecycle while marking the affected
 * formulation for review.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import {
  confirmProblemFormulation,

  getCurrentProblemFormulationView,
  presentProblemFormulation,
  reassessFromFormulation,
  resolveProblemFormulationReview,
  startAssessment,
} from '../../apps/server/api/src/services/problem-formulations.js';
import * as domainPublicApi from '@xiaoshuyin/domain';
import { recordStatement } from '../../packages/domain/src/evidence.js';
import { isProblemFormulationAuthoritativeExecutionBasis } from '../../packages/domain/src/problem-formulations.js';

const PREFIX = 'auth006_';

describe('AUTH-006 — Problem Formulation lifecycle / review-state separation', () => {
  it('does not expose a naked review-state resolution primitive from @xiaoshuyin/domain', () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        domainPublicApi,
        'resolveProblemFormulationReview'
      )
    ).toBe(false);
  });

  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let pool: pg.Pool;
  let seq = 0;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = new pg.Pool({ connectionString: process.env['TEST_ADMIN_DATABASE_URL'] });
    pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
  });

  afterAll(async () => {
    try {
      await admin.query(
        `DELETE FROM problem_formulations
           WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'AUTH006-%')`
      );
      await admin.query(
        `DELETE FROM assertions
           WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'AUTH006-%')`
      );
      await admin.query(
        `DELETE FROM business_audit_events
           WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'AUTH006-%')`
      );
      await admin.query(
        `DELETE FROM case_events
           WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'AUTH006-%')`
      );
      await admin.query(
        `DELETE FROM cases
           WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'AUTH006-%')`
      );
      await admin.query(
        `DELETE FROM idempotency_keys
           WHERE actor_account_id IN
             (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`
      );
      await admin.query(
        `DELETE FROM family_members
           WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'AUTH006-%')`
      );
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'AUTH006-%'`);
      await admin.query(
        `DELETE FROM persons
           WHERE created_by_account_id IN
             (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`
      );
      await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE '${PREFIX}%'`);
    } finally {
      await pool.end();
      await admin.end();
      await app.close();
    }
  });

  function key(label: string) {
    return `${PREFIX}${label}_${Date.now()}_${seq++}`;
  }

  async function login(label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: key(label) },
    });
    expect(res.statusCode).toBe(200);
    return {
      token: res.json().sessionToken as string,
      accountId: res.json().accountId as string,
      personId: res.json().person.id as string,
    };
  }

  async function createFamily(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': key(`family-${label}`),
      },
      payload: {
        displayName: `AUTH006-${label}-${seq++}`,
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function createCase(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': key(`case-${label}`),
      },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number; phase: string };
  }

  async function writeStatement(input: {
    familyId: string;
    caseId: string;
    accountId: string;
    personId: string;
    content: string;
    supersedesId?: string | null;
  }) {
    return withRlsTransaction(
      pool,
      {
        familyId: input.familyId,
        accountId: input.accountId,
        personId: input.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      (tx) =>
        recordStatement(
          tx,
          {
            familyId: input.familyId,
            caseId: input.caseId,
            actorAccountId: input.accountId,
            actorPersonId: input.personId,
            purpose: 'FAMILY_MANAGEMENT',
          },
          {
            subjectPersonId: input.personId,
            sourceKind: 'SELF_STATEMENT',
            sourcePersonId: input.personId,
            sourceMessageId: null,
            occurredTimeState: 'UNKNOWN',
            occurredAt: null,
            validFrom: null,
            validUntil: null,
            confirmationStatus: 'SOURCE_CONFIRMED',
            supersedesId: input.supersedesId ?? null,
            content: input.content,
          }
        )
    );
  }

  function formulationContent(statementId: string) {
    const ref = { type: 'ASSERTION' as const, id: statementId };
    return {
      primaryProblem: { text: '当前主要问题', evidenceRefs: [ref] },
      keyFactors: [],
      evidenceRefs: [ref],
      unknowns: [],
      conflicts: [],
      sceneFit: 'AUTH006_TEST',
      alternativeExplanations: [],
      reassessmentConditions: [{ text: '新证据要求重新评估' }],
      exitConditions: [],
      dependencyRefs: [{ type: 'EVIDENCE' as const, evidence: ref }],
    };
  }

  async function prepare(label: string) {
    const owner = await login(label);
    const familyId = await createFamily(owner.token, label);
    const created = await createCase(owner.token, label);
    const statement = await writeStatement({
      familyId,
      caseId: created.id,
      accountId: owner.accountId,
      personId: owner.personId,
      content: '原始事实陈述',
    });

    const started = await startAssessment(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: created.id,
      expectedCaseVersion: created.version,
      idempotencyKey: key(`start-${label}`),
    });
    expect(started.status).toBe(200);

    const presented = await presentProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: created.id,
      expectedCaseVersion: started.body.caseVersion,
      idempotencyKey: key(`present-${label}`),
      content: formulationContent(statement.id),
    });
    expect(presented.status).toBe(200);

    return { owner, familyId, created, statement, presented };
  }

  async function supersedeSource(input: Awaited<ReturnType<typeof prepare>>) {
    return writeStatement({
      familyId: input.familyId,
      caseId: input.created.id,
      accountId: input.owner.accountId,
      personId: input.owner.personId,
      content: '更正后的事实陈述',
      supersedesId: input.statement.id,
    });
  }

  async function formulationFacts(caseId: string) {
    const { rows } = await admin.query(
      `SELECT version, status, review_state
         FROM problem_formulations
        WHERE case_id = $1
        ORDER BY version`,
      [caseId]
    );
    return rows as Array<{ version: number; status: string; review_state: string }>;
  }

  it('Case A — normal confirmed formulation is lifecycle CONFIRMED + review CURRENT', async () => {
    const fx = await prepare('normal-current');
    const confirmed = await confirmProblemFormulation(pool, {
      actor: { accountId: fx.owner.accountId, personId: fx.owner.personId },
      familyId: fx.familyId,
      caseId: fx.created.id,
      expectedCaseVersion: fx.presented.body.caseVersion,
      idempotencyKey: key('confirm-normal'),
      formulationVersion: 1,
      body: {},
    });

    expect(confirmed.status).toBe(200);
    expect(confirmed.body.current).toMatchObject({
      status: 'CONFIRMED',
      reviewState: 'CURRENT',
    });
    expect(await formulationFacts(fx.created.id)).toEqual([
      expect.objectContaining({
        version: 1,
        status: 'CONFIRMED',
        review_state: 'CURRENT',
      }),
    ]);
  });

  it('Case B — Evidence correction marks review without changing lifecycle', async () => {
    const fx = await prepare('dependency-change');
    const confirmed = await confirmProblemFormulation(pool, {
      actor: { accountId: fx.owner.accountId, personId: fx.owner.personId },
      familyId: fx.familyId,
      caseId: fx.created.id,
      expectedCaseVersion: fx.presented.body.caseVersion,
      idempotencyKey: key('confirm-dependency'),
      formulationVersion: 1,
      body: {},
    });
    expect(confirmed.status).toBe(200);

    await supersedeSource(fx);

    expect(await formulationFacts(fx.created.id)).toEqual([
      expect.objectContaining({
        version: 1,
        status: 'CONFIRMED',
        review_state: 'NEEDS_REVIEW',
      }),
    ]);

    const view = await getCurrentProblemFormulationView(pool, {
      actor: { accountId: fx.owner.accountId, personId: fx.owner.personId },
      familyId: fx.familyId,
      caseId: fx.created.id,
    });
    expect(view.current).toMatchObject({
      status: 'CONFIRMED',
      reviewState: 'NEEDS_REVIEW',
    });

    const caseRow = await admin.query(
      'SELECT status, phase FROM cases WHERE id = $1',
      [fx.created.id]
    );
    expect(caseRow.rows[0]).toEqual({ status: 'OPEN', phase: 'GOALS' });
  });

  async function confirmedWithReview(label: string) {
    const fx = await prepare(label);
    const confirmed = await confirmProblemFormulation(pool, {
      actor: { accountId: fx.owner.accountId, personId: fx.owner.personId },
      familyId: fx.familyId,
      caseId: fx.created.id,
      expectedCaseVersion: fx.presented.body.caseVersion,
      idempotencyKey: key(`confirm-${label}`),
      formulationVersion: 1,
      body: {},
    });
    expect(confirmed.status).toBe(200);
    const successorStatement = await supersedeSource(fx);
    expect(await formulationFacts(fx.created.id)).toEqual([
      expect.objectContaining({
        version: 1,
        status: 'CONFIRMED',
        review_state: 'NEEDS_REVIEW',
      }),
    ]);
    const caseRow = await admin.query(
      'SELECT phase FROM cases WHERE id = $1',
      [fx.created.id]
    );
    expect(caseRow.rows[0]).toEqual({ phase: 'GOALS' });
    return { ...fx, confirmed, successorStatement };
  }

  function evidenceRef(id: string) {
    return { type: 'ASSERTION' as const, id };
  }

  it('Case C — CONFIRMED + NEEDS_REVIEW cannot drive reassessment execution', async () => {
    const fx = await confirmedWithReview('execution-suppression');

    const facts = await formulationFacts(fx.created.id);
    expect(
      isProblemFormulationAuthoritativeExecutionBasis({
        status: facts[0]!.status as never,
        review_state: facts[0]!.review_state as never,
      })
    ).toBe(false);

    const before = await admin.query(
      'SELECT phase, version FROM cases WHERE id = $1',
      [fx.created.id]
    );

    const blocked = await reassessFromFormulation(pool, {
      actor: { accountId: fx.owner.accountId, personId: fx.owner.personId },
      familyId: fx.familyId,
      caseId: fx.created.id,
      expectedCaseVersion: fx.confirmed.body.caseVersion,
      idempotencyKey: key('reassess-blocked'),
      formulationVersion: 1,
      basis: { kind: 'REASSESSMENT_CONDITION', text: '新证据要求重新评估' },
    });

expect(blocked.status).toBe(409);

    const after = await admin.query(
      'SELECT phase, version FROM cases WHERE id = $1',
      [fx.created.id]
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('Case C2 — phase-legal Case still blocks reassessment on NEEDS_REVIEW', async () => {
    const fx = await confirmedWithReview('review-gate');
    await admin.query(`UPDATE cases SET phase = 'PROBLEM_FORMULATION' WHERE id = $1`, [
      fx.created.id,
    ]);

    const blocked = await reassessFromFormulation(pool, {
      actor: { accountId: fx.owner.accountId, personId: fx.owner.personId },
      familyId: fx.familyId,
      caseId: fx.created.id,
      expectedCaseVersion: fx.confirmed.body.caseVersion,
      idempotencyKey: key('reassess-review-gate'),
      formulationVersion: 1,
      basis: { kind: 'REASSESSMENT_CONDITION', text: '新证据要求重新评估' },
    });

    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({
      code: 'PROBLEM_FORMULATION_DEPENDENCY_INVALID',
    });
  });

  it('Case D — authorized NO_MATERIAL_IMPACT review restores CURRENT on the same version', async () => {
    const fx = await confirmedWithReview('no-material-impact');

    const resolved = await resolveProblemFormulationReview(pool, {
      actor: { accountId: fx.owner.accountId, personId: fx.owner.personId },
      familyId: fx.familyId,
      caseId: fx.created.id,
      expectedCaseVersion: fx.confirmed.body.caseVersion,
      idempotencyKey: key('review-no-material'),
      formulationId: fx.presented.body.current.id,
      formulationVersion: 1,
      decision: 'NO_MATERIAL_IMPACT',
      reviewBasis: '更正后的陈述与原问题陈述一致，无实质影响',
      reviewEvidenceRefs: [evidenceRef(fx.successorStatement.id)],
    });

    expect(resolved.status).toBe(200);
    expect(resolved.body.current).toMatchObject({
      version: 1,
      status: 'CONFIRMED',
      reviewState: 'CURRENT',
    });
    expect(await formulationFacts(fx.created.id)).toEqual([
      expect.objectContaining({
        version: 1,
        status: 'CONFIRMED',
        review_state: 'CURRENT',
      }),
    ]);

    const caseRow = await admin.query(
      'SELECT phase, version FROM cases WHERE id = $1',
      [fx.created.id]
    );
    expect(caseRow.rows[0]).toEqual({
      phase: 'GOALS',
      version: fx.confirmed.body.caseVersion,
    });

    const audit = await admin.query(
      `SELECT metadata
         FROM business_audit_events
        WHERE resource_id = $1
          AND event_type = 'CASE_PROBLEM_FORMULATION_REVIEW_RESOLVED'`,
      [fx.presented.body.current.id]
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].metadata).toMatchObject({
      formulationId: fx.presented.body.current.id,
      formulationVersion: 1,
      reviewDecision: 'NO_MATERIAL_IMPACT',
      reviewBasis: '更正后的陈述与原问题陈述一致，无实质影响',
      fromReviewState: 'NEEDS_REVIEW',
      toReviewState: 'CURRENT',
    });
  });

  it('binds reviewEvidenceRefs into idempotency and exact replay has no duplicate side effects', async () => {
    const fx = await confirmedWithReview('review-idempotency');
    const idempotencyKey = key('review-evidence-idempotency');
    const request = {
      actor: { accountId: fx.owner.accountId, personId: fx.owner.personId },
      familyId: fx.familyId,
      caseId: fx.created.id,
      expectedCaseVersion: fx.confirmed.body.caseVersion,
      idempotencyKey,
      formulationId: fx.presented.body.current.id,
      formulationVersion: 1,
      decision: 'NO_MATERIAL_IMPACT' as const,
      reviewBasis: '幂等复核证据绑定',
      reviewEvidenceRefs: [evidenceRef(fx.successorStatement.id)],
    };

    const first = await resolveProblemFormulationReview(pool, request);
    expect(first.status).toBe(200);

    const replay = await resolveProblemFormulationReview(pool, request);
    expect(replay).toEqual(first);

    const afterReplayAudit = await admin.query(
      `SELECT count(*)::int AS count
         FROM business_audit_events
        WHERE resource_id = $1
          AND event_type = 'CASE_PROBLEM_FORMULATION_REVIEW_RESOLVED'`,
      [fx.presented.body.current.id]
    );
    expect(afterReplayAudit.rows[0].count).toBe(1);

    let mismatchError: unknown;
    try {
      await resolveProblemFormulationReview(pool, {
        ...request,
        reviewEvidenceRefs: [evidenceRef(fx.statement.id)],
      });
    } catch (error) {
      mismatchError = error;
    }
    expect(mismatchError).toMatchObject({
      statusCode: 409,
      code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
    });

    const finalAudit = await admin.query(
      `SELECT count(*)::int AS count
         FROM business_audit_events
        WHERE resource_id = $1
          AND event_type = 'CASE_PROBLEM_FORMULATION_REVIEW_RESOLVED'`,
      [fx.presented.body.current.id]
    );
    expect(finalAudit.rows[0].count).toBe(1);
  });

  it('Case E — authorized MATERIAL_CHANGE supersedes v1, creates v2 and rewinds phase', async () => {
    const fx = await confirmedWithReview('material-change');
    const ref = evidenceRef(fx.successorStatement.id);

    const resolved = await resolveProblemFormulationReview(pool, {
      actor: { accountId: fx.owner.accountId, personId: fx.owner.personId },
      familyId: fx.familyId,
      caseId: fx.created.id,
      expectedCaseVersion: fx.confirmed.body.caseVersion,
      idempotencyKey: key('review-material'),
      formulationId: fx.presented.body.current.id,
      formulationVersion: 1,
      decision: 'MATERIAL_CHANGE',
      reviewBasis: '更正后的陈述推翻原问题定义',
      successorChanges: {
        primaryProblem: {
          text: '复核后确认存在实质变化',
          evidenceRefs: [ref],
        },
        evidenceRefs: [ref],
        dependencyRefs: [{ type: 'EVIDENCE', evidence: ref }],
      },
      note: 'AUTH-006 material-change counterfactual',
    });

    expect(resolved.status).toBe(201);
    expect(resolved.body.current).toMatchObject({
      version: 2,
      status: 'PRESENTED',
      reviewState: 'CURRENT',
      supersedesVersion: 1,
    });

    expect(await formulationFacts(fx.created.id)).toEqual([
      expect.objectContaining({
        version: 1,
        status: 'SUPERSEDED',
        review_state: 'NEEDS_REVIEW',
      }),
      expect.objectContaining({
        version: 2,
        status: 'PRESENTED',
        review_state: 'CURRENT',
      }),
    ]);

    const caseRow = await admin.query(
      'SELECT phase, version FROM cases WHERE id = $1',
      [fx.created.id]
    );
    expect(caseRow.rows[0]).toEqual({
      phase: 'PROBLEM_FORMULATION',
      version: fx.confirmed.body.caseVersion + 1,
    });

    const audit = await admin.query(
      `SELECT metadata
         FROM business_audit_events
        WHERE resource_id = $1
          AND event_type = 'CASE_PROBLEM_FORMULATION_MATERIAL_CHANGE_RESOLVED'`,
      [resolved.body.current.id]
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].metadata).toMatchObject({
      formulationId: fx.presented.body.current.id,
      formulationVersion: 1,
      reviewDecision: 'MATERIAL_CHANGE',
      reviewBasis: '更正后的陈述推翻原问题定义',
      successorVersion: 2,
      fromPhase: 'GOALS',
      toPhase: 'PROBLEM_FORMULATION',
    });

    const correctionEvent = await admin.query(
      `SELECT metadata
         FROM case_events
        WHERE case_id = $1
          AND event_type = 'CASE_PROBLEM_FORMULATION_CORRECTED'`,
      [fx.created.id]
    );
    expect(correctionEvent.rows).toHaveLength(1);
    expect(correctionEvent.rows[0].metadata).toMatchObject({
      fromFormulationVersion: 1,
      toFormulationVersion: 2,
      fromStatus: 'CONFIRMED',
      toStatus: 'PRESENTED',
    });

    const reconfirmed = await confirmProblemFormulation(pool, {
      actor: { accountId: fx.owner.accountId, personId: fx.owner.personId },
      familyId: fx.familyId,
      caseId: fx.created.id,
      expectedCaseVersion: resolved.body.caseVersion,
      idempotencyKey: key('reconfirm-material'),
      formulationVersion: 2,
      body: { note: '重新确认 successor' },
    });

    expect(reconfirmed.status).toBe(200);
    expect(await formulationFacts(fx.created.id)).toEqual([
      expect.objectContaining({
        version: 1,
        status: 'SUPERSEDED',
        review_state: 'NEEDS_REVIEW',
      }),
      expect.objectContaining({
        version: 2,
        status: 'CONFIRMED',
        review_state: 'CURRENT',
      }),
    ]);

    const finalCase = await admin.query(
      'SELECT phase, version FROM cases WHERE id = $1',
      [fx.created.id]
    );
    expect(finalCase.rows[0]).toEqual({
      phase: 'GOALS',
      version: resolved.body.caseVersion + 1,
    });
  });

  it('Case F — unauthorized actor cannot resolve NEEDS_REVIEW', async () => {
    const fx = await confirmedWithReview('unauthorized-review');
    const outsider = await login('unauthorized-outsider');
    await admin.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [fx.familyId, outsider.personId]
    );

    let deniedError: unknown;
    try {
      await resolveProblemFormulationReview(pool, {
        actor: {
          accountId: outsider.accountId,
          personId: outsider.personId,
        },
        familyId: fx.familyId,
        caseId: fx.created.id,
        expectedCaseVersion: fx.confirmed.body.caseVersion,
        idempotencyKey: key('review-unauthorized'),
        formulationId: fx.presented.body.current.id,
        formulationVersion: 1,
        decision: 'NO_MATERIAL_IMPACT',
        reviewBasis: 'unauthorized attempt',
        reviewEvidenceRefs: [evidenceRef(fx.successorStatement.id)],
      });
    } catch (error) {
      deniedError = error;
    }

    expect(deniedError).toBeDefined();
    expect((deniedError as { statusCode?: number }).statusCode).toBe(404);
    expect(await formulationFacts(fx.created.id)).toEqual([
      expect.objectContaining({
        version: 1,
        status: 'CONFIRMED',
        review_state: 'NEEDS_REVIEW',
      }),
    ]);
  });

  it('Case G — unrelated formulation remains CURRENT when only one dependency changes', async () => {
    const fx = await prepare('unrelated-formulations');
    const confirmed1 = await confirmProblemFormulation(pool, {
      actor: { accountId: fx.owner.accountId, personId: fx.owner.personId },
      familyId: fx.familyId,
      caseId: fx.created.id,
      expectedCaseVersion: fx.presented.body.caseVersion,
      idempotencyKey: key('confirm-unrelated-1'),
      formulationVersion: 1,
      body: {},
    });
    expect(confirmed1.status).toBe(200);

    const secondCase = await createCase(fx.owner.token, 'unrelated-second');
    await admin.query(
      `INSERT INTO problem_formulations
         (family_id, case_id, version, status, review_state, primary_problem,
          key_factors, evidence_refs, unknowns, conflicts, scene_fit,
          alternative_explanations, reassessment_conditions, exit_conditions,
          user_response, confirmed_by_person_id, confirmed_at,
          dependency_refs, supersedes_version)
       VALUES ($1, $2, 1, 'CONFIRMED', 'CURRENT', $3::jsonb, '[]'::jsonb,
               $4::jsonb, '[]'::jsonb, '[]'::jsonb, 'AUTH006_UNRELATED',
               '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $5::jsonb, $6, now(),
               '[]'::jsonb, NULL)`,
      [
        fx.familyId,
        secondCase.id,
        JSON.stringify({ text: 'unrelated formulation probe' }),
        JSON.stringify([
          { type: 'ASSERTION', id: '11111111-1111-4111-8111-111111111111' },
        ]),
        JSON.stringify({
          kind: 'CONFIRM',
          actorPersonId: fx.owner.personId,
          respondedAt: new Date().toISOString(),
        }),
        fx.owner.personId,
      ]
    );

    await supersedeSource(fx);

    expect(await formulationFacts(fx.created.id)).toEqual([
      expect.objectContaining({
        version: 1,
        status: 'CONFIRMED',
        review_state: 'NEEDS_REVIEW',
      }),
    ]);
    expect(await formulationFacts(secondCase.id)).toEqual([
      expect.objectContaining({
        version: 1,
        status: 'CONFIRMED',
        review_state: 'CURRENT',
      }),
    ]);
  });
});
