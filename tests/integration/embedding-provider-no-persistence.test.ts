import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { createEmbeddingProvider } from '../../apps/server/api/src/ai/embedding/index.js';
import { EmbeddingCostGuard } from '../../apps/server/api/src/ai/embedding/cost.js';
import type { HttpTransport, HttpTransportRequest, HttpTransportResponse } from '../../apps/server/api/src/ai/embedding/transport.js';
import { createAdminPool } from '../setup/db.js';

class OfflineTransport implements HttpTransport {
  calls = 0;
  async request(_request: HttpTransportRequest, _apiKey: string): Promise<HttpTransportResponse> {
    this.calls += 1;
    return {
      status: 200,
      retryAfter: null,
      body: {
        request_id: 'no-persistence-provider',
        output: {
          embeddings: [{
            index: 0,
            embedding: [0.1, 0.2, 0.3, 0.4],
            sparse_embedding: [{ index: 111290, value: 0.6 }],
          }],
        },
        usage: { total_tokens: 5 },
      },
    };
  }
}

const env: NodeJS.ProcessEnv = {
  DASHSCOPE_API_KEY: 'test-only-secret',
  DASHSCOPE_EMBEDDING_BASE_URL: 'https://integration.maas.aliyuncs.com',
  EMBEDDING_MODEL_ID: 'model-a',
  EMBEDDING_MODEL_VERSION_OR_REVISION: 'rev-1',
  EMBEDDING_DENSE_DIMENSION: '4',
  EMBEDDING_OUTPUT_TYPE_DENSE_SPARSE_PARAM: 'wire-dense-sparse',
};

function quoteIdent(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function snapshot(pool: pg.Pool): Promise<Record<string, number>> {
  const { rows } = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  const result: Record<string, number> = {};
  for (const { tablename } of rows) {
    const count = await pool.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${quoteIdent(tablename)}`);
    result[tablename] = count.rows[0]?.count ?? -1;
  }
  return result;
}

describe('Slice 20 AS-021 — embedding provider has no production persistence', () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = createAdminPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('keeps every public table row count identical before and after an offline provider call', async () => {
    const before = await snapshot(pool);
    const transport = new OfflineTransport();
    const port = createEmbeddingProvider({ env }, { transport, costGuard: new EmbeddingCostGuard() });
    const outcome = await port.embed({
      requestId: 'as-021',
      configuredModelId: 'model-a',
      configuredModelVersionOrRevision: 'rev-1',
      outputType: 'dense+sparse',
      denseDimension: 4,
      items: ['sanitized synthetic input'],
    });
    expect(outcome.kind).toBe('OK');
    expect(transport.calls).toBe(1);
    const after = await snapshot(pool);
    expect(after).toEqual(before);
  });
});
