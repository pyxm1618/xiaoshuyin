# Feature Specification: 受邀既有 Person 的微信身份绑定合同（Invited Identity Binding Contract）

**Feature Directory**: `specs/005-invited-identity-binding-contract`
**Created**: 2026-11-06（contract remediation round 3）
**V1 Phase**: Phase 1 前置身份合同（跨 Slice；**不是 implementation slice**）
**Docs baseline**: `Docs/V1产品需求.md` v3.7、`Docs/V1技术设计.md` v3.12
**Stage**: Contract / Specify / Clarify only。**禁止进入 Plan / Implement。**

> 本合同只定义 V1 新增的 identity seam：invitation-aware identity bootstrap、家庭证明的双确认（candidate recognition）、年龄与前置门禁、no-P2、失败语义、生命周期分离与授权边界。Account↔Person 1:1 / 0..1、Family membership、guardian 基线、consent-first、RLS，以及 Participant / invitation 生命周期由上游约束；本文只消费，不重复定义。
>
> 本合同不新增产品能力，也不宣称达到实名 / KYC 强度。核心业务规则在本文件内**只保留一个 normative definition**；其余章节一律引用。

## Upstream Traceability

| Upstream ID / Section | Source | 本合同的投影关系 |
|---|---|---|
| §1.2 | `Docs/V1产品需求.md` | invitation-aware binding；token ≠ identity；双确认；Case B / Case C；邀请终态只消费 |
| §1.5 | `Docs/V1产品需求.md` | Account↔Person 1:1 / 0..1；guardian ≠ membership；多 Family 仅 schema 能力 |
| §17.1 / §18.3 | `Docs/V1产品需求.md` | attempt 留痕；attempt 终态 ≠ 邀请终态；binding 确认 ≠ Consent |
| §19A.2 | `Docs/V1产品需求.md` | 四类年龄；consent-first；UNKNOWN 不按成人放行；年龄与确认主体矩阵 |
| V1-C20 / V1-C21 / V1-C39 / V1-C44 | `Docs/V1产品需求.md` §24 | 对象边界；按用途授权；服务端年龄 / 监护 / 同意；受邀身份绑定 invariant |
| U11 | `Docs/V1产品需求.md` §23 / `Docs/V1技术设计.md` §28.11 | 孩子轻量参与；拒绝、撤回、过期、越权、绑定失败 |
| §5 不变量 1 / 4 / 5 / 17 / 27 / 29 | `Docs/V1技术设计.md` | 对象分开；转述不升级；未知不补值；并发不重复；UNDER_14 无同意 BLOCK；binding 前不建 Person / 会话 / 参与 |
| §7.1 / §7.7A | `Docs/V1技术设计.md` | binding 只改变 Case C 的 Person→Account；`guardian_person_id` 是 guardian relationship 唯一基线；`verified_source` 不是 guardian proof |
| §9 / §9.1 | `Docs/V1技术设计.md` | 统一 `authorize()`；binding 不授 family access；pending context 非家庭作用域 |
| §10 / §28.1 / §28.8 | `Docs/V1技术设计.md` | Case B / Case C 分流；invitation-aware bootstrap；普通登录边界 |
| §37.2 / §40 | `Docs/V1技术设计.md` | 四类真实业务结果；Authorization / RLS / Consent / 未成年人门禁上线证据 |
| Slice 4 participant contract | `specs/004-case-participant-core`（外部合同） | invitation 生命周期与授权事实源；本合同只消费 valid / terminal-unusable |

**Blocking rule**: 本合同不新增任何未被 V1-C44 覆盖的产品语义；无法追溯到上表的扩展一律不得实现。

**编号说明**：IB 编号与 Round 1 保持一致，便于对照；语义以本文件章节为准，EARS 只引用章节定义。IB-003 已并入 IB-001（同一普通登录边界），保留空号以维持对照。

---

# 1. 组件定位

## 1.1 核心职责

本组件负责把已认证微信身份绑定到受邀既有 Person P1，实现不创建第二个 Person 的 invitation-aware identity bootstrap。

## 1.2 核心输入

1. **Invitation context**：参与邀请、目标 Family、目标 Person P1、邀请生命周期状态（valid / terminal-unusable，由 Slice 4 定义）。
2. **Existing Person P1**：已合法建立；Case B 时已有 Account，Case C 时 `Account = NULL`；含当前 Compliance Profile。
3. **Authenticated WeChat identity**：candidate 本次真实微信认证结果。
4. **Candidate confirmation**：candidate 对绑定到本次受邀既有 Person 的明确 affirmative 行为。
5. **Second-party confirmation**：年龄矩阵指定的独立确认主体作出的 `target confirmation + candidate recognition`。
6. **Target Family / Case context**：确认权来源与后续独立授权边界。

## 1.3 核心输出

1. **Binding decision（内部真实结果）**：`COMMITTED` / `PENDING` / `TERMINAL ATTEMPT REJECTION` / `RETRYABLE OPERATION FAILURE`（§5.5）。
2. **Candidate-observable result**：candidate 未成功绑定前，只能是不可区分的 generic「binding not completed」（§5.6.2）。
3. **Account A ↔ Person P1 binding**：仅在全部条件成立时产生；保持既有 1:1 / 0..1 基数。
4. **Normal authenticated identity**：Case C 绑定成功后获得与 P1 一致的普通已认证身份，accept 可继续。
5. **No-P2 guarantee**：invitation-aware flow 在 binding 前不产生 P2；失败后不留下 P2、partial Account↔Person binding、普通会话、active authorization 或部分参与能力；历史 attempt / confirmation / audit facts 按 §5.5 的保留语义处理。
6. **Audit outcome**：security-relevant attempt 结果可追溯（§5.6.3），具体存储由 Plan 决定。

## 1.4 职责边界

本组件只负责 invitation-aware 身份绑定这一独立身份 seam；Person / Family / membership / guardian / Consent / Case / Participant / invitation 生命周期 / 普通登录 / KYC 与通用身份平台 / unlink / duplicate Person recovery / 具体物理实现均不在本合同内（见 §Scope）。

---

# 2. 领域术语

**Invited Identity Binding**
: 在真实参与邀请上下文中，把已认证微信身份绑定到已合法存在的受邀 Person P1 的独立身份能力；不是普通登录，也不是通用身份关联平台。

**P1**
: 本次参与邀请所指的、已合法存在的既有 Person；用于区分 candidate 与 target Person。

**Case B**
: 邀请目标 Person 已有 Account。当前已认证 Account 等于该 Account 时复用既有 binding；否则拒绝。

**Case C**
: 邀请目标 Person 已合法存在，但当前没有任何 Account 绑定；本合同唯一需要 identity bootstrap 的情形。

**Candidate**
: 完成真实微信认证、请求绑定到 P1 的主体；binding 成立前不是 P1，也不是正式 Person。

**Pending authentication context**
: 微信认证完成、binding 未成立时持有的临时认证结果；MUST NOT 是正式 Person，MUST NOT 产生普通业务会话。

**Binding attempt association（Phase B）**
: 前置门禁通过后建立的临时关联：candidate 已认证身份 + P1 + invitation context + binding attempt。它不是 Account↔Person binding，不是普通已认证身份，不是 active participation，也不授予任何业务授权。

**Binding attempt**
: 一次 candidate confirmation 与 second-party confirmation 共同指向的同一绑定请求；以 `binding_attempt_id` 作为幂等边界。

**Candidate recognition**
: 第二方基于与 P1 既有的现实家庭关系，独立辨认当前这次已认证微信身份的实际使用者就是 P1 的人工确认。它独立于 invite token possession、nickname / displayName、Family membership、客户端声称与系统自动推断；不是 KYC / 法定身份核验。

**Second-party confirmer**
: 独立于 candidate、完成自身认证的确认者；身份由 §5.4 的 Age / Pre-gate Matrix 决定。

**Guardian relationship（本合同）**
: P1 当前 Compliance Profile 上的 `guardian_person_id`；不是 Family membership 角色，也不是 `verified_source` 字段。

**Invitation possession**
: 持有或转发邀请 token 的事实；只证明拿到过某次邀请，不证明当前 Account 就是 target Person，也不能决定绑定是否成立。

**Invitation terminal / unusable**
: 由 Slice 4 participant contract 正式定义的 invitation 终态或不可用状态；本合同只消费该状态，不定义其产生条件与授权主体。

---

# 3. 角色与边界

## 3.1 核心角色

- **Candidate**：完成微信认证、作出 candidate confirmation；看不到受保护的目标状态。
- **Guardian confirmer**：UNDER_14，或 MINOR_14_17 且存在 `guardian_person_id` 时，由该 guardian 的已认证 Account 确认，并须辨认 candidate 就是其所知的 P1。
- **Family management actor**：MINOR_14_17 且无 `guardian_person_id` 时，由目标 Family 的 V1 已认证管理主体确认，并须辨认 candidate 就是该 Family 所知的 P1；无法辨认时 BLOCK。
- **Inviter / Case manager**：创建参与邀请；不得单独完成身份绑定；本合同不定义其取消 / 撤回邀请的权限。
- **System**：执行确定性门禁、记录 attempt、拒绝非法路径；AI 不得代替任何确认。

## 3.2 外部系统

- **WeChat identity provider**：提供真实微信认证结果；不设计 code2session 实现。
- **Slice 1 Identity / Compliance / Consent**：Person、Account、membership、Compliance Profile、guardian reference、guardian consent、`authorize()`、RLS、幂等、既有审计能力。
- **Slice 2 Case / Slice 4 Participant**：Case 上下文、Case 管理 actor、参与邀请与资源；**Slice 4 contract 是 invitation 生命周期与授权的事实源**。

## 3.3 交互上下文

```plantuml
@startuml
actor "Candidate" as Candidate
actor "Guardian / Family Confirmer" as Confirmer
participant "Invited Identity\nBinding Contract" as Binding
participant "WeChat Identity" as WeChat
participant "Slice 1 Identity /\nCompliance / Consent" as Slice1
participant "Case / Participant\n(Slice 4)" as Case

Candidate -- Binding : interaction actor
Confirmer -- Binding : interaction actor
Binding -- WeChat : dependency
Binding -- Slice1 : dependency
Binding -- Case : dependency
@enduml
```

> 本图只表达 actor 与依赖，**不表达顺序**。唯一权威顺序见 §5.1。图中不含内部模块、数据库、缓存、pairing 机制或 endpoint 设计。

---

# 4. DFX 约束

## 4.1 安全性

1. **Fail-closed**：必需事实缺失、冲突、未知或不可验证时，binding MUST 失败或 BLOCK；只有 §5.5 定义的合法等待才可 PENDING。
2. **Candidate recognition 不可替代**：token、nickname、displayName、membership、profile similarity、guardian guess、manager assertion、单方确认、客户端声称、系统自动推断均 MUST NOT 构成 candidate recognition 或 identity proof。
3. **独立认证**：second-party MUST 来自独立认证上下文；不得由 candidate 会话代持或由 AI 代确认。
4. **最小权限**：binding 只建立 Account A ↔ Person P1，不产生任何授权事实。
5. **强度声明**：本合同只提供 family-attested identity association，MUST NOT 宣称达到实名 / KYC / 法定身份核验强度。

## 4.2 可靠性与隐私

1. **无危险残留**：conflict / operation timeout / attempt expiration / cancellation / 任一写入失败时，MUST NOT 留下 P2、partial Account↔Person binding、ordinary session、active authorization 或 partial participant capability；历史 attempt / confirmation / audit facts MAY 按 §5.5 保留。
2. **并发收敛**：同一 Person 的并发 binding MUST 收敛为至多一个 commit（§5.5）。
3. **真实状态**：不得把 UNKNOWN / DECLINED / CONFLICT / timeout / PENDING 写成成功；技术性失败不得自动升级为业务终态。
4. **动态重估**：attempt 期间 age_band / guardian / consent / Compliance 变化 MUST 重新评估（§5.4、IB-015）。
5. **未绑定 candidate 不泄露**：响应 MUST NOT 泄露 target Person / Family / guardian / age / consent / compliance / multi-family / other Account binding，也不得通过「可继续动作」形成 oracle（§5.6.2）。
6. **确认者最小可见**：只向已授权 second-party / manager 展示完成确认所严格必要的信息。
7. **审计与凭据**：审计行为约束见 §5.6.3；`wechat_openid` 等身份凭据 MUST NOT 出现在业务响应或日志明文中。

---

# 5. 核心合同

## 5.1 唯一权威顺序：Phase A → Gate 1 → Phase B → Gate 2 → Phase C

**核心身份事实**：成功 binding 只产生 `Account A ↔ Person P1`；MUST NOT 产生 P2、普通业务会话、active participation、membership、guardian、Consent 或业务授权。

本节是**唯一 normative sequence**。§3.3、§5.3 及本文件其它章节 MUST NOT 重新定义完整顺序。

**Phase A — Independent WeChat Authentication**

1. candidate 进入 invitation-aware flow，完成真实微信认证，只持有 temporary authentication context 与本次 authenticated WeChat identity。
2. 此时 MUST NOT 存在：candidate↔P1 association、P1-specific candidate confirmation、P1-specific information、P1-specific second-party recognition request、Person creation、ordinary business session、active participation。

**Gate 1 — Applicable Age / Compliance Pre-gate**

3. MUST 使用 §5.4 的唯一 Age / Pre-gate Matrix 判定 applicable gate。
4. **UNDER_14**：P1 legally exists → current guardian relationship exists → current valid UNDER_14 guardian consent → applicable Compliance gate passes。全部通过 → 进入 Phase B。
5. 任一不满足 → TERMINAL / BLOCK current attempt + generic candidate-facing result；MUST NOT 记录 P1-specific candidate confirmation，MUST NOT 请求 P1-specific second-party recognition。

**Phase B — Temporary Binding Attempt**

6. 只有 Gate 1 通过后，MUST 先 create temporary attempt association：authenticated candidate identity + P1 + invitation + binding attempt。
7. association 建立后，才允许 candidate explicit confirmation for P1，然后 second-party target confirmation + candidate recognition。两份 confirmation 均属于 Phase B。
8. 该 association ≠ Account↔Person binding；≠ ordinary authenticated identity；≠ active participation；≠ 业务授权。

**Gate 2 — Commit-time Recheck**

9. commit 前 MUST 再次核验：age / applicable Compliance、guardian where applicable、consent where applicable、invitation validity、confirmation authority、candidate recognition、Account / Person conflicts。
10. Gate 1 通过不豁免 Gate 2。

**Phase C — Commit**

11. 全部仍成立 → `Account A ↔ Person P1` 正式成立，exactly once；MUST NOT 额外创建授权事实；MUST NOT 产生第二个 Person。

**通用规则**

12. Phase A 的「不与 P1 关联」限制 **不延伸到** Gate 1 通过后的 Phase B attempt association。
13. Phase B association 必须在 attempt terminal、commit 或失败清理时结束，不得升格为正式 binding 或普通身份。
14. 只有 Phase C 产生正式 identity fact；Phase B 状态不得对外表现为已绑定。
15. attempt lifecycle / idempotency / concurrency 唯一权威见 §5.5；candidate recognition 唯一权威见 §5.3；security / anti-enumeration / audit 唯一权威见 §5.6。

## 5.2 Case B / Case C

1. **Case B 复用**：当前已认证 Account 等于 P1 的 Account 时，MUST 复用既有 binding，MUST NOT 进入 identity bootstrap 或要求重新双确认；随后继续参与说明 / accept / decline。
2. **Case B 不匹配**：当前已认证 Account 不是 P1 的 Account 时 MUST 拒绝；MUST NOT rebind / 替换 / 创建 active participation。
3. **Case C**：P1 无 Account 时 MUST 只走 invitation-aware identity bootstrap；从 participation invitation 进入时 MUST 在调用普通 login 之前 route 到该 bootstrap，MUST NOT 先调用普通 `/api/v1/auth/wechat`。
4. **普通登录先行冲突**：candidate 已独立完成普通登录（A ↔ P2）后再打开 P1 邀请时，invited binding MUST reject，保持 A↔P2 与 P1 不变，MUST NOT merge / delete / rebind / 创建 P1 的 active participation。该冲突不得被表述为「该外部普通登录场景下 P2 = 0」。
5. **普通登录不变**：普通 `POST /api/v1/auth/wechat` MUST 保持既有行为，MUST NOT 通过 `mode=invite` 或隐藏开关改变，也不承担识别 / 阻断 Case C 的保证。

```text
邀请指向 P1
if P1 有 Account:
    if authenticated Account == P1.Account → 复用 binding → accept / decline
    else → reject（terminal attempt rejection）
else:
    → Case C bootstrap（§5.1 / §5.3 / §5.4 / §5.5）
```

## 5.3 Candidate recognition（唯一权威）

1. **冻结等式**：`second-party confirmation = target confirmation + candidate recognition`。
2. **Recognized proposition（唯一命题）**：第二方确认的命题是「我基于与 P1 既有的现实家庭关系，独立确认当前这次已认证微信身份的实际使用者就是 P1。」它 MUST NOT 退化为「我批准这个 invitation / binding request」。
3. **独立性**：candidate recognition MUST 独立于 invite token possession、nickname / displayName、Family membership、客户端声称与系统自动推断；MUST 由人工作出。
4. **性质**：该确认是 family-attested identity association；MUST NOT 被描述或验收为 KYC / legal identity verification / government identity proof。
5. **同一 attempt + 四要素 + 独立认证**：两方确认 MUST 指向同一 binding attempt，并共同绑定 target Person P1、authenticated WeChat identity、invitation context；两方 MUST 分别独立认证；任一方缺失 MUST NOT commit。两份 confirmation 均属于 Phase B（§5.1）。
6. **确认 ≠ Consent**：identity-binding confirmation / candidate recognition MUST NOT 等价于 Consent；guardian confirmation MUST NOT 等价于 guardian consent。

> 本节只定义 recognition 命题与确认一致性，不重复端到端顺序。Phase 顺序 / Gate 1 / Gate 2 / commit 的唯一权威见 §5.1；attempt 生命周期、幂等与并发见 §5.5。

## 5.4 Gate 1 — Age / Pre-gate Matrix（唯一权威）

**P1-specific processing** 指：把 pending context 关联到 P1、记录针对 P1 的 candidate confirmation、展示 P1-specific 信息、请求 P1-specific second-party confirmation。

本矩阵是本文**唯一权威**的年龄、Gate 1 前置门禁与确认主体定义；其他章节与 EARS 只引用，不得复制或扩展。

| Age band | 进入 Phase B 前必须通过的 Gate 1 检查（按序） | Candidate confirmation | Second-party confirmer | 不满足时 |
|---|---|---|---|---|
| **UNDER_14** | 1) P1 合法存在；2) current guardian relationship 存在；3) current valid UNDER_14 guardian consent 存在；4) applicable Compliance gate 允许该最小身份绑定处理 | 必须 | **仅** current guardian（actor → Account's Person = `guardian_person_id`） | BLOCK current attempt（TERMINAL）；MUST NOT PENDING 等待 consent 自动恢复 |
| **MINOR_14_17** | 1) P1 合法存在；2) 该年龄段 applicable Compliance gate 通过 | 必须 | 存在 current guardian → 该 guardian；不存在 → 目标 Family V1 management actor | MUST NOT 仅因年龄要求 UNDER_14 guardian consent；其它 applicable Consent / Compliance 仍必须通过；confirmer 无法辨认 → BLOCK |
| **ADULT** | 不适用 | 不适用 | 不适用 | NOT SUPPORTED（TERMINAL） |
| **UNKNOWN** | 不适用 | 不适用 | 不适用 | BLOCK（TERMINAL） |

**矩阵注释**：

1. **current guardian relationship** 指 P1 当前 Compliance Profile 上的 `guardian_person_id` 非空且有效；guardian confirmer 的 actor MUST 满足 authenticated Account → Account's Person = 该值。
2. **UNDER_14 不得 fallback**：guardian 缺失、无效或未确认时 MUST NOT 以 Family manager 替代；guardian MUST 辨认「当前已认证 candidate 就是该 guardian 所知的这个孩子 Person P1」，MUST NOT 只确认「P1 可以参与」。
3. **MINOR_14_17 有 guardian**：confirmer MUST 是该 guardian，MUST NOT 以 manager 替代。
4. **MINOR_14_17 无 guardian**：目标 Family 的 V1 management actor MUST 独立辨认「当前已认证 candidate 就是该 Family 所知的既有 Person P1」；无法辨认 → BLOCK；MUST NOT 只凭管理权限自动批准。
5. **MINOR_14_17 consent 边界**：MUST NOT automatically inherit or require `UNDER_14_GUARDIAN_CONSENT` solely because of age；all other applicable Consent / separate consent / Compliance requirements remain enforceable under V1-C41 / Compliance Policy。若当前具体处理需要其它单独同意，仍 MUST gate，MUST NOT 因年龄段而豁免。
6. **UNDER_14 consent 失效**：consent 在 Gate 1 或 Gate 2 复核时不 valid → BLOCK current attempt；已建立的历史 Person / consent / 档案 MUST NOT 删除。若未来重新取得新的合法 consent，是否允许新 attempt 由 §5.5 与后续 lifecycle 处理，**旧 attempt 不自动恢复**。
7. **动态重估**：attempt 期间 `age_band` / guardian / consent / Compliance 变化 MUST 按本矩阵重新评估；重估后已不满足 eligibility / authorization / compliance → TERMINAL ATTEMPT REJECTION / BLOCK，MUST NOT PENDING。
8. **guardian 基线不变**：guardian relationship MUST 等于 P1 当前 `guardian_person_id`；`verified_source` MUST NOT 被当作 guardian identity proof；本能力 MUST NOT 新建或修改 guardian relationship / guardian consent / 新 Consent 类型。

## 5.5 Binding Attempt Lifecycle（唯一权威）

业务结果封闭为四类：

| 结果 | 含义 | 判定 |
|---|---|---|
| `COMMITTED` | binding 成功，Account A ↔ P1 建立。 | 全部条件成立 + Gate 2 复核通过 + exactly once。 |
| `PENDING` | attempt **仍然合法**，只是尚缺一个未来仍可在**同一 attempt 内**合法补齐的步骤（例如等待已授权 second-party 作出 confirmation）。 | eligibility / authorization / compliance 仍全部成立。 |
| `TERMINAL ATTEMPT REJECTION` | 该 attempt 永远不能再成功。 | 已不满足 eligibility / authorization / compliance，或发生不可逆业务冲突。 |
| `RETRYABLE OPERATION FAILURE` | operation timeout、unknown network result、transient infrastructure / service failure。 | 业务 attempt 本身仍合法；不得因一次技术失败自动转成业务终态；不得假设成功，也不得假设失败。 |

**PENDING 边界（强制）**：

1. PENDING MUST 只表示「仍然合法、仅缺合法 confirmation / permitted step」。
2. consent invalid / revoked / expired、identity conflict、multi-family block、ADULT、UNKNOWN、wrong / unauthorized confirmer、candidate recognition explicitly rejected、invitation terminal MUST NOT PENDING；MUST 归入 `TERMINAL ATTEMPT REJECTION` 或 BLOCK。
3. MUST NOT 出现「consent 失效 → PENDING，等待同意后自动继续」。

**TERMINAL ATTEMPT REJECTION 至少覆盖**：identity conflict、P1 已绑定不同 Account、candidate Account 已绑定不同 Person、wrong / unauthorized confirmer、candidate recognition explicitly rejected、multi-family block、ADULT unsupported、UNKNOWN blocked、invitation terminal（尚未 COMMITTED 的 attempt）、candidate cancels this attempt、authorized confirmer rejects this attempt、concurrency loser after another attempt committed、Gate 1 / Gate 2 复核失败、attempt expiration。具体 enum 名留 Plan。

**Operation failure ≠ attempt expiration（强制）**：

1. **Operation timeout / transient failure**（candidate confirmation request 网络超时、second-party request 瞬时服务错误、unknown operation result 等）：如果 binding attempt 本身仍 valid → `RETRYABLE OPERATION FAILURE`。MUST NOT automatically terminate attempt；MUST NOT erase already-valid Phase B confirmations；MUST NOT assume operation failed；MUST NOT assume operation succeeded。后续 retry / read-back / idempotent resolution 机制留 Plan。
2. **Binding attempt expiration**（business attempt lifetime expires）→ `TERMINAL ATTEMPT REJECTION`；之后 MUST NOT commit。
3. **历史 attempt facts**：即使 attempt terminal，本合同 MUST NOT 要求 delete all Phase B association / confirmation / audit history。必须没有的是：active authorization、partial Account↔Person binding、ordinary session、active participation。attempt history / confirmations / audit facts MAY 按合法审计与保留策略留存。

**Idempotency / Retry / Concurrency（唯一权威）**：

1. 幂等单位是 **`binding_attempt_id`**（语义层；不要求现在决定数据库字段或 token）。同一个 attempt 的 duplicate / replay MUST 返回 same business result；已失败终态 MUST NOT 被重放为成功。若该 attempt 已在 invitation terminal 前 COMMITTED，same-attempt replay MUST 返回该历史 COMMITTED 结果，但 MUST NOT re-execute commit、MUST NOT revive invitation、MUST NOT 恢复 participation accept、MUST NOT 重建 authorization。
2. 本合同 MUST NOT 声明 `(P1, authenticated WeChat identity, invitation)` 的永久全局唯一约束。
3. **新 attempt**：old attempt terminal + invitation still valid + Slice 4 / business policy permits retry 时，MAY 针对同一 P1 / authenticated WeChat identity / invitation 发起 **new binding attempt**；它是 new attempt identity，不是旧 attempt 的 replay。
4. **并发**：多个 attempt 并发时，最终 successful commit 数 MUST ∈ {0, 1}；binding count increase MUST <= 1。若其中一个满足全部条件 → exactly 1 commit，others terminal rejection；若全部 attempts 均 recognition failed / Consent invalidated / authorization failed / multi-family blocked / gate failed → 0 commit 是合法结果。MUST NOT 因此创建 P2。
5. 最终 binding cardinality 仍由 Account↔Person 1:1 / Person→Account 0..1 保证。

**Invitation / Attempt 分离**：

1. `Invitation lifecycle ≠ Binding attempt lifecycle`。
2. attempt terminal 且 invitation 仍 valid 时，是否允许同 invitation 上 new attempt 由 §5.5 与业务政策决定。
3. **Invitation terminal after attempt COMMITTED**：attempt 在 invitation terminal 前已 COMMITTED → binding remains COMMITTED；same-attempt replay MUST 返回同一历史 COMMITTED result；MUST NOT re-execute commit、MUST NOT revive invitation、MUST NOT imply participation accept remains possible、MUST NOT recreate authorization。返回的是已完成身份绑定的幂等结果，不是重新让 invitation 生效。
4. **Invitation terminal before attempt COMMITTED**：attempt MUST NOT subsequently commit；同一 old attempt MUST 返回 terminal rejection / existing terminal result；MUST NOT revive invitation；未来参与 MUST new invitation。
5. 未证明为 P1 的 candidate 的 cancel / reject / identity failure / attempt expiration MUST 最多终止该 attempt，MUST NOT decline / cancel / expire / withdraw P1 的 invitation。
6. Invitation 的授权主体与终态来源见 §5.6.4；本合同不定义、也不推断。

## 5.6 Security / Authorization / Audit / Invitation Authority Boundaries

### 5.6.1 授权分离与独立身份事实

1. **Binding 是独立事实**：成功只建立 Account A ↔ P1；MUST NOT 与 membership、guardian、Consent、Case / Participant permission 合并。
2. **下游变化不自动解绑**：participation decline / withdraw、Case close、guardian consent revoke、other downstream authorization revoke MUST NOT 自动解除 binding；Consent / Compliance 变化只阻断受影响的下游处理与参与能力。
3. **不授予访问权、不设计 unlink**：MUST NOT 创建 membership、guardian、Case / Participant permission、Visibility、Purpose、Consent；本 Slice MUST NOT 设计 account/person identity unlinking。
4. **所有访问仍按既有 `authorize()` 独立判定**。

### 5.6.2 未绑定 candidate 响应分离（anti-enumeration）

1. **冻结不等式**：`internal result ≠ candidate-observable result`。内部 MAY 保留真实状态（`PENDING_SECOND_CONFIRMATION` / `INELIGIBLE` / `IDENTITY_CONFLICT` / `CONSENT_BLOCKED` / `MULTI_FAMILY_BLOCKED` / `INVITATION_EXPIRED` 等；enum 名留 Plan），对外 MUST 统一为不可区分的 generic「binding not completed」。
2. **不得泄露**：guardian 缺失 / 存在、consent 是否有效、age band、是否多 Family、Person 是否存在、target Family 归属、other Account binding，任一均不得通过响应差异观察。
3. **「可继续动作」不得成为 oracle**：MUST NOT 出现「错误 candidate 看到等待 guardian，而 consent 无效者看到已拒绝」；文案、状态与下一步能力在身份建立前一致。具体 HTTP status / error code / envelope 由 Plan 决定，但 MUST 满足不可区分性。
4. **确认者例外**：已授权 second-party / manager MAY 在其授权上下文看到完成确认所必需的信息；该可见性 MUST NOT 扩散给 candidate 或未授权主体。
5. **探测性请求**：转发、重放、枚举均返回同一 generic 结果；确认者若无法独立辨认 candidate → MUST NOT confirm。

### 5.6.3 审计边界

1. **行为冻结，存储不冻结**：security-relevant binding attempt outcomes（COMMITTED / PENDING / TERMINAL / RETRYABLE）MUST 可审计；具体 storage / event sink / table selection → Plan。
2. 本合同 **MUST NOT** 要求复用 `business_audit_events`，也 MUST NOT 冻结任何物理审计表。
3. actor / candidate attribution 在法律与技术允许范围内 MUST 真实；target Person / binding attempt / result MUST 可追溯。
4. MUST NOT 记录 secret；MUST NOT 明文记录微信敏感凭据（含 `wechat_openid`）。
5. MUST NOT 为满足 audit FK 而创建 Person / Account；Case C 在 formal Account 尚不存在即被 Gate 1 阻断时，系统仍 MUST 具备 auditable security outcome。
6. audit storage MUST NOT weaken RLS / privacy。
7. failure / pending / committed MUST NOT 被伪造或互相改写。

### 5.6.4 Invitation authority boundary

1. **Invitation lifecycle 由 Slice 4 participant contract 拥有**；本合同只消费两种状态：`invitation valid` 或 `invitation terminal / unusable`。
2. 本合同 MUST NOT 定义新的 invitation authorization，MUST NOT 决定谁有权 cancel / withdraw / decline。
3. 可安全引用（仅限 Slice 4 已正式定义者）：target Person 在合法身份下的 decline；server-controlled expiry；Slice 4 已定义的 authorization / validity failure；其它终态事件**仅当 Slice 4 正式批准**。
4. 本合同 MUST NOT 写 Case manager cancel / Family manager cancel / creator cancel，除非 Slice 4 已正式定义。
5. Slice 4 当前正式生命周期（引用，不扩展）：invitation `pending → accepted / declined / expired`，active `→ withdrawn`；`decline` 仅由 invited target Person 发起，`withdraw` 仅由 active Participant 本人发起。
6. Attempt lifecycle 独立：未证明为 P1 的 candidate 的 cancel own attempt / attempt expiration / recognition failure 只能结束自己的 binding attempt，MUST NOT 改变 invitation。

## 5.7 多家庭与能力边界

1. V1 invited identity binding 只支持 P1 当前仅属于目标 Family；P1 存在多个 membership 或不属于目标 Family 时 MUST BLOCK，不选择任一 Family 作为确认权来源，不泄露其他 Family。
2. Schema-level Person↔Family 多对多 MUST 继续保留；V1 MUST NOT 因此提供 multi-family switching、cross-family identity linking、family merge 或 shared identity management；MUST NOT 引入 V2–V5 capabilities 或通用身份平台。

---

# 6. 数据约束

## 6.1 Binding attempt

1. **Target Person**：Case C 时 P1 MUST `Account = NULL`；Case B 时复用既有 Account，不产生新 attempt 型绑定。
2. **WeChat identity / invitation**：必须来自 candidate 本次真实认证；invitation MUST 仍 valid，terminal / unusable invitation MUST NOT 产生新 commit。
3. **Confirmation 同一性**：两方确认的 target Person、authenticated WeChat identity、invitation context、binding attempt 标识 MUST 完全一致。
4. **Idempotency / new attempt / concurrency**：MUST 符合 §5.5；MUST NOT 声明 `(P1, WeChat identity, invitation)` 的永久全局唯一。

## 6.2 Person / Account 与 failure residue

1. **Account ↔ Person = 1:1**；**Person → Account = 0..1**；invitation-aware attempt 任何阶段 MUST NOT 产生 Person 增量。
2. **No rebind / replacement / independent fact**：P1 已绑定其他 Account 或 Account A 已绑定其他 Person 时 MUST 拒绝；binding MUST NOT 自动创建 membership、guardian、consent 或其他授权事实。
3. **Failure residue**：失败 attempt MUST NOT 留下 P2、partial Account↔Person binding、ordinary session、active authorization、active participation、membership 或 guardian；历史 attempt / confirmation / audit facts MAY 按合法审计与保留策略留存，MUST NOT 被静默改写或伪造成成功；既有合法 Person / consent / 历史 MUST NOT 因失败或撤回被删除。

## 6.3 Compliance 字段的逻辑约束

1. **age_band**：MUST 为 `ADULT` / `MINOR_14_17` / `UNDER_14` / `UNKNOWN` 之一；UNKNOWN MUST NOT 被补值或推断。
2. **guardian_person_id**：P1 当前 guardian relationship 的唯一基线；UNDER_14 有 guardian 时 confirmer 必须与其对应；MUST NOT 由 membership 推导。
3. **guardian consent**：仅 UNDER_14 的 binding pre-gate 要求 current valid UNDER_14 guardian consent；MINOR_14_17 MUST NOT automatically inherit or require 该 consent solely because of age；ADULT / UNKNOWN 同样不适用该年龄前置。其它 applicable Consent / Compliance 仍按 §5.4 / V1-C41 执行。
4. **verified_source**：MUST NOT 用作 guardian identity proof，也 MUST NOT 据此发明 guardian 验证子系统。

---

# 7. EARS Requirements

> 以下只引用 §5 / §6 的 normative definition，不重复叙述。既有 1:1 / 0..1、membership、guardian 基线、consent-first、RLS 与 participant / invitation 生命周期由上游直接约束。

## 7.1 合同与路由边界

- **IB-001（Ubiquitous）**：invitation-aware identity bootstrap 与普通微信登录 MUST 是两个不同能力；普通 `POST /api/v1/auth/wechat` MUST 保持既有行为，MUST NOT 通过 `mode=invite` 或隐藏开关改变，也 MUST NOT 被宣称或依赖为能识别 / 阻断 Case C（该端点只有 `{ code }`）（§5.2 第 5 条）。
  - **验收**：new openid → Account + Person；existing → reuse；无 `mode=invite`；普通登录回归不变，不存在「普通登录阻断 Case C」的合同承诺。
- **IB-002（Event-Driven）**：当用户从 participation invitation 进入 Case C 时，系统 MUST 在调用普通 login 之前 route 到 invitation-aware bootstrap；no-P2 guarantee MUST 仅适用于该 flow（§5.1 / §5.2）。
  - **验收**：调用序列中不出现普通 login；flow 内 P2 = 0。
- **IB-004（State-Driven）**：Case B 时，当前已认证 Account 等于 P1 的 Account → MUST 复用既有 binding，MUST NOT 重新绑定或要求重新双确认；不匹配 → MUST 拒绝（§5.2 第 1 / 2 条）。
  - **验收**：匹配 → 无新 binding / 无新 Person；不匹配 → 拒绝，既有绑定不变。
- **IB-005（Unwanted Behaviour）**：如果仅有 invite token possession，或任一必需事实未知 / 冲突 / 过期 / 不可验证，则系统 MUST fail closed；token MUST NOT 构成 identity proof（§5.3 第 2 条）。
  - **验收**：仅 token + 有效微信登录、无正确双确认 → 拒绝。

## 7.2 双确认与 candidate recognition

- **IB-006（Ubiquitous）**：`second-party confirmation` MUST 等于 `target confirmation + candidate recognition`；candidate recognition MUST 基于 confirmer 与 P1 既有的现实家庭关系，由人工独立辨认当前已认证微信身份的实际使用者就是 P1；MUST 独立于 §5.3 第 2—3 条列出的非人工来源。
  - **验收**：仅批准 invitation / binding request → 不构成确认；任一非人工来源单独作为辨认依据 → 拒绝。
- **IB-007（Ubiquitous）**：candidate recognition MUST NOT 被描述、验收或对外宣称为 KYC / legal identity verification / government identity proof；本合同强度仅为 family-attested identity association（§5.3 第 4 条）。
  - **验收**：合同、文案与验收表述均不出现实名 / KYC 强度声明。
- **IB-008（Event-Driven）**：当 candidate 完成真实微信认证时，系统 MUST 只在 pending authentication context 中持有认证结果；在 Gate 1（applicable pre-gate）通过前，MUST NOT 与 P1 关联，MUST NOT 展示 P1-specific 信息，MUST NOT 记录 P1-specific candidate confirmation，MUST NOT 请求 P1-specific second-party recognition；该限制 MUST NOT 延伸到 Gate 1 通过后的 Phase B association（§5.1）。
  - **验收**：Gate 1 前 Person 增量 = 0，且无 P1 关联 / P1-specific 信息 / P1-specific confirmation / P1-specific recognition request；Gate 1 通过后允许 Phase B。
- **IB-009（Event-Driven）**：当两方分别确认时，系统 MUST 在 Phase B 记录两份独立 confirmation，使其绑定同一 target Person、authenticated WeChat identity、invitation context 与 binding attempt；second-party MUST 独立完成自身认证；单方确认 / candidate 会话代持 / AI 输出 MUST NOT 构成 identity proof（§5.1 / §5.3 第 5 条）。
  - **验收**：四要素一致；交叉 attempt / target / 微信身份 → 拒绝；无独立认证 → 拒绝；Phase B association 不得被当作 Phase C binding。
- **IB-010（Event-Driven）**：当全部条件成立且两方确认一致时，系统 MUST exactly once 提交 Account A ↔ P1，不产生第二个绑定（§5.1 Phase C；§5.5）。
  - **验收**：binding 数 0 → 1；重复提交不增加。

## 7.3 年龄与确认主体

- **IB-011（State-Driven）**：在 P1 为 UNDER_14 时，系统 MUST 满足 §5.4 矩阵的 UNDER_14 行；MUST NOT 施加矩阵以外的条件，MUST NOT 允许 manager fallback（§5.4）。
  - **验收**：矩阵任一项不满足 → TERMINAL / BLOCK；只有仅缺合法 guardian confirmation 且 attempt 仍合法 → PENDING；guardian 不可用 manager 替代。
- **IB-012（State-Driven）**：在 P1 为 MINOR_14_17 时，second-party MUST 按 §5.4 矩阵选择：有当前 guardian → 该 guardian；无 → 目标 Family 的 V1 management actor，且该 actor MUST 独立辨认 candidate（§5.4）。
  - **验收**：有 guardian 而 manager 确认 → 拒绝；无 guardian 时 manager 无法辨认 → BLOCK；guardian / consent 数不变；MUST NOT 仅因年龄要求 UNDER_14 guardian consent；其它 applicable Consent 仍按 §5.4 / Compliance Policy 执行。
- **IB-013（State-Driven）**：在 P1 为 ADULT 时 MUST 判定 NOT SUPPORTED；`age_band` 为 UNKNOWN 时 MUST BLOCK，MUST NOT 按成人或未成年人任一分类放行，MUST NOT 泄露分类结果（§5.4）。
  - **验收**：ADULT / UNKNOWN → 拒绝；无 Account / Person 变更。
- **IB-014（Ubiquitous）**：guardian relationship MUST 等于 P1 当前 Compliance Profile 上的 `guardian_person_id`；guardian confirmer 的 actor MUST 满足 authenticated Account → Account's Person = 该 `guardian_person_id`；`verified_source` MUST NOT 被当作 guardian identity proof（§5.4）。
  - **验收**：不满足等式 → 拒绝；不满足字段边界 → 合同违反。
- **IB-015（Unwanted Behaviour）**：本能力 MUST NOT 新建或修改 guardian relationship、guardian consent 或通用 guardian policy；attempt 期间 `age_band`、guardian 引用、consent 或 Compliance 变化时 MUST 重新评估，并按 §5.5 判定结果：仍满足 eligibility / authorization / compliance 且仅缺合法 confirmation → PENDING；已不满足 → TERMINAL ATTEMPT REJECTION / BLOCK。MUST NOT 把 consent invalid / revoked 判为 PENDING。
  - **验收**：binding 前后 guardian / consent 数量不变；consent 撤回 → 非 PENDING；只有 confirmation 未完成 → PENDING。

## 7.4 前置门禁与生命周期

- **IB-016（Event-Driven）**：在进行任何 P1-specific processing 之前，系统 MUST 按 §5.4 的 Age / Pre-gate Matrix 对该 P1 的当前 `age_band` 执行**对应行**的 pre-gate；MUST NOT 施加矩阵未要求的额外前置（例如仅因年龄对 MINOR_14_17 要求 UNDER_14 guardian consent）。任一 required gate 失败 → MUST NOT 进入 Phase B，MUST 按 §5.5 终止当前 attempt，对外 generic。
  - **验收**：UNDER_14 缺 consent → BLOCK（非 PENDING）；MINOR_14_17 无 UNDER_14 guardian consent 仍可继续（其它 applicable Consent 仍需通过）；UNKNOWN / ADULT → 终止；失败后无 P1 关联事实、无 P1-specific candidate confirmation、无 P1-specific second-party recognition request。
- **IB-017（Event-Driven）**：即使 Gate 1 通过，在 Account A ↔ P1 commit 前系统 MUST 执行 Gate 2，按 §5.4 对当前状态重新校验 age / applicable Compliance、guardian where applicable、consent where applicable、invitation validity、confirmation authority、candidate recognition、Account / Person conflicts（§5.1 Gate 2；§5.5）。
  - **验收**：commit 前失效 → commit blocked；无 partial binding。
- **IB-018（State-Driven）**：业务结果 MUST 封闭为 COMMITTED / PENDING / TERMINAL ATTEMPT REJECTION / RETRYABLE OPERATION FAILURE 四类；PENDING MUST 只表示 §5.5 定义的「attempt 仍合法且仅缺尚可合法补齐的步骤」（§5.5）。
  - **验收**：PENDING 掩盖 consent invalid / identity conflict / 无权确认者 / multi-family / ADULT / UNKNOWN / invitation terminal → 合同违反。
- **IB-019（Unwanted Behaviour）**：`TERMINAL ATTEMPT REJECTION` MUST 覆盖 §5.5 列出的全部情形；业务 attempt 仍合法时，技术性失败 MUST NOT 自动转成业务终态（§5.5）。
  - **验收**：每一类均可判定为不可再成功；技术失败可重试且不伪造 COMMITTED。
- **IB-020（Unwanted Behaviour）**：`Invitation lifecycle` MUST NOT 等于 `Binding attempt lifecycle`；未证明为 P1 的 candidate 的 cancel / reject / identity failure / attempt expiration MUST 最多终止 attempt，MUST NOT decline / cancel / expire / withdraw P1 invitation（§5.5 / §5.6.4）。
  - **验收**：attempt terminal 后 invitation 状态不变（除非 Slice 4 已定义的 authorized lifecycle event 另行发生）。
- **IB-021（Event-Driven）**：当 invitation 已 terminal / unusable 时，**尚未 COMMITTED 的** old attempt MUST NOT complete、MUST NOT revive old invitation；未来参与 MUST 使用 new invitation。若 attempt 在 invitation terminal 前已 COMMITTED，binding MUST 保持 COMMITTED，same-attempt replay MUST 返回该历史 COMMITTED 结果，但 MUST NOT re-execute commit、MUST NOT revive invitation、MUST NOT 恢复 participation accept、MUST NOT 重建 authorization。同一 attempt 重复提交 MUST 返回同一结果，已失败终态 MUST NOT 被重放为成功；old attempt terminal 且 invitation 仍 valid 时，new attempt MUST 按 §5.5 允许，MUST NOT 被旧 attempt 唯一性阻止（§5.5）。
  - **验收**：invitation terminal 后提交未 COMMITTED 旧 attempt → 拒绝；已 COMMITTED attempt replay → 返回历史 COMMITTED，commit 不再执行；same attempt 幂等计数不变；new attempt 可与旧 attempt 并存为不同 attempt identity。

## 7.5 No-P2、独立事实与未绑定响应

- **IB-022（Unwanted Behaviour）**：在 binding 成立前，系统 MUST NOT 为 candidate 创建 Person P2、ordinary authenticated business session、active participation、Family membership、guardian relationship 或 Case permission；binding 成功时 MUST 只创建或复用恰好一个 Account A 并绑定既有 P1，Person 数 MUST 不变，MUST NOT 先建 P2 再 merge / rename / delete（§5.1 / §6.2）。
  - **验收**：binding 前上述对象增量均为 0；成功时 Account +1 或 0、binding +1、Person 0 增量、无 merge。
- **IB-023（Event-Driven）**：当多个 candidate / attempt 并发绑定同一 P1 时，系统 MUST 至多提交一个 binding；successful commits MUST ∈ {0, 1}，binding count increase MUST <= 1；其余 MUST terminal rejection；MUST NOT 产生 P2。若所有 attempts 均 recognition failed / Consent invalidated / authorization failed / multi-family blocked / gate failed，则 0 commit MUST 被视为合法结果（§5.5 / §6.1）。
  - **验收**：successful commits ∈ {0, 1}；binding count increase <= 1；Person 增量 = 0；全部失败时 commit = 0。
- **IB-024（Ubiquitous）**：成功 binding 后 Account A ↔ Person P1 是独立 identity fact；participation decline / withdraw、Case close、guardian consent revoke、other downstream authorization revoke MUST NOT 自动解除 binding；binding MUST 只建立 Account A ↔ P1，MUST NOT 创建 membership、guardian、Case / Participant permission、Visibility、Purpose 或 Consent；身份确认 MUST NOT 等价于 Consent（§5.6.1 / §5.3 第 6 条）。
  - **验收**：上述事件后 binding 仍存在；唯一新增关系为 Account-Person binding；受影响下游按独立 gate 阻断。
- **IB-025（Unwanted Behaviour）**：在 candidate 尚未绑定为 P1 之前，candidate-facing response MUST 与内部真实结果分离，统一为不可区分的 generic「binding not completed」；文案、状态与「下一步可继续动作」MUST NOT 成为 protected target gate 的 oracle（§5.6.2）。
  - **验收**：§5.6.2 列出的任一差异均不产生可观察差异。
- **IB-026（Ubiquitous）**：已授权 second-party / manager MAY 在其自身授权上下文看到完成确认所必需的信息；该可见性 MUST NOT 扩散给 candidate 或未授权主体（§5.6.2 第 4 条）。
  - **验收**：candidate 侧无额外信息；未授权主体被拒绝。

## 7.6 多家庭、审计与能力边界

- **IB-027（Unwanted Behaviour）**：如果 P1 当前存在多个 Family membership 或不属于目标 Family，则系统 MUST BLOCK；schema-level 多对多 MUST 继续保留，MUST NOT 演化为 multi-family product capability 或 V2–V5 capabilities（§5.7）。
  - **验收**：binding 拒绝；不泄露其他 Family；数据库基数仍合法。
- **IB-028（Unwanted Behaviour）**：如果发生 conflict、operation timeout、attempt expiration 或 cancellation，则系统 MUST NOT 留下 P2、partial Account↔Person binding、ordinary session、active authorization 或 partial participant capability。operation timeout 与 attempt expiration MUST 按 §5.5 区分：operation timeout MUST NOT 自动终止 attempt，MUST NOT 擦除已有效 Phase B confirmation；attempt expiration 后 MUST NOT commit。历史 attempt / confirmation / audit facts MAY 按合法审计与保留策略留存，但 MUST NOT 被静默改写或伪造成成功。系统 MUST 记录真实状态，MUST NOT 把失败 / PENDING / CONFLICT / timeout 写成成功；审计 MUST 满足 §5.6.3，MUST NOT 记录 secret，响应 MUST NOT 成为枚举 oracle（§5.5 / §5.6）。
  - **验收**：无 active authorization / partial binding / session / participation / P2；operation timeout 不擦除有效 confirmation；attempt expiration 后 commit = 0；历史 facts 可留存但不得被伪造成成功；审计存在且不含 secret；探测响应不区分敏感存在性。

---

## Scope

### In Scope

1. Case B 的复用 / 拒绝语义；Case C 的 invitation-aware identity bootstrap。
2. `target confirmation + candidate recognition` 的双确认语义与独立性约束（family-attested，非 KYC）。
3. 唯一 Age / Pre-gate Matrix：UNDER_14、MINOR_14_17（有/无 guardian）、ADULT、UNKNOWN。
4. Phase A → Gate 1 → Phase B → Gate 2 → Phase C 的唯一顺序、关联边界、UNDER_14 consent-first 与 commit 复核。
5. no-P2、invitation flow routing、普通登录不变、普通登录先行冲突。
6. 四类业务结果、single-attempt 幂等、new attempt 与并发收敛（commit ∈ {0, 1}）、`Invitation lifecycle ≠ Binding attempt lifecycle`。
7. 未绑定 candidate 的内部 / 外部状态分离（anti-enumeration）。
8. binding 作为独立身份事实；多 Family BLOCK；审计行为边界；Slice 1 additive reconciliation 与 Slice 4 OQ-6 解除条件。

### Out of Scope

- 业务实现与物理设计：runtime / migration / tests / schema / RLS policy / endpoint path / token / crypto / TTL / timer / transaction / audit storage 设计；具体 pairing / attestation interaction mechanism 由 Plan 在 §5.3 已批准的 family-attested scope 内设计。
- 仓库与文档边界：修改 `specs/004-case-participant-core/**`、`apps/**`、`packages/**`、`db/**`、`tests/**`、`Docs/总产品需求.md`、`Docs/总体技术架构.md`。
- 普通登录与对象创建：修改普通 `/api/v1/auth/wechat` 行为；创建 Person P1、Family、membership、guardian、Case、Participant 或任何业务对象。
- 身份体系扩展：跨 Family Person search / discovery / fuzzy matching；KYC、government-ID / 证件核验、人脸 / 视频身份验证、电话身份匹配或其它新的外部身份证明 / 敏感数据来源；Family / Person / Account merge、arbitrary existing-Person linking、adult general-purpose linking、unlink、duplicate Person recovery。
- 范围扩展：V2–V5 capabilities；通用身份平台；invitation 的创建 / 取消 / 撤回 / 过期授权（属 Slice 4）。

### Non-Goals

- 不发明新 guardian policy、Family role、Case role、Consent 类型或 invitation authorization。
- 不优化性能 / 容量 / 成本；只要求确定性正确、可验证门禁与真实失败状态。

---

## Acceptance Scenarios

> 只保留能推翻合同的场景；每个场景对应 §5 的唯一定义。

1. **Gate 1 ordering — UNDER_14 consent revoked before Gate 1** — **Given** 邀请创建后、candidate 尚未通过 Gate 1（更未建立 Phase B 关联）时 UNDER_14 guardian consent 被撤回，**When** candidate 完成微信认证并尝试继续，**Then** MUST 在 Gate 1 BLOCK current attempt（TERMINAL），MUST NOT PENDING；MUST NOT 建立 P1 关联、MUST NOT 记录 P1-specific candidate confirmation、MUST NOT 请求 P1-specific second-party recognition、MUST NOT 产生 Person / 普通会话 / active participation；candidate 得到 non-disclosing result。**Upstream**: §19A.2、V1-C39、V1-C44
2. **UNDER_14 consent revoked before commit** — **Given** Gate 1 通过，**When** Gate 2 复核时 consent 失效，**Then** commit blocked；无 partial binding；不得以 PENDING 等待。**Upstream**: V1-C39、V1-C44
3. **UNDER_14 happy path** — **Given** 合法 UNDER_14 P1（Account = none）、当前 guardian、current valid guardian consent、目标 Family 邀请，**When** candidate 认证并确认、guardian 独立确认同一 attempt 且辨认 candidate 就是其所知的孩子，**Then** 只建立一个 Account A ↔ P1 binding；Person 数不变；binding 前无普通会话 / active participation。**Upstream**: §19A.2、V1-C39、V1-C44
4. **UNDER_14 missing guardian confirmation（PENDING 反例边界）** — **Given** Gate 1 全部通过、attempt 仍合法，**When** candidate 单独确认而 guardian 尚未确认，**Then** PENDING；guardian 随后可确认；无 P2。若 consent 或 guardian 资格在此间失效，则转为 TERMINAL / BLOCK，不再 PENDING。**Upstream**: V1-C44
5. **MINOR_14_17 with guardian, no UNDER_14 consent requirement** — **Given** MINOR_14_17 存在当前 guardian 且无 UNDER_14 guardian consent，**When** all other applicable Compliance / Consent gates pass，candidate 确认、该 guardian 辨认并确认 candidate，**Then** binding MAY proceed，且 MUST NOT require UNDER_14 guardian consent solely because of age；不新建 guardian。**Upstream**: §19A.2、V1-C41、V1-C44
6. **MINOR_14_17 without guardian** — **Given** 当前 guardian 不存在，**When** candidate 确认、目标 Family 管理主体确认并辨认 candidate 是该 Family 所知的 P1，**Then** 该分支仍可到达并只建立一个 binding；若管理主体无法独立辨认 → BLOCK；不以 UNDER_14 guardian consent 为年龄前置，其它 applicable Consent 仍须通过。**Upstream**: §19A.2、V1-C41、V1-C44、U11
7. **Phase A — no P1 association** — **Given** candidate 仅完成微信认证、Gate 1 尚未通过，**When** 检查状态，**Then** 只有 authenticated WeChat context；MUST NOT 有 P1 关联事实、P1-specific 信息、P1-specific candidate confirmation、P1-specific second-party recognition request、Person / session / active participation 增量。**Upstream**: §5 不变量 17 / 29、V1-C44
8. **Phase B — temporary attempt association only** — **Given** Gate 1 已通过，**When** 记录 candidate confirmation 与 second-party confirmation，**Then** 允许 candidate authenticated identity + P1 + invitation context + binding attempt 的临时关联；MUST NOT 存在正式 Account↔P1 binding、ordinary authenticated identity、active participation 或业务授权。**Upstream**: V1-C44
9. **Phase C — exactly once commit / no P2** — **Given** 两方确认一致且 Gate 2 复核通过，**When** commit，**Then** exactly once 建立 Account A ↔ P1；Person 数不变；无 P2 / merge。**Upstream**: §7.1、V1-C44
10. **Old attempt terminal, invitation still valid → new attempt** — **Given** 旧 attempt 因 identity failure / candidate cancel / attempt expiration 终态，invitation 仍 valid 且业务政策允许 retry，**When** 同一 P1 / 微信身份 / invitation 发起 new attempt，**Then** MUST 允许其作为 new attempt identity；MUST NOT 被旧 attempt 的唯一性卡死；旧 attempt replay 仍返回旧结果。**Upstream**: §17.1、V1-C44、Slice 4 contract
11. **Wrong candidate cancels own attempt** — **Given** 未证明为 P1 的 candidate 取消自己的 attempt，**When** 检查 invitation，**Then** attempt terminal；invitation 状态不变；MUST NOT decline / cancel / expire / withdraw。**Upstream**: §17.1、V1-C44、Slice 4 contract
12. **Invitation terminal before attempt COMMITTED** — **Given** invitation 已 terminal / unusable 且该 attempt 尚未 COMMITTED，**When** 提交旧 attempt，**Then** MUST NOT commit、MUST NOT 复活 invitation；未来参与必须 new invitation → new attempt。**Upstream**: V1-C44
13. **Concurrent attempts on same P1（0 or 1 commit）** — **Given** 多个 attempt 并发绑定同一 P1，**When** 全部完成，**Then** successful commits MUST ∈ {0, 1}；binding count increase MUST <= 1；若全部 attempts 均 recognition failed / Consent invalidated / authorization failed / multi-family blocked / gate failed → 0 commit 合法；Person 增量 = 0；无 P2。**Upstream**: §5 不变量 17、V1-C28、V1-C44
14. **Forwarded invite + fresh WeChat identity B（anti-enumeration 反例）** — **Given** B 不是 P1 且获得 P1 的 invitation，**When** B 完成自己的微信认证并确认，**Then** MUST NOT bind P1，且 B cannot learn P1 age band / guardian existence / consent state / multi-family status / other Account binding；确认者若不能独立辨认 candidate 就是 P1 → MUST NOT confirm。**Upstream**: U11、V1-C21、V1-C44
15. **Ordinary login first（P1 exists, Account none）** — **Given** P1 存在且 Account = none；用户先独立完成普通登录 → A ↔ P2 legitimately created；随后打开 P1 邀请，**When** 尝试 invited binding，**Then** 拒绝；A↔P2 保留；P1 保留；no merge / no rebind / no active P1 participation；MUST NOT 声称该场景 P2 = 0。**Upstream**: §28.1、V1-C28、V1-C44
16. **Case B reuse / mismatch + ordinary login regression** — **Given** P1 已有 Account B，**When** 当前 Account 是 B → 复用、不重新绑定、可继续 accept / decline；不是 B → 拒绝、无 rebind；普通 new / existing openid 仍按既有端点行为。**Upstream**: §1.5、§28.1、§28.8、V1-C44
17. **Binding survives downstream / grants no authorization** — **Given** binding 已成功，**When** decline / withdraw / Case close / consent revoke / downstream authorization revoke，**Then** binding 保留；受影响能力按独立 gate 阻断；唯一新增事实是 Account↔Person，无 membership / guardian / Consent / Case / Participant 新增。**Upstream**: §1.5、§9、V1-C20、V1-C21、V1-C44
18. **Multi-Family P1 blocked** — **Given** P1 有多个 Family membership 或不属于目标 Family，**When** 发起 binding，**Then** BLOCK；不选择任一 Family 作为确认权来源；不泄露其他 Family。**Upstream**: §1.5、V1-C44
19. **Audit counterexample — Case C blocked before formal Account exists** — **Given** candidate 尚无正式 Account，且 Gate 1（如 UNDER_14 consent 丢失）在任何 Account 建立前阻断，**When** 记录结果，**Then** 系统仍 MUST 具备 auditable security outcome；MUST NOT 为审计创建 Account / Person；MUST NOT 要求复用特定物理审计表。**Upstream**: §17.1、V1-C44
20. **COMMITTED replay after invitation expiry** — **Given** binding 已 COMMITTED，之后 invitation 进入 terminal，**When** same attempt replay，**Then** MUST 返回 prior committed identity-binding result；MUST NOT re-execute commit、MUST NOT revive invitation、MUST NOT grant participation、MUST NOT recreate authorization。**Upstream**: V1-C44、Slice 4 contract
21. **Operation timeout after valid Phase B confirmation** — **Given** Phase B 仍 valid 且 candidate confirmation 已记录，**When** 发生 transient network timeout / unknown operation result，**Then** attempt remains eligible for idempotent resolution / retry；existing valid confirmation MUST NOT be silently erased；MUST NOT assume success；MUST NOT assume terminal rejection。**Upstream**: V1-C44、§37.2
22. **Attempt expiration after Phase B** — **Given** Phase B attempt 业务寿命到期，**When** 尝试 commit，**Then** attempt cannot commit（TERMINAL）；historical / audit facts MAY remain；MUST NOT leave active authorization / session / participation / half binding。**Upstream**: V1-C44、§37.2

---

## Acceptance Evidence

| Acceptance item | Verification type | Required evidence |
|---|---|---|
| 合同与路由（IB-001—IB-002、IB-004—IB-005） | document + contract review | 两条路径边界清楚；Case B/C 分流；普通登录回归合同不改；routing invariant 可判定；无 `mode=invite` |
| 双确认与 candidate recognition（IB-006—IB-010） | contract matrix | 等式与独立性逐条可判定；非 KYC 声明；四要素一致性；Phase A / B 边界；单项伪证明逐项拒绝 |
| 年龄与确认主体（IB-011—IB-015） | contract matrix | §5.4 矩阵四行逐行可判定；UNDER_14 / MINOR_14_17 门禁差异；MINOR_14_17 不自动继承 UNDER_14 guardian consent，其它 applicable consent 仍执行；动态重估不产生 consent invalid → PENDING |
| 前置门禁与生命周期（IB-016—IB-021） | contract matrix + state table | Gate 1 先于 Phase B；Gate 2 复核；四类结果封闭；PENDING 边界；single-attempt 幂等；COMMITTED replay；operation timeout ≠ attempt expiration；new attempt / 并发；attempt 与 invitation 分离 |
| No-P2 / 独立事实 / anti-enumeration（IB-022—IB-026） | contract review + response matrix | binding 前 / 失败后 / 并发后状态；concurrent commits ∈ {0, 1}；不同内部原因产生同一可观察结果 |
| 审计与多家庭（IB-027—IB-028） | contract review | 多 membership BLOCK；审计行为边界；Case C 无 Account 时仍可审计；无枚举 oracle |
| Slice 1 / Slice 4 governance | document + command | additive note；Slice 4 changed = 0；下方六项逐条状态 |
| Validation | command output | `validate-governance.mjs`、`run-governance-tests.mjs`、`check-docs-guard.mjs` 输出 |

---

# 9. Slice 4 OQ-6 Unblock Conditions

Slice 4 OQ-6 MAY 被标记为 `RESOLVED`，仅当以下六项全部满足：

| # | 解除条件 | 本合同状态 |
|---|---|---|
| 1 | invitation-aware identity bootstrap 已写入权威 Docs | **YES（V1-C44 / §10 / §28.1）** |
| 2 | identity proof / confirmation actors / candidate recognition 已明确 | **YES（§19A.2 / §10 / §5.3—5.4）** |
| 3 | UNDER_14 / 14–17 门禁与 consent-first 顺序已明确 | **YES（§19A.2 / §7.7A / §10 / §5.4）** |
| 4 | ordinary `/auth/wechat` 边界准确（routing invariant，不再声称其能识别 Case C） | **YES（§28.1 / §10 / §5.2）** |
| 5 | no-P2 invariant 已冻结 | **YES（V1-C44 / §5 不变量 29 / §10）** |
| 6 | failure semantics 与 invitation / attempt 生命周期分离已冻结 | **YES（§37.2 / §10 / §28.8 / §5.5 / §5.6.4）** |

```text
Slice 4 OQ-6: CAN UNBLOCK after this contract is merged with approved-docs-change review
Reason: 六项条件已写入权威 Docs 与本文；仍需人工 review 与 merged main 复核
```

解除后约束：

1. Slice 4 MUST 重新读取当时 final merged `main`，MUST NOT 依赖本文件或旧 SHA。
2. OQ-6 解除 ≠ Implement ready；仍受 Slice 1 / Slice 2 依赖门禁约束。
3. Slice 4 Plan MAY 设计 binding token / transaction / DB constraint / 具体 pairing interaction，但 MUST NOT 重新定义 identity proof 产品语义或 invitation authorization；MUST NOT 引入 KYC、government-ID / 证件核验、人脸 / 视频身份验证、电话身份匹配或其它新的外部身份证明 / 敏感数据来源；invitation lifecycle 仍由 Slice 4 正式合同定义。

---

# 10. Validation

```bash
node .specify/scripts/validate-governance.mjs
node .specify/scripts/tests/run-governance-tests.mjs
node .specify/scripts/check-docs-guard.mjs --base 438b76120b10c2738f8176f437e15269622ad1b7 --head HEAD
```

期望：

```text
Runtime code changed = 0
Migration changed = 0
Tests changed = 0
Slice 4 changed = 0
Higher-level Docs changed = 0（总产品需求 / 总体技术架构）
Docs changed = Docs/V1产品需求.md、Docs/V1技术设计.md（需人工 approved-docs-change）
Spec artifact = specs/005-invited-identity-binding-contract/spec.md
```

本轮修改范围见 PR diff；不再单独复述文件级变更清单。