import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../../apps/server/api/src/auth/session-token.js';

describe('Session Token (T039)', () => {
  const secret = 'test-secret-key-32-chars-long!!!';

  it('sign + verify roundtrip', () => {
    const payload = { accountId: 'a1', epoch: 0, exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = signToken(payload, secret);
    const result = verifyToken(token, secret, 0);
    expect(result).not.toBeNull();
    expect(result!.accountId).toBe('a1');
  });

  it('tampered token is rejected', () => {
    const payload = { accountId: 'a1', epoch: 0, exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = signToken(payload, secret);
    // Tamper with the signature part
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]!.slice(0, -1)}x`;
    expect(verifyToken(tampered, secret, 0)).toBeNull();
  });

  it('expired token is rejected', () => {
    const payload = { accountId: 'a1', epoch: 0, exp: Math.floor(Date.now() / 1000) - 100 };
    const token = signToken(payload, secret);
    expect(verifyToken(token, secret, 0)).toBeNull();
  });

  it('epoch mismatch (logout) is rejected', () => {
    const payload = { accountId: 'a1', epoch: 0, exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = signToken(payload, secret);
    expect(verifyToken(token, secret, 1)).toBeNull();
  });
});
