/**
 * Digital Use vertical lifecycle authority.
 *
 * Case phase is Common Core coarse business-progress truth. Scene manifest
 * phase metadata is descriptive and must never become a second Case phase
 * machine. This seam therefore expresses only the minimum Common Core phase
 * required by each Digital Use lifecycle cohort and keeps later phases legal.
 */
import type pg from 'pg';
import {
  isProblemFormulationAuthoritativeExecutionBasis,
  lockCurrentProblemFormulation,
  type SceneCaseRow,
} from '@xiaoshuyin/domain';
import type { DigitalUseNodeManifestEntry } from '@xiaoshuyin/scenes/digital-use';

const CASE_PHASE_ORDER = [
  'INTAKE',
  'ASSESSMENT',
  'PROBLEM_FORMULATION',
  'GOALS',
  'PLANNING',
  'EXECUTION',
  'REVIEW',
  'MAINTENANCE',
  'CLOSED',
] as const;

type CasePhase = (typeof CASE_PHASE_ORDER)[number];

const FORMULATION_FLOW_NODES = new Set([
  'A2003',
  'A2004',
  'A2005',
  'A2006',
  'A2007',
  'A2008',
  'A2009',
  'A2010',
]);

function lifecycleError(code: string): never {
  throw Object.assign(new Error(code), { code });
}

/**
 * Streams whose business progress requires the Case to have reached GOALS.
 *
 * The `*_REVIEW` cohorts are the authoritative Manifest review streams
 * (A5001 / A5002). They are real stream identities and must be recognised
 * here directly: callers may never substitute a sibling stream identity to
 * obtain the required minimum phase.
 */
const GOALS_MINIMUM_STREAMS = new Set([
  'FAMILY_ALLIANCE',
  'PHONE_USE_CONTRACT',
  'FAMILY_ALLIANCE_REVIEW',
  'PHONE_USE_CONTRACT_REVIEW',
]);

export function minimumDigitalUseCasePhase(
  node: Pick<DigitalUseNodeManifestEntry, 'nodeCode' | 'stream'>
): 'ASSESSMENT' | 'PROBLEM_FORMULATION' | 'GOALS' {
  if (node.stream !== undefined && GOALS_MINIMUM_STREAMS.has(node.stream)) {
    return 'GOALS';
  }
  if (FORMULATION_FLOW_NODES.has(node.nodeCode)) {
    return 'PROBLEM_FORMULATION';
  }
  return 'ASSESSMENT';
}

export function isCasePhaseAtLeast(
  actual: CasePhase,
  minimum: CasePhase
): boolean {
  return CASE_PHASE_ORDER.indexOf(actual) >= CASE_PHASE_ORDER.indexOf(minimum);
}

export function assertDigitalUseCaseLifecycle(
  caseRow: Pick<SceneCaseRow, 'status' | 'phase' | 'is_primary' | 'version'>,
  node: Pick<DigitalUseNodeManifestEntry, 'nodeCode' | 'stream'>,
  expectedCaseVersion: number
): void {
  if (caseRow.status === 'CLOSED') lifecycleError('CASE_CLOSED');
  if (caseRow.status === 'SAFETY_HOLD') lifecycleError('SAFETY_HOLD_BLOCKED');
  if (caseRow.status !== 'OPEN') lifecycleError('CASE_NOT_OPEN');
  if (!caseRow.is_primary) lifecycleError('CASE_NOT_PRIMARY');
  if (caseRow.version !== expectedCaseVersion) lifecycleError('STALE_CASE_VERSION');

  const minimum = minimumDigitalUseCasePhase(node);
  if (!isCasePhaseAtLeast(caseRow.phase, minimum)) {
    lifecycleError('CASE_PHASE_CONFLICT');
  }
}

/**
 * Shared stream gate. Family Alliance and Phone Use Contract both require the
 * same current CONFIRMED Problem Formulation authority, independent of their
 * parallel Scene progression.
 */
export async function assertCurrentDigitalUseProblemFormulation(
  tx: pg.PoolClient,
  caseId: string
) {
  const formulation = await lockCurrentProblemFormulation(tx, caseId);
  if (
    !formulation ||
    !isProblemFormulationAuthoritativeExecutionBasis(formulation)
  ) {
    lifecycleError('PROBLEM_FORMULATION_REQUIRED');
  }
  return formulation;
}
