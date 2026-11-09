import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createContextToken,
  createDecoyPairingChallenge,
  decodePairingChallenge,
  decryptOpenid,
  deriveAesKey,
  deriveIdentityDigest,
  deriveIdentityPepper,
  encodePairingChallenge,
  encryptOpenid,
  hashToken,
  isPairingChallengeShape,
  type PairingChallengeFacts,
} from '../../apps/server/api/src/identity-binding/crypto.js';

const SECRET = 'test-identity-binding-secret-fixture-32chars';

function facts(overrides: Partial<PairingChallengeFacts> = {}): PairingChallengeFacts {
  const now = new Date();
  return {
    contextId: randomUUID(),
    candidateIdentityDigest: deriveIdentityDigest(SECRET, 'openid-a'),
    attemptId: randomUUID(),
    targetPersonId: randomUUID(),
    invitationParticipationId: randomUUID(),
    pairingIssuanceId: randomUUID(),
    pairingIssuedAt: now,
    pairingExpiresAt: new Date(now.getTime() + 300_000),
    ...overrides,
  };
}

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

  it('pairing challenge is exactly 192 unpadded base64url characters', () => {
    const challenge = encodePairingChallenge(SECRET, facts());
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{192}$/);
    expect(challenge).toHaveLength(192);
    expect(isPairingChallengeShape(challenge)).toBe(true);
    expect(challenge).not.toContain('openid');
    expect(challenge).not.toContain('AFFIRM');
  });

  it('same issuance deterministically reconstructs the exact same bytes', () => {
    const input = facts();
    const a = encodePairingChallenge(SECRET, input);
    const b = encodePairingChallenge(SECRET, input);
    expect(b).toBe(a);
    expect(decodePairingChallenge(SECRET, a)?.attemptId).toBe(input.attemptId);
  });

  it('rotation (new issuance id / expiry) produces different bytes', () => {
    const base = facts();
    const rotated = {
      ...base,
      pairingIssuanceId: randomUUID(),
      pairingIssuedAt: new Date(base.pairingIssuedAt.getTime() + 1),
      pairingExpiresAt: new Date(base.pairingExpiresAt.getTime() + 1),
    };
    expect(encodePairingChallenge(SECRET, rotated)).not.toBe(
      encodePairingChallenge(SECRET, base)
    );
    // The old bytes are no longer the current issuance because the caller
    // compares the decoded issuance facts with the persisted current issuance.
    expect(decodePairingChallenge(SECRET, encodePairingChallenge(SECRET, base))).not.toBeNull();
  });

  it('tamper / wrong binding / wrong secret / expiry all fail closed', () => {
    const input = facts();
    const challenge = encodePairingChallenge(SECRET, input);
    const bytes = Buffer.from(challenge, 'base64url');
    bytes[20] ^= 0xff;
    expect(decodePairingChallenge(SECRET, bytes.toString('base64url'))).toBeNull();
    expect(decodePairingChallenge('different-secret-value-32-characters-long', challenge)).toBeNull();

    const expired = facts({
      pairingIssuedAt: new Date(Date.now() - 600_000),
      pairingExpiresAt: new Date(Date.now() - 300_000),
    });
    expect(decodePairingChallenge(SECRET, encodePairingChallenge(SECRET, expired))).toBeNull();
  });

  it('decoy has the same external representation but never resolves', () => {
    const decoy = createDecoyPairingChallenge();
    expect(decoy).toMatch(/^[A-Za-z0-9_-]{192}$/);
    expect(decodePairingChallenge(SECRET, decoy)).toBeNull();
  });
});