/**
 * Round 2 Finding 4 — physical representation of the CASE_CREATE idempotency
 * key (migration 003, Owner-approved technical amendment).
 *
 * Proves the representation invariant, the bytea unique scope and the frozen
 * Slice 1 semantics for every other command type.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;
const PREFIX = 'r2idem_';

describe('idempotency key representation (003)', () => {
  let admin: Client;
  let accountId: string;

  beforeAll(async () => {
    admin = new Client({ connectionString: MIGRATION_URL });
    await admin.connect();
    accountId = (await admin.query(
      `INSERT INTO accounts (wechat_openid) VALUES ($1 || uuidv7()) RETURNING id`,
      [PREFIX]
    )).rows[0].id;
    // idempotency_keys is RLS-scoped to actor_account_id = app_account_id().
    // A session-level context lets each standalone INSERT/CHECK assertion run.
    await admin.query(`SELECT set_config('app.account_id', $1, false)`, [accountId]);
    // idempotency_keys is RLS-scoped to actor_account_id = app_account_id().
    // A session-level context lets each standalone INSERT/CHECK assertion run.
    await admin.query(`SELECT set_config('app.account_id', $1, false)`, [accountId]);
  });

  afterAll(async () => {
    await admin.query('DELETE FROM idempotency_keys WHERE actor_account_id = $1', [accountId]);
    await admin.query('DELETE FROM accounts WHERE id = $1', [accountId]);
    await admin.end();
  });

  function insert(row: {
    commandType: string;
    text?: string | null;
    bytes?: Buffer | null;
  }) {
    return admin.query(
      `INSERT INTO idempotency_keys
         (actor_account_id, command_type, idempotency_key, idempotency_key_bytes,
          request_hash, response_status, response_body)
       VALUES ($1, $2, $3, $4, repeat('a', 64), 201, '{}'::jsonb)`,
      [accountId, row.commandType, row.text ?? null, row.bytes ?? null]
    );
  }

  it('adds a nullable bytea column and keeps the text column', async () => {
    const { rows } = await admin.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'idempotency_keys'
        AND column_name IN ('idempotency_key', 'idempotency_key_bytes')
      ORDER BY column_name
    `);
    expect(rows).toEqual([
      { column_name: 'idempotency_key', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'idempotency_key_bytes', data_type: 'bytea', is_nullable: 'YES' },
    ]);
  });

  it('declares the representation CHECK and the bytea unique scope', async () => {
    const constraint = await admin.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'idempotency_keys'::regclass
        AND conname = 'idempotency_keys_key_representation_check'
    `);
    expect(constraint.rows.length).toBe(1);

    const index = await admin.query(`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'idempotency_keys'
        AND indexname = 'idempotency_scope_key_bytes'
    `);
    expect(index.rows.length).toBe(1);
    expect(index.rows[0].indexdef).toMatch(
      /UNIQUE INDEX .*\(actor_account_id, command_type, idempotency_key_bytes\)/
    );
  });

  it('keeps Slice 1 command semantics: text required, bytes NULL', async () => {
    await insert({ commandType: 'FAMILY_CREATE', text: `${PREFIX}family-1` });
    const { rows } = await admin.query(
      `SELECT idempotency_key, idempotency_key_bytes FROM idempotency_keys
       WHERE actor_account_id = $1 AND command_type = 'FAMILY_CREATE'`,
      [accountId]
    );
    expect(rows[0].idempotency_key).toBe(`${PREFIX}family-1`);
    expect(rows[0].idempotency_key_bytes).toBeNull();

    // text missing / bytes present are both rejected for non-CASE_CREATE.
    await expect(insert({ commandType: 'FAMILY_CREATE', text: null })).rejects.toThrow(
      /check|not-null/i
    );
    await expect(
      insert({ commandType: 'FAMILY_CREATE', text: `${PREFIX}family-2`, bytes: Buffer.from('x') })
    ).rejects.toThrow(/check/i);
  });

  it('accepts legacy and exact CASE_CREATE representations, rejects the others', async () => {
    await insert({ commandType: 'CASE_CREATE', text: `${PREFIX}legacy-1` });
    await insert({
      commandType: 'CASE_CREATE',
      bytes: Buffer.from(`${PREFIX}new-1`, 'utf16le'),
    });

    await expect(insert({ commandType: 'CASE_CREATE', text: null, bytes: null })).rejects.toThrow(
      /check/i
    );
    await expect(
      insert({
        commandType: 'CASE_CREATE',
        text: `${PREFIX}both`,
        bytes: Buffer.from('both', 'utf16le'),
      })
    ).rejects.toThrow(/check/i);
  });

  it('enforces exact byte uniqueness inside one scope', async () => {
    const bytes = Buffer.from(`${PREFIX}unique-bytes`, 'utf16le');
    await insert({ commandType: 'CASE_CREATE', bytes });

    await expect(insert({ commandType: 'CASE_CREATE', bytes })).rejects.toMatchObject({
      code: '23505',
    });

    // Different bytes never collide, even when they are visually similar.
    await insert({ commandType: 'CASE_CREATE', bytes: Buffer.from(`${PREFIX}unique-bytez`, 'utf16le') });
  });

  it('distinguishes NUL / unicode / lone surrogate keys at byte level', async () => {
    const keys = ['\u0000nul-key-0001', 'ключ-测试-0001', '\uD800lone-0001', 'u:legacy-key-1', 'h:legacy-key-1'];
    for (const key of keys) {
      await insert({ commandType: 'CASE_CREATE', bytes: Buffer.from(key, 'utf16le') });
    }
    const { rows } = await admin.query(
      `SELECT count(DISTINCT idempotency_key_bytes)::int AS c, count(*)::int AS total
       FROM idempotency_keys
       WHERE actor_account_id = $1 AND command_type = 'CASE_CREATE'
         AND idempotency_key_bytes = ANY($2::bytea[])`,
      [accountId, keys.map((k) => Buffer.from(k, 'utf16le'))]
    );
    expect(rows[0].c).toBe(keys.length);
    expect(rows[0].total).toBe(keys.length);
  });

  it('has no second idempotency table', async () => {
    const { rows } = await admin.query(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename LIKE '%idempotency%'`
    );
    expect(rows.map((r: any) => r.tablename)).toEqual(['idempotency_keys']);
  });
});
