import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup/env.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      // Domain tests use a dummy value; integration/DB tests override with real URL.
      DATABASE_URL: process.env['DATABASE_URL'] ?? 'postgres://localhost:5432/xiaoshuyin_test',
    },
  },
});
