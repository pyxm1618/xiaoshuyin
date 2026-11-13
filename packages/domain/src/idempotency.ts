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
  'CASE_SWITCH_PRIMARY',
  'PARTICIPATION_INVITE_CREATE',
  'PARTICIPATION_ACCEPT',
  'PARTICIPATION_DECLINE',
  'PARTICIPATION_WITHDRAW',
  // Slice 8 Problem Formulation Core.
  'CASE_START_ASSESSMENT',
  'PROBLEM_FORMULATION_PRESENT',
  'PROBLEM_FORMULATION_CONFIRM',
  'PROBLEM_FORMULATION_DISPUTE',
  'PROBLEM_FORMULATION_CORRECT',
  'CASE_REASSESS_FROM_FORMULATION',
  // Slice 9 — Safety control foundation. Same store, same canonical hashing and
  // the modern bytea exact-key representation; no second idempotency system.
  'CASE_ENTER_SAFETY_HOLD',
  'CASE_RESOLVE_RISK',
  // Slice 12 uses the existing idempotency store/orchestration. First legal
  // Assessment entry remains CASE_START_ASSESSMENT-owned; only an already-
  // ASSESSMENT resume and node response need new command identities.
  'DIGITAL_USE_ASSESSMENT_RESUME',
  'DIGITAL_USE_NODE_RESPONSE',
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

export function buildParticipationInviteCreateRequestHash(input: {
  familyId: string;
  caseId: string;
  personId: string;
}): string {
  return hashPayload({
    familyId: input.familyId,
    caseId: input.caseId,
    personId: input.personId,
  });
}

export function buildParticipationAcceptRequestHash(input: {
  inviteTokenHash: string;
  participationId: string;
}): string {
  return hashPayload({
    inviteTokenHash: input.inviteTokenHash,
    participationId: input.participationId,
  });
}

export function buildParticipationResourceCommandHash(participationId: string): string {
  return hashPayload({ participationId });
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
