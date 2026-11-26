import type { EmbeddingRuntimeConfig } from './config.js';
import { EmbeddingConfigError, loadEmbeddingRuntimeConfig } from './config.js';
import {
  providerOutputParameter,
  validateEmbeddingRequest,
  validateProviderEmbeddings,
  validateRequestAgainstConfig,
} from './contracts.js';
import {
  DEFAULT_EMBEDDING_COST_GUARD,
  EmbeddingCostGuard,
  buildCostRecord,
  normalizeUsage,
} from './cost.js';
import type { CostRecord, EmbeddingUsage } from './cost.js';
import { classifyHttpFailure, makeFailure } from './errors.js';
import type { EmbeddingErrorClass, EmbeddingErrorCode, EmbeddingFailure, InternalProblem } from './errors.js';
import { deriveCapabilityEvidence } from './evidence.js';
import type { CapabilityEvidenceRecord } from './evidence.js';
import {
  FetchHttpTransport,
  TransportAbortError,
  TransportNetworkError,
  TransportTimeoutError,
} from './transport.js';
import type { HttpTransport } from './transport.js';
import {
  NOOP_TELEMETRY_SINK,
  endpointConfigFingerprint,
  sanitizeTelemetry,
} from './telemetry.js';
import type { EmbeddingTelemetryRecord, EmbeddingTelemetrySink } from './telemetry.js';

export type EmbeddingOutputType = 'dense' | 'dense+sparse';
export type ProviderModelEchoStatus = 'PROVIDER_MODEL_ECHO_VERIFIED' | 'PROVIDER_MODEL_ECHO_NOT_AVAILABLE';
export type ObservedResponseEnvelope = 'HTTP_OUTPUT_WRAPPED';

export interface EmbeddingRequest {
  readonly requestId: string;
  readonly configuredModelId: string;
  readonly configuredModelVersionOrRevision: string;
  readonly outputType: EmbeddingOutputType;
  readonly denseDimension: number;
  readonly items: readonly string[];
  readonly correlationTag?: string;
}

export interface SparseEntry {
  readonly index: number;
  readonly value: number;
}

export interface EmbeddingItemResult {
  readonly index: number;
  readonly dense: readonly number[];
  readonly sparse: readonly SparseEntry[] | null;
  readonly sparseElementCount: number | 'NOT_APPLICABLE';
  readonly observedMaxSparseIndex: number | 'NOT_APPLICABLE';
}

export interface EmbeddingResult {
  readonly requestId: string;
  readonly providerRequestId: string | 'NOT_PROVIDED';
  readonly outputType: EmbeddingOutputType;
  readonly items: readonly EmbeddingItemResult[];
  readonly configuredModel: {
    readonly modelId: string;
    readonly versionOrRevision: string;
  };
  readonly providerModelEcho: ProviderModelEchoStatus;
  readonly observedResponseEnvelope: ObservedResponseEnvelope;
  readonly usage: EmbeddingUsage;
  readonly cost: CostRecord;
  readonly telemetry: EmbeddingTelemetryRecord;
  readonly capabilityEvidence: CapabilityEvidenceRecord;
}

export type EmbeddingOutcome =
  | { readonly kind: 'OK'; readonly result: EmbeddingResult }
  | { readonly kind: 'FAILED'; readonly failure: EmbeddingFailure };

export interface EmbeddingProviderPort {
  embed(request: EmbeddingRequest, signal?: AbortSignal): Promise<EmbeddingOutcome>;
}

export interface EmbeddingProviderFactoryConfig {
  readonly env?: NodeJS.ProcessEnv;
}

export interface EmbeddingProviderDependencies {
  readonly transport?: HttpTransport;
  readonly telemetrySink?: EmbeddingTelemetrySink;
  readonly costGuard?: EmbeddingCostGuard;
  readonly now?: () => number;
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

function evidence(configComplete: boolean): CapabilityEvidenceRecord {
  return deriveCapabilityEvidence({
    contractChecksAllPassed: true,
    configComplete,
    providerVerification: null,
  });
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new TransportAbortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new TransportAbortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function retryAfterMs(value: string | null, nowMs: number): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) return Math.ceil(numeric * 1000);
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return null;
  return Math.max(0, date - nowMs);
}

function safeEmit(sink: EmbeddingTelemetrySink, record: EmbeddingTelemetryRecord): void {
  try {
    sink.emit(record);
  } catch {
    // Telemetry is intentionally non-authoritative; sink failure cannot change the embedding outcome.
  }
}

function sparseCount(items: readonly EmbeddingItemResult[], outputType: EmbeddingOutputType): number | 'NOT_APPLICABLE' {
  if (outputType === 'dense') return 'NOT_APPLICABLE';
  return items.reduce((sum, item) => sum + (typeof item.sparseElementCount === 'number' ? item.sparseElementCount : 0), 0);
}

function failureTelemetry(input: {
  request: EmbeddingRequest;
  config: EmbeddingRuntimeConfig | null;
  attempts: number;
  startedAt: number;
  now: () => number;
  providerRequestId?: string;
  problem: InternalProblem;
}): EmbeddingTelemetryRecord {
  return sanitizeTelemetry({
    event: 'embedding_provider_call',
    logicalRequestId: input.request.requestId,
    provider: 'ALIBABA_DASHSCOPE',
    configuredModelId: input.request.configuredModelId,
    configuredModelVersionOrRevision: input.request.configuredModelVersionOrRevision,
    outputType: input.request.outputType,
    denseDimension: input.request.denseDimension,
    latencyMs: Math.max(0, input.now() - input.startedAt),
    attempts: input.attempts,
    providerRequestId: input.providerRequestId ?? input.problem.providerRequestId ?? 'NOT_PROVIDED',
    resultStatus: 'FAILED',
    errorClass: input.problem.errorClass,
    errorCode: input.problem.errorCode,
    sparseElementCount: 'NOT_APPLICABLE',
    endpointConfigFingerprint: endpointConfigFingerprint(input.config?.baseUrl ?? null),
  });
}

export function createEmbeddingProviderPort(
  factoryConfig: EmbeddingProviderFactoryConfig = {},
  deps: EmbeddingProviderDependencies = {},
): EmbeddingProviderPort {
  const transport = deps.transport ?? new FetchHttpTransport();
  const telemetrySink = deps.telemetrySink ?? NOOP_TELEMETRY_SINK;
  const costGuard = deps.costGuard ?? DEFAULT_EMBEDDING_COST_GUARD;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;

  return Object.freeze({
    async embed(request: EmbeddingRequest, signal?: AbortSignal): Promise<EmbeddingOutcome> {
      const startedAt = now();
      const basicProblem = validateEmbeddingRequest(request);
      if (basicProblem) {
        return Object.freeze({
          kind: 'FAILED' as const,
          failure: makeFailure({
            requestId: typeof request?.requestId === 'string' ? request.requestId : 'INVALID_REQUEST',
            errorClass: basicProblem.errorClass,
            errorCode: basicProblem.errorCode,
            attempts: 0,
            finalCause: 'NOT_RETRYABLE',
            capabilityEvidence: evidence(false),
          }),
        });
      }

      let config: EmbeddingRuntimeConfig;
      try {
        config = loadEmbeddingRuntimeConfig(factoryConfig.env);
      } catch (error) {
        const problem: InternalProblem = error instanceof EmbeddingConfigError
          ? { errorClass: 'BLOCKED', errorCode: error.errorCode }
          : { errorClass: 'BLOCKED', errorCode: 'CONFIG_INVALID' };
        const telemetry = failureTelemetry({ request, config: null, attempts: 0, startedAt, now, problem });
        safeEmit(telemetrySink, telemetry);
        return Object.freeze({
          kind: 'FAILED' as const,
          failure: makeFailure({
            requestId: request.requestId,
            errorClass: problem.errorClass,
            errorCode: problem.errorCode,
            attempts: 0,
            finalCause: 'NOT_RETRYABLE',
            capabilityEvidence: evidence(false),
          }),
        });
      }

      const configProblem = validateRequestAgainstConfig(request, config);
      if (configProblem) {
        const telemetry = failureTelemetry({ request, config, attempts: 0, startedAt, now, problem: configProblem });
        safeEmit(telemetrySink, telemetry);
        return Object.freeze({
          kind: 'FAILED' as const,
          failure: makeFailure({
            requestId: request.requestId,
            errorClass: configProblem.errorClass,
            errorCode: configProblem.errorCode,
            attempts: 0,
            finalCause: 'NOT_RETRYABLE',
            capabilityEvidence: evidence(true),
          }),
        });
      }

      const outputParameter = providerOutputParameter(config, request.outputType);
      if (!outputParameter) {
        const problem: InternalProblem = { errorClass: 'UNSUPPORTED', errorCode: 'OUTPUT_TYPE_UNSUPPORTED' };
        const telemetry = failureTelemetry({ request, config, attempts: 0, startedAt, now, problem });
        safeEmit(telemetrySink, telemetry);
        return Object.freeze({
          kind: 'FAILED' as const,
          failure: makeFailure({
            requestId: request.requestId,
            errorClass: problem.errorClass,
            errorCode: problem.errorCode,
            attempts: 0,
            finalCause: 'NOT_RETRYABLE',
            capabilityEvidence: evidence(true),
          }),
        });
      }

      if (costGuard.isBlocked(config.maxTokensPerProcess)) {
        const problem: InternalProblem = { errorClass: 'BLOCKED', errorCode: 'COST_LIMIT_REACHED' };
        const telemetry = failureTelemetry({ request, config, attempts: 0, startedAt, now, problem });
        safeEmit(telemetrySink, telemetry);
        return Object.freeze({
          kind: 'FAILED' as const,
          failure: makeFailure({
            requestId: request.requestId,
            errorClass: problem.errorClass,
            errorCode: problem.errorCode,
            attempts: 0,
            finalCause: 'NOT_RETRYABLE',
            capabilityEvidence: evidence(true),
          }),
        });
      }

      const protocol = await import('./' + 'dash' + 'scope-protocol.js');
      const providerBody = protocol.buildProviderRequest(request, config, outputParameter);
      const deadline = startedAt + config.totalBudgetMs;
      let attempts = 0;
      let lastProviderRequestId: string | undefined;

      const finishFailure = (
        problem: InternalProblem,
        finalCause: 'NOT_RETRYABLE' | 'RETRY_EXHAUSTED' | 'DEADLINE_EXCEEDED' | 'RETRY_AFTER_EXCEEDS_BUDGET' | 'CANCELLED',
        cost?: CostRecord,
      ): EmbeddingOutcome => {
        const telemetry = failureTelemetry({
          request,
          config,
          attempts,
          startedAt,
          now,
          ...(lastProviderRequestId ? { providerRequestId: lastProviderRequestId } : {}),
          problem,
        });
        safeEmit(telemetrySink, telemetry);
        return Object.freeze({
          kind: 'FAILED' as const,
          failure: makeFailure({
            requestId: request.requestId,
            ...((lastProviderRequestId ?? problem.providerRequestId)
              ? { providerRequestId: (lastProviderRequestId ?? problem.providerRequestId)! }
              : {}),
            errorClass: problem.errorClass,
            errorCode: problem.errorCode,
            attempts,
            finalCause,
            capabilityEvidence: evidence(true),
            ...(cost ? { cost } : {}),
          }),
        });
      };

      const rejectedCallCost = (
        providerRequestId: string | undefined,
        usage: EmbeddingUsage,
        costGuard: 'OK' | 'LIMIT_REACHED_AFTER_CALL',
      ): CostRecord => buildCostRecord({
        logicalRequestId: request.requestId,
        providerRequestId: providerRequestId ?? 'NOT_PROVIDED',
        usage,
        configuredModelId: request.configuredModelId,
        configuredModelVersionOrRevision: request.configuredModelVersionOrRevision,
        costGuard,
        ...(config.pricePer1kTokens !== undefined ? { pricePer1kTokens: config.pricePer1kTokens } : {}),
        ...(config.priceCurrency ? { priceCurrency: config.priceCurrency } : {}),
      });

      while (true) {
        if (signal?.aborted) {
          return finishFailure({ errorClass: 'TERMINAL', errorCode: 'ABORTED' }, 'CANCELLED');
        }
        const remaining = deadline - now();
        if (remaining <= 0) {
          return finishFailure({ errorClass: 'TERMINAL', errorCode: 'DEADLINE_EXCEEDED' }, 'DEADLINE_EXCEEDED');
        }

        attempts += 1;
        const timeoutMs = Math.max(1, Math.min(config.requestTimeoutMs, remaining));
        let retryableProblem: InternalProblem | null = null;
        let retryAfter: number | null = null;

        try {
          const response = await transport.request({
            url: config.endpointUrl,
            body: providerBody,
            timeoutMs,
          }, config.apiKey, signal);

          if (response.status >= 200 && response.status <= 299) {
            const parsed = protocol.parseProviderSuccess(response.body, config.modelId);
            if ('errorClass' in parsed) {
              if (parsed.providerRequestId) lastProviderRequestId = parsed.providerRequestId;
              // A 2xx response is billable even when the normalized envelope/model is rejected.
              // Account only aggregate usage the provider actually returned; never synthesize it.
              const rejectedUsage = parsed.usage ? normalizeUsage(parsed.usage) : null;
              if (!rejectedUsage) return finishFailure(parsed, 'NOT_RETRYABLE');
              const rejectedGuardState = costGuard.record(
                rejectedUsage.totalTokens,
                config.maxTokensPerCall,
                config.maxTokensPerProcess,
              );
              return finishFailure(
                parsed,
                'NOT_RETRYABLE',
                rejectedCallCost(parsed.providerRequestId, rejectedUsage, rejectedGuardState),
              );
            }
            lastProviderRequestId = parsed.providerRequestId;
            const usage = normalizeUsage(parsed.usage);
            if (!usage) {
              return finishFailure({
                errorClass: 'TERMINAL',
                errorCode: 'RESPONSE_MALFORMED',
                providerRequestId: parsed.providerRequestId,
              }, 'NOT_RETRYABLE');
            }
            // Provider usage is billable once a successful HTTP response has been returned,
            // even when the returned vectors fail our contract validation. Record it before
            // validating embeddings so rejected output cannot bypass the process cost guard.
            const guardState = costGuard.record(usage.totalTokens, config.maxTokensPerCall, config.maxTokensPerProcess);
            const validated = validateProviderEmbeddings({ embeddings: parsed.embeddings, request, config });
            if ('errorClass' in validated) {
              return finishFailure(validated, 'NOT_RETRYABLE', rejectedCallCost(parsed.providerRequestId, usage, guardState));
            }
            const cost = buildCostRecord({
              logicalRequestId: request.requestId,
              providerRequestId: parsed.providerRequestId,
              usage,
              configuredModelId: request.configuredModelId,
              configuredModelVersionOrRevision: request.configuredModelVersionOrRevision,
              costGuard: guardState,
              ...(config.pricePer1kTokens !== undefined ? { pricePer1kTokens: config.pricePer1kTokens } : {}),
              ...(config.priceCurrency ? { priceCurrency: config.priceCurrency } : {}),
            });
            const telemetry = sanitizeTelemetry({
              event: 'embedding_provider_call',
              logicalRequestId: request.requestId,
              provider: 'ALIBABA_DASHSCOPE',
              configuredModelId: request.configuredModelId,
              configuredModelVersionOrRevision: request.configuredModelVersionOrRevision,
              outputType: request.outputType,
              denseDimension: request.denseDimension,
              latencyMs: Math.max(0, now() - startedAt),
              attempts,
              providerRequestId: parsed.providerRequestId,
              resultStatus: 'OK',
              sparseElementCount: sparseCount(validated.items, request.outputType),
              endpointConfigFingerprint: endpointConfigFingerprint(config.baseUrl),
            });
            safeEmit(telemetrySink, telemetry);
            const result: EmbeddingResult = Object.freeze({
              requestId: request.requestId,
              providerRequestId: parsed.providerRequestId,
              outputType: request.outputType,
              items: validated.items,
              configuredModel: Object.freeze({
                modelId: request.configuredModelId,
                versionOrRevision: request.configuredModelVersionOrRevision,
              }),
              providerModelEcho: parsed.providerModelEcho,
              observedResponseEnvelope: parsed.observedResponseEnvelope,
              usage,
              cost,
              telemetry,
              capabilityEvidence: evidence(true),
            });
            return Object.freeze({ kind: 'OK' as const, result });
          }

          retryableProblem = classifyHttpFailure(response.status, response.body);
          if (retryableProblem.providerRequestId) lastProviderRequestId = retryableProblem.providerRequestId;
          retryAfter = response.status === 429 ? retryAfterMs(response.retryAfter, now()) : null;
          if (retryableProblem.errorClass !== 'RETRYABLE') return finishFailure(retryableProblem, 'NOT_RETRYABLE');
        } catch (error) {
          if (error instanceof TransportAbortError || signal?.aborted) {
            return finishFailure({ errorClass: 'TERMINAL', errorCode: 'ABORTED' }, 'CANCELLED');
          }
          if (error instanceof TransportTimeoutError) {
            retryableProblem = { errorClass: 'RETRYABLE', errorCode: 'TIMEOUT' };
          } else if (error instanceof TransportNetworkError || error instanceof Error) {
            retryableProblem = { errorClass: 'RETRYABLE', errorCode: 'PROVIDER_UNAVAILABLE' };
          } else {
            retryableProblem = { errorClass: 'RETRYABLE', errorCode: 'PROVIDER_UNAVAILABLE' };
          }
        }

        if (!retryableProblem) {
          return finishFailure({ errorClass: 'TERMINAL', errorCode: 'PROVIDER_UNAVAILABLE' }, 'NOT_RETRYABLE');
        }
        if (attempts >= config.maxAttempts) {
          return finishFailure({ errorClass: 'TERMINAL', errorCode: 'RETRY_EXHAUSTED' }, 'RETRY_EXHAUSTED');
        }

        const remainingAfterAttempt = deadline - now();
        if (remainingAfterAttempt <= 0) {
          return finishFailure({ errorClass: 'TERMINAL', errorCode: 'DEADLINE_EXCEEDED' }, 'DEADLINE_EXCEEDED');
        }
        const backoff = Math.min(config.retryBaseDelayMs * (2 ** (attempts - 1)), 2_000);
        const delay = Math.max(backoff, retryAfter ?? 0);
        if (delay > remainingAfterAttempt) {
          return finishFailure(
            { errorClass: 'TERMINAL', errorCode: 'DEADLINE_EXCEEDED' },
            retryAfter !== null ? 'RETRY_AFTER_EXCEEDS_BUDGET' : 'DEADLINE_EXCEEDED',
          );
        }
        try {
          await sleep(delay, signal);
        } catch {
          return finishFailure({ errorClass: 'TERMINAL', errorCode: 'ABORTED' }, 'CANCELLED');
        }
      }
    },
  });
}
