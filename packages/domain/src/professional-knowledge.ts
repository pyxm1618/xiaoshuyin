/**
 * Slice 17 — Professional Knowledge Foundation domain contract.
 *
 * This module owns Knowledge identity/version/content metadata only. It consumes
 * Staff authority, professional qualification, Professional Approval, Scene
 * package binding, and optional InterventionDefinition references as external
 * facts. It never manufactures any of those authorities.
 */
import { createHash } from 'node:crypto';

export const PROFESSIONAL_KNOWLEDGE_LIFECYCLE_STATUSES = [
  'CANDIDATE',
  'PUBLISHED',
  'SUPERSEDED',
  'RETIRED',
  'EXPIRED',
] as const;

export const PROFESSIONAL_KNOWLEDGE_REVIEW_STATES = [
  'PENDING',
  'CURRENT',
  'NEEDS_REVIEW',
] as const;

export const PROFESSIONAL_KNOWLEDGE_VALIDITY_STATES = [
  'UNKNOWN',
  'VALID',
  'INVALID',
] as const;

export type ProfessionalKnowledgeLifecycleStatus =
  (typeof PROFESSIONAL_KNOWLEDGE_LIFECYCLE_STATUSES)[number];
export type ProfessionalKnowledgeReviewState =
  (typeof PROFESSIONAL_KNOWLEDGE_REVIEW_STATES)[number];
export type ProfessionalKnowledgeValidityState =
  (typeof PROFESSIONAL_KNOWLEDGE_VALIDITY_STATES)[number];

export type ProfessionalKnowledgeAgeBand =
  | 'ADULT'
  | 'MINOR_14_17'
  | 'UNDER_14';

export type ProfessionalKnowledgeRiskLevel =
  | 'LOW'
  | 'MODERATE'
  | 'ELEVATED';

export interface ProfessionalKnowledgeSourceSnapshot {
  readonly sourceRef: string;
  readonly sourceVersion: string;
  readonly sourceHash: string;
  readonly locator: string | null;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export interface ProfessionalContentPackageRef {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly contentHash: string;
}

export interface ProfessionalKnowledgeInterventionRef {
  readonly definitionId: string;
  readonly definitionVersion: number;
  readonly contentHash: string;
}

export interface ProfessionalKnowledgeScopeMetadata {
  readonly product: 'V1';
  readonly sceneCode: string;
  readonly scenePackageVersion: string;
  readonly stages: readonly string[];
  readonly ageBands: readonly ProfessionalKnowledgeAgeBand[];
  readonly applicability: readonly string[];
  readonly exclusions: readonly string[];
  readonly riskLevels: readonly ProfessionalKnowledgeRiskLevel[];
  readonly locale: string;
  readonly professionalContentPackageRef?: ProfessionalContentPackageRef | null;
  readonly interventionDefinitionRef?: ProfessionalKnowledgeInterventionRef | null;
}

export interface ProfessionalKnowledgeVersionSnapshot {
  readonly id: string;
  readonly knowledgeId: string;
  readonly knowledgeKey: string;
  readonly semanticVersion: string;
  readonly revision: number;
  readonly lifecycleStatus: ProfessionalKnowledgeLifecycleStatus;
  readonly reviewState: ProfessionalKnowledgeReviewState;
  readonly validityState: ProfessionalKnowledgeValidityState;
  readonly content: Readonly<Record<string, unknown>>;
  readonly contentHash: string;
  readonly sourceSetHash: string;
  readonly sources: readonly ProfessionalKnowledgeSourceSnapshot[];
  readonly scope: ProfessionalKnowledgeScopeMetadata;
  readonly releasedAt: string | null;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;
const SEMANTIC_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;

function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('NON_FINITE_NUMBER');
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(',')}}`;
  }
  throw new Error('UNSUPPORTED_CANONICAL_VALUE');
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function exactNonEmpty(value: string): boolean {
  return value.trim().length > 0 && value === value.trim();
}

function normalizedUnique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

export function hashProfessionalKnowledgeContent(
  content: Readonly<Record<string, unknown>>
): string {
  return sha256(canonicalize(content));
}

export function hashProfessionalKnowledgeSourceSet(
  sources: readonly ProfessionalKnowledgeSourceSnapshot[]
): string {
  const normalized = sources
    .map((source) => ({
      sourceRef: source.sourceRef.trim(),
      sourceVersion: source.sourceVersion.trim(),
      sourceHash: source.sourceHash,
      locator: source.locator === null ? null : source.locator.trim(),
      metadata: source.metadata,
    }))
    .sort((a, b) =>
      [a.sourceRef, a.sourceVersion, a.sourceHash, a.locator ?? '']
        .join('\u0000')
        .localeCompare(
          [b.sourceRef, b.sourceVersion, b.sourceHash, b.locator ?? ''].join('\u0000')
        )
    );
  return sha256(canonicalize(normalized));
}

/**
 * Exact Professional Approval semantic identity. This deliberately does not
 * change contentHash (body-only) or sourceSetHash (provenance-only) semantics.
 * It binds the complete release-affecting Knowledge identity and scope.
 */
export function hashProfessionalKnowledgeApprovalBinding(
  value: ProfessionalKnowledgeVersionSnapshot
): string {
  const scope = value.scope;
  return sha256(canonicalize({
    knowledgeId: value.knowledgeId,
    knowledgeKey: value.knowledgeKey,
    semanticVersion: value.semanticVersion,
    contentHash: value.contentHash,
    sourceSetHash: value.sourceSetHash,
    scope: {
      product: scope.product,
      sceneCode: scope.sceneCode,
      scenePackageVersion: scope.scenePackageVersion,
      stages: normalizedUnique(scope.stages),
      ageBands: normalizedUnique(scope.ageBands),
      applicability: normalizedUnique(scope.applicability),
      exclusions: normalizedUnique(scope.exclusions),
      riskLevels: normalizedUnique(scope.riskLevels),
      locale: scope.locale,
      professionalContentPackageRef: scope.professionalContentPackageRef ?? null,
      interventionDefinitionRef: scope.interventionDefinitionRef ?? null,
    },
  }));
}

export type ProfessionalKnowledgeContractIssue =
  | 'IDENTITY_INVALID'
  | 'SEMANTIC_VERSION_INVALID'
  | 'CONTENT_HASH_INVALID'
  | 'SOURCE_HASH_INVALID'
  | 'SOURCE_SET_HASH_INVALID'
  | 'SCOPE_INVALID'
  | 'LOCALE_INVALID'
  | 'STATE_INVALID';

export function validateProfessionalKnowledgeVersionContract(
  value: ProfessionalKnowledgeVersionSnapshot
): readonly ProfessionalKnowledgeContractIssue[] {
  const issues = new Set<ProfessionalKnowledgeContractIssue>();

  if (
    !exactNonEmpty(value.id) ||
    !exactNonEmpty(value.knowledgeId) ||
    !exactNonEmpty(value.knowledgeKey)
  ) {
    issues.add('IDENTITY_INVALID');
  }
  if (!SEMANTIC_VERSION.test(value.semanticVersion)) {
    issues.add('SEMANTIC_VERSION_INVALID');
  }
  if (
    !SHA256_HEX.test(value.contentHash) ||
    value.contentHash !== hashProfessionalKnowledgeContent(value.content)
  ) {
    issues.add('CONTENT_HASH_INVALID');
  }
  if (
    value.sources.some(
      (source) =>
        !exactNonEmpty(source.sourceRef) ||
        !exactNonEmpty(source.sourceVersion) ||
        !SHA256_HEX.test(source.sourceHash)
    )
  ) {
    issues.add('SOURCE_HASH_INVALID');
  }
  if (
    !SHA256_HEX.test(value.sourceSetHash) ||
    value.sourceSetHash !== hashProfessionalKnowledgeSourceSet(value.sources)
  ) {
    issues.add('SOURCE_SET_HASH_INVALID');
  }

  const scope = value.scope;
  if (
    scope.product !== 'V1' ||
    !exactNonEmpty(scope.sceneCode) ||
    !exactNonEmpty(scope.scenePackageVersion) ||
    scope.stages.length === 0 ||
    scope.ageBands.length === 0 ||
    scope.riskLevels.length === 0
  ) {
    issues.add('SCOPE_INVALID');
  }
  if (!exactNonEmpty(scope.locale)) issues.add('LOCALE_INVALID');

  if (
    !PROFESSIONAL_KNOWLEDGE_LIFECYCLE_STATUSES.includes(value.lifecycleStatus) ||
    !PROFESSIONAL_KNOWLEDGE_REVIEW_STATES.includes(value.reviewState) ||
    !PROFESSIONAL_KNOWLEDGE_VALIDITY_STATES.includes(value.validityState)
  ) {
    issues.add('STATE_INVALID');
  }

  return [...issues];
}

function semanticFingerprint(value: ProfessionalKnowledgeVersionSnapshot): string {
  return canonicalize({
    knowledgeId: value.knowledgeId,
    knowledgeKey: value.knowledgeKey,
    semanticVersion: value.semanticVersion,
    contentHash: value.contentHash,
    sourceSetHash: value.sourceSetHash,
    scope: value.scope,
  });
}

export function releasedSemanticMutationAllowed(
  before: ProfessionalKnowledgeVersionSnapshot,
  after: ProfessionalKnowledgeVersionSnapshot
): boolean {
  if (before.lifecycleStatus === 'CANDIDATE') return true;
  return semanticFingerprint(before) === semanticFingerprint(after);
}

export interface ProfessionalApprovalScope {
  readonly product: 'V1';
  readonly sceneCode: string;
  readonly scenePackageVersion: string;
  readonly stages: readonly string[];
  readonly ageBands: readonly ProfessionalKnowledgeAgeBand[];
  readonly locale: string;
}

export interface ProfessionalApprovalProof {
  readonly proofId: string;
  readonly knowledgeId: string;
  readonly semanticVersion: string;
  readonly contentHash: string;
  readonly sourceSetHash: string;
  /**
   * Canonical hash of the complete authority-relevant Knowledge semantics.
   * Optional in the transport type for backward-compatible decoding; validation
   * requires an exact value, so legacy/stale proofs fail closed.
   */
  readonly semanticBindingHash?: string;
  readonly sourceRefs: readonly string[];
  readonly scope: ProfessionalApprovalScope;
  readonly reviewerIdentity: string;
  readonly reviewerAccountId: string;
  readonly reviewerPersonId: string;
  readonly staffAssignmentRef: string;
  readonly staffCapability: 'PROFESSIONAL_REVIEW';
  readonly qualificationRef: string;
  readonly qualificationScope: ProfessionalApprovalScope;
  readonly approvalStatus: 'APPROVED' | 'REJECTED' | 'REVOKED';
  readonly publicationStatus: 'EFFECTIVE' | 'WITHDRAWN';
  readonly reviewedAt: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly professionalContentPackageRef?: ProfessionalContentPackageRef | null;
}

export type ProfessionalApprovalProviderResult =
  | { readonly status: 'RESOLVED'; readonly proof: ProfessionalApprovalProof }
  | { readonly status: 'INVALID'; readonly reason: string }
  | {
      readonly status: 'UNAVAILABLE';
      readonly reason: 'PROVIDER_UNAVAILABLE' | 'TIMEOUT' | 'TRANSPORT';
    };

export interface ProfessionalApprovalProvider {
  resolve(input: {
    readonly knowledgeId: string;
    readonly semanticVersion: string;
    readonly contentHash: string;
    readonly sourceSetHash: string;
    readonly semanticBindingHash?: string;
  }): Promise<ProfessionalApprovalProviderResult>;
  revalidate(input: {
    readonly proofId: string;
    readonly knowledgeId: string;
    readonly semanticVersion: string;
    readonly contentHash: string;
    readonly sourceSetHash: string;
    readonly semanticBindingHash?: string;
  }): Promise<ProfessionalApprovalProviderResult>;
}

export type StaffProfessionalReviewAuthorityResult =
  | {
      readonly status: 'RESOLVED';
      readonly assignmentRef: string;
      readonly accountId: string;
      readonly personId: string;
      readonly capability: 'PROFESSIONAL_REVIEW';
      readonly scope: 'GLOBAL';
    }
  | { readonly status: 'INVALID'; readonly reason: string }
  | { readonly status: 'UNAVAILABLE'; readonly reason: string };

export type ProfessionalQualificationResult =
  | {
      readonly status: 'RESOLVED';
      readonly qualificationRef: string;
      readonly reviewerIdentity: string;
      readonly reviewerAccountId: string;
      readonly reviewerPersonId: string;
      readonly scope: ProfessionalApprovalScope;
      readonly validFrom: string;
      readonly validTo: string | null;
    }
  | { readonly status: 'INVALID'; readonly reason: string }
  | { readonly status: 'UNAVAILABLE'; readonly reason: string };

export interface ProfessionalQualificationProvider {
  resolve(input: {
    readonly qualificationRef: string;
    readonly reviewerIdentity: string;
    readonly reviewerAccountId: string;
    readonly reviewerPersonId: string;
    readonly scope: ProfessionalApprovalScope;
  }): Promise<ProfessionalQualificationResult>;
}

export type ProfessionalApprovalValidation =
  | { readonly status: 'VALID'; readonly proof: ProfessionalApprovalProof }
  | { readonly status: 'INVALID'; readonly reason: string }
  | { readonly status: 'UNAVAILABLE'; readonly dependency: string };

function parseAuthorityTime(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim().length === 0 || value !== value.trim()) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalAuthorityEnd(
  value: unknown
): { readonly valid: boolean; readonly value: number | null } {
  if (value === null) return { valid: true, value: null };
  const parsed = parseAuthorityTime(value);
  return parsed === null
    ? { valid: false, value: null }
    : { valid: true, value: parsed };
}

function sameApprovalScope(
  a: ProfessionalApprovalScope,
  b: ProfessionalApprovalScope
): boolean {
  return (
    a.product === b.product &&
    a.sceneCode === b.sceneCode &&
    a.scenePackageVersion === b.scenePackageVersion &&
    a.locale === b.locale &&
    canonicalize(normalizedUnique(a.stages)) === canonicalize(normalizedUnique(b.stages)) &&
    canonicalize(normalizedUnique(a.ageBands)) === canonicalize(normalizedUnique(b.ageBands))
  );
}

function knowledgeApprovalScope(
  scope: ProfessionalKnowledgeScopeMetadata
): ProfessionalApprovalScope {
  return {
    product: scope.product,
    sceneCode: scope.sceneCode,
    scenePackageVersion: scope.scenePackageVersion,
    stages: [...scope.stages],
    ageBands: [...scope.ageBands],
    locale: scope.locale,
  };
}

function samePackageRef(
  expected: ProfessionalContentPackageRef | null | undefined,
  actual: ProfessionalContentPackageRef | null | undefined
): boolean {
  if (expected == null) return actual == null;
  if (actual == null) return false;
  return (
    expected.packageId === actual.packageId &&
    expected.packageVersion === actual.packageVersion &&
    expected.contentHash === actual.contentHash
  );
}

export type ProfessionalQualificationValidation =
  | { readonly status: 'VALID'; readonly qualification: Extract<ProfessionalQualificationResult, { status: 'RESOLVED' }> }
  | { readonly status: 'INVALID'; readonly reason: string }
  | { readonly status: 'UNAVAILABLE'; readonly dependency: 'PROFESSIONAL_QUALIFICATION' };

export function validateProfessionalQualification(input: {
  readonly result: ProfessionalQualificationResult;
  readonly expected: {
    readonly qualificationRef: string;
    readonly reviewerIdentity: string;
    readonly reviewerAccountId: string;
    readonly reviewerPersonId: string;
    readonly scope: ProfessionalApprovalScope;
  };
  readonly now?: Date;
}): ProfessionalQualificationValidation {
  if (input.result.status === 'INVALID') {
    return { status: 'INVALID', reason: 'PROFESSIONAL_QUALIFICATION_INVALID' };
  }
  if (input.result.status === 'UNAVAILABLE') {
    return { status: 'UNAVAILABLE', dependency: 'PROFESSIONAL_QUALIFICATION' };
  }

  const now = (input.now ?? new Date()).getTime();
  const validFrom = parseAuthorityTime(input.result.validFrom);
  const validTo = parseOptionalAuthorityEnd(input.result.validTo);
  const exact =
    Number.isFinite(now) &&
    input.result.qualificationRef === input.expected.qualificationRef &&
    input.result.reviewerIdentity === input.expected.reviewerIdentity &&
    input.result.reviewerAccountId === input.expected.reviewerAccountId &&
    input.result.reviewerPersonId === input.expected.reviewerPersonId &&
    sameApprovalScope(input.result.scope, input.expected.scope) &&
    validFrom !== null &&
    validTo.valid &&
    validFrom <= now &&
    (validTo.value === null || validTo.value > now);

  return exact
    ? { status: 'VALID', qualification: input.result }
    : { status: 'INVALID', reason: 'PROFESSIONAL_QUALIFICATION_MISMATCH' };
}

export function validateProfessionalApproval(input: {
  readonly version: ProfessionalKnowledgeVersionSnapshot;
  readonly provider: ProfessionalApprovalProviderResult;
  readonly staffAuthority: StaffProfessionalReviewAuthorityResult;
  readonly qualification: ProfessionalQualificationResult;
  readonly now?: Date;
}): ProfessionalApprovalValidation {
  // A known-invalid authority fact must never be laundered into UNAVAILABLE by
  // a different placeholder/outage fact.
  if (input.provider.status === 'INVALID') {
    return { status: 'INVALID', reason: `APPROVAL:${input.provider.reason}` };
  }
  if (input.staffAuthority.status === 'INVALID') {
    return { status: 'INVALID', reason: 'STAFF_AUTHORITY_INVALID' };
  }
  if (input.qualification.status === 'INVALID') {
    return { status: 'INVALID', reason: 'PROFESSIONAL_QUALIFICATION_INVALID' };
  }
  if (input.provider.status === 'UNAVAILABLE') {
    return { status: 'UNAVAILABLE', dependency: `APPROVAL:${input.provider.reason}` };
  }
  if (input.staffAuthority.status === 'UNAVAILABLE') {
    return { status: 'UNAVAILABLE', dependency: 'STAFF_AUTHORITY' };
  }
  if (input.qualification.status === 'UNAVAILABLE') {
    return { status: 'UNAVAILABLE', dependency: 'PROFESSIONAL_QUALIFICATION' };
  }

  const proof = input.provider.proof;
  const expectedScope = knowledgeApprovalScope(input.version.scope);
  const expectedSemanticBinding =
    hashProfessionalKnowledgeApprovalBinding(input.version);
  const now = (input.now ?? new Date()).getTime();
  const reviewedAt = parseAuthorityTime(proof.reviewedAt);
  const effectiveFrom = parseAuthorityTime(proof.effectiveFrom);
  const effectiveTo = parseOptionalAuthorityEnd(proof.effectiveTo);
  const qualificationFrom = parseAuthorityTime(input.qualification.validFrom);
  const qualificationTo = parseOptionalAuthorityEnd(input.qualification.validTo);

  const expectedSourceRefs = normalizedUnique(
    input.version.sources.map((source) => source.sourceRef)
  );
  const proofSourceRefs = normalizedUnique(proof.sourceRefs);

  const exact =
    Number.isFinite(now) &&
    exactNonEmpty(proof.proofId) &&
    proof.knowledgeId === input.version.knowledgeId &&
    proof.semanticVersion === input.version.semanticVersion &&
    proof.contentHash === input.version.contentHash &&
    proof.sourceSetHash === input.version.sourceSetHash &&
    proof.semanticBindingHash === expectedSemanticBinding &&
    canonicalize(expectedSourceRefs) === canonicalize(proofSourceRefs) &&
    sameApprovalScope(proof.scope, expectedScope) &&
    proof.approvalStatus === 'APPROVED' &&
    proof.publicationStatus === 'EFFECTIVE' &&
    exactNonEmpty(proof.reviewerIdentity) &&
    proof.staffCapability === 'PROFESSIONAL_REVIEW' &&
    proof.staffAssignmentRef === input.staffAuthority.assignmentRef &&
    proof.reviewerAccountId === input.staffAuthority.accountId &&
    proof.reviewerPersonId === input.staffAuthority.personId &&
    input.staffAuthority.capability === 'PROFESSIONAL_REVIEW' &&
    input.staffAuthority.scope === 'GLOBAL' &&
    proof.qualificationRef === input.qualification.qualificationRef &&
    proof.reviewerIdentity === input.qualification.reviewerIdentity &&
    proof.reviewerAccountId === input.qualification.reviewerAccountId &&
    proof.reviewerPersonId === input.qualification.reviewerPersonId &&
    sameApprovalScope(proof.qualificationScope, expectedScope) &&
    sameApprovalScope(input.qualification.scope, expectedScope) &&
    samePackageRef(
      input.version.scope.professionalContentPackageRef,
      proof.professionalContentPackageRef
    ) &&
    reviewedAt !== null &&
    effectiveFrom !== null &&
    effectiveTo.valid &&
    qualificationFrom !== null &&
    qualificationTo.valid &&
    reviewedAt <= now &&
    effectiveFrom <= now &&
    qualificationFrom <= now &&
    (effectiveTo.value === null || effectiveTo.value > now) &&
    (qualificationTo.value === null || qualificationTo.value > now);

  return exact
    ? { status: 'VALID', proof }
    : { status: 'INVALID', reason: 'APPROVAL_PROOF_MISMATCH' };
}

export interface ScenePackageProfessionalKnowledgeRef {
  readonly knowledgeId: string;
  readonly semanticVersion: string;
  readonly contentHash: string;
  readonly sourceSetHash: string;
}

export type ScenePackageKnowledgeBindingResult =
  | {
      readonly status: 'RESOLVED';
      readonly sceneCode: string;
      readonly scenePackageVersion: string;
      readonly refs: readonly ScenePackageProfessionalKnowledgeRef[];
    }
  | { readonly status: 'INVALID'; readonly reason: string }
  | { readonly status: 'UNAVAILABLE'; readonly reason: string };

export type OptionalInterventionResolution =
  | { readonly status: 'NOT_REQUIRED' }
  | {
      readonly status: 'RESOLVED';
      readonly ref: ProfessionalKnowledgeInterventionRef;
    }
  | { readonly status: 'INVALID'; readonly reason: string }
  | { readonly status: 'UNAVAILABLE'; readonly reason: string };

export type ProfessionalKnowledgeEligibility =
  | { readonly status: 'ELIGIBLE' }
  | { readonly status: 'INELIGIBLE'; readonly reason: string }
  | { readonly status: 'UNAVAILABLE'; readonly dependency: string };

export function evaluateProfessionalKnowledgeEligibility(input: {
  readonly version: ProfessionalKnowledgeVersionSnapshot;
  readonly approval: ProfessionalApprovalValidation;
  readonly sceneBinding: ScenePackageKnowledgeBindingResult;
  readonly stage: string | 'UNKNOWN' | null;
  readonly ageBand: ProfessionalKnowledgeAgeBand | 'UNKNOWN' | null;
  readonly locale: string | null;
  readonly applicabilityFacts: readonly string[] | null;
  readonly exclusionFacts: readonly string[] | null;
  readonly riskLevel: ProfessionalKnowledgeRiskLevel | 'UNKNOWN' | null;
  readonly intervention: OptionalInterventionResolution;
}): ProfessionalKnowledgeEligibility {
  const v = input.version;
  if (v.lifecycleStatus !== 'PUBLISHED') {
    return { status: 'INELIGIBLE', reason: 'NOT_PUBLISHED' };
  }
  if (v.reviewState !== 'CURRENT') {
    return { status: 'INELIGIBLE', reason: 'REVIEW_NOT_CURRENT' };
  }
  if (v.validityState !== 'VALID') {
    return { status: 'INELIGIBLE', reason: 'VALIDITY_NOT_VALID' };
  }

  if (input.approval.status === 'UNAVAILABLE') {
    return { status: 'UNAVAILABLE', dependency: input.approval.dependency };
  }
  if (input.approval.status !== 'VALID') {
    return { status: 'INELIGIBLE', reason: 'APPROVAL_INVALID' };
  }

  if (input.sceneBinding.status === 'UNAVAILABLE') {
    return { status: 'UNAVAILABLE', dependency: 'SCENE_PACKAGE_BINDING' };
  }
  if (input.sceneBinding.status !== 'RESOLVED') {
    return { status: 'INELIGIBLE', reason: 'SCENE_PACKAGE_BINDING_INVALID' };
  }
  if (
    input.sceneBinding.sceneCode !== v.scope.sceneCode ||
    input.sceneBinding.scenePackageVersion !== v.scope.scenePackageVersion
  ) {
    return { status: 'INELIGIBLE', reason: 'SCENE_PACKAGE_MISMATCH' };
  }
  const bound = input.sceneBinding.refs.some(
    (ref) =>
      ref.knowledgeId === v.knowledgeId &&
      ref.semanticVersion === v.semanticVersion &&
      ref.contentHash === v.contentHash &&
      ref.sourceSetHash === v.sourceSetHash
  );
  if (!bound) return { status: 'INELIGIBLE', reason: 'KNOWLEDGE_NOT_BOUND' };

  if (
    input.stage === null ||
    input.stage === 'UNKNOWN' ||
    input.ageBand === null ||
    input.ageBand === 'UNKNOWN' ||
    input.locale === null ||
    input.riskLevel === null ||
    input.riskLevel === 'UNKNOWN' ||
    input.applicabilityFacts === null ||
    input.exclusionFacts === null
  ) {
    return { status: 'INELIGIBLE', reason: 'METADATA_UNKNOWN' };
  }
  if (!v.scope.stages.includes(input.stage)) {
    return { status: 'INELIGIBLE', reason: 'STAGE_MISMATCH' };
  }
  if (!v.scope.ageBands.includes(input.ageBand)) {
    return { status: 'INELIGIBLE', reason: 'AGE_BAND_MISMATCH' };
  }
  if (v.scope.locale !== input.locale) {
    return { status: 'INELIGIBLE', reason: 'LOCALE_MISMATCH' };
  }
  if (!v.scope.riskLevels.includes(input.riskLevel)) {
    return { status: 'INELIGIBLE', reason: 'RISK_MISMATCH' };
  }

  const applicability = new Set(input.applicabilityFacts);
  if (v.scope.applicability.some((required) => !applicability.has(required))) {
    return { status: 'INELIGIBLE', reason: 'APPLICABILITY_MISMATCH' };
  }
  const exclusions = new Set(input.exclusionFacts);
  if (v.scope.exclusions.some((excluded) => exclusions.has(excluded))) {
    return { status: 'INELIGIBLE', reason: 'EXCLUDED' };
  }

  const expectedIntervention = v.scope.interventionDefinitionRef ?? null;
  if (expectedIntervention === null) {
    if (input.intervention.status !== 'NOT_REQUIRED') {
      return { status: 'INELIGIBLE', reason: 'UNEXPECTED_INTERVENTION_BINDING' };
    }
  } else {
    if (input.intervention.status === 'UNAVAILABLE') {
      return { status: 'UNAVAILABLE', dependency: 'INTERVENTION_DEFINITION' };
    }
    if (input.intervention.status !== 'RESOLVED') {
      return { status: 'INELIGIBLE', reason: 'INTERVENTION_BINDING_INVALID' };
    }
    if (
      input.intervention.ref.definitionId !== expectedIntervention.definitionId ||
      input.intervention.ref.definitionVersion !== expectedIntervention.definitionVersion ||
      input.intervention.ref.contentHash !== expectedIntervention.contentHash
    ) {
      return { status: 'INELIGIBLE', reason: 'INTERVENTION_BINDING_MISMATCH' };
    }
  }

  return { status: 'ELIGIBLE' };
}

export type ProfessionalKnowledgeDependencyImpact =
  | 'SOURCE_CORRECTION'
  | 'SOURCE_WITHDRAWAL'
  | 'APPROVAL_EXPIRED'
  | 'APPROVAL_REVOKED'
  | 'STAFF_AUTHORITY_REVOKED'
  | 'QUALIFICATION_REVOKED'
  | 'SCENE_PACKAGE_SUPERSEDED'
  | 'SCENE_APPLICABILITY_MATERIAL_CHANGE'
  | 'INTERVENTION_SUPERSEDED';

export interface ProfessionalKnowledgeDependencyProjection {
  readonly reviewState: ProfessionalKnowledgeReviewState;
  readonly validityState: ProfessionalKnowledgeValidityState;
  readonly eligibilitySuppressed: boolean;
}

export function projectProfessionalKnowledgeDependencyImpact(input: {
  readonly current: Pick<
    ProfessionalKnowledgeVersionSnapshot,
    'reviewState' | 'validityState'
  >;
  readonly impact: ProfessionalKnowledgeDependencyImpact;
  readonly exactDependent: boolean;
  readonly materialImpact?: boolean;
}): ProfessionalKnowledgeDependencyProjection {
  if (!input.exactDependent) {
    return {
      ...input.current,
      eligibilitySuppressed: false,
    };
  }

  switch (input.impact) {
    case 'SOURCE_WITHDRAWAL':
      return {
        reviewState: 'NEEDS_REVIEW',
        validityState: 'INVALID',
        eligibilitySuppressed: true,
      };
    case 'SOURCE_CORRECTION':
    case 'SCENE_APPLICABILITY_MATERIAL_CHANGE':
      if (input.materialImpact === false) {
        return { ...input.current, eligibilitySuppressed: false };
      }
      return {
        reviewState: 'NEEDS_REVIEW',
        validityState: 'UNKNOWN',
        eligibilitySuppressed: true,
      };
    case 'INTERVENTION_SUPERSEDED':
      if (input.materialImpact !== true) {
        return { ...input.current, eligibilitySuppressed: false };
      }
      return {
        reviewState: 'NEEDS_REVIEW',
        validityState: 'UNKNOWN',
        eligibilitySuppressed: true,
      };
    case 'SCENE_PACKAGE_SUPERSEDED':
      return { ...input.current, eligibilitySuppressed: false };
    case 'APPROVAL_EXPIRED':
    case 'APPROVAL_REVOKED':
    case 'STAFF_AUTHORITY_REVOKED':
    case 'QUALIFICATION_REVOKED':
      return { ...input.current, eligibilitySuppressed: true };
  }
}

export function restoreProfessionalKnowledgeAfterNoMaterialImpact(
  current: Pick<ProfessionalKnowledgeVersionSnapshot, 'reviewState' | 'validityState'>
): Pick<ProfessionalKnowledgeVersionSnapshot, 'reviewState' | 'validityState'> {
  if (current.reviewState !== 'NEEDS_REVIEW') return current;
  return { reviewState: 'CURRENT', validityState: 'VALID' };
}
