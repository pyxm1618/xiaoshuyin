/**
 * Consent-first integration tests (T056 RED→GREEN).
 * POST /api/v1/families/:id/members with UNDER_14
 * - No guardianConsentId → 403 GUARDIAN_CONSENT_REQUIRED, no person/profile created
 * - ageBandSource only GUARDIAN_RELAY / GUARDIAN_OBSERVATION (others → 422)
 * - After consent granted, create succeeds with fixed order
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { getCurrentNoticeHash } from '../../packages/compliance/src/notices.js';

let verifyPool: pg.Pool;

async function queryDb(sql: string, params: unknown[] = []) {
  return verifyPool.query(sql, params);
}

describe('Consent-First Integration (T056)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = new pg.Pool({
      connectionString: 'postgres://postgres:postgres@localhost:5433/xiaoshuyin_test',
      max: 5,
    });
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  async function setupManagerAndFamily(label: string) {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `cf_${label}_${Date.now()}` },
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
        idempotencyKey: `fam-cf-${label}-${Date.now()}`,
      },
    });
    const family = famRes.json();
    return { token, personId: person.id, familyId: family.id };
  }

  async function createAndGrantConsent(token: string, label: string) {
    // Create request
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

    // Grant
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

  it('T056: no guardianConsentId → 403, no person/profile created', async () => {
    const { token, familyId } = await setupManagerAndFamily('t056a');

    // Count family members before
    const beforeCount = await queryDb(
      'SELECT count(*) as cnt FROM family_members WHERE family_id = $1',
      [familyId]
    );

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        // no guardianConsentId
        idempotencyKey: `mem-cf-a-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('GUARDIAN_CONSENT_REQUIRED');

    // No new family member should be created
    const afterCount = await queryDb(
      'SELECT count(*) as cnt FROM family_members WHERE family_id = $1',
      [familyId]
    );
    expect(afterCount.rows[0].cnt).toBe(beforeCount.rows[0].cnt);
  });

  it('T056: ageBandSource only GUARDIAN_RELAY/OBSERVATION for UNDER_14', async () => {
    const { token, familyId } = await setupManagerAndFamily('t056b');

    // SELF_STATEMENT not allowed for UNDER_14
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'SELF_STATEMENT',
        idempotencyKey: `mem-cf-b1-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');

    // OTHER_MEMBER_RELAY not allowed for UNDER_14
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'OTHER_MEMBER_RELAY',
        idempotencyKey: `mem-cf-b2-${Date.now()}`,
      },
    });
    expect(res2.statusCode).toBe(422);
    expect(res2.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  it('T056: after consent granted, create succeeds', async () => {
    const { token, familyId, personId: guardianId } = await setupManagerAndFamily('t056c');

    // Create and grant consent
    const consent = await createAndGrantConsent(token, 't056c');
    expect(consent.decision).toBe('GRANTED');

    // Now create UNDER_14 member with consent
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        guardianConsentId: consent.id,
        profileValues: [
          {
            attribute: 'DISPLAY_NAME',
            valueText: '小朋友',
            sourceKind: 'GUARDIAN_RELAY',
          },
        ],
        idempotencyKey: `mem-cf-c-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.personId).toBeDefined();

    // Verify consent is bound to the person
    const { rows: consentRows } = await queryDb(
      'SELECT bound_person_id, bound_at FROM consent_records WHERE id = $1',
      [consent.id]
    );
    expect(consentRows[0].bound_person_id).toBe(body.personId);
    expect(consentRows[0].bound_at).not.toBeNull();

    // Verify profile has UNDER_14 with guardian
    const { rows: profileRows } = await queryDb(
      `SELECT age_band, minor_mode, guardian_person_id, guardian_consent_record_id
       FROM person_compliance_profiles WHERE person_id = $1`,
      [body.personId]
    );
    expect(profileRows[0].age_band).toBe('UNDER_14');
    expect(profileRows[0].minor_mode).toBe(true);
    expect(profileRows[0].guardian_person_id).toBe(guardianId);
    expect(profileRows[0].guardian_consent_record_id).toBe(consent.id);

    // Verify decided_at < person.created_at (consent-first)
    const { rows: timeRows } = await queryDb(
      `SELECT c.decided_at as consent_time, p.created_at as person_time
       FROM consent_records c, persons p
       WHERE c.id = $1 AND p.id = $2`,
      [consent.id, body.personId]
    );
    expect(new Date(timeRows[0].consent_time).getTime())
      .toBeLessThanOrEqual(new Date(timeRows[0].person_time).getTime());
  });
});
