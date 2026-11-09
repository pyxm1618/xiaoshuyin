/**
 * T728 — SwitchPrimaryCase idempotency (FR-010, plan D-7).
 *
 * Transport is the frozen `Idempotency-Key` header only. Replay is decided
 * before any state read, so a replay after the target is already primary still
 * returns the original 200 body rather than 409 CASE_ALREADY_PRIMARY.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

const PREFIX = 't728_';

describe('case primary switch idempotency (T728)', () => {
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
      const fams = `SELECT id FROM families WHERE display_name LIKE 'T728-%'`;
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN (${fams})`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN (${fams})`);
      await admin.query(`DELETE FROM cases WHERE family_id IN (${fams})`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN (${fams})`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T728-%'`);
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
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': `t728-fam-${label}-${Date.now()}-${seq++}` },
      payload: { displayName: `T728-${label}`, creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' } },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function createCase(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': `t728-case-${label}-${Date.now()}-${seq++}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number };
  }

  function switchPrimary(
    token: string,
    targetId: string,
    body: Record<string, unknown>,
    key: string | null
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

  it('requires the Idempotency-Key header and its 8..128 length', async () => {
    const owner = await login('header');
    await family(owner.token, 'header');
    const a = await createCase(owner.token, 'header-a');
    const b = await createCase(owner.token, 'header-b');
    const body = {
      reason: 'x',
      expectedPrimaryCaseId: a.id,
      expectedPrimaryVersion: a.version,
    };

    expect((await switchPrimary(owner.token, b.id, body, null)).statusCode).toBe(422);
    expect((await switchPrimary(owner.token, b.id, body, 'short12')).statusCode).toBe(422);
    expect((await switchPrimary(owner.token, b.id, body, 'x'.repeat(129))).statusCode).toBe(422);
  });

  it('replays the original body even after the target is already primary', async () => {
    const owner = await login('replay');
    await family(owner.token, 'replay');
    const a = await createCase(owner.token, 'replay-a');
    const b = await createCase(owner.token, 'replay-b');
    const key = `t728-replay-${Date.now()}-${seq++}`;
    const body = {
      reason: '重放测试',
      expectedPrimaryCaseId: a.id,
      expectedPrimaryVersion: a.version,
    };

    const first = await switchPrimary(owner.token, b.id, body, key);
    expect(first.statusCode).toBe(200);
    const second = await switchPrimary(owner.token, b.id, body, key);
    expect(second.statusCode).toBe(200);
    expect(second.body).toBe(first.body);

    const { rows } = await admin.query(
      `SELECT
         (SELECT count(*)::int FROM case_events WHERE case_id = $1) AS events,
         (SELECT count(*)::int FROM cases WHERE id = $1 AND version = $2) AS versions`,
      [b.id, first.json().primary.version]
    );
    expect(rows[0].events).toBe(2);
    expect(rows[0].versions).toBe(1);
  });

  it('rejects same key with a different target / reason / view as 409 mismatch', async () => {
    const owner = await login('mismatch');
    await family(owner.token, 'mismatch');
    const a = await createCase(owner.token, 'mismatch-a');
    const b = await createCase(owner.token, 'mismatch-b');
    const c = await createCase(owner.token, 'mismatch-c');
    const key = `t728-mismatch-${Date.now()}-${seq++}`;

    const base = {
      reason: '原始理由',
      expectedPrimaryCaseId: a.id,
      expectedPrimaryVersion: a.version,
    };
    const first = await switchPrimary(owner.token, b.id, base, key);
    expect(first.statusCode).toBe(200);

    const variants = [
      { ...base, reason: '另一个理由' },
      { ...base, expectedPrimaryVersion: a.version + 1 },
      { reason: '原始理由', expectedPrimaryCaseId: null, expectedPrimaryVersion: null },
    ];
    for (const variant of variants) {
      const res = await switchPrimary(owner.token, b.id, variant, key);
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    }

    const differentTarget = await switchPrimary(owner.token, c.id, base, key);
    expect(differentTarget.statusCode).toBe(409);
    expect(differentTarget.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
  });

  it('a failed command leaves no idempotency row', async () => {
    const owner = await login('rollback');
    await family(owner.token, 'rollback');
    const a = await createCase(owner.token, 'rollback-a');
    const b = await createCase(owner.token, 'rollback-b');
    const key = `t728-rollback-${Date.now()}-${seq++}`;

    const res = await switchPrimary(
      owner.token,
      b.id,
      { reason: 'x', expectedPrimaryCaseId: a.id, expectedPrimaryVersion: a.version + 7 },
      key
    );
    expect(res.statusCode).toBe(409);

    const { rows } = await admin.query(
      `SELECT count(*)::int c FROM idempotency_keys
        WHERE actor_account_id = $1 AND command_type = 'CASE_SWITCH_PRIMARY'`,
      [owner.accountId]
    );
    expect(rows[0].c).toBe(0);
  });
});