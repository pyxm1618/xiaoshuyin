# Research — 003-evidence-core

**阶段**: Plan research only  
**基线**: Slice 3 `8253fff...`；Slice 1 current `8a88381c...`；Slice 2 frozen `999295d0...`

本文只记录 Plan 技术选择与被拒绝方案，不改变产品语义。

## R-1 Observation 不使用 `evidence_items` supertable

决定：`assertions` 与 `observations` 分表；共享 provenance 只复用 TS types / validators / repository helpers。

原因：正式设计要求 Statement / Observation / Fact / Hypothesis 分离。父表会制造双层 identity、nullable subtype、第三份 provenance 事实源，并为通用知识图谱铺路。数据库少量显式重复列是刻意设计。

## R-2 Observation 使用 typed scalar value，而不是万能 JSON

最小载体：

```text
observation_code
value_state
value_type
value_text
value_number
value_boolean
unit
```

JSON 易演变成 scene-specific artifact；单一 text 无法机械证明 0/false 是真实值。复杂 Assessment artifact 后置。

## R-3 UNKNOWN 等不是统一 epistemic state

拒绝：

```text
KNOWN | UNKNOWN | NOT_COLLECTED | DECLINED | N/A | CONFLICT | EXPIRED
```

因为它把 value availability、collection、user decision、applicability、conflict、temporal validity、confirmation 混为一列。

决定：
- Observation value：`observation_value_state`
- occurred time：`evidence_time_state`
- confirmation：`evidence_confirmation_status`
- conflict：`conflict_group_id`
- validity：`valid_from/valid_until/supersedes`

## R-4 N/A canonical storage

产品 N/A ↔ domain/database `NOT_APPLICABLE`。不得存 NULL、空字符串或 false。

## R-5 CONFLICT 是关系，不是值状态

`conflict_group_id` 关联多条 Evidence；不新建 conflict table，因为本 Slice 不需要 resolution lifecycle/winner/reason taxonomy。group 无 winner/rank/confidence。

## R-6 Conflict group 允许窄 UPDATE

冲突常在第二来源到来后才发现。禁止新建 relation table、复制第一条 Evidence 或只给第二条 group。

决定：仅 `UPDATE(conflict_group_id)`，其余 content/value/provenance append-only；只允许 NULL→groupId 或 same-value replay。

## R-7 Supersedes new→old

Assertion 只 supersede Assertion；Observation 只 supersede Observation；同 Family/Case；no self；旧 row 不改。新 row 只能指向已存在旧 row，因此 append contract 下不形成明显 cycle。

## R-8 Person reference 使用 Family composite FK

仅 `persons(id)` FK 无法阻止 Family A Evidence → Family B-only Person。复用 Slice 1 `UNIQUE(family_id,person_id)`：

```text
(family_id, subject_person_id) -> family_members(family_id,person_id)
(family_id, source_person_id)  -> family_members(family_id,person_id)
```

它只证明 Family membership，不替代 application authorization。guardian relationship 不作为例外。

## R-9 Raw Message 不标成 SELF_STATEMENT

Message 不是 Assertion。Message 只保存 actor/source person、raw content、Case/Family、recorded_at。未来批准流程若结构化 Statement，再明确 source kind 并引用 source_message_id。

## R-10 Message idempotency 复用 shared reality

Slice 1 current runtime 已具备 canonical hash、actor+command+key scope、identity RLS、advisory lock、二次 lookup、replay/mismatch、same-tx response snapshot。

因此不建 message_dedup、不用 in-memory/Redis/request-id/content-hash 去重。

## R-11 Canonical hash 必须含 Family + Case

只 hash content 会允许相同 actor/key 在不同 Case错误 replay。决定：

```text
hash({familyId, caseId, body:{content}})
```

familyId/caseId 必须来自 server-verified context。

## R-12 Replay 不能成为 authorization shortcut

Message 是 specific Case write。顺序必须：resolve Family → authorize specific Case → shared replay peek → EXECUTE 时 transaction 内再验证。若 final helper不能安全支持，触发 Plan Review，不复制 helper。

## R-13 Response 不回显 raw content

Idempotency 会持久化 response body。若 response 回显 content，会额外复制敏感正文。201 只返回 id/caseId/recordedAt。

## R-14 `case_events` 不镜像每条 Evidence

Message/Assertion/Observation 本身已是 domain rows，且本 Slice不改变 Case lifecycle。只写最小 business audit，不增加 case_event。

## R-15 FACT 存在但 production capability 不存在

DB/domain 保留 FACT 类型；production service只 export recordStatement/recordHypothesis/recordObservation。FACT 用 schema/type/test-only fixture 验证，不创建 route 或通用 writer。

## R-16 recorded_at 与 occurred_at

`recorded_at` server-owned。occurred time 可未知，以 `evidence_time_state=UNKNOWN + occurred_at=NULL` 明确表示，绝不用 recorded_at 代填。

## R-17 Migration 编号只在依赖 final 后决定

当前 Slice 2 尚非 runtime dependency，Plan 不写死 migration 序号。Gate 后读取 main 真实 migrations，取下一个编号。

## R-18 历史草稿 `17b6812`

不 restore/cherry-pick。当前设计独立基于 `8253fff` Spec、Q4/Q5、FR-021、Slice 1 current reality、Slice 2 frozen design。冲突时当前 Spec 优先。

## Conclusion

Q1/Q2/Q3 已有唯一技术答案。Plan-level 无 blocker；Implement 仍被 Slice 1/2 final runtime gate 硬阻断。
