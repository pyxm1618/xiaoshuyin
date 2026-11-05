/**
 * Consent grant integration tests (T054 RED→GREEN).
 * POST /api/v1/compliance/guardian-consents
 * - accepted=true required
 * - notice mismatch → 403
 * - expired → 403
 * - duplicate grant → 409
 * - success writes GRANTED v1 with bound_person_id IS NULL
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import { getCurrentNoticeHash } from '../../packages/compliance/src/notices.js';

let verifyPool: pg.Pool;

async function queryDb(sql: string, params: unknown[] = []) {
  return verifyPool.query(sql, params);
}

describe('Consent Grant Integration (T054)', () => {
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
      payload: { code: `cg_${label}_${Date.now()}` },
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
        idempotencyKey: `fam-cg-${label}-${Date.now()}`,
      },
    });
    const family = famRes.json();
    return { token, personId: person.id, familyId: family.id };
  }

  async function createConsentRequest(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        noticeVersion: 'v1',
        idempotencyKey: `cr-${label}-${Date.now()}`,
      },
    });
    return res.json();
  }

  it('T054: accepted=true required', async () => {
    const { token } = await setupManagerAndFamily('t054a');
    const request = await createConsentRequest(token, 't054a');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        consentRequestId: request.id,
        accepted: false, // not true
        noticeVersion: 'v1',
        noticeHash: getCurrentNoticeHash(),
        idempotencyKey: `cg-key-a-${Date.now()}`,
      },
    });
    // Schema requires accepted: true (literal), so validation fails
    expect(res.statusCode).toBe(422);
  });

  it('T054: notice mismatch → 403', async () => {
    const { token } = await setupManagerAndFamily('t054b');
    const request = await createConsentRequest(token, 't054b');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        consentRequestId: request.id,
        accepted: true,
        noticeVersion: 'v1',
        noticeHash: 'b'.repeat(64), // wrong hash
        idempotencyKey: `cg-key-b-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('T054: expired → 403', async () => {
    const { token } = await setupManagerAndFamily('t054c');
    const request = await createConsentRequest(token, 't054c');

    // Expire the request (set created_at to satisfy constraint)
    await queryDb(
      `UPDATE guardian_consent_requests SET created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour' WHERE id = $1`,
      [request.id]
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        consentRequestId: request.id,
        accepted: true,
        noticeVersion: 'v1',
        noticeHash: getCurrentNoticeHash(),
        idempotencyKey: `cg-key-c-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('T054: duplicate grant → 409', async () => {
    const { token } = await setupManagerAndFamily('t054d');
    const request = await createConsentRequest(token, 't054d');

    // First grant succeeds
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        consentRequestId: request.id,
        accepted: true,
        noticeVersion: 'v1',
        noticeHash: getCurrentNoticeHash(),
        idempotencyKey: `cg-key-d1-${Date.now()}`,
      },
    });
    expect(res1.statusCode).toBe(201);

    // Second grant on same request → 409
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        consentRequestId: request.id,
        accepted: true,
        noticeVersion: 'v1',
        noticeHash: getCurrentNoticeHash(),
        idempotencyKey: `cg-key-d2-${Date.now()}`,
      },
    });
    expect(res2.statusCode).toBe(409);
  });

  it('T054: success writes GRANTED v1 with bound_person_id IS NULL', async () => {
    const { token } = await setupManagerAndFamily('t054e');
    const request = await createConsentRequest(token, 't054e');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        consentRequestId: request.id,
        accepted: true,
        noticeVersion: 'v1',
        noticeHash: getCurrentNoticeHash(),
        idempotencyKey: `cg-key-e-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.decision).toBe('GRANTED');
    expect(body.version).toBe(1);
    expect(body.boundPersonId).toBeNull();

    // Verify in DB
    const { rows } = await queryDb(
      `SELECT decision, version, bound_person_id, bound_at, notice_version, notice_hash
       FROM consent_records WHERE id = $1`,
      [body.id]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].decision).toBe('GRANTED');
    expect(rows[0].version).toBe(1);
    expect(rows[0].bound_person_id).toBeNull();
    expect(rows[0].bound_at).toBeNull();
    expect(rows[0].notice_version).toBe('v1');
    expect(rows[0].notice_hash).toBe(getCurrentNoticeHash());
  });
});
