/**
 * Slice 15 — A5002 PHONE_USE_CONTRACT_REVIEW.
 *
 * Evaluates one exact Contract version without latest-version substitution.
 * This module never drafts, confirms, activates, revises or supersedes a
 * Contract and never executes A4012.
 */
import type pg from 'pg';
import {
  A5002PhoneUseContractReviewSubmission,
  type A5002PhoneUseContractReviewSubmissionType,
} from '@xiaoshuyin/contracts';
import {
  assertOrdinaryProgressionAllowedRaw,
  casCompleteSceneNodeState,
  casRecompleteSceneNodeState,
  ensureSceneNodeAvailable,
  getLatestSceneArtifact,
  getSceneNodeState,
  getScenePackageBinding,
  hashPayload,
  insertDigitalUseNodeCompletedAudit,
  insertDigitalUseNodeCompletedEvent,
  insertSceneArtifact,
  listPhoneUseContractVersions,
  listSceneArtifacts,
  lockFamilyForPrimaryDecision,
  lockSceneCase,
  validateSceneRefs,
  type PhoneUseContractVersionRow,
  type SceneArtifactRow,
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
  assertBoundAssessmentCompliance,
  currentSceneEnvelope,
  type DigitalUseActor,
} from './digital-use-assessment.js';
import {
  assertDigitalUseCaseLifecycle,
  assertCurrentDigitalUseProblemFormulation,
} from './digital-use-case-lifecycle.js';
import {
  assertPhoneUseContractChildParticipation,
  assertPhoneUseContractDependencies,
} from './digital-use-phone-contract.js';
import {
  professionalReviewPackageProofIdentity,
  requireProfessionalReviewPackage,
  type ProfessionalReviewContentProvider,
  type ProfessionalReviewPackageProof,
} from './digital-use-review-professional-content.js';
import { assertProfessionalReviewProvenance } from './digital-use-review-provenance.js';

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

function rethrowKnown(error: unknown): never {
  const code =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown }).code
      : undefined;
  if (typeof code === 'string') throw reviewError(code);
  throw error;
}

function contractTermsFingerprint(row: PhoneUseContractVersionRow): string {
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

function lineageFor(
  exact: PhoneUseContractVersionRow,
  rows: readonly PhoneUseContractVersionRow[]
) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const lineage: {
    contractId: string;
    version: number;
    revision: number;
    status: string;
    supersedesId: string | null;
  }[] = [];
  let current: PhoneUseContractVersionRow | undefined = exact;
  const seen = new Set<string>();
  while (current !== undefined && !seen.has(current.id)) {
    seen.add(current.id);
    lineage.push({
      contractId: current.id,
      version: current.version,
      revision: current.draft_revision,
      status: current.status,
      supersedesId: current.supersedes_id,
    });
    current =
      current.supersedes_id === null
        ? undefined
        : byId.get(current.supersedes_id);
  }
  return lineage;
}

export interface A5002SubjectSnapshot {
  readonly familyId: string;
  readonly caseId: string;
  readonly scenePackageVersion: string;
  readonly contractId: string;
  readonly contractVersion: number;
  readonly contractRevision: number;
  readonly contractStatus: PhoneUseContractVersionRow['status'];
  readonly sourceTemplateVersion: string;
  readonly executionPeriod: PhoneUseContractVersionRow['execution_period'];
  readonly adultPartyPersonId: string;
  readonly childPartyPersonId: string;
  readonly childParticipationId: string;
  readonly contractTermsFingerprint: string;
  readonly supersedesId: string | null;
  readonly lineage: readonly {
    readonly contractId: string;
    readonly version: number;
    readonly revision: number;
    readonly status: string;
    readonly supersedesId: string | null;
  }[];
}

export function a5002CanonicalRequestFingerprint(
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
  exactSubject: A5002SubjectSnapshot
) {
  const parsed = A5002PhoneUseContractReviewSubmission.safeParse(input.response);
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
      node: 'A5002',
      stream: 'PHONE_USE_CONTRACT_REVIEW',
      expectedCaseVersion: input.expectedCaseVersion,
      expectedNodeRevision: input.expectedNodeRevision,
      scenePackageVersion: input.expectedScenePackageVersion ?? null,
      subject: exactSubject,
      professionalPackage: parsed.data.professionalPackage,
      normalizedResponse,
      evidenceRefs: parsed.data.evidenceRefs,
      provenance: parsed.data.provenance,
    },
  };
}

export async function resolveA5002SubjectSnapshot(
  tx: pg.PoolClient,
  input: {
    familyId: string;
    caseId: string;
    contractId: string;
    contractVersion: number;
    contractRevision: number;
    lock?: boolean;
  }
): Promise<{ row: PhoneUseContractVersionRow; snapshot: A5002SubjectSnapshot }> {
  const lock = input.lock ?? false;
  // Deterministic Contract lock order is owned by the repository query
  // (version ASC). Resolve the exact requested Contract from that locked lineage
  // instead of locking one row first and then the rest in a different order.
  const versions = await listPhoneUseContractVersions(tx, input.caseId, lock);
  const row = versions.find((candidate) => candidate.id === input.contractId) ?? null;
  if (
    row === null ||
    row.family_id !== input.familyId ||
    row.case_id !== input.caseId
  ) {
    throw reviewError('PHONE_USE_CONTRACT_NOT_FOUND');
  }
  if (
    row.version !== input.contractVersion ||
    row.draft_revision !== input.contractRevision
  ) {
    throw reviewError('PHONE_USE_CONTRACT_STALE_REVISION');
  }
  if (row.status !== 'ACTIVE') {
    throw reviewError('PHONE_USE_CONTRACT_STALE_REVISION');
  }

  return {
    row,
    snapshot: {
      familyId: input.familyId,
      caseId: input.caseId,
      scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
      contractId: row.id,
      contractVersion: row.version,
      contractRevision: row.draft_revision,
      contractStatus: row.status,
      sourceTemplateVersion: row.source_template_version,
      executionPeriod: row.execution_period,
      adultPartyPersonId: row.adult_party_person_id,
      childPartyPersonId: row.child_party_person_id,
      childParticipationId: row.child_participation_id,
      contractTermsFingerprint: contractTermsFingerprint(row),
      supersedesId: row.supersedes_id,
      lineage: lineageFor(row, versions),
    },
  };
}

function assertSubjectExpectation(
  row: PhoneUseContractVersionRow,
  submission: A5002PhoneUseContractReviewSubmissionType
): void {
  if (
    submission.subject.contractId !== row.id ||
    submission.subject.contractVersion !== row.version ||
    submission.subject.contractRevision !== row.draft_revision ||
    submission.subject.contractStatus !== row.status
  ) {
    throw reviewError('PHONE_USE_CONTRACT_STALE_REVISION');
  }
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
  const version =
    dataNumber(artifact.data, 'contractVersion') ??
    dataNumber(artifact.data, 'version');
  return (
    dataString(artifact.data, 'contractVersionId') === contract.id &&
    version === contract.version
  );
}

function sourceRefsFor(
  contract: PhoneUseContractVersionRow,
  artifacts: readonly SceneArtifactRow[],
  submission: A5002PhoneUseContractReviewSubmissionType,
  previousArtifactId?: string
): StoredSceneRef[] {
  const contractRefs = contract.dependency_refs as StoredSceneRef[];
  const relatedArtifacts = artifacts
    .filter(
      (artifact) =>
        artifactMatchesContract(artifact, contract) &&
        (
          artifact.artifact_type === 'PHONE_USE_CONTRACT_DOCUMENT' ||
          artifact.artifact_type === 'PHONE_USE_CONTRACT_SUPPORT_LOG'
        )
    )
    .map((artifact) => ({
      type: 'SCENE_ARTIFACT' as const,
      id: artifact.id,
    }));
  const refs: StoredSceneRef[] = [
    ...contractRefs,
    ...relatedArtifacts,
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
  left: A5002SubjectSnapshot,
  right: A5002SubjectSnapshot
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

export async function prepareA5002ReviewFingerprintInTransaction(
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

  const parsed = A5002PhoneUseContractReviewSubmission.safeParse(input.response);
  if (!parsed.success) throw reviewError('SCENE_RESPONSE_INVALID');
  if (!(await lockFamilyForPrimaryDecision(tx, input.familyId))) {
    throw reviewError('CASE_NOT_FOUND', 'Case not found');
  }
  const caseRow = await lockSceneCase(tx, input.caseId);
  if (!caseRow) throw reviewError('CASE_NOT_FOUND', 'Case not found');
  assertDigitalUseCaseLifecycle(caseRow, node, input.expectedCaseVersion);
  await assertOrdinaryProgressionAllowedRaw(tx, { caseId: input.caseId });
  await assertCurrentDigitalUseProblemFormulation(tx, input.caseId);
  await assertBoundAssessmentCompliance(tx, input);

  const binding = await getScenePackageBinding(tx, input.caseId);
  if (binding !== DIGITAL_USE_PACKAGE_VERSION) {
    throw reviewError(
      binding === null ? 'SCENE_NODE_UNREACHABLE' : 'STALE_SCENE_PACKAGE'
    );
  }

  const { row: contract, snapshot: subject } =
    await resolveA5002SubjectSnapshot(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      contractId: parsed.data.subject.contractId,
      contractVersion: parsed.data.subject.contractVersion,
      contractRevision: parsed.data.subject.contractRevision,
      lock: true,
    });
  assertSubjectExpectation(contract, parsed.data);

  await assertPhoneUseContractDependencies(tx, {
    actor: input.actor,
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
  await assertProfessionalReviewProvenance(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    actorPersonId: input.actor.personId,
    evidenceRefs: parsed.data.evidenceRefs,
    provenance: parsed.data.provenance,
    exactChildSubject: {
      personId: contract.child_party_person_id,
      participationId: contract.child_participation_id,
    },
  });

  const professionalPackage = await requireProfessionalReviewPackage(
    provider,
    {
      stream: 'PHONE_USE_CONTRACT_REVIEW',
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

  return a5002CanonicalRequestFingerprint(
    input,
    normalizedResponse,
    subject
  ).fingerprint;
  } catch (error) {
    rethrowKnown(error);
  }
}

export async function executeA5002ReviewInTransaction(
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

    const parsed = A5002PhoneUseContractReviewSubmission.safeParse(input.response);
    if (!parsed.success) throw reviewError('SCENE_RESPONSE_INVALID');

    if (!(await lockFamilyForPrimaryDecision(tx, input.familyId))) {
      throw reviewError('CASE_NOT_FOUND', 'Case not found');
    }
    const caseRow = await lockSceneCase(tx, input.caseId);
    if (!caseRow) throw reviewError('CASE_NOT_FOUND', 'Case not found');
    assertDigitalUseCaseLifecycle(caseRow, node, input.expectedCaseVersion);
    await assertOrdinaryProgressionAllowedRaw(tx, { caseId: input.caseId });
    await assertCurrentDigitalUseProblemFormulation(tx, input.caseId);
    await assertBoundAssessmentCompliance(tx, input);

    const binding = await getScenePackageBinding(tx, input.caseId);
    if (binding !== DIGITAL_USE_PACKAGE_VERSION) {
      throw reviewError(binding === null ? 'SCENE_NODE_UNREACHABLE' : 'STALE_SCENE_PACKAGE');
    }

    const { row: contract, snapshot: subject } =
      await resolveA5002SubjectSnapshot(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        contractId: parsed.data.subject.contractId,
        contractVersion: parsed.data.subject.contractVersion,
        contractRevision: parsed.data.subject.contractRevision,
        lock: true,
      });
    assertSubjectExpectation(contract, parsed.data);

    await assertPhoneUseContractDependencies(tx, {
      actor: input.actor,
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
    await assertProfessionalReviewProvenance(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      actorPersonId: input.actor.personId,
      evidenceRefs: parsed.data.evidenceRefs,
      provenance: parsed.data.provenance,
      exactChildSubject: {
        personId: contract.child_party_person_id,
        participationId: contract.child_participation_id,
      },
    });

    const packageInput = {
      stream: 'PHONE_USE_CONTRACT_REVIEW' as const,
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

    const artifacts = await listSceneArtifacts(tx, input.caseId);
    const previous = await getLatestSceneArtifact(tx, input.caseId, ARTIFACT_TYPE);
    const sourceRefs = sourceRefsFor(
      contract,
      artifacts,
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

    let current = await getSceneNodeState(tx, input.caseId, 'A5002', true);
    if (current === null) {
      if (input.expectedNodeRevision !== 0 || !node.entryMode.includes('USER_INITIATED')) {
        throw reviewError('STALE_NODE_REVISION');
      }
      current = await ensureSceneNodeAvailable(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
        nodeCode: 'A5002',
        sourceNodeCode: 'A5002',
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
      sourceNodeCode: 'A5002',
      data: {
        nodeCode: 'A5002',
        stream: 'PHONE_USE_CONTRACT_REVIEW',
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
        a4012Boundary: 'OBSERVE_ONLY',
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

    const completedState =
      current.status === 'COMPLETED'
        ? await casRecompleteSceneNodeState(tx, {
            caseId: input.caseId,
            nodeCode: 'A5002',
            scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
            expectedRevision: current.revision,
            branchReasonCodes: [reasonCode],
            inputRefs: sourceRefs,
            outputRefs: [artifactRef],
          })
        : await casCompleteSceneNodeState(tx, {
            caseId: input.caseId,
            nodeCode: 'A5002',
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
      nodeCode: 'A5002',
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
      nodeCode: 'A5002',
      nodeRevision: completedState.revision,
      priorNodeRevision: current.revision,
      routeReasonCode: reasonCode,
      nextNodeCode: null,
      terminalCode: 'REVIEW_COMPLETE',
      sourceNodeCode: 'A5002',
      entryMode: 'USER_INITIATED',
      inputRefs: sourceRefs,
      outputRefs: [artifactRef],
      idempotencyOutcome: 'EXECUTED',
    });

    const finalCase = await lockSceneCase(tx, input.caseId);
    if (!finalCase) throw reviewError('CASE_NOT_FOUND', 'Case not found');
    assertDigitalUseCaseLifecycle(finalCase, node, input.expectedCaseVersion);
    await assertOrdinaryProgressionAllowedRaw(tx, { caseId: input.caseId });
    await assertCurrentDigitalUseProblemFormulation(tx, input.caseId);
    await assertBoundAssessmentCompliance(tx, input);

    const { row: finalContract, snapshot: finalSubject } =
      await resolveA5002SubjectSnapshot(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        contractId: parsed.data.subject.contractId,
        contractVersion: parsed.data.subject.contractVersion,
        contractRevision: parsed.data.subject.contractRevision,
        lock: true,
      });
    if (!sameSubject(subject, finalSubject)) {
      throw reviewError('PHONE_USE_CONTRACT_STALE_REVISION');
    }
    await assertPhoneUseContractDependencies(tx, {
      actor: input.actor,
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
