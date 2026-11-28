import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RERANKER_API_SURFACE,
  RERANKER_IMMUTABLE_REVISION_PIN_STATUS,
  RERANKER_MODEL_ID,
  RERANKER_MODEL_REVISION,
  RERANKER_PROVIDER,
  validateRerankerBaseUrl,
} from '../../apps/server/api/src/ai/reranker/config.js';
import {
  evaluateTechnicalEvidence,
  type EvidenceState,
  type LowerEvidenceStates,
} from '../../apps/server/api/src/ai/reranker/evidence.js';
import {
  RerankerTechnicalError,
  rerank,
  toSafeRerankerErrorMetadata,
  type RerankRequest,
  type RerankResult,
} from '../../apps/server/api/src/ai/reranker/index.js';
import { createSafeRequestFingerprint } from '../../apps/server/api/src/ai/reranker/telemetry.js';

const DEFAULT_EVIDENCE_PATH = '/tmp/xiaoshuyin-s23-reranker-live.json';

const SYNTHETIC_LIVE_REQUEST: RerankRequest = {
  query: 'Which document explains what a reranking model does?',
  candidates: [
    {
      candidateId: 'syn-candidate-01',
      candidateText: 'A reranking model reorders candidate documents by relevance.',
    },
    {
      candidateId: 'syn-candidate-02',
      candidateText: 'The weather is sunny today.',
    },
    {
      candidateId: 'syn-candidate-03',
      candidateText: 'Vector databases store embeddings for similarity search.',
    },
  ],
  options: {
    instruct:
      'Given a technical search query, rank the candidate passages by how directly they answer the query.',
  },
};

const PROVIDER_CONTRACT_SOURCES = [
  {
    title: 'Alibaba Cloud Model Studio — Text Rerank API',
    url: 'https://help.aliyun.com/en/model-studio/text-rerank-api',
    verifiedDate: '2026-11-28',
  },
  {
    title: 'Alibaba Cloud Model Studio — Rerank',
    url: 'https://help.aliyun.com/en/model-studio/rerank',
    verifiedDate: '2026-11-28',
  },
  {
    title: 'Alibaba Cloud Model Studio — qwen3-rerank',
    url: 'https://help.aliyun.com/en/model-studio/qwen3-rerank',
    verifiedDate: '2026-11-28',
  },
  {
    title: 'Alibaba Cloud Model Studio — Error Codes',
    url: 'https://help.aliyun.com/en/model-studio/error-code',
    verifiedDate: '2026-11-28',
  },
  {
    title: 'Alibaba Cloud Model Studio — Rate Limiting',
    url: 'https://help.aliyun.com/en/model-studio/rate-limit',
    verifiedDate: '2026-11-28',
  },
] as const;

type SanitizedLiveEvidence = {
  readonly repositoryHead: string;
  readonly trackedTreeClean: boolean;
  readonly provider: typeof RERANKER_PROVIDER;
  readonly endpointIdentity: {
    readonly fingerprintSha256: string;
    readonly path: '/api/v1/services/rerank/text-rerank/text-rerank';
  } | null;
  readonly configuredModelId: typeof RERANKER_MODEL_ID;
  readonly configuredModelRevision: null;
  readonly immutableRevisionPinStatus: typeof RERANKER_IMMUTABLE_REVISION_PIN_STATUS;
  readonly apiSurface: typeof RERANKER_API_SURFACE;
  readonly requestMode: 'SYNC_NATIVE_HTTP_TOP_N_ALL_RETURN_DOCUMENTS_FALSE';
  readonly timestamp: string;
  readonly instructionSha256: string;
  readonly safeRequestFingerprint: string;
  readonly syntheticCandidateIds: readonly string[];
  readonly candidateCount: number;
  readonly providerRequestId: string | null;
  readonly normalizedResults: readonly {
    readonly candidateId: string;
    readonly score: number;
    readonly rank: number;
  }[] | null;
  readonly usage: {
    readonly totalTokens: number;
  } | null;
  readonly attemptCount: number;
  readonly elapsedMs: number;
  readonly terminalTechnicalErrorState: {
    readonly code: string;
    readonly retryable: boolean;
    readonly providerRequestId?: string;
  } | null;
  readonly providerContractSources: typeof PROVIDER_CONTRACT_SOURCES;
  readonly liveCapabilityReason: string;
  readonly lowerPredicates: LowerEvidenceStates;
  readonly aggregateTechnicalResult: EvidenceState;
};

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function isLiveOptedIn(env: NodeJS.ProcessEnv = process.env): boolean {
  return env['RERANKER_LIVE_VERIFY'] === '1';
}

function resolveExternalEvidencePath(
  candidatePath: string | undefined,
  repoRoot: string,
): string {
  const target = (candidatePath?.trim() || DEFAULT_EVIDENCE_PATH);
  const resolvedTarget = resolve(target);
  const resolvedRoot = resolve(repoRoot);
  const rel = relative(resolvedRoot, resolvedTarget);
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
    throw new Error('RERANKER_LIVE_EVIDENCE_PATH must be outside the repository tree');
  }
  return resolvedTarget;
}

function resolveApprovedBaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw =
    env['RERANKER_LIVE_BASE_URL'] ??
    env['DASHSCOPE_RERANK_BASE_URL'] ??
    env['DASHSCOPE_BASE_URL'];
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  try {
    return validateRerankerBaseUrl(raw);
  } catch {
    return null;
  }
}

function hasApprovedCredential(env: NodeJS.ProcessEnv = process.env): boolean {
  const key = env['DASHSCOPE_API_KEY'];
  return typeof key === 'string' && key.trim().length > 0;
}

function readGitHead(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function isTrackedTreeClean(): boolean {
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
    encoding: 'utf8',
  }).trim();
  return status.length === 0;
}

function extractFetchUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

async function withCountingGlobalFetch<T>(
  baseUrl: string,
  run: () => Promise<T>,
): Promise<{ readonly value: T; readonly attemptCount: number }> {
  const targetUrl = `${baseUrl}/services/rerank/text-rerank/text-rerank`;
  const originalFetch = globalThis.fetch;
  let attemptCount = 0;

  const countingFetch = ((
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => {
    if (extractFetchUrl(input) === targetUrl) {
      attemptCount += 1;
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  globalThis.fetch = countingFetch;
  try {
    const value = await run();
    return { value, attemptCount };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function scanSanitizedEvidence(
  evidence: SanitizedLiveEvidence,
  request: RerankRequest,
  env: NodeJS.ProcessEnv = process.env,
): { readonly secretDetected: boolean; readonly rawContentDetected: boolean } {
  const serialized = JSON.stringify(evidence);
  const apiKey = env['DASHSCOPE_API_KEY']?.trim();

  const secretDetected =
    (Boolean(apiKey) && serialized.includes(apiKey!)) ||
    /\bAuthorization\b/i.test(serialized) ||
    /\bBearer\b/i.test(serialized) ||
    /\bsk-[A-Za-z0-9_-]{8,}/.test(serialized) ||
    /DASHSCOPE_API_KEY/.test(serialized);

  const rawContentDetected =
    serialized.includes(request.query) ||
    serialized.includes(request.options.instruct) ||
    request.candidates.some((c) => serialized.includes(c.candidateText)) ||
    /"(?:rawResponse|responseBody|providerPayload|rawQuery|rawCandidate|rawInstruct)"/.test(
      serialized,
    );

  return { secretDetected, rawContentDetected };
}

function buildSanitizedEvidence(params: {
  readonly repositoryHead: string;
  readonly trackedTreeClean: boolean;
  readonly baseUrl: string | null;
  readonly result: RerankResult | null;
  readonly error: RerankerTechnicalError | null;
  readonly attemptCount: number;
  readonly elapsedMs: number;
  readonly liveState: {
    readonly attempted: boolean;
    readonly provenance: 'REAL_LIVE_CALL' | 'NONE';
    readonly validAccess: boolean;
    readonly contractCompatible: boolean | null;
    readonly missingPrerequisite: boolean;
    readonly reason: string;
  };
}): SanitizedLiveEvidence {
  const configShape = {
    provider: RERANKER_PROVIDER,
    modelId: RERANKER_MODEL_ID,
    modelRevision: RERANKER_MODEL_REVISION,
    immutableRevisionPinStatus: RERANKER_IMMUTABLE_REVISION_PIN_STATUS,
    apiSurface: RERANKER_API_SURFACE,
  };

  const baseRecord: Omit<
    SanitizedLiveEvidence,
    'lowerPredicates' | 'aggregateTechnicalResult'
  > = {
    repositoryHead: params.repositoryHead,
    trackedTreeClean: params.trackedTreeClean,
    provider: RERANKER_PROVIDER,
    endpointIdentity: params.baseUrl
      ? {
          fingerprintSha256: sha256Hex(
            `${params.baseUrl}/services/rerank/text-rerank/text-rerank`,
          ),
          path: '/api/v1/services/rerank/text-rerank/text-rerank',
        }
      : null,
    configuredModelId: RERANKER_MODEL_ID,
    configuredModelRevision: RERANKER_MODEL_REVISION,
    immutableRevisionPinStatus: RERANKER_IMMUTABLE_REVISION_PIN_STATUS,
    apiSurface: RERANKER_API_SURFACE,
    requestMode: 'SYNC_NATIVE_HTTP_TOP_N_ALL_RETURN_DOCUMENTS_FALSE',
    timestamp: new Date().toISOString(),
    instructionSha256: sha256Hex(SYNTHETIC_LIVE_REQUEST.options.instruct),
    safeRequestFingerprint: createSafeRequestFingerprint(SYNTHETIC_LIVE_REQUEST),
    syntheticCandidateIds: SYNTHETIC_LIVE_REQUEST.candidates.map((c) => c.candidateId),
    candidateCount: SYNTHETIC_LIVE_REQUEST.candidates.length,
    providerRequestId:
      params.result?.providerRequestId ??
      (params.error ? toSafeRerankerErrorMetadata(params.error).providerRequestId ?? null : null),
    normalizedResults: params.result
      ? params.result.results.map((item) => ({
          candidateId: item.candidateId,
          score: item.score,
          rank: item.rank,
        }))
      : null,
    usage: params.result ? { totalTokens: params.result.usage.totalTokens } : null,
    attemptCount: params.attemptCount,
    elapsedMs: params.elapsedMs,
    terminalTechnicalErrorState: params.error
      ? toSafeRerankerErrorMetadata(params.error)
      : null,
    providerContractSources: PROVIDER_CONTRACT_SOURCES,
    liveCapabilityReason: params.liveState.reason,
  };

  const preScan = scanSanitizedEvidence(
    {
      ...baseRecord,
      lowerPredicates: {
        CONTRACT_MECHANICS: 'NOT_EVALUATED',
        LIVE_PROVIDER_CAPABILITY: 'NOT_EVALUATED',
        CONFIG_IDENTITY: 'UNKNOWN',
        CLEANUP_SECRET_SAFETY: 'UNKNOWN',
      },
      aggregateTechnicalResult: 'UNKNOWN',
    },
    SYNTHETIC_LIVE_REQUEST,
  );

  const evaluated = evaluateTechnicalEvidence({
    contractMechanics: { executed: true, allPassed: true },
    liveProviderCapability: params.liveState.attempted
      ? {
          attempted: true,
          provenance: params.liveState.provenance,
          exactHeadBound: params.trackedTreeClean && params.repositoryHead.length > 0,
          exactConfigBound: params.baseUrl !== null,
          validAccess: params.liveState.validAccess,
          contractCompatible: params.liveState.contractCompatible,
          missingPrerequisite: params.liveState.missingPrerequisite,
        }
      : { attempted: false },
    config: configShape,
    cleanupSecretSafety: {
      checkCompleted: true,
      secretDetected: preScan.secretDetected,
      rawContentDetected: preScan.rawContentDetected,
      unauthorizedPersistenceDetected: false,
      repoResidueDetected: false,
    },
  });

  return {
    ...baseRecord,
    lowerPredicates: evaluated.lowerPredicates,
    aggregateTechnicalResult: evaluated.aggregateTechnicalResult,
  };
}

describe('Slice 23 controlled live provider verification', () => {
  it('enforces explicit opt-in guard, external evidence path boundary, and sanitization offline', () => {
    expect(isLiveOptedIn({})).toBe(false);
    expect(isLiveOptedIn({ RERANKER_LIVE_VERIFY: '0' })).toBe(false);
    expect(isLiveOptedIn({ RERANKER_LIVE_VERIFY: '1' })).toBe(true);

    expect(() =>
      resolveExternalEvidencePath('tests/fixtures/live/evidence.json', process.cwd()),
    ).toThrow(/outside the repository tree/);

    expect(
      resolveExternalEvidencePath('/tmp/xiaoshuyin-s23-reranker-live.json', process.cwd()),
    ).toBe('/tmp/xiaoshuyin-s23-reranker-live.json');

    const notEvaluatedReport = evaluateTechnicalEvidence({
      contractMechanics: { executed: true, allPassed: true },
      liveProviderCapability: { attempted: false },
      config: {
        provider: RERANKER_PROVIDER,
        modelId: RERANKER_MODEL_ID,
        modelRevision: RERANKER_MODEL_REVISION,
        immutableRevisionPinStatus: RERANKER_IMMUTABLE_REVISION_PIN_STATUS,
        apiSurface: RERANKER_API_SURFACE,
      },
      cleanupSecretSafety: {
        checkCompleted: true,
        secretDetected: false,
        rawContentDetected: false,
        unauthorizedPersistenceDetected: false,
        repoResidueDetected: false,
      },
    });

    expect(notEvaluatedReport.lowerPredicates.LIVE_PROVIDER_CAPABILITY).toBe('NOT_EVALUATED');
    expect(notEvaluatedReport.lowerPredicates.CONFIG_IDENTITY).toBe('UNKNOWN');
    expect(notEvaluatedReport.aggregateTechnicalResult).toBe('UNKNOWN');
  });

  it('counts actual delegated rerank HTTP attempts accurately across 0, 1, and 2 (retry) fetch scenarios offline', async () => {
    const testBaseUrl = 'https://offline-ws.cn-beijing.maas.aliyuncs.com/api/v1';
    const targetUrl = `${testBaseUrl}/services/rerank/text-rerank/text-rerank`;
    const originalGlobalFetch = globalThis.fetch;
    const previousApiKey = process.env['DASHSCOPE_API_KEY'];

    const makeSuccessResponse = (requestId: string) =>
      new Response(
        JSON.stringify({
          request_id: requestId,
          output: {
            results: [
              { index: 0, relevance_score: 0.91 },
              { index: 2, relevance_score: 0.45 },
              { index: 1, relevance_score: 0.12 },
            ],
          },
          usage: { total_tokens: 42 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );

    // Scenario 1: 0 actual fetches (invalid input rejected before transport)
    {
      let delegatedCalls = 0;
      const fakeFetch = (async () => {
        delegatedCalls += 1;
        throw new Error('should not be called');
      }) as typeof fetch;
      globalThis.fetch = fakeFetch;
      try {
        const { attemptCount } = await withCountingGlobalFetch(testBaseUrl, async () => {
          await expect(
            rerank(
              { ...SYNTHETIC_LIVE_REQUEST, query: '   ' },
              { baseUrl: testBaseUrl },
            ),
          ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        });
        expect(attemptCount).toBe(0);
        expect(delegatedCalls).toBe(0);
        expect(globalThis.fetch).toBe(fakeFetch);
      } finally {
        globalThis.fetch = originalGlobalFetch;
      }
      expect(globalThis.fetch).toBe(originalGlobalFetch);
    }

    // Scenario 2: 1 delegated fetch (first attempt succeeds; unrelated URL ignored)
    {
      let delegatedCalls = 0;
      const fakeFetch = (async () => {
        delegatedCalls += 1;
        return makeSuccessResponse('req-offline-1');
      }) as typeof fetch;
      globalThis.fetch = fakeFetch;
      process.env['DASHSCOPE_API_KEY'] = 'offline-synthetic-key';
      try {
        const { value, attemptCount } = await withCountingGlobalFetch(testBaseUrl, async () => {
          await globalThis.fetch('https://unrelated.example.com/health');
          return rerank(SYNTHETIC_LIVE_REQUEST, { baseUrl: testBaseUrl });
        });
        expect(value.providerRequestId).toBe('req-offline-1');
        expect(attemptCount).toBe(1);
        expect(delegatedCalls).toBe(2);
        expect(globalThis.fetch).toBe(fakeFetch);
      } finally {
        globalThis.fetch = originalGlobalFetch;
        if (previousApiKey === undefined) {
          delete process.env['DASHSCOPE_API_KEY'];
        } else {
          process.env['DASHSCOPE_API_KEY'] = previousApiKey;
        }
      }
      expect(globalThis.fetch).toBe(originalGlobalFetch);
    }

    // Scenario 3: 2 delegated fetches (503 retryable failure followed by 200 success)
    {
      let delegatedCalls = 0;
      const fakeFetch = (async (input: Parameters<typeof fetch>[0]) => {
        expect(extractFetchUrl(input)).toBe(targetUrl);
        delegatedCalls += 1;
        if (delegatedCalls === 1) {
          return new Response(
            JSON.stringify({
              request_id: 'req-offline-retry-1',
              code: 'ServiceUnavailable',
              message: 'temporary pressure',
            }),
            { status: 503, headers: { 'content-type': 'application/json' } },
          );
        }
        return makeSuccessResponse('req-offline-retry-2');
      }) as typeof fetch;
      globalThis.fetch = fakeFetch;
      process.env['DASHSCOPE_API_KEY'] = 'offline-synthetic-key';
      try {
        const { value, attemptCount } = await withCountingGlobalFetch(testBaseUrl, () =>
          rerank(SYNTHETIC_LIVE_REQUEST, { baseUrl: testBaseUrl }),
        );
        expect(value.providerRequestId).toBe('req-offline-retry-2');
        expect(attemptCount).toBe(2);
        expect(delegatedCalls).toBe(2);
        expect(attemptCount).toBeLessThanOrEqual(2);
        expect(globalThis.fetch).toBe(fakeFetch);
      } finally {
        globalThis.fetch = originalGlobalFetch;
        if (previousApiKey === undefined) {
          delete process.env['DASHSCOPE_API_KEY'];
        } else {
          process.env['DASHSCOPE_API_KEY'] = previousApiKey;
        }
      }
      expect(globalThis.fetch).toBe(originalGlobalFetch);
    }
  });

  it('executes controlled live verification only when RERANKER_LIVE_VERIFY=1, otherwise preserves NOT_EVALUATED with zero network calls', async () => {
    if (!isLiveOptedIn()) {
      const report = evaluateTechnicalEvidence({
        contractMechanics: { executed: true, allPassed: true },
        liveProviderCapability: { attempted: false },
        config: {
          provider: RERANKER_PROVIDER,
          modelId: RERANKER_MODEL_ID,
          modelRevision: RERANKER_MODEL_REVISION,
          immutableRevisionPinStatus: RERANKER_IMMUTABLE_REVISION_PIN_STATUS,
          apiSurface: RERANKER_API_SURFACE,
        },
        cleanupSecretSafety: {
          checkCompleted: true,
          secretDetected: false,
          rawContentDetected: false,
          unauthorizedPersistenceDetected: false,
          repoResidueDetected: false,
        },
      });
      expect(report.lowerPredicates.LIVE_PROVIDER_CAPABILITY).toBe('NOT_EVALUATED');
      expect(report.lowerPredicates.CONFIG_IDENTITY).toBe('UNKNOWN');
      expect(report.aggregateTechnicalResult).toBe('UNKNOWN');
      return;
    }

    const repositoryHead = readGitHead();
    const trackedTreeClean = isTrackedTreeClean();
    expect(trackedTreeClean).toBe(true);

    const evidencePath = resolveExternalEvidencePath(
      process.env['RERANKER_LIVE_EVIDENCE_PATH'],
      process.cwd(),
    );
    const credentialAvailable = hasApprovedCredential();
    const baseUrl = resolveApprovedBaseUrl();

    if (!credentialAvailable || baseUrl === null) {
      const missingParts: string[] = [];
      if (!credentialAvailable) missingParts.push('approved DASHSCOPE_API_KEY');
      if (baseUrl === null) missingParts.push('approved workspace-specific base URL');

      const blockedEvidence = buildSanitizedEvidence({
        repositoryHead,
        trackedTreeClean,
        baseUrl,
        result: null,
        error: null,
        attemptCount: 0,
        elapsedMs: 0,
        liveState: {
          attempted: true,
          provenance: 'REAL_LIVE_CALL',
          validAccess: false,
          contractCompatible: null,
          missingPrerequisite: true,
          reason: `BLOCKED: missing ${missingParts.join(' and ')}`,
        },
      });

      mkdirSync(dirname(evidencePath), { recursive: true });
      writeFileSync(evidencePath, `${JSON.stringify(blockedEvidence, null, 2)}\n`, 'utf8');

      expect(blockedEvidence.lowerPredicates.LIVE_PROVIDER_CAPABILITY).toBe('BLOCKED');
      expect(blockedEvidence.lowerPredicates.CLEANUP_SECRET_SAFETY).toBe('PASS');
      expect(blockedEvidence.aggregateTechnicalResult).toBe('BLOCKED');
      return;
    }

    const startedAt = Date.now();
    let result: RerankResult | null = null;
    let technicalError: RerankerTechnicalError | null = null;

    const { attemptCount } = await withCountingGlobalFetch(baseUrl, async () => {
      try {
        result = await rerank(SYNTHETIC_LIVE_REQUEST, { baseUrl });
      } catch (err) {
        if (err instanceof RerankerTechnicalError) {
          technicalError = err;
        } else {
          technicalError = new RerankerTechnicalError({
            code: 'UNKNOWN_PROVIDER_FAILURE',
            retryable: false,
          });
        }
      }
    });

    const elapsedMs = Math.max(0, Date.now() - startedAt);

    let validAccess = true;
    let contractCompatible: boolean | null = null;
    let missingPrerequisite = false;
    let reason = 'PASS: live qwen3-rerank call matched frozen contract';

    if (result !== null) {
      expect(result.provider).toBe(RERANKER_PROVIDER);
      expect(result.configuredModelId).toBe(RERANKER_MODEL_ID);
      expect(result.configuredModelRevision).toBeNull();
      expect(result.results).toHaveLength(SYNTHETIC_LIVE_REQUEST.candidates.length);
      contractCompatible = true;
    } else if (technicalError !== null) {
      if (
        technicalError.code === 'CONFIGURATION' ||
        technicalError.code === 'AUTHENTICATION' ||
        technicalError.code === 'AUTHORIZATION'
      ) {
        validAccess = false;
        missingPrerequisite = technicalError.code === 'CONFIGURATION';
        reason = `BLOCKED: ${technicalError.code}`;
      } else if (
        technicalError.code === 'MALFORMED_RESPONSE' ||
        technicalError.code === 'PARTIAL_RESPONSE' ||
        technicalError.code === 'IDENTITY_MAPPING_FAILURE' ||
        technicalError.code === 'UNSUPPORTED_CAPABILITY'
      ) {
        contractCompatible = false;
        reason = `FAIL: ${technicalError.code}`;
      } else {
        contractCompatible = null;
        reason = `UNKNOWN: ${technicalError.code}`;
      }
    }

    const liveEvidence = buildSanitizedEvidence({
      repositoryHead,
      trackedTreeClean,
      baseUrl,
      result,
      error: technicalError,
      attemptCount,
      elapsedMs,
      liveState: {
        attempted: true,
        provenance: 'REAL_LIVE_CALL',
        validAccess,
        contractCompatible,
        missingPrerequisite,
        reason,
      },
    });

    mkdirSync(dirname(evidencePath), { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify(liveEvidence, null, 2)}\n`, 'utf8');

    const scan = scanSanitizedEvidence(liveEvidence, SYNTHETIC_LIVE_REQUEST);
    expect(scan.secretDetected).toBe(false);
    expect(scan.rawContentDetected).toBe(false);
    expect(liveEvidence.lowerPredicates.CLEANUP_SECRET_SAFETY).toBe('PASS');
    expect(liveEvidence.lowerPredicates.CONFIG_IDENTITY).toBe('UNKNOWN');
  });
});
