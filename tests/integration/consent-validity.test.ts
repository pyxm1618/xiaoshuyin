/**
 * F2 + F6: a consent may only be bound when it is the current, still-valid
 * chain head AND its persisted evidence passes the frozen `ConsentEvidence`
 * schema.
 *
 *   grant → revoke → old GRANTED bind → fail
 *   grant → expire  → bind → fail
 *   legacy `{accepted,timestamp}` evidence → bind fail (fail closed)
 *   valid grant → bind succeeds
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import { getCurrentNoticeHash } from '../../packages/compliance/src/notices.js';
import {
  createConsentRequest,
  createFamily,
  createMember,
  grantConsent,
  loginWithLabel,
  revokeConsent,
  updateMember,
} from '../setup/api.js';

let adminPool: pg.Pool;

async function queryDb(sql: string, params: unknown[] = []) {
  return adminPool.query(sql, params);
}

describe('Consent validity for UNDER_14 binding (F2 / F6)', () => {
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

  async function setup(label: string) {
    const actor = await loginWithLabel(app, `cv_${label}`);
    const fam = await createFamily(app, actor.token, `cv_${label}`);
    expect(fam.statusCode).toBe(201);
    return { ...actor, familyId: fam.json().id as string };
  }

  async function createGranted(actor: { token: string }, label: string) {
    const req = await createConsentRequest(app, actor.token, label);
    expect(req.statusCode).toBe(201);
    const grant = await grantConsent(app, actor.token, label, req.json().requestId);
    expect(grant.statusCode).toBe(201);
    return { requestId: req.json().requestId as string, consentId: grant.json().id as string };
  }

  it('grant → revoke → old GRANTED id cannot create an UNDER_14 child', async () => {
    const actor = await setup('revoked');
    const { consentId } = await createGranted(actor, 'cv_revoked');

    const revoke = await revokeConsent(app, actor.token, 'cv_revoked', consentId);
    expect(revoke.statusCode).toBe(200);

    const res = await createMember(app, actor.token, actor.familyId, 'cv_revoked', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: consentId,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('GUARDIAN_CONSENT_REQUIRED');

    const { rows } = await queryDb(
      'SELECT bound_person_id FROM consent_records WHERE id = $1',
      [consentId]
    );
    expect(rows[0].bound_person_id).toBeNull();
  });

  it('expired onboarding request cannot be bound', async () => {
    const actor = await setup('expired');
    const { consentId, requestId } = await createGranted(actor, 'cv_expired');

    await queryDb(
      `UPDATE guardian_consent_requests
       SET created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour'
       WHERE id = $1`,
      [requestId]
    );

    const res = await createMember(app, actor.token, actor.familyId, 'cv_expired', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: consentId,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('GUARDIAN_CONSENT_REQUIRED');
  });

  it('legacy malformed evidence fails closed at first bind', async () => {
    const actor = await setup('legacy');
    const req = await createConsentRequest(app, actor.token, 'cv_legacy');
    expect(req.statusCode).toBe(201);
    const requestId = req.json().requestId as string;

    const legacyConsentId = crypto.randomUUID();
    await queryDb(
      `INSERT INTO consent_records
         (id, family_id, guardian_person_id, guardian_account_id, purpose, decision,
          version, onboarding_request_id, bound_person_id, bound_at,
          notice_version, notice_hash, policy_version, evidence)
       VALUES ($1, $2, $3, $4, 'UNDER_14_GUARDIAN_CONSENT', 'GRANTED',
               1, $5, NULL, NULL, 'v1', $6, 'v1',
               '{"accepted":true,"timestamp":"2026-01-01T00:00:00.000Z"}'::jsonb)`,
      [legacyConsentId, actor.familyId, actor.personId, actor.accountId, requestId, getCurrentNoticeHash()]
    );

    const res = await createMember(app, actor.token, actor.familyId, 'cv_legacy', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: legacyConsentId,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('GUARDIAN_CONSENT_REQUIRED');

    // The legacy row is NOT silently repaired.
    const { rows } = await queryDb(
      'SELECT evidence FROM consent_records WHERE id = $1',
      [legacyConsentId]
    );
    expect(rows[0].evidence).toEqual({
      accepted: true,
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  it('a valid granted consent still binds successfully', async () => {
    const actor = await setup('valid');
    const { consentId } = await createGranted(actor, 'cv_valid');

    const res = await createMember(app, actor.token, actor.familyId, 'cv_valid', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: consentId,
    });
    expect(res.statusCode).toBe(201);
  });

  it('legacy malformed evidence blocks the processing gate', async () => {
    const actor = await setup('legacygate');
    const { childPersonId, consentId } = await (async () => {
      const { consentId: id } = await createGranted(actor, 'cv_legacygate');
      const child = await createMember(app, actor.token, actor.familyId, 'cv_legacygate', {
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        guardianConsentId: id,
      });
      expect(child.statusCode).toBe(201);
      return { childPersonId: child.json().personId as string, consentId: id };
    })();
    expect(consentId).toBeTruthy();

    // A second onboarding request carries a legacy-evidence GRANTED v2 that
    // becomes the profile's current pointer.
    const req = await createConsentRequest(app, actor.token, 'cv_legacygate2');
    expect(req.statusCode).toBe(201);

    const legacyId = crypto.randomUUID();
    await queryDb(
      `INSERT INTO consent_records
         (id, family_id, guardian_person_id, guardian_account_id, purpose, decision,
          version, onboarding_request_id, bound_person_id, bound_at,
          notice_version, notice_hash, policy_version, evidence)
       VALUES ($1, $2, $3, $4, 'UNDER_14_GUARDIAN_CONSENT', 'GRANTED',
               2, $5, $6, now(), 'v1', $7, 'v1',
               '{"accepted":true,"timestamp":"2026-01-01T00:00:00.000Z"}'::jsonb)`,
      [legacyId, actor.familyId, actor.personId, actor.accountId, req.json().requestId, childPersonId, getCurrentNoticeHash()]
    );

    await queryDb(
      `UPDATE person_compliance_profiles
       SET guardian_consent_record_id = $1, guardian_consent_version = 2
       WHERE person_id = $2`,
      [legacyId, childPersonId]
    );

    const res = await updateMember(app, actor.token, actor.familyId, childPersonId, 'cv_legacygate', [
      { attribute: 'DISPLAY_NAME', value: 'blocked', source: 'GUARDIAN_RELAY' },
    ]);
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('GUARDIAN_CONSENT_REQUIRED');
  });
});