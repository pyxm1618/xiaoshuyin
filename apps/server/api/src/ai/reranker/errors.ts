export const RERANKER_ERROR_CODES = [
  'CONFIGURATION',
  'AUTHENTICATION',
  'AUTHORIZATION',
  'RATE_LIMIT',
  'TIMEOUT',
  'PROVIDER_UNAVAILABLE',
  'MALFORMED_RESPONSE',
  'UNSUPPORTED_CAPABILITY',
  'INVALID_INPUT',
  'IDENTITY_MAPPING_FAILURE',
  'PARTIAL_RESPONSE',
  'UNKNOWN_PROVIDER_FAILURE',
] as const;

export type RerankerErrorCode = (typeof RERANKER_ERROR_CODES)[number];

export type RerankerErrorMetadata = {
  readonly code: RerankerErrorCode;
  readonly retryable: boolean;
  readonly providerRequestId?: string;
};

export type RerankerErrorInput = {
  readonly code: RerankerErrorCode;
  readonly retryable: boolean;
  readonly providerRequestId?: string;
};

function sanitizeProviderRequestId(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  // Reject control characters or whitespace so request IDs cannot smuggle headers or log lines.
  if (/[\s\u0000-\u001f\u007f]/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

/**
 * Capability-local technical error for the reranker adapter.
 * Exposes only safe technical metadata (code, retryable, and safe providerRequestId).
 */
export class RerankerTechnicalError extends Error {
  readonly code: RerankerErrorCode;
  readonly retryable: boolean;
  readonly providerRequestId?: string;

  constructor(input: RerankerErrorInput) {
    super(input.code);
    this.name = 'RerankerTechnicalError';
    this.code = input.code;
    this.retryable = input.retryable;

    const safeRequestId = sanitizeProviderRequestId(input.providerRequestId);
    if (safeRequestId !== undefined) {
      this.providerRequestId = safeRequestId;
    }
  }
}

/**
 * Projects a RerankerTechnicalError into a frozen, log-safe metadata object.
 */
export function toSafeRerankerErrorMetadata(error: RerankerTechnicalError): RerankerErrorMetadata {
  const safeRequestId = sanitizeProviderRequestId(error.providerRequestId);
  return Object.freeze({
    code: error.code,
    retryable: error.retryable,
    ...(safeRequestId !== undefined ? { providerRequestId: safeRequestId } : {}),
  });
}
