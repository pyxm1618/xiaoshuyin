import { describe, it, expect, vi } from 'vitest';
import type pg from 'pg';
import { EventEmitter } from 'node:events';
import {
  withTransactionClient,
  withBindingContextTransaction,
  withBindingBootstrapTransaction,
  withBindingTargetTransaction,
  withBindingGateTransaction,
  withBindingCommitTransaction,
  withBindingAttemptTransaction,
} from '../../apps/server/api/src/db/tx.js';

interface MockClient extends EventEmitter {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

function createMockPool(): { pool: pg.Pool; client: MockClient } {
  const client: MockClient = Object.assign(new EventEmitter(), {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  });

  const pool = {
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as pg.Pool;

  return { pool, client };
}

describe('Finding #18: Identity Binding Transaction Wrappers Broken Client Protection', () => {
  it.each(['ECONNRESET', '08006', 'ETIMEDOUT', 'EPIPE', '57P01', '25P02', '23505', '23503', '23514', '42501', 'BUSINESS_VALIDATION_FAILED'])('classifies nested raw failure %s', async (code) => {
    const { pool, client } = createMockPool();
    const failure = new Error('operation failed', { cause: { cause: { code } } });
    await expect(withTransactionClient(pool, async () => { throw failure; })).rejects.toBe(failure);
    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledExactlyOnceWith(['ECONNRESET', '08006', 'ETIMEDOUT', 'EPIPE', '57P01', '25P02'].includes(code));
  });

  it('normal success releases client healthy exactly once', async () => {
    const { pool, client } = createMockPool();

    const result = await withBindingContextTransaction(
      pool,
      { tokenHash: 'token-123' },
      async (_tx) => 'success-context'
    );

    expect(result).toBe('success-context');
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(false);
  });

  it('ordinary business failure + rollback succeeds releases client healthy', async () => {
    const { pool, client } = createMockPool();
    const businessError = new Error('BUSINESS_CONFLICT');

    await expect(
      withBindingContextTransaction(pool, { tokenHash: 'token-123' }, async () => {
        throw businessError;
      })
    ).rejects.toThrow('BUSINESS_CONFLICT');

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(false);
  });

  it('Node transport error (ECONNRESET) marks client broken and calls release(true)', async () => {
    const { pool, client } = createMockPool();
    const netError = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });

    await expect(
      withBindingContextTransaction(pool, { tokenHash: 'token-123' }, async () => {
        throw netError;
      })
    ).rejects.toThrow('read ECONNRESET');

    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('Node transport error (ETIMEDOUT) marks client broken and calls release(true)', async () => {
    const { pool, client } = createMockPool();
    const timeoutError = Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' });

    await expect(
      withBindingBootstrapTransaction(
        pool,
        { contextHash: 'ctx', identityDigest: 'id' },
        async () => {
          throw timeoutError;
        }
      )
    ).rejects.toThrow('connect ETIMEDOUT');

    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('Node transport error (EPIPE) marks client broken and calls release(true)', async () => {
    const { pool, client } = createMockPool();
    const pipeError = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });

    await expect(
      withBindingTargetTransaction(
        pool,
        { targetPersonId: 'p-1' },
        async () => {
          throw pipeError;
        }
      )
    ).rejects.toThrow('write EPIPE');

    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('original operation fails and rollback also fails: marks client broken and preserves original error', async () => {
    const { pool, client } = createMockPool();
    const originalError = new Error('ORIGINAL_FAILURE');
    client.query.mockImplementation((sql: string) => {
      if (sql === 'ROLLBACK') return Promise.reject(new Error('ROLLBACK_FAILED_SOCKET_CLOSED'));
      return Promise.resolve({ rows: [] });
    });

    await expect(
      withBindingGateTransaction(
        pool,
        { targetPersonId: 'p-1' },
        async () => {
          throw originalError;
        }
      )
    ).rejects.toThrow('ORIGINAL_FAILURE');

    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('EventEmitter error on checked-out client marks client broken', async () => {
    const { pool, client } = createMockPool();

    await expect(
      withBindingCommitTransaction(
        pool,
        { attemptId: 'att-1', targetPersonId: 'p-1', targetFamilyId: 'f-1' },
        async () => {
          client.emit('error', new Error('async client crash'));
          throw new Error('OPERATION_ABORT');
        }
      )
    ).rejects.toThrow('OPERATION_ABORT');

    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('withBindingContextTransaction commits scrub cleanup when bindingContextScrubbed is true', async () => {
    const { pool, client } = createMockPool();
    const scrubError = Object.assign(new Error('CONTEXT_EXPIRED_SCRUBBED'), {
      bindingContextScrubbed: true,
    });

    await expect(
      withBindingContextTransaction(pool, { tokenHash: 'token-123' }, async () => {
        throw scrubError;
      })
    ).rejects.toThrow('CONTEXT_EXPIRED_SCRUBBED');

    // M-03: Scrub cleanup commits rather than rolls back
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(false);
  });

  it('withBindingContextTransaction marks client broken if scrub COMMIT itself fails', async () => {
    const { pool, client } = createMockPool();
    const scrubError = Object.assign(new Error('CONTEXT_EXPIRED_SCRUBBED'), {
      bindingContextScrubbed: true,
    });
    client.query.mockImplementation((sql: string) => {
      if (sql === 'COMMIT') return Promise.reject(new Error('COMMIT_NETWORK_DROPPED'));
      return Promise.resolve({ rows: [] });
    });

    await expect(
      withBindingContextTransaction(pool, { tokenHash: 'token-123' }, async () => {
        throw scrubError;
      })
    ).rejects.toThrow('CONTEXT_EXPIRED_SCRUBBED');

    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('withBindingAttemptTransaction delegates correctly to transaction wrapper with broken protection', async () => {
    const { pool, client } = createMockPool();
    const netError = Object.assign(new Error('ECONNRESET failure'), { code: 'ECONNRESET' });

    await expect(
      withBindingAttemptTransaction(
        pool,
        {
          attemptId: 'att-1',
          identityDigest: 'digest',
          invitationId: 'inv-1',
          actorAccountId: 'acc-1',
        },
        async () => {
          throw netError;
        }
      )
    ).rejects.toThrow('ECONNRESET failure');

    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
  });
});
