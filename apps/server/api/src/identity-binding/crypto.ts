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

} from 'node:crypto';

export const CONTEXT_TOKEN_BYTES = 32;
export const AES_GCM_NONCE_BYTES = 12;

const IDENTITY_LABEL = 'identity-binding:openid-digest:v1';
const AES_LABEL = 'identity-binding:pending-openid:v1';
const PAIRING_AEAD_LABEL = 'xiaoshuyin:identity-binding:pairing-aead:v1';
const PAIRING_NONCE_LABEL = 'xiaoshuyin:identity-binding:pairing-nonce:v1';
const PAIRING_DECOY_LABEL = 'xiaoshuyin:identity-binding:pairing-decoy:v1';
const PAIRING_AAD = Buffer.from('xiaoshuyin:identity-binding:pairing-aead:v1', 'utf8');

/**
 * Fixed confidential authenticated envelope (144 bytes total):
 *
 *   nonce(16) || AES-256-GCM ciphertext(112) || tag(16)
 *
 * 144 bytes encode to exactly 192 unpadded base64url characters. No bound
 * business field is externally visible; the nonce is a keyed deterministic
 * derivation over the frozen issuance material and therefore looks random.
 */
export const PAIRING_NONCE_BYTES = 16;
export const PAIRING_PAYLOAD_BYTES = 112;
export const PAIRING_TAG_BYTES = 16;
export const PAIRING_ENVELOPE_BYTES =
  PAIRING_NONCE_BYTES + PAIRING_PAYLOAD_BYTES + PAIRING_TAG_BYTES;
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
//
// Confidentiality + integrity: a deterministic authenticated encryption
// envelope. Only the nonce and the AEAD output are externally visible; every
// bound field (context, attempt, P1, invitation, identity digest, issuance
// times) stays inside the ciphertext. A random decoy has exactly the same
// length, alphabet and externally observable shape.

/** Facts used to ENCODE one issuance (the full issuance id stays private). */
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

/** Server-owned issuance facts for an opaque non-resolving decoy. */
export interface DecoyPairingChallengeFacts {
  contextId: string;
  pairingIssuanceId: string;
  pairingIssuedAt: Date;
  pairingExpiresAt: Date;
}

/** Facts recovered after successful AEAD opening. */
export interface DecodedPairingChallenge {
  contextId: string;
  candidateIdentityDigest: string;
  attemptId: string;
  targetPersonId: string;
  invitationParticipationId: string;
  /**
   * Keyed commitment to the exact issuance. The raw issuance id is NOT carried
   * in the envelope; the verifier recomputes this value from the authoritative
   * persisted issuance row and compares it timing-safely.
   */
  pairingIssuanceNonce: string;
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

/** Independent AEAD key (never the pending-openid key). */
function pairingAeadKey(secret: string): Buffer {
  return deriveKey(secret, PAIRING_AEAD_LABEL);
}

/** Independent nonce-derivation key. */
function pairingNonceKey(secret: string): Buffer {
  return deriveKey(secret, PAIRING_NONCE_LABEL);
}

/** 112-byte plaintext: every bound field except the raw issuance id. */
function pairingPlaintext(facts: PairingChallengeFacts): Buffer {
  const payload = Buffer.alloc(PAIRING_PAYLOAD_BYTES);
  let offset = 0;
  uuidToBytes(facts.contextId).copy(payload, offset);
  offset += 16;
  uuidToBytes(facts.attemptId).copy(payload, offset);
  offset += 16;
  uuidToBytes(facts.targetPersonId).copy(payload, offset);
  offset += 16;
  uuidToBytes(facts.invitationParticipationId).copy(payload, offset);
  offset += 16;
  digestToBytes(facts.candidateIdentityDigest).copy(payload, offset);
  offset += 32;
  writeTimestamp(payload, offset, facts.pairingIssuedAt);
  offset += 8;
  writeTimestamp(payload, offset, facts.pairingExpiresAt);
  return payload;
}

/**
 * 128-byte canonical frozen material. The issuance id makes the derived nonce
 * unique per issuance; every other byte re-binds the nonce to the exact
 * attempt / context / target / invitation / identity / validity window.
 */
function pairingIssuanceMaterial(facts: PairingChallengeFacts): Buffer {
  const material = Buffer.alloc(128);
  let offset = 0;
  uuidToBytes(facts.pairingIssuanceId).copy(material, offset);
  offset += 16;
  uuidToBytes(facts.contextId).copy(material, offset);
  offset += 16;
  uuidToBytes(facts.attemptId).copy(material, offset);
  offset += 16;
  uuidToBytes(facts.targetPersonId).copy(material, offset);
  offset += 16;
  uuidToBytes(facts.invitationParticipationId).copy(material, offset);
  offset += 16;
  digestToBytes(facts.candidateIdentityDigest).copy(material, offset);
  offset += 32;
  writeTimestamp(material, offset, facts.pairingIssuedAt);
  offset += 8;
  writeTimestamp(material, offset, facts.pairingExpiresAt);
  return material;
}

/**
 * Deterministic, per-issuance-unique AEAD nonce. Same frozen issuance material
 * always yields the same nonce, so an exact replay re-encodes to the exact same
 * bytes. A rotated issuance has a fresh random issuance id, so its nonce (and
 * therefore the whole envelope) differs. The nonce is a keyed PRF output and
 * never discloses the issuance id.
 */
export function derivePairingIssuanceNonce(
  secret: string,
  facts: PairingChallengeFacts
): Buffer {
  return createHmac('sha256', pairingNonceKey(secret))
    .update(PAIRING_NONCE_LABEL)
    .update(pairingIssuanceMaterial(facts))
    .digest()
    .subarray(0, PAIRING_NONCE_BYTES);
}

/**
 * Confidential authenticated envelope. Reconstructing the same issuance
 * produces the exact same 192-character representation; rotation changes the
 * issuance id (and expiry), so it produces different bytes.
 */
export function encodePairingChallenge(
  secret: string,
  facts: PairingChallengeFacts
): string {
  const nonce = derivePairingIssuanceNonce(secret, facts);
  const cipher = createCipheriv('aes-256-gcm', pairingAeadKey(secret), nonce);
  cipher.setAAD(PAIRING_AAD);
  const ciphertext = Buffer.concat([
    cipher.update(pairingPlaintext(facts)),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  if (ciphertext.length !== PAIRING_PAYLOAD_BYTES || tag.length !== PAIRING_TAG_BYTES) {
    throw new Error('PAIRING_ENVELOPE_INVALID');
  }
  return Buffer.concat([nonce, ciphertext, tag]).toString('base64url');
}

export function isPairingChallengeShape(value: unknown): value is string {
  return typeof value === 'string' && PAIRING_CHALLENGE_PATTERN.test(value);
}

/**
 * Open the AEAD envelope. Returns null for any structural / authentication /
 * expiry failure. The caller maps every null to the frozen generic 404; no
 * reason is exposed.
 */
export function decodePairingChallenge(
  secret: string,
  challenge: string,
  now: Date = new Date()
): DecodedPairingChallenge | null {
  if (!isPairingChallengeShape(challenge)) return null;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(challenge, 'base64url');
  } catch {
    return null;
  }
  if (bytes.length !== PAIRING_ENVELOPE_BYTES) return null;

  const nonce = bytes.subarray(0, PAIRING_NONCE_BYTES);
  const ciphertext = bytes.subarray(
    PAIRING_NONCE_BYTES,
    PAIRING_NONCE_BYTES + PAIRING_PAYLOAD_BYTES
  );
  const tag = bytes.subarray(PAIRING_NONCE_BYTES + PAIRING_PAYLOAD_BYTES);
  if (tag.length !== PAIRING_TAG_BYTES) return null;

  let payload: Buffer;
  try {
    const decipher = createDecipheriv('aes-256-gcm', pairingAeadKey(secret), nonce);
    decipher.setAAD(PAIRING_AAD);
    decipher.setAuthTag(tag);
    payload = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    return null;
  }
  if (payload.length !== PAIRING_PAYLOAD_BYTES) return null;

  const facts: DecodedPairingChallenge = {
    contextId: bytesToUuid(payload.subarray(0, 16)),
    attemptId: bytesToUuid(payload.subarray(16, 32)),
    targetPersonId: bytesToUuid(payload.subarray(32, 48)),
    invitationParticipationId: bytesToUuid(payload.subarray(48, 64)),
    candidateIdentityDigest: payload.subarray(64, 96).toString('hex'),
    pairingIssuedAt: readTimestamp(payload, 96),
    pairingExpiresAt: readTimestamp(payload, 104),
    pairingIssuanceNonce: nonce.toString('hex'),
  };
  if (facts.pairingExpiresAt.getTime() <= facts.pairingIssuedAt.getTime()) return null;
  if (now.getTime() >= facts.pairingExpiresAt.getTime()) return null;
  return facts;
}

/**
 * Deterministic opaque decoy for one persisted issuance. Real and decoy
 * challenges therefore share the same replay/rotation policy: repeated reads
 * of one live issuance are byte-stable, while a rotated issuance changes the
 * observable challenge. The bytes are a keyed PRF output and intentionally do
 * not form a valid AEAD envelope, so they can never resolve to binding facts.
 */
export function encodeDecoyPairingChallenge(
  secret: string,
  facts: DecoyPairingChallengeFacts
): string {
  const material = Buffer.alloc(48);
  uuidToBytes(facts.contextId).copy(material, 0);
  uuidToBytes(facts.pairingIssuanceId).copy(material, 16);
  writeTimestamp(material, 32, facts.pairingIssuedAt);
  writeTimestamp(material, 40, facts.pairingExpiresAt);

  const key = deriveKey(secret, PAIRING_DECOY_LABEL);
  const chunks: Buffer[] = [];
  for (let counter = 0; counter < 5; counter += 1) {
    chunks.push(
      createHmac('sha256', key)
        .update(PAIRING_DECOY_LABEL)
        .update(Buffer.from([counter]))
        .update(material)
        .digest()
    );
  }
  return Buffer.concat(chunks)
    .subarray(0, PAIRING_ENVELOPE_BYTES)
    .toString('base64url');
}