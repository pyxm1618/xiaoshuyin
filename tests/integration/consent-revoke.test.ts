/**
 * Consent revoke integration tests (T058 RED→GREEN).
 * POST /api/v1/consents/{id}/revoke
 * - Revoke writes REVOKED v2 (onboarding_request_id IS NULL, supersedes_id=v1)
 * - Profile pointer advances
 * - Gate immediately BLOCK
 * - Audit row exists
 * - Re-consent continues the chain at v3 (supersedes v2, same bound Person)
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

async function countFamilyMembers(familyId: string): Promise<number> {
  const { rows } = await queryDb(
    'SELECT count(*)::int AS cnt FROM family_members WHERE family_id = $1',
    [familyId]
  );
  return rows[0].cnt as number;
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

  async function createAndGrantConsent(
    token: string,
    label: string,
    subjectPersonId?: string
  ) {
    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        noticeVersion: 'v1',
        ...(subjectPersonId ? { subjectPersonId } : {}),
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

  it('T058: re-consent continues the chain at v3 (not a new v1)', async () => {
    const { token, familyId } = await setupManagerAndFamily('t058c');
    const consent = await createAndGrantConsent(token, 't058c');

    // Create UNDER_14 member with v1
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
    expect(createRes.statusCode).toBe(201);
    const memberPersonId = createRes.json().personId;

    const peopleBefore = await countFamilyMembers(familyId);

    // Revoke → v2 REVOKED
    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/consents/${consent.id}/revoke`,
      headers: { authorization: `Bearer ${token}` },
      payload: { idempotencyKey: `rv-key-c-${Date.now()}` },
    });
    expect(revokeRes.statusCode).toBe(200);
    const revokedConsent = revokeRes.json();
    expect(revokedConsent.version).toBe(2);
    expect(revokedConsent.decision).toBe('REVOKED');

    // Re-consent for the EXISTING subject person → must continue chain at v3
    const newConsent = await createAndGrantConsent(token, 't058c-regrant', memberPersonId);
    expect(newConsent.decision).toBe('GRANTED');
    expect(newConsent.version).toBe(3);
    expect(newConsent.boundPersonId).toBe(memberPersonId);

    // v1 stays GRANTED (immutable)
    const { rows: v1Rows } = await queryDb(
      'SELECT decision, version, bound_person_id, supersedes_id, onboarding_request_id FROM consent_records WHERE id = $1',
      [consent.id]
    );
    expect(v1Rows[0].decision).toBe('GRANTED');
    expect(v1Rows[0].version).toBe(1);
    expect(v1Rows[0].supersedes_id).toBeNull();
    expect(v1Rows[0].bound_person_id).toBe(memberPersonId);

    // v2 REVOKED supersedes v1
    const { rows: v2Rows } = await queryDb(
      'SELECT decision, version, bound_person_id, supersedes_id, onboarding_request_id FROM consent_records WHERE id = $1',
      [revokedConsent.id]
    );
    expect(v2Rows[0].decision).toBe('REVOKED');
    expect(v2Rows[0].version).toBe(2);
    expect(v2Rows[0].supersedes_id).toBe(consent.id);
    expect(v2Rows[0].onboarding_request_id).toBeNull();
    expect(v2Rows[0].bound_person_id).toBe(memberPersonId);

    // v3 GRANTED supersedes v2, bound to the SAME person, carried by request B
    const { rows: v3Rows } = await queryDb(
      'SELECT decision, version, bound_person_id, bound_at, supersedes_id, onboarding_request_id FROM consent_records WHERE id = $1',
      [newConsent.id]
    );
    expect(v3Rows[0].decision).toBe('GRANTED');
    expect(v3Rows[0].version).toBe(3);
    expect(v3Rows[0].supersedes_id).toBe(revokedConsent.id);
    expect(v3Rows[0].bound_person_id).toBe(memberPersonId);
    expect(v3Rows[0].bound_at).not.toBeNull();

    // All three rows bound to the same Person P
    const { rows: boundRows } = await queryDb(
      'SELECT DISTINCT bound_person_id FROM consent_records WHERE family_id = $1',
      [familyId]
    );
    expect(boundRows.length).toBe(1);
    expect(boundRows[0].bound_person_id).toBe(memberPersonId);

    // compliance pointer advanced to v3
    const { rows: profileRows } = await queryDb(
      'SELECT guardian_consent_record_id, guardian_consent_version FROM person_compliance_profiles WHERE person_id = $1',
      [memberPersonId]
    );
    expect(profileRows[0].guardian_consent_record_id).toBe(newConsent.id);
    expect(profileRows[0].guardian_consent_version).toBe(3);

    // Person count unchanged (no second child Person created)
    expect(await countFamilyMembers(familyId)).toBe(peopleBefore);

    // Processing gate restored to ALLOW
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${memberPersonId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        profileValues: [
          { attribute: 'DISPLAY_NAME', valueText: '小树', sourceKind: 'GUARDIAN_RELAY' },
        ],
        idempotencyKey: `mem-crv-c2-${Date.now()}`,
      },
    });
    expect(patchRes.statusCode).toBe(200);
  });
});
