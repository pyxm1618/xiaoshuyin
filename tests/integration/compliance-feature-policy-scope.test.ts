/**
 * T1010 / T1012 — Frozen Scenario 16 automated evidence.
 *
 * Proves the Slice 10 implementation surface contains no public policy API,
 * no client-authoritative feature code, no Scene-specific Common Core branch,
 * no later-phase runtime, no second truth source, and no generated OpenAPI
 * operation drift.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../..', import.meta.url).pathname;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function sources(dir: string): { path: string; content: string }[] {
  return walk(join(ROOT, dir))
    .filter((file) => /\.(ts|tsx|js|mjs)$/.test(file))
    .map((file) => ({ path: relative(ROOT, file), content: readFileSync(file, 'utf-8') }));
}

const POLICY_ROUTE = /\.(get|post|put|patch|delete)\s*\(\s*['"`][^'"`]*(?:feature-polic|compliance-polic|\/polic(?:y|ies))/i;
const SCENE_BRANCH = /===\s*['"](?:A4003|DIGITAL_USE_[A-Z0-9_]*)['"]/;
const CLIENT_FEATURE_AUTHORITY = /\bfeatureCode\b|\bfeature_code\b/;

describe('Slice 10 scope negatives (SC-16)', () => {
  it('exposes no public feature-policy route', () => {
    const routes = sources('apps/server/api/src/routes');
    for (const file of routes) {
      expect(POLICY_ROUTE.test(file.content), file.path).toBe(false);
      expect(CLIENT_FEATURE_AUTHORITY.test(file.content), file.path).toBe(false);
    }
  });

  it('keeps feature-code authority out of the client contract package', () => {
    for (const file of sources('packages/contracts/src')) {
      expect(CLIENT_FEATURE_AUTHORITY.test(file.content), file.path).toBe(false);
    }
  });

  it('contains no Scene-specific / Digital Use branch in Common Core compliance', () => {
    for (const file of sources('packages/compliance/src')) {
      const code = file.content
        .split('\n')
        .filter((line) => {
          const trimmed = line.trim();
          return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
        })
        .join('\n');
      expect(SCENE_BRANCH.test(code), file.path).toBe(false);
    }
  });

  it('creates no timer / notification / export / PIPIA / regulatory / admin runtime', () => {
    for (const forbiddenPath of [
      'apps/operations',
      'packages/notifications',
      'packages/ai',
      'packages/rag',

      'packages/memory',
    ]) {
      expect(existsSync(join(ROOT, forbiddenPath)), forbiddenPath).toBe(false);
    }

    const migration = readFileSync(
      join(ROOT, 'db', 'migrations', '011_compliance_feature_policy_foundation.sql'),
      'utf-8'
    ).toLowerCase();
    for (const forbiddenTable of [
      'usage_sessions',
      'interaction_usage_sessions',
      'notifications',
      'notification_attempts',
      'pipia_',
      'compliance_release_evidence',
      'feature_policy_admin',
      'generated_content_labels',
    ]) {
      expect(migration.includes(`create table ${forbiddenTable}`), forbiddenTable).toBe(false);
    }
  });

  it('does not duplicate person / guardian / consent / Safety truth', () => {
    const migration = readFileSync(
      join(ROOT, 'db', 'migrations', '011_compliance_feature_policy_foundation.sql'),
      'utf-8'
    ).toLowerCase();
    for (const forbiddenDuplicate of [
      'create table person_compliance_profiles',
      'create table consent_records',
      'create table guardian_',
      'create table safety_states',
      'create table risk_events',
    ]) {
      expect(migration.includes(forbiddenDuplicate), forbiddenDuplicate).toBe(false);
    }

    const migrationTables = [...migration.matchAll(/create table ([a-z_]+)/g)].map(
      (match) => match[1]
    );
    expect(migrationTables).toEqual(['compliance_feature_policies']);
  });

  it('keeps the reviewed schema invariants in the migration', () => {
    const migration = readFileSync(
      join(ROOT, 'db', 'migrations', '011_compliance_feature_policy_foundation.sql'),
      'utf-8'
    );
    for (const invariant of [
      "IN ('REQUIRED', 'NOT_APPLICABLE', 'UNKNOWN')",
      'ENABLE ROW LEVEL SECURITY',
      'FORCE  ROW LEVEL SECURITY',
      'pg_advisory_xact_lock',
      'BEFORE INSERT',
      'BEFORE UPDATE OF effective_from, effective_until',
      'COMPLIANCE_POLICY_EFFECTIVE_OVERLAP',
      'REVOKE ALL ON FUNCTION app.publish_compliance_feature_policy',
      'GRANT SELECT (',
    ]) {
      expect(migration.includes(invariant), invariant).toBe(true);
    }
    // Runtime never receives table-level SELECT or mutation privileges.
    expect(migration).not.toMatch(/GRANT\s+SELECT\s+ON\s+compliance_feature_policies\s+TO\s+xiaoshuyin_app/i);
    expect(migration).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE|TRUNCATE)[^;]*TO\s+xiaoshuyin_app/i);
  });

  it('does not change the generated public OpenAPI operation set', () => {
    const generated = readFileSync(join(ROOT, 'packages', 'generated', 'openapi.d.ts'), 'utf-8');
    for (const forbidden of [
      '/compliance/feature',
      '/compliance-policy',
      '/compliance/policies',
      '/feature-policy',
      'compliance_feature_policies',
    ]) {
      expect(generated.includes(forbidden), forbidden).toBe(false);
    }
  });
});