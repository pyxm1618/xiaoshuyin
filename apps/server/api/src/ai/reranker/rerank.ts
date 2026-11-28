import { createRerankerConfig, type RerankerCapabilityConfig } from './config.js';
import {
  validateRerankRequest,
  type RerankCandidateResult,
  type RerankRequest,
  type RerankResult,
} from './contracts.js';
import { RerankerTechnicalError } from './errors.js';
import { createRerankerTransport, type RerankerTransport } from './transport.js';

export type CreateRerankerOptions = {
  readonly baseUrl: string;
};

export type RerankerOrchestrationDependencies = {
  readonly transport?: RerankerTransport;
};

export type RerankPort = {
  rerank(request: RerankRequest): Promise<RerankResult>;
};

type ParsedResultItem = {
  readonly index: number;
  readonly candidateId: string;
  readonly score: number;
};

function normalizeParsedResults(
  results: readonly ParsedResultItem[],
): readonly RerankCandidateResult[] {
  const sorted = [...results].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.index - b.index;
  });

  return sorted.map((item, position) => ({
    candidateId: item.candidateId,
    score: item.score,
    rank: position + 1,
  }));
}

function resolveTransport(
  config: RerankerCapabilityConfig,
  deps: RerankerOrchestrationDependencies,
): RerankerTransport {
  if (deps.transport !== undefined) {
    if (
      deps.transport.provider !== config.provider ||
      deps.transport.modelId !== config.modelId
    ) {
      throw new RerankerTechnicalError({
        code: 'CONFIGURATION',
        retryable: false,
      });
    }
    return deps.transport;
  }

  return createRerankerTransport(config);
}

/**
 * Creates a stateless reranker capability port bound to the frozen DashScope qwen3-rerank config.
 */
export function createReranker(
  options: CreateRerankerOptions,
  deps: RerankerOrchestrationDependencies = {},
): RerankPort {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new RerankerTechnicalError({
      code: 'CONFIGURATION',
      retryable: false,
    });
  }

  const config = createRerankerConfig({ baseUrl: options.baseUrl });

  return {
    async rerank(request: RerankRequest): Promise<RerankResult> {
      // Validate all caller inputs locally before constructing or invoking any transport.
      const validation = validateRerankRequest(request);
      if (!validation.ok) {
        throw new RerankerTechnicalError({
          code: 'INVALID_INPUT',
          retryable: false,
        });
      }

      const transport = resolveTransport(config, deps);
      const { executeDashScopeRerank } = await import('./dashscope.js');
      const parsed = await executeDashScopeRerank(validation.value, transport);

      return {
        provider: config.provider,
        configuredModelId: config.modelId,
        configuredModelRevision: config.modelRevision,
        providerRequestId: parsed.requestId,
        usage: {
          totalTokens: parsed.usage.totalTokens,
        },
        results: normalizeParsedResults(parsed.results),
      };
    },
  };
}

/**
 * Executes a single stateless rerank capability call and returns normalized RerankResult.
 */
export async function rerank(
  request: RerankRequest,
  options: CreateRerankerOptions,
  deps: RerankerOrchestrationDependencies = {},
): Promise<RerankResult> {
  return createReranker(options, deps).rerank(request);
}
