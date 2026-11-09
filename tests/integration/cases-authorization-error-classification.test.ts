/**
 * Slice 2 post-merge remediation — Case authorization error classification.
 *
 * Frozen rule (already implemented for `/cases/:id/messages` under ULT-002):
 * only an explicit, known authorization denial produced by `denyToError()` may
 * be collapsed into the route's frozen 403 / anti-enumeration 404 mapping.
 * Unknown infrastructure failures (PostgreSQL `57014` statement timeout,
 * connection loss, unexpected DB error) MUST propagate unchanged so the global
 * error handler answers generic `500 INTERNAL_ERROR` and the existing
 * redacted unexpected-error logging runs.
 *
 * The failure is injected with a real PostgreSQL statement timeout at the
 * authorization-fact stage (`readFacts` → `getFamilyById`) on an isolated app
 * pool. No `requireFamilyAction` mock, no stubbed route internals.
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
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import { createAdminPool } from '../setup/db.js';

const STATEMENT_TIMEOUT_MS = 1500;
const FAULT_SCHEMA = 's2rem_authz_fault';

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
     AS $s2rem$
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
     $s2rem$`
  );
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
  // `lockFamilyForPrimaryDecision` (POST /cases) takes `SELECT ... FOR
  // UPDATE` on this relation; the real app role already holds UPDATE on the
  // base `families` table, so the test view mirrors that grant.
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
    payload: { code: `s2rem_${label}_${Date.now()}_${seq++}` },
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
      'idempotency-key': `s2rem-fam-${label}-${Date.now()}-${seq++}`,
    },
    payload: {
      displayName: `S2REM-${label}`,
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
      'idempotency-key': `s2rem-case-${label}-${Date.now()}-${seq++}`,
    },
    payload: {},
  });
  expect(kase.statusCode).toBe(201);
  return { ...actor, familyId, caseId: kase.json().id as string };
}

function createCase(target: typeof app, token: string, key: string) {
  return target.inject({
    method: 'POST',
    url: '/api/v1/cases',
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
    payload: {},
  });
}

function listCases(target: typeof app, token: string) {
  return target.inject({
    method: 'GET',
    url: '/api/v1/cases',
    headers: { authorization: `Bearer ${token}` },
  });
}

function getCase(target: typeof app, token: string, id: string) {
  return target.inject({
    method: 'GET',
    url: `/api/v1/cases/${id}`,
    headers: { authorization: `Bearer ${token}` },
  });
}

// CASE_CREATE reservations store the exact key bytes in
// `idempotency_key_bytes` and leave the legacy text column NULL, so the
// rollback / commit proof is scoped by actor + command type.
async function counts(familyId: string, actorAccountId: string) {
  const { rows } = await admin.query(
    `SELECT
       (SELECT count(*)::int FROM cases WHERE family_id = $1) AS cases,
       (SELECT count(*)::int FROM business_audit_events WHERE family_id = $1) AS audits,
       (SELECT count(*)::int FROM idempotency_keys
         WHERE actor_account_id = $2 AND command_type = 'CASE_CREATE') AS idempotency`,
    [familyId, actorAccountId]
  );
  return rows[0] as { cases: number; audits: number; idempotency: number };
}

const GENERIC_500 = {
  code: 'INTERNAL_ERROR',
  message: 'An internal error occurred',
};

describe('Slice 2 authz error classification', () => {
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

  it('known authorization denials keep the frozen 403 / anti-enumeration 404', async () => {
    const owner = await setup('deny');
    const member = await login(app, 'deny-member');
    await admin.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [owner.familyId, member.personId]
    );

    const post = await createCase(app, member.token, `s2rem-deny-post-${Date.now()}`);
    expect(post.statusCode).toBe(403);
    expect(post.json()).toEqual({
      code: 'CASE_ACCESS_DENIED',
      message: 'Case access denied',
    });

    const list = await listCases(app, member.token);
    expect(list.statusCode).toBe(403);
    expect(list.json()).toEqual({
      code: 'CASE_ACCESS_DENIED',
      message: 'Case access denied',
    });

    const detail = await getCase(app, member.token, owner.caseId);
    expect(detail.statusCode).toBe(404);
    expect(detail.json()).toEqual({
      code: 'CASE_NOT_FOUND',
      message: 'Case not found',
    });
    expect(JSON.stringify(detail.json())).not.toContain(owner.caseId);

    // The explicit business denial marker is precisely what routes may map.
    expect(isKnownAuthorizationDenial(denyToError('NOT_FAMILY_MANAGER'))).toBe(true);
    expect(isKnownAuthorizationDenial(denyToError('NO_ACTOR'))).toBe(false);
  });

  it('a real 57014 at requireFamilyAction -> readFacts is NOT a known denial', async () => {
    await setFaultMode('timeout');
    const victim = await setup('probe');

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
            action: 'CASE_CREATE',
            purpose: 'FAMILY_MANAGEMENT',
            resource: { type: 'FAMILY', familyId: victim.familyId },
          })
      );
    } catch (err) {
      sqlstate = (err as { code?: string }).code;
      expect(isKnownAuthorizationDenial(err)).toBe(false);
    }

    expect(sqlstate).toBe('57014');
    await setFaultMode('off');
  });

  it('POST /api/v1/cases propagates authorization-fact 57014 to generic 500, not 403', async () => {
    await setFaultMode('timeout');
    const victim = await setup('create');
    const key = `s2rem-create-${Date.now()}`;
    const before = await counts(victim.familyId, victim.accountId);
    logs = '';

    const failed = await createCase(faultApp, victim.token, key);
    expect(failed.statusCode).toBe(500);
    expect(failed.statusCode).not.toBe(403);
    expect(failed.json()).toEqual(GENERIC_500);

    const afterFailure = await counts(victim.familyId, victim.accountId);
    expect(afterFailure.cases).toBe(before.cases);
    expect(afterFailure.audits).toBe(before.audits);
    expect(afterFailure.idempotency).toBe(before.idempotency);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(logs).toContain('57014');
    expect(logs).not.toMatch(/pg_sleep|SELECT .*FROM/i);

    // Remove only the PostgreSQL fault; the exact same request must succeed.
    await setFaultMode('off');
    const recovered = await createCase(faultApp, victim.token, key);
    expect(recovered.statusCode).toBe(201);
    expect(recovered.json().primary).toBeTypeOf('boolean');

    const afterRecovery = await counts(victim.familyId, victim.accountId);
    expect(afterRecovery.cases).toBe(before.cases + 1);
    expect(afterRecovery.audits).toBeGreaterThan(before.audits);
    expect(afterRecovery.idempotency).toBe(before.idempotency + 1);
  });

  it('GET /api/v1/cases propagates authorization-fact 57014 to generic 500, not 403', async () => {
    await setFaultMode('timeout');
    const victim = await setup('list');
    logs = '';

    const failed = await listCases(faultApp, victim.token);
    expect(failed.statusCode).toBe(500);
    expect(failed.statusCode).not.toBe(403);
    expect(failed.json()).toEqual(GENERIC_500);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(logs).toContain('57014');
    expect(logs).not.toMatch(/pg_sleep|SELECT .*FROM/i);

    await setFaultMode('off');
    const recovered = await listCases(faultApp, victim.token);
    expect(recovered.statusCode).toBe(200);
    expect(recovered.json().items.map((c: any) => c.id)).toEqual([victim.caseId]);
  });

  it('GET /api/v1/cases/:id propagates authorization-fact 57014 to generic 500, not 404', async () => {
    await setFaultMode('timeout');
    const victim = await setup('detail');
    logs = '';

    const failed = await getCase(faultApp, victim.token, victim.caseId);
    expect(failed.statusCode).toBe(500);
    expect(failed.statusCode).not.toBe(404);
    expect(failed.json()).toEqual(GENERIC_500);
    expect(JSON.stringify(failed.json())).not.toContain(victim.caseId);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(logs).toContain('57014');
    expect(logs).not.toMatch(/pg_sleep|SELECT .*FROM/i);

    await setFaultMode('off');
    const recovered = await getCase(faultApp, victim.token, victim.caseId);
    expect(recovered.statusCode).toBe(200);
    expect(recovered.json().id).toBe(victim.caseId);
  });
});

async function cleanup() {
  const S2REM_FAMILIES = `SELECT id FROM families WHERE display_name LIKE 'S2REM-%'`;
  const S2REM_ACCOUNTS = `SELECT id FROM accounts WHERE wechat_openid LIKE 'fake\\_s2rem\\_%'`;

  // FK-safe order (case_events and idempotency_keys are ON DELETE RESTRICT).
  // Each statement is independent so one failure cannot block the rest of the
  // cleanup; residuals would otherwise perturb later suites on a shared DB.
  const statements = [
    `DELETE FROM dialogue_messages WHERE family_id IN (${S2REM_FAMILIES})`,
    `DELETE FROM business_audit_events WHERE family_id IN (${S2REM_FAMILIES})`,
    `DELETE FROM case_events WHERE family_id IN (${S2REM_FAMILIES})`,
    `DELETE FROM cases WHERE family_id IN (${S2REM_FAMILIES})`,
    `DELETE FROM family_members WHERE family_id IN (${S2REM_FAMILIES})`,
    `DELETE FROM families WHERE display_name LIKE 'S2REM-%'`,
    `DELETE FROM idempotency_keys WHERE actor_account_id IN (${S2REM_ACCOUNTS})`,
    `DELETE FROM persons WHERE created_by_account_id IN (${S2REM_ACCOUNTS})`,
    `DELETE FROM accounts WHERE wechat_openid LIKE 'fake\\_s2rem\\_%'`,
  ];
  for (const statement of statements) {
    try {
      await admin.query(statement);
    } catch {
      // best-effort cleanup
    }
  }
}