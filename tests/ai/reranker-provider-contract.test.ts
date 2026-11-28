import { describe, expect, it, vi } from 'vitest';
import {
  MAX_RERANK_CANDIDATES,
  createReranker,
  rerank,
  validateRerankRequest,
  type RerankRequest,
  type RerankResult,
} from '../../apps/server/api/src/ai/reranker/index.js';
import * as rerankerPublicIndex from '../../apps/server/api/src/ai/reranker/index.js';
import {
  createReranker as createRerankerWithDeps,
  rerank as rerankWithDeps,
} from '../../apps/server/api/src/ai/reranker/rerank.js';
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
import {
  createRerankerTransport,
  executeDashScopeRerank,
  isRetryableRerankerErrorCode,
  type RerankerFetch,
  type RerankerTransport,
} from '../../apps/server/api/src/ai/reranker/transport.js';
import {
  EVIDENCE_STATES,
  LOWER_EVIDENCE_PREDICATES,
  deriveAggregateTechnicalResult,
  deriveCleanupSecretSafetyState,
  deriveConfigIdentityState,
  deriveContractMechanicsState,
  deriveLiveProviderCapabilityState,
  evaluateTechnicalEvidence,
  type EvidenceState,
  type LowerEvidenceStates,
} from '../../apps/server/api/src/ai/reranker/evidence.js';
import {
  RERANKER_TELEMETRY_WHITELIST_KEYS,
  buildRerankerTelemetryRecord,
  createSafeConfigFingerprint,
  createSafeRequestFingerprint,
  sanitizeTelemetryRecord,
} from '../../apps/server/api/src/ai/reranker/telemetry.js';

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

const T007_BASE_URL = 'https://ws-123.cn-beijing.maas.aliyuncs.com/api/v1';

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

  it('accepts valid workspace+region HTTPS *.maas.aliyuncs.com/api/v1 base URLs and normalizes host case', () => {
    expect(
      validateRerankerBaseUrl('https://WS-01.CN-BEIJING.MAAS.ALIYUNCS.COM/api/v1'),
    ).toBe('https://ws-01.cn-beijing.maas.aliyuncs.com/api/v1');
    expect(
      validateRerankerBaseUrl('https://workspace-a.ap-southeast-1.maas.aliyuncs.com/api/v1'),
    ).toBe('https://workspace-a.ap-southeast-1.maas.aliyuncs.com/api/v1');
  });

  it('rejects workspace hosts without exactly workspace+region DNS labels (S23-A2-M04)', () => {
    for (const invalidBaseUrl of [
      'https://workspace-a.maas.aliyuncs.com/api/v1',
      'https://cn-beijing.maas.aliyuncs.com/api/v1',
      'https://workspace-a.cn-beijing.extra.maas.aliyuncs.com/api/v1',
      'https://-workspace.cn-beijing.maas.aliyuncs.com/api/v1',
      'https://workspace-.cn-beijing.maas.aliyuncs.com/api/v1',
    ]) {
      let caught: unknown;
      try {
        validateRerankerBaseUrl(invalidBaseUrl);
      } catch (error) {
        caught = error;
      }
      expect(caught, invalidBaseUrl).toBeInstanceOf(RerankerTechnicalError);
      expect((caught as RerankerTechnicalError).code).toBe('CONFIGURATION');
      expect((caught as RerankerTechnicalError).retryable).toBe(false);
    }
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
      baseUrl: 'https://workspace-a.cn-beijing.maas.aliyuncs.com/api/v1',
    });

    expect(config.baseUrl).toBe('https://workspace-a.cn-beijing.maas.aliyuncs.com/api/v1');
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

describe('Slice 23 T004 reranker native HTTP transport, timeout, and bounded retry', () => {
  const createTestConfig = () =>
    createRerankerConfig({
      baseUrl: 'https://ws-alpha.cn-beijing.maas.aliyuncs.com/api/v1',
    });

  const makeTransportRequest = () => ({
    path: '/services/rerank/text-rerank/text-rerank',
    body: {
      model: 'qwen3-rerank',
      input: {
        query: 'synthetic query',
        documents: ['synthetic doc 1'],
      },
      parameters: {
        top_n: 1,
        return_documents: false,
        instruct: 'Retrieve relevant documents.',
      },
    },
  });

  const makeEnvReader = (secret = 'synthetic-placeholder-key') =>
    vi.fn((key: string) => (key === 'DASHSCOPE_API_KEY' ? secret : undefined));

  const makeJsonResponse = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  it('constructs Authorization Bearer header only at send time and never persists secrets', async () => {
    const config = createTestConfig();
    const envReader = makeEnvReader('synthetic-send-time-secret');
    const capturedAuthHeaders: string[] = [];

    const fakeFetch: RerankerFetch = vi.fn(async (_url, init) => {
      const headers = new Headers(init?.headers);
      capturedAuthHeaders.push(headers.get('Authorization') ?? '');
      return makeJsonResponse(200, {
        request_id: 'req-ok-1',
        output: { results: [{ index: 0, relevance_score: 0.9 }] },
        usage: { total_tokens: 10 },
      });
    });

    const transport = createRerankerTransport(config, {
      fetch: fakeFetch,
      envReader,
      sleep: vi.fn(async () => {}),
    });

    expect(envReader).not.toHaveBeenCalled();
    expect(JSON.stringify(transport)).not.toContain('synthetic-send-time-secret');

    const result = await transport.send(makeTransportRequest());

    expect(envReader).toHaveBeenCalledTimes(1);
    expect(envReader).toHaveBeenCalledWith('DASHSCOPE_API_KEY');
    expect(capturedAuthHeaders).toEqual(['Bearer synthetic-send-time-secret']);
    expect(result.status).toBe(200);
    expect(result.attempts).toBe(1);
    expect(transport.provider).toBe('ALIBABA_DASHSCOPE');
    expect(transport.modelId).toBe('qwen3-rerank');
    expect(JSON.stringify(transport)).not.toContain('synthetic-send-time-secret');
  });

  it('enforces 10000ms per-attempt client deadline via AbortController and retries TIMEOUT once after 1000ms', async () => {
    const config = createTestConfig();
    const envReader = makeEnvReader();
    const timerDelays: number[] = [];
    const sleepCalls: number[] = [];
    const scheduledCallbacks: Array<() => void> = [];

    const fakeFetch: RerankerFetch = vi.fn((_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const transport = createRerankerTransport(config, {
      fetch: fakeFetch,
      envReader,
      sleep: vi.fn(async (ms: number) => {
        sleepCalls.push(ms);
      }),
      setTimer: (cb, ms) => {
        timerDelays.push(ms);
        scheduledCallbacks.push(cb);
        // Trigger client deadline immediately in synthetic test clock
        queueMicrotask(cb);
        return scheduledCallbacks.length;
      },
      clearTimer: vi.fn(),
    });

    let caught: unknown;
    try {
      await transport.send(makeTransportRequest());
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(RerankerTechnicalError);
    const err = caught as RerankerTechnicalError;
    expect(err.code).toBe('TIMEOUT');
    expect(err.retryable).toBe(true);
    expect(fakeFetch).toHaveBeenCalledTimes(2);
    expect(timerDelays).toEqual([10_000, 10_000]);
    expect(sleepCalls).toEqual([1_000]);
  });

  it('allows at most 2 attempts with 1000ms backoff before attempt 2 and never executes a 3rd attempt', async () => {
    const config = createTestConfig();
    const sleepCalls: number[] = [];
    const fakeFetch: RerankerFetch = vi.fn(async () => {
      throw new TypeError('connect ECONNREFUSED');
    });

    const transport = createRerankerTransport(config, {
      fetch: fakeFetch,
      envReader: makeEnvReader(),
      sleep: vi.fn(async (ms: number) => {
        sleepCalls.push(ms);
      }),
    });

    let caught: unknown;
    try {
      await transport.send(makeTransportRequest());
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(RerankerTechnicalError);
    expect((caught as RerankerTechnicalError).code).toBe('PROVIDER_UNAVAILABLE');
    expect(fakeFetch).toHaveBeenCalledTimes(2);
    expect(sleepCalls).toEqual([1_000]);
  });

  it('retries connection failure once and succeeds on attempt 2 without changing provider or model', async () => {
    const config = createTestConfig();
    const sleepCalls: number[] = [];
    const urls: string[] = [];
    const models: string[] = [];

    const fakeFetch: RerankerFetch = vi
      .fn()
      .mockImplementationOnce(async (url, init) => {
        urls.push(String(url));
        models.push(JSON.parse(String(init?.body)).model);
        throw new TypeError('network down');
      })
      .mockImplementationOnce(async (url, init) => {
        urls.push(String(url));
        models.push(JSON.parse(String(init?.body)).model);
        return makeJsonResponse(200, {
          request_id: 'req-retry-ok',
          output: { results: [{ index: 0, relevance_score: 0.8 }] },
          usage: { total_tokens: 12 },
        });
      });

    const transport = createRerankerTransport(config, {
      fetch: fakeFetch,
      envReader: makeEnvReader(),
      sleep: vi.fn(async (ms: number) => {
        sleepCalls.push(ms);
      }),
    });

    const res = await transport.send(makeTransportRequest());
    expect(res.attempts).toBe(2);
    expect(res.providerRequestId).toBe('req-retry-ok');
    expect(sleepCalls).toEqual([1_000]);
    expect(urls).toEqual([
      'https://ws-alpha.cn-beijing.maas.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank',
      'https://ws-alpha.cn-beijing.maas.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank',
    ]);
    expect(models).toEqual(['qwen3-rerank', 'qwen3-rerank']);
  });

  it.each(['ServiceUnavailable', 'ModelUnavailable'])(
    'retries temporary HTTP 503 %s once after 1000ms',
    async (providerCode) => {
      const config = createTestConfig();
      const sleepCalls: number[] = [];
      const fakeFetch: RerankerFetch = vi
        .fn()
        .mockResolvedValueOnce(
          makeJsonResponse(503, {
            code: providerCode,
            message: 'temporary unavailable',
            request_id: 'req-503-1',
          }),
        )
        .mockResolvedValueOnce(
          makeJsonResponse(503, {
            code: providerCode,
            message: 'still unavailable',
            request_id: 'req-503-2',
          }),
        );

      const transport = createRerankerTransport(config, {
        fetch: fakeFetch,
        envReader: makeEnvReader(),
        sleep: vi.fn(async (ms: number) => {
          sleepCalls.push(ms);
        }),
      });

      let caught: unknown;
      try {
        await transport.send(makeTransportRequest());
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(RerankerTechnicalError);
      const err = caught as RerankerTechnicalError;
      expect(err.code).toBe('PROVIDER_UNAVAILABLE');
      expect(err.retryable).toBe(true);
      expect(err.providerRequestId).toBe('req-503-2');
      expect(fakeFetch).toHaveBeenCalledTimes(2);
      expect(sleepCalls).toEqual([1_000]);
    },
  );

  it('retries documented transient throttle 429 once after 1000ms', async () => {
    const config = createTestConfig();
    const sleepCalls: number[] = [];
    const fakeFetch: RerankerFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse(429, {
          code: 'Throttling',
          message: 'rate limit',
          request_id: 'req-429-1',
        }),
      )
      .mockResolvedValueOnce(
        makeJsonResponse(200, {
          request_id: 'req-429-ok',
          output: { results: [{ index: 0, relevance_score: 0.7 }] },
          usage: { total_tokens: 9 },
        }),
      );

    const transport = createRerankerTransport(config, {
      fetch: fakeFetch,
      envReader: makeEnvReader(),
      sleep: vi.fn(async (ms: number) => {
        sleepCalls.push(ms);
      }),
    });

    const res = await transport.send(makeTransportRequest());
    expect(res.attempts).toBe(2);
    expect(sleepCalls).toEqual([1_000]);
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      label: 'AUTHENTICATION (401 InvalidApiKey)',
      status: 401,
      body: { code: 'InvalidApiKey', message: 'bad key', request_id: 'req-401' },
      expectedCode: 'AUTHENTICATION',
    },
    {
      label: 'AUTHORIZATION (403 AccessDenied)',
      status: 403,
      body: { code: 'AccessDenied', message: 'forbidden', request_id: 'req-403' },
      expectedCode: 'AUTHORIZATION',
    },
    {
      label: 'INVALID_INPUT (400 InvalidParameter)',
      status: 400,
      body: { code: 'InvalidParameter', message: 'bad param', request_id: 'req-400' },
      expectedCode: 'INVALID_INPUT',
    },
    {
      label: 'quota/budget exhaustion (429 AllocationQuota)',
      status: 429,
      body: { code: 'AllocationQuota', message: 'quota exhausted', request_id: 'req-429-quota' },
      expectedCode: 'RATE_LIMIT',
    },
    {
      label: 'UNSUPPORTED_CAPABILITY (404 ModelNotFound)',
      status: 404,
      body: { code: 'ModelNotFound', message: 'not found', request_id: 'req-404' },
      expectedCode: 'UNSUPPORTED_CAPABILITY',
    },
    {
      label: 'UNKNOWN_PROVIDER_FAILURE (unclassified 500)',
      status: 500,
      body: { code: 'SomeUnclassifiedError', message: 'raw secret leak', request_id: 'req-500' },
      expectedCode: 'UNKNOWN_PROVIDER_FAILURE',
    },
  ])('does not retry terminal error $label and preserves safe providerRequestId only', async ({
    status,
    body,
    expectedCode,
  }) => {
    const config = createTestConfig();
    const sleepCalls: number[] = [];
    const fakeFetch: RerankerFetch = vi.fn(async () => makeJsonResponse(status, body));

    const transport = createRerankerTransport(config, {
      fetch: fakeFetch,
      envReader: makeEnvReader(),
      sleep: vi.fn(async (ms: number) => {
        sleepCalls.push(ms);
      }),
    });

    let caught: unknown;
    try {
      await transport.send(makeTransportRequest());
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(RerankerTechnicalError);
    const err = caught as RerankerTechnicalError;
    expect(err.code).toBe(expectedCode);
    expect(err.retryable).toBe(false);
    expect(err.providerRequestId).toBe(body.request_id);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
    expect(sleepCalls).toEqual([]);
    expect(JSON.stringify(toSafeRerankerErrorMetadata(err))).not.toContain('raw secret leak');
  });

  it.each([
    'CONFIGURATION',
    'AUTHENTICATION',
    'AUTHORIZATION',
    'INVALID_INPUT',
    'UNSUPPORTED_CAPABILITY',
    'MALFORMED_RESPONSE',
    'IDENTITY_MAPPING_FAILURE',
    'PARTIAL_RESPONSE',
    'UNKNOWN_PROVIDER_FAILURE',
  ] as const)('marks error code %s as non-retryable in transport retry policy', (code) => {
    expect(isRetryableRerankerErrorCode(code)).toBe(false);
  });

  it.each([302, 307, 308])(
    'never auto-follows a native HTTP %d redirect and fails closed without retry (S23-A2-B01)',
    async (status) => {
      const config = createTestConfig();
      const redirectTarget = 'https://unapproved.example.com/steal';
      const requestedUrls: string[] = [];
      const fetchInits: Array<RequestInit | undefined> = [];
      const sleepCalls: number[] = [];

      const fakeFetch: RerankerFetch = vi.fn(async (url, init) => {
        requestedUrls.push(String(url));
        fetchInits.push(init);
        return new Response(null, {
          status,
          headers: { location: redirectTarget },
        });
      });

      const transport = createRerankerTransport(config, {
        fetch: fakeFetch,
        envReader: makeEnvReader('synthetic-redirect-secret'),
        sleep: vi.fn(async (ms: number) => {
          sleepCalls.push(ms);
        }),
      });

      let caught: unknown;
      try {
        await transport.send(makeTransportRequest());
      } catch (error) {
        caught = error;
      }

      expect(fetchInits[0]?.redirect).toBe('manual');
      expect(requestedUrls).toEqual([
        'https://ws-alpha.cn-beijing.maas.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank',
      ]);
      expect(requestedUrls).not.toContain(redirectTarget);
      expect(fakeFetch).toHaveBeenCalledTimes(1);
      expect(sleepCalls).toEqual([]);
      expect(caught).toBeInstanceOf(RerankerTechnicalError);
      const err = caught as RerankerTechnicalError;
      expect(err.code).toBe('UNKNOWN_PROVIDER_FAILURE');
      expect(err.retryable).toBe(false);
      expect(JSON.stringify(toSafeRerankerErrorMetadata(err))).not.toContain(
        'synthetic-redirect-secret',
      );
    },
  );

  it.each([
    { status: 401, expectedCode: 'AUTHENTICATION' },
    { status: 403, expectedCode: 'AUTHORIZATION' },
    { status: 400, expectedCode: 'INVALID_INPUT' },
    { status: 404, expectedCode: 'UNSUPPORTED_CAPABILITY' },
    { status: 429, expectedCode: 'RATE_LIMIT' },
    { status: 500, expectedCode: 'UNKNOWN_PROVIDER_FAILURE' },
    { status: 200, expectedCode: 'MALFORMED_RESPONSE' },
  ] as const)(
    'treats a $status response with an unreadable body as terminal $expectedCode without retry (S23-A2-M03)',
    async ({ status, expectedCode }) => {
      const config = createTestConfig();
      const sleepCalls: number[] = [];

      const makeUnreadableResponse = (): Response => {
        const response = new Response(null, { status });
        Object.defineProperty(response, 'text', {
          value: async () => {
            throw new Error('response body stream failed');
          },
        });
        return response;
      };

      const fakeFetch: RerankerFetch = vi.fn(async () => makeUnreadableResponse());
      const transport = createRerankerTransport(config, {
        fetch: fakeFetch,
        envReader: makeEnvReader(),
        sleep: vi.fn(async (ms: number) => {
          sleepCalls.push(ms);
        }),
      });

      let caught: unknown;
      try {
        await transport.send(makeTransportRequest());
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(RerankerTechnicalError);
      const err = caught as RerankerTechnicalError;
      expect(err.code).toBe(expectedCode);
      expect(err.retryable).toBe(false);
      expect(fakeFetch).toHaveBeenCalledTimes(1);
      expect(sleepCalls).toEqual([]);
    },
  );

  it('snapshots candidate identity before the first async boundary so caller mutation cannot remap results (S23-A2-B02)', async () => {
    const candidates = [
      { candidateId: 'cand-A', candidateText: 'text A' },
      { candidateId: 'cand-B', candidateText: 'text B' },
    ];
    const request: RerankRequest = {
      query: 'synthetic identity query',
      candidates,
      options: { instruct: 'synthetic identity instruct' },
    };

    const sentBodies: unknown[] = [];
    const fakeTransport: RerankerTransport = {
      provider: 'ALIBABA_DASHSCOPE',
      modelId: 'qwen3-rerank',
      async send(transportRequest) {
        sentBodies.push(transportRequest.body);
        // Caller mutates its own array/objects while the provider response is pending.
        candidates.reverse();
        candidates[0]!.candidateId = 'CORRUPTED';
        candidates[0]!.candidateText = 'CORRUPTED';
        return {
          status: 200,
          attempts: 1,
          bodyText: JSON.stringify({
            request_id: 'req-b02',
            output: {
              results: [
                { index: 0, relevance_score: 0.9 },
                { index: 1, relevance_score: 0.2 },
              ],
            },
            usage: { total_tokens: 7 },
          }),
        };
      },
    };

    const parsed = await executeDashScopeRerank(request, fakeTransport);

    expect(sentBodies).toEqual([
      {
        model: 'qwen3-rerank',
        input: {
          query: 'synthetic identity query',
          documents: ['text A', 'text B'],
        },
        parameters: {
          top_n: 2,
          return_documents: false,
          instruct: 'synthetic identity instruct',
        },
      },
    ]);
    expect(parsed.results).toEqual([
      { index: 0, candidateId: 'cand-A', score: 0.9 },
      { index: 1, candidateId: 'cand-B', score: 0.2 },
    ]);
  });
});

describe('Slice 23 T006 deterministic rerank orchestration and normalized output', () => {
  const BASE_URL = 'https://ws-alpha.cn-beijing.maas.aliyuncs.com/api/v1';

  const makeFakeTransport = (
    handler: (request: { readonly path: string; readonly body: unknown }) => Promise<{
      readonly status: number;
      readonly bodyText: string;
      readonly attempts: number;
      readonly providerRequestId?: string;
    }>,
  ) => {
    const send = vi.fn(handler);
    return {
      provider: 'ALIBABA_DASHSCOPE' as const,
      modelId: 'qwen3-rerank' as const,
      send,
    };
  };

  it('validates input before egress and makes 0 transport calls on invalid requests', async () => {
    const transport = makeFakeTransport(async () => ({
      status: 200,
      bodyText: '{}',
      attempts: 1,
    }));
    const capability = createRerankerWithDeps({ baseUrl: T007_BASE_URL }, { transport });

    const invalidRequests: RerankRequest[] = [
      makeValidRequest({ query: '   ' }),
      makeValidRequest({ candidates: [] }),
      makeValidRequest({
        candidates: [
          { candidateId: 'dup', candidateText: 'a' },
          { candidateId: 'dup', candidateText: 'b' },
        ],
      }),
      makeValidRequest({ options: { instruct: '' } }),
    ];

    for (const invalidReq of invalidRequests) {
      let caught: unknown;
      try {
        await capability.rerank(invalidReq);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(RerankerTechnicalError);
      const techError = caught as RerankerTechnicalError;
      expect(techError.code).toBe('INVALID_INPUT');
      expect(techError.retryable).toBe(false);
    }

    expect(transport.send).not.toHaveBeenCalled();
  });

  it('orchestrates a valid single-candidate request and returns normalized RerankResult', async () => {
    const transport = makeFakeTransport(async () => ({
      status: 200,
      attempts: 1,
      providerRequestId: 'req-single-1',
      bodyText: JSON.stringify({
        request_id: 'req-single-1',
        usage: { total_tokens: 18 },
        output: {
          results: [{ index: 0, relevance_score: 0.88 }],
        },
      }),
    }));

    const result = await rerankWithDeps(
      makeValidRequest({
        candidates: [{ candidateId: 'only-one', candidateText: 'single doc' }],
      }),
      { baseUrl: T007_BASE_URL },
      { transport },
    );

    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      provider: 'ALIBABA_DASHSCOPE',
      configuredModelId: 'qwen3-rerank',
      configuredModelRevision: null,
      providerRequestId: 'req-single-1',
      usage: { totalTokens: 18 },
      results: [{ candidateId: 'only-one', score: 0.88, rank: 1 }],
    });
  });

  it('reorders multiple candidates by score descending, assigns rank 1..N, and preserves exact candidateId', async () => {
    const transport = makeFakeTransport(async () => ({
      status: 200,
      attempts: 1,
      providerRequestId: 'req-multi-1',
      bodyText: JSON.stringify({
        request_id: 'req-multi-1',
        usage: { total_tokens: 64 },
        output: {
          results: [
            { index: 2, relevance_score: 0.95 },
            { index: 0, relevance_score: 0.8 },
            { index: 1, relevance_score: 0.7 },
          ],
        },
      }),
    }));

    const result = await rerankWithDeps(
      makeValidRequest({
        candidates: [
          { candidateId: ' cand-A ', candidateText: 'alpha' },
          { candidateId: 'cand-B\t', candidateText: 'beta' },
          { candidateId: 'CAND-C', candidateText: 'gamma' },
        ],
      }),
      { baseUrl: T007_BASE_URL },
      { transport },
    );

    expect(result.results).toEqual([
      { candidateId: 'CAND-C', score: 0.95, rank: 1 },
      { candidateId: ' cand-A ', score: 0.8, rank: 2 },
      { candidateId: 'cand-B\t', score: 0.7, rank: 3 },
    ]);
    expect(result.results.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(new Set(result.results.map((r) => r.candidateId))).toEqual(
      new Set([' cand-A ', 'cand-B\t', 'CAND-C']),
    );
  });

  it('preserves exact candidateId mapping when candidateText values are duplicated', async () => {
    const transport = makeFakeTransport(async () => ({
      status: 200,
      attempts: 1,
      providerRequestId: 'req-dup-text',
      bodyText: JSON.stringify({
        request_id: 'req-dup-text',
        usage: { total_tokens: 30 },
        output: {
          results: [
            { index: 1, relevance_score: 0.91 },
            { index: 0, relevance_score: 0.42 },
          ],
        },
      }),
    }));

    const result = await rerankWithDeps(
      makeValidRequest({
        candidates: [
          { candidateId: 'A', candidateText: 'same' },
          { candidateId: 'B', candidateText: 'same' },
        ],
      }),
      { baseUrl: T007_BASE_URL },
      { transport },
    );

    expect(result.results).toEqual([
      { candidateId: 'B', score: 0.91, rank: 1 },
      { candidateId: 'A', score: 0.42, rank: 2 },
    ]);
  });

  it('breaks exact equal-score ties by original input index ascending regardless of provider tie order', async () => {
    const transport = makeFakeTransport(async () => ({
      status: 200,
      attempts: 1,
      providerRequestId: 'req-tie-1',
      bodyText: JSON.stringify({
        request_id: 'req-tie-1',
        usage: { total_tokens: 45 },
        output: {
          results: [
            { index: 1, relevance_score: 0.8 },
            { index: 0, relevance_score: 0.8 },
            { index: 2, relevance_score: 0.5 },
          ],
        },
      }),
    }));

    const result = await rerankWithDeps(
      makeValidRequest({
        candidates: [
          { candidateId: 'A', candidateText: 'doc A' },
          { candidateId: 'B', candidateText: 'doc B' },
          { candidateId: 'C', candidateText: 'doc C' },
        ],
      }),
      { baseUrl: T007_BASE_URL },
      { transport },
    );

    expect(result.results).toEqual([
      { candidateId: 'A', score: 0.8, rank: 1 },
      { candidateId: 'B', score: 0.8, rank: 2 },
      { candidateId: 'C', score: 0.5, rank: 3 },
    ]);
  });

  it('returns all candidates without relevance threshold filtering and omits provider-native index fields', async () => {
    const transport = makeFakeTransport(async () => ({
      status: 200,
      attempts: 1,
      providerRequestId: 'req-all-1',
      bodyText: JSON.stringify({
        request_id: 'req-all-1',
        usage: { total_tokens: 12 },
        output: {
          results: [
            { index: 0, relevance_score: 0.01 },
            { index: 1, relevance_score: 0 },
          ],
        },
      }),
    }));

    const result = await rerankWithDeps(
      makeValidRequest({
        candidates: [
          { candidateId: 'low-1', candidateText: 'doc 1' },
          { candidateId: 'zero-2', candidateText: 'doc 2' },
        ],
      }),
      { baseUrl: T007_BASE_URL },
      { transport },
    );

    expect(result.results).toHaveLength(2);
    expect(Object.keys(result).sort()).toEqual([
      'configuredModelId',
      'configuredModelRevision',
      'provider',
      'providerRequestId',
      'results',
      'usage',
    ]);
    for (const item of result.results) {
      expect(Object.keys(item).sort()).toEqual(['candidateId', 'rank', 'score']);
      expect('index' in item).toBe(false);
      expect('relevance_score' in item).toBe(false);
    }
  });

  it('fails closed without partial success when provider returns fewer results than candidates', async () => {
    const transport = makeFakeTransport(async () => ({
      status: 200,
      attempts: 1,
      providerRequestId: 'req-partial-1',
      bodyText: JSON.stringify({
        request_id: 'req-partial-1',
        usage: { total_tokens: 20 },
        output: {
          results: [{ index: 0, relevance_score: 0.9 }],
        },
      }),
    }));

    let caught: unknown;
    try {
      await rerankWithDeps(
        makeValidRequest({
          candidates: [
            { candidateId: 'A', candidateText: 'doc A' },
            { candidateId: 'B', candidateText: 'doc B' },
          ],
        }),
        { baseUrl: T007_BASE_URL },
        { transport },
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(RerankerTechnicalError);
    const err = caught as RerankerTechnicalError;
    expect(err.code).toBe('PARTIAL_RESPONSE');
    expect(err.providerRequestId).toBe('req-partial-1');
  });

  it('remains stateless across independent requests', async () => {
    let callCount = 0;
    const transport = makeFakeTransport(async () => {
      callCount += 1;
      if (callCount === 1) {
        return {
          status: 200,
          attempts: 1,
          providerRequestId: 'req-state-1',
          bodyText: JSON.stringify({
            request_id: 'req-state-1',
            usage: { total_tokens: 10 },
            output: {
              results: [
                { index: 0, relevance_score: 0.9 },
                { index: 1, relevance_score: 0.2 },
              ],
            },
          }),
        };
      }
      return {
        status: 200,
        attempts: 1,
        providerRequestId: 'req-state-2',
        bodyText: JSON.stringify({
          request_id: 'req-state-2',
          usage: { total_tokens: 25 },
          output: {
            results: [
              { index: 1, relevance_score: 0.99 },
              { index: 0, relevance_score: 0.11 },
            ],
          },
        }),
      };
    });

    const capability = createRerankerWithDeps({ baseUrl: T007_BASE_URL }, { transport });
    const req = makeValidRequest({
      candidates: [
        { candidateId: 'A', candidateText: 'doc A' },
        { candidateId: 'B', candidateText: 'doc B' },
      ],
    });

    const first = await capability.rerank(req);
    const second = await capability.rerank(req);

    expect(first.providerRequestId).toBe('req-state-1');
    expect(first.usage.totalTokens).toBe(10);
    expect(first.results.map((r) => r.candidateId)).toEqual(['A', 'B']);

    expect(second.providerRequestId).toBe('req-state-2');
    expect(second.usage.totalTokens).toBe(25);
    expect(second.results.map((r) => r.candidateId)).toEqual(['B', 'A']);
  });

  it('exposes bounded provider-neutral capability exports from index.ts', () => {
    expect(MAX_RERANK_CANDIDATES).toBe(500);
    expect(typeof createReranker).toBe('function');
    expect(typeof rerank).toBe('function');
    expect(typeof validateRerankRequest).toBe('function');
    expect('executeDashScopeRerank' in rerankerPublicIndex).toBe(false);
    expect('parseDashScopeRerankResponse' in rerankerPublicIndex).toBe(false);
    expect('createRerankerTransport' in rerankerPublicIndex).toBe(false);
    expect('resolveDashScopeApiKey' in rerankerPublicIndex).toBe(false);
    expect('createRerankerConfig' in rerankerPublicIndex).toBe(false);
  });
});

describe('Slice 23 T007 mechanical evidence state machine', () => {
  it('fixes the exact 5-state vocabulary and 4 lower predicates without READY semantics', () => {
    expect(EVIDENCE_STATES).toEqual([
      'PASS',
      'FAIL',
      'BLOCKED',
      'UNKNOWN',
      'NOT_EVALUATED',
    ]);
    expect(EVIDENCE_STATES).not.toContain('READY');
    expect(EVIDENCE_STATES).not.toContain('SUCCESS');
    expect(EVIDENCE_STATES).not.toContain('OK');
    expect(EVIDENCE_STATES).not.toContain('PARTIAL_PASS');
    expect(EVIDENCE_STATES).not.toContain('APPROVED');
    expect(EVIDENCE_STATES).not.toContain('PRODUCTION_READY');

    expect(LOWER_EVIDENCE_PREDICATES).toEqual([
      'CONTRACT_MECHANICS',
      'LIVE_PROVIDER_CAPABILITY',
      'CONFIG_IDENTITY',
      'CLEANUP_SECRET_SAFETY',
    ]);
  });

  it('derives aggregate technical result purely with FAIL > BLOCKED > UNKNOWN > NOT_EVALUATED > PASS regardless of predicate position', () => {
    const allPass: LowerEvidenceStates = {
      CONTRACT_MECHANICS: 'PASS',
      LIVE_PROVIDER_CAPABILITY: 'PASS',
      CONFIG_IDENTITY: 'PASS',
      CLEANUP_SECRET_SAFETY: 'PASS',
    };
    expect(deriveAggregateTechnicalResult(allPass)).toBe('PASS');

    // FAIL dominates BLOCKED, UNKNOWN, NOT_EVALUATED, PASS in every position
    for (const key of LOWER_EVIDENCE_PREDICATES) {
      const state: LowerEvidenceStates = {
        CONTRACT_MECHANICS: 'BLOCKED',
        LIVE_PROVIDER_CAPABILITY: 'UNKNOWN',
        CONFIG_IDENTITY: 'NOT_EVALUATED',
        CLEANUP_SECRET_SAFETY: 'PASS',
        [key]: 'FAIL',
      };
      expect(deriveAggregateTechnicalResult(state)).toBe('FAIL');
    }

    // BLOCKED dominates UNKNOWN, NOT_EVALUATED, PASS in every position
    for (const key of LOWER_EVIDENCE_PREDICATES) {
      const state: LowerEvidenceStates = {
        CONTRACT_MECHANICS: 'UNKNOWN',
        LIVE_PROVIDER_CAPABILITY: 'NOT_EVALUATED',
        CONFIG_IDENTITY: 'PASS',
        CLEANUP_SECRET_SAFETY: 'PASS',
        [key]: 'BLOCKED',
      };
      expect(deriveAggregateTechnicalResult(state)).toBe('BLOCKED');
    }

    // UNKNOWN dominates NOT_EVALUATED and PASS in every position
    for (const key of LOWER_EVIDENCE_PREDICATES) {
      const state: LowerEvidenceStates = {
        CONTRACT_MECHANICS: 'NOT_EVALUATED',
        LIVE_PROVIDER_CAPABILITY: 'PASS',
        CONFIG_IDENTITY: 'PASS',
        CLEANUP_SECRET_SAFETY: 'PASS',
        [key]: 'UNKNOWN',
      };
      expect(deriveAggregateTechnicalResult(state)).toBe('UNKNOWN');
    }

    // NOT_EVALUATED dominates PASS in every position
    for (const key of LOWER_EVIDENCE_PREDICATES) {
      const state: LowerEvidenceStates = {
        CONTRACT_MECHANICS: 'PASS',
        LIVE_PROVIDER_CAPABILITY: 'PASS',
        CONFIG_IDENTITY: 'PASS',
        CLEANUP_SECRET_SAFETY: 'PASS',
        [key]: 'NOT_EVALUATED',
      };
      expect(deriveAggregateTechnicalResult(state)).toBe('NOT_EVALUATED');
    }
  });

  it('does not allow any READY override or manual aggregate PASS flag', () => {
    const config = createRerankerConfig({ baseUrl: T007_BASE_URL });
    const report = evaluateTechnicalEvidence({
      contractMechanics: { executed: true, allPassed: true },
      liveProviderCapability: { attempted: false },
      config,
      cleanupSecretSafety: {
        checkCompleted: true,
        secretDetected: false,
        rawContentDetected: false,
        unauthorizedPersistenceDetected: false,
        repoResidueDetected: false,
      },
    });

    expect(report.lowerPredicates.CONTRACT_MECHANICS).toBe('PASS');
    expect(report.lowerPredicates.LIVE_PROVIDER_CAPABILITY).toBe('NOT_EVALUATED');
    expect(report.lowerPredicates.CONFIG_IDENTITY).toBe('UNKNOWN');
    expect(report.lowerPredicates.CLEANUP_SECRET_SAFETY).toBe('PASS');
    expect(report.aggregateTechnicalResult).toBe('UNKNOWN');

    expect('ready' in report).toBe(false);
    expect('isReady' in report).toBe(false);
    expect('forceReady' in report).toBe(false);
    expect('manualPass' in report).toBe(false);
    expect('overrideStatus' in report).toBe(false);

    // Passing extra READY-like properties at runtime cannot alter pure aggregate derivation.
    const tampered = {
      CONTRACT_MECHANICS: 'PASS',
      LIVE_PROVIDER_CAPABILITY: 'NOT_EVALUATED',
      CONFIG_IDENTITY: 'UNKNOWN',
      CLEANUP_SECRET_SAFETY: 'PASS',
      ready: true,
      isReady: true,
      forceReady: true,
      manualPass: true,
      overrideStatus: 'PASS',
    } as unknown as LowerEvidenceStates;

    expect(deriveAggregateTechnicalResult(tampered)).toBe('UNKNOWN');
  });

  it('prevents offline or mock evidence from setting LIVE_PROVIDER_CAPABILITY to PASS', () => {
    const offlineAttempt = deriveLiveProviderCapabilityState({
      attempted: true,
      provenance: 'OFFLINE_MOCK',
      exactHeadBound: true,
      exactConfigBound: true,
      validAccess: true,
      contractCompatible: true,
    });
    expect(offlineAttempt).not.toBe('PASS');
    expect(offlineAttempt).toBe('NOT_EVALUATED');

    const notAttempted = deriveLiveProviderCapabilityState({ attempted: false });
    expect(notAttempted).toBe('NOT_EVALUATED');

    const missingCreds = deriveLiveProviderCapabilityState({
      attempted: true,
      provenance: 'REAL_LIVE_CALL',
      exactHeadBound: true,
      exactConfigBound: true,
      validAccess: false,
      contractCompatible: null,
      missingPrerequisite: true,
    });
    expect(missingCreds).toBe('BLOCKED');

    const incompatible = deriveLiveProviderCapabilityState({
      attempted: true,
      provenance: 'REAL_LIVE_CALL',
      exactHeadBound: true,
      exactConfigBound: true,
      validAccess: true,
      contractCompatible: false,
    });
    expect(incompatible).toBe('FAIL');

    const unboundHead = deriveLiveProviderCapabilityState({
      attempted: true,
      provenance: 'REAL_LIVE_CALL',
      exactHeadBound: false,
      exactConfigBound: true,
      validAccess: true,
      contractCompatible: true,
    });
    expect(unboundHead).toBe('UNKNOWN');

    const realLivePass = deriveLiveProviderCapabilityState({
      attempted: true,
      provenance: 'REAL_LIVE_CALL',
      exactHeadBound: true,
      exactConfigBound: true,
      validAccess: true,
      contractCompatible: true,
    });
    expect(realLivePass).toBe('PASS');

    // Offline tests can only prove CONTRACT_MECHANICS
    expect(deriveContractMechanicsState({ executed: true, allPassed: true })).toBe('PASS');
    expect(deriveContractMechanicsState({ executed: true, allPassed: false })).toBe('FAIL');
    expect(deriveContractMechanicsState({ executed: false })).toBe('NOT_EVALUATED');
  });

  it('keeps CONFIG_IDENTITY as UNKNOWN when modelRevision is null and immutableRevisionPinStatus is UNKNOWN_NOT_DOCUMENTED', () => {
    const config = createRerankerConfig({ baseUrl: T007_BASE_URL });
    expect(config.modelRevision).toBeNull();
    expect(config.immutableRevisionPinStatus).toBe('UNKNOWN_NOT_DOCUMENTED');

    const state = deriveConfigIdentityState(config);
    expect(state).toBe('UNKNOWN');
    expect(state).not.toBe('PASS');
  });

  it('requires mechanical verification for CLEANUP_SECRET_SAFETY and never defaults to PASS', () => {
    expect(
      deriveCleanupSecretSafetyState({
        checkCompleted: false,
      }),
    ).toBe('UNKNOWN');

    expect(
      deriveCleanupSecretSafetyState({
        checkCompleted: false,
        blocked: true,
      }),
    ).toBe('BLOCKED');

    expect(
      deriveCleanupSecretSafetyState({
        checkCompleted: true,
        secretDetected: true,
        rawContentDetected: false,
        unauthorizedPersistenceDetected: false,
        repoResidueDetected: false,
      }),
    ).toBe('FAIL');

    expect(
      deriveCleanupSecretSafetyState({
        checkCompleted: true,
        secretDetected: false,
        rawContentDetected: false,
        unauthorizedPersistenceDetected: false,
        repoResidueDetected: false,
      }),
    ).toBe('PASS');
  });
});

describe('Slice 23 T007 controlled whitelist telemetry', () => {
  it('retains only whitelist fields and strips raw content, secrets, raw responses, and fabricated cost', () => {
    const config = createRerankerConfig({ baseUrl: T007_BASE_URL });
    const secretQuery = 'sensitive raw query text should never appear';
    const secretCandidate = 'sensitive raw candidate text should never appear';
    const secretInstruct = 'sensitive raw instruct text should never appear';
    const fakeApiKey = 'sk-test-secret-value-12345';

    const request: RerankRequest = {
      query: secretQuery,
      candidates: [{ candidateId: 'syn-cand-1', candidateText: secretCandidate }],
      options: { instruct: secretInstruct },
    };

    const record = buildRerankerTelemetryRecord({
      config,
      request,
      attemptCount: 1,
      elapsedMs: 123,
      terminalState: 'SUCCESS',
      providerRequestId: 'req-safe-001',
      totalTokens: 42,
    });

    expect(record.provider).toBe('ALIBABA_DASHSCOPE');
    expect(record.configuredModelId).toBe('qwen3-rerank');
    expect(record.configuredModelRevision).toBeNull();
    expect(record.immutableRevisionPinStatus).toBe('UNKNOWN_NOT_DOCUMENTED');
    expect(record.candidateCount).toBe(1);
    expect(record.attemptCount).toBe(1);
    expect(record.elapsedMs).toBe(123);
    expect(record.terminalState).toBe('SUCCESS');
    expect(record.errorCode).toBeUndefined();
    expect(record.providerRequestId).toBe('req-safe-001');
    expect(record.totalTokens).toBe(42);
    expect(record.configFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(record.requestFingerprint).toMatch(/^[a-f0-9]{64}$/);

    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain(secretQuery);
    expect(serialized).not.toContain(secretCandidate);
    expect(serialized).not.toContain(secretInstruct);
    expect(serialized).not.toContain(fakeApiKey);
    expect(serialized).not.toContain('Authorization');
    expect(serialized).not.toContain('cost');
    expect(serialized).not.toContain('estimatedCost');
    expect(serialized).not.toContain('costUsd');
    expect(serialized).not.toContain('price');
    expect(serialized).not.toContain('billingAmount');

    for (const key of Object.keys(record)) {
      expect(RERANKER_TELEMETRY_WHITELIST_KEYS).toContain(key);
    }

    // Verify sanitizeTelemetryRecord strips forbidden fields even if injected
    const polluted = {
      ...record,
      query: secretQuery,
      candidateText: secretCandidate,
      documents: [secretCandidate],
      instruct: secretInstruct,
      DASHSCOPE_API_KEY: fakeApiKey,
      Authorization: `Bearer ${fakeApiKey}`,
      rawResponse: '{"secret":true}',
      rawRequestBody: '{"query":"leak"}',
      providerMessage: 'raw provider error text',
      professionalLabel: 'GOLD_APPROVED',
      cost: 0,
      estimatedCost: 0.001,
      costUsd: 0.001,
      price: 0.001,
      billingAmount: 0.001,
    };

    const sanitized = sanitizeTelemetryRecord(polluted);
    const sanitizedKeys = Object.keys(sanitized);
    for (const key of sanitizedKeys) {
      expect(RERANKER_TELEMETRY_WHITELIST_KEYS).toContain(key);
    }
    expect('query' in sanitized).toBe(false);
    expect('candidateText' in sanitized).toBe(false);
    expect('documents' in sanitized).toBe(false);
    expect('instruct' in sanitized).toBe(false);
    expect('DASHSCOPE_API_KEY' in sanitized).toBe(false);
    expect('Authorization' in sanitized).toBe(false);
    expect('rawResponse' in sanitized).toBe(false);
    expect('rawRequestBody' in sanitized).toBe(false);
    expect('providerMessage' in sanitized).toBe(false);
    expect('professionalLabel' in sanitized).toBe(false);
    expect('cost' in sanitized).toBe(false);
    expect('estimatedCost' in sanitized).toBe(false);
    expect('costUsd' in sanitized).toBe(false);
    expect('price' in sanitized).toBe(false);
    expect('billingAmount' in sanitized).toBe(false);
  });

  it('omits totalTokens when absent and preserves safe errorCode/providerRequestId on technical failure', () => {
    const config = createRerankerConfig({ baseUrl: T007_BASE_URL });
    const request = makeValidRequest();

    const failedRecord = buildRerankerTelemetryRecord({
      config,
      request,
      attemptCount: 2,
      elapsedMs: 11200,
      terminalState: 'TIMEOUT',
      errorCode: 'TIMEOUT',
      providerRequestId: 'Bearer sk-should-be-rejected',
    });

    expect(failedRecord.terminalState).toBe('TIMEOUT');
    expect(failedRecord.errorCode).toBe('TIMEOUT');
    expect(failedRecord.totalTokens).toBeUndefined();
    expect(failedRecord.providerRequestId).toBeUndefined();

    const safeConfigFp = createSafeConfigFingerprint(config);
    const safeRequestFp = createSafeRequestFingerprint(request);
    expect(safeConfigFp).toMatch(/^[a-f0-9]{64}$/);
    expect(safeRequestFp).toMatch(/^[a-f0-9]{64}$/);
    expect(safeConfigFp).not.toContain('sk-');
    expect(safeRequestFp).not.toContain(request.query);
  });

  it('rejects non-SHA-256 disguised strings in configFingerprint and requestFingerprint while preserving valid SHA-256 fingerprints', () => {
    const config = createRerankerConfig({ baseUrl: T007_BASE_URL });
    const request = makeValidRequest();
    const validConfigFp = createSafeConfigFingerprint(config);
    const validRequestFp = createSafeRequestFingerprint(request);

    const sanitizedDisguised = sanitizeTelemetryRecord({
      terminalState: 'SUCCESS',
      candidateCount: 1,
      attemptCount: 1,
      elapsedMs: 10,
      requestFingerprint: 'sensitive raw query disguised as fingerprint',
      configFingerprint: 'Bearer sk-secret-value-disguised',
    });

    expect(sanitizedDisguised.requestFingerprint).toBe('');
    expect(sanitizedDisguised.configFingerprint).toBe('');
    expect(JSON.stringify(sanitizedDisguised)).not.toContain('sensitive raw query');
    expect(JSON.stringify(sanitizedDisguised)).not.toContain('Bearer');
    expect(JSON.stringify(sanitizedDisguised)).not.toContain('sk-secret');

    const sanitizedArbitrary = sanitizeTelemetryRecord({
      terminalState: 'SUCCESS',
      candidateCount: 1,
      attemptCount: 1,
      elapsedMs: 10,
      requestFingerprint: 'arbitrary-non-fingerprint-string',
      configFingerprint: '12345-not-64-hex',
    });

    expect(sanitizedArbitrary.requestFingerprint).toBe('');
    expect(sanitizedArbitrary.configFingerprint).toBe('');

    const sanitizedValid = sanitizeTelemetryRecord({
      terminalState: 'SUCCESS',
      candidateCount: 1,
      attemptCount: 1,
      elapsedMs: 10,
      configFingerprint: validConfigFp,
      requestFingerprint: validRequestFp,
    });

    expect(sanitizedValid.configFingerprint).toBe(validConfigFp);
    expect(sanitizedValid.requestFingerprint).toBe(validRequestFp);
  });
});

describe('Slice 23 T008 cross-module and adversarial offline test matrix', () => {
  const BASE_URL = 'https://ws-t008.cn-beijing.maas.aliyuncs.com/api/v1';

  const makeJsonResponse = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  it('executes full end-to-end orchestration through native transport without reading process.env.DASHSCOPE_API_KEY', async () => {
    const originalApiKey = process.env.DASHSCOPE_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;

    try {
      const envReader = vi.fn((key: string) =>
        key === 'DASHSCOPE_API_KEY' ? 'synthetic-t008-key' : undefined,
      );
      const capturedUrls: string[] = [];
      const capturedBodies: unknown[] = [];
      const capturedAuthHeaders: string[] = [];

      const fakeFetch: RerankerFetch = vi.fn(async (url, init) => {
        capturedUrls.push(String(url));
        capturedBodies.push(JSON.parse(String(init?.body)));
        capturedAuthHeaders.push(new Headers(init?.headers).get('Authorization') ?? '');
        return makeJsonResponse(200, {
          request_id: 'req-e2e-t008',
          usage: { total_tokens: 55 },
          output: {
            results: [
              { index: 1, relevance_score: 1 },
              { index: 0, relevance_score: 0 },
            ],
          },
        });
      });

      const config = createRerankerConfig({ baseUrl: BASE_URL });
      const transport = createRerankerTransport(config, {
        fetch: fakeFetch,
        envReader,
        sleep: vi.fn(async () => {}),
      });

      const result = await rerankWithDeps(
        makeValidRequest({
          query: 'exact synthetic query',
          candidates: [
            { candidateId: 'cand-first', candidateText: 'doc first' },
            { candidateId: 'cand-second', candidateText: 'doc second' },
          ],
          options: { instruct: 'exact synthetic instruct' },
        }),
        { baseUrl: BASE_URL },
        { transport },
      );

      expect(envReader).toHaveBeenCalledTimes(1);
      expect(capturedUrls).toEqual([
        'https://ws-t008.cn-beijing.maas.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank',
      ]);
      expect(capturedAuthHeaders).toEqual(['Bearer synthetic-t008-key']);
      expect(capturedBodies).toEqual([
        {
          model: 'qwen3-rerank',
          input: {
            query: 'exact synthetic query',
            documents: ['doc first', 'doc second'],
          },
          parameters: {
            top_n: 2,
            return_documents: false,
            instruct: 'exact synthetic instruct',
          },
        },
      ]);
      expect(result).toEqual({
        provider: 'ALIBABA_DASHSCOPE',
        configuredModelId: 'qwen3-rerank',
        configuredModelRevision: null,
        providerRequestId: 'req-e2e-t008',
        usage: { totalTokens: 55 },
        results: [
          { candidateId: 'cand-second', score: 1, rank: 1 },
          { candidateId: 'cand-first', score: 0, rank: 2 },
        ],
      });
    } finally {
      if (originalApiKey !== undefined) {
        process.env.DASHSCOPE_API_KEY = originalApiKey;
      }
    }
  });

  it('rejects >500 candidates before transport and does not guess token-count limits from character length', async () => {
    const fakeFetch: RerankerFetch = vi.fn(async () =>
      makeJsonResponse(400, {
        code: 'InvalidParameter',
        message: 'input length exceeds token limit',
        request_id: 'req-400-overlimit',
      }),
    );

    const config = createRerankerConfig({ baseUrl: BASE_URL });
    const transport = createRerankerTransport(config, {
      fetch: fakeFetch,
      envReader: () => 'synthetic-t008-key',
      sleep: vi.fn(async () => {}),
    });

    // >500 candidates fails locally with 0 transport calls
    const over500 = Array.from({ length: 501 }, (_, i) => ({
      candidateId: `id-${i}`,
      candidateText: `text-${i}`,
    }));
    await expect(
      rerankWithDeps(makeValidRequest({ candidates: over500 }), { baseUrl: BASE_URL }, { transport }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT', retryable: false });
    expect(fakeFetch).not.toHaveBeenCalled();

    // Very long character text is not locally rejected by character heuristic; provider 400 InvalidParameter -> INVALID_INPUT
    const veryLongQuery = 'a'.repeat(130_000);
    let caught: unknown;
    try {
      await rerankWithDeps(
        makeValidRequest({ query: veryLongQuery }),
        { baseUrl: BASE_URL },
        { transport },
      );
    } catch (error) {
      caught = error;
    }

    expect(fakeFetch).toHaveBeenCalledTimes(1);
    expect(caught).toBeInstanceOf(RerankerTechnicalError);
    expect((caught as RerankerTechnicalError).code).toBe('INVALID_INPUT');
    expect((caught as RerankerTechnicalError).retryable).toBe(false);
    expect((caught as RerankerTechnicalError).providerRequestId).toBe('req-400-overlimit');
  });

  it.each([
    {
      label: 'PARTIAL_RESPONSE',
      body: {
        request_id: 'req-e2e-partial',
        usage: { total_tokens: 10 },
        output: { results: [{ index: 0, relevance_score: 0.9 }] },
      },
      expectedCode: 'PARTIAL_RESPONSE',
    },
    {
      label: 'IDENTITY_MAPPING_FAILURE',
      body: {
        request_id: 'req-e2e-id',
        usage: { total_tokens: 10 },
        output: {
          results: [
            { index: 0, relevance_score: 0.9 },
            { index: 0, relevance_score: 0.8 },
          ],
        },
      },
      expectedCode: 'IDENTITY_MAPPING_FAILURE',
    },
    {
      label: 'MALFORMED_RESPONSE',
      body: {
        request_id: 'req-e2e-malformed',
        usage: { total_tokens: 10 },
        output: {
          results: [
            { index: 0, relevance_score: 0.2 },
            { index: 1, relevance_score: 0.8 },
          ],
        },
      },
      expectedCode: 'MALFORMED_RESPONSE',
    },
  ])('does not retry $label in full orchestration and surfaces terminal failure', async ({
    body,
    expectedCode,
  }) => {
    const sleepCalls: number[] = [];
    const fakeFetch: RerankerFetch = vi.fn(async () => makeJsonResponse(200, body));
    const config = createRerankerConfig({ baseUrl: BASE_URL });
    const transport = createRerankerTransport(config, {
      fetch: fakeFetch,
      envReader: () => 'synthetic-t008-key',
      sleep: vi.fn(async (ms: number) => {
        sleepCalls.push(ms);
      }),
    });

    let caught: unknown;
    try {
      await rerankWithDeps(
        makeValidRequest({
          candidates: [
            { candidateId: 'c1', candidateText: 'doc 1' },
            { candidateId: 'c2', candidateText: 'doc 2' },
          ],
        }),
        { baseUrl: BASE_URL },
        { transport },
      );
    } catch (error) {
      caught = error;
    }

    expect(fakeFetch).toHaveBeenCalledTimes(1);
    expect(sleepCalls).toEqual([]);
    expect(caught).toBeInstanceOf(RerankerTechnicalError);
    expect((caught as RerankerTechnicalError).code).toBe(expectedCode);
    expect((caught as RerankerTechnicalError).retryable).toBe(false);
  });

  it('rejects unsafe providerRequestId values with whitespace, control chars, or credential prefixes in telemetry', () => {
    const config = createRerankerConfig({ baseUrl: BASE_URL });
    const request = makeValidRequest();

    for (const unsafeId of [
      'req with space',
      'req\ninjected-line',
      'req\tcontrol',
      'Bearer token-value',
      'sk-secret-like-id',
      '   ',
    ]) {
      const record = buildRerankerTelemetryRecord({
        config,
        request,
        attemptCount: 1,
        elapsedMs: 40,
        terminalState: 'PROVIDER_UNAVAILABLE',
        errorCode: 'PROVIDER_UNAVAILABLE',
        providerRequestId: unsafeId,
      });

      expect(record.providerRequestId).toBeUndefined();
      if (unsafeId.trim().length > 0) {
        expect(JSON.stringify(record)).not.toContain(unsafeId.trim());
      }
    }
  });

  it('guarantees offline/mock/synthetic inputs can never produce LIVE_PROVIDER_CAPABILITY = PASS or aggregate PASS', () => {
    const config = createRerankerConfig({ baseUrl: BASE_URL });

    for (const provenance of ['OFFLINE_MOCK', 'NONE'] as const) {
      const liveState = deriveLiveProviderCapabilityState({
        attempted: true,
        provenance,
        exactHeadBound: true,
        exactConfigBound: true,
        validAccess: true,
        contractCompatible: true,
      });
      expect(liveState).toBe('NOT_EVALUATED');
      expect(liveState).not.toBe('PASS');

      const report = evaluateTechnicalEvidence({
        contractMechanics: { executed: true, allPassed: true },
        liveProviderCapability: {
          attempted: true,
          provenance,
          exactHeadBound: true,
          exactConfigBound: true,
          validAccess: true,
          contractCompatible: true,
        },
        config,
        cleanupSecretSafety: {
          checkCompleted: true,
          secretDetected: false,
          rawContentDetected: false,
          unauthorizedPersistenceDetected: false,
          repoResidueDetected: false,
        },
      });

      expect(report.lowerPredicates).toEqual({
        CONTRACT_MECHANICS: 'PASS',
        LIVE_PROVIDER_CAPABILITY: 'NOT_EVALUATED',
        CONFIG_IDENTITY: 'UNKNOWN',
        CLEANUP_SECRET_SAFETY: 'PASS',
      });
      expect(report.aggregateTechnicalResult).toBe('UNKNOWN');
      expect(report.aggregateTechnicalResult).not.toBe('PASS');
    }
  });
});
