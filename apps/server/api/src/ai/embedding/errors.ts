import type { CapabilityEvidenceRecord } from './evidence.js';

export type EmbeddingErrorClass = 'BLOCKED' | 'UNSUPPORTED' | 'RETRYABLE' | 'TERMINAL';

export type EmbeddingErrorCode =
  | 'INVALID_REQUEST'
  | 'OUTPUT_TYPE_INVALID'
  | 'ENDPOINT_NOT_ALLOWED'
  | 'CONFIG_MISSING'
  | 'CONFIG_INVALID'
  | 'SECRET_MISSING'
  | 'COST_LIMIT_REACHED'
  | 'OUTPUT_TYPE_UNSUPPORTED'
  | 'SPARSE_NOT_RETURNED'
  | 'AUTH_TERMINAL'
  | 'REQUEST_REJECTED'
  | 'DENSE_INVALID_VALUE'
  | 'DIMENSION_MISMATCH'
  | 'DENSE_CARDINALITY_MISMATCH'
  | 'SPARSE_MALFORMED'
  | 'SPARSE_INDEX_INVALID'
  | 'SPARSE_INDEX_DUPLICATE'
  | 'SPARSE_VALUE_INVALID'
  | 'SPARSE_LIMIT_EXCEEDED'
  | 'RESPONSE_MALFORMED'
  | 'MALFORMED_PROVIDER_RESPONSE'
  | 'AMBIGUOUS_PROVIDER_RESPONSE'
  | 'MODEL_ECHO_MISMATCH'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT'
  | 'RETRY_EXHAUSTED'
  | 'DEADLINE_EXCEEDED'
  | 'ABORTED';

export type EmbeddingFinalCause =
  | 'NOT_RETRYABLE'
  | 'RETRY_EXHAUSTED'
  | 'DEADLINE_EXCEEDED'
  | 'RETRY_AFTER_EXCEEDS_BUDGET'
  | 'CANCELLED';

export interface EmbeddingFailure {
  readonly requestId: string;
  readonly providerRequestId: string | 'NOT_PROVIDED';
  readonly errorClass: EmbeddingErrorClass;
  readonly errorCode: EmbeddingErrorCode;
  readonly attempts: number;
  readonly finalCause: EmbeddingFinalCause;
  readonly capabilityEvidence: CapabilityEvidenceRecord;
}

export interface InternalProblem {
  readonly errorClass: EmbeddingErrorClass;
  readonly errorCode: EmbeddingErrorCode;
  readonly providerRequestId?: string;
  readonly retryAfterMs?: number;
}

export function makeFailure(input: {
  readonly requestId: string;
  readonly providerRequestId?: string;
  readonly errorClass: EmbeddingErrorClass;
  readonly errorCode: EmbeddingErrorCode;
  readonly attempts: number;
  readonly finalCause: EmbeddingFinalCause;
  readonly capabilityEvidence: CapabilityEvidenceRecord;
}): EmbeddingFailure {
  return Object.freeze({
    requestId: input.requestId,
    providerRequestId: input.providerRequestId ?? 'NOT_PROVIDED',
    errorClass: input.errorClass,
    errorCode: input.errorCode,
    attempts: input.attempts,
    finalCause: input.finalCause,
    capabilityEvidence: input.capabilityEvidence,
  });
}

function providerRequestId(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const value = (body as Record<string, unknown>)['request_id'];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function classifyHttpFailure(status: number, body: unknown): InternalProblem {
  const id = providerRequestId(body);
  if (status === 401 || status === 403) {
    return { errorClass: 'TERMINAL', errorCode: 'AUTH_TERMINAL', ...(id ? { providerRequestId: id } : {}) };
  }
  if (status === 429) {
    return { errorClass: 'RETRYABLE', errorCode: 'RATE_LIMITED', ...(id ? { providerRequestId: id } : {}) };
  }
  if (status >= 500 && status <= 599) {
    return { errorClass: 'RETRYABLE', errorCode: 'PROVIDER_UNAVAILABLE', ...(id ? { providerRequestId: id } : {}) };
  }
  if (status >= 400 && status <= 499) {
    return { errorClass: 'TERMINAL', errorCode: 'REQUEST_REJECTED', ...(id ? { providerRequestId: id } : {}) };
  }
  return { errorClass: 'TERMINAL', errorCode: 'RESPONSE_MALFORMED', ...(id ? { providerRequestId: id } : {}) };
}
