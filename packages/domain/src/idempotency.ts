/**
 * Idempotency: canonical JSON + sha256 + three-state decision.
 * Per plan.md D-6.3: replay / 409 / execute.
 */

import { createHash } from 'node:crypto';

export type IdempotencyCommandType =
  | 'FAMILY_CREATE' | 'MEMBER_CREATE' | 'MEMBER_UPDATE'
  | 'GUARDIAN_CONSENT_REQUEST' | 'GUARDIAN_CONSENT_GRANT' | 'GUARDIAN_CONSENT_REVOKE';

export type IdempotencyDecision =
  | { action: 'REPLAY'; responseStatus: number; responseBody: unknown }
  | { action: 'MISMATCH' }
  | { action: 'EXECUTE' };

/**
 * Canonical JSON: sorted keys, no whitespace.
 * Same logical payload → same hash regardless of key order.
 */
export function canonicalJson(obj: unknown): string {
  return JSON.stringify(sortKeys(obj));
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

export function hashPayload(payload: unknown): string {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

export function decideIdempotency(
  existing: { requestHash: string; responseStatus: number; responseBody: unknown } | null,
  newHash: string
): IdempotencyDecision {
  if (!existing) return { action: 'EXECUTE' };

  if (existing.requestHash === newHash) {
    return {
      action: 'REPLAY',
      responseStatus: existing.responseStatus,
      responseBody: existing.responseBody,
    };
  }

  return { action: 'MISMATCH' };
}
