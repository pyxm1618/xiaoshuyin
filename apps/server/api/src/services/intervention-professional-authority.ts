export type InterventionApprovalStatus = 'APPROVED' | 'DRAFT' | 'REJECTED' | 'REVOKED';
export type InterventionPublicationStatus = 'PUBLISHED' | 'UNPUBLISHED';
export type InterventionApprovalLifecycle = 'CURRENT' | 'RETIRED' | 'SUPERSEDED';

export interface InterventionProfessionalAuthorityRequest {
  readonly definitionId: string;
  readonly definitionVersion: number;
  readonly contentHash: string;
  readonly sceneId: string;
  readonly sourceRefs: readonly string[];
  readonly approvalScope: string;
}

export interface InterventionProfessionalAuthorityProof {
  readonly approvalProofRef: string;
  readonly definitionId: string;
  readonly definitionVersion: number;
  readonly contentHash: string;
  readonly sourceRefs: readonly string[];
  readonly approvalScope: string;
  readonly reviewerIdentityRef: string;
  readonly staffAuthority: {
    readonly assignmentRef: string;
    readonly capability: 'PROFESSIONAL_REVIEW';
    readonly scopeRef: string;
    readonly status: 'VALID' | 'REVOKED' | 'EXPIRED' | 'UNVERIFIABLE';
  };
  readonly professionalQualification: {
    readonly qualificationRef: string;
    readonly scopeRef: string;
    readonly status: 'VALID' | 'REVOKED' | 'EXPIRED' | 'UNVERIFIABLE';
  };
  readonly reviewStatus: InterventionApprovalStatus;
  readonly publicationStatus: InterventionPublicationStatus;
  readonly lifecycleStatus: InterventionApprovalLifecycle;
  readonly reviewedAt: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly publishedAt: string;
}

export interface InterventionProfessionalAuthorityProvider {
  resolve(input: InterventionProfessionalAuthorityRequest): Promise<InterventionProfessionalAuthorityProof | null>;
  revalidate(input: InterventionProfessionalAuthorityRequest): Promise<InterventionProfessionalAuthorityProof | null>;
}

export const unavailableProductionInterventionProfessionalAuthorityProvider:
  InterventionProfessionalAuthorityProvider = Object.freeze({
    async resolve() { return null; },
    async revalidate() { return null; },
  });

export type InterventionProfessionalAuthorityFailureReason =
  | 'NOT_PROFESSIONALLY_APPROVED'
  | 'WRONG_DEFINITION'
  | 'WRONG_VERSION'
  | 'WRONG_HASH'
  | 'SOURCE_REFS_MISMATCH'
  | 'APPROVAL_SCOPE_MISMATCH'
  | 'REVIEWER_IDENTITY_MISSING'
  | 'STAFF_AUTHORITY_INVALID'
  | 'QUALIFICATION_MISSING'
  | 'APPROVAL_NOT_APPROVED'
  | 'UNPUBLISHED'
  | 'RETIRED'
  | 'SUPERSEDED'
  | 'APPROVAL_EXPIRED';

export type InterventionProfessionalAuthorityResult =
  | {
      readonly status: 'VALID';
      readonly approvalProofRef: string;
      readonly reviewerIdentityRef: string;
      readonly qualificationRef: string;
      readonly proof: InterventionProfessionalAuthorityProof;
    }
  | {
      readonly status: 'UNAVAILABLE' | 'INVALID';
      readonly reason: InterventionProfessionalAuthorityFailureReason;
    };

function timestamp(value: string): number | null {
  if (value.trim().length === 0) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameStringArray(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function invalid(
  reason: InterventionProfessionalAuthorityFailureReason
): InterventionProfessionalAuthorityResult {
  return { status: 'INVALID', reason };
}

export async function resolveInterventionProfessionalAuthority(
  provider: InterventionProfessionalAuthorityProvider,
  request: InterventionProfessionalAuthorityRequest,
  mode: 'RESOLVE' | 'REVALIDATE',
  now = Date.now()
): Promise<InterventionProfessionalAuthorityResult> {
  let proof: InterventionProfessionalAuthorityProof | null;
  try {
    proof = mode === 'RESOLVE' ? await provider.resolve(request) : await provider.revalidate(request);
  } catch {
    return { status: 'UNAVAILABLE', reason: 'NOT_PROFESSIONALLY_APPROVED' };
  }
  if (proof === null) return { status: 'UNAVAILABLE', reason: 'NOT_PROFESSIONALLY_APPROVED' };
  if (proof.definitionId !== request.definitionId) return invalid('WRONG_DEFINITION');
  if (proof.definitionVersion !== request.definitionVersion) return invalid('WRONG_VERSION');
  if (proof.contentHash !== request.contentHash) return invalid('WRONG_HASH');
  if (!sameStringArray(proof.sourceRefs, request.sourceRefs)) return invalid('SOURCE_REFS_MISMATCH');
  if (proof.approvalScope !== request.approvalScope) return invalid('APPROVAL_SCOPE_MISMATCH');
  if (proof.reviewerIdentityRef.trim().length === 0) return invalid('REVIEWER_IDENTITY_MISSING');
  if (
    proof.staffAuthority.capability !== 'PROFESSIONAL_REVIEW' ||
    proof.staffAuthority.status !== 'VALID' ||
    proof.staffAuthority.assignmentRef.trim().length === 0 ||
    proof.staffAuthority.scopeRef.trim().length === 0
  ) return invalid('STAFF_AUTHORITY_INVALID');
  if (
    proof.professionalQualification.status !== 'VALID' ||
    proof.professionalQualification.qualificationRef.trim().length === 0 ||
    proof.professionalQualification.scopeRef !== proof.approvalScope
  ) return invalid('QUALIFICATION_MISSING');
  if (proof.reviewStatus !== 'APPROVED') return invalid('APPROVAL_NOT_APPROVED');
  if (proof.publicationStatus !== 'PUBLISHED') return invalid('UNPUBLISHED');
  if (proof.lifecycleStatus === 'RETIRED') return invalid('RETIRED');
  if (proof.lifecycleStatus === 'SUPERSEDED') return invalid('SUPERSEDED');

  const reviewedAt = timestamp(proof.reviewedAt);
  const effectiveFrom = timestamp(proof.effectiveFrom);
  const effectiveTo = proof.effectiveTo === null ? null : timestamp(proof.effectiveTo);
  const publishedAt = timestamp(proof.publishedAt);
  if (
    reviewedAt === null ||
    effectiveFrom === null ||
    publishedAt === null ||
    reviewedAt > now ||
    effectiveFrom > now ||
    publishedAt > now ||
    (proof.effectiveTo !== null && (effectiveTo === null || effectiveTo <= now))
  ) return invalid('APPROVAL_EXPIRED');

  return {
    status: 'VALID',
    approvalProofRef: proof.approvalProofRef,
    reviewerIdentityRef: proof.reviewerIdentityRef,
    qualificationRef: proof.professionalQualification.qualificationRef,
    proof,
  };
}
