import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/server/api/src/app.js';

describe('Phase 5 / Production Readiness E — Startup & WeChat fail-closed boundary', () => {
  const productionEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    SESSION_SECRET: 'test-production-session-secret-32chars',
    EVIDENCE_HASH_PEPPER: 'test-evidence-pepper-prod-32chars',
    WECHAT_APP_ID: 'wx_prod_app_id_test',
    WECHAT_APP_SECRET: 'wx_prod_app_secret_test',
    IDENTITY_BINDING_SECRET: 'test-identity-binding-secret-prod-32chars',
    IDENTITY_BINDING_CONTEXT_TTL_SECONDS: '600',
    IDENTITY_BINDING_ATTEMPT_TTL_SECONDS: '900',
    IDENTITY_BINDING_PAIRING_TTL_SECONDS: '300',
    PARTICIPATION_INVITE_TTL_SECONDS: '86400',
    PARTICIPATION_INVITE_TOKEN_SECRET: 'test-participation-invite-secret-32chars',
    DATABASE_URL: 'postgres://xiaoshuyin_app:secret@127.0.0.1:5432/xiaoshuyin',
  };

  let prodApp: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    // buildApp must succeed in production mode without requiring an injected mock provider
    prodApp = await buildApp({ env: productionEnv });
    await prodApp.ready();
  });

  afterAll(async () => {
    await prodApp?.close();
  });

  it('allows production container to start and respond on /healthz', async () => {
    const response = await prodApp.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('keeps WeChat login strictly fail-closed in production when provider is unverified', async () => {
    const response = await prodApp.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: 'test_code_12345' },
    });

    // In production without verified code2session, login must fail closed with 500
    // and must never issue a fake openid or session token.
    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.sessionToken).toBeUndefined();
    expect(body.accountId).toBeUndefined();
  });

  it('matches Dockerfile runner Node patch version with root package.json and CI baseline', () => {
    const dockerfilePath = resolve(process.cwd(), 'apps/server/api/Dockerfile');
    const dockerfileContent = readFileSync(dockerfilePath, 'utf8');

    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    const expectedNodeVersion = '26.13.0';

    // Verify Dockerfile runner image matches 26.13.0
    expect(dockerfileContent).toContain(`FROM node:${expectedNodeVersion}-alpine AS runner`);

    // Verify root package.json engines.node matches 26.13.0
    expect(packageJson.engines?.node).toBe(expectedNodeVersion);
  });
});
