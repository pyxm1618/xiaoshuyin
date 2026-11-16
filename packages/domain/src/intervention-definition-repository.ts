import type { Tx } from './repository.js';
import type {
  InterventionDefinitionRecord,
  InterventionDefinitionState,
} from './intervention-definitions.js';
import type { InterventionDefinitionSemanticPayload } from './intervention-definition-schema.js';

interface InterventionDefinitionDbRow {
  id: string; scene_id: string; intervention_code: string; version: number;
  content_hash: string; definition_state: InterventionDefinitionState; revision: number;
  target_problem_or_mechanism: string; formulation_dependencies: unknown;
  supporting_evidence_requirements: unknown; applicable_conditions: unknown;
  exclusion_or_contraindication_conditions: unknown; age_and_development_scope: unknown;
  rationale: string; intervention_steps: unknown; participation_and_consent_requirements: unknown;
  baseline_and_observation: unknown; expected_observable_change: unknown;
  burden_and_barriers: unknown; adverse_or_worsening_signals: unknown;
  review_window_and_criteria: unknown; stop_reassess_safety_referral_conditions: unknown;
  allowed_combinations: unknown; conflicting_interventions: unknown;
  professional_source_refs: unknown; supersedes_id: string | null;
  created_by_person_id: string; created_at: Date; superseded_at: Date | null; retired_at: Date | null;
}

const COLUMNS = [
  'id','scene_id','intervention_code','version','content_hash','definition_state','revision',
  'target_problem_or_mechanism','formulation_dependencies','supporting_evidence_requirements',
  'applicable_conditions','exclusion_or_contraindication_conditions','age_and_development_scope',
  'rationale','intervention_steps','participation_and_consent_requirements','baseline_and_observation',
  'expected_observable_change','burden_and_barriers','adverse_or_worsening_signals',
  'review_window_and_criteria','stop_reassess_safety_referral_conditions','allowed_combinations',
  'conflicting_interventions','professional_source_refs','supersedes_id','created_by_person_id',
  'created_at','superseded_at','retired_at'
].join(',');

function toRecord(row: InterventionDefinitionDbRow): InterventionDefinitionRecord {
  return {
    id: row.id,
    sceneId: row.scene_id,
    interventionCode: row.intervention_code,
    version: row.version,
    contentHash: row.content_hash,
    state: row.definition_state,
    revision: row.revision,
    semantic: {
      target_problem_or_mechanism: row.target_problem_or_mechanism,
      formulation_dependencies: row.formulation_dependencies,
      supporting_evidence_requirements: row.supporting_evidence_requirements,
      applicable_conditions: row.applicable_conditions,
      exclusion_or_contraindication_conditions: row.exclusion_or_contraindication_conditions,
      age_and_development_scope: row.age_and_development_scope,
      rationale: row.rationale,
      intervention_steps: row.intervention_steps,
      participation_and_consent_requirements: row.participation_and_consent_requirements,
      baseline_and_observation: row.baseline_and_observation,
      expected_observable_change: row.expected_observable_change,
      burden_and_barriers: row.burden_and_barriers,
      adverse_or_worsening_signals: row.adverse_or_worsening_signals,
      review_window_and_criteria: row.review_window_and_criteria,
      stop_reassess_safety_referral_conditions: row.stop_reassess_safety_referral_conditions,
      allowed_combinations: row.allowed_combinations,
      conflicting_interventions: row.conflicting_interventions,
      professional_source_refs: row.professional_source_refs,
    } as InterventionDefinitionSemanticPayload,
    supersedesId: row.supersedes_id,
    createdByPersonId: row.created_by_person_id,
    createdAt: row.created_at,
    supersededAt: row.superseded_at,
    retiredAt: row.retired_at,
  };
}

export async function lockInterventionDefinitionChain(
  tx: Tx, sceneId: string, interventionCode: string
): Promise<void> {
  await tx.query(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0::bigint))',
    ['INTERVENTION_DEFINITION:' + sceneId + ':' + interventionCode]
  );
}

export async function getExactInterventionDefinition(
  tx: Tx,
  input: { id: string; version: number; contentHash: string },
  lock = false
): Promise<InterventionDefinitionRecord | null> {
  const result = await tx.query<InterventionDefinitionDbRow>(
    'SELECT ' + COLUMNS + ' FROM intervention_definitions WHERE id=$1 AND version=$2 AND content_hash=$3' +
      (lock ? ' FOR UPDATE' : ''),
    [input.id, input.version, input.contentHash]
  );
  return result.rows[0] ? toRecord(result.rows[0]) : null;
}

export async function getInterventionDefinitionByLogicalVersion(
  tx: Tx,
  input: { sceneId: string; interventionCode: string; version: number },
  lock = false
): Promise<InterventionDefinitionRecord | null> {
  const result = await tx.query<InterventionDefinitionDbRow>(
    'SELECT ' + COLUMNS + ' FROM intervention_definitions WHERE scene_id=$1 AND intervention_code=$2 AND version=$3' +
      (lock ? ' FOR UPDATE' : ''),
    [input.sceneId, input.interventionCode, input.version]
  );
  return result.rows[0] ? toRecord(result.rows[0]) : null;
}

export async function getCurrentInterventionDefinitionChainHead(
  tx: Tx,
  input: { sceneId: string; interventionCode: string },
  lock = false
): Promise<InterventionDefinitionRecord | null> {
  const result = await tx.query<InterventionDefinitionDbRow>(
    'SELECT ' + COLUMNS + ' FROM intervention_definitions WHERE scene_id=$1 AND intervention_code=$2' +
      ' ORDER BY version DESC LIMIT 1' + (lock ? ' FOR UPDATE' : ''),
    [input.sceneId, input.interventionCode]
  );
  return result.rows[0] ? toRecord(result.rows[0]) : null;
}

export async function insertInterventionDefinitionCandidate(
  tx: Tx,
  input: {
    sceneId: string; interventionCode: string; version: number; contentHash: string;
    semantic: InterventionDefinitionSemanticPayload; supersedesId: string | null; createdByPersonId: string;
  }
): Promise<InterventionDefinitionRecord> {
  const s = input.semantic;
  const values = [
    input.sceneId,input.interventionCode,input.version,input.contentHash,
    s.target_problem_or_mechanism,JSON.stringify(s.formulation_dependencies),
    JSON.stringify(s.supporting_evidence_requirements),JSON.stringify(s.applicable_conditions),
    JSON.stringify(s.exclusion_or_contraindication_conditions),JSON.stringify(s.age_and_development_scope),
    s.rationale,JSON.stringify(s.intervention_steps),JSON.stringify(s.participation_and_consent_requirements),
    JSON.stringify(s.baseline_and_observation),JSON.stringify(s.expected_observable_change),
    JSON.stringify(s.burden_and_barriers),JSON.stringify(s.adverse_or_worsening_signals),
    JSON.stringify(s.review_window_and_criteria),JSON.stringify(s.stop_reassess_safety_referral_conditions),
    JSON.stringify(s.allowed_combinations),JSON.stringify(s.conflicting_interventions),
    JSON.stringify(s.professional_source_refs),input.supersedesId,input.createdByPersonId
  ];
  const result = await tx.query<InterventionDefinitionDbRow>(
    'INSERT INTO intervention_definitions (' +
    'scene_id,intervention_code,version,content_hash,definition_state,target_problem_or_mechanism,' +
    'formulation_dependencies,supporting_evidence_requirements,applicable_conditions,' +
    'exclusion_or_contraindication_conditions,age_and_development_scope,rationale,intervention_steps,' +
    'participation_and_consent_requirements,baseline_and_observation,expected_observable_change,' +
    'burden_and_barriers,adverse_or_worsening_signals,review_window_and_criteria,' +
    'stop_reassess_safety_referral_conditions,allowed_combinations,conflicting_interventions,' +
    'professional_source_refs,supersedes_id,created_by_person_id) VALUES ' +
    '($1,$2,$3,$4,\'CANDIDATE\',$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,' +
    '$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,' +
    '$19::jsonb,$20::jsonb,$21::jsonb,$22::jsonb,$23,$24) RETURNING ' + COLUMNS,
    values
  );
  const row = result.rows[0];
  if (!row) throw new Error('INTERVENTION_DEFINITION_INSERT_RETURNED_NO_ROW');
  return toRecord(row);
}

export async function transitionInterventionDefinitionStateCas(
  tx: Tx,
  input: {
    id: string; expectedRevision: number; expectedState: 'CANDIDATE' | 'CURRENT';
    nextState: 'SUPERSEDED' | 'RETIRED';
  }
): Promise<InterventionDefinitionRecord | null> {
  const timestampColumn = input.nextState === 'SUPERSEDED' ? 'superseded_at' : 'retired_at';
  const result = await tx.query<InterventionDefinitionDbRow>(
    'UPDATE intervention_definitions SET definition_state=$4, revision=revision+1, ' +
      timestampColumn + '=clock_timestamp() WHERE id=$1 AND revision=$2 AND definition_state=$3 RETURNING ' + COLUMNS,
    [input.id,input.expectedRevision,input.expectedState,input.nextState]
  );
  return result.rows[0] ? toRecord(result.rows[0]) : null;
}


/**
 * Reuses the one staff_assignments authority table. This read is deliberately
 * GLOBAL PROFESSIONAL_REVIEW only and never calls the SAFETY_RESOLVE context.
 */
export async function getCurrentProfessionalReviewStaffAssignment(
  tx: Tx,
  input: { accountId: string; personId: string }
): Promise<{ assignmentRef: string } | null> {
  const result = await tx.query<{ id: string }>(
    "SELECT id FROM staff_assignments " +
      "WHERE account_id=$1 AND person_id=$2 AND capability='PROFESSIONAL_REVIEW' " +
      "AND scope_type='GLOBAL' AND revoked_at IS NULL " +
      "AND valid_from <= clock_timestamp() " +
      "AND (valid_until IS NULL OR valid_until > clock_timestamp()) " +
      "ORDER BY granted_at DESC, id LIMIT 2",
    [input.accountId, input.personId]
  );
  return result.rows.length === 1 && result.rows[0]
    ? { assignmentRef: result.rows[0].id }
    : null;
}
