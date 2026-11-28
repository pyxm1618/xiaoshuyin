import { describe, expect, it } from 'vitest';
import {
  validateRerankRequest,
  type RerankRequest,
  type RerankResult,
} from '../../apps/server/api/src/ai/reranker/index.js';

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
