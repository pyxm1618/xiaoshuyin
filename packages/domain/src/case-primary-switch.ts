/**
 * SwitchPrimaryCase decision — pure domain logic (plan D-5).
 *
 * No I/O, no SQL, no clock. The caller loads `current` (the locked primary, or
 * null) and `target` (the locked requested Case) and passes the client view.
 *
 * Frozen precedence (must not be reordered):
 *   1. target CLOSED            → CASE_CLOSED
 *   2. target SAFETY_HOLD       → SAFETY_HOLD_BLOCKED
 *   3. current SAFETY_HOLD      → SAFETY_HOLD_BLOCKED
 *   4. current === target       → CASE_ALREADY_PRIMARY
 *   5. view mismatch            → STALE_PRIMARY_VIEW
 *   6. otherwise                → ALLOW
 */

import { isSafetyHoldStatus } from './safety/guard.js';

export type CaseStatusView =
  | 'OPEN'
  | 'WAITING'

  | 'LOST_CONTACT'
  | 'SAFETY_HOLD'
  | 'CLOSED';


export interface CaseRowView {
  caseId: string;
  status: CaseStatusView;
  version: number;
}

export interface SwitchPrimaryInput {
  current: CaseRowView | null;
  target: CaseRowView;
  expected: { caseId: string | null; version: number | null };
}

export type SwitchDenyCode =
  | 'CASE_CLOSED'
  | 'SAFETY_HOLD_BLOCKED'
  | 'CASE_ALREADY_PRIMARY'
  | 'STALE_PRIMARY_VIEW';

export type SwitchDecision =
  | { kind: 'DENY'; code: SwitchDenyCode }
  | {
      kind: 'ALLOW';
      demote: null | { caseId: string };
      promote: { caseId: string };
    };

function deny(code: SwitchDenyCode): SwitchDecision {
  return { kind: 'DENY', code };
}

function viewMatches(
  current: CaseRowView | null,
  expected: { caseId: string | null; version: number | null }
): boolean {
  if (current === null) {
    return expected.caseId === null && expected.version === null;
  }
  if (expected.caseId === null || expected.version === null) return false;
  return (
    expected.caseId.toLowerCase() === current.caseId.toLowerCase() &&
    expected.version === current.version
  );
}

export function decideSwitchPrimary(input: SwitchPrimaryInput): SwitchDecision {
  const { current, target, expected } = input;

  if (target.status === 'CLOSED') return deny('CASE_CLOSED');
  // Slice 9: the hold predicate is shared with the reusable ordinary
  // progression guard (`isSafetyHoldStatus`); precedence is unchanged.
  if (isSafetyHoldStatus(target.status)) return deny('SAFETY_HOLD_BLOCKED');
  if (isSafetyHoldStatus(current?.status ?? null)) return deny('SAFETY_HOLD_BLOCKED');
  if (current !== null && current.caseId === target.caseId) {
    return deny('CASE_ALREADY_PRIMARY');
  }
  if (!viewMatches(current, expected)) return deny('STALE_PRIMARY_VIEW');

  return {
    kind: 'ALLOW',
    demote: current === null ? null : { caseId: current.caseId },
    promote: { caseId: target.caseId },
  };
}

/** `case_events` metadata for `CASE_PRIMARY_ASSIGNED` (plan D-9.3). */
export function buildAssignedEventMetadata(input: {
  version: number;
  previousPrimaryCaseId: string | null;
  reason: string;
}) {
  return {
    primary: true,
    version: input.version,
    previousPrimaryCaseId: input.previousPrimaryCaseId,
    reason: input.reason,
  };
}

/** `case_events` metadata for `CASE_PRIMARY_REVOKED` (plan D-9.3). */
export function buildRevokedEventMetadata(input: {
  version: number;
  newPrimaryCaseId: string;
  reason: string;
}) {
  return {
    primary: false,
    version: input.version,
    newPrimaryCaseId: input.newPrimaryCaseId,
    reason: input.reason,
  };
}

/** `business_audit_events` metadata for `CASE_PRIMARY_SWITCHED` (plan D-2.3). */
export function buildSwitchAuditMetadata(input: {
  targetCaseId: string;
  previousPrimaryCaseId: string | null;
  newPrimaryCaseId: string;
  previousVersion: number | null;
  newVersion: number;
  reason: string;
}) {
  return {
    targetCaseId: input.targetCaseId,
    previousPrimaryCaseId: input.previousPrimaryCaseId,
    newPrimaryCaseId: input.newPrimaryCaseId,
    previousVersion: input.previousVersion,
    newVersion: input.newVersion,
    reason: input.reason,
  };
}