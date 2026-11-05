# Feature Specification: Evidence Core（Statement / Observation / Fact / Hypothesis）

**Feature Directory**: `specs/003-evidence-core`  
**Created**: 2026-11-05  
**Status**: Draft  
**V1 Phase**: Phase 1 — Common Core 地基（`Docs/V1技术设计.md` §38）

> 本 Spec 是已批准 Xiaoshuyin 文档的下游实现投影，不得引入未获批准的产品语义。
>
> **Docs baseline**: `Docs/V1产品需求.md` **v3.3**、`Docs/V1技术设计.md` **v3.8**（2026-11-04）。
>
> **Slice 边界**: 本 Slice 只建立 Case 内“证据是什么、来自谁、什么时候发生、当前是否有效、是否冲突、能否被当作事实”的通用地基。它**不是** Digital Use Assessment、Problem Formulation、孩子参与、AI 提取、Scene routing 或长期 Memory 的替身。

## Upstream Traceability

| Upstream ID / Section | Source | What this slice projects |
|---|---|---|
| V1-C02 | `Docs/V1产品需求.md` §24 | Statement / Observation / Fact / Hypothesis、来源、时间、确认状态分离 |
| V1-C03 | `Docs/V1产品需求.md` §24 | UNKNOWN / NOT_COLLECTED / DECLINED / CONFLICT / N/A 等真实状态不得伪造成确定值 |
| V1-C21 | `Docs/V1产品需求.md` §18 / §24 | Evidence 的跨成员读取和使用仍受服务端 Authorization / Purpose 约束 |
| V1-C23 | `Docs/V1产品需求.md` §17 / §24 | 历史证据保留来源、时间、版本/有效性，不把旧信息无条件当作当前事实 |
| V1-C24 | `Docs/V1产品需求.md` §19 / §24 | AI 不能独立把 Statement / Hypothesis 升级为 Fact |
| V1-C30 | `Docs/V1产品需求.md` §24 | Evidence Core 属于可复用 Common Core，不硬编码 Digital Use 业务 |
| V1-X05 | `Docs/V1产品需求.md` §26 | 多来源冲突必须保留冲突，不由 AI 私自决定事实 |
| U05（部分） | `Docs/V1产品需求.md` §23 | 只承载“描述问题”的通用 Case message 入口；Digital Use Assessment 本身不在本 Slice |
| §5 不变量 3–5 | `Docs/V1技术设计.md` | Evidence 分层、转述不自动成为本人事实、UNKNOWN 等真实状态 |
| §7.2 | `Docs/V1技术设计.md` | `dialogue_messages` / `assertions` / `observations` 与 assertion 最小 provenance 字段 |
| §7.10 | `Docs/V1技术设计.md` | assertion / observation 是后续派生对象的依赖来源 |
| §9–§11 | `Docs/V1技术设计.md` | Authorization / Consent / Purpose / derived-context 边界 |
| §23 | `Docs/V1技术设计.md` | 模型只能 request / propose，不能代用户确认 |
| §27A | `Docs/V1技术设计.md` | API 使用 Zod / OpenAPI typed contract |
| §28.3 | `Docs/V1技术设计.md` | 批准的 `POST /api/v1/cases/:id/messages` 入口 |
| §32.3 | `Docs/V1技术设计.md` | Provenance 回归至少覆盖冲突、转述、更正、UNKNOWN、simulation 不污染事实 |

**Dependency note**: Slice 3 的实现阶段依赖 Slice 1 已合并的 Identity / Family / Consent / Authorization / RLS 基线，以及 Slice 2 已合并的 Case / Case RLS / Case ownership 基线。当前允许独立完成 Spec / Clarify / Plan / Checklist / Tasks / Analyze；未满足实现门禁前不得进入 Implement。

## Scope

### In Scope

1. **`dialogue_messages` 作为原始 Case 输入载体**：保存用户实际提交的 Case 内原始消息及服务端来源/时间信息，使后续结构化 Evidence 能追溯到原始输入。
2. **`assertions` 作为结构化断言载体**，且 `kind` 只表达已批准的：
   - `STATEMENT`
   - `FACT`
   - `HYPOTHESIS`
3. **`observations` 保持为独立 Evidence 类型**：不得为了简化 schema 把 Observation 塞入 `assertions.kind`。
4. **来源与主体分离**：至少能够区分“说的是谁 / 谁提供 / 来源类型 / 来源消息”。
5. **时间分离**：至少保存发生/观察时间与系统记录时间；二者不得互相覆盖。
6. **确认与事实等级分离**：Statement 不因为“听起来可信”自动成为 Fact；Hypothesis 不因为模型高置信自动成为 Fact。
7. **真实未知状态**：Evidence 收集结果必须能明确保留 UNKNOWN / NOT_COLLECTED / DECLINED / N/A / CONFLICT 等真实状态或等价的批准表达，不得用空值、0、false 或默认文本伪造确定答案。
8. **冲突保留**：两个来源互相矛盾时，两条来源均保留，并可形成同一 conflict group / 等价冲突关联；系统不得静默选一个赢家。
9. **有效性与历史**：Evidence 必须能表达当前有效区间、失效/被替代关系，并保留旧记录；不得通过原地覆盖删除历史语义。
10. **更正最小地基**：本 Slice 只建立 `supersedes` / validity / conflict 等后续更正传播所需的证据层基础；不实现 Problem Formulation / Plan / Memory 的完整传播。
11. **Case 级隔离**：所有 Evidence 必须归属于一个已验证 Case / Family，复用 Slice 1/2 的服务端 Authorization + RLS 双层边界。
12. **Purpose 边界**：Evidence 读取/写入不得靠 Prompt 或前端隐藏决定权限；未知 Purpose 必须 fail closed。
13. **批准的 message 写入口**：交付 `POST /api/v1/cases/:id/messages` 的通用 Common Core 契约，用于保存原始 Case message；不得借此实现 Digital Use Assessment 或 Scene routing。
14. **内部 Evidence 写入合同**：为后续 Assessment / AI bounded extraction / Problem Formulation 提供确定性的 domain/repository contract，但本 Slice 不新增未经批准的通用 public Evidence CRUD API。
15. **可验证 Provenance**：必须能机械证明“家长转述 ≠ 孩子本人事实”“冲突保持冲突”“UNKNOWN 不被补值”“旧 Evidence 可被 supersede 但不消失”。
16. **Person reference 安全边界**：当 Evidence 的 `subject_person_id` / `source_person_id` 不为空时，服务端必须验证该 Person reference 对当前目标 Family / Case 是合法、可授权使用的；仅凭 Person UUID 存在不得构成合法引用。V1 当前不设计跨 Family sharing，因此不得让 Family A 的 Evidence 引用仅属于 Family B 的 Person。guardian relationship 本身不授予 Family access，也不构成例外；若不存在其它正式批准的跨成员使用依据，不得自动允许其作为当前 Family Evidence 的 source / subject reference。本 Slice 不绕过 Slice 1 已冻结的 Person / guardian consent / compliance 前置条件，也不得为了记录 Evidence 私自创建或引用尚未合法建立的 child Person。具体数据库约束、repository 查询与 authorization 实现方式留给 Plan。

### Out of Scope

- `case_participants`、孩子邀请、孩子登录后的有限 Case 权限、参与接受/拒绝流程（§10、§28.8）。
- Digital Use Assessment 本身、`POST /api/v1/cases/:id/assessments` 的场景问卷、A1001—A2010 节点或任何 A/010xx routing。
- Problem Formulation 的生成、present / confirm / dispute / correction API 和版本状态。
- Scene Node State / Scene Artifact / Digital Use package / Node Manifest。
- Goal、Intervention、Plan、Task、Checkin、Review、Outcome、Follow-up、Notification。
- Case Status / Phase 转换；本 Slice 不把 Case 从 INTAKE 推进到 ASSESSMENT 或 PROBLEM_FORMULATION。
- Safety State / SAFETY_HOLD / Referral。
- AI/RAG/Embedding/Rerank/Promptfoo/Decision/Response/Memory Extraction。
- Family Memory / Purpose-Bound Derived Context 的完整实现。
- 数据权利完整 UI / 导出 / 删除流程，以及 §29.6 的下游依赖传播。
- 员工后台、人工审核、专业知识库。
- 微信小程序 UI。
- 任意未经 §28 批准的 generic `/assertions` / `/observations` public CRUD endpoint。
- V2—V5 能力。

### Non-Goals

- 不把“Evidence Core”变成一套通用知识图谱或事件溯源平台。
- 不做 NLP 自动抽取平台，不接模型来“试运行” Statement → Fact。
- 不为了未来 AI 方便提前做 embedding、vector、全文检索或 semantic search。
- 不为未来 Participant 预造角色、visibility matrix 或共享 UI。
- 不把 `dialogue_messages` 当作事实表；消息是来源，事实等级由 Evidence 合同表达。
- 不把 `assertions` 变成一个万能 JSON 表来承载 Observation / Plan / Scene Artifact。
- 不提前实现 Problem Formulation，只提供其未来可以引用的真实 Evidence。
- 不修改 `Docs/**`、Slice 1/2 已冻结需求或 Phase 2 Digital Use canonical flow。

## User Scenarios & Testing

### User Story 1 — 家长描述问题，原始来源被真实保存 (Priority: P1)

作为当前 Family 的合法管理主体，我可以在已有 Case 中提交一条问题描述。系统保存原始 message，并明确记录该输入来自当前 actor，而不是直接把文本当作“客观事实”。

**Independent Test**: 向合法 Case 提交 message；断言保存 message 的 Case、actor/source、服务端 recorded_at；不存在自动 FACT 写入。

### User Story 2 — 家长关于孩子的陈述保持“家长陈述” (Priority: P1)

家长说“孩子每天玩六小时”时，系统必须先保存为“家长关于孩子的 Statement”及其来源，而不是孩子本人确认的事实。

**Independent Test**: 写入一条 subject=child、source=guardian 的 Statement；断言 source_person 与 subject_person 不相同仍合法，且 kind 保持 STATEMENT。

### User Story 3 — 多来源冲突保持冲突 (Priority: P1)

家长说“六小时”，另一个合法来源说“两小时”时，系统保留两条证据和冲突关联，不自动选择一个作为事实。

**Independent Test**: 两条不同来源 Evidence 进入同一 conflict group；断言两条都存在、来源独立、没有自动 FACT / winner。

### User Story 4 — 不知道就是不知道 (Priority: P1)

用户明确说“不知道”、拒绝回答或该问题不适用时，系统记录真实状态，不把它转成 0 / false / 空字符串 / “没有问题”。

**Independent Test**: 分别记录 UNKNOWN、NOT_COLLECTED、DECLINED、N/A；断言读取结果保持原状态且业务值不被补造。

### User Story 5 — 旧信息被更正但历史不消失 (Priority: P1)

后续出现更可靠的新信息时，系统可以记录新的 Evidence 并标识 supersedes / validity，而不是覆盖旧记录。

**Independent Test**: 建立旧 Evidence → 新 Evidence supersedes 旧 Evidence；断言旧记录仍可追溯，新旧有效性可区分。

### User Story 6 — 越权不能读取或写入其他 Family 的 Evidence (Priority: P1)

即使知道 Case ID，其他 Family 的 actor 也不能读取或向该 Case 写 Evidence。

**Independent Test**: 应用层请求被拒，数据库 app role 在错误 Family 上下文下 SELECT 0 rows / write denied。

## Acceptance Scenarios

1. **Given** 当前 Family 的合法 Case，**When** actor 提交 Case message，**Then** 原始 message 被保存且 source/actor/recorded time 可追溯；不自动创建 FACT。
2. **Given** guardian 代表孩子描述一个行为，**When** 写入结构化 Statement，**Then** `subject_person_id = child`、`source_person_id = guardian` 可同时存在，且记录仍是 STATEMENT。
3. **Given** 两个来源对同一事项给出冲突信息，**When** 两条 Evidence 被记录，**Then** 两条都保留并关联冲突，不存在隐式 winner。
4. **Given** Evidence 状态为 UNKNOWN / NOT_COLLECTED / DECLINED / N/A，**When** 保存和读取，**Then** 状态逐项保持，未被转为 0 / false / 空值的业务确定语义。
5. **Given** 一条 Hypothesis，**When** 没有明确、合法的升级依据，**Then** 系统不得把其 kind 原地改为 FACT，也不得生成等价 FACT 作为“默认确认”。
6. **Given** 一条旧 Evidence 后续被更正，**When** 新 Evidence supersedes 旧 Evidence，**Then** 旧记录仍存在，validity / supersession 可追溯。
7. **Given** Case 属于 Family B，**When** Family A actor 使用已知 Case ID 请求写入或访问，**Then** 应用层拒绝且 RLS 不返回 B 的 Evidence。
8. **Given** 一个 message / assertion / observation，**When** 读取其 provenance，**Then** 至少可追到 Case、subject、source kind、source person/message（适用时）、occurred/recorded time、confirmation/validity/conflict 信息。
9. **Given** 当前 Slice 的路由清单，**When** 枚举 API，**Then** 只增加批准的 `POST /api/v1/cases/:id/messages`；不存在 generic Evidence CRUD、assessment、problem-formulation、scene、participant 路由。
10. **Given** 当前 Slice 的 schema，**When** 做结构断言，**Then** `observations` 与 `assertions` 分开，`assertions.kind` 不含 OBSERVATION。
11. **Given** 一条 AI / automated extractor 提出的候选（未来调用方），**When** 没有用户/规则允许的确认动作，**Then** Evidence Core 只能保存为适当候选/HYPOTHESIS 或拒绝，不能自行确认成 FACT。
12. **Given** Slice 1/2 尚未合并 main，**When** 本 Slice 进入设计阶段，**Then** Spec/Plan/Tasks 可以完成；**When** 尝试进入 Implement，**Then** gate 必须 BLOCK。
13. **Given** Case 属于 Family A、Person B 只属于 Family B，且 actor 即使知道 Person B UUID，**When** 尝试将 `subject_person_id = Person B` 或 `source_person_id = Person B` 写入 Family A 的 Evidence，**Then** 写入必须失败、不产生 Evidence、不泄露 Person B 的敏感信息，且不得仅因 UUID 存在就视为合法引用；具体 HTTP/domain 错误码由后续 Plan 在已有错误语义下确定。

## Edge, Failure, and Unknown States

- **source_person 与 subject_person 不同**：合法，且必须保留真实来源；不得自动复制成 subject 本人声明。
- **source message 不存在**：若该 Evidence 类型声明依赖 message provenance，写入必须失败；不得静默置空后当作完整 provenance。
- **occurred_at 未知**：保持 UNKNOWN / 未知表达；不得用 recorded_at 伪装为事件发生时间。
- **recorded_at**：必须由服务端产生，不接受客户端伪造。
- **冲突未解决**：保持 CONFLICT / conflict group；不得因为“最新一条”覆盖冲突。
- **Evidence 已过期/失效**：历史仍保留，但不能无条件作为当前事实使用。
- **更正形成链**：不得出现 supersedes 自环或明显循环。
- **Case 不存在 / 跨 Family / actor 无资格**：不得泄漏其他 Family Evidence 内容或存在性细节。
- **UNKNOWN 等状态**：不是错误，也不是 null 的同义词；必须可被持久化和回读。
- **未来 AI caller**：模型输出不拥有最终事实确认权。
- **未来 Participant caller**：本 Slice 不推断其权限；未实现前不得为孩子端开放 Evidence API。

## Requirements

- **FR-001** [UPSTREAM: V1-C02 / §5 / §7.2] 系统 MUST 将 Statement、Observation、Fact、Hypothesis 保持为可区分的 Evidence 语义；Observation MUST NOT 被折叠进 `assertions.kind`。
- **FR-002** [UPSTREAM: V1-C02 / §7.2] `assertions.kind` MUST 仅表达 `STATEMENT | FACT | HYPOTHESIS`，并保留 source_kind、subject_person_id、source_person_id、source_message_id、occurred_at、recorded_at、valid_from、valid_until、confirmation_status、supersedes_id、conflict_group_id 的批准语义。
- **FR-003** [UPSTREAM: V1-C02 / V1-C23] Evidence MUST 区分发生/观察时间与记录时间；recorded time MUST 为服务端事实，缺失 occurred time 不得由 recorded time 代填。
- **FR-004** [UPSTREAM: V1-C02 / V1-X05] Evidence MUST 保留真实来源；guardian relay / observation 不得自动变成 child self statement。
- **FR-005** [UPSTREAM: V1-C03] Evidence 收集 MUST 能表达 UNKNOWN / NOT_COLLECTED / DECLINED / N/A / CONFLICT 或等价的批准真实状态，并 MUST NOT 通过默认值制造确定性。
- **FR-006** [UPSTREAM: V1-C02 / V1-X05 / §32.3] 冲突 Evidence MUST 同时保留来源与内容，并可关联同一 conflict group / 等价结构；系统 MUST NOT 自动选择 winner。
- **FR-007** [UPSTREAM: V1-C23 / §7.2] Evidence MUST 支持 validity 与 supersedes 历史；新记录 MUST NOT 原地覆盖删除旧记录的来源/时间/历史语义。
- **FR-008** [UPSTREAM: V1-C24 / §5 / §23] 系统 MUST NOT 因模型、规则置信度、来源数量或最新时间自动把 STATEMENT/HYPOTHESIS 升级成 FACT；任何正式 Fact 写入都必须经过确定性、可审计的合法路径。
- **FR-009** [UPSTREAM: U05 / §28.3] 系统 MUST 支持批准的 `POST /api/v1/cases/:id/messages` 入口保存当前 Case 原始用户 message；该端点 MUST NOT 自动实现 Digital Use Assessment、Scene routing 或 Problem Formulation。
- **FR-010** [UPSTREAM: V1-C21 / §9–§11] Evidence 的写入与读取 MUST 经过服务端 Authorization / Purpose 判断，不得依赖前端隐藏或 Prompt。
- **FR-011** [UPSTREAM: V1-C21 / §9.1] Evidence family isolation MUST 有 RLS 最后防线；错误 Family 上下文不能读取或写入另一 Family 的 Evidence。
- **FR-012** [UPSTREAM: V1-C30] Evidence domain contract MUST 保持 Scene-agnostic，不出现 Digital Use 节点编号、手机专属字段或 Scene-specific business rules。
- **FR-013** [UPSTREAM: §27A / §28.3] message endpoint MUST 使用 typed Zod/OpenAPI contract；未声明字段不得成为隐形业务输入。
- **FR-014** [UPSTREAM: §7.10 / V1-C22] 本 Slice MUST 只建立后续 correction propagation 所需的 Evidence 依赖基础；MUST NOT 宣称已完成 Problem Formulation / Plan / Memory 的传播。
- **FR-015** [UPSTREAM: §28.3 / Slice boundary] 本 Slice MUST NOT 新增 generic public `/assertions` / `/observations` CRUD、assessment、problem-formulation、scene、participant、AI endpoint。
- **FR-016** [UPSTREAM: §5 / §32.3] provenance 回归 MUST 至少证明：guardian relay 不等于 child statement、冲突不被消解、UNKNOWN 不补值、superseded 记录仍存在。
- **FR-017** [UPSTREAM: V1-C27 / V1-C28] message / Evidence 写入失败 MUST 保持真实失败并保证业务事务原子性；重试不得生成重复业务结果。具体幂等 scope / key 由 Plan 复用既有 shared idempotency contract，不在 Spec 发明第二套机制。
- **FR-018** [UPSTREAM: V1-C20 / V1-C21] 当前 Slice 不开放 Participant Evidence 权限；只有已批准的现有 actor path 可进入，未来孩子端权限由 Participant Slice 明确设计。
- **FR-019** [UPSTREAM: §7.2 / §32.3] `dialogue_messages` MUST 是 Evidence 来源而不是 Fact 真相源；删除/修改 message 不得通过“直接改文本”静默重写已派生 Evidence 历史。
- **FR-020** [UPSTREAM: AGENTS / Constitution] Slice 3 的 Implement MUST 在 Slice 1/2 对应依赖合并并通过 required gates 后才能开始；设计阶段不得借“未来依赖”写业务实现。
- **FR-021** [UPSTREAM: V1-C21 / §9–§11 / Slice 1 frozen identity boundary] 当 Evidence 的 `subject_person_id` / `source_person_id` 不为空时，服务端 MUST 验证该 Person reference 对当前目标 Family / Case 合法且已获授权使用；Person UUID 存在本身 MUST NOT 构成合法引用，Family A 的 Evidence MUST NOT 引用仅属于 Family B 的 Person。guardian relationship MUST NOT 被视为跨 Family access 的隐式授权或例外。本 Slice MUST NOT 绕过 Slice 1 已冻结的 Person / guardian consent / compliance 前置条件，也 MUST NOT 为记录 Evidence 私自创建或引用尚未合法建立的 child Person。具体 FK、trigger、repository、SQL、RLS policy 与错误码实现由后续 Plan 决定。

## Key Entities

- **DialogueMessage** — Case 内原始输入；至少承担 Case 归属、actor/source、原始 content、recorded time 与后续 Evidence source reference。
- **Assertion** — `STATEMENT / FACT / HYPOTHESIS` 结构化断言；保留 subject/source/time/confirmation/validity/supersession/conflict。
- **Observation** — 与 Assertion 独立的观察记录；用于保存可观察/测量到的信息及其真实来源、时间和状态，不自动等同 Fact。
- **Evidence Source** — 提供者、来源类型、来源 message / external record 等 provenance。
- **Conflict Group** — 将互相冲突、暂时不能合并成单一事实的 Evidence 关联起来。
- **Validity / Supersession Chain** — 表达旧 Evidence 被更新、失效或更正但历史仍存在的关系。

## Success Criteria

- **SC-001**: Statement / Observation / Fact / Hypothesis 四类语义机械可区分，Observation 未折叠进 Assertion kind。
- **SC-002**: guardian relay → child 主题的 Evidence 在任何读取/验证中仍显示 guardian source，不出现“孩子本人确认”。
- **SC-003**: 冲突测试中至少两条来源均保留，conflict 关系存在，自动 winner = 0。
- **SC-004**: UNKNOWN / NOT_COLLECTED / DECLINED / N/A / CONFLICT 的 round-trip 测试全部保持原语义，无默认补值。
- **SC-005**: supersedes / validity 测试证明旧记录仍存在且新旧当前性可区分。
- **SC-006**: 跨 Family integration + direct DB RLS 测试均证明 Evidence 不泄漏。
- **SC-007**: message endpoint 只保存原始 message / 最小来源信息，不自动创建 FACT、Formulation、Scene State、Plan 或 AI run。
- **SC-008**: route/schema audit 证明没有本 Slice 明确排除的 public endpoint / future placeholder。
- **SC-009**: provenance regression 覆盖 §32.3 当前可落地的 guardian/child conflict、relay、UNKNOWN 与更正最小链路。
- **SC-010**: Implement Gate 在 Slice 1/2 未满足时返回 BLOCKED；不得绕过依赖提前写实现。

## Acceptance Evidence

| Requirement cluster | Evidence type | Required proof |
|---|---|---|
| Evidence type separation | database + domain tests | assertions kind 仅 3 值；observations 独立表/类型；不存在 OBSERVATION assertion kind |
| Source / subject provenance | domain + integration | guardian→child Statement 保持 source/subject 分离；source message 可追溯 |
| Unknown states | domain + database round-trip | UNKNOWN / NOT_COLLECTED / DECLINED / N/A / CONFLICT 不被 0/false/null 语义替代 |
| Conflict | integration | 两条来源 + conflict group 均保留；无自动 Fact winner |
| Validity / supersession | database + domain | supersedes 链可追溯；旧行不删除；当前有效性可判定 |
| Message endpoint | OpenAPI + integration | 仅 approved POST route；strict request；合法 Case 成功；越权失败；无自动 downstream artifacts |
| Authorization / RLS | integration + database | wrong-family HTTP 无泄漏；app role wrong context SELECT 0 / write denied |
| No AI fact promotion | domain tests | HYPOTHESIS / STATEMENT 无合法确认依据时无法变 FACT |
| Scope | route + schema enumeration | 无 assessment / formulation / scene / participant / generic evidence CRUD / AI placeholder |
| Person reference authorization | domain + integration/security | Family A Evidence 对仅属于 Family B 的 Person UUID，无论用于 subject 还是 source 均拒绝写入；Evidence 产生数为 0；不泄露该 Person 敏感信息；UUID 存在与 guardian relationship 均不自动授予跨 Family 引用权 |
| Dependency gate | governance evidence | Slice 1/2 未合并时 Implement 明确 BLOCKED |

## Assumptions and Open Questions

### Assumptions

- Slice 1 的身份、Consent、Authorization、RLS、provenance 基线与 Slice 2 的 Case / Case ownership 将在本 Slice Implement 前作为已合并依赖存在。
- 本 Slice 可以在不接 AI、不实现 Digital Use Scene 的情况下，以 domain/database/integration tests 完整验证 Evidence Core。
- `POST /api/v1/cases/:id/messages` 是本 Slice 唯一需要交付的新增 public route；其它 Evidence 写入先通过内部 domain/repository contract 为后续 Slice 服务。
- Problem Formulation、Assessment、Participant、Safety 与 AI 都会在后续独立 Slice 中接入本 Evidence Core，而不是在本 Slice 预造 placeholder。

### Open Questions

1. `observations` 的最小列级结构如何与 `assertions` 共用 provenance，而又不复制一套会漂移的来源模型？需要在 Plan 阶段由正式文档约束下确定。
2. UNKNOWN / NOT_COLLECTED / DECLINED / N/A / CONFLICT 的数据库表达是统一 typed state、按 Evidence 类型分别表达，还是其它等价结构？不得在未分析前猜测。
3. `POST /cases/:id/messages` 是否属于关键命令并强制使用既有 idempotency key；若 §8.5 / 现有 shared contract 已足够，Plan 应复用，不得新建第二套。
4. message 写入是否必须同步创建 STATEMENT，还是只保存原始 message、由后续确定性/AI extraction path 产生 Assertion？正式文档当前只固定“message 与 assertions 都存在”，需要 Clarify 阶段解析，不得自行假定。
5. FACT 的合法创建/确认入口应是什么最小 domain contract？必须满足“AI 不能最终确认”，但不得为了本 Slice发明新的 public API。
