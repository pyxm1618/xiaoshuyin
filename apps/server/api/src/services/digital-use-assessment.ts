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
  getReservedIdempotency,
  hashPayload,
  isLegacyTextLookupSafe,
  listSceneArtifacts,
  listSceneNodeStates,
  ensureSceneNodeAvailable,
  type SceneArtifactRow,
  type SceneCaseRow,
  type SceneNodeStateRow,
} from '@xiaoshuyin/domain';
import {
  DIGITAL_USE_PACKAGE_VERSION,
  DIGITAL_USE_SCENE_CODE,
  initialA1001Projection,
} from '@xiaoshuyin/scenes/digital-use';
import type { DigitalUseSceneResponseType } from '@xiaoshuyin/contracts';
import { withRlsTransaction } from '../db/tx.js';
import { requireFamilyAction } from '../authz.js';
import { runIdempotentCommandInTransaction } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import { startAssessmentInTransaction } from './problem-formulations.js';

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

export type AssessmentEntryDecision = 'START' | 'RESUME';

export function decideAssessmentEntry(
  row: Pick<SceneCaseRow, 'status' | 'phase' | 'is_primary' | 'version'>,
  expectedCaseVersion: number
): AssessmentEntryDecision {
  if (row.status === 'SAFETY_HOLD') throw sceneError('SAFETY_HOLD_BLOCKED');
  if (row.status === 'CLOSED') throw sceneError('CASE_CLOSED');
  if (!row.is_primary) throw sceneError('CASE_NOT_PRIMARY');
  if (row.version !== expectedCaseVersion) throw sceneError('STALE_CASE_VERSION');
  if (row.phase === 'INTAKE') return 'START';
  if (row.phase === 'ASSESSMENT') return 'RESUME';
  throw sceneError('CASE_PHASE_CONFLICT');
}

async function assertAssessmentCompliance(
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

function buildSceneEnvelope(input: {
  caseRow: SceneCaseRow;
  nodes: SceneNodeStateRow[];
  artifacts: SceneArtifactRow[];
}): DigitalUseSceneResponseType {
  const projected = input.nodes.map(nodeDto);
  const active = projected.filter((node) =>
    node.status === 'AVAILABLE' || node.status === 'IN_PROGRESS'
  );
  if (active.length > 1) throw sceneError('INTERNAL_ERROR', 'Multiple active Scene nodes');
  const currentNode = active[0] ?? projected.at(-1) ?? null;
  const latestReason = currentNode?.branchReasonCodes.at(-1) ?? null;
  const a2010 = input.artifacts
    .filter((artifact) => artifact.artifact_type === 'SOLUTION_SUMMARY')
    .sort((a, b) => b.revision - a.revision)[0];

  return {
    caseId: input.caseRow.id,
    caseVersion: input.caseRow.version,
    sceneCode: DIGITAL_USE_SCENE_CODE,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    currentNode,
    nodes: projected,
    artifacts: input.artifacts.map(artifactDto),
    routeReasonCode: latestReason,
    downstream: a2010
      ? {
          routeIntent: 'A3000',
          available: false,
          reasonCode: 'DOWNSTREAM_RUNTIME_UNAVAILABLE',
        }
      : {
          routeIntent: null,
          available: true,
          reasonCode: null,
        },
  };
}

async function currentSceneEnvelope(
  tx: pg.PoolClient,
  caseId: string
): Promise<DigitalUseSceneResponseType> {
  const caseRow = await getCaseById(tx, caseId);
  if (!caseRow) throw sceneError('CASE_NOT_FOUND', 'Case not found');
  const [nodes, artifacts] = await Promise.all([
    listSceneNodeStates(tx, caseId),
    listSceneArtifacts(tx, caseId),
  ]);
  return buildSceneEnvelope({ caseRow, nodes, artifacts });
}

async function ensureA1001(
  tx: pg.PoolClient,
  input: Pick<StartDigitalUseAssessmentInput, 'familyId' | 'caseId'>
): Promise<void> {
  const initial = initialA1001Projection();
  await ensureSceneNodeAvailable(tx, {
    familyId: input.familyId,
    caseId: input.caseId,
    scenePackageVersion: initial.scenePackageVersion,
    nodeCode: initial.nodeCode,
    sourceNodeCode: initial.sourceNodeCode,
    branchReasonCodes: ['LEGAL_DIGITAL_USE_SCENE_ENTRY'],
  });
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

      // Safety precedes ordinary business progression and is re-read inside this
      // exact transaction. Compliance uses the same checked-out client.
      await assertOrdinaryProgressionAllowedRaw(tx, { caseId: input.caseId });
      await assertAssessmentCompliance(tx, input.actor.personId);

      // If this exact key already belongs to the Slice 8 start command, delegate
      // back to that owner even though the Case is now ASSESSMENT. The owner
      // decides replay vs mismatch before its phase precondition.
      const keyBytes = caseIdempotencyKeyBytes(input.idempotencyKey);
      const ownerExisting = await getReservedIdempotency(tx, {
        actorAccountId: input.actor.accountId,
        commandType: 'CASE_START_ASSESSMENT',
        keyBytes,
        legacyKeyText: isLegacyTextLookupSafe(input.idempotencyKey)
          ? input.idempotencyKey
          : null,
      });

      if (visibleCase.phase === 'INTAKE' || ownerExisting !== null) {
        await startAssessmentInTransaction(tx, {
          actor: input.actor,
          familyId: input.familyId,
          caseId: input.caseId,
          expectedCaseVersion: input.expectedCaseVersion,
          idempotencyKey: input.idempotencyKey,
        });

        // This write is deliberately AFTER the authoritative owner command but
        // inside the same outer transaction. Failure here rolls back the phase,
        // owner event/audit and owner idempotency completion together.
        await ensureA1001(tx, input);
        return currentSceneEnvelope(tx, input.caseId);
      }

      const decision = decideAssessmentEntry(visibleCase, input.expectedCaseVersion);
      if (decision !== 'RESUME') {
        throw sceneError('CASE_PHASE_CONFLICT');
      }

      const binding = await getReservedPackage(tx, input.caseId);
      if (binding === null) {
        // A legal ASSESSMENT from another owner path may not fabricate Scene
        // history. It may initialize the approved A1001 projection only when no
        // conflicting package binding exists.
        await ensureA1001(tx, input);
      } else if (binding !== DIGITAL_USE_PACKAGE_VERSION) {
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

async function getReservedPackage(tx: pg.PoolClient, caseId: string): Promise<string | null> {
  const { rows } = await tx.query<{ scene_package_version: string }>(
    `SELECT scene_package_version
       FROM scene_node_states
      WHERE case_id = $1 AND node_code = 'A1001'`,
    [caseId]
  );
  return rows[0]?.scene_package_version ?? null;
}
