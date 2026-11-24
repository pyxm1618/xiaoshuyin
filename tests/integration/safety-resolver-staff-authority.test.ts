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
      trustedPolicyIdentity: POLICY,
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

  async function installCaseTransitionBarrier(targetCaseId: string) {
    const suffix = seq++;
    const functionName = `auth007_case_update_barrier_${suffix}`;
    const triggerName = `auth007_case_update_barrier_trigger_${suffix}`;
    const advisoryKey1 = 7007;
    const advisoryKey2 = 100_000 + suffix;
    const locker = await admin.connect();

    await locker.query('SELECT pg_advisory_lock($1, $2)', [advisoryKey1, advisoryKey2]);
    await admin.query(`
      CREATE FUNCTION public.${functionName}() RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      BEGIN
        IF NEW.id = '${targetCaseId}'::uuid THEN
          PERFORM pg_advisory_xact_lock(${advisoryKey1}, ${advisoryKey2});
        END IF;
        RETURN NEW;
      END
      $function$
    `);
    await admin.query(`
      CREATE TRIGGER ${triggerName}
      BEFORE UPDATE OF status ON cases
      FOR EACH ROW EXECUTE FUNCTION public.${functionName}()
    `);

    let released = false;
    return {
      advisoryKey1,
      advisoryKey2,
      async release() {
        if (released) return;
        released = true;
        await locker.query('SELECT pg_advisory_unlock($1, $2)', [
          advisoryKey1,
          advisoryKey2,
        ]);
      },
      async cleanup() {
        await admin.query(`DROP TRIGGER IF EXISTS ${triggerName} ON cases`).catch(() => undefined);
        await admin
          .query(`DROP FUNCTION IF EXISTS public.${functionName}()`)
          .catch(() => undefined);
        locker.release();
      },
    };
  }

  async function waitForBarrier(advisoryKey1: number, advisoryKey2: number): Promise<void> {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const waiting = await admin.query<{ waiting: boolean }>(
        `SELECT EXISTS (
           SELECT 1
             FROM pg_locks
            WHERE locktype = 'advisory'
              AND classid::bigint = $1
              AND objid::bigint = $2
              AND objsubid = 2
              AND granted = false
         ) AS waiting`,
        [advisoryKey1, advisoryKey2]
      );
      if (waiting.rows[0]?.waiting) return;
      await admin.query('SELECT pg_sleep(0.01)');
    }
    throw new Error('ResolveRisk did not reach the transition barrier');
  }

  async function waitForBlockedBackend(
    backendPid: number,
    settled: () => boolean
  ): Promise<boolean> {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if (settled()) return false;
      const blocked = await admin.query<{ blocked: boolean }>(
        'SELECT cardinality(pg_blocking_pids($1)) > 0 AS blocked',
        [backendPid]
      );
      if (blocked.rows[0]?.blocked) return true;
      await admin.query('SELECT pg_sleep(0.01)');
    }
    return false;
  }

  async function expectResolveWinsAuthorityMutationRace(
    held: HeldCase,
    label: string,
    mutate: (client: pg.PoolClient) => Promise<unknown>
  ): Promise<void> {
    const barrier = await installCaseTransitionBarrier(held.caseId);
    const mutator = await admin.connect();
    let resolvePromise: ReturnType<typeof resolveAs> | null = null;
    let mutationPromise: Promise<unknown> | null = null;

    try {
      resolvePromise = resolveAs(staff, held, nextKey(label));
      await waitForBarrier(barrier.advisoryKey1, barrier.advisoryKey2);

      const pid = await mutator.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      let mutationSettled = false;
      mutationPromise = mutate(mutator).finally(() => {
        mutationSettled = true;
      });

      expect(
        await waitForBlockedBackend(pid.rows[0]!.pid, () => mutationSettled)
      ).toBe(true);

      await barrier.release();

      const resolved = await resolvePromise;
      expect(resolved.status).toBe(200);
      await mutationPromise;

      const after = await fixture.getCase(held.caseId);
      expect(after.status).toBe('WAITING');
      expect(after.version).toBe(held.heldVersion + 1);
    } finally {
      await barrier.release().catch(() => undefined);
      await resolvePromise?.catch(() => undefined);
      await mutationPromise?.catch(() => undefined);
      mutator.release();
      await barrier.cleanup();
    }
  }

  async function waitUntilExpired(validUntil: Date): Promise<void> {
    for (let attempt = 0; attempt < 600; attempt += 1) {
      const now = await admin.query<{ expired: boolean }>(
        'SELECT clock_timestamp() >= $1::timestamptz AS expired',
        [validUntil]
      );
      if (now.rows[0]?.expired) return;
      await admin.query('SELECT pg_sleep(0.01)');
    }
    throw new Error('Authority did not reach deterministic expiry boundary');
  }

  it('serializes a concurrent GLOBAL SAFETY_RESOLVE revoke after final authority validation', async () => {
    const held = await createHeldCase();
    const authority = await seedAuthority(staff, held.caseId);
    expect(authority.assignmentId).not.toBeNull();

    const barrier = await installCaseTransitionBarrier(held.caseId);
    const mutator = await admin.connect();
    let resolvePromise: ReturnType<typeof resolveAs> | null = null;
    let revokePromise: Promise<unknown> | null = null;

    try {
      resolvePromise = resolveAs(staff, held, nextKey('resolve-global-revoke-race'));
      await waitForBarrier(barrier.advisoryKey1, barrier.advisoryKey2);

      const pid = await mutator.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      let revokeSettled = false;
      revokePromise = mutator
        .query(
          `UPDATE staff_assignments
              SET revoked_by_account_id = $2,
                  revoked_at = clock_timestamp()
            WHERE id = $1`,
          [authority.grantId, owner.accountId]
        )
        .finally(() => {
          revokeSettled = true;
        });

      const serialized = await waitForBlockedBackend(
        pid.rows[0]!.pid,
        () => revokeSettled
      );

      // Regression-first invariant: once ResolveRisk has passed its final
      // authority validation, revoke must not commit ahead of the Case
      // transition. The audited Head fails here because no authority row is
      // locked through transitionCaseStatus().
      expect(serialized).toBe(true);

      await barrier.release();

      const resolved = await resolvePromise;
      expect(resolved.status).toBe(200);
      await revokePromise;

      const after = await fixture.getCase(held.caseId);
      expect(after.status).toBe('WAITING');
      expect(after.version).toBe(held.heldVersion + 1);

      const grant = await admin.query<{ revoked_at: Date | null }>(
        'SELECT revoked_at FROM staff_assignments WHERE id = $1',
        [authority.grantId]
      );
      expect(grant.rows[0]?.revoked_at).not.toBeNull();
    } finally {
      await barrier.release().catch(() => undefined);
      await resolvePromise?.catch(() => undefined);
      await revokePromise?.catch(() => undefined);
      mutator.release();
      await barrier.cleanup();
    }
  });

  it('serializes a concurrent exact CASE assignment revoke after final authority validation', async () => {
    const held = await createHeldCase();
    const authority = await seedAuthority(staff, held.caseId);
    expect(authority.assignmentId).not.toBeNull();

    await expectResolveWinsAuthorityMutationRace(
      held,
      'resolve-case-revoke-race',
      (client) =>
        client.query(
          `UPDATE staff_assignments
              SET revoked_by_account_id = $2,
                  revoked_at = clock_timestamp()
            WHERE id = $1`,
          [authority.assignmentId, owner.accountId]
        )
    );
  });

  it('serializes a concurrent reviewer Account disable after final authority validation', async () => {
    const held = await createHeldCase();
    await seedAuthority(staff, held.caseId);

    try {
      await expectResolveWinsAuthorityMutationRace(
        held,
        'resolve-account-disable-race',
        (client) =>
          client.query(
            `UPDATE accounts
                SET status = 'DISABLED'
              WHERE id = $1`,
            [staff.accountId]
          )
      );
    } finally {
      await admin.query(
        `UPDATE accounts SET status = 'ACTIVE' WHERE id = $1`,
        [staff.accountId]
      );
    }
  });

  it('denies when a GLOBAL SAFETY_RESOLVE grant was revoked first', async () => {
    const held = await createHeldCase();
    const authority = await seedAuthority(staff, held.caseId);

    await admin.query(
      `UPDATE staff_assignments
          SET revoked_by_account_id = $2,
              revoked_at = clock_timestamp()
        WHERE id = $1`,
      [authority.grantId, owner.accountId]
    );

    await expectDenied(staff, held);
  });

  it('denies when the exact CASE assignment was revoked first', async () => {
    const held = await createHeldCase();
    const authority = await seedAuthority(staff, held.caseId);
    expect(authority.assignmentId).not.toBeNull();

    await admin.query(
      `UPDATE staff_assignments
          SET revoked_by_account_id = $2,
              revoked_at = clock_timestamp()
        WHERE id = $1`,
      [authority.assignmentId, owner.accountId]
    );

    await expectDenied(staff, held);
  });

  it('denies when the reviewer Account was DISABLED first', async () => {
    const held = await createHeldCase();
    await seedAuthority(staff, held.caseId);

    await admin.query(
      `UPDATE accounts SET status = 'DISABLED' WHERE id = $1`,
      [staff.accountId]
    );
    try {
      await expectDenied(staff, held);
    } finally {
      await admin.query(
        `UPDATE accounts SET status = 'ACTIVE' WHERE id = $1`,
        [staff.accountId]
      );
    }
  });

  it('uses wall-clock authority validity at the actual ResolveRisk transition', async () => {
    const held = await createHeldCase();
    const authority = await seedAuthority(staff, held.caseId);
    expect(authority.assignmentId).not.toBeNull();

    const expiry = await admin.query<{ valid_until: Date }>(
      `UPDATE staff_assignments
          SET valid_until = clock_timestamp() + interval '3 seconds'
        WHERE id IN ($1, $2)
        RETURNING valid_until`,
      [authority.grantId, authority.assignmentId]
    );
    const validUntil = new Date(
      Math.max(...expiry.rows.map((row) => row.valid_until.getTime()))
    );

    const counts = async () => [
      await fixture.countRiskEvents(held.caseId),
      await fixture.countCaseEvents(held.caseId),
      await fixture.countAuditEvents(held.caseId),
    ];
    const beforeCounts = await counts();
    const barrier = await installCaseTransitionBarrier(held.caseId);
    let resolvePromise: ReturnType<typeof resolveAs> | null = null;

    try {
      resolvePromise = resolveAs(staff, held, nextKey('resolve-expiry-race'));
      await waitForBarrier(barrier.advisoryKey1, barrier.advisoryKey2);
      await waitUntilExpired(validUntil);
      await barrier.release();

      await expect(resolvePromise).rejects.toMatchObject({
        code: 'SAFETY_RESOLUTION_AUTHORITY_DENIED',
        statusCode: 403,
      });

      const after = await fixture.getCase(held.caseId);
      expect(after.status).toBe('SAFETY_HOLD');
      expect(after.version).toBe(held.heldVersion);
      expect(await counts()).toEqual(beforeCounts);
    } finally {
      await barrier.release().catch(() => undefined);
      await resolvePromise?.catch(() => undefined);
      await barrier.cleanup();
    }
  });

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
