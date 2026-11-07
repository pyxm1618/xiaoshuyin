#!/usr/bin/env node
/**
 * typecheck-all.mjs — deterministic typecheck for the Slice 001 workspaces.
 *
 * 1. Root TS project check (tsconfig.base.json)
 * 2. Every workspace under apps/server/* and packages/* that defines a
 *    `typecheck` script, run exactly once
 *
 * The root `typecheck` script must NOT re-invoke itself: `bun run --recursive
 * typecheck` includes the root package and therefore recurses forever. This
 * script walks the Slice's own workspace directories instead, so the result is
 * deterministic and exits non-zero on the first failure.
 */

import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;

function run(cmd, args, cwd, label) {
  console.log(`\n[typecheck] ${label}`);
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  return r.status ?? 1;
}

const failures = [];

// 1. Root TS project (packages/* source compiled via tsconfig.base.json)
{
  const code = run('bunx', ['tsc', '-p', 'tsconfig.base.json', '--noEmit'], ROOT, 'root tsconfig.base.json');
  if (code !== 0) failures.push('root tsconfig.base.json');
}

// 2. Slice workspaces (apps/server/* + packages/*) — each run once, never root.
const GROUPS = ['apps/server', 'packages'];
for (const group of GROUPS) {
  const base = join(ROOT, group);
  if (!existsSync(base)) continue;
  const entries = readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  for (const name of entries) {
    const dir = join(base, name);
    const pkgPath = join(dir, 'package.json');
    if (!existsSync(pkgPath)) continue;
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    } catch {
      continue;
    }
    if (!pkg.scripts || typeof pkg.scripts.typecheck !== 'string') continue;
    const label = `${group}/${name}`;
    const code = run('bun', ['run', 'typecheck'], dir, label);
    if (code !== 0) failures.push(label);
  }
}

if (failures.length > 0) {
  console.error(`\ntypecheck: FAIL (${failures.join(', ')})`);
  process.exit(1);
}
console.log('\ntypecheck: PASS');
