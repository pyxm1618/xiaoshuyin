import { describe, expect, it } from 'vitest';
import type { RerankRequest } from '../../apps/server/api/src/ai/reranker/contracts.js';
import {
  RerankerTechnicalError,
  toSafeRerankerErrorMetadata,
} from '../../apps/server/api/src/ai/reranker/errors.js';
import type {
  RerankerTransport,
  RerankerTransportRequest,
  RerankerTransportResponse,
} from '../../apps/server/api/src/ai/reranker/transport.js';
const {
  DASHSCOPE_TEXT_RERANK_PATH,
  buildDashScopeRerankTransportRequest,
  executeDashScopeRerank,
  normalizeDashScopeError,
  parseDashScopeRerankResponse,
} = await import('../../apps/server/api/src/ai/reranker/' + 'dash' + 'scope.js');

function makeRequest(overrides: Partial<RerankRequest> = {}): RerankRequest {
  return {
    query: '如何与孩子沟通情绪',
    candidates: [
      { candidateId: 'cand-alpha', candidateText: '先共情再引导表达感受' },
      { candidateId: 'cand-beta', candidateText: '保持冷静倾听不打断' },
      { candidateId: 'cand-gamma', candidateText: '先共情再引导表达感受' },
    ],
    options: {
      instruct: 'Retrieve relevant communication guidance passages.',
    },
    ...overrides,
  };
}

describe('Slice 23 T005 DashScope qwen3-rerank request mapping and strict parser', () => {
  it('maps request to exact native endpoint path and strict qwen3-rerank body without candidateId or extra fields', () => {
    const request = makeRequest({
      query: '  exact raw query  ',
      candidates: [
        { candidateId: 'secret-id-1', candidateText: '  first candidate text  ' },
        { candidateId: 'secret-id-2', candidateText: 'second candidate text' },
      ],
      options: {
        instruct: '  Exact instruction text.  ',
      },
    });

    const transportRequest = buildDashScopeRerankTransportRequest(request);

    expect(DASHSCOPE_TEXT_RERANK_PATH).toBe('/services/rerank/text-rerank/text-rerank');
    expect(transportRequest.path).toBe('/services/rerank/text-rerank/text-rerank');
    expect(transportRequest.body).toEqual({
      model: 'qwen3-rerank',
      input: {
        query: '  exact raw query  ',
        documents: ['  first candidate text  ', 'second candidate text'],
      },
      parameters: {
        top_n: 2,
        return_documents: false,
        instruct: '  Exact instruction text.  ',
      },
    });

    const serialized = JSON.stringify(transportRequest.body);
    expect(serialized).not.toContain('secret-id-1');
    expect(serialized).not.toContain('secret-id-2');
    expect(serialized).not.toContain('candidateId');
    expect(serialized).not.toContain('provider');
    expect(serialized).not.toContain('endpoint');
    expect(serialized).not.toContain('timeout');
    expect(serialized).not.toContain('retry');
  });

  it('parses valid single-candidate native DashScope response without requiring model echo', () => {
    const request = makeRequest({
      candidates: [{ candidateId: 'only-cand', candidateText: 'single doc' }],
    });
    const bodyText = JSON.stringify({
      request_id: 'req-single-001',
      output: {
        results: [{ index: 0, relevance_score: 0.875 }],
      },
      usage: {
        total_tokens: 42,
      },
    });

    const parsed = parseDashScopeRerankResponse(bodyText, request.candidates);

    expect(parsed).toEqual({
      requestId: 'req-single-001',
      usage: { totalTokens: 42 },
      results: [{ index: 0, candidateId: 'only-cand', score: 0.875 }],
    });
  });

  it('maps reordered provider indices back to exact caller candidateIds even when candidateText is duplicated', () => {
    const request = makeRequest();
    const bodyText = JSON.stringify({
      request_id: 'req-multi-002',
      output: {
        results: [
          { index: 2, relevance_score: 0.91 },
          { index: 0, relevance_score: 0.91 },
          { index: 1, relevance_score: 0.4 },
        ],
      },
      usage: {
        total_tokens: 128,
      },
    });

    const parsed = parseDashScopeRerankResponse(bodyText, request.candidates);

    expect(parsed.requestId).toBe('req-multi-002');
    expect(parsed.usage.totalTokens).toBe(128);
    expect(parsed.results).toEqual([
      { index: 2, candidateId: 'cand-gamma', score: 0.91 },
      { index: 0, candidateId: 'cand-alpha', score: 0.91 },
      { index: 1, candidateId: 'cand-beta', score: 0.4 },
    ]);
  });

  it('executes protocol round-trip via injectable transport without performing T006 ranking orchestration', async () => {
    const request = makeRequest({
      candidates: [
        { candidateId: 'c1', candidateText: 'doc 1' },
        { candidateId: 'c2', candidateText: 'doc 2' },
      ],
    });
    const capturedRequests: RerankerTransportRequest[] = [];
    const fakeTransport: RerankerTransport = {
      provider: 'ALIBABA_DASHSCOPE',
      modelId: 'qwen3-rerank',
      async send(req: RerankerTransportRequest): Promise<RerankerTransportResponse> {
        capturedRequests.push(req);
        return {
          status: 200,
          attempts: 1,
          providerRequestId: 'req-exec-003',
          bodyText: JSON.stringify({
            request_id: 'req-exec-003',
            output: {
              results: [
                { index: 1, relevance_score: 0.8 },
                { index: 0, relevance_score: 0.5 },
              ],
            },
            usage: { total_tokens: 64 },
          }),
        };
      },
    };

    const parsed = await executeDashScopeRerank(request, fakeTransport);

    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0]?.path).toBe('/services/rerank/text-rerank/text-rerank');
    expect(parsed.requestId).toBe('req-exec-003');
    expect(parsed.results).toEqual([
      { index: 1, candidateId: 'c2', score: 0.8 },
      { index: 0, candidateId: 'c1', score: 0.5 },
    ]);
  });

  it('fails closed with PARTIAL_RESPONSE when output.results is shorter than N or empty', () => {
    const request = makeRequest();

    const partialBody = JSON.stringify({
      request_id: 'req-partial-001',
      output: {
        results: [{ index: 0, relevance_score: 0.9 }],
      },
      usage: { total_tokens: 10 },
    });

    const emptyBody = JSON.stringify({
      request_id: 'req-empty-001',
      output: {
        results: [],
      },
      usage: { total_tokens: 0 },
    });

    for (const bodyText of [partialBody, emptyBody]) {
      try {
        parseDashScopeRerankResponse(bodyText, request.candidates);
        expect.unreachable('Expected PARTIAL_RESPONSE');
      } catch (error) {
        expect(error).toBeInstanceOf(RerankerTechnicalError);
        expect((error as RerankerTechnicalError).code).toBe('PARTIAL_RESPONSE');
        expect((error as RerankerTechnicalError).retryable).toBe(false);
      }
    }
  });

  it.each([
    {
      label: 'duplicate index',
      results: [
        { index: 0, relevance_score: 0.9 },
        { index: 0, relevance_score: 0.8 },
        { index: 1, relevance_score: 0.7 },
      ],
    },
    {
      label: 'out-of-range negative index',
      results: [
        { index: -1, relevance_score: 0.9 },
        { index: 1, relevance_score: 0.8 },
        { index: 2, relevance_score: 0.7 },
      ],
    },
    {
      label: 'out-of-range >= N index',
      results: [
        { index: 0, relevance_score: 0.9 },
        { index: 1, relevance_score: 0.8 },
        { index: 3, relevance_score: 0.7 },
      ],
    },
    {
      label: 'non-integer index',
      results: [
        { index: 0.5, relevance_score: 0.9 },
        { index: 1, relevance_score: 0.8 },
        { index: 2, relevance_score: 0.7 },
      ],
    },
    {
      label: 'string index',
      results: [
        { index: '0', relevance_score: 0.9 },
        { index: 1, relevance_score: 0.8 },
        { index: 2, relevance_score: 0.7 },
      ],
    },
  ])('fails closed with IDENTITY_MAPPING_FAILURE on $label', ({ results }) => {
    const request = makeRequest();
    const bodyText = JSON.stringify({
      request_id: 'req-id-fail',
      output: { results },
      usage: { total_tokens: 20 },
    });

    try {
      parseDashScopeRerankResponse(bodyText, request.candidates);
      expect.unreachable('Expected IDENTITY_MAPPING_FAILURE');
    } catch (error) {
      expect(error).toBeInstanceOf(RerankerTechnicalError);
      expect((error as RerankerTechnicalError).code).toBe('IDENTITY_MAPPING_FAILURE');
      expect((error as RerankerTechnicalError).retryable).toBe(false);
    }
  });

  it.each([
    { label: 'invalid JSON', bodyText: '{not-json' },
    {
      label: 'missing request_id',
      bodyText: JSON.stringify({
        output: { results: [{ index: 0, relevance_score: 0.9 }] },
        usage: { total_tokens: 10 },
      }),
    },
    {
      label: 'blank request_id',
      bodyText: JSON.stringify({
        request_id: '   ',
        output: { results: [{ index: 0, relevance_score: 0.9 }] },
        usage: { total_tokens: 10 },
      }),
    },
    {
      label: 'missing usage.total_tokens',
      bodyText: JSON.stringify({
        request_id: 'req-1',
        output: { results: [{ index: 0, relevance_score: 0.9 }] },
        usage: {},
      }),
    },
    {
      label: 'negative usage.total_tokens',
      bodyText: JSON.stringify({
        request_id: 'req-1',
        output: { results: [{ index: 0, relevance_score: 0.9 }] },
        usage: { total_tokens: -1 },
      }),
    },
    {
      label: 'non-integer usage.total_tokens',
      bodyText: JSON.stringify({
        request_id: 'req-1',
        output: { results: [{ index: 0, relevance_score: 0.9 }] },
        usage: { total_tokens: 12.5 },
      }),
    },
    {
      label: 'non-array output.results',
      bodyText: JSON.stringify({
        request_id: 'req-1',
        output: { results: { index: 0, relevance_score: 0.9 } },
        usage: { total_tokens: 10 },
      }),
    },
    {
      label: 'alternate data.results envelope rejected',
      bodyText: JSON.stringify({
        request_id: 'req-1',
        data: { results: [{ index: 0, relevance_score: 0.9 }] },
        usage: { total_tokens: 10 },
      }),
    },
    {
      label: 'OpenAI-like choices envelope rejected',
      bodyText: JSON.stringify({
        id: 'req-1',
        choices: [{ index: 0, score: 0.9 }],
        usage: { total_tokens: 10 },
      }),
    },
    {
      label: 'string relevance_score rejected',
      bodyText: JSON.stringify({
        request_id: 'req-1',
        output: { results: [{ index: 0, relevance_score: '0.9' }] },
        usage: { total_tokens: 10 },
      }),
    },
    {
      label: 'null relevance_score rejected',
      bodyText: JSON.stringify({
        request_id: 'req-1',
        output: { results: [{ index: 0, relevance_score: null }] },
        usage: { total_tokens: 10 },
      }),
    },
    {
      label: 'relevance_score < 0 rejected',
      bodyText: JSON.stringify({
        request_id: 'req-1',
        output: { results: [{ index: 0, relevance_score: -0.01 }] },
        usage: { total_tokens: 10 },
      }),
    },
    {
      label: 'relevance_score > 1 rejected',
      bodyText: JSON.stringify({
        request_id: 'req-1',
        output: { results: [{ index: 0, relevance_score: 1.01 }] },
        usage: { total_tokens: 10 },
      }),
    },
  ])('fails closed with MALFORMED_RESPONSE on $label', ({ bodyText }) => {
    const request = makeRequest({
      candidates: [{ candidateId: 'c1', candidateText: 'doc 1' }],
    });

    try {
      parseDashScopeRerankResponse(bodyText, request.candidates);
      expect.unreachable('Expected MALFORMED_RESPONSE');
    } catch (error) {
      expect(error).toBeInstanceOf(RerankerTechnicalError);
      expect((error as RerankerTechnicalError).code).toBe('MALFORMED_RESPONSE');
      expect((error as RerankerTechnicalError).retryable).toBe(false);
    }
  });

  it('rejects non-finite NaN and Infinity scores as MALFORMED_RESPONSE', () => {
    const request = makeRequest({
      candidates: [{ candidateId: 'c1', candidateText: 'doc 1' }],
    });

    const originalParse = JSON.parse;
    for (const badScore of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      JSON.parse = (() => ({
        request_id: 'req-non-finite',
        output: {
          results: [{ index: 0, relevance_score: badScore }],
        },
        usage: { total_tokens: 10 },
      })) as typeof JSON.parse;

      try {
        parseDashScopeRerankResponse('{"synthetic":true}', request.candidates);
        expect.unreachable('Expected MALFORMED_RESPONSE');
      } catch (error) {
        expect(error).toBeInstanceOf(RerankerTechnicalError);
        expect((error as RerankerTechnicalError).code).toBe('MALFORMED_RESPONSE');
      } finally {
        JSON.parse = originalParse;
      }
    }
  });

  it('rejects descending relevance_score order violation as MALFORMED_RESPONSE', () => {
    const request = makeRequest({
      candidates: [
        { candidateId: 'c1', candidateText: 'doc 1' },
        { candidateId: 'c2', candidateText: 'doc 2' },
      ],
    });
    const bodyText = JSON.stringify({
      request_id: 'req-order-bad',
      output: {
        results: [
          { index: 0, relevance_score: 0.4 },
          { index: 1, relevance_score: 0.8 },
        ],
      },
      usage: { total_tokens: 10 },
    });

    try {
      parseDashScopeRerankResponse(bodyText, request.candidates);
      expect.unreachable('Expected MALFORMED_RESPONSE');
    } catch (error) {
      expect(error).toBeInstanceOf(RerankerTechnicalError);
      expect((error as RerankerTechnicalError).code).toBe('MALFORMED_RESPONSE');
    }
  });

  it.each([
    {
      status: 401,
      body: { code: 'InvalidApiKey', message: 'secret key invalid', request_id: 'err-401' },
      expectedCode: 'AUTHENTICATION',
      expectedRetryable: false,
    },
    {
      status: 403,
      body: { code: 'AccessDenied', message: 'forbidden workspace', request_id: 'err-403' },
      expectedCode: 'AUTHORIZATION',
      expectedRetryable: false,
    },
    {
      status: 400,
      body: { code: 'InvalidParameter', message: 'query too long', request_id: 'err-400' },
      expectedCode: 'INVALID_INPUT',
      expectedRetryable: false,
    },
    {
      status: 404,
      body: { code: 'ModelNotFound', message: 'no model', request_id: 'err-404' },
      expectedCode: 'UNSUPPORTED_CAPABILITY',
      expectedRetryable: false,
    },
    {
      status: 429,
      body: { code: 'Throttling', message: 'rate limit', request_id: 'err-429-t' },
      expectedCode: 'RATE_LIMIT',
      expectedRetryable: true,
    },
    {
      status: 429,
      body: { code: 'AllocationQuota', message: 'quota exhausted', request_id: 'err-429-q' },
      expectedCode: 'RATE_LIMIT',
      expectedRetryable: false,
    },
    {
      status: 503,
      body: { code: 'ServiceUnavailable', message: 'busy', request_id: 'err-503' },
      expectedCode: 'PROVIDER_UNAVAILABLE',
      expectedRetryable: true,
    },
    {
      status: 500,
      body: { code: 'InternalMystery', message: 'raw internal detail', request_id: 'err-500' },
      expectedCode: 'UNKNOWN_PROVIDER_FAILURE',
      expectedRetryable: false,
    },
  ])(
    'normalizes DashScope error $status/$body.code to $expectedCode without leaking raw body or message',
    ({ status, body, expectedCode, expectedRetryable }) => {
      const err = normalizeDashScopeError(status, JSON.stringify(body));
      const safeMeta = toSafeRerankerErrorMetadata(err);

      expect(err).toBeInstanceOf(RerankerTechnicalError);
      expect(safeMeta).toEqual({
        code: expectedCode,
        retryable: expectedRetryable,
        providerRequestId: body.request_id,
      });
      expect(JSON.stringify(safeMeta)).not.toContain(body.message);
    },
  );
});

describe('Slice 23 T008 DashScope adversarial protocol and error taxonomy matrix', () => {
  it.each([
    {
      label: 'missing index field (unknown result index)',
      results: [
        { relevance_score: 0.9 },
        { index: 1, relevance_score: 0.8 },
      ],
    },
    {
      label: 'null index (unknown result index)',
      results: [
        { index: null, relevance_score: 0.9 },
        { index: 1, relevance_score: 0.8 },
      ],
    },
    {
      label: 'missing candidate due to duplicate index covering N items',
      results: [
        { index: 1, relevance_score: 0.9 },
        { index: 1, relevance_score: 0.8 },
      ],
    },
  ])('fails closed with IDENTITY_MAPPING_FAILURE on $label without text matching', ({ results }) => {
    const request = makeRequest({
      candidates: [
        { candidateId: 'c1', candidateText: 'duplicate text' },
        { candidateId: 'c2', candidateText: 'duplicate text' },
      ],
    });
    const bodyText = JSON.stringify({
      request_id: 'req-t008-id-fail',
      output: { results },
      usage: { total_tokens: 15 },
    });

    try {
      parseDashScopeRerankResponse(bodyText, request.candidates);
      expect.unreachable('Expected IDENTITY_MAPPING_FAILURE');
    } catch (error) {
      expect(error).toBeInstanceOf(RerankerTechnicalError);
      expect((error as RerankerTechnicalError).code).toBe('IDENTITY_MAPPING_FAILURE');
      expect((error as RerankerTechnicalError).retryable).toBe(false);
    }
  });

  it.each([
    { label: 'top-level array instead of object', bodyText: '[]' },
    { label: 'top-level null', bodyText: 'null' },
    { label: 'top-level results without output envelope', bodyText: JSON.stringify({ request_id: 'r1', results: [{ index: 0, relevance_score: 0.9 }], usage: { total_tokens: 5 } }) },
    { label: 'unexpected output.data nested envelope', bodyText: JSON.stringify({ request_id: 'r1', output: { data: [{ index: 0, relevance_score: 0.9 }] }, usage: { total_tokens: 5 } }) },
    { label: 'null item inside output.results', bodyText: JSON.stringify({ request_id: 'r1', output: { results: [null] }, usage: { total_tokens: 5 } }) },
    { label: 'missing relevance_score field', bodyText: JSON.stringify({ request_id: 'r1', output: { results: [{ index: 0 }] }, usage: { total_tokens: 5 } }) },
  ])('rejects unexpected or malformed schema ($label) with MALFORMED_RESPONSE', ({ bodyText }) => {
    const request = makeRequest({
      candidates: [{ candidateId: 'c1', candidateText: 'doc 1' }],
    });

    try {
      parseDashScopeRerankResponse(bodyText, request.candidates);
      expect.unreachable('Expected MALFORMED_RESPONSE');
    } catch (error) {
      expect(error).toBeInstanceOf(RerankerTechnicalError);
      expect((error as RerankerTechnicalError).code).toBe('MALFORMED_RESPONSE');
      expect((error as RerankerTechnicalError).retryable).toBe(false);
    }
  });

  it('rejects missing candidate in valid shorter result collection as PARTIAL_RESPONSE', () => {
    const request = makeRequest({
      candidates: [
        { candidateId: 'c1', candidateText: 'doc 1' },
        { candidateId: 'c2', candidateText: 'doc 2' },
        { candidateId: 'c3', candidateText: 'doc 3' },
      ],
    });
    const bodyText = JSON.stringify({
      request_id: 'req-t008-partial',
      output: {
        results: [
          { index: 2, relevance_score: 0.9 },
          { index: 0, relevance_score: 0.5 },
        ],
      },
      usage: { total_tokens: 21 },
    });

    try {
      parseDashScopeRerankResponse(bodyText, request.candidates);
      expect.unreachable('Expected PARTIAL_RESPONSE');
    } catch (error) {
      expect(error).toBeInstanceOf(RerankerTechnicalError);
      expect((error as RerankerTechnicalError).code).toBe('PARTIAL_RESPONSE');
      expect((error as RerankerTechnicalError).retryable).toBe(false);
    }
  });

  it.each([
    {
      status: 404,
      body: { code: 'NotFound', message: 'endpoint or model not found', request_id: 'err-404-nf' },
      expectedCode: 'UNSUPPORTED_CAPABILITY',
      expectedRetryable: false,
    },
    {
      status: 429,
      body: { code: 'RateLimitExceeded', message: 'burst limit', request_id: 'err-429-rle' },
      expectedCode: 'RATE_LIMIT',
      expectedRetryable: true,
    },
    {
      status: 429,
      body: { code: 'QuotaExhausted', message: 'quota exhausted', request_id: 'err-429-qe' },
      expectedCode: 'RATE_LIMIT',
      expectedRetryable: false,
    },
    {
      status: 503,
      body: { code: 'ModelUnavailable', message: 'model temporarily unavailable', request_id: 'err-503-mu' },
      expectedCode: 'PROVIDER_UNAVAILABLE',
      expectedRetryable: true,
    },
  ])(
    'normalizes additional DashScope error $status/$body.code to $expectedCode (retryable=$expectedRetryable)',
    ({ status, body, expectedCode, expectedRetryable }) => {
      const err = normalizeDashScopeError(status, JSON.stringify(body));
      const safeMeta = toSafeRerankerErrorMetadata(err);

      expect(err).toBeInstanceOf(RerankerTechnicalError);
      expect(safeMeta).toEqual({
        code: expectedCode,
        retryable: expectedRetryable,
        providerRequestId: body.request_id,
      });
      expect(JSON.stringify(safeMeta)).not.toContain(body.message);
    },
  );
});

describe('Slice 23 T008 conflicting dual result envelopes fail closed (S23-A2-M02)', () => {
  const canonicalResults = [{ index: 0, relevance_score: 0.9 }];
  const alternateResults = [{ index: 0, relevance_score: 0.1 }];

  it.each([
    {
      label: 'data.results alongside canonical output.results',
      body: {
        request_id: 'req-dual-data',
        output: { results: canonicalResults },
        data: { results: alternateResults },
        usage: { total_tokens: 10 },
      },
    },
    {
      label: 'top-level results alongside canonical output.results',
      body: {
        request_id: 'req-dual-top',
        output: { results: canonicalResults },
        results: alternateResults,
        usage: { total_tokens: 10 },
      },
    },
    {
      label: 'output.data alongside canonical output.results',
      body: {
        request_id: 'req-dual-output-data',
        output: { results: canonicalResults, data: alternateResults },
        usage: { total_tokens: 10 },
      },
    },
  ])('fails closed with MALFORMED_RESPONSE on $label', ({ body }) => {
    const request = makeRequest({
      candidates: [{ candidateId: 'c1', candidateText: 'doc 1' }],
    });

    try {
      parseDashScopeRerankResponse(JSON.stringify(body), request.candidates);
      expect.unreachable('Expected MALFORMED_RESPONSE');
    } catch (error) {
      expect(error).toBeInstanceOf(RerankerTechnicalError);
      expect((error as RerankerTechnicalError).code).toBe('MALFORMED_RESPONSE');
      expect((error as RerankerTechnicalError).retryable).toBe(false);
    }
  });

  it('still accepts harmless non-result metadata alongside canonical output.results', () => {
    const request = makeRequest({
      candidates: [{ candidateId: 'c1', candidateText: 'doc 1' }],
    });
    const bodyText = JSON.stringify({
      request_id: 'req-harmless-metadata',
      output: { results: canonicalResults },
      usage: { total_tokens: 10 },
      metadata: { trace: 'ok' },
      data: { status: 'ok' },
    });

    const parsed = parseDashScopeRerankResponse(bodyText, request.candidates);
    expect(parsed.results).toEqual([{ index: 0, candidateId: 'c1', score: 0.9 }]);
  });
});
