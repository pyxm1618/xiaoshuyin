/**
 * Slice 1 Consent Owner — 01004 narrow post-merge remediation static guards.
 *
 * These structural assertions fail if a future change:
 *   - creates a second consent ledger / second supplementary consent table;
 *   - adds a public supplemental consent endpoint;
 *   - gives the owner seam its own transaction, second client or idempotency;
 *   - edits a historical migration;
 *   - implements Slice 12 Scene runtime or a generic consent platform.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations');
const OWNER_SEAM = join(ROOT, 'packages', 'compliance', 'src', 'supplemental-consent.ts');

const PURPOSE = 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT';

const HISTORICAL_MIGRATIONS = [
  '001_initial_schema.sql',
  '002_case_core.sql',
  '003_case_idempotency_key_bytes.sql',
  '004_evidence_core.sql',
  '004_identity_binding_runtime.sql',
  '005_case_participant_core.sql',
  '006_case_status_paused_removal.sql',
  '007_case_primary_switch.sql',
  '008_problem_formulation_core.sql',
  '009_safety_hold_control_foundation.sql',
  '010_problem_formulation_safety_vocabulary_reconcile.sql',
  '011_compliance_feature_policy_foundation.sql',
] as const;

const NEW_MIGRATIONS = [
  '012_consent_01004_supplemental_enums.sql',
  '013_consent_01004_supplemental_assessment.sql',
  '014_consent_01004_cross_purpose_supersede_guard.sql',
] as const;

function codeFiles(dir: string, extensions: string[] = ['.ts']): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...codeFiles(full, extensions));
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

/** Extract a top-level function body by brace matching (comments handled). */
function functionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start === -1) throw new Error(`signature not found: ${signature}`);

  let parens = 0;
  let open = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') parens += 1;
    if (ch === ')') parens -= 1;
    if (ch === '{' && parens === 0) {
      open = i;
      break;
    }
  }
  if (open === -1) throw new Error(`body not found: ${signature}`);

  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced body: ${signature}`);
}

describe('Consent owner — single implementation and scope guards', () => {
  it('has exactly one authoritative owner command implementation', () => {
    const productionFiles = [
      ...codeFiles(join(ROOT, 'packages')),
      ...codeFiles(join(ROOT, 'apps')),
    ];
    const declarations = productionFiles.filter((file) =>
      readFileSync(file, 'utf8').includes(
        'export async function recordPurposeScopedConsentDecision('
      )
    );
    expect(declarations).toEqual([OWNER_SEAM]);
  });

  it('keeps an ordinary caller-owned transaction seam (no BEGIN/COMMIT/ROLLBACK/pool/idempotency)', () => {
    const source = readFileSync(OWNER_SEAM, 'utf8');
    const body = functionBody(source, 'export async function recordPurposeScopedConsentDecision(');

    for (const forbidden of [
      /\bBEGIN\b/,
      /\bCOMMIT\b/,
      /\bROLLBACK\b/,
      /runIdempotentCommand/,
      /withRlsTransaction/,
      /withTransactionClient/,
      /withIdentityTransaction/,
      /pool\.connect/,
      /new\s+pg\.Pool/,
      /idempotency_keys/,
    ]) {
      expect(body, String(forbidden)).not.toMatch(forbidden);
    }

    // It must consume the caller's already-joined client and never derive a
    // second subject.
    expect(source).toContain('tx: PurposeScopedConsentTx');
    expect(body).not.toContain('subjectPersonId');
  });

  it('creates no second consent table / ledger', () => {
    const migrationFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
    const createdTables: string[] = [];
    for (const filename of migrationFiles) {
      const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8');
      for (const match of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+)/gi)) {
        createdTables.push(match[1]);
      }
    }
    expect(createdTables).toContain('consent_records');
    expect(createdTables).toContain('guardian_consent_requests');
    for (const forbiddenTable of [
      'supplemental_consents',
      'digital_use_consents',
      'assessment_consents',
    ]) {
      expect(createdTables).not.toContain(forbiddenTable);
    }
  });

  it('edits no historical migration', () => {
    const initial = readFileSync(join(MIGRATIONS_DIR, '001_initial_schema.sql'), 'utf8');
    for (const original of [
      "CREATE TYPE consent_decision AS ENUM ('GRANTED', 'REVOKED');",
      "CREATE TYPE consent_purpose AS ENUM ('UNDER_14_GUARDIAN_CONSENT');",
      'guardian_person_id     uuid NOT NULL',
      'guardian_account_id    uuid NOT NULL',
      'CONSTRAINT consent_request_binding CHECK (',
    ]) {
      expect(initial).toContain(original);
    }
    expect(initial).not.toContain(PURPOSE);
    expect(initial).not.toContain("'DECLINED'");

    for (const filename of HISTORICAL_MIGRATIONS) {
      if (filename === '001_initial_schema.sql') continue;
      const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8');
      expect(sql, filename).not.toContain(PURPOSE);
      expect(sql, filename).not.toContain('consent_supplemental');
    }

    // The two reviewed branch migrations introduce the purpose literal; 014 is a
    // purpose-identity guard and must not add a second purpose vocabulary.
    for (const filename of [
      '012_consent_01004_supplemental_enums.sql',
      '013_consent_01004_supplemental_assessment.sql',
    ]) {
      const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8');
      expect(sql, filename).toContain(PURPOSE);
    }

    const supersedeGuard = readFileSync(
      join(MIGRATIONS_DIR, '014_consent_01004_cross_purpose_supersede_guard.sql'),
      'utf8'
    );
    expect(supersedeGuard).toContain('consent_records_supersede_purpose_guard');
    expect(supersedeGuard).toContain('CONSENT_SUPERSEDE_CROSS_PURPOSE');
    expect(supersedeGuard).not.toContain('CREATE TABLE');
  });

  it('adds no public supplemental consent route', () => {
    const routeDir = join(ROOT, 'apps', 'server', 'api', 'src');
    for (const file of codeFiles(routeDir)) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toContain('supplemental-assessment');
      expect(source, file).not.toContain('/consents/supplemental');
    }

    // No generated public contract entry.
    const openapi = readFileSync(join(ROOT, 'packages', 'generated', 'openapi.json'), 'utf8');
    expect(openapi).not.toContain('supplemental-assessment');
    expect(openapi).not.toContain(PURPOSE);
  });

  it('keeps Consent-owner migrations free of a parallel Scene runtime', () => {
    for (const filename of NEW_MIGRATIONS) {
      const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8');
      for (const forbidden of [
        'scene_node_states',
        'scene_artifacts',
        'CREATE TABLE',
      ]) {
        expect(sql, `${filename}:${forbidden}`).not.toContain(forbidden);
      }
    }

    const owner = readFileSync(OWNER_SEAM, 'utf8');
    expect(owner).not.toContain('scene_node_states');
    expect(owner).not.toContain('scene_artifacts');
    expect(owner).not.toContain('routeDigitalUseTopology');
  });

  it('keeps the purpose literal to the reviewed scope (no generic consent platform)', () => {
    const filesWithPurpose = [
      ...codeFiles(join(ROOT, 'packages')),
      ...codeFiles(join(ROOT, 'apps')),
      ...readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .map((f) => join(MIGRATIONS_DIR, f)),
    ].filter((file) => readFileSync(file, 'utf8').includes(PURPOSE));

    const relative = (file: string) =>
      file.startsWith(ROOT) ? file.slice(ROOT.length) : file;

    expect(filesWithPurpose.map(relative).sort()).toEqual([
      'db/migrations/012_consent_01004_supplemental_enums.sql',
      'db/migrations/013_consent_01004_supplemental_assessment.sql',
      'apps/server/api/src/services/digital-use-node-semantics.ts',
      'packages/compliance/src/evidence.ts',
      'packages/compliance/src/supplemental-assessment-disclosure.ts',
      'packages/compliance/src/supplemental-consent.ts',
      'packages/contracts/src/schemas.ts',
    ].sort());
  });

  it('keeps guardian-only public consent projections guardian-scoped', () => {
    const repository = readFileSync(
      join(ROOT, 'packages', 'compliance', 'src', 'repository.ts'),
      'utf8'
    );
    const listBody = functionBody(repository, 'export async function getConsentsByFamily(');
    expect(listBody).toContain('GUARDIAN_PURPOSE');
    expect(listBody).toContain('purpose = ');
    expect(repository).toContain(
      "const GUARDIAN_PURPOSE = 'UNDER_14_GUARDIAN_CONSENT';"
    );

    const contracts = readFileSync(
      join(ROOT, 'packages', 'contracts', 'src', 'schemas.ts'),
      'utf8'
    );
    expect(contracts).toContain(
      "export const GuardianConsentPurpose = z.enum(['UNDER_14_GUARDIAN_CONSENT']);"
    );
    expect(contracts).toContain(
      "export const GuardianConsentDecision = z.enum(['GRANTED', 'REVOKED']);"
    );
  });
});