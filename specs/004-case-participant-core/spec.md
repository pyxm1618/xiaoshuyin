# Feature Specification: Case Participant 核心地基（case_participants / 邀请 · 接受 · 拒绝 · 退出）

**Feature Directory**: `specs/004-case-participant-core`  
**Created**: 2026-11-05  
**Status**: Draft  
**Stage**: Specify（spec-only；本轮不进入 Clarify / Plan / Checklist / Tasks / Analyze / Implement / Converge）  
**V1 Phase**: Phase 1 — Common Core 地基（`Docs/V1技术设计.md` §38「Account / Person / Family / Participant」）

> 本 Spec 是已批准 Xiaoshuyin 文档的下游实现投影，不得引入未获批准的产品语义。
>
> **Docs baseline**: `Docs/V1产品需求.md` **v3.3**、`Docs/V1技术设计.md` **v3.8**（2026-11-04）。
>
> **Slice 边界**: 本 Slice 只建立「一个已经合法存在的 Person 如何成为某个 Case 的有限参与者」：参与关系语义、邀请 · 接受 · 拒绝 · 退出的生命周期、最小授权地基与不可枚举安全边界。它**不是** Assessment、Problem Formulation、Scene、Evidence 写入、AI、通用 participant response、Goal / Plan / Task 或通知 / UI 的替身。

## Boundary Verification（Slice 4 边界确认）

启动前已完整读取正式文档并独立核对，结论：**无实质冲突**，正式使用 `004-case-participant-core`。

- `Docs/V1技术设计.md` §38 Phase 1 明确把 `Account / Person / Family / Participant` 列为 Common Core 地基项，Participant 属 Phase 1，并非 V2–V5 能力。
- §7.1 把 `case_participants` 与 `accounts / persons / families / family_members / consent_records` 同列为身份与授权表，并给出基数约束来源。
- §10「V1 的孩子参与」把参与定义为**有限 Case Participant**，并给出「家长创建邀请 → 孩子微信登录 → 查看本次参与说明 → 接受 / 拒绝 → 必要绑定确认 → 获得当前 Case 的有限权限」的正式流程。
- §28.8 给出孩子参与 API 契约面；§28.11 U11 要求覆盖「拒绝、撤回、过期、越权」。
- `Docs/V1产品需求.md` §1.2 确立「家长可以独立开始；孩子按问题需要参与」；V1-C20 要求 Account / Person / Family / Participant / Visibility / Purpose / Consent 边界从 V1 存在；V1-X02 要求孩子邀请在真实平台条件下可用。

**与既有 Slice 的边界一致性**

- Slice 1（`001-family-identity-core`）在其 spec 的范围裁剪说明中明确 **DEFER `case_participants` 到 Case 切片**，只交付其前置（Person / Family / family_members / Compliance / Consent / authorize / RLS / 幂等）。
- Slice 2（`002-case-core`）的 Out of Scope 明确排除 Case Participant、参与邀请、孩子端参与流程。
- Slice 3（`003-evidence-core`）的 Out of Scope 同样明确排除 `case_participants`、孩子邀请、参与接受 / 拒绝流程，并要求本 Slice「不把 Participant acceptance 写成 Statement / Fact / Observation」。

因此 Participant 仍是 Phase 1 Common Core 中尚未落地的基础能力，`004-case-participant-core` 是当前正式的下一独立 Slice，而不是跳到 Problem Formulation。

## Upstream Traceability

| Upstream ID / Section | Source | What this slice implements |
|---|---|---|
| §1.2 参与原则 | `Docs/V1产品需求.md` | 家长可以独立开始；孩子按问题需要参与；孩子可接受邀请、拒绝参与、中途退出；未注册成员可被转述但不得升级为本人确认 |
| §1.5 身份与家庭归属边界 | `Docs/V1产品需求.md` | Account ↔ Person 1:1 / 0..1；Person ↔ Family 多对多；guardian 不是家庭角色；V1 不提供跨家庭查找 / 关联 / 复用已有 Person 的产品能力 |
| V1-C20 | `Docs/V1产品需求.md` | Account、Person、Family、Participant、Visibility、Purpose、Consent 等基本边界从 V1 存在，且彼此分开 |
| V1-C21 | `Docs/V1产品需求.md` | 跨成员信息必须按真实授权用途检索与使用，不能靠 Prompt 或前端隐藏假装隔离 |
| V1-C03 | `Docs/V1产品需求.md` | UNKNOWN / NOT_COLLECTED / DECLINED / CONFLICT 等真实状态不能被补成确定值（拒绝 ≠ 失败 ≠ 默认值） |
| V1-C27 / V1-C28 | `Docs/V1产品需求.md` | 失败必须返回真实状态；重复提交、并发、重试不能制造重复业务结果 |
| V1-C39 | `Docs/V1产品需求.md` | 服务端保存年龄段 / 未成年人模式 / 监护关系与必要监护人同意状态；UNDER_14 无有效监护人同意时不得继续对应处理；有效同意必须先于正式未成年人 Person / Compliance Profile 建立 |
| U02 / U11 | `Docs/V1产品需求.md` §23 / §24 | U02 完成必要授权与适用单独同意（参与前置）；U11 必要时邀请孩子轻量参与，须覆盖拒绝、撤回、过期、越权 |
| V1-X02 / V1-X04 | `Docs/V1产品需求.md` §26 | 孩子邀请等宣称能力必须在真实平台条件可用；孩子拒绝等非理想路径必须有真实验收 |
| §5 不变量 1 / 4 / 5 / 17 | `Docs/V1技术设计.md` | Account / Person / Family / CaseParticipant 分开；转述不得升级为本人事实；真实未知状态不得被补值；重复提交 / 并发 / 重试不产生重复业务结果 |
| §7.1 身份与授权 | `Docs/V1技术设计.md` | `case_participants` 表；Account ↔ Person 1:1、Person ↔ Family 多对多（只经 `family_members`）；不引入成员角色枚举与 RBAC |
| §7.7A Compliance 数据 | `Docs/V1技术设计.md` | `person_compliance_profiles`（age_band / minor_mode / guardian_person_id / guardian_consent_version）；guardian relation 不构成家庭访问权限；UNDER_14 pre-consent 与正式 Person 分离 |
| §8.5 幂等 | `Docs/V1技术设计.md` | `actor_id + command_type + idempotency_key` 合同：相同请求返回原结果，同 key 不同 payload 返回 409 |
| §9 Authorization & Consent | `Docs/V1技术设计.md` | 统一 `authorize()` 判定输入（含 Case 参与关系）；按当前目标 Family 判定；客户端 `family_id` / `case_id` 仅作待验证参数 |
| §9.1 PostgreSQL RLS | `Docs/V1技术设计.md` | 家庭隔离第二道硬防线；`withRlsTransaction`；运行角色非 owner、NOBYPASSRLS；无上下文默认拒绝 |
| §10 V1 的孩子参与 | `Docs/V1技术设计.md` | 有限 Case Participant；孩子端读取范围；UNDER_14 consent gate 顺序；不得读取家长私人原话 / 其他成员私人信息 / 无授权历史 Case |
| §7.2 / §7.8 / §7.9 | `Docs/V1技术设计.md` | `cases` / `case_events` / `business_audit_events` 作为领域历史与审计（Participant 生命周期复用 `business_audit_events`，不建第二套审计框架） |
| §23 Domain Commands | `Docs/V1技术设计.md` | 模型只能 request / propose，不能 force / confirm on behalf of user（Participant 的 accept / decline / withdraw 是用户行为，不由模型代替） |
| §28.8 孩子参与 | `Docs/V1技术设计.md` | Participant Core 的 API 契约面（invite / accept / decline / withdraw / 读取） |
| §28.11 U11 | `Docs/V1技术设计.md` | U11 页面 / 任务验收：invite / limited participation，必须覆盖拒绝、撤回、过期、越权 |
| §37.2 | `Docs/V1技术设计.md` | 跨家庭和无授权访问属于硬阻断；幂等要求重试不重复产生业务结果 |
| §38 Phase 1 | `Docs/V1技术设计.md` | 本 Slice 属于 Phase 1「Account / Person / Family / Participant」这一地基项 |

**Blocking rule**: If required behavior cannot be traced to an approved source, mark it `NEEDS UPSTREAM DECISION` and do not implement it.

**范围裁剪说明（为什么本 Slice 只做 Participant Core）**：`Docs/V1技术设计.md` §10 与 §28.8 把参与定义为**当前 Case 的有限关系**，而 §7.1 只给出 `case_participants` 表名、未给出列级 schema。§23 的 Domain Command 列表与 §28.3—§28.6 的业务端点尚未包含任何 Participant 业务动作。因此本 Slice 只建立参与身份与最小授权地基：谁可以成为一个 Case 的有限参与者，以及邀请 / 接受 / 拒绝 / 退出与不可枚举边界。Assessment、Problem Formulation、Scene、Evidence 写入、Goal / Plan / Task、AI、通用 participant response、通知与 UI 一律留给对应 Slice。为「让测试方便」或「以后孩子会参与很多流程」而提前引入 formulation / scene / assessment / 万能 response 结构，均不属于已批准需求。

## Scope

### In Scope

1. **`case_participants` 参与关系语义**：一个已经合法存在的 Person 与一个具体 Case 之间的 **Case 级有限参与关系**，与 Family membership、guardian relationship、Account ownership、全站角色、RBAC role 彼此独立（§5 不变量 1、§7.1、§10、V1-C20）。
2. **Case / Person / Family 链接**：参与关系 MUST 同时绑定一个真实存在的 Case 及其所属目标 Family，和一个真实存在、且在该目标 Family 中合法存在的 Person（§7.1、§9、§1.5）。
3. **参与生命周期**：邀请创建 → （目标查看本次参与说明）→ 接受 / 拒绝 → 必要绑定确认 → 获得当前 Case 的有限权限；已接受的 Participant 可中途退出（§10、§28.8、U11）。
4. **邀请创建的授权前置**：只有已批准的 Case 管理 actor 可以在合法 Case context 创建邀请；且 MUST 校验 Case authorization、target Family、Person 合法性、participant eligibility、Compliance / consent 前置条件（§9、§10、V1-C39）。
5. **接受（Accept）**：正确目标 Person 接受后成为当前 Case 的有效有限 Participant；不自动授予任何 Case 级业务数据访问（§10、§28.8、V1-C20）。
6. **拒绝（Decline）**：被邀请人 MUST 可以拒绝参与；拒绝是合法业务结果，不是失败或不合作，不自动关闭 Case，也不阻断家长可独立完成的工作（§1.2、U11、V1-X04、V1-C03）。
7. **退出（Withdraw）**：已接受的 Participant MUST 可以中途退出；退出后后续 Participant 权限停止，系统不得继续假装其仍在参与；已形成的合法历史不得被伪造删除（§1.2、U11）。
8. **拒绝 / 退出的历史保留**：拒绝与退出 MUST 留下真实历史，不得被静默丢弃（V1-C23 精神、§5 不变量 5）。
9. **邀请失效 / 不可再接受状态**：邀请 MUST 能进入不再可接受的合法终态 / 失效状态（拒绝、撤回、过期、越权等），具体 TTL 与状态枚举留给 Clarify / Plan（U11 明确包含「过期」）。
10. **最小授权地基**：参与行只建立「当前 Case 的、明确批准的有限权限」身份基础；BS 级业务对象访问仍需独立 Visibility / Purpose / feature-specific authorization（§9、§10、V1-C20、V1-C21）。
11. **Account / Person 绑定不变量**：接受邀请 MUST NOT 为已存在的 Person 生成第二个 Person，MUST NOT 重复 Account ↔ Person 绑定，MUST NOT 依据昵称猜 Person，MUST NOT 依据 Family membership 自动绑定账号（§1.5、§7.1）。
12. **UNDER_14 consent-first 继承**：参与邀请与接受 MUST NOT 绕过 Slice 1 已冻结的 guardian relationship、有效监护人同意与 Compliance Profile 前置条件，MUST NOT「先建 child Person 再补同意」（V1-C39、§7.7A、§10）。
13. **不可枚举与最小泄露**：邀请不可被枚举；非目标 Person 不可接受；token 不得泄露 Family / Person / Case / guardian / age / consent / compliance 私密细节；未授权 invite lookup 不得成为 Person / Case 枚举 oracle（U11、§37.2、V1-C21）。
14. **幂等与并发**：所有命令继承「重试 / 并发 / 重复提交不制造重复业务结果」；同一有效邀请并发或重复接受只产生恰好一个活跃参与结果（§8.5、§5 不变量 17、V1-C28）。
15. **可审计**：Participant 生命周期必须可审计，复用既有 `business_audit_events`，不建第二套审计框架（§7.9、§38）。
16. **批准的最小 public surface**：只交付 §28.8 中属于 Participant Core 的最小路由子集；明确 defer `POST /api/v1/participations/:id/responses`（§28.8）。
17. **Implement 依赖门禁**：明确未来 Implement 对 Slice 1 / Slice 2 的硬依赖，以及本轮不执行 Implement Gate（AGENTS、Constitution III）。

### Out of Scope

- **Assessment**：不实现 `POST /api/v1/cases/:id/assessments`、A1001—A2010 节点、任何 Digital Use 问卷或 routing（§28.3、§12）。
- **Problem Formulation**：不实现 `problem_formulations`、present / confirm / dispute / corrections、版本状态（§7.2、§28.3、§29.1）。
- **Scene**：不实现 Scene Package、node manifest、routing、`scene_node_states`、`scene_artifacts`（§12、§7.2）。
- **Evidence 写入**：不新增任何 Evidence writer / API；不创建 STATEMENT / FACT / HYPOTHESIS / OBSERVATION（§7.2、Slice 3 边界）。
- **Goals / Interventions / Plan / Task / Checkin / Review / Outcome / Follow-up / Notification**（§7.3、§24—§26、§28.4）。
- **Participant 通用业务 responses**：不做 generic `POST /api/v1/participations/:id/responses`（§28.8）。未来「本人反馈」归属具体业务对象（Assessment / Formulation / Goal / Plan / Review / Scene Node），由其对应 Slice 接入。
- **AI / RAG / Memory / Decision / Response / Promptfoo / embedding**（§13—§22、§28.7）。
- **Safety State / SAFETY_HOLD / Referral**（§27、§7.7）。若现有 Safety gate 将来影响 participant action，留给对应 Safety Slice / integration gate。
- **通知**：不做实际微信消息发送；「邀请可被真实交付」属未来平台 integration，本 Slice 不建立 notification framework（§26、V1-X02 属后续真实平台验证）。
- **UI**：不做微信小程序页面、运营后台 UI（§28A）。
- **数据权利完整工作流**：不设计完整数据删除 / 权利流程（U18、§28.9、§34—§35）；退出只保证权限停止与历史保留。
- **完整 Authorization 平台**：不建 Case role、RBAC、Visibility Matrix、Purpose / Consent 完整矩阵、family member 角色枚举（§7.1、§9 明确不引入）。
- **跨家庭 Participant**：不设计外部 / 跨 Family Participant（见 FR-004、Open Question OQ-7）。
- **V2—V5 capabilities** not required by this slice.

### Non-Goals

- 不重新设计 Case Core（Slice 2）、Identity / Family / Consent / Compliance（Slice 1）或 Evidence（Slice 3）。
- 不把 Participant 做成 Family membership、guardian relationship、Account ownership 或全站角色的替身。
- 不引入 `ADMIN / OWNER / PARENT / CHILD / MEMBER / EDITOR / VIEWER` 之类的 Participant RBAC DSL 或 role enum。
- 不因为「孩子以后会参与很多流程」而提前创建 formulation / scene / goal / plan / assessment 结构或万能 participant response blob。
- 不把 Participant acceptance 自动写成 Statement / Fact / Observation，也不把 decline / withdraw 写成 Evidence。
- 不提前决定未来孩子端每个业务对象的 visibility matrix、purpose 矩阵或 feature policy。
- 不为未来参与能力预造抽象、空接口、占位路由或第二真相源。
- 不发明邀请 TTL 数字（如 24h / 72h / 7d），除非正式文档给出依据。
- 不优化性能基线、容量或成本；只要求确定性正确、可验证隔离与真实失败状态。

## User Stories & Testing

### User Story 1 — 家长为已合法存在的孩子创建参与邀请 (Priority: P1)

某已有 Case 的合法 V1 管理 actor（Slice 2 已冻结的 Case 管理主体语义）为该 Case 创建一个参与邀请，目标是该 Case 所属 Family 中一个已经合法存在的 Person（例如已在 Slice 1 consent-first 下合法建立的未成年 Person）。系统创建真实邀请并返回可供目标使用的参与入口；不因此创建 Evidence、不创建新 Person、不授予任何 Case 级业务数据访问。

**Upstream IDs**: U11、§1.2、§10、§28.8、§9、V1-C20

**Independent Test**: 仅用「已存在 Family + 已存在合法 Person + 一次创建邀请」，断言邀请被真实创建、目标可解析、Case 归属正确；断言未创建任何 Assertion / Evidence、未创建第二个 Person、未授予 Case 读取能力。

### User Story 2 — 目标看到发给自己的邀请并接受 (Priority: P1)

被邀请的 Person 通过微信登录、查看本次参与说明后接受邀请，完成必要绑定确认，成为当前 Case 的有效有限 Participant，且恰好产生一个活跃参与结果。

**Upstream IDs**: §10、§28.8、U11、V1-C20、§1.5

**Independent Test**: 用正确目标身份 + 有效邀请接受一次；断言只有一个活跃参与结果、Account ↔ Person 仍是 1:1 且复用既有 Person、Participant 未获得 Case 全量读取或任何业务对象。

### User Story 3 — 孩子拒绝参与 (Priority: P1)

被邀请的孩子选择拒绝参与。系统记录拒绝这一合法业务结果并保留拒绝历史；不把拒绝当成失败或不合作，不自动关闭 Case，也不阻断家长可独立完成的工作。

**Upstream IDs**: §1.2、U11、V1-X04、V1-C03、§10

**Independent Test**: 邀请 → 拒绝；断言不存在活跃参与、拒绝历史被保留、Case 状态不被自动改变、家长侧可继续其可独立完成的工作。

### User Story 4 — 已参与的 Participant 中途退出 (Priority: P1)

已接受的 Participant 中途退出。系统停止其后续 Participant 权限，保留已形成的合法历史，后续系统不得继续假装其仍在参与。

**Upstream IDs**: §1.2、U11、§10、V1-C03

**Independent Test**: 已活跃参与 → 退出；断言后续 Participant 能力被拒绝、历史仍可追溯、未伪造删除历史。

### User Story 5 — 非法参与路径被阻断 (Priority: P1)

跨家庭 Person、非目标 Person、非 Case 管理 actor、UNDER_14 无有效监护人同意等非法路径被服务端阻断，且不泄露目标是否存在或任何私密细节。

**Upstream IDs**: V1-C21、V1-C39、§1.5、§9、§9.1、§10、§37.2

**Independent Test**: 分别以「Family B Person 邀请到 Family A Case」「Person B 接受 Person A 邀请」「非管理主体创建邀请」「UNDER_14 无有效同意」构造请求；断言全部失败、零业务写入、响应不含 Person / Family / Case / guardian / age / consent 私密信息。

## Acceptance Scenarios

1. **Happy path** — **Given** 一个已有 Case 及其所属 Family 的 V1 管理 actor，以及该 Family 中一个已经合法存在的 Person，**When** actor 为该 Case 创建参与邀请、目标登录后查看参与说明并接受，**Then** 恰好产生一个活跃的、仅限当前 Case 的有限参与结果；系统不创建第二个 Person、不写任何 Evidence、不授予 Case 全量读取。**Upstream**: U11、§10、§28.8、V1-C20
2. **Decline** — **Given** 一个有效参与邀请，**When** 目标选择拒绝，**Then** 不存在活跃参与、拒绝历史被保留、Case 不被自动关闭、家长可独立完成的工作不被阻断；拒绝不被记录为失败或不合作。**Upstream**: §1.2、U11、V1-X04、V1-C03
3. **Withdraw** — **Given** 一个活跃 Participant，**When** 其中途退出，**Then** 后续 Participant 能力被拒绝、已形成的合法历史仍被保留且未被伪造删除、系统不再假装其仍在参与。**Upstream**: §1.2、U11、§10
4. **Duplicate / concurrent accept** — **Given** 同一个有效邀请，**When** 并发或重复接受，**Then** 只产生恰好一个活跃参与结果，不产生第二条参与记录或第二个业务结果。**Upstream**: §8.5、§5 不变量 17、V1-C28
5. **Wrong user token** — **Given** Person B 持有一个明确发给 Person A 的邀请，**When** Person B 尝试接受，**Then** 请求被拒绝、不产生参与、不产生第二个 Person / 绑定、响应不泄露目标 Person / Family / Case / guardian / age / consent 私密信息。**Upstream**: V1-C21、§9、§37.2、U11
6. **Cross Family** — **Given** 一个属于 Family A 的 Case，以及一个只属于 Family B 的 Person，**When** 尝试邀请或建立参与，**Then** 请求被拒绝、零参与写入、不得仅因 UUID 存在即视为合法参与关系，也不得泄露该 Person 的敏感信息。**Upstream**: V1-C21、§1.5、§9、§10
7. **UNDER_14 illegal Person path** — **Given** 一个 UNDER_14 未成年人尚无有效监护人同意，**When** 尝试为其创建参与邀请或路径要求先建立正式 child Person，**Then** 系统 MUST NOT 通过邀请流程创建非法 child Person，也 MUST NOT 绕过 guardian relationship / 有效同意 / Compliance Profile 前置条件；对应处理被阻断。**Upstream**: V1-C39、§7.7A、§10、§5 不变量 1 / 27
8. **Non-manager cannot invite** — **Given** 一个目标 Family 中不是该 Family V1 管理主体、且不是合法 Case 管理 actor 的成员，**When** 尝试为该 Case 创建参与邀请，**Then** 服务端拒绝且不创建邀请；该限制由服务端判定，不依赖前端隐藏。**Upstream**: §9、§10、V1-C21
9. **Invite create anti-enumeration** — **Given** 三类情形：Case 不存在 / Case 属于其它 Family / actor 无 Case 管理权限，**When** 调用创建邀请，**Then** 三者对外表现一致且不泄露 Case 是否存在，也不返回 Family / Person / Case 私密字段。**Upstream**: §37.2、V1-C21、§9
10. **Unauthorized token lookup leaks nothing** — **Given** 一个不属于邀请目标、也无合法查看资格 caller，**When** 查询邀请 token，**Then** 不返回 target Person / Family / Case / guardian / age / consent / compliance 任何私密细节，也不得成为 Person / Case 枚举 oracle。**Upstream**: V1-C21、§37.2、U11
11. **Terminal invite cannot reactivate** — **Given** 一个已进入终态 / 失效状态（拒绝 / 退出 / 过期 / 越权作废）的邀请，**When** 尝试再次接受或重新激活，**Then** 请求失败；已终止 / 失效邀请不可重复激活。**Upstream**: U11、§5 不变量 17
12. **No Case-wide access on accept** — **Given** 一个刚接受邀请的活跃 Participant，**When** 其尝试访问 Case 级业务资源（例如 Case 全量详情、家长私人原话、其他成员私人内容、Evidence、全部 Formulation / Plan），**Then** 这些访问在本 Slice MUST NOT 因存在参与行而被允许；Participant MUST NOT 自动继承 Case manager 能力。**Upstream**: §10、V1-C20、V1-C21、§9
13. **No Evidence side effect** — **Given** 一次 accept、一次 decline、一次 withdraw，**When** 检查证据层，**Then** `Assertions + 0`、`Observations + 0`；accept ≠ Fact、decline ≠ Statement、withdraw ≠ Evidence。**Upstream**: §5 不变量 3、§7.2、Slice 3 边界
14. **No duplicate Person / binding** — **Given** 一个已存在的 Person（含无 Account 的 Person），**When** 其接受邀请，**Then** Account ↔ Person 仍为 1:1 且复用既有 Person，不产生第二个 Person、不产生第二个绑定；不得由昵称或 Family membership 推断 Person。**Upstream**: §1.5、§7.1
15. **Auditability** — **Given** 一次邀请创建、一次接受、一次拒绝、一次退出，**When** 检查审计，**Then** 生命周期事件可在既有 `business_audit_events` 中追溯；MUST NOT 出现第二套审计框架或第二套 audit 表。**Upstream**: §7.9、§38
16. **Idempotent command outcome** — **Given** 同一 actor + command_type + idempotency_key 的重放，**When** 重复提交创建邀请 / 接受 / 拒绝 / 退出，**Then** 返回原结果且不制造重复业务结果；同 key 不同 canonical payload 返回 409。**Upstream**: §8.5、V1-C28
17. **Route surface enumeration** — **Given** 本 Slice 的路由清单，**When** 枚举 public API，**Then** 只存在批准的最小 Participant Core 子集；MUST NOT 存在 `POST /api/v1/participations/:id/responses`、assessment、problem-formulation、scene、generic evidence CRUD、participant generic response 或任何越界 / 占位路由。**Upstream**: §28.8、Out of Scope
18. **RLS / cross-family hard block** — **Given** 一个 Family A 的 actor / RLS 上下文，**When** 直接以运行角色查询或写入 Family B 的参与数据，**Then** 应用层与数据库层均失败；无 `app.family_id` 上下文时默认拒绝而不是放行。**Upstream**: §9.1、§37.2
19. **Implement gate** — **Given** Slice 1 与 Slice 2 尚未 Implement 完成 + Independent Converge PASS + merged main，**When** 本 Slice 尝试进入 Implement，**Then** gate MUST BLOCK；本 Spec 可在设计阶段完成，但不得绕过依赖提前写实现。**Upstream**: AGENTS、Constitution III、§38

## Edge, Failure, and Unknown States

- **Case 不存在 / 跨 Family / actor 无管理权限**：创建邀请 MUST 对三者行为一致，不泄露 Case 是否存在，也不返回 Family / Person / Case 私密字段（§37.2、V1-C21）。
- **邀请 token 无效 / 已失效 / 已终止**：不返回任何私密细节；不得作为枚举 oracle；已终止 / 失效邀请不可重复激活（U11、§5 不变量 17）。
- **目标 Person 无 Account**：合法。参与关系引用 Person 而非 Account；目标可在接受时通过微信登录建立 Account ↔ Person 绑定（§1.5、§10）。
- **非目标接受**：拒绝；不得产生参与，不得产生第二个 Person / 绑定，不得泄露目标信息（V1-C21）。
- **并发 / 重复接受**：只产生恰好一个活跃参与结果；不得产生重复参与行或重复业务结果（§8.5、§5 不变量 17）。
- **重复拒绝 / 重复退出**：不得产生互相矛盾的业务结果；重复命令是幂等重放（§8.5、V1-C28）。
- **UNKNOWN / 未知状态**：不得被补成确定值；拒绝、退出、过期等真实状态必须被如实保留，不得写成「成功参与」或「无问题」（V1-C03、§5 不变量 5）。
- **UNDER_14 无有效监护人同意**：参与邀请与接受路径 MUST 被阻断；MUST NOT 通过邀请流程创建非法 child Person，也 MUST NOT 以「先建 Person 再补同意」为实现顺序（V1-C39、§7.7A、§10）。
- **cross-Family Person**：即使知道 UUID，也不构成合法参与关系；邀请 / 参与 MUST 被拒绝（V1-C21、§1.5）。
- **guardian 只是 eligibility / compliance / provenance 的一部分**：guardian relationship MUST NOT 自动授予 Case access，也 MUST NOT 自动成为 Participant；参与必须是独立的 Case 级关系（§7.7A、§9、§10）。
- **Participant 无 Case 级读取**：参与行默认不构成「全 Case 可见」的授权；未来具体对象仍需独立 Visibility / Purpose / authorization（§10、V1-C20、V1-C21）。
- **Participant 继承越权**：Participant MUST NOT 因存在参与行而获得 Case manager 能力或调用 manager-only Case 命令（§9）。
- **退出后**：后续 Participant 权限停止，系统不得继续假装其在参与；已形成的合法历史不得被伪造删除（§1.2、§5 不变量 5）。
- **无 RLS 上下文**：默认拒绝而不是放行；缺少 `app.family_id` 的查询不得返回跨家庭行（§9.1）。
- **事务失败**：幂等记录、参与 / 邀请、审计事件任一写入失败时整个业务事务失败并返回真实错误；不得出现部分成功的「假成功」（V1-C27）。
- **模型行为边界**：模型只能 request / propose，不能 force / confirm on behalf of user；accept / decline / withdraw 是用户行为，不得由模型代替（§23）。

## Requirements

- **FR-001** [UPSTREAM: §5 不变量 1 / §7.1 / V1-C20] 系统 MUST 把 `case_participants` 建模为**独立的 Case 级参与关系**；MUST NOT 把它与 Family membership、guardian relationship、Account ownership、全站角色合并；MUST NOT 引入 `ADMIN / OWNER / PARENT / CHILD / MEMBER / EDITOR / VIEWER` 之类的 Participant role enum 或 RBAC DSL。已有 Family membership / Family 创建者管理主体 / guardian / Participant 分别表达不同事实，MUST NOT 压缩成单一角色字段。
- **FR-002** [UPSTREAM: §7.1 / §10 / §9] 参与关系 MUST 同时绑定 (a) 一个真实存在的 Case 及其所属目标 Family，和 (b) 一个真实存在且在该目标 Family 中合法存在的 Person。guardian relationship MAY 作为 eligibility / compliance / provenance 的输入之一，但 MUST NOT 自动授予 Case access、也 MUST NOT 自动构成 Participant。
- **FR-003** [UPSTREAM: U11 / §10 / §28.8 / §9] 只有已批准的 Case 管理 actor（Slice 2 已冻结的 Case 管理主体语义）可以在合法 Case context 创建参与邀请。**知道 Person UUID MUST NOT 构成邀请依据**；创建 MUST 校验 Case authorization、target Family、Person 合法性、participant eligibility 与 Compliance / consent 前置条件。该管理资格 MUST 复用 Slice 2 冻结语义，MUST NOT 重新定义、放宽或引入新的 Case role。
- **FR-004** [UPSTREAM: §1.5 / §10 / V1-C21] 邀请目标 MUST 是**已经合法存在于目标 Family 的 Person**。系统 MUST 拒绝「Family A 的 Case + 仅属于 Family B 的 Person」。MUST NOT 建立 pre-Person onboarding invitation，MUST NOT 为了完成邀请而创建新 Person。V1 不提供跨家庭查找 / 发现 / 匹配 / 链接 / 复用已有 Person 的产品能力。
- **FR-005** [UPSTREAM: §10 / §28.8 / U11] 系统 MUST 交付 V1 参与入口：目标可查看本次参与说明，然后接受或拒绝；接受包含必要绑定确认；接受后获得当前 Case 的有限权限。该入口 MUST NOT 引入业务对象语义（Assessment / Formulation / Scene / Evidence / Plan）。
- **FR-006** [UPSTREAM: U11 / §37.2 / V1-C21] 邀请 MUST 不可枚举且只能由目标处理：token MUST NOT 可被猜测或枚举；非目标 Person MUST NOT 接受；token 与任何查询响应 MUST NOT 泄露 target Person / Family / Case / guardian / age / consent / compliance 私密细节；未授权 invite lookup MUST NOT 成为 Person / Case 枚举 oracle。
- **FR-007** [UPSTREAM: §10 / §28.8 / §5 不变量 17] 由正确目标 Person 接受有效邀请 MUST 产生**恰好一个**活跃的有限参与结果；MUST NOT 产生第二条参与记录、第二个业务结果或重复绑定。
- **FR-008** [UPSTREAM: §10 / V1-C20] Accept MUST NOT 自动授予：整个 Family 数据访问权、所有 Case 历史、家长私人内容、其他成员私人内容、所有未来 feature、Evidence 创建、AI 访问或任何事实确认。
- **FR-009** [UPSTREAM: §1.5 / §7.1] Accept MUST 复用 Account ↔ Person = 1:1：MUST NOT 为已存在的 Person 生成第二个 Person，MUST NOT 重复 Account ↔ Person 绑定，MUST NOT 依据昵称猜 Person，MUST NOT 依据 Family membership 自动绑定账号。具体 binding token / transaction / DB 机制留给 Plan。
- **FR-010** [UPSTREAM: V1-C39 / §7.7A / §10] 对 UNDER_14，Slice 1 的 consent-first 顺序 MUST 被继承：adult actor → guardian consent onboarding → valid consent → formal child Person → compliance state → downstream processing。参与邀请与接受 MUST NOT 变成「invite → create child Person → later obtain consent」，MUST NOT 为了发邀请或完成参与而绕过 guardian relationship、有效监护人同意或 Compliance Profile。
- **FR-011** [UPSTREAM: §1.2 / U11 / V1-X04 / V1-C03] 被邀请人 MUST 可以拒绝参与。Decline 是合法业务结果：MUST NOT 被当成失败或不合作，MUST NOT 自动关闭 Case，MUST NOT 自动阻断家长可独立完成的所有工作；孩子拒绝 MUST NOT 被处理成「整个服务必然失败」。
- **FR-012** [UPSTREAM: U11 / V1-C03 / §5 不变量 5] 拒绝 MUST 留下可保留的真实历史；系统 MUST NOT 静默丢弃拒绝事实，也 MUST NOT 把拒绝补成确定性的「已参与」或「无问题」。具体领域对象语义（拒绝邀请 vs 产生 DECLINED participation 历史）留 Clarify（见 OQ-2）。
- **FR-013** [UPSTREAM: §1.2 / U11] 已接受的 Participant MUST 可以中途退出。退出后后续 Participant 权限 MUST 停止；系统 MUST NOT 继续假装其仍在参与。
- **FR-014** [UPSTREAM: §1.2 / §5 不变量 5] 退出 MUST 保留已形成的合法历史，MUST NOT 伪造删除历史。完整数据删除 / 权利工作流不在本 Slice；退出只保证权限停止与历史保留。退出后的领域对象形态留 Clarify（见 OQ-3）。
- **FR-015** [UPSTREAM: U11] 邀请 MUST 能进入**不再可接受的合法终态 / 失效状态**（拒绝、撤回、过期、越权等），以支持 U11 的「拒绝、撤回、过期、越权」验收。已终止 / 失效邀请 MUST NOT 被重复激活。具体 TTL 与状态枚举 MUST NOT 在本 Spec 凭空发明，留 Clarify / Plan（见 OQ-4）。
- **FR-016** [UPSTREAM: §8.5 / §5 不变量 17 / V1-C28] 重复 / 并发接受同一有效邀请 MUST 只产生恰好一个活跃参与结果；重复 decline / withdraw MUST NOT 产生互相矛盾的业务结果。所有命令 MUST 继承 §8.5 的 `actor_id + command_type + idempotency_key` 合同：相同请求返回原结果，同 key 不同 canonical payload 返回 409。具体 advisory lock / hash payload / DB constraint 名称留 Plan。
- **FR-017** [UPSTREAM: §9 / §10 / V1-C20 / V1-C21] 参与行 MUST NOT 构成「全 Case 可见」的授权，也 MUST NOT 默认允许读取 Case 全量数据、家长原始消息、Evidence、家庭历史、全部 Formulation 或全部 Plan。Participant 只获得**当前 Case 的、明确批准的有限权限**。
- **FR-018** [UPSTREAM: §10 / §9] 在本 Slice 中，活跃 Participant MUST NOT 自动获得 Case 读取；MUST NOT 自动继承 Case manager 能力，也 MUST NOT 调用 manager-only Case 命令。该答案为**明确 NO**，不得模糊。
- **FR-019** [UPSTREAM: §5 不变量 3 / §7.2] Participant 生命周期 MUST NOT 自动生成 STATEMENT / FACT / HYPOTHESIS / OBSERVATION：accept ≠ Fact、decline ≠ Statement、withdraw ≠ Evidence。参与本身是独立业务状态；未来需要把参与者本人意见记录为 Evidence 时，由对应正式业务流程处理。
- **FR-020** [UPSTREAM: §9 / V1-C21] 系统 MUST 区分至少三类 actor 并分别授权：(a) Case manager / inviter —— 可在合法 Case context 创建 invite；(b) invite target —— 只能处理明确发给自己的 invite；(c) Participant —— 只能访问当前正式批准给 Participant Core 的最小资源。Participant MUST NOT 自动继承 Case manager 能力。
- **FR-021** [UPSTREAM: §9 / §9.1 / V1-C21] 所有 Participant Core 读写 MUST 先经统一 `authorize()`，再在 `withRlsTransaction` 内执行；客户端传入的 `family_id` / `case_id` / `person_id` / participation 标识 MUST 只作待验证参数；RLS 存在 MUST NOT 成为跳过 `authorize()` 的理由；无上下文 MUST 默认拒绝。
- **FR-022** [UPSTREAM: §37.2 / V1-C21 / §9] 创建邀请对「Case 不存在 / Case 属于其它 Family / actor 无 Case 管理权限」MUST 不泄露 Case 存在性；invitation token 查询 MUST NOT 向不合法 caller 泄露 target Person / Family / Case / guardian / age / consent / compliance 私密细节。具体 error code 复用既有冻结 shared error contract 或留 Clarify / Plan。
- **FR-023** [UPSTREAM: §7.9 / §38] Participant 生命周期 MUST 可审计，至少业务上可追踪 invitation created / accepted / declined / withdrawn / expired-unusable（如果最终作为正式 state）。MUST 复用既有 `business_audit_events`；MUST NOT 创建第二套 audit framework；具体 event_type 名称与表结构留 Plan。
- **FR-024** [UPSTREAM: V1-C39 / §10 / §9] Participant 不是 Consent 的替代物：`Participant accepted ≠ all purposes consented`，`guardian consent ≠ child participation acceptance`，二者是不同事实。未来进入 AI 交互、specific sensitive processing 或 feature-specific use 时，仍须重新验证对应 Consent / Compliance / Purpose / feature policy。
- **FR-025** [UPSTREAM: §9 / §10 / V1-C20] 未来任何业务对象访问 MUST 由 Participant 之外的独立 authorization 决定：参与行存在不足以放行；具体对象仍需 Visibility + Purpose + feature-specific authorization 重新校验。
- **FR-026** [UPSTREAM: §28.8] 本 Slice 批准的 public surface 限于 Participant Core：`POST /api/v1/cases/:id/participation-invites`、`GET /api/v1/participation-invites/:token`、`POST /api/v1/participation-invites/:token/accept`、`POST /api/v1/participations/:id/decline`、`POST /api/v1/participations/:id/withdraw`、`GET /api/v1/participations/:id`。MUST NOT 暴露 `POST /api/v1/participations/:id/responses` 或任何越界 / 占位路由。
- **FR-027** [UPSTREAM: §28.8 / §28.3] `GET /api/v1/participations/:id` MUST 只返回参与关系自身的最小状态，MUST NOT 成为隐式 Case read，也 MUST NOT 返回任何 Case 业务对象或跨成员数据。其最小 payload 与是否必要留 Clarify（见 OQ-5）。
- **FR-028** [UPSTREAM: §28.8 / §9] 本 Slice MUST NOT 定义通用、万能的 participant response blob；未来「本人反馈」归属具体业务对象（Assessment / Problem Formulation / Goal / Plan / Review / Scene Node），由其对应 Slice 建立并重新校验权限。
- **FR-029** [UPSTREAM: §1.2 / §10] 一个 Case MAY 存在多个 Participant（不同 Person）；参与关系以 (Case, Person) 为单位。同一 Person 在同一 Case MUST NOT 存在重复活跃参与。具体参与基数上限与多参与者交互语义若上游未定，留 Clarify。
- **FR-030** [UPSTREAM: AGENTS / Constitution III / §38] 本 Slice 的 Implement MUST 在 Slice 1 与 Slice 2 达到「Implement complete → Independent Converge PASS → merged main」后方可开始。本 Spec（Specify 阶段）可以基于 Slice 1 / 2 的冻结设计提前定义，但 MUST NOT 把「设计存在」当成「代码已真实可用」，MUST NOT 执行 Implement Gate。Slice 3 是否为硬 Implement 依赖由实际证据依赖决定（见 Dependency Assumptions）。
- **FR-031** [UPSTREAM: §5 不变量 17 / V1-C27] 创建邀请、接受、拒绝、退出 MUST 返回真实状态：无权、未找到、冲突、幂等重放、数据库拒绝均不得伪装成成功；失败时 MUST NOT 留下部分写入的参与 / 邀请 / 审计记录。

No requirement may be invented to make implementation easier.

## Key Entities

本 Slice 的实体以 `Docs/V1技术设计.md` §7.1 已批准的表为准；列级 DDL、enum、约束、索引与迁移顺序属 Plan，不在本文决定。

### `case_participants`（§7.1 已批准表）

Case 级参与关系。逻辑约束（不是 DDL）：

1. **标识**：系统生成唯一标识；`uuidv7()` 基线；创建后不可变。
2. **Case 链接**：必须引用一个真实存在的 Case，且与该 Case 的 Family 作用域一致。
3. **Person 链接**：必须引用一个真实存在的 Person；参与关系指向 Person，而非 Account；Person 无 Account 时参与仍可存在（§1.5）。
4. **参与状态 / 生命周期**：至少能表达 invitation / acceptance lifecycle 与 created / accepted / declined / withdrawn 时间语义，以及不再可接受的终态 / 失效状态（§10、U11）。具体列名、enum 取值与状态图留 Plan；TTL 留 Clarify。
5. **唯一性 / 重复防护**：同一 (Case, Person) MUST NOT 存在重复活跃参与；重复 / 并发必须收敛到恰好一个业务结果（§5 不变量 17）。
6. **禁止语义**：MUST NOT 用参与行表达 Family membership、guardian relationship、Account ownership 或 Rbac role；MUST NOT 承载 Evidence 内容（§5 不变量 1、§7.1）。
7. **可审计**：生命周期变更 MUST 留有可审计记录（复用 `business_audit_events`）。

### 邀请 / 参与入口（持久化形态属 Plan）

邀请的可解析入口（token 载体）、token 格式 / hash / expiration storage、unique constraint 与 transaction 表达属 Plan；本文只冻结业务语义：邀请不可枚举、只由目标处理、可进入失效状态、不可重复激活（FR-006、FR-015、FR-016）。其与 `case_participants` 是一个对象（带 INVITED 状态）还是两个对象（invite 与 participation），留 Clarify（OQ-1）。

### 复用、本 Slice 只增量使用的既有基础

- `persons` / `families` / `family_members`（Slice 1）：作为参与目标、目标 Family 归属与授权输入；不修改其冻结语义（§7.1、§9）。
- `person_compliance_profiles` / `consent_records`（Slice 1）：作为 UNDER_14 consent-first 与 Compliance Profile 前置条件；不绕过、不重新设计（§7.7A、V1-C39）。
- `cases`（Slice 2）：参与关系必须挂在真实 Case 上；不修改 Case Core 冻结语义（§7.2）。
- `idempotency_keys`（Slice 1）：本 Slice 增加 Participant Core 命令类型，沿用 §8.5 合同与重放快照。
- `business_audit_events`（Slice 1 / §7.9）：本 Slice 增加 Participant 生命周期审计事件，仅用于真实写动作；MUST NOT 用于第二套 audit framework。
- `authorize()` / `withRlsTransaction`（Slice 1 / §9、§9.1）：本 Slice 增量扩展 Case 参与关系这一 authorization dimension。

### 明确不存在于本 Slice 的对象

`problem_formulations`、`scene_node_states`、`scene_artifacts`、任何 Evidence writer、`assertions` / `observations` 的新写入语义、Plan / Task / Review / Follow-up / Notification / AI / Memory、通用 participant response 结构。

## Success Criteria

- **SC-001**: cross-Family participant writes = 0：Family A 的 Case 无法与仅属于 Family B 的 Person 建立邀请 / 参与；无论以 subject 还是 target 形式出现，均被拒绝且不泄露该 Person 敏感信息。
- **SC-002**: duplicate / concurrent accept of the same valid invite produces exactly one active participation；Request 重试后参与记录数不变。
- **SC-003**: Participant cannot invoke manager-only Case command；活跃 Participant 无法创建 / 列表 / 读取其 Case 的 manager-only 能力，也无法访问 Case 级业务资源。
- **SC-004**: accept produces no Evidence：一次 accept 后 `Assertions + 0`、`Observations + 0`；decline / withdraw 同样 `+0`。
- **SC-005**: terminal invite cannot reactivate：已拒绝 / 已退出 / 已过期 / 已作废邀请再次接受或激活均失败。
- **SC-006**: unauthorized token lookup leaks no Case / Person payload：不合法 caller 查询邀请 token 时不返回 target Person / Family / Case / guardian / age / consent / compliance 字段，也不构成枚举 oracle。
- **SC-007**: all approved routes enumerate exactly the expected Participant Core surface；不存在 `POST /api/v1/participations/:id/responses` 或任何越界 / 占位路由。
- **SC-008**: accept creates no duplicate Person / binding：接受前后 Account ↔ Person 仍为 1:1 且复用既有 Person。
- **SC-009**: decline does not auto-close Case，也不阻断家长可独立完成的工作；拒绝历史被保留。
- **SC-010**: withdraw stops subsequent Participant capability，且已形成历史未被伪造删除。
- **SC-011**: invite create 对「Case 不存在 / Case 属于其它 Family / actor 无 Case 管理权限」三类情形对外表现一致，不泄露 Case 存在性。
- **SC-012**: UNDER_14 无有效监护人同意时，参与邀请 / 接受路径被阻断，且不产生非法 child Person。
- **SC-013**: Participant 生命周期事件可在既有 `business_audit_events` 中追溯；不存在第二套 audit framework / 表。
- **SC-014**: 所有命令的重复 / 并发重放不制造重复业务结果；同 key 不同 canonical payload 返回 409。
- **SC-015**: 结构 / 路由枚举可机械证明本 Slice 未创建越界对象（formulation / scene / evidence writer / assessment / generic participant response / AI / plan / task / notification）。

## Acceptance Evidence

| Acceptance item | Verification type | Required evidence |
|---|---|---|
| Happy path：invite → accept → 一个活跃有限参与（场景 1、SC-002、SC-008） | integration + database | 邀请创建、目标接受后端到端断言：恰好一个活跃参与、Account ↔ Person 1:1 复用既有 Person、无第二个 Person、无 Case 级业务数据被授予 |
| Decline 为合法结果并保留历史（场景 2、SC-009） | integration + database | 邀请 → 拒绝后：无活跃参与、拒绝历史存在、Case 状态未被自动改变、家长侧可独立操作未被阻断 |
| Withdraw 停止权限且保留历史（场景 3、SC-010） | integration + database | 活跃参与 → 退出后：后续 Participant 能力被拒、历史记录仍可追溯且未被删除 |
| Duplicate / concurrent accept（场景 4、SC-002、SC-014） | integration + database concurrency | 同一有效邀请并发 / 重复接受后，活跃参与计数 = 1；`case_participants` 行数不重复增长 |
| Wrong user token（场景 5、SC-006） | integration + security | Person B 接受 Person A 邀请被拒；响应不含 target Person / Family / Case / guardian / age / consent 字段；无第二个 Person / 绑定 |
| Cross Family（场景 6、SC-001） | integration + database | Family A Case + 仅属 Family B 的 Person：邀请 / 参与请求被拒、参与写入 = 0、不泄露该 Person 敏感信息；UUID 存在不构成合法参与 |
| UNDER_14 illegal path（场景 7、SC-012） | integration + database | UNDER_14 无有效同意时，邀请 / 参与路径阻断；不新增正式 child Person / compliance profile；不绕过 guardian / consent 前置 |
| Non-manager cannot invite（场景 8、SC-003） | integration | 非 Case 管理 actor 创建邀请返回拒绝且无邀请写入；不依赖前端隐藏 |
| Invite create anti-enumeration（场景 9、SC-011） | integration | 三类情形（不存在 / 跨 Family / 无权限）响应体与状态语义一致、无 Case 存在性线索 |
| Unauthorized token lookup（场景 10、SC-006） | integration + security | 不合法 caller 查询 token 不返回任何私密字段；重复探测不暴露 Person / Case 是否存在 |
| Terminal invite cannot reactivate（场景 11、SC-005） | integration + domain | 已终态 / 失效邀请再次 accept / 激活失败，且不新增活跃参与 |
| No Case-wide access on accept（场景 12、SC-003） | integration | 活跃 Participant 访问 Case 级业务资源被拒；不继承 manager-only 能力 |
| No Evidence side effect（场景 13、SC-004） | domain + database | accept / decline / withdraw 后 `assertions` 与 `observations` 计数不变（+0） |
| No duplicate Person / binding（场景 14、SC-008） | integration + database | 接受后 Account ↔ Person 唯一约束仍成立、Person 数不变 |
| Auditability（场景 15、SC-013） | integration + database | 生命周期事件存在于 `business_audit_events`；无第二套 audit 表 / 框架 |
| Idempotency（场景 16、SC-014） | integration + domain contract | 重放返回原结果、业务结果数不变；同 scope key + 不同 canonical payload 返回 409（复用共享幂等层验证，不伪造不可达 HTTP 场景） |
| Route surface enumeration（场景 17、SC-007、SC-015） | route + schema enumeration | 路由清单只含批准的最小 Participant Core 子集；不存在 `POST /participations/:id/responses`、assessment、formulation、scene、generic evidence CRUD、占位路由 |
| RLS / cross-family hard block（场景 18、SC-001） | integration + database | 应用层拒绝 + 运行角色在错误 Family 上下文 / 无上下文下 SELECT 0 rows / write denied |
| Implement dependency gate（场景 19、FR-030） | governance evidence | Slice 1 / 2 未达 Implement complete + Converge PASS + merged main 时，Implement 明确 BLOCKED |
| Migration / RLS / 角色 / uuidv7（如实现阶段适用） | database verification | 若引入新表 / 新 RLS：`relrowsecurity = true`、`relforcerowsecurity = true`、运行角色非 owner 且 `rolbypassrls = false`、主键默认值检查输出 |

## Security / Privacy Invariants

1. **不可枚举**：邀请 token MUST NOT 可被猜测或枚举；未授权 lookup MUST NOT 成为 Person / Case 枚举 oracle（FR-006、FR-022、§37.2）。
2. **最小泄露**：任何邀请 / 参与响应 MUST NOT 泄露 target Person / Family / Case / guardian / age / consent / compliance 私密细节（FR-006、FR-022、V1-C21）。
3. **目标绑定**：只有明确邀请的目标 Person 可以处理该邀请；非目标接受 MUST 失败（FR-006、FR-007）。
4. **无隐式 Case 读取**：参与行 MUST NOT 构成 Case 全量可见授权；Participant 访问任何业务对象仍需独立 Visibility / Purpose / authorization（FR-017、FR-018、FR-025、§10、V1-C20）。
5. **无角色越权**：Participant MUST NOT 继承 Case manager 能力，也不得通过 participant role 获得跨成员权限（FR-018、FR-020、§9）。
6. **双层隔离**：应用层 `authorize()` + 数据库 RLS 双层防线；运行角色非 table owner、NOBYPASSRLS；无上下文默认拒绝（FR-021、§9.1）。
7. **合规前置不可绕过**：UNDER_14 无有效监护人同意时，参与路径 MUST 被阻断；不得以邀请流程创建非法 child Person（FR-010、V1-C39、§7.7A）。
8. **无 Evidence 副作用**：参与生命周期不得被写成事实 / 陈述 / 观察，也不得自动触发 Evidence 写入（FR-019）。
9. **Consent 与参与分离**：Participant accepted ≠ all purposes consented；未来敏感处理仍需重新验证 Consent / Compliance / Purpose（FR-024）。
10. **审计不可伪造**：生命周期事件复用既有 `business_audit_events`，不得创建第二套审计框架，也不得通过覆盖 / 删除历史改写参与真相（FR-023、§7.9）。

## Dependency Assumptions

本 Spec 可以基于 Slice 1 / 2 / 3 的**冻结设计**提前定义，但不得把「设计存在」当成「代码已真实可用」。本轮只做 Specify，**不执行 Implement Gate**。

### 硬 Implement 依赖（未来 Implement 前必须满足）

- **Slice 1 `001-family-identity-core`**：Identity / Family / `family_members` / Consent / Compliance / `authorize()` / RLS / 幂等 / `business_audit_events` 基础已 Implement complete → Independent Converge PASS → merged main。参与关系依赖 Person、Family 归属、guardian / consent 前置与最小授权地基。
- **Slice 2 `002-case-core`**：Case Core 已 Implement complete → Independent Converge PASS → merged main。参与是 Case 作用域对象，没有合法 `cases` 就不存在合法参与记录；同时复用其 Case 管理主体语义与 Case 授权 / RLS。

### 非硬依赖（不得按编号自动建立）

- **Slice 3 `003-evidence-core`**：本 Slice 明确「participation lifecycle 不写 Evidence」（FR-019），因此**原则上不是 Slice 4 的硬 Implement 依赖**。若未来实现中发现真实证据依赖，必须显式记录并重新评估，而不得为了序号人为要求 Slice 3 merge。

### 依赖参考（只读）

Slice 1 / 2 / 3 只作为**design dependency**（冻结设计语义）与只读 reference；本轮不得 merge 这些未完成 feature branch，也不得基于其分支创建 Slice 4。

### 实现前必须重新验证（不得假定已经存在）

1. Slice 1、Slice 2 已按约定合并到基线分支并通过 required gates；
2. `authorize()` 可安全扩展到「Case 参与关系」这一 dimension，且不影响 Family / Case 行为；
3. `withRlsTransaction` 与 RLS helper 可用；
4. `idempotency_keys` 行为（相同键重放、不同 payload 409）已通过；
5. `business_audit_events` 基础已通过；
6. 相关 CI 与数据库验证为 green。

若任一验证失败，Slice 4 MUST 停止并报告 BLOCKED / NOT VERIFIED；MUST NOT 在 Slice 4 私建替代 Family / Consent / RLS / 幂等 / 审计基础设施。

### 明确不得依赖

- 不得依赖尚未实现的 Assessment、Problem Formulation、Scene、Evidence writer、Plan / Task、Notification、AI。
- 不得在 Slice 4 分支修改 Slice 1 / 2 / 3 文件、重新设计其冻结基线或修改正式 `Docs/**`。

## Assumptions

**已由文档推导，非新增语义**

- 参与是 Case 作用域对象：§10 明确「获得当前 Case 的有限权限」，§28.8 的邀请与参与端点挂在 `/cases/:id/...` 与 `/participations/:id` 之下，§7.1 的 `case_participants` 与 §7.2 的 `cases` 分属不同表组。
- Case 管理 actor 复用 Slice 2 已冻结的「当前目标 Family 的 V1 管理主体 = 创建该 Family 的 adult Person」语义；Participant 不重新定义 Case 权限。
- 「必要绑定确认」的具体机制（binding token / transaction / DB 约束）属 Plan；本文只冻结「不得产生第二个 Person / 第二个绑定」的产品不变量。
- 本 Slice 只交付服务端能力；微信小程序 UI 属 §28A，不在本 Spec。
- V1 家庭主端是现有微信小程序（V1-C36）；「邀请可被真实交付」（V1-X02）属未来平台 integration 的真实平台验证范围，本 Slice 不建立 notification framework。
- 参与是 Phase 1 能力，不是 V2–V5；因此本 Slice 不因「未来孩子会参与更多流程」而预建后期结构。

**无上游明文，本轮显式标注（不得当成已批准需求）**

- **A-1 参与 / 邀请的对象模型边界**：本文以业务语义（生命周期、终态、历史保留、幂等结果）冻结验收，不拍板「单对象带 INVITED 状态」还是「invite 与 participation 两对象」；该结构判断留 Clarify（OQ-1）。
- **A-2 错误码命名与对外语义**：本文要求「不泄露存在性 / 不泄露私密字段」，但不发明新的错误码。若既有冻结 shared error contract（如 `CURRENT_FAMILY_NOT_FOUND` / `NOT_FAMILY_MANAGER` / `VALIDATION_ERROR` / `IDEMPOTENCY_PAYLOAD_MISMATCH`）可直接复用则复用，参与专属错误码命名留 Clarify / Plan。
- **A-3 邀请 TTL**：正式文档未给出任何 TTL 数值；本文不发明 24h / 72h / 7d，具体 TTL 留 Clarify / Plan（OQ-4）。
- **A-4 幂等适用范围**：§8.5 把幂等合同限定在「关键命令」；本文把「创建邀请 / 接受 / 拒绝 / 退出」视为关键命令属判断，不是文档枚举；不得据此要求全部读操作都带幂等键。

## Open Questions

以下为真实的产品 / 领域歧义，正式文档无法唯一回答；本轮 Specify **不自行拍板**，留 Clarify。仅列产品 / 领域问题，不含 Plan-level 技术问题。

| # | 问题 | 为什么不是 Plan 问题 | 相关上游证据 |
|---|---|---|---|
| OQ-1 | 邀请与参与是**一个对象**（`case_participants` 自身带 `INVITED` 状态，accept 后转活跃）还是**两个业务对象**（invite 与 participation 分开，仅 accept 后才创建 Participant）？ | 这是产品 / 领域语义，决定「谁在 accept 前已存在参与事实」以及 decline / withdraw 的作用对象 | §7.1 只给 `case_participants` 表名；§28.8 同时存在 `participation-invites/:token` 与 `/participations/:id` 两套资源 |
| OQ-2 | 孩子 decline 是**拒绝邀请**（invite 终态）还是**创建一个 DECLINED 参与历史**（participation 终态）？ | 决定拒绝事实落在哪个领域对象，影响未来审计 / 历史检索语义 | U11 要求保留「拒绝」；§5 不变量 5 要求真实状态保留；§28.8 只有 `/participations/:id/decline` |
| OQ-3 | withdraw 之后是**保留终态 Participant row**，还是**另建参与历史 / 事件**表达？ | 决定历史承载对象；本文只冻结「历史不可丢」 | §1.2 / U11 要求中途退出；§5 不变量 5 |
| OQ-4 | 邀请失效 / 过期是否需要**正式状态表达**，以及具体 TTL 数值是多少？ | 正式文档要求覆盖「过期」，但未给状态枚举与任何 TTL 数值 | U11 明确含「过期」；正式文档无 TTL 依据 |
| OQ-5 | `GET /api/v1/participations/:id` 是否真的属于当前最小核心，以及它最小能返回什么（如何防止变成隐式 Case read）？ | 决定 public surface 边界与最小 payload 语义 | §28.8 列出该端点；§10 / V1-C20 要求 Participant 无全 Case 可见 |
| OQ-6 | 接受邀请时「必要绑定确认」的产品交互边界：目标 Person 无 Account 时，是否允许在同一接受流程内完成 Account 创建 + 绑定，是否需要额外的目标身份确认步骤？ | 影响参与入口的可完成性与安全边界（不属于纯 DB 机制） | §10 流程含「必要绑定确认」；§1.5 允许 Person 无 Account |
| OQ-7 | 是否允许**外部 / 非目标 Family 成员**成为 Participant？本文按 §1.5 / §10 冻结为 **NO**（只允许已合法存在于目标 Family 的 Person），若上游确认需要外部参与，必须先改正式文档再扩 Slice | 属产品范围判断；本文按现有文档取最保守解释 | §1.5（V1 不提供跨家庭能力）、§10（有限 Case Participant） |
| OQ-8 | 一个 Case 是否允许**多个 Participant**，以及多参与者的交互语义（本文冻结 (Case, Person) 唯一、允许多 Person，但不定义他们之间的协作语义） | 决定参与基数与多参与者产品语义 | §1.2「不要求爸爸、妈妈、孩子或祖父母全部注册」；§7.1 `case_participants` 为关系表 |

**Residual blockers**: NONE（本 Spec 可完成；上述歧义不阻断 Specify，留 Clarify）。
