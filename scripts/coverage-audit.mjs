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
