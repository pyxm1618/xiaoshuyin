/**
 * ULT-002 — Message authorization error classification.
 *
 * Frozen rule: only an explicit, known authorization denial is collapsed into
 * the anti-enumeration `404 CASE_NOT_FOUND`. Unknown infrastructure failures
 * (real PostgreSQL `57014` statement timeout, connection loss) MUST propagate
 * to the global 500 INTERNAL_ERROR handler.
 *
 * The failure is injected with a real PostgreSQL statement timeout on an
 * isolated app pool (no mocks / stubs).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { Writable } from 'node:stream';
import { buildApp } from '../../apps/server/api/src/app.js';
import {
  denyToError,
  isKnownAuthorizationDenial,
  requireFamilyAction,
} from '../../apps/server/api/src/authz.js';
import {
  withIdentityTransaction,
  withRlsTransaction,
} from '../../apps/server/api/src/db/tx.js';
import { requireCurrentFamily } from '../../apps/server/api/src/family-context.js';
import { createAdminPool } from '../setup/db.js';

const STATEMENT_TIMEOUT_MS = 1500;
const FAULT_SCHEMA = 'ult002_authz_fault';

let admin: pg.Pool;
let app: Awaited<ReturnType<typeof buildApp>>;
let faultApp: Awaited<ReturnType<typeof buildApp>>;
let faultProbePool: pg.Pool;
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
       enabled boolean NOT NULL
     )`
  );
  await admin.query(
    `INSERT INTO ${FAULT_SCHEMA}.control (singleton, enabled) VALUES (true, true)`
  );
  await admin.query(
    `CREATE FUNCTION ${FAULT_SCHEMA}.pause_authorization_family_read()
     RETURNS boolean
     LANGUAGE plpgsql
     VOLATILE
     SECURITY INVOKER
     AS $ult002$
     DECLARE fault_enabled boolean;
     BEGIN
       SELECT enabled INTO fault_enabled
       FROM ${FAULT_SCHEMA}.control
       WHERE singleton = true;

       IF COALESCE(fault_enabled, false)
          AND NULLIF(current_setting('app.family_id', true), '') IS NOT NULL THEN
         PERFORM pg_sleep(5);
       END IF;

       RETURN true;
     END
     $ult002/**
 * ULT-002 — Message authorization error classification.
 *
 * Frozen rule: only an explicit, known authorization denial is collapsed into
 * the anti-enumeration `404 CASE_NOT_FOUND`. Unknown infrastructure failures
 * (real PostgreSQL `57014` statement timeout, connection loss) MUST propagate
 * to the global 500 INTERNAL_ERROR handler.
 *
 * The failure is injected with a real PostgreSQL statement timeout on an
 * isolated app pool (no mocks / stubs).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { Writable } from 'node:stream';
import { buildApp } from '../../apps/server/api/src/app.js';
import {
  denyToError,
  isKnownAuthorizationDenial,
  requireFamilyAction,
} from '../../apps/server/api/src/authz.js';
import {
  withIdentityTransaction,
  withRlsTransaction,
} from '../../apps/server/api/src/db/tx.js';
import { requireCurrentFamily } from '../../apps/server/api/src/family-context.js';
import { createAdminPool } from '../setup/db.js';

const STATEMENT_TIMEOUT_MS = 1500;
const FAULT_SCHEMA = 'ult002_authz_fault';

let admin: pg.Pool;
let app: Awaited<ReturnType<typeof buildApp>>;
let faultApp: Awaited<ReturnType<typeof buildApp>>;
let faultProbePool: pg.Pool;
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
       enabled boolean NOT NULL
     )`
  );
  await admin.query(
    `INSERT INTO ${FAULT_SCHEMA}.control (singleton, enabled) VALUES (true, true)`
  );
  await admin.query(
    `CREATE FUNCTION ${FAULT_SCHEMA}.pause_authorization_family_read()
     RETURNS boolean
     LANGUAGE plpgsql
     VOLATILE
     SECURITY INVOKER

  );
  await admin.query(
    `CREATE VIEW ${FAULT_SCHEMA}.families
       WITH (security_invoker = true)
     AS
       SELECT f.*
       FROM public.families AS f
       WHERE ${FAULT_SCHEMA}.pause_authorization_family_read()`
  );
  await admin.query(`GRANT USAGE ON SCHEMA ${FAULT_SCHEMA} TO xiaoshuyin_app`);
  await admin.query(
    `GRANT SELECT ON ${FAULT_SCHEMA}.control, ${FAULT_SCHEMA}.families TO xiaoshuyin_app`
  );
  await admin.query(
    `GRANT EXECUTE ON FUNCTION ${FAULT_SCHEMA}.pause_authorization_family_read()
     TO xiaoshuyin_app`
  );
}

async function setFaultEnabled(enabled: boolean): Promise<void> {
  await admin.query(
    `UPDATE ${FAULT_SCHEMA}.control SET enabled = $1 WHERE singleton = true`,
    [enabled]
  );
}

async function login(target: typeof app, label: string) {
  const res = await target.inject({
    method: 'POST',
    url: '/api/v1/auth/wechat',
    payload: { code: `ult002_${label}_${Date.now()}_${seq++}` },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  return {
    token: body.sessionToken as string,
    personId: body.person.id as string,
    accountId: body.accountId as string,
  };
}

async function setup(label: string) {
  const actor = await login(app, label);
  const family = await app.inject({
    method: 'POST',
    url: '/api/v1/families',
    headers: {
      authorization: `Bearer ${actor.token}`,
      'idempotency-key': `ult002-fam-${label}-${Date.now()}-${seq++}`,
    },
    payload: {
      displayName: `ULT002-${label}`,
      creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
    },
  });
  expect(family.statusCode).toBe(201);
  const familyId = family.json().id as string;
  const kase = await app.inject({
    method: 'POST',
    url: '/api/v1/cases',
    headers: {
      authorization: `Bearer ${actor.token}`,
      'idempotency-key': `ult002-case-${label}-${Date.now()}-${seq++}`,
    },
    payload: {},
  });
  expect(kase.statusCode).toBe(201);
  return { ...actor, familyId, caseId: kase.json().id as string };
}

function postMessage(
  target: typeof app,
  token: string,
  caseId: string,
  key: string,
  content = 'ult002 probe'
) {
  return target.inject({
    method: 'POST',
    url: `/api/v1/cases/${caseId}/messages`,
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
    payload: { content },
  });
}

async function counts(familyId: string, idempotencyKey: string) {
  const { rows } = await admin.query(
    `SELECT
       (SELECT count(*)::int FROM dialogue_messages WHERE family_id = $1) AS messages,
       (SELECT count(*)::int FROM business_audit_events WHERE family_id = $1) AS audits,
       (SELECT count(*)::int FROM idempotency_keys WHERE idempotency_key = $2) AS idempotency`,
    [familyId, idempotencyKey]
  );
  return rows[0] as { messages: number; audits: number; idempotency: number };
}

describe('ULT-002 authorization error classification', () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    admin = createAdminPool();
    await installAuthorizationFactFault();

    faultUrl = withAuthorizationFactFault(
      process.env['DATABASE_URL']!,
      STATEMENT_TIMEOUT_MS
    );
    faultProbePool = new pg.Pool({ connectionString: faultUrl, max: 1 });

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
    await faultProbePool.end();
    await faultApp.close();
    await cleanup();
    await admin.query(`DROP SCHEMA IF EXISTS ${FAULT_SCHEMA} CASCADE`);
    await admin.end();
    await app.close();
  });

  it('maps an explicit authorization denial to the uniform 404', async () => {
    const owner = await setup('deny');
    const member = await login(app, 'deny-member');
    await admin.query('INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)', [
      owner.familyId,
      member.personId,
    ]);
    const before = await counts(owner.familyId, 'unused');

    const res = await postMessage(
      app,
      member.token,
      owner.caseId,
      `ult002-deny-${Date.now()}`
    );
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: 'CASE_NOT_FOUND', message: 'Case not found' });

    const after = await counts(owner.familyId, 'unused');
    expect(after.messages).toBe(before.messages);
    expect(after.audits).toBe(before.audits);
  });

  it('injects real 57014 at requireFamilyAction -> readFacts, not current-family resolution', async () => {
    const victim = await setup('stage');

    // Same fault connection and search_path: identity/current-family resolution
    // must complete normally because app.family_id is not set in this phase.
    const resolvedFamilyId = await withIdentityTransaction(
      faultProbePool,
      { accountId: victim.accountId, purpose: 'FAMILY_MANAGEMENT' },
      (tx) => requireCurrentFamily(tx, victim.personId)
    );
    expect(resolvedFamilyId).toBe(victim.familyId);

    // After set_family_context(), the test-only families view sleeps. The only
    // callback work is requireFamilyAction(), whose first readFacts query is
    // getFamilyById(); statement_timeout therefore raises a real PG 57014 at
    // the authorization-facts stage.
    let sqlstate: string | undefined;
    try {
      await withRlsTransaction(
        faultProbePool,
        {
          familyId: victim.familyId,
          accountId: victim.accountId,
          personId: victim.personId,
          purpose: 'FAMILY_MANAGEMENT',
        },
        (tx) =>
          requireFamilyAction(tx, {
            accountId: victim.accountId,
            personId: victim.personId,
            familyId: victim.familyId,
            action: 'CASE_READ',
            purpose: 'FAMILY_MANAGEMENT',
            resource: {
              type: 'CASE',
              familyId: victim.familyId,
              caseId: victim.caseId,
            },
            caseId: victim.caseId,
          })
      );
    } catch (err) {
      sqlstate = (err as { code?: string }).code;
      expect(isKnownAuthorizationDenial(err)).toBe(false);
    }

    expect(sqlstate).toBe('57014');
    expect(isKnownAuthorizationDenial(denyToError('NOT_FAMILY_MANAGER'))).toBe(true);
    expect(isKnownAuthorizationDenial(denyToError('NO_ACTOR'))).toBe(false);
  });

  it('maps authorization-fact 57014 to 500, rolls back, then the same request succeeds after fault removal', async () => {
    await setFaultEnabled(true);
    const victim = await setup('fault');
    const key = `ult002-fault-${Date.now()}`;
    const content = 'ult002 exact same request';
    const before = await counts(victim.familyId, key);
    logs = '';

    const failed = await postMessage(
      faultApp,
      victim.token,
      victim.caseId,
      key,
      content
    );

    expect(failed.statusCode).toBe(500);
    expect(failed.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    });
    expect(failed.statusCode).not.toBe(403);
    expect(failed.statusCode).not.toBe(404);

    const afterFailure = await counts(victim.familyId, key);
    expect(afterFailure.messages).toBe(before.messages);
    expect(afterFailure.audits).toBe(before.audits);
    expect(afterFailure.idempotency).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(logs).toContain('57014');
    expect(logs).not.toMatch(/pg_sleep|LOCK TABLE|SELECT .*FROM/i);
    expect(logs).not.toContain('slice3app');

    // Remove only the PostgreSQL fault. Retry the exact same valid request:
    // same actor, case, idempotency key and content.
    await setFaultEnabled(false);
    const recovered = await postMessage(
      faultApp,
      victim.token,
      victim.caseId,
      key,
      content
    );

    expect(recovered.statusCode).toBe(201);
    expect(recovered.json().caseId).toBe(victim.caseId);

    const afterRecovery = await counts(victim.familyId, key);
    expect(afterRecovery.messages).toBe(before.messages + 1);
    expect(afterRecovery.audits).toBeGreaterThan(before.audits);
    expect(afterRecovery.idempotency).toBe(1);
  });
});

async function cleanup() {
  try {
    await admin.query(
      `DELETE FROM dialogue_messages
        WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'ULT002-%')`
    );
    await admin.query(
      `DELETE FROM business_audit_events
        WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'ULT002-%')`
    );
    await admin.query(`DELETE FROM cases WHERE family_id IN (
        SELECT id FROM families WHERE display_name LIKE 'ULT002-%')`);
    await admin.query(`DELETE FROM family_members WHERE family_id IN (
        SELECT id FROM families WHERE display_name LIKE 'ULT002-%')`);
    await admin.query(`DELETE FROM families WHERE display_name LIKE 'ULT002-%'`);
    await admin.query(
      `DELETE FROM idempotency_keys WHERE idempotency_key LIKE 'ult002-%'`
    );
    await admin.query(
      `DELETE FROM persons WHERE created_by_account_id IN (
         SELECT id FROM accounts WHERE wechat_openid LIKE 'ult002\\_%')`
    );
    await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE 'ult002\\_%'`);
  } catch {
    // best-effort cleanup
  }
}