#!/usr/bin/env bun
/**
 * openapi-generate.mjs — Generate the OpenAPI artifact + TypeScript types.
 *
 * The document is built from the same Zod contracts the routes use
 * (`apps/server/api/src/openapi-spec.ts`). The frozen YAML remains the
 * Source of Truth; `openapi-check` proves semantic equivalence.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT_DIR = join(ROOT, 'packages', 'generated');
const SPEC_PATH = join(OUT_DIR, 'openapi.json');
const TYPES_PATH = join(OUT_DIR, 'openapi.d.ts');

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const { buildOpenApiDocument } = await import(
    join(ROOT, 'apps/server/api/src/openapi-spec.ts')
  );
  const spec = buildOpenApiDocument();

  const pathCount = Object.keys(spec.paths ?? {}).length;
  console.log(`  Detected ${pathCount} paths`);

  writeFileSync(SPEC_PATH, JSON.stringify(spec, null, 2) + '\n');
  console.log(`Generated: ${SPEC_PATH}`);

  execSync(`bunx openapi-typescript ${SPEC_PATH} -o ${TYPES_PATH}`, {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 60000,
  });
  console.log(`Generated: ${TYPES_PATH}`);
  console.log('openapi-generate: OK');
}

main().catch((err) => {
  console.error('openapi-generate: FAIL —', err.message);
  process.exit(1);
});