import { describe, expect, it } from 'vitest';
import {
  evaluateInterventionEligibility,
  type InterventionEligibilityInput,
} from '../../packages/domain/src/index.js';
import { interventionDefinition } from '../support/intervention.js';

const EVIDENCE =
  'DIALOGUE_MESSAGE:00000000-0000-7000-8000-000000000001';

function baseline(): InterventionEligibilityInput {
  const definition = interventionDefinition();
  return {
    authorization: 'PASS',
    case: {
      id: 'case-unknown',
      familyId: 'family-unknown',
      status: 'OPEN',
      phase: 'GOALS',
      version: 3,
      isPrimary: true,
    },
    formulation: {
      id: 'formulation-unknown',
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
    facts: { 'family.ready': true, 'safety.worsening': false },
    participation: { CHILD: 'PASS' },
    consent: { TEST_CONSENT: 'PASS' },
    consideredDefinitions: [],
    compliance: 'PASS',
    safety: 'PASS',
    dependencyRevisionRefs: ['CASE:case-unknown:v3'],
  };
}

describe('Slice 16 UNKNOWN-family eligibility semantics', () => {
  const cases: Array<{
    label: string;
    mutate(input: InterventionEligibilityInput): InterventionEligibilityInput;
    expectedGate: string;
  }> = [
    { label: 'authorization UNKNOWN', mutate: (x) => ({ ...x, authorization: 'UNKNOWN' }), expectedGate: 'authorization' },
    { label: 'professional authority UNAVAILABLE', mutate: (x) => ({ ...x, professionalAuthority: { state: 'UNAVAILABLE', approvalProofRef: null, reason: 'DEPENDENCY_UNAVAILABLE' } }), expectedGate: 'professionalApproval' },
    { label: 'package UNKNOWN', mutate: (x) => ({ ...x, packageInclusion: 'UNKNOWN' }), expectedGate: 'packageInclusion' },
    { label: 'age UNKNOWN when required', mutate: (x) => ({ ...x, ageYears: null }), expectedGate: 'ageDevelopment' },
    { label: 'Evidence NOT_COLLECTED', mutate: (x) => ({ ...x, evidence: { [EVIDENCE]: { state: 'NOT_COLLECTED', revisionRef: EVIDENCE } } }), expectedGate: 'evidence' },
    { label: 'applicability fact absent', mutate: (x) => ({ ...x, facts: { 'safety.worsening': false } }), expectedGate: 'applicability' },
    { label: 'contraindication fact absent', mutate: (x) => ({ ...x, facts: { 'family.ready': true } }), expectedGate: 'exclusion' },
    { label: 'participation UNKNOWN', mutate: (x) => ({ ...x, participation: { CHILD: 'UNKNOWN' } }), expectedGate: 'participation' },
    { label: 'Consent UNKNOWN', mutate: (x) => ({ ...x, consent: { TEST_CONSENT: 'UNKNOWN' } }), expectedGate: 'consent' },
    { label: 'Compliance UNKNOWN', mutate: (x) => ({ ...x, compliance: 'UNKNOWN' }), expectedGate: 'compliance' },
    { label: 'Safety UNKNOWN', mutate: (x) => ({ ...x, safety: 'UNKNOWN' }), expectedGate: 'safety' },
  ];

  for (const row of cases) {
    it(row.label + ' fails closed and never becomes allowed', () => {
      const result = evaluateInterventionEligibility(row.mutate(baseline()));
      expect(result.allowed).toBe(false);
      expect(
        result.blockers.some(
          (blocker) =>
            blocker.gate === row.expectedGate && blocker.state === 'UNKNOWN'
        )
      ).toBe(true);
    });
  }

  it('preserves DECLINED and CONFLICTING as blockers instead of coercing safe false', () => {
    for (const state of ['DECLINED', 'CONFLICTING'] as const) {
      const input = baseline();
      const result = evaluateInterventionEligibility({
        ...input,
        evidence: { [EVIDENCE]: { state, revisionRef: EVIDENCE } },
      });
      expect(result.allowed, state).toBe(false);
      expect(result.reasonCodes, state).toContain('EVIDENCE_MISSING_OR_UNKNOWN');
    }
  });
});
