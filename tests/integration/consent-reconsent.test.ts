/**
 * Re-consent subject validation (Independent Review Round 2 — new HIGH).
 *
 * contracts/consent-onboarding.md §6.1 distinguishes two modes:
 *   Mode A — first onboarding: `request.subject_person_id IS NULL` → GRANTED v1 unbound
 *   Mode B — re-consent:       `request.subject_person_id != NULL` → must fully validate
 *            the re-consent preconditions and continue the chain at v(N+1)
 *
 * Mode B MUST NOT silently fall back to Mode A. Any failed precondition rejects
 * the whole transaction: no consent record, request not marked GRANTED, no
 * profile pointer change.
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

describe('Re-consent subject validation (T057 / consent-onboarding §6.1)', () => {
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

  async function login(label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `rc_${label}_${Date.now()}` },
    });
    const { token, person } = res.json();
    return { token, personId: person.id as string };
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
        idempotencyKey: `fam-rc-${label}-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function createRequest(token: string, label: string, subjectPersonId?: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        noticeVersion: 'v1',
        ...(subjectPersonId ? { subjectPersonId } : {}),
        idempotencyKey: `cr-${label}-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json();
  }

  function grant(token: string, requestId: string, label: string) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        consentRequestId: requestId,
        accepted: true,
        noticeVersion: 'v1',
        noticeHash: getCurrentNoticeHash(),
        idempotencyKey: `cg-${label}-${Date.now()}`,
      },
    });
  }

  async function expectGrantRejectedWithoutSideEffects(
    label: string,
    subjectPersonId: string,
    expectedStatus: number,
    expectedCode: string
  ) {
    const { token } = await login(label);
    const familyId = await createFamily(token, label);
    const request = await createRequest(token, label, subjectPersonId);
    expect(request.id).toBeDefined();

    const beforeRecords = await queryDb(
      'SELECT count(*)::int AS cnt FROM consent_records WHERE family_id = $1',
      [familyId]
    );

    const res = await grant(token, request.id, label);
    expect(res.statusCode).toBe(expectedStatus);
    expect(res.json().code).toBe(expectedCode);

    // No consent record may be created by a rejected re-consent.
    const afterRecords = await queryDb(
      'SELECT count(*)::int AS cnt FROM consent_records WHERE family_id = $1',
      [familyId]
    );
    expect(afterRecords.rows[0].cnt).toBe(beforeRecords.rows[0].cnt);

    // The request must NOT have been marked GRANTED.
    const { rows: reqRows } = await queryDb(
      'SELECT status FROM guardian_consent_requests WHERE id = $1',
      [request.id]
    );
    expect(reqRows[0].status).toBe('PENDING');

    // The response must not leak any object reference.
    expect(JSON.stringify(res.json())).not.toContain(subjectPersonId);

    return { familyId, requestId: request.id };
  }

  it('Mode B: adult creator as subject → reject, no consent record, request stays PENDING', async () => {
    const { token, personId } = await login('adult-subject');
    const familyId = await createFamily(token, 'adult-subject');

    await expectGrantRejectedWithoutSideEffects(
      'adult-subject-grant',
      personId,
      422,
      'VALIDATION_ERROR'
    );
    expect(familyId).toBeTruthy();
  });

  it('Mode B: nonexistent subject → rejected, no leaked object data, no consent record', async () => {
    // `guardian_consent_requests.subject_person_id` has a FK to persons(id), so a
    // ghost subject cannot even be recorded. The whole flow must reject cleanly
    // without creating a consent record and without echoing the id back.
    const ghostId = '00000000-0000-4000-8000-0000000000aa';
    const { token } = await login('ghost-subject');
    const familyId = await createFamily(token, 'ghost-subject');

    const beforeRecords = await queryDb(
      'SELECT count(*)::int AS cnt FROM consent_records WHERE family_id = $1',
      [familyId]
    );

    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        noticeVersion: 'v1',
        subjectPersonId: ghostId,
        idempotencyKey: `cr-ghost-${Date.now()}`,
      },
    });
    expect(reqRes.statusCode).not.toBe(201);
    expect(JSON.stringify(reqRes.json())).not.toContain(ghostId);

    const afterRecords = await queryDb(
      'SELECT count(*)::int AS cnt FROM consent_records WHERE family_id = $1',
      [familyId]
    );
    expect(afterRecords.rows[0].cnt).toBe(beforeRecords.rows[0].cnt);
  });

  it('Mode B: subject outside the current family → reject with no leaked object data', async () => {
    // A real Person that exists, but belongs to a DIFFERENT family.
    const outsider = await login('outsider');
    const outsiderFamily = await createFamily(outsider.token, 'outsider-fam');
    const outsiderMember = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${outsiderFamily}/members`,
      headers: { authorization: `Bearer ${outsider.token}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_OBSERVATION',
        idempotencyKey: `mem-rc-out-${Date.now()}`,
      },
    });
    expect(outsiderMember.statusCode).toBe(201);
    const outsiderPersonId = outsiderMember.json().personId;

    await expectGrantRejectedWithoutSideEffects(
      'foreign-subject',
      outsiderPersonId,
      422,
      'VALIDATION_ERROR'
    );
  });

  it('Mode B: UNDER_14 whose current consent is still GRANTED → 409 conflict, no new version', async () => {
    const { token } = await login('still-granted');
    const familyId = await createFamily(token, 'still-granted');
    const reqA = await createRequest(token, 'still-granted-a');
    const grantA = await grant(token, reqA.id, 'still-granted-a');
    expect(grantA.statusCode).toBe(201);
    const consentId = grantA.json().id;

    const child = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        guardianConsentId: consentId,
        idempotencyKey: `mem-rc-sg-${Date.now()}`,
      },
    });
    expect(child.statusCode).toBe(201);
    const childId = child.json().personId;

    // Try to re-consent while the current version is still GRANTED.
    const reqB = await createRequest(token, 'still-granted-b', childId);
    const res = await grant(token, reqB.id, 'still-granted-b');
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('GUARDIAN_CONSENT_ALREADY_GRANTED');

    // Still exactly two consent rows (v1 GRANTED + nothing new).
    const { rows } = await queryDb(
      'SELECT decision, version FROM consent_records WHERE family_id = $1 ORDER BY version',
      [familyId]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].decision).toBe('GRANTED');
    expect(rows[0].version).toBe(1);
  });

  it('Mode A vs Mode B: subject_person_id IS NULL → unbound v1; non-null subject continues chain', async () => {
    const { token } = await login('mode-ab');
    const familyId = await createFamily(token, 'mode-ab');
    const reqA = await createRequest(token, 'mode-ab-a'); // Mode A
    const grantA = await grant(token, reqA.id, 'mode-ab-a');
    expect(grantA.statusCode).toBe(201);
    expect(grantA.json().version).toBe(1);
    expect(grantA.json().boundPersonId).toBeNull();

    const consentId = grantA.json().id;
    const child = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        guardianConsentId: consentId,
        idempotencyKey: `mem-rc-ab-${Date.now()}`,
      },
    });
    expect(child.statusCode).toBe(201);
    const childId = child.json().personId;

    const revoke = await app.inject({
      method: 'POST',
      url: `/api/v1/consents/${consentId}/revoke`,
      headers: { authorization: `Bearer ${token}` },
      payload: { idempotencyKey: `rv-rc-ab-${Date.now()}` },
    });
    expect(revoke.statusCode).toBe(200);
    expect(revoke.json().version).toBe(2);

    // Mode B: re-consent for the existing subject → v3, not a fresh v1.
    const reqB = await createRequest(token, 'mode-ab-b', childId);
    const grantB = await grant(token, reqB.id, 'mode-ab-b');
    expect(grantB.statusCode).toBe(201);
    expect(grantB.json().version).toBe(3);
    expect(grantB.json().boundPersonId).toBe(childId);

    const { rows } = await queryDb(
      `SELECT id, decision, version, supersedes_id, bound_person_id, onboarding_request_id
       FROM consent_records WHERE family_id = $1 ORDER BY version`,
      [familyId]
    );
    expect(rows.map((r: any) => r.version)).toEqual([1, 2, 3]);
    expect(rows[0].decision).toBe('GRANTED');
    expect(rows[1].decision).toBe('REVOKED');
    expect(rows[2].decision).toBe('GRANTED');
    expect(rows[1].supersedes_id).toBe(rows[0].id);
    expect(rows[2].supersedes_id).toBe(rows[1].id);
    expect(rows[2].bound_person_id).toBe(childId);
  });
});
