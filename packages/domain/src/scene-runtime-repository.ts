/**
 * Slice 12 Scene runtime repository.
 *
 * Data access only: no topology/routing decisions, no authorization decisions,
 * no Evidence writes, no Consent writes and no second transaction.
 */
import type { Tx } from './repository.js';

export type StoredSceneNodeStatus =
  | 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'BLOCKED';

export type StoredEvidenceRef =
  | { type: 'DIALOGUE_MESSAGE' | 'ASSERTION' | 'OBSERVATION'; id: string };
export type StoredSceneRef =
  | StoredEvidenceRef
  | { type: 'SCENE_ARTIFACT'; id: string }
  | { type: 'RECORD_MARKER'; markerCode: 'A200401'; evidenceRefs: StoredEvidenceRef[] };

export interface SceneNodeStateRow {
  id: string;
  family_id: string;
  case_id: string;
  scene_package_version: string;
  node_code: string;
  source_node_code: string;
  status: StoredSceneNodeStatus;
  branch_reason_codes: string[];
  input_refs: StoredSceneRef[];
  output_refs: StoredSceneRef[];
  entered_at: Date;
  completed_at: Date | null;
  revision: number;
}

export interface SceneArtifactRow {
  id: string;
  family_id: string;
  case_id: string;
  scene_package_version: string;
  artifact_type: 'SUPPLEMENTAL_ASSESSMENT_BOUNDARY' | 'TIMELINE' | 'SOLUTION_SUMMARY';
  schema_version: string;
  source_node_code: '01000' | 'A2007' | 'A2010';
  data: Record<string, unknown>;
  owner_person_id: string;
  visibility: 'FAMILY_AUTHORIZED';
  source_refs: StoredSceneRef[];
  revision: number;
  supersedes_id: string | null;
  created_at: Date;
}

export interface SceneEvidenceStatementRow {
  id: string;
  family_id: string;
  case_id: string;
  subject_person_id: string | null;
  source_person_id: string | null;
  content: string;
  confirmation_status: string;
  conflict_group_id: string | null;
  recorded_at: Date;
}

export interface SceneCaseRow {
  id: string;
  family_id: string;
  status: 'OPEN' | 'WAITING' | 'LOST_CONTACT' | 'SAFETY_HOLD' | 'CLOSED';
  phase: 'INTAKE' | 'ASSESSMENT' | 'PROBLEM_FORMULATION' | 'GOALS' | 'PLANNING' | 'EXECUTION' | 'REVIEW' | 'MAINTENANCE' | 'CLOSED';
  is_primary: boolean;
  version: number;
}

const NODE_COLUMNS = `
  id, family_id, case_id, scene_package_version, node_code, source_node_code,
  status, branch_reason_codes, input_refs, output_refs, entered_at, completed_at, revision
`;
const ARTIFACT_COLUMNS = `
  id, family_id, case_id, scene_package_version, artifact_type, schema_version,
  source_node_code, data, owner_person_id, visibility, source_refs, revision,
  supersedes_id, created_at
`;

export async function lockSceneCase(tx: Tx, caseId: string): Promise<SceneCaseRow | null> {
  const { rows } = await tx.query<SceneCaseRow>(
    `SELECT id, family_id, status, phase, is_primary, version
       FROM cases WHERE id = $1 FOR UPDATE`,
    [caseId]
  );
  return rows[0] ?? null;
}

export async function getScenePackageBinding(
  tx: Tx,
  caseId: string
): Promise<string | null> {
  const { rows } = await tx.query<{ scene_package_version: string }>(
    `SELECT scene_package_version
       FROM scene_node_states
      WHERE case_id = $1 AND node_code = 'A1001'`,
    [caseId]
  );
  return rows[0]?.scene_package_version ?? null;
}

export async function getSceneNodeState(
  tx: Tx,
  caseId: string,
  nodeCode: string,
  lock = false
): Promise<SceneNodeStateRow | null> {
  const { rows } = await tx.query<SceneNodeStateRow>(
    `SELECT ${NODE_COLUMNS}
       FROM scene_node_states
      WHERE case_id = $1 AND node_code = $2
      ${lock ? 'FOR UPDATE' : ''}`,
    [caseId, nodeCode]
  );
  return rows[0] ?? null;
}

export async function listSceneNodeStates(
  tx: Tx,
  caseId: string
): Promise<SceneNodeStateRow[]> {
  const { rows } = await tx.query<SceneNodeStateRow>(
    `SELECT ${NODE_COLUMNS}
       FROM scene_node_states
      WHERE case_id = $1
      ORDER BY entered_at ASC, node_code ASC`,
    [caseId]
  );
  return rows;
}

export async function insertSceneNodeState(
  tx: Tx,
  input: {
    familyId: string;
    caseId: string;
    scenePackageVersion: string;
    nodeCode: string;
    sourceNodeCode: string;
    status: StoredSceneNodeStatus;
    branchReasonCodes?: readonly string[];
    inputRefs?: readonly StoredSceneRef[];
    outputRefs?: readonly StoredSceneRef[];
    completedAt?: Date | null;
  }
): Promise<SceneNodeStateRow> {
  const { rows } = await tx.query<SceneNodeStateRow>(
    `INSERT INTO scene_node_states
       (family_id, case_id, scene_package_version, node_code, source_node_code,
        status, branch_reason_codes, input_refs, output_refs, completed_at, revision)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,1)
     RETURNING ${NODE_COLUMNS}`,
    [
      input.familyId,
      input.caseId,
      input.scenePackageVersion,
      input.nodeCode,
      input.sourceNodeCode,
      input.status,
      [...(input.branchReasonCodes ?? [])],
      JSON.stringify(input.inputRefs ?? []),
      JSON.stringify(input.outputRefs ?? []),
      input.completedAt ?? null,
    ]
  );
  const row = rows[0];
  if (!row) throw new Error('SCENE_NODE_INSERT_RETURNED_NO_ROW');
  return row;
}

/**
 * Sparse projection helper. It never decides that a node is legal; the caller
 * must have obtained that decision from the canonical router first.
 */
export async function ensureSceneNodeAvailable(
  tx: Tx,
  input: {
    familyId: string;
    caseId: string;
    scenePackageVersion: string;
    nodeCode: string;
    sourceNodeCode: string;
    branchReasonCodes: readonly string[];
    inputRefs?: readonly StoredSceneRef[];
  }
): Promise<SceneNodeStateRow> {
  const { rows } = await tx.query<SceneNodeStateRow>(
    `INSERT INTO scene_node_states
       (family_id, case_id, scene_package_version, node_code, source_node_code,
        status, branch_reason_codes, input_refs, output_refs, revision)
     VALUES ($1,$2,$3,$4,$5,'AVAILABLE',$6,$7::jsonb,'[]'::jsonb,1)
     ON CONFLICT (case_id, node_code) DO NOTHING
     RETURNING ${NODE_COLUMNS}`,
    [
      input.familyId,
      input.caseId,
      input.scenePackageVersion,
      input.nodeCode,
      input.sourceNodeCode,
      [...input.branchReasonCodes],
      JSON.stringify(input.inputRefs ?? []),
    ]
  );
  if (rows[0]) return rows[0];

  const existing = await getSceneNodeState(tx, input.caseId, input.nodeCode, true);
  if (!existing) throw new Error('SCENE_NODE_CONVERGENCE_FAILED');
  if (
    existing.family_id !== input.familyId ||
    existing.scene_package_version !== input.scenePackageVersion
  ) {
    throw Object.assign(new Error('SCENE_PACKAGE_MISMATCH'), {
      code: 'SCENE_PACKAGE_MISMATCH',
    });
  }
  return existing;
}

export async function casRecordSceneNodeProgress(
  tx: Tx,
  input: {
    caseId: string;
    nodeCode: string;
    scenePackageVersion: string;
    expectedRevision: number;
    branchReasonCodes: readonly string[];
    inputRefs: readonly StoredSceneRef[];
    outputRefs: readonly StoredSceneRef[];
  }
): Promise<SceneNodeStateRow | null> {
  const { rows } = await tx.query<SceneNodeStateRow>(
    `UPDATE scene_node_states
        SET status = 'IN_PROGRESS',
            branch_reason_codes = $5,
            input_refs = $6::jsonb,
            output_refs = $7::jsonb,
            completed_at = NULL,
            revision = revision + 1
      WHERE case_id = $1
        AND node_code = $2
        AND scene_package_version = $3
        AND revision = $4
        AND status IN ('AVAILABLE','IN_PROGRESS')
      RETURNING ${NODE_COLUMNS}`,
    [
      input.caseId,
      input.nodeCode,
      input.scenePackageVersion,
      input.expectedRevision,
      [...input.branchReasonCodes],
      JSON.stringify(input.inputRefs),
      JSON.stringify(input.outputRefs),
    ]
  );
  return rows[0] ?? null;
}

export async function casCompleteSceneNodeState(
  tx: Tx,
  input: {
    caseId: string;
    nodeCode: string;
    scenePackageVersion: string;
    expectedRevision: number;
    status: 'COMPLETED' | 'SKIPPED' | 'BLOCKED';
    branchReasonCodes: readonly string[];
    inputRefs: readonly StoredSceneRef[];
    outputRefs: readonly StoredSceneRef[];
  }
): Promise<SceneNodeStateRow | null> {
  const { rows } = await tx.query<SceneNodeStateRow>(
    `UPDATE scene_node_states
        SET status = $5,
            branch_reason_codes = $6,
            input_refs = $7::jsonb,
            output_refs = $8::jsonb,
            completed_at = now(),
            revision = revision + 1
      WHERE case_id = $1
        AND node_code = $2
        AND scene_package_version = $3
        AND revision = $4
        AND status IN ('AVAILABLE','IN_PROGRESS')
      RETURNING ${NODE_COLUMNS}`,
    [
      input.caseId,
      input.nodeCode,
      input.scenePackageVersion,
      input.expectedRevision,
      input.status,
      [...input.branchReasonCodes],
      JSON.stringify(input.inputRefs),
      JSON.stringify(input.outputRefs),
    ]
  );
  return rows[0] ?? null;
}

export async function listSceneArtifacts(
  tx: Tx,
  caseId: string
): Promise<SceneArtifactRow[]> {
  const { rows } = await tx.query<SceneArtifactRow>(
    `SELECT ${ARTIFACT_COLUMNS}
       FROM scene_artifacts
      WHERE case_id = $1
      ORDER BY created_at ASC, id ASC`,
    [caseId]
  );
  return rows;
}

export async function getLatestSceneArtifact(
  tx: Tx,
  caseId: string,
  artifactType: SceneArtifactRow['artifact_type']
): Promise<SceneArtifactRow | null> {
  const { rows } = await tx.query<SceneArtifactRow>(
    `SELECT ${ARTIFACT_COLUMNS}
       FROM scene_artifacts
      WHERE case_id = $1 AND artifact_type = $2
      ORDER BY revision DESC
      LIMIT 1`,
    [caseId, artifactType]
  );
  return rows[0] ?? null;
}

export async function insertSceneArtifact(
  tx: Tx,
  input: {
    familyId: string;
    caseId: string;
    scenePackageVersion: string;
    artifactType: SceneArtifactRow['artifact_type'];
    schemaVersion: string;
    sourceNodeCode: SceneArtifactRow['source_node_code'];
    data: Record<string, unknown>;
    ownerPersonId: string;
    sourceRefs: readonly StoredSceneRef[];
    revision: number;
    supersedesId?: string | null;
  }
): Promise<SceneArtifactRow> {
  const { rows } = await tx.query<SceneArtifactRow>(
    `INSERT INTO scene_artifacts
       (family_id, case_id, scene_package_version, artifact_type, schema_version,
        source_node_code, data, owner_person_id, visibility, source_refs,
        revision, supersedes_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'FAMILY_AUTHORIZED',$9::jsonb,$10,$11)
     RETURNING ${ARTIFACT_COLUMNS}`,
    [
      input.familyId,
      input.caseId,
      input.scenePackageVersion,
      input.artifactType,
      input.schemaVersion,
      input.sourceNodeCode,
      JSON.stringify(input.data),
      input.ownerPersonId,
      JSON.stringify(input.sourceRefs),
      input.revision,
      input.supersedesId ?? null,
    ]
  );
  const row = rows[0];
  if (!row) throw new Error('SCENE_ARTIFACT_INSERT_RETURNED_NO_ROW');
  return row;
}

async function resolveOneRef(
  tx: Tx,
  familyId: string,
  caseId: string,
  ref: StoredSceneRef
): Promise<boolean> {
  if (ref.type === 'RECORD_MARKER') {
    if (ref.markerCode !== 'A200401' || ref.evidenceRefs.length === 0) return false;
    for (const evidenceRef of ref.evidenceRefs) {
      if (!(await resolveOneRef(tx, familyId, caseId, evidenceRef))) return false;
    }
    return true;
  }

  const table =
    ref.type === 'DIALOGUE_MESSAGE' ? 'dialogue_messages'
      : ref.type === 'ASSERTION' ? 'assertions'
      : ref.type === 'OBSERVATION' ? 'observations'
      : 'scene_artifacts';

  const { rows } = await tx.query<{ ok: boolean }>(
    `SELECT true AS ok FROM ${table}
      WHERE id = $1 AND family_id = $2 AND case_id = $3`,
    [ref.id, familyId, caseId]
  );
  return rows.length === 1;
}

/**
 * Hard same-Family/same-Case reference integrity. RLS remains active, while
 * explicit Family/Case predicates prevent a visible cross-Case row from being
 * treated as a legal source.
 */
export async function validateSceneRefs(
  tx: Tx,
  input: {
    familyId: string;
    caseId: string;
    refs: readonly StoredSceneRef[];
  }
): Promise<boolean> {
  for (const ref of input.refs) {
    if (!(await resolveOneRef(tx, input.familyId, input.caseId, ref))) return false;
  }
  return true;
}


export async function insertDigitalUseNodeCompletedEvent(
  tx: Tx,
  input: {
    familyId: string;
    caseId: string;
    actorAccountId: string;
    scenePackageVersion: string;
    nodeCode: string;
    nodeRevision: number;
    routeReasonCode: string | null;
    inputRefs: readonly StoredSceneRef[];
    outputRefs: readonly StoredSceneRef[];
    nextNodeCode: string | null;
    terminalCode: string | null;
  }
): Promise<void> {
  await tx.query(
    `INSERT INTO case_events
       (family_id, case_id, actor_account_id, event_type, metadata)
     VALUES ($1,$2,$3,'CASE_DIGITAL_USE_NODE_COMPLETED',$4::jsonb)`,
    [
      input.familyId,
      input.caseId,
      input.actorAccountId,
      JSON.stringify({
        scenePackageVersion: input.scenePackageVersion,
        nodeCode: input.nodeCode,
        nodeRevision: input.nodeRevision,
        routeReasonCode: input.routeReasonCode,
        inputRefs: input.inputRefs,
        outputRefs: input.outputRefs,
        nextNodeCode: input.nextNodeCode,
        terminalCode: input.terminalCode,
      }),
    ]
  );
}

export async function insertDigitalUseNodeCompletedAudit(
  tx: Tx,
  input: {
    familyId: string;
    caseId: string;
    actorAccountId: string;
    scenePackageVersion: string;
    nodeCode: string;
    nodeRevision: number;
    routeReasonCode: string | null;
    nextNodeCode: string | null;
    terminalCode: string | null;
  }
): Promise<void> {
  await tx.query(
    `INSERT INTO business_audit_events
       (family_id, actor_account_id, event_type, resource_type, resource_id, metadata)
     VALUES ($1,$2,'DIGITAL_USE_NODE_COMPLETED','CASE',$3,$4::jsonb)`,
    [
      input.familyId,
      input.actorAccountId,
      input.caseId,
      JSON.stringify({
        scenePackageVersion: input.scenePackageVersion,
        nodeCode: input.nodeCode,
        nodeRevision: input.nodeRevision,
        routeReasonCode: input.routeReasonCode,
        nextNodeCode: input.nextNodeCode,
        terminalCode: input.terminalCode,
      }),
    ]
  );
}


/**
 * Narrow read of current Evidence statements used by Digital Use assessment.
 * It does not interpret content or own fact semantics; callers supply the
 * server-owned prefix and perform deterministic parsing.
 */
export async function listCurrentSceneEvidenceStatements(
  tx: Tx,
  caseId: string,
  contentPrefix: string
): Promise<SceneEvidenceStatementRow[]> {
  const { rows } = await tx.query<SceneEvidenceStatementRow>(
    `SELECT a.id, a.family_id, a.case_id, a.subject_person_id, a.source_person_id,
            a.content, a.confirmation_status, a.conflict_group_id, a.recorded_at
       FROM assertions a
      WHERE a.case_id = $1
        AND a.kind = 'STATEMENT'
        AND a.content LIKE $2
        AND (a.valid_from IS NULL OR a.valid_from <= now())
        AND (a.valid_until IS NULL OR a.valid_until > now())
        AND NOT EXISTS (
          SELECT 1 FROM assertions successor WHERE successor.supersedes_id = a.id
        )
      ORDER BY a.recorded_at ASC, a.id ASC`,
    [caseId, `${contentPrefix}%`]
  );
  return rows;
}
