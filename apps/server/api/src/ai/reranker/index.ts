import type { RerankRequest, RerankResult } from './contracts.js';
import {
  createReranker as createInternalReranker,
  rerank as executeInternalRerank,
  type CreateRerankerOptions,
  type RerankPort,
} from './rerank.js';

export {
  MAX_RERANK_CANDIDATES,
  validateRerankRequest,
  type RerankCandidateInput,
  type RerankCandidateResult,
  type RerankInputValidationFailureReason,
  type RerankInputValidationResult,
  type RerankRequest,
  type RerankResult,
} from './contracts.js';

export {
  RERANKER_ERROR_CODES,
  RerankerTechnicalError,
  toSafeRerankerErrorMetadata,
  type RerankerErrorCode,
  type RerankerErrorMetadata,
} from './errors.js';

export type { CreateRerankerOptions, RerankPort };

/**
 * Creates a provider-neutral reranker capability instance.
 */
export function createReranker(options: CreateRerankerOptions): RerankPort {
  return createInternalReranker(options);
}

/**
 * Executes a stateless rerank capability call.
 */
export function rerank(
  request: RerankRequest,
  options: CreateRerankerOptions,
): Promise<RerankResult> {
  return executeInternalRerank(request, options);
}
