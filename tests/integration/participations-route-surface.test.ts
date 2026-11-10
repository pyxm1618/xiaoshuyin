import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/server/api/src/app.js';

describe('Slice 4 participation route surface', () => {
  const seen = new Set<string>();
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({
      onRoute(route) {
        const methods = Array.isArray(route.method) ? route.method : [route.method];
        for (const method of methods) {
          if (String(route.url).includes('participation')) {
            seen.add(`${String(method).toUpperCase()} ${route.url}`);
          }
        }
      },
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers exactly the six frozen participation operations', () => {
    expect([...seen].sort()).toEqual([
      'GET /api/v1/participation-invites/:token',
      'GET /api/v1/participations/:id',
      'POST /api/v1/cases/:id/participation-invites',
      'POST /api/v1/participation-invites/:token/accept',
      'POST /api/v1/participations/:id/decline',
      'POST /api/v1/participations/:id/withdraw',
    ]);
  });

  it('does not expose generic participant management or response routes', () => {
    for (const forbidden of [
      '/responses',
      '/participants',
      '/cancel',
      '/restore',
      '/pause',
      '/resume',
      '/close',
      '/switch-primary',
    ]) {
      expect([...seen].some((entry) => entry.includes(forbidden))).toBe(false);
    }
  });
});
