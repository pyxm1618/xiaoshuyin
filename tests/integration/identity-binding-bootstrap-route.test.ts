/**
 * T057 — bootstrap route surface: strict request schema, frozen 200 shapes,
 * real WeChat failure mapping, and no hidden mode / invitation parameters.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../../apps/server/api/src/app.js';
import { InMemoryInvitationPort } from '../../apps/server/api/src/identity-binding/invitation-port.js';
import {
  bootstrap,
  buildBindingApp,
  candidateDecision,
  confirmerDecision,
  createTarget,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('bootstrap route contract (T057)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  async function rawBootstrap(payload: unknown) {
    return h.app.inject({
      method: 'POST',
      url: '/api/v1/identity-bindings/bootstrap',
      payload,
    });
  }

  it('missing or undeclared fields are 422 VALIDATION_ERROR', async () => {
    const missing = await rawBootstrap({ code: 'x' });
    expect(missing.statusCode).toBe(422);
    expect(missing.json()).toEqual({ code: 'VALIDATION_ERROR', message: 'Invalid request body' });

    const hiddenMode = await rawBootstrap({
      code: 'x',
      invitationToken: 't',
      idempotencyKey: '12345678',
      mode: 'invite',
    });
    expect(hiddenMode.statusCode).toBe(422);
    expect(hiddenMode.json().code).toBe('VALIDATION_ERROR');
  });

  it('generic response has exactly binding + pendingContextToken', async () => {
    const target = await createTarget(h, 'route_generic', { ageBand: 'ADULT' });
    const res = await bootstrap(h, target.invitationToken, `route_generic_${randomUUID()}`);
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json()).sort()).toEqual(['binding', 'pendingContextToken']);
    expect(res.json().binding).toBe('NOT_COMPLETED');
    expect(typeof res.json().pendingContextToken).toBe('string');
  });

  it('Case B reuse response has exactly the frozen shape', async () => {
    const target = await createTarget(h, 'route_caseb', { ageBand: 'UNDER_14' });
    const code = `route_caseb_${randomUUID()}`;
    const account = await h.admin.query(
      'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
      [`fake_${code}`]
    );
    await h.admin.query('UPDATE persons SET account_id = $1 WHERE id = $2', [
      account.rows[0].id,
      target.targetPersonId,
    ]);

    const res = await bootstrap(h, target.invitationToken, code);
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json()).sort()).toEqual(['account', 'binding', 'person', 'sessionToken']);
    expect(res.json().binding).toBe('REUSED');
  });

  it('COMMITTED replay is the strict { binding: "COMMITTED" } body', async () => {
    const target = await createTarget(h, 'route_committed', { ageBand: 'UNDER_14' });
    const code = `route_committed_${randomUUID()}`;
    const key = `route-committed-${randomUUID()}`;
    const first = await bootstrap(h, target.invitationToken, code, key);
    const token = first.json().pendingContextToken as string;
    const affirm = await candidateDecision(
      h,
      token,
      'AFFIRM',
      `route-committed-cand-${randomUUID()}`,
      'candidate-binding-v1'
    );
    expect(affirm.statusCode).toBe(200);
    const rows = await h.admin.query(
      'SELECT id FROM binding_attempts WHERE target_person_id = $1 ORDER BY created_at DESC LIMIT 1',
      [target.targetPersonId]
    );
    const attemptId = rows.rows[0].id as string;

    const commit = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(commit.json().state).toBe('COMMITTED');

    const replay = await bootstrap(h, target.invitationToken, code, key);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ binding: 'COMMITTED' });
  });

  it('real WeChat code2session failure is 401 WECHAT_AUTH_FAILED', async () => {
    const port = new InMemoryInvitationPort();
    const failing = {
      async code2session(): Promise<{ openid: string }> {
        throw new Error('code2session unavailable');
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
          code: 'any',
          invitationToken: 'any',
          idempotencyKey: `fail-${randomUUID()}`,
        },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ code: 'WECHAT_AUTH_FAILED' });
    } finally {
      await app.close();
    }
  });
});
