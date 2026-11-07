#!/usr/bin/env bun
/**
 * openapi-check.mjs — semantic equivalence against the frozen OpenAPI YAML.
 *
 * Frozen contract:
 *   specs/001-family-identity-core/contracts/identity-family-api.openapi.yaml
 *
 * This is NOT a byte comparison: generated JSON is normalized and compared on
 * paths / methods / operationId / parameters / request bodies / response
 * status sets / components.schemas structure.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const GENERATED = join(ROOT, 'packages', 'generated', 'openapi.json');
const FROZEN_DOCS = [
  {
    label: '001-family-identity-core',
    path: join(
      ROOT,
      'specs',
      '001-family-identity-core',
      'contracts',
      'identity-family-api.openapi.yaml'
    ),
  },
  {
    label: '002-case-core',
    path: join(
      ROOT,
      'specs',
      '002-case-core',
      'contracts',
      'cases-api.openapi.yaml'
    ),
  },
];

const DROP_KEYS = new Set([
  '$schema',
  'title',
  'description',
  'example',
  'examples',
  'format',
  'pattern',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'minItems',
  'maxItems',
  'default',
  'deprecated',
  'propertyNames',
]);

function resolveSchemaRef(refString, root) {
  const parts = refString.replace(/^#\//, '').split('/');
  let current = root;
  for (const part of parts) current = current?.[part];
  return current;
}

function normalize(node, root) {
  if (Array.isArray(node)) return node.map((item) => normalize(item, root));
  if (!node || typeof node !== 'object') return node;

  if (
    typeof node.$ref === 'string' &&
    node.$ref.startsWith('#/components/schemas/')
  ) {
    return normalize(resolveSchemaRef(node.$ref, root), root);
  }

  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (DROP_KEYS.has(key) || key.startsWith('x-')) continue;

    if (key === 'allOf' && Array.isArray(value) && value.length === 1) {
      return normalize(value[0], root);
    }

    if ((key === 'anyOf' || key === 'oneOf') && Array.isArray(value)) {
      const items = value.map((item) => normalize(item, root));
      const nonNull = items.filter((item) => item && item.type !== 'null');
      const hasNull = items.some((item) => item && item.type === 'null');
      if (hasNull && nonNull.length === 1) {
        const base = { ...nonNull[0] };
        const baseType = base.type;
        out.type = Array.isArray(baseType)
          ? [...new Set([...baseType, 'null'])]
          : [baseType, 'null'];
        for (const [baseKey, baseValue] of Object.entries(base)) {
          if (baseKey !== 'type') out[baseKey] = baseValue;
        }
        continue;
      }
      out[key] = items;
      continue;
    }

    const normalized = normalize(value, root);
    out[key] = key === 'required' && Array.isArray(normalized)
      ? [...normalized].sort()
      : normalized;
  }

  if (
    'additionalProperties' in out &&
    out.additionalProperties &&
    typeof out.additionalProperties === 'object' &&
    Object.keys(out.additionalProperties).length === 0
  ) {
    out.additionalProperties = true;
  }

  return out;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = stable(value[key]);
    return sorted;
  }
  return value;
}

function equal(a, b) {
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}

function fail(message) {
  console.error(`openapi-check: FAIL — ${message}`);
  process.exit(1);
}

function collectOperations(spec) {
  const ops = new Map();
  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    for (const method of Object.keys(methods ?? {})) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      ops.set(`${method.toUpperCase()} ${path}`, methods[method]);
    }
  }
  return ops;
}

function compareSubset(frozen, generated, label) {
  const frozenOps = collectOperations(frozen);
  const generatedOps = collectOperations(generated);

  for (const [key, f] of frozenOps) {
    const g = generatedOps.get(key);
    if (!g) fail(`[${label}] missing operation ${key}`);

    if (f.operationId !== g.operationId) {
      fail(`[${label}] ${key}: operationId differs (${f.operationId} vs ${g.operationId})`);
    }

    if (!equal(normalize(f.parameters ?? [], frozen), normalize(g.parameters ?? [], generated))) {
      fail(`[${label}] ${key}: parameters differ`);
    }

    const frozenBody = f.requestBody;
    const generatedBody = g.requestBody;
    if (Boolean(frozenBody) !== Boolean(generatedBody)) {
      fail(`[${label}] ${key}: requestBody presence differs`);
    }
    if (frozenBody && generatedBody) {
      if (Boolean(frozenBody.required) !== Boolean(generatedBody.required)) {
        fail(`[${label}] ${key}: requestBody.required differs`);
      }
      const fs = frozenBody.content?.['application/json']?.schema;
      const gs = generatedBody.content?.['application/json']?.schema;
      if (!equal(normalize(fs ?? null, frozen), normalize(gs ?? null, generated))) {
        fail(`[${label}] ${key}: requestBody schema differs`);
      }
    }

    const frozenStatuses = Object.keys(f.responses ?? {}).sort();
    const generatedStatuses = Object.keys(g.responses ?? {}).sort();
    if (!equal(frozenStatuses, generatedStatuses)) {
      fail(`[${label}] ${key}: response status set differs (${frozenStatuses} vs ${generatedStatuses})`);
    }
  }

  const frozenSchemas = frozen.components?.schemas ?? {};
  const generatedSchemas = generated.components?.schemas ?? {};

  for (const name of Object.keys(frozenSchemas)) {
    if (!(name in generatedSchemas)) fail(`[${label}] missing components.schemas.${name}`);
    if (!equal(normalize(frozenSchemas[name], frozen), normalize(generatedSchemas[name], generated))) {
      console.error('  frozen:', JSON.stringify(stable(normalize(frozenSchemas[name], frozen)), null, 2));
      console.error('  generated:', JSON.stringify(stable(normalize(generatedSchemas[name], generated)), null, 2));
      fail(`[${label}] components.schemas.${name} differs`);
    }
  }

  return {
    operations: [...frozenOps.keys()],
    schemas: Object.keys(frozenSchemas),
  };
}

function main() {
  if (!existsSync(GENERATED)) fail('generated artifact missing. Run `bun run openapi:generate` first.');
  for (const doc of FROZEN_DOCS) {
    if (!existsSync(doc.path)) fail(`frozen contract missing: ${doc.path}`);
  }

  // Regenerate to prove the committed artifact is current.
  try {
    execSync('bun run openapi:generate', { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe' });
  } catch (err) {
    fail(`regeneration failed: ${err.message}`);
  }

  const generated = JSON.parse(readFileSync(GENERATED, 'utf-8'));

  const unionOps = new Set();
  const unionSchemas = new Set();
  for (const doc of FROZEN_DOCS) {
    const frozen = Bun.YAML.parse(readFileSync(doc.path, 'utf-8'));
    const result = compareSubset(frozen, generated, doc.label);
    for (const op of result.operations) unionOps.add(op);
    for (const name of result.schemas) unionSchemas.add(name);
  }

  const generatedOps = [...collectOperations(generated).keys()].sort();
  const generatedSchemas = Object.keys(generated.components?.schemas ?? {}).sort();
  if (!equal([...unionOps].sort(), generatedOps)) {
    fail(`generated operation set is not the union of the frozen contracts\n  expected: ${[...unionOps].sort().join(', ')}\n  actual:   ${generatedOps.join(', ')}`);
  }
  if (!equal([...unionSchemas].sort(), generatedSchemas)) {
    fail(`generated schema set is not the union of the frozen contracts\n  expected: ${[...unionSchemas].sort().join(', ')}\n  actual:   ${generatedSchemas.join(', ')}`);
  }

  console.log('openapi-check: PASS (semantic equivalence with frozen contracts)');
}

main();