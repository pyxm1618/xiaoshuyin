# Tasks: Identity Binding Runtime（006-identity-binding-runtime）

**Feature**: `specs/006-identity-binding-runtime/spec.md`
**Plan**: `plan.md`
**Created**: 2026-11-07
**Stage**: Tasks only。本文件不执行 Implement、不运行测试、不写代码、不写 migration。

> **执行规则**
> 1. `T001—T006` 是 Dependency Gate，必须先执行；`T001` FAIL 曾是本 Slice（业务 Slice 5，repo feature 006）**core implementation 的唯一 hard blocker**，此时整个 Implement **STOP**，`changed files = 0`。`T002` 只核验 Slice 4 **contract** 可用性；Slice 4 **runtime** 缺失不阻塞 Phase 1–14，只阻塞 Phase 15 `T121–T124`。
> 2. 每个实现任务必须在对应测试任务之后执行；测试任务先写 RED 断言，再实现，再用 `[VERIFY]` 命令证明。测试任务的 `[VERIFY]` 可以是预期 RED；实现任务的 `[VERIFY]` 必须是 PASS。
> 3. `[VERIFY]` 只能引用当前 Task 之前已创建的文件 / helper / route；不得引用未来 Phase 的产物。
> 4. `[P]` 只用于纯 domain 单元测试文件：不同文件、只依赖已冻结类型、不共享 DB / route / helper。DB、integration、route、migration、generated contract 任务一律不标 `[P]`。
> 5. `BLOCKED BY SLICE 4 RUNTIME` 只适用于 Phase 15 `T121–T124`（真实 production adapter / 真实 Slice 4 integration / full Case C E2E）。这些任务不得删除、不得 mock 后宣称 PASS、不得修改 Slice 4；只能报告 BLOCKED。该标签 **不得** 用于冻结 Phase 1–14。
> 6. Migration 编号在 Implement 时读取最新 merged main 后分配；本文件不硬编码 `002`。
> 7. 本任务图不修改 `Docs/**`、`specs/001~005/**`、Slice 4 文件、普通登录语义、Case / Evidence / Participant。
> 8. Slice 1（Final Independent Audit II PASS → PR #13 merge main → post-merge CI PASS → CLOSED）已解除 B1；当前状态为 `READY FOR CORE IMPLEMENTATION`，Phase 1–14 可执行，`T121–T124` 继续 `BLOCKED BY SLICE 4 RUNTIME`。本 Slice core 不等待 Slice 4 runtime；Slice 4 implementation 依赖的是本 Slice **core runtime available**，不是本 Slice full closeout。

---

## Ultimate Audit Targeted Plan / Contract Remediation Overlay（2026-11-09）

Ultimate Final Independent Re-audit at f96bc945 判定 H-01 / H-02 / M-01—M-06 未关闭。本文件不再保留“94 checked / 26 remediation-open”作为当前事实；所有受新合同实质影响的 task 必须重新 unchecked，开发必须先 RED → minimal remediation → targeted GREEN → aggregate GREEN。

H-01 authoritative pairing 已从 S0/S1 delta 改为 server-generated candidate-presented one-time pairing challenge；原 S0/S1 / exact-one-delta acceptance 全部失效。HTTP surface仍为6条，但 confirmer decision由 :attemptId path 改为 /pairing-decision，candidate AFFIRM response增加 pairingChallenge。

当前重新打开集合：
T013
T024 T025 T027 T028 T029 T030 T031 T032 T039
T049 T050
T059 T060 T061 T062
T065 T066 T067 T068 T069 T070 T071 T072
T073 T074
T079 T080 T081 T082
T085 T086
T091 T092 T093 T094 T095 T096 T097
T101 T102 T103 T104 T105 T106 T107 T108
T109 T110 T111 T112
T113 T114 T115 T116 T117 T118 T119 T120

特别复核：
- T037：保持 checked。它只证明 confirmation records 的 attempt_id 隔离；新 pairing 不推翻该 DB invariant。
- T055：保持 checked。expiry-before-create 的 existing regression 与 H-01/H-02/M-01—M-06 独立，proof 仍成立。
- T013 / T060 / T091 / T103 / T112：proof 已被新 finding 或新 API shape 实质影响，必须 unchecked。

T121–T124继续 BLOCKED BY SLICE 4 RUNTIME。本轮 Plan AI 不实现任何上述 task，不写 production / migration / tests / scripts。

---

## Phase 0 — Dependency Gate（阻塞门）

- [x] T001 — 核验 Slice 1 真实 `authorize()` 已 merge main 且存在最终 INDEPENDENT CONVERGE PASS。检查 `origin/main` 的 `packages/authorization/src/authorize.ts` 不再对 `MANAGER_ACTIONS` / `MINOR_PROCESSING` 返回占位 ALLOW；检查 `tests/evidence/converge.md` 有最终 PASS 记录。**FAIL → STOP，changed files = 0。** **Files**: 只读：`packages/authorization/src/authorize.ts`、`tests/evidence/converge.md`、`git log origin/main` **Depends**: — **Acceptance**: 记录真实命令输出；两项任一不满足 → `IMPLEMENT BLOCKED — ONLY BY SLICE 1 HARD DEPENDENCY` [REQ:FR-026 / plan D-22.1 H1 / CHK149] [VERIFY:git show origin/main:packages/authorization/src/authorize.ts && tail -40 tests/evidence/converge.md]
- [x] T002 — 核验 Slice 4 participant contract 在最终 remote head；记录 `participant-lifecycle-and-identity-seam.md` 的 invitation valid / terminal-unusable、P1、target Family 语义。**不得 merge Slice 4，不得写 Slice 4 文件。** **Files**: 只读：`origin/feat/004-case-participant-core:specs/004-case-participant-core/contracts/participant-lifecycle-and-identity-seam.md` **Depends**: — **Acceptance**: 记录 contract head SHA 与语义；contract-only 可用 [REQ:FR-026 / plan D-16.1 / CHK143] [VERIFY:git show origin/feat/004-case-participant-core:specs/004-case-participant-core/contracts/participant-lifecycle-and-identity-seam.md]
- [x] T003 — 核验 005 contract 在 `origin/main`，且 `specs/005-invited-identity-binding-contract/spec.md` 未被修改。 **Files**: 只读：`git rev-parse origin/main`、`git diff origin/main -- specs/005-invited-identity-binding-contract` **Depends**: — **Acceptance**: 005 diff = 0；记录 main SHA [REQ:plan Upstream / CHK003] [VERIFY:git rev-parse origin/main && git diff origin/main -- specs/005-invited-identity-binding-contract]
- [x] T004 — 核验 `specs/002-case-core`、`specs/004-case-participant-core` 是否在 main；记录真实依赖状态。不得把 Slice 2 / 3 变成依赖。 **Files**: 只读：`git ls-tree origin/main specs`、`git rev-parse origin/feat/002-case-core` **Depends**: — **Acceptance**: 记录 002 / 004 是否 merge；006 不读 Case [REQ:FR-026 / plan D-22.2 / CHK151] [VERIFY:git ls-tree origin/main specs && git rev-parse origin/feat/002-case-core]
- [x] T005 — 运行普通登录回归基线：`bun run vitest run tests/integration/auth.test.ts` + `tests/integration/openapi.test.ts`。记录 exact output。 **Files**: 只读运行 **Depends**: T003 **Acceptance**: 全 PASS；若失败 → STOP，不得开始 006 [REQ:FR-001 / SC-013 / CHK179] [VERIFY:bun run vitest run tests/integration/auth.test.ts tests/integration/openapi.test.ts]
- [x] T006 — 记录 `IMPLEMENT_BASE_SHA`（当时 merged main + 006 feature head）与 migration 下一个可用编号；确认 working tree clean。 **Files**: 只读 **Depends**: T001—T005 **Acceptance**: 输出 base SHA / next migration number / clean [REQ:plan D-18.1 / CHK165] [VERIFY:git rev-parse HEAD && git status --short]

**Gate 结论规则**

```text
T001 FAIL → IMPLEMENT BLOCKED — ONLY BY SLICE 1 HARD DEPENDENCY
T002 contract unavailable → IMPLEMENT BLOCKED — SLICE 4 CONTRACT UNAVAILABLE
T005 regression FAIL → IMPLEMENT BLOCKED — ORDINARY LOGIN REGRESSION

T001 / T002 / T005 PASS，但 Slice 4 runtime 仍 unavailable
→ READY FOR CORE IMPLEMENTATION（Phase 1–14 可执行）
→ T121–T124 继续 BLOCKED BY SLICE 4 RUNTIME

T001 / T002 / T005 PASS，且 Slice 4 runtime available
→ Phase 1–14 + Phase 15 T121–T124 全部可执行
→ 本 Slice（业务 Slice 5，repo feature 006）Implement complete → 审计二
```

> 当前事实（2026-11-07 closeout）：T001 预期 PASS —— Slice 1 已 Final Independent Audit II PASS → PR #13 merge main → post-merge CI PASS → CLOSED；`origin/main` = `f4ef60265e1bc4aec7a458ccf924af85eef7debe`，`packages/authorization/src/authorize.ts` 的 `MINOR_PROCESSING` 已是真实分支，`tests/evidence/converge.md` 归档 36 PASS / 0 FAIL。因此当前状态为 `READY FOR CORE IMPLEMENTATION`；Slice 4 runtime 缺失只影响 `T121–T124`，不冻结 Phase 1–14。T001 仍须按 `[VERIFY]` 命令真实重跑，不得以本记录替代证据。
>
> **循环依赖排除**：`本 Slice core ← Slice 1`；`Slice 4 implementation ← 本 Slice core runtime`；`本 Slice T121–T124 ← Slice 4 runtime`。三段是分阶段交接，不是互相等待的环。

---

## Phase 1 — Schema Tests & Additive Migration

- [x] T007 — 写 schema RED 测试：5 张表、5 个 enum、attempt 三态、terminal_reason CHECK、partial unique live index、无永久三元组唯一、pending context CHECK、confirmation CHECK、audit append-only、audit `event_type` 闭集含 `BINDING_OPERATION_RETRYABLE`、`persons_binding_candidate_account_read` policy。 **Files**: `tests/db/identity-binding-schema.test.ts` **Depends**: T006 **Acceptance**: 预期 RED；文件覆盖 plan D-2 / D-3 / D-4 / D-5 / D-13.3 / D-15 全部结构断言 [REQ:FR-012 / AS-19 / CHK037—CHK050] [VERIFY:bun run vitest run tests/db/identity-binding-schema.test.ts]
- [x] T008 — 写 additive migration：5 个 enum + `binding_pending_contexts` + `binding_attempts`。不改 `001_initial_schema.sql`。 **Files**: `db/migrations/00X_identity_binding_runtime.sql` **Depends**: T006 **Acceptance**: migration 文件 review；enum / 两张表定义与 plan D-2 / D-3 一致 [REQ:FR-012 / plan D-18.1 / CHK163—CHK166] [VERIFY:node scripts/db-migrate.mjs]
- [x] T009 — 同 migration 追加 `binding_confirmations` + `binding_operation_keys` + `identity_binding_audit_events`。 **Files**: 同上 **Depends**: T008 **Acceptance**: 表结构、CHECK、UNIQUE 与 plan D-4 / D-5 / D-15 一致 [REQ:FR-012 / FR-022 / FR-023] [VERIFY:node scripts/db-migrate.mjs]
- [x] T010 — 同 migration 追加 indexes：partial unique live key、attempt target / invitation、context attempt、audit attempt / person / correlation。 **Files**: 同上 **Depends**: T009 **Acceptance**: partial index 谓词严格 `WHERE state = 'PENDING'`；无永久唯一 [REQ:FR-017 / plan D-2.1 / CHK044] [VERIFY:node scripts/db-migrate.mjs]
- [x] T011 — 同 migration 追加 context getter / setter functions：`app_binding_*()`、`app.set_binding_*_context()`、`app.set_binding_target_context()`、`app.set_binding_operation_scope()`、`app.set_binding_commit_account_id()`、`app.set_binding_candidate_account_id()`（SECURITY INVOKER，只 set_config + 参数校验）。 **Files**: 同上 **Depends**: T010 **Acceptance**: 函数签名与 plan D-13.1 / D-13.4 一致；不新建 context framework [REQ:FR-024 / plan D-13.1 / D-13.4] [VERIFY:node scripts/db-migrate.mjs]
- [x] T012 — 同 migration 追加新表 `ENABLE` + `FORCE ROW LEVEL SECURITY` + policies（含 `binding_pending_contexts` 的 attempt-scoped GATE / COMMIT policy，供 commit 不重放 token 即锁定 context）。 **Files**: 同上 **Depends**: T011 **Acceptance**: 5 张表 `relrowsecurity` / `relforcerowsecurity` = true [REQ:FR-024 / plan D-13.2 / CHK125] [VERIFY:node scripts/db-migrate.mjs && node scripts/db-evidence.mjs]
- [ ] T013 — re-audit RLS migration contract：保留intended read policies显式FOR SELECT与Person commit policy显式FOR UPDATE；同时不得把FOR SELECT/FOR UPDATE文本当H-02 proof。chosen Gate2 concurrency机制若需要policy/migration支持，必须在唯一006 migration内最小调整，并由T103真实runtime-role behavior证明。 **Files**: unique006 migration **Acceptance**: polcmd正确 + 不阻断chosen H-02 linearization proof [REQ:H-02 / plan D-13.5] [VERIFY:node scripts/db-evidence.mjs && bun run vitest run tests/db/identity-binding-rls.test.ts]
- [x] T014 — 同 migration 追加 append-only / immutable triggers：confirmations 拒绝 UPDATE / DELETE；audit 拒绝 UPDATE / DELETE。 **Files**: 同上 **Depends**: T013 **Acceptance**: trigger 存在；UPDATE / DELETE 抛异常 [REQ:plan D-4.3 / D-15.2 / CHK140] [VERIFY:node scripts/db-migrate.mjs && node scripts/db-evidence.mjs]
- [x] T015 — 同 migration 追加 GRANT：attempts / contexts / confirmations / operation keys 的最小 DML；audit 仅 INSERT；enum USAGE；functions EXECUTE。 **Files**: 同上 **Depends**: T014 **Acceptance**: `has_table_privilege` 输出符合 plan D-18.1 [REQ:plan D-18.1 / CHK167] [VERIFY:node scripts/db-migrate.mjs && bun run vitest run tests/db/identity-binding-schema.test.ts]
- [x] T016 — 运行 migration + schema test，记录 real output；最终**只允许一个 006-owned additive migration**：若存在第二个未 merge 的 006 migration，先将其批准内容 fold 回主 migration 并删除额外文件（普通 commit，不 rebase / 不 force push / 不改已 merge migration）；若 migration 编号冲突，按最新 main 重新分配后重跑。 **Files**: migration、`tests/db/identity-binding-schema.test.ts` **Depends**: T007—T015 **Acceptance**: `bun run db:migrate` PASS；schema test PASS；006-owned migration 计数 = 1 [REQ:FR-012 / plan D-18.1] [VERIFY:bun run db:migrate]

---

## Phase 2 — Domain Pure Logic

- [x] T017 — 定义 domain 类型：`BindingAttemptState`、`BindingTerminalReason`、`BindingGateResult`、`BindingAttemptProjection`、`BindingConfirmationRecord`；不引入 `RETRYABLE` state。 **Files**: `packages/domain/src/identity-binding.ts` **Depends**: T006 **Acceptance**: `bun run typecheck` PASS [REQ:FR-013 / plan D-2.2] [VERIFY:bun run typecheck]
- [x] T018 [P] — 写状态机 RED 测试：允许转换、禁止转换、settled、expiration、RETRYABLE 不是 state。 **Files**: `tests/domain/identity-binding-state.test.ts` **Depends**: T017 **Acceptance**: 预期 RED；覆盖 plan D-2.2 全部转换 [REQ:FR-013 / AS-14 / CHK039—CHK043] [VERIFY:bun run vitest run tests/domain/identity-binding-state.test.ts]
- [x] T019 — 实现状态机纯函数：`canTransition`、`settleAttempt`、`isSettled`、`materializeExpiration`。 **Files**: `packages/domain/src/identity-binding.ts` **Depends**: T018 **Acceptance**: `bun run vitest run tests/domain/identity-binding-state.test.ts` PASS [REQ:FR-013 / plan D-2.2] [VERIFY:bun run vitest run tests/domain/identity-binding-state.test.ts]
- [x] T020 [P] — 写 Gate matrix RED 测试：UNDER_14 / MINOR 有 / 无 guardian / ADULT / UNKNOWN、consent revoked、multi-family、verified_source 不参与。 **Files**: `tests/domain/identity-binding-gate.test.ts` **Depends**: T017 **Acceptance**: 预期 RED；逐行断言 Gate 1 / Gate 2 结果与 reason [REQ:FR-006 / FR-010 / AS-02 / AS-03 / AS-14] [VERIFY:bun run vitest run tests/domain/identity-binding-gate.test.ts]
- [x] T021 — 实现 domain pure Gate matrix：`evaluateBindingGate(input)`；不 import `@xiaoshuyin/compliance`；输入含 app 层传入的 `minorGate` 结果。 **Files**: `packages/domain/src/identity-binding-gate.ts` **Depends**: T020 **Acceptance**: `bun run vitest run tests/domain/identity-binding-gate.test.ts` PASS [REQ:plan D-8.2 / CHK023—CHK036] [VERIFY:bun run vitest run tests/domain/identity-binding-gate.test.ts]
- [x] T022 [P] — 写 idempotency RED 测试：scope、same/different payload、replay、new attempt、`attempt id ≠ operation key`。 **Files**: `tests/domain/identity-binding-idempotency.test.ts` **Depends**: T017 **Acceptance**: 预期 RED；覆盖 plan D-5.3 全表 [REQ:FR-022 / SC-006 / CHK071—CHK082] [VERIFY:bun run vitest run tests/domain/identity-binding-idempotency.test.ts]
- [x] T023 — 实现 idempotency 纯函数：`computeOperationScope`、`decideBindingOperation`、`canCreateNewAttempt`；不存 response body。 **Files**: `packages/domain/src/identity-binding.ts` **Depends**: T022 **Acceptance**: `bun run vitest run tests/domain/identity-binding-idempotency.test.ts` PASS [REQ:plan D-5 / CHK073] [VERIFY:bun run vitest run tests/domain/identity-binding-idempotency.test.ts]
- [ ] T024 [P] — anti-enumeration RED：candidate AFFIRM eligible 与 dynamic-ineligible/terminal hidden branch 都必须返回同 HTTP/body-key shape：NOT_COMPLETED + pairingChallenge；valid 与 decoy challenge外观不可作为 eligibility oracle；REJECT/CANCEL仍为本人选择驱动的 generic。 **Files**: tests/domain/identity-binding-anti-enumeration.test.ts **Acceptance**: old serializer RED；无 P1/attempt/reason leakage [REQ:H-01 / M-01 / plan D-11] [VERIFY:bun run vitest run tests/domain/identity-binding-anti-enumeration.test.ts]
- [ ] T025 — 更新 candidate serializer：AFFIRM固定返回 pairingChallenge field，支持 valid/decoy material；不得让业务 hidden reason改变status/key-set/header。 **Files**: packages/domain/src/identity-binding-anti-enumeration.ts **Depends**: T024 **Acceptance**: T024 GREEN [REQ:H-01 / plan D-11] [VERIFY:bun run vitest run tests/domain/identity-binding-anti-enumeration.test.ts]
- [x] T026 — 实现 attempt projection / terminal reason mapping：内部 reason → 公开 state / generic；authorized confirmer 投影只含 state。 **Files**: `packages/domain/src/identity-binding.ts` **Depends**: T019 / T023 **Acceptance**: `bun run typecheck` + 上述 domain tests PASS [REQ:FR-013 / FR-019 / plan D-11.2] [VERIFY:bun run typecheck]

---

## Phase 3 — Crypto, Env, Pending Context

- [ ] T027 [P] — pairing crypto RED：server-only authenticated opaque challenge，至少128-bit effective security；绑定context/identity/attempt/P1/invitation/expiry；tamper / wrong-binding / expired失败；raw challenge不含可读身份字段。保留现有context crypto regression。 **Files**: tests/domain/identity-binding-crypto.test.ts **Acceptance**: H-01 challenge properties RED [REQ:H-01 / plan D-3.5] [VERIFY:bun run vitest run tests/domain/identity-binding-crypto.test.ts]
- [ ] T028 — 实现/扩展 pairing challenge crypto helper；只使用服务端secret的domain-separated authenticated construction，不持久化raw challenge。保留既有context token/AES行为。 **Files**: apps/server/api/src/identity-binding/crypto.ts **Depends**: T027 **Acceptance**: T027 GREEN [REQ:H-01 / plan D-3.5] [VERIFY:bun run vitest run tests/domain/identity-binding-crypto.test.ts]
- [ ] T029 [P] — env RED：在原3个identity-binding env基础上新增 IDENTITY_BINDING_PAIRING_TTL_SECONDS required positive/no default；缺失/非法fail。 **Files**: tests/domain/identity-binding-env.test.ts **Acceptance**: old env contract RED [REQ:H-01 / plan D-3.5] [VERIFY:bun run vitest run tests/domain/identity-binding-env.test.ts]
- [ ] T030 — env contract实现增加PAIRING_TTL；不得暴露secret value；pairing expiry必须受context/attempt上界限制。 **Files**: packages/contracts/src/env.ts、.env.example(如存在) **Depends**: T029 **Acceptance**: env test GREEN [REQ:H-01] [VERIFY:bun run vitest run tests/domain/identity-binding-env.test.ts]
- [ ] T031 — pending-context DB RED：补 M-02/M-03 cleanup matrix；settled/pre-attempt replay fresh context、context-only expiry、attempt expiry多context；直接断言 ciphertext/nonce/tag。保留既有repository行为。 **Files**: tests/db/identity-binding-context.test.ts **Acceptance**: current implementation至少M-02/M-03 RED [REQ:M-02/M-03 / plan D-14] [VERIFY:bun run vitest run tests/db/identity-binding-context.test.ts]
- [ ] T032 — context repository remediation：提供不受linkAttempt顺序影响的fresh-context cleanup、attempt-scope all-context scrub、context-only expiry scrub；不得把cleanup遗漏交给future lifecycle。 **Files**: pending-context-repository.ts **Depends**: T031 **Acceptance**: T031 GREEN [REQ:M-02/M-03] [VERIFY:bun run vitest run tests/db/identity-binding-context.test.ts]

---

## Phase 4 — Repositories, RLS Context, Invitation Port

- [x] T033 — 写 tx wrapper RED 测试（DB）：5 个 binding wrapper 设置正确 GUC / purpose；commit context 设置 `app.account_id=actorAccountId` 与 `app.binding_commit_account_id`；普通 wrapper 行为不变。 **Files**: `tests/db/identity-binding-tx.test.ts` **Depends**: T016 **Acceptance**: 预期 RED；GUC 值 / purpose 逐项断言 [REQ:plan D-13.4 / CHK127] [VERIFY:bun run vitest run tests/db/identity-binding-tx.test.ts]
- [x] T034 — 扩展 `apps/server/api/src/db/tx.ts`：`withBindingContextTransaction`、`withBindingBootstrapTransaction`、`withBindingTargetTransaction`、`withBindingGateTransaction`、`withBindingCommitTransaction`、`withBindingAttemptTransaction`；bootstrap 在 invitation resolve 后调用 `app.set_binding_gate_context` 设置 target GUC（同一事务）；`withBindingTargetTransaction` 只设 target-person GUC 以解析 P1 唯一 Family；Gate / Commit wrapper 接受可选 `candidateAccountId` 并调用 `app.set_binding_candidate_account_id`（只用于 candidate-account read policy，不复用 `app.account_id`）。 **Files**: `apps/server/api/src/db/tx.ts` **Depends**: T033 **Acceptance**: `bun run vitest run tests/db/identity-binding-tx.test.ts` PASS [REQ:plan D-13.4] [VERIFY:bun run vitest run tests/db/identity-binding-tx.test.ts]
- [x] T035 — 写 attempt repository RED 测试（DB）：create / find live by triple / find by id / settle / expire / new attempt after terminal。 **Files**: `tests/db/identity-binding-attempt-repository.test.ts` **Depends**: T034 **Acceptance**: 预期 RED；partial unique 冲突 / new attempt 行为正确 [REQ:plan D-2 / D-7 / CHK044—CHK045] [VERIFY:bun run vitest run tests/db/identity-binding-attempt-repository.test.ts]
- [x] T036 — remediation attempt repository：create/converge same triple 前先 materialize existing expired PENDING；expired row 不得再作为 live convergence target。 **Files**: `apps/server/api/src/identity-binding/attempt-repository.ts` **Depends**: T035 **Acceptance**: old expired row 先退出 live state；repository 提供 authoritative transition result 供 bootstrap 做 exactly-once audit/cleanup [REQ:F-07 / plan D-2.2 / D-14 / CHK197] [VERIFY:bun run vitest run tests/db/identity-binding-attempt-repository.test.ts]
- [x] T037 — 扩展 cross-attempt confirmation RED：A 的 confirmations 永远只满足 A；A terminal 后 B 只能有 B 自身新 confirmation；historical operation replay 不得复制/重用 A confirmation。 **Files**: `tests/db/identity-binding-confirmation-repository.test.ts` **Depends**: T034 **Acceptance**: A/B `attempt_id` 严格隔离 [REQ:F-02 / plan D-4 / D-5.4 / CHK194] [VERIFY:bun run vitest run tests/db/identity-binding-confirmation-repository.test.ts]
- [x] T038 — 实现 confirmation repository：`appendCandidate`、`appendSecondParty`、`listByAttempt`；不提供 update / delete。 **Files**: `apps/server/api/src/identity-binding/confirmation-repository.ts` **Depends**: T037 **Acceptance**: `bun run vitest run tests/db/identity-binding-confirmation-repository.test.ts` PASS [REQ:plan D-4] [VERIFY:bun run vitest run tests/db/identity-binding-confirmation-repository.test.ts]
- [ ] T039 — operation-key RED更新：SECOND_PARTY operation首绑attempt A后不可remap；canonical request identity不再依赖path attemptId，而必须覆盖pairingChallenge canonical digest + decision fields；same key + challenge resolving B mismatch，same exact replay仍解析authoritative A。 **Files**: tests/db/identity-binding-operation-key-repository.test.ts / idempotency helper tests as appropriate **Acceptance**: operation.attempt_id authoritative/immutable [REQ:H-01 / historical F-02 / plan D-5.4] [VERIFY:bun run vitest run tests/db/identity-binding-operation-key-repository.test.ts]
- [x] T040 — 实现 operation key repository：`lockScope`、`find`、`insert`、`mapAttempt`；每次 lookup / insert 前调用 `app.set_binding_operation_scope(scopeKey)`；不存 response body。 **Files**: `apps/server/api/src/identity-binding/operation-key-repository.ts` **Depends**: T039 **Acceptance**: `bun run vitest run tests/db/identity-binding-operation-key-repository.test.ts` PASS [REQ:plan D-5 / D-13.2] [VERIFY:bun run vitest run tests/db/identity-binding-operation-key-repository.test.ts]
- [x] T041 [P] — 写 invitation port RED 测试：VALID / TERMINAL_UNUSABLE、fixture 只用于 contract-level、不得写第二套 invitation 模型。 **Files**: `tests/domain/identity-binding-invitation-port.test.ts` **Depends**: T017 **Acceptance**: 预期 RED；port 分支 / fixture 行为断言 [REQ:plan D-16 / CHK143—CHK146] [VERIFY:bun run vitest run tests/domain/identity-binding-invitation-port.test.ts]
- [x] T042 — 定义 `InvitationResolutionPort` + `InvitationResolution` + contract-level fixture；production adapter 位置留空并标 BLOCKED（T121）。 **Files**: `apps/server/api/src/identity-binding/invitation-port.ts` **Depends**: T041 **Acceptance**: `bun run vitest run tests/domain/identity-binding-invitation-port.test.ts` PASS [REQ:plan D-16.1] [VERIFY:bun run vitest run tests/domain/identity-binding-invitation-port.test.ts]
- [x] T043 — 写 audit repository RED 测试（DB）：insert、append-only、runtime 不可读、无 secret、target nullable。 **Files**: `tests/db/identity-binding-audit-repository.test.ts` **Depends**: T034 **Acceptance**: 预期 RED；INSERT 成功；SELECT 被 RLS 拒绝；UPDATE / DELETE 抛异常 [REQ:plan D-15 / CHK135—CHK142] [VERIFY:bun run vitest run tests/db/identity-binding-audit-repository.test.ts]
- [x] T044 — 实现 audit repository：`appendAudit` 仅 INSERT，不返回到 runtime 业务响应。 **Files**: `apps/server/api/src/identity-binding/audit-repository.ts` **Depends**: T043 **Acceptance**: `bun run vitest run tests/db/identity-binding-audit-repository.test.ts` PASS [REQ:plan D-15] [VERIFY:bun run vitest run tests/db/identity-binding-audit-repository.test.ts]

---

## Phase 5 — Authorization Extension

- [x] T045 [P] — 写 authorization RED 测试：6 个新 action 的 allow / deny；UNDER_14 / MINOR / ADULT / UNKNOWN；facts 缺失 DENY；candidate 不能调用 confirmer 动作。 **Files**: `tests/domain/identity-binding-authorization.test.ts` **Depends**: T006 **Acceptance**: 预期 RED；每个 action 至少 1 allow + 1 deny [REQ:FR-024 / plan D-12 / CHK115—CHK124] [VERIFY:bun run vitest run tests/domain/identity-binding-authorization.test.ts]
- [x] T046 — 扩展 `authorize()`：Action / Purpose / Resource / Actor / AuthorizeFacts / deny reasons；既有 action 行为不变。 **Files**: `packages/authorization/src/authorize.ts` **Depends**: T045 **Acceptance**: `bun run vitest run tests/domain/identity-binding-authorization.test.ts` PASS [REQ:plan D-12] [VERIFY:bun run vitest run tests/domain/identity-binding-authorization.test.ts]
- [x] T047 — 写 app-layer gate facts builder RED 测试（DB-backed，**不得放入纯 domain suite**）：读取 P1 / family / age / guardian / manager / membership + 调用 `assertMinorProcessingAllowed` 产生 `minorGate`；缺失即 null。纯 facts shape / `evaluateBindingGate` 仍由 T020 / T021 的 `tests/domain/identity-binding-gate.test.ts` 覆盖。 **Files**: `tests/db/identity-binding-facts.test.ts` **Depends**: T034 / T046 **Acceptance**: 预期 RED；facts 字段完整 / 缺失行为断言；`tests/domain/**` 不含 DB-backed facts [REQ:plan D-8.2 / D-12.1 / D-19.1] [VERIFY:bun run vitest run tests/db/identity-binding-facts.test.ts]
- [x] T048 — 实现 app-layer `gate.ts` facts builder：repository 读取 + `assertMinorProcessingAllowed`，再调用 domain pure matrix；按候选 Account 读取其已绑定 Person（仅 `IDENTITY_CONFLICT` 判定），不读 `verified_source`，不从 membership 推导 guardian。 **Files**: `apps/server/api/src/identity-binding/gate.ts` **Depends**: T047 **Acceptance**: `bun run vitest run tests/db/identity-binding-facts.test.ts` PASS [REQ:plan D-8.1 / D-8.2 / D-12.2] [VERIFY:bun run vitest run tests/db/identity-binding-facts.test.ts]

---

## Phase 6 — Bootstrap Runtime（Phase A / Gate 1 / Phase B）

- [ ] T049 — bootstrap replay RED矩阵：COMMITTED replay / TERMINAL replay / pre-attempt blocked replay / Case B REUSED replay新建fresh transport context后，所有不再需要OpenID的fresh context三secret列均NULL；PENDING live context不得误清。 **Files**: tests/integration/identity-binding-bootstrap.test.ts **Acceptance**: M-02 direct DB observable RED [REQ:M-02] [VERIFY:bun run vitest run tests/integration/identity-binding-bootstrap.test.ts]
- [ ] T050 — bootstrap cleanup remediation：cleanup scope按authoritative outcome选择，不得因linkAttempt后attempt_id非NULL绕过fresh replay cleanup；M-02四类replay全部GREEN。 **Files**: bootstrap.ts + pending-context repository **Depends**: T049/T032 **Acceptance**: fresh context secret=0 [REQ:M-02] [VERIFY:bun run vitest run tests/integration/identity-binding-bootstrap.test.ts tests/db/identity-binding-context.test.ts]
- [x] T051 — 写 Case B RED 测试：正确 Account → REUSED + session；错误 Account → generic；均不创建 Person / binding。 **Files**: `tests/integration/identity-binding-case-b.test.ts` **Depends**: T050 **Acceptance**: 预期 RED；Account / Person / binding 计数断言 [REQ:FR-003 / SC-002 / AS-09] [VERIFY:bun run vitest run tests/integration/identity-binding-case-b.test.ts]
- [x] T052 — 实现 Case B 分支 + session 签发复用；不进入 bootstrap attempt；Case B mismatch 的 context 清空 ciphertext 后返回 generic。 **Files**: `apps/server/api/src/identity-binding/bootstrap.ts` **Depends**: T051 **Acceptance**: `bun run vitest run tests/integration/identity-binding-case-b.test.ts` PASS [REQ:plan D-3.2 / D-6 / D-17] [VERIFY:bun run vitest run tests/integration/identity-binding-case-b.test.ts]
- [x] T053 — 写 Gate 1 blocked RED 测试：UNDER_14 no guardian / consent invalid / ADULT / UNKNOWN / multi-family / invitation invalid；无 attempt、无 P1-specific confirmation、无 session。 **Files**: `tests/integration/identity-binding-gate1.test.ts` **Depends**: T050 **Acceptance**: 预期 RED；每个分支 0 attempt / 0 account / 0 person increment / generic [REQ:FR-006 / AS-14 / AS-06] [VERIFY:bun run vitest run tests/integration/identity-binding-gate1.test.ts]
- [x] T054 — 实现 Gate 1 blocked 分支：context 保留、ciphertext 清空、audit、generic；不创建 attempt。 **Files**: `apps/server/api/src/identity-binding/bootstrap.ts` **Depends**: T053 **Acceptance**: `bun run vitest run tests/integration/identity-binding-gate1.test.ts` PASS [REQ:plan D-8.3] [VERIFY:bun run vitest run tests/integration/identity-binding-gate1.test.ts]
- [x] T055 — expiry-before-create RED：old expired PENDING + same triple + new operation → old TERMINAL/ATTEMPT_EXPIRED + audit exactly once + old all-context scrub → new different attempt id；new context 不得 link old id。 **Files**: `tests/integration/identity-binding-attempt-create.test.ts` **Depends**: T050 / T036 **Acceptance**: 旧实现先 RED；重复/并发访问仍 exactly-one expiry audit [REQ:F-07 / CHK197] [VERIFY:bun run vitest run tests/integration/identity-binding-attempt-create.test.ts]
- [x] T056 — 实现 expiry-before-create/converge + exactly-once audit + old all-context cleanup，再创建/link new attempt。 **Files**: `bootstrap.ts` + attempt/context repositories **Depends**: T055 **Acceptance**: T055 GREEN；无 background job / expired-link [REQ:F-07 / plan D-14] [VERIFY:bun run vitest run tests/integration/identity-binding-attempt-create.test.ts]
- [x] T057 — 写 bootstrap route RED 测试：`POST /identity-bindings/bootstrap` schema、200 generic、Case B REUSED、COMMITTED settled replay、401 WeChat fail、无 mode / hidden params。 **Files**: `tests/integration/identity-binding-bootstrap-route.test.ts` **Depends**: T050 **Acceptance**: 预期 RED；route 行为 / response shape 断言 [REQ:FR-001 / plan D-10.1 / D-10.2] [VERIFY:bun run vitest run tests/integration/identity-binding-bootstrap-route.test.ts]
- [x] T058 — 实现 bootstrap route + **bootstrap Zod schema**（写入 `identity-binding-schemas.ts` 的 bootstrap 段，含 `BindingBootstrapCommittedResponse`：strict `{ binding:"COMMITTED" }`）+ WeChat provider 调用；注册到 app。 **Files**: `apps/server/api/src/routes/identity-bindings.ts`、`packages/contracts/src/identity-binding-schemas.ts`、`apps/server/api/src/app.ts` **Depends**: T057 **Acceptance**: `bun run vitest run tests/integration/identity-binding-bootstrap-route.test.ts` PASS [REQ:plan D-10.2] [VERIFY:bun run vitest run tests/integration/identity-binding-bootstrap-route.test.ts]

---

## Phase 7 — Candidate Decision / Status

- [ ] T059 — candidate RED：保留confirmationVersion完整matrix；新增 M-01 current eligibility矩阵（至少consent revoked after bootstrap before AFFIRM）；ineligible→TERMINAL、candidate confirmation +0、valid pairing +0、audit=1、all contexts scrub；AFFIRM response仍固定带pairingChallenge(decoy)。 **Files**: tests/integration/identity-binding-candidate.test.ts **Acceptance**: old stale-eligibility实现 RED [REQ:H-01/M-01] [VERIFY:bun run vitest run tests/integration/identity-binding-candidate.test.ts]
- [ ] T060 — candidate orchestration remediation：AFFIRM写confirmation前current-read P1/membership/profile-age/guardian/consent-compliance/invitation/P1-binding/candidate-conflict；PASS后发行valid challenge，FAIL走authoritative terminal settlement + decoy shape。REJECT/CANCEL继续all-context scrub。 **Files**: candidate-decision.ts + gate/context/audit helpers **Depends**: T059/T028/T032 **Acceptance**: T059 GREEN [REQ:H-01/M-01] [VERIFY:bun run vitest run tests/integration/identity-binding-candidate.test.ts]
- [ ] T061 — status expiry RED：attempt expiry由status materialize时，>=2 contexts全部secret NULL、ATTEMPT_EXPIRED、terminal audit exactly1、binding0；context-only expiry至少current scrub且不伪造attempt terminal audit。 **Files**: tests/integration/identity-binding-status.test.ts **Acceptance**: M-03 RED [REQ:M-03] [VERIFY:bun run vitest run tests/integration/identity-binding-status.test.ts]
- [ ] T062 — status remediation：status访问若materialize expiry必须调用D-14 authoritative settlement/cleanup；不得只clear current context。 **Files**: candidate-status.ts + route/context/settlement helper **Depends**: T061/T032 **Acceptance**: T061 GREEN [REQ:M-03] [VERIFY:bun run vitest run tests/integration/identity-binding-status.test.ts]
- [x] T063 — 写 candidate route auth RED 测试：`X-Binding-Context` 接受；Bearer 拒绝；无 header 401；candidate 不能调用 confirmer 路由。 **Files**: `tests/integration/identity-binding-candidate-auth.test.ts` **Depends**: T062 **Acceptance**: 预期 RED；status / decision 路由 auth 行为断言 [REQ:FR-024 / plan D-10.4 / CHK121] [VERIFY:bun run vitest run tests/integration/identity-binding-candidate-auth.test.ts]
- [x] T064 — 实现 candidate preHandler / auth plugin exemption；普通 Bearer 不进入 binding 路由。 **Files**: `apps/server/api/src/plugins/auth.ts`、`apps/server/api/src/routes/identity-bindings.ts` **Depends**: T063 **Acceptance**: `bun run vitest run tests/integration/identity-binding-candidate-auth.test.ts` PASS [REQ:plan D-10.4] [VERIFY:bun run vitest run tests/integration/identity-binding-candidate-auth.test.ts]

---

## Phase 8 — Confirmer Runtime

- [ ] T065 — H-01 confirmer RED：原S0/S1 selector测试删除/反向证明禁止；candidate-presented challenge解析exact attempt；original attack必须fail closed；wrong P1/invitation/candidate/attempt、expired/consumed challenge 404/0 mutation；two-candidate不串线；candidate token不能代持。 **Files**: tests/integration/identity-binding-confirmer.test.ts **Acceptance**: failed Head对original attack先RED [REQ:H-01 / CHK191—CHK194] [VERIFY:bun run vitest run tests/integration/identity-binding-confirmer.test.ts]
- [ ] T066 — pairing-decision remediation：移除attemptId client selector；验证pairingChallenge后解析authoritative attempt；operation request hash覆盖challenge canonical digest + decision fields；existing operation.attempt_id仍authoritative；same key A→challenge B 409且B零mutation。 **Files**: confirmer.ts + crypto/idempotency helpers **Depends**: T065 **Acceptance**: T065/T106 GREEN [REQ:H-01 / historical F-02] [VERIFY:bun run vitest run tests/integration/identity-binding-confirmer.test.ts tests/integration/identity-binding-idempotency.test.ts]
- [ ] T067 — confirmer REJECT RED更新为exact pairing challenge required；无法辨认现场candidate时REJECT只能作用于该challenge-bound attempt；invalid/expired challenge不能终止其它attempt。保留affirm后reject历史不可改。 **Files**: tests/integration/identity-binding-confirmer-reject.test.ts **Acceptance**: H-01 rejection boundary RED [REQ:H-01] [VERIFY:bun run vitest run tests/integration/identity-binding-confirmer-reject.test.ts]
- [ ] T068 — pairing REJECT / expiry settlement走D-14唯一terminal path；all-context scrub + exactly-one audit。 **Files**: confirmer.ts + settlement/context helper **Depends**: T067 **Acceptance**: reject/expiry multi-context GREEN [REQ:H-01/M-04] [VERIFY:bun run vitest run tests/integration/identity-binding-confirmer-reject.test.ts]
- [ ] T069 — confirmer list RED重新执行：保留minimal fields/404/filtering，并新增明确negative assertion：pending list / unique attempt / createdAt均不得作为pairing selector；若list访问物化attempt expiry，必须走authoritative expiry settlement并all-context scrub。 **Files**: tests/integration/identity-binding-confirmer-list.test.ts **Acceptance**: operational view ≠ identity pairing proof [REQ:H-01/M-03] [VERIFY:bun run vitest run tests/integration/identity-binding-confirmer-list.test.ts]
- [ ] T070 — confirmer list remediation：list保持minimal operational view；不得提供pairing selection logic；过期attempt访问统一调用D-14 expiry settlement，不能只改state/audit而漏cleanup。 **Files**: confirmer.ts/routes + settlement helper **Depends**: T069/T080 **Acceptance**: T069 GREEN [REQ:H-01/M-03/M-04] [VERIFY:bun run vitest run tests/integration/identity-binding-confirmer-list.test.ts]
- [ ] T071 — confirmer独立认证RED更新：/pairing-decision只接受independent Bearer；candidate X-Binding-Context或candidate token不能调用；pairingChallenge possession alone不能绕过actor authority。 **Files**: tests/integration/identity-binding-confirmer-independent.test.ts **Acceptance**: auth+challenge双边界 [REQ:H-01] [VERIFY:bun run vitest run tests/integration/identity-binding-confirmer-independent.test.ts]
- [ ] T072 — auth plugin/route更新到/pairing-decision；独立Bearer required，显式拒绝candidate binding context。 **Files**: plugins/auth.ts、routes/identity-bindings.ts **Depends**: T071 **Acceptance**: T071 GREEN [REQ:H-01 / plan D-10.4] [VERIFY:bun run vitest run tests/integration/identity-binding-confirmer-independent.test.ts]

---

## Phase 9 — Gate 2 & Phase C Commit

- [ ] T073 — H-02 Gate2 real concurrency RED：真实PostgreSQL + xiaoshuyin_app runtime role barrier，逐类覆盖profile/age-band、consent、guardian、membership/authority、invitation contract seam、P1 binding conflict及candidate-account conflict；Gate2 PASS后invalidating mutation在线性化上先成立→binding0/non-COMMITTED。 **Files**: tests/integration/identity-binding-commit-gate2.test.ts (+ DB helper test as needed) **Acceptance**: FOR UPDATE 0-row不得被当PASS [REQ:H-02] [VERIFY:bun run vitest run tests/integration/identity-binding-commit-gate2.test.ts]
- [ ] T074 — Gate2 remediation：采用最小DB-safe row lock/version/optimistic/advisory/isolation机制建立authoritative linearization boundary；不强制具体SQL，但必须让T073在真实runtime role GREEN。 **Files**: commit.ts + necessary repository/tx/migration policy **Depends**: T073 **Acceptance**: all invalidation barriers no commit [REQ:H-02] [VERIFY:bun run vitest run tests/integration/identity-binding-commit-gate2.test.ts]
- [x] T075 — 写 Account create / reuse RED 测试：无 Account → create；existing unbound → reuse；existing bound P1 → historical COMMITTED / conflict；existing bound P2 → TERMINAL。 **Files**: `tests/integration/identity-binding-account.test.ts` **Depends**: T074 **Acceptance**: 预期 RED；Account / Person 计数与 binding 断言 [REQ:FR-011 / AS-21 / CHK107—CHK110] [VERIFY:bun run vitest run tests/integration/identity-binding-account.test.ts]
- [x] T076 — 实现 Account create / reuse + conflict 分支；不 INSERT Person。 **Files**: `apps/server/api/src/identity-binding/commit.ts` **Depends**: T075 **Acceptance**: `bun run vitest run tests/integration/identity-binding-account.test.ts` PASS [REQ:plan D-6.3] [VERIFY:bun run vitest run tests/integration/identity-binding-account.test.ts]
- [x] T077 — 写 P1 conditional update RED 测试（DB）：rowCount 1 / 0、并发 P1、已绑定 P1、Person account unique。 **Files**: `tests/db/identity-binding-p1-commit.test.ts` **Depends**: T074 **Acceptance**: 预期 RED；rowCount / unique violation / TERMINAL 断言 [REQ:FR-011 / FR-017 / SC-005] [VERIFY:bun run vitest run tests/db/identity-binding-p1-commit.test.ts]
- [x] T078 — 实现 P1 conditional update + rowCount 判定 + concurrency loser terminal。 **Files**: `apps/server/api/src/identity-binding/commit.ts` **Depends**: T077 **Acceptance**: `bun run vitest run tests/db/identity-binding-p1-commit.test.ts` PASS [REQ:plan D-6.4 / D-7] [VERIFY:bun run vitest run tests/db/identity-binding-p1-commit.test.ts]
- [ ] T079 — settlement RED扩展M-04：Phase C中attempt expiry必须由单一authoritative settlement完成 state+reason+audit exactly1+all-context scrub；禁止terminal state/audit0/secret retained。 **Files**: tests/integration/identity-binding-commit-settle.test.ts **Acceptance**: current materializeExpired→terminalize double-step RED [REQ:M-04] [VERIFY:bun run vitest run tests/integration/identity-binding-commit-settle.test.ts]
- [ ] T080 — 统一settlement/cleanup primitive：COMMITTED与任何TERMINAL均在authoritative consistency boundary完成all-context scrub；ATTEMPT_EXPIRED不能先改state再二次settle跳过audit/cleanup。 **Files**: commit.ts + attempt/context/audit repositories **Depends**: T079 **Acceptance**: M-03/M-04 multi-context GREEN [REQ:M-03/M-04] [VERIFY:bun run vitest run tests/integration/identity-binding-commit-settle.test.ts]
- [ ] T081 — rollback matrix重新执行并扩展：Gate2、Account、Person update、settlement、all-context cleanup、audit任一点失败均无partial success；新增terminal-with-retained-secret必须失败。 **Files**: tests/integration/identity-binding-rollback.test.ts **Acceptance**: each injection direct object/state proof [REQ:H-02/M-04] [VERIFY:bun run vitest run tests/integration/identity-binding-rollback.test.ts]
- [ ] T082 — transaction error/settlement实现按D-14收口；business terminal必须audit+cleanup原子，infra failure rollback/RETRYABLE，不得留下state-only terminal。 **Files**: commit.ts/errors.ts + settlement helper **Depends**: T081 **Acceptance**: rollback suite GREEN [REQ:M-04] [VERIFY:bun run vitest run tests/integration/identity-binding-rollback.test.ts]
- [x] T083 — 写并发 commit RED 测试（DB）：同一 P1 多 attempt、同一 Account 多 P1、double confirmation、commit vs retry、全失败 0 commit。 **Files**: `tests/db/identity-binding-concurrency.test.ts` **Depends**: T078 / T080 **Acceptance**: 预期 RED；successful commits ∈ {0,1}；binding increase ≤ 1；Person increment 0 [REQ:FR-016 / FR-017 / SC-005 / AS-10] [VERIFY:bun run vitest run tests/db/identity-binding-concurrency.test.ts]
- [x] T084 — 实现并发收敛补齐：unique violation / rowCount 0 → 读取 authoritative state → terminal / replay；不引入第二套锁。 **Files**: `apps/server/api/src/identity-binding/commit.ts` **Depends**: T083 **Acceptance**: `bun run vitest run tests/db/identity-binding-concurrency.test.ts` PASS [REQ:plan D-7] [VERIFY:bun run vitest run tests/db/identity-binding-concurrency.test.ts]
- [ ] T085 — success/pairing E2E RED重写：两条MINOR合法success保留；第三条改为candidate AFFIRM→server valid pairingChallenge→onsite human recognition→independent confirmer pairing-decision→same exact identity/attempt→COMMITTED；另直接复现original attacker race必须fail closed；expired/replay/two-candidate/two-confirmer concurrency覆盖。 **Files**: tests/integration/identity-binding-commit.test.ts **Acceptance**: 不再出现S0/S1 exact-delta作为proof [REQ:H-01/H-02] [VERIFY:bun run vitest run tests/integration/identity-binding-commit.test.ts]
- [ ] T086 — 接入pairing-decision AFFIRM→Phase C；challenge validation/single-use、SECOND_PARTY confirmation、Gate2 commit衔接；infra retry不得double confirmation/commit。 **Files**: confirmer.ts、commit.ts **Depends**: T085/T066/T074 **Acceptance**: H-01 E2E GREEN [REQ:H-01] [VERIFY:bun run vitest run tests/integration/identity-binding-commit.test.ts]

---

## Phase 10 — Session Exchange & Ordinary Identity Bridge

- [x] T087 — 写 session exchange RED 测试：COMMITTED → session；未 committed → generic；无 Account / Person 创建；不 bump epoch。 **Files**: `tests/integration/identity-binding-session.test.ts` **Depends**: T086 **Acceptance**: 预期 RED；response / 对象计数 / epoch 断言 [REQ:FR-011 / AS-01 / CHK157] [VERIFY:bun run vitest run tests/integration/identity-binding-session.test.ts]
- [x] T088 — 实现 `session-exchange.ts` + route；读取 committed account / P1 / epoch，签发普通 session。 **Files**: `apps/server/api/src/identity-binding/session-exchange.ts`、`routes/identity-bindings.ts` **Depends**: T087 **Acceptance**: `bun run vitest run tests/integration/identity-binding-session.test.ts` PASS [REQ:plan D-10.2] [VERIFY:bun run vitest run tests/integration/identity-binding-session.test.ts]
- [x] T089 — 写 ordinary login regression RED 测试：`POST /auth/wechat` new openid → Account + Person；existing → reuse；无 `mode` / `inviteMode` / `binding` / hidden query / 特殊 header。 **Files**: `tests/integration/identity-binding-ordinary-login-regression.test.ts` **Depends**: T032 **Acceptance**: 预期 RED；与基线输出一致；无 P2 [REQ:FR-001 / SC-013 / CHK159] [VERIFY:bun run vitest run tests/integration/identity-binding-ordinary-login-regression.test.ts]
- [x] T090 — 运行 ordinary login regression；若因 auth plugin exemption 引入回归，修复 plugin 边界，不改登录事务。 **Files**: `plugins/auth.ts`、`routes/auth.ts` **Depends**: T089 **Acceptance**: `bun run vitest run tests/integration/identity-binding-ordinary-login-regression.test.ts` + `tests/integration/auth.test.ts` PASS [REQ:plan D-17.1] [VERIFY:bun run vitest run tests/integration/identity-binding-ordinary-login-regression.test.ts]

---

## Phase 11 — Contracts, Routes, Error Envelope

- [ ] T091 — runtime Zod contract remediation：candidate AFFIRM response增加pairingChallenge；新增pairing-decision request schema并移除attemptId path decision；保留confirmationVersion strict union。 **Files**: identity-binding-schemas.ts **Acceptance**: typecheck + candidate/route tests GREEN [REQ:H-01 / OpenAPI] [VERIFY:bun run typecheck && bun run vitest run tests/integration/identity-binding-candidate.test.ts]
- [ ] T092 — 核验本轮handwritten OpenAPI新contract：6 paths；/pairing-decision；无/{attemptId}/decision；AFFIRM response required pairingChallenge；challenge expiry/single-use/anti-enum语义明确；confirmationVersion union不退化。 **Files**: handwritten OpenAPI **Depends**: T091 **Acceptance**: YAML + semantic tests GREEN [REQ:H-01] [VERIFY:ruby -ryaml -e "YAML.load_file(%q{specs/006-identity-binding-runtime/contracts/identity-binding-api.openapi.yaml})" && bun run vitest run tests/integration/openapi-semantic-equivalence.test.ts]
- [ ] T093 — route enumeration RED：恰好6条binding paths且包含/pairing-decision、不包含/{attemptId}/decision；无participant/case/evidence扩张。 **Files**: tests/integration/identity-binding-routes.test.ts **Depends**: T092 **Acceptance**: old route RED [REQ:H-01 / plan D-20] [VERIFY:bun run vitest run tests/integration/identity-binding-routes.test.ts]
- [ ] T094 — route registration迁移到/pairing-decision并保持总数6；不新增第7条。 **Files**: app.ts、routes/identity-bindings.ts **Depends**: T093/T066 **Acceptance**: T093 GREEN [REQ:H-01] [VERIFY:bun run vitest run tests/integration/identity-binding-routes.test.ts]
- [ ] T095 — error envelope RED扩展：invalid/expired/consumed/mismatched challenge与unauthorized target统一404 BINDING_NOT_FOUND；same key different challenge仍409；candidate AFFIRM hidden failure仍200 fixed shape。 **Files**: tests/integration/identity-binding-error-envelope.test.ts **Acceptance**: no pairing oracle [REQ:H-01] [VERIFY:bun run vitest run tests/integration/identity-binding-error-envelope.test.ts]
- [ ] T096 — error mapping/serializer按H-01收口；不得把challenge失败原因暴露给confirmer/candidate。 **Files**: error-handler.ts、errors.ts、candidate/confirmer orchestration **Depends**: T095 **Acceptance**: error suite GREEN [REQ:H-01] [VERIFY:bun run vitest run tests/integration/identity-binding-error-envelope.test.ts]
- [ ] T097 — OpenAPI checker RED→FIX→GREEN重新运行新pairing schema；bad fixture必须能捕获missing pairingChallenge、旧attemptId route残留及confirmationVersion语义错误；generated只由generator产生。 **Files**: checker regression fixture/test + generated **Depends**: T091/T092/T094 **Acceptance**: semantic mismatch non-zero [REQ:H-01/M-05] [VERIFY:bun run vitest run tests/integration/openapi-semantic-equivalence.test.ts && bun run openapi:check]
- [x] T098 — 写 contract-level invitation seam 测试：VALID / TERMINAL_UNUSABLE、真实 adapter 不存在时标记 BLOCKED，不 fake invitation 表。 **Files**: `tests/integration/identity-binding-invitation-contract.test.ts` **Depends**: T042 / T094 **Acceptance**: port 分支断言 PASS；无第二套 invitation 模型 [REQ:plan D-16 / CHK143—CHK148] [VERIFY:bun run vitest run tests/integration/identity-binding-invitation-contract.test.ts]

---

## Phase 12 — Audit, Anti-Enumeration, RLS Hardening

- [x] T099 — 写 audit outcome RED 测试：COMMITTED / PENDING / TERMINAL / RETRYABLE 可追溯；RETRYABLE 使用独立 `event_type='BINDING_OPERATION_RETRYABLE'` 且 attempt state 不变；无 token / openid / ciphertext / consent 原文；不为 audit 创建 Person / Account；Gate 1 阻断 / Case B mismatch / invalid invitation 的 audit 无 target_person / target_family / invitation id。 **Files**: `tests/integration/identity-binding-audit.test.ts` **Depends**: T086 / T044 **Acceptance**: 预期 RED；每个 outcome 至少 1 条 audit；secret 扫描 = 0；Phase A 阻断 audit 无 P1 关联 [REQ:FR-023 / SC-011 / AS-24 / CHK135—CHK142] [VERIFY:bun run vitest run tests/integration/identity-binding-audit.test.ts]
- [x] T100 — 实现 audit 写入点补齐：bootstrap authenticated / Gate1 blocked / attempt created / candidate confirmed / candidate rejected / second-party confirmed / committed / terminal / operation retryable（`BINDING_OPERATION_RETRYABLE`，不改变 attempt state）；Phase A 阻断分支不得写 target person / family / invitation id。 **Files**: `bootstrap.ts`、`candidate-decision.ts`、`confirmer.ts`、`commit.ts`、`audit-repository.ts` **Depends**: T099 **Acceptance**: `bun run vitest run tests/integration/identity-binding-audit.test.ts` PASS [REQ:plan D-15.2] [VERIFY:bun run vitest run tests/integration/identity-binding-audit.test.ts]
- [ ] T101 — anti-enum integration重新执行：true Case B mismatch保留；新增candidate AFFIRM valid-vs-decoy response status/body keys/format/header/read-back等价，不得通过pairingChallenge presence判gate。 **Files**: tests/integration/identity-binding-anti-enumeration.test.ts **Acceptance**: H-01/M-01 direct proof [REQ:H-01/M-01] [VERIFY:bun run vitest run tests/integration/identity-binding-anti-enumeration.test.ts]
- [ ] T102 — 修复candidate response observable差异，valid/decoy challenge走同serializer/shape；不fake-query、不人工delay。 **Files**: anti-enumeration.ts、candidate-decision.ts、routes **Depends**: T101 **Acceptance**: anti-enum GREEN [REQ:H-01] [VERIFY:bun run vitest run tests/integration/identity-binding-anti-enumeration.test.ts]
- [ ] T103 — RLS/runtime-role RED：保留polcmd + SELECT positive/write-negative matrix；新增H-02 lock/version/serialization behavioral proof，真实xiaoshuyin_app不得出现“FOR UPDATE 0 rows却当锁成功”。 **Files**: tests/db/identity-binding-rls.test.ts (+ gate2 DB proof) **Acceptance**: H-02 root cause可复现且fix后GREEN [REQ:H-02] [VERIFY:bun run vitest run tests/db/identity-binding-rls.test.ts tests/integration/identity-binding-commit-gate2.test.ts]
- [ ] T104 — 按T103结果最小修RLS/policy/DB concurrency plumbing；仍single 006 migration、FORCE RLS、NOBYPASSRLS，不以关闭RLS解决。 **Files**: unique006 migration + necessary DB helper **Depends**: T103 **Acceptance**: fresh/upgrade/second-apply + behavioral proof GREEN [REQ:H-02] [VERIFY:bun run vitest run tests/db/identity-binding-rls.test.ts tests/integration/identity-binding-commit-gate2.test.ts && node scripts/db-evidence.mjs]

---

## Phase 13 — Verification-Only Tests & Test Suites

- [ ] T105 — no-P2/object-count regression全量重跑：new pairing、dynamic eligibility、replay cleanup、Gate2/expiry/rollback路径仍必须persons increment=0、P2=0、partial binding/session/authz/participant=0。 **Files**: tests/integration/identity-binding-no-p2.test.ts **Acceptance**: new remediation paths全GREEN [REQ:no-P2/H-01—M-04] [VERIFY:bun run vitest run tests/integration/identity-binding-no-p2.test.ts]
- [ ] T106 — idempotency matrix更新：key K先作用challenge→attempt A；A terminal/new B后same K + B challenge →409/B confirmation-audit-state零变化；same exact replay只读A；request hash覆盖challenge canonical digest，不再依赖path attemptId。 **Files**: tests/integration/identity-binding-idempotency.test.ts **Acceptance**: historical F-02在新API下仍成立 [REQ:H-01/F-02] [VERIFY:bun run vitest run tests/integration/identity-binding-idempotency.test.ts]
- [ ] T107 — remediation后重跑pure domain suite，包含pairing crypto/env/anti-enum；无DATABASE_URL依赖、无silent skip。 **Files**: tests/domain/** **Acceptance**: all PASS [REQ:Verification Plan] [VERIFY:bun run vitest run tests/domain]
- [ ] T108 — remediation后重跑DB suite，包含context cleanup、RLS runtime-role behavior、concurrency；all PASS。 **Files**: tests/db/** **Acceptance**: all PASS [REQ:H-02/M-02/M-03] [VERIFY:bun run vitest run tests/db]
- [ ] T109 — 运行 integration suite（含 T105 / T106）：bootstrap / case-b / gate1 / attempt-create / candidate / status / confirmer / commit / session / routes / error / audit / anti-enum / invitation / ordinary regression / rollback / no-p2 / idempotency。 **Files**: 测试 **Depends**: T105 / T106 / T058 / T060 / T062 / T064 / T066 / T068 / T070 / T072 / T086 / T088 / T090 / T093 / T094 / T097 / T098 / T100 / T102 **Acceptance**: `bun run vitest run tests/integration` PASS（除 explicit BLOCKED） [REQ:plan D-19.1] [VERIFY:bun run vitest run tests/integration]
- [ ] T110 — concurrency suite重新执行并加入pairing challenge并发与H-02 barrier proofs；successful commit仍0/1。 **Files**: tests/db/identity-binding-concurrency.test.ts + targeted barrier suite **Acceptance**: no double confirmation/commit [REQ:H-01/H-02] [VERIFY:bun run vitest run tests/db/identity-binding-concurrency.test.ts tests/integration/identity-binding-commit-gate2.test.ts]
- [ ] T111 — security/anti-enum suite重新执行：pairingChallenge不是identity proof、pendingContextToken不可代持、invalid challenge统一404、audit/log无raw challenge。 **Files**: security integration suites **Acceptance**: all GREEN [REQ:H-01] [VERIFY:bun run vitest run tests/integration/identity-binding-anti-enumeration.test.ts tests/integration/identity-binding-audit.test.ts tests/integration/identity-binding-confirmer-independent.test.ts tests/integration/identity-binding-confirmer.test.ts]
- [ ] T112 — enhanced contract suite重新冻结：6 paths含/pairing-decision且不含/{attemptId}/decision；candidate AFFIRM pairingChallenge response；challenge error/expiry/single-use descriptions；confirmationVersion matrix；handwritten/runtime/generated semantic equivalence。 **Files**: contract/OpenAPI tests **Acceptance**: exact new HTTP contract GREEN [REQ:H-01/M-05] [VERIFY:bun run vitest run tests/integration/identity-binding-routes.test.ts tests/integration/openapi-semantic-equivalence.test.ts && bun run openapi:check]

---

## Phase 14 — Governance & Full Verification

- [ ] T113 — remediation完成后重新运行typecheck；旧Head结果不得继承。 **Files**: — **Acceptance**: 0 error [REQ:Verification Plan] [VERIFY:node scripts/typecheck-all.mjs]
- [ ] T114 — remediation完成后重新运行static guard；确认pairing未引入KYC/participant/Person INSERT/隐藏auth模式。 **Files**: — **Acceptance**: PASS [REQ:plan D-20] [VERIFY:node scripts/guard-static.mjs]
- [ ] T115 — substantive coverage remediation：required acceptance→stable proof ID→exact executable proof mapping；至少H-01/H-02/M-01—M-04/confirmationVersion/RLS/rollback/MINOR/CaseB。新增coverage gate RED self-test：delete、rename、unexecute、map-to-unrelated四种破坏均必须让coverage:audit non-zero；恢复后GREEN。 **Files**: scripts/coverage-audit.mjs + its regression fixture/test **Acceptance**: file/string existence不能伪PASS [REQ:M-05] [VERIFY:node scripts/coverage-audit.mjs]
- [ ] T116 — remediation后重新运行db:migrate + db:evidence；若H-02需要migration/policy调整，必须证明fresh/upgrade/second-apply、FORCE RLS、runtime role evidence。 **Files**: — **Acceptance**: PASS [REQ:H-02] [VERIFY:node scripts/db-migrate.mjs && node scripts/db-evidence.mjs]
- [ ] T117 — remediation后重新运行governance validators；Docs/005/006 spec diff必须0。 **Files**: — **Acceptance**: governance PASS [REQ:Protected Scope] [VERIFY:node .specify/scripts/validate-governance.mjs && node .specify/scripts/tests/run-governance-tests.mjs]
- [ ] T118 — canonical verify-all provenance：repo root执行 node scripts/verify-all.mjs；运行前记录branch/HEAD/origin-main/clean tracked tree、required env name+presence；记录每个required child exact command+exit；任一non-zero→final non-zero；只有final exit0才PASS。历史失败无法还原则写historical provenance unresolved。 **Files**: verification evidence only unless M-06证明script contract本身需开发修复 **Acceptance**: reproducible provenance [REQ:M-06] [VERIFY:node scripts/verify-all.mjs]
- [ ] T119 — remediation后重新做structure/exclusion audit；new pairing不得扩张KYC/Case/Participant/Evidence/UI/notification或Person creation。 **Files**: — **Acceptance**: prohibited surface 0 match [REQ:plan D-20] [VERIFY:rg -n "INSERT INTO persons|mode=invite|case_participants|assertions|observations|intervention_instances|KYC|face recognition" apps packages db tests]
- [ ] T120 — final scope/provenance audit：最终diff只允许006预期实现/verification文件；Docs/005/006 spec必须0 diff；记录exact final HEAD/origin-main、canonical verify-all exit及working-tree clean。 **Files**: evidence only **Depends**: T118 **Acceptance**: scope + provenance PASS [REQ:M-06] [VERIFY:git status --short && git rev-parse HEAD && git rev-parse origin/main && git diff --stat origin/main...HEAD]

---

## Phase 15 — Blocked by Slice 4 Runtime（late closeout only）

> 本 Phase 只承载真实 production adapter / 真实 Slice 4 integration / full Case C E2E。它 **不阻塞** Phase 1–14；B1 解决后即进入 `READY FOR CORE IMPLEMENTATION`，本 Phase 继续 BLOCKED，直到 Slice 4 runtime available。

- [ ] T121 — **BLOCKED BY SLICE 4 RUNTIME**：实现 production `InvitationResolutionPort` adapter，读取 Slice 4 正式 invitation / participation 事实。不得创建 invitation 表、不得写 participation。 **Files**: `apps/server/api/src/identity-binding/invitation-slice4-adapter.ts`（仅当 Slice 4 runtime 已 merge） **Depends**: Slice 4 runtime merged main **Acceptance**: adapter 实现 port、`bun run typecheck` PASS、`tests/integration/identity-binding-invitation-contract.test.ts` PASS；真实 token resolve 由 T122 验证 [REQ:plan D-16.2 / FR-026] [VERIFY:bun run typecheck && bun run vitest run tests/integration/identity-binding-invitation-contract.test.ts]
- [ ] T122 — **BLOCKED BY SLICE 4 RUNTIME**：真实 invitation token → bootstrap → binding → Slice 4 accept 端到端。 **Files**: `tests/integration/identity-binding-slice4-e2e.test.ts` **Depends**: T121 **Acceptance**: 端到端 PASS；active participation 与 binding 联合断言 [REQ:AS-01 / FR-025 / CHK180] [VERIFY:bun run vitest run tests/integration/identity-binding-slice4-e2e.test.ts]
- [ ] T123 — **BLOCKED BY SLICE 4 RUNTIME**：active participation 与 binding COMMITTED / PENDING / TERMINAL 的联合验收（Case C accept 必须显式）。 **Files**: 同上 **Depends**: T122 **Acceptance**: active participation = 0 for PENDING / TERMINAL；COMMITTED 仍需 accept [REQ:FR-025 / SC-012] [VERIFY:bun run vitest run tests/integration/identity-binding-slice4-e2e.test.ts]
- [ ] T124 — **BLOCKED BY SLICE 4 RUNTIME**：U11 真实微信平台条件下「拒绝 / 撤回 / 过期 / 越权」联合验收。 **Files**: 同上 **Depends**: T123 **Acceptance**: 真实平台证据；否则 `NOT VERIFIED` [REQ:U11 / FR-026] [VERIFY:bun run vitest run tests/integration/identity-binding-slice4-e2e.test.ts]

---

## Dependency Graph（Phase 级）

```text
T001—T006 Dependency Gate
  └─ FAIL → STOP
  └─ T001/T002/T005 PASS → Phase 1–14
Phase 1 Schema/Migration
  └─ Phase 2 Domain
       ├─ Phase 3 Crypto/Context
       ├─ Phase 4 Repositories/Tx/Invitation port
       └─ Phase 5 Authorization
            └─ Phase 6 Bootstrap
                 ├─ Phase 7 Candidate
                 └─ Phase 8 Confirmer（AFFIRM 只写 Phase B confirmation）
                      └─ Phase 9 Commit（Gate 2 + Phase C，含 T086 接入 AFFIRM）
                           └─ Phase 10 Session/Ordinary regression
                                └─ Phase 11 Contracts/Routes/Error
                                     └─ Phase 12 Audit/Anti-enum/RLS
                                          └─ Phase 13 Verification-only tests + suites
                                               └─ Phase 14 Governance/Full verification
Phase 15 late closeout（不 gate Phase 1–14）— 等待 Slice 4 runtime；T121–T124 只能报告 BLOCKED，不得删除或 mock
```

---

## Task Counts（当前 Ultimate remediation truth）

| 类别 | 数量 / 状态 |
|---|---|
| Total tasks | 124（T001—T124） |
| T001—T120 currently checked | 61 |
| T001—T120 reopened by H-01/H-02/M-01—M-06 | 59 |
| T121—T124 | 4，全部 BLOCKED BY SLICE 4 RUNTIME |

不得用旧“94/26/4”数字替代当前checkbox事实。reopened task只有开发完成新的RED→FIX→GREEN及对应proof后才能重新勾选。

**`[P]` 任务（8 个，全部为纯 domain 单元测试，不同文件）**：T018、T020、T022、T024、T027、T029、T041、T045。

**说明**：DB / integration / route / migration / generated contract 任务不标 `[P]`，因为它们共享真实数据库、migration 顺序或 route 文件，不能证明并行安全。
