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

// Slice 9 is audited over its immutable historical change range. A mutable
// "current main versus HEAD" comparison cannot express it: once the feature
// branch is merged, the branch head and main are identical, so it is empty by
// construction.
const SLICE9_PRE_MERGE_BASE_SHA = '8e393c990be53c888c2e68d881bd8b23f9c37638';
const SLICE9_AUDITED_FEATURE_HEAD_SHA = '7b4f5796ef1c6ac1126f9b7bb687293df8a8ceef';
const SLICE9_HISTORICAL_RANGE = `${SLICE9_PRE_MERGE_BASE_SHA}..${SLICE9_AUDITED_FEATURE_HEAD_SHA}`;
const SLICE9_MIGRATION_PATH = 'db/migrations/009_safety_hold_control_foundation.sql';

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
  /safety[_-]?states?/i,
];

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

function isAncestor(ancestor: string, descendant: string): boolean {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd: ROOT });
    return true;
  } catch {
    return false;
  }
}

function assertImmutableSlice9Range(): void {
  for (const rev of [SLICE9_PRE_MERGE_BASE_SHA, SLICE9_AUDITED_FEATURE_HEAD_SHA]) {
    try {
      git(['rev-parse', '--verify', `${rev}^{commit}`]);
    } catch {
      throw new Error(
        `S9PM_RANGE_UNAVAILABLE: ${rev} is not resolvable in this clone. ` +
          'The immutable Slice 9 audit range requires full history (CI checkout: fetch-depth: 0).'
      );
    }
  }

  expect(
    isAncestor(SLICE9_PRE_MERGE_BASE_SHA, SLICE9_AUDITED_FEATURE_HEAD_SHA),
    `S9PM_RANGE_NOT_ANCESTOR: ${SLICE9_PRE_MERGE_BASE_SHA} is not an ancestor of ${SLICE9_AUDITED_FEATURE_HEAD_SHA}`
  ).toBe(true);
  expect(
    isAncestor(SLICE9_AUDITED_FEATURE_HEAD_SHA, 'HEAD'),
    `S9PM_RANGE_NOT_ANCESTOR: ${SLICE9_AUDITED_FEATURE_HEAD_SHA} is not an ancestor of HEAD`
  ).toBe(true);
}

describe('T918 executable scope negatives', () => {
  it('touches no forbidden path in the audited Slice 9 range 8e393c99..7b4f5796 or the working tree', () => {
    assertImmutableSlice9Range();

    const historicalChanged = git(['diff', '--name-only', SLICE9_HISTORICAL_RANGE])
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    expect(
      historicalChanged.length,
      `S9PM_RANGE_EMPTY: ${SLICE9_HISTORICAL_RANGE} resolved to zero changed paths`
    ).toBeGreaterThan(0);
    expect(historicalChanged).toContain(SLICE9_MIGRATION_PATH);
    expect(historicalChanged.some((path) => path.startsWith('packages/domain/src/safety/'))).toBe(
      true
    );

    const changed = [
      ...historicalChanged,
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

    // Liveness control: the inherited pattern set must still reject a forbidden
    // path and accept an in-scope Slice 9 path, so a non-matching regex can never
    // produce a vacuous PASS.
    expect(
      FORBIDDEN_PATH_PATTERNS.some((pattern) => pattern.test('docs/support_resources/example.md'))
    ).toBe(true);
    expect(
      FORBIDDEN_PATH_PATTERNS.some((pattern) => pattern.test('packages/domain/src/safety/guard.ts'))
    ).toBe(false);
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

  it('keeps the generic Case status writer out of the production package surface (S9-H01)', () => {
    const rootBarrel = readFileSync(join(ROOT, 'packages/domain/src/index.ts'), 'utf-8');
    const safetyBarrel = readFileSync(join(ROOT, 'packages/domain/src/safety/index.ts'), 'utf-8');
    const packageJson = JSON.parse(
      readFileSync(join(ROOT, 'packages/domain/package.json'), 'utf-8')
    ) as { exports: Record<string, string> };

    // 1. The root barrel must not re-export the internal transition module.
    expect(rootBarrel).not.toMatch(/^\s*export\b[^;\n]*from\s+['"][^'"]*case-transition/m);
    // 2. The Safety barrel must not re-export it either.
    expect(safetyBarrel).not.toMatch(/^\s*export\b[^;\n]*from\s+['"][^'"]*case-transition/m);
    // The Safety surface itself must still be reachable from the root barrel.
    expect(rootBarrel).toMatch(/from\s+['"]\.\/safety\/index\.js['"]/);
    // 3. Package exports must not open the internal module as a deep subpath.
    expect(Object.keys(packageJson.exports)).toEqual(['.']);
    expect(packageJson.exports['.']).toBe('./src/index.ts');

    // 4. The production package root must expose no generic Case status writer.
    const exported = domain as Record<string, unknown>;
    expect(exported.transitionCaseStatus).toBeUndefined();
    const genericStatusWriters = Object.keys(exported).filter((name) =>
      /(?:case.*status.*(?:transition|update|set|write|mutate))|(?:(?:transition|update|set|write|mutate).*case.*status)/i.test(
        name
      )
    );
    expect(genericStatusWriters).toEqual([]);
  });
});