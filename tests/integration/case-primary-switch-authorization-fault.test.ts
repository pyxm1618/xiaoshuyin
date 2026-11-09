/**
 * Slice 7 post-audit remediation — S7-H02-C.
 *
 * `POST /api/v1/cases/:id/switch-primary` must distinguish:
 *   - a KNOWN authorization denial (`denyToError`) → the frozen
 *     anti-enumeration `404 CASE_NOT_FOUND`;
 *   - an UNEXPECTED infrastructure failure while reading authorization facts
 *     (real PostgreSQL `57014` statement timeout) → propagate unchanged so the
 *     global handler answers generic `500 INTERNAL_ERROR`.
 *
 * A 500 must never be collapsed into `404 CASE_NOT_FOUND`: doing so would
 * report "the Case does not exist" for a database fault and hide the real
 * failure from the client and from the redacted unexpected-error log.
 *
 * The fault is injected with a real PostgreSQL statement timeout on the
 * authorization-fact `families` read (the same real-fault mechanism used by
 * `tests/integration/cases-authorization-error-classification.test.ts`). No
 * route internals are mocked and no expected output is relaxed.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { Writable } from 'node:stream';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

const PREFIX = 's7rem_';
const STATEMENT_TIMEOUT_MS = 1500;
const FAULT_SCHEMA = 's7rem_authz_fault';

const GENERIC_500 = {
  code: 'INTERNAL_ERROR',
  message: 'An internal error occurred',
};

let admin: pg.Pool;
let app: Awaited<ReturnType<typeof buildApp>>;
let faultApp: Awaited<ReturnType<typeof buildApp>>;
let faultUrl: string;
let logs = '';
let seq = 0;

function withAuthorizationFactFault(url: string, ms: number): string {
  const parsed = new URL(url);
  parsed.searchParams.set(
    'options',
    `-c statement_timeout=${ms} -c search_path=${FAULT_SCHEMA},public`
  );
  return parsed.toString();
}

async function installAuthorizationFactFault(): Promise<void> {
  await admin.query(`DROP SCHEMA IF EXISTS ${FAULT_SCHEMA} CASCADE`);
  await admin.query(`CREATE SCHEMA ${FAULT_SCHEMA}`);
  await admin.query(
    `CREATE TABLE ${FAULT_SCHEMA}.control (
       singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
       mode text NOT NULL CHECK (mode IN ('off', 'timeout')),
       calls integer NOT NULL DEFAULT 0
     )`
  );
  await admin.query(
    `INSERT INTO ${FAULT_SCHEMA}.control (singleton, mode, calls)
     VALUES (true, 'off', 0)`
  );
  await admin.query(
    `CREATE FUNCTION ${FAULT_SCHEMA}.apply_authorization_family_read_fault()
     RETURNS boolean
     LANGUAGE plpgsql
     VOLATILE
     SECURITY INVOKER
     AS $s7rem$
     DECLARE fault_mode text;
     BEGIN
       UPDATE ${FAULT_SCHEMA}.control
          SET calls = calls + 1
        WHERE singleton = true
        RETURNING mode INTO fault_mode;

       IF fault_mode = 'timeout' THEN
         PERFORM pg_sleep(5);
       END IF;
       RETURN true;
     END;
     $s7rem$`
  );
  // Only the family fact read is faulted. `cases` / `case_events` keep their
  // real public definitions and grants.
  await admin.query(
    `CREATE VIEW ${FAULT_SCHEMA}.families
       WITH (security_invoker = true)
     AS
       SELECT f.*
       FROM public.families AS f
       WHERE CASE
         WHEN NULLIF(current_setting('app.family_id', true), '') IS NULL THEN true
         WHEN f.id <> current_setting('app.family_id')::uuid THEN false
         ELSE ${FAULT_SCHEMA}.apply_authorization_family_read_fault()
       END`
  );
  await admin.query(`GRANT USAGE ON SCHEMA ${FAULT_SCHEMA} TO xiaoshuyin_app`);
  await admin.query(
    `GRANT SELECT, UPDATE ON ${FAULT_SCHEMA}.control TO xiaoshuyin_app`
  );
  // The switch route's Family lock uses `SELECT ... FOR UPDATE` on families.
  await admin.query(
    `GRANT SELECT, UPDATE ON ${FAULT_SCHEMA}.families TO xiaoshuyin_app`
  );
  await admin.query(
    `GRANT EXECUTE ON FUNCTION ${FAULT_SCHEMA}.apply_authorization_family_read_fault()
     TO xiaoshuyin_app`
  );
}

async function setFaultMode(mode: 'off' | 'timeout'): Promise<void> {
  await admin.query(
    `UPDATE ${FAULT_SCHEMA}.control SET mode = $1, calls = 0 WHERE singleton = true`,
    [mode]
  );
}

async function login(target: typeof app, label: string) {
  const res = await target.inject({
    method: 'POST',
    url: '/api/v1/auth/wechat',
    payload: { code: `${PREFIX}${label}_${Date.now()}_${seq++}` },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  return {
    token: body.sessionToken as string,
    personId: body.person.id as string,
    accountId: body.accountId as string,
  };
}

async function createCase(target: typeof app, token: string, key: string) {
  const res = await target.inject({
    method: 'POST',
    url: '/api/v1/cases',
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
    payload: {},
  });
  expect(res.statusCode).toBe(201);
  return res.json() as { id: string; version: number };
}

async function setup(label: string) {
  const actor = await login(app, label);
  const family = await app.inject({
    method: 'POST',
    url: '/api/v1/families',
    headers: {
      authorization: `Bearer ${actor.token}`,
      'idempotency-key': `s7rem-fam-${label}-${Date.now()}-${seq++}`,
    },
    payload: {
      displayName: `S7REM-${label}`,
      creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
    },
  });
  expect(family.statusCode).toBe(201);
  const familyId = family.json().id as string;
  const a = await createCase(app, actor.token, `s7rem-case-${label}-a-${Date.now()}`);
  const b = await createCase(app, actor.token, `s7rem-case-${label}-b-${Date.now()}`);
  return { ...actor, familyId, caseA: a, caseB: b };
}

function switchPrimary(
  target: typeof app,
  token: string,
  targetCaseId: string,
  key: string,
  body: { reason: string; expectedPrimaryCaseId: string | null; expectedPrimaryVersion: number | null }
) {
  return target.inject({
    method: 'POST',
    url: `/api/v1/cases/${targetCaseId}/switch-primary`,
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
    payload: body,
  });
}

function getCase(target: typeof app, token: string, id: string) {
  return target.inject({
    method: 'GET',
    url: `/api/v1/cases/${id}`,
    headers: { authorization: `Bearer ${token}` },
  });
}

async function counts(familyId: string, actorAccountId: string) {
  const { rows } = await admin.query(
    `SELECT
       (SELECT is_primary FROM cases
          WHERE family_id = $1 AND status <> 'CLOSED' LIMIT 1) AS primary_rows,
       (SELECT count(*)::int FROM cases
          WHERE family_id = $1 AND is_primary AND status <> 'CLOSED') AS primaries,
       (SELECT count(*)::int FROM business_audit_events
          WHERE family_id = $1 AND event_type = 'CASE_PRIMARY_SWITCHED') AS audits,
       (SELECT count(*)::int FROM case_events
          WHERE family_id = $1 AND event_type <> 'CASE_CREATED') AS switch_events,
       (SELECT count(*)::int FROM idempotency_keys
          WHERE actor_account_id = $2 AND command_type = 'CASE_SWITCH_PRIMARY') AS idempotency`,
    [familyId, actorAccountId]
  );
  return rows[0] as {
    primary_rows: boolean;
    primaries: number;
    audits: number;
    switch_events: number;
    idempotency: number;
  };
}

describe('S7-H02-C switch-primary authorization error classification', () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    admin = createAdminPool();
    await installAuthorizationFactFault();

    faultUrl = withAuthorizationFactFault(
      process.env['DATABASE_URL']!,
      STATEMENT_TIMEOUT_MS
    );
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs += chunk.toString();
        callback();
      },
    });
    faultApp = await buildApp({
      env: { ...process.env, DATABASE_URL: faultUrl },
      loggerStream: stream,
    });
    await faultApp.ready();
  });

  afterAll(async () => {
    await faultApp.close();
    await cleanup();
    await admin.query(`DROP SCHEMA IF EXISTS ${FAULT_SCHEMA} CASCADE`);
    await admin.end();
    await app.close();
  });

  it('known denial keeps the anti-enumeration 404, identical to GET /cases/:id', async () => {
    const owner = await setup('deny');
    const member = await login(app, 'deny-member');
    await admin.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [owner.familyId, member.personId]
    );

    const res = await switchPrimary(
      app,
      member.token,
      owner.caseB.id,
      `s7rem-deny-${Date.now()}-${seq++}`,
      {
        reason: '无权切换',
        expectedPrimaryCaseId: owner.caseA.id,
        expectedPrimaryVersion: owner.caseA.version,
      }
    );
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      code: 'CASE_NOT_FOUND',
      message: 'Case not found',
    });
    expect(JSON.stringify(res.json())).not.toContain(owner.caseB.id);
    expect(JSON.stringify(res.json())).not.toContain('NOT_FAMILY_MANAGER');

    const detail = await getCase(app, member.token, owner.caseB.id);
    expect(detail.statusCode).toBe(404);
    expect(detail.body).toBe(res.body);

    // The denial produced no business write of any kind.
    const after = await counts(owner.familyId, owner.accountId);
    expect(after.primaries).toBe(1);
    expect(after.audits).toBe(0);
    expect(after.switch_events).toBe(0);
  });

  it('a real 57014 at the authorization fact read propagates to 500, never 404', async () => {
    const victim = await setup('fault');
    const before = await counts(victim.familyId, victim.accountId);
    const key = `s7rem-fault-${Date.now()}-${seq++}`;
    const body = {
      reason: '基础设施故障',
      expectedPrimaryCaseId: victim.caseA.id,
      expectedPrimaryVersion: victim.caseA.version,
    };

    await setFaultMode('timeout');
    logs = '';

    const failed = await switchPrimary(
      faultApp,
      victim.token,
      victim.caseB.id,
      key,
      body
    );
    expect(failed.statusCode).toBe(500);
    expect(failed.statusCode).not.toBe(404);
    expect(failed.json()).toEqual(GENERIC_500);
    expect(JSON.stringify(failed.json())).not.toContain('CASE_NOT_FOUND');
    expect(JSON.stringify(failed.json())).not.toContain(victim.caseB.id);

    const afterFailure = await counts(victim.familyId, victim.accountId);
    expect(afterFailure).toEqual(before);
    expect(afterFailure.primaries).toBe(1);
    expect(afterFailure.audits).toBe(0);
    expect(afterFailure.switch_events).toBe(0);
    expect(afterFailure.idempotency).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(logs).toContain('57014');
    // Redacted unexpected-error logging: no SQL / sleep detail leaks.
    expect(logs).not.toMatch(/pg_sleep|SELECT .*FROM/i);

    // Removing only the PostgreSQL fault lets the exact same request succeed.
    await setFaultMode('off');
    const recovered = await switchPrimary(
      faultApp,
      victim.token,
      victim.caseB.id,
      key,
      body
    );
    expect(recovered.statusCode).toBe(200);
    expect(recovered.json().primary.id).toBe(victim.caseB.id);
    expect(recovered.json().previousPrimary.id).toBe(victim.caseA.id);

    const afterRecovery = await counts(victim.familyId, victim.accountId);
    expect(afterRecovery.primaries).toBe(1);
    expect(afterRecovery.audits).toBe(1);
    expect(afterRecovery.switch_events).toBe(2);
    expect(afterRecovery.idempotency).toBe(1);
  });
});

async function cleanup() {
  const S7REM_FAMILIES = `SELECT id FROM families WHERE display_name LIKE 'S7REM-%'`;
  const S7REM_ACCOUNTS = `SELECT id FROM accounts WHERE wechat_openid LIKE 'fake\\_s7rem\\_%'`;

  const statements = [
    `DELETE FROM business_audit_events WHERE family_id IN (${S7REM_FAMILIES})`,
    `DELETE FROM case_events WHERE family_id IN (${S7REM_FAMILIES})`,
    `DELETE FROM cases WHERE family_id IN (${S7REM_FAMILIES})`,
    `DELETE FROM family_members WHERE family_id IN (${S7REM_FAMILIES})`,
    `DELETE FROM families WHERE display_name LIKE 'S7REM-%'`,
    `DELETE FROM idempotency_keys WHERE actor_account_id IN (${S7REM_ACCOUNTS})`,
    `DELETE FROM persons WHERE created_by_account_id IN (${S7REM_ACCOUNTS})`,
    `DELETE FROM accounts WHERE wechat_openid LIKE 'fake\\_s7rem\\_%'`,
  ];
  for (const statement of statements) {
    try {
      await admin.query(statement);
    } catch {
      // best-effort cleanup
    }
  }
}