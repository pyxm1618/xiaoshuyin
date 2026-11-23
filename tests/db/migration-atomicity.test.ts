/**
 * migration-atomicity.test.ts
 *
 * Comprehensive end-to-end and unit verification of migration execution atomicity (Finding #16 remediation).
 *
 * Verifies:
 * 1. Fresh database rebuild: all 35 migrations applied in a single clean run, checksums recorded, replay is a no-op.
 * 2. Existing database upgrade: legacy 001-003 state upgrades cleanly without rewriting historical timestamps.
 * 3. Migration SQL failure rollback through REAL PRODUCTION RUNNER: when a migration statement fails,
 *    the runner rolls back the transaction, DDL is absent, schema_migrations row is absent, and later migrations are skipped.
 * 4. Deterministic metadata failure rollback through REAL PRODUCTION RUNNER: when DDL succeeds but schema_migrations
 *    INSERT fails deterministically via a trigger, the runner-owned transaction rolls back all DDL effects.
 * 5. Checksum mismatch fail-closed: any tampered checksum in schema_migrations causes fail-closed before later migrations.
 * 6. Future migration transaction guard: unauthorized top-level transaction controls and fingerprint mismatches fail closed.
 */

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  LEGACY_TRANSACTION_WRAPPED_MIGRATIONS,
  scanTopLevelTransactionStatements,
  sha256,
  validateAndPrepareMigrationSql,
} from '../../scripts/db-migrate.mjs';

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
  const tempDirs: string[] = [];

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
    for (const dir of tempDirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  });

  async function createTempDatabase(prefix: string): Promise<{ dbName: string; dbUrl: string }> {
    const dbName = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const migratorRole = getMigratorRole(BASE_MIGRATION_URL!);
    await adminClient.query(`CREATE DATABASE ${quoteIdent(dbName)} OWNER ${quoteIdent(migratorRole)}`);
    createdDbs.push(dbName);
    return { dbName, dbUrl: buildDbUrl(BASE_MIGRATION_URL!, dbName) };
  }

  function createTempMigrationDir(): string {
    const dir = mkdtempSync(join(ROOT, 'tests', '.tmp-atomicity-migrations-'));
    tempDirs.push(dir);
    return dir;
  }

  // ─── 1. Fresh Database Rebuild ───
  it('fresh database rebuild applies all 35 migrations with correct checksums, and replay is 0 new', async () => {
    const { dbName, dbUrl } = await createTempDatabase('xsy_atom_fresh');

    const firstRun = execFileSync('node', ['scripts/db-migrate.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, MIGRATION_DATABASE_URL: dbUrl },
    });

    expect(firstRun).toContain('Migration complete: 35 new, 0 previously applied.');

    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    try {
      const { rows } = await client.query(`
        SELECT filename, content_checksum, checksum_origin
          FROM schema_migrations
         ORDER BY filename
      `);
      expect(rows.length).toBe(35);

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
      expect(secondRun).toContain('Migration complete: 0 new, 35 previously applied.');
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
      expect(upgradeRun).toContain('Migration complete: 32 new, 3 previously applied.');

      const clientAfter = new Client({ connectionString: dbUrl });
      await clientAfter.connect();
      try {
        const postRows = (await clientAfter.query(`
          SELECT filename, applied_at, content_checksum, checksum_origin
            FROM schema_migrations
           ORDER BY filename
        `)).rows;

        expect(postRows.length).toBe(35);

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
      // client ended
    }
  });

  // ─── 3. Migration SQL Failure Rollback Through REAL Production Runner (HIGH-001) ───
  it('migration SQL failure through real production runner rolls back DDL and records no metadata', async () => {
    const { dbName, dbUrl } = await createTempDatabase('xsy_atom_fail_runner_sql');

    // Create an isolated temporary migration directory
    const tempDir = createTempMigrationDir();

    // Migration 001: creates a table, then fails deterministically on invalid SQL
    writeFileSync(
      join(tempDir, '001_succeeds_then_fails.sql'),
      `
        CREATE TABLE real_runner_sql_canary (id int PRIMARY KEY);
        -- Intentional error in middle of migration
        SELECT * FROM non_existent_table_for_real_runner_fail;
      `
    );

    // Migration 002: should NEVER be executed
    writeFileSync(
      join(tempDir, '002_should_never_execute.sql'),
      `CREATE TABLE real_runner_later_table (id int PRIMARY KEY);`
    );

    let runnerFailed = false;
    let runnerOutput = '';

    try {
      execFileSync('node', ['scripts/db-migrate.mjs'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          MIGRATIONS_DIR: tempDir,
          MIGRATION_DATABASE_URL: dbUrl,
        },
      });
    } catch (err: any) {
      runnerFailed = true;
      runnerOutput = `${err.stdout ?? ''}\n${err.stderr ?? ''}`;
    }

    expect(runnerFailed).toBe(true);
    expect(runnerOutput).toContain('FAIL 001_succeeds_then_fails.sql');

    // Connect to database and verify atomicity
    const client = new Client({ connectionString: dbUrl });
    await client.connect();

    try {
      // 1. Canary table must NOT exist in the database (rolled back)
      const { rows: tableRows } = await client.query(`
        SELECT tablename FROM pg_tables
         WHERE schemaname = 'public' AND tablename = 'real_runner_sql_canary'
      `);
      expect(tableRows.length).toBe(0);

      // 2. Later migration table must NOT exist
      const { rows: laterRows } = await client.query(`
        SELECT tablename FROM pg_tables
         WHERE schemaname = 'public' AND tablename = 'real_runner_later_table'
      `);
      expect(laterRows.length).toBe(0);

      // 3. schema_migrations must contain NO row for the failing migration
      const { rows: metaRows } = await client.query(`
        SELECT filename FROM schema_migrations WHERE filename = '001_succeeds_then_fails.sql'
      `);
      expect(metaRows.length).toBe(0);
    } finally {
      await client.end();
    }
  });

  // ─── 4. Deterministic Metadata Failure Rollback Through REAL Production Runner (HIGH-001) ───
  it('deterministic metadata registration failure through real production runner rolls back DDL completely', async () => {
    const { dbName, dbUrl } = await createTempDatabase('xsy_atom_fail_runner_meta');

    // Create an isolated temporary migration directory
    const tempDir = createTempMigrationDir();

    // Migration 001: Valid DDL that creates a table and a custom type
    const targetFile = '001_valid_ddl_failing_meta.sql';
    writeFileSync(
      join(tempDir, targetFile),
      `
        CREATE TABLE real_runner_meta_canary (id serial PRIMARY KEY, note text);
        CREATE TYPE real_runner_meta_enum AS ENUM ('ALPHA', 'BETA');
      `
    );

    // Pre-initialize schema_migrations table and attach a deterministic trigger
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now(),
          content_checksum text,
          checksum_origin text,
          checksum_bound_at timestamptz
        );

        CREATE OR REPLACE FUNCTION trg_fail_real_runner_meta()
        RETURNS trigger AS $$
        BEGIN
          IF NEW.filename = '${targetFile}' THEN
            RAISE EXCEPTION 'MOCK_DETERMINISTIC_METADATA_INSERT_FAILURE';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER test_fail_meta_insert
          BEFORE INSERT ON schema_migrations
          FOR EACH ROW
          EXECUTE FUNCTION trg_fail_real_runner_meta();
      `);
    } finally {
      await client.end();
    }

    // Execute the real production runner
    let runnerFailed = false;
    let runnerOutput = '';

    try {
      execFileSync('node', ['scripts/db-migrate.mjs'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          MIGRATIONS_DIR: tempDir,
          MIGRATION_DATABASE_URL: dbUrl,
        },
      });
    } catch (err: any) {
      runnerFailed = true;
      runnerOutput = `${err.stdout ?? ''}\n${err.stderr ?? ''}`;
    }

    expect(runnerFailed).toBe(true);
    expect(runnerOutput).toContain('MOCK_DETERMINISTIC_METADATA_INSERT_FAILURE');

    // Verify DDL changes were completely rolled back by runner-owned transaction
    const clientVerify = new Client({ connectionString: dbUrl });
    await clientVerify.connect();
    try {
      // Table must NOT exist
      const { rows: tableRows } = await clientVerify.query(`
        SELECT tablename FROM pg_tables
         WHERE schemaname = 'public' AND tablename = 'real_runner_meta_canary'
      `);
      expect(tableRows.length).toBe(0);

      // Enum type must NOT exist
      const { rows: typeRows } = await clientVerify.query(`
        SELECT typname FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public' AND typname = 'real_runner_meta_enum'
      `);
      expect(typeRows.length).toBe(0);

      // schema_migrations must have NO entry
      const { rows: metaRows } = await clientVerify.query(`
        SELECT filename FROM schema_migrations WHERE filename = '${targetFile}'
      `);
      expect(metaRows.length).toBe(0);
    } finally {
      await clientVerify.end();
    }
  });

  // ─── 4b. Real Legacy Stripping Path Through REAL Production Runner (HIGH) ───
  it(
    'real legacy migration stripping path rolls back schema effects when metadata insert fails deterministically',
    async () => {
      const { dbUrl } = await createTempDatabase('xsy_atom_legacy_runner');
      const targetFile = '023_digital_use_review_runtime_authority_reconciled.sql';
      const expectedHash = LEGACY_TRANSACTION_WRAPPED_MIGRATIONS.get(targetFile)!;
      const targetBytes = readFileSync(join(MIGRATIONS_DIR, targetFile));

      // The repository file must be byte-identical to the frozen fingerprint and
      // must genuinely take the runtime stripping path (never a fake fixture).
      expect(sha256(targetBytes)).toBe(expectedHash);
      const stripped = validateAndPrepareMigrationSql(
        targetFile,
        targetBytes.toString('utf8'),
        expectedHash
      );
      expect(stripped.stripped).toBe(true);

      // Stage real prerequisite migrations byte-for-byte (all files before 023).
      const tempDir = createTempMigrationDir();
      const prerequisiteFiles = readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql') && f.slice(0, 3) < '023')
        .sort();
      expect(prerequisiteFiles.length).toBe(23);
      for (const file of prerequisiteFiles) {
        copyFileSync(join(MIGRATIONS_DIR, file), join(tempDir, file));
      }

      // Apply prerequisites through the real production runner.
      const prerequisiteRun = execFileSync('node', ['scripts/db-migrate.mjs'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, MIGRATIONS_DIR: tempDir, MIGRATION_DATABASE_URL: dbUrl },
      });
      expect(prerequisiteRun).toContain(
        `Migration complete: ${prerequisiteFiles.length} new, 0 previously applied.`
      );

      // Install a deterministic BEFORE INSERT failure bound to the real legacy
      // filename. No random network or timing failure injection is used.
      const client = new Client({ connectionString: dbUrl });
      await client.connect();
      try {
        await client.query(`
          CREATE OR REPLACE FUNCTION trg_fail_legacy_meta()
          RETURNS trigger AS $$
          BEGIN
            IF NEW.filename = '${targetFile}' THEN
              RAISE EXCEPTION 'MOCK_DETERMINISTIC_LEGACY_METADATA_INSERT_FAILURE';
            END IF;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;

          CREATE TRIGGER test_fail_legacy_meta_insert
            BEFORE INSERT ON schema_migrations
            FOR EACH ROW
            EXECUTE FUNCTION trg_fail_legacy_meta();
        `);
      } finally {
        await client.end();
      }

      // Stage the real legacy migration byte-for-byte into the same directory.
      copyFileSync(join(MIGRATIONS_DIR, targetFile), join(tempDir, targetFile));
      expect(sha256(readFileSync(join(tempDir, targetFile)))).toBe(expectedHash);

      let runnerFailed = false;
      let runnerOutput = '';

      try {
        execFileSync('node', ['scripts/db-migrate.mjs'], {
          cwd: ROOT,
          encoding: 'utf8',
          env: { ...process.env, MIGRATIONS_DIR: tempDir, MIGRATION_DATABASE_URL: dbUrl },
        });
      } catch (err: any) {
        runnerFailed = true;
        runnerOutput = `${err.stdout ?? ''}\n${err.stderr ?? ''}`;
      }

      expect(runnerFailed).toBe(true);
      expect(runnerOutput).toContain(`APPLY ${targetFile}`);
      expect(runnerOutput).toContain('MOCK_DETERMINISTIC_LEGACY_METADATA_INSERT_FAILURE');

      const verify = new Client({ connectionString: dbUrl });
      await verify.connect();
      try {
        // 023 widens these three scene_artifacts CHECK constraints with the
        // Digital Use vocabulary; a rollback must restore the pre-023 definitions.
        const { rows: constraintRows } = await verify.query(`
          SELECT conname, pg_get_constraintdef(oid, true) AS def
            FROM pg_constraint
           WHERE conrelid = 'scene_artifacts'::regclass
             AND conname IN (
               'scene_artifacts_type_check',
               'scene_artifacts_source_node_check',
               'scene_artifacts_type_source_check'
             )
           ORDER BY conname
        `);
        expect(constraintRows.length).toBe(3);
        for (const row of constraintRows) {
          expect(row.def).not.toContain('DIGITAL_USE_A5001_EFFECT_EVALUATION');
          expect(row.def).not.toContain('DIGITAL_USE_A5002_EFFECT_EVALUATION');
        }

        const { rows: metaRows } = await verify.query(
          'SELECT filename FROM schema_migrations WHERE filename = $1',
          [targetFile]
        );
        expect(metaRows.length).toBe(0);
      } finally {
        await verify.end();
      }
    },
    120000
  );

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

  // ─── 6. Future Migration Transaction-Control Guard & Adversarial Verification ───
  it('future migration transaction guard enforces fail-closed on transaction control statements', () => {
    // 6a: Normal DDL without transaction control passes
    const valid = validateAndPrepareMigrationSql('031_new_feature.sql', 'CREATE TABLE test (id int);', 'any_checksum');
    expect(valid.stripped).toBe(false);
    expect(valid.executableSql).toBe('CREATE TABLE test (id int);');

    // 6b: Top-level BEGIN in new migration is rejected
    expect(() => {
      validateAndPrepareMigrationSql('031_unauthorized.sql', 'BEGIN;\nCREATE TABLE test (id int);\nCOMMIT;', 'checksum');
    }).toThrow(/MIGRATION_UNAUTHORIZED_TRANSACTION_CONTROL/);

    // 6c: ABORT in new migration is rejected (BLOCKER-001)
    expect(() => {
      validateAndPrepareMigrationSql('031_unauthorized_abort.sql', 'CREATE TABLE canary(id int);\nABORT;', 'checksum');
    }).toThrow(/MIGRATION_UNAUTHORIZED_TRANSACTION_CONTROL/);

    // 6d: Top-level COMMIT hidden behind E'...' string is rejected (BLOCKER-002)
    expect(() => {
      validateAndPrepareMigrationSql('031_unauthorized_estring.sql', "SELECT E'it\\'s okay';\nCOMMIT;", 'checksum');
    }).toThrow(/MIGRATION_UNAUTHORIZED_TRANSACTION_CONTROL/);

    // 6e: SQL-language BEGIN ATOMIC function body is preserved and accepted (MEDIUM-001)
    const atomicSql = `
      CREATE FUNCTION f()
      RETURNS integer
      LANGUAGE SQL
      BEGIN ATOMIC
        SELECT 1;
      END;
    `;
    const atomicResult = validateAndPrepareMigrationSql('031_atomic.sql', atomicSql, 'checksum');
    expect(atomicResult.stripped).toBe(false);
    expect(atomicResult.executableSql).toBe(atomicSql);

    // 6f: Whitelisted legacy filename with drifted fingerprint is rejected
    const legacyName = '023_digital_use_review_runtime_authority_reconciled.sql';
    expect(() => {
      validateAndPrepareMigrationSql(legacyName, 'BEGIN;\nCREATE TABLE t (id int);\nCOMMIT;', 'wrong_tampered_fingerprint');
    }).toThrow(/MIGRATION_LEGACY_FINGERPRINT_MISMATCH/);

    // 6g: Whitelisted legacy filename with invalid structure is rejected
    const expectedHash = LEGACY_TRANSACTION_WRAPPED_MIGRATIONS.get(legacyName)!;
    expect(() => {
      validateAndPrepareMigrationSql(legacyName, 'BEGIN;\nBEGIN;\nCREATE TABLE t (id int);\nCOMMIT;', expectedHash);
    }).toThrow(/MIGRATION_LEGACY_STRUCTURE_INVALID/);
  });
});
