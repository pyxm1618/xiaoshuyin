/**
 * Consent grant integration tests (T054 RED→GREEN).
 *
 * Frozen OpenAPI:
 *   GrantConsentRequest = { onboardingRequestId, noticeVersion, accepted: true }
 *   `Idempotency-Key` is an HTTP header.
 *   Response = ConsentRecord.
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
    const { token, personId } = await loginWithLabel(app, `cg_${label}`);
    const famRes = await createFamily(app, token, label);
    expect(famRes.statusCode).toBe(201);
    return { token, personId, familyId: famRes.json().id as string };
  }

  async function createRequest(token: string, label: string) {
    const res = await createConsentRequest(app, token, label);
    expect(res.statusCode).toBe(201);
    return res.json();
  }

  function grant(token: string, label: string, payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: commandHeaders(token, `cg-${label}`),
      payload,
    });
  }

  it('T054: accepted=true required', async () => {
    const { token } = await setupManagerAndFamily('t054a');
    const request = await createRequest(token, 't054a');

    const res = await grant(token, 't054a', {
      onboardingRequestId: request.requestId,
      noticeVersion: 'v1',
      accepted: false,
    });
    expect(res.statusCode).toBe(422);
  });

  it('T054: notice mismatch → 403', async () => {
    const { token } = await setupManagerAndFamily('t054b');
    const request = await createRequest(token, 't054b');

    const res = await grant(token, 't054b', {
      onboardingRequestId: request.requestId,
      noticeVersion: 'v999',
      accepted: true,
    });
    expect(res.statusCode).toBe(403);
  });

  it('T054: expired → 403', async () => {
    const { token } = await setupManagerAndFamily('t054c');
    const request = await createRequest(token, 't054c');

    await queryDb(
      `UPDATE guardian_consent_requests SET created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour' WHERE id = $1`,
      [request.requestId]
    );

    const res = await grant(token, 't054c', {
      onboardingRequestId: request.requestId,
      noticeVersion: 'v1',
      accepted: true,
    });
    expect(res.statusCode).toBe(403);
  });

  it('T054: duplicate grant → 409', async () => {
    const { token } = await setupManagerAndFamily('t054d');
    const request = await createRequest(token, 't054d');

    const res1 = await grant(token, 't054d-1', {
      onboardingRequestId: request.requestId,
      noticeVersion: 'v1',
      accepted: true,
    });
    expect(res1.statusCode).toBe(201);

    const res2 = await grant(token, 't054d-2', {
      onboardingRequestId: request.requestId,
      noticeVersion: 'v1',
      accepted: true,
    });
    expect(res2.statusCode).toBe(409);
  });

  it('T054: success writes GRANTED v1 with bound_person_id IS NULL', async () => {
    const { token } = await setupManagerAndFamily('t054e');
    const request = await createRequest(token, 't054e');

    const res = await grant(token, 't054e', {
      onboardingRequestId: request.requestId,
      noticeVersion: 'v1',
      accepted: true,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.purpose).toBe('UNDER_14_GUARDIAN_CONSENT');
    expect(body.decision).toBe('GRANTED');
    expect(body.version).toBe(1);
    expect(body.boundPersonId).toBeNull();
    expect(body.onboardingRequestId).toBe(request.requestId);
    expect(body.policyVersion).toBe('v1');
    expect(body.supersedesId).toBeNull();

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
    expect(rows[0].notice_hash).toBe(request.noticeHash);
  });
});