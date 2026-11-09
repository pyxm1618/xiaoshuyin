/**
 * H-01 direct substantive proofs: rotation, consumed-challenge fail-closed,
 * same-key rotated-challenge mismatch and two-confirmer convergence.
 *
 * Non-collusive attacker matrix only. Intentional realtime relay by the
 * authenticated candidate remains OUT OF SCOPE (plan D-19.4 #1–#3).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

const injection = vi.hoisted(() => ({ failBinding: false }));

vi.mock('@xiaoshuyin/domain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xiaoshuyin/domain')>();
  return {
    ...actual,
    bindPersonAccountIfUnbound: async (
      tx: Parameters<typeof actual.bindPersonAccountIfUnbound>[0],
      personId: string,
      accountId: string
    ) => {
      if (injection.failBinding) throw new Error('INFRA_FAILURE_INJECTION');
      return actual.bindPersonAccountIfUnbound(tx, personId, accountId);
    },
  };
});

import {
  bootstrap,
  buildBindingApp,
  candidateDecision,
  confirmerDecision,
  createTarget,
  personAccountId,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';

const CHALLENGE = /^[A-Za-z0-9_-]{192}$/;

async function secondPartyCount(h: BindingHarness, attemptId: string): Promise<number> {
  const { rows } = await h.admin.query(
    "SELECT count(*)::int AS n FROM binding_confirmations WHERE attempt_id = $1 AND kind = 'SECOND_PARTY'",
    [attemptId]
  );
  return rows[0].n as number;
}

describe('H-01 pairing challenge direct proofs (MEDIUM-03)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    injection.failBinding = false;
    await h.close();
  });

  it('H-01 rotation: a new issuance returns new challenge bytes', async () => {
    const target = await createTarget(h, 'h01_rotation_new', { ageBand: 'UNDER_14' });
    const code = `h01_rotation_new_${randomUUID()}`;

    const firstBoot = await bootstrap(h, target.invitationToken, code, `boot1-${randomUUID()}`);
    expect(firstBoot.statusCode).toBe(200);
    const contextA = firstBoot.json().pendingContextToken as string;
    const affirmA = await candidateDecision(h, contextA, 'AFFIRM', `k1-${randomUUID()}`, 'candidate-binding-v1');
    expect(affirmA.statusCode).toBe(200);
    const challengeA = affirmA.json().pairingChallenge as string;
    expect(challengeA).toMatch(CHALLENGE);

    const secondBoot = await bootstrap(h, target.invitationToken, code, `boot2-${randomUUID()}`);
    expect(secondBoot.statusCode).toBe(200);
    const contextB = secondBoot.json().pendingContextToken as string;
    const affirmB = await candidateDecision(h, contextB, 'AFFIRM', `k2-${randomUUID()}`, 'candidate-binding-v1');
    expect(affirmB.statusCode).toBe(200);
    const challengeB = affirmB.json().pairingChallenge as string;
    expect(challengeB).toMatch(CHALLENGE);
    expect(challengeB).not.toBe(challengeA);

    // The new challenge remains valid.
    const current = await confirmerDecision(h, target.guardian.token, challengeB, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: `new-${randomUUID()}`,
    });
    expect(current.statusCode).toBe(200);
    expect(current.json().state).toBe('COMMITTED');
  });

  it('H-01 rotation: the old issuance is invalid after rotation', async () => {
    const target = await createTarget(h, 'h01_rotation_old', { ageBand: 'UNDER_14' });
    const code = `h01_rotation_old_${randomUUID()}`;

    const firstBoot = await bootstrap(h, target.invitationToken, code, `boot1-${randomUUID()}`);
    const contextA = firstBoot.json().pendingContextToken as string;
    const affirmA = await candidateDecision(h, contextA, 'AFFIRM', `k1-${randomUUID()}`, 'candidate-binding-v1');
    const challengeA = affirmA.json().pairingChallenge as string;

    const attempt = await h.admin.query(
      'SELECT id FROM binding_attempts WHERE target_person_id = $1 ORDER BY created_at DESC LIMIT 1',
      [target.targetPersonId]
    );
    const attemptId = attempt.rows[0].id as string;

    const secondBoot = await bootstrap(h, target.invitationToken, code, `boot2-${randomUUID()}`);
    const contextB = secondBoot.json().pendingContextToken as string;
    const affirmB = await candidateDecision(h, contextB, 'AFFIRM', `k2-${randomUUID()}`, 'candidate-binding-v1');
    expect(affirmB.statusCode).toBe(200);
    expect(affirmB.json().pairingChallenge).not.toBe(challengeA);

    const old = await confirmerDecision(h, target.guardian.token, challengeA, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: `old-${randomUUID()}`,
    });
    expect(old.statusCode).toBe(404);
    expect(old.json().code).toBe('BINDING_NOT_FOUND');
    expect(await secondPartyCount(h, attemptId)).toBe(0);

    const state = await h.admin.query('SELECT state FROM binding_attempts WHERE id = $1', [attemptId]);
    expect(state.rows[0].state).toBe('PENDING');
  });

  it('H-01 consumed challenge + NEW operation key is 404 with zero mutation', async () => {
    const target = await createTarget(h, 'h01_consumed', { ageBand: 'UNDER_14' });
    const { attemptId, pairingChallenge } = await startBinding(
      h,
      target,
      `h01_consumed_${randomUUID()}`
    );

    const first = await confirmerDecision(h, target.guardian.token, pairingChallenge, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: `consume-${randomUUID()}`,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().state).toBe('COMMITTED');

    const before = {
      confirmations: await secondPartyCount(h, attemptId),
      accountId: await personAccountId(h, target.targetPersonId),
      attempt: (
        await h.admin.query('SELECT state, committed_account_id FROM binding_attempts WHERE id = $1', [
          attemptId,
        ])
      ).rows[0],
      audit: (
        await h.admin.query(
          'SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1',
          [attemptId]
        )
      ).rows[0].n as number,
    };

    const reused = await confirmerDecision(
      h,
      target.guardian.token,
      pairingChallenge,
      {
        personId: target.targetPersonId,
        decision: 'AFFIRM',
        idempotencyKey: `new-operation-${randomUUID()}`,
      }
    );
    expect(reused.statusCode).toBe(404);
    expect(reused.json().code).toBe('BINDING_NOT_FOUND');

    expect(await secondPartyCount(h, attemptId)).toBe(before.confirmations);
    expect(await personAccountId(h, target.targetPersonId)).toBe(before.accountId);
    expect(
      (
        await h.admin.query('SELECT state, committed_account_id FROM binding_attempts WHERE id = $1', [
          attemptId,
        ])
      ).rows[0]
    ).toEqual(before.attempt);
    expect(
      (
        await h.admin.query(
          'SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1',
          [attemptId]
        )
      ).rows[0].n
    ).toBe(before.audit);
  });

  it('H-01 same operation key + rotated challenge is 409 IDEMPOTENCY_PAYLOAD_MISMATCH', async () => {
    const target = await createTarget(h, 'h01_rotated_key', { ageBand: 'UNDER_14' });
    const code = `h01_rotated_key_${randomUUID()}`;

    const boot = await bootstrap(h, target.invitationToken, code, `rot1-${randomUUID()}`);
    const contextA = boot.json().pendingContextToken as string;
    const affirmA = await candidateDecision(h, contextA, 'AFFIRM', `rotc1-${randomUUID()}`, 'candidate-binding-v1');
    const challengeA = affirmA.json().pairingChallenge as string;
    const attempt = await h.admin.query(
      'SELECT id FROM binding_attempts WHERE target_person_id = $1 ORDER BY created_at DESC LIMIT 1',
      [target.targetPersonId]
    );
    const attemptId = attempt.rows[0].id as string;

    // Record operation key K against challenge A; Phase C fails so the attempt
    // stays PENDING and the operation remains the same historical operation.
    const key = `rot-key-${randomUUID()}`;
    injection.failBinding = true;
    const recorded = await confirmerDecision(h, target.guardian.token, challengeA, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: key,
    });
    injection.failBinding = false;
    expect(recorded.statusCode).toBe(500);

    // Rotate to B on the same attempt.
    const boot2 = await bootstrap(h, target.invitationToken, code, `rot2-${randomUUID()}`);
    const contextB = boot2.json().pendingContextToken as string;
    const affirmB = await candidateDecision(h, contextB, 'AFFIRM', `rotc2-${randomUUID()}`, 'candidate-binding-v1');
    const challengeB = affirmB.json().pairingChallenge as string;
    expect(challengeB).not.toBe(challengeA);

    const mismatch = await confirmerDecision(h, target.guardian.token, challengeB, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: key,
    });
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    // B was never consumed by the mismatched operation.
    const state = await h.admin.query('SELECT state FROM binding_attempts WHERE id = $1', [attemptId]);
    expect(state.rows[0].state).toBe('PENDING');
    expect(await secondPartyCount(h, attemptId)).toBe(1);
  });

  it('H-01 two-confirmer race writes exactly one SECOND_PARTY confirmation and commits once', async () => {
    const target = await createTarget(h, 'h01_two_confirmer', { ageBand: 'UNDER_14' });
    const { attemptId, pairingChallenge } = await startBinding(
      h,
      target,
      `h01_two_confirmer_${randomUUID()}`
    );

    const [a, b] = await Promise.all([
      confirmerDecision(h, target.guardian.token, pairingChallenge, {
        personId: target.targetPersonId,
        decision: 'AFFIRM',
        idempotencyKey: `race-a-${randomUUID()}`,
      }),
      confirmerDecision(h, target.guardian.token, pairingChallenge, {
        personId: target.targetPersonId,
        decision: 'AFFIRM',
        idempotencyKey: `race-b-${randomUUID()}`,
      }),
    ]);

    const statuses = [a.statusCode, b.statusCode].sort();
    expect(statuses[0]).toBe(200);
    expect([200, 404]).toContain(statuses[1]);
    expect(await secondPartyCount(h, attemptId)).toBe(1);

    const attempt = await h.admin.query(
      'SELECT state, committed_account_id FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0].state).toBe('COMMITTED');
    expect(attempt.rows[0].committed_account_id).toBeTruthy();
    expect(await personAccountId(h, target.targetPersonId)).toBe(
      attempt.rows[0].committed_account_id
    );

    const committedAudit = await h.admin.query(
      "SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1 AND event_type = 'BINDING_COMMITTED'",
      [attemptId]
    );
    expect(committedAudit.rows[0].n).toBe(1);
  });
});