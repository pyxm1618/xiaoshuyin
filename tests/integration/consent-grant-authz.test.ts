/**
 * F3: `GUARDIAN_CONSENT_GRANT` requires `actor.age_band = ADULT`.
 *
 * consent-onboarding.md §3 C2. The check is re-read inside the grant
 * transaction; a request-time ADULT result is never trusted.
 * All non-ADULT outcomes are HTTP 403 FORBIDDEN (no new error code).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import { getCurrentNoticeHash } from '../../packages/compliance/src/notices.js';
import {
  commandHeaders,
  createConsentRequest,
  createFamily,
  loginWithLabel,
} from '../setup/api.js';

let adminPool: pg.Pool;

describe('Guardian consent grant requires ADULT (F3)', () => {
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

  async function grant(token: string, label: string, requestId: string) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: commandHeaders(token, `cg-${label}`),
      payload: { onboardingRequestId: requestId, noticeVersion: 'v1', accepted: true },
    });
  }

  async function countConsents(familyId: string) {
    const { rows } = await adminPool.query(
      'SELECT count(*)::int AS cnt FROM consent_records WHERE family_id = $1',
      [familyId]
    );
    return rows[0].cnt as number;
  }

  async function requestStatus(requestId: string) {
    const { rows } = await adminPool.query(
      'SELECT status FROM guardian_consent_requests WHERE id = $1',
      [requestId]
    );
    return rows[0]?.status;
  }

  it('ADULT manager → 201', async () => {
    const actor = await loginWithLabel(app, 'f3_adult');
    const fam = await createFamily(app, actor.token, 'f3_adult');
    const req = await createConsentRequest(app, actor.token, 'f3_adult');
    expect(req.statusCode).toBe(201);

    const res = await grant(actor.token, 'f3_adult', req.json().requestId);
    expect(res.statusCode).toBe(201);
  });

  for (const band of ['UNKNOWN', 'MINOR_14_17'] as const) {
    it(`${band} → 403 FORBIDDEN and no consent row`, async () => {
      const actor = await loginWithLabel(app, `f3_${band}`);
      const fam = await createFamily(app, actor.token, `f3_${band}`);
      const familyId = fam.json().id as string;
      const req = await createConsentRequest(app, actor.token, `f3_${band}`);
      expect(req.statusCode).toBe(201);
      const requestId = req.json().requestId as string;

      await adminPool.query(
        `UPDATE person_compliance_profiles
         SET age_band = $1, minor_mode = $2
         WHERE person_id = $3`,
        [band, band === 'MINOR_14_17', actor.personId]
      );

      const before = await countConsents(familyId);
      const res = await grant(actor.token, `f3_${band}`, requestId);
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('FORBIDDEN');
      expect(await countConsents(familyId)).toBe(before);
      expect(await requestStatus(requestId)).toBe('PENDING');
    });
  }

  it('UNDER_14 → 403 FORBIDDEN and no consent row', async () => {
    const actor = await loginWithLabel(app, 'f3_under14');
    const fam = await createFamily(app, actor.token, 'f3_under14');
    const familyId = fam.json().id as string;
    const req = await createConsentRequest(app, actor.token, 'f3_under14');
    expect(req.statusCode).toBe(201);
    const requestId = req.json().requestId as string;

    // A separate guardian Person is required by the profile CHECK
    // (`guardian_person_id <> person_id`).
    const guardian = await loginWithLabel(app, 'f3_under14_guardian');
    await adminPool.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [familyId, guardian.personId]
    );

    const noticeHash = getCurrentNoticeHash();
    const consentId = crypto.randomUUID();
    await adminPool.query(
      `INSERT INTO consent_records
         (id, family_id, guardian_person_id, guardian_account_id, purpose, decision,
          version, onboarding_request_id, bound_person_id, bound_at,
          notice_version, notice_hash, policy_version, evidence)
       VALUES ($1, $2, $3, $4, 'UNDER_14_GUARDIAN_CONSENT', 'GRANTED',
               1, $5, $6, now(), 'v1', $7, 'v1', $8::jsonb)`,
      [
        consentId, familyId, guardian.personId, guardian.accountId, requestId, actor.personId,
        noticeHash,
        JSON.stringify({
          channel: 'TEST',
          accepted_text_hash: 'a'.repeat(64),
          declared_age_band: 'UNDER_14',
          client_ip_hash: 'b'.repeat(64),
          user_agent_hash: 'c'.repeat(64),
        }),
      ]
    );

    await adminPool.query(
      `UPDATE person_compliance_profiles
       SET age_band = 'UNDER_14', minor_mode = true,
           guardian_person_id = $1, guardian_consent_record_id = $2,
           guardian_consent_version = 1, verified_source = 'GUARDIAN_RELAY'
       WHERE person_id = $3`,
      [guardian.personId, consentId, actor.personId]
    );

    const before = await countConsents(familyId);
    const res = await grant(actor.token, 'f3_under14', requestId);
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
    // Only the fixture consent row exists; grant created nothing.
    expect(await countConsents(familyId)).toBe(before);
    expect(await requestStatus(requestId)).toBe('PENDING');
  });

  it('missing profile → 403 FORBIDDEN', async () => {
    const actor = await loginWithLabel(app, 'f3_noprofile');
    await createFamily(app, actor.token, 'f3_noprofile');
    const req = await createConsentRequest(app, actor.token, 'f3_noprofile');
    expect(req.statusCode).toBe(201);
    const requestId = req.json().requestId as string;

    await adminPool.query(
      'DELETE FROM person_compliance_profiles WHERE person_id = $1',
      [actor.personId]
    );

    const res = await grant(actor.token, 'f3_noprofile', requestId);
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
    expect(await requestStatus(requestId)).toBe('PENDING');
  });

  it('request-time ADULT is re-read at grant time (downgrade between request and grant)', async () => {
    const actor = await loginWithLabel(app, 'f3_reread');
    await createFamily(app, actor.token, 'f3_reread');
    const req = await createConsentRequest(app, actor.token, 'f3_reread');
    expect(req.statusCode).toBe(201);
    const requestId = req.json().requestId as string;

    await adminPool.query(
      `UPDATE person_compliance_profiles
       SET age_band = 'UNKNOWN', minor_mode = false
       WHERE person_id = $1`,
      [actor.personId]
    );

    const res = await grant(actor.token, 'f3_reread', requestId);
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
  });
});