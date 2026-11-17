import { describe, expect, it } from 'vitest';
import {
  hashProfessionalKnowledgeApprovalBinding,
  hashProfessionalKnowledgeContent,
  hashProfessionalKnowledgeSourceSet,
  validateProfessionalApproval,
  validateProfessionalQualification,
  type ProfessionalApprovalProof,
  type ProfessionalApprovalScope,
  type ProfessionalKnowledgeVersionSnapshot,
  type ProfessionalQualificationResult,
} from '../packages/domain/src/professional-knowledge.js';

const NOW = new Date('2026-11-17T12:00:00.000Z');

function fixture(): ProfessionalKnowledgeVersionSnapshot {
  const content = { body: 'phase2 professional content' };
  const sources = [{
    sourceRef: 'source:phase2:1',
    sourceVersion: '2026.11',
    sourceHash: 'a'.repeat(64),
    locator: 'section:1',
    metadata: { reviewed: true },
  }];
  return {
    id: 'version-phase2',
    knowledgeId: 'knowledge-phase2',
    knowledgeKey: 'phase2-knowledge',
    semanticVersion: '1.2.3',
    revision: 7,
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
      scenePackageVersion: 'scene-v7',
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
  };
}

function approvalScope(v: ProfessionalKnowledgeVersionSnapshot): ProfessionalApprovalScope {
  return {
    product: 'V1',
    sceneCode: v.scope.sceneCode,
    scenePackageVersion: v.scope.scenePackageVersion,
    stages: v.scope.stages,
    ageBands: v.scope.ageBands,
    locale: v.scope.locale,
  };
}

function proof(v: ProfessionalKnowledgeVersionSnapshot): ProfessionalApprovalProof {
  const scope = approvalScope(v);
  return {
    proofId: 'proof-phase2',
    knowledgeId: v.knowledgeId,
    semanticVersion: v.semanticVersion,
    contentHash: v.contentHash,
    sourceSetHash: v.sourceSetHash,
    semanticBindingHash: hashProfessionalKnowledgeApprovalBinding(v),
    sourceRefs: v.sources.map((source) => source.sourceRef),
    scope,
    reviewerIdentity: 'reviewer:phase2',
    reviewerAccountId: 'account-reviewer',
    reviewerPersonId: 'person-reviewer',
    staffAssignmentRef: 'assignment-reviewer',
    staffCapability: 'PROFESSIONAL_REVIEW',
    qualificationRef: 'qualification-reviewer',
    qualificationScope: scope,
    approvalStatus: 'APPROVED',
    publicationStatus: 'EFFECTIVE',
    reviewedAt: '2026-11-17T11:00:00.000Z',
    effectiveFrom: '2026-11-17T11:00:00.000Z',
    effectiveTo: '2027-11-17T12:00:00.000Z',
    professionalContentPackageRef: null,
  };
}

function staff() {
  return {
    status: 'RESOLVED' as const,
    assignmentRef: 'assignment-reviewer',
    accountId: 'account-reviewer',
    personId: 'person-reviewer',
    capability: 'PROFESSIONAL_REVIEW' as const,
    scope: 'GLOBAL' as const,
  };
}

function qualification(v: ProfessionalKnowledgeVersionSnapshot): Extract<ProfessionalQualificationResult, { status: 'RESOLVED' }> {
  return {
    status: 'RESOLVED',
    qualificationRef: 'qualification-reviewer',
    reviewerIdentity: 'reviewer:phase2',
    reviewerAccountId: 'account-reviewer',
    reviewerPersonId: 'person-reviewer',
    scope: approvalScope(v),
    validFrom: '2026-01-01T00:00:00.000Z',
    validTo: '2027-01-01T00:00:00.000Z',
  };
}

function validate(v: ProfessionalKnowledgeVersionSnapshot, p = proof(v), q = qualification(v)) {
  return validateProfessionalApproval({
    version: v,
    provider: { status: 'RESOLVED', proof: p },
    staffAuthority: staff(),
    qualification: q,
    now: NOW,
  });
}

describe('Slice 17 Phase 2 exact Professional Authority domain matrix', () => {
  it.each([
    ['content', (v: ProfessionalKnowledgeVersionSnapshot) => {
      const content = { ...v.content, body: 'changed body' };
      return { ...v, content, contentHash: hashProfessionalKnowledgeContent(content) };
    }],
    ['applicability', (v: ProfessionalKnowledgeVersionSnapshot) => ({
      ...v, scope: { ...v.scope, applicability: ['different-applicability'] },
    })],
    ['exclusions', (v: ProfessionalKnowledgeVersionSnapshot) => ({
      ...v, scope: { ...v.scope, exclusions: ['different-exclusion'] },
    })],
    ['risk levels', (v: ProfessionalKnowledgeVersionSnapshot) => ({
      ...v, scope: { ...v.scope, riskLevels: ['ELEVATED'] as const },
    })],
    ['intervention exact ref', (v: ProfessionalKnowledgeVersionSnapshot) => ({
      ...v,
      scope: {
        ...v.scope,
        interventionDefinitionRef: {
          definitionId: 'definition-2',
          definitionVersion: 4,
          contentHash: 'b'.repeat(64),
        },
      },
    })],
    ['locale', (v: ProfessionalKnowledgeVersionSnapshot) => ({
      ...v, scope: { ...v.scope, locale: 'en-US' },
    })],
    ['scene package version', (v: ProfessionalKnowledgeVersionSnapshot) => ({
      ...v, scope: { ...v.scope, scenePackageVersion: 'scene-v8' },
    })],
    ['stage scope', (v: ProfessionalKnowledgeVersionSnapshot) => ({
      ...v, scope: { ...v.scope, stages: ['FOLLOW_UP'] },
    })],
  ])('HIGH-001 rejects stale proof after %s mutation and accepts a fresh exact proof', (_label, mutate) => {
    const before = fixture();
    const stale = proof(before);
    const after = mutate(before);

    expect(validate(after, stale).status).toBe('INVALID');

    const fresh = proof(after);
    expect(fresh.contentHash).toBe(after.contentHash);
    expect(fresh.semanticBindingHash).toBe(hashProfessionalKnowledgeApprovalBinding(after));
    expect(validate(after, fresh)).toEqual({ status: 'VALID', proof: fresh });
  });

  it('HIGH-001 keeps body contentHash semantics separate from approval semantic binding', () => {
    const before = fixture();
    const after = {
      ...before,
      scope: { ...before.scope, applicability: ['changed-only-metadata'] },
    };
    expect(after.contentHash).toBe(before.contentHash);
    expect(hashProfessionalKnowledgeApprovalBinding(after))
      .not.toBe(hashProfessionalKnowledgeApprovalBinding(before));
  });

  it.each([
    ['empty effectiveTo', (p: ProfessionalApprovalProof) => ({ ...p, effectiveTo: '' })],
    ['malformed effectiveTo', (p: ProfessionalApprovalProof) => ({ ...p, effectiveTo: 'not-a-time' })],
    ['whitespace effectiveTo', (p: ProfessionalApprovalProof) => ({ ...p, effectiveTo: ' 2027-01-01T00:00:00Z ' })],
    ['past effectiveTo', (p: ProfessionalApprovalProof) => ({ ...p, effectiveTo: '2026-11-17T11:59:59.999Z' })],
    ['exact-now effectiveTo', (p: ProfessionalApprovalProof) => ({ ...p, effectiveTo: NOW.toISOString() })],
    ['future effectiveFrom', (p: ProfessionalApprovalProof) => ({ ...p, effectiveFrom: '2026-11-17T12:00:00.001Z' })],
    ['future reviewedAt', (p: ProfessionalApprovalProof) => ({ ...p, reviewedAt: '2026-11-17T12:00:00.001Z' })],
    ['empty reviewedAt', (p: ProfessionalApprovalProof) => ({ ...p, reviewedAt: '' })],
    ['malformed effectiveFrom', (p: ProfessionalApprovalProof) => ({ ...p, effectiveFrom: 'bad' })],
  ])('HIGH-002 fails closed for approval time case: %s', (_label, mutate) => {
    const v = fixture();
    expect(validate(v, mutate(proof(v))).status).toBe('INVALID');
  });

  it('HIGH-002 permits true null no-expiry and exact-now start/review boundaries', () => {
    const v = fixture();
    const p = {
      ...proof(v),
      reviewedAt: NOW.toISOString(),
      effectiveFrom: NOW.toISOString(),
      effectiveTo: null,
    };
    expect(validate(v, p).status).toBe('VALID');
  });

  it.each([
    ['wrong qualification ref', (q: ReturnType<typeof qualification>) => ({ ...q, qualificationRef: 'other' })],
    ['wrong reviewer identity', (q: ReturnType<typeof qualification>) => ({ ...q, reviewerIdentity: 'other' })],
    ['wrong reviewer account', (q: ReturnType<typeof qualification>) => ({ ...q, reviewerAccountId: 'other' })],
    ['wrong reviewer person', (q: ReturnType<typeof qualification>) => ({ ...q, reviewerPersonId: 'other' })],
    ['wrong scope', (q: ReturnType<typeof qualification>) => ({ ...q, scope: { ...q.scope, locale: 'en-US' } })],
    ['malformed validFrom', (q: ReturnType<typeof qualification>) => ({ ...q, validFrom: 'bad' })],
    ['empty validTo', (q: ReturnType<typeof qualification>) => ({ ...q, validTo: '' })],
    ['malformed validTo', (q: ReturnType<typeof qualification>) => ({ ...q, validTo: 'bad' })],
    ['past validTo', (q: ReturnType<typeof qualification>) => ({ ...q, validTo: '2026-11-17T11:59:59.999Z' })],
    ['exact-now validTo', (q: ReturnType<typeof qualification>) => ({ ...q, validTo: NOW.toISOString() })],
    ['future validFrom', (q: ReturnType<typeof qualification>) => ({ ...q, validFrom: '2026-11-17T12:00:00.001Z' })],
  ])('MEDIUM-002 / HIGH-002 rejects qualification laundering: %s', (_label, mutate) => {
    const v = fixture();
    const expected = {
      qualificationRef: 'qualification-reviewer',
      reviewerIdentity: 'reviewer:phase2',
      reviewerAccountId: 'account-reviewer',
      reviewerPersonId: 'person-reviewer',
      scope: approvalScope(v),
    };
    expect(validateProfessionalQualification({
      result: mutate(qualification(v)),
      expected,
      now: NOW,
    }).status).toBe('INVALID');
    expect(validate(v, proof(v), mutate(qualification(v))).status).toBe('INVALID');
  });

  it('MEDIUM-002 permits true qualification no-expiry and exact-now validFrom', () => {
    const v = fixture();
    const q = { ...qualification(v), validFrom: NOW.toISOString(), validTo: null };
    const result = validateProfessionalQualification({
      result: q,
      expected: {
        qualificationRef: q.qualificationRef,
        reviewerIdentity: q.reviewerIdentity,
        reviewerAccountId: q.reviewerAccountId,
        reviewerPersonId: q.reviewerPersonId,
        scope: q.scope,
      },
      now: NOW,
    });
    expect(result.status).toBe('VALID');
  });

  it('MEDIUM-001 keeps known INVALID separate from infrastructure UNAVAILABLE', () => {
    const v = fixture();
    expect(validateProfessionalApproval({
      version: v,
      provider: { status: 'INVALID', reason: 'REVOKED' },
      staffAuthority: { status: 'UNAVAILABLE', reason: 'DB_OUTAGE' },
      qualification: { status: 'UNAVAILABLE', reason: 'SERVICE_OUTAGE' },
      now: NOW,
    })).toEqual({ status: 'INVALID', reason: 'APPROVAL:REVOKED' });

    expect(validateProfessionalApproval({
      version: v,
      provider: { status: 'UNAVAILABLE', reason: 'TIMEOUT' },
      staffAuthority: { status: 'RESOLVED', ...staff() },
      qualification: { status: 'UNAVAILABLE', reason: 'SERVICE_OUTAGE' },
      now: NOW,
    })).toEqual({ status: 'UNAVAILABLE', dependency: 'APPROVAL:TIMEOUT' });

    expect(validateProfessionalQualification({
      result: { status: 'INVALID', reason: 'REVOKED' },
      expected: {
        qualificationRef: 'qualification-reviewer',
        reviewerIdentity: 'reviewer:phase2',
        reviewerAccountId: 'account-reviewer',
        reviewerPersonId: 'person-reviewer',
        scope: approvalScope(v),
      },
      now: NOW,
    })).toEqual({ status: 'INVALID', reason: 'PROFESSIONAL_QUALIFICATION_INVALID' });

    expect(validateProfessionalQualification({
      result: { status: 'UNAVAILABLE', reason: 'OUTAGE' },
      expected: {
        qualificationRef: 'qualification-reviewer',
        reviewerIdentity: 'reviewer:phase2',
        reviewerAccountId: 'account-reviewer',
        reviewerPersonId: 'person-reviewer',
        scope: approvalScope(v),
      },
      now: NOW,
    })).toEqual({ status: 'UNAVAILABLE', dependency: 'PROFESSIONAL_QUALIFICATION' });
  });
});
