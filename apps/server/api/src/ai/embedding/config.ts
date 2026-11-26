import type { EmbeddingErrorCode } from './errors.js';

const FIXED_ENDPOINT_PATH = '/api/v1/services/embeddings/text-embedding/text-embedding';
const APPROVED_HOST_SUFFIX = '.maas.aliyuncs.com';

export interface EmbeddingRuntimeConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly endpointUrl: string;
  readonly modelId: string;
  readonly modelVersionOrRevision: string;
  readonly denseDimension: number;
  readonly denseOutputParam?: string;
  readonly denseSparseOutputParam?: string;
  readonly textType: 'query' | 'document';
  readonly requestTimeoutMs: number;
  readonly maxAttempts: number;
  readonly totalBudgetMs: number;
  readonly retryBaseDelayMs: number;
  readonly maxBatchSize: number;
  readonly maxInputChars: number;
  readonly maxSparseElements: number;
  readonly sparseVocabularyMax?: number;
  readonly pricePer1kTokens?: number;
  readonly priceCurrency?: string;
  readonly maxTokensPerCall: number;
  readonly maxTokensPerProcess: number;
  readonly verificationEnabled: boolean;
}

export class EmbeddingConfigError extends Error {
  readonly errorClass = 'BLOCKED' as const;
  constructor(readonly errorCode: EmbeddingErrorCode) {
    super(errorCode);
    this.name = 'EmbeddingConfigError';
  }
}

function raw(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function required(env: NodeJS.ProcessEnv, key: string, code: EmbeddingErrorCode = 'CONFIG_MISSING'): string {
  const value = raw(env, key);
  if (!value) throw new EmbeddingConfigError(code);
  return value;
}

function integer(env: NodeJS.ProcessEnv, key: string, options: {
  readonly defaultValue?: number;
  readonly min?: number;
  readonly max?: number;
  readonly required?: boolean;
}): number {
  const value = raw(env, key);
  if (!value) {
    if (options.required) throw new EmbeddingConfigError('CONFIG_MISSING');
    if (options.defaultValue !== undefined) return options.defaultValue;
    throw new EmbeddingConfigError('CONFIG_MISSING');
  }
  if (!/^\d+$/.test(value)) throw new EmbeddingConfigError('CONFIG_INVALID');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new EmbeddingConfigError('CONFIG_INVALID');
  if (options.min !== undefined && parsed < options.min) throw new EmbeddingConfigError('CONFIG_INVALID');
  if (options.max !== undefined && parsed > options.max) throw new EmbeddingConfigError('CONFIG_INVALID');
  return parsed;
}

function decimal(env: NodeJS.ProcessEnv, key: string): number | undefined {
  const value = raw(env, key);
  if (!value) return undefined;
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw new EmbeddingConfigError('CONFIG_INVALID');
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new EmbeddingConfigError('CONFIG_INVALID');
  return parsed;
}

function approvedBaseUrl(value: string): { baseUrl: string; endpointUrl: string } {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new EmbeddingConfigError('ENDPOINT_NOT_ALLOWED');
  }
  if (parsed.protocol !== 'https:') throw new EmbeddingConfigError('ENDPOINT_NOT_ALLOWED');
  if (parsed.username || parsed.password || parsed.port) throw new EmbeddingConfigError('ENDPOINT_NOT_ALLOWED');
  if (parsed.search || parsed.hash) throw new EmbeddingConfigError('ENDPOINT_NOT_ALLOWED');
  if (parsed.pathname !== '' && parsed.pathname !== '/') throw new EmbeddingConfigError('ENDPOINT_NOT_ALLOWED');
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname.endsWith(APPROVED_HOST_SUFFIX)) throw new EmbeddingConfigError('ENDPOINT_NOT_ALLOWED');
  const baseUrl = `https://${hostname}`;
  return { baseUrl, endpointUrl: `${baseUrl}${FIXED_ENDPOINT_PATH}` };
}

export function loadEmbeddingRuntimeConfig(env: NodeJS.ProcessEnv = process.env): EmbeddingRuntimeConfig {
  const apiKey = required(env, 'DASHSCOPE_API_KEY', 'SECRET_MISSING');
  const endpoint = approvedBaseUrl(required(env, 'DASHSCOPE_EMBEDDING_BASE_URL'));
  const modelId = required(env, 'EMBEDDING_MODEL_ID');
  const modelVersionOrRevision = required(env, 'EMBEDDING_MODEL_VERSION_OR_REVISION');
  const denseDimension = integer(env, 'EMBEDDING_DENSE_DIMENSION', { min: 1, required: true });
  const denseOutputParam = raw(env, 'EMBEDDING_OUTPUT_TYPE_DENSE_PARAM');
  const denseSparseOutputParam = raw(env, 'EMBEDDING_OUTPUT_TYPE_DENSE_SPARSE_PARAM');
  const textTypeValue = raw(env, 'EMBEDDING_TEXT_TYPE') ?? 'document';
  if (textTypeValue !== 'query' && textTypeValue !== 'document') throw new EmbeddingConfigError('CONFIG_INVALID');
  const pricePer1kTokens = decimal(env, 'EMBEDDING_PRICE_PER_1K_TOKENS');
  const priceCurrencyValue = raw(env, 'EMBEDDING_PRICE_CURRENCY');
  if (priceCurrencyValue && !/^[A-Za-z]{3}$/.test(priceCurrencyValue)) throw new EmbeddingConfigError('CONFIG_INVALID');
  const verificationValue = raw(env, 'EMBEDDING_VERIFICATION_ENABLED') ?? 'false';
  if (verificationValue !== 'true' && verificationValue !== 'false') throw new EmbeddingConfigError('CONFIG_INVALID');

  const config: EmbeddingRuntimeConfig = {
    apiKey,
    ...endpoint,
    modelId,
    modelVersionOrRevision,
    denseDimension,
    textType: textTypeValue,
    requestTimeoutMs: integer(env, 'EMBEDDING_REQUEST_TIMEOUT_MS', { defaultValue: 10_000, min: 1_000, max: 60_000 }),
    maxAttempts: integer(env, 'EMBEDDING_MAX_ATTEMPTS', { defaultValue: 3, min: 1, max: 3 }),
    totalBudgetMs: integer(env, 'EMBEDDING_TOTAL_BUDGET_MS', { defaultValue: 35_000, min: 1, max: 120_000 }),
    retryBaseDelayMs: integer(env, 'EMBEDDING_RETRY_BASE_DELAY_MS', { defaultValue: 250, min: 50, max: 2_000 }),
    maxBatchSize: integer(env, 'EMBEDDING_MAX_BATCH_SIZE', { defaultValue: 16, min: 1, max: 64 }),
    maxInputChars: integer(env, 'EMBEDDING_MAX_INPUT_CHARS', { defaultValue: 6_000, min: 1, max: 32_000 }),
    maxSparseElements: integer(env, 'EMBEDDING_MAX_SPARSE_ELEMENTS', { defaultValue: 20_000, min: 1, max: 65_536 }),
    maxTokensPerCall: integer(env, 'EMBEDDING_MAX_TOKENS_PER_CALL', { defaultValue: 200_000, min: 1 }),
    maxTokensPerProcess: integer(env, 'EMBEDDING_MAX_TOKENS_PER_PROCESS', { defaultValue: 2_000_000, min: 1 }),
    verificationEnabled: verificationValue === 'true',
    ...(denseOutputParam ? { denseOutputParam } : {}),
    ...(denseSparseOutputParam ? { denseSparseOutputParam } : {}),
    ...(raw(env, 'EMBEDDING_SPARSE_VOCABULARY_MAX')
      ? { sparseVocabularyMax: integer(env, 'EMBEDDING_SPARSE_VOCABULARY_MAX', { min: 1, required: true }) }
      : {}),
    ...(pricePer1kTokens !== undefined ? { pricePer1kTokens } : {}),
    ...(pricePer1kTokens !== undefined ? { priceCurrency: (priceCurrencyValue ?? 'CNY').toUpperCase() } : {}),
  };
  return Object.freeze(config);
}
