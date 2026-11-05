/**
 * Members integration tests (T047 + T049 RED→GREEN).
 *
 * T047: POST /families/:id/members — add member (MINOR_14_17), account_id IS NULL,
 *   whitelist sources, cross-source coexist, same-source supersede, observedAt NULL.
 * T049: PATCH /families/:id/members/:personId — same-source supersede vs cross-source
 *   coexist, cross-family / non-manager rejected.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

// Superuser pool for verification queries (bypasses RLS)
let verifyPool: pg.Pool;

async function queryDb(sql: string, params: unknown[] = []) {
  return verifyPool.query(sql, params);
}

describe('Members Integration (T047 + T049)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    // Use postgres superuser for verification (bypass RLS)
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  /** Helper: login + create family, returns { token, personId, familyId } */
  async function setupManagerAndFamily(label: string) {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `mem_${label}_${Date.now()}` },
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
        idempotencyKey: `fam-mem-${label}-${Date.now()}`,
      },
    });
    const family = famRes.json();
    return { token, personId: person.id, familyId: family.id };
  }

  // ──────────────────────────────────────────────
  // T047: POST member creation
  // ──────────────────────────────────────────────

  it('T047: POST member MINOR_14_17 succeeds, account_id IS NULL', async () => {
    const { token, familyId } = await setupManagerAndFamily('t047a');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_RELAY',
        profileValues: [
          {
            attribute: 'DISPLAY_NAME',
            valueText: '小明',
            sourceKind: 'GUARDIAN_RELAY',
          },
        ],
        idempotencyKey: `mem-key-a-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.personId).toBeDefined();
    expect(body.accountBound).toBe(false);

    // Verify account_id IS NULL in DB (superuser bypasses RLS)
    const { rows } = await queryDb(
      'SELECT account_id FROM persons WHERE id = $1',
      [body.personId]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].account_id).toBeNull();
  });

  it('T047: non-writable source rejected by schema → 422', async () => {
    const { token, familyId } = await setupManagerAndFamily('t047b');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'AI_HYPOTHESIS', // not in WritableSource enum
        idempotencyKey: `mem-key-b-${Date.now()}`,
      },
    });
    // Schema validation rejects non-writable source → 422
    expect(res.statusCode).toBe(422);
  });

  it('T047: UNDER_14 rejects non-guardian source → 422', async () => {
    const { token, familyId } = await setupManagerAndFamily('t047c');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'SELF_STATEMENT', // not guardian source
        guardianConsentId: undefined,
        idempotencyKey: `mem-key-c-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  it('T047: different sources coexist (not overwritten)', async () => {
    const { token, familyId } = await setupManagerAndFamily('t047d');

    // Create member with two different sources
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_RELAY',
        profileValues: [
          {
            attribute: 'DISPLAY_NAME',
            valueText: '名字A',
            sourceKind: 'GUARDIAN_RELAY',
          },
          {
            attribute: 'DISPLAY_NAME',
            valueText: '名字B',
            sourceKind: 'SELF_STATEMENT',
          },
        ],
        idempotencyKey: `mem-key-d-${Date.now()}`,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const memberPersonId = createRes.json().personId;

    // Both values should be RECORDED
    const { rows } = await queryDb(
      `SELECT source_kind, value_text, status FROM person_profile_values
       WHERE person_id = $1 AND attribute = 'DISPLAY_NAME'`,
      [memberPersonId]
    );
    expect(rows.length).toBe(2);

    const relayRow = rows.find((r: any) => r.source_kind === 'GUARDIAN_RELAY');
    const selfRow = rows.find((r: any) => r.source_kind === 'SELF_STATEMENT');
    expect(relayRow).toBeDefined();
    expect(selfRow).toBeDefined();
    expect(relayRow.status).toBe('RECORDED');
    expect(selfRow.status).toBe('RECORDED');
  });

  it('T047: same source supersedes → writes supersedes_id', async () => {
    const { token, familyId } = await setupManagerAndFamily('t047e');

    // Create member with one source
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_RELAY',
        profileValues: [
          {
            attribute: 'DISPLAY_NAME',
            valueText: '旧名字',
            sourceKind: 'GUARDIAN_RELAY',
          },
        ],
        idempotencyKey: `mem-key-e1-${Date.now()}`,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const memberPersonId = createRes.json().personId;

    // Update with same source → supersede
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${memberPersonId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        profileValues: [
          {
            attribute: 'DISPLAY_NAME',
            valueText: '新名字',
            sourceKind: 'GUARDIAN_RELAY',
          },
        ],
        idempotencyKey: `mem-key-e2-${Date.now()}`,
      },
    });
    expect(patchRes.statusCode).toBe(200);

    // Old row should be SUPERSEDED, new row should have supersedes_id
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

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_RELAY',
        profileValues: [
          {
            attribute: 'DISPLAY_NAME',
            valueText: '测试名',
            sourceKind: 'GUARDIAN_RELAY',
            // observedAt not provided
          },
        ],
        idempotencyKey: `mem-key-f-${Date.now()}`,
      },
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

  // ──────────────────────────────────────────────
  // T049: PATCH member update
  // ──────────────────────────────────────────────

  it('T049: PATCH same-source replaces (supersede)', async () => {
    const { token, familyId } = await setupManagerAndFamily('t049a');

    // Create member
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_RELAY',
        profileValues: [
          {
            attribute: 'DISPLAY_NAME',
            valueText: '初始名',
            sourceKind: 'GUARDIAN_RELAY',
          },
        ],
        idempotencyKey: `mem-key-9a1-${Date.now()}`,
      },
    });
    const memberPersonId = createRes.json().personId;

    // PATCH with same source
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${memberPersonId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        profileValues: [
          {
            attribute: 'DISPLAY_NAME',
            valueText: '更新名',
            sourceKind: 'GUARDIAN_RELAY',
          },
        ],
        idempotencyKey: `mem-key-9a2-${Date.now()}`,
      },
    });
    expect(patchRes.statusCode).toBe(200);

    // Verify supersede
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

    // Create member with GUARDIAN_RELAY
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_RELAY',
        profileValues: [
          {
            attribute: 'DISPLAY_NAME',
            valueText: '守护者起名',
            sourceKind: 'GUARDIAN_RELAY',
          },
        ],
        idempotencyKey: `mem-key-9b1-${Date.now()}`,
      },
    });
    const memberPersonId = createRes.json().personId;

    // PATCH with different source
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${memberPersonId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        profileValues: [
          {
            attribute: 'DISPLAY_NAME',
            valueText: '自己起名',
            sourceKind: 'SELF_STATEMENT',
          },
        ],
        idempotencyKey: `mem-key-9b2-${Date.now()}`,
      },
    });
    expect(patchRes.statusCode).toBe(200);

    // Both should be RECORDED
    const { rows } = await queryDb(
      `SELECT source_kind, value_text, status FROM person_profile_values
       WHERE person_id = $1 AND attribute = 'DISPLAY_NAME'`,
      [memberPersonId]
    );
    expect(rows.length).toBe(2);
    expect(rows.every((r: any) => r.status === 'RECORDED')).toBe(true);
  });

  it('T049: non-manager PATCH → 403', async () => {
    // Manager creates family + member
    const { token: managerToken, familyId } = await setupManagerAndFamily('t049c');

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_RELAY',
        idempotencyKey: `mem-key-9c1-${Date.now()}`,
      },
    });
    const memberPersonId = createRes.json().personId;

    // Another user tries to PATCH
    const otherLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `mem_other_${Date.now()}` },
    });
    const { token: otherToken } = otherLogin.json();

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${memberPersonId}`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: {
        profileValues: [
          {
            attribute: 'DISPLAY_NAME',
            valueText: '恶意改名',
            sourceKind: 'SELF_STATEMENT',
          },
        ],
        idempotencyKey: `mem-key-9c2-${Date.now()}`,
      },
    });
    // Should be rejected (not manager or not in family)
    expect([403, 404]).toContain(patchRes.statusCode);
  });

  it('T049: cross-family PATCH → 403', async () => {
    // Family A manager creates member
    const { token: tokenA, familyId: familyA } = await setupManagerAndFamily('t049d-a');

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyA}/members`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_RELAY',
        idempotencyKey: `mem-key-9d1-${Date.now()}`,
      },
    });
    const memberPersonId = createRes.json().personId;

    // Family B manager tries to PATCH member of Family A
    const { token: tokenB, familyId: familyB } = await setupManagerAndFamily('t049d-b');

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyB}/members/${memberPersonId}`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: {
        profileValues: [
          {
            attribute: 'DISPLAY_NAME',
            valueText: '跨家庭改名',
            sourceKind: 'SELF_STATEMENT',
          },
        ],
        idempotencyKey: `mem-key-9d2-${Date.now()}`,
      },
    });
    expect([403, 404]).toContain(patchRes.statusCode);
  });

  // ──────────────────────────────────────────────
  // T051: Source rule enforcement
  // ──────────────────────────────────────────────

  it('T051: FAMILY_CREATE non-SELF_STATEMENT → 422', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `mem_t051_${Date.now()}` },
    });
    const { token } = loginRes.json();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'ADULT',
        ageBandSource: 'GUARDIAN_RELAY', // invalid for family create
        idempotencyKey: `fam-t051-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  it('T051: member with invalid ageBandSource → 422', async () => {
    const { token, familyId } = await setupManagerAndFamily('t051b');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'OTHER_MEMBER_RELAY', // not guardian source
        guardianConsentId: undefined,
        idempotencyKey: `mem-t051b-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });
});
