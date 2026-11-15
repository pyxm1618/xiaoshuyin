/**
 * AUTH-007 + AUTH-008 — permanent regression-first proof for the production
 * Safety resolver authority source.
 *
 * These tests deliberately exercise the real production ResolveRisk composition:
 * no test-only resolver source is injected.  A resolver is eligible only when
 * the same authenticated Account/Person has both a current SAFETY_RESOLVE
 * capability grant and a current assignment for the exact Case.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { enterSafetyHold } from '../../apps/server/api/src/safety/enter-safety-hold.js';
import { resolveRisk } from '../../apps/server/api/src/safety/resolve-risk.js';
import {
  runSafetyPrecheck,
  type ApprovedPolicyIdentity,
} from '../../packages/domain/src/safety/index.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type ActorSession, type SafetyFixture } from '../setup/safety.js';

const PREFIX = 'auth007_staff_';

const POLICY: ApprovedPolicyIdentity = {
  policyRef: 'policy.auth007.fixture',
  policyVersion: '7',
  ruleRef: 'rule.auth007.fixture',
  ruleVersion: '3',
};

let seq = 0;
const nextKey = (label: string) => `auth007-${label}-${Date.now()}-${seq++}`;

interface HeldCase {
  caseId: string;
  heldVersion: number;
  phase: string;
  messageId: string;
}

interface SeedAuthorityOptions {
  capability?: string;
  assignedCaseId?: string | null;
  revoked?: boolean;
  expired?: boolean;
  inactive?: boolean;
}

describe('AUTH-007/AUTH-008 production Safety resolver staff authority', () => {
  let fixture: SafetyFixture;
  let admin: pg.Pool;
  let owner: ActorSession;
  let staff: ActorSession;
  let ordinary: ActorSession;
  let familyId: string;

  beforeAll(async () => {
    const app = await buildApp();
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
    await fixture.app.close();
  });

  async function createHeldCase(): Promise<HeldCase> {
    const created = await fixture.createCase(owner);
    const before = await fixture.getCase(created.id);
    const decision = runSafetyPrecheck({
      case: {
        caseId: created.id,
        status: before.status as never,
        version: before.version,
      },
      trustedPolicyIdentity: POLICY,
      approvedEvaluation: {
        outcome: 'HOLD_REQUIRED',
        ...POLICY,
        riskCategoryRef: 'CATEGORY_AUTH007_FIXTURE',
        evidenceRefs: [],
      },
    });

    await enterSafetyHold(fixture.pool, {
      accountId: owner.accountId,
      personId: owner.personId,
      caseId: created.id,
      idempotencyKey: nextKey('enter'),
      expectedCaseVersion: before.version,
      decision,
      trustedPolicyIdentity: POLICY,
    });

    const held = await fixture.getCase(created.id);
    const message = await fixture.app.inject({
      method: 'POST',
      url: `/api/v1/cases/${created.id}/messages`,
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': nextKey('message'),
      },
      payload: { content: 'AUTH-007 review evidence fixture' },
    });
    expect(message.statusCode).toBe(201);

    return {
      caseId: created.id,
      heldVersion: held.version,
      phase: held.phase,
      messageId: message.json().id as string,
    };
  }

  async function seedAuthority(
    actor: ActorSession,
    targetCaseId: string,
    options: SeedAuthorityOptions = {}
  ): Promise<{ grantId: string; assignmentId: string | null }> {
    const capability = options.capability ?? 'SAFETY_RESOLVE';
    const now = Date.now();
    const validFrom = options.inactive
      ? new Date(now + 60 * 60 * 1000)
      : new Date(now - 60 * 60 * 1000);
    const validUntil = options.inactive
      ? new Date(now + 2 * 60 * 60 * 1000)
      : options.expired
        ? new Date(now - 30 * 60 * 1000)
        : new Date(now + 60 * 60 * 1000);

    const grant = await admin.query<{ id: string }>(
      `INSERT INTO staff_assignments
         (account_id, person_id, capability, scope_type,
          granted_by_account_id, valid_from, valid_until)
       VALUES ($1, $2, $3, 'GLOBAL', $4, $5, $6)
       RETURNING id`,
      [actor.accountId, actor.personId, capability, owner.accountId, validFrom, validUntil]
    );
    const grantId = grant.rows[0]!.id;

    const assignedCaseId =
      options.assignedCaseId === undefined ? targetCaseId : options.assignedCaseId;
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
       VALUES ($1, $2, $3, 'CASE',
               $4, $5, $6,
               $7, $8, $9, $10,
               $11, $12)
       RETURNING id`,
      [
        actor.accountId,
        actor.personId,
        capability,
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

    return { grantId, assignmentId: assignment.rows[0]!.id };
  }

  function resolveAs(actor: ActorSession, held: HeldCase, key = nextKey('resolve')) {
    return resolveRisk(fixture.pool, {
      accountId: actor.accountId,
      personId: actor.personId,
      caseId: held.caseId,
      idempotencyKey: key,
      expectedCaseVersion: held.heldVersion,
      reviewEvidenceRefs: [{ kind: 'MESSAGE', ref: held.messageId }],
    });
  }

  async function expectDenied(actor: ActorSession, held: HeldCase) {
    await expect(resolveAs(actor, held)).rejects.toMatchObject({
      code: 'SAFETY_RESOLUTION_AUTHORITY_DENIED',
      statusCode: 403,
    });
    const after = await fixture.getCase(held.caseId);
    expect(after.status).toBe('SAFETY_HOLD');
    expect(after.version).toBe(held.heldVersion);
  }

  it('denies when SAFETY_RESOLVE is absent even if another Staff capability is assigned', async () => {
    const held = await createHeldCase();
    await seedAuthority(staff, held.caseId, { capability: 'SAFETY_REVIEW' });
    await expectDenied(staff, held);
  });

  it('denies SAFETY_RESOLVE with no Case assignment', async () => {
    const held = await createHeldCase();
    await seedAuthority(staff, held.caseId, { assignedCaseId: null });
    await expectDenied(staff, held);
  });

  it('denies an assignment for another Case', async () => {
    const held = await createHeldCase();
    const otherCase = await fixture.createCase(owner);
    await seedAuthority(staff, held.caseId, { assignedCaseId: otherCase.id });
    await expectDenied(staff, held);
  });

  it('denies revoked, expired and not-yet-active Case assignments', async () => {
    for (const state of [
      { revoked: true },
      { expired: true },
      { inactive: true },
    ]) {
      const held = await createHeldCase();
      await seedAuthority(staff, held.caseId, state);
      await expectDenied(staff, held);
    }
  });

  it('denies a Family Manager who has no Staff resolver authority', async () => {
    const held = await createHeldCase();
    await expectDenied(owner, held);
  });

  it('denies an ordinary authenticated Account with no Staff resolver authority', async () => {
    const held = await createHeldCase();
    await expectDenied(ordinary, held);
  });

  it('authorizes a non-household Staff actor only with SAFETY_RESOLVE + exact valid Case assignment', async () => {
    const held = await createHeldCase();
    const membership = await admin.query(
      'SELECT 1 FROM family_members WHERE family_id = $1 AND person_id = $2',
      [familyId, staff.personId]
    );
    expect(membership.rowCount).toBe(0);

    const authority = await seedAuthority(staff, held.caseId);
    expect(authority.assignmentId).not.toBeNull();

    const result = await resolveAs(staff, held);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      caseId: held.caseId,
      status: 'WAITING',
      phase: held.phase,
      fromStatus: 'SAFETY_HOLD',
      fromVersion: held.heldVersion,
      version: held.heldVersion + 1,
    });

    const after = await fixture.getCase(held.caseId);
    expect(after.status).toBe('WAITING');
    expect(after.phase).toBe(held.phase);
    expect(after.version).toBe(held.heldVersion + 1);

    const trace = await admin.query(
      `SELECT
         resolved.actor_account_id AS reviewer_account_id,
         resolved.evidence_refs AS review_evidence_refs,
         resolved.resolution_authority_ref,
         hold.policy_ref,
         hold.policy_version,
         hold.rule_ref,
         hold.rule_version
       FROM risk_events resolved
       JOIN risk_events hold
         ON hold.id = resolved.resolution_of_risk_event_id
      WHERE resolved.case_id = $1
        AND resolved.event_kind = 'RISK_RESOLVED'`,
      [held.caseId]
    );
    expect(trace.rows).toHaveLength(1);
    expect(trace.rows[0]).toMatchObject({
      reviewer_account_id: staff.accountId,
      resolution_authority_ref: `staff_assignment:${authority.assignmentId}`,
      policy_ref: POLICY.policyRef,
      policy_version: POLICY.policyVersion,
      rule_ref: POLICY.ruleRef,
      rule_version: POLICY.ruleVersion,
    });
    expect(trace.rows[0].review_evidence_refs).toEqual([
      { kind: 'MESSAGE', ref: held.messageId },
    ]);

    const audit = await admin.query(
      `SELECT actor_account_id, metadata
         FROM business_audit_events
        WHERE resource_id = $1
          AND event_type = 'CASE_RISK_RESOLVED'`,
      [held.caseId]
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].actor_account_id).toBe(staff.accountId);
    expect(audit.rows[0].metadata.resolutionAuthorityRef).toBe(
      `staff_assignment:${authority.assignmentId}`
    );

    // ResolveRisk remains a Safety transition only. No old work is resumed.
    const events = await admin.query<{ event_type: string }>(
      'SELECT event_type FROM case_events WHERE case_id = $1 ORDER BY occurred_at',
      [held.caseId]
    );
    expect(events.rows.map((row) => row.event_type)).toEqual([
      'CASE_CREATED',
      'CASE_SAFETY_HOLD_ENTERED',
      'CASE_RISK_RESOLVED',
    ]);
  });

  it('fails closed when a held Case has no approved/versioned Safety Policy trace', async () => {
    const created = await fixture.createCase(owner);
    await fixture.setCaseStatus(created.id, 'SAFETY_HOLD');
    const heldRow = await fixture.getCase(created.id);

    const message = await fixture.app.inject({
      method: 'POST',
      url: `/api/v1/cases/${created.id}/messages`,
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': nextKey('trace-less-message'),
      },
      payload: { content: 'review evidence without an approved hold trace' },
    });
    expect(message.statusCode).toBe(201);

    const held: HeldCase = {
      caseId: created.id,
      heldVersion: heldRow.version,
      phase: heldRow.phase,
      messageId: message.json().id as string,
    };
    await seedAuthority(staff, held.caseId);

    await expect(resolveAs(staff, held)).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });
    expect((await fixture.getCase(held.caseId)).status).toBe('SAFETY_HOLD');
  });
});
