/**
 * A13 — transaction atomicity through the REAL POST /api/v1/cases path.
 *
 * Faults are injected with temporary database triggers (created and removed by
 * the test itself; no production test hook). When either the domain event or
 * the business audit insert fails, the whole command must roll back: no Case,
 * no event, no audit and no idempotency row.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

let verifyPool: pg.Pool;

const FAULT_FN = 'cv1_fault_raise';
const EVENT_TRIGGER = 'cv1_fault_case_events';
const AUDIT_TRIGGER = 'cv1_fault_business_audit_events';

describe('Case create rollback (A13)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let owner: pg.Client;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
    owner = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL'] });
    await owner.connect();
  });

  afterAll(async () => {
    await dropFaults();
    await owner.end();
    await verifyPool.end();
    await app.close();
  });

  async function dropFaults() {
    await owner.query(`DROP TRIGGER IF EXISTS ${EVENT_TRIGGER} ON case_events`).catch(() => {});
    await owner.query(`DROP TRIGGER IF EXISTS ${AUDIT_TRIGGER} ON business_audit_events`).catch(() => {});
    await owner.query(`DROP FUNCTION IF EXISTS ${FAULT_FN}()`).catch(() => {});
  }

  async function installFault(table: 'case_events' | 'business_audit_events') {
    await dropFaults();
    await owner.query(`
      CREATE FUNCTION ${FAULT_FN}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'CV1_INJECTED_FAULT';
      END $$;
    `);
    const trigger = table === 'case_events' ? EVENT_TRIGGER : AUDIT_TRIGGER;
    await owner.query(`
      CREATE TRIGGER ${trigger} BEFORE INSERT ON ${table}
      FOR EACH ROW EXECUTE FUNCTION ${FAULT_FN}();
    `);
  }

  async function setup(label: string) {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `cv1_rb_${label}_${Date.now()}` },
    });
    const { token, person, account } = login.json();
    const family = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: `CV1-RB-${label}`,
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        idempotencyKey: `cv1-rb-fam-${label}-${Date.now()}`,
      },
    });
    return {
      token: token as string,
      personId: person.id as string,
      accountId: account.id as string,
      familyId: family.json().id as string,
    };
  }

  async function counts(familyId: string, accountId: string) {
    const { rows } = await verifyPool.query(
      `SELECT
         (SELECT count(*)::int FROM cases WHERE family_id = $1) AS cases,
         (SELECT count(*)::int FROM case_events WHERE family_id = $1) AS events,
         (SELECT count(*)::int FROM business_audit_events
           WHERE family_id = $1 AND event_type = 'CASE_CREATED') AS audits,
         (SELECT count(*)::int FROM idempotency_keys
           WHERE actor_account_id = $2 AND command_type = 'CASE_CREATE') AS keys`,
      [familyId, accountId]
    );
    return rows[0];
  }

  for (const table of ['case_events', 'business_audit_events'] as const) {
    it(`${table} insert failure rolls the whole command back`, async () => {
      const { token, familyId, accountId } = await setup(table);
      await installFault(table);

      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/cases',
          headers: { authorization: `Bearer ${token}` },
          payload: { idempotencyKey: `cv1-rb-${table}-${Date.now()}` },
        });

        // A real failure must never be disguised as success.
        expect(res.statusCode).toBe(500);
        expect(res.json().code).toBe('INTERNAL_ERROR');

        expect(await counts(familyId, accountId)).toEqual({
          cases: 0,
          events: 0,
          audits: 0,
          keys: 0,
        });
      } finally {
        await dropFaults();
      }

      // After the fault is removed the same Family can create normally.
      const ok = await app.inject({
        method: 'POST',
        url: '/api/v1/cases',
        headers: { authorization: `Bearer ${token}` },
        payload: { idempotencyKey: `cv1-rb-recover-${table}-${Date.now()}` },
      });
      expect(ok.statusCode).toBe(201);
      expect(await counts(familyId, accountId)).toMatchObject({ cases: 1, events: 1, audits: 1 });
    });
  }
});
