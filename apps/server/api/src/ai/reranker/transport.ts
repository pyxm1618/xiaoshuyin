import {
  RERANKER_MODEL_ID,
  RERANKER_PROVIDER,
  resolveDashScopeApiKey,
  type RerankerCapabilityConfig,
  type RerankerEnvReader,
} from './config.js';
import { RerankerTechnicalError, type RerankerErrorCode } from './errors.js';

export type RerankerFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type RerankerSleep = (ms: number) => Promise<void>;
export type RerankerSetTimer = (callback: () => void, ms: number) => unknown;
export type RerankerClearTimer = (handle: unknown) => void;

export type RerankerTransportDependencies = {
  readonly fetch?: RerankerFetch;
  readonly sleep?: RerankerSleep;
  readonly envReader?: RerankerEnvReader;
  readonly setTimer?: RerankerSetTimer;
  readonly clearTimer?: RerankerClearTimer;
};

export type RerankerTransportRequest = {
  readonly path: string;
  readonly body: unknown;
};

export type RerankerTransportResponse = {
  readonly status: number;
  readonly bodyText: string;
  readonly attempts: number;
  readonly providerRequestId?: string;
};

export interface RerankerTransport {
  readonly provider: typeof RERANKER_PROVIDER;
  readonly modelId: typeof RERANKER_MODEL_ID;
  send(request: RerankerTransportRequest): Promise<RerankerTransportResponse>;
}

const NON_RETRYABLE_ERROR_CODES = new Set<RerankerErrorCode>([
  'CONFIGURATION',
  'AUTHENTICATION',
  'AUTHORIZATION',
  'INVALID_INPUT',
  'UNSUPPORTED_CAPABILITY',
  'MALFORMED_RESPONSE',
  'IDENTITY_MAPPING_FAILURE',
  'PARTIAL_RESPONSE',
  'UNKNOWN_PROVIDER_FAILURE',
]);

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

/**
 * Reports whether an error code can ever be eligible for bounded transport retry.
 * Terminal categories and UNKNOWN_PROVIDER_FAILURE always return false.
 */
export function isRetryableRerankerErrorCode(code: RerankerErrorCode): boolean {
  return !NON_RETRYABLE_ERROR_CODES.has(code);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function buildValidatedEndpointUrl(baseUrl: string, path: string): string {
  if (
    typeof path !== 'string' ||
    !path.startsWith('/') ||
    path.includes('?') ||
    path.includes('#') ||
    path.includes('..') ||
    path.includes('://')
  ) {
    throw new RerankerTechnicalError({
      code: 'CONFIGURATION',
      retryable: false,
    });
  }
  return `${baseUrl}${path}`;
}

type ParsedErrorEnvelope = {
  readonly providerCode?: string;
  readonly providerRequestId?: string;
};

function parseSafeErrorEnvelope(bodyText: string, headers: Headers): ParsedErrorEnvelope {
  let providerCode: string | undefined;
  let providerRequestId: string | undefined;

  if (bodyText.length > 0) {
    try {
      const parsed: unknown = JSON.parse(bodyText);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        if (typeof record['code'] === 'string' && record['code'].trim().length > 0) {
          providerCode = record['code'].trim();
        }
        if (typeof record['request_id'] === 'string') {
          providerRequestId = record['request_id'];
        }
      }
    } catch {
      // Ignore unparseable error body; status-level classification handles it safely.
    }
  }

  if (providerRequestId === undefined) {
    const headerRequestId =
      headers.get('x-dashscope-request-id') ?? headers.get('request-id') ?? undefined;
    if (headerRequestId !== undefined) {
      providerRequestId = headerRequestId;
    }
  }

  return {
    ...(providerCode !== undefined ? { providerCode } : {}),
    ...(providerRequestId !== undefined ? { providerRequestId } : {}),
  };
}

function extractSafeSuccessRequestId(bodyText: string, headers: Headers): string | undefined {
  if (bodyText.length > 0) {
    try {
      const parsed: unknown = JSON.parse(bodyText);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const reqId = (parsed as Record<string, unknown>)['request_id'];
        if (typeof reqId === 'string' && reqId.trim().length > 0 && !/[\s\u0000-\u001f\u007f]/.test(reqId.trim())) {
          return reqId.trim();
        }
      }
    } catch {
      // Leave full response validation to T005 DashScope parser.
    }
  }

  const headerRequestId = headers.get('x-dashscope-request-id') ?? headers.get('request-id');
  if (
    typeof headerRequestId === 'string' &&
    headerRequestId.trim().length > 0 &&
    !/[\s\u0000-\u001f\u007f]/.test(headerRequestId.trim())
  ) {
    return headerRequestId.trim();
  }

  return undefined;
}

function createClassifiedError(
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

function classifyHttpFailure(
  status: number,
  bodyText: string,
  headers: Headers,
): RerankerTechnicalError {
  const { providerCode, providerRequestId } = parseSafeErrorEnvelope(bodyText, headers);

  if (status === 401 || providerCode === 'InvalidApiKey') {
    return createClassifiedError('AUTHENTICATION', false, providerRequestId);
  }

  if (status === 403 || providerCode === 'AccessDenied') {
    return createClassifiedError('AUTHORIZATION', false, providerRequestId);
  }

  if (status === 400 || providerCode === 'InvalidParameter') {
    return createClassifiedError('INVALID_INPUT', false, providerRequestId);
  }

  if (status === 404 || providerCode === 'ModelNotFound' || providerCode === 'NotFound') {
    return createClassifiedError('UNSUPPORTED_CAPABILITY', false, providerRequestId);
  }

  if (status === 429) {
    const isQuotaExhaustion =
      providerCode !== undefined &&
      (QUOTA_EXHAUSTION_CODES.has(providerCode) || /quota|budget|allocation/i.test(providerCode));
    const isTransientThrottle =
      !isQuotaExhaustion &&
      providerCode !== undefined &&
      TRANSIENT_THROTTLE_CODES.has(providerCode);

    return createClassifiedError('RATE_LIMIT', isTransientThrottle, providerRequestId);
  }

  if (
    status === 503 &&
    (providerCode === 'ServiceUnavailable' || providerCode === 'ModelUnavailable')
  ) {
    return createClassifiedError('PROVIDER_UNAVAILABLE', true, providerRequestId);
  }

  return createClassifiedError('UNKNOWN_PROVIDER_FAILURE', false, providerRequestId);
}

function isAbortError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * Creates a narrow, capability-specific native HTTP transport for the reranker adapter.
 * Enforces send-time Authorization construction, 10000ms per-attempt client deadline,
 * at most 2 total attempts, and 1000ms backoff before attempt 2.
 */
export function createRerankerTransport(
  config: RerankerCapabilityConfig,
  deps: RerankerTransportDependencies = {},
): RerankerTransport {
  const fetchFn: RerankerFetch = deps.fetch ?? globalThis.fetch;
  const sleepFn: RerankerSleep = deps.sleep ?? defaultSleep;
  const envReader: RerankerEnvReader = deps.envReader ?? ((name) => process.env[name]);
  const setTimer: RerankerSetTimer =
    deps.setTimer ?? ((callback, ms) => globalThis.setTimeout(callback, ms));
  const clearTimer: RerankerClearTimer =
    deps.clearTimer ?? ((handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>));

  return {
    provider: config.provider,
    modelId: config.modelId,

    async send(request: RerankerTransportRequest): Promise<RerankerTransportResponse> {
      const endpointUrl = buildValidatedEndpointUrl(config.baseUrl, request.path);
      // Secret is read lazily and Authorization header is constructed only at send time.
      const apiKey = resolveDashScopeApiKey(envReader);
      const serializedBody = JSON.stringify(request.body);

      let lastError: RerankerTechnicalError | undefined;

      for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
        const controller = new AbortController();
        let timedOut = false;
        const timerHandle = setTimer(() => {
          timedOut = true;
          controller.abort();
        }, config.attemptTimeoutMs);

        try {
          const response = await fetchFn(endpointUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: serializedBody,
            signal: controller.signal,
          });

          const bodyText = await response.text();
          if (response.ok) {
            const providerRequestId = extractSafeSuccessRequestId(bodyText, response.headers);
            return {
              status: response.status,
              bodyText,
              attempts: attempt,
              ...(providerRequestId !== undefined ? { providerRequestId } : {}),
            };
          }

          lastError = classifyHttpFailure(response.status, bodyText, response.headers);
        } catch (error) {
          if (timedOut || isAbortError(error)) {
            lastError = new RerankerTechnicalError({
              code: 'TIMEOUT',
              retryable: true,
            });
          } else {
            lastError = new RerankerTechnicalError({
              code: 'PROVIDER_UNAVAILABLE',
              retryable: true,
            });
          }
        } finally {
          clearTimer(timerHandle);
        }

        const canRetry =
          attempt < config.maxAttempts &&
          lastError.retryable &&
          isRetryableRerankerErrorCode(lastError.code);

        if (!canRetry) {
          throw lastError;
        }

        await sleepFn(config.retryBackoffMs);
      }

      throw (
        lastError ??
        new RerankerTechnicalError({
          code: 'UNKNOWN_PROVIDER_FAILURE',
          retryable: false,
        })
      );
    },
  };
}
