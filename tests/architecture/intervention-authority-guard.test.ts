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

type ExportOriginMap = Map<string, Set<string>>;

function addExportOrigins(
  target: ExportOriginMap,
  exportedName: string,
  origins: Iterable<string>
): void {
  const bucket = target.get(exportedName) ?? new Set<string>();
  for (const origin of origins) bucket.add(origin);
  if (bucket.size > 0) target.set(exportedName, bucket);
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function exportedOriginsFrom(
  path: string,
  overrides: VirtualSources,
  cache = new Map<string, ExportOriginMap>()
): ExportOriginMap {
  const cached = cache.get(path);
  if (cached !== undefined) return cached;

  const result: ExportOriginMap = new Map();
  // Seed before recursion so cyclic barrels terminate without unbounded traversal.
  cache.set(path, result);

  const source = readSource(path, overrides);
  const file = parseSource(path, source);
  const imported = new Map<
    string,
    { target: string; exportedName: string }
  >();
  const namespaceImports = new Map<string, string>();
  const variableInitializers = new Map<string, ts.Expression>();
  const localRawDeclarations = new Set<string>();

  for (const statement of file.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.importClause &&
      !statement.importClause.isTypeOnly
    ) {
      const target = resolveProductionModule(
        path,
        statement.moduleSpecifier.text,
        overrides
      );
      if (target !== null) {
        if (statement.importClause.name) {
          imported.set(statement.importClause.name.text, {
            target,
            exportedName: 'default',
          });
        }
        const bindings = statement.importClause.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            if (element.isTypeOnly) continue;
            imported.set(element.name.text, {
              target,
              exportedName: element.propertyName?.text ?? element.name.text,
            });
          }
        } else if (bindings && ts.isNamespaceImport(bindings)) {
          namespaceImports.set(bindings.name.text, target);
        }
      }
    }

    if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name &&
      RAW_WRITERS.has(statement.name.text)
    ) {
      localRawDeclarations.add(statement.name.text);
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const name = declaration.name.text;
        if (declaration.initializer) {
          variableInitializers.set(name, declaration.initializer);
        }
        if (RAW_WRITERS.has(name)) localRawDeclarations.add(name);
      }
    }
  }

  const identifierOrigins = (
    name: string,
    visited: ReadonlySet<string>
  ): Set<string> => {
    if (visited.has(name)) return new Set();
    const nextVisited = new Set(visited);
    nextVisited.add(name);

    if (localRawDeclarations.has(name)) return new Set([name]);

    const binding = imported.get(name);
    if (binding !== undefined) {
      const targetOrigins = exportedOriginsFrom(
        binding.target,
        overrides,
        cache
      );
      return new Set(targetOrigins.get(binding.exportedName) ?? []);
    }

    const initializer = variableInitializers.get(name);
    return initializer === undefined
      ? new Set()
      : expressionOrigins(initializer, nextVisited);
  };

  const expressionOrigins = (
    expression: ts.Expression,
    visited: ReadonlySet<string>
  ): Set<string> => {
    const current = unwrapExpression(expression);
    if (ts.isIdentifier(current)) {
      return identifierOrigins(current.text, visited);
    }
    if (
      ts.isPropertyAccessExpression(current) &&
      ts.isIdentifier(unwrapExpression(current.expression))
    ) {
      const namespace = unwrapExpression(current.expression) as ts.Identifier;
      const target = namespaceImports.get(namespace.text);
      if (target !== undefined) {
        const targetOrigins = exportedOriginsFrom(target, overrides, cache);
        return new Set(targetOrigins.get(current.name.text) ?? []);
      }
    }
    return new Set();
  };

  for (const statement of file.statements) {
    if (
      hasExportModifier(statement) &&
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name
    ) {
      const name = statement.name.text;
      if (localRawDeclarations.has(name)) {
        addExportOrigins(result, name, [name]);
      }
    }

    if (hasExportModifier(statement) && ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const name = declaration.name.text;
        if (declaration.initializer) {
          addExportOrigins(
            result,
            name,
            expressionOrigins(declaration.initializer, new Set([name]))
          );
        } else if (localRawDeclarations.has(name)) {
          addExportOrigins(result, name, [name]);
        }
      }
    }

    if (!ts.isExportDeclaration(statement)) continue;
    const specifier =
      statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : null;
    const target =
      specifier === null
        ? null
        : resolveProductionModule(path, specifier, overrides);

    if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        if (element.isTypeOnly) continue;
        const original = element.propertyName?.text ?? element.name.text;
        const exposed = element.name.text;

        if (target !== null) {
          const targetOrigins = exportedOriginsFrom(target, overrides, cache);
          addExportOrigins(result, exposed, targetOrigins.get(original) ?? []);
          continue;
        }

        addExportOrigins(
          result,
          exposed,
          identifierOrigins(original, new Set())
        );
      }
      continue;
    }

    if (
      statement.exportClause &&
      ts.isNamespaceExport(statement.exportClause) &&
      target !== null
    ) {
      const namespace = statement.exportClause.name.text;
      const targetOrigins = exportedOriginsFrom(target, overrides, cache);
      for (const [name, origins] of targetOrigins) {
        addExportOrigins(result, namespace + '.' + name, origins);
      }
      continue;
    }

    if (statement.exportClause === undefined && target !== null) {
      const targetOrigins = exportedOriginsFrom(target, overrides, cache);
      for (const [name, origins] of targetOrigins) {
        addExportOrigins(result, name, origins);
      }
    }
  }

  return result;
}

function assertRawWriterPackageBoundary(overrides: VirtualSources = {}): void {
  const exported = exportedOriginsFrom(DOMAIN_ROOT, overrides);
  const findings: string[] = [];
  for (const [exposed, origins] of exported) {
    for (const origin of origins) {
      if (RAW_WRITERS.has(origin)) {
        findings.push(
          DOMAIN_ROOT + ' exposes raw writer ' + origin + ' as ' + exposed
        );
      }
    }
  }
  if (findings.length > 0) throw new Error(findings.join('\n'));
}

function propertyNameText(name: ts.PropertyName): string | null {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  return null;
}

type QualificationFunction =
  | ts.ArrowFunction
  | ts.FunctionExpression
  | ts.FunctionDeclaration
  | ts.MethodDeclaration;

type ValueDeclarationMap = Map<string, ts.Declaration[]>;

function collectValueDeclarations(file: ts.SourceFile): ValueDeclarationMap {
  const declarations: ValueDeclarationMap = new Map();
  const add = (name: string, declaration: ts.Declaration): void => {
    const bucket = declarations.get(name) ?? [];
    bucket.push(declaration);
    declarations.set(name, bucket);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      add(node.name.text, node);
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      add(node.name.text, node);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return declarations;
}

function objectLiteralIsSyntheticValidQualification(
  object: ts.ObjectLiteralExpression
): boolean {
  let qualificationRef = false;
  let scopeRef = false;
  let validStatus = false;

  for (const property of object.properties) {
    if (
      !ts.isPropertyAssignment(property) &&
      !ts.isShorthandPropertyAssignment(property)
    ) {
      continue;
    }
    const name = propertyNameText(property.name);
    if (name === 'qualificationRef') qualificationRef = true;
    if (name === 'scopeRef') scopeRef = true;
    if (
      name === 'status' &&
      ts.isPropertyAssignment(property)
    ) {
      const status = unwrapExpression(property.initializer);
      validStatus =
        ts.isStringLiteralLike(status) &&
        status.text === 'VALID';
    }
  }

  return qualificationRef && scopeRef && validStatus;
}

function expressionProducesSyntheticValidQualification(
  expression: ts.Expression,
  declarations: ValueDeclarationMap,
  file: ts.SourceFile,
  visited: ReadonlySet<string>
): boolean {
  const current = unwrapExpression(expression);

  if (ts.isObjectLiteralExpression(current)) {
    return objectLiteralIsSyntheticValidQualification(current);
  }

  if (ts.isIdentifier(current)) {
    if (visited.has(current.text)) return false;
    const nextVisited = new Set(visited);
    nextVisited.add(current.text);
    for (const declaration of declarations.get(current.text) ?? []) {
      if (
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer &&
        expressionProducesSyntheticValidQualification(
          declaration.initializer,
          declarations,
          file,
          nextVisited
        )
      ) {
        return true;
      }
    }
    return false;
  }

  if (ts.isConditionalExpression(current)) {
    return (
      expressionProducesSyntheticValidQualification(
        current.whenTrue,
        declarations,
        file,
        visited
      ) ||
      expressionProducesSyntheticValidQualification(
        current.whenFalse,
        declarations,
        file,
        visited
      )
    );
  }

  if (
    ts.isCallExpression(current) &&
    ts.isIdentifier(current.expression)
  ) {
    return identifierFunctionReturnsSyntheticQualification(
      current.expression.text,
      declarations,
      file,
      visited
    );
  }

  return false;
}

function functionReturnsSyntheticQualification(
  fn: QualificationFunction,
  declarations: ValueDeclarationMap,
  file: ts.SourceFile,
  visited: ReadonlySet<string>
): boolean {
  if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) {
    return expressionProducesSyntheticValidQualification(
      fn.body,
      declarations,
      file,
      visited
    );
  }

  const body = fn.body;
  if (!body || !ts.isBlock(body)) return false;

  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (
      node !== body &&
      (
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node)
      )
    ) {
      return;
    }
    if (
      ts.isReturnStatement(node) &&
      node.expression &&
      expressionProducesSyntheticValidQualification(
        node.expression,
        declarations,
        file,
        visited
      )
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return found;
}

function callableExpressionReturnsSyntheticQualification(
  expression: ts.Expression,
  declarations: ValueDeclarationMap,
  file: ts.SourceFile,
  visited: ReadonlySet<string>
): boolean {
  const current = unwrapExpression(expression);
  if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
    return functionReturnsSyntheticQualification(
      current,
      declarations,
      file,
      visited
    );
  }
  if (ts.isIdentifier(current)) {
    return identifierFunctionReturnsSyntheticQualification(
      current.text,
      declarations,
      file,
      visited
    );
  }
  return false;
}

function identifierFunctionReturnsSyntheticQualification(
  name: string,
  declarations: ValueDeclarationMap,
  file: ts.SourceFile,
  visited: ReadonlySet<string>
): boolean {
  const key = 'function:' + name;
  if (visited.has(key)) return false;
  const nextVisited = new Set(visited);
  nextVisited.add(key);

  for (const declaration of declarations.get(name) ?? []) {
    if (
      ts.isFunctionDeclaration(declaration) &&
      functionReturnsSyntheticQualification(
        declaration,
        declarations,
        file,
        nextVisited
      )
    ) {
      return true;
    }
    if (
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer &&
      callableExpressionReturnsSyntheticQualification(
        declaration.initializer,
        declarations,
        file,
        nextVisited
      )
    ) {
      return true;
    }
  }
  return false;
}

function assertNoSyntheticQualificationProvider(
  graph: Readonly<Record<string, string>>
): void {
  for (const [path, source] of Object.entries(graph)) {
    const file = parseSource(path, source);
    const declarations = collectValueDeclarations(file);
    const visit = (node: ts.Node): void => {
      let synthetic = false;

      if (
        ts.isMethodDeclaration(node) &&
        propertyNameText(node.name) === 'resolve'
      ) {
        synthetic = functionReturnsSyntheticQualification(
          node,
          declarations,
          file,
          new Set()
        );
      } else if (
        ts.isPropertyAssignment(node) &&
        propertyNameText(node.name) === 'resolve'
      ) {
        synthetic = callableExpressionReturnsSyntheticQualification(
          node.initializer,
          declarations,
          file,
          new Set()
        );
      } else if (
        ts.isShorthandPropertyAssignment(node) &&
        propertyNameText(node.name) === 'resolve'
      ) {
        synthetic = identifierFunctionReturnsSyntheticQualification(
          node.name.text,
          declarations,
          file,
          new Set()
        );
      }

      if (synthetic) {
        throw new Error(
          'synthetic VALID qualification provider in production: ' + path
        );
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

  it('counterfactual: detects multi-hop aliased raw writer reachability through neutral named barrels', () => {
    const domainIndex = readSource(DOMAIN_ROOT);
    const overrides = {
      [DOMAIN_ROOT]:
        domainIndex + "\nexport { safeFacade } from './neutral-writer-barrel.js';\n",
      'packages/domain/src/neutral-writer-barrel.ts':
        "export { harmlessWriter as safeFacade } from './neutral-writer.js';\n",
      'packages/domain/src/neutral-writer.ts':
        "export { insertInterventionDefinitionCandidate as harmlessWriter } " +
        "from './intervention-definition-repository.js';\n",
    };
    expect(() => assertRawWriterPackageBoundary(overrides))
      .toThrow(/raw writer/);
  });

  it('counterfactual: detects direct raw writer export from the public package root', () => {
    const domainIndex = readSource(DOMAIN_ROOT);
    const overrides = {
      [DOMAIN_ROOT]:
        domainIndex +
        "\nexport { insertInterventionDefinitionCandidate } from './intervention-definition-repository.js';\n",
    };
    expect(() => assertRawWriterPackageBoundary(overrides))
      .toThrow(/raw writer/);
  });

  it('counterfactual: detects directly aliased raw writer export from the public package root', () => {
    const domainIndex = readSource(DOMAIN_ROOT);
    const overrides = {
      [DOMAIN_ROOT]:
        domainIndex +
        "\nexport { insertInterventionDefinitionCandidate as safeFacade } from './intervention-definition-repository.js';\n",
    };
    expect(() => assertRawWriterPackageBoundary(overrides))
      .toThrow(/raw writer/);
  });

  it('counterfactual: detects raw writer laundering through identifier assignments and multi-hop barrels', () => {
    const domainIndex = readSource(DOMAIN_ROOT);
    const overrides = {
      [DOMAIN_ROOT]:
        domainIndex +
        "\nexport { safeFacade } from './neutral-writer-assignment-barrel.js';\n",
      'packages/domain/src/neutral-writer-assignment-barrel.ts':
        "export { safeFacade } from './neutral-writer-assignment.js';\n",
      'packages/domain/src/neutral-writer-assignment.ts': [
        "import { insertInterventionDefinitionCandidate as internal } from './intervention-definition-repository.js';",
        'const first = internal;',
        'const second = first;',
        'export { second as safeFacade };',
        '',
      ].join('\n'),
    };
    expect(() => assertRawWriterPackageBoundary(overrides))
      .toThrow(/raw writer/);
  });

  it('counterfactual: detects direct production fixture import', () => {
    const domainIndex = readSource(DOMAIN_ROOT);
    const overrides = {
      [DOMAIN_ROOT]:
        domainIndex +
        "\nimport '../../../tests/fixtures/synthetic-authority.js';\n",
    };
    expect(() => assertNoFixtureLeakage(buildProductionGraph(overrides)))
      .toThrow(/production fixture dependency/);
  });

  it('counterfactual: detects shorthand VALID qualification provider via resolved identifier origin', () => {
    const definitions =
      readSource('apps/server/api/src/services/intervention-definitions.ts');
    const overrides = {
      'apps/server/api/src/services/intervention-definitions.ts':
        definitions + "\nimport './credential-shorthand-source.js';\n",
      'apps/server/api/src/services/credential-shorthand-source.ts': [
        "const resolve = async (input: { approvalScope: string }) => ({",
        "  qualificationRef: 'local:credential',",
        '  scopeRef: input.approvalScope,',
        "  status: 'VALID' as const,",
        '});',
        'export const credentialSource = { resolve };',
        '',
      ].join('\n'),
    };
    expect(() =>
      assertNoSyntheticQualificationProvider(buildProductionGraph(overrides))
    ).toThrow(/synthetic VALID qualification provider/);
  });

  it('counterfactual: detects factory-returned shorthand VALID qualification provider', () => {
    const definitions =
      readSource('apps/server/api/src/services/intervention-definitions.ts');
    const overrides = {
      'apps/server/api/src/services/intervention-definitions.ts':
        definitions + "\nimport './credential-factory-source.js';\n",
      'apps/server/api/src/services/credential-factory-source.ts': [
        "const resolve = async (input: { approvalScope: string }) => ({",
        "  qualificationRef: 'local:credential',",
        '  scopeRef: input.approvalScope,',
        "  status: 'VALID' as const,",
        '});',
        'function createProvider() {',
        '  return { resolve };',
        '}',
        'export const credentialSource = createProvider();',
        '',
      ].join('\n'),
    };
    expect(() =>
      assertNoSyntheticQualificationProvider(buildProductionGraph(overrides))
    ).toThrow(/synthetic VALID qualification provider/);
  });

  it('counterfactual: detects future qualification registry', () => {
    expect(() =>
      assertMigrationAuthorityPolicy(
        migrationSources({
          'db/migrations/999_counterfactual_qualification.sql':
            'CREATE TABLE professional_qualifications (id uuid primary key);',
        })
      )
    ).toThrow(/duplicate\/out-of-scope authority/);
  });

  it('counterfactual: detects a second intervention Staff authority truth', () => {
    expect(() =>
      assertMigrationAuthorityPolicy(
        migrationSources({
          'db/migrations/999_counterfactual_staff.sql':
            'CREATE TABLE intervention_professional_staff (id uuid primary key);',
        })
      )
    ).toThrow(/duplicate\/out-of-scope authority/);
  });

  it('counterfactual: detects production InterventionDefinition seed', () => {
    expect(() =>
      assertMigrationAuthorityPolicy(
        migrationSources({
          'db/migrations/999_counterfactual_definition_seed.sql':
            "INSERT INTO intervention_definitions (id) VALUES ('00000000-0000-0000-0000-000000000000');",
        })
      )
    ).toThrow(/duplicate\/out-of-scope authority/);
  });

  it('control: harmless aliases, UNAVAILABLE shorthand providers and unreachable test fixtures remain allowed', () => {
    const domainIndex = readSource(DOMAIN_ROOT);
    const definitions =
      readSource('apps/server/api/src/services/intervention-definitions.ts');
    const overrides = {
      [DOMAIN_ROOT]:
        domainIndex +
        "\nexport { safeFacade } from './neutral-harmless-assignment.js';\n",
      'packages/domain/src/neutral-harmless-assignment.ts': [
        'const harmlessFunction = () => true;',
        'const x = harmlessFunction;',
        'export const safeFacade = x;',
        '',
      ].join('\n'),
      'apps/server/api/src/services/intervention-definitions.ts':
        definitions + "\nimport './credential-unavailable-source.js';\n",
      'apps/server/api/src/services/credential-unavailable-source.ts': [
        "const resolve = async (input: { approvalScope: string }) => ({",
        "  qualificationRef: 'local:none',",
        '  scopeRef: input.approvalScope,',
        "  status: 'UNAVAILABLE' as const,",
        '});',
        'export const credentialSource = { resolve };',
        '',
      ].join('\n'),
      'tests/support/unreachable-valid-provider.ts': [
        "const resolve = async () => ({",
        "  qualificationRef: 'test:only',",
        "  scopeRef: 'test',",
        "  status: 'VALID' as const,",
        '});',
        'export const provider = { resolve };',
        '',
      ].join('\n'),
    };

    expect(() => assertRawWriterPackageBoundary(overrides)).not.toThrow();
    const graph = buildProductionGraph(overrides);
    expect(graph).not.toHaveProperty('tests/support/unreachable-valid-provider.ts');
    expect(() => assertNoSyntheticQualificationProvider(graph)).not.toThrow();
  });

});
