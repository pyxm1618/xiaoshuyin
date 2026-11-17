/**
 * Slice 17 Professional Knowledge command/application service.
 *
 * Production authority defaults fail closed. Tests may inject protocol fakes,
 * but no environment flag/configuration can select synthetic authority.
 */
import type pg from 'pg';
import {
  appendConsumedProfessionalApprovalEvidence,
  appendProfessionalKnowledgeAudit,
  appendProfessionalKnowledgeReviewEvidence,
  applyProfessionalKnowledgeDependencyState,
  createProfessionalKnowledgeCandidate,
  createProfessionalKnowledgeSuccessor,
  editProfessionalKnowledgeCandidate,
  hashPayload,
  getProfessionalKnowledgePredecessorId,
  lockProfessionalKnowledgeVersion,
  markProfessionalKnowledgeVersionSuperseded,
  releaseProfessionalKnowledgeVersion,
  resolveProfessionalReviewStaffAuthority,
  retireProfessionalKnowledgeVersion,
  setProfessionalKnowledgeAdminContext,
  evaluateProfessionalKnowledgeEligibility,
  projectProfessionalKnowledgeDependencyImpact,
  validateProfessionalApproval,
  validateProfessionalKnowledgeVersionContract,
  type ProfessionalApprovalProvider,
  type ProfessionalApprovalProviderResult,
  type ProfessionalApprovalValidation,
  type ProfessionalKnowledgeScopeMetadata,
  type ProfessionalKnowledgeSourceSnapshot,
  type ProfessionalKnowledgeVersionSnapshot,
  type ProfessionalQualificationProvider,
  type ProfessionalQualificationResult,
} from '@xiaoshuyin/domain';
import {
  resolveDigitalUseProfessionalKnowledgeBinding,
} from '@xiaoshuyin/scenes/digital-use';
import {
  runIdempotentCommandInTransaction,
  type CommandOutcome,
} from '../idempotency.js';
import { withProfessionalKnowledgeAdminTransaction } from '../db/tx.js';

export const unavailableProductionProfessionalApprovalProvider:
  ProfessionalApprovalProvider = {
    async resolve(): Promise<ProfessionalApprovalProviderResult> {
      return { status: 'UNAVAILABLE', reason: 'PROVIDER_UNAVAILABLE' };
    },
    async revalidate(): Promise<ProfessionalApprovalProviderResult> {
      return { status: 'UNAVAILABLE', reason: 'PROVIDER_UNAVAILABLE' };
    },
  };

export const unavailableProductionProfessionalQualificationProvider:
  ProfessionalQualificationProvider = {
    async resolve(): Promise<ProfessionalQualificationResult> {
      return {
        status: 'UNAVAILABLE',
        reason: 'APPROVED PROFESSIONAL REVIEWER — UNASSIGNED',
      };
    },
  };

function conflict(code: string): never {
  throw Object.assign(new Error(code), { code, statusCode: 409 });
}

function unavailable(dependency: string): never {
  throw Object.assign(new Error(dependency), {
    code: 'DEPENDENCY_UNAVAILABLE',
    dependency,
    statusCode: 503,
  });
}

function invalidAuthority(reason: string): never {
  throw Object.assign(new Error(reason), {
    code: 'PROFESSIONAL_AUTHORITY_INVALID',
    reason,
    statusCode: 403,
  });
}

function assertVersionContract(version: ProfessionalKnowledgeVersionSnapshot): void {
  const issues = validateProfessionalKnowledgeVersionContract(version);
  if (issues.length > 0) {
    throw Object.assign(new Error('PROFESSIONAL_KNOWLEDGE_CONTRACT_INVALID'), {
      code: 'PROFESSIONAL_KNOWLEDGE_CONTRACT_INVALID',
      issues,
      statusCode: 422,
    });
  }
}

function commandResult<T>(outcome: CommandOutcome): T {
  if (outcome.action === 'MISMATCH') conflict('IDEMPOTENCY_PAYLOAD_MISMATCH');
  return outcome.body as T;
}

export interface CandidatePayload {
  knowledgeKey: string;
  semanticVersion: string;
  content: Readonly<Record<string, unknown>>;
  contentHash: string;
  sourceSetHash: string;
  sources: readonly ProfessionalKnowledgeSourceSnapshot[];
  scope: ProfessionalKnowledgeScopeMetadata;
}

export async function createKnowledgeCandidate(input: {
  pool: pg.Pool;
  accountId: string;
  personId: string;
  assignmentId: string;
  idempotencyKey: string;
  candidate: CandidatePayload;
}): Promise<{ knowledgeId: string; versionId: string; revision: number }> {
  return withProfessionalKnowledgeAdminTransaction(
    input.pool,
    { accountId: input.accountId, assignmentId: input.assignmentId },
    async (tx) => {
      const requestHash = hashPayload({
        command: 'PROFESSIONAL_KNOWLEDGE_CANDIDATE_CREATE',
        candidate: input.candidate,
      });
      const outcome = await runIdempotentCommandInTransaction(
        tx,
        {
          accountId: input.accountId,
          personId: input.personId,
          purpose: 'PROFESSIONAL_KNOWLEDGE_ADMIN',
          commandType: 'PROFESSIONAL_KNOWLEDGE_CANDIDATE_CREATE',
          idempotencyKey: input.idempotencyKey,
          requestHash,
        },
        async () => {
          const created = await createProfessionalKnowledgeCandidate(tx, {
            ...input.candidate,
            accountId: input.accountId,
            personId: input.personId,
          });
          const version = await lockProfessionalKnowledgeVersion(tx, created.versionId);
          if (!version) throw new Error('PROFESSIONAL_KNOWLEDGE_CREATE_READBACK_FAILED');
          assertVersionContract(version);
          await appendProfessionalKnowledgeAudit(tx, {
            actorAccountId: input.accountId,
            eventType: 'PROFESSIONAL_KNOWLEDGE_CANDIDATE_CREATED',
            versionId: created.versionId,
            metadata: {
              knowledgeId: created.knowledgeId,
              semanticVersion: input.candidate.semanticVersion,
              contentHash: input.candidate.contentHash,
              sourceSetHash: input.candidate.sourceSetHash,
              revision: created.revision,
            },
          });
          return { status: 201, body: created };
        }
      );
      return commandResult(outcome);
    }
  );
}

export async function editKnowledgeCandidate(input: {
  pool: pg.Pool;
  accountId: string;
  personId: string;
  assignmentId: string;
  idempotencyKey: string;
  versionId: string;
  expectedRevision: number;
  content: Readonly<Record<string, unknown>>;
  contentHash: string;
  sourceSetHash: string;
  sources: readonly ProfessionalKnowledgeSourceSnapshot[];
  scope: ProfessionalKnowledgeScopeMetadata;
}): Promise<{ versionId: string; revision: number }> {
  return withProfessionalKnowledgeAdminTransaction(
    input.pool,
    { accountId: input.accountId, assignmentId: input.assignmentId },
    async (tx) => {
      const requestHash = hashPayload({
        command: 'PROFESSIONAL_KNOWLEDGE_CANDIDATE_EDIT',
        versionId: input.versionId,
        expectedRevision: input.expectedRevision,
        contentHash: input.contentHash,
        sourceSetHash: input.sourceSetHash,
        sources: input.sources,
        scope: input.scope,
      });
      const outcome = await runIdempotentCommandInTransaction(
        tx,
        {
          accountId: input.accountId,
          personId: input.personId,
          purpose: 'PROFESSIONAL_KNOWLEDGE_ADMIN',
          commandType: 'PROFESSIONAL_KNOWLEDGE_CANDIDATE_EDIT',
          idempotencyKey: input.idempotencyKey,
          requestHash,
        },
        async () => {
          const revision = await editProfessionalKnowledgeCandidate(tx, {
            versionId: input.versionId,
            expectedRevision: input.expectedRevision,
            content: input.content,
            contentHash: input.contentHash,
            sourceSetHash: input.sourceSetHash,
            sources: input.sources,
            scope: input.scope,
          });
          const version = await lockProfessionalKnowledgeVersion(tx, input.versionId);
          if (!version) throw new Error('PROFESSIONAL_KNOWLEDGE_EDIT_READBACK_FAILED');
          assertVersionContract(version);
          await appendProfessionalKnowledgeAudit(tx, {
            actorAccountId: input.accountId,
            eventType: 'PROFESSIONAL_KNOWLEDGE_CANDIDATE_EDITED',
            versionId: input.versionId,
            metadata: {
              semanticVersion: version.semanticVersion,
              contentHash: version.contentHash,
              sourceSetHash: version.sourceSetHash,
              revision,
            },
          });
          return { status: 200, body: { versionId: input.versionId, revision } };
        }
      );
      return commandResult(outcome);
    }
  );
}

async function requireQualification(input: {
  provider: ProfessionalQualificationProvider;
  qualificationRef: string;
  reviewerIdentity: string;
  reviewerAccountId: string;
  reviewerPersonId: string;
  scope: Parameters<ProfessionalQualificationProvider['resolve']>[0]['scope'];
}): Promise<Extract<ProfessionalQualificationResult, { status: 'RESOLVED' }>> {
  const result = await input.provider.resolve({
    qualificationRef: input.qualificationRef,
    reviewerIdentity: input.reviewerIdentity,
    reviewerAccountId: input.reviewerAccountId,
    reviewerPersonId: input.reviewerPersonId,
    scope: input.scope,
  });
  if (result.status === 'UNAVAILABLE') unavailable('PROFESSIONAL_QUALIFICATION');
  if (result.status === 'INVALID') invalidAuthority('PROFESSIONAL_QUALIFICATION_INVALID');
  return result;
}

export async function recordKnowledgeReview(input: {
  pool: pg.Pool;
  accountId: string;
  personId: string;
  assignmentId: string;
  idempotencyKey: string;
  versionId: string;
  expectedRevision: number;
  reviewerIdentity: string;
  qualificationRef: string;
  qualificationProvider?: ProfessionalQualificationProvider;
  outcome: 'REVIEWED' | 'NEEDS_REVIEW' | 'NO_MATERIAL_IMPACT';
  reasonCode?: string | null;
  reviewedAt?: Date;
}): Promise<{ versionId: string; revision: number; reviewState: string; validityState: string }> {
  const qualificationProvider =
    input.qualificationProvider ?? unavailableProductionProfessionalQualificationProvider;

  return withProfessionalKnowledgeAdminTransaction(
    input.pool,
    { accountId: input.accountId, assignmentId: input.assignmentId },
    async (tx) => {
      const version = await lockProfessionalKnowledgeVersion(tx, input.versionId);
      if (!version || version.revision !== input.expectedRevision) {
        conflict('PROFESSIONAL_KNOWLEDGE_STALE_REVISION');
      }

      const staff = await resolveProfessionalReviewStaffAuthority(tx, {
        assignmentRef: input.assignmentId,
        accountId: input.accountId,
        personId: input.personId,
      });
      if (staff.status !== 'RESOLVED') invalidAuthority('STAFF_AUTHORITY_INVALID');

      const scope = {
        product: version.scope.product,
        sceneCode: version.scope.sceneCode,
        scenePackageVersion: version.scope.scenePackageVersion,
        stages: version.scope.stages,
        ageBands: version.scope.ageBands,
        locale: version.scope.locale,
      } as const;
      await requireQualification({
        provider: qualificationProvider,
        qualificationRef: input.qualificationRef,
        reviewerIdentity: input.reviewerIdentity,
        reviewerAccountId: input.accountId,
        reviewerPersonId: input.personId,
        scope,
      });

      const next =
        input.outcome === 'NEEDS_REVIEW'
          ? { reviewState: 'NEEDS_REVIEW' as const, validityState: 'UNKNOWN' as const }
          : { reviewState: 'CURRENT' as const, validityState: 'VALID' as const };

      const requestHash = hashPayload({
        command: 'PROFESSIONAL_KNOWLEDGE_REVIEW_RECORD',
        versionId: version.id,
        expectedRevision: version.revision,
        contentHash: version.contentHash,
        sourceSetHash: version.sourceSetHash,
        qualificationRef: input.qualificationRef,
        outcome: input.outcome,
        reasonCode: input.reasonCode ?? null,
      });

      const outcome = await runIdempotentCommandInTransaction(
        tx,
        {
          accountId: input.accountId,
          personId: input.personId,
          purpose: 'PROFESSIONAL_KNOWLEDGE_ADMIN',
          commandType: 'PROFESSIONAL_KNOWLEDGE_REVIEW_RECORD',
          idempotencyKey: input.idempotencyKey,
          requestHash,
        },
        async () => {
          const revision = await appendProfessionalKnowledgeReviewEvidence(tx, {
            version,
            reviewerIdentity: input.reviewerIdentity,
            reviewerAccountId: input.accountId,
            reviewerPersonId: input.personId,
            staffAssignmentRef: input.assignmentId,
            qualificationRef: input.qualificationRef,
            reviewOutcome: input.outcome,
            reviewReasonCode: input.reasonCode ?? null,
            reviewedAt: input.reviewedAt ?? new Date(),
            nextReviewState: next.reviewState,
            nextValidityState: next.validityState,
          });
          await appendProfessionalKnowledgeAudit(tx, {
            actorAccountId: input.accountId,
            eventType: 'PROFESSIONAL_KNOWLEDGE_REVIEW_RECORDED',
            versionId: version.id,
            metadata: {
              revision,
              contentHash: version.contentHash,
              sourceSetHash: version.sourceSetHash,
              reviewState: next.reviewState,
              validityState: next.validityState,
              reasonCode: input.reasonCode ?? null,
            },
          });
          return {
            status: 200,
            body: {
              versionId: version.id,
              revision,
              reviewState: next.reviewState,
              validityState: next.validityState,
            },
          };
        }
      );
      return commandResult(outcome);
    }
  );
}

export async function resolveAndValidateKnowledgeApproval(input: {
  tx: pg.PoolClient;
  version: ProfessionalKnowledgeVersionSnapshot;
  provider: ProfessionalApprovalProvider;
  qualificationProvider: ProfessionalQualificationProvider;
  mode: 'RESOLVE' | 'REVALIDATE';
  proofId?: string;
  now?: Date;
}): Promise<ProfessionalApprovalValidation> {
  let providerResult: ProfessionalApprovalProviderResult;
  if (input.mode === 'RESOLVE') {
    providerResult = await input.provider.resolve({
      knowledgeId: input.version.knowledgeId,
      semanticVersion: input.version.semanticVersion,
      contentHash: input.version.contentHash,
      sourceSetHash: input.version.sourceSetHash,
    });
  } else {
    if (!input.proofId) {
      return { status: 'INVALID', reason: 'APPROVAL_PROOF_ID_REQUIRED' };
    }
    providerResult = await input.provider.revalidate({
      proofId: input.proofId,
      knowledgeId: input.version.knowledgeId,
      semanticVersion: input.version.semanticVersion,
      contentHash: input.version.contentHash,
      sourceSetHash: input.version.sourceSetHash,
    });
  }

  if (providerResult.status !== 'RESOLVED') {
    return validateProfessionalApproval({
      version: input.version,
      provider: providerResult,
      staffAuthority: { status: 'UNAVAILABLE', reason: 'NOT_RESOLVED' },
      qualification: { status: 'UNAVAILABLE', reason: 'NOT_RESOLVED' },
      ...(input.now === undefined ? {} : { now: input.now }),
    });
  }

  const proof = providerResult.proof;
  const staff = await resolveProfessionalReviewStaffAuthority(input.tx, {
    assignmentRef: proof.staffAssignmentRef,
    accountId: proof.reviewerAccountId,
    personId: proof.reviewerPersonId,
  });
  const qualification = await input.qualificationProvider.resolve({
    qualificationRef: proof.qualificationRef,
    reviewerIdentity: proof.reviewerIdentity,
    reviewerAccountId: proof.reviewerAccountId,
    reviewerPersonId: proof.reviewerPersonId,
    scope: proof.qualificationScope,
  });

  return validateProfessionalApproval({
    version: input.version,
    provider: providerResult,
    staffAuthority: staff,
    qualification,
    now: input.now,
  });
}

/**
 * Used by release only after final external revalidation. The snapshot is
 * evidence of the consumed proof, never a local Approval Authority.
 */
export async function persistValidatedApprovalEvidence(
  tx: pg.PoolClient,
  versionId: string,
  validation: ProfessionalApprovalValidation,
  sceneBindingRef: {
    readonly sceneCode: string;
    readonly scenePackageVersion: string;
    readonly knowledgeId: string;
    readonly semanticVersion: string;
    readonly contentHash: string;
    readonly sourceSetHash: string;
  }
): Promise<void> {
  if (validation.status !== 'VALID') {
    throw new Error('PROFESSIONAL_APPROVAL_MUST_BE_VALID');
  }
  await appendConsumedProfessionalApprovalEvidence(
    tx, versionId, validation.proof, sceneBindingRef
  );
}

export async function createKnowledgeSuccessorInTransaction(
  tx: pg.PoolClient,
  input: Parameters<typeof createProfessionalKnowledgeSuccessor>[1]
) {
  return createProfessionalKnowledgeSuccessor(tx, input);
}

export async function reassertProfessionalKnowledgeAdminContext(
  tx: pg.PoolClient,
  assignmentId: string
): Promise<void> {
  await setProfessionalKnowledgeAdminContext(tx, assignmentId);
}


export type KnowledgeSceneBindingResolver = (
  scenePackageVersion: string
) => ReturnType<typeof resolveDigitalUseProfessionalKnowledgeBinding>;

export type KnowledgeInterventionResolver = (
  ref: NonNullable<ProfessionalKnowledgeScopeMetadata['interventionDefinitionRef']>
) => Promise<
  | { readonly status: 'RESOLVED'; readonly ref: NonNullable<ProfessionalKnowledgeScopeMetadata['interventionDefinitionRef']> }
  | { readonly status: 'INVALID'; readonly reason: string }
  | { readonly status: 'UNAVAILABLE'; readonly reason: string }
>;

export const unavailableProductionInterventionDefinitionResolver:
  KnowledgeInterventionResolver = async () => ({
    status: 'UNAVAILABLE',
    reason: 'SLICE_16_AUTHORITATIVE_OWNER_NOT_MERGED',
  });

function exactSceneBindingForVersion(
  version: ProfessionalKnowledgeVersionSnapshot,
  resolver: KnowledgeSceneBindingResolver
) {
  const binding = resolver(version.scope.scenePackageVersion);
  if (binding.status !== 'RESOLVED') return binding;
  const exact = binding.refs.some(
    (ref) =>
      ref.knowledgeId === version.knowledgeId &&
      ref.semanticVersion === version.semanticVersion &&
      ref.contentHash === version.contentHash &&
      ref.sourceSetHash === version.sourceSetHash
  );
  return exact ? binding : { status: 'INVALID' as const, reason: 'KNOWLEDGE_NOT_BOUND' };
}

export async function releaseKnowledgeVersion(input: {
  pool: pg.Pool;
  accountId: string;
  personId: string;
  assignmentId: string;
  idempotencyKey: string;
  versionId: string;
  expectedRevision: number;
  approvalProofId: string;
  approvalProvider?: ProfessionalApprovalProvider;
  qualificationProvider?: ProfessionalQualificationProvider;
  sceneBindingResolver?: KnowledgeSceneBindingResolver;
  interventionResolver?: KnowledgeInterventionResolver;
  effectiveFrom?: Date;
  now?: Date;
}): Promise<{ versionId: string; revision: number; lifecycleStatus: 'PUBLISHED' }> {
  const approvalProvider =
    input.approvalProvider ?? unavailableProductionProfessionalApprovalProvider;
  const qualificationProvider =
    input.qualificationProvider ?? unavailableProductionProfessionalQualificationProvider;
  const sceneBindingResolver =
    input.sceneBindingResolver ?? resolveDigitalUseProfessionalKnowledgeBinding;
  const interventionResolver =
    input.interventionResolver ?? unavailableProductionInterventionDefinitionResolver;

  return withProfessionalKnowledgeAdminTransaction(
    input.pool,
    { accountId: input.accountId, assignmentId: input.assignmentId },
    async (tx) => {
      const requestHash = hashPayload({
        command: 'PROFESSIONAL_KNOWLEDGE_RELEASE',
        versionId: input.versionId,
        expectedRevision: input.expectedRevision,
        approvalProofId: input.approvalProofId,
      });
      const outcome = await runIdempotentCommandInTransaction(
        tx,
        {
          accountId: input.accountId,
          personId: input.personId,
          purpose: 'PROFESSIONAL_KNOWLEDGE_ADMIN',
          commandType: 'PROFESSIONAL_KNOWLEDGE_RELEASE',
          idempotencyKey: input.idempotencyKey,
          requestHash,
        },
        async () => {
          const version = await lockProfessionalKnowledgeVersion(tx, input.versionId);
          if (!version || version.revision !== input.expectedRevision) {
            conflict('PROFESSIONAL_KNOWLEDGE_STALE_REVISION');
          }
          assertVersionContract(version);
          if (
            version.lifecycleStatus !== 'CANDIDATE' ||
            version.reviewState !== 'CURRENT' ||
            version.validityState !== 'VALID'
          ) {
            conflict('PROFESSIONAL_KNOWLEDGE_RELEASE_STATE_INVALID');
          }

          const sceneBinding = exactSceneBindingForVersion(version, sceneBindingResolver);
          if (sceneBinding.status !== 'RESOLVED') {
            invalidAuthority('SCENE_PACKAGE_BINDING_INVALID');
          }

          if (version.scope.interventionDefinitionRef) {
            const intervention = await interventionResolver(
              version.scope.interventionDefinitionRef
            );
            if (intervention.status === 'UNAVAILABLE') {
              unavailable('INTERVENTION_DEFINITION');
            }
            if (
              intervention.status !== 'RESOLVED' ||
              intervention.ref.definitionId !==
                version.scope.interventionDefinitionRef.definitionId ||
              intervention.ref.definitionVersion !==
                version.scope.interventionDefinitionRef.definitionVersion ||
              intervention.ref.contentHash !==
                version.scope.interventionDefinitionRef.contentHash
            ) {
              invalidAuthority('INTERVENTION_DEFINITION_INVALID');
            }
          }

          const approval = await resolveAndValidateKnowledgeApproval({
            tx,
            version,
            provider: approvalProvider,
            qualificationProvider,
            mode: 'REVALIDATE',
            proofId: input.approvalProofId,
            now: input.now,
          });
          if (approval.status === 'UNAVAILABLE') unavailable(approval.dependency);
          if (approval.status !== 'VALID') invalidAuthority(approval.reason);

          const revision = await releaseProfessionalKnowledgeVersion(tx, {
            versionId: version.id,
            expectedRevision: version.revision,
            effectiveFrom: input.effectiveFrom ?? input.now ?? new Date(),
          });

          const sceneBindingRef = {
            sceneCode: sceneBinding.sceneCode,
            scenePackageVersion: sceneBinding.scenePackageVersion,
            knowledgeId: version.knowledgeId,
            semanticVersion: version.semanticVersion,
            contentHash: version.contentHash,
            sourceSetHash: version.sourceSetHash,
          };
          await persistValidatedApprovalEvidence(
            tx,
            version.id,
            approval,
            sceneBindingRef
          );

          const predecessorId = await getProfessionalKnowledgePredecessorId(
            tx,
            version.id
          );
          if (predecessorId) {
            await markProfessionalKnowledgeVersionSuperseded(tx, {
              versionId: predecessorId,
            });
            await appendProfessionalKnowledgeAudit(tx, {
              actorAccountId: input.accountId,
              eventType: 'PROFESSIONAL_KNOWLEDGE_SUPERSEDED',
              versionId: predecessorId,
              metadata: { successorVersionId: version.id },
            });
          }

          await appendProfessionalKnowledgeAudit(tx, {
            actorAccountId: input.accountId,
            eventType: 'PROFESSIONAL_KNOWLEDGE_RELEASED',
            versionId: version.id,
            metadata: {
              knowledgeId: version.knowledgeId,
              semanticVersion: version.semanticVersion,
              contentHash: version.contentHash,
              sourceSetHash: version.sourceSetHash,
              approvalProofRef: approval.proof.proofId,
              sceneBindingRef,
              revision,
            },
          });

          return {
            status: 200,
            body: {
              versionId: version.id,
              revision,
              lifecycleStatus: 'PUBLISHED' as const,
            },
          };
        }
      );
      return commandResult(outcome);
    }
  );
}

export async function retireKnowledgeVersion(input: {
  pool: pg.Pool;
  accountId: string;
  personId: string;
  assignmentId: string;
  idempotencyKey: string;
  versionId: string;
  expectedRevision: number;
}): Promise<{ versionId: string; revision: number; lifecycleStatus: 'RETIRED' }> {
  return withProfessionalKnowledgeAdminTransaction(
    input.pool,
    { accountId: input.accountId, assignmentId: input.assignmentId },
    async (tx) => {
      const requestHash = hashPayload({
        command: 'PROFESSIONAL_KNOWLEDGE_RETIRE',
        versionId: input.versionId,
        expectedRevision: input.expectedRevision,
      });
      const outcome = await runIdempotentCommandInTransaction(
        tx,
        {
          accountId: input.accountId,
          personId: input.personId,
          purpose: 'PROFESSIONAL_KNOWLEDGE_ADMIN',
          commandType: 'PROFESSIONAL_KNOWLEDGE_RETIRE',
          idempotencyKey: input.idempotencyKey,
          requestHash,
        },
        async () => {
          const revision = await retireProfessionalKnowledgeVersion(tx, {
            versionId: input.versionId,
            expectedRevision: input.expectedRevision,
          });
          await appendProfessionalKnowledgeAudit(tx, {
            actorAccountId: input.accountId,
            eventType: 'PROFESSIONAL_KNOWLEDGE_RETIRED',
            versionId: input.versionId,
            metadata: { revision },
          });
          return {
            status: 200,
            body: {
              versionId: input.versionId,
              revision,
              lifecycleStatus: 'RETIRED' as const,
            },
          };
        }
      );
      return commandResult(outcome);
    }
  );
}

export async function propagateKnowledgeDependencyImpact(input: {
  pool: pg.Pool;
  accountId: string;
  personId: string;
  assignmentId: string;
  idempotencyKey: string;
  versionId: string;
  expectedRevision: number;
  impact: Parameters<typeof projectProfessionalKnowledgeDependencyImpact>[0]['impact'];
  exactDependent: boolean;
  materialImpact?: boolean;
}): Promise<{ versionId: string; revision: number; changed: boolean }> {
  return withProfessionalKnowledgeAdminTransaction(
    input.pool,
    { accountId: input.accountId, assignmentId: input.assignmentId },
    async (tx) => {
      const version = await lockProfessionalKnowledgeVersion(tx, input.versionId);
      if (!version || version.revision !== input.expectedRevision) {
        conflict('PROFESSIONAL_KNOWLEDGE_STALE_REVISION');
      }
      const projected = projectProfessionalKnowledgeDependencyImpact({
        current: {
          reviewState: version.reviewState,
          validityState: version.validityState,
        },
        impact: input.impact,
        exactDependent: input.exactDependent,
        materialImpact: input.materialImpact,
      });
      const stateChanged =
        projected.reviewState !== version.reviewState ||
        projected.validityState !== version.validityState;

      const requestHash = hashPayload({
        command: 'PROFESSIONAL_KNOWLEDGE_DEPENDENCY_PROPAGATE',
        versionId: version.id,
        expectedRevision: version.revision,
        impact: input.impact,
        exactDependent: input.exactDependent,
        materialImpact: input.materialImpact ?? null,
      });
      const outcome = await runIdempotentCommandInTransaction(
        tx,
        {
          accountId: input.accountId,
          personId: input.personId,
          purpose: 'PROFESSIONAL_KNOWLEDGE_ADMIN',
          commandType: 'PROFESSIONAL_KNOWLEDGE_DEPENDENCY_PROPAGATE',
          idempotencyKey: input.idempotencyKey,
          requestHash,
        },
        async () => {
          if (!stateChanged) {
            return {
              status: 200,
              body: { versionId: version.id, revision: version.revision, changed: false },
            };
          }
          const revision = await applyProfessionalKnowledgeDependencyState(tx, {
            versionId: version.id,
            expectedRevision: version.revision,
            reviewState: projected.reviewState,
            validityState: projected.validityState,
          });
          await appendProfessionalKnowledgeAudit(tx, {
            actorAccountId: input.accountId,
            eventType: 'PROFESSIONAL_KNOWLEDGE_VALIDITY_CHANGED',
            versionId: version.id,
            metadata: {
              impact: input.impact,
              reviewState: projected.reviewState,
              validityState: projected.validityState,
              revision,
            },
          });
          return {
            status: 200,
            body: { versionId: version.id, revision, changed: true },
          };
        }
      );
      return commandResult(outcome);
    }
  );
}
