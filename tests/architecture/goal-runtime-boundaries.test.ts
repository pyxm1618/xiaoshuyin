import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;
const OWNER = 'apps/server/api/src/services/goals.ts';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('Common Core Goal authority boundaries', () => {
  it('has exactly one production GOALS -> PLANNING writer', () => {
    const writers: string[] = [];
    for (const root of ['apps', 'packages']) {
      for (const full of walk(join(ROOT, root))) {
        const rel = relative(ROOT, full);
        const source = readFileSync(full, 'utf8');
        if (
          /advanceCasePhaseAndVersion\s*\([\s\S]{0,800}?toPhase\s*:\s*['"]PLANNING['"]/.test(source) ||
          /UPDATE\s+cases[\s\S]{0,400}?SET\s+phase\s*=\s*['"]?PLANNING/i.test(source)
        ) writers.push(rel);
      }
    }
    expect(writers).toEqual([OWNER]);
  });

  it('places the A2010 COMPLETED gate before the owned transition', () => {
    const source = readFileSync(join(ROOT, OWNER), 'utf8');
    const gate = source.indexOf("a2010.status !== 'COMPLETED'");
    const transition = source.indexOf("toPhase: 'PLANNING'");
    expect(gate).toBeGreaterThan(-1);
    expect(transition).toBeGreaterThan(gate);
  });

  it('registers only the single public Goal mutation endpoint', () => {
    const source = readFileSync(
      join(ROOT, 'apps/server/api/src/routes/goals.ts'),
      'utf8'
    );
    expect([...source.matchAll(/app\.(?:post|put|patch|delete)\s*\(/g)]).toHaveLength(1);
    expect(source).toContain("'/api/v1/cases/:id/goals'");
    expect(source).not.toMatch(/confirm-goal|\/goals\/:goalId\/confirm|confirm\s*:\s*z\.boolean/);
  });
});
