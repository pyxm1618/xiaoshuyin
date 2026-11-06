# Requirements Quality Checklist: 家庭身份地基（001-family-identity-core）

**Feature**: `specs/001-family-identity-core/spec.md`
**Plan**: `plan.md` · **Contracts**: `contracts/**` · **Data model**: `data-model.md` · **Runbook**: `quickstart.md`
**Created**: 2026-11-04

> This is a reviewer-owned requirements-quality gate. Checked does not mean implementation is complete.
>
> 本清单检查**需求与 Plan 本身**是否完整、明确、一致、可验证；不检查实现、不规定实现方式。
> 条目由 checklist 流程生成，全部保持未勾选（`[ ]`）；勾选状态属于评审人。
> 每条形如：`- [x] CHK### <需求质量问题> [质量维度, 追溯引用]`。

## Scope & Boundaries

- [x] CHK001 Are Account、Person、Family、family_members、Compliance Profile、guardian consent、provenance、authorization、RLS、idempotency 十项在 In Scope 中各自有明确边界，而非仅出现名词？[Completeness, spec §Scope]
- [x] CHK002 Are Case、case_participants、AI/RAG、Digital Use、UI、多管理员、多监护人、跨家庭身份关联产品能力逐项给出排除依据，而不只是列名字？[Completeness, spec §Out of Scope]
- [x] CHK003 Do any Plan artifacts introduce a schema、API 或抽象 that spec 未批准（第二真相源）？[Consistency, plan §Upstream Traceability]
- [x] CHK004 Is “Person ↔ Family 多对多只是 schema 能力、不是产品/API 能力”在 Scope、Non-Goals、验收三处表述一致且不可被误读？[Consistency, spec Clarifications Q2 / SC-006]
- [x] CHK005 Are 未做项（性能、容量、成本）以 Non-Goal 形式显式声明，避免被当成遗漏的非功能需求？[Clarity, spec §Non-Goals]

## Identity & Cardinality

- [x] CHK006 Are Account ↔ Person = 1:1 与 Person → Account = 0..1 两个方向都写明，并指明各自由哪条数据库约束强制？[Completeness, spec FR-016 / plan D-1]
- [x] CHK007 Is “首次登录在同一事务内建立 Account 与当前登录者 Person”在 spec、plan、OpenAPI、quickstart 四处表述一致（无任一处仍称登录只建 Account）？[Consistency, spec US1 / plan D-2 / contracts]
- [x] CHK008 Is it explicit that `POST /families` must not create a second Person，并规定违反时的可观察结果？[Clarity, plan D-2 / contracts/authorization-and-rls §4.3]
- [x] CHK009 Are 三项同时成立：只经 `family_members` 表达多对多、`UNIQUE(family, person)`、`persons` 无单家庭绑定列？[Completeness, spec FR-017]
- [x] CHK010 Is “一个 Person 只拥有一个 Family”与“一个 Person 可作为成员属于多个 Family”被明确区分，且不互相否定？[Clarity, plan R-2]
- [x] CHK011 Do 场景 11 / 12 / 14 给出可在数据库层观察的判据（拒绝类型与受影响行数），而非“应当失败”式表述？[Measurability, spec Acceptance Scenarios 11/12/14]

## UNDER_14 Consent-First

- [x] CHK012 Is consent-first 被定义为硬前置条件（不满足即禁止），而非推荐流程？[Clarity, spec FR-008 / plan D-3.1]
- [x] CHK013 Is “同意成立前不存在正式 child Person / Compliance Profile”表达为可判定的结构性质，而不是仅靠流程叙述？[Measurability, plan D-3.5]
- [x] CHK014 Are pre-consent 最小状态的允许字段与禁止字段各有清单，并同时覆盖“首次 onboarding”与“已存在未成年人重新同意”两种情形？[Completeness, plan D-3.2]
- [x] CHK015 Is consent → Person 的绑定顺序规定为同时满足即时外键与 consent-first，并说明错误顺序为何必然失败？[Consistency, plan D-3.4]
- [x] CHK016 Can GRANTED → REVOKED → GRANTED 三行在声明的唯一性与必填规则下同时成立（含 request 归属规则）？[Consistency, plan D-3.7 / data-model §7]
- [x] CHK017 Is 撤回定义为“新版本 + 留痕 + 不删除历史”，且明确不宣称 §29.5 的完整传播？[Completeness, spec FR-010]
- [x] CHK018 Are `bound_person_id` 与 `bound_at` 被定义为成对、仅一次、绑定后不可改，并说明单独 CHECK 为何不足以阻止事后改时间？[Clarity, plan D-3.3.1]
- [x] CHK019 Is UNKNOWN 在每条依赖年龄的判定路径上都被排除在 ADULT 之外（含 gate 顺序不可重排）？[Consistency, spec FR-009 / plan D-3.6]
- [x] CHK020 Are guardian relationship 与 Family membership 在授权与同意两处都被声明为互不替代、互不推导？[Consistency, spec FR-006 / plan D-5.1]
- [x] CHK021 Does 同意证据枚举“谁同意 / 同意了什么 / 何时 / 对谁”，且每项都有可验证来源（不接受客户端时间与客户端声明主体）？[Completeness, plan D-3.3]
- [x] CHK022 Is 明确写出“门禁不得锁死取得同意本身所必需的最小处理”？[Consistency, spec FR-008(d)]
- [x] CHK023 Is `ageBandSource` 的可接受取值按**创建路径**规定（`POST /families` 仅 `SELF_STATEMENT`；`UNDER_14` consent-first 建档仅 `GUARDIAN_RELAY`/`GUARDIAN_OBSERVATION`，provider 由服务端固定），且明确该约束不外推为身份规则？[Clarity, plan D-4 / contracts/provenance §2.1]

## Provenance

- [x] CHK024 Is 来源明确归属于具体资料值，并显式禁止 `persons.source_kind` 一类 Person 级来源字段？[Clarity, spec FR-003]
- [x] CHK025 Is 明确“是否存在 Account”不参与来源判定，且无 Account 的 Person 可以有真实 `SELF_STATEMENT`？[Clarity, spec FR-004]
- [x] CHK026 Are 同源替换与异源并存两条规则确定、无歧义，且能同时满足“多来源不被覆盖”与“同源可更新”？[Consistency, plan D-4]
- [x] CHK027 Is §2.2 八类来源（枚举全集）与“本 Slice 只写四类”（API 白名单）的差别解释清楚，不会被读成两套来源定义？[Clarity, plan R-3]
- [x] CHK028 Is `age_band` 的来源被规定为唯一载体（profile 同行字段），且第二载体被结构性排除？[Consistency, plan D-4]
- [x] CHK029 Is 明确禁止“为让测试成立而新增业务资料字段”，并排除 Statement / Observation / Assertion 平台？[Consistency, plan D-4 / spec §Out of Scope]

## Authorization & RLS

- [x] CHK030 Is `authorize()` 的动作集合与 purpose 集合封闭，且未注册输入一律 fail-closed（含异常兜底）？[Completeness, plan D-5.2]
- [x] CHK031 Does `FAMILY_CREATE` 不含调用时不可能成立的前置（例如要求已存在 compliance profile），且年龄校验被明确放在命令体？[Consistency, contracts/authorization-and-rls §2.3.1]
- [x] CHK032 Is 管理主体由 Family 聚合表达（无成员角色列、无 RBAC），且 `isManager` 明确为即时计算结果而非持久角色？[Clarity, plan D-2]
- [x] CHK033 Are 每张表的 RLS `USING` / `WITH CHECK` 逐表写明，并明确“无上下文即 0 行”的默认拒绝？[Completeness, plan D-5.4]
- [x] CHK034 Is 只读 self 分支与写路径被明确区分（self 上下文不能写）？[Clarity, plan D-5.4]
- [x] CHK035 Does `idempotency_keys` 具备身份级隔离，且理由与其保存 `response_body` 的事实直接相关？[Completeness, plan D-5.4]
- [x] CHK036 Is `accounts` 无 RLS 的边界有补偿控制，并被列为可被否决的评审项而非静默决定？[Clarity, plan R-4 / contracts §4.5]
- [x] CHK037 Is 上下文必须在同一事务内设置，且禁止做法（事务外 SET LOCAL、字符串拼接、连接复用不清）被逐条列出？[Completeness, plan D-5.5]
- [x] CHK038 Is `app.family_id` 明确为当前请求的目标家庭，且禁止由 `app.person_id` 反推唯一家庭？[Consistency, spec FR-013]
- [x] CHK039 Are runtime 角色属性（非 table owner、NOBYPASSRLS、最小 DML）以可查询事实表达，而非文档声明？[Measurability, plan D-5.3]

## API Surface

- [x] CHK040 Do 13 个 operation 覆盖全部 in-scope 能力，且同一业务事实只有一条写入路径？[Consistency, plan D-6.1 / contracts OpenAPI]
- [x] CHK041 Is 不实现 `POST /consents` 被解释为范围决定（完整 Consent 平台不在本 Slice），而非遗漏？[Clarity, plan R-7]
- [x] CHK042 Is 撤回只有唯一端点，且与 guardian-consent onboarding 的创建/授予端点职责分离？[Consistency, plan D-3.7]
- [x] CHK043 Are 错误码与 HTTP 状态由单一映射点决定，后续改动不需触碰业务分支？[Clarity, plan D-6.2]
- [x] CHK044 Is 拒绝响应“不携带目标对象任何字段”被明确规定（存在性与无权对外一致）？[Completeness, plan D-6.2]
- [x] CHK045 Is “已登录但尚无家庭”的合法空态与“无权访问某家庭”被区分，且各自对外结果被规定（404 `CURRENT_FAMILY_NOT_FOUND` vs 403 `NOT_FAMILY_MEMBER`）？[Clarity, plan D-6.2 / contracts/authorization-and-rls §4.4]

## Idempotency

- [x] CHK046 Is 关键命令集合封闭枚举，并明确不把幂等扩展到 GET / 读操作？[Clarity, plan D-6.3]
- [x] CHK047 Are 同 key 同 payload、同 key 异 payload、并发三种语义都被规定，并各自给出可观察结果？[Completeness, plan D-6.3]
- [x] CHK048 Is 重放快照的跨账号隔离被规定（表级策略 + 必须在 identity 上下文内读写）？[Completeness, plan D-5.4]

## Migration & Database Integrity

- [x] CHK049 Are `uuidv7()` 主键基线与“仅 reviewed migration、禁止 drizzle-kit push”同时写明？[Completeness, spec FR-015]
- [x] CHK050 Is 可延迟外键只用于确实必要的关系，并给出“为何不能统一顺序”的理由？[Clarity, plan D-5.4]
- [x] CHK051 Are 每张表的唯一约束与 CHECK 与它要保证的不变量一一对应（可据此反查需求）？[Completeness, data-model §14]
- [x] CHK052 Is 迁移顺序给出外键依赖依据，并说明可从空库重放？[Consistency, plan D-6.4 / Rollback]
- [x] CHK053 Does 回滚覆盖 policy、函数/触发器、表、enum、GRANT，并标出不可逆点与前置人工确认？[Completeness, plan §Rollback]

## Verification & Traceability

- [x] CHK054 Does 每条 FR（含 FR-006 两维独立、FR-007 的 minor_mode 与 verified_source）至少对应一条具名验证项，且含可观察结果与测试层级？[Completeness, plan §Verification Plan]
- [x] CHK055 Does 每个验收场景标注上游 ID（U / V1-C / §）？[Completeness, spec §Acceptance Scenarios]
- [x] CHK056 Is 每条 SC 可在不依赖未来 Slice 的前提下被度量？[Measurability, spec SC-001—SC-008]
- [x] CHK057 Are 真实平台/环境未验证项被显式标注为 NOT VERIFIED，而非沉默或声称已通过？[Clarity, plan FR-002 平台真实性]
- [x] CHK058 Are guardian-but-not-member 与 member-but-not-guardian 两条独立性验证各自具名，且不重复另一套测试设计？[Completeness, plan D-5.1 / §Verification Plan FR-006a / FR-006b]

## Review Decision

- [x] CHK059 Is 无未决 `NEEDS UPSTREAM DECISION` 残留？[Completeness, spec Residual blockers]
- [x] CHK060 Are 剩余 Owner 决策（如 A-2 对外状态码）被隔离为假设或可否决评审项，而不是埋进正文当作已批准？[Clarity, spec A-2 / plan R-1—R-8]
- [x] CHK061 Is 该切片可独立实现与独立评审（不依赖 Case / AI / UI 切片先行）？[Clarity, spec §Scope / plan §Complexity Exceptions]

## Review Log

| 日期 | 事件 | 影响条目 |
|---|---|---|
| 2026-11-04 | Checklist 生成（61 条，全部未勾选） | 全部 |
| 2026-11-04 | Closeout：`ageBandSource` 改为**按创建路径**约束（creator=SELF_STATEMENT；UNDER_14=guardian-origin，provider 服务端固定） | CHK023 |
| 2026-11-04 | Closeout：“尚无家庭”空态改为 404 `CURRENT_FAMILY_NOT_FOUND`，与 403 `NOT_FAMILY_MEMBER` 区分 | CHK045 |
| 2026-11-04 | Closeout：补 FR-006a / FR-006b 具名验证与 FR-007 profile 矩阵验证 | CHK054, CHK058 |
| 2026-11-04 | 全量复核：61/61 满足，0 FAIL，0 WARNING，全部勾选 | 全部 |
| 2026-11-04 | Analyze closeout：Acceptance Scenario 1 删除陈旧「若已建立」，与 US1 / FR-002 / OpenAPI 对齐；CHK006–CHK011（身份生命周期）与 CHK054（验证可追溯）定向复核仍 PASS | CHK006–CHK011、CHK054 |

---

## Notes

- 本清单是**需求质量**检查表：判定对象是 `spec.md` + `plan.md` + `contracts/**` 的表述，不是代码行为。
- 全部 61 条在生成时保持未勾选；评审人勾选即表示“该需求质量维度已被满足”，不代表实现完成。
- 本轮为**评审阶段**复核（Checklist Review Closeout）：逐条对照 spec / plan / contracts 的实际表述后勾选，非机械全选。
- `[Gap]` 标记用于“文档尚未给出答案”的条目；本轮收口后**无残留 `[Gap]`**。新增缺口仍应标 `[Gap]` 并保持未勾选。
- 追溯引用约定：`FR-xxx` / `SC-xxx` / `场景 N` 指向 `spec.md`；`D-x` 指向 `plan.md`；`§x` 指向对应契约文件或正式 Docs。
