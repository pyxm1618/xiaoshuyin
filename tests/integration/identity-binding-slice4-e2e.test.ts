/**
 * T122 / T123 — Full Case C end-to-end against real Slice 4 runtime.
 *
 * Chain under test (no mock invitation lifecycle, no fake participation
 * table, no test-only replacement truth):
 *
 *   real Slice 4 invitation token
 *   -> Slice 5 invitation-aware bootstrap (production Slice4InvitationPort)
 *   -> candidate confirmation + second-party confirmation
 *   -> binding COMMITTED
 *   -> explicit Slice 4 accept
 *   -> participation ACTIVE
 *
 * T123 boundary: identity success never grants participation. PENDING and
 * TERMINAL bindings leave active participation at 0; even COMMITTED still
 * requires the explicit Slice 4 accept.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  bootstrap,
  candidateSession,
  candidateStatus,
  confirmerDecision,
  personAccountId,
  startBinding,
  type BindingRuntime,
  type TargetFixture,
} from '../setup/identity-binding.js';
import {
  acceptInvite,
  buildParticipationApp,
  createParticipationFixture,
  getParticipation,
  invite,
  lookupInvite,
  type ParticipationFixture,
  type ParticipationHarness,
} from '../setup/participation.js';

interface CaseCInvitation {
  fixture: ParticipationFixture;
  target: TargetFixture;
  participationId: string;
  invitationToken: string;
}

let h: ParticipationHarness;
let runtime: BindingRuntime;

beforeAll(async () => {
  // No injected invitation port: the app uses the production Slice 4 adapter.
  h = await buildParticipationApp();
  runtime = { app: h.app as FastifyInstance, admin: h.admin };
});

afterAll(async () => {
  await h.close();
});

async function createCaseCInvitation(label: string): Promise<CaseCInvitation> {
  const fixture = await createParticipationFixture(h, label, {
    target: 'member',
    ageBand: 'MINOR_14_17',
  });
  const created = await invite(
    h.app,
    fixture.manager.token,
    fixture.caseId,
    fixture.targetPersonId,
    `${label}-invite-${randomUUID()}`
  );
  expect(created.statusCode).toBe(201);
  const participationId = created.json().participationId as string;
  const invitationToken = created.json().inviteToken as string;
  return {
    fixture,
    target: {
      guardian: fixture.manager,
      familyId: fixture.familyId,
      targetPersonId: fixture.targetPersonId,
      invitationToken,
      participationId,
    },
    participationId,
    invitationToken,
  };
}

async function participationRow(participationId: string) {
  const { rows } = await h.admin.query(
    'SELECT state FROM case_participants WHERE id = $1',
    [participationId]
  );
  return rows[0] as { state: string } | undefined;
}

async function activeParticipationCount(personId: string): Promise<number> {
  const { rows } = await h.admin.query(
    `SELECT count(*)::int AS n FROM case_participants
      WHERE person_id = $1 AND state = 'ACTIVE'`,
    [personId]
  );
  return rows[0].n as number;
}

async function attemptRow(attemptId: string) {
  const { rows } = await h.admin.query(
    'SELECT state, terminal_reason FROM binding_attempts WHERE id = $1',
    [attemptId]
  );
  return rows[0] as { state: string; terminal_reason: string | null } | undefined;
}

async function bindingSafetySnapshot(personId: string) {
  const { rows } = await h.admin.query(
    `SELECT
       (SELECT count(*)::int FROM family_members WHERE person_id = $1) AS memberships,
       (SELECT count(*)::int FROM consent_records WHERE bound_person_id = $1) AS consents,
       (SELECT guardian_person_id::text FROM person_compliance_profiles WHERE person_id = $1) AS guardian`,
    [personId]
  );
  return rows[0];
}

describe('T122 — full Case C E2E: invitation -> binding -> explicit accept', () => {
  it('binds a real invited Person and leaves participation PENDING until Slice 4 accept', async () => {
    const c = await createCaseCInvitation('t122-case-c');
    expect(await personAccountId(runtime, c.target.targetPersonId)).toBeNull();
    expect((await lookupInvite(h.app, c.invitationToken)).statusCode).toBe(200);
    expect((await participationRow(c.participationId))?.state).toBe('PENDING');
    expect(await activeParticipationCount(c.target.targetPersonId)).toBe(0);
    const before = await bindingSafetySnapshot(c.target.targetPersonId);

    const { contextToken, attemptId } = await startBinding(
      runtime,
      c.target,
      `t122_case_c_${randomUUID()}`
    );

    // CANDIDATE AFFIRM alone: attempt pending, no Account, no ACTIVE.
    expect(await personAccountId(runtime, c.target.targetPersonId)).toBeNull();
    expect((await attemptRow(attemptId))?.state).toBe('PENDING');
    expect((await participationRow(c.participationId))?.state).toBe('PENDING');
    expect(await activeParticipationCount(c.target.targetPersonId)).toBe(0);
    expect((await candidateStatus(runtime, contextToken)).json().binding)
      .toBe('NOT_COMPLETED');

    // Second-party confirmation commits the binding only.
    const confirmed = await confirmerDecision(
      runtime,
      c.fixture.manager.token,
      attemptId,
      { personId: c.target.targetPersonId, decision: 'AFFIRM' }
    );
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().state).toBe('COMMITTED');

    const boundAccountId = await personAccountId(runtime, c.target.targetPersonId);
    expect(boundAccountId).not.toBeNull();
    // No P2: binding creates an Account link, never a second Person.
    const p2 = await h.admin.query(
      'SELECT count(*)::int AS n FROM persons WHERE created_by_account_id = $1',
      [boundAccountId]
    );
    expect(p2.rows[0].n).toBe(0);

    // Binding is not participation and grants no family / guardian / consent.
    expect(await activeParticipationCount(c.target.targetPersonId)).toBe(0);
    expect((await participationRow(c.participationId))?.state).toBe('PENDING');
    expect(await bindingSafetySnapshot(c.target.targetPersonId)).toEqual(before);

    // The newly bound Person can exchange the binding session, but the
    // participation is still explicitly PENDING.
    const session = await candidateSession(runtime, contextToken);
    expect(session.statusCode).toBe(200);
    expect(session.json().binding).toBe('COMMITTED');
    const sessionToken = session.json().sessionToken as string;
    const pending = await getParticipation(h.app, sessionToken, c.participationId);
    expect(pending.statusCode).toBe(200);
    expect(pending.json().state).toBe('PENDING');
    expect(await activeParticipationCount(c.target.targetPersonId)).toBe(0);

    // Explicit Slice 4 accept is the only path to ACTIVE.
    const accepted = await acceptInvite(
      h.app,
      sessionToken,
      c.invitationToken,
      `t122-accept-${randomUUID()}`
    );
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().state).toBe('ACTIVE');
    expect((await participationRow(c.participationId))?.state).toBe('ACTIVE');
    expect(await activeParticipationCount(c.target.targetPersonId)).toBe(1);
  });
});

describe('T123 — joint binding / participation state acceptance', () => {
  it('PENDING binding: zero active participation and invitation token alone is not identity', async () => {
    const c = await createCaseCInvitation('t123-pending');
    await startBinding(runtime, c.target, `t123_pending_${randomUUID()}`);

    expect((await attemptRow(
      (await h.admin.query(
        'SELECT id FROM binding_attempts WHERE target_person_id = $1 ORDER BY created_at DESC LIMIT 1',
        [c.target.targetPersonId]
      )).rows[0].id
    ))?.state).toBe('PENDING');
    expect((await participationRow(c.participationId))?.state).toBe('PENDING');
    expect(await activeParticipationCount(c.target.targetPersonId)).toBe(0);
    expect(await personAccountId(runtime, c.target.targetPersonId)).toBeNull();

    // Possessing the invitation token is not identity proof: a non-target
    // Account is rejected generically and the invitation state is unchanged.
    const denied = await acceptInvite(
      h.app,
      c.fixture.manager.token,
      c.invitationToken,
      `t123-pending-unauthorized-${randomUUID()}`
    );
    expect(denied.statusCode).toBe(404);
    expect(denied.json().code).toBe('PARTICIPATION_NOT_FOUND');
    expect((await participationRow(c.participationId))?.state).toBe('PENDING');
    expect(await activeParticipationCount(c.target.targetPersonId)).toBe(0);
  });

  it('TERMINAL binding: zero active participation and invitation lifecycle untouched', async () => {
    const c = await createCaseCInvitation('t123-terminal');
    const { attemptId } = await startBinding(
      runtime,
      c.target,
      `t123_terminal_${randomUUID()}`
    );

    const rejected = await confirmerDecision(
      runtime,
      c.fixture.manager.token,
      attemptId,
      { personId: c.target.targetPersonId, decision: 'REJECT' }
    );
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json().state).toBe('TERMINAL');

    const attempt = await attemptRow(attemptId);
    expect(attempt?.state).toBe('TERMINAL');
    expect(attempt?.terminal_reason).toBe('RECOGNITION_REJECTED');

    expect(await personAccountId(runtime, c.target.targetPersonId)).toBeNull();
    expect(await activeParticipationCount(c.target.targetPersonId)).toBe(0);
    // Binding attempt failure must not decline / expire / withdraw Slice 4.
    expect((await participationRow(c.participationId))?.state).toBe('PENDING');
    expect((await lookupInvite(h.app, c.invitationToken)).statusCode).toBe(200);
  });

  it('COMMITTED binding still requires explicit accept (no silent participation grant)', async () => {
    const c = await createCaseCInvitation('t123-committed');
    const { contextToken, attemptId } = await startBinding(
      runtime,
      c.target,
      `t123_committed_${randomUUID()}`
    );
    const confirmed = await confirmerDecision(
      runtime,
      c.fixture.manager.token,
      attemptId,
      { personId: c.target.targetPersonId, decision: 'AFFIRM' }
    );
    expect(confirmed.json().state).toBe('COMMITTED');

    expect(await personAccountId(runtime, c.target.targetPersonId)).not.toBeNull();
    expect((await participationRow(c.participationId))?.state).toBe('PENDING');
    expect(await activeParticipationCount(c.target.targetPersonId)).toBe(0);

    const session = await candidateSession(runtime, contextToken);
    expect(session.statusCode).toBe(200);
    expect(session.json().binding).toBe('COMMITTED');
    expect(await activeParticipationCount(c.target.targetPersonId)).toBe(0);

    const accepted = await acceptInvite(
      h.app,
      session.json().sessionToken as string,
      c.invitationToken,
      `t123-accept-${randomUUID()}`
    );
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().state).toBe('ACTIVE');
    expect(await activeParticipationCount(c.target.targetPersonId)).toBe(1);
  });

  it('an unbound candidate cannot accept through bootstrap without a committed binding', async () => {
    const c = await createCaseCInvitation('t123-unbound');
    const boot = await bootstrap(
      runtime,
      c.invitationToken,
      `t123_unbound_${randomUUID()}`,
      `t123-bootstrap-${randomUUID()}`
    );
    expect(boot.statusCode).toBe(200);
    expect(boot.json().binding).toBe('NOT_COMPLETED');

    // The pending context is a transport credential, not a session.
    const denied = await acceptInvite(
      h.app,
      boot.json().pendingContextToken as string,
      c.invitationToken,
      `t123-unbound-accept-${randomUUID()}`
    );
    expect(denied.statusCode).toBe(401);
    expect((await participationRow(c.participationId))?.state).toBe('PENDING');
    expect(await activeParticipationCount(c.target.targetPersonId)).toBe(0);
  });
});