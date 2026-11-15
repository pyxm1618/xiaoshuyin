/**
 * T910 — ResolveRisk: the unique legal exit, using the production AUTH-007
 * Staff resolver authority source.
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

const PREFIX = 't910_';

const IDENTITY: ApprovedPolicyIdentity = {
  policyRef: 'policy.t910',
  policyVersion: '1',
  ruleRef: 'rule.t910',
  ruleVersion: '1',
};

let keySeq = 0;
const nextKey = (label: string) => `t910-${label}-${Date.now()}-${keySeq++}`;

describe('T910 ResolveRisk', () => {
  let fixture: SafetyFixture;
  let admin: pg.Pool;
  let owner: ActorSession;
  let staff: ActorSession;
  let familyId: string;

  beforeAll(async () => {
    const app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    fixture = createSafetyFixture({ app, admin, prefix: PREFIX });
    owner = await fixture.login('owner');
    staff = await fixture.login('staff');
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

  async function createHeldCase(): Promise<{
    caseId: string;
    heldVersion: number;
    phase: string;
    messageId: string;
  }> {
    const created = await fixture.createCase(owner);
    const before = await fixture.getCase(created.id);
    const decision = runSafetyPrecheck({
      case: { caseId: created.id, status: before.status as never, version: before.version },
      trustedPolicyIdentity: IDENTITY,
      approvedEvaluation: {
        outcome: 'HOLD_REQUIRED',
        ...IDENTITY,
        riskCategoryRef: 'CATEGORY_T910',
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
      trustedPolicyIdentity: IDENTITY,
    });

    const held = await fixture.getCase(created.id);
    const message = await fixture.app.inject({
      method: 'POST',
      url: `/api/v1/cases/${created.id}/messages`,
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': nextKey('msg'),
      },
      payload: { content: 'review evidence fixture' },
    });
    expect(message.statusCode).toBe(201);

    return {
      caseId: created.id,
      heldVersion: held.version,
      phase: held.phase,
      messageId: message.json().id as string,
    };
  }

  async function seedResolver(caseId: string): Promise<string> {
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
          granted_by_account_id, valid_from, valid_until)
       VALUES ($1, $2, 'SAFETY_RESOLVE', 'CASE',
               $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        staff.accountId,
        staff.personId,
        familyId,
        caseId,
        grant.rows[0]!.id,
        owner.accountId,
        new Date(now - 60_000),
        new Date(now + 60 * 60_000),
      ]
    );
    return assignment.rows[0]!.id;
  }

  function resolve(
    caseId: string,
    expectedCaseVersion: number,
    reviewEvidenceRefs: Array<{ kind: string; ref: string }>,
    key = nextKey('resolve')
  ) {
    return resolveRisk(fixture.pool, {
      accountId: staff.accountId,
      personId: staff.personId,
      caseId,
      idempotencyKey: key,
      expectedCaseVersion,
      reviewEvidenceRefs,
      trustedPolicyIdentity: IDENTITY,
    });
  }

  it('fails closed with no Staff capability/Case assignment facts', async () => {
    const held = await createHeldCase();
    const riskBefore = await fixture.countRiskEvents(held.caseId);
    const eventsBefore = await fixture.countCaseEvents(held.caseId);

    await expect(
      resolve(held.caseId, held.heldVersion, [{ kind: 'MESSAGE', ref: held.messageId }])
    ).rejects.toMatchObject({ code: 'SAFETY_RESOLUTION_AUTHORITY_DENIED' });

    const after = await fixture.getCase(held.caseId);
    expect(after.status).toBe('SAFETY_HOLD');
    expect(after.version).toBe(held.heldVersion);
    expect(await fixture.countRiskEvents(held.caseId)).toBe(riskBefore);
    expect(await fixture.countCaseEvents(held.caseId)).toBe(eventsBefore);
  });

  it('resolves SAFETY_HOLD -> WAITING with production Staff authority and valid evidence', async () => {
    const held = await createHeldCase();
    const assignmentId = await seedResolver(held.caseId);
    const riskBefore = await fixture.countRiskEvents(held.caseId);

    const result = await resolve(
      held.caseId,
      held.heldVersion,
      [{ kind: 'MESSAGE', ref: held.messageId }]
    );

    expect(result.status).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body).toMatchObject({
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

    const { rows: resolution } = await admin.query(
      `SELECT * FROM risk_events
        WHERE case_id = $1 AND event_kind = 'RISK_RESOLVED'`,
      [held.caseId]
    );
    expect(resolution).toHaveLength(1);
    expect(resolution[0]).toMatchObject({
      actor_account_id: staff.accountId,
      resolution_authority_ref: `staff_assignment:${assignmentId}`,
      decision_case_version: held.heldVersion,
      policy_ref: null,
    });
    expect(resolution[0].resolution_of_risk_event_id).toBeTruthy();
    expect(resolution[0].evidence_refs).toEqual([
      { kind: 'MESSAGE', ref: held.messageId },
    ]);
    expect(await fixture.countRiskEvents(held.caseId)).toBe(riskBefore + 1);

    const { rows: policy } = await admin.query(
      `SELECT policy_ref, policy_version, rule_ref, rule_version
         FROM risk_events
        WHERE id = $1`,
      [resolution[0].resolution_of_risk_event_id]
    );
    expect(policy[0]).toMatchObject({
      policy_ref: IDENTITY.policyRef,
      policy_version: IDENTITY.policyVersion,
      rule_ref: IDENTITY.ruleRef,
      rule_version: IDENTITY.ruleVersion,
    });

    const { rows: events } = await admin.query(
      `SELECT metadata FROM case_events
        WHERE case_id = $1 AND event_type = 'CASE_RISK_RESOLVED'`,
      [held.caseId]
    );
    expect(events).toHaveLength(1);
    expect(events[0].metadata).toEqual({
      fromStatus: 'SAFETY_HOLD',
      toStatus: 'WAITING',
      fromVersion: held.heldVersion,
      toVersion: held.heldVersion + 1,
      riskEventId: body.riskEventId,
    });

    const { rows: audit } = await admin.query(
      `SELECT actor_account_id, metadata
         FROM business_audit_events
        WHERE resource_id = $1 AND event_type = 'CASE_RISK_RESOLVED'`,
      [held.caseId]
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].actor_account_id).toBe(staff.accountId);
    expect(audit[0].metadata).toEqual({
      riskEventId: body.riskEventId,
      fromVersion: held.heldVersion,
      toVersion: held.heldVersion + 1,
      resolutionAuthorityRef: `staff_assignment:${assignmentId}`,
    });

    // No auto-resume: ResolveRisk touches no old Plan/Task/Reminder surface.
    const { rows: caseEventTypes } = await admin.query(
      'SELECT event_type FROM case_events WHERE case_id = $1 ORDER BY occurred_at',
      [held.caseId]
    );
    expect(caseEventTypes.map((row: { event_type: string }) => row.event_type)).toEqual([
      'CASE_CREATED',
      'CASE_SAFETY_HOLD_ENTERED',
      'CASE_RISK_RESOLVED',
    ]);
  });

  it('rejects missing, malformed, missing-row and cross-Case review evidence', async () => {
    const held = await createHeldCase();
    await seedResolver(held.caseId);

    const invalidSets: Array<Array<{ kind: string; ref: string }>> = [
      [],
      [{ kind: 'MESSAGE', ref: 'not-a-uuid' }],
      [{ kind: 'UNKNOWN_CARRIER', ref: held.messageId }],
      [{ kind: 'MESSAGE', ref: '00000000-0000-0000-0000-000000000000' }],
    ];

    for (const refs of invalidSets) {
      await expect(resolve(held.caseId, held.heldVersion, refs)).rejects.toMatchObject({
        code: 'SAFETY_REVIEW_EVIDENCE_INVALID',
      });
    }

    const other = await fixture.createCase(owner);
    const otherMessage = await fixture.app.inject({
      method: 'POST',
      url: `/api/v1/cases/${other.id}/messages`,
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': nextKey('othermsg'),
      },
      payload: { content: 'other case message' },
    });
    expect(otherMessage.statusCode).toBe(201);

    await expect(
      resolve(held.caseId, held.heldVersion, [
        { kind: 'MESSAGE', ref: otherMessage.json().id },
      ])
    ).rejects.toMatchObject({ code: 'SAFETY_REVIEW_EVIDENCE_INVALID' });

    expect((await fixture.getCase(held.caseId)).status).toBe('SAFETY_HOLD');
  });

  it('rejects a resolver request whose trusted current Safety Policy identity no longer matches the hold', async () => {
    const held = await createHeldCase();
    await seedResolver(held.caseId);

    await expect(
      resolveRisk(fixture.pool, {
        accountId: staff.accountId,
        personId: staff.personId,
        caseId: held.caseId,
        idempotencyKey: nextKey('stale-policy'),
        expectedCaseVersion: held.heldVersion,
        reviewEvidenceRefs: [{ kind: 'MESSAGE', ref: held.messageId }],
        trustedPolicyIdentity: { ...IDENTITY, ruleVersion: '2' },
      })
    ).rejects.toMatchObject({ code: 'SAFETY_PRECHECK_STALE' });

    expect((await fixture.getCase(held.caseId)).status).toBe('SAFETY_HOLD');
  });

  it('rejects a stale revision and a non-held Case', async () => {
    const held = await createHeldCase();
    await seedResolver(held.caseId);
    await expect(
      resolve(
        held.caseId,
        held.heldVersion - 1,
        [{ kind: 'MESSAGE', ref: held.messageId }]
      )
    ).rejects.toMatchObject({ code: 'STALE_CASE_VERSION' });

    const open = await fixture.createCase(owner);
    const openRow = await fixture.getCase(open.id);
    const openMessage = await fixture.app.inject({
      method: 'POST',
      url: `/api/v1/cases/${open.id}/messages`,
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': nextKey('openmsg'),
      },
      payload: { content: 'open case message' },
    });
    await seedResolver(open.id);

    await expect(
      resolve(open.id, openRow.version, [
        { kind: 'MESSAGE', ref: openMessage.json().id },
      ])
    ).rejects.toMatchObject({ code: 'SAFETY_HOLD_REQUIRED' });
    expect((await fixture.getCase(open.id)).status).toBe('OPEN');
  });

  it('replays the same key and rejects a changed payload', async () => {
    const held = await createHeldCase();
    await seedResolver(held.caseId);
    const key = nextKey('replay');
    const refs = [{ kind: 'MESSAGE', ref: held.messageId }];

    const first = await resolve(held.caseId, held.heldVersion, refs, key);
    const riskAfter = await fixture.countRiskEvents(held.caseId);
    const eventsAfter = await fixture.countCaseEvents(held.caseId);
    const auditAfter = await fixture.countAuditEvents(held.caseId);

    const second = await resolve(held.caseId, held.heldVersion, refs, key);
    expect(second).toEqual(first);
    expect(await fixture.countRiskEvents(held.caseId)).toBe(riskAfter);
    expect(await fixture.countCaseEvents(held.caseId)).toBe(eventsAfter);
    expect(await fixture.countAuditEvents(held.caseId)).toBe(auditAfter);
    expect((await fixture.getCase(held.caseId)).version).toBe(held.heldVersion + 1);

    const other = await createHeldCase();
    await seedResolver(other.caseId);
    await expect(
      resolve(
        other.caseId,
        other.heldVersion,
        [{ kind: 'MESSAGE', ref: other.messageId }],
        key
      )
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' });
  });

  it('registers no public route for the resolution command', async () => {
    const routes = fixture.app.printRoutes({ commonPrefix: false });
    expect(routes).not.toContain('/resolve-risk');
    expect(routes).not.toContain('/safety');
  });
});
