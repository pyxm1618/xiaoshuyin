/**
 * Families integration tests (T045 / T046).
 * Login → create family → verify. No family → 404. Non-ADULT → 403.
 *
 * Frozen OpenAPI: `CreateFamilyRequest = { displayName?, creator: { ageBand,
 * ageBandSource, values? } }`; `Idempotency-Key` is an HTTP header.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import { auth, commandHeaders, login, loginWithLabel } from '../setup/api.js';

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
    const { token } = await loginWithLabel(app, 'fam_test_1');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/families/current',
      headers: auth(token),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('CURRENT_FAMILY_NOT_FOUND');
  });

  it('POST /families creates family with isManager=true and a UUIDv7 id', async () => {
    const { token } = await loginWithLabel(app, 'fam_test_2');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: commandHeaders(token, 'fam-create'),
      payload: {
        displayName: '测试家庭',
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.isManager).toBe(true);
    expect(body.createdAt).toBeDefined();
    // F10: API-created family id is UUIDv7.
    expect(body.id[14]).toBe('7');
  });

  it('ageBandSource != SELF_STATEMENT → 422', async () => {
    const { token } = await loginWithLabel(app, 'fam_test_3');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: commandHeaders(token, 'fam-invalid'),
      payload: {
        creator: { ageBand: 'ADULT', ageBandSource: 'GUARDIAN_RELAY' },
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  // ── T046: creator MUST be ADULT ──

  async function assertRejectedWithoutResidue(
    creator: Record<string, unknown>,
    expectedCode: string
  ) {
    const { token, personId } = await loginWithLabel(app, 'fam_adult');

    const before = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM families WHERE created_by_person_id = $1',
      [personId]
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: commandHeaders(token, 'fam-adult'),
      payload: { displayName: '未成年家庭', creator },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe(expectedCode);

    // No residue: no family, no membership, no profile, no value, no audit
    const fams = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM families WHERE created_by_person_id = $1',
      [personId]
    );
    expect(fams.rows[0].cnt).toBe(before.rows[0].cnt);

    const members = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM family_members WHERE person_id = $1',
      [personId]
    );
    expect(members.rows[0].cnt).toBe(0);

    const profiles = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM person_compliance_profiles WHERE person_id = $1',
      [personId]
    );
    expect(profiles.rows[0].cnt).toBe(0);

    const values = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM person_profile_values WHERE person_id = $1',
      [personId]
    );
    expect(values.rows[0].cnt).toBe(0);

    const audits = await verifyPool.query(
      `SELECT count(*)::int AS cnt FROM business_audit_events
       WHERE actor_account_id = (SELECT account_id FROM persons WHERE id = $1) AND event_type = 'FAMILY_CREATED'`,
      [personId]
    );
    expect(audits.rows[0].cnt).toBe(0);
  }

  it('T046: MINOR_14_17 creator → 403 FAMILY_MANAGER_MUST_BE_ADULT, no residue', async () => {
    await assertRejectedWithoutResidue(
      {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'SELF_STATEMENT',
        values: [{ attribute: 'DISPLAY_NAME', value: '家长 A', source: 'SELF_STATEMENT' }],
      },
      'FAMILY_MANAGER_MUST_BE_ADULT'
    );
  });

  it('T046: UNDER_14 creator → 403 FAMILY_MANAGER_MUST_BE_ADULT, no residue', async () => {
    await assertRejectedWithoutResidue(
      {
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        values: [{ attribute: 'DISPLAY_NAME', value: '家长 A', source: 'GUARDIAN_RELAY' }],
      },
      'FAMILY_MANAGER_MUST_BE_ADULT'
    );
  });

  it('T046: ADULT + SELF_STATEMENT creator passes', async () => {
    const { token } = await loginWithLabel(app, 'fam_ok');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: commandHeaders(token, 'fam-ok'),
      payload: {
        displayName: '正常家庭',
        creator: {
          ageBand: 'ADULT',
          ageBandSource: 'SELF_STATEMENT',
          values: [{ attribute: 'DISPLAY_NAME', value: '家长 A', source: 'SELF_STATEMENT' }],
        },
      },
    });
    expect(res.statusCode).toBe(201);
  });
});