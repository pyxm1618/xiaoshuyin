/**
 * Slice 4 H-01 — Create Invite authorization → idempotency ordering.
 *
 * Frozen contract
 * (`specs/004-case-participant-core/contracts/authorization-rls-and-idempotency.md`
 * §6.1):
 *   resolve current Family → enter Family RLS transaction → read current
 *   Family manager fact → authorize(PARTICIPATION_INVITE_CREATE) → ONLY THEN
 *   idempotency REPLAY / MISMATCH decision → business mutation.
 *
 * These tests prove the ordering with real PostgreSQL behaviour, not mocks:
 *   - a test-only `families` view counts every authorization-fact read, so an
 *     exact replay must show a real authorization read;
 *   - a real statement timeout (`57014`) is injected at the same fact read, so
 *     an existing exact replay / payload mismatch can never short-circuit it.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { Writable } from 'node:stream';
import { buildApp } from '../../apps/server/api/src/app.js';
import {
  addBoundAdultTargetToFamily,
  buildParticipationApp,
  createParticipationFixture,
  invite,
  lookupInvite,
} from '../setup/participation.js';

const FAULT_SCHEMA = 's4h01_authz_fault';
const STATEMENT_TIMEOUT_MS = 1500;

let h: Awaited<ReturnType<typeof buildParticipationApp>>;
let admin: pg.Pool;
let faultApp: Awaited<ReturnType<typeof buildApp>>;
let logs = '';

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
     AS $s4h01$
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
     $s4h01$`
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
  await admin.query(`GRANT SELECT, UPDATE ON ${FAULT_SCHEMA}.control TO xiaoshuyin_app`);
  await admin.query(`GRANT SELECT ON ${FAULT_SCHEMA}.families TO xiaoshuyin_app`);
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

async function authorizationFactReads(): Promise<number> {
  const { rows } = await admin.query(
    `SELECT calls FROM ${FAULT_SCHEMA}.control WHERE singleton = true`
  );
  return rows[0].calls as number;
}

interface RowCounts {
  participations: number;
  audits: number;
  idempotency: number;
}

async function counts(
  familyId: string,
  caseId: string,
  actorAccountId: string,
  key: string
): Promise<RowCounts> {
  const { rows } = await admin.query(
    `SELECT
       (SELECT count(*)::int FROM case_participants
         WHERE family_id = $1 AND case_id = $2) AS participations,
       (SELECT count(*)::int FROM business_audit_events
         WHERE family_id = $1
           AND event_type = 'PARTICIPATION_INVITE_CREATED') AS audits,
       (SELECT count(*)::int FROM idempotency_keys
         WHERE actor_account_id = $3
           AND command_type = 'PARTICIPATION_INVITE_CREATE'
           AND idempotency_key = $4) AS idempotency`,
    [familyId, caseId, actorAccountId, key]
  );
  return rows[0] as RowCounts;
}

describe('Slice 4 H-01 create-invite authorization → idempotency ordering', () => {
  beforeAll(async () => {
    h = await buildParticipationApp();
    admin = h.admin;
    await installAuthorizationFactFault();

    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs += chunk.toString();
        callback();
      },
    });
    faultApp = await buildApp({
      env: {
        ...process.env,
        DATABASE_URL: withAuthorizationFactFault(
          process.env['DATABASE_URL']!,
          STATEMENT_TIMEOUT_MS
        ),
      },
      loggerStream: stream,
    });
    await faultApp.ready();
  });

  afterAll(async () => {
    await faultApp.close();
    await admin.query(`DROP SCHEMA IF EXISTS ${FAULT_SCHEMA} CASCADE`);
    await h.close();
  });

  it('H-01 Case 1 — exact replay still executes the CURRENT Family authorization first', async () => {
    const f = await createParticipationFixture(h, 'h01-replay', { target: 'member' });
    const key = 'h01-replay-0001';

    const first = await invite(
      faultApp, f.manager.token, f.caseId, f.targetPersonId, key
    );
    expect(first.statusCode).toBe(201);

    // Reset the mechanical probe: it counts authorization-fact reads.
    await setFaultMode('off');
    const replay = await invite(
      faultApp, f.manager.token, f.caseId, f.targetPersonId, key
    );
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toEqual(first.json());

    // Authorization facts were read on the replay path, not bypassed by the
    // stored idempotency snapshot.
    expect(await authorizationFactReads()).toBeGreaterThan(0);

    // Change the CURRENT authorization condition only: the actor keeps
    // membership and the current Family resolution stays deterministic, but
    // the actor is no longer `families.created_by_person_id`.
    await admin.query(
      `UPDATE families SET created_by_person_id = $1 WHERE id = $2`,
      [f.targetPersonId, f.familyId]
    );

    await setFaultMode('off');
    const deniedReplay = await invite(
      faultApp, f.manager.token, f.caseId, f.targetPersonId, key
    );
    expect(deniedReplay.statusCode).toBe(404);
    expect(deniedReplay.json()).toEqual({
      code: 'CASE_NOT_FOUND',
      message: 'Case not found',
    });
    expect(deniedReplay.statusCode).not.toBe(201);

    // Same-key replay after the authorization condition changed MUST reach
    // the authorization fact read first. With a real statement timeout on
    // that read it must be a generic 500 — a replay-first implementation
    // would answer 201 without ever touching `families`.
    await setFaultMode('timeout');
    const timedOutReplay = await invite(
      faultApp, f.manager.token, f.caseId, f.targetPersonId, key
    );
    expect(timedOutReplay.statusCode).toBe(500);
    expect(timedOutReplay.json().code).toBe('INTERNAL_ERROR');
    expect(timedOutReplay.statusCode).not.toBe(201);
    await setFaultMode('off');

    // No new participation / audit / idempotency row was produced by a
    // denied or faulted replay.
    expect(await counts(f.familyId, f.caseId, f.manager.accountId, key)).toEqual({
      participations: 1,
      audits: 1,
      idempotency: 1,
    });
  });

  it('H-01 Case 2 — unexpected authorization-fact 57014 cannot be bypassed by an exact replay', async () => {
    const f = await createParticipationFixture(h, 'h01-fault', { target: 'member' });
    const second = await addBoundAdultTargetToFamily(h, f.familyId, 'h01-fault-second');
    const key = 'h01-fault-0001';

    const first = await invite(
      faultApp, f.manager.token, f.caseId, f.targetPersonId, key
    );
    expect(first.statusCode).toBe(201);
    const before = await counts(f.familyId, f.caseId, f.manager.accountId, key);
    expect(before).toEqual({ participations: 1, audits: 1, idempotency: 1 });

    await setFaultMode('timeout');
    logs = '';
    const failedReplay = await invite(
      faultApp, f.manager.token, f.caseId, f.targetPersonId, key
    );
    expect(failedReplay.statusCode).toBe(500);
    expect(failedReplay.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    });
    expect(failedReplay.statusCode).not.toBe(201);

    // A same-key / different-payload request must also pass the authorization
    // boundary first: it must be a generic 500, never a 409 mismatch replay
    // fast-path result.
    const failedMismatch = await invite(
      faultApp, f.manager.token, f.caseId, second.personId, key
    );
    expect(failedMismatch.statusCode).toBe(500);
    expect(failedMismatch.json().code).toBe('INTERNAL_ERROR');
    expect(failedMismatch.statusCode).not.toBe(409);

    // The infrastructure failure rolled back: no business or idempotency row.
    expect(await counts(f.familyId, f.caseId, f.manager.accountId, key)).toEqual(before);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(logs).toContain('57014');

    // Fault removal: the exact replay is still a faithful replay.
    await setFaultMode('off');
    const recovered = await invite(
      faultApp, f.manager.token, f.caseId, f.targetPersonId, key
    );
    expect(recovered.statusCode).toBe(201);
    expect(recovered.json()).toEqual(first.json());
    expect(await counts(f.familyId, f.caseId, f.manager.accountId, key)).toEqual(before);
  });

  it('H-01 Case 3 — authorization PASS keeps exact replay / mismatch semantics intact', async () => {
    const f = await createParticipationFixture(h, 'h01-pass', { target: 'member' });
    const second = await addBoundAdultTargetToFamily(h, f.familyId, 'h01-pass-second');
    const key = 'h01-pass-0001';

    const first = await invite(
      faultApp, f.manager.token, f.caseId, f.targetPersonId, key
    );
    expect(first.statusCode).toBe(201);
    expect(await authorizationFactReads()).toBeGreaterThan(0);

    const replay = await invite(
      faultApp, f.manager.token, f.caseId, f.targetPersonId, key
    );
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toEqual(first.json());
    expect(replay.json().participationId).toBe(first.json().participationId);
    expect(replay.json().inviteToken).toBe(first.json().inviteToken);

    // Same token rehydration: the replayed bearer capability still resolves
    // to the same participation.
    const lookup = await lookupInvite(faultApp, replay.json().inviteToken);
    expect(lookup.statusCode).toBe(200);
    expect(lookup.json().participationId).toBe(first.json().participationId);

    const mismatch = await invite(
      faultApp, f.manager.token, f.caseId, second.personId, key
    );
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    expect(await counts(f.familyId, f.caseId, f.manager.accountId, key)).toEqual({
      participations: 1,
      audits: 1,
      idempotency: 1,
    });

    // No duplicate participation for the second target either.
    const { rows } = await admin.query(
      `SELECT count(*)::int AS n FROM case_participants
        WHERE case_id = $1 AND person_id = $2`,
      [f.caseId, second.personId]
    );
    expect(rows[0].n).toBe(0);
  });
});