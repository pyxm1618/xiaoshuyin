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

---

# Independent Converge Round 1 Remediation（2026-11-06）

**判定输入**: `INDEPENDENT CONVERGE FAIL — RETURN TO IMPLEMENT`
**Old head**: `d2e9587d143d6082c35fba281fcab86a047d7a72`
**Remediation code head**: `c382b43077aece2b72af2a259fa6d3a36244eb41`（最终 head 含本证据提交，以分支 HEAD / CI run 为准）
**范围**: 只关闭 7 个 finding；未重新设计 Slice 2，未改 frozen upstream，未新增 migration。

## Finding 1 — OpenAPI contract drift → CLOSED

- 代码侧单事实源补齐：`schema.operationId` = `createCase` / `listCases` / `getCase`，`schema.security = [{ bearerAuth: [] }]`，generator 声明 `components.securitySchemes.bearerAuth`（`type: http`, `scheme: bearer`）。
- detail 路径参数改为文档化 `format: uuid` 但**不做校验门禁**；runtime 对 malformed id 统一 `404 CASE_NOT_FOUND`。
- 未 hand-edit 生成物，未改 frozen contract。
- 证据：`tests/integration/openapi-cases.test.ts`（10/10，逐 operation 断言 operationId / security / tags / params / request / response / error shapes）；`tests/integration/cases-http-boundary.test.ts`（malformed / nonexistent / cross-family 三类 404 响应逐字节一致）。

## Finding 2 — HEAD routes → CLOSED

- 两个 GET route 使用 `exposeHeadRoute: false`；Case 子树路由枚举为 `POST, GET` 与 `/:id (GET)`。
- 未改 Slice 1 任何 route 的 HEAD 行为（`/healthz` 等仍为 `GET, HEAD`）。
- 证据：`cases-http-boundary.test.ts` 断言 Case 子树不含 `HEAD`，且真实 `HEAD /api/v1/cases`、`HEAD /api/v1/cases/:id` 均 404 且无 Case 字段。

## Finding 3 — auth before validation → CLOSED

- 认证逻辑抽为 `createAuthenticate()`，通过 `app.decorate('authenticate')` 复用；Case 三端点使用 `preValidation: app.authenticate`；全局 `preHandler` 对已认证请求短路，Slice 1 行为不变。
- 证据：无 token / 非法 token + 非法 body → `401 UNAUTHENTICATED`；`GET /cases/not-a-uuid` 无 token → 401；Slice 1 auth / family / consent 全量回归绿（`tests/integration` 28 files / 195 tests）。

## Finding 4 — request boundary → CLOSED

- **A. `__proto__`**：secure JSON parsing 保持开启；仅 `POST /api/v1/cases` 的 `FST_ERR_CTP_INVALID_JSON_BODY` 映射为 `422 VALIDATION_ERROR`，并证明 `cases / case_events / business_audit_events / idempotency_keys` 零新增；Slice 1 仍为 400。
- **B. NUL / Unicode key**：新增 `encodeCaseIdempotencyKey()`——PostgreSQL 安全键原样存储；含 U+0000 / lone surrogate 或保留前缀的键用 `u:` + base64url(UTF-16LE) 可逆编码；可逆编码无法容纳于 128 字符列时使用 `h:` + SHA-256（不截断）。未缩小 public contract，未新建表。
- 证据：`cases-http-boundary.test.ts` 覆盖 NUL key 首次 + 重放、Unicode key 重放与不同 key 不合并、6 路并发 NUL key 仅 1 个结果，全部 201 无 500。

## Finding 5 — shared idempotency mismatch → CLOSED

- route 删除本地 `request_hash !==` 判定，统一走 `decideIdempotency()`（REPLAY / MISMATCH / EXECUTE）。
- 证据：`tests/integration/cases-idempotency-mismatch.test.ts` 在真实 POST 写入的行上，用同 actor + 同 CASE_CREATE + 同 key + 不同 request_hash 得到 `MISMATCH` → `409 IDEMPOTENCY_PAYLOAD_MISMATCH`，原 `response_status/response_body`、Case、event、audit、幂等行均不变（各 1）。

## Finding 6 — acceptance coverage gaps → CLOSED

- **A07**：新增普通 member（非 guardian、非 manager）三端点测试 → create/list 403 `CASE_ACCESS_DENIED`，detail 404 `CASE_NOT_FOUND`，无 Case 数据，且不落入 `CURRENT_FAMILY_NOT_FOUND`。
- **A06**：新增 `case_events` 无上下文 SELECT=0 / INSERT 拒绝，与 `cases` 对称。
- **A13**：真实 `POST /api/v1/cases` + 数据库侧临时 trigger 故障注入（`case_events` / `business_audit_events` 各一次）→ 500 `INTERNAL_ERROR`，`cases / case_events / business_audit_events / CASE_CREATE idempotency` 全为 0；移除故障后同 Family 可正常创建。测试自建自清，无 production hook。

## Finding 7 — scope guard regression → CLOSED

- R6 恢复并扩展：`CREATE TABLE`（含 `IF NOT EXISTS` / schema 限定 / 引号 / `UNLOGGED`）、`pgTable('...')`、裸 `case_participants` 引用。
- 原有 `case_participants` / `assertions` / `observations` 检测能力保留，新增 forbidden vocabulary 全覆盖。
- 证据：`tests/integration/guard-scope.test.ts` 12/12——9 个 SQL 形态 + `pgTable` + `apps/` 内 `FROM cases`（R4）逐个注入均 exit != 0，清理后恢复 `PASS (0 violations)`。

## 专项验证（本轮真实输出）

| 命令 | 结果 |
|---|---|
| `bun run typecheck` | PASS |
| `bun run guard:static` | PASS (0 violations) |
| `bunx vitest run tests/domain` | 80 passed |
| `bunx vitest run tests/db` | 72 passed |
| `bunx vitest run tests/integration` | 28 files / 195 passed |
| `bunx vitest run` | **48 files / 347 passed，0 failed / 0 skipped** |
| `bun run db:migrate` ×2 | 0 new，2 previously applied（无新增 migration） |
| `bun run openapi:generate` ×2 | 生成物 hash 一致；`openapi:check` PASS (no drift) |
| `bun run coverage:audit` | 002: FR 25/25、SC 11/11、Acceptance 18/18、missing 0 |
| `validate-governance` / `run-governance-tests` | PASS / PASS 15/15 |

## Frozen upstream

`Docs/**`、`AGENTS.md`、constitution、`spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/**`、`quickstart.md`、`checklists/**` 相对 Implement Base 与 old head 均无改动；`tasks.md` 仅追加 remediation evidence。

## Remaining gaps

`NONE`（7/7 findings CLOSED）

## 追加证据（Round 1 收尾，2026-11-06）

| 项 | 值 |
|---|---|
| 最终 head | `2ae1769`（本轮 6 个 remediation commit） |
| CI run | `42177284538` — Static / Unit / DB Migration / Integration / Contract **5/5 success** |
| 全量测试 | `bunx vitest run` → 48 files / 347 tests，exit 0，0 failed / 0 skipped |
| typecheck / guard / openapi / governance | PASS / PASS (0 violations) / PASS (no drift) / PASS |

**收尾修复（test-only）**：A13 的故障 trigger 原本是表级，与并行套件对其他 Family 的写入冲突，导致 CI integration 偶发 500。已改为 `WHEN (NEW.family_id = <family>)` + 每轮唯一 trigger 名，故障仅作用于目标 Family；本地全量与 CI 均通过。
