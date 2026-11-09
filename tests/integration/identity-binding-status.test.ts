/**
 * T061 — candidate status: binary result only, generic before COMMITTED,
 * no attemptId / reason / person / age field, expired attempt materialized.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  bootstrap,
  buildBindingApp,
  candidateDecision,
  candidateStatus,
  confirmerDecision,
  createTarget,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('candidate status (T061)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('PENDING / no attempt / terminal are all indistinguishable generic', async () => {
    const pending = await createTarget(h, 'status_pending', { ageBand: 'UNDER_14' });
    const { contextToken } = await startBinding(h, pending, `status_pending_${randomUUID()}`);

    const noAttempt = await createTarget(h, 'status_none', { ageBand: 'ADULT' });
    const boot = await bootstrap(h, noAttempt.invitationToken, `status_none_${randomUUID()}`);
    const noAttemptToken = boot.json().pendingContextToken as string;

    const terminal = await createTarget(h, 'status_terminal', { ageBand: 'UNDER_14' });
    const bootT = await bootstrap(h, terminal.invitationToken, `status_term_${randomUUID()}`);
    const terminalToken = bootT.json().pendingContextToken as string;

    for (const token of [contextToken, noAttemptToken, terminalToken]) {
      const res = await candidateStatus(h, token);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ binding: 'NOT_COMPLETED' });
      expect(Object.keys(res.json())).toEqual(['binding']);
    }
  });

  it('COMMITTED is the only distinguishable success', async () => {
    const target = await createTarget(h, 'status_committed', { ageBand: 'UNDER_14' });
    const { contextToken, attemptId } = await startBinding(
      h,
      target,
      `status_committed_${randomUUID()}`
    );
    const commit = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(commit.json().state).toBe('COMMITTED');

    const res = await candidateStatus(h, contextToken);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ binding: 'COMMITTED' });
    expect(res.json()).not.toHaveProperty('attemptId');
    expect(res.json()).not.toHaveProperty('reason');
  });

  it('expired attempt materializes TERMINAL and stays generic', async () => {
    const target = await createTarget(h, 'status_expired', { ageBand: 'UNDER_14' });
    const { contextToken, attemptId } = await startBinding(
      h,
      target,
      `status_expired_${randomUUID()}`
    );
    await h.admin.query(
      `UPDATE binding_attempts
          SET created_at = now() - interval '2 hours',
              expires_at = now() - interval '1 second'
        WHERE id = $1`,
      [attemptId]
    );

    const res = await candidateStatus(h, contextToken);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ binding: 'NOT_COMPLETED' });

    const attempt = await h.admin.query(
      'SELECT state, terminal_reason FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0]).toEqual({
      state: 'TERMINAL',
      terminal_reason: 'ATTEMPT_EXPIRED',
    });
    const audit = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_TERMINAL'
          AND terminal_reason = 'ATTEMPT_EXPIRED'`,
      [attemptId]
    );
    expect(audit.rows[0].n).toBe(1);
  });

  it('M-03: status expiry settles once and scrubs every attempt context', async () => {
    const target = await createTarget(h, 'status_m03', { ageBand: 'UNDER_14' });
    const code = `status_m03_${randomUUID()}`;
    const first = await bootstrap(h, target.invitationToken, code, `m03-a-${randomUUID()}`);
    const contextToken = first.json().pendingContextToken as string;
    const decision = await candidateDecision(
      h,
      contextToken,
      'AFFIRM',
      `m03-affirm-${randomUUID()}`,
      'candidate-binding-v1'
    );
    expect(decision.statusCode).toBe(200);

    const second = await bootstrap(h, target.invitationToken, code, `m03-b-${randomUUID()}`);
    expect(second.statusCode).toBe(200);

    const attemptRow = await h.admin.query(
      'SELECT id FROM binding_attempts WHERE target_person_id = $1 ORDER BY created_at DESC LIMIT 1',
      [target.targetPersonId]
    );
    const attemptId = attemptRow.rows[0].id as string;
    const contextCount = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_pending_contexts WHERE attempt_id = $1',
      [attemptId]
    );
    expect(contextCount.rows[0].n).toBeGreaterThanOrEqual(2);

    await h.admin.query(
      `UPDATE binding_attempts
          SET created_at = now() - interval '2 hours',
              expires_at = now() - interval '1 second'
        WHERE id = $1`,
      [attemptId]
    );

    const res = await candidateStatus(h, contextToken);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ binding: 'NOT_COMPLETED' });

    const secrets = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_pending_contexts
        WHERE attempt_id = $1
          AND (openid_ciphertext IS NOT NULL OR openid_nonce IS NOT NULL OR openid_tag IS NOT NULL)`,
      [attemptId]
    );
    expect(secrets.rows[0].n).toBe(0);

    const audit = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_TERMINAL'
          AND terminal_reason = 'ATTEMPT_EXPIRED'`,
      [attemptId]
    );
    expect(audit.rows[0].n).toBe(1);
    const binding = await h.admin.query(
      'SELECT account_id FROM persons WHERE id = $1',
      [target.targetPersonId]
    );
    expect(binding.rows[0].account_id).toBeNull();
  });
});