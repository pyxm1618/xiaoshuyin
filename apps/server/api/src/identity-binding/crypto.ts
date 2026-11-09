/**
 * Slice 006 crypto primitives.
 *
 * Frozen properties (plan D-3.3):
 *   - opaque context token: 32 random bytes, base64url
 *   - DB stores sha256(token) only
 *   - identity pepper and AES key are HKDF-SHA256 derivations of
 *     IDENTITY_BINDING_SECRET with distinct labels
 *   - openid at rest: AES-256-GCM, 12-byte nonce, AAD = context id
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export const CONTEXT_TOKEN_BYTES = 32;
export const AES_GCM_NONCE_BYTES = 12;

const IDENTITY_LABEL = 'identity-binding:openid-digest:v1';
const AES_LABEL = 'identity-binding:pending-openid:v1';
const PAIRING_LABEL = 'xiaoshuyin:identity-binding:pairing:v1';

/** Fixed authenticated envelope: 128 payload bytes + 16-byte authenticator. */
export const PAIRING_ENVELOPE_BYTES = 144;
export const PAIRING_CHALLENGE_LENGTH = 192;
export const PAIRING_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{192}$/;

export function createContextToken(): string {
  return randomBytes(CONTEXT_TOKEN_BYTES).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function deriveKey(secret: string, info: string): Buffer {
  return Buffer.from(
    hkdfSync('sha256', Buffer.from(secret, 'utf8'), Buffer.alloc(0), Buffer.from(info, 'utf8'), 32)
  );
}

/** HKDF-derived identity pepper (never the raw secret). */
export function deriveIdentityPepper(secret: string): Buffer {
  return deriveKey(secret, IDENTITY_LABEL);
}

/** HKDF-derived AES-256 key for the pending context openid. */
export function deriveAesKey(secret: string): Buffer {
  return deriveKey(secret, AES_LABEL);
}

/**
 * Stable identity digest: HMAC-SHA256 over the labelled openid. It is the only
 * candidate identity representation stored by the runtime.
 */
export function deriveIdentityDigest(secret: string, openid: string): string {
  const pepper = deriveIdentityPepper(secret);
  return createHmac('sha256', pepper)
    .update(`${IDENTITY_LABEL}:${openid}`)
    .digest('hex');
}

export interface EncryptedOpenid {
  ciphertext: Buffer;
  nonce: Buffer;
  tag: Buffer;
}

export function encryptOpenid(secret: string, contextId: string, openid: string): EncryptedOpenid {
  const key = deriveAesKey(secret);
  const nonce = randomBytes(AES_GCM_NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(contextId, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(openid, 'utf8'), cipher.final()]);
  return { ciphertext, nonce, tag: cipher.getAuthTag() };
}

export function decryptOpenid(
  secret: string,
  contextId: string,
  encrypted: EncryptedOpenid
): string {
  const key = deriveAesKey(secret);
  const decipher = createDecipheriv('aes-256-gcm', key, encrypted.nonce);
  decipher.setAAD(Buffer.from(contextId, 'utf8'));
  decipher.setAuthTag(encrypted.tag);
  return Buffer.concat([
    decipher.update(encrypted.ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
// ── Candidate-presented pairing challenge (D-3.5) ────────────

export interface PairingChallengeFacts {
  contextId: string;
  candidateIdentityDigest: string;
  attemptId: string;
  targetPersonId: string;
  invitationParticipationId: string;
  pairingIssuanceId: string;
  pairingIssuedAt: Date;
  pairingExpiresAt: Date;
}

function uuidToBytes(value: string): Buffer {
  const hex = value.replace(/-/g, '');
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) throw new Error('PAIRING_UUID_INVALID');
  return Buffer.from(hex, 'hex');
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function digestToBytes(value: string): Buffer {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error('PAIRING_DIGEST_INVALID');
  return Buffer.from(value, 'hex');
}

function writeTimestamp(target: Buffer, offset: number, date: Date): void {
  target.writeBigUInt64BE(BigInt(date.getTime()), offset);
}

function readTimestamp(source: Buffer, offset: number): Date {
  return new Date(Number(source.readBigUInt64BE(offset)));
}

function pairingKey(secret: string): Buffer {
  return deriveKey(secret, PAIRING_LABEL);
}

function pairingPayload(facts: PairingChallengeFacts): Buffer {
  const payload = Buffer.alloc(128);
  let offset = 0;
  uuidToBytes(facts.pairingIssuanceId).copy(payload, offset);
  offset += 16;
  digestToBytes(facts.candidateIdentityDigest).copy(payload, offset);
  offset += 32;
  uuidToBytes(facts.contextId).copy(payload, offset);
  offset += 16;
  uuidToBytes(facts.attemptId).copy(payload, offset);
  offset += 16;
  uuidToBytes(facts.targetPersonId).copy(payload, offset);
  offset += 16;
  uuidToBytes(facts.invitationParticipationId).copy(payload, offset);
  offset += 16;
  writeTimestamp(payload, offset, facts.pairingIssuedAt);
  offset += 8;
  writeTimestamp(payload, offset, facts.pairingExpiresAt);
  return payload;
}

function pairingTag(secret: string, payload: Buffer): Buffer {
  return createHmac('sha256', pairingKey(secret))
    .update(payload)
    .digest()
    .subarray(0, 16);
}

/**
 * Deterministic authenticated envelope. Reconstructing the same issuance
 * produces the exact same 192-character representation; rotation changes the
 * issuance id (and expiry), so it produces different bytes.
 */
export function encodePairingChallenge(
  secret: string,
  facts: PairingChallengeFacts
): string {
  const payload = pairingPayload(facts);
  return Buffer.concat([payload, pairingTag(secret, payload)]).toString('base64url');
}

export function isPairingChallengeShape(value: unknown): value is string {
  return typeof value === 'string' && PAIRING_CHALLENGE_PATTERN.test(value);
}

/**
 * Verify the authenticated envelope. Returns null for any structural /
 * authentication / expiry failure. The caller maps every null to the frozen
 * generic 404; no reason is exposed.
 */
export function decodePairingChallenge(
  secret: string,
  challenge: string,
  now: Date = new Date()
): PairingChallengeFacts | null {
  if (!isPairingChallengeShape(challenge)) return null;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(challenge, 'base64url');
  } catch {
    return null;
  }
  if (bytes.length !== PAIRING_ENVELOPE_BYTES) return null;

  const payload = bytes.subarray(0, 128);
  const tag = bytes.subarray(128);
  const expected = pairingTag(secret, payload);
  if (tag.length !== expected.length || !timingSafeEqual(tag, expected)) return null;

  const facts: PairingChallengeFacts = {
    pairingIssuanceId: bytesToUuid(payload.subarray(0, 16)),
    candidateIdentityDigest: payload.subarray(16, 48).toString('hex'),
    contextId: bytesToUuid(payload.subarray(48, 64)),
    attemptId: bytesToUuid(payload.subarray(64, 80)),
    targetPersonId: bytesToUuid(payload.subarray(80, 96)),
    invitationParticipationId: bytesToUuid(payload.subarray(96, 112)),
    pairingIssuedAt: readTimestamp(payload, 112),
    pairingExpiresAt: readTimestamp(payload, 120),
  };
  if (facts.pairingExpiresAt.getTime() <= facts.pairingIssuedAt.getTime()) return null;
  if (now.getTime() >= facts.pairingExpiresAt.getTime()) return null;
  return facts;
}

/**
 * Same fixed-width, same-alphabet material for hidden business failures. It is
 * deliberately not a valid authenticated envelope, so it can never resolve to
 * a live attempt.
 */
export function createDecoyPairingChallenge(): string {
  return randomBytes(PAIRING_ENVELOPE_BYTES).toString('base64url');
}