/**
 * T099 — security audit outcomes: PENDING / COMMITTED / TERMINAL / RETRYABLE
 * are traceable; RETRYABLE is its own operation-level event and never an
 * attempt state; no secret / openid / token / ciphertext is recorded; Phase A
 * blocked outcomes carry no target Person / Family / invitation id.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

const injection = vi.hoisted(() => ({ failPhaseC: false }));

vi.mock('@xiaoshuyin/domain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xiaoshuyin/domain')>();
  return {
    ...actual,
    bindPersonAccountIfUnbound: async (
      tx: Parameters<typeof actual.bindPersonAccountIfUnbound>[0],
      personId: string,
      accountId: string
    ) => {
      if (injection.failPhaseC) throw new Error('simulated infrastructure failure');
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
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('identity binding audit (T099)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  beforeEach(() => {
    injection.failPhaseC = false;
  });

  async function events(attemptId: string) {
    return h.admin.query(
      'SELECT event_type, result, terminal_reason, metadata, target_person_id, target_family_id, invitation_participation_id FROM identity_binding_audit_events WHERE attempt_id = $1 ORDER BY occurred_at',
      [attemptId]
    );
  }

  it('RETRYABLE uses BINDING_OPERATION_RETRYABLE, keeps the attempt PENDING, then converges', async () => {
    const target = await createTarget(h, 'audit_retry', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(h, target, `audit_retry_${randomUUID()}`);

    injection.failPhaseC = true;
    const retryKey = `audit-retry-${randomUUID()}`;
    const failed = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: retryKey,
    });
    expect(failed.statusCode).toBe(500);
    expect(failed.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    });

    const attempt = await h.admin.query(
      'SELECT state, terminal_reason, settled_at FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0]).toMatchObject({
      state: 'PENDING',
      terminal_reason: null,
      settled_at: null,
    });

    const retryable = await h.admin.query(
      `SELECT event_type, result FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_OPERATION_RETRYABLE'`,
      [attemptId]
    );
    expect(retryable.rows).toHaveLength(1);
    expect(retryable.rows[0]).toEqual({
      event_type: 'BINDING_OPERATION_RETRYABLE',
      result: 'RETRYABLE',
    });

    const impersonating = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_TERMINAL' AND result = 'RETRYABLE'`,
      [attemptId]
    );
    expect(impersonating.rows[0].n).toBe(0);

    // The Phase B confirmation survived the technical failure.
    const confirmation = await h.admin.query(
      "SELECT count(*)::int AS n FROM binding_confirmations WHERE attempt_id = $1 AND kind = 'SECOND_PARTY'",
      [attemptId]
    );
    expect(confirmation.rows[0].n).toBe(1);

    injection.failPhaseC = false;
    const retry = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: retryKey,
    });
    expect(retry.json().state).toBe('COMMITTED');
    const committed = await h.admin.query(
      "SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1 AND event_type = 'BINDING_COMMITTED'",
      [attemptId]
    );
    expect(committed.rows[0].n).toBe(1);
  });

  it('PENDING / TERMINAL / COMMITTED outcomes are traceable without secrets', async () => {
    const target = await createTarget(h, 'audit_outcomes', { ageBand: 'UNDER_14' });
    const code = `audit_outcomes_${randomUUID()}`;
    const { attemptId, contextToken } = await startBinding(h, target, code);

    const pendingEvents = await events(attemptId);
    expect(pendingEvents.rows.map((r) => r.event_type)).toContain('BINDING_ATTEMPT_CREATED');

    const reject = await candidateDecision(h, contextToken, 'REJECT', `reject-${randomUUID()}`);
    expect(reject.statusCode).toBe(200);
    const terminalEvents = await events(attemptId);
    expect(terminalEvents.rows.map((r) => r.event_type)).toContain('BINDING_CANDIDATE_REJECTED');

    const allText = JSON.stringify(terminalEvents.rows);
    expect(allText).not.toContain(`fake_${code}`);
    expect(allText).not.toContain(contextToken);
    expect(allText).not.toMatch(/ciphertext|openid_token|bearer/i);
    expect(allText).not.toContain('consent');

    // A committed flow is also traceable exactly once.
    const target2 = await createTarget(h, 'audit_committed', { ageBand: 'UNDER_14' });
    const second = await startBinding(h, target2, `audit_committed_${randomUUID()}`);
    const commit = await confirmerDecision(h, target2.guardian.token, second.attemptId, {
      personId: target2.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(commit.json().state).toBe('COMMITTED');
    const committedEvents = await events(second.attemptId);
    const committed = committedEvents.rows.filter((r) => r.event_type === 'BINDING_COMMITTED');
    expect(committed).toHaveLength(1);
    expect(committed[0].result).toBe('COMMITTED');
  });

  it('Phase A blocked audits carry no target Person / Family / invitation id', async () => {
    const invalid = await createTarget(h, 'audit_invalid', { ageBand: 'UNDER_14' });
    h.port.remove(invalid.invitationToken);
    const res = await bootstrap(h, invalid.invitationToken, `audit_invalid_${randomUUID()}`);
    expect(res.statusCode).toBe(200);

    const blocked = await h.admin.query(
      `SELECT target_person_id, target_family_id, invitation_participation_id
         FROM identity_binding_audit_events
        WHERE event_type = 'BINDING_GATE1_BLOCKED' AND terminal_reason = 'INVITATION_TERMINAL'
        ORDER BY occurred_at DESC LIMIT 1`
    );
    expect(blocked.rows[0]).toEqual({
      target_person_id: null,
      target_family_id: null,
      invitation_participation_id: null,
    });
  });
});