/**
 * Processing-gate integration tests (Independent Review CRITICAL).
 *
 * PATCH /api/v1/families/:id/members/:personId must run the frozen
 * `assertMinorProcessingAllowed` gate before any profile-value write.
 * When the target Person's current consent pointer is no longer GRANTED
 * (i.e. after revoke), further processing MUST be blocked with no side effects.
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

describe('UNDER_14 Processing Gate (T059 / FR-010)', () => {
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
      payload: { code: `pg_${label}_${Date.now()}` },
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
        idempotencyKey: `fam-pg-${label}-${Date.now()}`,
      },
    });
    return { token, personId: person.id, familyId: famRes.json().id };
  }

  async function grantConsent(token: string, label: string, subjectPersonId?: string) {
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
    expect(reqRes.statusCode, `createRequest failed: ${reqRes.body}`).toBe(201);
    const grantRes = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        consentRequestId: reqRes.json().id,
        accepted: true,
        noticeVersion: 'v1',
        noticeHash: getCurrentNoticeHash(),
        idempotencyKey: `cg-${label}-${Date.now()}`,
      },
    });
    expect(grantRes.statusCode, `grant failed: ${grantRes.body}`).toBe(201);
    return grantRes.json();
  }

  async function createUnder14(token: string, familyId: string, consentId: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        guardianConsentId: consentId,
        profileValues: [
          { attribute: 'DISPLAY_NAME', valueText: '小树', sourceKind: 'GUARDIAN_RELAY' },
        ],
        idempotencyKey: `mem-${label}-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().personId as string;
  }

  function patchName(token: string, familyId: string, personId: string, value: string, key: string) {
    return app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${personId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        profileValues: [{ attribute: 'DISPLAY_NAME', valueText: value, sourceKind: 'GUARDIAN_RELAY' }],
        idempotencyKey: key,
      },
    });
  }

  it('GRANTED → PATCH profile value succeeds', async () => {
    const { token, familyId } = await setupManagerAndFamily('grant');
    const consent = await grantConsent(token, 'grant');
    const childId = await createUnder14(token, familyId, consent.id, 'grant');

    const res = await patchName(token, familyId, childId, '小树-2', `pg-grant-${Date.now()}`);
    expect(res.statusCode).toBe(200);

    const { rows } = await queryDb(
      `SELECT value_text, status FROM person_profile_values
       WHERE person_id = $1 AND attribute = 'DISPLAY_NAME' AND status = 'RECORDED'`,
      [childId]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].value_text).toBe('小树-2');
  });

  it('revoke → PATCH same child blocked, no supersede / no insert / no audit', async () => {
    const { token, familyId } = await setupManagerAndFamily('block');
    const consent = await grantConsent(token, 'block');
    const childId = await createUnder14(token, familyId, consent.id, 'block');

    const beforeValues = await queryDb(
      'SELECT id, value_text, status, supersedes_id FROM person_profile_values WHERE person_id = $1 ORDER BY id',
      [childId]
    );
    const beforeAudit = await queryDb(
      `SELECT count(*)::int AS cnt FROM business_audit_events
       WHERE resource_id = $1 AND event_type = 'MEMBER_PROFILE_VALUE_RECORDED'`,
      [childId]
    );

    // Revoke consent → gate must block immediately
    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/consents/${consent.id}/revoke`,
      headers: { authorization: `Bearer ${token}` },
      payload: { idempotencyKey: `pg-revoke-${Date.now()}` },
    });
    expect(revokeRes.statusCode).toBe(200);

    const patchRes = await patchName(token, familyId, childId, '小树-hack', `pg-block-${Date.now()}`);
    expect(patchRes.statusCode).toBe(403);
    expect(patchRes.json().code).toBe('GUARDIAN_CONSENT_REVOKED');

    // No supersede, no new value, no success audit
    const afterValues = await queryDb(
      'SELECT id, value_text, status, supersedes_id FROM person_profile_values WHERE person_id = $1 ORDER BY id',
      [childId]
    );
    expect(afterValues.rows.map((r: any) => [r.id, r.value_text, r.status, r.supersedes_id]))
      .toEqual(beforeValues.rows.map((r: any) => [r.id, r.value_text, r.status, r.supersedes_id]));

    const afterAudit = await queryDb(
      `SELECT count(*)::int AS cnt FROM business_audit_events
       WHERE resource_id = $1 AND event_type = 'MEMBER_PROFILE_VALUE_RECORDED'`,
      [childId]
    );
    expect(afterAudit.rows[0].cnt).toBe(beforeAudit.rows[0].cnt);
  });

  it('re-consent v3 → processing restored', async () => {
    const { token, familyId } = await setupManagerAndFamily('restore');
    const consent = await grantConsent(token, 'restore');
    const childId = await createUnder14(token, familyId, consent.id, 'restore');

    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/consents/${consent.id}/revoke`,
      headers: { authorization: `Bearer ${token}` },
      payload: { idempotencyKey: `pg-revoke2-${Date.now()}` },
    });
    expect(revokeRes.statusCode).toBe(200);

    const blocked = await patchName(token, familyId, childId, 'x', `pg-block2-${Date.now()}`);
    expect(blocked.statusCode).toBe(403);

    // Re-consent for the existing subject → v3
    const v3 = await grantConsent(token, 'restore-re', childId);
    expect(v3.version).toBe(3);
    expect(v3.boundPersonId).toBe(childId);

    const ok = await patchName(token, familyId, childId, '小树-restored', `pg-restore-${Date.now()}`);
    expect(ok.statusCode).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────
// Concurrency regression (Independent Review Round 2 — CRITICAL)
//
// Serialization primitive is the `person_compliance_profiles` row:
// the processing gate must hold it (FOR UPDATE) for the whole PATCH
// transaction, so revoke's pointer advance cannot commit underneath a
// PATCH that already observed the old GRANTED state.
//
// Deterministic orchestration: a row lock on an existing profile value
// is the barrier that parks the real PATCH mid-transaction (after its
// gate read, before its commit). No blind sleeps.
// ─────────────────────────────────────────────────────────────

function track<T>(p: Promise<T>) {
  const state: { settled: boolean; value?: T; error?: unknown; promise: Promise<T> } = {
    settled: false,
    promise: p,
  };
  p.then(
    (v) => { state.settled = true; state.value = v; },
    (e) => { state.settled = true; state.error = e; }
  );
  return state;
}

/** Poll pg_stat_activity for a real backend blocked on a row lock of `pattern`. */
async function waitForBlockedOn(pattern: string, maxMs = 5000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const { rows } = await verifyPool.query(
      `SELECT count(*)::int AS cnt FROM pg_stat_activity
       WHERE pid != pg_backend_pid()
         AND state = 'active'
         AND wait_event_type = 'Lock'
         AND query ILIKE $1`,
      [`%${pattern}%`]
    );
    if (rows[0].cnt > 0) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

describe('UNDER_14 Processing Gate — concurrency (T059)', () => {
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
      payload: { code: `pgc_${label}_${Date.now()}` },
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
        idempotencyKey: `fam-pgc-${label}-${Date.now()}`,
      },
    });
    return { token, personId: person.id, familyId: famRes.json().id };
  }

  async function grantConsent(token: string, label: string, subjectPersonId?: string) {
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
    expect(reqRes.statusCode, `createRequest failed: ${reqRes.body}`).toBe(201);
    const grantRes = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        consentRequestId: reqRes.json().id,
        accepted: true,
        noticeVersion: 'v1',
        noticeHash: getCurrentNoticeHash(),
        idempotencyKey: `cg-${label}-${Date.now()}`,
      },
    });
    expect(grantRes.statusCode, `grant failed: ${grantRes.body}`).toBe(201);
    return grantRes.json();
  }

  async function createUnder14(token: string, familyId: string, consentId: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        guardianConsentId: consentId,
        profileValues: [
          { attribute: 'DISPLAY_NAME', valueText: '小树', sourceKind: 'GUARDIAN_RELAY' },
        ],
        idempotencyKey: `mem-${label}-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().personId as string;
  }

  /**
   * Scenario A + forbidden-interleaving proof.
   *
   * A PATCH is parked mid-transaction (holds the profile row lock via the
   * gate, blocked on a row lock of its own supersede target). A revoke is
   * then issued concurrently. revoke MUST NOT return while PATCH is
   * in-flight; it must wait on the same profile row.
   */
  it('Scenario A: revoke waits for an in-flight PATCH; PATCH write lands before revoke returns', async () => {
    const { token, familyId } = await setupManagerAndFamily('scen-a');
    const consent = await grantConsent(token, 'scen-a');
    const childId = await createUnder14(token, familyId, consent.id, 'scen-a');

    // Seed the value that the PATCH will supersede (same person/attribute/source).
    const seed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${childId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        profileValues: [{ attribute: 'DISPLAY_NAME', valueText: 'seed', sourceKind: 'GUARDIAN_RELAY' }],
        idempotencyKey: `pgc-seed-${Date.now()}`,
      },
    });
    expect(seed.statusCode).toBe(200);
    const { rows: seedRows } = await queryDb(
      `SELECT id FROM person_profile_values
       WHERE person_id = $1 AND status = 'RECORDED'`,
      [childId]
    );
    expect(seedRows.length).toBe(1);
    const parkedValueId = seedRows[0].id;

    // Barrier: hold a row lock on the value the PATCH will supersede.
    const hold = await verifyPool.connect();
    await hold.query('BEGIN');
    await hold.query('SELECT id FROM person_profile_values WHERE id = $1 FOR UPDATE', [parkedValueId]);

    // Real PATCH — parked after its gate read, before its commit.
    const patchTracked = track(
      app.inject({
        method: 'PATCH',
        url: `/api/v1/families/${familyId}/members/${childId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          profileValues: [{ attribute: 'DISPLAY_NAME', valueText: 'stale-write', sourceKind: 'GUARDIAN_RELAY' }],
          idempotencyKey: `pgc-patch-${Date.now()}`,
        },
      })
    );

    // Real revoke concurrently — must wait on the profile row, not complete.
    const revokeTracked = track(
      app.inject({
        method: 'POST',
        url: `/api/v1/consents/${consent.id}/revoke`,
        headers: { authorization: `Bearer ${token}` },
        payload: { idempotencyKey: `pgc-revoke-${Date.now()}` },
      })
    );

    try {
      // PATCH must actually be parked on the barrier (deterministic, not a sleep).
      expect(await waitForBlockedOn('person_profile_values')).toBe(true);
      expect(patchTracked.settled).toBe(false);

      // FORBIDDEN interleaving: revoke must not return 200 while PATCH is in flight.
      expect(await waitForBlockedOn('UPDATE person_compliance_profiles')).toBe(true);
      expect(revokeTracked.settled).toBe(false);
    } finally {
      // Release the barrier → PATCH commits → then revoke may proceed.
      await hold.query('COMMIT');
      hold.release();
    }

    const patchRes = await patchTracked.promise;
    expect(patchRes.statusCode).toBe(200);
    const revokeRes = await revokeTracked.promise;
    expect(revokeRes.statusCode).toBe(200);

    // PATCH's write landed (it held the profile row until commit).
    const { rows: afterValues } = await queryDb(
      `SELECT value_text, status FROM person_profile_values
       WHERE person_id = $1 ORDER BY status DESC`,
      [childId]
    );
    expect(afterValues.some((r: any) => r.value_text === 'stale-write' && r.status === 'RECORDED')).toBe(true);

    // revoke advanced the pointer after PATCH committed.
    const { rows: ptr } = await queryDb(
      'SELECT guardian_consent_version FROM person_compliance_profiles WHERE person_id = $1',
      [childId]
    );
    expect(ptr[0].guardian_consent_version).toBe(2);
  });

  /** Scenario B: revoke already advanced the pointer → PATCH must be blocked. */
  it('Scenario B: revoke first → PATCH reads current pointer → 403 with no side effects', async () => {
    const { token, familyId } = await setupManagerAndFamily('scen-b');
    const consent = await grantConsent(token, 'scen-b');
    const childId = await createUnder14(token, familyId, consent.id, 'scen-b');

    const beforeValues = await queryDb(
      'SELECT id, value_text, status, supersedes_id FROM person_profile_values WHERE person_id = $1 ORDER BY id',
      [childId]
    );
    const beforeAudit = await queryDb(
      `SELECT count(*)::int AS cnt FROM business_audit_events
       WHERE resource_id = $1 AND event_type = 'MEMBER_PROFILE_VALUE_RECORDED'`,
      [childId]
    );

    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/consents/${consent.id}/revoke`,
      headers: { authorization: `Bearer ${token}` },
      payload: { idempotencyKey: `pgc-revoke-b-${Date.now()}` },
    });
    expect(revokeRes.statusCode).toBe(200);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${childId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        profileValues: [{ attribute: 'DISPLAY_NAME', valueText: 'after-revoke', sourceKind: 'GUARDIAN_RELAY' }],
        idempotencyKey: `pgc-patch-b-${Date.now()}`,
      },
    });
    expect(patchRes.statusCode).toBe(403);
    expect(patchRes.json().code).toBe('GUARDIAN_CONSENT_REVOKED');

    const afterValues = await queryDb(
      'SELECT id, value_text, status, supersedes_id FROM person_profile_values WHERE person_id = $1 ORDER BY id',
      [childId]
    );
    expect(afterValues.rows.map((r: any) => [r.id, r.value_text, r.status, r.supersedes_id]))
      .toEqual(beforeValues.rows.map((r: any) => [r.id, r.value_text, r.status, r.supersedes_id]));

    const afterAudit = await queryDb(
      `SELECT count(*)::int AS cnt FROM business_audit_events
       WHERE resource_id = $1 AND event_type = 'MEMBER_PROFILE_VALUE_RECORDED'`,
      [childId]
    );
    expect(afterAudit.rows[0].cnt).toBe(beforeAudit.rows[0].cnt);
  });
});
