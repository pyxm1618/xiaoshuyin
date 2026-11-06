# 002-case-core — Implementation Convergence Evidence（Implement AI 自检）

**Feature**: `specs/002-case-core/spec.md`
**Branch**: `feat/002-case-core`
**Implement base**: `fe7d21f5ca3fcf79cea2e8baee461e01ec8526ed`
**前置**: `999295d`（已审核设计 Head）合并 `438b761`（origin/main，含 G11 hotfix）

> 本文是 Implement AI 的自检记录，**不是** Independent Converge，也不构成 merge 结论。

---

## 1. Implement Gate（T003–T012 现场重跑）

| Gate | 结果 |
|---|---|
| G1 Slice 1 + G11 hotfix 进入 main | PASS |
| G2 Slice 2 HEAD 含 `438b761` | PASS（`fe7d21f`，双父 merge） |
| G3 Schema / migration 基线 | PASS |
| G4 `authorize()` 基线 | PASS |
| G5 `withRlsTransaction` + `families` UPDATE 权限 | PASS |
| G6 幂等基础设施 | PASS |
| G7 `business_audit_events` 结构 | PASS |
| G8 RLS / runtime role | PASS |
| G9 OpenAPI 单事实源 | PASS |
| G10 5-job CI | PASS |
| G11 current-family 确定性（A/B/C + heap disturbance） | PASS |

## 2. Requirement coverage

- FR：**25 / 25**（`bun run coverage:audit`）
- SC：**11 / 11**
- Acceptance Evidence：**18 / 18**（`spec.md` 表 18 行；`tasks.md` 原记 16 为旧计数，已在 tasks.md 偏差记录中说明）

## 3. Scope

| 检查 | 结果 |
|---|---|
| Case 路由恰为 3 条 operation | PASS（`GET/POST /api/v1/cases`、`GET /api/v1/cases/{id}`） |
| `/cases/current` / pause / resume / switch-primary / close / recurrences / messages / assessments / participants | 不存在（路由枚举 + 运行时探测） |
| 越界表（participant / assertions / observations / problem_formulations / scene_* / safety / plan / task / notification） | 数据库内均不存在 |
| `cases` 禁止列（title/summary/description/problem_description/visibility/case_role/participant_id/deleted_at） | 均不存在 |
| Case 状态/阶段转换 | 无任何实现；仅写入 `OPEN + INTAKE` |

## 4. Contracts

- `CreateCaseRequest` strict：仅 `idempotencyKey`（8–128），未声明字段 → 422 且零写入。
- `CaseResponse` 恰为 7 字段；列表 `{ items }`；无 `familyId` / creator / 内容字段。
- 生成 OpenAPI：3 个 Case operation；403 `CASE_ACCESS_DENIED`、404 `CASE_NOT_FOUND` / `CURRENT_FAMILY_NOT_FOUND` 为可机械验证的 literal；两次生成 hash 一致。
- 与 `specs/002-case-core/contracts/cases-api.openapi.yaml` 结构比对：operations / strict request / 7-field response 全部一致，无 drift。

## 5. Tests

`bunx vitest run` → **44 files / 316 tests PASS**。

新增 Case 相关套件：

| 文件 | 覆盖 |
|---|---|
| `tests/db/cases-schema.test.ts` | 列集合、enum 顺序、唯一约束、partial unique 谓词、复合 FK |
| `tests/db/cases-rls.test.ts` | ENABLE/FORCE、默认拒绝、Family 隔离、无 manager 谓词、无 UPDATE/DELETE |
| `tests/db/cases-events-metadata.test.ts` | metadata 形状 CHECK（额外 key / 非 bool / 非整数 / <1 / 空对象） |
| `tests/db/cases-primary-concurrency.test.ts` | 真实并发单 primary + 23505 兜底 |
| `tests/domain/case-authorization.test.ts` | D-6.2 fail-closed 全分支 |
| `tests/domain/case-contracts.test.ts` | strict request / 7 字段响应 / 词汇 |
| `tests/integration/cases-create.test.ts` | 首/次 Case、422 零写入（15 个越权字段） |
| `tests/integration/cases-read.test.ts` | 排序、空集合、独立 status/phase、统一 404、跨家庭 |
| `tests/integration/cases-read-no-audit.test.ts` | 读不写审计 |
| `tests/integration/cases-idempotency.test.ts` | replay + 8 路并发同 key |
| `tests/integration/cases-audit.test.ts` | 1 event + 1 audit + 回滚 |
| `tests/integration/cases-authorization.test.ts` | 场景 A / B |
| `tests/integration/cases-scope.test.ts` | 路由/表/列/事件枚举 |
| `tests/integration/openapi-cases.test.ts` | 生成契约结构 |

## 6. RLS / concurrency / idempotency

- `cases` / `case_events`：`ENABLE + FORCE`，policy 仅 `family_id = app_family_id()`；无上下文 0 行/拒写；跨 Family 0 行；runtime role 非 owner、`NOBYPASSRLS`、仅 `SELECT, INSERT`。
- primary：`families` 行锁 → 独立 `EXISTS` → INSERT；partial unique 仅兜底，`23505` 不作正常分支。
- 幂等：`CASE_CREATE` 复用 `idempotency_keys`，占位 0 / 回填 201 与业务同事务；重放不新增 Case / event / audit。
- 读路径不写 `case_events` / `business_audit_events`。

## 7. Frozen upstream

相对 `IMPLEMENT_BASE_SHA`：`Docs/**`、`AGENTS.md`、`.specify/memory/constitution.md`、`spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/**`、`quickstart.md`、`checklists/**` 均无改动；`tasks.md` 仅 checkbox 与完成证据。

## 8. Remaining gaps

`NONE`
