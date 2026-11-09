/**
 * H2 — the confirmer must be authorized BEFORE any protected attempt state is
 * read, expiry is materialized, or idempotency facts are written.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  buildBindingApp,
  createTarget,
  startBinding,
  confirmerDecision,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { loginWithLabel } from '../setup/api.js';

describe('confirmer authorization ordering (H2)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('authenticated outsider with P1 / attempt UUID gets generic 404 and no state change', async () => {
    const target = await createTarget(h, 'conf_order', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(
      h,
      target,
      `conf_order_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );

    // Make the attempt expired: an unauthorized caller must never materialize
    // that transition or write an audit row for it. The table CHECK requires
    // expires_at > created_at, so both timestamps are moved back.
    await h.admin.query(
      `UPDATE binding_attempts
          SET created_at = now() - interval '2 hours',
              expires_at = now() - interval '1 second'
        WHERE id = $1`,
      [attemptId]
    );

    const outsider = await loginWithLabel(h.app, 'conf_order_outsider');
    const beforeKeys = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_operation_keys
        WHERE command_type = 'SECOND_PARTY_DECISION' AND attempt_id = $1`,
      [attemptId]
    );
    const beforeAudit = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1`,
      [attemptId]
    );

    const res = await confirmerDecision(h, outsider.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      code: 'BINDING_NOT_FOUND',
      message: 'Binding not found',
    });

    const attempt = await h.admin.query(
      `SELECT state, terminal_reason, settled_at FROM binding_attempts WHERE id = $1`,
      [attemptId]
    );
    expect(attempt.rows[0].state).toBe('PENDING');
    expect(attempt.rows[0].terminal_reason).toBeNull();
    expect(attempt.rows[0].settled_at).toBeNull();

    const afterKeys = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_operation_keys
        WHERE command_type = 'SECOND_PARTY_DECISION' AND attempt_id = $1`,
      [attemptId]
    );
    expect(afterKeys.rows[0].n).toBe(beforeKeys.rows[0].n);

    const afterAudit = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1`,
      [attemptId]
    );
    expect(afterAudit.rows[0].n).toBe(beforeAudit.rows[0].n);

    const confirmations = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_confirmations
        WHERE attempt_id = $1 AND kind = 'SECOND_PARTY'`,
      [attemptId]
    );
    expect(confirmations.rows[0].n).toBe(0);
  });
});