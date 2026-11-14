/**
 * Slice 13 — bounded Family Alliance target-item persistence.
 *
 * Target items are Scene-level structured state. They are not Common Core Goal,
 * Phase-4 Task/Checkin/Outcome, Evidence, or routing authority.
 */
import type { Tx } from './repository.js';
import type { StoredSceneRef } from './scene-runtime-repository.js';

export const FAMILY_ALLIANCE_TARGET_CODES = [
  'SLEEP',
  'EXERCISE',
  'HOBBIES',
  'CHORES',
  'FAMILY_GATHERING',
  'OUTDOOR_ACTIVITY',
  'EMOTION_REGULATION_1',
  'TIME_MANAGEMENT',
  'FAMILY_RELATIONSHIP',
  'EMOTION_REGULATION_2',
] as const;

export type FamilyAllianceTargetCode =
  (typeof FAMILY_ALLIANCE_TARGET_CODES)[number];

export type FamilyAllianceValueState =
  | 'KNOWN'
  | 'UNKNOWN'
  | 'NOT_COLLECTED'
  | 'DECLINED'
  | 'CONFLICT'
  | 'NOT_APPLICABLE';

export interface FamilyAllianceFeasibilityPayload {
  readonly concreteQuantified:
    | { readonly state: 'KNOWN'; readonly concreteTargetText: string }
    | { readonly state: Exclude<FamilyAllianceValueState, 'KNOWN'> };
  readonly need:
    | { readonly state: 'KNOWN'; readonly rating: number }
    | { readonly state: Exclude<FamilyAllianceValueState, 'KNOWN'> };
  readonly motivationBenefit:
    | { readonly state: 'KNOWN'; readonly rating: number }
    | { readonly state: Exclude<FamilyAllianceValueState, 'KNOWN'> };
  readonly abilityPossibility:
    | { readonly state: 'KNOWN'; readonly rating: number }
    | { readonly state: Exclude<FamilyAllianceValueState, 'KNOWN'> };
  readonly challengeResistance:
    | { readonly state: 'KNOWN'; readonly rating: number }
    | { readonly state: Exclude<FamilyAllianceValueState, 'KNOWN'> };
}

export interface FamilyAllianceHelpHistoryEntry {
  readonly nodeCode: string;
  readonly scenePackageVersion: string;
  readonly interactionRefs: readonly string[];
  readonly helpOrReentryRefs: readonly string[];
  readonly evidenceRefs: readonly StoredSceneRef[];
}

export interface FamilyAllianceProgressPayload {
  readonly stage:
    | 'COMMUNICATION'
    | 'EXECUTION'
    | 'OBSERVATION'
    | 'ADJUSTMENT';
  readonly state: FamilyAllianceValueState;
  readonly modifyTarget?: 'YES' | 'NO' | 'NOT_DECIDED' | undefined;
}

export interface DigitalUseTargetItemRow {
  id: string;
  family_id: string;
  case_id: string;
  scene_package_version: string;
  target_code: FamilyAllianceTargetCode;
  selection_revision: number;
  revision: number;
  selected: boolean;
  concrete_target_text: string | null;
  feasibility_payload: FamilyAllianceFeasibilityPayload | null;
  progress_payload: FamilyAllianceProgressPayload | null;
  progress_evidence_refs: StoredSceneRef[];
  help_history_refs: FamilyAllianceHelpHistoryEntry[];
  source_refs: StoredSceneRef[];
  created_by_person_id: string;
  supersedes_id: string | null;
  superseded_at: Date | null;
  created_at: Date;
}

const TARGET_COLUMNS = `
  id, family_id, case_id, scene_package_version, target_code,
  selection_revision, revision, selected, concrete_target_text,
  feasibility_payload, progress_payload, progress_evidence_refs,
  help_history_refs, source_refs, created_by_person_id, supersedes_id,
  superseded_at, created_at
`;

function targetError(code: string): never {
  throw Object.assign(new Error(code), { code });
}

export function isFamilyAllianceTargetCode(
  value: string
): value is FamilyAllianceTargetCode {
  return (FAMILY_ALLIANCE_TARGET_CODES as readonly string[]).includes(value);
}

export async function listCurrentDigitalUseTargetItems(
  tx: Tx,
  caseId: string
): Promise<DigitalUseTargetItemRow[]> {
  const { rows } = await tx.query<DigitalUseTargetItemRow>(
    `SELECT ${TARGET_COLUMNS}
       FROM digital_use_target_items
      WHERE case_id = $1
        AND superseded_at IS NULL
      ORDER BY target_code ASC`,
    [caseId]
  );
  return rows;
}

export async function listDigitalUseTargetItemHistory(
  tx: Tx,
  caseId: string,
  targetCode?: FamilyAllianceTargetCode
): Promise<DigitalUseTargetItemRow[]> {
  const values: unknown[] = [caseId];
  const targetPredicate =
    targetCode === undefined ? '' : ' AND target_code = $2';
  if (targetCode !== undefined) values.push(targetCode);
  const { rows } = await tx.query<DigitalUseTargetItemRow>(
    `SELECT ${TARGET_COLUMNS}
       FROM digital_use_target_items
      WHERE case_id = $1${targetPredicate}
      ORDER BY target_code ASC, revision ASC`,
    values
  );
  return rows;
}

export async function getCurrentDigitalUseTargetItem(
  tx: Tx,
  caseId: string,
  targetCode: FamilyAllianceTargetCode,
  lock = false
): Promise<DigitalUseTargetItemRow | null> {
  const { rows } = await tx.query<DigitalUseTargetItemRow>(
    `SELECT ${TARGET_COLUMNS}
       FROM digital_use_target_items
      WHERE case_id = $1
        AND target_code = $2
        AND superseded_at IS NULL
      ${lock ? 'FOR UPDATE' : ''}`,
    [caseId, targetCode]
  );
  return rows[0] ?? null;
}

export function coherentCurrentSelectionRevision(
  rows: readonly DigitalUseTargetItemRow[]
): number {
  if (rows.length === 0) return 0;
  if (rows.length !== FAMILY_ALLIANCE_TARGET_CODES.length) {
    targetError('TARGET_SELECTION_STATE_INVALID');
  }
  const revisions = new Set(rows.map((row) => row.selection_revision));
  if (revisions.size !== 1) targetError('TARGET_SELECTION_STATE_INVALID');
  return rows[0]!.selection_revision;
}

export async function getCurrentTargetSelectionRevision(
  tx: Tx,
  caseId: string
): Promise<number> {
  return coherentCurrentSelectionRevision(
    await listCurrentDigitalUseTargetItems(tx, caseId)
  );
}

export async function replaceDigitalUseTargetSelection(
  tx: Tx,
  input: {
    familyId: string;
    caseId: string;
    scenePackageVersion: string;
    expectedSelectionRevision: number;
    selectionRevision: number;
    selectedTargets: readonly FamilyAllianceTargetCode[];
    createdByPersonId: string;
    sourceRefs?: readonly StoredSceneRef[];
  }
): Promise<DigitalUseTargetItemRow[]> {
  const uniqueSelected = new Set(input.selectedTargets);
  if (uniqueSelected.size !== input.selectedTargets.length) {
    targetError('TARGET_SELECTION_INVALID');
  }
  for (const code of uniqueSelected) {
    if (!isFamilyAllianceTargetCode(code)) targetError('TARGET_CODE_INVALID');
  }

  const { rows: current } = await tx.query<DigitalUseTargetItemRow>(
    `SELECT ${TARGET_COLUMNS}
       FROM digital_use_target_items
      WHERE case_id = $1
        AND superseded_at IS NULL
      ORDER BY target_code ASC
      FOR UPDATE`,
    [input.caseId]
  );
  const currentSelectionRevision = coherentCurrentSelectionRevision(current);
  if (currentSelectionRevision !== input.expectedSelectionRevision) {
    targetError('STALE_SELECTION_REVISION');
  }

  const byCode = new Map(current.map((row) => [row.target_code, row]));
  for (const previous of current) {
    const result = await tx.query(
      `UPDATE digital_use_target_items
          SET superseded_at = transaction_timestamp()
        WHERE id = $1
          AND superseded_at IS NULL`,
      [previous.id]
    );
    if (result.rowCount !== 1) targetError('STALE_TARGET_REVISION');
  }

  const nextSelectionRevision = input.selectionRevision;
  if (!Number.isInteger(nextSelectionRevision) || nextSelectionRevision < 1 || nextSelectionRevision <= currentSelectionRevision) {
    targetError('STALE_SELECTION_REVISION');
  }
  const inserted: DigitalUseTargetItemRow[] = [];
  for (const targetCode of FAMILY_ALLIANCE_TARGET_CODES) {
    const previous = byCode.get(targetCode);
    const { rows } = await tx.query<DigitalUseTargetItemRow>(
      `INSERT INTO digital_use_target_items
         (family_id, case_id, scene_package_version, target_code,
          selection_revision, revision, selected, concrete_target_text,
          feasibility_payload, progress_payload, progress_evidence_refs,
          help_history_refs, source_refs, created_by_person_id, supersedes_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,NULL,NULL,'[]'::jsonb,'[]'::jsonb,$8::jsonb,$9,$10)
       RETURNING ${TARGET_COLUMNS}`,
      [
        input.familyId,
        input.caseId,
        input.scenePackageVersion,
        targetCode,
        nextSelectionRevision,
        previous === undefined ? 1 : previous.revision + 1,
        uniqueSelected.has(targetCode),
        JSON.stringify(input.sourceRefs ?? []),
        input.createdByPersonId,
        previous?.id ?? null,
      ]
    );
    const row = rows[0];
    if (!row) targetError('TARGET_INSERT_FAILED');
    inserted.push(row);
  }
  return inserted;
}

export async function reviseDigitalUseTargetItem(
  tx: Tx,
  input: {
    familyId: string;
    caseId: string;
    scenePackageVersion: string;
    targetCode: FamilyAllianceTargetCode;
    expectedSelectionRevision: number;
    expectedTargetRevision: number;
    createdByPersonId: string;
    patch: {
      concreteTargetText?: string | null;
      feasibilityPayload?: FamilyAllianceFeasibilityPayload | null;
      progressPayload?: FamilyAllianceProgressPayload | null;
      progressEvidenceRefs?: readonly StoredSceneRef[];
      helpHistoryRefs?: readonly FamilyAllianceHelpHistoryEntry[];
      sourceRefs?: readonly StoredSceneRef[];
    };
  }
): Promise<DigitalUseTargetItemRow> {
  const current = await getCurrentDigitalUseTargetItem(
    tx,
    input.caseId,
    input.targetCode,
    true
  );
  if (!current || !current.selected) targetError('TARGET_NOT_SELECTED');
  if (current.selection_revision !== input.expectedSelectionRevision) {
    targetError('STALE_SELECTION_REVISION');
  }
  if (current.revision !== input.expectedTargetRevision) {
    targetError('STALE_TARGET_REVISION');
  }
  if (
    current.family_id !== input.familyId ||
    current.scene_package_version !== input.scenePackageVersion
  ) {
    targetError('TARGET_SCOPE_INVALID');
  }

  const closed = await tx.query(
    `UPDATE digital_use_target_items
        SET superseded_at = transaction_timestamp()
      WHERE id = $1
        AND superseded_at IS NULL`,
    [current.id]
  );
  if (closed.rowCount !== 1) targetError('STALE_TARGET_REVISION');

  const concreteTargetText =
    input.patch.concreteTargetText === undefined
      ? current.concrete_target_text
      : input.patch.concreteTargetText;
  const feasibilityPayload =
    input.patch.feasibilityPayload === undefined
      ? current.feasibility_payload
      : input.patch.feasibilityPayload;
  const progressPayload =
    input.patch.progressPayload === undefined
      ? current.progress_payload
      : input.patch.progressPayload;
  const progressEvidenceRefs =
    input.patch.progressEvidenceRefs === undefined
      ? current.progress_evidence_refs
      : [...input.patch.progressEvidenceRefs];
  const helpHistoryRefs =
    input.patch.helpHistoryRefs === undefined
      ? current.help_history_refs
      : [...input.patch.helpHistoryRefs];
  const sourceRefs =
    input.patch.sourceRefs === undefined
      ? current.source_refs
      : [...input.patch.sourceRefs];

  const { rows } = await tx.query<DigitalUseTargetItemRow>(
    `INSERT INTO digital_use_target_items
       (family_id, case_id, scene_package_version, target_code,
        selection_revision, revision, selected, concrete_target_text,
        feasibility_payload, progress_payload, progress_evidence_refs,
        help_history_refs, source_refs, created_by_person_id, supersedes_id)
     VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14)
     RETURNING ${TARGET_COLUMNS}`,
    [
      current.family_id,
      current.case_id,
      current.scene_package_version,
      current.target_code,
      current.selection_revision,
      current.revision + 1,
      concreteTargetText,
      feasibilityPayload === null ? null : JSON.stringify(feasibilityPayload),
      progressPayload === null ? null : JSON.stringify(progressPayload),
      JSON.stringify(progressEvidenceRefs),
      JSON.stringify(helpHistoryRefs),
      JSON.stringify(sourceRefs),
      input.createdByPersonId,
      current.id,
    ]
  );
  const row = rows[0];
  if (!row) targetError('TARGET_INSERT_FAILED');
  return row;
}
