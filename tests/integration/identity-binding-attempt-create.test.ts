/**
 * T055 — Gate 1 pass creates exactly one PENDING attempt; different keys with
 * the same semantic triple converge; after TERMINAL a new attempt is allowed.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  bootstrap,
  buildBindingApp,
  candidateDecision,
  createTarget,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('attempt creation and convergence', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('creates a PENDING attempt and converges different keys to the same live attempt', async () => {
    const target = await createTarget(h, 'att_create', { ageBand: 'UNDER_14' });
    const code = `att_create_${Date.now()}`;

    const first = await bootstrap(h, target.invitationToken, code, `att-k1-${Date.now()}`);
    expect(first.statusCode).toBe(200);
    const second = await bootstrap(h, target.invitationToken, code, `att-k2-${Date.now()}`);
    expect(second.statusCode).toBe(200);

    const attempts = await h.admin.query(
      'SELECT state FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows.length).toBe(1);
    expect(attempts.rows[0].state).toBe('PENDING');
  });

  it('allows a new attempt after the old one is TERMINAL', async () => {
    const target = await createTarget(h, 'att_new', { ageBand: 'UNDER_14' });
    const code = `att_new_${Date.now()}`;
    const boot = await bootstrap(h, target.invitationToken, code, `att-n1-${Date.now()}`);
    const token = boot.json().pendingContextToken as string;

    const reject = await candidateDecision(h, token, 'REJECT', `att-rej-${Date.now()}`);
    expect(reject.statusCode).toBe(200);

    const afterReject = await h.admin.query(
      'SELECT state, terminal_reason FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(afterReject.rows.length).toBe(1);
    expect(afterReject.rows[0]).toEqual({
      state: 'TERMINAL',
      terminal_reason: 'CANDIDATE_REJECTED',
    });

    const again = await bootstrap(h, target.invitationToken, code, `att-n2-${Date.now()}`);
    expect(again.statusCode).toBe(200);
    const states = await h.admin.query(
      'SELECT state FROM binding_attempts WHERE target_person_id = $1 ORDER BY created_at ASC',
      [target.targetPersonId]
    );
    expect(states.rows.map((r: any) => r.state)).toEqual(['TERMINAL', 'PENDING']);
  });

  it('materializes an expired PENDING attempt before creating the new one (F-07)', async () => {
    const target = await createTarget(h, 'att_exp', { ageBand: 'UNDER_14' });
    const code = `att_exp_${Date.now()}`;

    const boot = await bootstrap(h, target.invitationToken, code, `exp-1-${Date.now()}`);
    expect(boot.statusCode).toBe(200);
    const token = boot.json().pendingContextToken as string;
    const affirm = await candidateDecision(h, token, 'AFFIRM', undefined, 'candidate-binding-v1');
    expect(affirm.statusCode).toBe(200);

    const aRows = await h.admin.query(
      'SELECT id FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    const attemptA = aRows.rows[0].id as string;

    await h.admin.query(
      `UPDATE binding_attempts
          SET created_at = now() - interval '2 hours',
              expires_at = now() - interval '1 hour'
        WHERE id = $1`,
      [attemptA]
    );
    // Give A's transport context decryptable material that must be scrubbed.
    await h.admin.query(
      `UPDATE binding_pending_contexts
          SET openid_ciphertext = decode('01', 'hex'),
              openid_nonce = decode('02', 'hex'),
              openid_tag = decode('03', 'hex')
        WHERE attempt_id = $1`,
      [attemptA]
    );

    const preAudit = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND terminal_reason = 'ATTEMPT_EXPIRED'`,
      [attemptA]
    );
    expect(preAudit.rows[0].n).toBe(0);

    const next = await bootstrap(h, target.invitationToken, code, `exp-2-${Date.now()}`);
    expect(next.statusCode).toBe(200);

    const aRow = await h.admin.query(
      'SELECT state, terminal_reason, committed_account_id FROM binding_attempts WHERE id = $1',
      [attemptA]
    );
    expect(aRow.rows[0]).toEqual({
      state: 'TERMINAL',
      terminal_reason: 'ATTEMPT_EXPIRED',
      committed_account_id: null,
    });

    const audit = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_TERMINAL'
          AND terminal_reason = 'ATTEMPT_EXPIRED'`,
      [attemptA]
    );
    expect(audit.rows[0].n).toBe(1);

    const secrets = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_pending_contexts
        WHERE attempt_id = $1
          AND (openid_ciphertext IS NOT NULL OR openid_nonce IS NOT NULL OR openid_tag IS NOT NULL)`,
      [attemptA]
    );
    expect(secrets.rows[0].n).toBe(0);

    const live = await h.admin.query(
      "SELECT id FROM binding_attempts WHERE target_person_id = $1 AND state = 'PENDING'",
      [target.targetPersonId]
    );
    expect(live.rows).toHaveLength(1);
    expect(live.rows[0].id).not.toBe(attemptA);
  });
});