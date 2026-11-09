/**
 * Identity binding domain — pure types, attempt lifecycle and operation
 * idempotency decisions.
 *
 * Frozen references:
 *   - specs/005-invited-identity-binding-contract/spec.md §5.5
 *   - specs/006-identity-binding-runtime/plan.md D-2 / D-5 / D-11
 *
 * `RETRYABLE` is an operation outcome and is deliberately NOT a member of
 * `BindingAttemptState`.
 */

import { createHash } from 'node:crypto';

export type BindingAttemptState = 'PENDING' | 'COMMITTED' | 'TERMINAL';

export const BINDING_TERMINAL_REASONS = [
  'IDENTITY_CONFLICT',
  'TARGET_ALREADY_BOUND',
  'CANDIDATE_ACCOUNT_BOUND_OTHER_PERSON',
  'MULTI_FAMILY_BLOCK',
  'AGE_BAND_ADULT_UNSUPPORTED',
  'AGE_BAND_UNKNOWN_BLOCKED',
  'GUARDIAN_MISSING',
  'GUARDIAN_CONSENT_INVALID',
  'COMPLIANCE_BLOCKED',
  'INVITATION_TERMINAL',
  'ATTEMPT_EXPIRED',
  'CANDIDATE_REJECTED',
  'CANDIDATE_CANCELLED',
  'WRONG_CONFIRMER',
  'RECOGNITION_REJECTED',
  'CONFIRMER_REJECTED',
  'CONCURRENCY_LOSER',
] as const;

export type BindingTerminalReason = (typeof BINDING_TERMINAL_REASONS)[number];

export type BindingConfirmationKind = 'CANDIDATE' | 'SECOND_PARTY';
export type BindingConfirmerAuthority = 'GUARDIAN' | 'FAMILY_MANAGER';

export const BINDING_OPERATION_COMMANDS = [
  'BOOTSTRAP',
  'CANDIDATE_DECISION',
  'SECOND_PARTY_DECISION',
] as const;

export type BindingOperationCommand = (typeof BINDING_OPERATION_COMMANDS)[number];

export type BindingOperationScopeKind = 'CANDIDATE_CONTEXT' | 'ACCOUNT';

export interface BindingAttemptProjection {
  id: string;
  state: BindingAttemptState;
  terminalReason: BindingTerminalReason | null;
  committedAccountId: string | null;
  createdAt: Date;
  expiresAt: Date;
  settledAt: Date | null;
}

export interface BindingAttemptRow extends BindingAttemptProjection {
  targetPersonId: string;
  targetFamilyId: string;
  invitationParticipationId: string;
  candidateIdentityDigest: string;
}

export interface BindingConfirmationRecord {
  id: string;
  attemptId: string;
  kind: BindingConfirmationKind;
  actorPendingContextId: string | null;
  actorAccountId: string | null;
  actorPersonId: string | null;
  authority: BindingConfirmerAuthority | null;
  recordedAt: Date;
}

// ── Attempt lifecycle ───────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<BindingAttemptState, readonly BindingAttemptState[]> = {
  PENDING: ['COMMITTED', 'TERMINAL'],
  COMMITTED: [],
  TERMINAL: [],
};

export function canTransition(
  from: BindingAttemptState,
  to: BindingAttemptState
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Settled = COMMITTED or TERMINAL. PENDING is the only non-settled state. */
export function isSettled(state: BindingAttemptState): boolean {
  return state !== 'PENDING';
}

export type BindingSettlement =
  | { state: 'COMMITTED'; committedAccountId: string; settledAt: Date }
  | { state: 'TERMINAL'; terminalReason: BindingTerminalReason; settledAt: Date };

/**
 * Pure settlement descriptor. A settled attempt can never transition again;
 * attempting it is a programming error, reported as a thrown error rather than
 * silently changing the outcome.
 */
export function settleAttempt(
  current: BindingAttemptState,
  outcome:
    | { kind: 'COMMIT'; committedAccountId: string; settledAt: Date }
    | { kind: 'TERMINAL'; terminalReason: BindingTerminalReason; settledAt: Date }
): BindingSettlement {
  const next = outcome.kind === 'COMMIT' ? 'COMMITTED' : 'TERMINAL';
  if (!canTransition(current, next)) {
    throw new Error(`ILLEGAL_BINDING_TRANSITION:${current}->${next}`);
  }
  if (outcome.kind === 'COMMIT') {
    return {
      state: 'COMMITTED',
      committedAccountId: outcome.committedAccountId,
      settledAt: outcome.settledAt,
    };
  }
  return {
    state: 'TERMINAL',
    terminalReason: outcome.terminalReason,
    settledAt: outcome.settledAt,
  };
}

/**
 * Expiration materialization: only a PENDING attempt that has reached its
 * expiry becomes TERMINAL / ATTEMPT_EXPIRED. Settled attempts are untouched.
 */
export function materializeExpiration(
  attempt: { state: BindingAttemptState; expiresAt: Date },
  now: Date
): BindingSettlement | null {
  if (attempt.state !== 'PENDING') return null;
  if (now.getTime() < attempt.expiresAt.getTime()) return null;
  return {
    state: 'TERMINAL',
    terminalReason: 'ATTEMPT_EXPIRED',
    settledAt: now,
  };
}

// ── Operation-level idempotency ─────────────────────────────

export type BindingOperationDecision =
  | { action: 'EXECUTE' }
  | { action: 'REPLAY' }
  | { action: 'MISMATCH' };

/**
 * The operation key stores only the request fingerprint. The authoritative
 * attempt state is re-read on replay; the first response is never frozen.
 */
export function decideBindingOperation(
  existing: { requestHash: string } | null,
  newHash: string
): BindingOperationDecision {
  if (!existing) return { action: 'EXECUTE' };
  if (existing.requestHash === newHash) return { action: 'REPLAY' };
  return { action: 'MISMATCH' };
}

/**
 * A new attempt may be created only when the invitation is valid and no live
 * (PENDING) attempt exists for the same triple. A terminal row never blocks a
 * new attempt; the partial unique index enforces only live uniqueness.
 */
export function canCreateNewAttempt(input: {
  invitationValid: boolean;
  liveAttemptExists: boolean;
}): boolean {
  return input.invitationValid && !input.liveAttemptExists;
}

export interface BindingOperationScopeInput {
  commandType: BindingOperationCommand;
  invitationParticipationId?: string | null;
  invitationToken?: string | null;
  candidateIdentityDigest?: string | null;
  contextId?: string | null;
  accountId?: string | null;
}

export interface BindingOperationScope {
  scopeKind: BindingOperationScopeKind;
  scopeKey: string;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Frozen scope derivation (plan D-5.2). `BOOTSTRAP` is stable before an
 * Account exists; an unresolved invitation is represented by the token hash,
 * never by the token itself.
 */
export function computeOperationScope(input: BindingOperationScopeInput): BindingOperationScope {
  switch (input.commandType) {
    case 'BOOTSTRAP': {
      const invitationKey = input.invitationParticipationId
        ? input.invitationParticipationId
        : input.invitationToken
          ? `unresolved:${sha256Hex(input.invitationToken)}`
          : null;
      if (!invitationKey || !input.candidateIdentityDigest) {
        throw new Error('BINDING_OPERATION_SCOPE_INPUT_REQUIRED');
      }
      return {
        scopeKind: 'CANDIDATE_CONTEXT',
        scopeKey: sha256Hex(
          `bootstrap:v1:${invitationKey}:${input.candidateIdentityDigest}`
        ),
      };
    }
    case 'CANDIDATE_DECISION': {
      if (!input.contextId) throw new Error('BINDING_OPERATION_SCOPE_INPUT_REQUIRED');
      return { scopeKind: 'CANDIDATE_CONTEXT', scopeKey: input.contextId };
    }
    case 'SECOND_PARTY_DECISION': {
      if (!input.accountId) throw new Error('BINDING_OPERATION_SCOPE_INPUT_REQUIRED');
      return { scopeKind: 'ACCOUNT', scopeKey: input.accountId };
    }
  }
}

/** Binding to the target Person is the only permitted post-commit identity fact. */
export function toAttemptProjection(row: BindingAttemptRow): BindingAttemptProjection {
  return {
    id: row.id,
    state: row.state,
    terminalReason: row.terminalReason,
    committedAccountId: row.committedAccountId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    settledAt: row.settledAt,
  };
}

export type CandidateBindingStatus = 'NOT_COMPLETED' | 'COMMITTED';

/** Candidate-visible status is binary; no internal reason ever leaks. */
export function toCandidateBindingStatus(
  projection: BindingAttemptProjection | null
): CandidateBindingStatus {
  return projection?.state === 'COMMITTED' ? 'COMMITTED' : 'NOT_COMPLETED';
}

export type ConfirmerVisibleState = 'PENDING' | 'COMMITTED' | 'TERMINAL';

/** Authorized confirmer sees lifecycle state only, never the internal reason. */
export function toConfirmerVisibleState(
  projection: BindingAttemptProjection
): ConfirmerVisibleState {
  return projection.state;
}