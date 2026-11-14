/**
 * Slice 13 — bounded FAMILY_ALLIANCE business semantics.
 *
 * This module owns no topology. Node identity/role comes from the Slice 11
 * Manifest; routing remains routeDigitalUseTopology(). Substantive narrative
 * is written through Evidence Core, while target structured state is revisioned
 * in digital_use_target_items.
 */
import type pg from 'pg';
import {
  canonicalJson,
  getCurrentDigitalUseTargetItem,
  getLatestSceneArtifact,
  insertSceneArtifact,
  listCurrentSceneEvidenceStatements,
  recordStatement,
  replaceDigitalUseTargetSelection,
  reviseDigitalUseTargetItem,
  type DigitalUseTargetItemRow,
  type FamilyAllianceTargetCode,
  type StoredSceneRef,
} from '@xiaoshuyin/domain';
import {
  FamilyAllianceCommunicationPrepResponse,
  FamilyAllianceFeasibilityResponse,
  FamilyAllianceHelpResponse,
  FamilyAllianceProgressResponse,
  FamilyAllianceSelfAssessmentResponse,
  FamilyAllianceTargetDefinitionResponse,
  FamilyAllianceTargetSelectionResponse,
} from '@xiaoshuyin/contracts';
import {
  DIGITAL_USE_PACKAGE_VERSION,
  type DigitalUseNodeManifestEntry,
} from '@xiaoshuyin/scenes/digital-use';
import { loadIntegratedTriageEvidence } from './digital-use-triage-evidence.js';
import type { DigitalUseActor } from './digital-use-assessment.js';

export interface FamilyAllianceSemanticContext {
  readonly tx: pg.PoolClient;
  readonly actor: DigitalUseActor;
  readonly familyId: string;
  readonly caseId: string;
  readonly node: DigitalUseNodeManifestEntry;
  readonly response: Readonly<Record<string, unknown>>;
  readonly currentInputRefs: readonly StoredSceneRef[];
  readonly nextNodeRevision: number;
  readonly expectedSelectionRevision?: number;
  readonly expectedTargetRevision?: number;
}

export interface FamilyAllianceSemanticResult {
  readonly inputRefs: readonly StoredSceneRef[];
  readonly outputRefs: readonly StoredSceneRef[];
  readonly conditions: Readonly<Record<string, boolean>>;
  readonly selectedTargets?: readonly FamilyAllianceTargetCode[];
  readonly targetRow?: DigitalUseTargetItemRow;
}

function familyError(code: string): never {
  throw Object.assign(new Error(code), { code });
}

function requireSelectionRevision(value: number | undefined): number {
  if (value === undefined) familyError('STALE_SELECTION_REVISION');
  return value;
}

function requireTargetRevision(value: number | undefined): number {
  if (value === undefined) familyError('STALE_TARGET_REVISION');
  return value;
}

function evidencePrefix(code: string): string {
  return `DUFA:v1:${code}:`;
}

async function recordFamilyStatement(
  context: FamilyAllianceSemanticContext,
  code: string,
  value: unknown
): Promise<StoredSceneRef> {
  const prefix = evidencePrefix(code);
  const existing = await listCurrentSceneEvidenceStatements(
    context.tx,
    context.caseId,
    prefix
  );
  const actorOwned = existing.filter(
    (row) =>
      row.subject_person_id === context.actor.personId &&
      row.source_person_id === context.actor.personId
  );
  if (actorOwned.length > 1) familyError('INTEGRATED_TRIAGE_BLOCKED');

  const result = await recordStatement(
    context.tx,
    {
      familyId: context.familyId,
      caseId: context.caseId,
      actorAccountId: context.actor.accountId,
      actorPersonId: context.actor.personId,
      purpose: 'FAMILY_MANAGEMENT',
    },
    {
      subjectPersonId: context.actor.personId,
      sourceKind: 'SELF_STATEMENT',
      sourcePersonId: context.actor.personId,
      occurredTimeState: 'UNKNOWN',
      confirmationStatus: 'UNCONFIRMED',
      ...(actorOwned[0] === undefined ? {} : { supersedesId: actorOwned[0].id }),
      content: `${prefix}${canonicalJson(value)}`,
    }
  );
  return { type: 'ASSERTION', id: result.id };
}

const ROLE_TARGET: Readonly<Record<string, FamilyAllianceTargetCode>> = Object.freeze({
  SLEEP: 'SLEEP',
  EXERCISE: 'EXERCISE',
  HOBBY: 'HOBBIES',
  HOUSEWORK: 'CHORES',
  FAMILY_GATHERING: 'FAMILY_GATHERING',
  OUTDOOR_ACTIVITY: 'OUTDOOR_ACTIVITY',
  EMOTION_REGULATION_1: 'EMOTION_REGULATION_1',
  TIME_MANAGEMENT: 'TIME_MANAGEMENT',
  FAMILY_RELATIONSHIP: 'FAMILY_RELATIONSHIP',
  EMOTION_REGULATION_2: 'EMOTION_REGULATION_2',
});

export type FamilyAllianceTargetRole =
  | 'TARGET'
  | 'FEASIBILITY'
  | 'PROGRESS'
  | 'HELP';

export function familyAllianceTargetIdentity(
  node: Pick<DigitalUseNodeManifestEntry, 'stream' | 'role'>
): { role: FamilyAllianceTargetRole; targetCode: FamilyAllianceTargetCode } | null {
  if (node.stream !== 'FAMILY_ALLIANCE') return null;
  for (const role of ['TARGET', 'FEASIBILITY', 'PROGRESS', 'HELP'] as const) {
    const prefix = `${role}_`;
    if (!node.role.startsWith(prefix)) continue;
    const suffix = node.role.slice(prefix.length);
    const targetCode = ROLE_TARGET[suffix];
    if (targetCode === undefined) familyError('TARGET_CODE_INVALID');
    return { role, targetCode };
  }
  return null;
}

async function mandatoryTargets(
  context: FamilyAllianceSemanticContext
): Promise<ReadonlySet<FamilyAllianceTargetCode>> {
  const evidence = await loadIntegratedTriageEvidence(context.tx, context.caseId);
  if (
    evidence.emotion01002.kind !== 'VALUE' ||
    evidence.family01003.kind !== 'VALUE'
  ) {
    familyError('DEPENDENCY_UNAVAILABLE');
  }

  const required = new Set<FamilyAllianceTargetCode>();
  const emotion = evidence.emotion01002.value;
  const family = evidence.family01003.value;

  if (emotion.some((value) => value === 'B' || value === 'C')) {
    required.add('EMOTION_REGULATION_1');
  }
  if (emotion.some((value) => value === 'D' || value === 'E' || value === 'F')) {
    required.add('EMOTION_REGULATION_2');
  }
  if (family !== 'A') required.add('TIME_MANAGEMENT');
  if (family === 'D' || family === 'E' || family === 'F') {
    required.add('FAMILY_RELATIONSHIP');
  }
  return required;
}

async function applyA3000(
  context: FamilyAllianceSemanticContext
): Promise<FamilyAllianceSemanticResult> {
  const parsed = FamilyAllianceSelfAssessmentResponse.safeParse(context.response);
  if (!parsed.success) familyError('SCENE_RESPONSE_INVALID');

  const refs: StoredSceneRef[] = [];
  const entries = Object.entries(parsed.data.answers) as Array<
    [keyof typeof parsed.data.answers, (typeof parsed.data.answers)[keyof typeof parsed.data.answers]]
  >;
  for (const [key, value] of entries) {
    refs.push(await recordFamilyStatement(context, `a3000.${key}`, { state: value }));
  }

  const previous = await getLatestSceneArtifact(
    context.tx,
    context.caseId,
    'FAMILY_ALLIANCE_SELF_ASSESSMENT'
  );
  const artifact = await insertSceneArtifact(context.tx, {
    familyId: context.familyId,
    caseId: context.caseId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    artifactType: 'FAMILY_ALLIANCE_SELF_ASSESSMENT',
    schemaVersion: 'v1',
    sourceNodeCode: 'A3000',
    data: {
      contentVersion: 'family-alliance-principles-v1',
      displayProjection: entries.map(([key], index) => ({
        key,
        evidenceRef: refs[index],
      })),
      blockingResult: false,
    },
    ownerPersonId: context.actor.personId,
    sourceRefs: refs,
    revision: previous === null ? 1 : previous.revision + 1,
    ...(previous === null ? {} : { supersedesId: previous.id }),
  });
  const artifactRef: StoredSceneRef = { type: 'SCENE_ARTIFACT', id: artifact.id };

  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [...refs, artifactRef],
    conditions: { FAMILY_ALLIANCE_SELF_ASSESSMENT_COMPLETE: true },
  };
}

function applyA3001(
  context: FamilyAllianceSemanticContext
): FamilyAllianceSemanticResult {
  const parsed = FamilyAllianceCommunicationPrepResponse.safeParse(context.response);
  if (!parsed.success) familyError('SCENE_RESPONSE_INVALID');
  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [],
    conditions: { USER_ENTERS_TARGET_MANAGEMENT: true },
  };
}

async function applyA3002(
  context: FamilyAllianceSemanticContext
): Promise<FamilyAllianceSemanticResult> {
  const parsed = FamilyAllianceTargetSelectionResponse.safeParse(context.response);
  if (!parsed.success) familyError('SCENE_RESPONSE_INVALID');

  const required = await mandatoryTargets(context);
  const selected = new Set<FamilyAllianceTargetCode>(parsed.data.selectedTargets);
  for (const code of required) {
    if (!selected.has(code)) familyError('TARGET_SELECTION_INVALID');
  }

  const rows = await replaceDigitalUseTargetSelection(context.tx, {
    familyId: context.familyId,
    caseId: context.caseId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    expectedSelectionRevision: requireSelectionRevision(
      context.expectedSelectionRevision
    ),
    selectionRevision: context.nextNodeRevision,
    selectedTargets: parsed.data.selectedTargets,
    createdByPersonId: context.actor.personId,
    sourceRefs: context.currentInputRefs,
  });

  return {
    inputRefs: context.currentInputRefs,
    outputRefs: rows.map((row) => ({ type: 'TARGET_ITEM' as const, id: row.id })),
    conditions: {},
    selectedTargets: parsed.data.selectedTargets,
  };
}

async function applyTargetFamily(
  context: FamilyAllianceSemanticContext,
  identity: { role: FamilyAllianceTargetRole; targetCode: FamilyAllianceTargetCode }
): Promise<FamilyAllianceSemanticResult> {
  const common = {
    familyId: context.familyId,
    caseId: context.caseId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    targetCode: identity.targetCode,
    expectedSelectionRevision: requireSelectionRevision(
      context.expectedSelectionRevision
    ),
    expectedTargetRevision: requireTargetRevision(context.expectedTargetRevision),
    createdByPersonId: context.actor.personId,
  };

  if (identity.role === 'TARGET') {
    const parsed = FamilyAllianceTargetDefinitionResponse.safeParse(context.response);
    if (!parsed.success) familyError('SCENE_RESPONSE_INVALID');
    const targetRow = await reviseDigitalUseTargetItem(context.tx, {
      ...common,
      patch: {
        concreteTargetText: parsed.data.concreteTargetText,
        sourceRefs: context.currentInputRefs,
      },
    });
    return {
      inputRefs: context.currentInputRefs,
      outputRefs: [{ type: 'TARGET_ITEM', id: targetRow.id }],
      conditions: {},
      targetRow,
    };
  }

  if (identity.role === 'FEASIBILITY') {
    const parsed = FamilyAllianceFeasibilityResponse.safeParse(context.response);
    if (!parsed.success) familyError('SCENE_RESPONSE_INVALID');

    // Frozen Evidence boundary: need/motivation/ability/resistance ratings are
    // user-provided substantive statements. Evidence owns that source truth;
    // the target item below is the bounded structured Scene projection.
    const feasibilityEvidenceRef = await recordFamilyStatement(
      context,
      `${context.node.nodeCode}.feasibility`,
      {
        targetCode: identity.targetCode,
        feasibility: parsed.data.feasibility,
      }
    );

    const targetRow = await reviseDigitalUseTargetItem(context.tx, {
      ...common,
      patch: {
        ...(parsed.data.feasibility.concreteQuantified.state === 'KNOWN'
          ? {
              concreteTargetText:
                parsed.data.feasibility.concreteQuantified.concreteTargetText,
            }
          : {}),
        feasibilityPayload: parsed.data.feasibility,
        sourceRefs: [...context.currentInputRefs, feasibilityEvidenceRef],
      },
    });
    return {
      inputRefs: context.currentInputRefs,
      outputRefs: [
        feasibilityEvidenceRef,
        { type: 'TARGET_ITEM', id: targetRow.id },
      ],
      conditions: {},
      targetRow,
    };
  }

  if (identity.role === 'PROGRESS') {
    const parsed = FamilyAllianceProgressResponse.safeParse(context.response);
    if (!parsed.success) familyError('SCENE_RESPONSE_INVALID');
    const evidenceRefs: StoredSceneRef[] = [];
    if (parsed.data.note !== undefined) {
      evidenceRefs.push(
        await recordFamilyStatement(
          context,
          `${context.node.nodeCode}.progress_note`,
          { note: parsed.data.note }
        )
      );
    }
    const targetRow = await reviseDigitalUseTargetItem(context.tx, {
      ...common,
      patch: {
        progressPayload: parsed.data.progress,
        progressEvidenceRefs: evidenceRefs,
        sourceRefs: [...context.currentInputRefs, ...evidenceRefs],
      },
    });
    return {
      inputRefs: context.currentInputRefs,
      outputRefs: [
        ...evidenceRefs,
        { type: 'TARGET_ITEM', id: targetRow.id },
      ],
      conditions: {},
      targetRow,
    };
  }

  const parsed = FamilyAllianceHelpResponse.safeParse(context.response);
  if (!parsed.success) familyError('SCENE_RESPONSE_INVALID');
  const currentNoteRefs: StoredSceneRef[] = [];
  if (parsed.data.note !== undefined) {
    currentNoteRefs.push(
      await recordFamilyStatement(
        context,
        `${context.node.nodeCode}.help_note`,
        { note: parsed.data.note }
      )
    );
  }

  const current = await getCurrentDigitalUseTargetItem(
    context.tx,
    context.caseId,
    identity.targetCode,
    true
  );
  if (!current || !current.selected) familyError('TARGET_NOT_SELECTED');
  if (current.selection_revision !== common.expectedSelectionRevision) {
    familyError('STALE_SELECTION_REVISION');
  }
  if (current.revision !== common.expectedTargetRevision) {
    familyError('STALE_TARGET_REVISION');
  }

  const helpEntry = {
    nodeCode: context.node.nodeCode,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    interactionRefs: [...context.node.interactionRefs],
    helpOrReentryRefs: [...context.node.helpOrReentryRefs],
    evidenceRefs: currentNoteRefs,
  };
  const targetRow = await reviseDigitalUseTargetItem(context.tx, {
    ...common,
    patch: {
      helpHistoryRefs: [...current.help_history_refs, helpEntry],
      sourceRefs: [...context.currentInputRefs, ...currentNoteRefs],
    },
  });
  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [
      ...currentNoteRefs,
      { type: 'TARGET_ITEM', id: targetRow.id },
    ],
    conditions: {},
    targetRow,
  };
}

export async function applyFamilyAllianceNodeSemantics(
  context: FamilyAllianceSemanticContext
): Promise<FamilyAllianceSemanticResult> {
  if (context.node.stream !== 'FAMILY_ALLIANCE') {
    familyError('SCENE_NODE_UNREACHABLE');
  }
  if (context.node.nodeCode === 'A3000') return applyA3000(context);
  if (context.node.nodeCode === 'A3001') return applyA3001(context);
  if (context.node.nodeCode === 'A3002') return applyA3002(context);

  const identity = familyAllianceTargetIdentity(context.node);
  if (identity === null) familyError('SCENE_RESPONSE_INVALID');
  return applyTargetFamily(context, identity);
}
