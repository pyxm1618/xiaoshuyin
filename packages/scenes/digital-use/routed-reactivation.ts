/**
 * Finding #7 — authorized ROUTED reactivation policy.
 *
 * A node that already COMPLETED can legitimately need to run again when the
 * Frozen Manifest routes into it a second time from a *different* predecessor
 * (01004 is entered by A2002 and by A2009). This is not an Authority conflict:
 * the topology already declares both edges.
 *
 * The rule is derived entirely from the Manifest — no node-code special case:
 *
 *   1. the target's ONLY legal entry mode is ROUTED (no USER_INITIATED /
 *      SCHEDULED path and no help-or-re-entry refs), so a client can never
 *      reopen it directly;
 *   2. the target genuinely has several Manifest predecessors, which is the
 *      structural reason a second routed arrival can happen at all (01004:
 *      A2002 and A2009). A ROUTED-only node with a single predecessor keeps its
 *      existing re-entry semantics untouched;
 *   3. the completing source node declares a NODE edge to that target.
 *
 * Anything else is denied and the caller must keep the historical COMPLETED
 * projection untouched.
 */

import { digitalUseNodeManifest } from './node-manifest.js';
import type { DigitalUseNodeManifestEntry } from './types.js';

function findNode(nodeCode: string): DigitalUseNodeManifestEntry | null {
  return (
    (digitalUseNodeManifest as readonly DigitalUseNodeManifestEntry[]).find(
      (entry) => entry.nodeCode === nodeCode
    ) ?? null
  );
}

/**
 * A node whose Manifest entry mode is exactly `ROUTED` has no independent
 * re-entry path: the only way it may become active again is a routed edge.
 */
export function isRoutedOnlyNode(node: DigitalUseNodeManifestEntry): boolean {
  return (
    node.entryMode.length === 1 &&
    node.entryMode[0] === 'ROUTED' &&
    node.helpOrReentryRefs.length === 0
  );
}

export interface RoutedReactivationRequest {
  /** Node whose completion produced the incoming routed transition. */
  readonly sourceNodeCode: string;
  /** Already-COMPLETED node the route is entering again. */
  readonly targetNodeCode: string;
}

export interface RoutedReactivationDecision {
  readonly authorized: boolean;
  readonly reason:
    | 'AUTHORIZED_ROUTED_REACTIVATION'
    | 'TARGET_NOT_ROUTED_ONLY'
    | 'NO_MANIFEST_EDGE'
    | 'SINGLE_PREDECESSOR'
    | 'SELF_ROUTE';
}

/** Every Manifest NODE edge that targets `nodeCode`, in declaration order. */
export function manifestPredecessorsOf(nodeCode: string): readonly string[] {
  const sources: string[] = [];
  for (const node of digitalUseNodeManifest as readonly DigitalUseNodeManifestEntry[]) {
    if (
      node.allowedNext.some(
        (candidate) => candidate.kind === 'NODE' && candidate.targetNodeCode === nodeCode
      )
    ) {
      sources.push(node.nodeCode);
    }
  }
  return sources;
}

export function resolveRoutedReactivation(
  request: RoutedReactivationRequest
): RoutedReactivationDecision {
  if (request.sourceNodeCode === request.targetNodeCode) {
    return { authorized: false, reason: 'SELF_ROUTE' };
  }

  const target = findNode(request.targetNodeCode);
  if (target === null || !isRoutedOnlyNode(target)) {
    return { authorized: false, reason: 'TARGET_NOT_ROUTED_ONLY' };
  }

  // A single-predecessor ROUTED-only node is never reactivated here: its own
  // stream owns re-entry, and activating it again would only occur by rewinding
  // the one route that already ran.
  if (manifestPredecessorsOf(target.nodeCode).length < 2) {
    return { authorized: false, reason: 'SINGLE_PREDECESSOR' };
  }

  const source = findNode(request.sourceNodeCode);
  if (source === null) {
    return { authorized: false, reason: 'NO_MANIFEST_EDGE' };
  }

  const edge = source.allowedNext.some(
    (candidate) =>
      candidate.kind === 'NODE' && candidate.targetNodeCode === request.targetNodeCode
  );
  if (!edge) {
    return { authorized: false, reason: 'NO_MANIFEST_EDGE' };
  }

  return { authorized: true, reason: 'AUTHORIZED_ROUTED_REACTIVATION' };
}

export function authorizeRoutedReactivation(
  request: RoutedReactivationRequest
): boolean {
  return resolveRoutedReactivation(request).authorized;
}
