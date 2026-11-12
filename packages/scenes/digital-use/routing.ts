import { digitalUseNodeManifest } from './node-manifest.js';
import {
  DIGITAL_USE_PACKAGE_VERSION,
  DIGITAL_USE_SCENE_CODE,
  type DigitalUseAllowedNext,
  type DigitalUseEvidenceBasisCategory,
  type DigitalUseRoutingInput,
  type DigitalUseRoutingResult,
} from './types.js';

const DURATION_ONLY_BASIS = new Set<DigitalUseEvidenceBasisCategory>([
  'TOTAL_DURATION',
  'HISTORICAL_DURATION_BAND',
]);

function hasIntegratedEvidenceBasis(
  basis: readonly DigitalUseEvidenceBasisCategory[] | undefined
): boolean {
  return basis !== undefined && basis.some((category) => !DURATION_ONLY_BASIS.has(category));
}

function routeConditionIsIntegrated(conditionRef: string): boolean {
  return conditionRef.startsWith('TRIAGE_') && conditionRef.endsWith('_INTEGRATED');
}

function priorityConditionFor(currentNodeCode: string): string | null {
  if (currentNodeCode === '01002') return 'EMOTION_SEVERE_F';
  if (currentNodeCode === '01003') return 'FAMILY_CONFLICT_SEVERE_F';
  return null;
}

function conditionState(
  input: DigitalUseRoutingInput,
  route: DigitalUseAllowedNext
): boolean | 'UNKNOWN' | 'NOT_COLLECTED' | 'DECLINED' | 'CONFLICT' | undefined {
  return input.conditions[route.conditionRef];
}

function conditionStateIsUnresolved(
  state: ReturnType<typeof conditionState>
): state is 'UNKNOWN' | 'NOT_COLLECTED' | 'DECLINED' | 'CONFLICT' {
  return state === 'UNKNOWN' || state === 'NOT_COLLECTED' || state === 'DECLINED' || state === 'CONFLICT';
}

/**
 * Pure topology routing only.
 *
 * A returned NODE_ROUTE/TERMINAL_ROUTE means only that the destination is an
 * approved topology outcome for the supplied already-authorized condition
 * state. Authorization, Consent, Safety, Compliance, identity/RLS and Case
 * phase guards remain independent consumer responsibilities.
 */
export function routeDigitalUseTopology(
  input: DigitalUseRoutingInput
): DigitalUseRoutingResult {
  if (
    input.sceneCode !== DIGITAL_USE_SCENE_CODE ||
    input.packageVersion !== DIGITAL_USE_PACKAGE_VERSION
  ) {
    return {
      kind: 'UNKNOWN',
      authority: 'TOPOLOGY_ONLY',
      code: 'PACKAGE_MISMATCH',
      packageVersion: DIGITAL_USE_PACKAGE_VERSION,
    };
  }

  const node = digitalUseNodeManifest.find((candidate) => candidate.nodeCode === input.currentNodeCode);
  if (node === undefined) {
    return {
      kind: 'UNKNOWN',
      authority: 'TOPOLOGY_ONLY',
      fromNodeCode: input.currentNodeCode,
      code: 'UNKNOWN_NODE',
      packageVersion: DIGITAL_USE_PACKAGE_VERSION,
    };
  }

  const priorityRef = priorityConditionFor(node.nodeCode);
  const priorityRoute =
    priorityRef === null
      ? undefined
      : node.allowedNext.find((route) => route.conditionRef === priorityRef);
  const priorityState =
    priorityRoute === undefined ? undefined : conditionState(input, priorityRoute);

  if (conditionStateIsUnresolved(priorityState)) {
    return {
      kind: 'UNKNOWN',
      authority: 'TOPOLOGY_ONLY',
      fromNodeCode: node.nodeCode,
      code: 'UNKNOWN_OR_UNSUPPORTED_CONDITION',
      packageVersion: DIGITAL_USE_PACKAGE_VERSION,
    };
  }

  const priorityMatched = priorityState === true;
  const candidateRoutes = priorityMatched
    ? node.allowedNext.filter((route) => route.conditionRef === priorityRef)
    : node.allowedNext;

  const matched = candidateRoutes.filter((route) => conditionState(input, route) === true);

  if (matched.length > 1) {
    return {
      kind: 'BLOCKED',
      authority: 'TOPOLOGY_ONLY',
      fromNodeCode: node.nodeCode,
      code: 'AMBIGUOUS_ROUTE',
      packageVersion: DIGITAL_USE_PACKAGE_VERSION,
    };
  }

  const selected = matched[0];
  if (selected !== undefined) {
    if (routeConditionIsIntegrated(selected.conditionRef) && !hasIntegratedEvidenceBasis(input.evidenceBasis)) {
      return {
        kind: 'BLOCKED',
        authority: 'TOPOLOGY_ONLY',
        fromNodeCode: node.nodeCode,
        code: 'INSUFFICIENT_INTEGRATED_EVIDENCE',
        packageVersion: DIGITAL_USE_PACKAGE_VERSION,
      };
    }

    if (selected.kind === 'NODE') {
      return {
        kind: 'NODE_ROUTE',
        authority: 'TOPOLOGY_ONLY',
        fromNodeCode: node.nodeCode,
        nextNodeCode: selected.targetNodeCode,
        reasonCode: selected.reasonCode,
        packageVersion: DIGITAL_USE_PACKAGE_VERSION,
      };
    }
    return {
      kind: 'TERMINAL_ROUTE',
      authority: 'TOPOLOGY_ONLY',
      fromNodeCode: node.nodeCode,
      terminalCode: selected.terminalCode,
      reasonCode: selected.reasonCode,
      packageVersion: DIGITAL_USE_PACKAGE_VERSION,
    };
  }

  const unresolved = candidateRoutes.some((route) => {
    const state = conditionState(input, route);
    return state === 'UNKNOWN' || state === 'NOT_COLLECTED' || state === 'DECLINED' || state === 'CONFLICT';
  });
  if (unresolved) {
    return {
      kind: 'UNKNOWN',
      authority: 'TOPOLOGY_ONLY',
      fromNodeCode: node.nodeCode,
      code: 'UNKNOWN_OR_UNSUPPORTED_CONDITION',
      packageVersion: DIGITAL_USE_PACKAGE_VERSION,
    };
  }

  return {
    kind: 'BLOCKED',
    authority: 'TOPOLOGY_ONLY',
    fromNodeCode: node.nodeCode,
    code: 'NO_APPROVED_ROUTE',
    packageVersion: DIGITAL_USE_PACKAGE_VERSION,
  };
}
