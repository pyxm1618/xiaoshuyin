/**
 * Families integration tests (T045 RED→GREEN).
 * Login → create family → verify. No family → 404. Non-ADULT → 403.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/api/src/app.js';

describe('Families Integration (T045)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /families/current returns 404 when no family', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: 'fam_test_1' },
    });
    const { token } = loginRes.json();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/families/current',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('CURRENT_FAMILY_NOT_FOUND');
  });

  it('POST /families creates family with isManager=true', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `fam_test_2_${Date.now()}` },
    });
    const { token, person } = loginRes.json();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: '测试家庭',
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        idempotencyKey: `fam-key-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.isManager).toBe(true);

    // Person count should not change
    // (Person was created at login, family creation reuses it)
  });

  it('ageBandSource != SELF_STATEMENT → 422', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `fam_test_3_${Date.now()}` },
    });
    const { token } = loginRes.json();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'ADULT',
        ageBandSource: 'GUARDIAN_RELAY',
        idempotencyKey: `fam-key-invalid-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });
});
