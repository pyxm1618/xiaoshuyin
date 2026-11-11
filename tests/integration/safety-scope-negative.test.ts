/**
 * T918 — executable scope negatives and production-surface inventory.
 *
 * Combines git changed-path scanning, schema enumeration, route/OpenAPI
 * enumeration and import/export scanning so the negatives are mechanical, not
 * prose claims.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import * as domain from '../../packages/domain/src/index.js';
import { createAdminPool } from '../setup/db.js';

const ROOT = new URL('../..', import.meta.url).pathname;

const FORBIDDEN_PATH_PATTERNS = [
  /support[_-]?resources?/i,
  /referrals?/i,
  /staff[_-]?(queue|assignment|account)/i,
  /operations[_-]?dashboard/i,
  /guardrails?/i,
  /risk[_-]?review/i,
  /digital[_-]?use/i,
  /node[_-]?manifest/i,
  /goals?\.(ts|sql)$/i,
  /interventions?\.(ts|sql)$/i,
  /plans?\.(ts|sql)$/i,
  /tasks?\.(ts|sql)$/i,
  /reviews?\.(ts|sql)$/i,
  /follow[_-]?up/i,
  /problem[_-]?formulations?\.(ts|sql)$/i,
  /safety[_-]?states?/i,
];

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

describe('T918 executable scope negatives', () => {
  it('touches no forbidden path in any changed or added file', () => {
    const changed = [
      ...git(['diff', '--name-only', 'origin/main...HEAD']).split('\n'),
      ...git(['diff', '--name-only']).split('\n'),
      ...git(['ls-files', '--others', '--exclude-standard']).split('\n'),
    ]
      .map((line) => line.trim())
      .filter(Boolean);

    expect(changed.length).toBeGreaterThan(0);
    for (const path of changed) {
      for (const pattern of FORBIDDEN_PATH_PATTERNS) {
        expect(pattern.test(path), `forbidden path changed: ${path}`).toBe(false);
      }
    }
  });

  it('adds no forbidden database object', async () => {
    const admin = createAdminPool();
    try {
      const { rows: tables } = await admin.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
      );
      const names = tables.map((row) => row.tablename);
      for (const forbidden of [
        'safety_states',
        'support_resources',
        'referrals',
        'staff_queue',
        'risk_reviews',
        'goals',
        'intervention_instances',
        'plan_versions',
        'tasks',
        'reviews',
        'problem_formulations',
        'scene_node_states',
      ]) {
        expect(names, forbidden).not.toContain(forbidden);
      }
      expect(names).toContain('risk_events');
    } finally {
      await admin.end();
    }
  });

  it('has no Safety current-state column on risk_events (cases.status stays the only truth)', async () => {
    const admin = createAdminPool();
    try {
      const { rows } = await admin.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'risk_events'`
      );
      const columns = rows.map((row) => row.column_name);
      for (const forbidden of ['current_status', 'current_state', 'is_held', 'active']) {
        expect(columns).not.toContain(forbidden);
      }
    } finally {
      await admin.end();
    }
  });

  it('registers no public Safety mutation route or OpenAPI path', async () => {
    const openapi = JSON.parse(
      readFileSync(join(ROOT, 'packages/generated/openapi.json'), 'utf-8')
    ) as { paths?: Record<string, unknown> };
    for (const path of Object.keys(openapi.paths ?? {})) {
      expect(path).not.toMatch(/safety|resolve-risk|enter-hold/i);
    }

    const routeDir = join(ROOT, 'apps/server/api/src/routes');
    const routeFiles = (await import('node:fs')).readdirSync(routeDir)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => join(routeDir, name));
    const routeSources = [join(ROOT, 'apps/server/api/src/app.ts'), ...routeFiles];
    for (const file of routeSources) {
      const content = readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/\b(app)\.(post|put|patch)\(\s*['"`][^'"`]*(safety|resolve-risk|enter-hold)/i);
    }
  });

  it('keeps the controlled resolver out of the production export graph', () => {
    // Domain production surface must not expose any test-only capability.
    for (const name of Object.keys(domain)) {
      expect(name).not.toMatch(/test.*(resolver|authority)|verified.*authority/i);
    }
    expect(domain).not.toHaveProperty('createVerifiedTestSafetyResolutionAuthoritySource');
    expect(domain).not.toHaveProperty('TEST_SAFETY_AUTHORITY_REF');

    // Production app composition never imports the test tree.
    for (const file of ['apps/server/api/src/app.ts', 'apps/server/api/src/server.ts']) {
      const content = readFileSync(join(ROOT, file), 'utf-8');
      expect(content).not.toContain('tests/setup');
      expect(content).not.toContain('safety-resolver');
    }

    // The test-only resolver file exists only under tests/.
    expect(existsSync(join(ROOT, 'tests/setup/safety-resolver.ts'))).toBe(true);
    expect(existsSync(join(ROOT, 'packages/domain/src/safety/resolver-test.ts'))).toBe(false);
  });

  it('imports no AI/RAG/Guardrails/referral dependency in production code', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (['node_modules', 'dist', '.git'].includes(entry)) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|mjs|js)$/.test(full)) files.push(full);
      }
    };
    walk(join(ROOT, 'apps'));
    walk(join(ROOT, 'packages'));

    const forbidden = ['guardrails', 'dashscope', 'openai', 'anthropic', 'ollama', 'risk_review', 'support_resources', 'referral'];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      for (const token of forbidden) {
        expect(content.toLowerCase(), `${file} must not reference ${token}`).not.toContain(token);
      }
    }
  });

  it('keeps exactly one formal entry and one formal exit in production code', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const entryFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (['node_modules', 'dist', '.git'].includes(entry)) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.ts$/.test(full)) entryFiles.push(full);
      }
    };
    walk(join(ROOT, 'apps'));
    walk(join(ROOT, 'packages'));

    const callers: string[] = [];
    for (const file of entryFiles) {
      const content = readFileSync(file, 'utf-8');
      if (/transitionCaseStatus\s*\(/.test(content)) {
        callers.push(file.replace(ROOT, '').replace(/^\//, ''));
      }
    }
    // Definition file + the two Safety commands only.
    expect(callers.sort()).toEqual([
      'apps/server/api/src/safety/enter-safety-hold.ts',
      'apps/server/api/src/safety/resolve-risk.ts',
      'packages/domain/src/safety/case-transition.ts',
    ]);
  });
});