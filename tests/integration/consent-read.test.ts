/**
 * Consent read integration tests (T060).
 * GET /api/v1/consents (no family → 200 { items: [] }, frozen OpenAPI shape)
 * GET /api/v1/compliance/profile
 * GET /api/v1/compliance/notices
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

let verifyPool: pg.Pool;

describe('Consent Read Integration (T060)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  async function setupManagerAndFamily(label: string) {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `crd_${label}_${Date.now()}` },
    });
    const { token, person } = loginRes.json();

    const famRes = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: `家庭-${label}`,
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        idempotencyKey: `fam-crd-${label}-${Date.now()}`,
      },
    });
    const family = famRes.json();
    return { token, personId: person.id, familyId: family.id };
  }

  it('T060: GET /consents no family → 200 empty list', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `crd_nofam_${Date.now()}` },
    });
    const { token } = loginRes.json();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/consents',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    // Frozen OpenAPI contract: collection endpoint returns { "items": [...] }
    expect(res.json()).toEqual({ items: [] });
  });

  it('T060: GET /consents with family returns { items: [...] }', async () => {
    const { token } = await setupManagerAndFamily('t060a');

    // Create a consent request first
    await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        noticeVersion: 'v1',
        idempotencyKey: `cr-t060a-${Date.now()}`,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/consents',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('T060: GET /compliance/profile returns profile', async () => {
    const { token, personId } = await setupManagerAndFamily('t060b');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/profile',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ageBand).toBeDefined();
    expect(body.minorMode).toBeDefined();
    expect(body.verifiedSource).toBeDefined();
  });

  it('T060: GET /compliance/notices returns catalog', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `crd_notices_${Date.now()}` },
    });
    const { token } = loginRes.json();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/notices',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.notices).toBeDefined();
    expect(body.notices.length).toBeGreaterThan(0);
    expect(body.notices[0].version).toBe('v1');
    expect(body.notices[0].hash).toBeDefined();
    expect(body.notices[0].title).toBeDefined();
  });
});
