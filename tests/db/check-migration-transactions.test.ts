/**
 * check-migration-transactions.test.ts
 *
 * Automated verification of the dedicated migration transaction boundary guard.
 */

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LEGACY_TRANSACTION_WRAPPED_MIGRATIONS,
  scanAndValidateMigrations,
  validateAndPrepareMigrationSql,
} from '../../scripts/lib/migration-transactions.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations');

describe('Check Migration Transactions Guard', () => {
  it('scripts/check-migration-transactions.mjs --self-test passes with exit code 0', () => {
    const output = execFileSync('node', ['scripts/check-migration-transactions.mjs', '--self-test'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(output).toContain('check-migration-transactions self-test: PASS');
  });

  it('scripts/check-migration-transactions.mjs validates all current migrations in repo', () => {
    const output = execFileSync('node', ['scripts/check-migration-transactions.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(output).toContain('check-migration-transactions: PASS (33 migrations validated, 8 legacy stripped)');
  });

  it('exactly 8 migrations are stripped and match the authoritative whitelist', () => {
    const results = scanAndValidateMigrations(MIGRATIONS_DIR);
    expect(results.length).toBe(33);

    const stripped = results.filter((r) => r.stripped).map((r) => r.filename);
    expect(stripped.length).toBe(8);

    const expectedWhitelist = Array.from(LEGACY_TRANSACTION_WRAPPED_MIGRATIONS.keys()).sort();
    expect(stripped.sort()).toEqual(expectedWhitelist);
  });

  it('fails closed when an unwhitelisted file has top-level transaction control', () => {
    expect(() => {
      validateAndPrepareMigrationSql('999_bad.sql', 'BEGIN;\nCREATE TABLE t (id int);\nCOMMIT;', 'hash');
    }).toThrow(/MIGRATION_UNAUTHORIZED_TRANSACTION_CONTROL/);
  });
});
