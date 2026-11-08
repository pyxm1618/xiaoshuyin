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

## Ultimate Audit Remediation Overlay（2026-11-08）

Ultimate Final Independent Re-audit 的 `94 PASS / 26 FAIL / 4 BLOCKED` 已逐项对照真实 task 文本。以下 26 个既有 task 的 acceptance 确实被 F-01—F-08 推翻或证明不足，恢复 unchecked；其余 T001–T120 不重做。F-04 采用现有 pending-list 的 S0/fresh-bootstrap/S1 delta choreography，不改变 6 API shape / pending-list schema，所以不人为重开 T069/T070。

`T013 T036 T037 T039 T050 T055 T056 T059 T060 T065 T066 T068 T073 T074 T080 T081 T085 T091 T092 T097 T101 T103 T104 T106 T112 T115`

Remediation acceptance：
- F-01 → T073/T074/T081：真实 DB barrier race；concurrency-safe Gate2/binding boundary；GREEN=binding 0 / 非 COMMITTED。
- F-02 → T037/T039/T065/T066/T106：hash 含 attemptId；operation.attempt_id authoritative；old key A→B URL=409、B 0 mutation；replay A只读A。
- F-03 → T013/T103/T104：read policies explicit FOR SELECT，commit explicit FOR UPDATE；polcmd + runtime-role SELECT positive / write-negative matrix。
- F-04 → T065/T085：S0 snapshot→recognized candidate fresh bootstrap→S1；仅 exact-one delta 可选；0/>1 fail closed；candidate 不拿 attemptId、不分享 pendingContextToken。
- F-05 → T050/T059/T060/T068/T080：settled attempt 清全部 attempt contexts；blocked/no-attempt 清同 identity 全部 no-attempt decryptable contexts。
- F-06 → T059/T060/T091/T092/T097/T112：AFFIRM required literal；REJECT/CANCEL omit；null always invalid；checker RED→FIX→GREEN。
- F-07 → T036/T055/T056：create/converge 前 old expired PENDING 先 ATTEMPT_EXPIRED + audit once + cleanup，再 new attempt。
- F-08 → T081/T085/T101/T103/T106/T112/T115：rollback matrix、两条 MINOR success E2E、true Case B mismatch、historical replay、RLS negatives、OpenAPI semantics、substantive coverage:audit。

开发纪律：上述 remediation 先新增断言让旧实现 RED，再最小 fix，再 targeted + aggregate GREEN。T121–T124 仍 BLOCKED BY SLICE 4 RUNTIME。

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
- [x] T013 — remediation RLS migration：所有 intended read policies 显式 `FOR SELECT`，`persons_binding_commit_update` 显式 `FOR UPDATE`；不依赖 default ALL，不改既有 policy。 **Files**: 唯一 006 migration **Depends**: T012 **Acceptance**: `pg_policy.polcmd` read=`r` / commit=`w`；runtime role write-negative matrix GREEN [REQ:F-03 / plan D-13.3 / CHK195] [VERIFY:node scripts/db-evidence.mjs && bun run vitest run tests/db/identity-binding-rls.test.ts]
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
- [x] T024 [P] — 写 anti-enumeration serializer RED 测试：bootstrap / decision / status / session 的 generic body key 集合，不含 attempt / person / family / reason。 **Files**: `tests/domain/identity-binding-anti-enumeration.test.ts` **Depends**: T017 **Acceptance**: 预期 RED；对比所有内部 reason 的输出 key 集合 [REQ:FR-019 / SC-007 / CHK105—CHK114] [VERIFY:bun run vitest run tests/domain/identity-binding-anti-enumeration.test.ts]
- [x] T025 — 实现 generic serializer：`candidateBootstrapResponse`、`candidateDecisionResponse`、`candidateStatusResponse`、`candidateSessionResponse`；唯一成功分支 Case B / COMMITTED。 **Files**: `packages/domain/src/identity-binding-anti-enumeration.ts` **Depends**: T024 **Acceptance**: `bun run vitest run tests/domain/identity-binding-anti-enumeration.test.ts` PASS [REQ:plan D-11 / CHK105] [VERIFY:bun run vitest run tests/domain/identity-binding-anti-enumeration.test.ts]
- [x] T026 — 实现 attempt projection / terminal reason mapping：内部 reason → 公开 state / generic；authorized confirmer 投影只含 state。 **Files**: `packages/domain/src/identity-binding.ts` **Depends**: T019 / T023 **Acceptance**: `bun run typecheck` + 上述 domain tests PASS [REQ:FR-013 / FR-019 / plan D-11.2] [VERIFY:bun run typecheck]

---

## Phase 3 — Crypto, Env, Pending Context

- [x] T027 [P] — 写 crypto RED 测试：token 32 bytes、sha256 hash、HKDF 两个 label、AES-GCM nonce/tag、decrypt 失败、无明文 openid。 **Files**: `tests/domain/identity-binding-crypto.test.ts` **Depends**: T017 **Acceptance**: 预期 RED；断言 plan D-3.3 全部性质 [REQ:plan D-3.3 / CHK052—CHK054] [VERIFY:bun run vitest run tests/domain/identity-binding-crypto.test.ts]
- [x] T028 — 实现 `identity-binding-crypto.ts`：`createContextToken`、`hashToken`、`deriveIdentityDigest`、`encryptOpenid`、`decryptOpenid`；只使用 `node:crypto`。 **Files**: `apps/server/api/src/identity-binding/crypto.ts` **Depends**: T027 **Acceptance**: `bun run vitest run tests/domain/identity-binding-crypto.test.ts` PASS [REQ:plan D-3.3 / CHK054] [VERIFY:bun run vitest run tests/domain/identity-binding-crypto.test.ts]
- [x] T029 [P] — 写 env schema RED 测试：`IDENTITY_BINDING_SECRET` >=32、两个 TTL required positive、无 default。 **Files**: `tests/domain/identity-binding-env.test.ts` **Depends**: T017 **Acceptance**: 预期 RED；缺失 / 非法 → parse fail [REQ:plan D-3.3 / CHK055] [VERIFY:bun run vitest run tests/domain/identity-binding-env.test.ts]
- [x] T030 — 扩展 `packages/contracts/src/env.ts`：新增 3 个 required env；更新 `.env.example`（若仓库存在）。 **Files**: `packages/contracts/src/env.ts`、`.env.example` **Depends**: T029 **Acceptance**: `bun run vitest run tests/domain/identity-binding-env.test.ts` PASS [REQ:plan D-3.3] [VERIFY:bun run vitest run tests/domain/identity-binding-env.test.ts]
- [x] T031 — 写 pending context repository RED 测试（DB）：insert / load by token hash / link attempt / clear ciphertext / expiry / replay。 **Files**: `tests/db/identity-binding-context.test.ts` **Depends**: T016 / T028 **Acceptance**: 预期 RED；表行为与 plan D-3 一致 [REQ:plan D-3.2 / CHK056 / CHK060] [VERIFY:bun run vitest run tests/db/identity-binding-context.test.ts]
- [x] T032 — 实现 pending context repository：`create`、`findByTokenHash`、`linkAttempt`、`markCommitted`、`clearOpenid`、`materializeExpiry`。 **Files**: `apps/server/api/src/identity-binding/pending-context-repository.ts` **Depends**: T031 **Acceptance**: `bun run vitest run tests/db/identity-binding-context.test.ts` PASS [REQ:plan D-3.2 / D-14] [VERIFY:bun run vitest run tests/db/identity-binding-context.test.ts]

---

## Phase 4 — Repositories, RLS Context, Invitation Port

- [x] T033 — 写 tx wrapper RED 测试（DB）：5 个 binding wrapper 设置正确 GUC / purpose；commit context 设置 `app.account_id=actorAccountId` 与 `app.binding_commit_account_id`；普通 wrapper 行为不变。 **Files**: `tests/db/identity-binding-tx.test.ts` **Depends**: T016 **Acceptance**: 预期 RED；GUC 值 / purpose 逐项断言 [REQ:plan D-13.4 / CHK127] [VERIFY:bun run vitest run tests/db/identity-binding-tx.test.ts]
- [x] T034 — 扩展 `apps/server/api/src/db/tx.ts`：`withBindingContextTransaction`、`withBindingBootstrapTransaction`、`withBindingTargetTransaction`、`withBindingGateTransaction`、`withBindingCommitTransaction`、`withBindingAttemptTransaction`；bootstrap 在 invitation resolve 后调用 `app.set_binding_gate_context` 设置 target GUC（同一事务）；`withBindingTargetTransaction` 只设 target-person GUC 以解析 P1 唯一 Family；Gate / Commit wrapper 接受可选 `candidateAccountId` 并调用 `app.set_binding_candidate_account_id`（只用于 candidate-account read policy，不复用 `app.account_id`）。 **Files**: `apps/server/api/src/db/tx.ts` **Depends**: T033 **Acceptance**: `bun run vitest run tests/db/identity-binding-tx.test.ts` PASS [REQ:plan D-13.4] [VERIFY:bun run vitest run tests/db/identity-binding-tx.test.ts]
- [x] T035 — 写 attempt repository RED 测试（DB）：create / find live by triple / find by id / settle / expire / new attempt after terminal。 **Files**: `tests/db/identity-binding-attempt-repository.test.ts` **Depends**: T034 **Acceptance**: 预期 RED；partial unique 冲突 / new attempt 行为正确 [REQ:plan D-2 / D-7 / CHK044—CHK045] [VERIFY:bun run vitest run tests/db/identity-binding-attempt-repository.test.ts]
- [x] T036 — remediation attempt repository：create/converge same triple 前先 materialize existing expired PENDING；expired row 不得再作为 live convergence target。 **Files**: `apps/server/api/src/identity-binding/attempt-repository.ts` **Depends**: T035 **Acceptance**: old expired row 先退出 live state；repository 提供 authoritative transition result 供 bootstrap 做 exactly-once audit/cleanup [REQ:F-07 / plan D-2.2 / D-14 / CHK197] [VERIFY:bun run vitest run tests/db/identity-binding-attempt-repository.test.ts]
- [x] T037 — 扩展 cross-attempt confirmation RED：A 的 confirmations 永远只满足 A；A terminal 后 B 只能有 B 自身新 confirmation；historical operation replay 不得复制/重用 A confirmation。 **Files**: `tests/db/identity-binding-confirmation-repository.test.ts` **Depends**: T034 **Acceptance**: A/B `attempt_id` 严格隔离 [REQ:F-02 / plan D-4 / D-5.4 / CHK194] [VERIFY:bun run vitest run tests/db/identity-binding-confirmation-repository.test.ts]
- [x] T038 — 实现 confirmation repository：`appendCandidate`、`appendSecondParty`、`listByAttempt`；不提供 update / delete。 **Files**: `apps/server/api/src/identity-binding/confirmation-repository.ts` **Depends**: T037 **Acceptance**: `bun run vitest run tests/db/identity-binding-confirmation-repository.test.ts` PASS [REQ:plan D-4] [VERIFY:bun run vitest run tests/db/identity-binding-confirmation-repository.test.ts]
- [x] T039 — operation-key RED：SECOND_PARTY operation 首绑 attempt A 后不可 remap；canonical request identity 含 path attemptId；same key A→B mismatch，same-key replay A 仍解析 A。 **Files**: `tests/db/identity-binding-operation-key-repository.test.ts` **Depends**: T034 **Acceptance**: `operation.attempt_id` authoritative / immutable [REQ:F-02 / plan D-5.4 / CHK194] [VERIFY:bun run vitest run tests/db/identity-binding-operation-key-repository.test.ts]
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

- [x] T049 — 写 bootstrap RED 测试：WeChat auth → invitation resolve → Case B / C → Gate 1 → context / attempt；Case B match 不建 attempt；Gate 1 fail 不建 attempt；candidate Account 已绑 P2 → Gate 1 `IDENTITY_CONFLICT`；bootstrap replay PENDING / COMMITTED / TERMINAL 均读取 authoritative attempt，COMMITTED 返回 `{ binding:"COMMITTED" }`，不重复 attempt / confirmation / commit / 业务 audit。 **Files**: `tests/integration/identity-binding-bootstrap.test.ts` **Depends**: T042 / T046 / T048 **Acceptance**: 预期 RED；分支逐项断言；无 Account / Person 创建 [REQ:FR-001—FR-007 / AS-01 / AS-06 / AS-08 / AS-09 / AS-20] [VERIFY:bun run vitest run tests/integration/identity-binding-bootstrap.test.ts]
- [x] T050 — bootstrap cleanup remediation：authorize DENY / invalid invitation / Case B mismatch / Gate1 fail 返回前 scrub 同 identity 全部 `attempt_id IS NULL` decryptable contexts；合法 PENDING attempt contexts 不误清。 **Files**: `bootstrap.ts` + pending-context repository **Depends**: T049 **Acceptance**: invalid-invitation same-key 多次 replay 后 no-attempt decryptable count=0 [REQ:F-05 / plan D-3.3 / CHK196] [VERIFY:bun run vitest run tests/integration/identity-binding-bootstrap.test.ts tests/db/identity-binding-context.test.ts]
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

- [x] T059 — candidate RED：AFFIRM version required literal；AFFIRM omitted/null/wrong→422；REJECT/CANCEL omitted→valid，null/任何 present version→422；REJECT/CANCEL/expiry 后 attempt 全 contexts secret null。 **Files**: `tests/integration/identity-binding-candidate.test.ts` **Depends**: T050 / T036 / T038 / T040 **Acceptance**: decision×version + multi-context cleanup RED→GREEN [REQ:F-05 / F-06 / CHK196 / CHK198] [VERIFY:bun run vitest run tests/integration/identity-binding-candidate.test.ts]
- [x] T060 — candidate orchestration remediation：执行 F-06 version contract；REJECT/CANCEL/expiry settled 时 scrub attempt 全 contexts，不只当前 context；保持 generic response / invitation 不变。 **Files**: `candidate-decision.ts` + context repository **Depends**: T059 **Acceptance**: T059 GREEN [REQ:F-05 / F-06] [VERIFY:bun run vitest run tests/integration/identity-binding-candidate.test.ts]
- [x] T061 — 写 candidate status RED 测试：未 committed → generic；committed → COMMITTED；无 attempt / terminal → generic；无 attempt id / reason。 **Files**: `tests/integration/identity-binding-status.test.ts` **Depends**: T050 **Acceptance**: 预期 RED；response key 集合断言 [REQ:FR-019 / plan D-11.1] [VERIFY:bun run vitest run tests/integration/identity-binding-status.test.ts]
- [x] T062 — 实现 status orchestration + route。 **Files**: `apps/server/api/src/identity-binding/candidate-status.ts`、`apps/server/api/src/routes/identity-bindings.ts` **Depends**: T061 **Acceptance**: `bun run vitest run tests/integration/identity-binding-status.test.ts` PASS [REQ:plan D-10.2] [VERIFY:bun run vitest run tests/integration/identity-binding-status.test.ts]
- [x] T063 — 写 candidate route auth RED 测试：`X-Binding-Context` 接受；Bearer 拒绝；无 header 401；candidate 不能调用 confirmer 路由。 **Files**: `tests/integration/identity-binding-candidate-auth.test.ts` **Depends**: T062 **Acceptance**: 预期 RED；status / decision 路由 auth 行为断言 [REQ:FR-024 / plan D-10.4 / CHK121] [VERIFY:bun run vitest run tests/integration/identity-binding-candidate-auth.test.ts]
- [x] T064 — 实现 candidate preHandler / auth plugin exemption；普通 Bearer 不进入 binding 路由。 **Files**: `apps/server/api/src/plugins/auth.ts`、`apps/server/api/src/routes/identity-bindings.ts` **Depends**: T063 **Acceptance**: `bun run vitest run tests/integration/identity-binding-candidate-auth.test.ts` PASS [REQ:plan D-10.4] [VERIFY:bun run vitest run tests/integration/identity-binding-candidate-auth.test.ts]

---

## Phase 8 — Confirmer Runtime

- [x] T065 — confirmer RED：保留 authority matrix；新增 historical old-key A→new B 409/B零mutation；验证 candidate token 不能代持/分享；pairing selector 只能来自 F-04 exact delta。 **Files**: `tests/integration/identity-binding-confirmer.test.ts` **Depends**: T048 / T050 **Acceptance**: old-key exploit 先 RED；no cross-attempt confirmation [REQ:F-02 / F-04 / CHK191 / CHK192 / CHK194] [VERIFY:bun run vitest run tests/integration/identity-binding-confirmer.test.ts]
- [x] T066 — confirmer fix：SECOND_PARTY request hash 含 attemptId；existing `operation.attempt_id` authoritative；old key A→B 409 before any B mutation；same-key replay A only A。 **Files**: `confirmer.ts` + operation-key/domain hashing **Depends**: T065 **Acceptance**: T065/T106 GREEN [REQ:F-02 / plan D-5.4] [VERIFY:bun run vitest run tests/integration/identity-binding-confirmer.test.ts tests/integration/identity-binding-idempotency.test.ts]
- [x] T067 — 写 confirmer rejected / unable-to-recognize RED 测试：REJECT 不 commit、invitation 不变、无 partial binding、无 P2；**已 affirmative 后再 REJECT → 409，attempt / confirmation 不变**。 **Files**: `tests/integration/identity-binding-confirmer-reject.test.ts` **Depends**: T066 **Acceptance**: 预期 RED；attempt TERMINAL；0 account / 0 person increment；affirm 后 reject 无状态改变 [REQ:AS-05 / CHK069] [VERIFY:bun run vitest run tests/integration/identity-binding-confirmer-reject.test.ts]
- [x] T068 — confirmer REJECT / expiry terminal remediation：任何本路径 settled TERMINAL scrub attempt 全部 contexts secret，保留 non-secret history / audit。 **Files**: `confirmer.ts` + context repository **Depends**: T067 **Acceptance**: multi-context terminal ciphertext/nonce/tag 全 null [REQ:F-05 / CHK196] [VERIFY:bun run vitest run tests/integration/identity-binding-confirmer-reject.test.ts]
- [x] T069 — 写 confirmer list 最小字段 / 404 generic RED 测试：未授权 / P1 不存在 / 非目标 Family 同一 404；无 P1 细节；`state='PENDING' AND expires_at > now()` 过滤，过期 attempt 不出现。 **Files**: `tests/integration/identity-binding-confirmer-list.test.ts` **Depends**: T066 **Acceptance**: 预期 RED；body key / status 断言 [REQ:FR-019 / plan D-9.2 / D-11.2] [VERIFY:bun run vitest run tests/integration/identity-binding-confirmer-list.test.ts]
- [x] T070 — 实现 confirmer list repository + route + generic 404；targetFamilyId 由服务端读取 P1 唯一 `family_members` 行（多行 / 无行 → 404 generic）；查询必须带 `state='PENDING' AND expires_at > now()`，过期 attempt 可条件物化 TERMINAL + audit。 **Files**: `apps/server/api/src/identity-binding/confirmer.ts`、`routes/identity-bindings.ts` **Depends**: T069 **Acceptance**: `bun run vitest run tests/integration/identity-binding-confirmer-list.test.ts` PASS [REQ:plan D-9.2 / D-14] [VERIFY:bun run vitest run tests/integration/identity-binding-confirmer-list.test.ts]
- [x] T071 — 写 confirmer 独立认证 RED 测试：candidate 会话 / `X-Binding-Context` 不能调用 confirmer decision；confirmer 不能复用 candidate token。 **Files**: `tests/integration/identity-binding-confirmer-independent.test.ts` **Depends**: T070 **Acceptance**: 预期 RED；401 / 404 断言 [REQ:plan D-9.3 / CHK121] [VERIFY:bun run vitest run tests/integration/identity-binding-confirmer-independent.test.ts]
- [x] T072 — 实现 confirmer route auth：只接受 Bearer；显式拒绝 `X-Binding-Context`。 **Files**: `apps/server/api/src/plugins/auth.ts`、`routes/identity-bindings.ts` **Depends**: T071 **Acceptance**: `bun run vitest run tests/integration/identity-binding-confirmer-independent.test.ts` PASS [REQ:plan D-10.4] [VERIFY:bun run vitest run tests/integration/identity-binding-confirmer-independent.test.ts]

---

## Phase 9 — Gate 2 & Phase C Commit

- [x] T073 — Gate2 concurrency RED：两个 DB connection/barrier 制造 Gate2 read/PASS → concurrent guardian consent revoke commit → binding resumes。 **Files**: `tests/integration/identity-binding-commit-gate2.test.ts` **Depends**: T066 / T036 / T044 **Acceptance**: 旧实现 race RED；期望 binding=0、P1 unbound、attempt非COMMITTED [REQ:F-01 / CHK193] [VERIFY:bun run vitest run tests/integration/identity-binding-commit-gate2.test.ts]
- [x] T074 — commit fix：建立 Gate2 authoritative facts 与 binding mutation 的 concurrency-safe consistency boundary；不预设具体锁序，但禁止 stale PASS。 **Files**: `commit.ts` +必要 repository/tx helper **Depends**: T073 **Acceptance**: invalidating change 在线性化点前 commit → binding=0；T073 GREEN [REQ:F-01 / plan D-8.4] [VERIFY:bun run vitest run tests/integration/identity-binding-commit-gate2.test.ts]
- [x] T075 — 写 Account create / reuse RED 测试：无 Account → create；existing unbound → reuse；existing bound P1 → historical COMMITTED / conflict；existing bound P2 → TERMINAL。 **Files**: `tests/integration/identity-binding-account.test.ts` **Depends**: T074 **Acceptance**: 预期 RED；Account / Person 计数与 binding 断言 [REQ:FR-011 / AS-21 / CHK107—CHK110] [VERIFY:bun run vitest run tests/integration/identity-binding-account.test.ts]
- [x] T076 — 实现 Account create / reuse + conflict 分支；不 INSERT Person。 **Files**: `apps/server/api/src/identity-binding/commit.ts` **Depends**: T075 **Acceptance**: `bun run vitest run tests/integration/identity-binding-account.test.ts` PASS [REQ:plan D-6.3] [VERIFY:bun run vitest run tests/integration/identity-binding-account.test.ts]
- [x] T077 — 写 P1 conditional update RED 测试（DB）：rowCount 1 / 0、并发 P1、已绑定 P1、Person account unique。 **Files**: `tests/db/identity-binding-p1-commit.test.ts` **Depends**: T074 **Acceptance**: 预期 RED；rowCount / unique violation / TERMINAL 断言 [REQ:FR-011 / FR-017 / SC-005] [VERIFY:bun run vitest run tests/db/identity-binding-p1-commit.test.ts]
- [x] T078 — 实现 P1 conditional update + rowCount 判定 + concurrency loser terminal。 **Files**: `apps/server/api/src/identity-binding/commit.ts` **Depends**: T077 **Acceptance**: `bun run vitest run tests/db/identity-binding-p1-commit.test.ts` PASS [REQ:plan D-6.4 / D-7] [VERIFY:bun run vitest run tests/db/identity-binding-p1-commit.test.ts]
- [x] T079 — 写 attempt settle / audit RED 测试（DB）：COMMITTED 与 TERMINAL 各一次、replay 不改、audit 同事务。 **Files**: `tests/integration/identity-binding-commit-settle.test.ts` **Depends**: T074 / T044 **Acceptance**: 预期 RED；state / settled_at / audit 行数断言 [REQ:FR-013 / FR-023 / AS-15] [VERIFY:bun run vitest run tests/integration/identity-binding-commit-settle.test.ts]
- [x] T080 — settle cleanup remediation：COMMITTED / 任意 TERMINAL 与 audit 同 consistency boundary scrub `attempt_id=$attempt` 的全部 decryptable contexts；cleanup失败整体rollback。 **Files**: `commit.ts` + context/audit repositories **Depends**: T079 **Acceptance**: multi-context replay 后全部 secret null [REQ:F-05 / CHK196] [VERIFY:bun run vitest run tests/integration/identity-binding-commit-settle.test.ts]
- [x] T081 — rollback RED matrix：Gate2 recheck / Account / Person update / attempt settle / all-context cleanup / audit 任一点失败均全回滚，无 orphan Account / partial binding / false settled。 **Files**: `tests/integration/identity-binding-rollback.test.ts` **Depends**: T080 **Acceptance**: 每注入点独立对象计数/状态断言 [REQ:F-08 / CHK200] [VERIFY:bun run vitest run tests/integration/identity-binding-rollback.test.ts]
- [x] T082 — 实现事务错误分类：业务失败 → terminal + audit；基础设施失败 → RETRYABLE + best-effort audit；确保回滚。 **Files**: `apps/server/api/src/identity-binding/commit.ts`、`errors.ts` **Depends**: T081 **Acceptance**: `bun run vitest run tests/integration/identity-binding-rollback.test.ts` PASS [REQ:plan D-14] [VERIFY:bun run vitest run tests/integration/identity-binding-rollback.test.ts]
- [x] T083 — 写并发 commit RED 测试（DB）：同一 P1 多 attempt、同一 Account 多 P1、double confirmation、commit vs retry、全失败 0 commit。 **Files**: `tests/db/identity-binding-concurrency.test.ts` **Depends**: T078 / T080 **Acceptance**: 预期 RED；successful commits ∈ {0,1}；binding increase ≤ 1；Person increment 0 [REQ:FR-016 / FR-017 / SC-005 / AS-10] [VERIFY:bun run vitest run tests/db/identity-binding-concurrency.test.ts]
- [x] T084 — 实现并发收敛补齐：unique violation / rowCount 0 → 读取 authoritative state → terminal / replay；不引入第二套锁。 **Files**: `apps/server/api/src/identity-binding/commit.ts` **Depends**: T083 **Acceptance**: `bun run vitest run tests/db/identity-binding-concurrency.test.ts` PASS [REQ:plan D-7] [VERIFY:bun run vitest run tests/db/identity-binding-concurrency.test.ts]
- [x] T085 — success / pairing E2E RED：① MINOR_14_17+guardian→guardian confirmer COMMITTED；② MINOR_14_17 no guardian→Family manager COMMITTED；③ F-04 S0→recognized candidate fresh bootstrap→S1 exact-one delta→candidate AFFIRM+confirmer same attempt；delta 0/>1不得decision。 **Files**: `tests/integration/identity-binding-commit.test.ts` **Depends**: T084 / T070 **Acceptance**: 三条真实 integration GREEN；candidate无attemptId，confirmer无candidate token [REQ:F-04 / F-08 / CHK191 / CHK192 / CHK200] [VERIFY:bun run vitest run tests/integration/identity-binding-commit.test.ts]
- [x] T086 — 接入 confirmer AFFIRM → commit：事务 A 已提交 second-party confirmation；事务 B 执行 D-6.1 commit。commit 基础设施失败时 confirmation 保留并返回 RETRYABLE；不 double commit。 **Files**: `apps/server/api/src/identity-binding/confirmer.ts`、`commit.ts` **Depends**: T085 / T066 **Acceptance**: `bun run vitest run tests/integration/identity-binding-commit.test.ts` PASS；AFFIRM → COMMITTED；失败重试 → 不 double commit [REQ:plan D-14 / FR-014 / AS-13] [VERIFY:bun run vitest run tests/integration/identity-binding-commit.test.ts]

---

## Phase 10 — Session Exchange & Ordinary Identity Bridge

- [x] T087 — 写 session exchange RED 测试：COMMITTED → session；未 committed → generic；无 Account / Person 创建；不 bump epoch。 **Files**: `tests/integration/identity-binding-session.test.ts` **Depends**: T086 **Acceptance**: 预期 RED；response / 对象计数 / epoch 断言 [REQ:FR-011 / AS-01 / CHK157] [VERIFY:bun run vitest run tests/integration/identity-binding-session.test.ts]
- [x] T088 — 实现 `session-exchange.ts` + route；读取 committed account / P1 / epoch，签发普通 session。 **Files**: `apps/server/api/src/identity-binding/session-exchange.ts`、`routes/identity-bindings.ts` **Depends**: T087 **Acceptance**: `bun run vitest run tests/integration/identity-binding-session.test.ts` PASS [REQ:plan D-10.2] [VERIFY:bun run vitest run tests/integration/identity-binding-session.test.ts]
- [x] T089 — 写 ordinary login regression RED 测试：`POST /auth/wechat` new openid → Account + Person；existing → reuse；无 `mode` / `inviteMode` / `binding` / hidden query / 特殊 header。 **Files**: `tests/integration/identity-binding-ordinary-login-regression.test.ts` **Depends**: T032 **Acceptance**: 预期 RED；与基线输出一致；无 P2 [REQ:FR-001 / SC-013 / CHK159] [VERIFY:bun run vitest run tests/integration/identity-binding-ordinary-login-regression.test.ts]
- [x] T090 — 运行 ordinary login regression；若因 auth plugin exemption 引入回归，修复 plugin 边界，不改登录事务。 **Files**: `plugins/auth.ts`、`routes/auth.ts` **Depends**: T089 **Acceptance**: `bun run vitest run tests/integration/identity-binding-ordinary-login-regression.test.ts` + `tests/integration/auth.test.ts` PASS [REQ:plan D-17.1] [VERIFY:bun run vitest run tests/integration/identity-binding-ordinary-login-regression.test.ts]

---

## Phase 11 — Contracts, Routes, Error Envelope

- [x] T091 — runtime Zod remediation：strict decision-discriminated union；AFFIRM requires literal；REJECT/CANCEL schema 不声明 `confirmationVersion`，因此 present/null 均 422。 **Files**: `identity-binding-schemas.ts` **Depends**: T017 / T058 / T059 **Acceptance**: T059 version matrix + typecheck GREEN [REQ:F-06 / CHK198] [VERIFY:bun run typecheck && bun run vitest run tests/integration/identity-binding-candidate.test.ts]
- [x] T092 — 核验本轮已修 handwritten OpenAPI：candidate-decision 为三个 strict `oneOf` branches；无 nullable+const；6 routes 不变。 **Files**: handwritten OpenAPI **Depends**: T091 **Acceptance**: YAML parse + semantic fixture GREEN [REQ:F-06 / CHK198] [VERIFY:ruby -ryaml -e "YAML.load_file(%q{specs/006-identity-binding-runtime/contracts/identity-binding-api.openapi.yaml})"]
- [x] T093 — 写 route enumeration / no participant route RED 测试：恰好 6 条 binding route；无 `/participations` / `/cases` / `/evidence` / `/interventions`。 **Files**: `tests/integration/identity-binding-routes.test.ts` **Depends**: T092 **Acceptance**: 预期 RED；`fastify.printRoutes()` 或 OpenAPI path 断言 [REQ:plan D-20 / CHK153 / CHK186] [VERIFY:bun run vitest run tests/integration/identity-binding-routes.test.ts]
- [x] T094 — 实现 6 条 route 注册到 `app.ts`；确认无 participant / Case / Evidence / UI 路由。 **Files**: `apps/server/api/src/app.ts`、`routes/identity-bindings.ts` **Depends**: T058 / T062 / T066 / T070 / T072 / T088 / T093 **Acceptance**: `bun run vitest run tests/integration/identity-binding-routes.test.ts` PASS；恰好 6 条 [REQ:plan D-10.1 / CHK153] [VERIFY:bun run vitest run tests/integration/identity-binding-routes.test.ts]
- [x] T095 — 写 error envelope / validation RED 测试：AFFIRM 缺字段 → 422；candidate generic 不出现新 code；confirmer 404 统一；**bootstrap 的 `authorize()` DENY → 200 generic（冻结 bootstrap response shape），不得 401 `WECHAT_AUTH_FAILED`**；`WECHAT_AUTH_FAILED` 只在真实 `code2session` 失败出现。 **Files**: `tests/integration/identity-binding-error-envelope.test.ts` **Depends**: T094 **Acceptance**: 预期 RED；status / body 断言；authorization denial 与 WeChat auth failure 可区分 [REQ:plan D-10.3 / D-11.1] [VERIFY:bun run vitest run tests/integration/identity-binding-error-envelope.test.ts]
- [x] T096 — 实现 `error-handler.ts` 扩展：`BINDING_CONTEXT_INVALID`、`BINDING_NOT_FOUND`、`BINDING_STATE_CONFLICT`；`WECHAT_AUTH_FAILED` 保留但**只**用于真实 WeChat `code2session` 失败；`IDENTITY_BINDING_BOOTSTRAP` 的 authorize DENY 走 200 generic（不新增 candidate-facing authorization error code）；错误体无 P1 细节。 **Files**: `apps/server/api/src/plugins/error-handler.ts`、`apps/server/api/src/identity-binding/bootstrap.ts`、`apps/server/api/src/identity-binding/errors.ts` **Depends**: T095 **Acceptance**: `bun run vitest run tests/integration/identity-binding-error-envelope.test.ts` PASS [REQ:plan D-10.3 / D-11.1 / CHK158] [VERIFY:bun run vitest run tests/integration/identity-binding-error-envelope.test.ts]
- [x] T097 — OpenAPI checker RED→FIX→GREEN：先 fixture 证明 nullable+const 与 true union / decision union 不等价、旧 checker RED；最小修 normalizer；再 generate generated artifacts（禁止hand-edit）+ openapi:check GREEN。 **Files**: `scripts/openapi-check.mjs` + semantic regression test/fixture + generated **Depends**: T091 / T092 / T094 **Acceptance**: bad semantic fixture 必须被拒绝 [REQ:F-06 / CHK199] [VERIFY:bun run vitest run tests/integration/openapi-semantic-equivalence.test.ts && bun run openapi:check]
- [x] T098 — 写 contract-level invitation seam 测试：VALID / TERMINAL_UNUSABLE、真实 adapter 不存在时标记 BLOCKED，不 fake invitation 表。 **Files**: `tests/integration/identity-binding-invitation-contract.test.ts` **Depends**: T042 / T094 **Acceptance**: port 分支断言 PASS；无第二套 invitation 模型 [REQ:plan D-16 / CHK143—CHK148] [VERIFY:bun run vitest run tests/integration/identity-binding-invitation-contract.test.ts]

---

## Phase 12 — Audit, Anti-Enumeration, RLS Hardening

- [x] T099 — 写 audit outcome RED 测试：COMMITTED / PENDING / TERMINAL / RETRYABLE 可追溯；RETRYABLE 使用独立 `event_type='BINDING_OPERATION_RETRYABLE'` 且 attempt state 不变；无 token / openid / ciphertext / consent 原文；不为 audit 创建 Person / Account；Gate 1 阻断 / Case B mismatch / invalid invitation 的 audit 无 target_person / target_family / invitation id。 **Files**: `tests/integration/identity-binding-audit.test.ts` **Depends**: T086 / T044 **Acceptance**: 预期 RED；每个 outcome 至少 1 条 audit；secret 扫描 = 0；Phase A 阻断 audit 无 P1 关联 [REQ:FR-023 / SC-011 / AS-24 / CHK135—CHK142] [VERIFY:bun run vitest run tests/integration/identity-binding-audit.test.ts]
- [x] T100 — 实现 audit 写入点补齐：bootstrap authenticated / Gate1 blocked / attempt created / candidate confirmed / candidate rejected / second-party confirmed / committed / terminal / operation retryable（`BINDING_OPERATION_RETRYABLE`，不改变 attempt state）；Phase A 阻断分支不得写 target person / family / invitation id。 **Files**: `bootstrap.ts`、`candidate-decision.ts`、`confirmer.ts`、`commit.ts`、`audit-repository.ts` **Depends**: T099 **Acceptance**: `bun run vitest run tests/integration/identity-binding-audit.test.ts` PASS [REQ:plan D-15.2] [VERIFY:bun run vitest run tests/integration/identity-binding-audit.test.ts]
- [x] T101 — anti-enum RED 使用 true Case B mismatch：P1已绑定 Account A，candidate认证为different identity/Account B；与其它 generic matrix 逐字段/status/header/read-back 比较。 **Files**: `tests/integration/identity-binding-anti-enumeration.test.ts` **Depends**: T094 / T025 **Acceptance**: 确实进入 Case-B wrong-account 分支且无 observable 差异 [REQ:F-08 / CHK200] [VERIFY:bun run vitest run tests/integration/identity-binding-anti-enumeration.test.ts]
- [x] T102 — 修复任何 response 差异：统一 serializer、固定字段、按 D-11.3 的两条 normalized pipeline 组织（invitation 可解析 → 真实 Gate 1；不可解析 → pre-attempt blocked classification + audit + 同一 serializer）；禁止提前 return；不 fake query 不存在的 P1；不引入人为延迟。 **Files**: `identity-binding/anti-enumeration.ts`、`identity-binding/bootstrap.ts`、`routes/identity-bindings.ts` **Depends**: T101 **Acceptance**: `bun run vitest run tests/integration/identity-binding-anti-enumeration.test.ts` PASS [REQ:plan D-11.3] [VERIFY:bun run vitest run tests/integration/identity-binding-anti-enumeration.test.ts]
- [x] T103 — RLS RED：检查 `pg_policy.polcmd`；真实 `xiaoshuyin_app` + GATE/exact GUC SELECT positive，UPDATE/INSERT/DELETE negative；仅 COMMIT exact update 可 bind。 **Files**: `tests/db/identity-binding-rls.test.ts` **Depends**: T016 / T034 **Acceptance**: 旧 default-ALL 被打红，修复后 matrix GREEN [REQ:F-03 / CHK195] [VERIFY:bun run vitest run tests/db/identity-binding-rls.test.ts]
- [x] T104 — RLS fix：当前006 migration未merge，按single-migration规则 fold 回唯一006 migration；read `FOR SELECT`、commit `FOR UPDATE`；不新增第二 migration、不关闭RLS。 **Files**: 唯一006 migration **Depends**: T103 **Acceptance**: T103 + fresh/upgrade/second-apply evidence GREEN，006 migration count=1 [REQ:F-03 / plan D-18.1] [VERIFY:bun run vitest run tests/db/identity-binding-rls.test.ts && node scripts/db-evidence.mjs]

---

## Phase 13 — Verification-Only Tests & Test Suites

- [x] T105 — 写并运行 no-P2 / object-count 测试：ordinary-login-first、bootstrap replay、concurrent、retry、rollback、invitation terminal；`persons` increment = 0、P2 = 0、partial binding = 0、session = 0、authz = 0、participant = 0。 **Files**: `tests/integration/identity-binding-no-p2.test.ts` **Depends**: T081 / T083 / T086 **Acceptance**: 新测试先于 aggregate run 创建并 PASS [REQ:FR-016 / FR-021 / SC-004 / SC-008 / CHK174] [VERIFY:bun run vitest run tests/integration/identity-binding-no-p2.test.ts]
- [x] T106 — idempotency matrix 加 historical confirmer replay：K on A→A terminal→new B→K对B URL=409/B confirmation-audit-state零变化；same-request replay A只A；hash含attemptId。 **Files**: idempotency integration test **Depends**: T039 / T060 / T066 / T086 **Acceptance**: exploit RED→GREEN [REQ:F-02 / F-08 / CHK194 / CHK200] [VERIFY:bun run vitest run tests/integration/identity-binding-idempotency.test.ts]
- [x] T107 — 运行 domain suite（纯 domain / unit）：state / gate / idempotency / crypto / env / anti-enum / authz / invitation-port；**不含 DB-backed facts builder**。 **Files**: `tests/domain/**` **Depends**: T019 / T021 / T023 / T025 / T028 / T030 / T042 / T046 **Acceptance**: `bun run vitest run tests/domain` PASS，且 MUST 在无 `DATABASE_URL` / 无真实 PostgreSQL 环境下可执行；MUST NOT 依赖 DB 凭据、MUST NOT silent skip [REQ:plan D-19.1 / CHK169] [VERIFY:bun run vitest run tests/domain]
- [x] T108 — 运行 DB suite：schema / tx / context / attempt / confirmation / operation key / audit / facts / p1 commit / concurrency / rls。 **Files**: `tests/db/**` **Depends**: T016 / T032 / T034 / T036 / T038 / T040 / T044 / T048 / T078 / T084 / T104 **Acceptance**: `bun run vitest run tests/db` PASS [REQ:plan D-19.1] [VERIFY:bun run vitest run tests/db]
- [x] T109 — 运行 integration suite（含 T105 / T106）：bootstrap / case-b / gate1 / attempt-create / candidate / status / confirmer / commit / session / routes / error / audit / anti-enum / invitation / ordinary regression / rollback / no-p2 / idempotency。 **Files**: 测试 **Depends**: T105 / T106 / T058 / T060 / T062 / T064 / T066 / T068 / T070 / T072 / T086 / T088 / T090 / T093 / T094 / T097 / T098 / T100 / T102 **Acceptance**: `bun run vitest run tests/integration` PASS（除 explicit BLOCKED） [REQ:plan D-19.1] [VERIFY:bun run vitest run tests/integration]
- [x] T110 — 运行 concurrency suite：同 P1 / 同 Account / 双确认 / commit vs retry / 全失败 0 commit。 **Files**: `tests/db/identity-binding-concurrency.test.ts` **Depends**: T108 **Acceptance**: 全 PASS；0/1 commit [REQ:FR-017 / SC-005 / CHK175] [VERIFY:bun run vitest run tests/db/identity-binding-concurrency.test.ts]
- [x] T111 — 运行 security / anti-enum suite：6 类内部原因、confirmer 最小可见、candidate token 不能代持、audit 无 secret。 **Files**: `tests/integration/identity-binding-anti-enumeration.test.ts`、`tests/integration/identity-binding-audit.test.ts`、`tests/integration/identity-binding-confirmer-independent.test.ts` **Depends**: T101 / T099 / T071 **Acceptance**: 全 PASS [REQ:FR-019 / AS-17 / AS-24 / CHK177] [VERIFY:bun run vitest run tests/integration/identity-binding-anti-enumeration.test.ts tests/integration/identity-binding-audit.test.ts tests/integration/identity-binding-confirmer-independent.test.ts]
- [x] T112 — enhanced contract suite：6 paths；F-06 decision/version matrix；checker semantic negative fixture必须FAIL、真实 frozen/generated 必须PASS；无 participant route。 **Files**: contract tests/OpenAPI/checker **Depends**: T092 / T093 / T097 **Acceptance**: real JSON Schema semantic equivalence，不靠 normalizer 抹平 [REQ:F-06 / F-08 / CHK198 / CHK199] [VERIFY:bun run vitest run tests/integration/identity-binding-routes.test.ts tests/integration/openapi-semantic-equivalence.test.ts && bun run openapi:check]

---

## Phase 14 — Governance & Full Verification

- [x] T113 — `bun run typecheck`（`node scripts/typecheck-all.mjs`）。 **Files**: — **Depends**: T112 **Acceptance**: 0 error [REQ:plan Verification Plan] [VERIFY:node scripts/typecheck-all.mjs]
- [x] T114 — `bun run guard:static`。 **Files**: — **Depends**: T112 **Acceptance**: PASS；无 `mode=invite` / KYC / Person INSERT / participant / Evidence 越界 [REQ:plan D-20 / CHK181—CHK186] [VERIFY:node scripts/guard-static.mjs]
- [x] T115 — coverage remediation：证明 `coverage:audit` substantive 枚举 Slice5 required acceptance；若删除任一 F-01—F-08 proof 仍PASS，先 RED regression 再最小修 coverage script，使缺失 fail-closed；最后 openapi:check+coverage:audit GREEN。 **Files**: `scripts/coverage-audit.mjs`（若需）+ regression fixture/test **Depends**: T112 **Acceptance**: 不仅总体 coverage 百分比 [REQ:F-08 / CHK200] [VERIFY:node scripts/openapi-check.mjs && node scripts/coverage-audit.mjs]
- [x] T116 — `bun run db:migrate` + `bun run db:evidence`；记录 RLS / role / migration / schema 真实输出。 **Files**: — **Depends**: T112 **Acceptance**: migration 可重放；`relrowsecurity` / `relforcerowsecurity` / `rolbypassrls` 证据 PASS [REQ:CHK134 / CHK168] [VERIFY:node scripts/db-migrate.mjs && node scripts/db-evidence.mjs]
- [x] T117 — `node .specify/scripts/validate-governance.mjs` + `node .specify/scripts/tests/run-governance-tests.mjs`。 **Files**: — **Depends**: T113—T116 **Acceptance**: governance PASS；self-test 全 PASS；`Docs/**` diff = 0 [REQ:plan Constitution Check / CHK181] [VERIFY:node .specify/scripts/validate-governance.mjs && node .specify/scripts/tests/run-governance-tests.mjs]
- [x] T118 — `bun run verify-all` 全量；归档真实输出。 **Files**: — **Depends**: T117 **Acceptance**: 全 PASS；0 skipped（除 explicit BLOCKED） [REQ:plan Verification Plan] [VERIFY:node scripts/verify-all.mjs]
- [x] T119 — 结构 / exclusion 审计：`grep` 证明无 `INSERT INTO persons`、无 `case_participants` / `cases` / `assertions` / `observations` / `intervention_instances` / `notification` / KYC / 人脸 / 视频 / 电话；无 `mode=invite`。 **Files**: — **Depends**: T118 **Acceptance**: 全部 0 match [REQ:plan D-20 / SC-014] [VERIFY:rg -n "INSERT INTO persons|mode=invite|case_participants|assertions|observations|intervention_instances" apps packages db tests]
- [x] T120 — 最终 diff 审计：`git diff --stat IMPLEMENT_BASE_SHA` 仅允许 006 预期文件；`Docs/**`、`specs/001~005/**`、Slice 4 文件 diff = 0。 **Files**: — **Depends**: T119 **Acceptance**: diff 审计 PASS [REQ:CHK181] [VERIFY:git diff --stat IMPLEMENT_BASE_SHA]

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

## Task Counts（逐条核对）

| 类别 | 数量 | 口径 |
| Total tasks | 124 | T001—T124，连续、无重复、无跳号 |
| Implementation tasks | 55 | 生产代码 / migration / route / schema / adapter / fix task |
| Test tasks | 52 | 写测试、运行测试 suite、回归运行（含 T005、T105、T106） |
| Governance tasks | 13 | T001—T004 依赖核验、T006 base 记录、T113—T120 |
| Blocked tasks | 4 | T121—T124，全部 `BLOCKED BY SLICE 4 RUNTIME` |
| Current checked / remediation-open / blocked | **94 / 26 / 4** | Ultimate Audit 后 substantive truth；26 个 remediation-open 即上方集合 |

**`[P]` 任务（8 个，全部为纯 domain 单元测试，不同文件）**：T018、T020、T022、T024、T027、T029、T041、T045。

**说明**：DB / integration / route / migration / generated contract 任务不标 `[P]`，因为它们共享真实数据库、migration 顺序或 route 文件，不能证明并行安全。
