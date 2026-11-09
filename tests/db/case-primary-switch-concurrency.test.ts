/**
 * T724 — SwitchPrimaryCase concurrency (FR-001/FR-015, plan D-3).
 *
 * Real concurrent HTTP commands against the same Family:
 *   A. two switches to different targets → one 200 and one 409, exactly one primary
 *   B. two switches to the same target → one 200 and one 409 CASE_ALREADY_PRIMARY
 *   C. switch vs create → primary count stays <= 1
 *   D. same idempotency key concurrently → exactly one business result
 * No concurrent path may return 500.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

const PREFIX = 't724_';

describe('case primary switch concurrency (T724)', () => {
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
      const fams = `SELECT id FROM families WHERE display_name LIKE 'T724-%'`;
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN (${fams})`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN (${fams})`);
      await admin.query(`DELETE FROM cases WHERE family_id IN (${fams})`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN (${fams})`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T724-%'`);
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
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': `t724-fam-${label}-${Date.now()}-${seq++}` },
      payload: { displayName: `T724-${label}`, creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' } },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function createCase(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': `t724-case-${label}-${Date.now()}-${seq++}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number };
  }

  function switchPrimary(token: string, targetId: string, body: Record<string, unknown>, key?: string) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${targetId}/switch-primary`,
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': key ?? `t724-sw-${Date.now()}-${seq++}` },
      payload: body,
    });
  }

  async function primaryCount(familyId: string) {
    const { rows } = await admin.query(
      `SELECT count(*)::int c FROM cases WHERE family_id = $1 AND is_primary AND status <> 'CLOSED'`,
      [familyId]
    );
    return rows[0].c as number;
  }

  it('two switches to different targets: one wins, one stale, exactly one primary', async () => {
    const owner = await login('diff');
    const famId = await family(owner.token, 'diff');
    const a = await createCase(owner.token, 'diff-a');
    const b = await createCase(owner.token, 'diff-b');
    const c = await createCase(owner.token, 'diff-c');
    const view = { expectedPrimaryCaseId: a.id, expectedPrimaryVersion: a.version };

    const [r1, r2] = await Promise.all([
      switchPrimary(owner.token, b.id, { reason: 'to b', ...view }),
      switchPrimary(owner.token, c.id, { reason: 'to c', ...view }),
    ]);
    const codes = [r1.statusCode, r2.statusCode].sort();
    expect(codes).toEqual([200, 409]);
    expect(codes).not.toContain(500);
    expect(await primaryCount(famId)).toBe(1);
  });

  it('two switches to the same target: one wins, one CASE_ALREADY_PRIMARY', async () => {
    const owner = await login('same');
    const famId = await family(owner.token, 'same');
    const a = await createCase(owner.token, 'same-a');
    const b = await createCase(owner.token, 'same-b');
    const body = { reason: 'same target', expectedPrimaryCaseId: a.id, expectedPrimaryVersion: a.version };

    const [r1, r2] = await Promise.all([
      switchPrimary(owner.token, b.id, body),
      switchPrimary(owner.token, b.id, body),
    ]);
    const codes = [r1.statusCode, r2.statusCode].sort();
    expect(codes).toEqual([200, 409]);
    const failed = r1.statusCode === 409 ? r1 : r2;
    expect(failed.json().code).toBe('CASE_ALREADY_PRIMARY');
    expect(await primaryCount(famId)).toBe(1);
  });

  it('switch vs create keeps the primary count at most one', async () => {
    const owner = await login('vscreate');
    const famId = await family(owner.token, 'vscreate');
    const a = await createCase(owner.token, 'vscreate-a');
    const b = await createCase(owner.token, 'vscreate-b');

    const [sw, created] = await Promise.all([
      switchPrimary(owner.token, b.id, {
        reason: 'switch',
        expectedPrimaryCaseId: a.id,
        expectedPrimaryVersion: a.version,
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/cases',
        headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t724-create-${Date.now()}-${seq++}` },
        payload: {},
      }),
    ]);
    expect([200, 409]).toContain(sw.statusCode);
    expect(created.statusCode).toBe(201);
    expect(created.json().primary).toBe(false);
    expect(await primaryCount(famId)).toBe(1);
  });

  it('same idempotency key concurrently produces exactly one business result', async () => {
    const owner = await login('samekey');
    const famId = await family(owner.token, 'samekey');
    const a = await createCase(owner.token, 'samekey-a');
    const b = await createCase(owner.token, 'samekey-b');
    const key = `t724-samekey-${Date.now()}-${seq++}`;
    const body = { reason: 'same key', expectedPrimaryCaseId: a.id, expectedPrimaryVersion: a.version };

    const results = await Promise.all([
      switchPrimary(owner.token, b.id, body, key),
      switchPrimary(owner.token, b.id, body, key),
      switchPrimary(owner.token, b.id, body, key),
    ]);
    expect(results.every((r) => r.statusCode === 200)).toBe(true);
    const bodies = new Set(results.map((r) => r.body));
    expect(bodies.size).toBe(1);
    const { rows } = await admin.query(
      `SELECT count(*)::int c FROM case_events WHERE case_id = $1`,
      [b.id]
    );
    expect(rows[0].c).toBe(2);
    expect(await primaryCount(famId)).toBe(1);
  });
});