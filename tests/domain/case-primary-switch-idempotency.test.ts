/**
 * T732 — `acquireIdempotencySlot()` five-state behaviour (plan D-7.5 / R-14).
 *
 * A controlled fake `tx` drives the real reserve/read helpers. The slot
 * acquisition is bounded to exactly two reserve attempts: a concurrent
 * reservation that rolls back and leaves no visible row must be retried once,
 * then reported as CONTENTION rather than looping forever.
 */

import { describe, it, expect } from 'vitest';
import type pg from 'pg';
import { acquireIdempotencySlot } from '../../packages/domain/src/cases.js';

interface FakeRow {
  response_status: number;
  response_body: unknown;
  request_hash: string;
}

function fakeTx(script: { reserve: boolean[]; rows: (FakeRow | null)[] }) {
  let reserveCalls = 0;
  let selectCalls = 0;
  const tx = {
    query: async (sql: string) => {
      if (sql.includes('INSERT INTO idempotency_keys')) {
        const owned = script.reserve[reserveCalls] ?? false;
        reserveCalls += 1;
        return { rows: owned ? [{ id: 'row-1' }] : [], rowCount: owned ? 1 : 0 };
      }
      if (sql.includes('SELECT response_status')) {
        const row = script.rows[selectCalls] ?? null;
        selectCalls += 1;
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as pg.PoolClient;
  return { tx, counts: () => ({ reserveCalls, selectCalls }) };
}

const INPUT = {
  actorAccountId: 'acc-1',
  commandType: 'CASE_SWITCH_PRIMARY',
  keyBytes: Buffer.from('switch-key', 'utf16le'),
  requestHash: 'a'.repeat(64),
};

describe('acquireIdempotencySlot (T732)', () => {
  it('OWNED when the reservation insert returns a row', async () => {
    const { tx, counts } = fakeTx({ reserve: [true], rows: [] });
    await expect(acquireIdempotencySlot(tx, INPUT)).resolves.toEqual({ kind: 'OWNED' });
    expect(counts()).toEqual({ reserveCalls: 1, selectCalls: 0 });
  });

  it('REPLAY returns the stored status and body unchanged', async () => {
    const { tx } = fakeTx({
      reserve: [false],
      rows: [
        {
          response_status: 200,
          response_body: { primary: { id: 'case-1' }, previousPrimary: null },
          request_hash: INPUT.requestHash,
        },
      ],
    });
    await expect(acquireIdempotencySlot(tx, INPUT)).resolves.toEqual({
      kind: 'REPLAY',
      status: 200,
      body: { primary: { id: 'case-1' }, previousPrimary: null },
    });
  });

  it('MISMATCH when the stored request hash differs', async () => {
    const { tx } = fakeTx({
      reserve: [false],
      rows: [{ response_status: 200, response_body: {}, request_hash: 'b'.repeat(64) }],
    });
    await expect(acquireIdempotencySlot(tx, INPUT)).resolves.toEqual({ kind: 'MISMATCH' });
  });

  it('POISONED when a committed placeholder was never completed', async () => {
    const { tx } = fakeTx({
      reserve: [false],
      rows: [{ response_status: 0, response_body: {}, request_hash: INPUT.requestHash }],
    });
    await expect(acquireIdempotencySlot(tx, INPUT)).resolves.toEqual({ kind: 'POISONED' });
  });

  it('CONTENTION after exactly two failed reserves with no visible row', async () => {
    const { tx, counts } = fakeTx({ reserve: [false, false], rows: [null, null] });
    await expect(acquireIdempotencySlot(tx, INPUT)).resolves.toEqual({ kind: 'CONTENTION' });
    expect(counts().reserveCalls).toBe(2);
  });

  it('retries once when the first reserve lost to a rolled-back peer', async () => {
    const { tx, counts } = fakeTx({ reserve: [false, true], rows: [null, null] });
    await expect(acquireIdempotencySlot(tx, INPUT)).resolves.toEqual({ kind: 'OWNED' });
    expect(counts().reserveCalls).toBe(2);
  });

  it('never swallows a unique violation as a business result', async () => {
    const tx = {
      query: async (sql: string) => {
        if (sql.includes('INSERT INTO idempotency_keys')) {
          throw Object.assign(new Error('duplicate key'), { code: '23505' });
        }
        return { rows: [], rowCount: 0 };
      },
    } as unknown as pg.PoolClient;
    await expect(acquireIdempotencySlot(tx, INPUT)).rejects.toThrow('duplicate key');
  });
});