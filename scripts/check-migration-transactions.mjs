#!/usr/bin/env node
/**
 * check-migration-transactions.mjs
 *
 * Dedicated governance guard for migration transaction boundaries.
 * Enforces that no migration outside the immutable 8-file legacy whitelist
 * may contain top-level transaction control statements.
 *
 * Usage:
 *   node scripts/check-migration-transactions.mjs
 *   node scripts/check-migration-transactions.mjs --self-test
 */

import { join } from 'node:path';
import {
  DEFAULT_MIGRATIONS_DIR,
  LEGACY_TRANSACTION_WRAPPED_MIGRATIONS,
  validateAndPrepareMigrationSql,
} from './db-migrate.mjs';
import { scanAndValidateMigrations } from './lib/migration-transactions.mjs';

function runSelfTest() {
  console.log('Running check-migration-transactions self-test with adversarial fixtures...');
  let failures = 0;

  function expectAccept(name, filename, sql) {
    try {
      const res = validateAndPrepareMigrationSql(filename, sql, 'any_checksum');
      if (res.stripped) {
        console.error(`Self-test FAIL [${name}]: expected stripped=false`);
        failures++;
      }
    } catch (err) {
      console.error(`Self-test FAIL [${name}]: expected ACCEPT but threw: ${err.message}`);
      failures++;
    }
  }

  function expectReject(name, filename, sql, expectedErrCode = 'MIGRATION_UNAUTHORIZED_TRANSACTION_CONTROL') {
    try {
      validateAndPrepareMigrationSql(filename, sql, 'any_checksum');
      console.error(`Self-test FAIL [${name}]: expected REJECT but passed`);
      failures++;
    } catch (err) {
      if (!err.message.includes(expectedErrCode)) {
        console.error(`Self-test FAIL [${name}]: expected error ${expectedErrCode}, got: ${err.message}`);
        failures++;
      }
    }
  }

  // ─── Adversarial Test Matrix ───
  // Case A — ABORT (BLOCKER-001)
  expectReject('Case A — ABORT', '031_abort.sql', 'CREATE TABLE canary(id int);\nABORT;');

  // Case B — PostgreSQL E string escaping (BLOCKER-002)
  expectReject('Case B — E string hides COMMIT', '031_estring.sql', "SELECT E'it\\'s okay';\nCOMMIT;");

  // Case C — Line comment
  expectAccept('Case C — comment', '031_comment.sql', '-- COMMIT;\nSELECT 1;');

  // Case D — Block comment
  expectAccept('Case D — block comment', '031_block_comment.sql', '/* ROLLBACK; */\nSELECT 1;');

  // Case E — Ordinary quoted string
  expectAccept('Case E — ordinary string', '031_ord_str.sql', "SELECT 'COMMIT;';");

  // Case F — Dollar-quoted PL/pgSQL body
  expectAccept('Case F — dollar quoted PL/pgSQL', '031_dollar.sql', 'DO $$\nBEGIN\n  PERFORM 1;\nEND;\n$$;');

  // Case G — SQL-language BEGIN ATOMIC function body (MEDIUM-001)
  expectAccept(
    'Case G — SQL BEGIN ATOMIC',
    '031_atomic.sql',
    'CREATE FUNCTION f()\nRETURNS integer\nLANGUAGE SQL\nBEGIN ATOMIC\n  SELECT 1;\nEND;'
  );

  // Case H — Unexpected future SAVEPOINT
  expectReject('Case H — SAVEPOINT', '031_savepoint.sql', 'SAVEPOINT x;');

  // Case I — RELEASE SAVEPOINT
  expectReject('Case I — RELEASE SAVEPOINT', '031_release.sql', 'RELEASE SAVEPOINT x;');

  // Case J — ROLLBACK TO SAVEPOINT
  expectReject('Case J — ROLLBACK TO', '031_rollback_to.sql', 'ROLLBACK TO SAVEPOINT x;');

  // Case K — PREPARE TRANSACTION
  expectReject('Case K — PREPARE TRANSACTION', '031_prepare_tx.sql', "PREPARE TRANSACTION 'tx1';");

  // Case L — SET TRANSACTION
  expectReject('Case L — SET TRANSACTION', '031_set_tx.sql', 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');

  // ─── Legacy Whitelist Semantics ───
  // Case M — Authorized legacy migration with exact fingerprint and structure strips cleanly
  try {
    const legacyName = '023_digital_use_review_runtime_authority_reconciled.sql';
    const legacyHash = LEGACY_TRANSACTION_WRAPPED_MIGRATIONS.get(legacyName);
    const legacySql = `BEGIN;\nCREATE TABLE t (id int);\nCOMMIT;`;
    const prepared = validateAndPrepareMigrationSql(legacyName, legacySql, legacyHash);
    if (!prepared.stripped) {
      console.error('Self-test FAIL [Case M]: expected stripped=true');
      failures++;
    }
  } catch (err) {
    console.error('Self-test FAIL [Case M]:', err.message);
    failures++;
  }

  // Case N — Legacy migration with fingerprint mismatch fails closed
  try {
    const legacyName = '023_digital_use_review_runtime_authority_reconciled.sql';
    validateAndPrepareMigrationSql(legacyName, 'BEGIN;\nCREATE TABLE t (id int);\nCOMMIT;', 'tampered_hash');
    console.error('Self-test FAIL [Case N]: expected exception for fingerprint mismatch');
    failures++;
  } catch (err) {
    if (!err.message.includes('MIGRATION_LEGACY_FINGERPRINT_MISMATCH')) {
      console.error('Self-test FAIL [Case N]: unexpected error:', err.message);
      failures++;
    }
  }

  // Case O — Legacy migration with invalid structure (extra BEGIN) fails closed
  try {
    const legacyName = '023_digital_use_review_runtime_authority_reconciled.sql';
    const legacyHash = LEGACY_TRANSACTION_WRAPPED_MIGRATIONS.get(legacyName);
    validateAndPrepareMigrationSql(legacyName, 'BEGIN;\nBEGIN;\nCREATE TABLE t (id int);\nCOMMIT;', legacyHash);
    console.error('Self-test FAIL [Case O]: expected exception for invalid structure');
    failures++;
  } catch (err) {
    if (!err.message.includes('MIGRATION_LEGACY_STRUCTURE_INVALID')) {
      console.error('Self-test FAIL [Case O]: unexpected error:', err.message);
      failures++;
    }
  }

  if (failures > 0) {
    console.error(`check-migration-transactions self-test: FAIL (${failures} failures)`);
    process.exit(1);
  }
  console.log('check-migration-transactions self-test: PASS (15/15 adversarial and legacy fixtures validated)');
}

function main() {
  if (process.argv.includes('--self-test')) {
    runSelfTest();
    return;
  }

  try {
    const results = scanAndValidateMigrations(DEFAULT_MIGRATIONS_DIR);
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
