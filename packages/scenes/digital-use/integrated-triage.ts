/**
 * Slice 12 — deterministic Digital Use Integrated Triage.
 *
 * Pure domain logic only. No database, clock, network, model, RAG, classifier,
 * prompt or client route truth is available in this module.
 */

export type TriageEvidenceState<T> =
  | { readonly kind: 'VALUE'; readonly value: T }
  | { readonly kind: 'MISSING'; readonly reason: 'NO_RECORD' | 'UNKNOWN' | 'NOT_COLLECTED' | 'DECLINED' }
  | { readonly kind: 'CONFLICT'; readonly reason: 'CONFLICTING' | 'CONTRADICTORY' | 'INCOMPATIBLE' | 'INVALID' };

export type EmotionOption = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type FamilyRelationshipOption = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface IntegratedTriageEvidence {
  readonly emotion01002: TriageEvidenceState<readonly EmotionOption[]>;
  readonly family01003: TriageEvidenceState<FamilyRelationshipOption>;
  readonly directImpact: {
    readonly sleep: TriageEvidenceState<boolean>;
    readonly studyOrNecessaryAffairs: TriageEvidenceState<boolean>;
    readonly realWorldActivityDisplacement: TriageEvidenceState<boolean>;
    /** Optional approved additional direct-impact indicators. */
    readonly otherApproved?: readonly TriageEvidenceState<boolean>[];
  };
  /**
   * Optional approved non-Digital-Use need / alternative-explanation signal.
   * ABSENT means no such additional approved Evidence exists. MISSING/CONFLICT
   * means an approved signal exists but is materially unresolved.
   */
  readonly otherNeeds?: TriageEvidenceState<boolean>;
  /** Auxiliary evidence is carried only to prove it never routes by itself. */
  readonly durationOnlyEvidencePresent?: boolean;
}

export type IntegratedTriageOutcome =
  | '01005'
  | '01006'
  | 'A2001'
  | 'A2002'
  | 'A2003'
  | 'INSUFFICIENT'
  | 'BLOCKED';

export interface IntegratedTriagePredicates {
  readonly EMOTION_F: boolean | null;
  readonly FAMILY_CONFLICT_F: boolean | null;
  readonly DIRECT_DIGITAL_USE_IMPACT_POSITIVE: boolean | null;
  readonly DIRECT_DIGITAL_USE_IMPACT_NEGATIVE: boolean | null;
  readonly OTHER_NEEDS_POSITIVE: boolean | null;
  readonly CLEAN_NON_DIGITAL_USE_STATE: boolean | null;
  readonly MATERIAL_UNRESOLVED: boolean;
  readonly OTHER_NEEDS_MATERIAL_UNRESOLVED: boolean;
}

export interface IntegratedTriageResult {
  readonly outcome: IntegratedTriageOutcome;
  readonly predicates: IntegratedTriagePredicates;
  readonly conditions: Readonly<Record<string, boolean>>;
  readonly reasonCode: string;
}

function basePredicates(): IntegratedTriagePredicates {
  return {
    EMOTION_F: null,
    FAMILY_CONFLICT_F: null,
    DIRECT_DIGITAL_USE_IMPACT_POSITIVE: null,
    DIRECT_DIGITAL_USE_IMPACT_NEGATIVE: null,
    OTHER_NEEDS_POSITIVE: null,
    CLEAN_NON_DIGITAL_USE_STATE: null,
    MATERIAL_UNRESOLVED: false,
    OTHER_NEEDS_MATERIAL_UNRESOLVED: false,
  };
}

function result(
  outcome: IntegratedTriageOutcome,
  predicates: IntegratedTriagePredicates,
  reasonCode: string,
  conditions: Readonly<Record<string, boolean>> = {}
): IntegratedTriageResult {
  return Object.freeze({ outcome, predicates: Object.freeze(predicates), conditions, reasonCode });
}

function stateClass<T>(state: TriageEvidenceState<T>): 'VALUE' | 'MISSING' | 'CONFLICT' {
  return state.kind;
}

function hasNonSevereEmotionNeed(values: readonly EmotionOption[]): boolean {
  return values.some((value) => value === 'B' || value === 'C' || value === 'D' || value === 'E');
}

function isEmotionExactlyA(values: readonly EmotionOption[]): boolean {
  return values.length === 1 && values[0] === 'A';
}

/**
 * Mechanically evaluate the frozen Integrated Triage Authority.
 *
 * Precedence is intentional:
 *   01002 Missing/Conflict/F
 *   -> 01003 Missing/Conflict/F
 *   -> direct-impact Missing/Conflict/positive/negative
 *   -> A2003 / A2002 / A2001 / INSUFFICIENT.
 */
export function evaluateIntegratedTriage(
  evidence: IntegratedTriageEvidence
): IntegratedTriageResult {
  let p = basePredicates();

  // 1. 01002 priority family.
  if (stateClass(evidence.emotion01002) === 'MISSING') {
    return result('INSUFFICIENT', { ...p, MATERIAL_UNRESOLVED: true }, '01002_MISSING_FAMILY');
  }
  if (stateClass(evidence.emotion01002) === 'CONFLICT') {
    return result('BLOCKED', { ...p, MATERIAL_UNRESOLVED: true }, '01002_CONFLICT_FAMILY');
  }
  const emotionValues = evidence.emotion01002.kind === 'VALUE'
    ? evidence.emotion01002.value
    : [];
  if (
    emotionValues.length < 1 ||
    emotionValues.length > 2 ||
    new Set(emotionValues).size !== emotionValues.length
  ) {
    return result('BLOCKED', { ...p, MATERIAL_UNRESOLVED: true }, '01002_INVALID_CURRENT_VALUE');
  }
  if (
    emotionValues.includes('A') &&
    emotionValues.some((value) => value !== 'A')
  ) {
    return result(
      'BLOCKED',
      { ...p, MATERIAL_UNRESOLVED: true },
      '01002_INCOMPATIBLE_CURRENT_VALUE'
    );
  }

  const emotionF = emotionValues.includes('F');
  p = { ...p, EMOTION_F: emotionF };
  if (emotionF) {
    return result('01005', p, 'EMOTION_SEVERE_F', { EMOTION_SEVERE_F: true });
  }

  // 2. Only after valid 01002 non-F, classify 01003.
  if (stateClass(evidence.family01003) === 'MISSING') {
    return result('INSUFFICIENT', { ...p, MATERIAL_UNRESOLVED: true }, '01003_MISSING_FAMILY');
  }
  if (stateClass(evidence.family01003) === 'CONFLICT') {
    return result('BLOCKED', { ...p, MATERIAL_UNRESOLVED: true }, '01003_CONFLICT_FAMILY');
  }
  const familyValue =
    evidence.family01003.kind === 'VALUE' ? evidence.family01003.value : null;
  if (familyValue === null) {
    return result('BLOCKED', { ...p, MATERIAL_UNRESOLVED: true }, '01003_INVALID_CURRENT_VALUE');
  }
  const familyF = familyValue === 'F';
  p = { ...p, FAMILY_CONFLICT_F: familyF };
  if (familyF) {
    return result('01006', p, 'FAMILY_CONFLICT_SEVERE_F', {
      FAMILY_CONFLICT_SEVERE_F: true,
    });
  }

  const impactStates = [
    evidence.directImpact.sleep,
    evidence.directImpact.studyOrNecessaryAffairs,
    evidence.directImpact.realWorldActivityDisplacement,
    ...(evidence.directImpact.otherApproved ?? []),
  ];

  // Positive direct impact is sufficient even if another indicator is
  // unresolved: changing that unresolved value cannot make the existing true
  // indicator disappear, so it is not material to the positive result.
  const positive = impactStates.some(
    (state) => state.kind === 'VALUE' && state.value === true
  );
  if (positive) {
    p = {
      ...p,
      DIRECT_DIGITAL_USE_IMPACT_POSITIVE: true,
      DIRECT_DIGITAL_USE_IMPACT_NEGATIVE: false,
    };
    const otherNeedsPositive =
      hasNonSevereEmotionNeed(emotionValues) ||
      familyValue !== 'A' ||
      (evidence.otherNeeds?.kind === 'VALUE' && evidence.otherNeeds.value === true);
    p = {
      ...p,
      OTHER_NEEDS_POSITIVE: otherNeedsPositive,
      CLEAN_NON_DIGITAL_USE_STATE: false,
      MATERIAL_UNRESOLVED: false,
      OTHER_NEEDS_MATERIAL_UNRESOLVED: false,
    };
    return result('A2003', p, 'TRIAGE_CONTINUE_DIGITAL_USE_INTEGRATED', {
      TRIAGE_CONTINUE_DIGITAL_USE_INTEGRATED: true,
    });
  }

  // Without a positive proof, required missing direct-impact evidence is
  // INSUFFICIENT and existing contradictory evidence is BLOCKED.
  const requiredImpactStates = [
    evidence.directImpact.sleep,
    evidence.directImpact.studyOrNecessaryAffairs,
    evidence.directImpact.realWorldActivityDisplacement,
  ];
  if (
    requiredImpactStates.some((state) => state.kind === 'MISSING') ||
    (evidence.directImpact.otherApproved ?? []).some((state) => state.kind === 'MISSING')
  ) {
    return result(
      'INSUFFICIENT',
      { ...p, DIRECT_DIGITAL_USE_IMPACT_POSITIVE: false, MATERIAL_UNRESOLVED: true },
      'DIRECT_IMPACT_MISSING_FAMILY'
    );
  }
  if (impactStates.some((state) => state.kind === 'CONFLICT')) {
    return result(
      'BLOCKED',
      { ...p, DIRECT_DIGITAL_USE_IMPACT_POSITIVE: false, MATERIAL_UNRESOLVED: true },
      'DIRECT_IMPACT_CONFLICT_FAMILY'
    );
  }

  const allRequiredKnownNegative = requiredImpactStates.every(
    (state) => state.kind === 'VALUE' && state.value === false
  );
  if (!allRequiredKnownNegative) {
    return result(
      'INSUFFICIENT',
      { ...p, DIRECT_DIGITAL_USE_IMPACT_POSITIVE: false, MATERIAL_UNRESOLVED: true },
      'DIRECT_IMPACT_NOT_PROVEN'
    );
  }

  p = {
    ...p,
    DIRECT_DIGITAL_USE_IMPACT_POSITIVE: false,
    DIRECT_DIGITAL_USE_IMPACT_NEGATIVE: true,
  };

  const emotionOther = hasNonSevereEmotionNeed(emotionValues);
  const familyOther = familyValue !== 'A';
  const explicitOther =
    evidence.otherNeeds?.kind === 'VALUE' && evidence.otherNeeds.value === true;
  const otherNeedsPositive = emotionOther || familyOther || explicitOther;

  if (otherNeedsPositive) {
    p = {
      ...p,
      OTHER_NEEDS_POSITIVE: true,
      CLEAN_NON_DIGITAL_USE_STATE: false,
      MATERIAL_UNRESOLVED: false,
      OTHER_NEEDS_MATERIAL_UNRESOLVED: false,
    };
    return result('A2002', p, 'TRIAGE_FURTHER_ASSESSMENT_INTEGRATED', {
      TRIAGE_FURTHER_ASSESSMENT_INTEGRATED: true,
    });
  }

  // Once priority is false and direct impact is positively proven negative,
  // unresolved approved other-needs evidence routes to A2002 rather than the
  // generic BLOCKED/INSUFFICIENT families.
  const otherNeedsUnresolved =
    evidence.otherNeeds?.kind === 'MISSING' || evidence.otherNeeds?.kind === 'CONFLICT';
  if (otherNeedsUnresolved) {
    p = {
      ...p,
      OTHER_NEEDS_POSITIVE: null,
      CLEAN_NON_DIGITAL_USE_STATE: null,
      MATERIAL_UNRESOLVED: true,
      OTHER_NEEDS_MATERIAL_UNRESOLVED: true,
    };
    return result('A2002', p, 'TRIAGE_FURTHER_ASSESSMENT_INTEGRATED', {
      TRIAGE_FURTHER_ASSESSMENT_INTEGRATED: true,
    });
  }

  const clean =
    isEmotionExactlyA(emotionValues) &&
    familyValue === 'A' &&
    (
      evidence.otherNeeds === undefined ||
      (evidence.otherNeeds.kind === 'VALUE' && evidence.otherNeeds.value === false)
    );

  p = {
    ...p,
    OTHER_NEEDS_POSITIVE: false,
    CLEAN_NON_DIGITAL_USE_STATE: clean,
    MATERIAL_UNRESOLVED: false,
    OTHER_NEEDS_MATERIAL_UNRESOLVED: false,
  };

  if (clean) {
    return result('A2001', p, 'TRIAGE_NO_INTERVENTION_INTEGRATED', {
      TRIAGE_NO_INTERVENTION_INTEGRATED: true,
    });
  }

  // No default fallthrough into a normal business outcome.
  return result('INSUFFICIENT', p, 'NO_NORMAL_PREDICATE_PROVEN');
}
