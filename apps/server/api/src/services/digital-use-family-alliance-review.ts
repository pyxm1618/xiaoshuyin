/**
 * Slice 15 — A5001 FAMILY_ALLIANCE_REVIEW.
 *
 * Bounded Scene-local runtime. Professional questionnaire semantics are
 * consumed exclusively through the exact Professional Content package port.
 */
import type pg from 'pg';
import {
  A5001FamilyAllianceReviewSubmission,
  type A5001FamilyAllianceReviewSubmissionType,
} from '@xiaoshuyin/contracts';
import {
  casCompleteSceneNodeState,
  casRecompleteSceneNodeState,
  coherentCurrentSelectionRevision,
  ensureSceneNodeAvailable,
  getLatestSceneArtifact,
  getSceneNodeState,
  getScenePackageBinding,
  hashPayload,
  insertDigitalUseNodeCompletedAudit,
  insertDigitalUseNodeCompletedEvent,
  insertSceneArtifact,
  listCurrentDigitalUseTargetItems,
  lockFamilyForPrimaryDecision,
  lockSceneCase,
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
import { assertBoundAssessmentCompliance, currentSceneEnvelope, type DigitalUseActor } from './digital-use-assessment.js';
import {
  assertDigitalUseCaseLifecycle,
  assertCurrentDigitalUseProblemFormulation,
} from './digital-use-case-lifecycle.js';
import {
  pinAndAssertFamilyAllianceGates,
  revalidateFamilyAllianceGates,
} from './digital-use-family-alliance.js';
import {
  professionalReviewPackageProofIdentity,
  requireProfessionalReviewPackage,
  type ProfessionalReviewContentProvider,
  type ProfessionalReviewPackageProof,
} from './digital-use-review-professional-content.js';
import { assertProfessionalReviewProvenance } from './digital-use-review-provenance.js';

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

function rethrowKnown(error: unknown): never {
  const code =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown }).code
      : undefined;
  if (typeof code === 'string') throw reviewError(code);
  throw error;
}

function completed(row: SceneNodeStateRow | null): row is SceneNodeStateRow {
  return row !== null && row.status === 'COMPLETED';
}

export interface A5001SubjectSnapshot {
  readonly familyId: string;
  readonly caseId: string;
  readonly scenePackageVersion: string;
  readonly familyAllianceSubject: {
    readonly selfAssessmentArtifactId: string;
    readonly selfAssessmentRevision: number;
    readonly targetSelectionNodeRevision: number;
    readonly selectionRevision: number;
  };
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

function targetIdentity(
  subject: A5001SubjectSnapshot
): readonly { targetId: string; targetCode: string; targetRevision: number }[] {
  return subject.selectedTargets
    .map((target) => ({
      targetId: target.id,
      targetCode: target.targetCode,
      targetRevision: target.revision,
    }))
    .sort((left, right) =>
      left.targetCode.localeCompare(right.targetCode) ||
      left.targetId.localeCompare(right.targetId)
    );
}

export function a5001CanonicalRequestFingerprint(
  input: {
    readonly actor: DigitalUseActor;
    readonly familyId: string;
    readonly caseId: string;
    readonly nodeCode: string;
    readonly expectedCaseVersion: number;
    readonly expectedNodeRevision: number;
    readonly expectedScenePackageVersion?: 'v1' | undefined;
    readonly response: Readonly<Record<string, unknown>>;
  },
  normalizedResponse: Readonly<Record<string, unknown>>,
  exactSubject: A5001SubjectSnapshot
) {
  const parsed = A5001FamilyAllianceReviewSubmission.safeParse(input.response);
  if (!parsed.success) throw reviewError('SCENE_RESPONSE_INVALID');
  return {
    parsed: parsed.data,
    normalizedResponse,
    fingerprint: {
      actor: {
        accountId: input.actor.accountId,
        personId: input.actor.personId,
      },
      familyId: input.familyId,
      caseId: input.caseId,
      node: 'A5001',
      stream: 'FAMILY_ALLIANCE_REVIEW',
      expectedCaseVersion: input.expectedCaseVersion,
      expectedNodeRevision: input.expectedNodeRevision,
      scenePackageVersion: input.expectedScenePackageVersion ?? null,
      subject: {
        familyId: exactSubject.familyId,
        caseId: exactSubject.caseId,
        scenePackageVersion: exactSubject.scenePackageVersion,
        familyAllianceSubject: exactSubject.familyAllianceSubject,
        selectedTargets: targetIdentity(exactSubject),
      },
      professionalPackage: parsed.data.professionalPackage,
      normalizedResponse,
      evidenceRefs: parsed.data.evidenceRefs,
      provenance: parsed.data.provenance,
    },
  };
}

export async function resolveA5001SubjectSnapshot(
  tx: pg.PoolClient,
  input: { familyId: string; caseId: string; lock?: boolean }
): Promise<A5001SubjectSnapshot> {
  const lock = input.lock ?? false;
  // Deterministic lock order: A3000 -> A3002 -> target_code ASC.
  const a3000 = await getSceneNodeState(tx, input.caseId, 'A3000', lock);
  const a3002 = await getSceneNodeState(tx, input.caseId, 'A3002', lock);
  if (!completed(a3000) || !completed(a3002)) {
    throw reviewError('FAMILY_ALLIANCE_ENTRY_BLOCKED');
  }

  const selfAssessment = await getLatestSceneArtifact(
    tx,
    input.caseId,
    'FAMILY_ALLIANCE_SELF_ASSESSMENT'
  );
  if (selfAssessment === null) throw reviewError('FAMILY_ALLIANCE_ENTRY_BLOCKED');

  const targets = await listCurrentDigitalUseTargetItems(tx, input.caseId, lock);
  const selectionRevision = coherentCurrentSelectionRevision(targets);
  const selected = targets.filter((target) => target.selected);
  if (selectionRevision < 1 || selected.length === 0) {
    throw reviewError('FAMILY_ALLIANCE_ENTRY_BLOCKED');
  }

  for (const target of selected) {
    if (
      target.family_id !== input.familyId ||
      target.case_id !== input.caseId ||
      target.scene_package_version !== DIGITAL_USE_PACKAGE_VERSION
    ) {
      throw reviewError('TARGET_SCOPE_INVALID');
    }
  }

  return {
    familyId: input.familyId,
    caseId: input.caseId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    familyAllianceSubject: {
      selfAssessmentArtifactId: selfAssessment.id,
      selfAssessmentRevision: selfAssessment.revision,
      targetSelectionNodeRevision: a3002.revision,
      selectionRevision,
    },
    selectedTargets: selected.map((target) => ({
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

function assertSubjectExpectation(
  subject: A5001SubjectSnapshot,
  submission: A5001FamilyAllianceReviewSubmissionType,
  expectedSelectionRevision: number | undefined
): void {
  if (
    expectedSelectionRevision === undefined ||
    expectedSelectionRevision !== subject.familyAllianceSubject.selectionRevision ||
    submission.subject.selectionRevision !== subject.familyAllianceSubject.selectionRevision
  ) {
    throw reviewError('STALE_SELECTION_REVISION');
  }
  if (
    hashPayload(targetIdentity(subject)) !==
    hashPayload(
      submission.subject.selectedTargets
        .map((target) => ({
          targetId: target.targetId,
          targetCode: target.targetCode,
          targetRevision: target.targetRevision,
        }))
        .sort((left, right) =>
          left.targetCode.localeCompare(right.targetCode) ||
          left.targetId.localeCompare(right.targetId)
        )
    )
  ) {
    throw reviewError('STALE_TARGET_REVISION');
  }
}


function sourceRefsFor(
  subject: A5001SubjectSnapshot,
  a3002: SceneNodeStateRow,
  submission: A5001FamilyAllianceReviewSubmissionType,
  previousArtifactId?: string
): StoredSceneRef[] {
  const refs: StoredSceneRef[] = [
    {
      type: 'SCENE_ARTIFACT',
      id: subject.familyAllianceSubject.selfAssessmentArtifactId,
    },
    ...a3002.output_refs,
    ...subject.selectedTargets.flatMap((target) => [
      { type: 'TARGET_ITEM' as const, id: target.id },
      ...target.sourceRefs,
      ...target.progressEvidenceRefs,
      ...target.helpHistoryRefs.flatMap((entry) => entry.evidenceRefs),
    ]),
    ...submission.evidenceRefs,
    ...(previousArtifactId
      ? [{ type: 'SCENE_ARTIFACT' as const, id: previousArtifactId }]
      : []),
  ];
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key =
      ref.type === 'RECORD_MARKER'
        ? hashPayload(ref)
        : `${ref.type}:${ref.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sameSubject(
  left: A5001SubjectSnapshot,
  right: A5001SubjectSnapshot
): boolean {
  return hashPayload(left) === hashPayload(right);
}

function sameProof(
  left: ProfessionalReviewPackageProof,
  right: ProfessionalReviewPackageProof
): boolean {
  return (
    hashPayload(professionalReviewPackageProofIdentity(left)) ===
    hashPayload(professionalReviewPackageProofIdentity(right))
  );
}

export async function prepareA5001ReviewFingerprintInTransaction(
  tx: pg.PoolClient,
  input: {
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
  },
  node: DigitalUseNodeManifestEntry,
  provider: ProfessionalReviewContentProvider
): Promise<Readonly<Record<string, unknown>>> {
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
  if (input.expectedTargetRevision !== undefined) {
    throw reviewError('SCENE_RESPONSE_INVALID');
  }

  const parsed = A5001FamilyAllianceReviewSubmission.safeParse(input.response);
  if (!parsed.success) throw reviewError('SCENE_RESPONSE_INVALID');
  if (!(await lockFamilyForPrimaryDecision(tx, input.familyId))) {
    throw reviewError('CASE_NOT_FOUND', 'Case not found');
  }
  const caseRow = await lockSceneCase(tx, input.caseId);
  if (!caseRow) throw reviewError('CASE_NOT_FOUND', 'Case not found');
  assertDigitalUseCaseLifecycle(caseRow, node, input.expectedCaseVersion);
  await assertCurrentDigitalUseProblemFormulation(tx, input.caseId);

  const binding = await getScenePackageBinding(tx, input.caseId);
  if (binding !== DIGITAL_USE_PACKAGE_VERSION) {
    throw reviewError(
      binding === null ? 'SCENE_NODE_UNREACHABLE' : 'STALE_SCENE_PACKAGE'
    );
  }

  await pinAndAssertFamilyAllianceGates(tx, input.caseId, input.actor.personId);
  await assertProfessionalReviewProvenance(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    actorPersonId: input.actor.personId,
    evidenceRefs: parsed.data.evidenceRefs,
    provenance: parsed.data.provenance,
  });

  const subject = await resolveA5001SubjectSnapshot(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    lock: true,
  });
  assertSubjectExpectation(subject, parsed.data, input.expectedSelectionRevision);

  const professionalPackage = await requireProfessionalReviewPackage(
    provider,
    {
      stream: 'FAMILY_ALLIANCE_REVIEW',
      scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
      packageId: parsed.data.professionalPackage.packageId,
      packageVersion: parsed.data.professionalPackage.packageVersion,
      contentHash: parsed.data.professionalPackage.contentHash,
    },
    'RESOLVE'
  );

  let normalizedResponse: Readonly<Record<string, unknown>>;
  try {
    normalizedResponse = professionalPackage.validateAndNormalizeResponse(
      parsed.data.packageResponse
    );
  } catch {
    throw reviewError('SCENE_RESPONSE_INVALID');
  }

  return a5001CanonicalRequestFingerprint(
    input,
    normalizedResponse,
    subject
  ).fingerprint;
  } catch (error) {
    rethrowKnown(error);
  }
}

export async function executeA5001ReviewInTransaction(
  tx: pg.PoolClient,
  input: {
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
  },
  node: DigitalUseNodeManifestEntry,
  provider: ProfessionalReviewContentProvider
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
    if (input.expectedTargetRevision !== undefined) {
      throw reviewError('SCENE_RESPONSE_INVALID');
    }

    const parsed = A5001FamilyAllianceReviewSubmission.safeParse(input.response);
    if (!parsed.success) throw reviewError('SCENE_RESPONSE_INVALID');

    if (!(await lockFamilyForPrimaryDecision(tx, input.familyId))) {
      throw reviewError('CASE_NOT_FOUND', 'Case not found');
    }
    const caseRow = await lockSceneCase(tx, input.caseId);
    if (!caseRow) throw reviewError('CASE_NOT_FOUND', 'Case not found');
    assertDigitalUseCaseLifecycle(
      caseRow,
      { ...node, stream: 'FAMILY_ALLIANCE' },
      input.expectedCaseVersion
    );
    await assertCurrentDigitalUseProblemFormulation(tx, input.caseId);

    const binding = await getScenePackageBinding(tx, input.caseId);
    if (binding !== DIGITAL_USE_PACKAGE_VERSION) {
      throw reviewError(binding === null ? 'SCENE_NODE_UNREACHABLE' : 'STALE_SCENE_PACKAGE');
    }

    await pinAndAssertFamilyAllianceGates(tx, input.caseId, input.actor.personId);
    await assertBoundAssessmentCompliance(tx, input);
    await assertProfessionalReviewProvenance(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      actorPersonId: input.actor.personId,
      evidenceRefs: parsed.data.evidenceRefs,
      provenance: parsed.data.provenance,
    });
    const subject = await resolveA5001SubjectSnapshot(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      lock: true,
    });
    assertSubjectExpectation(subject, parsed.data, input.expectedSelectionRevision);

    const packageInput = {
      stream: 'FAMILY_ALLIANCE_REVIEW' as const,
      scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
      packageId: parsed.data.professionalPackage.packageId,
      packageVersion: parsed.data.professionalPackage.packageVersion,
      contentHash: parsed.data.professionalPackage.contentHash,
    };
    const professionalPackage = await requireProfessionalReviewPackage(
      provider,
      packageInput,
      'RESOLVE'
    );
    let normalizedResponse: Readonly<Record<string, unknown>>;
    try {
      normalizedResponse = professionalPackage.validateAndNormalizeResponse(
        parsed.data.packageResponse
      );
    } catch {
      throw reviewError('SCENE_RESPONSE_INVALID');
    }

    const a3002 = await getSceneNodeState(tx, input.caseId, 'A3002', true);
    if (!completed(a3002)) throw reviewError('FAMILY_ALLIANCE_ENTRY_BLOCKED');

    const previous = await getLatestSceneArtifact(tx, input.caseId, ARTIFACT_TYPE);
    const sourceRefs = sourceRefsFor(
      subject,
      a3002,
      parsed.data,
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

    let current = await getSceneNodeState(tx, input.caseId, 'A5001', true);
    if (current === null) {
      if (input.expectedNodeRevision !== 0 || !node.entryMode.includes('USER_INITIATED')) {
        throw reviewError('STALE_NODE_REVISION');
      }
      current = await ensureSceneNodeAvailable(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
        nodeCode: 'A5001',
        sourceNodeCode: 'A5001',
        branchReasonCodes: ['USER_INITIATED'],
        inputRefs: sourceRefs,
      });
    } else if (current.revision !== input.expectedNodeRevision) {
      throw reviewError('STALE_NODE_REVISION');
    }

    const reentry = current.status === 'COMPLETED';
    if (
      current.status !== 'AVAILABLE' &&
      current.status !== 'IN_PROGRESS' &&
      current.status !== 'COMPLETED'
    ) {
      throw reviewError('SCENE_NODE_UNREACHABLE');
    }
    if (
      reentry &&
      (!node.entryMode.includes('USER_INITIATED') ||
        !node.helpOrReentryRefs.includes('USER_TIMELINE_REVIEW'))
    ) {
      throw reviewError('SCENE_NODE_UNREACHABLE');
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
        subject,
        professionalPackage: professionalReviewPackageProofIdentity(
          professionalPackage.proof
        ),
        normalizedResponse,
        evidenceRefs: parsed.data.evidenceRefs,
        provenance: parsed.data.provenance,
        submittedBy: {
          accountId: input.actor.accountId,
          personId: input.actor.personId,
          provenance: 'AUTHENTICATED_ACTOR',
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

    const completedState =
      current.status === 'COMPLETED'
        ? await casRecompleteSceneNodeState(tx, {
            caseId: input.caseId,
            nodeCode: 'A5001',
            scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
            expectedRevision: current.revision,
            branchReasonCodes: [reasonCode],
            inputRefs: sourceRefs,
            outputRefs: [artifactRef],
          })
        : await casCompleteSceneNodeState(tx, {
            caseId: input.caseId,
            nodeCode: 'A5001',
            scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
            expectedRevision: current.revision,
            status: 'COMPLETED',
            branchReasonCodes: [reasonCode],
            inputRefs: sourceRefs,
            outputRefs: [artifactRef],
          });
    if (!completedState) throw reviewError('STALE_NODE_REVISION');

    await insertDigitalUseNodeCompletedEvent(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      actorAccountId: input.actor.accountId,
      scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
      nodeCode: 'A5001',
      nodeRevision: completedState.revision,
      routeReasonCode: reasonCode,
      inputRefs: sourceRefs,
      outputRefs: [artifactRef],
      nextNodeCode: null,
      terminalCode: 'REVIEW_COMPLETE',
    });
    await insertDigitalUseNodeCompletedAudit(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      actorAccountId: input.actor.accountId,
      scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
      nodeCode: 'A5001',
      nodeRevision: completedState.revision,
      priorNodeRevision: current.revision,
      routeReasonCode: reasonCode,
      nextNodeCode: null,
      terminalCode: 'REVIEW_COMPLETE',
      sourceNodeCode: 'A5001',
      entryMode: 'USER_INITIATED',
      selectionRevision: subject.familyAllianceSubject.selectionRevision,
      inputRefs: sourceRefs,
      outputRefs: [artifactRef],
      idempotencyOutcome: 'EXECUTED',
    });

    const finalCase = await lockSceneCase(tx, input.caseId);
    if (!finalCase) throw reviewError('CASE_NOT_FOUND', 'Case not found');
    assertDigitalUseCaseLifecycle(finalCase, node, input.expectedCaseVersion);
    await assertCurrentDigitalUseProblemFormulation(tx, input.caseId);
    await revalidateFamilyAllianceGates(tx, input.caseId, input.actor.personId);
    await assertBoundAssessmentCompliance(tx, input);

    const finalSubject = await resolveA5001SubjectSnapshot(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      lock: true,
    });
    if (!sameSubject(subject, finalSubject)) {
      throw reviewError('STALE_TARGET_REVISION');
    }
    const finalPackage = await requireProfessionalReviewPackage(
      provider,
      packageInput,
      'REVALIDATE'
    );
    if (!sameProof(professionalPackage.proof, finalPackage.proof)) {
      throw reviewError('DEPENDENCY_UNAVAILABLE');
    }
    try {
      const finalNormalizedResponse =
        finalPackage.validateAndNormalizeResponse(parsed.data.packageResponse);
      if (
        hashPayload(finalNormalizedResponse) !== hashPayload(normalizedResponse)
      ) {
        throw reviewError('DEPENDENCY_UNAVAILABLE');
      }
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: unknown }).code === 'DEPENDENCY_UNAVAILABLE'
      ) {
        throw error;
      }
      throw reviewError('DEPENDENCY_UNAVAILABLE');
    }

    return await currentSceneEnvelope(tx, input.caseId);
  } catch (error) {
    rethrowKnown(error);
  }
}
