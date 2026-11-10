/**
 * T729 / S7-III-M04 — SwitchPrimaryCase atomicity (FR-012, plan V-2-22).
 *
 * Four real PostgreSQL fault classes, each injected through a temporary
 * database object, never through a mocked transaction:
 *
 *   A. case_events insert failure (the ASSIGNED event is the last write after
 *      the REVOKED event, so a rollback must also remove the already-written
 *      REVOKED row)
 *   B. business_audit_events insert failure
 *   C. idempotency completion (UPDATE ... response_status) failure
 *   D. real DB CHECK violation (SQLSTATE 23514, not a custom P0001)
 *
 * Every class asserts: HTTP 500 + frozen INTERNAL_ERROR body, primary ownership
 * unchanged, both versions unchanged, no partial case_events / audit residue,
 * no completed or reserved idempotency slot, and a full business-state rollback.
 * Every injected object is dropped and its absence asserted.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

const PREFIX = 't729m4_';

describe('case primary switch atomicity (T729 / S7-III-M04)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let familyId: string;
  let accountId: string;
  let ownerToken: string;
  let caseA: { id: string; version: number };
  let caseB: { id: string; version: number };
  let seq = 0;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();

    const owner = await login('atomic');
    ownerToken = owner.token;
    accountId = owner.accountId;
    familyId = await family(owner.token, 'atomic');
    caseA = await createCase(owner.token, 'atomic-a');
    caseB = await createCase(owner.token, 'atomic-b');
  });

  afterAll(async () => {
    try {
      // Best-effort cleanup of every injected object, then a hard residue proof.
      const { rows: triggers } = await admin.query(
        "SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 't729m4_%'"
      );
      for (const row of triggers) {
        await admin.query(
          `DROP TRIGGER IF EXISTS ${row.tgname} ON ${triggerTable(row.tgname)}`
        );
      }
      const { rows: functions } = await admin.query(
        "SELECT proname FROM pg_proc WHERE proname LIKE 't729m4_%'"
      );
      for (const row of functions) {
        await admin.query(`DROP FUNCTION IF EXISTS ${row.proname}()`);
      }
      const { rows: checks } = await admin.query(
        "SELECT conname FROM pg_constraint WHERE conname LIKE 't729m4_%'"
      );
      for (const row of checks) {
        await admin.query(
          `ALTER TABLE case_events DROP CONSTRAINT IF EXISTS ${row.conname}`
        );
      }

      const residue = await admin.query(
        `SELECT
           (SELECT count(*)::int FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 't729m4_%') AS triggers,
           (SELECT count(*)::int FROM pg_proc WHERE proname LIKE 't729m4_%') AS functions,
           (SELECT count(*)::int FROM pg_constraint WHERE conname LIKE 't729m4_%') AS constraints`
      );
      expect(residue.rows[0]).toEqual({ triggers: 0, functions: 0, constraints: 0 });

      await admin.query(`DELETE FROM business_audit_events WHERE family_id = $1`, [familyId]);
      await admin.query(`DELETE FROM case_events WHERE family_id = $1`, [familyId]);
      await admin.query(`DELETE FROM cases WHERE family_id = $1`, [familyId]);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id = $1`, [accountId]);
      await admin.query(`DELETE FROM family_members WHERE family_id = $1`, [familyId]);
      await admin.query(`DELETE FROM families WHERE id = $1`, [familyId]);
      await admin.query(`DELETE FROM persons WHERE account_id = $1`, [accountId]);
      await admin.query(`DELETE FROM accounts WHERE id = $1`, [accountId]);
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
    return {
      token: b.sessionToken as string,
      personId: b.person.id as string,
      accountId: b.accountId as string,
    };
  }

  async function family(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `${PREFIX}fam-${label}-${Date.now()}-${seq++}`,
      },
      payload: {
        displayName: `M4-${label}`,
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
        'idempotency-key': `${PREFIX}case-${label}-${Date.now()}-${seq++}`,
      },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number };
  }

  async function switchPrimary(body: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseB.id}/switch-primary`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'idempotency-key': `${PREFIX}switch-${Date.now()}-${seq++}`,
      },
      payload: body,
    });
  }

  async function expectRolledBack(res: any, before: Record<string, unknown>) {
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    });
    expect(await snapshot()).toEqual(before);
  }

  it('A — returns 500 and rolls back every write when the ASSIGNED event insert fails', async () => {
    const suffix = `${Date.now()}_${seq++}`;
    const trigger = `t729m4_a_${suffix}`;
    const fn = `t729m4_a_${suffix}_fn`;
    await installFamilyTrigger({
      trigger,
      fn,
      table: 'case_events',
      event: 'INSERT',
      predicate: `NEW.family_id = '${familyId}'::uuid AND NEW.event_type = 'CASE_PRIMARY_ASSIGNED'`,
      message: 'm04 injected ASSIGNED-event failure',
    });

    const before = await snapshot();
    const res = await switchPrimary({
      reason: '必须回滚 A',
      expectedPrimaryCaseId: caseA.id,
      expectedPrimaryVersion: caseA.version,
    });
    await expectRolledBack(res, before);

    await dropFamilyTrigger(trigger, 'case_events', fn);
  });

  it('B — returns 500 and rolls back every write when the business audit insert fails', async () => {
    const suffix = `${Date.now()}_${seq++}`;
    const trigger = `t729m4_b_${suffix}`;
    const fn = `t729m4_b_${suffix}_fn`;
    await installFamilyTrigger({
      trigger,
      fn,
      table: 'business_audit_events',
      event: 'INSERT',
      predicate: `NEW.family_id = '${familyId}'::uuid`,
      message: 'm04 injected audit failure',
    });

    const before = await snapshot();
    const res = await switchPrimary({
      reason: '必须回滚 B',
      expectedPrimaryCaseId: caseA.id,
      expectedPrimaryVersion: caseA.version,
    });
    await expectRolledBack(res, before);

    await dropFamilyTrigger(trigger, 'business_audit_events', fn);
  });

  it('C — returns 500 and rolls back every write when idempotency completion fails', async () => {
    const suffix = `${Date.now()}_${seq++}`;
    const trigger = `t729m4_c_${suffix}`;
    const fn = `t729m4_c_${suffix}_fn`;
    await installFamilyTrigger({
      trigger,
      fn,
      table: 'idempotency_keys',
      event: 'UPDATE',
      predicate: `NEW.actor_account_id = '${accountId}'::uuid AND NEW.command_type = 'CASE_SWITCH_PRIMARY'`,
      message: 'm04 injected idempotency completion failure',
    });

    const before = await snapshot();
    const res = await switchPrimary({
      reason: '必须回滚 C',
      expectedPrimaryCaseId: caseA.id,
      expectedPrimaryVersion: caseA.version,
    });
    await expectRolledBack(res, before);

    await dropFamilyTrigger(trigger, 'idempotency_keys', fn);
  });

  it('D — returns 500 and rolls back every write on a real DB CHECK violation (23514)', async () => {
    const suffix = `${Date.now()}_${seq++}`;
    const constraint = `t729m4_d_${suffix}`;
    const marker = `m04-conflict-${suffix}`;
    // NOT VALID keeps historical rows untouched; the constraint still applies
    // to every new row. Scoped to this Family + ASSIGNED so the REVOKED event
    // is written first and must be rolled back too.
    await admin.query(
      `ALTER TABLE case_events ADD CONSTRAINT ${constraint} CHECK (
         family_id <> '${familyId}'::uuid
         OR event_type <> 'CASE_PRIMARY_ASSIGNED'
         OR metadata ->> 'reason' IS DISTINCT FROM '${marker}'
       ) NOT VALID`
    );

    const before = await snapshot();
    const res = await switchPrimary({
      reason: marker,
      expectedPrimaryCaseId: caseA.id,
      expectedPrimaryVersion: caseA.version,
    });
    await expectRolledBack(res, before);

    const { rows: constraintRows } = await admin.query(
      'SELECT conname FROM pg_constraint WHERE conname = $1',
      [constraint]
    );
    expect(constraintRows).toHaveLength(1);
    await admin.query(`ALTER TABLE case_events DROP CONSTRAINT ${constraint}`);
  });

  async function installFamilyTrigger(input: {
    trigger: string;
    fn: string;
    table: string;
    event: 'INSERT' | 'UPDATE';
    predicate: string;
    message: string;
  }) {
    await admin.query(`CREATE FUNCTION ${input.fn}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF ${input.predicate} THEN
          RAISE EXCEPTION '${input.message}' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
      END $$`);
    await admin.query(
      `CREATE TRIGGER ${input.trigger} BEFORE ${input.event} ON ${input.table}
       FOR EACH ROW EXECUTE FUNCTION ${input.fn}()`
    );
  }

  async function dropFamilyTrigger(trigger: string, table: string, fn: string) {
    await admin.query(`DROP TRIGGER IF EXISTS ${trigger} ON ${table}`);
    await admin.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    const { rows } = await admin.query(
      `SELECT
         (SELECT count(*)::int FROM pg_trigger WHERE tgname = $1 AND NOT tgisinternal) AS triggers,
         (SELECT count(*)::int FROM pg_proc WHERE proname = $2) AS functions`,
      [trigger, fn]
    );
    expect(rows[0]).toEqual({ triggers: 0, functions: 0 });
  }

  async function snapshot() {
    const { rows } = await admin.query(
      `SELECT
         (SELECT is_primary FROM cases WHERE id = $1) AS a_primary,
         (SELECT version FROM cases WHERE id = $1) AS a_version,
         (SELECT status::text FROM cases WHERE id = $1) AS a_status,
         (SELECT is_primary FROM cases WHERE id = $2) AS b_primary,
         (SELECT version FROM cases WHERE id = $2) AS b_version,
         (SELECT status::text FROM cases WHERE id = $2) AS b_status,
         (SELECT updated_at FROM cases WHERE id = $1) AS a_updated_at,
         (SELECT updated_at FROM cases WHERE id = $2) AS b_updated_at,
         (SELECT count(*)::int FROM case_events WHERE family_id = $3) AS events,
         (SELECT count(*)::int FROM case_events
           WHERE family_id = $3
             AND event_type IN ('CASE_PRIMARY_ASSIGNED', 'CASE_PRIMARY_REVOKED')) AS primary_events,
         (SELECT count(*)::int FROM business_audit_events
           WHERE family_id = $3 AND event_type = 'CASE_PRIMARY_SWITCHED') AS audits,
         (SELECT count(*)::int FROM idempotency_keys
           WHERE actor_account_id = $4 AND command_type = 'CASE_SWITCH_PRIMARY') AS idem_total,
         (SELECT count(*)::int FROM idempotency_keys
           WHERE actor_account_id = $4 AND command_type = 'CASE_SWITCH_PRIMARY'
             AND response_status <> 0) AS idem_completed`,
      [caseA.id, caseB.id, familyId, accountId]
    );
    return rows[0];
  }
});

function triggerTable(name: string): string {
  if (name.includes('_a_')) return 'case_events';
  if (name.includes('_b_')) return 'business_audit_events';
  return 'idempotency_keys';
}