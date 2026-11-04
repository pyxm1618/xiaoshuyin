# Feature Specification: 家庭身份地基（Account / Person / Family / 成员关系）

**Feature Directory**: `specs/001-family-identity-core`  
**Created**: 2026-11-04  
**Status**: Draft  
**V1 Phase**: Phase 1 — Common Core 地基（`Docs/V1技术设计.md` §38）

> This feature spec is a downstream implementation projection. It MUST NOT introduce product semantics absent from the approved Xiaoshuyin documents.

## Upstream Traceability

| Upstream ID / Section | Source | What this slice implements |
|---|---|---|
| V1-C20 | `Docs/V1产品需求.md` | Account、Person、Family、成员关系、Visibility、Purpose、Consent 的基本边界从 V1 就存在，且四类对象彼此分开 |
| V1-C21 | `Docs/V1产品需求.md` | 家庭成员信息按真实授权用途判定与使用，隔离由服务端执行，不靠提示词或前端隐藏 |
| V1-C39 | `Docs/V1产品需求.md` | 服务端保存年龄段、未成年人模式、监护关系和必要监护人同意状态；不满 14 周岁无有效监护同意时阻断对应处理 |
| V1-C03 | `Docs/V1产品需求.md` | 未知状态（UNKNOWN / NOT_COLLECTED / DECLINED / N/A）不得被补成确定值 |
| U01 | `Docs/V1产品需求.md` §23 | 登录取得身份（仅登录与身份识别，不含服务开放状态页与 AI 身份提示页） |
| U02 | `Docs/V1产品需求.md` §23 | 年龄 / 监护关系与必要的监护人同意（仅监护人对其所代表未成年人这一部分） |
| U03 | `Docs/V1产品需求.md` §23 | 建立最小家庭与人物资料；非理想状态：未知、转述、无孩子账号 |
| §1.1 / §1.2 参与原则 | `Docs/V1产品需求.md` | 家长可独立开始；不要求全部成员注册；未注册成员可由家长转述记录 |
| §2.2 来源类型 | `Docs/V1产品需求.md` | 本人陈述 / 家长观察 / 家长转述 / 其他成员转述等来源必须可区分 |
| §18.1 / §18.2 | `Docs/V1产品需求.md` | Account / Person / Family / Participant / Visibility / Purpose / Consent 边界；家长账号不是所有信息的所有者 |
| §19A.2 | `Docs/V1产品需求.md` | adult / guardian、minor 14–17、child under 14、age unknown 四分；不满 14 需可验证监护人同意证据；未成年人模式为服务端状态 |
| §1.5 身份与家庭归属边界 | `Docs/V1产品需求.md` | Person ↔ Family 多对多；Account ↔ Person 1:1 / 0..1；创建 Family 的 adult 为 V1 当前管理主体；guardian 不是家庭角色；V1 不因此提供多家庭产品能力 |
| §5 领域不变量 1 | `Docs/V1技术设计.md` | Account、Person、Family、CaseParticipant 分开建模 |
| §5 领域不变量 4 | `Docs/V1技术设计.md` | 监护人转述不得自动升级为本人事实/确认 |
| §5 领域不变量 5 | `Docs/V1技术设计.md` | 真实未知状态不得被补成确定值 |
| §5 领域不变量 27 | `Docs/V1技术设计.md` | 不满 14 周岁个人信息处理无有效监护人同意时必须 BLOCK |
| §7.0 | `Docs/V1技术设计.md` | 主键 `uuidv7()` 基线；migration 只经 reviewed migration file 进入环境 |
| §7.1 | `Docs/V1技术设计.md` | 身份与授权表；Account ↔ Person 1:1、Person ↔ Family 多对多经 `family_members`、唯一 (family, person)、不引入成员角色枚举 |
| §7.7A | `Docs/V1技术设计.md` | `person_compliance_profiles` 的 age_band、minor_mode、guardian_person_id（单值、独立于 membership）、guardian_consent_version、verified_source |
| §9 | `Docs/V1技术设计.md` | 统一 `authorize()` 的判定输入；按当前目标 Family 的 membership 授权；创建者 adult 为管理主体；客户端 `family_id` 仅为待验证参数 |
| §9.1 | `Docs/V1技术设计.md` | RLS 作为家庭隔离第二道防线；迁移角色与运行角色分离；`withRlsTransaction` |
| §28.1 | `Docs/V1技术设计.md` | 身份与家庭 API 契约面（auth / me / families / members） |
| §28.2 | `Docs/V1技术设计.md` | 监护人同意记录入口（仅 guardian-consent 部分） |
| §38 Phase 1 | `Docs/V1技术设计.md` | 本 Slice 属于 Phase 1「Account / Person / Family / Participant」基础域的第一刀 |

**Blocking rule**: If required behavior cannot be traced to an approved source, mark it `NEEDS UPSTREAM DECISION` and do not implement it.

**范围裁剪说明（为什么本 Slice 不含 Participant）**：`Docs/V1技术设计.md` §7.1 将 `case_participants` 与 `cases` 分列于各自表组，§10 明确「孩子参与采用有限 Case Participant」，§28.8 的参与端点全部挂在 `/cases/:id/...` 之下。也就是说 Participant 在正式文档中是 **Case 作用域对象**，没有 `cases` 就不存在合法的 participant 记录。而 `cases` 会立即带入 Case Status / Phase 契约（§6.1—6.7、§8.1「一个家庭最多一个当前主要未结 Case」），属于本 Slice 明确排除的范围。因此本 Slice 交付 Participant 成立所依赖的**前置条件**：Person、家庭成员关系（§9 的「家庭关系」判定输入）与服务端可见范围判定；`case_participants` 与其邀请流程留给 Case 切片。此裁剪属切片边界决定，已按 Clarifications Q1 结案为 **RESOLVED — DEFER TO CASE SLICE**。

## Clarifications

### Session 2026-11-04

- Q: Participant 是否必须在本 Slice 内交付真实参与记录？ → A: **RESOLVED — DEFER TO CASE SLICE**。`case_participants` 是 Case 作用域对象：§10 明确「获得当前 Case 的有限权限」，§28.8 的邀请与参与端点全部挂在 `/cases/:id/participation-invites`、`/participations/:id` 之下，§7.2 的 `cases` 与 §7.1 的 `case_participants` 分属两组。§38 把 Participant 列在 Phase 1（阶段级），本 Slice 只是把该阶段内的这一对象推迟到 Case 切片，不改变 Phase 归属，也不为保住标题而引入最小 `cases`。
- Q: 一个 Person 是否可以同时属于多个 Family？ → A: **RESOLVED**（2026-11-04 上游写回）：Person ↔ Family = 多对多，只经 `family_members` 表达；`persons` 上 MUST NOT 使用 `family_id` 这类单家庭绑定；同一个 Person 可以存在于多个 Family，同一个 Person 在同一个 Family 不得有重复 membership。依据：`Docs/V1产品需求.md` v3.2 §1.5、`Docs/V1技术设计.md` v3.7 §7.1。V1 不因此获得跨家庭共享 / 合并 / 迁移 / 多家庭 UI 等产品能力。
- Q: guardian 只是 family member 的一个角色，还是必须独立表达的监护关系？ → A: **RESOLVED**：监护关系是「某个成年 Person ↔ 某个未成年 Person」的关系，正式文档把它固定在该未成年人的 compliance profile 上 —— §7.7A 给出 `person_compliance_profiles.guardian_person_id?` 并明确它与 Family membership 相互独立，§10 要求「进入孩子端前必须读取服务端 Compliance Profile：…guardian relationship…」，V1-C39 要求服务端保存「监护关系」。因此 MUST NOT 把 guardian 压成 `family_members` 上的家庭级布尔/角色位。成员本身的授权属性已由 §7.1 / §9 结案：V1 不引入角色枚举与 RBAC，管理主体为创建 Family 的 adult（见下方 R-2a）。
- Q: 同一家庭内非 guardian 成员的默认可见范围是什么？ → A: **DEFERRED**。正式文档只对 Case / 内容类对象定义了孩子侧读取范围（§10：本人提交、明确共享片段、本人任务、明确允许的共同内容），§18.2 只约束「孩子未授权的私人原话」「其他成员的所有私人内容」；§9 新增的是「成员管理主体」，不是读可见范围。对 family metadata、membership、Person basic profile 的读可见范围仍未定义。本 Slice 只落 §9 的最小判定（家庭关系 + Consent + Purpose + RLS 双层），不建通用权限 DSL，也不提前设计 Case / Statement / Goal / Task / Artifact 的 visibility matrix。

**Upstream decision closeout（2026-11-04，Docs v3.2 / v3.7 已写回）**

- **R-1 Person ↔ Family 基数 — RESOLVED**：多对多，只经 `family_members`；同 Person 可属于多个 Family，同 Person 同 Family 不重复。依据：`Docs/V1产品需求.md` §1.5、`Docs/V1技术设计.md` §7.1。
- **R-2a 家庭成员的授权属性 — RESOLVED**：V1 不建立 family role enum、不建立 guardian / non-guardian 角色、不建立 RBAC；创建 Family 的 adult Account / Person 是当前管理主体，其他成员不自动获得成员管理权限。依据：产品需求 §1.5、技术设计 §7.1 / §9。
- **R-2b 多监护人 — RESOLVED — DEFER MULTI-GUARDIAN**：V1 使用单一 `person_compliance_profiles.guardian_person_id`，一个未成年人只保存一个有效 guardian reference；multi-guardian / joint custody / guardian history 后置。依据：产品需求 §1.5、技术设计 §7.7A / §9。

**Residual blockers**: NONE。

## Scope

### In Scope

1. **Account 与登录身份**：家长（adult）通过微信登录建立 Account，并能取回「当前登录者是谁」及其关联 Person。
2. **Person**：本人建立的 Person；家长代记的其他家庭成员 Person；Person 可以不关联任何 Account（无孩子账号）。
3. **资料来源区分**：至少区分本人陈述、家长观察、家长转述、其他成员转述（§2.2），来源可追溯，转述不得升级为本人确认；MUST NOT 只有「本人 / 转述」两档。
4. **Family 与成员关系**：家长创建 Family 并在其后属于该 Family（`GET /api/v1/families/current` 语义，§28.1）；家庭关系作为 `authorize()` 的独立输入（§9）。Person ↔ Family 为多对多，只经 `family_members` 表达，唯一表达 (family, person)（§7.1）。本 Slice MUST NOT 引入 `family_members` 角色枚举或 RBAC（§7.1 明确不引入）；创建该 Family 的 adult 是 V1 当前管理主体（§9）；监护关系按 Q3 由未成年人 compliance profile 单独表达。
5. **未成年人合规最小门禁**：服务端保存 age_band（取值仅 ADULT / MINOR_14_17 / UNDER_14 / UNKNOWN，§7.7A）、未成年人模式、监护关系、监护人同意版本；UNDER_14 且无有效监护人同意时，阻断对该 Person 的后续个人信息处理（见 FR-008 的边界）。
6. **统一授权判定**：所有家庭级读写经单一授权判定入口，输入当前身份、家庭关系、可见范围、用途；客户端 family_id / person_id 只作为待验证参数。
7. **家庭隔离双层防线**：应用层授权判定 + 数据库 RLS（ENABLE + FORCE），运行账号非 table owner 且 NOBYPASSRLS，无上下文默认拒绝。
8. **幂等与真实失败状态**：关键命令重复提交不产生重复家庭 / 重复成员 / 重复同意记录；不存在、无权、越权、冲突、未知状态均返回真实结果。

### Out of Scope

- `cases` 及 Case Status / Phase 状态机、`case_events`（§6、§8.1）。
- `case_participants`、参与邀请、孩子端参与流程（§10、§28.8）——见上方范围裁剪说明与 Clarifications Q1。
- `family_members` 的角色模型：`guardian` / `non-guardian` 角色、admin / owner / child / member 通用角色 DSL 与 RBAC（§7.1 明确 V1 不引入）。
- 多管理员与家庭成员角色权限矩阵（§1.5、§9：其他成员不自动获得成员管理权限）。
- 多监护人 / joint custody / guardian 历史关系（V1 只用单值 `guardian_person_id`，见 R-2b）。
- 跨家庭共享、家庭合并、家庭迁移、多家庭切换 UI 与跨家庭协作体验：数据模型允许多 Family，但 V1 不提供这些产品能力（§1.5、§7.1）。
- Statement / Observation / Fact / Hypothesis / `assertions`（§7.2）。
- Problem Formulation、Goal、Intervention、Plan / PlanVersion、Task / Checkin、Review、Outcome / Closure / Referral（§6、§7.3）。
- Digital Use Scene、Node Manifest、routing、A/010xx 任一节点（§12）。
- AI / RAG / 模型接入 / Promptfoo / pgvector / pg-boss / Notification（§13—§26）。
- 微信小程序 UI、运营后台 UI（§28A）。
- `staff_assignments` 与后台人工能力（§28.10）。
- 数据权利（查看/更正/导出/删除，U18、§28.9）与更正传播（§29.6）。
- 完整 Consent 平台：purpose/scope 矩阵、单独同意分类、撤回对下游 Formulation / Plan / Memory / AI run 的传播（§29.5）。本 Slice 只处理监护人对其所代表未成年人的同意与撤回阻断。
- Compliance 策略引擎、`compliance_feature_policies`、PIPIA、拟人化适用判断、连续使用计时（§27B）。
- V2–V5 capabilities not required by this slice.

### Non-Goals

- 不建设跨家庭共享、家庭合并、家庭迁移、多家庭切换与跨家庭协作；允许多 Family 只体现在数据模型不锁死单一家庭（§1.5）。
- 不为「以后可能扩展」预先设计通用权限 DSL、通用主体模型或家庭角色枚举。
- 不把家庭主端页面、交互稿、文案作为本 Slice 交付物。
- 不优化性能基线、容量或成本；只要求确定性正确与可验证隔离。

## User Scenarios & Testing

### User Story 1 — 家长登录并建立自己的家庭 (Priority: P1)

一位家长用微信登录，系统建立 Account 与对应 Person，家长创建自己的 Family，并在其后属于该家庭、成为该 Family 的 V1 当前管理主体（§1.5、§9）。该家长对某个未成年 Person 的 guardian 关系不因「建了家庭」自动成立，须由该 Person 的 compliance profile 单独记录（§7.7A）。

**Upstream IDs**: U01、U03、V1-C20、§1.5、§28.1、§9、§7.7A

**Independent Test**: 仅用登录 + 建家庭两个动作即可完成；断言登录后能取回自身身份、建家庭后该家庭存在且当前 Person 属于该家庭并具备成员管理权限；不在此断言 guardian 角色。

### User Story 2 — 记录暂无账号的家庭成员 (Priority: P1)

家长为尚未注册的孩子或其他家庭成员（如另一名家长）建立 Person 记录（V1 当前由创建 Family 的 adult 执行），来源按 §2.2 的正式来源类型记录（本 Slice 至少区分：本人陈述 / 家长观察 / 家长转述 / 其他成员转述）；该 Person 没有 Account，且未知属性保持未知。

**Upstream IDs**: U03、V1-C03、V1-C20、§1.5、§5 不变量 1 / 4 / 5、§2.2

**Independent Test**: 建立一个无 Account 的 Person 后，断言其来源为家长转述或家长观察（而非「本人」）、其未知属性不被补值、且系统不把它当作本人确认的资料。

### User Story 3 — 未成年成员必须先有监护人同意 (Priority: P1)

家长录入的孩子被判为不满 14 周岁时，在缺少有效监护人同意的情况下，系统阻断对该 Person 的后续个人信息处理（AI 交互、孩子端进入及其后全部依赖该 Person 的处理），但不阻断为取得同意而必须建立的 age_band / 监护关系 / 同意记录本身；同意补齐后才放行后续处理。

**Upstream IDs**: V1-C39、§5 不变量 27、§7.7A、§10、§19A.2、§28.2

**Independent Test**: 同一 Person 在同意缺失与同意有效两种状态下分别调用受门禁保护的后续处理，断言前者 BLOCK、后者通过；并断言记录 age_band 与同意版本这两步在门禁关闭时仍可完成（否则同意永远无法补齐）。

### User Story 4 — 跨家庭访问必须失败 (Priority: P1)

已登录账号尝试读取不属于自己的家庭/成员资料时，应用层判定与数据库层都拒绝。

**Upstream IDs**: V1-C21、§9、§9.1

**Independent Test**: 用家庭 A 的身份访问家庭 B 的成员资料，断言应用层拒绝且响应中不含家庭 B 的任何字段；再绕过应用层直接以运行角色查询，断言 RLS 同样阻止。对外状态码语义见 Assumption A-2。

## Acceptance Scenarios

1. **Given** 一个已微信登录的家长账号，**When** 请求当前身份，**Then** 返回其 Account 与关联 Person（若已建立），且不返回其他家庭成员资料。**Upstream**: U01、§28.1
2. **Given** 一位家长，**When** 创建家庭，**Then** 家庭被创建，该家长的 Person 属于该家庭并成为 V1 当前的管理主体；不推断该家长是任何未成年人的 guardian；同一请求重复提交不产生第二个家庭或第二个成员关系。**Upstream**: U03、V1-C20、§1.5、§28.1、§9、§5 不变量 17
3. **Given** 该 Family 的创建者（V1 当前管理主体），**When** 为其家庭新增一个没有账号的成员并标记来源为家长转述，**Then** 该 Person 被创建、account 为空、来源为家长转述，未提供的属性保持未知状态而不是被填默认值；age_band 未提供时只能落在 §7.7A 的 UNKNOWN，不得写成 NOT_COLLECTED。**Upstream**: U03、V1-C03、§1.5、§2.2、§5 不变量 4、§7.7A
4. **Given** 一个成员 Person 的 age_band = UNDER_14 且无有效监护人同意版本，**When** 请求对该 Person 的后续个人信息处理（AI 交互、孩子端进入），**Then** 返回合规阻断，且不写入该处理的业务结果。**Upstream**: V1-C39、§5 不变量 27、§10、§19A.2
5. **Given** 同一 Person 之后补齐了有效监护人同意版本，**When** 再次请求同样的处理，**Then** 处理被允许，且记录的同意版本可追溯。**Upstream**: V1-C39、§7.7A
6. **Given** 家长撤回已记录的监护人同意，**When** 之后再次请求针对该未成年人的处理，**Then** 处理被阻断，撤回本身留痕（写入新 Consent version）。§29.5 中依赖传播的 Formulation / Plan / Memory / AI run 在本 Slice 尚不存在，不在本轮验收。**Upstream**: V1-C39、§29.5（最小子集）
7. **Given** 家庭 A 的成员身份，**When** 请求家庭 B 的家庭资料或成员资料，**Then** 应用层拒绝且不返回该家庭任何数据，数据库层在无 app.family_id 上下文时同样拒绝。**Upstream**: V1-C21、§9、§9.1
8. **Given** 一个不具备该家庭成员关系的 actor，**When** 请求该家庭的家庭资料、成员资料或成员变更，**Then** 服务端拒绝，且该限制由服务端判定而非前端隐藏。**Upstream**: §9、V1-C21
9. **Given** 客户端传入一个伪造的 family_id，**When** 调用家庭级读取，**Then** 该参数只作为待验证参数，不能因为 ID 存在就获得访问。**Upstream**: §9
10. **Given** 一个 Person 的 age_band = UNKNOWN，**When** 请求依赖年龄判定的处理，**Then** 系统不得按 ADULT 放行，必须显式要求补充或拒绝。**Upstream**: V1-C03、V1-C39
11. **Given** 同一个 Person 同时属于家庭 A 与家庭 B，**When** 在家庭 A 的上下文中读写，**Then** 只按该 Person 在 A 的 membership 判定：不因同时属于 B 而获得 A 之外的访问，也不因属于 B 而在 A 中被降权；两个 membership 相互独立。**Upstream**: §1.5、§7.1、§9、§9.1
12. **Given** 一个已属于某家庭的 Person，**When** 在同一家庭再次加入，**Then** 请求被拒绝且不产生第二条 membership。**Upstream**: §7.1、§5 不变量 17
13. **Given** 一个不是该 Family 创建者的家庭成员，**When** 请求新增成员或修改他人资料，**Then** 服务端拒绝，且该限制由服务端判定而非前端隐藏。**Upstream**: §1.5、§9
14. **Given** 一个 Account 已经绑定某个 Person，**When** 尝试把它绑定到第二个 Person，或给已绑定 Account 的 Person 再绑定第二个 Account，**Then** 约束失败，不产生新的绑定。**Upstream**: §1.5、§7.1

## Edge, Failure, and Unknown States

- **拒绝即失败**：跨家庭访问必须在应用层与数据库层都失败，且响应不携带目标对象的任何字段。正式文档只要求「跨家庭和无授权访问必须失败，属于硬阻断」（§37.2）与「不能因为 ID 存在就允许访问」（§9），未规定 NOT_FOUND 与 DENIED 是否对外一致；该对外语义见 Assumption A-2，不作为已批准需求。
- **UNDER_14 无有效监护同意 → BLOCKED**：阻断意味着后续处理不执行、不落业务结果，不是静默降级；但阻断不覆盖「为取得同意而建立 age_band / 监护关系 / 同意记录」这一步，否则同意永远无法补齐（推导依据：§10 要求「进入孩子端前」已能读取 Compliance Profile，V1-C39 的措辞是「不得继续对应处理」）。
- **age_band = UNKNOWN**：不得推断为 ADULT，也不得推断为未成年人；依赖年龄的处理必须显式拒绝或要求补充。UNKNOWN 是 §7.7A age_band 枚举内的合法值，NOT_COLLECTED / DECLINED / N/A / CONFLICTING / EXPIRED 属 §5 不变量 5 的通用真实状态，不是 age_band 的取值。
- **来源混用**：转述资料不得被当作本人确认；同一属性同时存在本人陈述与转述时保留两条来源而非覆盖。正式来源类型至少包含本人陈述 / 家长观察 / 家长转述 / 其他成员转述 / 手工录入设备数据 / 工作人员记录 / AI 假设 / 经确认信息（§2.2），不得压缩成「本人 vs 转述」二值。
- **重复成员**：同一 Person 在同一家庭重复加入不得产生第二条 membership（§7.1 要求唯一表达 (family, person)、§5 不变量 17）；具体冲突码属 plan 决定。
- **多 Family 上下文**：`app.family_id` 必须是当前请求的目标家庭，不得由 `app.person_id` 反推唯一家庭（§9.1）；同一 Person 的多个 membership 之间不共享上下文。
- **非法身份关系**：不具备该家庭 family relationship 的 actor 不得代记该家庭 Person；guardian 绑定必须指向真实存在的成年 Person（§19A.2 将 adult / guardian 作为同一分类，§7.7A 以 `guardian_person_id` 引用该 Person）。V1 当前只有创建该 Family 的 adult 具备成员管理权限（§1.5、§9）。
- **同意撤回后的处理**：撤回不回删历史记录，但阻断后续处理；本 Slice 只实现「新 Consent version + 后续访问与处理禁止 + audit」，§29.5 的依赖传播对象在此阶段不存在。
- **无 RLS 上下文**：默认拒绝而不是放行；缺少 app.family_id 的查询不得返回跨家庭行。
- **运行账号越权**：运行角色不得是 table owner，不得 BYPASSRLS。
- **并发/重试**：同一创建请求并发或重试只产生一个业务结果。

## Requirements

- **FR-001** [UPSTREAM: V1-C20 / §5 不变量 1] 系统 MUST 将 Account、Person、Family、成员关系作为彼此独立的对象；不得用单一「用户」记录代替四类边界。
- **FR-002** [UPSTREAM: U01 / §1.1 / §28.1] 系统 MUST 支持家长（adult）通过微信登录建立 Account，并能取回当前登录者身份及其关联 Person。
- **FR-003** [UPSTREAM: U03 / §2.2 / §5 不变量 4] 系统 MUST 记录并区分 Person 资料的正式来源类型，至少覆盖本人陈述 / 家长观察 / 家长转述 / 其他成员转述；MUST NOT 压缩为「本人 vs 转述」二值；转述 MUST NOT 升级为本人确认。
- **FR-004** [UPSTREAM: U03] 系统 MUST 允许存在不关联任何 Account 的 Person（无孩子账号）；此类 Person 的资料只能来自他方转述或观察，不得标记为本人陈述。
- **FR-005** [UPSTREAM: §1.5 / §28.1 / §9 / §7.7A] 系统 MUST 允许家长创建 Family，创建者在其后属于该 Family 并成为 V1 当前的管理主体；MUST NOT 由「创建家庭」推导出创建者是任何未成年人的 guardian——guardian 关系 MUST 由该未成年 Person 的 compliance profile 单独表达。
- **FR-006** [UPSTREAM: §9 / §7.1 / §7.7A / §10] 系统 MUST 把「家庭关系」（membership）、「Case 参与关系」、「Compliance 监护关系」作为 `authorize()` 的三类独立输入；MUST NOT 把它们压成单一角色字段。§7.1 明确 V1 不引入 guardian / non-guardian 角色枚举、通用角色 DSL 与 RBAC，本 Slice MUST NOT 自行发明成员角色。
- **FR-007** [UPSTREAM: V1-C39 / §7.7A] 系统 MUST 在服务端保存每个 Person 的 age_band（ADULT / MINOR_14_17 / UNDER_14 / UNKNOWN）、未成年人模式、guardian 引用与监护人同意版本，并能追溯其来源。
- **FR-008** [UPSTREAM: V1-C39 / §5 不变量 27 / §10] age_band = UNDER_14 且无有效监护人同意时，系统 MUST 阻断对该 Person 的后续个人信息处理（至少包含 AI 交互、孩子端进入及依赖该 Person 的派生内容生成）；MUST NOT 阻断为取得该同意而必须建立 age_band / guardian 引用 / 同意记录的操作。
- **FR-009** [UPSTREAM: V1-C03 / §7.7A] age_band = UNKNOWN 时系统 MUST NOT 按 ADULT 处理；依赖年龄的处理 MUST 显式拒绝或要求补充。MUST NOT 把 NOT_COLLECTED / DECLINED / N/A / CONFLICTING / EXPIRED 写成 age_band 的取值。
- **FR-010** [UPSTREAM: V1-C39 / §29.5] 监护人同意 MUST 可撤回；撤回 MUST 产生新 Consent version 并留痕，撤回后后续处理 MUST 被阻断；本 Slice 不要求实现 §29.5 中依赖对象（Formulation / Plan / Memory / AI run）的传播，因为它们在此时尚不存在。
- **FR-011** [UPSTREAM: V1-C21 / §9] 所有家庭级读写 MUST 经同一授权判定入口，判定 MUST 同时考虑当前身份、家庭关系、可见范围与用途；授权 MUST 基于 actor 在当前目标 Family 的 membership，MUST NOT 由 Person 推导出唯一家庭；客户端传入的 family_id / person_id MUST 只作待验证参数。
- **FR-012** [UPSTREAM: V1-C21 / §9.1] 家庭数据表 MUST 启用并强制 RLS；运行账号 MUST NOT 为 table owner、MUST NOT 具备 BYPASSRLS；无上下文时 MUST 默认拒绝。
- **FR-013** [UPSTREAM: §9.1] 家庭级读写 MUST 在同一事务内设置 app.family_id / app.person_id / app.purpose 上下文后执行；app.family_id MUST 是当前请求的目标家庭，MUST NOT 由 app.person_id 反推；MUST NOT 在事务外设置再从连接池查询。
- **FR-014** [UPSTREAM: §5 不变量 17 / §8.5] 关键命令（建家庭、加成员、记同意）重复提交、重试与并发 MUST NOT 产生重复家庭、重复成员关系或重复同意记录；同 idempotency key 不同 payload MUST 返回 409。§8.5 只把这个合同给「关键命令」，本 Slice MUST NOT 把它泛化为全部读操作或全部请求。
- **FR-015** [UPSTREAM: §7.0] 主键 MUST 使用 uuidv7() 基线；结构变更 MUST 只经 reviewed migration file 进入环境，MUST NOT 以 drizzle-kit push 作为变更流程。
- **FR-016** [UPSTREAM: §1.5 / §7.1] Account ↔ Person MUST 为 1 : 1（一个 Account 只对应一个 Person），Person → Account MUST 为 0..1（可无 Account，最多一个）；数据库约束 MUST 阻止「一个 Account 对应多个 Person」与「一个 Person 绑定多个 Account」。
- **FR-017** [UPSTREAM: §1.5 / §7.1] Person ↔ Family MUST 为多对多，只经 `family_members` 表达；MUST NOT 在 `persons` 上使用 `family_id` 之类的单家庭绑定；`family_members` MUST 唯一表达 (family, person)，同一 Person 在同一 Family 不得有重复 membership。

No requirement may be invented to make implementation easier.

## Key Entities

本 Slice 涉及的实体以 `Docs/V1技术设计.md` §7.1 与 §7.7A 已批准的表为准，本文不新增实体、不定义列级 schema（列级设计属 plan 阶段）：

- `accounts` — 登录身份。列级 schema 上游未给出（§7.1 只有表名）；一个 Account 只对应一个 Person（§7.1）。
- `persons` — 人物；可存在不关联 Account 的 Person（U03「无孩子账号」）。一个 Person 最多绑定一个 Account（§1.5、§7.1）；MUST NOT 携带 `family_id` 之类的单家庭绑定（§7.1）。
- `families` — 家庭容器；创建该 Family 的 adult Account / Person 是 V1 当前管理主体（§9）。
- `family_members` — Person 与 Family 的成员关系，多对多；唯一表达 (family, person)，同一 Person 可属于多个 Family（§7.1）。不含角色列：V1 不引入角色枚举与 RBAC（§7.1）。
- `consent_records` — 仅监护人对其所代表未成年人这一部分。
- `person_compliance_profiles` — age_band / minor_mode / guardian_person_id（单值引用，§7.7A）/ guardian_consent_version / verified_source / effective_at。

`case_participants` 与 `staff_assignments` 同属 §7.1 表组但不在本 Slice（见 Out of Scope）。

## Success Criteria

- **SC-001**: 一位家长可以从登录开始，独立完成「建立家庭 + 记录一个无账号成员」，且全过程无需孩子注册。
- **SC-002**: 任何跨家庭读取在应用层与数据库层都失败；无 RLS 上下文的查询返回零行而不是全量。
- **SC-003**: UNDER_14 且无有效监护人同意的 Person，其后续个人信息处理一律返回阻断且不产生业务写入；同时，记录 age_band 与同意版本这两步仍可完成，否则门禁无法被满足。
- **SC-004**: 未知属性在存储与返回中保持其真实状态，不出现被补成的默认值；age_band 的未知只能表达为 UNKNOWN，不得用 NOT_COLLECTED 等通用状态顶替。
- **SC-005**: 关键命令（建家庭 / 加成员 / 记同意）重复提交不产生第二条记录。
- **SC-006**: 同一个 Person 可同时在两个 Family 拥有独立 membership；在同一 Family 重复加入不产生第二条记录；`persons` 上不存在单家庭绑定列。
- **SC-007**: 一个 Account 无法关联到第二个 Person，一个 Person 也无法绑定第二个 Account。

## Acceptance Evidence

| Acceptance item | Verification type | Required evidence |
|---|---|---|
| 登录→身份→建家庭→成员关系（场景 1、2） | integration | 集成测试通过输出；覆盖成功与重复提交两条路径 |
| 无账号成员与来源类型（场景 3） | unit + integration | 单元测试断言来源类型不被压缩成二值、未知状态不被补值；集成测试断言 Person 落库后 account 为空 |
| 未成年人同意门禁（场景 4、5、6） | integration | 同意缺失 BLOCK、同意有效通过、撤回后阻断三组断言；另断言记录 age_band / 同意版本本身不被门禁阻断 |
| 跨家庭隔离（场景 7、9） | integration + database | 应用层拒绝断言 + 以运行角色直连查询的 RLS 拒绝断言（含无上下文返回零行） |
| 无家庭关系越权（场景 8、13） | integration | 越权请求返回拒绝的服务端证据，且不依赖前端隐藏；非创建者成员的成员管理请求同样被拒绝 |
| 多 Family 独立 membership（场景 11、12、SC-006） | integration + database | 同一 Person 在两个 Family 的记录可同时存在；同 Family 重复加入被拒；`persons` 上无单家庭绑定列的结构断言 |
| Account ↔ Person 1:1（场景 14、SC-007） | database verification | 唯一约束/外键的实际拒绝输出：同一 Account 绑定第二个 Person 失败，同一 Person 绑定第二个 Account 失败 |
| age_band = UNKNOWN 不被推断（场景 10） | unit | 断言未知年龄不进入依赖年龄的放行分支 |
| 幂等（SC-005） | integration | 并发/重试后记录数不变的断言 |
| Migration 与 RLS 状态（FR-012、FR-015） | database verification | migration 应用后 pg_class.relrowsecurity = true、relforcerowsecurity = true、运行角色非 owner 且 rolbypassrls = false 的查询输出 |
| uuidv7 主键基线（FR-015） | database verification | 建表后默认值检查输出 |

## Assumptions and Open Questions

### Assumptions

**已由文档推导，非新增语义**

- 本 Slice 记录未成年人 Person 属于「个人信息处理」，因此触发 V1-C39 与 §5 不变量 27 的门禁，而不是留到 Compliance 阶段。
- 监护人同意在本 Slice 只覆盖「监护人对其所代表的未成年人」，不扩展到 §28.2 的完整 purpose/scope 同意矩阵。
- V1 家庭主端是现有微信小程序（V1-C36），本 Slice 只交付服务端能力，不交付页面。
- **A-3（推导，非明文）** UNDER_14 门禁只阻断「后续」处理：§10 的流程要求「进入孩子端前」已经能读到 Compliance Profile，V1-C39 的措辞是「不得继续对应处理」，§19A.2 要求在「孩子进入 AI 交互前重新检查」——三者共同要求 age_band / guardian / 同意版本先于 AI 交互存在，因此建立这三项记录本身不可能被同一门禁阻断，否则同意永远无法补齐。若 Owner 认为「记录未成年人 Person 本身」也必须先有同意，则 onboarding 顺序需上游改文档。

**无上游明文，本轮显式标注（不得当成已批准需求）**

- **A-2 NOT_FOUND 与 DENIED 的对外表现**：正式文档只要求「跨家庭和无授权访问必须失败，属于硬阻断」（§37.2）与「不能因为 ID 存在就允许访问」（§9），没有规定二者是否必须对外一致。本 Slice 只断言「拒绝且不携带目标对象字段」，是否用统一 404 掩盖存在性留待 Owner 决定，不作为 FR。
- **A-4 幂等适用范围**：§8.5 把 idempotency key 合同限定在「关键命令」。本 Slice 把「建家庭 / 加成员 / 记同意」视为关键命令属判断，不是文档枚举；不得据此要求全部读操作或全部请求都带幂等键。

> 原 A-1（Account ↔ Person 基数）已由 `Docs/V1产品需求.md` §1.5 与 `Docs/V1技术设计.md` §7.1 正式明确，不再是假设，已升为 FR-016。

### Open Questions

**本轮裁决结果（详见 Clarifications）**

| # | 问题 | 状态 | 结论 | 正式依据 |
|---|---|---|---|---|
| 1 | Participant 是否在本 Slice 内交付 | RESOLVED — DEFER TO CASE SLICE | `case_participants` 不进入 Slice 1；不为保留标题引入最小 `cases`；本 Slice 只建其未来成立所需的前置 | §10、§28.8、§7.2、§38 |
| 2 | 一个 Person 是否可属于多个 Family | RESOLVED | 多对多，只经 `family_members`；同 Person 可跨 Family，同 Family 内不重复；`persons` 不得单家庭绑定 | 产品需求 §1.5、技术设计 §7.1 |
| 3 | guardian 如何建模 | RESOLVED | 监护关系是「成年 Person ↔ 未成年 Person」的关系，落在 compliance profile 的 `guardian_person_id`，与 membership 独立；授权用家庭关系 + Consent + Purpose，合规用 guardian 引用 | §7.7A、§10、V1-C39、§9、§5 不变量 28 |
| 3b | 成员是否带授权属性 / 是否允许多监护人 | RESOLVED + RESOLVED — DEFER MULTI-GUARDIAN | 不建 family role enum / RBAC，创建 Family 的 adult 为管理主体，其他成员无默认成员管理权限；V1 单 guardian reference，多 guardian 后置 | 产品需求 §1.5、技术设计 §7.1 / §7.7A / §9 |
| 4 | 同一家庭内非 guardian 成员的默认可见范围 | DEFERRED | 本 Slice 只落 §9 最小判定，不建 visibility matrix；未来业务资源留给对应 Slice | §10（仅 Case/内容对象）、§18.2、总体技术架构 §3.1（V3 才扩展多成员） |

**本轮处理的「伪明确」（原文看似有依据，实为投影或推导）**

| 原表述 | 问题 | 本轮处理 | 依据 |
|---|---|---|---|
| guardian / non-guardian 两级参与身份（原 FR-006） | 当时上游没有成员角色枚举；`family_members` 只有表名 | 改为「家庭关系 / Case 参与关系 / 监护关系」三类独立输入；§7.1 现已明确不引入角色枚举与 RBAC | §7.1、§9、产品需求 §1.5 |
| 来源 = 本人 / 监护人转述（原 FR-003、场景 3） | 正式来源类型至少 8 类，含家长观察、其他成员转述、设备数据、工作人员、AI 假设 | 改为「至少覆盖本人陈述 / 家长观察 / 家长转述 / 其他成员转述」，禁止压成二值 | 产品需求 §2.2 |
| persons 可关联 0..1 Account | 曾因基数未写回而降级为假设 | 上游已写回：Account ↔ Person 1:1、Person → Account 0..1，升为 FR-016 | 产品需求 §1.5、技术设计 §7.1 |
| 未提供属性保持 UNKNOWN / NOT_COLLECTED | age_band 枚举只有 4 值，不含 NOT_COLLECTED | 明确 UNKNOWN 属 age_band 取值，其余通用状态不得顶替 | §7.7A、§5 不变量 5 |
| UNDER_14「任何个人信息处理」一律阻断（场景 4、SC-003） | 与「必须先能记录同意」冲突，且未列具体操作 | 收窄为阻断后续处理（AI 交互、孩子端进入、派生内容），豁免建立合规基线本身 | §10、V1-C39、§19A.2（见 A-3） |
| Consent 撤回后处理被阻断（场景 6） | §29.5 的传播对象在本 Slice 不存在 | 明确只实现新版本 + 后续禁止 + audit，不宣称完整传播 | §29.5 |
| 非 guardian 不得新增成员（场景 8、Edge） | 当时无角色概念，规则无主语 | 改为「无该家庭 family relationship 的 actor 不得新增」；§9 现已明确管理主体为创建 Family 的 adult，成员管理权限升为场景 13 | §9、§1.5、V1-C21 |
| NOT_FOUND 与 DENIED 对外一致（场景 7、Edge） | 正式技术设计未规定 | 只断言「拒绝且不泄露数据」，对外语义降为 Assumption A-2 | §37.2、§9 |
| 创建 Family 后创建者成为 guardian（原 FR-005、场景 2、US1） | 上游只说家长发起；guardian 是 per-minor 引用 | 改为「创建者属于该家庭」，guardian 由 compliance profile 单独表达 | §28.1、§7.7A |
| 幂等适用于全部操作（原 Scope 8） | §8.5 只给「关键命令」 | 限定为关键命令，并保留「同 key 不同 payload → 409」 | §8.5 |
