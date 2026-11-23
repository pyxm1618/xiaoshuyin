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
import {
  createConsentRequest,
  createFamily,
  createMember,
  grantConsent,
  loginWithLabel,
  revokeConsent,
  updateMember,
  valueInput,
} from '../setup/api.js';

let verifyPool: pg.Pool;

async function queryDb(sql: string, params: unknown[] = []) {
  return verifyPool.query(sql, params);
}

async function setupManagerAndFamily(app: any, label: string) {
  const { token, personId } = await loginWithLabel(app, `pg_${label}`);
  const famRes = await createFamily(app, token, label);
  expect(famRes.statusCode).toBe(201);
  return { token, personId, familyId: famRes.json().id as string };
}

async function grantConsentFor(
  app: any,
  token: string,
  label: string,
  existingSubjectPersonId?: string
) {
  const reqRes = await createConsentRequest(app, token, label,
    existingSubjectPersonId ? { existingSubjectPersonId } : {});
  expect(reqRes.statusCode, `createRequest failed: ${reqRes.body}`).toBe(201);
  const grantRes = await grantConsent(app, token, label, reqRes.json().requestId);
  expect(grantRes.statusCode, `grant failed: ${grantRes.body}`).toBe(201);
  return grantRes.json();
}

async function createUnder14(
  app: any,
  token: string,
  familyId: string,
  consentId: string,
  label: string
) {
  const res = await createMember(app, token, familyId, label, {
    ageBand: 'UNDER_14',
    ageBandSource: 'GUARDIAN_RELAY',
    guardianConsentId: consentId,
    values: [valueInput('小树', 'GUARDIAN_RELAY')],
  });
  expect(res.statusCode).toBe(201);
  return res.json().personId as string;
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

  it('GRANTED v1 → downstream PATCH fails closed', async () => {
    const { token, familyId } = await setupManagerAndFamily(app, 'grant');
    const consent = await grantConsentFor(app, token, 'grant');
    const childId = await createUnder14(app, token, familyId, consent.id, 'grant');

    const res = await updateMember(app, token, familyId, childId, 'grant', [
      valueInput('小树-2', 'GUARDIAN_RELAY'),
    ]);
    expect(res.statusCode).toBe(403);

    const { rows } = await queryDb(
      `SELECT value_text, status FROM person_profile_values
       WHERE person_id = $1 AND attribute = 'DISPLAY_NAME' AND status = 'RECORDED'`,
      [childId]
    );
    expect(rows).toEqual([{ value_text: '小树', status: 'RECORDED' }]);
  });

  it('revoke → PATCH same child blocked, no supersede / no insert / no audit', async () => {
    const { token, familyId } = await setupManagerAndFamily(app, 'block');
    const consent = await grantConsentFor(app, token, 'block');
    const childId = await createUnder14(app, token, familyId, consent.id, 'block');

    const beforeValues = await queryDb(
      'SELECT id, value_text, status, supersedes_id FROM person_profile_values WHERE person_id = $1 ORDER BY id',
      [childId]
    );
    const beforeAudit = await queryDb(
      `SELECT count(*)::int AS cnt FROM business_audit_events
       WHERE resource_id = $1 AND event_type = 'MEMBER_PROFILE_VALUE_RECORDED'`,
      [childId]
    );

    const revokeRes = await revokeConsent(app, token, 'block', consent.id);
    expect(revokeRes.statusCode).toBe(200);

    const patchRes = await updateMember(app, token, familyId, childId, 'block', [
      valueInput('小树-hack', 'GUARDIAN_RELAY'),
    ]);
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

  it('re-consent v3 advances administration without authorizing downstream PATCH', async () => {
    const { token, familyId } = await setupManagerAndFamily(app, 'restore');
    const consent = await grantConsentFor(app, token, 'restore');
    const childId = await createUnder14(app, token, familyId, consent.id, 'restore');

    const revokeRes = await revokeConsent(app, token, 'restore', consent.id);
    expect(revokeRes.statusCode).toBe(200);

    const blocked = await updateMember(app, token, familyId, childId, 'restore', [
      valueInput('x', 'GUARDIAN_RELAY'),
    ]);
    expect(blocked.statusCode).toBe(403);

    const v3 = await grantConsentFor(app, token, 'restore-re', childId);
    expect(v3.version).toBe(3);
    expect(v3.boundPersonId).toBe(childId);

    const ok = await updateMember(app, token, familyId, childId, 'restore', [
      valueInput('小树-restored', 'GUARDIAN_RELAY'),
    ]);
    expect(ok.statusCode).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// Concurrency regression (Independent Review Round 2 — CRITICAL)
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

  it('Scenario A: concurrent PATCH and revoke never write a downstream profile value', async () => {
    const { token, familyId } = await setupManagerAndFamily(app, 'scen-a');
    const consent = await grantConsentFor(app, token, 'scen-a');
    const childId = await createUnder14(app, token, familyId, consent.id, 'scen-a');

    const hold = await verifyPool.connect();
    await hold.query('BEGIN');
    await hold.query('SELECT person_id FROM person_compliance_profiles WHERE person_id=$1 FOR UPDATE', [childId]);
    const patch = track(updateMember(app, token, familyId, childId, 'pgc-patch', [
      valueInput('stale-write', 'GUARDIAN_RELAY'),
    ]));
    let revoke: ReturnType<typeof revokeConsent> | undefined;
    try {
      expect(await waitForBlockedOn('person_compliance_profiles')).toBe(true);
      expect(patch.settled).toBe(false);
      revoke = revokeConsent(app, token, 'pgc-revoke', consent.id);
    } finally {
      await hold.query('COMMIT');
      hold.release();
    }

    expect((await patch.promise).statusCode).toBe(403);
    expect((await revoke!).statusCode).toBe(200);
    const { rows } = await queryDb(
      `SELECT value_text FROM person_profile_values WHERE person_id=$1 AND value_text='stale-write'`,
      [childId]
    );
    expect(rows).toEqual([]);
    const { rows: profiles } = await queryDb(
      'SELECT guardian_consent_version FROM person_compliance_profiles WHERE person_id=$1',
      [childId]
    );
    expect(profiles[0].guardian_consent_version).toBe(2);
  });

  it('Scenario B: revoke first → PATCH reads current pointer → 403 with no side effects', async () => {
    const { token, familyId } = await setupManagerAndFamily(app, 'scen-b');
    const consent = await grantConsentFor(app, token, 'scen-b');
    const childId = await createUnder14(app, token, familyId, consent.id, 'scen-b');

    const beforeValues = await queryDb(
      'SELECT id, value_text, status, supersedes_id FROM person_profile_values WHERE person_id = $1 ORDER BY id',
      [childId]
    );
    const beforeAudit = await queryDb(
      `SELECT count(*)::int AS cnt FROM business_audit_events
       WHERE resource_id = $1 AND event_type = 'MEMBER_PROFILE_VALUE_RECORDED'`,
      [childId]
    );

    const revokeRes = await revokeConsent(app, token, 'scen-b', consent.id);
    expect(revokeRes.statusCode).toBe(200);

    const patchRes = await updateMember(app, token, familyId, childId, 'scen-b', [
      valueInput('after-revoke', 'GUARDIAN_RELAY'),
    ]);
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