/**
 * T095 — error envelope / validation: frozen codes, unified confirmer 404, and
 * the hard distinction between `WECHAT_AUTH_FAILED` (real code2session failure)
 * and an `authorize()` DENY on bootstrap (200 anti-enumeration generic).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

const authState = vi.hoisted(() => ({ deny: false }));

vi.mock('@xiaoshuyin/authorization', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xiaoshuyin/authorization')>();
  return {
    ...actual,
    authorize: (input: Parameters<typeof actual.authorize>[0]) => {
      if (authState.deny && input.action === 'IDENTITY_BINDING_BOOTSTRAP') {
        return { decision: 'DENY', reason: 'NO_ACTOR' } as const;
      }
      return actual.authorize(input);
    },
  };
});

import { buildApp } from '../../apps/server/api/src/app.js';
import { InMemoryInvitationPort } from '../../apps/server/api/src/identity-binding/invitation-port.js';
import {
  bootstrap,
  buildBindingApp,
  candidateDecision,
  createTarget,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('identity binding error envelope (T095)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  beforeEach(() => {
    authState.deny = false;
  });

  it('AFFIRM without confirmationVersion is 422 VALIDATION_ERROR', async () => {
    const target = await createTarget(h, 'err_affirm', { ageBand: 'UNDER_14' });
    const { contextToken } = await startBinding(h, target, `err_affirm_${randomUUID()}`);
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/v1/identity-bindings/candidate-decision',
      headers: { 'x-binding-context': contextToken },
      payload: { decision: 'AFFIRM', idempotencyKey: `err-${randomUUID()}` },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ code: 'VALIDATION_ERROR', message: 'Invalid request body' });
  });

  it('confirmer decision schema violations are 422, unknown target is 404 BINDING_NOT_FOUND', async () => {
    const target = await createTarget(h, 'err_conf', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(h, target, `err_conf_${randomUUID()}`);

    const missing = await h.app.inject({
      method: 'POST',
      url: '/api/v1/identity-bindings/pairing-decision',
      headers: { authorization: `Bearer ${target.guardian.token}` },
      payload: {
        decision: 'AFFIRM',
        targetConfirmed: true,
        candidateRecognized: true,
        confirmationVersion: 'second-party-recognition-v1',
        idempotencyKey: `err-${randomUUID()}`,
      },
    });
    expect(missing.statusCode).toBe(422);
    expect(missing.json().code).toBe('VALIDATION_ERROR');

    const unknown = await h.app.inject({
      method: 'POST',
      url: '/api/v1/identity-bindings/pairing-decision',
      headers: { authorization: `Bearer ${target.guardian.token}` },
      payload: {
        personId: target.targetPersonId,
        pairingChallenge: 'A'.repeat(192),
        decision: 'AFFIRM',
        targetConfirmed: true,
        candidateRecognized: true,
        confirmationVersion: 'second-party-recognition-v1',
        idempotencyKey: `err-${randomUUID()}`,
      },
    });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json()).toEqual({
      code: 'BINDING_NOT_FOUND',
      message: 'Binding not found',
    });
  });

  it('bootstrap authorize() DENY is 200 generic, never WECHAT_AUTH_FAILED', async () => {
    const target = await createTarget(h, 'err_deny', { ageBand: 'UNDER_14' });
    authState.deny = true;
    const res = await bootstrap(h, target.invitationToken, `err_deny_${randomUUID()}`);
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json()).sort()).toEqual(['binding', 'pendingContextToken']);
    expect(res.json().binding).toBe('NOT_COMPLETED');
    expect(res.json()).not.toHaveProperty('code');
  });

  it('WECHAT_AUTH_FAILED appears only for a real code2session failure', async () => {
    const port = new InMemoryInvitationPort();
    const failing = {
      async code2session(): Promise<{ openid: string }> {
        throw new Error('network down');
      },
    };
    const app = await buildApp({
      identityBinding: { invitationPort: port, wechatProvider: failing },
    });
    await app.ready();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/identity-bindings/bootstrap',
        payload: {
          code: 'x',
          invitationToken: 'y',
          idempotencyKey: `err-wechat-${randomUUID()}`,
        },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({
        code: 'WECHAT_AUTH_FAILED',
        message: 'WeChat authentication failed',
      });
      // No target / family / guardian / consent detail leaks.
      expect(Object.keys(res.json()).sort()).toEqual(['code', 'message']);
    } finally {
      await app.close();
    }
  });

  it('generic candidate bodies never contain a new authorization error code', async () => {
    const target = await createTarget(h, 'err_generic', { ageBand: 'ADULT' });
    const boot = await bootstrap(h, target.invitationToken, `err_generic_${randomUUID()}`);
    const token = boot.json().pendingContextToken as string;
    const decision = await candidateDecision(
      h,
      token,
      'AFFIRM',
      undefined,
      'candidate-binding-v1'
    );
    expect(decision.statusCode).toBe(200);
    expect(Object.keys(decision.json()).sort()).toEqual(['binding', 'pairingChallenge']);
    expect(decision.json().pairingChallenge).toMatch(/^[A-Za-z0-9_-]{192}$/);
    expect(decision.json()).not.toHaveProperty('code');
  });
});