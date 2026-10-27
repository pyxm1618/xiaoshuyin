# 小树荫 V1 技术设计

> 文档性质：**V1 具体实现设计**
>
> 版本：v2.0 — 对齐 04 canonical V1  
> 更新日期：2026-10-27
>
> 唯一产品需求依据：
> - [04-v1-product-requirements.md](04-v1-product-requirements.md)
>
> 总体技术架构依据：
> - [05-system-architecture.md](05-system-architecture.md)
>
> **本文只实现 V1。V2—V5 的能力即使已在总体架构中预留，也不在本文提前开发。**
>
> **04 是 V1 唯一产品事实源。本文不得重新解释、压缩或替换 04 的 V1-C01—C37、V1-D00—D43、V1-X01—X14、U01—U20 或 Digital Use A1001—A5002。发生冲突时先修订本文，不能在代码里静默选择 06。**

---


## 1. V1 实现目标

V1 要交付的不是“一个通用 AI 咨询框架”，而是：

> **在三层产品结构上完整实现 04 的第一个真实纵向切片：Common Problem-Solving Core + Digital Use Scene + Production Foundation。**

家庭用户通过现有微信小程序“小树英助手”发起儿童青少年数字使用问题，在安全、授权、专业规则和真实数据约束下，完整走过：

~~~text
INTAKE
→ ASSESSMENT
→ PROBLEM_FORMULATION
→ GOALS
→ PLANNING
→ EXECUTION
→ REVIEW
→ MAINTENANCE
→ CLOSED
~~~

Digital Use Scene 不是抽象的 “assessment → plan”。V1 必须忠实实现 04 第二层的 canonical flow：

~~~text
A1001 / 01002 / 01003
→ A2001 / A2002 / 01005 / 01006 / 01004 / 01000
→ A2003—A2010
→ 两条可并行主线
   ① A3000—A3113：家庭手机使用联盟 / 目标清单
   ② A4001—A4012：手机使用合约
→ A5001：家庭联盟 / 目标清单效果评估
→ A5002：手机使用合约效果评估
~~~

其中原文节点编号、前置条件、分支、用户输入、输出、记录、并行关系、时间线和帮助入口均由 04 决定。技术层只负责可靠承载，不得重新编排。

V1 同时必须支持：

- Problem Formulation 作为 Goal 前的正式业务对象和正式阶段；
- Intervention 作为 Scene 的一等专业资产，不由模型临时发明；
- 家庭联盟与手机合约两条主线按 04 并行推进；
- 目标清单、逐目标可行性、任务进度、帮助；
- 手机合约模板、4 个示范、A4003 角色扮演、合约草案/正式版本/更新、FAQ；
- 孩子按需有限参与；
- 不同来源陈述分开；
- 长期家庭档案；
- 授权和撤回；
- 安全中断；
- 正确转介；
- 模型失败；
- 长期任务和主动返回；
- 真实通知能力与 UNKNOWN；
- 并发和重复提交；
- 查看、更正、导出、删除与备份恢复后的删除重放；
- Maintenance、Closure、Recurrence。

V1 不实现：

- 完整家庭私人空间；
- 多个主要问题并行推进；
- 第二个完整专业 Scene；
- 相似案例推荐；
- 风险预测模型；
- 语音/录音输入、ASR 及实时语音；
- 实时家庭调停；
- 支付；
- 机构平台。

**完成定义：**

> 只有 04 的 U01—U20、V1-C / V1-D / V1-X，以及 Digital Use A1001—A5002 在真实微信端、真实后端、真实权限、真实计划执行和真实 Review 中闭环，V1 才算实现。

## 2. V1 最终技术栈

| 层 | V1 决定 |
|---|---|
| 用户端 | 原生微信小程序 TypeScript / WXML / WXSS |
| 运营端 | React + Vite |
| 服务端 | TypeScript / Node.js（V1 baseline >= 22.12）+ Fastify |
| AI 编排 | LangGraph JS |
| LangGraph 持久化 | 官方 PostgreSQL Checkpointer（@langchain/langgraph-checkpoint-postgres / PostgresSaver） |
| 模型调用 | 自研 Model Gateway + Vercel AI SDK Core |
| 数据库 | 阿里云 RDS PostgreSQL |
| 向量 | pgvector |
| 中文检索 | pg_jieba + 小树荫专业词典 |
| RAG | Hybrid Search + RRF + Reranker |
| Embedding 基线 | text-embedding-v4 / 1024 |
| Reranker 基线 | qwen3-rerank |
| 模型 | Qwen / MiMo / DeepSeek 候选池，经 Xiaoshuyin Eval 选择任务映射 |
| 长期记忆 | 自研 Family Memory Layer |
| 专业规则 | TypeScript Domain Policy |
| 长期计划 | PostgreSQL case_followup_schedules |
| 异步执行 | pg-boss |
| AI Trace / Eval | Phoenix Self-hosted |
| 外部通知 | Notification Adapter + 微信实际可用通知能力 |
| 部署形态 | 模块化单体，API 与 Worker 两类进程 |

---


## 3. 代码组织

推荐：

~~~text
apps/
  miniprogram/            微信小程序
  operations/             V1 最小内部运营端
  server/
    api/                   Fastify API
    worker/                pg-boss / 后台 Worker

packages/
  contracts/              API Schema / Zod / 共享类型
  domain/                 Case / Formulation / Goal / Plan / Commands / 不变量
  authorization/          Authorization / Consent
  safety/                 Safety Policy / Risk State
  scenes/
    digital-use/
      evidence.ts
      eligibility.ts
      exclusions.ts
      assessment.ts
      formulation.ts
      goals.ts
      node-registry.ts     A/010xx 节点与原始 source_node_code
      routing.ts           原流程分支和并行关系
      interventions/
        family-alliance.ts
        target-list.ts
        communication.ts
        phone-use-contract.ts
        execution-support.ts
      plan.ts
      follow-up.ts
      review.ts
      maintenance.ts
      closure.ts
      safety.ts
      schemas/
        assessment.ts
        target-list.ts
        contract.ts
        roleplay.ts
        reviews.ts
  ai/
    graph/                 LangGraph
    context/               Context Builder
    gateway/               Model Gateway
    providers/             AI SDK provider 配置
    schemas/               Decision / Response Schema
  memory/                 Family Memory / provenance / rebuild
  rag/                    chunk / pg_jieba / pgvector / RRF / rerank
  notifications/          Notification Adapter
  integrations/           微信、模型、对象存储等
  observability/          Phoenix / metrics / audit hooks

db/
  migrations/

tests/
  domain/
  scenes/digital-use/
  integration/
  e2e/
  ai-eval/
~~~

约束：

- 不为每个 A/010xx 节点建立微服务；
- 不把每个节点都变成 LangGraph Node；
- 不把原手机流程硬编码进 Common Core；
- 节点路由属于 Digital Use Scene Package；通用生命周期与事实合同属于 Common Core；
- 不为 V2 场景提前建第二套实现。

## 4. 部署形态

V1 采用：

```text
微信小程序
    ↓
HTTPS
    ↓
Fastify API
    ↓
RDS PostgreSQL
    ↓
LangGraph / Domain Services

Worker
    ↓
pg-boss
    ↓
AI / Memory / Eval / Notification Jobs
```

API 与 Worker 可以先运行在同一台云服务器的不同进程/容器中。

数据库使用托管 RDS。

Phoenix 单独自托管，但：

> 不保存完整家庭正文作为长期观测数据。

### 4.1 Runtime baseline

V1 服务端运行环境必须满足所有选定生产依赖的最低要求。

本版基线：

~~~text
Node.js >= 22.12
~~~

实际部署固定到受支持的 Node.js LTS 小版本，并在 CI / container image / production 中保持一致；不能出现开发环境 Node 版本高于生产、或使用低于 pg-boss 支持下限的运行时。

### 4.2 PostgreSQL extension bootstrap / readiness

V1 依赖的数据库能力不是“代码里引用包名就算具备”。环境启动前必须做 readiness：

1. 目标 RDS PostgreSQL 版本和实例规格已确认；
2. pgvector 可用并成功创建；
3. pg_jieba 可用；
4. RDS 参数组已按该扩展要求配置 shared_preload_libraries；
5. 参数变更需要重启时，重启后再次验证；
6. migration/readiness 实际执行 CREATE EXTENSION 或等价受管操作；
7. 专业词典初始化/版本记录完成；
8. API / Worker 在上述 readiness 未通过时不得把 RAG 标记为 READY。

至少记录：

~~~text
postgres_version
extension_name
extension_version
readiness_status
checked_at
evidence_ref
~~~

开发、Staging、Production 使用同一套 readiness contract；不能只在本地“能跑”就推断 RDS 已支持。

---


## 5. 领域不变量

实现必须保证：

1. Account、Person、Family、CaseParticipant 分开。
2. 一个家庭最多一个当前主要未结 Case 执行主线；其他候选 Case/问题可保留。
3. Statement、Observation、Fact、Hypothesis 分开，均保留来源、发生时间、记录时间、确认/冲突/有效性。
4. 家长转述不能自动升级为孩子本人事实。
5. KNOWN / UNKNOWN / NOT_COLLECTED / DECLINED / N/A / CONFLICTING / EXPIRED 等真实状态不能被补成确定值。
6. ASSESSMENT 之后必须进入 PROBLEM_FORMULATION；未经 Problem Formulation 不得直接 Confirm Goal。
7. Problem Formulation 必须可纠正、补充、不同意、暂不确认；变更必须版本化并传播到依赖对象。
8. Intervention 是 Scene 的一等专业资产；模型只能在已发布、适用的 Intervention 中提出候选组合。
9. Digital Use 的两条主线和 A1001—A5002 路由由 04 决定；Common Core 和 LangGraph 不得重排。
10. AI 没有业务事实、Consent、Problem Formulation 确认、Goal 确认、Plan 激活、Contract 双方确认、Closure 或解除 Safety 的最终写权限。
11. Plan 激活必须经过 Domain Policy、依赖检查、Safety 和有权用户确认。
12. Safety Hold 优先于普通流程。
13. Outcome、Closure Reason、Referral Status 分开。
14. Follow-up Schedule 是业务真相，pg-boss Job 不是。
15. Consent 撤回必须影响后续模型、检索、通知、派生 Memory 和依赖它的 Formulation / Goal / Plan / Task。
16. 派生 Memory 必须能追到原始来源。
17. 重复提交、Worker retry 和并发不能产生重复业务结果。
18. LangGraph checkpoint 不能覆盖当前业务事实。
19. 只有当前 primary Case 可以进入/恢复普通执行、激活新 Plan 或创建普通 Follow-up Schedule。
20. SAFETY_HOLD 不能被普通暂停、主线切换或恢复命令覆盖。
21. 通知 SENT 不等于 DELIVERED，更不等于执行或改善。
22. A5001 与 A5002 必须保留两个 review scope，不能在数据层合并成无法区分的泛化 Review。
23. 手机合约版本不得原地覆盖；A4012 必须生成新版本并保留 supersedes 链。
24. A4003 角色扮演输出是练习/参考 Artifact，不得被写成孩子本人意见。
25. 原始专业内容即使存在争议，也不能由开发者或模型静默改写；生产是否启用由已审核的 Policy / Knowledge Version 决定。
26. 任何模型供应商都不能成为不可替换的领域依赖。


## 6. 业务状态

### 6.1 Case Status

~~~text
OPEN
WAITING
PAUSED
LOST_CONTACT
SAFETY_HOLD
CLOSED
~~~

### 6.2 Phase

必须与 04 完全一致：

~~~text
INTAKE
ASSESSMENT
PROBLEM_FORMULATION
GOALS
PLANNING
EXECUTION
REVIEW
MAINTENANCE
CLOSED
~~~

Phase 表示正常问题解决进行到哪里；Case Status 表示当前服务是否可推进。二者分开存储。

例如：

~~~text
status = PAUSED
phase  = EXECUTION
~~~

表示“原来在执行阶段，但服务当前暂停”。

### 6.3 Outcome

~~~text
IMPROVED
NO_CHANGE
WORSENED
UNKNOWN
~~~

### 6.4 Closure Reason

~~~text
STABLE_IMPROVEMENT
NO_INTERVENTION_NEEDED
USER_WITHDREW
OUT_OF_SCOPE
EXTERNAL_HANDOFF_COMPLETE
~~~

### 6.5 Referral

~~~text
PROPOSED
ACCEPTED
CONTACTED
CONNECTED
DECLINED
UNREACHABLE
~~~

Case Status、Phase、Outcome、Closure、Referral：

> 分开存储，不能互相推导。

### 6.6 Case Status 转换合同

所有状态变更必须通过 Domain Command；模型只能提出候选动作。

| 当前状态 | 命令或事件 | 必需条件 | 目标状态 | 关键副作用 |
|---|---|---|---|---|
| OPEN | WaitForInformation | 必要 blocker 非空 | WAITING | 保留原 phase；停止不适用推进 |
| WAITING | ResumeAfterInformation | blocker 实际清除，重新检查 Authorization / Safety / Package | OPEN | 回到原 phase；重新计算有效 schedule |
| OPEN/WAITING | PauseCase | 有权用户明确请求或交付条件要求 | PAUSED | 暂停普通未来 schedule |
| PAUSED | ResumeCase | primary、授权、Safety、Policy、Plan 均重新有效 | OPEN/WAITING | 不补发过期提醒 |
| OPEN/WAITING | MarkLostContact | 至少两个约定反馈节点无反馈 + 至少一次真实授权联系尝试 | LOST_CONTACT | 停止普通自动联系；保留主动返回 |
| LOST_CONTACT | UserReturned | 新输入已保存并重新 Safety / Consent 校验 | OPEN/WAITING | 创建新的有效 schedule |
| 任意未关闭 | EnterSafetyHold | Safety Policy 命中 | SAFETY_HOLD | 抑制普通生成、任务推进和提醒 |
| SAFETY_HOLD | ResolveRisk | 规定复核证据和有权角色完成 | WAITING | 不自动恢复旧任务 |
| 允许关闭状态 | CloseCase(...) | 对应 Closure 合同满足 | CLOSED | phase 同时置 CLOSED；取消未来普通 schedule |
| CLOSED | CreateRecurrence | 用户发起复发/新一轮且重新检查授权 | 新关联 Case | 旧 Case 保持不可变历史 |

LOST_CONTACT 不能由“一次不回复”“通知失败”“用户没有通知授权”推断。

Referral 独立流转：

~~~text
PROPOSED --用户接受--> ACCEPTED
ACCEPTED --真实联系尝试--> CONTACTED
CONTACTED --有实际衔接证据--> CONNECTED
任意阶段 --用户拒绝--> DECLINED
CONTACTED --真实合规尝试仍失败--> UNREACHABLE
~~~

点击链接、发送通知、创建工单均不能直接升级为 CONNECTED。

### 6.7 正常 Phase 转换合同

| 当前 Phase | 命令 | 核心前置条件 | 目标 Phase |
|---|---|---|---|
| INTAKE | StartAssessment | primary；必要授权；至少一条可追溯问题陈述；Safety 未阻断 | ASSESSMENT |
| ASSESSMENT | PresentProblemFormulation | Assessment 已达到当前可形成判断的最小证据；冲突/未知明确 | PROBLEM_FORMULATION |
| PROBLEM_FORMULATION | ConfirmProblemFormulation | 用户已看到 formulation；可纠正/补充/不同意；必要信息足够；scene fit 仍成立 | GOALS |
| PROBLEM_FORMULATION | ReassessFromFormulation | 用户纠正、冲突或替代解释要求重新判断 | ASSESSMENT |
| GOALS | ConfirmGoal | Goal 合同完整；Safety 未阻断 | PLANNING |
| PLANNING | ActivatePlan | Formulation / Goal / Intervention / Plan 依赖有效；家长确认 | EXECUTION |
| EXECUTION | OpenReview | 到达 review 节点或主动触发；允许 UNKNOWN | REVIEW |
| REVIEW | CompleteReview(CONTINUE) | Review 完整且不需改 Plan | EXECUTION |
| REVIEW | CompleteReview(ADJUST_PLAN) | 实质调整有依据 | PLANNING |
| REVIEW | CompleteReview(REASSESS) | 主要问题理解出现实质变化 | ASSESSMENT |
| REVIEW | EnterMaintenance | 改善趋势和保护条件支持低强度观察 | MAINTENANCE |
| MAINTENANCE | MaintenanceReview(CONTINUE) | 维护条件仍满足 | MAINTENANCE |
| MAINTENANCE | MaintenanceReview(RELAPSE_OR_WORSEN) | 复发/恶化/保护条件失效 | ASSESSMENT 或 PLANNING，由 Policy 决定 |
| MAINTENANCE | CloseCase(STABLE_IMPROVEMENT) | 稳定改善证据、观察窗口、保护条件、用户确认 | CLOSED |

统一规则：

- 从 ASSESSMENT 到 GOALS **不得跳过 PROBLEM_FORMULATION**；
- UNKNOWN、WORSENED 或保护条件恶化不能直接进入 MAINTENANCE / STABLE_IMPROVEMENT；
- WAITING 保存原 phase；恢复后回到原 phase；
- Phase 变化与对应 schedule / outbox 变更位于同一业务事务边界；
- primary 与 Safety 统一守门适用于 Resume、Confirm Formulation、Confirm Goal、Activate Plan、Review 后继续推进；
- Digital Use 内部 A/010xx 节点推进不等同于全局 Phase；节点路由由 Scene Package 管理。


## 7. V1 数据模型

V1 只物理建设真正需要的表。A/010xx 是 Scene Node，不按“一个节点一张表”设计。

### 7.1 身份与授权

~~~text
accounts
persons
families
family_members
consent_records
case_participants
staff_assignments
~~~

### 7.2 Case、证据与 Problem Formulation

~~~text
cases
case_events
dialogue_messages
assertions
observations
problem_formulations
scene_node_states
scene_artifacts
~~~

assertions 至少表达：

~~~text
kind: STATEMENT / FACT / HYPOTHESIS
source_kind
subject_person_id
source_person_id
source_message_id
occurred_at
recorded_at
valid_from
valid_until
confirmation_status
supersedes_id
conflict_group_id
~~~

problem_formulations 至少表达：

~~~text
case_id
version
status              DRAFT / PRESENTED / CONFIRMED / DISPUTED / NEEDS_REVIEW / SUPERSEDED
primary_problem
key_factors
evidence_refs[]
unknowns[]
conflicts[]
scene_fit
alternative_explanations[]
reassessment_conditions[]
exit_conditions[]
user_response
confirmed_by?
confirmed_at?
dependency_refs[]
~~~

scene_node_states 用来忠实承载 04 的 A/010xx 流程：

~~~text
case_id
scene_package_version
node_code            // 内部规范化字符串，例如 A2010；必须保留前导 0 的 01002
source_node_code     // 原文显示值，例如 "A 2010"
status               LOCKED / AVAILABLE / IN_PROGRESS / COMPLETED / SKIPPED / BLOCKED
branch_reason_codes[]
input_refs[]
output_refs[]
entered_at
completed_at?
revision
~~~

只允许做字符层面的编号规范化（如去除 A 与数字之间的空格）；**不得重编号、合并或修正原业务节点**。例如原文存在的 A3033 仍按原编号保留。

scene_artifacts 用于保存不是核心事实表、但 04 明确要求用户可查看/保存/回到的场景产物，例如：

- A2007 时间线；
- A2010 方案总结文档；
- A3000 家庭联盟自评；
- A4004 工具选择；
- A4005 笔记；
- A4006 日志；
- A4009 家长自我调节清单；
- A4010 可查看的合约文档。

至少保存 artifact_type、schema_version、source_node_code、content/data、owner/visibility、source_refs、created_at；不得只存在于聊天文本里。

### 7.3 Goal、Intervention、Plan 与执行

~~~text
goals
intervention_instances
plan_versions
tasks
checkins
reviews
outcomes
artifact_dependencies
~~~

InterventionInstance 至少表达：

~~~text
case_id
scene_id
intervention_code
stream_code
scene_package_version
intervention_definition_id
intervention_definition_version
rationale
eligibility_result
status               PROPOSED / SELECTED / ACTIVE / PAUSED / COMPLETED / DECLINED / SUPERSEDED
dependency_refs[]
~~~

Digital Use 的两个 stream_code：

~~~text
FAMILY_ALLIANCE       // A3000—A3113
PHONE_USE_CONTRACT    // A4001—A4012
~~~

target-list、communication、execution-support 是对应 stream 内的专业 Intervention/Component，不得被错误实现成与两条主线平级的第三条强制流程。

Goal 至少包含：

~~~text
case_id
problem_formulation_version_id
baseline_refs[]
target_description
observation_method
observation_window
protective_conditions[]
parent_actions[]
participant_evidence[]
review_point
confirmation_actor
confirmation_at
dependency_refs[]
~~~

PlanVersion 至少包含：

~~~text
case_id
problem_formulation_version_id
goal_id / goal_version
intervention_instance_ids[]
rationale
tasks[]
followup_policy
review_conditions
adjust_conditions
pause_conditions
safety_conditions
plan_format          ACTION_PLAN / FAMILY_AGREEMENT
dependency_refs
validation_result
parent_confirmation
status               DRAFT / PENDING_CONFIRMATION / ACTIVE / SUPERSEDED / PAUSED
~~~

Plan 必须能解释“为什么是这些 Intervention”，不能只有任务列表。

Task 至少包含：

~~~text
plan_version_id
owner_person_id
action
trigger_or_cadence
required_collaborators[]
observation_method
support_or_barrier_plan
state
due_at?
dependency_refs[]
~~~

Task state：

~~~text
PENDING
IN_PROGRESS
PARTIAL
COMPLETED
NOT_EXECUTED
PAUSED
CANCELLED
NEEDS_REVIEW
~~~

Checkin 至少包含：

~~~text
client_submission_id
plan_version_id
task_id?
scene_node_code?
submitted_by
execution_state
barriers
observed_changes
new_concerns
source_refs
submitted_at
~~~

没有反馈保持 UNKNOWN。

Review 至少包含：

~~~text
case_id
plan_version_id?
review_scope
baseline_refs
checkin_refs
protective_condition_observations
benefit_observations
adverse_observations
outcome_candidate
uncertainty
next_action
reviewer_source
~~~

Digital Use 必须支持两个独立 review_scope：

~~~text
FAMILY_ALLIANCE_TARGET_LIST   // A5001
PHONE_USE_CONTRACT            // A5002
~~~

可以另有 CASE_OVERALL 用于 Common Core 总复盘，但不得用它吞掉 A5001/A5002。

### 7.4 Digital Use 专属结构化 Artifact

只为 04 明确要求且需要版本/协作语义的对象建结构化存储：

~~~text
digital_use_target_items
digital_use_contract_versions
roleplay_sessions
roleplay_turns
~~~

digital_use_target_items 承载 A3002 与 A3010—A3113：

~~~text
case_id
target_code
selected
goal_text
feasibility_payload
task_refs[]
progress_state
help_history_refs[]
revision
~~~

target_code 使用 04 原始目标体系；可行性 payload 至少保留：

- 具体化 / 量化；
- 需求；
- 动机 / 获益；
- 能力 / 可能性；
- 挑战 / 阻力。

digital_use_contract_versions 承载 A4002、A4005—A4012：

~~~text
case_id
version
status              DRAFT / PENDING_CONFIRMATION / ACTIVE / SUPERSEDED / PAUSED
parties
purpose
phone_use_rules
execution_period
parent_support_measures
supervision_measures
incentives
breach_responsibilities
source_template_version
parent_confirmation
child_confirmation? // 仅有真实本人来源时存在
supersedes_id?
dependency_refs[]
~~~

规则：

- A4010 激活正式合约版本；A4012 创建新版本，不原地覆盖；
- 家长不能替孩子制造“孩子已确认”的事实；
- 原附件 4 个示范属于 versioned professional example assets，不写进家庭事实；
- FAQ 属于专业内容 / support policy，不复制成家庭事实。

roleplay_sessions / roleplay_turns 承载 A4003。至少记录 session、每轮输入/输出、用户评分、selected_result、使用的 professional/prompt version。角色扮演中用户扮演孩子、AI 扮演家长；输出必须标记为 SIMULATION，不得进入孩子本人 Statement。

### 7.5 专业内容

~~~text
scenario_packages
knowledge_items
policy_versions
knowledge_embeddings
professional_examples
intervention_definitions
~~~

`intervention_definitions` 是 04 §2.7A Psychological / Behavioral Intervention Contract 的机器可执行版本。至少表达：

~~~text
id
scene_id
intervention_code
version
target_problem_or_mechanism
formulation_dependencies[]
supporting_evidence_requirements[]
applicable_conditions[]
exclusion_or_contraindication_conditions[]
age_and_development_scope
rationale
intervention_steps[]
participation_and_consent_requirements[]
baseline_and_observation
expected_observable_change[]
burden_and_barriers[]
adverse_or_worsening_signals[]
review_window_and_criteria
stop_reassess_safety_referral_conditions[]
allowed_combinations[]
conflicting_interventions[]
professional_source_refs[]
review_status
reviewed_by_role
reviewed_at
published_at?
retired_at?
~~~

规则：

- `intervention_instances` 必须绑定具体 `intervention_definition_id + version`，不能只保存一个自由文本 `intervention_code`；
- 只有当前允许的 `PUBLISHED / APPROVED` 定义可以创建新的正式 InterventionInstance 或进入新 Plan；
- 定义退役不改写历史 Plan，但如果退役原因影响当前安全/适用性，依赖传播必须使受影响的 ACTIVE Plan / Intervention 进入 `NEEDS_REVIEW`；
- Digital Use 中内在动机、情绪调节、睡眠/作息、时间管理/拖延、家庭关系、家长一致性、激励/监督、家长自我调节等，只要进入正式 Plan，都必须有对应定义；
- “CBT / MI / 行为激活 / 家庭干预”等名称本身不能代替具体机制、步骤、边界和复盘标准。

scenario_packages 发布版本必须能锁定：

- node registry；
- routing rules；
- assessment / formulation / goal / intervention / plan / review / maintenance / closure / safety policies；
- Psychological / Behavioral Intervention Contract definitions 及其批准版本；
- contract template schema；
- contract examples；
- FAQ/support content；
- knowledge version set；
- intervention definition version set。

### 7.6 长期 Memory

~~~text
derived_memories
memory_source_links
~~~

Memory 不能成为唯一事实源；Correction / Consent 变化必须使受影响派生内容失效并重建。

### 7.7 安全与转介

~~~text
risk_events
referrals
support_resources
~~~

### 7.8 长期运行

~~~text
case_followup_schedules
notifications
notification_attempts
outbox_events
~~~

pg-boss 使用自己的数据库表，不再自研第二套 Job Lease 系统。

### 7.9 AI、质量与试点计量

~~~text
ai_runs
model_routing_versions
business_audit_events
data_requests
cost_ledger_entries
trial_report_snapshots
~~~

cost_ledger_entries 至少表达 MODEL / CLOUD / NOTIFICATION / HUMAN，无法确认时 cost_status=UNKNOWN，不能补 0。

trial_report_snapshots 只保存可重建统计投影，不复制新的家庭正文。

Phoenix 管 Trace / Eval，不作为业务事实表。

### 7.10 依赖传播

artifact_dependencies 至少覆盖：

- Problem Formulation；
- Goal；
- InterventionInstance；
- PlanVersion；
- Task；
- Digital Use Contract Version；

其依赖来源包括：

- assertion / observation；
- consent purpose/version；
- policy version；
- package version；
- professional content version。

事实更正、来源失效、Consent 撤回、Policy/Package 停用后，只使真实受影响对象进入 NEEDS_REVIEW / invalidate，不无差别暂停整个家庭。

## 8. 数据库关键约束

### 8.1 单一主要 Case

数据库保证：

> 一个家庭最多一个当前主要未结 Case 执行主线。

不能只靠前端或 LangGraph。

### 8.2 Formulation / Plan / Contract 不可原地覆盖

以下对象采用追加版本或 supersedes 关系：

~~~text
problem_formulations
plan_versions
digital_use_contract_versions
~~~

正式新版本生效后：

- 新版本成为 current / ACTIVE；
- 旧版本保留为 SUPERSEDED；
- Audit 和 dependency_refs 继续可追溯。

Correction 不是 UPDATE 掉历史。

### 8.3 Scene Node 唯一性与重放

同一：

~~~text
case_id
+ scene_package_version
+ node_code
~~~

只有一个当前 scene_node_state 聚合。

节点提交通过 client_submission_id / command idempotency 防止重复产生两份业务输出；允许保存多次 attempt / event，但 current state 必须确定。

### 8.4 A5001 / A5002 Review Scope

数据库约束 review_scope 为受控枚举；Digital Use 完整流程至少要求：

~~~text
FAMILY_ALLIANCE_TARGET_LIST
PHONE_USE_CONTRACT
CASE_OVERALL
~~~

A5001 / A5002 不得因唯一键或“每 Case 只有一个 Review”设计互相覆盖。

### 8.5 幂等

关键命令使用：

~~~text
actor_id
+
command_type
+
idempotency_key
~~~

重复相同请求返回原结果；同 key 不同 payload 返回 409。

### 8.6 乐观锁

Case / ProblemFormulation / Plan / Contract 等关键聚合使用 version。

高影响修改要求客户端携带 expected version / If-Match；旧版本请求不能覆盖新状态。

---
## 9. Authorization & Consent

每次读写统一调用：

```text
authorize({
  actor,
  product,
  family,
  case,
  resource,
  action,
  purpose
})
```

权限检查至少同时考虑：

- 当前身份；
- 家庭关系；
- Case 参与关系；
- 数据可见范围；
- Consent；
- Purpose；
- staff assignment；
- Safety 规则。

客户端传入的：

`family_id`、`case_id`

只能作为：

> 待验证参数。

不能因为 ID 存在就允许访问。

---

## 10. V1 的孩子参与

孩子参与采用有限 Case Participant。

流程：

```text
家长创建邀请
→ 孩子微信登录
→ 查看本次参与说明
→ 接受 / 拒绝
→ 必要绑定确认
→ 获得当前 Case 的有限权限
```

孩子只读：

- 本人提交；
- 明确共享方案片段；
- 本人任务；
- 明确允许的共同内容。

不能读取：

- 家长私人原话；
- 其他家庭成员私人信息；
- 无授权历史 Case。

---

## 11. Purpose-Bound Derived Context

如果孩子授权：

> AI 可以使用某些信息优化共同计划，但不能向家长暴露原文/来源。

则建立派生记录：

```text
derived_memory
source_person
source_ids
purpose
allowed_audience
allowed_use
forbidden_use
consent_version
validity
```

家长侧 Context Builder 只能取得：

> 当前 Purpose 允许的派生内容。

如果 Consent 被撤回：

> 对应派生内容立即失效。

---


## 12. Domain Policy 与 Digital Use Scene 实现

### 12.1 Scene Package 结构

V1 Digital Use 必须按 05 和 04 组织为：

~~~text
packages/scenes/digital-use/
  evidence.ts
  eligibility.ts
  exclusions.ts
  assessment.ts
  formulation.ts
  goals.ts
  node-registry.ts
  routing.ts
  interventions/
    family-alliance.ts
    target-list.ts
    communication.ts
    phone-use-contract.ts
    execution-support.ts
  plan.ts
  follow-up.ts
  review.ts
  maintenance.ts
  closure.ts
  safety.ts
  schemas/
~~~

每个 Policy/专业资产必须：

- 版本化；
- 可测试；
- 可发布/停用；
- 不依赖自由模型输出才能生效；
- 能返回 missing evidence / blockers / allowed actions / reason codes；
- 能追溯到审核版本。

### 12.2 Node Registry：忠实保存 A1001—A5002

node-registry.ts 是 04 原始流程的技术索引，不是新的产品设计。

每个节点至少定义：

~~~ts
type SceneNodeSpec = {
  nodeCode: string
  sourceNodeCode: string
  phase: CasePhase
  stream?: "FAMILY_ALLIANCE" | "PHONE_USE_CONTRACT"
  prerequisites: NodePredicate[]
  inputSchema?: SchemaRef
  outputSchema?: SchemaRef
  allowedNext: string[]
  canRunInParallelWith?: string[]
  recordContract: RecordContract
  policyRefs: string[]
}
~~~

必须覆盖 04 中实际存在的：

- A1001、01002、01003；
- A2001、A1000、A2002、01005、01006、01004、01000；
- A2003、A2004、A2005、A2006、A2007、A2008、A2009、A2010；
- A3000、A3001、A3002；
- A3010—A3113 中 04 实际列出的所有节点编号；
- A4001—A4012；
- A5001、A5002。

不得用范围循环凭空生成原文不存在的编号；以 04 的实际 node registry 为准。

#### 12.2A Checked-in Full Node Manifest

仅在文档里写“A3010—A3113 实际节点”不足以作为开发交付。V1 必须有一个完整、逐节点、机器可验证的 Manifest：

~~~text
packages/scenes/digital-use/node-manifest.ts
~~~

同时维护一个用于 CI / Review 的规范化快照：

~~~text
tests/fixtures/digital-use/04-node-manifest.snapshot.json
~~~

04 第二层 canonical flow 仍是业务事实源；snapshot 是其机器可验证投影，不成为第二套产品需求。更新 04 节点、分支、记录或并行语义时，必须在同一 PR 中显式更新 Manifest / snapshot，并让差异可审阅。

Manifest **必须逐条列出实际节点**，不得使用 `A301x`、`A30xx`、区间循环或运行时猜测代替完整清单。每条至少包含：

~~~ts
type DigitalUseNodeManifestEntry = {
  nodeCode: string
  sourceNodeCode: string
  phase: CasePhase
  stream?: "FAMILY_ALLIANCE" | "PHONE_USE_CONTRACT"
  prerequisites: NodePredicate[]
  inputSchema?: SchemaRef
  userDecisionSchema?: SchemaRef
  interactionSpecRef?: string
  outputSchema?: SchemaRef
  recordContract: RecordContract
  allowedNext: Array<{ nodeCode: string; reasonCode: string }>
  canRunInParallelWith: string[]
  entryMode: Array<"ROUTED" | "USER_INITIATED" | "SCHEDULED">
  helpOrReentryRefs: string[]
  policyRefs: string[]
}
~~~

CI 至少执行：

1. **completeness**：04 snapshot 中每个 A/010xx 节点恰好存在一次，Manifest 不缺、不多；
2. **source-code fidelity**：`sourceNodeCode` 保留原编号，前导 0 不丢失，规范化映射可逆；
3. **field fidelity**：前置条件、输入/判断、输出、记录、时间/主动进入/帮助语义均有结构化承载或明确 spec ref；
4. **routing integrity**：每个 `allowedNext` 指向存在节点或显式 terminal route；所有 04 明确分支都有 reason code，不允许隐藏 default branch；
5. **parallel fidelity**：04 明确可并行的关系必须在 Manifest 中存在，不能被实现层串行化；
6. **reachability**：从合法入口可到达的节点与 04 一致，不出现无依据跳过、孤儿节点或死路；
7. **snapshot diff gate**：Manifest / routing / node registry 的实质变化必须产生可审阅 snapshot diff，并触发 Digital Use 全量回归。

生产运行时不解析 Markdown 来决定路由；运行时只使用已发布的 Scene Package / Manifest。Markdown → snapshot 的提取或人工校准只属于开发/验证工具链。

### 12.3 Routing：主流程与分支

routing.ts 必须把 04 的“前置条件 → 用户输入/判断 → 下一节点”编码成确定性、可测试规则。

原则：

- 模型可以解析自然语言为候选结构化输入；
- 分支结果由规则校验后确定；
- 原文明确的 YES/NO、测试通过、用户拒绝、返回主页、进入其他评估等分支全部保留；
- 原文明确“可并行”的 A3001 与 A3002/目标可行性评估必须允许并行；
- A3000—A3113 与 A4001—A4012 是两条并行 Intervention Stream；
- A5001 与 A5002 分别复盘两条主线；
- UI 可以合并页面，routing 不得因此丢节点语义。

### 12.4 Problem Formulation 与 Intervention Gate

Digital Use Assessment 完成到可形成判断时：

1. 汇总 Evidence / Unknown / Conflict；
2. 生成候选 Problem Formulation；
3. Domain Policy 校验 scene fit、替代解释和退出条件；
4. 向用户展示；
5. 用户可纠正、补充、不同意、暂不确认；
6. 只有满足 04 合同并经允许确认后进入 GOALS。

Intervention 选择必须记录：

- 为什么选择；
- 适用证据；
- 不适用/阻断条件；
- 所属 stream；
- 当前版本；
- 用户选择或拒绝；
- 对 Plan 的依赖。

模型不得从 RAG 文本中临时创造一个未发布 Intervention 并直接激活。

### 12.5 Digital Use 原流程到技术对象映射

| 原流程 | 技术承载 | 不能丢失 |
|---|---|---|
| A1001 / 01002 / 01003 | scene_node_states + assertions/observations + assessment policy | 原选项、标签、来源、下一节点 |
| A2001 / A2002 / 01005 / 01006 | routing + eligibility/exclusions + Case exit/reassessment | 无需干预/进一步评估/其他主问题/严重情绪或冲突分流 |
| 01004 / 01000 | consent + supplemental assessment artifact | 知情同意、拒绝、反馈、返回场景 |
| A2003 | structured assessment + assertions | 期待时长、理由、过去方法、效果、困难、A200401 |
| A2004 | node response + routing | 是否愿与孩子共同确定；原 YES/NO 语义 |
| A2005 / A2006 / A2008 / A2009 | routing + professional content + intervention proposal | 愿意/不愿意、内在动机、家庭联盟说明、潜在亲子问题 |
| A2007 / A2010 | timeline artifact + follow-up draft + generated document | 用户时间、时间线、方案总结、后续入口 |
| A3000 | FAMILY_ALLIANCE intervention + self-assessment artifact | 原则、自评、可重复评估、不阻断下一环节 |
| A3001 | FAMILY_ALLIANCE communication component | 沟通准备及其并行关系 |
| A3002 | digital_use_target_items | 选择/确认/提交/管理/评估/记录/重新选择 |
| A3010—A3113 实际节点 | target item + feasibility + Task/Checkin + support artifact | 各目标原节点、可行性维度、进度、帮助 |
| A4001 | contract preparation node + quiz responses | 5 题、全部答对 Gate、错题解释与记录 |
| A4002 | contract template + professional_examples | 原模板字段 + 4 个完整示范 |
| A4003 | roleplay_sessions / turns | 用户扮孩子、AI 扮家长、多轮、评分、选择、保存参考 |
| A4004 | tool catalog artifact | 工具用途、选择、可再次进入 |
| A4005 | contract draft component | 与孩子共同确定使用时长、保存结果 |
| A4006 | contract draft + supervision log | 年龄参考、共同商量、执行日志 |
| A4007 | contract draft component | 激励原则、案例、保存 |
| A4008 | contract draft component | 违约责任原则、案例、保存 |
| A4009 | parent self-regulation artifact | 方法、工具、文档/清单 |
| A4010 | digital_use_contract_versions | 共同输入、正式版本、文档、进入执行 |
| A4011 | execution + checkins + FAQ/support policy + follow-up | 执行支持、常见问题、真实提醒 |
| A4012 | new contract version | 时间段结束或新问题触发更新；supersedes |
| A5001 | reviews(review_scope=FAMILY_ALLIANCE_TARGET_LIST) | 单独效果评估 |
| A5002 | reviews(review_scope=PHONE_USE_CONTRACT) | 单独效果评估 |

### 12.6 手机合约详细子规格

04 内嵌的《手机使用合约模版》是 A4001—A4012 的正式子规格。

contract schema 至少固定：

- 合约双方；
- 制订目的；
- 手机使用细则；
- 执行周期；
- 家长配合措施；
- 监督措施；
- 激励措施；
- 违约责任。

4 个示范和 FAQ 作为 versioned professional content 加载；它们不是家庭事实，也不允许模型把示范中的具体惩罚/时长自动复制给用户。

未经正式专业审核的争议内容：

- 可以保留在 source/reference；
- 可以用于开发 fidelity 测试；
- 生产建议是否可用必须由发布的 Policy / Knowledge Version 决定；
- 开发者不能自行删掉节点或改变流程来“修正”专业内容。

### 12.7 PolicyResult

~~~ts
type PolicyResult = {
  allowed: boolean
  missingEvidence: string[]
  blockers: string[]
  allowedActions: string[]
  reasonCodes: string[]
  policyVersion: string
  contentVersionRefs: string[]
}
~~~

RAG 不承担上述 Gate。

### 12.8 Psychological / Behavioral Intervention Gate

04 §2.7A 的干预合同在技术层由 `intervention_definitions + Domain Policy + InterventionInstance` 共同承载。

正式提出/选择/激活 Intervention 时，必须按顺序校验：

~~~text
current Problem Formulation / evidence
→ intervention definition exists
→ review_status = APPROVED/PUBLISHED
→ scene/package/version allowed
→ age/development scope
→ formulation dependencies satisfied or explicitly UNKNOWN-safe
→ applicable conditions
→ exclusion / contraindication conditions
→ participation / consent requirements
→ combination / conflict rules
→ current Safety state
→ create/propose InterventionInstance
→ Plan activation gate
~~~

建议使用明确结果：

~~~ts
type InterventionEligibilityResult = {
  allowed: boolean
  interventionDefinitionId: string
  interventionVersion: string
  evidenceRefs: string[]
  unmetFormulationDependencies: string[]
  exclusionHits: string[]
  participationRequirements: string[]
  combinationConflicts: string[]
  adverseSignalsToMonitor: string[]
  reviewCriteriaRef: string
  reasonCodes: string[]
}
~~~

硬规则：

- RAG 只提供专业上下文，不能创造或激活未发布的 Intervention；
- LLM 只能提出候选，不得覆盖 eligibility result；
- 缺少关键 Formulation 依赖时，应补 Assessment / 保持 UNKNOWN，而不是由模型补值；
- 命中 exclusion / contraindication / Safety 条件时必须阻断普通 Plan activation；
- 执行中出现定义内的 adverse/worsening signal，Review 必须能够转为 `ADJUST_PLAN / REASSESS / SAFETY_HOLD / REFERRAL`；
- Intervention 定义实质变化必须新建版本并重新专业审核，不能静默修改已被历史 Plan 引用的版本；
- Eval 必须验证“专业名称正确但条件/步骤错误”同样判失败，不能只检查回答听起来是否专业。

## 13. Professional RAG

### 13.1 知识入库

流程：

```text
专业原始资料
→ 专业审核
→ Package Version
→ Knowledge Item
→ Chunk
→ text-embedding-v4 / 1024
→ pgvector
```

每条知识至少包含：

```text
knowledge_id
package_version
scenario
stage
age_scope
applicable_conditions
exclusion_conditions
risk_level
source
review_status
content
```

只有：

> PUBLISHED

内容进入真实家庭服务。

### 13.2 中文检索

关键词使用：

> pg_jieba + 小树荫专业词典。

词典与知识包版本关联。

### 13.3 检索顺序

```text
Authorization
→ Published
→ Scenario
→ Stage
→ Age / Applicability
→ Version
→ Keyword Search
   +
   Vector Search
→ RRF
→ qwen3-rerank
→ Top Context
```

不能先从全部知识中向量搜索再过滤权限。

### 13.4 向量索引

V1 初始知识规模较小时：

> 优先精确检索。

达到真实规模和延迟瓶颈后再启用：

- HNSW；
- iterative scan。

不在 V1 建独立向量数据库。

---

## 14. Family Memory 实现

### 14.1 Memory 不是聊天摘要

Family Memory 包含：

- 关键事实；
- 重要事件；
- 历史计划；
- 执行；
- 结果；
- 派生模式。

### 14.2 Derived Memory

示例：

> “强制抢夺手机在该家庭过去多次伴随冲突升级。”

保存时必须记录：

```text
memory_id
type
content
source_ids
generated_by
purpose
visibility
confidence
validity
created_at
```

### 14.3 memory_source_links

一条派生 Memory 可以引用：

- message；
- assertion；
- observation；
- checkin；
- review；
- outcome。

源数据：

- 更正；
- 删除；
- 失效；
- Consent 变化；

触发：

```text
invalidate derived memory
→ enqueue memory rebuild
→ rebuild from valid source
→ regenerate embedding
```

### 14.4 禁止摘要叠摘要

新长期摘要：

> 以当前有效源记录为基础生成。

旧摘要可以帮助定位：

> 但不能成为唯一证据链。

### 14.5 Memory Extraction / Rebuild 异步合同

Memory Extraction **不能阻塞用户当前业务提交或当前回复**。

对可能产生长期记忆的正式事件，例如：

- message persisted；
- assessment response committed；
- scene node output committed；
- checkin committed；
- review completed；
- contract / plan version activated；

业务事务只做：

~~~text
保存正式业务事实
+
写 Outbox Event
~~~

Outbox Consumer 再幂等创建 pg-boss job：

~~~text
source business event
→ outbox
→ pg-boss
→ memory_extract route
→ candidate derived memory
→ validate provenance / purpose / visibility
→ derived_memories
→ memory_source_links
→ embedding
~~~

要求：

- job key 至少绑定 source event / source version，重复执行不产生重复 Memory；
- memory_extract 只能基于当前仍有效且当前 Purpose 可用的来源；
- 生成结果先保留来源链接，再允许进入可检索 Memory；
- Memory job 失败、超时或模型不可用，**不能回滚已经成功的 Message / Assessment / Checkin / Review**；
- 失败进入可重试后台状态，不向用户伪装“长期记忆已经更新”；
- Correction / deletion / Consent change / source invalidation 触发 invalidate → outbox → memory rebuild；
- rebuild 必须从当前有效原始/结构化来源重新生成，不能用旧 Derived Memory 作为唯一输入；
- embedding 更新与 Memory 版本绑定，旧 embedding 失效后不得继续被召回。

---

## 14A. Context Builder 实现合同

Context Builder 是 V1 Agent Runtime 的正式组件，不是“把能找到的数据都塞进 Prompt”。

每次模型调用必须按以下顺序构建：

~~~text
1. actor / family / case / purpose
2. Authorization & Consent 结果
3. current Safety state
4. current Case + phase + current Scene Node
5. current Domain Policy / Scene Package version
6. 当前任务真正需要的结构化事实
7. 当前 Purpose 允许的 Family Memory
8. 必要的 Recent Conversation window
9. 当前适用的 Professional RAG context
10. 当前允许调用的 Tools
11. System / response policy
~~~

### 14A.1 权限边界

Authorization 必须发生在：

- Family Memory 检索前；
- Recent Conversation 取数前；
- Professional RAG 涉及受限内容的检索前；
- Context 组装前。

Context Builder 不接收“整个 Family 对象然后靠 Prompt 隐藏”。

### 14A.2 Source priority

发生冲突时，Context 中的权威顺序是：

~~~text
Current PostgreSQL Domain Facts / current versions
> current Policy / Consent / Safety
> current structured evidence
> derived Family Memory
> recent conversational phrasing
~~~

Derived Memory 不能覆盖当前 Fact / Conflict / UNKNOWN，也不能让已失效历史重新变成当前事实。

### 14A.3 Recent Conversation

Recent Conversation 只用于：

- 保持自然多轮连续性；
- 理解当前指代；
- 避免重复追问。

它不是长期事实源。

窗口大小按 token budget 和任务需要动态取，不要求固定“最近 N 条”；超出预算时优先保留当前任务相关消息和有来源的结构化事实。

### 14A.4 Token budget / trimming

每个 Model Route 定义：

~~~text
max_context_tokens
reserved_output_tokens
memory_budget
rag_budget
recent_conversation_budget
~~~

Context 超预算时按以下顺序处理：

1. 删除重复/低相关最近对话；
2. 缩减低相关 Derived Memory；
3. 缩减低相关 RAG chunk；
4. 保留当前 Case / Scene Node / Policy / Safety / Consent / 关键事实；
5. 仍无法满足则返回 CONTEXT_TOO_LARGE 或要求缩小任务，不允许悄悄丢失安全或业务 Gate。

### 14A.5 ai_run provenance

每次调用至少记录：

~~~text
case_version
context_revision
scene_node_code
purpose
consent_version
policy_version
scene_package_version
memory_ids[]
knowledge_ids[]
recent_message_ids[]
allowed_tools[]
model_route_version
prompt_version
~~~

这样可以回答：

> 这次模型为什么会看到这些内容、又为什么没有看到另外一些内容。

---


## 15. LangGraph V1 设计

LangGraph 只保存最小 AI 工作状态，不保存长期业务真相。

建议 State：

~~~ts
type ConsultationState = {
  caseId: string
  familyId: string
  actorId: string
  purpose: string

  domainPhase: string
  sceneId: "digital-use"
  currentSceneNodeCode?: string
  activeStreamCodes?: string[]

  missingEvidence: string[]
  allowedActions: string[]

  problemFormulationVersionId?: string
  decision?: DecisionEnvelope
  responseStatus?: string

  inputRevision: number
  policyVersion: string
  scenePackageVersion: string
}
~~~

不把完整 Family、Plan、Messages、Consent、Contract、Target List 长期复制进 Graph State；每次从 PostgreSQL 当前版本读取。

LangGraph 不负责 A1001—A5002 的业务真相。scene_node_states + routing.ts 才负责“当前原流程走到哪里”。

### 15.1 PostgreSQL Checkpointer

V1 生产环境固定使用：

~~~text
@langchain/langgraph-checkpoint-postgres
PostgresSaver
~~~

不允许生产环境以 MemorySaver / 进程内存替代持久化 Checkpointer。

Checkpoint 可以与业务库使用同一 RDS PostgreSQL 实例，但必须逻辑隔离（独立 schema / 官方 saver 管理的表）；其数据性质是：

> **AI workflow recovery state，不是业务事实。**

首次环境初始化必须执行官方 saver 所要求的 setup / migration，并纳入环境 readiness。

### 15.2 Thread identity / mapping

系统维护稳定映射：

~~~text
case_id
actor_id / participant scope
purpose
thread_id
checkpoint_ns
created_at
closed_at?
~~~

建议由应用侧 langgraph_thread_bindings 记录映射，不从 LangGraph 内部表反向猜 Case。

规则：

- 同一个 Case 可以因 actor/purpose 不同拥有不同 thread；
- thread_id 不能充当 Case ID；
- 删除、撤回、Case 关闭和数据权利请求可通过该映射枚举相关 checkpoint；
- checkpoint 中只保存恢复 AI workflow 所必需的最小 State。

### 15.3 Resume contract

任何 interrupt / resume / worker recovery 后，执行顺序必须是：

~~~text
load checkpoint
→ reload current Case
→ reload current Scene Node
→ authorize current actor/purpose
→ reload current Consent
→ reload current Safety
→ reload current Policy / Package versions
→ compare context revision
→ continue or mark STALE
~~~

如果 checkpoint 与当前 Domain State 冲突：

> **Domain State 胜出。**

旧 checkpoint 不得恢复：

- 已撤回 Consent；
- 已 supersede Plan / Contract；
- 已失效 Memory；
- 已关闭/切换的 Case；
- 与当前版本不一致的 Safety / Policy 状态。

### 15.4 Checkpoint lifecycle

Checkpoint / history / pending writes 进入 Data Copy Inventory。

必须支持：

- 正常 workflow 完结后的保留策略；
- Case/Person 到 thread 的枚举；
- 用户删除时 cancel run + 删除对应 checkpoint/history/pending writes；
- backup restore 后按 deletion replay ledger 再清理；
- checkpoint 删除失败时 Data Request 不得标 COMPLETE。

---

## 16. LangGraph 节点

V1 核心 AI 编排节点：

~~~text
load_current_state
authorize
safety_precheck
load_scene_node_and_policy
load_memory
retrieve_professional_knowledge
build_context
generate_decision
validate_decision
generate_response
persist_allowed_results
schedule_async_followups
~~~

对于需要 AI 的动作（例如自然语言提取、Problem Formulation 草案、A4003 角色扮演、执行障碍支持）复用同一套编排，不为每个 A/010xx 单独建 LangGraph 节点。

业务状态和 Scene Node 的正式变化由 Domain Command / Scene Service 完成。

LangGraph：

- 不直接 UPDATE cases；
- 不直接 Confirm Formulation / Goal / Plan / Contract；
- 不直接解除 Safety；
- 不因为模型输出一个 next_node 就越过 routing.ts。

## 17. Decision Envelope

第一阶段只产生结构化决策。

建议 Schema：

```json
{
  "risk": {
    "level": "normal",
    "signals": []
  },
  "candidate_action": "continue_assessment",
  "missing_evidence": ["sleep_impact"],
  "proposed_assertions": [],
  "response_policy": {
    "mode": "ask_one_question",
    "streaming_allowed": true
  }
}
```

Decision 通过：

1. JSON Schema；
2. Zod；
3. Authorization；
4. Domain Policy；
5. Current Case Version；
6. Safety；

以后才进入 Response。

---

## 18. Response Generation

普通低风险回复：

> 可以流式。

高风险或高影响回复：

> 完整生成并检查后再释放。

### 18.1 API 行为

`POST /cases/:id/messages`

提交后立即返回：

```json
{
  "message_id": "...",
  "run_id": "...",
  "persisted": true,
  "state": "PROCESSING"
}
```

客户端可以：

- 查询 `GET /ai-runs/:id`；
- 在支持时连接受控 response stream；
- 离开后回来继续读取结果。

产品不依赖一个长 HTTP 连接保存业务状态。

### 18.2 用户新输入优先级

已有模型运行时：

> 新消息仍然先保存并进行确定性 Safety 检查。

如果新输入改变：

- risk；
- consent；
- case state；
- plan；
- context revision；

旧 run 标记 STALE 或禁止应用。

### 18.3 Response Release Contract

Decision 校验通过后，Response 仍然是新的模型输出，不能因为 Decision 合法就自动放行。

每个 `ai_run` 在 Response 阶段记录：

```text
release_mode          STREAM_SAFE / BUFFERED_REVIEW / BLOCKED
case_version
context_revision
consent_version
policy_version
package_version
allowed_response_intents
allowed_audience
```

#### STREAM_SAFE

只允许：

- 普通共情；
- 已批准知识的低风险解释；
- 当前 Decision 指定的澄清/追问；
- 不改变业务状态的导航信息。

每个可释放单元必须检查：

- intent 仍在白名单；
- 不夹带未允许的行动建议；
- 不把 Hypothesis 表达成 Fact；
- 不泄露 audience 无权获知的来源/内容；
- 不引用当前 RAG allow-set 之外的专业依据。

#### BUFFERED_REVIEW

以下默认完整生成并完成必要检查后再释放：

- 正式方案；
- 实质方案调整；
- 敏感跨成员披露；
- 高影响专业解释；
- 安全/转介内容；
- Domain Policy 指定的其他高影响输出。

#### 流式中断

Stream 每次释放前重新检查：

```text
run status
case/context revision
consent version
policy/package state
safety state
```

发生授权撤回、主线切换、关键纠错、Safety 变化或 Package/Policy 停用时：

1. 原 run → `INTERRUPTED` 或 `STALE`；
2. 服务端立即停止发送旧 stream；
3. 客户端收到真实终态；
4. 已经发送的内容不能伪称“已撤回”；
5. 新内容必须基于最新上下文重新运行。

SSE / WebSocket / 轮询最终结果都必须走同一 Release Contract，不能让某个出口绕过校验。

---

## 19. Model Gateway

业务层不写：

```text
qwen3.8-max
mimo-v2.6-pro
deepseek-...
```

业务只写：

```text
consultation_high_impact

consultation_normal

background_extract

memory_extract

risk_review

rag_query
```

Model Gateway 配置：

```ts
type ModelRoute = {
  taskRole: string
  provider: string
  modelId: string
  region: string
  structuredOutput: boolean
  streaming: boolean
  timeoutMs: number
  maxTokens: number
  priceVersion: string
  evalVersion: string
}
```

---

## 20. 模型候选与上线规则

V1 当前正式候选池：

- Qwen；
- MiMo；
- DeepSeek。

上线前使用同一 Xiaoshuyin Eval 比较：

### high_impact

- 复杂判断；
- 正式方案；
- 重大复盘；
- 模糊风险。

### normal_consultation

- 普通追问；
- 解释；
- 执行障碍讨论。

### background_extract

- 结构提取；
- Memory；
- 摘要；
- Query Rewrite。

谁在某项：

> 质量达标且综合成本更优，

谁承担该任务。

不要求一家模型包打天下。

未经评测和数据审核的第二供应商：

> 不做真实家庭上下文的自动线上 fallback。

---

## 21. Vercel AI SDK Core

AI SDK 负责：

- provider adapter；
- streaming；
- Tool Calling；
- structured generation；
- provider error normalization；
- request/response runtime。

Model Gateway 负责：

- 业务任务选择；
- 预算；
- 模型映射；
- Eval 版本；
- fallback policy。

LangGraph 负责：

- 流程。

三者职责不能混淆。

---

## 22. Tool Calling

允许模型访问的 Tool 必须最小化。

V1 可包含：

```text
get_case_context
get_authorized_memory
retrieve_professional_knowledge
record_statement
propose_fact
record_assessment
propose_goal
propose_plan
record_execution
record_review
request_case_transition
schedule_followup
escalate_risk
```

所有 Tool ：

- 有输入 Schema；
- 有当前允许阶段；
- 有 Permission；
- 有审计；
- 不接受任意 SQL；
- 不接受任意 URL；
- 不接受任意代码执行。

---


## 23. Domain Commands

真正修改业务状态的命令至少包括：

~~~text
StartAssessment
RecordSceneNodeResponse
PresentProblemFormulation
ConfirmProblemFormulation
DisputeProblemFormulation
ConfirmGoal
SelectIntervention
DeclineIntervention
ActivatePlan
RecordExecution
OpenReview
CompleteReview
EnterMaintenance

SaveDigitalUseTargetItem
SaveContractDraft
ConfirmContractVersion
SupersedeContractVersion
SaveRoleplayResult

WaitForInformation
PauseCase
ResumeCase
SwitchPrimaryCase
MarkLostContact
CloseCase
CreateRecurrence
ResolveRisk
~~~

说明：

- 不要求 A1001—A5002 每个节点拥有一个独立 Command 类；RecordSceneNodeResponse + Scene Policy 可承载普通节点输入；
- 涉及正式业务确认、版本激活、跨阶段推进或有重要副作用的动作必须有显式 Command；
- A4003 Roleplay 保存的是 SIMULATION Artifact；
- A4010 / A4012 合约激活和更新必须有显式版本命令；
- A5001 / A5002 的 CompleteReview 必须携带不同 review_scope。

模型只能：

> request / propose。

不能：

> force / confirm on behalf of user。

## 24. Follow-up Schedule

业务表：

```text
case_followup_schedules
```

关键字段：

```text
id
case_id
plan_version_id
schedule_revision
node_type
due_at
timezone
tracking_mode
channel_requirement
status
created_reason
cancelled_at
```

它表示：

> 当前业务上未来应该发生的跟踪。

---

## 25. pg-boss

pg-boss 负责：

- due follow-up；
- notification dispatch；
- Memory Extraction；
- Memory rebuild；
- async Eval；
- background summary；
- retryable external work。

业务事务不直接依赖：

> 队列任务是否马上执行。

### 25.1 Schedule 与 Job 一致性

方案确认事务：

```text
保存/激活 Plan
+
创建 Follow-up Schedule
+
写 Outbox
```

Outbox Consumer：

> 幂等创建 pg-boss job。

Job 执行前必须重新检查：

- Case Status；
- schedule_revision；
- Plan Version；
- Consent；
- Notification capability；
- Safety。

旧 Job 即使到期：

> 也不能绕过当前业务事实。

---

## 26. Notification Adapter

接口示例：

```ts
interface NotificationAdapter {
  canSend(input): Promise<CapabilityResult>
  send(input): Promise<ProviderResult>
}
```

业务层不直接依赖：

> 微信某一个模板 API。

真实状态：

```text
SCHEDULED
ELIGIBLE
BLOCKED
SEND_REQUESTED
PROVIDER_ACCEPTED
PROVIDER_REJECTED
OUTCOME_UNKNOWN
DELIVERY_CONFIRMED
USER_RETURNED
FEEDBACK_RECEIVED
```

如果微信不提供真实 delivery/read：

> 不生成虚构状态。

### 26.1 Dispatch Gate

每次实际外呼前，统一检查：

```text
notification_intent_id
recipient
purpose
current consent
case status
plan version
schedule revision
safety state
recipient timezone
quiet-hours policy
contact-frequency policy
channel capability
existing feedback
existing in-flight / UNKNOWN attempts
```

不满足条件时：

- 可延期则重新计算合法 `due_at`；
- 已撤回/关闭/已有反馈则取消；
- 缺渠道或资格则 BLOCKED；
- 不通过换渠道绕过频率或安静时段。

具体安静时段和频率来自产品策略/用户设置配置，不散落硬编码。

### 26.2 外部副作用状态机

稳定标识：

```text
notification_intent_id
attempt_id
provider_request_ref?
```

状态：

```text
CREATED
→ DISPATCHING
→ PROVIDER_ACCEPTED
   / PROVIDER_REJECTED
   / RETRYABLE_FAILURE
   / OUTCOME_UNKNOWN
```

自动重试只允许：

1. 可以证明请求尚未发给供应商；或
2. 供应商存在已验证的幂等/查询机制，可确认重试不会制造第二次副作用。

以下进入 `OUTCOME_UNKNOWN`，禁止 pg-boss 自动盲重试：

- 供应商可能已经接受但响应丢失；
- 外部请求已发出后 Worker 在本地记账前退出；
- 网络超时且无法确认供应商状态。

两个 Worker 并发处理同一 Intent 时，通过业务唯一约束/短事务占用保证只能有一个进入 `DISPATCHING`。

`PROVIDER_ACCEPTED` 只表示平台接受请求，不等于 delivery/read/feedback。

---

## 27. Safety 实现

### 27.1 前置确定性检查

用户输入先运行：

- 明确高风险词/模式；
- 当前 Safety State；
- 当前已审核场景规则。

确定性高风险：

> 不等待普通咨询模型。

### 27.2 模型风险判断

模糊风险由：

> risk_review route

提供结构化候选。

### 27.3 Safety Hold

进入 SAFETY_HOLD：

- 普通生成停止；
- 普通任务推进停止；
- 普通提醒按规则抑制；
- 返回审核过的固定支持内容；
- 建立 Risk Event。

解除：

> 只能通过 `ResolveRisk` Domain Command。

---


## 28. API 设计

API 以业务能力为单位，不为每个 A/010xx 建独立 HTTP endpoint。节点级输入通过 Scene API + schema registry 处理。

### 28.1 身份与家庭

~~~text
POST /api/v1/auth/wechat
POST /api/v1/auth/logout
GET  /api/v1/me

POST /api/v1/families
GET  /api/v1/families/current
PATCH /api/v1/families/:id/members/:personId
~~~

### 28.2 Consent

~~~text
GET  /api/v1/consents
POST /api/v1/consents
POST /api/v1/consents/:id/revoke
~~~

### 28.3 Case / Scene / Problem Formulation

~~~text
POST /api/v1/cases
GET  /api/v1/cases
GET  /api/v1/cases/:id
POST /api/v1/cases/:id/messages
POST /api/v1/cases/:id/assessments

GET  /api/v1/cases/:id/scene
GET  /api/v1/cases/:id/scene/nodes/:nodeCode
POST /api/v1/cases/:id/scene/nodes/:nodeCode/responses

GET  /api/v1/cases/:id/problem-formulations/current
POST /api/v1/cases/:id/problem-formulations/:version/confirm
POST /api/v1/cases/:id/problem-formulations/:version/dispute
POST /api/v1/cases/:id/problem-formulations/:version/corrections

POST /api/v1/cases/:id/goals
GET  /api/v1/cases/:id/interventions
POST /api/v1/cases/:id/interventions/:code/select
POST /api/v1/cases/:id/interventions/:code/decline

POST /api/v1/cases/:id/pause
POST /api/v1/cases/:id/resume
POST /api/v1/cases/:id/switch-primary
POST /api/v1/cases/:id/close
POST /api/v1/cases/:id/recurrences
~~~

Scene Node response 必须由 node-registry 对 nodeCode、schema、当前可达性和 actor 权限做服务端校验。

### 28.4 Plan / Execution / Review

~~~text
POST /api/v1/cases/:id/plans/propose
GET  /api/v1/plans/:id
POST /api/v1/plans/:id/confirm

GET  /api/v1/cases/:id/tasks
POST /api/v1/cases/:id/checkins
POST /api/v1/cases/:id/reviews
GET  /api/v1/cases/:id/reviews
GET  /api/v1/cases/:id/followups
~~~

Review API 必须返回 review_scope，A5001 / A5002 不可混淆。

### 28.5 Digital Use：目标清单

~~~text
GET   /api/v1/cases/:id/digital-use/targets
POST  /api/v1/cases/:id/digital-use/targets
PATCH /api/v1/cases/:id/digital-use/targets/:targetCode
POST  /api/v1/cases/:id/digital-use/targets/:targetCode/checkins
GET   /api/v1/cases/:id/digital-use/targets/:targetCode/support
~~~

### 28.6 Digital Use：手机合约与角色扮演

~~~text
GET  /api/v1/cases/:id/digital-use/contract/template
GET  /api/v1/cases/:id/digital-use/contract/examples
GET  /api/v1/cases/:id/digital-use/contract/current
POST /api/v1/cases/:id/digital-use/contract/drafts
PATCH /api/v1/cases/:id/digital-use/contract/drafts/:version
POST /api/v1/cases/:id/digital-use/contract/:version/confirm
POST /api/v1/cases/:id/digital-use/contract/:version/revise
GET  /api/v1/cases/:id/digital-use/contract/faq

POST /api/v1/cases/:id/digital-use/roleplays
POST /api/v1/cases/:id/digital-use/roleplays/:sessionId/turns
POST /api/v1/cases/:id/digital-use/roleplays/:sessionId/rate
POST /api/v1/cases/:id/digital-use/roleplays/:sessionId/select
~~~

合约确认必须区分确认主体。没有孩子本人账号/有效来源时不能伪造 child_confirmation。

### 28.7 AI

~~~text
GET  /api/v1/ai-runs/:id
POST /api/v1/ai-runs/:id/cancel
POST /api/v1/ai-runs/:id/retry
GET  /api/v1/ai-runs/:id/stream
~~~

stream endpoint 只释放当前策略允许的 Response。

### 28.8 孩子参与

~~~text
POST /api/v1/cases/:id/participation-invites
GET  /api/v1/participation-invites/:token
POST /api/v1/participation-invites/:token/accept
POST /api/v1/participations/:id/decline
POST /api/v1/participations/:id/withdraw
GET  /api/v1/participations/:id
POST /api/v1/participations/:id/responses
~~~

### 28.9 数据权利

~~~text
POST /api/v1/data-requests
GET  /api/v1/data-requests/:id
GET  /api/v1/data-requests/:id/download
POST /api/v1/data-corrections
~~~

### 28.10 Staff

只实现 V1 必需：

- professional content / policy review；
- safety；
- data request；
- assigned exceptional case；
- quality review；
- support resource；
- service-open / cost observation。

不建设完整 CRM。

### 28.11 U01—U20 页面 / 任务验收合同

页面可以视觉合并，但业务能力不可省略。

| 任务 | 核心实现 | 必须覆盖的非理想状态 |
|---|---|---|
| U01 服务/登录 | service state + 微信登录 | 未开放、登录失败 |
| U02 授权 | purpose/scope/version | 可选拒绝、撤回、必要授权缺失 |
| U03 家庭资料 | Family/Person/source | 未知、转述、无孩子账号 |
| U04 Case 总览 | status/phase/current node/blockers | WAITING/PAUSED/LOST/SAFETY/CLOSED |
| U05 Digital Use Assessment | Scene node engine A1001… | 信息不足、冲突、分流、退出 |
| U06 Problem Formulation | versioned formulation | 纠正、补充、不同意、暂不确认 |
| U07 Goal | Goal contract | 基线/观察/保护条件不足 |
| U08 Intervention | intervention instances + rationale | 不适用、拒绝、两主线状态 |
| U09 Plan Version | versioned plan | DRAFT/PENDING/ACTIVE/SUPERSEDED/PAUSED |
| U10 家庭/家长行动 | Task + family-alliance stream | 部分执行、家人不配合 |
| U11 孩子参与 | invite / limited participation | 拒绝、撤回、过期、越权 |
| U12 共同规则/Action Plan | contract/action plan | 拒签仍可走可行路径、版本更新 |
| U13 执行反馈 | Checkin | PARTIAL/NOT_EXECUTED/UNKNOWN |
| U14 障碍支持/沟通练习 | support + A4003 roleplay | 模拟不得冒充孩子意见 |
| U15 Review | Review + A5001/A5002 | CONTINUE/ADJUST/REASSESS/WAIT/PAUSE/MAINTENANCE/EXIT |
| U16 Maintenance/Closure/History | lifecycle + history | 未达结案、复发、UNKNOWN |
| U17 提醒/联系授权 | Schedule + Notification | 无许可、quiet hours、发送失败/UNKNOWN |
| U18 查看/更正/导出/删除 | data rights | 无权、处理中、部分失败、恢复删除重放 |
| U19 Safety/Referral | risk/referral | 无真实资源、仅建议未连接、Safety Hold |
| U20 历史恢复/复发 | history + recurrence | 旧案不可覆盖，新案重新授权/评估 |

所有页面均验证：

> loading / empty / waiting / failure / no-permission / stale-conflict / retry-or-recovery。

前端隐藏按钮不能替代服务端 Authorization、Domain Policy 和 Scene Routing。


## 29. 关键事务

### 29.1 Confirm Problem Formulation

同一事务：

1. authorize；
2. lock / version check Case；
3. Case 为 primary，phase=PROBLEM_FORMULATION；
4. Safety 无阻断；
5. formulation version 仍是 current；
6. 依赖证据/Consent/Policy 未失效；
7. 保存用户确认/纠正/争议；
8. 只有 CONFIRMED 且 Domain Policy 允许时 phase → GOALS；
9. 写 Audit / Outbox。

不能由模型自己执行 ConfirmProblemFormulation。

### 29.2 激活 Plan

同一事务：

1. authorize；
2. lock / version check Case；
3. current Problem Formulation 已确认且有效；
4. Goal 已确认；
5. InterventionInstance 均为已发布/适用/允许状态；
6. 检查 Plan hash / dependencies；
7. Domain Policy；
8. Safety；
9. 家长确认；
10. ACTIVE 新 Plan；
11. SUPERSEDE 旧 Plan；
12. 创建 Follow-up Schedule；
13. Audit / Outbox。

事务成功后才对外表示方案已生效。

### 29.3 手机合约版本确认 / 更新

A4010 ConfirmContractVersion：

1. 校验 Case / actor / Scene Node 可达；
2. 校验模板 schema；
3. 保存双方实际提供的内容和来源；
4. 不允许家长伪造 child_confirmation；
5. 当前 draft → ACTIVE；
6. 旧 ACTIVE → SUPERSEDED；
7. 更新 A4010 node output；
8. 创建 A4011 执行入口与适用 Follow-up；
9. Audit / Outbox。

A4012 SupersedeContractVersion：

- 以当前版本复制出新 DRAFT；
- 记录更新原因（周期结束 / 新问题 / 双方协商）；
- 双方重新确认后才 ACTIVE；
- 旧版本永久保留，不原地 UPDATE 成新内容。

### 29.4 主问题切换

普通 SwitchPrimaryCase 前置：

1. lock Family；
2. 重新读取当前 primary 和目标 Case；
3. 当前 primary 不得 SAFETY_HOLD，且无阻断风险；
4. 目标 Case 不得 CLOSED；
5. Authorization 通过；
6. 目标 Case 原 status/phase 不在切换事务中自动恢复。

同一事务保证最多一个 primary；旧主线未来普通 Schedule 取消；写切换原因、旧/新 primary、Audit、Outbox。

### 29.5 Consent 撤回

同一业务动作：

- 新 Consent version；
- future access / notification 禁止；
- 相关 Derived Memory invalidate；
- 相关 AI run stale；
- artifact_dependencies 定位受影响的 Formulation / Goal / Intervention / Plan / Task / Contract；
- 受影响对象 → NEEDS_REVIEW 或 invalidate；
- 抑制对应未来执行和提醒；
- enqueue cleanup/rebuild；
- audit。

### 29.6 事实更正 / 来源失效

Assertion / Observation 被更正、删除或失效：

1. 新版本保存，旧版本保留 superseded；
2. Derived Memory 失效；
3. 查询 artifact_dependencies；
4. 受影响 Formulation / Goal / Intervention / Plan / Task / Contract → NEEDS_REVIEW；
5. 立即抑制可能不适用的行动与提醒；
6. 使用当前证据和 Policy 重新验证；
7. 有实质变化时创建新版本并由适当主体重新确认；
8. 无依赖对象不受影响。

Memory 重建成功不等于旧 Plan/Contract 自动恢复有效。

## 30. 并发与 stale result

AI run 保存：

```text
case_version
context_revision
policy_version
consent_version
package_version
model_route_version
```

模型结果返回以后重新读取当前值。

如果关键版本变化：

> Result = STALE。

不允许旧答案应用到新 Case。

---

## 31. Phoenix

Phoenix 记录：

- run_id；
- anonymous case reference；
- graph node；
- provider/model；
- model route version；
- prompt version；
- policy version；
- knowledge IDs；
- tool；
- latency；
- token；
- error；
- eval result。

默认不发送：

- 完整家庭聊天；
- 身份信息；
- 联系方式；
- 原始音频；
- 无必要敏感正文。

需要人工评估的样本：

> 单独脱敏并受权限控制。

---


## 32. Xiaoshuyin Eval

测试集分为：

### 32.1 Common Domain

- 缺信息；
- 无需干预；
- 主问题不是数字使用；
- Problem Formulation 可纠正/不同意；
- Goal 不合格；
- Plan 不可执行；
- 执行失败；
- Review 恶化/UNKNOWN；
- Maintenance / Closure；
- 退出 / 失联 / 复发。

### 32.2 Digital Use Flow Fidelity

至少覆盖：

- A1001 / 01002 / 01003 输入与标签；
- A2001/A2002/01005/01006 各分流；
- 01004 知情同意拒绝与接受；
- A2003→A2004→A2005/A2006 的原分支；
- A2007/A2010 时间线；
- A3001 与 A3002 可并行；
- 目标清单选择、可行性、进度、帮助；
- A4001 五题 Gate；
- A4002 四个示范可访问；
- A4003 多轮角色扮演且不污染孩子事实；
- A4005—A4009 合约组件；
- A4010 正式版本；
- A4012 supersede；
- 孩子拒签时仍可走家庭联盟；
- A5001 与 A5002 分开；
- UI 合并后 node routing 仍不丢语义。
- Full Node Manifest 与 04 snapshot 节点集合、原编号、分支、记录和并行关系一致；缺节点、多节点、隐藏 default branch、无效 next target 均失败。

### 32.3 Provenance

- 家长与孩子陈述冲突；
- 转述；
- 更正；
- UNKNOWN；
- Roleplay simulation 不成为孩子 Statement。

### 32.4 Privacy

- 跨家庭；
- 跨成员；
- Purpose-bound derived context；
- Consent 撤回；
- Contract participant confirmation source。

### 32.5 Safety

- 明确风险；
- 隐晦风险；
- 执行途中出现风险；
- 旧风险恢复；
- 模型漏判；
- Safety Hold 无法被普通节点路由绕过。

### 32.6 RAG / Professional Content

- 专业知识召回；
- 错误阶段；
- 错误年龄；
- retired / suspended content；
- rerank；
- 未审核争议内容不能因存在于 source/reference 就自动成为生产建议；
- 4 个合同示范只作示范，不被模型机械复制。

### 32.7 Memory

- 两个月；
- 两年；
- 五年；
- 源数据更正；
- 删除；
- 摘要漂移。

### 32.8 Reliability

- duplicate request；
- worker retry；
- stale / interrupted AI run；
- concurrent formulation/plan/contract confirm；
- notification unknown；
- correction/consent dependency invalidation；
- LangGraph checkpoint deletion；
- Scene Node 重复提交；
- A300x / A400x 并行推进不互相覆盖。

### 32.9 04 验收案例

04 的 Case A—J 全部进入固定回归集，不允许只用通用单元测试替代。

### 32.9A Psychological / Behavioral Intervention Contract

至少覆盖：

- 未发布/未审核 Intervention 不能进入正式 Plan；
- 年龄/发展阶段不匹配时必须阻断或改走其他已批准方案；
- 缺关键 Formulation 依赖时保持 UNKNOWN / 补评估，模型不能补值；
- 命中 exclusion / contraindication 时普通 activation 被阻断；
- RAG 召回未发布内容不能绕过 Domain Policy；
- 两个 Intervention 存在组合冲突时不能同时激活；
- adverse/worsening signal 能触发 Review → ADJUST / REASSESS / SAFETY / REFERRAL；
- Intervention 版本更新不会静默改写历史 Plan，必要时正确传播 NEEDS_REVIEW；
- AI 使用某心理学流派/方法名称但实际步骤、条件、复盘标准与批准 Contract 不一致时判失败。

### 32.10 Eval 版本与放行判定

每个 Eval Suite 固定：

~~~text
suite_version
case_id
requirement_ids[]
scene_node_codes[]
scenario
input_fixture
expected_state_or_behavior
forbidden_behavior
review_rubric
review_owner
result
evidence_ref
~~~

以下任一出现即为发布阻断：

- 跨家庭或未授权跨成员泄露；
- AI 自行 Confirm Fact / Formulation / Consent / Goal / Plan / Contract / Close Case；
- 跳过 PROBLEM_FORMULATION；
- Scene routing 违反 04；
- A5001/A5002 被错误合并；
- 未满足条件却解除 Safety Hold；
- retired / suspended / 不适用专业内容形成高影响建议；
- 虚构 referral CONNECTED；
- 明确高风险场景产生危险建议；
- Response Release Contract 越权。

确定性权限、状态、Scene routing 和安全用例必须全部通过。

模型、Prompt、RAG、Policy、Package、Node Registry、Routing 或 Release Contract 有实质变化后，对应批准版本失效，必须回归。

## 33. 模型评测指标

模型至少比较：

- 专业判断；
- 中文自然度；
- 是否讨好家长；
- 是否承认不知道；
- Provenance 保持；
- Structured Output 成功率；
- Tool Calling；
- Safety；
- 长上下文一致性；
- latency；
- token；
- cost。

最终模型映射记录：

```text
task_role
model_id
provider
eval_version
approved_at
price_version
```

---

## 34. 数据生命周期与删除

### 34.1 数据副本生命周期表

具体 TTL 在上线前根据真实服务目的、法规和供应商条款锁定；没有依据时不能默认永久保存，也不能为了节省资源删除长期事实源。

| 数据类别 | 默认目的 | 日常生命周期规则 | 纠错/撤回 | 主动删除 | 备份恢复 |
|---|---|---|---|---|---|
| 结构化长期档案 / Case / Outcome | 持续家庭服务 | 服务目的仍成立时长期保存；定期核对有效性，不因结案自动清空 | 版本化更正、失效依赖 | 按请求范围清除 | 恢复后先重放删除清单 |
| 原始聊天/证据 | 事实来源与纠错 | 与长期档案分层；具体保留期在上线前由隐私/专业需要确定并版本化 | 更正不覆写历史；用途撤回限制后续使用 | 范围内清除 | 同上 |
| Derived Memory / Embedding | 检索和长期理解 | 仅在有效来源和用途存在时有效；来源失效即失效/重建 | 自动传播 | 清除并重建相关索引 | 不得复活无来源派生内容 |
| LangGraph checkpoint/history/pending writes | 工作流恢复 | 只保留完成当前工作流/审计所需窗口；期限在真实试点前配置 | run stale/interrupt 后禁止继续应用 | 按 thread 映射清除 | 恢复后清理已删除 thread |
| pg-boss job payload | 异步执行 | 完成/取消后按运维审计需要短期保留；payload 最小化 | job 执行前重检 | 取消未来 job并清理相关 payload | 过去提醒不重放 |
| AI 临时上下文/cache | 运行 | 最短必要窗口 | 授权变化立即禁止复用 | 清理 | 不从备份恢复为可用上下文 |
| Phoenix 可识别 Trace / Eval 样本 | 质量 | 默认最小化/脱敏；可识别样本有独立保留策略 | 必要时失效 | 可识别范围清除 | 不作为业务恢复源 |
| 导出文件 | 用户权利交付 | 限时下载，过期自动删除 | 新导出反映当前数据 | 删除 | 不恢复过期导出 |
| 供应商请求副本 | 模型/通知服务 | 以已审核真实条款和配置为准 | 以供应商能力传播 | 记录可执行范围 | 不假定本地恢复可控制供应商副本 |

### 34.2 用户主动删除

按 04：

> 在线数据在核验范围后 7 天内清除。

删除传播显式覆盖：

- raw messages / assertions / observations；
- Case / Plan / Task 等请求范围；
- derived memory / embeddings；
- **LangGraph checkpoint / history / pending writes**；
- future schedules；
- pg-boss future jobs / related payload；
- AI cache / temp context；
- exports；
- Phoenix 中可识别样本（若存在）；
- 本项目控制范围内的对象存储副本。

系统维护：

```text
data_requests
+
deletion_replay_ledger
```

`deletion_replay_ledger` 只保存重放删除所需的最小内部标识、请求版本、范围和完成状态，不保存家庭正文。

该 Ledger 必须位于：

> **独立于业务数据库旧恢复点的加密私有持久化位置**

例如受 KMS 保护的私有对象存储追加清单。

删除请求状态：

```text
PENDING
IN_PROGRESS
PARTIAL
FAILED
COMPLETE
```

其中 `COMPLETE` 只能在以下条件**同时满足**时写入：

1. 请求范围内所有**本项目控制的在线副本**均已实际清除或不可逆失效，并取得对应删除证明；
2. 不存在仍待处理的本项目在线副本；
3. 最新 `deletion_replay_ledger` 已可靠写入独立持久化位置。

如果导出文件、LangGraph checkpoint、对象存储副本、业务表、派生 Memory/Embedding 等任一应删除在线副本清理失败：

> 请求保持 `PENDING` / `PARTIAL` / `FAILED`，并向用户/运营显示真实待处理范围；不能因为已经写入 Ledger 就标记 `COMPLETE`。

以下与“在线删除完成”分开报告：

- 仍处于 50 天滚动周期内、但已被禁止用于业务恢复的备份副本；
- 项目无法直接控制、只能按已审核供应商条款处理的外部供应商副本。

它们不能用来掩盖本项目在线副本尚未删除。

LangGraph 必须维护 `case/person → thread_id` 映射，删除时先取消相关 run，再清除 thread checkpoint/history/pending writes，并记录证明。

### 34.3 备份

恢复备份滚动 50 天。

删除在线数据后：

> 备份中的旧副本不用于新业务处理。

恢复时：

> 先从独立 Ledger 取得最新删除清单并重放，再开放服务。

如果无法证明删除清单完整、最新：

> 恢复环境继续隔离。

---

## 35. 备份与恢复

恢复顺序：

1. 恢复到隔离环境；
2. 禁用 AI 和 Notification；
3. 重放删除清单；
4. 失效旧 session；
5. 核对最新 Policy / Package / Safety；
6. 将外部结果不明任务保持 UNKNOWN；
7. 不重放过去提醒；
8. 重新核验 Consent；
9. 核对 Case / Plan / Schedule；
10. 受限恢复服务。

不把：

> 数据库恢复成功

解释成：

> 所有家庭已经恢复服务。

---

## 36. 运行降级

### 模型不可用

仍允许：

- 查看历史；
- 查看已生效方案；
- 提交反馈；
- 暂停；
- 权利请求；
- 查看静态安全内容。

### RAG异常

不能：

> 无专业依据继续生成正式方案。

可以：

- 澄清；
- 等待；
- 显示当前无法形成可靠建议。

### Notification异常

Case 继续存在。

标记真实发送状态。

不能：

> 为了“完成提醒”无限重试。

### Phoenix异常

不阻塞核心服务。

Trace 失败：

> 不能影响业务事务。

---

## 37. 非功能目标与执行预算

### 37.1 事前设计预算

以下是架构约束，不是已经实测的 SLA：

| 路径 | 前台模型调用预算 | 自动重试 | 额外规则 |
|---|---:|---:|---|
| 普通低风险回合 | 最多 2 次：Decision + Response | 整条链最多 1 次可证明安全的瞬时重试 | RAG/Rerank 可用；Memory Extraction 必须后台 |
| 高影响回合 | 最多 3 次：Decision + 必要独立复核 + Response | 同上 | Response 默认 BUFFERED_REVIEW |
| 后台 Extract/Memory/Eval | 不计入前台调用预算 | 由 job policy 单独限制 | 不能阻塞用户消息保存 |
| 未审核跨供应商 fallback | 0 | 0 | 禁止发送真实家庭上下文 |

每个 Model Route 必须配置并强制：

```text
max_foreground_calls
max_retries
per_call_timeout_ms
chain_deadline_ms
max_input_tokens
max_output_tokens
estimated_cost_limit
```

任一层不得在自己内部无限 retry，导致总调用次数跨层放大。

真实试点前必须形成版本化 `pilot_budget_version`，至少包含：

- 月技术预算上限；
- 模型预算上限；
- 单 Case / 单服务轮次可接受的技术成本目标；
- 云、模型、通知、人工四类成本的计量来源；
- 达到预算上限后的降级/停止策略。

金额根据届时真实云规格、模型价格和试点规模批准；缺少真实报价时不伪造固定人民币数字，但 **budget_version 为空时不得开放真实试点**。

### 37.2 用户体验和可靠性目标

| 项 | 设计目标 |
|---|---|
| 普通 API | 不被模型调用阻塞；先以快速持久化并返回真实状态为验收 |
| 用户消息持久化 | API 返回成功前已经写库 |
| 新风险输入 | 不等待已有 AI run；确定性 Safety 抢占普通生成 |
| AI 普通请求 | 有 PROCESSING / SUCCESS / FAILED / STALE / INTERRUPTED |
| 数据权限 | 跨家庭和无授权访问必须失败，属于硬阻断 |
| 幂等 | 重试不重复产生业务结果 |
| Follow-up | Worker 重启后业务 Schedule 不丢失 |
| 通知 | UNKNOWN 不盲重试，安静时段和频率策略可验证 |
| 删除 | 能枚举全部副本并证明在线清除/失效传播 |
| Observability | 核心服务不依赖 Phoenix 可用；默认 Trace 不含完整敏感正文 |

具体 p95、并发、RPO/RTO 和人民币单位成本在首次原型压测/成本测量后冻结，并在真实试点前写入 release evidence。

不能把“第一次测到多少”直接当成“目标就是多少”；若实测不能满足体验或预算，必须减少非必要调用/检索步骤、调整模型路由或缩小开放范围。

---


## 38. V1 实施顺序

### Phase 1：Common Core 地基

- Account / Person / Family / Participant；
- Case Status / Phase；
- Statement / Observation / Fact / Hypothesis；
- Problem Formulation；
- Consent / Authorization；
- Domain Commands；
- Audit / Outbox；
- 幂等、版本和并发。

### Phase 2：Digital Use Scene 忠实实现

- scene package / node-registry / routing；
- checked-in Full Node Manifest + 04 canonical snapshot + completeness/routing CI；
- A1001—A2010；
- FAMILY_ALLIANCE stream：A3000—A3113 实际节点；
- PHONE_USE_CONTRACT stream：A4001—A4012；
- target list / feasibility；
- contract template / 4 examples / FAQ；
- roleplay；
- A5001 / A5002；
- Digital Use Scene 单元和路由测试。

**这一阶段结束时，原流程必须可以在不接真实模型的确定性测试夹具下走通。**

### Phase 3：专业知识与 AI

- Psychological / Behavioral Intervention Contract + reviewed `intervention_definitions`；
- pg_jieba；
- pgvector；
- Embedding；
- RRF；
- Rerank；
- Context Builder；
- LangGraph；
- Model Gateway；
- Vercel AI SDK；
- Problem Formulation / support / roleplay 等 AI 能力；
- Decision / Response；
- Eval。

### Phase 4：执行闭环

- Goal；
- InterventionInstance；
- Plan；
- Task；
- Checkin；
- Review；
- Outcome；
- Follow-up Schedule；
- pg-boss；
- Notification Adapter。

### Phase 5：长期、安全与权利

- Family Memory；
- memory_source_links；
- Purpose-bound context；
- Safety；
- Referral；
- Phoenix；
- correction / export / deletion / restore；
- Maintenance / Closure / Recurrence。

### Phase 6：真实小范围验证

只有以下全部通过才进入真实家庭：

- 04 的 U01—U20；
- V1-C / V1-D / V1-X mapping；
- Digital Use A1001—A5002 fidelity；
- 专业包；
- 模型；
- 平台；
- 权限；
- 删除；
- 安全；
- 通知；
- 真实成本和试点统计。

## 39. V1 需求到合同与验收映射

从本版开始，04 的 canonical requirement namespace 是唯一映射键：

- V1-C01—V1-C37：Common Core；
- V1-D00—V1-D43：Digital Use Scene；
- V1-X01—V1-X14：真实交付与验证。

旧 R01—R40 **废止为 canonical mapping key**，只保留在 Git 历史中，不再指导开发。

每条 04 需求必须能找到具体技术合同和可执行验收：

| PRD | 主要技术合同 | 关键验收 |
|---|---|---|
| V1-C01 | §5/§6/§29.4 | 并发创建/切换后最多一个 primary 普通执行主线 |
| V1-C02 | §7.2/§32.3 | 来源、冲突、UNKNOWN 等不可升级或补值 |
| V1-C03 | §7.2/§32.3 | 来源、冲突、UNKNOWN 等不可升级或补值 |
| V1-C04 | §6.7/§7.2/§29.1 | ASSESSMENT 必须进入 PROBLEM_FORMULATION，不能直达 GOALS |
| V1-C05 | §7.3 Goal | 缺基线/观察/保护/家长行动不得确认 |
| V1-C06 | §7.3 PlanVersion/§29.2 | Intervention 理由、任务、follow-up/review/版本状态齐全 |
| V1-C07 | §7.3 PlanVersion/§29.2 | Intervention 理由、任务、follow-up/review/版本状态齐全 |
| V1-C08 | §7.3 Task/Checkin | PARTIAL/NOT_EXECUTED/障碍/变化/来源真实保存 |
| V1-C09 | §7.3 Task/Checkin | PARTIAL/NOT_EXECUTED/障碍/变化/来源真实保存 |
| V1-C10 | §7.3 Review/§6.7 | Review 比较基线/执行/结果并支持规定 next actions |
| V1-C11 | §7.3 Review/§6.7 | Review 比较基线/执行/结果并支持规定 next actions |
| V1-C12 | §7.3/§29.2 | 实质 Plan 调整创建新版本，不原地覆盖 |
| V1-C13 | §6.3—6.5/§28.11 U16/U20 | Outcome/Closure/Referral 分离；复发创建关联新 Case |
| V1-C14 | §6.3—6.5/§28.11 U16/U20 | Outcome/Closure/Referral 分离；复发创建关联新 Case |
| V1-C15 | §24—§26/§28.11 U17 | 每个 ACTIVE Plan 有下一节点；授权提醒分离；发送不等于改善 |
| V1-C16 | §24—§26/§28.11 U17 | 每个 ACTIVE Plan 有下一节点；授权提醒分离；发送不等于改善 |
| V1-C17 | §24—§26/§28.11 U17 | 每个 ACTIVE Plan 有下一节点；授权提醒分离；发送不等于改善 |
| V1-C18 | §6.6/§24 | 暂停/恢复/退出真实；失联需真实联系证据 |
| V1-C19 | §6.6/§24 | 暂停/恢复/退出真实；失联需真实联系证据 |
| V1-C20 | §7.1/§9—§11 | Account/Person/Participant/Visibility/Purpose/Consent 服务端隔离 |
| V1-C21 | §7.1/§9—§11 | Account/Person/Participant/Visibility/Purpose/Consent 服务端隔离 |
| V1-C22 | §7.10/§14/§29.5—29.6 | 更正传播；多年历史保留来源/版本/有效性 |
| V1-C23 | §7.10/§14/§29.5—29.6 | 更正传播；多年历史保留来源/版本/有效性 |
| V1-C24 | §5/§23 | AI 无最终业务确认权 |
| V1-C25 | §6.6/§27 | Safety 任意阶段抢占；Referral 真实状态 |
| V1-C26 | §6.6/§27 | Safety 任意阶段抢占；Referral 真实状态 |
| V1-C27 | §30/§36 | 模型/网络/通知失败真实；重试/并发不重复 |
| V1-C28 | §30/§36 | 模型/网络/通知失败真实；重试/并发不重复 |
| V1-C29 | §28.11 | U01—U20 与非理想状态全部 E2E |
| V1-C30 | §3/§12 | Common Core 与 Digital Use Scene 边界测试 |
| V1-C31 | §28.9/§29.5—29.6/§34—35 | 查看更正导出删除；7/50 删除合同和恢复重放 |
| V1-C32 | §28.9/§29.5—29.6/§34—35 | 查看更正导出删除；7/50 删除合同和恢复重放 |
| V1-C33 | §28.9/§29.5—29.6/§34—35 | 查看更正导出删除；7/50 删除合同和恢复重放 |
| V1-C34 | §28.10/§40 | 后台和人工仅真实能力，无假专家/空队列 |
| V1-C35 | §28.10/§40 | 后台和人工仅真实能力，无假专家/空队列 |
| V1-C36 | §2/§4/§40 Platform | 现有微信小程序为家庭主端，不另建家庭 Web |
| V1-C37 | §7.3/§7.5/§12.8/§32.9A | 正式 Intervention 必须绑定已审核版本；适用/排除/年龄/Formulation/不良信号/复盘/停止条件均可执行、可追溯，AI/RAG 不能绕过 |
| V1-D00 | §12.2—12.5 | Node Registry / Routing 与 04 逐节点 snapshot 对比 |
| V1-D01 | §12.2/§12.5 | A1001/01002/01003 选项、标签、流转测试 |
| V1-D02 | §12.3/§12.5 | A2001/A2002/01005/01006 分流测试 |
| V1-D03 | §12.5/§28.3 | 01004/01000 Consent、测评、反馈、返回 |
| V1-D04 | §12.5/§7.2 | A2003 与 A200401 字段完整 |
| V1-D05 | §12.3/§12.5 | A2004 YES/NO 原路由 |
| V1-D06 | §12.3/§12.5 | A2005/A2006/A2008/A2009 分支 |
| V1-D07 | §12.5/§24 | A2007 时间线、A2010 文档和提醒依据 |
| V1-D08 | §7.3/§12.3 | FAMILY_ALLIANCE 与 PHONE_USE_CONTRACT 并行 stream |
| V1-D09 | §12.5 | A3000 不阻断；A3001 与 A3002/可行性可并行 |
| V1-D10 | §12.5 | A3000 不阻断；A3001 与 A3002/可行性可并行 |
| V1-D11 | §7.4/§28.5 | A3002 选择/管理/评估/重新选择 |
| V1-D12 | §7.4/§12.5 | A301x—A311x 实际节点、原目标、五维可行性 |
| V1-D13 | §7.4/§12.5 | A301x—A311x 实际节点、原目标、五维可行性 |
| V1-D14 | §7.4/§12.5 | A301x—A311x 实际节点、原目标、五维可行性 |
| V1-D15 | §12.5 | A4001 五题、全对 Gate、错题记录 |
| V1-D16 | §12.6/§28.6 | A4002 模板可访问 |
| V1-D17 | §7.4/§28.6/§32.3 | A4003 多轮角色扮演/评分/选择且不污染事实 |
| V1-D18 | §12.5 | A4004 工具目录可反复进入 |
| V1-D19 | §7.4/§12.5 | A4005—A4009 各组件、日志/文档保存 |
| V1-D20 | §7.4/§12.5 | A4005—A4009 各组件、日志/文档保存 |
| V1-D21 | §7.4/§12.5 | A4005—A4009 各组件、日志/文档保存 |
| V1-D22 | §7.4/§12.5 | A4005—A4009 各组件、日志/文档保存 |
| V1-D23 | §7.4/§12.5 | A4005—A4009 各组件、日志/文档保存 |
| V1-D24 | §7.4/§29.3 | A4010 正式合约版本、确认、执行入口 |
| V1-D25 | §12.6/§24—26 | A4011 FAQ/support/执行/提醒 |
| V1-D26 | §7.4/§29.3 | A4012 两触发、supersedes、不覆盖 |
| V1-D27 | §7.3 Review/§12.5 | A5001/A5002 独立 scope，不被 CASE_OVERALL 吞并 |
| V1-D28 | §7.3 Review/§12.5 | A5001/A5002 独立 scope，不被 CASE_OVERALL 吞并 |
| V1-D29 | §7.3 Review/§12.5 | A5001/A5002 独立 scope，不被 CASE_OVERALL 吞并 |
| V1-D30 | §12.2—12.5/§24 | 时间线/主动进入/推送/帮助/Artifact；并行关系 |
| V1-D31 | §12.2—12.5/§24 | 时间线/主动进入/推送/帮助/Artifact；并行关系 |
| V1-D32 | §5/§12 | 争议内容不静默改；UI 可合并但节点语义不丢；04 优先 |
| V1-D33 | §5/§12 | 争议内容不静默改；UI 可合并但节点语义不丢；04 优先 |
| V1-D34 | §5/§12 | 争议内容不静默改；UI 可合并但节点语义不丢；04 优先 |
| V1-D35 | §12.6 | 合约原附件/镜像作为正式 sub-spec 版本来源 |
| V1-D36 | §7.4/§12.6 | 八类模板字段与双方真实确认 |
| V1-D37 | §7.4/§12.6 | 八类模板字段与双方真实确认 |
| V1-D38 | §12.6/§32.6 | 4 个示范、FAQ 完整可用且不机械复制 |
| V1-D39 | §12.6/§32.6 | 4 个示范、FAQ 完整可用且不机械复制 |
| V1-D40 | §12.3/§32.2 | 拒签合约仍可继续 FAMILY_ALLIANCE |
| V1-D41 | §29.3 | 双方同意更新产生新 Contract Version |
| V1-D42 | §12.6/§40 Professional | 原文保留；生产启用由审核 Policy/Content Version 决定 |
| V1-D43 | §12.2A/§32.2/§40 Product | checked-in Full Node Manifest 与 04 canonical snapshot 完整一致；无缺失/多余/隐藏分支/无效 next target，并由 CI + 全量回归阻断漂移 |
| V1-X01 | §12/§40 Professional | Digital Use Policy/Safety 有审核版本和证据 |
| V1-X02 | §28/§40 Platform | 微信登录/邀请/提醒在真实平台验证 |
| V1-X03 | §6/§38/§40 | 完整 Case 从 Intake 到 Maintenance/Closure E2E |
| V1-X04 | §32.1—32.5 | 所有非理想/退出/Safety/模型与通知失败路径固定回归 |
| V1-X05 | §7.2/§32.3 | 来源冲突保持冲突 |
| V1-X06 | §29—30/§32.8 | Plan/Contract 调整、并发/重试不覆盖不重复 |
| V1-X07 | §14/§32.7 | 两年/五年受控时钟、历史版本和有效性 |
| V1-X08 | §7.9/§37/§40 | 试点分母保留 UNKNOWN/退出/恶化/失访/转介 |
| V1-X09 | §38/§40 | Common Core + Digital Use Scene 同时通过 |
| V1-X10 | §3/§12/05 §25 V2 | 第二 Scene 主要新增 Scene 专业资产，复用 Core |
| V1-X11 | §7.9/§37 | MODEL/CLOUD/NOTIFICATION/HUMAN 成本，UNKNOWN 不补0 |
| V1-X12 | §40 | 小范围真实家庭后再扩，不用固定数量宣告成功 |
| V1-X13 | §28.9/§34—35/§40 | 更正/导出/删除/backup restore 删除重放实演 |
| V1-X14 | §28.10/§40 | 后台/人工/专业流程只验真实存在能力 |

规则：

1. 代码、测试、PR 描述优先引用 V1-C / V1-D / V1-X；
2. 新实现如果无法指出对应 requirement ID，不得以“技术优化”为由改变 04 行为；
3. 若发现需求真的无法可靠实现，回到 04 显式修订，而不是在 06 或代码中静默降级；
4. PRD mapping 变更必须与对应技术合同、测试同时更新。


## 40. V1 上线门槛

真实家庭上线前至少确认：

### Product / Flow Fidelity

- 04 的 U01—U20 全部有真实入口、非理想状态和恢复路径；
- V1-C01—C37、V1-D00—D43、V1-X01—X14 全部有测试证据；
- A1001—A5002 node registry 与 04 snapshot 一致；
- checked-in Full Node Manifest 与 04 canonical snapshot 完整一致，completeness / routing integrity / reachability CI 全通过；
- 原分支和并行关系 E2E 通过；
- PROBLEM_FORMULATION 不可跳过；
- A3000—A3113 / A4001—A4012 两条主线可并行；
- A5001 / A5002 分开；
- 合约模板、4 个示范、FAQ、A4003 roleplay 可用；
- 拒签合约不阻断家庭联盟路径。

### Professional

- digital-use package 已正式审核；
- 所有可进入正式 Plan 的 Intervention 都绑定已审核、已发布的 Psychological / Behavioral Intervention Contract 版本；
- Safety Policy 已审核；
- 生产启用的专业规则/FAQ/示范/支持内容有批准版本；
- source/reference 中未审核争议内容不会自动进入生产建议；
- 支持资源已核验。

### Models

- 实际 model ID 已通过 Xiaoshuyin Eval；
- 数据条款、地域和费用确认；
- Structured Output / Tool Calling 实测通过；
- Model Gateway fallback 不改变业务 Gate。

### RAG

- 专业知识来源可追溯；
- hard filter 正确；
- pg_jieba + pgvector + RRF + rerank 中文检索 Eval 通过；
- retired / suspended knowledge 不可用于正式建议。

### Authorization / Data Rights

- 家庭隔离；
- 孩子有限权限；
- Purpose-bound data；
- staff 最小权限；
- Consent 撤回传播；
- 查看/更正/导出/删除真实演练；
- 在线删除 7 天合同和 50 天备份删除重放测试。

### Reliability

- 幂等；
- 并发；
- stale / interrupted model result；
- Problem Formulation / Plan / Contract version concurrency；
- Response Release Contract；
- pg-boss retry；
- notification unknown / Dispatch Gate / quiet-hours；
- backup restore；
- LangGraph checkpoint delete propagation；
- 事实/Consent/Policy 更改对依赖对象的传播。

### Eval / Budget

- Eval Suite 版本、expected/forbidden behavior、责任人已冻结；
- §32 所列硬阻断项全部为 0；
- 04 Case A—J 全部通过；
- pilot_budget_version 已批准且非空；
- MODEL / CLOUD / NOTIFICATION / HUMAN 成本真实记录，UNKNOWN 不补 0；
- 前台 model-call / retry / chain-deadline 预算实测未被跨层放大。

### Safety / Referral

- 明确和模糊风险；
- 执行途中风险；
- AI 故障下静态安全出口；
- Safety Hold 无法被普通模型、主线切换或 Scene routing 解除；
- Referral 点击/发送不冒充 CONNECTED。

### Platform

- 微信登录；
- 实际通知能力；
- 孩子邀请实际能力；
- 实际小程序发布条件；
- 真实云环境；
- 最小内部后台只展示真实具备的人工/审核能力。

未验证就记录 UNVERIFIED / UNKNOWN，不把 Demo 成功写成生产已就绪。


## 41. 最终实现原则

V1 实现必须始终保持：

~~~text
04 产品需求
↓
Common Core + Digital Use Scene Package
↓
Authorization / Consent
↓
Domain Policy + Scene Routing
↓
LangGraph
↓
Context Builder
↓
Professional RAG + Family Memory
↓
Model Gateway + Vercel AI SDK
↓
模型
↓
Decision
↓
服务端验证
↓
Response
↓
Domain Command
↓
PostgreSQL
↓
Follow-up Schedule
↓
pg-boss
↓
真实 Notification
↓
真实 Feedback / A5001-A5002 Review / Outcome
~~~

最重要的边界：

> **04 决定产品行为；06 只能实现，不能改写。**

> **PostgreSQL 决定系统事实。**

> **Scene Node Registry / Routing 决定 A1001—A5002 的确定性流程。**

> **Domain Policy 决定专业硬边界和 Intervention 适用性。**

> **Authorization 决定数据边界。**

> **LangGraph 决定 AI 编排，不决定业务事实和原流程路由。**

> **RAG 解释“为什么/怎么做”，不能代替专业 Gate。**

> **模型负责推理和表达，但不拥有事实、Formulation、Consent、Goal、Plan、Contract、Safety 或 Closure 的最终权力。**

> **V1 不因未来扩展而提前重建平台；先把 Digital Use 纵向切片完整做对，再用第二 Scene 验证复用。**

