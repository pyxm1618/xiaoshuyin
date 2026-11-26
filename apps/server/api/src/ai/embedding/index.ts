import { createEmbeddingProviderPort } from './port.js';
import type { EmbeddingProviderDependencies, EmbeddingProviderFactoryConfig, EmbeddingProviderPort } from './port.js';

export type {
  EmbeddingItemResult,
  EmbeddingOutcome,
  EmbeddingOutputType,
  EmbeddingProviderPort,
  EmbeddingRequest,
  EmbeddingResult,
  ProviderModelEchoStatus,
  SparseEntry,
} from './port.js';
export type { EmbeddingErrorClass, EmbeddingErrorCode, EmbeddingFailure } from './errors.js';
export type { EmbeddingRuntimeConfig } from './config.js';
export { loadEmbeddingRuntimeConfig } from './config.js';
export type { EmbeddingTelemetryRecord, EmbeddingTelemetrySink } from './telemetry.js';
export type { CostRecord, EmbeddingUsage } from './cost.js';
export type {
  CapabilityEvidenceRecord,
  CapabilityEvidenceState,
  ExternalAvailabilityStatus,
  ExternalVerificationCoverageId,
  ProviderVerificationRecord,
} from './evidence.js';
export { deriveCapabilityEvidence } from './evidence.js';

export function createEmbeddingProvider(
  config: EmbeddingProviderFactoryConfig = {},
  deps: EmbeddingProviderDependencies = {},
): EmbeddingProviderPort {
  return createEmbeddingProviderPort(config, deps);
}
