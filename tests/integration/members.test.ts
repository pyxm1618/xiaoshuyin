/**
 * Members integration tests (T047 + T049 RED→GREEN).
 *
 * Frozen OpenAPI:
 *   CreateMemberRequest = { ageBand, ageBandSource, values?, guardianConsentId? }
 *   UpdateMemberRequest = { values }
 *   MemberResponse     = { personId, familyId, accountBound, profile, values }
 *   `Idempotency-Key` is an HTTP header.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  auth,
  commandHeaders,
  createConsentRequest,
  createFamily,
  createMember,
  grantConsent,
  loginWithLabel,
  updateMember,
  valueInput,
} from '../setup/api.js';

let verifyPool: pg.Pool;

async function queryDb(sql: string, params: unknown[] = []) {
  return verifyPool.query(sql, params);
}

describe('Members Integration (T047 + T049)', () => {
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
    const { token, personId } = await loginWithLabel(app, `mem_${label}`);
    const famRes = await createFamily(app, token, label);
    expect(famRes.statusCode).toBe(201);
    return { token, personId, familyId: famRes.json().id as string };
  }

  // ──────────────────────────────────────────────
  // T047: POST member creation
  // ──────────────────────────────────────────────

  it('T047: POST member MINOR_14_17 succeeds, account_id IS NULL, UUIDv7', async () => {
    const { token, familyId } = await setupManagerAndFamily('t047a');

    const res = await createMember(app, token, familyId, 't047a', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_RELAY',
      values: [valueInput('小明', 'GUARDIAN_RELAY')],
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.personId).toBeDefined();
    expect(body.familyId).toBe(familyId);
    expect(body.accountBound).toBe(false);
    expect(body.profile.ageBand).toBe('MINOR_14_17');
    expect(body.values).toHaveLength(1);
    expect(body.values[0].value).toBe('小明');
    // F10: API-created Person id is UUIDv7.
    expect(body.personId[14]).toBe('7');

    const { rows } = await queryDb('SELECT account_id FROM persons WHERE id = $1', [body.personId]);
    expect(rows.length).toBe(1);
    expect(rows[0].account_id).toBeNull();
  });

  it('T047: non-writable source rejected by schema → 422', async () => {
    const { token, familyId } = await setupManagerAndFamily('t047b');

    const res = await createMember(app, token, familyId, 't047b', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'AI_HYPOTHESIS',
    });
    expect(res.statusCode).toBe(422);
  });

  it('T047: UNDER_14 rejects non-guardian source → 422', async () => {
    const { token, familyId } = await setupManagerAndFamily('t047c');

    const res = await createMember(app, token, familyId, 't047c', {
      ageBand: 'UNDER_14',
      ageBandSource: 'SELF_STATEMENT',
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  it('T047: different sources coexist (not overwritten)', async () => {
    const { token, familyId } = await setupManagerAndFamily('t047d');

    const createRes = await createMember(app, token, familyId, 't047d', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_RELAY',
      values: [valueInput('名字A', 'GUARDIAN_RELAY')],
    });
    expect(createRes.statusCode).toBe(201);
    const memberPersonId = createRes.json().personId;

    const patchRes = await updateMember(app, token, familyId, memberPersonId, 't047d', [
      valueInput('名字B', 'SELF_STATEMENT'),
    ]);
    expect(patchRes.statusCode).toBe(200);

    const { rows } = await queryDb(
      `SELECT source_kind, value_text, status FROM person_profile_values
       WHERE person_id = $1 AND attribute = 'DISPLAY_NAME'`,
      [memberPersonId]
    );
    expect(rows.length).toBe(2);
    expect(rows.every((r: any) => r.status === 'RECORDED')).toBe(true);
  });

  it('T047: same source supersedes → writes supersedes_id', async () => {
    const { token, familyId } = await setupManagerAndFamily('t047e');

    const createRes = await createMember(app, token, familyId, 't047e', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_RELAY',
      values: [valueInput('旧名字', 'GUARDIAN_RELAY')],
    });
    const memberPersonId = createRes.json().personId;

    const patchRes = await updateMember(app, token, familyId, memberPersonId, 't047e', [
      valueInput('新名字', 'GUARDIAN_RELAY'),
    ]);
    expect(patchRes.statusCode).toBe(200);

    const { rows } = await queryDb(
      `SELECT id, value_text, status, supersedes_id FROM person_profile_values
       WHERE person_id = $1 AND attribute = 'DISPLAY_NAME' AND source_kind = 'GUARDIAN_RELAY'
       ORDER BY recorded_at`,
      [memberPersonId]
    );
    expect(rows.length).toBe(2);

    const oldRow = rows.find((r: any) => r.value_text === '旧名字');
    const newRow = rows.find((r: any) => r.value_text === '新名字');
    expect(oldRow.status).toBe('SUPERSEDED');
    expect(newRow.status).toBe('RECORDED');
    expect(newRow.supersedes_id).toBe(oldRow.id);
  });

  it('T047: observedAt defaults to NULL', async () => {
    const { token, familyId } = await setupManagerAndFamily('t047f');

    const createRes = await createMember(app, token, familyId, 't047f', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_RELAY',
      values: [valueInput('测试名', 'GUARDIAN_RELAY')],
    });
    expect(createRes.statusCode).toBe(201);
    const memberPersonId = createRes.json().personId;

    const { rows } = await queryDb(
      `SELECT observed_at FROM person_profile_values WHERE person_id = $1`,
      [memberPersonId]
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].observed_at).toBeNull();
  });

  it('F8: explicit observedAt is preserved exactly', async () => {
    const { token, familyId } = await setupManagerAndFamily('t047g');

    const observedAt = '2026-02-03T04:05:06.000Z';
    const createRes = await createMember(app, token, familyId, 't047g', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_RELAY',
      values: [valueInput('有观测时间', 'GUARDIAN_RELAY', { observedAt })],
    });
    expect(createRes.statusCode).toBe(201);
    const memberPersonId = createRes.json().personId;

    const { rows } = await queryDb(
      `SELECT observed_at FROM person_profile_values WHERE person_id = $1`,
      [memberPersonId]
    );
    expect(new Date(rows[0].observed_at).toISOString()).toBe(observedAt);
    expect(createRes.json().values[0].observedAt).toBe(observedAt);
  });

  // ──────────────────────────────────────────────
  // T049: PATCH member update
  // ──────────────────────────────────────────────

  it('T049: PATCH same-source replaces (supersede)', async () => {
    const { token, familyId } = await setupManagerAndFamily('t049a');

    const createRes = await createMember(app, token, familyId, 't049a', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_RELAY',
      values: [valueInput('初始名', 'GUARDIAN_RELAY')],
    });
    const memberPersonId = createRes.json().personId;

    const patchRes = await updateMember(app, token, familyId, memberPersonId, 't049a', [
      valueInput('更新名', 'GUARDIAN_RELAY'),
    ]);
    expect(patchRes.statusCode).toBe(200);

    const { rows } = await queryDb(
      `SELECT id, value_text, status, supersedes_id FROM person_profile_values
       WHERE person_id = $1 AND source_kind = 'GUARDIAN_RELAY'`,
      [memberPersonId]
    );
    const oldRow = rows.find((r: any) => r.value_text === '初始名');
    const newRow = rows.find((r: any) => r.value_text === '更新名');
    expect(oldRow.status).toBe('SUPERSEDED');
    expect(newRow.status).toBe('RECORDED');
    expect(newRow.supersedes_id).toBe(oldRow.id);
  });

  it('T049: PATCH different source coexists (not overwritten)', async () => {
    const { token, familyId } = await setupManagerAndFamily('t049b');

    const createRes = await createMember(app, token, familyId, 't049b', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_RELAY',
      values: [valueInput('守护者起名', 'GUARDIAN_RELAY')],
    });
    const memberPersonId = createRes.json().personId;

    const patchRes = await updateMember(app, token, familyId, memberPersonId, 't049b', [
      valueInput('自己起名', 'SELF_STATEMENT'),
    ]);
    expect(patchRes.statusCode).toBe(200);

    const { rows } = await queryDb(
      `SELECT source_kind, value_text, status FROM person_profile_values
       WHERE person_id = $1 AND attribute = 'DISPLAY_NAME'`,
      [memberPersonId]
    );
    expect(rows.length).toBe(2);
    expect(rows.every((r: any) => r.status === 'RECORDED')).toBe(true);
  });

  it('T049: non-manager PATCH → 403', async () => {
    const { token: managerToken, familyId } = await setupManagerAndFamily('t049c');

    const createRes = await createMember(app, managerToken, familyId, 't049c', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_RELAY',
    });
    const memberPersonId = createRes.json().personId;

    const other = await loginWithLabel(app, 'mem_other');

    const patchRes = await updateMember(app, other.token, familyId, memberPersonId, 't049c', [
      valueInput('恶意改名', 'SELF_STATEMENT'),
    ]);
    expect([403, 404]).toContain(patchRes.statusCode);
  });

  it('T049: cross-family PATCH → 403', async () => {
    const { token: tokenA, familyId: familyA } = await setupManagerAndFamily('t049d-a');

    const createRes = await createMember(app, tokenA, familyA, 't049d-a', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_RELAY',
    });
    const memberPersonId = createRes.json().personId;

    const { token: tokenB, familyId: familyB } = await setupManagerAndFamily('t049d-b');

    const patchRes = await updateMember(app, tokenB, familyB, memberPersonId, 't049d-b', [
      valueInput('跨家庭改名', 'SELF_STATEMENT'),
    ]);
    expect([403, 404]).toContain(patchRes.statusCode);
  });

  // ──────────────────────────────────────────────
  // T051: Source rule enforcement
  // ──────────────────────────────────────────────

  it('T051: FAMILY_CREATE non-SELF_STATEMENT → 422', async () => {
    const { token } = await loginWithLabel(app, 'mem_t051');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: commandHeaders(token, 'fam-t051'),
      payload: {
        creator: { ageBand: 'ADULT', ageBandSource: 'GUARDIAN_RELAY' },
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  it('T051: member with invalid ageBandSource → 422', async () => {
    const { token, familyId } = await setupManagerAndFamily('t051b');

    const res = await createMember(app, token, familyId, 't051b', {
      ageBand: 'UNDER_14',
      ageBandSource: 'OTHER_MEMBER_RELAY',
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  // ──────────────────────────────────────────────
  // T057: UNDER_14 provider is pinned to consent.guardian_person_id
  // ──────────────────────────────────────────────

  async function grantConsentFor(token: string, label: string) {
    const reqRes = await createConsentRequest(app, token, label);
    expect(reqRes.statusCode).toBe(201);
    const grantRes = await grantConsent(app, token, label, reqRes.json().requestId);
    expect(grantRes.statusCode).toBe(201);
    return grantRes.json();
  }

  it('T057: UNDER_14 provider != consent.guardian_person_id → 422', async () => {
    const { token, familyId } = await setupManagerAndFamily('t057a');
    const consent = await grantConsentFor(token, 't057a');

    const res = await createMember(app, token, familyId, 't057a', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: consent.id,
      values: [
        valueInput('小树', 'GUARDIAN_RELAY', {
          providedByPersonId: '00000000-0000-4000-8000-000000000096',
        }),
      ],
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  it('T057: UNDER_14 provider == consent.guardian_person_id → 201', async () => {
    const { token, personId, familyId } = await setupManagerAndFamily('t057b');
    const consent = await grantConsentFor(token, 't057b');

    const res = await createMember(app, token, familyId, 't057b', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: consent.id,
      values: [
        valueInput('小树', 'GUARDIAN_RELAY', { providedByPersonId: personId }),
      ],
    });
    expect(res.statusCode).toBe(201);
  });
});