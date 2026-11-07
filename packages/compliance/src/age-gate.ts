/**
 * Age gate: assertMinorProcessingAllowed — pure logic, no I/O.
 * Per plan.md D-3.6 order: short-circuit on first BLOCK.
 */

export type AgeBand = 'ADULT' | 'MINOR_14_17' | 'UNDER_14' | 'UNKNOWN';

export interface ComplianceProfile {
  ageBand: AgeBand;
  minorMode: boolean;
  guardianPersonId: string | null;
  guardianConsentRecordId: string | null;
  guardianConsentVersion: number | null;
  verifiedSource: string;
}

export interface ConsentRecord {
  id: string;
  decision: 'GRANTED' | 'REVOKED';
  boundPersonId: string | null;
  noticeHash: string;
  guardianPersonId: string;
}

export type AgeGateResult =
  | { decision: 'ALLOW'; minorMode: boolean }
  | { decision: 'BLOCK'; reason: string };

export interface AgeGateDeps {
  getProfile(personId: string): ComplianceProfile | null;
  getConsentRecord(consentRecordId: string): ConsentRecord | null;
  getCurrentNoticeHash(): string;
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
    // Must have guardian + consent
    if (!profile.guardianPersonId || !profile.guardianConsentRecordId) {
      return { decision: 'BLOCK', reason: 'GUARDIAN_CONSENT_REQUIRED' };
    }

    const consent = deps.getConsentRecord(profile.guardianConsentRecordId);
    if (!consent) {
      return { decision: 'BLOCK', reason: 'GUARDIAN_CONSENT_REQUIRED' };
    }

    if (consent.decision !== 'GRANTED') {
      return { decision: 'BLOCK', reason: 'GUARDIAN_CONSENT_REVOKED' };
    }

    if (consent.boundPersonId !== personId) {
      return { decision: 'BLOCK', reason: 'CONSENT_SUBJECT_MISMATCH' };
    }

    if (consent.noticeHash !== deps.getCurrentNoticeHash()) {
      return { decision: 'BLOCK', reason: 'NOTICE_VERSION_MISMATCH' };
    }

    if (consent.guardianPersonId !== profile.guardianPersonId) {
      return { decision: 'BLOCK', reason: 'GUARDIAN_CONSENT_REQUIRED' };
    }

    return { decision: 'ALLOW', minorMode: true };
  }

  // Fallback (shouldn't reach here with valid AgeBand)
  return { decision: 'BLOCK', reason: 'AGE_BAND_UNKNOWN' };
}
