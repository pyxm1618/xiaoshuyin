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
 * - Self-contained runner: holds zero external local file dependencies so that
 *   tests copying only scripts/db-migrate.mjs can execute seamlessly.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const ROOT = new URL('..', import.meta.url).pathname;
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations');
const CHECKSUM_RE = /^[0-9a-f]{64}$/;
const MIGRATION_LOCK_KEY_1 = 20261114;
const MIGRATION_LOCK_KEY_2 = 1;

/**
 * The exact 8 legacy migrations permitted to have outer BEGIN; ... COMMIT; wrappers,
 * bound to their immutable historical SHA-256 fingerprints.
 */
export const LEGACY_TRANSACTION_WRAPPED_MIGRATIONS = new Map([
  [
    '023_digital_use_review_runtime_authority_reconciled.sql',
    'bb94e139cf931a0c79627b77d155e5e5fff123c8b9a60e2fc2719bbe3eb63ddf',
  ],
  [
    '024_psychological_behavioral_intervention_contract.sql',
    '18a3f9e02544e6eb9b9708ead76d116f8a12e0f66d124ccaa34da97fe4e717ed',
  ],
  [
    '025_professional_knowledge_foundation.sql',
    '1fc57759aa938908d422474df1b8c5dc1b0cca93cb31dd8fc1f2f50444ff5a5a',
  ],
  [
    '025_slice16_post_merge_forensic_remediation.sql',
    'ee047e1fabadc037588fb97537c9b0cd2fcb9266909409f9fc4084d9b3781d58',
  ],
  [
    '026_professional_authority_release_remediation.sql',
    '3186da0193feac1bd3259f4920ee707860c7d91a9ed653fd881ee848880e07c5',
  ],
  [
    '027_professional_knowledge_insert_lifecycle_guard.sql',
    'f62f683b6b5730c1085ea7c10e6a73aa441f49d9e50861760bafbbd4a1f481cf',
  ],
  [
    '028_professional_knowledge_authority_boundary_remediation.sql',
    'e713b7bd4e0b8c2b31140358415770fe7f080142b75472888566658268de7eb7',
  ],
  [
    '029_staff_assignment_control_plane.sql',
    '3bed128b4376dcf7c0c701ed53220c86835b12c7876e9d6a9ed4058416bd794d',
  ],
]);

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Scan SQL text and extract top-level statements that match transaction control keywords.
 * Correctly skips line comments, block comments, single quotes, double quotes, and dollar quotes.
 */
export function scanTopLevelTransactionStatements(content) {
  let i = 0;
  let blockDepth = 0;
  let inLineComment = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let dollarTag = null;
  let currentStmt = '';
  let stmtStart = 0;
  const statements = [];

  while (i < content.length) {
    const ch = content[i];
    const next = content[i + 1];

    if (blockDepth > 0) {
      if (ch === '/' && next === '*') {
        blockDepth++;
        i += 2;
        continue;
      }
      if (ch === '*' && next === '/') {
        blockDepth--;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
      }
      i++;
      continue;
    }

    if (dollarTag !== null) {
      if (content.startsWith(dollarTag, i)) {
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      i++;
      continue;
    }

    if (inSingleQuote) {
      if (ch === "'" && next === "'") {
        i += 2;
        continue;
      }
      if (ch === "'") {
        inSingleQuote = false;
        i++;
        continue;
      }
      i++;
      continue;
    }

    if (inDoubleQuote) {
      if (ch === '"' && next === '"') {
        i += 2;
        continue;
      }
      if (ch === '"') {
        inDoubleQuote = false;
        i++;
        continue;
      }
      i++;
      continue;
    }

    if (ch === '-' && next === '-') {
      inLineComment = true;
      i += 2;
      continue;
    }

    if (ch === '/' && next === '*') {
      blockDepth = 1;
      i += 2;
      continue;
    }

    if (ch === "'") {
      inSingleQuote = true;
      i++;
      continue;
    }

    if (ch === '"') {
      inDoubleQuote = true;
      i++;
      continue;
    }

    if (ch === '$') {
      const tagMatch = /^\$([A-Za-z0-9_]*)\$/.exec(content.slice(i));
      if (tagMatch) {
        dollarTag = tagMatch[0];
        i += dollarTag.length;
        continue;
      }
    }

    if (ch === ';') {
      const text = currentStmt.trim();
      if (text) {
        statements.push({ text, start: stmtStart, end: i + 1 });
      }
      currentStmt = '';
      stmtStart = i + 1;
      i++;
      continue;
    }

    if (!currentStmt && (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r')) {
      stmtStart = i + 1;
    } else {
      currentStmt += ch;
    }
    i++;
  }

  const text = currentStmt.trim();
  if (text) {
    statements.push({ text, start: stmtStart, end: content.length });
  }

  const txRegex = /^(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION|END)\b/i;
  return statements.filter((s) => txRegex.test(s.text));
}

/**
 * Validate migration SQL for transaction control rules and return executable SQL.
 */
export function validateAndPrepareMigrationSql(filename, sql, rawChecksum) {
  const txStmts = scanTopLevelTransactionStatements(sql);

  if (txStmts.length === 0) {
    return { executableSql: sql, stripped: false };
  }

  const expectedFingerprint = LEGACY_TRANSACTION_WRAPPED_MIGRATIONS.get(filename);
  if (!expectedFingerprint) {
    throw new Error(
      `MIGRATION_UNAUTHORIZED_TRANSACTION_CONTROL ${filename}: ` +
        `Top-level transaction statement forbidden in migrations (${txStmts.map((s) => s.text).join(', ')}).`
    );
  }

  if (rawChecksum !== expectedFingerprint) {
    throw new Error(
      `MIGRATION_LEGACY_FINGERPRINT_MISMATCH ${filename}: ` +
        `Expected ${expectedFingerprint}, got ${rawChecksum}.`
    );
  }

  if (txStmts.length !== 2) {
    throw new Error(
      `MIGRATION_LEGACY_STRUCTURE_INVALID ${filename}: ` +
        `Expected exactly 2 top-level transaction statements (BEGIN and COMMIT), found ${txStmts.length}.`
    );
  }

  const [beginStmt, commitStmt] = txStmts;
  if (!/^BEGIN\b/i.test(beginStmt.text) || !/^COMMIT\b/i.test(commitStmt.text)) {
    throw new Error(
      `MIGRATION_LEGACY_STRUCTURE_INVALID ${filename}: ` +
        `Expected BEGIN followed by COMMIT, found '${beginStmt.text}' and '${commitStmt.text}'.`
    );
  }

  const chars = sql.split('');

  function blankOut(start, end) {
    for (let pos = start; pos < end; pos++) {
      if (chars[pos] !== '\n' && chars[pos] !== '\r') {
        chars[pos] = ' ';
      }
    }
  }

  blankOut(beginStmt.start, beginStmt.end);
  blankOut(commitStmt.start, commitStmt.end);

  const executableSql = chars.join('');

  return { executableSql, stripped: true };
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

function migrationFiles(migrationsDir = MIGRATIONS_DIR) {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((filename) => {
      const bytes = readFileSync(join(migrationsDir, filename));
      const checksum = sha256(bytes);
      const rawSql = bytes.toString('utf8');
      const prepared = validateAndPrepareMigrationSql(filename, rawSql, checksum);
      return {
        filename,
        sql: rawSql,
        executableSql: prepared.executableSql,
        stripped: prepared.stripped,
        checksum,
      };
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

function validateRecordedFilesPresent(rows, byName) {
  for (const row of rows) {
    if (!byName.has(row.filename)) {
      throw new Error(`MIGRATION_FILE_MISSING ${row.filename}`);
    }
  }
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

async function bindLegacyRowsInCurrentTransaction(client, filenames, byName) {
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
}

async function bindLegacyRows(client, filenames, byName) {
  if (filenames.length === 0) return;

  await client.query('BEGIN');
  try {
    await bindLegacyRowsInCurrentTransaction(client, filenames, byName);
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
    // Serialize migration runners for this database.
    await client.query('SELECT pg_advisory_lock($1, $2)', [
      MIGRATION_LOCK_KEY_1,
      MIGRATION_LOCK_KEY_2,
    ]);

    // Fresh databases start checksum-capable.
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
    validateRecordedFilesPresent(initialRows, byName);
    const applied = new Set(initialRows.map((row) => row.filename));

    if (hasChecksums) {
      const legacy = await validateBoundMigrations(client, byName);
      await bindLegacyRows(client, legacy, byName);
    }

    let appliedCount = 0;

    for (const migration of migrations) {
      if (applied.has(migration.filename)) {
        console.log(`  SKIP ${migration.filename} (already applied)`);
        continue;
      }

      console.log(`  APPLY ${migration.filename}`);
      await client.query('BEGIN');
      let metadataAfterApply = hasChecksums;
      try {
        await client.query(migration.executableSql);
        metadataAfterApply = await checksumMetadataAvailable(client);

        if (metadataAfterApply) {
          await client.query(
            `INSERT INTO schema_migrations
               (filename, content_checksum, checksum_origin, checksum_bound_at)
             VALUES ($1, $2, 'APPLIED', now())`,
            [migration.filename, migration.checksum]
          );

          if (!hasChecksums) {
            await bindLegacyRowsInCurrentTransaction(client, [...applied], byName);
          }
        } else {
          await client.query(
            'INSERT INTO schema_migrations (filename) VALUES ($1)',
            [migration.filename]
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  FAIL ${migration.filename}: ${err.message}`);
        throw err;
      }

      applied.add(migration.filename);
      appliedCount++;

      if (!hasChecksums && metadataAfterApply) {
        hasChecksums = true;
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
      console.log('Verified: app role has no DDL permissions.');
    } catch (err) {
      if (err.code === '42704') {
        console.warn('WARN xiaoshuyin_app role not found; run db/init/01-roles.sh first');
      } else {
        throw err;
      }
    }

    console.log(
      `\nMigration complete: ${appliedCount} new, ${migrations.length - appliedCount} previously applied.`
    );
  } finally {
    await client.end();
  }
}

// Run main if invoked directly as CLI
const isDirectCli = process.argv[1] && (
  process.argv[1].endsWith('db-migrate.mjs') ||
  process.argv[1].endsWith('db-migrate.js')
);

if (isDirectCli) {
  main().catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
}
