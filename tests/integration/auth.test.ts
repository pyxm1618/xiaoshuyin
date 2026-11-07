/**
 * Auth integration tests (T042 RED→GREEN).
 * First login creates Account + Person in same transaction.
 * Repeat login doesn't create duplicates.
 * Logout invalidates old token.
 *
 * Frozen OpenAPI: login → 200 `{ accountId, sessionToken, expiresAt, person }`,
 * logout → 204.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/api/src/app.js';

describe('Auth Integration (T042)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('first login creates Account + Person', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `test_code_1_${Date.now()}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accountId).toBeDefined();
    expect(body.sessionToken).toBeDefined();
    expect(body.expiresAt).toBeDefined();
    expect(body.person.id).toBeDefined();
    expect(body.person.createdAt).toBeDefined();
    expect(body.person.profile).toBeUndefined();
    // Must NOT contain wechat_openid
    expect(JSON.stringify(body)).not.toContain('wechat_openid');
  });

  it('repeat login reuses Account + Person', async () => {
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: 'test_code_2' },
    });
    const body1 = res1.json();

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: 'test_code_2' },
    });
    const body2 = res2.json();

    expect(res2.statusCode).toBe(200);
    expect(body2.accountId).toBe(body1.accountId);
    expect(body2.person.id).toBe(body1.person.id);
  });

  it('GET /me returns account + person', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: 'test_code_me' },
    });
    const { sessionToken } = loginRes.json();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.account.id).toBeDefined();
    expect(body.account.status).toBe('ACTIVE');
    expect(body.person.id).toBeDefined();
    expect(JSON.stringify(body)).not.toContain('wechat_openid');
  });

  it('logout then old token gets 401', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: 'test_code_logout' },
    });
    const { sessionToken } = loginRes.json();

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    expect(logoutRes.statusCode).toBe(204);
    expect(logoutRes.body).toBe('');

    // Old token should be rejected
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    expect(res.statusCode).toBe(401);
  });
});