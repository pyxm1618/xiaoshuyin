#!/usr/bin/env node
/**
 * openapi-check.mjs — Verify OpenAPI artifacts are current (no drift).
 * Regenerates to a temp location and compares with committed artifacts.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT_DIR = join(ROOT, 'packages', 'generated');
const SPEC_PATH = join(OUT_DIR, 'openapi.json');
const TYPES_PATH = join(OUT_DIR, 'openapi.d.ts');

function main() {
  if (!existsSync(SPEC_PATH) || !existsSync(TYPES_PATH)) {
    console.error('openapi-check: FAIL — artifacts missing. Run `bun run openapi:generate` first.');
    process.exit(1);
  }

  // Save current artifacts
  const specBackup = readFileSync(SPEC_PATH, 'utf-8');
  const typesBackup = readFileSync(TYPES_PATH, 'utf-8');

  try {
    // Regenerate
    execSync('bun run openapi:generate', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 60000,
      stdio: 'pipe',
    });

    // Compare
    const newSpec = readFileSync(SPEC_PATH, 'utf-8');
    const newTypes = readFileSync(TYPES_PATH, 'utf-8');

    if (newSpec !== specBackup) {
      console.error('openapi-check: FAIL — openapi.json has drifted from repository');
      // Restore original
      writeFileSync(SPEC_PATH, specBackup);
      writeFileSync(TYPES_PATH, typesBackup);
      process.exit(1);
    }

    if (newTypes !== typesBackup) {
      console.error('openapi-check: FAIL — openapi.d.ts has drifted from repository');
      writeFileSync(SPEC_PATH, specBackup);
      writeFileSync(TYPES_PATH, typesBackup);
      process.exit(1);
    }

    console.log('openapi-check: PASS (no drift)');
  } catch (err) {
    console.error('openapi-check: FAIL —', err.message);
    // Restore original artifacts
    writeFileSync(SPEC_PATH, specBackup);
    writeFileSync(TYPES_PATH, typesBackup);
    process.exit(1);
  }
}

main();
