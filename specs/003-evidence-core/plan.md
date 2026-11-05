# Implementation Plan: Evidence Core（Statement / Observation / Fact / Hypothesis）

**Branch**: `feat/003-evidence-core`  
**Phase**: Phase 1 — Common Core 地基  
**Plan status**: Design only — NOT AUTHORIZED TO IMPLEMENT  
**Docs baseline**: `Docs/V1产品需求.md` v3.3 / `Docs/V1技术设计.md` v3.8

## Upstream Traceability

本 Plan 只实现/投影：

- V1-C02 — Statement / Observation / Fact / Hypothesis / provenance / time / confirmation 分离；
- V1-C03 — UNKNOWN / NOT_COLLECTED / DECLINED / N/A / CONFLICT 等真实状态不补值；
- V1-C21 — Evidence 访问由服务端 Authorization / Purpose / RLS 约束；
- V1-C23 — 来源、时间、版本/有效性可回溯；
- V1-C24 — AI 无事实最终确认权；
- V1-C28 — retry / duplicate submit 不制造重复业务结果；
- V1-C30 — Common Core 不硬编码 Digital Use；
- V1-X05 — 多来源冲突保持冲突；
- U05（部分）— 原始问题描述的 Case message 入口；
- `Docs/V1技术设计.md` §5、§7.0、§7.2、§7.10、§8.5、§9–§11、§23、§27A、§28.3、§32.3、§38。

本 Plan 不重新解释 Slice 1 / Slice 2，也不修改 `Docs/**`。

## Summary

Slice 3 在已冻结的 Identity / Family / Case 基线上增加最小 Evidence Core：

1. 新增 `dialogue_messages`、`assertions`、`observations` 三类正式表；不新建万能 `evidence_items`。
2. 复用 Slice 1 的 `provenance_source` 8 值 enum，不复制来源枚举。
3. `assertions.kind` 固定为 `STATEMENT | FACT | HYPOTHESIS`；Observation 独立。
4. message 只保存原始用户输入，不同步自动生成 Statement/Fact/Hypothesis。
5. 唯一新增 public route 为 `POST /api/v1/cases/:id/messages`；generic Evidence CRUD、Assessment、Problem Formulation、Scene、Participant 均不存在。
6. message 写入复用 shared idempotency：`actor_account_id + command_type + idempotency_key`，不建第二套 dedupe。
7. Evidence 的冲突、supersedes、validity 与 provenance 可追溯；不原地覆盖内容与来源。
8. 只允许当前已合法解析 Family 的 V1 管理主体走 HTTP message path；Participant 权限后置。
9. 实现阶段必须等 Slice 1、Slice 2 合并 main 且 Gate 全部 PASS；当前仅完成设计产物。

## Technical Baseline

冻结且必须复用：

- Node.js 26
- TypeScript
- Fastify 5 stable baseline
- PostgreSQL 18
- Drizzle ORM / drizzle-kit / node-postgres
- uuidv7() 主键
- Migrator / Runtime 双角色
- PostgreSQL RLS + `withRlsTransaction`
- Zod / OpenAPI typed contract
- shared `authorize()`
- shared `idempotency_keys`
- `case_events` / `business_audit_events`
- Vitest
- GitHub Actions 现有 CI

禁止引入：

- 新 ORM；
- event sourcing framework；
- generic knowledge graph；
- vector / embedding / RAG；
- AI SDK / model；
- new RBAC / Permission DSL；
- new dedupe table；
- public generic Evidence CRUD；
- XState。

## Constitution Check

| Check | Decision |
|---|---|
| Approved docs are authority | PASS — 所有语义有 V1-C / 技术设计映射 |
| Slice bounded | PASS — 仅 Evidence Core + approved message route |
| No AI autonomy | PASS — 无模型，FACT 无 public write path |
| Traceability | PASS — spec FR / SC 映射到 V1-C / § |
| Verification planned | PASS — DB/domain/integration/OpenAPI/RLS/idempotency |
| Safety/Auth/Compliance not bypassed | PASS — 复用现有 Case manager + RLS；Participant 后置 |
| No silent upstream change | PASS — `Docs/**` frozen |
| Unresolved blocker | PASS — Clarify 后无 blocking question |

**GATE: 当前仅代表 Plan 可继续。Implement Gate 见 D-1；未通过不得写业务代码。**

## Design

### D-1 Dependency / Implement Gate

Slice 3 设计分支从 `main@120fee22bd5939f35b9713efc21dd2af4384421d` 建立，以便与 Slice 1/2 并行设计。

Implement 前必须重新在最新 main 上验证：

- **G1** Slice 1 已 merge 到 main，Identity / Family / Consent / `provenance_source` / Authorization / RLS / idempotency 基线存在；
- **G2** Slice 2 已 merge 到 main，`cases` / `case_events` / Case RLS / Case auth / 3 个 Case route 存在；
- **G3** main CI required jobs 全绿；
- **G4** `Docs/V1产品需求.md` 与 `Docs/V1技术设计.md` 未出现影响 Slice 3 语义的新版；若有则先 reconcile spec/plan/tasks；
- **G5** `provenance_source` 仍为 Slice 1 冻结的 8 值，不另建来源 enum；
- **G6** shared `idempotency_keys` 仍支持新 command_type 增量，不需要第二套表；
- **G7** Slice 2 Case RLS 能通过 family context 限定 `case_id`；
- **G8** Slice 2 case-specific unauthorized/not-found 语义仍可复用为 `404 CASE_NOT_FOUND`；
- **G9** generated OpenAPI pipeline 可注册新 message route；
- **G10** no unresolved migration numbering / schema drift；
- **G11** branch 相对 merge 后 main 的所有冲突均已显式解决且没有偷偷修改 frozen specs。

任一失败 → `BLOCKED`，不得“先写代码再补”。

### D-2 Data Model

新增三表，全部：

- UUID v7 PK；
- `family_id` + `case_id` 明确归属；
- 通过 Case / Family 约束防止跨家庭伪造；
- ENABLE + FORCE RLS；
- Runtime role 无 DELETE；
- 不把 content/source 原地覆盖成新的业务事实。

#### dialogue_messages

最小字段：

- `id`
- `family_id`
- `case_id`
- `author_person_id`
- `content`
- `recorded_at`

规则：

- `recorded_at` 服务端生成；
- `author_person_id` 来自已验证 actor，不接受客户端指定；
- message 是原始来源，不是 FACT；
- 本 Slice 无 message edit / delete / list public API。

#### assertions

最小字段：

- `id`
- `family_id`
- `case_id`
- `kind`: `STATEMENT | FACT | HYPOTHESIS`
- `content`
- `source_kind`: 复用 `provenance_source`
- `subject_person_id`
- `source_person_id` nullable（按来源类型约束）
- `source_message_id` nullable
- `occurred_at` nullable
- `recorded_at` server-generated
- `valid_from` nullable
- `valid_until` nullable
- `confirmation_status`
- `supersedes_id` nullable
- `conflict_group_id` nullable

`confirmation_status` 在本 Slice 使用最小封闭集合：

- `UNCONFIRMED`
- `CONFIRMED`
- `DISPUTED`

但 **public route 不存在 FACT / CONFIRMED 写入口**。该 enum 是 schema 能力，不是本 Slice 的用户功能承诺。

#### observations

Observation 独立于 Assertion。最小字段：

- `id`
- `family_id`
- `case_id`
- `content` nullable
- `value_state`
- `source_kind`
- `subject_person_id`
- `source_person_id` nullable
- `source_message_id` nullable
- `occurred_at` nullable
- `recorded_at`
- `valid_from` nullable
- `valid_until` nullable
- `supersedes_id` nullable
- `conflict_group_id` nullable

`value_state` 只承担 Observation 当前这类记录需要的 collection/value 语义：

- `KNOWN`
- `UNKNOWN`
- `NOT_COLLECTED`
- `DECLINED`
- `NOT_APPLICABLE`

`CONFLICT` 不塞进该 enum：冲突由多条真实记录 + `conflict_group_id` 表达。  
`EXPIRED` 不塞进该 enum：由 `valid_until` / supersession 表达。

约束：

- `KNOWN` → `content IS NOT NULL`
- 其它状态 → 允许 `content IS NULL`，不得自动填 0 / false / “无”
- `valid_until >= valid_from`（两者均非空时）
- `supersedes_id != id`
- cross-case / cross-family supersedes 与 source_message 引用禁止。

### D-3 Provenance Reuse

必须复用 Slice 1 `provenance_source`：

- SELF_STATEMENT
- GUARDIAN_OBSERVATION
- GUARDIAN_RELAY
- OTHER_MEMBER_RELAY
- MANUAL_DEVICE_DATA
- STAFF_RECORD
- AI_HYPOTHESIS
- SOURCE_CONFIRMED

Slice 3 不新建 `evidence_source_kind`。

本 Slice runtime 可达来源白名单：

- message author：由 actor 身份确定，不由客户端提交 source_kind；
- internal Statement / Observation repository：允许与当前已实现 actor 能力匹配的前四类；
- MANUAL_DEVICE_DATA / STAFF_RECORD / AI_HYPOTHESIS / SOURCE_CONFIRMED 仅 schema 可表达，真实 caller 由后续对应 Slice 开放。

不能因为 enum 存在就宣称功能已开放。

### D-4 Message API

唯一新增 route：

`POST /api/v1/cases/:id/messages`

Request：

- `idempotencyKey: string`
- `content: string`

客户端不得提交：

- familyId
- authorPersonId
- sourceKind
- assertion kind
- fact/confirmation status
- phase/status
- participant identity

Response 201：

- id
- caseId
- authorPersonId
- content
- recordedAt

不返回 familyId，不返回内部 idempotency row。

Case 不存在 / wrong family / actor 无 Case 内容资格统一 `404 CASE_NOT_FOUND`，避免 case-specific existence leak。未认证 401；非法 body 422；shared idempotency mismatch 409。

### D-5 Message Idempotency

command type：`CASE_MESSAGE_CREATE`

scope：

`actor_account_id + CASE_MESSAGE_CREATE + idempotency_key`

canonical payload hash：

- verified caseId
- strict parsed `content`
- 不含 idempotencyKey
- 不含 client familyId（不存在该字段）

同 key + 同 hash → replay 原 201 body；  
同 key + 不同 hash → 409 `IDEMPOTENCY_PAYLOAD_MISMATCH`；  
并发同 key → 只有 1 message / 1 audit/event set。

所有 lookup / placeholder / insert / audit / response fill 在同一 `withRlsTransaction` 内。

### D-6 Message Does Not Auto-Create Evidence

事务成功后只存在：

- dialogue_message
- 对应最小 case_event / business_audit_event（见 D-10）
- idempotency result

不得同步自动创建：

- assertion
- observation
- problem_formulation
- scene state
- plan/task
- AI run
- memory

原因：自然语言 message 与结构化 Statement 不是 1:1；自动映射会制造假事实。

### D-7 Internal Evidence Contract

为后续 Slice 提供内部、非 public 的 repository/domain 能力：

- `recordAssertion(...)`
- `recordObservation(...)`

规则：

- 必须在已验证 family + case transaction 内；
- caller 必须显式提供 provenance；
- 不根据 Account 存在与否推断来源；
- source person / subject person 必须满足家庭归属与已批准边界；
- source_message_id 若提供，必须属于同 Case / Family；
- supersedes_id 若提供，必须同 Case / Family、同 entity type，且不能形成自环；
- 不提供“update assertion content/source”能力；
- 不提供“promoteToFact()”便捷函数；
- public API 未开放前，FACT / CONFIRMED 仅结构可表达，非 production caller 可达能力。

这里的内部 contract 是后续 Assessment / AI bounded extraction / Formulation 的稳定基础，不是新的产品入口。

### D-8 Unknown / Conflict Semantics

不建万能 epistemic_state。

- Assertion：confirmation + conflict_group + validity；
- Observation：value_state + conflict_group + validity；
- 未来 Assessment / Scene collection result：由后续 Slice 按 canonical node semantics 表达。

禁止：

- absence → false
- null → 0
- recorded_at → occurred_at
- latest row → winner
- source count → truth
- AI confidence → FACT

### D-9 Supersession / Validity

本 Slice采用 insert-new-history：

- 新 assertion / observation 可引用 `supersedes_id`；
- 旧行不 DELETE；
- 旧行内容/source/time 不 UPDATE；
- currentness 由 supersession chain + validity 计算；
- 本 Slice不实现下游 artifact invalidation，因为 downstream objects 尚不存在。

未来 correction propagation 接入时再扩展 §7.10 / §29.6。

### D-10 Case Event / Business Audit

message create 在同一事务写：

- `case_events.event_type = MESSAGE_RECORDED`
- `business_audit_events.event_type = MESSAGE_RECORDED`

metadata 仅允许：

- messageId
- version/schema marker（如实现需要）

**禁止**把 message content、Assertion content、孩子原话、PII 放进 event/audit metadata。

内部 assertion/observation repository 在未来真正由 production caller 使用时，必须同步定义对应 audit/event contract；本 Slice不为了“看起来完整”预造未来 event type 的 public 行为。

### D-11 Authorization / RLS

HTTP message route复用 Slice 2：

1. authenticate actor；
2. resolve current Family；
3. `authorize()` Case-specific action；
4. set family context；
5. 在 RLS 内读取目标 Case；
6. 0 row → 404；
7. message + audit/event + idempotency 同事务。

新增 authorization action：

- `CASE_MESSAGE_CREATE`

purpose 不新增，复用 Slice 2 当前 Case manager purpose。  
Participant / child 权限不在本 Slice。

新增三表 RLS：

`family_id = app_family_id()`

并使用 composite ownership constraints 保证 row 的 `case_id` 与 `family_id` 一致。

### D-12 Migration Strategy

Implement 时在 Slice 1/2 merge 后的 migration history 上追加一个 reviewed migration；不得修改历史 migration。

顺序：

1. 新 enums（assertion_kind / assertion_confirmation_status / observation_value_state）；
2. 若需要，给 cases 增加 supporting unique key `(id, family_id)`；
3. dialogue_messages；
4. assertions；
5. observations；
6. FK / indexes / constraints；
7. RLS policies；
8. grants；
9. migration replay verification。

不创建 vector extension、全文检索 index、JSON knowledge store。

### D-13 Indexes

只做 correctness / basic lookup 需要的最小 index：

- messages(case_id, recorded_at, id)
- assertions(case_id, recorded_at, id)
- assertions(conflict_group_id) where non-null
- assertions(supersedes_id) where non-null
- observations(case_id, recorded_at, id)
- observations(conflict_group_id) where non-null
- observations(supersedes_id) where non-null

不做 search / vector / ranking index。

### D-14 API / OpenAPI

- 新 route必须进入 generated OpenAPI；
- generated files禁止手改；
- contract source为 `contracts/messages-api.openapi.yaml` + route schema；
- generator二次运行 hash稳定；
- route audit必须证明没有 generic Evidence / Assessment / Formulation / Scene / Participant endpoint。

### D-15 Explicit Non-Implementation

本 Plan不允许：

- Participant；
- child invitation；
- Digital Use assessment；
- Scene node；
- Problem Formulation；
- FACT public confirmation；
- AI extraction；
- RAG；
- Memory；
- Safety；
- Goal / Plan；
- UI；
- search / embedding。

## Existing Contracts Reused

- Slice 1: `provenance_source`
- Slice 1: `authorize()`, RLS context, identity/family isolation
- Slice 1: `idempotency_keys`
- Slice 2: Case ownership / Case RLS / Case-specific 404 anti-enumeration
- Slice 2: `case_events` / `business_audit_events`
- existing Zod / OpenAPI generation pipeline

不得复制它们。

## Data and Migration Impact

新增：

- 3 enums
- 3 tables
- supporting constraints/indexes/RLS/grants
- 可能的 `cases(id,family_id)` supporting unique constraint（只为 FK correctness）

无删除、无历史表重命名、无 Docs change。

## Authorization / Safety / Compliance Impact

- Authorization：新增 `CASE_MESSAGE_CREATE`，复用现有 manager-only Case path。
- RLS：三张 Evidence 表全部 FORCE RLS。
- Safety：不实现，但 Evidence write不得绕过未来 Safety；当前无 Safety 状态时不虚构。
- Compliance：UNDER_14 正式 child Person 本身已由 Slice 1 consent-first gate保护；本 Slice不新增孩子端入口。
- Participant：未交付前无 child evidence API。

## API / Contract Impact

新增 1 个 public operation。其余 Evidence 仅 internal contract。

## AI / RAG / Eval Impact

无 AI / RAG。  
Eval 只做 deterministic provenance tests；Promptfoo 不进入本 Slice。

## Async / Notification / Side-Effect Impact

无 job、无 pg-boss、无 Notification。  
仅数据库事务内 message/audit/idempotency side effects。

## Project Structure

预期 implementation paths（Implement Gate 后才能创建/修改）：

```text
db/migrations/<next>_evidence_core.sql
packages/domain/src/evidence.ts
packages/domain/src/messages.ts
packages/contracts/src/messages.ts
apps/server/api/src/routes/messages.ts
scripts/openapi-generate.mjs
packages/generated/openapi.json
packages/generated/openapi.d.ts

tests/domain/evidence-provenance.test.ts
tests/domain/evidence-states.test.ts
tests/db/evidence-schema.test.ts
tests/db/evidence-rls.test.ts
tests/db/evidence-constraints.test.ts
tests/integration/messages.test.ts
tests/integration/messages-authorization.test.ts
tests/integration/messages-idempotency.test.ts
tests/integration/messages-scope.test.ts
tests/integration/openapi-messages.test.ts
```

若 merge 后实际 Slice 1/2 路径不同，Implement 前先 reconcile Plan/Tasks，不得硬套。

## Verification Plan

1. migration empty DB replay；
2. schema/enum/constraint introspection；
3. provenance source enum未复制；
4. assertion/observation type separation；
5. source/subject/time round-trip；
6. unknown state no-fill；
7. conflict group retains all rows；
8. supersession retains history；
9. wrong-family HTTP anti-enumeration；
10. direct app-role RLS 0 row / write denied；
11. message same-key replay；
12. concurrent same-key exactly one business result；
13. same key different content → 409 shared mismatch；
14. message does not auto-create Evidence / Formulation / Scene / AI；
15. route enumeration no out-of-scope route；
16. OpenAPI generator + drift check；
17. full regression；
18. governance check / coverage audit；
19. CI required jobs green。

## Rollback / Recovery

在未投产阶段：

- migration失败 → transaction rollback / isolated test DB reset；
- application rollout rollback不得删除已写 Evidence；
- schema rollback只允许在无真实数据且 reviewed condition 下；有数据后优先 forward fix；
- idempotency replay记录与 message必须保持一致，不能单独删一边制造 ghost replay。

## Complexity Exceptions

- **三表而非一张 Evidence 表**：不是过度设计；这是 §7.2 已批准的数据模型与 V1-C02 的类型分离要求。
- **family_id 冗余到子表**：用于 RLS 和 composite ownership correctness；不是第二真相源，Case 仍是业务归属主体。
- **Observation value_state 与 Assertion confirmation 分开**：为了不把不同业务语义压成万能 enum。
- **Internal Evidence contract 无 public CRUD**：是为了给后续 approved callers 一个稳定 domain boundary，同时避免发明用户功能。

无其它架构例外。
