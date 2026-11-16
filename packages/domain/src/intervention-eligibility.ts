import type {
  InterventionDefinitionExactRef,
  InterventionDefinitionRecord,
} from './intervention-definitions.js';
import type { InterventionFactCondition } from './intervention-definition-schema.js';

export type InterventionGateState = 'PASS' | 'BLOCK' | 'UNKNOWN';
export type InterventionEvidenceState =
  | 'VALUE'
  | 'UNKNOWN'
  | 'DECLINED'
  | 'NOT_COLLECTED'
  | 'CONFLICTING'
  | 'NOT_APPLICABLE';

export interface InterventionEligibilityEvidence {
  readonly state: InterventionEvidenceState;
  readonly revisionRef: string;
}

export interface InterventionEligibilityInput {
  readonly authorization: InterventionGateState;
  readonly case: {
    readonly id: string;
    readonly familyId: string;
    readonly status: string;
    readonly phase: string;
    readonly version: number;
    readonly isPrimary: boolean;
  };
  readonly formulation: null | {
    readonly id: string;
    readonly version: number;
    readonly status: string;
    readonly reviewState: string;
    readonly dependencyRefs: readonly string[];
  };
  readonly evidence: Readonly<Record<string, InterventionEligibilityEvidence>>;
  readonly scenePackageVersion: string | null;
  readonly expectedDefinition: InterventionDefinitionExactRef;
  readonly definition: InterventionDefinitionRecord | null;
  readonly professionalAuthority: {
    readonly state: 'VALID' | 'INVALID' | 'UNAVAILABLE';
    readonly approvalProofRef: string | null;
    readonly reason: string | null;
  };
  readonly packageInclusion: InterventionGateState;
  readonly ageYears: number | null;
  readonly developmentStages: readonly string[];
  readonly facts: Readonly<Record<string, string | number | boolean | readonly (string | number | boolean)[]>>;
  readonly participation: Readonly<Record<string, InterventionGateState>>;
  readonly consent: Readonly<Record<string, InterventionGateState>>;
  readonly consideredInterventionCodes: readonly string[];
  readonly compliance: InterventionGateState;
  readonly safety: InterventionGateState;
  readonly dependencyRevisionRefs: readonly string[];
}

export type InterventionEligibilityReasonCode =
  | 'AUTHORIZATION_BLOCK'
  | 'CASE_NOT_CURRENT'
  | 'FORMULATION_MISSING_OR_STALE'
  | 'EVIDENCE_MISSING_OR_UNKNOWN'
  | 'SCENE_PACKAGE_UNAVAILABLE'
  | 'DEFINITION_NOT_EXACT'
  | 'DEFINITION_RETIRED'
  | 'DEFINITION_SUPERSEDED'
  | 'NOT_PROFESSIONALLY_APPROVED'
  | 'PACKAGE_NOT_INCLUDED'
  | 'AGE_OR_DEVELOPMENT_MISMATCH'
  | 'FORMULATION_DEPENDENCY_MISSING'
  | 'APPLICABILITY_NOT_SATISFIED'
  | 'EXCLUSION_OR_CONTRAINDICATION'
  | 'PARTICIPATION_BLOCK'
  | 'CONSENT_BLOCK'
  | 'COMBINATION_CONFLICT'
  | 'COMPLIANCE_BLOCK'
  | 'SAFETY_BLOCK'
  | 'UNKNOWN_DEPENDENCY';

export interface InterventionEligibilityResult {
  readonly allowed: boolean;
  readonly reasonCodes: readonly InterventionEligibilityReasonCode[];
  readonly blockers: readonly {
    readonly gate: string;
    readonly state: 'BLOCK' | 'UNKNOWN';
    readonly reasonCode: InterventionEligibilityReasonCode;
    readonly ref?: string;
  }[];
  readonly definitionRef: InterventionDefinitionExactRef;
  readonly scenePackageVersion: string | null;
  readonly approvalProofRef: string | null;
  readonly evidenceRefs: readonly string[];
  readonly dependencyRevisionRefs: readonly string[];
}

const PHASE_ORDER = [
  'INTAKE','ASSESSMENT','PROBLEM_FORMULATION','GOALS','PLANNING',
  'EXECUTION','REVIEW','MAINTENANCE','CLOSED'
] as const;

function conditionResult(
  condition: InterventionFactCondition,
  facts: InterventionEligibilityInput['facts']
): true | false | 'UNKNOWN' {
  if (!Object.prototype.hasOwnProperty.call(facts, condition.fact_ref)) return 'UNKNOWN';
  const current = facts[condition.fact_ref];
  if (condition.operator === 'EXISTS') return true;
  if (condition.operator === 'EQUALS') return current === condition.value;
  if (condition.operator === 'NOT_EQUALS') return current !== condition.value;
  if (!Array.isArray(condition.value)) return false;
  return condition.value.some((value) => value === current);
}

export function evaluateInterventionEligibility(
  input: InterventionEligibilityInput
): InterventionEligibilityResult {
  const blockers: Array<{
    gate: string;
    state: 'BLOCK' | 'UNKNOWN';
    reasonCode: InterventionEligibilityReasonCode;
    ref?: string;
  }> = [];
  const block = (
    gate: string,
    state: 'BLOCK' | 'UNKNOWN',
    reasonCode: InterventionEligibilityReasonCode,
    ref?: string
  ) => {
    blockers.push(ref === undefined ? { gate, state, reasonCode } : { gate, state, reasonCode, ref });
  };

  // Frozen evaluation order: authorization/context.
  if (input.authorization !== 'PASS') {
    block('authorization', input.authorization === 'UNKNOWN' ? 'UNKNOWN' : 'BLOCK',
      input.authorization === 'UNKNOWN' ? 'UNKNOWN_DEPENDENCY' : 'AUTHORIZATION_BLOCK');
  }

  // Case: current/open/primary and at least post-formulation. No exact phase equality.
  const phaseIndex = PHASE_ORDER.indexOf(input.case.phase as (typeof PHASE_ORDER)[number]);
  if (
    input.case.status !== 'OPEN' ||
    !input.case.isPrimary ||
    phaseIndex < PHASE_ORDER.indexOf('GOALS') ||
    input.case.phase === 'CLOSED'
  ) block('case', 'BLOCK', 'CASE_NOT_CURRENT');

  // Formulation.
  if (
    input.formulation === null ||
    input.formulation.status !== 'CONFIRMED' ||
    input.formulation.reviewState !== 'CURRENT'
  ) block('formulation', 'BLOCK', 'FORMULATION_MISSING_OR_STALE');

  // Evidence currentness/unknown preservation.
  for (const [ref, evidence] of Object.entries(input.evidence)) {
    if (evidence.state !== 'VALUE') {
      block(
        'evidence',
        evidence.state === 'UNKNOWN' || evidence.state === 'NOT_COLLECTED' ? 'UNKNOWN' : 'BLOCK',
        'EVIDENCE_MISSING_OR_UNKNOWN',
        ref
      );
    }
  }

  // Scene/package.
  if (input.scenePackageVersion === null) block('scenePackage', 'UNKNOWN', 'SCENE_PACKAGE_UNAVAILABLE');

  // Exact definition.
  const definition = input.definition;
  if (
    definition === null ||
    definition.id !== input.expectedDefinition.id ||
    definition.version !== input.expectedDefinition.version ||
    definition.contentHash !== input.expectedDefinition.contentHash
  ) {
    block('definition', 'BLOCK', 'DEFINITION_NOT_EXACT');
  } else {
    if (definition.state === 'RETIRED') block('definition', 'BLOCK', 'DEFINITION_RETIRED');
    if (definition.state === 'SUPERSEDED') block('definition', 'BLOCK', 'DEFINITION_SUPERSEDED');

    // Approval / publication / effective / lifecycle are represented by the
    // validated Professional Authority consumer result and never inferred here.
    if (input.professionalAuthority.state !== 'VALID') {
      block(
        'professionalApproval',
        input.professionalAuthority.state === 'UNAVAILABLE' ? 'UNKNOWN' : 'BLOCK',
        'NOT_PROFESSIONALLY_APPROVED'
      );
    }

    // Exact package inclusion remains independent from approval.
    if (input.packageInclusion !== 'PASS') {
      block(
        'packageInclusion',
        input.packageInclusion === 'UNKNOWN' ? 'UNKNOWN' : 'BLOCK',
        'PACKAGE_NOT_INCLUDED'
      );
    }

    const scope = definition.semantic.age_and_development_scope;
    if (
      (scope.min_age_years !== null && (input.ageYears === null || input.ageYears < scope.min_age_years)) ||
      (scope.max_age_years !== null && (input.ageYears === null || input.ageYears > scope.max_age_years)) ||
      (scope.development_stages.length > 0 &&
        !scope.development_stages.some((stage) => input.developmentStages.includes(stage)))
    ) block('ageDevelopment', input.ageYears === null ? 'UNKNOWN' : 'BLOCK', 'AGE_OR_DEVELOPMENT_MISMATCH');

    const formulationRefs = new Set(input.formulation?.dependencyRefs ?? []);
    for (const ref of definition.semantic.formulation_dependencies) {
      if (!formulationRefs.has(ref)) block('formulationDependency', 'BLOCK', 'FORMULATION_DEPENDENCY_MISSING', ref);
    }

    for (const ref of definition.semantic.supporting_evidence_requirements) {
      const evidence = input.evidence[ref];
      if (!evidence || evidence.state !== 'VALUE') {
        block('evidenceRequirement', evidence ? 'UNKNOWN' : 'BLOCK', 'EVIDENCE_MISSING_OR_UNKNOWN', ref);
      }
    }

    for (const condition of definition.semantic.applicable_conditions) {
      const value = conditionResult(condition, input.facts);
      if (value !== true) block('applicability', value === 'UNKNOWN' ? 'UNKNOWN' : 'BLOCK', 'APPLICABILITY_NOT_SATISFIED', condition.fact_ref);
    }

    for (const condition of definition.semantic.exclusion_or_contraindication_conditions) {
      const value = conditionResult(condition, input.facts);
      if (value === true) block('exclusion', 'BLOCK', 'EXCLUSION_OR_CONTRAINDICATION', condition.fact_ref);
      else if (value === 'UNKNOWN') block('exclusion', 'UNKNOWN', 'UNKNOWN_DEPENDENCY', condition.fact_ref);
    }

    for (const ref of definition.semantic.participation_and_consent_requirements.required_participation_refs) {
      const state = input.participation[ref] ?? 'UNKNOWN';
      if (state !== 'PASS') block('participation', state === 'UNKNOWN' ? 'UNKNOWN' : 'BLOCK', 'PARTICIPATION_BLOCK', ref);
    }

    for (const purpose of definition.semantic.participation_and_consent_requirements.required_consent_purposes) {
      const state = input.consent[purpose] ?? 'UNKNOWN';
      if (state !== 'PASS') block('consent', state === 'UNKNOWN' ? 'UNKNOWN' : 'BLOCK', 'CONSENT_BLOCK', purpose);
    }

    for (const code of input.consideredInterventionCodes) {
      if (definition.semantic.conflicting_interventions.includes(code)) {
        block('combination', 'BLOCK', 'COMBINATION_CONFLICT', code);
      }
      if (
        definition.semantic.allowed_combinations.length > 0 &&
        code !== definition.interventionCode &&
        !definition.semantic.allowed_combinations.includes(code)
      ) block('combination', 'BLOCK', 'COMBINATION_CONFLICT', code);
    }
  }

  if (input.compliance !== 'PASS') block('compliance', input.compliance === 'UNKNOWN' ? 'UNKNOWN' : 'BLOCK', 'COMPLIANCE_BLOCK');
  if (input.safety !== 'PASS') block('safety', input.safety === 'UNKNOWN' ? 'UNKNOWN' : 'BLOCK', 'SAFETY_BLOCK');

  const reasonCodes = [...new Set(blockers.map((entry) => entry.reasonCode))];
  return {
    allowed: blockers.length === 0,
    reasonCodes,
    blockers,
    definitionRef: input.expectedDefinition,
    scenePackageVersion: input.scenePackageVersion,
    approvalProofRef: input.professionalAuthority.approvalProofRef,
    evidenceRefs: Object.keys(input.evidence),
    dependencyRevisionRefs: [...input.dependencyRevisionRefs],
  };
}
