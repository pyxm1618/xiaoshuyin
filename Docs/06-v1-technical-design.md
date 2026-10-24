# 小树荫 V1 技术设计

> 文档性质：**V1 具体实现设计**
>
> 版本：v1.1  
> 更新日期：2026-10-24
>
> 唯一产品需求依据：
> - [04-v1-product-requirements.md](04-v1-product-requirements.md)
>
> 总体技术架构依据：
> - [05-system-architecture.md](05-system-architecture.md)
>
> **本文只实现 V1。V2—V5 的能力即使已在总体架构中预留，也不在本文提前开发。**

---

## 1. V1 实现目标

V1 要交付：

> 家长通过微信小程序发起儿童青少年数字使用问题，在安全、授权和专业规则约束下，完成问题判断、目标、方案、执行、持续跟踪、复盘、调整、维护和真实出口；必要家庭资料可以多年连续使用。

V1 还必须支持：

- 孩子按需有限参与；
- 不同来源陈述分开；
- 长期家庭档案；
- 授权和撤回；
- 安全中断；
- 正确转介；
- 模型失败；
- 长期任务；
- 通知结果未知；
- 并发和重复提交；
- 删除与恢复。

V1 不实现：

- 完整家庭私人空间；
- 多个主要问题并行；
- 其他完整专业场景；
- 相似案例推荐；
- 风险预测模型；
- 语音/录音输入、ASR及实时语音；
- 实时家庭调停；
- 支付；
- 机构平台。

---

## 2. V1 最终技术栈

| 层 | V1 决定 |
|---|---|
| 用户端 | 原生微信小程序 TypeScript / WXML / WXSS |
| 运营端 | React + Vite |
| 服务端 | TypeScript / Node.js + Fastify |
| AI 编排 | LangGraph JS |
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

```text
apps/
  miniprogram/            微信小程序
  operations/             内部运营端
  server/
    api/                   Fastify API
    worker/                pg-boss / 后台 Worker

packages/
  contracts/              API Schema / Zod / 共享类型
  domain/                 领域对象、Commands、不变量
  authorization/          Authorization / Consent
  safety/                 Safety Policy / Risk State
  scenes/
    digital-use/          V1 Scene Specification / Domain Policy
  ai/
    graph/                 LangGraph
    context/               Context Builder
    gateway/               Model Gateway
    providers/             AI SDK provider 配置
    schemas/               Decision / Response Schema
  memory/                 Family Memory / provenance / rebuild
  rag/                    chunk / search / rerank
  notifications/          Notification Adapter
  integrations/           微信、模型、对象存储等
  observability/          Phoenix / metrics / audit hooks

db/
  migrations/

tests/
  domain/
  integration/
  e2e/
  ai-eval/
```

不为每个模块建立独立微服务。

---

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

---

## 5. 领域不变量

实现必须保证：

1. Account、Person、Family 分开。
2. 一个家庭最多一个当前主要未结 Case。
3. Statement、Observation、Fact、Hypothesis 分开。
4. 家长转述不能自动升级为孩子本人事实。
5. UNKNOWN、NOT_COLLECTED、DECLINED 分开。
6. AI 没有业务状态最终写权限。
7. Plan 激活必须经过规则校验和家长确认。
8. Safety Hold 优先于普通流程。
9. 结果、关闭原因、转介状态分开。
10. Follow-up Schedule 是业务真相，Queue 不是。
11. Consent 撤回必须影响后续模型、检索、通知和派生 Memory。
12. 派生 Memory 能追到原始来源。
13. 重复任务不能产生重复业务结果。
14. LangGraph checkpoint 不能覆盖当前业务事实。
15. 任何模型供应商都不能成为不可替换的领域依赖。

---

## 6. 业务状态

### 6.1 Case Status

```text
OPEN
WAITING
PAUSED
LOST_CONTACT
SAFETY_HOLD
CLOSED
```

### 6.2 Phase

```text
INTAKE
ASSESSMENT
GOALS
PLANNING
EXECUTION
REVIEW
MAINTENANCE
```

### 6.3 Outcome

```text
IMPROVED
NO_CHANGE
WORSENED
UNKNOWN
```

### 6.4 Closure Reason

```text
STABLE_IMPROVEMENT
NO_INTERVENTION_NEEDED
USER_WITHDREW
OUT_OF_SCOPE
EXTERNAL_HANDOFF_COMPLETE
```

### 6.5 Referral

```text
PROPOSED
ACCEPTED
CONTACTED
CONNECTED
DECLINED
UNREACHABLE
```

Case Status、Phase、Outcome、Closure、Referral：

> 分开存储，不能互相推导。

### 6.6 状态转换合同

状态枚举只定义“有哪些状态”，以下合同定义“什么条件下才允许改变状态”。所有状态变更必须通过 Domain Command；模型只能提出候选动作。

| 当前状态/阶段 | 命令或事件 | 允许主体 | 必需证据与前置条件 | 目标状态 | 任务/通知副作用 | 必须审计 |
|---|---|---|---|---|---|---|
| OPEN / ASSESSMENT | `WaitForInformation` | 家长请求或 Domain Policy | 必要信息清单非空；缺口来源明确；不是仅因可选提醒缺失 | WAITING，phase 保持 ASSESSMENT，reason=INFORMATION | 取消不再适用的到期推进；保留主动返回入口 | 缺口、Policy version、actor |
| WAITING / 任意 phase | `ResumeAfterInformation` | 有权参与者触发，Domain Command 应用 | 必要 blocker 已实际清除；重新检查授权、Safety、Package | OPEN，恢复原 phase | 重新计算后续 Schedule，不补发过期提醒 | 清除证据、旧/新版本 |
| OPEN/WAITING | `PauseCase` | 家长主账号；Safety 可单独中断 | 明确暂停请求或当前交付条件要求 | PAUSED，保留原 phase | 普通未来 Schedule 暂停；已外发消息无法撤回 | 原因、actor、schedule revision |
| PAUSED | `ResumeCase` | 家长主账号 | 当前授权有效；Safety 非开放风险；Plan/Policy/Package 仍适用；必要 blocker 清除 | OPEN 或 WAITING；phase 恢复 | 重新生成当前有效未来 Schedule | 恢复检查结果 |
| OPEN/WAITING | `MarkLostContact` | 有权工作人员/规则服务，禁止 AI 直接执行 | 至少两个已约定反馈节点无反馈；至少一次真实、已授权联系尝试；不能仅因渠道失败/无许可/一次未回复 | LOST_CONTACT | 停止普通自动联系，保留用户主动返回入口 | 节点、联系尝试、排除条件 |
| LOST_CONTACT | `UserReturned` | 用户行为触发 | 新输入已保存并完成 Safety；重新核对当前 Consent / Policy / Plan | OPEN 或 WAITING | 旧提醒不补发；生成新 Schedule | 返回时间、恢复依据 |
| 任意未关闭状态 | `EnterSafetyHold` | Safety Policy / 有权服务 | 命中确定性风险规则或经审核的风险判断 | SAFETY_HOLD | 立即抑制普通生成、普通任务推进和普通提醒；保留静态安全出口 | 风险证据、规则版本 |
| SAFETY_HOLD | `ResolveRisk` | Safety Policy 指定的有权角色；AI和普通运营无权 | 规定的复核证据已取得；处置记录完整；恢复条件明确；当前授权重新核对 | WAITING，保留原业务 phase | 不自动恢复旧任务；重新校验后再建立新 Schedule | reviewer、证据、Safety Policy、恢复位置 |
| OPEN/WAITING/PAUSED/LOST_CONTACT | `CloseCase(STABLE_IMPROVEMENT)` | 家长确认 + Domain Policy | 有正式 Review；Outcome=IMPROVED；观察窗口完成；关键保护条件未恶化；无开放 Safety；证据可追溯 | CLOSED | 取消普通未来 Schedule；保留维护历史 | Review、Outcome、确认 |
| OPEN/WAITING/PAUSED | `CloseCase(NO_INTERVENTION_NEEDED)` | 家长确认 + Domain Policy | Assessment 明确支持无需当前干预，不以“没反馈”替代 | CLOSED | 取消普通未来 Schedule | Assessment、依据 |
| 任意非 SAFETY_HOLD 未关闭状态 | `CloseCase(USER_WITHDREW)` | 家长主账号 | 明确退出请求；记录当前 Outcome，缺证据时=UNKNOWN | CLOSED | 取消普通未来 Schedule | 退出请求、Outcome |
| OPEN/WAITING/PAUSED | `CloseCase(OUT_OF_SCOPE)` | Domain Policy + 家长知情 | 适用性判断明确超出 V1；提供真实边界/可用支持 | CLOSED | 取消普通未来 Schedule | eligibility 结果 |
| OPEN/WAITING/PAUSED/SAFETY_HOLD | `CloseCase(EXTERNAL_HANDOFF_COMPLETE)` | 有权主体 | Referral 必须有 CONNECTED 的实际衔接证据；点击链接或“已建议”不够 | CLOSED | 停止普通内部推进 | referral evidence |
| CLOSED | `CreateRecurrence` | 家长主账号 | 新问题/复发重新进入；重新核对当前资料与授权 | 创建新的关联 Case；旧 Case 不变 | 新 Schedule 只属于新 Case | previous_case_id、原因 |

Referral 独立使用：

```text
PROPOSED --用户明确接受--> ACCEPTED
ACCEPTED --发生真实联系尝试--> CONTACTED
CONTACTED --取得实际衔接证据--> CONNECTED
任意阶段 --用户明确拒绝--> DECLINED
CONTACTED --真实、合规尝试后仍无法联系--> UNREACHABLE
```

“平台链接被点击”“通知发送成功”“工作人员创建了工单”都不能直接升级为 `CONNECTED`。

专业判断所需的具体时长、改善阈值或临床条件由正式 Domain Policy/专业审核定义；本技术设计不编造医学阈值。

---

## 7. V1 数据模型

V1 只物理建设真正需要的表。

### 7.1 身份与授权

```text
accounts
persons
families
family_members
consent_records
case_participants
staff_assignments
```

### 7.2 个案与证据

```text
cases
case_events
dialogue_messages
assertions
observations
```

`assertions` 使用：

```text
kind:
  STATEMENT
  FACT
  HYPOTHESIS

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
```

如果后续发现 Fact/Hypothesis 查询和约束已经明显不同，再拆表。

### 7.3 方案与执行

```text
goals
plan_versions
tasks
checkins
reviews
outcomes
artifact_dependencies
```

`artifact_dependencies` 保存 Goal / Plan / Task 对以下对象的版本化依赖：

- assertion / observation；
- consent purpose/version；
- policy version；
- package version。

它用于在事实更正、授权撤回或规则停用后精确定位受影响的 ACTIVE 对象，而不是无差别暂停全部 Case。

### 7.4 专业内容

```text
scenario_packages
knowledge_items
policy_versions
knowledge_embeddings
```

### 7.5 长期 Memory

```text
derived_memories
memory_source_links
```

### 7.6 安全与转介

```text
risk_events
referrals
support_resources
```

### 7.7 长期运行

```text
case_followup_schedules
notifications
notification_attempts
outbox_events
```

pg-boss 使用自己的数据库表：

> 不再自研 `jobs + lease + fencing token` 队列表。

### 7.8 AI、质量与试点计量

```text
ai_runs
model_routing_versions
business_audit_events
data_requests
cost_ledger_entries
trial_report_snapshots
```

`cost_ledger_entries` 至少表达：

```text
family_id
case_id
cost_kind          MODEL / CLOUD / NOTIFICATION / HUMAN
amount
currency
cost_status        KNOWN / ESTIMATED / UNKNOWN
price_version
source_ref
occurred_at
```

`trial_report_snapshots` 是可重建的最小统计投影，不保存新的家庭正文；按 04 的 Family / Case / Outcome / 退出 / 失访 / 删除影响口径生成。

Phoenix 管 Trace / Eval，不作为业务表。

### 7.9 核心业务对象合同

下面字段是开发和验收必须满足的业务合同，不要求为每个字段单独建表。

#### Goal

至少包含：

```text
case_id
baseline_refs
target_description
observation_window
protective_conditions
parent_actions
participant_evidence
confirmation_actor
confirmation_at
dependency_refs
```

缺少基线、观察窗口、保护条件或家长自身行动时，不允许把候选 Goal 标记为 CONFIRMED。

#### PlanVersion

至少包含：

```text
goal_id / goal_version
rationale
tasks[]
followup_policy
review_conditions
adjust_conditions
stop_conditions
plan_format       ACTION_PLAN / FAMILY_AGREEMENT
dependency_refs
validation_result
parent_confirmation
```

`FAMILY_AGREEMENT` 是可选形式。用户拒绝家庭合约时，必须允许继续形成 `ACTION_PLAN`，不能把拒签当成拒绝服务。

#### Task

至少包含：

```text
plan_version_id
owner_person_id
action
trigger_or_cadence
observation_method
support_or_barrier_plan
state
due_at?
dependency_refs
```

Task state：

```text
PENDING
IN_PROGRESS
PARTIAL
COMPLETED
NOT_EXECUTED
PAUSED
CANCELLED
NEEDS_REVIEW
```

`PARTIAL` 与 `NOT_EXECUTED` 必须分别保存，不能只用完成百分比推断原因。

#### Checkin

至少包含：

```text
client_submission_id
plan_version_id
task_id?
node_id
submitted_by
execution_state
barriers
observed_changes
new_concerns
source_refs
submitted_at
```

没有反馈时保持 UNKNOWN，不能生成“默认无变化”。

#### Review

至少包含：

```text
case_id
plan_version_id
baseline_refs
checkin_refs
protective_condition_observations
benefit_observations
adverse_observations
outcome_candidate
uncertainty
next_action
reviewer_source
```

例如“屏幕时间下降，但睡眠或冲突明显恶化”时，Domain Policy 必须阻止仅凭屏幕时长把 Outcome 自动写成 IMPROVED。

---

## 8. 数据库关键约束

### 8.1 单一主要 Case

数据库保证：

> 一个家庭最多一个当前主要未结 Case。

不能只靠前端。

### 8.2 Plan 不可原地覆盖

```text
plan_versions
```

只追加版本。

新方案确认后：

- 新版本 ACTIVE；
- 旧版本 SUPERSEDED。

### 8.3 幂等

关键命令使用：

```text
actor_id
+
command_type
+
idempotency_key
```

重复相同请求：

> 返回原结果。

同一个 key 不同请求：

> 409 conflict。

### 8.4 乐观锁

Case / Plan 等关键聚合使用：

> version。

高影响修改要求客户端携带：

> If-Match / expected version。

旧版本请求不能覆盖新状态。

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

## 12. Domain Policy 实现

V1 数字使用场景：

```text
packages/scenes/digital-use/
  evidence.ts
  eligibility.ts
  assessment.ts
  goal.ts
  plan.ts
  review.ts
  closure.ts
  safety.ts
```

每个 Policy 必须：

- 版本化；
- 可测试；
- 不依赖自由模型输出才能生效；
- 能说明缺什么；
- 能返回允许动作；
- 能返回禁止动作。

示例：

```ts
type PolicyResult = {
  allowed: boolean
  missingEvidence: string[]
  blockers: string[]
  allowedActions: string[]
  reasonCodes: string[]
}
```

---

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

---

## 15. LangGraph V1 设计

LangGraph 只保存最小 AI 工作状态。

建议 State：

```ts
type ConsultationState = {
  caseId: string
  familyId: string
  actorId: string
  purpose: string

  domainPhase: string
  currentTask: string

  missingEvidence: string[]
  allowedActions: string[]

  decision?: DecisionEnvelope
  responseStatus?: string

  inputRevision: number
  policyVersion: string
}
```

不把完整：

- Family；
- Plan；
- Messages；
- Consent；

长期复制进 Graph State。

这些每次从业务库重新读取。

---

## 16. LangGraph 节点

V1 核心节点：

```text
load_current_state

authorize

safety_precheck

load_domain_policy

load_memory

retrieve_professional_knowledge

build_context

generate_decision

validate_decision

generate_response

persist_allowed_results

schedule_async_followups
```

业务阶段变化由：

> Domain Command

完成。

LangGraph 不直接 UPDATE cases。

---

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

真正修改业务状态：

```text
ConfirmFact
ConfirmGoal
ActivatePlan
RecordExecution
CompleteReview
PauseCase
ResumeCase
SwitchPrimaryCase
CloseCase
ResolveRisk
```

模型只能：

> request / propose。

不能：

> force。

---

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

### 28.1 身份与家庭

```text
POST /api/v1/auth/wechat
POST /api/v1/auth/logout
GET  /api/v1/me

POST /api/v1/families
GET  /api/v1/families/current
PATCH /api/v1/families/:id/members/:personId
```

### 28.2 Consent

```text
GET  /api/v1/consents
POST /api/v1/consents
POST /api/v1/consents/:id/revoke
```

### 28.3 Case

```text
POST /api/v1/cases
GET  /api/v1/cases
GET  /api/v1/cases/:id

POST /api/v1/cases/:id/messages
POST /api/v1/cases/:id/assessments
POST /api/v1/cases/:id/goals

POST /api/v1/cases/:id/pause
POST /api/v1/cases/:id/resume
POST /api/v1/cases/:id/switch-primary
POST /api/v1/cases/:id/close
POST /api/v1/cases/:id/recurrences
```

### 28.4 Plan / Execution / Review

```text
POST /api/v1/cases/:id/plans/propose
GET  /api/v1/plans/:id
POST /api/v1/plans/:id/confirm

POST /api/v1/cases/:id/checkins
POST /api/v1/cases/:id/reviews
GET  /api/v1/cases/:id/followups
```

### 28.5 AI

```text
GET  /api/v1/ai-runs/:id
POST /api/v1/ai-runs/:id/cancel
POST /api/v1/ai-runs/:id/retry
GET  /api/v1/ai-runs/:id/stream
```

stream endpoint：

> 只释放当前策略允许的 Response 内容。

### 28.6 孩子参与

```text
POST /api/v1/cases/:id/participation-invites
GET  /api/v1/participation-invites/:token
POST /api/v1/participation-invites/:token/accept
POST /api/v1/participations/:id/decline
POST /api/v1/participations/:id/withdraw
GET  /api/v1/participations/:id
POST /api/v1/participations/:id/responses
```

### 28.7 数据权利

```text
POST /api/v1/data-requests
GET  /api/v1/data-requests/:id
GET  /api/v1/data-requests/:id/download
```

### 28.8 Staff

只实现 V1 必需：

- knowledge；
- safety；
- data request；
- assigned case；
- quality review；
- support resource。

不建设完整 CRM。

### 28.9 U01—U14 页面/任务验收合同

页面可以视觉合并，但以下用户任务及状态不可省略。

| 任务 | 核心动作/数据 | 必须覆盖的非理想状态 | 恢复入口 |
|---|---|---|---|
| U01 服务/登录 | service info、真实开放状态、微信登录 | 未开放、登录失败、账号被撤销 | 重试登录/返回公开服务说明 |
| U02 授权 | purpose/scope/consent version | 拒绝可选授权、撤回、必要授权缺失 | 调整授权，不把可选项强制化 |
| U03 家庭资料 | Family/Person/来源 | 未知年龄、关系不确定、无孩子账号 | 保存 unknown/家长转述 |
| U04 Case 总览 | status/phase/blockers/next action | WAITING/PAUSED/LOST/SAFETY/CLOSED | 只显示当前允许动作 |
| U05 交流 | message/run/Decision/Response | AI失败、STALE、INTERRUPTED、离线 | 恢复同一 run 或基于原消息重试 |
| U06 理解/目标 | assertions/conflicts/Goal | 说法冲突、目标不合理、信息不足 | 纠错/补证/修改目标 |
| U07 方案 | PlanVersion/dependencies/validation | 规则失败、依赖失效、拒绝家庭合约 | 普通 ACTION_PLAN / 新版本 |
| U08 任务/反馈 | Task/Checkin | PARTIAL/NOT_EXECUTED/PAUSED/新担忧 | 保存真实反馈，不强制“完成” |
| U09 复盘 | Review/Outcome candidate | 改善与保护条件冲突、UNKNOWN/WORSENED | 继续/调整/重新评估 |
| U10 维护/历史 | maintenance/close/recurrence | 未达结案条件、复发 | 保留旧案并创建关联新案 |
| U11 提醒 | Schedule/Notification capability | 无授权、安静时段、渠道失败/UNKNOWN | 主动返回或合法延期 |
| U12 资料权利 | correct/export/delete | 无权字段、处理中、部分失败 | 查看真实 request 状态 |
| U13 安全/转介 | Safety Hold/referral | 无真实资源、仅建议未衔接 | 静态安全出口/真实状态 |
| U14 孩子参与 | invite/accept/decline/withdraw | 邀请过期、拒绝、撤回、越权 | 家长可行路径继续；权限立即更新 |

所有页面均验证：

> loading / empty / waiting / failure / no-permission / stale-conflict / retry-or-recovery

前端隐藏按钮不能替代服务端 Authorization 和 Domain Policy。

---

## 29. 关键事务

### 29.1 激活 Plan

同一事务：

1. authorize；
2. lock / version check Case；
3. 检查 Goal；
4. 检查 Plan hash；
5. Domain Policy；
6. Safety；
7. 家长确认；
8. ACTIVE 新 Plan；
9. SUPERSEDE 旧 Plan；
10. 创建 Follow-up Schedule；
11. 写 Audit；
12. 写 Outbox。

事务成功以后才：

> 对外表示方案已生效。

### 29.2 主问题切换

同一事务：

- lock Family；
- 当前主 Case → PAUSED；
- 新 Case → primary；
- 递增 schedule revision；
- 取消旧未来 schedule；
- 写原因和 Audit。

任何失败：

> 不允许两个主要 Case。

### 29.3 Consent 撤回

同一业务动作：

- 新 Consent version；
- future access 禁止；
- future Notification 禁止；
- 相关 Derived Memory invalidate；
- 相关 AI run stale；
- 通过 `artifact_dependencies` 定位受影响的 Goal / ACTIVE Plan / Task；
- 受影响对象 → `NEEDS_REVIEW`，阻止对应未来执行和提醒；
- 不依赖该授权的任务继续有效；
- enqueue cleanup/rebuild；
- audit。

撤回不删除“过去曾经发生过的业务历史”，但已经失去合法用途的数据不能继续作为当前建议或任务的有效依据。

### 29.4 事实更正 / 来源失效

当 Assertion / Observation 被更正、删除或失效：

1. 新版本保存，旧版本保留 superseded 关系；
2. Derived Memory 失效并进入重建；
3. 查询 `artifact_dependencies`；
4. 依赖旧版本的 Goal / Plan / Task 标记 `NEEDS_REVIEW`；
5. 对可能造成不适用行动的 ACTIVE Plan，立即抑制受影响任务和未来提醒；
6. 使用当前有效证据和 Policy 重新验证；
7. 有实质变化时创建新 Plan Version，并重新由适当主体确认；
8. 无依赖关系的任务不受影响。

不能因为“Memory 已经重建”就自动认为旧 Plan 仍然有效。

---

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

### 32.1 Domain

- 缺信息；
- 无需干预；
- 主问题不是数字使用；
- 家长目标不合理；
- 执行失败；
- 恶化；
- 退出。

### 32.2 Provenance

- 家长与孩子陈述冲突；
- 转述；
- 更正；
- UNKNOWN。

### 32.3 Privacy

- 跨家庭；
- 跨成员；
- Purpose-bound derived context；
- Consent 撤回。

### 32.4 Safety

- 明确风险；
- 隐晦风险；
- 旧风险恢复；
- 模型漏判。

### 32.5 RAG

- 专业知识召回；
- 错误阶段；
- 错误年龄；
- retired knowledge；
- rerank。

### 32.6 Memory

- 两个月；
- 两年；
- 五年；
- 源数据更正；
- 删除；
- 摘要漂移。

### 32.7 Reliability

- duplicate request；
- worker retry；
- stale / interrupted AI run；
- concurrent plan confirm；
- notification unknown；
- correction/consent dependency invalidation；
- LangGraph checkpoint deletion。

### 32.8 Eval 版本与放行判定

每个 Eval Suite 固定：

```text
suite_version
case_id
scenario
input_fixture
expected_state_or_behavior
forbidden_behavior
review_rubric
review_owner
result
evidence_ref
```

以下任一出现即为**发布阻断**，平均分再高也不能抵消：

- 跨家庭数据泄露；
- 未授权跨成员信息泄露；
- AI 自行 Confirm Fact / Consent / Close Case；
- 未满足条件却解除 Safety Hold；
- retired / suspended / 不适用专业内容形成高影响建议；
- 虚构 referral 已 CONNECTED；
- 状态转换违反 §6.6；
- 明确高风险场景产生危险建议；
- Decision 合法但 Response Release Contract 越权。

确定性权限、状态和安全用例必须全部通过。

自然度、专业解释质量、延迟、成本等非硬阻断指标使用专业人员校准后的量表；在首次真实试点前冻结阈值和责任人，当前文档不编造尚无数据支持的通过率。

模型、Prompt、RAG、Policy、Package 或 Release Contract 发生实质变化后，对应批准版本失效，必须用同一 Suite 重新回归。

---

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

在线删除只有在：

1. 各已知副本处理完成或明确记录仍待处理的范围；
2. 最新 Ledger 已可靠写入独立持久化位置；

后才能标记完成。

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

### Phase 1：领域地基

- Account / Person / Family；
- Case；
- Consent；
- Authorization；
- Domain Policy；
- Audit；
- 状态与并发。

### Phase 2：专业和 AI

- digital-use package；
- pg_jieba；
- pgvector；
- Embedding；
- Rerank；
- Context Builder；
- LangGraph；
- Model Gateway；
- AI SDK；
- Decision / Response；
- Eval。

### Phase 3：执行闭环

- Goal；
- Plan；
- Task；
- Checkin；
- Review；
- Outcome；
- Follow-up Schedule；
- pg-boss；
- Notification Adapter。

### Phase 4：长期和安全

- Family Memory；
- memory_source_links；
- Purpose-bound context；
- Safety；
- Referral；
- Phoenix；
- deletion / restore。

### Phase 5：真实小范围验证

只有：

- 专业包；
- 模型；
- 平台；
- 权限；
- 删除；
- 安全；
- 通知；

各自通过真实验证后，才进入真实家庭小范围试点。

---

## 39. V1 需求到合同与验收映射

每条 PRD 需求必须能找到具体合同和可执行验收，不能只映射到模块名。

| PRD | 主要合同 | 关键验收 |
|---|---|---|
| R01 | §28.1、§28.9 U01/U02 | 真微信登录；未开放/失败/撤销授权有真实状态 |
| R02 | §9、§10、§28.9 U03/U14 | Account/Person/Family 分离；孩子拒绝/退出不越权 |
| R03 | §7.2 | 家长转述、孩子本人、记录来源不能相互升级 |
| R04 | §29.4、§14 | 更正保留历史并使受影响 Memory/Plan 失效 |
| R05 | §12、§13 | 必需信息/unknown/适用性由发布 Policy 强制 |
| R06 | §6.6 | 信息不足、无需干预、超范围、安全出口各自可判定 |
| R07 | §8.1、§29.2 | 并发切换后仍只有一个主要 Case |
| R08 | §6.6 | 真正 blocker 才 WAITING；可选提醒缺失不能阻塞普通方案 |
| R09 | §7.9 Goal | 缺基线/观察窗口/保护条件/家长行动不能 ConfirmGoal |
| R10 | §7.9 Plan、§12 | 不可执行任务阻止方案激活或要求调整 |
| R11 | §7.9 Plan/Task、§10 | 家长行动与孩子任务有真实责任主体和来源 |
| R12 | §7.9 Plan | 拒绝 FAMILY_AGREEMENT 后仍可建立 ACTION_PLAN |
| R13 | §29.1 | Policy/Safety/依赖/家长确认缺一不可激活 |
| R14 | §7.9 Task | PARTIAL/NOT_EXECUTED/PAUSED 分开保存并追溯 Plan |
| R15 | §24 | Schedule 节奏按 Case/Plan 配置，不强制统一天数 |
| R16 | §24、§26 | 主动返回与授权提醒分开；拒绝提醒仍能执行 |
| R17 | §26.1/26.2 | 安静时段、频率、UNKNOWN、并发派发测试 |
| R18 | §28.8 | 没有真实人员/授权时不展示“人工正在处理” |
| R19 | §7.9 Checkin | 执行程度、障碍、变化、新担忧、来源和 PlanVersion 齐全 |
| R20 | §7.9 Review | 屏幕下降但睡眠/冲突恶化时不能直接 IMPROVED |
| R21 | §29.1/29.4 | 实质调整创建新版本；依赖变化触发 NEEDS_REVIEW |
| R22 | §6.6 | 稳定结案有 Review/Outcome/保护条件证据；复发新 Case |
| R23 | §6.6 | 一次未回复/渠道失败不能 LOST_CONTACT；恢复重检 |
| R24 | §27 | 新风险抢占已有 AI run；静态安全出口不依赖模型 |
| R25 | §6.6、§27.3 | ResolveRisk 仅有权角色 + 必需证据；AI不能解除 |
| R26 | §6.6 Referral | 点击链接不能 CONNECTED；真实衔接证据才升级 |
| R27 | §17、§18.3 | Decision合法但Response越权必须拦截；流中撤权立即中断 |
| R28 | §28.9 | U01—U14 均覆盖空态/失败/无权/等待/恢复 |
| R29 | §14、§34 | 多年回溯保持来源；派生摘要不是唯一事实源 |
| R30 | §12/§13 | 未发布/停用/不适用 Package 不得进入正式建议 |
| R31 | §9、§28.8 | staff assignment/purpose 限权；跨家庭负向测试 |
| R32 | §28.8 | 只实现专业/安全/权利/质量等 V1 必需后台 |
| R33 | §9、§11、§29.3 | purpose授权先于检索；撤回阻断未来使用 |
| R34 | §29.3/29.4、§14 | 纠错/撤回传播到 Memory 与 ACTIVE Plan/Task |
| R35 | §34、§35 | 枚举全部副本；checkpoint清除；旧备份恢复仍重放删除 |
| R36 | §8、§29、§30 | 重复/并发/部分失败不产生重复业务效果 |
| R37 | §7.8、04 §15.1 | Family/Case 两种分母；退出/失访/UNKNOWN/删除影响不消失 |
| R38 | §7.8、§37.1 | MODEL/CLOUD/NOTIFICATION/HUMAN 四类成本；UNKNOWN 不补0 |
| R39 | §32.8、§37 | 先冻结 Eval/预算/承载门禁，再小范围开放 |
| R40 | §40、§32.8 | 专业/平台/隐私/工程/真实交付证据分别记录；硬阻断不得平均掉 |

06 不新增 PRD 需求。

如果实现过程中发现：

> 某个 V1 产品能力无法可靠实现，

必须回到 04 修订，而不是在代码里静默删除需求。

---

## 40. V1 上线门槛

真实家庭上线前至少确认：

### Professional

- digital-use package 已正式审核；
- Safety Policy 已审核；
- 支持资源已核验。

### Models

- 实际 model ID 已通过 Xiaoshuyin Eval；
- 数据条款、地域和费用确认；
- Structured Output / Tool Calling 实测通过。

### RAG

- 专业知识来源可追溯；
- hard filter 正确；
- 中文检索 Eval 通过；
- retired knowledge 不可召回。

### Authorization

- 家庭隔离；
- 孩子有限权限；
- Purpose-bound data；
- staff 最小权限；
- Consent 撤回。

### Reliability

- 幂等；
- 并发；
- stale / interrupted model result；
- Response Release Contract；
- pg-boss retry；
- notification unknown / Dispatch Gate / quiet-hours；
- backup restore；
- LangGraph checkpoint delete propagation；
- 事实/Consent 更改对 ACTIVE Plan/Task 的依赖传播。

### Eval / Budget

- Eval Suite 版本、预期行为、责任人已冻结；
- §32.8 所列硬阻断项全部为 0；
- `pilot_budget_version` 已批准且非空；
- 前台 model-call / retry / chain-deadline 预算实测未被跨层放大。

### Safety

- 明确风险；
- 模糊风险；
- AI故障下安全入口；
- Safety Hold 无法被普通模型解除。

### Platform

- 微信登录；
- 实际通知能力；
- 实际小程序发布条件；
- 真实云环境。

未验证：

> 就记录未验证。

不把 Demo 成功写成生产已就绪。

---

## 41. 最终实现原则

V1 实现必须始终保持：

```text
产品需求
↓
Domain Policy / Authorization
↓
LangGraph
↓
Context Builder
↓
RAG / Family Memory
↓
Model Gateway
↓
AI SDK
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
真实 Feedback / Outcome
```

最重要的边界：

> **PostgreSQL 决定系统事实。**

> **Domain Policy 决定专业硬边界。**

> **Authorization 决定数据边界。**

> **LangGraph 决定 AI 流程。**

> **模型负责推理和表达，但不拥有业务最终权力。**
