/**
 * Age gate: assertMinorProcessingAllowed — pure logic, no I/O.
 * Per plan.md D-3.6 order: short-circuit on first BLOCK.
 *
 * Finding #3 (Guardian Consent Authority): every fact that a guardian-consent
 * decision depends on is treated as authoritative *only* when it is positively
 * present and equal to the expected value. A missing / untyped / `null` field is
 * never read as "not applicable": an absent purpose, unproven evidence, an
 * unknown chain-head flag, a broken profile pointer, a mismatched version, a
 * stale notice or a different policy scope all BLOCK.
 */

export type AgeBand = 'ADULT' | 'MINOR_14_17' | 'UNDER_14' | 'UNKNOWN';

/** The single guardian-consent purpose owned by the Consent owner. */
export const GUARDIAN_CONSENT_PURPOSE = 'UNDER_14_GUARDIAN_CONSENT';

/**
 * The only policy scope the current guardian-consent rows are written under.
 * Versioned alongside the notice catalog; a row recorded under any other policy
 * scope can never satisfy the gate.
 */
export const CURRENT_GUARDIAN_CONSENT_POLICY_VERSION = 'v1';

export interface ComplianceProfile {
  ageBand: AgeBand;
  minorMode: boolean;
  guardianPersonId: string | null;
  guardianConsentRecordId: string | null;
  guardianConsentVersion: number | null;
  verifiedSource: string;
}

/**
 * Authoritative consent facts. Every field except `id` is required: the gate
 * must be able to distinguish "positively valid" from "not proven", so callers
 * cannot omit a column and silently widen the gate.
 */
export interface ConsentRecord {
  id: string;
  /** Monotonic version inside the consent chain. */
  version: number;
  decision: 'GRANTED' | 'REVOKED';
  boundPersonId: string | null;
  noticeHash: string;
  guardianPersonId: string;
  /** Consent purpose; must equal `GUARDIAN_CONSENT_PURPOSE`. */
  purpose: string;
  /** Notice version the guardian was shown; must match the current version. */
  noticeVersion: string | null;
  /** Policy scope the row was recorded under. */
  policyVersion: string | null;
  /** True only when no other row supersedes this one. */
  isChainHead: boolean;
  /** True only when the stored evidence passed the frozen schema. */
  evidenceValid: boolean;
}

export const AGE_GATE_REASON_CODES = [
  'PROFILE_MISSING',
  'AGE_BAND_UNKNOWN',
  'GUARDIAN_CONSENT_REQUIRED',
  'GUARDIAN_CONSENT_INVALID',
  'GUARDIAN_CONSENT_REVOKED',
  'CONSENT_RECORD_MISMATCH',
  'CONSENT_VERSION_MISMATCH',
  'CONSENT_PURPOSE_MISMATCH',
  'CONSENT_EVIDENCE_INVALID',
  'CONSENT_NOT_CURRENT_CHAIN_HEAD',
  'CONSENT_SUBJECT_MISMATCH',
  'NOTICE_VERSION_MISMATCH',
  'POLICY_VERSION_MISMATCH',
] as const;
export type AgeGateReason = (typeof AGE_GATE_REASON_CODES)[number];

export type AgeGateResult =
  | { decision: 'ALLOW'; minorMode: boolean }
  | { decision: 'BLOCK'; reason: AgeGateReason };

/**
 * The age gate keeps granular internal reasons for diagnostics, but the frozen
 * HTTP error vocabulary is unchanged: a consent that is not positively valid is
 * still reported as GUARDIAN_CONSENT_REQUIRED. Callers that turn a gate result
 * into an HTTP error must pass through this mapping.
 */
export function ageGatePublicReasonCode(reason: AgeGateReason): string {
  switch (reason) {
    case 'CONSENT_RECORD_MISMATCH':
    case 'CONSENT_VERSION_MISMATCH':
    case 'CONSENT_PURPOSE_MISMATCH':
    case 'CONSENT_EVIDENCE_INVALID':
    case 'CONSENT_NOT_CURRENT_CHAIN_HEAD':
    case 'POLICY_VERSION_MISMATCH':
      return 'GUARDIAN_CONSENT_REQUIRED';
    default:
      return reason;
  }
}

export interface AgeGateDeps {
  getProfile(personId: string): ComplianceProfile | null;
  getConsentRecord(consentRecordId: string): ConsentRecord | null;
  getCurrentNoticeHash(): string;
  getCurrentNoticeVersion(): string;
  getCurrentPolicyVersion(): string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function assertMinorProcessingAllowed(
  personId: string,
  deps: AgeGateDeps
): AgeGateResult {
  // 1. Profile missing → BLOCK
  const profile = deps.getProfile(personId);
  if (!profile) {
    return { decision: 'BLOCK', reason: 'PROFILE_MISSING' };
  }

  const { ageBand } = profile;

  // 2. UNKNOWN → BLOCK
  if (ageBand === 'UNKNOWN') {
    return { decision: 'BLOCK', reason: 'AGE_BAND_UNKNOWN' };
  }

  // 3. ADULT → ALLOW
  if (ageBand === 'ADULT') {
    return { decision: 'ALLOW', minorMode: false };
  }

  // 4. MINOR_14_17 → ALLOW (minorMode = true)
  if (ageBand === 'MINOR_14_17') {
    return { decision: 'ALLOW', minorMode: true };
  }

  // 5. UNDER_14 → consent checks
  if (ageBand === 'UNDER_14') {
    // The profile must positively point at a guardian, a consent record and the
    // exact consent version it observed. A null pointer is never "no consent
    // needed".
    if (
      !isNonEmptyString(profile.guardianPersonId) ||
      !isNonEmptyString(profile.guardianConsentRecordId) ||
      profile.guardianConsentVersion === null
    ) {
      return { decision: 'BLOCK', reason: 'GUARDIAN_CONSENT_REQUIRED' };
    }

    const consent = deps.getConsentRecord(profile.guardianConsentRecordId);
    if (!consent) {
      return { decision: 'BLOCK', reason: 'GUARDIAN_CONSENT_REQUIRED' };
    }

    // Profile pointer must be the exact record the gate was asked about.
    if (!isNonEmptyString(consent.id) || consent.id !== profile.guardianConsentRecordId) {
      return { decision: 'BLOCK', reason: 'CONSENT_RECORD_MISMATCH' };
    }

    // Profile-recorded version must equal the consent row version. A stale
    // profile pointer is a different consent than the one displayed/accepted.
    if (
      typeof consent.version !== 'number' ||
      !Number.isInteger(consent.version) ||
      consent.version !== profile.guardianConsentVersion
    ) {
      return { decision: 'BLOCK', reason: 'CONSENT_VERSION_MISMATCH' };
    }

    // Purpose: missing or any other purpose fails closed. Supplemental truth
    // can never satisfy a guardian gate.
    if (consent.purpose !== GUARDIAN_CONSENT_PURPOSE) {
      return { decision: 'BLOCK', reason: 'CONSENT_PURPOSE_MISMATCH' };
    }

    // Evidence: only positively validated evidence passes. `false`, `null` and
    // any non-boolean shape are all invalid.
    if (consent.evidenceValid !== true) {
      return { decision: 'BLOCK', reason: 'CONSENT_EVIDENCE_INVALID' };
    }

    // Chain head: only an explicit `true` is current. Superseded rows and rows
    // whose chain-head state is unknown fail closed.
    if (consent.isChainHead !== true) {
      return { decision: 'BLOCK', reason: 'CONSENT_NOT_CURRENT_CHAIN_HEAD' };
    }

    if (consent.decision !== 'GRANTED') {
      return { decision: 'BLOCK', reason: 'GUARDIAN_CONSENT_REVOKED' };
    }

    // Subject: the consent must be bound to this exact Person.
    if (consent.boundPersonId === null || consent.boundPersonId !== personId) {
      return { decision: 'BLOCK', reason: 'CONSENT_SUBJECT_MISMATCH' };
    }

    // Notice: hash AND version must both be the current catalog identity.
    if (consent.noticeHash !== deps.getCurrentNoticeHash()) {
      return { decision: 'BLOCK', reason: 'NOTICE_VERSION_MISMATCH' };
    }
    if (consent.noticeVersion !== deps.getCurrentNoticeVersion()) {
      return { decision: 'BLOCK', reason: 'NOTICE_VERSION_MISMATCH' };
    }

    // Policy / scope: the row must be recorded under the current policy scope.
    if (consent.policyVersion !== deps.getCurrentPolicyVersion()) {
      return { decision: 'BLOCK', reason: 'POLICY_VERSION_MISMATCH' };
    }

    // Guardian: the consent's guardian must be the profile's guardian.
    if (consent.guardianPersonId !== profile.guardianPersonId) {
      return { decision: 'BLOCK', reason: 'GUARDIAN_CONSENT_REQUIRED' };
    }

    return { decision: 'ALLOW', minorMode: true };
  }

  // Fallback (shouldn't reach here with valid AgeBand)
  return { decision: 'BLOCK', reason: 'AGE_BAND_UNKNOWN' };
}
