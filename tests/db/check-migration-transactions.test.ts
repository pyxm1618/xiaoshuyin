/**
 * check-migration-transactions.test.ts
 *
 * Automated verification of the dedicated migration transaction boundary guard
 * including all adversarial test fixtures (Cases A through H).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MIGRATIONS_DIR,
  LEGACY_TRANSACTION_WRAPPED_MIGRATIONS,
  sha256,
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

  it('scripts/check-migration-transactions.mjs validates all current migrations in repo', () => {
    const output = execFileSync('node', ['scripts/check-migration-transactions.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(output).toContain('check-migration-transactions: PASS (41 migrations validated, 8 legacy stripped)');
  });

  it('exactly 8 migrations are stripped and match the authoritative whitelist', () => {
    const results = scanAndValidateMigrations(DEFAULT_MIGRATIONS_DIR);
    expect(results.length).toBe(40);

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

  // ─── Comment Boundary Lexical Whitespace (BLOCKER) ───
  describe('SQL comment boundary preserves lexical whitespace', () => {
    const rejectCases: Array<[string, string]> = [
      ['COMMIT WORK', 'COMMIT/*x*/WORK;'],
      ['ROLLBACK WORK', 'ROLLBACK/*x*/WORK;'],
      ['START TRANSACTION', 'START/*x*/TRANSACTION;'],
      ['SET TRANSACTION', 'SET/*x*/TRANSACTION ISOLATION LEVEL SERIALIZABLE;'],
      ['ROLLBACK TO SAVEPOINT', 'ROLLBACK/*x*/TO SAVEPOINT a;'],
      [
        'PREPARE TRANSACTION',
        "PREPARE/*x*/TRANSACTION 'abc';",
      ],
      ['COMMIT PREPARED', "COMMIT/*x*/PREPARED 'abc';"],
      ['ROLLBACK PREPARED', "ROLLBACK/*x*/PREPARED 'abc';"],
      ['COMMIT WORK split by line comment', 'COMMIT--x\nWORK;'],
    ];

    it.each(rejectCases)('rejects %s when a comment separates the tokens', (_name, sql) => {
      expect(() => validateAndPrepareMigrationSql('031_comment_boundary.sql', sql, 'hash')).toThrow(
        /MIGRATION_UNAUTHORIZED_TRANSACTION_CONTROL/
      );
    });

    it('still accepts a SQL-language BEGIN ATOMIC body separated by a block comment', () => {
      const sql =
        'CREATE FUNCTION f()\nRETURNS integer\nLANGUAGE SQL\nBEGIN/*x*/ATOMIC\n  SELECT 1;\nEND;';
      const res = validateAndPrepareMigrationSql('031_atomic_comment.sql', sql, 'hash');
      expect(res.stripped).toBe(false);
      expect(res.executableSql).toBe(sql);
    });

    it('does not rewrite raw SQL for accepted migrations', () => {
      const sql = '-- COMMIT;\n/* ROLLBACK; */\nCREATE TABLE t (id int);';
      const res = validateAndPrepareMigrationSql('031_comments_only.sql', sql, 'hash');
      expect(res.stripped).toBe(false);
      expect(res.executableSql).toBe(sql);
    });
  });

  // ─── Legacy Fingerprint Validation Ordering (HIGH) ───
  describe('legacy fingerprint validation precedes every early return', () => {
    const legacyName = '023_digital_use_review_runtime_authority_reconciled.sql';
    const expectedHash = LEGACY_TRANSACTION_WRAPPED_MIGRATIONS.get(legacyName)!;

    it('fails on fingerprint when the outer wrapper was deleted from a protected filename', () => {
      expect(() =>
        validateAndPrepareMigrationSql(legacyName, 'CREATE TABLE t (id int);\nSELECT 1;', 'tampered_hash')
      ).toThrow(/MIGRATION_LEGACY_FINGERPRINT_MISMATCH/);
    });

    it('fails on fingerprint for transaction-free protected SQL with a wrong checksum', () => {
      expect(() =>
        validateAndPrepareMigrationSql(legacyName, 'CREATE TABLE t (id int);', 'tampered_hash')
      ).toThrow(/MIGRATION_LEGACY_FINGERPRINT_MISMATCH/);
    });

    it('fails structure when the fingerprint matches but the approved wrapper is absent', () => {
      expect(() =>
        validateAndPrepareMigrationSql(legacyName, 'CREATE TABLE t (id int);', expectedHash)
      ).toThrow(/MIGRATION_LEGACY_STRUCTURE_INVALID/);
    });
  });

  it('binds all 8 legacy migrations to their immutable raw SHA-256 fingerprints', () => {
    expect(LEGACY_TRANSACTION_WRAPPED_MIGRATIONS.size).toBe(8);

    for (const [filename, expectedHash] of LEGACY_TRANSACTION_WRAPPED_MIGRATIONS.entries()) {
      const bytes = readFileSync(join(DEFAULT_MIGRATIONS_DIR, filename));
      expect(sha256(bytes)).toBe(expectedHash);

      const prepared = validateAndPrepareMigrationSql(filename, bytes.toString('utf8'), sha256(bytes));
      expect(prepared.stripped).toBe(true);
    }
  });
});
