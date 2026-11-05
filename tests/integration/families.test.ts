/**
 * Families integration tests (T045 / T046).
 * Login → create family → verify. No family → 404. Non-ADULT → 403.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

let verifyPool: pg.Pool;

describe('Families Integration (T045)', () => {
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

  it('GET /families/current returns 404 when no family', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: 'fam_test_1' },
    });
    const { token } = loginRes.json();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/families/current',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('CURRENT_FAMILY_NOT_FOUND');
  });

  it('POST /families creates family with isManager=true', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `fam_test_2_${Date.now()}` },
    });
    const { token, person } = loginRes.json();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: '测试家庭',
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        idempotencyKey: `fam-key-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.isManager).toBe(true);

    // Person count should not change
    // (Person was created at login, family creation reuses it)
  });

  it('ageBandSource != SELF_STATEMENT → 422', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `fam_test_3_${Date.now()}` },
    });
    const { token } = loginRes.json();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'ADULT',
        ageBandSource: 'GUARDIAN_RELAY',
        idempotencyKey: `fam-key-invalid-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  // ── T046: creator MUST be ADULT ──

  async function assertRejectedWithoutResidue(payload: Record<string, unknown>, expectedCode: string) {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `fam_adult_${Date.now()}` },
    });
    const { token, person } = loginRes.json();

    const before = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM families WHERE created_by_person_id = $1',
      [person.id]
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: { ...payload, idempotencyKey: `fam-adult-${Date.now()}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe(expectedCode);

    // No residue: no family, no membership, no profile, no value, no audit
    const fams = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM families WHERE created_by_person_id = $1',
      [person.id]
    );
    expect(fams.rows[0].cnt).toBe(before.rows[0].cnt);

    const members = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM family_members WHERE person_id = $1',
      [person.id]
    );
    expect(members.rows[0].cnt).toBe(0);

    const profiles = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM person_compliance_profiles WHERE person_id = $1',
      [person.id]
    );
    expect(profiles.rows[0].cnt).toBe(0);

    const values = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM person_profile_values WHERE person_id = $1',
      [person.id]
    );
    expect(values.rows[0].cnt).toBe(0);

    const audits = await verifyPool.query(
      `SELECT count(*)::int AS cnt FROM business_audit_events
       WHERE actor_account_id = (SELECT account_id FROM persons WHERE id = $1) AND event_type = 'FAMILY_CREATED'`,
      [person.id]
    );
    expect(audits.rows[0].cnt).toBe(0);
  }

  it('T046: MINOR_14_17 creator → 403 FAMILY_MANAGER_MUST_BE_ADULT, no residue', async () => {
    await assertRejectedWithoutResidue(
      {
        displayName: '未成年家庭',
        ageBand: 'MINOR_14_17',
        ageBandSource: 'SELF_STATEMENT',
        profileValues: [{ attribute: 'DISPLAY_NAME', valueText: '家长 A', sourceKind: 'SELF_STATEMENT' }],
      },
      'FAMILY_MANAGER_MUST_BE_ADULT'
    );
  });

  it('T046: UNDER_14 creator → 403 FAMILY_MANAGER_MUST_BE_ADULT, no residue', async () => {
    await assertRejectedWithoutResidue(
      {
        displayName: '儿童家庭',
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        profileValues: [{ attribute: 'DISPLAY_NAME', valueText: '家长 A', sourceKind: 'GUARDIAN_RELAY' }],
      },
      'FAMILY_MANAGER_MUST_BE_ADULT'
    );
  });

  it('T046: ADULT + SELF_STATEMENT creator passes', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `fam_ok_${Date.now()}` },
    });
    const { token } = loginRes.json();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: '正常家庭',
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        profileValues: [{ attribute: 'DISPLAY_NAME', valueText: '家长 A', sourceKind: 'SELF_STATEMENT' }],
        idempotencyKey: `fam-ok-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
  });
});
