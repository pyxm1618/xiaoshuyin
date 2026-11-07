/**
 * Consent read integration tests (T060).
 *   GET /api/v1/consents (no family → 200 { items: [] })
 *   GET /api/v1/compliance/profile
 *   GET /api/v1/compliance/notices
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  auth,
  createConsentRequest,
  createFamily,
  loginWithLabel,
} from '../setup/api.js';

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
    const { token, personId } = await loginWithLabel(app, `crd_${label}`);
    const famRes = await createFamily(app, token, label);
    expect(famRes.statusCode).toBe(201);
    return { token, personId, familyId: famRes.json().id as string };
  }

  it('T060: GET /consents no family → 200 empty list', async () => {
    const { token } = await loginWithLabel(app, 'crd_nofam');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/consents',
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [] });
  });

  it('T060: GET /consents with family returns { items: [...] }', async () => {
    const { token } = await setupManagerAndFamily('t060a');

    const reqRes = await createConsentRequest(app, token, 't060a');
    expect(reqRes.statusCode).toBe(201);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/consents',
      headers: auth(token),
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
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.personId).toBe(personId);
    expect(body.ageBand).toBe('ADULT');
    expect(body.minorMode).toBe(false);
    expect(body.verifiedSource).toBeDefined();
    expect(body.effectiveAt).toBeDefined();
  });

  it('T060: GET /compliance/notices returns catalog', async () => {
    const { token } = await loginWithLabel(app, 'crd_notices');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/notices',
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.notices).toBeDefined();
    expect(body.notices.length).toBeGreaterThan(0);
    expect(body.notices[0].version).toBe('v1');
    expect(body.notices[0].hash).toBeDefined();
    expect(body.notices[0].title).toBeDefined();
    expect(body.notices[0].purpose).toBe('UNDER_14_GUARDIAN_CONSENT');
    expect(body.notices[0].effectiveAt).toBeDefined();
  });
});