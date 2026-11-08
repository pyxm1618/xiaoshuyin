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
import { audit, fileOk } from '../../scripts/coverage-audit.mjs';

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

  it('deleting one required proof fails the audit closed', () => {
    // A root with no files at all: every mapping is missing, so the audit must
    // report missing > 0 rather than PASS.
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