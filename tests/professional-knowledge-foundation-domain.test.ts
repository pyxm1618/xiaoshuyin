import { describe, expect, it } from 'vitest';
import {
  PROFESSIONAL_KNOWLEDGE_LIFECYCLE_STATUSES,
  PROFESSIONAL_KNOWLEDGE_REVIEW_STATES,
  PROFESSIONAL_KNOWLEDGE_VALIDITY_STATES,
  evaluateProfessionalKnowledgeEligibility,
  hashProfessionalKnowledgeApprovalBinding,
  hashProfessionalKnowledgeContent,
  hashProfessionalKnowledgeSourceSet,
  projectProfessionalKnowledgeDependencyImpact,
  releasedSemanticMutationAllowed,
  restoreProfessionalKnowledgeAfterNoMaterialImpact,
  validateProfessionalApproval,
  validateProfessionalKnowledgeVersionContract,
  type ProfessionalApprovalProof,
  type ProfessionalKnowledgeVersionSnapshot,
} from '../packages/domain/src/professional-knowledge.js';

const source = {
  sourceRef: 'source:guideline:001',
  sourceVersion: '2026-01',
  sourceHash: '1'.repeat(64),
  locator: 'section:4',
  metadata: { title: 'Guideline', year: 2026 },
} as const;

function version(
  overrides: Partial<ProfessionalKnowledgeVersionSnapshot> = {}
): ProfessionalKnowledgeVersionSnapshot {
  const content = { title: 'Sleep routines', explanation: 'bounded professional context' };
  const sources = [source];
  return {
    id: 'version-1',
    knowledgeId: 'knowledge-1',
    knowledgeKey: 'sleep-routine-context',
    semanticVersion: '1.0.0',
    revision: 1,
    lifecycleStatus: 'CANDIDATE',
    reviewState: 'PENDING',
    validityState: 'UNKNOWN',
    content,
    contentHash: hashProfessionalKnowledgeContent(content),
    sourceSetHash: hashProfessionalKnowledgeSourceSet(sources),
    sources,
    scope: {
      product: 'V1',
      sceneCode: 'DIGITAL_USE',
      scenePackageVersion: 'v1',
      stages: ['ASSESSMENT'],
      ageBands: ['MINOR_14_17'],
      applicability: ['sleep-impact'],
      exclusions: ['acute-safety-risk'],
      riskLevels: ['LOW', 'MODERATE'],
      locale: 'zh-CN',
      professionalContentPackageRef: null,
      interventionDefinitionRef: null,
    },
    releasedAt: null,
    effectiveFrom: null,
    effectiveTo: null,
    ...overrides,
  };
}

function validProof(v: ProfessionalKnowledgeVersionSnapshot): ProfessionalApprovalProof {
  return {
    proofId: 'approval-proof-1',
    knowledgeId: v.knowledgeId,
    semanticVersion: v.semanticVersion,
    contentHash: v.contentHash,
    sourceSetHash: v.sourceSetHash,
    semanticBindingHash: hashProfessionalKnowledgeApprovalBinding(v),
    sourceRefs: v.sources.map((item) => item.sourceRef),
    scope: {
      product: 'V1',
      sceneCode: v.scope.sceneCode,
      scenePackageVersion: v.scope.scenePackageVersion,
      stages: v.scope.stages,
      ageBands: v.scope.ageBands,
      locale: v.scope.locale,
    },
    reviewerIdentity: 'reviewer:external:1',
    reviewerAccountId: 'account-reviewer-1',
    reviewerPersonId: 'person-reviewer-1',
    staffAssignmentRef: 'assignment-1',
    staffCapability: 'PROFESSIONAL_REVIEW',
    qualificationRef: 'qualification-1',
    qualificationScope: {
      product: 'V1',
      sceneCode: v.scope.sceneCode,
      scenePackageVersion: v.scope.scenePackageVersion,
      stages: v.scope.stages,
      ageBands: v.scope.ageBands,
      locale: v.scope.locale,
    },
    approvalStatus: 'APPROVED',
    publicationStatus: 'EFFECTIVE',
    reviewedAt: '2026-01-01T00:00:00.000Z',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: '2027-01-01T00:00:00.000Z',
    professionalContentPackageRef: null,
  };
}

function approvalFor(v: ProfessionalKnowledgeVersionSnapshot) {
  const proof = validProof(v);
  return validateProfessionalApproval({
    version: v,
    provider: { status: 'RESOLVED', proof },
    staffAuthority: {
      status: 'RESOLVED',
      assignmentRef: proof.staffAssignmentRef,
      accountId: proof.reviewerAccountId,
      personId: proof.reviewerPersonId,
      capability: 'PROFESSIONAL_REVIEW',
      scope: 'GLOBAL',
    },
    qualification: {
      status: 'RESOLVED',
      qualificationRef: proof.qualificationRef,
      reviewerIdentity: proof.reviewerIdentity,
      reviewerAccountId: proof.reviewerAccountId,
      reviewerPersonId: proof.reviewerPersonId,
      scope: proof.qualificationScope,
      validFrom: '2025-01-01T00:00:00.000Z',
      validTo: '2027-01-01T00:00:00.000Z',
    },
    now: new Date('2026-11-17T00:00:00.000Z'),
  });
}

describe('professional knowledge foundation domain contract', () => {
  it('separates lifecycle, review state, and validity state', () => {
    expect(PROFESSIONAL_KNOWLEDGE_LIFECYCLE_STATUSES).not.toContain('NEEDS_REVIEW');
    expect(PROFESSIONAL_KNOWLEDGE_REVIEW_STATES).toContain('NEEDS_REVIEW');
    expect(PROFESSIONAL_KNOWLEDGE_VALIDITY_STATES).toEqual([
      'UNKNOWN',
      'VALID',
      'INVALID',
    ]);
  });

  it('hashes content and source sets deterministically', () => {
    expect(hashProfessionalKnowledgeContent({ b: 2, a: 1 })).toBe(
      hashProfessionalKnowledgeContent({ a: 1, b: 2 })
    );
    expect(hashProfessionalKnowledgeSourceSet([source])).toMatch(/^[0-9a-f]{64}$/);
  });

  it('validates stable identity, semantic version, hashes and scope', () => {
    expect(validateProfessionalKnowledgeVersionContract(version())).toEqual([]);
    expect(
      validateProfessionalKnowledgeVersionContract(
        version({ semanticVersion: 'latest', contentHash: 'bad' })
      )
    ).toEqual(expect.arrayContaining(['SEMANTIC_VERSION_INVALID', 'CONTENT_HASH_INVALID']));
  });

  it('keeps candidate content non-production even with otherwise valid proof', () => {
    const v = version();
    const result = evaluateProfessionalKnowledgeEligibility({
      version: v,
      approval: approvalFor(v),
      sceneBinding: {
        status: 'RESOLVED',
        sceneCode: v.scope.sceneCode,
        scenePackageVersion: v.scope.scenePackageVersion,
        refs: [
          {
            knowledgeId: v.knowledgeId,
            semanticVersion: v.semanticVersion,
            contentHash: v.contentHash,
            sourceSetHash: v.sourceSetHash,
          },
        ],
      },
      stage: 'ASSESSMENT',
      ageBand: 'MINOR_14_17',
      locale: 'zh-CN',
      applicabilityFacts: ['sleep-impact'],
      exclusionFacts: [],
      riskLevel: 'LOW',
      intervention: { status: 'NOT_REQUIRED' },
    });
    expect(result).toEqual({ status: 'INELIGIBLE', reason: 'NOT_PUBLISHED' });
  });

  it('fails closed on missing or UNKNOWN applicability inputs', () => {
    const v = version({
      lifecycleStatus: 'PUBLISHED',
      reviewState: 'CURRENT',
      validityState: 'VALID',
      releasedAt: '2026-11-01T00:00:00.000Z',
    });
    const result = evaluateProfessionalKnowledgeEligibility({
      version: v,
      approval: approvalFor(v),
      sceneBinding: {
        status: 'RESOLVED',
        sceneCode: 'DIGITAL_USE',
        scenePackageVersion: 'v1',
        refs: [
          {
            knowledgeId: v.knowledgeId,
            semanticVersion: v.semanticVersion,
            contentHash: v.contentHash,
            sourceSetHash: v.sourceSetHash,
          },
        ],
      },
      stage: 'UNKNOWN',
      ageBand: 'MINOR_14_17',
      locale: 'zh-CN',
      applicabilityFacts: null,
      exclusionFacts: [],
      riskLevel: 'LOW',
      intervention: { status: 'NOT_REQUIRED' },
    });
    expect(result).toEqual({ status: 'INELIGIBLE', reason: 'METADATA_UNKNOWN' });
  });

  it('keeps provider outage distinct from invalid approval', () => {
    const v = version();
    expect(
      validateProfessionalApproval({
        version: v,
        provider: { status: 'UNAVAILABLE', reason: 'TIMEOUT' },
        staffAuthority: { status: 'UNAVAILABLE', reason: 'not-read' },
        qualification: { status: 'UNAVAILABLE', reason: 'not-read' },
      })
    ).toEqual({ status: 'UNAVAILABLE', dependency: 'APPROVAL:TIMEOUT' });

    expect(
      validateProfessionalApproval({
        version: v,
        provider: { status: 'INVALID', reason: 'REVOKED' },
        staffAuthority: { status: 'UNAVAILABLE', reason: 'not-read' },
        qualification: { status: 'UNAVAILABLE', reason: 'not-read' },
      }).status
    ).toBe('UNAVAILABLE');
  });

  it('allows only lifecycle/projection changes after release, not semantic mutation', () => {
    const before = version({
      lifecycleStatus: 'PUBLISHED',
      reviewState: 'CURRENT',
      validityState: 'VALID',
    });
    expect(
      releasedSemanticMutationAllowed(before, {
        ...before,
        lifecycleStatus: 'RETIRED',
        reviewState: 'NEEDS_REVIEW',
        validityState: 'INVALID',
        revision: 2,
      })
    ).toBe(true);
    expect(
      releasedSemanticMutationAllowed(before, {
        ...before,
        contentHash: '2'.repeat(64),
      })
    ).toBe(false);
  });

  it('propagates only exact dependency impacts and does not invalidate on scene supersession alone', () => {
    expect(
      projectProfessionalKnowledgeDependencyImpact({
        current: { reviewState: 'CURRENT', validityState: 'VALID' },
        impact: 'SOURCE_WITHDRAWAL',
        exactDependent: true,
      })
    ).toEqual({
      reviewState: 'NEEDS_REVIEW',
      validityState: 'INVALID',
      eligibilitySuppressed: true,
    });

    expect(
      projectProfessionalKnowledgeDependencyImpact({
        current: { reviewState: 'CURRENT', validityState: 'VALID' },
        impact: 'SCENE_PACKAGE_SUPERSEDED',
        exactDependent: true,
      })
    ).toEqual({
      reviewState: 'CURRENT',
      validityState: 'VALID',
      eligibilitySuppressed: false,
    });

    expect(
      restoreProfessionalKnowledgeAfterNoMaterialImpact({
        reviewState: 'NEEDS_REVIEW',
        validityState: 'UNKNOWN',
      })
    ).toEqual({ reviewState: 'CURRENT', validityState: 'VALID' });
  });
});
