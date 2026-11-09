/**
 * F-08 / T115 / MEDIUM-03 — coverage audit is substantive and fails closed.
 *
 * A proof is only accepted when all of the following hold:
 *   exact test name + still-executable body + required assertion(s)
 *   + executed PASS evidence.
 *
 * Empty `it('name', () => {})`, assertion removal, unexecuted tests and mapping
 * to an unrelated passing test must all make the audit fail closed.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// @ts-expect-error - plain .mjs verification helper without type declarations
import {
  audit,
  fileOk,
  proofOk,
  SUBSTANTIVE_PROOFS,
} from '../../scripts/coverage-audit.mjs';

const ROOT = process.cwd();

function fullExecution() {
  return {
    testResults: Object.values(SUBSTANTIVE_PROOFS as Record<string, { file: string; test: string }>).map(
      (proof) => ({
        name: `/repo/${proof.file}`,
        assertionResults: [
          { title: proof.test, fullName: `suite > ${proof.test}`, status: 'passed' },
        ],
      })
    ),
  };
}

function executionFor(file: string, test: string, status = 'passed') {
  return {
    testResults: [
      {
        name: `/repo/${file}`,
        assertionResults: [{ title: test, fullName: `suite > ${test}`, status }],
      },
    ],
  };
}

function writeFixture(name: string, content: string) {
  const dir = mkdtempSync(join(tmpdir(), 'coverage-proof-'));
  mkdirSync(join(dir, 'tests', 'integration'), { recursive: true });
  writeFileSync(join(dir, 'tests', 'integration', name), content);
  return { dir, rel: `tests/integration/${name}` };
}

describe('coverage audit substantive gate (T115 / MEDIUM-03)', () => {
  it('the real repository satisfies every mapping with executed PASS evidence', () => {
    const result = audit(ROOT, { execution: fullExecution() });
    expect(result.missing).toEqual([]);
    const labels = result.sections.map((s: { label: string }) => s.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Slice 5 FR',
        'Slice 5 SC',
        'Slice 5 Acceptance',
        'Slice 5 Findings',
        'Slice 5 Reopened Tasks',
        'Slice 5 Substantive Proofs',
      ])
    );
    expect(result.missing).toEqual([]);
  });

  it('fileOk rejects a missing or empty test file', () => {
    const { dir } = writeFixture('empty.test.ts', '// no test cases here\n');
    expect(fileOk('tests/integration/does-not-exist.test.ts', dir)).toBe(false);
    expect(fileOk('tests/integration/empty.test.ts', dir)).toBe(false);

    const real = join(dir, 'tests', 'integration', 'real.test.ts');
    writeFileSync(real, "describe('x', () => { it('y', () => {}); });\n");
    expect(fileOk('tests/integration/real.test.ts', dir)).toBe(true);
  });

  it('A: assertion removal fails closed (empty test body)', () => {
    const { dir, rel } = writeFixture(
      'empty-assertion.test.ts',
      "it('required proof H-01', () => {});\n"
    );
    const result = proofOk(
      rel,
      { id: 'plain-proof', test: 'required proof H-01' },
      dir,
      executionFor(rel, 'required proof H-01')
    );
    expect(result).toEqual({ ok: false, reason: 'no-assertion' });
  });

  it('B: mapping to an unrelated passing test fails closed', () => {
    const { dir, rel } = writeFixture(
      'unrelated.test.ts',
      "it('unrelated passing proof', () => { expect(1).toBe(1); });\n"
    );
    // H-02 requires helper assertions that the unrelated proof does not carry.
    const result = proofOk(
      rel,
      { id: 'H-02-profile-age-barrier', test: 'unrelated passing proof' },
      dir,
      executionFor(rel, 'unrelated passing proof')
    );
    expect(result).toEqual({ ok: false, reason: 'helper-assertion-removed' });
  });

  it('C: existing test without executed PASS evidence is unexecuted', () => {
    const { dir, rel } = writeFixture(
      'not-executed.test.ts',
      "it('required proof H-01', () => { expect(1).toBe(1); });\n"
    );
    const result = proofOk(
      rel,
      { id: 'plain-proof', test: 'required proof H-01' },
      dir,
      executionFor(rel, 'another test')
    );
    expect(result).toEqual({ ok: false, reason: 'unexecuted' });
  });

  it('D: mapping + assertion + executed PASS evidence passes', () => {
    const { dir, rel } = writeFixture(
      'good.test.ts',
      "it('required proof H-01', () => { expect(1).toBe(1); });\n"
    );
    const result = proofOk(
      rel,
      { id: 'plain-proof', test: 'required proof H-01' },
      dir,
      executionFor(rel, 'required proof H-01')
    );
    expect(result).toEqual({ ok: true });
  });

  it('delete / rename / skip remain fail-closed', () => {
    const { dir, rel } = writeFixture(
      'proof.test.ts',
      "it('required proof H-01', () => { expect(1).toBe(1); });\n"
    );
    const execution = executionFor(rel, 'required proof H-01');

    expect(
      proofOk(rel, { id: 'plain-proof', test: 'required proof H-01' }, dir, execution).ok
    ).toBe(true);
    expect(
      proofOk(rel, { id: 'plain-proof', test: 'renamed proof' }, dir, execution).ok
    ).toBe(false);

    writeFileSync(
      join(dir, rel),
      "it.skip('required proof H-01', () => { expect(1).toBe(1); });\n"
    );
    expect(
      proofOk(rel, { id: 'plain-proof', test: 'required proof H-01' }, dir, execution).ok
    ).toBe(false);

    expect(
      proofOk('tests/integration/missing.test.ts', { id: 'plain-proof', test: 'required proof H-01' }, dir, execution).ok
    ).toBe(false);
  });

  it('every required H-01 / H-02 / M-01 / MEDIUM-01 direct proof is individually mapped', () => {
    const required = [
      'H-01-exact-byte-replay',
      'H-01-valid-decoy',
      'H-01-challenge-envelope',
      'H-01-confirmer-exact-binding',
      'H-01-rotation-new-bytes',
      'H-01-old-issuance-invalid',
      'H-01-consumed-new-key-404',
      'H-01-same-key-rotated-409',
      'H-01-two-confirmer-concurrency',
      'H-02-profile-age-barrier',
      'H-02-profile-missing-barrier',
      'H-02-consent-barrier',
      'H-02-guardian-barrier',
      'H-02-membership-authority-barrier',
      'H-02-P1-conflict-barrier',
      'H-02-candidate-account-conflict',
      'H-02-invitation-seam',
      'M-01-profile',
      'M-01-age-band',
      'M-01-guardian',
      'M-01-consent',
      'M-01-membership',
      'M-01-invitation',
      'M-01-P1-conflict',
      'M-01-candidate-account-conflict',
      'MEDIUM-01-replay-committed',
      'MEDIUM-01-replay-terminal',
      'MEDIUM-01-replay-pending-continuation',
      'MEDIUM-01-replay-payload-mismatch',
    ];
    const keys = Object.keys(SUBSTANTIVE_PROOFS);
    for (const id of required) expect(keys, id).toContain(id);
  });

  it('deleting one required proof fails the audit closed', () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), 'coverage-audit-empty-'));
    const result = audit(emptyRoot, { execution: fullExecution() });
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.missing).toEqual(
      expect.arrayContaining([
        expect.stringContaining('F-01'),
        expect.stringContaining('F-08'),
        expect.stringContaining('T115'),
      ])
    );
  });

  it('audit fails closed when execution evidence is absent', () => {
    const result = audit(ROOT, { execution: null });
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.missing.some((m: string) => m.includes('unexecuted-no-evidence'))).toBe(true);
  });
});