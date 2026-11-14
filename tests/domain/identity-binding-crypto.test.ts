import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  PAIRING_ENVELOPE_BYTES,
  createContextToken,
  createDecoyPairingChallenge,
  decodePairingChallenge,
  decryptOpenid,
  deriveAesKey,
  deriveIdentityDigest,
  deriveIdentityPepper,
  derivePairingIssuanceNonce,
  encodeDecoyPairingChallenge,
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

function fixedFacts(): PairingChallengeFacts {
  return facts({
    contextId: '018f3a56-7b0c-7d21-9f3e-1a2b3c4d5e6f',
    attemptId: '018f3a57-1234-7abc-8def-0123456789ab',
    targetPersonId: '018f3a58-2345-7bcd-8ef0-123456789abc',
    invitationParticipationId: '018f3a59-3456-7cde-9f01-23456789abcd',
    pairingIssuanceId: '018f3a5a-4567-7def-a012-3456789abcde',
    pairingIssuedAt: new Date('2026-11-09T10:00:00.000Z'),
    pairingExpiresAt: new Date('2026-11-09T10:05:00.000Z'),
  });
}

/**
 * The pre-fix envelope wrote the 128-byte structured payload in the clear. A
 * current epoch-millisecond timestamp occupied bytes 112..119 and its high
 * bytes were always zero. This predicate therefore reliably identified a real
 * issuance without the secret.
 */
function legacyStructuredPlaintextDistinguisher(bytes: Buffer): boolean {
  return (
    bytes.length === PAIRING_ENVELOPE_BYTES &&
    bytes[112] === 0x00 &&
    bytes[113] === 0x00 &&
    bytes[114] === 0x00 &&
    bytes[115] === 0x00
  );
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

  it('REM2-005: one decoy issuance is stable and rotation changes it', () => {
    const base = fixedFacts();
    const decoyFacts = {
      contextId: base.contextId,
      pairingIssuanceId: base.pairingIssuanceId,
      pairingIssuedAt: base.pairingIssuedAt,
      pairingExpiresAt: base.pairingExpiresAt,
    };
    const first = encodeDecoyPairingChallenge(SECRET, decoyFacts);
    const replay = encodeDecoyPairingChallenge(SECRET, decoyFacts);
    const rotated = encodeDecoyPairingChallenge(SECRET, {
      ...decoyFacts,
      pairingIssuanceId: randomUUID(),
    });

    expect(replay).toBe(first);
    expect(rotated).not.toBe(first);
    for (const challenge of [first, rotated]) {
      expect(challenge).toMatch(/^[A-Za-z0-9_-]{192}$/);
      expect(Buffer.from(challenge, 'base64url')).toHaveLength(PAIRING_ENVELOPE_BYTES);
      expect(decodePairingChallenge(SECRET, challenge)).toBeNull();
    }
  });

  it('decoy has the same external representation but never resolves', () => {
    const decoy = createDecoyPairingChallenge();
    expect(decoy).toMatch(/^[A-Za-z0-9_-]{192}$/);
    expect(decodePairingChallenge(SECRET, decoy)).toBeNull();
  });

  // ── Confidentiality / AEAD direct proofs (PR #16 review Finding 1) ──

  it('base64url decode exposes no UUID, digest or timestamp plaintext', () => {
    const input = fixedFacts();
    const bytes = Buffer.from(encodePairingChallenge(SECRET, input), 'base64url');
    expect(bytes).toHaveLength(PAIRING_ENVELOPE_BYTES);

    const hex = bytes.toString('hex');
    for (const uuid of [
      input.pairingIssuanceId,
      input.contextId,
      input.attemptId,
      input.targetPersonId,
      input.invitationParticipationId,
    ]) {
      expect(hex).not.toContain(uuid.replace(/-/g, ''));
      expect(bytes.toString('utf8')).not.toContain(uuid);
    }
    expect(hex).not.toContain(input.candidateIdentityDigest);

    const issued = Buffer.alloc(8);
    issued.writeBigUInt64BE(BigInt(input.pairingIssuedAt.getTime()));
    const expires = Buffer.alloc(8);
    expires.writeBigUInt64BE(BigInt(input.pairingExpiresAt.getTime()));
    expect(hex).not.toContain(issued.toString('hex'));
    expect(hex).not.toContain(expires.toString('hex'));
  });

  it('valid AEAD opening recovers every bound field exactly', () => {
    const input = fixedFacts();
    const decoded = decodePairingChallenge(
      SECRET,
      encodePairingChallenge(SECRET, input),
      new Date('2026-11-09T10:01:00.000Z')
    );
    expect(decoded).not.toBeNull();
    expect(decoded).toMatchObject({
      contextId: input.contextId,
      candidateIdentityDigest: input.candidateIdentityDigest,
      attemptId: input.attemptId,
      targetPersonId: input.targetPersonId,
      invitationParticipationId: input.invitationParticipationId,
      pairingIssuanceNonce: derivePairingIssuanceNonce(SECRET, input).toString('hex'),
    });
    expect(decoded?.pairingIssuedAt.getTime()).toBe(input.pairingIssuedAt.getTime());
    expect(decoded?.pairingExpiresAt.getTime()).toBe(input.pairingExpiresAt.getTime());
  });

  it('tampering the nonce, ciphertext or tag all fail authentication', () => {
    const challenge = encodePairingChallenge(SECRET, fixedFacts());
    const original = Buffer.from(challenge, 'base64url');
    const now = new Date('2026-11-09T10:01:00.000Z');
    for (const offset of [0, 15, 16, 60, 127, 128, 143]) {
      const tampered = Buffer.from(original);
      tampered[offset] = (tampered[offset] ?? 0) ^ 0xff;
      expect(decodePairingChallenge(SECRET, tampered.toString('base64url'), now)).toBeNull();
    }
  });

  it('decoy and valid envelopes share length, alphabet and decoded byte shape', () => {
    const valid = encodePairingChallenge(SECRET, fixedFacts());
    const decoy = createDecoyPairingChallenge();

    for (const value of [valid, decoy]) {
      expect(value).toHaveLength(192);
      expect(value).toMatch(/^[A-Za-z0-9_-]{192}$/);
      expect(isPairingChallengeShape(value)).toBe(true);
      expect(Buffer.from(value, 'base64url')).toHaveLength(PAIRING_ENVELOPE_BYTES);
    }
    expect(decodePairingChallenge(SECRET, decoy)).toBeNull();
    expect(
      decodePairingChallenge(SECRET, valid, new Date('2026-11-09T10:01:00.000Z'))
    ).not.toBeNull();
  });

  it('the legacy structured-plaintext distinguisher no longer separates valid from decoy', () => {
    const validBytes = Buffer.from(
      encodePairingChallenge(SECRET, fixedFacts()),
      'base64url'
    );
    // The old clear-text payload was always detectable; the AEAD envelope is
    // uniformly random in the same positions.
    expect(legacyStructuredPlaintextDistinguisher(validBytes)).toBe(false);

    const decoys = Array.from({ length: 8 }, () =>
      Buffer.from(createDecoyPairingChallenge(), 'base64url')
    );
    for (const decoyBytes of decoys) {
      expect(legacyStructuredPlaintextDistinguisher(decoyBytes)).toBe(false);
    }
  });
});
