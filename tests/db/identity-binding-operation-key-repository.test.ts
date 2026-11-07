/**
 * Operation-level idempotency evidence.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  buildBindingApp,
  createTarget,
  bootstrap,
  candidateDecision,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';

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
});