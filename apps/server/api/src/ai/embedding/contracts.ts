import type { EmbeddingRuntimeConfig } from './config.js';
import type { EmbeddingErrorCode, InternalProblem } from './errors.js';
import type {
  EmbeddingItemResult,
  EmbeddingOutputType,
  EmbeddingRequest,
  SparseEntry,
} from './port.js';

export interface NormalizedSparseValue {
  readonly position: unknown;
  readonly value: unknown;
}

export interface NormalizedProviderEmbedding {
  readonly position: unknown;
  readonly denseVector: unknown;
  readonly sparsePresent: boolean;
  readonly sparseVector: unknown;
}

const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const CORRELATION_TAG = /^[A-Za-z0-9._:-]{1,64}$/;

function terminal(errorCode: EmbeddingErrorCode): InternalProblem {
  return { errorClass: 'TERMINAL', errorCode };
}

export function validateEmbeddingRequest(
  request: EmbeddingRequest,
  limits?: { readonly maxBatchSize: number; readonly maxInputChars: number },
): InternalProblem | null {
  if (!request || typeof request !== 'object') return { errorClass: 'BLOCKED', errorCode: 'INVALID_REQUEST' };
  if (typeof request.requestId !== 'string' || !REQUEST_ID.test(request.requestId)) {
    return { errorClass: 'BLOCKED', errorCode: 'INVALID_REQUEST' };
  }
  if (typeof request.configuredModelId !== 'string' || request.configuredModelId.trim().length === 0) {
    return { errorClass: 'BLOCKED', errorCode: 'INVALID_REQUEST' };
  }
  if (typeof request.configuredModelVersionOrRevision !== 'string' || request.configuredModelVersionOrRevision.trim().length === 0) {
    return { errorClass: 'BLOCKED', errorCode: 'INVALID_REQUEST' };
  }
  if (request.outputType !== 'dense' && request.outputType !== 'dense+sparse') {
    return { errorClass: 'BLOCKED', errorCode: 'OUTPUT_TYPE_INVALID' };
  }
  if (!Number.isSafeInteger(request.denseDimension) || request.denseDimension <= 0) {
    return { errorClass: 'BLOCKED', errorCode: 'INVALID_REQUEST' };
  }
  if (!Array.isArray(request.items) || request.items.length === 0) {
    return { errorClass: 'BLOCKED', errorCode: 'INVALID_REQUEST' };
  }
  if (limits && request.items.length > limits.maxBatchSize) {
    return { errorClass: 'BLOCKED', errorCode: 'INVALID_REQUEST' };
  }
  for (const item of request.items) {
    if (typeof item !== 'string' || item.trim().length === 0) {
      return { errorClass: 'BLOCKED', errorCode: 'INVALID_REQUEST' };
    }
    if (limits && item.length > limits.maxInputChars) {
      return { errorClass: 'BLOCKED', errorCode: 'INVALID_REQUEST' };
    }
  }
  if (request.correlationTag !== undefined &&
      (typeof request.correlationTag !== 'string' || !CORRELATION_TAG.test(request.correlationTag))) {
    return { errorClass: 'BLOCKED', errorCode: 'INVALID_REQUEST' };
  }
  return null;
}

export function validateRequestAgainstConfig(request: EmbeddingRequest, config: EmbeddingRuntimeConfig): InternalProblem | null {
  if (
    request.configuredModelId !== config.modelId ||
    request.configuredModelVersionOrRevision !== config.modelVersionOrRevision ||
    request.denseDimension !== config.denseDimension
  ) {
    return { errorClass: 'BLOCKED', errorCode: 'INVALID_REQUEST' };
  }
  return validateEmbeddingRequest(request, {
    maxBatchSize: config.maxBatchSize,
    maxInputChars: config.maxInputChars,
  });
}

function denseVector(value: unknown, dimension: number): readonly number[] | InternalProblem {
  if (!Array.isArray(value)) return terminal('RESPONSE_MALFORMED');
  if (value.length !== dimension) return terminal('DIMENSION_MISMATCH');
  const output: number[] = [];
  for (const entry of value) {
    if (typeof entry !== 'number' || !Number.isFinite(entry)) return terminal('DENSE_INVALID_VALUE');
    output.push(entry);
  }
  return Object.freeze(output);
}

function sparseVector(
  raw: unknown,
  config: EmbeddingRuntimeConfig,
): { readonly entries: readonly SparseEntry[]; readonly observedMaxSparseIndex: number | 'NOT_APPLICABLE' } | InternalProblem {
  if (!Array.isArray(raw)) return terminal('SPARSE_MALFORMED');
  if (raw.length > config.maxSparseElements) return terminal('SPARSE_LIMIT_EXCEEDED');
  const entries: SparseEntry[] = [];
  for (const candidate of raw) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return terminal('SPARSE_MALFORMED');
    const position = (candidate as NormalizedSparseValue).position;
    const value = (candidate as NormalizedSparseValue).value;
    if (typeof position !== 'number' || !Number.isInteger(position) || position < 0) return terminal('SPARSE_INDEX_INVALID');
    if (config.sparseVocabularyMax !== undefined && position >= config.sparseVocabularyMax) {
      return terminal('SPARSE_INDEX_INVALID');
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) return terminal('SPARSE_VALUE_INVALID');
    entries.push(Object.freeze({ index: position, value }));
  }
  entries.sort((a, b) => a.index - b.index);
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index - 1]!.index === entries[index]!.index) return terminal('SPARSE_INDEX_DUPLICATE');
  }
  return Object.freeze({
    entries: Object.freeze(entries),
    observedMaxSparseIndex: entries.length === 0 ? 'NOT_APPLICABLE' as const : entries[entries.length - 1]!.index,
  });
}

export function validateProviderEmbeddings(input: {
  readonly embeddings: readonly NormalizedProviderEmbedding[];
  readonly request: EmbeddingRequest;
  readonly config: EmbeddingRuntimeConfig;
}): { readonly items: readonly EmbeddingItemResult[] } | InternalProblem {
  if (input.embeddings.length !== input.request.items.length) return terminal('DENSE_CARDINALITY_MISMATCH');
  const seen = new Set<number>();
  const items: EmbeddingItemResult[] = [];

  for (const rawItem of input.embeddings) {
    if (typeof rawItem.position !== 'number' || !Number.isInteger(rawItem.position)) return terminal('RESPONSE_MALFORMED');
    if (rawItem.position < 0 || rawItem.position >= input.request.items.length || seen.has(rawItem.position)) {
      return terminal('RESPONSE_MALFORMED');
    }
    seen.add(rawItem.position);
    const dense = denseVector(rawItem.denseVector, input.request.denseDimension);
    if ('errorClass' in dense) return dense;

    if (input.request.outputType === 'dense') {
      items.push(Object.freeze({
        index: rawItem.position,
        dense,
        sparse: null,
        sparseElementCount: 'NOT_APPLICABLE' as const,
        observedMaxSparseIndex: 'NOT_APPLICABLE' as const,
      }));
      continue;
    }

    if (!rawItem.sparsePresent) return { errorClass: 'UNSUPPORTED', errorCode: 'SPARSE_NOT_RETURNED' };
    const sparse = sparseVector(rawItem.sparseVector, input.config);
    if ('errorClass' in sparse) return sparse;
    items.push(Object.freeze({
      index: rawItem.position,
      dense,
      sparse: sparse.entries,
      sparseElementCount: sparse.entries.length,
      observedMaxSparseIndex: sparse.observedMaxSparseIndex,
    }));
  }

  if (seen.size !== input.request.items.length) return terminal('RESPONSE_MALFORMED');
  items.sort((a, b) => a.index - b.index);
  return Object.freeze({ items: Object.freeze(items) });
}

export function providerOutputParameter(config: EmbeddingRuntimeConfig, outputType: EmbeddingOutputType): string | null {
  return outputType === 'dense' ? (config.denseOutputParam ?? null) : (config.denseSparseOutputParam ?? null);
}
