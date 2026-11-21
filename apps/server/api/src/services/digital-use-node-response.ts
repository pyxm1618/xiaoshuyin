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
  evaluateIntegratedTriage,
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
import { isKnownAuthorizationDenial, requireFamilyAction } from '../authz.js';
import {
  runIdempotentCommandInTransaction,
  runPreparedIdempotentCommandInTransaction,
} from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import {
  assertBoundAssessmentCompliance,
  requireDigitalUseAssessmentTarget,
  currentSceneEnvelope,
  resolveRequestedDigitalUseNode,
  type DigitalUseActor,
} from './digital-use-assessment.js';
import {
  applyDigitalUseNodeSemantics,

  shouldPrepareProblemFormulationHandoff,
} from './digital-use-node-semantics.js';
import { loadIntegratedTriageEvidence } from './digital-use-triage-evidence.js';
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

const INTEGRATED_TRIAGE_INSUFFICIENT_REASON = 'INTEGRATED_TRIAGE_INSUFFICIENT';
const NORMAL_TRIAGE_OUTCOMES = new Set<string>([
  '01005',
  '01006',
  'A2001',
  'A2002',
  'A2003',
]);

function isHeldIntegratedTriageNode(node: SceneNodeStateRow): boolean {
  return (
    (node.node_code === '01002' || node.node_code === '01003') &&
    node.status === 'IN_PROGRESS' &&
    node.branch_reason_codes.includes(INTEGRATED_TRIAGE_INSUFFICIENT_REASON)
  );
}

/**
 * R1 — the only authorized post-completion A1001 re-entry.
 *
 * A1001 is ROUTED-only and has no manifest re-entry refs. It may be re-answered
 * after completion only while the server simultaneously proves:
 *   1. an Integrated Triage node is canonically held as INSUFFICIENT, and
 *   2. the deterministic evaluator's correction target is A1001.
 *
 * No client assertion or generic EXPANDED re-entry semantics can authorize it.
 */
async function isA1001CorrectionAuthorizedByInsufficientRecovery(
  tx: pg.PoolClient,
  caseId: string
): Promise<boolean> {
  const states = await listSceneNodeStates(tx, caseId);
  if (!states.some(isHeldIntegratedTriageNode)) return false;
  const triage = evaluateIntegratedTriage(
    await loadIntegratedTriageEvidence(tx, caseId)
  );
  return (
    triage.outcome === 'INSUFFICIENT' &&
    triage.correctionTargetNodeCode === 'A1001'
  );
}

async function heldIntegratedTriageNode(
  tx: pg.PoolClient,
  caseId: string
): Promise<SceneNodeStateRow | null> {
  const states = await listSceneNodeStates(tx, caseId);
  return (
    states
      .filter(isHeldIntegratedTriageNode)
      .sort((left, right) => left.node_code.localeCompare(right.node_code))[0] ??
    null
  );
}

/**
 * Recompute the same deterministic Integrated Triage after an authorized
 * A1001 correction and leave the INSUFFICIENT HOLD only when the new
 * authoritative Evidence snapshot proves a normal outcome.
 */
async function advanceHeldIntegratedTriageAfterCorrection(
  tx: pg.PoolClient,
  input: CompleteDigitalUseNodeInput
): Promise<void> {
  const held = await heldIntegratedTriageNode(tx, input.caseId);
  if (!held) return;

  const triage = evaluateIntegratedTriage(
    await loadIntegratedTriageEvidence(tx, input.caseId)
  );
  if (!NORMAL_TRIAGE_OUTCOMES.has(triage.outcome)) return;
  if (triage.outcome === 'A2003') {
    throw nodeError(
      'SCENE_ROUTE_BLOCKED',
      'A2003_REQUIRES_PROBLEM_FORMULATION_HANDOFF'
    );
  }

  const route = requireResolvedRoute(
    routeDigitalUseTopology({
      sceneCode: DIGITAL_USE_SCENE_CODE,
      packageVersion: DIGITAL_USE_PACKAGE_VERSION,
      currentNodeCode: held.node_code,
      conditions: triage.conditions,
      evidenceBasis: [
        'FUNCTIONAL_IMPACT',
        'SLEEP',
        'REAL_WORLD_ACTIVITY_DISPLACEMENT',
        'EMOTION',
        'FAMILY_RELATIONSHIP_OR_CONFLICT',
      ],
    })
  );

  const completed = await casCompleteSceneNodeState(tx, {
    caseId: input.caseId,
    nodeCode: held.node_code,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    expectedRevision: held.revision,
    status: 'COMPLETED',
    branchReasonCodes: [triage.reasonCode],
    inputRefs: held.input_refs,
    outputRefs: held.output_refs,
  });
  if (!completed) throw nodeError('STALE_NODE_REVISION');

  const nextNodeCode = route.kind === 'NODE' ? route.nextNodeCode : null;
  const terminalCode = route.kind === 'TERMINAL' ? route.terminalCode : null;

  await convergeSupersededTriageRoute(tx, {
    caseId: input.caseId,
    sourceNodeCode: held.node_code,
    newNextNodeCode: nextNodeCode,
    branchReasonCode: triage.reasonCode,
    nextInputRefs: held.output_refs,
  });

  if (route.kind === 'NODE') {
    await ensureSceneNodeAvailable(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
      nodeCode: route.nextNodeCode,
      sourceNodeCode: resolveDigitalUseRuntimeNode(route.nextNodeCode)
        .sourceNodeCode,
      branchReasonCodes: [triage.reasonCode],
      inputRefs: held.output_refs,
    });
  }

  await insertDigitalUseNodeCompletedEvent(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    actorAccountId: input.actor.accountId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    nodeCode: held.node_code,
    nodeRevision: completed.revision,
    routeReasonCode: triage.reasonCode,
    inputRefs: held.input_refs,
    outputRefs: held.output_refs,
    nextNodeCode,
    terminalCode,
  });
  await insertDigitalUseNodeCompletedAudit(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    actorAccountId: input.actor.accountId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    nodeCode: held.node_code,
    nodeRevision: completed.revision,
    routeReasonCode: triage.reasonCode,
    nextNodeCode,
    terminalCode,
  });
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
  await assertBoundAssessmentCompliance(tx, input);

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
      targetPersonId: await requireDigitalUseAssessmentTarget(tx, input.caseId, input.targetPersonId),
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
  await assertBoundAssessmentCompliance(tx, input);

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
  await assertBoundAssessmentCompliance(tx, input);

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
 * Conservative, schema-agnostic pre-lock filter for an authorized A1001
 * correction that may re-route Integrated Triage to A2003.
 *
 * This is NOT a second triage decision: after the A1001 Evidence write, the
 * single deterministic evaluator re-decides the outcome and any mismatch rolls
 * the whole transaction back.
 */
function hasPositiveDirectImpactPreview(response: unknown): boolean {
  if (typeof response !== 'object' || response === null) return false;
  const functionalImpact = (response as { functionalImpact?: unknown })
    .functionalImpact;
  if (typeof functionalImpact !== 'object' || functionalImpact === null) {
    return false;
  }
  return [
    'sleep',
    'studyOrNecessaryAffairs',
    'realWorldActivityDisplacement',
  ].some((key) => {
    const answer = (functionalImpact as Record<string, unknown>)[key];
    return (
      typeof answer === 'object' &&
      answer !== null &&
      (answer as { state?: unknown }).state === 'KNOWN' &&
      (answer as { impacted?: unknown }).impacted === true
    );
  });
}

/**
 * Lock-free preview: does this authorized A1001 correction deterministically
 * re-route Integrated Triage to A2003?
 *
 * A2003 lives in PROBLEM_FORMULATION, so it must never be exposed by a plain
 * Scene update; it requires the existing owner-controlled formulation handoff.
 */
async function shouldPrepareA1001CorrectionHandoff(
  tx: pg.PoolClient,
  input: CompleteDigitalUseNodeInput,
  node: DigitalUseNodeManifestEntry
): Promise<boolean> {
  if (node.nodeCode !== 'A1001') return false;
  const current = await getSceneNodeState(tx, input.caseId, 'A1001');
  if (!current || current.status !== 'COMPLETED') return false;
  if (!hasPositiveDirectImpactPreview(input.response)) return false;
  return isA1001CorrectionAuthorizedByInsufficientRecovery(tx, input.caseId);
}

/**
 * A1001 correction that re-routes to A2003.
 *
 * This reuses the one canonical handoff seam
 * (`presentDigitalUseProblemFormulationInTransaction`, Slice 8 owner locks and
 * idempotency) and then completes the previously held triage node before
 * exposing A2003. No second formulation writer or direct phase update exists.
 */
async function executeA1001CorrectionProblemFormulationHandoffPath(
  tx: pg.PoolClient,
  input: CompleteDigitalUseNodeInput,
  node: DigitalUseNodeManifestEntry
): Promise<DigitalUseSceneResponseType> {
  const caseRow = await getCaseById(tx, input.caseId);
  if (!caseRow) throw nodeError('CASE_NOT_FOUND', 'Case not found');
  assertNodeCasePreconditions(caseRow, node, input.expectedCaseVersion);
  await assertOrdinaryProgressionAllowedRaw(tx, { caseId: input.caseId });
  await assertBoundAssessmentCompliance(tx, input);

  const binding = await getScenePackageBinding(tx, input.caseId);
  if (binding === null) throw nodeError('SCENE_NODE_UNREACHABLE');
  if (binding !== DIGITAL_USE_PACKAGE_VERSION) throw nodeError('STALE_SCENE_PACKAGE');

  const a1001 = await getSceneNodeState(tx, input.caseId, 'A1001');
  if (!a1001 || a1001.status !== 'COMPLETED') throw nodeError('SCENE_NODE_UNREACHABLE');
  if (a1001.revision !== input.expectedNodeRevision) throw nodeError('STALE_NODE_REVISION');
  if (!(await heldIntegratedTriageNode(tx, input.caseId))) {
    throw nodeError('SCENE_NODE_UNREACHABLE');
  }

  const semantic = await applySemanticForCurrentNode(tx, input, node, a1001);
  await assertSemanticRefs(tx, input, semantic);
  if (semantic.progression !== undefined && semantic.progression !== 'ROUTE') {
    throw nodeError('STALE_NODE_REVISION');
  }
  const a1001Route = routeSemantic(node, semantic);
  if (a1001Route.kind !== 'NODE' || a1001Route.nextNodeCode !== '01002') {
    throw nodeError('SCENE_ROUTE_UNRESOLVED');
  }

  const triageAfterWrite = evaluateIntegratedTriage(
    await loadIntegratedTriageEvidence(tx, input.caseId)
  );
  if (triageAfterWrite.outcome !== 'A2003') throw nodeError('STALE_NODE_REVISION');
  const held = await heldIntegratedTriageNode(tx, input.caseId);
  if (!held) throw nodeError('STALE_NODE_REVISION');

  // Slice 8 owns Family -> Case -> Problem Formulation lock ordering, so this
  // must run before this transaction takes any Scene/Case write lock.
  const handoff = await presentDigitalUseProblemFormulationInTransaction(tx, {
    actor: input.actor,
    familyId: input.familyId,
    caseId: input.caseId,
    nodeCode: held.node_code,
    expectedCaseVersion: input.expectedCaseVersion,
    outerIdempotencyKey: input.idempotencyKey,
  });
  if (handoff.kind === 'UNAVAILABLE') {
    throw nodeError('SCENE_ROUTE_BLOCKED', handoff.reasonCode);
  }

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
  await assertOrdinaryProgressionAllowedRaw(tx, { caseId: input.caseId });
  await assertBoundAssessmentCompliance(tx, input);
  if ((await getScenePackageBinding(tx, input.caseId)) !== DIGITAL_USE_PACKAGE_VERSION) {
    throw nodeError('STALE_SCENE_PACKAGE');
  }

  const lockedA1001 = await getSceneNodeState(tx, input.caseId, 'A1001', true);
  if (
    !lockedA1001 ||
    lockedA1001.status !== 'COMPLETED' ||
    lockedA1001.revision !== input.expectedNodeRevision
  ) {
    throw nodeError('STALE_NODE_REVISION');
  }
  const lockedHeld = await getSceneNodeState(tx, input.caseId, held.node_code, true);
  if (!lockedHeld || !isHeldIntegratedTriageNode(lockedHeld)) {
    throw nodeError('STALE_NODE_REVISION');
  }
  const triageLocked = evaluateIntegratedTriage(
    await loadIntegratedTriageEvidence(tx, input.caseId)
  );
  if (triageLocked.outcome !== 'A2003') throw nodeError('STALE_NODE_REVISION');

  const completedA1001 = await casRecompleteSceneNodeState(tx, {
    caseId: input.caseId,
    nodeCode: 'A1001',
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    expectedRevision: input.expectedNodeRevision,
    branchReasonCodes: [a1001Route.reasonCode],
    inputRefs: semantic.inputRefs,
    outputRefs: semantic.outputRefs,
  });
  if (!completedA1001) throw nodeError('STALE_NODE_REVISION');

  const completedHeld = await casCompleteSceneNodeState(tx, {
    caseId: input.caseId,
    nodeCode: lockedHeld.node_code,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    expectedRevision: lockedHeld.revision,
    status: 'COMPLETED',
    branchReasonCodes: [triageLocked.reasonCode],
    inputRefs: lockedHeld.input_refs,
    outputRefs: lockedHeld.output_refs,
  });
  if (!completedHeld) throw nodeError('STALE_NODE_REVISION');

  await convergeSupersededTriageRoute(tx, {
    caseId: input.caseId,
    sourceNodeCode: lockedHeld.node_code,
    newNextNodeCode: 'A2003',
    branchReasonCode: triageLocked.reasonCode,
    nextInputRefs: lockedHeld.output_refs,
  });

  const a2003 = resolveDigitalUseRuntimeNode('A2003');
  await ensureSceneNodeAvailable(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    nodeCode: 'A2003',
    sourceNodeCode: a2003.sourceNodeCode,
    branchReasonCodes: [triageLocked.reasonCode],
    inputRefs: lockedHeld.output_refs,
  });

  await insertDigitalUseNodeCompletedEvent(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    actorAccountId: input.actor.accountId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    nodeCode: 'A1001',
    nodeRevision: completedA1001.revision,
    routeReasonCode: a1001Route.reasonCode,
    inputRefs: semantic.inputRefs,
    outputRefs: semantic.outputRefs,
    nextNodeCode: '01002',
    terminalCode: null,
  });
  await insertDigitalUseNodeCompletedAudit(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    actorAccountId: input.actor.accountId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    nodeCode: 'A1001',
    nodeRevision: completedA1001.revision,
    routeReasonCode: a1001Route.reasonCode,
    nextNodeCode: '01002',
    terminalCode: null,
  });
  await insertDigitalUseNodeCompletedEvent(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    actorAccountId: input.actor.accountId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    nodeCode: completedHeld.node_code,
    nodeRevision: completedHeld.revision,
    routeReasonCode: triageLocked.reasonCode,
    inputRefs: lockedHeld.input_refs,
    outputRefs: lockedHeld.output_refs,
    nextNodeCode: 'A2003',
    terminalCode: null,
  });
  await insertDigitalUseNodeCompletedAudit(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    actorAccountId: input.actor.accountId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    nodeCode: completedHeld.node_code,
    nodeRevision: completedHeld.revision,
    routeReasonCode: triageLocked.reasonCode,
    nextNodeCode: 'A2003',
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

      const visibleCase = await getCaseById(tx, input.caseId);
      if (!visibleCase || visibleCase.family_id !== input.familyId) {
        throw nodeError('CASE_NOT_FOUND', 'Case not found');
      }
      // Manifest identity is resolved only after authorization, so fabricated
      // node codes do not become a cross-Family existence oracle.
      const node: DigitalUseNodeManifestEntry =
        resolveRequestedDigitalUseNode(input.nodeCode);
      assertNodeCasePreconditions(visibleCase, node, input.expectedCaseVersion);
      if (!input.targetPersonId) throw nodeError('TARGET_SCOPE_INVALID');
      const targetPersonId = await requireDigitalUseAssessmentTarget(tx, input.caseId, input.targetPersonId);
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
          const a1001CorrectionHandoff =
            !recoveringAfterFormulation &&
            (await shouldPrepareA1001CorrectionHandoff(tx, input, node));
          const handoffCandidate =
            !recoveringAfterFormulation &&
            !a1001CorrectionHandoff &&
            await shouldPrepareProblemFormulationHandoff({
              tx,
              targetPersonId,
              actor: input.actor,
              familyId: input.familyId,
              caseId: input.caseId,
              nodeCode: node.nodeCode,
              response: input.response,
            });
          if (a1001CorrectionHandoff) {
            return {
              status: 200,
              body:
                await executeA1001CorrectionProblemFormulationHandoffPath(
                  tx,
                  input,
                  node
                ),
            };
          }
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
          await assertBoundAssessmentCompliance(tx, input);
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
          let a1001RecoveryCorrection = false;
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
          if (current?.status === 'COMPLETED' && node.nodeCode === 'A1001') {
            a1001RecoveryCorrection =
              await isA1001CorrectionAuthorizedByInsufficientRecovery(
                tx,
                input.caseId
              );
            if (a1001RecoveryCorrection) {
              if (current.revision !== input.expectedNodeRevision) {
                throw nodeError('STALE_NODE_REVISION');
              }
              recompleting = true;
            }
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

          if (a1001RecoveryCorrection) {
            await advanceHeldIntegratedTriageAfterCorrection(tx, input);
          }

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
