/**
 * T071/T072 — independent confirmer authentication: candidate context never
 * authenticates a confirmer action, and a Bearer session never authenticates a
 * candidate action.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  buildBindingApp,
  candidateDecision,
  candidateStatus,
  createTarget,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('independent confirmer authentication', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('candidate context cannot call confirmer routes', async () => {
    const target = await createTarget(h, 'ind_ctx', { ageBand: 'UNDER_14' });
    const { contextToken, attemptId } = await startBinding(h, target, `ind_ctx_${Date.now()}`);

    const decision = await h.app.inject({
      method: 'POST',
      url: '/api/v1/identity-bindings/pairing-decision',
      headers: { 'x-binding-context': contextToken },
      payload: {
        personId: target.targetPersonId,
        pairingChallenge: 'A'.repeat(192),
        decision: 'AFFIRM',
        targetConfirmed: true,
        candidateRecognized: true,
        confirmationVersion: 'second-party-recognition-v1',
        idempotencyKey: `ind-${Date.now()}`,
      },
    });
    expect(decision.statusCode).toBe(401);

    const list = await h.app.inject({
      method: 'GET',
      url: `/api/v1/identity-bindings/pending?personId=${target.targetPersonId}`,
      headers: { 'x-binding-context': contextToken },
    });
    expect(list.statusCode).toBe(401);
  });

  it('Bearer session cannot call candidate routes', async () => {
    const target = await createTarget(h, 'ind_bearer', { ageBand: 'UNDER_14' });

    const decision = await h.app.inject({
      method: 'POST',
      url: '/api/v1/identity-bindings/candidate-decision',
      headers: { authorization: `Bearer ${target.guardian.token}` },
      payload: { decision: 'AFFIRM', confirmationVersion: 'candidate-binding-v1', idempotencyKey: `b-${Date.now()}` },
    });
    expect(decision.statusCode).toBe(401);
    expect(decision.json().code).toBe('BINDING_CONTEXT_INVALID');

    const status = await h.app.inject({
      method: 'GET',
      url: '/api/v1/identity-bindings/status',
      headers: { authorization: `Bearer ${target.guardian.token}` },
    });
    expect(status.statusCode).toBe(401);
  });
});