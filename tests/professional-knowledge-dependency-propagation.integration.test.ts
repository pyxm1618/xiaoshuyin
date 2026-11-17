import { describe, expect, it } from 'vitest';
import {
  hashProfessionalKnowledgeApprovalBinding,
  hashProfessionalKnowledgeContent,
  hashProfessionalKnowledgeSourceSet,
  projectProfessionalKnowledgeDependencyImpact,
  validateProfessionalApproval,
  type ProfessionalApprovalProof,
  type ProfessionalKnowledgeVersionSnapshot,
} from '../packages/domain/src/professional-knowledge.js';

describe('impact-scoped Professional Knowledge dependency propagation', () => {
  it.each([
    ['SOURCE_WITHDRAWAL', 'NEEDS_REVIEW', 'INVALID', true],
    ['SOURCE_CORRECTION', 'NEEDS_REVIEW', 'UNKNOWN', true],
    ['SCENE_APPLICABILITY_MATERIAL_CHANGE', 'NEEDS_REVIEW', 'UNKNOWN', true],
    ['APPROVAL_EXPIRED', 'CURRENT', 'VALID', true],
    ['APPROVAL_REVOKED', 'CURRENT', 'VALID', true],
    ['STAFF_AUTHORITY_REVOKED', 'CURRENT', 'VALID', true],
    ['QUALIFICATION_REVOKED', 'CURRENT', 'VALID', true],
    ['SCENE_PACKAGE_SUPERSEDED', 'CURRENT', 'VALID', false],
  ] as const)('%s affects only its exact dependent with expected projection', (impact, reviewState, validityState, eligibilitySuppressed) => {
    expect(projectProfessionalKnowledgeDependencyImpact({
      current: { reviewState: 'CURRENT', validityState: 'VALID' },
      impact, exactDependent: true,
    })).toEqual({ reviewState, validityState, eligibilitySuppressed });
    expect(projectProfessionalKnowledgeDependencyImpact({
      current: { reviewState: 'CURRENT', validityState: 'VALID' },
      impact, exactDependent: false,
    })).toEqual({ reviewState: 'CURRENT', validityState: 'VALID', eligibilitySuppressed: false });
  });

  it('does not require a new content version for approval expiry/revocation', () => {
    const current = { reviewState: 'CURRENT' as const, validityState: 'VALID' as const };
    const expired = projectProfessionalKnowledgeDependencyImpact({
      current, impact: 'APPROVAL_EXPIRED', exactDependent: true,
    });
    expect(expired).toMatchObject(current);
    expect(expired.eligibilitySuppressed).toBe(true);
  });

  it('same exact Knowledge version becomes approval-valid again when a fresh proof replaces an expired proof', () => {
    const sources = [{
      sourceRef: 'source:renewal',
      sourceVersion: '1',
      sourceHash: 'a'.repeat(64),
      locator: null,
      metadata: {},
    }];
    const content = { body: 'unchanged content' };
    const version: ProfessionalKnowledgeVersionSnapshot = {
      id: 'version-1',
      knowledgeId: 'knowledge-1',
      knowledgeKey: 'renewal',
      semanticVersion: '1.0.0',
      revision: 7,
      lifecycleStatus: 'PUBLISHED',
      reviewState: 'CURRENT',
      validityState: 'VALID',
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
        exclusions: [],
        riskLevels: ['LOW'],
        locale: 'zh-CN',
      },
      releasedAt: '2026-01-01T00:00:00Z',
      effectiveFrom: '2026-01-01T00:00:00Z',
      effectiveTo: null,
    };
    const scope = {
      product: 'V1' as const,
      sceneCode: 'DIGITAL_USE',
      scenePackageVersion: 'v1',
      stages: ['ASSESSMENT'],
      ageBands: ['MINOR_14_17'] as const,
      locale: 'zh-CN',
    };
    const baseProof: ProfessionalApprovalProof = {
      proofId: 'proof-old',
      knowledgeId: version.knowledgeId,
      semanticVersion: version.semanticVersion,
      contentHash: version.contentHash,
      sourceSetHash: version.sourceSetHash,
      semanticBindingHash: hashProfessionalKnowledgeApprovalBinding(version),
      sourceRefs: ['source:renewal'],
      scope,
      reviewerIdentity: 'reviewer-1',
      reviewerAccountId: 'account-1',
      reviewerPersonId: 'person-1',
      staffAssignmentRef: 'assignment-1',
      staffCapability: 'PROFESSIONAL_REVIEW',
      qualificationRef: 'qualification-1',
      qualificationScope: scope,
      approvalStatus: 'APPROVED',
      publicationStatus: 'EFFECTIVE',
      reviewedAt: '2026-01-01T00:00:00Z',
      effectiveFrom: '2026-01-01T00:00:00Z',
      effectiveTo: '2026-06-01T00:00:00Z',
    };
    const authority = {
      staffAuthority: {
        status: 'RESOLVED' as const,
        assignmentRef: 'assignment-1',
        accountId: 'account-1',
        personId: 'person-1',
        capability: 'PROFESSIONAL_REVIEW' as const,
        scope: 'GLOBAL' as const,
      },
      qualification: {
        status: 'RESOLVED' as const,
        qualificationRef: 'qualification-1',
        reviewerIdentity: 'reviewer-1',
        reviewerAccountId: 'account-1',
        reviewerPersonId: 'person-1',
        scope,
        validFrom: '2026-01-01T00:00:00Z',
        validTo: '2027-01-01T00:00:00Z',
      },
    };

    expect(validateProfessionalApproval({
      version,
      provider: { status: 'RESOLVED', proof: baseProof },
      ...authority,
      now: new Date('2026-11-17T00:00:00Z'),
    }).status).toBe('INVALID');

    const renewedProof: ProfessionalApprovalProof = {
      ...baseProof,
      proofId: 'proof-renewed',
      reviewedAt: '2026-11-01T00:00:00Z',
      effectiveFrom: '2026-11-01T00:00:00Z',
      effectiveTo: '2027-11-01T00:00:00Z',
    };
    expect(validateProfessionalApproval({
      version,
      provider: { status: 'RESOLVED', proof: renewedProof },
      ...authority,
      now: new Date('2026-11-17T00:00:00Z'),
    })).toEqual({ status: 'VALID', proof: renewedProof });

    expect(version.semanticVersion).toBe('1.0.0');
    expect(version.contentHash).toBe(renewedProof.contentHash);
    expect(version.sourceSetHash).toBe(renewedProof.sourceSetHash);
  });
});
