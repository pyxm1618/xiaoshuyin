# Tasks: Case 主问题切换（`SwitchPrimaryCase`）

**Feature**: `specs/007-case-primary-switch/spec.md`（冻结 @ `00db327`）
**Plan**: `specs/007-case-primary-switch/plan.md`（Round 2；D-1—D-14、R-1—R-16）
**Checklist**: `specs/007-case-primary-switch/checklists/requirements-quality.md`（233/233 PASS）
**Branch**: `feat/007-case-primary-switch`
**Tasks 生成时 Head**: `00db327746fab7fcc02f1dd3734c6965bfd95444`
**`origin/main`**: `ee9d07e059566884e0329fb0eb4a4ab9dbf8ea83`
**阶段**: **Tasks only**。本文件只把已冻结的 Spec / Plan 拆成可执行任务图；**不进入 Implement、不写业务代码、不写 migration、不写测试实现**。

> **两种语境，不得混用**
> - **本轮 = Tasks authoring + 审计一**：只改 `plan.md` / `checklists/requirements-quality.md` / `tasks.md`。`Docs/**`、`specs/001-006/**`、`spec.md`、`apps/**`、`packages/**`、`db/**`、`tests/**` 的 diff 必须为 0。
> - **T701—T786 = 未来 Implement 执行**：届时业务代码、新 migration、tests、generated OpenAPI、本文件 checkbox 都是**预期改动**。
> - **本轮结束状态**：`PLAN / CHECKLIST / TASKS FINAL PASS` + `IMPLEMENT BLOCKED BY SLICE 2`。

> **任务格式**：`- [ ] T7## [P] [REQ:<FR / plan D-x / R-x / Gx>] <目标>。文件：<路径>。依赖：<T7##>。 [VERIFY:<真实命令或可归档证据>]`
> `[P]` 仅表示：所列前置全部完成后，与同批次其它 `[P]` 任务无文件冲突，可并行。
> 每条任务必须同时具备 `[REQ:…]` 与 `[VERIFY:…]`；缺任一项即无效。

---

## Phase 0 — Dependency Gate（硬前置；T712 起不得执行）

> 对应 `plan.md` §0.3 G1—G10。**任一失败即停止**，并输出固定文案。
> 失败文案：`IMPLEMENT BLOCKED — SLICE 2 NOT MERGED` / `IMPLEMENT BLOCKED — SLICE 2 CONTRACT DRIFT` / `IMPLEMENT BLOCKED — SLICE 2 SEMANTICS CHANGED` / `IMPLEMENT BLOCKED — IDEMPOTENCY TRANSPORT DRIFT` / `IMPLEMENT BLOCKED — MIGRATION NUMBERING CONFLICT` / `IMPLEMENT BLOCKED — BASELINE NOT GREEN`。**不得改写文案。**

- [x] T701 [REQ:plan:G1] 验证 G1：Slice 2 已完成**审计二 PASS**且无未解决 finding；记录结论来源（PR review / converge 报告的文件路径或链接）与日期。依赖：∅。 [VERIFY:审计二结论原文 + PASS 判定；若为 BLOCKED / 有条件 PASS → 停止并输出 `IMPLEMENT BLOCKED — SLICE 2 NOT MERGED`]
- [x] T702 [REQ:plan:G2] 验证 G2：Slice 2 已 merge `main`；`git fetch origin` 后 `git merge-base --is-ancestor <slice2-final-head> origin/main` 退出 0；记录新旧 `origin/main` SHA。依赖：T701。 [VERIFY:`git rev-parse origin/main` 输出 + `git log --oneline ee9d07e..origin/main` 清单；merge 提交存在]
- [x] T703 [REQ:plan:G3] 验证 G3：`origin/main` 真实包含 Case runtime。依赖：T702。 [VERIFY:`git ls-tree -r --name-only origin/main -- db/migrations/ apps/server/api/src/routes/ packages/domain/src/` 同时出现 `*_case_core.sql`、`*_case_idempotency_key_bytes.sql`、`routes/cases.ts`、`domain/src/cases.ts`]
- [x] T704 [P] [REQ:plan:G4] 验证 G4：锁与 primary 决策语义未 drift。文件：`packages/domain/src/cases.ts`、`db/migrations/*_case_core.sql`。依赖：T702。 [VERIFY:`rg -n "FOR UPDATE|EXISTS" packages/domain/src/cases.ts` 显示锁语句与 `existsCurrentPrimary` 是两条独立语句；`SELECT indexdef FROM pg_indexes WHERE indexname='cases_one_primary_open_per_family';` 输出含 `WHERE (is_primary AND (status <> 'CLOSED'::case_status))`]
- [x] T705 [P] [REQ:plan:G5] 验证 G5：幂等语义未 drift。文件：`packages/domain/src/cases.ts`、`packages/domain/src/idempotency.ts`。依赖：T702。 [VERIFY:`rg -n "ON CONFLICT DO NOTHING|FOR SHARE|response_status" packages/domain/src/cases.ts`；`rg -n "IDEMPOTENCY_COMMAND_TYPES" packages/domain/src/idempotency.ts`；三函数签名与 `plan.md` D-7.5 逐条比对，输出归档]
- [x] T706 [P] [REQ:plan:G6] 验证 G6：授权语义未 drift。文件：`packages/authorization/src/authorize.ts`。依赖：T702。 [VERIFY:`rg -n "CASE_ACTIONS|MANAGER_ACTIONS|REGISTERED_PURPOSES" packages/authorization/src/authorize.ts` 输出与 Plan D-10.2 一致；`rg -n "authorizeCase" packages/` 为空]
- [x] T707 [P] [REQ:plan:G7] 验证 G7：真实约束名与谓词。依赖：T702。 [VERIFY:`SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid IN ('case_events'::regclass,'business_audit_events'::regclass,'idempotency_keys'::regclass) ORDER BY conname;` 原样归档；与 `plan.md` D-9.2 六个对象逐字比对；不一致 → `IMPLEMENT BLOCKED — SLICE 2 CONTRACT DRIFT`]
- [x] T708 [P] [REQ:plan:G8] 验证 G8：migration 编号可用。依赖：T702。 [VERIFY:`ls db/migrations` 输出；取最大序号 N；`test ! -e db/migrations/$(printf "%03d" $((N+1)))_case_primary_switch.sql` 退出 0；`git diff --name-only origin/main -- 'db/migrations/00[123]_*'` 为空]
- [x] T709 [P] [REQ:plan:G9] 验证 G9：合并后的 `origin/main` 全量基线绿。依赖：T702。 [VERIFY:`bun run typecheck`、`bun run guard:static`、`bunx vitest run`、`bun run openapi:check` 四条全 exit 0 且无 skip / expected-fail；失败 → `IMPLEMENT BLOCKED — BASELINE NOT GREEN`]
- [x] T710 [P] [REQ:plan:G10;R-11] 验证 G10：Case 命令族只有一种幂等传输。文件：`apps/server/api/src/routes/cases.ts`、`packages/contracts/src/schemas.ts`。依赖：T702。 [VERIFY:`git grep -n "idempotencyKey" -- apps/server/api/src packages/contracts/src` 在 Case 相关文件中为空；`rg -n "readIdempotencyKey" apps/server/api/src/routes/cases.ts` 非空；`CreateCaseRequest` 无 `idempotencyKey` 字段。任一不满足 → `IMPLEMENT BLOCKED — IDEMPOTENCY TRANSPORT DRIFT`]
- [x] T711 [REQ:plan:0.3] Gate 判定与阻断协议：逐项记录 G1—G10 结果；任一失败按固定文案停止，**不得开始 T712**。依赖：T703—T710。 [VERIFY:10 项结果清单 + 失败项现场输出；全部 PASS 才允许进入 Phase 1]

---

## Phase 1 — Baseline Alignment（只读，不重新设计 Slice 1 / 2）

> 目的：把 Plan 中所有"假设"替换成"实测事实"，并记录 `IMPLEMENT_BASE_SHA`。本 Phase 不产生任何实现改动。

- [x] T712 [REQ:plan:0.1] 记录 `IMPLEMENT_BASE_SHA` 与 `origin/main` SHA 到本文件 Evidence 段；该 SHA 是后续所有 diff 分类的基线。依赖：T711。 [VERIFY:`git rev-parse HEAD`、`git rev-parse origin/main` 输出；`git status --short` clean]
- [x] T713 [P] [REQ:plan:D-3.2] 复核 `lockFamilyForPrimaryDecision` / `existsCurrentPrimary` 的真实实现，确认"锁语句与判定语句分离"；记录行号。文件：`packages/domain/src/cases.ts`。依赖：T712。 [VERIFY:`rg -n "lockFamilyForPrimaryDecision|existsCurrentPrimary|FOR UPDATE" packages/domain/src/cases.ts` 输出归档]
- [x] T714 [P] [REQ:plan:D-7.5;R-16] 复核幂等三函数与 header 助手的真实签名：`reserveIdempotency` / `getReservedIdempotency` / `completeIdempotency` / `readIdempotencyKey`。文件：`packages/domain/src/cases.ts`、`apps/server/api/src/idempotency.ts`。依赖：T712。 [VERIFY:`rg -n "export async function (reserveIdempotency|getReservedIdempotency|completeIdempotency)" packages/domain/src/cases.ts`；`rg -n "export function readIdempotencyKey" apps/server/api/src/idempotency.ts`；签名与 Plan D-7.5 伪码逐条比对]
- [x] T715 [P] [REQ:plan:D-9.5] 实测列级授权的判定语义（**只读实测，不提交 DDL**）：在临时库上 `GRANT UPDATE (is_primary) ON cases TO xiaoshuyin_app` 后分别查 `has_table_privilege` 与 `has_column_privilege`，记录后回滚。依赖：T712。 [VERIFY:`SELECT has_table_privilege('xiaoshuyin_app','cases','UPDATE') AS table_level, has_column_privilege('xiaoshuyin_app','cases','is_primary','UPDATE') AS column_level;` 两组真实输出归档；若 `table_level = true` → 说明 GRANT 会被写成表级，T738 必须改为列级写法，**不得**反过来放宽测试]
- [x] T716 [P] [REQ:plan:D-14] 清点将被精确收窄的断言面，逐条列出"改什么 / 保留什么"。文件：`tests/integration/cases-scope.test.ts`、`tests/integration/openapi-cases.test.ts`、`tests/db/roles.test.ts`、`tests/db/cases-events-metadata.test.ts`。依赖：T712。 [VERIFY:`rg -n "FORBIDDEN_ROUTE_FRAGMENTS|switch-primary|casePaths|operations.sort|closed to CASE_CREATED|TRUNCATE" tests/` 输出；另归档当前 `app.printRoutes({commonPrefix:false})` 的原始文本（用于判定新增 `/:id/switch-primary` 后 `roots.length` 与 `/:id (GET)` 是否变化）]
- [x] T717 [P] [REQ:plan:D-9.2] 复核 `business_audit_events_resource_type_check` 现状，确认 `CASE` 已在白名单、本 Slice 不需修改它。依赖：T707。 [VERIFY:`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='business_audit_events_resource_type_check';` 输出含 `CASE`]
- [x] T718 [REQ:plan:V-3] 建立基线测试快照：未改任何代码前跑 `bunx vitest run`、`bun run typecheck`、`bun run guard:static`、`bun run openapi:check`，记录 exit code 与摘要。依赖：T712。 [VERIFY:四条命令的 exit code 与摘要归档；基线本身有失败 → 报告 `BLOCKED — BASELINE NOT GREEN` 并停止]

---

## Phase 2 — Failing Tests（RED，test-first；只写测试，不写实现）

> 每个 RED 任务必须记录"失败原因是目标产物尚不存在"，不得把环境故障当 RED。

- [x] T719 [P] [REQ:FR-004;FR-005;FR-011;plan:D-5;R-10] 新增 `tests/domain/case-primary-switch-decision.test.ts`：`decideSwitchPrimary()` 的 6 status × 4 类视图全组合；顺序断言（CLOSED 先于 SAFETY、ALREADY 先于 STALE）；`ALLOW` 时 `demote` 为 `null` 当且仅当 `current === null`；**不得**出现常量谓词。文件：`tests/domain/case-primary-switch-decision.test.ts`。依赖：T712。 [VERIFY:`bunx vitest run tests/domain/case-primary-switch-decision.test.ts` 预期 RED（模块不存在），保留输出]
- [x] T720 [P] [REQ:FR-011;FR-018;plan:D-6.2] 新增 `tests/domain/case-primary-switch-contracts.test.ts`：`SwitchPrimaryCaseRequest` strict；`reason` 原始长度 1—500 且 trim 非空；视图六态（双 null / 双有效 / 一 null 一有效 → 拒绝 / 缺键 → 拒绝 / id 非 uuid → 拒绝 / version < 1 → 拒绝）；未声明字段 `isPrimary`、`primary`、`version`、`status`、`phase`、`familyId`、`targetCaseId`、`idempotencyKey` 全部拒绝；`SwitchPrimaryCaseResponse` 恰为 `primary` / `previousPrimary` / `switchedAt`。文件：`tests/domain/case-primary-switch-contracts.test.ts`。依赖：T712。 [VERIFY:`bunx vitest run tests/domain/case-primary-switch-contracts.test.ts` 预期 RED，保留输出]
- [x] T721 [P] [REQ:FR-003;FR-013;plan:D-10.2] 新增 `tests/domain/case-primary-switch-authorization.test.ts`：`CASE_SWITCH_PRIMARY` 在注册表；`family=null → FAMILY_CONTEXT_REQUIRED`；`purpose≠FAMILY_MANAGEMENT → UNSUPPORTED_PURPOSE`；`createdByPersonId` 缺失/≠ actor → `NOT_FAMILY_MANAGER`；`case=null → CASE_CONTEXT_REQUIRED`；manager + case 维度 → ALLOW；既有 Slice 1/2 授权用例行为不变。文件：`tests/domain/case-primary-switch-authorization.test.ts`。依赖：T712。 [VERIFY:`bunx vitest run tests/domain/case-primary-switch-authorization.test.ts` 预期 RED，保留输出]
- [x] T722 [P] [REQ:FR-012;plan:D-9.2/D-9.3] 新增 `tests/db/case-primary-switch-schema.test.ts`：`case_events` 词汇恰为 3 值且不含 `CASE_VIEWED`；`metadata` 对 `CASE_PRIMARY_ASSIGNED` / `CASE_PRIMARY_REVOKED` 接受合法形状、拒绝额外 key / 非 boolean `primary` / 非整数 `version` / 空或超 500 的 reason / 缺 key；对 `CASE_CREATED` 仍拒绝额外 key（回归）；`idempotency_keys` 允许 `CASE_SWITCH_PRIMARY` 的 bytea-only 行、**拒绝**其 text-only 行；`cases` 仍 9 列。文件：`tests/db/case-primary-switch-schema.test.ts`。依赖：T707、T712。 [VERIFY:`bunx vitest run tests/db/case-primary-switch-schema.test.ts` 预期 RED，保留输出]
- [x] T723 [P] [REQ:FR-016;plan:D-9.6] 新增 `tests/db/case-primary-switch-rls.test.ts`：无 `app.family_id` 时 `cases` SELECT 0 行、`UPDATE ... RETURNING` 0 行、`INSERT` 被拒；错误 Family 上下文同样；正确 Family 下 `UPDATE` 恰好 1 行；`case_events` 仍不可 UPDATE / DELETE。文件：`tests/db/case-primary-switch-rls.test.ts`。依赖：T707、T712。 [VERIFY:`bunx vitest run tests/db/case-primary-switch-rls.test.ts` 预期 RED，保留输出]
- [x] T724 [P] [REQ:FR-001;FR-015;plan:D-3] 新增 `tests/db/case-primary-switch-concurrency.test.ts`：真实多连接。场景 A 双切换不同目标（1×200 + 1×409 `STALE_PRIMARY_VIEW`，计数 ≤ 1）；场景 B 双切换同目标（1×200 + 1×409 `CASE_ALREADY_PRIMARY`）；场景 C 切换 vs 创建（计数 ≤ 1，创建语义不变）；场景 D 同 key 并发（1 业务结果，其余 REPLAY，事件计数不变）；**全程断言无 500**。文件：`tests/db/case-primary-switch-concurrency.test.ts`。依赖：T712。 [VERIFY:`bunx vitest run tests/db/case-primary-switch-concurrency.test.ts` 预期 RED，保留输出]
- [x] T725 [P] [REQ:FR-001;FR-002;FR-008;plan:V-2-1..4] 新增 `tests/integration/case-primary-switch-happy.test.ts`：首次切换、往返切换、晋升（admin fixture：全部 `is_primary=false`，**不写 `status`**）、读取一致（列表 primary 唯一、无 `/cases/current`）、`status`/`phase` 前后快照全等、原 Case 除 `updated_at`/`version` 外全等、两侧 reason 均可重建。文件：`tests/integration/case-primary-switch-happy.test.ts`。依赖：T712。 [VERIFY:`bunx vitest run tests/integration/case-primary-switch-happy.test.ts` 预期 RED，保留输出]
- [x] T726 [P] [REQ:FR-004;FR-005;FR-011;FR-017;plan:D-8] 新增 `tests/integration/case-primary-switch-conflicts.test.ts`：已是 primary → 409 且版本不变、无事件；目标不存在 / 非法 UUID → 404（非 422）；陈旧视图 → 409 零写入；空 / 缺 / 空白 / 超长 reason → 422 且四张表零新增；**形状错误 + 陈旧视图同时存在 → 必须 422 而非 409**；未声明字段（含 body 内 `idempotencyKey`）→ 422 零写入；目标 CLOSED / SAFETY_HOLD 与 domain 覆盖交叉引用。文件：`tests/integration/case-primary-switch-conflicts.test.ts`。依赖：T712。 [VERIFY:`bunx vitest run tests/integration/case-primary-switch-conflicts.test.ts` 预期 RED，保留输出]
- [x] T727 [P] [REQ:FR-003;plan:D-10.4] 新增 `tests/integration/case-primary-switch-authorization.test.ts`：普通成员 → 404 `CASE_NOT_FOUND`（响应体无 status/phase/primary/version，且与 `GET /cases/:id` 的 404 逐字节一致）；跨家庭 → 404 + 该 Family 上下文直查 0 行；guardian 非成员 → `CURRENT_FAMILY_NOT_FOUND` 且不出现 Case 层错误码；**断言响应中不含 `NOT_FAMILY_MANAGER`**。文件：`tests/integration/case-primary-switch-authorization.test.ts`。依赖：T712。 [VERIFY:`bunx vitest run tests/integration/case-primary-switch-authorization.test.ts` 预期 RED，保留输出]
- [x] T728 [P] [REQ:FR-010;plan:D-7] 新增 `tests/integration/case-primary-switch-idempotency.test.ts`：**缺 `Idempotency-Key` header → 422**；header 长度 7 / 129 → 422；同 key 同 payload 重放返回原 body 且事件/审计/版本不变（**在 target 已成为 primary 之后重放**，专门锁 R-2）；同 key 不同目标 → 409 mismatch；同 key 不同 reason → 409 mismatch；同 key 不同视图 → 409 mismatch；并发同 key → 1 业务结果；失败请求不留幂等行。文件：`tests/integration/case-primary-switch-idempotency.test.ts`。依赖：T712。 [VERIFY:`bunx vitest run tests/integration/case-primary-switch-idempotency.test.ts` 预期 RED，保留输出]
- [x] T729 [P] [REQ:FR-012;plan:V-2-22] 新增 `tests/integration/case-primary-switch-atomicity.test.ts`：临时 trigger（按 `resource_id` 精确限定本测试 Family）使 `business_audit_events` 插入失败 → 返回 500 固定体 → `cases.is_primary` / `version` 未变、`case_events` 无新增、`idempotency_keys` 无新增；`afterAll` 必须 drop trigger 并断言已清理。文件：`tests/integration/case-primary-switch-atomicity.test.ts`。依赖：T712。 [VERIFY:`bunx vitest run tests/integration/case-primary-switch-atomicity.test.ts` 预期 RED，保留输出]
- [x] T730 [P] [REQ:FR-020;plan:D-14.1] 新增 `tests/integration/case-primary-switch-scope.test.ts`：Case business operation = 5（current main baseline 4：`createCase` / `listCases` / `getCase` / message；Slice 7 新增 `switchPrimaryCase`；Slice 7 delta = exactly 1）；真实 main 的 `participation-invites` 路径保留但不计入这 4 个 business operations；仅新增 `POST /api/v1/cases/:id/switch-primary`；`/cases/current`、`pause`、`resume`、`close`、`recurrences`、`assessments`、`participants`、`scene`、`problem-formulations`、`evidence`、`statements`、`observations` **仍全部不存在**（`messages` 与 `participation-invites` 属真实 main，不得断言不存在）；DB 越界表仍不存在；`cases` 禁止列仍不存在。文件：`tests/integration/case-primary-switch-scope.test.ts`。依赖：T712。 [VERIFY:`bunx vitest run tests/integration/case-primary-switch-scope.test.ts` 预期 RED，保留输出]
- [x] T731 [P] [REQ:FR-002;plan:D-12.4] 新增 `tests/integration/openapi-case-primary-switch.test.ts`：`switchPrimaryCase` operation 的 operationId / tags / security / `Idempotency-Key` header parameter / params（`format: uuid`）/ requestBody strict 三字段 / 200 响应三字段 / 409 四类错误码 literal；既有四个 operation（含 `createCaseMessage`）的断言逐条保留。文件：`tests/integration/openapi-case-primary-switch.test.ts`。依赖：T712。 [VERIFY:`bunx vitest run tests/integration/openapi-case-primary-switch.test.ts` 预期 RED，保留输出]
- [x] T732 [P] [REQ:FR-010;plan:D-7.5;R-14] 新增 `tests/domain/case-primary-switch-idempotency.test.ts`：用受控 fake `tx` 驱动 `acquireIdempotencySlot()` 五态——OWNED / REPLAY（含 body 与 status 原样返回）/ MISMATCH / POISONED（`response_status = 0`）/ CONTENTION（连续两次占位失败且查无行 → 有界重试耗尽，**恰好调用 reserve 2 次**）。文件：`tests/domain/case-primary-switch-idempotency.test.ts`。依赖：T712。 [VERIFY:`bunx vitest run tests/domain/case-primary-switch-idempotency.test.ts` 预期 RED，保留输出；断言 reserve 调用次数被显式记录]

---

## Phase 3 — Reviewed Migration（单文件，**全串行**；中途不得 apply）

> T733—T739 全部编辑同一份新 migration 文件，禁止并行。为保持 reviewed migration 的原子性，**不得在任务中途运行 `db:migrate`**；只在 T740 一次性 apply。
> 顺序冻结：`case_events` 事件白名单 → `case_events` metadata 形状 → `business_audit_events` 事件白名单 → `idempotency_keys` 命令白名单 → `idempotency_keys` 表示不变量 → `cases` 列级 GRANT。

- [x] T733 [REQ:FR-012;plan:D-9.2-1] 用 T707 实测的真实约束名，`DROP` + `ADD` `case_events_event_type_check`，白名单恰为 `('CASE_CREATED','CASE_PRIMARY_ASSIGNED','CASE_PRIMARY_REVOKED')`；不得放宽为任意字符串。文件：`db/migrations/{N+1}_case_primary_switch.sql`。依赖：T708、T722。 [VERIFY:`rg -n "DROP CONSTRAINT|ADD CONSTRAINT|CASE_PRIMARY_ASSIGNED|CASE_PRIMARY_REVOKED" db/migrations/*_case_primary_switch.sql`；约束名与 T707 记录一致]
- [x] T734 [REQ:FR-012;FR-008;plan:D-9.3] `DROP` + `ADD` `case_events_metadata_shape_check`，**逐 event_type 分支**：`CASE_CREATED` 保持原"恰为 `{primary, version}`"；`CASE_PRIMARY_ASSIGNED` 恰为 `{primary, version, previousPrimaryCaseId, reason}`；`CASE_PRIMARY_REVOKED` 恰为 `{primary, version, newPrimaryCaseId, reason}`；reason `btrim <> ''` 且 `length <= 500`；`version` 整数 ≥ 1；数值子句用 `CASE WHEN` 守护。文件：同上。依赖：T733。 [VERIFY:`rg -n "case_events_metadata_shape_check|jsonb_typeof|btrim|length\\(metadata" db/migrations/*_case_primary_switch.sql`；表达式中 `CASE_CREATED` 分支与 `002` 原文逐字等价；不得出现无分支的单一 `jsonb_typeof(metadata)='object'` 简写]
- [x] T735 [REQ:FR-012;plan:D-9.2-3] `DROP` + `ADD` `business_audit_events_event_type_check`：current main 15 值（含 5 个 `PARTICIPATION_*`）+ `CASE_PRIMARY_SWITCHED` = 16；**不得**改动 `business_audit_events_resource_type_check`。文件：同上。依赖：T734。 [VERIFY:`grep -n "CASE_PRIMARY_SWITCHED\|resource_type_check" db/migrations/007_case_primary_switch.sql`；新白名单值数为 16 且包含全部 main 5 个 `PARTICIPATION_*`；该 API 文件不重建 `business_audit_events_resource_type_check`（main 8 值保持）]
- [x] T736 [REQ:FR-010;plan:D-9.2-4] `DROP` + `ADD` `idempotency_keys_command_type_check`：current main 12 值（含 4 个 participation command）+ `CASE_SWITCH_PRIMARY` = 13。文件：同上。依赖：T735。 [VERIFY:`grep -n "CASE_SWITCH_PRIMARY\|command_type" db/migrations/007_case_primary_switch.sql`；新白名单值数为 13 且包含全部 main 4 个 participation command]
- [x] T737 [REQ:FR-010;plan:D-9.4;R-13] `DROP` + `ADD` `idempotency_keys_key_representation_check`：非 `CASE_CREATE`/`CASE_SWITCH_PRIMARY` → text NOT NULL 且 bytes NULL；`CASE_CREATE` → 恰有其一（原语义不变）；`CASE_SWITCH_PRIMARY` → **text IS NULL 且 bytes IS NOT NULL**（bytea-only）；**不新增第三个唯一索引**。文件：同上。依赖：T736。 [VERIFY:`rg -n "key_representation_check|CASE_SWITCH_PRIMARY" db/migrations/*_case_primary_switch.sql`；三条分支均存在；`rg -c "CREATE UNIQUE INDEX" db/migrations/*_case_primary_switch.sql` 为 0]
- [x] T738 [REQ:FR-001;plan:D-9.5;R-7] `GRANT UPDATE (is_primary, version, updated_at) ON cases TO xiaoshuyin_app`（**列级**）；**不得**写表级 `GRANT UPDATE ON cases`；`case_events` 不新增任何 GRANT。文件：同上。依赖：T737。 [VERIFY:`rg -n "GRANT" db/migrations/*_case_primary_switch.sql` 恰为一行列级授权；`rg -n "GRANT UPDATE ON cases|GRANT .* ON case_events TO"` 为空]
- [x] T739 [REQ:plan:D-9.1] 在文件头写范围声明：不新增表 / 列 / 索引 / enum / policy；不修改 `001`/`002`/`003`；变更仅 5 处 CHECK + 1 条列级 GRANT；回滚见 `plan.md` D-9.7。文件：同上。依赖：T738。 [VERIFY:`head -30 db/migrations/*_case_primary_switch.sql` 含上述声明；`git diff --name-only -- 'db/migrations/00*'` 只显示新文件]
- [x] T740 [REQ:FR-001;plan:D-9.8] 在**空 schema 测试库**一次性应用：`bun run db:migrate` 一次 APPLY，第二次全 SKIP；随后 `case-primary-switch-schema`、`case-primary-switch-rls` 的结构与权限部分、`roles.test.ts` 的列级断言、`migration-repro.test.ts` 转绿。依赖：T739、T722、T723。 [VERIFY:`bun run db:migrate` 输出 APPLY 与 Migration complete；再次运行全 SKIP；`bunx vitest run tests/db/case-primary-switch-schema.test.ts tests/db/case-primary-switch-rls.test.ts tests/db/roles.test.ts tests/db/migration-repro.test.ts` 全绿；`migration-repro` 的 `EXPECTED_TABLES(21)` / `EXPECTED_ENUMS(21)` / `EXPECTED_POLICIES(48)` 与当前 main 基线一致]

---

## Phase 4 — Domain 纯逻辑（GREEN；不同文件可并行）

- [x] T741 [REQ:FR-004;FR-005;FR-011;plan:D-5;R-10] 新增 `packages/domain/src/case-primary-switch.ts`：`decideSwitchPrimary(input)` 纯函数，按 D-5 固定 6 步顺序返回 `DENY(code)` / `ALLOW(demote, promote)`；导出 `buildAssignedEventMetadata` / `buildRevokedEventMetadata` / `buildSwitchAuditMetadata`；**不读库、不写库、不含 I/O**。文件：`packages/domain/src/case-primary-switch.ts`。依赖：T719、T740。 [VERIFY:`bunx vitest run tests/domain/case-primary-switch-decision.test.ts` 全绿；`rg -n "FROM |INSERT |UPDATE |pool|tx\." packages/domain/src/case-primary-switch.ts` 为空]
- [x] T742 [P] [REQ:FR-018;plan:D-6.2;R-15] 在 `packages/contracts/src/schemas.ts` 新增 `SwitchPrimaryCaseRequest`（`strictObject` + `superRefine` 表达视图配对 + `reason` 原始长度 1—500 且 trim 非空，**不使用 `.trim()` 变换**）与 `SwitchPrimaryCaseResponse`（`primary` / `previousPrimary` / `switchedAt`）；**不修改** `CaseResponse` / `CaseListResponse` / `CreateCaseRequest`。文件：`packages/contracts/src/schemas.ts`。依赖：T720。 [VERIFY:`bunx vitest run tests/domain/case-primary-switch-contracts.test.ts` 全绿；`bun run typecheck` 通过；`rg -n "trim\\(\\)" packages/contracts/src/schemas.ts` 只允许出现在 `refine((value) => value.trim().length > 0)` 的空串判定；新增块内**没有** `.transform` / `.trim().` 归一化]
- [x] T743 [P] [REQ:FR-010;plan:D-7.1] 在 `packages/domain/src/idempotency.ts` 的 `IDEMPOTENCY_COMMAND_TYPES` 加入 `CASE_SWITCH_PRIMARY`；不改变 `canonicalJson` / `hashPayload` / `decideIdempotency` 语义。文件：`packages/domain/src/idempotency.ts`。依赖：T740。 [VERIFY:`rg -n "CASE_SWITCH_PRIMARY" packages/domain/src/idempotency.ts`；`bunx vitest run tests/domain/idempotency-hash.test.ts` 仍绿]
- [x] T744 [P] [REQ:FR-003;plan:D-10.2] 在 `packages/authorization/src/authorize.ts` 增量：`Action` / `REGISTERED_ACTIONS` / `CASE_ACTIONS` 各加 `CASE_SWITCH_PRIMARY`；把 case 维度分支扩展为 `(CASE_READ 或 CASE_SWITCH_PRIMARY) && case === null → CASE_CONTEXT_REQUIRED`；`CASE_CREATE` / `CASE_LIST` 的 `case !== null → UNSUPPORTED_DIMENSION` 保持不变；**不新建** `authorizeCase()`。文件：`packages/authorization/src/authorize.ts`。依赖：T721。 [VERIFY:`bunx vitest run tests/domain/case-primary-switch-authorization.test.ts tests/domain/authorization.test.ts tests/domain/case-authorization.test.ts` 全绿；`rg -n "authorizeCase" packages/` 为空]
- [x] T745 [REQ:FR-017;plan:D-8] 在 `apps/server/api/src/plugins/error-handler.ts` 的 `ERROR_MAP` 增加 `CASE_ALREADY_PRIMARY: 409`、`CASE_CLOSED: 409`、`SAFETY_HOLD_BLOCKED: 409`、`STALE_PRIMARY_VIEW: 409`；不改变既有映射与 5xx 通用体。文件：`apps/server/api/src/plugins/error-handler.ts`。依赖：T740。 [VERIFY:`rg -n "CASE_ALREADY_PRIMARY|CASE_CLOSED|SAFETY_HOLD_BLOCKED|STALE_PRIMARY_VIEW" apps/server/api/src/plugins/error-handler.ts`；`bun run typecheck` 通过]

---

## Phase 5 — Persistence / Transaction（同一 repository 文件，串行）

- [x] T746 [REQ:FR-001;FR-011;plan:D-3.2/D-4] 在 `packages/domain/src/cases.ts` 新增 `lockCasesForSwitchPrimary(tx, {familyId, targetCaseId})`（M01 remediation 后 SwitchPrimaryCase 的统一确定性加锁入口）：收集当前 primary id 与 target id → 去重 → 按 Case id 升序 → 单一 `WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE` → 重映射 `current` / `target` / `currentCount`；`>1` 个 open primary 由 T756 的 `currentCount` 防线处理；既有 `getCurrentPrimaryForUpdate` / `getCaseForUpdate` 保留为不再被 switch 路由调用的原语；不修改既有 `existsCurrentPrimary` / `listCases`。文件：`packages/domain/src/cases.ts`。依赖：T741、T740。 [VERIFY:`rg -n "lockCasesForSwitchPrimary|id = ANY|ORDER BY id|FOR UPDATE" packages/domain/src/cases.ts` 非空；`rg -n "getCurrentPrimaryForUpdate|getCaseForUpdate" apps/server/api/src/routes/cases.ts` 为空；`bun run typecheck` 通过]
- [x] T747 [REQ:FR-003;plan:D-4-8] 新增 `getCaseForUpdate(tx, caseId)`：按 id `FOR UPDATE` 返回单行或 `null`；RLS 自然完成跨 Family 隐藏；**SwitchPrimaryCase 路由不再单独调用本函数，统一锁由 T746 的 `lockCasesForSwitchPrimary` 完成**；不修改既有 `getCaseById`。文件：同上。依赖：T746。 [VERIFY:`rg -n "getCaseForUpdate" packages/domain/src/cases.ts`；语句含 `FOR UPDATE`；`rg -n "getCaseForUpdate" apps/server/api/src/routes/cases.ts` 为空；`bun run typecheck` 通过]
- [x] T748 [REQ:FR-001;plan:D-4-10/R-4/R-5] 新增 `demotePrimaryCase(tx, caseId)`：`UPDATE cases SET is_primary=false, version=version+1, updated_at=now() WHERE id=$1 RETURNING id,status,phase,is_primary,version,created_at,updated_at`；**调用方必须断言返回 1 行**；不写 `status`/`phase`/`family_id`。文件：同上。依赖：T747。 [VERIFY:`rg -n "is_primary = false|version = version \\+ 1|updated_at = now\\(\\)" packages/domain/src/cases.ts`；该语句中不出现 `status =` 或 `phase =`]
- [x] T749 [REQ:FR-001;plan:D-4-11/R-4/R-5] 新增 `promotePrimaryCase(tx, caseId)`：同上但 `is_primary=true`；**调用方必须断言返回 1 行**。文件：同上。依赖：T748。 [VERIFY:`rg -n "is_primary = true" packages/domain/src/cases.ts`；两条 UPDATE 的列集合与 `RETURNING` 完全对称]
- [x] T750 [REQ:FR-012;plan:D-2.3/D-4-12..13] 新增 `insertPrimaryAssignedEvent(tx, {...})` 与 `insertPrimaryRevokedEvent(tx, {...})`：`event_type` 用新词汇；`metadata` 显式写全 4 个 key；不修改既有 `insertCaseEvent`。文件：同上。依赖：T749。 [VERIFY:`rg -n "CASE_PRIMARY_ASSIGNED|CASE_PRIMARY_REVOKED|previousPrimaryCaseId|newPrimaryCaseId" packages/domain/src/cases.ts`；两函数的 key 集合与 D-9.3 一致]
- [x] T751 [REQ:FR-012;plan:D-2.3/D-4-14] 新增 `insertPrimarySwitchAudit(tx, {...})`：`event_type='CASE_PRIMARY_SWITCHED'`、`resource_type='CASE'`、`resource_id=targetId`；不修改既有 `insertCaseAudit`。文件：同上。依赖：T750。 [VERIFY:`rg -n "CASE_PRIMARY_SWITCHED|resource_type" packages/domain/src/cases.ts`；`bun run typecheck` 通过]
- [x] T752 [REQ:FR-010;plan:D-7.5;R-14] 新增 `acquireIdempotencySlot(tx, {actorAccountId, commandType, keyBytes, requestHash})`：实现 D-7.5 伪码（reserve → 命中则按 hash/status 分类 → 未命中重试一次 → 上限 2 次）；返回 `{kind:'OWNED'|'REPLAY'|'MISMATCH'|'POISONED'|'CONTENTION'}`；`REPLAY` 原样带出 `status` 与 `body`；**不吞 `23505`**、不做业务判定。文件：`packages/domain/src/cases.ts`。依赖：T732、T751。 [VERIFY:`bunx vitest run tests/domain/case-primary-switch-idempotency.test.ts` 全绿；`rg -n "23505" packages/domain/src/cases.ts` 为空；`grep -n "for (let attempt" packages/domain/src/cases.ts` 输出 `attempt < 2`（有界重试上限 2）]

---

## Phase 6 — Authorization / RLS 验证（不新增 policy）

- [x] T753 [REQ:FR-016;plan:D-9.6] 验证 RLS 对 `UPDATE` 的真实效果：无上下文 / 错误 Family 下 `UPDATE ... RETURNING` 返回 0 行；正确 Family 下恰好 1 行；确认**未新增 policy**。文件：`tests/db/case-primary-switch-rls.test.ts`。依赖：T740、T723。 [VERIFY:`bunx vitest run tests/db/case-primary-switch-rls.test.ts` 全绿；`SELECT count(*) FROM pg_policies WHERE tablename IN ('cases','case_events');` 与 T718 基线一致]
- [x] T754 [REQ:FR-003;plan:D-10.4] 验证授权端到端：manager 通过；普通成员 / guardian+成员 → 404 `CASE_NOT_FOUND`；跨家庭 → 404；guardian 非成员 → `CURRENT_FAMILY_NOT_FOUND`；逐类响应体一致，且均无 `NOT_FAMILY_MANAGER`。文件：`tests/integration/case-primary-switch-authorization.test.ts`。依赖：T744。 [VERIFY:`bunx vitest run tests/integration/case-primary-switch-authorization.test.ts` 全绿；逐类响应体 diff 为空；`git diff` 中不出现 `NOT_FAMILY_MANAGER` 被新增进路由外的映射]

---

## Phase 7 — API / OpenAPI

- [x] T755 [REQ:FR-002;plan:D-12.1;R-1/R-11] 在 `apps/server/api/src/routes/cases.ts` 新增 `app.post('/api/v1/cases/:id/switch-primary', …)`：`onRequest: app.authenticate`；`schema` 含 `operationId: 'switchPrimaryCase'`、`tags: ['case']`、`security`、`Idempotency-Key` header parameter（复用既有组件）、`params`（`format: uuid` 仅作文档）、`body: SwitchPrimaryCaseRequest`、`responses 200/401/404/409/422/500`；**不改动**既有 4 个 Case business operation（`cases.ts` 内 3 条 + `routes/messages.ts` 的 `createCaseMessage`）。文件：`apps/server/api/src/routes/cases.ts`。依赖：T742、T745、T751。 [VERIFY:`rg -n "switch-primary|switchPrimaryCase|Idempotency-Key" apps/server/api/src/routes/cases.ts`；`git diff` 中既有四条 business operation 的 handler 主体无改动]
- [x] T756 [REQ:plan:D-4;R-2/R-16] 在 handler 内按 D-4 序列实现：认证 → `readIdempotencyKey(req)` → `safeParse` → `requireCurrentFamily` → `withRlsTransaction` → `getFamilyById` → `authorize`（仅已知 denial → 就地 `404 CASE_NOT_FOUND`；未知基础设施异常继续 throw）→ `acquireIdempotencySlot`（REPLAY 直接返回；MISMATCH → 409）→ Family 锁 → `lockCasesForSwitchPrimary`（收集 current + target id → 去重 → `ORDER BY id` 单一 `FOR UPDATE` → 重映射）→ `snapshot.currentCount` / `target` 校验 → `decideSwitchPrimary` → 降级 → 升级 → 两侧事件 → 审计 → 回填 → 返回；4xx 保留契约体，5xx 重新抛出交给统一 `errorHandler`；**路径 `:id` 先过 `UUID_PATTERN`，未过直接 404**。文件：`apps/server/api/src/routes/cases.ts`。依赖：T755、T746—T752。 [VERIFY:`bunx vitest run tests/integration/case-primary-switch-happy.test.ts tests/integration/case-primary-switch-conflicts.test.ts` 全绿；`rg -n "lockCasesForSwitchPrimary|currentCount|decideSwitchPrimary|demotePrimaryCase|promotePrimaryCase" apps/server/api/src/routes/cases.ts` 非空；`grep -n "idempotencyKey" apps/server/api/src/routes/cases.ts` 为空；`grep -n "23505" apps/server/api/src/routes/cases.ts` 仅允许注释命中，无错误处理分支]
- [x] T757 [REQ:plan:D-4-detail-2] 三条防线按真实结构分布：route 用 `snapshot.currentCount > 1` 抛 `INTERNAL_ERROR`（多 current primary）；domain `demotePrimaryCase` 的 `UPDATE ... RETURNING` 0 行抛 `CASE_DEMOTE_RETURNED_NO_ROW`；domain `promotePrimaryCase` 的 `UPDATE ... RETURNING` 0 行抛 `CASE_PROMOTE_RETURNED_NO_ROW`，均在事务内失败并整体回滚。文件：`apps/server/api/src/routes/cases.ts`、`packages/domain/src/cases.ts`。依赖：T756。 [VERIFY:`rg -n "currentCount|Multiple open primaries|lockCasesForSwitchPrimary" apps/server/api/src/routes/cases.ts` 非空；`rg -n "demotePrimaryCase|promotePrimaryCase|CASE_DEMOTE_RETURNED_NO_ROW|CASE_PROMOTE_RETURNED_NO_ROW|RETURNING" packages/domain/src/cases.ts` 非空；`bunx vitest run tests/integration/case-primary-switch-atomicity.test.ts tests/integration/case-primary-switch-happy.test.ts tests/db/case-primary-switch-concurrency.test.ts` 全绿]
- [x] T758 [REQ:FR-002;plan:D-12.4] 运行 `bun run openapi:generate` 更新 `packages/generated/openapi.json` 与 `openapi.d.ts`；**不得 hand-edit**；不得改变既有 4 个 operation。文件：`packages/generated/`。依赖：T756。 [VERIFY:`git diff --name-only -- packages/generated/` 只出现两个 generator 管理文件；两次生成 `shasum -a 256` 一致；`bun run openapi:check` PASS]
- [x] T759 [REQ:FR-002;FR-020;plan:D-14.2] 精确收窄 `tests/integration/openapi-cases.test.ts`：`casePaths` 由 current main baseline 4 项扩为 5 项、business `operations` 由 4 项扩为 5 项（Slice 7 delta = exactly 1）；把 `switch-primary` 从"禁止片段"循环中移除并改为正向断言（保留 `current` / `pause` / `resume` / `close` / `recurrences`）；**既有 operation 的 operationId / security / tags / 404 literal / 422 形状断言逐条保留**。文件：`tests/integration/openapi-cases.test.ts`。依赖：T758。 [VERIFY:`bunx vitest run tests/integration/openapi-cases.test.ts tests/integration/openapi-case-primary-switch.test.ts` 全绿；Case path 集合为 5、business operation 计数为 5；`git diff` 在该文件中仅 `casePaths` / `operations` / 该循环三处变更，断言删除行数为 0]
- [x] T760 [REQ:FR-002;plan:V-2-23] 运行新 operation 的 OpenAPI 契约用例，逐项核对与冻结契约零语义漂移。文件：`tests/integration/openapi-case-primary-switch.test.ts`。依赖：T759。 [VERIFY:`bunx vitest run tests/integration/openapi-case-primary-switch.test.ts` 全绿；`bun run openapi:check` PASS]
- [x] T761 [REQ:FR-010;plan:G10;R-11] 在代码层证明只有一种幂等传输：Case 路由与 Case 契约中不出现 `idempotencyKey`；`readIdempotencyKey` 被调用；请求 body schema 不含该字段。文件：`apps/server/api/src/routes/cases.ts`、`packages/contracts/src/schemas.ts`。依赖：T756。 [VERIFY:`git grep -n "idempotencyKey" -- apps/server/api/src/routes/cases.ts packages/contracts/src/schemas.ts` 在 Case 相关块为空；`rg -n "readIdempotencyKey" apps/server/api/src/routes/cases.ts` 非空；归档两次 grep 输出]

---

## Phase 8 — Event / Audit 端到端

- [x] T762 [REQ:FR-012;plan:D-4-12..14] 验证成功切换在 `case_events` 产生恰好两条记录（目标 `CASE_PRIMARY_ASSIGNED`、原 primary `CASE_PRIMARY_REVOKED`；晋升分支只有一条 ASSIGNED），在 `business_audit_events` 产生恰好一条 `CASE_PRIMARY_SWITCHED`；三者 `metadata` key 集合与 D-9.3 完全一致。文件：`tests/integration/case-primary-switch-happy.test.ts`、`tests/db/case-primary-switch-schema.test.ts`。依赖：T756。 [VERIFY:`bunx vitest run tests/integration/case-primary-switch-happy.test.ts tests/db/case-primary-switch-schema.test.ts` 全绿；真实行输出归档]
- [x] T763 [REQ:FR-012;plan:V-2-22] 运行原子性用例：审计写入失败 → 500 固定体 → 主线未变、无事件、无幂等快照；`afterAll` 清理 trigger 并断言清理成功。文件：`tests/integration/case-primary-switch-atomicity.test.ts`。依赖：T729、T756。 [VERIFY:`bunx vitest run tests/integration/case-primary-switch-atomicity.test.ts` 全绿；失败前后 `cases` 行快照逐字节一致]
- [x] T764 [REQ:FR-008;plan:V-2-2] 验证理由不被覆盖：往返切换 A→B→A 后，两条 ASSIGNED + 两条 REVOKED 事件的 `reason` 各自保留；`cases` 行无 `reason` 类列。文件：`tests/integration/case-primary-switch-happy.test.ts`。依赖：T762。 [VERIFY:查询四条事件的 `(event_type, metadata->>'reason')` 输出归档；`information_schema.columns` 对 `cases` 无 `switch_reason` / `previous_primary_id` / `primary_since` / `switched_at`]

---

## Phase 9 — Idempotency / 并发收敛

- [x] T765 [REQ:FR-010;plan:D-7.4;R-12] 验证 canonical payload：`{familyId, targetCaseId, reason, expectedPrimaryCaseId, expectedPrimaryVersion}`，路径 id 与视图 id 均小写归一；同 key 换目标 → MISMATCH、换 reason → MISMATCH、换视图版本 → MISMATCH；**大小写不同的同一 uuid → 必须 REPLAY 而非 MISMATCH**。文件：`tests/integration/case-primary-switch-idempotency.test.ts`。依赖：T756。 [VERIFY:`bunx vitest run tests/integration/case-primary-switch-idempotency.test.ts` 全绿；四类结果（3×409 + 1×200 replay）的真实响应归档]
- [x] T766 [REQ:FR-010;R-2;plan:D-7.5] 验证"重放优先于状态"：一次成功切换后（target 已是 primary）用同 key 同 payload 重放 → `200` 原 body，**不得**返回 `409 CASE_ALREADY_PRIMARY`；事件 / 审计 / 版本计数不变。文件：同上。依赖：T765。 [VERIFY:该用例单独运行并归档真实响应码与 body；若返回 409 → 立即停止，说明 R-2 实现错误，**不得改测试**]
- [x] T767 [REQ:FR-015;plan:D-3.5] 验证唯一索引仍是不变量：迁移后 `cases_one_primary_open_per_family` 的 `indexdef` 与当前 merged main 的 `006_case_status_paused_removal.sql` 重建定义一致（新基线 = remediation merge commit，不再引用旧 `IMPLEMENT_BASE_SHA`）；故意构造第二条未结 primary 的直接写入被 `23505` 拒绝；应用路径不捕获该错误。文件：`tests/db/case-primary-switch-concurrency.test.ts`。依赖：T740、T756。 [VERIFY:`SELECT indexdef FROM pg_indexes WHERE indexname='cases_one_primary_open_per_family';` 归档并与当前 migration 定义一致；直写被拒的 SQLSTATE 归档；`grep -R -n "23505" apps/` 仅允许注释命中，无错误处理分支]
- [x] T768 [REQ:FR-001;§39;plan:V-2-18/19] 运行并发套件（双切换不同目标 / 同目标 / 切换 vs 创建 / 同 key 并发），逐场景归档状态码组合与 `count(*) WHERE is_primary AND status <> 'CLOSED'`。文件：`tests/db/case-primary-switch-concurrency.test.ts`。依赖：T767。 [VERIFY:`bunx vitest run tests/db/case-primary-switch-concurrency.test.ts` 全绿，连续运行 3 次结果稳定；**任何 500 即失败**]

---

## Phase 10 — Acceptance 全量对齐

- [x] T769 [REQ:Acceptance-1..4;plan:V-2] 逐条执行 Acceptance 1—4 并归档真实响应：首次切换 / 往返切换 / 晋升（`previousPrimary=null`，非 500）/ 读取一致（列表 primary 唯一、无 `/cases/current`）。文件：`tests/integration/case-primary-switch-happy.test.ts`。依赖：T756。 [VERIFY:`bunx vitest run tests/integration/case-primary-switch-happy.test.ts` + 真实 HTTP 响应输出归档；4/4 覆盖]
- [x] T770 [REQ:Acceptance-5..9;plan:V-2] 逐条执行 Acceptance 5—9：非管理主体 / 跨家庭 / guardian 非成员 / 目标不存在与非法 ID / 已是 primary。文件：`tests/integration/case-primary-switch-authorization.test.ts`、`tests/integration/case-primary-switch-conflicts.test.ts`。依赖：T754、T756。 [VERIFY:真实响应码 + body 归档；5/5 覆盖；跨家庭另有该 Family 上下文直查 0 行证据]
- [x] T771 [REQ:Acceptance-10..14;plan:V-2] 逐条执行 Acceptance 10—14：目标 CLOSED / 当前 primary SAFETY_HOLD / 目标 SAFETY_HOLD（均以 domain 穷举为证据并注明未伪造 `status`）/ reason 三类非法 / 未声明字段与缺视图 + "形状错 + 陈旧视图 → 422 优先"。文件：`tests/domain/case-primary-switch-decision.test.ts`、`tests/integration/case-primary-switch-conflicts.test.ts`。依赖：T741、T756。 [VERIFY:5/5 覆盖；对 10—12 明确记录证据来自 domain 穷举，符合 Spec Q3a；13 的 422-优先用例单独归档]
- [x] T772 [REQ:Acceptance-15..17;plan:V-2] 逐条执行 Acceptance 15—17：无副作用（越界表计数为 0、两 Case 内容未改写）/ 同 key 重放 / 同 key 不同目标。文件：`tests/integration/case-primary-switch-happy.test.ts`、`tests/integration/case-primary-switch-idempotency.test.ts`。依赖：T762、T766。 [VERIFY:3/3 覆盖；副作用检查输出为逐表 count]
- [x] T773 [REQ:Acceptance-18..20;plan:V-2] 逐条执行 Acceptance 18—20：并发双切换 / 并发切换与创建 / 陈旧视图。文件：`tests/db/case-primary-switch-concurrency.test.ts`、`tests/integration/case-primary-switch-conflicts.test.ts`。依赖：T768。 [VERIFY:3/3 覆盖；每次运行计数 ≤ 1]
- [x] T774 [REQ:Acceptance-21..23;plan:V-2] 逐条执行 Acceptance 21—23：RLS 无上下文 / 审计原子性 / 结构越界。文件：`tests/db/case-primary-switch-rls.test.ts`、`tests/integration/case-primary-switch-atomicity.test.ts`、`tests/integration/case-primary-switch-scope.test.ts`。依赖：T753、T763、T760。 [VERIFY:3/3 覆盖；越界表 / 路由枚举输出为空；Case business operation 计数为 5（current main baseline 4 + Slice 7 delta 1）]
- [x] T775 [REQ:FR-001..FR-020;plan:V-1] FR 覆盖审计：逐条确认 20 条 FR 各有至少一个真实测试文件与用例；缺口必须为 0。文件：本文件 `Coverage Map`。依赖：T769—T774。 [VERIFY:审计输出必须来自本轮真实执行的覆盖矩阵；`FR 20/20`、`Acceptance 23/23` 只有在真实反例全部关闭后才可写；missing 列表为空；不得以"设计已存在"或历史证据代替]

---

## Phase 11 — Regression / Governance

- [x] T776 [P] [REQ:FR-020;plan:D-14.1] 精确收窄 `tests/integration/cases-scope.test.ts`：从 `FORBIDDEN_ROUTE_FRAGMENTS`（14 项）移除 `'/switch-primary'`，新增"只允许 `POST /api/v1/cases/:id/switch-primary`"的正向断言；**其余 13 项逐条保留**；`roots.length` 与 `caseBlock` 相关断言按 T716 归档的 `printRoutes` 实测结果重算（**不得假设渲染不变**）；`case_events` 词汇断言增加两个新类型并继续拒绝 `CASE_VIEWED` / `CASE_LISTED` / `CASE_ACCESSED`。文件：`tests/integration/cases-scope.test.ts`。依赖：T756。 [VERIFY:`bunx vitest run tests/integration/cases-scope.test.ts` 全绿；`git diff` 中被移除的禁止片段数为 1（仅 `switch-primary`），其余 13 项可逐条 grep 命中]
- [x] T777 [P] [REQ:FR-020;plan:D-14.2] 复核 OpenAPI 断言收窄未被削弱：既有四个 operation 的 operationId / security / tags / 404 literal / 422 形状断言仍逐条存在；对比 `IMPLEMENT_BASE_SHA`，删除的断言行数必须为 0。文件：`tests/integration/openapi-cases.test.ts`。依赖：T759。 [VERIFY:`git diff "$IMPLEMENT_BASE_SHA"...HEAD -- tests/integration/openapi-cases.test.ts` 逐行审阅归档；`bunx vitest run tests/integration/openapi-cases.test.ts` 全绿]
- [x] T778 [P] [REQ:plan:D-9.5/D-14.3] 收窄 `tests/db/roles.test.ts` 的 `cases` 断言：**表级** `UPDATE` / `DELETE` / `TRUNCATE` 仍为 false（原断言保留）；新增 `has_column_privilege` 断言——`is_primary` / `version` / `updated_at` 为 true，`id` / `family_id` / `created_by_person_id` / `status` / `phase` / `created_at` 为 false；`case_events` 仍只有 `SELECT, INSERT`。文件：`tests/db/roles.test.ts`。依赖：T740。 [VERIFY:`bunx vitest run tests/db/roles.test.ts` 全绿；T715 的实测结论被引用；若表级出现 true → 回到 T738 修正 GRANT，**不得**放宽断言]
- [x] T779 [P] [REQ:plan:D-14.5] `tests/db/cases-events-metadata.test.ts` 的用例标题由 merged main 保留为 `event_type vocabulary is closed to CASE_CREATED`（`SUPERSEDED BY MAIN`）；本 Slice 不再重命名，断言体保留且未删除该用例。文件：`tests/db/cases-events-metadata.test.ts`。依赖：T740。 [VERIFY:`bunx vitest run tests/db/cases-events-metadata.test.ts` 全绿；标题保持 main 版本；`git diff` 中该用例的断言行无删除]
- [x] T780 [REQ:plan:D-9.8] 证明零 schema 扩张：`migration-repro` 的表 / policy / enum 计数与 T718 基线完全一致；`db:evidence` 输出中无新表 / 新列 / 新索引（除 5 个 CHECK 替换）。文件：`tests/db/migration-repro.test.ts`。依赖：T740。 [VERIFY:`bunx vitest run tests/db/migration-repro.test.ts` 全绿；`bun run db:evidence` 输出与基线 diff 只含 5 处约束定义]
- [x] T781 [REQ:FR-014;FR-019;plan:CHK187] 运行静态守卫并证明未弱化：`scripts/guard-static.mjs` 的 `FORBIDDEN_PATHS` 与 `db/` 扫描的 `R6-scope-guard` 规则未被删除或放宽；临时注入违规样例必须 exit 1，移除后 exit 0。文件：`scripts/guard-static.mjs`（**不修改**）、`db/`。依赖：T776。 [VERIFY:`bun run guard:static` 输出 `PASS (0 violations)`；注入样例 exit 1 且输出 rule 名与文件行号；`git diff scripts/guard-static.mjs` 为空]
- [x] T782 [REQ:FR-009;FR-013] 负空间断言：不存在 `PauseCase` / `ResumeCase` / `CloseCase` / `CreateRecurrence` / Problem Formulation / Evidence writer / Participant / Safety runtime / AI / Notification / Plan / Task 的路由、表、命令或占位；不存在 `/cases/current`；不存在第二套审计 / 幂等 / 授权。文件：`tests/integration/case-primary-switch-scope.test.ts`。依赖：T781。 [VERIFY:`bunx vitest run tests/integration/case-primary-switch-scope.test.ts` 全绿；`pg_tables` 与 `app.printRoutes` 枚举输出归档；`rg -n "PauseCase|ResumeCase|CloseCase|CreateRecurrence|authorizeCase|risk_events|problem_formulations" apps/ packages/` 为空]

---

## Phase 12 — Final Verification

- [x] T783 [REQ:plan:V-3] 全量回归：`bun run typecheck`、`bun run guard:static`、`bunx vitest run`、`bun run openapi:check`、空库 `bun run db:migrate` replay 两次；逐条检查输出。文件：仓库根。依赖：T776—T782。 [VERIFY:全部命令 exit 0；无 skip / 无 expected-fail；输出归档到 `tests/evidence/`]
- [x] T784 [REQ:AGENTS:§5;plan:审计一-F] 证据诚实性复核：任何无法运行的环境或命令报告 `BLOCKED` / `NOT VERIFIED`，不得以"设计已存在"或"分支已实现"替代；特别复核 Slice 2 依赖的证据来自**当前 main**而非分支。文件：本文件 `Evidence` 段。依赖：T783。 [VERIFY:证据清单逐项标注来源与命令；`git rev-parse origin/main` 记录本轮真实值 `2b07c532`；无证据的历史 RED 项标 `DEFERRED / NOT VERIFIED`，不得伪造]
- [x] T785 [REQ:AGENTS:§7;plan:CHK222-226] 治理复核：`git diff --name-only "$IMPLEMENT_BASE_SHA"...HEAD` 全量清单逐项分类为 expected 或 unexpected；`Docs/**`、`specs/001-006/**`、`specs/007-case-primary-switch/spec.md`、`plan.md` 的语义 diff 必须为 0。文件：仓库根。依赖：T783。 [VERIFY:`node .specify/scripts/validate-governance.mjs` PASS；`git diff --name-only "$IMPLEMENT_BASE_SHA"...HEAD -- Docs specs/001-family-identity-core specs/002-case-core specs/003-evidence-core specs/004-case-participant-core specs/005-invited-identity-binding-contract specs/006-identity-binding-runtime specs/007-case-primary-switch/spec.md specs/007-case-primary-switch/plan.md` 输出为空；unexpected 计数 = 0]
- [x] T786 [REQ:AGENTS:§3;plan:Blockers] **Pending Audit Handoff**：仅当 T701—T785 全部完成、G1—G10 PASS、全量回归 PASS、FR 20/20、Acceptance 23/23、治理 PASS、unexpected = 0 时，输出 `REMEDIATION EVIDENCE COMPLETE — PENDING INDEPENDENT AUDIT` 并停止；任一未解决 → `BLOCKED` 并报告具体 Task 与证据。**停止边界**：不得自行充当审计二、不得宣布可 merge / PASS / MERGE SAFE、不得 merge main、不得修改冻结需求以消除 gap。文件：本文件 `Evidence` 段。依赖：T785。 [VERIFY:最终报告含逐项完成状态与真实命令输出；`git status --short` 无未提交残留；输出固定文案后停止]

---

## Phase 13 — Post-Audit Remediation（2026-11-10，S7-II-H01/H02/M01/M02/L01 + S7-H03 evidence）

> 本节是 **remediation / delivery obligations**，不是新增产品 FR。FR-001–FR-020、Acceptance 1–23、Scope 均不改变。

- [x] R01 [REQ:AGENTS:§3;remediation:main-reconciliation] 以普通 merge（禁止 rebase / force push / reset --hard）将最新 `origin/main` 合入 `feat/007-case-primary-switch`，解决全部冲突并保留 main 已合并能力（Slice 3 Evidence / Slice 4 Participant / Slice 5 Identity Binding / Case PAUSED removal）。 [VERIFY:`git log -1 --format=%P HEAD` 为 merge commit；`git merge-base --is-ancestor origin/main HEAD`；冲突文件逐项复核保留双方能力]
- [x] R02 [REQ:plan:D-9;remediation:S7-II-H01] migration 重编号为当前 main 最大序号 +1（`007_case_primary_switch.sql`）；共享 CHECK 逐字保留 main 全部 literal 并只追加 Slice 7 literal（audit 16 值、command 13 值）。 [VERIFY:`git diff --name-only origin/main -- db/migrations/001* 002* 003* 004* 005_case_participant_core.sql 006*` 为空；`pg_get_constraintdef` 输出与 `main 全集 ∪ Slice 7 增量` 集合相等]
- [x] R03 [REQ:remediation:S7-II-H01] 真实 PostgreSQL 18 三态证据：fresh / replay / populated upgrade；旧数据零丢失、旧 literal 仍可写、新 literal 可写。 [VERIFY:`bun run db:evidence` 输出 fresh 8 APPLY、replay 0 new、upgrade 5 new / 3 previously applied]
- [x] R04 [REQ:remediation:S7-II-H02] switch 端点窄范围 JSON 边界：未声明字段（含 own `__proto__`）→ 422、malformed JSON → 该端点 422（Fastify 不可区分；不改 Spec 语义）、无认证 → 401 优先、零业务写入。 [VERIFY:`bunx vitest run tests/integration/case-primary-switch-json-boundary.test.ts` 全绿；create/message 端点语义不变]
- [x] R05 [REQ:remediation:S7-II-M01] reason 在 schema 边界拒绝 `U+0000` 与孤立 surrogate（→ 422、零写入），合法 Unicode 保留原值；hash / event / audit 使用同一 canonical reason。 [VERIFY:`bunx vitest run tests/domain/case-primary-switch-reason-unicode.test.ts tests/integration/case-primary-switch-conflicts.test.ts` 全绿；合法 emoji 原值逐字符一致]
- [x] R06 [REQ:remediation:S7-II-M02] frozen YAML timestamp pattern 与 generated schema 严格一致；normalizer 仅对 007 开启 `keepPatterns`；正反例与 drift 必须 FAIL。 [VERIFY:`bun run openapi:generate && bun run openapi:check` PASS；`bunx vitest run tests/integration/openapi-semantic-equivalence.test.ts` 全绿]
- [x] R07 [REQ:remediation:PAUSED] case-level 五态机械对齐（运行时 / contracts / generated / OpenAPI / decision 穷举 / 测试）；不重新引入 `PauseCase` / `ResumeCase`。 [VERIFY:`rg -n "PAUSED" packages/domain/src/case-primary-switch.ts packages/contracts/src/schemas.ts specs/007-case-primary-switch/contracts tests/domain/case-primary-switch-decision.test.ts` 为空；`bunx vitest run tests/domain/case-primary-switch-decision.test.ts` 全绿]
- [x] R08 [REQ:AGENTS:§7;remediation:spec-plan] `spec.md` / `plan.md` 只做已被 main 推翻的机械修正（五态、baseline、migration 编号、CHECK 全集、operation 计数 4→5）；不新增产品 FR / Acceptance 语义。 [VERIFY:`git diff origin/main...HEAD -- Docs` authored diff = 0；spec/plan 的 `Product FR semantic change: NONE` / `Acceptance semantic change: NONE` / `Scope change: NONE` 声明存在]
- [x] R09 [REQ:remediation:S7-II-L01] tasks / VERIFY / Evidence 精确描述真实代码与命令；历史无证据项标 `DEFERRED / NOT VERIFIED`，不伪造 RED 阶段。 [VERIFY:逐条重跑被校正的 VERIFY；证据文件 `tests/evidence/007-remediation-*.log` 存在且含命令 / exit code]
- [x] R10 [REQ:remediation:S7-H03] 只补 lock evidence：collect / dedupe / ascending / 单条 `FOR UPDATE` / `pg_blocking_pids`；不重新设计锁。 [VERIFY:`bunx vitest run tests/domain/case-primary-switch-lock-order.test.ts tests/db/case-primary-switch-concurrency.test.ts` 全绿并归档真实输出]
- [x] R11 [REQ:AGENTS:§5] 全量验证：typecheck / guard:static / openapi:generate / openapi:check / vitest / verify-all / db:evidence / governance。 [VERIFY:全部命令 exit 0；0 failed / 0 skipped / 0 pending / 0 todo（平台 BLOCKED 项如实标注）]
- [ ] R12 [REQ:AGENTS:§3] 停止在 `REMEDIATION EVIDENCE COMPLETE — PENDING INDEPENDENT AUDIT`；不宣布 PASS / MERGE SAFE / READY TO MERGE，不 merge main。 [VERIFY:最终报告含 Start/Final Main、Start/Final Head、逐项 finding 状态、验证结果]

---

## Coverage Map

### FR → Tasks

| FR | 主要任务 |
|---|---|
| FR-001 | T724、T746—T749、T756、T768、T775 |
| FR-002 | T730、T731、T755、T758、T759、T760、T776、T777 |
| FR-003 | T721、T727、T744、T747、T754、T756、T770 |
| FR-004 | T719、T741、T756、T771 |
| FR-005 | T719、T741、T756、T771 |
| FR-006 | T725、T748、T749、T756、T772 |
| FR-007 | T725、T748、T764、T772 |
| FR-008 | T725、T734、T750、T764 |
| FR-009 | T730、T782 |
| FR-010 | T728、T732、T736、T737、T743、T752、T765、T766 |
| FR-011 | T720、T725、T726、T742、T746、T773 |
| FR-012 | T722、T733—T735、T750、T751、T762、T763 |
| FR-013 | T721、T744、T782 |
| FR-014 | T730、T735、T780、T782 |
| FR-015 | T724、T757、T767、T768 |
| FR-016 | T723、T753、T774 |
| FR-017 | T726、T745、T756 |
| FR-018 | T720、T742、T771 |
| FR-019 | T730、T782 |
| FR-020 | T730、T776、T777、T781 |

### Acceptance → Tasks

| # | 任务 | # | 任务 |
|---|---|---|---|
| 1 | T725、T769 | 13 | T726、T771 |
| 2 | T725、T764、T769 | 14 | T726、T771 |
| 3 | T725、T769 | 15 | T772 |
| 4 | T725、T769 | 16 | T728、T766、T772 |
| 5 | T727、T770 | 17 | T728、T765、T772 |
| 6 | T723、T727、T770 | 18 | T724、T768、T773 |
| 7 | T727、T770 | 19 | T724、T768、T773 |
| 8 | T726、T770 | 20 | T726、T773 |
| 9 | T726、T770 | 21 | T723、T753、T774 |
| 10 | T719、T771 | 22 | T729、T763、T774 |
| 11 | T719、T741、T771 | 23 | T730、T760、T774、T782 |
| 12 | T719、T741、T771 | | |

### Plan 决策 → Tasks

| Plan 段 | 任务 |
|---|---|
| D-1 / D-13（实现模型与负空间） | T755、T782 |
| D-2（数据模型 / 零扩张） | T738、T739、T780 |
| D-3（并发四层 + 锁顺序） | T713、T724、T746、T748、T749、T767、T768 |
| D-4（事务序列） | T756、T757 |
| D-5（冲突判定纯函数） | T719、T741 |
| D-6（陈旧视图） | T720、T742 |
| D-7（幂等 / header / 五态） | T714、T728、T732、T736、T737、T743、T752、T761、T765、T766 |
| D-8（失败语义） | T726、T745、T756 |
| D-9（migration） | T708、T715、T733—T740、T778、T779、T780 |
| D-10（授权） | T721、T744、T754 |
| D-11（Safety 谓词） | T719、T741、T771 |
| D-12（API 契约） | T731、T742、T755、T758、T759、T760 |
| D-14（14 条 reconciliation） | T716、T730、T759、T776—T779 |
| R-1 — R-16 | 逐条落入上表对应任务；R-11→T728/T761、R-12→T765、R-13→T737、R-14→T732/T752、R-15→T742、R-16→T714/T756 |
| G1 — G10 | T701—T711 |

---

## Dependency Graph

| Phase | 边 |
|---|---|
| 0 | T701 ← ∅；T702 ← T701；T703 ← T702；T704—T710 ← T702；T711 ← T703—T710 |
| 1 | T712 ← T711；T713—T718 ← T712；T717 ← T707 |
| 2 | T719—T721 ← T712；T722、T723 ← T707、T712；T724—T732 ← T712 |
| 3 | T733 ← T708、T722；T734 ← T733；T735 ← T734；T736 ← T735；T737 ← T736；T738 ← T737；T739 ← T738；T740 ← T739、T722、T723 |
| 4 | T741 ← T719、T740；T742 ← T720；T743 ← T740；T744 ← T721；T745 ← T740 |
| 5 | T746 ← T741、T740；T747 ← T746；T748 ← T747；T749 ← T748；T750 ← T749；T751 ← T750；T752 ← T732、T751 |
| 6 | T753 ← T740、T723；T754 ← T744 |
| 7 | T755 ← T742、T745、T751；T756 ← T755、T746—T752；T757 ← T756；T758 ← T756；T759 ← T758；T760 ← T759；T761 ← T756 |
| 8 | T762 ← T756；T763 ← T729、T756；T764 ← T762 |
| 9 | T765 ← T756；T766 ← T765；T767 ← T740、T756；T768 ← T767 |
| 10 | T769 ← T756；T770 ← T754、T756；T771 ← T741、T756；T772 ← T762、T766；T773 ← T768；T774 ← T753、T763、T760；T775 ← T769—T774 |
| 11 | T776 ← T756；T777 ← T759；T778、T779、T780 ← T740；T781 ← T776；T782 ← T781 |
| 12 | T783 ← T776—T782；T784 ← T783；T785 ← T783；T786 ← T785 |

**一致性结论**：全部依赖边满足 `依赖 id < 任务 id`（无前向依赖）；边集构 DAG（无环）；Phase 2（RED）先于 Phase 3—9（实现）；Phase 3 是单文件串行链，保证与 `plan.md` D-9 的语句顺序一致；Phase 10 只消费已完成实现，不新增设计；Phase 11 的 OpenAPI 复核（T777）依赖 Phase 7 的收窄（T759），方向单调。

---

## Execution Batches

| Batch | 内容 | 并行性 |
|---|---|---|
| G | Phase 0 门禁 T701—T711 | **串行**；T711 未 PASS 不得进入 Phase 1 |
| A | Phase 1 baseline T712—T718 | T713—T717 可 `[P]`（只读、不同目标）；T718 必须最后 |
| B | Phase 2 RED tests T719—T732 | 可 `[P]`（不同测试文件） |
| C | Phase 3 migration T733—T740 | **全串行**（同一文件）；T740 一次性 apply |
| D | Phase 4 域逻辑 T741—T745 | T742、T743、T744 可 `[P]`；T741、T745 串行 |
| E | Phase 5 persistence T746—T752 | **串行**（同一 repository 文件） |
| F | Phase 6 授权 / RLS T753—T754 | 可 `[P]` |
| H | Phase 7 API T755—T761 | T755—T757 串行；T758—T760 串行；T761 独立 |
| I | Phase 8 事件 / 审计 T762—T764 | 串行（同一条验证链） |
| J | Phase 9 幂等 / 并发 T765—T768 | 串行 |
| K | Phase 11 守卫收窄 T776—T782 | T776—T780 可 `[P]`；T781—T782 串行 |
| L | Phase 10 验收 T769—T775 | 串行（T760 已在 Phase 7 完成 OpenAPI 收窄，此处只消费） |
| M | Phase 12 最终验证 T783—T786 | **全串行**；T786 输出后停止并移交审计二 |

---

## Evidence（Implement 阶段填写，本轮为空）

| 项 | 值 |
|---|---|
| `IMPLEMENT_BASE_SHA` | `08110bcf06accf1f6d1790cc7908d67996845089`（普通 merge `origin/main` `6af4ce8` 后） |
| `origin/main`（Implement 时） | `6af4ce87762abbdfd1a38c95616c9cc92d9d4776` |
| Slice 2 final head | PR #17 head `0c01c4db709628660086fba6b409a840ea973ae4`（merge commit `6af4ce8`；PR #14 `f4ef6026` 亦为祖先） |
| 迁移文件名 | `db/migrations/007_case_primary_switch.sql` |
| `has_table_privilege('cases','UPDATE')` 实测 | `false`；`has_column_privilege` `is_primary`/`version`/`updated_at` = `true`，`id`/`family_id`/`created_by_person_id`/`status`/`phase`/`created_at` = `false`（007 列级 GRANT，fresh + upgrade 库实测） |
| 全量回归结果 | **历史 Head 证据（不得作为本轮证据）**：166 files / 1089 tests / 0 failed / 0 skipped。本轮 remediation 后的真实计数见下方 `2026-11-10 Post-Audit Remediation` 段。 |
| FR / Acceptance 覆盖 | FR-001–FR-020 全覆盖（新建 15 个 direct test 文件 + 既有收窄断言）；Acceptance 1–23 全覆盖（历史记录；本轮按真实反例重新确认） |

### Post-Audit Remediation（2026-11-09）

| 项 | 结论 / 证据 |
|---|---|
| Remediation Base | `96ce56c9caa3ef23b8a58fdd9979d28754dba397`（`origin/main` = `6af4ce8`） |
| **S7-H01** Business audit metadata | CLOSED。`CASE_PRIMARY_SWITCHED.metadata` 恰为 `{targetCaseId, previousPrimaryCaseId, newPrimaryCaseId, previousVersion, newVersion, reason}`；`previousVersion` / `newVersion` 取自两侧 `UPDATE ... RETURNING`；晋升分支为 `null`。`insertPrimarySwitchAudit` 共用 `buildSwitchAuditMetadata` 单一事实源 |
| **S7-H02** 测试落地 | CLOSED。H02-A `tests/db/roles.test.ts` 新增表级 UPDATE=false + 六列否定 / 三列正向 + `case_events` 表/列级 append-only；H02-B `tests/integration/case-primary-switch-happy.test.ts` 真实读取 `business_audit_events` 逐字段断言（含 promotion nullable）；H02-C 新增 `tests/integration/case-primary-switch-authorization-fault.test.ts`（真实 `57014` → 500，known denial → 404） |
| **S7-M01** 确定性锁顺序 | CLOSED。`lockCasesForSwitchPrimary` 收集 → 去重 → 升序 → 单一 `WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`，路由不再调用逐行双锁；`tests/db/case-primary-switch-concurrency.test.ts` 用 `pg_blocking_pids` 机械证明小 id 先被持有，`tests/domain/case-primary-switch-lock-order.test.ts` 固定实现形状 |
| Audit 幂等 / 原子性 | 重放后 `CASE_PRIMARY_SWITCHED` 计数仍为 1；审计写失败注入后 audit count delta = 0、事件 / 版本 / 幂等占位全部回滚 |
| Targeted tests | 17 files / 98 tests PASS（含 roles、happy、authorization、authorization-fault、concurrency、atomicity、idempotency、schema、rls、scope、openapi、domain） |
| Migration 三态 | fresh（6 APPLY）→ replay（0 new，全 SKIP）→ upgrade（001–003 已应用后仅 APPLY 004×2 + 005）：`db-evidence` PASS |
| Frozen drift | `git diff 96ce56c..HEAD -- Docs specs/007-case-primary-switch/spec.md specs/007-case-primary-switch/plan.md` 为空 |

### Post-Audit Remediation（2026-11-10，本轮真实执行结果）

| 项 | 值 / 证据 |
|---|---|
| Start Head | `008082fb4b3266b60808b91e59b745f33aa0f780` |
| Start / Final Main | `2b07c5321b3b10873c503d8f8bb5db61fade096c` |
| Merge base | `6af4ce87762abbdfd1a38c95616c9cc92d9d4776` |
| Main reconciliation | 普通 `git merge --no-ff origin/main`，8 个冲突文件全部解决；main 的 Slice 3 / Slice 4 / Slice 5 / PAUSED removal 能力保留 |
| Migration | `db/migrations/007_case_primary_switch.sql`；main 15 个 audit literal + `CASE_PRIMARY_SWITCHED` = 16；main 12 个 command literal + `CASE_SWITCH_PRIMARY` = 13 |
| Migration 三态 | `bun run db:evidence` PASS：fresh 8 APPLY / replay 0 new / populated upgrade 5 new, 3 previously applied |
| S7-II-H01 | CLOSED：`tests/db/case-primary-switch-shared-vocabulary.test.ts` 5/5 PASS；`tests/db/migration-upgrade-evidence.test.ts` 2/2 PASS |
| S7-II-H02 | CLOSED：`tests/integration/case-primary-switch-json-boundary.test.ts` 4/4 PASS（`__proto__` / malformed → 422；401 优先；zero writes；create/message 语义不变） |
| S7-II-M01 | CLOSED：`tests/domain/case-primary-switch-reason-unicode.test.ts` 5/5 + `tests/integration/case-primary-switch-reason-persistence.test.ts` 2/2 PASS（NUL / 孤立 surrogate → 422；合法 Unicode 原值持久化） |
| S7-II-M02 | CLOSED：`tests/integration/openapi-semantic-equivalence.test.ts` 13/13 PASS；frozen 与 generated timestamp pattern 严格相等；drift 检测 FAIL |
| PAUSED reconciliation | `packages/domain/src/case-primary-switch.ts` / contracts / OpenAPI / decision 测试均为五态；case-level `PAUSED` 残留 0 |
| Full regression | `bunx vitest run`：211 files / 1260 tests / 0 failed / 0 skipped |
| typecheck / guard / OpenAPI / governance | `bun run typecheck` PASS；`bun run guard:static` PASS（0 violations）；`bun run openapi:check` PASS；`validate-governance.mjs` PASS |
| FR / Acceptance | FR-001–FR-020 语义未变；Acceptance 1–23 语义未变（AC-23 计数机械修正为 5，Slice 7 delta = exactly 1） |

---

## 本轮结束状态

```text
POST-AUDIT REMEDIATION IN PROGRESS
PENDING INDEPENDENT AUDIT
```

**未解决计划问题：0。** 本轮允许修改 spec / plan / tasks / contracts / 验证脚本 / 测试 / 生成物；`Docs/**` authored diff 必须为 0。
