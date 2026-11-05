# Contract — Evidence Provenance / Conflict / Validity

**Slice**: 003-evidence-core  
**Status**: Plan contract

## 1. Source is Per Evidence Item

来源属于每条 Assertion / Observation，不属于 Person，也不属于 Case 全局。

不得：

- 因 Person 有 Account → 自动 SELF_STATEMENT；
- 因 source是guardian → 自动GUARDIAN_RELAY；
- 因模型高置信 → SOURCE_CONFIRMED；
- 因最新 → FACT。

## 2. Source Enum

复用 `provenance_source` 8值；不复制。

## 3. Subject and Source Are Independent

例：

```text
subject_person_id = child
source_person_id  = guardian
source_kind       = GUARDIAN_RELAY
kind              = STATEMENT
```

这表示“guardian关于child的陈述”，绝不是child self statement。

## 4. Message Link

`source_message_id`：

- 可为空；
- 若非空，必须同Case/Family；
- message本身不自动生成Assertion；
- 一个message可被0..N条Evidence引用；
- 一条Evidence最多引用一个直接source message；其它来源通过source fields表达。

## 5. Occurred vs Recorded

- `recorded_at` = 服务端记录时间；
- `occurred_at` = 事件/观察发生时间，可未知；
- 不得 `occurred_at = recorded_at` 作为缺省补值。

## 6. Assertion Kind

封闭：

- STATEMENT
- FACT
- HYPOTHESIS

OBSERVATION不是kind。

## 7. Fact Gate

Slice 3没有public FACT write path。

任何后续caller若要写FACT，必须：

- 来自已批准的确定性确认流程；
- 保留原来源；
- 可审计；
- 不能由AI单独完成。

## 8. Observation Value State

- KNOWN
- UNKNOWN
- NOT_COLLECTED
- DECLINED
- NOT_APPLICABLE

规则：

- KNOWN要求content；
- 其它状态不得伪造content=0/false/none；
- CONFLICT不用value_state表示；
- EXPIRED不用value_state表示。

## 9. Conflict

冲突 = 多条真实Evidence并存 + 同一conflict_group。

禁止：

- last-write-wins；
- source priority自动winner；
- AI裁决；
- 合成一个“平均事实”。

## 10. Supersession

新Evidence可supersede旧Evidence：

- old row保留；
- content/source/time不可原地改写；
- new row记录supersedes_id；
- same family / case / entity type；
- 无自环/循环。

## 11. Currentness

当前是否可用至少考虑：

- supersession；
- valid_from / valid_until；
- confirmation/dispute；
- conflict；
- future dependency invalidation。

“存在行”不等于“当前事实”。

## 12. Roleplay / Simulation Boundary

未来A4003 simulation不得写成child Statement/Fact。Slice 3不实现A4003，但Evidence contract必须不提供可绕过来源的便捷函数。

## 13. Verification Matrix

| Rule | Evidence |
|---|---|
| guardian relay != child statement | domain/integration |
| message != statement | integration row count |
| unknown not filled | DB round-trip |
| conflict keeps all rows | domain/DB |
| supersede keeps history | domain/DB |
| AI cannot public-confirm fact | route enumeration + domain |
| wrong-family hidden | HTTP + RLS |
