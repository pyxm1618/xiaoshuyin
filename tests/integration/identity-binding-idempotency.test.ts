/**
 * T106 — integration idempotency matrix: same key same payload, different
 * payload, concurrent same key, different key same semantic operation, settled
 * / PENDING / TERMINAL replay, and transport-context replay without duplicate
 * business facts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  bootstrap,
  buildBindingApp,
  candidateDecision,
  createTarget,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('integration idempotency matrix (T106)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('same key + same payload is replay; different payload is 409', async () => {
    const target = await createTarget(h, 'idem_cand', { ageBand: 'UNDER_14' });
    const { contextToken, attemptId } = await startBinding(
      h,
      target,
      `idem_cand_${randomUUID()}`
    );
    const key = `idem-${randomUUID()}`;

    const first = await candidateDecision(h, contextToken, 'AFFIRM', key, 'candidate-binding-v1');
    expect(first.statusCode).toBe(200);
    const replay = await candidateDecision(h, contextToken, 'AFFIRM', key, 'candidate-binding-v1');
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ binding: 'NOT_COMPLETED' });

    const confirmations = await h.admin.query(
      "SELECT count(*)::int AS n FROM binding_confirmations WHERE attempt_id = $1 AND kind = 'CANDIDATE'",
      [attemptId]
    );
    expect(confirmations.rows[0].n).toBe(1);

    const mismatch = await candidateDecision(h, contextToken, 'REJECT', key);
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json()).toEqual({
      code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
      message: 'Idempotency payload mismatch',
    });

    const attempt = await h.admin.query('SELECT state FROM binding_attempts WHERE id = $1', [
      attemptId,
    ]);
    expect(attempt.rows[0].state).toBe('PENDING');
  });

  it('concurrent same-key candidate decisions produce one confirmation', async () => {
    const target = await createTarget(h, 'idem_conc', { ageBand: 'UNDER_14' });
    const { contextToken, attemptId } = await startBinding(
      h,
      target,
      `idem_conc_${randomUUID()}`
    );
    const key = `idem-conc-${randomUUID()}`;

    const [a, b] = await Promise.all([
      candidateDecision(h, contextToken, 'AFFIRM', key, 'candidate-binding-v1'),
      candidateDecision(h, contextToken, 'AFFIRM', key, 'candidate-binding-v1'),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);

    const confirmations = await h.admin.query(
      "SELECT count(*)::int AS n FROM binding_confirmations WHERE attempt_id = $1 AND kind = 'CANDIDATE'",
      [attemptId]
    );
    expect(confirmations.rows[0].n).toBe(1);
  });

  it('different key + same semantic operation converges on the same live attempt', async () => {
    const target = await createTarget(h, 'idem_semantic', { ageBand: 'UNDER_14' });
    const code = `idem_semantic_${randomUUID()}`;
    const first = await bootstrap(h, target.invitationToken, code, `k1-${randomUUID()}`);
    const second = await bootstrap(h, target.invitationToken, code, `k2-${randomUUID()}`);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json().binding).toBe('NOT_COMPLETED');
    expect(second.json().pendingContextToken).not.toBe(first.json().pendingContextToken);

    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(1);
  });

  it('concurrent same-key bootstrap creates one attempt and one operation key', async () => {
    const target = await createTarget(h, 'idem_boot_conc', { ageBand: 'UNDER_14' });
    const code = `idem_boot_conc_${randomUUID()}`;
    const key = `idem-boot-${randomUUID()}`;

    const [a, b] = await Promise.all([
      bootstrap(h, target.invitationToken, code, key),
      bootstrap(h, target.invitationToken, code, key),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);

    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(1);
    const keys = await h.admin.query(
      "SELECT count(*)::int AS n FROM binding_operation_keys WHERE command_type = 'BOOTSTRAP' AND idempotency_key = $1",
      [key]
    );
    expect(keys.rows[0].n).toBe(1);
  });

  it('PENDING replay links a new transport context to the same attempt', async () => {
    const target = await createTarget(h, 'idem_pending', { ageBand: 'UNDER_14' });
    const code = `idem_pending_${randomUUID()}`;
    const key = `idem-pending-${randomUUID()}`;

    const first = await bootstrap(h, target.invitationToken, code, key);
    const token1 = first.json().pendingContextToken as string;
    const second = await bootstrap(h, target.invitationToken, code, key);
    const token2 = second.json().pendingContextToken as string;
    expect(token2).not.toBe(token1);
    expect(second.json().binding).toBe('NOT_COMPLETED');

    const contexts = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_pending_contexts
        WHERE attempt_id IS NOT NULL
          AND candidate_identity_digest = (SELECT candidate_identity_digest FROM binding_attempts WHERE target_person_id = $1)`,
      [target.targetPersonId]
    );
    expect(contexts.rows[0].n).toBe(2);

    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(1);
  });
});