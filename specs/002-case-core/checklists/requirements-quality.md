# Requirements Quality Checklist: Case 核心地基（002-case-core）

**Feature**: `specs/002-case-core/spec.md`
**Plan**: `plan.md` · **Research**: `research.md` · **Contracts**: `contracts/**` · **Data model**: `data-model.md` · **Runbook**: `quickstart.md`
**Created**: 2026-11-05
**Review object**: Spec + Clarify + Plan + Research + Data Model + Contracts + Quickstart（不含实现代码）
**Status legend**: `[x] PASS` / `[ ] FAIL` / `[ ] NEEDS REVIEW`

> 本清单是需求质量门禁，不是实现任务清单。
> 它检查“需求与技术设计是否写清楚、写一致、可验证”，不检查代码是否已实现。
> 每条均可由评审人对 `spec.md` / `plan.md` / `contracts/**` / `data-model.md` 作出 PASS / FAIL / NEEDS REVIEW 判断。

---

## 1. 追溯与范围

- [x] CHK001 每条 FR / SC / Acceptance Scenario 是否都追溯到已批准上游 ID 或技术设计章节？[PASS] — `spec.md` Upstream Traceability、FR 标签、每个 Acceptance Scenario 均标注 Upstream]
- [x] CHK002 Spec / Plan / Contract 是否都只作为正式文档的下游投影，没有建立第二产品/架构真相源？[PASS] — `plan.md` Upstream Traceability、Constitution Check]
- [x] CHK003 In Scope / Out of Scope / Non-Goals 是否明确且互不矛盾，且整体只覆盖 Case 容器？[PASS] — `spec.md` §Scope / §Non-Goals]
- [x] CHK004 是否没有把 Participant、Evidence、Assessment、Problem Formulation、Safety、Plan、Task、Notification、AI、UI、数据权利等 V2–V5 / 后续 Slice 能力偷带进本 Slice？[PASS] — `spec.md` Out of Scope；`plan.md` D-12；`data-model.md` §8]
- [x] CHK005 文档中的“明确禁止这些东西”是否被正确视为范围排除，而不是被误读为新增占位表、占位路由或占位抽象？[PASS] — `spec.md` §Non-Goals；`plan.md` D-12；`data-model.md` §8]
- [x] CHK006 是否不存在孤儿需求：每条 requirement 都能在 Acceptance Scenarios 或 Acceptance Evidence 中找到落点？[PASS] — `spec.md` Requirements / Acceptance Evidence]
- [x] CHK007 Case 允许的最小 metadata 与禁止的内容字段是否在 Spec、Plan、Data Model、Contract 中一致列举？[PASS] — `spec.md` Key Entities；`plan.md` D-2；`data-model.md` §2；`contracts/cases-api.openapi.yaml` CaseResponse]
- [x] CHK008 本 Slice 与 Slice 1（Family identity）以及后续 Case 生命周期 Slice 的边界是否明确，且不要求 Slice 2 补齐未来能力？[PASS] — `spec.md` §Slice 边界 / Implementation Dependencies；`plan.md` §0 / §D-12]

## 2. Case 容器边界

- [x] CHK009 Case 是否只被定义为容器，而不是问题正文、证据、参与者或判断对象？[PASS] — `spec.md` §1 / Key Entities；`plan.md` D-2；`data-model.md` §2]
- [x] CHK010 持久化字段是否只包含 family ownership、creator、status、phase、primary、version、timestamps，而没有隐藏的第二真相源？[PASS] — `data-model.md` §2.1；`plan.md` D-2.1]
- [x] CHK011 creator 是否明确由服务端从已验证 actor 写入，客户端不可指定？[PASS] — `spec.md` FR-015 / Key Entities；`plan.md` D-4；`contracts/cases-api.openapi.yaml` CreateCaseRequest]
- [x] CHK012 Case 与 Family 的归属是否明确为创建后不可迁移，且没有 Update / Move 路径？[PASS] — `spec.md` Key Entities；`plan.md` D-2.1 / D-12]
- [x] CHK013 是否明确禁止在本 Slice 建立 Participant、Visibility、Safety、Plan、Task、Notification、Follow-up 关系？[PASS] — `spec.md` Key Entities 禁止关系；`plan.md` D-12；`data-model.md` §8]
- [x] CHK014 Case 是否必须属于唯一一个当前目标 Family，且 `case_id` / `family_id` 只作为待验证参数而非访问依据？[PASS] — `spec.md` FR-010 / FR-023；`plan.md` D-6.3；`contracts/authorization-rls-and-idempotency.md` §3]
- [x] CHK015 `cases` 与 `case_events` 是否明确不保存 title / summary / description / problem_description / 任何 evidence-like 自由文本或 PII？[PASS] — `spec.md` FR-015 / Key Entities；`data-model.md` §2.3 / §3.4；`contracts/case-events-and-business-audit.md` §2.2]

## 3. Status / Phase

- [x] CHK016 创建时固定 `status = OPEN`、`phase = INTAKE` 是否在 Spec、Plan、Data Model、Contract 四处一致？[PASS] — `spec.md` FR-004 / D1；`plan.md` D-1.3 / D-4；`data-model.md` §2.1；`contracts/cases-api.openapi.yaml` POST description]
- [x] CHK017 `status` 与 `phase` 是否明确为独立存储、独立返回，不存在组合枚举、单一字段替代或互相推导？[PASS] — `spec.md` FR-003 / §2.4；`plan.md` D-1.3；`data-model.md` §1；`contracts/cases-api.openapi.yaml` CaseResponse]
- [x] CHK018 两个 enum 的取值与顺序是否严格照 `Docs/V1技术设计.md` §6.1 / §6.2，且没有新增、改名或重排？[PASS] — `data-model.md` §1；`spec.md` FR-003]
- [x] CHK019 本 Slice 是否明确没有任何 Status / Phase 转换命令、端点、服务或空壳实现？[PASS] — `spec.md` FR-005 / Out of Scope；`plan.md` D-1.3 / D-12；`data-model.md` §8]
- [x] CHK020 “数据库 enum 承载完整词汇”与“本 Slice 只允许写入 OPEN + INTAKE”是否被解释清楚，不会被视为两套状态定义？[PASS] — `data-model.md` §1 说明；`plan.md` D-1.3]
- [x] CHK021 客户端是否不能决定 status / phase / primary / version / creator，且这些值由服务端固定或派生？[PASS] — `spec.md` FR-015 / Scenario 13；`plan.md` D-9.1]
- [ ] CHK022 客户端提交越权字段时的业务语义（strict 422 拒绝，还是忽略后落库）是否在 Spec Scenario 13 / Acceptance Evidence、Plan、OpenAPI、Quickstart 之间完全一致？[FAIL] — `spec.md` Acceptance Evidence 第 327 行写“携带 status / phase / primary / version / creator 请求后实际落库仍为 OPEN + INTAKE”，而 `plan.md` D-9.1、`contracts/cases-api.openapi.yaml` `CreateCaseRequest.additionalProperties=false`、`quickstart.md` §4.1 均要求 `422 VALIDATION_ERROR` 且无 Case 写入；两者不能同时成立]

## 4. Primary 与并发

- [x] CHK023 是否明确第一个成功创建的 Case 自动 `primary = true`，后续 Case 自动 `primary = false` 作为候选，旧 primary 不变？[PASS] — `spec.md` FR-007 / SC-001；`plan.md` D-3.1；`data-model.md` §7 基数]
- [x] CHK024 “当前 primary 未结 Case”是否被定义为 `is_primary = true AND status <> 'CLOSED'`，且数据库 partial unique index 谓词与之一致？[PASS] — `spec.md` FR-006；`data-model.md` §2.2；`research.md` R-10]
- [x] CHK025 一个 Family 最多一个当前 primary 未结 Case 是否明确由数据库保证，而不是只靠前端、应用层查询或 AI runtime？[PASS] — `spec.md` FR-006 / §8.1；`plan.md` D-3.2]
- [x] CHK026 并发算法是否明确为“Family 行锁 → 独立 EXISTS 读取 fresh snapshot → INSERT”？[PASS] — `plan.md` D-3.2 / D-4；`contracts/authorization-rls-and-idempotency.md` §6]
- [x] CHK027 是否解释 READ COMMITTED 下为什么“锁语句”与“EXISTS 判定语句”必须是两个 statement，而不能合并成一条 CTE / SELECT？[PASS] — `plan.md` D-3.3；`research.md` R-1]
- [x] CHK028 是否明确禁止裸 check-then-insert，并明确 partial unique index 只是最后防线？[PASS] — `plan.md` D-3.2 / D-3.3；`research.md` R-1]
- [x] CHK029 是否明确 unique violation 不作为正常业务流程，不自动 retry，也不伪装成 201 / 409？[PASS] — `plan.md` D-3.3 / D-3.6；`research.md` R-2]
- [x] CHK030 两个不同幂等键的并发创建是否被规定为都应确定性完成，最终一个 primary + 一个 candidate，而不是一个失败？[PASS] — `spec.md` Scenario 3 / SC-002；`plan.md` D-3.4；`quickstart.md` §6]
- [x] CHK031 同一幂等键的并发创建是否被规定为只有一个业务结果，其余为 REPLAY，且不追加 Case / event / audit？[PASS] — `spec.md` Scenario 10 / SC-006；`plan.md` D-3.4 / D-5.3；`contracts/case-events-and-business-audit.md` §4]
- [x] CHK032 是否明确本 Slice 不实现 switch-primary / 候选晋升，候选 Case 仍真实保留且可读取，且不产生 Plan / Task / Follow-up / Notification 副作用？[PASS] — `spec.md` FR-021 / Out of Scope；`plan.md` D-12]
- [x] CHK033 API 字段 `primary` 与 DB 列 `is_primary` 的差异是否作为 Frozen Technical Decision R3 固定，且不构成第二真相源？[PASS] — `plan.md` R3 / D-2.1；`research.md` R-9 / R-15]
- [ ] CHK034 当未来允许保留 CLOSED 的历史 primary 时，API `primary` 字段是否仍能唯一识别“当前”primary，而不会出现多个 `primary = true`？[NEEDS REVIEW] — `data-model.md` §2.2 与 `research.md` R-10 允许历史 CLOSED primary；`contracts/cases-api.openapi.yaml` list description 称 `primary` 是唯一识别依据；本 Slice 无 CLOSED 路径，因此不阻断本轮，但未来 Close / switch-primary Slice 必须定义 API 语义]
- [x] CHK035 `SELECT ... FOR UPDATE` 所需的 `families` UPDATE 权限是否被列为 Implement Gate 的现场验证项，且明确禁止在权限收紧时改用无锁 check-then-insert？[PASS] — `plan.md` D-3.3；`contracts/authorization-rls-and-idempotency.md` §4.3；G5]

## 5. 幂等

- [x] CHK036 `CASE_CREATE` 的幂等 scope 是否明确为 `actor_account_id + command_type + idempotency_key`，并复用既有 `idempotency_keys` 而不新建第二张幂等表？[PASS] — `spec.md` FR-012；`plan.md` D-5.4；`data-model.md` §5]
- [x] CHK037 幂等键是否为 JSON body 字段 `idempotencyKey`（8–128 字符），并作为 R1 冻结，不在 Implement 时重新选择？[PASS] — `plan.md` R1 / D-5.1；`research.md` R-3；`contracts/cases-api.openapi.yaml` CreateCaseRequest]
- [x] CHK038 canonical command context 是否明确为 `{ familyId: 已验证当前目标 Family, body: 去掉 idempotencyKey 后的请求体 }`，且客户端提交 `familyId` 必须 422？[PASS] — `plan.md` D-5.2；`research.md` R-4；`contracts/authorization-rls-and-idempotency.md` §5.2]
- [x] CHK039 相同 key + 相同 canonical payload 重放是否返回原结果，且不新建 Case、不追加 `case_event` / `business_audit_event`？[PASS] — `spec.md` FR-012 / SC-006；`plan.md` D-5.3]
- [x] CHK040 并发同 key 是否被规定为只产生一个业务结果，其余为原结果 REPLAY？[PASS] — `plan.md` D-3.4 / D-5.3；`quickstart.md` §5.1]
- [x] CHK041 相同 scope key + 不同 `request_hash` 是否仍在 shared idempotency domain / repository contract 层返回 MISMATCH 并映射为 `409 IDEMPOTENCY_PAYLOAD_MISMATCH`？[PASS] — `spec.md` Clarifications Q3 / FR-012；`plan.md` D-5.3；`contracts/authorization-rls-and-idempotency.md` §5.3]
- [x] CHK042 是否明确禁止通过切换 actor、伪造 Family 上下文或新增无业务意义字段来制造 public HTTP different-payload mismatch？[PASS] — `spec.md` Clarifications Q3；`plan.md` D-5.3；`quickstart.md` §5.2]
- [ ] CHK043 “public HTTP 层不存在可达的 different-payload 请求”这一结论是否限定了“同一 canonical family context”前提，并说明同一 actor 跨 Family 复用同一 key 时会因 `familyId` 进入 hash 而得到 MISMATCH？[NEEDS REVIEW] — `plan.md` D-5.3 与 `research.md` R-4 的“HTTP 不可达”表述未显式限定 canonical family context；`familyId` 进入 hash，跨 Family 同 key 会得到 409，虽不是请求 payload 变化，但应在契约中注明前提]
- [x] CHK044 幂等占位、回填与 REPLAY 是否都在 `withRlsTransaction` 内执行，且 REPLAY 分支不获取 Family 锁、不写业务数据？[PASS] — `plan.md` D-4 / D-5.3；`contracts/authorization-rls-and-idempotency.md` §5.4 / §6]

## 6. Authorization

- [x] CHK045 `CASE_CREATE` / `CASE_LIST` / `CASE_READ` 是否增量进入现有 `authorize()`，且明确不新建 `authorizeCase()`？[PASS] — `spec.md` FR-008；`plan.md` D-6.1；`contracts/authorization-rls-and-idempotency.md` §2.1]
- [x] CHK046 Case 管理主体是否明确为当前目标 Family 的 V1 管理主体（创建该 Family 的 adult Person），且不新建 Case role / RBAC？[PASS] — `spec.md` D2 / FR-008；`plan.md` D-6.4；`contracts/authorization-rls-and-idempotency.md` §2.2]
- [x] CHK047 普通 membership、guardian relationship、已知 `case_id` 是否都被明确声明为不自动授予 Case 访问？[PASS] — `spec.md` FR-009 / Scenario 8；`plan.md` D-6.4；`contracts/authorization-rls-and-idempotency.md` §2.3]
- [x] CHK048 未知 action / purpose / context 是否 fail-closed，且 `family.createdByPersonId` 缺失时明确 DENY 而不是默认放行？[PASS] — `plan.md` D-6.2；`contracts/authorization-rls-and-idempotency.md` §2.2]
- [x] CHK049 `CASE_CREATE` / `CASE_LIST` 要求 `case === null`、`CASE_READ` 要求 `case !== null`，且非 Case 动作保持既有行为，是否写清？[PASS] — `plan.md` D-6.2 规则 5–7；`research.md` R-8]
- [x] CHK050 Case 是否属于当前 Family 是否明确由 `withRlsTransaction` + RLS 保证，而不是由 `authorize()` 纯函数推断？[PASS] — `plan.md` D-6.3；`contracts/authorization-rls-and-idempotency.md` §3]
- [x] CHK051 创建 / 列表在 Family 已解析但 actor 非管理主体时返回 `403 CASE_ACCESS_DENIED`、单 Case 详情返回 `404 CASE_NOT_FOUND`，是否一致？[PASS] — `spec.md` D6 / FR-023 / FR-024；`plan.md` D-6.5；`contracts/authorization-rls-and-idempotency.md` §7]
- [x] CHK052 目标 Family 本身未合法解析时，Case 端点是否明确沿用 Slice 1 的 Family 语义，且不定义第二套 Family 错误码？[PASS] — `spec.md` FR-024；`plan.md` R5 / D-6.5；`contracts/authorization-rls-and-idempotency.md` §7]
- [ ] CHK053 Scenario 9 中“guardian 但不是目标 Family 创建者”的 actor 是否明确其是否为目标 Family 成员 / Family 是否已合法解析，从而使 403 / 404 的预期与 FR-024 / R5 不冲突？[FAIL] — `spec.md` Scenario 9 未说明该 guardian 是否为目标 Family 成员；若 guardian 不是成员，当前 Family 无法解析为目标 Family，应按 FR-024 / R5 返回 Slice 1 Family 语义（如 `CURRENT_FAMILY_NOT_FOUND`），而不是 Scenario 9 写的 403 / 404 CASE_*；上游 §9 明确 guardian relationship 不等于 family access]
- [x] CHK054 非管理主体 / 404 / 403 响应是否明确不携带任何 Case 字段、Family 字段或存在性提示，且详情响应逐字节一致？[PASS] — `spec.md` FR-023 / D6；`plan.md` D-6.5；`contracts/authorization-rls-and-idempotency.md` §7]

## 7. RLS

- [x] CHK055 `cases` 与 `case_events` 是否都明确 `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`，且 runtime 角色非 owner、`NOBYPASSRLS`？[PASS] — `spec.md` FR-011；`plan.md` D-7；`data-model.md` §6.1 / §6.3]
- [x] CHK056 RLS policy 是否只负责 Family 隔离，不承担 manager / participant / purpose / visibility 判定？[PASS] — `data-model.md` §6.3；`plan.md` D-7；`contracts/authorization-rls-and-idempotency.md` §4.4]
- [x] CHK057 无上下文是否明确为 SELECT 0 行 / 写入被拒，错误 Family 上下文是否同样 0 行 / 拒绝？[PASS] — `spec.md` Scenario 7；`data-model.md` §6.3；`contracts/authorization-rls-and-idempotency.md` §4.2]
- [x] CHK058 `case_events` 是否通过复合 FK `(case_id, family_id) → cases(id, family_id)` 保证事件与 Case 同 Family，且 RLS 与 FK 两层都写明？[PASS] — `data-model.md` §3.2；`plan.md` D-7；`research.md` R-11]
- [x] CHK059 所有家庭级读写是否必须在 `withRlsTransaction` 同一事务内设置上下文，且禁止事务外 `SET LOCAL`、连接池复用、`sql.raw` 拼接？[PASS] — `spec.md` FR-011；`plan.md` D-7；`contracts/authorization-rls-and-idempotency.md` §4.4]
- [x] CHK060 RLS 是否通过真实 `pg_class.relrowsecurity` / `relforcerowsecurity` / `pg_roles.rolbypassrls` 等查询验证，而不是仅写文档声明？[PASS] — `spec.md` Acceptance Evidence；`plan.md` Verification Plan；`quickstart.md` §2]
- [x] CHK061 是否明确 RLS 存在不能成为跳过 `authorize()` 的理由，应用层授权与数据库隔离必须同时成立？[PASS] — `spec.md` DFX 安全性；`plan.md` D-7；`contracts/authorization-rls-and-idempotency.md` §4.4]

## 8. 事务、事件与审计

- [x] CHK062 Case 创建是否有唯一明确顺序：认证 → 解析当前 Family → `withRlsTransaction` → 读取 Family / authorize → 幂等判定 → Family 行锁 → primary 判定 → Case → `case_event` → `business_audit_event` → 幂等响应 → COMMIT？[PASS] — `plan.md` D-4；`contracts/authorization-rls-and-idempotency.md` §6]
- [x] CHK063 Case、`case_event`、`business_audit_event`、幂等响应是否明确为同一事务，任一失败整体回滚，禁止部分成功？[PASS] — `spec.md` FR-014 / SC-007；`plan.md` D-4；`data-model.md` §9]
- [x] CHK064 `case_events`（领域历史）与 `business_audit_events`（跨资源业务审计）是否明确职责不同、不能合并，且本 Slice 同时写两者？[PASS] — `plan.md` D-8；`contracts/case-events-and-business-audit.md` §1；`research.md` R-7]
- [x] CHK065 本 Slice `case_events` 是否只有 `CASE_CREATED`，没有 pause / resume / close / switch-primary 等未来事件？[PASS] — `data-model.md` §3.1 / §3.4；`contracts/case-events-and-business-audit.md` §6]
- [x] CHK066 `case_events` 是否明确 append-only，runtime 只有 `SELECT, INSERT`，没有 `UPDATE / DELETE`，且当前不需要 trigger？[PASS] — `data-model.md` §3.3；`plan.md` R4；`research.md` R-6]
- [x] CHK067 GET / list / detail 是否明确不写 `case_event` / `business_audit_event`，且读取结果不依赖审计写入成功？[PASS] — `spec.md` D7 / FR-025；`plan.md` D-4；`contracts/case-events-and-business-audit.md` §4]
- [ ] CHK068 `case_events.metadata` 只允许 `{ primary, version }`、不得含正文 / PII，这一约束是否有可执行手段（DB CHECK 或明确的应用层校验）与验证路径？[NEEDS REVIEW] — `data-model.md` §3.1 写“只允许”，但 §3.2 没有对应 CHECK，`plan.md` Verification Plan 也没有 metadata 内容断言；当前只能靠实现约定]
- [x] CHK069 `business_audit_events` 是否只做最小增量（`CASE_CREATED` / `CASE`），沿用既有列与追加语义，不建第二套 audit platform？[PASS] — `data-model.md` §4；`contracts/case-events-and-business-audit.md` §3]
- [x] CHK070 是否明确不允许异步补写事件 / 审计（本 Slice 无 pg-boss / outbox），且任何写入失败都不留下部分持久状态？[PASS] — `plan.md` D-4 / Async Impact；`contracts/case-events-and-business-audit.md` §5]

## 9. API 契约与错误语义

- [x] CHK071 是否只暴露 `POST /api/v1/cases`、`GET /api/v1/cases`、`GET /api/v1/cases/:id`，且没有 `/cases/current`、PATCH、pause、resume、switch-primary、close、recurrences、messages、assessments、participants？[PASS] — `spec.md` FR-018；`plan.md` D-12；`contracts/cases-api.openapi.yaml` paths]
- [x] CHK072 `POST /api/v1/cases` 是否为 strict body，只接受 `idempotencyKey`，且 `familyId` / status / phase / primary / version / creator / 内容字段都被拒绝？[PASS] — `contracts/cases-api.openapi.yaml` CreateCaseRequest `additionalProperties: false`；`plan.md` D-9.1]
- [x] CHK073 `CaseResponse` 是否恰好包含 `id / status / phase / primary / version / createdAt / updatedAt`，不含 `familyId`、creator 或任何内容字段？[PASS] — `plan.md` R-15 / D-9.4；`contracts/cases-api.openapi.yaml` CaseResponse]
- [x] CHK074 列表是否使用 `{ "items": [...] }`、不分页、按 `primary DESC, createdAt ASC, id ASC` 稳定排序，空 Family 返回真实空集合？[PASS] — `plan.md` R2 / D-9.2；`contracts/cases-api.openapi.yaml` CaseListResponse；`quickstart.md` §3.4 / §3.6]
- [x] CHK075 详情对“不存在 / 跨 Family / 同 Family 无资格”是否统一 `404 CASE_NOT_FOUND`，响应逐字节一致且不泄露任何 Case 字段？[PASS] — `spec.md` FR-023 / D6；`plan.md` D-9.3；`contracts/cases-api.openapi.yaml` GET detail 404 description]
- [x] CHK076 列表 / 创建在 Family 已解析但 actor 非管理主体时是否返回 `403 CASE_ACCESS_DENIED`，且不返回 Case 数据？[PASS] — `spec.md` FR-024；`plan.md` D-6.5；`contracts/cases-api.openapi.yaml` CaseAccessDenied]
- [ ] CHK077 404 / 403 的错误码是否由 Contract 结构固定（而不是仅靠描述文字），且 `CaseNotFound` 组件没有被定义却未使用？[NEEDS REVIEW] — `contracts/cases-api.openapi.yaml` 的 GET detail 404 使用通用 `Error` schema，`CaseNotFound` 组件未在 responses 中引用；描述虽写明 `CASE_NOT_FOUND`，但契约层面未约束 `code` 取值]
- [x] CHK078 错误 envelope / 错误码是否由单一映射决定，且没有用 200 / 201 掩盖无权、未找到、冲突或数据库失败？[PASS] — `plan.md` D-6.5；`contracts/authorization-rls-and-idempotency.md` §7]
- [x] CHK079 OpenAPI strict schema 对越权字段是否返回 422 且不产生业务写入？（Spec Acceptance Evidence 的“实际落库”表述另见 CHK022）[PASS] — `contracts/cases-api.openapi.yaml` ValidationError；`quickstart.md` §4.1]

## 10. 数据模型与 Migration

- [x] CHK080 `cases` 是否完整覆盖：`id uuidv7`、`family_id` FK、`created_by_person_id` FK、`status`、`phase`、`is_primary`、`version >= 1`、timestamps、`UNIQUE (id, family_id)`、partial unique primary invariant？[PASS] — `data-model.md` §2.1 / §2.2]
- [x] CHK081 `case_events` 是否完整覆盖：`family_id`、`case_id`、`actor_account_id`、`CASE_CREATED` CHECK、`metadata`、`occurred_at`、复合 FK？[PASS] — `data-model.md` §3.1 / §3.2]
- [x] CHK082 数据模型是否没有任何 Out-of-Scope 字段、表、enum、事件类型或关系？[PASS] — `data-model.md` §2.3 / §3.4 / §8]
- [x] CHK083 是否明确不修改 `001_initial_schema.sql`，新 migration 在 Slice 1 final 后追加，不写死序号，只经 reviewed SQL，禁止 `drizzle-kit push`？[PASS] — `plan.md` D-11；`data-model.md` §10；`research.md` R-12]
- [ ] CHK084 migration 顺序是否存在 FK / type / policy 前置依赖错误，且 `plan.md` D-11 与 `data-model.md` §10 的顺序一致？[FAIL] — `plan.md` D-11 写“3) case_events + 复合 FK → 4) 索引（含 partial unique）”，而复合 FK 依赖 `cases_id_family_key` / `UNIQUE (id, family_id)`；`data-model.md` §10 将该唯一约束放在 `case_events` 之前（步骤 5 → 6）。按 `plan.md` 字面顺序执行会在创建 `case_events` 复合 FK 时失败]
- [x] CHK085 2 个 enum、`cases`、`case_events`、索引、RLS / policy、GRANT、既有 CHECK 白名单扩展是否全部列入 migration 内容清单？[PASS] — `data-model.md` §10；`plan.md` D-11 / Data and Migration Impact]
- [x] CHK086 既有匿名 CHECK 扩展是否要求在实现前读取 `pg_constraint` 确认真实约束名，而不是假设默认名？[PASS] — `plan.md` D-11；`data-model.md` §4.3 / §5.4；`research.md` R-12]
- [x] CHK087 回滚 / down 步骤是否覆盖 enum、表、policy、GRANT、既有 CHECK 还原，并标出不可逆点与人工确认？[PASS] — `plan.md` §Rollback / Recovery]
- [x] CHK088 GRANT 是否最小且足够：`cases` / `case_events` 仅 `SELECT, INSERT`，enum `USAGE`，并确认 `families` 具备 `FOR UPDATE` 所需的 UPDATE 权限？[PASS] — `data-model.md` §6.4；`plan.md` D-3.3；`contracts/authorization-rls-and-idempotency.md` §4.3]

## 11. 验证与 Slice 1 Gate

- [x] CHK089 每条 FR-001—FR-025 是否都有至少一个明确的 verification path（测试文件 / DB introspection / contract test）？[PASS] — `plan.md` Verification Plan]
- [x] CHK090 每条 SC-001—SC-011 是否可在不依赖未来 Slice 的前提下被度量？[PASS] — `spec.md` Success Criteria；`plan.md` Verification Plan]
- [ ] CHK091 Acceptance Scenarios 1—16 是否都能追到明确的验证路径，且预期结果与 Plan / Contract 一致？[NEEDS REVIEW] — 16 个场景均有路径，但 Scenario 9 / 13 的预期结果分别与 CHK053 / CHK022 冲突；路径存在不等于预期一致]
- [x] CHK092 验证是否明确区分 HTTP 可达的幂等 replay / 并发同 key 行为与 shared layer 的 MISMATCH → 409 合同，且不伪造 HTTP different-payload 场景？[PASS] — `plan.md` Verification Plan；`contracts/authorization-rls-and-idempotency.md` §5.3 / §8；`quickstart.md` §5.2]
- [x] CHK093 并发是否使用真实 PostgreSQL 多连接验证，schema / RLS 使用真实 introspection，路由使用真实枚举，而不是 mock 或 expected-fail？[PASS] — `plan.md` Technical Baseline / Verification Plan；`quickstart.md` §6]
- [x] CHK094 验证命令是否真实存在或已被显式列为 Gate 补齐项，且 Plan 阶段没有声称这些命令已执行通过？[PASS] — `quickstart.md` §0 声明 Plan 阶段未执行；`plan.md` G10；`research.md` R-16]
- [x] CHK095 G1—G11 是否完整列出，且 G11 明确要求 current-family 语义确定、不得依赖无 `ORDER BY` 的 `rows[0]`，失败时使用精确的 `BLOCKED — SLICE 1 CURRENT FAMILY SEMANTICS NOT STABLE`？[PASS] — `plan.md` §0.2 G11；`quickstart.md` §1]
- [x] CHK096 Slice 1 是否只作为只读依赖，明确不在 Slice 2 分支修改 Slice 1 文件、重新设计其冻结基线或修改正式 Docs？[PASS] — `spec.md` Implementation Dependencies；`plan.md` §0.3 / G2]
- [x] CHK097 R1—R5 是否全部作为 Frozen Technical Decisions 固定，且没有被重新列入 Open Questions？[PASS] — `plan.md` Frozen Technical Decisions；`spec.md` Open Questions: NONE]
- [x] CHK098 是否不存在未解决的 Open Questions / Residual blockers，且 G11 的实现前 Gate 与 Spec 层歧义被明确区分？[PASS] — `spec.md` Open Questions: NONE / Residual blockers: NONE；`plan.md` Blockers: NONE + G11]
- [x] CHK099 Slice 1 baseline 漂移（Head / migration 序号 / 60-of-72 状态）是否通过 Implement 前重新验证处理，而不是在 Plan 中硬编码？[PASS] — `plan.md` §0.1 / §0.2；`research.md` R-16]
- [x] CHK100 本 Slice 是否足够小、可独立实现与独立评审，不需要等待 Participant / Evidence / AI / UI Slice 先行？[PASS] — `spec.md` §Scope / Non-Goals；`plan.md` Complexity Exceptions / Blockers]

---

## Findings

| Severity | CHK | Source | Issue | Return-to-stage |
|---|---|---|---|---|
| BLOCKER | CHK022 | `spec.md` Acceptance Scenario 13 / Acceptance Evidence 第 327 行 vs `plan.md` D-9.1 / `contracts/cases-api.openapi.yaml` CreateCaseRequest / `quickstart.md` §4.1 | 越权字段的预期行为不一致：Spec 证据写“实际落库仍为 OPEN + INTAKE”，Plan / OpenAPI / Quickstart 要求 `422 VALIDATION_ERROR` 且无业务写入 | Spec / Clarify；随后 Plan / Contract 对齐 |
| BLOCKER | CHK084 | `plan.md` D-11 vs `data-model.md` §10 | migration 顺序矛盾：`case_events` 复合 FK 被列在 `cases_id_family_key` / `UNIQUE (id, family_id)` 之前；按 Plan 字面顺序会因缺少被引用唯一键而失败 | Plan |
| BLOCKER | CHK053 | `spec.md` Scenario 9 / FR-024 vs `Docs/V1技术设计.md` §9 | guardian 场景未说明其是否为目标 Family 成员 / Family 是否已解析；非成员 guardian 无法命中 403 / 404 CASE_*，应按 FR-024 / R5 返回 Slice 1 Family 语义 | Spec / Clarify |
| MINOR | CHK034 | `data-model.md` §2.2 / `research.md` R-10；`contracts/cases-api.openapi.yaml` list description | 未来 CLOSED 历史 primary 与 API `primary` 唯一识别的语义未区分；本 Slice 无 CLOSED 路径，暂不阻断 | Plan（未来 Close / switch-primary Slice 必须定义） |
| MINOR | CHK043 | `plan.md` D-5.3 / `research.md` R-4 | “HTTP 层不可达”未显式限定同一 canonical family context；`familyId` 进入 hash，跨 Family 同 key 会产生 MISMATCH | Plan（补充前提说明，不改变 R1/R4 结论） |
| MINOR | CHK068 | `data-model.md` §3.1 / §3.2；`contracts/case-events-and-business-audit.md` §2.1 | `metadata` 只允许 `{primary, version}` 没有 DB CHECK 或验证路径，无法从证据上证明不含正文 / PII | Plan（增加 CHECK 或明确应用层校验与测试） |
| MINOR | CHK077 | `contracts/cases-api.openapi.yaml` GET detail 404 | 404 / 403 错误码主要靠描述文字，`CaseNotFound` 组件定义但未引用；契约未结构固定 `code` | Plan（引用组件或增加 enum / example 约束） |
| MINOR | CHK091 | `spec.md` Acceptance Evidence；`plan.md` Verification Plan | 16 个场景路径存在，但 Scenario 9 / 13 的预期结果分别与 CHK053 / CHK022 冲突，验证路径不能直接生成一致的 Tasks 期望 | Spec / Clarify（与 CHK022 / CHK053 合并处理） |

---

## Review Decision

- **Total CHK**: 100
- **PASS**: 92
- **FAIL**: 3（CHK022、CHK053、CHK084）
- **NEEDS REVIEW**: 5（CHK034、CHK043、CHK068、CHK077、CHK091）
- **Decision**: **BLOCKED — return to Spec / Plan before Tasks**

> 结论：Spec / Plan 在 Case Core 的产品边界、授权、RLS、幂等与事务主路径上整体清晰，但存在 3 个必须先在上游收口的阻断项：
> 1. 越权字段的预期行为（422 vs 落库）在 Spec 证据与 Plan / Contract 之间矛盾；
> 2. migration 的 `case_events` 复合 FK 与 `cases` 唯一键顺序在 Plan 与 Data Model 之间矛盾；
> 3. guardian 场景缺少“目标 Family 已解析 / 是否为成员”的前提，导致 403 / 404 预期与 FR-024 / R5 冲突。
>
> 在上述三项被修正并重新对齐前，不应生成 Tasks，更不能进入 Implement。

## Review Log

| 日期 | 事件 | 影响条目 |
|---|---|---|
| 2026-11-05 | Checklist 生成（100 条）；完成 Spec / Plan / Research / Data Model / Contracts / Quickstart 交叉核对 | 全部 |
| 2026-11-05 | 发现越权字段 Spec 证据与 Plan / Contract 不一致 | CHK022、CHK091 |
| 2026-11-05 | 发现 migration 复合 FK 与唯一键顺序不一致 | CHK084 |
| 2026-11-05 | 发现 guardian 场景缺少 Family 解析前提 | CHK053、CHK091 |
| 2026-11-05 | 判定：BLOCKED — 不进入 Tasks | 全部 |