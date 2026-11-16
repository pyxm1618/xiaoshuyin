/**
 * Slice 12 — canonical Digital Use node-response orchestration.
 *
 * One transaction shell owns authorization, idempotency, concurrency gates,
 * Safety/Compliance, node semantics, Slice 11 routing, Scene CAS/projection,
 * event/audit and (from T1216) the authoritative Problem Formulation handoff.
 */
import type pg from 'pg';
import {
  assertOrdinaryProgressionAllowedRaw,
  casCompleteSceneNodeState,
  casInvalidateSceneNodeForRouteSupersession,
  casRecordSceneNodeProgress,
  casRecompleteSceneNodeState,
  casReevaluateSceneNodeState,
  casReopenSceneNodeForRouteConvergence,
  ensureSceneNodeAvailable,
  getCaseById,
  getLatestDigitalUseNodeCompletionRoute,
  getSceneNodeState,
  listSceneNodeStates,
  getScenePackageBinding,
  hashPayload,
  insertDigitalUseNodeCompletedAudit,
  insertDigitalUseNodeCompletedEvent,
  lockFamilyForPrimaryDecision,
  lockSceneCase,
  validateSceneRefs,
  type SceneCaseRow,
  type SceneNodeStateRow,
  type StoredSceneRef,
} from '@xiaoshuyin/domain';
import {
  DIGITAL_USE_PACKAGE_VERSION,
  DIGITAL_USE_SCENE_CODE,
  resolveDigitalUseRuntimeNode,
  routeDigitalUseTopology,
  type DigitalUseNodeManifestEntry,
  type DigitalUseRoutingResult,
} from '@xiaoshuyin/scenes/digital-use';
import type {
  CompleteDigitalUseNodeRequestType,
  DigitalUseSceneResponseType,
} from '@xiaoshuyin/contracts';
import { withRlsTransaction } from '../db/tx.js';
import { assertCurrentAccountAuthority } from '../auth/account-authority.js';
import { isKnownAuthorizationDenial, requireFamilyAction } from '../authz.js';
import {
  runIdempotentCommandInTransaction,
  runPreparedIdempotentCommandInTransaction,
} from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import {
  assertAssessmentCompliance,
  currentSceneEnvelope,
  resolveRequestedDigitalUseNode,
  type DigitalUseActor,
} from './digital-use-assessment.js';
import {
  applyDigitalUseNodeSemantics,
  shouldPrepareProblemFormulationHandoff,
} from './digital-use-node-semantics.js';
import { presentDigitalUseProblemFormulationInTransaction } from './digital-use-problem-formulation.js';
import { executeFamilyAllianceNodeInTransaction } from './digital-use-family-alliance.js';
import {
  assertCurrentDigitalUseProblemFormulation,
  assertDigitalUseCaseLifecycle,
} from './digital-use-case-lifecycle.js';
import {
  executeA5001ReviewInTransaction,
  prepareA5001ReviewFingerprintInTransaction,
} from './digital-use-family-alliance-review.js';
import {
  executeA5002ReviewInTransaction,
  prepareA5002ReviewFingerprintInTransaction,
} from './digital-use-phone-contract-review.js';
import {
  unavailableProductionProfessionalReviewContentProvider,
  type ProfessionalReviewContentProvider,
} from './digital-use-review-professional-content.js';

function nodeError(code: string, message?: string): Error & { statusCode: number; code: string } {
  const mapped = toHttpError(code, message);
  return Object.assign(new Error(mapped.message), {
    statusCode: mapped.statusCode,
    code: mapped.code,
  });
}

function rethrowKnownBusinessError(error: unknown): never {
  const code =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown }).code
      : undefined;
  if (typeof code === 'string') {
    const mapped = toHttpError(code);
    if (mapped.statusCode < 500) throw nodeError(code);
  }
  throw error;
}

export interface CompleteDigitalUseNodeInput extends CompleteDigitalUseNodeRequestType {
  readonly actor: DigitalUseActor;
  readonly familyId: string;
  readonly caseId: string;
  readonly nodeCode: string;
  readonly idempotencyKey: string;
  readonly requestEvidence?: {
    readonly clientIp: string | null;
    readonly userAgent: string | null;
    readonly pepper: string;
  };
}

export function assertNodeCasePreconditions(
  caseRow: Pick<SceneCaseRow, 'status' | 'phase' | 'is_primary' | 'version'>,
  node: Pick<DigitalUseNodeManifestEntry, 'nodeCode' | 'stream'>,
  expectedCaseVersion: number
): void {
  try {
    assertDigitalUseCaseLifecycle(caseRow, node, expectedCaseVersion);
  } catch (error) {
    rethrowKnownBusinessError(error);
  }
}

function isRecoverableTriageNode(nodeCode: string): boolean {
  return nodeCode === '01002' || nodeCode === '01003';
}

function isRecoverableTriageProjection(
  nodeCode: string,
  status: SceneNodeStateRow['status']
): boolean {
  return isRecoverableTriageNode(nodeCode)
    && (status === 'BLOCKED' || status === 'COMPLETED');
}

function manifestDescendants(nodeCode: string): ReadonlySet<string> {
  const visited = new Set<string>();
  const pending = [nodeCode];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const node = resolveDigitalUseRuntimeNode(current);
    for (const edge of node.allowedNext) {
      if (edge.kind === 'NODE' && !visited.has(edge.targetNodeCode)) {
        pending.push(edge.targetNodeCode);
      }
    }
    for (const parallelNodeCode of node.canRunInParallelWith as readonly string[]) {
      if (!visited.has(parallelNodeCode)) pending.push(parallelNodeCode);
    }
  }
  return visited;
}

async function convergeSupersededTriageRoute(
  tx: pg.PoolClient,
  input: {
    caseId: string;
    sourceNodeCode: string;
    newNextNodeCode: string | null;
    branchReasonCode: string;
    nextInputRefs: readonly StoredSceneRef[];
  }
): Promise<void> {
  const prior = await getLatestDigitalUseNodeCompletionRoute(
    tx,
    input.caseId,
    input.sourceNodeCode
  );
  const oldNext = prior?.nextNodeCode ?? null;
  if (oldNext !== null && oldNext !== input.newNextNodeCode) {
    const descendants = manifestDescendants(oldNext);
    const states = await listSceneNodeStates(tx, input.caseId);
    for (const state of states) {
      if (!descendants.has(state.node_code)) continue;
      if (state.node_code === input.newNextNodeCode) continue;
      if (state.status === 'SKIPPED') continue;
      const invalidated = await casInvalidateSceneNodeForRouteSupersession(tx, {
        caseId: input.caseId,
        nodeCode: state.node_code,
        scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
        expectedRevision: state.revision,
      });
      if (!invalidated) throw nodeError('STALE_NODE_REVISION');
    }
  }

  if (input.newNextNodeCode === null) return;
  const next = resolveDigitalUseRuntimeNode(input.newNextNodeCode);
  const existing = await getSceneNodeState(tx, input.caseId, next.nodeCode, true);
  if (existing && (existing.status === 'SKIPPED' || existing.status === 'BLOCKED')) {
    const reopened = await casReopenSceneNodeForRouteConvergence(tx, {
      caseId: input.caseId,
      nodeCode: next.nodeCode,
      scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
      expectedRevision: existing.revision,
      branchReasonCodes: [input.branchReasonCode],
      inputRefs: input.nextInputRefs,
    });
    if (!reopened) throw nodeError('STALE_NODE_REVISION');
  }
}

export type ResolvedRoute =
  | { readonly kind: 'NODE'; readonly reasonCode: string; readonly nextNodeCode: string }
  | { readonly kind: 'TERMINAL'; readonly reasonCode: string; readonly terminalCode: string };

export function requireResolvedRoute(result: DigitalUseRoutingResult): ResolvedRoute {
  if (result.kind === 'NODE_ROUTE') {
    return {
      kind: 'NODE',
      reasonCode: result.reasonCode,
      nextNodeCode: result.nextNodeCode,
    };
  }
  if (result.kind === 'TERMINAL_ROUTE') {
    return {
      kind: 'TERMINAL',
      reasonCode: result.reasonCode,
      terminalCode: result.terminalCode,
    };
  }
  if (result.kind === 'UNKNOWN') {
    throw nodeError('SCENE_ROUTE_UNRESOLVED', result.code);
  }
  throw nodeError('SCENE_ROUTE_BLOCKED', result.code);
}

function nextInputRefs(
  semantic: Awaited<ReturnType<typeof applyDigitalUseNodeSemantics>>
): readonly StoredSceneRef[] {
  return semantic.nextInputRefs ?? semantic.outputRefs;
}


async function readUnlockedHandoffPreconditions(
  tx: pg.PoolClient,
  input: CompleteDigitalUseNodeInput,
  node: DigitalUseNodeManifestEntry
): Promise<SceneNodeStateRow> {
  const caseRow = await getCaseById(tx, input.caseId);
  if (!caseRow) throw nodeError('CASE_NOT_FOUND', 'Case not found');
  assertNodeCasePreconditions(caseRow, node, input.expectedCaseVersion);
  await assertOrdinaryProgressionAllowedRaw(tx, { caseId: input.caseId });
  await assertAssessmentCompliance(tx, input.actor.personId);

  const binding = await getScenePackageBinding(tx, input.caseId);
  if (binding === null) throw nodeError('SCENE_NODE_UNREACHABLE');
  if (binding !== DIGITAL_USE_PACKAGE_VERSION) throw nodeError('STALE_SCENE_PACKAGE');

  const current = await getSceneNodeState(tx, input.caseId, node.nodeCode);
  if (!current) throw nodeError('SCENE_NODE_UNREACHABLE');
  if (current.scene_package_version !== DIGITAL_USE_PACKAGE_VERSION) {
    throw nodeError('STALE_SCENE_PACKAGE');
  }
  if (current.revision !== input.expectedNodeRevision) {
    throw nodeError('STALE_NODE_REVISION');
  }
  if (
    current.status !== 'AVAILABLE' &&
    current.status !== 'IN_PROGRESS' &&
    !isRecoverableTriageProjection(node.nodeCode, current.status)
  ) {
    throw nodeError('SCENE_NODE_UNREACHABLE');
  }
  return current;
}

async function applySemanticForCurrentNode(
  tx: pg.PoolClient,
  input: CompleteDigitalUseNodeInput,
  node: DigitalUseNodeManifestEntry,
  current: SceneNodeStateRow
) {
  try {
    return await applyDigitalUseNodeSemantics({
      tx,
      actor: input.actor,
      familyId: input.familyId,
      caseId: input.caseId,
      nodeCode: node.nodeCode,
      response: input.response,
      currentInputRefs: current.input_refs,
      ...(input.requestEvidence === undefined
        ? {}
        : { requestEvidence: input.requestEvidence }),
    });
  } catch (error) {
    rethrowKnownBusinessError(error);
  }
}

async function assertSemanticRefs(
  tx: pg.PoolClient,
  input: CompleteDigitalUseNodeInput,
  semantic: Awaited<ReturnType<typeof applyDigitalUseNodeSemantics>>
): Promise<void> {
  if (
    !(await validateSceneRefs(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      refs: [...semantic.inputRefs, ...semantic.outputRefs],
    }))
  ) {
    throw nodeError('SCENE_RESPONSE_INVALID', 'Scene refs are outside the authorized Case');
  }
}

function routeSemantic(
  node: DigitalUseNodeManifestEntry,
  semantic: Awaited<ReturnType<typeof applyDigitalUseNodeSemantics>>
): ResolvedRoute {
  return requireResolvedRoute(
    routeDigitalUseTopology({
      sceneCode: DIGITAL_USE_SCENE_CODE,
      packageVersion: DIGITAL_USE_PACKAGE_VERSION,
      currentNodeCode: node.nodeCode,
      conditions: semantic.conditions,
      ...(semantic.evidenceBasis === undefined
        ? {}
        : { evidenceBasis: semantic.evidenceBasis }),
    })
  );
}

async function recordBlockedHandoffCandidate(
  tx: pg.PoolClient,
  input: CompleteDigitalUseNodeInput,
  node: DigitalUseNodeManifestEntry,
  semantic: Awaited<ReturnType<typeof applyDigitalUseNodeSemantics>>,
  reasonCode: string
): Promise<DigitalUseSceneResponseType> {
  // No Slice 8 owner call occurred. Acquire the canonical Family -> Case ->
  // Scene locks now, then revalidate every mutable precondition before
  // materializing the fail-closed Scene result.
  if (!(await lockFamilyForPrimaryDecision(tx, input.familyId))) {
    throw nodeError('CASE_NOT_FOUND', 'Case not found');
  }
  const caseRow = await lockSceneCase(tx, input.caseId);
  if (!caseRow) throw nodeError('CASE_NOT_FOUND', 'Case not found');
  assertNodeCasePreconditions(caseRow, node, input.expectedCaseVersion);
  await assertOrdinaryProgressionAllowedRaw(tx, { caseId: input.caseId });
  await assertAssessmentCompliance(tx, input.actor.personId);

  const current = await getSceneNodeState(tx, input.caseId, node.nodeCode, true);
  if (
    !current ||
    current.scene_package_version !== DIGITAL_USE_PACKAGE_VERSION ||
    current.revision !== input.expectedNodeRevision ||
    (current.status !== 'AVAILABLE' &&
      current.status !== 'IN_PROGRESS' &&
      !isRecoverableTriageProjection(node.nodeCode, current.status))
  ) {
    throw nodeError('STALE_NODE_REVISION');
  }

  const blocked = isRecoverableTriageProjection(node.nodeCode, current.status)
    ? await casReevaluateSceneNodeState(tx, {
        caseId: input.caseId,
        nodeCode: node.nodeCode,
        scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
        expectedRevision: input.expectedNodeRevision,
        status: 'BLOCKED',
        branchReasonCodes: [reasonCode],
        inputRefs: semantic.inputRefs,
        outputRefs: semantic.outputRefs,
      })
    : await casCompleteSceneNodeState(tx, {
    caseId: input.caseId,
    nodeCode: node.nodeCode,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    expectedRevision: input.expectedNodeRevision,
    status: 'BLOCKED',
    branchReasonCodes: [reasonCode],
    inputRefs: semantic.inputRefs,
    outputRefs: semantic.outputRefs,
  });
  if (!blocked) throw nodeError('STALE_NODE_REVISION');

  await insertDigitalUseNodeCompletedEvent(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    actorAccountId: input.actor.accountId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    nodeCode: node.nodeCode,
    nodeRevision: blocked.revision,
    routeReasonCode: reasonCode,
    inputRefs: semantic.inputRefs,
    outputRefs: semantic.outputRefs,
    nextNodeCode: null,
    terminalCode: null,
  });
  await insertDigitalUseNodeCompletedAudit(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    actorAccountId: input.actor.accountId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    nodeCode: node.nodeCode,
    nodeRevision: blocked.revision,
    routeReasonCode: reasonCode,
    nextNodeCode: null,
    terminalCode: null,
  });
  return currentSceneEnvelope(tx, input.caseId);
}

async function executeProblemFormulationHandoffPath(
  tx: pg.PoolClient,
  input: CompleteDigitalUseNodeInput,
  node: DigitalUseNodeManifestEntry
): Promise<DigitalUseSceneResponseType> {
  // IMPORTANT: no Family/Case row lock has been acquired by Slice 12 yet.
  // This is the only path that may invoke the Slice 8 caller-owned seam.
  const current = await readUnlockedHandoffPreconditions(tx, input, node);
  const semantic = await applySemanticForCurrentNode(tx, input, node, current);
  await assertSemanticRefs(tx, input, semantic);

  if (semantic.progression !== undefined && semantic.progression !== 'ROUTE') {
    // The read-only preview was invalidated by current Evidence before the
    // actual semantics ran. Roll back this attempt instead of choosing a stale
    // handoff outcome.
    throw nodeError('STALE_NODE_REVISION');
  }

  const route = routeSemantic(node, semantic);
  if (route.kind !== 'NODE') {
    throw nodeError('SCENE_ROUTE_UNRESOLVED', 'Handoff preview no longer matches route');
  }
  const routedNext = resolveDigitalUseRuntimeNode(route.nextNodeCode);
  // The actual handoff decision is bound to Slice 11 manifest phase metadata,
  // never numeric adjacency or a hard-coded A2003 target.
  if (routedNext.phase !== 'PROBLEM_FORMULATION') {
    throw nodeError('SCENE_ROUTE_UNRESOLVED', 'Handoff preview no longer matches manifest phase');
  }

  const handoff = await presentDigitalUseProblemFormulationInTransaction(tx, {
    actor: input.actor,
    familyId: input.familyId,
    caseId: input.caseId,
    nodeCode: node.nodeCode,
    expectedCaseVersion: input.expectedCaseVersion,
    outerIdempotencyKey: input.idempotencyKey,
  });

  if (handoff.kind === 'UNAVAILABLE') {
    return recordBlockedHandoffCandidate(
      tx,
      input,
      node,
      semantic,
      handoff.reasonCode
    );
  }

  // Slice 8 has now acquired Family -> Case itself and moved only to
  // PROBLEM_FORMULATION. Re-read the Scene node under its lock; if a concurrent
  // writer changed revision before the owner lock converged, the whole outer
  // transaction (including formulation/event/idempotency) rolls back.
  const postCase = await lockSceneCase(tx, input.caseId);
  if (
    !postCase ||
    postCase.status !== 'OPEN' ||
    !postCase.is_primary ||
    postCase.phase !== 'PROBLEM_FORMULATION' ||
    postCase.version !== handoff.caseVersion
  ) {
    throw nodeError('STALE_CASE_VERSION');
  }

  // Re-run independent mutable gates after the Slice 8 owner has converged its
  // Family/Case lock. A Safety or Compliance change racing the unlocked preview
  // must roll back formulation + Scene + Evidence as one transaction.
  await assertOrdinaryProgressionAllowedRaw(tx, { caseId: input.caseId });
  await assertAssessmentCompliance(tx, input.actor.personId);

  const binding = await getScenePackageBinding(tx, input.caseId);
  if (binding !== DIGITAL_USE_PACKAGE_VERSION) throw nodeError('STALE_SCENE_PACKAGE');
  const lockedNode = await getSceneNodeState(tx, input.caseId, node.nodeCode, true);
  if (
    !lockedNode ||
    lockedNode.revision !== input.expectedNodeRevision ||
    (lockedNode.status !== 'AVAILABLE' &&
      lockedNode.status !== 'IN_PROGRESS' &&
      !isRecoverableTriageProjection(node.nodeCode, lockedNode.status))
  ) {
    throw nodeError('STALE_NODE_REVISION');
  }

  const completed = isRecoverableTriageProjection(node.nodeCode, lockedNode.status)
    ? await casReevaluateSceneNodeState(tx, {
        caseId: input.caseId,
        nodeCode: node.nodeCode,
        scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
        expectedRevision: input.expectedNodeRevision,
        status: 'COMPLETED',
        branchReasonCodes: [route.reasonCode],
        inputRefs: semantic.inputRefs,
        outputRefs: semantic.outputRefs,
      })
    : await casCompleteSceneNodeState(tx, {
    caseId: input.caseId,
    nodeCode: node.nodeCode,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    expectedRevision: input.expectedNodeRevision,
    status: semantic.completionStatus ?? 'COMPLETED',
    branchReasonCodes: [route.reasonCode],
    inputRefs: semantic.inputRefs,
    outputRefs: semantic.outputRefs,
  });
  if (!completed) throw nodeError('STALE_NODE_REVISION');

  if (isRecoverableTriageProjection(node.nodeCode, lockedNode.status)) {
    await convergeSupersededTriageRoute(tx, {
      caseId: input.caseId,
      sourceNodeCode: node.nodeCode,
      newNextNodeCode: routedNext.nodeCode,
      branchReasonCode: route.reasonCode,
      nextInputRefs: nextInputRefs(semantic),
    });
  }

  await ensureSceneNodeAvailable(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    nodeCode: routedNext.nodeCode,
    sourceNodeCode: routedNext.sourceNodeCode,
    branchReasonCodes: [route.reasonCode],
    inputRefs: nextInputRefs(semantic),
  });

  await insertDigitalUseNodeCompletedEvent(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    actorAccountId: input.actor.accountId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    nodeCode: node.nodeCode,
    nodeRevision: completed.revision,
    routeReasonCode: route.reasonCode,
    inputRefs: semantic.inputRefs,
    outputRefs: semantic.outputRefs,
    nextNodeCode: routedNext.nodeCode,
    terminalCode: null,
  });
  await insertDigitalUseNodeCompletedAudit(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    actorAccountId: input.actor.accountId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    nodeCode: node.nodeCode,
    nodeRevision: completed.revision,
    routeReasonCode: route.reasonCode,
    nextNodeCode: routedNext.nodeCode,
    terminalCode: null,
  });

  return currentSceneEnvelope(tx, input.caseId);
}

/**
 * Complete one currently reachable node.
 *
 * Authorization is re-established before idempotency replay. Ordinary nodes
 * keep mutable business gates execution-only. Professional review nodes are a
 * deliberate exception: under the existing idempotency lock they prepare the
 * exact subject/package authority and package-owned normalized response because
 * those facts are part of the frozen canonical request fingerprint.
 */
export async function completeDigitalUseNodeResponse(
  pool: pg.Pool,
  input: CompleteDigitalUseNodeInput,
  options: {
    readonly professionalReviewContent?: ProfessionalReviewContentProvider;
  } = {}
): Promise<DigitalUseSceneResponseType> {
  return withRlsTransaction(
    pool,
    {
      familyId: input.familyId,
      accountId: input.actor.accountId,
      personId: input.actor.personId,
      purpose: 'FAMILY_MANAGEMENT',
    },
    async (tx) => {
      try {
        await requireFamilyAction(tx, {
          accountId: input.actor.accountId,
          personId: input.actor.personId,
          familyId: input.familyId,
          caseId: input.caseId,
          action: 'CASE_RESPOND_ASSESSMENT_SCENE',
          purpose: 'FAMILY_MANAGEMENT',
          resource: { type: 'CASE', familyId: input.familyId, caseId: input.caseId },
        });
      } catch (error) {
        if (!isKnownAuthorizationDenial(error)) throw error;
        throw nodeError('CASE_NOT_FOUND', 'Case not found');
      }

      // Manifest identity is resolved only after authorization, so fabricated
      // node codes do not become a cross-Family existence oracle.
      const node: DigitalUseNodeManifestEntry =
        resolveRequestedDigitalUseNode(input.nodeCode);
      const professionalReviewContent =
        options.professionalReviewContent ??
        unavailableProductionProfessionalReviewContentProvider;
      const idempotencyBase = {
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        purpose: 'FAMILY_MANAGEMENT',
        commandType: 'DIGITAL_USE_NODE_RESPONSE' as const,
        idempotencyKey: input.idempotencyKey,
      };

      if (
        node.stream === 'FAMILY_ALLIANCE_REVIEW' ||
        node.stream === 'PHONE_USE_CONTRACT_REVIEW'
      ) {
        // Request authentication already used the single Account authority owner.
        // Revalidate and lock that same authoritative row inside this review
        // transaction so DISABLED/session drift cannot race REVIEW_COMPLETE.
        await assertCurrentAccountAuthority(tx, input.actor.accountId);
        const reviewReplayDiscriminator = hashPayload({
          actor: {
            accountId: input.actor.accountId,
            personId: input.actor.personId,
          },
          familyId: input.familyId,
          caseId: input.caseId,
          node: node.nodeCode,
          stream: node.stream,
          expectedCaseVersion: input.expectedCaseVersion,
          expectedNodeRevision: input.expectedNodeRevision,
          expectedScenePackageVersion:
            input.expectedScenePackageVersion ?? null,
          expectedSelectionRevision:
            input.expectedSelectionRevision ?? null,
          expectedTargetRevision: input.expectedTargetRevision ?? null,
          response: input.response,
        });
        const {
          packageResponse: _packageResponse,
          ...reviewResponseAuthorityIdentity
        } = input.response;
        const reviewAuthorityDiscriminator = hashPayload({
          actor: {
            accountId: input.actor.accountId,
            personId: input.actor.personId,
          },
          familyId: input.familyId,
          caseId: input.caseId,
          node: node.nodeCode,
          stream: node.stream,
          expectedCaseVersion: input.expectedCaseVersion,
          expectedNodeRevision: input.expectedNodeRevision,
          expectedScenePackageVersion:
            input.expectedScenePackageVersion ?? null,
          expectedSelectionRevision:
            input.expectedSelectionRevision ?? null,
          expectedTargetRevision: input.expectedTargetRevision ?? null,
          response: reviewResponseAuthorityIdentity,
        });
        const reviewOutcome = await runPreparedIdempotentCommandInTransaction(
          tx,
          {
            ...idempotencyBase,
            replayDiscriminator: reviewReplayDiscriminator,
            authorityDiscriminator: reviewAuthorityDiscriminator,
          },
          async () => {
            const fingerprint =
              node.stream === 'FAMILY_ALLIANCE_REVIEW'
                ? await prepareA5001ReviewFingerprintInTransaction(
                    tx,
                    input,
                    node,
                    professionalReviewContent
                  )
                : await prepareA5002ReviewFingerprintInTransaction(
                    tx,
                    input,
                    node,
                    professionalReviewContent
                  );
            return hashPayload(fingerprint);
          },
          async () => ({
            status: 200,
            body:
              node.stream === 'FAMILY_ALLIANCE_REVIEW'
                ? await executeA5001ReviewInTransaction(
                    tx,
                    input,
                    node,
                    professionalReviewContent
                  )
                : await executeA5002ReviewInTransaction(
                    tx,
                    input,
                    node,
                    professionalReviewContent
                  ),
          })
        );
        if (reviewOutcome.action === 'MISMATCH') {
          throw nodeError('IDEMPOTENCY_PAYLOAD_MISMATCH');
        }
        return reviewOutcome.body as DigitalUseSceneResponseType;
      }

      const requestHash = hashPayload({
        familyId: input.familyId,
        caseId: input.caseId,
        nodeCode: node.nodeCode,
        expectedCaseVersion: input.expectedCaseVersion,
        expectedNodeRevision: input.expectedNodeRevision,
        expectedScenePackageVersion: input.expectedScenePackageVersion ?? null,
        expectedSelectionRevision: input.expectedSelectionRevision ?? null,
        expectedTargetRevision: input.expectedTargetRevision ?? null,
        response: input.response,
      });

      const outcome = await runIdempotentCommandInTransaction(
        tx,
        {
          ...idempotencyBase,
          requestHash,
        },
        async () => {
          if (node.stream === 'FAMILY_ALLIANCE') {
            return {
              status: 200,
              body: await executeFamilyAllianceNodeInTransaction(tx, input, node),
            };
          }

          const previewCase = await getCaseById(tx, input.caseId);
          const previewNode = await getSceneNodeState(tx, input.caseId, node.nodeCode);
          const recoveringAfterFormulation =
            previewCase !== null &&
            previewCase.phase !== 'ASSESSMENT' &&
            previewNode !== null &&
            isRecoverableTriageProjection(node.nodeCode, previewNode.status);
          const handoffCandidate =
            !recoveringAfterFormulation &&
            await shouldPrepareProblemFormulationHandoff({
              tx,
              actor: input.actor,
              familyId: input.familyId,
              caseId: input.caseId,
              nodeCode: node.nodeCode,
              response: input.response,
            });
          if (handoffCandidate) {
            return {
              status: 200,
              body: await executeProblemFormulationHandoffPath(tx, input, node),
            };
          }

          // Canonical write lock order: Family -> Case -> Scene node.
          if (!(await lockFamilyForPrimaryDecision(tx, input.familyId))) {
            throw nodeError('CASE_NOT_FOUND', 'Case not found');
          }
          const caseRow = await lockSceneCase(tx, input.caseId);
          if (!caseRow) throw nodeError('CASE_NOT_FOUND', 'Case not found');

          assertNodeCasePreconditions(caseRow, node, input.expectedCaseVersion);
          await assertOrdinaryProgressionAllowedRaw(tx, { caseId: input.caseId });
          await assertAssessmentCompliance(tx, input.actor.personId);
          if (
            node.nodeCode === 'A2010' ||
            node.stream === 'PHONE_USE_CONTRACT'
          ) {
            await assertCurrentDigitalUseProblemFormulation(tx, input.caseId);
          }

          const binding = await getScenePackageBinding(tx, input.caseId);
          if (binding === null) throw nodeError('SCENE_NODE_UNREACHABLE');
          if (binding !== DIGITAL_USE_PACKAGE_VERSION) throw nodeError('STALE_SCENE_PACKAGE');

          let current = await getSceneNodeState(tx, input.caseId, node.nodeCode, true);
          let recompleting = false;
          let reevaluatingTriage = false;
          if (
            current?.status === 'COMPLETED' &&
            (node.entryMode as readonly string[]).includes('USER_INITIATED') &&
            node.helpOrReentryRefs.length > 0
          ) {
            if (current.revision !== input.expectedNodeRevision) {
              throw nodeError('STALE_NODE_REVISION');
            }
            recompleting = true;
          }
          if (
            current !== null &&
            isRecoverableTriageProjection(node.nodeCode, current.status)
          ) {
            if (current.revision !== input.expectedNodeRevision) {
              throw nodeError('STALE_NODE_REVISION');
            }
            reevaluatingTriage = true;
          }
          if (
            !current &&
            ['A4005','A4006','A4007','A4008','A4009'].includes(node.nodeCode) &&
            (node.entryMode as readonly string[]).includes('USER_INITIATED')
          ) {
            const catalog = await getSceneNodeState(tx, input.caseId, 'A4004', true);
            if (!catalog || catalog.status !== 'COMPLETED') {
              throw nodeError('SCENE_NODE_UNREACHABLE');
            }
            current = await ensureSceneNodeAvailable(tx, {
              familyId: input.familyId,
              caseId: input.caseId,
              scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
              nodeCode: node.nodeCode,
              sourceNodeCode: node.sourceNodeCode,
              branchReasonCodes: ['PHONE_USE_CONTRACT_TOOL_USER_INITIATED'],
              inputRefs: catalog.output_refs,
            });
          }
          if (!current) throw nodeError('SCENE_NODE_UNREACHABLE');
          if (current.scene_package_version !== DIGITAL_USE_PACKAGE_VERSION) {
            throw nodeError('STALE_SCENE_PACKAGE');
          }
          if (current.revision !== input.expectedNodeRevision) {
            throw nodeError('STALE_NODE_REVISION');
          }
          if (
            current.status !== 'AVAILABLE' &&
            current.status !== 'IN_PROGRESS' &&
            !(recompleting && current.status === 'COMPLETED') &&
            !reevaluatingTriage
          ) {
            throw nodeError('SCENE_NODE_UNREACHABLE');
          }

          const semantic = await applySemanticForCurrentNode(tx, input, node, current);
          await assertSemanticRefs(tx, input, semantic);

          if (semantic.progression === 'HOLD') {
            const reasonCode = semantic.holdReasonCode ?? 'INTEGRATED_TRIAGE_INSUFFICIENT';
            const progressed = reevaluatingTriage
              ? await casReevaluateSceneNodeState(tx, {
                  caseId: input.caseId,
                  nodeCode: node.nodeCode,
                  scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
                  expectedRevision: input.expectedNodeRevision,
                  status: 'IN_PROGRESS',
                  branchReasonCodes: [reasonCode],
                  inputRefs: semantic.inputRefs,
                  outputRefs: semantic.outputRefs,
                })
              : await casRecordSceneNodeProgress(tx, {
                  caseId: input.caseId,
                  nodeCode: node.nodeCode,
                  scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
                  expectedRevision: input.expectedNodeRevision,
                  branchReasonCodes: [reasonCode],
                  inputRefs: semantic.inputRefs,
                  outputRefs: semantic.outputRefs,
                });
            if (!progressed) throw nodeError('STALE_NODE_REVISION');
            if (reevaluatingTriage) {
              await convergeSupersededTriageRoute(tx, {
                caseId: input.caseId,
                sourceNodeCode: node.nodeCode,
                newNextNodeCode: null,
                branchReasonCode: reasonCode,
                nextInputRefs: nextInputRefs(semantic),
              });
            }
            return {
              status: 200,
              body: await currentSceneEnvelope(tx, input.caseId),
            };
          }

          if (semantic.progression === 'BLOCKED') {
            const reasonCode = semantic.blockReasonCode ?? 'INTEGRATED_TRIAGE_BLOCKED';
            const blocked = reevaluatingTriage
              ? await casReevaluateSceneNodeState(tx, {
                  caseId: input.caseId,
                  nodeCode: node.nodeCode,
                  scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
                  expectedRevision: input.expectedNodeRevision,
                  status: 'BLOCKED',
                  branchReasonCodes: [reasonCode],
                  inputRefs: semantic.inputRefs,
                  outputRefs: semantic.outputRefs,
                })
              : await casCompleteSceneNodeState(tx, {
                  caseId: input.caseId,
                  nodeCode: node.nodeCode,
                  scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
                  expectedRevision: input.expectedNodeRevision,
                  status: 'BLOCKED',
                  branchReasonCodes: [reasonCode],
                  inputRefs: semantic.inputRefs,
                  outputRefs: semantic.outputRefs,
                });
            if (!blocked) throw nodeError('STALE_NODE_REVISION');
            if (reevaluatingTriage) {
              await convergeSupersededTriageRoute(tx, {
                caseId: input.caseId,
                sourceNodeCode: node.nodeCode,
                newNextNodeCode: null,
                branchReasonCode: reasonCode,
                nextInputRefs: nextInputRefs(semantic),
              });
            }
            await insertDigitalUseNodeCompletedEvent(tx, {
              familyId: input.familyId,
              caseId: input.caseId,
              actorAccountId: input.actor.accountId,
              scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
              nodeCode: node.nodeCode,
              nodeRevision: blocked.revision,
              routeReasonCode: reasonCode,
              inputRefs: semantic.inputRefs,
              outputRefs: semantic.outputRefs,
              nextNodeCode: null,
              terminalCode: null,
            });
            await insertDigitalUseNodeCompletedAudit(tx, {
              familyId: input.familyId,
              caseId: input.caseId,
              actorAccountId: input.actor.accountId,
              scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
              nodeCode: node.nodeCode,
              nodeRevision: blocked.revision,
              routeReasonCode: reasonCode,
              nextNodeCode: null,
              terminalCode: null,
            });
            return {
              status: 200,
              body: await currentSceneEnvelope(tx, input.caseId),
            };
          }

          if (semantic.progression === 'COMPLETE_NO_ROUTE') {
            const reasonCode = semantic.completeReasonCode ?? 'SCENE_NODE_COMPLETED';
            const completed = recompleting
              ? await casRecompleteSceneNodeState(tx, {
                  caseId: input.caseId,
                  nodeCode: node.nodeCode,
                  scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
                  expectedRevision: current.revision,
                  branchReasonCodes: [reasonCode],
                  inputRefs: semantic.inputRefs,
                  outputRefs: semantic.outputRefs,
                })
              : await casCompleteSceneNodeState(tx, {
                  caseId: input.caseId,
                  nodeCode: node.nodeCode,
                  scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
                  expectedRevision: current.revision,
                  status: semantic.completionStatus ?? 'COMPLETED',
                  branchReasonCodes: [reasonCode],
                  inputRefs: semantic.inputRefs,
                  outputRefs: semantic.outputRefs,
                });
            if (!completed) throw nodeError('STALE_NODE_REVISION');
            await insertDigitalUseNodeCompletedEvent(tx, {
              familyId: input.familyId,
              caseId: input.caseId,
              actorAccountId: input.actor.accountId,
              scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
              nodeCode: node.nodeCode,
              nodeRevision: completed.revision,
              routeReasonCode: reasonCode,
              inputRefs: semantic.inputRefs,
              outputRefs: semantic.outputRefs,
              nextNodeCode: null,
              terminalCode: null,
            });
            await insertDigitalUseNodeCompletedAudit(tx, {
              familyId: input.familyId,
              caseId: input.caseId,
              actorAccountId: input.actor.accountId,
              scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
              nodeCode: node.nodeCode,
              nodeRevision: completed.revision,
              routeReasonCode: reasonCode,
              nextNodeCode: null,
              terminalCode: null,
            });
            return { status: 200, body: await currentSceneEnvelope(tx, input.caseId) };
          }

          const route = routeSemantic(node, semantic);

          const completed = reevaluatingTriage
            ? await casReevaluateSceneNodeState(tx, {
                caseId: input.caseId,
                nodeCode: node.nodeCode,
                scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
                expectedRevision: current.revision,
                status: 'COMPLETED',
                branchReasonCodes: [route.reasonCode],
                inputRefs: semantic.inputRefs,
                outputRefs: semantic.outputRefs,
              })
            : recompleting
              ? await casRecompleteSceneNodeState(tx, {
                  caseId: input.caseId,
                  nodeCode: node.nodeCode,
                  scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
                  expectedRevision: current.revision,
                  branchReasonCodes: [route.reasonCode],
                  inputRefs: semantic.inputRefs,
                  outputRefs: semantic.outputRefs,
                })
              : await casCompleteSceneNodeState(tx, {
                caseId: input.caseId,
                nodeCode: node.nodeCode,
                scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
                expectedRevision: current.revision,
                status: semantic.completionStatus ?? 'COMPLETED',
                branchReasonCodes: [route.reasonCode],
                inputRefs: semantic.inputRefs,
                outputRefs: semantic.outputRefs,
              });
          if (!completed) throw nodeError('STALE_NODE_REVISION');

          let nextNodeCode: string | null = null;
          let terminalCode: string | null = null;
          if (route.kind === 'NODE') {
            nextNodeCode = route.nextNodeCode;
          } else {
            terminalCode = route.terminalCode;
          }

          if (reevaluatingTriage) {
            await convergeSupersededTriageRoute(tx, {
              caseId: input.caseId,
              sourceNodeCode: node.nodeCode,
              newNextNodeCode: nextNodeCode,
              branchReasonCode: route.reasonCode,
              nextInputRefs: nextInputRefs(semantic),
            });
          }

          if (route.kind === 'NODE') {
            const next = resolveDigitalUseRuntimeNode(route.nextNodeCode);
            const existingNext = await getSceneNodeState(tx, input.caseId, next.nodeCode, true);
            if (!existingNext) {
              await ensureSceneNodeAvailable(tx, {
                familyId: input.familyId,
                caseId: input.caseId,
                scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
                nodeCode: next.nodeCode,
                sourceNodeCode: next.sourceNodeCode,
                branchReasonCodes: [route.reasonCode],
                inputRefs: nextInputRefs(semantic),
              });
            }

            if (route.nextNodeCode === 'A3000') {
              const familyEntry = next;
              const parallelCodes = familyEntry.canRunInParallelWith as readonly string[];
              if (!parallelCodes.includes('A4001')) {
                throw nodeError('SCENE_ROUTE_UNRESOLVED', 'A3000/A4001 parallel authority missing');
              }
              const contractEntry = resolveDigitalUseRuntimeNode('A4001');
              const reciprocal = contractEntry.canRunInParallelWith as readonly string[];
              if (!reciprocal.includes('A3000')) {
                throw nodeError('SCENE_ROUTE_UNRESOLVED', 'A4001/A3000 parallel authority missing');
              }
              const existingContract = await getSceneNodeState(
                tx,
                input.caseId,
                contractEntry.nodeCode,
                true
              );
              if (!existingContract) {
                await ensureSceneNodeAvailable(tx, {
                  familyId: input.familyId,
                  caseId: input.caseId,
                  scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
                  nodeCode: contractEntry.nodeCode,
                  sourceNodeCode: contractEntry.sourceNodeCode,
                  branchReasonCodes: [route.reasonCode],
                  inputRefs: nextInputRefs(semantic),
                });
              } else if (
                existingContract.status === 'SKIPPED' ||
                existingContract.status === 'BLOCKED'
              ) {
                const reopened = await casReopenSceneNodeForRouteConvergence(tx, {
                  caseId: input.caseId,
                  nodeCode: contractEntry.nodeCode,
                  scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
                  expectedRevision: existingContract.revision,
                  branchReasonCodes: [route.reasonCode],
                  inputRefs: nextInputRefs(semantic),
                });
                if (!reopened) throw nodeError('STALE_NODE_REVISION');
              }
            }
          }

          await insertDigitalUseNodeCompletedEvent(tx, {
            familyId: input.familyId,
            caseId: input.caseId,
            actorAccountId: input.actor.accountId,
            scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
            nodeCode: node.nodeCode,
            nodeRevision: completed.revision,
            routeReasonCode: route.reasonCode,
            inputRefs: semantic.inputRefs,
            outputRefs: semantic.outputRefs,
            nextNodeCode,
            terminalCode,
          });
          await insertDigitalUseNodeCompletedAudit(tx, {
            familyId: input.familyId,
            caseId: input.caseId,
            actorAccountId: input.actor.accountId,
            scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
            nodeCode: node.nodeCode,
            nodeRevision: completed.revision,
            routeReasonCode: route.reasonCode,
            nextNodeCode,
            terminalCode,
          });

          return {
            status: 200,
            body: await currentSceneEnvelope(tx, input.caseId),
          };
        }
      );

      if (outcome.action === 'MISMATCH') {
        throw nodeError('IDEMPOTENCY_PAYLOAD_MISMATCH');
      }
      return outcome.body as DigitalUseSceneResponseType;
    }
  );
}
