import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Test-only resolution of workspace packages. Without an explicit alias Vite
// marks these specifiers as external and Bun resolves them at runtime, which
// makes `vi.mock('@xiaoshuyin/...')` unable to intercept the module graph.
// The aliases point at the unchanged source entry points.
function workspacePath(pkg: string): string {
  return fileURLToPath(new URL(`./packages/${pkg}/src/index.ts`, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: {
      '@xiaoshuyin/authorization': workspacePath('authorization'),
      '@xiaoshuyin/compliance': workspacePath('compliance'),
      '@xiaoshuyin/contracts': workspacePath('contracts'),
      '@xiaoshuyin/domain': workspacePath('domain'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup/env.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Verification determinism only (no assertion/expected-output changes).
    // On a 10-core dev host, unbounded forks each build their own Fastify app +
    // pg.Pool and can exhaust the local PostgreSQL 18 max_connections, causing
    // `beforeAll` hook timeouts / ECONNREFUSED and a large number of skipped
    // suites. CI runners have fewer cores and naturally stay under this bound.
    // Capping forks keeps the official `bun run vitest run` command deterministic
    // and ensures every required suite actually executes.
    // Slice 9 adds concurrency/failure-injection suites that hold locks and
    // extra connections on the single shared test database. Two workers keep
    // the official full-suite command deterministic without changing any
    // assertion or expected output.
    maxWorkers: 2,
    env: {
      // Domain tests use a dummy value; integration/DB tests override with real URL.
      DATABASE_URL: process.env['DATABASE_URL'] ?? 'postgres://localhost:5432/xiaoshuyin_test',
    },
  },
});
