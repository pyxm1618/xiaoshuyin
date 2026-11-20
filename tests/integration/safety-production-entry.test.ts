/**
 * Phase 5 / C2 targeted evidence — Safety production entry / resolve.
 *
 * Exercises the real internal orchestration seam. Tests may inject deterministic
 * approved evaluator/policy fixtures; production defaults remain unavailable
 * until D6 provides a real approved rule asset.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import {
  buildApp,
  createSafetyProductionService,
  type SafetyProductionAuthorityProvider,
  type SafetyProductionEntryInput,
  type SafetyProductionResolveInput,
} from '../../apps/server/api/src/app.js';
import type {
  ApprovedPolicyIdentity,
  ApprovedRuleEvaluation,
  SafetyCaseSnapshot,
} from '../../packages/domain/src/safety/index.js';
import { createAdminPool } from '../setup/db.js';
import {
  createSafetyFixture,
  type ActorSession,
  type SafetyFixture,
} from '../setup/safety.js';

const PREFIX = 'c2_prod_';

const IDENTITY: ApprovedPolicyIdentity = {
  policyRef: 'policy.c2.fixture',
  policyVersion: '1',
  ruleRef: 'rule.c2.fixture',
  ruleVersion: '1',
};

let keySeq = 0;
const operationKey = (label: string) =>
  `c2-${label}-${Date.now()}-${keySeq++}`;

function holdEvaluation(
  identity: ApprovedPolicyIdentity = IDENTITY,
  extra: Record<string, unknown> = {}
): ApprovedRuleEvaluation {
  return {
    outcome: 'HOLD_REQUIRED',
    ...identity,
    riskCategoryRef: 'CATEGORY_C2_FIXTURE',
    evidenceRefs: [],
    ...extra,
  } as ApprovedRuleEvaluation;
}

function noHoldEvaluation(
  identity: ApprovedPolicyIdentity = IDENTITY
): ApprovedRuleEvaluation {
  return {
    outcome: 'NO_HOLD',
    ...identity,
    evidenceRefs: [],
  };
}

function authority(options: {
  identities?: ApprovedPolicyIdentity[];
  evaluation?:
    | ApprovedRuleEvaluation
    | null
    | ((input: {
        case: SafetyCaseSnapshot;
        trustedPolicyIdentity: ApprovedPolicyIdentity;
      }) => Promise<ApprovedRuleEvaluation | null> | ApprovedRuleEvaluation | null);
} = {}): SafetyProductionAuthorityProvider {
  let identityIndex = 0;
  return {
    async currentPolicyIdentity() {
      const identities = options.identities ?? [IDENTITY];
      const selected =
        identities[Math.min(identityIndex, identities.length - 1)] ?? null;
      identityIndex += 1;
      return selected;
    },
    async evaluate(input) {
      if (typeof options.evaluation === 'function') {
        return options.evaluation(input);
      }
      return options.evaluation === undefined
        ? holdEvaluation(input.trustedPolicyIdentity)
        : options.evaluation;
    },
  };
}

function runSafetyProductionEntry(
  pool: pg.Pool,
  input: SafetyProductionEntryInput,
  provider?: SafetyProductionAuthorityProvider
) {
  const service =
    provider === undefined
      ? createSafetyProductionService(pool)
      : createSafetyProductionService(pool, provider);
  return service.enter(input);
}

function runSafetyProductionResolve(
  pool: pg.Pool,
  input: SafetyProductionResolveInput,
  provider?: SafetyProductionAuthorityProvider
) {
  const service =
    provider === undefined
      ? createSafetyProductionService(pool)
      : createSafetyProductionService(pool, provider);
  return service.resolve(input);
}

describe('Phase 5 / C2 Safety production entry / resolve', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let fixture: SafetyFixture;
  let owner: ActorSession;
  let staff: ActorSession;
  let ordinary: ActorSession;
  let familyId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    fixture = createSafetyFixture({ app, admin, prefix: PREFIX });
    owner = await fixture.login('owner');
    staff = await fixture.login('staff');
    ordinary = await fixture.login('ordinary');
    familyId = await fixture.createFamily(owner, 'main');
  });

  afterAll(async () => {
    await admin
      .query(
        `DELETE FROM staff_assignments
          WHERE account_id IN (
            SELECT id FROM accounts WHERE wechat_openid LIKE $1
          )`,
        [`${PREFIX}%`]
      )
      .catch(() => undefined);
    await fixture.cleanup();
    await fixture.close();
    await admin.end();
    await app.close();
  });

  async function newCase() {
    return fixture.createCase(owner);
  }

  async function enterHeldCase() {
    const created = await newCase();
    const result = await runSafetyProductionEntry(
      fixture.pool,
      {
        actor: owner,
        caseId: created.id,
        operationKey: operationKey('enter'),
      },
      authority()
    );
    expect(result.kind).toBe('ENTER_HOLD');
    const held = await fixture.getCase(created.id);
    expect(held.status).toBe('SAFETY_HOLD');
    return held;
  }

  async function createReviewEvidence(caseId: string): Promise<string> {
    const message = await fixture.app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/messages`,
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': operationKey('message'),
      },
      payload: { content: 'C2 review evidence fixture' },
    });
    expect(message.statusCode).toBe(201);
    return message.json().id as string;
  }

  async function seedResolver(
    caseId: string,
    options: {
      assignmentCaseId?: string;
      revoked?: boolean;
      expired?: boolean;
    } = {}
  ): Promise<string> {
    const now = Date.now();
    const grant = await admin.query<{ id: string }>(
      `INSERT INTO staff_assignments
         (account_id, person_id, capability, scope_type,
          granted_by_account_id, valid_from, valid_until)
       VALUES ($1, $2, 'SAFETY_RESOLVE', 'GLOBAL', $3, $4, $5)
       RETURNING id`,
      [
        staff.accountId,
        staff.personId,
        owner.accountId,
        new Date(now - 60_000),
        new Date(now + 60 * 60_000),
      ]
    );

    const assignment = await admin.query<{ id: string }>(
      `INSERT INTO staff_assignments
         (account_id, person_id, capability, scope_type,
          family_id, case_id, capability_grant_id,
          granted_by_account_id, granted_at, valid_from, valid_until,
          revoked_by_account_id, revoked_at)
       VALUES ($1, $2, 'SAFETY_RESOLVE', 'CASE',
               $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        staff.accountId,
        staff.personId,
        familyId,
        options.assignmentCaseId ?? caseId,
        grant.rows[0]!.id,
        owner.accountId,
        new Date(now - 60_000),
        options.expired
          ? new Date(now - 120_000)
          : new Date(now - 60_000),
        options.expired
          ? new Date(now - 60_000)
          : new Date(now + 60 * 60_000),
        options.revoked ? owner.accountId : null,
        options.revoked ? new Date(now - 1_000) : null,
      ]
    );
    return assignment.rows[0]!.id;
  }

  async function resolveHeld(
    actor: ActorSession,
    caseId: string,
    expectedCaseVersion: number,
    reviewEvidenceRefs: Array<{ kind: string; ref: string }>,
    provider: SafetyProductionAuthorityProvider = authority()
  ) {
    return runSafetyProductionResolve(
      fixture.pool,
      {
        actor,
        caseId,
        operationKey: operationKey('resolve'),
        expectedCaseVersion,
        reviewEvidenceRefs,
      },
      provider
    );
  }

  it('approved HOLD_REQUIRED flows through precheck into the existing EnterSafetyHold command', async () => {
    const created = await newCase();
    const before = await fixture.getCase(created.id);

    const result = await runSafetyProductionEntry(
      fixture.pool,
      {
        actor: owner,
        caseId: created.id,
        operationKey: operationKey('approved-hold'),
      },
      authority()
    );

    expect(result.kind).toBe('ENTER_HOLD');
    const after = await fixture.getCase(created.id);
    expect(after.status).toBe('SAFETY_HOLD');
    expect(after.phase).toBe(before.phase);
    expect(after.version).toBe(before.version + 1);
    expect(await fixture.countRiskEvents(created.id)).toBe(1);
  });

  it('replays a completed production-entry operation with the exact original response', async () => {
    const created = await newCase();
    const key = operationKey('entry-replay');

    const first = await runSafetyProductionEntry(
      fixture.pool,
      { actor: owner, caseId: created.id, operationKey: key },
      authority()
    );
    expect(first.kind).toBe('ENTER_HOLD');
    const riskAfterFirst = await fixture.countRiskEvents(created.id);
    const eventsAfterFirst = await fixture.countCaseEvents(created.id);

    // A real production retry must not downgrade the completed command into
    // ALREADY_HELD just because the current Case now reflects the first write.
    const second = await runSafetyProductionEntry(
      fixture.pool,
      { actor: owner, caseId: created.id, operationKey: key }
    );

    expect(second).toEqual(first);
    expect(await fixture.countRiskEvents(created.id)).toBe(riskAfterFirst);
    expect(await fixture.countCaseEvents(created.id)).toBe(eventsAfterFirst);
  });

  it('replays the original entry even after that hold has subsequently been resolved', async () => {
    const created = await newCase();
    const key = operationKey('entry-replay-after-resolve');
    const first = await runSafetyProductionEntry(
      fixture.pool,
      { actor: owner, caseId: created.id, operationKey: key },
      authority()
    );
    expect(first.kind).toBe('ENTER_HOLD');

    const held = await fixture.getCase(created.id);
    const evidenceId = await createReviewEvidence(created.id);
    await seedResolver(created.id);
    await resolveHeld(
      staff,
      created.id,
      held.version,
      [{ kind: 'MESSAGE', ref: evidenceId }]
    );
    expect((await fixture.getCase(created.id)).status).toBe('WAITING');

    // No D6 provider is supplied on retry. The completed existing command
    // reservation is sufficient to replay the original response.
    const replay = await runSafetyProductionEntry(
      fixture.pool,
      { actor: owner, caseId: created.id, operationKey: key }
    );
    expect(replay).toEqual(first);
  });

  it('rejects reuse of a completed entry operation key for a different visible Case', async () => {
    const firstCase = await newCase();
    const key = operationKey('entry-replay-mismatch');
    await runSafetyProductionEntry(
      fixture.pool,
      { actor: owner, caseId: firstCase.id, operationKey: key },
      authority()
    );

    const secondCase = await newCase();
    await expect(
      runSafetyProductionEntry(
        fixture.pool,
        { actor: owner, caseId: secondCase.id, operationKey: key },
        authority()
      )
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' });

    expect((await fixture.getCase(secondCase.id)).status).toBe('OPEN');
    expect(await fixture.countRiskEvents(secondCase.id)).toBe(0);
  });

  it('NO_HOLD returns ALLOW with zero Safety mutation', async () => {
    const created = await newCase();
    const before = await fixture.getCase(created.id);

    const result = await runSafetyProductionEntry(
      fixture.pool,
      {
        actor: owner,
        caseId: created.id,
        operationKey: operationKey('allow'),
      },
      authority({ evaluation: noHoldEvaluation() })
    );

    expect(result).toEqual({
      kind: 'ALLOW',
      caseId: created.id,
      caseVersion: before.version,
    });
    const after = await fixture.getCase(created.id);
    expect(after.status).toBe(before.status);
    expect(after.version).toBe(before.version);
    expect(await fixture.countRiskEvents(created.id)).toBe(0);
  });

  it('NO_HOLD fails closed when its evaluation identity is not the current trusted identity', async () => {
    const created = await newCase();
    const staleEvaluationIdentity: ApprovedPolicyIdentity = {
      ...IDENTITY,
      ruleVersion: '0',
    };

    await expect(
      runSafetyProductionEntry(
        fixture.pool,
        {
          actor: owner,
          caseId: created.id,
          operationKey: operationKey('allow-stale-evaluation'),
        },
        authority({ evaluation: noHoldEvaluation(staleEvaluationIdentity) })
      )
    ).rejects.toMatchObject({ code: 'SAFETY_PRECHECK_STALE' });

    expect((await fixture.getCase(created.id)).status).toBe('OPEN');
    expect(await fixture.countRiskEvents(created.id)).toBe(0);
  });

  it('NO_HOLD fails closed when policy/rule identity changes while the evaluator is running', async () => {
    const created = await newCase();
    const successor: ApprovedPolicyIdentity = {
      ...IDENTITY,
      policyVersion: '2',
    };

    await expect(
      runSafetyProductionEntry(
        fixture.pool,
        {
          actor: owner,
          caseId: created.id,
          operationKey: operationKey('allow-policy-race'),
        },
        authority({
          identities: [IDENTITY, successor],
          evaluation: noHoldEvaluation(IDENTITY),
        })
      )
    ).rejects.toMatchObject({ code: 'SAFETY_PRECHECK_STALE' });

    expect((await fixture.getCase(created.id)).status).toBe('OPEN');
    expect(await fixture.countRiskEvents(created.id)).toBe(0);
  });

  it('NO_HOLD fails closed when the Case enters SAFETY_HOLD while evaluation is running', async () => {
    const created = await newCase();
    const before = await fixture.getCase(created.id);

    await expect(
      runSafetyProductionEntry(
        fixture.pool,
        {
          actor: owner,
          caseId: created.id,
          operationKey: operationKey('allow-case-race'),
        },
        authority({
          evaluation: async ({ trustedPolicyIdentity }) => {
            // TEST-ONLY concurrent state construction: production state
            // transitions still belong exclusively to the Safety commands.
            await fixture.setCaseStatus(created.id, 'SAFETY_HOLD');
            return noHoldEvaluation(trustedPolicyIdentity);
          },
        })
      )
    ).rejects.toMatchObject({ code: 'SAFETY_PRECHECK_STALE' });

    const after = await fixture.getCase(created.id);
    expect(after.status).toBe('SAFETY_HOLD');
    expect(after.version).toBe(before.version + 1);
    expect(await fixture.countRiskEvents(created.id)).toBe(0);
  });

  it('already held returns ALREADY_HELD without evaluating or duplicating trace', async () => {
    const held = await enterHeldCase();
    const riskBefore = await fixture.countRiskEvents(held.id);
    const eventsBefore = await fixture.countCaseEvents(held.id);
    let evaluateCalled = false;

    const result = await runSafetyProductionEntry(
      fixture.pool,
      {
        actor: owner,
        caseId: held.id,
        operationKey: operationKey('already-held'),
      },
      authority({
        evaluation: async () => {
          evaluateCalled = true;
          throw new Error('already-held must not evaluate');
        },
      })
    );

    expect(result).toEqual({
      kind: 'ALREADY_HELD',
      caseId: held.id,
      caseVersion: held.version,
    });
    expect(evaluateCalled).toBe(false);
    expect((await fixture.getCase(held.id)).version).toBe(held.version);
    expect(await fixture.countRiskEvents(held.id)).toBe(riskBefore);
    expect(await fixture.countCaseEvents(held.id)).toBe(eventsBefore);
  });

  it('fails closed when the Case revision changes after evaluation', async () => {
    const created = await newCase();
    const before = await fixture.getCase(created.id);

    await expect(
      runSafetyProductionEntry(
        fixture.pool,
        {
          actor: owner,
          caseId: created.id,
          operationKey: operationKey('stale-case'),
        },
        authority({
          evaluation: async ({ trustedPolicyIdentity }) => {
            await admin.query(
              'UPDATE cases SET version = version + 1 WHERE id = $1',
              [created.id]
            );
            return holdEvaluation(trustedPolicyIdentity);
          },
        })
      )
    ).rejects.toMatchObject({ code: 'SAFETY_PRECHECK_STALE' });

    const after = await fixture.getCase(created.id);
    expect(after.status).toBe('OPEN');
    expect(after.version).toBe(before.version + 1);
    expect(await fixture.countRiskEvents(created.id)).toBe(0);
  });

  it('fails closed when trusted policy/rule identity changes before the command', async () => {
    const created = await newCase();
    const stale: ApprovedPolicyIdentity = {
      ...IDENTITY,
      ruleVersion: '2',
    };

    await expect(
      runSafetyProductionEntry(
        fixture.pool,
        {
          actor: owner,
          caseId: created.id,
          operationKey: operationKey('stale-policy'),
        },
        authority({ identities: [IDENTITY, stale] })
      )
    ).rejects.toMatchObject({ code: 'SAFETY_PRECHECK_STALE' });

    expect((await fixture.getCase(created.id)).status).toBe('OPEN');
    expect(await fixture.countRiskEvents(created.id)).toBe(0);
  });

  it('missing approved evaluation fails closed', async () => {
    const created = await newCase();
    await expect(
      runSafetyProductionEntry(
        fixture.pool,
        {
          actor: owner,
          caseId: created.id,
          operationKey: operationKey('missing-eval'),
        },
        authority({ evaluation: null })
      )
    ).rejects.toMatchObject({ code: 'SAFETY_PRECHECK_INVALID' });
    expect((await fixture.getCase(created.id)).status).toBe('OPEN');
  });

  it('rejects caller-supplied isHighRisk authority before evaluation', async () => {
    const created = await newCase();
    let evaluatorCalled = false;
    const provider = authority({
      evaluation: async ({ trustedPolicyIdentity }) => {
        evaluatorCalled = true;
        return holdEvaluation(trustedPolicyIdentity);
      },
    });

    await expect(
      runSafetyProductionEntry(
        fixture.pool,
        {
          actor: owner,
          caseId: created.id,
          operationKey: operationKey('caller-high-risk'),
          isHighRisk: true,
        } as never,
        provider
      )
    ).rejects.toMatchObject({ code: 'SAFETY_PRECHECK_INVALID' });

    expect(evaluatorCalled).toBe(false);
    expect((await fixture.getCase(created.id)).status).toBe('OPEN');
    expect(await fixture.countRiskEvents(created.id)).toBe(0);
  });

  it('caller-forged boolean or malformed approved evaluation fails closed', async () => {
    const created = await newCase();
    const forged = {
      ...holdEvaluation(),
      isHighRisk: true,
    } as unknown as ApprovedRuleEvaluation;

    await expect(
      runSafetyProductionEntry(
        fixture.pool,
        {
          actor: owner,
          caseId: created.id,
          operationKey: operationKey('forged-boolean'),
        },
        authority({ evaluation: forged })
      )
    ).rejects.toMatchObject({ code: 'SAFETY_PRECHECK_INVALID' });

    expect((await fixture.getCase(created.id)).status).toBe('OPEN');
    expect(await fixture.countRiskEvents(created.id)).toBe(0);
  });

  it('production default has no fake approved rule asset and fails closed', async () => {
    const created = await newCase();
    await expect(
      runSafetyProductionEntry(fixture.pool, {
        actor: owner,
        caseId: created.id,
        operationKey: operationKey('no-d6-asset'),
      })
    ).rejects.toMatchObject({ code: 'SAFETY_PRECHECK_INVALID' });

    expect((await fixture.getCase(created.id)).status).toBe('OPEN');
    expect(await fixture.countRiskEvents(created.id)).toBe(0);
  });

  it('authorized Staff + exact Case assignment + valid evidence resolves through existing ResolveRisk', async () => {
    const held = await enterHeldCase();
    const evidenceId = await createReviewEvidence(held.id);
    const assignmentId = await seedResolver(held.id);

    const result = await resolveHeld(
      staff,
      held.id,
      held.version,
      [{ kind: 'MESSAGE', ref: evidenceId }]
    );

    expect(result.status).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body).toMatchObject({
      caseId: held.id,
      status: 'WAITING',
      phase: held.phase,
      fromStatus: 'SAFETY_HOLD',
      fromVersion: held.version,
      version: held.version + 1,
    });
    const after = await fixture.getCase(held.id);
    expect(after.status).toBe('WAITING');
    expect(after.phase).toBe(held.phase);

    const { rows } = await admin.query(
      `SELECT resolution_authority_ref
         FROM risk_events
        WHERE case_id = $1 AND event_kind = 'RISK_RESOLVED'`,
      [held.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.resolution_authority_ref).toBe(
      `staff_assignment:${assignmentId}`
    );
  });

  it('replays a completed ResolveRisk operation across policy change without consulting the new provider', async () => {
    const held = await enterHeldCase();
    const evidenceId = await createReviewEvidence(held.id);
    await seedResolver(held.id);
    const key = operationKey('resolve-replay');
    const input = {
      actor: staff,
      caseId: held.id,
      operationKey: key,
      expectedCaseVersion: held.version,
      reviewEvidenceRefs: [{ kind: 'MESSAGE', ref: evidenceId }],
    } as const;

    const first = await runSafetyProductionResolve(
      fixture.pool,
      input,
      authority()
    );
    expect(first.status).toBe(200);
    const riskAfterFirst = await fixture.countRiskEvents(held.id);
    const eventsAfterFirst = await fixture.countCaseEvents(held.id);

    let changedProviderRead = false;
    const changedProvider: SafetyProductionAuthorityProvider = {
      async currentPolicyIdentity() {
        changedProviderRead = true;
        return { ...IDENTITY, policyVersion: '99' };
      },
      async evaluate() {
        throw new Error('Resolve replay must not evaluate');
      },
    };

    const replay = await runSafetyProductionResolve(
      fixture.pool,
      input,
      changedProvider
    );

    expect(replay).toEqual(first);
    expect(changedProviderRead).toBe(false);
    expect(await fixture.countRiskEvents(held.id)).toBe(riskAfterFirst);
    expect(await fixture.countCaseEvents(held.id)).toBe(eventsAfterFirst);
  });

  it('rejects ResolveRisk replay when the caller reuses the operation key with different evidence', async () => {
    const held = await enterHeldCase();
    const evidenceId = await createReviewEvidence(held.id);
    const secondEvidenceId = await createReviewEvidence(held.id);
    await seedResolver(held.id);
    const key = operationKey('resolve-replay-evidence');

    await runSafetyProductionResolve(
      fixture.pool,
      {
        actor: staff,
        caseId: held.id,
        operationKey: key,
        expectedCaseVersion: held.version,
        reviewEvidenceRefs: [{ kind: 'MESSAGE', ref: evidenceId }],
      },
      authority()
    );

    await expect(
      runSafetyProductionResolve(fixture.pool, {
        actor: staff,
        caseId: held.id,
        operationKey: key,
        expectedCaseVersion: held.version,
        reviewEvidenceRefs: [{ kind: 'MESSAGE', ref: secondEvidenceId }],
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' });

    expect(await fixture.countRiskEvents(held.id)).toBe(2);
  });

  it('does not replay a completed ResolveRisk after current Staff authority is revoked', async () => {
    const held = await enterHeldCase();
    const evidenceId = await createReviewEvidence(held.id);
    const assignmentId = await seedResolver(held.id);
    const key = operationKey('resolve-replay-revoked');
    const input = {
      actor: staff,
      caseId: held.id,
      operationKey: key,
      expectedCaseVersion: held.version,
      reviewEvidenceRefs: [{ kind: 'MESSAGE', ref: evidenceId }],
    } as const;

    const first = await runSafetyProductionResolve(
      fixture.pool,
      input,
      authority()
    );
    expect(first.status).toBe(200);

    await admin.query(
      `UPDATE staff_assignments
          SET revoked_by_account_id = $2,
              revoked_at = clock_timestamp()
        WHERE id = $1`,
      [assignmentId, owner.accountId]
    );

    await expect(
      runSafetyProductionResolve(fixture.pool, input)
    ).rejects.toMatchObject({ code: 'SAFETY_RESOLUTION_AUTHORITY_DENIED' });

    expect(await fixture.countRiskEvents(held.id)).toBe(2);
  });

  it('Family Manager without Staff Safety authority is denied', async () => {
    const held = await enterHeldCase();
    const evidenceId = await createReviewEvidence(held.id);

    await expect(
      resolveHeld(
        owner,
        held.id,
        held.version,
        [{ kind: 'MESSAGE', ref: evidenceId }]
      )
    ).rejects.toMatchObject({ code: 'SAFETY_RESOLUTION_AUTHORITY_DENIED' });
    expect((await fixture.getCase(held.id)).status).toBe('SAFETY_HOLD');
  });

  it('ordinary Account without Staff Safety authority is denied', async () => {
    const held = await enterHeldCase();
    const evidenceId = await createReviewEvidence(held.id);

    await expect(
      resolveHeld(
        ordinary,
        held.id,
        held.version,
        [{ kind: 'MESSAGE', ref: evidenceId }]
      )
    ).rejects.toMatchObject({ code: 'SAFETY_RESOLUTION_AUTHORITY_DENIED' });
    expect((await fixture.getCase(held.id)).status).toBe('SAFETY_HOLD');
  });

  it('wrong exact Case assignment is denied', async () => {
    const held = await enterHeldCase();
    const other = await newCase();
    const evidenceId = await createReviewEvidence(held.id);
    await seedResolver(held.id, { assignmentCaseId: other.id });

    await expect(
      resolveHeld(
        staff,
        held.id,
        held.version,
        [{ kind: 'MESSAGE', ref: evidenceId }]
      )
    ).rejects.toMatchObject({ code: 'SAFETY_RESOLUTION_AUTHORITY_DENIED' });
    expect((await fixture.getCase(held.id)).status).toBe('SAFETY_HOLD');
  });

  it('revoked or expired Case assignment is denied', async () => {
    for (const mode of ['revoked', 'expired'] as const) {
      const held = await enterHeldCase();
      const evidenceId = await createReviewEvidence(held.id);
      await seedResolver(held.id, {
        revoked: mode === 'revoked',
        expired: mode === 'expired',
      });

      await expect(
        resolveHeld(
          staff,
          held.id,
          held.version,
          [{ kind: 'MESSAGE', ref: evidenceId }]
        )
      ).rejects.toMatchObject({ code: 'SAFETY_RESOLUTION_AUTHORITY_DENIED' });
      expect((await fixture.getCase(held.id)).status).toBe('SAFETY_HOLD');
    }
  });

  it('disabled Staff account is denied', async () => {
    const held = await enterHeldCase();
    const evidenceId = await createReviewEvidence(held.id);
    await seedResolver(held.id);
    await admin.query("UPDATE accounts SET status = 'DISABLED' WHERE id = $1", [
      staff.accountId,
    ]);

    try {
      await expect(
        resolveHeld(
          staff,
          held.id,
          held.version,
          [{ kind: 'MESSAGE', ref: evidenceId }]
        )
      ).rejects.toMatchObject({ code: 'SAFETY_RESOLUTION_AUTHORITY_DENIED' });
      expect((await fixture.getCase(held.id)).status).toBe('SAFETY_HOLD');
    } finally {
      await admin.query("UPDATE accounts SET status = 'ACTIVE' WHERE id = $1", [
        staff.accountId,
      ]);
    }
  });

  it('missing review evidence is denied even with valid Staff assignment', async () => {
    const held = await enterHeldCase();
    await seedResolver(held.id);

    await expect(
      resolveHeld(staff, held.id, held.version, [])
    ).rejects.toMatchObject({ code: 'SAFETY_REVIEW_EVIDENCE_INVALID' });
    expect((await fixture.getCase(held.id)).status).toBe('SAFETY_HOLD');
  });

  it('rejects caller-supplied canResolve authority before ResolveRisk', async () => {
    const held = await enterHeldCase();
    const evidenceId = await createReviewEvidence(held.id);

    await expect(
      runSafetyProductionResolve(
        fixture.pool,
        {
          actor: ordinary,
          caseId: held.id,
          operationKey: operationKey('caller-can-resolve'),
          expectedCaseVersion: held.version,
          reviewEvidenceRefs: [{ kind: 'MESSAGE', ref: evidenceId }],
          canResolve: true,
        } as never,
        authority()
      )
    ).rejects.toMatchObject({ code: 'SAFETY_PRECHECK_INVALID' });

    expect((await fixture.getCase(held.id)).status).toBe('SAFETY_HOLD');
  });

  it('resolve fails closed when current trusted policy identity mismatches the hold trace', async () => {
    const held = await enterHeldCase();
    const evidenceId = await createReviewEvidence(held.id);
    await seedResolver(held.id);
    const staleIdentity: ApprovedPolicyIdentity = {
      ...IDENTITY,
      policyVersion: '2',
    };

    await expect(
      resolveHeld(
        staff,
        held.id,
        held.version,
        [{ kind: 'MESSAGE', ref: evidenceId }],
        authority({ identities: [staleIdentity] })
      )
    ).rejects.toMatchObject({ code: 'SAFETY_PRECHECK_STALE' });
    expect((await fixture.getCase(held.id)).status).toBe('SAFETY_HOLD');
  });

  it('registers no public or generic Safety mutation route', () => {
    const routes = fixture.app.printRoutes({ commonPrefix: false });
    expect(routes).not.toMatch(/\/safety(?:\/|\s|$)/i);
    expect(routes).not.toContain('/resolve-risk');
    expect(routes).not.toContain('/enter-hold');
    expect(routes).not.toMatch(/\/admin\/safety/i);
  });
});
