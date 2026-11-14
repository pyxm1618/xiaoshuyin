import { digitalUseNodeManifest } from './node-manifest.js';
import { DIGITAL_USE_PACKAGE_VERSION } from './types.js';

export type RuntimeEvidenceRef = {
  type: 'DIALOGUE_MESSAGE' | 'ASSERTION' | 'OBSERVATION';
  id: string;
};
export type RuntimeSceneRef =
  | RuntimeEvidenceRef
  | { type: 'SCENE_ARTIFACT'; id: string }
  | { type: 'RECORD_MARKER'; markerCode: 'A200401'; evidenceRefs: RuntimeEvidenceRef[] };

function runtimeError(code: string): never {
  throw Object.assign(new Error(code), { code });
}

/**
 * Consume the one Slice 11 manifest; this module is never a second registry.
 */
export function resolveDigitalUseRuntimeNode(nodeCode: string) {
  if (nodeCode === 'A200401') runtimeError('SCENE_NODE_NOT_FOUND');
  const node = digitalUseNodeManifest.find((entry) => entry.nodeCode === nodeCode);
  if (!node) runtimeError('SCENE_NODE_NOT_FOUND');
  return node;
}

export function assertRuntimePackageVersion(packageVersion: string): void {
  if (packageVersion !== DIGITAL_USE_PACKAGE_VERSION) {
    runtimeError('SCENE_PACKAGE_MISMATCH');
  }
}

export function buildA200401RecordMarker(
  evidenceRefs: readonly RuntimeEvidenceRef[]
): RuntimeSceneRef {
  if (evidenceRefs.length === 0) runtimeError('SCENE_RESPONSE_INVALID');
  const seen = new Set<string>();
  for (const ref of evidenceRefs) {
    const key=`${ref.type}:${ref.id}`;
    if (seen.has(key)) runtimeError('SCENE_RESPONSE_INVALID');
    seen.add(key);
  }
  return {
    type: 'RECORD_MARKER',
    markerCode: 'A200401',
    evidenceRefs: [...evidenceRefs],
  };
}

export function buildTimelineArtifactData(
  userTimelineInput: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  if (Object.keys(userTimelineInput).length === 0) {
    runtimeError('SCENE_RESPONSE_INVALID');
  }
  return Object.freeze({
    timeline: structuredClone(userTimelineInput),
    followUpBasis: {
      kind: 'DRAFT_ONLY',
      schedulerCreated: false,
      notificationScheduled: false,
      notificationDelivered: false,
    },
  });
}

export function buildSolutionSummaryArtifactData(input: {
  timelineArtifactId: string;
  timelineData: Readonly<Record<string, unknown>>;
}): Readonly<Record<string, unknown>> {
  if (!input.timelineArtifactId) runtimeError('SCENE_RESPONSE_INVALID');
  return Object.freeze({
    derivedFromTimelineArtifactId: input.timelineArtifactId,
    timeline: structuredClone(input.timelineData),
    activation: {
      activePlan: false,
      interventionActive: false,
      executionActive: false,
    },
    downstream: buildA2010DownstreamBoundary(),
  });
}

export function buildA2010DownstreamBoundary() {
  return Object.freeze({
    routeIntent: 'A3000',
    available: false,
    reasonCode: 'DOWNSTREAM_RUNTIME_UNAVAILABLE',
  });
}

export function validateRuntimeSceneRefs(
  refs: readonly RuntimeSceneRef[]
): boolean {
  const top = new Set<string>();
  for (const ref of refs) {
    if (ref.type === 'RECORD_MARKER') {
      if (ref.markerCode !== 'A200401' || ref.evidenceRefs.length === 0) return false;
      const nested = new Set<string>();
      for (const evidence of ref.evidenceRefs) {
        if (!evidence.id) return false;
        const key=`${evidence.type}:${evidence.id}`;
        if (nested.has(key)) return false;
        nested.add(key);
      }
      continue;
    }
    if (!ref.id) return false;
    const key=`${ref.type}:${ref.id}`;
    if (top.has(key)) return false;
    top.add(key);
  }
  return true;
}

export function initialA1001Projection() {
  const node=resolveDigitalUseRuntimeNode('A1001');
  return Object.freeze({
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    nodeCode: node.nodeCode,
    sourceNodeCode: node.sourceNodeCode,
    status: 'AVAILABLE' as const,
    revision: 1,
  });
}
