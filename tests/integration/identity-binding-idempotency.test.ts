/**
 * T106 — integration idempotency matrix: same key same payload, different
 * payload, concurrent same key, different key same semantic operation, settled
 * / PENDING / TERMINAL replay, and transport-context replay without duplicate
 * business facts.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';

// Controlled infrastructure failure for the RETRYABLE retry / read-back row.
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

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('integration idempotency matrix (T106)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    injection.failBinding = false;
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

  // ── M-01 Case A: old TERMINAL operation key, later new attempt ──
  it('old TERMINAL key replay resolves its original attempt, never the later one', async () => {
    const target = await createTarget(h, 'idem_old_terminal', { ageBand: 'UNDER_14' });
    const code = `idem_old_terminal_${randomUUID()}`;
    const oldKey = `old-${randomUUID()}`;

    const first = await bootstrap(h, target.invitationToken, code, oldKey);
    const firstToken = first.json().pendingContextToken as string;
    const attemptA = await h.admin.query(
      'SELECT id FROM binding_attempts WHERE target_person_id = $1 ORDER BY created_at LIMIT 1',
      [target.targetPersonId]
    );
    const attemptAId = attemptA.rows[0].id as string;

    // The operation key must be bound to the authoritative attempt it created.
    const bound = await h.admin.query(
      `SELECT attempt_id FROM binding_operation_keys
        WHERE command_type = 'BOOTSTRAP' AND idempotency_key = $1
          AND scope_key = (SELECT scope_key FROM binding_operation_keys
                            WHERE command_type = 'BOOTSTRAP' AND idempotency_key = $1 LIMIT 1)`,
      [oldKey]
    );
    expect(bound.rows).toHaveLength(1);
    expect(bound.rows[0].attempt_id).toBe(attemptAId);

    // A TERMINAL attempt never blocks a new attempt for a *new* operation key.
    const reject = await candidateDecision(h, firstToken, 'REJECT', `rej-${randomUUID()}`);
    expect(reject.statusCode).toBe(200);
    const settledA = await h.admin.query(
      'SELECT state, terminal_reason FROM binding_attempts WHERE id = $1',
      [attemptAId]
    );
    expect(settledA.rows[0]).toEqual({ state: 'TERMINAL', terminal_reason: 'CANDIDATE_REJECTED' });

    const newKey = `new-${randomUUID()}`;
    const second = await bootstrap(h, target.invitationToken, code, newKey);
    expect(second.statusCode).toBe(200);
    expect(second.json().binding).toBe('NOT_COMPLETED');
    const attemptB = await h.admin.query(
      `SELECT id, state FROM binding_attempts
        WHERE target_person_id = $1 AND id <> $2
        ORDER BY created_at DESC LIMIT 1`,
      [target.targetPersonId, attemptAId]
    );
    expect(attemptB.rows).toHaveLength(1);
    const attemptBId = attemptB.rows[0].id as string;
    expect(attemptB.rows[0].state).toBe('PENDING');

    // Exact replay of the OLD key must resolve A (TERMINAL), not B (PENDING).
    const replay = await bootstrap(h, target.invitationToken, code, oldKey);
    expect(replay.statusCode).toBe(200);
    expect(replay.json().binding).toBe('NOT_COMPLETED');
    const replayToken = replay.json().pendingContextToken as string;

    const replayContext = await h.admin.query(
      'SELECT attempt_id FROM binding_pending_contexts WHERE token_hash = $1',
      [tokenHash(replayToken)]
    );
    expect(replayContext.rows).toHaveLength(1);
    expect(replayContext.rows[0].attempt_id).toBe(attemptAId);

    // A candidate action through the replayed transport context must act on A.
    await candidateDecision(h, replayToken, 'AFFIRM', `reaff-${randomUUID()}`, 'candidate-binding-v1');
    const confirmationOnA = await h.admin.query(
      "SELECT count(*)::int AS n FROM binding_confirmations WHERE attempt_id = $1 AND kind = 'CANDIDATE'",
      [attemptAId]
    );
    const confirmationOnB = await h.admin.query(
      "SELECT count(*)::int AS n FROM binding_confirmations WHERE attempt_id = $1 AND kind = 'CANDIDATE'",
      [attemptBId]
    );
    expect(confirmationOnA.rows[0].n).toBe(0);
    expect(confirmationOnB.rows[0].n).toBe(0);

    // Replay never creates a third attempt, a confirmation, a commit or a session.
    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(2);
    expect(await personAccountId(h, target.targetPersonId)).toBeNull();
    const keys = await h.admin.query(
      "SELECT count(*)::int AS n FROM binding_operation_keys WHERE command_type = 'BOOTSTRAP' AND idempotency_key = $1",
      [oldKey]
    );
    expect(keys.rows[0].n).toBe(1);
  });

  // ── M-01 Case B: COMMITTED operation key after invitation became terminal ──
  it('COMMITTED key still replays {binding:"COMMITTED"} after the invitation is terminal', async () => {
    const target = await createTarget(h, 'idem_committed_terminal', { ageBand: 'UNDER_14' });
    const code = `idem_committed_terminal_${randomUUID()}`;
    const key = `committed-${randomUUID()}`;

    const first = await bootstrap(h, target.invitationToken, code, key);
    const token = first.json().pendingContextToken as string;
    const attempt = await h.admin.query(
      'SELECT id FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    const attemptId = attempt.rows[0].id as string;

    await candidateDecision(h, token, 'AFFIRM', `cand-${randomUUID()}`, 'candidate-binding-v1');
    const commit = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: `sp-${randomUUID()}`,
    });
    expect(commit.statusCode).toBe(200);
    expect(commit.json().state).toBe('COMMITTED');
    const accountId = await personAccountId(h, target.targetPersonId);
    expect(accountId).toBeTruthy();

    // Slice 4 invitation becomes unusable after the binding is settled.
    h.port.remove(target.invitationToken);

    const replay = await bootstrap(h, target.invitationToken, code, key);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ binding: 'COMMITTED' });
    expect(replay.json()).not.toHaveProperty('pendingContextToken');

    // No second operation key, attempt, confirmation, commit, audit or session.
    const keys = await h.admin.query(
      "SELECT count(*)::int AS n FROM binding_operation_keys WHERE command_type = 'BOOTSTRAP' AND idempotency_key = $1",
      [key]
    );
    expect(keys.rows[0].n).toBe(1);
    const bound = await h.admin.query(
      `SELECT attempt_id FROM binding_operation_keys
        WHERE command_type = 'BOOTSTRAP' AND idempotency_key = $1`,
      [key]
    );
    expect(bound.rows[0].attempt_id).toBe(attemptId);

    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(1);
    const committedAudit = await h.admin.query(
      "SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1 AND event_type = 'BINDING_COMMITTED'",
      [attemptId]
    );
    expect(committedAudit.rows[0].n).toBe(1);
    const targetAfter = await h.admin.query(
      'SELECT account_id FROM persons WHERE id = $1',
      [target.targetPersonId]
    );
    expect(targetAfter.rows[0].account_id).toBe(accountId);
  });

  it('TERMINAL key replay returns the historical outcome without side effects', async () => {
    const target = await createTarget(h, 'idem_terminal_replay', { ageBand: 'UNDER_14' });
    const code = `idem_terminal_replay_${randomUUID()}`;
    const key = `terminal-${randomUUID()}`;

    const first = await bootstrap(h, target.invitationToken, code, key);
    const token = first.json().pendingContextToken as string;
    const attempt = await h.admin.query(
      'SELECT id FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    const attemptId = attempt.rows[0].id as string;
    await candidateDecision(h, token, 'REJECT', `rej-${randomUUID()}`);

    const auditBefore = await h.admin.query(
      'SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1',
      [attemptId]
    );

    const replay = await bootstrap(h, target.invitationToken, code, key);
    expect(replay.statusCode).toBe(200);
    expect(replay.json().binding).toBe('NOT_COMPLETED');
    expect(replay.json()).not.toHaveProperty('attemptId');
    expect(replay.json()).not.toHaveProperty('reason');

    const state = await h.admin.query(
      'SELECT state, terminal_reason FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(state.rows[0]).toEqual({ state: 'TERMINAL', terminal_reason: 'CANDIDATE_REJECTED' });
    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(1);
    const auditAfter = await h.admin.query(
      'SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1',
      [attemptId]
    );
    expect(auditAfter.rows[0].n).toBe(auditBefore.rows[0].n);
  });

  it('RETRYABLE retry / read-back converges to one commit; no frozen RETRYABLE result', async () => {
    const target = await createTarget(h, 'idem_retryable', { ageBand: 'UNDER_14' });
    const code = `idem_retryable_${randomUUID()}`;
    const { attemptId } = await startBinding(h, target, code);

    injection.failBinding = true;
    const failed = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: `retry-a-${randomUUID()}`,
    });
    injection.failBinding = false;
    expect(failed.statusCode).toBe(500);
    expect(failed.json().code).toBe('INTERNAL_ERROR');

    const pending = await h.admin.query(
      'SELECT state FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(pending.rows[0].state).toBe('PENDING');

    const retry = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: `retry-b-${randomUUID()}`,
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().state).toBe('COMMITTED');

    // Read-back stays COMMITTED and never returns RETRYABLE again.
    const readBack = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: `retry-c-${randomUUID()}`,
    });
    expect(readBack.statusCode).toBe(200);
    expect(readBack.json().state).toBe('COMMITTED');

    const committed = await h.admin.query(
      "SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1 AND state = 'COMMITTED'",
      [target.targetPersonId]
    );
    expect(committed.rows[0].n).toBe(1);
    const commitAudit = await h.admin.query(
      "SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1 AND event_type = 'BINDING_COMMITTED'",
      [attemptId]
    );
    expect(commitAudit.rows[0].n).toBe(1);
    const retryableAudit = await h.admin.query(
      "SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1 AND event_type = 'BINDING_OPERATION_RETRYABLE'",
      [attemptId]
    );
    expect(retryableAudit.rows[0].n).toBeGreaterThanOrEqual(1);
    const confirmations = await h.admin.query(
      "SELECT count(*)::int AS n FROM binding_confirmations WHERE attempt_id = $1 AND kind = 'SECOND_PARTY'",
      [attemptId]
    );
    expect(confirmations.rows[0].n).toBe(1);
  });
});