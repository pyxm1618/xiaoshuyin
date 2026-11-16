/**
 * Slice 15 narrow Professional Content consumer port.
 *
 * This module consumes proof for an already-approved package. It is not a CMS,
 * reviewer registry, credential platform, approval workflow, questionnaire
 * platform or scoring engine.
 */
export type ProfessionalReviewStream =
  | 'FAMILY_ALLIANCE_REVIEW'
  | 'PHONE_USE_CONTRACT_REVIEW';

export interface ProfessionalReviewPackageScope {
  readonly stream: ProfessionalReviewStream;
  readonly scenePackageVersion: string;
}

export interface ProfessionalReviewPackageProof {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly contentHash: string;
  readonly scope: readonly ProfessionalReviewPackageScope[];
  readonly sourceRefs: readonly string[];
  readonly reviewerIdentity: string;
  readonly reviewerQualificationRef: string;
  readonly approvalStatus: 'APPROVED';
  readonly publicationStatus: 'PUBLISHED';
  readonly reviewedAt: string;
  readonly effectiveAt: string;
}

export interface ProfessionalReviewResolvedPackage {
  readonly proof: ProfessionalReviewPackageProof;
  /**
   * Package-owned validation/normalization only. Slice 15 does not know,
   * invent or score questionnaire dimensions.
   */
  validateAndNormalizeResponse(
    response: Readonly<Record<string, unknown>>
  ): Readonly<Record<string, unknown>>;
}

export interface ProfessionalReviewContentProvider {
  resolve(input: {
    readonly stream: ProfessionalReviewStream;
    readonly scenePackageVersion: string;
    readonly packageId: string;
    readonly packageVersion: string;
    readonly contentHash: string;
  }): Promise<ProfessionalReviewResolvedPackage | null>;

  revalidate(input: {
    readonly stream: ProfessionalReviewStream;
    readonly scenePackageVersion: string;
    readonly packageId: string;
    readonly packageVersion: string;
    readonly contentHash: string;
  }): Promise<ProfessionalReviewResolvedPackage | null>;
}

/**
 * Production default. There is currently no assigned Professional Reviewer and
 * no APPROVED + PUBLISHED A5001/A5002 package. No environment flag can turn
 * this into an approved provider.
 */
export const unavailableProductionProfessionalReviewContentProvider:
  ProfessionalReviewContentProvider = Object.freeze({
    async resolve() {
      return null;
    },
    async revalidate() {
      return null;
    },
  });

function unavailable(): never {
  throw Object.assign(new Error('Professional Content package unavailable'), {
    code: 'DEPENDENCY_UNAVAILABLE',
  });
}

function packageMatches(
  value: ProfessionalReviewResolvedPackage | null,
  input: {
    readonly stream: ProfessionalReviewStream;
    readonly scenePackageVersion: string;
    readonly packageId: string;
    readonly packageVersion: string;
    readonly contentHash: string;
  }
): value is ProfessionalReviewResolvedPackage {
  if (value === null) return false;
  const proof = value.proof;
  return (
    proof.packageId === input.packageId &&
    proof.packageVersion === input.packageVersion &&
    proof.contentHash === input.contentHash &&
    proof.approvalStatus === 'APPROVED' &&
    proof.publicationStatus === 'PUBLISHED' &&
    proof.reviewerIdentity.trim().length > 0 &&
    proof.reviewerQualificationRef.trim().length > 0 &&
    proof.sourceRefs.length > 0 &&
    proof.reviewedAt.trim().length > 0 &&
    proof.effectiveAt.trim().length > 0 &&
    proof.scope.some(
      (scope) =>
        scope.stream === input.stream &&
        scope.scenePackageVersion === input.scenePackageVersion
    )
  );
}

export async function requireProfessionalReviewPackage(
  provider: ProfessionalReviewContentProvider,
  input: {
    readonly stream: ProfessionalReviewStream;
    readonly scenePackageVersion: string;
    readonly packageId: string;
    readonly packageVersion: string;
    readonly contentHash: string;
  },
  mode: 'RESOLVE' | 'REVALIDATE'
): Promise<ProfessionalReviewResolvedPackage> {
  const value =
    mode === 'RESOLVE'
      ? await provider.resolve(input)
      : await provider.revalidate(input);
  if (!packageMatches(value, input)) unavailable();
  return value;
}

export function professionalReviewPackageProofIdentity(
  proof: ProfessionalReviewPackageProof
) {
  return {
    packageId: proof.packageId,
    packageVersion: proof.packageVersion,
    contentHash: proof.contentHash,
    scope: proof.scope.map((scope) => ({
      stream: scope.stream,
      scenePackageVersion: scope.scenePackageVersion,
    })),
    sourceRefs: [...proof.sourceRefs],
    reviewerIdentity: proof.reviewerIdentity,
    reviewerQualificationRef: proof.reviewerQualificationRef,
    approvalStatus: proof.approvalStatus,
    publicationStatus: proof.publicationStatus,
    reviewedAt: proof.reviewedAt,
    effectiveAt: proof.effectiveAt,
  };
}
