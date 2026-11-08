/**
 * T063 — candidate surface auth: X-Binding-Context is the only accepted
 * credential; ordinary Bearer is rejected; a candidate cannot hold or call the
 * confirmer surfaces.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  buildBindingApp,
  createTarget,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { loginWithLabel } from '../setup/api.js';

describe('candidate route authentication (T063)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('status / decision require X-Binding-Context (no header or Bearer only is 401)', async () => {
    const target = await createTarget(h, 'auth_cand', { ageBand: 'UNDER_14' });
    const { contextToken, attemptId } = await startBinding(
      h,
      target,
      `auth_cand_${randomUUID()}`
    );
    const outsider = await loginWithLabel(h.app, 'auth_cand_outsider');

    const noHeader = await h.app.inject({
      method: 'GET',
      url: '/api/v1/identity-bindings/status',
    });
    expect(noHeader.statusCode).toBe(401);
    expect(noHeader.json().code).toBe('BINDING_CONTEXT_INVALID');

    const bearerOnly = await h.app.inject({
      method: 'GET',
      url: '/api/v1/identity-bindings/status',
      headers: { authorization: `Bearer ${outsider.token}` },
    });
    expect(bearerOnly.statusCode).toBe(401);
    expect(bearerOnly.json().code).toBe('BINDING_CONTEXT_INVALID');

    const noHeaderDecision = await h.app.inject({
      method: 'POST',
      url: '/api/v1/identity-bindings/candidate-decision',
      payload: {
        decision: 'AFFIRM',
        confirmationVersion: 'candidate-binding-v1',
        idempotencyKey: `auth-${randomUUID()}`,
      },
    });
    expect(noHeaderDecision.statusCode).toBe(401);
    expect(noHeaderDecision.json().code).toBe('BINDING_CONTEXT_INVALID');

    const withContext = await h.app.inject({
      method: 'GET',
      url: '/api/v1/identity-bindings/status',
      headers: { 'x-binding-context': contextToken },
    });
    expect(withContext.statusCode).toBe(200);
    expect(withContext.json()).toEqual({ binding: 'NOT_COMPLETED' });

    // The attempt still exists and is untouched by the rejected credentials.
    const attempt = await h.admin.query('SELECT id FROM binding_attempts WHERE id = $1', [
      attemptId,
    ]);
    expect(attempt.rows).toHaveLength(1);
  });

  it('confirmer surfaces reject the candidate capability header', async () => {
    const target = await createTarget(h, 'auth_conf', { ageBand: 'UNDER_14' });
    const { contextToken, attemptId } = await startBinding(
      h,
      target,
      `auth_conf_${randomUUID()}`
    );

    const listWithContext = await h.app.inject({
      method: 'GET',
      url: `/api/v1/identity-bindings/pending?personId=${target.targetPersonId}`,
      headers: { 'x-binding-context': contextToken },
    });
    expect(listWithContext.statusCode).toBe(401);
    expect(listWithContext.json().code).toBe('UNAUTHENTICATED');

    const decisionWithContext = await h.app.inject({
      method: 'POST',
      url: `/api/v1/identity-bindings/${attemptId}/decision`,
      headers: { 'x-binding-context': contextToken },
      payload: {
        personId: target.targetPersonId,
        decision: 'AFFIRM',
        targetConfirmed: true,
        candidateRecognized: true,
        confirmationVersion: 'second-party-recognition-v1',
        idempotencyKey: `auth-conf-${randomUUID()}`,
      },
    });
    expect(decisionWithContext.statusCode).toBe(401);
    expect(decisionWithContext.json().code).toBe('UNAUTHENTICATED');
  });

  it('a candidate ordinary session is not an authorized confirmer', async () => {
    const target = await createTarget(h, 'auth_outsider', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(h, target, `auth_outsider_${randomUUID()}`);
    const outsider = await loginWithLabel(h.app, 'auth_outsider_session');

    const list = await h.app.inject({
      method: 'GET',
      url: `/api/v1/identity-bindings/pending?personId=${target.targetPersonId}`,
      headers: { authorization: `Bearer ${outsider.token}` },
    });
    expect(list.statusCode).toBe(404);
    expect(list.json()).toEqual({ code: 'BINDING_NOT_FOUND', message: 'Binding not found' });

    const decision = await h.app.inject({
      method: 'POST',
      url: `/api/v1/identity-bindings/${attemptId}/decision`,
      headers: { authorization: `Bearer ${outsider.token}` },
      payload: {
        personId: target.targetPersonId,
        decision: 'AFFIRM',
        targetConfirmed: true,
        candidateRecognized: true,
        confirmationVersion: 'second-party-recognition-v1',
        idempotencyKey: `auth-out-${randomUUID()}`,
      },
    });
    expect(decision.statusCode).toBe(404);
    expect(decision.json()).toEqual({ code: 'BINDING_NOT_FOUND', message: 'Binding not found' });

    const confirmations = await h.admin.query(
      "SELECT count(*)::int AS n FROM binding_confirmations WHERE attempt_id = $1 AND kind = 'SECOND_PARTY'",
      [attemptId]
    );
    expect(confirmations.rows[0].n).toBe(0);
  });
});