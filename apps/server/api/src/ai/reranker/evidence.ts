import {
  RERANKER_API_SURFACE,
  RERANKER_IMMUTABLE_REVISION_PIN_STATUS,
  RERANKER_MODEL_ID,
  RERANKER_PROVIDER,
  type RerankerCapabilityConfig,
} from './config.js';

export const EVIDENCE_STATES = [
  'PASS',
  'FAIL',
  'BLOCKED',
  'UNKNOWN',
  'NOT_EVALUATED',
] as const;

export type EvidenceState = (typeof EVIDENCE_STATES)[number];

export const LOWER_EVIDENCE_PREDICATES = [
  'CONTRACT_MECHANICS',
  'LIVE_PROVIDER_CAPABILITY',
  'CONFIG_IDENTITY',
  'CLEANUP_SECRET_SAFETY',
] as const;

export type LowerEvidencePredicate = (typeof LOWER_EVIDENCE_PREDICATES)[number];

export type LowerEvidenceStates = {
  readonly CONTRACT_MECHANICS: EvidenceState;
  readonly LIVE_PROVIDER_CAPABILITY: EvidenceState;
  readonly CONFIG_IDENTITY: EvidenceState;
  readonly CLEANUP_SECRET_SAFETY: EvidenceState;
};

export type ContractMechanicsEvaluationInput =
  | { readonly executed: false; readonly blocked?: boolean }
  | { readonly executed: true; readonly allPassed: boolean; readonly interpretable?: boolean };

export type LiveVerificationProvenance = 'REAL_LIVE_CALL' | 'OFFLINE_MOCK' | 'NONE';

export type LiveCapabilityEvaluationInput =
  | { readonly attempted: false }
  | {
      readonly attempted: true;
      readonly provenance: LiveVerificationProvenance;
      readonly exactHeadBound: boolean;
      readonly exactConfigBound: boolean;
      readonly validAccess: boolean;
      readonly contractCompatible: boolean | null;
      readonly missingPrerequisite?: boolean;
    };

export type CleanupSecretSafetyEvaluationInput =
  | { readonly checkCompleted: false; readonly blocked?: boolean }
  | {
      readonly checkCompleted: true;
      readonly secretDetected: boolean;
      readonly rawContentDetected: boolean;
      readonly unauthorizedPersistenceDetected: boolean;
      readonly repoResidueDetected: boolean;
    };

export type TechnicalEvidenceEvaluationInput = {
  readonly contractMechanics: ContractMechanicsEvaluationInput;
  readonly liveProviderCapability: LiveCapabilityEvaluationInput;
  readonly config: Pick<
    RerankerCapabilityConfig,
    'provider' | 'modelId' | 'modelRevision' | 'immutableRevisionPinStatus' | 'apiSurface'
  >;
  readonly cleanupSecretSafety: CleanupSecretSafetyEvaluationInput;
};

export type TechnicalEvidenceReport = {
  readonly lowerPredicates: LowerEvidenceStates;
  readonly aggregateTechnicalResult: EvidenceState;
};

const ALLOWED_STATE_SET: ReadonlySet<string> = new Set(EVIDENCE_STATES);

function normalizeEvidenceState(value: unknown): EvidenceState {
  if (typeof value === 'string' && ALLOWED_STATE_SET.has(value)) {
    return value as EvidenceState;
  }
  return 'UNKNOWN';
}

/**
 * Purely derives the aggregate technical result from the four lower predicates.
 * Precedence: FAIL > BLOCKED > UNKNOWN > NOT_EVALUATED > PASS.
 * Never accepts or honors any manual READY override.
 */
export function deriveAggregateTechnicalResult(lower: LowerEvidenceStates): EvidenceState {
  const states = LOWER_EVIDENCE_PREDICATES.map((predicate) =>
    normalizeEvidenceState(lower[predicate]),
  );

  if (states.includes('FAIL')) {
    return 'FAIL';
  }
  if (states.includes('BLOCKED')) {
    return 'BLOCKED';
  }
  if (states.includes('UNKNOWN')) {
    return 'UNKNOWN';
  }
  if (states.includes('NOT_EVALUATED')) {
    return 'NOT_EVALUATED';
  }
  if (states.every((state) => state === 'PASS')) {
    return 'PASS';
  }

  return 'UNKNOWN';
}

/**
 * Derives CONTRACT_MECHANICS from offline contract/protocol/architecture suites only.
 */
export function deriveContractMechanicsState(
  input: ContractMechanicsEvaluationInput,
): EvidenceState {
  if (!input.executed) {
    return input.blocked ? 'BLOCKED' : 'NOT_EVALUATED';
  }
  if (input.interpretable === false) {
    return 'UNKNOWN';
  }
  return input.allPassed ? 'PASS' : 'FAIL';
}

/**
 * Derives LIVE_PROVIDER_CAPABILITY with strict provenance separation.
 * Offline/mock/synthetic fixtures can never produce PASS.
 */
export function deriveLiveProviderCapabilityState(
  input: LiveCapabilityEvaluationInput,
): EvidenceState {
  if (!input.attempted || input.provenance !== 'REAL_LIVE_CALL') {
    return 'NOT_EVALUATED';
  }
  if (input.missingPrerequisite || !input.validAccess) {
    return 'BLOCKED';
  }
  if (input.contractCompatible === false) {
    return 'FAIL';
  }
  if (input.contractCompatible === null || !input.exactHeadBound || !input.exactConfigBound) {
    return 'UNKNOWN';
  }
  return 'PASS';
}

/**
 * Derives CONFIG_IDENTITY for production-pinnability truthfulness.
 * While qwen3-rerank immutable revision remains UNKNOWN_NOT_DOCUMENTED (modelRevision === null),
 * CONFIG_IDENTITY must remain UNKNOWN and cannot be relabeled PASS.
 */
export function deriveConfigIdentityState(
  config: Pick<
    RerankerCapabilityConfig,
    'provider' | 'modelId' | 'modelRevision' | 'immutableRevisionPinStatus'
  > & { readonly apiSurface?: RerankerCapabilityConfig['apiSurface'] },
): EvidenceState {
  if (
    config.provider !== RERANKER_PROVIDER ||
    config.modelId !== RERANKER_MODEL_ID ||
    (config.apiSurface !== undefined && config.apiSurface !== RERANKER_API_SURFACE)
  ) {
    return 'FAIL';
  }

  if (
    config.modelRevision === null ||
    config.immutableRevisionPinStatus === RERANKER_IMMUTABLE_REVISION_PIN_STATUS
  ) {
    return 'UNKNOWN';
  }

  return 'PASS';
}

/**
 * Derives CLEANUP_SECRET_SAFETY from mechanical secret/content/persistence/residue checks.
 * Never defaults to PASS when checks were not completed.
 */
export function deriveCleanupSecretSafetyState(
  input: CleanupSecretSafetyEvaluationInput,
): EvidenceState {
  if (!input.checkCompleted) {
    return input.blocked ? 'BLOCKED' : 'UNKNOWN';
  }

  if (
    input.secretDetected ||
    input.rawContentDetected ||
    input.unauthorizedPersistenceDetected ||
    input.repoResidueDetected
  ) {
    return 'FAIL';
  }

  return 'PASS';
}

/**
 * Evaluates all four lower predicates and mechanically derives the aggregate technical result.
 */
export function evaluateTechnicalEvidence(
  input: TechnicalEvidenceEvaluationInput,
): TechnicalEvidenceReport {
  const lowerPredicates: LowerEvidenceStates = Object.freeze({
    CONTRACT_MECHANICS: deriveContractMechanicsState(input.contractMechanics),
    LIVE_PROVIDER_CAPABILITY: deriveLiveProviderCapabilityState(input.liveProviderCapability),
    CONFIG_IDENTITY: deriveConfigIdentityState(input.config),
    CLEANUP_SECRET_SAFETY: deriveCleanupSecretSafetyState(input.cleanupSecretSafety),
  });

  return Object.freeze({
    lowerPredicates,
    aggregateTechnicalResult: deriveAggregateTechnicalResult(lowerPredicates),
  });
}
