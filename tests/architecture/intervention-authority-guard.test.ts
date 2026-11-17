import { describe, expect, it } from 'vitest';
import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import {
  dirname,
  relative,
  resolve,
} from 'node:path';
import * as ts from 'typescript';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const DOMAIN_ROOT = 'packages/domain/src/index.ts';
const SCENE_ROOT = 'packages/scenes/digital-use/index.ts';
const SERVER_ROOTS = [
  'apps/server/api/src/services/intervention-definitions.ts',
  'apps/server/api/src/services/intervention-eligibility.ts',
  'apps/server/api/src/services/intervention-professional-authority.ts',
  'apps/server/api/src/idempotency.ts',
] as const;
const PRODUCTION_ROOTS = [
  DOMAIN_ROOT,
  SCENE_ROOT,
  ...SERVER_ROOTS,
  'db/schema/index.ts',
] as const;
const TARGET_PREFIXES = [
  'packages/domain/',
  'packages/scenes/',
  'apps/server/api/',
  'db/schema/',
] as const;
const RAW_WRITERS = new Set([
  'insertInterventionDefinitionCandidate',
  'transitionInterventionDefinitionStateCas',
  'insertInterventionDefinitionAudit',
]);

type VirtualSources = Readonly<Record<string, string>>;

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/');
}

function readSource(path: string, overrides: VirtualSources = {}): string {
  const virtual = overrides[path];
  return virtual ?? readFileSync(resolve(ROOT, path), 'utf8');
}

function sourceExists(path: string, overrides: VirtualSources): boolean {
  return Object.prototype.hasOwnProperty.call(overrides, path) ||
    existsSync(resolve(ROOT, path));
}

function parseSource(path: string, source: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

function dependencySpecifiers(path: string, source: string): string[] {
  const file = parseSource(path, source);
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]!) &&
      (
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')
      )
    ) {
      specifiers.push(node.arguments[0]!.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return specifiers;
}

function resolveProductionModule(
  importer: string,
  specifier: string,
  overrides: VirtualSources
): string | null {
  const aliases: Record<string, string> = {
    '@xiaoshuyin/domain': 'packages/domain/src/index.ts',
    '@xiaoshuyin/scenes/digital-use': 'packages/scenes/digital-use/index.ts',
  };
  const aliased = aliases[specifier];
  if (aliased !== undefined) return aliased;
  if (!specifier.startsWith('.')) return null;

  const raw = normalizePath(
    relative(ROOT, resolve(ROOT, dirname(importer), specifier))
  );
  const candidates = [
    raw,
    raw.replace(/\.js$/, '.ts'),
    raw.replace(/\.mjs$/, '.ts'),
    raw + '.ts',
    raw + '/index.ts',
  ];
  for (const candidate of [...new Set(candidates)]) {
    if (!sourceExists(candidate, overrides)) continue;
    if (TARGET_PREFIXES.some((prefix) => candidate.startsWith(prefix))) {
      return candidate;
    }
    return null;
  }
  return null;
}

function buildProductionGraph(
  overrides: VirtualSources = {},
  roots: readonly string[] = PRODUCTION_ROOTS
): Record<string, string> {
  const graph: Record<string, string> = {};
  const pending = [...roots];
  while (pending.length > 0) {
    const path = pending.pop()!;
    if (graph[path] !== undefined) continue;
    if (!sourceExists(path, overrides)) {
      throw new Error('production graph missing: ' + path);
    }
    const source = readSource(path, overrides);
    graph[path] = source;
    for (const specifier of dependencySpecifiers(path, source)) {
      const resolved = resolveProductionModule(path, specifier, overrides);
      if (resolved !== null && graph[resolved] === undefined) pending.push(resolved);
    }
  }
  return graph;
}

function assertNoFixtureLeakage(graph: Readonly<Record<string, string>>): void {
  for (const [path, source] of Object.entries(graph)) {
    for (const specifier of dependencySpecifiers(path, source)) {
      if (
        /(^|\/)tests\/(?:fixtures|support)(?:\/|$)/.test(specifier) ||
        /TEST_ONLY_/.test(specifier)
      ) {
        throw new Error('production fixture dependency: ' + path + ' -> ' + specifier);
      }
    }
    if (/TEST_ONLY_QUALIFICATION_PROVIDER/.test(source)) {
      throw new Error('synthetic qualification fixture reachable in production: ' + path);
    }
  }
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false);
}

function rawWriterExportsFrom(
  path: string,
  overrides: VirtualSources,
  visited = new Set<string>()
): string[] {
  if (visited.has(path)) return [];
  visited.add(path);
  const source = readSource(path, overrides);
  const file = parseSource(path, source);
  const findings: string[] = [];
  const imported = new Map<string, string>();

  for (const statement of file.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      for (const element of statement.importClause.namedBindings.elements) {
        imported.set(
          element.name.text,
          element.propertyName?.text ?? element.name.text
        );
      }
    }
  }

  for (const statement of file.statements) {
    if (ts.isExportDeclaration(statement)) {
      const specifier =
        statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : null;
      const target = specifier === null
        ? null
        : resolveProductionModule(path, specifier, overrides);

      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          const original = element.propertyName?.text ?? element.name.text;
          if (RAW_WRITERS.has(original)) {
            findings.push(path + ' exports raw writer ' + original);
          }
          if (specifier === null) {
            const importedOriginal = imported.get(original);
            if (importedOriginal && RAW_WRITERS.has(importedOriginal)) {
              findings.push(path + ' re-exports aliased raw writer ' + importedOriginal);
            }
          }
        }
      } else if (target !== null) {
        findings.push(...rawWriterExportsFrom(target, overrides, visited));
      }
      continue;
    }

    if (
      hasExportModifier(statement) &&
      (
        ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement)
      ) &&
      statement.name &&
      RAW_WRITERS.has(statement.name.text)
    ) {
      findings.push(path + ' defines public raw writer ' + statement.name.text);
    }

    if (hasExportModifier(statement) && ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && RAW_WRITERS.has(declaration.name.text)) {
          findings.push(path + ' defines public raw writer ' + declaration.name.text);
        }
      }
    }
  }
  return findings;
}

function assertRawWriterPackageBoundary(overrides: VirtualSources = {}): void {
  const findings = rawWriterExportsFrom(DOMAIN_ROOT, overrides);
  if (findings.length > 0) throw new Error(findings.join('\n'));
}

function nodeName(node: ts.MethodDeclaration | ts.PropertyAssignment): string | null {
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) return node.name.text;
  return null;
}

function assertNoSyntheticQualificationProvider(
  graph: Readonly<Record<string, string>>
): void {
  for (const [path, source] of Object.entries(graph)) {
    const file = parseSource(path, source);
    const visit = (node: ts.Node): void => {
      if (
        (ts.isMethodDeclaration(node) || ts.isPropertyAssignment(node)) &&
        nodeName(node) === 'resolve'
      ) {
        const text = node.getText(file);
        if (
          /\bqualificationRef\b/.test(text) &&
          /\bscopeRef\b/.test(text) &&
          /\bstatus\s*:\s*['"]VALID['"]/.test(text)
        ) {
          throw new Error('synthetic VALID qualification provider in production: ' + path);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
}

function migrationSources(extra: VirtualSources = {}): Record<string, string> {
  const dir = resolve(ROOT, 'db/migrations');
  const actual = Object.fromEntries(
    readdirSync(dir)
      .filter((name) => name.endsWith('.sql'))
      .sort()
      .map((name) => {
        const path = 'db/migrations/' + name;
        return [path, readSource(path)];
      })
  );
  return { ...actual, ...extra };
}

function assertMigrationAuthorityPolicy(
  migrations: Readonly<Record<string, string>>
): void {
  const forbidden = [
    /CREATE\s+TABLE\s+(?:app\.)?professional_(?:reviewers?|qualifications?|approvals?)\b/i,
    /CREATE\s+TABLE\s+(?:app\.)?intervention_[a-z0-9_]*(?:approval|qualification|staff)[a-z0-9_]*\b/i,
    /CREATE\s+TABLE\s+(?:app\.)?intervention_package_registry\b/i,
    /CREATE\s+TABLE\s+(?:app\.)?intervention_instances?\b/i,
    /INSERT\s+INTO\s+(?:public\.)?intervention_definitions\b/i,
  ];
  for (const [path, source] of Object.entries(migrations)) {
    for (const pattern of forbidden) {
      if (pattern.test(source)) {
        throw new Error('duplicate/out-of-scope authority in migration: ' + path + ' ' + pattern);
      }
    }
  }
}

function assertNoPhase4Leakage(graph: Readonly<Record<string, string>>): void {
  const forbidden = [
    /\bInterventionInstance\b/,
    /\bContextBuilder\b/,
    /\bAI\s+Task\s+Runtime\b/i,
    /CREATE\s+TABLE\s+(?:goals?|plans?|tasks?|outcomes?)\b/i,
  ];
  for (const [path, source] of Object.entries(graph)) {
    for (const pattern of forbidden) {
      if (pattern.test(source)) {
        throw new Error('Phase4 owner reachable in production graph: ' + path);
      }
    }
  }
}

function assertNoApprovalLaundering(graph: Readonly<Record<string, string>>): void {
  const all = Object.values(graph).join('\n');
  for (const forbidden of [
    /approved\s*=\s*true/i,
    /process\.env.*approv/i,
    /\bAI[_ -]?APPROV/i,
    /\bRAG[_ -]?APPROV/i,
    /hard[-_ ]coded reviewer/i,
    /seed.*approv/i,
  ]) {
    if (forbidden.test(all)) throw new Error('approval laundering pattern: ' + forbidden);
  }
}

describe('Slice 16 production dependency / authority architecture guard', () => {
  it('traverses the actual production import/re-export graph from package and service roots', () => {
    const graph = buildProductionGraph();
    for (const required of [
      DOMAIN_ROOT,
      SCENE_ROOT,
      'packages/domain/src/intervention-definition-repository.ts',
      'packages/domain/src/participants.ts',
      'apps/server/api/src/services/intervention-definitions.ts',
      'apps/server/api/src/services/intervention-eligibility.ts',
      'apps/server/api/src/services/intervention-professional-authority.ts',
    ]) {
      expect(graph, required).toHaveProperty(required);
    }
  });

  it('keeps @xiaoshuyin/domain package exports closed to raw repository writers', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(ROOT, 'packages/domain/package.json'), 'utf8')
    ) as { exports?: Record<string, unknown> };
    expect(manifest.exports).toEqual({ '.': './src/index.ts' });
    expect(() => assertRawWriterPackageBoundary()).not.toThrow();
  });

  it('keeps current production graph free of fixtures, synthetic qualification, approval laundering and Phase4 owners', () => {
    const graph = buildProductionGraph();
    expect(() => assertNoFixtureLeakage(graph)).not.toThrow();
    expect(() => assertNoSyntheticQualificationProvider(graph)).not.toThrow();
    expect(() => assertNoApprovalLaundering(graph)).not.toThrow();
    expect(() => assertNoPhase4Leakage(graph)).not.toThrow();
  });

  it('scans every current migration for duplicate authority and production Definition seeds', () => {
    const migrations = migrationSources();
    expect(Object.keys(migrations)).toContain(
      'db/migrations/025_slice16_post_merge_forensic_remediation.sql'
    );
    expect(() => assertMigrationAuthorityPolicy(migrations)).not.toThrow();
  });

  it('does not generalize or reuse SAFETY_RESOLVE authority as PROFESSIONAL_REVIEW', () => {
    const staffMigration = readFileSync(
      resolve(ROOT, 'db/migrations/021_safety_resolver_staff_authority.sql'),
      'utf8'
    );
    const interventionMigration = readFileSync(
      resolve(ROOT, 'db/migrations/024_psychological_behavioral_intervention_contract.sql'),
      'utf8'
    );
    expect(staffMigration).toContain("assignment.capability = 'SAFETY_RESOLVE'");
    expect(staffMigration).toContain("app_current_purpose() <> 'SAFETY_RESOLUTION'");
    expect(interventionMigration).not.toMatch(
      /set_staff_case_context|staff_case_authorized|SAFETY_RESOLUTION/
    );
  });

  it('counterfactual: detects structural arrow-property VALID qualification providers', () => {
    const definitions =
      readSource('apps/server/api/src/services/intervention-definitions.ts');
    const overrides = {
      'apps/server/api/src/services/intervention-definitions.ts':
        definitions + "\nimport './credential-source.js';\n",
      'apps/server/api/src/services/credential-source.ts': `
export const credentialSource = {
  resolve: async (input: { approvalScope: string }) => ({
    qualificationRef: 'local:credential',
    scopeRef: input.approvalScope,
    status: 'VALID' as const,
  }),
};
`,
    };
    expect(() =>
      assertNoSyntheticQualificationProvider(buildProductionGraph(overrides))
    ).toThrow(/synthetic VALID qualification provider/);
  });

  it('counterfactual: detects future approval and package registries in any next migration', () => {
    expect(() =>
      assertMigrationAuthorityPolicy(
        migrationSources({
          'db/migrations/999_counterfactual_approval.sql':
            'CREATE TABLE intervention_approval_registry (id uuid primary key);',
        })
      )
    ).toThrow(/duplicate\/out-of-scope authority/);

    expect(() =>
      assertMigrationAuthorityPolicy(
        migrationSources({
          'db/migrations/999_counterfactual_package.sql':
            'CREATE TABLE intervention_package_registry (id uuid primary key);',
        })
      )
    ).toThrow(/duplicate\/out-of-scope authority/);
  });

  it('counterfactual: detects indirect fixture import through a neutral reachable module', () => {
    const domainIndex = readSource(DOMAIN_ROOT);
    const overrides = {
      [DOMAIN_ROOT]: domainIndex + "\nexport * from './neutral-fixture.js';\n",
      'packages/domain/src/neutral-fixture.ts':
        "import '../../../tests/fixtures/synthetic-authority.js';\nexport const neutral = true;\n",
    };
    expect(() =>
      assertNoFixtureLeakage(buildProductionGraph(overrides))
    ).toThrow(/production fixture dependency/);
  });

  it('counterfactual: detects neutral Phase4 module reached only through a barrel', () => {
    const domainIndex = readSource(DOMAIN_ROOT);
    const overrides = {
      [DOMAIN_ROOT]: domainIndex + "\nexport * from './neutral-phase4-barrel.js';\n",
      'packages/domain/src/neutral-phase4-barrel.ts':
        "export * from './neutral-phase4.js';\n",
      'packages/domain/src/neutral-phase4.ts':
        'export interface InterventionInstance { id: string }\n',
    };
    expect(() =>
      assertNoPhase4Leakage(buildProductionGraph(overrides))
    ).toThrow(/Phase4 owner reachable/);
  });

  it('counterfactual: detects indirect aliased raw writer re-export through neutral barrels', () => {
    const domainIndex = readSource(DOMAIN_ROOT);
    const overrides = {
      [DOMAIN_ROOT]: domainIndex + "\nexport * from './neutral-writer-barrel.js';\n",
      'packages/domain/src/neutral-writer-barrel.ts':
        "export * from './neutral-writer.js';\n",
      'packages/domain/src/neutral-writer.ts':
        "export { insertInterventionDefinitionCandidate as harmlessWriter } " +
        "from './intervention-definition-repository.js';\n",
    };
    expect(() => assertRawWriterPackageBoundary(overrides))
      .toThrow(/raw writer/);
  });
});
