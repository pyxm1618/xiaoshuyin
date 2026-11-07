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

// Test-only fixture secret for HMAC evidence hashing. Production code has NO
// fallback: `requireEvidencePepper()` fails hard when the variable is absent.
// CI runs the integration job without this variable, so the test harness
// supplies a deterministic value (tests are excluded from the secret-literal
// static guard).
process.env['EVIDENCE_HASH_PEPPER'] ??= 'test-evidence-hash-pepper-fixture';

export {};
