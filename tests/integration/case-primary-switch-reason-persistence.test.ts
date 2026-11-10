/**
 * S7-II-M01 — legal reason survives JSONB persistence unchanged, and
 * unrepresentable reasons are rejected with zero writes.
 *
 * The same `parsed.data.reason` feeds the idempotency payload hash, both
 * case_events rows and the business_audit_events row. This test reads the
 * persisted values back and compares them character-by-character with the
 * submitted value.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

const PREFIX = 't7reason_';

describe('switch-primary reason persistence (S7-II-M01)', () => {
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
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T7REASON-%')`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T7REASON-%')`);
      await admin.query(`DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T7REASON-%')`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T7REASON-%')`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T7REASON-%'`);
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
    return { token: b.sessionToken as string, accountId: b.accountId as string };
  }

  async function family(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `t7reason-fam-${label}-${Date.now()}-${seq++}`,
      },
      payload: {
        displayName: `T7REASON-${label}`,
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function createCase(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `t7reason-case-${label}-${Date.now()}-${seq++}`,
      },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number };
  }

  function switchPrimary(token: string, targetId: string, body: unknown) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${targetId}/switch-primary`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `t7reason-sw-${Date.now()}-${seq++}`,
      },
      payload: body as Record<string, unknown>,
    });
  }

  async function counts(familyId: string, accountId: string) {
    const { rows } = await admin.query(
      `SELECT
         (SELECT count(*)::int FROM cases WHERE family_id = $1) AS cases,
         (SELECT count(*)::int FROM case_events WHERE family_id = $1) AS events,
         (SELECT count(*)::int FROM business_audit_events WHERE family_id = $1) AS audits,
         (SELECT count(*)::int FROM idempotency_keys WHERE actor_account_id = $2) AS idem`,
      [familyId, accountId]
    );
    return rows[0] as { cases: number; events: number; audits: number; idem: number };
  }

  it('persists a legal Unicode reason unchanged in both events and audit', async () => {
    const owner = await login('persist');
    const famId = await family(owner.token, 'persist');
    const a = await createCase(owner.token, 'persist-a');
    const b = await createCase(owner.token, 'persist-b');
    const reason = '  中文 😀 "引号" \n第二行  ';

    const res = await switchPrimary(owner.token, b.id, {
      reason,
      expectedPrimaryCaseId: a.id,
      expectedPrimaryVersion: a.version,
    });
    expect(res.statusCode).toBe(200);

    const { rows: events } = await admin.query(
      `SELECT event_type, metadata->>'reason' AS reason
         FROM case_events
        WHERE family_id = $1 AND event_type <> 'CASE_CREATED'
        ORDER BY occurred_at, id`,
      [famId]
    );
    expect(events.map((r: any) => r.event_type)).toEqual([
      'CASE_PRIMARY_REVOKED',
      'CASE_PRIMARY_ASSIGNED',
    ]);
    for (const row of events) expect(row.reason).toBe(reason);

    const { rows: audits } = await admin.query(
      `SELECT metadata->>'reason' AS reason
         FROM business_audit_events
        WHERE family_id = $1 AND event_type = 'CASE_PRIMARY_SWITCHED'`,
      [famId]
    );
    expect(audits).toHaveLength(1);
    expect(audits[0].reason).toBe(reason);
  });

  it('rejects U+0000 and isolated surrogates with 422 and zero writes', async () => {
    const owner = await login('invalid');
    const famId = await family(owner.token, 'invalid');
    const a = await createCase(owner.token, 'invalid-a');
    const b = await createCase(owner.token, 'invalid-b');
    const before = await counts(famId, owner.accountId);

    const invalidReasons = ['a\u0000b', '\uD800', '\uDC00', 'x\uD800y'];
    for (const reason of invalidReasons) {
      const res = await switchPrimary(owner.token, b.id, {
        reason,
        expectedPrimaryCaseId: a.id,
        expectedPrimaryVersion: a.version,
      });
      expect(res.statusCode, JSON.stringify(reason)).toBe(422);
      expect(res.json().code).toBe('VALIDATION_ERROR');
    }

    expect(await counts(famId, owner.accountId)).toEqual(before);
  });
});