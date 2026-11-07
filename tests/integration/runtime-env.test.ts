/**
 * F1: production startup boundary.
 *
 * Production MUST fail fast when a required secret is missing/short and MUST
 * never select the fake WeChat provider. Test / approved local Stage A may use
 * the deterministic fake provider.
 */

import { describe, it, expect } from 'vitest';
import { buildApp } from '../../apps/server/api/src/app.js';

const FULL_ENV: NodeJS.ProcessEnv = {
  DATABASE_URL: process.env['DATABASE_URL'],
  SESSION_SECRET: 'a'.repeat(32),
  EVIDENCE_HASH_PEPPER: 'b'.repeat(32),
  WECHAT_APP_ID: 'wx-test-app-id',
  WECHAT_APP_SECRET: 'wx-test-app-secret',
  IDENTITY_BINDING_SECRET: 'test-identity-binding-secret-fixture-32chars',
  IDENTITY_BINDING_CONTEXT_TTL_SECONDS: '600',
  IDENTITY_BINDING_ATTEMPT_TTL_SECONDS: '900',
};

describe('Production runtime env boundary (F1)', () => {
  it('production + missing SESSION_SECRET → startup fails', async () => {
    const { SESSION_SECRET: _omit, ...env } = FULL_ENV;
    await expect(
      buildApp({ env: { ...env, NODE_ENV: 'production' } })
    ).rejects.toThrow(/SESSION_SECRET/);
  });

  it('production + short SESSION_SECRET → startup fails', async () => {
    await expect(
      buildApp({
        env: { ...FULL_ENV, NODE_ENV: 'production', SESSION_SECRET: 'short' },
      })
    ).rejects.toThrow(/SESSION_SECRET/);
  });

  it('unset NODE_ENV + missing SESSION_SECRET → startup fails (fail-closed)', async () => {
    const { SESSION_SECRET: _omit, ...env } = FULL_ENV;
    await expect(buildApp({ env })).rejects.toThrow(/SESSION_SECRET/);
  });

  it('production + full env → fake provider is NOT selected (startup fails)', async () => {
    await expect(
      buildApp({ env: { ...FULL_ENV, NODE_ENV: 'production' } })
    ).rejects.toThrow(/WECHAT_PROVIDER_NOT_VERIFIED/);
  });

  it('test environment may explicitly use the fake provider', async () => {
    const app = await buildApp({ env: { ...FULL_ENV, NODE_ENV: 'test' } });
    try {
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/wechat',
        payload: { code: `f1_fake_${Date.now()}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().sessionToken).toBeDefined();
    } finally {
      await app.close();
    }
  });
});