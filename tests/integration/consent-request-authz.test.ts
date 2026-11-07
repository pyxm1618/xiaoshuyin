/**
 * HIGH-01 remediation: real authorization matrix for
 * `POST /compliance/guardian-consents/requests`.
 *
 * Frozen action table (contracts/authorization-and-rls.md §2.3):
 *   GUARDIAN_CONSENT_REQUEST → membership + manager + actor age_band = ADULT.
 *
 * Each case uses real Account/Person/Family/Profile rows, not mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import { getCurrentNoticeHash } from '../../packages/compliance/src/notices.js';

let adminPool: pg.Pool;

describe('Consent request authorization matrix (HIGH-01)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    adminPool = createAdminPool();
  });

  afterAll(async () => {
    await adminPool.end();
    await app.close();
  });

  async function login(label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `cr-authz-${label}-${Date.now()}-${Math.random()}` },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    return { token: body.token as string, personId: body.person.id as string, accountId: body.account.id as string };
  }

  async function createFamily(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: `家庭-${label}`,
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        idempotencyKey: `fam-cr-authz-${label}-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  function requestConsent(token: string, label: string) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        noticeVersion: 'v1',
        idempotencyKey: `cr-authz-key-${label}-${Date.now()}-${Math.random()}`,
      },
    });
  }

  async function countPendingRequests(familyId: string): Promise<number> {
    const { rows } = await adminPool.query(
      `SELECT count(*)::int AS cnt FROM guardian_consent_requests
       WHERE family_id = $1 AND status = 'PENDING'`,
      [familyId]
    );
    return rows[0].cnt as number;
  }

  it('ADULT manager → 201', async () => {
    const mgr = await login('adult');
    const familyId = await createFamily(mgr.token, 'adult');

    const res = await requestConsent(mgr.token, 'adult');
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('PENDING');
    expect(await countPendingRequests(familyId)).toBe(1);
  });

  it('non-manager member → 403 NOT_FAMILY_MANAGER (membership is not manager)', async () => {
    const mgr = await login('mgr');
    const familyId = await createFamily(mgr.token, 'mgr');

    const member = await login('member');
    await adminPool.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [familyId, member.personId]
    );

    const res = await requestConsent(member.token, 'member');
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('NOT_FAMILY_MANAGER');
    expect(await countPendingRequests(familyId)).toBe(0);
  });

  it('manager but compliance profile missing → 403 (fail closed)', async () => {
    const actor = await login('missing-profile');
    const familyId = crypto.randomUUID();
    await adminPool.query(
      'INSERT INTO families (id, display_name, created_by_person_id) VALUES ($1, $2, $3)',
      [familyId, '家庭-missing-profile', actor.personId]
    );
    await adminPool.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [familyId, actor.personId]
    );

    const res = await requestConsent(actor.token, 'missing-profile');
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('AGE_BAND_UNKNOWN');
    expect(await countPendingRequests(familyId)).toBe(0);
  });

  it('manager with MINOR_14_17 profile → 403', async () => {
    const actor = await login('minor');
    const familyId = await createFamily(actor.token, 'minor');
    await adminPool.query(
      `UPDATE person_compliance_profiles
       SET age_band = 'MINOR_14_17', minor_mode = true
       WHERE person_id = $1`,
      [actor.personId]
    );

    const res = await requestConsent(actor.token, 'minor');
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('AGE_BAND_UNKNOWN');
    expect(await countPendingRequests(familyId)).toBe(0);
  });

  it('manager with UNKNOWN profile → 403 (UNKNOWN never treated as ADULT)', async () => {
    const actor = await login('unknown');
    const familyId = await createFamily(actor.token, 'unknown');
    await adminPool.query(
      `UPDATE person_compliance_profiles
       SET age_band = 'UNKNOWN', minor_mode = false
       WHERE person_id = $1`,
      [actor.personId]
    );

    const res = await requestConsent(actor.token, 'unknown');
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('AGE_BAND_UNKNOWN');
    expect(await countPendingRequests(familyId)).toBe(0);
  });

  it('manager with UNDER_14 profile (real consent chain) → 403', async () => {
    const actor = await login('under14');
    const familyId = await createFamily(actor.token, 'under14');

    const guardian = await login('under14-guardian');
    await adminPool.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [familyId, guardian.personId]
    );

    const noticeHash = getCurrentNoticeHash();
    const requestId = crypto.randomUUID();
    await adminPool.query(
      `INSERT INTO guardian_consent_requests
         (id, family_id, guardian_person_id, subject_person_id, declared_age_band,
          notice_version, notice_hash, status, expires_at, completed_at)
       VALUES ($1, $2, $3, $4, 'UNDER_14', 'v1', $5, 'GRANTED', now() + interval '1 hour', now())`,
      [requestId, familyId, guardian.personId, actor.personId, noticeHash]
    );

    const consentId = crypto.randomUUID();
    await adminPool.query(
      `INSERT INTO consent_records
         (id, family_id, guardian_person_id, guardian_account_id, purpose, decision,
          version, onboarding_request_id, bound_person_id, bound_at,
          notice_version, notice_hash, policy_version, evidence)
       VALUES ($1, $2, $3, $4, 'UNDER_14_GUARDIAN_CONSENT', 'GRANTED',
               1, $5, $6, now(), 'v1', $7, 'v1', '{}'::jsonb)`,
      [consentId, familyId, guardian.personId, guardian.accountId, requestId, actor.personId, noticeHash]
    );

    await adminPool.query(
      `UPDATE person_compliance_profiles
       SET age_band = 'UNDER_14', minor_mode = true, guardian_person_id = $1,
           guardian_consent_record_id = $2, guardian_consent_version = 1,
           verified_source = 'GUARDIAN_RELAY'
       WHERE person_id = $3`,
      [guardian.personId, consentId, actor.personId]
    );

    const res = await requestConsent(actor.token, 'under14');
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('AGE_BAND_UNKNOWN');
    expect(await countPendingRequests(familyId)).toBe(0);
  });
});