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
  createAppPool,
  createTarget,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { commitAttempt } from '../../apps/server/api/src/identity-binding/commit.js';

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

  it('M-04: Phase C expiry uses one settlement for state, audit and cleanup', async () => {
    const target = await createTarget(h, 'settle_m04', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(h, target, `settle_m04_${randomUUID()}`);

    await h.admin.query(
      `INSERT INTO binding_confirmations
         (attempt_id, kind, actor_account_id, actor_person_id, authority,
          target_confirmed, candidate_recognized, statement_version)
       VALUES ($1, 'SECOND_PARTY', $2, $3, 'GUARDIAN', true, true,
               'second-party-recognition-v1')`,
      [attemptId, target.guardian.accountId, target.guardian.personId]
    );
    await h.admin.query(
      `UPDATE binding_attempts
          SET created_at = now() - interval '2 hours',
              expires_at = now() - interval '1 second'
        WHERE id = $1`,
      [attemptId]
    );

    const pool = createAppPool(1);
    try {
      const outcome = await commitAttempt(
        {
          pool,
          invitationPort: h.port,
          identityBindingSecret: process.env['IDENTITY_BINDING_SECRET']!,
        },
        {
          attemptId,
          targetPersonId: target.targetPersonId,
          targetFamilyId: target.familyId,
          actorAccountId: target.guardian.accountId,
        }
      );
      expect(outcome).toMatchObject({ outcome: 'TERMINAL', reason: 'ATTEMPT_EXPIRED' });
    } finally {
      await pool.end();
    }

    expect(await auditCount(attemptId, 'BINDING_TERMINAL')).toBe(1);
    const secrets = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_pending_contexts
        WHERE attempt_id = $1
          AND (openid_ciphertext IS NOT NULL OR openid_nonce IS NOT NULL OR openid_tag IS NOT NULL)`,
      [attemptId]
    );
    expect(secrets.rows[0].n).toBe(0);
    const binding = await h.admin.query(
      'SELECT account_id FROM persons WHERE id = $1',
      [target.targetPersonId]
    );
    expect(binding.rows[0].account_id).toBeNull();
  });
});