/**
 * Slice 12 — Digital Use Assessment start/resume application service.
 *
 * One caller-owned RLS transaction composes the existing Slice 8
 * StartAssessment owner with the Scene projection. No Assessment table or
 * second phase transition exists.
 */
import type pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  createServerFeatureDescriptor,
  evaluateComplianceAtTransactionTime,
  type ComplianceObligation,
} from '@xiaoshuyin/compliance';
import {
  assertOrdinaryProgressionAllowedRaw,
  caseIdempotencyKeyBytes,
  getCaseById,
  getScenePackageBinding,
  coherentCurrentSelectionRevision,
  listCurrentDigitalUseTargetItems,
  getReservedIdempotency,
  getSceneNodeState,
  hashPayload,
  isLegacyTextLookupSafe,
  listSceneArtifacts,
  listSceneNodeStates,
  resolveTraceableStatement,
  ensureSceneNodeAvailable,
  type SceneArtifactRow,
  type SceneCaseRow,
  type SceneNodeStateRow,
  type DigitalUseTargetItemRow,
} from '@xiaoshuyin/domain';
import {
  DIGITAL_USE_PACKAGE_VERSION,
  DIGITAL_USE_SCENE_CODE,
  initialA1001Projection,
  resolveDigitalUseRuntimeNode,
  digitalUseNodeManifest,
  type DigitalUseNodeManifestEntry,
} from '@xiaoshuyin/scenes/digital-use';
import type { DigitalUseNodeResponseType, DigitalUseSceneResponseType } from '@xiaoshuyin/contracts';
import { withRlsTransaction } from '../db/tx.js';
import { isKnownAuthorizationDenial, requireFamilyAction } from '../authz.js';
import { runIdempotentCommandInTransaction } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import { startAssessmentInTransaction } from './problem-formulations.js';
import { familyAllianceTargetIdentity } from './family-alliance-semantics.js';

export interface DigitalUseActor {
  readonly accountId: string;
  readonly personId: string;
}

export interface StartDigitalUseAssessmentInput {
  readonly actor: DigitalUseActor;
  readonly familyId: string;
  readonly caseId: string;
  readonly expectedCaseVersion: number;
  readonly idempotencyKey: string;
}

const DIGITAL_USE_ASSESSMENT_FEATURE = createServerFeatureDescriptor({
  featureCode: 'DIGITAL_USE_ASSESSMENT_RUNTIME',
  featureContractRevision: 'v1',
  capabilityLabel: 'Digital Use Assessment Runtime',
});

const SUPPORTED_ASSESSMENT_OBLIGATIONS = [
  'REQUIRE_GUARDIAN_CONSENT',
  'REQUIRE_MINOR_MODE',
] as const satisfies readonly ComplianceObligation[];

function sceneError(code: string, message?: string): Error & { statusCode: number; code: string } {
  const mapped = toHttpError(code, message);
  return Object.assign(new Error(mapped.message), {
    statusCode: mapped.statusCode,
    code: mapped.code,
  });
}

/**
 * Map only a client-requested node identifier into the HTTP/application error
 * contract. Internal router-produced node codes are still allowed to surface
 * as invariants if the manifest/router ever drift.
 */
export function resolveRequestedDigitalUseNode(nodeCode: string) {
  try {
    return resolveDigitalUseRuntimeNode(nodeCode);
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null
        ? (error as { code?: unknown }).code
        : undefined;
    if (code === 'SCENE_NODE_NOT_FOUND') {
      throw sceneError('SCENE_NODE_NOT_FOUND');
    }
    throw error;
  }
}

export type AssessmentEntryDecision = 'START' | 'RESUME';

export function decideAssessmentEntry(
  row: Pick<SceneCaseRow, 'status' | 'phase' | 'is_primary' | 'version'>,
  expectedCaseVersion: number
): AssessmentEntryDecision {
  if (row.status === 'SAFETY_HOLD') throw sceneError('SAFETY_HOLD_BLOCKED');
  if (row.status === 'CLOSED') throw sceneError('CASE_CLOSED');
  if (row.status !== 'OPEN') throw sceneError('CASE_NOT_OPEN');
  if (!row.is_primary) throw sceneError('CASE_NOT_PRIMARY');
  if (row.version !== expectedCaseVersion) throw sceneError('STALE_CASE_VERSION');
  if (row.phase === 'INTAKE') return 'START';
  if (row.phase === 'ASSESSMENT') return 'RESUME';
  throw sceneError('CASE_PHASE_CONFLICT');
}

export async function assertAssessmentCompliance(
  tx: pg.PoolClient,
  actorPersonId: string
): Promise<void> {
  const db = drizzle(tx);
  const result = await evaluateComplianceAtTransactionTime(db, tx, {
    descriptor: DIGITAL_USE_ASSESSMENT_FEATURE,
    personId: actorPersonId,
    supportedObligations: SUPPORTED_ASSESSMENT_OBLIGATIONS,
  });
  if (result.gate !== 'ALLOW') {
    throw sceneError('COMPLIANCE_BLOCKED', result.reasonCode ?? 'COMPLIANCE_BLOCKED');
  }
}

function nodeDto(row: SceneNodeStateRow) {
  return {
    nodeCode: row.node_code,
    sourceNodeCode: row.source_node_code,
    status: row.status,
    revision: row.revision,
    branchReasonCodes: row.branch_reason_codes,
    inputRefs: row.input_refs,
    outputRefs: row.output_refs,
    enteredAt: new Date(row.entered_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  };
}

function artifactDto(row: SceneArtifactRow) {
  return {
    id: row.id,
    type: row.artifact_type,
    schemaVersion: row.schema_version,
    sourceNodeCode: row.source_node_code,
    revision: row.revision,
    data: row.data,
    sourceRefs: row.source_refs,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function targetDto(row: DigitalUseTargetItemRow) {
  return {
    id: row.id,
    targetCode: row.target_code,
    selectionRevision: row.selection_revision,
    revision: row.revision,
    selected: row.selected,
    concreteTargetText: row.concrete_target_text,
    feasibility: row.feasibility_payload,
    progress: row.progress_payload,
    progressEvidenceRefs: row.progress_evidence_refs
      .filter((ref) => 'id' in ref)
      .map((ref) => ({ type: ref.type, id: ref.id })),
    helpHistoryRefs: row.help_history_refs
      .filter((ref) => 'id' in ref)
      .map((ref) => ({ type: ref.type, id: ref.id })),
    sourceRefs: row.source_refs,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function familyNodeReachable(
  row: SceneNodeStateRow,
  selectedTargets: ReadonlySet<string>
): boolean {
  const manifest = (digitalUseNodeManifest as readonly DigitalUseNodeManifestEntry[])
    .find((entry) => entry.nodeCode === row.node_code);
  if (!manifest) return false;
  if (manifest.stream !== 'FAMILY_ALLIANCE') {
    return row.status === 'AVAILABLE' || row.status === 'IN_PROGRESS';
  }
  const target = familyAllianceTargetIdentity(manifest);
  if (target !== null && !selectedTargets.has(target.targetCode)) return false;
  if (row.status === 'AVAILABLE' || row.status === 'IN_PROGRESS') return true;
  if (row.status !== 'COMPLETED') return false;
  return (
    row.node_code === 'A3000' ||
    manifest.entryMode.includes('USER_INITIATED') ||
    manifest.entryMode.includes('SCHEDULED') ||
    manifest.helpOrReentryRefs.length > 0
  );
}

export function buildSceneEnvelope(input: {
  caseRow: SceneCaseRow;
  nodes: SceneNodeStateRow[];
  artifacts: SceneArtifactRow[];
  targets?: DigitalUseTargetItemRow[];
}): DigitalUseSceneResponseType {
  const targets = input.targets ?? [];
  const projected = input.nodes.map(nodeDto);
  const selectedTargets = new Set(
    targets.filter((target) => target.selected).map((target) => target.target_code)
  );
  const reachableRows = input.nodes.filter((row) =>
    familyNodeReachable(row, selectedTargets)
  );
  const reachableCodes = new Set(reachableRows.map((row) => row.node_code));
  const active = projected.filter(
    (node) =>
      (node.status === 'AVAILABLE' || node.status === 'IN_PROGRESS') &&
      reachableCodes.has(node.nodeCode)
  );
  // Backward-compatible representative only. activeNodes/reachableNodes are
  // authoritative for Slice 13 parallel Scene projection.
  const currentNode = active[0] ?? projected.at(-1) ?? null;
  const latestReason = currentNode?.branchReasonCodes.at(-1) ?? null;
  const a2010 = input.artifacts
    .filter((artifact) => artifact.artifact_type === 'SOLUTION_SUMMARY')
    .sort((a, b) => b.revision - a.revision)[0];
  const a3000 = input.nodes.find((node) => node.node_code === 'A3000');
  const targetSelectionRevision = coherentCurrentSelectionRevision(targets);

  return {
    caseId: input.caseRow.id,
    caseVersion: input.caseRow.version,
    sceneCode: DIGITAL_USE_SCENE_CODE,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    currentNode,
    activeNodes: active,
    reachableNodes: reachableRows.map((row) => {
      const manifest: DigitalUseNodeManifestEntry =
        resolveDigitalUseRuntimeNode(row.node_code);
      return {
        nodeCode: row.node_code,
        sourceNodeCode: row.source_node_code,
        entryModes: [...manifest.entryMode],
        reasonCode:
          row.status === 'COMPLETED'
            ? 'MANIFEST_REENTRY_AVAILABLE'
            : row.branch_reason_codes.at(-1) ?? 'SCENE_NODE_AVAILABLE',
      };
    }),
    nodes: projected,
    artifacts: input.artifacts.map(artifactDto),
    targetSelectionRevision,
    targets: targets.map(targetDto),
    routeReasonCode: latestReason,
    downstream:
      a3000 !== undefined
        ? {
            routeIntent: 'A4001',
            available: false,
            reasonCode: 'DOWNSTREAM_RUNTIME_UNAVAILABLE',
          }
        : a2010
          ? {
              routeIntent: 'A3000',
              available: false,
              reasonCode: 'ENTRY_GATES_REVALIDATION_REQUIRED',
            }
          : {
              routeIntent: null,
              available: true,
              reasonCode: null,
            },
  };
}

export async function currentSceneEnvelope(
  tx: pg.PoolClient,
  caseId: string
): Promise<DigitalUseSceneResponseType> {
  const caseRow = await getCaseById(tx, caseId);
  if (!caseRow) throw sceneError('CASE_NOT_FOUND', 'Case not found');
  const [nodes, artifacts, targets] = await Promise.all([
    listSceneNodeStates(tx, caseId),
    listSceneArtifacts(tx, caseId),
    listCurrentDigitalUseTargetItems(tx, caseId),
  ]);
  return buildSceneEnvelope({ caseRow, nodes, artifacts, targets });
}

async function ensureA1001(
  tx: pg.PoolClient,
  input: Pick<StartDigitalUseAssessmentInput, 'familyId' | 'caseId'>
): Promise<SceneNodeStateRow> {
  const initial = initialA1001Projection();
  const carrier = await resolveTraceableStatement(tx, input.caseId);
  if (!carrier) throw sceneError('TRACEABLE_PROBLEM_STATEMENT_REQUIRED');
  return ensureSceneNodeAvailable(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    scenePackageVersion: initial.scenePackageVersion,
    nodeCode: initial.nodeCode,
    sourceNodeCode: initial.sourceNodeCode,
    branchReasonCodes: ['LEGAL_DIGITAL_USE_SCENE_ENTRY'],
    inputRefs: [{ type: carrier.type, id: carrier.id }],
  });
}

function ownerCaseVersion(result: { status: number; body: unknown }): number {
  const value =
    typeof result.body === 'object' && result.body !== null
      ? (result.body as { caseVersion?: unknown }).caseVersion
      : undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw sceneError('INTERNAL_ERROR', 'Invalid StartAssessment owner response');
  }
  return value;
}

function stableInitialSceneEnvelope(
  a1001: SceneNodeStateRow,
  caseVersion: number
): DigitalUseSceneResponseType {
  const initialRow: SceneNodeStateRow = {
    ...a1001,
    status: 'AVAILABLE',
    revision: 1,
    branch_reason_codes: ['LEGAL_DIGITAL_USE_SCENE_ENTRY'],
    input_refs: a1001.input_refs,
    output_refs: [],
    completed_at: null,
  };
  const projected = nodeDto(initialRow);
  return {
    caseId: a1001.case_id,
    caseVersion,
    sceneCode: DIGITAL_USE_SCENE_CODE,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    currentNode: projected,
    activeNodes: [projected],
    reachableNodes: [{
      nodeCode: projected.nodeCode,
      sourceNodeCode: projected.sourceNodeCode,
      entryModes: [...resolveDigitalUseRuntimeNode(projected.nodeCode).entryMode],
      reasonCode: 'LEGAL_DIGITAL_USE_SCENE_ENTRY',
    }],
    nodes: [projected],
    artifacts: [],
    targetSelectionRevision: 0,
    targets: [],
    routeReasonCode: null,
    downstream: { routeIntent: null, available: true, reasonCode: null },
  };
}

async function requireExistingA1001(
  tx: pg.PoolClient,
  caseId: string
): Promise<SceneNodeStateRow> {
  const row = await getSceneNodeState(tx, caseId, 'A1001');
  if (!row || row.scene_package_version !== DIGITAL_USE_PACKAGE_VERSION) {
    throw sceneError('SCENE_PACKAGE_MISMATCH');
  }
  return row;
}

/**
 * Start or resume the one Digital Use Assessment Scene projection.
 *
 * INTAKE path delegates the phase bridge + owner idempotency to Slice 8.
 * ASSESSMENT path is an idempotent resume over the same shared idempotency
 * table. No later phase is reset by this command.
 */
export async function startOrResumeDigitalUseAssessment(
  pool: pg.Pool,
  input: StartDigitalUseAssessmentInput
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
      await requireFamilyAction(tx, {
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        familyId: input.familyId,
        caseId: input.caseId,
        action: 'CASE_START_ASSESSMENT',
        purpose: 'FAMILY_MANAGEMENT',
        resource: { type: 'CASE', familyId: input.familyId, caseId: input.caseId },
      });

      const visibleCase = await getCaseById(tx, input.caseId);
      if (!visibleCase) throw sceneError('CASE_NOT_FOUND', 'Case not found');

      // Idempotent owner replay is a read-only business result. It is decided
      // before current Safety/Compliance state so same key + same payload stays
      // the original result; no ordinary progression is performed on replay.
      const keyBytes = caseIdempotencyKeyBytes(input.idempotencyKey);
      const ownerExisting = await getReservedIdempotency(tx, {
        actorAccountId: input.actor.accountId,
        commandType: 'CASE_START_ASSESSMENT',
        keyBytes,
        legacyKeyText: isLegacyTextLookupSafe(input.idempotencyKey)
          ? input.idempotencyKey
          : null,
      });

      if (ownerExisting !== null) {
        const ownerResult = await startAssessmentInTransaction(tx, {
          actor: input.actor,
          familyId: input.familyId,
          caseId: input.caseId,
          expectedCaseVersion: input.expectedCaseVersion,
          idempotencyKey: input.idempotencyKey,
        });
        if (ownerResult.status !== 200) return ownerResult as never;
        const a1001 = await requireExistingA1001(tx, input.caseId);
        return stableInitialSceneEnvelope(a1001, ownerCaseVersion(ownerResult));
      }

      if (visibleCase.phase === 'INTAKE') {
        await assertOrdinaryProgressionAllowedRaw(tx, { caseId: input.caseId });
        await assertAssessmentCompliance(tx, input.actor.personId);

        const ownerResult = await startAssessmentInTransaction(tx, {
          actor: input.actor,
          familyId: input.familyId,
          caseId: input.caseId,
          expectedCaseVersion: input.expectedCaseVersion,
          idempotencyKey: input.idempotencyKey,
        });
        if (ownerResult.status !== 200) {
          // Preserve the Slice 8 owner's original idempotent 4xx result and do
          // not create A1001 for a failed StartAssessment.
          return ownerResult as never;
        }

        const a1001 = await ensureA1001(tx, input);
        return stableInitialSceneEnvelope(a1001, ownerCaseVersion(ownerResult));
      }

      const decision = decideAssessmentEntry(visibleCase, input.expectedCaseVersion);
      if (decision !== 'RESUME') {
        throw sceneError('CASE_PHASE_CONFLICT');
      }

      const binding = await getScenePackageBinding(tx, input.caseId);
      if (binding === null) {
        throw sceneError('SCENE_PACKAGE_MISMATCH');
      }
      if (binding !== DIGITAL_USE_PACKAGE_VERSION) {
        throw sceneError('STALE_SCENE_PACKAGE');
      }

      const requestHash = hashPayload({
        familyId: input.familyId,
        caseId: input.caseId,
        expectedCaseVersion: input.expectedCaseVersion,
      });
      const outcome = await runIdempotentCommandInTransaction(
        tx,
        {
          accountId: input.actor.accountId,
          personId: input.actor.personId,
          purpose: 'FAMILY_MANAGEMENT',
          commandType: 'DIGITAL_USE_ASSESSMENT_RESUME',
          idempotencyKey: input.idempotencyKey,
          requestHash,
        },
        async () => ({
          status: 200,
          body: await currentSceneEnvelope(tx, input.caseId),
        })
      );

      if (outcome.action === 'MISMATCH') {
        throw sceneError('IDEMPOTENCY_PAYLOAD_MISMATCH');
      }
      return outcome.body as DigitalUseSceneResponseType;
    }
  );
}


export interface ReadDigitalUseSceneInput {
  readonly actor: DigitalUseActor;
  readonly familyId: string;
  readonly caseId: string;
}

async function authorizeSceneRead(
  tx: pg.PoolClient,
  input: ReadDigitalUseSceneInput
): Promise<SceneCaseRow> {
  try {
    await requireFamilyAction(tx, {
      accountId: input.actor.accountId,
      personId: input.actor.personId,
      familyId: input.familyId,
      caseId: input.caseId,
      action: 'CASE_READ_ASSESSMENT_SCENE',
      purpose: 'FAMILY_MANAGEMENT',
      resource: { type: 'CASE', familyId: input.familyId, caseId: input.caseId },
    });
  } catch (error) {
    if (!isKnownAuthorizationDenial(error)) throw error;
    throw sceneError('CASE_NOT_FOUND', 'Case not found');
  }
  const caseRow = await getCaseById(tx, input.caseId);
  if (!caseRow) throw sceneError('CASE_NOT_FOUND', 'Case not found');
  const binding = await getScenePackageBinding(tx, input.caseId);
  if (binding === null) throw sceneError('SCENE_NODE_UNREACHABLE', 'Scene has not started');
  if (binding !== DIGITAL_USE_PACKAGE_VERSION) throw sceneError('STALE_SCENE_PACKAGE');
  return caseRow;
}

/** Authorized read-only Scene projection. Never creates or advances state. */
export async function getDigitalUseScene(
  pool: pg.Pool,
  input: ReadDigitalUseSceneInput
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
      await authorizeSceneRead(tx, input);
      return currentSceneEnvelope(tx, input.caseId);
    }
  );
}

/**
 * Authorized read-only node view. Manifest identity is necessary but not
 * sufficient: a node without a current sparse projection is unreachable.
 * A200401 is rejected by the canonical runtime-node resolver.
 */
export async function getDigitalUseNode(
  pool: pg.Pool,
  input: ReadDigitalUseSceneInput & { readonly nodeCode: string }
): Promise<DigitalUseNodeResponseType> {
  return withRlsTransaction(
    pool,
    {
      familyId: input.familyId,
      accountId: input.actor.accountId,
      personId: input.actor.personId,
      purpose: 'FAMILY_MANAGEMENT',
    },
    async (tx) => {
      const caseRow = await authorizeSceneRead(tx, input);
      const manifestNode = resolveRequestedDigitalUseNode(input.nodeCode);
      const stored = await getSceneNodeState(tx, input.caseId, manifestNode.nodeCode);
      if (!stored) throw sceneError('SCENE_NODE_UNREACHABLE');
      if (stored.scene_package_version !== DIGITAL_USE_PACKAGE_VERSION) {
        throw sceneError('STALE_SCENE_PACKAGE');
      }
      const envelope = await currentSceneEnvelope(tx, input.caseId);
      return {
        caseId: caseRow.id,
        caseVersion: caseRow.version,
        sceneCode: DIGITAL_USE_SCENE_CODE,
        scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
        node: nodeDto(stored),
        activeNodes: envelope.activeNodes,
        reachableNodes: envelope.reachableNodes,
        artifacts: envelope.artifacts.filter(
          (artifact) => artifact.sourceNodeCode === stored.node_code
        ),
        targetSelectionRevision: envelope.targetSelectionRevision,
        targets: envelope.targets,
        routeReasonCode: stored.branch_reason_codes.at(-1) ?? null,
        downstream: envelope.downstream,
      };
    }
  );
}

