# Feature Specification: Case 核心地基（cases / case_events / 单一主要 Case）

**Feature Directory**: `specs/002-case-core`  
**Created**: 2026-11-04  
**Status**: Draft  
**V1 Phase**: Phase 1 — Common Core 地基（`Docs/V1技术设计.md` §38）

> 本 Spec 是已批准 Xiaoshuyin 文档的下游实现投影，不得引入未获批准的产品语义。
>
> **Docs baseline**: `Docs/V1产品需求.md` **v3.3**、`Docs/V1技术设计.md` **v3.8**（2026-11-04）。
>
> **Slice 边界**: 本 Slice 只建立 Case 容器本身：真实、可归属、可隔离、可审计。它**不是**完整 Case 生命周期、证据体系、Problem Formulation 或参与体系的替身。

## Upstream Traceability

| Upstream ID / Section | Source | What this slice implements |
|---|---|---|
| V1-C01 | `Docs/V1产品需求.md` | 一个家庭有且只有一个当前主要未结 Case 执行主线；候选问题可以保留 |
| U04 | `Docs/V1产品需求.md` §23 | 查看当前主要 Case 与阶段的服务端能力（不交付页面） |
| U03（前置，不在此实现） | `Docs/V1产品需求.md` §23 | Case 只能建立在已经存在的 Family 上；Family 的建立属 Slice 1 |
| V1-C21 | `Docs/V1产品需求.md` | 跨成员 / 跨家庭信息必须按真实授权判定与隔离，不能靠前端隐藏或提示词假装隔离 |
| V1-C27 / V1-C28 | `Docs/V1产品需求.md` | 失败必须返回真实状态；重复提交、并发、重试不能制造重复业务结果 |
| §2.1 | `Docs/V1产品需求.md` | 一个家庭可以保留多个候选问题，但最多一个主要 Case 进入普通执行主线；切换主要 Case 是独立后续能力 |
| §2.4 | `Docs/V1产品需求.md` | 阶段与服务状态分开保存，不得混成一个字段 |
| §5 不变量 1 / 2 / 17 / 19 | `Docs/V1技术设计.md` | Case 与 Participant 分开；最多一个当前主要未结 Case；重复 / 并发不产生重复业务结果；只有当前 primary Case 可进入或恢复普通执行 |
| §6.1 / §6.2 | `Docs/V1技术设计.md` | Case Status 与 Phase 的正式词汇；二者独立存储，不可互相推导 |
| §6.6 / §6.7 | `Docs/V1技术设计.md` | 完整状态转换合同属于整个 V1；本 Slice 只创建初始状态，不实现任何转换命令 |
| §7.0 | `Docs/V1技术设计.md` | `uuidv7()` 主键基线；结构变更只经 reviewed migration file 进入环境 |
| §7.2 | `Docs/V1技术设计.md` | `cases` 与 `case_events` 属于 Case / 证据表组；本 Slice 只建 Case 容器，不建证据与判断对象 |
| §7.8 | `Docs/V1技术设计.md` | `case_events` 保留为领域历史与审计，不随查询投影或临时状态改写 |
| §8.1 | `Docs/V1技术设计.md` | 一个家庭最多一个当前主要未结 Case 由数据库保证，不能只靠前端或 AI runtime |
| §8.5 | `Docs/V1技术设计.md` | `actor_id + command_type + idempotency_key` 幂等合同；相同请求返回原结果，同 key 不同 payload 返回 409 |
| §8.6 | `Docs/V1技术设计.md` | Case 等关键聚合使用 version；旧版本请求不能覆盖新状态 |
| §9 | `Docs/V1技术设计.md` | 统一 `authorize()` 判定输入；按当前目标 Family 判定；客户端 `family_id` / `case_id` 仅为待验证参数；创建 Family 的 adult 是 V1 当前管理主体 |
| §9.1 | `Docs/V1技术设计.md` | RLS 作为家庭隔离第二道防线；`withRlsTransaction`；运行角色非 owner、NOBYPASSRLS；无上下文默认拒绝 |
| §28.3 | `Docs/V1技术设计.md` | Case API 契约面：`POST /api/v1/cases`、`GET /api/v1/cases`、`GET /api/v1/cases/:id` |
| §29.4（排除项依据） | `Docs/V1技术设计.md` | `SwitchPrimaryCase` 是独立的后续能力，本 Slice 不实现 |
| §37.2 | `Docs/V1技术设计.md` | 跨家庭和无授权访问属于硬阻断；幂等要求重试不重复产生业务结果；具体 p95 等在首次压测后冻结 |
| §38 Phase 1 | `Docs/V1技术设计.md` | 本 Slice 属于 Phase 1「Common Core 地基」，只切出 Case 容器这一刀 |

**Blocking rule**: If required behavior cannot be traced to an approved source, mark it `NEEDS UPSTREAM DECISION` and do not implement it.

**范围裁剪说明（为什么本 Slice 只有 Case 容器）**：`Docs/V1技术设计.md` §7.2 把 `cases`、`case_events` 与 `dialogue_messages`、`assertions`、`observations`、`problem_formulations`、`scene_node_states`、`scene_artifacts` 同列为一个表组，但它们的业务含义彼此独立。本 Slice 只建立 Case 容器与创建事件；证据、问题陈述、判断、Plan、Participant、Safety 等对象一律留给对应 Slice。为“让列表好看”或“让测试方便”而新增 title / summary / problem_description / evidence-like 自由文本，均不属于已批准需求。

## Owner Decisions（Confirmed，不作为 Open Question）

以下决定已由 Owner 确认，是本 Spec 的确定边界，不是本轮 Clarify 的提问项。

| # | 决定 | 本 Spec 的落实 |
|---|---|---|
| D1 | Case 创建时固定 `status = OPEN`、`phase = INTAKE`；本 Slice 不实现任何状态 / 阶段转换命令 | FR-003、FR-004、FR-005 |
| D2 | 当前 Case 管理 API 只向目标 Family 的 V1 管理主体开放：创建该 Family 的 adult Person；普通 membership 与 guardian relationship 都不自动授予 Case 访问 | FR-008、FR-009、FR-010、FR-024 |
| D3 | 第一个 Case 自动 `primary = true`，后续 Case 自动 `primary = false` 作为候选保存；一个 Family 最多一个当前 primary 未结 Case；本 Slice 不实现 `switch-primary` | FR-006、FR-007 |
| D4 | Case 不创建 title / summary / problem_description / description / 任何 evidence-like 自由文本；Case 只保存容器自身的最小 metadata | FR-015、FR-017 |
| D5 | 本 Slice 可在自己的分支增量扩展 Slice 1 的公共基础设施（authorize 的 Case 使用、Case RLS、`CASE_CREATE` 幂等类型、Case audit / `case_events`、Case migration），但不得修改 Slice 1 分支或重新设计其冻结基线 | Implementation Dependencies |
| D6 | 单 Case 详情对「ID 不存在 / 属于其他 Family / actor 无访问资格」统一返回 `404 CASE_NOT_FOUND`，不泄露 Case 是否存在或任何 Case 字段；`GET /api/v1/cases` 与 `POST /api/v1/cases` 在目标 Family 已合法解析但 actor 非该 Family 的 V1 管理主体时返回 `403 CASE_ACCESS_DENIED`；该对外语义不得削弱 RLS | FR-017、FR-019、FR-023、FR-024 |
| D7 | 本 Slice 不实现 Case read audit；两个读取端点不产生 `case_event` 或 `business_audit_event`，读取结果不因审计写入失败而改变；事件 / 审计只服务 Case 创建等真实写动作 | FR-014、FR-025、Key Entities |

## Clarifications

### Session 2026-11-04

- **Q1 — 单 Case 详情与 Family 级操作的 NOT_FOUND / DENIED 语义** → **RESOLVED（D6）**：`GET /api/v1/cases/:id` 对「Case ID 不存在 / Case 属于其他 Family / actor 无访问资格」统一返回 `404 CASE_NOT_FOUND`，响应不包含 Case 是否真实存在、Family ID、status、phase、primary、creator 或任何其它 Case 字段。`GET /api/v1/cases` 与 `POST /api/v1/cases` 在「当前目标 Family 已合法解析但 actor 不是该 Family 的 V1 管理主体」时返回 `403 CASE_ACCESS_DENIED`，不返回 Family 内 Case 数据，也不创建 Case。API 层统一 404 不得削弱数据库 RLS：无上下文仍为 SELECT 0 rows / write denied，错误 Family 上下文仍为 0 rows / denied。
- **Q2 — Case read audit** → **RESOLVED（D7）**：Slice 2 不实现 Case read audit。`GET /api/v1/cases` 与 `GET /api/v1/cases/:id` 不因读取创建 `case_event` 或 `business_audit_event`；普通 read 不得因为审计写入失败而改变读取结果。Case 创建仍在同一业务事务内产生 `Case + case_event + business_audit_event + idempotency result`。未来如正式的数据权利 / 安全审计需求要求访问日志，由对应 Slice 明确设计，不得在 Case Core 偷建第二套 access-log 语义。
- **Q3 — `CASE_CREATE` 的 different-payload 409 在 public API 的可达性** → **RESOLVED（本次最小澄清）**：当前 `POST /api/v1/cases` 的唯一合法业务请求体为 `{"idempotencyKey": "..."}`；去掉幂等键后 canonical body 恒为 `{}`，因此当前命令形状下**不存在第二种合法业务 payload**。public API 必须验证的行为是：同一 `actor + CASE_CREATE + idempotencyKey` 重放时返回原 Case、不新建 Case、不追加 `case_event`、不追加 `business_audit_event`；并发同 key 只产生一个 business result，其余为 replay。§8.5 的「same scope key + different canonical payload hash → 409 `IDEMPOTENCY_PAYLOAD_MISMATCH`」合同**仍然保留**，但该分支必须在 shared idempotency domain / repository contract 层验证：不得伪造一个不可能存在的 HTTP 场景，不得通过切换 actor（会改变 scope）制造假 mismatch，也不得为了测试可达而新增无业务意义字段。

其余 Owner Decisions D1–D5 已确认，本轮不重新打开。

## Scope

### In Scope

1. **`cases` 容器**：真实、可持久化、可归属到唯一 Family 的 Case 对象（§7.2）。
2. **`case_events` 领域历史**：至少记录 Case 创建事件，供审计与后续领域历史使用（§7.2、§7.8）。
3. **Case ↔ Family 归属**：每个 Case 必须属于当前目标 Family；Case 与 Family 的归属在创建后不可迁移（§9、§28.3）。
4. **Case 创建者 / 发起 metadata**：记录发起该 Case 的 Person 与服务端创建时间；创建者由服务端根据已验证 actor 写入，客户端不得指定（§8.5、§9）。
5. **Case Status**：独立保存 `status`，取值词汇遵循 §6.1；本 Slice 只允许创建 `OPEN`。
6. **Case Phase**：独立保存 `phase`，取值词汇遵循 §6.2；本 Slice 只允许创建 `INTAKE`。
7. **`primary` 语义**：标识当前 Family 的主要 Case；每个 Family 最多一个当前 primary 未结 Case（§8.1、V1-C01）。
8. **Case version**：Case 聚合携带 `version`，创建时从一个确定初始版本开始，供 §8.6 的乐观并发合同使用。
9. **第一个 Case 自动 primary**：Family 尚无当前 primary 未结 Case 时，首个成功创建的 Case 成为 primary。
10. **后续 Case 候选化**：已有当前 primary 未结 Case 时，后续 Case 创建为候选（`primary = false`），并真实保留。
11. **一个 Family 至多一个当前 primary 未结 Case**：由数据库约束保证，并可在并发下验证（§8.1）。
12. **`POST /api/v1/cases`**：创建 Case；请求体 MUST 采用 strict schema，唯一合法业务字段为 `idempotencyKey`；任何未声明字段 MUST 返回 `422 VALIDATION_ERROR` 且零业务写入；不接受任何 Case 内容字段或客户端指定的状态 / 阶段 / primary / version（§28.3）。
13. **`GET /api/v1/cases`**：读取当前 Family 的 Case 集合，并区分 primary 与 candidate（§28.3、U04）。
14. **`GET /api/v1/cases/:id`**：读取单个 Case；同时返回彼此独立的 `status` 与 `phase`（§28.3、§6.1、§6.2）。
15. **当前 primary Case 的读取语义**：由 `GET /api/v1/cases` 的同一数据源表达；不得新增 `/cases/current` 之类的第二真相源，也不得把 primary 复制到另一张表（U04、§28.3）。
16. **Case 级家庭隔离**：应用层授权判定 + 数据库 RLS 双层防线；`case_id` / `family_id` 只作为待验证参数（§9、§9.1、V1-C21）。
17. **Case RLS**：`cases` 与 `case_events` 必须启用并强制 RLS，无上下文默认拒绝（§9.1）。
18. **Case 创建幂等**：`CASE_CREATE` 属于关键命令，遵循 §8.5 合同；相同幂等键 + 相同 canonical payload（含并发同 key）返回原结果且只有一个业务结果；shared idempotency 合同对「相同 scope key + 不同 canonical payload hash」仍返回 409。本 Slice 的 public `POST /api/v1/cases` 请求体除 `idempotencyKey` 外无可变业务字段，因此 HTTP 层不存在可达的合法 different-payload 请求（见 Clarifications Q3）。
19. **Case 创建留痕**：创建 Case 必须在同一业务事务内产生 `case_event` 与 `business_audit_event`，不得出现“Case 已存在但无创建证据”的中间状态（§7.8、§7.9、§38）。普通读取不产生这两类记录，也不依赖审计写入成功（D7）。
20. **U04 服务端能力**：能读取当前主要 Case 及其阶段；无 Case 时返回真实的空结果，不伪造默认 Case（U04）。

### Out of Scope

- Case Participant、参与邀请、孩子端参与流程（§10、§28.8）。
- Statement、Observation、Fact、Hypothesis、`assertions`、`dialogue_messages`（§7.2）。
- Assessment、`scene_node_states`、`scene_artifacts`（§7.2）。
- Problem Formulation、Goal、Intervention、Plan / PlanVersion、Task / Checkin、Review、Outcome / Closure / Referral（§7.3、§6.3—§6.5）。
- 任何 Case Status 转换命令：`WaitForInformation`、`ResumeAfterInformation`、`PauseCase`、`ResumeCase`、`MarkLostContact`、`UserReturned`、`EnterSafetyHold`、`ResolveRisk`、`CloseCase`、`CreateRecurrence`（§6.6、§23）。
- 任何 Phase 转换命令：`StartAssessment`、`PresentProblemFormulation`、`ConfirmProblemFormulation`、`ReassessFromFormulation`、`ConfirmGoal`、`ActivatePlan`、`OpenReview`、`CompleteReview`、`EnterMaintenance`、`MaintenanceReview`（§6.7、§23）。
- `switch-primary` / `SwitchPrimaryCase`；候选 Case 在本 Slice 不能晋升为 primary（§29.4、§28.3）。
- SAFETY_HOLD 实现、Safety State、Safety 副作用、Referral（§27、§7.7）。
- recurrence、Scene、Digital Use、目标清单、手机合约、角色扮演（§12、§28.5—§28.6）。
- AI、RAG、Memory、Follow-up Schedule、Notification、pg-boss（§13—§26）。
- 微信小程序 UI、运营后台 UI（§28A）。
- 数据权利（查看 / 更正 / 导出 / 删除）与更正传播（U18、§28.9、§29.6）。
- Case 访问日志 / read-audit / 访问频次分析：本 Slice 不实现；未来若正式的数据权利或安全审计需求要求访问日志，由对应 Slice 明确设计（D7）。
- 完整 Authorization 平台：Case 角色、RBAC、Visibility Matrix、Participant 权限、Purpose / Consent 的完整矩阵（§9、§10、§29.5）。
- V2—V5 capabilities not required by this slice.

### Non-Goals

- 不实现完整 Case 状态机或“先建空壳后续再填”的转换命令。
- 不为了列表展示或测试方便而给 Case 增加 title / summary / description / problem_description / 自由文本字段。
- 不把普通 Family membership、guardian 关系或“知道 case_id”当作 Case 访问权限。
- 不提前决定孩子、其他家庭成员、未来 Participant 能看到什么。
- 不为未来 Participant / Visibility 预造权限 DSL、角色表、空接口或占位路由。
- 不新增与正式 API 冲突的“当前 Case”第二真相源。
- 不优化性能基线、容量或成本；只要求确定性正确、可验证隔离与真实失败状态。

## User Scenarios & Testing

### User Story 1 — Family 管理主体创建第一个 Case (Priority: P1)

某已有 Family 的 V1 管理主体（创建该 Family 的 adult Person）为该 Family 创建第一个 Case。系统创建真实的 Case 容器，固定 `status = OPEN`、`phase = INTAKE`，自动标记为 `primary = true`，并留下创建事件与审计证据。系统不要求 title、问题描述、证据或 Participant。

**Upstream IDs**: V1-C01、U03（前置）、U04、§2.1、§6.1、§6.2、§7.2、§8.1、§28.3

**Independent Test**: 仅使用已存在的 Family + 一次 `POST /api/v1/cases`，断言 Case 落库、归属正确、status/phase 独立、primary=true、version 已初始化、创建事件与审计存在；断言不存在任何内容字段或越界对象。

### User Story 2 — 同一 Family 创建后续候选 Case (Priority: P1)

同一 Family 已有 primary Case 时，管理主体再次创建 Case。系统创建第二个 Case，固定 `OPEN + INTAKE`，自动 `primary = false`。该候选 Case 被真实保留并可读取，但不会开启第二条执行主线，也不会产生 Plan / Task / Follow-up / Notification 等副作用。

**Upstream IDs**: V1-C01、§2.1、§8.1、§5 不变量 2 / 19

**Independent Test**: 连续创建两个 Case，断言第一个 primary=true、第二个 primary=false，二者均可读取，且系统中不存在任何执行、提醒或 AI 副作用。

### User Story 3 — 管理主体查看当前主要 Case 与阶段 (Priority: P1)

管理主体通过 `GET /api/v1/cases` 查看当前 Family 的 Case 集合，能识别哪一个是当前 primary Case，并读取其 `phase`；也可通过 `GET /api/v1/cases/:id` 读取单个 Case 的 `status` 与 `phase`。读取使用同一数据源，不存在第二个“当前 Case”真相源。

**Upstream IDs**: U04、§2.4、§6.1、§6.2、§28.3

**Independent Test**: 一个有 primary Case 的 Family 调用列表与详情，断言 primary 可被唯一识别、phase 正确、status 与 phase 分别返回；无 Case 的 Family 返回空结果而不是伪造 Case；详情对不存在 ID 返回 `404 CASE_NOT_FOUND`。

### User Story 4 — Case 访问必须经过当前 Family 与 V1 管理主体判定 (Priority: P1)

只有目标 Family 的 V1 管理主体能创建、列出、读取该 Family 的 Case。普通成员以及任何跨家庭 actor 都被拒绝；guardian relationship 不构成 Case 管理资格（即使 actor 同时是目标 Family 成员）；若 actor 不是目标 Family 成员，则 current Family 无法合法解析，沿用 Slice 1 的 Family 授权 / current-family 语义，Case 端点不返回任何 Case 数据。数据库 RLS 作为第二道防线在无上下文或跨家庭上下文下返回零行 / 拒绝。对外错误语义固定为：单 Case 详情对不存在、跨 Family、无访问资格统一 `404 CASE_NOT_FOUND`；列表 / 创建在目标 Family 已合法解析但 actor 非管理主体时 `403 CASE_ACCESS_DENIED`。

**Upstream IDs**: V1-C21、§9、§9.1、§37.2、D6

**Independent Test**: 用「目标 Family 成员但非管理主体」身份、Family A 身份分别访问 Family B Case 与无 RLS 上下文的直连查询，断言应用层与数据库层都失败，且响应不泄露目标 Case 字段；单 Case 详情统一返回 `404 CASE_NOT_FOUND`，列表 / 创建在 Family 已合法解析但非管理主体时返回 `403 CASE_ACCESS_DENIED`。另以「guardian 但不是目标 Family 成员」身份验证 current Family 未合法解析时沿用 Slice 1 Family 语义且不返回 Case 数据；以「guardian + Family 成员但非管理主体」身份验证仍为 403 / 404。

## Acceptance Scenarios

1. **Given** 一个已有 Family 且该 Family 尚无任何 Case，**When** 该 Family 的管理主体调用 `POST /api/v1/cases`，**Then** 创建一个真实 Case，`status = OPEN`、`phase = INTAKE`、`primary = true`，归属当前 Family，`version` 已初始化，且响应不包含任何内容字段。**Upstream**: V1-C01、U04、§2.1、§6.1、§6.2、§8.1、§28.3
2. **Given** 同一 Family 已存在一个 primary 未结 Case，**When** 管理主体再创建一个 Case，**Then** 新 Case 为 `OPEN + INTAKE` 且 `primary = false`，被真实保留并可读取；旧 primary 不变。**Upstream**: V1-C01、§2.1、§8.1、§5 不变量 2
3. **Given** 同一 Family 尚无 Case，**When** 两个不同幂等键的创建请求并发执行，**Then** 所有事务完成后该 Family 的当前 primary 未结 Case 不超过一个；不存在两个 `primary = true` 的未结 Case，也不存在重复业务结果。**Upstream**: §8.1、§5 不变量 17、V1-C28
4. **Given** 同一 Family 有 1 个 primary 与至少 1 个候选 Case，**When** 管理主体调用 `GET /api/v1/cases`，**Then** 返回该 Family 的 Case 集合，且每个 Case 能区分 `primary` 与 non-primary，并暴露各自的 `phase`；不得返回其他 Family 的 Case。**Upstream**: U04、V1-C01、§28.3、§9
5. **Given** 一个已创建的 Case，**When** 管理主体调用 `GET /api/v1/cases/:id`，**Then** 返回该 Case 的 `status` 与 `phase` 两个独立字段；二者不得被合并成一个组合枚举或互相推导。**Upstream**: §2.4、§6.1、§6.2、§28.3
6. **Given** Family A 的管理主体与 Family B 的一个 Case，**When** A 使用 B 的 `case_id` 发起 Case 详情读取，**Then** 返回 `404 CASE_NOT_FOUND`，响应不包含 Family B 的任何 Case 字段，也不泄露该 Case ID 是否真实存在；以运行角色在 A 的 RLS 上下文直连查询，数据库层同样返回零行。**Upstream**: V1-C21、§9、§9.1、§37.2、D6
7. **Given** 数据库连接没有任何 `app.family_id` / 身份上下文，**When** 查询 `cases` 或 `case_events`，**Then** 返回零行；写入被拒绝，而不是默认放行。**Upstream**: §9.1
8. **Given** 一个 Family 中不是该 Family 创建者的普通成员，**When** 尝试创建、列出或读取该 Family 的 Case，**Then** 服务端拒绝：创建 / 列表返回 `403 CASE_ACCESS_DENIED` 且不返回 Case 数据；单 Case 详情返回 `404 CASE_NOT_FOUND` 且不泄露 Case 是否存在；普通 membership 不自动推导 Case 管理访问。**Upstream**: §9、D2、D6、V1-C21
9. **场景 A — guardian + Family 成员，但不是管理主体**：**Given** actor 是目标 Family 的合法 `family_member`，current Family 已成功解析为该 Family，actor 对该 Family 中某未成年人具有 guardian relationship，但 actor 不是 `families.created_by_person_id`，因而不是 V1 管理主体；**When** actor 访问该 Family 的 Case，**Then** `POST /api/v1/cases` 返回 `403 CASE_ACCESS_DENIED` 且不创建 Case，`GET /api/v1/cases` 返回 `403 CASE_ACCESS_DENIED` 且不返回 Case 数据，`GET /api/v1/cases/:id` 返回 `404 CASE_NOT_FOUND` 且不泄露 Case 是否存在；guardian relationship 不因叠加 Family membership 而获得 Case 管理权。**Upstream**: §9、D2、D6

   **场景 B — guardian 但不是目标 Family 成员**：**Given** actor 具有 guardian relationship，但不是目标 Family 的 `family_member`；**When** actor 访问该 Family 的 Case，**Then** current Family 尚未合法解析为目标 Family，系统 MUST 沿用 Slice 1 的 Family 授权 / current-family 语义且不返回任何 Case 数据；本 Slice MUST NOT 新增 Family 错误码，MUST NOT 将该场景强制转换为 `CASE_ACCESS_DENIED` / `CASE_NOT_FOUND`，该场景也不用于验证 Case manager 权限。**Upstream**: §9、D2、D6、FR-024
10. **Given** 同一个 `CASE_CREATE` 幂等键与相同 canonical payload 已被处理，**When** 客户端重试相同请求（含并发同 key），**Then** 只有一个业务结果：返回原 Case，不创建第二条 Case，不追加第二组 `case_event` / `business_audit_event`。**Given** shared idempotency 合同收到「相同 scope key + 不同 canonical payload hash」，**Then** 返回 MISMATCH 并映射为 `409 IDEMPOTENCY_PAYLOAD_MISMATCH`，不修改原 Case。本 Slice 的 public `POST /api/v1/cases` 请求体除 `idempotencyKey` 外无可变业务字段，因此该 MISMATCH 分支在共享幂等基础设施层验证，不在 HTTP 层伪造。**Upstream**: §8.5、V1-C28
11. **Given** 一次成功的 Case 创建，**When** 检查领域历史与审计，**Then** 存在与该 Case 对应的 `case_event` 与 `business_audit_event`，且 Case 落库、事件与幂等重放快照构成同一业务事务的结果；不得出现 Case 已存在但无创建证据的持久状态。**Upstream**: §7.8、§7.9、§38
12. **Given** 本 Slice 的数据库结构与路由清单，**When** 做结构 / 路由断言，**Then** 不存在 `case_participants`、`assertions`、`observations`、`problem_formulations`、`scene_node_states`、`scene_artifacts`、`dialogue_messages`、Safety / Plan / Task / Notification 等越界表；不存在 pause / resume / switch-primary / close / recurrences / messages / assessments / participants 等越界路由或空壳实现。**Upstream**: §7.2、§28.3、Out of Scope
13. **Given** 创建请求体除 `idempotencyKey` 外还携带任何未声明字段（如 `familyId`、`createdByPersonId`、`creator`、`status`、`phase`、`primary` / `isPrimary`、`version`、`title`、`summary`、`description`、`problemDescription`，或任何 Evidence / Participant / 内容字段），**When** 请求被处理，**Then** 该请求 MUST 因 strict schema 被拒绝为 `422 VALIDATION_ERROR`，且零业务写入：不创建 Case、不创建 `case_event`、不创建 `business_audit_event`、不留下新的业务幂等结果；不得忽略非法字段后继续用服务端值创建。**Upstream**: §6.1、§6.2、§8.1、§8.6、§9、§28.3、D4
14. **Given** 一个 Family 有多个候选 Case，**When** 管理主体读取列表，**Then** 所有候选 Case 都真实存在且可区分；本 Slice 不提供任何将候选晋升为 primary 的路径。**Upstream**: V1-C01、§2.1、§29.4（排除）
15. **Given** 一个 Family 没有任何 Case，**When** 管理主体读取 Case 列表，**Then** 返回真实空结果；不得返回 placeholder、默认 Case 或由前端补造的主要 Case。**Given** 详情请求一个不存在的 Case ID，**Then** 返回 `404 CASE_NOT_FOUND`。**Upstream**: U04、V1-C01、V1-C27、D6
16. **Given** 一个已创建的 Case，**When** 管理主体调用 `GET /api/v1/cases` 或 `GET /api/v1/cases/:id`，**Then** 读取成功返回数据，且 `case_events` 与 `business_audit_events` 的记录数不因该读取增加；读取路径不依赖任何审计写入成功。**Upstream**: §7.8、D7、FR-025

## Edge, Failure, and Unknown States

- **并发首 Case**：并发创建使用不同幂等键时，最终最多一个 primary 未结 Case；使用相同幂等键时，只产生一个 Case 与一个原结果。不得以“最后写入者获胜”留下两个 primary。
- **无 Case**：列表对管理主体返回空集合，详情对不存在 ID 返回 `404 CASE_NOT_FOUND`；不得伪造 `OPEN + INTAKE` 占位对象，也不得在响应中提示该 ID 是否真实存在。
- **跨家庭 ID**：`case_id` / `family_id` 只是待验证参数；ID 存在不代表有权访问。单 Case 详情对跨家庭 ID 返回 `404 CASE_NOT_FOUND`，且响应不携带目标 Case 的任何字段或存在性信息（§9、§37.2、D6）。
- **RLS 无上下文**：`cases` / `case_events` 的查询返回零行，写入被拒绝；不得因为缺少上下文而放宽策略（§9.1）。
- **错误 family 上下文**：`app.family_id` 必须是当前请求的目标 Family；不得由 `app.person_id` 反推或替换。上下文与 Case 归属不一致时结果为空 / 拒绝（§9.1）。
- **非管理主体**：普通成员、未成年成员、非管理主体的 guardian 均无 Case 管理访问；该拒绝由服务端判定，不依赖前端隐藏。当前目标 Family 已合法解析时（含 guardian 同时是目标 Family 成员的情形），创建 / 列表返回 `403 CASE_ACCESS_DENIED` 且不返回 Family 内 Case 数据；单 Case 详情返回 `404 CASE_NOT_FOUND`（§9、D2、D6）。若 actor 不是目标 Family 成员（包括仅有 guardian relationship 的情形），current Family 未合法解析，沿用 Slice 1 的 Family 授权 / current-family 语义且不返回 Case 数据；不得转换为 Case 层 403 / 404，也不得据此验证 Case manager 权限（FR-024）。
- **未来状态不可达**：即使数据库可以表达 §6.1 / §6.2 的完整词汇，本 Slice 也不存在任何可达路径把 Case 改成 `WAITING` / `PAUSED` / `CLOSED` 或 `ASSESSMENT` 等状态；不得创建“演示用”的转换接口。
- **未来副作用不得伪造**：创建候选 Case 不得触发 Plan、Task、Follow-up、Notification、AI run、Memory 或 Safety 副作用；这些对象在本 Slice 不存在。
- **客户端越权字段**：`POST /api/v1/cases` 的 strict 请求体只接受 `idempotencyKey`；客户端提交任何未声明业务字段（status、phase、primary、version、creator、familyId、title / summary / description / problemDescription 或任何 Evidence / Participant / 内容字段）MUST 返回 `422 VALIDATION_ERROR`，且不创建 Case、不写 `case_event`、不写 `business_audit_event`、不留新的业务幂等结果；不得忽略非法字段后继续用服务端值创建。
- **幂等 mismatch 可达性**：本 Slice 的 `POST /api/v1/cases` 请求体除 `idempotencyKey` 外没有可变业务字段，因此 public API 不存在合法的第二种业务 payload，`409 IDEMPOTENCY_PAYLOAD_MISMATCH` 在 HTTP 层不可达。不得通过切换 actor（会改变幂等 scope）、伪造 Family 上下文或新增无业务意义字段制造 mismatch；§8.5 的 mismatch→409 合同仍在 shared idempotency 基础设施层保持并验证。
- **事务失败**：幂等记录、Case、`case_event`、`business_audit_event` 任一写入失败时，整个业务事务失败并返回真实错误；不得出现部分成功的“假成功”。
- **对外 404 / 403 语义**：单 Case 详情将「不存在 / 跨 Family / 无访问资格」统一为 `404 CASE_NOT_FOUND`，不得通过状态码或响应体差异泄露某个 Case ID 是否存在；当前 Family 已合法解析但 actor 非管理主体的集合 / 创建操作返回 `403 CASE_ACCESS_DENIED`。两种语义 MUST NOT 互相替代，也 MUST NOT 削弱 RLS 的零行 / 拒绝行为（D6、FR-023、FR-024）。
- **读审计**：本 Slice 不对 `GET /api/v1/cases` 与 `GET /api/v1/cases/:id` 写入 `case_event` 或 `business_audit_event`；读取结果 MUST NOT 因审计写入而改变。未来若正式的数据权利 / 安全审计需求要求访问日志，由对应 Slice 明确设计，不得在 Case Core 引入第二套 access-log 语义（D7、FR-025）。

## Requirements

- **FR-001** [UPSTREAM: §7.2 / §5 不变量 1] 系统 MUST 建立独立的 `cases` 容器与 `case_events` 领域历史；MUST NOT 把 Case 与 Participant、Statement、Observation、Fact、Hypothesis、Problem Formulation 或 Scene 对象合并。
- **FR-002** [UPSTREAM: §7.0] `cases` MUST 使用 `uuidv7()` 主键基线；结构变更 MUST 只经 reviewed migration file 进入环境，MUST NOT 以 `drizzle-kit push` 作为变更流程。
- **FR-003** [UPSTREAM: §6.1 / §6.2 / §2.4 / D1] `status` 与 `phase` MUST 独立持久化，MUST NOT 合并成单一字段、组合枚举或互相推导；取值词汇 MUST 遵循 §6.1 与 §6.2，不得新增、改名或重排。
- **FR-004** [UPSTREAM: §6.1 / §6.2 / D1] 本 Slice 创建的 Case MUST 固定为 `status = OPEN`、`phase = INTAKE`；任何客户端输入或本 Slice 可达路径 MUST NOT 写入其他状态 / 阶段。
- **FR-005** [UPSTREAM: §6.6 / §6.7 / §23 / D1] 本 Slice MUST NOT 实现、暴露或空壳化任何 Case Status / Phase 转换命令、转换端点或转换服务；MUST NOT 伪造 Safety、Plan、Notification、Schedule 等转换副作用。
- **FR-006** [UPSTREAM: V1-C01 / §2.1 / §8.1 / D3] 一个 Family 最多一个当前 primary 未结 Case；`未结` 按 `status != CLOSED` 理解。该不变量 MUST 由数据库层保证，MUST NOT 只靠前端、应用层查询或 AI runtime。
- **FR-007** [UPSTREAM: §8.1 / V1-C01 / D3] 当 Family 尚无当前 primary 未结 Case 时，首个成功创建的 Case MUST 自动 `primary = true`；已有当前 primary 未结 Case 时，后续 Case MUST 自动 `primary = false` 并作为候选真实保留。客户端 MUST NOT 指定或覆盖 `primary`。
- **FR-008** [UPSTREAM: §9 / D2] 本 Slice 的 Case 创建、列表、读取 MUST 只向当前目标 Family 的 V1 管理主体开放：创建该 Family 的 adult Person。资格 MUST 基于 Slice 1 已冻结的 Family 创建者 / adult 管理主体语义判定，MUST NOT 重新定义、放宽或扩展。
- **FR-009** [UPSTREAM: §9 / D2] 普通 Family membership MUST NOT 自动推导 Case 管理访问；guardian relationship MUST NOT 替代 Case access；MUST NOT 创建 Case role、RBAC、Visibility Matrix 或 Participant 权限 DSL。
- **FR-010** [UPSTREAM: §9 / §9.1 / V1-C21] 客户端传入的 `case_id` / `family_id` MUST 只作为待验证参数；Case MUST 属于当前目标 Family，ID 存在 MUST NOT 构成访问依据；跨家庭访问 MUST 在应用层与数据库层都失败，且不得泄露目标 Case 字段。
- **FR-011** [UPSTREAM: §9.1] `cases` 与 `case_events` MUST 启用并强制 RLS；运行账号 MUST NOT 为 table owner、MUST NOT 具备 BYPASSRLS；无上下文 MUST 默认拒绝而不是放行。所有家庭级读写 MUST 通过统一的 `withRlsTransaction` 语义设置当前目标 Family 上下文后执行。
- **FR-012** [UPSTREAM: §8.5 / D5] `CASE_CREATE` MUST 遵循 `actor_id + command_type + idempotency_key` 幂等合同：相同键 + 相同 canonical payload MUST 返回原结果且不重复写入，并发同 key MUST 只有一个业务结果。§8.5 的「相同 scope key + 不同 canonical payload hash → 409」合同 MUST 在 shared idempotency domain / repository contract 层保持并验证。当前 `POST /api/v1/cases` 的唯一合法业务请求体为 `{idempotencyKey}`，去掉幂等键后没有其它可变业务字段，因此本 Slice 的 HTTP 层不存在可达的合法 different-payload 请求；MUST NOT 通过切换 actor（改变 scope）或新增无业务意义字段伪造该分支。canonical command context MAY 包含服务端已验证的当前目标 Family ID（用于防止未来跨 Family 回放），但客户端 MUST NOT 提交 `familyId`。
- **FR-013** [UPSTREAM: §8.6] `cases` MUST 携带 `version` 作为乐观并发基础；创建时 MUST 从确定初始版本开始并在读取中返回；本 Slice MUST NOT 新增任何修改 Case 的命令，也不得伪造后续版本的 If-Match / 更新语义。
- **FR-014** [UPSTREAM: §7.8 / §7.9 / §38] 每次成功创建 Case MUST 在同一业务事务内产生对应的 `case_event` 与 `business_audit_event`；幂等重放 MUST NOT 追加第二组创建事件或审计事件；`case_events` MUST 作为领域历史与审计保留，MUST NOT 通过覆盖或删除历史事件来伪造当前状态。
- **FR-015** [UPSTREAM: §28.3 / D4] `POST /api/v1/cases` MUST 采用 strict 请求体契约，唯一合法业务字段为 `idempotencyKey`。任何未声明字段（包括但不限于 `familyId`、`createdByPersonId`、`creator`、`status`、`phase`、`primary` / `isPrimary`、`version`、`title`、`summary`、`description`、`problemDescription`，以及任何 Evidence / Participant / 内容字段）MUST 被拒绝为 `422 VALIDATION_ERROR`，且该请求 MUST 零业务写入：MUST NOT 创建 Case、`case_event`、`business_audit_event`，MUST NOT 留下新的业务幂等结果。系统 MUST NOT 忽略非法字段后继续用服务端值创建；MUST NOT 接受或保存 title、summary、problem_description、description 或任何 evidence-like 自由文本；MUST NOT 接受客户端指定的 status、phase、primary、version、creator 或 Family 迁移。
- **FR-016** [UPSTREAM: §28.3 / U04] `GET /api/v1/cases` MUST 返回当前目标 Family 的 Case 集合，并暴露足以识别当前 primary Case 以及每个 Case 自身 `phase` 的信息；当前 primary Case MUST 由同一 Case 数据源表达，MUST NOT 通过列表排序、派生缓存或第二张表伪造唯一真相。
- **FR-017** [UPSTREAM: §28.3 / D4 / D6] `GET /api/v1/cases/:id` MUST 返回单个 Case 的独立 `status` 与 `phase`，并只在该 Case 属于当前目标 Family 且 actor 有权访问时返回；MUST NOT 返回内容字段或越界对象。当 Case 不存在、属于其他 Family 或 actor 无访问资格时，MUST 返回统一 `404 CASE_NOT_FOUND`，响应 MUST NOT 泄露 Case 是否存在、Family ID、status、phase、primary、creator 或任何其它 Case 字段（FR-023）。
- **FR-018** [UPSTREAM: §28.3 / Out of Scope] 本 Slice MUST NOT 暴露 `/cases/current`、`pause`、`resume`、`switch-primary`、`close`、`recurrences`、`messages`、`assessments`、`participants` 或任何未列入 FR-015—FR-017 的 Case 路由 / 占位实现。
- **FR-019** [UPSTREAM: V1-C27 / V1-C28 / §37.2] 创建、列表、读取的操作 MUST 返回真实状态：无权、未找到、冲突、幂等重放、数据库拒绝均不得伪装成成功；失败时 MUST NOT 留下部分写入的 Case 或事件。列表 / 创建与详情 MUST 按 FR-023 / FR-024 的固定错误语义返回，MUST NOT 用状态码或响应差异泄露 Case 是否存在。
- **FR-020** [UPSTREAM: §7.2 / §9 / D5] 本 Slice MUST NOT 创建 `case_participants`、参与邀请、Statement / Observation / Fact / Hypothesis、Problem Formulation、Assessment、Safety State、Plan / Task / Notification 等对象、表、路由或抽象；未来能力 MUST NOT 以 placeholder 形式进入本 Slice。
- **FR-021** [UPSTREAM: V1-C01 / §5 不变量 19] 候选 Case MUST 被真实保留并可读取，但 MUST NOT 因创建而进入普通执行、激活 Plan、创建 Follow-up Schedule 或产生提醒；本 Slice 不存在这些副作用的对象与路径。
- **FR-022** [UPSTREAM: U04 / V1-C27] Family 没有 Case 时，列表 MUST 返回真实空结果；系统 MUST NOT 伪造默认 Case、placeholder Case 或不存在的 primary。
- **FR-023** [UPSTREAM: §9 / §37.2 / D6] 单 Case 详情 `GET /api/v1/cases/:id` 在以下任一情形 MUST 统一返回 `404 CASE_NOT_FOUND`：(a) Case ID 不存在；(b) Case 属于其他 Family；(c) actor 对该 Case 无访问资格。响应 MUST NOT 包含 Case 是否真实存在、Family ID、status、phase、primary、creator 或任何其它 Case 字段。该统一对外语义 MUST NOT 削弱数据库 RLS：无上下文或错误 Family 上下文下，`cases` / `case_events` MUST 仍返回零行 / 拒绝写入。
- **FR-024** [UPSTREAM: §9 / D2 / D6] 对 `GET /api/v1/cases` 与 `POST /api/v1/cases`，当前目标 Family 已合法解析但 actor 不是该 Family 的 V1 管理主体时，MUST 返回 `403 CASE_ACCESS_DENIED`，MUST NOT 返回该 Family 内任何 Case 数据，MUST NOT 创建 Case。该 403 判定以「当前目标 Family 已合法解析」为前提：actor 的 Family membership / guardian relationship MUST NOT 被当作解析为目标 Family 的替代依据；若 actor 不是目标 Family 的 `family_member`（包括仅有 guardian relationship 的情形），Family 上下文未合法成立，Case 端点 MUST 沿用 Slice 1 的 Family 授权 / current-family 失败语义且 MUST NOT 返回 Case 数据，MUST NOT 定义、借用或强制转换为 `CASE_ACCESS_DENIED` / `CASE_NOT_FOUND`，MUST NOT 定义第二套 Family 错误码，也不得用该场景验证 Case manager 权限。
- **FR-025** [UPSTREAM: §7.8 / D7] `GET /api/v1/cases` 与 `GET /api/v1/cases/:id` MUST NOT 创建 `case_event` 或 `business_audit_event`；读取结果 MUST NOT 依赖任何审计写入成功。`case_events` / `business_audit_events` 只记录 Case 创建等真实写动作，MUST NOT 被用作普通读取的访问日志；未来访问日志需求 MUST 由对应 Slice 明确设计。

No requirement may be invented to make implementation easier.

## Key Entities

本 Slice 的实体以 `Docs/V1技术设计.md` §7.2 / §7.8 已批准的表为准；列级 DDL、索引与迁移顺序属 Plan，不在本文决定。

### `cases`

Case 容器。逻辑约束（不是 DDL）：

1. **标识**：系统生成的唯一标识；`uuidv7()` 基线；创建后不可变。
2. **Family 归属**：必须且只能属于一个已存在 Family；与 Family 的归属在创建后不可迁移；读取时归属必须等于已验证的当前目标 Family。
3. **`status`**：独立字段，取值遵循 §6.1；本 Slice 创建固定 `OPEN`；与 `phase` 无组合枚举关系。
4. **`phase`**：独立字段，取值遵循 §6.2；本 Slice 创建固定 `INTAKE`；与 `status` 无组合枚举关系。
5. **`primary`**：布尔语义；创建时由服务端按 FR-007 判定；客户端不可指定；同一 Family 的当前 primary 未结 Case 不超过一个。`primary = false` 的 Case 即本 Spec 所称「候选 Case」，是产品 §2.1「候选问题」的 Case 容器投影；本 Slice 不实现候选问题的内容、评估或晋升为 primary。
6. **`version`**：非负 / 正整数乐观锁版本；创建时从确定初始版本开始；本 Slice 只读取，不提供更新命令。
7. **创建者 / 发起 metadata**：记录发起 Case 的 Person 与服务端创建时间；创建者来自已验证 actor，不得由客户端指定；该记录不是 Participant，也不授予未来参与权限。
8. **禁止字段**：`title`、`summary`、`problem_description`、`description`、任何 evidence-like 自由文本、任何 Statement / Observation / Fact / Hypothesis 内容。
9. **禁止关系**：不得在本 Slice 建立 Participant、Visibility、Safety、Plan、Task、Notification、Follow-up 关系。

### `case_events`

Case 的领域历史与审计。逻辑约束：

1. 必须引用一个真实存在的 Case，并携带与 Case 一致的 Family 作用域。
2. 至少记录 Case 创建事件；MUST NOT 记录普通读取访问（D7）。事件类型 / 字段集合由 Plan 在上游 §7.8 范围内决定，不得引入业务内容正文或第二套 access-log 语义。
3. 必须记录发起 actor 与发生时间，供审计追溯。
4. 作为领域历史保留；不得用覆盖或删除既有事件的方式让历史与当前状态一致（§7.8）。

### 已存在、本 Slice 只增量使用的 Slice 1 基础设施

- `idempotency_keys`：本 Slice 增加 `CASE_CREATE` 命令类型，沿用 §8.5 的 actor + command + key 合同与重放快照语义。
- `business_audit_events`：本 Slice 增加 Case 创建审计事件与 `CASE` 资源类型，仅用于真实写动作，沿用 Slice 1 的身份 / 家庭作用域与不可伪造语义；MUST NOT 用于普通读取的访问日志（D7）。
- `families` / `persons` / `family_members`：只作为归属、管理主体与授权输入使用；V1 管理主体为创建该 Family 的 adult Person；本 Slice 不修改其冻结语义。

### 明确不存在于本 Slice 的对象

`case_participants`、`participation_invites`、`assertions`、`observations`、`dialogue_messages`、`problem_formulations`、`scene_node_states`、`scene_artifacts`、Safety State、Plan / Task / Review / Follow-up / Notification / AI / Memory。

## DFX Constraints

> 上游未给出本 Slice 的 p95、吞吐量或成本数字；§37.2 明确这些指标在首次原型压测 / 成本测量后冻结。本 Spec 不发明数字，只固定可验证的硬约束。

### 性能

- 创建 / 列表 / 读取 MUST 是同步持久化并返回真实结果的普通 API，MUST NOT 被模型调用或异步任务阻塞（§37.2）。
- 本 Slice MUST NOT 引入 AI、RAG、模型、pg-boss、Notification 或外部副作用调用。
- 具体 p95 / 并发上限：待首次压测后由上游冻结；本 Slice 不承诺未批准数字。

### 可靠性

- 跨家庭与无授权访问 MUST 是硬阻断（§37.2）。
- 重复提交、并发与重试 MUST NOT 制造重复 Case、重复 primary 或重复事件（V1-C28、§5 不变量 17）。
- 同一 Family 的当前 primary 未结 Case 数量 MUST 始终 `<= 1`（§8.1）。
- Case、创建事件、审计事件与幂等结果 MUST 保持一致；不得出现部分成功。

### 安全性

- 所有 Case 读写 MUST 先经 `authorize()`，再在 `withRlsTransaction` 内执行；RLS 存在 MUST NOT 成为跳过 `authorize()` 的理由（§9.1）。
- 运行角色 MUST NOT 为 table owner、MUST NOT 具备 BYPASSRLS（§9.1）。
- Case 容器 MUST NOT 保存问题正文、证据、孩子原话或任何敏感内容字段；本 Slice 不扩大数据面。
- Case 详情 MUST NOT 通过状态码或响应差异泄露某个 Case ID 是否存在（D6）。
- 创建 MUST 留下可审计的领域事件与业务审计事件（§7.8、§7.9）；普通读取 MUST NOT 写访问审计（D7）。

### 可维护性

- `cases` / `case_events` 的 RLS 状态 MUST 可在 CI / 数据库校验中被证明（`relrowsecurity` / `relforcerowsecurity`）。
- 事件类型、审计资源类型与幂等命令类型 MUST 通过 reviewed migration 增量扩展，MUST NOT 在运行时接受未定义值。
- 读取路径 MUST NOT 写 `case_events` / `business_audit_events`，该行为 MUST 可由测试证明（D7）。
- 结构 / 路由断言 MUST 能证明不存在本 Spec 明确排除的对象（见 Acceptance Evidence）。

### 兼容性

- 本 Slice 只对 Slice 1 的公共基础设施做**增量扩展**；MUST NOT 修改 Slice 1 已冻结的 Account / Person / Family / Consent / RLS 语义，MUST NOT 在 Slice 2 分支之外修改 Slice 1。
- Case API 是新增契约，MUST NOT 改变 `/auth`、`/me`、`/families`、`/consents` 等 Slice 1 端点的现有语义。
- 若 Slice 1 的实际实现与冻结设计不一致，MUST 停止并重新对齐，MUST NOT 在 Slice 2 中私建替代基础设施。

## Success Criteria

- **SC-001**: 对任一 Family 的串行创建序列，第一个成功创建的 Case 为 `primary = true`，后续每个 Case 为 `primary = false`；候选 Case 全部真实存在且可读取。
- **SC-002**: 任意并发创建场景结束后，同一 Family 的“`primary = true` 且 `status != CLOSED`”Case 数量始终 `<= 1`；相同 `CASE_CREATE` 幂等键 + 相同 payload 只产生一个 Case。
- **SC-003**: 创建的 Case 全部为 `OPEN + INTAKE`；`status` 与 `phase` 是两个独立返回 / 存储字段，不存在组合枚举、互相推导或单一字段替代。任何携带未声明业务字段的创建请求 MUST 以 `422 VALIDATION_ERROR` 拒绝，且不产生任何业务写入（Case、`case_event`、`business_audit_event`、幂等结果均无新增）。
- **SC-004**: Family A 的管理主体无法读取 Family B 的 Case；单 Case 详情返回 `404 CASE_NOT_FOUND` 且不泄露字段或存在性；在 Family A 的 RLS 上下文直连查询 Family B Case 返回零行；无任何 RLS 上下文时 `cases` / `case_events` 查询返回零行。
- **SC-005**: 普通 Family membership 与 guardian relationship 均不能单独获得 Case 创建 / 列表 / 读取权限；拒绝由服务端执行：目标 Family 已合法解析但 actor 非管理主体时（含 guardian 同时是目标 Family 成员），创建 / 列表返回 `403 CASE_ACCESS_DENIED`，单 Case 详情返回 `404 CASE_NOT_FOUND`；guardian 但不是目标 Family 成员时，current Family 未合法解析，沿用 Slice 1 Family 语义且不返回 Case 数据，不产生 Case 层 403 / 404。
- **SC-006**: `CASE_CREATE` 相同幂等键 + 相同 canonical payload（含并发同 key）只产生一个 Case 结果，记录数不变，不追加第二组创建事件 / 审计；shared idempotency 合同对「相同 scope key + 不同 canonical payload hash」返回 MISMATCH 并映射为 409，且不修改原 Case。本 Slice 的 public HTTP 请求体没有第二种合法业务 payload，因此不要求也不允许构造 HTTP 层 different-payload 场景。
- **SC-007**: 每个成功创建的 Case 都有对应的 `case_event` 与 `business_audit_event`；不存在 Case 已持久化但无创建证据的状态，也不存在部分写入；普通读取不产生 `case_event` / `business_audit_event`，读取结果不依赖审计写入。
- **SC-008**: 数据库结构与路由清单中不存在本 Spec 排除的 Case Participant、Evidence、Problem Formulation、Safety、Plan、Task、Notification 等表、路由、占位实现或抽象。
- **SC-009**: 每个 Case 的 `version` 在创建后可读取且为确定初始值；本 Slice 没有任何更新 Case 的 API 改变该版本。
- **SC-010**: 对“有 primary Case”的 Family，管理主体仅通过 `GET /api/v1/cases` 与 `GET /api/v1/cases/:id` 即可识别当前 primary 与 phase；不存在 `/cases/current` 或第二张 primary 真相表。
- **SC-011**: 无 Case 的 Family 读取列表得到真实空结果，不出现 placeholder / 默认 Case。

## Acceptance Evidence

| Acceptance item | Verification type | Required evidence |
|---|---|---|
| 首个 Case = OPEN + INTAKE + primary（场景 1、SC-001、SC-003、SC-009） | integration + database | 创建后读取的响应与数据库行断言：status/phase 两列独立、primary=true、family 归属正确、version 已初始化为确定初始值且无更新路径；响应无内容字段 |
| 后续 Case = 候选且保留（场景 2、14、SC-001） | integration | 连续创建两个 Case 后，第一个 primary=true、第二个 false，两个 ID 均可读取；无 Plan / Task / Follow-up / Notification 副作用 |
| 并发 primary 不变量（场景 3、SC-002） | database concurrency | 并发创建（不同幂等键）后执行聚合查询：`primary=true AND status<>'CLOSED'` 计数 <= 1；重复运行仍成立 |
| 列表 / 详情与 primary 读取（场景 4、5、SC-003、SC-010） | integration | 列表返回当前 Family 全部 Case 且 primary 可唯一识别；详情分别返回 status 与 phase；不存在 `/cases/current` 路由 |
| 跨家庭双层隔离（场景 6、SC-004） | integration + database | 应用层返回 `404 CASE_NOT_FOUND`、响应不含 Family B 字段或存在性信息的断言 + 运行角色在 Family A 上下文查询 Family B Case 返回零行 |
| 无 RLS 上下文默认拒绝（场景 7、SC-004） | database | 未设置 `app.family_id` 时 `SELECT` 返回 0 行、`INSERT` 被拒绝的实测输出 |
| 非管理主体拒绝（场景 8、SC-005） | integration | 目标 Family 的普通成员（已合法解析、非创建者）创建 / 列表请求返回 `403 CASE_ACCESS_DENIED` 且不返回 Case 数据；单 Case 详情请求返回 `404 CASE_NOT_FOUND`；不依赖前端隐藏 |
| guardian + Family 成员但非管理主体（场景 9 场景 A、SC-005） | integration | actor 是目标 Family 合法 `family_member` 且具备 guardian relationship、但不是 `families.created_by_person_id`：`POST /cases` 与 `GET /cases` 返回 `403 CASE_ACCESS_DENIED` 且无 Case 写入 / Case 数据，`GET /cases/:id` 返回 `404 CASE_NOT_FOUND` |
| guardian 但不是目标 Family 成员（场景 9 场景 B、FR-024） | integration | actor 仅有 guardian relationship、不是目标 Family 成员：current Family 未合法解析，沿用 Slice 1 Family 语义（如 `CURRENT_FAMILY_NOT_FOUND`），响应不含 Case 字段；不出现 `CASE_ACCESS_DENIED` / `CASE_NOT_FOUND` 映射 |
| Case 404 / 403 固定语义（场景 6、8、9 场景 A、SC-004、SC-005、FR-023、FR-024） | integration | 详情对「不存在 ID / 跨 Family / 同 Family 无资格」三类输入均返回 `404 CASE_NOT_FOUND`，且响应体一致、无任何 Case 字段或存在性提示；列表 / 创建在 Family 已解析但非管理主体时返回 `403 CASE_ACCESS_DENIED` 且无 Case 数据 |
| 创建幂等 HTTP 可达行为（场景 10、SC-006） | integration | 相同键 + 相同 canonical payload 重试（含并发同 key）后 Case 计数不变、返回原 ID，且 `case_events` / `business_audit_events` 行数不增加；只有一个业务结果 |
| 共享幂等 mismatch 合同（场景 10、SC-006、§8.5） | domain / repository contract | 相同 scope key + 不同 `request_hash` 时返回 MISMATCH 并映射为 `409 IDEMPOTENCY_PAYLOAD_MISMATCH`，不改原结果；证据来自共享幂等基础设施层，**不得声称 public HTTP API 存在可达的 different-payload 请求** |
| 创建事件与审计（场景 11、SC-007） | integration + database | 成功创建后 `case_events` 与 `business_audit_events` 各存在对应创建记录；构造事件写入失败时 Case 不落库（事务回滚证据） |
| 读取不写审计（场景 16、SC-007、FR-025） | integration + database | 读取前后 `case_events` / `business_audit_events` 行数不变；读取路径不触发审计写入；不存在读取访问日志表 / 事件类型 |
| 越界 schema / API 不存在（场景 12、SC-008） | database introspection + route enumeration | 目录 / 路由清单断言不存在排除对象；执行真实的 schema 与路由枚举输出 |
| 越权字段 strict 422 与零写入（场景 13、SC-003、FR-015） | integration + database | 携带 `familyId` / `createdByPersonId` / `creator` / `status` / `phase` / `primary` / `isPrimary` / `version` / `title` / `summary` / `description` / `problemDescription` 或任何 Evidence / Participant / 内容字段的创建请求均返回 `422 VALIDATION_ERROR`；查询 Case 数量、`case_events`、`business_audit_events`、`idempotency_keys` 均无新增；不得出现“忽略非法字段后用服务端值创建”的结果 |
| 空 Family 真实空结果（场景 15、SC-011） | integration | 无 Case 时列表为空数组 / 空集合，详情对不存在 ID 返回 `404 CASE_NOT_FOUND`，不生成占位 Case |
| RLS / 角色 / migration / uuidv7（FR-002、FR-011） | database verification | `relrowsecurity = true`、`relforcerowsecurity = true`、运行角色非 owner 且 `rolbypassrls = false`、主键默认值检查输出 |

## Assumptions and Open Questions

### Assumptions

**已由文档推导，非新增语义**

- 本 Slice 的 Case 访问必须以 Slice 1 已冻结的「当前目标 Family 的 V1 管理主体 = 创建该 Family 的 adult Person」为唯一当前管理资格；这是 §9 的正式语义，不是本 Slice 新增。
- Case 创建属于 §8.5 的“关键命令”，因此必须使用幂等合同；这不是把幂等泛化到全部读请求。
- `case_events` 作为领域历史与审计保留（§7.8）意味着不得用覆盖 / 删除既有事件的方式改写历史；具体不可变实现由 Plan 决定。
- 本 Slice 不交付页面；U04 只要求服务端能力，微信小程序 / 运营后台 UI 属 §28A，不在本 Spec。
- Case 端点的「当前目标 Family」沿用 Slice 1 的当前家庭上下文语义（`GET /api/v1/families/current`，§28.1）；本 Slice MUST NOT 新增 `family_id` 查询参数、家庭切换或多家庭选择语义。
- 未来 Participant / Visibility 的权限细节未定；本 Spec 只要求当前管理主体访问，不提前决定孩子或其他成员能看到什么。

**无上游明文，本轮显式标注（不得当成已批准需求）**

- **A-2 `CASE_CREATE` 幂等键的传输位置**：§8.5 只定义 `actor_id + command_type + idempotency_key` 合同，未规定键放在 header 还是 body；由 Plan 决定，但不得改变本 Spec 的幂等语义。
- **A-3 响应字段命名与包装**：本 Spec 使用 `status` / `phase` / `primary` / `version` 等逻辑名称；具体 JSON 字段名、envelope 与 pagination / list wrapper 由 Plan 依据 §28.3 的 API 契约面决定，不得引入第二真相源或内容字段。错误 envelope 同样由 Plan 决定，但错误码 `CASE_NOT_FOUND` / `CASE_ACCESS_DENIED` 已由 D6 固定，不得改名或替换。

> 原 A-1（NOT_FOUND 与 DENIED 的对外表现）已由 Owner 决策 D6 结案：单 Case 详情统一 `404 CASE_NOT_FOUND`，列表 / 创建在 Family 已合法解析但非管理主体时 `403 CASE_ACCESS_DENIED`。原 A-4（读审计）已由 Owner 决策 D7 结案：本 Slice 不实现 Case read audit。二者不再作为 Assumption，也不再留给 Plan 选择。

### Open Questions

**NONE**

**Residual blockers**: NONE

## Implementation Dependencies（Slice 1）

本 Spec 可以基于 Slice 1 的**冻结设计**提前定义，但不得把“设计存在”当成“代码已真实可用”。

### 可提前依赖的冻结契约

- Family / Person 基本标识与 `family_members` 的 (family, person) 语义（§7.1）。
- Family 创建者 / adult 管理主体语义（`families.created_by_person_id`；§9、Slice 1 Plan）。
- `authorize()` 的输入形状已包含 `case`，本 Slice 只增量实现 Case 维度（§9）。
- `withRlsTransaction` 与 `app.family_id` / `app.person_id` / `app.account_id` / `app.purpose` 上下文语义（§9.1、Slice 1 契约）。
- `idempotency_keys` 的 §8.5 合同与重放快照（Slice 1 数据模型）。
- `business_audit_events` 的家庭作用域与追加审计语义（§7.9、Slice 1 数据模型）。
- migrator / app 双角色、ENABLE + FORCE RLS、无上下文默认拒绝（§7.0、§9.1）。

### 实现前必须重新验证（不得假定已经存在）

Slice 1 当前仍在独立分支 Implement。开始 Slice 2 实现前 MUST 验证：

1. Slice 1 已合并到约定的基线分支；
2. Slice 1 的 schema / migration 已在目标环境真实存在；
3. `authorize()` 可安全扩展到 Case 维度，且不影响 Family / Consent 行为；
4. `withRlsTransaction` 与 RLS helper 可用；
5. `idempotency_keys` 行为（相同键重放、不同 payload 409）已通过；
6. `business_audit_events` 基础已通过；
7. 相关 CI 与数据库验证为 green。

若任一验证失败，Slice 2 MUST 停止并报告 BLOCKED / NOT VERIFIED；MUST NOT 在 Slice 2 私建替代 Family / Consent / RLS / 幂等 / 审计基础设施。

### 明确不得依赖

- 不得依赖 Slice 1 尚未实现的 Participant、Visibility、Case 角色或 Case 权限矩阵。
- 不得依赖未来 Slice 的 Evidence、Assessment、Problem Formulation、Safety、Plan、Task、Notification、AI。
- 不得在 Slice 2 分支修改 Slice 1 文件、重新设计其冻结基线或修改正式 Docs。