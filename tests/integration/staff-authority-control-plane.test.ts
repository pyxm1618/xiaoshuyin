import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withIdentityTransaction } from '../../apps/server/api/src/db/tx.js';
import { createInterventionDefinitionCandidate } from '../../apps/server/api/src/services/intervention-definitions.js';
import { createKnowledgeCandidate, recordKnowledgeReview } from '../../apps/server/api/src/services/professional-knowledge.js';
import { hashProfessionalKnowledgeContent, hashProfessionalKnowledgeSourceSet } from '../../packages/domain/src/index.js';
import { enterSafetyHold } from '../../apps/server/api/src/safety/enter-safety-hold.js';
import { resolveRisk } from '../../apps/server/api/src/safety/resolve-risk.js';
import { createStaffAuthorityCommands } from '../../apps/server/api/src/staff-authority/commands.js';
import { getCurrentProfessionalReviewStaffAssignment } from '../../packages/domain/src/intervention-definition-repository.js';
import { resolveProfessionalReviewStaffAuthority, setProfessionalKnowledgeAdminContext } from '../../packages/domain/src/professional-knowledge-repository.js';
import { runSafetyPrecheck } from '../../packages/domain/src/safety/index.js';
import { interventionSemantic } from '../support/intervention.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type ActorSession } from '../setup/safety.js';

describe('C3 Staff Assignment Control Plane', () => {
  const prefix = 'c3_staff_';
  const policy = { policyRef: 'c3.policy', policyVersion: '1', ruleRef: 'c3.rule', ruleVersion: '1' };
  const past = new Date(Date.now() - 60_000).toISOString();
  const expired = new Date(Date.now() - 30_000).toISOString();
  const future = new Date(Date.now() + 3_600_000).toISOString();
  let fixture: ReturnType<typeof createSafetyFixture>;
  let commands: ReturnType<typeof createStaffAuthorityCommands>;
  let operator: ActorSession;
  let manager: ActorSession;
  let familyId: string;
  const key = () => randomUUID();
  const identity = ({ accountId, personId }: ActorSession) => ({ accountId, personId });
  const global = (actor: ActorSession, capability: string) => ({
    ...identity(actor), scope: 'GLOBAL', capability, validFrom: past, validUntil: null,
  });
  const seedOperator = (actor: ActorSession, start = past, end: string | null = null) =>
    fixture.admin.query<{ id: string }>(
      `INSERT INTO staff_assignments
       (account_id, person_id, capability, scope_type, granted_by_account_id, valid_from, valid_until)
       VALUES ($1,$2,'SERVICE_CONTROL','GLOBAL',$1,$3,$4) RETURNING id`,
      [actor.accountId, actor.personId, start, end],
    );

  beforeAll(async () => {
    const app = await buildApp();
    await app.ready();
    fixture = createSafetyFixture({ app, admin: createAdminPool(), prefix });
    operator = await fixture.login('operator');
    manager = await fixture.login('manager');
    familyId = await fixture.createFamily(manager, 'c3');
    commands = createStaffAuthorityCommands(fixture.pool, process.env['SESSION_SECRET']!);
    await seedOperator(operator);
  });

  afterAll(async () => {
    if (!fixture) return;
    await fixture.admin.query(
      `DELETE FROM business_audit_events WHERE resource_type = 'STAFF_ASSIGNMENT'
       AND actor_account_id IN (SELECT id FROM accounts WHERE starts_with(wechat_openid, $1))`, [prefix],
    );
    await fixture.admin.query(
      `DELETE FROM staff_assignments WHERE account_id IN
       (SELECT id FROM accounts WHERE starts_with(wechat_openid, $1))
       OR granted_by_account_id = $2`, [prefix, operator.accountId],
    );
    await fixture.cleanup();
    await fixture.close();
    await fixture.app.close();
    await fixture.admin.end();
  });

  it('requires live SERVICE_CONTROL for grant, revoke and inventory; denies self-grant at the DB command', async () => {
    const ordinary = await fixture.login('ordinary');
    const staff = await fixture.login('staff');
    await commands.grant(operator.token, key(), global(staff, 'SAFETY_REVIEW'));
    const inactive = await fixture.login('inactive');
    await seedOperator(inactive, past, expired);
    const scheduled = await fixture.login('scheduled');
    await seedOperator(scheduled, future);
    const revoked = await fixture.login('revoked');
    const grant = await seedOperator(revoked);
    await commands.revoke(operator.token, key(), { assignmentId: grant.rows[0]!.id });
    const disabled = await fixture.login('disabled');
    await seedOperator(disabled);
    await fixture.admin.query("UPDATE accounts SET status='DISABLED' WHERE id=$1", [disabled.accountId]);

    for (const actor of [ordinary, staff, manager, inactive, scheduled, revoked, disabled]) {
      await expect(commands.read(actor.token, identity(staff))).rejects.toMatchObject({ code: '42501' });
      await expect(commands.grant(actor.token, key(), global(staff, 'DATA_RIGHTS'))).rejects.toMatchObject({ code: '42501' });
      await expect(commands.revoke(actor.token, key(), { assignmentId: randomUUID() })).rejects.toMatchObject({ code: '42501' });
    }
    for (const capability of ['SERVICE_CONTROL', 'SAFETY_RESOLVE', 'PROFESSIONAL_REVIEW']) {
      await expect(commands.grant(operator.token, key(), global(operator, capability)))
        .rejects.toThrow('STAFF_AUTHORITY_SELF_GRANT_DENIED');
    }
    await expect(commands.grant(operator.token, key(), {
      ...global(operator, 'SERVICE_CONTROL'), scope: 'CASE', familyId,
      caseId: randomUUID(), parentGrantId: randomUUID(),
    })).rejects.toThrow('STAFF_AUTHORITY_SELF_GRANT_DENIED');
    await expect(commands.read('invalid-session', identity(staff))).rejects.toThrow('STAFF_AUTHORITY_SESSION_INVALID');
    const { rows } = await fixture.pool.query(
      `SELECT has_table_privilege(current_user,'staff_assignments','INSERT,UPDATE,DELETE') AS allowed`,
    );
    expect(rows).toEqual([{ allowed: false }]);
  });

  it('validates graph, identity, vocabulary, scope and window; replays exact operations and audits only actual mutations', async () => {
    const staff = await fixture.login('lifecycle');
    const { id: caseId } = await fixture.createCase(manager);
    const input = global(staff, 'SAFETY_RESOLVE');
    const grantKey = key();
    const parent = await commands.grant(operator.token, grantKey, input);
    expect(await commands.grant(operator.token, grantKey, input)).toEqual(parent);
    await expect(commands.grant(operator.token, grantKey, { ...input, validUntil: future })).rejects.toThrow('MISMATCH');
    await expect(commands.grant(operator.token, key(), input)).rejects.toThrow('GRANT_OVERLAP');
    await expect(commands.grant(operator.token, key(), { ...input, personId: manager.personId })).rejects.toMatchObject({ code: '23503' });
    await expect(commands.grant(operator.token, key(), { ...input, capability: 'ADMIN' })).rejects.toMatchObject({ code: '23514' });
    await expect(commands.grant(operator.token, key(), { ...input, scope: 'FAMILY' })).rejects.toThrow();
    await expect(commands.grant(operator.token, key(), { ...input, validUntil: past })).rejects.toThrow('GRANT_INVALID');

    const caseInput = { ...input, scope: 'CASE', caseId, familyId, parentGrantId: parent.id };
    await expect(commands.grant(operator.token, key(), { ...caseInput, parentGrantId: undefined })).rejects.toThrow();
    await expect(commands.grant(operator.token, key(), { ...caseInput, capability: 'QUALITY_REVIEW' })).rejects.toThrow('PARENT_INVALID');
    await expect(commands.grant(operator.token, key(), { ...caseInput, familyId: randomUUID() })).rejects.toMatchObject({ code: '23503' });
    const child = await commands.grant(operator.token, key(), caseInput);
    expect(await commands.read(operator.token, { caseId })).toMatchObject([
      { id: child.id, capability_grant_id: parent.id, status: 'ACTIVE' },
    ]);
    expect(await commands.read(operator.token, identity(staff))).toMatchObject([
      { id: parent.id, status: 'ACTIVE' }, { id: child.id, status: 'ACTIVE' },
    ]);
    const revokeKey = key();
    const revoked = await commands.revoke(operator.token, revokeKey, { assignmentId: parent.id });
    expect(await commands.revoke(operator.token, revokeKey, { assignmentId: parent.id })).toEqual(revoked);
    expect(await commands.revoke(operator.token, key(), { assignmentId: parent.id })).toEqual(revoked);
    expect(await commands.grant(operator.token, grantKey, input)).toEqual(parent);
    await expect(commands.revoke(operator.token, revokeKey, { assignmentId: child.id })).rejects.toThrow('MISMATCH');
    expect(await commands.read(operator.token, identity(staff))).toMatchObject([
      { id: parent.id, status: 'REVOKED' }, { id: child.id, status: 'INVALID_PARENT' },
    ]);
    const { rows } = await fixture.admin.query(
      `SELECT event_type, actor_account_id, metadata FROM business_audit_events
       WHERE resource_id=$1 ORDER BY event_type`, [parent.id],
    );
    expect(rows).toMatchObject(['STAFF_AUTHORITY_GRANTED', 'STAFF_AUTHORITY_REVOKED'].map((event_type) => ({
      event_type, actor_account_id: operator.accountId,
      metadata: { ...identity(staff), capability: 'SAFETY_RESOLVE', scope: 'GLOBAL' },
    })));
  });

  it('reports expired, future and disabled authority and deterministically revokes expired grants', async () => {
    const staff = await fixture.login('windows');
    const ended = await commands.grant(operator.token, key(), { ...global(staff, 'DATA_RIGHTS'), validUntil: expired });
    const scheduled = await commands.grant(operator.token, key(), { ...global(staff, 'DATA_RIGHTS'), validFrom: future });
    expect(await commands.read(operator.token, identity(staff))).toMatchObject([
      { id: ended.id, status: 'EXPIRED' }, { id: scheduled.id, status: 'FUTURE' },
    ]);
    const revoked = await commands.revoke(operator.token, key(), { assignmentId: ended.id });
    expect(await commands.revoke(operator.token, key(), { assignmentId: ended.id })).toEqual(revoked);
    await fixture.admin.query("UPDATE accounts SET status='DISABLED' WHERE id=$1", [staff.accountId]);
    expect(await commands.read(operator.token, identity(staff))).toMatchObject([
      { id: ended.id, status: 'REVOKED' }, { id: scheduled.id, status: 'DISABLED' },
    ]);
  });

  it('rolls back each mutation and its idempotency slot when audit insertion fails', async () => {
    const staff = await fixture.login('audit_rollback');
    const input = global(staff, 'QUALITY_REVIEW');
    const grantKey = key();
    const revokeKey = key();
    async function failAudit(event: 'GRANTED' | 'REVOKED', operation: () => Promise<unknown>) {
      await fixture.admin.query(`
        CREATE FUNCTION test_c3_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          RAISE EXCEPTION 'c3 fixture audit failure';
        END $$;
        CREATE TRIGGER test_c3_reject_audit BEFORE INSERT ON business_audit_events
        FOR EACH ROW WHEN (NEW.actor_account_id = '${operator.accountId}'::uuid
          AND NEW.event_type = 'STAFF_AUTHORITY_${event}')
        EXECUTE FUNCTION test_c3_reject_audit();
      `);
      try {
        await expect(operation()).rejects.toThrow('c3 fixture audit failure');
      } finally {
        await fixture.admin.query('DROP TRIGGER test_c3_reject_audit ON business_audit_events; DROP FUNCTION test_c3_reject_audit()');
      }
    }
    await failAudit('GRANTED', () => commands.grant(operator.token, grantKey, input));
    expect(await commands.read(operator.token, identity(staff))).toEqual([]);
    const granted = await commands.grant(operator.token, grantKey, input);
    await failAudit('REVOKED', () => commands.revoke(operator.token, revokeKey, { assignmentId: granted.id }));
    expect(await commands.read(operator.token, identity(staff))).toMatchObject([{ status: 'ACTIVE' }]);
    expect(await fixture.countAuditEvents(granted.id)).toBe(1);
    await commands.revoke(operator.token, revokeKey, { assignmentId: granted.id });
    expect(await fixture.countAuditEvents(granted.id)).toBe(2);
  });

  async function prepareSafety(staff: ActorSession) {
    const target = await fixture.createCase(manager);
    const decision = runSafetyPrecheck({
      case: { caseId: target.id, status: target.status as never, version: target.version },
      trustedPolicyIdentity: policy,
      approvedEvaluation: { ...policy, outcome: 'HOLD_REQUIRED', riskCategoryRef: 'C3', evidenceRefs: [] },
    });
    await enterSafetyHold(fixture.pool, {
      ...identity(manager), caseId: target.id, idempotencyKey: key(),
      expectedCaseVersion: target.version, decision, trustedPolicyIdentity: policy,
    });
    const response = await fixture.app.inject({
      method: 'POST', url: `/api/v1/cases/${target.id}/messages`,
      headers: { authorization: `Bearer ${manager.token}`, 'idempotency-key': key() },
      payload: { content: 'C3 authority test evidence' },
    });
    expect(response.statusCode).toBe(201);
    const held = await fixture.getCase(target.id);
    const parent = await commands.grant(operator.token, key(), global(staff, 'SAFETY_RESOLVE'));
    await commands.grant(operator.token, key(), {
      ...global(staff, 'SAFETY_RESOLVE'), scope: 'CASE', familyId, caseId: target.id, parentGrantId: parent.id,
    });
    return {
      parent,
      caseId: target.id,
      resolve: () => resolveRisk(fixture.pool, {
        ...identity(staff), caseId: target.id, idempotencyKey: key(),
        expectedCaseVersion: held.version, trustedPolicyIdentity: policy,
        reviewEvidenceRefs: [{ kind: 'MESSAGE', ref: response.json().id as string }],
      }),
    };
  }

  it('lets production ResolveRisk observe a C3 grant and denies it after GLOBAL revoke', async () => {
    const first = await prepareSafety(await fixture.login('resolver'));
    await expect(first.resolve()).resolves.toBeDefined();
    const second = await prepareSafety(await fixture.login('revoked_resolver'));
    await commands.revoke(operator.token, key(), { assignmentId: second.parent.id });
    await expect(second.resolve()).rejects.toMatchObject({ code: 'SAFETY_RESOLUTION_AUTHORITY_DENIED' });
  });

  async function waitForAdvisoryWaiter(pid: number) {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const { rows } = await fixture.admin.query<{ waiting: boolean }>(
        'SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = $1 AND NOT granted AND $2 = ANY(pg_blocking_pids(pid))) AS waiting',
        ['advisory', pid],
      );
      if (rows[0]?.waiting) return;
      await fixture.admin.query('SELECT pg_sleep(0.01)');
    }
    throw new Error('Expected transaction did not wait on the authority barrier');
  }

  async function raceWithTrigger(
    table: 'cases' | 'business_audit_events',
    condition: string,
    leader: () => Promise<unknown>,
    follower: () => Promise<unknown>,
  ) {
    const locker = await fixture.admin.connect();
    const barrier = 315029;
    let leading: Promise<PromiseSettledResult<unknown>> | undefined;
    let following: Promise<PromiseSettledResult<unknown>> | undefined;
    await locker.query('SELECT pg_advisory_lock($1)', [barrier]);
    try {
      await locker.query(`
        CREATE FUNCTION test_c3_authority_barrier() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          PERFORM pg_advisory_xact_lock(${barrier});
          RETURN NEW;
        END $$;
        CREATE TRIGGER test_c3_authority_barrier BEFORE ${table === 'cases' ? 'UPDATE' : 'INSERT'} ON ${table}
        FOR EACH ROW WHEN (${condition}) EXECUTE FUNCTION test_c3_authority_barrier();
      `);
      const { rows } = await locker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      const pid = rows[0]!.pid;
      const settle = async (action: () => Promise<unknown>) => (await Promise.allSettled([action()]))[0]!;
      leading = settle(leader);
      await waitForAdvisoryWaiter(pid);
      const { rows: blockers } = await locker.query<{ pid: number }>(
        'SELECT pid FROM pg_locks WHERE locktype = $1 AND NOT granted AND $2 = ANY(pg_blocking_pids(pid))',
        ['advisory', pid],
      );
      following = settle(follower);
      await waitForAdvisoryWaiter(blockers[0]!.pid);
    } finally {
      await locker.query('SELECT pg_advisory_unlock($1)', [barrier]);
      await Promise.all([leading, following]);
      await locker.query(`DROP TRIGGER IF EXISTS test_c3_authority_barrier ON ${table}; DROP FUNCTION IF EXISTS test_c3_authority_barrier()`);
      locker.release();
    }
    return { leader: await leading, follower: await following };
  }

  it('serializes live GLOBAL revoke with ResolveRisk in either order', async () => {
    const first = await prepareSafety(await fixture.login('consumer_first'));
    const consumerFirst = await raceWithTrigger(
      'cases', `NEW.id = '${first.caseId}'::uuid`,
      first.resolve, () => commands.revoke(operator.token, key(), { assignmentId: first.parent.id }),
    );
    expect(consumerFirst.leader).toMatchObject({ status: 'fulfilled' });
    expect(consumerFirst.follower).toMatchObject({ status: 'fulfilled' });

    const second = await prepareSafety(await fixture.login('revoke_first'));
    const revokeFirst = await raceWithTrigger(
      'business_audit_events',
      `NEW.resource_id = '${second.parent.id}'::uuid AND NEW.event_type = 'STAFF_AUTHORITY_REVOKED'`,
      () => commands.revoke(operator.token, key(), { assignmentId: second.parent.id }), second.resolve,
    );
    expect(revokeFirst.leader).toMatchObject({ status: 'fulfilled' });
    expect(revokeFirst.follower).toMatchObject({
      status: 'rejected', reason: { code: 'SAFETY_RESOLUTION_AUTHORITY_DENIED' },
    });
    expect(await fixture.getCase(second.caseId)).toMatchObject({ status: 'SAFETY_HOLD' });
  });

  it('serializes concurrent duplicate grants and exact replays', async () => {
    const staff = await fixture.login('duplicate_race');
    const input = global(staff, 'SAFETY_REVIEW');
    const grantKey = key();
    const results = await Promise.all([
      commands.grant(operator.token, grantKey, input), commands.grant(operator.token, grantKey, input),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(await fixture.countAuditEvents(results[0]!.id)).toBe(1);

    const other = global(staff, 'EXCEPTION_SUPPORT');
    const duplicates = await Promise.allSettled([
      commands.grant(operator.token, key(), other), commands.grant(operator.token, key(), other),
    ]);
    expect(duplicates.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(duplicates.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { message: 'STAFF_AUTHORITY_GRANT_OVERLAP' },
    });
  });

  it('exposes exact GLOBAL professional authority to both consumers and keeps qualification separate', async () => {
    const staff = await fixture.login('professional');
    const granted = await commands.grant(operator.token, key(), global(staff, 'PROFESSIONAL_REVIEW'));
    const intervention = () => withIdentityTransaction(fixture.pool, {
      accountId: staff.accountId, purpose: 'SELF_IDENTITY',
    }, (tx) => getCurrentProfessionalReviewStaffAssignment(tx, identity(staff)));
    const knowledge = () => withIdentityTransaction(fixture.pool, {
      accountId: staff.accountId, purpose: 'PROFESSIONAL_KNOWLEDGE_ADMIN',
    }, async (tx) => {
      await setProfessionalKnowledgeAdminContext(tx, granted.id);
      return resolveProfessionalReviewStaffAuthority(tx, { ...identity(staff), assignmentRef: granted.id });
    });
    await expect(intervention()).resolves.toEqual({ assignmentRef: granted.id });
    await expect(knowledge()).resolves.toMatchObject({ status: 'RESOLVED', assignmentRef: granted.id });
    const interventionCandidate = () => createInterventionDefinitionCandidate(fixture.pool, {
      actor: identity(staff), sceneId: 'DIGITAL_USE', interventionCode: 'C3_QUALIFICATION_TEST',
      semantic: interventionSemantic(), approvalScope: 'DIGITAL_USE', idempotencyKey: key(),
    });
    await expect(interventionCandidate()).rejects.toMatchObject({ code: 'INTERVENTION_QUALIFICATION_MISSING' });

    // Knowledge candidates and sources are append-only. Their creator is
    // separate from the accounts removed by the Safety fixture cleanup.
    const creatorLogin = await fixture.app.inject({
      method: 'POST', url: '/api/v1/auth/wechat', payload: { code: 'c3_knowledge_creator_' + key() },
    });
    expect(creatorLogin.statusCode).toBe(200);
    const creatorSession = creatorLogin.json();
    const creator: ActorSession = {
      accountId: creatorSession.accountId, personId: creatorSession.person.id, token: creatorSession.sessionToken,
    };
    const creatorAssignment = await commands.grant(operator.token, key(), global(creator, 'PROFESSIONAL_REVIEW'));
    const content = { body: 'C3 test candidate' };
    const sources = [{ sourceRef: 'source:c3', sourceVersion: '1', sourceHash: 'a'.repeat(64), locator: null, metadata: {} }];
    const candidate = await createKnowledgeCandidate({
      pool: fixture.pool, ...identity(creator), assignmentId: creatorAssignment.id, idempotencyKey: key(),
      candidate: {
        knowledgeKey: 'c3-' + key(), semanticVersion: '1.0.0', content, sources,
        contentHash: hashProfessionalKnowledgeContent(content),
        sourceSetHash: hashProfessionalKnowledgeSourceSet(sources),
        scope: {
          product: 'V1', sceneCode: 'DIGITAL_USE', scenePackageVersion: 'c3-fixture',
          stages: ['ASSESSMENT'], ageBands: ['MINOR_14_17'], applicability: ['sleep-impact'],
          exclusions: [], riskLevels: ['LOW'], locale: 'zh-CN', interventionDefinitionRef: null,
        },
      },
    });
    const review = (assignmentId = granted.id) => recordKnowledgeReview({
      pool: fixture.pool, ...identity(staff), assignmentId, idempotencyKey: key(),
      versionId: candidate.versionId, expectedRevision: candidate.revision,
      reviewerIdentity: staff.personId, qualificationRef: 'unavailable', outcome: 'REVIEWED',
    });
    await expect(review()).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
    const revokeFirst = await raceWithTrigger(
      'business_audit_events',
      `NEW.resource_id = '${granted.id}'::uuid AND NEW.event_type = 'STAFF_AUTHORITY_REVOKED'`,
      () => commands.revoke(operator.token, key(), { assignmentId: granted.id }), intervention,
    );
    expect(revokeFirst.leader).toMatchObject({ status: 'fulfilled' });
    expect(revokeFirst.follower).toEqual({ status: 'fulfilled', value: null });
    await expect(interventionCandidate()).rejects.toMatchObject({ code: 'INTERVENTION_STAFF_AUTHORITY_INVALID' });
    await expect(knowledge()).rejects.toThrow('PROFESSIONAL_REVIEW_ASSIGNMENT_REQUIRED');
    await expect(review()).rejects.toThrow('PROFESSIONAL_REVIEW_ASSIGNMENT_REQUIRED');

    const replacement = await commands.grant(operator.token, key(), global(staff, 'PROFESSIONAL_REVIEW'));
    const reviewAfterRevoke = await raceWithTrigger(
      'business_audit_events',
      `NEW.resource_id = '${replacement.id}'::uuid AND NEW.event_type = 'STAFF_AUTHORITY_REVOKED'`,
      () => commands.revoke(operator.token, key(), { assignmentId: replacement.id }),
      () => review(replacement.id),
    );
    expect(reviewAfterRevoke.leader).toMatchObject({ status: 'fulfilled' });
    expect(reviewAfterRevoke.follower).toMatchObject({
      status: 'rejected', reason: { message: 'PROFESSIONAL_REVIEW_ASSIGNMENT_REQUIRED' },
    });
  });
});
