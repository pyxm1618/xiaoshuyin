import { EventEmitter } from 'node:events';
import type pg from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { withDrizzleIdentityTransaction, withDrizzleRlsTransaction } from '../../apps/server/api/src/db/drizzle-tx.js';

const identity = { accountId: 'account', personId: 'person', purpose: 'test', familyId: 'family' };

for (const transaction of [withDrizzleIdentityTransaction, withDrizzleRlsTransaction]) {
  describe(transaction.name, () => {
    it.each(['ECONNRESET', '08006', 'ETIMEDOUT', 'EPIPE', '57P01', '25P02', '23505', '23503', '23514', '42501', 'BUSINESS_VALIDATION_FAILED'])('classifies wrapped %s through installed Drizzle', async (code) => {
      const failure = new Error('query failed', { cause: Object.assign(new Error('driver failed'), { code }) });
      const client = Object.assign(new EventEmitter(), {
        query: vi.fn(async (query: { text: string }) => {
          if (query.text.includes('app_account_id')) return { rows: [{ account_id: 'account', person_id: 'person', purpose: 'test' }] };
          if (query.text === 'SELECT fail') throw failure;
          return { rows: [] };
        }),
        release: vi.fn(),
      });
      const pool = { connect: vi.fn(async () => client) } as unknown as pg.Pool;
      await expect(transaction(pool, identity, async (tx) => {
        const { sql } = await import('drizzle-orm');
        await tx.execute(sql.raw('SELECT fail'));
      })).rejects.toMatchObject({ cause: failure });
      expect(pool.connect).toHaveBeenCalledTimes(1);
      expect(client.release).toHaveBeenCalledExactlyOnceWith(['ECONNRESET', '08006', 'ETIMEDOUT', 'EPIPE', '57P01', '25P02'].includes(code));
    });

    it.each(['23505', 'ECONNRESET'])('destroys on real Drizzle rollback failure and preserves original %s request error', async (code) => {
      const original = Object.assign(new Error('request failed'), { code });
      const client = Object.assign(new EventEmitter(), {
        query: vi.fn(async (query: { text: string }) => {
          if (query.text === 'rollback') throw new Error('rollback failed');
          if (query.text.includes('app_account_id')) return { rows: [{ account_id: 'account', person_id: 'person', purpose: 'test' }] };
          return { rows: [] };
        }),
        release: vi.fn(),
      });
      const pool = { connect: vi.fn(async () => client) } as unknown as pg.Pool;
      await expect(transaction(pool, identity, async () => { throw original; })).rejects.toBe(original);
      expect(client.query.mock.calls.some(([query]) => query.text === 'rollback')).toBe(true);
      expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
      expect(pool.connect).toHaveBeenCalledTimes(1);
    });
  });
}
