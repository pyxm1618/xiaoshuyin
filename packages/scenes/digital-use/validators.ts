import type {
  DigitalUseNodeManifestEntry,
  DigitalUseValidationIssue,
  DigitalUseValidationResult,
} from './types.js';

const CANONICAL_NODE_COUNT = 75;
const FORBIDDEN_GAP_FILL_IDENTITIES = new Set(['A3023', 'A3030', 'A3031', 'A3032']);

export function normalizeDigitalUseSourceNodeCode(sourceNodeCode: string): string {
  return sourceNodeCode.trim().replace(/\s+/g, '');
}

function issue(code: string, detail: string, nodeCode?: string): DigitalUseValidationIssue {
  return nodeCode === undefined ? { code, detail } : { code, detail, nodeCode };
}

function isDefaultMarker(value: string): boolean {
  return /(^|[_\s-])default($|[_\s-])/i.test(value) || value.trim().toUpperCase() === 'DEFAULT';
}

export function validateDigitalUseManifest(
  manifest: readonly DigitalUseNodeManifestEntry[],
  expectedNodeCodes?: readonly string[]
): DigitalUseValidationResult {
  const issues: DigitalUseValidationIssue[] = [];
  const nodeCodes = manifest.map((node) => node.nodeCode);
  const nodeSet = new Set(nodeCodes);

  if (manifest.length !== CANONICAL_NODE_COUNT) {
    issues.push(issue('INVENTORY_COUNT', `expected ${CANONICAL_NODE_COUNT} nodes; found ${manifest.length}`));
  }

  const seenCodes = new Set<string>();
  const seenSources = new Map<string, string>();
  for (const node of manifest) {
    if (seenCodes.has(node.nodeCode)) {
      issues.push(issue('DUPLICATE_NODE_CODE', `duplicate nodeCode ${node.nodeCode}`, node.nodeCode));
    }
    seenCodes.add(node.nodeCode);

    const normalizedSource = normalizeDigitalUseSourceNodeCode(node.sourceNodeCode);
    const previous = seenSources.get(normalizedSource);
    if (previous !== undefined) {
      issues.push(issue('DUPLICATE_SOURCE_IDENTITY', `source identity ${normalizedSource} used by ${previous} and ${node.nodeCode}`, node.nodeCode));
    } else {
      seenSources.set(normalizedSource, node.nodeCode);
    }
    if (normalizedSource !== node.nodeCode) {
      issues.push(issue('SOURCE_ROUND_TRIP', `sourceNodeCode ${node.sourceNodeCode} normalizes to ${normalizedSource}, not ${node.nodeCode}`, node.nodeCode));
    }

    if (node.nodeCode === 'A200401') {
      issues.push(issue('A200401_IS_NOT_NODE', 'A200401 is record-contract semantics only', node.nodeCode));
    }
    if (FORBIDDEN_GAP_FILL_IDENTITIES.has(node.nodeCode)) {
      issues.push(issue('INVENTED_GAP_FILL_NODE', `${node.nodeCode} is an explicitly forbidden inferred identity`, node.nodeCode));
    }

    if (
      node.role.trim() === '' ||
      node.decisionSchemaRefs.length === 0 ||
      node.interactionRefs.length === 0 ||
      node.outputRefs.length === 0 ||
      node.recordContract.semantics.trim() === '' ||
      node.entryMode.length === 0 ||
      node.policyRefs.length === 0 ||
      node.authorityRefs.length === 0
    ) {
      issues.push(issue('MISSING_REQUIRED_FIELD', 'known canonical metadata field/reference is missing', node.nodeCode));
    }

    for (const route of node.allowedNext) {
      if (route.reasonCode.trim() === '' || route.reason.trim() === '') {
        issues.push(issue('MISSING_BRANCH_REASON', 'allowedNext branch requires explicit reason semantics', node.nodeCode));
      }
      if (route.conditionRef.trim() === '') {
        issues.push(issue('MISSING_CONDITION_REF', 'allowedNext branch requires explicit deterministic conditionRef', node.nodeCode));
      }
      if (isDefaultMarker(route.reasonCode) || isDefaultMarker(route.conditionRef)) {
        issues.push(issue('HIDDEN_DEFAULT_BRANCH', 'DEFAULT/fallthrough branch markers are forbidden', node.nodeCode));
      }
      if (route.kind === 'NODE' && !nodeSet.has(route.targetNodeCode)) {
        issues.push(issue('INVALID_NODE_TARGET', `route target ${route.targetNodeCode} is not a manifest node`, node.nodeCode));
      }
      if (route.kind === 'TERMINAL') {
        if (route.terminalCode.trim() === '' || !/^[A-Z][A-Z0-9_]*$/.test(route.terminalCode)) {
          issues.push(issue('INVALID_TERMINAL_TARGET', `invalid explicit terminal/external target ${route.terminalCode}`, node.nodeCode));
        }
        if (/^(?:A\d+|0\d+)$/.test(route.terminalCode)) {
          issues.push(issue('TERMINAL_LOOKS_LIKE_NODE', `terminal ${route.terminalCode} must not masquerade as a canonical node`, node.nodeCode));
        }
      }
    }
  }

  if (nodeCodes.filter((code) => code === 'A3033').length !== 1) {
    issues.push(issue('SPARSE_A3033_FIDELITY', 'A3033 must exist exactly once'));
  }
  if (!nodeSet.has('A5001') || !nodeSet.has('A5002')) {
    issues.push(issue('REVIEW_NODE_SEPARATION', 'A5001 and A5002 must both exist'));
  } else {
    const a5001 = manifest.find((node) => node.nodeCode === 'A5001');
    const a5002 = manifest.find((node) => node.nodeCode === 'A5002');
    if (a5001?.role === a5002?.role) {
      issues.push(issue('REVIEW_NODE_COLLAPSE', 'A5001 and A5002 must retain distinct review semantics'));
    }
  }

  if (expectedNodeCodes !== undefined) {
    const expected = new Set(expectedNodeCodes);
    for (const expectedCode of expected) {
      if (!nodeSet.has(expectedCode)) issues.push(issue('MISSING_CANONICAL_NODE', `missing canonical node ${expectedCode}`, expectedCode));
    }
    for (const actualCode of nodeSet) {
      if (!expected.has(actualCode)) issues.push(issue('EXTRA_CANONICAL_NODE', `extra/invented node ${actualCode}`, actualCode));
    }
  }

  return { valid: issues.length === 0, issues };
}


export interface DigitalUseGraphValidationResult extends DigitalUseValidationResult {
  readonly reachableNodeCodes: readonly string[];
  readonly orphanNodeCodes: readonly string[];
  readonly deadEndNodeCodes: readonly string[];
}

function nonLinearAnchorIsReachable(
  ref: string,
  reachable: ReadonlySet<string>
): boolean {
  const nodePrefix = /^(A\d+)/.exec(ref)?.[1];
  if (nodePrefix !== undefined) return reachable.has(nodePrefix);
  if (ref === 'TARGET_HELP_REENTRY') return reachable.has('A3002');
  if (ref === 'USER_TIMELINE' || ref === 'USER_TIMELINE_REVIEW') return reachable.has('A2007');
  if (ref === 'CONTRACT_PREPARATION_COMPLETE') return reachable.has('A4004');
  if (ref === 'CONTRACT_EXECUTION_SUPPORT') return reachable.has('A4010');
  return false;
}

/**
 * Typed reachability: routed edges + explicit parallel activation + traceable
 * USER_INITIATED/SCHEDULED/help/re-entry anchors. It never infers numeric
 * adjacency or fabricates an edge to make the graph pass.
 */
export function validateDigitalUseGraph(
  manifest: readonly DigitalUseNodeManifestEntry[],
  expectedNodeCodes?: readonly string[]
): DigitalUseGraphValidationResult {
  const structural = validateDigitalUseManifest(manifest, expectedNodeCodes);
  const issues = [...structural.issues];
  const nodeSet = new Set(manifest.map((node) => node.nodeCode));
  const reachable = new Set<string>();

  if (nodeSet.has('A1001')) reachable.add('A1001');

  let changed = true;
  while (changed) {
    changed = false;
    for (const node of manifest) {
      if (reachable.has(node.nodeCode)) {
        for (const route of node.allowedNext) {
          if (route.kind === 'NODE' && nodeSet.has(route.targetNodeCode) && !reachable.has(route.targetNodeCode)) {
            reachable.add(route.targetNodeCode);
            changed = true;
          }
        }
        for (const peer of node.canRunInParallelWith) {
          if (nodeSet.has(peer) && !reachable.has(peer)) {
            reachable.add(peer);
            changed = true;
          }
        }
      }

      if (!reachable.has(node.nodeCode)) {
        const hasNonLinearMode =
          node.entryMode.includes('USER_INITIATED') || node.entryMode.includes('SCHEDULED');
        const anchored = node.helpOrReentryRefs.some((ref) => nonLinearAnchorIsReachable(ref, reachable));
        if (hasNonLinearMode && anchored) {
          reachable.add(node.nodeCode);
          changed = true;
        }
      }
    }
  }

  const orphanNodeCodes = manifest
    .filter((node) => !reachable.has(node.nodeCode))
    .map((node) => node.nodeCode);

  for (const nodeCode of orphanNodeCodes) {
    issues.push(issue('ORPHAN_NODE', 'node has no routed, parallel, user/scheduled or help/re-entry reachability', nodeCode));
  }

  const deadEndNodeCodes = manifest
    .filter((node) => {
      if (!reachable.has(node.nodeCode)) return false;
      const hasExplicitExit = node.allowedNext.length > 0;
      const hasIntentionalNonLinearContinuation =
        node.helpOrReentryRefs.length > 0 &&
        (node.entryMode.includes('USER_INITIATED') || node.entryMode.includes('SCHEDULED'));
      const hasParallelSupport = node.canRunInParallelWith.length > 0;
      return !hasExplicitExit && !hasIntentionalNonLinearContinuation && !hasParallelSupport;
    })
    .map((node) => node.nodeCode);

  for (const nodeCode of deadEndNodeCodes) {
    issues.push(issue('ACCIDENTAL_DEAD_END', 'reachable non-terminal node has no approved onward/exit/re-entry semantics', nodeCode));
  }

  return {
    valid: issues.length === 0,
    issues,
    reachableNodeCodes: [...reachable].sort(),
    orphanNodeCodes,
    deadEndNodeCodes,
  };
}


export interface DigitalUseParallelExpectation {
  readonly left: string;
  readonly right: string;
  readonly semantics: string;
}

export function validateDigitalUseParallelFidelity(
  manifest: readonly DigitalUseNodeManifestEntry[],
  expectedRelations: readonly DigitalUseParallelExpectation[]
): DigitalUseValidationResult {
  const issues: DigitalUseValidationIssue[] = [];
  const byCode = new Map(manifest.map((node) => [node.nodeCode, node] as const));

  for (const relation of expectedRelations) {
    const left = byCode.get(relation.left);
    const right = byCode.get(relation.right);
    if (left === undefined || right === undefined) {
      issues.push(issue('MISSING_PARALLEL_NODE', `parallel relation references missing node: ${relation.left} / ${relation.right}`));
      continue;
    }
    if (!left.canRunInParallelWith.includes(relation.right)) {
      issues.push(issue('MISSING_PARALLEL_RELATION', `${relation.left} must run in parallel with ${relation.right}`, relation.left));
    }
    if (!right.canRunInParallelWith.includes(relation.left)) {
      issues.push(issue('ASYMMETRIC_PARALLEL_RELATION', `${relation.right} must reciprocally identify ${relation.left}`, relation.right));
    }
  }

  const a5001 = byCode.get('A5001');
  const a5002 = byCode.get('A5002');
  if (a5001?.stream !== 'FAMILY_ALLIANCE_REVIEW' || a5002?.stream !== 'PHONE_USE_CONTRACT_REVIEW') {
    issues.push(issue('REVIEW_STREAM_FIDELITY', 'A5001 and A5002 must review their distinct intervention streams'));
  }

  return { valid: issues.length === 0, issues };
}


export interface DigitalUseSnapshotRouteProjection {
  readonly kind: 'NODE' | 'TERMINAL';
  readonly targetNodeCode?: string;
  readonly terminalCode?: string;
  readonly conditionRef: string;
  readonly reasonCode: string;
}

export interface DigitalUseSnapshotNodeProjection {
  readonly nodeCode: string;
  readonly sourceNodeCode: string;
  readonly phase: string;
  readonly stream?: string;
  readonly role: string;
  readonly prerequisites: readonly string[];
  readonly inputSchemaRefs: readonly string[];
  readonly decisionSchemaRefs: readonly string[];
  readonly interactionRefs: readonly string[];
  readonly outputRefs: readonly string[];
  readonly recordContract: { readonly refs: readonly string[]; readonly semantics: string };
  readonly allowedNext: readonly DigitalUseSnapshotRouteProjection[];
  readonly canRunInParallelWith: readonly string[];
  readonly entryMode: readonly string[];
  readonly helpOrReentryRefs: readonly string[];
  readonly policyRefs: readonly string[];
  readonly authorityRefs: readonly string[];
}

export interface DigitalUseCanonicalSnapshotProjection {
  readonly nodes: readonly DigitalUseSnapshotNodeProjection[];
  readonly nonNodeMarkers: readonly { readonly code: string }[];
  readonly forbiddenGapFillNodeCodes: readonly string[];
  readonly parallelRelations: readonly DigitalUseParallelExpectation[];
}

function sameStringSet(actual: readonly string[], expected: readonly string[]): boolean {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

function containsAll(actual: readonly string[], expected: readonly string[]): boolean {
  const actualSet = new Set(actual);
  return expected.every((value) => actualSet.has(value));
}

function routeProjection(route: DigitalUseNodeManifestEntry['allowedNext'][number]): DigitalUseSnapshotRouteProjection {
  return route.kind === 'NODE'
    ? {
        kind: 'NODE',
        targetNodeCode: route.targetNodeCode,
        conditionRef: route.conditionRef,
        reasonCode: route.reasonCode,
      }
    : {
        kind: 'TERMINAL',
        terminalCode: route.terminalCode,
        conditionRef: route.conditionRef,
        reasonCode: route.reasonCode,
      };
}

/**
 * Snapshot comparison is test/review input only. This function accepts the
 * independent snapshot as an argument and never imports tests/fixtures.
 */
export function validateDigitalUseSnapshotFidelity(
  manifest: readonly DigitalUseNodeManifestEntry[],
  snapshot: DigitalUseCanonicalSnapshotProjection
): DigitalUseValidationResult {
  const base = validateDigitalUseManifest(manifest, snapshot.nodes.map((node) => node.nodeCode));
  const issues = [...base.issues];
  const byCode = new Map(manifest.map((node) => [node.nodeCode, node] as const));

  for (const expected of snapshot.nodes) {
    const actual = byCode.get(expected.nodeCode);
    if (actual === undefined) continue;

    if (actual.sourceNodeCode !== expected.sourceNodeCode) {
      issues.push(issue('SNAPSHOT_SOURCE_DRIFT', `sourceNodeCode drift for ${expected.nodeCode}`, expected.nodeCode));
    }
    if (actual.phase !== expected.phase || actual.stream !== expected.stream || actual.role !== expected.role) {
      issues.push(issue('SNAPSHOT_CLASSIFICATION_DRIFT', `phase/stream/role drift for ${expected.nodeCode}`, expected.nodeCode));
    }

    for (const [field, actualRefs, expectedRefs] of [
      ['prerequisites', actual.prerequisites, expected.prerequisites],
      ['inputSchemaRefs', actual.inputSchemaRefs, expected.inputSchemaRefs],
      ['decisionSchemaRefs', actual.decisionSchemaRefs, expected.decisionSchemaRefs],
      ['interactionRefs', actual.interactionRefs, expected.interactionRefs],
      ['outputRefs', actual.outputRefs, expected.outputRefs],
      ['policyRefs', actual.policyRefs, expected.policyRefs],
      ['authorityRefs', actual.authorityRefs, expected.authorityRefs],
    ] as const) {
      if (!containsAll(actualRefs, expectedRefs)) {
        issues.push(issue('SNAPSHOT_FIELD_DRIFT', `${field} lost expected semantic references`, expected.nodeCode));
      }
    }

    if (
      !sameStringSet(actual.recordContract.refs, expected.recordContract.refs) ||
      actual.recordContract.semantics !== expected.recordContract.semantics
    ) {
      issues.push(issue('SNAPSHOT_RECORD_DRIFT', 'record-contract semantics drifted', expected.nodeCode));
    }

    if (!sameStringSet(actual.canRunInParallelWith, expected.canRunInParallelWith)) {
      issues.push(issue('SNAPSHOT_PARALLEL_DRIFT', 'parallel relation projection drifted', expected.nodeCode));
    }
    if (!sameStringSet(actual.entryMode, expected.entryMode)) {
      issues.push(issue('SNAPSHOT_ENTRY_MODE_DRIFT', 'entry-mode projection drifted', expected.nodeCode));
    }
    if (!sameStringSet(actual.helpOrReentryRefs, expected.helpOrReentryRefs)) {
      issues.push(issue('SNAPSHOT_REENTRY_DRIFT', 'help/re-entry projection drifted', expected.nodeCode));
    }

    const actualRoutes = actual.allowedNext.map(routeProjection);
    const expectedRoutes = expected.allowedNext.map((route) =>
      route.kind === 'NODE'
        ? {
            kind: 'NODE' as const,
            targetNodeCode: route.targetNodeCode,
            conditionRef: route.conditionRef,
            reasonCode: route.reasonCode,
          }
        : {
            kind: 'TERMINAL' as const,
            terminalCode: route.terminalCode,
            conditionRef: route.conditionRef,
            reasonCode: route.reasonCode,
          }
    );
    if (JSON.stringify(actualRoutes) !== JSON.stringify(expectedRoutes)) {
      issues.push(issue('SNAPSHOT_ROUTE_DRIFT', 'allowedNext target/condition/reason projection drifted', expected.nodeCode));
    }
  }

  const parallel = validateDigitalUseParallelFidelity(manifest, snapshot.parallelRelations);
  issues.push(...parallel.issues);

  const nodeSet = new Set(manifest.map((node) => node.nodeCode));
  for (const marker of snapshot.nonNodeMarkers) {
    if (nodeSet.has(marker.code)) issues.push(issue('SNAPSHOT_NON_NODE_PROMOTED', `${marker.code} is explicitly non-node`, marker.code));
  }
  for (const forbidden of snapshot.forbiddenGapFillNodeCodes) {
    if (nodeSet.has(forbidden)) issues.push(issue('SNAPSHOT_FORBIDDEN_GAP_FILL', `${forbidden} is an invented gap-fill node`, forbidden));
  }

  return { valid: issues.length === 0, issues };
}
