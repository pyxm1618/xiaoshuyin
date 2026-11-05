// Test environment setup: require DATABASE_URL.
// Integration/DB tests must set a real DATABASE_URL in their environment.
// Domain tests use the default from vitest.config.ts.
if (!process.env['DATABASE_URL']) {
  throw new Error(
    'Missing required environment variable: DATABASE_URL. ' +
      'Tests require a PostgreSQL 18 instance. ' +
      'Set DATABASE_URL in your environment or .env file.'
  );
}

export {};
