import type { RerankResult } from './contracts.js';
import { RerankerTechnicalError } from './errors.js';

export const RERANKER_PROVIDER = 'ALIBABA_DASHSCOPE' as const satisfies RerankResult['provider'];
export const RERANKER_MODEL_ID = 'qwen3-rerank' as const satisfies RerankResult['configuredModelId'];
export const RERANKER_MODEL_REVISION: RerankResult['configuredModelRevision'] = null;
export const RERANKER_IMMUTABLE_REVISION_PIN_STATUS = 'UNKNOWN_NOT_DOCUMENTED' as const;
export const RERANKER_API_SURFACE = 'DASHSCOPE_NATIVE_HTTP' as const;

export const RERANKER_ATTEMPT_TIMEOUT_MS = 10_000 as const;
export const RERANKER_MAX_ATTEMPTS = 2 as const;
export const RERANKER_RETRY_BACKOFF_MS = 1_000 as const;

const APPROVED_HOST_SUFFIX = '.maas.aliyuncs.com';
const APPROVED_BASE_PATH = '/api/v1';
const HOST_LABEL_PATTERN = /^[a-z0-9-]+$/;

export type RerankerConfigInput = {
  readonly baseUrl: string;
};

export type RerankerCapabilityConfig = {
  readonly provider: typeof RERANKER_PROVIDER;
  readonly modelId: typeof RERANKER_MODEL_ID;
  readonly modelRevision: null;
  readonly immutableRevisionPinStatus: typeof RERANKER_IMMUTABLE_REVISION_PIN_STATUS;
  readonly apiSurface: typeof RERANKER_API_SURFACE;
  readonly baseUrl: string;
  readonly attemptTimeoutMs: typeof RERANKER_ATTEMPT_TIMEOUT_MS;
  readonly maxAttempts: typeof RERANKER_MAX_ATTEMPTS;
  readonly retryBackoffMs: typeof RERANKER_RETRY_BACKOFF_MS;
};

export type RerankerEnvReader = (name: string) => string | undefined;

function configurationError(): RerankerTechnicalError {
  return new RerankerTechnicalError({
    code: 'CONFIGURATION',
    retryable: false,
  });
}

function isValidWorkspaceHost(hostname: string): boolean {
  if (!hostname.endsWith(APPROVED_HOST_SUFFIX)) {
    return false;
  }
  const workspacePrefix = hostname.slice(0, -APPROVED_HOST_SUFFIX.length);
  if (workspacePrefix.length === 0) {
    return false;
  }
  const labels = workspacePrefix.split('.');
  return labels.every((label) => label.length > 0 && HOST_LABEL_PATTERN.test(label));
}

/**
 * Validates the explicit workspace-specific DashScope base URL.
 * Enforces HTTPS, a workspace-specific *.maas.aliyuncs.com host, exact /api/v1 path,
 * and rejects userinfo, port, query, and hash components.
 */
export function validateRerankerBaseUrl(baseUrl: unknown): string {
  if (typeof baseUrl !== 'string') {
    throw configurationError();
  }

  const trimmed = baseUrl.trim();
  if (trimmed.length === 0 || trimmed.includes('?') || trimmed.includes('#')) {
    throw configurationError();
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw configurationError();
  }

  if (parsed.protocol !== 'https:') {
    throw configurationError();
  }
  if (parsed.username !== '' || parsed.password !== '' || parsed.port !== '') {
    throw configurationError();
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    throw configurationError();
  }
  if (parsed.pathname !== APPROVED_BASE_PATH) {
    throw configurationError();
  }

  const normalizedHost = parsed.hostname.toLowerCase();
  if (!isValidWorkspaceHost(normalizedHost)) {
    throw configurationError();
  }

  return `https://${normalizedHost}${APPROVED_BASE_PATH}`;
}

/**
 * Constructs a frozen capability config without reading secrets.
 * Provider, model identity, revision status, and retry/timeout policy are fixed by Slice 23.
 */
export function createRerankerConfig(input: RerankerConfigInput): RerankerCapabilityConfig {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw configurationError();
  }

  const validatedBaseUrl = validateRerankerBaseUrl(input.baseUrl);

  return Object.freeze({
    provider: RERANKER_PROVIDER,
    modelId: RERANKER_MODEL_ID,
    modelRevision: RERANKER_MODEL_REVISION,
    immutableRevisionPinStatus: RERANKER_IMMUTABLE_REVISION_PIN_STATUS,
    apiSurface: RERANKER_API_SURFACE,
    baseUrl: validatedBaseUrl,
    attemptTimeoutMs: RERANKER_ATTEMPT_TIMEOUT_MS,
    maxAttempts: RERANKER_MAX_ATTEMPTS,
    retryBackoffMs: RERANKER_RETRY_BACKOFF_MS,
  });
}

/**
 * Lazily reads DASHSCOPE_API_KEY only when explicitly resolved for transport use.
 * Missing or blank local secrets fail as CONFIGURATION, never AUTHENTICATION.
 */
export function resolveDashScopeApiKey(
  readEnv: RerankerEnvReader = (name) => process.env[name],
): string {
  const rawSecret = readEnv('DASHSCOPE_API_KEY');
  if (typeof rawSecret !== 'string') {
    throw configurationError();
  }

  const trimmed = rawSecret.trim();
  if (trimmed.length === 0) {
    throw configurationError();
  }

  return trimmed;
}
