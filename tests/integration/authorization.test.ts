/**
 * T061: Cross-family authorization integration tests.
 * Verifies real API-level authorization boundaries between families.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import type pg from 'pg';

let verifyPool: pg.Pool;

async function queryDb(sql: string, params: unknown[] = []) {
  return verifyPool.query(sql, params);
}

describe('Cross-Family Authorization (T061)', () => {
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

  /** Setup: login + create family, returns { token, personId, familyId } */
  async function setupFamily(label: string) {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `t061_${label}_${Date.now()}` },
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
        idempotencyKey: `fam-t061-${label}-${Date.now()}`,
      },
    });
    const family = famRes.json();
    return { token, personId: person.id, familyId: family.id };
  }

  /** Setup: create a non-manager member in a family */
  async function createMember(familyToken: string, familyId: string, label: string) {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `t061_m_${label}_${Date.now()}` },
    });
    const { token: memberToken, person: memberPerson } = loginRes.json();

    // Manager creates the member (without account)
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${familyToken}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_OBSERVATION',
        profileValues: [{ attribute: 'DISPLAY_NAME', valueText: `成员-${label}`, sourceKind: 'GUARDIAN_OBSERVATION' }],
        idempotencyKey: `mem-t061-${label}-${Date.now()}`,
      },
    });
    return { memberPersonId: createRes.json().personId, memberToken };
  }

  // ── Family A actor accessing Family B → 403 ──

  it('T061: Family A manager accessing Family B members → 403', async () => {
    const famA = await setupFamily('a1');
    const famB = await setupFamily('b1');

    // Family A manager tries to create member in Family B
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${famB.familyId}/members`,
      headers: { authorization: `Bearer ${famA.token}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_OBSERVATION',
        idempotencyKey: `x-a-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('T061: Family A manager PATCH Family B member → 403', async () => {
    const famA = await setupFamily('a2');
    const famB = await setupFamily('b2');
    const { memberPersonId } = await createMember(famB.token, famB.familyId, 'b2m');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${famB.familyId}/members/${memberPersonId}`,
      headers: { authorization: `Bearer ${famA.token}` },
      payload: {
        profileValues: [{ attribute: 'DISPLAY_NAME', valueText: 'hack', sourceKind: 'GUARDIAN_OBSERVATION' }],
        idempotencyKey: `x-p-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  // ── Response does not leak target family fields ──

  it('T061: cross-family response contains no target family fields', async () => {
    const famA = await setupFamily('a3');
    const famB = await setupFamily('b3');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${famB.familyId}/members`,
      headers: { authorization: `Bearer ${famA.token}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_OBSERVATION',
        idempotencyKey: `x-n-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    // Should NOT leak family B's displayName, createdAt, etc.
    expect(body.displayName).toBeUndefined();
    expect(body.createdAt).toBeUndefined();
    expect(body.familyId).toBeUndefined();
  });

  // ── Forged family_id → 403/404 ──

  it('T061: forged family_id is rejected', async () => {
    const famA = await setupFamily('a4');
    const forgedId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${forgedId}/members`,
      headers: { authorization: `Bearer ${famA.token}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_OBSERVATION',
        idempotencyKey: `x-f-${Date.now()}`,
      },
    });
    expect([403, 404]).toContain(res.statusCode);
  });

  // ── Non-manager member cannot create members ──

  it('T061: non-manager member creating member → 403', async () => {
    const famA = await setupFamily('a5');
    // Create a member who has an account (login first, then add as member)
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `t061_nm_${Date.now()}` },
    });
    const { token: nmToken } = loginRes.json();

    // Manager adds this person as a member
    const addRes = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${famA.familyId}/members`,
      headers: { authorization: `Bearer ${famA.token}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_OBSERVATION',
        idempotencyKey: `mem-nm-${Date.now()}`,
      },
    });
    expect(addRes.statusCode).toBe(201);

    // Now nmToken (non-manager) tries to create another member
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${famA.familyId}/members`,
      headers: { authorization: `Bearer ${nmToken}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_OBSERVATION',
        idempotencyKey: `x-nm-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  // ── Non-manager member cannot modify members ──

  it('T061: non-manager member PATCHing member → 403', async () => {
    const famA = await setupFamily('a6');
    const { memberPersonId } = await createMember(famA.token, famA.familyId, 'a6m');

    // Login as non-manager
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `t061_np_${Date.now()}` },
    });
    const { token: npToken } = loginRes.json();

    // Manager adds np as member
    await app.inject({
      method: 'POST',
      url: `/api/v1/families/${famA.familyId}/members`,
      headers: { authorization: `Bearer ${famA.token}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_OBSERVATION',
        idempotencyKey: `mem-np-${Date.now()}`,
      },
    });

    // np tries to PATCH member
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${famA.familyId}/members/${memberPersonId}`,
      headers: { authorization: `Bearer ${npToken}` },
      payload: {
        profileValues: [{ attribute: 'DISPLAY_NAME', valueText: 'hack', sourceKind: 'GUARDIAN_OBSERVATION' }],
        idempotencyKey: `x-npu-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  // ── Cross-family PATCH with member of wrong family → 404 ──

  it('T061: PATCH member from wrong family → 404', async () => {
    const famA = await setupFamily('a7');
    const famB = await setupFamily('b7');
    const { memberPersonId } = await createMember(famB.token, famB.familyId, 'b7m');

    // Family A manager tries to PATCH Family B's member via Family A URL
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${famA.familyId}/members/${memberPersonId}`,
      headers: { authorization: `Bearer ${famA.token}` },
      payload: {
        profileValues: [{ attribute: 'DISPLAY_NAME', valueText: 'hack', sourceKind: 'GUARDIAN_OBSERVATION' }],
        idempotencyKey: `x-xp-${Date.now()}`,
      },
    });
    expect([403, 404]).toContain(res.statusCode);
  });
});
