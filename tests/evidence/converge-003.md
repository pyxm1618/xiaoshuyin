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