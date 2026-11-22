#!/usr/bin/env node
/**
 * check-migration-transactions.mjs
 *
 * Dedicated governance guard for migration transaction boundaries.
 * Enforces that no migration outside the immutable 8-file legacy whitelist
 * may contain top-level transaction control statements (BEGIN, COMMIT, ROLLBACK).
 *
 * Usage:
 *   node scripts/check-migration-transactions.mjs
 *   node scripts/check-migration-transactions.mjs --self-test
 */

import { join } from 'node:path';
import {
  LEGACY_TRANSACTION_WRAPPED_MIGRATIONS,
  scanAndValidateMigrations,
  validateAndPrepareMigrationSql,
} from './lib/migration-transactions.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations');

function runSelfTest() {
  console.log('Running check-migration-transactions self-test...');
  let failures = 0;

  // Case 1: normal migration without transaction controls passes
  try {
    const normal = validateAndPrepareMigrationSql('001_initial_schema.sql', 'CREATE TABLE t (id int);', 'abc');
    if (normal.stripped !== false) throw new Error('Expected stripped=false');
  } catch (err) {
    console.error('Self-test Case 1 failed:', err.message);
    failures++;
  }

  // Case 2: authorized legacy migration with correct fingerprint & structure passes and strips
  try {
    const legacyName = '023_digital_use_review_runtime_authority_reconciled.sql';
    const legacyHash = LEGACY_TRANSACTION_WRAPPED_MIGRATIONS.get(legacyName);
    const legacySql = `BEGIN;\nCREATE TABLE t (id int);\nCOMMIT;`;
    const prepared = validateAndPrepareMigrationSql(legacyName, legacySql, legacyHash);
    if (!prepared.stripped) throw new Error('Expected stripped=true');
    if (/BEGIN|COMMIT/i.test(prepared.executableSql.trim())) {
      throw new Error('Expected outer BEGIN/COMMIT to be stripped');
    }
  } catch (err) {
    console.error('Self-test Case 2 failed:', err.message);
    failures++;
  }

  // Case 3: unauthorized migration with BEGIN fails closed
  try {
    validateAndPrepareMigrationSql('031_future_test.sql', 'BEGIN;\nCREATE TABLE t (id int);\nCOMMIT;', 'hash');
    console.error('Self-test Case 3 failed: expected exception for unauthorized migration');
    failures++;
  } catch (err) {
    if (!err.message.includes('MIGRATION_UNAUTHORIZED_TRANSACTION_CONTROL')) {
      console.error('Self-test Case 3 failed: unexpected error message:', err.message);
      failures++;
    }
  }

  // Case 4: legacy migration with fingerprint mismatch fails closed
  try {
    const legacyName = '023_digital_use_review_runtime_authority_reconciled.sql';
    validateAndPrepareMigrationSql(legacyName, 'BEGIN;\nCREATE TABLE t (id int);\nCOMMIT;', 'wrong_hash');
    console.error('Self-test Case 4 failed: expected exception for fingerprint mismatch');
    failures++;
  } catch (err) {
    if (!err.message.includes('MIGRATION_LEGACY_FINGERPRINT_MISMATCH')) {
      console.error('Self-test Case 4 failed: unexpected error message:', err.message);
      failures++;
    }
  }

  // Case 5: legacy migration with multiple BEGINs fails closed
  try {
    const legacyName = '023_digital_use_review_runtime_authority_reconciled.sql';
    const legacyHash = LEGACY_TRANSACTION_WRAPPED_MIGRATIONS.get(legacyName);
    validateAndPrepareMigrationSql(legacyName, 'BEGIN;\nBEGIN;\nCREATE TABLE t (id int);\nCOMMIT;', legacyHash);
    console.error('Self-test Case 5 failed: expected exception for structure invalid');
    failures++;
  } catch (err) {
    if (!err.message.includes('MIGRATION_LEGACY_STRUCTURE_INVALID')) {
      console.error('Self-test Case 5 failed: unexpected error message:', err.message);
      failures++;
    }
  }

  // Case 6: PL/pgSQL block with internal BEGIN/END is allowed
  try {
    const plpgsqlSql = `
      CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM 1;
      END $$;
    `;
    const res = validateAndPrepareMigrationSql('099_fn.sql', plpgsqlSql, 'any');
    if (res.stripped) throw new Error('Expected stripped=false for PL/pgSQL');
  } catch (err) {
    console.error('Self-test Case 6 failed:', err.message);
    failures++;
  }

  if (failures > 0) {
    console.error(`check-migration-transactions self-test: FAIL (${failures} failures)`);
    process.exit(1);
  }
  console.log('check-migration-transactions self-test: PASS (6/6 synthetic fixtures validated)');
}

function main() {
  if (process.argv.includes('--self-test')) {
    runSelfTest();
    return;
  }

  try {
    const results = scanAndValidateMigrations(MIGRATIONS_DIR);
    const strippedCount = results.filter((r) => r.stripped).length;
    console.log(
      `check-migration-transactions: PASS (${results.length} migrations validated, ${strippedCount} legacy stripped)`
    );
  } catch (err) {
    console.error(`check-migration-transactions: FAIL — ${err.message}`);
    process.exit(1);
  }
}

main();
