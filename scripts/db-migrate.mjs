#!/usr/bin/env node
/**
 * Apply db/migrations/*.sql in lexical order.
 *
 * Migration integrity:
 * - Fresh databases record SHA-256 for every migration at first application.
 * - Legacy filename-only databases transition when the forward migration adds
 *   checksum metadata; pre-existing rows are bound once to the repository bytes
 *   visible at that transition and marked LEGACY_BASELINE.
 * - Once checksum-bound, same-filename content drift fails closed before any
 *   later migration is applied.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const ROOT = new URL('..', import.meta.url).pathname;
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations');
const CHECKSUM_RE = /^[0-9a-f]{64}$/;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function checksumMetadataAvailable(client) {
  const { rows } = await client.query(`
    SELECT count(*)::int AS n
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'schema_migrations'
       AND column_name IN ('content_checksum', 'checksum_origin', 'checksum_bound_at')
  `);
  return rows[0]?.n === 3;
}

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((filename) => {
      const bytes = readFileSync(join(MIGRATIONS_DIR, filename));
      return { filename, sql: bytes.toString('utf8'), checksum: sha256(bytes) };
    });
}

async function readApplied(client, hasChecksums) {
  if (!hasChecksums) {
    const { rows } = await client.query(
      'SELECT filename FROM schema_migrations ORDER BY filename'
    );
    return rows.map((row) => ({
      filename: row.filename,
      content_checksum: null,
      checksum_origin: null,
      checksum_bound_at: null,
    }));
  }

  const { rows } = await client.query(`
    SELECT filename, content_checksum, checksum_origin, checksum_bound_at
      FROM schema_migrations
     ORDER BY filename
  `);
  return rows;
}

async function validateBoundMigrations(client, byName) {
  const rows = await readApplied(client, true);
  const legacy = [];

  for (const row of rows) {
    const current = byName.get(row.filename);
    if (!current) {
      throw new Error(`MIGRATION_FILE_MISSING ${row.filename}`);
    }

    if (row.content_checksum === null) {
      if (row.checksum_origin !== null || row.checksum_bound_at !== null) {
        throw new Error(`MIGRATION_CHECKSUM_METADATA_INVALID ${row.filename}`);
      }
      legacy.push(row.filename);
      continue;
    }

    if (
      !CHECKSUM_RE.test(row.content_checksum) ||
      !['APPLIED', 'LEGACY_BASELINE'].includes(row.checksum_origin) ||
      row.checksum_bound_at === null
    ) {
      throw new Error(`MIGRATION_CHECKSUM_METADATA_INVALID ${row.filename}`);
    }

    if (row.content_checksum !== current.checksum) {
      throw new Error(`MIGRATION_CHECKSUM_MISMATCH ${row.filename}`);
    }
  }

  return legacy;
}

async function bindLegacyRows(client, filenames, byName) {
  if (filenames.length === 0) return;

  await client.query('BEGIN');
  try {
    for (const filename of filenames) {
      const current = byName.get(filename);
      if (!current) {
        throw new Error(`MIGRATION_FILE_MISSING ${filename}`);
      }
      const result = await client.query(
        `UPDATE schema_migrations
            SET content_checksum = $2,
                checksum_origin = 'LEGACY_BASELINE',
                checksum_bound_at = now()
          WHERE filename = $1
            AND content_checksum IS NULL
            AND checksum_origin IS NULL
            AND checksum_bound_at IS NULL`,
        [filename, current.checksum]
      );
      if (result.rowCount !== 1) {
        throw new Error(`MIGRATION_LEGACY_BASELINE_RACE ${filename}`);
      }
      console.log(`BASELINE ${filename} sha256:${current.checksum}`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) {
    console.error('MIGRATION_DATABASE_URL is required');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    // Fresh databases start checksum-capable. Existing filename-only tables are
    // not rewritten here: migration 018 establishes the forward transition.
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename           text PRIMARY KEY,
        applied_at         timestamptz NOT NULL DEFAULT now(),
        content_checksum   text,
        checksum_origin    text,
        checksum_bound_at  timestamptz
      )
    `);

    const migrations = migrationFiles();
    const byName = new Map(migrations.map((m) => [m.filename, m]));

    let hasChecksums = await checksumMetadataAvailable(client);
    const initialRows = await readApplied(client, hasChecksums);
    const applied = new Set(initialRows.map((row) => row.filename));

    if (hasChecksums) {
      const legacy = await validateBoundMigrations(client, byName);
      await bindLegacyRows(client, legacy, byName);
    }

    let appliedCount = 0;

    for (const migration of migrations) {
      if (applied.has(migration.filename)) {
        console.log(`SKIP ${migration.filename}`);
        continue;
      }

      console.log(`APPLY ${migration.filename}`);
      await client.query('BEGIN');
      let metadataAfterApply = hasChecksums;
      try {
        await client.query(migration.sql);
        metadataAfterApply = await checksumMetadataAvailable(client);

        if (metadataAfterApply) {
          await client.query(
            `INSERT INTO schema_migrations
               (filename, content_checksum, checksum_origin, checksum_bound_at)
             VALUES ($1, $2, 'APPLIED', now())`,
            [migration.filename, migration.checksum]
          );
        } else {
          await client.query(
            'INSERT INTO schema_migrations (filename) VALUES ($1)',
            [migration.filename]
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`FAILED ${migration.filename}:`, err.message);
        throw err;
      }

      applied.add(migration.filename);
      appliedCount++;

      // The forward metadata migration is the exact legacy transition point.
      // Bind all older filename-only records before any later migration runs.
      if (!hasChecksums && metadataAfterApply) {
        hasChecksums = true;
        const legacy = await validateBoundMigrations(client, byName);
        await bindLegacyRows(client, legacy, byName);
      }
    }

    if (!hasChecksums) {
      throw new Error('MIGRATION_CHECKSUM_METADATA_NOT_ESTABLISHED');
    }

    const trailingLegacy = await validateBoundMigrations(client, byName);
    await bindLegacyRows(client, trailingLegacy, byName);

    try {
      const { rows } = await client.query(
        `SELECT has_schema_privilege('xiaoshuyin_app', 'public', 'CREATE') AS can_create`
      );
      if (rows[0]?.can_create) {
        throw new Error(
          'xiaoshuyin_app has CREATE on public schema; run db/init/01-roles.sh to revoke it'
        );
      }
    } catch (err) {
      if (err.code === '42704') {
        console.warn('WARN xiaoshuyin_app role not found; run db/init/01-roles.sh first');
      } else {
        throw err;
      }
    }

    console.log(
      `Migration complete: ${appliedCount} new, ${migrations.length - appliedCount} previously applied.`
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
