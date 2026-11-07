/**
 * T028 / T053 — generated OpenAPI must describe exactly one Slice 3 operation.
 *
 * RED before the operation exists in the generated artifact.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const spec = JSON.parse(
  readFileSync(join(process.cwd(), 'packages/generated/openapi.json'), 'utf-8')
);

const PATH = '/api/v1/cases/{id}/messages';

function resolveRef(node: any): any {
  if (!node || typeof node !== 'object') return node;
  if (typeof node.$ref === 'string' && node.$ref.startsWith('#/components/schemas/')) {
    return spec.components.schemas[node.$ref.split('/').pop()!];
  }
  return node;
}

function resolveParameter(node: any): any {
  if (node && typeof node === 'object' && typeof node.$ref === 'string' &&
      node.$ref.startsWith('#/components/parameters/')) {
    return spec.components.parameters[node.$ref.split('/').pop()!];
  }
  return node;
}

function schemaOf(operation: any, status: string): any {
  return resolveRef(operation.responses?.[status]?.content?.['application/json']?.schema);
}

function literalCodes(schema: any): string[] {
  if (!schema) return [];
  if (Array.isArray(schema.enum)) return schema.enum;
  const collected: string[] = [];
  for (const branch of schema.anyOf ?? schema.oneOf ?? []) {
    collected.push(...literalCodes(resolveRef(branch)));
  }
  if (schema.properties?.code) collected.push(...literalCodes(schema.properties.code));
  return collected;
}

describe('Generated OpenAPI — Message operation (T028)', () => {
  it('contains exactly the approved message path and operationId', () => {
    expect(spec.paths[PATH]).toBeDefined();
    const methods = Object.keys(spec.paths[PATH]);
    expect(methods).toEqual(['post']);
    expect(spec.paths[PATH].post.operationId).toBe('createCaseMessage');
    expect(spec.paths[PATH].post.security).toEqual([{ bearerAuth: [] }]);
  });

  it('declares the uuid path parameter and required 8..128 Idempotency-Key header', () => {
    const params = spec.paths[PATH].post.parameters.map(resolveParameter);
    const id = params.find((p: any) => p.name === 'id' && p.in === 'path');
    expect(id).toMatchObject({ required: true, schema: { type: 'string', format: 'uuid' } });
    const header = params.find((p: any) => p.name === 'Idempotency-Key' && p.in === 'header');
    expect(header.required).toBe(true);
    expect(header.schema).toMatchObject({ type: 'string', minLength: 8, maxLength: 128 });
  });

  it('request body accepts only content and rejects additional properties', () => {
    const schema = resolveRef(
      spec.paths[PATH].post.requestBody.content['application/json'].schema
    );
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties ?? {})).toEqual(['content']);
    expect(schema.required).toEqual(['content']);
  });

  it('response 201 exposes only id/caseId/recordedAt (never content)', () => {
    const schema = schemaOf(spec.paths[PATH].post, '201');
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual([
      'caseId',
      'id',
      'recordedAt',
    ]);
    expect(JSON.stringify(schema)).not.toContain('content');
  });

  it('mechanically fixes the five error codes and the 404 oneOf', () => {
    const op = spec.paths[PATH].post;
    expect(literalCodes(schemaOf(op, '401'))).toEqual(['UNAUTHENTICATED']);
    expect(literalCodes(schemaOf(op, '409'))).toEqual(['IDEMPOTENCY_PAYLOAD_MISMATCH']);
    expect(literalCodes(schemaOf(op, '422'))).toEqual(['VALIDATION_ERROR']);
    expect(literalCodes(schemaOf(op, '500'))).toEqual(['INTERNAL_ERROR']);
    expect(literalCodes(schemaOf(op, '404')).sort()).toEqual([
      'CASE_NOT_FOUND',
      'CURRENT_FAMILY_NOT_FOUND',
    ]);
    expect(Object.keys(op.responses).sort()).toEqual([
      '201', '401', '404', '409', '422', '500',
    ]);
  });

  it('exposes no generic Evidence / FACT route', () => {
    for (const forbidden of [
      '/api/v1/assertions',
      '/api/v1/observations',
      '/api/v1/evidence',
      '/api/v1/cases/{id}/assertions',
      '/api/v1/cases/{id}/observations',
      '/api/v1/cases/{id}/evidence',
      '/api/v1/cases/{id}/facts',
    ]) {
      expect(spec.paths[forbidden], forbidden).toBeUndefined();
    }
    for (const [path, item] of Object.entries<any>(spec.paths)) {
      for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        if (!item[method]) continue;
        expect(JSON.stringify(item[method]).toLowerCase(), `${method} ${path}`).not.toContain(
          'fact'
        );
      }
    }
  });
});