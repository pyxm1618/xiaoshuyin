#!/usr/bin/env node
/**
 * openapi-generate.mjs — Generate OpenAPI spec and TypeScript types.
 * Uses @fastify/swagger from the built app, then openapi-typescript.
 * Output: packages/generated/openapi.json + packages/generated/openapi.d.ts
 */

import { writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT_DIR = join(ROOT, 'packages', 'generated');

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // Generate OpenAPI spec via inline script that builds app with swagger
  const specScript = `
import Fastify from 'fastify';
import pg from 'pg';
import swagger from '@fastify/swagger';
import { registerAuthPlugin } from '${join(ROOT, 'apps/server/api/src/plugins/auth.js')}';
import { registerAuthRoutes } from '${join(ROOT, 'apps/server/api/src/routes/auth.js')}';
import { registerMeRoutes } from '${join(ROOT, 'apps/server/api/src/routes/me.js')}';
import { registerFamilyRoutes } from '${join(ROOT, 'apps/server/api/src/routes/families.js')}';
import { registerMemberRoutes } from '${join(ROOT, 'apps/server/api/src/routes/members.js')}';
import { registerComplianceRoutes } from '${join(ROOT, 'apps/server/api/src/routes/compliance.js')}';
import { registerConsentRoutes } from '${join(ROOT, 'apps/server/api/src/routes/consents.js')}';
import { FakeWechatProvider } from '${join(ROOT, 'apps/server/api/src/auth/wechat-provider.js')}';
import { errorHandler } from '${join(ROOT, 'apps/server/api/src/plugins/error-handler.js')}';

const app = Fastify({ logger: false });
app.setErrorHandler(errorHandler);

// Register swagger BEFORE routes
await app.register(swagger, {
  openapi: {
    openapi: '3.1.0',
    info: { title: 'Xiaoshuyin API', version: '1.0.0' },
  },
});

// Minimal pool stub (not connected — we only need route registration)
const pool = { query: () => { throw new Error('not connected'); }, connect: () => { throw new Error('not connected'); } };
const sessionSecret = 'test_placeholder_secret_for_openapi_gen';
const wechatProvider = new FakeWechatProvider();

registerAuthPlugin(app, pool, sessionSecret);
app.get('/healthz', async () => ({ status: 'ok' }));
registerAuthRoutes(app, pool, wechatProvider, sessionSecret);
registerMeRoutes(app, pool);
registerFamilyRoutes(app, pool);
registerMemberRoutes(app, pool);
registerComplianceRoutes(app, pool);
registerConsentRoutes(app, pool);

await app.ready();
const spec = app.swagger();
console.log(JSON.stringify(spec, null, 2));
await app.close();
process.exit(0);
`;

  const tmpFile = join(ROOT, 'apps', 'server', 'api', '.openapi-gen-temp.mjs');
  writeFileSync(tmpFile, specScript);

  try {
    const output = execSync(`bun run ${tmpFile}`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 30000,
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'postgres://localhost:5432/xiaoshuyin_test' },
    });

    // Extract JSON from output
    const jsonStart = output.indexOf('{');
    const jsonEnd = output.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('Could not find JSON in swagger output');
    }
    const specJson = output.slice(jsonStart, jsonEnd + 1);

    // Validate it's proper JSON
    const spec = JSON.parse(specJson);
    const pathCount = Object.keys(spec.paths || {}).length;
    console.log(`  Detected ${pathCount} paths`);

    // Write OpenAPI spec
    const specPath = join(OUT_DIR, 'openapi.json');
    writeFileSync(specPath, JSON.stringify(spec, null, 2) + '\n');
    console.log(`Generated: ${specPath}`);

    // Generate TypeScript types
    execSync(`bunx openapi-typescript ${specPath} -o ${join(OUT_DIR, 'openapi.d.ts')}`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 30000,
    });
    console.log(`Generated: ${join(OUT_DIR, 'openapi.d.ts')}`);
    console.log('openapi-generate: OK');
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

main().catch((err) => {
  console.error('openapi-generate: FAIL —', err.message);
  process.exit(1);
});
