import { describe, it, expect } from 'vitest';
import {
  createContextToken,
  decryptOpenid,
  deriveAesKey,
  deriveIdentityDigest,
  deriveIdentityPepper,
  encryptOpenid,
  hashToken,
} from '../../apps/server/api/src/identity-binding/crypto.js';

const SECRET = 'test-identity-binding-secret-fixture-32chars';

describe('identity binding crypto', () => {
  it('context token is 32 random bytes encoded as base64url', () => {
    const token = createContextToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createContextToken()).not.toBe(token);
  });

  it('DB stores only sha256 hex of the token', () => {
    const token = createContextToken();
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });

  it('HKDF derives two distinct labels, neither equal to the secret', () => {
    const pepper = deriveIdentityPepper(SECRET);
    const aes = deriveAesKey(SECRET);
    expect(pepper).toHaveLength(32);
    expect(aes).toHaveLength(32);
    expect(pepper.equals(aes)).toBe(false);
    expect(pepper.equals(Buffer.from(SECRET))).toBe(false);
  });

  it('identity digest is deterministic and differs per openid', () => {
    expect(deriveIdentityDigest(SECRET, 'openid-a')).toBe(
      deriveIdentityDigest(SECRET, 'openid-a')
    );
    expect(deriveIdentityDigest(SECRET, 'openid-a')).not.toBe(
      deriveIdentityDigest(SECRET, 'openid-b')
    );
    expect(deriveIdentityDigest(SECRET, 'openid-a')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('AES-256-GCM round-trips with AAD = context id; no plaintext openid', () => {
    const encrypted = encryptOpenid(SECRET, 'context-1', 'openid-plain');
    expect(encrypted.nonce).toHaveLength(12);
    expect(encrypted.ciphertext.toString('utf8')).not.toContain('openid-plain');
    expect(decryptOpenid(SECRET, 'context-1', encrypted)).toBe('openid-plain');
  });

  it('decryption fails on wrong AAD / tampered tag', () => {
    const encrypted = encryptOpenid(SECRET, 'context-1', 'openid-plain');
    expect(() => decryptOpenid(SECRET, 'context-2', encrypted)).toThrow();
    const tampered = { ...encrypted, tag: Buffer.from(encrypted.tag) };
    tampered.tag[0] = (tampered.tag[0] ?? 0) ^ 0xff;
    expect(() => decryptOpenid(SECRET, 'context-1', tampered)).toThrow();
  });
});