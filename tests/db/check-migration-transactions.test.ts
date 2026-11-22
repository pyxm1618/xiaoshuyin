/**
 * check-migration-transactions.test.ts
 *
 * Automated verification of the dedicated migration transaction boundary guard
 * including all adversarial test fixtures (Cases A through H).
 */

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MIGRATIONS_DIR,
  LEGACY_TRANSACTION_WRAPPED_MIGRATIONS,
  validateAndPrepareMigrationSql,
} from '../../scripts/db-migrate.mjs';
import { scanAndValidateMigrations } from '../../scripts/lib/migration-transactions.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;

describe('Check Migration Transactions Guard & Adversarial Fixtures', () => {
  it('scripts/check-migration-transactions.mjs --self-test passes with exit code 0', () => {
    const output = execFileSync('node', ['scripts/check-migration-transactions.mjs', '--self-test'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(output).toContain('check-migration-transactions self-test: PASS');
  });

  it('scripts/check-migration-transactions.mjs validates all current 33 migrations in repo', () => {
    const output = execFileSync('node', ['scripts/check-migration-transactions.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(output).toContain('check-migration-transactions: PASS (33 migrations validated, 8 legacy stripped)');
  });

  it('exactly 8 migrations are stripped and match the authoritative whitelist', () => {
    const results = scanAndValidateMigrations(DEFAULT_MIGRATIONS_DIR);
    expect(results.length).toBe(33);

    const stripped = results.filter((r) => r.stripped).map((r) => r.filename);
    expect(stripped.length).toBe(8);

    const expectedWhitelist = Array.from(LEGACY_TRANSACTION_WRAPPED_MIGRATIONS.keys()).sort();
    expect(stripped.sort()).toEqual(expectedWhitelist);
  });

  // Case A — ABORT
  it('rejects ABORT transaction control statement (BLOCKER-001)', () => {
    expect(() => {
      validateAndPrepareMigrationSql('031_abort.sql', 'CREATE TABLE canary(id int);\nABORT;', 'hash');
    }).toThrow(/MIGRATION_UNAUTHORIZED_TRANSACTION_CONTROL/);
  });

  // Case B — PostgreSQL E string
  it('detects top-level COMMIT hidden behind PostgreSQL E string (BLOCKER-002)', () => {
    expect(() => {
      validateAndPrepareMigrationSql('031_estring.sql', "SELECT E'it\\'s okay';\nCOMMIT;", 'hash');
    }).toThrow(/MIGRATION_UNAUTHORIZED_TRANSACTION_CONTROL/);
  });

  // Case C — Line comment
  it('accepts COMMIT inside line comment', () => {
    const res = validateAndPrepareMigrationSql('031_comment.sql', '-- COMMIT;\nSELECT 1;', 'hash');
    expect(res.stripped).toBe(false);
  });

  // Case D — Block comment
  it('accepts ROLLBACK inside block comment', () => {
    const res = validateAndPrepareMigrationSql('031_block.sql', '/* ROLLBACK; */\nSELECT 1;', 'hash');
    expect(res.stripped).toBe(false);
  });

  // Case E — Ordinary string
  it('accepts COMMIT inside ordinary string literal', () => {
    const res = validateAndPrepareMigrationSql('031_str.sql', "SELECT 'COMMIT;';", 'hash');
    expect(res.stripped).toBe(false);
  });

  // Case F — Dollar-quoted PL/pgSQL
  it('accepts BEGIN and END inside dollar-quoted function body', () => {
    const res = validateAndPrepareMigrationSql(
      '031_dollar.sql',
      'DO $$\nBEGIN\n  PERFORM 1;\nEND;\n$$;',
      'hash'
    );
    expect(res.stripped).toBe(false);
  });

  // Case G — SQL BEGIN ATOMIC
  it('accepts SQL-standard BEGIN ATOMIC ... END function body (MEDIUM-001)', () => {
    const res = validateAndPrepareMigrationSql(
      '031_atomic.sql',
      'CREATE FUNCTION f()\nRETURNS integer\nLANGUAGE SQL\nBEGIN ATOMIC\n  SELECT 1;\nEND;',
      'hash'
    );
    expect(res.stripped).toBe(false);
  });

  // Case H — Unexpected SAVEPOINT / RELEASE / ROLLBACK TO
  it('rejects SAVEPOINT and other transaction variants', () => {
    expect(() => {
      validateAndPrepareMigrationSql('031_savepoint.sql', 'SAVEPOINT x;', 'hash');
    }).toThrow(/MIGRATION_UNAUTHORIZED_TRANSACTION_CONTROL/);

    expect(() => {
      validateAndPrepareMigrationSql('031_release.sql', 'RELEASE SAVEPOINT x;', 'hash');
    }).toThrow(/MIGRATION_UNAUTHORIZED_TRANSACTION_CONTROL/);

    expect(() => {
      validateAndPrepareMigrationSql('031_rollback_to.sql', 'ROLLBACK TO SAVEPOINT x;', 'hash');
    }).toThrow(/MIGRATION_UNAUTHORIZED_TRANSACTION_CONTROL/);
  });
});
