/**
 * Pure binding Gate matrix (Gate 1 / Gate 2).
 *
 * This module MUST NOT import `@xiaoshuyin/compliance`: the app layer reads
 * profile / consent and calls `assertMinorProcessingAllowed`, then passes the
 * result here. `verified_source` is deliberately absent from the input, so it
 * can never participate in guardian authority.
 *
 * Frozen references: 005 §5.4 / §5.7; plan D-8.
 */

import type { BindingTerminalReason } from './identity-binding.js';

export type BindingAgeBand = 'ADULT' | 'MINOR_14_17' | 'UNDER_14' | 'UNKNOWN';

export type BindingGateStage = 'GATE_1' | 'GATE_2';

export type BindingInvitationResolution =
  | {
      status: 'VALID';
      participationId: string;
      targetPersonId: string;
      targetFamilyId: string;
      expiresAt: string;
    }
  | { status: 'TERMINAL_UNUSABLE' };

export type MinorGateResult =
  | { decision: 'ALLOW' }
  | { decision: 'BLOCK'; reason: string }
  | { decision: 'NOT_APPLICABLE' };

export interface BindingGateConfirmer {
  accountId: string;
  personId: string;
}

export interface BindingGateConfirmations {
  candidate: boolean;
  secondParty: boolean;
}

export interface BindingGateInput {
  stage: BindingGateStage;
  /** Request/attempt target; `null` means the invitation did not resolve. */
  targetPersonId: string | null;
  targetFamilyId: string | null;
  targetAgeBand: BindingAgeBand | null;
  guardianPersonId: string | null;
  familyCreatedByPersonId: string | null;
  /** Every current membership of P1. Exactly one, equal to target family. */
  membershipFamilyIds: string[];
  invitation: BindingInvitationResolution;
  /** Existing account of the authenticated candidate, if any. */
  candidateAccountId: string | null;
  /** Person already bound to the candidate account, if any. */
  candidateAccountBoundPersonId: string | null;
  /** Current account_id of P1, if any. */
  targetAccountId: string | null;
  confirmer: BindingGateConfirmer | null;
  minorGate: MinorGateResult;
  /** Gate 2 only. Gate 1 ignores these fields. */
  attemptExpired?: boolean;
  confirmations?: BindingGateConfirmations;
}

export type BindingGateResult =
  | {
      decision: 'PASS';
      ageBand: BindingAgeBand;
      authority: 'GUARDIAN' | 'FAMILY_MANAGER' | null;
    }
  | { decision: 'PENDING'; reason: 'AWAIT_CONFIRMATION' }
  | { decision: 'BLOCK'; reason: BindingTerminalReason };

const PENDING: BindingGateResult = {
  decision: 'PENDING',
  reason: 'AWAIT_CONFIRMATION',
};

function block(reason: BindingTerminalReason): BindingGateResult {
  return { decision: 'BLOCK', reason };
}

function pass(
  ageBand: BindingAgeBand,
  authority: 'GUARDIAN' | 'FAMILY_MANAGER' | null
): BindingGateResult {
  return { decision: 'PASS', ageBand, authority };
}

function minorGateBlocked(gate: MinorGateResult): BindingGateResult {
  const reason = gate.decision === 'BLOCK' ? gate.reason : '';
  if (
    reason === 'GUARDIAN_CONSENT_REQUIRED' ||
    reason === 'GUARDIAN_CONSENT_REVOKED' ||
    reason === 'CONSENT_SUBJECT_MISMATCH' ||
    reason === 'NOTICE_VERSION_MISMATCH' ||
    reason === 'GUARDIAN_MISMATCH'
  ) {
    return block('GUARDIAN_CONSENT_INVALID');
  }
  if (reason === 'GUARDIAN_MISSING') return block('GUARDIAN_MISSING');
  return block('COMPLIANCE_BLOCKED');
}

function confirmerMatches(
  input: BindingGateInput,
  expectedPersonId: string | null
): boolean {
  if (!expectedPersonId) return false;
  if (!input.confirmer) return false;
  return input.confirmer.personId === expectedPersonId;
}

/**
 * Deterministic Gate evaluation. Gate 1 stops before any P1-specific attempt;
 * Gate 2 additionally rechecks confirmations, expiry, authority and conflicts.
 */
export function evaluateBindingGate(input: BindingGateInput): BindingGateResult {
  // 1. Invitation must still be valid and point at the same target.
  if (input.invitation.status !== 'VALID') return block('INVITATION_TERMINAL');
  if (
    input.targetPersonId === null ||
    input.invitation.targetPersonId !== input.targetPersonId
  ) {
    return block('INVITATION_TERMINAL');
  }
  if (
    input.targetFamilyId === null ||
    input.invitation.targetFamilyId !== input.targetFamilyId
  ) {
    return block('INVITATION_TERMINAL');
  }

  // 2. P1 must exist.
  if (input.targetPersonId === null) return block('IDENTITY_CONFLICT');

  // 3. Exactly one membership, equal to the target family (multi-family BLOCK).
  if (
    input.membershipFamilyIds.length !== 1 ||
    input.membershipFamilyIds[0] !== input.targetFamilyId
  ) {
    return block('MULTI_FAMILY_BLOCK');
  }

  // 4. Age / compliance matrix.
  const ageBand = input.targetAgeBand;
  if (ageBand === null) return block('COMPLIANCE_BLOCKED');
  if (ageBand === 'ADULT') return block('AGE_BAND_ADULT_UNSUPPORTED');
  if (ageBand === 'UNKNOWN') return block('AGE_BAND_UNKNOWN_BLOCKED');

  let authority: 'GUARDIAN' | 'FAMILY_MANAGER' | null = null;

  if (ageBand === 'UNDER_14') {
    if (!input.guardianPersonId) return block('GUARDIAN_MISSING');
    if (input.minorGate.decision !== 'ALLOW') return minorGateBlocked(input.minorGate);
    authority = 'GUARDIAN';
  }

  if (ageBand === 'MINOR_14_17') {
    if (input.minorGate.decision !== 'ALLOW') return minorGateBlocked(input.minorGate);
    authority = input.guardianPersonId ? 'GUARDIAN' : 'FAMILY_MANAGER';
  }

  if (input.minorGate.decision === 'BLOCK') return minorGateBlocked(input.minorGate);

  // Identity conflict is always terminal and never PENDING, including the
  // ordinary-login-first case (candidate Account already bound to another
  // Person). 005 §5.5 forbids covering it with PENDING; Gate 1 is the first
  // point where the conflict is known.
  if (
    input.candidateAccountId !== null &&
    input.candidateAccountBoundPersonId !== null &&
    input.candidateAccountBoundPersonId !== input.targetPersonId
  ) {
    return block('IDENTITY_CONFLICT');
  }

  // 5. Gate 1 stops here: no P1-specific confirmation is required yet.
  if (input.stage === 'GATE_1') return pass(ageBand, authority);

  // 6. Gate 2 rechecks expiry, confirmations, authority and conflicts.
  if (input.attemptExpired === true) return block('ATTEMPT_EXPIRED');
  if (!input.confirmations?.candidate) return PENDING;
  if (!input.confirmations?.secondParty) return PENDING;

  if (input.targetAccountId !== null) return block('TARGET_ALREADY_BOUND');
  if (
    input.candidateAccountId !== null &&
    input.candidateAccountBoundPersonId !== null &&
    input.candidateAccountBoundPersonId !== input.targetPersonId
  ) {
    return block('IDENTITY_CONFLICT');
  }

  if (authority === 'GUARDIAN') {
    if (!confirmerMatches(input, input.guardianPersonId)) {
      return block('WRONG_CONFIRMER');
    }
  } else if (authority === 'FAMILY_MANAGER') {
    if (!confirmerMatches(input, input.familyCreatedByPersonId)) {
      return block('WRONG_CONFIRMER');
    }
  }

  return pass(ageBand, authority);
}