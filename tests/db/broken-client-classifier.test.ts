import { describe, it, expect } from 'vitest';
import { isBrokenClientError } from '../../apps/server/api/src/db/tx.js';

describe('Finding #31: Broken DB Client Classifier', () => {
  it.each(['ECONNRESET', 'ETIMEDOUT', 'EPIPE', '08006', '57P01', '25P02'])(
    'recognizes nested cause %s', (code) => {
      expect(isBrokenClientError({ cause: { cause: { code } } })).toBe(true);
      expect(isBrokenClientError({ cause: { errno: code } })).toBe(true);
    }
  );

  it('bounds cyclic and excessively deep cause chains', () => {
    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;
    expect(isBrokenClientError(cyclic)).toBe(false);
    let deep: unknown = { code: 'ECONNRESET' };
    for (let index = 0; index < 32; index++) deep = { cause: deep };
    expect(isBrokenClientError(deep)).toBe(false);
    expect(isBrokenClientError({ cause: { code: '23505' } })).toBe(false);
  });

  it('classifies Node transport errors as broken client connection', () => {
    // ECONNRESET
    expect(isBrokenClientError({ code: 'ECONNRESET' })).toBe(true);
    expect(isBrokenClientError({ errno: 'ECONNRESET' })).toBe(true);
    expect(isBrokenClientError(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }))).toBe(true);

    // ETIMEDOUT
    expect(isBrokenClientError({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isBrokenClientError({ errno: 'ETIMEDOUT' })).toBe(true);
    expect(isBrokenClientError(Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }))).toBe(true);

    // EPIPE
    expect(isBrokenClientError({ code: 'EPIPE' })).toBe(true);
    expect(isBrokenClientError({ errno: 'EPIPE' })).toBe(true);
    expect(isBrokenClientError(Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }))).toBe(true);
  });

  it('preserves existing PostgreSQL connection / fatal classifications', () => {
    // Connection exceptions (08xxx)
    expect(isBrokenClientError({ code: '08006' })).toBe(true);
    expect(isBrokenClientError({ code: '08001' })).toBe(true);
    expect(isBrokenClientError({ code: '08003' })).toBe(true);

    // Admin shutdown (57P01)
    expect(isBrokenClientError({ code: '57P01' })).toBe(true);

    // Current transaction is aborted (25P02 - failed ROLLBACK leaves session unusable)
    expect(isBrokenClientError({ code: '25P02' })).toBe(true);
  });

  it('does NOT classify ordinary SQL / business errors as broken client', () => {
    // Unique violation (23505)
    expect(isBrokenClientError({ code: '23505' })).toBe(false);

    // Foreign key violation (23503)
    expect(isBrokenClientError({ code: '23503' })).toBe(false);

    // Check violation (23514)
    expect(isBrokenClientError({ code: '23514' })).toBe(false);

    // Serialization failure (40001)
    expect(isBrokenClientError({ code: '40001' })).toBe(false);

    // Deadlock detected (40P01)
    expect(isBrokenClientError({ code: '40P01' })).toBe(false);

    // Undefined table / column (42P01)
    expect(isBrokenClientError({ code: '42P01' })).toBe(false);

    // Insufficient privilege (42501)
    expect(isBrokenClientError({ code: '42501' })).toBe(false);

    // Standard business application errors
    expect(isBrokenClientError(new Error('BUSINESS_VALIDATION_FAILED'))).toBe(false);
    expect(isBrokenClientError({ message: 'some error without code' })).toBe(false);
    expect(isBrokenClientError(null)).toBe(false);
    expect(isBrokenClientError(undefined)).toBe(false);
  });
});
