import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const seam = 'apps/server/api/src/ai/embedding';
const rerankerSeam = 'apps/server/api/src/ai/reranker';
const privateImportTargets = new Set([
  resolve(seam, 'transport'),
  resolve(seam, 'dashscope-protocol'),
]);
const privateProtocolModule = './embedding/' + 'dashscope' + '-protocol.js';
const staticImportSpecifier = /\bimport\s*(?:type\s+)?[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g;
const sideEffectImportSpecifier = /\bimport\s*['"]([^'"]+)['"]/g;
const dynamicImportSpecifier = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
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

// Removes comments while preserving string literals, so `from /* ... */ './x'` is
// still recognized and `//` inside a URL string is not truncated.
function stripComments(source: string): string {
  let out = '';
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "'" || char === '"' || char === '`') {
      out += char;
      index += 1;
      while (index < source.length) {
        const inner = source[index];
        if (inner === '\\') {
          out += source.slice(index, index + 2);
          index += 2;
          continue;
        }
        out += inner;
        index += 1;
        if (inner === char) break;
      }
      continue;
    }
    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      // Keep a separator so `import//c\n{...}` cannot fuse into `import{...}`.
      out += ' ';
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index += 2;
      // Keep a separator so `import/*c*/{...}` cannot fuse into `import{...}`.
      out += ' ';
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

// Extracts every static ES import specifier (named/default/namespace/type/side-effect)
// plus dynamic import()/require(); resolution is left to resolvedPrivateImport.
function importSpecifiers(source: string): string[] {
  const code = stripComments(source);
  const specifiers: string[] = [];
  for (const pattern of [staticImportSpecifier, sideEffectImportSpecifier, dynamicImportSpecifier]) {
    pattern.lastIndex = 0;
    for (const match of code.matchAll(pattern)) {
      const specifier = match[1] ?? match[2];
      if (specifier) specifiers.push(specifier);
    }
  }
  return specifiers;
}

// Resolves relative specifiers against the importing file so equivalent paths such as
// `./embedding/transport.js` from src/ai are mechanically recognized as the private module.
function resolvedPrivateImport(file: string, text: string): string | null {
  for (const specifier of importSpecifiers(text)) {
    if (!specifier.startsWith('.')) continue;
    const target = resolve(dirname(file), specifier).replace(/\.(?:[cm]?[jt]s)$/, '');
    if (privateImportTargets.has(target)) return target;
  }
  return null;
}

// Slice 23 has a separately governed provider seam, not access to Slice 20 internals.
function assertProviderBoundary(file: string, text: string): void {
  if (file.startsWith(`${seam}/`)) return;
  if (!file.startsWith(`${rerankerSeam}/`)) {
    expect(text, relative('.', file)).not.toMatch(/DASHSCOPE_|maas\.aliyuncs\.com|ALIBABA_DASHSCOPE/);
  }
  expect(text, relative('.', file)).not.toMatch(/(?:ai\/|\.\.\/)(?:\.\/)*embedding\/(?:\.\/)*(?:transport|dashscope-protocol)/);
  expect(resolvedPrivateImport(file, text), relative('.', file)).toBeNull();
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

  it('permits direct provider integration only inside the governed seams and consumers cannot import embedding protocol/transport internals', () => {
    for (const file of walkTs('apps/server/api/src')) {
      assertProviderBoundary(file, read(file));
    }
  });

  it.each([
    ['apps/server/api/src/ai/embedding/config.ts', true],
    ['apps/server/api/src/ai/reranker/config.ts', true],
    ['apps/server/api/src/ai/other/config.ts', false],
    ['apps/server/api/src/providers/config.ts', false],
    ['apps/server/api/src/ai/reranker-other/config.ts', false],
  ] as const)('enforces provider token boundary for %s', (file, allowed) => {
    for (const token of ['ALIBABA_DASHSCOPE', 'DASHSCOPE_API_KEY', 'workspace.maas.aliyuncs.com']) {
      const check = () => assertProviderBoundary(file, token);
      if (allowed) expect(check).not.toThrow();
      else expect(check).toThrow();
    }
  });

  it.each([
    'apps/server/api/src/ai/reranker/dashscope.ts',
    'apps/server/api/src/ai/other/consumer.ts',
  ])('rejects embedding-private imports from %s even when provider tokens are absent', (file) => {
    for (const internal of ['transport', 'dashscope-protocol']) {
      for (const prefix of ['../../ai/embedding/', 'ai/embedding/', '../embedding/', '../embedding/./', '.././embedding/']) {
        expect(() => assertProviderBoundary(file, `import '${prefix}${internal}'`)).toThrow();
      }
    }
  });

  it.each([
    ['apps/server/api/src/ai/consumer.ts', './embedding/transport.js'],
    ['apps/server/api/src/ai/consumer.ts', './embedding/dashscope-protocol.js'],
    ['apps/server/api/src/providers/native.ts', '../ai/embedding/transport.js'],
    ['apps/server/api/src/ai/other/nested/consumer.ts', '../../embedding/transport.js'],
    ['apps/server/api/src/ai/other/consumer.ts', '../embedding/./transport.js'],
  ])('rejects relative imports that resolve to the private seam: %s -> %s', (file, specifier) => {
    expect(() => assertProviderBoundary(file, `import x from '${specifier}';`)).toThrow();
  });

  it.each([
    ['compact named import without whitespace', "import{FetchHttpTransport} from './embedding/transport.js';"],
    ['comment-adjacent compact named import', "import/* boundary */{ FetchHttpTransport } from './embedding/transport.js';"],
    ['compact namespace import without whitespace', "import*as X from './embedding/transport.js';"],
    ['comment between from and specifier', "import { FetchHttpTransport } from /* boundary */ './embedding/transport.js';"],
    ['multiline named import', "import {\n  FetchHttpTransport\n} from './embedding/transport.js';"],
    ['default import', "import T from './embedding/transport.js';"],
    ['namespace import', `import * as T from '${privateProtocolModule}';`],
    ['type-only import', "import type { HttpTransport } from /* c */ './embedding/transport.js';"],
    ['side-effect import', "import './embedding/transport.js';"],
    ['dynamic import', "const m = await import('./embedding/transport.js');"],
    ['require call', "const m = require('./embedding/transport.js');"],
    ['nested path with comment', "import { X } from /* c */ '../ai/embedding/transport.js';"],
  ])('rejects a %s that reaches a private module', (_name, code) => {
    expect(() => assertProviderBoundary('apps/server/api/src/ai/consumer.ts', code)).toThrow();
  });

  it.each([
    ['apps/server/api/src/ai/consumer.ts', './embedding/index.js'],
    ['apps/server/api/src/ai/consumer.ts', './embedding/port.js'],
    ['apps/server/api/src/ai/other/consumer.ts', '../embedding/index.js'],
  ])('allows public Port imports from consumers: %s -> %s', (file, specifier) => {
    expect(() => assertProviderBoundary(file, `import type { P } from '${specifier}';`)).not.toThrow();
  });

  it.each([
    ['comment before public specifier', "import { createEmbeddingProvider } from /* public */ './embedding/index.js';"],
    ['compact public import', "import{createEmbeddingProvider}from './embedding/index.js';"],
    ['side-effect public import', "import './embedding/index.js';"],
    ['namespace public import', "import * as E from './embedding/port.js';"],
  ])('allows a %s', (_name, code) => {
    expect(() => assertProviderBoundary('apps/server/api/src/ai/consumer.ts', code)).not.toThrow();
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
