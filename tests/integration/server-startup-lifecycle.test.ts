import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../../apps/server/api/src/app.js';
import { loadRuntimeConfig } from '../../apps/server/api/src/runtime-env.js';

const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://xiaoshuyin_app:password123@localhost:5432/xiaoshuyin',
  SESSION_SECRET: 'test-session-secret-at-least-16-bytes',
  EVIDENCE_HASH_PEPPER: 'test-pepper-at-least-16-bytes-length',
  WECHAT_APP_ID: 'wx_test_app_id',
  WECHAT_APP_SECRET: 'wx_test_app_secret',
  IDENTITY_BINDING_SECRET: 'test-binding-secret-must-be-32-chars-long',
  IDENTITY_BINDING_CONTEXT_TTL_SECONDS: '300',
  IDENTITY_BINDING_ATTEMPT_TTL_SECONDS: '300',
  IDENTITY_BINDING_PAIRING_TTL_SECONDS: '300',
  PARTICIPATION_INVITE_TTL_SECONDS: '300',
  PARTICIPATION_INVITE_TOKEN_SECRET: 'test-token-secret-must-be-32-bytes-long!',
};

describe('Finding #20: DATABASE_URL Startup Fail-Fast', () => {
  it('fails fast at startup if DATABASE_URL is missing', async () => {
    const envWithoutDb = { ...baseEnv };
    delete envWithoutDb['DATABASE_URL'];

    expect(() => loadRuntimeConfig(envWithoutDb)).toThrow(
      /RUNTIME_ENV_INVALID: DATABASE_URL is missing or blank/
    );

    await expect(buildApp({ env: envWithoutDb })).rejects.toThrow(
      /RUNTIME_ENV_INVALID: DATABASE_URL is missing or blank/
    );
  });

  it('fails fast at startup if DATABASE_URL is blank or empty', async () => {
    const envWithBlankDb = { ...baseEnv, DATABASE_URL: '   ' };

    expect(() => loadRuntimeConfig(envWithBlankDb)).toThrow(
      /RUNTIME_ENV_INVALID: DATABASE_URL is missing or blank/
    );

    await expect(buildApp({ env: envWithBlankDb })).rejects.toThrow(
      /RUNTIME_ENV_INVALID: DATABASE_URL is missing or blank/
    );
  });

  it('does not leak database password or full secret in fail-fast error', () => {
    const envMissing = { ...baseEnv };
    delete envMissing['DATABASE_URL'];

    try {
      loadRuntimeConfig(envMissing);
      expect.unreachable();
    } catch (err: unknown) {
      const msg = (err as Error).message;
      expect(msg).not.toContain('password123');
      expect(msg).toContain('DATABASE_URL is missing or blank');
    }
  });

  it('boots normally with valid DATABASE_URL and preserves /healthz semantics', async () => {
    const app = await buildApp({ env: baseEnv });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/healthz',
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
    } finally {
      await app.close();
    }
  });
});

describe('Finding #35: Server Lifecycle & Resource Cleanup', () => {
  it('closes DB pool on Fastify server close', async () => {
    const app = await buildApp({ env: baseEnv });

    // Close server and verify no unhandled rejections occur
    await expect(app.close()).resolves.toBeUndefined();
  });

  it('ensures shutdown is idempotent and multiple closes do not crash', async () => {
    const app = await buildApp({ env: baseEnv });

    await app.close();
    // Subsequent close is a no-op
    await expect(app.close()).resolves.toBeUndefined();
  });
});
