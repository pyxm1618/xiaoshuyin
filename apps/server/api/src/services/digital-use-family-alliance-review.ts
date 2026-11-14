/**
 * Slice 15 — A5001 FAMILY_ALLIANCE_REVIEW only.
 *
 * Bounded Scene-local effect evaluation. This module consumes the existing
 * Slice 11 Manifest, Slice 12 Scene Artifact/State owner, Slice 13 Family
 * Alliance target truth, Evidence Core and existing control-plane seams.
 * It creates no Review entity/table/API and has no Slice 14 dependency.
 */
import type pg from 'pg';
import {
  A5001FamilyAllianceReviewResponse,
  A5001_FAMILY_DIMENSION_KEYS,
  A5001_TARGET_DIMENSION_KEYS,
  type A5001FamilyAllianceReviewResponseType,
} from '@xiaoshuyin/contracts';
import {
  canonicalJson,
  casCompleteSceneNodeState,
  casRecompleteSceneNodeState,
  coherentCurrentSelectionRevision,
  ensureSceneNodeAvailable,
  getLatestSceneArtifact,
  getSceneNodeState,
  insertDigitalUseNodeCompletedAudit,
  insertDigitalUseNodeCompletedEvent,
  insertSceneArtifact,
  listCurrentDigitalUseTargetItems,
  listCurrentSceneEvidenceStatements,
  lockFamilyForPrimaryDecision,
  lockSceneCase,
  recordStatement,
  validateSceneRefs,
  type DigitalUseTargetItemRow,
  type SceneNodeStateRow,
  type StoredSceneRef,
} from '@xiaoshuyin/domain';
import {
  DIGITAL_USE_PACKAGE_VERSION,
  DIGITAL_USE_SCENE_CODE,
  routeDigitalUseTopology,
  type DigitalUseNodeManifestEntry,
} from '@xiaoshuyin/scenes/digital-use';
import { toHttpError } from '../plugins/error-handler.js';
import {
  currentSceneEnvelope,
  type DigitalUseActor,
} from './digital-use-assessment.js';
import {
  pinAndAssertFamilyAllianceGates,
  revalidateFamilyAllianceGates,
} from './digital-use-family-alliance.js';

const ARTIFACT_TYPE = 'DIGITAL_USE_A5001_EFFECT_EVALUATION' as const;
const ARTIFACT_SCHEMA_VERSION = 'v1' as const;

function reviewError(
  code: string,
  message?: string
): Error & { statusCode: number; code: string } {
  const mapped = toHttpError(code, message);
  return Object.assign(new Error(mapped.message), {
    statusCode: mapped.statusCode,
    code: mapped.code,
  });
}

function rethrowReviewBusinessError(error: unknown): never {
  const code =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown }).code
      : undefined;
  if (typeof code === 'string') {
    const mapped = toHttpError(code);
    if (mapped.statusCode < 500 || code === 'DEPENDENCY_UNAVAILABLE') {
      throw reviewError(code);
    }
  }
  throw error;
}

export interface A5001SubjectSnapshot {
  readonly familyAllianceSelfAssessment: {
    readonly artifactId: string;
    readonly revision: number;
  };
  readonly targetSelectionNodeRevision: number;
  readonly selectionRevision: number;
  readonly selectedTargets: readonly {
    readonly id: string;
    readonly targetCode: DigitalUseTargetItemRow['target_code'];
    readonly revision: number;
    readonly selectionRevision: number;
    readonly concreteTargetText: string | null;
    readonly feasibility: DigitalUseTargetItemRow['feasibility_payload'];
    readonly progress: DigitalUseTargetItemRow['progress_payload'];
    readonly progressEvidenceRefs: readonly StoredSceneRef[];
    readonly helpHistoryRefs: DigitalUseTargetItemRow['help_history_refs'];
    readonly sourceRefs: readonly StoredSceneRef[];
  }[];
}

function completedNode(row: SceneNodeStateRow | null): row is SceneNodeStateRow {
  return row !== null && row.status === 'COMPLETED';
}

/**
 * Server-resolved A5001 subject identity. Client target codes/revisions are
 * optimistic expectations only and never establish the authoritative subject.
 */
export async function resolveA5001SubjectSnapshot(
  tx: pg.PoolClient,
  caseId: string
): Promise<A5001SubjectSnapshot> {
  const a3000 = await getSceneNodeState(tx, caseId, 'A3000');
  const a3002 = await getSceneNodeState(tx, caseId, 'A3002');
  if (!completedNode(a3000) || !completedNode(a3002)) {
    throw reviewError('FAMILY_ALLIANCE_ENTRY_BLOCKED');
  }

  const selfAssessment = await getLatestSceneArtifact(
    tx,
    caseId,
    'FAMILY_ALLIANCE_SELF_ASSESSMENT'
  );
  if (selfAssessment === null) {
    throw reviewError('FAMILY_ALLIANCE_ENTRY_BLOCKED');
  }

  const targets = await listCurrentDigitalUseTargetItems(tx, caseId);
  const selectionRevision = coherentCurrentSelectionRevision(targets);
  if (selectionRevision < 1) {
    throw reviewError('FAMILY_ALLIANCE_ENTRY_BLOCKED');
  }

  return {
    familyAllianceSelfAssessment: {
      artifactId: selfAssessment.id,
      revision: selfAssessment.revision,
    },
    targetSelectionNodeRevision: a3002.revision,
    selectionRevision,
    selectedTargets: targets
      .filter((target) => target.selected)
      .map((target) => ({
        id: target.id,
        targetCode: target.target_code,
        revision: target.revision,
        selectionRevision: target.selection_revision,
        concreteTargetText: target.concrete_target_text,
        feasibility: target.feasibility_payload,
        progress: target.progress_payload,
        progressEvidenceRefs: target.progress_evidence_refs,
        helpHistoryRefs: target.help_history_refs,
        sourceRefs: target.source_refs,
      })),
  };
}

function sameSubject(
  left: A5001SubjectSnapshot,
  right: A5001SubjectSnapshot
): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function sourceRefsFor(
  subject: A5001SubjectSnapshot,
  a3001: SceneNodeStateRow | null,
  a3002: SceneNodeStateRow,
  evidenceRefs: readonly StoredSceneRef[],
  previousArtifactId?: string
): StoredSceneRef[] {
  const refs: StoredSceneRef[] = [
    {
      type: 'SCENE_ARTIFACT',
      id: subject.familyAllianceSelfAssessment.artifactId,
    },
    ...(a3001?.output_refs ?? []),
    ...a3002.output_refs,
    ...subject.selectedTargets.flatMap((target) => [
      { type: 'TARGET_ITEM' as const, id: target.id },
      ...target.sourceRefs,
      ...target.progressEvidenceRefs,
      ...target.helpHistoryRefs.flatMap((entry) => entry.evidenceRefs),
    ]),
    ...(previousArtifactId === undefined
      ? []
      : [{ type: 'SCENE_ARTIFACT' as const, id: previousArtifactId }]),
    ...evidenceRefs,
  ];
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key =
      ref.type === 'RECORD_MARKER'
        ? `RECORD_MARKER:${ref.markerCode}:${canonicalJson(ref.evidenceRefs)}`
        : `${ref.type}:${ref.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function recordReviewStatement(
  tx: pg.PoolClient,
  input: {
    actor: DigitalUseActor;
    familyId: string;
    caseId: string;
    code: string;
    value: unknown;
  }
): Promise<StoredSceneRef> {
  const prefix = `DUA5001:v1:${input.code}:`;
  const existing = await listCurrentSceneEvidenceStatements(
    tx,
    input.caseId,
    prefix
  );
  const actorOwned = existing.filter(
    (row) =>
      row.subject_person_id === input.actor.personId &&
      row.source_person_id === input.actor.personId
  );
  if (actorOwned.length > 1) throw reviewError('SCENE_RESPONSE_INVALID');

  const result = await recordStatement(
    tx,
    {
      familyId: input.familyId,
      caseId: input.caseId,
      actorAccountId: input.actor.accountId,
      actorPersonId: input.actor.personId,
      purpose: 'FAMILY_MANAGEMENT',
    },
    {
      // The authenticated author is the source. Parent-authored text is never
      // silently rewritten as child-sourced evidence.
      subjectPersonId: input.actor.personId,
      sourceKind: 'SELF_STATEMENT',
      sourcePersonId: input.actor.personId,
      occurredTimeState: 'UNKNOWN',
      confirmationStatus: 'UNCONFIRMED',
      ...(actorOwned[0] === undefined ? {} : { supersedesId: actorOwned[0].id }),
      content: `${prefix}${canonicalJson(input.value)}`,
    }
  );
  return { type: 'ASSERTION', id: result.id };
}

async function persistKnownEvaluationEvidence(
  tx: pg.PoolClient,
  input: {
    actor: DigitalUseActor;
    familyId: string;
    caseId: string;
    payload: A5001FamilyAllianceReviewResponseType;
  }
): Promise<StoredSceneRef[]> {
  const refs: StoredSceneRef[] = [];

  for (const key of A5001_FAMILY_DIMENSION_KEYS) {
    const value = input.payload.familyDimensions[key];
    if (value.state !== 'KNOWN') continue;
    refs.push(
      await recordReviewStatement(tx, {
        actor: input.actor,
        familyId: input.familyId,
        caseId: input.caseId,
        code: `family.${key}`,
        value,
      })
    );
  }

  for (const target of input.payload.targetEvaluations) {
    for (const key of A5001_TARGET_DIMENSION_KEYS) {
      const value = target.dimensions[key];
      if (value.state !== 'KNOWN') continue;
      refs.push(
        await recordReviewStatement(tx, {
          actor: input.actor,
          familyId: input.familyId,
          caseId: input.caseId,
          code: `target.${target.targetCode}.${key}`,
          value,
        })
      );
    }
  }

  return refs;
}

function validateTargetExpectations(
  subject: A5001SubjectSnapshot,
  payload: A5001FamilyAllianceReviewResponseType
): void {
  const expectedByCode = new Map(
    payload.targetEvaluations.map((item) => [item.targetCode, item])
  );
  if (expectedByCode.size !== subject.selectedTargets.length) {
    throw reviewError('STALE_TARGET_REVISION');
  }
  for (const target of subject.selectedTargets) {
    const expected = expectedByCode.get(target.targetCode);
    if (expected === undefined || expected.expectedTargetRevision !== target.revision) {
      throw reviewError('STALE_TARGET_REVISION');
    }
  }
}

export interface FamilyAllianceReviewExecutionInput {
  readonly actor: DigitalUseActor;
  readonly familyId: string;
  readonly caseId: string;
  readonly nodeCode: string;
  readonly expectedCaseVersion: number;
  readonly expectedNodeRevision: number;
  readonly expectedScenePackageVersion?: 'v1' | undefined;
  readonly expectedSelectionRevision?: number | undefined;
  readonly expectedTargetRevision?: number | undefined;
  readonly response: Readonly<Record<string, unknown>>;
}

export async function executeFamilyAllianceReviewNodeInTransaction(
  tx: pg.PoolClient,
  input: FamilyAllianceReviewExecutionInput,
  node: DigitalUseNodeManifestEntry
) {
  try {
    if (
      node.nodeCode !== 'A5001' ||
      node.stream !== 'FAMILY_ALLIANCE_REVIEW' ||
      node.role !== 'FAMILY_ALLIANCE_REVIEW'
    ) {
      throw reviewError('SCENE_NODE_UNREACHABLE');
    }
    if (input.expectedScenePackageVersion !== DIGITAL_USE_PACKAGE_VERSION) {
      throw reviewError('STALE_SCENE_PACKAGE');
    }
    // A5001 evaluates all selected current targets. The old single-target
    // concurrency token is not an A5001 subject contract.
    if (input.expectedTargetRevision !== undefined) {
      throw reviewError('SCENE_RESPONSE_INVALID');
    }

    const parsed = A5001FamilyAllianceReviewResponse.safeParse(input.response);
    if (!parsed.success) throw reviewError('SCENE_RESPONSE_INVALID');

    if (!(await lockFamilyForPrimaryDecision(tx, input.familyId))) {
      throw reviewError('CASE_NOT_FOUND', 'Case not found');
    }
    const caseRow = await lockSceneCase(tx, input.caseId);
    if (!caseRow) throw reviewError('CASE_NOT_FOUND', 'Case not found');
    if (caseRow.status === 'SAFETY_HOLD') throw reviewError('SAFETY_HOLD_BLOCKED');
    if (caseRow.status !== 'OPEN') throw reviewError('CASE_NOT_OPEN');
    if (!caseRow.is_primary) throw reviewError('CASE_NOT_PRIMARY');
    if (caseRow.version !== input.expectedCaseVersion) {
      throw reviewError('STALE_CASE_VERSION');
    }
    // Phase 4 Common Core Review does not exist. A5001 consumes the completed
    // Slice 13 Family Alliance subject while the Case remains in GOALS.
    if (caseRow.phase !== 'GOALS') throw reviewError('CASE_PHASE_CONFLICT');

    const packageAnchor = await getSceneNodeState(tx, input.caseId, 'A1001', true);
    const binding = packageAnchor?.scene_package_version ?? null;
    if (binding !== DIGITAL_USE_PACKAGE_VERSION) {
      throw reviewError(
        binding === null ? 'SCENE_PACKAGE_MISMATCH' : 'STALE_SCENE_PACKAGE'
      );
    }

    await pinAndAssertFamilyAllianceGates(
      tx,
      input.caseId,
      input.actor.personId
    );

    const subject = await resolveA5001SubjectSnapshot(tx, input.caseId);
    if (
      input.expectedSelectionRevision === undefined ||
      input.expectedSelectionRevision !== subject.selectionRevision
    ) {
      throw reviewError('STALE_SELECTION_REVISION');
    }
    validateTargetExpectations(subject, parsed.data);

    // A3001 is approved source material only "where present"; it is not an
    // A5001 entry prerequisite. A3002 is part of the exact review subject.
    const a3001 = await getSceneNodeState(tx, input.caseId, 'A3001', true);
    const a3002 = await getSceneNodeState(tx, input.caseId, 'A3002', true);
    if (!completedNode(a3002)) {
      throw reviewError('FAMILY_ALLIANCE_ENTRY_BLOCKED');
    }

    const previous = await getLatestSceneArtifact(
      tx,
      input.caseId,
      ARTIFACT_TYPE
    );
    const clientEvidenceRefs = parsed.data.evidenceRefs as StoredSceneRef[];
    const initialSourceRefs = sourceRefsFor(
      subject,
      a3001,
      a3002,
      clientEvidenceRefs,
      previous?.id
    );
    if (
      !(await validateSceneRefs(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        refs: initialSourceRefs,
      }))
    ) {
      throw reviewError('SCENE_RESPONSE_INVALID');
    }

    let current = await getSceneNodeState(tx, input.caseId, 'A5001', true);
    const reentry = current?.status === 'COMPLETED';
    if (current === null) {
      if (input.expectedNodeRevision !== 0) {
        throw reviewError('STALE_NODE_REVISION');
      }
      if (!node.entryMode.includes('USER_INITIATED')) {
        throw reviewError('SCENE_NODE_UNREACHABLE');
      }
      current = await ensureSceneNodeAvailable(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
        nodeCode: 'A5001',
        sourceNodeCode: 'A5001',
        branchReasonCodes: ['USER_INITIATED'],
        inputRefs: initialSourceRefs,
      });
    } else {
      if (current.revision !== input.expectedNodeRevision) {
        throw reviewError('STALE_NODE_REVISION');
      }
      if (
        current.status !== 'AVAILABLE' &&
        current.status !== 'IN_PROGRESS' &&
        current.status !== 'COMPLETED'
      ) {
        throw reviewError('SCENE_NODE_UNREACHABLE');
      }
      if (
        current.status === 'COMPLETED' &&
        (!node.entryMode.includes('USER_INITIATED') ||
          !node.helpOrReentryRefs.includes('USER_TIMELINE_REVIEW'))
      ) {
        throw reviewError('SCENE_NODE_UNREACHABLE');
      }
    }

    const recordedEvidenceRefs = await persistKnownEvaluationEvidence(tx, {
      actor: input.actor,
      familyId: input.familyId,
      caseId: input.caseId,
      payload: parsed.data,
    });
    const evidenceRefs = [
      ...clientEvidenceRefs,
      ...recordedEvidenceRefs,
    ] as StoredSceneRef[];
    const sourceRefs = sourceRefsFor(
      subject,
      a3001,
      a3002,
      evidenceRefs,
      previous?.id
    );

    if (
      !(await validateSceneRefs(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        refs: sourceRefs,
      }))
    ) {
      throw reviewError('SCENE_RESPONSE_INVALID');
    }

    const artifact = await insertSceneArtifact(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
        artifactType: ARTIFACT_TYPE,
        schemaVersion: ARTIFACT_SCHEMA_VERSION,
        sourceNodeCode: 'A5001',
        data: {
          nodeCode: 'A5001',
          stream: 'FAMILY_ALLIANCE_REVIEW',
          caseRef: { caseId: input.caseId },
          subject: {
            kind: 'FAMILY_ALLIANCE_TARGET_LIST',
            familyAllianceSelfAssessment:
              subject.familyAllianceSelfAssessment,
            targetSelectionNodeRevision: subject.targetSelectionNodeRevision,
            communicationPreparation:
              a3001 === null
                ? null
                : {
                    nodeRevision: a3001.revision,
                    status: a3001.status,
                  },
            selectionRevision: subject.selectionRevision,
            targets: subject.selectedTargets.map((target) => ({
              targetCode: target.targetCode,
              targetItemId: target.id,
              selectionRevision: target.selectionRevision,
              targetRevision: target.revision,
              concreteTargetText: target.concreteTargetText,
              feasibility: target.feasibility,
              progress: target.progress,
              progressEvidenceRefs: target.progressEvidenceRefs,
              helpHistoryRefs: target.helpHistoryRefs,
              sourceRefs: target.sourceRefs,
            })),
            priorReviewArtifact:
              previous === null
                ? null
                : {
                    artifactId: previous.id,
                    revision: previous.revision,
                  },
          },
          sourceRefs,
          evidenceRefs,
          submittedBy: {
            accountId: input.actor.accountId,
            personId: input.actor.personId,
            provenance: 'AUTHENTICATED_ACTOR',
          },
          entryMode: 'USER_INITIATED',
          evaluation: {
            familyDimensions: parsed.data.familyDimensions,
            targetEvaluations: parsed.data.targetEvaluations.map((target) => ({
              targetCode: target.targetCode,
              dimensions: target.dimensions,
            })),
          },
          completion: 'REVIEW_COMPLETE',
        },
        ownerPersonId: input.actor.personId,
        sourceRefs,
        revision: previous === null ? 1 : previous.revision + 1,
        ...(previous === null ? {} : { supersedesId: previous.id }),
      });
    const artifactRef: StoredSceneRef = {
      type: 'SCENE_ARTIFACT',
      id: artifact.id,
    };
    const outputRefs = [...recordedEvidenceRefs, artifactRef];

    const route = routeDigitalUseTopology({
      sceneCode: DIGITAL_USE_SCENE_CODE,
      packageVersion: DIGITAL_USE_PACKAGE_VERSION,
      currentNodeCode: 'A5001',
      conditions: { FAMILY_ALLIANCE_REVIEW_COMPLETE: true },
    });
    if (
      route.kind !== 'TERMINAL_ROUTE' ||
      route.terminalCode !== 'REVIEW_COMPLETE'
    ) {
      throw reviewError('SCENE_ROUTE_UNRESOLVED');
    }
    const reasonCode = reentry
      ? `REENTRY_${route.reasonCode}`
      : route.reasonCode;

    const completed =
      current.status === 'COMPLETED'
        ? await casRecompleteSceneNodeState(tx, {
            caseId: input.caseId,
            nodeCode: 'A5001',
            scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
            expectedRevision: current.revision,
            branchReasonCodes: [reasonCode],
            inputRefs: sourceRefs,
            outputRefs,
          })
        : await casCompleteSceneNodeState(tx, {
            caseId: input.caseId,
            nodeCode: 'A5001',
            scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
            expectedRevision: current.revision,
            status: 'COMPLETED',
            branchReasonCodes: [reasonCode],
            inputRefs: sourceRefs,
            outputRefs,
          });
    if (!completed) throw reviewError('STALE_NODE_REVISION');

    await insertDigitalUseNodeCompletedEvent(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      actorAccountId: input.actor.accountId,
      scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
      nodeCode: 'A5001',
      nodeRevision: completed.revision,
      routeReasonCode: reasonCode,
      inputRefs: sourceRefs,
      outputRefs,
      nextNodeCode: null,
      terminalCode: 'REVIEW_COMPLETE',
    });
    await insertDigitalUseNodeCompletedAudit(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      actorAccountId: input.actor.accountId,
      scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
      nodeCode: 'A5001',
      nodeRevision: completed.revision,
      priorNodeRevision: current.revision,
      routeReasonCode: reasonCode,
      nextNodeCode: null,
      terminalCode: 'REVIEW_COMPLETE',
      sourceNodeCode: 'A5001',
      entryMode: 'USER_INITIATED',
      selectionRevision: subject.selectionRevision,
      inputRefs: sourceRefs,
      outputRefs,
      idempotencyOutcome: 'EXECUTED',
    });

    const finalCase = await lockSceneCase(tx, input.caseId);
    if (
      !finalCase ||
      finalCase.status !== 'OPEN' ||
      !finalCase.is_primary ||
      finalCase.version !== input.expectedCaseVersion ||
      finalCase.phase !== 'GOALS'
    ) {
      throw reviewError('STALE_CASE_VERSION');
    }
    const finalSubject = await resolveA5001SubjectSnapshot(tx, input.caseId);
    if (!sameSubject(subject, finalSubject)) {
      throw reviewError('STALE_TARGET_REVISION');
    }
    await revalidateFamilyAllianceGates(
      tx,
      input.caseId,
      input.actor.personId
    );

    return await currentSceneEnvelope(tx, input.caseId);
  } catch (error) {
    rethrowReviewBusinessError(error);
  }
}

