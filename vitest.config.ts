import { defineConfig } from 'vitest/config';

export default defineConfig({
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
    maxWorkers: 3,
    env: {
      // Domain tests use a dummy value; integration/DB tests override with real URL.
      DATABASE_URL: process.env['DATABASE_URL'] ?? 'postgres://localhost:5432/xiaoshuyin_test',
    },
  },
});
