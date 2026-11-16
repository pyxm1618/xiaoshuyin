import type {
  InterventionDefinitionRecord,
  InterventionDefinitionSemanticPayload,
} from '../../packages/domain/src/index.js';
import type {
  InterventionProfessionalAuthorityProof,
  InterventionProfessionalAuthorityProvider,
  InterventionProfessionalQualificationProvider,
} from '../../apps/server/api/src/services/intervention-professional-authority.js';

export function interventionSemantic(
  overrides: Partial<InterventionDefinitionSemanticPayload> = {}
): InterventionDefinitionSemanticPayload {
  return {
    target_problem_or_mechanism: 'TEST_ONLY_MECHANISM',
    formulation_dependencies: ['FORMULATION:PRIMARY_PROBLEM'],
    supporting_evidence_requirements: ['DIALOGUE_MESSAGE:00000000-0000-7000-8000-000000000001'],
    applicable_conditions: [{ fact_ref: 'family.ready', operator: 'EQUALS', value: true }],
    exclusion_or_contraindication_conditions: [{ fact_ref: 'safety.worsening', operator: 'EQUALS', value: true }],
    age_and_development_scope: {
      min_age_years: 10,
      max_age_years: 17,
      development_stages: ['ADOLESCENCE'],
    },
    rationale: 'TEST_ONLY_RATIONALE',
    intervention_steps: ['TEST_ONLY_STEP_1'],
    participation_and_consent_requirements: {
      required_participation_refs: ['CHILD'],
      required_consent_purposes: ['TEST_CONSENT'],
    },
    baseline_and_observation: {
      baseline_refs: ['BASELINE:TEST'],
      observation_refs: ['OBSERVATION:TEST'],
    },
    expected_observable_change: ['TEST_ONLY_OBSERVABLE_CHANGE'],
    burden_and_barriers: ['TEST_ONLY_BARRIER'],
    adverse_or_worsening_signals: ['TEST_ONLY_WORSENING'],
    review_window_and_criteria: {
      min_days: 7,
      max_days: 14,
      criteria: ['TEST_ONLY_REVIEW_CRITERION'],
    },
    stop_reassess_safety_referral_conditions: ['TEST_ONLY_STOP_CONDITION'],
    allowed_combinations: ['TEST_ALLOWED'],
    conflicting_interventions: ['TEST_CONFLICT'],
    professional_source_refs: ['TEST_SOURCE:v1'],
    ...overrides,
  };
}

export function interventionDefinition(
  semantic: InterventionDefinitionSemanticPayload = interventionSemantic()
): InterventionDefinitionRecord {
  return {
    id: '00000000-0000-7000-8000-000000000016',
    sceneId: 'DIGITAL_USE',
    interventionCode: 'TEST_INTERVENTION',
    version: 1,
    contentHash: 'a'.repeat(64),
    state: 'CANDIDATE',
    revision: 1,
    semantic,
    supersedesId: null,
    createdByPersonId: '00000000-0000-7000-8000-000000000099',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    supersededAt: null,
    retiredAt: null,
  };
}

export function professionalProof(
  overrides: Partial<InterventionProfessionalAuthorityProof> = {}
): InterventionProfessionalAuthorityProof {
  return {
    approvalProofRef: 'TEST_APPROVAL:1',
    definitionId: '00000000-0000-7000-8000-000000000016',
    definitionVersion: 1,
    contentHash: 'a'.repeat(64),
    sourceRefs: ['TEST_SOURCE:v1'],
    approvalScope: 'DIGITAL_USE',
    reviewerIdentityRef: 'TEST_REVIEWER:1',
    staffAuthority: {
      assignmentRef: 'TEST_STAFF_ASSIGNMENT:1',
      capability: 'PROFESSIONAL_REVIEW',
      scopeRef: 'GLOBAL',
      status: 'VALID',
    },
    professionalQualification: {
      qualificationRef: 'TEST_QUALIFICATION:1',
      scopeRef: 'DIGITAL_USE',
      status: 'VALID',
    },
    reviewStatus: 'APPROVED',
    publicationStatus: 'PUBLISHED',
    lifecycleStatus: 'CURRENT',
    reviewedAt: '2026-01-01T00:00:00.000Z',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: '2027-01-01T00:00:00.000Z',
    publishedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

export function professionalProvider(
  resolveProof: InterventionProfessionalAuthorityProof | null = professionalProof(),
  revalidateProof: InterventionProfessionalAuthorityProof | null = resolveProof
): InterventionProfessionalAuthorityProvider {
  return {
    async resolve() { return resolveProof; },
    async revalidate() { return revalidateProof; },
  };
}

export const TEST_ONLY_QUALIFICATION_PROVIDER:
  InterventionProfessionalQualificationProvider = Object.freeze({
    async resolve(input) {
      return {
        qualificationRef: 'TEST_QUALIFICATION:1',
        scopeRef: input.approvalScope,
        status: 'VALID',
      };
    },
  });
