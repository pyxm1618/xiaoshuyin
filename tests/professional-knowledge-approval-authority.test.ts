import { describe, expect, it } from 'vitest';
import {
  hashProfessionalKnowledgeContent,
  hashProfessionalKnowledgeSourceSet,
  validateProfessionalApproval,
  type ProfessionalApprovalProof,
  type ProfessionalKnowledgeVersionSnapshot,
} from '../packages/domain/src/professional-knowledge.js';
import {
  unavailableProductionProfessionalApprovalProvider,
  unavailableProductionProfessionalQualificationProvider,
} from '../apps/server/api/src/services/professional-knowledge.js';

function version(): ProfessionalKnowledgeVersionSnapshot {
  const sources = [{
    sourceRef: 'source:1',
    sourceVersion: '1',
    sourceHash: 'a'.repeat(64),
    locator: null,
    metadata: {},
  }];
  const content = { body: 'knowledge' };
  return {
    id: 'v1', knowledgeId: 'k1', knowledgeKey: 'key', semanticVersion: '1.0.0',
    revision: 4, lifecycleStatus: 'CANDIDATE', reviewState: 'CURRENT',
    validityState: 'VALID', content,
    contentHash: hashProfessionalKnowledgeContent(content),
    sourceSetHash: hashProfessionalKnowledgeSourceSet(sources), sources,
    scope: {
      product: 'V1', sceneCode: 'DIGITAL_USE', scenePackageVersion: 'v1',
      stages: ['ASSESSMENT'], ageBands: ['MINOR_14_17'],
      applicability: ['a'], exclusions: [], riskLevels: ['LOW'], locale: 'zh-CN',
    },
    releasedAt: null, effectiveFrom: null, effectiveTo: null,
  };
}

function proof(v: ProfessionalKnowledgeVersionSnapshot): ProfessionalApprovalProof {
  const scope = {
    product: 'V1' as const, sceneCode: 'DIGITAL_USE', scenePackageVersion: 'v1',
    stages: ['ASSESSMENT'], ageBands: ['MINOR_14_17'] as const, locale: 'zh-CN',
  };
  return {
    proofId: 'proof-1', knowledgeId: v.knowledgeId,
    semanticVersion: v.semanticVersion, contentHash: v.contentHash,
    sourceSetHash: v.sourceSetHash, sourceRefs: ['source:1'], scope,
    reviewerIdentity: 'reviewer-1', reviewerAccountId: 'account-1',
    reviewerPersonId: 'person-1', staffAssignmentRef: 'assignment-1',
    staffCapability: 'PROFESSIONAL_REVIEW', qualificationRef: 'qualification-1',
    qualificationScope: scope, approvalStatus: 'APPROVED',
    publicationStatus: 'EFFECTIVE', reviewedAt: '2026-01-01T00:00:00Z',
    effectiveFrom: '2026-01-01T00:00:00Z', effectiveTo: '2027-01-01T00:00:00Z',
  };
}

function validate(v: ProfessionalKnowledgeVersionSnapshot, p: ProfessionalApprovalProof) {
  return validateProfessionalApproval({
    version: v,
    provider: { status: 'RESOLVED', proof: p },
    staffAuthority: {
      status: 'RESOLVED', assignmentRef: 'assignment-1',
      accountId: 'account-1', personId: 'person-1',
      capability: 'PROFESSIONAL_REVIEW', scope: 'GLOBAL',
    },
    qualification: {
      status: 'RESOLVED', qualificationRef: 'qualification-1',
      reviewerIdentity: 'reviewer-1', reviewerAccountId: 'account-1',
      reviewerPersonId: 'person-1', scope: p.qualificationScope,
      validFrom: '2026-01-01T00:00:00Z', validTo: '2027-01-01T00:00:00Z',
    },
    now: new Date('2026-11-17T00:00:00Z'),
  });
}

describe('professional knowledge external approval authority', () => {
  it('keeps production approval and qualification providers unavailable/fail-closed', async () => {
    const v = version();
    await expect(
      unavailableProductionProfessionalApprovalProvider.resolve({
        knowledgeId: v.knowledgeId, semanticVersion: v.semanticVersion,
        contentHash: v.contentHash, sourceSetHash: v.sourceSetHash,
      })
    ).resolves.toEqual({ status: 'UNAVAILABLE', reason: 'PROVIDER_UNAVAILABLE' });
    await expect(
      unavailableProductionProfessionalQualificationProvider.resolve({
        qualificationRef: 'q', reviewerIdentity: 'r', reviewerAccountId: 'a',
        reviewerPersonId: 'p',
        scope: {
          product: 'V1', sceneCode: 'DIGITAL_USE', scenePackageVersion: 'v1',
          stages: ['ASSESSMENT'], ageBands: ['MINOR_14_17'], locale: 'zh-CN',
        },
      })
    ).resolves.toMatchObject({ status: 'UNAVAILABLE' });
  });

  it('distinguishes provider timeout/unavailability from invalid proof', () => {
    const v = version();
    expect(
      validateProfessionalApproval({
        version: v,
        provider: { status: 'UNAVAILABLE', reason: 'TIMEOUT' },
        staffAuthority: { status: 'RESOLVED', assignmentRef: 'assignment-1', accountId: 'account-1', personId: 'person-1', capability: 'PROFESSIONAL_REVIEW', scope: 'GLOBAL' },
        qualification: { status: 'INVALID', reason: 'not-used' },
      })
    ).toEqual({ status: 'UNAVAILABLE', dependency: 'APPROVAL:TIMEOUT' });
    expect(
      validateProfessionalApproval({
        version: v,
        provider: { status: 'INVALID', reason: 'REVOKED' },
        staffAuthority: { status: 'RESOLVED', assignmentRef: 'assignment-1', accountId: 'account-1', personId: 'person-1', capability: 'PROFESSIONAL_REVIEW', scope: 'GLOBAL' },
        qualification: { status: 'INVALID', reason: 'not-used' },
      })
    ).toEqual({ status: 'INVALID', reason: 'APPROVAL:REVOKED' });
  });

  it.each([
    ['content hash', (p: ProfessionalApprovalProof) => ({ ...p, contentHash: 'b'.repeat(64) })],
    ['source set hash', (p: ProfessionalApprovalProof) => ({ ...p, sourceSetHash: 'b'.repeat(64) })],
    ['source refs', (p: ProfessionalApprovalProof) => ({ ...p, sourceRefs: ['source:other'] })],
    ['Staff assignment', (p: ProfessionalApprovalProof) => ({ ...p, staffAssignmentRef: 'other' })],
    ['qualification', (p: ProfessionalApprovalProof) => ({ ...p, qualificationRef: 'other' })],
    ['scope', (p: ProfessionalApprovalProof) => ({ ...p, scope: { ...p.scope, locale: 'en-US' } })],
    ['status', (p: ProfessionalApprovalProof) => ({ ...p, approvalStatus: 'REVOKED' as const })],
  ])('rejects exact-proof mismatch: %s', (_label, mutate) => {
    const v = version();
    expect(validate(v, mutate(proof(v))).status).toBe('INVALID');
  });

  it('accepts only an exact synthetic protocol proof', () => {
    const v = version();
    expect(validate(v, proof(v)).status).toBe('VALID');
  });
});
