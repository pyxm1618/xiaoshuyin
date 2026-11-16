import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const productionFiles = [
  'packages/domain/src/intervention-definition-schema.ts',
  'packages/domain/src/intervention-definitions.ts',
  'packages/domain/src/intervention-definition-repository.ts',
  'packages/domain/src/intervention-eligibility.ts',
  'packages/scenes/digital-use/intervention-definitions.ts',
  'apps/server/api/src/services/intervention-professional-authority.ts',
  'apps/server/api/src/services/intervention-definitions.ts',
  'apps/server/api/src/services/intervention-eligibility.ts',
  'db/migrations/024_psychological_behavioral_intervention_contract.sql',
] as const;

const source = Object.fromEntries(
  productionFiles.map((path) => [path, readFileSync(resolve(ROOT, path), 'utf8')])
);

describe('Slice 16 static authority / negative-scope guard', () => {
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
