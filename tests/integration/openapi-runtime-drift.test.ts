/**
 * MEDIUM-01 guard — runtime Fastify route response status set must equal the
 * generated OpenAPI status set for every Case operation.
 *
 * This captures real route schemas through the real `buildApp` registration
 * path (Fastify `onRoute`), not source-text search: any future runtime response
 * status added/removed without a matching generated contract change fails here.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildApp } from '../../apps/server/api/src/app.js';

const spec = JSON.parse(
  readFileSync(join(process.cwd(), 'packages/generated/openapi.json'), 'utf-8')
);

const CASE_OPERATIONS: Record<string, string> = {
  'POST /api/v1/cases': '/api/v1/cases',
  'GET /api/v1/cases': '/api/v1/cases',
  'GET /api/v1/cases/:id': '/api/v1/cases/{id}',
  'POST /api/v1/cases/:id/messages': '/api/v1/cases/{id}/messages',
};

describe('Runtime route status == generated OpenAPI status (MEDIUM-01)', () => {
  it('Case operations stay mechanically aligned', async () => {
    const captured = new Map<string, string[]>();

    const app = await buildApp({
      onRoute: (route: any) => {
        const schema = route?.schema as { response?: Record<string, unknown> } | undefined;
        if (!schema?.response) return;
        const methods = Array.isArray(route.method)
          ? route.method
          : String(route.method).split(',');
        const statuses = Object.keys(schema.response).sort();
        for (const method of methods) {
          const normalized = String(method).trim().toUpperCase();
          if (normalized === 'HEAD') continue;
          captured.set(`${normalized} ${route.url}`, statuses);
        }
      },
    });

    await app.ready();
    try {
      const caseEntries = [...captured.entries()].filter(([key]) =>
        Object.hasOwn(CASE_OPERATIONS, key)
      );
      expect(caseEntries.map(([key]) => key).sort()).toEqual(
        Object.keys(CASE_OPERATIONS).sort()
      );

      for (const [routeKey, openapiPath] of Object.entries(CASE_OPERATIONS)) {
        const [method] = routeKey.split(' ');
        const operation = spec.paths[openapiPath]?.[method.toLowerCase()];
        expect(operation, `generated operation missing: ${routeKey}`).toBeDefined();
        expect(
          captured.get(routeKey),
          `response status drift: runtime ${routeKey} vs generated openapi.json`
        ).toEqual(Object.keys(operation.responses).sort());
      }
    } finally {
      await app.close();
    }
  });
});