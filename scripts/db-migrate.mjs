#!/usr/bin/env node
/**
 * db-migrate.mjs — Reviewed migration executor for Xiaoshuyin.
 *
 * Connects as the migrator role (MIGRATION_DATABASE_URL),
 * applies db/migrations/*.sql in filename order,
 * records applied migrations in schema_migrations,
 * and verifies the app role has no DDL permissions.
 *
 * NEVER uses drizzle-kit push.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const ROOT = new URL('..', import.meta.url).pathname;
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations');

async function main() {
  const connectionString = process.env['MIGRATION_DATABASE_URL'];
  if (!connectionString) {
    console.error('MIGRATION_DATABASE_URL is required');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    // Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Get list of migration files
    let files;
    try {
      files = readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort();
    } catch {
      console.log('No migrations directory found, nothing to apply.');
      return;
    }

    if (files.length === 0) {
      console.log('No migration files found, nothing to apply.');
      return;
    }

    // Get already-applied migrations
    const { rows: applied } = await client.query(
      'SELECT filename FROM schema_migrations'
    );
    const appliedSet = new Set(applied.map((r) => r.filename));

    let newCount = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  SKIP ${file} (already applied)`);
        continue;
      }

      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
      console.log(`  APPLY ${file}`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        newCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  FAIL ${file}: ${err.message}`);
        throw err;
      }
    }

    console.log(`\nMigration complete: ${newCount} new, ${appliedSet.size} previously applied.`);

    // Verify app role has no DDL permissions
    await verifyAppRoleNoDdl(client);
  } finally {
    await client.end();
  }
}

async function verifyAppRoleNoDdl(client) {
  const { rows } = await client.query(`
    SELECT
      has_schema_privilege('xiaoshuyin_app', 'public', 'CREATE') as can_create_schema,
      has_table_privilege('xiaoshuyin_app', 'schema_migrations', 'CREATE') as can_create_table
  `);

  const r = rows[0];
  if (r.can_create_schema || r.can_create_table) {
    console.error('WARNING: app role has DDL permissions it should not have');
    process.exit(1);
  } else {
    console.log('Verified: app role has no DDL permissions.');
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
