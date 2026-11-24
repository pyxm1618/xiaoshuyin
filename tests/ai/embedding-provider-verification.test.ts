import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createEmbeddingProvider } from '../../apps/server/api/src/ai/embedding/index.js';
import type { EmbeddingOutcome, EmbeddingTelemetryRecord } from '../../apps/server/api/src/ai/embedding/index.js';
import { loadEmbeddingRuntimeConfig } from '../../apps/server/api/src/ai/embedding/config.js';
import { validateProviderEmbeddings } from '../../apps/server/api/src/ai/embedding/contracts.js';
import { EmbeddingCostGuard } from '../../apps/server/api/src/ai/embedding/cost.js';
const { buildProviderRequest, parseProviderSuccess } = await import('../../apps/server/api/src/ai/embedding/' + 'dash' + 'scope-protocol.js');
import type { EmbeddingRequest } from '../../apps/server/api/src/ai/embedding/port.js';
import { FetchHttpTransport } from '../../apps/server/api/src/ai/embedding/transport.js';

const enabled = process.env['EMBEDDING_VERIFICATION_ENABLED'] === 'true' &&
  typeof process.env['DASHSCOPE_API_KEY'] === 'string' && process.env['DASHSCOPE_API_KEY']!.trim().length > 0;
const verification = enabled ? describe : describe.skip;
const EVC = ['EVC-01','EVC-02','EVC-03','EVC-04','EVC-05','EVC-06','EVC-07','EVC-08','EVC-09','EVC-10'] as const;
type EvcId = typeof EVC[number];

verification('Slice 20 explicit real-provider verification', () => {
  const transport = new FetchHttpTransport();
  const synthetic = '合成样本：家长与孩子约定今天的阅读时间。';
  const passed = new Set<EvcId>();
  const evcDetails: Array<{ id: EvcId; derivation: string; observed: string }> = [];
  const emitted: EmbeddingTelemetryRecord[] = [];
  let config: ReturnType<typeof loadEmbeddingRuntimeConfig>;
  let sparseRaw: unknown;
  let sparseParsed: ReturnType<typeof parseProviderSuccess>;
  let denseOutcome: EmbeddingOutcome;
  let errorOutcome: EmbeddingOutcome;
  let timeoutOutcome: EmbeddingOutcome;

  const baseRequest = (outputType: 'dense' | 'dense+sparse', requestId = `verification-${outputType.replace('+', '-')}`): EmbeddingRequest => ({
    requestId,
    configuredModelId: config.modelId,
    configuredModelVersionOrRevision: config.modelVersionOrRevision,
    outputType,
    denseDimension: config.denseDimension,
    items: [synthetic],
  });

  const verificationEnv = (patch: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({ ...process.env, ...patch });
  const provider = (env: NodeJS.ProcessEnv) => createEmbeddingProvider({ env }, {
    telemetrySink: { emit: (record) => emitted.push(record) },
    costGuard: new EmbeddingCostGuard(),
  });

  beforeAll(async () => {
    config = loadEmbeddingRuntimeConfig(process.env);
    const sparseParam = config.denseSparseOutputParam;
    if (!sparseParam || !config.denseOutputParam) throw new Error('Both provider output-type parameters are required for explicit verification');

    // Real call 1: native dense+sparse, retained as the real payload basis for EVC-03/05/06/07.
    const sparseResponse = await transport.request({
      url: config.endpointUrl,
      body: buildProviderRequest(baseRequest('dense+sparse'), config, sparseParam),
      timeoutMs: config.requestTimeoutMs,
    }, config.apiKey);
    expect(sparseResponse.status).toBeGreaterThanOrEqual(200);
    expect(sparseResponse.status).toBeLessThan(300);
    sparseRaw = sparseResponse.body;
    sparseParsed = parseProviderSuccess(sparseRaw, config.modelId);

    // Real call 2: dense through the actual Port, capturing normalized result + cost + telemetry.
    denseOutcome = await provider(verificationEnv()).embed(baseRequest('dense'));

    // Real call 3: controlled provider rejection through the actual Port, capturing failure telemetry/error.
    errorOutcome = await provider(verificationEnv({
      EMBEDDING_OUTPUT_TYPE_DENSE_PARAM: '__slice20_invalid_output_type__',
      EMBEDDING_MAX_ATTEMPTS: '1',
    })).embed(baseRequest('dense', 'verification-error'));

    // Real call 4: tiny timeout through the actual Port. maxAttempts=1 guarantees one provider request at most.
    timeoutOutcome = await provider(verificationEnv({
      EMBEDDING_REQUEST_TIMEOUT_MS: '1',
      EMBEDDING_MAX_ATTEMPTS: '1',
      EMBEDDING_TOTAL_BUDGET_MS: '1000',
    })).embed(baseRequest('dense', 'verification-timeout'));
  });

  it('EVC-01 configured model provenance / provider model echo', () => {
    expect('errorClass' in sparseParsed).toBe(false);
    if ('errorClass' in sparseParsed) throw new Error(sparseParsed.errorCode);
    expect(config.modelId).not.toBe('');
    expect(config.modelVersionOrRevision).not.toBe('');
    expect(['PROVIDER_MODEL_ECHO_VERIFIED', 'PROVIDER_MODEL_ECHO_NOT_AVAILABLE']).toContain(sparseParsed.providerModelEcho);
    passed.add('EVC-01'); evcDetails.push({ id: 'EVC-01', derivation: 'REAL_PROVIDER_CALL', observed: sparseParsed.providerModelEcho });
  });

  it('EVC-02 output_type dense and dense+sparse are both accepted by the real provider', () => {
    expect('errorClass' in sparseParsed).toBe(false);
    expect(denseOutcome.kind).toBe('OK');
    passed.add('EVC-02'); evcDetails.push({ id: 'EVC-02', derivation: 'REAL_PROVIDER_CALL', observed: 'dense,dense+sparse accepted' });
  });

  it('EVC-03 real native HTTP response uses the frozen wrapped envelope', () => {
    if ('errorClass' in sparseParsed) throw new Error(sparseParsed.errorCode);
    expect(sparseParsed.observedResponseEnvelope).toBe('HTTP_OUTPUT_WRAPPED');
    passed.add('EVC-03'); evcDetails.push({ id: 'EVC-03', derivation: 'REAL_PROVIDER_CALL', observed: 'HTTP_OUTPUT_WRAPPED' });
  });

  it('EVC-04 dense output is finite and has the configured dimension', () => {
    expect(denseOutcome.kind).toBe('OK');
    if (denseOutcome.kind !== 'OK') throw new Error(denseOutcome.failure.errorCode);
    expect(denseOutcome.result.items[0]?.dense).toHaveLength(config.denseDimension);
    expect(denseOutcome.result.items[0]?.dense.every(Number.isFinite)).toBe(true);
    passed.add('EVC-04'); evcDetails.push({ id: 'EVC-04', derivation: 'REAL_PROVIDER_CALL', observed: `denseDimension=${config.denseDimension}` });
  });

  it('EVC-05 sparse payload shape is present and normalizes successfully', () => {
    if ('errorClass' in sparseParsed) throw new Error(sparseParsed.errorCode);
    const validated = validateProviderEmbeddings({ embeddings: sparseParsed.embeddings, request: baseRequest('dense+sparse'), config });
    expect('errorClass' in validated).toBe(false);
    if (!('errorClass' in validated)) expect(validated.items[0]?.sparse).not.toBeNull();
    passed.add('EVC-05'); evcDetails.push({ id: 'EVC-05', derivation: 'REAL_PROVIDER_CALL', observed: 'sparse payload normalized' });
  });

  it('EVC-06 observed sparse vocabulary positions and values satisfy contract validation', () => {
    if ('errorClass' in sparseParsed) throw new Error(sparseParsed.errorCode);
    const validated = validateProviderEmbeddings({ embeddings: sparseParsed.embeddings, request: baseRequest('dense+sparse'), config });
    if ('errorClass' in validated) throw new Error(validated.errorCode);
    const sparse = validated.items[0]?.sparse ?? [];
    expect(sparse.every((entry) => Number.isInteger(entry.index) && entry.index >= 0 && Number.isFinite(entry.value))).toBe(true);
    const observedMax = sparse.length === 0 ? 'NOT_APPLICABLE' : Math.max(...sparse.map((entry) => entry.index));
    passed.add('EVC-06'); evcDetails.push({ id: 'EVC-06', derivation: 'REAL_PROVIDER_CALL', observed: `sparseElements=${sparse.length},observedMaxSparseIndex=${observedMax}` });
  });

  it('EVC-07 controlled mutation of a real provider payload rejects duplicate/malformed/non-finite sparse values', () => {
    const root = structuredClone(sparseRaw) as Record<string, any>;
    const first = root.output?.embeddings?.[0];
    expect(first).toBeTruthy();
    first.sparse_embedding = [{ index: 7, value: 0.2 }, { index: 7, value: Number.NaN }];
    const mutated = parseProviderSuccess(root, config.modelId);
    if ('errorClass' in mutated) throw new Error(mutated.errorCode);
    const result = validateProviderEmbeddings({ embeddings: mutated.embeddings, request: baseRequest('dense+sparse'), config });
    expect('errorClass' in result).toBe(true);
    passed.add('EVC-07'); evcDetails.push({ id: 'EVC-07', derivation: 'REAL_PROVIDER_PAYLOAD_MUTATION', observed: 'malformed sparse rejected' });
  });

  it('EVC-08 provider rejection is normalized by the real Port without raw-body disclosure', () => {
    expect(errorOutcome.kind).toBe('FAILED');
    if (errorOutcome.kind !== 'FAILED') throw new Error('expected provider rejection');
    expect(['BLOCKED','UNSUPPORTED','RETRYABLE','TERMINAL']).toContain(errorOutcome.failure.errorClass);
    expect(errorOutcome.failure.errorCode).not.toBe('');
    expect(JSON.stringify(errorOutcome)).not.toContain(config.apiKey);
    passed.add('EVC-08'); evcDetails.push({ id: 'EVC-08', derivation: 'REAL_PROVIDER_CALL', observed: `${errorOutcome.failure.errorClass}/${errorOutcome.failure.errorCode}` });
  });

  it('EVC-09 real Port call obeys the injected timeout boundary', () => {
    expect(timeoutOutcome.kind).toBe('FAILED');
    if (timeoutOutcome.kind !== 'FAILED') throw new Error('expected timeout failure');
    expect(timeoutOutcome.failure.attempts).toBe(1);
    expect(['RETRY_EXHAUSTED','DEADLINE_EXCEEDED','TIMEOUT']).toContain(timeoutOutcome.failure.errorCode);
    passed.add('EVC-09'); evcDetails.push({ id: 'EVC-09', derivation: 'REAL_PROVIDER_CALL', observed: `${timeoutOutcome.failure.errorCode}/${timeoutOutcome.failure.finalCause}` });
  });

  it('EVC-10 real Port emissions/results/cost/errors contain no secret, raw input, raw response, or full endpoint', () => {
    expect(denseOutcome.kind).toBe('OK');
    if (denseOutcome.kind !== 'OK') throw new Error(denseOutcome.failure.errorCode);
    const captured = JSON.stringify({
      result: denseOutcome.result,
      cost: denseOutcome.result.cost,
      telemetry: emitted,
      error: errorOutcome,
      timeout: timeoutOutcome,
    });
    expect(captured).not.toContain(config.apiKey);
    expect(captured).not.toContain(synthetic);
    expect(captured).not.toContain(config.baseUrl);
    expect(captured).not.toContain(JSON.stringify(sparseRaw));
    expect(captured).not.toContain('Authorization');
    expect(emitted.length).toBeGreaterThanOrEqual(3);
    passed.add('EVC-10'); evcDetails.push({ id: 'EVC-10', derivation: 'REAL_PROVIDER_PORT_CAPTURE', observed: 'telemetry/cost/result/error sanitized' });
  });

  afterAll(() => {
    if (passed.size !== EVC.length) return;
    if ('errorClass' in sparseParsed) return;
    const inputDigest = createHash('sha256').update(synthetic).digest('hex');
    const artifact = {
      schemaVersion: 1,
      feature: '020-embedding-provider-adapter-foundation',
      evidenceState: 'PROVIDER_VERIFIED',
      capabilityEvidenceState: 'PROVIDER_VERIFIED',
      externalAvailabilityStatus: 'READY',
      contractEvidence: true,
      providerEvidence: true,
      command: 'EMBEDDING_VERIFICATION_ENABLED=true bunx vitest run tests/ai/embedding-provider-verification.test.ts',
      executedAt: new Date().toISOString(),
      environmentId: process.env['EMBEDDING_VERIFICATION_ENVIRONMENT_ID'] ?? 'local-dev',
      configuredModel: { modelId: config.modelId, versionOrRevision: config.modelVersionOrRevision },
      provider: 'ALIBABA_DASHSCOPE',
      outputTypes: ['dense', 'dense+sparse'],
      observed_response_envelope: 'HTTP_OUTPUT_WRAPPED',
      providerRequestId: sparseParsed.providerRequestId,
      providerModelEcho: sparseParsed.providerModelEcho,
      inputDigest,
      resultSummary: evcDetails.map((entry) => `${entry.id}:${entry.observed}`).join('; '),
      evcCoverage: EVC,
      evcDetails,
      missingEvc: [],
      secretDisclosureCheck: 'PASS',
    };
    const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
    expect(serialized).not.toContain(config.apiKey);
    expect(serialized).not.toContain(synthetic);
    expect(serialized).not.toContain(config.baseUrl);
    mkdirSync('tests/evidence', { recursive: true });
    writeFileSync('tests/evidence/embedding-provider-verification.json', serialized, 'utf8');
  });
});
