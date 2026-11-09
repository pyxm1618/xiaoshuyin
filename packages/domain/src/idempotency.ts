/**
 * Idempotency: canonical JSON + sha256 + three-state decision.
 * Per plan.md D-6.3: replay / 409 / execute.
 */

import { createHash } from 'node:crypto';

/**
 * Single source for the command-type vocabulary: the union is derived from
 * this runtime list, so tests can assert registration without a second
 * registry drifting from the type.
 */
export const IDEMPOTENCY_COMMAND_TYPES = [
  'FAMILY_CREATE',
  'MEMBER_CREATE',
  'MEMBER_UPDATE',
  'GUARDIAN_CONSENT_REQUEST',
  'GUARDIAN_CONSENT_GRANT',
  'GUARDIAN_CONSENT_REVOKE',
  'CASE_CREATE',
  'CASE_MESSAGE_CREATE',
] as const;

export type IdempotencyCommandType = (typeof IDEMPOTENCY_COMMAND_TYPES)[number];

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

/**
 * Slice 3 Message canonical request hash.
 *
 * Exactly `{familyId, caseId, body:{content}}` where familyId/caseId come from
 * server-verified context and `content` is the exact stored string (no trim).
 * The `Idempotency-Key` header value is transport only and never hashed.
 */
export function buildCaseMessageRequestHash(input: {
  familyId: string;
  caseId: string;
  content: string;
}): string {
  return hashPayload({
    familyId: input.familyId,
    caseId: input.caseId,
    body: { content: input.content },
  });
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
