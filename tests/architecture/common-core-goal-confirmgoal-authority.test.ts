import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const AUTHORITY = 'Docs/V1技术设计.md';
const SPEC = 'specs/common-core-goal-confirmgoal-runtime/spec.md';
const PLAN = 'specs/common-core-goal-confirmgoal-runtime/plan.md';

describe('Common Core Goal / ConfirmGoal authority projection', () => {
  const authority = readFileSync(AUTHORITY, 'utf8');
  const spec = readFileSync(SPEC, 'utf8');
  const plan = readFileSync(PLAN, 'utf8');
  const domainCommandsSection = authority.split('## 23. Domain Commands')[1]?.split('## 24. Follow-up Schedule')[0] ?? '';
  const transportAuthority = domainCommandsSection.split('**Goal SAVE / ConfirmGoal transport authority**')[1] ?? '';

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
  it('keeps one public Goal endpoint with an explicit SAVE or CONFIRM discriminator', () => {
    expect(transportAuthority).toContain(
      '唯一 public Goal mutation endpoint 保持为 `POST /api/v1/cases/:id/goals`'
    );
    expect(transportAuthority.match(/POST \/api\/v1\/cases\/:id\/goals/g) ?? []).toHaveLength(1);
    expect(transportAuthority).toContain('必填 `operation` 为 discriminator');
    expect(transportAuthority).toContain('唯一允许值为 `SAVE` 与 `CONFIRM`');
    expect(spec).toContain(
      'the only public Goal mutation endpoint is `POST /api/v1/cases/:id/goals`'
    );
    expect(spec).toContain('required `operation = SAVE | CONFIRM`');
    expect(plan).toContain('Use only the Authority-listed `POST /api/v1/cases/:id/goals` capability.');
    expect(plan).toContain('No second Goal confirmation endpoint is permitted.');
  });

  it('keeps SAVE as unconfirmed persistence with no ConfirmGoal or phase advancement', () => {
    expect(transportAuthority).toContain('`operation = "SAVE"`');
    expect(transportAuthority).toContain('持久化并返回精确 Goal identity/version');
    expect(transportAuthority).toContain('不得执行 `ConfirmGoal`');
    expect(transportAuthority).toContain('不得推进 Case phase');
    expect(transportAuthority).toContain('Case 必须保持 `GOALS`');
    expect(plan).toContain('persist unconfirmed Goal/version bound to that formulation');
    expect(plan).toContain('do not execute ConfirmGoal');
    expect(plan).toContain('Case remains GOALS');
  });

  it('keeps CONFIRM bound to an exact persisted Goal/version without Goal mutation', () => {
    expect(transportAuthority).toContain(
      '`operation = "CONFIRM"` 只表示对一个已经持久化的精确 Goal/version 执行正式 `ConfirmGoal`'
    );
    expect(transportAuthority).toContain('request 必须显式携带 `goalId` 与 `goalVersion`');
    expect(transportAuthority).toContain('不得在 CONFIRM payload 中修改 Goal contract');
    expect(plan).toContain('read explicit exact persisted goalId + goalVersion');
    expect(plan).toContain(
      'reject any attempt to create, save, or mutate Goal contract content in the CONFIRM payload'
    );
    expect(plan).toContain('execute the formal ConfirmGoal gates and one atomic transaction');
  });

  it('forbids implicit or automatic confirmation semantics', () => {
    expect(transportAuthority).toContain(
      '不得根据字段是否存在、`goalId` 是否存在、同一 POST 是否第二次调用，或 `confirm: true/false` 推断意图'
    );
    expect(spec).toContain('implicit field-presence inference');
    expect(spec).toContain('`goalId`-presence inference');
    expect(spec).toContain('second-call inference');
    expect(spec).toContain('`confirm: true/false`');
    expect(spec).toContain('automatic confirmation of a complete Goal');
    expect(spec).toContain('any second public Goal confirmation endpoint are forbidden');
  });
});
