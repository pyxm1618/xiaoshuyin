/**
 * T078 / T079 — generated OpenAPI must describe the real Case business surface
 * with the frozen request/response and error shapes.
 *
 * Base (current main) = 4 Case business operations:
 *   createCase / listCases / getCase / createCaseMessage
 * Slice 7 delta = exactly 1: switchPrimaryCase
 * Final = 5 Case business operations.
 * `createParticipationInvite` stays a real Case path operation and is excluded
 * from the business-operation count by operationId (approved Slice 4 Scope).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const spec = JSON.parse(
  readFileSync(join(process.cwd(), 'packages/generated/openapi.json'), 'utf-8')
);

const CASE_PATH_PREFIX = '/api/v1/cases';
const CASE_HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const NON_BUSINESS_OPERATION_IDS = ['createParticipationInvite'] as const;

function resolveRef(node: any): any {
  if (!node || typeof node !== 'object') return node;
  if (typeof node.$ref === 'string' && node.$ref.startsWith('#/components/schemas/')) {
    return spec.components.schemas[node.$ref.split('/').pop()!];
  }
  return node;
}

function resolveParameter(node: any): any {
  if (
    node &&
    typeof node === 'object' &&
    typeof node.$ref === 'string' &&
    node.$ref.startsWith('#/components/parameters/')
  ) {
    return spec.components.parameters[node.$ref.split('/').pop()!];
  }
  return node;
}

function schemaOf(operation: any, status: string): any {
  return resolveRef(operation.responses[status]?.content?.['application/json']?.schema);
}

function literalCodes(schema: any): string[] {
  const resolved = resolveRef(schema);
  if (!resolved) return [];
  if (Array.isArray(resolved.enum)) return resolved.enum;
  const collected: string[] = [];
  for (const branch of resolved.anyOf ?? resolved.oneOf ?? []) {
    collected.push(...literalCodes(branch));
  }
  if (resolved.properties?.code) collected.push(...literalCodes(resolved.properties.code));
  return collected;
}

describe('Generated OpenAPI — Case operations (T078)', () => {
  it('contains the real Case paths and exactly five Case business operations (Base 4 + Slice 7 delta 1)', () => {
    const casePaths = Object.keys(spec.paths).filter(
      (p) => p === CASE_PATH_PREFIX || p.startsWith(`${CASE_PATH_PREFIX}/`)
    );
    expect(casePaths.sort()).toEqual([
      '/api/v1/cases',
      '/api/v1/cases/{id}',
      '/api/v1/cases/{id}/messages',
      '/api/v1/cases/{id}/participation-invites',
      '/api/v1/cases/{id}/switch-primary',
    ]);

    const operations: string[] = [];
    for (const [path, item] of Object.entries(spec.paths as Record<string, any>)) {
      if (!(path === CASE_PATH_PREFIX || path.startsWith(`${CASE_PATH_PREFIX}/`))) continue;
      for (const method of CASE_HTTP_METHODS) {
        const operation = item[method];
        if (
          operation &&
          !(NON_BUSINESS_OPERATION_IDS as readonly string[]).includes(operation.operationId)
        ) {
          operations.push(`${method.toUpperCase()} ${path}`);
        }
      }
    }
    expect(operations.sort()).toEqual([
      'GET /api/v1/cases',
      'GET /api/v1/cases/{id}',
      'POST /api/v1/cases',
      'POST /api/v1/cases/{id}/messages',
      'POST /api/v1/cases/{id}/switch-primary',
    ]);
    expect(operations).toHaveLength(5);
  });

  it('每个 operation 声明 frozen operationId 与 bearerAuth', () => {
    const expected: Record<string, { op: string }> = {
      'post /api/v1/cases': { op: 'createCase' },
      'get /api/v1/cases': { op: 'listCases' },
      'get /api/v1/cases/{id}': { op: 'getCase' },
      'post /api/v1/cases/{id}/messages': { op: 'createCaseMessage' },
      'post /api/v1/cases/{id}/switch-primary': { op: 'switchPrimaryCase' },
    };
    for (const [key, { op }] of Object.entries(expected)) {
      const [method, path] = key.split(' ');
      const operation = spec.paths[path][method];
      expect(operation.operationId, `${method} ${path} operationId`).toBe(op);
      expect(operation.security, `${method} ${path} security`).toEqual([{ bearerAuth: [] }]);
      expect(operation.tags).toEqual(['case']);
    }
    expect(spec.components.securitySchemes.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('detail path parameter documents format uuid', () => {
    const params = spec.paths['/api/v1/cases/{id}'].get.parameters.map(resolveParameter);
    expect(params.length).toBe(1);
    expect(params[0]).toMatchObject({
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    });
  });

  it('create declares the Idempotency-Key header parameter', () => {
    const params = spec.paths['/api/v1/cases'].post.parameters.map(resolveParameter);
    const header = params.find((p: any) => p.name === 'Idempotency-Key' && p.in === 'header');
    expect(header, 'missing Idempotency-Key header parameter').toBeDefined();
    expect(header.required).toBe(true);
    expect(header.schema).toMatchObject({ type: 'string', minLength: 8, maxLength: 128 });
  });

  it('does not expose /cases/current or non-Slice-7 transition endpoints', () => {
    for (const forbidden of ['current', 'pause', 'resume', 'close', 'recurrences']) {
      expect(JSON.stringify(spec.paths)).not.toContain(`/api/v1/cases/${forbidden}`);
    }
    // Slice 7 adds exactly one approved transition endpoint.
    expect(spec.paths['/api/v1/cases/{id}/switch-primary'].post.operationId).toBe(
      'switchPrimaryCase'
    );
  });

  it('CreateCaseRequest is a strict empty business object', () => {
    const schema = resolveRef(
      spec.paths['/api/v1/cases'].post.requestBody.content['application/json'].schema
    );
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties ?? {})).toEqual([]);
    expect(schema.required ?? []).toEqual([]);
  });

  it('CaseResponse exposes exactly the seven frozen fields', () => {
    const schema = schemaOf(spec.paths['/api/v1/cases'].post, '201');
    expect(Object.keys(schema.properties).sort()).toEqual([
      'createdAt', 'id', 'phase', 'primary', 'status', 'updatedAt', 'version',
    ]);
    expect(schema.properties.status.enum).toEqual([
      'OPEN', 'WAITING', 'LOST_CONTACT', 'SAFETY_HOLD', 'CLOSED',
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
    const item = resolveRef(schema.properties.items.items);
    expect(Object.keys(item.properties).sort()).toEqual([
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

  it('all pre-Slice-7 Case operations declare the real 409 status (MEDIUM-01)', () => {
    expect(Object.keys(spec.paths['/api/v1/cases'].post.responses).sort()).toEqual([
      '201', '401', '403', '404', '409', '422', '500',
    ]);
    expect(Object.keys(spec.paths['/api/v1/cases'].get.responses).sort()).toEqual([
      '200', '401', '403', '404', '409', '500',
    ]);
    expect(Object.keys(spec.paths['/api/v1/cases/{id}'].get.responses).sort()).toEqual([
      '200', '401', '404', '409', '500',
    ]);
  });

  it('message and switch-primary operations declare their real response sets', () => {
    expect(Object.keys(spec.paths['/api/v1/cases/{id}/messages'].post.responses).sort()).toEqual([
      '201', '401', '404', '409', '422', '500',
    ]);
    expect(
      Object.keys(spec.paths['/api/v1/cases/{id}/switch-primary'].post.responses).sort()
    ).toEqual(['200', '401', '404', '409', '422', '500']);
  });

  it('detail 409 carries the CURRENT_FAMILY_AMBIGUOUS literal (not merged into 404)', () => {
    const schema = schemaOf(spec.paths['/api/v1/cases/{id}'].get, '409');
    expect(literalCodes(schema)).toEqual(['CURRENT_FAMILY_AMBIGUOUS']);
    expect(literalCodes(schemaOf(spec.paths['/api/v1/cases/{id}'].get, '404')).sort()).toEqual([
      'CASE_NOT_FOUND', 'CURRENT_FAMILY_NOT_FOUND',
    ]);
  });
});