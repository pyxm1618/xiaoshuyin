import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

describe('Slice 16 frozen governance closed-key compatibility', () => {
  it('rejects inherited names, missing/partial maps and byte drift while exact Slice 16 passes', () => {
    const result = spawnSync(
      process.execPath,
      ['.specify/scripts/frozen-feature-compatibility-self-test.mjs'],
      { cwd: ROOT, encoding: 'utf8' }
    );
    expect(
      result.status,
      [result.stdout, result.stderr].filter(Boolean).join('\n')
    ).toBe(0);
    expect(result.stdout).toContain(
      'Slice 16 frozen feature compatibility self-test PASS'
    );
  });
});
