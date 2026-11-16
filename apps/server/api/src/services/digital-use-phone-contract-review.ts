/**
 * Slice 15 — A5002 PHONE_USE_CONTRACT_REVIEW only.
 *
 * Bounded Scene-local effect evaluation of one exact Slice 14 Contract version.
 * This module consumes the authoritative Contract / Scene / Evidence /
 * control-plane owners. It never creates, activates, supersedes or revises a
 * Contract and it creates no generic Review owner.
 */
import type pg from 'pg';
import {
  A5002PhoneUseContractReviewResponse,
  A5002_DIMENSION_KEYS,
  type A5002PhoneUseContractReviewResponseType,
} from '@xiaoshuyin/contracts';
import {
  assertOrdinaryProgressionAllowedRaw,
  canonicalJson,
  casCompleteSceneNodeState,
  casRecompleteSceneNodeState,
  ensureSceneNodeAvailable,
  getCurrentProblemFormulation,
  getCurrentActivePhoneUseContract,
  getLatestSceneArtifact,
  getPhoneUseContractById,
  getSceneNodeState,
  getScenePackageBinding,
  hashPayload,
  insertDigitalUseNodeCompletedAudit,
  insertDigitalUseNodeCompletedEvent,
  insertSceneArtifact,
  isProblemFormulationAuthoritativeExecutionBasis,
  listCurrentSceneEvidenceStatements,
  listPhoneUseContractVersions,
  listSceneArtifacts,
  lockFamilyForPrimaryDecision,
  lockSceneCase,
  recordStatement,
  validateSceneRefs,
  type PhoneUseContractVersionRow,
  type SceneArtifactRow,
  type SceneNodeStateRow,
  type StoredSceneRef,
} from '@xiaoshuyin/domain';
import {
  DIGITAL_USE_PACKAGE_VERSION,
  DIGITAL_USE_SCENE_CODE,
  resolvePhoneUseContractContent,
  routeDigitalUseTopology,
  type DigitalUseNodeManifestEntry,
} from '@xiaoshuyin/scenes/digital-use';
import { toHttpError } from '../plugins/error-handler.js';
import {
  assertAssessmentCompliance,
  currentSceneEnvelope,
  type DigitalUseActor,
} from './digital-use-assessment.js';
import {
  assertPhoneUseContractChildParticipation,
  assertPhoneUseContractDependencies,
} from './digital-use-phone-contract-gates.js';

const ARTIFACT_TYPE = 'DIGITAL_USE_A5002_EFFECT_EVALUATION' as const;
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

function exactContractTermsFingerprint(row: PhoneUseContractVersionRow): string {
  return hashPayload({
    contractPurpose: row.contract_purpose,
    phoneUseRules: row.phone_use_rules,
    executionPeriod: row.execution_period,
    parentSupportMeasures: row.parent_support_measures,
    supervisionMeasures: row.supervision_measures,
    incentives: row.incentives,
    breachResponsibilities: row.breach_responsibilities,
    dependencyRefs: row.dependency_refs,
    adultPartyPersonId: row.adult_party_person_id,
    childPartyPersonId: row.child_party_person_id,
    childParticipationId: row.child_participation_id,
  });
}

/**
 * Immutable A5002 idempotency subject. Deliberately excludes mutable Contract
 * status so an already-committed command can still replay after a later A4012
 * supersession. New executions validate expectedContractStatus under lock.
 */
export interface A5002SubjectFingerprint {
  readonly contractVersionId: string;
  readonly familyId: string;
  readonly caseId: string;
  readonly contractVersion: number;
  readonly contractDraftRevision: number;
  readonly sourceTemplateVersion: string;
  readonly contractTermsFingerprint: string;
}

export async function resolveA5002SubjectFingerprint(
  tx: pg.PoolClient,
  input: {
    familyId: string;
    caseId: string;
    contractVersionId: string;
    contractVersion: number;
    expectedContractDraftRevision: number;
  }
): Promise<A5002SubjectFingerprint> {
  const row = await getPhoneUseContractById(tx, input.contractVersionId, false);
  if (
    row === null ||
    row.family_id !== input.familyId ||
    row.case_id !== input.caseId
  ) {
    throw reviewError('PHONE_USE_CONTRACT_NOT_FOUND');
  }
  if (
    row.version !== input.contractVersion ||
    row.draft_revision !== input.expectedContractDraftRevision
  ) {
    throw reviewError('PHONE_USE_CONTRACT_STALE_REVISION');
  }
  resolvePhoneUseContractContent(row.source_template_version);
  return {
    contractVersionId: row.id,
    familyId: row.family_id,
    caseId: row.case_id,
    contractVersion: row.version,
    contractDraftRevision: row.draft_revision,
    sourceTemplateVersion: row.source_template_version,
    contractTermsFingerprint: exactContractTermsFingerprint(row),
  };
}

function sameSubject(
  left: A5002SubjectFingerprint,
  right: A5002SubjectFingerprint
): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function dataString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' ? value : null;
}

function dataNumber(data: Record<string, unknown>, key: string): number | null {
  const value = data[key];
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function artifactMatchesContract(
  artifact: SceneArtifactRow,
  contract: PhoneUseContractVersionRow
): boolean {
  const artifactVersion =
    dataNumber(artifact.data, 'contractVersion') ??
    dataNumber(artifact.data, 'version');
  return (
    dataString(artifact.data, 'contractVersionId') === contract.id &&
    artifactVersion === contract.version
  );
}

function a5002SupervisionHistory(
  artifacts: readonly SceneArtifactRow[]
): readonly SceneArtifactRow[] {
  return artifacts
    .filter(
      (artifact) =>
        artifact.source_node_code === 'A4006' &&
        (artifact.artifact_type === 'PHONE_USE_SUPERVISION_COMPONENT' ||
          artifact.artifact_type === 'PHONE_USE_SUPERVISION_LOG')
    )
    .sort((left, right) => left.created_at.getTime() - right.created_at.getTime());
}

function sourceRefsFor(
  contract: PhoneUseContractVersionRow,
  artifacts: readonly SceneArtifactRow[],
  evidenceRefs: readonly StoredSceneRef[],
  previousArtifactId?: string
): StoredSceneRef[] {
  const contractRefs = contract.dependency_refs as StoredSceneRef[];
  const relevantArtifacts = artifacts
    .filter(
      (artifact) =>
        ((artifact.artifact_type === 'PHONE_USE_CONTRACT_DOCUMENT' ||
          artifact.artifact_type === 'PHONE_USE_CONTRACT_SUPPORT_LOG') &&
          artifactMatchesContract(artifact, contract)) ||
        (artifact.source_node_code === 'A4006' &&
          (artifact.artifact_type === 'PHONE_USE_SUPERVISION_COMPONENT' ||
            artifact.artifact_type === 'PHONE_USE_SUPERVISION_LOG'))
    )
    .map((artifact) => ({
      type: 'SCENE_ARTIFACT' as const,
      id: artifact.id,
    }));

  const refs: StoredSceneRef[] = [
    ...contractRefs,
    ...relevantArtifacts,
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
  const prefix = `DUA5002:v1:${input.code}:`;
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
  if (actorOwned.length > 1) {
    throw reviewError('SCENE_RESPONSE_INVALID');
  }

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
      subjectPersonId: input.actor.personId,
      sourceKind: 'SELF_STATEMENT',
      sourcePersonId: input.actor.personId,
      occurredTimeState: 'UNKNOWN',
      confirmationStatus: 'UNCONFIRMED',
      ...(actorOwned[0] === undefined
        ? {}
        : { supersedesId: actorOwned[0].id }),
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
    payload: A5002PhoneUseContractReviewResponseType;
  }
): Promise<StoredSceneRef[]> {
  const refs: StoredSceneRef[] = [];
  for (const key of A5002_DIMENSION_KEYS) {
    const value = input.payload.dimensions[key];
    if (value.state !== 'KNOWN') continue;
    refs.push(
      await recordReviewStatement(tx, {
        actor: input.actor,
        familyId: input.familyId,
        caseId: input.caseId,
        code: `contract.${key}`,
        value,
      })
    );
  }

  if (input.payload.a4012TriggerObservation.state === 'KNOWN') {
    refs.push(
      await recordReviewStatement(tx, {
        actor: input.actor,
        familyId: input.familyId,
        caseId: input.caseId,
        code: 'contract.a4012TriggerObservation',
        value: input.payload.a4012TriggerObservation,
      })
    );
  }
  return refs;
}

function dependencyActor(
  contract: PhoneUseContractVersionRow,
  fallback: DigitalUseActor
): DigitalUseActor {
  return contract.parent_confirmation
    ? {
        accountId: contract.parent_confirmation.accountId,
        personId: contract.parent_confirmation.personId,
      }
    : fallback;
}

function assertExactContract(
  row: PhoneUseContractVersionRow | null,
  input: {
    familyId: string;
    caseId: string;
    payload: A5002PhoneUseContractReviewResponseType;
  }
): asserts row is PhoneUseContractVersionRow {
  if (
    row === null ||
    row.family_id !== input.familyId ||
    row.case_id !== input.caseId
  ) {
    throw reviewError('PHONE_USE_CONTRACT_NOT_FOUND');
  }
  if (
    row.version !== input.payload.contractVersion ||
    row.draft_revision !== input.payload.expectedContractDraftRevision ||
    row.status !== input.payload.expectedContractStatus
  ) {
    throw reviewError('PHONE_USE_CONTRACT_STALE_REVISION');
  }
}

function contractLineage(
  rows: readonly PhoneUseContractVersionRow[]
): readonly {
  contractVersionId: string;
  contractVersion: number;
  contractDraftRevision: number;
  status: PhoneUseContractVersionRow['status'];
  supersedesId: string | null;
  updateTrigger: PhoneUseContractVersionRow['update_trigger'];
}[] {
  return rows.map((row) => ({
    contractVersionId: row.id,
    contractVersion: row.version,
    contractDraftRevision: row.draft_revision,
    status: row.status,
    supersedesId: row.supersedes_id,
    updateTrigger: row.update_trigger,
  }));
}

export interface PhoneUseContractReviewExecutionInput {
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

export async function executePhoneUseContractReviewNodeInTransaction(
  tx: pg.PoolClient,
  input: PhoneUseContractReviewExecutionInput,
  node: DigitalUseNodeManifestEntry
) {
  try {
    if (
      node.nodeCode !== 'A5002' ||
      node.stream !== 'PHONE_USE_CONTRACT_REVIEW' ||
      node.role !== 'PHONE_USE_CONTRACT_REVIEW'
    ) {
      throw reviewError('SCENE_NODE_UNREACHABLE');
    }
    if (input.expectedScenePackageVersion !== DIGITAL_USE_PACKAGE_VERSION) {
      throw reviewError('STALE_SCENE_PACKAGE');
    }
    if (
      input.expectedSelectionRevision !== undefined ||
      input.expectedTargetRevision !== undefined
    ) {
      throw reviewError('SCENE_RESPONSE_INVALID');
    }

    const parsed = A5002PhoneUseContractReviewResponse.safeParse(input.response);
    if (!parsed.success) throw reviewError('SCENE_RESPONSE_INVALID');

    if (!(await lockFamilyForPrimaryDecision(tx, input.familyId))) {
      throw reviewError('CASE_NOT_FOUND', 'Case not found');
    }
    const caseRow = await lockSceneCase(tx, input.caseId);
    if (!caseRow) throw reviewError('CASE_NOT_FOUND', 'Case not found');
    if (caseRow.status === 'SAFETY_HOLD') {
      throw reviewError('SAFETY_HOLD_BLOCKED');
    }
    if (caseRow.status !== 'OPEN') throw reviewError('CASE_NOT_OPEN');
    if (!caseRow.is_primary) throw reviewError('CASE_NOT_PRIMARY');
    if (caseRow.version !== input.expectedCaseVersion) {
      throw reviewError('STALE_CASE_VERSION');
    }

    const formulation = await getCurrentProblemFormulation(tx, input.caseId);
    if (
      formulation === null ||
      !isProblemFormulationAuthoritativeExecutionBasis(formulation)
    ) {
      throw reviewError('PROBLEM_FORMULATION_DEPENDENCY_INVALID');
    }

    const binding = await getScenePackageBinding(tx, input.caseId);
    if (binding !== DIGITAL_USE_PACKAGE_VERSION) {
      throw reviewError(
        binding === null ? 'SCENE_PACKAGE_MISMATCH' : 'STALE_SCENE_PACKAGE'
      );
    }

    await assertOrdinaryProgressionAllowedRaw(tx, { caseId: input.caseId });
    await assertAssessmentCompliance(tx, input.actor.personId);

    // The client supplies exact optimistic expectations, but does not choose
    // the business subject. Slice 14's current ACTIVE Contract owner resolves
    // the authoritative subject; every supplied identity/revision must match.
    const contract = await getCurrentActivePhoneUseContract(
      tx,
      input.caseId,
      true
    );
    assertExactContract(contract, {
      familyId: input.familyId,
      caseId: input.caseId,
      payload: parsed.data,
    });
    resolvePhoneUseContractContent(contract.source_template_version);

    const immutableSubject = await resolveA5002SubjectFingerprint(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      contractVersionId: contract.id,
      contractVersion: contract.version,
      expectedContractDraftRevision: contract.draft_revision,
    });

    await assertPhoneUseContractDependencies(tx, {
      actor: dependencyActor(contract, input.actor),
      familyId: input.familyId,
      caseId: input.caseId,
      dependencyRefs: contract.dependency_refs,
    });
    await assertPhoneUseContractChildParticipation(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      childPersonId: contract.child_party_person_id,
      participationId: contract.child_participation_id,
    });

    const artifacts = await listSceneArtifacts(tx, input.caseId);
    const previous = await getLatestSceneArtifact(
      tx,
      input.caseId,
      ARTIFACT_TYPE
    );
    const history = await listPhoneUseContractVersions(tx, input.caseId);
    const clientEvidenceRefs = parsed.data.evidenceRefs as StoredSceneRef[];
    const initialSourceRefs = sourceRefsFor(
      contract,
      artifacts,
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

    let current = await getSceneNodeState(tx, input.caseId, 'A5002', true);
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
        nodeCode: 'A5002',
        sourceNodeCode: 'A5002',
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
      contract,
      artifacts,
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

    const matchingDocument = artifacts
      .filter(
        (artifact) =>
          artifact.artifact_type === 'PHONE_USE_CONTRACT_DOCUMENT' &&
          artifactMatchesContract(artifact, contract)
      )
      .sort((a, b) => b.revision - a.revision)[0] ?? null;
    const supportArtifacts = artifacts
      .filter(
        (artifact) =>
          artifact.artifact_type === 'PHONE_USE_CONTRACT_SUPPORT_LOG' &&
          artifactMatchesContract(artifact, contract)
      )
      .map((artifact) => ({
        artifactId: artifact.id,
        revision: artifact.revision,
      }));
    const supervisionHistory = a5002SupervisionHistory(artifacts).map(
      (artifact) => ({
        artifactId: artifact.id,
        artifactType: artifact.artifact_type,
        revision: artifact.revision,
        createdAt: artifact.created_at.toISOString(),
      })
    );

    const artifact = await insertSceneArtifact(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
      artifactType: ARTIFACT_TYPE,
      schemaVersion: ARTIFACT_SCHEMA_VERSION,
      sourceNodeCode: 'A5002',
      data: {
        nodeCode: 'A5002',
        stream: 'PHONE_USE_CONTRACT_REVIEW',
        caseRef: { caseId: input.caseId },
        subject: {
          kind: 'PHONE_USE_CONTRACT_VERSION',
          contractVersionId: contract.id,
          contractVersion: contract.version,
          contractDraftRevision: contract.draft_revision,
          contractStatus: contract.status,
          sourceTemplateVersion: contract.source_template_version,
          contractTermsFingerprint: immutableSubject.contractTermsFingerprint,
          contractDocument:
            matchingDocument === null
              ? null
              : {
                  artifactId: matchingDocument.id,
                  revision: matchingDocument.revision,
                },
          a4011SupportArtifacts: supportArtifacts,
          a4006SupervisionArtifacts: supervisionHistory,
          contractLineage: contractLineage(history),
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
          dimensions: parsed.data.dimensions,
          a4012TriggerObservation: parsed.data.a4012TriggerObservation,
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
      currentNodeCode: 'A5002',
      conditions: { CONTRACT_REVIEW_COMPLETE: true },
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
            nodeCode: 'A5002',
            scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
            expectedRevision: current.revision,
            branchReasonCodes: [reasonCode],
            inputRefs: sourceRefs,
            outputRefs,
          })
        : await casCompleteSceneNodeState(tx, {
            caseId: input.caseId,
            nodeCode: 'A5002',
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
      nodeCode: 'A5002',
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
      nodeCode: 'A5002',
      nodeRevision: completed.revision,
      priorNodeRevision: current.revision,
      routeReasonCode: reasonCode,
      nextNodeCode: null,
      terminalCode: 'REVIEW_COMPLETE',
      sourceNodeCode: 'A5002',
      entryMode: 'USER_INITIATED',
      inputRefs: sourceRefs,
      outputRefs,
      idempotencyOutcome: 'EXECUTED',
    });

    const finalCase = await lockSceneCase(tx, input.caseId);
    if (!finalCase) throw reviewError('CASE_NOT_FOUND', 'Case not found');
    if (finalCase.status === 'SAFETY_HOLD') {
      throw reviewError('SAFETY_HOLD_BLOCKED');
    }
    if (finalCase.status !== 'OPEN') throw reviewError('CASE_NOT_OPEN');
    if (!finalCase.is_primary) throw reviewError('CASE_NOT_PRIMARY');
    if (finalCase.version !== input.expectedCaseVersion) {
      throw reviewError('STALE_CASE_VERSION');
    }
    const finalFormulation = await getCurrentProblemFormulation(tx, input.caseId);
    if (
      finalFormulation === null ||
      !isProblemFormulationAuthoritativeExecutionBasis(finalFormulation)
    ) {
      throw reviewError('PROBLEM_FORMULATION_DEPENDENCY_INVALID');
    }
    const finalBinding = await getScenePackageBinding(tx, input.caseId);
    if (finalBinding !== DIGITAL_USE_PACKAGE_VERSION) {
      throw reviewError('STALE_SCENE_PACKAGE');
    }

    const finalContract = await getCurrentActivePhoneUseContract(
      tx,
      input.caseId,
      true
    );
    assertExactContract(finalContract, {
      familyId: input.familyId,
      caseId: input.caseId,
      payload: parsed.data,
    });
    const finalSubject = await resolveA5002SubjectFingerprint(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      contractVersionId: finalContract.id,
      contractVersion: finalContract.version,
      expectedContractDraftRevision: finalContract.draft_revision,
    });
    if (!sameSubject(immutableSubject, finalSubject)) {
      throw reviewError('PHONE_USE_CONTRACT_STALE_REVISION');
    }

    await assertPhoneUseContractDependencies(tx, {
      actor: dependencyActor(finalContract, input.actor),
      familyId: input.familyId,
      caseId: input.caseId,
      dependencyRefs: finalContract.dependency_refs,
    });
    await assertPhoneUseContractChildParticipation(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      childPersonId: finalContract.child_party_person_id,
      participationId: finalContract.child_participation_id,
    });
    await assertOrdinaryProgressionAllowedRaw(tx, { caseId: input.caseId });
    await assertAssessmentCompliance(tx, input.actor.personId);

    return await currentSceneEnvelope(tx, input.caseId);
  } catch (error) {
    rethrowReviewBusinessError(error);
  }
}
