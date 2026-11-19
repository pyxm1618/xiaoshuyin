/**
 * Common Core Goal / ConfirmGoal domain + persistence owner.
 *
 * Goal content is immutable after SAVE. A later SAVE creates a successor
 * version; CONFIRM only changes confirmation state and never mutates content.
 */
import type { PoolClient } from 'pg';
import {
  canonicalDependencies,
  canonicalEvidenceRefs,
  isDependencySubset,
  type DependencyRef,
  type EvidenceRef,
} from './problem-formulations.js';

export const GOAL_LIFECYCLE_STATUSES = ['ACTIVE', 'SUPERSEDED'] as const;
export const GOAL_CONFIRMATION_STATES = ['UNCONFIRMED', 'CONFIRMED'] as const;
export const GOAL_REVIEW_STATES = ['CURRENT', 'NEEDS_REVIEW'] as const;

export type GoalLifecycleStatus = (typeof GOAL_LIFECYCLE_STATUSES)[number];
export type GoalConfirmationState = (typeof GOAL_CONFIRMATION_STATES)[number];
export type GoalReviewState = (typeof GOAL_REVIEW_STATES)[number];

export type GoalDependencyRef = Extract<
  DependencyRef,
  { type: 'EVIDENCE' | 'CONSENT' }
>;

export interface GoalParticipantResponsibility {
  personId: string;
  responsibility: string;
  evidenceRefs: EvidenceRef[];
}

export interface GoalContractInput {
  problemFormulationId: string;
  problemFormulationVersion: number;
  baselineRefs: EvidenceRef[];
  targetDescription: string;
  observationMethod: string;
  observationWindow: string;
  protectiveConditions: string[];
  parentActions: string[];
  reviewPoint: string;
  dependencyRefs: GoalDependencyRef[];
  participantResponsibilities: GoalParticipantResponsibility[];
}

export interface GoalRow {
  id: string;
  goal_id: string;
  family_id: string;
  case_id: string;
  version: number;
  lifecycle_status: GoalLifecycleStatus;
  confirmation_state: GoalConfirmationState;
  review_state: GoalReviewState;
  problem_formulation_id: string;
  problem_formulation_version: number;
  baseline_refs: EvidenceRef[];
  target_description: string;
  observation_method: string;
  observation_window: string;
  protective_conditions: string[];
  parent_actions: string[];
  review_point: string;
  dependency_refs: GoalDependencyRef[];
  participant_responsibilities: GoalParticipantResponsibility[];
  saved_by_person_id: string;
  confirmed_by_person_id: string | null;
  confirmed_at: Date | null;
  supersedes_version: number | null;
  created_at: Date;
  updated_at: Date;
}

export type GoalRuntimeErrorCode =
  | 'VALIDATION_ERROR'
  | 'CASE_PHASE_CONFLICT'
  | 'CASE_NOT_FOUND';

export class GoalRuntimeError extends Error {
  readonly code: GoalRuntimeErrorCode;

  constructor(code: GoalRuntimeErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'GoalRuntimeError';
    this.code = code;
  }
}

export function goalError(
  code: GoalRuntimeErrorCode,
  message?: string
): GoalRuntimeError {
  return new GoalRuntimeError(code, message);
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertTextArray(value: readonly string[], name: string): void {
  if (value.length === 0 || value.some((item) => !nonBlank(item))) {
    throw goalError('VALIDATION_ERROR', name + ' must contain non-empty values');
  }
}

function assertEvidenceRefs(refs: readonly EvidenceRef[], name: string): void {
  if (refs.length === 0) {
    throw goalError('VALIDATION_ERROR', name + ' must not be empty');
  }
  for (const ref of refs) {
    if (
      !['DIALOGUE_MESSAGE', 'ASSERTION', 'OBSERVATION'].includes(ref.type) ||
      !UUID.test(ref.id)
    ) {
      throw goalError(
        'VALIDATION_ERROR',
        name + ' contains an invalid Evidence reference'
      );
    }
  }
}

function assertGoalDependencyRefs(
  refs: readonly DependencyRef[]
): asserts refs is readonly GoalDependencyRef[] {
  for (const ref of refs) {
    if (ref.type === 'EVIDENCE') {
      assertEvidenceRefs([ref.evidence], 'dependencyRefs');
      continue;
    }
    if (ref.type === 'CONSENT') {
      if (
        !UUID.test(ref.id) ||
        (ref.version !== undefined &&
          (!Number.isInteger(ref.version) ||
            ref.version < 1 ||
            ref.version > 2147483647))
      ) {
        throw goalError('VALIDATION_ERROR', 'dependencyRefs contains an invalid Consent reference');
      }
      continue;
    }
    throw goalError('VALIDATION_ERROR', 'Goal dependencyRefs only support EVIDENCE or CONSENT');
  }
}

export function assertGoalDependenciesCoverProblemFormulation(
  required: readonly DependencyRef[],
  candidate: readonly GoalDependencyRef[]
): void {
  assertGoalDependencyRefs(candidate);
  for (const dependency of required) {
    if (dependency.type !== 'EVIDENCE' && dependency.type !== 'CONSENT') {
      throw goalError(
        'VALIDATION_ERROR',
        'Current Problem Formulation contains a dependency unsupported by Goal V1'
      );
    }
  }
  if (!isDependencySubset(required, candidate)) {
    throw goalError(
      'VALIDATION_ERROR',
      'Goal dependencyRefs must include the current Problem Formulation dependencies'
    );
  }
}

export function validateGoalContract(input: GoalContractInput): void {
  if (!UUID.test(input.problemFormulationId)) {
    throw goalError('VALIDATION_ERROR', 'problemFormulationId is invalid');
  }
  if (
    !Number.isInteger(input.problemFormulationVersion) ||
    input.problemFormulationVersion < 1 ||
    input.problemFormulationVersion > 2147483647
  ) {
    throw goalError('VALIDATION_ERROR', 'problemFormulationVersion is invalid');
  }

  assertEvidenceRefs(input.baselineRefs, 'baselineRefs');
  if (!nonBlank(input.targetDescription)) {
    throw goalError('VALIDATION_ERROR', 'targetDescription is required');
  }
  if (!nonBlank(input.observationMethod)) {
    throw goalError('VALIDATION_ERROR', 'observationMethod is required');
  }
  if (!nonBlank(input.observationWindow)) {
    throw goalError('VALIDATION_ERROR', 'observationWindow is required');
  }
  assertTextArray(input.protectiveConditions, 'protectiveConditions');
  assertTextArray(input.parentActions, 'parentActions');
  if (!nonBlank(input.reviewPoint)) {
    throw goalError('VALIDATION_ERROR', 'reviewPoint is required');
  }
  if (input.dependencyRefs.length === 0) {
    throw goalError('VALIDATION_ERROR', 'dependencyRefs must not be empty');
  }
  assertGoalDependencyRefs(input.dependencyRefs);

  for (const responsibility of input.participantResponsibilities) {
    if (
      !UUID.test(responsibility.personId) ||
      !nonBlank(responsibility.responsibility)
    ) {
      throw goalError('VALIDATION_ERROR', 'participant responsibility is invalid');
    }
    assertEvidenceRefs(
      responsibility.evidenceRefs,
      'participantResponsibilities.evidenceRefs'
    );
  }
}

export function normalizedGoalContract(
  input: GoalContractInput
): GoalContractInput {
  return {
    ...input,
    problemFormulationId: input.problemFormulationId.toLowerCase(),
    baselineRefs: canonicalEvidenceRefs(input.baselineRefs),
    dependencyRefs: canonicalDependencies(input.dependencyRefs) as GoalDependencyRef[],
    participantResponsibilities: [...input.participantResponsibilities]
      .map((item) => ({
        ...item,
        personId: item.personId.toLowerCase(),
        evidenceRefs: canonicalEvidenceRefs(item.evidenceRefs),
      }))
      .sort((a, b) =>
        (a.personId + ':' + a.responsibility).localeCompare(
          b.personId + ':' + b.responsibility
        )
      ),
  };
}

export function goalContractFromRow(row: GoalRow): GoalContractInput {
  return {
    problemFormulationId: row.problem_formulation_id,
    problemFormulationVersion: row.problem_formulation_version,
    baselineRefs: row.baseline_refs,
    targetDescription: row.target_description,
    observationMethod: row.observation_method,
    observationWindow: row.observation_window,
    protectiveConditions: row.protective_conditions,
    parentActions: row.parent_actions,
    reviewPoint: row.review_point,
    dependencyRefs: row.dependency_refs,
    participantResponsibilities: row.participant_responsibilities,
  };
}

const GOAL_COLUMNS =
  'id, goal_id, family_id, case_id, version, lifecycle_status, ' +
  'confirmation_state, review_state, problem_formulation_id, ' +
  'problem_formulation_version, baseline_refs, target_description, ' +
  'observation_method, observation_window, protective_conditions, ' +
  'parent_actions, review_point, dependency_refs, ' +
  'participant_responsibilities, saved_by_person_id, ' +
  'confirmed_by_person_id, confirmed_at, supersedes_version, ' +
  'created_at, updated_at';

export async function lockActiveGoal(
  tx: PoolClient,
  caseId: string
): Promise<GoalRow | null> {
  const { rows } = await tx.query<GoalRow>(
    'SELECT ' +
      GOAL_COLUMNS +
      " FROM goals WHERE case_id=$1 AND lifecycle_status='ACTIVE' FOR UPDATE",
    [caseId]
  );
  if (rows.length > 1) throw new Error('GOAL_MULTIPLE_ACTIVE');
  return rows[0] ?? null;
}

export async function lockGoalVersion(
  tx: PoolClient,
  input: { caseId: string; goalId: string; goalVersion: number }
): Promise<GoalRow | null> {
  const { rows } = await tx.query<GoalRow>(
    'SELECT ' +
      GOAL_COLUMNS +
      ' FROM goals WHERE case_id=$1 AND goal_id=$2 AND version=$3 FOR UPDATE',
    [input.caseId, input.goalId, input.goalVersion]
  );
  return rows[0] ?? null;
}

export async function insertGoalVersion(
  tx: PoolClient,
  input: {
    goalId: string | null;
    familyId: string;
    caseId: string;
    version: number;
    supersedesVersion: number | null;
    savedByPersonId: string;
    contract: GoalContractInput;
  }
): Promise<GoalRow> {
  const contract = normalizedGoalContract(input.contract);
  const sql =
    'INSERT INTO goals (' +
    'goal_id, family_id, case_id, version, ' +
    'problem_formulation_id, problem_formulation_version, ' +
    'baseline_refs, target_description, observation_method, observation_window, ' +
    'protective_conditions, parent_actions, review_point, dependency_refs, ' +
    'participant_responsibilities, saved_by_person_id, supersedes_version' +
    ') VALUES (' +
    'COALESCE($1::uuid, uuidv7()), $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, ' +
    '$11::jsonb, $12::jsonb, $13, $14::jsonb, $15::jsonb, $16, $17' +
    ') RETURNING ' +
    GOAL_COLUMNS;
  const { rows } = await tx.query<GoalRow>(sql, [
    input.goalId,
    input.familyId,
    input.caseId,
    input.version,
    contract.problemFormulationId,
    contract.problemFormulationVersion,
    JSON.stringify(contract.baselineRefs),
    contract.targetDescription,
    contract.observationMethod,
    contract.observationWindow,
    JSON.stringify(contract.protectiveConditions),
    JSON.stringify(contract.parentActions),
    contract.reviewPoint,
    JSON.stringify(contract.dependencyRefs),
    JSON.stringify(contract.participantResponsibilities),
    input.savedByPersonId,
    input.supersedesVersion,
  ]);
  const row = rows[0];
  if (!row) throw new Error('GOAL_INSERT_RETURNED_NO_ROW');
  return row;
}

export async function supersedeGoalVersion(
  tx: PoolClient,
  input: { goalId: string; goalVersion: number }
): Promise<void> {
  const result = await tx.query(
    "UPDATE goals " +
      "SET lifecycle_status='SUPERSEDED', updated_at=now() " +
      "WHERE goal_id=$1 AND version=$2 " +
      "AND lifecycle_status='ACTIVE' AND confirmation_state='UNCONFIRMED'",
    [input.goalId, input.goalVersion]
  );
  if (result.rowCount !== 1) {
    throw goalError('CASE_PHASE_CONFLICT', 'Goal version is not supersedable');
  }
}

export async function confirmGoalTransition(
  tx: PoolClient,
  input: {
    caseId: string;
    expectedCaseVersion: number;
    goalId: string;
    goalVersion: number;
    actorPersonId: string;
    fromPhase: 'GOALS';
    toPhase: 'PLANNING';
  }
): Promise<{ caseVersion: number; goal: GoalRow }> {
  const { rows } = await tx.query<{ case_version: number }>(
    'SELECT app.confirm_goal_transition($1,$2,$3,$4,$5) AS case_version',
    [input.caseId,input.expectedCaseVersion,input.goalId,input.goalVersion,input.actorPersonId]
  );
  const caseVersion=rows[0]?.case_version;
  if (typeof caseVersion !== 'number' || !Number.isInteger(caseVersion)) {
    throw goalError('CASE_PHASE_CONFLICT', 'Goal transition did not return a Case version');
  }
  const goal=await lockGoalVersion(tx,{caseId:input.caseId,goalId:input.goalId,goalVersion:input.goalVersion});
  if (!goal || goal.lifecycle_status!=='ACTIVE' || goal.review_state!=='CURRENT' ||
      goal.confirmation_state!=='CONFIRMED' ||
      goal.confirmed_by_person_id!==input.actorPersonId || goal.confirmed_at===null) {
    throw goalError('CASE_PHASE_CONFLICT', 'Goal transition did not confirm the target Goal');
  }
  return {caseVersion,goal};
}

export async function insertGoalAudit(
  tx: PoolClient,
  input: {
    familyId: string;
    actorAccountId: string;
    eventType: 'GOAL_SAVED';
    goalId: string;
    metadata: Record<string, unknown>;
  }
): Promise<void> {
  await tx.query(
    'INSERT INTO business_audit_events ' +
      '(family_id, actor_account_id, event_type, resource_type, resource_id, metadata) ' +
      "VALUES ($1,$2,$3,'GOAL',$4,$5::jsonb)",
    [
      input.familyId,
      input.actorAccountId,
      input.eventType,
      input.goalId,
      JSON.stringify(input.metadata),
    ]
  );
}
