import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

// Run only against a dedicated, disposable CI PostgreSQL database.
const enabled = process.env['E2_ACCOUNT_LOCK_CONCURRENCY_TEST'] === '1';
const suite = enabled ? describe : describe.skip;

suite('Finding #17: Account status lock must block concurrent non-key UPDATE', () => {
  it('holds a FOR SHARE lock until commit; UPDATE status is blocked and then succeeds', async () => {
    const url = process.env['TEST_ADMIN_DATABASE_URL'];
    if (!url) throw new Error('TEST_ADMIN_DATABASE_URL required');
    const target = new URL(url);
    if (!['localhost', '127.0.0.1', '::1'].includes(target.hostname) ||
        target.pathname !== '/xiaoshuyin_test') {
      throw new Error('Lock concurrency test refuses non-local or non-test PostgreSQL');
    }
    const service = readFileSync(
      path.resolve(__dirname, '../../apps/server/api/src/services/intervention-definitions.ts'),
      'utf8'
    );
    expect(service).toContain('SELECT status FROM accounts WHERE id = $1 FOR SHARE');
    expect(service).not.toContain("'SELECT status FROM accounts WHERE id = $1 FOR KEY SHARE'");

    const owner = new Client({ connectionString: url });
    const concurrent = new Client({ connectionString: url });
    const table = 'e2_account_status_lock_ci_probe';
    await owner.connect();
    try {
      await concurrent.connect();
      await owner.query('CREATE TABLE ' + table + ' (id integer PRIMARY KEY, status text NOT NULL)');
      try {
        await owner.query('INSERT INTO ' + table + " VALUES (1, 'ACTIVE')");
        await owner.query('BEGIN');
        await owner.query('SELECT status FROM ' + table + ' WHERE id = 1 FOR SHARE');
        await concurrent.query('BEGIN');
        await concurrent.query("SET LOCAL lock_timeout = '400ms'");
        let lockErrorCode: string | undefined;
        try {
          await concurrent.query("UPDATE " + table + " SET status = 'INACTIVE' WHERE id = 1");
        } catch (err) {
          lockErrorCode = (err as { code?: string }).code;
        }
        expect(lockErrorCode).toBe('55P03');
        await concurrent.query('ROLLBACK');
        await owner.query('COMMIT');
        const updated = await concurrent.query(
          "UPDATE " + table + " SET status = 'INACTIVE' WHERE id = 1 RETURNING status"
        );
        expect(updated.rows[0]?.status).toBe('INACTIVE');
      } finally {
        await owner.query('ROLLBACK').catch(() => undefined);
        await concurrent.query('ROLLBACK').catch(() => undefined);
        await owner.query('DROP TABLE IF EXISTS ' + table);
      }
    } finally {
      await concurrent.end().catch(() => undefined);
      await owner.end().catch(() => undefined);
    }
  });
});
