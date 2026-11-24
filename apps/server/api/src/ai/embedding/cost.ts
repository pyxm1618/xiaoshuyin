export interface EmbeddingUsage {
  readonly totalTokens: number | 'NOT_PROVIDED';
  readonly promptTokens: number | 'NOT_PROVIDED';
  readonly granularity: 'REQUEST_AGGREGATE';
}

export interface CostRecord {
  readonly logicalRequestId: string;
  readonly providerRequestId: string | 'NOT_PROVIDED';
  readonly usage: EmbeddingUsage;
  readonly perItemUsage: 'NOT_PROVIDED';
  readonly perItemExactCost: 'UNKNOWN';
  readonly configuredModel: {
    readonly modelId: string;
    readonly versionOrRevision: string;
  };
  readonly pricingProvenance: 'CONFIGURED_PER_1K_TOKENS' | 'NOT_CONFIGURED';
  readonly totalCost: number | 'UNKNOWN';
  readonly totalCostKind: 'ESTIMATED_FROM_CONFIGURED_PRICE' | 'UNKNOWN';
  readonly currency: string | 'UNKNOWN';
  readonly costGuard: 'OK' | 'LIMIT_REACHED_AFTER_CALL';
}

export class EmbeddingCostGuard {
  private totalTokens = 0;
  private blocked = false;

  isBlocked(maxTokensPerProcess: number): boolean {
    return this.blocked || this.totalTokens >= maxTokensPerProcess;
  }

  record(
    totalTokens: number | 'NOT_PROVIDED',
    maxTokensPerCall: number,
    maxTokensPerProcess: number,
  ): 'OK' | 'LIMIT_REACHED_AFTER_CALL' {
    if (totalTokens === 'NOT_PROVIDED') return this.blocked ? 'LIMIT_REACHED_AFTER_CALL' : 'OK';
    this.totalTokens += totalTokens;
    if (totalTokens >= maxTokensPerCall || this.totalTokens >= maxTokensPerProcess) this.blocked = true;
    return this.blocked ? 'LIMIT_REACHED_AFTER_CALL' : 'OK';
  }
}

export const DEFAULT_EMBEDDING_COST_GUARD = new EmbeddingCostGuard();

function tokenField(value: unknown): number | 'NOT_PROVIDED' | null {
  if (value === undefined) return 'NOT_PROVIDED';
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

export function normalizeUsage(raw: { readonly totalTokens: unknown; readonly promptTokens: unknown }): EmbeddingUsage | null {
  const totalTokens = tokenField(raw.totalTokens);
  const promptTokens = tokenField(raw.promptTokens);
  if (totalTokens === null || promptTokens === null) return null;
  return Object.freeze({ totalTokens, promptTokens, granularity: 'REQUEST_AGGREGATE' as const });
}

export function buildCostRecord(input: {
  readonly logicalRequestId: string;
  readonly providerRequestId: string | 'NOT_PROVIDED';
  readonly usage: EmbeddingUsage;
  readonly configuredModelId: string;
  readonly configuredModelVersionOrRevision: string;
  readonly pricePer1kTokens?: number;
  readonly priceCurrency?: string;
  readonly costGuard: 'OK' | 'LIMIT_REACHED_AFTER_CALL';
}): CostRecord {
  const canEstimate = input.pricePer1kTokens !== undefined && typeof input.usage.totalTokens === 'number';
  return Object.freeze({
    logicalRequestId: input.logicalRequestId,
    providerRequestId: input.providerRequestId,
    usage: input.usage,
    perItemUsage: 'NOT_PROVIDED' as const,
    perItemExactCost: 'UNKNOWN' as const,
    configuredModel: Object.freeze({
      modelId: input.configuredModelId,
      versionOrRevision: input.configuredModelVersionOrRevision,
    }),
    pricingProvenance: input.pricePer1kTokens !== undefined ? 'CONFIGURED_PER_1K_TOKENS' as const : 'NOT_CONFIGURED' as const,
    totalCost: canEstimate ? (input.usage.totalTokens as number) * (input.pricePer1kTokens as number) / 1000 : 'UNKNOWN' as const,
    totalCostKind: canEstimate ? 'ESTIMATED_FROM_CONFIGURED_PRICE' as const : 'UNKNOWN' as const,
    currency: input.pricePer1kTokens !== undefined ? (input.priceCurrency ?? 'UNKNOWN') : 'UNKNOWN',
    costGuard: input.costGuard,
  });
}
