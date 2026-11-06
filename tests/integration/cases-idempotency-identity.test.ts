/**
 * Round 2 Finding 4 — exact logical identity, legacy raw compatibility and
 * concurrency for CASE_CREATE idempotency.
 *
 * New reservations store UTF-16LE bytes, so distinct logical keys can never
 * collapse into one scope. Rows written before 003 (raw text) keep replaying
 * under their own raw identity; `u:` / `h:` have no reserved meaning.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import { hashPayload } from '../../packages/domain/src/idempotency.js';

let verifyPool: pg.Pool;

const LEGACY_CASE_ID = '11111111-1111-7111-8111-111111111111';

describe('CASE_CREATE exact identity (round 2)', () => {
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
    await owner.end();
    await verifyPool.end();
    await app.close();
  });

  let seq = 0;
  async function setup(label: string) {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `r2id_${label}_${Date.now()}_${seq++}` },
    });
    const { token, person, account } = login.json();
    const family = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: `R2-${label}`,
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        idempotencyKey: `r2id-fam-${label}-${Date.now()}-${seq++}`,
      },
    });
    return {
      token: token as string,
      accountId: account.id as string,
      familyId: family.json().id as string,
    };
  }

  function post(token: string, key: string) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}` },
      payload: { idempotencyKey: key },
    });
  }

  async function countRows(accountId: string) {
    const { rows } = await verifyPool.query(
      `SELECT count(*)::int AS rows,
              count(DISTINCT idempotency_key_bytes)::int AS distinct_bytes,
              count(*) FILTER (WHERE idempotency_key_bytes IS NULL)::int AS legacy_rows
       FROM idempotency_keys
       WHERE actor_account_id = $1 AND command_type = 'CASE_CREATE'`,
      [accountId]
    );
    return rows[0];
  }

  it('keeps every legal logical key in a distinct scope', async () => {
    const { token, accountId } = await setup('identity');
    const keys = [
      'normal-key-0001',
      'u:colon-prefixed-key',
      'h:colon-prefixed-key',
      '\u0000nul-prefixed-key',
      'ключ-тест-🔑-0001',
      '\uD800lone-surrogate-key',
      'x'.repeat(128),
    ];

    const ids = new Set<string>();
    for (const key of keys) {
      const res = await post(token, key);
      expect(res.statusCode, `key #${keys.indexOf(key)}`).toBe(201);
      ids.add(res.json().id as string);
    }

    expect(ids.size).toBe(keys.length);
    const rows = await countRows(accountId);
    expect(rows.rows).toBe(keys.length);
    expect(rows.distinct_bytes).toBe(keys.length);
    expect(rows.legacy_rows).toBe(0);

    // Every key replays its own result.
    for (const key of keys) {
      const replay = await post(token, key);
      expect(replay.statusCode).toBe(201);
    }
    expect((await countRows(accountId)).rows).toBe(keys.length);
  });

  it('replays a legacy raw-text row under its own raw identity', async () => {
    const { token, accountId, familyId } = await setup('legacy');
    await owner.query(`SELECT set_config('app.account_id', $1, false)`, [accountId]);
    const legacyKey = 'u:legacy-key';
    const body = {
      id: LEGACY_CASE_ID,
      status: 'OPEN',
      phase: 'INTAKE',
      primary: true,
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    await owner.query(
      `INSERT INTO idempotency_keys
         (actor_account_id, command_type, idempotency_key, idempotency_key_bytes,
          request_hash, response_status, response_body)
       VALUES ($1, 'CASE_CREATE', $2, NULL, $3, 201, $4::jsonb)`,
      [accountId, legacyKey, hashPayload({ familyId, body: {} }), JSON.stringify(body)]
    );

    const replay = await post(token, legacyKey);
    expect(replay.statusCode).toBe(201);
    expect(replay.json().id).toBe(LEGACY_CASE_ID);

    // A different logical key must NOT reuse the legacy row, even though its
    // old-style encoding could have looked like text.
    const other = await post(token, 'legacy-key');
    expect(other.statusCode).toBe(201);
    expect(other.json().id).not.toBe(LEGACY_CASE_ID);

    const rows = await countRows(accountId);
    expect(rows.rows).toBe(2);
    expect(rows.legacy_rows).toBe(1);
  });

  it('treats h:-prefixed logical keys as raw identity too', async () => {
    const { token, accountId, familyId } = await setup('legacy-h');
    await owner.query(`SELECT set_config('app.account_id', $1, false)`, [accountId]);
    const legacyKey = 'h:legacy-key';
    const body = {
      id: '22222222-2222-7222-8222-222222222222',
      status: 'OPEN',
      phase: 'INTAKE',
      primary: true,
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    await owner.query(
      `INSERT INTO idempotency_keys
         (actor_account_id, command_type, idempotency_key, idempotency_key_bytes,
          request_hash, response_status, response_body)
       VALUES ($1, 'CASE_CREATE', $2, NULL, $3, 201, $4::jsonb)`,
      [accountId, legacyKey, hashPayload({ familyId, body: {} }), JSON.stringify(body)]
    );

    const replay = await post(token, legacyKey);
    expect(replay.json().id).toBe('22222222-2222-7222-8222-222222222222');
    expect((await countRows(accountId)).rows).toBe(1);
  });

  it('a committed placeholder returns the generic 500 body', async () => {
    const { token, accountId, familyId } = await setup('placeholder');
    await owner.query(`SELECT set_config('app.account_id', $1, false)`, [accountId]);
    const key = 'placeholder-key-0001';
    await owner.query(
      `INSERT INTO idempotency_keys
         (actor_account_id, command_type, idempotency_key, idempotency_key_bytes,
          request_hash, response_status, response_body)
       VALUES ($1, 'CASE_CREATE', NULL, $2, $3, 0, '{}'::jsonb)`,
      [accountId, Buffer.from(key, 'utf16le'), hashPayload({ familyId, body: {} })]
    );

    const res = await post(token, key);
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    });
    expect(res.body).not.toContain('Incomplete idempotency record');
  });

  
  it('serializes concurrent identical byte keys into one business result', async () => {
    const { token, accountId } = await setup('concurrent');
    const key = '\u0000round2-concurrent-key';

    const responses = await Promise.all(Array.from({ length: 8 }, () => post(token, key)));
    expect(responses.every((r) => r.statusCode === 201)).toBe(true);
    expect(new Set(responses.map((r) => r.json().id)).size).toBe(1);
    expect((await countRows(accountId)).rows).toBe(1);

    const business = await verifyPool.query(
      `SELECT c.id FROM cases c WHERE c.id = $1`,
      [responses[0]!.json().id]
    );
    expect(business.rows.length).toBe(1);
  });

  it('does not merge distinct byte keys under concurrency', async () => {
    const { token, accountId } = await setup('concurrent-distinct');
    const keys = ['\u0000a-concurrent-1', '\u0000a-concurrent-2', '\u0000a-concurrent-3'];

    const responses = await Promise.all(keys.map((k) => post(token, k)));
    expect(responses.map((r) => r.statusCode)).toEqual([201, 201, 201]);
    expect(new Set(responses.map((r) => r.json().id)).size).toBe(3);
    expect((await countRows(accountId)).rows).toBe(3);
  });
});
