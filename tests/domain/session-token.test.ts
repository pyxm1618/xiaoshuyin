import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { signToken, verifyToken } from '../../apps/server/api/src/auth/session-token.js';

describe('Session Token (T039 / Finding #30)', () => {
  const secret = 'test-secret-key-32-chars-long!!!';
  const validAccountId = '018f3a2b-c4d5-7e8f-9a0b-1c2d3e4f5a6b';

  function signRaw(payload: unknown, secretKey: string): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', secretKey).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  it('sign + verify roundtrip with valid UUID accountId', () => {
    const payload = { accountId: validAccountId, epoch: 0, exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = signToken(payload, secret);
    const result = verifyToken(token, secret, 0);
    expect(result).not.toBeNull();
    expect(result!.accountId).toBe(validAccountId);
    expect(result!.epoch).toBe(0);
  });

  it('tampered token is rejected', () => {
    const payload = { accountId: validAccountId, epoch: 0, exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = signToken(payload, secret);
    // Tamper with the signature part
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]!.slice(0, -1)}x`;
    expect(verifyToken(tampered, secret, 0)).toBeNull();
  });

  it('malformed signature variants are stable authentication failures', () => {
    const payload = { accountId: validAccountId, epoch: 0, exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = signToken(payload, secret);
    const [body, sig] = token.split('.') as [string, string];
    const invalid = [
      `${body}.${sig.slice(0, -8)}`,
      `${body}.${sig}abcdefgh`,
      `${body}.!!!!`,
      `${body}..${sig}`,
      token.replace('.', ''),
      'garbage-token',
      '.',
    ];

    for (const candidate of invalid) {
      expect(() => verifyToken(candidate, secret, 0)).not.toThrow();
      expect(verifyToken(candidate, secret, 0)).toBeNull();
    }
  });

  it('expired token is rejected', () => {
    const payload = { accountId: validAccountId, epoch: 0, exp: Math.floor(Date.now() / 1000) - 100 };
    const token = signToken(payload, secret);
    expect(verifyToken(token, secret, 0)).toBeNull();
  });

  it('epoch mismatch (logout) is rejected', () => {
    const payload = { accountId: validAccountId, epoch: 0, exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = signToken(payload, secret);
    expect(verifyToken(token, secret, 1)).toBeNull();
  });

  // ── Finding #30 Runtime Schema Validation Tests ─────────────────────────────
  it('rejects validly signed token with malformed accountId (non-UUID)', () => {
    const malformedPayloads = [
      { accountId: 'a1', epoch: 0, exp: Math.floor(Date.now() / 1000) + 3600 },
      { accountId: '', epoch: 0, exp: Math.floor(Date.now() / 1000) + 3600 },
      { accountId: 'not-a-uuid-at-all', epoch: 0, exp: Math.floor(Date.now() / 1000) + 3600 },
      { accountId: 12345, epoch: 0, exp: Math.floor(Date.now() / 1000) + 3600 },
      { accountId: null, epoch: 0, exp: Math.floor(Date.now() / 1000) + 3600 },
    ];
    for (const p of malformedPayloads) {
      const token = signRaw(p, secret);
      expect(verifyToken(token, secret, 0)).toBeNull();
    }
  });

  it('rejects validly signed token with non-numeric / string / NaN exp', () => {
    const invalidExpPayloads = [
      { accountId: validAccountId, epoch: 0, exp: '3600' },
      { accountId: validAccountId, epoch: 0, exp: Number.NaN },
      { accountId: validAccountId, epoch: 0, exp: Number.POSITIVE_INFINITY },
      { accountId: validAccountId, epoch: 0, exp: -100 },
      { accountId: validAccountId, epoch: 0, exp: 0 },
      { accountId: validAccountId, epoch: 0 }, // missing exp
    ];
    for (const p of invalidExpPayloads) {
      const token = signRaw(p, secret);
      expect(verifyToken(token, secret, 0)).toBeNull();
    }
  });

  it('rejects validly signed token with missing or invalid epoch', () => {
    const invalidEpochPayloads = [
      { accountId: validAccountId, exp: Math.floor(Date.now() / 1000) + 3600 }, // missing epoch
      { accountId: validAccountId, epoch: '0', exp: Math.floor(Date.now() / 1000) + 3600 },
      { accountId: validAccountId, epoch: -1, exp: Math.floor(Date.now() / 1000) + 3600 },
      { accountId: validAccountId, epoch: 1.5, exp: Math.floor(Date.now() / 1000) + 3600 },
      { accountId: validAccountId, epoch: Number.NaN, exp: Math.floor(Date.now() / 1000) + 3600 },
    ];
    for (const p of invalidEpochPayloads) {
      const token = signRaw(p, secret);
      expect(verifyToken(token, secret, 0)).toBeNull();
    }
  });

  it('rejects validly signed token with extra unexpected properties or non-object shape', () => {
    const extraFieldsPayload = {
      accountId: validAccountId,
      epoch: 0,
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: 'ADMIN',
    };
    expect(verifyToken(signRaw(extraFieldsPayload, secret), secret, 0)).toBeNull();

    expect(verifyToken(signRaw('just-a-string', secret), secret, 0)).toBeNull();
    expect(verifyToken(signRaw([validAccountId, 0, 3600], secret), secret, 0)).toBeNull();
    expect(verifyToken(signRaw(null, secret), secret, 0)).toBeNull();
  });
});
