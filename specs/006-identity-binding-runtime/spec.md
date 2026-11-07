# Feature Specification: Identity Binding Runtime（受邀既有 Person 的身份绑定运行时）

**Feature Directory**: `specs/006-identity-binding-runtime`  
**Created**: 2026-11-07  
**Status**: Draft — Specify / Clarify  
**V1 Phase**: Phase 1 — Common Core 地基（`Docs/V1技术设计.md` §38；「Invited existing-Person identity binding 属 Phase 1 的身份前置能力」，实现顺序由独立 Slice 批准）  
**Docs baseline**: `Docs/V1产品需求.md` v3.7、`Docs/V1技术设计.md` v3.12  
**Upstream frozen contract**: `specs/005-invited-identity-binding-contract/spec.md`（merged main，Contract only）  
**Stage**: Specify / Clarify only。**禁止进入 Plan / Checklist / Tasks / Analyze / Implement / Remediation / Converge。**

> 本 Spec 是已批准 Xiaoshuyin 文档与已冻结 005 Identity Binding Contract 的**下游 runtime 实现投影**。它把 005 的合同语义转化为「运行时必须具备什么能力、由谁拥有、边界在哪、如何判定」，不新增任何产品语义，不重开 005 的任何裁定。
>
> **编号说明**：`005-invited-identity-binding-contract` 是**冻结合同**，不是 implementation slice，必须原样保留。本 Slice 的编号为 **006**：001 已 merge main；005 已在 main；002 / 003 / 004 已被上游 feature branch 占用。006 承载 005 的 runtime 实现。

---

## Upstream Traceability

| Upstream ID / Section | Source | What this slice implements |
|---|---|---|
| §1.2 参与原则（受邀既有 Person 首次微信身份绑定） | `Docs/V1产品需求.md` | invitation-aware identity bootstrap；token ≠ identity；双确认；Case B / Case C；邀请终态只消费 |
| §1.5 身份与家庭归属边界 | `Docs/V1产品需求.md` | Account ↔ Person 1:1 / Person → Account 0..1；多 Family 仅 schema 能力；V1 多 Family 必须 BLOCK |
| §17.1 / §18.3 | `Docs/V1产品需求.md` | attempt 留痕；attempt 终态 ≠ 邀请终态；identity-binding confirmation ≠ Consent |
| §19A.2 未成年人与不满 14 周岁 | `Docs/V1产品需求.md` | 四类年龄；consent-first；UNKNOWN 不按成人放行；年龄与确认主体矩阵；Gate 1 / Gate 2 |
| V1-C20 / V1-C21 | `Docs/V1产品需求.md` §24 | Account / Person / Family / Participant / Visibility / Purpose / Consent 边界；binding 是独立身份事实；按用途授权 |
| V1-C27 / V1-C28 | `Docs/V1产品需求.md` §24 | 失败返回真实状态；重复 / 并发 / 重试不制造重复业务结果 |
| V1-C39 / V1-C41 | `Docs/V1产品需求.md` §24 | UNDER_14 有效监护人同意前置；guardian consent ≠ identity-binding confirmation；其它 applicable Consent / Compliance 仍执行 |
| V1-C44 | `Docs/V1产品需求.md` §24 | invitation-aware identity bootstrap；candidate recognition；binding 前不得创建 P2 / 普通会话 / active participation；成功只建立 Account↔existing Person |
| U11 | `Docs/V1产品需求.md` §23 | 受邀既有 Person 首次绑定须覆盖拒绝、撤回、过期、越权、绑定失败 |
| §5 不变量 1 / 4 / 5 / 17 / 27 / 28 / 29 | `Docs/V1技术设计.md` | 对象分开；转述不升级；UNKNOWN 不补值；并发不重复；UNDER_14 无同意 BLOCK；Gate 独立；binding 前不建 P2 |
| §7.1 身份与授权 | `Docs/V1技术设计.md` | Account ↔ Person 1:1、Person → Account 0..1；Case B / Case C；binding 只改变 Case C 的 Person→Account；不 rebind |
| §7.7A Compliance 数据 | `Docs/V1技术设计.md` | `guardian_person_id` 是 guardian relationship 唯一基线；`verified_source` 不是 guardian proof；guardian confirmation 语义 |
| §8.5 幂等 | `Docs/V1技术设计.md` | 关键命令 `actor + command_type + idempotency_key`；同 key 同 payload 返回原结果；同 key 不同 payload → 409 |
| §9 授权 | `Docs/V1技术设计.md` | 统一 `authorize()`；identity-binding authorization boundary；anti-enumeration |
| §9.1 PostgreSQL RLS | `Docs/V1技术设计.md` | 家庭隔离第二道防线；`withRlsTransaction`；pending context 不是家庭作用域身份 |
| §10 V1 的孩子参与 | `Docs/V1技术设计.md` | Case B / Case C 分流；Phase A → Gate 1 → Phase B → Gate 2 → Phase C；四类业务结果；attempt 与 invitation 生命周期分离 |
| §23 Domain Commands | `Docs/V1技术设计.md` | 模型只能 request / propose，不能代用户确认 |
| §28.1 身份与家庭 API | `Docs/V1技术设计.md` | 普通 `/auth/wechat` 语义不变；binding 是独立能力；endpoint 形状与 pending context 表达留 Plan |
| §28.8 孩子参与 | `Docs/V1技术设计.md` | Case C accept 前置是 identity binding 已成立；binding PENDING / terminal → active participation = 0 |
| §37.2 可靠性目标 | `Docs/V1技术设计.md` | binding attempt 必须返回真实四类结果；不得部分成功；未绑定 candidate 不得探测 P1 门禁 |
| §38 Phase 1 | `Docs/V1技术设计.md` | invited existing-Person identity binding 属 Phase 1 身份前置能力 |
| §40 上线门槛 | `Docs/V1技术设计.md` | Authorization / Compliance / Platform 三组 binding 验收项 |
| 005 §5.1—§5.7 | `specs/005-invited-identity-binding-contract/spec.md` | 唯一权威顺序、candidate recognition、Age / Pre-gate Matrix、attempt lifecycle、security / audit / invitation authority boundary |
| 005 §7.1—§7.6 / §Acceptance | `specs/005-invited-identity-binding-contract/spec.md` | IB-001—IB-028 合同要求与其 26 个合同级验收场景（本 Slice 不复制，只做 runtime 投影） |
| Slice 1 | `specs/001-family-identity-core/spec.md` | Person / Account / Family / membership / Compliance / Consent / `authorize()` / RLS / 幂等 / 审计基线（已 merged main，runtime 已实现） |
| Slice 4 contract | `specs/004-case-participant-core/contracts/participant-lifecycle-and-identity-seam.md` | invitation 生命周期事实源（pending → accepted / declined / expired；active → withdrawn）；本 Slice 只消费 valid / terminal-unusable |

**Blocking rule**: 本 Spec 不得引入 005 未覆盖、且无法追溯到上表的任何产品语义。无法追溯的扩展一律 `NEEDS UPSTREAM DECISION`，不得实现。

**005 消费声明（不得重开）**：005 的 §5.1 唯一权威顺序、§5.2 Case B / Case C、§5.3 candidate recognition、§5.4 Age / Pre-gate Matrix、§5.5 attempt lifecycle / 幂等 / 并发、§5.6 security / audit / invitation authority、§5.7 multi-family、§6 数据约束、IB-001—IB-028 与 26 个 Acceptance Scenarios 全部**保持原样**。本 Spec 只回答「runtime 如何落地这些已冻结语义、边界在哪、什么可判定」，不复制、不改写、不削弱。

---

## Problem Statement

V1 中大量家庭成员（尤其是孩子）会先以「被邀请 / 被代录 / 未绑定账号」的形式作为既有 Person 存在；他们后来才拥有真实微信 Account。现有普通 `POST /api/v1/auth/wechat` 对 new openid 一律创建 Account + 新 Person，无法知道该 openid 是否对应某个既有 Person。

如果直接把邀请 token、登录邮箱 / 手机 / 昵称、Family membership 或客户端声明当作身份证据，会产生四类不可接受的失败：

1. **错误合并 / 错误认领**：把 Account A 绑定到别人的 Person，造成身份与数据串号；
2. **第二个 Person（P2）**：登录后新建 Person，使同一真实人存在两条人物与两套历史；
3. **错误升级权限**：把身份绑定误当成 Family membership、Case 参与或 Consent；
4. **不可恢复 / 不可审计**：并发、重试、超时、邀请过期后留下半绑定、假成功或不可追溯状态。

同时，孩子参与（Slice 4）已经在合同层面把 `Account↔P1 binding` 作为 Case C accept 的身份前置，并明确等待该 runtime；没有稳定的 runtime contract，Slice 4 只能 BLOCKED。

## Goal

交付一个**独立于普通登录**的 identity binding runtime capability，使「已合法存在、尚无 Account 的既有 Person P1」能够在真实参与邀请上下文中，经 candidate 本人明确确认与年龄矩阵指定的第二方独立辨认后，**恰好一次**建立 `Account A ↔ Person P1`，并满足：

```text
不错误合并 / 不错误认领 / 不错误升级权限
不产生第二个 Person
可审计 / 可幂等 / 可恢复 / 可处理并发
binding 前不产生普通会话或 active participation
```

## Scope

### In Scope

1. **Invitation-aware identity bootstrap capability**：从 participation invitation 进入 Case C 时，在任何普通登录调用之前进入本 capability；只消费 Slice 4 contract 的 `invitation valid` / `invitation terminal-unusable`、目标 Person P1、目标 Family。
2. **Case B 复用 / 拒绝语义的 runtime 执行**：P1 已有 Account B 时，当前已认证 Account 等于 B → 复用既有 binding、不进入 bootstrap、不要求重新双确认；不等于 B → 拒绝、不 rebind、不替换、不创建 active participation。
3. **Case C 的 Phase A → Gate 1 → Phase B → Gate 2 → Phase C runtime 执行**（005 §5.1 唯一权威顺序）。
4. **临时认证上下文（temporary / pending authentication context）的 runtime 持有**：Phase A 只持有本次真实微信认证结果与临时上下文；不得是 Person、不得产生正式 Account、不得签发普通业务会话、不得成为家庭作用域身份。
5. **Binding attempt 作为独立 runtime 事实**：attempt 语义标识、生命周期状态、settled outcome、confirmation 关联与可审计结果必须可持久化回读；不得仅存在于进程内存或非权威日志。
6. **Candidate confirmation 的 runtime 记录**：candidate 对「绑定到本次受邀既有 Person P1」的明确 affirmative；必须与同一 attempt、同一 P1、同一 authenticated WeChat identity、同一 invitation context 一致。
7. **Second-party confirmation 的 runtime 记录**：`target confirmation + candidate recognition`；由年龄矩阵指定主体独立认证后作出；不是 Consent、不是 membership、不是 guardian relationship。
8. **Gate 1 / Gate 2 的确定性执行**：按 005 §5.4 矩阵执行 applicable pre-gate；commit 前重新核验，不得因 Gate 1 通过而豁免。
9. **四类业务结果的 runtime 表达与可判定行为**：`COMMITTED` / `PENDING` / `TERMINAL ATTEMPT REJECTION` / `RETRYABLE OPERATION FAILURE`；PENDING 边界、settled 语义、operation failure 与 attempt expiration 的分离按 005 §5.5。
10. **no-P2、Account ↔ Person 1:1 / 0..1 与「恰好一次 commit」的 runtime 保证**（含数据库层最终防线）。
11. **幂等 / 并发 runtime 语义**：same key same payload、same key different payload、different key same semantic operation、replay after settled、replay while PENDING、retry after RETRYABLE、concurrent same-key、concurrent different-key same-binding。
12. **anti-enumeration 的 runtime 分层**：内部真实结果与 candidate-facing 结果分离；未绑定 candidate 只能得到不可区分的 generic「binding not completed」。
13. **binding 作为独立身份事实**：成功只建立 `Account A ↔ P1`，不创建 Person / Family / membership / guardian / Consent / Case / Participant 权限；下游变化不自动解绑。
14. **安全审计 outcome**：security-relevant attempt 结果可追溯，actor / target Person / attempt / result 可追溯，不记录 secret 与微信敏感凭据。
15. **对 Slice 4 的稳定 downstream contract**：提供 contract-level 可依赖的「binding committed / binding not completed」身份事实与「binding success ≠ participation acceptance」边界。
16. **runtime 能力所需的最小增量基础设施声明**：需要哪些业务能力、为什么需要、谁拥有；物理存储 / 命令类型 / 事件类型的具体表达留给 Plan，且必须经 reviewed migration 增量扩展。

### Out of Scope

- **普通注册流程重构**：不修改 `POST /api/v1/auth/wechat` 的 new openid → Account + Person、existing openid → 复用行为；不得引入 `mode=invite`、隐藏参数或任何开关。
- **OAuth provider 重构 / 新增第三方身份提供方**；**密码 / MFA / 登录方式扩展**。
- **KYC / 实名 / 法定身份核验**：不引入 government-ID / 证件核验、人脸 / 视频验证、电话身份匹配或任何新的外部身份证明 / 敏感数据来源；强度仅为 family-attested identity association。
- **Person / Account / Family 基础语义重建**：不改写 Slice 1 的 Person、Account、Family、`family_members`、guardian、Consent、`authorize()`、RLS、幂等、审计基线。
- **Profile 页面 / Account Settings / 身份中心 UI / 微信小程序页面 / 运营后台 UI**。
- **Person merge 工具 / 管理后台人工合并 / 批量 identity reconciliation / duplicate Person recovery / unlink**。
- **AI 身份判断 / fuzzy matching / 邮箱自动匹配 Person / 手机号自动匹配 Person / 昵称匹配**。
- **Case Participant implementation**：不实现 accept / decline / withdraw / participant lifecycle / participant API（Slice 4 拥有），不定义 participant capability。
- **Case Core / Evidence implementation**：不依赖 Slice 2 Case runtime，不读 Case 内容，不写 Slice 3 Evidence（不产生 STATEMENT / FACT / HYPOTHESIS / OBSERVATION）。
- **Invitation lifecycle**：不创建 / 取消 / 撤回 / 过期邀请，不定义 invitation authorization，不新增 invitation 终态；Slice 4 contract 是唯一事实源。
- **Consent / Compliance 平台扩展**：不新增 Consent 类型、guardian policy、PIPIA、feature policy。
- **通知系统 / invitation email rendering / 微信消息发送 / 通用 workflow engine / 后台 job / 定时器**。
- **多家庭产品能力**：multi-family switching、cross-family identity linking / search / discovery、family merge、shared identity management。
- **V2–V5 capabilities**。

### Non-Goals

- 不把本 Slice 做成通用身份关联平台、通用 attestation 平台或可复用的 identity graph。
- 不为了「以后可能支持成人自助绑定 / 跨家庭认领」预先设计能力或占位结构。
- 不为本 Slice 优化性能基线、容量或成本；只要求确定性正确、可验证门禁、真实失败状态、可审计与可恢复。
- 不提供「登录后自动识别应绑定哪个 Person」的推断能力；不存在任何自动匹配路径。
- 不把 binding attempt 生命周期与 invitation / participation / Case 生命周期合并。
- 不把 candidate recognition 描述或验收为 KYC、实名或政府身份证明。

## Actors

| Actor | 说明 | 在本 Slice 的权限边界 |
|---|---|---|
| **Candidate** | 完成本次真实微信认证、请求绑定到 P1 的人 | 只能作出 candidate confirmation / 取消本次 attempt；binding 前不是 P1、不是正式 Person、不持有普通会话；只能得到 generic「binding not completed」 |
| **Guardian confirmer** | P1 当前 `guardian_person_id` 对应的已认证 Account / Person（UNDER_14 必须；MINOR_14_17 有 guardian 时） | 必须独立认证；只能确认同一 attempt 的 `target confirmation + candidate recognition`；无法独立辨认 → 不得确认；不因此获得 Family / Case 访问 |
| **Family management actor** | 目标 Family 的 V1 管理主体（MINOR_14_17 无 guardian 时的第二方） | 必须独立认证；必须独立辨认 candidate 就是该 Family 所知的 P1；管理权限本身不构成 candidate recognition；无法辨认 → BLOCK |
| **Inviter / Case manager** | 创建参与邀请的 Slice 4 actor | 不参与本 Slice 的绑定确认；不得单独完成 identity binding；本 Slice 不定义其 invitation 权限 |
| **System（本 Slice runtime）** | 确定性执行门禁、记录 attempt、判定四类结果、拒绝非法路径 | 不得代替任何一方确认；不得由 AI / 模型代替确认或判定；不得把技术失败写成业务终态或成功 |

**外部系统 / 依赖（非本 Slice 拥有）**

| 系统 | 对本 Slice 提供 |
|---|---|
| WeChat identity provider | 真实微信认证结果（code → identity） |
| Slice 1 Identity / Compliance / Consent runtime | Person、Account、Family、`family_members`、Compliance Profile、guardian reference、guardian consent、`authorize()`、RLS、幂等、审计基线 |
| Slice 4 participant contract | invitation context、目标 Person P1、目标 Family、`invitation valid` / `invitation terminal-unusable` 事实源 |

## Domain Terminology

**Invited Identity Binding**
: 在真实参与邀请上下文中，把本次已认证微信身份绑定到已合法存在的受邀 Person P1 的独立身份能力；不是普通登录，也不是通用身份关联平台。

**P1**
: 本次参与邀请所指的、已合法存在的既有 Person；用于区分 candidate 与 target Person。

**Case B**
: 邀请目标 Person 已有 Account。当前已认证 Account 等于该 Account 时复用既有 binding；否则拒绝。

**Case C**
: 邀请目标 Person 已合法存在，但当前没有任何 Account 绑定；本 Slice 唯一需要 identity bootstrap 的情形。

**Candidate**
: 完成真实微信认证、请求绑定到 P1 的主体；binding 成立前不是 P1，也不是正式 Person。

**Pending authentication context**
: 微信认证完成、binding 未成立时持有的临时认证结果；不是正式 Person，不产生正式 Account，不产生普通业务会话，不是家庭作用域身份。

**Binding attempt**
: 一次 candidate confirmation 与 second-party confirmation 共同指向的同一绑定请求；以 attempt 语义标识区分，而不是把整个 attempt 生命周期永久固定为同一结果的 operation idempotency key。

**Binding attempt association（Phase B）**
: Gate 1 通过后建立的临时关联：candidate 已认证身份 + P1 + invitation context + binding attempt。它不是 Account↔Person binding、不是普通已认证身份、不是 active participation、不授予任何业务授权。

**Candidate recognition**
: 第二方基于与 P1 既有的现实家庭关系，独立辨认当前这次已认证微信身份的实际使用者就是 P1 的人工确认；独立于 invite token possession、nickname / displayName、Family membership、客户端声称与系统自动推断；不是 KYC / 法定身份核验。

**Second-party confirmation**
: `target confirmation + candidate recognition` 的合成确认；由年龄矩阵指定的独立确认主体在独立认证后作出。

**Guardian relationship**
: P1 当前 Compliance Profile 上的 `guardian_person_id`；不是 Family membership 角色，也不是 `verified_source`。

**Invitation possession**
: 持有或转发邀请 token 的事实；只证明拿到过某次邀请，不证明当前 Account 就是 target Person，也不能决定绑定是否成立。

**Invitation terminal / unusable**
: 由 Slice 4 participant contract 正式定义的 invitation 终态或不可用状态；本 Slice 只消费该状态。

**Settled outcome**
: `COMMITTED` 与 `TERMINAL ATTEMPT REJECTION`；一旦 settled，同一 attempt 的 replay / read-back 返回历史结果，不得改变。

**Operation outcome（RETRYABLE）**
: 单次 operation 的结果尚未可信收敛（timeout / unknown network result / transient failure）；不是 attempt 的永久 settled outcome，也不是第四种 attempt 生命周期状态。

**No-P2**
: invitation-aware flow 在任何阶段都不得创建第二个 Person；Approve 后仅允许 Account 增量 ∈ {0,1}、binding 增量 ∈ {0,1}、Person 增量 = 0。

## Frozen Upstream Contracts

以下语义**已冻结**，本 Slice 不得修改；Plan / Implement 只能实现，不得重新定义。

| # | 冻结项 | 唯一权威 |
|---|---|---|
| F1 | Phase A → Gate 1 → Phase B → Gate 2 → Phase C 的唯一顺序与各阶段边界 | 005 §5.1 |
| F2 | Case B 复用 / 不匹配拒绝；Case C 只走 bootstrap；普通登录先行冲突 | 005 §5.2 |
| F3 | `second-party confirmation = target confirmation + candidate recognition`；独立认证；四要素一致；确认 ≠ Consent | 005 §5.3 |
| F4 | 四类年龄与确认主体矩阵；UNDER_14 无 manager fallback；MINOR_14_17 有 / 无 guardian 分支；ADULT NOT SUPPORTED；UNKNOWN BLOCK；动态重估 | 005 §5.4 |
| F5 | 四类业务结果；PENDING 边界；TERMINAL 覆盖清单；operation timeout ≠ attempt expiration；settled / non-settled；new attempt；并发 commit ∈ {0,1} | 005 §5.5 |
| F6 | binding 只建立 Account↔P1；不授予授权；下游撤销不自动解绑；不设计 unlink | 005 §5.6.1 |
| F7 | 内部结果 ≠ candidate-facing 结果；generic「binding not completed」；不得形成 oracle；确认者最小可见 | 005 §5.6.2 |
| F8 | 审计行为冻结、存储不冻结；不记录 secret；不为 audit FK 创建 Person / Account；不得伪造 / 静默改写 | 005 §5.6.3 |
| F9 | invitation 生命周期归 Slice 4；本 Slice 只消费 valid / terminal-unusable；不得推断 invitation authorization | 005 §5.6.4 |
| F10 | P1 多 Family membership / 不属于目标 Family → BLOCK；schema 级多对多保留 | 005 §5.7 |
| F11 | Account ↔ Person 1:1；Person → Account 0..1；Case C 时 P1 Account = NULL；不 rebind / 不替换 | 005 §6.1 / §6.2、Docs §7.1 |
| F12 | age_band 四值；guardian_person_id 唯一基线；guardian consent 仅 UNDER_14 前置；verified_source 不是 guardian proof | 005 §6.3 |
| F13 | 普通 `/auth/wechat` 语义不变；无 `mode=invite`；不承担识别 / 阻断 Case C | 005 §5.2 第 5 条、Docs §28.1 |

## Runtime Ownership

**本 Slice（006）拥有：**

| 能力 / 事实 | 为什么需要 | 谁拥有 |
|---|---|---|
| Invitation-aware bootstrap capability surface（进入 bootstrap、候选确认、第二方确认、读取 attempt 状态） | Case C 的唯一合法身份入口；普通登录无法承担 | **006** |
| Binding attempt runtime 事实：attempt 语义标识、生命周期状态、settled outcome、confirmation 关联、audit outcome | settled replay、并发收敛、可审计、可恢复；仅内存或日志不足以支撑幂等与证据 | **006** |
| Candidate confirmation 记录 | 证明 candidate 对 P1 的明确确认，且与同一 attempt / 身份 / invitation 一致 | **006** |
| Second-party confirmation 记录（`target confirmation + candidate recognition`） | 证明独立辨认；Gate 2 复核依据 | **006** |
| Gate 1 / Gate 2 的 binding 专用判定编排 | 005 矩阵的确定性执行与 commit 前复核 | **006** |
| Binding commit capability（恰好一次建立 Account↔P1） | 唯一产生最终身份事实的路径 | **006** |
| Anti-enumeration response contract（内部 / 外部结果分离） | 防止未绑定 candidate 探测 P1 门禁 | **006** |
| Binding outcome 审计行为与 provenance 边界 | 安全可追溯；配合 005 §5.6.3 | **006** |
| 对 Slice 4 的 contract-level identity 信号 | Case C accept 前置判定 | **006** |

**本 Slice 不拥有（只消费 / 不修改）：**

| 对象 / 能力 | 拥有者 | 006 的边界 |
|---|---|---|
| Person、Account、Family、`family_members`、Compliance Profile、guardian reference、guardian consent、Consent 记录 | Slice 1 | 只读判定；不新建语义；不修改冻结行为 |
| `authorize()`、`withRlsTransaction`、RLS policy、幂等基础设施、审计基线 | Slice 1 | 增量使用；新增动作 / 命令 / 事件类型必须经 reviewed migration 扩展；不得私建替代基础设施 |
| Invitation 生命周期、invitation token、invitation accept / decline / expire、participant capability | Slice 4 | 只消费 `valid` / `terminal-unusable` 与 P1 / 目标 Family；不建第二套 invitation 模型 |
| Case、Case 管理授权、Case 内容 | Slice 2 | 不依赖；不读取 Case 内容；不修改 Case ownership |
| Evidence（Statement / Observation / Fact / Hypothesis） | Slice 3 | 不写 Evidence；binding 不产生 Evidence |
| 普通登录 / 会话签发 | Slice 1 | 不改变；binding 成功后才允许进入普通已认证身份 |

## Binding Flow（005 §5.1 的 runtime 投影）

### Phase A — Independent WeChat Authentication

1. candidate 从 participation invitation 进入本 capability，完成真实微信认证；runtime 只持有 **pending authentication context** 与本次 authenticated WeChat identity。
2. 此时 runtime MUST NOT 存在：candidate↔P1 关联、P1-specific candidate confirmation、P1-specific 信息展示、P1-specific second-party recognition request、正式 Person、正式 Account、普通业务会话、active participation、Family membership、guardian、Consent、任何业务授权。
3. pending authentication context MUST NOT 被当作 Person、MUST NOT 设置家庭作用域上下文（不得以 candidate 身份读取家庭业务数据）、MUST NOT 签发普通业务会话、MUST NOT 作为 `authorize()` 的家庭身份。
4. invitation possession MUST NOT 构成身份证据；token 不得决定绑定是否成立。

### Gate 1 — Applicable Age / Compliance Pre-gate

5. runtime MUST 先解析 P1 当前 `age_band`，并按 005 §5.4 矩阵执行**对应行**的门禁；任何 P1-specific processing 之前完成。
6. **UNDER_14**：P1 合法存在 → 当前 guardian relationship 存在 → 当前有效 UNDER_14 guardian consent 存在 → 适用 Compliance gate 允许该最小身份绑定处理。全部通过 → 进入 Phase B；任一不满足 → `TERMINAL ATTEMPT REJECTION` + generic candidate-facing 结果。
7. **MINOR_14_17**：P1 合法存在 → applicable Compliance gate 通过；MUST NOT 仅因年龄要求 UNDER_14 guardian consent；其它 applicable Consent / Compliance 仍必须通过。
8. **ADULT** → NOT SUPPORTED（TERMINAL）；**UNKNOWN** → BLOCK（TERMINAL）；不得按成人或未成年人任一分类放行，不得泄露分类。
9. Gate 1 失败时 MUST NOT 记录 P1-specific candidate confirmation、MUST NOT 请求 P1-specific second-party recognition、MUST NOT 建立 candidate↔P1 关联、MUST NOT 产生 Person / Account / 普通会话 / active participation。
10. Gate 1 的 Compliance / Consent / guardian / membership 判定是**服务端可信门禁处理**：读取既有状态以执行门禁属于合规判定必要处理，不构成向 candidate 授权读取家庭数据；其结果不得返回给 candidate，不得成为 oracle。

### Phase B — Temporary Binding Attempt

11. Gate 1 通过后，runtime MUST 先创建 / 取得**同一** binding attempt 的 temporary association：authenticated candidate identity + P1 + invitation context + attempt。
12. association 建立后，才允许 candidate 针对 P1 明确确认，然后请求 second-party `target confirmation + candidate recognition`；两份 confirmation 均属于 Phase B。
13. 该 association ≠ Account↔Person binding；≠ 普通已认证身份；≠ active participation；≠ 业务授权；不得对外表现为已绑定。
14. 两方 confirmation MUST 指向同一 attempt，并共同绑定同一 target Person、同一 authenticated WeChat identity、同一 invitation context；任一不一致 → 拒绝（不进入 commit）。

### Gate 2 — Commit-time Recheck

15. commit 前 runtime MUST 重新核验：age / applicable Compliance、guardian where applicable、consent where applicable、invitation validity、confirmation authority、candidate recognition、Account / Person conflicts。
16. Gate 2 MUST 使用当前状态，不得使用 Gate 1 时的 stale snapshot；Gate 1 通过不豁免 Gate 2；任一失效 → commit blocked，结果按 005 §5.5 判定（不得 PENDING 掩盖失效）。

### Phase C — Commit

17. 全部条件仍成立 → `Account A ↔ Person P1` 正式成立，exactly once。
18. **Account 创建时机**：Case C 的 P1 在 commit 前 Account = NULL；正式 Account MUST 在 Phase C 与 binding 同一事务内创建（若 authenticated identity 尚无正式 Account），不得在 Phase A / Phase B 创建；不得创建「无 Person 的孤立 Account」；不得为已有 Account 创建第二个 Person。
19. 成功 binding MUST NOT 额外创建：Person、Family、membership、guardian、Consent、Case、Participant 权限、Visibility、Purpose。
20. binding 成功后才允许 candidate 进入普通已认证身份（此时 Account A ↔ P1 已成立），并允许其继续 Slice 4 的显式 accept / decline；binding success 本身不产生 active participation。

## Candidate Confirmation

1. **谁是 candidate**：完成本次真实微信认证、请求绑定到 P1 的主体；binding 前不是 P1。
2. **确认什么**：candidate 明确确认「本次绑定到本次受邀的既有 Person P1」；确认命题必须指向 P1 与本次 invitation context，不得泛化为「同意登录」或「同意参与」。
3. **确认的语义边界**：candidate confirmation 是 Phase B 的必要条件，**不是** binding commit 的充分条件；单独存在 MUST NOT 产生 binding、普通会话或 participation。
4. **记录要求**：必须与 attempt、P1、authenticated WeChat identity、invitation context 一致；跨 attempt / 跨 P1 / 跨身份 / 跨 invitation 的 confirmation MUST 被拒绝。
5. **拒绝语义**：candidate 明确拒绝本次绑定 → 该 attempt `TERMINAL ATTEMPT REJECTION`；MUST NOT decline / cancel / expire / withdraw P1 的 invitation；未来参与需新 invitation 或按 Slice 4 政策新 attempt。
6. **取消语义**：candidate 取消自己的 attempt → 该 attempt terminal；不得影响 P1 的 Person、Account、invitation、其他 attempt（若业务政策允许 new attempt）。
7. **不可代持**：second-party / manager / AI / 系统 MUST NOT 代替 candidate 作出 candidate confirmation。

## Second-party Confirmation

1. **谁属于 second party**：由 005 §5.4 矩阵决定 —— UNDER_14 仅当前 guardian；MINOR_14_17 有当前 guardian → 该 guardian，无 → 目标 Family 的 V1 管理主体；ADULT / UNKNOWN 不存在 second party（TERMINAL）。
2. **为什么存在**：candidate 自证不足以证明「本次已认证微信身份的实际使用者就是 P1」；第二方基于与 P1 既有的现实家庭关系独立辨认，防止错误认领与转发邀请冒用。
3. **何时必须**：Case C 的每一次 commit 都必须有第二方 confirmation；UNDER_14 / MINOR_14_17 无例外；Case B 复用既有 binding 时不要求重新双确认。
4. **确认命题（唯一）**：`target confirmation + candidate recognition`；后者必须是「我基于与 P1 既有的现实家庭关系，独立确认当前这次已认证微信身份的实际使用者就是 P1」；MUST NOT 退化为「我批准这个邀请 / binding request」。
5. **资格与独立认证**：second party MUST 独立完成自身认证；candidate 会话不得代持；MUST NOT 由 AI / 模型 / 系统推断代替；guardian confirmer 的 actor MUST 满足 authenticated Account → Account's Person = P1 当前 `guardian_person_id`；`verified_source` MUST NOT 作为 guardian identity proof。
6. **作用域**：只对同一 attempt 生效；不得跨 attempt、跨 P1、跨 invitation 复用；无法独立辨认 candidate 就是 P1 → 不得确认，attempt BLOCKED / TERMINAL。
7. **是否直接改变 Person / Account 关系**：不直接改变。second-party confirmation 是 Gate 条件；只有 Phase C commit 才产生 binding。
8. **可撤销性**：已记录的 affirmative confirmation 是历史事实，MUST NOT 被删除、覆盖或静默改写；若其后确认资格 / 事实不再成立，runtime MUST 使该 attempt 按 005 §5.5 转 `TERMINAL ATTEMPT REJECTION`，MUST NOT 通过「撤回 confirmation」把已 terminal 的 attempt 复活。是否允许「在 commit 前由确认者明确撤销确认」属于 Plan 的交互机制，但不得改变 005 的 settled / non-settled 与 audit 不可伪造语义；本 Spec 不新增 confirmation 撤销这一产品语义。
9. **确认 ≠ Consent**：guardian confirmation MUST NOT 写成 guardian consent；identity-binding confirmation MUST NOT 写成 Consent record。

## Gate 1 / Gate 2

| 维度 | Gate 1 | Gate 2 |
|---|---|---|
| 时机 | Phase A 之后、任何 P1-specific processing 之前 | Phase C commit 之前 |
| 输入 | P1 当前 age_band、P1 合法性、当前 guardian relationship、当前 guardian consent（UNDER_14）、applicable Compliance、P1 目标 Family membership | Gate 1 的全部当前值 + invitation validity + confirmation authority + candidate recognition + Account / Person conflicts |
| PASS | 005 §5.4 对应行全部成立 → 进入 Phase B | 全部仍成立 → commit |
| FAIL | TERMINAL / BLOCK；generic candidate-facing；不建立 P1 关联、不记录 P1-specific confirmation、不请求 P1-specific recognition | commit blocked；按 005 §5.5 判定 TERMINAL；不得 PENDING 等待失效项自动恢复 |
| Retry | 同一 attempt 内不 retry Gate 1；失效后新 attempt 需 invitation valid + 业务政策允许 | 同一 attempt 内不 retry commit 门禁；technical operation failure 走 RETRYABLE / read-back，不是重跑业务门禁 |
| 顺序 | MUST 先于 Phase B；不得跳过 | MUST 晚于 Phase B；不得跳过；Gate 1 通过不免除 |
| 变化处理 | attempt 期间 age_band / guardian / consent / Compliance 变化 → 按矩阵重估；已不满足 → TERMINAL | 必须使用当前状态；stale snapshot 不合法 |

**Gate 独立性**：Gate 1 / Gate 2 是确定性服务端判定；不得由 candidate 提供值、客户端声明、AI 输出或前端状态替代；不得把 Gate 1 的结果缓存到 Gate 2 而不复核。

## State Machine

### 语义状态

| 状态 / 结果 | 归属维度 | 含义 | 是否 settled |
|---|---|---|---|
| `PENDING` | binding attempt lifecycle | attempt 仍合法，仅缺一个未来仍可在**同一 attempt 内**合法补齐的步骤（如等待已授权 second-party confirmation） | 否 |
| `COMMITTED` | binding attempt lifecycle / 业务结果 | binding 成功，`Account A ↔ P1` 建立，exactly once | 是 |
| `TERMINAL ATTEMPT REJECTION` | binding attempt lifecycle / 业务结果 | 该 attempt 永远不能再成功 | 是 |
| `RETRYABLE OPERATION FAILURE` | **operation** 结果 | 某一次 operation 结果尚未可信收敛（timeout / unknown / transient）；attempt 本身仍可能合法 | 否（且不是 attempt 状态） |

> `RETRYABLE` 不是第四种 attempt 生命周期状态。runtime MUST 将「attempt lifecycle」与「operation outcome」分开表达：attempt 的 authoritative outcome 只能是 PENDING / COMMITTED / TERMINAL；RETRYABLE 只描述该次 operation 尚未收敛，retry / read-back 必须解析回当前 authoritative attempt outcome 或继续 RETRYABLE。

### 允许转换

```text
attempt created
  ├─ Gate 1 失败 / 不可逆冲突      → TERMINAL
  ├─ 全部条件已成立且 Gate 2 通过   → COMMITTED
  └─ 仍合法、等待合法确认          → PENDING

PENDING
  ├─ 新合法 confirmation / 授权业务事件 + Gate 2 通过 → COMMITTED
  └─ 失效 / 拒绝 / 冲突 / 邀请终态 / expiration        → TERMINAL

COMMITTED  → 不再转换（settled）
TERMINAL   → 不再转换（settled）
```

**禁止转换（强制）**：

1. `TERMINAL → COMMITTED`；`COMMITTED → TERMINAL`；`TERMINAL → PENDING`；`COMMITTED → PENDING`。
2. `PENDING` 用于掩盖 consent invalid / revoked / expired、identity conflict、multi-family block、ADULT、UNKNOWN、wrong / unauthorized confirmer、candidate recognition explicitly rejected、invitation terminal。
3. `RETRYABLE` 直接写成 `COMMITTED` 或 `TERMINAL`，或在未 read-back 的情况下假设成功 / 假设失败。
4. attempt expiration 之后仍 commit。
5. 用「删除 / 覆盖历史 attempt」使状态看起来一致。

**可 retry**：`RETRYABLE OPERATION FAILURE` → 可 retry / read-back / idempotent resolution（attempt 仍合法时）。
**绝不能自动 retry**：`TERMINAL`（settled）与 `COMMITTED`（settled）；不得因 retry 改变已 settled outcome，也不得把 settled 结果「刷新」为另一结果。

## Idempotency Semantics

| 场景 | 业务结果（必须可判定） |
|---|---|
| same key + same payload（未 settled） | 返回当前 attempt 状态；无重复副作用；不得产生第二条 attempt / 第二份 confirmation / 第二次 commit |
| same key + same payload（已 settled） | 返回历史 settled outcome；不得重新执行 commit / 不得改变 outcome |
| same key + different payload | 拒绝（`IDEMPOTENCY_PAYLOAD_MISMATCH` 语义映射 409，具体 code / envelope 留 Plan）；不得修改原结果 / 原 attempt |
| different key + same semantic operation，已有 non-settled attempt | MUST 收敛到同一 attempt（返回该 attempt 当前状态）；MUST NOT 创建第二个并行 live attempt |
| different key + same semantic operation，旧 attempt terminal 且 invitation valid | MAY 创建 **new binding attempt**（new attempt identity）；MUST NOT 被旧 attempt 唯一性阻塞；旧 attempt replay 仍返回旧结果 |
| replay after COMMITTED | 返回历史 COMMITTED；MUST NOT re-execute commit、MUST NOT revive invitation、MUST NOT 恢复 participation accept、MUST NOT 重建 authorization |
| replay while PENDING | exact duplicate 无重复副作用；新的合法 confirmation / 授权业务事件 MAY 推进同一 attempt；该推进不是 replay |
| retry after RETRYABLE | retry / read-back MUST 收敛到 authoritative attempt outcome（PENDING / COMMITTED / TERMINAL）；不得永久返回 RETRYABLE；不得 double commit |
| retry after TERMINAL | 返回历史 TERMINAL；MUST NOT 重开同一 attempt；new attempt 需 invitation valid + 业务政策允许 |
| concurrent same-key requests | 只产生一个业务结果；其余为 replay；不得重复 confirmation / 重复 commit / 重复 audit |
| concurrent different-key same-binding | 同一 `(P1, authenticated WeChat identity, invitation)` 的 non-settled attempt 至多一个；最终 successful commits ∈ {0,1}；binding increase ≤ 1 |

**边界**：`binding_attempt_id`（语义标识，物理字段名留 Plan）只标识 attempt，不是把整个 attempt 生命周期永久固定为同一结果的 operation idempotency key。MUST NOT 声明 `(P1, authenticated WeChat identity, invitation)` 的**永久全局唯一**约束；但 non-settled 期间必须收敛为至多一个 live attempt。

## Concurrency Semantics

| 竞争 | 必须的业务结果 | 数据库层最终保证要求（机制留 Plan，但必须存在） |
|---|---|---|
| 两个请求同时试图绑定同一 Account | 至多一个 commit；不得出现一个 Account 对应两个 Person | 唯一约束（Account → Person / Person → Account 双向唯一）必须在数据库层拒绝第二个绑定 |
| 两个请求同时试图认领同一 P1 | 至多一个 commit；另一端 `TERMINAL` | 对 P1 的 Account 空位必须用条件更新 / 行锁 / 唯一约束之一在数据库层收敛；影响行数 ≤ 1 |
| 同一 invitation 被重复使用 | 同一 attempt 幂等收敛；不得重复 commit；不得把 invitation 当作可重复消费的授权 | attempt 状态条件更新 + 幂等键；不得仅靠应用层先查再写 |
| candidate confirmation 与 second-party confirmation 并发 | 两份确认可先后到达；只有全部成立 + Gate 2 通过才 commit；不得 double commit | attempt 行锁 / 版本条件更新；confirmation 记录唯一性 |
| commit 与 retry 并发 | 只允许一个 commit；另一方收敛到同一 settled outcome | commit 必须在事务内以条件更新 / 行锁保证 exactly once |
| 两个不同 Account 同时认领同一 existing Person | `successful commits ∈ {0,1}`；另一个 TERMINAL | P1 的 Account 绑定必须由数据库唯一 / 条件更新收敛 |
| 同一 Account 同时匹配两个 Person | 至多一个 binding；另一个 identity conflict → TERMINAL | 唯一约束 + 条件更新 |

**强制原则**：上述收敛 MUST NOT 只依赖应用层「先查询再写入」。必须在数据库层存在唯一约束、条件更新或等效串行化机制；具体约束 / 锁 / 索引 / 隔离级别留 Plan。并发下 `Person` 增量 MUST 为 0。

## No-P2 Invariant

**P2 指**：同一真实人在受邀绑定路径中被新建的第二个 Person（与既有 P1 重复的人物记录）。

**为什么禁止**：P2 会造成身份、历史、来源、Consent、参与与后续 Case 数据的永久分裂；V1 不提供 duplicate Person recovery，merge / delete / rebind 均不被允许。

**最容易产生 P2 的路径**（runtime 必须逐项防御）：

1. **普通登录先行**：candidate 先完成普通登录（A ↔ P2），再打开 P1 邀请 → 必须 identity conflict，拒绝，不得 merge / delete / rebind。
2. **重试 / 超时**：commit operation 超时后重试，若实现「先建 Person 再绑定」或「先建 Account 再补 Person」，会留下 P2 或孤立 Account。
3. **并发 attempt**：多个 attempt 同时 commit，若没有 DB 层收敛，可能各自创建 Person / 绑定。
4. **失败后重建**：Gate 1 / Gate 2 失败后重试时误把「重试」实现为重新建档。
5. **邀请转发 / 冒用**：错误 candidate 走到 commit，若跳过 P1 空位条件更新，可能覆盖或新建。

**避免 P2 的业务不变量（本 Slice 强制）**：

- invitation-aware flow 任何阶段 `Person 增量 = 0`；不得先建 P2 再 merge / rename / delete。
- Phase A / Phase B MUST NOT 创建 Person 或正式 Account。
- Phase C 只允许「创建或复用恰好一个 Account A」并绑定既有 P1；`Account 增量 ∈ {0,1}`、`binding 增量 ∈ {0,1}`。
- P1 已有 Account 或 Account A 已绑定其它 Person → `TERMINAL`，不 rebind / 不替换 / 不 merge。
- 失败 / 超时 / 取消 / expiration / 并发失败后，不得留下 P2、partial binding、普通会话、active authorization、partial participation。
- 并发下 `commit ∈ {0,1}`；全部失败时 `0 commit` 是合法结果。

## Account ↔ Person Invariant

| 判定 | 结果 | 依据 |
|---|---|---|
| Account 是否允许没有 Person | **不允许**（本 Slice 不得创建孤立 Account） | §1.5「一个 Account 只代表一个 Person」、§7.1 1:1 |
| Person 是否允许暂时没有 Account | **允许**（Case C 的 P1） | §1.5、§7.1 0..1 |
| Account 是否只能绑定一个 Person | **是** | §7.1 1:1 |
| Person 是否只能绑定一个 Account | **是** | §7.1 1:1 |
| 是否允许 rebinding | **不允许** | 005 §5.2 / §6.2、§7.1 |
| 是否允许解绑（unlink） | **本 Slice 不设计、不实现** | 005 §5.6.1 第 3 条 |
| 谁能发起 | candidate（本人） | 005 §5.1 Phase B |
| 谁能确认 | 年龄矩阵指定的 second party | 005 §5.4 |
| 哪一步产生最终业务事实 | **Phase C commit** | 005 §5.1 Phase C |

**Case B 边界**：P1 已有 Account B；当前已认证 Account == B → 复用，不进入 bootstrap、不重新绑定、不要求重新双确认；当前 Account != B → 拒绝、不 rebind、不替换、不创建 active participation。

**Case C 边界**：P1 Account = NULL；只走 bootstrap；commit 前 P1 的 Account 必须仍为空；commit 后满足 1:1 / 0..1。

## Authorization Boundary

1. **统一入口**：本 Slice 的所有业务读写 MUST 先经 Slice 1 的统一 `authorize()`，再在 `withRlsTransaction` 内执行；RLS 存在 MUST NOT 成为跳过 `authorize()` 的理由。
2. **新增授权维度**：identity binding 是独立 Gate，不是 Family membership / guardian relationship / Consent / Case participation；本 Slice 需要的 binding 专用动作必须显式注册到 `authorize()` 的闭集并 fail-closed；未注册动作 / 用途一律拒绝。
3. **pending context 不是家庭身份**：Phase A / Phase B 的 pending authentication context MUST NOT 设置 `app.family_id`、MUST NOT 以 candidate 身份读取家庭业务数据、MUST NOT 签发普通业务会话、MUST NOT 被当作家庭作用域身份。
4. **Gate 1 / Gate 2 的服务端可信判定**：Compliance / Consent / guardian / membership / invitation validity 的读取与判定由服务端门禁执行；结果不得返回给 candidate，不得成为枚举 oracle；不得把该读取扩大为业务数据访问。
5. **second-party 独立认证**：guardian confirmer / Family management actor MUST 在其自身已认证上下文中操作；不得复用 candidate 会话；不得由 candidate 代持。
6. **最小权限**：binding 成功只建立 `Account A ↔ P1`；不创建 Family / Case / Participant / Visibility / Purpose / Consent 授权；后续每个访问仍由既有 `authorize()` 独立判定。
7. **客户端输入只作待验证参数**：invitation 标识、attempt 标识、confirmation 内容等不得因「ID 存在」或「客户端声称」而获得信任；P1、目标 Family、guardian、consent 必须以服务端真实读取为准。
8. **anti-enumeration**：内部结果（`PENDING_SECOND_CONFIRMATION` / `INELIGIBLE` / `IDENTITY_CONFLICT` / `CONSENT_BLOCKED` / `MULTI_FAMILY_BLOCKED` / `INVITATION_EXPIRED` 等语义原因，具体枚举名留 Plan）MUST NOT 以任何可观察差异泄露给未绑定 candidate；对外统一 generic「binding not completed」；文案、状态与「下一步可继续动作」不得成为 oracle。
9. **确认者最小可见**：已授权 second-party / manager MAY 在其自身授权上下文看到完成确认所严格必要的信息；该可见性 MUST NOT 扩散给 candidate 或未授权主体。

## Transaction Boundary

1. **commit 事务**：Gate 2 复核、Account 创建 / 复用、binding 写入、attempt 状态落定、必要 audit outcome 写入 MUST 在**同一事务**内完成；任一写入失败 → 整体回滚，不得部分成功。
2. **不得跨事务拼装**：不得先创建 Account、再另事务绑定；不得先绑定、再另事务写 attempt outcome；不得出现「binding 已存在但 attempt 仍 PENDING」或「attempt COMMITTED 但 Account 未绑定」。
3. **confirmation 事务**：candidate confirmation / second-party confirmation 的写入 MUST 与 attempt 状态推进一致；同一 attempt 的确认不得跨事务提交成「确认已记录但 attempt 不可见」。
4. **幂等记录**：关键命令的幂等结果与业务写入同一事务；不得先写幂等成功再执行业务。
5. **RLS 上下文**：家庭 / Person 相关读取与写入必须在同一事务内以参数化方式设置上下文后执行；禁止事务外设置上下文再从连接池查询。
6. **不得以锁 / 事务为借口泄露**：事务失败时对外仍必须 generic；内部日志不得含 secret / 明文微信凭据。

## Auditability / Provenance

1. **行为冻结、存储不冻结**：security-relevant binding attempt outcomes（COMMITTED / PENDING / TERMINAL / RETRYABLE）MUST 可审计；具体存储位置 / event sink / status view 由 Plan 决定；本 Spec MUST NOT 冻结物理审计表，也 MUST NOT 要求必须复用 `business_audit_events`。
2. **可追溯**：actor（candidate / confirmer）在技术与法律允许范围内 MUST 真实；target Person、binding attempt、结果 MUST 可追溯；PENDING → COMMITTED / PENDING → TERMINAL 的合法推进不属于改写。
3. **不可伪造**：failure / pending / committed 的历史记录 MUST NOT 被伪造或静默改写；replay 不得追加第二组审计；不得通过删除 / 覆盖历史使当前状态「一致」。
4. **不记录 secret**：MUST NOT 记录 token 明文、`wechat_openid` 明文、crypto 材料或任何微信敏感凭据；具体脱敏方式留 Plan。
5. **不为 audit FK 创建对象**：Case C 在任何正式 Account 建立前被 Gate 1 阻断时，系统仍 MUST 具备 auditable security outcome；MUST NOT 为满足审计外键创建 Person / Account。
6. **不削弱 RLS / privacy**：审计存储形态 MUST NOT 降低既有 RLS / 隐私边界；审计记录不得成为跨家庭数据读取路径。

## Failure Semantics

| 失败类别 | runtime 结果 | 必须没有的残留 |
|---|---|---|
| 输入 / invitation 不可用 | 不进入 Phase B；generic candidate-facing；不改变 invitation | P1 关联、confirmation、Person / Account 增量 |
| Gate 1 失败（含 consent invalid / ADULT / UNKNOWN） | `TERMINAL ATTEMPT REJECTION`；generic | P1-specific 信息、confirmation、审计可追溯 outcome 除外无业务残留 |
| candidate 明确拒绝 / 取消 | 该 attempt `TERMINAL` | invitation 状态不变；P1 不变；不产生 P2 |
| second party 拒绝 / 无法辨认 | 该 attempt `TERMINAL` / BLOCK | 不 commit；不产生 partial binding |
| 身份冲突（P1 已绑其它 Account / Account 已绑其它 Person / 普通登录先行） | `TERMINAL`；不 rebind / 不 merge | 既有 A↔P2 与 P1 保持；不创建 active L1 participation |
| multi-family / 不属于目标 Family | BLOCK（`TERMINAL`） | 不泄露其它 Family；不变更 membership |
| invitation terminal（未 COMMITTED） | 不 commit；同一 attempt 返回 terminal；不复活 invitation | 不得产生 binding；不得恢复参与 |
| commit 写入失败 / 事务异常 | 回滚；`RETRYABLE OPERATION FAILURE`（若 attempt 仍合法） | 无 partial Account / binding / attempt settled / 会话 |
| operation timeout / unknown result | `RETRYABLE`，不代表成功或失败 | 不擦除已有效 Phase B confirmation；不自动终止 attempt |
| attempt expiration | `TERMINAL`；不得 commit | 历史 facts 可留存；无 active authorization / session / participation |
| 并发失败方 | `TERMINAL`；commit ∈ {0,1} | 无 P2；binding increase ≤ 1 |

**统一原则**：不得把 UNKNOWN / DECLINED / CONFLICT / timeout / PENDING 写成成功；技术性失败不得自动升级为业务终态；业务终态不得被重放为成功。

## Retry Semantics

1. **只 retry operation，不 retry 已 settled attempt**：`RETRYABLE` 的 retry / read-back 必须解析到当前 authoritative attempt outcome；已 COMMITTED / TERMINAL 的 attempt 不得被 retry 改变。
2. **RETRYABLE 不得擦除有效 confirmation**：已记录的 phase B confirmation 不得因一次技术失败被删除或覆盖。
3. **RETRYABLE 不得假设结果**：不得在 read-back 前伪造成功 / 失败；不得 double commit。
4. **new attempt 条件**：旧 attempt terminal + invitation valid + Slice 4 / 业务政策允许 → MAY 发起 new binding attempt；new attempt 是 new attempt identity，不是旧 attempt 的 replay；MUST NOT 被旧 attempt 的唯一性卡死。
5. **不得自动恢复 consent**：consent invalid / revoked → TERMINAL，不得 PENDING 等待同意后自动继续；新 consent + 新 attempt 由后续合法流程处理。
6. **不得自动重新邀请**：attempt 失败 / 过期不得自动创建或复活 invitation；未来参与必须 new invitation（Slice 4 拥有）。
7. **retry 上限 / 退避 / read-back 机制**：由 Plan 设计；不得引入后台 job / 定时器作为业务终态判定唯一依据。

## Downstream Contract for Slice 4

Slice 4（Case Participant Core）后续**可以依赖**的 contract-level 事实：

| Slice 4 可依赖 | 语义 | 不可依赖 |
|---|---|---|
| **binding COMMITTED** | 存在 `Account A ↔ Person P1`；`actor.personId = P1`；account-backed Person 成立 | attempt 内部原因、confirmation 细节、guardian / consent 状态、attempt 历史 |
| **binding not completed** | PENDING / TERMINAL / RETRYABLE / 未开始；`active participation = 0`；Case C accept 必须 generic 失败 | 具体失败原因；不得据此向 candidate 泄露任何 P1 门禁信息 |
| **binding success ≠ participation acceptance** | binding 成功只解决身份；仍需 P1 显式 accept；不得自动 accept / decline / withdraw | Participant capability、Case 权限、Visibility / Purpose |
| **binding 不因下游变化自动解绑** | participation decline / withdraw、Case close、consent revoke、其它授权撤销不解绑 | 自动 unlink / rebind / merge |
| **attempt 状态查询（服务端内部）** | Slice 4 只可消费「是否 completed」与 Person 标识 | attempt 生命周期细节、confirmation 内容、审计元数据 |

**明确禁止**：本 Slice MUST NOT 定义 / 实现 Slice 4 的 accept / decline / withdraw / participant capability / participant API / Case 权限；MUST NOT 让 Slice 4 复用本 Slice 的内部原因 enum 作为对外错误码；MUST NOT 让 binding 自动产生参与。

**Slice 4 侧要求（只引用，不重定义其能力）**：Case C 的 accept 前置是 binding COMMITTED；binding PENDING / blocked / terminal 时不得产生 active participation；Case B 只消费最终 `actor.personId`。

## Dependencies

### 硬依赖（Implement 前必须满足）

1. **Slice 1 `001-family-identity-core` runtime**：当前 main 上已 Implement 完成（`apps/**`、`packages/**`、`db/migrations/**`、`tests/**` 存在且 tasks 全部完成）。本 Slice 依赖其提供：
   - Person / Account / Family / `family_members`；
   - Compliance Profile / guardian reference / guardian consent / Consent 记录；
   - 统一 `authorize()`、`withRlsTransaction`、ENABLE + FORCE RLS、非 owner / NOBYPASSRLS 运行角色；
   - 幂等基础设施（`actor + command_type + idempotency_key`，同 key 不同 payload → 409）；
   - 审计基线（行为与不可伪造语义；具体表 / 类型可扩展）。
   **Implement 前必须重新验证**（不得假定设计等于可用）：`authorize()` 可安全扩展 binding 专用维度且不影响既有行为；RLS helper 可用；幂等行为已通过；审计基线已通过。
2. **Slice 4 participant contract**（`specs/004-case-participant-core`）：提供 invitation context（目标 Person P1、目标 Family）与 `invitation valid` / `invitation terminal-unusable` 语义；本 Slice 只消费，不拥有 invitation lifecycle。
   **状态说明**：该 contract 当前位于未 merge 的上游 feature branch；本 Spec 只消费其**已冻结的合同语义**。Implement 时必须重新读取当时 final merged `main`；在该 contract 未 merge main 前，本 Slice 的端到端 invitation → binding 验收 MUST 报告 `BLOCKED`，不得以本地分支语义替代。
3. **005 Identity Binding Contract**：已 merge main；本 Slice 的唯一上游身份合同。

### 非硬依赖（不得按编号自动建立）

- **Slice 2 `002-case-core`**：本 Slice 不依赖 Case runtime；不读 Case 内容、不影响 Case ownership / membership / creator / visibility / 权限解析；MUST NOT 因绑定 Person 而重构 Case Core。
- **Slice 3 `003-evidence-core`**：本 Slice 明确不写 Evidence；binding 不产生 Statement / Observation / Fact / Hypothesis；不是硬依赖。

### Slice 4 runtime 尚未实现时的可验证 / 可排序方式

1. 本 Slice MUST 以 **contract-level invitation resolution** 作为唯一 invitation 输入事实：`invitation valid` / `invitation terminal-unusable` + 目标 Person P1 + 目标 Family。不得发明第二套 invitation 模型、不得创建 invitation 表、不得写 invitation 状态。
2. 在没有 Slice 4 runtime 时，本 Slice MUST 用 contract-level fixture / test double 提供该事实，仅用于验证本 Slice 的 domain / runtime 行为：
   - bootstrap routing、Phase A / Gate 1 / Phase B / Gate 2 / Phase C；
   - 四类结果、状态机、幂等、并发、no-P2、anti-enumeration、RLS、audit；
   - Case B 复用 / 拒绝、Case C commit、invitation terminal 后不得 commit。
3. 以下项在 Slice 4 runtime 未实现前 MUST 报告 `BLOCKED`，不得声明 PASS：
   - 真实 invitation token → bootstrap → binding → Slice 4 accept 的端到端链路；
   - active participation 与 binding 的联合验收；
   - 真实微信平台条件下 U11 的「拒绝 / 撤回 / 过期 / 越权」联合验收。
4. 本 Slice 的 tasks（后续阶段）必须把「contract-level 可验证项」与「依赖 Slice 4 runtime 的 BLOCKED 项」分开标注，保证依赖顺序可排序、可审计。

### 明确不得依赖

- 不得依赖尚未实现的 Assessment、Problem Formulation、Scene、Evidence writer、Plan / Task、Notification、AI、RAG、Memory、Safety Hold。
- 不得在 006 分支修改 `Docs/**`、`specs/001~005/**`、Slice 4 文件或私建替代 Family / Consent / RLS / 幂等 / 审计基础设施。

## Requirements

- **FR-001** [UPSTREAM: V1-C44 / §28.1 / 005 IB-001] 本 Slice MUST 提供独立于普通微信登录的 invitation-aware identity binding capability。普通 `POST /api/v1/auth/wechat` MUST 保持既有行为（new openid → Account + Person；existing openid → 复用），MUST NOT 通过 `mode=invite`、隐藏参数或任何开关改变；本 Slice MUST NOT 依赖普通登录识别 / 阻断 Case C。
- **FR-002** [UPSTREAM: V1-C44 / §10 / 005 IB-002] 当用户从 participation invitation 进入 Case C 时，系统 MUST 在调用普通 login 之前 route 到本 capability；no-P2 guarantee MUST 仅适用于该 flow；调用序列中 MUST NOT 出现「先普通登录创建 P2 再绑定」。
- **FR-003** [UPSTREAM: §7.1 / 005 IB-004] Case B：P1 已有 Account B 时，当前已认证 Account == B → MUST 复用既有 binding、MUST NOT 进入 bootstrap、MUST NOT 要求重新双确认；!= B → MUST 拒绝，MUST NOT rebind / 替换 / 创建 active participation。
- **FR-004** [UPSTREAM: §7.1 / 005 IB-002] Case C：P1 Account = NULL 时 MUST 只走 invitation-aware bootstrap；MUST NOT 在 bootstrap 之外创建 P1 的 Account 或绑定。
- **FR-005** [UPSTREAM: §5 不变量 29 / §9.1 / 005 IB-008] Phase A MUST 只持有 pending authentication context 与 authenticated WeChat identity；MUST NOT 创建 Person / 正式 Account / 普通业务会话，MUST NOT 设置家庭作用域上下文、MUST NOT 以 candidate 身份读取家庭业务数据，MUST NOT 建立 candidate↔P1 关联、P1-specific 展示 / confirmation / recognition request。
- **FR-006** [UPSTREAM: §19A.2 / §10 / 005 IB-011 — IB-016] 在任何 P1-specific processing 之前，系统 MUST 按 005 §5.4 矩阵对该 P1 当前 `age_band` 执行对应行 Gate 1；UNDER_14 MUST 校验 P1 合法存在、当前 guardian relationship、当前有效 guardian consent、applicable Compliance；MINOR_14_17 MUST NOT 仅因年龄要求 UNDER_14 guardian consent，其它 applicable Consent / Compliance 仍须通过；ADULT → NOT SUPPORTED；UNKNOWN → BLOCK；任一不满足 → `TERMINAL` + generic，MUST NOT 进入 Phase B。
- **FR-007** [UPSTREAM: §10 / 005 IB-009] Gate 1 通过后，系统 MUST 先建立 / 取得同一 binding attempt 的 temporary association（authenticated candidate identity + P1 + invitation context + attempt），之后才允许 candidate 针对 P1 明确确认；该 association MUST NOT 是 Account↔Person binding、普通已认证身份、active participation 或业务授权。
- **FR-008** [UPSTREAM: §19A.2 / §10 / 005 IB-006 / IB-009] candidate confirmation MUST 指向同一 attempt、同一 P1、同一 authenticated WeChat identity、同一 invitation context；单独确认 MUST NOT 产生 binding / 会话 / participation；跨 attempt / 跨 P1 / 跨身份 / 跨 invitation 的 confirmation MUST 被拒绝；candidate 明确拒绝 / 取消 MUST 最多终止该 attempt。
- **FR-009** [UPSTREAM: §19A.2 / 005 IB-006 — IB-014] `second-party confirmation` MUST 等于 `target confirmation + candidate recognition`；MUST 由 005 §5.4 指定主体在独立认证后作出；MUST NOT 退化为「批准邀请 / 绑定请求」；MUST 独立于 token possession、nickname / displayName、Family membership、客户端声称与系统自动推断；无法独立辨认 → BLOCK；确认 MUST NOT 等价于 Consent；guardian confirmer 的 actor MUST 满足 authenticated Account → Account's Person = P1 当前 `guardian_person_id`，`verified_source` MUST NOT 作为 guardian proof。
- **FR-010** [UPSTREAM: §10 / 005 IB-017] commit 前 MUST 执行 Gate 2，使用当前状态重新核验 age / applicable Compliance、guardian where applicable、consent where applicable、invitation validity、confirmation authority、candidate recognition、Account / Person conflicts；Gate 1 通过 MUST NOT 豁免 Gate 2；任一失效 → commit blocked，MUST NOT PENDING。
- **FR-011** [UPSTREAM: §7.1 / 005 IB-010 / IB-022] 全部条件成立且 Gate 2 通过时，系统 MUST exactly once 建立 `Account A ↔ Person P1`；Case C 的正式 Account MUST 在 Phase C 与 binding 同一事务内创建（若尚不存在），MUST NOT 在 Phase A / B 创建；MUST NOT 创建孤立 Account、第二个 Person、Family / membership / guardian / Consent / Case / Participant 权限；`Person 增量 = 0`、`Account 增量 ∈ {0,1}`、`binding 增量 ∈ {0,1}`。
- **FR-012** [UPSTREAM: §5 不变量 17 / 005 §5.5] binding attempt MUST 作为可持久化回读的 runtime 事实存在：attempt 语义标识、生命周期状态、settled outcome、confirmation 关联、audit outcome MUST 可查询；MUST NOT 仅存在于进程内存或非权威日志；物理存储形态 / 字段名 / enum 名留 Plan。
- **FR-013** [UPSTREAM: 005 IB-018 / IB-019] 业务结果 MUST 封闭为 `COMMITTED` / `PENDING` / `TERMINAL ATTEMPT REJECTION` / `RETRYABLE OPERATION FAILURE`；PENDING MUST 只表示 attempt 仍合法且仅缺可在同一 attempt 内合法补齐的步骤；consent invalid / revoked / expired、identity conflict、multi-family、ADULT、UNKNOWN、wrong / unauthorized confirmer、candidate recognition rejected、invitation terminal MUST NOT PENDING；`COMMITTED` / `TERMINAL` 为 settled，replay MUST 返回历史结果且不得改变 outcome。
- **FR-014** [UPSTREAM: 005 §5.5 / IB-019] `RETRYABLE OPERATION FAILURE` MUST 表示单次 operation 结果尚未可信收敛，MUST NOT 是 attempt 的永久 settled outcome、MUST NOT 是第四种 attempt 生命周期状态；operation timeout MUST NOT 自动终止 attempt、MUST NOT 擦除已有效 Phase B confirmation；attempt expiration MUST 使 attempt `TERMINAL` 且不得 commit。
- **FR-015** [UPSTREAM: 005 IB-020 / IB-021] `Invitation lifecycle` MUST NOT 等于 `Binding attempt lifecycle`；未证明为 P1 的 candidate 的 cancel / reject / identity failure / attempt expiration MUST 最多终止 attempt，MUST NOT decline / cancel / expire / withdraw P1 invitation；invitation terminal 后尚未 COMMITTED 的 attempt MUST NOT commit，已 COMMITTED 的 binding MUST 保持 COMMITTED，same-attempt replay MUST 返回历史 COMMITTED 但 MUST NOT re-execute commit / revive invitation / 恢复 participation accept / 重建 authorization。
- **FR-016** [UPSTREAM: §5 不变量 29 / 005 IB-022 / IB-023] invitation-aware flow MUST 保证 no-P2：binding 前 MUST NOT 创建 P2、普通业务会话、active participation、membership、guardian、Case permission；成功 MUST NOT 先建 P2 再 merge / rename / delete；并发下 `successful commits ∈ {0,1}`、`binding increase ≤ 1`、`Person 增量 = 0`；全部失败时 `0 commit` 是合法结果。
- **FR-017** [UPSTREAM: §7.1 / 005 §5.5] 并发收敛 MUST 在数据库层存在最终保证（唯一约束 / 条件更新 / 行锁 / 等效串行化），MUST NOT 只依赖应用层先查再写；同一 `(P1, authenticated WeChat identity, invitation)` 的 non-settled attempt MUST 至多一个；MUST NOT 声明该三元组的永久全局唯一。
- **FR-018** [UPSTREAM: 005 IB-024 / §5.6.1] 成功 binding MUST 是独立 identity fact，只建立 `Account A ↔ P1`；participation decline / withdraw、Case close、guardian consent revoke、其它下游授权撤销 MUST NOT 自动解绑；本 Slice MUST NOT 设计 unlink / rebind / merge / duplicate Person recovery。
- **FR-019** [UPSTREAM: 005 IB-025 / IB-026 / §5.6.2] 内部结果与 candidate-facing 结果 MUST 分离；未绑定 candidate 只能得到不可区分的 generic「binding not completed」；MUST NOT 泄露 guardian 是否存在、consent 是否有效、age band、multi-family、Person 是否存在、目标 Family 归属、其它 Account 绑定；文案 / 状态 / 「下一步可继续动作」MUST NOT 成为 oracle；已授权 second-party / manager MAY 在其自身授权上下文看到完成确认必需信息，不得扩散。
- **FR-020** [UPSTREAM: §1.5 / 005 IB-027] P1 当前存在多个 Family membership 或不属于目标 Family 时 MUST BLOCK；MUST NOT 选择任一 Family 作为确认权来源；MUST NOT 泄露其它 Family；schema 级多对多保留。
- **FR-021** [UPSTREAM: 005 IB-028] conflict / operation timeout / attempt expiration / cancellation / 任一写入失败时 MUST NOT 留下 P2、partial Account↔Person binding、普通会话、active authorization、partial participant capability、membership、guardian；历史 attempt / confirmation / audit facts MAY 按合法保留策略留存，但 MUST NOT 被静默改写或伪造成成功。
- **FR-022** [UPSTREAM: §8.5 / 005 §5.5] 本 Slice 的关键命令 MUST 遵守 `actor + command_type + idempotency_key`：same key + same payload 返回原结果且无重复副作用；same key + different payload MUST 拒绝（映射 409，具体 code / envelope 留 Plan）；replay / retry 语义 MUST 满足本 Spec `Idempotency Semantics` 全表。
- **FR-023** [UPSTREAM: 005 §5.6.3 / §17.1] security-relevant binding outcome MUST 可审计：actor / target Person / attempt / result 可追溯；MUST NOT 记录 secret / token 明文 / 微信敏感凭据；MUST NOT 为 audit FK 创建 Person / Account；MUST NOT 伪造 / 静默改写历史；审计存储位置 MUST NOT 削弱 RLS / privacy；具体存储由 Plan 决定，本 Slice MUST NOT 要求必须复用 `business_audit_events`。
- **FR-024** [UPSTREAM: §9 / §9.1 / 005 §5.6.1] 所有业务读写 MUST 先经统一 `authorize()`，再在 `withRlsTransaction` 内执行；pending context MUST NOT 作为家庭作用域身份；binding MUST NOT 创建任何业务授权；客户端传入的 invitation / attempt / 身份参数 MUST 只作待验证参数；新增 binding 动作 / 命令 / 事件类型 MUST 显式注册、fail-closed，并经 reviewed migration 增量扩展，MUST NOT 运行时接受未定义值。
- **FR-025** [UPSTREAM: Slice 4 contract / §28.8 / §10] 本 Slice MUST 向 Slice 4 提供稳定 contract-level 信号：「binding COMMITTED（account-backed Person）」与「binding not completed」；binding success MUST NOT 等于 participation acceptance；本 Slice MUST NOT 定义 / 实现 accept / decline / withdraw / participant capability / participant API；Slice 4 MUST NOT 依赖内部原因枚举或 confirmation 细节。
- **FR-026** [UPSTREAM: AGENTS / Constitution III / §38] 本 Slice 的 Implement MUST 在 Slice 1 达到 Implement complete（当前已满足）与 Slice 4 contract 可消费的前提下进行；Slice 4 runtime 未实现时，端到端 invitation → binding → accept MUST 报告 `BLOCKED`，contract-level 验证可进行；MUST NOT 把「设计存在」当成「代码已真实可用」，MUST NOT 私建第二套 invitation 模型。
- **FR-027** [UPSTREAM: 005 §Out of Scope / 本 Spec Non-Goals] 本 Slice MUST NOT 创建或暴露：普通注册重构、OAuth / 密码 / MFA、KYC / 证件 / 人脸 / 电话 / 视频身份、Person merge / unlink / duplicate recovery、AI / fuzzy matching / 邮箱 / 手机 / 昵称自动匹配、Profile / Account Settings / 身份中心 UI、Case Participant implementation、Case Core / Evidence implementation、invitation lifecycle / token / 通知、Consent / Compliance 平台扩展、多家庭产品能力、通用 workflow / job / 定时器、V2–V5 capabilities。
- **FR-028** [UPSTREAM: §37.2 / 005 IB-028] binding attempt MUST 返回真实四类结果，不得部分成功；binding 前 MUST NOT 创建 Person / 普通会话 / active participation；未绑定 candidate MUST NOT 通过响应差异探测 P1 门禁；技术失败 MUST NOT 伪装成功或业务终态。

No requirement may be invented to make implementation easier.

## Key Entities

> 本节只定义**语义层实体与约束**；物理 schema 名、表名、列名、enum 名、索引、约束写法、token 格式、crypto 细节、TTL 数值、审计存储位置**全部留 Plan**。任何物理设计 MUST NOT 改变 005 冻结语义与 Slice 1 冻结基数。

### Binding attempt（语义实体）

1. **标识**：系统生成的 attempt 语义标识；用于区分同一次 binding attempt；不得把整个 attempt 生命周期永久固定为同一结果的 operation idempotency key；物理字段名留 Plan。
2. **关联**：必须关联同一 target Person P1、同一 authenticated WeChat identity、同一 invitation context；四要素一致才允许 commit。
3. **状态**：lifecycle 状态 ∈ {PENDING, COMMITTED, TERMINAL}；settled = COMMITTED / TERMINAL；RETRYABLE 属于 operation outcome，不属于 attempt 状态。
4. **持久化**：必须可回读；用于 settled replay、并发收敛、audit。
5. **历史**：terminal 后 MAY 保留 attempt / confirmation / audit facts；MUST NOT 静默改写 / 伪造。
6. **禁止**：不得承载 Family membership、guardian、Consent、Case / Participant 权限或 Evidence 内容。

### Candidate confirmation（语义实体）

1. 属于同一 attempt；指向 P1 与本次 invitation context。
2. 由 candidate 本人作出；不得代持。
3. 是 Phase B 必要条件，不是 commit 充分条件。
4. 拒绝 / 取消是合法结果，终止 attempt，不影响 invitation。

### Second-party confirmation（语义实体）

1. 属于同一 attempt；由 005 §5.4 指定主体在独立认证后作出。
2. 必须同时表达 `target confirmation` 与 `candidate recognition`；两者不可拆分。
3. 不等于 Consent、membership、guardian relationship。
4. 不可跨 attempt 复用；不可被静默改写。
5. 只作为 Gate 条件，不直接改变 Person / Account。

### Binding outcome / audit record（语义实体）

1. 至少可追溯：result 类别、target Person、attempt、actor / confirmer、发生时间、真实状态。
2. 不记录 secret / token 明文 / 微信敏感凭据。
3. 不得为 audit 外键创建 Person / Account。
4. 存储形态留 Plan；不得削弱 RLS / privacy。

### 复用、本 Slice 只增量使用的既有基础

- `accounts` / `persons` / `families` / `family_members`（Slice 1）：Account↔Person 1:1、Person→Account 0..1；不修改冻结语义。
- `person_compliance_profiles` / `consent_records`（Slice 1）：Gate 1 / Gate 2 的 age_band / guardian_person_id / guardian consent / applicable Compliance 判定输入；不新增 Consent 类型。
- `authorize()` / `withRlsTransaction` / RLS / `idempotency_keys` / audit baseline（Slice 1）：增量使用；新增动作 / 命令 / 事件类型经 reviewed migration。
- invitation context（Slice 4 contract）：只消费 valid / terminal-unusable 与 P1 / 目标 Family；不建第二套 invitation 模型。

## Explicit Exclusions（结构 / 能力枚举）

后续 Plan / Tasks 必须能机械证明本 Slice **不存在**以下越界对象或能力：

1. 普通登录分支改造、`mode=invite`、隐藏身份开关、OAuth provider 扩展、密码 / MFA。
2. KYC / 实名 / 证件 / 人脸 / 视频 / 电话身份匹配或任何新的外部身份证明来源。
3. Person / Account / Family 的重建、merge、unlink、rebind、duplicate recovery、批量 reconciliation。
4. AI / fuzzy matching / 邮箱 / 手机 / 昵称自动匹配 Person。
5. Profile / Account Settings / 身份中心 UI / 小程序页面 / 运营后台 UI。
6. Case Participant implementation、accept / decline / withdraw / participant API / participant capability。
7. Case Core / Case 内容读取 / Case ownership / visibility / 权限解析修改。
8. Evidence 写入（Statement / Observation / Fact / Hypothesis / OBSERVATION）。
9. Invitation 创建 / 取消 / 撤回 / 过期 / token 生成 / 通知发送 / 第二套 invitation 模型。
10. Consent / Compliance 平台扩展、新 Consent 类型、新 guardian policy、PIPIA、feature policy。
11. 多家庭产品能力（switching / linking / search / discovery / merge / shared identity management）。
12. 后台 job / 定时器 / 通用 workflow engine / 第二套审计框架（若 Plan 选择新增专用审计存储，必须证明不是第二套通用框架，且不削弱 RLS）。
13. V2–V5 capabilities。

## Success Criteria

- **SC-001**：Case C happy path 下，`Account↔P1` binding 恰好 +1，`Person` 增量 = 0，`Account` 增量 ∈ {0,1}；binding 前无普通会话、无 active participation、无 P2。
- **SC-002**：Case B 匹配 Account 复用既有 binding、无新 binding / 无新 Person、不要求重新双确认；不匹配 Account 被拒且不 rebind。
- **SC-003**：任何 attempt 的业务结果只能是四类之一；`COMMITTED` / `TERMINAL` replay 返回历史 settled outcome，commit 不重复执行；`PENDING` / `RETRYABLE` 不被冻结为永久结果。
- **SC-004**：no-P2 机械可验证：ordinary-login-first、concurrent attempts、retry after timeout、commit rollback、invitation terminal 重试后 `Person 增量 = 0`、`P2 = 0`、`partial binding = 0`。
- **SC-005**：并发压测下 `successful commits ∈ {0,1}`、`binding increase ≤ 1`；数据库层唯一 / 条件更新可被证明（不是应用层先查再写）。
- **SC-006**：same key + same payload 无重复副作用；same key + different payload 被拒且不改原结果；different key + same semantic op 不产生第二个 live attempt。
- **SC-007**：未绑定 candidate 对 6 类内部原因（guardian 存在性、consent 有效性、age band、multi-family、Person 存在性、target Family 归属）观察不到任何差异；对外统一 generic。
- **SC-008**：`Person 增量 = 0` 在所有失败 / 超时 / 取消 / expiration / 并发失败路径成立；失败后无 P2 / partial binding / 普通会话 / active authorization / partial participation。
- **SC-009**：Gate 1 在任何 P1-specific processing 前执行；Gate 2 在 commit 前以当前状态复核；UNDER_14 consent 失效 / MINOR_14_17 / ADULT / UNKNOWN 分支逐项可判定；`verified_source` 不构成 guardian proof。
- **SC-010**：binding 成功只新增 `Account↔P1`；decline / withdraw / Case close / consent revoke 后 binding 保留；无 membership / guardian / Consent / Case / Participant 新增。
- **SC-011**：审计 outcome 可追溯、无 secret / 无明文 `wechat_openid`、不可伪造、不为 audit 创建 Person / Account；存储位置不削弱 RLS。
- **SC-012**：Slice 4 contract-level 消费可判定：binding COMMITTED → account-backed Person；binding not completed → active participation = 0、accept generic 失败；binding success ≠ participation acceptance。
- **SC-013**：普通登录回归不变：`POST /api/v1/auth/wechat` new / existing openid 行为不变；不存在 `mode=invite` 或隐藏开关。
- **SC-014**：结构 / 能力枚举可机械证明本 Spec 的 13 类 Explicit Exclusions 不存在。

## Acceptance Scenarios

> **与 005 的关系**：005 §Acceptance 的 26 个场景是**合同级验收**，仍是唯一的产品语义判据；本 Spec **不复制、不重写、不削弱**它们。以下 24 个场景是 **runtime 投影**：把 005 的合同结论落到本 Slice 可实现的 runtime 行为、事务、持久化、RLS、审计与 downstream contract 上。每条注明对应 005 场景或 runtime 特有项。

**AS-01 — Case C happy path（UNDER_14）** — **Given** P1 合法存在、Account = NULL、当前 guardian 与当前有效 guardian consent 成立、目标 Family invitation valid，**When** candidate 完成真实微信认证、通过 Gate 1、作出 candidate confirmation，guardian 独立认证并作出 `target confirmation + candidate recognition`，Gate 2 复核通过，**Then** 同一事务内创建 / 复用恰好一个 Account A 并建立 `A↔P1`；`Person 增量 = 0`；binding 前无普通会话 / active participation；attempt 落定为 `COMMITTED`。**对应 005 场景 3、9；runtime 特有：Account creation at commit、single transaction。**
**AS-02 — Case C happy path（MINOR_14_17）** — **Given** P1 为 MINOR_14_17、当前 guardian 存在、无 UNDER_14 guardian consent、其它 applicable Consent / Compliance 通过，**When** candidate 确认、该 guardian 辨认并确认，**Then** binding MAY proceed；MUST NOT 要求 UNDER_14 guardian consent；不新建 guardian；`Person 增量 = 0`。**对应 005 场景 5；runtime 特有：门禁分支可判定。**
**AS-03 — MINOR_14_17 无 guardian** — **Given** 无当前 guardian，**When** candidate 确认、目标 Family 管理主体独立认证并辨认 candidate 就是该 Family 所知的 P1，**Then** 仍可 commit 一个 binding；若管理主体无法独立辨认 → `TERMINAL` / BLOCK；MUST NOT 以管理权限自动批准。**对应 005 场景 6。**
**AS-04 — Candidate rejects（候选拒绝）** — **Given** P1 合法、attempt 处于 `PENDING`，**When** candidate 明确拒绝本次绑定，**Then** 该 attempt `TERMINAL`；invitation 状态不变；MUST NOT decline / cancel / expire / withdraw；不产生 P2 / 普通会话 / active participation；candidate-facing 为 generic。**对应 005 场景 11；runtime 特有：attempt 落定与 invitation 不变可回读。**
**AS-05 — Second party rejects（第二方拒绝 / 无法辨认）** — **Given** attempt `PENDING`、Gate 1 已通过，**When** 已授权 second party 明确拒绝或无法独立辨认 candidate 就是 P1，**Then** attempt `TERMINAL`；不 commit；无 partial binding / Account；invitation 不变；对外 generic。**对应 005 场景 4 / 14 的 rejection 分支；runtime 特有：second-party 独立认证上下文。**
**AS-06 — Invitation invalid（邀请无效 / 不存在）** — **Given** invitation 不存在或不可解析，**When** candidate 进入 bootstrap，**Then** 不进入 Phase B；不建立 P1 关联、不记录 P1-specific confirmation、不请求 P1-specific recognition；无 Person / Account / 会话 / participation 增量；对外 generic。**对应 005 IB-005；runtime 特有：contract-level invitation resolution 失败路径。**
**AS-07 — Invitation stale / consumed / terminal（邀请过期 / 已消费 / 终态）** — **Given** invitation 已进入 Slice 4 定义的终态 / 不可用，**When** 旧 attempt 尚未 COMMITTED，**Then** MUST NOT commit、MUST NOT 复活 invitation；同一 attempt replay 返回 terminal；未来参与需 new invitation → new attempt；若 attempt 在 invitation terminal 前已 COMMITTED，则 binding 保持 COMMITTED、replay 返回历史 COMMITTED 且不 re-execute / revive。**对应 005 场景 12、20。**
**AS-08 — Account already bound（candidate Account 已绑定其它 Person）** — **Given** candidate 已通过普通登录形成 `A↔P2`，**When** 打开 P1 邀请尝试 binding，**Then** identity conflict → `TERMINAL`；`A↔P2` 与 P1 不变；MUST NOT merge / delete / rebind / 创建 P1 的 active participation；对外 generic；MUST NOT 声称该场景 P2 = 0。**对应 005 场景 15；runtime 特有：identity conflict 门禁在 commit 前可判定。**
**AS-09 — Person already bound（P1 已有 Account B）** — **Given** P1 已有 Account B，**When** 当前已认证 Account == B → 复用 binding、不重新绑定、不要求双确认、可继续 Slice 4 的 accept / decline；!= B → 拒绝、不 rebind / 替换、无 active participation。**对应 005 场景 16。**
**AS-10 — Concurrent claim on same P1（并发认领同一 Person）** — **Given** 多个 attempt 并发绑定同一 P1，**When** 全部完成，**Then** `successful commits ∈ {0,1}`、`binding increase ≤ 1`、`Person 增量 = 0`；其余 attempt `TERMINAL`；全部失败时 `0 commit` 合法；数据库层唯一 / 条件更新可证明。**对应 005 场景 13；runtime 特有：DB 层最终保证。**
**AS-11 — Duplicate replay（重复提交 / 同幂等键）** — **Given** 同一 key + 同一 payload 已处理，**When** 客户端重试（含并发同 key），**Then** 返回原结果；不产生第二条 attempt / 第二份 confirmation / 第二次 commit / 第二组 audit。**对应 005 场景 24（PENDING 分支）；runtime 特有：幂等基础设施与 attempt 回读。**
**AS-12 — Idempotency mismatch（同 key 不同 payload）** — **Given** 同一 key + 不同 canonical payload，**When** 提交，**Then** 拒绝（映射 409，具体 code / envelope 留 Plan），原 attempt / 原结果不被修改。**对应 Docs §8.5；runtime 特有：mismatch 分支。**
**AS-13 — Retryable failure（技术失败）** — **Given** Phase B 有效、candidate confirmation 已记录，**When** 发生 timeout / unknown network result，**Then** `RETRYABLE OPERATION FAILURE`；attempt 仍合法；已有效 confirmation 不被擦除；不得假设成功 / 失败；retry / read-back 收敛到 authoritative outcome；不 double commit。**对应 005 场景 21、25、26。**
**AS-14 — Terminal failure（业务终态）** — **Given** consent invalid / guardian 缺失 / multi-family / ADULT / UNKNOWN / unauthorized confirmer / recognition rejected / identity conflict / attempt expiration 之一，**When** 判定，**Then** `TERMINAL ATTEMPT REJECTION`；MUST NOT PENDING；不得再 commit；无 partial binding / P2 / 会话 / participation；历史 facts 可留存但不得伪造。**对应 005 场景 1、2、18、22。**
**AS-15 — Commit replay after invitation terminal** — **Given** binding 已 COMMITTED，之后 invitation 进入终态，**When** same attempt replay，**Then** 返回历史 COMMITTED；MUST NOT re-execute commit、revive invitation、grant participation、recreate authorization。**对应 005 场景 20。**
**AS-16 — No-P2（ordinary login first / retry / concurrent / rollback）** — **Given** 上述任一失败或竞争路径，**When** 检查对象计数，**Then** `Person 增量 = 0`、`P2 = 0`、`partial binding = 0`、`普通会话 = 0`、`active authorization = 0`、`partial participant capability = 0`。**对应 005 IB-022 / IB-023 / IB-028；runtime 特有：事务回滚与对象计数。**
**AS-17 — Unauthorized confirmation（越权确认）** — **Given** 非矩阵指定主体、candidate 会话代持、AI / 模型输出、未独立认证、`verified_source` 被当作 guardian proof，**When** 尝试作出 second-party confirmation，**Then** 拒绝；attempt 不得 commit；若属于不可逆资格错误 → `TERMINAL`；无 partial binding；对外不泄露资格原因。**对应 005 IB-006 / IB-014 / IB-009；runtime 特有：独立认证上下文与确认主体校验。**
**AS-18 — Cross-family / cross-context attempt（跨家庭 / 跨上下文）** — **Given** P1 属于多个 Family 或不属于目标 Family，或 attempt 关联到不同 target Person / 不同 authenticated identity / 不同 invitation，**When** 尝试确认 / commit，**Then** BLOCK / 拒绝；MUST NOT 选择任一 Family；MUST NOT 泄露其它 Family；四要素不一致 → 不 commit。**对应 005 场景 18、IB-027、IB-009。**
**AS-19 — Attempt persistence & settled read-back（runtime 特有）** — **Given** attempt 已 `COMMITTED` / `TERMINAL`，**When** 进程重启或后续读取，**Then** attempt 状态、outcome、confirmation 关联、audit outcome 仍可回读；不得因内存丢失而降级为「未知」或重新执行。**对应 005 §5.5；runtime 特有。**
**AS-20 — Temporary auth context has no session / no family data（runtime 特有）** — **Given** Phase A 完成、Gate 1 尚未通过，**When** 检查 runtime 状态，**Then** 只有 pending authentication context 与 authenticated identity；无正式 Account / Person / 普通会话；未设置家庭作用域上下文；未读取家庭业务数据；P1-specific 信息未展示；candidate 无法访问任何家庭 / Case 数据。**对应 005 IB-008、Docs §9.1；runtime 特有。**
**AS-21 — Account creation at commit / no orphan Account（runtime 特有）** — **Given** Case C、authenticated identity 尚无正式 Account，**When** Phase C commit，**Then** Account 与 binding 在同一事务内创建；不存在「Account 已创建但未绑定 Person」的可见状态；若 commit 回滚，Account 不存在。**对应 Docs §7.1 1:1、005 §6.1。**
**AS-22 — No partial writes（runtime 特有）** — **Given** commit 事务中 Gate 2、Account、binding、attempt 状态、audit 任一写入失败，**When** 事务结束，**Then** 全部回滚；无 partial Account / partial binding / COMMITTED attempt / 普通会话；返回真实失败（`RETRYABLE` 或 `TERMINAL`，按 005 §5.5 判定）。**对应 005 IB-028、Docs §37.2。**
**AS-23 — Confirmation cross-attempt rejected（runtime 特有）** — **Given** confirmation 属于 attempt X，**When** 被用于 attempt Y / 不同 P1 / 不同 authenticated identity / 不同 invitation，**Then** 拒绝；不 commit；不得把旧 confirmation 复用到 new attempt 以跳过双确认。**对应 005 IB-009。**
**AS-24 — RLS isolation for Gate evaluation / audit non-forgeable（runtime 特有）** — **Given** Gate 1 / Gate 2 读取 P1 Compliance / consent / membership，或写入 attempt / audit outcome，**When** 以运行角色在无上下文 / 错误 Family 上下文直连查询，**Then** 返回零行 / 拒绝；Gate 判定结果不向 candidate 泄露；审计记录不可伪造、不含 secret / 明文 `wechat_openid`；审计存储不削弱 RLS。**对应 Docs §9.1、005 §5.6.3。**

**Acceptance 覆盖核对**：happy path（AS-01/02/03）、candidate rejects（AS-04）、second party rejects（AS-05）、invitation invalid（AS-06）、invitation stale / consumed（AS-07）、Account already bound（AS-08）、Person already bound（AS-09）、concurrent claim（AS-10）、duplicate replay（AS-11）、idempotency mismatch（AS-12）、retryable failure（AS-13）、terminal failure（AS-14）、commit replay（AS-15）、no-P2（AS-16）、unauthorized confirmation（AS-17）、cross-family / cross-context（AS-18）。runtime 特有：AS-19—AS-24。

## Acceptance Evidence

| Acceptance item | Verification type | Required evidence |
|---|---|---|
| 独立 capability 与普通登录边界（FR-001、SC-013、AS-01） | integration + route / contract audit | 普通 `/auth/wechat` new / existing openid 回归测试通过；不存在 `mode=invite` / 隐藏开关；bootstrap 调用序列中不出现普通 login 先建 P2 |
| Case B 复用 / 拒绝（FR-003、SC-002、AS-09） | integration + database | 匹配 Account → 无新 binding / 无新 Person、不要求双确认；不匹配 → 拒绝、既有 binding 不变；`persons.account_id` 唯一约束实际拒绝 |
| Case C happy path + Account at commit（FR-011、SC-001、AS-01、AS-21） | integration + database | binding +1、Person 增量 0、Account 增量 ∈{0,1}；`A↔P1` 唯一；commit 前 P1 Account = NULL；commit 后无孤立 Account；binding 前无 session / participation |
| Gate 1 / Gate 2 矩阵（FR-006、FR-010、SC-009、AS-02、AS-03、AS-14） | unit + integration | UNDER_14 / MINOR_14_17 有 / 无 guardian / ADULT / UNKNOWN 逐行断言；Gate 1 先于 P1-specific processing；Gate 2 用当前状态复核；consent 失效不得 PENDING；`verified_source` 不构成 guardian proof |
| 双确认一致性与越权确认（FR-008、FR-009、SC-009、AS-05、AS-17、AS-23） | unit + integration + security | 四要素一致才 commit；跨 attempt / P1 / identity / invitation 拒绝；candidate 会话代持 / AI / 未独立认证 / 无资格主体拒绝；confirmation 不可跨 attempt 复用 |
| attempt 持久化与 settled replay（FR-012、FR-013、SC-003、AS-15、AS-19） | integration + database | 重启后 attempt 状态 / outcome / confirmation / audit 回读；COMMITTED / TERMINAL replay 返回历史结果；不 re-execute commit；PENDING / RETRYABLE 不被冻结 |
| 四类结果与 PENDING 边界（FR-013、FR-014、AS-13、AS-14） | domain + integration | 四类逐项可判定；PENDING 掩盖失效 → 失败；RETRYABLE 不是 attempt 状态；operation timeout 不终止 attempt、不擦除 confirmation；expiration 后 commit = 0 |
| 幂等矩阵（FR-022、SC-006、AS-11、AS-12） | integration + concurrency | same key same payload / different payload / replay settled / replay PENDING / retry RETRYABLE / concurrent same-key / concurrent different-key 全表逐项断言 |
| 并发与 DB 层最终保证（FR-017、SC-005、AS-10） | database concurrency | 并发 attempt 后 `successful commits ∈ {0,1}`、`binding increase ≤ 1`、Person 增量 0；唯一约束 / 条件更新 / 行锁的实际拒绝输出；不得仅应用层先查再写 |
| no-P2 与无危险残留（FR-016、FR-021、SC-004、SC-008、AS-16、AS-22） | integration + database | ordinary-login-first / concurrent / retry / rollback / invitation terminal 后对象计数：P2 = 0、partial binding = 0、session = 0、active authz = 0、partial participation = 0；事务失败全回滚 |
| 独立事实与不解绑（FR-018、SC-010） | integration | decline / withdraw / Case close / consent revoke 后 binding 仍存在；唯一新增关系为 Account↔Person；无 membership / guardian / Consent / Case / Participant 新增 |
| anti-enumeration（FR-019、SC-007） | integration + response matrix | 6 类内部原因对 candidate 无观察差异；generic「binding not completed」；文案 / 状态 / 下一步动作无 oracle；已授权 second-party 可见性不扩散 |
| 多家庭 BLOCK（FR-020、AS-18） | integration + database | 多 membership / 不属于目标 Family → BLOCK；不泄露其它 Family；schema 多对多仍合法 |
| 授权 / RLS / pending context（FR-024、FR-005、AS-20、AS-24） | integration + database | `authorize()` 先于 RLS；pending context 未设 `app.family_id` / 未读家庭业务数据 / 未签发普通会话；无上下文 / 错误 Family 上下文直连查询 0 行 / 写拒绝；binding 不授予授权 |
| 审计（FR-023、SC-011、AS-24） | integration + database | outcome 可追溯；无 secret / 明文 openid；不可伪造 / 静默改写；不为 audit 创建 Person / Account；存储不削弱 RLS |
| 失败 / retry 语义（FR-014、FR-015、FR-021、AS-13、AS-14） | domain + integration | 真实失败不伪装成功；技术失败不升级为业务终态；settled 不被 retry 改变；new attempt 条件正确；invitation 不被 attempt 改变 |
| Slice 4 downstream contract（FR-025、SC-012） | contract + integration | binding COMMITTED → account-backed Person；binding not completed → active participation = 0、accept generic；binding success ≠ acceptance；006 无 participant capability |
| 依赖门禁（FR-026） | governance evidence | 006 Implement 依赖 Slice 1 已完成；Slice 4 contract 未 merge main / runtime 未实现时端到端明确 `BLOCKED`；contract-level fixture 验证可进行；无第二套 invitation 模型 |
| 结构 / 能力枚举（FR-027、SC-014） | route + schema + capability enumeration | 13 类 Explicit Exclusions 均不存在；无越界表 / 路由 / 占位实现 / 第二套 audit / 第二套 invitation / KYC / merge / AI 匹配 / participant implementation |
| Migration / RLS / 幂等 / 审计扩展（FR-024） | database verification | 新增动作 / 命令 / 事件类型经 reviewed migration；`relrowsecurity` / `relforcerowsecurity` 校验；运行角色非 owner、`rolbypassrls = false`；uuidv7 基线（若引入新表） |
| Spec 治理（本轮） | command output | `node .specify/scripts/validate-governance.mjs` 与 `node .specify/scripts/tests/run-governance-tests.mjs` 的真实输出 |

## Edge, Failure, and Unknown States

- **Gate 1 前无 P1 关联**：Phase A 只允许 authenticated identity + pending context；不得出现 P1-specific 展示 / confirmation / recognition request；该限制不延伸到 Gate 1 通过后的 Phase B association。
- **PENDING 不是结果冻结**：PENDING 只表示等待合法可补齐步骤；consent 失效 / 冲突 / 邀请终态必须转 TERMINAL，不得等待自动恢复。
- **RETRYABLE 不是 attempt 状态**：它描述单次 operation 尚未收敛；read-back 前不得假设成功或失败。
- **attempt expiration 后**：不得 commit；历史 facts 可留存；不得留下 active authorization / session / participation / half binding。
- **invitation 终态后**：已 COMMITTED 的 binding 保持；未 COMMITTED 的 attempt 不得 commit；不得复活 invitation；未来参与需 new invitation。
- **四要素不一致**：target Person / authenticated identity / invitation / attempt 任一不一致 → 拒绝，不 commit。
- **P1 多 Family / 不属于目标 Family**：BLOCK；不选择 Family；不泄露其它 Family。
- **ADULT / UNKNOWN**：ADULT NOT SUPPORTED；UNKNOWN BLOCK；不得按任一分类放行，不得泄露分类。
- **Case B 普通登录先行**：A↔P2 已成立后打开 P1 邀请 → 拒绝；A↔P2 / P1 保持；不得 merge / delete / rebind。
- **无上下文 / 错误 Family 上下文**：Gate 评估与审计写入必须 0 行 / 拒绝；不得默认放行。
- **事务失败**：Gate 2、Account、binding、attempt 状态、audit 任一失败 → 整体回滚；不得「假成功」。
- **未知 / 未采集状态**：UNKNOWN 不得补成确定值；不得把未绑定 / 失败 / PENDING 写成成功。
- **模型 / AI**：只能 request / propose；不得代替 candidate / second party 确认，不得判定 identity。

## Assumptions and Open Questions

### Assumptions（均从上游推导，非新增语义）

1. **Case C 的正式 Account 在 Phase C commit 创建**：由 §1.5「一个 Account 只代表一个 Person」、§7.1 Account↔Person 1:1、005 §5.1 Phase A 不得创建 Person、005 §1.3「创建或复用恰好一个 Account」、005 场景 19「任何 Account 建立前阻断」共同推出。MUST NOT 在 Phase A / B 创建 Account。
2. **binding attempt 需要可持久化回读**：由 005 §5.5 settled replay、并发 commit ∈{0,1}、§5.6.3 audit outcome 推出；物理形态留 Plan。
3. **同一 `(P1, identity, invitation)` 的 non-settled attempt 至多一个**：这是 runtime 收敛要求，不违反 005「不得声明永久全局唯一」；settled 后允许 new attempt。
4. **RETRYABLE 是 operation 维度**：由 005 §5.5「不是 attempt 的永久 settled outcome」「operation timeout」「read-back」推导；attempt lifecycle 只有 PENDING / COMMITTED / TERMINAL。
5. **Gate 1 / Gate 2 的服务端合规读取**：由 Docs §10「读取既有 Consent / Compliance 状态以执行 Gate 1，属于执行合规门禁的必要处理」与 §9.1「pending context 不是家庭作用域读取」共同约束：读取由服务端门禁执行、结果不返回 candidate、不建立家庭作用域身份。
6. **V1 家庭主端为现有微信小程序**（V1-C36）；本 Slice 只交付服务端能力，不交付页面。

### Plan-level decisions（非 Clarify blocker，留 Plan）

1. binding attempt 的物理存储形态（专用存储 / 复用既有 audit + idempotency / 状态视图），以及是否新增表；必须证明不改变 §7.1 已冻结基数、不新增产品语义。
2. attempt / confirmation / operation 的标识与幂等键表达；token / crypto / challenge / pairing interaction；TTL / expiration 数值与机制。
3. capability surface 的端点数量 / 路径 / HTTP status / error envelope；candidate-facing generic 与 second-party 可见信息的具体形状。
4. Gate 1 / Gate 2 的服务端可信评估实现；与 `authorize()` / `withRlsTransaction` 的具体交互。
5. 新增 `authorize()` 动作 / 命令类型 / 审计事件类型的命名与迁移；是否复用 `business_audit_events`。
6. 并发收敛的具体约束 / 锁 / 索引 / 隔离级别。
7. retry / read-back / 操作结果查询机制；是否引入后台任务（本 Slice 默认不引入；若引入必须证明不是业务终态唯一依据）。

### Clarifications

```text
Clarify: NONE
```

**理由**：005 已冻结全部产品语义；本 Slice 的歧义点均可由 005 + Docs + Slice 1/4 合同推导，且剩余项属于 Plan 层技术决定。唯一需要显式消歧的是 Slice 4 `N-24` 结构断言（见下方 Conflict Notes），它不是产品歧义，不阻断 Spec 冻结。

### Conflict Notes（已核对，不构成 Spec 阻断）

1. **Slice 4 `N-24`「无 binding attempt 表」**：该断言是 Slice 4 **自身结构枚举**（Slice 4 不得创建 binding attempt 表），不是全仓库禁止 006 拥有 attempt runtime 事实。006 是独立 Slice，其 attempt 事实不属于 Slice 4 的产物；两者范围不同，不冲突。006 的 Plan / Tasks 必须在结构枚举中说明这一归属，避免误判。
2. **Docs §7.1 表清单未列 binding attempt**：005 已明确 attempt 生命周期、settled replay、audit outcome 需要留存，且「storage / event sink / table selection 留 Plan」。因此这是 **Plan 层物理设计**，不是语义冲突；006 MUST NOT 改变 §7.1 已列出的表与冻结基数。
3. **Slice 4 contract 未 merge main**：006 只消费其已冻结语义；Implement 前必须以当时 merged main 复核；未 merge / runtime 未实现时端到端验收 `BLOCKED`，不得以分支语义替代，不得建第二套 invitation 模型。
4. **Slice 4 `Identity Seam` 的 `actor.personId === participation.person_id`**：006 只提供 binding COMMITTED 后的 account-backed Person 事实；006 MUST NOT 修改 `persons.account_id` 之外的 participant 判定，也不得实现 accept。两者边界一致。