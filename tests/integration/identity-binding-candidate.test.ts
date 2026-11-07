/**
 * T059/T060 — candidate decision: AFFIRM / REJECT / CANCEL, generic results,
 * idempotent replay, and invalid context handling.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  bootstrap,
  buildBindingApp,
  candidateDecision,
  candidateStatus,
  createTarget,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('candidate decision', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('invalid context is 401 and writes nothing', async () => {
    const res = await candidateDecision(h, 'not-a-valid-context-token', 'AFFIRM', undefined, 'candidate-binding-v1');
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('BINDING_CONTEXT_INVALID');
  });

  it('AFFIRM without an attempt is generic and records no confirmation', async () => {
    const target = await createTarget(h, 'cand_no_attempt', { ageBand: 'ADULT' });
    const boot = await bootstrap(h, target.invitationToken, `cand_no_attempt_${Date.now()}`);
    const token = boot.json().pendingContextToken as string;

    const res = await candidateDecision(h, token, 'AFFIRM', `cand-k-${Date.now()}`, 'candidate-binding-v1');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ binding: 'NOT_COMPLETED' });
    const confirmations = await h.admin.query(
      `SELECT count(*)::int AS n
         FROM binding_confirmations c
         JOIN binding_attempts a ON a.id = c.attempt_id
        WHERE a.target_person_id = $1`,
      [target.targetPersonId]
    );
    expect(confirmations.rows[0].n).toBe(0);
  });

  it('AFFIRM is idempotent for the same key + payload', async () => {
    const target = await createTarget(h, 'cand_affirm', { ageBand: 'UNDER_14' });
    const { contextToken, attemptId } = await startBinding(h, target, `cand_affirm_${Date.now()}`);
    const key = `cand-idem-${Date.now()}`;
    const replay = await candidateDecision(h, contextToken, 'AFFIRM', key, 'candidate-binding-v1');
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ binding: 'NOT_COMPLETED' });

    const confirmations = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_confirmations
        WHERE attempt_id = $1 AND kind = 'CANDIDATE'`,
      [attemptId]
    );
    expect(confirmations.rows[0].n).toBe(1);
  });

  it('REJECT and CANCEL both settle TERMINAL with the frozen reasons', async () => {
    for (const [decision, reason] of [
      ['REJECT', 'CANDIDATE_REJECTED'],
      ['CANCEL', 'CANDIDATE_CANCELLED'],
    ] as const) {
      const target = await createTarget(h, `cand_${decision.toLowerCase()}`, { ageBand: 'UNDER_14' });
      const { contextToken, attemptId } = await startBinding(
        h,
        target,
        `cand_${decision}_${Date.now()}`
      );
      const res = await candidateDecision(h, contextToken, decision, `cand-${decision}-${Date.now()}`);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ binding: 'NOT_COMPLETED' });

      const attempt = await h.admin.query(
        'SELECT state, terminal_reason FROM binding_attempts WHERE id = $1',
        [attemptId]
      );
      expect(attempt.rows[0]).toEqual({ state: 'TERMINAL', terminal_reason: reason });

      const status = await candidateStatus(h, contextToken);
      expect(status.json()).toEqual({ binding: 'NOT_COMPLETED' });
    }
  });
});