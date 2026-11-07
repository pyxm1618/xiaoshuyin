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