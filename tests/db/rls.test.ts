/**
 * RLS tests: verify RLS policies, context functions, and default deny.
 * T063: RLS evidence — no GUC, identity context, family isolation, accounts no RLS, pool no leak.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Pool } from 'pg';

const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;
const APP_URL = process.env['DATABASE_URL']!;

describe('RLS', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: MIGRATION_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('21 tables have ENABLE + FORCE RLS, accounts does not', async () => {    const { rows } = await client.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace
        AND relname != 'schema_migrations'
      ORDER BY relname
    `);

    const rlsTables = rows.filter((r: any) => r.relrowsecurity);
    const noRlsTables = rows.filter((r: any) => !r.relrowsecurity);

    // Prior slices 19 + Slice 4 case_participants.
    expect(rlsTables.length).toBe(21);    expect(noRlsTables.map((r: any) => r.relname)).toContain('accounts');

    for (const t of rlsTables) {
      expect(t.relforcerowsecurity, `${t.relname} FORCE`).toBe(true);
    }
  });

  it('51 policies exist after Slice 4 + Slice 8 add their policies', async () => {
    const { rows } = await client.query(
      `SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'`
    );
    expect(rows.length).toBe(51);  });

  it('Slice 2: case policies are Family-scope only', async () => {
    const { rows } = await client.query(
      `SELECT tablename, policyname, qual, with_check
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename IN ('cases', 'case_events')
       ORDER BY tablename`
    );
    expect(rows.map((r: any) => r.policyname)).toEqual([
      'case_events_family_scope', 'cases_family_scope',
    ]);
    for (const r of rows as any[]) {
      const using = String(r.qual ?? '');
      const check = String(r.with_check ?? '');
      expect(using, `${r.policyname} USING`).toMatch(/family_id = app_family_id\(\)/);
      expect(check, `${r.policyname} WITH CHECK`).toMatch(/family_id = app_family_id\(\)/);
    }
  });

  it('no context returns 0 rows', async () => {
    const appClient = new Client({ connectionString: APP_URL });
    await appClient.connect();
    try {
      const { rows } = await appClient.query('SELECT count(*) FROM persons');
      expect(parseInt(rows[0].count)).toBe(0);
    } finally {
      await appClient.end();
    }
  });

  it('no context → write denied', async () => {
    const appClient = new Client({ connectionString: APP_URL });
    await appClient.connect();
    try {
      await appClient.query(
        `INSERT INTO persons (id, account_id, created_by_account_id) VALUES (uuidv7(), NULL, uuidv7())`
      );
      expect.fail('should have been denied');
    } catch (err: any) {
      // RLS policy blocks insert without context
      expect(err.code).toBe('42501');
    } finally {
      await appClient.end();
    }
  });

  it('identity context → only see self', async () => {
    const ts = Date.now();
    const setupClient = new Client({ connectionString: MIGRATION_URL });
    await setupClient.connect();
    try {
      await setupClient.query('BEGIN');
      const { rows: a1 } = await setupClient.query(
        `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`, [`rls_t063_a1_${ts}`]
      );
      const accountId1 = a1[0].id;
      const { rows: a2 } = await setupClient.query(
        `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`, [`rls_t063_a2_${ts}`]
      );
      const accountId2 = a2[0].id;

      // Set context for person A insert
      await setupClient.query(`SELECT set_config('app.account_id', $1, true)`, [accountId1]);
      const { rows: p1 } = await setupClient.query(
        `INSERT INTO persons (id, account_id, created_by_account_id) VALUES (uuidv7(), $1, $1) RETURNING id`,
        [accountId1]
      );

      // Set context for person B insert
      await setupClient.query(`SELECT set_config('app.account_id', $1, true)`, [accountId2]);
      const { rows: p2 } = await setupClient.query(
        `INSERT INTO persons (id, account_id, created_by_account_id) VALUES (uuidv7(), $1, $1) RETURNING id`,
        [accountId2]
      );
      await setupClient.query('COMMIT');

      // As account1, can only see own person
      const appClient = new Client({ connectionString: APP_URL });
      await appClient.connect();
      try {
        await appClient.query('BEGIN');
        await appClient.query(`SELECT set_config('app.account_id', $1, true)`, [accountId1]);
        await appClient.query(`SELECT set_config('app.purpose', 'SELF_IDENTITY', true)`);
        const { rows: visible } = await appClient.query('SELECT id FROM persons');
        expect(visible.length).toBe(1);
        expect(visible[0].id).toBe(p1[0].id);
        await appClient.query('ROLLBACK');
      } finally {
        await appClient.end();
      }

      // No cleanup needed — unique IDs prevent conflicts
    } finally {
      await setupClient.end();
    }
  });

  it('Family A context → cannot see Family B', async () => {
    const ts = Date.now();
    const setupClient = new Client({ connectionString: MIGRATION_URL });
    await setupClient.connect();
    try {
      // Pre-generate UUIDs
      const { rows: u } = await setupClient.query('SELECT uuidv7() a, uuidv7() b, uuidv7() c, uuidv7() d, uuidv7() e, uuidv7() f');
      const [famAId, famBId, perAId, perBId, accAId, accBId] = [u[0].a, u[0].b, u[0].c, u[0].d, u[0].e, u[0].f];

      await setupClient.query('BEGIN');

      // Insert accounts (accounts has no RLS)
      await setupClient.query(`INSERT INTO accounts (id, wechat_openid) VALUES ($1, $2), ($3, $4)`, [accAId, `rls_fama_${ts}`, accBId, `rls_famb_${ts}`]);

      // Insert person A (set context to match)
      await setupClient.query(`SELECT set_config('app.account_id', $1, true)`, [accAId]);
      await setupClient.query(`SELECT set_config('app.person_id', $1, true)`, [perAId]);
      await setupClient.query(`INSERT INTO persons (id, account_id, created_by_account_id) VALUES ($1, $2, $2)`, [perAId, accAId]);

      // Insert person B (change context)
      await setupClient.query(`SELECT set_config('app.account_id', $1, true)`, [accBId]);
      await setupClient.query(`SELECT set_config('app.person_id', $1, true)`, [perBId]);
      await setupClient.query(`INSERT INTO persons (id, account_id, created_by_account_id) VALUES ($1, $2, $2)`, [perBId, accBId]);

      // Insert Family A
      await setupClient.query(`SELECT set_config('app.family_id', $1, true)`, [famAId]);
      await setupClient.query(`SELECT set_config('app.person_id', $1, true)`, [perAId]);
      await setupClient.query(`INSERT INTO families (id, display_name, created_by_person_id) VALUES ($1, $2, $3)`, [famAId, `RLS-FamA-${ts}`, perAId]);
      await setupClient.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`, [famAId, perAId]);

      // Insert Family B
      await setupClient.query(`SELECT set_config('app.family_id', $1, true)`, [famBId]);
      await setupClient.query(`SELECT set_config('app.person_id', $1, true)`, [perBId]);
      await setupClient.query(`INSERT INTO families (id, display_name, created_by_person_id) VALUES ($1, $2, $3)`, [famBId, `RLS-FamB-${ts}`, perBId]);
      await setupClient.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`, [famBId, perBId]);
      await setupClient.query('COMMIT');

      // As Family A, can only see Family A
      const appClient = new Client({ connectionString: APP_URL });
      await appClient.connect();
      try {
        await appClient.query('BEGIN');
        await appClient.query(`SELECT set_config('app.family_id', $1, true)`, [famAId]);
        await appClient.query(`SELECT set_config('app.person_id', $1, true)`, [perAId]);
        await appClient.query(`SELECT set_config('app.account_id', $1, true)`, [accAId]);
        await appClient.query(`SELECT set_config('app.purpose', 'FAMILY_MANAGEMENT', true)`);
        const { rows: families } = await appClient.query('SELECT id FROM families');
        expect(families.length).toBe(1);
        expect(families[0].id).toBe(famAId);
        await appClient.query('ROLLBACK');
      } finally {
        await appClient.end();
      }

      // No cleanup needed — unique IDs prevent conflicts
    } finally {
      await setupClient.end();
    }
  });

  it('connection pool context does not leak', async () => {
    const pool = new Pool({ connectionString: APP_URL, max: 1 });
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT set_config('app.account_id', 'test_leak_id', true)`);
        const { rows: r1 } = await client.query(`SELECT current_setting('app.account_id', true)`);
        expect(r1[0].current_setting).toBe('test_leak_id');
        await client.query('ROLLBACK');

        // After rollback, context should be reset
        const { rows: r2 } = await client.query(`SELECT current_setting('app.account_id', true)`);
        // PostgreSQL returns '' (empty string) or null for unset GUC
        expect(r2[0].current_setting === '' || r2[0].current_setting === null).toBe(true);
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
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
