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

const qualificationProductionSource = Object.fromEntries(
  walk('apps/server/api/src')
    .sort()
    .map((path) => [path, readFileSync(resolve(ROOT, path), 'utf8')])
) as Record<string, string>;

function assertProductionQualificationProviderPolicy(
  graph: Readonly<Record<string, string>>
): void {
  const authorityPath =
    'apps/server/api/src/services/intervention-professional-authority.ts';
  const definitionsPath =
    'apps/server/api/src/services/intervention-definitions.ts';
  const authority = graph[authorityPath];
  const definitions = graph[definitionsPath];
  if (authority === undefined || definitions === undefined) {
    throw new Error('qualification authority production graph incomplete');
  }

  const canonicalUnavailable =
    /export const unavailableProductionInterventionProfessionalQualificationProvider:\s*InterventionProfessionalQualificationProvider\s*=\s*Object\.freeze\(\{\s*async resolve\(\)\s*\{\s*return null;\s*\},\s*\}\);/s;
  const canonicalMatches =
    authority.match(new RegExp(canonicalUnavailable.source, 'gs')) ?? [];
  if (canonicalMatches.length !== 1) {
    throw new Error('production qualification provider must have one unavailable canonical implementation');
  }

  const providerType = 'InterventionProfessionalQualificationProvider';
  const explicitConcretePatterns = [
    new RegExp('class\\s+\\w+\\s+implements\\s+' + providerType + '\\b'),
    new RegExp('(?:const|let|var)\\s+\\w+\\s*:\\s*' + providerType + '\\s*='),
    new RegExp('\\bsatisfies\\s+' + providerType + '\\b'),
    new RegExp('\\bas\\s+' + providerType + '\\b'),
    new RegExp('\\)\\s*:\\s*' + providerType + '\\s*(?:=>|\\{)'),
  ];
  const syntheticValidResolve =
    /(?:async\s+)?resolve\s*\([^)]*\)\s*(?::[^{]+)?\{[\s\S]{0,1600}?return\s*\{(?=[\s\S]{0,700}?\bqualificationRef\s*:)(?=[\s\S]{0,700}?\bscopeRef\s*:)(?=[\s\S]{0,700}?\bstatus\s*:\s*['"]VALID['"])[\s\S]{0,700}?\}/m;

  for (const [path, original] of Object.entries(graph)) {
    const inspected =
      path === authorityPath ? original.replace(canonicalUnavailable, '') : original;
    if (explicitConcretePatterns.some((pattern) => pattern.test(inspected))) {
      throw new Error('non-canonical production qualification provider implementation: ' + path);
    }
    if (syntheticValidResolve.test(inspected)) {
      throw new Error('synthetic VALID qualification provider in production: ' + path);
    }
  }

  const failClosedDefaults =
    definitions.match(
      /qualificationProvider:\s*InterventionProfessionalQualificationProvider\s*=\s*unavailableProductionInterventionProfessionalQualificationProvider/g
    ) ?? [];
  if (failClosedDefaults.length !== 4) {
    throw new Error('production qualification composition is not unavailable-only');
  }
}

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

  it('keeps @xiaoshuyin/domain package exports closed to raw repository subpaths', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(ROOT, 'packages/domain/package.json'), 'utf8')
    ) as { exports?: Record<string, unknown> };
    expect(manifest.exports).toEqual({ '.': './src/index.ts' });
    expect(JSON.stringify(manifest.exports)).not.toContain(
      'intervention-definition-repository'
    );
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

  it('keeps production qualification composition unavailable-only and rejects a structural synthetic VALID provider', () => {
    expect(() =>
      assertProductionQualificationProviderPolicy(qualificationProductionSource)
    ).not.toThrow();

    const mutatedGraph = {
      ...qualificationProductionSource,
      'apps/server/api/src/services/credential-source.ts': `
export const localCredentialSource = {
  async resolve(input: { reviewerIdentityRef: string; approvalScope: string }) {
    return {
      qualificationRef: 'local:credential',
      scopeRef: input.approvalScope,
      status: 'VALID' as const,
    };
  },
};
`,
    };
    expect(() =>
      assertProductionQualificationProviderPolicy(mutatedGraph)
    ).toThrow(/synthetic VALID qualification provider/);
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
