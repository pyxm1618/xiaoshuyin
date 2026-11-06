/**
 * T078 / T079 — generated OpenAPI must describe exactly the three Case
 * operations with the frozen request/response and error shapes.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const spec = JSON.parse(
  readFileSync(join(process.cwd(), 'packages/generated/openapi.json'), 'utf-8')
);

function schemaOf(operation: any, status: string): any {
  return operation.responses[status]?.content?.['application/json']?.schema;
}

function literalCodes(schema: any): string[] {
  if (!schema) return [];
  if (Array.isArray(schema.enum)) return schema.enum;
  const collected: string[] = [];
  for (const branch of schema.anyOf ?? schema.oneOf ?? []) {
    collected.push(...literalCodes(branch));
  }
  if (schema.properties?.code) collected.push(...literalCodes(schema.properties.code));
  return collected;
}

describe('Generated OpenAPI — Case operations (T078)', () => {
  it('contains exactly the three Case operations', () => {
    const casePaths = Object.keys(spec.paths).filter((p) => p.startsWith('/api/v1/cases'));
    expect(casePaths.sort()).toEqual(['/api/v1/cases', '/api/v1/cases/{id}']);

    const operations: string[] = [];
    for (const [path, item] of Object.entries(spec.paths as Record<string, any>)) {
      if (!path.startsWith('/api/v1/cases')) continue;
      for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        if (item[method]) operations.push(`${method.toUpperCase()} ${path}`);
      }
    }
    expect(operations.sort()).toEqual([
      'GET /api/v1/cases',
      'GET /api/v1/cases/{id}',
      'POST /api/v1/cases',
    ]);
  });

  it('does not expose /cases/current or transition endpoints', () => {
    for (const forbidden of ['current', 'pause', 'resume', 'switch-primary', 'close', 'recurrences']) {
      expect(JSON.stringify(spec.paths)).not.toContain(`/api/v1/cases/${forbidden}`);
    }
  });

  it('CreateCaseRequest is strict and only accepts idempotencyKey', () => {
    const schema = spec.paths['/api/v1/cases'].post.requestBody.content['application/json'].schema;
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties)).toEqual(['idempotencyKey']);
    expect(schema.required).toEqual(['idempotencyKey']);
    expect(schema.properties.idempotencyKey.minLength).toBe(8);
    expect(schema.properties.idempotencyKey.maxLength).toBe(128);
  });

  it('CaseResponse exposes exactly the seven frozen fields', () => {
    const schema = schemaOf(spec.paths['/api/v1/cases'].post, '201');
    expect(Object.keys(schema.properties).sort()).toEqual([
      'createdAt', 'id', 'phase', 'primary', 'status', 'updatedAt', 'version',
    ]);
    expect(schema.properties.status.enum).toEqual([
      'OPEN', 'WAITING', 'PAUSED', 'LOST_CONTACT', 'SAFETY_HOLD', 'CLOSED',
    ]);
    expect(schema.properties.phase.enum).toEqual([
      'INTAKE', 'ASSESSMENT', 'PROBLEM_FORMULATION', 'GOALS',
      'PLANNING', 'EXECUTION', 'REVIEW', 'MAINTENANCE', 'CLOSED',
    ]);
  });

  it('list response is { items: CaseResponse[] }', () => {
    const schema = schemaOf(spec.paths['/api/v1/cases'].get, '200');
    expect(Object.keys(schema.properties)).toEqual(['items']);
    expect(schema.properties.items.type).toBe('array');
    expect(Object.keys(schema.properties.items.items.properties).sort()).toEqual([
      'createdAt', 'id', 'phase', 'primary', 'status', 'updatedAt', 'version',
    ]);
  });

  it('create/list 403 carries the CASE_ACCESS_DENIED literal', () => {
    for (const operation of [spec.paths['/api/v1/cases'].post, spec.paths['/api/v1/cases'].get]) {
      expect(literalCodes(schemaOf(operation, '403'))).toEqual(['CASE_ACCESS_DENIED']);
    }
  });

  it('detail 404 carries CASE_NOT_FOUND and CURRENT_FAMILY_NOT_FOUND', () => {
    const codes = literalCodes(schemaOf(spec.paths['/api/v1/cases/{id}'].get, '404'));
    expect(codes.sort()).toEqual(['CASE_NOT_FOUND', 'CURRENT_FAMILY_NOT_FOUND']);
  });

  it('POST 422 is the frozen VALIDATION_ERROR shape', () => {
    const schema = schemaOf(spec.paths['/api/v1/cases'].post, '422');
    // Frozen Error shape: code + message required, details optional.
    expect(schema.required.sort()).toEqual(['code', 'message']);
    expect(Object.keys(schema.properties).sort()).toEqual(['code', 'details', 'message']);
    expect(schema.properties.code.type).toBe('string');
  });
});
