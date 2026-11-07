#!/usr/bin/env node
/**
 * coverage-audit.mjs — T069 FR/SC coverage audit.
 *
 * Maps every one of the 17 FR and 8 SC in spec.md to REAL test files.
 * A requirement is "missing" when it has no mapping or any mapped file does
 * not exist / is empty. Exits 1 on any missing coverage.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

const FR = {
  'FR-001': ['tests/integration/auth.test.ts', 'tests/db/schema-structure.test.ts'],
  'FR-002': ['tests/integration/auth.test.ts', 'tests/domain/session-token.test.ts'],
  'FR-003': ['tests/domain/provenance.test.ts', 'tests/integration/members.test.ts'],
  'FR-004': ['tests/integration/members.test.ts', 'tests/db/constraints.test.ts'],
  'FR-005': ['tests/integration/families.test.ts', 'tests/integration/consent-first.test.ts'],
  'FR-006': ['tests/integration/authorization-dimensions.test.ts', 'tests/domain/authorization.test.ts'],
  'FR-007': ['tests/integration/consent-first.test.ts', 'tests/db/consent-structure.test.ts', 'tests/db/schema-structure.test.ts'],
  'FR-008': ['tests/integration/consent-first.test.ts', 'tests/integration/consent-request.test.ts', 'tests/integration/consent-grant.test.ts'],
  'FR-009': ['tests/domain/age-band.test.ts'],
  'FR-010': ['tests/integration/consent-revoke.test.ts', 'tests/db/consent-structure.test.ts'],
  'FR-011': ['tests/integration/authorization.test.ts', 'tests/db/rls.test.ts'],
  'FR-012': ['tests/db/rls.test.ts', 'tests/db/roles.test.ts'],
  'FR-013': ['tests/db/rls.test.ts', 'tests/integration/authorization.test.ts'],
  'FR-014': ['tests/integration/idempotency.test.ts', 'tests/db/idempotency-rls.test.ts', 'tests/domain/idempotency-hash.test.ts'],
  'FR-015': ['tests/db/migration-repro.test.ts', 'tests/db/schema-structure.test.ts'],
  'FR-016': ['tests/db/constraints.test.ts'],
  'FR-017': ['tests/db/constraints.test.ts', 'tests/db/schema-structure.test.ts'],
};

const SC = {
  'SC-001': ['tests/integration/auth.test.ts', 'tests/integration/families.test.ts', 'tests/integration/members.test.ts'],
  'SC-002': ['tests/integration/authorization.test.ts', 'tests/db/rls.test.ts'],
  'SC-003': ['tests/integration/consent-first.test.ts', 'tests/integration/consent-revoke.test.ts'],
  'SC-004': ['tests/domain/age-band.test.ts', 'tests/db/schema-structure.test.ts'],
  'SC-005': ['tests/integration/idempotency.test.ts'],
  'SC-006': ['tests/db/constraints.test.ts', 'tests/db/schema-structure.test.ts'],
  'SC-007': ['tests/db/constraints.test.ts'],
  'SC-008': ['tests/domain/provenance.test.ts', 'tests/integration/members.test.ts'],
};


// ── Slice 2 (002-case-core) ────────────────────────────────
const FR_002 = {
  'FR-001': ['tests/db/cases-schema.test.ts', 'tests/integration/cases-scope.test.ts'],
  'FR-002': ['tests/db/cases-schema.test.ts', 'tests/db/migration-repro.test.ts'],
  'FR-003': ['tests/db/cases-schema.test.ts', 'tests/domain/case-contracts.test.ts'],
  'FR-004': ['tests/integration/cases-create.test.ts'],
  'FR-005': ['tests/integration/cases-scope.test.ts', 'tests/domain/case-authorization.test.ts'],
  'FR-006': ['tests/db/cases-primary-concurrency.test.ts', 'tests/db/cases-schema.test.ts'],
  'FR-007': ['tests/db/cases-primary-concurrency.test.ts', 'tests/integration/cases-create.test.ts'],
  'FR-008': ['tests/integration/cases-authorization.test.ts', 'tests/domain/case-authorization.test.ts'],
  'FR-009': ['tests/domain/case-authorization.test.ts', 'tests/integration/cases-authorization.test.ts'],
  'FR-010': ['tests/integration/cases-read.test.ts', 'tests/db/cases-rls.test.ts'],
  'FR-011': ['tests/db/cases-rls.test.ts', 'tests/db/rls.test.ts'],
  'FR-012': ['tests/integration/cases-idempotency.test.ts', 'tests/domain/idempotency-hash.test.ts'],
  'FR-013': ['tests/integration/cases-create.test.ts', 'tests/domain/case-contracts.test.ts'],
  'FR-014': ['tests/integration/cases-audit.test.ts', 'tests/db/cases-events-metadata.test.ts'],
  'FR-015': ['tests/integration/cases-create.test.ts', 'tests/domain/case-contracts.test.ts'],
  'FR-016': ['tests/integration/cases-read.test.ts', 'tests/domain/case-contracts.test.ts'],
  'FR-017': ['tests/integration/cases-read.test.ts', 'tests/integration/cases-authorization.test.ts'],
  'FR-018': ['tests/integration/cases-scope.test.ts'],
  'FR-019': ['tests/integration/cases-read.test.ts', 'tests/integration/cases-authorization.test.ts'],
  'FR-020': ['tests/integration/cases-scope.test.ts', 'tests/db/cases-schema.test.ts'],
  'FR-021': ['tests/integration/cases-create.test.ts', 'tests/integration/cases-scope.test.ts'],
  'FR-022': ['tests/integration/cases-read.test.ts'],
  'FR-023': ['tests/integration/cases-read.test.ts', 'tests/db/cases-rls.test.ts'],
  'FR-024': ['tests/integration/cases-authorization.test.ts'],
  'FR-025': ['tests/integration/cases-read-no-audit.test.ts'],
};

const SC_002 = {
  'SC-001': ['tests/integration/cases-create.test.ts', 'tests/db/cases-primary-concurrency.test.ts'],
  'SC-002': ['tests/db/cases-primary-concurrency.test.ts', 'tests/integration/cases-idempotency.test.ts'],
  'SC-003': ['tests/integration/cases-create.test.ts', 'tests/domain/case-contracts.test.ts'],
  'SC-004': ['tests/integration/cases-read.test.ts', 'tests/db/cases-rls.test.ts'],
  'SC-005': ['tests/integration/cases-authorization.test.ts'],
  'SC-006': ['tests/integration/cases-idempotency.test.ts', 'tests/domain/idempotency-hash.test.ts'],
  'SC-007': ['tests/integration/cases-audit.test.ts', 'tests/integration/cases-read-no-audit.test.ts'],
  'SC-008': ['tests/integration/cases-scope.test.ts'],
  'SC-009': ['tests/integration/cases-create.test.ts', 'tests/domain/case-contracts.test.ts'],
  'SC-010': ['tests/integration/cases-read.test.ts', 'tests/integration/openapi-cases.test.ts'],
  'SC-011': ['tests/integration/cases-read.test.ts'],
};

// spec.md Acceptance Evidence table (18 rows, in document order).
const ACCEPTANCE_002 = {
  'A01-first-case-open-intake-primary': ['tests/integration/cases-create.test.ts'],
  'A02-candidate-retained': ['tests/integration/cases-create.test.ts'],
  'A03-concurrent-primary-invariant': ['tests/db/cases-primary-concurrency.test.ts'],
  'A04-list-detail-primary': ['tests/integration/cases-read.test.ts'],
  'A05-cross-family-isolation': ['tests/integration/cases-read.test.ts', 'tests/db/cases-rls.test.ts'],
  'A06-no-rls-context-default-deny': ['tests/db/cases-rls.test.ts'],
  'A07-non-manager-denied': ['tests/integration/cases-authorization.test.ts'],
  'A08-guardian-member-non-manager': ['tests/integration/cases-authorization.test.ts'],
  'A09-guardian-non-member': ['tests/integration/cases-authorization.test.ts'],
  'A10-fixed-404-403-semantics': ['tests/integration/cases-authorization.test.ts', 'tests/integration/cases-read.test.ts'],
  'A11-create-idempotency-http': ['tests/integration/cases-idempotency.test.ts'],
  'A12-shared-idempotency-mismatch': ['tests/domain/idempotency-hash.test.ts'],
  'A13-create-event-and-audit': ['tests/integration/cases-audit.test.ts'],
  'A14-read-no-audit': ['tests/integration/cases-read-no-audit.test.ts'],
  'A15-out-of-scope-schema-api': ['tests/integration/cases-scope.test.ts'],
  'A16-strict-422-zero-write': ['tests/integration/cases-create.test.ts'],
  'A17-empty-family': ['tests/integration/cases-read.test.ts'],
  'A18-rls-role-migration-uuidv7': ['tests/db/cases-schema.test.ts', 'tests/db/roles.test.ts', 'tests/db/migration-repro.test.ts'],
};

function fileOk(rel) {
  const full = join(ROOT, rel);
  if (!existsSync(full) || !statSync(full).isFile()) return false;
  const content = readFileSync(full, 'utf-8');
  return content.includes('it(') || content.includes('test(') || content.includes('describe(');
}

let frOk = 0;
let scOk = 0;
const missing = [];

console.log('# T069 — FR / SC Coverage Audit');
console.log('映射目标均为仓库中真实存在且含测试用例的文件。');
console.log('');
console.log('## Functional Requirements (17)');
console.log('');
console.log('| Requirement | Test files | Status |');
console.log('|---|---|---|');
for (const [id, files] of Object.entries(FR)) {
  const bad = files.filter((f) => !fileOk(f));
  if (bad.length > 0) {
    missing.push(`${id}: ${bad.join(', ')}`);
    console.log(`| ${id} | ${files.join(', ')} | MISSING (${bad.join(', ')}) |`);
  } else {
    frOk++;
    console.log(`| ${id} | ${files.join(', ')} | COVERED |`);
  }
}

console.log('');
console.log('## Success Criteria (8)');
console.log('');
console.log('| Criterion | Test files | Status |');
console.log('|---|---|---|');
for (const [id, files] of Object.entries(SC)) {
  const bad = files.filter((f) => !fileOk(f));
  if (bad.length > 0) {
    missing.push(`${id}: ${bad.join(', ')}`);
    console.log(`| ${id} | ${files.join(', ')} | MISSING (${bad.join(', ')}) |`);
  } else {
    scOk++;
    console.log(`| ${id} | ${files.join(', ')} | COVERED |`);
  }
}

// ── Slice 2 report ─────────────────────────────────────────
console.log('');
console.log('# 002-case-core — FR / SC / Acceptance Coverage Audit');
console.log('');
let fr2Ok = 0;
let sc2Ok = 0;
let acc2Ok = 0;
const missing2 = [];

console.log('## Functional Requirements (25)');
console.log('');
console.log('| Requirement | Test files | Status |');
console.log('|---|---|---|');
for (const [id, files] of Object.entries(FR_002)) {
  const bad = files.filter((f) => !fileOk(f));
  if (bad.length > 0) {
    missing2.push(`${id}: ${bad.join(', ')}`);
    console.log(`| ${id} | ${files.join(', ')} | MISSING (${bad.join(', ')}) |`);
  } else {
    fr2Ok++;
    console.log(`| ${id} | ${files.join(', ')} | COVERED |`);
  }
}

console.log('');
console.log('## Success Criteria (11)');
console.log('');
console.log('| Criterion | Test files | Status |');
console.log('|---|---|---|');
for (const [id, files] of Object.entries(SC_002)) {
  const bad = files.filter((f) => !fileOk(f));
  if (bad.length > 0) {
    missing2.push(`${id}: ${bad.join(', ')}`);
    console.log(`| ${id} | ${files.join(', ')} | MISSING (${bad.join(', ')}) |`);
  } else {
    sc2Ok++;
    console.log(`| ${id} | ${files.join(', ')} | COVERED |`);
  }
}

console.log('');
console.log('## Acceptance Evidence (18 rows in spec.md)');
console.log('');
console.log('| Acceptance item | Test files | Status |');
console.log('|---|---|---|');
for (const [id, files] of Object.entries(ACCEPTANCE_002)) {
  const bad = files.filter((f) => !fileOk(f));
  if (bad.length > 0) {
    missing2.push(`${id}: ${bad.join(', ')}`);
    console.log(`| ${id} | ${files.join(', ')} | MISSING (${bad.join(', ')}) |`);
  } else {
    acc2Ok++;
    console.log(`| ${id} | ${files.join(', ')} | COVERED |`);
  }
}

const fr2Total = Object.keys(FR_002).length;
const sc2Total = Object.keys(SC_002).length;
const acc2Total = Object.keys(ACCEPTANCE_002).length;
console.log('');
console.log(`FR ${fr2Ok}/${fr2Total}`);
console.log(`SC ${sc2Ok}/${sc2Total}`);
console.log(`Acceptance ${acc2Ok}/${acc2Total}`);
console.log(`missing = ${missing2.length}`);
if (missing2.length > 0) {
  for (const m of missing2) console.log(`  MISSING ${m}`);
  console.log('coverage-audit: FAIL');
  process.exit(1);
}

const frTotal = Object.keys(FR).length;
const scTotal = Object.keys(SC).length;
console.log('');
console.log(`FR ${frOk}/${frTotal}`);
console.log(`SC ${scOk}/${scTotal}`);
console.log(`missing = ${missing.length}`);
if (missing.length > 0) {
  for (const m of missing) console.log(`  MISSING ${m}`);
  console.log('coverage-audit: FAIL');
  process.exit(1);
}
console.log(`coverage-audit: PASS (FR ${frOk}/${frTotal}, SC ${scOk}/${scTotal}, missing = 0)`);

// ── Slice 3 (003-evidence-core) ────────────────────────────
const FR_003 = {
  'FR-001': ['tests/db/evidence-schema.test.ts', 'tests/domain/evidence-capabilities.test.ts'],
  'FR-002': ['tests/db/evidence-schema.test.ts', 'tests/db/evidence-fks-supersedes.test.ts'],
  'FR-003': ['tests/db/evidence-observation-storage.test.ts', 'tests/domain/evidence-observation.test.ts'],
  'FR-004': ['tests/domain/evidence-provenance.test.ts', 'tests/integration/evidence-write.test.ts'],
  'FR-005': ['tests/db/evidence-observation-storage.test.ts', 'tests/domain/evidence-observation.test.ts'],
  'FR-006': ['tests/domain/evidence-conflict-supersedes.test.ts', 'tests/integration/evidence-write.test.ts'],
  'FR-007': ['tests/db/evidence-fks-supersedes.test.ts', 'tests/domain/evidence-conflict-supersedes.test.ts'],
  'FR-008': ['tests/db/evidence-fact-guard.test.ts', 'tests/domain/evidence-capabilities.test.ts'],
  'FR-009': ['tests/integration/messages-create.test.ts', 'tests/integration/openapi-evidence.test.ts'],
  'FR-010': ['tests/integration/messages-authorization.test.ts', 'tests/integration/messages-authorization-before-replay.test.ts'],
  'FR-011': ['tests/db/evidence-rls-grants.test.ts', 'tests/db/evidence-fact-guard.test.ts'],
  'FR-012': ['tests/integration/evidence-scope.test.ts', 'tests/domain/evidence-capabilities.test.ts'],
  'FR-013': ['tests/integration/openapi-evidence.test.ts', 'tests/integration/messages-create.test.ts'],
  'FR-014': ['tests/integration/evidence-scope.test.ts', 'tests/domain/evidence-conflict-supersedes.test.ts'],
  'FR-015': ['tests/integration/openapi-evidence.test.ts', 'tests/integration/evidence-scope.test.ts'],
  'FR-016': ['tests/domain/evidence-provenance.test.ts', 'tests/domain/evidence-person-reference.test.ts'],
  'FR-017': ['tests/integration/messages-idempotency.test.ts', 'tests/db/evidence-audit-idempotency.test.ts'],
  'FR-018': ['tests/integration/messages-authorization.test.ts', 'tests/integration/evidence-scope.test.ts'],
  'FR-019': ['tests/integration/messages-create.test.ts', 'tests/domain/evidence-person-reference.test.ts'],
  'FR-020': ['tests/integration/evidence-scope.test.ts', 'tests/db/migration-repro.test.ts'],
  'FR-021': ['tests/db/evidence-fks-supersedes.test.ts', 'tests/domain/evidence-person-reference.test.ts'],
};

const SC_003 = {
  'SC-001': ['tests/db/evidence-schema.test.ts', 'tests/domain/evidence-capabilities.test.ts'],
  'SC-002': ['tests/domain/evidence-provenance.test.ts', 'tests/integration/evidence-write.test.ts'],
  'SC-003': ['tests/domain/evidence-conflict-supersedes.test.ts', 'tests/integration/evidence-write.test.ts'],
  'SC-004': ['tests/db/evidence-observation-storage.test.ts', 'tests/domain/evidence-observation.test.ts'],
  'SC-005': ['tests/db/evidence-fks-supersedes.test.ts', 'tests/domain/evidence-conflict-supersedes.test.ts'],
  'SC-006': ['tests/db/evidence-rls-grants.test.ts', 'tests/integration/messages-authorization.test.ts'],
  'SC-007': ['tests/integration/messages-create.test.ts', 'tests/integration/evidence-scope.test.ts'],
  'SC-008': ['tests/integration/evidence-scope.test.ts', 'tests/integration/openapi-evidence.test.ts'],
  'SC-009': ['tests/domain/evidence-provenance.test.ts', 'tests/domain/evidence-conflict-supersedes.test.ts'],
  'SC-010': ['tests/integration/evidence-scope.test.ts', 'tests/db/migration-repro.test.ts'],
};

const ACCEPTANCE_003 = {
  'A01-message-raw-only-zero-assertion': ['tests/integration/messages-create.test.ts'],
  'A02-guardian-relay-stays-statement': ['tests/integration/evidence-write.test.ts', 'tests/domain/evidence-provenance.test.ts'],
  'A03-conflict-no-winner': ['tests/integration/evidence-write.test.ts', 'tests/domain/evidence-conflict-supersedes.test.ts'],
  'A04-unknown-states-roundtrip': ['tests/db/evidence-observation-storage.test.ts', 'tests/domain/evidence-observation.test.ts'],
  'A05-hypothesis-cannot-become-fact': ['tests/domain/evidence-capabilities.test.ts', 'tests/db/evidence-fact-guard.test.ts', 'tests/db/evidence-rls-grants.test.ts'],
  'A06-supersedes-keeps-old-history': ['tests/db/evidence-fks-supersedes.test.ts', 'tests/integration/evidence-write.test.ts'],
  'A07-cross-family-isolation': ['tests/integration/messages-authorization.test.ts', 'tests/db/evidence-rls-grants.test.ts'],
  'A08-provenance-traceability': ['tests/db/evidence-schema.test.ts', 'tests/domain/evidence-provenance.test.ts'],
  'A09-only-approved-message-post': ['tests/integration/openapi-evidence.test.ts', 'tests/integration/evidence-scope.test.ts'],
  'A10-observation-separate-from-assertion': ['tests/db/evidence-schema.test.ts', 'tests/db/evidence-observation-storage.test.ts'],
  'A11-ai-extractor-cannot-confirm-fact': ['tests/domain/evidence-capabilities.test.ts', 'tests/domain/evidence-provenance.test.ts'],
  'A12-dependency-gate-blocked': ['tests/integration/evidence-scope.test.ts', 'tests/db/migration-repro.test.ts'],
  'A13-family-a-cannot-reference-family-b-person': ['tests/domain/evidence-person-reference.test.ts', 'tests/db/evidence-fks-supersedes.test.ts'],
};

function auditSlice3() {
  console.log('');
  console.log('# 003-evidence-core — FR / SC / Acceptance / Checklist Coverage Audit');
  console.log('');

  const missing3 = [];
  let fr3Ok = 0;
  let sc3Ok = 0;
  let acc3Ok = 0;

  const table = (label, entries, onOk) => {
    console.log(`## ${label}`);
    console.log('');
    console.log('| Item | Test files | Status |');
    console.log('|---|---|---|');
    for (const [id, files] of Object.entries(entries)) {
      const bad = files.filter((f) => !fileOk(f));
      if (bad.length > 0) {
        missing3.push(`${id}: ${bad.join(', ')}`);
        console.log(`| ${id} | ${files.join(', ')} | MISSING (${bad.join(', ')}) |`);
      } else {
        onOk();
        console.log(`| ${id} | ${files.join(', ')} | COVERED |`);
      }
    }
    console.log('');
  };

  table('Functional Requirements (21)', FR_003, () => { fr3Ok++; });
  table('Success Criteria (10)', SC_003, () => { sc3Ok++; });
  table('Acceptance Scenarios (13)', ACCEPTANCE_003, () => { acc3Ok++; });

  const checklistPath = join(
    ROOT,
    'specs',
    '003-evidence-core',
    'checklists',
    'requirements-quality.md'
  );
  const checklist = readFileSync(checklistPath, 'utf-8');
  const checked = [...checklist.matchAll(/^- \[x\] CHK(\d{3})/gm)].length;
  const chkTotal = 115;
  if (checked !== chkTotal) missing3.push(`Checklist: ${checked}/${chkTotal}`);

  console.log(`FR ${fr3Ok}/${Object.keys(FR_003).length}`);
  console.log(`SC ${sc3Ok}/${Object.keys(SC_003).length}`);
  console.log(`Acceptance ${acc3Ok}/${Object.keys(ACCEPTANCE_003).length}`);
  console.log(`Checklist ${checked}/${chkTotal}`);
  console.log(`missing = ${missing3.length}`);
  if (missing3.length > 0) {
    for (const m of missing3) console.log(`  MISSING ${m}`);
    console.log('coverage-audit (003): FAIL');
    process.exitCode = 1;
  } else {
    console.log('coverage-audit (003): PASS');
  }
}

auditSlice3();
