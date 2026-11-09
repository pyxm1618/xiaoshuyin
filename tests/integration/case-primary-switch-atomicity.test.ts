/**
 * T729 — SwitchPrimaryCase atomicity (FR-012, plan V-2-22).
 *
 * A temporary trigger makes the business-audit insert fail inside the switch
 * transaction. The command must return the frozen generic 500, and none of
 * `cases.is_primary` / `cases.version` / `case_events` / `idempotency_keys`
 * may change. The trigger is dropped and its absence asserted in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

const PREFIX = 't729_';
const TRIGGER = 't729_audit_failure';
const FN = 't729_audit_failure_fn';

describe('case primary switch atomicity (T729)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let seq = 0;
  let familyId: string;
  let accountId: string;
  let ownerToken: string;
  let caseA: { id: string; version: number };
  let caseB: { id: string; version: number };

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
      await admin.query(`DROP TRIGGER IF EXISTS ${TRIGGER} ON business_audit_events`);
      await admin.query(`DROP FUNCTION IF EXISTS ${FN}()`);
      const residue = await admin.query(
        `SELECT
           (SELECT count(*)::int FROM pg_trigger WHERE tgname = $1) AS triggers,
           (SELECT count(*)::int FROM pg_proc WHERE proname = $2) AS functions`,
        [TRIGGER, FN]
      );
      expect(residue.rows[0]).toEqual({ triggers: 0, functions: 0 });
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

  let seqLocal = 0;
  async function login(label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `${PREFIX}${label}_${Date.now()}_${seqLocal++}` },
    });
    expect(res.statusCode).toBe(200);
    const b = res.json();
    return { token: b.sessionToken as string, personId: b.person.id as string, accountId: b.accountId as string };
  }

  async function family(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': `t729-fam-${label}-${Date.now()}-${seqLocal++}` },
      payload: { displayName: `T729-${label}`, creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' } },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function createCase(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': `t729-case-${label}-${Date.now()}-${seqLocal++}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number };
  }

  async function installFailure() {
    await admin.query(`CREATE OR REPLACE FUNCTION ${FN}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.family_id = '${familyId}' THEN
          RAISE EXCEPTION 't729 injected audit failure' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
      END $$`);
    await admin.query(`CREATE TRIGGER ${TRIGGER} BEFORE INSERT ON business_audit_events
      FOR EACH ROW EXECUTE FUNCTION ${FN}()`);
  }

  it('returns 500 and rolls back every write when the audit insert fails', async () => {
    await installFailure();

    const before = await snapshot();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseB.id}/switch-primary`,
      headers: { authorization: `Bearer ${ownerToken}`, 'idempotency-key': `t729-fail-${Date.now()}-${seqLocal++}` },
      payload: {
        reason: '必须回滚',
        expectedPrimaryCaseId: caseA.id,
        expectedPrimaryVersion: caseA.version,
      },
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    });
    expect(await snapshot()).toEqual(before);

    await admin.query(`DROP TRIGGER IF EXISTS ${TRIGGER} ON business_audit_events`);
    await admin.query(`DROP FUNCTION IF EXISTS ${FN}()`);
  });

  async function snapshot() {
    const { rows } = await admin.query(
      `SELECT
         (SELECT is_primary FROM cases WHERE id = $1) AS a_primary,
         (SELECT version FROM cases WHERE id = $1) AS a_version,
         (SELECT is_primary FROM cases WHERE id = $2) AS b_primary,
         (SELECT version FROM cases WHERE id = $2) AS b_version,
         (SELECT count(*)::int FROM case_events WHERE family_id = $3) AS events,
         (SELECT count(*)::int FROM business_audit_events
           WHERE family_id = $3 AND event_type = 'CASE_PRIMARY_SWITCHED') AS audits,
         (SELECT count(*)::int FROM idempotency_keys WHERE actor_account_id = $4 AND command_type = 'CASE_SWITCH_PRIMARY') AS idem`,
      [caseA.id, caseB.id, familyId, accountId]
    );
    return rows[0];
  }
});