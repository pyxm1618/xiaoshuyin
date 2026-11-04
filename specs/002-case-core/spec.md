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
| D2 | 当前 Case 管理 API 只向目标 Family 的 V1 管理主体开放：创建该 Family 的 adult Person；普通 membership 与 guardian relationship 都不自动授予 Case 访问 | FR-007、FR-008、FR-009 |
| D3 | 第一个 Case 自动 `primary = true`，后续 Case 自动 `primary = false` 作为候选保存；一个 Family 最多一个当前 primary 未结 Case；本 Slice 不实现 `switch-primary` | FR-006、FR-010 |
| D4 | Case 不创建 title / summary / problem_description / description / 任何 evidence-like 自由文本；Case 只保存容器自身的最小 metadata | FR-011 |
| D5 | 本 Slice 可在自己的分支增量扩展 Slice 1 的公共基础设施（authorize 的 Case 使用、Case RLS、`CASE_CREATE` 幂等类型、Case audit / `case_events`、Case migration），但不得修改 Slice 1 分支或重新设计其冻结基线 | Implementation Dependencies |

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
12. **`POST /api/v1/cases`**：创建 Case；不接受任何 Case 内容字段或客户端指定的状态 / 阶段 / primary / version（§28.3）。
13. **`GET /api/v1/cases`**：读取当前 Family 的 Case 集合，并区分 primary 与 candidate（§28.3、U04）。
14. **`GET /api/v1/cases/:id`**：读取单个 Case；同时返回彼此独立的 `status` 与 `phase`（§28.3、§6.1、§6.2）。
15. **当前 primary Case 的读取语义**：由 `GET /api/v1/cases` 的同一数据源表达；不得新增 `/cases/current` 之类的第二真相源，也不得把 primary 复制到另一张表（U04、§28.3）。
16. **Case 级家庭隔离**：应用层授权判定 + 数据库 RLS 双层防线；`case_id` / `family_id` 只作为待验证参数（§9、§9.1、V1-C21）。
17. **Case RLS**：`cases` 与 `case_events` 必须启用并强制 RLS，无上下文默认拒绝（§9.1）。
18. **Case 创建幂等**：`CASE_CREATE` 属于关键命令，遵循 §8.5 合同；相同幂等键 + 相同 payload 返回原结果，不同 payload 返回 409。
19. **Case 创建留痕**：创建 Case 必须在同一业务事务内产生 `case_event` 与 `business_audit_event`，不得出现“Case 已存在但无创建证据”的中间状态（§7.8、§7.9、§38）。
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

**Independent Test**: 一个有 primary Case 的 Family 调用列表与详情，断言 primary 可被唯一识别、phase 正确、status 与 phase 分别返回；无 Case 的 Family 返回空结果而不是伪造 Case。

### User Story 4 — Case 访问必须经过当前 Family 与 V1 管理主体判定 (Priority: P1)

只有目标 Family 的 V1 管理主体能创建、列出、读取该 Family 的 Case。普通成员、guardian（若非管理主体）以及任何跨家庭 actor 都被拒绝；数据库 RLS 作为第二道防线在无上下文或跨家庭上下文下返回零行 / 拒绝。

**Upstream IDs**: V1-C21、§9、§9.1、§37.2

**Independent Test**: 用非管理主体身份、guardian 身份、Family A 身份分别访问 Family B Case 与无 RLS 上下文的直连查询，断言应用层与数据库层都失败，且响应不泄露目标 Case 字段。

## Acceptance Scenarios

1. **Given** 一个已有 Family 且该 Family 尚无任何 Case，**When** 该 Family 的管理主体调用 `POST /api/v1/cases`，**Then** 创建一个真实 Case，`status = OPEN`、`phase = INTAKE`、`primary = true`，归属当前 Family，`version` 已初始化，且响应不包含任何内容字段。**Upstream**: V1-C01、U04、§2.1、§6.1、§6.2、§8.1、§28.3
2. **Given** 同一 Family 已存在一个 primary 未结 Case，**When** 管理主体再创建一个 Case，**Then** 新 Case 为 `OPEN + INTAKE` 且 `primary = false`，被真实保留并可读取；旧 primary 不变。**Upstream**: V1-C01、§2.1、§8.1、§5 不变量 2
3. **Given** 同一 Family 尚无 Case，**When** 两个不同幂等键的创建请求并发执行，**Then** 所有事务完成后该 Family 的当前 primary 未结 Case 不超过一个；不存在两个 `primary = true` 的未结 Case，也不存在重复业务结果。**Upstream**: §8.1、§5 不变量 17、V1-C28
4. **Given** 同一 Family 有 1 个 primary 与至少 1 个候选 Case，**When** 管理主体调用 `GET /api/v1/cases`，**Then** 返回该 Family 的 Case 集合，且每个 Case 能区分 `primary` 与 non-primary，并暴露各自的 `phase`；不得返回其他 Family 的 Case。**Upstream**: U04、V1-C01、§28.3、§9
5. **Given** 一个已创建的 Case，**When** 管理主体调用 `GET /api/v1/cases/:id`，**Then** 返回该 Case 的 `status` 与 `phase` 两个独立字段；二者不得被合并成一个组合枚举或互相推导。**Upstream**: §2.4、§6.1、§6.2、§28.3
6. **Given** Family A 的管理主体与 Family B 的一个 Case，**When** A 使用 B 的 `case_id` 发起 Case 读取，**Then** 应用层拒绝且响应不包含 Family B 的任何 Case 字段；以运行角色在 A 的 RLS 上下文直连查询，数据库层同样返回零行。**Upstream**: V1-C21、§9、§9.1、§37.2
7. **Given** 数据库连接没有任何 `app.family_id` / 身份上下文，**When** 查询 `cases` 或 `case_events`，**Then** 返回零行；写入被拒绝，而不是默认放行。**Upstream**: §9.1
8. **Given** 一个 Family 中不是该 Family 创建者的普通成员，**When** 尝试创建、列出或读取该 Family 的 Case，**Then** 服务端拒绝；普通 membership 不自动推导 Case 管理访问。**Upstream**: §9、D2、V1-C21
9. **Given** 一个对某未成年人具有 guardian relationship、但不是目标 Family 创建者的 actor，**When** 尝试访问该 Family 的 Case，**Then** 服务端拒绝；guardian relationship 不替代 Case access。**Upstream**: §9、D2
10. **Given** 同一个 `CASE_CREATE` 幂等键与相同 payload 已被处理，**When** 客户端重试相同请求，**Then** 返回原 Case 结果，不创建第二条 Case，也不产生第二个业务结果；**Given** 相同幂等键但 payload 不同，**When** 再次提交，**Then** 返回 409，不修改原 Case。**Upstream**: §8.5、V1-C28
11. **Given** 一次成功的 Case 创建，**When** 检查领域历史与审计，**Then** 存在与该 Case 对应的 `case_event` 与 `business_audit_event`，且 Case 落库、事件与幂等重放快照构成同一业务事务的结果；不得出现 Case 已存在但无创建证据的持久状态。**Upstream**: §7.8、§7.9、§38
12. **Given** 本 Slice 的数据库结构与路由清单，**When** 做结构 / 路由断言，**Then** 不存在 `case_participants`、`assertions`、`observations`、`problem_formulations`、`scene_node_states`、`scene_artifacts`、`dialogue_messages`、Safety / Plan / Task / Notification 等越界表；不存在 pause / resume / switch-primary / close / recurrences / messages / assessments / participants 等越界路由或空壳实现。**Upstream**: §7.2、§28.3、Out of Scope
13. **Given** 一个创建请求携带 `status`、`phase`、`primary`、`version`、创建者或任何 Case 内容字段，**When** 请求被处理，**Then** 客户端提供的这些值不能决定业务结果；创建结果只能是 `OPEN + INTAKE`，primary 由服务端依据当前 Family 状态判定，创建者由已验证 actor 决定，version 由服务端初始化。**Upstream**: §6.1、§6.2、§8.1、§8.6、§9、§28.3
14. **Given** 一个 Family 有多个候选 Case，**When** 管理主体读取列表，**Then** 所有候选 Case 都真实存在且可区分；本 Slice 不提供任何将候选晋升为 primary 的路径。**Upstream**: V1-C01、§2.1、§29.4（排除）
15. **Given** 一个 Family 没有任何 Case，**When** 管理主体读取 Case 列表，**Then** 返回真实空结果；不得返回 placeholder、默认 Case 或由前端补造的主要 Case。**Upstream**: U04、V1-C01、V1-C27

## Edge, Failure, and Unknown States

- **并发首 Case**：并发创建使用不同幂等键时，最终最多一个 primary 未结 Case；使用相同幂等键时，只产生一个 Case 与一个原结果。不得以“最后写入者获胜”留下两个 primary。
- **无 Case**：列表返回空集合，详情对不存在 ID 返回真实的未找到 / 拒绝；不得伪造 `OPEN + INTAKE` 占位对象。
- **跨家庭 ID**：`case_id` / `family_id` 只是待验证参数；ID 存在不代表有权访问。应用层拒绝且响应不携带目标 Case 的任何字段（§9、§37.2）。
- **RLS 无上下文**：`cases` / `case_events` 的查询返回零行，写入被拒绝；不得因为缺少上下文而放宽策略（§9.1）。
- **错误 family 上下文**：`app.family_id` 必须是当前请求的目标 Family；不得由 `app.person_id` 反推或替换。上下文与 Case 归属不一致时结果为空 / 拒绝（§9.1）。
- **非管理主体**：普通成员、未成年成员、非管理主体的 guardian 均无 Case 管理访问；该拒绝由服务端判定，不依赖前端隐藏（§9、D2）。
- **未来状态不可达**：即使数据库可以表达 §6.1 / §6.2 的完整词汇，本 Slice 也不存在任何可达路径把 Case 改成 `WAITING` / `PAUSED` / `CLOSED` 或 `ASSESSMENT` 等状态；不得创建“演示用”的转换接口。
- **未来副作用不得伪造**：创建候选 Case 不得触发 Plan、Task、Follow-up、Notification、AI run、Memory 或 Safety 副作用；这些对象在本 Slice 不存在。
- **客户端越权字段**：客户端不得指定 status、phase、primary、version、creator、family 归属后的迁移或任何内容字段；这些值不能改变业务结果。
- **事务失败**：幂等记录、Case、`case_event`、`business_audit_event` 任一写入失败时，整个业务事务失败并返回真实错误；不得出现部分成功的“假成功”。
- **对外 404 / 403 语义**：上游只要求跨家庭与无授权访问必须失败（§37.2）且不能因 ID 存在而放行（§9），未规定未找到与拒绝是否必须对外一致；该对外表现见 Assumption A-1，不作为已批准需求。
- **读审计**：上游要求 `case_events` 作为领域历史与审计保留，但未要求每次读产生审计事件；本 Slice 不新增“读即写审计”的产品语义。若 Plan 选择记录读审计，不得改变本 Spec 的读取语义或创建第二真相源。

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
- **FR-012** [UPSTREAM: §8.5 / D5] `CASE_CREATE` MUST 遵循 `actor_id + command_type + idempotency_key` 幂等合同：相同键 + 相同 payload MUST 返回原结果且不重复写入；相同键 + 不同 payload MUST 返回 409。
- **FR-013** [UPSTREAM: §8.6] `cases` MUST 携带 `version` 作为乐观并发基础；创建时 MUST 从确定初始版本开始并在读取中返回；本 Slice MUST NOT 新增任何修改 Case 的命令，也不得伪造后续版本的 If-Match / 更新语义。
- **FR-014** [UPSTREAM: §7.8 / §7.9 / §38] 每次成功创建 Case MUST 在同一业务事务内产生对应的 `case_event` 与 `business_audit_event`；`case_events` MUST 作为领域历史与审计保留，MUST NOT 通过覆盖或删除历史事件来伪造当前状态。
- **FR-015** [UPSTREAM: §28.3 / D4] `POST /api/v1/cases` MUST 只创建 Case 容器，MUST NOT 接受或保存 title、summary、problem_description、description 或任何 evidence-like 自由文本；MUST NOT 接受客户端指定的 status、phase、primary、version、creator 或 Family 迁移。
- **FR-016** [UPSTREAM: §28.3 / U04] `GET /api/v1/cases` MUST 返回当前目标 Family 的 Case 集合，并暴露足以识别当前 primary Case 与各自 `phase` 的信息；当前 primary Case MUST 由同一 Case 数据源表达，MUST NOT 通过列表排序、派生缓存或第二张表伪造唯一真相。
- **FR-017** [UPSTREAM: §28.3 / D4] `GET /api/v1/cases/:id` MUST 返回单个 Case 的独立 `status` 与 `phase`，并只在该 Case 属于当前目标 Family 时返回；MUST NOT 返回内容字段或越界对象。
- **FR-018** [UPSTREAM: §28.3 / Out of Scope] 本 Slice MUST NOT 暴露 `/cases/current`、`pause`、`resume`、`switch-primary`、`close`、`recurrences`、`messages`、`assessments`、`participants` 或任何未列入 FR-015—FR-017 的 Case 路由 / 占位实现。
- **FR-019** [UPSTREAM: V1-C27 / V1-C28 / §37.2] 创建、列表、读取的操作 MUST 返回真实状态：无权、未找到、冲突、幂等重放、数据库拒绝均不得伪装成成功；失败时 MUST NOT 留下部分写入的 Case 或事件。
- **FR-020** [UPSTREAM: §7.2 / §9 / D5] 本 Slice MUST NOT 创建 `case_participants`、参与邀请、Statement / Observation / Fact / Hypothesis、Problem Formulation、Assessment、Safety State、Plan / Task / Notification 等对象、表、路由或抽象；未来能力 MUST NOT 以 placeholder 形式进入本 Slice。
- **FR-021** [UPSTREAM: V1-C01 / §5 不变量 19] 候选 Case MUST 被真实保留并可读取，但 MUST NOT 因创建而进入普通执行、激活 Plan、创建 Follow-up Schedule 或产生提醒；本 Slice 不存在这些副作用的对象与路径。
- **FR-022** [UPSTREAM: U04 / V1-C27] Family 没有 Case 时，列表 MUST 返回真实空结果；系统 MUST NOT 伪造默认 Case、placeholder Case 或不存在的 primary。

No requirement may be invented to make implementation easier.

## Key Entities

本 Slice 的实体以 `Docs/V1技术设计.md` §7.2 / §7.8 已批准的表为准；列级 DDL、索引与迁移顺序属 Plan，不在本文决定。

### `cases`

Case 容器。逻辑约束（不是 DDL）：

1. **标识**：系统生成的唯一标识；`uuidv7()` 基线；创建后不可变。
2. **Family 归属**：必须且只能属于一个已存在 Family；与 Family 的归属在创建后不可迁移；读取时归属必须等于已验证的当前目标 Family。
3. **`status`**：独立字段，取值遵循 §6.1；本 Slice 创建固定 `OPEN`；与 `phase` 无组合枚举关系。
4. **`phase`**：独立字段，取值遵循 §6.2；本 Slice 创建固定 `INTAKE`；与 `status` 无组合枚举关系。
5. **`primary`**：布尔语义；创建时由服务端按 FR-007 判定；客户端不可指定；同一 Family 的当前 primary 未结 Case 不超过一个。
6. **`version`**：非负 / 正整数乐观锁版本；创建时从确定初始版本开始；本 Slice 只读取，不提供更新命令。
7. **创建者 / 发起 metadata**：记录发起 Case 的 Person 与服务端创建时间；创建者来自已验证 actor，不得由客户端指定；该记录不是 Participant，也不授予未来参与权限。
8. **禁止字段**：`title`、`summary`、`problem_description`、`description`、任何 evidence-like 自由文本、任何 Statement / Observation / Fact / Hypothesis 内容。
9. **禁止关系**：不得在本 Slice 建立 Participant、Visibility、Safety、Plan、Task、Notification、Follow-up 关系。

### `case_events`

Case 的领域历史与审计。逻辑约束：

1. 必须引用一个真实存在的 Case，并携带与 Case 一致的 Family 作用域。
2. 至少记录 Case 创建事件；事件类型 / 字段集合由 Plan 在上游 §7.8 范围内决定，不得引入业务内容正文。
3. 必须记录发起 actor 与发生时间，供审计追溯。
4. 作为领域历史保留；不得用覆盖或删除既有事件的方式让历史与当前状态一致（§7.8）。

### 已存在、本 Slice 只增量使用的 Slice 1 基础设施

- `idempotency_keys`：本 Slice 增加 `CASE_CREATE` 命令类型，沿用 §8.5 的 actor + command + key 合同与重放快照语义。
- `business_audit_events`：本 Slice 增加 Case 创建审计事件与 `CASE` 资源类型，沿用 Slice 1 的身份 / 家庭作用域与不可伪造语义。
- `families` / `persons` / `family_members`：只作为归属、管理主体与授权输入使用；本 Slice 不修改其冻结语义。

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
- 创建 MUST 留下可审计的领域事件与业务审计事件（§7.8、§7.9）。

### 可维护性

- `cases` / `case_events` 的 RLS 状态 MUST 可在 CI / 数据库校验中被证明（`relrowsecurity` / `relforcerowsecurity`）。
- 事件类型、审计资源类型与幂等命令类型 MUST 通过 reviewed migration 增量扩展，MUST NOT 在运行时接受未定义值。
- 结构 / 路由断言 MUST 能证明不存在本 Spec 明确排除的对象（见 Acceptance Evidence）。

### 兼容性

- 本 Slice 只对 Slice 1 的公共基础设施做**增量扩展**；MUST NOT 修改 Slice 1 已冻结的 Account / Person / Family / Consent / RLS 语义，MUST NOT 在 Slice 2 分支之外修改 Slice 1。
- Case API 是新增契约，MUST NOT 改变 `/auth`、`/me`、`/families`、`/consents` 等 Slice 1 端点的现有语义。
- 若 Slice 1 的实际实现与冻结设计不一致，MUST 停止并重新对齐，MUST NOT 在 Slice 2 中私建替代基础设施。

## Success Criteria

- **SC-001**: 对任一 Family 的串行创建序列，第一个成功创建的 Case 为 `primary = true`，后续每个 Case 为 `primary = false`；候选 Case 全部真实存在且可读取。
- **SC-002**: 任意并发创建场景结束后，同一 Family 的“`primary = true` 且 `status != CLOSED`”Case 数量始终 `<= 1`；相同 `CASE_CREATE` 幂等键 + 相同 payload 只产生一个 Case。
- **SC-003**: 创建的 Case 全部为 `OPEN + INTAKE`；`status` 与 `phase` 是两个独立返回 / 存储字段，不存在组合枚举、互相推导或单一字段替代。
- **SC-004**: Family A 的管理主体无法读取 Family B 的 Case；应用层拒绝且不泄露字段；在 Family A 的 RLS 上下文直连查询 Family B Case 返回零行；无任何 RLS 上下文时 `cases` / `case_events` 查询返回零行。
- **SC-005**: 普通 Family membership 与 guardian relationship 均不能单独获得 Case 创建 / 列表 / 读取权限；拒绝由服务端执行。
- **SC-006**: `CASE_CREATE` 相同幂等键 + 相同 payload 返回原 Case 结果且记录数不变；相同键 + 不同 payload 返回 409 且不修改原 Case。
- **SC-007**: 每个成功创建的 Case 都有对应的 `case_event` 与 `business_audit_event`；不存在 Case 已持久化但无创建证据的状态，也不存在部分写入。
- **SC-008**: 数据库结构与路由清单中不存在本 Spec 排除的 Case Participant、Evidence、Problem Formulation、Safety、Plan、Task、Notification 等表、路由、占位实现或抽象。
- **SC-009**: 每个 Case 的 `version` 在创建后可读取且为确定初始值；本 Slice 没有任何更新 Case 的 API 改变该版本。
- **SC-010**: 对“有 primary Case”的 Family，管理主体仅通过 `GET /api/v1/cases` 与 `GET /api/v1/cases/:id` 即可识别当前 primary 与 phase；不存在 `/cases/current` 或第二张 primary 真相表。
- **SC-011**: 无 Case 的 Family 读取列表得到真实空结果，不出现 placeholder / 默认 Case。

## Acceptance Evidence

| Acceptance item | Verification type | Required evidence |
|---|---|---|
| 首个 Case = OPEN + INTAKE + primary（场景 1、SC-001、SC-003） | integration + database | 创建后读取的响应与数据库行断言：status/phase 两列独立、primary=true、family 归属正确、version 已初始化；响应无内容字段 |
| 后续 Case = 候选且保留（场景 2、14、SC-001） | integration | 连续创建两个 Case 后，第一个 primary=true、第二个 false，两个 ID 均可读取；无 Plan / Task / Follow-up / Notification 副作用 |
| 并发 primary 不变量（场景 3、SC-002） | database concurrency | 并发创建（不同幂等键）后执行聚合查询：`primary=true AND status<>'CLOSED'` 计数 <= 1；重复运行仍成立 |
| 列表 / 详情与 primary 读取（场景 4、5、SC-003、SC-010） | integration | 列表返回当前 Family 全部 Case 且 primary 可唯一识别；详情分别返回 status 与 phase；不存在 `/cases/current` 路由 |
| 跨家庭双层隔离（场景 6、SC-004） | integration + database | 应用层拒绝断言 + 运行角色在 Family A 上下文查询 Family B Case 返回零行；响应不含 Family B 字段 |
| 无 RLS 上下文默认拒绝（场景 7、SC-004） | database | 未设置 `app.family_id` 时 `SELECT` 返回 0 行、`INSERT` 被拒绝的实测输出 |
| 非管理主体 / guardian 拒绝（场景 8、9、SC-005） | integration | 普通成员与 guardian（非创建者）的 create / list / get 请求均被拒绝，且不依赖前端隐藏 |
| 创建幂等（场景 10、SC-006） | integration | 相同键 + 相同 payload 重试后 Case 计数不变且返回原 ID；相同键 + 不同 payload 返回 409 且原 Case 不变 |
| 创建事件与审计（场景 11、SC-007） | integration + database | 成功创建后 `case_events` 与 `business_audit_events` 各存在对应创建记录；构造事件写入失败时 Case 不落库（事务回滚证据） |
| 越界 schema / API 不存在（场景 12、SC-008） | database introspection + route enumeration | 目录 / 路由清单断言不存在排除对象；执行真实的 schema 与路由枚举输出 |
| 客户端不能指定业务字段（场景 13、SC-003、SC-009） | integration | 携带 status / phase / primary / version / creator 请求后实际落库仍为 OPEN + INTAKE、服务端 primary、初始 version、服务端 actor |
| 空 Family 真实空结果（场景 15、SC-011） | integration | 无 Case 时列表为空数组 / 空集合，详情对不存在 ID 返回真实未找到 / 拒绝，不生成占位 Case |
| RLS / 角色 / migration / uuidv7（FR-002、FR-011） | database verification | `relrowsecurity = true`、`relforcerowsecurity = true`、运行角色非 owner 且 `rolbypassrls = false`、主键默认值检查输出 |

## Assumptions and Open Questions

### Assumptions

**已由文档推导，非新增语义**

- 本 Slice 的 Case 访问必须以 Slice 1 已冻结的「当前目标 Family 的 V1 管理主体 = 创建该 Family 的 adult Person」为唯一当前管理资格；这是 §9 的正式语义，不是本 Slice 新增。
- Case 创建属于 §8.5 的“关键命令”，因此必须使用幂等合同；这不是把幂等泛化到全部读请求。
- `case_events` 作为领域历史与审计保留（§7.8）意味着不得用覆盖 / 删除既有事件的方式改写历史；具体不可变实现由 Plan 决定。
- 本 Slice 不交付页面；U04 只要求服务端能力，微信小程序 / 运营后台 UI 属 §28A，不在本 Spec。
- 未来 Participant / Visibility 的权限细节未定；本 Spec 只要求当前管理主体访问，不提前决定孩子或其他成员能看到什么。

**无上游明文，本轮显式标注（不得当成已批准需求）**

- **A-1 NOT_FOUND 与 DENIED 的对外表现**：正式文档只要求跨家庭和无授权访问失败（§37.2）且不能因 ID 存在而放行（§9），未规定二者对外是否一致。本 Spec 只断言“拒绝且不携带目标对象字段”；统一 404 / 403 的选择留待 Owner / Plan。
- **A-2 `CASE_CREATE` 幂等键的传输位置**：§8.5 只定义 `actor_id + command_type + idempotency_key` 合同，未规定键放在 header 还是 body；由 Plan 决定，但不得改变本 Spec 的幂等语义。
- **A-3 响应字段命名**：本 Spec 使用 `status` / `phase` / `primary` / `version` 等逻辑名称；具体 JSON 字段名与包装结构由 Plan 依据 §28.3 的 API 契约面决定，不得引入第二真相源或内容字段。
- **A-4 读审计**：上游未要求每次读取产生审计事件；本 Spec 只要求创建留痕。若 Plan 增加读审计，不得改变读取语义、不得保存 Case 正文或引入新的产品承诺。

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