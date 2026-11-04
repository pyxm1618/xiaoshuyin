/**
 * Auth integration tests (T042 RED→GREEN).
 * First login creates Account + Person in same transaction.
 * Repeat login doesn't create duplicates.
 * Logout invalidates old token.
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
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.account.id).toBeDefined();
    expect(body.person.id).toBeDefined();
    expect(body.person.profile).toBeNull();
    expect(body.token).toBeDefined();
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

    expect(body2.account.id).toBe(body1.account.id);
    expect(body2.person.id).toBe(body1.person.id);
  });

  it('GET /me returns account + person', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: 'test_code_me' },
    });
    const { token } = loginRes.json();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.account).toBeDefined();
    expect(body.person).toBeDefined();
    expect(JSON.stringify(body)).not.toContain('wechat_openid');
  });

  it('logout then old token gets 401', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: 'test_code_logout' },
    });
    const { token } = loginRes.json();

    // Logout
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    });

    // Old token should be rejected
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
  });
});
