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
  getSceneNodeState,
  getScenePackageBinding,
  hashPayload,
  insertDigitalUseNodeCompletedAudit,
  insertDigitalUseNodeCompletedEvent,
  lockFamilyForPrimaryDecision,
  lockSceneCase,
  validateSceneRefs,
  type SceneCaseRow,
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
import { isKnownAuthorizationDenial, requireFamilyAction } from '../authz.js';
import { runIdempotentCommandInTransaction } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import {
  assertAssessmentCompliance,
  currentSceneEnvelope,
  type DigitalUseActor,
} from './digital-use-assessment.js';
import { applyDigitalUseNodeSemantics } from './digital-use-node-semantics.js';

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
  if (caseRow.status !== 'OPEN') throw nodeError('CASE_NOT_OPEN');
  if (!caseRow.is_primary) throw nodeError('CASE_NOT_PRIMARY');
  if (caseRow.version !== expectedCaseVersion) throw nodeError('STALE_CASE_VERSION');
  if (caseRow.phase !== node.phase) throw nodeError('CASE_PHASE_CONFLICT');
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
      const node = resolveDigitalUseRuntimeNode(input.nodeCode);
      const requestHash = hashPayload({
        familyId: input.familyId,
        caseId: input.caseId,
        nodeCode: node.nodeCode,
        expectedCaseVersion: input.expectedCaseVersion,
        expectedNodeRevision: input.expectedNodeRevision,
        response: input.response,
      });

      const outcome = await runIdempotentCommandInTransaction(
        tx,
        {
          accountId: input.actor.accountId,
          personId: input.actor.personId,
          purpose: 'FAMILY_MANAGEMENT',
          commandType: 'DIGITAL_USE_NODE_RESPONSE',
          idempotencyKey: input.idempotencyKey,
          requestHash,
        },
        async () => {
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

          let semantic: Awaited<ReturnType<typeof applyDigitalUseNodeSemantics>>;
          try {
            semantic = await applyDigitalUseNodeSemantics({
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

          if (
            !(await validateSceneRefs(tx, {
              familyId: input.familyId,
              caseId: input.caseId,
              refs: [...semantic.inputRefs, ...semantic.outputRefs],
            }))
          ) {
            throw nodeError('SCENE_RESPONSE_INVALID', 'Scene refs are outside the authorized Case');
          }

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

          const route = requireResolvedRoute(
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
