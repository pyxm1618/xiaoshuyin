import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const AUTHORITY = 'Docs/V1技术设计.md';
const SPEC = 'specs/common-core-goal-confirmgoal-runtime/spec.md';

describe('Common Core Goal / ConfirmGoal authority projection', () => {
  const authority = readFileSync(AUTHORITY, 'utf8');
  const spec = readFileSync(SPEC, 'utf8');

  it('keeps ConfirmGoal as the formal GOALS to PLANNING command', () => {
    const domainCommands = authority.split('## 23. Domain Commands')[1]?.split('## 24. Follow-up Schedule')[0] ?? '';

    expect(domainCommands).toContain('ConfirmGoal');
    expect(domainCommands).toContain(
      '`ConfirmGoal` 是唯一 `GOALS → PLANNING` advancement command'
    );
  });

  it('keeps A2010 completion as eligibility rather than a phase writer', () => {
    expect(authority).toContain(
      'A2010 solution-stage prerequisites 完成是“允许提交/执行 ConfirmGoal”的 server-side trigger prerequisite，不是第二个 phase writer。'
    );
    expect(authority).toContain('A2010/Scene 只能触发 eligibility，不拥有 phase write');
  });

  it('projects the current Goal requirements into a stable verification artifact', () => {
    expect(spec).toContain('## Requirements');
    expect(spec).toContain('**GCR-005 — ConfirmGoal gate:**');
    expect(spec).toContain(
      'A2010 completion is an eligibility prerequisite only; it is not a phase writer.'
    );
    expect(spec).toContain('**GCR-006 — Single phase writer:**');
    expect(spec).toContain(
      'only the Common Core owner executing `ConfirmGoal` may perform `GOALS -> PLANNING`'
    );
  });
});
