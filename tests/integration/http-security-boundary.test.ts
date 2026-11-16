import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/server/api/src/app.js';

describe('Foundation HTTP security boundary', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('adds standard security headers without changing health semantics', async () => {
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['content-security-policy']).toBeDefined();
  });

  it('does not infer a proxy/client-IP trust contract for application traffic', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });

    // No global limiter is installed until the deployment authority freezes
    // trusted proxy/client-IP semantics. The application response therefore
    // remains the route's ordinary authentication outcome rather than 429.
    expect(response.statusCode).not.toBe(429);
    expect(response.headers['x-ratelimit-limit']).toBeUndefined();
    expect(response.headers['retry-after']).toBeUndefined();
  });
});
