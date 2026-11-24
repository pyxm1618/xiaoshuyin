/**
 * Session token: HMAC-SHA256 self-signed using node:crypto.
 * Per plan.md D-1: token embeds accountId + epoch + exp.
 * Logout increments session_epoch, invalidating all prior tokens.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TokenPayload {
  accountId: string;
  epoch: number;
  exp: number; // unix timestamp
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseTokenPayload(raw: unknown): TokenPayload | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.accountId !== 'string' || !UUID_REGEX.test(obj.accountId)) {
    return null;
  }

  if (typeof obj.epoch !== 'number' || !Number.isSafeInteger(obj.epoch) || obj.epoch < 0) {
    return null;
  }

  if (typeof obj.exp !== 'number' || !Number.isFinite(obj.exp) || obj.exp <= 0) {
    return null;
  }

  const allowedKeys = new Set(['accountId', 'epoch', 'exp']);
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) return null;
  }

  return {
    accountId: obj.accountId,
    epoch: obj.epoch,
    exp: obj.exp,
  };
}

export function signToken(payload: TokenPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(
  token: string,
  secret: string,
  currentEpoch: number
): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [body, sig] = parts as [string, string];
  const expectedSig = createHmac('sha256', secret).update(body).digest('base64url');

  // timingSafeEqual throws when buffer lengths differ. Malformed, truncated,
  // or extended signatures are ordinary authentication failures, never 500s.
  const suppliedSig = Buffer.from(sig);
  const expectedSigBytes = Buffer.from(expectedSig);
  if (
    suppliedSig.length !== expectedSigBytes.length ||
    !timingSafeEqual(suppliedSig, expectedSigBytes)
  ) {
    return null;
  }

  try {
    const raw = JSON.parse(Buffer.from(body, 'base64url').toString());
    const payload = parseTokenPayload(raw);
    if (!payload) return null;

    // Check expiration
    if (Date.now() / 1000 > payload.exp) return null;

    // Check epoch (logout invalidates); -1 means skip epoch check
    if (currentEpoch !== -1 && payload.epoch !== currentEpoch) return null;

    return payload;
  } catch {
    return null;
  }
}
