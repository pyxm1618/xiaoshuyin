# Implementation Plan: 003-evidence-core（Evidence Core）

**Feature**: `specs/003-evidence-core/spec.md`  
**Date**: 2026-11-05  
**V1 Phase**: Phase 1 — Common Core 地基（`Docs/V1技术设计.md` §38）  
**Slice**: SLICE 3 — Evidence Core（`dialogue_messages` / `assertions` / `observations`）  
**Plan base**: `8253fff985a35f9cf11c2b78a14011ae246f9e11`  
**阶段**: Plan only。Checklist / Tasks / Analyze / Implement 均未开始。

> Q4（Message 只保存 raw message）与 Q5（FACT 保留领域类型但当前无正式可达写入/确认路径）已冻结，本 Plan 不重新解释。
> Slice 1 current Head `8a88381c2b6480c3ee84d207709cbe39e54c934e` 仅作 planning-time dependency reality check；Slice 2 frozen Head `999295d04e90cc39ace3ef09b1d16b9d2752bfd6` 仅作 frozen design dependency。两者均不等于 Slice 3 已可 Implement。

---

## 0. Baseline 与 Implement Gate

### 0.1 Planning-time dependency reality

| 依赖 | 当前读取事实 | Plan 处理 |
|---|---|---|
| Slice 1 | 已有 Family/Person/guardian、`family_members`、`provenance_source`、`business_audit_events`、`idempotency_keys`、RLS transaction 与 shared idempotency runtime | 复用，不修改 |
| Slice 1 idempotency | scope = `(actor_account_id, command_type, idempotency_key)`；`Idempotency-Key` HTTP header transport；canonical JSON + SHA-256；same hash replay；different hash mismatch；concurrent same-key serialization；response snapshot 与业务写同事务 | Q3 直接沿用 |
| Slice 2 | 已冻结 Case schema / authorization / anti-enumeration / RLS / audit / CASE_CREATE idempotency 设计，但尚不视为 runtime 已实现 | 作为设计依赖 |
| Slice 3 | 当前只有 `spec.md` | 本轮只创建 Plan artifacts |

### 0.2 Slice 3 Implement Hard Gate

进入业务代码、migration、tests 前必须同时满足：

```text
Slice 1 → Implement complete → independent Converge PASS → merged main
AND
Slice 2 → Implement complete → independent Converge PASS → merged main
```

Implement 前必须重新验证：

1. Slice 1 final / Slice 2 final commit 均为 `origin/main` ancestor，且独立 Converge + CI 全绿。
2. final schema：`family_members(family_id,person_id)` 唯一键、`provenance_source`、`business_audit_events`、`idempotency_keys`、`cases(id,family_id)` 真实存在且形状稳定。
3. Family / Person / guardian / compliance 语义未变化；guardian 仍不能替代 Family membership。
4. final `authorize()` 已包含 Slice 2 Case resource/action 维度，Message path 可复用既有 Case management actor path。
5. final `withRlsTransaction`、runtime role、NOBYPASSRLS、ENABLE/FORCE RLS 均真实有效。
6. final shared idempotency 的 key transport、command-type 扩展方式、canonical hashing、replay/mismatch、并发锁、response snapshot 稳定。
7. final Case RLS / anti-enumeration / Case authorization 与 Slice 2 frozen contract 一致，或已有正式 Plan Review。
8. final `case_events` / `business_audit_events` / CHECK 名称 / runtime grants 已现场确认。
9. final Zod/OpenAPI/generated client 单事实源与 CI 命令稳定。
10. current Family 语义已确定且可重复，不依赖无序 `rows[0]`。
11. Slice 3 分支普通 merge 最新 main；禁止 rebase / force push。

任一失败：

> **BLOCKED — SLICE 3 IMPLEMENTATION DEPENDENCY**

若依赖最终 contract 改变本 Plan关键假设（尤其 idempotency transport / canonical context、Case authorization、Case composite key、current Family 语义），必须回到 Plan Review；不得在 Slice 3 私自补 Slice 1/2。

---

## Upstream Traceability

| 上游 | 本 Plan 落点 |
|---|---|
| V1-C02 / §5 / §7.2 | Assertion / Observation 分离，source/subject/time/confirmation/validity/conflict/supersedes 可追溯 |
| V1-C03 | UNKNOWN / NOT_COLLECTED / DECLINED / N/A 真实表达，不用 null/0/false 冒充 |
| V1-C21 / §9–§11 | Case + Family + Person reference application authorization；RLS 只做 Family isolation |
| V1-C23 / §29.6 | append-first history、validity、supersedes，不覆盖旧 content/provenance |
| V1-C24 | 无 AI / arbitrary internal FACT shortcut |
| V1-C28 / §8.5 | Message command 复用 shared idempotency |
| V1-C30 | Scene-agnostic，不硬编码 Digital Use |
| V1-X05 / §32.3 | conflict 保留多来源，无自动 winner |
| §28.3 / FR-009 | 唯一新增 public route `POST /api/v1/cases/:id/messages` |
| FR-017 | Message + audit + idempotency 原子性 |
| FR-021 | non-null Person reference 必须对目标 Family/Case 合法；guardian 不绕过 Family access |

---

## Summary

本 Slice 只规划三张新表：

```text
dialogue_messages
assertions
observations
```

不建 `evidence_items`、不建 conflict table、不建 knowledge graph。

核心决定：

1. **Q1**：Assertion 与 Observation 各自显式持有必要 provenance 列；TypeScript 复用共享 provenance types/validators，但数据库不抽成万能父表。
2. **Q2**：未知、未收集、拒绝、不适用只作为 Observation value availability；occurred time、confirmation、validity、conflict 分开表达。不存在万能 `epistemic_state`。
3. **Q3**：Message 使用 shared `idempotency_keys`，`command_type=CASE_MESSAGE_CREATE`，沿用 final main 冻结的 `Idempotency-Key` HTTP header；hash = verified `familyId + caseId + raw content`。
4. Message 写入自动 Assertion 数量恒为 0。
5. 内部能力按 `recordStatement`、`recordHypothesis`、`recordObservation` 明确拆分；不存在 `recordFact`、`promoteToFact`、`createEvidence(anything)`。其中 `recordHypothesis` 仅保留为 future-facing domain capability contract，本 Slice production runtime 没有可达 AI caller。
6. `assertions` 的 runtime INSERT 有数据库最后防线：`family_id = app_family_id() AND kind <> 'FACT'`。因此 domain helper 被绕过时，`xiaoshuyin_app` 仍不能直接 INSERT FACT；test-only FACT fixture 只能走隔离 privileged context。
7. 三表都持有 `family_id + case_id`；Person refs 通过 Family membership composite FK 做 DB 最后防线。
8. RLS 默认承担 Family isolation，并在 `assertions INSERT` 上额外承担 FACT capability guard；manager/Case/guardian 等业务授权仍由 application/domain。
9. 不为 Message/Evidence 增加镜像 `case_event`；只复用 `business_audit_events` 做最小审计，且 metadata 不复制正文。

---

## Technical Baseline

**Runtime / Language**: Node.js 26 LTS（development baseline 26.13.0）、TypeScript/ESM、Fastify 5.12.8 baseline。  
**Storage**: PostgreSQL 18、Drizzle 0.45 line + node-postgres；主键默认 `uuidv7()`。  
**Contracts**: Zod >=4.2 → Fastify validation → OpenAPI → generated types/client。  
**Authorization**: existing `authorize()` + Domain Policy；RLS 为 Family isolation 第二层。  
**Idempotency**: existing `idempotency_keys` + canonical JSON/SHA-256 + shared orchestration。  
**Testing**: Vitest domain / DB / integration / contract；本 Slice 无 AI/RAG eval。  
**Migration**: reviewed SQL only；禁止 `drizzle-kit push` 作为 production schema source。

---

## Constitution Check

- [x] No new product semantics.
- [x] No V2–V5 scope.
- [x] No A/010xx behavior change.
- [x] Frozen technical stack respected.
- [x] Deterministic rules remain deterministic.
- [x] Authorization / RLS / compliance implications explicit.
- [x] Provenance/version/history preserved.
- [x] UNKNOWN/conflict/idempotency/concurrency explicitly designed.
- [x] Verification path exists for every acceptance cluster.

**结论：PASS。无 Complexity Exception。**

---

## Design

### D-1 Architecture

最小组件：

```text
packages/contracts
  └─ Message Zod/OpenAPI schema

apps/server/api
  └─ POST /api/v1/cases/:id/messages
      ├─ authenticate
      ├─ resolve current Family
      ├─ Case-management authorization preflight
      ├─ canonical hash
      └─ shared idempotent command

packages/domain
  ├─ internal/evidence-authorization.ts (non-exported seam)
  │    └─ reuses @xiaoshuyin/authorization authorize()
  ├─ dialogue-message repository/service
  └─ evidence domain service
      ├─ recordStatement(...)
      ├─ recordHypothesis(...)
      ├─ recordObservation(...)
      └─ assignConflictGroup(...)
```

禁止：`createEvidence(anything)`、caller-selectable `createAssertion({kind})`、`recordFact`、`promoteToFact`、public `/assertions` / `/observations` / `/evidence`、route-local dedupe cache。

共享 provenance 只在 TS type/validator/repository helper 层复用；数据库每张表显式持列。

`packages/domain` 通过非导出内部 seam 依赖 `@xiaoshuyin/authorization`；依赖方向为 `domain → authorization → contracts`，不引入循环，也不新增 authorization action。该 seam 不进入 production entrypoint，不改变冻结的四个 Evidence writer 公共表面。

### D-2 Q1 — Observation 最小结构

Observation 与 Assertion 共享语义列：

```text
family_id
case_id
subject_person_id?
source_kind
source_person_id?
source_message_id?
occurred_time_state
occurred_at?
recorded_at
valid_from?
valid_until?
confirmation_status
supersedes_id?
conflict_group_id?
```

Observation 自有最小字段：

```text
observation_code
value_state
value_type?
value_text?
value_number?
value_boolean?
unit?
```

规则：

- `observation_code` 只是稳定 scalar dimension identifier，不是 ontology / graph / Digital Use registry。
- `KNOWN` 时必须有且只有一个 typed value；数字 0 / boolean false 均为合法真实值。
- UNKNOWN-like state 时 value columns 必须全 NULL；**状态不靠 NULL 推断**。
- `unit` 仅允许 numeric KNOWN。
- Observation 不存在 `kind`；绝不能变成 `assertions.kind='OBSERVATION'`。

### D-3 Q2 — Unknown / Declined / N/A / Conflict

#### Observation value availability

```text
KNOWN
UNKNOWN
NOT_COLLECTED
DECLINED
NOT_APPLICABLE
```

`NOT_APPLICABLE` 是产品 N/A 的 canonical storage。

#### Occurred time

```text
evidence_time_state = KNOWN | UNKNOWN
```

CHECK：

```text
KNOWN   <=> occurred_at IS NOT NULL
UNKNOWN <=> occurred_at IS NULL
```

`recorded_at` 永不代填 `occurred_at`。

#### Confirmation

```text
UNCONFIRMED
SOURCE_CONFIRMED
DISPUTED
```

`SOURCE_CONFIRMED` 不会把 STATEMENT/HYPOTHESIS 改成 FACT。

#### Conflict

CONFLICT/CONFLICTING 不进 value-state。

- `conflict_group_id uuid NULL` 表达冲突关联；
- group 可跨 Assertion / Observation；
- 同 Case / Family、至少两条 evidence；
- 无 winner/rank/confidence/majority；
- latest timestamp 不解决 conflict；
- 后续 resolution 通过新 Evidence / supersedes，旧来源保留。

为支持“第二条到来后才发现冲突”，runtime 仅获得 `UPDATE(conflict_group_id)` 的 column-level 权限；其它 content/provenance/value 列不可 UPDATE。Repository 只允许 NULL → groupId 或同值 idempotent write。

#### Validity / expiration / supersedes

- `valid_from` / `valid_until` 独立；
- 两者都有值时 `valid_until > valid_from`；
- `supersedes_id` 新→旧；
- old row 不删除、不改 content/provenance；
- EXPIRED 由时间窗口推导，不存冗余 enum。

Assertions 不带 Observation value-state。raw 用户说“我不知道”仍先是 raw message；未来批准流程若结构化成未知值，写 Observation(value_state=UNKNOWN)。

### D-4 FACT reachability

production domain exports：

```text
recordStatement
recordHypothesis
recordObservation
assignConflictGroup
```

每个函数固定类型，不接受 arbitrary `kind`。

刻意不存在：

```text
recordFact
createFact
confirmFact
promoteToFact
updateAssertionKind
createEvidence
createAssertion(kind)
```

数据库 `assertion_kind` 与 domain union 仍包含 FACT。测试用 schema introspection / pure domain validation / test-only privileged fixture 证明 FACT 可表达；fixture 不从 production package export，也不建立 HTTP route。

**数据库最后防线**：

```text
xiaoshuyin_app INSERT assertions
WITH CHECK (
  family_id = app_family_id()
  AND kind <> 'FACT'
)
```

- 正确 Family RLS context 也不能让 runtime app role 写入 FACT；
- `STATEMENT` / `HYPOTHESIS` 在其它授权、provenance、FK、CHECK 均满足时仍可 INSERT；
- test-only FACT row 只能由隔离的 migrator/test privileged context 创建，不能借 production runtime role、production repository 或临时 HTTP API；
- future 正式 Fact Confirmation Slice 若要开放 FACT，必须显式修改该数据库 policy / contract，并经过自身 Spec/Plan/Review；不得把本门禁静默放宽。

### D-4A Provenance source admissibility matrix

Slice 3 **直接复用** Slice 1 `provenance_source` 8 值 enum，不复制、不删值、不重新定义其含义。下面冻结的是“本 Slice production writer 的允许子集”，不是新的 taxonomy。

| source_kind | 当前 Slice production | writer | source_person_id | subject/source relationship | 额外 authorization / validation | 原因 |
|---|---|---|---|---|---|---|
| `SELF_STATEMENT` | 允许 | `recordStatement` | required | `subject_person_id` required；`source_person_id = subject_person_id` | subject/source 必须是当前目标 Family 合法 Person ref；Case writer authorization 仍须通过 | Slice 1“本人陈述”语义；不能把别人的陈述伪装成 self |
| `GUARDIAN_OBSERVATION` | 允许 | `recordObservation` only | required | subject required；source ≠ subject；source 必须是 subject 的真实 guardian | source/subject 都必须是当前 Family 合法 Person ref；guardian relation 必须存在，但 guardian relation 本身不授予 Family/Case access | “家长观察”在本 Slice 映射为 Observation，不允许 Statement writer 猜测使用 |
| `GUARDIAN_RELAY` | 允许 | `recordStatement` only | required | subject required；source ≠ subject；source 必须是 subject 的真实 guardian | 同上；必须验证 guardian relation，且不能用 guardian 绕过 Family/Case authorization | “家长转述”是对他人陈述的 relay |
| `OTHER_MEMBER_RELAY` | 允许 | `recordStatement` only | required | subject required；source ≠ subject；source 与 subject 都必须是当前 Family member | Case writer authorization + 两个 Person composite refs；不要求 guardian relation | Slice 1“其他成员转述”语义 |
| `MANUAL_DEVICE_DATA` | 禁用 | none | forbidden | N/A | current validator/repository fail closed | 本 Slice 不实现 Digital Use / device ingestion；enum 存在不代表当前能力 |
| `STAFF_RECORD` | 禁用 | none | forbidden | N/A | current validator/repository fail closed | 本 Slice 无 staff workflow / staff writer |
| `AI_HYPOTHESIS` | 禁用 | none（`recordHypothesis` 仅为 future-facing contract，不是当前 runtime caller） | forbidden | N/A | current Slice 没有 AI caller；当前 production composition 对该 source kind fail closed | 防止内部调用者伪造“AI 已生成” provenance；未来 AI Slice 必须正式扩 admissibility |
| `SOURCE_CONFIRMED` | 禁用 | none | forbidden | N/A | current validator/repository fail closed | 本 Slice 没有 Fact/Confirmation workflow，不能借 enum 暗中创造确认路径 |

“允许”只表示对应窄 domain writer 在**已授权 Case/Family context** 下可以接受该 provenance；它不会新增 public route。Message POST 仍只保存 raw message，自动 Assertion 数仍为 0。

`recordHypothesis` 的类型专用 contract 保留，但 Slice 3 当前没有任何 production-admissible hypothesis provenance/caller；实现不得把 `AI_HYPOTHESIS` 当成“因为 enum 存在所以可写”。未来正式 Slice 扩展时必须显式修改本矩阵与验证测试。

### D-5 Person Reference Authorization / Security

Message public path只允许 Slice 2 final 已批准的 Case management actor path。普通 membership、guardian、知道 caseId/personId 均不增加 Evidence 权限。

当 `subject_person_id` / `source_person_id` 非空：

1. target Family/Case 已授权；
2. Case 真实属于该 Family；
3. Person 必须是该 Family 的 `family_members` 成员；
4. guardian relationship 不能绕过第 3 条；
5. UNDER_14 只能引用 Slice 1 已合法建立 Person；Evidence Core 不创建 Person；
6. 若有 `source_message_id`，Message 必须与 Evidence 同 Family/Case，source person 必须一致。

Internal Evidence writer 的 context 必须携带 `familyId` / `caseId` / `actorAccountId` / `actorPersonId` / `purpose`，并在 writer 执行时、读取任何 Person/provenance/supersedes 数据之前机械复核当前 Case / Family / Purpose authorization：

7. `actorAccountId` 对应的 Person 必须等于 `actorPersonId`；
8. `caseId` 必须真实存在且 `case.family_id === familyId`；
9. 复用唯一 `authorize()`，固定 `action=CASE_READ` + `purpose=ctx.purpose` + `resource={type:'CASE',familyId,caseId}` + `case={caseId}`，facts 必须从数据库读取；
10. 任一 DENY、未知 / 非 `FAMILY_MANAGEMENT` purpose、Case 不存在 / 跨 Family、account↔person 不匹配 → fail closed，统一内部 reason `EVIDENCE_CASE_NOT_AUTHORIZED`（不新增 HTTP code）。

本 Slice 不新增 `EVIDENCE_WRITE` action，也不扩展 `Action` / `Purpose` taxonomy；`CASE_READ + FAMILY_MANAGEMENT + specific Case` 与 Message production path 保持一致。Evidence 独立 permission 由未来 Slice 正式设计。

所有本次 write 实际处理的非空 Person reference 都必须通过 Slice 1 现有 compliance gate：`subjectPersonId !== null` 必须检查，`sourcePersonId !== null` 必须检查；`subjectPersonId === sourcePersonId` 时允许只检查一次，语义不变。完全复用 `assertMinorProcessingAllowed` 与现有 repository 数据源，不建立第二套 Compliance 系统；`ADULT` / `MINOR_14_17` / `UNDER_14` 有效当前 consent → 允许，`UNDER_14` missing/revoked/stale/invalid、`UNKNOWN`、profile missing → fail closed。

DB composite FK 防跨 Family Person；RLS 防跨 Family row。RLS 不判断 manager/Participant/Purpose/FACT confirmation，也不替代上述 application authorization 复核。

Anti-enumeration：

- public message body不接受 person IDs；
- internal invalid person ref统一 domain error，不区分“不存在 / 别的 Family / 无权”；
- specific Case message endpoint沿用 Slice 2 final indistinguishable `CASE_NOT_FOUND` 语义。

### D-6 Q3 — Message Idempotency

**command type**：

```text
CASE_MESSAGE_CREATE
```

**transport**：统一沿用 final main 已冻结的 HTTP header：

```http
Idempotency-Key: <8..128 chars>
```

JSON body 只承载业务字段 `content`；不得包含 `idempotencyKey`，不得双轨。

**scope**：

```text
(actor_account_id, CASE_MESSAGE_CREATE, idempotency_key)
```

**canonical request hash**：

```text
sha256(canonicalJson({
  familyId: <server-verified family>,
  caseId: <route case after authorization context resolution>,
  body: { content: <exact raw stored string> }
}))
```

`Idempotency-Key` header 值不进 hash；actor/command 已在 scope；familyId/caseId 防止跨目标错误 replay。content 不 trim/normalize 后存储；validator 只拒绝空/纯空白/超长。

行为：

| 场景 | 结果 |
|---|---|
| same key + same hash | replay 原 status/body；不新写 message/audit/assertion |
| same key + different hash | 409 `IDEMPOTENCY_PAYLOAD_MISMATCH`；零业务写 |
| concurrent same key | shared lock + second lookup，只 1 EXECUTE |
| different key + same content | 两条独立 raw message，不做 content dedupe |

current Family 无法唯一解析时的 409 见 D-7 与 `security-idempotency.md` §9；它不属于幂等 payload mismatch。

planning-time Slice 1 当前 helper 已有 fast peek + advisory lock + second lookup + response snapshot；Slice 3 不复制。

**安全顺序**：specific Case authorization preflight 必须发生在 shared replay fast path之前；EXECUTE callback 内再验证 Case/Family/auth。若 final helper 无法安全支持此顺序，触发 Gate / Plan Review。

### D-7 Message Endpoint

唯一新增 public route：

```text
POST /api/v1/cases/:id/messages
```

required transport header：

```http
Idempotency-Key: <8..128 chars>
```

strict JSON request body：

```json
{
  "content": "1..8000 chars; non-whitespace; exact raw stored"
}
```

body 不接受 `idempotencyKey`；不得双轨。

server-owned：family_id、case_id、actor_account_id、source_person_id、recorded_at。

成功响应：

```json
{
  "id":"<uuid>",
  "caseId":"<uuid>",
  "recordedAt":"<ISO-8601 UTC>"
}
```

不回显 raw content，避免正文复制进 idempotency response snapshot。

错误沿用现有 contracts：401、404 `CURRENT_FAMILY_NOT_FOUND`、404 `CASE_NOT_FOUND`、409 `oneOf(CURRENT_FAMILY_AMBIGUOUS, IDEMPOTENCY_PAYLOAD_MISMATCH)`、422 `VALIDATION_ERROR`、500。

强不变量：

```text
message INSERT != Assertion INSERT
```

每次 message command 自动 Assertion 数 = 0。

### D-8 Transactions

Message command：

```text
authenticate
→ strict parse
→ resolve current Family
→ Case management authorization preflight
→ compute canonical hash
→ shared idempotent command
   → transaction + identity/family context
   → same-key lock + second lookup
   → re-read Case + re-authorize
   → INSERT dialogue_messages
   → INSERT business_audit_events(MESSAGE_RECORDED, DIALOGUE_MESSAGE)
   → persist idempotency response
→ COMMIT
```

原子集合：

```text
dialogue_message + business_audit_event + idempotency response
```

无 Assertion、case_event、job、AI run、Formulation、Scene state 副作用。

Internal Statement/Hypothesis/Observation：同一 authorized RLS transaction 内 revalidate actor account↔person binding → Case 真实属于 Family → Case/Family/Purpose via `authorize(CASE_READ, FAMILY_MANAGEMENT, specific Case)` → all non-null subject/source Person compliance gate → person refs → provenance/time/value/validity/supersedes → insert evidence → audit → commit。

### D-9 Audit / Events

`case_events`：**不新增事件**。Evidence rows 已是 domain history，且本 Slice 不改变 Case status/phase/primary。

`business_audit_events` 最小增量：

```text
event_type:
  MESSAGE_RECORDED
  ASSERTION_RECORDED
  OBSERVATION_RECORDED

resource_type:
  DIALOGUE_MESSAGE
  ASSERTION
  OBSERVATION
```

metadata 固定 `{}`；不得复制 raw message、assertion content、observation value 或 PII。

### D-10 Supersedes / Conflict

Supersedes：

- Assertion→Assertion、Observation→Observation；
- same Family + same Case composite FK；
- no self；
- runtime 不 UPDATE `supersedes_id`；
- 新 row 只引用已存在旧 row，且 runtime 不允许 UPDATE 旧 row 的 `supersedes_id`；因此正常 production path 通过 append-only direction 结构性阻止 cycle；
- verification 只需证明 self-reference reject、old-row `supersedes_id` mutation reject、正常 production path 无法形成 cycle；**不新增 graph traversal / cycle detector**；
- old row 永久保留。

Conflict：

- 至少两条同 Case/Family evidence；
- 可跨 Assertion/Observation；
- 无 winner/confidence/rank/majority；
- AI/latest 不自动变 Fact；
- group 一旦分配不可迁移。

### D-11 OpenAPI

只新增 Message POST。机械证明：

- 只有 `POST /api/v1/cases/{id}/messages`；
- request strict；
- 不接受 familyId/actorId/sourcePersonId/subjectPersonId/recordedAt/assertionKind；
- response 不回显 content；
- 无 GET/PATCH/DELETE messages；
- 无 `/assertions`、`/observations`、`/evidence`；
- error code 由 schema 机械固定，而不是只写在 prose/example：
  - 401 → `UNAUTHENTICATED`
  - 404 → `oneOf(CURRENT_FAMILY_NOT_FOUND, CASE_NOT_FOUND)`
  - 409 → `oneOf(CURRENT_FAMILY_AMBIGUOUS, IDEMPOTENCY_PAYLOAD_MISMATCH)`
  - 422 → `VALIDATION_ERROR`
  - 500 → `INTERNAL_ERROR`
- 401/500 复用现有错误 taxonomy；404 复用 Slice 1 Family + Slice 2 Case anti-enumeration 语义，不定义第二套错误码。

---

### Existing Contracts Reused

- Slice 1 `provenance_source`
- Slice 1 `family_members(family_id,person_id)`
- Slice 1 `business_audit_events`
- Slice 1 shared `idempotency_keys` / canonical hash / shared runtime
- Slice 1 `withRlsTransaction` / roles
- Slice 2 frozen `cases(id,family_id)` / Case manager authorization / anti-enumeration / RLS
- §27A Zod/OpenAPI/generated client pipeline

### Data and Migration Impact

新增三表 + 专属 enum；扩展 existing idempotency/audit CHECK 白名单。migration 编号只在 Implement Gate 通过后按 main 的真实下一个编号确定。

### Authorization / Safety / Compliance Impact

如 D-5。Safety 无新状态；Compliance 仅继承合法 Person/guardian 前置，Evidence Core 不创建 child Person。

### API / Contract Impact

只新增 Message POST；internal Evidence contract 不暴露 HTTP。

### AI / RAG / Eval Impact

无 AI extraction、无 RAG、无 embedding、无 Promptfoo。HYPOTHESIS 作为领域类型存在不等于接模型。

### Async / Notification / Side-Effect Impact

无 Worker、pg-boss、notification。重试副作用只由 shared idempotency 抑制。

---

## Project Structure

未来 Implement 预期只涉及：

```text
packages/contracts/
packages/domain/
packages/authorization/
apps/server/api/
db/migrations/
tests/domain/
tests/db/
tests/integration/
packages/generated/
```

不得修改 `Docs/**` 或 Slice 1/2 frozen artifacts。

---

## Verification Plan

| Requirement / Acceptance | Future test/evidence | Expected |
|---|---|---|
| FR-001/002 | DB/domain structure | Assertion kinds 恰 3；Observation 独立；无 OBSERVATION kind |
| FR-005 | Observation round-trip | UNKNOWN/NOT_COLLECTED/DECLINED/NOT_APPLICABLE 保持；0/false 保持真实 |
| FR-003 | time tests | unknown occurred = state UNKNOWN + NULL；recorded_at server-owned |
| FR-004/016 | provenance matrix | 8 个既有 source_kind 全覆盖；前 4 类 writer/source-person/relationship 规则机械验证；设备/staff/AI/SOURCE_CONFIRMED 当前 production fail closed |
| FR-006 | conflict | 多来源同 group；无 winner/FACT side effect |
| FR-007 | supersedes | old row 保留；same Case/Family；self-reference reject；旧 row supersedes mutation denied；append-only production path 无法成环，无 graph detector |
| FR-008 | FACT capability + DB guard | FACT type存在；production exports/routes 无 FACT write/confirm/promote；`xiaoshuyin_app` + 正确 Family context INSERT FACT → DB reject；STATEMENT/HYPOTHESIS 在其它校验通过时可写 |
| FR-009 | message integration | raw message + audit + idem；auto Assertion count=0 |
| FR-010/011/021 | auth/RLS/person ref | wrong Family/Case/Person fail closed，无 leakage；internal writer 机械复核 `CASE_READ + FAMILY_MANAGEMENT + specific Case`；ordinary member / guardian 不能仅凭 RLS context 写入；所有非空 subject/source Person 均过 compliance gate；guardian relation 不授予 Family/Case access |
| FR-013/015 | OpenAPI route/error contract | 只新增 message POST，无 generic CRUD；401/404/409/422/500 的 `code` 可由 schema 机械校验 |
| FR-017 | concurrency/idempotency | replay original；mismatch 409；并发同 key 仅一条 message/audit |
| Audit | DB integration | metadata 无正文/PII；case_events 不镜像 |
| Gate | pre-Implement evidence | 依赖未满足即固定 BLOCKED |

未来 RED → GREEN 顺序：tests → reviewed migration → domain/repository → route → OpenAPI generation → full regression/governance/CI → independent Converge。

---

## Migration Strategy

本 Plan 不写 migration。未来 migration：

1. Gate 通过后读取 `db/migrations/`，取 Slice 1/2 final 后真实下一个编号。
2. 不修改旧 migration。
3. 先读取 `pg_constraint`，确认 audit / idempotency CHECK 名称。
4. 顺序：CREATE enums → dialogue_messages → assertions → observations → indexes/FKs/checks → ENABLE/FORCE RLS → policies（含 assertions INSERT 的 `kind <> 'FACT'` hard guard）→ grants → 扩 audit CHECK → 扩 idempotency command CHECK。
5. runtime app role 非 owner、NOBYPASSRLS；privileged FACT fixture 仅存在于隔离 test/migration context，不复用 production runtime role。
6. empty DB replay 与 existing DB upgrade 都必须通过。
7. 三表 RLS introspection 必须 true/true。
8. 禁止 `drizzle-kit push`。

---

## Rollback / Recovery

真实业务开放前可按 reviewed rollback plan 移除 Slice 3 新表/enum/policies/grants并恢复既有 CHECK 白名单；不得修改旧 migration。若已有真实 Evidence 数据，禁止 destructive automatic rollback，使用 forward-fix migration。

---

## Complexity Exceptions

无。

---

## Explicit Non-Goals

不新增 Participant、Assessment、Problem Formulation、Scene、Goal、Plan、Task、Safety table、AI、RAG、Memory、embedding、notification、generic Evidence CRUD、FACT confirmation workflow、conflict-resolution engine、correction propagation、Digital Use 专属字段、第二套 idempotency/audit/event framework。

**Plan 完成后停止；下一阶段只能进入 Checklist Review。**
