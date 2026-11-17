import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
function walk(relativeDir: string): string[] {
  const absolute = resolve(ROOT, relativeDir);
  return readdirSync(absolute)
    .flatMap((name) => {
      const relative = relativeDir + '/' + name;
      const full = resolve(ROOT, relative);
      return statSync(full).isDirectory() ? walk(relative) : [relative];
    })
    .filter((path) => path.endsWith('.ts'));
}

const productionFiles = Array.from(new Set([
  'packages/domain/src/index.ts',
  'packages/domain/src/idempotency.ts',
  ...walk('packages/domain/src').filter((path) => /intervention/.test(path)),
  'packages/scenes/digital-use/index.ts',
  ...walk('packages/scenes/digital-use').filter((path) => /intervention/.test(path)),
  'db/schema/index.ts',
  'apps/server/api/src/idempotency.ts',
  ...walk('apps/server/api/src/services').filter((path) => /intervention/.test(path)),
  'db/migrations/024_psychological_behavioral_intervention_contract.sql',
])).sort();

const source = Object.fromEntries(
  productionFiles.map((path) => [path, readFileSync(resolve(ROOT, path), 'utf8')])
);

describe('Slice 16 static authority / negative-scope guard', () => {
  it('derives the actual Slice 16 production/export graph including all required barrels and integrations', () => {
    for (const required of [
      'packages/domain/src/index.ts',
      'packages/scenes/digital-use/index.ts',
      'db/schema/index.ts',
      'packages/domain/src/idempotency.ts',
      'apps/server/api/src/idempotency.ts',
      'packages/domain/src/intervention-definition-repository.ts',
      'apps/server/api/src/services/intervention-definitions.ts',
      'apps/server/api/src/services/intervention-eligibility.ts',
    ]) {
      expect(productionFiles, required).toContain(required);
    }
  });

  it('mechanically prevents raw InterventionDefinition writers from the domain package root', () => {
    const root = source['packages/domain/src/index.ts'];
    expect(root).not.toMatch(/export\s+\*\s+from\s+['"]\.\/intervention-definition-repository\.js['"]/);
    for (const rawWriter of [
      'insertInterventionDefinitionCandidate',
      'transitionInterventionDefinitionStateCas',
      'insertInterventionDefinitionAudit',
    ]) {
      expect(root, rawWriter).not.toContain(rawWriter);
      for (const [path, content] of Object.entries(source)) {
        if (!content.includes(rawWriter)) continue;
        expect(
          [
            'packages/domain/src/intervention-definition-repository.ts',
            'apps/server/api/src/services/intervention-definitions.ts',
            'apps/server/api/src/services/intervention-eligibility.ts',
          ],
          rawWriter + ' leaked into ' + path
        ).toContain(path);
      }
    }
  });

  it('does not create duplicate authority-owner tables or generic approval platforms', () => {
    const migration = source['db/migrations/024_psychological_behavioral_intervention_contract.sql'];
    for (const forbidden of [
      /CREATE TABLE\s+professional_(reviewers|qualifications)/i,
      /CREATE TABLE\s+.*approval/i,
      /CREATE TABLE\s+.*reviewer/i,
      /CREATE TABLE\s+intervention_package_registry/i,
      /CREATE TABLE\s+.*case_phase/i,
      /CREATE TABLE\s+.*staff/i,
    ]) {
      expect(migration).not.toMatch(forbidden);
    }
    expect(migration).toMatch(/CREATE TABLE intervention_definitions/i);
  });

  it('does not generalize or reuse SAFETY_RESOLVE authority as PROFESSIONAL_REVIEW', () => {
    const staffMigration = readFileSync(
      resolve(ROOT, 'db/migrations/021_safety_resolver_staff_authority.sql'),
      'utf8'
    );
    expect(staffMigration).toContain("assignment.capability = 'SAFETY_RESOLVE'");
    expect(staffMigration).toContain("app_current_purpose() <> 'SAFETY_RESOLUTION'");
    expect(source['db/migrations/024_psychological_behavioral_intervention_contract.sql'])
      .not.toMatch(/set_staff_case_context|staff_case_authorized|SAFETY_RESOLUTION/);
  });

  it('production cannot import test fixtures or synthetic authority', () => {
    for (const [path, content] of Object.entries(source)) {
      expect(content, path).not.toMatch(/tests\/(support|fixtures)|TEST_ONLY_QUALIFICATION_PROVIDER/);
    }
  });

  it('contains no developer/AI/RAG/environment approval laundering', () => {
    const all = Object.values(source).join('\n');
    for (const forbidden of [
      /approved\s*=\s*true/i,
      /process\.env.*approv/i,
      /\bAI[_ -]?APPROV/i,
      /\bRAG[_ -]?APPROV/i,
      /hard[-_ ]coded reviewer/i,
      /seed.*approv/i,
    ]) expect(all).not.toMatch(forbidden);
  });

  it('does not introduce Phase-4 execution domains', () => {
    const all = Object.values(source).join('\n');
    for (const forbidden of [
      /\bInterventionInstance\b/,
      /CREATE TABLE\s+goals?\b/i,
      /CREATE TABLE\s+plans?\b/i,
      /CREATE TABLE\s+tasks?\b/i,
      /CREATE TABLE\s+outcomes?\b/i,
      /ContextBuilder/,
      /AI Task Runtime/i,
    ]) expect(all).not.toMatch(forbidden);
  });

  it('contains no production InterventionDefinition seed', () => {
    const migration = source['db/migrations/024_psychological_behavioral_intervention_contract.sql'];
    expect(migration).not.toMatch(/INSERT\s+INTO\s+intervention_definitions/i);
  });
});
