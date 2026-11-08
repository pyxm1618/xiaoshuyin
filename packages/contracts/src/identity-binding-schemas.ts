/**
 * Identity binding runtime HTTP contracts (Slice 006).
 *
 * All request objects are strict: undeclared fields are rejected as 422
 * `VALIDATION_ERROR`. No request carries personId / familyId / age / guardian
 * / openid / digest — those are server-side facts only.
 */

import { z } from 'zod';

export const BindingCandidateDecision = z.enum(['AFFIRM', 'REJECT', 'CANCEL']);
export const BindingConfirmerDecision = z.enum(['AFFIRM', 'REJECT']);
export const BindingVisibleState = z.enum(['PENDING', 'COMMITTED', 'TERMINAL']);

export const BindingBootstrapRequest = z.strictObject({
  code: z.string().min(1).max(512),
  invitationToken: z.string().min(1).max(512),
  idempotencyKey: z.string().min(8).max(128),
});

export const BindingCandidateDecisionRequest = z.strictObject({
  decision: BindingCandidateDecision,
  // Frozen OpenAPI: `type: [string, 'null']` + `const: candidate-binding-v1`.
  // AFFIRM still requires the literal value at the route/command layer; null
  // (or omission) for REJECT / CANCEL is accepted by the contract.
  confirmationVersion: z.union([z.literal('candidate-binding-v1'), z.null()]).optional(),
  idempotencyKey: z.string().min(8).max(128),
});

export const BindingConfirmerDecisionRequest = z.strictObject({
  personId: z.string().uuid(),
  decision: BindingConfirmerDecision,
  targetConfirmed: z.boolean(),
  candidateRecognized: z.boolean(),
  confirmationVersion: z.literal('second-party-recognition-v1'),
  idempotencyKey: z.string().min(8).max(128),
});

export const BindingGenericResponse = z.strictObject({
  binding: z.literal('NOT_COMPLETED'),
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