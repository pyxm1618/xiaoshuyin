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
});