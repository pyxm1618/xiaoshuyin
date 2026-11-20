/**
 * Phase 5 / C2 — production Safety entry / resolve wiring evidence.
 *
 * These tests exercise the new internal production service, not the Slice 9
 * commands directly. The approved policy runtime used here is a deterministic
 * test fixture only; createProductionSafetyService() remains unavailable until
 * D6 provides a reviewed production rule asset.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import {
  createProductionSafetyService,
  createSafetyProductionService,
  type ApprovedSafetyPolicyRuntime,
} from '../../apps/server/api/src/safety/production-entry.js';
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

const PREFIX = 'phase5_c2_';

const POLICY: ApprovedPolicyIdentity = {
  policyRef: 'policy.phase5-c2.fixture',
  policyVersion: '1',
  ruleRef: 'rule.phase5-c2.fixture',
  ruleVersion: '1',
};

let seq = 0;
const nextKey = (label: string) =>
  `phase5-c2-${label}-${Date.now()}-${seq++}`;

function holdEvaluation(
  identity: ApprovedPolicyIdentity = POLICY
): ApprovedRuleEvaluation {
  return {
    outcome: 'HOLD_REQUIRED',
    ...identity,
    riskCategoryRef: 'CATEGORY_PHASE5_C2_FIXTURE',
    evidenceRefs: [],
  };
}

function noHoldEvaluation(
  identity: ApprovedPolicyIdentity = POLICY
): ApprovedRuleEvaluation {
  return {
    outcome: 'NO_HOLD',
    ...identity,
    evidenceRefs: [],
  };
}

function approvedRuntime(options: {
  currentIdentity?: (
    input: { caseId: string }
  ) => Promise<
    | { status: 'AVAILABLE'; identity: ApprovedPolicyIdentity }
    | { status: 'UNAVAILABLE' }
  >;
  evaluate?: (input: {
    case: SafetyCaseSnapshot;
    trustedPolicyIdentity: ApprovedPolicyIdentity;
  }) => Promise<
    | { status: 'AVAILABLE'; evaluation: ApprovedRuleEvaluation }
    | { status: 'UNAVAILABLE' }
  >;
} = {}): ApprovedSafetyPolicyRuntime {
  return {
    currentIdentity:
      options.currentIdentity ??
      (async () => ({ status: 'AVAILABLE' as const, identity: POLICY })),
    evaluate:
      options.evaluate ??
      (async () => ({
        status: 'AVAILABLE' as const,
        evaluation: holdEvaluation(),
      })),
  };
}

interface HeldCase {
  caseId: string;
  heldVersion: number;
  messageId: string;
}

interface SeedAuthorityOptions {
  assignedCaseId?: string | null;
  revoked?: boolean;
  expired?: boolean;
}

describe('Phase 5 / C2 Safety production entry / resolve', () => {
  let fixture: SafetyFixture;
  let admin: pg.Pool;
  let owner: ActorSession;
  let staff: ActorSession;
  let ordinary: ActorSession;

  beforeAll(async () => {
    const app = await buildApp();
    await app.ready();

    admin = createAdminPool();
    fixture = createSafetyFixture({
      app,
      admin,
      prefix: PREFIX,
      displayLabel: 'Phase5-C2',
    });

    owner = await fixture.login('owner');
    staff = await fixture.login('staff');
    ordinary = await fixture.login('ordinary');
    await fixture.createFamily(owner, 'main');
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
    await fixture.app.close();
  });

  async function createHeldCase(): Promise<HeldCase> {
    const created = await fixture.createCase(owner);
    const service = createSafetyProductionService(
      fixture.pool,
      approvedRuntime()
    );

    const entered = await service.enter({
      actor: {
        accountId: owner.accountId,
        personId: owner.personId,
      },
      caseId: created.id,
      idempotencyKey: nextKey('enter-held'),
    });
    expect(entered.kind).toBe('ENTER_HOLD');

    const held = await fixture.getCase(created.id);
    const message = await fixture.app.inject({
      method: 'POST',
      url: `/api/v1/cases/${created.id}/messages`,
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': nextKey('review-evidence'),
      },
      payload: { content: 'Phase 5 C2 review evidence fixture' },
    });
    expect(message.statusCode).toBe(201);

    return {
      caseId: created.id,
      heldVersion: held.version,
      messageId: message.json().id as string,
    };
  }

  async function seedAuthority(
    actor: ActorSession,
    targetCaseId: string,
    options: SeedAuthorityOptions = {}
  ): Promise<{ grantId: string; assignmentId: string | null }> {
    const now = Date.now();
    const validFrom = new Date(now - 60 * 60 * 1000);
    const validUntil = options.expired
      ? new Date(now - 30 * 60 * 1000)
      : new Date(now + 60 * 60 * 1000);

    const grant = await admin.query<{ id: string }>(
      `INSERT INTO staff_assignments
         (account_id, person_id, capability, scope_type,
          granted_by_account_id, valid_from, valid_until)
       VALUES ($1, $2, 'SAFETY_RESOLVE', 'GLOBAL', $3, $4, $5)
       RETURNING id`,
      [
        actor.accountId,
        actor.personId,
        owner.accountId,
        validFrom,
        validUntil,
      ]
    );
    const grantId = grant.rows[0]!.id;

    const assignedCaseId =
      options.assignedCaseId === undefined
        ? targetCaseId
        : options.assignedCaseId;
    if (assignedCaseId === null) {
      return { grantId, assignmentId: null };
    }

    const assignmentFamily = (await fixture.getCase(assignedCaseId)).familyId;
    const assignment = await admin.query<{ id: string }>(
      `INSERT INTO staff_assignments
         (account_id, person_id, capability, scope_type,
          family_id, case_id, capability_grant_id,
          granted_by_account_id, granted_at, valid_from, valid_until,
          revoked_by_account_id, revoked_at)
       VALUES ($1, $2, 'SAFETY_RESOLVE', 'CASE',
               $3, $4, $5,
               $6, $7, $8, $9,
               $10, $11)
       RETURNING id`,
      [
        actor.accountId,
        actor.personId,
        assignmentFamily,
        assignedCaseId,
        grantId,
        owner.accountId,
        validFrom,
        validFrom,
        validUntil,
        options.revoked ? owner.accountId : null,
        options.revoked ? new Date(now - 5 * 60 * 1000) : null,
      ]
    );

    return {
      grantId,
      assignmentId: assignment.rows[0]!.id,
    };
  }

  function resolveInput(actor: ActorSession, held: HeldCase) {
    return {
      actor: {
        accountId: actor.accountId,
        personId: actor.personId,
      },
      caseId: held.caseId,
      idempotencyKey: nextKey('resolve'),
      expectedCaseVersion: held.heldVersion,
      reviewEvidenceRefs: [{ kind: 'MESSAGE', ref: held.messageId }],
    };
  }

  it('approved HOLD_REQUIRED enters through precheck -> EnterSafetyHold', async () => {
    const created = await fixture.createCase(owner);
    const before = await fixture.getCase(created.id);
    const service = createSafetyProductionService(
      fixture.pool,
      approvedRuntime()
    );

    const result = await service.enter({
      actor: {
        accountId: owner.accountId,
        personId: owner.personId,
      },
      caseId: created.id,
      idempotencyKey: nextKey('approved-hold'),
    });

    expect(result.kind).toBe('ENTER_HOLD');
    const after = await fixture.getCase(created.id);
    expect(after.status).toBe('SAFETY_HOLD');
    expect(after.version).toBe(before.version + 1);
    expect(await fixture.countRiskEvents(created.id)).toBe(1);
  });

  it('NO_HOLD returns ALLOW with zero Safety mutation', async () => {
    const created = await fixture.createCase(owner);
    const before = await fixture.getCase(created.id);
    const service = createSafetyProductionService(
      fixture.pool,
      approvedRuntime({
        evaluate: async () => ({
          status: 'AVAILABLE',
          evaluation: noHoldEvaluation(),
        }),
      })
    );

    const result = await service.enter({
      actor: {
        accountId: owner.accountId,
        personId: owner.personId,
      },
      caseId: created.id,
      idempotencyKey: nextKey('allow'),
    });

    expect(result).toEqual({
      kind: 'ALLOW',
      caseId: created.id,
      caseVersion: before.version,
    });
    expect(await fixture.getCase(created.id)).toMatchObject({
      status: 'OPEN',
      version: before.version,
    });
    expect(await fixture.countRiskEvents(created.id)).toBe(0);
  });

  it('already held returns ALREADY_HELD without a duplicate mutation', async () => {
    const held = await createHeldCase();
    const beforeRisk = await fixture.countRiskEvents(held.caseId);
    const service = createSafetyProductionService(
      fixture.pool,
      approvedRuntime({
        evaluate: async () => ({ status: 'UNAVAILABLE' }),
      })
    );

    const result = await service.enter({
      actor: {
        accountId: owner.accountId,
        personId: owner.personId,
      },
      caseId: held.caseId,
      idempotencyKey: nextKey('already-held'),
    });

    expect(result).toEqual({
      kind: 'ALREADY_HELD',
      caseId: held.caseId,
      caseVersion: held.heldVersion,
    });
    expect(await fixture.countRiskEvents(held.caseId)).toBe(beforeRisk);
    expect((await fixture.getCase(held.caseId)).version).toBe(
      held.heldVersion
    );
  });

  it('stale Case revision fails closed at the locked EnterSafetyHold command', async () => {
    const created = await fixture.createCase(owner);
    let advanced = false;
    const service = createSafetyProductionService(
      fixture.pool,
      approvedRuntime({
        evaluate: async () => {
          if (!advanced) {
            advanced = true;
            await admin.query(
              'UPDATE cases SET version = version + 1 WHERE id = $1',
              [created.id]
            );
          }
          return {
            status: 'AVAILABLE',
            evaluation: holdEvaluation(),
          };
        },
      })
    );

    await expect(
      service.enter({
        actor: {
          accountId: owner.accountId,
          personId: owner.personId,
        },
        caseId: created.id,
        idempotencyKey: nextKey('stale-case'),
      })
    ).rejects.toMatchObject({ code: 'SAFETY_PRECHECK_STALE' });

    expect((await fixture.getCase(created.id)).status).toBe('OPEN');
    expect(await fixture.countRiskEvents(created.id)).toBe(0);
  });

  it('stale policy/rule identity fails closed even for NO_HOLD', async () => {
    const created = await fixture.createCase(owner);
    const stale = { ...POLICY, ruleVersion: '0' };
    const service = createSafetyProductionService(
      fixture.pool,
      approvedRuntime({
        evaluate: async () => ({
          status: 'AVAILABLE',
          evaluation: noHoldEvaluation(stale),
        }),
      })
    );

    await expect(
      service.enter({
        actor: {
          accountId: owner.accountId,
          personId: owner.personId,
        },
        caseId: created.id,
        idempotencyKey: nextKey('stale-policy'),
      })
    ).rejects.toMatchObject({ code: 'SAFETY_PRECHECK_STALE' });

    expect((await fixture.getCase(created.id)).status).toBe('OPEN');
    expect(await fixture.countRiskEvents(created.id)).toBe(0);
  });

  it('missing approved evaluation fails closed', async () => {
    const created = await fixture.createCase(owner);
    const service = createSafetyProductionService(
      fixture.pool,
      approvedRuntime({
        evaluate: async () => ({ status: 'UNAVAILABLE' }),
      })
    );

    await expect(
      service.enter({
        actor: {
          accountId: owner.accountId,
          personId: owner.personId,
        },
        caseId: created.id,
        idempotencyKey: nextKey('missing-evaluation'),
      })
    ).rejects.toMatchObject({
      code: 'SAFETY_PRODUCTION_RULE_ASSET_UNAVAILABLE',
    });

    expect((await fixture.getCase(created.id)).status).toBe('OPEN');
  });

  it('rejects caller-forged authority fields and malformed approved evaluation', async () => {
    const created = await fixture.createCase(owner);
    const validService = createSafetyProductionService(
      fixture.pool,
      approvedRuntime()
    );

    await expect(
      validService.enter({
        actor: {
          accountId: owner.accountId,
          personId: owner.personId,
        },
        caseId: created.id,
        idempotencyKey: nextKey('forged-boolean'),
        isHighRisk: true,
      } as never)
    ).rejects.toMatchObject({ code: 'SAFETY_PRODUCTION_INPUT_INVALID' });

    const malformedService = createSafetyProductionService(
      fixture.pool,
      approvedRuntime({
        evaluate: async () => ({
          status: 'AVAILABLE',
          evaluation: {
            ...holdEvaluation(),
            isHighRisk: true,
          } as never,
        }),
      })
    );

    await expect(
      malformedService.enter({
        actor: {
          accountId: owner.accountId,
          personId: owner.personId,
        },
        caseId: created.id,
        idempotencyKey: nextKey('malformed-evaluation'),
      })
    ).rejects.toMatchObject({ code: 'SAFETY_PRECHECK_INVALID' });

    expect((await fixture.getCase(created.id)).status).toBe('OPEN');
    expect(await fixture.countRiskEvents(created.id)).toBe(0);
  });

  it('default production composition invents no rule identity and is unavailable before D6', async () => {
    const created = await fixture.createCase(owner);
    const service = createProductionSafetyService(fixture.pool);

    await expect(
      service.enter({
        actor: {
          accountId: owner.accountId,
          personId: owner.personId,
        },
        caseId: created.id,
        idempotencyKey: nextKey('no-d6-asset'),
      })
    ).rejects.toMatchObject({
      code: 'SAFETY_PRODUCTION_RULE_ASSET_UNAVAILABLE',
    });

    expect((await fixture.getCase(created.id)).status).toBe('OPEN');
    expect(await fixture.countRiskEvents(created.id)).toBe(0);
  });

  it('authorized Staff resolves through the existing production authority source', async () => {
    const held = await createHeldCase();
    const authority = await seedAuthority(staff, held.caseId);
    const service = createSafetyProductionService(
      fixture.pool,
      approvedRuntime()
    );

    const result = await service.resolve(resolveInput(staff, held));
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      caseId: held.caseId,
      status: 'WAITING',
      fromStatus: 'SAFETY_HOLD',
      fromVersion: held.heldVersion,
      version: held.heldVersion + 1,
    });

    const after = await fixture.getCase(held.caseId);
    expect(after.status).toBe('WAITING');

    const trace = await admin.query<{
      resolution_authority_ref: string;
    }>(
      `SELECT resolution_authority_ref
         FROM risk_events
        WHERE case_id = $1
          AND event_kind = 'RISK_RESOLVED'`,
      [held.caseId]
    );
    expect(trace.rows[0]?.resolution_authority_ref).toBe(
      `staff_assignment:${authority.assignmentId}`
    );
  });

  it('Family Manager only and ordinary Account are denied Resolve', async () => {
    for (const actor of [owner, ordinary]) {
      const held = await createHeldCase();
      const service = createSafetyProductionService(
        fixture.pool,
        approvedRuntime()
      );

      await expect(
        service.resolve(resolveInput(actor, held))
      ).rejects.toMatchObject({
        code: 'SAFETY_RESOLUTION_AUTHORITY_DENIED',
      });
      expect((await fixture.getCase(held.caseId)).status).toBe(
        'SAFETY_HOLD'
      );
    }
  });

  it('wrong exact Case assignment is denied', async () => {
    const held = await createHeldCase();
    const other = await fixture.createCase(owner);
    await seedAuthority(staff, held.caseId, {
      assignedCaseId: other.id,
    });

    const service = createSafetyProductionService(
      fixture.pool,
      approvedRuntime()
    );
    await expect(
      service.resolve(resolveInput(staff, held))
    ).rejects.toMatchObject({
      code: 'SAFETY_RESOLUTION_AUTHORITY_DENIED',
    });
    expect((await fixture.getCase(held.caseId)).status).toBe('SAFETY_HOLD');
  });

  it('revoked and expired assignments are denied', async () => {
    for (const state of [{ revoked: true }, { expired: true }]) {
      const held = await createHeldCase();
      await seedAuthority(staff, held.caseId, state);
      const service = createSafetyProductionService(
        fixture.pool,
        approvedRuntime()
      );

      await expect(
        service.resolve(resolveInput(staff, held))
      ).rejects.toMatchObject({
        code: 'SAFETY_RESOLUTION_AUTHORITY_DENIED',
      });
      expect((await fixture.getCase(held.caseId)).status).toBe(
        'SAFETY_HOLD'
      );
    }
  });

  it('disabled Staff account is denied', async () => {
    const held = await createHeldCase();
    await seedAuthority(staff, held.caseId);
    await admin.query(
      `UPDATE accounts SET status = 'DISABLED' WHERE id = $1`,
      [staff.accountId]
    );

    try {
      const service = createSafetyProductionService(
        fixture.pool,
        approvedRuntime()
      );
      await expect(
        service.resolve(resolveInput(staff, held))
      ).rejects.toMatchObject({
        code: 'SAFETY_RESOLUTION_AUTHORITY_DENIED',
      });
      expect((await fixture.getCase(held.caseId)).status).toBe(
        'SAFETY_HOLD'
      );
    } finally {
      await admin.query(
        `UPDATE accounts SET status = 'ACTIVE' WHERE id = $1`,
        [staff.accountId]
      );
    }
  });

  it('missing review evidence is denied before any resolve mutation', async () => {
    const held = await createHeldCase();
    await seedAuthority(staff, held.caseId);
    const service = createSafetyProductionService(
      fixture.pool,
      approvedRuntime()
    );

    const input = resolveInput(staff, held);
    await expect(
      service.resolve({
        ...input,
        reviewEvidenceRefs: [],
      })
    ).rejects.toMatchObject({
      code: 'SAFETY_REVIEW_EVIDENCE_INVALID',
    });
    expect((await fixture.getCase(held.caseId)).status).toBe('SAFETY_HOLD');
  });

  it('Resolve fails closed when current trusted policy identity mismatches the hold trace', async () => {
    const held = await createHeldCase();
    await seedAuthority(staff, held.caseId);
    const service = createSafetyProductionService(
      fixture.pool,
      approvedRuntime({
        currentIdentity: async () => ({
          status: 'AVAILABLE',
          identity: { ...POLICY, policyVersion: '2' },
        }),
      })
    );

    await expect(
      service.resolve(resolveInput(staff, held))
    ).rejects.toMatchObject({
      code: 'SAFETY_PRECHECK_STALE',
    });
    expect((await fixture.getCase(held.caseId)).status).toBe('SAFETY_HOLD');
  });

  it('caller can never promote itself with canResolve=true', async () => {
    const held = await createHeldCase();
    const service = createSafetyProductionService(
      fixture.pool,
      approvedRuntime()
    );
    const input = resolveInput(ordinary, held);

    await expect(
      service.resolve({
        ...input,
        canResolve: true,
      } as never)
    ).rejects.toMatchObject({
      code: 'SAFETY_PRODUCTION_INPUT_INVALID',
    });
    expect((await fixture.getCase(held.caseId)).status).toBe('SAFETY_HOLD');
  });

  it('registers no public or generic Safety mutation route', () => {
    const routes = fixture.app.printRoutes({ commonPrefix: false });
    expect(routes).not.toMatch(/safety|enter-hold|resolve-risk/i);
  });
});
