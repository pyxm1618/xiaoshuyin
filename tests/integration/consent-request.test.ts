/**
 * Consent request integration tests (T052 RED→GREEN).
 * POST /api/v1/compliance/guardian-consents/requests
 * - No family → 404
 * - Create request 201, subject_person_id IS NULL
 * - Response and DB contain no child name/birth/nickname
 * - Expired request unusable
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

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
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `cr_${label}_${Date.now()}` },
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
        idempotencyKey: `fam-cr-${label}-${Date.now()}`,
      },
    });
    const family = famRes.json();
    return { token, personId: person.id, familyId: family.id };
  }

  it('T052: no family → 404', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `cr_nofam_${Date.now()}` },
    });
    const { token } = loginRes.json();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        noticeVersion: 'v1',
        idempotencyKey: `cr-key-nofam-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('CURRENT_FAMILY_NOT_FOUND');
  });

  it('T052: create request 201, subject_person_id IS NULL', async () => {
    const { token, familyId } = await setupManagerAndFamily('t052a');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        noticeVersion: 'v1',
        idempotencyKey: `cr-key-a-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.status).toBe('PENDING');
    expect(body.noticeVersion).toBe('v1');
    expect(body.expiresAt).toBeDefined();

    // Verify subject_person_id IS NULL in DB
    const { rows } = await queryDb(
      'SELECT subject_person_id, status FROM guardian_consent_requests WHERE id = $1',
      [body.id]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].subject_person_id).toBeNull();
    expect(rows[0].status).toBe('PENDING');
  });

  it('T052: response and DB contain no child PII', async () => {
    const { token, familyId } = await setupManagerAndFamily('t052b');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        noticeVersion: 'v1',
        idempotencyKey: `cr-key-b-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();

    // Response should not contain child PII fields
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('name');
    expect(bodyStr).not.toContain('birth');
    expect(bodyStr).not.toContain('nickname');
    expect(bodyStr).not.toContain('姓名');
    expect(bodyStr).not.toContain('生日');

    // DB row should not have child PII columns
    const { rows } = await queryDb(
      'SELECT * FROM guardian_consent_requests WHERE id = $1',
      [body.id]
    );
    const row = rows[0];
    expect(row.subject_person_id).toBeNull();
    // No name/birth/nickname columns should exist or be populated
    expect(row.child_name).toBeUndefined();
    expect(row.child_birth_date).toBeUndefined();
    expect(row.child_nickname).toBeUndefined();
  });

  it('T052: expired request unusable', async () => {
    const { token, familyId } = await setupManagerAndFamily('t052c');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        noticeVersion: 'v1',
        idempotencyKey: `cr-key-c-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();

    // Manually expire the request in DB (set created_at to satisfy constraint)
    await queryDb(
      `UPDATE guardian_consent_requests SET created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour' WHERE id = $1`,
      [body.id]
    );

    // Try to grant consent on expired request
    const grantRes = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        consentRequestId: body.id,
        accepted: true,
        noticeVersion: 'v1',
        noticeHash: 'a'.repeat(64), // dummy hash
        idempotencyKey: `cg-key-c-${Date.now()}`,
      },
    });
    // Should be rejected (expired)
    expect([403, 409]).toContain(grantRes.statusCode);
  });
});
