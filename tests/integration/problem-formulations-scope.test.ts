/**
 * Slice 8 — exact public surface + negative-space guard.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/api/src/app.js';
import { buildOpenApiDocument } from '../../apps/server/api/src/openapi-spec.js';

const FORMULATION_PATH_PREFIX = '/api/v1/cases/{id}/problem-formulations';

describe('problem formulation public surface (Slice 8)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const routes: { method: string; url: string }[] = [];

  beforeAll(async () => {
    app = await buildApp({
      onRoute: (route) => {
        const methods = Array.isArray(route.method) ? route.method : [route.method];
        for (const method of methods) {
          routes.push({ method: String(method).toUpperCase(), url: route.url });
        }
      },
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers exactly the four frozen formulation operations', () => {
    const formulationRoutes = routes
      .filter((route) => route.method !== 'HEAD' && route.url.includes('/problem-formulations'))
      .map((route) => `${route.method} ${route.url}`)
      .sort();
    expect(formulationRoutes).toEqual(
      [
        'GET /api/v1/cases/:id/problem-formulations/current',
        'POST /api/v1/cases/:id/problem-formulations/:version/confirm',
        'POST /api/v1/cases/:id/problem-formulations/:version/corrections',
        'POST /api/v1/cases/:id/problem-formulations/:version/dispute',
      ].sort()
    );
  });

  it('registers no internal command as a public route', () => {
    for (const forbidden of [
      '/start-assessment',
      '/present',
      '/reassess',
      '/problem-formulations/history',
    ]) {
      expect(routes.some((route) => route.url.includes(forbidden)), forbidden).toBe(false);
    }
    expect(
      routes.some(
        (route) =>
          route.url === '/api/v1/cases/:id/problem-formulations' &&
          route.method === 'POST'
      )
    ).toBe(false);
  });

  it('generated OpenAPI exposes exactly the four frozen operations', () => {
    const doc = buildOpenApiDocument() as any;
    const ops: string[] = [];
    for (const [path, item] of Object.entries<any>(doc.paths)) {
      if (!path.includes('/problem-formulations')) continue;
      for (const method of Object.keys(item)) {
        ops.push(`${method.toUpperCase()} ${path}`);
      }
    }
    expect(ops.sort()).toEqual(
      [
        `GET ${FORMULATION_PATH_PREFIX}/current`,
        `POST ${FORMULATION_PATH_PREFIX}/{version}/confirm`,
        `POST ${FORMULATION_PATH_PREFIX}/{version}/corrections`,
        `POST ${FORMULATION_PATH_PREFIX}/{version}/dispute`,
      ].sort()
    );
  });

  it('keeps out-of-scope objects absent from the schema surface', () => {
    const doc = buildOpenApiDocument() as any;
    for (const forbidden of [
      '/api/v1/goals',
      '/api/v1/plans',
      '/api/v1/tasks',
    ]) {
      expect(doc.paths[forbidden], forbidden).toBeUndefined();
    }
  });
});