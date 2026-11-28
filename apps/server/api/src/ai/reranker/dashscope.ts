import { RERANKER_MODEL_ID } from './config.js';
import type { RerankCandidateInput, RerankRequest } from './contracts.js';
import { RerankerTechnicalError, type RerankerErrorCode } from './errors.js';
import type { RerankerTransport, RerankerTransportRequest } from './transport.js';

export const DASHSCOPE_TEXT_RERANK_PATH = '/services/rerank/text-rerank/text-rerank' as const;

export type DashScopeRerankRequestBody = {
  readonly model: typeof RERANKER_MODEL_ID;
  readonly input: {
    readonly query: string;
    readonly documents: readonly string[];
  };
  readonly parameters: {
    readonly top_n: number;
    readonly return_documents: false;
    readonly instruct: string;
  };
};

export type DashScopeParsedResultItem = {
  readonly index: number;
  readonly candidateId: string;
  readonly score: number;
};

export type DashScopeParsedRerankResponse = {
  readonly requestId: string;
  readonly usage: {
    readonly totalTokens: number;
  };
  readonly results: readonly DashScopeParsedResultItem[];
};

const TRANSIENT_THROTTLE_CODES = new Set<string>([
  'Throttling',
  'TooManyRequests',
  'RateLimitExceeded',
  'ConcurrencyLimitExceeded',
  'BurstLimitExceeded',
]);

const QUOTA_EXHAUSTION_CODES = new Set<string>([
  'AllocationQuota',
  'QuotaExhausted',
  'BudgetExhausted',
  'InsufficientBalance',
  'Throttling.AllocationQuota',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function protocolError(
  code: RerankerErrorCode,
  retryable: boolean,
  providerRequestId?: string,
): RerankerTechnicalError {
  return new RerankerTechnicalError({
    code,
    retryable,
    ...(providerRequestId !== undefined ? { providerRequestId } : {}),
  });
}

/**
 * Projects a provider-neutral RerankRequest into the native DashScope qwen3-rerank payload.
 * Never includes caller candidateId values or runtime config/override fields.
 */
export function buildDashScopeRerankRequestBody(request: RerankRequest): DashScopeRerankRequestBody {
  return {
    model: RERANKER_MODEL_ID,
    input: {
      query: request.query,
      documents: request.candidates.map((candidate) => candidate.candidateText),
    },
    parameters: {
      top_n: request.candidates.length,
      return_documents: false,
      instruct: request.options.instruct,
    },
  };
}

/**
 * Builds the narrow transport request for the DashScope native text-rerank endpoint.
 */
export function buildDashScopeRerankTransportRequest(
  request: RerankRequest,
): RerankerTransportRequest {
  return {
    path: DASHSCOPE_TEXT_RERANK_PATH,
    body: buildDashScopeRerankRequestBody(request),
  };
}

/**
 * Strictly parses the native DashScope text-rerank JSON response.
 * Fails closed on malformed envelopes, non-finite/out-of-range/non-descending scores,
 * invalid or duplicate provider indices, or partial candidate coverage.
 */
export function parseDashScopeRerankResponse(
  bodyText: string,
  candidates: readonly RerankCandidateInput[],
): DashScopeParsedRerankResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw protocolError('MALFORMED_RESPONSE', false);
  }

  if (!isPlainObject(parsed)) {
    throw protocolError('MALFORMED_RESPONSE', false);
  }

  const rawRequestId = parsed['request_id'];
  if (typeof rawRequestId !== 'string' || rawRequestId.trim().length === 0) {
    throw protocolError('MALFORMED_RESPONSE', false);
  }
  const requestId = rawRequestId.trim();

  const rawUsage = parsed['usage'];
  if (!isPlainObject(rawUsage)) {
    throw protocolError('MALFORMED_RESPONSE', false, requestId);
  }
  const totalTokens = rawUsage['total_tokens'];
  if (typeof totalTokens !== 'number' || !Number.isInteger(totalTokens) || totalTokens < 0) {
    throw protocolError('MALFORMED_RESPONSE', false, requestId);
  }

  const rawOutput = parsed['output'];
  if (!isPlainObject(rawOutput) || !Array.isArray(rawOutput['results'])) {
    throw protocolError('MALFORMED_RESPONSE', false, requestId);
  }

  const rawResults: readonly unknown[] = rawOutput['results'];
  const candidateCount = candidates.length;
  const seenIndices = new Set<number>();
  const parsedItems: DashScopeParsedResultItem[] = [];
  let previousScore: number | undefined;

  for (const item of rawResults) {
    if (!isPlainObject(item)) {
      throw protocolError('MALFORMED_RESPONSE', false, requestId);
    }

    const score = item['relevance_score'];
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1) {
      throw protocolError('MALFORMED_RESPONSE', false, requestId);
    }

    if (previousScore !== undefined && score > previousScore) {
      throw protocolError('MALFORMED_RESPONSE', false, requestId);
    }
    previousScore = score;

    const index = item['index'];
    if (
      typeof index !== 'number' ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= candidateCount
    ) {
      throw protocolError('IDENTITY_MAPPING_FAILURE', false, requestId);
    }

    if (seenIndices.has(index)) {
      throw protocolError('IDENTITY_MAPPING_FAILURE', false, requestId);
    }
    seenIndices.add(index);

    const candidate = candidates[index];
    if (candidate === undefined) {
      throw protocolError('IDENTITY_MAPPING_FAILURE', false, requestId);
    }

    parsedItems.push({
      index,
      candidateId: candidate.candidateId,
      score,
    });
  }

  if (parsedItems.length < candidateCount || seenIndices.size < candidateCount) {
    throw protocolError('PARTIAL_RESPONSE', false, requestId);
  }

  return {
    requestId,
    usage: {
      totalTokens,
    },
    results: parsedItems,
  };
}

/**
 * Normalizes a non-OK DashScope HTTP response into the capability-local technical error taxonomy.
 * Reads code/message/request_id safely without exposing raw body or message text in error metadata.
 */
export function normalizeDashScopeError(
  status: number,
  bodyText: string,
  headers?: Headers,
): RerankerTechnicalError {
  let providerCode: string | undefined;
  let providerRequestId: string | undefined;

  if (bodyText.length > 0) {
    try {
      const parsed: unknown = JSON.parse(bodyText);
      if (isPlainObject(parsed)) {
        if (typeof parsed['code'] === 'string' && parsed['code'].trim().length > 0) {
          providerCode = parsed['code'].trim();
        }
        // Read message only to ensure it is never forwarded into public error metadata.
        void parsed['message'];
        if (typeof parsed['request_id'] === 'string') {
          providerRequestId = parsed['request_id'];
        }
      }
    } catch {
      // Unparseable error body falls back to HTTP status classification.
    }
  }

  if (providerRequestId === undefined && headers !== undefined) {
    providerRequestId =
      headers.get('x-dashscope-request-id') ?? headers.get('request-id') ?? undefined;
  }

  if (status === 401 || providerCode === 'InvalidApiKey') {
    return protocolError('AUTHENTICATION', false, providerRequestId);
  }

  if (status === 403 || providerCode === 'AccessDenied') {
    return protocolError('AUTHORIZATION', false, providerRequestId);
  }

  if (status === 400 || providerCode === 'InvalidParameter') {
    return protocolError('INVALID_INPUT', false, providerRequestId);
  }

  if (status === 404 || providerCode === 'ModelNotFound' || providerCode === 'NotFound') {
    return protocolError('UNSUPPORTED_CAPABILITY', false, providerRequestId);
  }

  if (status === 429) {
    const isQuotaExhaustion =
      providerCode !== undefined &&
      (QUOTA_EXHAUSTION_CODES.has(providerCode) || /quota|budget|allocation/i.test(providerCode));
    const isTransientThrottle =
      !isQuotaExhaustion &&
      providerCode !== undefined &&
      TRANSIENT_THROTTLE_CODES.has(providerCode);

    return protocolError('RATE_LIMIT', isTransientThrottle, providerRequestId);
  }

  if (
    status === 503 &&
    (providerCode === 'ServiceUnavailable' || providerCode === 'ModelUnavailable')
  ) {
    return protocolError('PROVIDER_UNAVAILABLE', true, providerRequestId);
  }

  return protocolError('UNKNOWN_PROVIDER_FAILURE', false, providerRequestId);
}

/**
 * Executes the DashScope native protocol round-trip using the injected transport
 * and returns the strictly parsed internal provider response for T006 orchestration.
 */
export async function executeDashScopeRerank(
  request: RerankRequest,
  transport: RerankerTransport,
): Promise<DashScopeParsedRerankResponse> {
  const transportRequest = buildDashScopeRerankTransportRequest(request);
  const response = await transport.send(transportRequest);
  return parseDashScopeRerankResponse(response.bodyText, request.candidates);
}
