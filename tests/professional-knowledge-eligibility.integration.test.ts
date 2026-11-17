import { describe, expect, it } from 'vitest';
import {
  evaluateProfessionalKnowledgeEligibility,
  hashProfessionalKnowledgeContent,
  hashProfessionalKnowledgeSourceSet,
  type ProfessionalKnowledgeVersionSnapshot,
  type ProfessionalApprovalValidation,
  type ScenePackageKnowledgeBindingResult,
} from '../packages/domain/src/professional-knowledge.js';

function fixture() {
  const sources = [{ sourceRef: 'source:1', sourceVersion: '1', sourceHash: 'a'.repeat(64), locator: null, metadata: {} }];
  const content = { body: 'knowledge' };
  const version: ProfessionalKnowledgeVersionSnapshot = {
    id: 'v1', knowledgeId: 'k1', knowledgeKey: 'key', semanticVersion: '1.0.0',
    revision: 4, lifecycleStatus: 'PUBLISHED', reviewState: 'CURRENT',
    validityState: 'VALID', content, contentHash: hashProfessionalKnowledgeContent(content),
    sourceSetHash: hashProfessionalKnowledgeSourceSet(sources), sources,
    scope: {
      product: 'V1', sceneCode: 'DIGITAL_USE', scenePackageVersion: 'v2',
      stages: ['ASSESSMENT'], ageBands: ['MINOR_14_17'],
      applicability: ['sleep-impact'], exclusions: ['acute-risk'],
      riskLevels: ['LOW'], locale: 'zh-CN',
    },
    releasedAt: '2026-11-01T00:00:00Z', effectiveFrom: '2026-11-01T00:00:00Z', effectiveTo: null,
  };
  const approval = { status: 'VALID', proof: {} as never } as ProfessionalApprovalValidation;
  const sceneBinding: ScenePackageKnowledgeBindingResult = {
    status: 'RESOLVED', sceneCode: 'DIGITAL_USE', scenePackageVersion: 'v2',
    refs: [{ knowledgeId: 'k1', semanticVersion: '1.0.0', contentHash: version.contentHash, sourceSetHash: version.sourceSetHash }],
  };
  const base = {
    version, approval, sceneBinding,
    stage: 'ASSESSMENT' as const, ageBand: 'MINOR_14_17' as const,
    locale: 'zh-CN', applicabilityFacts: ['sleep-impact'], exclusionFacts: [],
    riskLevel: 'LOW' as const, intervention: { status: 'NOT_REQUIRED' as const },
  };
  return { version, approval, sceneBinding, base };
}

describe('deterministic Professional Knowledge production eligibility', () => {
  it('accepts only the exact fully eligible version', () => {
    expect(evaluateProfessionalKnowledgeEligibility(fixture().base)).toEqual({ status: 'ELIGIBLE' });
  });

  it.each([
    ['lifecycle', { version: { lifecycleStatus: 'CANDIDATE' } }, 'NOT_PUBLISHED'],
    ['review', { version: { reviewState: 'NEEDS_REVIEW' } }, 'REVIEW_NOT_CURRENT'],
    ['validity', { version: { validityState: 'INVALID' } }, 'VALIDITY_NOT_VALID'],
    ['scene version', { sceneBinding: { scenePackageVersion: 'v1' } }, 'SCENE_PACKAGE_MISMATCH'],
    ['stage', { stage: 'FOLLOW_UP' }, 'STAGE_MISMATCH'],
    ['age', { ageBand: 'ADULT' }, 'AGE_BAND_MISMATCH'],
    ['locale', { locale: 'en-US' }, 'LOCALE_MISMATCH'],
    ['risk', { riskLevel: 'MODERATE' }, 'RISK_MISMATCH'],
    ['applicability', { applicabilityFacts: [] }, 'APPLICABILITY_MISMATCH'],
    ['exclusion', { exclusionFacts: ['acute-risk'] }, 'EXCLUDED'],
  ])('rejects %s mismatch', (_label, patch, reason) => {
    const { base, version, sceneBinding } = fixture();
    const next: any = { ...base, ...patch };
    if ('version' in patch) next.version = { ...version, ...(patch as any).version };
    if ('sceneBinding' in patch) next.sceneBinding = { ...sceneBinding, ...(patch as any).sceneBinding };
    expect(evaluateProfessionalKnowledgeEligibility(next)).toEqual({ status: 'INELIGIBLE', reason });
  });

  it('treats empty approved Scene set as ineligible and never nearest-matches', () => {
    const { base } = fixture();
    expect(evaluateProfessionalKnowledgeEligibility({
      ...base,
      sceneBinding: { status: 'RESOLVED', sceneCode: 'DIGITAL_USE', scenePackageVersion: 'v2', refs: [] },
    })).toEqual({ status: 'INELIGIBLE', reason: 'KNOWLEDGE_NOT_BOUND' });
  });

  it('fails closed on missing/UNKNOWN metadata and dependency outage', () => {
    const { base } = fixture();
    expect(evaluateProfessionalKnowledgeEligibility({ ...base, stage: 'UNKNOWN' })).toEqual({
      status: 'INELIGIBLE', reason: 'METADATA_UNKNOWN',
    });
    expect(evaluateProfessionalKnowledgeEligibility({
      ...base,
      approval: { status: 'UNAVAILABLE', dependency: 'APPROVAL:TIMEOUT' },
    })).toEqual({ status: 'UNAVAILABLE', dependency: 'APPROVAL:TIMEOUT' });
  });

  it('fails closed when the merged authoritative InterventionDefinition dependency is unavailable', () => {
    const { base, version } = fixture();
    const expected = { definitionId: 'i1', definitionVersion: 1, contentHash: 'f'.repeat(64) };
    expect(evaluateProfessionalKnowledgeEligibility({
      ...base,
      version: { ...version, scope: { ...version.scope, interventionDefinitionRef: expected } },
      intervention: { status: 'UNAVAILABLE', reason: 'INTERVENTION_DEFINITION_DEPENDENCY_UNAVAILABLE' },
    })).toEqual({ status: 'UNAVAILABLE', dependency: 'INTERVENTION_DEFINITION' });
  });
});
