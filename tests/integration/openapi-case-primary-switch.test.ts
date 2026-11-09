/**
 * T731 — OpenAPI contract for switchPrimaryCase (FR-002, plan D-12.4).
 *
 * The new operation must mirror the frozen contract: one operationId, the
 * `case` tag, bearer security, the shared `Idempotency-Key` header parameter,
 * a strict three-field body and the frozen 200/409 literals. Existing Case
 * operations keep their assertions.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const spec = JSON.parse(
  readFileSync(new URL('../../packages/generated/openapi.json', import.meta.url), 'utf8')
);

function deref(node: any): any {
  if (!node || typeof node !== 'object' || !node.$ref) return node;
  const parts = String(node.$ref).replace(/^#\//, '').split('/');
  let cur: any = spec;
  for (const part of parts) cur = cur?.[part];
  return cur;
}

describe('OpenAPI switchPrimaryCase (T731)', () => {
  it('adds exactly one new Case path and one new operation', () => {
    const casePaths = Object.keys(spec.paths).filter((p) =>
      p === '/api/v1/cases' ||
      p === '/api/v1/cases/{id}' ||
      p === '/api/v1/cases/{id}/switch-primary'
    );
    expect(casePaths.sort()).toEqual([
      '/api/v1/cases',
      '/api/v1/cases/{id}',
      '/api/v1/cases/{id}/switch-primary',
    ]);
    const operationIds = casePaths.flatMap((p) =>
      Object.values(spec.paths[p]).map((op: any) => op.operationId)
    );
    expect(operationIds.sort()).toEqual([
      'createCase',
      'getCase',
      'listCases',
      'switchPrimaryCase',
    ]);
  });

  it('keeps the existing three Case operations unchanged', () => {
    expect(spec.paths['/api/v1/cases'].post.operationId).toBe('createCase');
    expect(spec.paths['/api/v1/cases'].get.operationId).toBe('listCases');
    expect(spec.paths['/api/v1/cases/{id}'].get.operationId).toBe('getCase');
    for (const op of [
      spec.paths['/api/v1/cases'].post,
      spec.paths['/api/v1/cases'].get,
      spec.paths['/api/v1/cases/{id}'].get,
    ]) {
      expect(op.tags).toEqual(['case']);
      expect(op.security).toEqual([{ bearerAuth: [] }]);
    }
  });

  it('declares the Idempotency-Key header and the uuid path parameter', () => {
    const op = spec.paths['/api/v1/cases/{id}/switch-primary'].post;
    const params = (op.parameters ?? []).map(deref);
    const headers = params.filter((p: any) => p.in === 'header');
    expect(headers.map((p: any) => p.name)).toContain('Idempotency-Key');
    const pathParam = params.find((p: any) => p.in === 'path' && p.name === 'id');
    expect(pathParam?.schema?.format).toBe('uuid');
  });

  it('uses the strict three-field request body', () => {
    const op = spec.paths['/api/v1/cases/{id}/switch-primary'].post;
    const body = deref(op.requestBody.content['application/json'].schema);
    expect(body.required?.sort()).toEqual([
      'expectedPrimaryCaseId',
      'expectedPrimaryVersion',
      'reason',
    ]);
    expect(body.additionalProperties).toBe(false);
  });

  it('declares the frozen 200 response shape and response status set', () => {
    const op = spec.paths['/api/v1/cases/{id}/switch-primary'].post;
    const ok = deref(op.responses['200'].content['application/json'].schema);
    expect(Object.keys(ok.properties).sort()).toEqual([
      'previousPrimary',
      'primary',
      'switchedAt',
    ]);
    expect(Object.keys(op.responses).sort()).toEqual(
      ['200', '401', '404', '409', '422', '500'].sort()
    );
  });
});