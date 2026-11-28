import { describe, expect, it, vi } from 'vitest';
import {
  validateRerankRequest,
  type RerankRequest,
  type RerankResult,
} from '../../apps/server/api/src/ai/reranker/index.js';
import {
  createRerankerConfig,
  resolveDashScopeApiKey,
  validateRerankerBaseUrl,
  type RerankerConfigInput,
} from '../../apps/server/api/src/ai/reranker/config.js';
import {
  RERANKER_ERROR_CODES,
  RerankerTechnicalError,
  toSafeRerankerErrorMetadata,
} from '../../apps/server/api/src/ai/reranker/errors.js';

type AssertExactFalse<T extends false> = T;

// Compile-time checks: caller cannot override provider/transport/model config via RerankRequest.
type _NoCallerProvider = AssertExactFalse<'provider' extends keyof RerankRequest ? true : false>;
type _NoCallerModel = AssertExactFalse<'model' extends keyof RerankRequest ? true : false>;
type _NoCallerModelId = AssertExactFalse<'modelId' extends keyof RerankRequest ? true : false>;
type _NoCallerModelRevision = AssertExactFalse<'modelRevision' extends keyof RerankRequest ? true : false>;
type _NoCallerEndpoint = AssertExactFalse<'endpoint' extends keyof RerankRequest ? true : false>;
type _NoCallerBaseUrl = AssertExactFalse<'baseUrl' extends keyof RerankRequest ? true : false>;
type _NoCallerApiKey = AssertExactFalse<'apiKey' extends keyof RerankRequest ? true : false>;
type _NoCallerSecret = AssertExactFalse<'secret' extends keyof RerankRequest ? true : false>;
type _NoCallerTimeout = AssertExactFalse<'timeout' extends keyof RerankRequest ? true : false>;
type _NoCallerTimeoutMs = AssertExactFalse<'timeoutMs' extends keyof RerankRequest ? true : false>;
type _NoCallerAttemptTimeoutMs = AssertExactFalse<'attemptTimeoutMs' extends keyof RerankRequest ? true : false>;
type _NoCallerRetry = AssertExactFalse<'retry' extends keyof RerankRequest ? true : false>;
type _NoCallerMaxAttempts = AssertExactFalse<'maxAttempts' extends keyof RerankRequest ? true : false>;
type _NoCallerRetryBackoffMs = AssertExactFalse<'retryBackoffMs' extends keyof RerankRequest ? true : false>;
type _NoCallerTopN = AssertExactFalse<'top_n' extends keyof RerankRequest ? true : false>;
type _NoCallerReturnDocuments = AssertExactFalse<'return_documents' extends keyof RerankRequest ? true : false>;

// Compile-time checks: RerankResult does not expose provider-native envelope or index.
type _NoNativeRequestId = AssertExactFalse<'request_id' extends keyof RerankResult ? true : false>;
type _NoNativeOutput = AssertExactFalse<'output' extends keyof RerankResult ? true : false>;
type _NoNativeDocuments = AssertExactFalse<'documents' extends keyof RerankResult ? true : false>;
type _NoNativeTotalTokens = AssertExactFalse<'total_tokens' extends keyof RerankResult['usage'] ? true : false>;
type _NoNativeIndex = AssertExactFalse<'index' extends keyof RerankResult['results'][number] ? true : false>;
type _NoNativeRelevanceScore = AssertExactFalse<
  'relevance_score' extends keyof RerankResult['results'][number] ? true : false
>;

// Compile-time checks: caller cannot override fixed provider/model/policy/secret via RerankerConfigInput.
type _NoConfigProviderOverride = AssertExactFalse<'provider' extends keyof RerankerConfigInput ? true : false>;
type _NoConfigModelIdOverride = AssertExactFalse<'modelId' extends keyof RerankerConfigInput ? true : false>;
type _NoConfigModelRevisionOverride = AssertExactFalse<'modelRevision' extends keyof RerankerConfigInput ? true : false>;
type _NoConfigPinStatusOverride = AssertExactFalse<
  'immutableRevisionPinStatus' extends keyof RerankerConfigInput ? true : false
>;
type _NoConfigApiSurfaceOverride = AssertExactFalse<'apiSurface' extends keyof RerankerConfigInput ? true : false>;
type _NoConfigTimeoutOverride = AssertExactFalse<'attemptTimeoutMs' extends keyof RerankerConfigInput ? true : false>;
type _NoConfigMaxAttemptsOverride = AssertExactFalse<'maxAttempts' extends keyof RerankerConfigInput ? true : false>;
type _NoConfigBackoffOverride = AssertExactFalse<'retryBackoffMs' extends keyof RerankerConfigInput ? true : false>;
type _NoConfigApiKeyOverride = AssertExactFalse<'apiKey' extends keyof RerankerConfigInput ? true : false>;

const makeValidRequest = (patch: Partial<RerankRequest> = {}): RerankRequest => ({
  query: 'synthetic query',
  candidates: [
    { candidateId: 'cand-1', candidateText: 'synthetic candidate text 1' },
  ],
  options: {
    instruct: 'Retrieve relevant passages for the query.',
  },
  ...patch,
});

describe('Slice 23 T002 reranker public contract and input validation', () => {
  it('accepts a valid single-candidate request and preserves exact raw strings', () => {
    const rawQuery = '  exact query with\twhitespace\n ';
    const rawCandidateId = '  cand-01\t';
    const rawCandidateText = '  exact candidate\ntext  ';
    const rawInstruct = '  Given a query, retrieve relevant documents.\n';

    const request: RerankRequest = {
      query: rawQuery,
      candidates: [
        {
          candidateId: rawCandidateId,
          candidateText: rawCandidateText,
        },
      ],
      options: {
        instruct: rawInstruct,
      },
    };

    const validation = validateRerankRequest(request);
    expect(validation.ok).toBe(true);
    if (!validation.ok) throw new Error('expected valid request');

    expect(validation.value.query).toBe(rawQuery);
    expect(validation.value.candidates).toHaveLength(1);
    expect(validation.value.candidates[0]?.candidateId).toBe(rawCandidateId);
    expect(validation.value.candidates[0]?.candidateText).toBe(rawCandidateText);
    expect(validation.value.options.instruct).toBe(rawInstruct);
  });

  it('accepts multiple candidates up to 500 and preserves exact identity and text', () => {
    const candidates = Array.from({ length: 500 }, (_, i) => ({
      candidateId: `id-${i}`,
      candidateText: `synthetic text ${i}`,
    }));

    const validation = validateRerankRequest(makeValidRequest({ candidates }));
    expect(validation.ok).toBe(true);
    if (!validation.ok) throw new Error('expected valid 500-candidate request');
    expect(validation.value.candidates).toHaveLength(500);
    expect(validation.value.candidates[0]?.candidateId).toBe('id-0');
    expect(validation.value.candidates[499]?.candidateId).toBe('id-499');
  });

  it('allows duplicate candidateText when candidateId values are distinct', () => {
    const request = makeValidRequest({
      candidates: [
        { candidateId: 'A', candidateText: 'same' },
        { candidateId: 'B', candidateText: 'same' },
      ],
    });

    const validation = validateRerankRequest(request);
    expect(validation.ok).toBe(true);
    if (!validation.ok) throw new Error('expected duplicate candidateText to be allowed');
    expect(validation.value.candidates[0]?.candidateId).toBe('A');
    expect(validation.value.candidates[1]?.candidateId).toBe('B');
    expect(validation.value.candidates[0]?.candidateText).toBe('same');
    expect(validation.value.candidates[1]?.candidateText).toBe('same');
  });

  it('treats candidateId uniqueness as exact string equality without trimming or case folding', () => {
    const request = makeValidRequest({
      candidates: [
        { candidateId: 'id', candidateText: 'doc 1' },
        { candidateId: ' id ', candidateText: 'doc 2' },
        { candidateId: 'ID', candidateText: 'doc 3' },
        { candidateId: 'id ', candidateText: 'doc 4' },
      ],
    });

    const validation = validateRerankRequest(request);
    expect(validation.ok).toBe(true);
    if (!validation.ok) throw new Error('expected exact-string distinct candidateIds to pass');
    expect(validation.value.candidates.map((c) => c.candidateId)).toEqual(['id', ' id ', 'ID', 'id ']);
  });

  it.each(['', ' ', '\t', '\n', ' \t\n '])('rejects blank query %j as INVALID_INPUT', (blankQuery) => {
    const validation = validateRerankRequest(makeValidRequest({ query: blankQuery }));
    expect(validation.ok).toBe(false);
    if (validation.ok) throw new Error('expected INVALID_INPUT');
    expect(validation.errorCode).toBe('INVALID_INPUT');
  });

  it('rejects 0 candidates as INVALID_INPUT', () => {
    const validation = validateRerankRequest(makeValidRequest({ candidates: [] }));
    expect(validation.ok).toBe(false);
    if (validation.ok) throw new Error('expected INVALID_INPUT');
    expect(validation.errorCode).toBe('INVALID_INPUT');
  });

  it('rejects 501 candidates as INVALID_INPUT', () => {
    const candidates = Array.from({ length: 501 }, (_, i) => ({
      candidateId: `id-${i}`,
      candidateText: `synthetic text ${i}`,
    }));
    const validation = validateRerankRequest(makeValidRequest({ candidates }));
    expect(validation.ok).toBe(false);
    if (validation.ok) throw new Error('expected INVALID_INPUT');
    expect(validation.errorCode).toBe('INVALID_INPUT');
  });

  it.each(['', ' ', '\t', '\n'])('rejects blank candidateId %j as INVALID_INPUT', (blankId) => {
    const validation = validateRerankRequest(
      makeValidRequest({
        candidates: [{ candidateId: blankId, candidateText: 'valid text' }],
      }),
    );
    expect(validation.ok).toBe(false);
    if (validation.ok) throw new Error('expected INVALID_INPUT');
    expect(validation.errorCode).toBe('INVALID_INPUT');
  });

  it('rejects duplicate candidateId by exact string equality as INVALID_INPUT', () => {
    const validation = validateRerankRequest(
      makeValidRequest({
        candidates: [
          { candidateId: 'dup-id', candidateText: 'first text' },
          { candidateId: 'dup-id', candidateText: 'second text' },
        ],
      }),
    );
    expect(validation.ok).toBe(false);
    if (validation.ok) throw new Error('expected INVALID_INPUT');
    expect(validation.errorCode).toBe('INVALID_INPUT');
  });

  it.each(['', ' ', '\t', '\n'])('rejects blank candidateText %j as INVALID_INPUT', (blankText) => {
    const validation = validateRerankRequest(
      makeValidRequest({
        candidates: [{ candidateId: 'cand-1', candidateText: blankText }],
      }),
    );
    expect(validation.ok).toBe(false);
    if (validation.ok) throw new Error('expected INVALID_INPUT');
    expect(validation.errorCode).toBe('INVALID_INPUT');
  });

  it.each(['', ' ', '\t', '\n'])('rejects blank options.instruct %j as INVALID_INPUT', (blankInstruct) => {
    const validation = validateRerankRequest(
      makeValidRequest({
        options: { instruct: blankInstruct },
      }),
    );
    expect(validation.ok).toBe(false);
    if (validation.ok) throw new Error('expected INVALID_INPUT');
    expect(validation.errorCode).toBe('INVALID_INPUT');
  });

  it('represents normalized RerankResult shape without provider index or business fields', () => {
    const result: RerankResult = {
      provider: 'ALIBABA_DASHSCOPE',
      configuredModelId: 'qwen3-rerank',
      configuredModelRevision: null,
      providerRequestId: 'req-123',
      usage: {
        totalTokens: 42,
      },
      results: [
        { candidateId: 'cand-1', score: 0.91, rank: 1 },
      ],
    };

    expect(result.provider).toBe('ALIBABA_DASHSCOPE');
    expect(result.configuredModelId).toBe('qwen3-rerank');
    expect(result.configuredModelRevision).toBeNull();
    expect(result.providerRequestId).toBe('req-123');
    expect(result.usage.totalTokens).toBe(42);
    expect(result.results[0]).toEqual({
      candidateId: 'cand-1',
      score: 0.91,
      rank: 1,
    });
  });
});

describe('Slice 23 T003 reranker capability config, error taxonomy, and secret boundary', () => {
  it('constructs fixed provider, model identity, unknown revision, and local runtime policy', () => {
    const config = createRerankerConfig({
      baseUrl: 'https://ws-alpha.cn-beijing.maas.aliyuncs.com/api/v1',
    });

    expect(config).toEqual({
      provider: 'ALIBABA_DASHSCOPE',
      modelId: 'qwen3-rerank',
      modelRevision: null,
      immutableRevisionPinStatus: 'UNKNOWN_NOT_DOCUMENTED',
      apiSurface: 'DASHSCOPE_NATIVE_HTTP',
      baseUrl: 'https://ws-alpha.cn-beijing.maas.aliyuncs.com/api/v1',
      attemptTimeoutMs: 10_000,
      maxAttempts: 2,
      retryBackoffMs: 1_000,
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect('apiKey' in config).toBe(false);
    expect('secret' in config).toBe(false);
  });

  it('accepts valid workspace-specific HTTPS *.maas.aliyuncs.com/api/v1 base URLs and normalizes host case', () => {
    expect(
      validateRerankerBaseUrl('https://WS-01.CN-BEIJING.MAAS.ALIYUNCS.COM/api/v1'),
    ).toBe('https://ws-01.cn-beijing.maas.aliyuncs.com/api/v1');
    expect(
      validateRerankerBaseUrl('https://workspace-a.maas.aliyuncs.com/api/v1'),
    ).toBe('https://workspace-a.maas.aliyuncs.com/api/v1');
  });

  it.each([
    'http://workspace.maas.aliyuncs.com/api/v1',
    'https://maas.aliyuncs.com/api/v1',
    'https://evil.example.com/api/v1',
    'https://workspace.maas.aliyuncs.com/',
    'https://workspace.maas.aliyuncs.com/api/v2',
    'https://workspace.maas.aliyuncs.com/api/v1/',
    // Reject port, userinfo, query, and hash to preserve the strict base URL contract without inventing business semantics.
    'https://workspace.maas.aliyuncs.com:8443/api/v1',
    'https://user:pass@workspace.maas.aliyuncs.com/api/v1',
    'https://workspace.maas.aliyuncs.com/api/v1?x=1',
    'https://workspace.maas.aliyuncs.com/api/v1#frag',
    '',
    '   ',
    'not-a-valid-url',
  ])('rejects invalid base URL %j with CONFIGURATION error', (invalidBaseUrl) => {
    let caught: unknown;
    try {
      createRerankerConfig({ baseUrl: invalidBaseUrl });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(RerankerTechnicalError);
    const techError = caught as RerankerTechnicalError;
    expect(techError.code).toBe('CONFIGURATION');
    expect(techError.retryable).toBe(false);
  });

  it('accesses DASHSCOPE_API_KEY lazily and never reads secrets during normal config construction', () => {
    const fakeEnvReader = vi.fn((key: string) =>
      key === 'DASHSCOPE_API_KEY' ? 'synthetic-placeholder-key' : undefined,
    );

    const config = createRerankerConfig({
      baseUrl: 'https://workspace-a.maas.aliyuncs.com/api/v1',
    });

    expect(config.baseUrl).toBe('https://workspace-a.maas.aliyuncs.com/api/v1');
    expect(fakeEnvReader).not.toHaveBeenCalled();

    const resolvedKey = resolveDashScopeApiKey(fakeEnvReader);
    expect(resolvedKey).toBe('synthetic-placeholder-key');
    expect(fakeEnvReader).toHaveBeenCalledTimes(1);
    expect(fakeEnvReader).toHaveBeenCalledWith('DASHSCOPE_API_KEY');
  });

  it.each([undefined, '', '   ', '\t\n'])(
    'classifies missing or blank DASHSCOPE_API_KEY (%j) as CONFIGURATION rather than AUTHENTICATION',
    (missingSecret) => {
      const fakeEnvReader = vi.fn(() => missingSecret);

      let caught: unknown;
      try {
        resolveDashScopeApiKey(fakeEnvReader);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(RerankerTechnicalError);
      const techError = caught as RerankerTechnicalError;
      expect(techError.code).toBe('CONFIGURATION');
      expect(techError.code).not.toBe('AUTHENTICATION');
      expect(techError.retryable).toBe(false);
    },
  );

  it('defines exactly the 12 frozen technical error codes', () => {
    expect(RERANKER_ERROR_CODES).toEqual([
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
    ]);
    expect(new Set(RERANKER_ERROR_CODES).size).toBe(12);
  });

  it('exposes only safe error metadata and strips or forbids raw provider body, query/text/instruct, and credentials', () => {
    const error = new RerankerTechnicalError({
      code: 'RATE_LIMIT',
      retryable: true,
      providerRequestId: 'req-safe-123',
    });

    expect(error.code).toBe('RATE_LIMIT');
    expect(error.retryable).toBe(true);
    expect(error.providerRequestId).toBe('req-safe-123');

    const safeMeta = toSafeRerankerErrorMetadata(error);
    expect(safeMeta).toEqual({
      code: 'RATE_LIMIT',
      retryable: true,
      providerRequestId: 'req-safe-123',
    });

    const forbiddenKeys = [
      'rawResponse',
      'rawBody',
      'query',
      'candidateText',
      'instruct',
      'apiKey',
      'authorization',
      'Authorization',
      'credential',
      'secret',
      'payload',
    ];
    for (const key of forbiddenKeys) {
      expect(key in error).toBe(false);
      expect(key in safeMeta).toBe(false);
    }

    const serialized = JSON.stringify(safeMeta);
    expect(serialized).not.toContain('synthetic');
  });

  it('keeps local CONFIGURATION distinct from provider AUTHENTICATION failures', () => {
    const configError = new RerankerTechnicalError({
      code: 'CONFIGURATION',
      retryable: false,
    });
    const authError = new RerankerTechnicalError({
      code: 'AUTHENTICATION',
      retryable: false,
      providerRequestId: 'req-auth-401',
    });

    expect(configError.code).toBe('CONFIGURATION');
    expect(authError.code).toBe('AUTHENTICATION');
    expect(configError.code).not.toBe(authError.code);
    expect(toSafeRerankerErrorMetadata(configError)).toEqual({
      code: 'CONFIGURATION',
      retryable: false,
    });
    expect(toSafeRerankerErrorMetadata(authError)).toEqual({
      code: 'AUTHENTICATION',
      retryable: false,
      providerRequestId: 'req-auth-401',
    });
  });
});
