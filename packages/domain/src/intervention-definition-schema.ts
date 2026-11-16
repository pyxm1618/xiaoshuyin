import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const INTERVENTION_DEFINITION_SEMANTIC_FIELDS = [
  'target_problem_or_mechanism',
  'formulation_dependencies',
  'supporting_evidence_requirements',
  'applicable_conditions',
  'exclusion_or_contraindication_conditions',
  'age_and_development_scope',
  'rationale',
  'intervention_steps',
  'participation_and_consent_requirements',
  'baseline_and_observation',
  'expected_observable_change',
  'burden_and_barriers',
  'adverse_or_worsening_signals',
  'review_window_and_criteria',
  'stop_reassess_safety_referral_conditions',
  'allowed_combinations',
  'conflicting_interventions',
  'professional_source_refs',
] as const;

export type InterventionDefinitionSemanticField =
  (typeof INTERVENTION_DEFINITION_SEMANTIC_FIELDS)[number];

export type InterventionConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'IN'
  | 'EXISTS';

export interface InterventionFactCondition {
  readonly fact_ref: string;
  readonly operator: InterventionConditionOperator;
  readonly value?: string | number | boolean | readonly (string | number | boolean)[];
}

export interface InterventionAgeAndDevelopmentScope {
  readonly min_age_years: number | null;
  readonly max_age_years: number | null;
  readonly development_stages: readonly string[];
}

export interface InterventionParticipationConsentRequirements {
  readonly required_participation_refs: readonly string[];
  readonly required_consent_purposes: readonly string[];
}

export interface InterventionBaselineObservation {
  readonly baseline_refs: readonly string[];
  readonly observation_refs: readonly string[];
}

export interface InterventionReviewWindowCriteria {
  readonly min_days: number;
  readonly max_days: number | null;
  readonly criteria: readonly string[];
}

export interface InterventionDefinitionSemanticPayload {
  readonly target_problem_or_mechanism: string;
  readonly formulation_dependencies: readonly string[];
  readonly supporting_evidence_requirements: readonly string[];
  readonly applicable_conditions: readonly InterventionFactCondition[];
  readonly exclusion_or_contraindication_conditions: readonly InterventionFactCondition[];
  readonly age_and_development_scope: InterventionAgeAndDevelopmentScope;
  readonly rationale: string;
  readonly intervention_steps: readonly string[];
  readonly participation_and_consent_requirements: InterventionParticipationConsentRequirements;
  readonly baseline_and_observation: InterventionBaselineObservation;
  readonly expected_observable_change: readonly string[];
  readonly burden_and_barriers: readonly string[];
  readonly adverse_or_worsening_signals: readonly string[];
  readonly review_window_and_criteria: InterventionReviewWindowCriteria;
  readonly stop_reassess_safety_referral_conditions: readonly string[];
  readonly allowed_combinations: readonly string[];
  readonly conflicting_interventions: readonly string[];
  readonly professional_source_refs: readonly string[];
}

function invalid(field: string): never {
  throw Object.assign(new Error('INTERVENTION_DEFINITION_INVALID'), {
    code: 'INTERVENTION_DEFINITION_INVALID',
    field,
  });
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(field);
  return value as Record<string, unknown>;
}

function strictKeys(value: Record<string, unknown>, expected: readonly string[], field: string): void {
  const actual = Object.keys(value);
  if (actual.length !== expected.length || actual.some((key) => !expected.includes(key))) invalid(field);
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) invalid(field);
  return value;
}

function stringList(value: unknown, field: string, allowEmpty = true): readonly string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) invalid(field);
  return value.map((item, index) => nonEmptyString(item, field + '[' + index + ']'));
}

function nullableNonNegativeNumber(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) invalid(field);
  return value;
}

function condition(value: unknown, field: string): InterventionFactCondition {
  const row = object(value, field);
  const allowed = ['fact_ref', 'operator', 'value'];
  if (Object.keys(row).some((key) => !allowed.includes(key))) invalid(field);
  const factRef = nonEmptyString(row['fact_ref'], field + '.fact_ref');
  const operator = row['operator'];
  if (operator !== 'EQUALS' && operator !== 'NOT_EQUALS' && operator !== 'IN' && operator !== 'EXISTS') {
    invalid(field + '.operator');
  }
  if (operator === 'EXISTS') {
    if (Object.prototype.hasOwnProperty.call(row, 'value')) invalid(field + '.value');
    return { fact_ref: factRef, operator };
  }
  const conditionValue = row['value'];
  const scalar =
    typeof conditionValue === 'string' ||
    typeof conditionValue === 'number' ||
    typeof conditionValue === 'boolean';
  const list =
    Array.isArray(conditionValue) &&
    conditionValue.length > 0 &&
    conditionValue.every(
      (entry) =>
        typeof entry === 'string' ||
        typeof entry === 'number' ||
        typeof entry === 'boolean'
    );
  if (!scalar && !list) invalid(field + '.value');
  return {
    fact_ref: factRef,
    operator,
    value: conditionValue as string | number | boolean | readonly (string | number | boolean)[],
  };
}

function conditions(value: unknown, field: string): readonly InterventionFactCondition[] {
  if (!Array.isArray(value)) invalid(field);
  return value.map((item, index) => condition(item, field + '[' + index + ']'));
}

export function parseInterventionDefinitionSemanticPayload(value: unknown): InterventionDefinitionSemanticPayload {
  const row = object(value, 'payload');
  strictKeys(row, INTERVENTION_DEFINITION_SEMANTIC_FIELDS, 'payload');

  const age = object(row['age_and_development_scope'], 'age_and_development_scope');
  strictKeys(age, ['min_age_years', 'max_age_years', 'development_stages'], 'age_and_development_scope');
  const minAge = nullableNonNegativeNumber(age['min_age_years'], 'min_age_years');
  const maxAge = nullableNonNegativeNumber(age['max_age_years'], 'max_age_years');
  if (minAge !== null && maxAge !== null && maxAge < minAge) invalid('age_and_development_scope');

  const participation = object(row['participation_and_consent_requirements'], 'participation_and_consent_requirements');
  strictKeys(participation, ['required_participation_refs', 'required_consent_purposes'], 'participation_and_consent_requirements');

  const baseline = object(row['baseline_and_observation'], 'baseline_and_observation');
  strictKeys(baseline, ['baseline_refs', 'observation_refs'], 'baseline_and_observation');

  const review = object(row['review_window_and_criteria'], 'review_window_and_criteria');
  strictKeys(review, ['min_days', 'max_days', 'criteria'], 'review_window_and_criteria');
  const minDays = nullableNonNegativeNumber(review['min_days'], 'min_days');
  if (minDays === null) invalid('min_days');
  const maxDays = nullableNonNegativeNumber(review['max_days'], 'max_days');
  if (maxDays !== null && maxDays < minDays) invalid('review_window_and_criteria');

  return {
    target_problem_or_mechanism: nonEmptyString(row['target_problem_or_mechanism'], 'target_problem_or_mechanism'),
    formulation_dependencies: stringList(row['formulation_dependencies'], 'formulation_dependencies'),
    supporting_evidence_requirements: stringList(row['supporting_evidence_requirements'], 'supporting_evidence_requirements'),
    applicable_conditions: conditions(row['applicable_conditions'], 'applicable_conditions'),
    exclusion_or_contraindication_conditions: conditions(row['exclusion_or_contraindication_conditions'], 'exclusion_or_contraindication_conditions'),
    age_and_development_scope: {
      min_age_years: minAge,
      max_age_years: maxAge,
      development_stages: stringList(age['development_stages'], 'development_stages'),
    },
    rationale: nonEmptyString(row['rationale'], 'rationale'),
    intervention_steps: stringList(row['intervention_steps'], 'intervention_steps', false),
    participation_and_consent_requirements: {
      required_participation_refs: stringList(participation['required_participation_refs'], 'required_participation_refs'),
      required_consent_purposes: stringList(participation['required_consent_purposes'], 'required_consent_purposes'),
    },
    baseline_and_observation: {
      baseline_refs: stringList(baseline['baseline_refs'], 'baseline_refs'),
      observation_refs: stringList(baseline['observation_refs'], 'observation_refs'),
    },
    expected_observable_change: stringList(row['expected_observable_change'], 'expected_observable_change', false),
    burden_and_barriers: stringList(row['burden_and_barriers'], 'burden_and_barriers'),
    adverse_or_worsening_signals: stringList(row['adverse_or_worsening_signals'], 'adverse_or_worsening_signals'),
    review_window_and_criteria: {
      min_days: minDays,
      max_days: maxDays,
      criteria: stringList(review['criteria'], 'criteria', false),
    },
    stop_reassess_safety_referral_conditions: stringList(row['stop_reassess_safety_referral_conditions'], 'stop_reassess_safety_referral_conditions', false),
    allowed_combinations: stringList(row['allowed_combinations'], 'allowed_combinations'),
    conflicting_interventions: stringList(row['conflicting_interventions'], 'conflicting_interventions'),
    professional_source_refs: stringList(row['professional_source_refs'], 'professional_source_refs', false),
  };
}

export function canonicalInterventionDefinitionJson(payload: InterventionDefinitionSemanticPayload): string {
  return (
    '{' +
    INTERVENTION_DEFINITION_SEMANTIC_FIELDS.map(
      (field) => JSON.stringify(field) + ':' + JSON.stringify(payload[field])
    ).join(',') +
    '}'
  );
}

export function canonicalInterventionDefinitionBytes(payload: InterventionDefinitionSemanticPayload): Uint8Array {
  return new TextEncoder().encode(canonicalInterventionDefinitionJson(payload));
}

export function interventionDefinitionContentHash(payload: InterventionDefinitionSemanticPayload): string {
  return createHash('sha256').update(canonicalInterventionDefinitionBytes(payload)).digest('hex');
}

export const interventionDefinitions = pgTable('intervention_definitions', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  sceneId: text('scene_id').notNull(),
  interventionCode: text('intervention_code').notNull(),
  version: integer('version').notNull(),
  contentHash: text('content_hash').notNull(),
  definitionState: text('definition_state').notNull().default('CANDIDATE'),
  revision: integer('revision').notNull().default(1),
  targetProblemOrMechanism: text('target_problem_or_mechanism').notNull(),
  formulationDependencies: jsonb('formulation_dependencies').notNull(),
  supportingEvidenceRequirements: jsonb('supporting_evidence_requirements').notNull(),
  applicableConditions: jsonb('applicable_conditions').notNull(),
  exclusionOrContraindicationConditions: jsonb('exclusion_or_contraindication_conditions').notNull(),
  ageAndDevelopmentScope: jsonb('age_and_development_scope').notNull(),
  rationale: text('rationale').notNull(),
  interventionSteps: jsonb('intervention_steps').notNull(),
  participationAndConsentRequirements: jsonb('participation_and_consent_requirements').notNull(),
  baselineAndObservation: jsonb('baseline_and_observation').notNull(),
  expectedObservableChange: jsonb('expected_observable_change').notNull(),
  burdenAndBarriers: jsonb('burden_and_barriers').notNull(),
  adverseOrWorseningSignals: jsonb('adverse_or_worsening_signals').notNull(),
  reviewWindowAndCriteria: jsonb('review_window_and_criteria').notNull(),
  stopReassessSafetyReferralConditions: jsonb('stop_reassess_safety_referral_conditions').notNull(),
  allowedCombinations: jsonb('allowed_combinations').notNull(),
  conflictingInterventions: jsonb('conflicting_interventions').notNull(),
  professionalSourceRefs: jsonb('professional_source_refs').notNull(),
  supersedesId: uuid('supersedes_id'),
  createdByPersonId: uuid('created_by_person_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
  retiredAt: timestamp('retired_at', { withTimezone: true }),
});
