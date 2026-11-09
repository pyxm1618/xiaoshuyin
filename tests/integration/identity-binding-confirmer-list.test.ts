/**
 * T069/T070 — confirmer pending list: minimal fields, generic 404, expired
 * attempts are materialized and excluded at the SQL layer.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  buildBindingApp,
  confirmerList,
  createTarget,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { loginWithLabel } from '../setup/api.js';

describe('confirmer pending list', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('returns the minimal attempt list for an authorized guardian', async () => {
    const target = await createTarget(h, 'list_ok', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(h, target, `list_ok_${Date.now()}`);

    const res = await confirmerList(h, target.guardian.token, target.targetPersonId);
    expect(res.statusCode).toBe(200);
    expect(res.json().attempts).toHaveLength(1);
    expect(Object.keys(res.json().attempts[0]).sort()).toEqual([
      'attemptId',
      'createdAt',
      'expiresAt',
    ]);
    expect(res.json().attempts[0].attemptId).toBe(attemptId);
  });

  it('unauthorized / unknown target is the same generic 404', async () => {
    const target = await createTarget(h, 'list_deny', { ageBand: 'UNDER_14' });
    const outsider = await loginWithLabel(h.app, 'list_deny_outsider');

    const unauthorized = await confirmerList(h, outsider.token, target.targetPersonId);
    expect(unauthorized.statusCode).toBe(404);
    expect(unauthorized.json()).toEqual({
      code: 'BINDING_NOT_FOUND',
      message: 'Binding not found',
    });

    const unknown = await confirmerList(
      h,
      target.guardian.token,
      '00000000-0000-7000-8000-0000000000ff'
    );
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json()).toEqual(unauthorized.json());
  });

  it('expired attempts disappear from the list and yield one TERMINAL audit', async () => {
    const target = await createTarget(h, 'list_expired', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(h, target, `list_expired_${Date.now()}`);

    await h.admin.query(
      `UPDATE binding_attempts
          SET created_at = now() - interval '2 hours',
              expires_at = now() - interval '1 second'
        WHERE id = $1`,
      [attemptId]
    );

    const res = await confirmerList(h, target.guardian.token, target.targetPersonId);
    expect(res.statusCode).toBe(200);
    expect(res.json().attempts).toEqual([]);

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
});