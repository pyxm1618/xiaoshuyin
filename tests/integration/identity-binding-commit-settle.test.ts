/**
 * T079 — attempt settlement and audit: COMMITTED / TERMINAL exactly once,
 * settled replay does not rewrite or duplicate, ciphertext is cleared.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  buildBindingApp,
  candidateDecision,
  confirmerDecision,
  createTarget,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('attempt settle + audit (T079)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  async function auditCount(attemptId: string, eventType: string): Promise<number> {
    const res = await h.admin.query(
      'SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1 AND event_type = $2',
      [attemptId, eventType]
    );
    return res.rows[0].n;
  }

  it('COMMITTED settles once and replay does not duplicate the business audit', async () => {
    const target = await createTarget(h, 'settle_ok', { ageBand: 'UNDER_14' });
    const { attemptId, contextToken } = await startBinding(
      h,
      target,
      `settle_ok_${randomUUID()}`
    );
    const key = `settle-sp-${randomUUID()}`;

    const first = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: key,
    });
    expect(first.json().state).toBe('COMMITTED');

    const attempt = await h.admin.query(
      'SELECT state, committed_account_id, terminal_reason, settled_at FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0].state).toBe('COMMITTED');
    expect(attempt.rows[0].committed_account_id).toBeTruthy();
    expect(attempt.rows[0].terminal_reason).toBeNull();
    expect(attempt.rows[0].settled_at).not.toBeNull();

    expect(await auditCount(attemptId, 'BINDING_COMMITTED')).toBe(1);
    expect(await auditCount(attemptId, 'BINDING_SECOND_PARTY_CONFIRMED')).toBe(1);

    const replay = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: key,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().state).toBe('COMMITTED');
    expect(await auditCount(attemptId, 'BINDING_COMMITTED')).toBe(1);
    expect(await auditCount(attemptId, 'BINDING_SECOND_PARTY_CONFIRMED')).toBe(1);

    const context = await h.admin.query(
      'SELECT openid_ciphertext, openid_nonce, openid_tag, committed_account_id FROM binding_pending_contexts WHERE attempt_id = $1',
      [attemptId]
    );
    expect(context.rows[0].openid_ciphertext).toBeNull();
    expect(context.rows[0].openid_nonce).toBeNull();
    expect(context.rows[0].openid_tag).toBeNull();
    expect(context.rows[0].committed_account_id).toBe(attempt.rows[0].committed_account_id);
    expect(contextToken.length).toBeGreaterThan(0);
  });

  it('candidate REJECT settles TERMINAL exactly once and clears ciphertext', async () => {
    const target = await createTarget(h, 'settle_term', { ageBand: 'UNDER_14' });
    const { attemptId, contextToken } = await startBinding(
      h,
      target,
      `settle_term_${randomUUID()}`
    );
    const key = `settle-reject-${randomUUID()}`;

    const reject = await candidateDecision(h, contextToken, 'REJECT', key);
    expect(reject.statusCode).toBe(200);

    const attempt = await h.admin.query(
      'SELECT state, terminal_reason, settled_at, committed_account_id FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0]).toMatchObject({
      state: 'TERMINAL',
      terminal_reason: 'CANDIDATE_REJECTED',
      committed_account_id: null,
    });
    expect(attempt.rows[0].settled_at).not.toBeNull();
    expect(await auditCount(attemptId, 'BINDING_CANDIDATE_REJECTED')).toBe(1);

    const replay = await candidateDecision(h, contextToken, 'REJECT', key);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ binding: 'NOT_COMPLETED' });
    expect(await auditCount(attemptId, 'BINDING_CANDIDATE_REJECTED')).toBe(1);

    const context = await h.admin.query(
      'SELECT openid_ciphertext FROM binding_pending_contexts WHERE attempt_id = $1',
      [attemptId]
    );
    expect(context.rows[0].openid_ciphertext).toBeNull();
  });
});