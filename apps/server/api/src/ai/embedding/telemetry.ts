import { createHash } from 'node:crypto';
import type { EmbeddingErrorClass, EmbeddingErrorCode } from './errors.js';
import type { EmbeddingOutputType } from './port.js';

export interface EmbeddingTelemetryRecord {
  readonly event: 'embedding_provider_call';
  readonly logicalRequestId: string;
  readonly provider: 'ALIBABA_DASHSCOPE';
  readonly configuredModelId: string;
  readonly configuredModelVersionOrRevision: string;
  readonly outputType: EmbeddingOutputType;
  readonly denseDimension: number;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly providerRequestId: string | 'NOT_PROVIDED';
  readonly resultStatus: 'OK' | 'FAILED';
  readonly errorClass?: EmbeddingErrorClass;
  readonly errorCode?: EmbeddingErrorCode;
  readonly sparseElementCount: number | 'NOT_APPLICABLE';
  readonly endpointConfigFingerprint: string;
}

export interface EmbeddingTelemetrySink {
  emit(record: EmbeddingTelemetryRecord): void;
}

export const NOOP_TELEMETRY_SINK: EmbeddingTelemetrySink = Object.freeze({ emit: () => undefined });

export function endpointConfigFingerprint(baseUrl: string | null): string {
  return createHash('sha256').update(baseUrl ?? '').digest('hex').slice(0, 12);
}

export function sanitizeTelemetry(input: EmbeddingTelemetryRecord): EmbeddingTelemetryRecord {
  const base = {
    event: 'embedding_provider_call' as const,
    logicalRequestId: input.logicalRequestId,
    provider: 'ALIBABA_DASHSCOPE' as const,
    configuredModelId: input.configuredModelId,
    configuredModelVersionOrRevision: input.configuredModelVersionOrRevision,
    outputType: input.outputType,
    denseDimension: input.denseDimension,
    latencyMs: input.latencyMs,
    attempts: input.attempts,
    providerRequestId: input.providerRequestId,
    resultStatus: input.resultStatus,
    sparseElementCount: input.sparseElementCount,
    endpointConfigFingerprint: input.endpointConfigFingerprint,
  };
  return Object.freeze({
    ...base,
    ...(input.errorClass ? { errorClass: input.errorClass } : {}),
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
  });
}
