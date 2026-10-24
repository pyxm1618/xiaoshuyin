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
- 实时语音；
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
```

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

### 7.8 AI 与质量

```text
ai_runs
model_routing_versions
business_audit_events
data_requests
```

Phoenix 管 Trace / Eval，不作为业务表。

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
- enqueue cleanup/rebuild；
- audit。

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
- stale AI run；
- concurrent plan confirm；
- notification unknown。

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

## 34. 数据删除

### 34.1 用户主动删除

按 04：

> 在线数据在核验范围后 7 天内清除。

删除传播覆盖：

- raw messages；
- assertions；
- plans / case scope；
- derived memory；
- embeddings；
- exports；
- future schedules；
- pg-boss future jobs；
- AI cache / temp context；
- Phoenix 中可识别样本（若存在）。

### 34.2 备份

恢复备份滚动 50 天。

删除在线数据后：

> 备份中的旧副本不用于新业务处理。

恢复时：

> 先重放删除清单，再开放服务。

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

## 37. 非功能目标

V1 初始目标：

| 项 | 目标 |
|---|---|
| 普通 API | 正常网络下快速响应，不被模型调用阻塞 |
| 用户消息持久化 | API 返回成功前已经写库 |
| 新风险输入 | 不等待已有 AI run 完成 |
| AI 普通请求 | 有明确 PROCESSING / SUCCESS / FAILED / STALE 状态 |
| 数据权限 | 跨家庭和无授权访问必须失败 |
| 幂等 | 重试不重复产生业务结果 |
| Follow-up | Worker 重启后计划不丢失 |
| 删除 | 能证明在线清除和派生传播 |
| Observability | 不依赖存储完整敏感正文 |

具体 p95、并发、RPO/RTO：

> 在部署和压测阶段形成真实基线后锁定。

不在设计文档里伪造已经测量的能力。

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

## 39. V1 需求映射

| PRD | 技术落点 |
|---|---|
| R01–R02 | Identity / Family / Authorization / WeChat |
| R03–R04 | Messages / Assertions / Provenance / Correction |
| R05–R10 | Domain Policy / Assessment / LangGraph / RAG |
| R11–R13 | Participants / Plan / Validation / Domain Commands |
| R14–R21 | Tasks / Checkins / Reviews / Follow-up / Versioning |
| R22–R23 | Maintenance / Close / Pause / Lost Contact |
| R24–R26 | Safety / Risk / Referral |
| R27 | LangGraph / Decision-Response / Model Gateway |
| R28 | User + Staff API / UI state contracts |
| R29 | Family Memory / Longitudinal Archive |
| R30 | Scenario Package / Policy Version / Knowledge Governance |
| R31–R33 | Staff Auth / Authorization / Consent |
| R34–R35 | Correction / Export / Delete / Memory invalidation |
| R36 | Transaction / Idempotency / Optimistic Lock |
| R37–R39 | Outcome / Audit / Cost / Trial reporting |
| R40 | Release gates / Eval / Platform verification |

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
- stale model result；
- pg-boss retry；
- notification unknown；
- backup restore；
- delete propagation。

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
