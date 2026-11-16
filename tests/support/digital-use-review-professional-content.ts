import type {
  ProfessionalReviewContentProvider,
  ProfessionalReviewPackageProof,
  ProfessionalReviewResolvedPackage,
  ProfessionalReviewStream,
} from '../../apps/server/api/src/services/digital-use-review-professional-content.js';

export const TEST_A5001_PACKAGE = Object.freeze({
  packageId: 'test:professional-review:a5001',
  packageVersion: 'test-v1',
  contentHash: 'sha256:test-a5001-authority-package-v1',
});

export const TEST_A5002_PACKAGE = Object.freeze({
  packageId: 'test:professional-review:a5002',
  packageVersion: 'test-v1',
  contentHash: 'sha256:test-a5002-authority-package-v1',
});

function proofFor(stream: ProfessionalReviewStream): ProfessionalReviewPackageProof {
  const identity =
    stream === 'FAMILY_ALLIANCE_REVIEW'
      ? TEST_A5001_PACKAGE
      : TEST_A5002_PACKAGE;
  return Object.freeze({
    ...identity,
    scope: Object.freeze([{ stream, scenePackageVersion: 'v1' }]),
    sourceRefs: Object.freeze([
      `test://professional-authority/${stream.toLowerCase()}/test-v1`,
    ]),
    approvalProofRef:
      `test://professional-authority/${stream.toLowerCase()}/approval/test-v1`,
    approvalBinding: Object.freeze({
      packageId: identity.packageId,
      packageVersion: identity.packageVersion,
      contentHash: identity.contentHash,
    }),
    reviewerIdentity: 'test-only:synthetic-professional-reviewer',
    reviewerQualificationRef: 'test://qualification/synthetic-review-fixture',
    reviewerProofStatus: 'VALID',
    reviewStatus: 'APPROVED',
    publicationStatus: 'PUBLISHED',
    lifecycleStatus: 'CURRENT',
    reviewedAt: '2026-11-15T00:00:00.000Z',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: '2027-12-31T23:59:59.999Z',
    publishedAt: '2026-11-15T00:00:00.000Z',
  });
}

function validateNormalizedResponse(
  response: Readonly<Record<string, unknown>>
): void {
  const keys = Object.keys(response).sort();
  if (
    keys.length !== 2 ||
    keys[0] !== 'note' ||
    keys[1] !== 'outcome' ||
    typeof response['note'] !== 'string' ||
    !['BETTER', 'SAME', 'WORSE', 'UNCERTAIN'].includes(
      String(response['outcome'])
    )
  ) {
    throw new Error('TEST_PACKAGE_RESPONSE_INVALID');
  }
}

function packageFor(stream: ProfessionalReviewStream): ProfessionalReviewResolvedPackage {
  const proof = proofFor(stream);
  return {
    proof,
    loadedContentHash: proof.contentHash,
    validateNormalizedResponse,
  };
}

/**
 * Synthetic authority fixture for tests only. It proves that a future exact
 * approved/published package can drive the legal runtime path. It is not
 * Professional approval and is intentionally unreachable from production.
 */
export class TestProfessionalReviewContentProvider
  implements ProfessionalReviewContentProvider
{
  private unavailable = new Set<ProfessionalReviewStream>();
  private failRevalidation = new Set<ProfessionalReviewStream>();

  retire(stream: ProfessionalReviewStream): void {
    this.unavailable.add(stream);
  }

  restore(stream: ProfessionalReviewStream): void {
    this.unavailable.delete(stream);
    this.failRevalidation.delete(stream);
  }

  failNextRevalidation(stream: ProfessionalReviewStream): void {
    this.failRevalidation.add(stream);
  }

  async resolve(input: {
    readonly stream: ProfessionalReviewStream;
    readonly scenePackageVersion: string;
    readonly packageId: string;
    readonly packageVersion: string;
    readonly contentHash: string;
  }): Promise<ProfessionalReviewResolvedPackage | null> {
    if (this.unavailable.has(input.stream)) return null;
    const candidate = packageFor(input.stream);
    return (
      input.scenePackageVersion === 'v1' &&
      candidate.proof.packageId === input.packageId &&
      candidate.proof.packageVersion === input.packageVersion &&
      candidate.proof.contentHash === input.contentHash
    )
      ? candidate
      : null;
  }

  async revalidate(input: {
    readonly stream: ProfessionalReviewStream;
    readonly scenePackageVersion: string;
    readonly packageId: string;
    readonly packageVersion: string;
    readonly contentHash: string;
  }): Promise<ProfessionalReviewResolvedPackage | null> {
    if (this.failRevalidation.delete(input.stream)) return null;
    return this.resolve(input);
  }
}

export const normalizedReviewResponse = Object.freeze({
  outcome: 'BETTER',
  note: 'Synthetic package-owned normalized test response.',
});
