# Implementation Tasks — 004-case-participant-core

**Feature**: `specs/004-case-participant-core/spec.md`
**Phase**: Phase 1 — Common Core 地基（`Docs/V1技术设计.md` §38）
**Stage**: Tasks（authoring only）
**Status**: Tasks authored；**IMPLEMENT GATE = BLOCKED**（Slice 2 未 merge；005 runtime 未实现）
**Source of truth**:
- `spec.md`（31 FR / 19 Acceptance / 15 SC，已冻结）
- `plan.md`（D-1—D-17）
- `research.md`
- `data-model.md`
- `contracts/participation-api.openapi.yaml`
- `contracts/authorization-rls-and-idempotency.md`
- `contracts/participant-lifecycle-and-identity-seam.md`
- `quickstart.md`
- `checklists/requirements-quality.md`（130/130 PASS；F-01—F-06）

> 本文件把已冻结并通过 Checklist 的实现 Plan 拆成可执行的 Implement 工作单元。它不是实现、不是 migration、不是测试代码、不是伪代码，也不重新解释需求。`tasks.md` 只允许 Implement AI 在 Task 完成后更新 checkbox / completion evidence / evidence reference；不得借 checkbox 修改需求或设计。

---

## 0. 执行规则（Implement AI 必读）

1. **Phase 0 是硬门禁**。T001—T006 任一失败：`STOP — IMPLEMENT GATE BLOCKED`，`changed files = 0`；不得先实现 Case B、先写 migration、先写测试或 scaffold。
2. **TDD 顺序**：每个行为先写测试 / contract assertion → 观察预期失败 → 再实现 → 通过。Phase 中的测试 Task 排在实现 Task 之前。
3. **005 runtime 不是 Slice 4 Task**：不得实现 invitation-aware bootstrap、binding attempt、candidate recognition、双确认、`persons.account_id` 写入、P2 merge。Slice 4 只消费 005 runtime 完成后的 identity result；005 runtime 不可用时 Phase 0 直接停止。
4. **不得 Case-B-only 缩减**：Owner 未批准 partial implementation；Phase 0 失败必须整体停止。
5. **冻结上游**：`spec.md` / `plan.md` / `research.md` / `data-model.md` / `quickstart.md` / `contracts/**` / `checklists/**` / `Docs/**` 只读。Implement 发现真实冲突时停止并报告 `BLOCKED — FROZEN INPUT CONFLICT`，不得顺手改。
6. **不新增**：第二套 authorize / RBAC / 幂等 / audit / participant 表 / Evidence / Assessment / Formulation / Scene / Plan / Task / Notification / UI / 005 runtime。
7. `[P]` 只表示：不同文件 / 无输出依赖 / 可安全并行 / 无 migration 或 generated contract 顺序冲突。其余不要标。
8. 每个 Task 的 `[VERIFY:...]` 是**可观察验证**，不是“看起来完成”。Implement 收尾必须真实执行并保留输出。
9. Tasks / Analyze 阶段不执行 Implement Gate；本文件 PASS 不打开 Implement Gate。

---

## 1. Task Dependency Graph

```text
Phase 0  T001—T006   IMPLEMENT GATE（硬门禁）
  ↓ 全部 PASS
Phase 1  T007—T014   Contract / Test Scaffolding（TDD 起点）
  ↓
Phase 2  T015—T025   Database Foundation
  ↓
Phase 3  T026—T034   Domain Lifecycle
  ↓
Phase 4  T035—T041   Invite Token / Replay
  ↓
Phase 5  T042—T048   Authorization / RLS
  ↓
Phase 6  T049—T055   Compliance / Identity Seam
  ↓
Phase 7  T056—T064   Public API
  ↓
Phase 8  T065—T073   Idempotency / Concurrency
  ↓
Phase 9  T074—T080   Audit / Anti-enumeration
  ↓
Phase 10 T081—T092   Integration / Verification
  ↓
Phase 11 T093—T097   Evidence / Implement Closeout
```

**跨 Phase 顺序**：Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11。Phase 内测试先于实现；同文件的实现 Task 不标 `[P]`。

---

# Phase 0 — IMPLEMENT GATE

> 只做只读依赖验证。不得写业务代码、migration、tests、scaffold。任一失败 → T006 停止。

- [ ] T001 [P] 验证 Slice 1 已合并 main 且有 **Independent Converge PASS** 证据。 [REQ: FR-030 / Acceptance 19 / D-17] [VERIFY: `git merge-base --is-ancestor origin/main HEAD`；检查 `specs/001-family-identity-core/**` 与 Converge evidence；记录证据路径]
  - 目标：确认 Slice 1 是可用地基，而不是“设计存在”。
  - 文件/范围：只读 `specs/001-family-identity-core/**`、git 历史、CI / converge evidence。
  - 动作：确认 main 含 Slice 1 实现；确认独立 Converge PASS 证据（不是只看 Plan 或自检）；记录 SHA / 报告路径。
  - 前置：无。
  - 完成条件：证据存在且 PASS；否则 T006 触发整体停止。

- [ ] T002 [P] 验证 Slice 2 已合并 main 且有 **Independent Converge PASS** 证据。 [REQ: FR-030 / Acceptance 19 / D-17] [VERIFY: `git log --oneline origin/main`；`test -d specs/002-case-core`；检查 Slice 2 Converge evidence；记录证据路径]
  - 目标：确认 Case Core、Case manager、Case RLS、CASE_CREATE 幂等、case_events 已真实可用。
  - 文件/范围：只读 `specs/002-case-core/**`、git 历史、CI / converge evidence。
  - 动作：确认 Slice 2 已 merge main；确认 Independent Converge PASS；确认不是仅分支设计。
  - 前置：无。
  - 完成条件：证据存在且 PASS；否则 T006 停止。

- [ ] T003 [P] 验证 005 identity contract 已 MERGED 到 main。 [REQ: FR-005 / FR-009 / D-7 / D-17] [VERIFY: `test -f specs/005-invited-identity-binding-contract/spec.md`；`git log --oneline origin/main`]
  - 目标：确认 Slice 4 可消费已冻结的身份合同。
  - 文件/范围：只读 `specs/005-invited-identity-binding-contract/spec.md`、main 历史。
  - 动作：确认 PR #11 已 merge；记录 main SHA；不重新审核 / 不重新设计 005。
  - 前置：无。
  - 完成条件：contract 存在且 main 历史可追溯；否则 T006 停止。

- [ ] T004 [P] 验证 005 runtime（invitation-aware bootstrap / binding attempt / 双确认 / no-P2）已真实可用并独立验证；**不得在本 Slice 实现它**。 [REQ: FR-005 / FR-009 / FR-027 / D-7 / D-17] [VERIFY: `rg -n "invitation-aware|binding_attempt|participation-invites" apps packages db`；检查 005 runtime 独立验证证据]
  - 目标：区分「005 contract MERGED」与「005 runtime available」。
  - 文件/范围：只读 `apps/**`、`packages/**`、`db/**`、005 runtime evidence。
  - 动作：确认 bootstrap 端点 / attempt 存储 / 双确认 / no-P2 运行时存在且独立验证；禁止在 Slice 4 新建这些能力。
  - 前置：T003。
  - 完成条件：runtime evidence 存在且 PASS；否则 T006 停止。若仅 contract merged → `STOP — 005 IDENTITY RUNTIME NOT AVAILABLE`。

- [ ] T005 [P] 验证 Slice 3 / `003-evidence-core` 不是 Slice 4 的 Implement dependency。 [REQ: FR-019 / FR-030 / D-17] [VERIFY: `rg -n "evidence|assertions|observations|003-evidence" specs/004-case-participant-core/plan.md specs/004-case-participant-core/contracts specs/004-case-participant-core/spec.md`]
  - 目标：确认本 Slice 不写 Evidence，不因编号自动依赖 Slice 3。
  - 文件/范围：只读本 Feature artifacts。
  - 动作：确认没有 Evidence writer / assertions / observations 写入任务；若发现真实依赖，停止并报告。
  - 前置：无。
  - 完成条件：不存在 Evidence runtime dependency；否则 T006 停止。

- [ ] T006 汇总 Phase 0 gate；任一 T001—T005 失败时停止整个 Slice 4 Implement。 [REQ: FR-030 / Acceptance 19 / D-17] [VERIFY: 汇总 T001—T005 的真实输出；`git status --porcelain=v1`]
  - 目标：把依赖证据收敛为一个明确的 go / no-go。
  - 文件/范围：只读；不写任何文件。
  - 动作：如果全部 PASS → 进入 Phase 1；如果任一 FAIL → 输出 `STOP — IMPLEMENT GATE BLOCKED`，`changed files = 0`。
  - 前置：T001—T005。
  - 完成条件：明确记录 `IMPLEMENT GATE = OPEN`（仅当全部真实 PASS）或 `IMPLEMENT GATE = BLOCKED`；不得在 BLOCKED 时继续。

---

# Phase 1 — Contract / Test Scaffolding

> 先写 contract / schema / type 测试，再实现 schema / env / types。不得改变产品合同。

- [ ] T007 [P] 新增 participation request / response strict schema 测试（越权字段 422、token 不在非 create 响应）。 [REQ: FR-015 / FR-026 / FR-027 / D-5] [VERIFY: `bunx vitest run tests/domain/participation-contracts.test.ts`（实现前预期 FAIL）]
  - 目标：冻结 API schema 的严格性与最小字段。
  - 文件：`tests/domain/participation-contracts.test.ts`。
  - 动作：覆盖 create invite / accept / decline / withdraw / GET 的 strict body；断言 `familyId` / `caseId` / `state` / `expiresAt` / `role` / `inviteToken`（非 create）等越权字段被拒绝；断言 response 不含 token hash / 敏感字段。
  - 前置：Phase 0 PASS。
  - 完成条件：测试先以“schema 不存在 / 字段不匹配”预期 FAIL。

- [ ] T008 实现 `packages/contracts/src/schemas.ts` 的 participation Zod schemas，并从 `packages/contracts/src/index.ts` 导出。 [REQ: FR-026 / FR-027 / D-5] [VERIFY: `bunx vitest run tests/domain/participation-contracts.test.ts`；`bun run typecheck`]
  - 目标：让 T007 的契约测试通过。
  - 文件：`packages/contracts/src/schemas.ts`、`packages/contracts/src/index.ts`。
  - 动作：严格 schema；camelCase；create response 含 `inviteToken`；public invite view 不含 person / case / family；ParticipationResource 最小字段。
  - 前置：T007。
  - 完成条件：T007 PASS；无越权字段被静默忽略。

- [ ] T009 [P] 新增 env 配置测试：`PARTICIPATION_INVITE_TTL_SECONDS` 正整数、`PARTICIPATION_INVITE_TOKEN_SECRET` ≥32 bytes、无默认值、非法即 fail-closed。 [REQ: FR-015 / D-14] [VERIFY: `bunx vitest run tests/domain/participation-env.test.ts`（实现前预期 FAIL）]
  - 目标：冻结 TTL / token secret 的配置边界，不冻结具体 TTL 数字。
  - 文件：`tests/domain/participation-env.test.ts`。
  - 动作：缺失 / 0 / 负数 / 非整数 / secret 过短全部失败；合法值通过；不得有 production default。
  - 前置：Phase 0 PASS。
  - 完成条件：测试先以 config key 不存在预期 FAIL。

- [ ] T010 实现 `packages/contracts/src/env.ts` 的 participation 配置校验。 [REQ: FR-015 / D-14] [VERIFY: `bunx vitest run tests/domain/participation-env.test.ts`]
  - 目标：让 T009 通过，并确保启动 fail-closed。
  - 文件：`packages/contracts/src/env.ts`。
  - 动作：新增两个 required 字段；无默认值；错误信息不泄露 secret。
  - 前置：T009。
  - 完成条件：T009 PASS；缺失配置时启动失败。

- [ ] T011 [P] 新增 domain participation 类型 / 状态 / 错误码测试。 [REQ: FR-001 / FR-002 / D-2 / D-4] [VERIFY: `bunx vitest run tests/domain/participation-types.test.ts`（实现前预期 FAIL）]
  - 目标：冻结状态枚举、最小 resource 类型、错误码集合。
  - 文件：`tests/domain/participation-types.test.ts`。
  - 动作：断言 `PENDING / ACTIVE / DECLINED / EXPIRED / WITHDRAWN`；断言无 `REVOKED / CANCELLED`；断言错误码集合。
  - 前置：Phase 0 PASS。
  - 完成条件：测试先以类型 / 导出不存在预期 FAIL。

- [ ] T012 实现 `packages/domain/src/participants.ts` 的类型 / 状态 / 纯函数骨架，并从 `packages/domain/src/index.ts` 导出。 [REQ: FR-001 / FR-002 / D-2 / D-4] [VERIFY: `bunx vitest run tests/domain/participation-types.test.ts`；`bun run typecheck`]
  - 目标：让 T011 通过；不写 SQL。
  - 文件：`packages/domain/src/participants.ts`、`packages/domain/src/index.ts`。
  - 动作：定义 state 类型 / ParticipationResource / 错误码 / token hash 类型；不实现 repository 或迁移。
  - 前置：T011。
  - 完成条件：T011 PASS。

- [ ] T013 [P] 新增 participation 测试 fixtures / helpers（family / person / case / manager / target / participation）。 [REQ: FR-002 / FR-004 / D-15] [VERIFY: `rg -n "participation" tests/setup tests/domain tests/integration`；`bun run typecheck`]
  - 目标：给后续测试提供可复用、不伪造业务结果的 fixture。
  - 文件：`tests/setup/participation-fixtures.ts`（或仓库现有 fixture 目录的等价文件）。
  - 动作：只创建测试数据 helper；不写生产代码；不直接写 `persons.account_id` 冒充 Case C。
  - 前置：Phase 0 PASS；T012 可并行。
  - 完成条件：helpers 可被后续测试导入；不包含 005 runtime 伪造。

- [ ] T014 [P] 新增 OpenAPI participation 契约一致性测试：6 paths / 22 schemas / 无 `/responses` / strict schema / state enum 一致。 [REQ: FR-026 / FR-027 / FR-028 / D-5] [VERIFY: `bunx vitest run tests/integration/openapi-participations.test.ts`；`bun run openapi:check`（实现前预期 FAIL）]
  - 目标：把契约面变成可机械验证的测试。
  - 文件：`tests/integration/openapi-participations.test.ts`。
  - 动作：断言 6 个 operation；无 generic response / `/responses`；请求 strict；响应当最小字段；state enum 与 data-model 一致。
  - 前置：Phase 0 PASS；T008 / T012 可先完成，但测试可先写。
  - 完成条件：测试先以 route / schema 不存在预期 FAIL。

---

# Phase 2 — Database Foundation

> 先写 DB 结构 / 约束 / RLS / safe view 测试，再写 reviewed migration。不得修改 001 / 002 / 003。

- [ ] T015 [P] 新增 DB schema 测试：enum、`case_participants` 列集合、无越权列、`uuidv7()`。 [REQ: FR-001 / FR-002 / FR-029 / D-2 / D-9] [VERIFY: `bunx vitest run tests/db/participants-schema.test.ts`（实现前预期 FAIL）]
  - 目标：冻结表 / 列 / enum 结构。
  - 文件：`tests/db/participants-schema.test.ts`。
  - 动作：断言 `case_participation_state`；断言列集合；断言无 `role / account_id / age_band / guardian_person_id / consent_* / binding_state / visibility / deleted_at`；断言 `id DEFAULT uuidv7()` 只是 schema fallback；invite-create path 必须显式 id（由 T031/T037/T058/T066 验证）。
  - 前置：Phase 1 完成。
  - 完成条件：测试先以表 / enum 不存在预期 FAIL。

- [ ] T016 [P] 新增 DB 约束测试：state / timestamp CHECK 全部合法组合与非法组合。 [REQ: FR-002 / FR-015 / D-2 / D-4] [VERIFY: `bunx vitest run tests/db/participants-constraints.test.ts`（实现前预期 FAIL）]
  - 目标：让冻结状态机可由数据库验证。
  - 文件：`tests/db/participants-constraints.test.ts`。
  - 动作：覆盖 PENDING / ACTIVE / DECLINED / EXPIRED / WITHDRAWN 的 timestamp 组合；WITHDRAWN 必有 `accepted_at`；EXPIRED `expired_at >= invite_expires_at`；非法组合被拒。
  - 前置：Phase 1 完成。
  - 完成条件：测试先以约束不存在预期 FAIL。

- [ ] T017 新增 DB 约束测试：复合 FK、`family_members` 唯一键、token hash 唯一 / 64 hex、expiry 顺序。 [REQ: FR-004 / FR-029 / D-2 / D-3] [VERIFY: `bunx vitest run tests/db/participants-constraints.test.ts`]
  - 目标：验证跨 Family 与 token / expiry 的结构防线。
  - 文件：`tests/db/participants-constraints.test.ts`。
  - 动作：覆盖 `(case_id, family_id)` / `(person_id, family_id)` 复合 FK；`family_members (person_id, family_id)` 唯一；token hash unique / shape；`invite_expires_at > created_at`；`expired_at >= invite_expires_at`。
  - 前置：T016（同文件可合并执行，但本 Task 保留独立断言组）。
  - 完成条件：结构 introspection 输出真实约束。

- [ ] T018 [P] 新增 DB 约束测试：partial unique live participation、terminal 历史可多条、re-invite 语义。 [REQ: FR-029 / D-2 / D-10] [VERIFY: `bunx vitest run tests/db/participants-live-uniqueness.test.ts`]
  - 目标：验证 PENDING / ACTIVE 唯一性 + terminal 历史保留。
  - 文件：`tests/db/participants-live-uniqueness.test.ts`。
  - 动作：断言同一 `(case, person)` 不能有两个 PENDING / ACTIVE；DECLINED / EXPIRED / WITHDRAWN 后可创建新 resource；并发 create 不产生两个 live rows。
  - 前置：T016。
  - 完成条件：partial unique predicate 真实存在并生效。

- [ ] T019 [P] 新增 DB / RLS 测试：ENABLE / FORCE、运行角色、最小 grants、无上下文 0 行。 [REQ: FR-021 / D-11] [VERIFY: `bunx vitest run tests/db/participants-rls.test.ts`]
  - 目标：验证双层隔离的数据库层。
  - 文件：`tests/db/participants-rls.test.ts`。
  - 动作：`relrowsecurity = true`、`relforcerowsecurity = true`；`xiaoshuyin_app` 非 owner / `rolbypassrls = false`；无 `app.family_id` / `app.person_id` / `app.invite_token_hash` 时 SELECT 0 行、写入拒绝；token / self policy 不授予 UPDATE。
  - 前置：Phase 1 完成。
  - 完成条件：真实 RLS 查询输出。

- [ ] T020 [P] 新增 DB / RLS 测试：token policy 只匹配 PENDING、`case_participant_invite_public` safe view、terminal token 不可读。 [REQ: FR-006 / FR-022 / D-11 / D-14 / F-02] [VERIFY: `bunx vitest run tests/db/participants-token-view.test.ts`]
  - 目标：验证 F-02 的 row + column 防线。
  - 文件：`tests/db/participants-token-view.test.ts`。
  - 动作：token context 只返回 PENDING 行；terminal token 0 行；view 只含 `participation_id / state / expires_at / created_at`；view predicate 为 `state='PENDING' AND invite_expires_at > now()`；effective-expired PENDING 不通过 public view 返回 200；token RLS 仍 `state='PENDING'`，仅供已认证 accept/decline 物化；token path 无 UPDATE。
  - 前置：T019。
  - 完成条件：safe view / policy 真实存在并生效。

- [ ] T021 实现 reviewed migration：`case_participation_state` enum + `family_members (person_id, family_id)` 唯一键（若 final main 尚无）。 [REQ: FR-001 / FR-002 / D-3] [VERIFY: `bun run db:migrate`；`bunx vitest run tests/db/participants-schema.test.ts`]
  - 目标：建立 enum 与复合 FK 所需唯一键。
  - 文件：`db/migrations/<next>_case_participant_core.sql`（Implement 时读取 final merged main 最新编号后顺延；不得硬编码未来编号）。
  - 动作：CREATE TYPE；ALTER TABLE family_members ADD CONSTRAINT；不修改 001/002/003。
  - 前置：T015—T020 测试已写；Phase 0 PASS。
  - 完成条件：migration 可应用；T015 的 enum 断言通过。

- [ ] T022 实现 migration：`case_participants` 表 + 列 + 主键 + state / timestamp CHECK。 [REQ: FR-001 / FR-002 / FR-015 / D-2 / D-3] [VERIFY: `bun run db:migrate`；`bunx vitest run tests/db/participants-constraints.test.ts`]
  - 目标：建立单一参与资源表与状态完整性。
  - 文件：同一 reviewed migration。
  - 动作：列 / 默认 `/` CHECK；`invite_expires_at` NOT NULL 无默认；不存 guardian / consent / account snapshot。
  - 前置：T021。
  - 完成条件：T016 通过；结构断言无越权列。

- [ ] T023 实现 migration：复合 FK + 索引（token unique、partial unique live、expiry、family/case、person）。 [REQ: FR-002 / FR-004 / FR-029 / D-2 / D-3] [VERIFY: `bun run db:migrate`；`bunx vitest run tests/db/participants-constraints.test.ts tests/db/participants-live-uniqueness.test.ts`]
  - 目标：建立跨 Family / Person 与 live uniqueness 的结构防线。
  - 文件：同一 reviewed migration。
  - 动作：`(case_id, family_id)`、`(person_id, family_id)` 复合 FK；token unique；partial unique `WHERE state IN ('PENDING','ACTIVE')`；索引。
  - 前置：T022。
  - 完成条件：T017 / T018 通过。

- [ ] T024 实现 migration：`app_invite_token_hash()` / `app.set_invite_token_context(text)` + ENABLE/FORCE RLS + 三条 policy + safe view。 [REQ: FR-006 / FR-021 / D-11 / D-14 / F-02] [VERIFY: `bun run db:migrate`；`bunx vitest run tests/db/participants-rls.test.ts tests/db/participants-token-view.test.ts`]
  - 目标：建立 token / family / self 三层 RLS 与 DB 列投影。
  - 文件：同一 reviewed migration。
  - 动作：token policy 加 `state='PENDING'`；`security_invoker` view `case_participant_invite_public` 只含安全列，predicate 为 `state='PENDING' AND invite_expires_at > now()`；token policy 仍 `state='PENDING'`，仅供已认证 accept/decline 读取 effective-expired PENDING 并物化；无 family / person / account 的 token context 函数。
  - 前置：T023。
  - 完成条件：T019 / T020 通过；token 不能 UPDATE。

- [ ] T025 实现 migration：grants + `business_audit_events` event/resource CHECK 扩展 + `idempotency_keys.command_type` 扩展；空库 / 已有 001-003 重放 + db evidence。 [REQ: FR-016 / FR-021 / FR-023 / D-3 / D-9 / D-12] [VERIFY: `bun run db:migrate`；`bun run db:evidence`；`bunx vitest run tests/db/migration-repro.test.ts`]
  - 目标：完成最小权限与既有表的最小增量。
  - 文件：同一 reviewed migration；不修改历史 migration。
  - 动作：`case_participants` SELECT/INSERT/UPDATE；view SELECT；enum USAGE；function EXECUTE；audit 5 个 event_type + `CASE_PARTICIPANT`；idempotency 4 个 command_type；保留既有 CHECK 值。
  - 前置：T024。
  - 完成条件：migration 在空库 / 既有库重放 PASS；`db:evidence` PASS；既有 CHECK 值未被删除。

---

# Phase 3 — Domain Lifecycle

> 先写 domain unit / DB concurrency 测试，再实现状态机与 expiry 物化。所有 transition 使用行锁 + 条件 UPDATE；成功转换 ∈ {0,1}。

- [ ] T026 [P] 新增 domain 测试：create PENDING、effective expiry、PENDING 无 active capability。 [REQ: FR-007 / FR-015 / D-4 / D-14] [VERIFY: `bunx vitest run tests/domain/participants-domain.test.ts`（实现前预期 FAIL）]
  - 目标：冻结 pending / effective expired 语义。
  - 文件：`tests/domain/participants-domain.test.ts`。
  - 动作：`state=PENDING + now >= invite_expires_at` → effective EXPIRED；PENDING 不产生 active capability；未过期 PENDING 保持 PENDING。
  - 前置：Phase 2 完成。
  - 完成条件：测试先以函数不存在预期 FAIL。

- [ ] T027 新增 domain 测试：accept / decline / withdraw / terminal 不可复活。 [REQ: FR-007 / FR-011 / FR-013 / FR-015 / D-4] [VERIFY: `bunx vitest run tests/domain/participants-domain.test.ts`]
  - 目标：冻结状态转换表。
  - 文件：同一 domain test 文件（独立测试块）。
  - 动作：PENDING→ACTIVE；PENDING→DECLINED；PENDING→EXPIRED；ACTIVE→WITHDRAWN；DECLINED / EXPIRED / WITHDRAWN 不可 accept；WITHDRAWN 保留 `accepted_at`。
  - 前置：T026。
  - 完成条件：非法转换被拒绝；不新增状态。

- [ ] T028 新增 domain 测试：timestamp / 0-or-1 成功转换 / 无部分 capability。 [REQ: FR-015 / FR-031 / D-4 / D-10 / F-04] [VERIFY: `bunx vitest run tests/domain/participants-domain.test.ts`]
  - 目标：冻结时间戳与并发结果语义。
  - 文件：同一 domain test 文件。
  - 动作：每个 state 只允许对应 timestamp；WITHDRAWN 必须有 `accepted_at` + `withdrawn_at`；成功转换至多 1；0 合法。
  - 前置：T026。
  - 完成条件：测试覆盖 0/1 语义。

- [ ] T029 [P] 新增 DB / integration 并发测试：accept vs decline、accept vs expiry、decline vs expiry、never-accessed derived EXPIRED。 [REQ: FR-007 / FR-015 / FR-031 / D-10 / F-03 / F-06] [VERIFY: `bunx vitest run tests/integration/participations-accept-concurrency.test.ts tests/integration/participations-expiry.test.ts`]
  - 目标：冻结 expiry / transition 的并发赢家。
  - 文件：`tests/integration/participations-accept-concurrency.test.ts`、`tests/integration/participations-expiry.test.ts`。
  - 动作：并发两个 accept / accept vs decline / accept vs expiry / decline vs expiry；断言至多一个成功；expired materialization exactly-once audit；never-accessed 不写 audit。
  - 前置：Phase 2 完成；T026—T028 可先写。
  - 完成条件：测试先以实现不存在 / 行为不符预期 FAIL。

- [ ] T030 实现 `packages/domain/src/participants.ts` 的纯状态机 + effective expiry。 [REQ: FR-007 / FR-015 / D-4 / D-14 / F-03] [VERIFY: `bunx vitest run tests/domain/participants-domain.test.ts`]
  - 目标：让 T026—T028 通过。
  - 文件：`packages/domain/src/participants.ts`。
  - 动作：状态转换守卫、effective state、timestamp 规则（不写 SQL）；不拥有 token 派生 / hash / create orchestration，token 语义归 T038。
  - 前置：T026—T028；Phase 2。
  - 完成条件：domain 测试 PASS；无新增状态。

- [ ] T031 实现 participation repository：create / read / lock / state update / expiry materialization。 [REQ: FR-001 / FR-007 / FR-015 / FR-016 / D-2 / D-4 / D-9 / D-10 / F-01] [VERIFY: `bunx vitest run tests/db/participants-schema.test.ts tests/domain/participants-domain.test.ts`]
  - 目标：把状态机落到 `case_participants`。
  - 文件：`packages/domain/src/participants.ts`。
  - 动作：所有 SQL 只在 repository；`SELECT ... FOR UPDATE`；条件 UPDATE；create 返回 id / state / timestamps；invite-create 同一 transaction 先 `SELECT uuidv7()` 预分配 `participationId`；提供 `insertParticipation(tx, { id, tokenHash, createdAt, inviteExpiresAt, ... })`；INSERT 显式 `id`；持久化调用方提供的 `invite_token_hash`；`created_at` / `updated_at` / `invite_expires_at` 由 server-time inputs / DB `now()` 决定；不得依赖 INSERT default；不派生 token（token 算法归 T038）；不写 `persons.account_id`；不实现 HTTP / idempotency orchestration。
  - 前置：T030。
  - 完成条件：repository 方法可被测试调用；SQL 不散落路由；T030/T035/T038 不重复实现 create flow。C-01 create ordering 的完整编排由 T061/T071 验证，本 Task 不以 T037/T058/T066 为完成依据。

- [ ] T032 实现 accept / decline / withdraw / expiry materialization 的事务路径。 [REQ: FR-007 / FR-011 / FR-013 / FR-015 / FR-031 / D-4 / D-10 / F-03 / F-04 / F-06] [VERIFY: `bunx vitest run tests/integration/participations-accept-concurrency.test.ts tests/integration/participations-expiry.test.ts`]
  - 目标：让 T029 通过；确保 exactly-once expiry audit。
  - 文件：`packages/domain/src/participants.ts`（service 层可单独文件，但 SQL 留在 repository）。
  - 动作：行锁 + 条件 UPDATE；expiry 只有影响 1 行才写 audit；0 行不写；成功转换至多 1；无复活。只实现 domain / repository lifecycle transaction mechanics 与 expiry materialization primitive；**不**承担 HTTP GET self orchestration、route authorization sequence、`setFamilyContext` adapter 编排（归 T043/T045/T061）。
  - 前置：T031。
  - 完成条件：T029 PASS；并发测试真实输出 0/1。

- [ ] T033 [P] 新增 DB 测试：terminal 不可 reactivate、历史保留、WITHDRAWN 保留 accepted_at。 [REQ: FR-014 / FR-015 / D-4] [VERIFY: `bunx vitest run tests/db/participants-history.test.ts`]
  - 目标：验证历史与 terminal 不可复活。
  - 文件：`tests/db/participants-history.test.ts`。
  - 动作：DECLINED / EXPIRED / WITHDRAWN 再 accept 失败；WITHDRAWN 行仍存在 `accepted_at`；历史不删除。
  - 前置：T032。
  - 完成条件：真实 DB 查询输出。

- [ ] T034 从 `packages/domain/src/index.ts` 导出 participants 模块并跑 typecheck。 [REQ: FR-001 / D-1 / D-15] [VERIFY: `bun run typecheck`；`rg -n "participants" packages/domain/src/index.ts`]
  - 目标：让上层 route / service 可导入。
  - 文件：`packages/domain/src/index.ts`。
  - 动作：导出 participants API；不导出 SQL 字符串 / 内部游标。
  - 前置：T030—T033。
  - 完成条件：typecheck PASS。

---

# Phase 4 — Invite Token / Replay

> 覆盖 F-01 / F-02：确定性 token 派生、hash-only、redacted snapshot、replay re-derivation、safe view。不得存 token 明文。

- [ ] T035 [P] 新增 unit 测试：确定性 HMAC 派生；同一 `participationId` → 同一 token，不同 id → 不同 token；secret 校验。 [REQ: FR-006 / D-2 / D-9 / D-14 / F-01] [VERIFY: `bunx vitest run tests/domain/participants-token.test.ts`（实现前预期 FAIL）]
  - 目标：冻结 token 派生。
  - 文件：`tests/domain/participants-token.test.ts`。
  - 动作：断言 HMAC-SHA256 + `"participation-invite:v1:" + participationId`；base64url；secret 缺失 / 过短失败；不存明文；C-01 derivation 只消费预分配 id，不依赖 DB default；created_at / expires_at 由 DB server time 决定（由 T031/T037/T058/T066 验证）。
  - 前置：T030。
  - 完成条件：测试先以 helper 不存在预期 FAIL。

- [ ] T036 新增 unit / serialization 测试：token 明文不进入 `idempotency_keys.response_body` / audit / logs。 [REQ: FR-006 / FR-023 / D-2 / D-9 / F-01] [VERIFY: `bunx vitest run tests/domain/participants-token.test.ts`]
  - 目标：验证 hash-only 与 redacted snapshot。
  - 文件：`tests/domain/participants-token.test.ts`（与 T035 同文件；不可与 T035 并行）。
  - 动作：断言 snapshot 不含 inviteToken；audit / log 不含 token / token hash；DB token view 的列投影由 T040 覆盖。
  - 前置：T035。
  - 完成条件：serialization / snapshot 断言通过。

- [ ] T037 [P] 新增 integration 测试：invite create same-key replay 返回同一 `participationId` + 同一 `inviteToken`；不同 key / payload 语义。 [REQ: FR-016 / D-9 / D-14 / F-01] [VERIFY: `bunx vitest run tests/integration/participations-idempotency.test.ts`]
  - 目标：验证 F-01 的 replay 语义。
  - 文件：`tests/integration/participations-idempotency.test.ts`。
  - 动作：same key + same payload → 同一 token；different key → 新 resource / 新 token；same key + different payload → 409；snapshot 保存 `participationId` + redacted metadata，不含 token；create 预分配 `participationId`、explicit `id`、`created_at` / `expires_at` DB server time。
  - 前置：Phase 2 / T030。
  - 完成条件：测试先以实现不存在预期 FAIL。

- [ ] T038 实现 token 派生 / hash / redacted serialization / replay rehydration primitives。 [REQ: FR-006 / FR-016 / D-2 / D-9 / D-14 / F-01] [VERIFY: `bunx vitest run tests/domain/participants-token.test.ts`]
  - 目标：让 T035 / T036 通过；只拥有 token / tokenHash / replay primitive，不拥有 DB create / HTTP / idempotency orchestration。
  - 文件：`packages/domain/src/participants.ts`。
  - 动作：从预分配 `participationId` 派生 token；`sha256(token)`；redacted snapshot / replay rehydration primitives；不得 INSERT `case_participants`、不得实现 DB create flow、不得实现 HTTP invite-create / idempotent replay（由 T061 / T071 组合）；不得存明文。
  - 前置：T035 / T036；T037 可先写（expected fail，T071 使其通过）。
  - 完成条件：`tests/domain/participants-token.test.ts` PASS；token primitive 可被 T061 / T071 组合调用。

- [ ] T039 [P] 新增 DB / RLS 测试：token path 只走 safe view、terminal token 不可读、token 不能 UPDATE、repository 不 `SELECT *`。 [REQ: FR-006 / FR-021 / D-11 / D-14 / F-02] [VERIFY: `bunx vitest run tests/db/participants-token-view.test.ts`]
  - 目标：验证 F-02 的三层边界。
  - 文件：`tests/db/participants-token-view.test.ts`。
  - 动作：token context 仅 PENDING；terminal 0 行；view 列集合；view predicate expiry；effective-expired PENDING 0 行；token RLS 仍 `state='PENDING'` 仅供已认证 accept/decline 物化；UPDATE 被拒；guard test 断言无 `SELECT *` / base table。
  - 前置：T024。
  - 完成条件：测试先以 safe view / policy 不存在预期 FAIL。

- [ ] T040 实现 safe public projection mapping（`case_participant_invite_public` → OpenAPI `ParticipationInvitePublicView`）。 [REQ: FR-006 / FR-022 / D-11 / D-14 / F-02] [VERIFY: `bunx vitest run tests/db/participants-token-view.test.ts`]
  - 目标：让 T039 通过；只实现 repository / projection，HTTP lookup integration 由 Phase 7 T059 / T061 验证。
  - 文件：`packages/domain/src/participants.ts`（repository）+ `packages/contracts/src/schemas.ts`。
  - 动作：只 SELECT view 的 `participation_id / state / expires_at / created_at`；view predicate `state='PENDING' AND invite_expires_at > now()`；effective-expired PENDING 返回 404；不 SELECT base table 敏感列；不 SELECT *；不实现 HTTP route。
  - 前置：T038；T024；T039。
  - 完成条件：T039 PASS；projection 可被 Phase 7 route 使用。

- [ ] T041 验证 F-01 / F-02 closeout 证据并记录。 [REQ: FR-006 / FR-016 / D-9 / D-11 / F-01 / F-02] [VERIFY: `bunx vitest run tests/domain/participants-token.test.ts tests/db/participants-token-view.test.ts tests/integration/participations-idempotency.test.ts`；`rg -n "inviteToken" packages/domain/src/participants.ts apps/server/api/src`]
  - 目标：确认 token 明文不落库且 replay 返回同一 token。
  - 文件：证据记录 / test output；不修改设计。
  - 动作：汇总真实输出；若 token 被存入 snapshot → FAIL。
  - 前置：T035—T040。
  - 完成条件：证据 PASS；否则停止并报告。

---

# Phase 5 — Authorization / RLS

> 只扩展单一 `authorize()`；不新建 `authorizeParticipation()`；不建 generic RBAC。

- [ ] T042 [P] 新增 unit 测试：manager create / target accept / decline / participant withdraw / manager read / GET self READ_SELF 的 allow / deny。 [REQ: FR-020 / D-6] [VERIFY: `bunx vitest run tests/domain/participants-authorization.test.ts`（实现前预期 FAIL）]
  - 目标：冻结 participation action 判定。
  - 文件：`tests/domain/participants-authorization.test.ts`。
  - 动作：断言 manager = `family.createdByPersonId`；self = `actor.personId === participation.personId`；GET self 必须调用 `authorize(PARTICIPATION_READ_SELF)`，self RLS match ≠ authorization success；deny reason `NOT_FAMILY_MANAGER` / `NOT_PARTICIPANT` / `PARTICIPATION_CONTEXT_REQUIRED`；非 participation action 不变。
  - 前置：Phase 1。
  - 完成条件：测试先以实现不存在预期 FAIL。

- [ ] T043 [P] 新增 integration 测试：manager 建邀请；target accept / decline；active participant withdraw；guardian 不自动授权；GET self READ_SELF / self RLS ≠ authorization / server-trusted family context。 [REQ: FR-003 / FR-020 / FR-021 / D-6 / D-11 / D-14] [VERIFY: `bunx vitest run tests/integration/participations-authorization.test.ts`]
  - 目标：验证三角色边界与 GET self 授权/上下文顺序。
  - 文件：`tests/integration/participations-authorization.test.ts`。
  - 动作：manager 可建邀请；普通 member / guardian 不可；target 可处理自己的；active 可 withdraw；guardian 不因 guardian 关系获得 participant read / management；GET self 可见 ≠ authorization success，必须 `authorize(PARTICIPATION_READ_SELF)`；expiry 物化必须使用 server-trusted `participation.family_id`，不接收 client `familyId`。
  - 前置：T042。
  - 完成条件：测试先以实现不存在预期 FAIL；T045 使其通过。

- [ ] T044 实现 `packages/authorization/src/authorize.ts` 的 participation 扩展。 [REQ: FR-020 / D-6 / D-1] [VERIFY: `bunx vitest run tests/domain/participants-authorization.test.ts`]
  - 目标：让 T042 通过；保持单一入口。
  - 文件：`packages/authorization/src/authorize.ts`。
  - 动作：新增 actions / purpose / resource / `participation` 输入；判定顺序 fail-closed；不新增 `authorizeParticipation()`。
  - 前置：T042。
  - 完成条件：unit 测试 PASS；既有 action 行为不变。

- [ ] T045 实现 route / service 的 authorization 调用与 family / self / token context 使用。 [REQ: FR-020 / FR-021 / D-6 / D-11 / D-14] [VERIFY: `bunx vitest run tests/integration/participations-authorization.test.ts tests/db/participants-rls.test.ts`；`rg -n "authorizeParticipation" apps packages`]
  - 目标：让 T043 通过；所有 action 先 authorize 再 SQL；HTTP GET read 的 end-to-end 由 T060/T061 验证，本 Task 不以 T060 为完成依据。
  - 文件：`apps/server/api/src/routes/participations.ts`、`apps/server/api/src/db/tx.ts`、`packages/domain/src/participants.ts`。`db/tx.ts` 明确新增三个 thin adapters：`withInviteTokenTransaction`（未认证 public lookup）、`setInviteTokenContext`（accept 已有 identity transaction）、`setFamilyContext`（self expiry / decline / withdraw / accept 解析 family 后）；不新建第二套 context framework。
  - 动作：manager create 用 family context；target / participant 用 identity + family context；token lookup 用 token context；GET self 先 `authorize(PARTICIPATION_READ_SELF)`，expiry 物化用 server-trusted `participation.family_id` 建立 family context；accept 用 `setInviteTokenContext` + `setFamilyContext`；不绕过 authorize；不得从 client 接收 `familyId`。
  - 前置：T043 / T044。
  - 完成条件：T043 PASS；`authorizeParticipation` 不存在；不依赖 T060 或任何后续 Phase 测试。

- [ ] T046 [P] 新增 DB / RLS 测试：no context / wrong family / wrong person / self / manager / token / wrong token / token cannot UPDATE。 [REQ: FR-021 / D-11 / D-14] [VERIFY: `bunx vitest run tests/db/participants-rls.test.ts`]
  - 目标：验证 RLS 行为矩阵。
  - 文件：`tests/db/participants-rls.test.ts`。
  - 动作：无上下 0 行；wrong family 0 行；self 只自己的行；token 只 PENDING 精确行；token 不能 UPDATE；manager 读取受 app authorize 约束；GET self expiry 物化使用 server-trusted `participation.family_id` 建立 family write context；self policy 仍 SELECT-only，不新增 self UPDATE policy。
  - 前置：T024；T045。
  - 完成条件：真实 RLS 查询输出。

- [ ] T047 验证无 `authorizeParticipation()` / generic RBAC / Case-wide access。 [REQ: FR-018 / FR-025 / D-6] [VERIFY: `rg -n "authorizeParticipation|RBAC|role enum|Visibility Matrix" apps packages`；`bunx vitest run tests/integration/participations-scope.test.ts`]
  - 目标：确认 participant 只获得有限授权。
  - 文件：只读检查 + `tests/integration/participations-scope.test.ts`。
  - 动作：断言 Participant 调 Case manager route 仍 404；无 Case 内容返回；无 generic role。
  - 前置：T045。
  - 完成条件：scope 测试 PASS。

- [ ] T048 验证 guardian relationship 不等于 participant authorization。 [REQ: FR-020 / D-6 / D-8] [VERIFY: `bunx vitest run tests/integration/participations-authorization.test.ts`]
  - 目标：防止 guardian 自动获得 Case / Participant 权限。
  - 文件：只读检查 + authorization integration test。
  - 动作：guardian + Family member 非 manager 不能建邀请 / 读取他人 participation；guardian 不是 participant 时不能 withdraw。
  - 前置：T045。
  - 完成条件：相关断言 PASS。

---

# Phase 6 — Compliance / Identity Seam

> Slice 4 只消费 005 结果：accept 只比较 `actor.personId === participation.person_id`；不写 `persons.account_id`；不实现 005 runtime。

- [ ] T049 [P] 新增 integration 测试：Case B correct Account / wrong Account；复用 / 拒绝；不 rebind；不自动 accept。 [REQ: FR-005 / FR-009 / FR-024 / D-7] [VERIFY: `bunx vitest run tests/integration/participations-identity-seam.test.ts`]
  - 目标：冻结 Case B。
  - 文件：`tests/integration/participations-identity-seam.test.ts`。
  - 动作：correct Account → accept 可继续；wrong Account → generic 404；无 rebind；binding 不自动 accept。
  - 前置：Phase 4 / T045。
  - 完成条件：测试先以实现不存在预期 FAIL。

- [ ] T050 新增 integration 测试：Case C binding COMMITTED / PENDING / terminal；binding 后仍需 explicit accept；无 P2。 [REQ: FR-005 / FR-009 / FR-024 / D-7] [VERIFY: `bunx vitest run tests/integration/participations-identity-seam.test.ts`]
  - 目标：冻结 Case C 消费边界。
  - 文件：同一 identity seam 测试文件。
  - 动作：COMMITTED 后 `active=0` 直到 accept；PENDING / terminal → 404；Person 数不增加；无 P2；错误 candidate 不能 accept / decline。
  - 前置：T049；005 runtime 可用（Phase 0）。
  - 完成条件：测试通过；若 005 runtime 不可用 → T006 已停止，不得伪造。

- [ ] T051 [P] 新增 integration 测试：UNDER_14 valid / invalid current consent；MINOR_14_17 applicable gate；decline / withdraw 不被 gate 阻断；F-05 taxonomy。 [REQ: FR-010 / FR-011 / FR-013 / FR-024 / D-8 / F-05] [VERIFY: `bunx vitest run tests/integration/participations-compliance.test.ts`]
  - 目标：冻结 consent / compliance 复检点。
  - 文件：`tests/integration/participations-compliance.test.ts`。
  - 动作：建邀请 / accept 重新读取 current；UNDER_14 无效 → 403 / generic 404；MINOR_14_17 不要求 UNDER_14 consent；decline / withdraw 在 consent 变化后仍可用；当前 taxonomy 只有 UNDER_14_GUARDIAN_CONSENT。
  - 前置：T045。
  - 完成条件：测试先以实现不存在预期 FAIL。

- [ ] T052 实现 identity precondition：accept 只比较 `actor.personId === participation.person_id`；不读 / 不写 `persons.account_id`。 [REQ: FR-005 / FR-009 / FR-024 / D-7] [VERIFY: `bunx vitest run tests/integration/participations-identity-seam.test.ts`；`rg -n "persons.*account_id|account_id.*persons" packages/domain/src/participants.ts apps/server/api/src/routes/participations.ts`]
  - 目标：让 T049 / T050 的 identity 分支通过。
  - 文件：`packages/domain/src/participants.ts`、`apps/server/api/src/routes/participations.ts`。
  - 动作：只使用 auth resolved `actor.personId`；不读 / 不写 `persons.account_id`；不创建 Person；不 rebind；不 auto accept。
  - 前置：T049 / T050。
  - 完成条件：identity 测试 PASS；grep 无 `persons.account_id` 写入。

- [ ] T053 实现 Compliance gate 复用：invite create / accept 重新读取 current profile / guardian / consent；decline / withdraw 绕过。 [REQ: FR-010 / FR-011 / FR-013 / D-8 / F-05] [VERIFY: `bunx vitest run tests/integration/participations-compliance.test.ts`]
  - 目标：让 T051 通过。
  - 文件：`packages/compliance/src/age-gate.ts`（复用 / 必要时只做适配）、`packages/domain/src/participants.ts`、路由。
  - 动作：invite create / accept 调 `assertMinorProcessingAllowed`；不复制 Age Matrix；decline / withdraw 不调用 gate；不存 snapshot。
  - 前置：T051。
  - 完成条件：compliance 测试 PASS；无新增 consent 类型。

- [ ] T054 新增 / 运行 Case C E2E 检查：必须真实经过 005 runtime；禁止直接写 `persons.account_id` 冒充；005 runtime 不可用则 `BLOCKED`。 [REQ: FR-005 / FR-009 / D-7 / D-17] [VERIFY: `bunx vitest run tests/integration/participations-identity-seam.test.ts`；检查 005 runtime evidence]
  - 目标：确保 Case C 不被 fixture 伪造。
  - 文件：identity seam test + quickstart §6 记录。
  - 动作：真实 bootstrap → binding COMMITTED → accept；PENDING / terminal → active=0；记录 BLOCKED if runtime absent。
  - 前置：T050；T004。
  - 完成条件：真实 005 runtime 证据存在；否则 `BLOCKED`，不得声称 PASS。

- [ ] T055 验证 F-05 / identity seam closeout 证据并记录。 [REQ: FR-010 / FR-024 / D-8 / F-05] [VERIFY: `bunx vitest run tests/integration/participations-compliance.test.ts tests/integration/participations-identity-seam.test.ts`]
  - 目标：确认 MINOR_14_17 taxonomy 与 identity ≠ participation 均落测试。
  - 文件：证据记录；不修改设计。
  - 动作：汇总真实输出；若把其他 consent 类型静默忽略 → FAIL。
  - 前置：T049—T054。
  - 完成条件：证据 PASS。

---

# Phase 7 — Public API

> 严格 6 条冻结 route。不得新增 `/responses`、generic update、delete、restore、manager cancel、Evidence。

- [ ] T056 [P] 新增 integration 测试：route surface 恰为 6 条；无 `/responses` / generic / 越界 route。 [REQ: FR-026 / FR-027 / FR-028 / D-5] [VERIFY: `bunx vitest run tests/integration/participations-route-surface.test.ts`（实现前预期 FAIL）]
  - 目标：冻结 public surface。
  - 文件：`tests/integration/participations-route-surface.test.ts`。
  - 动作：枚举 Fastify routes；断言 6 条；断言无 `/responses` / pause / resume / close / switch-primary / assessments / participants 等。
  - 前置：Phase 1。
  - 完成条件：测试先以 route 不存在预期 FAIL。

- [ ] T057 [P] 新增 integration 测试：strict request schema；越权字段 422 且零写入。 [REQ: FR-015 / FR-026 / D-5] [VERIFY: `bunx vitest run tests/integration/participations-http-boundary.test.ts`]
  - 目标：验证 422 零写入。
  - 文件：`tests/integration/participations-http-boundary.test.ts`。
  - 动作：提交 familyId / caseId / state / expiresAt / role / inviteToken 等；断言 422；Case / participation / audit / idempotency 零新增。
  - 前置：T056；T008。
  - 完成条件：测试先以 route 不存在预期 FAIL。

- [ ] T058 [P] 新增 integration 测试：create invite happy path（201、token、expiresAt、audit）。 [REQ: FR-003 / FR-004 / FR-026 / D-5 / D-14 / F-01] [VERIFY: `bunx vitest run tests/integration/participations-invite.test.ts`]
  - 目标：冻结 create invite 的可观察结果；idempotent replay 由 T066 / T071 验证，不在本 Task。
  - 文件：`tests/integration/participations-invite.test.ts`。
  - 动作：manager 建邀请；断言 201 / PENDING / token 在 create 响应返回 / `participationId` 预分配 / explicit `id` / `createdAt` / `expiresAt` DB server time / audit / 无 Evidence；token 明文不落库；不要求 same-key replay（T066/T071）。
  - 前置：T056；T025。
  - 完成条件：测试先以实现不存在预期 FAIL；T061 使其通过。

- [ ] T059 [P] 新增 integration 测试：invite lookup 200 最小字段；无效 / 过期 / 终止统一 404。 [REQ: FR-006 / FR-022 / FR-027 / D-5 / D-14] [VERIFY: `bunx vitest run tests/integration/participations-invite-lookup.test.ts`]
  - 目标：冻结未认证 lookup。
  - 文件：`tests/integration/participations-invite-lookup.test.ts`。
  - 动作：200 只含 participationId / state / expiresAt / notice；无 person / case / family / guardian / age / consent；无效 / 过期 / 终止统一 404 `INVITATION_NOT_AVAILABLE`；effective-expired PENDING（persisted PENDING 且 expires_at <= now）必须 404；只查询 safe view，不查询 base table。
  - 前置：T056；T039。
  - 完成条件：测试先以实现不存在预期 FAIL。

- [ ] T060 [P] 新增 integration 测试：accept / decline / withdraw / GET participation happy path + 最小字段。 [REQ: FR-005 / FR-007 / FR-011 / FR-012 / FR-013 / FR-020 / FR-027 / D-5 / D-6 / D-14] [VERIFY: `bunx vitest run tests/integration/participations-accept.test.ts tests/integration/participations-decline.test.ts tests/integration/participations-withdraw.test.ts tests/integration/participations-read.test.ts`]
  - 目标：冻结四个认证 route 的响应。
  - 文件：四个 integration test 文件。
  - 动作：accept 200 ACTIVE；decline 200 DECLINED；decline 前后 Case status / phase 不变，parent / Case manager independent Case work 不被阻断；withdraw 200 WITHDRAWN；GET 最小字段；GET self 在返回前必须调用 `authorize(PARTICIPATION_READ_SELF)`；不含 Case / Family / Evidence。
  - 前置：T056；T032。
  - 完成条件：测试先以实现不存在预期 FAIL。

- [ ] T061 实现 `apps/server/api/src/routes/participations.ts` 的 6 条 route。 [REQ: FR-003 / FR-004 / FR-026 / FR-027 / FR-028 / D-5] [VERIFY: `bunx vitest run tests/integration/participations-invite.test.ts tests/integration/participations-invite-lookup.test.ts tests/integration/participations-accept.test.ts tests/integration/participations-decline.test.ts tests/integration/participations-withdraw.test.ts tests/integration/participations-read.test.ts`]
  - 目标：让 T058—T060 通过；create route 组合 T031 preallocate / T038 token / T031 insert / audit，不实现 idempotent replay（T071）。
  - 文件：`apps/server/api/src/routes/participations.ts`。
  - 动作：严格 schema；调用 domain / authorization / compliance；invite create 组合 `SELECT uuidv7()` → T038 token/hash → T031 explicit-id insert → audit；不持有 SQL；不新增 route；不实现 T071 replay rehydration。
  - 前置：T058—T060；T031；T038；T045；T053。
  - 完成条件：6 route happy path PASS；route surface 恰为 6；T058 不要求 idempotent replay。

- [ ] T062 注册 routes 到 `apps/server/api/src/app.ts`；`plugins/auth.ts` 只放行 GET invite。 [REQ: FR-006 / FR-026 / D-5] [VERIFY: `bunx vitest run tests/integration/participations-route-surface.test.ts tests/integration/participations-invite-lookup.test.ts`；`rg -n "participations" apps/server/api/src/app.ts apps/server/api/src/plugins/auth.ts`]
  - 目标：让 route 真实可达，且只对 GET invite 免认证。
  - 文件：`apps/server/api/src/app.ts`、`apps/server/api/src/plugins/auth.ts`。
  - 动作：注册 `registerParticipationRoutes`；auth plugin 仅跳过 `GET /api/v1/participation-invites/:token`；不得放行 accept / decline / withdraw / GET participation。
  - 前置：T061。
  - 完成条件：route surface / auth 测试 PASS。

- [ ] T063 实现 `apps/server/api/src/plugins/error-handler.ts` 的 participation 错误映射。 [REQ: FR-022 / FR-031 / D-13] [VERIFY: `bunx vitest run tests/integration/participations-http-boundary.test.ts tests/integration/participations-anti-enumeration.test.ts`]
  - 目标：统一错误码 / HTTP status。
  - 文件：`apps/server/api/src/plugins/error-handler.ts`。
  - 动作：映射 `CASE_NOT_FOUND` / `CURRENT_FAMILY_NOT_FOUND` / `CURRENT_FAMILY_AMBIGUOUS` / `PARTICIPATION_TARGET_INELIGIBLE` / `PARTICIPATION_ALREADY_EXISTS` / `INVITATION_NOT_AVAILABLE` / `PARTICIPATION_NOT_FOUND` / `PARTICIPATION_STATE_CONFLICT` / `IDEMPOTENCY_PAYLOAD_MISMATCH` / `VALIDATION_ERROR`；不泄露敏感字段。
  - 前置：T062。
  - 完成条件：错误映射测试 PASS。

- [ ] T064 生成 OpenAPI 产物并验证确定性 / operation 数 / typecheck。 [REQ: FR-026 / FR-027 / FR-028 / D-5] [VERIFY: `bun run openapi:generate`；`bun run openapi:check`；`bun run typecheck`；两次生成 hash 一致]
  - 目标：让 generated artifacts 与契约源一致。
  - 文件：`packages/generated/openapi.json`、`packages/generated/openapi.d.ts`（只由生成器写）。
  - 动作：生成；断言 6 个 participation operations；不手工修改 generated 文件。
  - 前置：T061—T063。
  - 完成条件：`openapi:check` PASS；两次生成 hash 一致；typecheck PASS。

---

# Phase 8 — Idempotency / Concurrency

> 复用 `idempotency_keys` + `runIdempotentCommand`；不新建第二套幂等。成功转换 ∈ {0,1}；expiry exactly-once。

- [ ] T065 [P] 新增 integration 测试：same key + same payload、same key + different payload 409、concurrent same key。 [REQ: FR-016 / D-9] [VERIFY: `bunx vitest run tests/integration/participations-idempotency.test.ts`]
  - 目标：冻结四命令幂等。
  - 文件：`tests/integration/participations-idempotency.test.ts`。
  - 动作：覆盖 4 个 command；同 key replay 不新增；different payload 409；concurrent same key 一个业务结果。
  - 前置：T061；T070 可先写测试。
  - 完成条件：测试先以实现不存在预期 FAIL。

- [ ] T066 新增 integration 测试：invite create token replay（F-01）与 snapshot redaction。 [REQ: FR-016 / D-9 / F-01] [VERIFY: `bunx vitest run tests/integration/participations-idempotency.test.ts`]
  - 目标：验证 same-key replay 返回同一 token。
  - 文件：同一 idempotency 测试文件。
  - 动作：same key → 同一 participationId + 同一 inviteToken；snapshot 不含 token；different key → 新 token。
  - 前置：T065；T038。
  - 完成条件：测试通过。

- [ ] T067 [P] 新增 integration 测试：double accept / double decline / double withdraw。 [REQ: FR-007 / FR-011 / FR-012 / FR-013 / D-10] [VERIFY: `bunx vitest run tests/integration/participations-accept-concurrency.test.ts tests/integration/participations-decline.test.ts tests/integration/participations-withdraw.test.ts`]
  - 目标：冻结重复命令收敛。
  - 文件：对应 integration 文件。
  - 动作：double accept 一个 active；double decline 一个 DECLINED，且 Case status / phase 不变；double withdraw 一个 WITHDRAWN；不复活。
  - 前置：T061；T032。
  - 完成条件：测试通过。

- [ ] T068 新增 integration 测试：accept vs decline / accept vs expiry / decline vs expiry；0 或 1 成功。 [REQ: FR-007 / FR-015 / FR-031 / D-10 / F-03 / F-04] [VERIFY: `bunx vitest run tests/integration/participations-accept-concurrency.test.ts tests/integration/participations-expiry.test.ts`]
  - 目标：冻结竞争赢家与 0 合法。
  - 文件：对应 integration 文件。
  - 动作：至多一个成功；失败方 409 / 404；expiry 物化 exactly-once；全部失败 → 0 合法。
  - 前置：T061；T032。
  - 完成条件：测试通过。

- [ ] T069 [P] 新增 DB 测试：concurrent invite create 同 `(case, person)` 只产生一个 live row。 [REQ: FR-029 / D-10] [VERIFY: `bunx vitest run tests/db/participants-live-uniqueness.test.ts`]
  - 目标：验证 partial unique index 并发兜底。
  - 文件：`tests/db/participants-live-uniqueness.test.ts`。
  - 动作：两个并发 create；一个成功，一个 409 `PARTICIPATION_ALREADY_EXISTS`；无重复 live。
  - 前置：T025；T061。
  - 完成条件：真实并发 DB 输出。

- [ ] T070 实现 `packages/domain/src/idempotency.ts` 的 4 个 command type + canonical payload / hash。 [REQ: FR-016 / D-9] [VERIFY: `bunx vitest run tests/integration/participations-idempotency.test.ts tests/domain/participation-contracts.test.ts`]
  - 目标：让 T065 通过；复用既有幂等。
  - 文件：`packages/domain/src/idempotency.ts`。
  - 动作：新增 command type；canonical payload 按 D-9；不新建第二套框架 / 表。
  - 前置：T065。
  - 完成条件：幂等测试 PASS。

- [ ] T071 实现 `apps/server/api/src/idempotency.ts` 的 participation command 编排 + invite create replay rehydration。 [REQ: FR-016 / D-9 / D-14 / F-01] [VERIFY: `bunx vitest run tests/integration/participations-idempotency.test.ts`]
  - 目标：让 T037 / T065 / T066 通过；snapshot redacted，replay 重新派生 token。
  - 文件：`apps/server/api/src/idempotency.ts`。
  - 动作：复用 `runIdempotentCommand`；包装 T061 create route（T031 preallocate / T038 token / T031 explicit-id insert / audit）；snapshot 保存 `participationId` + redacted metadata，不含 plaintext token；replay 由 `participationId` + secret 重新派生同一 token；不 INSERT 新 participation；其他 command replay 原 body。
  - 前置：T070；T038。
  - 完成条件：T065 / T066 PASS。

- [ ] T072 实现行锁 / 条件 UPDATE / 23505 → 409 映射。 [REQ: FR-007 / FR-015 / FR-029 / FR-031 / D-10] [VERIFY: `bunx vitest run tests/integration/participations-accept-concurrency.test.ts tests/db/participants-live-uniqueness.test.ts`]
  - 目标：让 T067—T069 通过；无部分写入。
  - 文件：`packages/domain/src/participants.ts`、route / error mapping。
  - 动作：`SELECT ... FOR UPDATE`；条件 UPDATE；expiry 0/1；partial unique 23505 → `PARTICIPATION_ALREADY_EXISTS`。
  - 前置：T071。
  - 完成条件：并发测试 PASS。

- [ ] T073 验证 F-03 / F-04 / F-06 证据并记录。 [REQ: FR-007 / FR-015 / D-10 / D-14 / F-03 / F-04 / F-06] [VERIFY: `bunx vitest run tests/integration/participations-accept-concurrency.test.ts tests/integration/participations-expiry.test.ts`]
  - 目标：确认 expiry exactly-once、0/1 成功、never-accessed derived。
  - 文件：证据记录；不修改设计。
  - 动作：汇总真实输出；若 GET 能重复写 audit 或所有失败被要求 1 个成功 → FAIL。
  - 前置：T072。
  - 完成条件：证据 PASS。

---

# Phase 9 — Audit / Anti-enumeration

> 只写 `business_audit_events`；不写 `case_events`；错误对外不可枚举。

- [ ] T074 [P] 新增 integration 测试：5 类 audit 事件、actor / resource、exactly-once、无 token / openid / PII。 [REQ: FR-023 / D-12] [VERIFY: `bunx vitest run tests/integration/participations-audit.test.ts`]
  - 目标：冻结审计行为。
  - 文件：`tests/integration/participations-audit.test.ts`。
  - 动作：invite created / accepted / declined / expired / withdrawn；`resource_type=CASE_PARTICIPANT`；replay 不追加；expiry exactly-once；无 token / openid。
  - 前置：T061；T072。
  - 完成条件：测试先以实现不存在预期 FAIL。

- [ ] T075 [P] 新增 integration 测试：create invite 三类反枚举（不存在 / 跨 Family / 非 manager）统一。 [REQ: FR-022 / D-13] [VERIFY: `bunx vitest run tests/integration/participations-anti-enumeration.test.ts`]
  - 目标：冻结 create invite 对外一致性。
  - 文件：`tests/integration/participations-anti-enumeration.test.ts`。
  - 动作：三种情形统一 404 `CASE_NOT_FOUND`；响应逐字节一致；无 Case / Family / Person 字段。
  - 前置：T061；T063。
  - 完成条件：测试先以实现不存在预期 FAIL。

- [ ] T076 [P] 新增 integration 测试：invite lookup 无效 / 过期 / 终止统一 404；200 无敏感字段。 [REQ: FR-006 / FR-022 / D-13] [VERIFY: `bunx vitest run tests/integration/participations-invite-lookup.test.ts`]
  - 目标：冻结 invite lookup 反枚举。
  - 文件：`tests/integration/participations-invite-lookup.test.ts`。
  - 动作：无效 / 过期 / 拒绝 / 退出统一 `INVITATION_NOT_AVAILABLE`；200 只含安全字段；wrong token 不成为 Person / Case oracle。
  - 前置：T061；T039。
  - 完成条件：测试通过。

- [ ] T077 新增 integration 测试：accept / decline / withdraw / GET unauthorized 统一 404；409 只在授权 target 后出现。 [REQ: FR-006 / FR-022 / FR-031 / D-13] [VERIFY: `bunx vitest run tests/integration/participations-anti-enumeration.test.ts tests/integration/participations-http-boundary.test.ts`]
  - 目标：冻结 404 / 409 分界。
  - 文件：对应 integration 文件。
  - 动作：非 target / 非 manager / 不存在 → `PARTICIPATION_NOT_FOUND`；授权 target 非法状态 → `PARTICIPATION_STATE_CONFLICT` + 仅 currentState；无敏感字段。
  - 前置：T061；T063。
  - 完成条件：测试通过。

- [ ] T078 实现 audit 写入 + metadata（`business_audit_events` only）。 [REQ: FR-023 / D-12] [VERIFY: `bunx vitest run tests/integration/participations-audit.test.ts`；`rg -n "participation_audit_events|CASE_VIEWED|CASE_LISTED" apps packages db`]
  - 目标：让 T074 通过。
  - 文件：`packages/domain/src/participants.ts`、路由 / service。
  - 动作：5 类事件；metadata 只放 id / state / expiresAt / fromState / toState；不写 token / openid / PII；不写 `case_events`。
  - 前置：T074。
  - 完成条件：audit 测试 PASS；无第二张 audit 表。

- [ ] T079 实现 anti-enumeration 错误映射 / 无敏感字段。 [REQ: FR-006 / FR-022 / FR-031 / D-13] [VERIFY: `bunx vitest run tests/integration/participations-anti-enumeration.test.ts tests/integration/participations-http-boundary.test.ts`]
  - 目标：让 T075—T077 通过。
  - 文件：`apps/server/api/src/plugins/error-handler.ts`、`apps/server/api/src/routes/participations.ts`。
  - 动作：统一错误码 / status；响应不带 target / Family / Case / guardian / age / consent / compliance；409 只 currentState。
  - 前置：T078。
  - 完成条件：anti-enumeration 测试 PASS。

- [ ] T080 验证无 `case_events` / 第二套 audit；记录 F-06 never-accessed expiry 证据。 [REQ: FR-023 / D-12 / F-06] [VERIFY: `bunx vitest run tests/integration/participations-audit.test.ts tests/integration/participations-expiry.test.ts`；`rg -n "case_events|participation_audit_events" packages/domain/src/participants.ts apps/server/api/src`]
  - 目标：确认审计边界与 never-accessed 语义。
  - 文件：证据记录；不修改设计。
  - 动作：断言不写 `case_events`；无第二套 audit；never-accessed 不自动写 `PARTICIPATION_EXPIRED`；FR-019 Evidence boundary 由 T081 单独验证，本 Task 不以其为 `[REQ]`。
  - 前置：T079。
  - 完成条件：证据 PASS。

---

# Phase 10 — Integration / Verification

> 只运行验证，不新增实现。所有测试真实 PostgreSQL 18，不 mock DB。测试运行共享同一 `DATABASE_URL`，T081—T092 串行执行，不标 `[P]`。先创建全部 verification-only tests，再运行 aggregate / full-suite。

- [ ] T081 新增 DB 测试：accept / decline / withdraw 不产生 Evidence side effect（条件验证）。 [REQ: FR-019 / Acceptance 13 / SC-004 / D-12] [VERIFY: `bunx vitest run tests/db/participants-evidence-boundary.test.ts`]
  - 目标：证明三种参与动作不产生 Evidence side effect；Evidence tables absent 不是 failure。
  - 文件：`tests/db/participants-evidence-boundary.test.ts`。
  - 动作：先 `SELECT to_regclass('public.assertions')` / `to_regclass('public.observations')`；present → baseline count → accept / decline / withdraw → assertions delta = 0 / observations delta = 0；absent → 断言 remain absent + no Evidence writer / repository / route / migration；不得创建 Evidence tables、mock Evidence schema 或要求 Slice 3；不得只检查 `case_events` / audit。
  - 前置：T061 / T072（核心实现已完成）；verification-only。
  - 完成条件：absent / present 两分支均 PASS；Slice 4 产生 Evidence write → FAIL。

- [ ] T082 新增 integration 测试：participation / audit / idempotency 任一步失败时整事务回滚。 [REQ: FR-031 / D-9 / D-12] [VERIFY: `bunx vitest run tests/integration/participations-rollback.test.ts`]
  - 目标：证明没有 partial commit / 假成功。
  - 文件：`tests/integration/participations-rollback.test.ts`。
  - 动作：使用真实 transaction helper；在同一个 transaction 内先执行真实 participation state change（PENDING→ACTIVE），再以 `business_audit_events.event_type='ROLLBACK_TEST_INVALID_EVENT'` 触发既有 event_type CHECK；另以 `idempotency_keys.command_type='ROLLBACK_TEST_INVALID_COMMAND'` 触发既有 command_type CHECK；失败点均在 participation mutation 之后、commit 之前；不使用 production test-only hook；断言 participation state / audit rows / idempotency rows 全部回滚。
  - 前置：T072；verification-only。
  - 完成条件：任一失败点均无 partial rows；无法用 CHECK 触发则报告 BLOCKED，不得改用 production hook。

- [ ] T083 新增 DB 测试：Slice 4 结构边界，无越界 domain / Evidence / Intervention / AI / notification / generic response。 [REQ: FR-025 / SC-015 / D-17] [VERIFY: `bunx vitest run tests/db/participants-structure.test.ts`]
  - 目标：证明 `case_participants` 仍是唯一 participation resource，且无 Assessment / Problem Formulation / Scene / Evidence writer / Goal / Intervention / Plan domain / Task domain / AI / notification delivery / generic participant response。
  - 文件：`tests/db/participants-structure.test.ts`。
  - 动作：`information_schema` / `pg_constraint` / route enumeration；断言 `to_regclass('public.intervention_instances') IS NULL`（或实际 schema namespace 等价断言）；断言无越界 table / type / route / generic response；不实现 Intervention。
  - 前置：T025 / T056；verification-only。
  - 完成条件：结构测试 PASS；发现越界对象 → FAIL。

- [ ] T084 新增 integration 测试：cross-family named verification（422 vs 404/403 分流）。 [REQ: SC-001 / FR-004 / FR-022 / D-5 / D-6 / D-11 / D-13] [VERIFY: `bunx vitest run tests/integration/participations-cross-family.test.ts`]
  - 目标：真实跨 Family 资源访问被拒；client body `familyId` spoof 在 strict schema 前 422。
  - 文件：`tests/integration/participations-cross-family.test.ts`。
  - 动作：A) wrong Family / target Person 属于另一 Family / Case 属于另一 Family / cross-family resource access → 404 / 403 按冻结 contract、zero write、no existence leak；B) client body `familyId` spoof → 422 VALIDATION_ERROR、zero business writes、在业务授权逻辑之前拒绝；不得放宽 strict schema。
  - 前置：T045 / T061；verification-only。
  - 完成条件：两类语义分别 PASS。

- [ ] T085 运行 domain / unit 测试。 [REQ: FR-001—FR-031 / D-15] [VERIFY: `bunx vitest run tests/domain`]
  - 目标：确认纯规则 / 状态机 / token / authorize。
  - 文件：`tests/domain/**`。
  - 动作：执行；检查 0 failed / 0 skipped；不跳过失败。
  - 前置：Phase 1—9 实现完成。
  - 完成条件：domain 测试 PASS。

- [ ] T086 运行 DB / RLS / migration 测试（必须包含 T081 / T083）。 [REQ: FR-021 / FR-029 / D-3 / D-11] [VERIFY: `bunx vitest run tests/db`；`bun run db:evidence`]
  - 目标：确认 schema / RLS / role / migration replay。
  - 文件：`tests/db/**`。
  - 动作：执行；检查 `relrowsecurity` / `relforcerowsecurity` / runtime role / safe view。
  - 前置：T025 / T081 / T083。
  - 完成条件：DB 测试 PASS；db:evidence PASS；aggregate 覆盖 T081/T083。

- [ ] T087 运行 integration / API 测试（必须包含 T082 / T084）。 [REQ: FR-005—FR-027 / D-5 / D-7] [VERIFY: `bunx vitest run tests/integration`]
  - 目标：确认六 route / identity / compliance / scope。
  - 文件：`tests/integration/**`。
  - 动作：执行；检查 0 failed / 0 skipped。
  - 前置：T061—T064 / T082 / T084。
  - 完成条件：integration PASS；aggregate 覆盖 T082/T084。

- [ ] T088 运行 idempotency / concurrency 测试。 [REQ: FR-016 / FR-031 / D-9 / D-10] [VERIFY: `bunx vitest run tests/integration/participations-idempotency.test.ts tests/integration/participations-accept-concurrency.test.ts tests/db/participants-live-uniqueness.test.ts`]
  - 目标：确认 replay / mismatch / 0-or-1 / expiry。
  - 文件：对应测试文件。
  - 动作：执行；检查真实并发输出。
  - 前置：T071 / T072。
  - 完成条件：测试 PASS。

- [ ] T089 运行 negative security / anti-enumeration 测试。 [REQ: FR-006 / FR-022 / D-13] [VERIFY: `bunx vitest run tests/integration/participations-anti-enumeration.test.ts tests/integration/participations-http-boundary.test.ts tests/integration/participations-identity-seam.test.ts`]
  - 目标：确认无敏感字段 / 无 oracle / 无 P2。
  - 文件：对应测试文件。
  - 动作：执行；检查真实 HTTP status / body。
  - 前置：T079。
  - 完成条件：测试 PASS。

- [ ] T090 运行 OpenAPI 生成 / check / typecheck / static guard。 [REQ: FR-026 / FR-027 / D-5] [VERIFY: `bun run openapi:generate`；`bun run openapi:check`；`bun run typecheck`；`bun run guard:static`]
  - 目标：确认契约 / 类型 / 静态边界。
  - 文件：generated artifacts（只由生成器写）。
  - 动作：执行；断言 6 个 participation operations；两次生成 hash 一致。
  - 前置：T064。
  - 完成条件：全部 PASS。

- [ ] T091 运行全量测试（必须包含 T081—T090 全部新增测试与 aggregate）。 [REQ: FR-001—FR-031 / D-15] [VERIFY: `bunx vitest run`]
  - 目标：确认无回归 / 无 skip。
  - 文件：`tests/**`。
  - 动作：执行；检查 0 failed / 0 skipped；不得削弱断言。
  - 前置：T081—T090。
  - 完成条件：全量 PASS；aggregate 覆盖所有最终测试。

- [ ] T092 运行 `quickstart.md` §1—§7 并记录 Case C / 005 runtime 状态。 [REQ: FR-030 / D-17 / Acceptance 19] [VERIFY: 按 `quickstart.md` 执行；记录真实输出]
  - 目标：确认验证路径与依赖状态。
  - 文件：`quickstart.md`（只读）、`tests/evidence/**`（Implement 证据）。
  - 动作：执行 quickstart；若 005 runtime 不可用 → `BLOCKED — 005 IDENTITY RUNTIME NOT AVAILABLE`；不得声称 Case C E2E PASS。
  - 前置：T091。
  - 完成条件：quickstart 结果真实记录；PASS 或 BLOCKED 明确。

---

# Phase 11 — Evidence / Implement Closeout

> 只做 Implement 自检证据；不进入独立 Converge，不宣布 merge-ready。

- [ ] T093 记录 `IMPLEMENT_BASE_SHA` 并分类 diff。 [REQ: FR-030 / D-17] [VERIFY: `git diff --name-only "$IMPLEMENT_BASE_SHA"...HEAD`]
  - 目标：区分预期实现 / 生成物 / 测试证据 / unexpected。
  - 文件：evidence log（`tests/evidence/**` 或仓库现有 evidence 位置）。
  - 动作：记录 base SHA；列出 changed files；unexpected 必须为 0。
  - 前置：T091（full suite）。
  - 完成条件：分类清晰；unexpected = 0。

- [ ] T094 验证冻结上游 diff = 0。 [REQ: FR-030 / D-17] [VERIFY: `git diff --name-only "$IMPLEMENT_BASE_SHA"...HEAD -- Docs specs/004-case-participant-core/spec.md specs/004-case-participant-core/plan.md specs/004-case-participant-core/research.md specs/004-case-participant-core/data-model.md specs/004-case-participant-core/quickstart.md specs/004-case-participant-core/contracts specs/004-case-participant-core/checklists`]
  - 目标：确认实现没有改需求 / 设计。
  - 文件：只读 diff。
  - 动作：断言上述路径无语义修改；`tasks.md` 只允许 checkbox / evidence。
  - 前置：T093。
  - 完成条件：冻结输入 diff = 0。

- [ ] T095 验证 `tasks.md` 只更新 checkbox / completion evidence。 [REQ: FR-030 / D-17] [VERIFY: `git diff "$IMPLEMENT_BASE_SHA"...HEAD -- specs/004-case-participant-core/tasks.md`]
  - 目标：防止借 Tasks 偷改设计。
  - 文件：`specs/004-case-participant-core/tasks.md`。
  - 动作：只允许 `[ ]` → `[x]`、completion / evidence 引用；不得改需求 / Task graph。
  - 前置：T094。
  - 完成条件：diff 仅 checkbox / evidence。

- [ ] T096 生成 implementation evidence 汇总（只做自检，不宣称独立 Converge / merge-ready）。 [REQ: FR-030 / D-15 / D-17] [VERIFY: 检查 evidence 文件存在；运行 governance]
  - 目标：整理 requirement coverage / scope / contracts / tests / RLS / concurrency / idempotency / remaining gaps。
  - 文件：`tests/evidence/**` 或仓库现有 evidence 路径。
  - 动作：记录真实命令输出；不写“已独立 Converge”；不写“可 merge”。
  - 前置：T091（full suite）/ T092（quickstart）。
  - 完成条件：evidence 完整；无虚假 PASS。

- [ ] T097 Implement 最终 gate：重新核实依赖；输出 `IMPLEMENT COMPLETE — READY FOR INDEPENDENT CONVERGE` 或 `BLOCKED`。 [REQ: FR-030 / Acceptance 19 / D-17] [VERIFY: 重跑 T001—T006；`bunx vitest run`；`bun run openapi:check`；`node .specify/scripts/validate-governance.mjs`]
  - 目标：防止 Tasks / Tests 通过掩盖 dependency 仍未满足。
  - 文件：只读 / evidence。
  - 动作：若 Slice 2 未 merge 或 005 runtime 不可用 → `BLOCKED`；否则输出 READY FOR INDEPENDENT CONVERGE；不得自行 merge。
  - 前置：T093—T096。
  - 完成条件：明确 gate 状态；不得打开 Gate 除非上游真实满足。

---

## 2. FR Traceability

| FR | Tasks |
|---|---|
| FR-001 | T015 / T021 / T022 / T031 |
| FR-002 | T016 / T017 / T021 / T022 / T023 |
| FR-003 | T042 / T043 / T044 / T058 / T061 / T075 |
| FR-004 | T017 / T023 / T053 / T058 |
| FR-005 | T049 / T050 / T052 / T060 / T061 |
| FR-006 | T035 / T036 / T039 / T040 / T059 / T076 |
| FR-007 | T027 / T032 / T067 / T068 |
| FR-008 | T042 / T043 / T047 / T060 / T075 |
| FR-009 | T049 / T050 / T052 |
| FR-010 | T051 / T053 |
| FR-011 | T027 / T032 / T051 / T067 |
| FR-012 | T027 / T060 / T067 / T074 / T078 |
| FR-013 | T027 / T032 / T051 / T067 |
| FR-014 | T027 / T033 / T074 / T080 |
| FR-015 | T026 / T027 / T029 / T032 / T068 / T073 |
| FR-016 | T031 / T037 / T038 / T058 / T065 / T066 / T070 / T071 |
| FR-017 | T047 / T060 |
| FR-018 | T047 |
| FR-019 | T019 / T030 / T081 |
| FR-020 | T042 / T043 / T044 / T047 / T048 |
| FR-021 | T019 / T020 / T046 / T045 |
| FR-022 | T075 / T076 / T077 / T079 |
| FR-023 | T074 / T078 / T080 |
| FR-024 | T049 / T050 / T052 / T053 |
| FR-025 | T047 / T083 |
| FR-026 | T056 / T057 / T058 / T059 / T060 / T061 / T062 / T064 |
| FR-027 | T056 / T060 / T061 / T064 |
| FR-028 | T056 / T061 / T064 |
| FR-029 | T018 / T023 / T069 |
| FR-030 | T001 / T002 / T003 / T004 / T005 / T006 / T092 / T097 |
| FR-031 | T032 / T070 / T071 / T072 / T078 / T079 / T082 |

## 3. Acceptance Traceability

| Acceptance | Tasks |
|---|---|
| 1 Happy path | T049 / T050 / T058 / T060 / T061 |
| 2 Decline | T027 / T051 / T060 / T067 |
| 3 Withdraw | T027 / T032 / T051 / T067 |
| 4 Duplicate / concurrent accept | T067 / T068 |
| 5 Wrong user token | T035 / T036 / T039 / T059 / T076 |
| 6 Cross Family | T017 / T046 / T075 / T084 |
| 7 UNDER_14 illegal path | T051 / T053 |
| 8 Non-manager cannot invite | T042 / T043 / T058 / T075 |
| 9 Invite create anti-enumeration | T075 |
| 10 Unauthorized token lookup | T040 / T059 / T076 |
| 11 Terminal invite cannot reactivate | T027 / T068 |
| 12 No Case-wide access on accept | T047 / T060 |
| 13 No Evidence side effect | T019 / T030 / T081 |
| 14 No duplicate Person / binding | T049 / T050 / T052 / T053 |
| 15 Auditability | T074 / T078 |
| 16 Idempotent command outcome | T065 / T066 / T070 / T071 |
| 17 Route surface enumeration | T056 / T061 / T064 |
| 18 RLS / cross-family hard block | T019 / T046 / T084 |
| 19 Implement gate | T001—T006 / T092 / T097 |

## 4. SC Traceability

| SC | Tasks |
|---|---|
| SC-001 | T017 / T046 / T075 / T084 |
| SC-002 | T067 / T068 |
| SC-003 | T047 |
| SC-004 | T019 / T030 / T081 |
| SC-005 | T027 / T068 |
| SC-006 | T040 / T059 / T076 |
| SC-007 | T056 / T061 / T064 |
| SC-008 | T049 / T050 / T052 / T053 |
| SC-009 | T027 / T051 / T060 / T067 |
| SC-010 | T027 / T032 / T051 / T067 |
| SC-011 | T075 |
| SC-012 | T051 / T053 |
| SC-013 | T074 / T078 |
| SC-014 | T065 / T066 / T068 / T070 / T071 |
| SC-015 | T015—T025 / T056—T064 / T083 |

## 5. Plan Decision Traceability

| Decision | Tasks |
|---|---|
| D-1 module ownership | T007—T014 / T035—T041 / T056—T064 |
| D-2 data model | T015—T025 / T030—T034 |
| D-3 migration | T021—T025 / T093 |
| D-4 state model | T026—T034 |
| D-5 API | T056—T064 |
| D-6 authorization | T042—T048 / T060 |
| D-7 identity prerequisite | T049—T055 |
| D-8 Compliance / Consent | T049—T055 |
| D-9 idempotency | T031 / T037 / T038 / T058 / T065—T073 |
| D-10 concurrency | T029 / T067 / T068 / T069 / T072 |
| D-11 RLS | T019 / T020 / T024 / T039 / T040 / T045 / T046 |
| D-12 audit | T074—T080 |
| D-13 anti-enumeration / failure | T075—T077 / T079 |
| D-14 TTL / expiry | T009 / T010 / T026 / T029 / T031 / T032 / T037 / T038 / T039 / T058 / T059 / T073 |
| D-15 testing | T081—T092 |
| D-16 observability | T078 / T096 |
| D-17 dependencies / Implement gate | T001—T006 / T092 / T097 |

## 6. Checklist Findings Traceability

| Finding | Tasks |
|---|---|
| F-01 invite create token idempotency replay | T031 / T035—T041 / T058 / T066 / T071 |
| F-02 token RLS pending + safe view | T020 / T024 / T039 / T040 / T046 / T059 |
| F-03 GET expiry exactly-once | T029 / T032 / T043 / T045 / T046 / T060 / T068 / T073 |
| F-04 concurrency 0/1 | T028 / T068 / T073 |
| F-05 MINOR_14_17 consent taxonomy | T051 / T053 / T055 |
| F-06 never-accessed expiry audit | T029 / T032 / T073 / T080 |

---

## 7. Task Counts

```text
Tasks total: 97
[P] tasks: 37
Phases: 12（Phase 0 — Phase 11）
```

**Phase 名称**：

```text
Phase 0  — IMPLEMENT GATE
Phase 1  — Contract / Test Scaffolding
Phase 2  — Database Foundation
Phase 3  — Domain Lifecycle
Phase 4  — Invite Token / Replay
Phase 5  — Authorization / RLS
Phase 6  — Compliance / Identity Seam
Phase 7  — Public API
Phase 8  — Idempotency / Concurrency
Phase 9  — Audit / Anti-enumeration
Phase 10 — Integration / Verification
Phase 11 — Evidence / Implement Closeout
```

---

## 8. Implement Gate Status

```text
Slice 1:
MERGED + independent converge evidence required（Phase 0 T001 真实核验）

Slice 2:
IMPLEMENTATION IN PROGRESS — NOT MERGED
（Phase 0 T002 必须 STOP）

005 contract:
MERGED

005 runtime:
REQUIRED FOR CASE C — NOT IMPLEMENTED
（Phase 0 T004 必须 STOP）
```

```text
IMPLEMENT GATE = BLOCKED
```

**Tasks FINAL PASS 不打开 Implement Gate。** Phase 0 失败时 `changed files = 0`；不得先实现 Case B、migration、tests 或 scaffold。

---

## 9. Tasks Validation

本阶段实际执行：

```bash
node .specify/scripts/validate-governance.mjs
node .specify/scripts/tests/run-governance-tests.mjs
git diff --name-only e8fdc4b5c6baca3131b3bd583f1890e89afbfc9c..HEAD
git status --porcelain=v1
```

期望 / 实际：

| 检查 | 结果 |
|---|---|
| Spec governance | PASS |
| Governance self-test | 15 / 15 PASS |
| `tasks.md` task lines | 每条含 `[REQ:...]` 与 `[VERIFY:...]` |
| Tasks total / `[P]` / IDs | 97 / 37 / T001—T097 连续，无重复无跳号 |
| C-01 / H-01 / H-02 / L-02 / L-05 task sync | PASS |
| F1 / F2 Tasks sync | PASS |
| F3 / F4 / F5 / F6 / F7 / F8 | RESOLVED |
| future-test VERIFY references | 0 |
| aggregate runs include all final tests | PASS |
| Changes vs Targeted Checklist head（e8fdc4b） | 仅 `specs/004-case-participant-core/tasks.md` |
| `spec.md` / `plan.md` / `research.md` / `data-model.md` / `quickstart.md` / `contracts/**` / `checklists/**` | 0 diff |
| `Docs/**` | 0 diff |
| `apps/**` / `packages/**` / `db/**` / `tests/**` | 0 diff |
| Forbidden placeholder markers | 0 |
| working tree | clean（commit 后） |

---

## 10. Final Status

```text
SLICE 4 TASKS REMEDIATION ROUND 2 COMPLETE
READY FOR FINAL ANALYZE ROUND 3
```

**边界**：本轮只修改 `tasks.md`；未执行 Analyze / Implement / Converge，未修改实现、migration、tests、`spec.md`、`Docs/**`。

下一阶段：**Final Analyze Round 3**；继续由同一个 AI B 执行，但必须作为独立只读 Analyze 回合。