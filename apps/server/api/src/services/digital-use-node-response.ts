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
  casRecordSceneNodeProgress,
  ensureSceneNodeAvailable,
  getCaseById,
  getSceneNodeState,
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
import {
  A5001FamilyAllianceReviewResponse,
  type CompleteDigitalUseNodeRequestType,
  type DigitalUseSceneResponseType,
} from '@xiaoshuyin/contracts';
import { withRlsTransaction } from '../db/tx.js';
import { isKnownAuthorizationDenial, requireFamilyAction } from '../authz.js';
import { runIdempotentCommandInTransaction } from '../idempotency.js';
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
  executeFamilyAllianceReviewNodeInTransaction,
  resolveA5001SubjectSnapshot,
} from './digital-use-family-alliance-review.js';

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
  node: Pick<DigitalUseNodeManifestEntry, 'phase'>,
  expectedCaseVersion: number
): void {
  if (caseRow.status === 'CLOSED') throw nodeError('CASE_CLOSED');
  if (caseRow.status === 'SAFETY_HOLD') throw nodeError('SAFETY_HOLD_BLOCKED');
  if (caseRow.status !== 'OPEN') throw nodeError('CASE_NOT_OPEN');
  if (!caseRow.is_primary) throw nodeError('CASE_NOT_PRIMARY');
  if (caseRow.version !== expectedCaseVersion) throw nodeError('STALE_CASE_VERSION');
  // Digital Use A/010xx phases are Scene metadata, not a second global Case
  // phase machine. Slice 12 owns only the ASSESSMENT -> PROBLEM_FORMULATION
  // Common Core bridge; Goal/Planning runtime is explicitly out of scope.
  const requiredCasePhase =
    node.phase === 'ASSESSMENT' ? 'ASSESSMENT' : 'PROBLEM_FORMULATION';
  if (caseRow.phase !== requiredCasePhase) throw nodeError('CASE_PHASE_CONFLICT');
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
  if (current.status !== 'AVAILABLE' && current.status !== 'IN_PROGRESS') {
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
    (current.status !== 'AVAILABLE' && current.status !== 'IN_PROGRESS')
  ) {
    throw nodeError('STALE_NODE_REVISION');
  }

  const blocked = await casCompleteSceneNodeState(tx, {
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
    (lockedNode.status !== 'AVAILABLE' && lockedNode.status !== 'IN_PROGRESS')
  ) {
    throw nodeError('STALE_NODE_REVISION');
  }

  const completed = await casCompleteSceneNodeState(tx, {
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
 * Authorization is re-established before idempotency replay. Mutable business
 * gates are intentionally evaluated only for a new execution, so a same-key
 * replay returns the original committed result without duplicating effects or
 * changing semantics because Safety/Compliance state changed later.
 */
export async function completeDigitalUseNodeResponse(
  pool: pg.Pool,
  input: CompleteDigitalUseNodeInput
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
      if (node.stream === 'FAMILY_ALLIANCE_REVIEW') {
        // Subject resolution must never run before the Case has been proven
        // visible inside the actor's RLS family context. Otherwise a foreign
        // Case could surface a semantic 409 instead of anti-enumeration 404.
        const visibleCase = await lockSceneCase(tx, input.caseId);
        if (visibleCase === null) throw nodeError('CASE_NOT_FOUND', 'Case not found');
      }
      const resolvedA5001Subject =
        node.stream === 'FAMILY_ALLIANCE_REVIEW'
          ? await resolveA5001SubjectSnapshot(tx, input.caseId)
          : null;
      const validatedResponse =
        node.stream === 'FAMILY_ALLIANCE_REVIEW'
          ? (() => {
              const parsed = A5001FamilyAllianceReviewResponse.safeParse(input.response);
              if (!parsed.success) throw nodeError('SCENE_RESPONSE_INVALID');
              return parsed.data;
            })()
          : input.response;
      const requestHash = hashPayload({
        familyId: input.familyId,
        caseId: input.caseId,
        nodeCode: node.nodeCode,
        stream: node.stream,
        expectedCaseVersion: input.expectedCaseVersion,
        expectedNodeRevision: input.expectedNodeRevision,
        expectedScenePackageVersion: input.expectedScenePackageVersion ?? null,
        expectedSelectionRevision: input.expectedSelectionRevision ?? null,
        expectedTargetRevision: input.expectedTargetRevision ?? null,
        resolvedSubject: resolvedA5001Subject,
        response: validatedResponse,
      });

      const outcome = await runIdempotentCommandInTransaction(
        tx,
        {
          accountId: input.actor.accountId,
          personId: input.actor.personId,
          purpose: 'FAMILY_MANAGEMENT',
          // Slice 15 keeps the existing Scene command slot. A5001 command
          // identity is independent through the server-resolved node + exact
          // Family Alliance subject/revisions included in requestHash above;
          // no second idempotency owner or schema vocabulary is introduced.
          commandType: 'DIGITAL_USE_NODE_RESPONSE',
          idempotencyKey: input.idempotencyKey,
          requestHash,
        },
        async () => {
          if (node.stream === 'FAMILY_ALLIANCE_REVIEW') {
            return {
              status: 200,
              body: await executeFamilyAllianceReviewNodeInTransaction(
                tx,
                input,
                node
              ),
            };
          }

          if (node.stream === 'FAMILY_ALLIANCE') {
            return {
              status: 200,
              body: await executeFamilyAllianceNodeInTransaction(tx, input, node),
            };
          }

          const handoffCandidate = await shouldPrepareProblemFormulationHandoff({
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

          const binding = await getScenePackageBinding(tx, input.caseId);
          if (binding === null) throw nodeError('SCENE_NODE_UNREACHABLE');
          if (binding !== DIGITAL_USE_PACKAGE_VERSION) throw nodeError('STALE_SCENE_PACKAGE');

          const current = await getSceneNodeState(tx, input.caseId, node.nodeCode, true);
          if (!current) throw nodeError('SCENE_NODE_UNREACHABLE');
          if (current.scene_package_version !== DIGITAL_USE_PACKAGE_VERSION) {
            throw nodeError('STALE_SCENE_PACKAGE');
          }
          if (current.revision !== input.expectedNodeRevision) {
            throw nodeError('STALE_NODE_REVISION');
          }
          if (current.status !== 'AVAILABLE' && current.status !== 'IN_PROGRESS') {
            throw nodeError('SCENE_NODE_UNREACHABLE');
          }

          const semantic = await applySemanticForCurrentNode(tx, input, node, current);
          await assertSemanticRefs(tx, input, semantic);

          if (semantic.progression === 'HOLD') {
            const reasonCode = semantic.holdReasonCode ?? 'INTEGRATED_TRIAGE_INSUFFICIENT';
            const progressed = await casRecordSceneNodeProgress(tx, {
              caseId: input.caseId,
              nodeCode: node.nodeCode,
              scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
              expectedRevision: input.expectedNodeRevision,
              branchReasonCodes: [reasonCode],
              inputRefs: semantic.inputRefs,
              outputRefs: semantic.outputRefs,
            });
            if (!progressed) throw nodeError('STALE_NODE_REVISION');
            return {
              status: 200,
              body: await currentSceneEnvelope(tx, input.caseId),
            };
          }

          if (semantic.progression === 'BLOCKED') {
            const reasonCode = semantic.blockReasonCode ?? 'INTEGRATED_TRIAGE_BLOCKED';
            const blocked = await casCompleteSceneNodeState(tx, {
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
            return {
              status: 200,
              body: await currentSceneEnvelope(tx, input.caseId),
            };
          }

          const route = routeSemantic(node, semantic);

          const completed = await casCompleteSceneNodeState(tx, {
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

          let nextNodeCode: string | null = null;
          let terminalCode: string | null = null;
          if (route.kind === 'NODE') {
            nextNodeCode = route.nextNodeCode;
            // A3000 is canonical intent only in Slice 12. T1215 materializes no
            // A3000 state and keeps the downstream runtime unavailable.
            if (route.nextNodeCode !== 'A3000') {
              const next = resolveDigitalUseRuntimeNode(route.nextNodeCode);
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
          } else {
            terminalCode = route.terminalCode;
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
