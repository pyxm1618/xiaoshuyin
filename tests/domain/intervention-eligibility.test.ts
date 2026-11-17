import { describe, expect, it } from 'vitest';
import {
  evaluateInterventionEligibility,
  type InterventionEligibilityInput,
} from '../../packages/domain/src/index.js';
import { interventionDefinition } from '../support/intervention.js';

const EVIDENCE = 'DIALOGUE_MESSAGE:00000000-0000-7000-8000-000000000001';

function allowedInput(): InterventionEligibilityInput {
  const definition = interventionDefinition();
  return {
    authorization: 'PASS',
    case: {
      id: 'case-1',
      familyId: 'family-1',
      status: 'OPEN',
      phase: 'GOALS',
      version: 4,
      isPrimary: true,
    },
    formulation: {
      id: 'formulation-1',
      version: 2,
      status: 'CONFIRMED',
      reviewState: 'CURRENT',
      dependencyRefs: ['FORMULATION:PRIMARY_PROBLEM'],
    },
    evidence: {
      [EVIDENCE]: { state: 'VALUE', revisionRef: EVIDENCE },
    },
    scenePackageVersion: 'v1',
    expectedDefinition: {
      id: definition.id,
      sceneId: definition.sceneId,
      interventionCode: definition.interventionCode,
      version: definition.version,
      contentHash: definition.contentHash,
    },
    definition,
    professionalAuthority: {
      state: 'VALID',
      approvalProofRef: 'TEST_APPROVAL:1',
      reason: null,
    },
    packageInclusion: 'PASS',
    ageYears: 15,
    developmentStages: ['ADOLESCENCE'],
    facts: {
      'family.ready': true,
      'safety.worsening': false,
    },
    participation: { CHILD: 'PASS' },
    consent: { TEST_CONSENT: 'PASS' },
    consideredDefinitions: [],
    compliance: 'PASS',
    safety: 'PASS',
    dependencyRevisionRefs: ['CASE:case-1:v4', 'FORMULATION:formulation-1:v2', EVIDENCE, 'PACKAGE:v1'],
  };
}

describe('Slice 16 deterministic intervention eligibility', () => {
  it('returns allowed=true only when every independent gate passes', () => {
    const result = evaluateInterventionEligibility(allowedInput());
    expect(result.allowed).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.approvalProofRef).toBe('TEST_APPROVAL:1');
  });

  const blockers: Array<{
    label: string;
    mutate(input: InterventionEligibilityInput): InterventionEligibilityInput;
    reason: string;
  }> = [
    { label: 'authorization', mutate: (x) => ({ ...x, authorization: 'BLOCK' }), reason: 'AUTHORIZATION_BLOCK' },
    { label: 'cross/current Case', mutate: (x) => ({ ...x, case: { ...x.case, isPrimary: false } }), reason: 'CASE_NOT_CURRENT' },
    { label: 'missing formulation', mutate: (x) => ({ ...x, formulation: null }), reason: 'FORMULATION_MISSING_OR_STALE' },
    { label: 'stale formulation', mutate: (x) => ({ ...x, formulation: { ...x.formulation!, reviewState: 'NEEDS_REVIEW' } }), reason: 'FORMULATION_MISSING_OR_STALE' },
    { label: 'UNKNOWN evidence', mutate: (x) => ({ ...x, evidence: { [EVIDENCE]: { state: 'UNKNOWN', revisionRef: EVIDENCE } } }), reason: 'EVIDENCE_MISSING_OR_UNKNOWN' },
    { label: 'DECLINED evidence', mutate: (x) => ({ ...x, evidence: { [EVIDENCE]: { state: 'DECLINED', revisionRef: EVIDENCE } } }), reason: 'EVIDENCE_MISSING_OR_UNKNOWN' },
    { label: 'NOT_COLLECTED evidence', mutate: (x) => ({ ...x, evidence: { [EVIDENCE]: { state: 'NOT_COLLECTED', revisionRef: EVIDENCE } } }), reason: 'EVIDENCE_MISSING_OR_UNKNOWN' },
    { label: 'CONFLICTING evidence', mutate: (x) => ({ ...x, evidence: { [EVIDENCE]: { state: 'CONFLICTING', revisionRef: EVIDENCE } } }), reason: 'EVIDENCE_MISSING_OR_UNKNOWN' },
    { label: 'professional authority unavailable', mutate: (x) => ({ ...x, professionalAuthority: { state: 'UNAVAILABLE', approvalProofRef: null, reason: 'NOT_PROFESSIONALLY_APPROVED' } }), reason: 'NOT_PROFESSIONALLY_APPROVED' },
    { label: 'wrong package', mutate: (x) => ({ ...x, packageInclusion: 'BLOCK' }), reason: 'PACKAGE_NOT_INCLUDED' },
    { label: 'unknown age', mutate: (x) => ({ ...x, ageYears: null }), reason: 'AGE_OR_DEVELOPMENT_MISMATCH' },
    { label: 'exclusion', mutate: (x) => ({ ...x, facts: { ...x.facts, 'safety.worsening': true } }), reason: 'EXCLUSION_OR_CONTRAINDICATION' },
    { label: 'participation', mutate: (x) => ({ ...x, participation: { CHILD: 'BLOCK' } }), reason: 'PARTICIPATION_BLOCK' },
    { label: 'consent', mutate: (x) => ({ ...x, consent: { TEST_CONSENT: 'BLOCK' } }), reason: 'CONSENT_BLOCK' },
    { label: 'combination conflict', mutate: (x) => ({
      ...x,
      consideredDefinitions: [{
        id: '00000000-0000-7000-8000-000000000017',
        sceneId: 'DIGITAL_USE',
        interventionCode: 'TEST_CONFLICT',
        version: 1,
        contentHash: 'b'.repeat(64),
      }],
    }), reason: 'COMBINATION_CONFLICT' },
    { label: 'compliance', mutate: (x) => ({ ...x, compliance: 'BLOCK' }), reason: 'COMPLIANCE_BLOCK' },
    { label: 'safety', mutate: (x) => ({ ...x, safety: 'BLOCK' }), reason: 'SAFETY_BLOCK' },
  ];

  for (const row of blockers) {
    it('fails closed: ' + row.label, () => {
      const result = evaluateInterventionEligibility(row.mutate(allowedInput()));
      expect(result.allowed).toBe(false);
      expect(result.reasonCodes).toContain(row.reason);
    });
  }

  it('evaluates scalar equality and list membership deterministically', () => {
    const base = allowedInput();
    const definition = interventionDefinition({
      ...base.definition!.semantic,
      applicable_conditions: [
        { fact_ref: 'family.ready', operator: 'EQUALS', value: true },
        { fact_ref: 'family.mode', operator: 'NOT_EQUALS', value: 'BLOCKED' },
        { fact_ref: 'family.tags', operator: 'IN', value: ['READY', 'STABLE'] },
        { fact_ref: 'family.risk', operator: 'NOT_IN', value: ['HIGH', 'CRITICAL'] },
      ],
      exclusion_or_contraindication_conditions: [],
    });
    const result = evaluateInterventionEligibility({
      ...base,
      expectedDefinition: {
        id: definition.id,
        sceneId: definition.sceneId,
        interventionCode: definition.interventionCode,
        version: definition.version,
        contentHash: definition.contentHash,
      },
      definition,
      facts: {
        'family.ready': true,
        'family.mode': 'OPEN',
        'family.tags': ['READY'],
        'family.risk': 'LOW',
      },
    });
    expect(result.allowed).toBe(true);
    expect(result.applicableConditionResult).toBe('MATCH');
  });

  it('blocks a matching list-based contraindication instead of silently allowing it', () => {
    const base = allowedInput();
    const definition = interventionDefinition({
      ...base.definition!.semantic,
      applicable_conditions: [],
      exclusion_or_contraindication_conditions: [
        { fact_ref: 'safety.signals', operator: 'IN', value: ['WORSENING'] },
      ],
    });
    const result = evaluateInterventionEligibility({
      ...base,
      expectedDefinition: {
        id: definition.id,
        sceneId: definition.sceneId,
        interventionCode: definition.interventionCode,
        version: definition.version,
        contentHash: definition.contentHash,
      },
      definition,
      facts: { 'safety.signals': ['WORSENING'] },
    });
    expect(result.allowed).toBe(false);
    expect(result.exclusionHits).toEqual(['safety.signals']);
    expect(result.reasonCodes).toContain('EXCLUSION_OR_CONTRAINDICATION');
  });

  it('fails closed if an unsupported condition shape reaches the evaluator at runtime', () => {
    const base = allowedInput();
    const definition = interventionDefinition({
      ...base.definition!.semantic,
      applicable_conditions: [],
      exclusion_or_contraindication_conditions: [
        {
          fact_ref: 'safety.signals',
          operator: 'EQUALS',
          value: ['WORSENING'],
        } as never,
      ],
    });
    const result = evaluateInterventionEligibility({
      ...base,
      expectedDefinition: {
        id: definition.id,
        sceneId: definition.sceneId,
        interventionCode: definition.interventionCode,
        version: definition.version,
        contentHash: definition.contentHash,
      },
      definition,
      facts: { 'safety.signals': ['WORSENING'] },
    });
    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toContain('UNKNOWN_DEPENDENCY');
  });

  it('never classifies NaN or infinite age as MATCH', () => {
    for (const ageYears of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      const result = evaluateInterventionEligibility({
        ...allowedInput(),
        ageYears,
      });
      expect(result.allowed, String(ageYears)).toBe(false);
      expect(result.ageScopeResult, String(ageYears)).not.toBe('MATCH');
      expect(result.reasonCodes).toContain('AGE_OR_DEVELOPMENT_MISMATCH');
    }
  });

  it('does not require exact Case phase equality and remains read-only past GOALS', () => {
    for (const phase of ['GOALS', 'PLANNING', 'EXECUTION', 'REVIEW', 'MAINTENANCE']) {
      const input = allowedInput();
      const result = evaluateInterventionEligibility({
        ...input,
        case: { ...input.case, phase },
      });
      expect(result.allowed, phase).toBe(true);
    }
  });

  it('eligibility result contains no Phase-4 execution object', () => {
    const result = evaluateInterventionEligibility(allowedInput());
    const serialized = JSON.stringify(result);
    for (const forbidden of ['InterventionInstance', '"goal"', '"plan"', '"task"', '"outcome"']) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
