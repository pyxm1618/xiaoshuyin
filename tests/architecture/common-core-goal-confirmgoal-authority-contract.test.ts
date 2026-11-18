import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PRODUCT = readFileSync('Docs/V1产品需求.md', 'utf8');
const TECH = readFileSync('Docs/V1技术设计.md', 'utf8');
const SPEC = readFileSync('specs/common-core-goal-confirmgoal-runtime-prerequisite/spec.md', 'utf8');

describe('Common Core Goal / ConfirmGoal authority topology', () => {
  it('projects the formal V1 Goal contract without redesigning it', () => {
    expect(PRODUCT).toContain('## 2.6 Goal 合同');
    for (const phrase of [
      '当前基线',
      '希望发生的变化',
      '怎样观察变化',
      '观察窗口',
      '关键保护条件',
      '家长自身行动',
      '复盘节点',
    ]) {
      expect(PRODUCT).toContain(phrase);
    }
    expect(SPEC).toContain('GCR-001 Goal completeness');
    expect(SPEC).toContain('GCR-002 Formulation binding');
  });

  it('binds GOALS to PLANNING only through ConfirmGoal', () => {
    expect(TECH).toContain('| GOALS | ConfirmGoal | Goal 合同完整；Safety 未阻断 | PLANNING |');
    expect(TECH).toContain('正式 advancement command 仍是既有 `ConfirmGoal`');
    expect(TECH).toContain('A2010 solution-stage prerequisites 完成是“允许提交/执行 ConfirmGoal”的 server-side trigger prerequisite');
    expect(TECH).toContain('Scene service 不得自己维护影子 phase');
    expect(SPEC).toContain('GCR-007 Single phase authority');
    expect(SPEC).toContain('GCR-020 No fabrication');
  });

  it('keeps the prerequisite bounded to Goal persistence and ConfirmGoal', () => {
    expect(SPEC).toContain('## Explicit Out of Scope');
    expect(SPEC).toContain('Plan persistence/runtime');
    expect(SPEC).toContain('PR #70');
    expect(SPEC).toContain('Authority Docs remain read-only');
  });
});
