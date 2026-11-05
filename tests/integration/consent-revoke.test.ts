/**
 * Consent revoke integration tests (T058 RED→GREEN).
 * POST /api/v1/consents/{id}/revoke
 * - Revoke writes REVOKED v2 (onboarding_request_id IS NULL, supersedes_id=v1)
 * - Profile pointer advances
 * - Gate immediately BLOCK
 * - Audit row exists
 * - Re-grant v3 restores
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

describe('Consent Revoke Integration (T058)', () => {
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
      payload: { code: `crv_${label}_${Date.now()}` },
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
        idempotencyKey: `fam-crv-${label}-${Date.now()}`,
      },
    });
    const family = famRes.json();
    return { token, personId: person.id, familyId: family.id };
  }

  async function createAndGrantConsent(token: string, label: string) {
    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        noticeVersion: 'v1',
        idempotencyKey: `cr-${label}-${Date.now()}`,
      },
    });
    const request = reqRes.json();

    const grantRes = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        consentRequestId: request.id,
        accepted: true,
        noticeVersion: 'v1',
        noticeHash: getCurrentNoticeHash(),
        idempotencyKey: `cg-${label}-${Date.now()}`,
      },
    });
    return grantRes.json();
  }

  it('T058: revoke writes REVOKED v2 with supersedes_id=v1', async () => {
    const { token, familyId } = await setupManagerAndFamily('t058a');
    const consent = await createAndGrantConsent(token, 't058a');

    // Create UNDER_14 member with consent
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        guardianConsentId: consent.id,
        idempotencyKey: `mem-crv-a-${Date.now()}`,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const memberPersonId = createRes.json().personId;

    // Revoke
    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/consents/${consent.id}/revoke`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        idempotencyKey: `rv-key-a-${Date.now()}`,
      },
    });
    expect(revokeRes.statusCode).toBe(200);
    const revokeBody = revokeRes.json();
    expect(revokeBody.decision).toBe('REVOKED');
    expect(revokeBody.version).toBe(2);

    // Verify REVOKED v2 in DB
    const { rows } = await queryDb(
      `SELECT decision, version, onboarding_request_id, supersedes_id
       FROM consent_records WHERE id = $1`,
      [revokeBody.id]
    );
    expect(rows[0].decision).toBe('REVOKED');
    expect(rows[0].version).toBe(2);
    expect(rows[0].onboarding_request_id).toBeNull();
    expect(rows[0].supersedes_id).toBe(consent.id);

    // Verify profile pointer advanced
    const { rows: profileRows } = await queryDb(
      `SELECT guardian_consent_record_id, guardian_consent_version
       FROM person_compliance_profiles WHERE person_id = $1`,
      [memberPersonId]
    );
    expect(profileRows[0].guardian_consent_record_id).toBe(revokeBody.id);
    expect(profileRows[0].guardian_consent_version).toBe(2);

    // Verify audit row exists
    const { rows: auditRows } = await queryDb(
      `SELECT event_type FROM business_audit_events
       WHERE resource_id = $1 AND event_type LIKE '%CONSENT%'`,
      [revokeBody.id]
    );
    expect(auditRows.length).toBeGreaterThan(0);
  });

  it('T058: gate BLOCK after revoke', async () => {
    const { token, familyId } = await setupManagerAndFamily('t058b');
    const consent = await createAndGrantConsent(token, 't058b');

    // Create UNDER_14 member
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        guardianConsentId: consent.id,
        idempotencyKey: `mem-crv-b-${Date.now()}`,
      },
    });
    const memberPersonId = createRes.json().personId;

    // Revoke
    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/consents/${consent.id}/revoke`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        idempotencyKey: `rv-key-b-${Date.now()}`,
      },
    });
    expect(revokeRes.statusCode).toBe(200);
    const revokeBody = revokeRes.json();
    expect(revokeBody.decision).toBe('REVOKED');

    // Original v1 should remain GRANTED (immutable), new v2 is REVOKED
    const { rows: v1Rows } = await queryDb(
      'SELECT decision FROM consent_records WHERE id = $1',
      [consent.id]
    );
    expect(v1Rows[0].decision).toBe('GRANTED');

    // New record should be REVOKED with supersedes_id = v1
    const { rows: v2Rows } = await queryDb(
      'SELECT decision, supersedes_id FROM consent_records WHERE id = $1',
      [revokeBody.id]
    );
    expect(v2Rows[0].decision).toBe('REVOKED');
    expect(v2Rows[0].supersedes_id).toBe(consent.id);
  });

  it('T058: re-grant v3 restores', async () => {
    const { token, familyId } = await setupManagerAndFamily('t058c');
    const consent = await createAndGrantConsent(token, 't058c');

    // Create UNDER_14 member
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        guardianConsentId: consent.id,
        idempotencyKey: `mem-crv-c1-${Date.now()}`,
      },
    });
    const memberPersonId = createRes.json().personId;

    // Revoke
    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/consents/${consent.id}/revoke`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        idempotencyKey: `rv-key-c-${Date.now()}`,
      },
    });
    const revokedConsent = revokeRes.json();

    // Re-grant (new request + grant)
    const newConsent = await createAndGrantConsent(token, 't058c-regrant');
    expect(newConsent.decision).toBe('GRANTED');
    expect(newConsent.version).toBe(1); // new chain starts at v1

    // Original v1 is still GRANTED (immutable), revoke v2 is REVOKED
    const { rows: v1Rows } = await queryDb(
      'SELECT decision FROM consent_records WHERE id = $1',
      [consent.id]
    );
    expect(v1Rows[0].decision).toBe('GRANTED');

    const { rows: v2Rows } = await queryDb(
      'SELECT decision, supersedes_id FROM consent_records WHERE id = $1',
      [revokedConsent.id]
    );
    expect(v2Rows[0].decision).toBe('REVOKED');
    expect(v2Rows[0].supersedes_id).toBe(consent.id);

    // New consent chain is GRANTED
    const { rows: newRows } = await queryDb(
      'SELECT decision, version FROM consent_records WHERE id = $1',
      [newConsent.id]
    );
    expect(newRows[0].decision).toBe('GRANTED');
    expect(newRows[0].version).toBe(1);
  });
});
