# Tasks: Case 核心地基（`cases` / `case_events` / 单一主要 Case）

**Feature**: `specs/002-case-core/spec.md`
**Plan / 契约基线**: `plan.md`、`research.md`、`data-model.md`、`contracts/**`、`quickstart.md`、`checklists/requirements-quality.md`
**Branch**: `feat/002-case-core`
**Tasks 生成时 Head**: `1fc82c97e687bb73cb3048bb92240805f34880da`
**Docs baseline**: `Docs/V1产品需求.md` v3.3、`Docs/V1技术设计.md` v3.8
**阶段**: **Tasks only**。本文件只把已冻结的 Spec / Plan 拆成可执行任务图；**不进入 Analyze / Implement**，不修改业务代码、migration、tests、Spec、Plan、Contracts、Checklist 或 `Docs/**`。

> **两种语境，不得混用（重要）**
> - **本轮 = Tasks authoring**：只编辑本文件。本轮要求 `Docs/**`、Spec / Plan / Research / Data Model / Contracts / Checklist、业务代码、migration、测试代码的 diff 均为 0。该要求**只约束本轮**，不是 T085 的验收条件。
> - **T001–T087 = 未来 Implement 执行**：这些任务描述另一个 AI 在 Implement 阶段如何操作。届时业务代码、新 migration、tests、generated OpenAPI / types、`guard-static` 合法增量、本文件的 checkbox `[x]` 与 completion / evidence 状态**都是预期存在的改动**。T085 只要求这些改动**可追溯到具体 Task**，不要求 diff = 0。
> - **阶段顺序**：Specify → Clarify → Plan → Checklist → Tasks → **Analyze** → Implement → **独立 Converge**。Analyze 在 Implement **之前**；T087 是 Implement 的终点，其输出移交给一个**全新的独立 AI** 做 Converge / final review / CI verification。
> - **本轮结束状态**：`SLICE 2 TASKS FINAL — READY FOR ANALYZE`（见文末）。
> - **Implement 结束状态**：`IMPLEMENT COMPLETE — READY FOR INDEPENDENT CONVERGE`（由 T087 输出）。

> **任务格式**：`- [x] T### [P] [REQ:<上游 ID / 章节>] <动作、文件/目录、前置依赖、完成条件> [VERIFY:<真实命令或证据>]`
> `[P]` 仅表示：在所列前置全部完成后，与同批次其它 `[P]` 任务无文件冲突、无未完成依赖，可并行执行。
> 每个任务必须同时具备 `[REQ:...]` 与 `[VERIFY:...]`；缺少任一项即无效。

---

## 0. Implement Gate（硬前置，T013 起不得执行）

> 以下 11 项是 `plan.md` §0.2 的 G1–G11。**任一失败即停止**，不得在 Slice 2 私建替代基础设施。
> 失败文案固定为：`BLOCKED — SLICE 1 IMPLEMENTATION DEPENDENCY`；G11 失败固定为：`BLOCKED — SLICE 1 CURRENT FAMILY SEMANTICS NOT STABLE`。

- [x] T001 [REQ:plan:G1] 现场验证 G1：Slice 1 已正式合并到 main；记录 `<slice1-final-head>`、`origin/main` 实际 SHA 与判定结果（依赖 ∅） [VERIFY:`git fetch origin` 后执行 `git merge-base --is-ancestor <slice1-final-head> origin/main` 退出 0；保留两条 SHA 输出]
- [x] T002 [REQ:plan:G2] 现场验证 G2：在 `feat/002-case-core` 上**普通 merge** 最新 `origin/main`，禁止 rebase / force push；冲突按正常 merge 解决后重跑 governance 与测试并普通 push（依赖 T001） [VERIFY:`git merge-base --is-ancestor origin/main HEAD` 退出 0；`git status --short` clean；`git log --oneline -1` 为 merge / fast-forward 记录]
- [x] T003 [REQ:plan:G3] 现场验证 G3：Slice 1 final schema / migration 与 Plan 假设一致：`families.created_by_person_id NOT NULL UNIQUE`、`family_members` UNIQUE、`business_audit_events` / `idempotency_keys` 列与 CHECK 真实存在、`schema_migrations` 记录一致（依赖 T002） [VERIFY:`psql "$MIGRATION_DATABASE_URL" -c "\d families" -c "\d family_members" -c "\d business_audit_events" -c "\d idempotency_keys"` 输出逐项核对；`SELECT filename FROM schema_migrations ORDER BY filename` 与 Slice 1 文件一致]
- [x] T004 [REQ:plan:G4] 现场验证 G4：`authorize()` final shape 可增量扩 Case，且现有 Family / Consent 行为测试 green（依赖 T002） [VERIFY:`bunx vitest run tests/domain/authorization.test.ts tests/domain` 全绿；记录 `Action` / `Purpose` / `case` 维度现状]
- [x] T005 [REQ:plan:G5] 现场验证 G5：`withRlsTransaction` 签名仍为 `(pool, {familyId, accountId, personId, purpose}, fn)` 且事务内 `set_config(..., true)`；`xiaoshuyin_app` 对 `families` 具备 `UPDATE`（`SELECT ... FOR UPDATE` 前提）（依赖 T002） [VERIFY:`rg "export async function withRlsTransaction" apps/server/api/src/db/tx.ts`；`psql -c "SELECT has_table_privilege('xiaoshuyin_app','families','UPDATE')"` 返回 t]
- [x] T006 [REQ:plan:G6] 现场验证 G6：`idempotency_keys` final behavior 全绿：同 key 同 hash → 原结果；同 key 异 hash → 409（shared contract）；身份级 RLS；lookup / insert / replay 均在 identity 上下文事务内（依赖 T002） [VERIFY:`bunx vitest run tests/domain/idempotency-hash.test.ts tests/integration/idempotency.test.ts`（存在即运行）；并记录 `rg "pool.query|withIdentityTransaction|withRlsTransaction" apps/server/api/src/routes/families.ts` 的实际上下文]
- [x] T007 [REQ:plan:G7] 现场验证 G7：`business_audit_events` final structure 全绿：`event_type` / `resource_type` 为 reviewed CHECK、family 级 RLS、追加语义可用（依赖 T002） [VERIFY:`psql -c "\d business_audit_events"`；`SELECT policyname, tablename FROM pg_policies WHERE tablename='business_audit_events'` 输出]
- [x] T008 [REQ:plan:G8] 现场验证 G8：RLS / roles / cross-family tests 全绿：`relrowsecurity` / `relforcerowsecurity`、`rolbypassrls=false`、owner 非 app、无上下文零行、跨家庭零行（依赖 T002） [VERIFY:`bunx vitest run tests/db/rls.test.ts tests/db/roles.test.ts` 全绿；保留查询输出]
- [x] T009 [REQ:plan:G9;R1] 现场验证 G9：`packages/contracts` Zod 为代码侧单事实源；OpenAPI 可由其生成且 `openapi:check` 无意外 diff；幂等键 transport 在 OpenAPI 与 runtime 一致；若 Slice 1 final 改为 header，触发 Plan Review（R1 变更条件）（依赖 T002） [VERIFY:`bun run openapi:check` PASS；`rg "idempotencyKey" packages/contracts/src/schemas.ts apps/server/api/src/routes` 与生成 OpenAPI 比对，记录 body/header 结论]
- [x] T010 [REQ:plan:G10] 现场验证 G10：Slice 1 final CI 全 job green、independent converge PASS；`package.json` 引用的验证脚本真实存在（依赖 T002） [VERIFY:CI workflow run 链接 5/5 success；converge 报告无未解决 gap；`ls scripts/db-migrate.mjs scripts/guard-static.mjs scripts/openapi-generate.mjs scripts/openapi-check.mjs`]
- [x] T011 [REQ:plan:G11] 现场验证 G11：current Family 解析具备确定性；对属于 ≥2 Family 的 actor 重复请求结果一致且可解释；不得依赖无 `ORDER BY` 的 `rows[0]`（依赖 T002） [VERIFY:至少 5 次 `GET /api/v1/families/current` 结果一致；`rg "getCurrentFamily|ORDER BY" packages/domain/src/repository.ts apps/server/api/src/routes/families.ts` 显示确定性依据；失败即 `BLOCKED — SLICE 1 CURRENT FAMILY SEMANTICS NOT STABLE`]
- [x] T012 [REQ:plan:0.2] Gate 判定与阻断协议：逐项记录 G1–G11 结果；任一失败按固定文案停止，**不得开始 T013**（依赖 T003–T011） [VERIFY:11 项结果清单；失败项现场输出与 `BLOCKED` 文案；全部 PASS 才允许进入 Phase 1]

---

## Phase 1 — Baseline Alignment（Gate 通过后，只读对齐，不重新设计 Slice 1）

目标：确认最终 migration 编号、既有 CHECK 真实约束名、contracts / authorize / error handler / current Family / CI 脚本的真实形状，并确定 Case 数据访问边界。只做必要 baseline alignment。

> **Implement base 记录**：进入 Phase 1 之前（T013 执行前），Implement AI 必须记录 `IMPLEMENT_BASE_SHA=$(git rev-parse HEAD)` 并归档到 T085 证据链。T085 的所有 diff 分类都以该 SHA 为基线，**不以 `origin/main` 为基线，也不要求 diff 为 0**。

- [x] T013 [REQ:plan:D-11;FR-002] 确定 Slice 2 reviewed migration 文件名与编号：读取 `db/migrations/`，按 Slice 1 final 实际编号取下一个序号，命名为 `<next-after-slice1-final>_case_core.sql`；不修改 `001_initial_schema.sql`（依赖 T012） [VERIFY:`ls db/migrations` 输出；目标文件名在仓库中不存在；`git diff --name-only origin/main -- db/migrations/001_initial_schema.sql` 为空]
- [x] T014 [P] [REQ:plan:D-11;data-model:§4.3/§5.4] 读取 `pg_constraint` 确认 `business_audit_events.event_type`、`business_audit_events.resource_type`、`idempotency_keys.command_type` 的真实约束名；不得假设默认名（依赖 T012） [VERIFY:`SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid IN ('business_audit_events'::regclass,'idempotency_keys'::regclass)` 输出真实名字]
- [x] T015 [P] [REQ:plan:G9;§27A] 确认 `packages/contracts/src/schemas.ts` 当前 shape 与导出方式；确认新增 Case schema 不修改既有 schema（依赖 T012） [VERIFY:`rg "export const" packages/contracts/src/schemas.ts`；`git diff --name-only origin/main -- packages/contracts/src/schemas.ts` 当前为空]
- [x] T016 [P] [REQ:plan:G4;D-6] 确认 `authorize()` final implementation 与既有 domain 测试；记录 `case: null`、`MANAGER_ACTIONS` 分支、`FamilyInfo` 的真实形状（依赖 T012） [VERIFY:`rg "case:|MANAGER_ACTIONS|isFamilyManager" packages/authorization/src/authorize.ts`；`bunx vitest run tests/domain/authorization.test.ts` 绿]
- [x] T017 [P] [REQ:plan:D-6.5] 确认 `error-handler.ts` 当前错误码映射；确认 `CASE_NOT_FOUND` / `CASE_ACCESS_DENIED` 尚不存在，既有 `CURRENT_FAMILY_NOT_FOUND` / `VALIDATION_ERROR` / `IDEMPOTENCY_PAYLOAD_MISMATCH` 存在（依赖 T012） [VERIFY:`rg "CASE_|CURRENT_FAMILY_NOT_FOUND|VALIDATION_ERROR|IDEMPOTENCY_PAYLOAD_MISMATCH" apps/server/api/src/plugins/error-handler.ts` 输出]
- [x] T018 [P] [REQ:plan:D-6.5;R5] 确认 current Family 的调用点与错误码：`getCurrentFamily`、`CURRENT_FAMILY_NOT_FOUND`；Case 端点复用同一语义，不定义第二套 Family 错误码（依赖 T012） [VERIFY:`rg "getCurrentFamily|CURRENT_FAMILY_NOT_FOUND" apps packages tests` 输出]
- [x] T019 [P] [REQ:plan:G10] 确认 CI 与验证脚本真实存在且命令名与 `quickstart.md` 一致（依赖 T012） [VERIFY:`ls scripts/db-migrate.mjs scripts/guard-static.mjs scripts/openapi-generate.mjs scripts/openapi-check.mjs`；`jq .scripts package.json`]
- [x] T020 [P] [REQ:plan:D-1.2;guard:R4] 确定 Case 数据访问归属：所有 `cases` / `case_events` SQL 放在 `packages/domain`（建议新增 `packages/domain/src/cases.ts`），`apps/` 路由只调用 repository；不新建第二套 scope checker（依赖 T012） [VERIFY:`rg "FAMILY_TABLES" scripts/guard-static.mjs` 确认 R4；设计约束记录：`apps/` 内不得出现 `FROM cases` / `INTO cases` / `UPDATE cases`]

---

## Phase 2 — Failing Tests（RED，test-first；只写测试，不写实现）

目标：在 migration 与实现之前，先定义可执行的结构 / 权限 / 授权 / 契约 / scope 期望。每个 RED 任务必须记录“失败原因是目标产物尚不存在”，不得把环境故障当 RED。

- [x] T021 [P] [REQ:FR-001;FR-002;FR-003;FR-013;CHK080] 新增 `tests/db/cases-schema.test.ts`：断言两表存在；`cases` 列集合恰为 `id, family_id, created_by_person_id, status, phase, is_primary, version, created_at, updated_at`；`case_events` 列集合恰为 `id, family_id, case_id, actor_account_id, event_type, metadata, occurred_at`；两表 `id` 默认 `uuidv7()`；`case_status` / `case_phase` 词汇与顺序；`UNIQUE (id, family_id)`；`cases_one_primary_open_per_family` partial unique 谓词；`version >= 1`；`title/summary/description/problem_description` 不存在（依赖 T013、T014、T020） [VERIFY:`bunx vitest run tests/db/cases-schema.test.ts` 运行并预期 RED；失败原因是目标 schema 不存在，保留输出]
- [x] T022 [P] [REQ:FR-011;CHK055;CHK057] 新增 `tests/db/cases-rls.test.ts`：两表 `relrowsecurity=true`、`relforcerowsecurity=true`；`xiaoshuyin_app` 非 owner、`rolbypassrls=false`；无 `app.family_id` → SELECT 0 行 / INSERT 拒绝；错误 Family → 0 行；正确 Family → 只见本 Family；RLS 不含 manager 判定（依赖 T013、T020） [VERIFY:`bunx vitest run tests/db/cases-rls.test.ts` 预期 RED，保留输出]
- [x] T023 [P] [REQ:FR-001;FR-014;CHK068] 新增 `tests/db/cases-events-metadata.test.ts`：`case_events_metadata_shape_check` 存在；合法 `{primary:true,version:1}` 通过；额外 key（title / description / PII）、非 object、缺 key、空对象、非 boolean `primary`、非 integer-compatible `version`、`version < 1` 均被拒；`event_type` 仅 `CASE_CREATED`（依赖 T013、T014） [VERIFY:`bunx vitest run tests/db/cases-events-metadata.test.ts` 预期 RED，保留输出]
- [x] T024 [P] [REQ:FR-006;FR-007;SC-002;场景3] 新增 `tests/db/cases-primary-concurrency.test.ts`：真实 PostgreSQL 多连接、同 Family、两个不同 idempotency key 并发；期望两条 Case 均成功、一个 `is_primary=true`、一个 `false`、`is_primary AND status <> 'CLOSED'` 计数 = 1、每条各 1 条 `case_event` / `business_audit_event`（依赖 T013、T020） [VERIFY:`bunx vitest run tests/db/cases-primary-concurrency.test.ts` 预期 RED（表不存在），保留输出]
- [x] T025 [P] [REQ:FR-011;CHK055;CHK066;CHK088] 扩展 `tests/db/roles.test.ts`：保留原 10 表断言；新增 `cases` / `case_events` 的 owner 检查；新增独立断言：`xiaoshuyin_app` 对两表仅有 `SELECT, INSERT`（`UPDATE` / `DELETE` 必为 false）；`case_status` / `case_phase` `USAGE=true`；**不得**把新表塞进原四权限循环，不得删除旧断言（依赖 T013、T014） [VERIFY:`bunx vitest run tests/db/roles.test.ts` 预期 RED（新表不存在），保留输出]
- [x] T026 [P] [REQ:FR-011;CHK055] 扩展 `tests/db/rls.test.ts`：表计数 9→11、policy 计数 9→11；保留逐表 FORCE 断言；新增 `cases_family_scope` / `case_events_family_scope` 的 `USING` / `WITH CHECK` 断言；不得改成宽松 wildcard（依赖 T013） [VERIFY:`bunx vitest run tests/db/rls.test.ts` 预期 RED（计数仍为 9），保留输出]
- [x] T027 [P] [REQ:FR-002;FR-003;plan:G10] 扩展 `tests/db/migration-repro.test.ts`：enum 8→10、table 10→12、policy 9→11；新增 `case_status` / `case_phase` 枚举值断言；保留旧断言与第二次 apply no-op 检查；不得删除任何旧断言（依赖 T013） [VERIFY:`bunx vitest run tests/db/migration-repro.test.ts` 预期 RED（计数与枚举不匹配），保留输出]
- [x] T028 [P] [REQ:FR-012;§8.5] 扩展 `tests/domain/idempotency-hash.test.ts` 的 shared contract 用例：`CASE_CREATE` canonical context 为 `{familyId: verifiedCurrentFamilyId, body: {}}`；`actor` / `command_type` 不进入 hash；same scope key + different `request_hash` → `MISMATCH` → 映射 `409 IDEMPOTENCY_PAYLOAD_MISMATCH`；不改原结果；不得换 actor、伪造 Family 或新增无意义 body 字段（依赖 T015） [VERIFY:`bunx vitest run tests/domain/idempotency-hash.test.ts` 预期 RED（repository/service contract 未实现），保留输出]
- [x] T029 [P] [REQ:FR-008;FR-009;D-6.2] 新增 `tests/domain/case-authorization.test.ts` RED：manager allow；非 manager deny `NOT_FAMILY_MANAGER`；`family.createdByPersonId` 缺失 deny；`family=null` → `FAMILY_CONTEXT_REQUIRED`；`purpose != FAMILY_MANAGEMENT` → `UNSUPPORTED_PURPOSE`；unknown action → `UNSUPPORTED_ACTION`；`CASE_CREATE` / `CASE_LIST` + `case != null` → `UNSUPPORTED_DIMENSION`；`CASE_READ` + `case == null` → `CASE_CONTEXT_REQUIRED`；非 Case 动作 `case != null` 仍 `UNSUPPORTED_DIMENSION`（依赖 T016） [VERIFY:`bunx vitest run tests/domain/case-authorization.test.ts` 预期 RED，保留输出]
- [x] T030 [P] [REQ:FR-015;FR-016;FR-017;§28.3] 新增 `tests/domain/case-contracts.test.ts` RED：`CreateCaseRequest` strict 只接受 `idempotencyKey`（8–128）；`familyId` / `createdByPersonId` / `creator` / `status` / `phase` / `primary` / `isPrimary` / `version` / `title` / `summary` / `description` / `problemDescription` 均拒绝；`CaseResponse` 恰为 `id,status,phase,primary,version,createdAt,updatedAt`；`CaseListResponse` 为 `{items}`；`CaseStatus` / `CasePhase` 完整词汇（依赖 T015） [VERIFY:`bunx vitest run tests/domain/case-contracts.test.ts` 预期 RED，保留输出]
- [x] T031 [P] [REQ:FR-005;FR-018;FR-020;SC-008] 新增 `tests/integration/cases-scope.test.ts` RED：路由枚举恰为 3 条 Case 端点；不存在 `/cases/current`、pause、resume、switch-primary、close、recurrences、messages、assessments、participants；DB introspection 不存在 `case_participants`、`assertions`、`observations`、`problem_formulations`、`scene_node_states`、`scene_artifacts`、`dialogue_messages`、Safety / Plan / Task / Notification 表；`cases` 无禁止列；`case_events.event_type` 仅 `CASE_CREATED`（依赖 T013、T017、T020） [VERIFY:`bunx vitest run tests/integration/cases-scope.test.ts` 预期 RED，保留输出]

---

## Phase 3 — Reviewed Migration（单一文件，**全串行**；中途不得 apply）

> 本 Phase 的 T032–T041 **全部编辑同一份 `<next-after-slice1-final>_case_core.sql`**，任务之间禁止并行。为保持 reviewed migration 的原子性，**不得在每个任务中途运行 `bun run db:migrate`**；只在 T042 一次性 apply 到空 schema 测试库。
> 顺序严格冻结：enum → `cases` → `cases` 自身约束 → `cases` 索引 → `case_events` → `case_events` 索引 / metadata CHECK → ENABLE/FORCE RLS → policies → GRANT → 既有 CHECK 扩展。

- [x] T032 [REQ:FR-003;data-model:§1] 在 `<next-after-slice1-final>_case_core.sql` 写入 `CREATE TYPE case_status`（OPEN, WAITING, PAUSED, LOST_CONTACT, SAFETY_HOLD, CLOSED）与 `CREATE TYPE case_phase`（INTAKE, ASSESSMENT, PROBLEM_FORMULATION, GOALS, PLANNING, EXECUTION, REVIEW, MAINTENANCE, CLOSED），顺序严格照 §6.1 / §6.2（依赖 T031） [VERIFY:`rg -n "CREATE TYPE case_status|CREATE TYPE case_phase" <next-after-slice1-final>_case_core.sql` 显示两类型先于任何 `CREATE TABLE`]
- [x] T033 [REQ:FR-001;FR-002;FR-004;data-model:§2.1] 接着写入 `CREATE TABLE cases`：9 列（`id uuid PK DEFAULT uuidv7()`、`family_id uuid NOT NULL`、`created_by_person_id uuid NOT NULL`、`status case_status NOT NULL`、`phase case_phase NOT NULL`、`is_primary boolean NOT NULL`、`version integer NOT NULL`、`created_at timestamptz NOT NULL DEFAULT now()`、`updated_at timestamptz NOT NULL DEFAULT now()`）；**不得**增加 title / summary / description / problem_description / 任何内容列（依赖 T032） [VERIFY:`rg -n "CREATE TABLE cases"` 位置在 enum 之后；列清单逐项核对 `data-model.md` §2.1]
- [x] T034 [REQ:FR-006;FR-013;data-model:§2.2] 为 `cases` 添加自身约束：`PRIMARY KEY (id)`、`UNIQUE (id, family_id)`（`cases_id_family_key`）、`CHECK (version >= 1)`（`cases_version_check`）、`family_id` FK `families(id) ON DELETE RESTRICT`、`created_by_person_id` FK `persons(id) ON DELETE RESTRICT`（依赖 T033） [VERIFY:`rg -n "cases_id_family_key|cases_version_check|REFERENCES families|REFERENCES persons"` 输出；`UNIQUE (id, family_id)` 先于任何 `case_events` 复合 FK]
- [x] T035 [REQ:FR-006;FR-007;data-model:§2.2] 为 `cases` 建索引：`cases_one_primary_open_per_family`（`UNIQUE (family_id) WHERE is_primary AND status <> 'CLOSED'`）、`cases_family_list_idx`（`family_id, is_primary DESC, created_at ASC`）、`cases_family_status_idx`（`family_id, status`）（依赖 T034） [VERIFY:`rg -n "cases_one_primary_open_per_family|WHERE is_primary AND status"` 谓词与 `data-model.md` §2.2 一致]
- [x] T036 [REQ:FR-001;FR-014;data-model:§3.1] 接着写入 `CREATE TABLE case_events`：`id uuid PK DEFAULT uuidv7()`、`family_id uuid NOT NULL`、`case_id uuid NOT NULL`、`actor_account_id uuid NOT NULL`、`event_type text NOT NULL CHECK (event_type IN ('CASE_CREATED'))`、`metadata jsonb NOT NULL`（无默认值）、`occurred_at timestamptz NOT NULL DEFAULT now()`；含 `case_events_case_family_fk` 复合 FK `(case_id, family_id) REFERENCES cases (id, family_id)`、`case_events_actor_fk` → `accounts(id)`（依赖 T035） [VERIFY:`rg -n "CREATE TABLE case_events|case_events_case_family_fk|REFERENCES cases"` 输出；复合 FK 在 `cases` 的 `UNIQUE (id, family_id)` 之后]
- [x] T037 [REQ:FR-014;CHK068;data-model:§3.2] 为 `case_events` 建索引 `case_events_case_time_idx`、`case_events_family_time_idx`，并写 `case_events_metadata_shape_check`：JSON object、key 集合恰为 `{primary, version}`、`primary` boolean、`version` integer-compatible 且 `>= 1`、无默认值；不得引入通用 JSON Schema engine（依赖 T036） [VERIFY:`rg -n "case_events_metadata_shape_check|jsonb_typeof|metadata - 'primary' - 'version'"` 输出；CHECK 表达式逐项对齐 `data-model.md` §3.2]
- [x] T038 [REQ:FR-011;data-model:§6.1] 对 `cases` 与 `case_events` 执行 `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`（依赖 T037） [VERIFY:`rg -n "ENABLE ROW LEVEL SECURITY|FORCE  ROW LEVEL SECURITY"` 输出两表各两行]
- [x] T039 [REQ:FR-011;data-model:§6.2] 建 policies：`cases_family_scope`（`USING (family_id = app_family_id())` / `WITH CHECK` 同左）、`case_events_family_scope`（同左）；不在 policy 中加入 manager / participant / purpose 判定（依赖 T038） [VERIFY:`rg -n "CREATE POLICY cases_family_scope|CREATE POLICY case_events_family_scope|app_family_id"` 输出]
- [x] T040 [REQ:FR-011;CHK088;data-model:§6.4] GRANT：`xiaoshuyin_app` 对 `cases` / `case_events` 只授予 `SELECT, INSERT`（**不授予 UPDATE / DELETE**）；对 `case_status` / `case_phase` 授予 `USAGE`（依赖 T039） [VERIFY:`rg -n "GRANT SELECT, INSERT ON cases|GRANT USAGE ON TYPE case_status"` 输出；不得出现 `GRANT UPDATE` / `GRANT DELETE` 新表行]
- [x] T041 [REQ:plan:D-11;data-model:§4.3/§5.4] 最后扩展既有 CHECK 白名单：用 **T014 查到的真实约束名** 对 `business_audit_events.event_type` / `resource_type`、`idempotency_keys.command_type` 执行 `DROP CONSTRAINT` + `ADD CONSTRAINT`，加入 `CASE_CREATED` / `CASE` / `CASE_CREATE`；不新增列、不建第二套审计 / 幂等表（依赖 T040） [VERIFY:`rg -n "DROP CONSTRAINT|ADD CONSTRAINT|CASE_CREATED|CASE_CREATE"` 输出；约束名与 T014 记录一致]
- [x] T042 [REQ:FR-002;FR-011;CHK084] 在**空 schema 测试库**一次性应用 migration 并让 DB RED 测试转绿：`bun run db:migrate` 一次 APPLY；第二次全 SKIP；`tests/db/cases-schema.test.ts`、`cases-rls.test.ts`、`cases-events-metadata.test.ts`、`cases-primary-concurrency.test.ts` 的结构部分、`roles.test.ts`、`rls.test.ts`、`migration-repro.test.ts` 转绿（依赖 T041、T021–T027） [VERIFY:`bun run db:migrate` 输出 APPLY 与 Migration complete；再次运行全 SKIP；`bunx vitest run tests/db/cases-schema.test.ts tests/db/cases-rls.test.ts tests/db/cases-events-metadata.test.ts tests/db/roles.test.ts tests/db/rls.test.ts tests/db/migration-repro.test.ts` 全绿]

---

## Phase 4 — Domain / Contracts Implementation（GREEN；不同文件可并行）

目标：实现纯函数与 repository 基础设施，让 domain RED 转绿；不实现路由，不改变既有 Family / Consent 行为。

- [x] T043 [P] [REQ:FR-023;FR-024;plan:D-6.5] 在 `apps/server/api/src/plugins/error-handler.ts` 的 `ERROR_MAP` 增加 `CASE_NOT_FOUND: 404`、`CASE_ACCESS_DENIED: 403`；不改变既有映射，不新增 Family 错误码（依赖 T017） [VERIFY:`rg "CASE_NOT_FOUND|CASE_ACCESS_DENIED" apps/server/api/src/plugins/error-handler.ts`；`bun run typecheck` 通过]
- [x] T044 [P] [REQ:FR-008;FR-009;plan:D-6.2] 扩展 `packages/authorization/src/authorize.ts`：`Action` 加 `CASE_CREATE` / `CASE_LIST` / `CASE_READ`；`Resource` 加 `CASE`；`AuthInput.case` 改为 `{ caseId: string } | null`；`AuthInput.family` 加可选 `createdByPersonId`；`DenyReason` 加 `CASE_CONTEXT_REQUIRED`；按 D-6.2 顺序 fail-closed；**不新建 `authorizeCase()`**；非 Case 动作保持既有行为（依赖 T029、T016） [VERIFY:`bunx vitest run tests/domain/case-authorization.test.ts tests/domain/authorization.test.ts` 全绿]
- [x] T045 [P] [REQ:FR-015;FR-016;FR-017;§28.3] 在 `packages/contracts/src/schemas.ts` 新增 `CreateCaseRequest`（Zod strict，`idempotencyKey` 8–128）、`CaseResponse`、`CaseListResponse`、`CaseStatus`、`CasePhase`；不修改既有 schema（依赖 T030、T015） [VERIFY:`bun run typecheck`；`bunx vitest run tests/domain/case-contracts.test.ts` 绿]
- [x] T046 [P] [REQ:FR-012;§8.5] 在 `packages/domain/src/idempotency.ts` 的 `IdempotencyCommandType` 加入 `CASE_CREATE`；不改变 `canonicalJson` / `hashPayload` / `decideIdempotency` 语义（依赖 T028） [VERIFY:`bunx vitest run tests/domain/idempotency-hash.test.ts` 绿；`bun run typecheck` 通过]
- [x] T047 [REQ:FR-006;FR-007;FR-016;plan:D-3.2] 新增 `packages/domain/src/cases.ts`（或同包 repository）实现：`lockFamilyForPrimaryDecision(tx, familyId)`（`SELECT id FROM families WHERE id = $1 FOR UPDATE`）、`existsCurrentPrimary(tx, familyId)`（**独立语句**）、`insertCase(tx, {familyId, createdByPersonId, isPrimary})`（显式 `OPEN` / `INTAKE` / `version=1`）、`getCaseById(tx, caseId)`、`listCases(tx, familyId)`（`ORDER BY is_primary DESC, created_at ASC, id ASC`）；全部参数化，不放在 `apps/`（依赖 T042、T020） [VERIFY:`bun run typecheck`；`rg "FOR UPDATE|ORDER BY is_primary DESC" packages/domain/src/cases.ts` 输出]
- [x] T048 [REQ:FR-014;CHK064] 在同一 `packages/domain/src/cases.ts` 增加 `insertCaseEvent(tx, {familyId, caseId, actorAccountId, primary, version})` 显式写 `CASE_CREATED` 与 metadata `{primary, version}`；增加 `insertCaseAudit(tx, {familyId, caseId, actorAccountId, primary, version})` 写 `business_audit_events` 的 `CASE_CREATED` / `CASE`；职责不同不得合并（依赖 T047） [VERIFY:`rg "CASE_CREATED|resource_type|metadata" packages/domain/src/cases.ts`；`bun run typecheck`]
- [x] T049 [REQ:FR-012;plan:D-5.4] 在同一 `packages/domain/src/cases.ts` 增加幂等占位 / 读取 / 回填：`reserveIdempotency`（`INSERT ... ON CONFLICT (actor_account_id, command_type, idempotency_key) DO NOTHING RETURNING id`，占位 `response_status=0`、`response_body='{}'`）、`getReservedIdempotency`（`FOR SHARE`）、`completeIdempotency`（同一事务回填 `201` + response body）；全部在 `withRlsTransaction` 内使用（依赖 T048） [VERIFY:`rg "ON CONFLICT|FOR SHARE|response_status = 0" packages/domain/src/cases.ts`；`bun run typecheck`]

---

## Phase 5 — Case Create（TDD：集成 RED → 实现 → 转绿）

- [x] T050 [P] [REQ:FR-008;FR-009;FR-024;D-6;场景8/9A/9B] 新增 `tests/integration/cases-authorization.test.ts` RED，显式两组：**A 组**（Family member + guardian + non-manager）create/list `403 CASE_ACCESS_DENIED`、detail `404 CASE_NOT_FOUND`；**B 组**（guardian non-member）current Family 未解析，沿用 Slice 1 `CURRENT_FAMILY_NOT_FOUND`，响应无 Case 字段，**不出现** `CASE_ACCESS_DENIED` / `CASE_NOT_FOUND`；另含 manager allow（依赖 T042、T043、T044、T045） [VERIFY:`bunx vitest run tests/integration/cases-authorization.test.ts` 预期 RED（端点未实现），保留输出]
- [x] T051 [P] [REQ:FR-004;FR-006;FR-007;FR-015;SC-001;SC-003] 新增 `tests/integration/cases-create.test.ts` RED：首 Case `primary=true` / `OPEN` / `INTAKE` / `version=1` / Family 归属正确；第二 Case `primary=false`；携带 `familyId` / `creator` / `status` / `phase` / `primary` / `version` / `title` 等未声明字段 → `422 VALIDATION_ERROR` 且 `cases` / `case_events` / `business_audit_events` / `idempotency_keys` 零新增；响应无 `familyId` / creator / 内容字段（依赖 T042、T043、T045） [VERIFY:`bunx vitest run tests/integration/cases-create.test.ts` 预期 RED（端点未实现），保留输出]
- [x] T052 [REQ:FR-012;FR-014;plan:D-4] 实现 `apps/server/api/src/routes/cases.ts` 的 `POST /api/v1/cases`，严格按唯一冻结顺序：认证 → 解析 current Family（identity 上下文，0 行 → `CURRENT_FAMILY_NOT_FOUND`）→ `withRlsTransaction`（purpose `FAMILY_MANAGEMENT`）→ 读 `families.created_by_person_id` → `authorize(CASE_CREATE)`（DENY → `403 CASE_ACCESS_DENIED`）→ 幂等占位 / REPLAY / `409 IDEMPOTENCY_PAYLOAD_MISMATCH` → `SELECT ... FOR UPDATE` 锁 Family → 独立 `EXISTS` 判定 → 插 Case → 插 `case_event` → 插 `business_audit_event` → 回填幂等响应 → COMMIT → 201；**不得**捕获 23505 转 201/409（依赖 T047、T048、T049、T043、T044、T045） [VERIFY:`bun run typecheck`；`rg "FOR UPDATE|existsCurrentPrimary|insertCaseEvent|insertCaseAudit|completeIdempotency" apps/server/api/src/routes/cases.ts` 顺序与 D-4 一致]
- [x] T053 [REQ:plan:D-1.2] 在 `apps/server/api/src/app.ts` 注册 `registerCaseRoutes(app, pool)`；不改变既有路由注册顺序与行为（依赖 T052） [VERIFY:`rg "registerCaseRoutes" apps/server/api/src/app.ts`；`bun run typecheck`]
- [x] T054 [REQ:FR-004;FR-006;FR-007;SC-001] 运行 create 与 create/list 授权用例转绿：`tests/integration/cases-create.test.ts` 全部通过；`tests/integration/cases-authorization.test.ts` 的 POST / list 用例通过；detail 授权用例留待 T058（依赖 T050、T051、T052、T053） [VERIFY:`bunx vitest run tests/integration/cases-create.test.ts tests/integration/cases-authorization.test.ts` 输出；create 与 list 分组全绿，detail 分组仍 RED 且原因已记录]

---

## Phase 6 — Case List / Detail（TDD）

- [x] T055 [P] [REQ:FR-016;FR-017;FR-022;SC-010;SC-011] 新增 `tests/integration/cases-read.test.ts` RED：list 返回 `items`、排序 `primary DESC, createdAt ASC, id ASC`、不分页、空 Family 返回真实空集合、primary 唯一可识别、不返回其他 Family；detail 成功返回独立 `status` / `phase`；不存在 ID → `404 CASE_NOT_FOUND`；响应无 `familyId` / creator / 内容字段（依赖 T042、T043、T045） [VERIFY:`bunx vitest run tests/integration/cases-read.test.ts` 预期 RED（端点未实现），保留输出]
- [x] T056 [REQ:FR-016;FR-017;FR-023;plan:D-9.2/D-9.3] 在 `apps/server/api/src/routes/cases.ts` 实现 `GET /api/v1/cases` 与 `GET /api/v1/cases/:id`：`CASE_LIST` / `CASE_READ` 授权；仍在 `withRlsTransaction` 内只读；detail 对不存在 / 跨 Family / 无资格统一 `404 CASE_NOT_FOUND`，响应体逐字节一致、无 `details`、无任何 Case 字段；不写 `case_events` / `business_audit_events`（依赖 T052） [VERIFY:`bun run typecheck`；`rg "GET /api/v1/cases|CASE_READ|CASE_NOT_FOUND" apps/server/api/src/routes/cases.ts`]
- [x] T057 [REQ:FR-016;R2;R3] 在 `packages/domain/src/cases.ts` 的 `listCases` 固定 `ORDER BY is_primary DESC, created_at ASC, id ASC`；空结果返回空数组；不伪造 placeholder / 默认 Case；不实现分页参数（依赖 T056） [VERIFY:`rg "ORDER BY is_primary DESC, created_at ASC, id ASC" packages/domain/src/cases.ts`；`bunx vitest run tests/integration/cases-read.test.ts` 排序与空集合用例通过]
- [x] T058 [REQ:FR-017;SC-010;场景5] 运行 read 与 detail 授权用例转绿：`tests/integration/cases-read.test.ts` 全绿；`tests/integration/cases-authorization.test.ts` 的 detail 分组（含场景 A 404）通过（依赖 T055、T056、T057、T054） [VERIFY:`bunx vitest run tests/integration/cases-read.test.ts tests/integration/cases-authorization.test.ts` 全绿，保留状态码与响应体输出]
- [x] T059 [REQ:FR-025;D7;SC-007] 新增 `tests/integration/cases-read-no-audit.test.ts`：调用 `GET /api/v1/cases` 与 `GET /api/v1/cases/:id` 前后，`case_events` 与 `business_audit_events` 行数不变；不存在 `CASE_VIEWED` / `CASE_LISTED` / `CASE_ACCESSED` 事件；不新建 access-log 表（依赖 T056） [VERIFY:先写测试并运行，记录 before/after 计数；若读取写审计则判定 T056 实现缺陷并修复；最终测试通过且计数相等]

---

## Phase 7 — Authorization Integration（场景 A / B 必须分开）

- [x] T060 [REQ:FR-008;FR-009;FR-024;场景9A;SC-005] 在 `tests/integration/cases-authorization.test.ts` 固定 `describe('场景 A — guardian + Family 成员 + 非 manager')`：actor 是目标 Family 合法 `family_member`、current Family 已解析、具备 guardian relationship、但不是 `families.created_by_person_id`；断言 POST 403、GET list 403、GET detail 404；无 Case 写入、无 Case 数据、无 Case 字段（依赖 T054、T058） [VERIFY:`bunx vitest run tests/integration/cases-authorization.test.ts -t "场景 A"` 通过，输出三状态码]
- [x] T061 [REQ:FR-024;R5;场景9B;SC-005] 在 `tests/integration/cases-authorization.test.ts` 固定 `describe('场景 B — guardian 但不是目标 Family 成员')`：current Family 未合法解析为目标 Family；三端点沿用 Slice 1 Family 语义（如 `CURRENT_FAMILY_NOT_FOUND`），响应无 Case 字段；**不得**出现 `CASE_ACCESS_DENIED` / `CASE_NOT_FOUND`；不得用于验证 Case manager 权限（依赖 T054、T058） [VERIFY:`bunx vitest run tests/integration/cases-authorization.test.ts -t "场景 B"` 通过，输出响应 code]
- [x] T062 [REQ:FR-010;FR-023;SC-004;场景6] 验证跨家庭双层隔离：Family A 的 manager 读 Family B Case → `404 CASE_NOT_FOUND` 且无 B 字段 / 无存在性提示；以 `xiaoshuyin_app` 在 Family A 上下文直查 Family B Case → 0 行；无上下文 → 0 行 / 拒写（与 T022 互补）（依赖 T058、T022） [VERIFY:`bunx vitest run tests/integration/cases-read.test.ts tests/db/cases-rls.test.ts` 相关用例通过；输出直查 count=0]

---

## Phase 8 — Idempotency & Primary Concurrency（真实数据库连接）

- [x] T063 [P] [REQ:FR-012;SC-006;场景10] 新增 `tests/integration/cases-idempotency.test.ts`：same key + same canonical payload replay 返回原 `201` body / 原 Case ID；concurrent same key（真实多连接）只产生 1 个 Case、1 组 `case_event`、1 组 `business_audit_event`，其余为 REPLAY；Case / event / audit 行数不变；不测试 HTTP same key + different legal body（当前不存在第二种合法 payload）（依赖 T052、T053） [VERIFY:先写测试并运行并记录实际结果；若发现重放 / 并发缺口，保留失败输出并从 T049、T052 修复；最终 `bunx vitest run tests/integration/cases-idempotency.test.ts` 全绿]
- [x] T064 [REQ:FR-012;plan:D-5.4] 验证 HTTP 幂等实现：幂等 lookup / 占位 / 回填全部在 `withRlsTransaction` 内，不照抄 `families.ts` 的无上下文 `pool.query` 或事务外回填；若发现偏差，回到 T049 / T052 修复后再验证（依赖 T063） [VERIFY:`bunx vitest run tests/integration/cases-idempotency.test.ts` 输出 Case=1、case_event=1、business_audit_event=1、idempotency_keys=1]
- [x] T065 [REQ:FR-012;§8.5;CHK041] 验证 shared mismatch 合同：same scope key + different `request_hash` → `MISMATCH` → 映射 `409 IDEMPOTENCY_PAYLOAD_MISMATCH`；不修改原 Case、不写新事件 / 审计；不得换 actor（会改变 scope）、不得伪造 Family、不得新增无意义 body 字段（依赖 T028、T046、T049） [VERIFY:`bunx vitest run tests/domain/idempotency-hash.test.ts` 与 repository/service contract 用例通过；输出 mismatch 分支]
- [x] T066 [REQ:FR-006;FR-007;SC-002;场景3] 运行 `tests/db/cases-primary-concurrency.test.ts` 转绿：同 Family、两个不同幂等键、两个并发连接 → 两 Case 均成功、一 `primary=true` 一 `false`、`is_primary AND status <> 'CLOSED'` 计数 = 1、事件 / 审计各 2 条（依赖 T024、T042、T052） [VERIFY:`bunx vitest run tests/db/cases-primary-concurrency.test.ts` 通过；输出聚合 count=1；重复运行 3 次结果一致]
- [x] T067 [REQ:plan:D-3.4;R2] 验证并发细节：两个不同 key 的合法请求都返回 201（不得 500 / 409 伪装失败）；`primary=true` 唯一；旧 primary 不被改变；并发使用真实 PostgreSQL 连接而非 mock / 进程内锁（依赖 T066） [VERIFY:测试输出两条 201、聚合计数与两 Case 的 primary 值]
- [x] T068 [REQ:plan:D-3.3;R-2] 验证 unique violation 不是正常业务流程：以 migrator / app 直接插入第二个 `is_primary=true` 同 Family Case → partial unique 拒绝（23505）；应用 create 路径不得捕获 23505 转 201 / 409，若发生则整体回滚并真实失败（依赖 T067） [VERIFY:直插输出 23505；`rg "23505" apps/server/api/src/routes/cases.ts` 无正常分支捕获；`bunx vitest run tests/db/cases-primary-concurrency.test.ts` 仍绿]

---

## Phase 9 — Event / Audit / Scope Guard / Existing Test Alignment

- [x] T069 [REQ:FR-014;FR-021;SC-007;CHK063] 新增 `tests/integration/cases-audit.test.ts`：成功创建后 `case_events` 与 `business_audit_events` 各恰好 1 条 `CASE_CREATED`，`resource_type=CASE`、`resource_id=caseId`；`case_events.metadata` key 集合恰为 `{primary, version}`，无 title / description / 正文 / PII；构造 event / audit 写入失败（事务内注入非法 metadata 或 event_type）时 Case 不落库（回滚证据）（依赖 T054） [VERIFY:先写测试并运行；若 event / audit 缺失或 metadata 形状不符，保留失败输出并从 T048、T052 修复；最终测试通过，输出两表 counts 与回滚后 `cases` count=0]
- [x] T070 [REQ:FR-005;FR-018;FR-020;SC-008;场景12] 运行 `tests/integration/cases-scope.test.ts` 转绿：Case 路由恰为 3 条；不存在 `/cases/current`、pause、resume、switch-primary、close、recurrences、messages、assessments、participants；DB 无越界表；`cases` 无禁止列；`event_type` 仅 `CASE_CREATED`（依赖 T031、T053、T056） [VERIFY:`bunx vitest run tests/integration/cases-scope.test.ts` 通过；输出路由清单与越界查询为空]
- [x] T071 [P] [REQ:FR-020;SC-008;guard:R4/R6] 在现有 `scripts/guard-static.mjs` 内最小扩展：`FAMILY_TABLES` 加入 `cases`、`case_events`；R6 scope guard 的 forbidden table regex 加入 `case_participants`、`assertions`、`observations`、`problem_formulations`、`scene_node_states`、`scene_artifacts`、`dialogue_messages`、`safety_states`、`plan_versions`、`notifications`；**不新建第二套 scope checker**（依赖 T020） [VERIFY:`bun run guard:static` 输出 `PASS (0 violations)`]
- [x] T072 [REQ:FR-020;SC-008] 验证 guard 真的生效：临时注入一个违规样例（`db` 下 `CREATE TABLE assertions` 或 `apps/` 下 `FROM cases`），`bun run guard:static` 必须 exit 1；移除样例后恢复 exit 0；不得提交违规样例（依赖 T071） [VERIFY:注入后 exit 1 输出 rule 与文件行号；移除后 `PASS (0 violations)`]
- [x] T073 [REQ:FR-011;R4;CHK066] 验证 append-only 与最小授权：`xiaoshuyin_app` 对 `case_events` 只有 `SELECT, INSERT`，`UPDATE` / `DELETE` 被拒；`cases` 只有 `SELECT, INSERT`；enum `USAGE` 正确（依赖 T042、T040） [VERIFY:`SELECT has_table_privilege('xiaoshuyin_app','case_events','SELECT')` 与 `UPDATE` / `DELETE` 查询；实际 `UPDATE` / `DELETE` 尝试返回 42501 或权限错误]
- [x] T074 [REQ:FR-001;FR-015;CHK080;CHK082] 验证禁止列 / 禁止表：`information_schema.columns` 断言 `cases` 无 `title` / `summary` / `description` / `problem_description` / `problem_summary` / evidence-like 自由文本；`pg_tables` 无 `case_participants` / `assertions` / `observations` / `problem_formulations` / `scene_*` / Safety / Plan / Task / Notification 表（依赖 T021、T070） [VERIFY:查询输出逐项为空；`bunx vitest run tests/integration/cases-scope.test.ts tests/db/cases-schema.test.ts` 通过]

---

## Phase 10 — OpenAPI / Generated Client（代码侧单事实源）

- [x] T075 [REQ:§27A;FR-015;FR-016;FR-017] 为 `apps/server/api/src/routes/cases.ts` 三个端点声明 `schema`（body / response / params），复用 `packages/contracts` 的 Zod schema 与 `fastify-type-provider-zod`；不改变既有路由 validator 行为；422 仍映射 `VALIDATION_ERROR` 且零业务写入（依赖 T053） [VERIFY:`bun run typecheck`；`bunx vitest run tests/integration/cases-create.test.ts` 的 422 用例仍绿]
- [x] T076 [REQ:§27A;plan:D-9] 更新 `scripts/openapi-generate.mjs` 的临时 spec 脚本，import 并注册 `registerCaseRoutes(app, pool)`；不改变既有路由注册（依赖 T075） [VERIFY:`rg "registerCaseRoutes" scripts/openapi-generate.mjs`；`bun run openapi:generate` 不报 not connected]
- [x] T077 [REQ:§27A] 运行 `bun run openapi:generate` 生成 / 更新 `packages/generated/openapi.json` 与 `packages/generated/openapi.d.ts`；**不得 hand-edit generated artifact**；不得把生成物当第二真相源。验证必须**路径限定**（只检视 `packages/generated/`，不得用全分支 `git diff --name-only` 判断）且**可重复**：记录两文件 hash 后再次运行同一 generator，hash 必须完全一致；Case 3 operations 必须真实进入 generated output（依赖 T076） [VERIFY:`git diff --name-only -- packages/generated/` 只能出现 `openapi.json` / `openapi.d.ts` 两个 generator 管理文件（本次生成未改变文件时允许为空，此时以两次生成 hash 一致为准）；首次生成后 `shasum -a 256 packages/generated/openapi.json packages/generated/openapi.d.ts` 记录值，再次 `bun run openapi:generate` 后重新计算且完全一致；第二次生成后 `git status --short -- packages/generated/` 无残留；`bun run openapi:check` PASS；generated output 含 createCase / listCases / getCase 三个 Case operation]
- [x] T078 [P] [REQ:FR-018;CHK077;§28.3] 新增 `tests/integration/openapi-cases.test.ts`：Case operation 恰为 3（`createCase` / `listCases` / `getCase`）；`/api/v1/cases` 有 POST / GET，`/api/v1/cases/{id}` 有 GET；错误响应结构引用 `CaseNotFound` / `CaseAccessDenied` / `CurrentFamilyNotFound`；`code` 为 literal / enum 可机械验证；不存在 `/cases/current` 等越界路径（依赖 T077） [VERIFY:`bunx vitest run tests/integration/openapi-cases.test.ts` 通过，输出 `3/3`]
- [x] T079 [REQ:§27A;plan:G9] 运行 `bun run openapi:check`：无 drift，二次生成无 diff（依赖 T078） [VERIFY:`bun run openapi:check` 输出 `PASS (no drift)`]
- [x] T080 [REQ:CHK077;plan:D-9] 将生成 OpenAPI 与 `specs/002-case-core/contracts/cases-api.openapi.yaml` 做结构比对：3 operations、`CreateCaseRequest` strict、`CaseResponse` 7 字段、错误结构；若不一致 → `BLOCKED — CONTRACT DRIFT`，**不得修改 specs 契约**或 hand-edit generated artifact（依赖 T079） [VERIFY:比对脚本或测试输出；差异清单为空；否则停止并报告]

---

## Phase 11 — Implement Final Verification & Implementation Convergence Evidence

> **语境**：本 Phase 是**未来 Implement 执行完 T001–T080 之后**的收尾，不是本轮 Tasks authoring。
> - T081–T084：最终验证（全量回归、coverage、quickstart、CI）。
> - T085：**Implement final governance**——保护 frozen upstream，并证明 implementation diff 可解释（不是要求 diff = 0）。
> - T086：**Implementation Convergence Evidence**——Implement AI 自己的自检，**不是**独立 Converge。
> - T087：**Implement Final Handoff**——输出固定文案后立即停止，移交全新独立 AI。

- [x] T081 [REQ:plan:Verification-Plan;constitution:VI] 全量回归：`bun run typecheck`、`bun run guard:static`、`bunx vitest run tests/domain`、`bunx vitest run tests/db`、`bunx vitest run tests/integration`、`bun run openapi:check`、空库 `bun run db:migrate` replay；逐条检查输出（依赖 T042、T054、T058、T064、T067、T069、T072、T079） [VERIFY:全部命令退出 0；无跳过 / 无 expected-fail；输出归档]
- [x] T082 [REQ:FR-001–FR-025;SC-001–SC-011;Acceptance 1–16] Coverage 审计：逐条确认 25 条 FR、11 条 SC、16 个 Acceptance 均有至少一个测试文件与用例；缺口必须为 0；不得用“设计已存在”代替测试（依赖 T081） [VERIFY:审计输出 `FR 25/25`、`SC 11/11`、`Acceptance 16/16`；missing 列表为空]
- [x] T083 [REQ:quickstart:§2–§7] 按 `quickstart.md` 真实执行关键路径：migration、创建首个 / 第二个 Case、列表、详情、422 越权字段、404 反枚举、场景 A / B、幂等 replay、并发、读不写审计；记录真实响应（依赖 T081） [VERIFY:状态码与响应字段逐项匹配 quickstart 期望；记录归档]
- [x] T084 [REQ:plan:G10;§40] CI 全 job green：`static`、`unit`、`db-migrate`、`integration`、`contract` 在 feature branch 全部真实 success，不得 placeholder / 假成功（依赖 T081） [VERIFY:GitHub Actions run 链接，5/5 success]
- [x] T085 [REQ:constitution:V/VI;AGENTS:§7] **Implement final governance（不是 Tasks 生成阶段的验证）**：此时 T001–T084 已完成，业务代码 / 新 migration / tests / generated OpenAPI / generated types / `guard-static` 合法增量 / 本文件 checkbox 与 evidence 都属于**预期 diff**，T085 **不要求这些 diff 为 0**。① **Frozen upstream 未被擅改**：`Docs/**`、`AGENTS.md`、`.specify/memory/constitution.md`、`spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/**`、`quickstart.md`、`checklists/requirements-quality.md` 相对 `IMPLEMENT_BASE_SHA` 无语义修改，除非经过明确的上游回退与重新审核；② `tasks.md` 仅允许 `[ ] → [x]`、completion / evidence 状态与必要的执行证据引用，不得借 checkbox 更新改变 requirement / design；③ **Implementation diff 必须 explainable 而非 zero**：`git diff --name-only "$IMPLEMENT_BASE_SHA"...HEAD` 的每一项都必须能追溯到 T001–T084 中至少一个明确 Task，并分类为 expected implementation changes / expected generated artifacts / expected tests 与 evidence / unexpected；不得存在 unexplained file、scope creep、future Slice placeholder、Docs semantic drift、为让测试通过而删除既有断言（依赖 T081） [VERIFY:`node .specify/scripts/validate-governance.mjs` 与 `node .specify/scripts/tests/run-governance-tests.mjs` 均 PASS；`git diff --name-only "$IMPLEMENT_BASE_SHA"...HEAD -- Docs AGENTS.md .specify/memory/constitution.md specs/002-case-core/spec.md specs/002-case-core/plan.md specs/002-case-core/research.md specs/002-case-core/data-model.md specs/002-case-core/contracts specs/002-case-core/quickstart.md specs/002-case-core/checklists` 输出为空；`git diff "$IMPLEMENT_BASE_SHA"...HEAD -- specs/002-case-core/tasks.md` 仅含 checkbox 与 completion / evidence 行变更、无 requirement / design 语义改动；`git diff --name-only "$IMPLEMENT_BASE_SHA"...HEAD` 全量清单按四类归档并输出计数，unexpected 计数 = 0]
- [x] T086 [REQ:constitution:VI;plan:Verification-Plan] **Implementation Convergence Evidence（Implement AI 自检，不是最终独立 Converge）**：由 Implement AI 整理 requirement coverage、scope、contracts、tests、RLS、concurrency、idempotency、CI、remaining gaps 的对照证据；重读 `spec.md` 的 FR / SC / Acceptance 与 `contracts/**` 逐项比对，记录 frozen upstream 未改与 implementation diff 的分类结果；本任务不得替代独立 Converge review，不得据此宣布可 merge（依赖 T082–T085） [VERIFY:自检记录含上述各项与真实命令输出；`git diff --name-only "$IMPLEMENT_BASE_SHA"...HEAD` 的四类计数归档；remaining gaps 为空，或逐项列出并转 BLOCKED]
- [x] T087 [REQ:AGENTS:§3;constitution:VI] **Implement Final Handoff（Implement 阶段终点）**：仅当 T001–T086 全部完成、G1–G11 PASS、全部测试 PASS、migration replay PASS、OpenAPI check PASS、CI 全 job PASS、governance PASS、coverage FR 25/25 与 SC 11/11 与 Acceptance 16/16、remaining gap = 0 时，输出 `IMPLEMENT COMPLETE — READY FOR INDEPENDENT CONVERGE` 并停止；存在任一未解决问题则输出 `BLOCKED` 并报告具体 Task 与证据。**停止边界**：不得自行充当独立 Converge reviewer、不得自行宣布可 merge、不得 merge 到 main、不得重新进入 Analyze、不得修改冻结需求以消除 gap；下一步必须交给一个全新的独立 AI 执行 Converge / final review / CI verification（依赖 T086） [VERIFY:最终报告含 T001–T086 逐项完成状态、G1–G11 PASS、测试 / migration / OpenAPI / CI / governance / coverage 证据、remaining gap = 0；`git status --short` 无未提交残留；输出固定文案 IMPLEMENT COMPLETE — READY FOR INDEPENDENT CONVERGE；无 merge / Analyze / Implement 后续动作]

---

## Execution Batches（并行设计）

| Batch | 内容 | 并行性 |
|---|---|---|
| G | Phase 0 Gate G1–G11 | **串行门禁**；T012 未 PASS 不得进入 Phase 1 |
| A | Phase 1 baseline alignment | T014–T020 可 `[P]`（只读、不同目标） |
| B | Phase 2 RED tests | T021–T031 可 `[P]`（不同测试文件） |
| C | Phase 3 reviewed migration | **全串行**（同一份 migration，中途不得 apply） |
| D | Phase 4 domain / contracts | T043–T046 可 `[P]`（不同文件）；T047–T049 **串行**（同一 repository 文件） |
| E | Phase 5 Case create | T050、T051 可 `[P]`（不同测试文件）；T052–T054 串行 |
| F | Phase 6 Case read | T055 可 `[P]`；T056–T058 串行；T059 独立测试文件 |
| G2 | Phase 7 authorization integration | T060–T062 串行（同一测试文件 / 同一响应断言） |
| H | Phase 8 idempotency / concurrency | T063 可 `[P]`；T064–T068 串行（同一行为验证链） |
| I | Phase 9 event / audit / scope | T069、T070、T072–T074 串行验证；T071 可 `[P]`（独立脚本） |
| J | Phase 10 OpenAPI | T075–T077 串行；T078 可 `[P]`；T079–T080 串行 |
| K | Phase 11 Implement final verification | **全串行**：T081 → T082–T085 → T086（Implement 自检）→ T087（Handoff，输出后停止并移交独立 Converge） |

---

## Dependency Graph

下表是逐任务依赖边（`T### ← 依赖`），与任务正文的 `（依赖 T###）` 一致；用于校验无前向依赖、无环、无不可能前置。
Phase 11 中 T086 是 Implement 自检、T087 是 Implement handoff，均属于**未来 Implement 执行阶段**；本轮 Tasks authoring 不执行它们，依赖图仅用于未来执行校验。

| Phase | 边 |
|---|---|
| 0 | T001 ← ∅；T002 ← T001；T003 ← T002；T004 ← T002；T005 ← T002；T006 ← T002；T007 ← T002；T008 ← T002；T009 ← T002；T010 ← T002；T011 ← T002；T012 ← T003–T011 |
| 1 | T013 ← T012；T014 ← T012；T015 ← T012；T016 ← T012；T017 ← T012；T018 ← T012；T019 ← T012；T020 ← T012 |
| 2 | T021 ← T013、T014、T020；T022 ← T013、T020；T023 ← T013、T014；T024 ← T013、T020；T025 ← T013、T014；T026 ← T013；T027 ← T013；T028 ← T015；T029 ← T016；T030 ← T015；T031 ← T013、T017、T020 |
| 3 | T032 ← T031；T033 ← T032；T034 ← T033；T035 ← T034；T036 ← T035；T037 ← T036；T038 ← T037；T039 ← T038；T040 ← T039；T041 ← T040；T042 ← T041、T021–T027 |
| 4 | T043 ← T017；T044 ← T029、T016；T045 ← T030、T015；T046 ← T028；T047 ← T042、T020；T048 ← T047；T049 ← T048 |
| 5 | T050 ← T042、T043、T044、T045；T051 ← T042、T043、T045；T052 ← T047–T049、T043–T045；T053 ← T052；T054 ← T050–T053 |
| 6 | T055 ← T042、T043、T045；T056 ← T052；T057 ← T056；T058 ← T055–T057、T054；T059 ← T056 |
| 7 | T060 ← T054、T058；T061 ← T054、T058；T062 ← T058、T022 |
| 8 | T063 ← T052、T053；T064 ← T063；T065 ← T028、T046、T049；T066 ← T024、T042、T052；T067 ← T066；T068 ← T067 |
| 9 | T069 ← T054；T070 ← T031、T053、T056；T071 ← T020；T072 ← T071；T073 ← T042、T040；T074 ← T021、T070 |
| 10 | T075 ← T053；T076 ← T075；T077 ← T076；T078 ← T077；T079 ← T078；T080 ← T079 |
| 11 | T081 ← T042、T054、T058、T064、T067、T069、T072、T079；T082 ← T081；T083 ← T081；T084 ← T081；T085 ← T081；T086 ← T082–T085；T087 ← T086 |

**一致性结论**：87 条边全部满足 `依赖 id < 任务 id`（无前向依赖）；边集构成 DAG（无环）；无“先实现后测试”的边——Phase 2 的所有行为测试均先于 Phase 3 / 4 / 5 的实现；Phase 3 是单一 reviewed migration，T032–T041 串行链保证 statement 顺序与 `plan.md` D-11 完全一致。

**不可并行点**：

- T032–T041 编辑同一份 migration；T042 之前不得 apply。
- T047–T049 编辑同一 `packages/domain/src/cases.ts`。
- T052、T056、T075 编辑同一 `apps/server/api/src/routes/cases.ts`。
- T060、T061 编辑同一 `tests/integration/cases-authorization.test.ts`。
- T064–T068 是同一条行为验证链，后一步依赖前一步输出。

---

## Parallelizable Tasks

| 并行组 | 任务 | 共同前置 | 文件独立性 |
|---|---|---|---|
| P1 | T014、T015、T016、T017、T018、T019、T020 | T012 | 只读 baseline，各自不同目标 |
| P2 | T021、T022、T023、T024、T025、T026、T027、T028、T029、T030、T031 | T013–T020 | 各自不同测试文件 |
| P3 | T043、T044、T045、T046 | T017、T029、T030、T015、T028 | `error-handler.ts` / `authorize.ts` / `schemas.ts` / `idempotency.ts` 互不重叠 |
| P4 | T050、T051 | T042–T045 | 两个不同集成测试文件 |
| P5 | T055、T059 | T042、T043、T045、T056 | 两个不同集成测试文件（T059 在 T056 后） |
| P6 | T063 | T052、T053 | 独立集成测试文件 |
| P7 | T071 | T020 | 独立脚本 `guard-static.mjs` |
| P8 | T078 | T077 | 独立 OpenAPI 测试文件 |

> 说明：`[P]` 不等于“可以忽略前置”。每组任务必须先满足其共同前置；`[P]` 仅表示同组之间无文件冲突、无互依赖。

---

## Critical Path

```text
T001 → T002 → T003–T011 → T012 → T013 → T021–T031 → T032 → T033 → T034 → T035 → T036 → T037 → T038 → T039 → T040 → T041 → T042
→ T047 → T048 → T049 → T052 → T053 → T054 → T056 → T058 → T064 → T067 → T069 → T081 → T086 → T087
```

关键路径上的单点串行文件：`<next-after-slice1-final>_case_core.sql`、`packages/domain/src/cases.ts`、`apps/server/api/src/routes/cases.ts`。

---

## Coverage

### FR → Tasks

| FR | Tasks |
|---|---|
| FR-001 | T021、T033、T036、T074 |
| FR-002 | T013、T021、T032–T042、T071 |
| FR-003 | T021、T032、T045、T057 |
| FR-004 | T033、T051、T052、T054 |
| FR-005 | T031、T070、T071 |
| FR-006 | T024、T034、T035、T052、T066 |
| FR-007 | T035、T051、T052、T066、T067 |
| FR-008 | T029、T044、T050、T060 |
| FR-009 | T029、T044、T050、T060、T061 |
| FR-010 | T022、T062、T073 |
| FR-011 | T022、T038–T042、T062、T073 |
| FR-012 | T028、T046、T049、T052、T063–T065 |
| FR-013 | T021、T034、T047、T054 |
| FR-014 | T023、T036–T037、T048、T052、T069 |
| FR-015 | T030、T045、T051、T075 |
| FR-016 | T030、T055–T058、T078 |
| FR-017 | T030、T055–T058、T078 |
| FR-018 | T031、T070、T078 |
| FR-019 | T054、T058、T064、T069 |
| FR-020 | T031、T070–T072 |
| FR-021 | T054、T058、T069、T070 |
| FR-022 | T055、T057、T058 |
| FR-023 | T043、T056、T058、T060、T062 |
| FR-024 | T043、T050、T060、T061 |
| FR-025 | T059、T069 |

### SC → Tasks

| SC | Tasks |
|---|---|
| SC-001 | T051、T054、T055、T058 |
| SC-002 | T024、T066、T067 |
| SC-003 | T021、T030、T033、T045、T051、T054 |
| SC-004 | T022、T062 |
| SC-005 | T029、T044、T050、T060、T061 |
| SC-006 | T028、T063–T065 |
| SC-007 | T048、T052、T069 |
| SC-008 | T031、T070–T072、T074 |
| SC-009 | T021、T034、T047、T054 |
| SC-010 | T055–T058、T070 |
| SC-011 | T055、T057、T058 |

### Acceptance 1–16 → Tasks

| Acceptance | Tasks |
|---|---|
| 1 | T051、T052、T054 |
| 2 | T051、T054、T058 |
| 3 | T024、T066、T067 |
| 4 | T055、T057、T058 |
| 5 | T055、T056、T058 |
| 6 | T062 |
| 7 | T022、T062 |
| 8 | T050、T060 |
| 9A / 9B | T050、T060、T061 |
| 10 | T063、T064、T065 |
| 11 | T069 |
| 12 | T031、T070、T071、T074 |
| 13 | T030、T045、T051 |
| 14 | T054、T058、T070 |
| 15 | T055、T058 |
| 16 | T059 |

### Gate / Frozen Decisions

| 项 | Tasks |
|---|---|
| G1–G11 | T001–T012 |
| R1（body `idempotencyKey`） | T009、T045、T052、T080 |
| R2（不分页） | T055、T057、T058 |
| R3（API `primary` / DB `is_primary`） | T033、T047、T055 |
| R4（append-only / 最小 GRANT） | T040、T073 |
| R5（沿用 Slice 1 Family 语义） | T043、T061、T062 |

---

## TDD Map

| 类别 | RED / 先行测试 | GREEN（实现后转绿） | Final（全量证据） |
|---|---|---|---|
| schema / enum / 禁止列 | T021 | T032–T042 | T074、T081 |
| RLS / roles / append-only | T022、T025、T026 | T038–T042、T073 | T062、T081 |
| metadata shape | T023 | T037、T042 | T069、T074 |
| primary 并发 | T024 | T035、T047、T052 | T066–T068 |
| authorization | T029 | T044 | T050、T060、T061 |
| contracts | T030 | T045 | T078、T080 |
| CASE_CREATE idempotency | T028（严格 RED）、T063（先行测试） | T046、T049、T052 | T064、T065 |
| create / list / detail | T051、T055 | T052、T056、T057 | T054、T058 |
| read-no-audit | T059（先行测试） | T056 | T083 |
| event / audit | T069（先行测试） | T048、T052 | T081 |
| scope guard | T031 | T070、T071 | T072、T074 |
| OpenAPI | T078 | T075–T077 | T079、T080 |

> 严格 RED（首次运行必须失败）：T021–T031、T050、T051、T055。T059、T063、T069 是在实现链中“先写测试再验证边界”的先行测试；若首次运行即绿，必须保留输出并说明为何不是 RED（例如读取路径本就不写审计），不得把已绿测试伪造成 RED。
> 禁止“先实现全部功能，最后统一补测试”。任何行为实现任务都必须有前置 RED 任务；RED 输出必须保留，且失败原因必须是目标产物尚不存在。

---

## File Ownership（并发安全）

| 文件 / 目录 | 任务 | 并发规则 |
|---|---|---|
| `db/migrations/<next-after-slice1-final>_case_core.sql` | T032–T041 | **全串行**；同一 reviewed migration；中途不得 apply；不得改 `001_initial_schema.sql` |
| `packages/authorization/src/authorize.ts` | T044 | 单写；不得新建 `authorizeCase()` |
| `packages/contracts/src/schemas.ts` | T045 | 单写；只新增 Case schema，不改既有 schema |
| `packages/domain/src/idempotency.ts` | T046 | 单写；只加 `CASE_CREATE` 类型 |
| `packages/domain/src/cases.ts` | T047–T049 | 同文件串行；所有 Case SQL 归此，不放 `apps/` |
| `packages/domain/src/repository.ts` | T047（只读复用） | 不得为 Case 复制第二套 repository 框架 |
| `apps/server/api/src/routes/cases.ts` | T052、T056、T075 | 同文件串行；T075 只加 schema |
| `apps/server/api/src/app.ts` | T053 | 单写；只加一行注册 |
| `apps/server/api/src/plugins/error-handler.ts` | T043 | 单写；只加两个 Case 错误码 |
| `scripts/guard-static.mjs` | T071 | 单写；在现有规则内扩展，不新建 checker |
| `scripts/openapi-generate.mjs` | T076 | 单写；只加 cases route 注册 |
| `packages/generated/openapi.json` / `openapi.d.ts` | T077 | 只由 `openapi:generate` 生成；禁止 hand-edit |
| `tests/db/rls.test.ts` | T026 | 单写；保留旧断言，只做表 / policy 计数与新表覆盖扩展 |
| `tests/db/roles.test.ts` | T025 | 单写；保留旧 10 表断言，新增独立最小权限断言 |
| `tests/db/migration-repro.test.ts` | T027 | 单写；保留旧断言，只更新最终对象集合 |
| `tests/integration/cases-authorization.test.ts` | T050、T060、T061 | 同文件串行；场景 A / B 分 `describe`，不得合并 |
| `tests/integration/cases-*.test.ts` | T024、T051、T055、T059、T063、T069、T078 | 各自独立文件；不同任务不写同一文件 |

---

## Blockers / Stop Conditions

- Gate 任一失败：`BLOCKED — SLICE 1 IMPLEMENTATION DEPENDENCY`，停止并列出失败项与现场输出；不得私建替代 Family / Consent / RLS / 幂等 / 审计基础设施。
- G11 失败：`BLOCKED — SLICE 1 CURRENT FAMILY SEMANTICS NOT STABLE`；由 Slice 1 修复，Slice 2 不实现 Family switching。
- G5 发现 `families` UPDATE 权限被收紧：回到评审，不得改为无锁 check-then-insert。
- G9 / R1 发现 Slice 1 final 改为 `Idempotency-Key` header：先返回 Plan Review 更新契约，不得两套并存。
- T080 生成 OpenAPI 与 `specs/002-case-core/contracts/cases-api.openapi.yaml` 结构不一致：`BLOCKED — CONTRACT DRIFT`，不得修改 specs 契约或 hand-edit generated artifact。
- 任何需要修改 `Docs/**`、`spec.md`、`plan.md`、`contracts/**`、`checklists/**` 的实现便利：停止并回到上游变更流程，不得在 Slice 2 分支私改。
- 任何未批准的新表、新路由、新错误码、Case role / RBAC / Visibility Matrix / Participant / Evidence / Safety / Plan / Task / Notification / AI：停止，不实现。

---

## Completion Contract

### 本轮：Tasks authoring（当前执行）

本轮只产出本文件，**不执行 T001–T087**。完成条件：

1. T001–T087 连续、编号唯一、每条具备 `[REQ:...]` 与 `[VERIFY:...]`；
2. 依赖图无环、无前向依赖、无不可能前置；关键路径有效；
3. `node .specify/scripts/validate-governance.mjs` PASS，`node .specify/scripts/tests/run-governance-tests.mjs` 10/10；
4. 相对本轮基线，`Docs/**`、Spec / Plan / Research / Data Model / Contracts / Checklist、业务代码、migration、测试代码 diff = 0，仅本文件改动。

满足后输出 `SLICE 2 TASKS FINAL — READY FOR ANALYZE` 并停止。
**该 diff = 0 只约束本轮 Tasks authoring，不得写进 T085；T085 属于未来 Implement 阶段，要求 implementation diff 可解释而非为零。**

### 未来：Implement 执行（另一个 AI 运行 T001–T087）

一个任务只有满足下列全部条件才算完成：

1. 其声明的实现 / 测试 / migration 产物存在；
2. `[VERIFY:...]` 指定的命令**实际执行**并保留输出；
3. 观察到的结果与 Expected 一致；
4. 没有为了变绿而削弱测试、fixture、CHECK、RLS、GRANT 或需求；
5. 偏离已记录；若改变意图，必须先回到上游文档。

Implement 未完成，直到 Analyze 已通过、CI 全绿、T086 自检与 T087 判定均无剩余缺口，且 T087 输出 `IMPLEMENT COMPLETE — READY FOR INDEPENDENT CONVERGE`。
此后 Implement AI **必须停止**：独立 Converge / final review / CI verification 由全新 AI 执行，merge 是另一项独立决定。

**本文件（Tasks authoring）完成后停止。** 本轮不得进入 Analyze / Implement。

`SLICE 2 TASKS FINAL — READY FOR ANALYZE`
---

## Implement Completion Evidence（2026-11-06）

### Implement base

| 项 | 值 |
|---|---|
| `IMPLEMENT_BASE_SHA`（T013 前 HEAD） | `fe7d21f5ca3fcf79cea2e8baee461e01ec8526ed` |
| 上轮已审核 Head | `999295d04e90cc39ace3ef09b1d16b9d2752bfd6` |
| 合入的 `origin/main` | `438b76120b10c2738f8176f437e15269622ad1b7`（含 G11 hotfix，PR #10） |
| G11 hotfix 上游 | `1107527f2bd135cba2a707832b02299975f4a224`（Slice 1 final）+ `438b761` |

### Implement Gate（T003–T012 重新现场执行）

| Gate | 结果 | 现场证据 |
|---|---|---|
| G1 | PASS | `git merge-base --is-ancestor 1107527… origin/main` → 0；`git merge-base --is-ancestor 438b761… HEAD` → 0 |
| G2 | PASS | HEAD `fe7d21f` 双父：`fc930d3` + `438b761`；`origin/main` 为 HEAD 祖先；工作区 clean |
| G3 | PASS | `schema_migrations` = `001_initial_schema.sql`,`002_case_core.sql`；`families.created_by_person_id` NOT NULL + UNIQUE |
| G4 | PASS | `tests/domain/authorization.test.ts` 8/8 |
| G5 | PASS | `withRlsTransaction(pool,{familyId,accountId,personId,purpose},fn)`；`has_table_privilege('xiaoshuyin_app','families','UPDATE')` = t |
| G6 | PASS | `idempotency-hash` 6/6；`integration/idempotency` 20/20；`peekIdempotency` 在 identity 上下文事务内 |
| G7 | PASS | `business_audit_events_event_type_check` / `_resource_type_check`；policy `audit_scope` |
| G8 | PASS | `db/rls` 10/10、`db/roles` 9/9；两角色 `rolbypassrls=false`、非 superuser |
| G9 | PASS | `openapi:check` → `PASS (no drift)`；幂等键为 body 字段（R1） |
| G10 | PASS | CI 5 job；main run `42056003115`（PR #10 merge）success |
| G11 | PASS | 真实 HTTP probe（Scenario A/B/C，各 5 次 + heap-order disturbance）：A 恒为 actor-owned Family（before == after）；B 恒 `409 CURRENT_FAMILY_AMBIGUOUS`（响应仅 `code`/`message`/`statusCode`）；C 单成员稳定 |

### 交付验证（T081–T084）

| 命令 | 结果 |
|---|---|
| `bun run typecheck` | PASS（root + 5 workspace，exit 0） |
| `bun run guard:static` | PASS (0 violations)；注入 `CREATE TABLE assertions` 与 `apps` 内 `FROM cases` 时 exit 1（R6/R4 真实生效），移除后恢复 PASS |
| `bunx vitest run` | **44 files / 316 tests 全 PASS** |
| `bun run db:evidence` | PASS（空库重建 + 二次 apply no-op + RLS/角色/枚举/表/策略） |
| `bun run openapi:generate` ×2 | 生成物 hash 完全一致（`d357c169…` / `b8f781eb…`） |
| `bun run openapi:check` | PASS (no drift) |
| `bun run coverage:audit` | 002：**FR 25/25、SC 11/11、Acceptance 18/18、missing 0**；001：FR 17/17、SC 8/8 |
| `node .specify/scripts/validate-governance.mjs` | PASS |
| `node .specify/scripts/tests/run-governance-tests.mjs` | PASS 15/15 |
| GitHub Actions run `42149827542`（`feat/002-case-core`） | **5/5 success**：Static Checks / Unit Tests / DB Migration / Integration Tests / Contract |

### 关键行为证据

- **单 primary**：同 Family、不同幂等键、真实并发连接 → 两条 201，聚合 `is_primary AND status <> 'CLOSED'` = 1，事件/审计各 2 条；重复 3 轮一致（`tests/db/cases-primary-concurrency.test.ts`）。
- **唯一索引兜底**：直插第二个 `is_primary=true` → `23505`；`routes/cases.ts` 无 23505 分支。
- **事务原子性**：事件 metadata 非法 → 整个事务回滚，`cases` 计数 0（`tests/integration/cases-audit.test.ts`）。
- **幂等**：同 key 重放返回同一 Case、行数不变；8 路并发同 key 只产生 1 个结果。
- **授权**：场景 A（guardian + 成员 + 非 manager）create/list 403、detail 404 且与「不存在」响应逐字节一致；场景 B（guardian 非成员）三端点均 `CURRENT_FAMILY_NOT_FOUND`，无 Case 错误码。
- **读取不写审计**：连续 5 轮 list + detail，`case_events` / `business_audit_events` 计数不变。

### Implementation diff 分类（相对 `IMPLEMENT_BASE_SHA`）

| 类别 | 文件 |
|---|---|
| expected implementation | `db/migrations/002_case_core.sql`、`packages/contracts/src/schemas.ts`、`packages/authorization/src/authorize.ts`、`packages/domain/src/{idempotency,index,cases}.ts`、`apps/server/api/src/{app.ts,routes/cases.ts,plugins/error-handler.ts}` |
| expected generated artifacts | `packages/generated/openapi.json`、`packages/generated/openapi.d.ts` |
| expected tests / evidence | `tests/db/cases-*.test.ts`（4）、`tests/domain/case-*.test.ts`（2）、`tests/integration/cases-*.test.ts`（5）、`tests/integration/openapi-cases.test.ts`、既有测试计数对齐（`migration-repro`、`rls`、`roles`、`schema-structure`、`idempotency-hash`、`openapi`）、`tests/evidence/converge-002.md` |
| expected verification scripts | `scripts/guard-static.mjs`（T071/T072）、`scripts/openapi-generate.mjs`（T076）、`scripts/coverage-audit.mjs`（T082）、`scripts/db-evidence.mjs`（T081） |
| unexpected | **0** |

### 偏差记录

1. `spec.md` 的 Acceptance Evidence 表为 **18 行**，`tasks.md` T082 记为「16/16」。以 `spec.md` 为准执行，审计输出 18/18；`tasks.md` 的 16 为旧计数，未修改任务意图。
2. `GET /api/v1/cases/current` 不是注册路由，但会落入 `:id` 参数并被 UUID 校验拒绝（422 `VALIDATION_ERROR`，无 Case 字段）。`/cases/x/switch-primary` 等嵌套路径为 404。
3. `db-evidence.mjs` / `coverage-audit.mjs` 的 Slice 1 硬编码计数按新增对象同步更新（8→10 enum、10→12 table、9→11 policy），未删除任何既有断言。
4. `tests/db/schema-structure.test.ts` 的 enum 断言由 8 扩为 10 并追加 `case_status` / `case_phase` 词汇断言。

### 剩余缺口

`NONE`

---

## Independent Converge Round 1 Remediation Evidence（2026-11-06）

**Old head**: `d2e9587d143d6082c35fba281fcab86a047d7a72`
**Remediation code head**: `c382b43077aece2b72af2a259fa6d3a36244eb41`（最终 head 含本证据提交）
**Migration**: 未新增（`db:migrate` 两次均 0 new）

| Finding | 状态 | 证据 |
|---|---|---|
| 1 OpenAPI operationId / security / invalid-id | CLOSED | `tests/integration/openapi-cases.test.ts` 10/10；`tests/integration/cases-http-boundary.test.ts` malformed/nonexistent/cross-family 404 一致 |
| 2 HEAD routes | CLOSED | Case 子树无 HEAD；`HEAD /cases`、`HEAD /cases/:id` → 404 |
| 3 auth before validation | CLOSED | 无 token / 非法 token + 非法 body → 401；Slice 1 回归全绿 |
| 4 `__proto__` / NUL / Unicode key | CLOSED | 422 + 四表零写入；NUL/Unicode key 首次+重放+6 路并发均 201 |
| 5 shared mismatch | CLOSED | 真实存储行 → `decideIdempotency` → MISMATCH → 409，原行/原 Case 不变 |
| 6 A07 / A06 / A13 | CLOSED | 普通 member 三端点；`case_events` 默认拒绝；真实 POST 故障注入回滚 |
| 7 scope guard | CLOSED | `guard-scope.test.ts` 12/12，注入即 exit != 0，清理后 PASS |

**全量**: `bunx vitest run` → 48 files / 347 tests，0 failed / 0 skipped；coverage 002 FR 25/25、SC 11/11、Acceptance 18/18；governance PASS；openapi:check PASS。

### Round 1 收尾证据

- 最终 head：`2ae1769`；CI run `42177284538` → **5/5 success**。
- 全量 `bunx vitest run`：48 files / 347 tests，exit 0。
- A13 故障注入改为按 Family 限定（`WHEN (NEW.family_id = ...)`）+ 每轮唯一 trigger 名，消除与并行套件的相互影响。
