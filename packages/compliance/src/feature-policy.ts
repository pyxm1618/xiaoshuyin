/**
 * Slice 10 — Pure deterministic Compliance Feature Policy evaluation.
 *
 * Contract (Frozen Plan §6):
 *   - the pure function receives a validated snapshot plus one captured
 *     evaluation time;
 *   - it performs no DB / network / model / clock read;
 *   - zero or multiple effective policies fail closed;
 *   - applicability is only REQUIRED / NOT_APPLICABLE / UNKNOWN, and UNKNOWN
 *     never means NOT_APPLICABLE;
 *   - person processing composes the existing `assertMinorProcessingAllowed`
 *     truth instead of creating a second age/minor/guardian gate;
 *   - every result carries exact policy provenance.
 */

import { assertMinorProcessingAllowed, type AgeBand, type ComplianceProfile, type ConsentRecord } from './age-gate.js';
import type { ComplianceFeatureDescriptor } from './feature-identity.js';

export const ANTHROPOMORPHIC_APPLICABILITY_VALUES = [
  'REQUIRED',
  'NOT_APPLICABLE',
  'UNKNOWN',
] as const;
export type AnthropomorphicApplicability =
  (typeof ANTHROPOMORPHIC_APPLICABILITY_VALUES)[number];

export const MINOR_ACCESS_RULE_VALUES = ['BASELINE', 'MINORS_BLOCKED'] as const;
export type MinorAccessRule = (typeof MINOR_ACCESS_RULE_VALUES)[number];

export const FEATURE_RULE_VALUES = ['BASELINE', 'REQUIRED'] as const;
export type FeatureRule = (typeof FEATURE_RULE_VALUES)[number];

/**
 * Approved architecture obligation vocabulary. Slice 10 only *returns*
 * obligations; it never executes them.
 */
export const COMPLIANCE_OBLIGATIONS = [
  'REQUIRE_GUARDIAN_CONSENT',
  'REQUIRE_SEPARATE_CONSENT',
  'REQUIRE_MINOR_MODE',
  'REQUIRE_AI_DISCLOSURE',
  'REQUIRE_GENERATED_CONTENT_LABEL',
  'REQUIRE_USAGE_REMINDER',
  'REQUIRE_REGULATORY_EVIDENCE',
] as const;
export type ComplianceObligation = (typeof COMPLIANCE_OBLIGATIONS)[number];

export const COMPLIANCE_REASON_CODES = [
  'COMPLIANCE_FEATURE_UNKNOWN',
  'COMPLIANCE_FEATURE_REVISION_STALE',
  'COMPLIANCE_POLICY_MISSING',
  'COMPLIANCE_POLICY_AMBIGUOUS',
  'COMPLIANCE_POLICY_INVALID',
  'COMPLIANCE_APPLICABILITY_UNKNOWN',
  'COMPLIANCE_PROFILE_MISSING',
  'COMPLIANCE_AGE_UNKNOWN',
  'COMPLIANCE_GUARDIAN_CONSENT_REQUIRED',
  'COMPLIANCE_GUARDIAN_CONSENT_INVALID',
  'COMPLIANCE_FEATURE_BLOCKED',
  'COMPLIANCE_CAPABILITY_UNAVAILABLE',
  'COMPLIANCE_POLICY_STALE',
] as const;
export type ComplianceReasonCode = (typeof COMPLIANCE_REASON_CODES)[number];

/** One immutable published policy row as read by the snapshot loader. */
export interface ComplianceFeaturePolicyRecord {
  readonly policyId: string;
  readonly featureCode: string;
  readonly featureContractRevision: string;
  readonly policyVersion: number;
  readonly anthropomorphicApplicability: AnthropomorphicApplicability;
  readonly minorAccessRule: MinorAccessRule;
  readonly aiDisclosureRule: FeatureRule;
  readonly generatedContentLabelRule: FeatureRule;
  readonly usageReminderRule: FeatureRule;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
}

export interface ComplianceGuardianConsentSnapshot {
  readonly id: string;
  readonly decision: 'GRANTED' | 'REVOKED';
  readonly boundPersonId: string | null;
  readonly noticeHash: string;
  readonly guardianPersonId: string;
  readonly version: number;
}

/** Existing person compliance truth consumed read-only, never duplicated. */
export interface CompliancePersonSnapshot {
  readonly personId: string;
  readonly ageBand: AgeBand;
  readonly minorMode: boolean;
  readonly guardianPersonId: string | null;
  readonly guardianConsent: ComplianceGuardianConsentSnapshot | null;
  readonly verifiedSource: string;
}

export interface ComplianceEvaluationSnapshot {
  readonly feature: ComplianceFeatureDescriptor;
  readonly evaluatedAt: string;
  /**
   * Candidate policy rows for the exact feature identity. The pure evaluator
   * still applies the half-open effective-period rule defensively so corrupted
   * or unfiltered input can never silently select a row.
   */
  readonly candidatePolicies: readonly ComplianceFeaturePolicyRecord[];
  readonly personProcessingRequired: boolean;
  readonly person: CompliancePersonSnapshot | null;
  /** Current notice hash from the existing versioned notice catalog. */
  readonly currentNoticeHash: string | null;
}

export type ComplianceGate = 'ALLOW' | 'BLOCK';

export interface ComplianceEvaluationResult {
  readonly gate: ComplianceGate;
  readonly reasonCode: ComplianceReasonCode | null;
  readonly obligations: readonly ComplianceObligation[];
  readonly featureCode: string;
  readonly featureContractRevision: string;
  readonly policyId: string | null;
  readonly policyVersion: number | null;
  readonly applicability: AnthropomorphicApplicability | null;
  readonly evaluatedAt: string;
  readonly effectiveFrom: string | null;
  readonly effectiveUntil: string | null;
}

const OBLIGATION_ORDER = new Map<ComplianceObligation, number>(
  COMPLIANCE_OBLIGATIONS.map((obligation, index) => [obligation, index])
);

function normalizeObligations(
  obligations: readonly ComplianceObligation[]
): readonly ComplianceObligation[] {
  return [...new Set(obligations)].sort(
    (left, right) => (OBLIGATION_ORDER.get(left) ?? 0) - (OBLIGATION_ORDER.get(right) ?? 0)
  );
}

function isRule(value: unknown): value is FeatureRule {
  return typeof value === 'string' && (FEATURE_RULE_VALUES as readonly string[]).includes(value);
}

function isApplicability(value: unknown): value is AnthropomorphicApplicability {
  return (
    typeof value === 'string' &&
    (ANTHROPOMORPHIC_APPLICABILITY_VALUES as readonly string[]).includes(value)
  );
}

function isMinorAccessRule(value: unknown): value is MinorAccessRule {
  return (
    typeof value === 'string' &&
    (MINOR_ACCESS_RULE_VALUES as readonly string[]).includes(value)
  );
}

function parseTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Defensive row validation. Anything that could not have passed the reviewed
 * migration (including the cross-field contract) is `COMPLIANCE_POLICY_INVALID`.
 */
export function isStructurallyValidPolicyRecord(
  record: ComplianceFeaturePolicyRecord
): boolean {
  if (
    typeof record.policyId !== 'string' ||
    record.policyId.length === 0 ||
    typeof record.featureCode !== 'string' ||
    record.featureCode.length === 0 ||
    typeof record.featureContractRevision !== 'string' ||
    record.featureContractRevision.length === 0 ||
    !Number.isInteger(record.policyVersion) ||
    record.policyVersion < 1
  ) {
    return false;
  }

  if (
    !isApplicability(record.anthropomorphicApplicability) ||
    !isMinorAccessRule(record.minorAccessRule) ||
    !isRule(record.aiDisclosureRule) ||
    !isRule(record.generatedContentLabelRule) ||
    !isRule(record.usageReminderRule)
  ) {
    return false;
  }

  const effectiveFrom = parseTimestamp(record.effectiveFrom);
  if (effectiveFrom === null) return false;
  if (record.effectiveUntil !== null) {
    const effectiveUntil = parseTimestamp(record.effectiveUntil);
    if (effectiveUntil === null || effectiveUntil <= effectiveFrom) return false;
  }

  if (
    record.anthropomorphicApplicability === 'REQUIRED' &&
    (record.aiDisclosureRule !== 'REQUIRED' || record.usageReminderRule !== 'REQUIRED')
  ) {
    return false;
  }

  if (
    record.anthropomorphicApplicability === 'NOT_APPLICABLE' &&
    record.usageReminderRule !== 'BASELINE'
  ) {
    return false;
  }

  return true;
}

function isEffectiveAt(record: ComplianceFeaturePolicyRecord, evaluationMs: number): boolean {
  const effectiveFrom = parseTimestamp(record.effectiveFrom);
  if (effectiveFrom === null) return false;
  const effectiveUntil =
    record.effectiveUntil === null ? Number.POSITIVE_INFINITY : parseTimestamp(record.effectiveUntil);
  if (effectiveUntil === null) return false;
  return effectiveFrom <= evaluationMs && evaluationMs < effectiveUntil;
}

function baseResult(
  snapshot: ComplianceEvaluationSnapshot,
  gate: ComplianceGate,
  reasonCode: ComplianceReasonCode | null,
  obligations: readonly ComplianceObligation[],
  policy: ComplianceFeaturePolicyRecord | null
): ComplianceEvaluationResult {
  return {
    gate,
    reasonCode,
    obligations: normalizeObligations(obligations),
    featureCode: snapshot.feature.featureCode,
    featureContractRevision: snapshot.feature.featureContractRevision,
    policyId: policy?.policyId ?? null,
    policyVersion: policy?.policyVersion ?? null,
    applicability: policy?.anthropomorphicApplicability ?? null,
    evaluatedAt: snapshot.evaluatedAt,
    effectiveFrom: policy?.effectiveFrom ?? null,
    effectiveUntil: policy?.effectiveUntil ?? null,
  };
}

function policyObligations(
  policy: ComplianceFeaturePolicyRecord
): readonly ComplianceObligation[] {
  const obligations: ComplianceObligation[] = [];

  // REQUIRED and NOT_APPLICABLE both honour independently-required AI
  // disclosure / generated-content labelling. NOT_APPLICABLE may never emit
  // the anthropomorphic usage-reminder obligation (enforced by the DB shape).
  if (policy.aiDisclosureRule === 'REQUIRED') {
    obligations.push('REQUIRE_AI_DISCLOSURE');
  }
  if (policy.generatedContentLabelRule === 'REQUIRED') {
    obligations.push('REQUIRE_GENERATED_CONTENT_LABEL');
  }
  if (policy.anthropomorphicApplicability === 'REQUIRED' && policy.usageReminderRule === 'REQUIRED') {
    obligations.push('REQUIRE_USAGE_REMINDER');
  }

  return obligations;
}

function ageGateReasonToComplianceReason(reason: string): ComplianceReasonCode {
  switch (reason) {
    case 'PROFILE_MISSING':
      return 'COMPLIANCE_PROFILE_MISSING';
    case 'AGE_BAND_UNKNOWN':
      return 'COMPLIANCE_AGE_UNKNOWN';
    case 'GUARDIAN_CONSENT_REQUIRED':
      return 'COMPLIANCE_GUARDIAN_CONSENT_REQUIRED';
    case 'GUARDIAN_CONSENT_REVOKED':
    case 'CONSENT_SUBJECT_MISMATCH':
    case 'NOTICE_VERSION_MISMATCH':
      return 'COMPLIANCE_GUARDIAN_CONSENT_INVALID';
    default:
      return 'COMPLIANCE_GUARDIAN_CONSENT_INVALID';
  }
}

function toAgeGateProfile(person: CompliancePersonSnapshot): ComplianceProfile {
  return {
    ageBand: person.ageBand,
    minorMode: person.minorMode,
    guardianPersonId: person.guardianPersonId,
    guardianConsentRecordId: person.guardianConsent?.id ?? null,
    guardianConsentVersion: person.guardianConsent?.version ?? null,
    verifiedSource: person.verifiedSource,
  };
}

function toAgeGateConsent(consent: ComplianceGuardianConsentSnapshot): ConsentRecord {
  return {
    id: consent.id,
    decision: consent.decision,
    boundPersonId: consent.boundPersonId,
    noticeHash: consent.noticeHash,
    guardianPersonId: consent.guardianPersonId,
  };
}

/**
 * Pure compliance decision. Infrastructure failures must never reach this
 * function: they belong to snapshot loading and must propagate there.
 */
export function evaluateCompliance(
  snapshot: ComplianceEvaluationSnapshot
): ComplianceEvaluationResult {
  const evaluationMs = parseTimestamp(snapshot.evaluatedAt);
  if (evaluationMs === null) {
    throw new TypeError('COMPLIANCE_EVALUATION_TIME_INVALID');
  }

  const effectivePolicies = snapshot.candidatePolicies.filter((policy) =>
    isEffectiveAt(policy, evaluationMs)
  );

  if (effectivePolicies.length === 0) {
    return baseResult(snapshot, 'BLOCK', 'COMPLIANCE_POLICY_MISSING', [], null);
  }

  if (effectivePolicies.some((policy) => !isStructurallyValidPolicyRecord(policy))) {
    return baseResult(
      snapshot,
      'BLOCK',
      'COMPLIANCE_POLICY_INVALID',
      [],
      effectivePolicies.length === 1 ? effectivePolicies[0]! : null
    );
  }

  if (effectivePolicies.length > 1) {
    return baseResult(snapshot, 'BLOCK', 'COMPLIANCE_POLICY_AMBIGUOUS', [], null);
  }

  const policy = effectivePolicies[0]!;

  if (
    policy.featureCode !== snapshot.feature.featureCode ||
    policy.featureContractRevision !== snapshot.feature.featureContractRevision
  ) {
    return baseResult(snapshot, 'BLOCK', 'COMPLIANCE_POLICY_INVALID', [], policy);
  }

  if (policy.anthropomorphicApplicability === 'UNKNOWN') {
    return baseResult(
      snapshot,
      'BLOCK',
      'COMPLIANCE_APPLICABILITY_UNKNOWN',
      ['REQUIRE_REGULATORY_EVIDENCE'],
      policy
    );
  }

  const obligations: ComplianceObligation[] = [...policyObligations(policy)];

  if (snapshot.personProcessingRequired) {
    if (snapshot.person === null) {
      return baseResult(
        snapshot,
        'BLOCK',
        'COMPLIANCE_PROFILE_MISSING',
        obligations,
        policy
      );
    }

    const person = snapshot.person;
    const ageGate = assertMinorProcessingAllowed(person.personId, {
      getProfile: () => toAgeGateProfile(person),
      getConsentRecord: () => (person.guardianConsent ? toAgeGateConsent(person.guardianConsent) : null),
      getCurrentNoticeHash: () => snapshot.currentNoticeHash ?? '',
    });

    if (ageGate.decision === 'BLOCK') {
      const reasonCode = ageGateReasonToComplianceReason(ageGate.reason);
      if (
        reasonCode === 'COMPLIANCE_GUARDIAN_CONSENT_REQUIRED' ||
        reasonCode === 'COMPLIANCE_GUARDIAN_CONSENT_INVALID'
      ) {
        obligations.push('REQUIRE_GUARDIAN_CONSENT');
      }
      return baseResult(snapshot, 'BLOCK', reasonCode, obligations, policy);
    }

    if (ageGate.minorMode) {
      obligations.push('REQUIRE_MINOR_MODE');
    }

    if (person.ageBand === 'UNDER_14') {
      obligations.push('REQUIRE_GUARDIAN_CONSENT');
    }

    if (ageGate.minorMode && policy.minorAccessRule === 'MINORS_BLOCKED') {
      return baseResult(snapshot, 'BLOCK', 'COMPLIANCE_FEATURE_BLOCKED', obligations, policy);
    }
  }

  return baseResult(snapshot, 'ALLOW', null, obligations, policy);
}

/**
 * Server-owned consumer capability guard. `supportedObligations` is
 * server-owned consumer configuration and must never be client input.
 *
 * A required obligation that the consuming command cannot satisfy fails closed
 * with `COMPLIANCE_CAPABILITY_UNAVAILABLE`; an existing BLOCK is returned as-is.
 */
export function assertComplianceObligationsSupported(
  result: ComplianceEvaluationResult,
  supportedObligations: readonly ComplianceObligation[]
): ComplianceEvaluationResult {
  if (result.gate === 'BLOCK') return result;

  const supported = new Set<ComplianceObligation>(supportedObligations);
  const unsupported = result.obligations.filter((obligation) => !supported.has(obligation));

  if (unsupported.length === 0) return result;

  return {
    ...result,
    gate: 'BLOCK',
    reasonCode: 'COMPLIANCE_CAPABILITY_UNAVAILABLE',
  };
}