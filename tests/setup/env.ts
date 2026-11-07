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

// Vitest sets NODE_ENV=test by default; be explicit so the runtime channel and
// the fake WeChat provider are deterministic even if the runner changes.
process.env['NODE_ENV'] ??= 'test';

// Test-only fixture secrets. Production code has NO fallback:
// `loadRuntimeConfig()` fails hard when any of these are absent.
const testDefaults: Record<string, string> = {
  EVIDENCE_HASH_PEPPER: 'test-evidence-hash-pepper-fixture',
  SESSION_SECRET: 'test-session-secret-fixture-value',
  WECHAT_APP_ID: 'test-wechat-app-id',
  WECHAT_APP_SECRET: 'test-wechat-app-secret',
  IDENTITY_BINDING_SECRET: 'test-identity-binding-secret-fixture-32chars',
  IDENTITY_BINDING_CONTEXT_TTL_SECONDS: '600',
  IDENTITY_BINDING_ATTEMPT_TTL_SECONDS: '900',
};
for (const [key, value] of Object.entries(testDefaults)) {
  if (!process.env[key]) process.env[key] = value;
}

export {};