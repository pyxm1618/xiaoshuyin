import type { EmbeddingRuntimeConfig } from './config.js';
import type { NormalizedProviderEmbedding, NormalizedSparseValue } from './contracts.js';
import type { InternalProblem } from './errors.js';
import type { EmbeddingRequest, ProviderModelEchoStatus } from './port.js';

export interface NormalizedProviderResponse {
  readonly providerRequestId: string;
  readonly embeddings: readonly NormalizedProviderEmbedding[];
  readonly usage: { readonly totalTokens: unknown; readonly promptTokens: unknown };
  readonly providerModelEcho: ProviderModelEchoStatus;
  readonly observedResponseEnvelope: 'HTTP_OUTPUT_WRAPPED';
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function buildProviderRequest(
  request: EmbeddingRequest,
  config: EmbeddingRuntimeConfig,
  outputParameter: string,
): unknown {
  return {
    model: config.modelId,
    input: { texts: [...request.items] },
    parameters: {
      dimension: config.denseDimension,
      output_type: outputParameter,
      text_type: config.textType,
    },
  };
}

export function parseProviderSuccess(
  body: unknown,
  configuredModelId: string,
): NormalizedProviderResponse | InternalProblem {
  const root = record(body);
  if (!root) return { errorClass: 'TERMINAL', errorCode: 'MALFORMED_PROVIDER_RESPONSE' };
  const requestId = root['request_id'];
  if (typeof requestId !== 'string' || requestId.length === 0) {
    return { errorClass: 'TERMINAL', errorCode: 'MALFORMED_PROVIDER_RESPONSE' };
  }
  const output = record(root['output']);
  if (!output || !Array.isArray(output['embeddings'])) {
    return { errorClass: 'TERMINAL', errorCode: 'MALFORMED_PROVIDER_RESPONSE', providerRequestId: requestId };
  }
  if (Object.prototype.hasOwnProperty.call(root, 'embeddings')) {
    return { errorClass: 'TERMINAL', errorCode: 'AMBIGUOUS_PROVIDER_RESPONSE', providerRequestId: requestId };
  }

  let providerModelEcho: ProviderModelEchoStatus = 'PROVIDER_MODEL_ECHO_NOT_AVAILABLE';
  if (Object.prototype.hasOwnProperty.call(root, 'model')) {
    if (typeof root['model'] !== 'string' || root['model'] !== configuredModelId) {
      return { errorClass: 'TERMINAL', errorCode: 'MODEL_ECHO_MISMATCH', providerRequestId: requestId };
    }
    providerModelEcho = 'PROVIDER_MODEL_ECHO_VERIFIED';
  }

  const embeddings: NormalizedProviderEmbedding[] = (output['embeddings'] as unknown[]).map((candidate) => {
    const item = record(candidate);
    const sparsePresent = item ? Object.prototype.hasOwnProperty.call(item, 'sparse_embedding') : false;
    const sparseRaw = item?.['sparse_embedding'];
    const sparseVector = Array.isArray(sparseRaw)
      ? sparseRaw.map((entry): NormalizedSparseValue => {
          const sparseEntry = record(entry);
          return {
            position: sparseEntry?.['index'],
            value: sparseEntry?.['value'],
          };
        })
      : sparseRaw;
    return Object.freeze({
      position: item?.['index'],
      denseVector: item?.['embedding'],
      sparsePresent,
      sparseVector,
    });
  });

  const usageRecord = record(root['usage']);
  return Object.freeze({
    providerRequestId: requestId,
    embeddings: Object.freeze(embeddings),
    usage: Object.freeze({
      totalTokens: usageRecord?.['total_tokens'],
      promptTokens: usageRecord?.['prompt_tokens'],
    }),
    providerModelEcho,
    observedResponseEnvelope: 'HTTP_OUTPUT_WRAPPED' as const,
  });
}
