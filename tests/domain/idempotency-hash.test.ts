import { describe, it, expect } from 'vitest';
import { hashPayload, canonicalJson, decideIdempotency } from '../../packages/domain/src/idempotency.js';

describe('Idempotency (T040)', () => {
  it('same payload different key order → same hash', () => {
    const h1 = hashPayload({ a: 1, b: 2 });
    const h2 = hashPayload({ b: 2, a: 1 });
    expect(h1).toBe(h2);
  });

  it('different payload → different hash', () => {
    const h1 = hashPayload({ a: 1 });
    const h2 = hashPayload({ a: 2 });
    expect(h1).not.toBe(h2);
  });

  it('canonical JSON sorts nested keys', () => {
    const j = canonicalJson({ z: { b: 1, a: 2 }, a: 3 });
    expect(j).toBe('{"a":3,"z":{"a":2,"b":1}}');
  });

  it('no existing → EXECUTE', () => {
    expect(decideIdempotency(null, 'hash1')).toEqual({ action: 'EXECUTE' });
  });

  it('same hash → REPLAY', () => {
    const r = decideIdempotency(
      { requestHash: 'hash1', responseStatus: 201, responseBody: { id: 'x' } },
      'hash1'
    );
    expect(r.action).toBe('REPLAY');
    if (r.action === 'REPLAY') {
      expect(r.responseStatus).toBe(201);
    }
  });

  it('different hash → MISMATCH', () => {
    const r = decideIdempotency(
      { requestHash: 'hash1', responseStatus: 201, responseBody: {} },
      'hash2'
    );
    expect(r).toEqual({ action: 'MISMATCH' });
  });
});
