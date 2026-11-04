/**
 * RLS tests: verify RLS policies, context functions, and default deny.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;

describe('RLS', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: MIGRATION_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('9 tables have ENABLE + FORCE RLS, accounts does not', async () => {
    const { rows } = await client.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace
        AND relname != 'schema_migrations'
      ORDER BY relname
    `);

    const rlsTables = rows.filter((r: any) => r.relrowsecurity);
    const noRlsTables = rows.filter((r: any) => !r.relrowsecurity);

    expect(rlsTables.length).toBe(9);
    expect(noRlsTables.map((r: any) => r.relname)).toContain('accounts');

    for (const t of rlsTables) {
      expect(t.relforcerowsecurity, `${t.relname} FORCE`).toBe(true);
    }
  });

  it('9 policies exist', async () => {
    const { rows } = await client.query(
      `SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'`
    );
    expect(rows.length).toBe(9);
  });

  it('no context returns 0 rows', async () => {
    // App role with no GUC set
    const appClient = new Client({
      connectionString: process.env['DATABASE_URL'] ?? MIGRATION_URL,
    });
    await appClient.connect();
    try {
      const { rows } = await appClient.query('SELECT count(*) FROM persons');
      expect(parseInt(rows[0].count)).toBe(0);
    } finally {
      await appClient.end();
    }
  });

  it('set_family_context for non-member raises 42501', async () => {
    await client.query("BEGIN");
    try {
      await client.query(`SELECT app.set_family_context(uuidv7(), uuidv7(), 'TEST')`);
      expect.fail('should have raised');
    } catch (err: any) {
      expect(err.code).toBe('42501');
    } finally {
      await client.query("ROLLBACK");
    }
  });

  it('set_family_context with missing params raises 42501', async () => {
    await client.query("BEGIN");
    try {
      await client.query(`SELECT app.set_family_context(NULL, uuidv7(), 'TEST')`);
      expect.fail('should have raised');
    } catch (err: any) {
      expect(err.code).toBe('42501');
    } finally {
      await client.query("ROLLBACK");
    }
  });
});
