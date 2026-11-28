import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const RERANKER_SEAM = 'apps/server/api/src/ai/reranker';
const EMBEDDING_SEAM = 'apps/server/api/src/ai/embedding';

const EXPECTED_RERANKER_FILES = [
  'config.ts',
  'contracts.ts',
  'dashscope.ts',
  'errors.ts',
  'evidence.ts',
  'index.ts',
  'rerank.ts',
  'telemetry.ts',
  'transport.ts',
].sort();

const PRIVATE_RERANKER_TARGETS = new Set(
  EXPECTED_RERANKER_FILES.filter((file) => file !== 'index.ts').map((file) =>
    resolve(RERANKER_SEAM, file.replace(/\.ts$/, '')),
  ),
);

const STATIC_IMPORT_SPECIFIER = /\bimport\s*(?:type\s+)?[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g;
const SIDE_EFFECT_IMPORT_SPECIFIER = /\bimport\s*['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_SPECIFIER =
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

function seamSources(): Array<{ file: string; path: string; text: string }> {
  return EXPECTED_RERANKER_FILES.map((file) => {
    const path = `${RERANKER_SEAM}/${file}`;
    return { file, path, text: readText(path) };
  });
}

function walkTs(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      out.push(...walkTs(path));
    } else if (path.endsWith('.ts')) {
      out.push(path);
    }
  }
  return out;
}

// Strips comments while preserving string literals so URL strings are intact and comments do not trigger false positives.
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
      out += ' ';
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        index += 1;
      }
      index += 2;
      out += ' ';
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

function extractImportSpecifiers(source: string): string[] {
  const code = stripComments(source);
  const specifiers: string[] = [];
  for (const pattern of [
    STATIC_IMPORT_SPECIFIER,
    SIDE_EFFECT_IMPORT_SPECIFIER,
    DYNAMIC_IMPORT_SPECIFIER,
  ]) {
    pattern.lastIndex = 0;
    for (const match of code.matchAll(pattern)) {
      const specifier = match[1] ?? match[2];
      if (specifier) specifiers.push(specifier);
    }
  }
  return specifiers;
}

function resolvePrivateRerankerImport(file: string, text: string): string | null {
  for (const specifier of extractImportSpecifiers(text)) {
    if (!specifier.startsWith('.')) continue;
    const target = resolve(dirname(file), specifier).replace(/\.(?:[cm]?[jt]s)$/, '');
    if (PRIVATE_RERANKER_TARGETS.has(target)) return target;
  }
  return null;
}

describe('Slice 23 architecture and negative-scope boundary', () => {
  it('approved production prefix only: freezes apps/server/api/src/ai/reranker/ to the exact nine files', () => {
    expect(existsSync(RERANKER_SEAM)).toBe(true);
    const actualFiles = readdirSync(RERANKER_SEAM)
      .filter((name) => name.endsWith('.ts'))
      .sort();
    expect(actualFiles).toEqual(EXPECTED_RERANKER_FILES);

    const extraEntries = readdirSync(RERANKER_SEAM).filter((name) => !name.endsWith('.ts'));
    expect(extraEntries).toEqual([]);

    for (const forbiddenRoot of ['packages/ai', 'packages/rag', 'apps/server/api/src/providers']) {
      expect(existsSync(forbiddenRoot)).toBe(false);
    }
  });

  it('no provider SDK dependency in package.json, bun.lock, or apps/server/api/package.json', () => {
    const rootPkg = JSON.parse(readText('package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const apiPkg = JSON.parse(readText('apps/server/api/package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const allDepNames = [
      ...Object.keys(rootPkg.dependencies ?? {}),
      ...Object.keys(rootPkg.devDependencies ?? {}),
      ...Object.keys(apiPkg.dependencies ?? {}),
      ...Object.keys(apiPkg.devDependencies ?? {}),
    ];

    for (const dep of allDepNames) {
      expect(dep).not.toMatch(/dashscope|@alicloud|alibabacloud/i);
    }

    const bunLock = readText('bun.lock');
    expect(bunLock).not.toMatch(/["'](?:@alicloud\/|alibabacloud-|dashscope)/i);
  });

  it('no provider SDK imports in reranker production modules', () => {
    for (const { file, text } of seamSources()) {
      const specifiers = extractImportSpecifiers(text);
      for (const specifier of specifiers) {
        if (specifier.startsWith('.')) continue;
        expect(specifier, file).not.toMatch(/dashscope|@alicloud|alibabacloud|axios|node-fetch|undici/i);
      }
    }
  });

  it('egress only in transport.ts', () => {
    const egressSenders: string[] = [];
    for (const { file, text } of seamSources()) {
      const code = stripComments(text);
      const hasEgress =
        /\bglobalThis\.fetch\b/.test(code) ||
        /\bfetch\s*\(/.test(code) ||
        /\baxios\b/.test(code) ||
        /\bnode:https?\b/.test(code);
      if (hasEgress) {
        egressSenders.push(file);
      }
    }
    expect(egressSenders).toEqual(['transport.ts']);
  });

  it('index.ts only public capability surface and no provider index or internal protocol leakage', () => {
    const indexText = readText(`${RERANKER_SEAM}/index.ts`);
    const indexCode = stripComments(indexText);

    expect(indexCode).not.toMatch(/from\s+['"]\.\/dashscope(?:\.js)?['"]/);
    expect(indexCode).not.toMatch(/from\s+['"]\.\/transport(?:\.js)?['"]/);
    expect(indexCode).not.toMatch(/from\s+['"]\.\/config(?:\.js)?['"]/);
    expect(indexCode).not.toMatch(/from\s+['"]\.\/evidence(?:\.js)?['"]/);
    expect(indexCode).not.toMatch(/from\s+['"]\.\/telemetry(?:\.js)?['"]/);

    const contractsText = readText(`${RERANKER_SEAM}/contracts.ts`);
    const rerankResultBlock =
      contractsText.match(/export type RerankResult\s*=\s*\{[\s\S]*?\};/)?.[0] ?? '';
    const candidateResultBlock =
      contractsText.match(/export type RerankCandidateResult\s*=\s*\{[\s\S]*?\};/)?.[0] ?? '';

    expect(rerankResultBlock).not.toBe('');
    expect(candidateResultBlock).not.toBe('');
    expect(candidateResultBlock).not.toMatch(/\bindex\b/);
    expect(rerankResultBlock).not.toMatch(/\brelevance_score\b|\boutput\b/);

    for (const file of walkTs('apps/server/api/src')) {
      if (file.startsWith(`${RERANKER_SEAM}/`)) continue;
      const text = readText(file);
      expect(resolvePrivateRerankerImport(file, text), relative('.', file)).toBeNull();
    }
  });

  it('no route/app wiring or route version activation', () => {
    const appText = readText('apps/server/api/src/app.ts');
    expect(appText).not.toMatch(/ai\/reranker|rerank_route_version|rag_route_version/);

    for (const routeFile of walkTs('apps/server/api/src/routes')) {
      const text = readText(routeFile);
      expect(text, relative('.', routeFile)).not.toMatch(
        /ai\/reranker|rerank_route_version|rag_route_version/,
      );
    }

    const allCode = seamSources()
      .map(({ text }) => stripComments(text))
      .join('\n');
    expect(allCode).not.toMatch(
      /\bapp\.(?:get|post|put|patch|delete)\s*\(|rag_route_version|rerank_route_version/,
    );
  });

  it('no DB/persistence/cache/migration', () => {
    for (const { file, text } of seamSources()) {
      const code = stripComments(text);
      const specifiers = extractImportSpecifiers(text);
      for (const specifier of specifiers) {
        expect(specifier, file).not.toMatch(/^(?:pg|postgres|drizzle-orm|redis|ioredis)$|db\//);
      }
      expect(code, file).not.toMatch(
        /\bdrizzle\b|\bpostgres\b|\bredis\b|\bmigration\b|\breadinessStore\b|\bresultStore\b|\bpersistence\b/i,
      );
      expect(code, file).not.toMatch(
        /\bINSERT\s+INTO\b|\bDELETE\s+FROM\b|\bUPDATE\s+[A-Za-z_][\w."]*\s+SET\b|\bCREATE\s+(?:TABLE|INDEX|EXTENSION|TYPE|SCHEMA)\b/i,
      );
    }
  });

  it('no retrieval/RAG/fusion scope', () => {
    const forbiddenTokens = [
      /dense\s+retrieval/i,
      /sparsevec/i,
      /pg_jieba/i,
      /\bRRF\b/,
      /\bfusion\b/i,
      /hard[-_\s]?filter/i,
      /A\/B\/C\s+evaluator/i,
      /Context\s*Builder/i,
      /AI\s*Task\s*Runtime/i,
      /TaskModelRegistry/,
      /Promptfoo/i,
    ];

    for (const { file, text } of seamSources()) {
      const code = stripComments(text);
      for (const pattern of forbiddenTokens) {
        expect(code, `${file} vs ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('no generic gateway/provider registry/fallback and preserves single candidate qwen3-rerank', () => {
    const forbiddenPlatform = [
      /Model\s*Gateway/i,
      /provider\s*registry/i,
      /multi[-_\s]?provider/i,
      /provider\s*fallback/i,
      /model\s*fallback/i,
      /generic\s+provider\s+factory/i,
    ];

    for (const { file, text } of seamSources()) {
      const code = stripComments(text);
      for (const pattern of forbiddenPlatform) {
        expect(code, `${file} vs ${pattern}`).not.toMatch(pattern);
      }
    }

    const configText = readText(`${RERANKER_SEAM}/config.ts`);
    expect(configText).toContain("export const RERANKER_PROVIDER = 'ALIBABA_DASHSCOPE'");
    expect(configText).toContain("export const RERANKER_MODEL_ID = 'qwen3-rerank'");
  });

  it('no embedding adapter duplication/import', () => {
    for (const { file, path, text } of seamSources()) {
      expect(file).not.toMatch(/embedding/i);
      const specifiers = extractImportSpecifiers(text);
      for (const specifier of specifiers) {
        expect(specifier, file).not.toMatch(/embedding/i);
        if (specifier.startsWith('.')) {
          const resolved = resolve(dirname(path), specifier);
          expect(resolved.startsWith(resolve(EMBEDDING_SEAM)), file).toBe(false);
        }
      }
    }
  });

  it('no Gold/professional correctness semantics', () => {
    const forbiddenSemantics = [
      /\bRecall\b/i,
      /\bMRR\b/,
      /\bnDCG\b/i,
      /\bPrecision\b/i,
      /\buplift\b/i,
      /Gold\s*label/i,
      /professional\s*correctness/i,
      /professionally\s*correct/i,
      /\bapproval\b/i,
      /route\s*winner/i,
      /relevance\s*threshold/i,
      /production\s*threshold/i,
    ];

    for (const { file, text } of seamSources()) {
      const code = stripComments(text);
      for (const pattern of forbiddenSemantics) {
        expect(code, `${file} vs ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('no business object leakage in public port', () => {
    const publicFiles = ['index.ts', 'contracts.ts', 'errors.ts'] as const;
    const forbiddenBusinessTokens = [
      /\bCase\b/,
      /\bKnowledge\b/,
      /\bEvidence\b/,
      /\bConsent\b/,
      /\bSafety\b/,
      /Professional\s*label/i,
      /\bAuthorization\b/,
    ];

    for (const file of publicFiles) {
      const code = stripComments(readText(`${RERANKER_SEAM}/${file}`));
      for (const pattern of forbiddenBusinessTokens) {
        expect(code, `${file} vs ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('no credential literal', () => {
    for (const { file, text } of seamSources()) {
      const code = stripComments(text);
      expect(code, file).not.toMatch(/['"]sk-[A-Za-z0-9_-]{8,}['"]/);
      expect(code, file).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{8,}/);
      if (file !== 'transport.ts') {
        expect(code, file).not.toMatch(/Authorization\s*:\s*`Bearer/);
      }
    }

    const envReaders = seamSources()
      .filter(({ text }) => stripComments(text).includes('process.env'))
      .map(({ file }) => file);
    expect(envReaders.sort()).toEqual(['config.ts', 'transport.ts']);
  });

  it('no raw-content telemetry/evidence', () => {
    const telemetryCode = stripComments(readText(`${RERANKER_SEAM}/telemetry.ts`));
    const whitelistMatch = telemetryCode.match(
      /export const RERANKER_TELEMETRY_WHITELIST_KEYS\s*=\s*\[([\s\S]*?)\]\s*as const/,
    );
    expect(whitelistMatch).not.toBeNull();
    const whitelistBody = whitelistMatch?.[1] ?? '';

    for (const forbiddenField of [
      'query',
      'candidateText',
      'instruct',
      'rawResponse',
      'bodyText',
      'apiKey',
      'authorization',
    ]) {
      expect(whitelistBody).not.toMatch(new RegExp(`['"]${forbiddenField}['"]`, 'i'));
    }

    const evidenceCode = stripComments(readText(`${RERANKER_SEAM}/evidence.ts`));
    expect(evidenceCode).not.toMatch(/\brawResponse\b|\brawQuery\b|\brawCandidate\b|\brawInstruct\b/);
  });

  it('no READY override', () => {
    const evidenceCode = stripComments(readText(`${RERANKER_SEAM}/evidence.ts`));
    const stateMatch = evidenceCode.match(
      /export const EVIDENCE_STATES\s*=\s*\[([\s\S]*?)\]\s*as const/,
    );
    expect(stateMatch).not.toBeNull();
    const states = Array.from(stateMatch?.[1].matchAll(/'([A-Z_]+)'/g)).map((m) => m[1]);
    expect(states).toEqual(['PASS', 'FAIL', 'BLOCKED', 'UNKNOWN', 'NOT_EVALUATED']);

    for (const { file, text } of seamSources()) {
      const code = stripComments(text);
      expect(code, file).not.toMatch(
        /\b(?:forceReady|manualReady|manualPass|productionReady)\b|['"]READY['"]/,
      );
    }
  });

  it('caller cannot override provider, model, endpoint, API key, timeout, or retry in RerankRequest (C23-I07)', () => {
    const contractsCode = stripComments(readText(`${RERANKER_SEAM}/contracts.ts`));
    const requestTypeBlock =
      contractsCode.match(/export type RerankRequest\s*=\s*\{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(requestTypeBlock).not.toBe('');

    for (const forbiddenField of [
      'provider',
      'model',
      'modelId',
      'endpoint',
      'baseUrl',
      'apiKey',
      'timeout',
      'attemptTimeoutMs',
      'retry',
      'maxAttempts',
      'retryBackoffMs',
    ]) {
      expect(requestTypeBlock).not.toMatch(new RegExp(`\\b${forbiddenField}\\b`));
    }
  });

  it('no provider cost fabrication', () => {
    for (const { file, text } of seamSources()) {
      const code = stripComments(text);
      expect(code, file).not.toMatch(
        /\b(?:estimatedCost|costUsd|tokenPrice|pricePerToken|unitPrice)\b/i,
      );
      expect(code, file).not.toMatch(/totalTokens\s*\*/i);
    }
  });
});
