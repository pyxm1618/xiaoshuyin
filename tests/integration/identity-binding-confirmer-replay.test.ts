/**
 * MEDIUM-01 — exact confirmer operation replay must NEVER re-run the mutable
 * current second-party authority check.
 *
 * The operation key permanently binds the authoritative historical attempt.
 * A later guardian / manager / membership change therefore cannot turn an exact
 * replay into 404. Settled attempts return their historical outcome; a PENDING
 * attempt resumes the authoritative Phase C path where Gate 2 re-evaluates
 * current state.
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
  buildBindingApp,
  confirmerDecision,
  createTarget,
  personAccountId,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { revokeConsent } from '../setup/api.js';

async function revokeGuardianAuthority(
  h: BindingHarness,
  targetPersonId: string,
  replacementGuardianPersonId: string
): Promise<void> {
  await h.admin.query(
    'UPDATE person_compliance_profiles SET guardian_person_id = $1 WHERE person_id = $2',
    [replacementGuardianPersonId, targetPersonId]
  );
}

async function mutationSnapshot(h: BindingHarness, attemptId: string, personId: string) {
  const attempt = await h.admin.query(
    'SELECT state, terminal_reason, committed_account_id FROM binding_attempts WHERE id = $1',
    [attemptId]
  );
  const confirmations = await h.admin.query(
    'SELECT count(*)::int AS n FROM binding_confirmations WHERE attempt_id = $1',
    [attemptId]
  );
  const audit = await h.admin.query(
    'SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1',
    [attemptId]
  );
  const person = await h.admin.query('SELECT account_id FROM persons WHERE id = $1', [personId]);
  return {
    attempt: attempt.rows[0],
    confirmations: confirmations.rows[0].n as number,
    audit: audit.rows[0].n as number,
    accountId: person.rows[0].account_id as string | null,
  };
}

describe('confirmer exact replay never re-runs current authority (MEDIUM-01)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    injection.failBinding = false;
    await h.close();
  });

  it('Case A: a COMMITTED operation replays its historical outcome after the confirmer is revoked', async () => {
    const target = await createTarget(h, 'replay_committed', { ageBand: 'UNDER_14' });
    const alt = await createTarget(h, 'replay_committed_alt', { ageBand: 'UNDER_14' });
    const { attemptId, pairingChallenge } = await startBinding(
      h,
      target,
      `replay_committed_${randomUUID()}`
    );
    const key = `sp-committed-${randomUUID()}`;

    const first = await confirmerDecision(h, target.guardian.token, pairingChallenge, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: key,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().state).toBe('COMMITTED');

    const before = await mutationSnapshot(h, attemptId, target.targetPersonId);
    expect(before.attempt.state).toBe('COMMITTED');
    expect(before.accountId).toBeTruthy();

    // The current guardian authority is revoked AFTER the historical decision.
    await revokeGuardianAuthority(h, target.targetPersonId, alt.guardian.personId);

    const replay = await confirmerDecision(h, target.guardian.token, pairingChallenge, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: key,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().state).toBe('COMMITTED');

    const after = await mutationSnapshot(h, attemptId, target.targetPersonId);
    expect(after).toEqual(before);
    expect(after.confirmations).toBe(2);
    expect(await personAccountId(h, target.targetPersonId)).toBe(before.accountId);
  });

  it('Case B: a TERMINAL operation replays its historical outcome after the confirmer is revoked', async () => {
    const target = await createTarget(h, 'replay_terminal', { ageBand: 'UNDER_14' });
    const alt = await createTarget(h, 'replay_terminal_alt', { ageBand: 'UNDER_14' });
    const { attemptId, pairingChallenge } = await startBinding(
      h,
      target,
      `replay_terminal_${randomUUID()}`
    );
    const key = `sp-terminal-${randomUUID()}`;

    const first = await confirmerDecision(h, target.guardian.token, pairingChallenge, {
      personId: target.targetPersonId,
      decision: 'REJECT',
      idempotencyKey: key,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().state).toBe('TERMINAL');

    const before = await mutationSnapshot(h, attemptId, target.targetPersonId);
    expect(before.attempt.state).toBe('TERMINAL');

    await revokeGuardianAuthority(h, target.targetPersonId, alt.guardian.personId);

    const replay = await confirmerDecision(h, target.guardian.token, pairingChallenge, {
      personId: target.targetPersonId,
      decision: 'REJECT',
      idempotencyKey: key,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().state).toBe('TERMINAL');

    const after = await mutationSnapshot(h, attemptId, target.targetPersonId);
    expect(after).toEqual(before);
    expect(after.accountId).toBeNull();
  });

  it('Case C: a PENDING operation resumes Phase C after authority / consent invalidation', async () => {
    const target = await createTarget(h, 'replay_pending', { ageBand: 'UNDER_14' });
    const { attemptId, pairingChallenge } = await startBinding(
      h,
      target,
      `replay_pending_${randomUUID()}`
    );
    const key = `sp-pending-${randomUUID()}`;
    expect(target.consentId).toBeTruthy();

    // Phase B (second-party affirmative) succeeds; Phase C hits an
    // infrastructure failure, so the attempt stays PENDING and the operation
    // remains retryable.
    injection.failBinding = true;
    const first = await confirmerDecision(h, target.guardian.token, pairingChallenge, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: key,
    });
    injection.failBinding = false;
    expect(first.statusCode).toBe(500);
    const pending = await h.admin.query(
      'SELECT state FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(pending.rows[0].state).toBe('PENDING');

    // Current consent is invalidated after the historical affirmative. The
    // replay must NOT be cut off as 404 by stale confirmer authority; it must
    // reach Gate 2 and settle with the authoritative reason.
    const revoke = await revokeConsent(
      h.app,
      target.guardian.token,
      'replay_pending',
      target.consentId!
    );
    expect([200, 201]).toContain(revoke.statusCode);

    const replay = await confirmerDecision(h, target.guardian.token, pairingChallenge, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: key,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().state).toBe('TERMINAL');

    const after = await mutationSnapshot(h, attemptId, target.targetPersonId);
    expect(after.attempt).toMatchObject({
      state: 'TERMINAL',
      terminal_reason: 'GUARDIAN_CONSENT_INVALID',
      committed_account_id: null,
    });
    // Exactly one SECOND_PARTY confirmation; no second one from the replay.
    expect(after.confirmations).toBe(2);
    expect(after.accountId).toBeNull();

    const terminalAudit = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_TERMINAL'
          AND terminal_reason = 'GUARDIAN_CONSENT_INVALID'`,
      [attemptId]
    );
    expect(terminalAudit.rows[0].n).toBe(1);
    const committedAudit = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_COMMITTED'`,
      [attemptId]
    );
    expect(committedAudit.rows[0].n).toBe(0);

    const contexts = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_pending_contexts
        WHERE attempt_id = $1
          AND (openid_ciphertext IS NOT NULL OR openid_nonce IS NOT NULL OR openid_tag IS NOT NULL)`,
      [attemptId]
    );
    expect(contexts.rows[0].n).toBe(0);
  });

  it('same operation key + different payload is still 409 IDEMPOTENCY_PAYLOAD_MISMATCH', async () => {
    const target = await createTarget(h, 'replay_mismatch', { ageBand: 'UNDER_14' });
    const { attemptId, pairingChallenge } = await startBinding(
      h,
      target,
      `replay_mismatch_${randomUUID()}`
    );
    const key = `sp-mismatch-${randomUUID()}`;

    const first = await confirmerDecision(h, target.guardian.token, pairingChallenge, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: key,
    });
    expect(first.statusCode).toBe(200);
    const before = await mutationSnapshot(h, attemptId, target.targetPersonId);

    const mismatch = await confirmerDecision(h, target.guardian.token, pairingChallenge, {
      personId: target.targetPersonId,
      decision: 'REJECT',
      idempotencyKey: key,
    });
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    expect(await mutationSnapshot(h, attemptId, target.targetPersonId)).toEqual(before);
  });
});