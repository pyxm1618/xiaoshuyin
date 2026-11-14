import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const APP_URL = process.env.DATABASE_URL;
const EXPECTED_VERSION = process.env.PGVECTOR_EXPECTED_VERSION;

describe('Slice 19 real PostgreSQL 18 + pgvector readiness', () => {
  let client: Client;

  beforeAll(async () => {
    if (!APP_URL) throw new Error('DATABASE_URL is required; this suite must use a real database');
    if (!EXPECTED_VERSION) throw new Error('PGVECTOR_EXPECTED_VERSION is required');
    client = new Client({ connectionString: APP_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  it('uses PostgreSQL major 18 with the exact installed pgvector version', async () => {
    const server = await client.query(
      "SELECT current_setting('server_version') AS version, current_setting('server_version_num') AS version_num"
    );
    expect(Math.floor(Number(server.rows[0].version_num) / 10000)).toBe(18);

    const extension = await client.query(
      "SELECT extversion FROM pg_extension WHERE extname = 'vector'"
    );
    expect(extension.rowCount).toBe(1);
    expect(extension.rows[0].extversion).toBe(EXPECTED_VERSION);
  });

  it('preserves runtime role and extension ownership security boundaries', async () => {
    const role = await client.query(`
      SELECT current_user AS runtime_role,
             r.rolsuper,
             r.rolbypassrls,
             has_schema_privilege(current_user, 'public', 'CREATE') AS can_create,
             EXISTS (
               SELECT 1 FROM pg_class c
               JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public'
                 AND c.relkind IN ('r','p')
                 AND c.relowner = r.oid
                 AND c.relname <> 'schema_migrations'
             ) AS owns_business_table
        FROM pg_roles r
       WHERE r.rolname = current_user
    `);
    expect(role.rows[0]).toMatchObject({
      runtime_role: 'xiaoshuyin_app',
      rolsuper: false,
      rolbypassrls: false,
      can_create: false,
      owns_business_table: false,
    });

    const owner = await client.query(`
      SELECT r.rolname AS owner
        FROM pg_extension e
        JOIN pg_roles r ON r.oid = e.extowner
       WHERE e.extname = 'vector'
    `);
    expect(owner.rowCount).toBe(1);
    expect(owner.rows[0].owner).not.toBe('xiaoshuyin_app');
  });

  it('executes vector type, insert, readback and deterministic L2 ordering in TEMP scope', async () => {
    await client.query('BEGIN');
    try {
      await client.query(`
        CREATE TEMP TABLE pgvector_readiness_test (
          label text PRIMARY KEY,
          embedding vector(3) NOT NULL
        ) ON COMMIT DROP
      `);
      await client.query(`
        INSERT INTO pgvector_readiness_test (label, embedding)
        VALUES
          ('origin', '[0,0,0]'),
          ('near', '[1,0,0]'),
          ('far', '[3,0,0]')
      `);

      const read = await client.query(
        "SELECT label, embedding::text AS embedding FROM pgvector_readiness_test ORDER BY label"
      );
      expect(read.rows).toEqual([
        { label: 'far', embedding: '[3,0,0]' },
        { label: 'near', embedding: '[1,0,0]' },
        { label: 'origin', embedding: '[0,0,0]' },
      ]);

      const distance = await client.query(`
        SELECT label, embedding <-> '[0,0,0]'::vector AS distance
          FROM pgvector_readiness_test
         ORDER BY distance ASC, label ASC
      `);
      expect(distance.rows.map((row) => row.label)).toEqual(['origin', 'near', 'far']);
      expect(distance.rows.map((row) => Number(row.distance))).toEqual([0, 1, 3]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const cleanup = await client.query(
      "SELECT to_regclass('pg_temp.pgvector_readiness_test') AS relation"
    );
    expect(cleanup.rows[0].relation).toBeNull();
  });

  it('rejects invalid vector dimensions in the real database', async () => {
    await client.query('BEGIN');
    try {
      await client.query(
        "CREATE TEMP TABLE pgvector_invalid_dimension (embedding vector(3) NOT NULL) ON COMMIT DROP"
      );
      await expect(
        client.query("INSERT INTO pgvector_invalid_dimension VALUES ('[1,2]'::vector)")
      ).rejects.toMatchObject({ code: '22000' });
    } finally {
      await client.query('ROLLBACK');
    }
  });
});
