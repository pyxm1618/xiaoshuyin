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
| §5 领域不变量 1 | `Docs/V1技术设计.md` | Account、Person、Family、CaseParticipant 分开建模 |
| §5 领域不变量 4 | `Docs/V1技术设计.md` | 监护人转述不得自动升级为本人事实/确认 |
| §5 领域不变量 5 | `Docs/V1技术设计.md` | 真实未知状态不得被补成确定值 |
| §5 领域不变量 27 | `Docs/V1技术设计.md` | 不满 14 周岁个人信息处理无有效监护人同意时必须 BLOCK |
| §7.0 | `Docs/V1技术设计.md` | 主键 `uuidv7()` 基线；migration 只经 reviewed migration file 进入环境 |
| §7.1 | `Docs/V1技术设计.md` | 身份与授权表：accounts / persons / families / family_members / consent_records |
| §7.7A | `Docs/V1技术设计.md` | `person_compliance_profiles` 的 age_band、minor_mode、guardian、guardian_consent_version、verified_source |
| §9 | `Docs/V1技术设计.md` | 统一 `authorize()` 的判定输入；客户端 `family_id` 仅为待验证参数 |
| §9.1 | `Docs/V1技术设计.md` | RLS 作为家庭隔离第二道防线；迁移角色与运行角色分离；`withRlsTransaction` |
| §28.1 | `Docs/V1技术设计.md` | 身份与家庭 API 契约面（auth / me / families / members） |
| §28.2 | `Docs/V1技术设计.md` | 监护人同意记录入口（仅 guardian-consent 部分） |
| §38 Phase 1 | `Docs/V1技术设计.md` | 本 Slice 属于 Phase 1「Account / Person / Family / Participant」基础域的第一刀 |

**Blocking rule**: If required behavior cannot be traced to an approved source, mark it `NEEDS UPSTREAM DECISION` and do not implement it.

**范围裁剪说明（为什么本 Slice 不含 Participant）**：`Docs/V1技术设计.md` §7.1 将 `case_participants` 与 `cases` 分列于各自表组，§10 明确「孩子参与采用有限 Case Participant」，§28.8 的参与端点全部挂在 `/cases/:id/...` 之下。也就是说 Participant 在正式文档中是 **Case 作用域对象**，没有 `cases` 就不存在合法的 participant 记录。而 `cases` 会立即带入 Case Status / Phase 契约（§6.1—6.7、§8.1「一个家庭最多一个当前主要未结 Case」），属于本 Slice 明确排除的范围。因此本 Slice 交付 Participant 成立所依赖的**前置条件**：Person、家庭成员关系（§9 的「家庭关系」判定输入）与服务端可见范围判定；`case_participants` 与其邀请流程留给 Case 切片。此裁剪属切片边界决定，已列入 Open Questions 供复核。

## Scope

### In Scope

1. **Account 与登录身份**：监护人通过微信登录建立 Account，并能取回「当前登录者是谁」及其关联 Person。
2. **Person**：本人建立的 Person；监护人代记的家庭成员 Person；Person 可以不关联任何 Account（无孩子账号）。
3. **资料来源区分**：本人（SELF）与监护人转述（RELAYED）必须可区分并可追溯，转述不得升级为本人确认。
4. **Family 与成员关系**：监护人创建 Family 并成为其 guardian 成员；成员分 guardian 与非 guardian 两类参与身份（§9「家庭关系」判定输入的最小子集）。
5. **未成年人合规最小门禁**：服务端保存 age_band（ADULT / MINOR_14_17 / UNDER_14 / UNKNOWN）、未成年人模式、监护关系、监护人同意版本；UNDER_14 且无有效监护人同意时，对该 Person 的个人信息处理 BLOCK。
6. **统一授权判定**：所有家庭级读写经单一授权判定入口，输入当前身份、家庭关系、可见范围、用途；客户端 family_id / person_id 只作为待验证参数。
7. **家庭隔离双层防线**：应用层授权判定 + 数据库 RLS（ENABLE + FORCE），运行账号非 table owner 且 NOBYPASSRLS，无上下文默认拒绝。
8. **幂等与真实失败状态**：重复提交不产生重复家庭/重复成员；不存在、无权、越权、冲突、未知状态均返回真实结果。

### Out of Scope

- `cases` 及 Case Status / Phase 状态机、`case_events`（§6、§8.1）。
- `case_participants`、参与邀请、孩子端参与流程（§10、§28.8）——见上方范围裁剪说明。
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

- 不追求家庭成员的多家庭归属、跨家庭复用或家庭合并语义（文档未定义）。
- 不为「以后可能扩展」预先设计通用权限 DSL 或通用主体模型。
- 不把家庭主端页面、交互稿、文案作为本 Slice 交付物。
- 不优化性能基线、容量或成本；只要求确定性正确与可验证隔离。

## User Scenarios & Testing

### User Story 1 — 家长登录并成为家庭监护人 (Priority: P1)

一位家长用微信登录，系统建立 Account 与对应 Person，家长创建自己的 Family 并成为该家庭的 guardian 成员。

**Upstream IDs**: U01、U03、V1-C20、§28.1

**Independent Test**: 仅用登录 + 建家庭两个动作即可完成；断言登录后能取回自身身份、建家庭后该家庭存在且当前 Person 是其 guardian 成员。

### User Story 2 — 记录暂无账号的家庭成员 (Priority: P1)

家长为尚未注册的孩子/配偶建立 Person 记录，来源标记为转述；该 Person 没有 Account，且未知属性保持未知。

**Upstream IDs**: U03、V1-C03、§5 不变量 1 / 4 / 5

**Independent Test**: 建立一个无 Account 的 Person 后，断言其来源为转述、其未知属性不被补值、且系统不把它当作本人确认的资料。

### User Story 3 — 未成年成员必须先有监护人同意 (Priority: P1)

家长录入的孩子被判为不满 14 周岁时，在缺少有效监护人同意的情况下，系统阻断对该 Person 的个人信息处理；同意补齐后才允许。

**Upstream IDs**: V1-C39、§5 不变量 27、§7.7A、§28.2

**Independent Test**: 同一 Person 在同意缺失与同意有效两种状态下分别调用受门禁保护的处理，断言前者 BLOCK、后者通过。

### User Story 4 — 跨家庭访问必须失败 (Priority: P1)

已登录账号尝试读取不属于自己的家庭/成员资料时，应用层判定与数据库层都拒绝。

**Upstream IDs**: V1-C21、§9、§9.1

**Independent Test**: 用家庭 A 的身份访问家庭 B 的成员资料，断言返回无权且未泄露对象是否存在；再绕过应用层直接以运行角色查询，断言 RLS 同样阻止。

## Acceptance Scenarios

1. **Given** 一个已微信登录的家长账号，**When** 请求当前身份，**Then** 返回其 Account 与关联 Person（若已建立），且不返回其他家庭成员资料。**Upstream**: U01、§28.1
2. **Given** 一位家长，**When** 创建家庭，**Then** 家庭被创建且该家长的 Person 成为该家庭的 guardian 成员；同一请求重复提交不产生第二个家庭或第二个成员关系。**Upstream**: U03、V1-C20、§5 不变量 17
3. **Given** 一位 guardian 家庭成员，**When** 为其家庭新增一个没有账号的成员并标记来源为转述，**Then** 该 Person 被创建、account 为空、来源为转述，未提供的属性保持 UNKNOWN / NOT_COLLECTED 而不是被填默认值。**Upstream**: U03、V1-C03、§5 不变量 4
4. **Given** 一个成员 Person 的 age_band = UNDER_14 且无有效监护人同意版本，**When** 任何针对该 Person 的个人信息处理被请求，**Then** 返回合规阻断，且不写入该处理的业务结果。**Upstream**: V1-C39、§5 不变量 27
5. **Given** 同一 Person 之后补齐了有效监护人同意版本，**When** 再次请求同样的处理，**Then** 处理被允许，且记录的同意版本可追溯。**Upstream**: V1-C39、§7.7A
6. **Given** 家长撤回已记录的监护人同意，**When** 之后再次请求针对该未成年人的处理，**Then** 处理被阻断，撤回本身留痕。**Upstream**: V1-C39、§5 不变量 15（最小子集）
7. **Given** 家庭 A 的成员身份，**When** 请求家庭 B 的家庭资料或成员资料，**Then** 应用层返回无权/不存在且不区分二者，数据库层在无 app.family_id 上下文时同样拒绝。**Upstream**: V1-C21、§9、§9.1
8. **Given** 一个非 guardian 成员，**When** 尝试为该家庭新增成员或修改他人资料，**Then** 被拒绝，且该限制由服务端判定而非前端隐藏。**Upstream**: §9、V1-C21
9. **Given** 客户端传入一个伪造的 family_id，**When** 调用家庭级读取，**Then** 该参数只作为待验证参数，不能因为 ID 存在就获得访问。**Upstream**: §9
10. **Given** 一个 Person 的 age_band = UNKNOWN，**When** 请求依赖年龄判定的处理，**Then** 系统不得按 ADULT 放行，必须显式要求补充或拒绝。**Upstream**: V1-C03、V1-C39

## Edge, Failure, and Unknown States

- **NOT_FOUND 与 DENIED 不泄露存在性**：无权访问与对象不存在对外表现一致，避免跨家庭探测。
- **UNDER_14 无有效监护同意 → BLOCKED**：阻断意味着对应处理不执行、不落业务结果，不是静默降级。
- **age_band = UNKNOWN**：不得推断为 ADULT，也不得推断为未成年人；依赖年龄的处理必须显式拒绝或要求补充。
- **来源混用**：转述资料不得被当作本人确认；同一属性同时存在本人陈述与转述时保留两条来源而非覆盖。
- **重复成员**：同一 Person 在同一家庭重复加入必须返回冲突，不产生重复成员关系。
- **非法身份关系**：非 guardian 成员代记他人 Person、或把非家庭成员作为监护人绑定，必须被拒绝。
- **同意撤回后的处理**：撤回不回删历史记录，但阻断后续处理。
- **无 RLS 上下文**：默认拒绝而不是放行；缺少 app.family_id 的查询不得返回跨家庭行。
- **运行账号越权**：运行角色不得是 table owner，不得 BYPASSRLS。
- **并发/重试**：同一创建请求并发或重试只产生一个业务结果。

## Requirements

- **FR-001** [UPSTREAM: V1-C20 / §5 不变量 1] 系统 MUST 将 Account、Person、Family、成员关系作为彼此独立的对象；不得用单一「用户」记录代替四类边界。
- **FR-002** [UPSTREAM: U01 / §28.1] 系统 MUST 支持监护人通过微信登录建立 Account，并能取回当前登录者身份及其关联 Person。
- **FR-003** [UPSTREAM: U03 / §5 不变量 4] 系统 MUST 区分 Person 资料的来源（本人 / 监护人转述）并可追溯；转述 MUST NOT 升级为本人确认。
- **FR-004** [UPSTREAM: U03] 系统 MUST 允许存在不关联任何 Account 的 Person（无孩子账号），此类 Person 的资料只能来自转述。
- **FR-005** [UPSTREAM: U03 / V1-C20] 系统 MUST 允许 guardian 创建 Family，且创建者 MUST 成为该家庭的 guardian 成员。
- **FR-006** [UPSTREAM: §9] 系统 MUST 在成员关系上区分 guardian 与非 guardian 两类参与身份，作为授权判定中的「家庭关系」输入。
- **FR-007** [UPSTREAM: V1-C39 / §7.7A] 系统 MUST 在服务端保存每个 Person 的 age_band、未成年人模式、监护关系与监护人同意版本，并能追溯其来源。
- **FR-008** [UPSTREAM: V1-C39 / §5 不变量 27] age_band = UNDER_14 且无有效监护人同意时，系统 MUST 阻断针对该 Person 的个人信息处理。
- **FR-009** [UPSTREAM: V1-C03] age_band = UNKNOWN 时系统 MUST NOT 按 ADULT 处理；依赖年龄的处理 MUST 显式拒绝或要求补充。
- **FR-010** [UPSTREAM: V1-C39] 监护人同意 MUST 可撤回；撤回后后续处理 MUST 被阻断，且撤回事件 MUST 留痕。
- **FR-011** [UPSTREAM: V1-C21 / §9] 所有家庭级读写 MUST 经同一授权判定入口，判定 MUST 同时考虑当前身份、家庭关系、可见范围与用途；客户端传入的 family_id / person_id MUST 只作待验证参数。
- **FR-012** [UPSTREAM: V1-C21 / §9.1] 家庭数据表 MUST 启用并强制 RLS；运行账号 MUST NOT 为 table owner、MUST NOT 具备 BYPASSRLS；无上下文时 MUST 默认拒绝。
- **FR-013** [UPSTREAM: §9.1] 家庭级读写 MUST 在同一事务内设置 app.family_id / app.person_id / app.purpose 上下文后执行；MUST NOT 在事务外设置再从连接池查询。
- **FR-014** [UPSTREAM: §5 不变量 17] 重复提交、重试与并发 MUST NOT 产生重复家庭、重复成员关系或重复同意记录。
- **FR-015** [UPSTREAM: §7.0] 主键 MUST 使用 uuidv7() 基线；结构变更 MUST 只经 reviewed migration file 进入环境，MUST NOT 以 drizzle-kit push 作为变更流程。

No requirement may be invented to make implementation easier.

## Key Entities

本 Slice 涉及的实体以 `Docs/V1技术设计.md` §7.1 与 §7.7A 已批准的表为准，本文不新增实体、不定义列级 schema（列级设计属 plan 阶段）：

- `accounts` — 登录身份。
- `persons` — 人物；可关联 0..1 Account。
- `families` — 家庭容器。
- `family_members` — Person 与 Family 的成员关系（含 guardian / 非 guardian 参与身份）。
- `consent_records` — 仅监护人对其所代表未成年人这一部分。
- `person_compliance_profiles` — age_band / minor_mode / guardian_person_id / guardian_consent_version / verified_source。

`case_participants` 与 `staff_assignments` 同属 §7.1 表组但不在本 Slice（见 Out of Scope）。

## Success Criteria

- **SC-001**: 一位家长可以从登录开始，独立完成「建立家庭 + 记录一个无账号成员」，且全过程无需孩子注册。
- **SC-002**: 任何跨家庭读取在应用层与数据库层都失败；无 RLS 上下文的查询返回零行而不是全量。
- **SC-003**: UNDER_14 且无有效监护人同意的 Person，其个人信息处理一律返回阻断，且不产生业务写入。
- **SC-004**: 未知属性在存储与返回中保持 UNKNOWN / NOT_COLLECTED，不出现被补成的默认值。
- **SC-005**: 重复提交家庭创建/成员新增不产生第二条记录。

## Acceptance Evidence

| Acceptance item | Verification type | Required evidence |
|---|---|---|
| 登录→身份→建家庭→成员关系（场景 1、2） | integration | 集成测试通过输出；覆盖成功与重复提交两条路径 |
| 无账号成员与转述来源（场景 3） | unit + integration | 单元测试断言来源字段与未知状态；集成测试断言 Person 落库后 account 为空 |
| 未成年人同意门禁（场景 4、5、6） | integration | 同意缺失 BLOCK、同意有效通过、撤回后阻断三组断言 |
| 跨家庭隔离（场景 7、9） | integration + database | 应用层拒绝断言 + 以运行角色直连查询的 RLS 拒绝断言（含无上下文返回零行） |
| 非 guardian 越权（场景 8） | integration | 越权请求返回拒绝的服务端证据，且不依赖前端隐藏 |
| age_band = UNKNOWN 不被推断（场景 10） | unit | 断言未知年龄不进入依赖年龄的放行分支 |
| 幂等（SC-005） | integration | 并发/重试后记录数不变的断言 |
| Migration 与 RLS 状态（FR-012、FR-015） | database verification | migration 应用后 pg_class.relrowsecurity = true、relforcerowsecurity = true、运行角色非 owner 且 rolbypassrls = false 的查询输出 |
| uuidv7 主键基线（FR-015） | database verification | 建表后默认值检查输出 |

## Assumptions and Open Questions

### Assumptions（文档已允许，非新增语义）

- 本 Slice 记录未成年人 Person 属于「个人信息处理」，因此触发 V1-C39 与 §5 不变量 27 的门禁，而不是留到 Compliance 阶段。
- 监护人同意在本 Slice 只覆盖「监护人对其所代表的未成年人」，不扩展到 §28.2 的完整 purpose/scope 同意矩阵。
- V1 家庭主端是现有微信小程序（V1-C36），本 Slice 只交付服务端能力，不交付页面。

### Open Questions

1. **切片边界：Participant 是否应在本 Slice 内交付** — 需要确认上方「范围裁剪说明」的结论（`case_participants` 依赖 `cases`，故延后）。若要求本 Slice 内出现真实 participant 记录，必须先批准引入最小 `cases` 锚点，这会同时引入 Case Status / Phase 契约，超出本 Slice 声明的 Out of Scope。
2. **一个 Person 是否可属于多个 Family** — `Docs/V1技术设计.md` §7.1 只给出表名，未定义基数；本 spec 未对此作出断言。若允许，`family_members` 的唯一性与 RLS 判定会不同。
3. **guardian 与非 guardian 的判定依据** — 文档要求服务端保存「监护关系」（V1-C39）并使用「家庭关系」做授权输入（§9），但未规定监护关系是成员角色、独立关系表还是 compliance profile 上的引用；列级与枚举属 plan 阶段决定，spec 只约束可判定性与可追溯性。
4. **同一家庭内非 guardian 成员的默认可见范围** — §10 给出了孩子端「只读本人提交 / 明确共享片段 / 本人任务」的方向，但那些对象属于后续 Slice；本 Slice 对此只要求「可见范围显式判定」，具体默认值待 Case / 内容类对象落地时确定。
