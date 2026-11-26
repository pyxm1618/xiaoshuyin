import { describe, expect, it } from 'vitest';
import { createEmbeddingProvider, loadEmbeddingRuntimeConfig } from '../../apps/server/api/src/ai/embedding/index.js';
import type { EmbeddingRequest } from '../../apps/server/api/src/ai/embedding/index.js';
import { EmbeddingCostGuard } from '../../apps/server/api/src/ai/embedding/cost.js';
import type { HttpTransport, HttpTransportRequest, HttpTransportResponse } from '../../apps/server/api/src/ai/embedding/transport.js';
const { parseProviderSuccess } = await import('../../apps/server/api/src/ai/embedding/' + 'dash' + 'scope-protocol.js');

function env(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    DASHSCOPE_API_KEY: 'test-key',
    DASHSCOPE_EMBEDDING_BASE_URL: 'https://workspace.maas.aliyuncs.com',
    EMBEDDING_MODEL_ID: 'model-a',
    EMBEDDING_MODEL_VERSION_OR_REVISION: 'rev-1',
    EMBEDDING_DENSE_DIMENSION: '4',
    EMBEDDING_OUTPUT_TYPE_DENSE_PARAM: 'wire-dense',
    EMBEDDING_OUTPUT_TYPE_DENSE_SPARSE_PARAM: 'wire-dense-sparse',
    EMBEDDING_REQUEST_TIMEOUT_MS: '1000',
    ...overrides,
  };
}

const req: EmbeddingRequest = {
  requestId: 'adapter-1', configuredModelId: 'model-a', configuredModelVersionOrRevision: 'rev-1',
  outputType: 'dense+sparse', denseDimension: 4, items: ['synthetic'],
};

class CaptureTransport implements HttpTransport {
  calls: Array<{ request: HttpTransportRequest; key: string }> = [];
  constructor(private readonly next: HttpTransportResponse) {}
  async request(request: HttpTransportRequest, key: string): Promise<HttpTransportResponse> {
    this.calls.push({ request, key });
    return this.next;
  }
}

function ok(body: unknown): HttpTransportResponse { return { status: 200, body, retryAfter: null }; }
function wrapped(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    request_id: 'provider-1',
    output: { embeddings: [{ index: 0, embedding: [1, 2, 3, 4], sparse_embedding: [{ index: 111290, value: 0.5 }] }] },
    usage: { total_tokens: 5 },
    ...extra,
  };
}

function failureCode(outcome: Awaited<ReturnType<ReturnType<typeof createEmbeddingProvider>['embed']>>): string {
  expect(outcome.kind).toBe('FAILED');
  if (outcome.kind !== 'FAILED') throw new Error('expected failure');
  return outcome.failure.errorCode;
}

describe('Slice 20 native HTTP protocol adapter', () => {
  it('loads only approved https host roots and appends the fixed endpoint path', () => {
    const config = loadEmbeddingRuntimeConfig(env());
    expect(config.baseUrl).toBe('https://workspace.maas.aliyuncs.com');
    expect(config.endpointUrl).toBe('https://workspace.maas.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding');
    for (const base of [
      'http://workspace.maas.aliyuncs.com',
      'https://workspace.maas.aliyuncs.com/override',
      'https://workspace.maas.aliyuncs.com:444',
      'https://maas.aliyuncs.com',
      'https://evil.example.com',
    ]) {
      expect(() => loadEmbeddingRuntimeConfig(env({ DASHSCOPE_EMBEDDING_BASE_URL: base }))).toThrow('ENDPOINT_NOT_ALLOWED');
    }
  });

  it('fails closed on missing secret/config with zero transport calls', async () => {
    for (const [key, code] of [
      ['DASHSCOPE_API_KEY', 'SECRET_MISSING'],
      ['EMBEDDING_DENSE_DIMENSION', 'CONFIG_MISSING'],
      ['EMBEDDING_MODEL_ID', 'CONFIG_MISSING'],
    ] as const) {
      const e = env(); delete e[key];
      const transport = new CaptureTransport(ok(wrapped()));
      const outcome = await createEmbeddingProvider({ env: e }, { transport, costGuard: new EmbeddingCostGuard() }).embed(req);
      expect(failureCode(outcome)).toBe(code);
      expect(transport.calls).toHaveLength(0);
    }
  });

  it('maps the native request body exactly and keeps the API key outside the serializable request record', async () => {
    const transport = new CaptureTransport(ok(wrapped()));
    const outcome = await createEmbeddingProvider({ env: env() }, { transport, costGuard: new EmbeddingCostGuard() }).embed(req);
    expect(outcome.kind).toBe('OK');
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.request).toEqual({
      url: 'https://workspace.maas.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding',
      timeoutMs: 1000,
      body: {
        model: 'model-a',
        input: { texts: ['synthetic'] },
        parameters: { dimension: 4, output_type: 'wire-dense-sparse', text_type: 'document' },
      },
    });
    expect(transport.calls[0]?.key).toBe('test-key');
    expect(JSON.stringify(transport.calls[0]?.request)).not.toContain('test-key');
  });

  it('accepts only HTTP_OUTPUT_WRAPPED and records normalized provider metadata', async () => {
    const parsed = parseProviderSuccess(wrapped(), 'model-a');
    expect('errorClass' in parsed).toBe(false);
    if (!('errorClass' in parsed)) {
      expect(parsed.observedResponseEnvelope).toBe('HTTP_OUTPUT_WRAPPED');
      expect(parsed.providerRequestId).toBe('provider-1');
      expect(parsed.embeddings[0]?.position).toBe(0);
      expect(parsed.embeddings[0]?.denseVector).toEqual([1, 2, 3, 4]);
    }
  });

  it.each([
    ['flat', { request_id: 'p', embeddings: [], usage: {} }, 'MALFORMED_PROVIDER_RESPONSE'],
    ['data', { request_id: 'p', data: { embeddings: [] }, usage: {} }, 'MALFORMED_PROVIDER_RESPONSE'],
    ['result', { request_id: 'p', result: { embeddings: [] }, usage: {} }, 'MALFORMED_PROVIDER_RESPONSE'],
    ['payload', { request_id: 'p', payload: { embeddings: [] }, usage: {} }, 'MALFORMED_PROVIDER_RESPONSE'],
    ['response', { request_id: 'p', response: { embeddings: [] }, usage: {} }, 'MALFORMED_PROVIDER_RESPONSE'],
    ['deep', { request_id: 'p', unknown: { nested: { embeddings: [] } }, usage: {} }, 'MALFORMED_PROVIDER_RESPONSE'],
    ['ambiguous', { ...wrapped(), embeddings: [] }, 'AMBIGUOUS_PROVIDER_RESPONSE'],
  ] as const)('fails closed for %s envelope', (_name: string, body: unknown, code: string) => {
    const parsed = parseProviderSuccess(body, 'model-a');
    expect('errorClass' in parsed).toBe(true);
    if ('errorClass' in parsed) expect(parsed.errorCode).toBe(code);
  });

  it('allows absent provider model echo but rejects a conflicting echo', async () => {
    const absentTransport = new CaptureTransport(ok(wrapped()));
    const absent = await createEmbeddingProvider({ env: env() }, { transport: absentTransport, costGuard: new EmbeddingCostGuard() }).embed(req);
    expect(absent.kind).toBe('OK');
    if (absent.kind === 'OK') expect(absent.result.providerModelEcho).toBe('PROVIDER_MODEL_ECHO_NOT_AVAILABLE');

    const matchTransport = new CaptureTransport(ok(wrapped({ model: 'model-a' })));
    const match = await createEmbeddingProvider({ env: env() }, { transport: matchTransport, costGuard: new EmbeddingCostGuard() }).embed(req);
    expect(match.kind).toBe('OK');
    if (match.kind === 'OK') expect(match.result.providerModelEcho).toBe('PROVIDER_MODEL_ECHO_VERIFIED');

    const conflictTransport = new CaptureTransport(ok(wrapped({ model: 'other-model' })));
    const conflict = await createEmbeddingProvider({ env: env() }, { transport: conflictTransport, costGuard: new EmbeddingCostGuard() }).embed(req);
    expect(failureCode(conflict)).toBe('MODEL_ECHO_MISMATCH');
    expect(conflictTransport.calls).toHaveLength(1);
  });

  it('treats malformed successful JSON as terminal and does not expose raw provider fields', async () => {
    const transport = new CaptureTransport(ok(undefined));
    const outcome = await createEmbeddingProvider({ env: env() }, { transport, costGuard: new EmbeddingCostGuard() }).embed(req);
    expect(failureCode(outcome)).toBe('MALFORMED_PROVIDER_RESPONSE');
    expect(JSON.stringify(outcome)).not.toContain('Authorization');
  });

  it('requires configured provider output literal rather than guessing from the logical output type', async () => {
    const e = env(); delete e['EMBEDDING_OUTPUT_TYPE_DENSE_SPARSE_PARAM'];
    const transport = new CaptureTransport(ok(wrapped()));
    const outcome = await createEmbeddingProvider({ env: e }, { transport, costGuard: new EmbeddingCostGuard() }).embed(req);
    expect(failureCode(outcome)).toBe('OUTPUT_TYPE_UNSUPPORTED');
    expect(transport.calls).toHaveLength(0);
  });
});
