/**
 * Slice 13 — canonical FAMILY_ALLIANCE execution inside the existing
 * Digital Use Scene transaction/idempotency shell.
 *
 * No topology is owned here: entry/advance derives from Slice 11 Manifest +
 * routeDigitalUseTopology. Target-family materialization filters the canonical
 * Manifest by business role; it never infers numeric adjacency.
 */
import type pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  createServerFeatureDescriptor,
  evaluateComplianceAtTransactionTime,
  getComplianceProfileForUpdate,
  getConsentRecordForGate,
  getCurrentNoticeHash,
  lockComplianceFeatureEvaluationBasis,
  type ComplianceObligation,
} from '@xiaoshuyin/compliance';
import {
  assertOrdinaryProgressionAllowedRaw,
  casCompleteSceneNodeState,
  casRecompleteSceneNodeState,
  ensureSceneNodeAvailable,
  getCurrentDigitalUseTargetItem,
  getCurrentTargetSelectionRevision,
  getSceneNodeState,
  insertDigitalUseNodeCompletedAudit,
  insertDigitalUseNodeCompletedEvent,
  listCurrentDigitalUseTargetItems,
  lockCurrentProblemFormulation,
  lockFamilyForPrimaryDecision,
  lockSceneCase,
  validateSceneRefs,
  type FamilyAllianceTargetCode,
  type SceneNodeStateRow,
  type StoredSceneRef,
} from '@xiaoshuyin/domain';
import {
  DIGITAL_USE_PACKAGE_VERSION,
  DIGITAL_USE_SCENE_CODE,
  digitalUseNodeManifest,
  resolveDigitalUseRuntimeNode,
  routeDigitalUseTopology,
  type DigitalUseNodeManifestEntry,
} from '@xiaoshuyin/scenes/digital-use';
import { toHttpError } from '../plugins/error-handler.js';
import {
  currentSceneEnvelope,
  type DigitalUseActor,
} from './digital-use-assessment.js';
import {
  applyFamilyAllianceNodeSemantics,
  familyAllianceTargetIdentity,
} from './family-alliance-semantics.js';

const FAMILY_ALLIANCE_FEATURE = createServerFeatureDescriptor({
  featureCode: 'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME',
  featureContractRevision: 'v1',
  capabilityLabel: 'Digital Use Family Alliance Runtime',
});

const SUPPORTED_FAMILY_ALLIANCE_OBLIGATIONS = [
  'REQUIRE_GUARDIAN_CONSENT',
  'REQUIRE_MINOR_MODE',
] as const satisfies readonly ComplianceObligation[];

function familyHttpError(
  code: string,
  message?: string
): Error & { statusCode: number; code: string } {
  const mapped = toHttpError(code, message);
  return Object.assign(new Error(mapped.message), {
    statusCode: mapped.statusCode,
    code: mapped.code,
  });
}

function rethrowFamilyBusinessError(error: unknown): never {
  const code =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown }).code
      : undefined;
  if (typeof code === 'string') {
    const mapped = toHttpError(code);
    if (mapped.statusCode < 500) throw familyHttpError(code);
  }
  throw error;
}

async function evaluateFamilyAllianceCompliance(
  tx: pg.PoolClient,
  actorPersonId: string
): Promise<{ policyId: string | null; policyVersion: number | null }> {
  const db = drizzle(tx);
  const result = await evaluateComplianceAtTransactionTime(db, tx, {
    descriptor: FAMILY_ALLIANCE_FEATURE,
    personId: actorPersonId,
    supportedObligations: SUPPORTED_FAMILY_ALLIANCE_OBLIGATIONS,
  });
  if (result.gate !== 'ALLOW') {
    if (
      result.reasonCode === 'COMPLIANCE_GUARDIAN_CONSENT_REQUIRED' ||
      result.reasonCode === 'COMPLIANCE_GUARDIAN_CONSENT_INVALID'
    ) {
      throw familyHttpError('CONSENT_BLOCKED', result.reasonCode);
    }
    throw familyHttpError('COMPLIANCE_BLOCKED', result.reasonCode ?? 'COMPLIANCE_BLOCKED');
  }
  return { policyId: result.policyId, policyVersion: result.policyVersion };
}

async function assertFamilyAllianceConsentOwnerGate(
  tx: pg.PoolClient,
  actorPersonId: string
): Promise<void> {
  const profile = await getComplianceProfileForUpdate(tx, actorPersonId);
  if (!profile || profile.age_band !== 'UNDER_14') return;

  if (
    !profile.guardian_person_id ||
    !profile.guardian_consent_record_id ||
    !profile.guardian_consent_version
  ) {
    throw familyHttpError('CONSENT_BLOCKED', 'GUARDIAN_CONSENT_REQUIRED');
  }

  const consent = await getConsentRecordForGate(
    tx,
    profile.guardian_consent_record_id
  );
  if (
    !consent ||
    consent.decision !== 'GRANTED' ||
    consent.version !== profile.guardian_consent_version ||
    consent.bound_person_id !== actorPersonId ||
    consent.guardian_person_id !== profile.guardian_person_id ||
    consent.notice_hash !== getCurrentNoticeHash()
  ) {
    throw familyHttpError('CONSENT_BLOCKED', 'GUARDIAN_CONSENT_INVALID');
  }
}

async function pinAndAssertFamilyAllianceGates(
  tx: pg.PoolClient,
  caseId: string,
  actorPersonId: string
): Promise<{ policyId: string | null; policyVersion: number | null }> {
  // Consent remains an independent owner: validate the authoritative guardian
  // purpose/version/revocation gate before evaluating feature policy.
  await assertFamilyAllianceConsentOwnerGate(tx, actorPersonId);
  // Exact same advisory key as Slice 10 publisher/overlap guard.
  await lockComplianceFeatureEvaluationBasis(tx, FAMILY_ALLIANCE_FEATURE);
  const compliance = await evaluateFamilyAllianceCompliance(tx, actorPersonId);
  await assertOrdinaryProgressionAllowedRaw(tx, { caseId });
  return compliance;
}

async function revalidateFamilyAllianceGates(
  tx: pg.PoolClient,
  caseId: string,
  actorPersonId: string
): Promise<void> {
  // Profile/policy locks are still held. Revalidate Consent independently,
  // then Compliance, immediately before idempotency success/commit.
  await assertFamilyAllianceConsentOwnerGate(tx, actorPersonId);
  await evaluateFamilyAllianceCompliance(tx, actorPersonId);
  await assertOrdinaryProgressionAllowedRaw(tx, { caseId });
}

export interface FamilyAllianceExecutionInput {
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

async function materializeLegalA3000Entry(
  tx: pg.PoolClient,
  input: FamilyAllianceExecutionInput,
  node: DigitalUseNodeManifestEntry
): Promise<SceneNodeStateRow> {
  if (node.nodeCode !== 'A3000' || input.expectedNodeRevision !== 0) {
    throw familyHttpError('SCENE_NODE_UNREACHABLE');
  }

  const a2010 = await getSceneNodeState(tx, input.caseId, 'A2010', true);
  if (!a2010 || a2010.status !== 'COMPLETED') {
    throw familyHttpError('FAMILY_ALLIANCE_ENTRY_BLOCKED');
  }

  const formulation = await lockCurrentProblemFormulation(tx, input.caseId);
  if (!formulation || formulation.status !== 'CONFIRMED') {
    throw familyHttpError('PROBLEM_FORMULATION_REQUIRED');
  }

  const route = routeDigitalUseTopology({
    sceneCode: DIGITAL_USE_SCENE_CODE,
    packageVersion: DIGITAL_USE_PACKAGE_VERSION,
    currentNodeCode: 'A2010',
    conditions: { SOLUTION_STAGE_READY: true },
  });
  if (
    route.kind !== 'NODE_ROUTE' ||
    route.nextNodeCode !== node.nodeCode
  ) {
    throw familyHttpError('FAMILY_ALLIANCE_ENTRY_BLOCKED');
  }

  return ensureSceneNodeAvailable(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    nodeCode: node.nodeCode,
    sourceNodeCode: node.sourceNodeCode,
    branchReasonCodes: [route.reasonCode],
    inputRefs: a2010.output_refs,
  });
}

function reentryAllowed(node: DigitalUseNodeManifestEntry): boolean {
  if (node.nodeCode === 'A3000') return true;
  return node.entryMode.includes('USER_INITIATED') ||
    node.entryMode.includes('SCHEDULED') ||
    node.helpOrReentryRefs.length > 0;
}

function entryModeFor(
  node: DigitalUseNodeManifestEntry,
  before: SceneNodeStateRow,
  wasInitialA3000Entry: boolean
): string {
  if (wasInitialA3000Entry) return 'ROUTED';
  if (before.status === 'COMPLETED') {
    return node.nodeCode === 'A3000' ? 'REASSESSMENT' : 'RE_ENTRY';
  }
  if (node.entryMode.includes('USER_INITIATED')) return 'USER_INITIATED';
  if (node.entryMode.includes('SCHEDULED')) return 'SCHEDULED';
  return 'ROUTED';
}

async function currentNodeBasis(
  tx: pg.PoolClient,
  input: FamilyAllianceExecutionInput,
  node: DigitalUseNodeManifestEntry
): Promise<{ current: SceneNodeStateRow; initialA3000: boolean }> {
  let current = await getSceneNodeState(tx, input.caseId, node.nodeCode, true);
  let initialA3000 = false;
  if (current === null) {
    current = await materializeLegalA3000Entry(tx, input, node);
    initialA3000 = true;
  } else if (current.revision !== input.expectedNodeRevision) {
    throw familyHttpError('STALE_NODE_REVISION');
  }

  if (
    current.status !== 'AVAILABLE' &&
    current.status !== 'IN_PROGRESS' &&
    !(current.status === 'COMPLETED' && reentryAllowed(node))
  ) {
    throw familyHttpError('SCENE_NODE_UNREACHABLE');
  }

  return { current, initialA3000 };
}

async function targetInputBasis(
  tx: pg.PoolClient,
  input: FamilyAllianceExecutionInput,
  node: DigitalUseNodeManifestEntry,
  fallbackRefs: readonly StoredSceneRef[]
): Promise<readonly StoredSceneRef[]> {
  const identity = familyAllianceTargetIdentity(node);
  if (identity === null) return fallbackRefs;
  if (
    input.expectedSelectionRevision === undefined ||
    input.expectedTargetRevision === undefined
  ) {
    throw familyHttpError('STALE_TARGET_REVISION');
  }
  const current = await getCurrentDigitalUseTargetItem(
    tx,
    input.caseId,
    identity.targetCode,
    true
  );
  if (!current || !current.selected) throw familyHttpError('TARGET_NOT_SELECTED');
  if (current.selection_revision !== input.expectedSelectionRevision) {
    throw familyHttpError('STALE_SELECTION_REVISION');
  }
  if (current.revision !== input.expectedTargetRevision) {
    throw familyHttpError('STALE_TARGET_REVISION');
  }
  return [{ type: 'TARGET_ITEM', id: current.id }];
}

function routeFamilyNode(
  node: DigitalUseNodeManifestEntry,
  conditions: Readonly<Record<string, boolean>>
): { reasonCode: string; nextNodeCode: string | null } {
  if (node.allowedNext.length === 0) {
    return {
      reasonCode:
        node.nodeCode === 'A3002'
          ? 'TARGET_SELECTION_RECORDED'
          : 'FAMILY_ALLIANCE_NODE_RECORDED',
      nextNodeCode: null,
    };
  }

  const route = routeDigitalUseTopology({
    sceneCode: DIGITAL_USE_SCENE_CODE,
    packageVersion: DIGITAL_USE_PACKAGE_VERSION,
    currentNodeCode: node.nodeCode,
    conditions,
  });
  if (route.kind !== 'NODE_ROUTE') {
    const code =
      route.kind === 'BLOCKED' ? 'SCENE_ROUTE_BLOCKED' : 'SCENE_ROUTE_UNRESOLVED';
    const detail =
      route.kind === 'BLOCKED' || route.kind === 'UNKNOWN'
        ? route.code
        : route.terminalCode;
    throw familyHttpError(code, detail);
  }
  return { reasonCode: route.reasonCode, nextNodeCode: route.nextNodeCode };
}

async function materializeParallelNodes(
  tx: pg.PoolClient,
  input: FamilyAllianceExecutionInput,
  routedNode: DigitalUseNodeManifestEntry,
  inputRefs: readonly StoredSceneRef[],
  reasonCode: string
): Promise<void> {
  await ensureSceneNodeAvailable(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    nodeCode: routedNode.nodeCode,
    sourceNodeCode: routedNode.sourceNodeCode,
    branchReasonCodes: [reasonCode],
    inputRefs,
  });

  for (const parallelCode of routedNode.canRunInParallelWith) {
    const parallel: DigitalUseNodeManifestEntry =
      resolveDigitalUseRuntimeNode(parallelCode);
    if (parallel.stream !== 'FAMILY_ALLIANCE') continue;
    await ensureSceneNodeAvailable(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
      nodeCode: parallel.nodeCode,
      sourceNodeCode: parallel.sourceNodeCode,
      branchReasonCodes: ['MANIFEST_PARALLEL_AVAILABLE'],
      inputRefs,
    });
  }
}

async function materializeSelectedTargetNodes(
  tx: pg.PoolClient,
  input: FamilyAllianceExecutionInput,
  selectedTargets: readonly FamilyAllianceTargetCode[]
): Promise<void> {
  const selected = new Set(selectedTargets);
  const currentTargets = await listCurrentDigitalUseTargetItems(tx, input.caseId);
  const selectedRowByCode = new Map(
    currentTargets
      .filter((row) => row.selected)
      .map((row) => [row.target_code, row])
  );

  for (const candidate of digitalUseNodeManifest as readonly DigitalUseNodeManifestEntry[]) {
    if (candidate.stream !== 'FAMILY_ALLIANCE') continue;
    const identity = familyAllianceTargetIdentity(candidate);
    if (identity === null || !selected.has(identity.targetCode)) continue;
    const row = selectedRowByCode.get(identity.targetCode);
    if (!row) throw familyHttpError('TARGET_SELECTION_STATE_INVALID');
    await ensureSceneNodeAvailable(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
      nodeCode: candidate.nodeCode,
      sourceNodeCode: candidate.sourceNodeCode,
      branchReasonCodes: ['TARGET_SELECTED'],
      inputRefs: [{ type: 'TARGET_ITEM', id: row.id }],
    });
  }
}

export async function executeFamilyAllianceNodeInTransaction(
  tx: pg.PoolClient,
  input: FamilyAllianceExecutionInput,
  node: DigitalUseNodeManifestEntry
) {
  try {
    if (node.stream !== 'FAMILY_ALLIANCE') {
      throw familyHttpError('SCENE_NODE_UNREACHABLE');
    }
    if (input.expectedScenePackageVersion !== DIGITAL_USE_PACKAGE_VERSION) {
      throw familyHttpError('STALE_SCENE_PACKAGE');
    }

    if (!(await lockFamilyForPrimaryDecision(tx, input.familyId))) {
      throw familyHttpError('CASE_NOT_FOUND', 'Case not found');
    }
    const caseRow = await lockSceneCase(tx, input.caseId);
    if (!caseRow) throw familyHttpError('CASE_NOT_FOUND', 'Case not found');
    if (caseRow.status === 'SAFETY_HOLD') throw familyHttpError('SAFETY_HOLD_BLOCKED');
    if (caseRow.status === 'CLOSED') throw familyHttpError('CASE_NOT_OPEN');
    if (caseRow.status !== 'OPEN') throw familyHttpError('CASE_NOT_OPEN');
    if (!caseRow.is_primary) throw familyHttpError('CASE_NOT_PRIMARY');
    if (caseRow.version !== input.expectedCaseVersion) {
      throw familyHttpError('STALE_CASE_VERSION');
    }
    if (caseRow.phase !== 'GOALS') throw familyHttpError('CASE_PHASE_CONFLICT');

    // Pin the single Slice 12 package anchor in the caller-owned transaction.
    // This prevents an owner-side package replacement from racing after the
    // basis check but before Family Alliance business effects commit.
    const packageAnchor = await getSceneNodeState(tx, input.caseId, 'A1001', true);
    const binding = packageAnchor?.scene_package_version ?? null;
    if (binding !== DIGITAL_USE_PACKAGE_VERSION) {
      throw familyHttpError(
        binding === null ? 'SCENE_PACKAGE_MISMATCH' : 'STALE_SCENE_PACKAGE'
      );
    }

    const formulation = await lockCurrentProblemFormulation(tx, input.caseId);
    if (!formulation || formulation.status !== 'CONFIRMED') {
      throw familyHttpError('PROBLEM_FORMULATION_REQUIRED');
    }

    const compliance = await pinAndAssertFamilyAllianceGates(
      tx,
      input.caseId,
      input.actor.personId
    );

    const { current, initialA3000 } = await currentNodeBasis(tx, input, node);
    const semanticInputRefs = await targetInputBasis(
      tx,
      input,
      node,
      current.input_refs
    );
    const nextNodeRevision = current.revision + 1;

    const semantic = await applyFamilyAllianceNodeSemantics({
      tx,
      actor: input.actor,
      familyId: input.familyId,
      caseId: input.caseId,
      node,
      response: input.response,
      currentInputRefs: semanticInputRefs,
      nextNodeRevision,
      ...(input.expectedSelectionRevision === undefined
        ? {}
        : { expectedSelectionRevision: input.expectedSelectionRevision }),
      ...(input.expectedTargetRevision === undefined
        ? {}
        : { expectedTargetRevision: input.expectedTargetRevision }),
    });

    if (
      !(await validateSceneRefs(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        refs: [...semantic.inputRefs, ...semantic.outputRefs],
      }))
    ) {
      throw familyHttpError('SCENE_RESPONSE_INVALID');
    }

    const route = routeFamilyNode(node, semantic.conditions);
    const reasonCode =
      current.status === 'COMPLETED'
        ? `REENTRY_${route.reasonCode}`
        : route.reasonCode;

    const completed =
      current.status === 'COMPLETED'
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
            status: 'COMPLETED',
            branchReasonCodes: [reasonCode],
            inputRefs: semantic.inputRefs,
            outputRefs: semantic.outputRefs,
          });
    if (!completed) throw familyHttpError('STALE_NODE_REVISION');

    if (route.nextNodeCode !== null) {
      const next: DigitalUseNodeManifestEntry =
        resolveDigitalUseRuntimeNode(route.nextNodeCode);
      if (next.stream !== 'FAMILY_ALLIANCE') {
        throw familyHttpError('SCENE_ROUTE_UNRESOLVED');
      }
      await materializeParallelNodes(
        tx,
        input,
        next,
        semantic.outputRefs,
        route.reasonCode
      );
    }

    if (semantic.selectedTargets !== undefined) {
      await materializeSelectedTargetNodes(tx, input, semantic.selectedTargets);
    }

    const targetIdentity = familyAllianceTargetIdentity(node);
    const selectionRevision = await getCurrentTargetSelectionRevision(
      tx,
      input.caseId
    );
    const entryMode = entryModeFor(node, current, initialA3000);

    await insertDigitalUseNodeCompletedEvent(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      actorAccountId: input.actor.accountId,
      scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
      nodeCode: node.nodeCode,
      nodeRevision: completed.revision,
      priorNodeRevision: current.revision,
      routeReasonCode: reasonCode,
      inputRefs: semantic.inputRefs,
      outputRefs: semantic.outputRefs,
      nextNodeCode: route.nextNodeCode,
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
      nextNodeCode: route.nextNodeCode,
      terminalCode: null,
      sourceNodeCode: node.sourceNodeCode,
      entryMode,
      ...(targetIdentity === null ? {} : { targetCode: targetIdentity.targetCode }),
      ...(selectionRevision === 0 ? {} : { selectionRevision }),
      ...(semantic.targetRow === undefined
        ? {}
        : { targetRevision: semantic.targetRow.revision }),
      inputRefs: semantic.inputRefs,
      outputRefs: semantic.outputRefs,
      idempotencyOutcome: 'EXECUTED',
    });

    // Final race gate. Case, formulation, Consent profile and feature policy
    // bases remain locked by owner seams; Safety/Compliance are re-read here.
    const finalCase = await lockSceneCase(tx, input.caseId);
    if (
      !finalCase ||
      finalCase.status !== 'OPEN' ||
      !finalCase.is_primary ||
      finalCase.version !== input.expectedCaseVersion ||
      finalCase.phase !== 'GOALS'
    ) {
      throw familyHttpError('STALE_CASE_VERSION');
    }
    const finalFormulation = await lockCurrentProblemFormulation(tx, input.caseId);
    if (
      !finalFormulation ||
      finalFormulation.id !== formulation.id ||
      finalFormulation.version !== formulation.version ||
      finalFormulation.status !== 'CONFIRMED'
    ) {
      throw familyHttpError('PROBLEM_FORMULATION_REQUIRED');
    }
    await revalidateFamilyAllianceGates(tx, input.caseId, input.actor.personId);

    void compliance;
    return currentSceneEnvelope(tx, input.caseId);
  } catch (error) {
    rethrowFamilyBusinessError(error);
  }
}
