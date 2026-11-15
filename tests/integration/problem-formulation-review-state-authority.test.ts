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
  correctProblemFormulation,
  getCurrentProblemFormulationView,
  presentProblemFormulation,
  reassessFromFormulation,
  startAssessment,
} from '../../apps/server/api/src/services/problem-formulations.js';
import { recordStatement } from '../../packages/domain/src/evidence.js';

const PREFIX = 'auth006_';

describe('AUTH-006 — Problem Formulation lifecycle / review-state separation', () => {
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

  it('Case C — NEEDS_REVIEW cannot drive reassessment execution even with otherwise-valid evidence', async () => {
    const fx = await prepare('execution-suppression');

    await admin.query(
      `UPDATE problem_formulations
          SET review_state = 'NEEDS_REVIEW'
        WHERE case_id = $1 AND version = 1`,
      [fx.created.id]
    );

    const before = await admin.query(
      'SELECT phase, version FROM cases WHERE id = $1',
      [fx.created.id]
    );

    const blocked = await reassessFromFormulation(pool, {
      actor: { accountId: fx.owner.accountId, personId: fx.owner.personId },
      familyId: fx.familyId,
      caseId: fx.created.id,
      expectedCaseVersion: fx.presented.body.caseVersion,
      idempotencyKey: key('reassess-blocked'),
      formulationVersion: 1,
      basis: { kind: 'REASSESSMENT_CONDITION', text: '新证据要求重新评估' },
    });

    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({
      code: 'PROBLEM_FORMULATION_DEPENDENCY_INVALID',
    });

    const after = await admin.query(
      'SELECT phase, version FROM cases WHERE id = $1',
      [fx.created.id]
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('Case E — material correction supersedes reviewed version and creates CURRENT successor', async () => {
    const fx = await prepare('material-change');

    await admin.query(
      `UPDATE problem_formulations
          SET review_state = 'NEEDS_REVIEW'
        WHERE case_id = $1 AND version = 1`,
      [fx.created.id]
    );

    const corrected = await correctProblemFormulation(pool, {
      actor: { accountId: fx.owner.accountId, personId: fx.owner.personId },
      familyId: fx.familyId,
      caseId: fx.created.id,
      expectedCaseVersion: fx.presented.body.caseVersion,
      idempotencyKey: key('material-correction'),
      formulationVersion: 1,
      changes: {
        primaryProblem: {
          text: '复核后确认存在实质变化',
          evidenceRefs: [{ type: 'ASSERTION', id: fx.statement.id }],
        },
      },
      note: 'AUTH-006 material-change counterfactual',
    });

    expect(corrected.status).toBe(201);
    expect(corrected.body.current).toMatchObject({
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
  });
});
