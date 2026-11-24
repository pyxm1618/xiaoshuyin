import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const seam = 'apps/server/api/src/ai/embedding';
const expectedSeamFiles = [
  'config.ts', 'contracts.ts', 'cost.ts', 'dashscope-protocol.ts', 'errors.ts',
  'evidence.ts', 'index.ts', 'port.ts', 'telemetry.ts', 'transport.ts',
].sort();

function read(path: string): string { return readFileSync(path, 'utf8'); }
function seamSources(): Array<{ file: string; text: string }> {
  return expectedSeamFiles.map((file) => ({ file, text: read(`${seam}/${file}`) }));
}
function walkTs(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) out.push(...walkTs(path));
    else if (path.endsWith('.ts')) out.push(path);
  }
  return out;
}

describe('Slice 20 architecture and negative-scope boundary', () => {
  it('keeps the production seam to the exact ten frozen TypeScript files', () => {
    expect(readdirSync(seam).filter((name: string) => name.endsWith('.ts')).sort()).toEqual(expectedSeamFiles);
  });

  it('contains none of the forbidden retrieval/storage/index tokens or adapter identifiers', () => {
    const forbidden = [
      'sparse' + 'vec', 'knowledge_' + 'embeddings', 'knowledge_' + 'chunks', 'pg_' + 'jieba', 'pg_' + 'textsearch',
      'hns' + 'w', 'ivf' + 'flat', 'Embedding' + 'Adapter', 'Reranker' + 'Adapter',
      'rerank', 'fusion', 'RRF', 'retrieval', 'hard filter', 'top-k', 'topK', 'ranking',
      'Gold Dataset', 'winner', 'reviewer registry', 'approval table', 'provider registry', 'model registry',
      'ContextBuilder', 'AI Task Runtime', 'TaskModelRegistry', 'ordering guarantee',
    ];
    const all = seamSources().map(({ text }) => text).join('\n');
    for (const token of forbidden) expect(all).not.toContain(token);
    for (const name of expectedSeamFiles) {
      expect(name).not.toMatch(/(?:embedding|reranker)[-_]?adapter\.(?:ts|tsx|js|mjs|cjs)$/i);
    }
  });

  it('has no DB, domain-runtime, test-fixture, auth/session, route, or professional-content coupling', () => {
    const all = seamSources().map(({ text }) => text).join('\n');
    for (const pattern of [
      /from\s+['"]pg['"]/, /from\s+['"]drizzle-orm['"]/, /(?:^|['"/])db\//m,
      /@xiaoshuyin\/(?:ai|rag|memory)/, /tests\//, /fixtures/i,
      /\bapp\.(?:get|post|put|patch|delete)\s*\(/, /\bauthorize\b/, /\bsession\b/i,
      /professional_knowledge/i, /professional-knowledge/i,
      /workflow engine/i, /generic vector abstraction/i, /dynamic discovery/i,
    ]) expect(all).not.toMatch(pattern);
  });

  it('keeps config.ts as the only seam env access and transport.ts as the only network fetch site', () => {
    const envReaders = seamSources().filter(({ text }) => text.includes('process.env')).map(({ file }) => file);
    const fetchers = seamSources().filter(({ text }) => text.includes('globalThis.fetch(')).map(({ file }) => file);
    expect(envReaders).toEqual(['config.ts']);
    expect(fetchers).toEqual(['transport.ts']);
  });

  it('keeps index.ts Port-only and app.ts disconnected from the seam', () => {
    const index = read(`${seam}/index.ts`);
    expect(index).not.toContain('dash' + 'scope-protocol');
    expect(index).not.toMatch(/from\s+['"].*transport/);
    expect(index).not.toMatch(/sparse_embedding|total_tokens|request_id/);
    const app = read('apps/server/api/src/app.ts');
    expect(app).not.toMatch(/ai\/embedding/);
  });

  it('keeps exactly one ownership rule for the exact seam and no broader ai parent matcher', () => {
    const registry = JSON.parse(read('.specify/implementation-ownership.json')) as {
      rules: Array<{ id: string; match: { kind: string; path: string }; ownership: { kind: string; features: string[] } }>;
    };
    const exact = registry.rules.filter((rule) => rule.match.kind === 'PREFIX' && rule.match.path === `${seam}/`);
    expect(exact).toHaveLength(1);
    expect(exact[0]).toMatchObject({
      id: 'embedding-provider-adapter-020',
      ownership: { kind: 'FEATURE', features: ['020-embedding-provider-adapter-foundation'] },
    });
    expect(registry.rules.some((rule) => rule.match.path === 'apps/server/api/src/ai/' || rule.match.path === 'apps/server/api/src/ai')).toBe(false);
    expect(registry.rules.some((rule) => rule.id === 'embedding-provider-adapter-020' && rule.match.path.startsWith('packages/'))).toBe(false);
  });

  it('has no forbidden package roots or production persistence surface', () => {
    for (const path of ['packages/ai', 'packages/rag', 'packages/memory']) expect(existsSync(path)).toBe(false);
    const all = seamSources().map(({ text }) => text).join('\n');
    expect(all).not.toMatch(/\bINSERT\s+INTO\b|\bDELETE\s+FROM\b|\bUPDATE\s+[A-Za-z_][\\w."]*\s+SET\b|\bCREATE\s+(?:TABLE|INDEX|EXTENSION|TYPE|SCHEMA)\b/i);
  });

  it('permits direct provider integration only inside the seam and consumers cannot import protocol/transport internals', () => {
    const production = walkTs('apps/server/api/src');
    for (const file of production) {
      if (file.startsWith(`${seam}/`)) continue;
      const text = read(file);
      expect(text, relative('.', file)).not.toMatch(/DASHSCOPE_|maas\.aliyuncs\.com|ALIBABA_DASHSCOPE/);
      expect(text, relative('.', file)).not.toMatch(/ai\/embedding\/(?:transport|dashscope-protocol)/);
    }
  });

  it('enforces the approved endpoint policy with no endpoint-override channel', () => {
    const config = read(`${seam}/config.ts`);
    expect(config).toContain("const FIXED_ENDPOINT_PATH = '/api/v1/services/embeddings/text-embedding/text-embedding'");
    expect(config).toContain("const APPROVED_HOST_SUFFIX = '.maas.aliyuncs.com'");
    expect(config).toContain("parsed.protocol !== 'https:'");
    expect(config).not.toMatch(/ENDPOINT_OVERRIDE|CUSTOM_ENDPOINT|EMBEDDING_ENDPOINT/);
  });

  it('contains no provider SDK dependency/import and no permissive envelope parser', () => {
    const production = seamSources().map(({ text }) => text).join('\n');
    const dependencySurface = `${production}\n${read('package.json')}\n${read('bun.lock')}`;
    expect(dependencySurface).not.toMatch(/dashscope|@alicloud/);
    const protocol = read(`${seam}/dashscope-protocol.ts`);
    expect(protocol).toContain("output['embeddings']");
    expect(protocol).toContain("Object.prototype.hasOwnProperty.call(root, 'embeddings')");
    expect(protocol).not.toMatch(/Object\.values|Object\.entries|recursive|deepSearch|findEmbedding|flatten/i);
    expect(protocol).not.toMatch(/\[['"](?:data|result|payload|response)['"]\]/);
  });

  it('keeps the unchanged MODE A guard without Slice 20 allowances or SDK fixtures', () => {
    const guard = read('scripts/guard-static.mjs');
    expect(guard).not.toContain('R8_PATH_SCOPED_ALLOWANCES');
    expect(guard).not.toMatch(/slice20.*(?:dashscope|@alicloud)/i);
  });

  it('does not compare sparse vocabulary positions with the dense dimension', () => {
    const contracts = read(`${seam}/contracts.ts`);
    expect(contracts).not.toMatch(/(?:position|index)[^\n]{0,80}denseDimension|denseDimension[^\n]{0,80}(?:position|index)/);
  });
});
