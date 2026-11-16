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

export type ProfessionalReviewStatus =
  | 'APPROVED'
  | 'DRAFT'
  | 'REJECTED'
  | 'REVOKED';

export type ProfessionalReviewPublicationStatus =
  | 'PUBLISHED'
  | 'UNPUBLISHED';

export type ProfessionalReviewPackageLifecycleStatus =
  | 'CURRENT'
  | 'RETIRED'
  | 'SUPERSEDED'
  | 'CANDIDATE';

export type ProfessionalReviewerProofStatus =
  | 'VALID'
  | 'REVOKED'
  | 'MISMATCHED'
  | 'UNVERIFIABLE';

export interface ProfessionalReviewPackageProof {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly contentHash: string;
  readonly scope: readonly ProfessionalReviewPackageScope[];
  readonly sourceRefs: readonly string[];

  /** Immutable approval proof identity owned by the external authority. */
  readonly approvalProofRef: string;
  readonly approvalBinding: {
    readonly packageId: string;
    readonly packageVersion: string;
    readonly contentHash: string;
  };

  readonly reviewerIdentity: string;
  readonly reviewerQualificationRef: string;
  readonly reviewerProofStatus: ProfessionalReviewerProofStatus;

  readonly reviewStatus: ProfessionalReviewStatus;
  readonly publicationStatus: ProfessionalReviewPublicationStatus;
  readonly lifecycleStatus: ProfessionalReviewPackageLifecycleStatus;

  readonly reviewedAt: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly publishedAt: string;
}

export interface ProfessionalReviewResolvedPackage {
  readonly proof: ProfessionalReviewPackageProof;

  /**
   * Immutable identity of the content actually loaded by the provider.
   * It must equal proof.contentHash so the consumer never authorizes one
   * package while validating responses against different loaded content.
   */
  readonly loadedContentHash: string;

  /**
   * Package-owned validation + normalization. Slice 15 treats the submitted
   * response as opaque and never invents questionnaire fields, unresolved-state
   * semantics, scoring or interpretation. The returned value is the only
   * response form eligible for idempotency hashing and artifact persistence.
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

function validTimestamp(value: string): number | null {
  if (value.trim().length === 0) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
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

  const reviewedAt = validTimestamp(proof.reviewedAt);
  const effectiveFrom = validTimestamp(proof.effectiveFrom);
  const effectiveTo =
    proof.effectiveTo === null ? null : validTimestamp(proof.effectiveTo);
  const publishedAt = validTimestamp(proof.publishedAt);
  const now = Date.now();

  return (
    proof.packageId === input.packageId &&
    proof.packageVersion === input.packageVersion &&
    proof.contentHash === input.contentHash &&
    value.loadedContentHash === proof.contentHash &&

    proof.approvalBinding.packageId === proof.packageId &&
    proof.approvalBinding.packageVersion === proof.packageVersion &&
    proof.approvalBinding.contentHash === proof.contentHash &&
    proof.approvalProofRef.trim().length > 0 &&

    proof.reviewStatus === 'APPROVED' &&
    proof.publicationStatus === 'PUBLISHED' &&
    proof.lifecycleStatus === 'CURRENT' &&

    proof.reviewerIdentity.trim().length > 0 &&
    proof.reviewerQualificationRef.trim().length > 0 &&
    proof.reviewerProofStatus === 'VALID' &&

    proof.sourceRefs.length > 0 &&
    reviewedAt !== null &&
    effectiveFrom !== null &&
    publishedAt !== null &&
    reviewedAt <= now &&
    effectiveFrom <= now &&
    publishedAt <= now &&
    (proof.effectiveTo === null ||
      (effectiveTo !== null && effectiveTo >= now)) &&

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
    approvalProofRef: proof.approvalProofRef,
    approvalBinding: { ...proof.approvalBinding },
    reviewerIdentity: proof.reviewerIdentity,
    reviewerQualificationRef: proof.reviewerQualificationRef,
    reviewerProofStatus: proof.reviewerProofStatus,
    reviewStatus: proof.reviewStatus,
    publicationStatus: proof.publicationStatus,
    lifecycleStatus: proof.lifecycleStatus,
    reviewedAt: proof.reviewedAt,
    effectiveFrom: proof.effectiveFrom,
    effectiveTo: proof.effectiveTo,
    publishedAt: proof.publishedAt,
  };
}
