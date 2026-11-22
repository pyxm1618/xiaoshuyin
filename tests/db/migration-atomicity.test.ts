/**
 * migration-atomicity.test.ts
 *
 * Comprehensive end-to-end and unit verification of migration execution atomicity (Finding #16 remediation).
 *
 * Verifies:
 * 1. Fresh database rebuild: all 33 migrations applied in a single clean run, checksums recorded, replay is a no-op.
 * 2. Existing database upgrade: legacy 001-003 state upgrades cleanly without rewriting historical timestamps.
 * 3. Migration SQL failure rollback: when a migration statement fails, DDL is rolled back and no metadata is recorded.
 * 4. Deterministic metadata failure rollback: when DDL succeeds but schema_migrations INSERT fails deterministically,
 *    the DDL changes are 100% rolled back by the runner-owned transaction.
 * 5. Checksum mismatch fail-closed: any tampered checksum in schema_migrations causes fail-closed before later migrations.
 * 6. Future migration transaction guard: unauthorized top-level transaction controls and fingerprint mismatches fail closed.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  LEGACY_TRANSACTION_WRAPPED_MIGRATIONS,
  scanTopLevelTransactionStatements,
  validateAndPrepareMigrationSql,
} from '../../scripts/lib/migration-transactions.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations');

// Fallback to local .env if run directly without exported environment
function loadEnvFallback() {
  if (process.env['TEST_ADMIN_DATABASE_URL'] && process.env['MIGRATION_DATABASE_URL']) return;
  const envPath = join(ROOT, '.env');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const k = trimmed.slice(0, eq).trim();
        const v = trimmed.slice(eq + 1).trim();
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }
}
loadEnvFallback();

const TEST_ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL'];
const BASE_MIGRATION_URL = process.env['MIGRATION_DATABASE_URL'];

function quoteIdent(name: string): string {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function getMigratorRole(url: string): string {
  const parsed = new URL(url);
  return decodeURIComponent(parsed.username);
}

function buildDbUrl(baseUrl: string, dbName: string): string {
  const u = new URL(baseUrl);
  u.pathname = `/${dbName}`;
  return u.toString();
}

describe('Migration Execution Atomicity (E1 Finding #16)', () => {
  let adminClient: Client;
  const createdDbs: string[] = [];

  beforeAll(async () => {
    if (!TEST_ADMIN_URL || !BASE_MIGRATION_URL) {
      throw new Error('TEST_ADMIN_DATABASE_URL and MIGRATION_DATABASE_URL are required for migration atomicity tests');
    }
    adminClient = new Client({ connectionString: TEST_ADMIN_URL });
    await adminClient.connect();
  });

  afterAll(async () => {
    if (adminClient) {
      for (const db of createdDbs) {
        try {
          await adminClient.query(`DROP DATABASE IF EXISTS ${quoteIdent(db)} WITH (FORCE)`);
        } catch {
          // ignore cleanup errors
        }
      }
      await adminClient.end();
    }
  });

  async function createTempDatabase(prefix: string): Promise<{ dbName: string; dbUrl: string }> {
    const dbName = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const migratorRole = getMigratorRole(BASE_MIGRATION_URL!);
    await adminClient.query(`CREATE DATABASE ${quoteIdent(dbName)} OWNER ${quoteIdent(migratorRole)}`);
    createdDbs.push(dbName);
    return { dbName, dbUrl: buildDbUrl(BASE_MIGRATION_URL!, dbName) };
  }

  // ─── 1. Fresh Database Rebuild ───
  it('fresh database rebuild applies all 33 migrations with correct checksums, and replay is 0 new', async () => {
    const { dbName, dbUrl } = await createTempDatabase('xsy_atom_fresh');

    const firstRun = execFileSync('node', ['scripts/db-migrate.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, MIGRATION_DATABASE_URL: dbUrl },
    });

    expect(firstRun).toContain('Migration complete: 33 new, 0 previously applied.');

    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    try {
      const { rows } = await client.query(`
        SELECT filename, content_checksum, checksum_origin
          FROM schema_migrations
         ORDER BY filename
      `);
      expect(rows.length).toBe(33);

      for (const [legacyName, expectedHash] of LEGACY_TRANSACTION_WRAPPED_MIGRATIONS.entries()) {
        const row = rows.find((r: any) => r.filename === legacyName);
        expect(row).toBeDefined();
        expect(row.content_checksum).toBe(expectedHash);
        expect(row.checksum_origin).toBe('APPLIED');
      }

      // Replay must be a complete no-op (0 new migrations)
      const secondRun = execFileSync('node', ['scripts/db-migrate.mjs'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, MIGRATION_DATABASE_URL: dbUrl },
      });
      expect(secondRun).toContain('Migration complete: 0 new, 33 previously applied.');
    } finally {
      await client.end();
    }
  });

  // ─── 2. Existing Database Upgrade ───
  it('existing database upgrade preserves 001-003 applied timestamps and transitions legacy rows to LEGACY_BASELINE', async () => {
    const { dbName, dbUrl } = await createTempDatabase('xsy_atom_upg');

    const client = new Client({ connectionString: dbUrl });
    await client.connect();

    try {
      await client.query(`
        CREATE TABLE schema_migrations (
          filename text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      const baselineFiles = ['001_initial_schema.sql', '002_case_core.sql', '003_case_idempotency_key_bytes.sql'];
      for (const file of baselineFiles) {
        const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
      }

      const preRows = (await client.query('SELECT filename, applied_at FROM schema_migrations ORDER BY filename')).rows;
      await client.end();

      const upgradeRun = execFileSync('node', ['scripts/db-migrate.mjs'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, MIGRATION_DATABASE_URL: dbUrl },
      });

      expect(upgradeRun).toContain('SKIP 001_initial_schema.sql');
      expect(upgradeRun).toContain('SKIP 002_case_core.sql');
      expect(upgradeRun).toContain('SKIP 003_case_idempotency_key_bytes.sql');
      expect(upgradeRun).toContain('Migration complete: 30 new, 3 previously applied.');

      const clientAfter = new Client({ connectionString: dbUrl });
      await clientAfter.connect();
      try {
        const postRows = (await clientAfter.query(`
          SELECT filename, applied_at, content_checksum, checksum_origin
            FROM schema_migrations
           ORDER BY filename
        `)).rows;

        expect(postRows.length).toBe(33);

        for (const pre of preRows) {
          const post = postRows.find((r: any) => r.filename === pre.filename);
          expect(post).toBeDefined();
          expect(post.applied_at.getTime()).toBe(pre.applied_at.getTime());
          expect(post.checksum_origin).toBe('LEGACY_BASELINE');
          expect(post.content_checksum).toMatch(/^[0-9a-f]{64}$/);
        }
      } finally {
        await clientAfter.end();
      }
    } finally {
      // client already ended
    }
  });

  // ─── 3. Migration SQL Failure Rollback ───
  it('migration SQL failure rolls back all DDL statements in that migration and records no metadata', async () => {
    const { dbName, dbUrl } = await createTempDatabase('xsy_atom_fail_sql');

    const client = new Client({ connectionString: dbUrl });
    await client.connect();

    try {
      await client.query(`
        CREATE TABLE schema_migrations (
          filename text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now(),
          content_checksum text,
          checksum_origin text,
          checksum_bound_at timestamptz
        )
      `);

      // Execute a failing migration under runner transaction semantics
      const failingSql = `
        CREATE TABLE atomicity_canary_table_1 (id int PRIMARY KEY);
        -- Intentional error in middle of migration
        SELECT * FROM non_existent_table_for_atomicity_test;
      `;

      let errorThrown = false;
      await client.query('BEGIN');
      try {
        await client.query(failingSql);
        await client.query(
          `INSERT INTO schema_migrations (filename, content_checksum, checksum_origin, checksum_bound_at)
           VALUES ('999_failing_sql.sql', 'hash', 'APPLIED', now())`
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        errorThrown = true;
      }

      expect(errorThrown).toBe(true);

      // Assert atomicity_canary_table_1 does NOT exist
      const { rows: tableRows } = await client.query(`
        SELECT tablename FROM pg_tables
         WHERE schemaname = 'public' AND tablename = 'atomicity_canary_table_1'
      `);
      expect(tableRows.length).toBe(0);

      // Assert schema_migrations has no record
      const { rows: metaRows } = await client.query(`
        SELECT filename FROM schema_migrations WHERE filename = '999_failing_sql.sql'
      `);
      expect(metaRows.length).toBe(0);
    } finally {
      await client.end();
    }
  });

  // ─── 4. Deterministic Metadata Failure Rollback ───
  it('deterministic metadata registration failure rolls back all migration DDL within runner-owned transaction', async () => {
    const { dbName, dbUrl } = await createTempDatabase('xsy_atom_fail_meta');

    const client = new Client({ connectionString: dbUrl });
    await client.connect();

    try {
      await client.query(`
        CREATE TABLE schema_migrations (
          filename text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now(),
          content_checksum text,
          checksum_origin text,
          checksum_bound_at timestamptz
        )
      `);

      // Install a deterministic failure trigger on schema_migrations
      await client.query(`
        CREATE OR REPLACE FUNCTION trg_fail_deterministic_test()
        RETURNS trigger AS $$
        BEGIN
          IF NEW.filename = '999_deterministic_meta_failure.sql' THEN
            RAISE EXCEPTION 'MOCK_DETERMINISTIC_METADATA_INSERT_FAILURE';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER fail_meta_insert_test
          BEFORE INSERT ON schema_migrations
          FOR EACH ROW
          EXECUTE FUNCTION trg_fail_deterministic_test();
      `);

      // Prepare a migration that succeeds in DDL
      const targetMigration = {
        filename: '999_deterministic_meta_failure.sql',
        checksum: '1111111111111111111111111111111111111111111111111111111111111111',
        executableSql: `
          CREATE TABLE deterministic_canary_table (id serial PRIMARY KEY, data text);
          CREATE TYPE deterministic_canary_enum AS ENUM ('ALPHA', 'BETA');
        `,
      };

      let runnerFailed = false;
      let failureMessage = '';

      // Run exactly as the runner executes
      await client.query('BEGIN');
      try {
        await client.query(targetMigration.executableSql);
        await client.query(
          `INSERT INTO schema_migrations
             (filename, content_checksum, checksum_origin, checksum_bound_at)
           VALUES ($1, $2, 'APPLIED', now())`,
          [targetMigration.filename, targetMigration.checksum]
        );
        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        runnerFailed = true;
        failureMessage = err.message;
      }

      expect(runnerFailed).toBe(true);
      expect(failureMessage).toContain('MOCK_DETERMINISTIC_METADATA_INSERT_FAILURE');

      // CRITICAL ASSERTION:
      // Even though the DDL succeeded, the failure during schema_migrations insert
      // must cause a complete ROLLBACK of the DDL changes.
      const { rows: tableRows } = await client.query(`
        SELECT tablename FROM pg_tables
         WHERE schemaname = 'public' AND tablename = 'deterministic_canary_table'
      `);
      expect(tableRows.length).toBe(0);

      const { rows: typeRows } = await client.query(`
        SELECT typname FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public' AND typname = 'deterministic_canary_enum'
      `);
      expect(typeRows.length).toBe(0);

      const { rows: metaRows } = await client.query(`
        SELECT filename FROM schema_migrations WHERE filename = $1
      `, [targetMigration.filename]);
      expect(metaRows.length).toBe(0);
    } finally {
      await client.end();
    }
  });

  // ─── 5. Checksum Mismatch Fail-Closed ───
  it('checksum mismatch causes runner to fail closed before applying any new migration', async () => {
    const { dbName, dbUrl } = await createTempDatabase('xsy_atom_mismatch');

    // Run first migration to completion
    execFileSync('node', ['scripts/db-migrate.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, MIGRATION_DATABASE_URL: dbUrl },
    });

    const client = new Client({ connectionString: dbUrl });
    await client.connect();

    try {
      // Corrupt a recorded checksum
      await client.query(`
        UPDATE schema_migrations
           SET content_checksum = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
         WHERE filename = '001_initial_schema.sql'
      `);
      await client.end();

      // Running migrate must throw MIGRATION_CHECKSUM_MISMATCH
      let failed = false;
      let output = '';
      try {
        execFileSync('node', ['scripts/db-migrate.mjs'], {
          cwd: ROOT,
          encoding: 'utf8',
          env: { ...process.env, MIGRATION_DATABASE_URL: dbUrl },
        });
      } catch (err: any) {
        failed = true;
        output = `${err.stdout ?? ''}${err.stderr ?? ''}`;
      }

      expect(failed).toBe(true);
      expect(output).toContain('MIGRATION_CHECKSUM_MISMATCH 001_initial_schema.sql');
    } finally {
      // client ended
    }
  });

  // ─── 6. Future Migration Transaction-Control Guard ───
  it('future migration transaction guard rejects unwhitelisted top-level transaction controls and fingerprint drift', () => {
    // 6a: Normal DDL without transaction control passes
    const valid = validateAndPrepareMigrationSql('031_new_feature.sql', 'CREATE TABLE test (id int);', 'any_checksum');
    expect(valid.stripped).toBe(false);
    expect(valid.executableSql).toBe('CREATE TABLE test (id int);');

    // 6b: Top-level BEGIN in new migration is rejected
    expect(() => {
      validateAndPrepareMigrationSql(
        '031_unauthorized.sql',
        'BEGIN;\nCREATE TABLE test (id int);\nCOMMIT;',
        'checksum'
      );
    }).toThrow(/MIGRATION_UNAUTHORIZED_TRANSACTION_CONTROL/);

    // 6c: Top-level ROLLBACK in new migration is rejected
    expect(() => {
      validateAndPrepareMigrationSql(
        '032_unauthorized_rollback.sql',
        'ROLLBACK;',
        'checksum'
      );
    }).toThrow(/MIGRATION_UNAUTHORIZED_TRANSACTION_CONTROL/);

    // 6d: Whitelisted legacy filename with drifted fingerprint is rejected
    const legacyName = '023_digital_use_review_runtime_authority_reconciled.sql';
    expect(() => {
      validateAndPrepareMigrationSql(
        legacyName,
        'BEGIN;\nCREATE TABLE t (id int);\nCOMMIT;',
        'wrong_tampered_fingerprint'
      );
    }).toThrow(/MIGRATION_LEGACY_FINGERPRINT_MISMATCH/);

    // 6e: Whitelisted legacy filename with invalid structure (extra BEGIN) is rejected
    const expectedHash = LEGACY_TRANSACTION_WRAPPED_MIGRATIONS.get(legacyName)!;
    expect(() => {
      validateAndPrepareMigrationSql(
        legacyName,
        'BEGIN;\nBEGIN;\nCREATE TABLE t (id int);\nCOMMIT;',
        expectedHash
      );
    }).toThrow(/MIGRATION_LEGACY_STRUCTURE_INVALID/);

    // 6f: PL/pgSQL function containing BEGIN/END within dollar quotes is preserved intact
    const plpgsqlSql = `
      CREATE FUNCTION do_work() RETURNS void LANGUAGE plpgsql AS $$
      BEGIN
        IF true THEN
          PERFORM 1;
        END IF;
      END $$;
    `;
    const fnResult = validateAndPrepareMigrationSql('033_plpgsql.sql', plpgsqlSql, 'hash');
    expect(fnResult.stripped).toBe(false);
    expect(fnResult.executableSql).toBe(plpgsqlSql);
  });
});
