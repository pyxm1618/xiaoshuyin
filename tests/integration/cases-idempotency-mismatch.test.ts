/**
 * Finding 5 — the shared idempotency decision must drive the real command.
 *
 * The HTTP contract has no second legal business payload, so the mismatch
 * branch is proven at repository/service level against the row written by a
 * real POST /api/v1/cases: same actor + same CASE_CREATE + same key with a
 * different request_hash must yield MISMATCH → 409, leaving every stored
 * artefact untouched.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import { toHttpError } from '../../apps/server/api/src/plugins/error-handler.js';
import {
  decideIdempotency,
  caseIdempotencyKeyBytes,
  hashPayload,
  reserveIdempotency,
  getReservedIdempotency,
} from '../../packages/domain/src/index.js';
import { createAdminPool } from '../setup/db.js';

let verifyPool: pg.Pool;

describe('CASE_CREATE shared mismatch (finding 5)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let pool: pg.Pool;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
    pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'], max: 2 });
  });

  afterAll(async () => {
    await pool.end();
    await verifyPool.end();
    await app.close();
  });

  it('decides MISMATCH from the stored row and maps it to 409', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `cv1_mismatch_${Date.now()}` },
    });
    const { token, person, account } = login.json();
    const familyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: 'CV1-Mismatch',
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        idempotencyKey: `cv1-mismatch-fam-${Date.now()}`,
      },
    });
    const familyId = familyRes.json().id as string;

    const key = `cv1-mismatch-key-${Date.now()}`;
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}` },
      payload: { idempotencyKey: key },
    });
    expect(created.statusCode).toBe(201);
    const caseId = created.json().id as string;

    const before = await snapshot(familyId, account.id, key);
    const originalHash = hashPayload({ familyId, body: {} });

    // Same scope key, different canonical payload hash → shared MISMATCH.
    const differentHash = hashPayload({ familyId, body: { note: 'different' } });
    expect(differentHash).not.toBe(originalHash);

    const outcome = await withRlsTransaction(
      pool,
      { familyId, accountId: account.id, personId: person.id, purpose: 'FAMILY_MANAGEMENT' },
      async (tx) => {
        const reserved = await reserveIdempotency(tx, {
          actorAccountId: account.id,
          commandType: 'CASE_CREATE',
          keyBytes: caseIdempotencyKeyBytes(key),
          requestHash: differentHash,
        });
        expect(reserved).toBe(false);

        const existing = await getReservedIdempotency(tx, {
          actorAccountId: account.id,
          commandType: 'CASE_CREATE',
          keyBytes: caseIdempotencyKeyBytes(key),
          legacyKeyText: key,
        });
        expect(existing).not.toBeNull();

        return decideIdempotency(
          {
            requestHash: existing!.request_hash,
            responseStatus: existing!.response_status,
            responseBody: existing!.response_body,
          },
          differentHash
        );
      }
    );

    expect(outcome).toEqual({ action: 'MISMATCH' });

    const http = toHttpError('IDEMPOTENCY_PAYLOAD_MISMATCH');
    expect(http.statusCode).toBe(409);
    expect(http.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    // Nothing was rewritten or duplicated.
    const after = await snapshot(familyId, account.id, key);
    expect(after).toEqual(before);
    expect(after.status).toBe(201);
    expect(after.body.id).toBe(caseId);
    expect(after.cases).toBe(1);
    expect(after.events).toBe(1);
    expect(after.audits).toBe(1);
    expect(after.keys).toBe(1);
  });

  it('still REPLAYs the same hash through the shared decision', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `cv1_replay_${Date.now()}` },
    });
    const { token, person, account } = login.json();
    const familyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: 'CV1-Replay',
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        idempotencyKey: `cv1-replay-fam-${Date.now()}`,
      },
    });
    const familyId = familyRes.json().id as string;
    const key = `cv1-replay-key-${Date.now()}`;
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}` },
      payload: { idempotencyKey: key },
    });
    expect(created.statusCode).toBe(201);

    const hash = hashPayload({ familyId, body: {} });
    const decision = await withRlsTransaction(
      pool,
      { familyId, accountId: account.id, personId: person.id, purpose: 'FAMILY_MANAGEMENT' },
      async (tx) => {
        const existing = await getReservedIdempotency(tx, {
          actorAccountId: account.id,
          commandType: 'CASE_CREATE',
          keyBytes: caseIdempotencyKeyBytes(key),
          legacyKeyText: key,
        });
        return decideIdempotency(
          {
            requestHash: existing!.request_hash,
            responseStatus: existing!.response_status,
            responseBody: existing!.response_body,
          },
          hash
        );
      }
    );

    expect(decision.action).toBe('REPLAY');
    if (decision.action === 'REPLAY') {
      expect(decision.responseStatus).toBe(201);
      expect((decision.responseBody as any).id).toBe(created.json().id);
    }
  });

  async function snapshot(familyId: string, accountId: string, logicalKey: string) {
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
    const keyRow = await verifyPool.query(
      `SELECT response_status, response_body FROM idempotency_keys
       WHERE actor_account_id = $1 AND command_type = 'CASE_CREATE' AND idempotency_key_bytes = $2`,
      [accountId, caseIdempotencyKeyBytes(logicalKey)]
    );
    return {
      ...rows[0],
      status: keyRow.rows[0]?.response_status,
      body: keyRow.rows[0]?.response_body,
    };
  }
});
