/**
 * Identity binding runtime HTTP contracts (Slice 006).
 *
 * All request objects are strict: undeclared fields are rejected as 422
 * `VALIDATION_ERROR`. No request carries personId / familyId / age / guardian
 * / openid / digest — those are server-side facts only.
 */

import { z } from 'zod';

export const BindingCandidateDecision = z.enum(['AFFIRM', 'REJECT', 'CANCEL']);
export const BindingVisibleState = z.enum(['PENDING', 'COMMITTED', 'TERMINAL']);

export const BindingBootstrapRequest = z.strictObject({
  code: z.string().min(1).max(512),
  invitationToken: z.string().min(1).max(512),
  idempotencyKey: z.string().min(8).max(128),
});

/**
 * Frozen candidate decision contract (F-06):
 *   AFFIRM  — `confirmationVersion` is REQUIRED and must be the exact literal.
 *   REJECT  — `confirmationVersion` MUST be omitted.
 *   CANCEL  — `confirmationVersion` MUST be omitted.
 *
 * Because every branch is a strict object, a `null` version (or any other
 * property) on REJECT / CANCEL is rejected as 422 instead of silently accepted.
 */
export const BindingCandidateDecisionRequest = z.discriminatedUnion('decision', [
  z.strictObject({
    decision: z.literal('AFFIRM'),
    confirmationVersion: z.literal('candidate-binding-v1'),
    idempotencyKey: z.string().min(8).max(128),
  }),
  z.strictObject({
    decision: z.literal('REJECT'),
    idempotencyKey: z.string().min(8).max(128),
  }),
  z.strictObject({
    decision: z.literal('CANCEL'),
    idempotencyKey: z.string().min(8).max(128),
  }),
]);

export const BindingPairingChallenge = z
  .string()
  .length(192, 'pairingChallenge must be 192 unpadded base64url characters')
  .regex(/^[A-Za-z0-9_-]{192}$/, 'pairingChallenge must be 192 unpadded base64url characters');

/**
 * Second-party decision is a strict decision-discriminated union. The boolean
 * proposition is part of the branch identity: AFFIRM is only true/true and
 * REJECT is only false/false. Mixed booleans, a REJECT with true/true, or a
 * missing / different confirmationVersion are all 422 with zero mutation.
 */
export const BindingConfirmerDecisionRequest = z.discriminatedUnion('decision', [
  z.strictObject({
    personId: z.string().uuid(),
    pairingChallenge: BindingPairingChallenge,
    decision: z.literal('AFFIRM'),
    targetConfirmed: z.literal(true),
    candidateRecognized: z.literal(true),
    confirmationVersion: z.literal('second-party-recognition-v1'),
    idempotencyKey: z.string().min(8).max(128),
  }),
  z.strictObject({
    personId: z.string().uuid(),
    pairingChallenge: BindingPairingChallenge,
    decision: z.literal('REJECT'),
    targetConfirmed: z.literal(false),
    candidateRecognized: z.literal(false),
    confirmationVersion: z.literal('second-party-recognition-v1'),
    idempotencyKey: z.string().min(8).max(128),
  }),
]);

export const BindingGenericResponse = z.strictObject({
  binding: z.literal('NOT_COMPLETED'),
});

export const BindingCandidatePairingResponse = z.strictObject({
  binding: z.literal('NOT_COMPLETED'),
  pairingChallenge: BindingPairingChallenge,
});

export const BindingBootstrapGenericResponse = z.strictObject({
  binding: z.literal('NOT_COMPLETED'),
  pendingContextToken: z.string().min(16).max(256),
});

export const BindingBootstrapReusedResponse = z.strictObject({
  binding: z.literal('REUSED'),
  sessionToken: z.string().min(1),
  account: z.strictObject({ id: z.string().uuid() }),
  person: z.strictObject({ id: z.string().uuid() }),
});

/**
 * Historical settled replay of the same BOOTSTRAP operation key whose
 * authoritative attempt is COMMITTED (plan D-10.2). Strictly only
 * `{ binding: "COMMITTED" }` — no token, attempt, account or person.
 */
export const BindingBootstrapCommittedResponse = z.strictObject({
  binding: z.literal('COMMITTED'),
});

export const BindingStatusResponse = z.strictObject({
  binding: z.enum(['NOT_COMPLETED', 'COMMITTED']),
});

export const BindingSessionCommittedResponse = z.strictObject({
  binding: z.literal('COMMITTED'),
  sessionToken: z.string().min(1),
  account: z.strictObject({ id: z.string().uuid() }),
  person: z.strictObject({ id: z.string().uuid() }),
});

export const BindingPendingListItem = z.strictObject({
  attemptId: z.string().uuid(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const BindingPendingListResponse = z.strictObject({
  attempts: z.array(BindingPendingListItem),
});

export const BindingConfirmerDecisionResponse = z.strictObject({
  state: BindingVisibleState,
});

export const BindingNotFoundError = z.strictObject({
  code: z.literal('BINDING_NOT_FOUND'),
  message: z.string(),
});

export const BindingContextInvalidError = z.strictObject({
  code: z.literal('BINDING_CONTEXT_INVALID'),
  message: z.string(),
});