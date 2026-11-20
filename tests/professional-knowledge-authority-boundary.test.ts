import { describe, expect, it } from 'vitest';
import {
  validateProfessionalApproval,
  type ProfessionalApprovalProof,
  type ProfessionalKnowledgeVersionSnapshot,
} from '../packages/domain/src/professional-knowledge.js';
import {
  hashProfessionalKnowledgeApprovalBinding,
  hashProfessionalKnowledgeContent,
  hashProfessionalKnowledgeSourceSet,
} from '../packages/domain/src/professional-knowledge.js';

function fixture() {
  const sources = [{
    sourceRef: 'source:1',
    sourceVersion: 'v1',
    sourceHash: '1'.repeat(64),
    locator: null,
    metadata: {},
  }];
  const content = { body: 'bounded knowledge' };
  const version: ProfessionalKnowledgeVersionSnapshot = {
    id: 'v1',
    knowledgeId: 'k1',
    knowledgeKey: 'key',
    semanticVersion: '1.0.0',
    revision: 3,
    lifecycleStatus: 'CANDIDATE',
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
      applicability: ['a'],
      exclusions: [],
      riskLevels: ['LOW'],
      locale: 'zh-CN',
    },
    releasedAt: null,
    effectiveFrom: null,
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
  const proof: ProfessionalApprovalProof = {
    proofId: 'proof-1',
    knowledgeId: version.knowledgeId,
    semanticVersion: version.semanticVersion,
    contentHash: version.contentHash,
    sourceSetHash: version.sourceSetHash,
    semanticBindingHash: hashProfessionalKnowledgeApprovalBinding(version),
    sourceRefs: ['source:1'],
    scope,
    reviewerIdentity: 'external:reviewer:1',
    reviewerAccountId: 'account-1',
    reviewerPersonId: 'person-1',
    staffAssignmentRef: 'assignment-1',
    staffCapability: 'PROFESSIONAL_REVIEW',
    qualificationRef: 'qualification-1',
    qualificationScope: scope,
    approvalStatus: 'APPROVED',
    publicationStatus: 'EFFECTIVE',
    reviewedAt: '2026-01-01T00:00:00.000Z',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: '2027-01-01T00:00:00.000Z',
  };
  return { version, proof, scope };
}

describe('professional knowledge Staff / qualification authority boundary', () => {
  it('rejects Staff-valid / qualification-missing without laundering Staff into qualification', () => {
    const { version, proof } = fixture();
    const result = validateProfessionalApproval({
      version,
      provider: { status: 'RESOLVED', proof },
      staffAuthority: {
        status: 'RESOLVED',
        assignmentRef: 'assignment-1',
        accountId: 'account-1',
        personId: 'person-1',
        capability: 'PROFESSIONAL_REVIEW',
        scope: 'GLOBAL',
      },
      qualification: { status: 'UNAVAILABLE', reason: 'UNASSIGNED' },
      now: new Date('2026-11-17T00:00:00Z'),
    });
    expect(result).toEqual({
      status: 'UNAVAILABLE',
      dependency: 'PROFESSIONAL_QUALIFICATION',
    });
  });

  it('rejects qualification-valid / Staff-missing without laundering qualification into Staff authority', () => {
    const { version, proof, scope } = fixture();
    const result = validateProfessionalApproval({
      version,
      provider: { status: 'RESOLVED', proof },
      staffAuthority: { status: 'INVALID', reason: 'REVOKED' },
      qualification: {
        status: 'RESOLVED',
        qualificationRef: 'qualification-1',
        reviewerIdentity: 'external:reviewer:1',
        reviewerAccountId: 'account-1',
        reviewerPersonId: 'person-1',
        scope,
        validFrom: '2026-01-01T00:00:00Z',
        validTo: '2027-01-01T00:00:00Z',
      },
      now: new Date('2026-11-17T00:00:00Z'),
    });
    expect(result).toEqual({ status: 'INVALID', reason: 'STAFF_AUTHORITY_INVALID' });
  });

  it('accepts only exact current bounded Staff + qualification + approval facts', () => {
    const { version, proof, scope } = fixture();
    const result = validateProfessionalApproval({
      version,
      provider: { status: 'RESOLVED', proof },
      staffAuthority: {
        status: 'RESOLVED',
        assignmentRef: 'assignment-1',
        accountId: 'account-1',
        personId: 'person-1',
        capability: 'PROFESSIONAL_REVIEW',
        scope: 'GLOBAL',
      },
      qualification: {
        status: 'RESOLVED',
        qualificationRef: 'qualification-1',
        reviewerIdentity: 'external:reviewer:1',
        reviewerAccountId: 'account-1',
        reviewerPersonId: 'person-1',
        scope,
        validFrom: '2026-01-01T00:00:00Z',
        validTo: '2027-01-01T00:00:00Z',
      },
      now: new Date('2026-11-17T00:00:00Z'),
    });
    expect(result.status).toBe('VALID');
  });

  it.each([
    ['revoked Staff', { status: 'INVALID', reason: 'REVOKED' } as const],
    ['expired Staff', { status: 'INVALID', reason: 'EXPIRED' } as const],
  ])('fails closed for %s authority', (_label, staffAuthority) => {
    const { version, proof, scope } = fixture();
    expect(
      validateProfessionalApproval({
        version,
        provider: { status: 'RESOLVED', proof },
        staffAuthority,
        qualification: {
          status: 'RESOLVED',
          qualificationRef: 'qualification-1',
          reviewerIdentity: 'external:reviewer:1',
          reviewerAccountId: 'account-1',
          reviewerPersonId: 'person-1',
          scope,
          validFrom: '2026-01-01T00:00:00Z',
          validTo: '2027-01-01T00:00:00Z',
        },
      }).status
    ).toBe('INVALID');
  });

  it.each([
    ['revoked qualification', { status: 'INVALID', reason: 'REVOKED' } as const],
    ['expired qualification', { status: 'INVALID', reason: 'EXPIRED' } as const],
  ])('fails closed for %s', (_label, qualification) => {
    const { version, proof } = fixture();
    expect(
      validateProfessionalApproval({
        version,
        provider: { status: 'RESOLVED', proof },
        staffAuthority: {
          status: 'RESOLVED',
          assignmentRef: 'assignment-1',
          accountId: 'account-1',
          personId: 'person-1',
          capability: 'PROFESSIONAL_REVIEW',
          scope: 'GLOBAL',
        },
        qualification,
      }).status
    ).toBe('INVALID');
  });
});
