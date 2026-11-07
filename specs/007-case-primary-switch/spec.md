# Feature Specification: Case 主问题切换（Case Primary Switch / `SwitchPrimaryCase`）

**Feature Directory**: `specs/007-case-primary-switch`
**Created**: 2026-11-07
**Status**: Specify / Clarify FINAL PASS — READY FOR PLAN AI 2
**V1 Phase**: Phase 1 — Common Core 地基（`Docs/V1技术设计.md` §38；Case 容器与主线的控制面补全）
**Stage**: Specify / Clarify only。**禁止进入 Plan / Checklist / Tasks / Implement。**
**Docs baseline**: `Docs/V1产品需求.md` **v3.7**、`Docs/V1技术设计.md` **v3.12**（2026-11-06）

> 本 Spec 是已批准 Xiaoshuyin 文档的下游实现投影，不得引入未获批准的产品语义。
>
> **Slice 边界**: 本 Slice 只补一个真实能力：**把一个已存在的 Case 指定为当前 Family 的唯一主要 Case（普通执行主线），并把原主要 Case 降为非主要 Case**。它不是 Case Status / Phase 状态机、不是关闭、不是复发、不是安全状态实现。

---

## 0. Slice Selection Basis（为什么是 007）

当前仓库已有 Slice 的真实归属见 §4。Phase 1 剩余未拥有能力中，唯一在 001 + 002 之上**可以完整、真实、无虚构地实现**的，是主问题切换：

| 候选 | 上游依据 | 现在可判定结论 |
|---|---|---|
| A. Case 主问题切换（本 Slice） | V1-C01、产品 §2.1、技术 §8.1 / §23 / §28.3 / §29.4、§39 V1-C01 验收行 | **选中**：V1-C01 的 §39 验收明确包含「并发创建/切换」，而 Slice 2 只实现了创建；该能力无任何 Phase 4/5 对象前置 |
| B. Case Status 服务状态命令（Pause / Resume） | V1-C18、§6.6、§28.3 | 暂不选：其验收（「普通提醒必须随状态和授权停止」）依赖 Follow-up Schedule / Notification（§24—§26，Phase 4）；Resume 的前置链（Safety / Policy / Plan）尚未存在，此时冻结会迫使 Spec 对未实现子系统做语义让步 |
| C. Problem Formulation 核心 | V1-C04、§2.5、§7.2、§8.2、§12.4、§29.1、§28.3 | 暂不选：硬依赖 Slice 3（Evidence）实现，且自然的生产者（Assessment / AI）属 Phase 2—3；现在冻结会先撞上「谁产生 formulation」这一产品空白 |

**结论**：切片顺序按依赖与可真实性排序，不按 §38 行文顺序。主问题切换补齐的是 V1-C01 的**未完成验收半句**，且是后续所有「只有 primary 可推进」判定（§5 不变量 19、§6.7）能够被真实改变而非永久钉死在「第一个 Case」上的前置。

---

## Upstream Traceability

| Upstream ID / Section | Source | 本 Slice 的投影 |
|---|---|---|
| V1-C01 | `Docs/V1产品需求.md` §24 | 一个家庭最多一个当前主要 Case 执行主线；候选问题可保留，且「需要切换主要 Case」是正式产品动作 |
| §2.1 | `Docs/V1产品需求.md` | 切换主要 Case 的六条产品规则：说明理由、保留原 Case 全部业务内容、处理旧任务与提醒、由有权用户确认、切换后才启动新主线、安全状态不能靠「切走 Case」规避 |
| U04 | `Docs/V1产品需求.md` §23 | 「查看当前主要 Case 与阶段」在切换后必须立即反映新的主问题，不引入第二真相源 |
| V1-C21 | `Docs/V1产品需求.md` §24 | 跨成员 / 跨家庭访问必须按真实授权隔离，不能靠前端隐藏 |
| V1-C24 | `Docs/V1产品需求.md` §24 | AI 无最终业务确认权：切换是本人在位确认，AI 只能建议 |
| V1-C25 | `Docs/V1产品需求.md` §24 | Safety 可在任意阶段中断普通流程，不可被普通操作绕过 |
| V1-C27 / V1-C28 | `Docs/V1产品需求.md` §24 | 失败必须返回真实状态；重复 / 并发 / 重试不得制造重复业务结果 |
| §5 不变量 1 / 2 / 12 / 17 / 19 / 20 | `Docs/V1技术设计.md` | 对象分开；最多一个当前主要未结 Case；Safety Hold 优先；并发不重复；只有 primary 可进入或恢复普通执行；SAFETY_HOLD 不能被主线切换覆盖 |
| §8.1 | `Docs/V1技术设计.md` | 「一个家庭最多一个当前主要未结 Case」必须由数据库保证，不能只靠前端或 AI runtime |
| §8.5 / §8.6 | `Docs/V1技术设计.md` | 关键命令幂等合同；关键聚合版本与旧版本请求不得覆盖新状态 |
| §6.1 / §6.2 | `Docs/V1技术设计.md` | Case Status / Phase 词汇；二者独立存储、不可互推；本 Slice 不改变二者 |
| §7.8 / §7.9 | `Docs/V1技术设计.md` | `case_events` 是领域历史，不得覆盖；`business_audit_events` 追加审计 |
| §9 / §9.1 | `Docs/V1技术设计.md` | 统一 `authorize()`；按当前目标 Family 判定；`case_id` 只是待验证参数；RLS 为第二道防线 |
| §23 | `Docs/V1技术设计.md` | `SwitchPrimaryCase` 是正式 Domain Command；模型只能 request / propose |
| §28.3 | `Docs/V1技术设计.md` | 已批准契约面：`POST /api/v1/cases/:id/switch-primary` |
| §29.4 | `Docs/V1技术设计.md` | 主问题切换事务合同：锁 Family、重读 primary 与目标、当前 primary 不得 SAFETY_HOLD、目标不得 CLOSED、授权、目标原 status/phase 不自动恢复、最多一个 primary、写原因与新旧 primary、审计 |
| §37.2 | `Docs/V1技术设计.md` | 跨家庭与无授权访问是硬阻断；重试不重复产生业务结果 |
| §38 Phase 1 | `Docs/V1技术设计.md` | 本 Slice 属 Phase 1「Case Status / Phase」与「Domain Commands」交叉处的容量补全，不越入 Phase 2—6 |
| §39 V1-C01 行 | `Docs/V1技术设计.md` | 验收明文：「并发创建/切换后最多一个 primary 普通执行主线」 |
| Slice 2（`specs/002-case-core`） | 已冻结投影 | `cases.is_primary` / `version` / `case_events` / `CASE_CREATE` 幂等类型 / Case 管理主体语义由 Slice 2 拥有；本 Slice 只在其上增加**唯一**的主线变更命令 |

**Blocking rule**: 任何无法追溯到上表的扩展必须标记 `NEEDS UPSTREAM DECISION` 且不得实现。本 Spec 未使用该标记。

**编号说明**：用户口头所称「Slice 6」指 001—006 之后的下一个 **implementation** slice。仓库中 `005` 是合同、`006` 是该合同的 runtime，因此下一可用实现编号为 `007`。

---

## 1. Problem

Slice 2 建立了 `cases` 容器与「一个 Family 最多一个当前主要未结 Case」的数据库不变量，但**故意不实现任何主线变更命令**（002 FR-005 / FR-018 明确 `/switch-primary` 必须不存在）。结果是当前系统存在一个真实的产品空洞：

1. 一个 Family 只能永久保留第一个 Case 为 primary；后续 Case 被创建为候选后**无法成为主线**，V1-C01 的「候选问题可保留」因此只是半功能：候选可写不可用。
2. `Docs/V1技术设计.md` §39 对 V1-C01 的验收明写「并发创建/**切换**后最多一个 primary」，其中「切换」在当前实现中没有任何可执行路径。
3. 所有后续「只有 primary 可以推进」的判定（§5 不变量 19、§6.7 的 Resume / Confirm Formulation / Confirm Goal / Activate Plan / Review 推进）都建立在一个**不可变**的 primary 上；一旦 Phase 2 之后开始按 primary 守门，这个空洞会固化成架构缺陷，而不是一个待补功能。
4. 产品 §2.1 已经把「切换主要 Case」写成六条正式规则，其中「由有权用户确认」「安全状态不能靠切走 Case 规避」属于当前就能冻结并验证的业务语义，不属于未来规划。

因此本 Slice 的存在理由不是「Case 还缺个接口」，而是：**V1-C01 的唯一性和可变更性必须成对存在，否则唯一性只是「第一个赢」的别名。**

---

## 2. Goal

本 Slice 完成后，系统新增以下真实能力：

1. 一个 Family 的 V1 管理主体（创建该 Family 的 ADULT Person）可以把该 Family 中一个已存在的 Case 指定为**当前唯一主要 Case**，使原主要 Case 真实降为非主要（候选）Case。
2. 该动作在**一个事务**内完成：原 primary 降级、目标升级、两侧领域历史与一条业务审计、幂等结果快照一起提交；任一步失败则整体不生效。
3. 切换**只改变「哪一个是当前主线」**：不改变任何 Case 的 `status` / `phase`，不恢复执行、不激活 Plan、不创建/迁移 Follow-up Schedule、不产生通知。
4. 切换后 `GET /api/v1/cases` 立即反映新的 primary，且系统中不存在第二个「当前 Case」真相源。
5. 并发、重试、重复提交下：最终最多一个非 CLOSED 的 primary；同一请求重放返回原结果且不追加第二条历史。

---

## 3. Non-Goals

本 Slice **明确不做**：

1. **不实现 Case Status 状态机**：不实现 `PauseCase` / `ResumeCase` / `WaitForInformation` / `ResumeAfterInformation` / `MarkLostContact` / `UserReturned` / `CloseCase` / `CreateRecurrence`；不改变任何 Case 的 `status`。
2. **不实现 Case Phase 状态机**：不实现 `StartAssessment` / `PresentProblemFormulation` / `ConfirmProblemFormulation` / `ConfirmGoal` / `ActivatePlan` / `OpenReview` / `CompleteReview` / `EnterMaintenance`；不改变任何 Case 的 `phase`。
3. **不实现 Safety**：不建立 Safety State、不实现 `EnterSafetyHold` / `ResolveRisk`、不做风险词检测、不产出支持资源。本 Slice 只把 §29.4 与 §5 不变量 12/20 要求的**状态谓词**放进切换守卫。
4. **不实现关闭 / 复发**：不写 Outcome、Closure Reason、Referral、`CreateRecurrence`、Case 间关联。
5. **不实现 Follow-up Schedule / Task / Notification 的迁移或取消逻辑**：当前不存在这些对象；本 Slice 只冻结「降级 Case 不得继续普通推进」的后置不变量，并在 §13 留下 Phase 4 的显式前向义务。
6. **不建立"晋升审批流"**：不引入候选 Case 的评估、排序、建议、审批、投票或多管理员机制；切换就是管理主体的一次显式命令。
7. **不引入 AI 参与**：不生成切换理由、不推荐切哪个 Case、不允许模型调用该命令；V1-C24 只允许 request / propose，而 propose 通道不在本 Slice。
8. **不新增第二真相源**：不新增 `/cases/current`、不复制 primary 到新表、不用列表排序伪装「当前 Case」。
9. **不扩展可见性**：不定义孩子 / 其他成员 / Participant 在切换后能看到什么；不建立 Visibility Matrix、Case role、RBAC。
10. **不做数据权利**：不实现查看 / 更正 / 导出 / 删除，不实现切换历史的对外导出（Phase 5）。
11. **不做 UI**：微信小程序与运营后台页面属 §28A。
12. **不优化性能基线**：不发明 p95 / 并发上限（§37.2 未给出）。

---

## 4. Ownership

### 4.1 本 Slice 拥有（业务事实与行为）

| 拥有的对象 / 事实 | 说明 |
|---|---|
| 「哪个 Case 是当前主要 Case」的**变更**语义 | 唯一允许改变 `is_primary` 的运行时命令；创建时的自动 primary 判定仍归 Slice 2 |
| `SwitchPrimaryCase` 命令的前置条件、顺序与冲突语义 | 含 primary 互斥、目标可用性、安全状态谓词、陈旧视图拒绝 |
| 切换原因（reason）的业务事实 | 由发起的管理主体提供；属于该次切换的不可变历史 |
| 切换产生的 `case_events`（两侧）与 `business_audit_events`（一条）语义 | 事件/审计的**业务含义**；具体列与枚举名由 Plan 在既有词汇表内决定 |
| `CASE_SWITCH_PRIMARY` 幂等命令类型 | 命令类型的所有权与 canonical payload 语义 |
| Case 授权的新增 action（切换动作） | 复用 Slice 1 `authorize()` 的形状与 Case 管理主体判定，只新增该 action |
| 「切换不改变 status / phase / 执行状态」的不变量 | 防止后续 Slice 把切换当隐式恢复 |

### 4.2 本 Slice 只消费，不拥有

| 对象 / 能力 | 拥有者 | 本 Slice 的边界 |
|---|---|---|
| `cases` 容器、`status` / `phase` 字段与词汇、`version`、`created_by_person_id` | Slice 2 | 只读 + 仅写 `is_primary` 与 `version`；不改其它列语义 |
| `cases_one_primary_open_per_family` 类数据库不变量 | Slice 2 | 只依赖，不重建、不弱化；不得把唯一约束冲突当正常分支 |
| Case 管理主体 = 创建 Family 的 ADULT Person | Slice 1 / 2 | 只复用，不重新定义、不放宽、不新增 Case role |
| `authorize()` / `withRlsTransaction` / RLS policy 基线 | Slice 1 | 增量使用；新增 action 必须经 reviewed 变更，不得私建第二套授权 |
| `idempotency_keys` 合同与重放快照 | Slice 1 | 新增一个 command_type，不改合同 |
| `business_audit_events` / `case_events` 基础设施 | Slice 1 / 2 | 新增事件/资源词汇，不建第二套审计框架 |
| Family 行锁 / primary 决策串行化原语 | Slice 2 | 只复用（Slice 2 已冻结「应用层串行化 + 唯一索引兜底」） |
| Family 解析（NONE / RESOLVED / AMBIGUOUS）与错误映射 | Slice 1 | 只复用，不定义第二套 Family 错误码 |

### 4.3 本 Slice 明确不拥有（由其他 Slice 拥有）

- Case Status / Phase 转换：本 Slice 不认领、不空壳化（Slice 2 FR-005 的排除继续有效，除本 Spec 明确新增的一个端点外）。
- Participant / 邀请 / 身份绑定：Slice 4 / 005 / 006。
- Evidence（Statement / Observation / Fact / Hypothesis）：Slice 3。
- Problem Formulation：未来 PF Slice。
- Safety State / `SAFETY_HOLD` 写入、风险事件、支持资源：未来 Safety Slice。
- 关闭、Outcome、Closure、Referral、复发：未来 Closure Slice。
- Schedule / Task / Notification / pg-boss：Phase 4。

---

## 5. Actors

| Actor | 能做什么 | 不能做什么 |
|---|---|---|
| **Family V1 管理主体**（创建该 Family 的 ADULT Person，Slice 1 冻结语义） | 对自己 Family 中任一非 CLOSED、非 SAFETY_HOLD 的 Case 发起切换；必须提供理由；可反复切换 | 不能切换到其他 Family 的 Case；不能把 CLOSED Case 设为 primary；不能在当前 primary 处于 SAFETY_HOLD 时切换走；不能指定 `is_primary` / `version` / 事件类型；不能跳过授权或审计 |
| **同一 Family 的普通成员**（非管理主体） | 无切换能力；其读取能力不由本 Slice 改变 | 不能切换；本端点对其统一返回 `404 CASE_NOT_FOUND`，不泄露 Case 是否存在、谁是 primary |
| **Guardian（非该 Family 成员）** | 无 | 不能切换；Family 上下文未合法解析，沿用 Slice 1 语义，不得被转换为 Case 错误码 |
| **其他 Family 的 Actor** | 无 | 不能切换；跨家庭为硬阻断（§37.2） |
| **未来 Participant（孩子 / 受邀成员）** | 本 Slice 不赋予任何切换或读取能力 | 不得因参与关系获得主线控制权（§10 的有限权限不外溢到管理动作） |
| **内部员工 / 运营** | 无 | 不提供后台代操作入口；不建立 staff assignment 语义 |
| **AI / 模型 / Worker** | 无 | 不得调用该命令、不得代用户确认、不得自动切换（V1-C24、§23） |

---

## 6. Domain Semantics

### 6.1 词汇

- **主要 Case（primary）**：该 Family 当前唯一进入普通执行主线、可继续推进的 Case。用 `cases.is_primary = true` 表达，与 `status` / `phase` 正交。
- **候选 Case（candidate）**：同一 Family 中真实保留但不进入普通执行主线的 Case（`is_primary = false`）。
- **未结（not closed）**：`status != CLOSED`。唯一性只在未结 Case 上成立（Slice 2 冻结口径）。
- **切换（switch）**：把目标 Case 置为 primary，并把原 primary（若存在且不是目标）置为非 primary 的单个原子命令。

### 6.2 命令语义

`SwitchPrimaryCase(family, targetCase, reason, actor, idempotencyKey, 客户端已知主线视图)`

- 目标由路径参数指定（§28.3 的 `:id`），语义是「让这个 Case 成为当前主要 Case」。
- 命令成功后：目标 `is_primary = true`，原 primary（若存在）`is_primary = false`，两者 `version` 各自前进一版。
- 命令不返回「建议」或「候选排名」，只返回已提交的结果。

### 6.3 前置条件（固定顺序，任一条不满足即终止且零业务写入）

1. **认证**：存在已认证 actor（401 否则）。
2. **Family 解析**：按 Slice 1 语义解析当前目标 Family；`NONE` → `404 CURRENT_FAMILY_NOT_FOUND`，`AMBIGUOUS` → `409 CURRENT_FAMILY_AMBIGUOUS`（不新增 Family 错误码）。
3. **目标可见性**：目标 Case 必须存在、属于当前目标 Family、且 actor 为该 Family 的 V1 管理主体；三者任一不满足 → 统一 `404 CASE_NOT_FOUND`（不泄露存在性，沿用 Slice 2 FR-023 的 case-scoped 口径）。
4. **目标不是 CLOSED**：`target.status = CLOSED` → 冲突终态；零写入。
5. **目标不是 SAFETY_HOLD**：`target.status = SAFETY_HOLD` → 冲突；零写入（推导见 Clarifications Q3）。
6. **当前 primary 不处于 SAFETY_HOLD、且无生效安全阻断**：否则 → 冲突；零写入（§29.4 第 3 步、产品 §2.1 第 6 条）。
7. **目标不是当前 primary**：`target` 已是 primary → 冲突；不得伪造成成功、不得递增版本、不得写事件（见 Q1）。
8. **陈旧视图拒绝**：请求 MUST 表达其所依据的「当前主线视图」（期望的当前 primary 或期望版本）；若该视图已过期（期间发生其他切换或创建导致的 primary 变化），必须冲突失败，不得用旧视图覆盖新状态（§8.6、V1-C28）。具体字段形态由 Plan 决定。
9. **理由合法**：`reason` 必须非空（去除首尾空白后）、长度受限、非纯空白；具体上限由 Plan 决定，但 MUST NOT 允许空串或无限长文本。
10. **幂等预检**：同 `actor + command_type + idempotencyKey` 已提交则走重放；同 key 不同 canonical payload → `409 IDEMPOTENCY_PAYLOAD_MISMATCH`。

> 顺序不是实现细节：授权必须先于重放（不得把旧的存储响应返回给无权请求），Family 解析必须先于 Case 判定，安全谓词必须先于写入。

### 6.4 效果（同一业务事务）

1. 原 primary（存在且 ≠ 目标）：`is_primary → false`，`version + 1`，追加该 Case 的领域事件（失去主线），其余字段与内容**一律不变**。
2. 目标：`is_primary → true`，`version + 1`，追加该 Case 的领域事件（成为主线，含 reason、actor、原 primary 标识），其余字段与内容**一律不变**。
3. 追加一条 `business_audit_event`：actor、Family、目标、原 primary（可为空）、reason、发生时间。
4. 写入幂等结果快照（供重放返回同一结果）。
5. 上述 1—4 必须同事务提交；不存在「目标已升级、原 primary 未降级」或「状态已改、历史未写」的中间持久态。

### 6.5 后置不变量

1. 该 Family 中 `is_primary = true` 且 `status != CLOSED` 的 Case **恰好一个**（存在目标时）。
2. 任何 Case 的 `status`、`phase` 与切换前完全相同。
3. 没有因为切换而产生或删除：Plan、Task、Schedule、Notification、pg-boss job、Evidence、Formulation、Participant、Safety 记录。
4. 原 primary 的全部业务数据（未来包括问题理解、目标、方案、执行、结果）保持可读、可追溯；切换不删除、不归档、不改写。
5. 切换历史只能追加，不能覆盖；后续切换不得让上一次切换看起来「从未发生」。

### 6.6 「无当前 primary」的边界

若该 Family 当前不存在未结 primary（当前只能由未来的关闭流程造成）：

- 同一命令语义为**晋升**：目标成为 primary，无降级对象，`previousPrimary = null`。
- 该分支现在不可达（`CloseCase` 未实现），但 Spec 冻结其语义，禁止 500、禁止拒绝、禁止创建第二个 primary。
- 推导见 Clarifications Q2。

### 6.7 候选 Case 的业务位置

- 候选 Case 仍然是**真实、可读、可归属、可审计**的 Case（Slice 2 已冻结），只是不进入普通执行主线。
- 本 Slice 不定义候选 Case 的评估、优先级、排序或「建议切换」算法。
- 切换后，被降级的 Case 不再满足「只有 primary 可进入或恢复普通执行」的条件（§5 不变量 19）；该约束由后续状态命令在执行时读取当前 primary 保证，本 Slice 不代其实现。

---

## 7. Authorization / Visibility

1. **唯一执行主体**：当前目标 Family 的 V1 管理主体（创建该 Family 的 ADULT Person）。该判定必须复用 Slice 1 / 2 已冻结语义，不得新增 Case role、RBAC、Visibility Matrix 或「管理员」概念。
2. **客户端参数不可信**：`family_id` / `case_id` 只作为待验证参数；ID 存在不构成访问依据（§9）。
3. **不得依赖 UI 隐藏**：服务端必须在应用层拒绝，并由 RLS 作为第二道防线；无权上下文下 `cases` 读取为 0 行、写入拒绝。
4. **错误不泄露存在性**：case-scoped 切换对「Case 不存在 / 属于其他 Family / actor 非管理主体」统一 `404 CASE_NOT_FOUND`，响应不得包含 status、phase、primary、creator、Family 或是否存在。
5. **读取可见性不变**：本 Slice 不改变 `GET /api/v1/cases` 与 `GET /api/v1/cases/:id` 的可见性规则；不新增「谁能看切换历史」的对外接口。
6. **不授予任何额外权限**：成为 primary 不授予 Case 内容访问、不授予 Participant 能力、不授予 Consent、不改变 guardian 关系。
7. **管理主体恒为 ADULT**：Family 创建者必须是 ADULT（Slice 1 已冻结），因此本 Slice 不引入未成年人作为执行主体的路径。

---

## 8. Consent / Compliance / Minor Policy

1. 本 Slice **不处理**未成年人个人信息、不采集新的 Person 资料、不改变 Compliance Profile、不创建或消费 Consent。
2. 切换命令**不得**要求、暗示或替代任何 guardian consent；切换不是同意、不是参与、不是身份绑定。
3. 本 Slice **不新增** `compliance_feature_policies`、PIPIA、生成内容标识、拟人化适用性、连续使用计时等 §27B 能力（属 Phase 3/5）。
4. 若未来 Participant / 未成年人成为可执行主体，必须由对应 Slice 显式扩展授权，不得在本 Slice 预留角色位或空实现。
5. 由于执行主体只能是 ADULT 管理主体，本 Slice 不产生「孩子被要求确认主线」的产品语义；孩子拒绝参与与主线切换无关。

---

## 9. Concurrency / Idempotency

> 本节只冻结业务语义；锁、隔离级别、索引、表结构、哈希算法属 Plan。

### 9.1 幂等

1. 切换属 §8.5 关键命令，使用 `actor_id + command_type + idempotency_key`。
2. 相同 key + 相同 canonical payload（含同一目标、同一 reason、同一 `actor + family` scope）→ 返回**原结果**：不重复降级、不重复升级、不追加第二组事件/审计、不再次递增版本。
3. 相同 key + 不同 canonical payload（例如同一 key 指向另一个目标 Case）→ `409` 幂等载荷不匹配，零业务写入，原结果不变。该分支在本命令上**是可达的**（与 `CASE_CREATE` 不同），必须被真实覆盖，不得只做 domain 层验证。
4. canonical payload 必须覆盖所有会改变业务结果的输入；MUST NOT 通过切换 actor 或新增无业务意义字段制造/规避 mismatch。
5. 幂等键的传输位置由 Plan 决定（§8.5 未规定 header / body），但不得改变上述语义。

### 9.2 并发

1. **并发两次切换（不同 key，不同目标）**：必须串行化；恰好一个成功，另一个以冲突失败（或在其自身可判定为陈旧视图时失败）。最终恰好一个 primary。
2. **并发切换到同一目标（不同 key）**：恰好一个产生业务结果；另一个要么重放（同 key 才可能）、要么以「已是 primary / 陈旧视图」冲突失败；不得产生两次降级或两个事件组。
3. **切换与创建并发**：最终最多一个未结 primary；创建命令的既有语义（无 primary 时自动成为 primary、已有 primary 时为候选）不得被本 Slice 改变。允许的两种提交顺序都必须收敛到单一 primary。
4. **切换与未来命令并发**（关闭、暂停、Safety 进入）：本 Slice 只要求「不得产生两个 primary」与「不得覆盖已提交的 SAFETY_HOLD 判定」；具体交错由后续 Slice 的守卫补齐，Plan 必须把守卫设计成可扩展的固定检查序列。
5. **数据库唯一约束是最后一道防线**：唯一索引冲突不得被当作正常业务分支吞掉；出现即代表串行化失效，必须整体回滚并返回真实失败。
6. **乐观并发**：切换修改两个 Case 的 `version`；旧版本请求不得覆盖新状态（§8.6）。请求必须携带客户端所依据的主线视图（版本号或期望的当前 primary），字段形态由 Plan 决定；陈旧必须被拒绝而不是静默胜出。

### 9.3 事务边界

- 授权读取、Family 解析、primary 决策、两次 Case 更新、两组领域事件、一条审计、幂等快照必须在同一 PostgreSQL 事务内。
- 本 Slice 不引入异步任务、队列、外部副作用；不存在跨事务补偿。

---

## 10. Auditability

必须可追溯（按 §7.8 / §7.9 / §29.4）：

1. **每次成功切换**必须同时留下：
   - 目标 Case 的领域事件：成为主线、actor、理由、原 primary 标识、发生时间；
   - 原 primary 的领域事件：失去主线、actor、新 primary 标识、发生时间（若存在原 primary）；
   - 一条业务审计：Family、actor、目标、原 primary、理由、发生时间。
2. **重放**不追加上述任何记录；**失败**（无授权 / 未找到 / 冲突 / 校验失败 / 幂等 mismatch）不产生业务事件与业务审计，也不得留下半条历史。
3. **历史不可改写**：后续切换只能追加；不得通过更新/删除既有事件让历史与当前状态「看起来一致」。
4. **审计不得成为访问日志**：普通读取不因本 Slice 产生事件（沿用 Slice 2 D7 口径）。
5. **理由必须随历史保留**：不得只在当前状态上保留最后一次理由而丢弃先前切换的理由。
6. 审计内容不得包含 Case 业务内容（本 Slice 本就没有内容字段）；不得写入 token、openid 等凭据。

---

## 11. Failure Semantics

| 类别 | 触发 | 对外语义 | 业务写入 | 可重试 |
|---|---|---|---|---|
| `UNAUTHENTICATED` | 无有效会话 | `401` | 无 | 否（需重新登录） |
| `CURRENT_FAMILY_NOT_FOUND` | actor 无可解析 Family | `404`（Slice 1 语义） | 无 | 否 |
| `CURRENT_FAMILY_AMBIGUOUS` | 多 Family 无法唯一解析 | `409`（Slice 1 语义） | 无 | 否（需消歧） |
| `CASE_NOT_FOUND` | 目标不存在 / 属于其他 Family / actor 非管理主体 | `404`，不泄露存在性 | 无 | 否 |
| `VALIDATION_ERROR` | 缺 `idempotencyKey` / 缺 reason / 空白 reason / 超长 / 缺主线视图 / 未声明字段 | `422` | 无（零业务写入、无幂等快照） | 否（修正请求） |
| `CASE_ALREADY_PRIMARY` | 目标已是 primary | `409` 冲突 | 无 | 否（终态无操作） |
| `CASE_CLOSED` | 目标已 CLOSED | `409` 冲突 | 无 | 否（终态） |
| `SAFETY_HOLD_BLOCKED` | 当前 primary 处于 SAFETY_HOLD，或目标处于 SAFETY_HOLD | `409` 冲突 | 无 | 否（需先走 Safety 流程） |
| `STALE_PRIMARY_VIEW` | 请求基于过期主线视图 / 版本不符 | `409` 冲突 | 无 | 是（重新读取后再试） |
| `IDEMPOTENCY_PAYLOAD_MISMATCH` | 同 key 不同 canonical payload | `409` | 无，原结果不变 | 否（换 key 或修正） |
| `INTERNAL_ERROR` | 数据库/未知失败、唯一约束意外冲突 | `500` | 必须整体回滚，无部分写入 | 是（可安全重试） |

补充规则：

- **重复请求 ≠ 失败**：同 key 同 payload 的成功重放返回成功结果，不得返回 409。
- **不得伪造成功**：冲突、无权、终态一律返回真实失败，不得返回 200 + 未变更状态（V1-C27）。
- **不得成功但无证据**：事件与审计属业务事实，必须与状态变更同事务；不允许「主线已改但历史缺失」或「历史已写但主线未改」。辅助日志（tracing 等）失败不得改变业务结果。
- 错误码字符串除 Slice 1 / 2 已冻结者外由 Plan 命名，但语义类别与 HTTP 状态不得改变。

---

## 12. Requirements

- **FR-001** [UPSTREAM: V1-C01 / §2.1 / §8.1] 系统 MUST 提供把一个已存在 Case 指定为当前 Family **唯一主要 Case** 的命令；成功后原 primary（若存在且不同）MUST 降为非 primary。该不变量 MUST 继续由 Slice 2 已冻结的数据库约束兜底，MUST NOT 只靠应用层判断。
- **FR-002** [UPSTREAM: §28.3 / §29.4] 对外契约面 MUST 且仅 MUST 增加 `POST /api/v1/cases/:id/switch-primary`；`:id` 是**目标** Case。MUST NOT 新增 `/cases/current`、`/cases/:id/primary`、批量切换或任何第二真相源端点。
- **FR-003** [UPSTREAM: §9 / Slice 2 FR-008 / FR-023 / FR-024] 执行主体 MUST 是当前目标 Family 的 V1 管理主体；其他成员、跨 Family actor MUST 被拒绝。对「目标 Case 不存在 / 属于其他 Family / actor 非管理主体」的 case-scoped 拒绝 MUST 统一为 `404 CASE_NOT_FOUND`，MUST NOT 泄露目标 Case 是否存在或其字段。若 actor 不是目标 Family 的成员（含仅有 guardian 关系的情形），Family 上下文未合法成立，MUST 沿用 Slice 1 的 Family 解析失败语义，MUST NOT 转换为 `CASE_NOT_FOUND` / `CASE_ACCESS_DENIED`。
- **FR-004** [UPSTREAM: §29.4 第 4 步] 目标 Case 为 `CLOSED` 时 MUST 拒绝，MUST NOT 把它设为主线，MUST NOT 隐式重开。
- **FR-005** [UPSTREAM: §5 不变量 12 / 20、V1-C25、§29.4 第 3 步、§2.1 第 6 条] 当前 primary 处于 `SAFETY_HOLD` 或存在生效安全阻断时 MUST 拒绝切换；目标处于 `SAFETY_HOLD` 时同样 MUST 拒绝。MUST NOT 允许通过切换规避或绕过安全状态；该判定 MUST 以真实状态谓词实现，MUST NOT 写成恒真/恒假的占位。
- **FR-006** [UPSTREAM: §29.4 第 6 步、§5 不变量 19] 切换 MUST NOT 改变任何 Case 的 `status` 或 `phase`；目标原状态 MUST NOT 在切换事务中自动恢复；切换 MUST NOT 使降级 Case 继续普通推进，也 MUST NOT 使目标 Case 自动获得执行能力。
- **FR-007** [UPSTREAM: §2.1 第 2 条、§7.8] 切换 MUST NOT 删除、归档、覆盖或改写原 primary 的任何业务数据与历史；原 Case 的问题理解、目标、方案、执行与结果（未来对象）在其被创建后 MUST 保持可读可追溯。
- **FR-008** [UPSTREAM: §2.1 第 1 条、§29.4] 命令 MUST 携带非空理由；理由 MUST 随该次切换的历史与审计保留，MUST NOT 被后续切换覆盖或丢弃。系统 MUST NOT 由模型代写理由。
- **FR-009** [UPSTREAM: V1-C24 / §23] 切换 MUST 是"本人显式确认"的 Domain Command；AI / 模型 / Worker MUST NOT 调用、自动触发或代替用户确认；本 Slice MUST NOT 提供 AI 建议切换通道。
- **FR-010** [UPSTREAM: §8.5 / V1-C28] 切换 MUST 遵循 `actor_id + command_type + idempotency_key` 幂等合同：同 key 同 canonical payload MUST 返回原结果且零重复写入；同 key 不同 canonical payload MUST 返回 `409` 且不修改原结果。该 mismatch 分支 MUST 在 HTTP 层可达并被真实覆盖。
- **FR-011** [UPSTREAM: §8.6 / V1-C28] 基于过期主线视图的切换 MUST 冲突失败，MUST NOT 用旧视图覆盖新状态；命令 MUST 携带客户端所依据的主线视图（期望 primary 或期望版本），缺失时不得退化为"无条件覆盖"。两个 Case 的 `version` MUST 随成功切换前进，旧版本请求 MUST NOT 覆盖新状态。
- **FR-012** [UPSTREAM: §29.4 / §7.8 / §7.9] 成功切换 MUST 在同一事务内产生两侧领域事件与一条业务审计；重放与失败 MUST NOT 追加；MUST NOT 出现"主线已变但无历史"或"历史已写但主线未变"的持久态。
- **FR-013** [UPSTREAM: §5 不变量 1 / §7.1] 本 Slice MUST NOT 引入 Case 角色、RBAC、Visibility Matrix、Participant 权限或任何"管理员"抽象；MUST NOT 把 primary 与 Participant / Account / guardian 合并。
- **FR-014** [UPSTREAM: §7.2 / §29.4 / §38] 本 Slice MUST NOT 创建或空壳化 `problem_formulations`、`dialogue_messages`、`assertions`、`observations`、`case_participants`、`scene_node_states`、`scene_artifacts`、`risk_events`、`referrals`、Plan / Task / Review / Schedule / Notification / AI / Memory 等对象、表、字段或路由。
- **FR-015** [UPSTREAM: §5 不变量 17 / §9.1] 切换 MUST 在单一事务内完成；并发与重试下 MUST NOT 产生两个未结 primary、两次降级、两个业务结果或半个结果。唯一约束冲突 MUST 视为真实失败并整体回滚，MUST NOT 被吞掉。
- **FR-016** [UPSTREAM: §9.1 / §37.2] `cases` / `case_events` 的 RLS MUST 继续强制生效；无上下文默认拒绝；错误 Family 上下文下 MUST 零行/拒绝写入。本 Slice MUST NOT 放宽任何既有 policy。
- **FR-017** [UPSTREAM: V1-C27] 所有失败 MUST 返回真实状态；MUST NOT 用 200 + 未变更状态伪装成功，MUST NOT 用 404 掩盖 500，MUST NOT 把终态冲突写成校验错误。
- **FR-018** [UPSTREAM: §5 不变量 5 / V1-C03] 切换不产生"未知/拒绝/不适用"类业务值；本 Slice MUST NOT 为 Case 或切换结果补造任何默认值、默认理由或默认目标。
- **FR-019** [UPSTREAM: §2.1 第 3 条 + §24 / §25 尚未实现] 当前不存在 Follow-up Schedule / Task / Notification；本 Slice MUST NOT 伪造其迁移或取消。但 MUST 冻结后置不变量：被降级 Case 不得保留"仍会继续普通推进"的语义，并在 §13 留下 Phase 4 的显式前向义务。
- **FR-020** [UPSTREAM: §28.3 / Slice 2 FR-018 的范围性质] 本 Slice 的新增端点是对 Slice 2 **范围限制**的合法收窄，不是对上游需求的改写；Slice 2 的越界守卫断言 MUST 按 Slice 范围精确收窄（仅放行本端点），MUST NOT 被整体删除或削弱为"不再检查越界"。

No requirement may be invented to make implementation easier.

---

## 13. Downstream Contract

后续 Slice 可以稳定依赖：

1. **唯一性**：任一 Family 的非 CLOSED primary 至多一个；`is_primary` 的写入路径必须保持封闭可枚举——当前为「Slice 2 的创建判定」与「本 Slice 的切换命令」。任何未来新增写入路径（例如关闭时清理主线）必须在其上游合同中显式冻结，MUST NOT 由实现顺手写入。
2. **不可跳过**：任何"只有 primary 才能推进"的判定（Resume、Confirm Formulation、Confirm Goal、Activate Plan、Review 推进）MUST 在执行时读取当前 primary；MUST NOT 缓存或假定 primary 不变。
3. **不隐式恢复**：切换后目标 Case 的 `status` / `phase` 与切换前相同；任何"切换即恢复"的假设都是错的。
4. **历史可重建**：通过两侧领域事件与业务审计可以重建"某 Case 何时成为/失去主线、由谁、为何"；拒绝提供第二套历史。
5. **错误语义**：case-scoped 无权/不存在 = `404`；终态/冲突 = `409`；校验 = `422`；这些类别不得被后续 Slice 改写。
6. **授权不扩张**：切换成功不产生任何 Case 内容访问权、Participant 能力、Consent 或 guardian 关系。
7. **前向义务（Phase 4）**：Follow-up Schedule / Task / Notification 落地时，`SwitchPrimaryCase` MUST 扩展为——在同一事务内取消或迁移被降级 Case 的普通未来 schedule / job，并保证不补发过期提醒。本 Slice 不实现该逻辑，但该义务已被 FR-019 冻结，后续 Slice MUST NOT 以"切换与提醒无关"为由跳过。
8. **前向义务（Safety Slice）**：Safety Slice 落地时，FR-005 的状态谓词必须自动变为真实生效；Safety Slice MUST NOT 重新实现第二套"主线切换守卫"，也不得让 `ResolveRisk` 之外的普通命令清除 SAFETY_HOLD。
9. **不得依赖的内部实现**：锁的具体形态、索引名、事务隔离级别、事件枚举字面量、哈希算法、响应包装结构均不构成下游合同。

---

## 14. Dependencies

### 14.1 Hard dependency（Implement 前必须真实满足）

| 依赖 | 现状（2026-11-07 核对） | 影响 |
|---|---|---|
| Slice 1 — Family / Person / 成员 / Compliance / `authorize()` / RLS / 幂等 / 审计 / current-family 解析 | **已合并 main**（PR #9、#10、#13） | 可依赖 |
| Slice 2 — `cases` / `case_events` / `is_primary` 唯一约束 / `version` / `CASE_CREATE` 幂等类型 / Case 管理主体 / Family 行锁原语 | **实现分支存在，tasks 87/87 已勾选；未合并 main**（分支 `feat/002-case-core`，领先 main 38 个提交；其审计二结论与最终合并状态需在 Plan 前重新核对） | **Implement 硬阻断**：必须先完成 Slice 2 的独立审计与合并 |

### 14.2 Contract-only dependency（只需冻结语义，不需其运行时代码）

| 依赖 | 用途 |
|---|---|
| Slice 2 的 `spec.md` / `contracts/case-events-and-business-audit.md` / `authorization-rls-and-idempotency.md` | 事件与审计词汇、幂等快照、锁与串行化口径、错误语义 |
| Slice 1 的 `authorization-and-rls.md` / `consent-onboarding.md` 中的 Family 解析与错误映射 | `CURRENT_FAMILY_*` 语义、`authorize()` 形状 |
| Slice 3 / 4 / 005 / 006 的冻结合同 | 仅用于确认「不重叠」；本 Slice 不调用其任何能力 |

### 14.3 Late E2E dependency（不影响本 Slice 独立冻结与实现，但影响上线证据）

- V1-C29 的 U01—U20 完整旅程（切换只是其中一段）。
- V1-C18 的暂停/恢复验收（属后续状态 Slice + Phase 4）。
- Phase 4 的 Schedule / Notification（见 §13 第 7 条前向义务）。
- Phase 5 的数据权利与导出（切换历史是否进入导出由该 Slice 决定）。

### 14.4 Non-dependency（明确不依赖，不得按编号自动建立）

- Slice 3（Evidence）、Slice 4（Participant）、005 / 006（身份绑定）：本 Slice 不读、不写、不等待。
- Assessment / Scene / Node Manifest / Digital Use / 目标清单 / 手机合约 / 角色扮演。
- AI、RAG、Memory、Context Builder、pg-boss、Notification、Phoenix。
- Safety State 写入、Referral、CloseCase、Recurrence、Outcome / Closure。
- 微信小程序 / 运营后台 UI。
- `compliance_feature_policies` / PIPIA / 生成内容标识。

---

## 15. Implementation Gate（如实记录，不阻断本轮 Specify）

```text
IMPLEMENT BLOCKED BY: Slice 2 (specs/002-case-core) 尚未合并到 main
```

- Slice 2 的实现分支存在且 87/87 任务已勾选，但 `main` 尚未包含 `cases` / `case_events` / `is_primary` 唯一约束 / `CASE_CREATE` 幂等类型 / Case 管理主体授权扩展。
- 本轮只完成 Specify / Clarify，Spec 可以独立冻结。
- 进入 Plan 前必须重新核对 Slice 2 的审计二结论与合并状态；Plan 可以基于 Slice 2 的**冻结合同**设计，但 Implement Gate 必须等真实代码进入基线后才打开。
- 若 Slice 2 在合并过程中修改了 `is_primary` / `version` / 事件词汇 / 锁原语语义，本 Spec 必须显式复核并记录差异，不得静默适配。

---

## 16. Known Reconciliation With Existing Slices

以下是**已预期**的下游收窄，不是需求冲突，也不是允许"改测试让实现通过"：

1. `specs/002-case-core` FR-018 与越界守卫断言（至少 `tests/integration/cases-scope.test.ts` 的 forbidden 片段含 `/switch-primary`；`tests/integration/openapi-cases.test.ts` 亦有同类禁止列表）声明 `/switch-primary` 不存在。本 Slice 实现时必须把该断言**精确收窄**为"除 `POST /cases/:id/switch-primary` 外仍无其他越界路由"，并保留 `/cases/current`、`pause`、`resume`、`close`、`recurrences`、`messages`、`assessments`、`participants`、`scene`、`problem-formulations`、`evidence` 等全部禁止项。
2. `specs/002-case-core` 的 "Out of Scope" 与本 Spec 的 §3 必须同时成立：候选晋升在 002 中不实现、在 007 中实现；两者不矛盾。
3. 若 Slice 2 的 Case 事件/审计词汇白名单是封闭 CHECK，本 Slice 必须**经 reviewed migration 扩展白名单**，不得重建表或放宽为任意值。
4. 本 Slice 不修改 `Docs/**`、不修改 001—006 的 spec / plan / tasks 正文；只新增 `specs/007-case-primary-switch/spec.md`。

---

## 17. Key Entities（逻辑约束，不是 DDL）

> 具体列、索引、枚举字面量、迁移编号属 Plan。下表只冻结业务含义。

### 17.1 `cases`（已存在，本 Slice 只增量写两个字段）

1. `is_primary`：布尔主线标记；切换是除创建外唯一可写路径。
2. `version`：成功切换必须前进一版；重放不前进。
3. `status` / `phase`：本 Slice 只读，MUST NOT 写。
4. `family_id` / `created_by_person_id`：只读，不因切换改变。
5. 禁止新增：`switch_reason`、`previous_primary_id`、`primary_since` 等把历史压到当前行的字段（理由与历史属事件/审计，不得覆盖）。

### 17.2 切换历史（语义实体）

- 一次切换 = 一个不可变事实：Family、目标、原 primary（可空）、actor、reason、发生时间、结果版本。
- 必须能按 Case 与按 Family 重建；不得只保留"最后一次"。
- 具体承载（`case_events` 两侧 + `business_audit_events`）由 Plan 在既有基础设施内决定，不得新建第二套审计表。

### 17.3 幂等记录（已存在基础设施）

- 新增 `CASE_SWITCH_PRIMARY` 命令类型；沿用 Slice 1 的 scope + payload hash + 结果快照语义。
- 必须能区分"重放"与"同 key 不同 payload"。

### 17.4 明确不存在于本 Slice 的对象

`problem_formulations`、`dialogue_messages`、`assertions`、`observations`、`case_participants`、`participation_invites`、`scene_node_states`、`scene_artifacts`、`risk_events`、`referrals`、`support_resources`、`compliance_feature_policies`、`generated_content_labels`、Plan / Task / Review / Schedule / Notification / AI / Memory 相关表。

---

## 18. Acceptance Scenarios

### 18.1 Happy path

1. **首次切换** — **Given** Family F 有 primary Case A 与候选 Case B，actor 为 F 的管理主体，**When** 调用 `POST /api/v1/cases/B/switch-primary` 并给出理由，**Then** B 成为 primary、A 变为非 primary，二者 `status` / `phase` 不变，`version` 各前进一版，返回结果真实反映 B 为当前主线；`GET /api/v1/cases` 立即显示 B 为唯一 primary。**Upstream**: V1-C01、§2.1、§8.1、§29.4
2. **往返切换** — **Given** B 已成为 primary，**When** 再次切换回 A，**Then** 恢复为「A primary / B 候选」，两次切换的历史都保留，理由不被覆盖。**Upstream**: §2.1 第 2 条、§7.8
3. **晋升（无 primary 边界）** — **Given** F 当前没有未结 primary（当前不可达，仅作为冻结语义），**When** 切换到候选 C，**Then** C 成为唯一 primary，`previousPrimary` 为空，不产生第二 primary，不返回 500。**Upstream**: V1-C01、§8.1、Clarifications Q2
4. **读取一致** — **Given** 一次成功切换，**When** 管理主体读取列表与详情，**Then** primary 标识唯一且与切换结果一致；不存在 `/cases/current` 或第二真相源。**Upstream**: U04、§28.3

### 18.2 Negative / unauthorized

5. **非管理主体** — **Given** actor 是 F 的普通成员（或 guardian，但非管理主体），**When** 调用切换，**Then** `404 CASE_NOT_FOUND`，零写入，响应不含 primary / status / phase / 是否存在。**Upstream**: §9、Slice 2 FR-023、V1-C21
6. **跨家庭** — **Given** Family A 的管理主体与 Family B 的 Case，**When** A 尝试把 B 的 Case 设为 A 的 primary，**Then** `404 CASE_NOT_FOUND`，零写入；以运行角色在 A 的 RLS 上下文直连查询，B 的 Case 为 0 行。**Upstream**: §9.1、§37.2
7. **guardian 非成员** — **Given** actor 有 guardian 关系但不是目标 Family 成员，**When** 调用切换，**Then** 沿用 Slice 1 的 Family 解析失败语义，不得被转换为 `CASE_NOT_FOUND` / `CASE_ACCESS_DENIED`，不得返回 Case 数据。**Upstream**: §9、Slice 2 FR-024
8. **目标不存在 / 非法 ID** — **Given** 路径参数不是真实 Case，**When** 调用切换，**Then** 统一 `404 CASE_NOT_FOUND`，不得返回 422（与 Slice 2 的 case-id 口径一致）。**Upstream**: Slice 2 FR-023
9. **已是 primary** — **Given** 目标就是当前 primary，**When** 调用切换，**Then** `409` 冲突、零写入、`version` 不前进、不追加事件；不得返回成功。**Upstream**: V1-C27、Clarifications Q1
10. **目标已关闭** — **Given** 目标 `status = CLOSED`，**When** 调用切换，**Then** `409` 冲突、零写入；不得隐式重开。**Upstream**: §29.4 第 4 步
11. **安全状态阻断（当前主线上）** — **Given** 当前 primary 处于 `SAFETY_HOLD`，**When** 调用切换，**Then** `409` 冲突、零写入；安全状态不可通过切走 Case 规避。**Upstream**: §29.4 第 3 步、§2.1 第 6 条、§5 不变量 20、V1-C25
12. **安全状态阻断（目标上）** — **Given** 目标处于 `SAFETY_HOLD`，**When** 调用切换，**Then** `409` 冲突、零写入；不得让安全中断的 Case 成为普通主线。**Upstream**: §5 不变量 12、V1-C25、Clarifications Q3

### 18.3 Boundary / validation

13. **空理由 / 缺理由 / 超长** — **Given** 请求缺少 reason、reason 为空白或超出上限，**When** 调用切换，**Then** `422`，零业务写入（无 Case 更新、无事件、无审计、无幂等快照）。**Upstream**: §2.1 第 1 条、V1-C27
14. **未声明字段 / 缺主线视图** — **Given** 请求体携带 `isPrimary`、`primary`、`version`、`status`、`phase`、`familyId` 等未声明字段，或未携带所依据的主线视图，**When** 调用切换，**Then** `422`，零业务写入；系统不得忽略非法字段后继续执行，也不得在缺少视图时退化为"无条件覆盖"。**Upstream**: §28.3、§8.6、Slice 2 FR-015 口径
15. **无副作用** — **Given** 一次成功切换，**When** 检查系统其它部分，**Then** 不存在新增/删除的 Plan、Task、Schedule、Notification、job、Evidence、Formulation、Participant、Safety 记录；两个 Case 的证据与历史未被改写。**Upstream**: §29.4 第 6 步、§5 不变量 19、FR-006 / FR-007

### 18.4 Concurrency / replay

16. **同 key 重放** — **Given** 一次成功切换，**When** 用同 key 同 payload 重试（含并发重试），**Then** 返回原结果；不再次降级、不再次升级、不追加事件/审计、版本不再前进。**Upstream**: §8.5、V1-C28
17. **同 key 不同目标** — **Given** 同一 key 已用于把 B 设为 primary，**When** 用同 key 指向 C，**Then** `409` 幂等 mismatch、原结果不变、零写入。**Upstream**: §8.5、FR-010
18. **并发双切换** — **Given** 两个不同 key 的切换并发指向不同目标，**When** 两者同时执行，**Then** 恰好一个成功，另一个冲突失败；最终恰好一个未结 primary，且不存在两次降级或两个事件组。**Upstream**: §8.1、§5 不变量 17、§39 V1-C01
19. **并发切换与创建** — **Given** 一个创建请求与一个切换请求并发，**When** 两者完成，**Then** 该 Family 仍至多一个未结 primary；创建命令的既有 primary 判定语义未被改变。**Upstream**: V1-C01、§8.1
20. **陈旧视图** — **Given** 客户端 A 读取时 primary 为 Case1，期间客户端 B 已切换到 Case2，**When** A 基于旧视图发起切换，**Then** `409` 冲突、零写入；不得用旧视图覆盖新状态。**Upstream**: §8.6、V1-C28、FR-011

### 18.5 Cross-context / data layer

21. **RLS 无上下文** — **Given** 数据库连接没有 `app.family_id` / 身份上下文，**When** 读取 `cases` / `case_events` 或尝试写入，**Then** 返回零行 / 写入被拒绝，而不是默认放行。**Upstream**: §9.1、FR-016
22. **审计原子性** — **Given** 一次成功切换，**When** 让审计/事件写入失败，**Then** 整个事务回滚：主线未改变、无半条历史、无幂等成功快照；接口返回真实失败。**Upstream**: §29.4、§7.8、FR-012
23. **结构越界** — **Given** 本 Slice 的数据库结构与路由清单，**When** 做结构 / 路由断言，**Then** 除新增的 `switch-primary` 端点与既有 Case 结构外，不存在 `problem_formulations`、`assertions`、`observations`、`case_participants`、`risk_events`、`referrals`、Plan / Task / Schedule / Notification 等越界表或路由，也不存在 `/cases/current`。**Upstream**: §7.2、§28.3、FR-014

---

## 19. Success Criteria

1. V1-C01 的「切换」半句有可执行、可验证的真实路径：任何 Family 都能在多个已记录 Case 之间改变主线，且任何时刻至多一个未结 primary。
2. 切换是**纯控制面动作**：不改变 `status` / `phase`，不产生执行、提醒、AI 或证据副作用。
3. 无权、跨家庭、终态、安全阻断、陈旧视图、重复请求均返回真实且互不混淆的结果。
4. 历史可重建：任一 Case 何时成为/失去主线、由谁、为何，均可从领域事件与审计追溯，且不可覆盖。
5. 并发与重试下不产生第二个 primary、第二个业务结果或半个结果。
6. 下游 Slice 可以在不知道本 Slice 内部实现（锁、索引、枚举名、响应包装）的前提下，依赖 §13 的合同。

---

## 20. Acceptance Evidence

未来 Implement 必须提供（本 Slice 不产出）：

1. 数据库级：唯一 primary 约束在并发切换下不产生两个未结 primary；RLS 无上下文/错误 Family 的零行与拒绝写入证据。
2. 应用级：有权/无权/跨家庭/guardian 非成员四类调用的真实响应与零写入证据。
3. 幂等：同 key 重放与同 key 不同目标的真实 HTTP 证据（mismatch 分支必须可达）。
4. 审计：成功切换的两侧事件 + 一条审计；重放与失败零追加；审计失败时整体回滚证据。
5. 无副作用：切换前后 Plan/Task/Schedule/Notification/Evidence 等对象计数不变（当前应为"不存在"）。
6. OpenAPI：新增端点与冻结契约零语义漂移，且越界路由断言已精确收窄。
7. 结构：越界表/路由不存在证据（含 `/cases/current`）。

---

## 21. Clarifications

> 消歧优先级：Docs > 已冻结 Slice > 已有 contract/schema/runtime > 本文推导。下列问题均已从上游自行消歧，不是 Open Question。

**Q1 — 目标已经是当前 primary 时，返回成功还是冲突？**
**RESOLVED — 冲突（409），不得伪造成成功。** 依据：V1-C27 要求失败与真实状态不得伪装；§8.5 的幂等只覆盖"同一请求重放"，不覆盖"一个不产生变更的新请求"；若返回 200，会让 `version` / 历史 / 审计出现虚假变更或虚假无变更，二者都不可追溯。故「切到当前 primary」是终态无操作冲突，零写入。区别：同 key 同 payload 的重放仍返回原成功结果。

**Q2 — 当前没有 primary 时能否切换？**
**RESOLVED — 可以，语义为晋升。** 依据：V1-C01 与 §8.1 只约束"最多一个"上界，不要求"永远恰好一个"；§29.4 的"当前 primary 不得 SAFETY_HOLD"在无 primary 时无适用对象（空域真），该前置不构成"必须先有 primary"的要求。若禁止，则一个 primary 已关闭、只剩候选 Case 的 Family 将无法把已记录的真实问题重新立为主线，只能新建一个语义重复的 Case；而 `CreateRecurrence` 表达的是"复发/新一轮"，不能替代"已记录候选的晋升"。该分支当前不可达（关闭未实现），但必须冻结为合法而非 500/409。

**Q3 — 目标处于 SAFETY_HOLD 时是否允许切换过去？**
**RESOLVED — 禁止。** 依据：§29.4 只写明"当前 primary 不得 SAFETY_HOLD"，但其目的是禁止通过切换规避安全状态（§2.1 第 6 条）；§5 不变量 12 要求 Safety Hold 优先于普通流程，不变量 20 要求 SAFETY_HOLD 不能被主线切换覆盖。若允许把 SAFETY_HOLD 的 Case 设为主线，等价于让普通推进落到一个被安全中断的 Case 上，与该两条不变量冲突。故双向阻断。该项为上游不变量在对称方向上的直接推论，不新增产品语义。

**Q3a — SAFETY_HOLD / CLOSED 当前不可达，谓词如何验证？**
**RESOLVED — 以纯领域判定验证，不伪造数据库状态。** 要求 Plan 把守卫写成对 `status` 的确定性谓词（可用单元测试覆盖全部状态值），MUST NOT 通过直接 UPDATE `status` 制造测试前置，也 MUST NOT 写成恒真占位。运行时该分支在 Safety / Closure Slice 落地后自动生效。

**Q4 — 理由是否必填？由谁写？**
**RESOLVED — 必填，由发起的管理主体提供。** 依据：产品 §2.1 第 1 条"说明为什么建议切换"。AI 不得代写（V1-C24、§23）。理由属该次切换的不可变历史，不覆盖前次。

**Q5 — 切换是否改变 `status` / `phase`，或自动恢复执行？**
**RESOLVED — 不改变、不恢复。** 依据：§29.4 第 6 步"目标 Case 原 status/phase 不在切换事务中自动恢复"；§5 不变量 19 把"进入/恢复普通执行"绑定在 primary + 其他门禁上，而不是绑定在"被设为主线"这一动作上；§6.6 / §6.7 的转换必须经各自 Domain Command。

**Q6 — 现在是否必须处理"旧任务和提醒"？**
**RESOLVED — 现在不实现，但冻结后置不变量与前向义务。** 依据：Schedule / Task / Notification 属 §24—§26（Phase 4），当前不存在这些对象；伪实现会产生假能力。产品 §2.1 第 3 条的语义被冻结为：降级 Case 不得保留"仍会继续普通推进"的语义；Phase 4 必须在本命令内完成取消/迁移（§13 第 7 条）。

**Q7 — 非管理主体的错误码是 403 还是 404？**
**RESOLVED — 404。** 依据：本端点是 case-scoped（路径含 `:id`），Slice 2 FR-023 已冻结"Case 不存在 / 属于其他 Family / actor 无访问资格"统一 `404 CASE_NOT_FOUND`。Slice 2 的 403 仅用于"Family 已合法解析但非管理主体"的 Family 级列表/创建端点；本 Slice 不新增第二套口径。

**Q8 — 谁能执行切换；Participant 或孩子能否？**
**RESOLVED — 只有 Family 的 V1 管理主体（创建者的 ADULT Person）。** 依据：§9"V1 当前的管理主体是创建该 Family 的 adult"；§10 的 Participant 只获得"当前 Case 的有限权限"，不包含主线控制；V1 不建设多管理员或角色矩阵。

**Q9 — 是否需要"切换建议"能力（AI 提议切哪个 Case）？**
**RESOLVED — 不需要，本 Slice 明确排除。** 依据：V1-C24 允许 AI propose，但 propose 通道属 AI/Decision（Phase 3）；本 Slice 只实现用户显式命令，不建建议接口、不建候选评分。

**Q10 — 是否需要新的 Family 级锁或第二套 primary 真相源？**
**RESOLVED — 不需要。** 依据：Slice 2 已冻结"应用层串行化 + 数据库唯一索引兜底"，并已提供 Family 行锁原语；`is_primary` 就是唯一真相。具体锁与顺序属 Plan，但不得引入新表或缓存真相源。

**Q11 — 切换历史是否进入数据权利 / 导出？**
**RESOLVED — 本 Slice 不决定，交 Phase 5。** 依据：U18 / §28.9 / §34—35 属数据权利 Slice；本 Slice 只保证历史真实存在且不可覆盖，具体导出形态由该 Slice 决定。

**No blocking product ambiguity remains.**

---

## 22. Assumptions

**已由文档推导（非新增语义）**

- 「当前主要 Case」= `cases.is_primary = true` 且 `status != CLOSED`；与 `status` / `phase` 正交（Slice 2 已冻结）。
- 切换是 Domain Command，不是状态转换；§6.6 的状态表不含它。
- 管理主体身份由 Slice 1 冻结（Family 创建者的 ADULT Person），本 Slice 不重新定义。
- 事件/审计必须在同一事务内；§29.4 明写"写切换原因、旧/新 primary、business_audit_event"。

**无上游明文，本轮显式标注（不得当成已批准需求）**

- **A-1 请求/响应字段命名与包装**：`idempotencyKey`、`reason` 的传输位置、响应 envelope、错误码字符串（除已冻结的 `CASE_NOT_FOUND` / `CURRENT_FAMILY_*`）由 Plan 决定；但语义类别、HTTP 状态与零写入要求不得改变。
- **A-2 理由长度上限**：上游未给数值；Plan 必须给出有限上限并写入契约，不得无限长、不得为空。
- **A-3 陈旧视图的表达方式**：以版本号、期望当前 primary，还是两者兼有，由 Plan 决定；语义要求是"必须携带该视图，且陈旧必须冲突失败"。
- **A-4 事件/审计枚举字面量**：由 Plan 在 Slice 2 已冻结词汇表内扩展，不得新建第二套审计框架。

---

## 23. Open Questions

**NONE**

**Residual blockers**: 无**语义**阻断。唯一阻断是程序性的：Slice 2 未合并（见 §15）。Spec 可冻结，Implement Gate 未打开。

---

## 24. Change Log

| 日期 | 变更 | 说明 |
|---|---|---|
| 2026-11-07 | 初版 Specify / Clarify | 基于 `Docs/V1产品需求.md` v3.7、`Docs/V1技术设计.md` v3.12；核对 001—006 归属后选定本 Slice |
