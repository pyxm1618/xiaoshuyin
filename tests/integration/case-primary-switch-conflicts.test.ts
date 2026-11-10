/**
 * T726 — SwitchPrimaryCase conflict semantics (FR-004/005/011/017).
 *
 * Frozen precedence: schema errors (422) are decided before any state read;
 * state conflicts (409) never write; a not-found target is a 404.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

const PREFIX = 't726_';

describe('case primary switch conflicts (T726)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let seq = 0;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
  });

  afterAll(async () => {
    try {
      const fams = `SELECT id FROM families WHERE display_name LIKE 'T726-%'`;
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN (${fams})`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN (${fams})`);
      await admin.query(`DELETE FROM cases WHERE family_id IN (${fams})`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN (${fams})`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T726-%'`);
      await admin.query(`DELETE FROM persons WHERE created_by_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE '${PREFIX}%'`);
    } catch {
      // best-effort
    }
    await admin.end();
    await app.close();
  });

  async function login(label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `${PREFIX}${label}_${Date.now()}_${seq++}` },
    });
    expect(res.statusCode).toBe(200);
    const b = res.json();
    return { token: b.sessionToken as string, personId: b.person.id as string, accountId: b.accountId as string };
  }

  async function family(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': `t726-fam-${label}-${Date.now()}-${seq++}` },
      payload: { displayName: `T726-${label}`, creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' } },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function createCase(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': `t726-case-${label}-${Date.now()}-${seq++}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number; status: string };
  }

  function switchPrimary(
    token: string,
    targetId: string,
    body: Record<string, unknown>,
    key: string | null = `t726-sw-${Date.now()}-${seq++}`
  ) {
    const headers: Record<string, string> = { authorization: `Bearer ${token}` };
    if (key !== null) headers['idempotency-key'] = key;
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${targetId}/switch-primary`,
      headers,
      payload: body,
    });
  }

  async function counts(familyId: string) {
    const { rows } = await admin.query(
      `SELECT
         (SELECT count(*)::int FROM cases WHERE family_id = $1 AND is_primary AND status <> 'CLOSED') AS primaries,
         (SELECT count(*)::int FROM case_events WHERE family_id = $1) AS events,
         (SELECT count(*)::int FROM business_audit_events WHERE family_id = $1) AS audits`,
      [familyId]
    );
    return rows[0] as { primaries: number; events: number; audits: number };
  }

  it('rejects an already-primary target with 409 and no writes', async () => {
    const owner = await login('already');
    const famId = await family(owner.token, 'already');
    const a = await createCase(owner.token, 'already-a');
    const before = await counts(famId);

    const res = await switchPrimary(owner.token, a.id, {
      reason: '重复点击',
      expectedPrimaryCaseId: a.id,
      expectedPrimaryVersion: a.version,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('CASE_ALREADY_PRIMARY');
    const after = await counts(famId);
    expect(after).toEqual(before);
  });

  it('returns 404 for a missing target and a malformed uuid', async () => {
    const owner = await login('missing');
    await family(owner.token, 'missing');
    const a = await createCase(owner.token, 'missing-a');

    const missing = await switchPrimary(
      owner.token,
      '0192f0c4-0000-7000-8000-000000000000',
      { reason: 'x', expectedPrimaryCaseId: a.id, expectedPrimaryVersion: a.version }
    );
    expect(missing.statusCode).toBe(404);
    expect(missing.json().code).toBe('CASE_NOT_FOUND');

    const malformed = await switchPrimary(owner.token, 'not-a-uuid', {
      reason: 'x',
      expectedPrimaryCaseId: a.id,
      expectedPrimaryVersion: a.version,
    });
    expect(malformed.statusCode).toBe(404);
    expect(malformed.json().code).toBe('CASE_NOT_FOUND');
  });

  it('rejects a stale view with 409 and zero writes', async () => {
    const owner = await login('stale');
    const famId = await family(owner.token, 'stale');
    const a = await createCase(owner.token, 'stale-a');
    const b = await createCase(owner.token, 'stale-b');
    const before = await counts(famId);

    const res = await switchPrimary(owner.token, b.id, {
      reason: '旧视图',
      expectedPrimaryCaseId: a.id,
      expectedPrimaryVersion: a.version + 5,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('STALE_PRIMARY_VIEW');
    expect(await counts(famId)).toEqual(before);
  });

  it('rejects every invalid reason with 422 and zero writes', async () => {
    const owner = await login('reason');
    const famId = await family(owner.token, 'reason');
    const a = await createCase(owner.token, 'reason-a');
    const b = await createCase(owner.token, 'reason-b');
    const before = await counts(famId);

    for (const reason of ['', '   ', 'x'.repeat(501)]) {
      const res = await switchPrimary(owner.token, b.id, {
        reason,
        expectedPrimaryCaseId: a.id,
        expectedPrimaryVersion: a.version,
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VALIDATION_ERROR');
    }

    const missingReason = await switchPrimary(owner.token, b.id, {
      expectedPrimaryCaseId: a.id,
      expectedPrimaryVersion: a.version,
    });
    expect(missingReason.statusCode).toBe(422);
    expect(await counts(famId)).toEqual(before);
  });

  it('shape errors (422) win over a stale view (which would be 409)', async () => {
    const owner = await login('precedence');
    await family(owner.token, 'precedence');
    const a = await createCase(owner.token, 'precedence-a');
    const b = await createCase(owner.token, 'precedence-b');

    const res = await switchPrimary(owner.token, b.id, {
      reason: '   ',
      expectedPrimaryCaseId: a.id,
      expectedPrimaryVersion: a.version + 9,
    });
    expect(res.statusCode).toBe(422);
  });

  it('rejects undeclared fields, including body idempotencyKey, with 422', async () => {
    const owner = await login('extra');
    const famId = await family(owner.token, 'extra');
    const a = await createCase(owner.token, 'extra-a');
    const b = await createCase(owner.token, 'extra-b');
    const before = await counts(famId);

    for (const extra of [
      { isPrimary: true },
      { primary: true },
      { version: 2 },
      { status: 'OPEN' },
      { phase: 'INTAKE' },
      { familyId: famId },
      { targetCaseId: b.id },
      { idempotencyKey: 'body-key-123' },
    ]) {
      const res = await switchPrimary(owner.token, b.id, {
        reason: 'x',
        expectedPrimaryCaseId: a.id,
        expectedPrimaryVersion: a.version,
        ...extra,
      });
      expect(res.statusCode, JSON.stringify(extra)).toBe(422);
    }
    expect(await counts(famId)).toEqual(before);
  });
});