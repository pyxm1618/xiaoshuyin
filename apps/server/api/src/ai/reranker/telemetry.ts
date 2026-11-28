import { createHash } from 'node:crypto';
import type { RerankerCapabilityConfig } from './config.js';
import type { RerankRequest } from './contracts.js';
import { RERANKER_ERROR_CODES, type RerankerErrorCode } from './errors.js';

export type RerankerTelemetryTerminalState = 'SUCCESS' | RerankerErrorCode;

export type RerankerTelemetryRecord = {
  readonly provider: RerankerCapabilityConfig['provider'];
  readonly configuredModelId: RerankerCapabilityConfig['modelId'];
  readonly configuredModelRevision: RerankerCapabilityConfig['modelRevision'];
  readonly immutableRevisionPinStatus: RerankerCapabilityConfig['immutableRevisionPinStatus'];
  readonly candidateCount: number;
  readonly attemptCount: number;
  readonly elapsedMs: number;
  readonly terminalState: RerankerTelemetryTerminalState;
  readonly errorCode?: RerankerErrorCode;
  readonly providerRequestId?: string;
  readonly totalTokens?: number;
  readonly configFingerprint: string;
  readonly requestFingerprint: string;
};

export const RERANKER_TELEMETRY_WHITELIST_KEYS = [
  'provider',
  'configuredModelId',
  'configuredModelRevision',
  'immutableRevisionPinStatus',
  'candidateCount',
  'attemptCount',
  'elapsedMs',
  'terminalState',
  'errorCode',
  'providerRequestId',
  'totalTokens',
  'configFingerprint',
  'requestFingerprint',
] as const;

export type RerankerTelemetryInput = {
  readonly config: RerankerCapabilityConfig;
  readonly request: RerankRequest;
  readonly attemptCount: number;
  readonly elapsedMs: number;
  readonly terminalState: RerankerTelemetryTerminalState;
  readonly errorCode?: RerankerErrorCode;
  readonly providerRequestId?: string;
  readonly totalTokens?: number;
};

const ERROR_CODE_SET: ReadonlySet<string> = new Set(RERANKER_ERROR_CODES);
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

function sanitizeSafeFingerprint(value: unknown): string {
  if (typeof value !== 'string' || !SHA256_HEX_PATTERN.test(value)) {
    return '';
  }
  return value;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function sanitizeSafeProviderRequestId(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (/[\s\u0000-\u001f\u007f]/.test(trimmed)) {
    return undefined;
  }
  if (/^(?:bearer|sk-)/i.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function sanitizeNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return undefined;
  }
  return value;
}

function sanitizeElapsedMs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value);
}

function sanitizeErrorCode(value: unknown): RerankerErrorCode | undefined {
  if (typeof value === 'string' && ERROR_CODE_SET.has(value)) {
    return value as RerankerErrorCode;
  }
  return undefined;
}

/**
 * Produces an irreversible SHA-256 fingerprint of non-secret capability configuration.
 */
export function createSafeConfigFingerprint(config: RerankerCapabilityConfig): string {
  const canonical = JSON.stringify({
    provider: config.provider,
    modelId: config.modelId,
    modelRevision: config.modelRevision,
    immutableRevisionPinStatus: config.immutableRevisionPinStatus,
    apiSurface: config.apiSurface,
    baseUrl: config.baseUrl,
    attemptTimeoutMs: config.attemptTimeoutMs,
    maxAttempts: config.maxAttempts,
    retryBackoffMs: config.retryBackoffMs,
  });
  return sha256Hex(canonical);
}

/**
 * Produces an irreversible SHA-256 fingerprint of the request without retaining raw text or secrets.
 */
export function createSafeRequestFingerprint(request: RerankRequest): string {
  const canonical = JSON.stringify({
    queryHash: sha256Hex(request.query),
    instructHash: sha256Hex(request.options.instruct),
    candidateCount: request.candidates.length,
    candidates: request.candidates.map((candidate) => ({
      idHash: sha256Hex(candidate.candidateId),
      textHash: sha256Hex(candidate.candidateText),
    })),
  });
  return sha256Hex(canonical);
}

/**
 * Builds a strictly whitelisted, frozen telemetry record without raw content, secrets, or fabricated cost.
 */
export function buildRerankerTelemetryRecord(
  input: RerankerTelemetryInput,
): RerankerTelemetryRecord {
  const safeProviderRequestId = sanitizeSafeProviderRequestId(input.providerRequestId);
  const safeTotalTokens = sanitizeNonNegativeInt(input.totalTokens);
  const safeErrorCode =
    input.terminalState === 'SUCCESS' ? undefined : sanitizeErrorCode(input.errorCode);

  return Object.freeze({
    provider: input.config.provider,
    configuredModelId: input.config.modelId,
    configuredModelRevision: input.config.modelRevision,
    immutableRevisionPinStatus: input.config.immutableRevisionPinStatus,
    candidateCount: input.request.candidates.length,
    attemptCount: sanitizeNonNegativeInt(input.attemptCount) ?? 0,
    elapsedMs: sanitizeElapsedMs(input.elapsedMs),
    terminalState: input.terminalState,
    ...(safeErrorCode !== undefined ? { errorCode: safeErrorCode } : {}),
    ...(safeProviderRequestId !== undefined
      ? { providerRequestId: safeProviderRequestId }
      : {}),
    ...(safeTotalTokens !== undefined ? { totalTokens: safeTotalTokens } : {}),
    configFingerprint: createSafeConfigFingerprint(input.config),
    requestFingerprint: createSafeRequestFingerprint(input.request),
  });
}

/**
 * Projects any arbitrary object onto the strict telemetry whitelist, stripping all forbidden fields.
 */
export function sanitizeTelemetryRecord(
  candidate: Record<string, unknown>,
): RerankerTelemetryRecord {
  const safeProviderRequestId = sanitizeSafeProviderRequestId(candidate.providerRequestId);
  const safeTotalTokens = sanitizeNonNegativeInt(candidate.totalTokens);
  const terminalState: RerankerTelemetryTerminalState =
    candidate.terminalState === 'SUCCESS'
      ? 'SUCCESS'
      : (sanitizeErrorCode(candidate.terminalState) ?? 'UNKNOWN_PROVIDER_FAILURE');
  const safeErrorCode =
    terminalState === 'SUCCESS' ? undefined : sanitizeErrorCode(candidate.errorCode);

  return Object.freeze({
    provider: 'ALIBABA_DASHSCOPE',
    configuredModelId: 'qwen3-rerank',
    configuredModelRevision: null,
    immutableRevisionPinStatus: 'UNKNOWN_NOT_DOCUMENTED',
    candidateCount: sanitizeNonNegativeInt(candidate.candidateCount) ?? 0,
    attemptCount: sanitizeNonNegativeInt(candidate.attemptCount) ?? 0,
    elapsedMs: sanitizeElapsedMs(candidate.elapsedMs),
    terminalState,
    ...(safeErrorCode !== undefined ? { errorCode: safeErrorCode } : {}),
    ...(safeProviderRequestId !== undefined
      ? { providerRequestId: safeProviderRequestId }
      : {}),
    ...(safeTotalTokens !== undefined ? { totalTokens: safeTotalTokens } : {}),
    configFingerprint: sanitizeSafeFingerprint(candidate.configFingerprint),
    requestFingerprint: sanitizeSafeFingerprint(candidate.requestFingerprint),
  });
}
