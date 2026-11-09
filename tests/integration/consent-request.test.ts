/**
 * Consent request integration tests (T052 RED→GREEN).
 *
 * Frozen OpenAPI:
 *   CreateConsentRequestRequest = { declaredAgeBand, noticeVersion, channel,
 *                                    existingSubjectPersonId? }
 *   ConsentRequestResponse      = { requestId, declaredAgeBand, noticeVersion,
 *                                    noticeHash, expiresAt, status }
 *   `Idempotency-Key` is an HTTP header.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  commandHeaders,
  createConsentRequest,
  createFamily,
  loginWithLabel,
} from '../setup/api.js';

let verifyPool: pg.Pool;

async function queryDb(sql: string, params: unknown[] = []) {
  return verifyPool.query(sql, params);
}

describe('Consent Request Integration (T052)', () => {
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
    const { token, personId } = await loginWithLabel(app, `cr_${label}`);
    const famRes = await createFamily(app, token, label);
    expect(famRes.statusCode).toBe(201);
    return { token, personId, familyId: famRes.json().id as string };
  }

  it('T052: no family → 404', async () => {
    const { token } = await loginWithLabel(app, 'cr_nofam');

    const res = await createConsentRequest(app, token, 'cr_nofam');
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('CURRENT_FAMILY_NOT_FOUND');
  });

  it('T052: create request 201, subject_person_id IS NULL', async () => {
    const { token } = await setupManagerAndFamily('t052a');

    const res = await createConsentRequest(app, token, 't052a');
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.requestId).toBeDefined();
    expect(body.declaredAgeBand).toBe('UNDER_14');
    expect(body.status).toBe('PENDING');
    expect(body.noticeVersion).toBe('v1');
    expect(body.noticeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.expiresAt).toBeDefined();

    const { rows } = await queryDb(
      'SELECT subject_person_id, status FROM guardian_consent_requests WHERE id = $1',
      [body.requestId]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].subject_person_id).toBeNull();
    expect(rows[0].status).toBe('PENDING');
  });

  it('T052: response and DB contain no child PII', async () => {
    const { token } = await setupManagerAndFamily('t052b');

    const res = await createConsentRequest(app, token, 't052b');
    expect(res.statusCode).toBe(201);
    const body = res.json();

    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('name');
    expect(bodyStr).not.toContain('birth');
    expect(bodyStr).not.toContain('nickname');
    expect(bodyStr).not.toContain('姓名');
    expect(bodyStr).not.toContain('生日');

    const { rows } = await queryDb(
      'SELECT * FROM guardian_consent_requests WHERE id = $1',
      [body.requestId]
    );
    const row = rows[0];
    expect(row.subject_person_id).toBeNull();
    expect(row.child_name).toBeUndefined();
    expect(row.child_birth_date).toBeUndefined();
    expect(row.child_nickname).toBeUndefined();
  });

  it('C1: channel must match the server runtime', async () => {
    const { token } = await setupManagerAndFamily('t052channel');

    const wrongChannel = process.env['NODE_ENV'] === 'test' ? 'MINIPROGRAM' : 'TEST';
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents/requests',
      headers: commandHeaders(token, 'cr-channel'),
      payload: {
        declaredAgeBand: 'UNDER_14',
        noticeVersion: 'v1',
        channel: wrongChannel,
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('T052: expired request unusable', async () => {
    const { token, familyId } = await setupManagerAndFamily('t052c');

    const res = await createConsentRequest(app, token, 't052c');
    expect(res.statusCode).toBe(201);
    const body = res.json();

    await queryDb(
      `UPDATE guardian_consent_requests SET created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour' WHERE id = $1`,
      [body.requestId]
    );

    const grantRes = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: commandHeaders(token, 'cg-expired'),
      payload: {
        onboardingRequestId: body.requestId,
        accepted: true,
        noticeVersion: 'v1',
      },
    });
    expect(grantRes.statusCode).toBe(403);
    expect(familyId).toBeTruthy();
  });
});