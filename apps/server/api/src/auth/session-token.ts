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

  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload;

    // Check expiration
    if (Date.now() / 1000 > payload.exp) return null;

    // Check epoch (logout invalidates); -1 means skip epoch check
    if (currentEpoch !== -1 && payload.epoch !== currentEpoch) return null;

    return payload;
  } catch {
    return null;
  }
}
