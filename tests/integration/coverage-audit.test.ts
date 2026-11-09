/**
 * F-08 / T115 — coverage audit is substantive and fails closed.
 *
 * The audit must map every Slice-5 FR / SC / Acceptance item and every
 * Ultimate Audit finding to a real, non-empty test file. Deleting any required
 * proof (or pointing it at a non-test file) must make the audit return missing
 * entries instead of silently passing on total file counts.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// @ts-expect-error - plain .mjs verification helper without type declarations
import { audit, fileOk, proofOk, SUBSTANTIVE_PROOFS } from '../../scripts/coverage-audit.mjs';

const ROOT = process.cwd();

describe('coverage audit substantive gate (T115)', () => {
  it('the real repository satisfies every Slice 1/2/5 mapping', () => {
    const result = audit(ROOT);
    expect(result.missing).toEqual([]);
    const labels = result.sections.map((s: { label: string }) => s.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Slice 5 FR',
        'Slice 5 SC',
        'Slice 5 Acceptance',
        'Slice 5 Findings',
        'Slice 5 Reopened Tasks',
      ])
    );
  });

  it('fileOk rejects a missing or empty test file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'coverage-audit-'));
    mkdirSync(join(dir, 'tests', 'integration'), { recursive: true });
    expect(fileOk('tests/integration/does-not-exist.test.ts', dir)).toBe(false);

    const empty = join(dir, 'tests', 'integration', 'empty.test.ts');
    writeFileSync(empty, '// no test cases here\n');
    expect(fileOk('tests/integration/empty.test.ts', dir)).toBe(false);

    const real = join(dir, 'tests', 'integration', 'real.test.ts');
    writeFileSync(real, "describe('x', () => { it('y', () => {}); });\n");
    expect(fileOk('tests/integration/real.test.ts', dir)).toBe(true);
  });

  it('proofOk fails closed on delete / rename / unexecute / unrelated proof', () => {
    const dir = mkdtempSync(join(tmpdir(), 'coverage-proof-'));
    mkdirSync(join(dir, 'tests', 'integration'), { recursive: true });
    const proof = join(dir, 'tests', 'integration', 'proof.test.ts');
    writeFileSync(proof, "it('required proof H-01', () => {});\n");

    // Exact required proof executes.
    expect(proofOk('tests/integration/proof.test.ts', 'required proof H-01', dir)).toBe(true);

    // Rename / unrelated proof.
    expect(proofOk('tests/integration/proof.test.ts', 'renamed proof', dir)).toBe(false);
    expect(proofOk('tests/integration/proof.test.ts', 'unrelated passing proof', dir)).toBe(false);

    // Unexecute.
    writeFileSync(proof, "it.skip('required proof H-01', () => {});\n");
    expect(proofOk('tests/integration/proof.test.ts', 'required proof H-01', dir)).toBe(false);

    // Delete.
    expect(proofOk('tests/integration/missing.test.ts', 'required proof H-01', dir)).toBe(false);
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
    const result = audit(emptyRoot);
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.missing).toEqual(
      expect.arrayContaining([
        expect.stringContaining('F-01'),
        expect.stringContaining('F-08'),
        expect.stringContaining('T115'),
      ])
    );
  });
});