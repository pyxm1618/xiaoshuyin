import { describe, expect, it } from 'vitest';
import { createEmbeddingProvider, deriveCapabilityEvidence } from '../../apps/server/api/src/ai/embedding/index.js';
import type { EmbeddingRequest, EmbeddingTelemetryRecord, ProviderVerificationRecord } from '../../apps/server/api/src/ai/embedding/index.js';
import { EmbeddingCostGuard } from '../../apps/server/api/src/ai/embedding/cost.js';
import type { HttpTransport, HttpTransportRequest, HttpTransportResponse } from '../../apps/server/api/src/ai/embedding/transport.js';
import { TransportTimeoutError } from '../../apps/server/api/src/ai/embedding/transport.js';

const env = (patch: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  DASHSCOPE_API_KEY: 'test-secret-do-not-leak', DASHSCOPE_EMBEDDING_BASE_URL: 'https://unit.maas.aliyuncs.com',
  EMBEDDING_MODEL_ID: 'model-a', EMBEDDING_MODEL_VERSION_OR_REVISION: 'rev-1', EMBEDDING_DENSE_DIMENSION: '4',
  EMBEDDING_OUTPUT_TYPE_DENSE_PARAM: 'dense-wire', EMBEDDING_OUTPUT_TYPE_DENSE_SPARSE_PARAM: 'dense-sparse-wire',
  EMBEDDING_REQUEST_TIMEOUT_MS: '1000', EMBEDDING_TOTAL_BUDGET_MS: '5000', EMBEDDING_RETRY_BASE_DELAY_MS: '50',
  EMBEDDING_MAX_ATTEMPTS: '3', ...patch,
});
const req = (patch: Partial<EmbeddingRequest> = {}): EmbeddingRequest => ({
  requestId: 'r1', configuredModelId: 'model-a', configuredModelVersionOrRevision: 'rev-1', outputType: 'dense+sparse',
  denseDimension: 4, items: ['synthetic alpha'], ...patch,
});
const wrapped = (patch: { dense?: unknown; sparse?: unknown; includeSparse?: boolean; total?: unknown; omitPrompt?: boolean } = {}): unknown => {
  const item: Record<string, unknown> = { index: 0, embedding: patch.dense ?? [1,2,3,4] };
  if (patch.includeSparse !== false) item['sparse_embedding'] = patch.sparse ?? [{ index: 111290, value: .4 }, { index: 1130, value: .2 }];
  const usage: Record<string, unknown> = { total_tokens: patch.total ?? 7 };
  if (!patch.omitPrompt) usage['prompt_tokens'] = 7;
  return { request_id: 'p1', output: { embeddings: [item] }, usage };
};
type Step = HttpTransportResponse | Error;
class Fake implements HttpTransport {
  calls: HttpTransportRequest[] = [];
  constructor(readonly steps: Step[]) {}
  async request(r: HttpTransportRequest, _k: string): Promise<HttpTransportResponse> {
    this.calls.push(r); const x = this.steps[Math.min(this.calls.length - 1, this.steps.length - 1)];
    if (!x) throw new Error('missing step'); if (x instanceof Error) throw x; return x;
  }
}
const res = (body: unknown, status = 200, retryAfter: string | null = null): HttpTransportResponse => ({ status, body, retryAfter });
const fail = (o: Awaited<ReturnType<ReturnType<typeof createEmbeddingProvider>['embed']>>, code: string) => {
  expect(o.kind).toBe('FAILED'); if (o.kind !== 'FAILED') throw new Error('expected failure'); expect(o.failure.errorCode).toBe(code); return o.failure;
};
async function call(body: unknown, options: { e?: NodeJS.ProcessEnv; r?: EmbeddingRequest; t?: Fake; tel?: EmbeddingTelemetryRecord[]; guard?: EmbeddingCostGuard; now?: () => number; sleep?: (ms: number) => Promise<void> } = {}) {
  const t = options.t ?? new Fake([res(body)]), tel = options.tel ?? [];
  const p = createEmbeddingProvider({ env: options.e ?? env() }, { transport: t, costGuard: options.guard ?? new EmbeddingCostGuard(), telemetrySink: { emit: x => tel.push(x) }, ...(options.now ? { now: options.now } : {}), ...(options.sleep ? { sleep: options.sleep } : {}) });
  return { o: await p.embed(options.r ?? req()), t, tel };
}

describe('Slice 20 embedding provider contract', () => {
  it.each([
    { requestId: '' }, { configuredModelId: '' }, { configuredModelVersionOrRevision: '' }, { denseDimension: 0 }, { items: [] }, { items: [' '] }, { correlationTag: 'bad tag' },
  ] as Partial<EmbeddingRequest>[])('blocks invalid request before transport', async patch => {
    const t = new Fake([res(wrapped())]); const p = createEmbeddingProvider({ env: env() }, { transport: t, costGuard: new EmbeddingCostGuard() });
    fail(await p.embed(req(patch)), 'INVALID_REQUEST'); expect(t.calls).toHaveLength(0);
  });

  it('normalizes order and accepts sparse index 111290 independent of dense dimension', async () => {
    const body = { request_id:'p', output:{ embeddings:[
      { index:1, embedding:[2,2,2,2], sparse_embedding:[] },
      { index:0, embedding:[1,1,1,1], sparse_embedding:[{index:7149,value:.7},{index:111290,value:.3},{index:3759,value:.2},{index:1130,value:.1}] },
    ]}, usage:{total_tokens:9} };
    const { o } = await call(body, { r:req({ items:['a','b'] }) }); expect(o.kind).toBe('OK');
    if (o.kind === 'OK') { expect(o.result.items.map(x=>x.index)).toEqual([0,1]); expect(o.result.items[0]?.sparse?.map(x=>x.index)).toEqual([1130,3759,7149,111290]); expect(o.result.items[0]?.observedMaxSparseIndex).toBe(111290); }
  });

  it('accepts a finite 1024-dimension dense vector exactly', async () => {
    const dense=Array.from({length:1024},(_,i)=>i/1024);
    const {o}=await call(wrapped({dense}),{e:env({EMBEDDING_DENSE_DIMENSION:'1024'}),r:req({denseDimension:1024})});
    expect(o.kind).toBe('OK'); if(o.kind==='OK'){expect(o.result.items[0]?.dense).toHaveLength(1024);expect(o.result.items[0]?.dense.every(Number.isFinite)).toBe(true);}
  });

  it.each([
    [[1,2,3], 'DIMENSION_MISMATCH'], [[1,2,Number.NaN,4], 'DENSE_INVALID_VALUE'], [[1,2,Infinity,4], 'DENSE_INVALID_VALUE'], [[1,2,-Infinity,4], 'DENSE_INVALID_VALUE'],
  ] as const)('rejects invalid dense vectors all-or-nothing', async (dense, code) => fail((await call(wrapped({ dense }))).o, code));

  it.each([
    [[{index:-1,value:1}], 'SPARSE_INDEX_INVALID'], [[{index:3.5,value:1}], 'SPARSE_INDEX_INVALID'],
    [[{index:9,value:1},{index:9,value:2}], 'SPARSE_INDEX_DUPLICATE'], [[{index:9,value:NaN}], 'SPARSE_VALUE_INVALID'],
  ] as const)('rejects invalid sparse vectors', async (sparse, code) => fail((await call(wrapped({ sparse }))).o, code));

  it('enforces sparse element/vocabulary bounds only when configured', async () => {
    expect((await call(wrapped({ sparse:[{index:111290,value:1}] }))).o.kind).toBe('OK');
    fail((await call(wrapped({ sparse:[{index:111290,value:1}] }), { e:env({ EMBEDDING_SPARSE_VOCABULARY_MAX:'1000' }) })).o, 'SPARSE_INDEX_INVALID');
    fail((await call(wrapped({ sparse:[{index:1,value:1},{index:2,value:1}] }), { e:env({ EMBEDDING_MAX_SPARSE_ELEMENTS:'1' }) })).o, 'SPARSE_LIMIT_EXCEEDED');
  });

  it('requires sparse when requested and ignores it for dense-only', async () => {
    expect(fail((await call(wrapped({ includeSparse:false }))).o, 'SPARSE_NOT_RETURNED').errorClass).toBe('UNSUPPORTED');
    const x = await call(wrapped({ sparse:[{index:-1,value:NaN}] }), { r:req({ outputType:'dense' }) }); expect(x.o.kind).toBe('OK');
    if (x.o.kind === 'OK') expect(x.o.result.items[0]?.sparse).toBeNull();
  });

  it('rejects cardinality/index incompleteness for the whole batch', async () => {
    fail((await call(wrapped(), { r:req({items:['a','b']}) })).o, 'DENSE_CARDINALITY_MISMATCH');
    const body={request_id:'p',output:{embeddings:[{index:0,embedding:[1,1,1,1],sparse_embedding:[]},{index:0,embedding:[2,2,2,2],sparse_embedding:[]}]},usage:{total_tokens:3}};
    fail((await call(body,{r:req({items:['a','b']})})).o,'RESPONSE_MALFORMED');
  });

  it('rejects N+1 provider embeddings without truncation', async () => {
    const body={request_id:'p',output:{embeddings:[{index:0,embedding:[1,1,1,1],sparse_embedding:[]},{index:1,embedding:[2,2,2,2],sparse_embedding:[]}]},usage:{total_tokens:3}};
    fail((await call(body)).o,'DENSE_CARDINALITY_MISMATCH');
  });

  it('fails the whole batch when the second embedding is invalid', async () => {
    const body={request_id:'p',output:{embeddings:[{index:0,embedding:[1,1,1,1],sparse_embedding:[]},{index:1,embedding:[2,2,Number.NaN,2],sparse_embedding:[]}]},usage:{total_tokens:3}};
    const outcome=(await call(body,{r:req({items:['a','b']})})).o; fail(outcome,'DENSE_INVALID_VALUE'); expect(outcome.kind).toBe('FAILED');
  });

  it('bounds retries, never retries auth, honors Retry-After budget, timeout and caller abort', async () => {
    let t=new Fake([res({request_id:'x'},429),res({request_id:'y'},429),res({request_id:'z'},429)]);
    let x=await call(undefined,{t,sleep:async()=>{}}); expect(fail(x.o,'RETRY_EXHAUSTED').attempts).toBe(3); expect(t.calls).toHaveLength(3);
    t=new Fake([res({request_id:'a'},401)]); x=await call(undefined,{t}); expect(fail(x.o,'AUTH_TERMINAL').errorClass).toBe('TERMINAL'); expect(t.calls).toHaveLength(1);
    let now=0; t=new Fake([res({request_id:'b'},429,'10')]); x=await call(undefined,{t,e:env({EMBEDDING_TOTAL_BUDGET_MS:'1000'}),now:()=>now,sleep:async ms=>{now+=ms;}}); expect(fail(x.o,'DEADLINE_EXCEEDED').finalCause).toBe('RETRY_AFTER_EXCEEDS_BUDGET');
    t=new Fake([new TransportTimeoutError(),new TransportTimeoutError(),new TransportTimeoutError()]); x=await call(undefined,{t,sleep:async()=>{}}); fail(x.o,'RETRY_EXHAUSTED'); expect(t.calls).toHaveLength(3);
    t=new Fake([res(wrapped())]); const p=createEmbeddingProvider({env:env()},{transport:t,costGuard:new EmbeddingCostGuard()}); const c=new AbortController(); c.abort(); fail(await p.embed(req(),c.signal),'ABORTED'); expect(t.calls).toHaveLength(0);
  });

  it('reuses the same route-neutral Port for three independent callers', async () => {
    const t=new Fake([res(wrapped())]), p=createEmbeddingProvider({env:env()},{transport:t,costGuard:new EmbeddingCostGuard()});
    expect(Object.keys(p)).toEqual(['embed']);
    for(const id of ['caller-a','caller-b','caller-c']) expect((await p.embed(req({requestId:id}))).kind).toBe('OK');
    expect(t.calls).toHaveLength(3);
  });

  it('does not cache identical requests and isolates concurrent provenance', async () => {
    const t=new Fake([res(wrapped())]), p=createEmbeddingProvider({env:env()},{transport:t,costGuard:new EmbeddingCostGuard()}); await p.embed(req()); await p.embed(req()); expect(t.calls).toHaveLength(2);
    const tel:EmbeddingTelemetryRecord[]=[]; const a=createEmbeddingProvider({env:env()},{transport:new Fake([res(wrapped())]),costGuard:new EmbeddingCostGuard(),telemetrySink:{emit:r=>tel.push(r)}});
    const b=createEmbeddingProvider({env:env({EMBEDDING_MODEL_ID:'model-b'})},{transport:new Fake([res(wrapped())]),costGuard:new EmbeddingCostGuard(),telemetrySink:{emit:r=>tel.push(r)}});
    await Promise.all([a.embed(req({requestId:'a'})),b.embed(req({requestId:'b',configuredModelId:'model-b'}))]); expect(tel.map(r=>[r.logicalRequestId,r.configuredModelId]).sort()).toEqual([['a','model-a'],['b','model-b']]);
  });

  it('whitelists telemetry, hides secret/input/url, isolates sink failure, and keeps aggregate cost unknown without price', async () => {
    const tel:EmbeddingTelemetryRecord[]=[]; const {o}=await call(wrapped({total:12,omitPrompt:true}),{tel}); expect(o.kind).toBe('OK'); expect(tel).toHaveLength(1);
    expect(Object.keys(tel[0]!).sort()).toEqual(['attempts','configuredModelId','configuredModelVersionOrRevision','denseDimension','endpointConfigFingerprint','event','latencyMs','logicalRequestId','outputType','provider','providerRequestId','resultStatus','sparseElementCount'].sort());
    const s=JSON.stringify(tel[0]); expect(s).not.toContain('test-secret'); expect(s).not.toContain('synthetic alpha'); expect(s).not.toContain('unit.maas.aliyuncs.com'); expect(tel[0]?.endpointConfigFingerprint).toMatch(/^[a-f0-9]{12}$/);
    if(o.kind==='OK'){expect(o.result.usage).toEqual({totalTokens:12,promptTokens:'NOT_PROVIDED',granularity:'REQUEST_AGGREGATE'});expect(o.result.cost.perItemUsage).toBe('NOT_PROVIDED');expect(o.result.cost.perItemExactCost).toBe('UNKNOWN');expect(o.result.cost.totalCost).toBe('UNKNOWN');}
    const p=createEmbeddingProvider({env:env()},{transport:new Fake([res(wrapped())]),costGuard:new EmbeddingCostGuard(),telemetrySink:{emit:()=>{throw new Error('sink')}}}); expect((await p.embed(req())).kind).toBe('OK');
  });

  it('freezes future calls only after observed cost limit is reached', async () => {
    const guard=new EmbeddingCostGuard(), t=new Fake([res(wrapped({total:10}))]); const p=createEmbeddingProvider({env:env({EMBEDDING_MAX_TOKENS_PER_CALL:'5'})},{transport:t,costGuard:guard});
    const first=await p.embed(req()); expect(first.kind).toBe('OK'); if(first.kind==='OK') expect(first.result.cost.costGuard).toBe('LIMIT_REACHED_AFTER_CALL'); fail(await p.embed(req({requestId:'r2'})),'COST_LIMIT_REACHED'); expect(t.calls).toHaveLength(1);
  });

  it('accounts provider usage before rejecting malformed embedding output', async () => {
    const guard=new EmbeddingCostGuard(), t=new Fake([res(wrapped({total:100,includeSparse:false}))]);
    const p=createEmbeddingProvider({env:env({EMBEDDING_MAX_TOKENS_PER_CALL:'1'})},{transport:t,costGuard:guard});
    fail(await p.embed(req()),'SPARSE_NOT_RETURNED');
    fail(await p.embed(req({requestId:'r2'})),'COST_LIMIT_REACHED');
    expect(t.calls).toHaveLength(1);
  });

  it.each([
    ['ambiguous envelope', { ...(wrapped({ total: 100 }) as Record<string, unknown>), embeddings: [] }, 'AMBIGUOUS_PROVIDER_RESPONSE'],
    ['model echo mismatch', { ...(wrapped({ total: 100 }) as Record<string, unknown>), model: 'other-model' }, 'MODEL_ECHO_MISMATCH'],
  ] as const)('accounts valid aggregate usage before rejecting a %s', async (_name, body, code) => {
    const guard = new EmbeddingCostGuard(), t = new Fake([res(body), res(wrapped())]);
    const p = createEmbeddingProvider({ env: env({ EMBEDDING_MAX_TOKENS_PER_CALL: '1' }) }, { transport: t, costGuard: guard });
    const failure = fail(await p.embed(req()), code);
    expect(JSON.stringify(failure)).not.toContain('total_tokens');
    expect(failure.cost).toMatchObject({
      logicalRequestId: 'r1',
      providerRequestId: 'p1',
      usage: { totalTokens: 100, promptTokens: 7, granularity: 'REQUEST_AGGREGATE' },
      perItemUsage: 'NOT_PROVIDED',
      perItemExactCost: 'UNKNOWN',
      configuredModel: { modelId: 'model-a', versionOrRevision: 'rev-1' },
      pricingProvenance: 'NOT_CONFIGURED',
      totalCost: 'UNKNOWN',
      totalCostKind: 'UNKNOWN',
      currency: 'UNKNOWN',
      costGuard: 'LIMIT_REACHED_AFTER_CALL',
    });
    expect(Object.isFrozen(failure.cost)).toBe(true);
    fail(await p.embed(req({ requestId: 'r2' })), 'COST_LIMIT_REACHED');
    expect(t.calls).toHaveLength(1);
  });

  it('prices the retained failure cost record from configured price provenance', async () => {
    const body = { ...(wrapped({ total: 100 }) as Record<string, unknown>), embeddings: [] };
    const { o } = await call(body, { e: env({ EMBEDDING_PRICE_PER_1K_TOKENS: '2', EMBEDDING_PRICE_CURRENCY: 'CNY' }) });
    const failure = fail(o, 'AMBIGUOUS_PROVIDER_RESPONSE');
    expect(failure.cost).toMatchObject({
      providerRequestId: 'p1',
      usage: { totalTokens: 100 },
      pricingProvenance: 'CONFIGURED_PER_1K_TOKENS',
      totalCost: 0.2,
      totalCostKind: 'ESTIMATED_FROM_CONFIGURED_PRICE',
      currency: 'CNY',
      costGuard: 'OK',
    });
  });

  it('retains cost association without synthesizing usage the provider did not return', async () => {
    const noUsage = fail((await call({ request_id: 'p9', output: { embeddings: [] }, embeddings: [] })).o, 'AMBIGUOUS_PROVIDER_RESPONSE');
    expect(noUsage.cost).toMatchObject({
      providerRequestId: 'p9',
      usage: { totalTokens: 'NOT_PROVIDED', promptTokens: 'NOT_PROVIDED', granularity: 'REQUEST_AGGREGATE' },
      totalCost: 'UNKNOWN',
      totalCostKind: 'UNKNOWN',
      costGuard: 'OK',
    });
    const malformed = fail((await call({ output: { embeddings: [] }, usage: { total_tokens: 5 } })).o, 'MALFORMED_PROVIDER_RESPONSE');
    expect(malformed.providerRequestId).toBe('NOT_PROVIDED');
    expect(malformed.cost).toMatchObject({ providerRequestId: 'NOT_PROVIDED', usage: { totalTokens: 5 } });
  });

  it('retains the cost record when returned vectors are rejected after billing', async () => {
    const failure = fail((await call(wrapped({ dense: [1, 2] }))).o, 'DIMENSION_MISMATCH');
    expect(failure.cost).toMatchObject({
      logicalRequestId: 'r1',
      providerRequestId: 'p1',
      usage: { totalTokens: 7 },
      costGuard: 'OK',
    });
  });

  it('records rejected-call usage in the cost guard exactly once', async () => {
    const guard = new EmbeddingCostGuard();
    const ambiguous = { ...(wrapped({ total: 100 }) as Record<string, unknown>), embeddings: [] };
    const t = new Fake([res(ambiguous), res(wrapped({ total: 100 }))]);
    const p = createEmbeddingProvider(
      { env: env({ EMBEDDING_MAX_TOKENS_PER_CALL: '1000', EMBEDDING_MAX_TOKENS_PER_PROCESS: '250' }) },
      { transport: t, costGuard: guard },
    );
    const failure = fail(await p.embed(req()), 'AMBIGUOUS_PROVIDER_RESPONSE');
    expect(failure.cost?.costGuard).toBe('OK');
    const ok = await p.embed(req({ requestId: 'r2' }));
    expect(ok.kind).toBe('OK');
    if (ok.kind === 'OK') expect(ok.result.cost.costGuard).toBe('OK');
    expect(t.calls).toHaveLength(2);
  });

  it('does not record aggregate usage the provider did not return as valid', async () => {
    const invalid = { request_id: 'p', output: { embeddings: [] }, embeddings: [], usage: { total_tokens: -5, prompt_tokens: 7 } };
    const guard = new EmbeddingCostGuard(), t = new Fake([res(invalid), res(wrapped())]);
    const p = createEmbeddingProvider({ env: env({ EMBEDDING_MAX_TOKENS_PER_CALL: '1' }) }, { transport: t, costGuard: guard });
    const failure = fail(await p.embed(req()), 'AMBIGUOUS_PROVIDER_RESPONSE');
    expect(failure.cost).toBeUndefined();
    expect((await p.embed(req({ requestId: 'r2' }))).kind).toBe('OK');
    expect(t.calls).toHaveLength(2);
  });

  it('derives evidence purely: offline/partial/fake never become provider verified', () => {
    const offline=deriveCapabilityEvidence({contractChecksAllPassed:true,configComplete:true,providerVerification:null}); expect(offline).toMatchObject({capabilityEvidenceState:'CONTRACT_VERIFIED',externalAvailabilityStatus:'PROVIDER_NOT_VERIFIED',providerEvidence:false}); expect(Object.isFrozen(offline)).toBe(true);
    const full:ProviderVerificationRecord={source:'REAL_ALIBABA_DASHSCOPE_CALL',executedAt:'2026-11-24T00:00:00.000Z',environmentId:'protected',configuredModelId:'model-a',configuredModelVersionOrRevision:'rev-1',providerRequestId:'p',providerModelEcho:'PROVIDER_MODEL_ECHO_NOT_AVAILABLE',observedResponseEnvelope:'HTTP_OUTPUT_WRAPPED',evcCoverage:['EVC-01','EVC-02','EVC-03','EVC-04','EVC-05','EVC-06','EVC-07','EVC-08','EVC-09','EVC-10'],command:'protected command',inputDigest:'a'.repeat(64),resultSummary:'sanitized'};
    for(const removed of full.evcCoverage){const r=deriveCapabilityEvidence({contractChecksAllPassed:true,configComplete:true,providerVerification:{...full,evcCoverage:full.evcCoverage.filter(x=>x!==removed)}});expect(r.externalAvailabilityStatus).toBe('PROVIDER_NOT_VERIFIED');expect(r.missingEvc).toContain(removed);}
    expect(deriveCapabilityEvidence({contractChecksAllPassed:true,configComplete:true,providerVerification:{...full,source:'FAKE' as ProviderVerificationRecord['source']}}).externalAvailabilityStatus).toBe('PROVIDER_NOT_VERIFIED');
  });

  it('never leaks raw body, input, secret, or stack into failures', async () => {
    const {o}=await call({request_id:'p',output:{embeddings:[{index:0,embedding:[1,2]}]},secret:'raw-marker'}); fail(o,'DIMENSION_MISMATCH'); const s=JSON.stringify(o); for(const x of ['test-secret','raw-marker','synthetic alpha','stack']) expect(s).not.toContain(x);
  });
});
