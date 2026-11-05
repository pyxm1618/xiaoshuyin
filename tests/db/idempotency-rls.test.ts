/**
 * T064: idempotency_keys RLS tests.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;
const APP_URL = process.env['DATABASE_URL']!;

describe('Idempotency Keys RLS (T064)', () => {
  let setupClient: Client;

  beforeAll(async () => {
    setupClient = new Client({ connectionString: MIGRATION_URL });
    await setupClient.connect();
  });

  afterAll(async () => {
    await setupClient.end();
  });

  it('idempotency_keys has ENABLE + FORCE RLS', async () => {
    const { rows } = await setupClient.query(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'idempotency_keys'`
    );
    expect(rows[0].relrowsecurity).toBe(true);
    expect(rows[0].relforcerowsecurity).toBe(true);
  });

  it('Account A can only see A keys, B replay returns 0 rows', async () => {
    const ts = Date.now();
    await setupClient.query('BEGIN');
    const { rows: a } = await setupClient.query(`INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`, [`idem_a_${ts}`]);
    const accA = a[0].id;
    const { rows: b } = await setupClient.query(`INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`, [`idem_b_${ts}`]);
    const accB = b[0].id;

    // Insert key for A
    await setupClient.query(`SELECT set_config('app.account_id', $1, true)`, [accA]);
    await setupClient.query(
      `INSERT INTO idempotency_keys (actor_account_id, command_type, idempotency_key, request_hash, response_status, response_body)
       VALUES ($1, 'FAMILY_CREATE', $2, $3, 201, '{"ok":true}')`,
      [accA, `key_a_${ts}`, 'a'.repeat(64)]
    );
    await setupClient.query('COMMIT');

    // As A, can see own key
    const clientA = new Client({ connectionString: APP_URL });
    await clientA.connect();
    try {
      await clientA.query('BEGIN');
      await clientA.query(`SELECT set_config('app.account_id', $1, true)`, [accA]);
      const { rows: rowsA } = await clientA.query('SELECT idempotency_key, response_body FROM idempotency_keys');
      expect(rowsA.length).toBe(1);
      expect(rowsA[0].idempotency_key).toBe(`key_a_${ts}`);
      await clientA.query('ROLLBACK');
    } finally {
      await clientA.end();
    }

    // As B, cannot see A's keys
    const clientB = new Client({ connectionString: APP_URL });
    await clientB.connect();
    try {
      await clientB.query('BEGIN');
      await clientB.query(`SELECT set_config('app.account_id', $1, true)`, [accB]);
      const { rows: rowsB } = await clientB.query('SELECT * FROM idempotency_keys');
      expect(rowsB.length).toBe(0);
      await clientB.query('ROLLBACK');
    } finally {
      await clientB.end();
    }
  });

  it('write without identity context is denied', async () => {
    const appClient = new Client({ connectionString: APP_URL });
    await appClient.connect();
    try {
      await appClient.query(
        `INSERT INTO idempotency_keys (actor_account_id, command_type, idempotency_key, request_hash, response_status, response_body)
         VALUES (uuidv7(), 'FAMILY_CREATE', 'test_noidem', 'h', 201, '{}')`
      );
      expect.fail('should have been denied');
    } catch (err: any) {
      expect(err.code).toBe('42501');
    } finally {
      await appClient.end();
    }
  });
});
