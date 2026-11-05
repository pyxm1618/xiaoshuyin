/**
 * T062: Authorization dimensions integration tests.
 *
 * Proves that "guardian" and "family membership" are two INDEPENDENT
 * dimensions — neither one can substitute for the other.
 *
 *   FR-006a  guardian-but-not-member  → no Family access
 *   FR-006b  member-but-not-guardian → no guardian authority (NOT_GUARDIAN)
 *
 * Fixtures are inserted with the test-only superuser pool so that a real
 * Account-backed Person can be made a Family member without bypassing any
 * application-level authorization check.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import type pg from 'pg';

let verifyPool: pg.Pool;

describe('Authorization Dimensions (T062)', () => {
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

  async function login(code: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `t062_${code}_${Date.now()}` },
    });
    const { token, person } = res.json();
    return { token, personId: person.id as string };
  }

  async function createFamily(token: string, label: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: `家庭-${label}`,
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        idempotencyKey: `fam-t062-${label}-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  function auth(token: string) {
    return { authorization: `Bearer ${token}` };
  }

  async function noticeHash(token: string): Promise<string> {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/notices',
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    return res.json().notices[0].hash as string;
  }

  async function createConsentRequest(token: string, label: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents/requests',
      headers: auth(token),
      payload: { noticeVersion: 'v1', idempotencyKey: `cr-t062-${label}-${Date.now()}` },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function grantConsent(token: string, requestId: string, label: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: auth(token),
      payload: {
        consentRequestId: requestId,
        accepted: true,
        noticeVersion: 'v1',
        noticeHash: await noticeHash(token),
        idempotencyKey: `cg-t062-${label}-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  /** Make an existing Account-backed Person a real member of the Family. */
  async function addRealMember(familyId: string, personId: string): Promise<void> {
    await verifyPool.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [familyId, personId]
    );
  }

  // ── FR-006a: guardian relationship does NOT grant Family access ──

  it('T062: guardian-but-not-member cannot access another Family (403, no target fields)', async () => {
    const { token: bToken } = await login('famb');
    const famBId = await createFamily(bToken, 'famb');

    // Family A's actor is a genuine guardian: she owns a GRANTED consent record.
    const { token: aToken, personId: aPersonId } = await login('fama');
    const famAId = await createFamily(aToken, 'fama');
    const reqId = await createConsentRequest(aToken, 'fama');
    const consentId = await grantConsent(aToken, reqId, 'fama');

    // Sanity: the guardian dimension really exists for actor A.
    const { rows } = await verifyPool.query(
      'SELECT guardian_person_id FROM consent_records WHERE id = $1',
      [consentId]
    );
    expect(rows[0].guardian_person_id).toBe(aPersonId);

    // Actor A tries to write into Family B using her own guardian consent.
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${famBId}/members`,
      headers: auth(aToken),
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        guardianConsentId: consentId,
        idempotencyKey: `guard-nm-${Date.now()}`,
      },
    });

    expect(res.statusCode).toBe(403);
    expect(['NOT_FAMILY_MEMBER', 'NOT_FAMILY_MANAGER', 'GUARDIAN_CONSENT_REQUIRED']).toContain(res.json().code);
    // 403 body must not leak any field of the target Family.
    const dumped = JSON.stringify(res.json());
    expect(dumped).not.toContain(famBId);
    expect(dumped).not.toContain(famAId);

    // No child Person was created in Family B by the non-member guardian.
    const { rows: members } = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM family_members WHERE family_id = $1',
      [famBId]
    );
    expect(members[0].cnt).toBe(1);

    console.log(
      '[T062 FR-006a] 判定依据: actor A 持有 GRANTED consent (guardian_person_id=A), ' +
      `但非 Family B 成员 → POST /families/${famBId}/members = 403 ${res.json().code}; ` +
      'guardian 关系未产生 Family 访问权，且响应体无目标 Family 字段。'
    );
  });

  // ── FR-006b: family membership does NOT grant guardian authority ──

  it('T062: member-but-not-guardian grant → NOT_GUARDIAN', async () => {
    const { token: mgrToken, personId: mgrPersonId } = await login('mgr');
    const famId = await createFamily(mgrToken, 'mgr');
    const reqId = await createConsentRequest(mgrToken, 'mgr');

    // Outsider has a real Account + Person and IS a member of this Family,
    // but is NOT the guardian of the consent request.
    const { token: memberToken, personId: memberPersonId } = await login('member');
    await addRealMember(famId, memberPersonId);

    // Sanity: membership exists, guardian identity differs.
    const { rows: membership } = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM family_members WHERE family_id = $1 AND person_id = $2',
      [famId, memberPersonId]
    );
    expect(membership[0].cnt).toBe(1);
    expect(memberPersonId).not.toBe(mgrPersonId);

    const grantRes = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: auth(memberToken),
      payload: {
        consentRequestId: reqId,
        accepted: true,
        noticeVersion: 'v1',
        noticeHash: await noticeHash(memberToken),
        idempotencyKey: `cg-ng-${Date.now()}`,
      },
    });

    expect(grantRes.statusCode).toBe(403);
    expect(grantRes.json().code).toBe('NOT_GUARDIAN');
    expect(JSON.stringify(grantRes.json())).not.toContain(reqId);

    // The request stays PENDING — membership did not create guardian authority.
    const { rows: pending } = await verifyPool.query(
      "SELECT count(*)::int AS cnt FROM guardian_consent_requests WHERE id = $1 AND status = 'PENDING'",
      [reqId]
    );
    expect(pending[0].cnt).toBe(1);

    console.log(
      '[T062 FR-006b] 判定依据: actor 是 Family 成员 (family_members 命中 1 行) 但不是 ' +
      `guardian_person_id (${mgrPersonId}) → POST /compliance/guardian-consents = 403 NOT_GUARDIAN; ` +
      'membership 未产生 guardian authority，request 仍为 PENDING。'
    );
  });

  it('T062: member-but-not-guardian revoke → NOT_GUARDIAN', async () => {
    const { token: mgrToken } = await login('mgr2');
    const famId = await createFamily(mgrToken, 'mgr2');
    const reqId = await createConsentRequest(mgrToken, 'mgr2');
    const consentId = await grantConsent(mgrToken, reqId, 'mgr2');

    const { token: memberToken, personId: memberPersonId } = await login('member2');
    await addRealMember(famId, memberPersonId);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/consents/${consentId}/revoke`,
      headers: auth(memberToken),
      payload: { idempotencyKey: `rv-ng-${Date.now()}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('NOT_GUARDIAN');

    // The GRANTED consent is unchanged (v1 still the only version).
    const { rows } = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM consent_records WHERE family_id = $1',
      [famId]
    );
    expect(rows[0].cnt).toBe(1);
  });

  it('T062: membership alone cannot create an UNDER_14 child without consent', async () => {
    const { token: mgrToken } = await login('dim');
    const famId = await createFamily(mgrToken, 'dim');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${famId}/members`,
      headers: auth(mgrToken),
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        idempotencyKey: `mem-dim-${Date.now()}`,
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('GUARDIAN_CONSENT_REQUIRED');

    const { rows } = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM family_members WHERE family_id = $1',
      [famId]
    );
    expect(rows[0].cnt).toBe(1);
  });

  it('T062: guardian consent from Family A cannot be consumed inside Family B', async () => {
    const { token: aToken } = await login('crossa');
    const famAId = await createFamily(aToken, 'crossa');
    const aReqId = await createConsentRequest(aToken, 'crossa');
    const aConsentId = await grantConsent(aToken, aReqId, 'crossa');

    const { token: bToken } = await login('crossb');
    const famBId = await createFamily(bToken, 'crossb');

    // Family B manager tries to use Family A's guardian consent.
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${famBId}/members`,
      headers: auth(bToken),
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        guardianConsentId: aConsentId,
        idempotencyKey: `mem-cross-${Date.now()}`,
      },
    });

    expect([403, 404]).toContain(res.statusCode);
    expect(res.json().code).not.toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    // No UNDER_14 Person was created in Family B; consent stays unbound.
    const { rows: famBMembers } = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM family_members WHERE family_id = $1',
      [famBId]
    );
    expect(famBMembers[0].cnt).toBe(1);
    const { rows: bound } = await verifyPool.query(
      'SELECT bound_person_id FROM consent_records WHERE id = $1',
      [aConsentId]
    );
    expect(bound[0].bound_person_id).toBeNull();
    expect(famAId).not.toBe(famBId);
  });
});
