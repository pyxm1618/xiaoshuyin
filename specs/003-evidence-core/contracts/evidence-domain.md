# Contract — Evidence Domain

**Feature**: `003-evidence-core`  
**阶段**: Plan  
**权威**: Slice 3 frozen Spec、V1-C02/C03/C21/C23/C24/C30、`Docs/V1技术设计.md` §5/§7.2/§9/§29.6。

## 1. Domain boundaries

四类语义必须机械可区分：

```text
STATEMENT   -> assertions.kind=STATEMENT
FACT        -> assertions.kind=FACT
HYPOTHESIS  -> assertions.kind=HYPOTHESIS
OBSERVATION -> observations table
```

禁止 `assertions.kind=OBSERVATION`。

## 2. Production write capabilities

当前 Slice 的 domain contract 只暴露：

```ts
recordStatement(context, draft)
recordHypothesis(context, draft)
recordObservation(context, draft)
assignConflictGroup(context, refs)
```

这些函数都必须接收已经完成 Case/Family authorization 的 context，并在 repository 层再次验证 scope/provenance。`recordHypothesis` 仅保留为 future-facing type-specific capability contract：Slice 3 production runtime 没有 AI caller，也没有当前可接受的 AI provenance；不得因函数/enum 存在就伪造 AI 写入路径。

明确不存在：

```text
recordFact
createFact
confirmFact
promoteToFact
updateAssertionKind
createAssertion(kind)
createEvidence(anything)
```

任何 caller 都不能通过任意 kind 参数绕过 FACT confirmation 语义。

## 3. FACT contract

- `FACT` 必须存在于 `assertion_kind` 与 domain discriminated union。
- 当前 Slice 没有 public FACT route。
- 当前 Slice 没有 AI/extractor FACT path。
- 当前 Slice 没有 arbitrary internal FACT writer / promoter。
- FACT 的存在通过 schema/type tests 验证，不通过临时 production API 验证。
- 如测试需要真实 FACT row，只允许 test-only privileged fixture；不得 export 到 production package，不得进入 route/import graph。
- runtime app role 的 `assertions INSERT` 必须由数据库 RLS `WITH CHECK (family_id = app_family_id() AND kind <> 'FACT')` 硬阻断 FACT；绕过 TypeScript/domain helper 也不能写入。
- STATEMENT/HYPOTHESIS 在其它验证通过时仍可由 runtime app INSERT。
- future Fact Confirmation Slice 若要开放 FACT，必须显式修改该数据库 policy 与 domain contract，并经过独立审核。

## 4. Shared provenance contract

Assertion / Observation 都显式携带：

```text
familyId
caseId
subjectPersonId?
sourceKind
sourcePersonId?
sourceMessageId?
occurredTimeState
occurredAt?
validFrom?
validUntil?
confirmationStatus
supersedesId?
conflictGroupId?
```

共享 TS helper 可以验证：
- source-person requirement；
- occurred time consistency；
- validity window；
- message provenance；
- Person reference authorization；
- same Case/Family supersedes。

数据库仍在两表各自显式持列，不建立 evidence supertable。

## 4A. Current Slice provenance admissibility

复用 Slice 1 `provenance_source`；本表只冻结 Slice 3 的可用子集与验证，不修改 Slice 1 enum。

| sourceKind | 当前 production | writer | sourcePersonId | subject/source relationship | additional authorization | why |
|---|---|---|---|---|---|---|
| `SELF_STATEMENT` | allowed | `recordStatement` | required | subject required；source = subject | Person 必须属于当前目标 Family；Case writer 已授权 | 本人陈述 |
| `GUARDIAN_OBSERVATION` | allowed | `recordObservation` only | required | subject required；source ≠ subject；source 是 subject 的真实 guardian | source/subject 均为当前 Family 合法 refs；guardian relation 必须验证，但不授予 Family/Case access | 家长观察对应 Observation |
| `GUARDIAN_RELAY` | allowed | `recordStatement` only | required | subject required；source ≠ subject；source 是 subject 的真实 guardian | 同上 | 家长转述对应 Statement |
| `OTHER_MEMBER_RELAY` | allowed | `recordStatement` only | required | subject required；source ≠ subject；双方都是当前 Family member | Case authorization + Family composite refs；无需 guardian relation | 其他成员转述 |
| `MANUAL_DEVICE_DATA` | disabled | none | forbidden | N/A | fail closed | 本 Slice 无 Digital Use/device ingestion |
| `STAFF_RECORD` | disabled | none | forbidden | N/A | fail closed | 本 Slice 无 staff workflow |
| `AI_HYPOTHESIS` | disabled | none；`recordHypothesis` 仅 future-facing contract | forbidden | N/A | fail closed；Slice 3 无 AI runtime caller | 防伪造 AI provenance |
| `SOURCE_CONFIRMED` | disabled | none | forbidden | N/A | fail closed | 本 Slice无确认/FACT workflow |

共同规则：

- “allowed” 不新增 HTTP route，只约束内部窄 writer；Message POST 仍只写 raw message、自动 Assertion = 0。
- guardian relation 只验证 provenance relationship，永远不能绕过 Family membership 或 Case authorization。
- disabled source kind 必须在 current production validation/repository boundary 被拒绝；不能因为 PostgreSQL enum 中存在就自动开放。
- future Slice 若正式增加 Device / Staff / AI / Confirmation 能力，必须显式扩本矩阵与测试，不修改 Slice 1 enum 含义。

## 5. Observation value contract

```ts
type ObservationValue =
  | { state: 'KNOWN'; type: 'TEXT'; valueText: string; unit?: never }
  | { state: 'KNOWN'; type: 'NUMBER'; valueNumber: number; unit?: string }
  | { state: 'KNOWN'; type: 'BOOLEAN'; valueBoolean: boolean; unit?: never }
  | { state: 'UNKNOWN' | 'NOT_COLLECTED' | 'DECLINED' | 'NOT_APPLICABLE' };
```

要求：
- numeric 0 合法；
- boolean false 合法；
- UNKNOWN-like state 无 value；
- NULL 不等于 UNKNOWN；
- N/A canonical encoding = `NOT_APPLICABLE`。

## 6. Conflict contract

`conflict_group_id` 是关联关系，不是 epistemic/value state。

`assignConflictGroup`：
1. 至少两条 refs；
2. refs 只允许 Assertion / Observation；
3. 全部同 Family/Case；
4. 读取当前 row 时必须在 same RLS context；
5. 已有 group 只能是相同 group；不得迁移；
6. 更新只触及 `conflict_group_id`；
7. 不产生 winner / confidence / rank / FACT；
8. 不删除任何来源。

Conflict round-trip 的证明是“每条 row 的 group id 与原来源均保持”，不是把某条 row 的值改成 CONFLICT。

## 7. Supersedes contract

```text
new assertion  -> old assertion
new observation -> old observation
```

- old row 保留；
- no self；
- same Family/Case；
- new row 只引用已存在 old row；
- runtime 不修改旧 row 的 content/source/value/supersedes；
- source/subject provenance 不随 supersede 隐式改变；
- cycle prevention 来自 append-only `new → existing old` + 禁止 UPDATE 旧 row `supersedes_id`；验证 self-reference reject、old-row supersedes mutation reject、正常 production path 无法成环即可，不实现 graph cycle detector。

## 8. Time / validity

`recordedAt`：server-owned，domain input 不允许指定。

`occurredTimeState`：
- KNOWN → occurredAt 必须有值；
- UNKNOWN → occurredAt 必须为空。

`validFrom/validUntil`：
- 都可未知；
- 两者都有时 validUntil > validFrom；
- EXPIRED 由当前时钟与 validUntil 推导，不保存漂移状态。

## 9. Source message

`sourceMessageId` 可为空。非空时：
- message 与 Evidence 必须同 Family/Case；
- `sourcePersonId` 必须存在；
- repository 验证 message.source_person_id = Evidence.source_person_id；
- 引用 message 不会自动把 message 变成 Statement。

## 10. No downstream propagation

当前 contract 不创建、不更新：
- Assessment
- Problem Formulation
- Scene state/artifact
- Goal/Plan/Task
- Safety
- Memory
- AI run

Evidence 更正/失效对这些未来对象的传播属于后续 Slice。
