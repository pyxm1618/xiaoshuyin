/**
 * REM1-004 — real migration-runner / PostgreSQL checksum proof.
 *
 * The production runner bytes are copied into an isolated repository-shaped
 * fixture so tests can mutate migration files without touching db/migrations.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL']!;
const tempRoots: string[] = [];
const tempDatabases: string[] = [];

function quoteIdent(value: string) {
  return '"' + value.replace(/"/g, '""') + '"';
}

function fixtureRoot() {
  const root = mkdtempSync(join(process.cwd(), 'tests', '.tmp-migration-integrity-'));
  tempRoots.push(root);
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'db', 'migrations'), { recursive: true });
  copyFileSync(join(process.cwd(), 'scripts', 'db-migrate.mjs'), join(root, 'scripts', 'db-migrate.mjs'));
  return root;
}

function writeMigration(root: string, filename: string, sql: string) {
  writeFileSync(join(root, 'db', 'migrations', filename), sql);
}

const METADATA_MIGRATION = `
ALTER TABLE schema_migrations
  ADD COLUMN IF NOT EXISTS content_checksum text,
  ADD COLUMN IF NOT EXISTS checksum_origin text,
  ADD COLUMN IF NOT EXISTS checksum_bound_at timestamptz;
`;

async function createDatabase(label: string) {
  if (!ADMIN_URL || !MIGRATION_URL) {
    throw new Error('TEST_ADMIN_DATABASE_URL and MIGRATION_DATABASE_URL are required');
  }
  const name = `xiaoshuyin_checksum_${label}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  tempDatabases.push(name);

  const migration = new URL(MIGRATION_URL);
  const owner = decodeURIComponent(migration.username);
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${quoteIdent(name)} OWNER ${quoteIdent(owner)}`);
  } finally {
    await admin.end();
  }

  migration.pathname = `/${name}`;
  return migration.toString();
}

function runRunner(root: string, databaseUrl: string) {
  return spawnSync('node', [join(root, 'scripts', 'db-migrate.mjs')], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, MIGRATION_DATABASE_URL: databaseUrl },
  });
}

afterEach(async () => {
  for (const name of tempDatabases.splice(0)) {
    const admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    try {
      await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)} WITH (FORCE)`);
    } finally {
      await admin.end();
    }
  }
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('migration checksum integrity', () => {
  it('records new checksums, accepts unchanged/appended migrations, and rejects same-name body drift before later SQL', async () => {
    const root = fixtureRoot();
    const dbUrl = await createDatabase('fresh');

    writeMigration(root, '001_probe.sql', 'CREATE TABLE checksum_probe (id integer PRIMARY KEY);\n');
    writeMigration(root, '002_checksum_metadata.sql', METADATA_MIGRATION);

    const first = runRunner(root, dbUrl);
    expect(first.status, `${first.stdout}\n${first.stderr}`).toBe(0);

    const db = new Client({ connectionString: dbUrl });
    await db.connect();
    try {
      const metadata = await db.query(
        `SELECT filename, content_checksum, checksum_origin, checksum_bound_at
           FROM schema_migrations ORDER BY filename`
      );
      expect(metadata.rows).toHaveLength(2);
      for (const row of metadata.rows) {
        expect(row.content_checksum).toMatch(/^[0-9a-f]{64}$/);
        expect(row.checksum_origin).toBe('APPLIED');
        expect(row.checksum_bound_at).not.toBeNull();
      }

      const unchanged = runRunner(root, dbUrl);
      expect(unchanged.status, `${unchanged.stdout}\n${unchanged.stderr}`).toBe(0);

      writeMigration(root, '003_future.sql', 'CREATE TABLE checksum_future (id integer PRIMARY KEY);\n');
      const appended = runRunner(root, dbUrl);
      expect(appended.status, `${appended.stdout}\n${appended.stderr}`).toBe(0);
      const future = await db.query(`SELECT to_regclass('public.checksum_future') AS rel`);
      expect(future.rows[0].rel).toBe('checksum_future');

      writeMigration(
        root,
        '001_probe.sql',
        'CREATE TABLE checksum_probe (id integer PRIMARY KEY);\n-- mutated body\n'
      );
      writeMigration(root, '004_must_not_run.sql', 'CREATE TABLE checksum_must_not_run (id integer);\n');

      const mutated = runRunner(root, dbUrl);
      expect(mutated.status).not.toBe(0);
      expect(`${mutated.stdout}\n${mutated.stderr}`).toMatch(
        /MIGRATION_CHECKSUM_MISMATCH 001_probe\.sql/
      );
      const danger = await db.query(`SELECT to_regclass('public.checksum_must_not_run') AS rel`);
      expect(danger.rows[0].rel).toBeNull();
    } finally {
      await db.end();
    }
  });

  it('binds filename-only legacy rows once as LEGACY_BASELINE, then detects later drift', async () => {
    const root = fixtureRoot();
    const dbUrl = await createDatabase('legacy');
    const original = 'CREATE TABLE legacy_probe (id integer PRIMARY KEY);\n';
    writeMigration(root, '001_legacy.sql', original);
    writeMigration(root, '002_checksum_metadata.sql', METADATA_MIGRATION);

    const db = new Client({ connectionString: dbUrl });
    await db.connect();
    try {
      await db.query(`
        CREATE TABLE schema_migrations (
          filename text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await db.query(original);
      await db.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        ['001_legacy.sql']
      );
    } finally {
      await db.end();
    }

    const transitioned = runRunner(root, dbUrl);
    expect(transitioned.status, `${transitioned.stdout}\n${transitioned.stderr}`).toBe(0);

    const check = new Client({ connectionString: dbUrl });
    await check.connect();
    try {
      const rows = await check.query(
        `SELECT filename, content_checksum, checksum_origin, checksum_bound_at
           FROM schema_migrations ORDER BY filename`
      );
      expect(rows.rows).toHaveLength(2);
      expect(rows.rows[0]).toMatchObject({
        filename: '001_legacy.sql',
        checksum_origin: 'LEGACY_BASELINE',
      });
      expect(rows.rows[0].content_checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(rows.rows[0].checksum_bound_at).not.toBeNull();
      expect(rows.rows[1]).toMatchObject({
        filename: '002_checksum_metadata.sql',
        checksum_origin: 'APPLIED',
      });

      writeMigration(root, '001_legacy.sql', original + '-- changed after baseline\n');
      const drift = runRunner(root, dbUrl);
      expect(drift.status).not.toBe(0);
      expect(`${drift.stdout}\n${drift.stderr}`).toMatch(
        /MIGRATION_CHECKSUM_MISMATCH 001_legacy\.sql/
      );
    } finally {
      await check.end();
    }
  });
});
