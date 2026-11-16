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
  readonly facts: Readonly<
    Record<string, string | number | boolean | readonly (string | number | boolean)[]>
  >;
  readonly participation: Readonly<Record<string, InterventionGateState>>;
  readonly consent: Readonly<Record<string, InterventionGateState>>;
  readonly consideredDefinitions: readonly InterventionDefinitionExactRef[];
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

export interface InterventionEligibilityBlocker {
  readonly gate: string;
  readonly state: 'BLOCK' | 'UNKNOWN';
  readonly reasonCode: InterventionEligibilityReasonCode;
  readonly ref?: string;
}

export interface InterventionEligibilityResult {
  readonly allowed: boolean;
  readonly definitionId: string;
  readonly definitionVersion: number;
  readonly definitionContentHash: string;
  readonly sceneId: string;
  readonly scenePackageVersion: string | null;
  readonly approvalProofRef: string | null;
  readonly approvalStatus: 'VALID' | 'INVALID' | 'UNAVAILABLE';
  readonly professionalAuthorityBlockers: readonly string[];
  readonly missingFormulationDependencies: readonly string[];
  readonly missingEvidenceRequirements: readonly string[];
  readonly ageScopeResult: 'MATCH' | 'MISMATCH' | 'UNKNOWN';
  readonly applicableConditionResult: 'MATCH' | 'NOT_MATCH' | 'UNKNOWN';
  readonly exclusionHits: readonly string[];
  readonly participationRequirements: readonly string[];
  readonly consentResult: 'ALLOW' | 'BLOCK' | 'UNKNOWN';
  readonly complianceResult: 'ALLOW' | 'BLOCK' | 'UNKNOWN';
  readonly combinationConflicts: readonly InterventionDefinitionExactRef[];
  readonly safetyResult: 'ALLOW' | 'BLOCK' | 'UNKNOWN';
  readonly reasonCodes: readonly InterventionEligibilityReasonCode[];
  readonly blockers: readonly InterventionEligibilityBlocker[];
  readonly evidenceRefs: readonly string[];
  readonly caseRevision: number;
  readonly formulationVersion: number | null;
  readonly dependencyRevisionRefs: readonly string[];
  /** Back-compatible exact typed ref for internal callers. */
  readonly definitionRef: InterventionDefinitionExactRef;
}

const PHASE_ORDER = [
  'INTAKE',
  'ASSESSMENT',
  'PROBLEM_FORMULATION',
  'GOALS',
  'PLANNING',
  'EXECUTION',
  'REVIEW',
  'MAINTENANCE',
  'CLOSED',
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
  const expected = condition.value;
  if (Array.isArray(current)) {
    return current.some((entry) => expected.includes(entry));
  }
  return expected.some((value) => value === current);
}

function gateResult(state: InterventionGateState): 'ALLOW' | 'BLOCK' | 'UNKNOWN' {
  if (state === 'PASS') return 'ALLOW';
  return state;
}

export function evaluateInterventionEligibility(
  input: InterventionEligibilityInput
): InterventionEligibilityResult {
  const blockers: InterventionEligibilityBlocker[] = [];
  const missingFormulationDependencies: string[] = [];
  const missingEvidenceRequirements: string[] = [];
  const exclusionHits: string[] = [];
  const combinationConflicts: InterventionDefinitionExactRef[] = [];

  const block = (
    gate: string,
    state: 'BLOCK' | 'UNKNOWN',
    reasonCode: InterventionEligibilityReasonCode,
    ref?: string
  ) => {
    blockers.push(
      ref === undefined
        ? { gate, state, reasonCode }
        : { gate, state, reasonCode, ref }
    );
  };

  // 1. Authorization / context.
  if (input.authorization !== 'PASS') {
    block(
      'authorization',
      input.authorization === 'UNKNOWN' ? 'UNKNOWN' : 'BLOCK',
      input.authorization === 'UNKNOWN' ? 'UNKNOWN_DEPENDENCY' : 'AUTHORIZATION_BLOCK'
    );
  }

  // 2. Current primary/open Case. Later legal phases are valid; no Scene-node
  // phase equality is introduced.
  const phaseIndex = PHASE_ORDER.indexOf(
    input.case.phase as (typeof PHASE_ORDER)[number]
  );
  if (
    input.case.status !== 'OPEN' ||
    !input.case.isPrimary ||
    phaseIndex < PHASE_ORDER.indexOf('GOALS') ||
    input.case.phase === 'CLOSED'
  ) {
    block('case', 'BLOCK', 'CASE_NOT_CURRENT');
  }

  // 3. Authoritative Formulation.
  if (
    input.formulation === null ||
    input.formulation.status !== 'CONFIRMED' ||
    input.formulation.reviewState !== 'CURRENT'
  ) {
    block('formulation', 'BLOCK', 'FORMULATION_MISSING_OR_STALE');
  }

  // 4. Required Evidence, preserving UNKNOWN-family states.
  for (const [ref, evidence] of Object.entries(input.evidence)) {
    if (evidence.state !== 'VALUE') {
      block(
        'evidence',
        evidence.state === 'UNKNOWN' || evidence.state === 'NOT_COLLECTED'
          ? 'UNKNOWN'
          : 'BLOCK',
        'EVIDENCE_MISSING_OR_UNKNOWN',
        ref
      );
    }
  }

  // 5. Exact Scene/package.
  if (input.scenePackageVersion === null) {
    block('scenePackage', 'UNKNOWN', 'SCENE_PACKAGE_UNAVAILABLE');
  }

  // 6. Exact definition id/version/hash and definition lifecycle.
  const definition = input.definition;
  let ageScopeResult: 'MATCH' | 'MISMATCH' | 'UNKNOWN' = 'UNKNOWN';
  let applicableConditionResult: 'MATCH' | 'NOT_MATCH' | 'UNKNOWN' = 'UNKNOWN';
  let participationRequirements: readonly string[] = [];

  if (
    definition === null ||
    definition.id !== input.expectedDefinition.id ||
    definition.version !== input.expectedDefinition.version ||
    definition.contentHash !== input.expectedDefinition.contentHash
  ) {
    block('definition', 'BLOCK', 'DEFINITION_NOT_EXACT');
  } else {
    if (definition.state === 'RETIRED') {
      block('definition', 'BLOCK', 'DEFINITION_RETIRED');
    }
    if (definition.state === 'SUPERSEDED') {
      block('definition', 'BLOCK', 'DEFINITION_SUPERSEDED');
    }

    // 7–9. Professional approval/publication/effective/current lifecycle are
    // already validated by the Professional Authority consumer.
    if (input.professionalAuthority.state !== 'VALID') {
      block(
        'professionalApproval',
        input.professionalAuthority.state === 'UNAVAILABLE' ? 'UNKNOWN' : 'BLOCK',
        'NOT_PROFESSIONALLY_APPROVED',
        input.professionalAuthority.reason ?? undefined
      );
    }

    // 10. Exact package inclusion is independent from Professional Approval.
    if (input.packageInclusion !== 'PASS') {
      block(
        'packageInclusion',
        input.packageInclusion === 'UNKNOWN' ? 'UNKNOWN' : 'BLOCK',
        'PACKAGE_NOT_INCLUDED'
      );
    }

    // 11. Age/development scope.
    const scope = definition.semantic.age_and_development_scope;
    const needsAge = scope.min_age_years !== null || scope.max_age_years !== null;
    const needsDevelopment = scope.development_stages.length > 0;
    const ageUnknown = needsAge && input.ageYears === null;
    const developmentUnknown = needsDevelopment && input.developmentStages.length === 0;
    if (ageUnknown || developmentUnknown) {
      ageScopeResult = 'UNKNOWN';
      block('ageDevelopment', 'UNKNOWN', 'AGE_OR_DEVELOPMENT_MISMATCH');
    } else {
      const mismatch =
        (scope.min_age_years !== null &&
          input.ageYears !== null &&
          input.ageYears < scope.min_age_years) ||
        (scope.max_age_years !== null &&
          input.ageYears !== null &&
          input.ageYears > scope.max_age_years) ||
        (needsDevelopment &&
          !scope.development_stages.some((stage) =>
            input.developmentStages.includes(stage)
          ));
      ageScopeResult = mismatch ? 'MISMATCH' : 'MATCH';
      if (mismatch) {
        block('ageDevelopment', 'BLOCK', 'AGE_OR_DEVELOPMENT_MISMATCH');
      }
    }

    // 12. Formulation dependencies.
    const formulationRefs = new Set(input.formulation?.dependencyRefs ?? []);
    for (const ref of definition.semantic.formulation_dependencies) {
      if (!formulationRefs.has(ref)) {
        missingFormulationDependencies.push(ref);
        block(
          'formulationDependency',
          'BLOCK',
          'FORMULATION_DEPENDENCY_MISSING',
          ref
        );
      }
    }

    // 13. Supporting Evidence requirements.
    for (const ref of definition.semantic.supporting_evidence_requirements) {
      const evidence = input.evidence[ref];
      if (!evidence || evidence.state !== 'VALUE') {
        missingEvidenceRequirements.push(ref);
        block(
          'evidenceRequirement',
          evidence &&
              (evidence.state === 'UNKNOWN' ||
                evidence.state === 'NOT_COLLECTED')
            ? 'UNKNOWN'
            : 'BLOCK',
          'EVIDENCE_MISSING_OR_UNKNOWN',
          ref
        );
      }
    }

    // 14. Applicable conditions.
    let applicabilityUnknown = false;
    let applicabilityFalse = false;
    for (const condition of definition.semantic.applicable_conditions) {
      const value = conditionResult(condition, input.facts);
      if (value === false) applicabilityFalse = true;
      if (value === 'UNKNOWN') applicabilityUnknown = true;
      if (value !== true) {
        block(
          'applicability',
          value === 'UNKNOWN' ? 'UNKNOWN' : 'BLOCK',
          'APPLICABILITY_NOT_SATISFIED',
          condition.fact_ref
        );
      }
    }
    applicableConditionResult = applicabilityFalse
      ? 'NOT_MATCH'
      : applicabilityUnknown
        ? 'UNKNOWN'
        : 'MATCH';

    // 15. Exclusions / contraindications.
    for (const condition of definition.semantic.exclusion_or_contraindication_conditions) {
      const value = conditionResult(condition, input.facts);
      if (value === true) {
        exclusionHits.push(condition.fact_ref);
        block(
          'exclusion',
          'BLOCK',
          'EXCLUSION_OR_CONTRAINDICATION',
          condition.fact_ref
        );
      } else if (value === 'UNKNOWN') {
        block('exclusion', 'UNKNOWN', 'UNKNOWN_DEPENDENCY', condition.fact_ref);
      }
    }

    // 16. Participation.
    participationRequirements =
      definition.semantic.participation_and_consent_requirements
        .required_participation_refs;
    for (const ref of participationRequirements) {
      const state = input.participation[ref] ?? 'UNKNOWN';
      if (state !== 'PASS') {
        block(
          'participation',
          state === 'UNKNOWN' ? 'UNKNOWN' : 'BLOCK',
          'PARTICIPATION_BLOCK',
          ref
        );
      }
    }

    // 17. Consent.
    for (const purpose of definition.semantic
      .participation_and_consent_requirements.required_consent_purposes) {
      const state = input.consent[purpose] ?? 'UNKNOWN';
      if (state !== 'PASS') {
        block(
          'consent',
          state === 'UNKNOWN' ? 'UNKNOWN' : 'BLOCK',
          'CONSENT_BLOCK',
          purpose
        );
      }
    }

    // 18. Combination/conflict over exact co-considered refs.
    for (const candidate of input.consideredDefinitions) {
      const code = candidate.interventionCode;
      const conflict =
        definition.semantic.conflicting_interventions.includes(code) ||
        (definition.semantic.allowed_combinations.length > 0 &&
          code !== definition.interventionCode &&
          !definition.semantic.allowed_combinations.includes(code));
      if (conflict) {
        combinationConflicts.push(candidate);
        block('combination', 'BLOCK', 'COMBINATION_CONFLICT', code);
      }
    }
  }

  // 19. Compliance.
  if (input.compliance !== 'PASS') {
    block(
      'compliance',
      input.compliance === 'UNKNOWN' ? 'UNKNOWN' : 'BLOCK',
      'COMPLIANCE_BLOCK'
    );
  }

  // 20. Safety.
  if (input.safety !== 'PASS') {
    block(
      'safety',
      input.safety === 'UNKNOWN' ? 'UNKNOWN' : 'BLOCK',
      'SAFETY_BLOCK'
    );
  }

  const requiredConsentPurposes =
    definition?.semantic.participation_and_consent_requirements
      .required_consent_purposes ?? [];
  const consentStates = requiredConsentPurposes.map(
    (purpose) => input.consent[purpose] ?? 'UNKNOWN'
  );
  const consentResult =
    consentStates.some((state) => state === 'BLOCK')
      ? 'BLOCK'
      : consentStates.some((state) => state === 'UNKNOWN')
        ? 'UNKNOWN'
        : 'ALLOW';

  const reasonCodes = [...new Set(blockers.map((entry) => entry.reasonCode))];
  const professionalAuthorityBlockers =
    input.professionalAuthority.state === 'VALID'
      ? []
      : [input.professionalAuthority.reason ?? input.professionalAuthority.state];

  return {
    allowed: blockers.length === 0,
    definitionId: input.expectedDefinition.id,
    definitionVersion: input.expectedDefinition.version,
    definitionContentHash: input.expectedDefinition.contentHash,
    sceneId: input.expectedDefinition.sceneId,
    scenePackageVersion: input.scenePackageVersion,
    approvalProofRef: input.professionalAuthority.approvalProofRef,
    approvalStatus: input.professionalAuthority.state,
    professionalAuthorityBlockers,
    missingFormulationDependencies,
    missingEvidenceRequirements,
    ageScopeResult,
    applicableConditionResult,
    exclusionHits,
    participationRequirements,
    consentResult,
    complianceResult: gateResult(input.compliance),
    combinationConflicts,
    safetyResult: gateResult(input.safety),
    reasonCodes,
    blockers,
    evidenceRefs: Object.keys(input.evidence),
    caseRevision: input.case.version,
    formulationVersion: input.formulation?.version ?? null,
    dependencyRevisionRefs: [...input.dependencyRevisionRefs],
    definitionRef: input.expectedDefinition,
  };
}
