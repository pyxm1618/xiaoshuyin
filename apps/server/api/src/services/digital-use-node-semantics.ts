/**
 * Slice 12 — one bounded node-semantics composition point.
 *
 * Node-specific Evidence / Consent / Artifact handling is added task-by-task
 * here. This module is not a router: it derives authoritative conditions and
 * refs only. Slice 11 routeDigitalUseTopology() remains the sole topology
 * decision owner.
 */
import type pg from 'pg';
import type {
  DigitalUseConditionState,
  DigitalUseEvidenceBasisCategory,
} from '@xiaoshuyin/scenes/digital-use';
import type { StoredSceneRef } from '@xiaoshuyin/domain';

export interface DigitalUseNodeSemanticsContext {
  readonly tx: pg.PoolClient;
  readonly actor: { readonly accountId: string; readonly personId: string };
  readonly familyId: string;
  readonly caseId: string;
  readonly nodeCode: string;
  readonly response: Readonly<Record<string, unknown>>;
}

export interface DigitalUseNodeSemanticResult {
  readonly inputRefs: readonly StoredSceneRef[];
  readonly outputRefs: readonly StoredSceneRef[];
  readonly conditions: Readonly<Record<string, DigitalUseConditionState>>;
  readonly evidenceBasis?: readonly DigitalUseEvidenceBasisCategory[];
  readonly completionStatus?: 'COMPLETED' | 'SKIPPED' | 'BLOCKED';
  readonly nextInputRefs?: readonly StoredSceneRef[];
}

function semanticError(code: string): never {
  throw Object.assign(new Error(code), { code });
}

/**
 * Single node-specific dispatch point. T1210–T1215 add cases here rather than
 * creating one service/router/state machine per node.
 */
export async function applyDigitalUseNodeSemantics(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  switch (context.nodeCode) {
    default:
      semanticError('SCENE_RESPONSE_INVALID');
  }
}
