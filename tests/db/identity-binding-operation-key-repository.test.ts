/**
 * Operation-level idempotency evidence.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  buildBindingApp,
  createTarget,
  bootstrap,
  candidateDecision,
  createAppPool,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';
import {
  mapAttempt,
  setScope,
} from '../../apps/server/api/src/identity-binding/operation-key-repository.js';

describe('binding operation keys', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('same key + same payload replays without a second attempt', async () => {
    const target = await createTarget(h, 'op_same', { ageBand: 'UNDER_14' });
    const code = `op_same_${Date.now()}`;
    const key = `same-${Date.now()}`;
    const first = await bootstrap(h, target.invitationToken, code, key);
    const second = await bootstrap(h, target.invitationToken, code, key);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);

    const { rows } = await h.admin.query(
      `SELECT count(*)::int AS cnt FROM binding_attempts WHERE target_person_id = $1`,
      [target.targetPersonId]
    );
    expect(rows[0].cnt).toBe(1);
    const keys = await h.admin.query(
      `SELECT count(*)::int AS cnt FROM binding_operation_keys
       WHERE command_type = 'BOOTSTRAP' AND idempotency_key = $1`,
      [key]
    );
    expect(keys.rows[0].cnt).toBe(1);
  });

  it('bootstrap scope is the frozen (invitation, identity) pair', async () => {
    const target = await createTarget(h, 'op_diff', { ageBand: 'UNDER_14' });
    const key = `diff-${Date.now()}`;
    const code = `op_diff_${Date.now()}`;
    expect((await bootstrap(h, target.invitationToken, code, key)).statusCode).toBe(200);

    // A different invitation/identity is a different operation scope, not a
    // payload mismatch. Same-key payload mismatch is reachable on the
    // candidate / confirmer commands (asserted below).
    const other = await bootstrap(h, 'another-invitation-token', `${code}_other`, key);
    expect(other.statusCode).toBe(200);
    expect(other.json().binding).toBe('NOT_COMPLETED');
  });

  it('concurrent same-key bootstrap produces one attempt', async () => {
    const target = await createTarget(h, 'op_conc', { ageBand: 'UNDER_14' });
    const code = `op_conc_${Date.now()}`;
    const key = `conc-${Date.now()}`;
    const [a, b] = await Promise.all([
      bootstrap(h, target.invitationToken, code, key),
      bootstrap(h, target.invitationToken, code, key),
    ]);
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    const { rows } = await h.admin.query(
      'SELECT count(*)::int AS cnt FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(rows[0].cnt).toBe(1);
  });

  it('candidate decision same key vs different payload', async () => {
    const target = await createTarget(h, 'op_dec', { ageBand: 'UNDER_14' });
    const { contextToken } = await startBinding(h, target, `op_dec_${Date.now()}`);
    const key = `decision-${Date.now()}`;

    const first = await candidateDecision(h, contextToken, 'AFFIRM', key, 'candidate-binding-v1');
    expect(first.statusCode).toBe(200);
    const replay = await candidateDecision(h, contextToken, 'AFFIRM', key, 'candidate-binding-v1');
    expect(replay.statusCode).toBe(200);
    const mismatch = await candidateDecision(h, contextToken, 'REJECT', key);
    expect(mismatch.statusCode).toBe(409);

    const { rows } = await h.admin.query(
      `SELECT count(*)::int AS cnt FROM binding_confirmations
       WHERE attempt_id = (SELECT id FROM binding_attempts WHERE target_person_id = $1 LIMIT 1)
         AND kind = 'CANDIDATE'`,
      [target.targetPersonId]
    );
    expect(rows[0].cnt).toBe(1);
  });

  it('different key + same semantic operation converges to one live attempt', async () => {
    const target = await createTarget(h, 'op_sem', { ageBand: 'UNDER_14' });
    const code = `op_sem_${Date.now()}`;
    await bootstrap(h, target.invitationToken, code, `k1-${Date.now()}`);
    await bootstrap(h, target.invitationToken, code, `k2-${Date.now()}`);
    const { rows } = await h.admin.query(
      `SELECT count(*)::int AS cnt FROM binding_attempts
       WHERE target_person_id = $1 AND state = 'PENDING'`,
      [target.targetPersonId]
    );
    expect(rows[0].cnt).toBe(1);
  });

  it('does not store response body / status', async () => {
    const { rows } = await h.admin.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'binding_operation_keys'`
    );
    const columns = rows.map((r) => r.column_name);
    expect(columns).not.toContain('response_body');
    expect(columns).not.toContain('response_status');
    expect(columns).toEqual(
      expect.arrayContaining(['scope_kind', 'scope_key', 'command_type', 'idempotency_key', 'request_hash', 'attempt_id'])
    );
  });

  it('mapAttempt binds once, is idempotent, and never re-points', async () => {
    const target = await createTarget(h, 'op_map', { ageBand: 'UNDER_14' });
    await bootstrap(h, target.invitationToken, `op_map_${Date.now()}`, `map-${Date.now()}`);

    const key = await h.admin.query(
      `SELECT bok.id, bok.scope_key, bok.attempt_id, a.candidate_identity_digest
         FROM binding_operation_keys bok
         JOIN binding_attempts a ON a.id = bok.attempt_id
        WHERE a.target_person_id = $1 AND bok.command_type = 'BOOTSTRAP'
        ORDER BY bok.created_at DESC LIMIT 1`,
      [target.targetPersonId]
    );
    expect(key.rows[0].attempt_id).toBeTruthy();

    const other = await createTarget(h, 'op_map_other', { ageBand: 'UNDER_14' });
    await bootstrap(h, other.invitationToken, `op_map_other_${Date.now()}`, `map-other-${Date.now()}`);
    const otherAttempt = await h.admin.query(
      'SELECT id FROM binding_attempts WHERE target_person_id = $1',
      [other.targetPersonId]
    );

    const pool = createAppPool(1);
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      await tx.query('SELECT app.set_binding_identity_context($1, $2)', [
        key.rows[0].candidate_identity_digest,
        'IDENTITY_BINDING_PENDING',
      ]);
      await setScope(tx, key.rows[0].scope_key);

      const bound = await mapAttempt(tx, {
        operationKeyId: key.rows[0].id,
        attemptId: key.rows[0].attempt_id,
      });
      expect(bound.attemptId).toBe(key.rows[0].attempt_id);
      // Same attempt again: read-back no-op.
      const again = await mapAttempt(tx, {
        operationKeyId: key.rows[0].id,
        attemptId: key.rows[0].attempt_id,
      });
      expect(again.attemptId).toBe(key.rows[0].attempt_id);

      // Different attempt: fail closed, never re-point.
      await expect(
        mapAttempt(tx, {
          operationKeyId: key.rows[0].id,
          attemptId: otherAttempt.rows[0].id,
        })
      ).rejects.toThrow('BINDING_OPERATION_ATTEMPT_CONFLICT');
      await tx.query('COMMIT');
    } catch (err) {
      await tx.query('ROLLBACK');
      throw err;
    } finally {
      tx.release();
      await pool.end();
    }

    const after = await h.admin.query(
      'SELECT attempt_id FROM binding_operation_keys WHERE id = $1',
      [key.rows[0].id]
    );
    expect(after.rows[0].attempt_id).toBe(key.rows[0].attempt_id);
  });
});