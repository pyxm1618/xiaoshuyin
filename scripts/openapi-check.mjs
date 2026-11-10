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
import { normalize } from './lib/openapi-normalize.mjs';

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
  {
    label: '003-evidence-core',
    path: join(
      ROOT,
      'specs',
      '003-evidence-core',
      'contracts',
      'messages-api.openapi.yaml'
    ),
  },
  {
    label: '004-case-participant-core',
    path: join(
      ROOT,
      'specs',
      '004-case-participant-core',
      'contracts',
      'participation-api.openapi.yaml'
    ),
  },
  {

    label: '006-identity-binding-runtime',
    path: join(
      ROOT,
      'specs',
      '006-identity-binding-runtime',
      'contracts',
      'identity-binding-api.openapi.yaml'
    ),
  },
];

// Normalization lives in `scripts/lib/openapi-normalize.mjs` so the semantic
// regression test can prove the false-equivalence fix without running main().

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

function referencesAnySchemaName(value, names) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    return value.some((item) => referencesAnySchemaName(item, names));
  }
  if (typeof value.$ref === 'string') {
    const prefix = '#/components/schemas/';
    if (value.$ref.startsWith(prefix) && names.has(value.$ref.slice(prefix.length))) {
      return true;
    }
  }
  return Object.values(value).some((item) => referencesAnySchemaName(item, names));
}

function resolveLocalRef(value, root) {
  if (!value || typeof value !== 'object' || typeof value.$ref !== 'string') {
    return value;
  }
  if (!value.$ref.startsWith('#/')) return value;

  let current = root;
  for (const part of value.$ref.slice(2).split('/')) {
    current = current?.[part.replace(/~1/g, '/').replace(/~0/g, '~')];
  }
  return current ?? value;
}

function collectCollidingSchemaNames(frozenDocs) {
  const firstShapeByName = new Map();
  const collisions = new Set();

  for (const { spec } of frozenDocs) {
    for (const [name, schema] of Object.entries(spec.components?.schemas ?? {})) {
      const shape = JSON.stringify(stable(normalize(schema, spec)));
      const firstShape = firstShapeByName.get(name);
      if (firstShape === undefined) {
        firstShapeByName.set(name, shape);
      } else if (firstShape !== shape) {
        collisions.add(name);
      }
    }
  }

  return collisions;
}

function compareSubset(frozen, generated, label, collidingSchemaNames) {
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

    // Slice 4 requires full response-body equivalence. For older slices, keep
    // the historical checker scope except when a response references a
    // same-name component whose shape collides across frozen contracts. Those
    // colliding schemas cannot be validated globally, so their real use sites
    // MUST be compared here to avoid creating a governance blind spot.
    for (const status of frozenStatuses) {
      const frozenResponse = resolveLocalRef(f.responses?.[status], frozen);
      const generatedResponse = resolveLocalRef(g.responses?.[status], generated);
      const frozenSchema = frozenResponse?.content?.['application/json']?.schema;
      const generatedSchema = generatedResponse?.content?.['application/json']?.schema;
      const mustCompareBody =
        label === '004-case-participant-core' ||
        referencesAnySchemaName(frozenSchema, collidingSchemaNames);

      if (!mustCompareBody) continue;

      if (Boolean(frozenSchema) !== Boolean(generatedSchema)) {
        fail(`[${label}] ${key}: response ${status} schema presence differs`);
      }
      if (
        frozenSchema &&
        generatedSchema &&
        !equal(
          normalize(frozenSchema, frozen),
          normalize(generatedSchema, generated)
        )
      ) {
        fail(`[${label}] ${key}: response ${status} schema differs`);
      }
    }
  }

  const frozenSchemas = frozen.components?.schemas ?? {};
  const generatedSchemas = generated.components?.schemas ?? {};

  for (const name of Object.keys(frozenSchemas)) {
    if (!(name in generatedSchemas)) fail(`[${label}] missing components.schemas.${name}`);

    // Slice 3 and Slice 4 both froze a component named ValidationError
    // with different shapes. The generated global component intentionally
    // remains the Slice 3 shape; Slice 4's stricter 422 projection is validated
    // at its actual response use sites above.
    if (label === '004-case-participant-core' && name === 'ValidationError') {
      continue;
    }

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
  const frozenDocs = FROZEN_DOCS.map((doc) => ({
    ...doc,
    spec: Bun.YAML.parse(readFileSync(doc.path, 'utf-8')),
  }));

  const collidingSchemaNames = collectCollidingSchemaNames(frozenDocs);
  const unionOps = new Set();
  const unionSchemas = new Set();
  for (const doc of frozenDocs) {
    const result = compareSubset(doc.spec, generated, doc.label, collidingSchemaNames);
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