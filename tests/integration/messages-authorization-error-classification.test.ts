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
} from '../../apps/server/api/src/authz.js';
import { createAdminPool } from '../setup/db.js';

const STATEMENT_TIMEOUT_MS = 1500;

let admin: pg.Pool;
let app: Awaited<ReturnType<typeof buildApp>>;
let faultApp: Awaited<ReturnType<typeof buildApp>>;
let faultUrl: string;
let logs = '';
let seq = 0;

function withStatementTimeout(url: string, ms: number): string {
  const parsed = new URL(url);
  parsed.searchParams.set('options', `-c statement_timeout=${ms}`);
  return parsed.toString();
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

    faultUrl = withStatementTimeout(process.env['DATABASE_URL']!, STATEMENT_TIMEOUT_MS);
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

    admin = createAdminPool();
  });

  afterAll(async () => {
    await cleanup();
    await admin.end();
    await faultApp.close();
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

  it('classifies a real PostgreSQL 57014 as infrastructure, never as a denial', async () => {
    const probe = new pg.Client({ connectionString: faultUrl });
    await probe.connect();
    try {
      let sqlstate: string | undefined;
      try {
        await probe.query('SELECT pg_sleep(5)');
      } catch (err) {
        sqlstate = (err as { code?: string }).code;
        expect(isKnownAuthorizationDenial(err), 'pg 57014 must not be a denial').toBe(false);
      }
      expect(sqlstate).toBe('57014');
    } finally {
      await probe.end();
    }

    // A real business denial is marked, a 401 authentication failure is not.
    expect(isKnownAuthorizationDenial(denyToError('NOT_FAMILY_MANAGER'))).toBe(true);
    expect(isKnownAuthorizationDenial(denyToError('NO_ACTOR'))).toBe(false);
  });

  it('answers 500 INTERNAL_ERROR for an authorization DB timeout and rolls back', async () => {
    const victim = await setup('fault');
    const key = `ult002-fault-${Date.now()}`;
    const before = await counts(victim.familyId, key);
    logs = '';

    const lock = await admin.connect();
    try {
      await lock.query('BEGIN');
      // Blocks the message route's authorization preflight DB reads (current
      // Family resolution / Case authorization facts) with a real table lock.
      await lock.query('LOCK TABLE families IN ACCESS EXCLUSIVE MODE');

      const res = await postMessage(faultApp, victim.token, victim.caseId, key);

      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
      });
      expect(res.statusCode).not.toBe(403);
      expect(res.statusCode).not.toBe(404);
    } finally {
      await lock.query('ROLLBACK').catch(() => {});
      lock.release();
    }

    const after = await counts(victim.familyId, key);
    expect(after.messages).toBe(before.messages);
    expect(after.audits).toBe(before.audits);
    // No idempotency business result may be committed for the failed command.
    expect(after.idempotency).toBe(0);
  });

  it('logs the unexpected error without leaking SQL or credentials', async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(logs).toContain('57014');
    expect(logs).not.toMatch(/pg_sleep|LOCK TABLE|SELECT .*FROM/i);
    expect(logs).not.toContain('slice3app');
  });

  it('succeeds normally once the infrastructure failure is gone', async () => {
    const victim = await setup('recovered');
    const key = `ult002-recovered-${Date.now()}`;
    const res = await postMessage(faultApp, victim.token, victim.caseId, key, 'after recovery');

    expect(res.statusCode).toBe(201);
    expect(res.json().caseId).toBe(victim.caseId);

    const after = await counts(victim.familyId, key);
    expect(after.messages).toBe(1);
    expect(after.audits).toBeGreaterThanOrEqual(1);
    expect(after.idempotency).toBe(1);
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