/**
 * T917 — Slice 8 integration seam.
 *
 * Slice 8 (Problem Formulation) is NOT merged on this baseline. Per the frozen
 * plan, Slice 9 therefore exposes a stable shared guard and records the exact
 * six-command contract instead of inventing placeholder commands.
 *
 * If Slice 8 lands later, the same guard must be called after its Family/Case
 * lock/re-read and before any progression write:
 *   authorized/replay → Family lock → Case lock/re-read → guard → writes
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as domain from '../../packages/domain/src/index.js';

const ROOT = new URL('../..', import.meta.url).pathname;

/** Frozen Slice 8 ordinary write commands (plan §1.3 / §15). */
const SLICE8_ORDINARY_COMMANDS = [
  'StartAssessment',
  'PresentProblemFormulation',
  'ConfirmProblemFormulation',
  'DisputeProblemFormulation',
  'CorrectProblemFormulation',
  'ReassessFromFormulation',
] as const;

function walk(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const productionFiles = [
  ...walk(join(ROOT, 'apps'), []),
  ...walk(join(ROOT, 'packages'), []),
].filter((file) => /\.(ts|mjs|js)$/.test(file));

function read(file: string): string {
  return readFileSync(file, 'utf-8');
}

describe('T917 Slice 8 integration seam', () => {
  it('exports both guard accessors from the production domain entry', () => {
    expect(typeof domain.assertOrdinaryProgressionAllowed).toBe('function');
    expect(typeof domain.assertOrdinaryProgressionAllowedRaw).toBe('function');
    expect(typeof domain.decideOrdinaryProgression).toBe('function');
  });

  it('records the six Slice 8 ordinary commands and their fixed guard point', () => {
    expect(SLICE8_ORDINARY_COMMANDS).toHaveLength(6);
    // The seam is documented in the guard contract consumed by Slice 8.
    const guard = read(join(ROOT, 'packages/domain/src/safety/guard.ts'));
    expect(guard).toContain('assertOrdinaryProgressionAllowedRaw');
    // Machine error vocabulary is shared.
    expect(guard).toContain('SAFETY_HOLD_BLOCKED');
  });

  it('does not pre-implement Slice 8 runtime or duplicate its commands', () => {
    for (const file of productionFiles) {
      const rel = relative(ROOT, file);
      const content = read(file);
      for (const command of SLICE8_ORDINARY_COMMANDS) {
        expect(content, `${rel} must not implement ${command}`).not.toContain(command);
      }
    }
    // No Problem Formulation migration exists on this baseline.
    const migrations = readdirSync(join(ROOT, 'db/migrations'));
    expect(migrations.filter((name) => /problem.?formulation/i.test(name))).toHaveLength(0);
  });

  it('keeps the guard usable by an external ordinary-progression command', async () => {
    // Pure policy is callable without any Slice 8 runtime.
    expect(domain.decideOrdinaryProgression('SAFETY_HOLD')).toEqual({
      allowed: false,
      code: 'SAFETY_HOLD_BLOCKED',
    });
    expect(domain.decideOrdinaryProgression('OPEN')).toEqual({ allowed: true });
  });
});