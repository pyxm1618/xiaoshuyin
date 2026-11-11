# Slice 10 — Compliance Feature Policy Foundation

**Feature Directory**: specs/010-compliance-feature-policy-foundation  
**Created**: 2026-11-11  
**Status**: Selection Gate / Specify / Clarify COMPLETE — FROZEN SPEC READY  
**V1 Phase**: Phase 1 — Common Core 地基  
**Stage**: 本轮只做 Selection Gate → Specify → Clarify → Frozen Spec。禁止进入 Plan / Checklist / Tasks / 审计一 / Implement。  
**Authority Docs**: Docs/总产品需求.md → Docs/V1产品需求.md → Docs/总体技术架构.md → Docs/V1技术设计.md → 本 Spec  
**Repository baseline**: origin/main = 8e393c990be53c888c2e68d881bd8b23f9c37638  
**Docs Modified**: NO  
**Scope Expansion**: NO

> 本 Spec 只投影上位文档已经批准的 V1 Compliance Policy 语义，不修改产品语义，不建立第二套年龄、监护、同意、Safety、Authorization 或监管事实源。
>
> 本 Slice 的目标不是实现整个 Compliance Control Plane，而是建立一个真实、版本化、服务端执行、可审计、可被后续 feature 消费的 Feature Compliance Policy Foundation。

---

## 1. Slice Selection Record

### 1.1 Authority Gate

本轮重新读取了四份正式文档及当前 main、Slice 8、Slice 9 的规格/计划与当前相关 runtime。

远端 Authority Gate 结果：

- origin/main = 8e393c990be53c888c2e68d881bd8b23f9c37638
- 与提示词给出的 known baseline 一致
- Input Drift: NONE
- Slice 8 开发分支 feat/008-problem-formulation-core 已基于当前 main 开始真实实现，但尚未进入 main
- Slice 9 plan/009-safety-hold-control-foundation 已完成 Plan / Checklist / Tasks / 审计一，尚未进入 main
- 当前执行环境通过 GitHub repository connector 读取远端权威状态；没有本地 worktree，因此不能伪造本地 git status / git branch 输出。远端分支和 commit 状态以 GitHub 为准

四份 Authority Docs 的本轮关键结论：

1. V1产品需求 §19A 明确要求独立 Compliance Policy / Compliance Gate，不能散落到 Prompt、前端或 Safety。
2. V1产品需求 §19A.1 明确要求每个可能涉及持续拟人化互动的 feature 有版本化 compliance applicability 判断；未确认适用性时不得默认 NOT_APPLICABLE。
3. V1技术设计 §7.7A 明确列出 compliance_feature_policies 及 feature_code、policy_version、anthropomorphic_applicability、minor_access_rule、ai_disclosure_rule、generated_content_label_rule、usage_reminder_rule、effective_at。
4. V1技术设计 §27B 定义 evaluateCompliance 的服务端职责，以及 REQUIRE_MINOR_MODE / REQUIRE_AI_DISCLOSURE / REQUIRE_GENERATED_CONTENT_LABEL / REQUIRE_USAGE_REMINDER / REQUIRE_REGULATORY_EVIDENCE 等结果。
5. V1技术设计 §38 将 Compliance Profile / guardian consent / feature policy 明确列入 Phase 1。
6. V1-C38—V1-C43 均属于 V1 正式要求，不是未来版本候选。

### 1.2 Current Repository Reality

当前 main 的真实状态：

- person_compliance_profiles 已存在并由服务端使用；
- age band 已有 ADULT / MINOR_14_17 / UNDER_14 / UNKNOWN；
- minor_mode 已是服务端状态；
- guardian_person_id 与 guardian consent 已存在真实合同和 runtime；
- assertMinorProcessingAllowed 已存在，UNKNOWN fail-closed，UNDER_14 需要真实有效 guardian consent；
- packages/compliance 已存在，但当前主要覆盖 age gate、guardian consent、notice/evidence、repository；
- compliance_feature_policies 当前不存在；
- evaluateCompliance feature-level policy evaluator 当前不存在；
- 当前没有 feature-level anthropomorphic applicability truth；
- 当前没有 feature-level policy version / effective-period / review-basis truth；
- 当前没有服务端可复用的 feature compliance obligation decision contract；
- Drizzle 当前 main 仍为 PARTIAL：drizzle-orm dependency/config 存在，但 db/schema 尚未进入 main，历史 runtime 主要基于 node-postgres。

### 1.3 Phase 1 Completion Gate

PHASE 1 COMPLETION: NOT COMPLETE

当前还存在以下真实 Phase 1 状态：

| Capability | Status | Slice 10 判断 |
|---|---|---|
| Problem Formulation | 已由 Slice 8 占用，开发中 | 不得重复 |
| Safety control foundation | 已由 Slice 9 占用，READY FOR DEVELOPMENT | 不得重复 |
| Compliance Profile / guardian consent | 已实现 foundation | 作为上游事实源消费 |
| Compliance Feature Policy | 未实现、未被其它 Slice 占用 | 真实未关闭 gap |
| Drizzle foundation | 当前 main PARTIAL；Slice 9 Plan 已冻结 narrow-compliant remediation | 不单独重复切 Slice；若 Slice 9 实施失败则升级 blocker |
| FACT / HYPOTHESIS producer | schema/guard 允许表达，但合法 producer 尚不存在 | 依赖后续 bounded decision / AI，不应现在虚构 |
| Temporal/timezone runtime use | 标准已冻结，当前尚无必须消费它的 Phase 1 feature | 不单独切 Slice |

### 1.4 Candidate Comparison

#### A. Compliance Feature Policy Foundation — SELECTED

- Phase: Phase 1
- Authority: V1产品需求 §19A；V1技术设计 §7.7A、§27B、§32.5A、§38；V1-C38—V1-C43
- Existing dependencies: Compliance Profile、guardian consent、Authorization、PostgreSQL、服务端 package boundary 已存在
- AI dependency: NONE
- Scene dependency: NONE
- Phase 3 / Phase 5 dependency: NONE for policy foundation itself
- Can be deterministic/versioned: YES
- Can be independently tested/audited: YES
- Fake service required: NO
- Second truth risk: controllable；必须消费 existing profile/consent
- Independent closure: YES
- Result: SELECTED

#### B. Drizzle / Data Access Foundation — NOT SELECTED

这是一个真实技术缺口，但 Slice 9 的已冻结 Plan 已明确要求：

- 增加 drizzle-kit；
- 建立 db/schema 的最小真实投影；
- 建立 Drizzle-backed transaction seam；
- Slice 9-owned CRUD 使用 Drizzle query builder；
- reviewed SQL migration 继续是唯一生产 schema change 入口。

因此 Slice 10 不再预先切第二个 Drizzle Foundation。

如果 Slice 9 Implement Gate 证明该 narrow-compliant 方案无法合法落地，则 Slice 9 必须停止，并由一个独立 Data Access Remediation blocker 先于 Slice 10 Implement。不能在 Slice 10 内偷偷解决整个仓库的数据层迁移。

#### C. Full Node Manifest / deterministic routing contract — NOT SELECTED

- 属 Phase 2；
- Design now 理论可行；
- Implement now 不应跨过剩余 Phase 1 gap；
- 当前选择它会让 Phase 2 先于 mandatory Compliance feature policy；
- 不选。

#### D. Assessment / A1001—A2010 — NOT SELECTED

- 属 Phase 2；
- 依赖真实 manifest/routing；
- 依赖 Safety guard；
- 最终 handoff 依赖 Problem Formulation runtime；
- 当前依赖未完全进入 main；
- 不选。

#### E. Goal Core — NOT SELECTED

- Goal / Intervention / Plan 的正式实现顺序在 §38 属后续 Phase；
- Problem Formulation 指向 GOALS 不构成立即开发 Goal 的授权；
- 不选。

#### F. WAITING / Resume — NOT SELECTED

- 缺真实 blocker truth；
- Resume 需要重新检查 Authorization / Safety / package；
- 后续还需要真实 Follow-up Schedule recomputation；
- 现在实现会变成 partial shell；
- 不选。

#### G. LOST_CONTACT — NOT SELECTED

- 缺两个约定反馈节点；
- 缺真实授权联系尝试；
- 缺 notification/contact evidence；
- 当前只能伪造条件；
- 不选。

#### H. Evidence FACT / HYPOTHESIS producer — NOT SELECTED

- 当前 Evidence 模型已经能够表达 FACT / HYPOTHESIS；
- production writer 的缺失是有意 fail-closed；
- 合法 producer 依赖后续 bounded decision / AI /专业判断流程；
- 现在创建 producer 会制造不存在的业务来源；
- 不选。

### 1.5 Selection Result

SELECTED SLICE: 010-compliance-feature-policy-foundation

Why now:

1. 它是 §38 明确列出的 Phase 1 mandatory capability。
2. 当前没有任何其它 Slice 占用它。
3. Slice 8 和 Slice 9 分别已经占用 Problem Formulation 与 Safety，不应重复。
4. 它不需要 AI、Scene、RAG、Human Ops、监管审批 workflow 才能成立。
5. 它可以形成真实数据库事实 + deterministic policy evaluator + fail-closed contract，而不是空接口。
6. 它是后续 A4003、AI feature release、minor-mode enforcement、AI disclosure、generated-content labeling、continuous-use obligations 的共同上游。

---

## 2. Problem / Purpose

当前 V1 已有 person-level Compliance Profile 与 guardian consent，但缺少 feature-level Compliance Policy。

这造成四个真实缺口：

1. 服务端无法回答“这个 feature 是否落入拟人化互动特别规则”。
2. 服务端无法绑定“哪个 policy version 决定了这个 feature 的未成年人/AI disclosure/label/usage reminder 义务”。
3. UNKNOWN applicability 目前没有正式 feature-level fail-closed truth，未来容易被前端、Prompt 或调用方默认为 NOT_APPLICABLE。
4. 后续 A4003、AI content、continuous-use runtime 若直接各自写规则，会形成多套 Compliance truth。

本 Slice 要关闭的是：

> 把 feature-level Compliance Policy 变成一个版本化、可追溯、服务端决定、不可由客户端/Prompt 绕过的正式业务事实，并提供统一 deterministic evaluation contract。

---

## 3. Goal

建立一个 Phase 1 Feature Compliance Policy Foundation，使系统能够：

- 用 server-owned feature identity 定位 exact feature/capability；
- 找到 exact effective policy version；
- 保留 anthropomorphic applicability 的 REQUIRED / NOT_APPLICABLE / UNKNOWN；
- 对 UNKNOWN fail closed；
- 消费现有 Person Compliance Profile、guardian relation、guardian consent，不重建第二套年龄/监护 truth；
- 输出 feature-specific compliance obligations；
- 为后续 AI / Scene / export / continuous-use runtime 提供统一上游 decision contract；
- 保留 review basis / evidence / version provenance；
- 不实现任何未来 runtime consumer 本身。

---

## 4. In Scope

1. compliance_feature_policies 的正式业务语义与版本合同。
2. server-owned Feature Identity contract。
3. feature policy effective version / effective-period semantics。
4. anthropomorphic_applicability:
   - REQUIRED
   - NOT_APPLICABLE
   - UNKNOWN
5. UNKNOWN fail-closed semantics。
6. policy review basis / review evidence provenance。
7. minor access policy capability。
8. AI disclosure obligation capability。
9. generated-content label obligation capability。
10. usage-reminder obligation capability。
11. deterministic evaluateCompliance feature-policy evaluation contract。
12. evaluator 对 existing person_compliance_profiles / guardian consent 的消费合同。
13. generic A4003-compatible capability，但 Common Core 不硬编码 A4003 产品逻辑。
14. policy decision provenance。
15. policy read/runtime least-privilege。
16. no-public-mutation surface。
17. concurrency/effective-version uniqueness。
18. mechanical acceptance tests for policy selection and decision semantics。

---

## 5. Out of Scope

- AI runtime / model calls / Prompt / RAG / embeddings / agent framework。
- Digital Use Scene runtime。
- A4003 页面、roleplay runtime、simulation session。
- 把 DIGITAL_USE_ROLEPLAY_A4003 写死进 Common Core evaluator。
- generated_content_labels runtime table / artifact release pipeline。
- PDF/DOCX/image export implementation。
- continuous-use session runtime。
- cross-device interaction timer。
- “每超过 2 小时”实际提醒发送。
- Notification / pg-boss / Follow-up Schedule。
- PIPIA workflow。
- regulatory_release_evidence workflow。
- filing / registration / platform approval workflow。
- fake compliance officer / fake legal reviewer / fake staff queue。
- regulator portal / admin UI。
- Human Ops。
- Safety State / EnterSafetyHold / ResolveRisk。
- Authorization redesign。
- guardian relationship redesign。
- guardian consent redesign。
- Phase 2—5 feature implementation。
- V2—V5。

---

## 6. Business Objects / Truth Sources

### 6.1 Person compliance truth

唯一来源继续是 existing person_compliance_profiles + guardian consent chain。

本 Slice不得建立：

- second age band；
- second minor-mode state；
- second guardian relation；
- second guardian-consent truth。

### 6.2 Feature compliance truth

唯一 feature-level truth 为 compliance_feature_policies。

每个 published policy version 至少必须能够表达：

- feature identity；
- policy version；
- anthropomorphic applicability；
- minor access rule；
- AI disclosure rule；
- generated-content label rule；
- usage-reminder rule；
- effective_at；
- review decision basis；
- review evidence reference。

精确列名、索引、DDL 属 Plan AI 2，不在本 Spec 冻结。

### 6.3 Regulatory evidence

feature-level applicability policy 与 PIPIA / filing / registration / platform approval / regulatory release evidence 是不同对象。

本 Slice只建立 feature policy provenance，不建立后者的 workflow 或第二套 release truth。

---

## 7. Feature Identity Semantics

Feature identity 必须是 server-owned、稳定、可审计的 identifier。

必须满足：

1. 不能由页面名称、客户端自由字符串、Prompt 或模型临时决定。
2. feature identity 必须能唯一指向一个逻辑 capability。
3. scene-specific feature code 可以作为数据进入通用 evaluator，但 evaluator 不得对 Digital Use node/code 写专用 if/else。
4. policy evaluation 必须绑定 feature_code 与该 feature 的 server-owned contract revision / equivalent version identity。
5. policy_version 是 Compliance Policy 自身版本，不得与 feature contract revision 混为一谈。
6. 如果 feature 的产品语义发生足以改变 compliance applicability 的变化，在新语义对真实用户开放前必须存在新的已审核 policy version；不得沿用旧判断而不复核。
7. 客户端只能触发服务端已经映射到 canonical feature identity 的业务命令，不能直接指定任意 feature_code 来规避 policy。

精确字段实现由 Plan AI 2 决定，但上述语义不可降级。

---

## 8. Policy Version / Lifecycle Semantics

1. published policy version 不允许原地改写历史判断。
2. 新判断通过新 policy_version 表达。
3. 每个 feature identity 在任一 evaluation time 必须最多只有一个 effective policy。
4. effective period 由 effective_at 与后续 superseding version / explicit expiry 等确定；具体存储形态由 Plan AI 2 决定。
5. 如果 evaluation time 找不到 effective policy，必须 fail closed。
6. 如果数据异常导致同时存在多个 effective policy，必须 fail closed，不得任选一条。
7. REQUIRED 与 NOT_APPLICABLE 必须有明确 decision basis 与 review evidence reference。
8. UNKNOWN 表示适用性尚未完成可靠判断；UNKNOWN 绝不等于 NOT_APPLICABLE。
9. UNKNOWN policy 不允许该 feature 以“已经完成合规判断”的状态进入真实 release path。

---

## 9. Applicability Semantics

anthropomorphic_applicability 固定为：

- REQUIRED
- NOT_APPLICABLE
- UNKNOWN

语义：

### REQUIRED

该 feature 已被审核为落入当前 approved anthropomorphic applicability contract。

服务端必须输出与当前政策对应的 obligations。至少包括：

- applicable minor-mode requirement；
- AI identity/disclosure requirement；
- usage-reminder requirement；
- 其它上位 Docs 已明确批准且该 policy 记录要求的 obligation。

### NOT_APPLICABLE

该 feature 已被审核为不适用对应 anthropomorphic special rule。

必须保留：

- policy_version；
- decision basis；
- review evidence；
- effective period。

NOT_APPLICABLE 不允许由 missing row、空值、UNKNOWN、异常或默认逻辑推导出来。

### UNKNOWN

当前没有足够审核结论。

必须 fail closed：

- 不得转换成 NOT_APPLICABLE；
- 不得用客户端 fallback；
- 不得用 Prompt 或模型“自行判断”；
- 不得静默放行需要该判断的真实 feature release。

---

## 10. Minor / Guardian / Age Semantics

evaluateCompliance 必须消费现有 server-side compliance facts。

最低不变量：

- ADULT：不得被误判为 minor。
- MINOR_14_17：minor mode 保持服务端 true；不得仅因年龄自动套用 UNDER_14 guardian-consent requirement。
- UNDER_14：必须先满足现有 guardian relationship + current valid guardian consent gate，再允许后续个人信息/feature processing。
- UNKNOWN：必须 BLOCK；不得按成人处理。
- guardian relationship 继续来自现有 guardian_person_id baseline。
- Family membership 不能替代 guardian relationship。
- verified_source 不能成为 guardian identity proof。
- feature policy 可以施加比 baseline 更严格的 access rule，例如 generic MINORS_BLOCKED，但不能放宽 existing person/consent baseline。

本 Slice不重新实现 assertMinorProcessingAllowed；应复用或组合 existing canonical gate。

---

## 11. A4003 Compatibility Boundary

本 Slice必须提供 future A4003 可消费的通用 capability，但不得把 A4003 硬编码进 Common Core evaluator。

允许：

- Scene-owned policy data 以后以 canonical feature identity 调用通用 evaluator；
- generic minor-access rule 表达“minors blocked”；
- generic disclosure / simulation-adjacent compliance requirements 被下游组合。

禁止：

- Common Core 中出现 if feature == DIGITAL_USE_ROLEPLAY_A4003 then ... 的 scene-specific product branch；
- 本 Slice实现 roleplay；
- 本 Slice创建 A4003 session/persona memory；
- 本 Slice把 simulation output 写入 Statement / Fact / Consent。

A4003 的 adult/guardian-only、SIMULATION 与 minor actor block 仍由后续 Scene/runtime 按上位 Docs 接入本 foundation。

---

## 12. AI Identity / Generated-Content Boundary

本 Slice负责 policy decision contract，不负责内容生成或导出执行。

必须能表达和返回：

- REQUIRE_AI_DISCLOSURE；
- REQUIRE_GENERATED_CONTENT_LABEL。

但本 Slice不实现：

- AI model call；
- generated_content_labels artifact persistence；
- response release pipeline；
- export watermark/metadata；
- signed download。

任何未来 AI runtime / export implementation 必须消费本 foundation 的 policy_version/provenance，且不能静默移除 required label/disclosure。

同时，上位 V1-C38 的“用户可见 AI 生成/实质改写内容必须可区分 AI 身份”是全局产品底线；feature policy 不能把已经明确适用的全局 AI disclosure 降级为不需要。

---

## 13. Continuous-Use Boundary

本 Slice只冻结 policy obligation，不实现 usage-session runtime。

如果 policy 要求 continuous-use control，evaluator 必须能够返回 REQUIRE_USAGE_REMINDER。

本 Slice明确不实现：

- interaction usage session；
- cross-device timer；
- refresh/login continuity；
- 2-hour threshold timer；
- reminder dispatch。

未来 usage runtime 必须遵守：

- 不能以页面生命周期作为唯一计时；
- 刷新、换设备、重新登录不能简单清零；
- 每超过 2 小时的 applicable reminder 由服务端判断。

这些是 downstream execution obligations，不扩大本 Slice。

---

## 14. Authorization Semantics

1. Compliance ALLOW 不等于 Authorization ALLOW。
2. 正常业务调用顺序继续遵守上位架构：
   Authorization / Consent → Compliance Policy → Domain Policy → downstream execution。
3. feature policy 是 server-owned global policy data，不是 Family-owned user data。
4. runtime 应只获得读取当前有效 policy 所需的最小权限。
5. 终端用户不得拥有 feature-policy mutation 权限。
6. 本 Slice不增加 public policy admin API。
7. 本 Slice不发明 staff/compliance-reviewer 角色。
8. policy publication / review provenance 的具体 release mechanism 由 Plan AI 2 在不引入 fake Human Ops 的前提下设计。

---

## 15. Consent / Compliance Semantics

- Existing guardian consent 是 person processing truth，继续保持唯一事实源。
- feature policy 决定 feature-level obligations，不能重建 consent。
- REQUIRE_GUARDIAN_CONSENT 只能由真实 existing consent gate 满足，不得用 boolean placeholder 满足。
- REQUIRE_SEPARATE_CONSENT 的实际 consent workflow 不在本 Slice；若未来 feature policy 需要该 obligation，而对应 workflow 尚不存在，则 downstream 必须 fail closed。
- Compliance Policy 不得由 Prompt、模型或客户端绕过。

---

## 16. Safety Interaction

Compliance 与 Safety 独立。

- Compliance ALLOW 不能解除 SAFETY_HOLD。
- Safety Hold 不能把 UNKNOWN compliance 变成 ALLOW。
- Slice 9 是唯一 Safety control foundation。
- 本 Slice不创建 safety state、risk event、resolver、support resource。
- 后续普通 progression command 必须同时满足 Authorization、Compliance、Safety 等各自 Gate；一个 Gate 的 ALLOW 不覆盖另一个 Gate 的 BLOCK。

---

## 17. Idempotency Expectations

本 Slice没有 end-user mutable command，因此不新增第二套 idempotency store 或新的 public idempotency command。

Policy evaluation 必须是 deterministic / side-effect-free read decision。

Policy publication 是 reviewed version publication，不允许通过普通用户请求原地 mutate active policy。

如果 Plan AI 2 设计受控内部 publish mechanism，则必须复用现有业务幂等/审计基础，不得创建平行 idempotency truth；但本 Spec 不要求本 Slice必须存在 runtime publish command。

---

## 18. Concurrency Expectations

1. 同一 feature identity + evaluation time 必须解析到 0 或 1 个 effective policy。
2. 0 个 effective policy → fail closed。
3. 多个 effective policy → fail closed。
4. evaluation 开始后必须返回它实际使用的 policy_version/provenance。
5. concurrent policy publication 不能让同一个 downstream action 在同一 transaction/snapshot 中混用两个 policy version。
6. 后续 consumer 如果跨 transaction 长时间执行，必须在 release/commit 前按其自身风险重新检查当前 required compliance facts；该 recheck 机制由对应 downstream Slice 实现。

---

## 19. Error Semantics

必须至少区分以下语义类别：

- feature identity unknown / unsupported；
- no effective policy；
- ambiguous effective policy；
- applicability UNKNOWN；
- person compliance profile missing；
- age UNKNOWN；
- guardian consent required / invalid / revoked；
- feature access blocked by policy；
- required downstream compliance capability unavailable；
- internal persistence/evaluation failure。

精确 machine error code / HTTP 映射由 Plan AI 2 决定。

由于本 Slice不新增 public policy lookup API：

- 不得新增 feature-policy enumeration oracle；
- 不得向未授权客户端暴露完整 policy、review evidence 或 person compliance facts；
- downstream 对外错误应遵守对应业务接口已有 anti-enumeration 语义。

---

## 20. Auditability

每次 deterministic evaluation 的返回结果必须携带足够 provenance，至少能追溯：

- canonical feature identity；
- feature contract revision / equivalent server-owned version identity；
- policy_version；
- applicability；
- applied obligation set；
- evaluation time/effective policy identity。

不得把用户敏感原文、家庭对话、未成年人个人内容复制到 generic audit metadata。

Policy version 本身必须保留 decision basis / review evidence reference。

本 Slice不要求“每次 evaluate 都写一条独立数据库 audit event”；后续 consumer 在真正产生业务副作用时必须能够保存所依赖的 policy provenance。

---

## 21. Privacy / Anti-Enumeration

- feature policy 数据不包含家庭聊天正文。
- review evidence reference 不得被用来存 raw child/family sensitive content。
- person age/guardian/consent facts 继续按现有 access boundaries 读取。
- 没有 public feature-policy browsing endpoint。
- downstream 不得通过差异化错误泄露另一个 Person 的 age band、guardian、consent 状态。
- policy evaluator 只接受已经由服务端解析的 actor/person/feature context，不信任客户端声明。

---

## 22. Dependency Map

### 22.1 Upstream dependencies

Hard business dependencies:

- existing Compliance Profile；
- existing guardian consent；
- existing server-side age gate；
- PostgreSQL truth；
- existing authorization boundary。

Design-time relationship:

- Slice 8 不提供本 Slice的业务事实；
- Slice 9 不提供本 Slice的产品语义。

Implementation-time technical dependency:

- Slice 9 已冻结的 Drizzle foundation 应先进入 main，或其 Implement Gate 明确失败并由独立 Data Access Remediation 先关闭。
- migration numbering / shared schema vocabulary 必须以 implementation 当时最新 main 为准。

### 22.2 Downstream consumers

- Phase 2 Digital Use feature policy consumers；
- future A4003；
- Phase 3 AI runtime / Response Release；
- generated-content label pipeline；
- continuous-use runtime；
- export pipeline；
- Phase 5 regulatory release gate；
- future feature-specific minor-mode enforcement。

---

## 23. Functional Requirements

- FR-001: 系统 MUST 只有一个 feature-level compliance policy truth source。
- FR-002: feature identity MUST server-owned；MUST NOT 由客户端/page/prompt/model 自由字符串决定。
- FR-003: evaluation MUST 绑定 exact feature identity 与 feature contract revision/equivalent version identity。
- FR-004: policy_version MUST immutable/versioned；MUST NOT 原地覆盖历史判断。
- FR-005: anthropomorphic_applicability MUST 只使用 REQUIRED / NOT_APPLICABLE / UNKNOWN。
- FR-006: UNKNOWN MUST fail closed；MUST NOT 等价 NOT_APPLICABLE。
- FR-007: REQUIRED / NOT_APPLICABLE MUST 保留 decision basis + review evidence reference。
- FR-008: 任一 evaluation time 对同一 feature identity MUST 最多存在一个 effective policy。
- FR-009: 无 effective policy MUST fail closed。
- FR-010: 多 effective policy MUST fail closed。
- FR-011: evaluator MUST consume existing person compliance profile；MUST NOT 创建 second age/minor truth。
- FR-012: UNDER_14 MUST 继续依赖 current valid guardian consent；MUST NOT 用 feature policy 绕过。
- FR-013: MINOR_14_17 MUST NOT 仅因年龄自动套用 UNDER_14 guardian consent。
- FR-014: UNKNOWN age MUST block。
- FR-015: feature policy MAY impose stricter minor access；MUST NOT 放宽 existing baseline。
- FR-016: evaluator MUST 能表达 REQUIRE_AI_DISCLOSURE。
- FR-017: evaluator MUST 能表达 REQUIRE_GENERATED_CONTENT_LABEL。
- FR-018: evaluator MUST 能表达 REQUIRE_USAGE_REMINDER。
- FR-019: evaluator MUST 能表达 REQUIRE_REGULATORY_EVIDENCE / equivalent fail-closed obligation when policy/review prerequisites are unresolved。
- FR-020: evaluator MUST deterministic，MUST NOT 调用 model/network。
- FR-021: evaluator MUST 返回 policy provenance。
- FR-022: Compliance ALLOW MUST NOT 代替 Authorization / Safety / Domain Policy。
- FR-023: Common Core evaluator MUST NOT 硬编码 A4003/Digital Use scene-specific branch。
- FR-024: 本 Slice MUST NOT 实现 usage-session runtime / timer / reminder dispatch。
- FR-025: 本 Slice MUST NOT 实现 generated-content artifact/export runtime。
- FR-026: 本 Slice MUST NOT 实现 PIPIA/regulatory approval workflow。
- FR-027: 本 Slice MUST NOT 新增 public feature-policy mutation/browse API。
- FR-028: runtime feature-policy persistence MUST 遵守当时 authoritative Drizzle/data-access contract；不得增加 raw-pg-only drift。
- FR-029: runtime role MUST 只有读取 active feature-policy 所需的最小权限；不得拥有普通 mutation 权。
- FR-030: policy data异常、missing、UNKNOWN、内部错误 MUST 返回真实 fail-closed state，MUST NOT 伪造 ALLOW。

---

## 24. Acceptance Scenarios

1. **Given** 一个 server-owned feature identity 存在唯一有效 policy，applicability=NOT_APPLICABLE 且有 decision basis/evidence，**When** evaluateCompliance 执行，**Then** 返回该 exact policy_version/provenance，不产生 anthropomorphic REQUIRED obligations，不调用 AI/network。

2. **Given** 一个 feature policy applicability=REQUIRED，**When** evaluator 执行，**Then** 返回该 policy 配置要求的 minor-mode / AI disclosure / usage reminder obligations；不得由客户端覆盖。

3. **Given** applicability=UNKNOWN，**When** evaluator 执行，**Then** fail closed，结果不得等价 NOT_APPLICABLE/ALLOW。

4. **Given** 没有 effective policy，**When** evaluator 执行，**Then** fail closed。

5. **Given** 数据异常导致同一 feature/time 有两个 effective policies，**When** evaluator 执行，**Then** fail closed，不任选一条。

6. **Given** client 传入一个未被 server-owned mapping 识别的 feature string，**When** downstream 请求进入 Compliance Gate，**Then** 请求不能借该 string 获得 ALLOW。

7. **Given** person age_band=UNKNOWN，**When** feature evaluation 需要 person processing，**Then** BLOCK；不得按 ADULT。

8. **Given** person age_band=UNDER_14 且 guardian consent missing/revoked/invalid，**When** feature evaluation 发生，**Then** BLOCK / REQUIRE_GUARDIAN_CONSENT；feature policy 不得放行。

9. **Given** person age_band=MINOR_14_17 且 baseline profile 合法，**When** policy 仅要求 baseline minor access，**Then** 不得因为年龄自动要求 UNDER_14 guardian consent。

10. **Given** generic policy minor_access_rule 表示 minors blocked，**When** MINOR_14_17 或 UNDER_14 actor 尝试该 feature，**Then** BLOCK；该测试不得依赖 A4003 literal。

11. **Given** policy 要求 AI disclosure / generated-content label，**When** evaluator 执行，**Then** 对应 obligation 出现在结果中；本 Slice不生成内容、不写 artifact label。

12. **Given** policy 要求 usage reminder，**When** evaluator 执行，**Then** 返回 REQUIRE_USAGE_REMINDER；本 Slice不创建 timer/session/notification。

13. **Given** Compliance evaluator 返回 ALLOW，**When** Authorization 或 Safety 仍 BLOCK，**Then** downstream 仍不能执行；Compliance ALLOW 不覆盖其它 Gate。

14. **Given** 同一 feature 发布新 policy_version，**When** 时间进入新 version effective period，**Then** evaluation 返回新 version；旧 version 仍可追溯且未被原地覆盖。

15. **Given** evaluation 产生结果，**When** downstream 保存其业务副作用 provenance，**Then**能够记录 exact feature identity + feature revision + policy_version，而无需保存敏感原文。

16. **Given** repository diff，**When**检查 Slice 10 实现范围，**Then**不存在 AI runtime、A4003 runtime、Scene node、usage timer、Notification、PIPIA workflow、regulatory release workflow、fake staff/compliance queue。

---

## 25. Non-Goals

- 不在本 Slice决定“哪些未来 feature 实际属于拟人化互动”并伪造审核结果。
- 不为了测试方便 seed 虚构的监管/法律结论。
- 不把 Compliance Policy 做成前端 feature flag。
- 不把 Compliance Policy 做成 Prompt instruction。
- 不把 Safety 与 Compliance 合并。
- 不用 Family membership 推断 guardian。
- 不做大而全 Compliance Control Plane。
- 不重构全仓库数据访问层。
- 不提前进入 Phase 2 / 3 / 5。

---

## 26. Open Questions

Open Product Decisions: 0

本轮没有需要 Owner 决策的阻塞性产品歧义。

已经由 Authority Docs 直接回答：

- UNKNOWN applicability 不能默认 NOT_APPLICABLE；
- age UNKNOWN 不能按 adult；
- UNDER_14 guardian consent 是真实前置；
- feature policy 是服务端 Gate；
- A4003 是后续 scene consumer，不应硬编码 Common Core；
- continuous-use runtime 不必为了 feature-policy foundation 同 Slice实现；
- PIPIA/regulatory evidence workflow 与 feature applicability policy 分离。

以下属于 Plan AI 2 / Implement 决策，不是 Owner Clarify：

- exact table columns；
- SQL constraints/index；
- migration number；
- TypeScript type names；
- exact machine error literals；
- policy publication 的 checked-in data / migration representation；
- Drizzle schema file layout；
- test file names。

---

## 27. Future Implement Gate

DESIGN READY 不等于 IMPLEMENT READY。

Slice 10 实现前必须重新核验：

1. latest origin/main；
2. authoritative Docs 无新漂移；
3. Slice 8 merge status；
4. Slice 9 merge status；
5. Slice 9 的 Drizzle Gate 实际落地结果；
6. 如果 Slice 9 Drizzle narrow implementation 失败，Slice 10 MUST BLOCK，先完成独立 Data Access Remediation；
7. db/schema 当前真实内容；
8. drizzle-orm / drizzle-kit locked versions；
9. migration numbering；
10. shared enums / CHECK constraints；
11. current compliance profile / guardian consent schema；
12. authorization vocabulary；
13. runtime DB role / grants；
14. current RLS model；
15. current CI baseline；
16. 当前是否已经出现新的 feature-policy consumer；
17. 不得与 Slice 8/9 争用同一个 migration number；
18. 不得重新建立第二套 Compliance Profile / Safety truth；
19. no public feature-policy admin API；
20. acceptance tests 能机械验证 unknown/missing/ambiguous policy fail-closed；
21. implementation 仍严格停留 Phase 1 foundation。

Implementation status at Spec freeze:

- Slice 8 semantic dependency: NO
- Slice 9 semantic dependency: NO
- Slice 9 technical Drizzle dependency: YES
- Design Dependency Status: PASS
- Implement Gate Status: BLOCKED UNTIL Slice 9 Drizzle foundation is merged or a separate remediation closes the blocker
- For repository sequencing and migration reconciliation, implementation MUST also re-read Slice 8 final merged state if it lands first

---

## 28. Frozen Spec Gate

Authority Gate: PASS on remote repository truth  
Input Drift: NONE  
Selection Gate: PASS  
Selected Slice: 010-compliance-feature-policy-foundation  
Phase: Phase 1  
Specify: COMPLETE  
Clarify: COMPLETE  
Open Product Decisions: 0  
Docs Modified: NO  
Scope Expansion: NO  
Acceptance: MECHANICALLY VERIFIABLE  
Design Dependency Status: PASS  
Future Implement Gate: BLOCKED pending Slice 9 Drizzle foundation / remediation outcome  
Plan: NOT STARTED  
Checklist: NOT STARTED  
Tasks: NOT STARTED  
Audit 1: NOT STARTED  
Implement: NOT STARTED

**SLICE 10 — FROZEN SPEC READY**  
**READY FOR PLAN AI 2**
