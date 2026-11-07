/**
 * T059 / FR-025 — reads never write audit.
 *
 * GET /cases and GET /cases/:id must not create case_events or
 * business_audit_events, and no read-audit vocabulary may exist.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

let verifyPool: pg.Pool;

describe('Case read produces no audit rows (T059)', () => {
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

  async function login(label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `t059_${label}_${Date.now()}` },
    });
    return res.json().sessionToken as string;
  }

  it('list and detail do not add event / audit rows', async () => {
    const token = await login('main');
    const family = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `t059-fam-${Date.now()}`,
      },
      payload: {
        displayName: 'T059',
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
      },
    });
    const familyId = family.json().id as string;
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `t059-case-${Date.now()}`,
      },
      payload: {},
    });
    const caseId = created.json().id as string;

    // Scoped to this Family so parallel suites cannot perturb the counts.
    const before = await verifyPool.query(
      `SELECT
         (SELECT count(*)::int FROM case_events WHERE family_id = $1) AS events,
         (SELECT count(*)::int FROM business_audit_events WHERE family_id = $1) AS audits`,
      [familyId]
    );

    for (let i = 0; i < 5; i++) {
      const list = await app.inject({
        method: 'GET',
        url: '/api/v1/cases',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(list.statusCode).toBe(200);

      const detail = await app.inject({
        method: 'GET',
        url: `/api/v1/cases/${caseId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(detail.statusCode).toBe(200);
    }

    const after = await verifyPool.query(
      `SELECT
         (SELECT count(*)::int FROM case_events WHERE family_id = $1) AS events,
         (SELECT count(*)::int FROM business_audit_events WHERE family_id = $1) AS audits`,
      [familyId]
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('has no read-audit event vocabulary or access-log table', async () => {
    const { rows } = await verifyPool.query(`
      SELECT pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid IN ('case_events'::regclass, 'business_audit_events'::regclass)
        AND contype = 'c'
    `);
    const text = rows.map((r: any) => r.def).join(' ');
    for (const forbidden of ['CASE_VIEWED', 'CASE_LISTED', 'CASE_ACCESSED']) {
      expect(text).not.toContain(forbidden);
    }

    const tables = await verifyPool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%access%'`
    );
    expect(tables.rows).toEqual([]);
  });
});
