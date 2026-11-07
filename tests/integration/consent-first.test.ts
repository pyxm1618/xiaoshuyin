/**
 * Consent-first integration tests (T056 RED→GREEN).
 *
 *   POST /families/:id/members with UNDER_14
 *   - No guardianConsentId → 403 GUARDIAN_CONSENT_REQUIRED, no person/profile
 *   - ageBandSource only GUARDIAN_RELAY / GUARDIAN_OBSERVATION (others → 422)
 *   - After consent granted, create succeeds with fixed order
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  createConsentRequest,
  createFamily,
  createMember,
  grantConsent,
  loginWithLabel,
  valueInput,
} from '../setup/api.js';

let verifyPool: pg.Pool;

async function queryDb(sql: string, params: unknown[] = []) {
  return verifyPool.query(sql, params);
}

describe('Consent-First Integration (T056)', () => {
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
    const { token, personId } = await loginWithLabel(app, `cf_${label}`);
    const famRes = await createFamily(app, token, label);
    expect(famRes.statusCode).toBe(201);
    return { token, personId, familyId: famRes.json().id as string };
  }

  async function createAndGrantConsent(token: string, label: string) {
    const reqRes = await createConsentRequest(app, token, label);
    expect(reqRes.statusCode).toBe(201);
    const grantRes = await grantConsent(app, token, label, reqRes.json().requestId);
    return grantRes.json();
  }

  it('T056: no guardianConsentId → 403, no person/profile created', async () => {
    const { token, familyId } = await setupManagerAndFamily('t056a');

    const beforeCount = await queryDb(
      'SELECT count(*) as cnt FROM family_members WHERE family_id = $1',
      [familyId]
    );

    const res = await createMember(app, token, familyId, 't056a', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('GUARDIAN_CONSENT_REQUIRED');

    const afterCount = await queryDb(
      'SELECT count(*) as cnt FROM family_members WHERE family_id = $1',
      [familyId]
    );
    expect(afterCount.rows[0].cnt).toBe(beforeCount.rows[0].cnt);
  });

  it('T056: ageBandSource only GUARDIAN_RELAY/OBSERVATION for UNDER_14', async () => {
    const { token, familyId } = await setupManagerAndFamily('t056b');

    const res = await createMember(app, token, familyId, 't056b1', {
      ageBand: 'UNDER_14',
      ageBandSource: 'SELF_STATEMENT',
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');

    const res2 = await createMember(app, token, familyId, 't056b2', {
      ageBand: 'UNDER_14',
      ageBandSource: 'OTHER_MEMBER_RELAY',
    });
    expect(res2.statusCode).toBe(422);
    expect(res2.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  it('T056: after consent granted, create succeeds', async () => {
    const { token, familyId, personId: guardianId } = await setupManagerAndFamily('t056c');

    const consent = await createAndGrantConsent(token, 't056c');
    expect(consent.decision).toBe('GRANTED');

    const res = await createMember(app, token, familyId, 't056c', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: consent.id,
      values: [valueInput('小朋友', 'GUARDIAN_RELAY')],
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.personId).toBeDefined();

    const { rows: consentRows } = await queryDb(
      'SELECT bound_person_id, bound_at FROM consent_records WHERE id = $1',
      [consent.id]
    );
    expect(consentRows[0].bound_person_id).toBe(body.personId);
    expect(consentRows[0].bound_at).not.toBeNull();

    const { rows: profileRows } = await queryDb(
      `SELECT age_band, minor_mode, guardian_person_id, guardian_consent_record_id
       FROM person_compliance_profiles WHERE person_id = $1`,
      [body.personId]
    );
    expect(profileRows[0].age_band).toBe('UNDER_14');
    expect(profileRows[0].minor_mode).toBe(true);
    expect(profileRows[0].guardian_person_id).toBe(guardianId);
    expect(profileRows[0].guardian_consent_record_id).toBe(consent.id);

    const { rows: timeRows } = await queryDb(
      `SELECT c.decided_at as consent_time, p.created_at as person_time
       FROM consent_records c, persons p
       WHERE c.id = $1 AND p.id = $2`,
      [consent.id, body.personId]
    );
    expect(new Date(timeRows[0].consent_time).getTime())
      .toBeLessThan(new Date(timeRows[0].person_time).getTime());
  });
});