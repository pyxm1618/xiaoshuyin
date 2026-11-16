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
    expect(response.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('rate-limits application routes while health remains exempt', async () => {
    let limited = false;
    for (let i = 0; i < 1001; i += 1) {
      const response = await app.inject({ method: 'GET', url: '/api/v1/me' });
      if (response.statusCode === 429) {
        expect(response.headers['retry-after']).toBeDefined();
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);

    for (let i = 0; i < 3; i += 1) {
      const health = await app.inject({ method: 'GET', url: '/healthz' });
      expect(health.statusCode).toBe(200);
      expect(health.headers['x-ratelimit-limit']).toBeUndefined();
    }
  });
});
