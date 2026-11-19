import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getCurrentNoticeHash } from '@xiaoshuyin/compliance';

const ROOT = new URL('../..', import.meta.url).pathname;
const COMMAND_OWNER = 'apps/server/api/src/services/goals.ts';
const TRANSITION_OWNER =
  'db/migrations/026_common_core_goal_confirm_goal_runtime.sql';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|mjs|cjs|sql)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('Common Core Goal authority boundaries', () => {
  it('has exactly one production GOALS -> PLANNING writer', () => {
    const writers: string[] = [];
    for (const root of ['apps', 'packages', 'db/migrations']) {
      for (const full of walk(join(ROOT, root))) {
        const rel = relative(ROOT, full);
        const source = readFileSync(full, 'utf8');
        if (
          /advanceCasePhaseAndVersion\s*\([\s\S]{0,800}?toPhase\s*:\s*['"]PLANNING['"]/.test(source) ||
          /UPDATE\s+cases[\s\S]{0,400}?SET\s+phase\s*=\s*['"]?PLANNING/i.test(source)
        ) writers.push(rel);
      }
    }
    expect(writers).toEqual([TRANSITION_OWNER]);
  });

  it('places the A2010 COMPLETED gate before the owned transition', () => {
    const serviceSource = readFileSync(join(ROOT, COMMAND_OWNER), 'utf8');
    const serviceGate = serviceSource.indexOf("a2010.status !== 'COMPLETED'");
    const serviceTransition = serviceSource.indexOf('confirmGoalTransition(tx');
    expect(serviceGate).toBeGreaterThan(-1);
    expect(serviceTransition).toBeGreaterThan(serviceGate);

    const dbSource = readFileSync(join(ROOT, TRANSITION_OWNER), 'utf8');
    const formalFunction = dbSource.indexOf('CREATE FUNCTION app.confirm_goal_transition');
    const dbGate = dbSource.indexOf("a2010.status='COMPLETED'", formalFunction);
    const dbTransition = dbSource.indexOf('UPDATE cases', formalFunction);
    expect(formalFunction).toBeGreaterThan(-1);
    expect(dbGate).toBeGreaterThan(formalFunction);
    expect(dbTransition).toBeGreaterThan(dbGate);
  });

  it('keeps the privileged transition behind the formal authoritative gates', () => {
    const dbSource = readFileSync(join(ROOT, TRANSITION_OWNER), 'utf8');
    const formalFunction = dbSource.indexOf(
      'CREATE FUNCTION app.confirm_goal_transition'
    );
    const authoritativeWrite = dbSource.indexOf('UPDATE cases', formalFunction);
    expect(formalFunction).toBeGreaterThan(-1);
    expect(authoritativeWrite).toBeGreaterThan(formalFunction);

    for (const marker of [
      'p.account_id=app_account_id()',
      'GOAL_CONFIRM_TRANSITION_EVIDENCE_INVALID',
      'GOAL_CONFIRM_TRANSITION_CONSENT_INVALID',
      'GOAL_CONFIRM_TRANSITION_COMPLIANCE_INVALID',
    ]) {
      const gate = dbSource.indexOf(marker, formalFunction);
      expect(gate, marker).toBeGreaterThan(formalFunction);
      expect(gate, marker).toBeLessThan(authoritativeWrite);
    }

    expect(
      dbSource.slice(formalFunction, authoritativeWrite)
    ).toContain(getCurrentNoticeHash());
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
