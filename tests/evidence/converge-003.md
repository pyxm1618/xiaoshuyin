# T066 — Slice 3 Implement Self-Convergence Evidence

**Feature**: `specs/003-evidence-core`
**Branch**: `feat/003-evidence-core`
**IMPLEMENT_BASE_SHA**: `62f9b8b46c68d790a0b26a6f143e950616a3c729`（普通 merge `origin/main = f4ef6026` 之后）
**FINAL_IMPLEMENTATION_HEAD**: `a7744d9d9826ed9260adb1eca3ce84568f721fb2`

> 本文是开发 AI 的自检 / 证据收集，**不是** Independent Converge（审计二），
> 也不构成 merge 结论。独立审计二必须由全新 AI 执行。

## 1. 冻结输入与范围

- 冻结材料：`specs/003-evidence-core/{spec.md,plan.md,research.md,data-model.md,quickstart.md,contracts/**,checklists/requirements-quality.md,tasks.md}`。
- 实现范围：`dialogue_messages` / `assertions` / `observations` 及必要 enum、index、constraint、FK、RLS、grants、
  domain/repository、唯一新路由 `POST /api/v1/cases/:id/messages`、shared idempotency 集成、audit、
  Zod/OpenAPI/generated、测试。
- 未新增：`evidence_items`、generic Evidence CRUD、Assertion/Observation public CRUD、FACT route/confirmation、
  Participant、Assessment、Problem Formulation、Scene、Goal、Plan、Task、Safety、AI/RAG/Memory/Notification、
  background job、event bus/outbox。

## 2. 需求覆盖（真实命令输出）

`bun run coverage:audit`：

```text
FR 21/21
SC 10/10
Acceptance 13/13
Checklist 115/115
missing = 0
coverage-audit (003): PASS
```

## 3. 数据库 / migration / RLS

`bun run db:evidence` → `db-evidence: PASS`：

- 空库从 `001` 顺序 replay 到 `004_evidence_core.sql`，结构核对 PASS；
- 既有 `001/002/003` 库升级到 `004` PASS；
- 第二次 apply `0 new`，对象集合 no-op；
- 15 张业务表、15 个 enum、19 条 policy；三张新表 `ENABLE + FORCE RLS`；
- `xiaoshuyin_app` / `xiaoshuyin_migrator` 均 `rolsuper=false, rolbypassrls=false`；
- `assertions` 的唯一 INSERT policy 为 `family_id = app_family_id() AND kind <> 'FACT'`；
- runtime grants：三表 SELECT/INSERT；assertions/observations 仅列级 `UPDATE(conflict_group_id)`；无 DELETE。

## 4. 安全 / 授权 / 幂等

- T007 结论：`runIdempotentCommand` 的内部 peek 在 route 调用它之后执行；route 先完成 specific Case
  授权，再进入 shared replay/mismatch；EXECUTE 内重新建立 Family context、重新读取 Case、重新 authorize。
- `tests/integration/messages-authorization-before-replay.test.ts`：跨 Family / 已失去当前 Family access
  均 404，且不泄露历史 message id、caseId、familyId、recordedAt；历史 snapshot 从不先于授权返回。
- `tests/integration/messages-idempotency.test.ts`：same key + same content replay 原 201；
  same key + different content 409 且零新写；20 并发同 key 仅 1 message/audit/idempotency；
  different key + same content 两条独立 raw message。
- `tests/db/evidence-fact-guard.test.ts`：runtime app role 在正确 Family context 下 INSERT FACT 被 RLS 拒绝；
  STATEMENT/HYPOTHESIS 仍可写；FACT 仅能由隔离 privileged fixture 表达。
- `tests/domain/evidence-provenance.test.ts` / `evidence-person-reference.test.ts`：8 值 provenance 矩阵，
  仅 4 值 production 可用；guardian relation 不授予 Family/Case access；跨 Family Person 统一
  `EVIDENCE_PERSON_REFERENCE_INVALID`。

## 5. Message 语义

- `tests/integration/messages-create.test.ts`：只保存 raw content；message +1、audit +1，
  Assertion/Observation/case_event 均 +0；禁止 body 字段（`idempotencyKey` / `familyId` / `actorId` /
  `sourcePersonId` / `subjectPersonId` / `recordedAt` / `assertionKind`）→ 422 且零写；
  whitespace-only → 422；响应恰为 `id/caseId/recordedAt`，不回显 content。

## 6. OpenAPI / 生成物

- `bun run openapi:generate` 连续两次：`openapi.json` / `openapi.d.ts` SHA-256 完全一致；
- `bun run openapi:check` → `PASS (semantic equivalence with frozen contracts)`，含 Slice 3 冻结 YAML；
- 只新增 `POST /api/v1/cases/{id}/messages` / `createCaseMessage`，无 generic Evidence / FACT endpoint。

## 7. 全量回归（当前 Head 真实执行）

| 命令 | 结果 |
|---|---|
| `bun run typecheck` | PASS (exit 0) |
| `bun run guard:static` | PASS (0 violations) |
| `bunx vitest run` | **82 files / 619 tests passed, 0 failed, 0 skipped** |
| `bun run openapi:check` | PASS |
| `bun run db:evidence` | PASS |
| `bun run coverage:audit` | PASS（21/21、10/10、13/13、115/115） |
| `bun run verify-all` | PASS（命令 PASS 36 / FAIL 0 / NOT VERIFIED 1，后者为 Slice 1 plan 的 FR-002 平台真实性） |
| `node .specify/scripts/validate-governance.mjs` | PASS |
| `node .specify/scripts/tests/run-governance-tests.mjs` | PASS 15/15 |

## 8. CI（FINAL_IMPLEMENTATION_HEAD）

- Head：`a7744d9d9826ed9260adb1eca3ce84568f721fb2`
- CI run：`42371994187` → `success`（Contract / DB Migration / Unit Tests / Static Checks / Integration Tests 全 success）
- Spec Governance run：`42371994600` → `success`

## 9. 冻结上游 diff

相对 `IMPLEMENT_BASE_SHA`：

- `Docs/**` = 0
- `AGENTS.md` = 0
- `.specify/memory/**` = 0
- `specs/003-evidence-core/{spec.md,plan.md,research.md,data-model.md,quickstart.md,contracts/**,checklists/**}` = 0
- `specs/001-family-identity-core/**`、`specs/002-case-core/**`、`specs/004-*`、`specs/005-*`、`specs/006-*` = 0
- `specs/003-evidence-core/tasks.md` 仅 `[ ]` → `[x]` 完成标记

## 10. Remaining gaps

Slice 3 范围内 **NONE**。

> 本自检不宣称 `MERGE SAFE`，不宣称 Independent Converge PASS，不授权 merge main。
## 11. Audit II remediation（2026-11-07）

**Start Head**: `814aa3a9ff9e5ff7858a99ae4ad7a3bdb1943da0`
**审计结论**: CRITICAL 0 / HIGH 1 / MEDIUM 2 / LOW 0 → `RETURN TO IMPLEMENT`

| Finding | 状态 | 修复 |
|---|---|---|
| AUD-II-001 (HIGH) | FIXED | `packages/domain/src/index.ts` 不再 `export * from './repository.js'`；改为显式导出既有批准 API。Evidence 低层写 primitive 仍留在 `repository.ts` 内部，生产 package 不可导入。production package entrypoint 对 Evidence writer 只暴露严格 4 个：`recordStatement` / `recordHypothesis` / `recordObservation` / `assignConflictGroup`；消息写入口移至 `packages/domain/src/internal/message-writer.ts` 内部 seam，不从 index 导出。机械测试验证 4 个 writer、`recordDialogueMessage` 与 repository 写 primitive 均 undefined、无 FACT writer、disabled provenance 无法绕过 writer。 |
| AUD-II-002 (MEDIUM) | FIXED | `setAssertionConflictGroup` / `setObservationConflictGroup` 改为条件 UPDATE（仅 `NULL → group` 或 `same → same`）；并发竞争落败返回 `rowCount = 0`，domain 抛 `EVIDENCE_CONFLICT_GROUP_IMMUTABLE`。真实双连接并发测试证明只有一个 group 成为真实值，`G1 → G2` 不可能发生。 |
| AUD-II-003 (MEDIUM) | FIXED | 新增 `tests/db/migration-upgrade-evidence.test.ts`：临时库只应用 001–003 → 插入真实 Slice 1/2 数据并记录 invariant → 真实 migrator 应用 `004_evidence_core.sql` → 验证旧数据/关系存活、新 schema/RLS/grants/CHECK 正确 → 再次应用 `0 new` no-op → 销毁临时库。 |

**新增 / 更新测试**

- 更新 `tests/domain/evidence-capabilities.test.ts`（+5：production export boundary、repository primitive 不可见、FACT/generic writer 不存在、disabled provenance 不能绕过 statement/observation writer）
- 新增 `tests/db/evidence-conflict-concurrency.test.ts`（3：条件 UPDATE 并发、NULL/same/different 三态、并发 `assignConflictGroup` 收敛）
- 新增 `tests/db/migration-upgrade-evidence.test.ts`（2：001-003 → 004 升级保数据、二次应用 0 new）

**本轮验证（真实执行）**

| 命令 | 结果 |
|---|---|
| `bun run typecheck` | PASS |
| `bun run guard:static` | PASS (0 violations) |
| `bunx vitest run` | **84 files / 629 tests passed, 0 failed, 0 skipped** |
| `bun run openapi:generate` + `openapi:check` | PASS（无 drift） |
| `bun run db:evidence` | PASS（fresh / upgrade / replay） |
| `bun run coverage:audit` | PASS（21/21、10/10、13/13、115/115） |
| `bun run verify-all` | PASS（36 PASS / 0 FAIL / 1 NOT VERIFIED = Slice 1 FR-002 平台真实性） |
| `validate-governance` + `run-governance-tests` | PASS / 15/15 |
| 冻结文档 diff（Docs、AGENTS、.specify、003 spec/plan/tasks/checklists/contracts、其它 Slice） | 0 |

> 本轮仍只是开发 AI 的 remediation；不宣称 Audit II PASS，不 merge main。下一步交新的独立 Audit II 复审。
## 12. AUD-II-001 精准 re-remediation（2026-11-07）

**Start Head**: `2e0e5c963e6d895beee69a5c74e6bb4602b52c1f`

审计确认 AUD-II-002 / AUD-II-003 已修复；仅 AUD-II-001 残留「`recordDialogueMessage` 成为第 5 个 public Evidence writer」。

本轮修复：

- 删除 `packages/domain/src/evidence.ts` 的 `recordDialogueMessage` export。
- 新增 `packages/domain/src/internal/message-writer.ts` 作为 Message command 的内部 seam（不导出 index）。
- `apps/server/api/src/routes/messages.ts` 从该内部模块路径导入，Message 行为、事务边界与 audit 原子性不变。
- `tests/domain/evidence-capabilities.test.ts` 的 `APPROVED_WRITERS` 恢复为严格 4 个，并新增 `recordDialogueMessage` 在 package entrypoint 必须 undefined 的断言。

**真实验证**

| 命令 | 结果 |
|---|---|
| `bun run typecheck` | PASS |
| `bun run guard:static` | PASS (0 violations) |
| 入口面实测 | `recordStatement/recordHypothesis/recordObservation/assignConflictGroup` = function；`recordDialogueMessage` = undefined；`insertEvidenceAssertion` = undefined |
| `tests/domain` | 16 files / 179 tests PASS |
| `tests/db` | 20 files / 136 tests PASS |
| `tests/integration` | 48 files / 315 tests PASS |
| 全量 | 84 files / 630 tests PASS，0 failed，0 skipped |
| `bun run openapi:check` | PASS（无 drift） |
| `bun run db:evidence` | PASS |
| `bun run coverage:audit` | PASS（21/21、10/10、13/13、115/115） |
| `bun run verify-all` | PASS（36 PASS / 0 FAIL / 1 NOT VERIFIED = Slice 1 FR-002 平台真实性） |
| governance | PASS / 15/15 |
| AUD-II-002 回归 | `tests/db/evidence-conflict-concurrency.test.ts` 3/3 PASS |
| AUD-II-003 回归 | `tests/db/migration-upgrade-evidence.test.ts` 2/2 PASS |
| 冻结文档 diff | 0 |

> 仍不宣称 Audit II PASS、不 merge main；由新的独立 Audit II 最终判定。## 13. Ultimate Audit remediation：ULT-001 / ULT-002（2026-11-08）

**Start Head**: `c2593fafc3ff6fc35816e478348e95fb1cc1c0d9`

本轮只修 Ultimate Audit 的两项 MEDIUM，不重开 Slice 3、不改冻结文档与 migration。

### ULT-001 — Evidence writer 边界双层封闭

- 第一层（package boundary）：`packages/domain/package.json` 增加最小 `exports`（仅 `"."` → `./src/index.ts`），外部 package consumer 无法再解析 `@xiaoshuyin/domain/src/repository*` 或 `src/internal/*`。服务端内部 Message seam 改为 workspace 相对源码引用（`apps/server/api/src/routes/messages.ts`），不是 package subpath，也不是 public API；为允许该跨包源码引用，`apps/server/api/tsconfig.json` 只做最小 `rootDir` / `composite` 调整。
- 第二层（repository defence-in-depth）：`insertEvidenceAssertion` / `insertEvidenceObservation` 自身 fail-closed，拒绝 `AI_HYPOTHESIS` / `MANUAL_DEVICE_DATA` / `STAFF_RECORD` / `SOURCE_CONFIRMED`、`kind = HYPOTHESIS` 以及 observation 的非 `GUARDIAN_OBSERVATION` 组合。来源集合下沉到 `packages/domain/src/provenance.ts` 的单一常量，受控 writer 与 raw writer 共用，未复制第二套业务逻辑。FACT 仍不在应用层判定，继续由数据库 `assertions_insert` hard guard 拒绝。

### ULT-002 — Message authorization 错误分类

- `apps/server/api/src/routes/messages.ts` 不再裸 `catch` 一揽子转 404；只有 `authz.ts` 中由 `denyToError()` 标记的明确 authorization denial 才映射为 `404 CASE_NOT_FOUND`。
- `NO_ACTOR` / 401 不带该标记，继续走原有 authentication 路径。
- 未知异常（真实 PostgreSQL `57014`、连接失败、基础设施错误）继续 throw，由全局 error handler 返回 `500 INTERNAL_ERROR` 并进入既有 unexpected-error 日志白名单。

### 新增测试

- `tests/domain/package-boundary.test.ts`（8）：真实 Bun 子进程从 `apps/server/api` 解析包；approved entrypoint 可用；`src/repository.js` / `src/repository` / `repository.js` / `src/internal/message-writer.js` / `internal/message-writer.js` 全部无法导入；entrypoint 不暴露 `recordDialogueMessage` 与任何 raw writer。
- `tests/db/evidence-raw-writer-guard.test.ts`（6）：raw assertion/observation writer 拒绝 4 类禁用 provenance、HYPOTHESIS、非 observation 来源；FACT 仍由 DB hard guard 拒绝；冻结可写组合仍成功；所有拒绝均 rows +0。
- `tests/integration/messages-authorization-error-classification.test.ts`（5）：明确 denial → 404；真实 `57014` 不被判定为 denial；真实 PostgreSQL statement timeout（`options=-c statement_timeout=1500` + `LOCK TABLE families` 注入）→ 500 `INTERNAL_ERROR`；message/audit/idempotency 均 +0；日志含 `sqlstate=57014` 且无 SQL/凭据；故障恢复后正常请求 201。

### 真实验证（本 Head 现场执行）

| 命令 | 结果 |
|---|---|
| `bun run typecheck` | PASS |
| `bun run guard:static` | PASS（0 violations） |
| `tests/domain` | 17 files / 187 tests PASS |
| `tests/db` | 21 files / 142 tests PASS |
| `tests/integration` | 49 files / 320 tests PASS |
| 全量 | 87 files / 649 tests PASS，0 failed，0 skipped |
| `bun run openapi:generate` + `openapi:check` | PASS，generated 无漂移 |
| `bun run db:evidence` | PASS |
| `bun run coverage:audit` | PASS（21/21、10/10、13/13、115/115） |
| `bun run verify-all` | PASS（36 PASS / 0 FAIL / 1 NOT VERIFIED = Slice 1 FR-002 平台真实性） |
| governance validate + self-test | PASS / 15/15 |
| migration diff | 0（`004_evidence_core.sql` 未改动） |
| AUD-II-002 / AUD-II-003 回归 | conflict concurrency 3/3、migration upgrade 2/2 PASS |

> 本轮仍是开发 AI 的 remediation；不宣称 Ultimate Audit PASS / MERGE SAFE、不创建 PR、不 merge main。下一步交独立高级审计 AI 复审。