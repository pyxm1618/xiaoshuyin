import { afterEach, describe, expect, it } from 'vitest';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  FROZEN_FEATURE_REQUIRED_ARTIFACTS,
  REVIEWED_FROZEN_FEATURE_SETS,
  isExactReviewedFrozenFeatureSet,
} from '../../.specify/scripts/frozen-feature-compatibility.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const FEATURE =
  '016-psychological-behavioral-intervention-contract-authority-reconciliation';
const DIR = 'specs/' + FEATURE;
const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function tempFrozenCopy(): { root: string; dir: string } {
  const root = mkdtempSync(join(tmpdir(), 's16-governance-'));
  tempRoots.push(root);
  const dir = join(root, DIR);
  cpSync(resolve(ROOT, DIR), dir, { recursive: true });
  return { root, dir: DIR };
}

describe('Slice 16 frozen governance compatibility lookup', () => {
  it('accepts only the exact explicitly registered Slice16 four-blob set', () => {
    expect(
      isExactReviewedFrozenFeatureSet(ROOT, FEATURE, DIR)
    ).toBe(true);
    expect([...REVIEWED_FROZEN_FEATURE_SETS.keys()]).toEqual([FEATURE]);
    expect([...FROZEN_FEATURE_REQUIRED_ARTIFACTS].sort()).toEqual(
      ['checklist.md', 'plan.md', 'spec.md', 'tasks.md']
    );
  });

  it('rejects prototype/inherited-key names and ordinary unknown feature names', () => {
    for (const featureName of [
      'constructor',
      'toString',
      'valueOf',
      '__proto__',
      'hasOwnProperty',
      '016-nearby-but-not-registered',
    ]) {
      expect(
        isExactReviewedFrozenFeatureSet(ROOT, featureName, DIR),
        featureName
      ).toBe(false);
    }
  });

  it('rejects missing, empty, partial and malformed expected artifact maps', () => {
    const exact = REVIEWED_FROZEN_FEATURE_SETS.get(FEATURE)!;
    const cases = [
      new Map(),
      new Map([[FEATURE, {}]]),
      new Map([[FEATURE, { 'spec.md': exact['spec.md'] }]]),
      new Map([[
        FEATURE,
        {
          ...exact,
          'tasks.md': '',
        },
      ]]),
      new Map([[
        FEATURE,
        {
          ...exact,
          'tasks.md': 'not-a-git-blob-sha',
        },
      ]]),
      new Map([[
        FEATURE,
        {
          ...exact,
          'extra.md': '0'.repeat(40),
        },
      ]]),
    ] as const;

    for (const registry of cases) {
      expect(
        isExactReviewedFrozenFeatureSet(
          ROOT,
          FEATURE,
          DIR,
          registry as Map<string, Record<string, string>>
        )
      ).toBe(false);
    }
  });

  it('falls back strictly on any single-byte drift in the frozen artifacts', () => {
    for (const name of FROZEN_FEATURE_REQUIRED_ARTIFACTS) {
      const { root, dir } = tempFrozenCopy();
      const path = join(root, dir, name);
      const original = readFileSync(path);
      const mutated = Buffer.concat([original, Buffer.from(' ')]);
      writeFileSync(path, mutated);
      expect(
        isExactReviewedFrozenFeatureSet(root, FEATURE, dir),
        name
      ).toBe(false);
    }
  });
});
