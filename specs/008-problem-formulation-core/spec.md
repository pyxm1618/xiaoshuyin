# Feature Specification: Problem Formulation Core（`problem_formulations` / Present / Confirm / Dispute / Correct / Reassess）

**Feature Directory**: `specs/008-problem-formulation-core`  
**Created**: 2026-11-11  
**Status**: Specify / Clarify CLOSEOUT COMPLETE — READY FOR PLAN AI 2（Selection Gate PASS / Open Product Decisions 0 / Owner Clarifications CLOSED / Docs Modified NO / Scope Expansion NO）  
**V1 Phase**: Phase 1 — Common Core 地基（`Docs/V1技术设计.md` §38；Problem Formulation 属 Phase 1 明确列项）  
**Stage**: 本轮只做 Selection Gate / Specify / Clarify。**禁止进入 Plan / Checklist / Tasks / 审计一 / Implement。**  
**Docs baseline**: `Docs/总产品需求.md`、`Docs/V1产品需求.md`、`Docs/总体技术架构.md`、`Docs/V1技术设计.md`（本分支 checkout 内容，2026-11-11 读取）  
**Repo baseline（2026-11-11 现场核对）**: `origin/main` = `e8add9013bd1a71fd6496fa2dc22243ed061cba5`；本文件所在 worktree HEAD 与 `origin/main` 相同，working tree clean

> 本 Spec 是已批准 Xiaoshuyin 文档的下游实现投影，不得引入未获批准的产品语义。Docs 与本文冲突时，以 Docs 为准；本文只做投影与消歧。
>
> **Slice 边界**：本 Slice 只建立**一个 Case 内、版本化、可纠正、可争议、可确认、且不能由 AI 越权确认的 Problem Formulation 业务对象及其必要 Domain / API contract**，以及为使其成立所必需的**最小 Phase 入口**与**最小证据守门**。它不是 Digital Use Assessment、不是 Scene、不是 AI runtime、不是 Goal / Plan、不是 Safety State Core。

---

## 0. Slice Selection Record（按能力与依赖推导，不按候选名称直接接受）

### 0.1 仓库真实状态核对（2026-11-11，只读核验）

核对方式：`git rev-parse origin/main`、`git ls-tree -r origin/main`、`grep` 迁移与路由文件、逐文件读取。**未按历史摘要或 Owner 描述直接采信。**

| 证据项 | 核验结果 |
---|---|---|
| `origin/main` | `e8add9013bd1a71fd6496fa2dc22243ed061cba5` |
| 本 worktree | 同一 commit；`git status --short` 为空 |
| `db/migrations` | `001`—`007`；末位为 `007_case_primary_switch.sql` |
| 已真实存在的表 | `accounts`、`persons`、`families`、`family_members`、`guardian_consent_requests`、`consent_records`、`person_compliance_profiles`、`person_profile_values`、`business_audit_events`、`idempotency_keys`、`cases`、`case_events`、`dialogue_messages`、`assertions`、`observations`、`case_participants`、`binding_*`（5 张） |
| **不存在**的表 | `problem_formulations`、`assessments`、`scene_node_states`、`scene_artifacts`、`goals`、`intervention_instances`、`plan_versions`、`tasks`、`reviews`、`risk_events`、`referrals`、`support_resources`、`artifact_dependencies` |
| `case_phase` 枚举 | 已含 `INTAKE / ASSESSMENT / PROBLEM_FORMULATION / GOALS / PLANNING / EXECUTION / REVIEW / MAINTENANCE / CLOSED` |
| `case_status` 枚举 | `006_case_status_paused_removal.sql` 已收窄为 `OPEN / WAITING / LOST_CONTACT / SAFETY_HOLD / CLOSED`；**无 `PAUSED`** |
| Phase 转换命令 | **不存在** `StartAssessment`、`PresentProblemFormulation`、`ConfirmProblemFormulation`、`ReassessFromFormulation` 或任何 phase 写路径；`cases.phase` 只能在创建时写 `INTAKE` |
| Case 写路径 | `POST /api/v1/cases`、`GET /api/v1/cases`、`GET /api/v1/cases/:id`、`POST /api/v1/cases/:id/switch-primary`；无 assessments / problem-formulations 路由 |
| 已有 runtime | `packages/domain/src/cases.ts`、`evidence.ts`、`participants.ts`、`case-primary-switch.ts`；`routes/cases.ts`、`messages.ts`、`participations.ts`、`identity-bindings.ts` |
| `authorize()` 已注册 Case 动作 | `CASE_CREATE`、`CASE_LIST`、`CASE_READ`、`CASE_SWITCH_PRIMARY`（均为 Family 管理主体语义） |
| 错误码基线 | `CASE_NOT_FOUND`(404)、`CASE_ACCESS_DENIED`(403)、`CASE_CLOSED`(409)、`SAFETY_HOLD_BLOCKED`(409)、`STALE_PRIMARY_VIEW`(409)、`IDEMPOTENCY_PAYLOAD_MISMATCH`(409) 已存在 |
| `cases` 列级写授权 | 仅 `is_primary, version, updated_at`（007 migration）；**尚无 `phase` 的 UPDATE 授权** |
| `case_events` 事件词汇 | `CASE_CREATED`、`CASE_PRIMARY_ASSIGNED`、`CASE_PRIMARY_REVOKED` |
| `idempotency_keys.command_type` | 13 个既有命令类型，含 `CASE_CREATE`、`CASE_MESSAGE_CREATE`、`CASE_SWITCH_PRIMARY` |

结论：Slice 1 / 2 / 3 / 4 / 5 / 7 的 runtime 已在 `main` 上真实存在；Case、Evidence、Participant、主问题切换、Authorization、RLS、幂等、审计均为可依赖基线。**Problem Formulation 及其任何 phase 转换命令确实尚不存在。**

### 0.2 候选对比（只看依赖成熟度与 V1 顺序，不看编号或“以后反正需要”）

| 候选 | 解决什么 | 当前 main 是否具备必要依赖 | 能否独立成最小可测 Slice | 是否被未实现能力卡住 | 结论 |
|---|---|---|---|---|---|
| **Problem Formulation Core** | Assessment 之后形成可纠正、可确认、可争议、版本化的问题理解，并作为进入 GOALS 的强制前置 | 具备：Case / Evidence / primary / Authorization / RLS / 幂等 / 审计已合入 | 能：对象 + 状态机 + 4 个已批准 public 端点 + phase 守门 | 部分：`ASSESSMENT` 入口与 candidate 生产者尚不存在 → 可用**最小区间命令**收口（见 §0.3） | **推荐** |
| Safety State Core | 任意阶段抢占普通流程、`ResolveRisk`、风险事件、支持资源 | 数据与状态词汇有基础，但**审核过的支持内容、复核角色、运营承接**属 Phase 5 | 形态上能 | 会卡住：产品 §22.3 明确禁止“空专家审核/空人工承接”；现在只能冻结空壳 | 不适合 |
| WAITING / Resume lifecycle | 等待信息与恢复推进 | 缺 `blocker` 对象与 Follow-up Schedule | 不能 | §6.6 要求 Resume 重新计算有效 schedule → Phase 4 | 不适合 |
| LOST_CONTACT lifecycle | 失联判定与主动返回 | 缺约定反馈节点、联系尝试、通知 | 不能 | §6.6 要求“两个约定反馈节点 + 至少一次真实授权联系尝试” → Phase 4 | 不适合 |
| Goal Core | 目标合同与进入 PLANNING | 缺 current confirmed formulation（本 Slice 产出） | 不能独立成立 | §6.7 `ConfirmGoal` 依赖 formulation；且是下游 | 不适合 |
| Closure / Recurrence | 结案、复发、关联新 Case | 缺 Review / Outcome | 不能 | Phase 4—5 | 不适合 |
| Digital Use Scene | A1001—A5002 忠实流程 | 缺 Scene Package / Node Manifest / Assessment | 不能 | Phase 2 全量能力 | 不适合 |

### 0.3 结论与两个真实缺口的收口方式

```text
SLICE 8 SELECTION GATE = PASS
Recommended Slice: 008-problem-formulation-core
```

`Problem Formulation Core` 同时满足：上游已冻结、现有依赖已合入、可形成独立可测的最小 Slice、是 V1 主链真实前置（未满足合同不得进入 GOALS）、且不需要提前开发 AI / Scene / Goal / Plan / Safety Core。

但有两个**真实缺口**必须如实处理，不能假装不存在：

1. **`ASSESSMENT` 阶段不可达**：`PresentProblemFormulation` 的前置是 `phase = ASSESSMENT`，而当前 main 没有任何命令能从 `INTAKE` 推进到 `ASSESSMENT`。
2. **candidate 生产者不存在**：`Docs/V1技术设计.md` §12.4 规定候选由 Assessment 完成时汇总 Evidence 生成（Phase 2），AI 提出候选属 Phase 3；当前两者都没有。

本 Spec 的收口方式（均有明确上游合同，不是发明）：

- 纳入**唯一一个最小前置命令** `StartAssessment`（`Docs/V1技术设计.md` §6.7 第一行、§23 命令清单第一项）。它只做 `INTAKE → ASSESSMENT` 的 phase 推进与前置校验，**不实现任何 Assessment 内容、问卷、Scene、AI**。
- `PresentProblemFormulation` 按 §23 作为**内部 Domain Command** 实现，**不新增 public create/present 端点**（§28.3 未批准）。其生产 caller 在 Phase 2/3 接入；本 Spec 明确记录该 caller 为 DEFERRED，**不宣称 U06 端到端产品可用**。
- public 面严格等于 §28.3 已批准的四个 formulation 端点；不发明第五个。

### 0.3.1 Owner Clarification Closeout Record（OWNER-APPROVED CLARIFICATION，Docs 未改动）

本轮两项边界收口属于 **OWNER-APPROVED CLARIFICATION**：它们是基于现有权威 Docs（`Docs/V1产品需求.md` §2.5 / §24，`Docs/V1技术设计.md` §6.7 / §7.2 / §8.2 / §23 / §28.3 / §38）做出的**明确边界收口**，不是 Docs 原文的逐字表述；本 Spec 因此不声称 Docs 已逐字规定或唯一强制。四份核心 Docs 本轮 **NO CHANGE**。

**OC-1 — `StartAssessment` 的 Slice 8 边界（CLOSED）**

1. 批准纳入本 Slice。正式边界：`StartAssessment` 只承载 `INTAKE → ASSESSMENT` 的**最小 Phase Bridge**，它只是 Problem Formulation 合法可达所必需的最小 phase 入口。
2. 必须满足已有上游合同：Case 是 current primary；必要 Authorization / Consent 有效；至少存在一条可追溯的问题陈述；当前 Safety 不阻断；使用现有 Case version / concurrency contract；写必要 audit / case event。
3. 严格禁止借此扩展：Assessment questionnaire、Assessment table/model、Digital Use `A1001`—`A2010`、Scene runtime、AI、RAG、新的 public assessment flow。
4. `StartAssessment` 在本 Slice 是**内部 Domain Command**；不得新增任何超出当前权威 API 合同的 public endpoint。

**OC-2 — `Dispute` 与 `Reassess` 的分工（CLOSED）**

1. `DisputeProblemFormulation` 表示：用户对**当前 Presented Problem Formulation 明确不同意**。结果：`formulation.status → DISPUTED`；`Case.phase` **保持** `PROBLEM_FORMULATION`；**不得**自动进入 `ASSESSMENT`。用户被允许“不同意但暂不重新评估”，因此 **Dispute ≠ Reassess**。
2. `ReassessFromFormulation` 是独立 Domain Command。只有用户纠正、冲突、替代解释或其它已定义条件真正要求“重新判断当前问题”时才执行。结果：`Case.phase: PROBLEM_FORMULATION → ASSESSMENT`，并**保留既有 Problem Formulation 历史**；不得删除旧版本或静默覆盖。
3. 二者在本 Slice 均不新增 public endpoint（见 OC-3 / C1）。

**OC-3 — 当前权威 API Surface 确认（C1，CLOSED）**

当前权威 API Surface 对 Problem Formulation 只有以下四个端点；本 Slice 不新增第五个：

```text
GET  /api/v1/cases/:id/problem-formulations/current
POST /api/v1/cases/:id/problem-formulations/:version/confirm
POST /api/v1/cases/:id/problem-formulations/:version/dispute
POST /api/v1/cases/:id/problem-formulations/:version/corrections
```

`PresentProblemFormulation`、`ReassessFromFormulation`、`StartAssessment` 三者在 Slice 8 均为**内部 Domain Command / application service entry**，不得自行新增 public endpoint。`PresentProblemFormulation` 是正式内部 Domain Command，未来由 Phase 2 Scene/Assessment 或 Phase 3 AI candidate flow 调用；**它不是 test fixture，也不是 SQL shortcut**。

Slice 8 当前交付后，**U06 尚不要求完整用户端 E2E 可用**；这是合法的分阶段实现，不得为了“现在就能点通”提前开发 Phase 2/3。

### 0.4 编号说明

`001`—`007` 已占用。下一 implementation 编号为 `008`。编号只是目录约定；本 Slice 的依据是 §0.2 的能力与依赖，不是编号。

---

## 1. Problem / Purpose

V1 主链是：

```text
Case → Evidence → Assessment → Problem Formulation → Goal → Plan → Execution → Review
```

当前 main 已有 Case、Evidence、Participant、主问题切换，但**没有任何“当前问题理解”对象**。这造成三个真实问题：

1. **V1-C04 无法成立**：产品要求“Assessment 后必须形成可纠正的 Problem Formulation，不能直接从问答跳到方案”，但系统当前连这个对象都不存在。任何后续 Goal 实现都缺少强制前置。
2. **证据与判断之间没有可审计的中间层**：Evidence Core 保留了 Statement / Observation / Unknown / Conflict，但没有任何对象把这些证据汇总成“当前最可能的主要问题 + 仍不知道什么 + 来源冲突 + 替代解释 + 重新判断条件”。没有它，后续 Goal / Plan 只能直接消费原始证据或模型输出，无法证明“没有把 UNKNOWN 写成事实”。
3. **AI 越权确认没有结构约束**：V1-C24 要求 AI 只能提出候选，不能代替用户确认。如果没有 `PRESENTED ≠ CONFIRMED`、`confirmed_by` 必须是真实用户的结构化合同，未来只要接入 AI，就可能出现“模型生成即生效”。

因此本 Slice 的存在理由不是“补一张表”，而是：

> **把“当前问题理解”变成一个有版本、有来源、有未知、有冲突、必须由真实用户确认、且 AI 不能代为确认的正式业务对象，并用它守住 ASSESSMENT → GOALS 的唯一通道。**

---

## 2. Goal

**Objective（一句话）**：在 Phase 1 建立版本化 Problem Formulation 的业务对象、状态语义、证据保真规则、phase 守门与已批准的 public 操作面，使“未满足 formfulation 合同不得进入 GOALS”成为可执行、可审计、可测试的系统事实。

完成后系统新增以下真实能力：

1. 一个 Case 可以从 `INTAKE` 进入 `ASSESSMENT`（最小 phase 命令），并具备合法、可追溯的问题陈述前置。
2. 服务端可以为一个处于 `ASSESSMENT` 的 primary Case 形成**候选** Problem Formulation，使其进入 `PRESENTED`，并把 Case 推进到 `PROBLEM_FORMULATION`。
3. Family V1 管理主体可以读取当前 formulation、确认、表示不同意、提交更正。
4. 确认只对**当前版本、`PRESENTED` 状态、依赖未失效、primary、非 SAFETY_HOLD** 的 formulation 生效；确认后 Case 才进入 `GOALS`。
5. 更正不会覆盖历史：每次实质更正产生新版本，旧版本成为 `SUPERSEDED` 且内容不可变。
6. 用户“不同意但暂不重新评估”是合法状态：`DISPUTED` 只改变 formulation 状态，不改变 Case phase。
7. UNKNOWN / NOT_COLLECTED / DECLINED / CONFLICT 的证据状态必须被 formulation 显式保留，不能静默变成确定事实。
8. 重复提交、并发、重试不会产生重复版本、重复确认或重复 phase 推进；旧视图不能覆盖新状态。

---

## 3. Scope

### 3.1 In Scope

1. **`problem_formulations` 业务对象**：字段与逻辑约束遵循 `Docs/V1技术设计.md` §7.2；归属唯一 Case / Family；与 Evidence 分离。
2. **状态词汇**（严格取自 §7.2，不新增、不改名、不重排）：`DRAFT / PRESENTED / CONFIRMED / DISPUTED / NEEDS_REVIEW / SUPERSEDED`。
3. **版本语义**：Case 内 `version` 从 1 起单调递增、不可复用；任一时刻最多一个 current；旧版本 `SUPERSEDED` 且不可变。
4. **`StartAssessment`**：`INTAKE → ASSESSMENT` 的最小 Phase Bridge（内部 Domain Command，无新增 public 端点）。`[OWNER-APPROVED CLARIFICATION: OC-1]`
5. **`PresentProblemFormulation`**：`ASSESSMENT → PROBLEM_FORMULATION` 的内部 Domain Command，形成候选并使其 `PRESENTED`；**不新增 public 端点**，不是 test fixture 或 SQL shortcut。`[OWNER-APPROVED CLARIFICATION: OC-3]`
6. **`ConfirmProblemFormulation`**：`PROBLEM_FORMULATION → GOALS` 的 public 命令，必须由真实用户 actor 执行。
7. **`DisputeProblemFormulation`**：public 命令，形成用户“不同意”的响应事实；不改变 phase。
8. **`CorrectProblemFormulation`**：public 命令，追加新版本（旧版 `SUPERSEDED`），新版本 `PRESENTED`，需重新确认。
9. **`ReassessFromFormulation`**：`PROBLEM_FORMULATION → ASSESSMENT` 的内部 Domain Command（无新增 public 端点），独立于 `Dispute`，并保留既有 formulation 历史。`[OWNER-APPROVED CLARIFICATION: OC-2]`
10. **四个已批准 public 端点**（逐字取自 §28.3）：
    - `GET /api/v1/cases/:id/problem-formulations/current`
    - `POST /api/v1/cases/:id/problem-formulations/:version/confirm`
    - `POST /api/v1/cases/:id/problem-formulations/:version/dispute`
    - `POST /api/v1/cases/:id/problem-formulations/:version/corrections`
11. **授权边界**：复用既有 `authorize()` + `withRlsTransaction` + Family 管理主体语义；只增加本 Slice 需要的最小 Case 动作与资源维度。
12. **RLS**：`problem_formulations` 启用并强制 Family 隔离；无上下文默认拒绝。
13. **SI 保真守门**：`evidence_refs` 必须指向当前 Case 的真实 Evidence；`unknowns` / `conflicts` 必须覆盖被引用证据中的真实未知与冲突；`DECLINED` 不得被推断成答案。
14. **Phase 守门**：`ASSESSMENT` 不得跳过 `PROBLEM_FORMULATION` 直达 `GOALS`；`GOALS` 只能在 current formulation `CONFIRMED` 且依赖有效时进入。
15. **primary / Safety 守门**：所有 formulation 写命令要求 Case 为当前 primary；`SAFETY_HOLD` 与 `CLOSED` 阻断普通推进（复用既有状态谓词，不实现 Safety State Core）。
16. **幂等 / 并发 / 事务**：所有写命令幂等；同状态变更只有一个成功；phase 变更、formulation 写入、事件、审计、幂等快照同一业务事务。
17. **审计**：每次成功写命令产生 `case_event` 与 `business_audit_event`；不记录 formulation 正文。
18. **真实失败与真实空态**：不存在、跨 Family、无权统一 404 不泄露；无 formulation 不伪造默认对象。
19. **结构隔离**：不存在 `assessments` / `scene_*` / `goals` / `plans` / `tasks` / `reviews` / `risk_events` / `artifact_dependencies` 表或路由。
20. **长期保留**：`SUPERSEDED` 版本永久保留，不删除、不原地覆盖。

### 3.2 Out of Scope（本 Slice 明确不做）

- **Digital Use Assessment runtime**：`POST /api/v1/cases/:id/assessments` 的 questionnaire、A1001—A2010、任何 `scene_node_states` / `scene_artifacts` / Node Manifest / routing。
- **AI / RAG / 模型 / Prompt / Embedding / Memory / Decision Shadow**：本 Slice 不接任何模型，也不提供 AI 调用入口。
- **Scene Engine / Scene Package / `scene_fit` 专业规则**：只承载 `scene_fit` 字段与结构校验，不实现 Digital Use 场景判断。
- **Goal / Intervention / Plan / Task / Checkin / Review / Outcome / Closure / Maintenance / Recurrence / Referral**。
- **完整 Safety State Core**：`EnterSafetyHold`、`ResolveRisk`、`risk_events`、风险模型、支持资源、Safety Operations、Alibaba Guardrails。
- **Case Status 生命周期**：`WaitForInformation`、`ResumeAfterInformation`、`MarkLostContact`、`UserReturned`、`CloseCase`、`CreateRecurrence`；本 Slice 不改变 `case_status`。
- **Consent 撤回全链路 / Evidence 更正传播链 / 通用 `artifact_dependencies` 图 / Memory 失效重建**。
- **Participant 对 formulation 的可见性 / 孩子端读取 / Visibility Matrix / 第二套 RBAC / Case role**。
- **数据权利**：查看历史版本、导出、删除、更正传播 UI。
- **UI**：微信小程序、运营后台。
- **通知 / Follow-up Schedule / pg-boss / 后台任务**。
- **V2—V5 能力**。

### 3.3 Non-Goals

- 不把 Problem Formulation 做成“AI 摘要”或“自由文本分析报告”。
- 不为了“完整”提前实现 Assessment 问卷、Scene 路由或 Goal 草案。
- 不新增 public `POST /problem-formulations` 或 `present` 端点来“方便测试”。
- 不设计第二套版本模型、第二套状态词汇或第二套幂等机制。
- 不用测试 fixture、直接 SQL 写入或手工 UPDATE 冒充正式业务入口。
- 不因为“未来 AI 需要”就在本 Slice 里让模型获得任何写权限。
- 不优化 p95 / 并发上限 / 成本；这些在首次压测后由上游冻结（§37.2）。

---

## 4. Upstream Requirements & Traceability

### 4.1 需求映射（区分实现深度）

| Upstream ID | Source | 本 Slice 的关系 | 说明 |
|---|---|---|---|
| **V1-C02** | `Docs/V1产品需求.md` §24 | **DIRECTLY IMPLEMENTED（formulation 层）** | formulation 必须保留 `evidence_refs`、`unknowns`、`conflicts` 与来源，不得把 Statement / Hypothesis 当事实 |
| **V1-C03** | §24 | **DIRECTLY IMPLEMENTED（formulation 层）** | UNKNOWN / NOT_COLLECTED / DECLINED / CONFLICT 必须被显式保留；禁止默认补值 |
| **V1-C04** | §24 / §2.5 | **DIRECTLY IMPLEMENTED** | Assessment 后必须形成可纠正 formulation；未满足合同不得进入 GOALS |
| **V1-C22** | §24 / §17.1 | **DIRECTLY IMPLEMENTED（formulation 自身更正）/ DEFERRED（上游证据更正传播）** | 用户对 formulation 的更正形成新版本；Evidence 更正触发 formulation `NEEDS_REVIEW` 属后续 Slice |
| **V1-C24** | §24 / §19 | **DIRECTLY IMPLEMENTED（禁止面）** | AI 无 formulation 确认权；`confirmed_by` 必须是真实用户 actor |
| **V1-C25** | §24 / §20 | **DEPENDENCY / GUARD ONLY** | 只复用 `SAFETY_HOLD` 状态谓词阻断推进；不实现 Safety State Core |
| **V1-C28** | §24 | **DIRECTLY IMPLEMENTED** | 重复提交 / 并发 / 重试不得产生重复版本、重复确认或重复 phase 推进 |
| **V1-C30** | §24 | **DIRECTLY IMPLEMENTED（结构约束）** | formulation 是 Scene-agnostic Common Core；不得硬编码 Digital Use 业务规则 |
| **V1-C32** | §24 | **PARTIAL DIRECT / DEFERRED** | formulation 自身更正不继续使用已知错误；跨对象（Memory / Plan）传播属后续 Slice |
| **U06** | §23 | **DIRECTLY IMPLEMENTED（服务端 4 端点）** | 查看、纠正、确认、不同意；页面与端到端接入 deferred |
| **U04（相邻）** | §23 | **DEPENDENCY** | Case phase 读取由 Slice 2 提供；本 Slice 只写 phase |
| **§2.5** | `Docs/V1产品需求.md` | **DIRECTLY IMPLEMENTED** | formulation 必须说明的信息项与用户四种响应 |
| **§6.7** | `Docs/V1技术设计.md` | **DIRECTLY IMPLEMENTED** | `StartAssessment` / `Present` / `Confirm` / `Reassess` 的 phase 合同 |
| **§7.2** | 同上 | **DIRECTLY IMPLEMENTED** | 字段清单与状态词汇 |
| **§7.10** | 同上 | **DEPENDENCY / GUARD ONLY** | `dependency_refs` 保存与 Confirm 前有效性校验；通用传播图 deferred |
| **§8.2** | 同上 | **DIRECTLY IMPLEMENTED** | 追加版本 + supersedes；不得原地覆盖 |
| **§8.5 / §8.6** | 同上 | **DIRECTLY IMPLEMENTED** | 幂等、版本与旧视图保护 |
| **§9 / §9.1** | 同上 | **DEPENDENCY / GUARD ONLY** | 复用 `authorize()` + RLS；不新建 RBAC |
| **§12.4** | 同上 | **DEPENDENCY / GUARD ONLY** | 候选生成流程的合同；本 Slice 不实现 Assessment / Scene 生成器 |
| **§23** | 同上 | **DIRECTLY IMPLEMENTED** | `StartAssessment` / `Present` / `Confirm` / `Dispute` 为 Domain Command；模型只能 request / propose |
| **§28.3** | 同上 | **DIRECTLY IMPLEMENTED（4 个 public 端点）** | 不新增第五个端点 |
| **§29.1** | 同上 | **DIRECTLY IMPLEMENTED** | Confirm 事务的前置与顺序语义 |
| **§29.5 / §29.6** | 同上 | **DEFERRED** | Consent 撤回 / 事实更正的全链路传播 |
| **§38 Phase 1** | 同上 | **DIRECTLY IMPLEMENTED** | Problem Formulation 与 Domain Commands 属 Phase 1 |
| **§39 V1-C04 行** | 同上 | **DIRECTLY IMPLEMENTED** | “ASSESSMENT 必须进入 PROBLEM_FORMULATION，不能直达 GOALS” |

### 4.2 本 Slice 不实现、但必须承认的依赖

| 能力 | 拥有者 | 本 Slice 的态度 |
|---|---|---|
| Assessment 内容、A1001—A2010、Scene Package | Phase 2 | **DEFERRED**；本 Slice 只提供 phase 入口与 candidate contract |
| AI 提出候选 formulation | Phase 3 | **DEFERRED**；本 Slice 只保证 AI 无确认权 |
| Safety State / `ResolveRisk` / 支持资源 | Phase 5（专业内容与运营承接） | **OUT OF SCOPE**；只复用状态谓词 |
| Evidence 更正 → formulation `NEEDS_REVIEW` | Evidence correction / 后续传播 Slice | **DEFERRED**；本 Slice 保存 `dependency_refs` 并在 Confirm 前实时校验 |
| Consent 撤回 → formulation 失效 | Consent / 后续传播 Slice | **DEFERRED**；本 Slice 不修改 consent revoke 路径 |
| Goal / Plan 对 formulation 的依赖 | Phase 4 | **OUT OF SCOPE**；本 Slice 只负责“进入 GOALS 前必须确认” |

**Blocking rule**：任何无法追溯到上表的扩展必须标记 `NEEDS UPSTREAM DECISION` 且不得实现。本 Spec 未使用该标记。

---

## 5. Actors / Authorization Boundary

| Actor | 能做什么 | 不能做什么 |
|---|---|---|
| **Family V1 管理主体**（创建该 Family 的 ADULT Person；Slice 1 / 2 冻结语义） | 读取当前 formulation；确认；表示不同意；提交更正；触发后续重新评估流程（当 caller 存在时） | 不能确认非 current / 非 `PRESENTED` 版本；不能在同一请求里“确认并改内容”；不能确认依赖已失效的版本；不能对非 primary Case 推进；不能在 `SAFETY_HOLD` 下推进 |
| **普通 Family 成员（非管理主体）** | 本 Slice 不赋予 formulation 读取或写入能力 | 不能读取、确认、争议、更正；端点统一 404，不泄露 formulation 是否存在 |
| **Guardian（非该 Family 成员）** | 无 | 不能访问；沿用 Slice 1 Family 上下文失败语义，不得转换为 formulation 错误码 |
| **其他 Family 的 Actor** | 无 | 跨 Family 硬阻断（§37.2）；应用层与 RLS 双层失败 |
| **未来 ACTIVE Participant（孩子 / 受邀成员）** | 本 Slice 不赋予任何 formulation 权限 | 不得因参与关系获得 formulation 可见性或确认权；由后续 Participant / Visibility Slice 明确设计 |
| **服务端 Domain Command caller**（未来 Assessment runtime / Domain Policy） | 可调用 `StartAssessment` / `PresentProblemFormulation` / `ReassessFromFormulation`；必须在**当前已验证用户 actor 的请求/事务上下文**内执行 | 不能伪造系统身份或模型身份；不能直接写数据库；不能把 candidate 置为 `CONFIRMED`；不能推进到 `GOALS` |
| **AI / 模型运行时** | 未来只能产生 candidate 内容交给 Domain Service，由 Domain Service 校验后调用 `Present` | 不能成为 `confirmed_by`；不能调用 `Confirm` / `Dispute` / `Correct`；不能写库；不能自行解除 Safety；不能修改专业规则 |

**授权实现约束**：

- 必须复用 Slice 1 的 `authorize()` 形状、`withRlsTransaction`、Family 管理主体判定与 Slice 2/7 的 Case 资源维度；**不得**新建 RBAC、role matrix、Case role 表或第二套可见性系统。
- 端点属于 Case 资源详情类，因此对“formulation 不存在 / 跨 Family / actor 无权 / Case 不存在”**统一返回 404**（沿用 Slice 2 / 7 的防泄露模式），不通过 403 / 404 差异泄露存在性。
- `authorize()` 可新增本 Slice 需要的**最小 Case 动作**与资源维度；具体字面量由 Plan 在既有 action 集合内决定，但业务语义必须是“Family 管理主体独占”。

---

## 6. Domain Concepts（统一语言）

**Problem Formulation**
: 一个 Case 当前对“问题是什么、依据是什么、还不知道什么、哪些来源冲突、为什么仍在当前 Scene、有哪些替代解释、什么情况下重新判断或退出”的正式、版本化判断。

**候选 Problem Formulation**
: 由服务端流程形成、尚未被真实用户确认的 formulation。候选不等于确认；`PRESENTED` 不等于 `CONFIRMED`。

**Formulation Version**
: 一个 Case 内 formulation 的业务版本序号，从 1 开始单调递增；一个 version 对应一份完整、可读、不可变的判断内容。

**Current Formulation**
: 一个 Case 当前生效的 formulation 版本。任一时刻最多一个；由版本链表达，不由 `status` 单独推导。

**Present**
: 把候选 formulation 变成“已向用户展示、等待响应”的正式动作；同时把 Case 从 `ASSESSMENT` 推进到 `PROBLEM_FORMULATION`。

**Confirm**
: 真实用户对当前 `PRESENTED` 版本作出“确认”的响应事实；只有它能把 Case 推进到 `GOALS`。

**Dispute**
: 真实用户对当前版本作出“不同意”的响应事实；它改变 formulation 状态，但不改变 Case phase。

**Correction**
: 用户对 formulation 内容的实质更正；必须形成新版本，旧版本 `SUPERSEDED`，不得原地覆盖。

**Reassess**
: 因用户纠正、冲突或替代解释而要求重新判断的 Domain Command；把 Case 从 `PROBLEM_FORMULATION` 回到 `ASSESSMENT`。

**Evidence Ref**
: formulation 判断所依据的、属于同一 Case 的 Statement / Observation / Message 引用；必须可追溯、当前有效。

**Dependency Ref**
: formulation 依赖的 Evidence / Consent / Policy / Package / Content Version 引用，用于后续失效传播；本 Slice 只保存并在 Confirm 前校验证据有效性。

**Unknown**
: 当前仍不知道或未收集的事项。必须保留 `UNKNOWN / NOT_COLLECTED / DECLINED` 的真实状态，不得用空值、0、false 或推断答案替代。

**Conflict**
: 两个或多个来源对同一事项给出不一致信息的状态。必须保留冲突双方；系统不得静默选择 winner。

**Scene Fit**
: “当前判断是否仍属于当前服务 Scene”的显式业务结论。本 Slice 只要求显式记录与结构校验，不实现 Scene 专业规则。

**User Response**
: 用户对 formulation 的最近一次响应事实（确认 / 不同意 / 更正），包含响应种类、actor、时间与用户说明（如有）。不得由 AI 生成。

---

## 7. State Semantics

### 7.1 状态词汇与读语义

| Status | 业务含义 | 是否 current | 允许的后续动作 | Case phase |
|---|---|---|---|---|
| `DRAFT` | 候选已形成但尚未向用户展示 | 否（本 Slice 不产生可观察的 current `DRAFT`） | 无 public 动作；只能被 Present 转为 `PRESENTED` | 不变 |
| `PRESENTED` | 已向用户展示，等待真实响应 | 是 | `Confirm`、`Dispute`、`Correction` | `PROBLEM_FORMULATION` |
| `CONFIRMED` | 真实用户已确认 | 是 | 只读；本 Slice 不再 Confirm / Dispute / Correct | `GOALS`（确认事务内推进） |
| `DISPUTED` | 真实用户明确不同意 | 是 | `Correction`（产生新版本）；不得 `Confirm` | `PROBLEM_FORMULATION`（不变） |
| `NEEDS_REVIEW` | 依赖失效，当前判断不能继续作为有效依据 | 是 | 不得 `Confirm`；允许 `Correction` 产生新版本并重新校验 | `PROBLEM_FORMULATION`（不变） |
| `SUPERSEDED` | 历史版本，已被新版本取代 | 否 | 只读，永久保留 | 不变 |

### 7.2 允许的状态转换

```text
DRAFT        --Present-->        PRESENTED
PRESENTED    --Confirm-->        CONFIRMED
PRESENTED    --Dispute-->        DISPUTED
PRESENTED    --Correction-->     新版本 PRESENTED；旧版本 SUPERSEDED
DISPUTED     --Correction-->     新版本 PRESENTED；旧版本 SUPERSEDED
NEEDS_REVIEW --Correction-->     新版本 PRESENTED；旧版本 SUPERSEDED
任意 current --依赖失效-->        NEEDS_REVIEW（本 Slice 只定义语义，触发方 DEFERRED）
```

禁止的转换（必须被服务端拒绝，不得静默忽略）：

- `PRESENTED → SUPERSEDED` 以外的任何“直接跳过确认进入 `CONFIRMED` 或 `GOALS`”。
- `DISPUTED → CONFIRMED`。
- `NEEDS_REVIEW → CONFIRMED`。
- `SUPERSEDED → 任意可写状态`。
- `CONFIRMED → DISPUTED` / `CONFIRMED → PRESENTED`（本 Slice 的 phase 已是 `GOALS`，后续由 Goal / Review 路径处理）。
- 用 `DRAFT` 冒充“已展示”或“已确认”。

### 7.3 状态与 Phase 的严格分离

`status` 是 formulation 自身的响应状态；`phase` 是 Case 的问题解决阶段。二者不得合并、不得互相推导：

- `PRESENTED` 不自动等于 `CONFIRMED`。
- `DISPUTED` 不自动把 Case 送回 `ASSESSMENT`。
- `NEEDS_REVIEW` 不自动改变 phase。
- 只有 `Confirm` 与 `Reassess` 改变 phase。
- `SAFETY_HOLD` / `CLOSED` 是 Case Status，不是 formulation 状态；不得写进 `problem_formulations.status`。

---

## 8. Version Semantics

1. **版本序列**：每个 Case 内 `version` 从 1 开始，单调递增，永不复用；`(case_id, version)` 唯一。
2. **一个 current**：任一时刻一个 Case 最多一个 current formulation。current 由版本链表达（未被 `SUPERSEDED` 的那一版），**不得**由 `status` 单独推导。
3. **追加而非覆盖**：任何已 `PRESENTED` / `CONFIRMED` / `DISPUTED` / `NEEDS_REVIEW` 的内容变更必须产生新 version；旧 version 置 `SUPERSEDED`，其内容、`evidence_refs`、`unknowns`、`conflicts`、`user_response`、`confirmed_by`、`confirmed_at` 永久保留且不可修改。
4. **Correction 的新版本**：新 version 必须是一份**完整、可独立阅读**的 formulation，而不是“对旧版本的补丁片段”；旧版本仍是可追溯历史。
5. **确认不继承**：新 version 的 `confirmed_by` / `confirmed_at` 必须为空；旧版本的确认事实不得复制到新版本。
6. **变更后的重新确认**：`Correction` 产生的版本必须为 `PRESENTED`，必须重新由真实用户 `Confirm` 后才能进入 `GOALS`。
7. **客户端不可指定 version**：`version` 由服务端分配；客户端提交或试图指定 version / status / confirmed_by 必须被 strict schema 拒绝。
8. **旧视图保护**：`Confirm` / `Dispute` / `Corrections` 的 `:version` 必须等于当前 current version；任何旧 version 请求必须返回状态冲突，不得覆盖新状态。
9. **不新增第二套版本号**：不得引入与业务 `version` 平行、对客户端暴露的第二套“锁版本”；并发保护可用当前 version + status 条件写、行锁或等价机制实现，但业务语义仍只有一个 version 序列。
10. **长期保留**：`SUPERSEDED` 版本不删除、不归档到不可检索的位置；其可追溯性属于 §17 长期家庭档案合同。

---

## 9. Commands / Operations

> 本节只定**业务合同**。具体 SQL、索引、锁顺序、错误码字面量与字段命名由 Plan 在既有基础设施内决定。

### 9.1 `StartAssessment`（内部 Domain Command）

> **OWNER-APPROVED CLARIFICATION（OC-1）**：本节只承载 `INTAKE → ASSESSMENT` 的最小 Phase Bridge，只为 Problem Formulation 合法可达服务；不承载任何 Assessment questionnaire / Assessment table-model / Digital Use `A1001`—`A2010` / Scene runtime / AI / RAG / 新 public assessment flow。它是内部 Domain Command，**无 public endpoint**。

- **Actor**：Family V1 管理主体；内部命令在用户请求/事务上下文执行。
- **前置**：
  1. `authorize()` 通过（Family 管理主体、当前目标 Family、目标 Case）。
  2. Case 属于当前目标 Family；`is_primary = true`；`status != CLOSED` 且 `status != SAFETY_HOLD`。
  3. `phase = INTAKE`。
  4. 至少一条**可追溯问题陈述**存在：属于该 Case 的 `dialogue_message`，或 `kind = STATEMENT` 的 `assertion`，且来源可追溯。
  5. 现有 Consent / Compliance 前置不得被绕过（不新建矩阵）。
- **效果**：`phase` 从 `INTAKE` 变为 `ASSESSMENT`；Case 聚合版本按既有合同推进；同一事务写 `case_event`、`business_audit_event`、幂等快照。
- **后置**：不创建 formulation、不创建 Assessment、不产生 AI / Scene / Plan / Task / Notification 副作用。
- **失败**：非 primary → 拒绝；`SAFETY_HOLD` → `SAFETY_HOLD_BLOCKED`；`CLOSED` → `CASE_CLOSED`；phase 不匹配 → 状态冲突；无问题陈述 → 拒绝；无权 / 不存在 / 跨 Family → 统一 404。
- **幂等**：同 key 同 payload 返回原结果；同 key 不同 payload → `409 IDEMPOTENCY_PAYLOAD_MISMATCH`；重试不得重复推进或重复写事件。

### 9.2 `PresentProblemFormulation`（内部 Domain Command）

> **OWNER-APPROVED CLARIFICATION（OC-3）**：`PresentProblemFormulation` 是正式内部 Domain Command / application service entry，未来由 Phase 2 Scene/Assessment 或 Phase 3 AI candidate flow 调用；**它不是 test fixture，也不是 SQL shortcut**，且**不得新增 public endpoint**（含 `POST /problem-formulations`、`/present`）。

- **Actor**：服务端 Domain Command caller（未来 Assessment 完成流程 / AI 提出候选后的 Domain Policy 校验流程）；必须在当前已验证用户 actor 的请求/事务上下文执行；**不是 public client，不是模型直接写库**。
- **输入**：Case 标识、候选内容（`primary_problem`、`key_factors`、`evidence_refs`、`unknowns`、`conflicts`、`scene_fit`、`alternative_explanations`、`reassessment_conditions`、`exit_conditions`、`dependency_refs`）、幂等键。候选**不得**携带 `case_id` / `family_id` / `version` / `status` / `confirmed_by` / `confirmed_at` 等服务器拥有字段。
- **前置**：
  1. `authorize()` 通过；Case 属于当前目标 Family；`is_primary = true`。
  2. `status != CLOSED` 且 `status != SAFETY_HOLD`。
  3. `phase = ASSESSMENT`。
  4. 候选字段全部显式提供（缺失字段不得用默认值补齐）。
  5. `evidence_refs` 至少 1 条；每条解析到**同一 Case** 的真实 Evidence，且引用时未被 SUPERSEDED / 未超出有效区间。
  6. `unknowns` / `conflicts` 覆盖被引用 Evidence 中真实存在的 `UNKNOWN / NOT_COLLECTED / DECLINED / CONFLICT`；不得遗漏或把 `DECLINED` 写成推断答案。
  7. `primary_problem` 与每个 `key_factor` 至少引用 1 条 evidence；不得出现无来源的确定性判断。
  8. `scene_fit` 显式存在；本 Slice 不校验其专业内容。
- **效果**（同一事务）：
  1. 创建 formulation version（首次为 1，后续为当前最大 version + 1）；
  2. 状态从 `DRAFT` 语义转为 `PRESENTED`（本 Slice 不产生可观察的持久 `DRAFT`；`DRAFT` 作为正式词汇保留）；
  3. 若有旧 current，则旧 current → `SUPERSEDED`；
  4. Case `phase` → `PROBLEM_FORMULATION`；
  5. 写 `case_event`、`business_audit_event`、幂等快照。
- **禁止**：不得置 `CONFIRMED`；不得填 `confirmed_by` / `confirmed_at`；不得推进到 `GOALS`；不得创建 Goal / Plan / Assessment / Scene 对象；不得新增 public 端点。
- **失败**：无 evidence / evidence 跨 Case / unknown-conflict 未覆盖 / 字段缺失 → 校验失败（不得部分写入）；非 primary / phase 不对 / Safety / Closed / 幂等冲突 → 对应真实拒绝。
- **幂等**：同 key 同 payload 返回原结果；不得重复创建 version；同 key 不同 payload → 409。

### 9.3 `ConfirmProblemFormulation`（public）

- **端点**：`POST /api/v1/cases/:id/problem-formulations/:version/confirm`
- **Actor**：Family V1 管理主体，必须是真实 Account / Person；AI 或系统 principal 一律拒绝。
- **请求体**：strict schema；只允许用户响应事实（如可选说明）；**不得**携带修改后的 formulation 内容、`status`、`confirmed_by`、`confirmed_at`、`case_id`、`version` 等服务器拥有字段。
- **前置**（顺序不得重排）：
  1. `authorize()` 通过；Case 属于当前目标 Family。
  2. `is_primary = true`；`status != CLOSED` 且 `status != SAFETY_HOLD`。
  3. `phase = PROBLEM_FORMULATION`。
  4. `:version` 等于 current version。
  5. 当前 formulation `status = PRESENTED`。
  6. `dependency_refs` / `evidence_refs` 指向的证据仍有效；依赖的 Consent / Policy / Package 未被判定失效（本 Slice 可确定的部分必须校验）。
  7. 必要信息足够；`scene_fit` 仍成立（只复核已记录值非空与引用未失效，不实现 Scene 专业判断）。
- **效果**（同一事务）：
  1. formulation `status` → `CONFIRMED`；
  2. `confirmed_by` = 已验证 actor 的 Person；`confirmed_at` = 服务端时间；
  3. `user_response` 记录确认响应（种类、actor、时间、说明）；
  4. Case `phase` → `GOALS`；
  5. 写 `case_event`、`business_audit_event`、幂等快照。
- **后置**：这是本 Slice 中**唯一**能让 Case 进入 `GOALS` 的路径。
- **失败**：非 current → 状态冲突；非 `PRESENTED` → 状态冲突；依赖失效 → 拒绝；非 primary / phase 不对 / Safety / Closed → 对应拒绝；同 key 重放 → 返回原结果；不同 key 对已确认版本 → 状态冲突；非 manager / 跨 Family / 不存在 → 统一 404。
- **禁止**：不得“确认并更正”；不得跳过 `PRESENTED`；不得由模型执行；不得重复推进 phase。

### 9.4 `DisputeProblemFormulation`（public）

> **OWNER-APPROVED CLARIFICATION（OC-2）**：`Dispute` 只表达“用户对当前 Presented Problem Formulation 明确不同意”。它改变 formulation 状态为 `DISPUTED`，`Case.phase` 保持 `PROBLEM_FORMULATION`，**不得**自动进入 `ASSESSMENT`；**Dispute ≠ Reassess**。

- **端点**：`POST /api/v1/cases/:id/problem-formulations/:version/dispute`
- **Actor**：Family V1 管理主体（真实用户）。
- **请求体**：strict；包含用户响应事实（如可选说明）；不得包含 formulation 修改内容或服务器字段。
- **前置**：`authorize()`；Case 属于当前 Family；`is_primary = true`；`status != CLOSED` 且 `status != SAFETY_HOLD`；`phase = PROBLEM_FORMULATION`；`:version` 为 current；当前 `status = PRESENTED`。
- **效果**（同一事务）：formulation `status` → `DISPUTED`；`user_response` 记录“不同意”响应；写 `case_event`、`business_audit_event`、幂等快照。
- **关键语义**：`Dispute` **不改变 Case phase**，不自动回到 `ASSESSMENT`，不进入 `GOALS`。用户可以选择“不同意但暂不重新评估”，系统必须允许该状态真实存在。
- **失败**：非 `PRESENTED` / 非 current / phase 不对 / 非 primary / Safety / Closed / 无权或不存在 → 对应真实拒绝；幂等同 §9.3。

### 9.5 `CorrectProblemFormulation`（public）

- **端点**：`POST /api/v1/cases/:id/problem-formulations/:version/corrections`
- **Actor**：Family V1 管理主体（真实用户）。
- **请求体**：strict；至少包含一项实质更正；不得携带完整服务器字段或客户端指定的新 version / status / confirmed_by。
- **前置**：`authorize()`；Case 属于当前 Family；`is_primary = true`；`status != CLOSED` 且 `status != SAFETY_HOLD`；`phase = PROBLEM_FORMULATION`；`:version` 为 current；当前 `status ∈ {PRESENTED, DISPUTED, NEEDS_REVIEW}`。
- **效果**（同一事务）：
  1. 创建新 version（= current version + 1）；
  2. 新版本是一份**完整、可独立阅读**的 formulation，保留旧内容与本次更正的合并结果；
  3. 旧版本 → `SUPERSEDED`，内容不可变；
  4. 新版本 `status = PRESENTED`；`confirmed_by` / `confirmed_at` 为空；
  5. `user_response` 记录更正响应；
  6. 写 `case_event`、`business_audit_event`、幂等快照。
- **后置**：新版本必须重新 `Confirm` 才能进入 `GOALS`。
- **禁止**：不得原地修改旧 version；不得删除旧 version；不得把确认事实复制到新 version；不得因为更正自动推进 phase。
- **失败**：空更正 → 422；`CONFIRMED` / `SUPERSEDED` / 非 current → 状态冲突；`GOALS` 阶段的 formulation 更正 → 本 Slice 拒绝（DEFERRED，见 §21.3）；非 primary / Safety / Closed / 无权 → 对应真实拒绝。

### 9.6 `ReassessFromFormulation`（内部 Domain Command）

> **OWNER-APPROVED CLARIFICATION（OC-2）**：`ReassessFromFormulation` 是独立 Domain Command，只在用户纠正、冲突、替代解释或其它已定义条件真正要求“重新判断当前问题”时执行；结果是 `PROBLEM_FORMULATION → ASSESSMENT`，并**保留既有 Problem Formulation 历史**，不得删除旧版本或静默覆盖。它**无 public endpoint**。

- **Actor**：服务端 Domain Command caller（真实用户请求上下文）；无 public 端点。
- **前置**：`authorize()`；Case 属于当前 Family；`is_primary = true`；`status != CLOSED` 且 `status != SAFETY_HOLD`；`phase = PROBLEM_FORMULATION`；存在 current formulation；前置原因属于“用户纠正、冲突或替代解释要求重新判断”的合法依据（由调用方与 Domain Policy 提供，本 Slice 不发明新枚举）。
- **效果**：`phase` → `ASSESSMENT`；**不修改** current formulation 的 `status`、内容或 version；写 `case_event`、`business_audit_event`、幂等快照。
- **后置**：后续 Assessment 重新形成候选时，`Present` 会产生新 version 并把旧 version 置 `SUPERSEDED`。
- **禁止**：不得自动重新评估；不得删除 formulation；不得进入 `GOALS`；不得新增 public 端点。
- **失败**：phase 不匹配 / 无 current / 非 primary / Safety / Closed / 无权 → 对应真实拒绝。

### 9.7 读取当前 formulation（public）

- **端点**：`GET /api/v1/cases/:id/problem-formulations/current`
- **Actor**：Family V1 管理主体（复用现有 Case 读取语义）。
- **语义**：
  1. 返回 current formulation（含 status、version、内容字段、evidence refs、unknowns、conflicts、scene_fit、alternative explanations、reassessment / exit conditions、user_response、confirmed_by / confirmed_at）。
  2. 无 formulation 时返回**真实空态**：不得伪造 placeholder、默认 formulation 或“已确认”对象；具体表达（404 或显式空结果）由 Plan 在既有详情语义内决定，但必须能与管理主体区分“真实不存在”。
  3. 跨 Family / 无权 / Case 不存在 → 统一 404，不泄露存在性。
- **禁止**：不得返回其他 Family、其他 Case、历史版本列表或第二个“当前 formulation”真相源；不得读取 `SUPERSEDED` 作为 current。

---

## 10. Phase Transition Boundary

| 当前 Phase | 命令 | 本 Slice | 目标 Phase |
|---|---|---|---|
| `INTAKE` | `StartAssessment` | **本 Slice 实现（最小前置）** | `ASSESSMENT` |
| `ASSESSMENT` | `PresentProblemFormulation` | **本 Slice 实现（内部）** | `PROBLEM_FORMULATION` |
| `PROBLEM_FORMULATION` | `ConfirmProblemFormulation` | **本 Slice 实现（public）** | `GOALS` |
| `PROBLEM_FORMULATION` | `ReassessFromFormulation` | **本 Slice 实现（内部）** | `ASSESSMENT` |
| `GOALS` | `ConfirmGoal` | 不实现（Goal Slice） | `PLANNING` |
| 任意 | `EnterSafetyHold` / `ResolveRisk` | 不实现（Safety Slice） | `SAFETY_HOLD` / `WAITING` |

**硬规则**：

- `ASSESSMENT` 不得跳过 `PROBLEM_FORMULATION` 直达 `GOALS`（§6.7 统一规则）。
- `GOALS` 只能由 current formulation `CONFIRMED` + 依赖有效 + primary + Safety 未阻断时进入。
- `DISPUTED` / `NEEDS_REVIEW` 不得进入 `GOALS`。
- 本 Slice 不得实现任何未列出的 phase 转换，也不得创建空壳命令。
- `StartAssessment`、`PresentProblemFormulation`、`ReassessFromFormulation` 均为内部命令，**不得**新增 public 端点；本 Slice 的 public 面严格为 §28.3 已批准的四个 formulation 端点（`GET current` / `confirm` / `dispute` / `corrections`）。

---

## 11. Evidence Dependency（保真规则）

1. **来源真实**：`evidence_refs` 必须解析到同一 `family_id` / `case_id` 的真实 `assertions` / `observations` / `dialogue_messages`；跨 Case、跨 Family、不存在 → 拒绝写入。
2. **有效性**：被引用 Evidence 若已被 SUPERSEDED、超出有效区间、或来源失效，则 `Present` 拒绝、`Confirm` 拒绝；不得把失效证据当作当前事实。
3. **未知保留**：Evidence 中为 `UNKNOWN / NOT_COLLECTED / DECLINED` 的事项，必须出现在 `unknowns` 中或等价地保留真实状态；不得写成推断答案、默认值、0/false、空字符串。
4. **冲突保留**：Evidence 中同一 `conflict_group_id` 或互为冲突的来源，必须在 `conflicts` 中保留双方；不得只保留一方或自动选 winner。
5. **无来源的确定性判断**：`primary_problem` 与每个 `key_factor` 必须至少引用 1 条非 UNKNOWN / 非 CONFLICT 的 Evidence；否则拒绝写入。
6. **父子关系**：`unknowns` / `conflicts` 的每一项必须可追溯到 Evidence / Observation / Message 或显式的“未收集”状态；不得是无来源的自由文本条目。
7. **更正传播边界**：Evidence 更正 → formulation `NEEDS_REVIEW` 的全链路传播**不在本 Slice**；本 Slice 只保证 `Confirm` 前实时校验，防止用已失效证据完成确认。
8. **DECLINED 不等于答案**：用户拒绝回答时，系统不得生成“默认推断值”；`DECLINED` 只能作为真实状态保留。

---

## 12. Safety / Primary Guards

### 12.1 Safety

- `SAFETY_HOLD` 是 Case Status，不是 formulation 状态。
- `StartAssessment` / `Present` / `Confirm` / `Dispute` / `Corrections` / `Reassess` 在 `status = SAFETY_HOLD` 时必须拒绝，返回既有的 `SAFETY_HOLD_BLOCKED` 语义。
- 本 Slice **不实现** `EnterSafetyHold`、`ResolveRisk`、风险模型、支持资源、Safety Operations、Alibaba Guardrails。
- 本 Slice 不得因为“读取 formulation”而解除 Safety；读取可以返回真实状态，但不得推进普通流程。
- `WAITING` 不作为本 Slice 的额外阻断条件：本 Slice 不新增 WAITING 语义，只按 §6.7 列出的 primary / Safety 守门执行。

### 12.2 Primary

- 所有 formulation **写**命令要求 `case.is_primary = true`；候选 Case 不得推进 formulation。
- 读取不要求 primary：Case 被降级为候选后，其已有 formulation 仍可被管理主体读取（历史与数据不消失），但不得继续确认 / 争议 / 更正。
- 本 Slice 不得重新实现第二套 primary 机制；只读 `cases.is_primary`（Slice 2 / 7 已冻结）。
- 本 Slice 不改变 primary；`SwitchPrimaryCase` 仍归 Slice 7。

### 12.3 CLOSED

- `CLOSED` Case 不得执行任何 formulation 写命令；读取按既有 Case 语义。
- 本 Slice 不实现 `CloseCase`；只读取状态谓词。

---

## 13. Concurrency / Idempotency / Transaction（产品合同层）

1. **幂等**：每个写命令（`StartAssessment`、`Present`、`Confirm`、`Dispute`、`Corrections`、`Reassess`）必须遵循 §8.5 的 `actor_id + command_type + idempotency_key` 合同：
   - 相同 key + 相同 canonical payload → 返回原结果，不重复写入；
   - 相同 key + 不同 payload → `409 IDEMPOTENCY_PAYLOAD_MISMATCH`；
   - 并发同 key → 只有一个业务结果，其余为 replay。
2. **内部命令的 actor**：内部命令必须在真实用户请求/事务上下文中执行，使用该用户的 Account 作为幂等 scope；不得发明“系统 actor”“模型 actor”或第二套幂等机制。
3. **版本保护**：`Confirm` / `Dispute` / `Corrections` 的 `:version` 必须等于 current；旧版本请求必须失败，不得覆盖新状态。
4. **同版本竞争**：两个并发 `Confirm`（不同 key）只能一个成功；另一个返回状态冲突；不得重复推进 phase 或重复写确认事实。并发的 `Confirm` 与 `Dispute` 也必须只有一个结果。
5. **事务原子性**：业务写入（formulation 行 / Case phase / case_event / business_audit_event / 幂等快照）必须在同一业务事务内提交；任一步失败则整体回滚，不得出现“版本已建但未展示”“phase 已推进但无记录”“确认已写但未审计”。
6. **current 唯一**：并发创建新版本时，最终只能有一个 current；不得出现两个未 `SUPERSEDED` 的版本。
7. **重试与后台恢复**：不得因重试产生重复 version、重复审计或重复事件；`SUPERSEDED` 历史不得因重试被改写。
8. **具体隔离级别、行锁顺序、唯一索引形态**：Plan 决定，但必须满足以上语义；Spec 不规定 SQL。

---

## 14. Failure Semantics

| 失败类别 | 触发 | 必须返回的真实语义 | 禁止 |
|---|---|---|---|
| **不存在 / 跨 Family / 无权** | formulation / Case 不存在；跨 Family；actor 非管理主体 | 统一 404，不泄露 formulation 是否存在、内容、Family、status 或 version | 不得用 403 / 404 差异泄露存在性；不得返回部分字段 |
| **Family 上下文失败** | actor 不是目标 Family 成员（含仅 guardian） | 沿用 Slice 1 的 current-family 语义；不得转换为 formulation 错误码 | 不得定义第二套 Family 错误码 |
| **非 primary** | Case 为候选 | 状态冲突（拒绝写） | 不得静默降级为“只读成功” |
| **SAFETY_HOLD** | Case status 为 `SAFETY_HOLD` | 复用 `SAFETY_HOLD_BLOCKED` | 不得绕过；不得自动解除；不得读取后继续推进 |
| **CLOSED** | Case status 为 `CLOSED` | 复用 `CASE_CLOSED` | 不得写；不得伪造关闭后的可编辑性 |
| **Phase 不匹配** | `INTAKE` 未 StartAssessment；`GOALS` 已确认；`CLOSED` 等 | 状态冲突（409） | 不得跳阶段；不得自动完成中间命令 |
| **版本非 current** | 请求旧 version | 状态冲突（409） | 不得覆盖新版本；不得返回旧内容冒充 current |
| **状态不匹配** | 对 `DISPUTED` / `NEEDS_REVIEW` / `CONFIRMED` / `SUPERSEDED` 执行不允许的动作 | 状态冲突（409） | 不得自动转换；不得忽略 |
| **依赖失效** | 引用的 Evidence 已失效 / 被 SUPERSEDED / 跨 Case | 拒绝（状态冲突，语义为依赖无效） | 不得用失效证据确认；不得自动“修好” |
| **证据保真失败** | 无 evidence；unknown / conflict 未保留；DECLINED 被推断 | 校验失败（422） | 不得自动补一条“系统证据”；不得把 UNKNOWN 写成确定值 |
| **strict schema 失败** | 客户端提交未声明字段、服务器字段、非法 version / status | 422，且**零业务写入** | 不得忽略非法字段后继续执行 |
| **幂等冲突** | 同 key 不同 payload | 409 `IDEMPOTENCY_PAYLOAD_MISMATCH` | 不得覆盖原结果 |
| **并发冲突** | 两请求同时改同一 current | 一个成功，另一个 409 | 不得“最后写入者获胜” |
| **事务失败** | 任一写入失败 | 真实错误，整体回滚 | 不得部分成功；不得把失败包装成成功 |
| **模型 / 网络 / 后台失败** | 本 Slice 不接模型与后台；未来接入 | 真实 `UNKNOWN` / 失败，不得伪造成功 | 不得用“已生成”掩盖未完成 |

具体 HTTP 状态码与错误码字面量：Plan 在既有 `ERROR_MAP` 内决定；语义与“404 统一防泄露”“409 状态冲突”“422 校验失败”的区分不得改变。

---

## 15. Requirements

- **FR-001** [UPSTREAM: §7.2 / §5 不变量 6] 系统 MUST 建立独立的 `problem_formulations` 业务对象；MUST NOT 把 formulation 与 Case、Evidence、Assessment、Scene、Goal、Plan 合并。
- **FR-002** [UPSTREAM: §7.2] `status` MUST 只使用 `DRAFT / PRESENTED / CONFIRMED / DISPUTED / NEEDS_REVIEW / SUPERSEDED`；MUST NOT 新增、改名、重排或把 Case Status 写进该字段。
- **FR-003** [UPSTREAM: §7.2 / §8.2 / §28.3] 每个 Case 内 `version` MUST 从 1 起单调递增、不可复用；`(case_id, version)` MUST 唯一；任一时刻 MUST 最多一个 current。
- **FR-004** [UPSTREAM: §8.2] 任何已 `PRESENTED` 或之后状态的实质内容变更 MUST 产生新 version；旧 version MUST 置 `SUPERSEDED` 且内容不可变；MUST NOT 原地 UPDATE 历史。
- **FR-005** [UPSTREAM: §6.7 / §23] `StartAssessment` MUST 只做 `INTAKE → ASSESSMENT` 的 phase 推进与前置校验；MUST NOT 创建 Assessment、Scene、AI 或任何 Assessment 内容对象。
- **FR-006** [UPSTREAM: §6.7 / §12.4 / §23] `PresentProblemFormulation` MUST 作为内部 Domain Command 形成候选并进入 `PRESENTED`，同时把 Case 推进到 `PROBLEM_FORMULATION`；MUST NOT 新增 public create / present 端点。
- **FR-007** [UPSTREAM: V1-C02 / V1-C03 / §12.4] `Present` MUST 校验 `evidence_refs` 全部属于同一 Case 且当前有效；MUST 要求 `unknowns` / `conflicts` 覆盖被引用证据中的真实未知与冲突；MUST 拒绝无来源的确定性判断。
- **FR-008** [UPSTREAM: §6.7 / §29.1 / V1-C04] `ConfirmProblemFormulation` MUST 要求 current version、`PRESENTED`、primary、非 `SAFETY_HOLD` / `CLOSED`、`phase = PROBLEM_FORMULATION`、依赖有效；MUST 只有满足全部条件才把 `phase` 设为 `GOALS`。
- **FR-009** [UPSTREAM: §29.1 / §7.10] `Confirm` MUST 复核 `evidence_refs` / `dependency_refs` 的有效性；MUST 拒绝依赖失效的确认。
- **FR-010** [UPSTREAM: §2.5 / §6.7] `DisputeProblemFormulation` MUST 只改变 formulation 状态为 `DISPUTED` 并记录用户响应；MUST NOT 改变 Case phase；MUST 允许“不同意但暂不重新评估”。
- **FR-011** [UPSTREAM: §8.2 / V1-C22 / V1-C32] `Corrections` MUST 创建新 version 并置旧 version `SUPERSEDED`；新 version MUST 为完整可读内容、`PRESENTED`、且 `confirmed_by` / `confirmed_at` 为空；MUST NOT 原地修改或删除历史。
- **FR-012** [UPSTREAM: §6.7] `ReassessFromFormulation` MUST 只做 `PROBLEM_FORMULATION → ASSESSMENT`；MUST NOT 修改 current formulation 的 status / 内容 / version；MUST NOT 新增 public 端点。
- **FR-013** [UPSTREAM: §6.7 / §39 V1-C04] 系统 MUST NOT 允许 `ASSESSMENT` 跳过 `PROBLEM_FORMULATION` 进入 `GOALS`；MUST NOT 允许 `DISPUTED` / `NEEDS_REVIEW` / 非 current / 未确认版本进入 `GOALS`。
- **FR-014** [UPSTREAM: V1-C24 / §23] 系统 MUST NOT 允许 AI / 模型 / 系统 principal 执行 `Confirm` / `Dispute` / `Correct`，也 MUST NOT 允许其成为 `confirmed_by`；`confirmed_by` MUST 是真实 Account / Person。
- **FR-015** [UPSTREAM: §5 不变量 19 / Slice 7] 所有 formulation 写命令 MUST 要求当前 Case 为 `is_primary = true`；MUST NOT 重新实现第二套 primary 机制；读取 MUST NOT 因 Case 被降级而消失。
- **FR-016** [UPSTREAM: V1-C25 / §6.6] 写命令在 `SAFETY_HOLD` 时 MUST 被阻断并复用既有 `SAFETY_HOLD_BLOCKED` 语义；在 `CLOSED` 时 MUST 被阻断；MUST NOT 实现 Safety State Core 或解除 Safety。
- **FR-017** [UPSTREAM: §9 / §9.1 / V1-C21] 所有读写 MUST 先经 `authorize()`，再在 `withRlsTransaction` 内执行；MUST 复用 Family 管理主体语义；MUST NOT 新建 RBAC / role matrix / Case role / Visibility Matrix。
- **FR-018** [UPSTREAM: §9.1] `problem_formulations` MUST 启用并强制 RLS；无上下文 MUST 返回零行 / 拒绝写入；运行角色 MUST NOT 为 table owner、MUST NOT 具备 BYPASSRLS。
- **FR-019** [UPSTREAM: §8.5 / V1-C28] 每个写命令 MUST 遵循既有幂等合同；内部命令 MUST 使用真实用户 actor，MUST NOT 发明系统 / 模型 actor 或第二套幂等机制。
- **FR-020** [UPSTREAM: §8.6 / V1-C28] `Confirm` / `Dispute` / `Corrections` MUST 拒绝非 current version 与旧视图；并发同版本竞争 MUST 只有一个成功；MUST NOT 出现两个 current。
- **FR-021** [UPSTREAM: §7.8 / §7.9] 每次成功写命令 MUST 在同一业务事务内写 `case_event` 与 `business_audit_event`；事件 / 审计 MUST NOT 复制 formulation 正文；重放 MUST NOT 追加第二组。
- **FR-022** [UPSTREAM: §28.3] public API 面 MUST 严格等于四个已批准端点；MUST NOT 新增 `POST /problem-formulations`、`/present`、历史版本列表、或其他第五个端点。
- **FR-023** [UPSTREAM: V1-C27] 所有失败 MUST 返回真实状态；MUST NOT 伪造成功、部分成功或“已确认”；事务失败 MUST 整体回滚。
- **FR-024** [UPSTREAM: U06 / Slice 2 空态先例] 无 formulation 时 MUST 返回真实空态；MUST NOT 伪造默认 formulation、默认确认或 placeholder。
- **FR-025** [UPSTREAM: §7.2 / Out of Scope] 本 Slice MUST NOT 创建 `assessments`、`scene_*`、`goals`、`plan_versions`、`tasks`、`reviews`、`risk_events`、`artifact_dependencies`、Memory 等表 / 路由 / 占位实现。
- **FR-026** [UPSTREAM: §7.10 / §29.5 / §29.6] 本 Slice MUST 保存 `dependency_refs` 并在 Confirm 前校验；MUST NOT 实现 Consent 撤回 / Evidence 更正的全链路传播、通用依赖图或 Memory 失效重建。
- **FR-027** [UPSTREAM: §17 / §8.2] `SUPERSEDED` 版本 MUST 永久保留并可追溯；MUST NOT 删除、不可逆改写或让旧版本重新成为 current。
- **FR-028** [UPSTREAM: §28.11 U06 / Out of Scope] 本 Slice 只交付服务端能力；MUST NOT 交付小程序 UI、运营后台、通知或端到端产品页面。
- **FR-029** [UPSTREAM: §12.4 / §38] 本 Slice MUST 保持 Scene-agnostic；MUST NOT 硬编码 Digital Use 节点编号、手机专属字段或 Scene 专业规则。
- **FR-030** [UPSTREAM: §6.7] `StartAssessment` 的“至少一条可追溯问题陈述” MUST 指向同一 Case 的真实 `dialogue_message` 或 `kind = STATEMENT` 的 `assertion`；MUST NOT 用客户端自由文本或测试 fixture 冒充。

No requirement may be invented to make implementation easier.

---

## 16. Acceptance Scenarios

1. **Given** 一个 primary、`OPEN + INTAKE` 的 Case 且已有至少一条可追溯问题陈述，**When** 管理主体执行 `StartAssessment`，**Then** Case 变为 `ASSESSMENT`，写入成功事件与审计，且不创建 Assessment / Scene / formulation 对象。**Upstream**: §6.7、§23、FR-005、FR-030
2. **Given** 同一 Case 没有任何可追溯问题陈述，或不是 primary，或为 `SAFETY_HOLD`，**When** 执行 `StartAssessment`，**Then** 返回真实拒绝，phase 保持 `INTAKE`，不产生部分写入。**Upstream**: §6.7、V1-C27
3. **Given** 一个 `ASSESSMENT` 的 primary Case 且证据完整，**When** 服务端在用户上下文中执行 `PresentProblemFormulation`，**Then** 创建 version 1、状态 `PRESENTED`、Case 进入 `PROBLEM_FORMULATION`；`confirmed_by` 为空；无 Goal / Plan / AI 副作用。**Upstream**: §6.7、§7.2、§12.4、FR-006
4. **Given** 候选引用跨 Case / 跨 Family 的 Evidence，或 `unknowns` / `conflicts` 未覆盖真实状态，或 `primary_problem` / `key_factor` 无证据来源，**When** 执行 `Present`，**Then** 写入被拒绝，零业务写入，不生成 formulation。**Upstream**: V1-C02、V1-C03、V1-X05、FR-007
5. **Given** 一个 `PRESENTED` 的 current formulation，**When** 管理主体读取 current，**Then** 返回完整内容、来源引用、未知、冲突、`scene_fit`、替代解释、重新判断 / 退出条件与用户响应字段。**Upstream**: U06、§2.5、FR-024
6. **Given** 一个 `PRESENTED` 的 current formulation，**When** 管理主体执行 `Confirm`，**Then** 状态为 `CONFIRMED`、`confirmed_by` 为真实用户、Case 进入 `GOALS`，同事务写事件与审计。**Upstream**: V1-C04、§6.7、§29.1、FR-008
7. **Given** 请求的 version 不是 current，或当前状态不是 `PRESENTED`，或 Case 不是 primary / 为 `SAFETY_HOLD`，**When** 执行 `Confirm`，**Then** 返回真实状态冲突 / 阻断，phase 不变，不写确认事实。**Upstream**: §6.7、§29.1、V1-C25、FR-008、FR-009
8. **Given** 一个 current formulation 引用的 Evidence 已被 SUPERSEDED 或超出有效区间，**When** 执行 `Confirm`，**Then** 拒绝确认，phase 保持 `PROBLEM_FORMULATION`，不得用失效证据确认。**Upstream**: §7.10、V1-C22、FR-009
9. **Given** 一个 AI / 系统 principal 尝试执行 `Confirm`，**When** 请求被处理，**Then** 服务端拒绝；不存在 `confirmed_by = AI` 的业务事实。**Upstream**: V1-C24、§23、FR-014
10. **Given** 一个 `PRESENTED` 的 current formulation，**When** 管理主体执行 `Dispute`，**Then** 状态变为 `DISPUTED`，Case phase 保持 `PROBLEM_FORMULATION`，不进入 `GOALS`。**Upstream**: §2.5、§6.7、FR-010
11. **Given** 一个 `DISPUTED` 的 current formulation，**When** 管理主体尝试直接 `Confirm`，**Then** 返回状态冲突；必须先更正产生新版本。**Upstream**: §2.5、V1-C04、FR-010、FR-011
12. **Given** 一个 `DISPUTED` 的 current formulation，**When** 管理主体提交实质更正，**Then** 创建 version 2、状态 `PRESENTED`，version 1 变 `SUPERSEDED` 且内容不变；新版本 `confirmed_by` 为空；phase 仍为 `PROBLEM_FORMULATION`。**Upstream**: §8.2、V1-C22、FR-011
13. **Given** 两个并发请求对同一 current version 执行 `Confirm`（不同幂等键），**When** 两者完成，**Then** 只有一个成功，另一个返回状态冲突；不存在两次 phase 推进或两组确认事件。**Upstream**: §8.6、V1-C28、FR-020
14. **Given** 同一幂等键与相同 payload 的 `Confirm` 重放（含并发），**When** 请求完成，**Then** 返回原确认结果，不追加 version、事件或审计；同 key 不同 payload 返回 409。**Upstream**: §8.5、V1-C28、FR-019
15. **Given** 一个 `PROBLEM_FORMULATION` 的 primary Case，**When** 服务端在用户上下文中执行 `ReassessFromFormulation`，**Then** Case 回到 `ASSESSMENT`，current formulation 的 status / version / 内容保持不变；随后新的 `Present` 产生 version 2 并把 version 1 置 `SUPERSEDED`。**Upstream**: §6.7、§8.2、FR-012
16. **Given** Family A 的管理主体与 Family B 的 formulation / Case，**When** A 读取或写入 B 的 formulation，**Then** 统一 404，响应不含 B 的任何字段或存在性信息；运行角色在 A 的 RLS 上下文直连查询返回零行。**Upstream**: V1-C21、§9、§9.1、FR-017、FR-018
17. **Given** 数据库连接没有任何 `app.family_id` 上下文，**When** 查询 `problem_formulations`，**Then** 返回零行；写入被拒绝。**Upstream**: §9.1、FR-018
18. **Given** 一个不是该 Family 管理主体的普通成员，**When** 访问任一 formulation 端点，**Then** 统一 404，不泄露 formulation 是否存在；不产生任何写入。**Upstream**: §9、FR-017
19. **Given** 一个 Case 被 Slice 7 切换为候选（primary = false），即使它已有 formulation，**When** 管理主体读取 current，**Then** 读取仍可返回真实数据；**When** 尝试 Confirm / Dispute / Corrections / Present，**Then** 返回非 primary 状态冲突。**Upstream**: §5 不变量 19、FR-015
20. **Given** 本 Slice 的数据库结构与路由清单，**When** 做结构断言，**Then** 不存在 `assessments`、`scene_node_states`、`scene_artifacts`、`goals`、`plan_versions`、`tasks`、`reviews`、`risk_events`、`artifact_dependencies` 等表；不存在 `POST /problem-formulations`、`/present` 或任何第五个 formulation 端点。**Upstream**: §7.2、§28.3、FR-022、FR-025
21. **Given** 一个没有 formulation 的 `ASSESSMENT` Case，**When** 管理主体请求 current，**Then** 返回真实空态，不伪造默认 formulation；不得显示“已确认”。**Upstream**: U06、V1-C27、FR-024
22. **Given** 候选中的 `unknowns` 把 `DECLINED`（用户拒绝回答）写成推断答案，或 `conflicts` 只保留一方，**When** 执行 `Present`，**Then** 写入被拒绝，不产生 formulation；不得静默把 DECLINED 或 CONFLICT 变成确定事实。**Upstream**: V1-C03、V1-X05、FR-007
23. **Given** 一个成功写入的 formulation，**When** 检查 `case_events` 与 `business_audit_events`，**Then** 各存在对应的状态 / phase 记录，且审计 metadata 不包含 `primary_problem` / `unknowns` 等正文。**Upstream**: §7.8、§7.9、FR-021
24. **Given** 一次 `Present` / `Confirm` / `Corrections` 中任一步写入失败，**When** 事务结束，**Then** 整体回滚：不存在“版本已建但未展示”“phase 已推进但无事件”“确认已写但无审计”的部分状态。**Upstream**: V1-C27、V1-C28、FR-023
25. **Given** 一个 `CONFIRMED` 且 phase 为 `GOALS` 的 Case，**When** 管理主体尝试对 formulation 提交更正，**Then** 本 Slice 返回状态冲突（该路径 DEFERRED 给 Goal / Review / 传播 Slice），不得静默修改已确认历史。**Upstream**: §6.7、§29.6、FR-011、§21.3

---

## 17. Acceptance Evidence

| Acceptance item | Verification type | Required evidence |
|---|---|---|
| `StartAssessment` 成功与拒绝（场景 1、2） | domain + integration + database | INTAKE→ASSESSMENT 的 phase 变化；事件 / 审计行；拒绝时 phase 未变、无部分写入 |
| `Present` 成功（场景 3） | domain + integration + database | version=1、status=PRESENTED、phase=PROBLEM_FORMULATION、confirmed_by 为空；无越界对象 |
| 证据保真（场景 4、22） | domain + integration | 跨 Case / 跨 Family evidence 拒绝；unknown / conflict / DECLINED 未覆盖时拒绝；零写入 |
| current 读取（场景 5、21） | integration | 完整字段返回；无 formulation 的真实空态；不伪造默认对象 |
| Confirm 成功（场景 6） | integration + database | status=CONFIRMED、confirmed_by=真实用户、phase=GOALS、事件 + 审计存在 |
| Confirm 拒绝（场景 7、8） | integration | 非 current / 非 PRESENTED / 非 primary / Safety / 依赖失效均返回真实冲突，phase 不变 |
| AI 无确认权（场景 9） | domain + integration | AI / 系统 principal 的 Confirm 被拒绝；不存在 `confirmed_by = AI` 的持久事实 |
| Dispute 不改变 phase（场景 10、11） | integration | status=DISPUTED、phase=PROBLEM_FORMULATION；随后 Confirm 返回冲突 |
| Correction 追加版本（场景 12） | integration + database | 新 version=2、旧 v1=SUPERSEDED 且内容不变、confirmed_by 为空、phase 不变 |
| 并发同版本（场景 13） | integration + database concurrency | 两个不同 key 的 Confirm 只有一个成功；一个 current；无重复 phase / 事件 |
| 幂等重放（场景 14） | integration + database | 同 key 重放不新增 version / event / audit；不同 payload 409 |
| Reassess（场景 15） | domain + integration | phase 回到 ASSESSMENT；current formulation 内容与 version 不变；后续 Present SUPERSEDE 旧版本 |
| 跨 Family / 无上下文（场景 16、17、18） | integration + database | 统一 404 无字段 / 存在性泄露；RLS 零行 / write denied；app role 非 owner、无 BYPASSRLS |
| 降级 primary 后（场景 19） | integration | 读取成功、写入全部非 primary 拒绝 |
| 越界 schema / route（场景 20） | database introspection + route enumeration | 结构 / 路由枚举输出证明不存在排除对象与第五个端点 |
| 审计最小化（场景 23） | database | 事件 / 审计存在；metadata 不含 formulation 正文 |
| 事务原子性（场景 24） | integration + database | 注入任一步失败的测试中，所有业务表无部分状态 |
| GOALS 阶段更正 deferred（场景 25） | integration | 返回状态冲突；不修改已确认版本 |
| RLS / 角色 / migration（FR-018） | database verification | `relrowsecurity`、`relforcerowsecurity`、运行角色非 owner、`rolbypassrls = false`、迁移可重放 |

---

## 18. Key Entities

> 逻辑约束，不是 DDL。列级类型、索引、约束名、锁顺序由 Plan 决定。

### 18.1 `problem_formulations`

1. **标识**：系统生成唯一标识；`uuidv7()` 基线；创建后不可变。
2. **`family_id`**：必填；用于 Family 隔离与 RLS；必须与 Case 的归属一致。这是既有 Evidence / Case 表同构的作用域列，不新增业务语义。
3. **`case_id`**：必填；必须属于同一 `family_id`；创建后不可迁移。
4. **`version`**：必填；Case 内从 1 起单调递增；`(case_id, version)` 唯一；不可变；客户端不可指定。
5. **`status`**：必填；严格六值枚举；转换受 §7.2 与 §7.3 约束。
6. **`primary_problem`**：必填；非空、非纯空白；必须可追溯到至少 1 条有效 Evidence 引用。
7. **`key_factors`**：必填数组；每项必须可追溯到至少 1 条有效 Evidence 引用；空数组是显式业务判断，不得以“字段缺失”表达。
8. **`evidence_refs`**：必填数组；`PRESENTED` 时至少 1 条；每项必须解析到同一 Case 的真实 Evidence；不得跨 Case / 跨 Family。
9. **`unknowns`**：必填数组；每项必须引用 Evidence / Observation / Message 或显式 `NOT_COLLECTED` 状态；不得为空字符串、默认值或推断答案。
10. **`conflicts`**：必填数组；每项必须引用 `conflict_group_id` 或冲突双方 Evidence；不得只保留一方。
11. **`scene_fit`**：必填且显式；本 Slice 不定义 Scene 专业取值词汇，但不得为空、不得用默认值补；不得硬编码 Digital Use 规则。
12. **`alternative_explanations`**：必填数组；可显式为空；不得与 `primary_problem` 冲突却未在 `conflicts` 中记录。
13. **`reassessment_conditions`**：必填数组；可显式为空；表示何种情况要求重新判断。
14. **`exit_conditions`**：必填数组；可显式为空；表示何种情况要求退出当前 Scene。
15. **`user_response`**：记录最近一次用户响应（确认 / 不同意 / 更正）；包含响应种类、真实 actor、时间与用户说明（如有）；不得由 AI 生成。
16. **`confirmed_by`**：仅 `CONFIRMED` 时非空；必须是真实 Account / Person；不得是 AI / 系统 principal。
17. **`confirmed_at`**：仅 `CONFIRMED` 时非空；服务端时间；不得由客户端提供。
18. **`dependency_refs`**：必填数组；覆盖 Evidence / Consent / Policy / Package / Content Version 引用；每项必须可追溯。
19. **`supersedes` / 版本链**：必须能表达“新版本取代旧版本”；旧版本 `SUPERSEDED` 且内容不可变；不得自环或循环。
20. **时间**：服务端 `created_at` / `updated_at`；`updated_at` 只能由服务端产生。
21. **禁止字段**：不得保存 Assessment 问卷、Scene Node State、AI prompt、模型输出原文、Goal、Plan、Task、通知、Support Resource 或任何跨对象正文。
22. **禁止关系**：不得在本 Slice 建立 Goal / Plan / Task / Intervention / Review / Risk Event / Referral 外键或占位关系。

### 18.2 复用的既有实体（本 Slice 只增量使用，不重定义）

- **`cases`**：只读 `family_id` / `is_primary` / `status` / `phase` / `version`；新增 `phase` 的受控写入能力（列级授权由 Plan 通过 reviewed migration 增量扩展）；不得改变 `cases` 的既有语义。
- **`case_events`**：追加本 Slice 的 phase / formulation 状态事件；metadata 必须最小化，不记录 formulation 正文；事件词汇通过 reviewed migration 追加。
- **`business_audit_events`**：追加本 Slice 的审计事件与资源类型；沿用既有家庭作用域与不可伪造语义。
- **`idempotency_keys`**：追加本 Slice 的 command types；沿用既有 `actor + command + key` 合同与重放快照语义。
- **`assertions` / `observations` / `dialogue_messages`**：只读引用；不修改其内容、不改变其语义。
- **`families` / `persons` / `family_members`**：只作为授权与管理主体输入。

### 18.3 明确不存在于本 Slice 的对象

`assessments`、`scene_node_states`、`scene_artifacts`、`goals`、`intervention_instances`、`plan_versions`、`tasks`、`checkins`、`reviews`、`outcomes`、`risk_events`、`referrals`、`support_resources`、`artifact_dependencies`、`derived_memories`、`ai_runs`、任何 UI 状态表。

---

## 19. DFX Constraints

### 19.1 性能

- 所有 formulation 读写 MUST 是同步持久化并返回真实结果的普通 API；MUST NOT 被模型调用、RAG、后台任务或通知阻塞。
- 本 Slice MUST NOT 引入 AI、RAG、pg-boss、Notification、Scene Engine 或外部副作用调用。
- 具体 p95 / 吞吐 / 并发上限：上游未给出数字，`§37.2` 明确在首次压测后冻结；本 Spec 不发明数字。

### 19.2 可靠性

- 跨 Family 与无授权访问 MUST 为硬阻断。
- 幂等、并发与重试 MUST NOT 产生重复 version、重复确认、重复 phase 推进或重复审计。
- `current` 唯一性 MUST 在并发下成立。
- 业务写入、phase 变化、事件、审计与幂等快照 MUST 原子提交；不得部分成功。

### 19.3 安全性

- 所有读写 MUST 先 `authorize()`，再 `withRlsTransaction`；RLS 存在 MUST NOT 成为跳过 `authorize()` 的理由。
- 运行角色 MUST NOT 为 table owner、MUST NOT 具备 BYPASSRLS。
- `problem_formulations` MUST 启用并强制 RLS；无上下文默认拒绝。
- 404 / 403 语义 MUST NOT 泄露 formulation 是否存在或任何字段。
- `confirmed_by` MUST 是真实用户；AI / 系统 principal MUST NOT 成为确认主体。
- 事件 / 审计 MUST NOT 复制 formulation 正文、用户原话或敏感内容。

### 19.4 可维护性

- `status` 词汇、转换与版本语义 MUST 通过领域测试机械验证。
- 新事件 / 审计 / 幂等词汇 MUST 通过 reviewed migration 增量扩展；MUST NOT 在运行时接受未定义值。
- RLS 状态、运行角色权限 MUST 在 CI / 数据库校验中被证明。
- 结构 / 路由断言 MUST 能证明本 Spec 排除的对象不存在。

### 19.5 兼容性

- 本 Slice 只对既有基础设施做增量扩展；MUST NOT 修改 Slice 1 / 2 / 3 / 4 / 5 / 7 已冻结的授权、RLS、幂等、审计、Case、Evidence、Participant、primary 语义。
- 既有 `/auth`、`/me`、`/families`、`/consents`、`/cases`、`/messages`、`/participations`、`/identity-bindings` 端点语义 MUST NOT 改变。
- MUST NOT 修改 `Docs/**`；若发现真实冲突，必须停止并报告上游决策。

---

## 20. Clarifications

### C1 — RESOLVED（OWNER-APPROVED CLARIFICATION）：Candidate Formulation 的创建 / 呈现载体

> **性质**：本条是 **OWNER-APPROVED CLARIFICATION**，是基于现有权威 Docs（§23 / §28.3 / §12.4 / §7.2 / §38）做出的明确边界收口，不是 Docs 原文的逐字表述。

**结论**：

1. **唯一合法入口**是 `Docs/V1技术设计.md` §23 已列出的 Domain Command `PresentProblemFormulation`；它不是 public API。
2. `§28.3` 只批准四个 formulation 端点（current / confirm / dispute / corrections），**没有** create / present / draft 端点。因此本 Slice **不新增** `POST /problem-formulations` 或 `/present`。
3. 当前权威 API Surface 对 Problem Formulation 严格为：

   ```text
   GET  /api/v1/cases/:id/problem-formulations/current
   POST /api/v1/cases/:id/problem-formulations/:version/confirm
   POST /api/v1/cases/:id/problem-formulations/:version/dispute
   POST /api/v1/cases/:id/problem-formulations/:version/corrections
   ```

   `PresentProblemFormulation`、`ReassessFromFormulation`、`StartAssessment` 三者均**不得**自行新增 public endpoint。
4. **Present 与 Create 不是两个 public 动作**：本 Slice 不引入 `CreateDraftProblemFormulation`（§23 无此命令）。候选的持久化与“展示”在同一事务内完成；`DRAFT` 作为正式词汇保留，但本 Slice 不产生可观察的 current `DRAFT`，也不提供 public DRAFT 编辑。
5. **谁提交 candidate**：服务端 Domain Command caller（未来 Assessment 完成流程 / AI 提出候选后的 Domain Policy 校验流程），且必须在**当前已验证用户 actor 的请求/事务上下文**执行。它不是 public client，也不是模型直接写库。
6. **candidate ≠ 正式确认**：`Present` 永不置 `CONFIRMED`、永不填 `confirmed_by`、永不进入 `GOALS`。
7. **未来 AI / Scene Engine 接入方式**：AI 只能产生 candidate 内容交给 Domain Service；Scene Engine 只能提供 `scene_fit` / Evidence 汇总；两者都必须经过本 Slice 的 Domain Command 校验，不得改变 Present / Confirm 的核心合同，也不得获得 Confirm 权。
8. **生产 caller DEFERRED**：本 Slice 明确不宣称 U06 端到端产品可用；Slice 8 当前交付后 **U06 尚不要求完整用户端 E2E 可用**，不得为了“现在就能点通”提前开发 Phase 2/3。Phase 2 / 3 接入 caller 时不得改变本 Spec 的输入、前置、状态与 phase 语义。本 Slice 的测试使用真实 Domain Command + 真实数据库事务，不使用直接 SQL 写入或测试 fixture 冒充入口。

**依据**：§23（Domain Commands 清单）、§28.3（public 契约面）、§12.4（候选由 Assessment 汇总 Evidence 生成，Domain Policy 校验后展示）、§7.2（DRAFT / PRESENTED 词汇）、§38（Phase 1 vs Phase 2/3 顺序）。

### C2 — RESOLVED（OWNER-APPROVED CLARIFICATION）：Dispute 与 Reassess 的分工

> **性质**：本条是 **OWNER-APPROVED CLARIFICATION**（OC-2），是基于现有权威 Docs（§2.5 / §6.7 / §7.2 / §23 / §28.3）做出的明确边界收口，不是 Docs 原文的逐字表述。

**结论**：

1. `DisputeProblemFormulation` 是**用户响应事实**：用户对当前 Presented Problem Formulation 明确不同意。它改变 formulation `status → DISPUTED`，记录 `user_response`；`Case.phase` **保持** `PROBLEM_FORMULATION`，**不得**自动进入 `ASSESSMENT`。
2. `ReassessFromFormulation` 是**独立 Domain Command**：只有它把 `phase` 从 `PROBLEM_FORMULATION` 变为 `ASSESSMENT`。它不修改 formulation 的 status / version / 内容，**并保留既有 Problem Formulation 历史**；不得删除旧版本或静默覆盖。
3. 用户“不同意但暂不重新 Assessment”是**合法**的：`DISPUTED` 可以真实存在，系统不得强制自动重评，也不得把 `DISPUTED` 当失败或当确认。
4. `DISPUTED` 与 `NEEDS_REVIEW` 的区别：
   - `DISPUTED` = 用户主动表达的响应事实；
   - `NEEDS_REVIEW` = 依赖失效（Evidence / Consent / Policy / Package）导致的系统级“当前判断不能继续作为有效依据”。
   二者都不得 `Confirm`，但产生原因、触发者与后续处理不同。
5. 哪个动作改变 status：`Present`（→`PRESENTED`）、`Confirm`（→`CONFIRMED`）、`Dispute`（→`DISPUTED`）、`Corrections`（旧→`SUPERSEDED`，新→`PRESENTED`）、依赖失效（→`NEEDS_REVIEW`，触发方 DEFERRED）。
6. 哪个动作改变 phase：只有 `Confirm`（→`GOALS`）与 `Reassess`（→`ASSESSMENT`）；`Present` 改变 phase（`ASSESSMENT → PROBLEM_FORMULATION`），但它不是“用户响应”动作。
7. 本 Slice **没有** `Reassess` 的 public 端点（§28.3 未列）；其 caller 为后续 Review / 用户重新评估路径，DEFERRED。

**依据**：§2.5（用户可纠正/补充/不同意/暂不确认）、§6.7（`Confirm` / `Reassess` 转换表）、§7.2（状态词汇）、§23（`DisputeProblemFormulation` 与 `ReassessFromFormulation` 分离）、§28.3（仅 dispute / corrections 公开）。

### C3 — RESOLVED：Current Version 的唯一性

**结论**：

1. 一个 Case 任一时刻**最多一个 current** formulation。
2. current 的定义是**版本链事实**：未被 `SUPERSEDED` 的那一版；不得由 `status = PRESENTED` 单独推导（`CONFIRMED` / `DISPUTED` / `NEEDS_REVIEW` 也可以是 current）。
3. `SUPERSEDED` 版本**永远不是 current**。
4. 新版本生效时，旧 current 必须原子变为 `SUPERSEDED`；不得出现两个未 `SUPERSEDED` 的版本。
5. 具体唯一性实现（部分唯一索引、版本链列、行锁）由 Plan 决定，但必须满足上述业务语义。

**依据**：§8.2（新版本成为 current / ACTIVE，旧版本保留 `SUPERSEDED`）、§29.1（Confirm 要求 version 仍是 current）、§28.3（`/current` 端点）。

### C4 — RESOLVED：Correction 语义

**结论**：

1. 已 `PRESENTED` / `CONFIRMED` / `DISPUTED` / `NEEDS_REVIEW` 后，任何**实质内容变更**必须**追加新 version**；不得原地编辑。
2. `DRAFT` 在理论上可编辑，但本 Slice **不提供** public 或独立 Domain Command 的 DRAFT 编辑入口；因此本 Slice 不存在“原地编辑”的可达业务路径。
3. 更正产生的新 version 必须是完整、可独立阅读的 formulation；旧 version 置 `SUPERSEDED`，内容永久保留。
4. 新 version `status = PRESENTED`；`confirmed_by` / `confirmed_at` **不继承**；必须重新 `Confirm` 才能进入 `GOALS`。
5. 一旦进入 `GOALS`（formulation 已 `CONFIRMED`），本 Slice **不允许**通过 corrections 端点修改已确认 formulation；该路径 DEFERRED 给 Goal / Review / 传播 Slice（见 §21.3）。
6. `Corrections` 不得把“对旧版本的补丁片段”当作新版本内容；必须保存完整版本。

**依据**：§8.2（追加版本 / supersedes，Correction 不是 UPDATE 掉历史）、§5 不变量 7（变更必须版本化并传播）、V1-C22 / V1-C32、§29.6（有实质变化时创建新版本并由适当主体重新确认）。

### C5 — RESOLVED：Dependency Invalidation 的本 Slice 边界

**结论**：

1. 本 Slice MUST 保存 `dependency_refs`（Evidence / Consent / Policy / Package / Content Version 引用）。
2. 本 Slice MUST 在 `Confirm` 前**实时校验** `evidence_refs` / `dependency_refs` 中本 Slice 可确定的部分：Evidence 未被 `SUPERSEDED`、未超出有效区间、属于同一 Case。
3. `NEEDS_REVIEW` 是正式状态，表示“依赖失效，当前判断不能继续作为有效依据”；本 Slice 定义其语义（不得 Confirm；允许 Correction 产生新版本并重新校验；不改变 phase）。
4. **触发方 DEFERRED**：Evidence 更正 / 来源失效 / Consent 撤回 / Policy-Package 停用 → 将受影响 formulation 置 `NEEDS_REVIEW` 的传播链，由拥有该源事实变更的后续 Slice 实现。本 Slice **不**修改 consent revoke 路由、**不**建通用 `artifact_dependencies` 图、**不**实现 Memory 失效重建、**不**无差别暂停整个家庭。
5. 本 Slice 允许 `NEEDS_REVIEW` 在语义上存在但无 public 触发路径；这与 Slice 3 对 `FACT` 的处理一致：语义与合同存在，可达业务路径由后续 Slice 明确接入。不得用测试 fixture 伪造一次真实传播。

**依据**：§7.10（依赖传播覆盖 formulation；事实更正 / Consent 撤回 / Policy 停用使受影响对象 `NEEDS_REVIEW`）、§29.5 / §29.6（完整传播合同）、Slice 3 的 correction / propagation 边界先例。

### C6 — RESOLVED（OWNER-APPROVED CLARIFICATION）：Phase Ownership

> **性质**：本条是 **OWNER-APPROVED CLARIFICATION**（OC-1 / OC-2），是基于现有权威 Docs（§6.7 / §23 / §38 / §28.3）做出的明确边界收口，不是 Docs 原文的逐字表述。

**结论**：

| Phase 转换 | Owner | 本 Slice |
|---|---|---|
| `INTAKE → ASSESSMENT` | `StartAssessment` | **实现（最小前置）** |
| `ASSESSMENT → PROBLEM_FORMULATION` | `PresentProblemFormulation` | **实现（内部）** |
| `PROBLEM_FORMULATION → GOALS` | `ConfirmProblemFormulation` | **实现（public）** |
| `PROBLEM_FORMULATION → ASSESSMENT` | `ReassessFromFormulation` | **实现（内部）** |
| `GOALS → PLANNING` | `ConfirmGoal` | 不实现（Goal Slice） |
| `PLANNING → EXECUTION` | `ActivatePlan` | 不实现 |
| `EXECUTION → REVIEW` | `OpenReview` | 不实现 |
| `REVIEW → ...` | `CompleteReview` | 不实现 |
| Safety 抢占 | `EnterSafetyHold` / `ResolveRisk` | 不实现（Safety Slice） |

- `StartAssessment` 之所以纳入：它是 `Present` 的直接前置，当前 main 完全没有 `ASSESSMENT` 入口；若不纳入，本 Slice 只能靠直接 SQL / fixture 构造前置，违反“不得用 fixture 冒充正式业务入口”。其 Phase 转换语义与 §6.7 转换表一致；其 Slice 8 范围（最小 Phase Bridge、禁止扩展到 Assessment questionnaire / Assessment table-model / Digital Use `A1001`—`A2010` / Scene runtime / AI / RAG / 新 public assessment flow）属 **OWNER-APPROVED CLARIFICATION（OC-1）**，不涉及任何 Assessment 内容。
- 本 Slice MUST NOT 实现 Goal、Plan、Scene routing、Assessment engine 或 Safety State Core。
- 生产 Assessment runtime / AI propose 接入属 Phase 2 / 3，DEFERRED；接入时不得改变本 Spec 的 phase 合同。

**依据**：§6.7（正常 Phase 转换合同）、§23（Domain Commands）、§38（Phase 1—6 顺序）、§28.3（已批准端点）。

### C7 — RESOLVED：无 formulation 时的读取语义

- 真实空态由 Case `phase` 与 current 查询共同表达；不得伪造默认 formulation。
- 具体 HTTP 表达（404 或显式空结果）由 Plan 在既有详情语义内决定，但必须同时满足：管理主体能区分“真实不存在”；跨 Family / 无权不泄露存在性。

### Clarify Closeout Checks（2026-11-11 文件级核验）

| Check | Result |
|---|---|
| Selection Gate | **PASS** |
| Open Product Decisions | **0** |
| Owner Clarifications | **CLOSED**（OC-1 `StartAssessment` / OC-2 `Dispute vs Reassess` / OC-3 API Surface） |
| Docs Modified | **NO**（四份核心 Docs 本轮 NO CHANGE） |
| Scope Expansion | **NO**（无 Assessment questionnaire / Assessment table-model / Digital Use `A1001`—`A2010` / Scene runtime / AI / RAG / 新 public assessment flow / 第五个 formulation 端点） |

### Open Product Decisions

**NONE。**  
**Residual blockers: NONE。**

---

## 21. Assumptions / Open Questions / Deferred Dependencies / Implement Gate

### 21.1 Assumptions（已由上游推导，不是新产品语义）

- **A-1**：`PresentProblemFormulation` 的生产 caller 属 Phase 2 / 3；本 Slice 只冻结 Domain Command 合同。这是 §38 顺序的直接结果，不是产品决策缺失。
- **A-2**：`Corrections` 的请求体结构与“旧内容 + 更正”的合并规则由 Plan 决定；但结果必须是一份完整、可独立阅读的新版本。
- **A-3**：错误码字面量与 HTTP 状态码由 Plan 在既有 `ERROR_MAP` 内决定；本 Spec 只固定语义类别（404 统一防泄露 / 409 状态冲突 / 422 校验失败）与必须复用的既有码（`SAFETY_HOLD_BLOCKED`、`CASE_CLOSED`、`IDEMPOTENCY_PAYLOAD_MISMATCH`）。
- **A-4**：事件 / 审计 metadata 的最小字段集由 Plan 决定；不得包含 formulation 正文、用户原话或敏感内容。
- **A-5**：`cases.version` 是否在“不改 phase 的 formulation 状态变更”中递增由 Plan 决定；不得引入对客户端暴露的第二套业务版本号。
- **A-6**：`StartAssessment` 的“至少一条可追溯问题陈述”按 Slice 3 语义落实为同一 Case 的 `dialogue_message` 或 `kind = STATEMENT` 的 `assertion`；Plan 可细化实现，但不得放宽 §6.7 的“至少一条可追溯问题陈述”。
- **A-7**：`WAITING` 不作为本 Slice 的额外阻断条件；本 Slice 只按 §6.7 列出的 primary / Safety 守门执行，不新增 WAITING 语义。
- **A-8**：本 Slice 不交付 UI；U06 的页面与服务端接入由后续 Slice 完成。

### 21.2 Open Questions

**NONE**（产品级）。

### 21.3 Deferred Dependencies（必须由后续 Slice 显式接入，不得在本 Slice 偷做）

1. **生产 `Present` caller**：Phase 2 Assessment 完成流程 / Phase 3 AI propose → Domain Policy → `PresentProblemFormulation`。
2. **`StartAssessment` 的产品入口**：§28.3 未列独立端点；若后续需要，必须在对应 Slice 显式设计，不得在本 Slice 偷加。
3. **`NEEDS_REVIEW` 触发链**：Evidence correction / Consent withdrawal / Policy / Package retire → 受影响 formulation `NEEDS_REVIEW`；由对应 Slice 实现。
4. **`GOALS` 阶段的 formulation 更正与 Goal 依赖传播**：由 Goal / Review / 传播 Slice 实现；本 Slice 拒绝该路径。
5. **Participant / 孩子端 formulation 可见性**：由 Participant / Visibility Slice 明确设计。
6. **历史版本对外读取 / 导出 / 删除**：由数据权利 Slice 实现。
7. **`ReassessFromFormulation` 的产品触发入口**：由 Review / 用户重新评估路径接入。
8. **Safety State Core**：由 Safety Slice 实现；本 Slice 只复用状态谓词。

### 21.4 Implement Gate

- Slice 1 / 2 / 3 / 4 / 5 / 7 已合入 `origin/main`（`e8add90`），本 Slice 的实现前置在依赖层面**已满足**。
- 实现开始前 Plan MUST 重新验证：
  1. `authorize()` 可安全增量扩展本 Slice 的 Case 动作；
  2. `withRlsTransaction` 与 RLS helper 可用；
  3. `cases.phase` 的受控写入可通过 reviewed migration 增量授权；
  4. `case_events` / `business_audit_events` / `idempotency_keys` 的 CHECK 词汇可增量扩展；
  5. `assertions` / `observations` / `dialogue_messages` 的读取 contract 可用于证据校验；
  6. CI 与数据库验证为 green。
- 若任一验证失败，MUST 停止并报告 BLOCKED / NOT VERIFIED；MUST NOT 在本 Slice 私建替代基础设施。

---

## 22. Success Criteria

- **SC-001**：`ASSESSMENT` 无法跳过 `PROBLEM_FORMULATION` 进入 `GOALS`；`GOALS` 只能由 current、`CONFIRMED`、依赖有效、primary、非 `SAFETY_HOLD` / `CLOSED` 的 formulation 进入。
- **SC-002**：一个 Case 任一时刻最多一个 current formulation；`SUPERSEDED` 版本永久保留且内容不变；并发下不出现两个 current。
- **SC-003**：`PRESENTED`、`CONFIRMED`、`DISPUTED`、`NEEDS_REVIEW`、`SUPERSEDED` 的转换全部机械可验证；`DISPUTED` 不改变 phase；`CONFIRMED` 是唯一进入 `GOALS` 的 formulation 状态。
- **SC-004**：`confirmed_by` 永远是真实用户；AI / 系统 principal 的确认请求 100% 被拒绝；不存在 AI 确认的持久事实。
- **SC-005**：`evidence_refs` 跨 Case / 跨 Family / 失效证据 100% 被拒绝；`UNKNOWN / NOT_COLLECTED / DECLINED / CONFLICT` 不被补成确定值；无来源的确定性判断被拒绝。
- **SC-006**：用户更正 100% 产生新 version；旧 version 内容字节级等价保留；新 version 不继承 `confirmed_by` / `confirmed_at`。
- **SC-007**：同一幂等键重放（含并发）不产生重复 version / 事件 / 审计；同 key 不同 payload 返回 409。
- **SC-008**：跨 Family、无权、无 RLS 上下文全部失败且不泄露；应用层与数据库层双层证据成立。
- **SC-009**：结构 / 路由枚举证明不存在 `assessments` / `scene_*` / `goals` / `plans` / `tasks` / `reviews` / `risk_events` / `artifact_dependencies`，也不存在第五个 formulation 端点。
- **SC-010**：每次成功写命令在同一事务内产生业务写入、事件、审计与幂等快照；任一步失败整体回滚。
- **SC-011**：非 primary Case 的所有 formulation 写命令被拒绝；读取仍返回真实历史数据。
- **SC-012**：`SAFETY_HOLD` / `CLOSED` 阻断普通推进；本 Slice 不实现 Safety State Core，也不自动解除 Safety。
- **SC-013**：本 Slice 不修改 `Docs/**`、不改写既有 Slice 合同、不新增 UI / 通知 / AI / Scene / Goal / Plan 能力。