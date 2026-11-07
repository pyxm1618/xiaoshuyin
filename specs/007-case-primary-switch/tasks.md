# Tasks: Case 主问题切换（`SwitchPrimaryCase`）

**Feature**: `specs/007-case-primary-switch/spec.md`（已冻结）
**Plan**: `specs/007-case-primary-switch/plan.md`（D-1—D-13、R-1—R-10）
**Checklist**: `specs/007-case-primary-switch/checklists/requirements-quality.md`（132/132 PASS）
**Branch**: `feat/007-case-primary-switch`
**Tasks 生成时 Head**: `69cfe6f661b26f3261b2c71b297eb3ab9a977468`
**`origin/main`**: `ee9d07e059566884e0329fb0eb4a4ab9dbf8ea83`
**阶段**: **Tasks only**。本文件只把已冻结的 Spec / Plan 拆成可执行任务图；**不进入 Implement、不写业务代码、不写 migration、不写测试实现**。

> **两种语境，不得混用**
> - **本轮 = Tasks authoring + 审计一**：只新增 `plan.md` / `checklists/requirements-quality.md` / `tasks.md`。`Docs/**`、`specs/001-006/**`、`apps/**`、`packages/**`、`db/**`、`tests/**`、`spec.md` 的 diff 必须为 0。
> - **T701—T789 = 未来 Implement 执行**：届时业务代码、新 migration、tests、generated OpenAPI、`guard-static` 合法增量、本文件 checkbox 都是**预期改动**。
> - **本轮结束状态**：`PLAN / CHECKLIST / TASKS FINAL PASS` + `IMPLEMENT BLOCKED BY SLICE 2`。

> **任务格式**：`- [ ] T7## [P] [REQ:<上游 ID / FR / 章节>] <目标 + 文件 + 依赖> [VERIFY:<真实命令或证据>]`
> `[P]` 仅表示：所列前置全部完成后，与同批次其它 `[P]` 任务无文件冲突，可并行。
> 每条任务必须同时具备 `[REQ:…]` 与 `[VERIFY:…]`；缺任一项即无效。

---

## Phase 0 — Dependency Gate（硬前置；T710 起不得执行）

> 对应 `plan.md` §0.3 G1—G8。**任一失败即停止**，并输出固定文案。
> 失败文案：`IMPLEMENT BLOCKED — SLICE 2 NOT MERGED` / `IMPLEMENT BLOCKED — SLICE 2 CONTRACT DRIFT` / `IMPLEMENT BLOCKED — SLICE 2 SEMANTICS CHANGED` / `IMPLEMENT BLOCKED — MIGRATION NUMBERING CONFLICT`。

- [ ] T701 [REQ:plan:G1] 验证 G1：Slice 2 已完成**审计二 PASS**且无未解决 finding；记录结论来源（PR review / converge 报告链接或文件）与日期（依赖 ∅） [VERIFY:审计二结论原文 + PASS 判定；若为 BLOCKED / 有条件 PASS → 停止并输出 `IMPLEMENT BLOCKED — SLICE 2 NOT MERGED`]
- [ ] T702 [REQ:plan:G2] 验证 G2：Slice 2 已 merge `main`；`git fetch origin` 后 `git merge-base --is-ancestor <slice2-final-head> origin/main` 退出 0；记录 `origin/main` 新 SHA 与旧 SHA `ee9d07e0…` 的差异（依赖 T701） [VERIFY:两条 SHA 输出 + `git log --oneline <old-main>..origin/main` 清单；merge 提交存在]
- [ ] T703 [REQ:plan:G3] 验证 G3：当前 `origin/main` 真实包含 Case 运行时：`db/migrations/*_case_core.sql`、`*_case_idempotency_key_bytes.sql`、`apps/server/api/src/routes/cases.ts`、`packages/domain/src/cases.ts`、`packages/authorization/src/authorize.ts`、`packages/contracts/src/schemas.ts`（含 `CreateCaseRequest`）（依赖 T702） [VERIFY:`git ls-tree -r --name-only origin/main | grep -E "case_core|idempotency_key_bytes|routes/cases.ts|domain/src/cases.ts"` 逐行输出]
- [ ] T704 [P] [REQ:plan:G4] 验证 G4：锁 / 幂等 / 事件 / 授权语义与 Slice 2 冻结一致：`lockFamilyForPrimaryDecision` 仍为 `SELECT id FROM families WHERE id = $1 FOR UPDATE`；`reserveIdempotency` / `getReservedIdempotency` / `completeIdempotency` 签名与半提交模式未变；`decideCaseAction()` 仍为「family → purpose → manager → 维度」顺序；**无** `authorizeCase()`（依赖 T702） [VERIFY:`rg -n "FOR UPDATE" packages/domain/src/cases.ts`；`rg -n "authorizeCase" packages/` 为空；逐条 diff 输出]
- [ ] T705 [P] [REQ:plan:G5] 验证 G5：真实约束名与谓词；记录 `case_events_event_type_check`、`case_events_metadata_shape_check`、`business_audit_events_event_type_check`、`business_audit_events_resource_type_check`、`idempotency_keys_command_type_check`、`idempotency_keys_key_representation_check` 的 `conname` + `pg_get_constraintdef`（依赖 T702） [VERIFY:`SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid IN ('case_events'::regclass,'business_audit_events'::regclass,'idempotency_keys'::regclass) ORDER BY conname;` 原样归档；与 `plan.md` D-9 假设逐字比对，不一致 → `IMPLEMENT BLOCKED — SLICE 2 CONTRACT DRIFT`]
- [ ] T706 [P] [REQ:plan:G6] 验证 G6：`xiaoshuyin_app` 对 `cases` 仅 `SELECT, INSERT`（`UPDATE`/`DELETE` 为 false）、对 `case_events` 仅 `SELECT, INSERT`、对 `families` 具备 `UPDATE`（② 行锁前提）；`rolbypassrls = false`（依赖 T702） [VERIFY:`SELECT has_table_privilege('xiaoshuyin_app','cases','UPDATE'), has_table_privilege('xiaoshuyin_app','case_events','UPDATE'), has_table_privilege('xiaoshuyin_app','families','UPDATE') FROM (SELECT 1) t;` 与 `has_column_privilege` 基线输出]
- [ ] T707 [P] [REQ:plan:G7;plan:D-9.1] 验证 G7 并**在 Slice 2 合并之后**确定迁移编号：`ls db/migrations` 必须已同时包含 `001_initial_schema.sql`、`002_case_core.sql`、`003_case_idempotency_key_bytes.sql`；目标文件名为 `004_case_primary_switch.sql` 且不存在。**禁止在 Slice 2 未合并时取名 `002_*`**（会与 `002_case_core.sql` 冲突）（依赖 T702） [VERIFY:`ls db/migrations` 输出含 001/002/003；`test ! -e db/migrations/004_case_primary_switch.sql` 退出 0；`git diff --name-only origin/main -- db/migrations/00[123]_*` 为空]
- [ ] T708 [P] [REQ:plan:G8] 验证 G8：Slice 2 merge 后本 Plan 依赖的语义未变：`is_primary` = 当前 assignment（`specs/002-case-core/plan.md` §3.1.1 若被改写，记录差异）、`version` 从 1 起、`CASE_CREATE` 幂等 body transport 仍为 `idempotencyKey`、`case_events.metadata` 仍为「恰为 `{primary, version}`」、`cases` 仍为 9 列（依赖 T702） [VERIFY:`bunx vitest run tests/db/cases-schema.test.ts tests/db/cases-events-metadata.test.ts tests/integration/cases-scope.test.ts tests/domain/case-contracts.test.ts` 全绿；语义差异清单为空或逐项记录 → 有差异则 `IMPLEMENT BLOCKED — SLICE 2 SEMANTICS CHANGED`]
- [ ] T709 [REQ:plan:0.3] Gate 判定与阻断协议：逐项记录 G1—G8 结果；任一失败按固定文案停止，**不得开始 T710**（依赖 T703—T708） [VERIFY:8 项结果清单 + 失败项现场输出；全部 PASS 才允许进入 Phase 1]

---

## Phase 1 — Baseline Alignment（只读，不重新设计 Slice 1 / 2）

> 目的：把 Plan 中所有「假设」替换成「实测事实」，并记录 `IMPLEMENT_BASE_SHA`。本 Phase 不产生任何实现改动。

- [ ] T710 [REQ:plan:0.1] 记录 `IMPLEMENT_BASE_SHA=$(git rev-parse HEAD)` 与 `origin/main` SHA，写入本文件末尾的 Evidence 段；此 SHA 是后续所有 diff 分类的基线（依赖 T709） [VERIFY:`git rev-parse HEAD` 与 `git rev-parse origin/main` 输出；`git status --short` clean]
- [ ] T711 [P] [REQ:plan:D-3] 复核 `lockFamilyForPrimaryDecision` 与 `existsCurrentPrimary` 的真实实现，确认「锁语句与判定语句分离」仍成立（同一语句合并会让 READ COMMITTED 复用旧快照）（依赖 T710） [VERIFY:`rg -n "FOR UPDATE|EXISTS" packages/domain/src/cases.ts` 输出两处独立语句；行号归档]
- [ ] T712 [P] [REQ:plan:D-4/D-7] 复核幂等三函数的真实行为：`reserveIdempotency` 用 `ON CONFLICT DO NOTHING` + `RETURNING id`、占位为 `0` / `'{}'`；`getReservedIdempotency` 用 `FOR SHARE` 且先 bytes 后 legacy text；`completeIdempotency` 用 `UPDATE ... WHERE actor+command+bytes`（依赖 T710） [VERIFY:`rg -n "ON CONFLICT DO NOTHING|FOR SHARE|response_status" packages/domain/src/cases.ts` 输出；与 `plan.md` D-7.4 逐条比对]
- [ ] T713 [P] [REQ:plan:D-9.5] 实测列级与表级授权的真实返回值语义：在临时库上 `GRANT UPDATE (is_primary) ON cases TO xiaoshuyin_app` 后分别查 `has_table_privilege` 与 `has_column_privilege`，记录真实结果后回滚 DDL（不得提交该实验）（依赖 T710） [VERIFY:两组查询的真实输出归档；结论写入 T736 的注释依据（不论结论如何，**不得**升级为表级授权）]
- [ ] T714 [P] [REQ:plan:D-12] 清点既有 Case 路由与测试的断言面：`routes` 树、`FORBIDDEN_ROUTE_FRAGMENTS`、`openapi-cases.test.ts` 的 path / operation 断言、`cases-scope.test.ts` 的 `roots.length` 断言，逐条列出「将被精确收窄的断言」与「必须原样保留的禁止项」（依赖 T710） [VERIFY:`rg -n "FORBIDDEN_ROUTE_FRAGMENTS|switch-primary|casePaths|operations.sort" tests/integration/` 输出；收窄清单归档]
- [ ] T715 [P] [REQ:plan:D-9.2] 复核 `case_events` 与 `business_audit_events` 的 `resource_type` 白名单现状（`CASE` 已存在，无需扩展），避免迁移里写入多余变更（依赖 T705） [VERIFY:`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='business_audit_events_resource_type_check';` 输出含 `CASE`]
- [ ] T716 [REQ:plan:V-3] 建立基线测试快照：在未改任何代码前跑一次 `bunx vitest run`、`bun run typecheck`、`bun run guard:static`、`bun run openapi:check`，记录结果；此后任何「新失败」都必须能归因到本 Slice（依赖 T710） [VERIFY:四条命令的 exit code 与摘要归档；若基线本身有失败 → 先报告 `BLOCKED — BASELINE NOT GREEN`]

---

## Phase 2 — Failing Tests（RED，test-first；只写测试，不写实现）

> 每个 RED 任务必须记录「失败原因是目标产物尚不存在」，不得把环境故障当 RED。

- [ ] T717 [P] [REQ:FR-005;FR-004;plan:D-5;R-10] 新增 `tests/domain/case-primary-switch-decision.test.ts`：`decideSwitchPrimary()` 的 6 status × 4 视图全组合；顺序断言（CLOSED 先于 SAFETY、ALREADY 先于 STALE）；`ALLOW` 时 `demote` 为 `null` 当且仅当 `current=null`；**不得**出现常量谓词（依赖 T710） [VERIFY:`bunx vitest run tests/domain/case-primary-switch-decision.test.ts` 预期 RED（模块不存在），保留输出]
- [ ] T718 [P] [REQ:FR-011;FR-018;plan:D-6] 新增 `tests/domain/case-primary-switch-contracts.test.ts` RED：`SwitchPrimaryCaseRequest` strict；`idempotencyKey` 8—128；`reason` 1—500 且 trim 非空；视图四态（双 null / 双有效 / 一 null 一有效 → 拒绝 / 缺键 → 拒绝）；未声明字段（`isPrimary`、`primary`、`version`、`status`、`phase`、`familyId`、`targetCaseId`）全部拒绝；`SwitchPrimaryCaseResponse` 恰为 `primary` / `previousPrimary` / `switchedAt`（依赖 T710） [VERIFY:`bunx vitest run tests/domain/case-primary-switch-contracts.test.ts` 预期 RED，保留输出]
- [ ] T719 [P] [REQ:FR-003;FR-013;plan:D-10] 新增 `tests/domain/case-primary-switch-authorization.test.ts` RED：`CASE_SWITCH_PRIMARY` 在注册表；`family=null → FAMILY_CONTEXT_REQUIRED`；`purpose≠FAMILY_MANAGEMENT → UNSUPPORTED_PURPOSE`；`createdByPersonId` 缺失 / ≠ actor → `NOT_FAMILY_MANAGER`；`case=null → CASE_CONTEXT_REQUIRED`；manager + case 维度 → ALLOW；既有 Slice 1/2 授权用例行为不变（依赖 T710） [VERIFY:`bunx vitest run tests/domain/case-primary-switch-authorization.test.ts` 预期 RED，保留输出]
- [ ] T720 [P] [REQ:FR-012;plan:D-9.2/D-9.3] 新增 `tests/db/case-primary-switch-schema.test.ts` RED：三个 `event_type` 白名单包含新词汇且**不含**读取审计词汇；`case_events_metadata_shape_check` 对 `CASE_PRIMARY_ASSIGNED` / `CASE_PRIMARY_REVOKED` 接受合法形状、拒绝额外 key / 非 boolean `primary` / 非整数 `version` / 空 reason / 超 500 reason / 缺 key；对 `CASE_CREATED` 仍拒绝额外 key（回归）；`idempotency_keys` 两条 CHECK 允许 `CASE_SWITCH_PRIMARY` 的 bytea-only 表示（依赖 T705、T710） [VERIFY:`bunx vitest run tests/db/case-primary-switch-schema.test.ts` 预期 RED，保留输出]
- [ ] T721 [P] [REQ:FR-016;plan:D-9.6] 新增 `tests/db/case-primary-switch-rls.test.ts` RED：无 `app.family_id` 时 `cases` SELECT 0 行、`UPDATE ... RETURNING` 0 行、`INSERT` 被拒；错误 Family 上下文同样；正确 Family 下 `UPDATE` 恰好 1 行；`case_events` 仍不可 UPDATE / DELETE（依赖 T705、T710） [VERIFY:`bunx vitest run tests/db/case-primary-switch-rls.test.ts` 预期 RED，保留输出]
- [ ] T722 [P] [REQ:FR-001;FR-015;plan:D-3] 新增 `tests/db/case-primary-switch-concurrency.test.ts` RED：真实多连接；场景 A 双切换不同目标（期望 1×200 + 1×409 STALE，计数 ≤ 1）；场景 B 双切换同目标（1×200 + 1×409 ALREADY_PRIMARY）；场景 C 切换 vs 创建（计数 ≤ 1，创建语义不变）；场景 D 同 key 并发（1 业务结果，其余 REPLAY，事件计数不变）；**全程断言无 500**（依赖 T710） [VERIFY:`bunx vitest run tests/db/case-primary-switch-concurrency.test.ts` 预期 RED，保留输出]
- [ ] T723 [P] [REQ:FR-001;FR-002;FR-008;plan:V-2-1..4] 新增 `tests/integration/case-primary-switch-happy.test.ts` RED：首次切换、往返切换、晋升（admin fixture：全部 `is_primary=false`，**不写 `status`**）、读取一致（列表 primary 唯一、无 `/cases/current`）、`status`/`phase` 前后快照全等、原 Case 除 `updated_at`/`version` 外全等、两侧 reason 均可重建（依赖 T710） [VERIFY:`bunx vitest run tests/integration/case-primary-switch-happy.test.ts` 预期 RED，保留输出]
- [ ] T724 [P] [REQ:FR-004;FR-005;FR-011;FR-017;plan:D-8] 新增 `tests/integration/case-primary-switch-conflicts.test.ts` RED：已是 primary → 409 且版本不变、无事件；目标不存在 / 非法 UUID → 404（非 422）；陈旧视图 → 409 零写入；空 / 缺 / 空白 / 超长 reason → 422 且 `cases`/`case_events`/`business_audit_events`/`idempotency_keys` 零新增；未声明字段 → 422 零写入；目标 CLOSED / SAFETY_HOLD 的 DB 不可达性说明与 domain 覆盖交叉引用（依赖 T710） [VERIFY:`bunx vitest run tests/integration/case-primary-switch-conflicts.test.ts` 预期 RED，保留输出]
- [ ] T725 [P] [REQ:FR-003;plan:D-10.4] 新增 `tests/integration/case-primary-switch-authorization.test.ts` RED：普通成员 / guardian+成员但非 manager → 404 `CASE_NOT_FOUND`（响应体无 status/phase/primary/version）；跨家庭 → 404 + 同 Family 上下文的 RLS 直查 0 行；guardian 非成员 → `CURRENT_FAMILY_NOT_FOUND` 且**不出现** Case 层错误码（依赖 T710） [VERIFY:`bunx vitest run tests/integration/case-primary-switch-authorization.test.ts` 预期 RED，保留输出]
- [ ] T726 [P] [REQ:FR-010;plan:D-7] 新增 `tests/integration/case-primary-switch-idempotency.test.ts` RED：同 key 同 payload 重放返回原 body 且事件/审计/版本不变（**在 target 已成为 primary 之后重放**，专门锁 R-2）；同 key 不同目标 → 409 mismatch 且原结果不变；同 key 不同 reason → 409 mismatch；并发同 key → 1 业务结果；失败请求不留幂等行（依赖 T710） [VERIFY:`bunx vitest run tests/integration/case-primary-switch-idempotency.test.ts` 预期 RED，保留输出]
- [ ] T727 [P] [REQ:FR-012;plan:V-2-22] 新增 `tests/integration/case-primary-switch-atomicity.test.ts` RED：临时 trigger（按 `resource_id` 精确限定本测试 Family）使 `business_audit_events` 插入失败 → 请求返回 500 固定体 → `cases.is_primary` / `version` 未变、`case_events` 无新增、`idempotency_keys` 无新增；`afterAll` 必须 drop trigger 并断言已清理（依赖 T710） [VERIFY:`bunx vitest run tests/integration/case-primary-switch-atomicity.test.ts` 预期 RED，保留输出]
- [ ] T728 [P] [REQ:FR-020;plan:Change-Reconciliation-1] 新增 `tests/integration/case-primary-switch-scope.test.ts` RED：Case 操作恰为 4（`createCase` / `listCases` / `getCase` / `switchPrimaryCase`）；仅新增 `POST /api/v1/cases/:id/switch-primary`；`/cases/current`、`pause`、`resume`、`close`、`recurrences`、`messages`、`assessments`、`participants`、`scene`、`problem-formulations`、`evidence`、`statements`、`observations` **仍全部不存在**；DB 越界表仍不存在；`cases` 禁止列仍不存在（依赖 T710） [VERIFY:`bunx vitest run tests/integration/case-primary-switch-scope.test.ts` 预期 RED，保留输出]
- [ ] T729 [P] [REQ:FR-002;plan:D-12.4] 新增 `tests/integration/openapi-case-primary-switch.test.ts` RED：`switchPrimaryCase` operation 的 operationId / tags / security / params（`format: uuid`）/ requestBody strict 四字段 / 200 响应三字段 / 409 四类错误码 literal；既有三个 operation 的断言逐条保留（依赖 T710） [VERIFY:`bunx vitest run tests/integration/openapi-case-primary-switch.test.ts` 预期 RED，保留输出]

---

## Phase 3 — Reviewed Migration（单文件，**全串行**；中途不得 apply）

> T730—T736 全部编辑同一份 `004_case_primary_switch.sql`，禁止并行。为保持 reviewed migration 的原子性，**不得在任务中途运行 `db:migrate`**；只在 T737 一次性 apply 到空 schema 测试库。
> 顺序冻结：`case_events` 事件白名单 → `case_events` metadata 形状 → `business_audit_events` 事件白名单 → `idempotency_keys` 命令白名单 → `idempotency_keys` 表示不变量 → `cases` 列级 GRANT。

- [ ] T730 [REQ:FR-012;plan:D-9.2-1] 用 T705 实测的真实约束名，`DROP` + `ADD` `case_events` 的 `event_type` CHECK，白名单恰为 `('CASE_CREATED','CASE_PRIMARY_ASSIGNED','CASE_PRIMARY_REVOKED')`；不得放宽为任意字符串（依赖 T729、T705） [VERIFY:`rg -n "DROP CONSTRAINT|ADD CONSTRAINT|CASE_PRIMARY_ASSIGNED|CASE_PRIMARY_REVOKED" db/migrations/004_case_primary_switch.sql`；约束名与 T705 记录一致]
- [ ] T731 [REQ:FR-012;FR-008;plan:D-9.3] `DROP` + `ADD` `case_events_metadata_shape_check`，**逐 event_type 分支**：`CASE_CREATED` 保持原「恰为 `{primary, version}`」；`CASE_PRIMARY_ASSIGNED` 恰为 `{primary, version, previousPrimaryCaseId, reason}`；`CASE_PRIMARY_REVOKED` 恰为 `{primary, version, newPrimaryCaseId, reason}`；reason `btrim <> ''` 且 `length <= 500`；`version` 整数 ≥ 1；数值子句用 `CASE WHEN` 守护避免 cast 报错（依赖 T730） [VERIFY:`rg -n "case_events_metadata_shape_check|jsonb_typeof|btrim|length\\(metadata" db/migrations/004_case_primary_switch.sql`；表达式与 `plan.md` D-9.3 逐项对齐；不得出现无分支的单一 `jsonb_typeof(metadata)='object'` 简写]
- [ ] T732 [REQ:FR-012;plan:D-9.2-3] `DROP` + `ADD` `business_audit_events` 的 `event_type` CHECK：原 7 值（`FAMILY_CREATED` / `MEMBER_CREATED` / `MEMBER_PROFILE_VALUE_RECORDED` / `CONSENT_REQUEST_CREATED` / `CONSENT_GRANTED` / `CONSENT_REVOKED` / `CASE_CREATED`）+ `CASE_PRIMARY_SWITCHED`；`resource_type` **不新增值**（`CASE` 已存在，见 T715）（依赖 T731） [VERIFY:`rg -n "CASE_PRIMARY_SWITCHED|resource_type" db/migrations/004_case_primary_switch.sql`；`business_audit_events_resource_type_check` 未出现在 DROP 中；新白名单值数为 8]
- [ ] T733 [REQ:FR-010;plan:D-9.2-4] `DROP` + `ADD` `idempotency_keys` 的 `command_type` CHECK：原 7 值 + `CASE_SWITCH_PRIMARY`（依赖 T732） [VERIFY:`rg -n "CASE_SWITCH_PRIMARY|command_type" db/migrations/004_case_primary_switch.sql`]
- [ ] T734 [REQ:FR-010;plan:D-9.4] `DROP` + `ADD` `idempotency_keys_key_representation_check`：`command_type NOT IN ('CASE_CREATE','CASE_SWITCH_PRIMARY')` → text NOT NULL 且 bytes NULL；`command_type IN ('CASE_CREATE','CASE_SWITCH_PRIMARY')` → 恰有其一 NOT NULL；**不新增第三个唯一索引**（依赖 T733） [VERIFY:`rg -n "key_representation_check|CASE_SWITCH_PRIMARY" db/migrations/004_case_primary_switch.sql`；`rg -c "CREATE UNIQUE INDEX"` 在该文件中为 0]
- [ ] T735 [REQ:FR-001;plan:D-9.5;R-7] `GRANT UPDATE (is_primary, version, updated_at) ON cases TO xiaoshuyin_app`（**列级**）；**不得**写表级 `GRANT UPDATE ON cases`；`case_events` 不新增任何 GRANT（依赖 T734） [VERIFY:`rg -n "GRANT" db/migrations/004_case_primary_switch.sql` 恰为一行列级授权；`rg -n "GRANT UPDATE ON cases|GRANT .* ON case_events TO"` 为空]
- [ ] T736 [REQ:plan:D-9.1] 在文件头写清范围声明：本迁移不新增表 / 列 / 索引 / enum / policy；不修改 `001`/`002`/`003`；变更仅 5 处 CHECK + 1 条列级 GRANT；回滚见 `plan.md` D-9.7（依赖 T735） [VERIFY:`head -30 db/migrations/004_case_primary_switch.sql` 含上述声明；`git diff --name-only -- db/migrations/00[123]_*` 为空]
- [ ] T737 [REQ:FR-001;plan:D-9.8] 在**空 schema 测试库**一次性应用：`bun run db:migrate` 一次 APPLY，第二次全 SKIP；随后 `tests/db/case-primary-switch-schema.test.ts`、`case-primary-switch-rls.test.ts` 的结构与权限部分、`tests/db/roles.test.ts` 的列级断言、`tests/db/migration-repro.test.ts` 转绿（依赖 T736、T720、T721） [VERIFY:`bun run db:migrate` 输出 APPLY 与 Migration complete；再次运行全 SKIP；`bunx vitest run tests/db/case-primary-switch-schema.test.ts tests/db/case-primary-switch-rls.test.ts tests/db/roles.test.ts tests/db/migration-repro.test.ts` 全绿；`migration-repro` 的表 / policy / enum 计数与 T716 基线**完全一致**]

---

## Phase 4 — Domain 纯逻辑（GREEN；不同文件可并行）

- [ ] T738 [REQ:FR-004;FR-005;FR-011;plan:D-5;R-10] 新增 `packages/domain/src/case-primary-switch.ts`：`decideSwitchPrimary(input)` 纯函数，按 D-5 固定 6 步顺序返回 `DENY(code)` / `ALLOW(demote, promote)`；导出 `buildAssignedEventMetadata` / `buildRevokedEventMetadata` / `buildSwitchAuditMetadata`；**不读库、不写库、不含 I/O**（依赖 T717、T737） [VERIFY:`bunx vitest run tests/domain/case-primary-switch-decision.test.ts` 全绿；`rg -n "FROM |INSERT |UPDATE |pool|tx\\." packages/domain/src/case-primary-switch.ts` 为空]
- [ ] T739 [P] [REQ:FR-018;plan:D-6.2] 在 `packages/contracts/src/schemas.ts` 新增 `SwitchPrimaryCaseRequest`（`strictObject` + `superRefine` 表达视图配对不变量 + `reason` trim 非空与 ≤500）与 `SwitchPrimaryCaseResponse`（`primary` / `previousPrimary` / `switchedAt`）；**不修改** `CaseResponse` / `CaseListResponse` / `CreateCaseRequest`（依赖 T718） [VERIFY:`bunx vitest run tests/domain/case-primary-switch-contracts.test.ts` 全绿；`bun run typecheck` 通过]
- [ ] T740 [P] [REQ:FR-010;plan:D-7.1] 在 `packages/domain/src/idempotency.ts` 的 `IDEMPOTENCY_COMMAND_TYPES` 加入 `CASE_SWITCH_PRIMARY`；不改变 `canonicalJson` / `hashPayload` / `decideIdempotency` 语义（依赖 T737） [VERIFY:`rg -n "CASE_SWITCH_PRIMARY" packages/domain/src/idempotency.ts`；既有 `tests/domain/idempotency-hash.test.ts` 仍绿]
- [ ] T741 [REQ:FR-003;plan:D-10.2] 在 `packages/authorization/src/authorize.ts` 增量：`Action` / `REGISTERED_ACTIONS` / `CASE_ACTIONS` 各加 `CASE_SWITCH_PRIMARY`，并把它与 `CASE_READ` 同组要求 `case !== null`；**不新建** `authorizeCase()`；既有非 Case 动作行为不变（依赖 T719） [VERIFY:`bunx vitest run tests/domain/case-primary-switch-authorization.test.ts tests/domain/authorization.test.ts tests/domain/case-authorization.test.ts` 全绿]
- [ ] T742 [REQ:FR-017;plan:D-8] 在 `apps/server/api/src/plugins/error-handler.ts` 的 `ERROR_MAP` 增加 `CASE_ALREADY_PRIMARY: 409`、`CASE_CLOSED: 409`、`SAFETY_HOLD_BLOCKED: 409`、`STALE_PRIMARY_VIEW: 409`；不改变既有映射与 5xx 通用体（依赖 T737） [VERIFY:`rg -n "CASE_ALREADY_PRIMARY|CASE_CLOSED|SAFETY_HOLD_BLOCKED|STALE_PRIMARY_VIEW" apps/server/api/src/plugins/error-handler.ts`；`bun run typecheck` 通过]

---

## Phase 5 — Persistence / Transaction（同一 repository 文件，串行）

- [ ] T743 [REQ:FR-001;FR-011;plan:D-3.2/D-4] 在 `packages/domain/src/cases.ts` 新增 `getCurrentPrimaryForUpdate(tx, familyId)`：`SELECT ... FROM cases WHERE family_id=$1 AND is_primary AND status<>'CLOSED' FOR UPDATE`；返回 0/1 行；**>1 行由调用方抛 `INTERNAL_ERROR`**；不修改既有 `existsCurrentPrimary` / `listCases`（依赖 T738） [VERIFY:`rg -n "getCurrentPrimaryForUpdate|status <> 'CLOSED'|FOR UPDATE" packages/domain/src/cases.ts`；`bun run typecheck` 通过]
- [ ] T744 [REQ:FR-003;plan:D-4-9] 新增 `getCaseForUpdate(tx, caseId)`：按 id `FOR UPDATE` 返回单行或 `null`；RLS 自然完成跨 Family 隐藏；不修改既有 `getCaseById`（依赖 T743） [VERIFY:`rg -n "getCaseForUpdate" packages/domain/src/cases.ts`；`bun run typecheck`]
- [ ] T745 [REQ:FR-001;plan:D-4-16/R-4/R-5] 新增 `demotePrimaryCase(tx, caseId)`：`UPDATE cases SET is_primary=false, version=version+1, updated_at=now() WHERE id=$1 RETURNING id,status,phase,is_primary,version,created_at,updated_at`；**调用方必须断言返回 1 行**；不写 `status`/`phase`/`family_id`（依赖 T744） [VERIFY:`rg -n "is_primary = false|version = version \\+ 1|updated_at = now\\(\\)" packages/domain/src/cases.ts`；语句中不出现 `status =` 或 `phase =`]
- [ ] T746 [REQ:FR-001;plan:D-4-17/R-4/R-5] 新增 `promotePrimaryCase(tx, caseId)`：同上但 `is_primary=true`；**调用方必须断言返回 1 行**（依赖 T745） [VERIFY:`rg -n "is_primary = true" packages/domain/src/cases.ts`；两条 UPDATE 语句的列集合与 T745 完全对称]
- [ ] T747 [REQ:FR-012;plan:D-2.3/D-4-18..19] 新增 `insertPrimaryAssignedEvent(tx, {familyId, caseId, actorAccountId, version, previousPrimaryCaseId, reason})` 与 `insertPrimaryRevokedEvent(tx, {familyId, caseId, actorAccountId, version, newPrimaryCaseId, reason})`；`event_type` 用新词汇；`metadata` 显式写全 4 个 key；不修改既有 `insertCaseEvent`（依赖 T746） [VERIFY:`rg -n "CASE_PRIMARY_ASSIGNED|CASE_PRIMARY_REVOKED|previousPrimaryCaseId|newPrimaryCaseId" packages/domain/src/cases.ts`；两函数的 metadata key 集合与 D-9.3 一致]
- [ ] T748 [REQ:FR-012;plan:D-2.3/D-4-20] 新增 `insertPrimarySwitchAudit(tx, {familyId, caseId, actorAccountId, previousPrimaryCaseId, newPrimaryCaseId, previousVersion, newVersion, reason})`：`event_type='CASE_PRIMARY_SWITCHED'`、`resource_type='CASE'`、`resource_id=targetId`；不修改既有 `insertCaseAudit`（依赖 T747） [VERIFY:`rg -n "CASE_PRIMARY_SWITCHED|resource_type" packages/domain/src/cases.ts`；`bun run typecheck`]

---

## Phase 6 — Authorization / RLS 验证（不新增 policy）

- [ ] T749 [REQ:FR-016;plan:D-9.6] 验证 RLS 对 `UPDATE` 的真实效果：无上下文 / 错误 Family 下 `UPDATE ... RETURNING` 返回 0 行；正确 Family 下恰好 1 行；确认**未新增 policy**（`pg_policies` 计数与 T716 基线一致）（依赖 T737、T721） [VERIFY:`bunx vitest run tests/db/case-primary-switch-rls.test.ts` 全绿；`SELECT count(*) FROM pg_policies WHERE tablename IN ('cases','case_events');` 与基线一致]
- [ ] T750 [REQ:FR-003;plan:D-10.4] 验证授权端到端：manager 通过；普通成员 / guardian+成员 → 404 `CASE_NOT_FOUND`；跨家庭 → 404；guardian 非成员 → `CURRENT_FAMILY_NOT_FOUND`；确认响应体一致（依赖 T741） [VERIFY:`bunx vitest run tests/integration/case-primary-switch-authorization.test.ts` 全绿；逐类响应体 diff 为空]

---

## Phase 7 — API / OpenAPI

- [ ] T751 [REQ:FR-002;plan:D-12.1] 在 `apps/server/api/src/routes/cases.ts` 新增 `app.post('/api/v1/cases/:id/switch-primary', …)`：`onRequest: app.authenticate`；`schema` 含 `operationId: 'switchPrimaryCase'`、`tags: ['case']`、`security`、`params`（`format: uuid` 仅作文档，不做校验门）、`body: SwitchPrimaryCaseRequest`、`responses 200/401/404/409/422/500`；**不改动**既有 3 条路由（依赖 T739、T742、T748） [VERIFY:`rg -n "switch-primary|switchPrimaryCase" apps/server/api/src/routes/cases.ts`；`git diff` 中既有三条路由的 handler 主体无改动]
- [ ] T752 [REQ:plan:D-4;R-2] 在 handler 内按 D-4 序列实现：认证 → `requireCurrentFamily` → `withRlsTransaction` → `getFamilyById` → `authorize`（DENY → `404 CASE_NOT_FOUND`）→ 幂等 lookup（REPLAY/MISMATCH）→ 幂等 reserve（冲突再 lookup）→ Family 锁 → 当前 primary 重读（>1 → 500）→ 目标重读（0 → 404）→ 五类冲突（按固定顺序）→ reason 语义校验（422）→ 降级 → 升级 → 两侧事件 → 审计 → 回填 → 返回；4xx 保留契约体，5xx 重新抛出交给统一 `errorHandler`（依赖 T751、T743—T748） [VERIFY:`bunx vitest run tests/integration/case-primary-switch-happy.test.ts tests/integration/case-primary-switch-conflicts.test.ts` 全绿；`rg -n "23505" apps/server/api/src/routes/cases.ts` 为空（不得捕获唯一冲突）]
- [ ] T753 [REQ:plan:D-4-detail-2] 为两处 `UPDATE ... RETURNING` 增加「恰好 1 行」断言，0 行时抛 `INTERNAL_ERROR`（不得静默继续）；对 `getCurrentPrimaryForUpdate` 的 >1 行同样处理（依赖 T752） [VERIFY:`rg -n "RETURNING|INTERNAL_ERROR|rowCount|rows.length" apps/server/api/src/routes/cases.ts` 显示三处显式断言；构造错误 Family 上下文的用例返回 500 且无半写入]
- [ ] T754 [REQ:FR-002;plan:D-12.4] 运行 `bun run openapi:generate` 更新 `packages/generated/openapi.json` 与 `openapi.d.ts`；**不得 hand-edit**；不得改变既有 3 个 operation（依赖 T752） [VERIFY:`git diff --name-only -- packages/generated/` 只出现两个 generator 管理文件；两次生成 `shasum -a 256` 一致；`bun run openapi:check` PASS]
- [ ] T755 [REQ:FR-002;FR-020;plan:V-2-23] 精确收窄 `tests/integration/openapi-cases.test.ts`：`casePaths` 由 2 项扩为 3 项、`operations` 由 3 项扩为 4 项；**既有三个 operation 的 operationId / security / tags / 404 literal / 422 形状断言逐条保留**；随后运行 `tests/integration/openapi-case-primary-switch.test.ts` 与本文件，两者转绿（依赖 T754） [VERIFY:`bunx vitest run tests/integration/openapi-case-primary-switch.test.ts tests/integration/openapi-cases.test.ts` 全绿；Case path 集合为 3、operation 计数为 4；`git diff` 在该文件中仅 `casePaths` / `operations` 两处变更，断言删除行数为 0]

---

## Phase 8 — Event / Audit 端到端

- [ ] T756 [REQ:FR-012;plan:D-4-18..20] 验证成功切换在 `case_events` 产生恰好两条记录（目标 `CASE_PRIMARY_ASSIGNED`、原 primary `CASE_PRIMARY_REVOKED`；晋升分支只有一条 ASSIGNED），在 `business_audit_events` 产生恰好一条 `CASE_PRIMARY_SWITCHED`；三者 `metadata` key 集合与 D-9.3 完全一致（依赖 T752） [VERIFY:`bunx vitest run tests/integration/case-primary-switch-happy.test.ts tests/db/case-primary-switch-schema.test.ts` 全绿；真实行输出归档]
- [ ] T757 [REQ:FR-012;plan:V-2-22] 运行原子性用例：审计写入失败 → 500 固定体 → 主线未变、无事件、无幂等快照；`afterAll` 清理 trigger 并断言清理成功（依赖 T727、T752） [VERIFY:`bunx vitest run tests/integration/case-primary-switch-atomicity.test.ts` 全绿；失败前后 `cases` 行快照逐字节一致]
- [ ] T758 [REQ:FR-008;plan:V-2-2] 验证理由不被覆盖：往返切换 A→B→A 后，两条 ASSIGNED + 两条 REVOKED 事件的 `reason` 各自保留；`cases` 行无 `reason` 类列（依赖 T756） [VERIFY:查询四条事件的 `(event_type, metadata->>'reason')` 输出；`information_schema.columns` 对 `cases` 无 `switch_reason` / `previous_primary_id`]

---

## Phase 9 — Idempotency / 并发收敛

- [ ] T759 [REQ:FR-010;plan:D-7.3] 验证 canonical payload：`{familyId, targetCaseId, body:{reason, expectedPrimaryCaseId, expectedPrimaryVersion}}`；同 key 换目标 → MISMATCH、换 reason → MISMATCH、换视图版本 → MISMATCH（依赖 T752） [VERIFY:`bunx vitest run tests/integration/case-primary-switch-idempotency.test.ts` 全绿；三类 mismatch 的真实 409 响应归档]
- [ ] T760 [REQ:FR-010;R-2;plan:D-7.5] 验证「重放优先于状态」：一次成功切换后（target 已是 primary）用同 key 同 payload 重放 → `200` 原 body，**不得**返回 `409 CASE_ALREADY_PRIMARY`；事件 / 审计 / 版本计数不变（依赖 T759） [VERIFY:该用例单独运行并归档真实响应码与 body；若返回 409 → 立即停止，说明 R-2 实现错误，不得改测试]
- [ ] T761 [REQ:FR-015;plan:D-3.5] 验证唯一索引仍是不变量：迁移后 `cases_one_primary_open_per_family` 的 `indexdef` 与 `IMPLEMENT_BASE_SHA` 基线逐字节一致；故意构造第二条未结 primary 的直接写入被 `23505` 拒绝；应用路径不捕获该错误（依赖 T737、T752） [VERIFY:`SELECT indexdef FROM pg_indexes WHERE indexname='cases_one_primary_open_per_family';` 输出与基线 diff 为空；直写被拒的 SQLSTATE 归档；`rg -n "23505" apps/` 为空]
- [ ] T762 [REQ:FR-001;§39;plan:V-2-18/19] 运行并发套件（双切换不同目标 / 同目标 / 切换 vs 创建 / 同 key 并发），逐场景归档状态码组合与 `count(*) WHERE is_primary AND status<>'CLOSED'`（依赖 T761） [VERIFY:`bunx vitest run tests/db/case-primary-switch-concurrency.test.ts` 全绿，连续运行 3 次结果稳定；**任何 500 即失败**]

---

## Phase 10 — Acceptance 全量对齐

- [ ] T763 [REQ:Acceptance-1..4;plan:V-2] 逐条执行 Acceptance 1—4 并归档真实响应：首次切换 / 往返切换 / 晋升（`previousPrimary=null`，非 500）/ 读取一致（列表 primary 唯一、无 `/cases/current`）（依赖 T752） [VERIFY:`bunx vitest run tests/integration/case-primary-switch-happy.test.ts` + 真实 HTTP 响应输出归档；4/4 覆盖]
- [ ] T764 [REQ:Acceptance-5..9;plan:V-2] 逐条执行 Acceptance 5—9：非管理主体 / 跨家庭 / guardian 非成员 / 目标不存在与非法 ID / 已是 primary（依赖 T750、T752） [VERIFY:真实响应码 + body 归档；5/5 覆盖；跨家庭另有 RLS 直查 0 行证据]
- [ ] T765 [REQ:Acceptance-10..14;plan:V-2] 逐条执行 Acceptance 10—14：目标 CLOSED（domain 覆盖 + DB 不可达说明）/ 当前 primary SAFETY_HOLD / 目标 SAFETY_HOLD / reason 三类非法 / 未声明字段与缺视图（依赖 T738、T752） [VERIFY:5/5 覆盖；对 10—12 明确记录「以 domain 穷举为证据，未伪造 `status`」，符合 Spec Q3a]
- [ ] T766 [REQ:Acceptance-15..17;plan:V-2] 逐条执行 Acceptance 15—17：无副作用（越界表计数为 0、两 Case 内容未改写）/ 同 key 重放 / 同 key 不同目标（依赖 T756、T760） [VERIFY:3/3 覆盖；副作用检查输出为逐表 count]
- [ ] T767 [REQ:Acceptance-18..20;plan:V-2] 逐条执行 Acceptance 18—20：并发双切换 / 并发切换与创建 / 陈旧视图（依赖 T762） [VERIFY:3/3 覆盖；每次运行计数 ≤ 1]
- [ ] T768 [REQ:Acceptance-21..23;plan:V-2] 逐条执行 Acceptance 21—23：RLS 无上下文 / 审计原子性 / 结构越界（依赖 T749、T757、T755） [VERIFY:3/3 覆盖；越界表 / 路由枚举输出为空]
- [ ] T769 [REQ:FR-001..FR-020;plan:V-1] FR 覆盖审计：逐条确认 20 条 FR 各有至少一个真实测试文件与用例；缺口必须为 0（依赖 T763—T768） [VERIFY:审计输出 `FR 20/20`、`Acceptance 23/23`；missing 列表为空；不得以「设计已存在」代替]

---

## Phase 11 — Regression / Governance

- [ ] T770 [P] [REQ:FR-020;plan:Change-Reconciliation-1] 精确收窄 `tests/integration/cases-scope.test.ts`：从 `FORBIDDEN_ROUTE_FRAGMENTS`（现有 14 项，见 T714 清单）移除 `'/switch-primary'`，并新增「只允许 `POST /api/v1/cases/:id/switch-primary`」的正向断言；**其余 13 个禁止片段逐条保留**；`roots.length` / 结构断言按 4 个 operation 重算；`case_events` 词汇断言增加两个新类型并继续拒绝 `CASE_VIEWED` / `CASE_LISTED` / `CASE_ACCESSED`（依赖 T752） [VERIFY:`bunx vitest run tests/integration/cases-scope.test.ts` 全绿；`git diff` 中被移除的禁止片段数为 1（仅 `switch-primary`），其余 13 项存在性可逐条 grep 验证]
- [ ] T771 [P] [REQ:FR-020] 复核 OpenAPI 断言收窄未被削弱：`tests/integration/openapi-cases.test.ts` 中既有三个 operation 的 operationId / security / tags / 404 literal / 422 形状断言仍逐条存在；对比 `IMPLEMENT_BASE_SHA` 的版本，删除的断言行数必须为 0（唯一允许的变更是 `casePaths` 与 `operations` 两个集合）（依赖 T755） [VERIFY:`git diff "$IMPLEMENT_BASE_SHA"...HEAD -- tests/integration/openapi-cases.test.ts` 逐行审阅；`bunx vitest run tests/integration/openapi-cases.test.ts` 全绿]
- [ ] T772 [P] [REQ:plan:D-9.5/Change-Reconciliation-4] 收窄 `tests/db/roles.test.ts` 的 `cases` 断言：表级 `UPDATE` / `DELETE` / `TRUNCATE` 仍为 false；新增 `has_column_privilege` 断言——`is_primary` / `version` / `updated_at` 为 true，`id` / `family_id` / `created_by_person_id` / `status` / `phase` / `created_at` 为 false；`case_events` 仍只有 `SELECT, INSERT`；按 T713 实测结论记录差异，**不得**升级为表级授权（依赖 T737） [VERIFY:`bunx vitest run tests/db/roles.test.ts` 全绿；实测输出归档]
- [ ] T773 [P] [REQ:plan:Change-Reconciliation-5] 收窄 `tests/db/cases-events-metadata.test.ts` 的用例标题（`event_type vocabulary is closed to CASE_CREATED` → 读取审计词汇仍被拒），断言体保留；不得删除该用例（依赖 T737） [VERIFY:`bunx vitest run tests/db/cases-events-metadata.test.ts` 全绿；diff 中该用例的断言行无删除]
- [ ] T774 [REQ:plan:D-9.8] 证明零 schema 扩张：`tests/db/migration-repro.test.ts` 的表 / policy / enum 计数与 T716 基线完全一致；`db:evidence` 输出中无新表 / 新列 / 新索引（除 004 的 5 个 CHECK 替换）（依赖 T737） [VERIFY:`bunx vitest run tests/db/migration-repro.test.ts` 全绿；`bun run db:evidence` 输出与基线 diff 只含 5 处约束定义]
- [ ] T775 [REQ:FR-014;FR-019] 运行静态守卫并证明未弱化：`scripts/guard-static.mjs` 的 `FORBIDDEN_TABLE_PATTERNS` / `FORBIDDEN_PATHS` 未被删除或放宽；临时注入违规样例必须 exit 1，移除后 exit 0（依赖 T770） [VERIFY:`bun run guard:static` 输出 `PASS (0 violations)`；注入用例 exit 1 输出 rule 与文件行号；`git diff scripts/guard-static.mjs` 与 T716 基线一致或仅有合法增量]
- [ ] T776 [REQ:FR-009;FR-013] 负空间断言：不存在 `PauseCase` / `ResumeCase` / `CloseCase` / `CreateRecurrence` / Problem Formulation / Evidence writer / Participant / Safety runtime / AI / Notification / Plan / Task 的路由、表、命令或占位；不存在 `/cases/current`；不存在第二套审计 / 幂等 / 授权（依赖 T775） [VERIFY:`bunx vitest run tests/integration/case-primary-switch-scope.test.ts` + `pg_tables` / `printRoutes` 真实枚举输出归档；`rg -n "PauseCase|ResumeCase|CloseCase|CreateRecurrence|authorizeCase|risk_events|problem_formulations" apps/ packages/` 为空]

---

## Phase 12 — Final Verification

- [ ] T777 [REQ:plan:V-3] 全量回归：`bun run typecheck`、`bun run guard:static`、`bunx vitest run`、`bun run openapi:check`、空库 `bun run db:migrate` replay 两次；逐条检查输出（依赖 T770—T776） [VERIFY:全部命令 exit 0；无 skip / 无 expected-fail；输出归档到 `tests/evidence/`]
- [ ] T778 [REQ:AGENTS:§5;plan:审计一-F] 证据诚实性复核：任何无法运行的环境或命令报告 `BLOCKED` / `NOT VERIFIED`，不得以「设计已存在」或「分支已实现」替代；特别复核 Slice 2 依赖的证据来自**当前 main**而非分支（依赖 T777） [VERIFY:证据清单逐项标注来源与命令；`git rev-parse origin/main` 与 T702 记录一致]
- [ ] T779 [REQ:AGENTS:§7;plan:Change-Reconciliation] 治理复核：`git diff --name-only "$IMPLEMENT_BASE_SHA"...HEAD` 全量清单逐项分类为 expected（代码 / migration / tests / generated / 守卫合法增量 / tasks checkbox）或 unexpected；`Docs/**`、`specs/001-006/**`、`specs/007-case-primary-switch/spec.md`、`plan.md` 的语义 diff 必须为 0（依赖 T777） [VERIFY:`node .specify/scripts/validate-governance.mjs` 与 `node .specify/scripts/tests/run-governance-tests.mjs` 均 PASS；`git diff --name-only "$IMPLEMENT_BASE_SHA"...HEAD -- Docs specs/001-family-identity-core specs/002-case-core specs/003-evidence-core specs/004-case-participant-core specs/005-invited-identity-binding-contract specs/006-identity-binding-runtime specs/007-case-primary-switch/spec.md specs/007-case-primary-switch/plan.md` 输出为空；unexpected 计数 = 0]
- [ ] T780 [REQ:AGENTS:§3;plan:Blockers] **Implement Final Handoff**：仅当 T701—T779 全部完成、G1—G8 PASS、全量回归 PASS、FR 20/20、Acceptance 23/23、治理 PASS、unexpected = 0 时，输出 `IMPLEMENT COMPLETE — READY FOR INDEPENDENT CONVERGE` 并停止；任一未解决 → `BLOCKED` 并报告具体 Task 与证据。**停止边界**：不得自行充当审计二、不得宣布可 merge、不得 merge main、不得修改冻结需求以消除 gap（依赖 T779） [VERIFY:最终报告含逐项完成状态与真实命令输出；`git status --short` 无未提交残留；输出固定文案后停止]

---

## Coverage Map

### FR → Tasks

| FR | 主要任务 |
|---|---|
| FR-001 | T722、T743—T746、T752、T762、T769 |
| FR-002 | T729、T751、T754、T755、T770、T771 |
| FR-003 | T719、T741、T750、T752、T764 |
| FR-004 | T717、T738、T752、T765 |
| FR-005 | T717、T738、T752、T765 |
| FR-006 | T723、T752、T766 |
| FR-007 | T723、T758、T766 |
| FR-008 | T723、T731、T747、T758 |
| FR-009 | T728、T776 |
| FR-010 | T726、T733、T734、T740、T759、T760 |
| FR-011 | T718、T723、T724、T743、T767 |
| FR-012 | T720、T730—T732、T747、T748、T756、T757 |
| FR-013 | T719、T741、T776 |
| FR-014 | T728、T732、T774、T776 |
| FR-015 | T722、T753、T761、T762 |
| FR-016 | T721、T749、T768 |
| FR-017 | T724、T742、T752 |
| FR-018 | T718、T739、T765 |
| FR-019 | T728、T776 |
| FR-020 | T728、T770、T771、T775 |

### Acceptance → Tasks

| # | 任务 | # | 任务 |
|---|---|---|---|
| 1 | T723、T763 | 13 | T724、T765 |
| 2 | T723、T758、T763 | 14 | T724、T765 |
| 3 | T723、T763 | 15 | T766 |
| 4 | T723、T763 | 16 | T726、T760、T766 |
| 5 | T725、T764 | 17 | T726、T759、T766 |
| 6 | T721、T725、T764 | 18 | T722、T762、T767 |
| 7 | T725、T764 | 19 | T722、T762、T767 |
| 8 | T724、T764 | 20 | T724、T767 |
| 9 | T724、T764 | 21 | T721、T749、T768 |
| 10 | T717、T765 | 22 | T727、T757、T768 |
| 11 | T717、T738、T765 | 23 | T728、T768、T776 |
| 12 | T717、T738、T765 | | |

### Plan 决策 → Tasks

| Plan 段 | 任务 |
|---|---|
| D-1 / D-13（实现模型与负空间） | T751、T776 |
| D-2（数据模型 / 零扩张） | T735、T736、T774 |
| D-3（并发四层 + 锁顺序） | T711、T722、T743、T745、T746、T761、T762 |
| D-4（事务序列） | T752、T753 |
| D-5（冲突判定纯函数） | T717、T738 |
| D-6（陈旧视图） | T718、T739 |
| D-7（幂等） | T712、T733、T734、T740、T759、T760 |
| D-8（失败语义） | T724、T742、T752 |
| D-9（migration） | T705、T713、T730—T737、T772—T774 |
| D-10（授权） | T719、T741、T750 |
| D-11（Safety 谓词） | T717、T738、T765 |
| D-12（API 契约） | T729、T739、T751、T754、T755 |

---

## Dependency Graph

| Phase | 边 |
|---|---|
| 0 | T701 ← ∅；T702 ← T701；T703 ← T702；T704 ← T702；T705 ← T702；T706 ← T702；T707 ← T702；T708 ← T702；T709 ← T703—T708 |
| 1 | T710 ← T709；T711 ← T710；T712 ← T710；T713 ← T710；T714 ← T710；T715 ← T705；T716 ← T710 |
| 2 | T717 ← T710；T718 ← T710；T719 ← T710；T720 ← T705、T710；T721 ← T705、T710；T722 ← T710；T723 ← T710；T724 ← T710；T725 ← T710；T726 ← T710；T727 ← T710；T728 ← T710；T729 ← T710 |
| 3 | T730 ← T729、T705；T731 ← T730；T732 ← T731；T733 ← T732；T734 ← T733；T735 ← T734；T736 ← T735；T737 ← T736、T720、T721 |
| 4 | T738 ← T717、T737；T739 ← T718；T740 ← T737；T741 ← T719；T742 ← T737 |
| 5 | T743 ← T738；T744 ← T743；T745 ← T744；T746 ← T745；T747 ← T746；T748 ← T747 |
| 6 | T749 ← T737、T721；T750 ← T741 |
| 7 | T751 ← T739、T742、T748；T752 ← T751、T743—T748；T753 ← T752；T754 ← T752；T755 ← T754 |
| 8 | T756 ← T752；T757 ← T727、T752；T758 ← T756 |
| 9 | T759 ← T752；T760 ← T759；T761 ← T737、T752；T762 ← T761 |
| 10 | T763 ← T752；T764 ← T750、T752；T765 ← T738、T752；T766 ← T756、T760；T767 ← T762；T768 ← T749、T757、T755；T769 ← T763—T768 |
| 11 | T770 ← T752；T771 ← T755；T772 ← T737；T773 ← T737；T774 ← T737；T775 ← T770；T776 ← T775 |
| 12 | T777 ← T770—T776；T778 ← T777；T779 ← T777；T780 ← T779 |

**一致性结论**：100 条依赖边全部满足 `依赖 id < 任务 id`（无前向依赖）；边集构成 DAG（无环）；Phase 2（RED）先于 Phase 3—9（实现）；Phase 3 是单文件串行链，保证与 `plan.md` D-9 的语句顺序一致；Phase 10 只消费已完成实现，不新增设计；Phase 11 的 OpenAPI 复核（T771）依赖 Phase 7 的收窄（T755），方向单调。

---

## Execution Batches

| Batch | 内容 | 并行性 |
|---|---|---|
| G | Phase 0 门禁 T701—T709 | **串行**；T709 未 PASS 不得进入 Phase 1 |
| A | Phase 1 baseline T711—T716 | T711—T715 可 `[P]`（只读、不同目标）；T716 必须最后 |
| B | Phase 2 RED tests T717—T729 | 可 `[P]`（不同测试文件） |
| C | Phase 3 migration T730—T737 | **全串行**（同一文件）；T737 一次性 apply |
| D | Phase 4 域逻辑 T738—T742 | T739、T740、T741 可 `[P]`；T738 串行 |
| E | Phase 5 persistence T743—T748 | **串行**（同一 repository 文件） |
| F | Phase 6 授权 / RLS T749—T750 | T749 与 T750 可 `[P]` |
| H | Phase 7 API T751—T755 | T751—T753 串行；T754—T755 串行 |
| I | Phase 8 事件 / 审计 T756—T758 | 串行（同一条验证链） |
| J | Phase 9 幂等 / 并发 T759—T762 | 串行 |
| K | Phase 11 守卫收窄 T770—T776 | T770—T774 可 `[P]`；T775—T776 串行 |
| L | Phase 10 验收 T763—T769 | 串行（T755 已在 Phase 7 完成 OpenAPI 收窄，此处只消费） |
| M | Phase 12 最终验证 T777—T780 | **全串行**；T780 输出后停止并移交审计二 |

---

## Evidence（Implement 阶段填写，本轮为空）

| 项 | 值 |
|---|---|
| `IMPLEMENT_BASE_SHA` | 待 T710 填写 |
| `origin/main`（Implement 时） | 待 T702 填写 |
| Slice 2 final head | 待 T702 填写 |
| 迁移文件名 | 待 T707 填写 |
| 全量回归结果 | 待 T777 填写 |
| FR / Acceptance 覆盖 | 待 T769 填写 |

---

## 本轮结束状态

```text
PLAN / CHECKLIST / TASKS FINAL PASS
AUDIT 1 FINAL PASS
PLAN FROZEN

IMPLEMENT BLOCKED BY:
Slice 2 审计二 PASS + merge main
```

**未解决计划问题：0。** **本轮未修改任何实现文件、migration、测试或 `Docs/**`。**
