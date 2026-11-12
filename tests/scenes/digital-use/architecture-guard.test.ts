import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

describe('Slice 11 static architecture guard', () => {
  it('accepts the canonical repository architecture', () => {
    const result = spawnSync(process.execPath, ['scripts/guard-static.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout + result.stderr).toContain('guard-static: PASS');
  });

  it('detects cross-tree second truth bypasses without flagging isolated node references', () => {
    const result = spawnSync(process.execPath, ['scripts/guard-static.mjs', '--self-test'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout + result.stderr).toContain('guard-static self-test: PASS');
    expect(result.stdout + result.stderr).toContain('synthetic fixtures validated');
  });
});
