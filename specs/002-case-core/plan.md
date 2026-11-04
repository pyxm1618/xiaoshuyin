# Implementation Plan: 002-case-core（Case 核心地基）

**Feature**: `specs/002-case-core/spec.md`
**Date**: 2026-11-04
**V1 Phase**: Phase 1 — Common Core 地基（`Docs/V1技术设计.md` §38）
**Slice**: SLICE 2 — Case 容器（`cases` / `case_events` / 单一主要 Case）
**阶段**: Plan（Checklist / Tasks / Analyze / Implement 均未开始）

---

## 0. Baseline 与 Slice 2 Implement Gate

### 0.1 Baseline（本 Plan 编写时的只读事实）

| 项 | 值 |
|---|---|
| `origin/main` | `120fee22bd5939f35b9713efc21dd2af4384421d`（PR #7 之后；closeout 时重新 fetch 确认） |
| Slice 1 只读 Head（`feat/001-family-identity-core`，主 worktree） | `74a31eb24060f2805b3b33cbfeacd5d1676730b1`（与 `origin/feat/001-family-identity-core` 同步） |
| Slice 1 完成度 | 60 / 72 tasks 勾选；US3 consent-first flow 已提交；跨家庭授权终验、幂等全量行为、RLS 终验、final OpenAPI / converge / CI closeout 仍未完成 |
| Slice 1 工作树状态 | clean（无未提交文件） |
| Slice 2 原始 Head | `72ce35b9e41315c31fb2e2efdd7aca623a917dba` |
| Slice 2 分支 | `feat/002-case-core`（worktree `/Users/milushangdi/Projects/xiaoshuyin-002-case-core`） |
| 冻结 Spec | `specs/002-case-core/spec.md`（已冻结；本轮 closeout 仅做 Q3「CASE_CREATE 幂等 mismatch 可达性」最小澄清） |

### 0.2 Spec 阶段可以提前完成，Implement 不可以

本 Slice 的 Plan / Checklist / Tasks / Analyze 可以基于 Slice 1 的**冻结设计**提前完成。
但 **Slice 1 “设计存在” ≠ “实现已冻结”**。进入 Implement 前必须重新验证下列 11 项；任一不满足即：

> **BLOCKED — SLICE 1 IMPLEMENTATION DEPENDENCY**

| # | Gate 项 | 验证方式（Implement 前现场执行） |
|---|---|---|
| G1 | Slice 1 已正式合并到 main | `git merge-base --is-ancestor <slice1-final-head> origin/main` |
| G2 | Slice 2 分支已包含最终 Slice 1 main | `git fetch origin`；`git checkout feat/002-case-core`；`git merge origin/main`；`git merge-base --is-ancestor origin/main HEAD` 必须成功。**禁止 rebase / force push**：本分支已包含已 push 的 Specify / Clarify / Plan commit，改写历史不可接受。若 merge 冲突：正常解决 → 重跑 governance / tests → 普通 push |
| G3 | Slice 1 final schema / migration 与本 Plan 假设一致 | 逐项核对 `families.created_by_person_id`、`family_members` UNIQUE、`business_audit_events` / `idempotency_keys` 列与 CHECK 真实存在；`schema_migrations` 记录一致 |
| G4 | `authorize()` final shape 可增量扩 Case | 行动作表 / Purpose / `case` 维度可扩展；现有 Family / Consent 行为测试 green |
| G5 | `withRlsTransaction` final implementation 可复用 | 函数签名仍为 `(pool, {familyId, accountId, personId, purpose}, fn)`，事务内 `set_config(..., true)` |
| G6 | `idempotency_keys` final behavior 全绿 | 同 key 同 payload → 原结果；同 key 异 payload → 409（shared contract 行为，不是 CASE_CREATE HTTP 场景）；`idempotency_keys` 身份级 RLS 生效；**lookup / insert / replay 均在 identity 上下文事务内** |
| G7 | `business_audit_events` final structure 全绿 | `event_type` / `resource_type` 为 reviewed CHECK；family 级 RLS；追加语义可用 |
| G8 | RLS / roles / cross-family tests 全绿 | `relrowsecurity` / `relforcerowsecurity`、`rolbypassrls=false`、owner 非 app、无上下文零行、跨家庭零行 |
| G9 | OpenAPI / generated contract 基线已稳定 | `packages/contracts` Zod 为代码侧单事实源，OpenAPI 可由其生成且 `openapi:check` 无意外 diff；幂等键 transport 在 OpenAPI 与 runtime 已一致 |
| G10 | Slice 1 final CI + independent converge PASS | CI 全部 job green；converge 报告无未解决 gap |
| G11 | Current Family 解析具备确定性、已审核语义 | 现场验证 Slice 1 final 的 current-family 解析（`GET /api/v1/families/current` 或等价正式入口）：对属于 ≥2 Family 的 actor，重复请求得到一致且可解释的结果；不得依赖无 `ORDER BY` 的 `rows[0]`。若仍存在未定义的多 Family current 选择行为且真实影响 Slice 2 → `BLOCKED — SLICE 1 CURRENT FAMILY SEMANTICS NOT STABLE`。Slice 2 不负责 Family switching，不得私自修复 |

**Gate 失败处理**：停止，报告 `BLOCKED — SLICE 1 IMPLEMENTATION DEPENDENCY`，列出失败项与现场输出。
**Current Family 专项**：若 G11 失败，报告 `BLOCKED — SLICE 1 CURRENT FAMILY SEMANTICS NOT STABLE`；Slice 2 不得在 current Family 结果可能因无序查询而随机变化的基础上进入 Implement。
**禁止**：为了继续而私建替代 Family / Consent / RLS / 幂等 / 审计基础设施；禁止在 Slice 2 分支重设计 Slice 1 冻结基线。

### 0.3 已知 Slice 1 真实形状与偏差（只读盘点结论）

| 真实实现 | 与本 Plan 的关系 |
|---|---|
| `db/migrations/001_initial_schema.sql` 单文件 reviewed migration；9 张表 ENABLE+FORCE RLS；`accounts` 无 RLS | 复用；Slice 2 只新增文件，不修改 001 |
| `families.created_by_person_id uuid NOT NULL UNIQUE` | 唯一管理主体判定来源；Case manager 判定直接使用 |
| `family_members` 有 `UNIQUE (family_id, person_id)`；`person_id` FK 可延迟 | 复用；`set_family_context` 的 membership 校验依赖它 |
| `business_audit_events.event_type` / `resource_type` 为**内联匿名 CHECK 白名单** | Slice 2 用 reviewed migration `DROP CONSTRAINT` + 重新 `ADD CONSTRAINT` 扩展；实现前先读 `pg_constraint` 确认真实约束名 |
| `idempotency_keys.command_type` 为内联匿名 CHECK 白名单；`response_status` / `response_body` NOT NULL；`UNIQUE (actor_account_id, command_type, idempotency_key)`；RLS 为 `actor_account_id = app_account_id()` | Slice 2 扩 `CASE_CREATE`；沿用同表，不建第二套幂等表 |
| `withRlsTransaction` 先 `set_identity_context` 再 `set_family_context`，`set_config(..., true)` | 直接复用；Case 业务事务不得自建上下文设置 |
| `authorize()` 纯函数；`case: null` 硬编码；`MANAGER_ACTIONS` 分支为 placeholder `ALLOW`；manager 判定由 caller 用 `isFamilyManager()` 完成 | Slice 2 增量扩展 `case` 维度与 Case actions；**不创建 `authorizeCase()`** |
| `packages/contracts/src/schemas.ts` 是 Zod 代码侧事实源；幂等键为请求体字段 `idempotencyKey` | Case 契约沿用 body 字段；OpenAPI 手写 header `Idempotency-Key` 与 runtime 不一致，属 G9 待收敛项 |
| `apps/server/api/src/routes/families.ts` 的幂等 lookup 在**无 identity 上下文**的 `pool.query` 中执行 | 这是 Slice 1 未完成项（G6）；Slice 2 **禁止照抄**，Case 幂等读写必须在 `withRlsTransaction` 内 |
| `GET /families/current` 当前对多 Family actor 无条件取 `rows[0]`，无 `ORDER BY`，也未定义多 Family 选择语义 | Case 端点沿用 Slice 1 final current-family 语义；**G11 必须证明其确定性**，若仍为未定义行为 → `BLOCKED — SLICE 1 CURRENT FAMILY SEMANTICS NOT STABLE`；Slice 2 不自定义第二套 Family 错误码，也不实现 Family switching |
| `package.json` 引用 `db:evidence` / `openapi:generate` / `openapi:check` / `coverage:audit` / `verify-all`，但仓库仅有 `db-migrate.mjs`、`guard-static.mjs` | Verification Plan 只使用真实存在的命令；缺失脚本在 G10 由 Slice 1 final 补齐，否则阻塞证据链 |

---

## Upstream Traceability

| Upstream ID / Section | Source | 本 Plan 实现/投影 |
|---|---|---|
| V1-C01 | `Docs/V1产品需求.md` §24 | 一个 Family 最多一个当前 primary 未结 Case；候选保留 |
| V1-C21 | `Docs/V1产品需求.md` §24 | 跨成员 / 跨家庭按真实授权判定与 RLS 隔离 |
| V1-C27 / V1-C28 | `Docs/V1产品需求.md` §24 | 真实失败状态；重复 / 并发 / 重试不制造重复业务结果 |
| U04 | `Docs/V1产品需求.md` §23 | 服务端读取当前主要 Case 与阶段（无 UI） |
| U03（前置） | `Docs/V1产品需求.md` §23 | Case 只能建立在已存在 Family 上（Slice 1） |
| §2.1 / §2.4 | `Docs/V1产品需求.md` | 多候选 / 单主线；Status 与 Phase 分开存储 |
| §5 不变量 1 / 2 / 17 / 19 | `Docs/V1技术设计.md` | Case 与 Participant 分开；单 primary；幂等不重复；仅 primary 可进入普通执行 |
| §6.1 / §6.2 | `Docs/V1技术设计.md` | Case Status / Phase 正式词汇与独立存储 |
| §6.6 / §6.7 | `Docs/V1技术设计.md` | Phase 0 只创建初始状态，不实现任何转换命令 |
| §7.0 | `Docs/V1技术设计.md` | `uuidv7()`；reviewed migration；禁止 `drizzle-kit push` |
| §7.2 / §7.8 | `Docs/V1技术设计.md` | `cases` / `case_events` 表组；领域历史保留 |
| §7.9 | `Docs/V1技术设计.md` | `business_audit_events` 追加审计 |
| §8.1 | `Docs/V1技术设计.md` | 单 primary 由数据库保证 |
| §8.5 | `Docs/V1技术设计.md` | `actor_id + command_type + idempotency_key` 幂等合同 |
| §8.6 | `Docs/V1技术设计.md` | Case 聚合 version 基础 |
| §9 / §9.1 | `Docs/V1技术设计.md` | 统一 `authorize()`；按当前目标 Family 判定；RLS 第二道防线；`withRlsTransaction` |
| §28.3 | `Docs/V1技术设计.md` | `POST /api/v1/cases`、`GET /api/v1/cases`、`GET /api/v1/cases/:id` |
| §29.4 | `Docs/V1技术设计.md` | switch-primary 为后续能力；本 Slice 排除 |
| §37.2 | `Docs/V1技术设计.md` | 跨家庭硬阻断；幂等；p95 待压测后冻结 |
| §38 Phase 1 | `Docs/V1技术设计.md` | 本 Slice 只切 Case 容器这一刀 |

Spec 映射：FR-001—FR-025、SC-001—SC-011、Acceptance Scenarios 1—16、D1—D7。
**本 Plan 不改变 spec 的产品语义；A-2 / A-3 只做技术选择。**

---

## Summary

Slice 2 在 Slice 1 已冻结的 Family / identity / RLS / 幂等 / 审计基础上，增加一个**最小 Case 容器**：

1. 新增 `cases`（id、family ownership、creator、status、phase、primary、version、server timestamps）与 `case_events`（append-only 领域历史）。
2. 用 **Family 行锁串行化 primary 判定** + **partial unique index 作为数据库最后防线**，保证「同一 Family 最多一个 `is_primary = true AND status <> 'CLOSED'` 的 Case」，且并发两个不同幂等键请求会确定性地产出「一个 primary + 一个 candidate」，而不是靠 `SELECT` 后 `INSERT` 的竞态，也不把 unique violation 当正常业务流程。
3. 用 `CASE_CREATE` 扩展现有 `idempotency_keys`，在**同一业务事务**内原子写入 `Case + case_event + business_audit_event + idempotency response`。
4. 用现有 `authorize()` 增量扩展三个 Case 动作（create / list / read），不新建 `authorizeCase()`、不建 Case role / RBAC / visibility 矩阵。
5. 只暴露 §28.3 的三个 Case 端点；详情统一 `404 CASE_NOT_FOUND`，列表 / 创建对「Family 已解析但非管理主体」返回 `403 CASE_ACCESS_DENIED`。
6. 不建 Participant、Evidence、Problem Formulation、Safety、Plan、Task、Notification、AI、UI、transition 路由或任何 placeholder。

---

## Technical Baseline

以 `Docs/V1技术设计.md` 为权威；本 Slice 不引入任何新依赖。

**Runtime / Language**: Node.js `26.13.0`；TypeScript 5.9；ESM。
**Dependencies**: Fastify 5 stable（Slice 1 已锁定）；`fastify-type-provider-zod` 7；Zod ≥ 4.2；`pg` / node-postgres；Drizzle ORM 仅作为 schema 类型与事务设施（Slice 1 现状），RLS / 索引 / 复合约束用显式 reviewed SQL。
**Storage / Migration**: PostgreSQL 18（原生 `uuidv7()`）；`db/migrations/*.sql` reviewed migration；migrator / app 双角色；禁止 `drizzle-kit push`。
**Testing / Eval**: Vitest；domain 纯函数测试 + DB 结构/RLS 测试 + integration；并发用真实 PostgreSQL 多连接验证，不用进程内锁或 mock 替代。
**Deployment target**: Stage A local / CI（`docker-compose.stage-a.yml`）；本 Slice 不涉及 Stage B/C 差异。

任何未批准依赖、框架、服务或架构变更 = BLOCKER，需上游评审。本 Plan 无此类变更。

---

## Constitution Check

*GATE: MUST PASS before implementation planning proceeds.*

- [x] **No new product semantics.** 全部行为可追溯到 V1-C01 / V1-C21 / V1-C27 / V1-C28 / U04 / §2.1 / §2.4 / §5 / §6.1 / §6.2 / §7.2 / §7.8 / §7.9 / §8.1 / §8.5 / §8.6 / §9 / §9.1 / §28.3 / §37.2 / §38；A-2 / A-3 只是技术选择。
- [x] **No V2–V5 scope pulled into V1.** 无 Participant / Evidence / Formulation / Safety / Plan / Task / Notification / AI / RAG / Memory / UI / 数据权利。
- [x] **No canonical A/010xx behavior reordered, merged, deleted, or renumbered.** 本 Slice 不触碰 Digital Use 节点与路由。
- [x] **Frozen technical stack and exclusions are respected.** 无新依赖；无 pg-boss / pgvector / XState / 第二套框架；无 `drizzle-kit push`。
- [x] **Deterministic rules remain deterministic.** primary 判定、幂等、授权、RLS、错误语义全部是纯规则 + 数据库约束，无模型参与。
- [x] **Authorization / Consent / RLS / Safety / Compliance implications are addressed.** `authorize()` 增量 + `withRlsTransaction` + ENABLE/FORCE RLS + 运行角色 NOBYPASSRLS；Consent 不在本 Slice 新增语义；Safety 无作用对象（显式 N/A，见下）。
- [x] **Data provenance/version/history requirements are preserved.** `case_events` append-only；`business_audit_events` 追加；`version` 初始值确定；不覆盖 / 删除历史。
- [x] **Failure/UNKNOWN/concurrency/idempotency behavior is designed where applicable.** 404 / 403 / 409 / 422 / 500 真实状态；并发 primary 串行化；同 key 重放；无部分成功。
- [x] **Verification path exists for every acceptance item.** 见 `## Verification Plan`；每条 FR / SC / Acceptance 均有 test 或 DB introspection 证据。

**Post-design re-check**：设计完成后再次核对上述 9 项，结论仍全部通过（详见 `## Complexity Exceptions` 为空、`## Blockers` 为 NONE）。

---

## Design

### D-1 实现模型

#### 1.1 上下文视图

```text
[微信小程序 / 运营端（本 Slice 不实现 UI）]
        │ HTTPS + Bearer session token（Slice 1 auth）
        ▼
[Fastify API  apps/server/api]
        │  Case routes（新增 3 条）
        ├──────────────► [packages/authorization]  authorize() 纯函数（增量扩展 Case 维度）
        ├──────────────► [packages/domain]          idempotency canonical hash / decision（复用）
        └──────────────► [packages/contracts]       Case Zod schema（新增，单事实源）
        │
        ▼ withRlsTransaction（复用 Slice 1）
[PostgreSQL 18]
  ├─ families / family_members（只读：manager 判定、RLS 上下文）
  ├─ cases（新增）
  ├─ case_events（新增）
  ├─ business_audit_events（增量 CHECK）
  └─ idempotency_keys（增量 CHECK）
```

- 上游：客户端只调用三个 Case 端点；当前 Family 由服务端从已验证 context 解析，客户端不提交 `familyId`。
- 下游：无模型 / 无队列 / 无通知 / 无外部副作用。
- 中间件：仅 PostgreSQL；无缓存、无消息队列。

#### 1.2 服务 / 组件总体架构

```text
apps/server/api/src/routes/cases.ts            ← 新增；唯一 Case HTTP 入口
  ├─ resolveCurrentFamily()                    ← 复用 Slice 1 语义（identity 上下文事务）
  ├─ withRlsTransaction()                      ← 复用 packages/../db/tx.ts
  ├─ authorize()                               ← packages/authorization 增量
  ├─ idempotency helpers                       ← packages/domain（canonicalJson / hashPayload / decideIdempotency）
  └─ toHttpError()                             ← 复用 plugins/error-handler（新增 2 个错误码）

packages/contracts/src/schemas.ts              ← 新增 Case request/response schema（不修改既有 schema）
packages/authorization/src/authorize.ts        ← 增量扩展 Action/Resource/case/family 输入
db/migrations/<next-after-slice1>_case_core.sql ← 新增 reviewed migration
```

| 组件 | 职责 | 不负责 |
|---|---|---|
| `routes/cases.ts` | 认证、current family 解析、调用 authorize、编排事务、映射错误 | 不直接 `set_config`，不实现第二套幂等逻辑 |
| `authorize()` | 纯函数判定 Case 三动作与 manager 资格 | 不读数据库、不判 Case 是否存在、不做 RLS |
| `withRlsTransaction` | 建立 family + identity 上下文、BEGIN/COMMIT/ROLLBACK | 不决定业务顺序 |
| `idempotency` 纯函数 | canonical hash、REPLAY/MISMATCH/EXECUTE 判定 | 不访问数据库、不生成 Case |
| `cases` / `case_events` RLS | 家庭隔离最后防线 | 不做 manager / participant 判定 |

配置项：无新增配置。复用 Slice 1 的 `DATABASE_URL`（app 角色）、`MIGRATION_DATABASE_URL`（migrator 角色）、`SESSION_SECRET`。

#### 1.3 实现设计（状态与流程）

本 Slice 的 Case 只有两个合法初始状态：`status = OPEN`、`phase = INTAKE`。
数据库 enum 承载 §6.1 / §6.2 的**完整词汇**，但本 Slice **没有任何可达路径**写入其它值（无 transition command、无 PATCH、无 UPDATE SQL 路由）。

```text
(create) ──► [status=OPEN, phase=INTAKE, is_primary ∈ {true,false}, version=1]
                  │
                  └─ 无任何转换边（本 Slice 不实现）
```

扩展点：无。本 Slice 不提供 hook / plugin / extension interface。
事务设计：见 D-3；一致性边界为**单个 PostgreSQL 事务**。

---

### D-2 数据模型（列级设计见 `data-model.md`）

#### 2.1 `cases` 最小容器

| 逻辑字段 | DB 列 | 类型/约束要点 | 说明 |
|---|---|---|---|
| id | `id` | `uuid PK DEFAULT uuidv7()` | 创建后不可变 |
| family ownership | `family_id` | `uuid NOT NULL FK families(id) ON DELETE RESTRICT` | 创建后不可迁移 |
| creator | `created_by_person_id` | `uuid NOT NULL FK persons(id) ON DELETE RESTRICT` | 来自已验证 actor，客户端不可指定 |
| status | `status` | `case_status NOT NULL` | 本 Slice 只写 `OPEN` |
| phase | `phase` | `case_phase NOT NULL` | 本 Slice 只写 `INTAKE` |
| primary | `is_primary` | `boolean NOT NULL` | **DB 列名避开 SQL 保留字 `primary`**；API 暴露为 `primary` |
| version | `version` | `integer NOT NULL CHECK (version >= 1)` | 初始 `1` |
| timestamps | `created_at` / `updated_at` | `timestamptz NOT NULL DEFAULT now()` | 创建时二者相同 |

**明确禁止的列**：`title`、`summary`、`description`、`problem_description`、任何 evidence-like 自由文本、`case_participant` 相关列、`family_id` 之外的可见性列。结构断言测试必须证明这些列不存在。

**为什么用 enum**：`case_status` / `case_phase` 用 PostgreSQL enum（顺序严格照 §6.1 / §6.2），使「未定义值」在数据库层不可写入，满足 FR-003「不得新增、改名或重排」。

#### 2.2 `case_events` 领域历史

| 逻辑字段 | DB 列 | 约束要点 |
|---|---|---|
| id | `id` | `uuid PK DEFAULT uuidv7()` |
| family scope | `family_id` | `uuid NOT NULL` |
| case ref | `case_id` | `uuid NOT NULL` |
| actor | `actor_account_id` | `uuid NOT NULL FK accounts(id) ON DELETE RESTRICT` |
| event type | `event_type` | `text NOT NULL CHECK (event_type IN ('CASE_CREATED'))` |
| metadata | `metadata` | `jsonb NOT NULL DEFAULT '{}'`；只放 `{primary, version}` |
| occurred | `occurred_at` | `timestamptz NOT NULL DEFAULT now()` |

**Composite FK**：`(case_id, family_id) REFERENCES cases(id, family_id)`，要求 `cases` 有 `UNIQUE (id, family_id)`。
这条数据库不变量保证事件不可能挂到别的 Family 的 Case 上——即使应用层写错 `family_id`，FK 也会拒绝。

**append-only**：`xiaoshuyin_app` 对 `case_events` 只授予 `SELECT, INSERT`，不授予 `UPDATE, DELETE`。
不使用 trigger 兜底，因为最小权限已从权限层阻断；migrator 属于 DDL 角色，不属于 runtime。

#### 2.3 既有表的最小增量

- `business_audit_events`：新增 `event_type = 'CASE_CREATED'`、`resource_type = 'CASE'`。沿用 `family_id` / `actor_account_id` / `resource_id` / `metadata` / `occurred_at`，不新增列。
- `idempotency_keys`：新增 `command_type = 'CASE_CREATE'`。不新增列、不建第二张表。
- `families` / `persons` / `family_members`：只读使用，不修改。

---

### D-3 Primary Case 并发方案（冻结）

#### 3.1 目标

> 同一 Family 最多一个 `is_primary = true AND status <> 'CLOSED'` 的 Case。

并满足：两个合法、不同幂等键的并发 create 请求，在「Family 当前无 Case」时**都应确定性完成**：一个成为 primary，一个成为 candidate；不得失败、不得两个 primary。

#### 3.2 三层机制

| 层 | 机制 | 作用 |
|---|---|---|
| 1. 应用串行化 | 在业务事务内对**当前 Family 行**执行 `SELECT id FROM families WHERE id = $1 FOR UPDATE` | 把同一 Family 的 primary 判定串行化，避免 check-then-insert 竞态 |
| 2. 应用判定 | **独立语句** `SELECT EXISTS (SELECT 1 FROM cases WHERE family_id = $1 AND is_primary AND status <> 'CLOSED')` | 决定本次 `is_primary` |
| 3. 数据库不变量 | `CREATE UNIQUE INDEX cases_one_primary_open_per_family ON cases (family_id) WHERE is_primary AND status <> 'CLOSED'` | partial unique index，最后防线；任何绕过应用路径的写入都会被拒绝 |

#### 3.3 为什么这样写

- **不把 `FOR UPDATE` 与 `EXISTS` 合并为一条语句/CTE**：READ COMMITTED 下，同一语句共享同一快照；只有把「锁语句」与「判定语句」拆开，第二条语句才会在拿到锁之后取得**新快照**，看到前一个事务已提交的 Case。
- **不靠 `SELECT` 后 `INSERT` 的裸竞态**：没有 Family 行锁时，两个事务都读到「无 primary」，会同时插入 primary。
- **不把 unique violation 当正常产品流程**：正常并发由串行化保证，第二个请求会读到 primary 并写 candidate。若仍然出现唯一冲突，说明不变量被绕过（代码缺陷或外部写入），属于**不变量破坏**：事务回滚，返回真实 `500 INTERNAL_ERROR`，不伪装成 201，也不转成 409 正常分支。
- **隔离级别**：使用 Slice 1 默认的 READ COMMITTED。不提高 SERIALIZABLE（会引入不必要的可重试失败与复杂度），也不使用 advisory lock（跨 Family 粒度不必要，且不易审计）。
- **权限前提**：`SELECT ... FOR UPDATE` 需要 runtime 角色对 `families` 具备 `UPDATE` 权限。Slice 1 的 `GRANT SELECT, INSERT, UPDATE, DELETE ON families TO xiaoshuyin_app` 已满足；Implement Gate G5 必须现场确认。若 Slice 1 final 收紧该授权，则本 Plan 的锁机制不可实施，必须回到评审，不得改为无锁 check-then-insert。

#### 3.4 并发行为

| 场景 | 结果 |
|---|---|
| 同 Family，两个不同 key，均合法 | 一个 201 primary=true；一个 201 primary=false；均落库、均有 event/audit |
| 同 Family，同 key，相同 payload | 一个业务结果；另一个 REPLAY 原响应；不新增 Case/event/audit |
| 同 Family，同 key，不同 payload | 仅 shared contract 语义：一个成功；另一个 `MISMATCH → 409`。当前 CASE_CREATE 请求体无第二种合法 payload，该行不由 HTTP 触发 |
| Family 已有 primary 未结 Case | 新 Case 一律 candidate |
| 数据库索引冲突（异常） | 回滚 + `500 INTERNAL_ERROR`；不产生部分写入 |

#### 3.5 锁顺序（所有 Case 写路径统一）

```text
idempotency 占位（INSERT ... ON CONFLICT DO NOTHING）
→ families 行锁（FOR UPDATE）
→ cases 存在性判定（独立 SELECT）
→ INSERT cases
→ INSERT case_events
→ INSERT business_audit_events
→ UPDATE idempotency 回填
→ COMMIT
```

未来 `switch-primary` 必须沿用「先 Family 行锁」的顺序；本 Slice 不实现该命令。

#### 3.6 Retry policy

- 应用**不做自动重试**（不在应用层放大事务与副作用）。
- 锁等待超时 / 死锁 → 事务回滚 → `500 INTERNAL_ERROR` 真实失败；客户端可凭同一幂等键重试。
- 幂等 REPLAY 由数据库唯一索引 + 占位模式保证，不依赖进程内缓存。

---

### D-4 Case Create 事务序列（唯一确定）

```text
0. 认证：Bearer token → actor {accountId, personId}；缺失 → 401 UNAUTHENTICATED
1. 解析当前目标 Family（identity 上下文事务，复用 Slice 1 语义）
   0 行 → 404 CURRENT_FAMILY_NOT_FOUND（Slice 1 错误码，不定义第二套）
   >1 行 → 沿用 Slice 1 final 的确定性 current-family 语义；G11 未通过时禁止 Implement
2. withRlsTransaction({familyId, accountId, personId, purpose: 'FAMILY_MANAGEMENT'})
3. 读取 families.created_by_person_id（RLS 已限定当前 Family）
4. authorize({actor, product:'V1', family:{familyId, createdByPersonId}, case:null,
             resource:'CASE', action:'CASE_CREATE', purpose:'FAMILY_MANAGEMENT'})
   DENY → 403 CASE_ACCESS_DENIED（无任何 Case 数据）
5. 幂等占位：INSERT INTO idempotency_keys(...) ON CONFLICT (scope) DO NOTHING RETURNING id
   - 未插入（已有行）→ SELECT ... FOR SHARE
       hash 相同 → REPLAY：返回已存 status/body；不取 Family 锁、不写业务
       hash 不同 → 409 IDEMPOTENCY_PAYLOAD_MISMATCH
   - 插入成功 → 首次执行
6. SELECT id FROM families WHERE id = $1 FOR UPDATE        ← Family 串行化点
7. SELECT EXISTS(primary 未结 Case)                        ← 独立语句、新快照
8. INSERT cases(..., status='OPEN', phase='INTAKE', is_primary=<判定>, version=1)
9. INSERT case_events(..., 'CASE_CREATED', metadata={primary, version})
10. INSERT business_audit_events(..., 'CASE_CREATED', 'CASE', caseId, metadata={primary, version})
11. UPDATE idempotency_keys SET response_status=201, response_body=<完整响应> WHERE id=<占位 id>
12. COMMIT
13. 返回 201 + 响应体
```

**原子性**：`Case`、`case_event`、`business_audit_event`、`idempotency response` 要么全部成立，要么全部不成立。
任何一步抛错 → `withRlsTransaction` 的 catch 执行 `ROLLBACK` → 外层映射真实错误。
**部分成功禁止**：不允许「先建 Case，事后再写事件/审计/幂等」。

`GET` 列表 / 详情**不进入写事务**：仍在 `withRlsTransaction` 内只读（RLS 需要 family 上下文），不写 `case_events` / `business_audit_events`。

---

### D-5 幂等（`CASE_CREATE`）

#### 5.1 Transport（A-2 决定）

**决定**：`idempotencyKey` 作为 `POST /api/v1/cases` 的 **JSON 请求体必填字段**（8–128 字符）。

**理由**：
1. Slice 1 **代码侧单事实源**（`packages/contracts/src/schemas.ts`）与 runtime 已经使用 body 字段 `idempotencyKey`（`CreateFamilyRequest` / `CreateMemberRequest` / `CreateConsentRequestRequest`）。
2. §27A 规定「Schema 只能有一个代码侧事实源」。Case 契约应沿用它，而不是另建 header 机制。
3. Slice 1 手写 OpenAPI 中的 `Idempotency-Key` header 与 runtime 不一致，是 Slice 1 final closeout（G9）待收敛项；**Slice 2 不复制这个偏差**，也不因此创造第二套 transport。

**Gate 约束**：若 Slice 1 final 基线最终统一为 header，则在 Implement 前触发 contract re-alignment，更新本 Plan 与 OpenAPI 后继续；不得两套同时存在。
**冻结状态**：本选择为 Frozen Technical Decision **R1**，Implement AI 不得临场重新选择；若 Slice 1 final G9 改为 header，Slice 2 必须先返回 Plan Review 更新契约。

#### 5.2 Canonical payload hash

```text
request_hash = sha256(canonicalJson({
  familyId: <已验证的当前目标 Family ID>,
  body: <Zod strict 解析后的请求体，去掉 idempotencyKey>
}))
```

- `canonicalJson`（排序键、无空白）与 `hashPayload` 复用 `packages/domain/src/idempotency.ts`。
- **当前 `body` 规范化结果恒为 `{}`**（本 Slice 请求体只有 `idempotencyKey`）。
- **familyId 是 canonical command context，不是客户端提交字段**：它不属于 idempotency scope，但会改变业务结果的归属。若不进 hash，同一 key 可在不同 Family 之间回放，属于跨家庭数据泄漏（违反 FR-010 / V1-C21）；若允许客户端提交 `familyId`，则会伪造上下文。客户端提交 `familyId` 仍按 strict schema 返回 422。
- **actor / command_type 不重复进入 hash**：`idempotency_keys` 的唯一键已经是 `(actor_account_id, command_type, idempotency_key)`，重复混入没有额外区分力，只会让 payload 语义与 scope 语义耦合。该理由必须在实现注释中写明。
- **请求体必须经过 Zod strict 解析后再 hash**：未知字段直接 422，不进入 hash；因此不存在「同语义不同序」误判。
- 未来若 hash 输入语义需要变化，必须通过新 `command_type` 或显式迁移处理，不得静默改算法。

#### 5.3 Replay / Mismatch

| 情形 | 行为 |
|---|---|
| 相同 key + 相同 hash | 返回已存 `response_status`（201）与 `response_body`；不新建 Case；不追加 `case_event` / `business_audit_event`；不增加任何行 |
| 相同 key + 不同 hash | `MISMATCH` → `409 IDEMPOTENCY_PAYLOAD_MISMATCH`；不修改原 Case、不写任何新行 |
| 不同 key | 各自独立执行业务（受 primary 串行化约束） |

**Mismatch 可达性（当前命令形状，冻结澄清）**：`POST /api/v1/cases` 的唯一合法业务 body 是 `{idempotencyKey}`；去掉幂等键后 `body = {}`。因此本 Slice 的 **public HTTP API 不存在第二种合法业务 payload**，`409 IDEMPOTENCY_PAYLOAD_MISMATCH` 在 HTTP 层不可达。该分支仍必须在 **shared idempotency domain / repository contract 层**实现并验证（same scope key + different `request_hash` → `MISMATCH` → 409 映射），但**不得**通过切换 actor（会改变 scope）、伪造 Family 上下文或新增无业务意义字段制造假场景；也不得为了测试可达而扩大 public 请求体。

**占位模式**：`INSERT ... ON CONFLICT DO NOTHING RETURNING id` 先占位（`response_status=0`、`response_body='{}'`，同事务内回填）。
并发同 key 时，第二个事务在唯一索引冲突上等待第一个提交/回滚：提交 → 第二个读到已提交行 → REPLAY；回滚 → 第二个插入成功并执行。占位值在事务外不可见，不会泄露。

#### 5.4 不使用第二张表

`CASE_CREATE` 复用 `idempotency_keys`；只通过 reviewed migration 扩展 `command_type` CHECK 白名单。不得新建 `case_idempotency` 或类似表。

---

### D-6 Authorization 增量（不新建 `authorizeCase()`）

#### 6.1 扩展点

| 维度 | Slice 1 现状 | Slice 2 增量 |
|---|---|---|
| `Action` | 9 个 Family / Consent 动作 | 新增 `CASE_CREATE`、`CASE_LIST`、`CASE_READ` |
| `Resource` | `SELF` / `FAMILY` / `MEMBER` / `CONSENT` | 新增 `CASE` |
| `AuthInput.case` | 固定 `null` | `{ caseId: string } \| null` |
| `AuthInput.family` | `{ familyId }` | `{ familyId; createdByPersonId?: string }`（可选字段，向后兼容） |
| `DenyReason` | 8 个 | 新增 `CASE_CONTEXT_REQUIRED` |

#### 6.2 判定规则（fail-closed）

1. Case 动作不属于注册表 → `UNSUPPORTED_ACTION`。
2. Case 动作 `family === null` → `FAMILY_CONTEXT_REQUIRED`。
3. Case 动作 `purpose !== 'FAMILY_MANAGEMENT'` → `UNSUPPORTED_PURPOSE`（不新增 Purpose 枚举）。
4. Case 动作要求 `family.createdByPersonId` **已提供且等于 `actor.personId`**；缺失或不等 → `NOT_FAMILY_MANAGER`（不静默放行）。
5. `CASE_CREATE` / `CASE_LIST` 要求 `case === null`；若传入非空 → `UNSUPPORTED_DIMENSION`（拒绝伪造 Case 上下文）。
6. `CASE_READ` 要求 `case !== null`；否则 `CASE_CONTEXT_REQUIRED`。
7. 既有动作行为不变；既有 `case !== null → UNSUPPORTED_DIMENSION` 规则只对**非 Case 动作**生效（现有 domain 测试 `FAMILY_READ + case={}` 仍通过）。

#### 6.3 Case 归属不由 `authorize()` 推断

`authorize()` 是纯函数，不读数据库，因此**不判断** `case.familyId`。Case 是否属于当前 Family 由两层保证：

1. `withRlsTransaction` 设置 `app.family_id`；
2. 所有 Case 查询在 RLS policy `family_id = app_family_id()` 下执行；跨 Family 的 Case 返回 0 行。

`case_id` 只作为「待验证参数」进入查询，ID 存在不构成访问依据。

#### 6.4 不建立的东西

不建 Case role、Participant role、RBAC、Visibility Matrix、Permission DSL、`case_participants` 表或占位。
普通 Family membership / guardian relationship 不自动授予 Case 访问（FR-009）。

#### 6.5 错误映射

| 情形 | 端点 | 响应 |
|---|---|---|
| 非管理主体（Family 已解析） | `POST /cases`、`GET /cases` | `403 {"code":"CASE_ACCESS_DENIED","message":"Case access denied"}` |
| 非管理主体（Family 已解析） | `GET /cases/:id` | `404 {"code":"CASE_NOT_FOUND","message":"Case not found"}` |
| Case 不存在 / 跨 Family / 无访问资格（Family 已解析） | `GET /cases/:id` | 同上，**响应体逐字节一致**，无 `details` |
| Actor 尚无任何 Family | 三个端点 | 沿用 Slice 1 `404 CURRENT_FAMILY_NOT_FOUND`，不带 Case 字段 |
| 目标 Family 未合法解析 | 三个端点 | 沿用 Slice 1 Family 授权失败语义，不定义第二套 Family 错误码 |

说明：详情端点对「Family 已解析但非管理主体」选择 404 而非 403，是 D6 的明确要求；该 404 不削弱 RLS（RLS 仍零行 / 拒写）。

---

### D-7 RLS（Family 隔离最后一道防线）

| 表 | ENABLE | FORCE | Policy |
|---|---|---|---|
| `cases` | 是 | 是 | `USING (family_id = app_family_id())` / `WITH CHECK (family_id = app_family_id())` |
| `case_events` | 是 | 是 | 同上 |

- 无 `app.family_id` 上下文 → `app_family_id()` 为 NULL → 谓词求值 NULL → **SELECT 0 行 / 写入被拒**。
- 错误 Family 上下文 → 0 行 / 拒写。
- `xiaoshuyin_app` 非 table owner、`NOBYPASSRLS`（继承 Slice 1）。
- 应用层 manager 判定仍由 `authorize()` 完成；RLS **不做** manager / participant 判定。
- 不把未来 Participant visibility、Case 角色或 purpose 矩阵写进 policy。
- `case_events` 通过 `family_id` 隔离；复合 FK `(case_id, family_id)` 保证事件与 Case 同 Family。

---

### D-8 Case Event 与 Business Audit 的职责划分

| 维度 | `case_events` | `business_audit_events` |
|---|---|---|
| 定位 | Case 领域历史（产品事实） | 跨领域业务审计（谁对哪个资源做了什么） |
| 作用域 | `(family_id, case_id)` | `(family_id, resource_type='CASE', resource_id=case_id)` |
| 本 Slice 事件 | `CASE_CREATED` | `CASE_CREATED` |
| 记录内容 | actor_account_id、event_type、occurred_at、metadata `{primary, version}` | 同左 + resource_type / resource_id |
| 读取 | 本 Slice 无对外读取端点 | 本 Slice 无对外读取端点 |
| append-only | app role 只有 SELECT/INSERT | 沿用 Slice 1 追加语义 |
| 不能做 | 不存问题正文、不存访问日志、不覆盖历史 | 不做 access log、不为 GET 写审计 |

**为什么两个都要写**：§7.8 明确 `case_events` 是领域历史，§7.9 明确 `business_audit_events` 是审计；二者不是同一语义，不能互相替代，也不能合并成一个新平台。
**为什么同一事务**：避免 Case 已存在但无创建证据的中间状态（FR-014 / SC-007）。
**为什么不合并成一套**：业务审计需要跨资源类型统一检索；领域历史需要按 Case 稳定追溯。合并会迫使一方牺牲语义。

---

### D-9 API 契约（详见 `contracts/`）

只暴露 3 个端点；不新增 `/cases/current`、没有 transition endpoint。

#### 9.1 `POST /api/v1/cases`

- 认证：Bearer。
- 请求体（strict，`additionalProperties: false`）：`{ "idempotencyKey": string(8..128) }`。
- 客户端提交 `familyId` / `createdByPersonId` / `status` / `phase` / `primary` / `version` / `title` / `description` 等任何字段 → `422 VALIDATION_ERROR`（显式拒绝，不静默忽略）。
- 成功：`201` + `CaseResponse`（identity context 的 Case 容器）。
- 错误：`401 UNAUTHENTICATED`、`403 CASE_ACCESS_DENIED`、`404 CURRENT_FAMILY_NOT_FOUND`、`409 IDEMPOTENCY_PAYLOAD_MISMATCH`（合同保留；当前请求体形状下 HTTP 层不可达，见 D-5.3）、`422 VALIDATION_ERROR`、`500 INTERNAL_ERROR`。

#### 9.2 `GET /api/v1/cases`

- 成功：`200 { "items": CaseResponse[] }`（沿用 Slice 1 集合端点 `items` 命名）。
- 排序：`primary DESC, created_at ASC, id ASC`（确定性）。
- 空 Family：`200 { "items": [] }`，不伪造占位 Case。
- 分页：**本 Slice 不实现**（Frozen Technical Decision **R2**）。理由：正式需求（U04 / §28.3）未给出分页约束；单 Family Case 数量小；返回全部才能无条件保证 primary 可唯一识别。
- 错误：`401`、`403 CASE_ACCESS_DENIED`、`404 CURRENT_FAMILY_NOT_FOUND`。

#### 9.3 `GET /api/v1/cases/:id`

- 成功：`200` + `CaseResponse`。
- 不存在 / 跨 Family / 无资格：`404 {"code":"CASE_NOT_FOUND","message":"Case not found"}`；**无差别的响应体**，不含 Family ID、status、phase、primary、version、creator 或任何 Case 字段。
- 错误：`401`、`404 CASE_NOT_FOUND`（Family 已解析）、`404 CURRENT_FAMILY_NOT_FOUND`（Family 未解析，沿用 Slice 1）。

#### 9.4 `CaseResponse` 字段（A-3 决定）

```json
{
  "id": "<uuid>",
  "status": "OPEN",
  "phase": "INTAKE",
  "primary": true,
  "version": 1,
  "createdAt": "<ISO-8601 UTC>",
  "updatedAt": "<ISO-8601 UTC>"
}
```

- 沿用 Slice 1 风格：平铺对象、无 `data` wrapper、camelCase、UUID 字符串、ISO 8601 时间、错误体 `{code, message, details?}`。
- **不返回** `familyId`（当前 Family 由请求上下文确定）、`createdByPersonId`（无本 Slice 消费方，减少 PII 面）、任何内容字段。
- `status` 与 `phase` 是两个独立字段，不合并、不互相推导。

---

### D-10 Version 与未来乐观锁基础

- 初始 `version = 1`（与 Slice 1 `consent_records.version` 从 1 开始一致）。
- 本 Slice 只读 `version`：不实现 `PATCH /cases/:id`、不实现 `If-Match`、不实现 increment 路径。
- 数据库保留 `version integer NOT NULL CHECK (version >= 1)` 与 `updated_at`，为未来 §8.6 的乐观并发合同提供正确基础；但**不预造**任何更新命令或空壳接口。
- 结构 / 路由断言必须证明不存在修改 Case 的 SQL 路由。

---

### D-11 Migration 策略

| 项 | 决定 |
|---|---|
| 既有 migration | **不修改** `db/migrations/001_initial_schema.sql`；不得改动 Slice 1 已提交的 migration |
| 新 migration | 新增 `db/migrations/<next-after-slice1-final>_case_core.sql`。**本 Plan 不写死序号**；Implement Gate（G2/G3）后按 Slice 1 final 实际编号命名 |
| 变更方式 | 只能通过 reviewed migration file；禁止 `drizzle-kit push` |
| 执行角色 | `xiaoshuyin_migrator`（table owner）；runtime 仍为 `xiaoshuyin_app` |
| 既有 CHECK 扩展 | 对 `business_audit_events.event_type` / `resource_type`、`idempotency_keys.command_type` 采用 `DROP CONSTRAINT` + `ADD CONSTRAINT` 的 reviewed SQL；实现前读取 `pg_constraint` 确认真实约束名（内联匿名 CHECK 的默认名可能随 Slice 1 final 变化） |
| migration 内容顺序 | 1) 新增 enum → 2) `cases` → 3) `case_events` + 复合 FK → 4) 索引（含 partial unique）→ 5) ENABLE/FORCE RLS + policies → 6) GRANT → 7) 既有表 CHECK 扩展 |
| 回滚 | 本 Slice 无数据回填；回滚 = 删除新表 / 新 enum / 新 policy / 新索引 + 还原两个 CHECK 白名单（实现阶段提供 down 步骤说明，不自动执行） |

**为什么 CHECK 扩展放在最后**：新表与 RLS 先就位，避免在扩展白名单与建表之间出现「可写入但无表」或「有表但不可写」的中间态；整个 migration 在一个事务中执行（`db-migrate.mjs` 已保证）。

---

### D-12 明确不做（与 spec Out of Scope 对齐）

- 不建 `case_participants`、`assertions`、`observations`、`dialogue_messages`、`problem_formulations`、`scene_*`。
- 不建 Safety / Plan / Task / Review / Follow-up / Notification / AI / Memory。
- 不建任何 Case Status / Phase 转换命令、路由、服务或占位。
- 不建 `/cases/current`、`switch-primary`、`pause`、`resume`、`close`、`recurrences`。
- 不建 UI、运营后台、数据权利端点。
- 不建 Case role / RBAC / Visibility Matrix / Permission DSL。
- 不为 GET 写 `case_event` / `business_audit_event`。
- 不实现 `PATCH` / `If-Match` / 更新路径。

---

## Existing Contracts Reused

- `Docs/V1技术设计.md` §7.1：`families` / `persons` / `family_members` 的基数与 `created_by_person_id` 语义。
- §7.2 / §7.8：`cases` / `case_events` 表组与领域历史定位。
- §7.9：`business_audit_events` 追加审计。
- §8.1：单 primary 由数据库保证。
- §8.5：`actor_id + command_type + idempotency_key` 与「同 key 不同 payload → 409」。
- §9 / §9.1：`authorize()` 输入形状、`withRlsTransaction`、`app.family_id` / `app.person_id` / `app.account_id` / `app.purpose`、双角色、FORCE RLS、无上下文默认拒绝。
- §27A：Zod → Fastify → OpenAPI → generated client 的单事实源链。
- §28.3：Case 端点集合。
- Slice 1 真实契约：`packages/authorization/src/authorize.ts`、`packages/domain/src/idempotency.ts`、`apps/server/api/src/db/tx.ts`、`apps/server/api/src/plugins/error-handler.ts`、`packages/contracts/src/schemas.ts`。

## Data and Migration Impact

- 新增 2 张表（`cases` / `case_events`）、2 个 enum（`case_status` / `case_phase`）、1 个 partial unique index、2 个普通索引、2 条 policy、若干 GRANT。
- 新增 1 个复合外键 `case_events (case_id, family_id) → cases (id, family_id)`，因此 `cases` 需要 `UNIQUE (id, family_id)`。
- 既有表变更：`business_audit_events` 两个 CHECK 白名单扩值；`idempotency_keys` 一个 CHECK 白名单扩值。无列变更、无数据回填。
- 不修改 001 migration；不新增第二套幂等表或审计平台。
- 无 pgvector / pg_jieba / pg-boss / Drizzle push。

## Authorization / Safety / Compliance Impact

- **Authorization**：`authorize()` 增量扩展 Case 三动作 + Case 维度；manager 判定复用 `families.created_by_person_id`；未知 / 缺失上下文 fail-closed。
- **RLS**：两张新表 ENABLE + FORCE；运行角色非 owner、NOBYPASSRLS；无上下文零行 / 拒写。
- **Consent**：本 Slice 不新增 Consent 语义，不复用 Consent 作为 Case 访问依据；`UNDER_14` 的处理门禁属 Slice 1，本 Slice 不绕过、不扩展。
- **Safety**：本 Slice 无 Safety State / SAFETY_HOLD 对象，无副作用；显式 N/A。但 Case 创建不伪造 Safety 状态，也不把 `status` 写成 `SAFETY_HOLD`（创建固定 `OPEN`）。
- **Compliance**：本 Slice 不采集问题正文、证据、孩子原话；不扩大敏感数据面；Case 容器 metadata 不含 PII。

## API / Contract Impact

- 新增 3 个端点契约（`contracts/cases-api.openapi.yaml`），不改变 `/auth`、`/me`、`/families`、`/consents` 现有语义。
- 新增 Case Zod schema（`packages/contracts`），既有 schema 不变。
- 错误映射新增 `CASE_NOT_FOUND`(404)、`CASE_ACCESS_DENIED`(403)；复用 `IDEMPOTENCY_PAYLOAD_MISMATCH`、`VALIDATION_ERROR`、`CURRENT_FAMILY_NOT_FOUND`、`UNAUTHENTICATED`、`INTERNAL_ERROR`。
- OpenAPI 必须可由 Zod 生成并通过 `openapi:check`（G9 / G10 后以真实脚本为准）；Plan 阶段产物是契约基线，不是已生成物。

## AI / RAG / Eval Impact

**N/A**。本 Slice 不调用模型、不写 prompt、不做 RAG、不产生 AI run / Memory / Follow-up。

## Async / Notification / Side-Effect Impact

**N/A（无外部副作用）**。Case 创建是同步事务；不 enqueue pg-boss、不发通知、不触发 AI、不创建 Schedule。
幂等 / 并发 / 失败语义见 D-3 / D-5；事务失败不留下部分写入。

---

## Project Structure

只列本 Slice 真实会触碰的路径（源自 `Docs/V1技术设计.md` §3 与 Slice 1 现状）：

```text
specs/002-case-core/
  spec.md                                  # 冻结（closeout 仅做 Q3 幂等可达性最小澄清）
  plan.md                                  # 本文件
  research.md                              # Phase 0
  data-model.md                            # Phase 1
  contracts/
    cases-api.openapi.yaml                 # 新增 3 端点契约
    authorization-rls-and-idempotency.md   # 授权 / RLS / 幂等 / 事务
    case-events-and-business-audit.md       # 事件与审计职责
  quickstart.md                            # Phase 1 验证指南

db/migrations/
  <next-after-slice1-final>_case_core.sql  # 新增；不写死序号

packages/contracts/src/schemas.ts          # 新增 Case schema（不改既有）
packages/authorization/src/authorize.ts    # 增量扩展 Case 维度
apps/server/api/src/routes/cases.ts        # 新增 Case 路由
apps/server/api/src/app.ts                 # 注册 Case 路由（一行）
apps/server/api/src/plugins/error-handler.ts # 新增 2 个错误码映射

tests/db/cases-schema.test.ts              # 新增
tests/db/cases-rls.test.ts                 # 新增
tests/db/cases-primary-concurrency.test.ts # 新增
tests/domain/case-authorization.test.ts    # 新增
tests/integration/cases-create.test.ts     # 新增
tests/integration/cases-read.test.ts       # 新增
tests/integration/cases-authorization.test.ts # 新增
tests/integration/cases-idempotency.test.ts   # 新增
tests/integration/cases-scope.test.ts      # 新增
```

**既有测试的合法增量对齐**（不是削弱，而是把 Slice 1 的「恰好 9 张 RLS 表」投影扩展到 11 张）：

- `tests/db/rls.test.ts`：表计数与 policy 计数需按 Slice 2 新表扩展。
- `tests/db/roles.test.ts`：`TABLES` 清单需加 `cases` / `case_events`。
- `scripts/guard-static.mjs`：`FAMILY_TABLES` 需加 `cases` / `case_events`（或等价 scope 断言）。
- 这些修改在 Tasks / Implement 阶段执行；本 Plan 提交不改 Slice 1 文件。

---

## Verification Plan

> 本 Plan 只定义验证路径，不执行测试。Plan 阶段所有 command 均**未执行**，不得作为通过证据。

| Requirement / Acceptance | Test or evidence | Command / environment | Expected result |
|---|---|---|---|
| FR-001 / FR-002 / FR-003（schema、uuidv7、enum 词汇） | DB 结构断言 | `bunx vitest run tests/db/cases-schema.test.ts` | `cases` / `case_events` 存在；`id` 默认 `uuidv7()`；`case_status` / `case_phase` 取值与 §6.1 / §6.2 完全一致且顺序一致；不存在禁止列 |
| FR-004 / D1（创建固定 OPEN + INTAKE） | integration + DB | `bunx vitest run tests/integration/cases-create.test.ts` | 创建后响应与 DB 行均为 `OPEN + INTAKE`；无任何路径写入其它值 |
| FR-005 / FR-018（无 transition / 越界路由） | route enumeration + DB introspection | `bunx vitest run tests/integration/cases-scope.test.ts` | 路由表恰为 3 条 Case 端点；不存在 `/cases/current`、pause、resume、switch-primary、close、recurrences、messages、assessments、participants |
| FR-006 / FR-007 / SC-001 / SC-002（单 primary、首个 primary、候选保留） | DB + integration | `bunx vitest run tests/integration/cases-create.test.ts` | 串行创建：第 1 个 true，后续 false；全部可读取；无 Plan / Task / Notification 副作用 |
| 并发 primary 不变量（场景 3 / SC-002） | 真实 PG 多连接并发 | `bunx vitest run tests/db/cases-primary-concurrency.test.ts` | 两个不同 key 并发创建后，`primary=true AND status<>'CLOSED'` 计数 = 1；两个 Case 均存在；重复运行仍成立 |
| 同 key 并发（场景 10 / SC-006） | 并发 integration | `bunx vitest run tests/integration/cases-idempotency.test.ts` | 只产生 1 个 Case、1 组 event、1 组 audit；其余为 REPLAY 原响应；不存在第二个业务结果 |
| FR-008 / FR-009 / FR-024（manager allow / member deny / guardian deny） | integration | `bunx vitest run tests/integration/cases-authorization.test.ts` | manager：create/list 201/200；member / guardian：create/list `403 CASE_ACCESS_DENIED`；detail `404 CASE_NOT_FOUND`；均无 Case 数据 |
| FR-010 / FR-023 / SC-004（跨家庭 + 详情 404 anti-enumeration） | integration + DB | `bunx vitest run tests/integration/cases-read.test.ts` | Family A 读 Family B Case → `404 CASE_NOT_FOUND`，响应体无任何 Case 字段；Family A 的 RLS 上下文直查 Family B Case → 0 行 |
| FR-011 / §9.1（RLS ENABLE/FORCE、无上下文、错误 Family、runtime role） | DB 结构 + 直连查询 | `bunx vitest run tests/db/cases-rls.test.ts` | `relrowsecurity=true`、`relforcerowsecurity=true`；无上下文 SELECT 0 行、INSERT 被拒；错误 family 0 行；`rolbypassrls=false`；owner 为 migrator |
| FR-012 / FR-013 / SC-009（HTTP 可达幂等、version 初始值） | integration + domain | `bunx vitest run tests/domain/case-authorization.test.ts tests/integration/cases-idempotency.test.ts` | 同 key 同 canonical payload（含并发）返回原 201 body 且只有一个业务结果；`version=1` 且无更新路径改变它 |
| FR-012 / §8.5（shared idempotency mismatch contract） | domain + repository/service contract | `bunx vitest run tests/domain/idempotency-hash.test.ts` 与 `tests/integration/cases-idempotency.test.ts` 的 repository/service contract 用例 | 相同 scope key + 不同 `request_hash` → `MISMATCH` → 映射 `409 IDEMPOTENCY_PAYLOAD_MISMATCH`；不改原 Case/结果、不写新行。**不得声称 public HTTP API 存在可达的 different-payload 请求**；不得用换 actor（scope 改变）制造假 mismatch |
| FR-014 / SC-007（Case + event + audit 原子） | integration + DB | `bunx vitest run tests/integration/cases-create.test.ts` | 成功创建后各存在 1 条 `CASE_CREATED`；构造事件 / 审计写入失败时 Case 不落库（回滚证据） |
| FR-015 / 场景 13（客户端不能指定业务字段） | integration | `bunx vitest run tests/integration/cases-create.test.ts` | 携带 status / phase / primary / version / creator / familyId / title → 422；DB 仍为服务端值 |
| FR-016 / FR-017 / SC-010（列表识别 primary、详情独立 status/phase） | integration | `bunx vitest run tests/integration/cases-read.test.ts` | 列表返回 `items`，primary 唯一可识别，每项含 phase/status/version；详情两字段独立；不存在 `/cases/current` |
| FR-019 / FR-020 / FR-021 / FR-022（真实失败、无越界对象、候选无副作用、空结果） | integration + introspection | `bunx vitest run tests/integration/cases-read.test.ts tests/integration/cases-scope.test.ts` | 空 Family → `200 {items: []}`；无 placeholder；无 Plan / Task / Follow-up / Notification 表或路由 |
| FR-025 / D7（读不写审计） | integration + DB | `bunx vitest run tests/integration/cases-read.test.ts` | 读取前后 `case_events` / `business_audit_events` 行数不变；不存在 read-audit 事件类型 |
| SC-003 / SC-005 / SC-008 / SC-011 | 汇总以上用例 | `bunx vitest run`（DB 环境） | 全部通过；无跳过、无 expected-fail |
| 静态守卫（无 drizzle push / 无 secret / 无越界目录） | static guard | `bun run guard:static` | PASS（0 violations）；需在实现阶段把 `cases` / `case_events` 纳入 family table 检查 |
| Typecheck / 单测回归 | CI | `bun run typecheck`、`bunx vitest run tests/domain` | 全绿；Slice 1 既有 domain 测试不被削弱 |
| 迁移可重放 / 结构一致 | migration runner | `bun run db:migrate`（migrator 角色） | 一次成功；重复执行 SKIP；`schema_migrations` 与新文件一致 |
| final CI + converge | CI / converge report | `.github/workflows/ci.yml` 全 job + converge | 全绿；无未解决 gap（G10） |

**环境**：PostgreSQL 18（Stage A compose 或 CI service）；`DATABASE_URL` = app 角色；`MIGRATION_DATABASE_URL` = migrator 角色。
**证据要求**：每条结果必须来自真实命令输出；不能运行的环境报告 `BLOCKED` / `NOT VERIFIED`，不得以“设计已存在”代替证据。

---

## Rollback / Recovery

本 Slice 会改变 schema、policy、GRANT 与两个既有 CHECK 白名单，因此需要回滚说明：

1. **代码回滚**：移除 `routes/cases.ts` 注册与 Case 契约；`authorize()` 的 Case 分支为纯增量，回滚后 Slice 1 行为不变。
2. **schema 回滚**（仅人工、reviewed）：
   - 删除 `case_events` policy / 表；删除 `cases` policy / 索引 / 表；删除 `case_status` / `case_phase` enum。
   - 将 `business_audit_events` 的两个 CHECK 还原为 Slice 1 白名单；将 `idempotency_keys.command_type` CHECK 还原。
   - 注意：若已存在 `CASE_CREATED` 审计行或 `CASE_CREATE` 幂等行，直接还原 CHECK 会失败；必须在回滚前决定这些行的处理（本 Slice 为 Greenfield，预期无存量）。
3. **数据**：本 Slice 无回填、无跨表复制；回滚不涉及数据迁移。
4. **不自动执行**：任何 down migration 都必须人工 review，不在 runtime 自动运行。

---

## Complexity Exceptions

无。所有约束均可在已批准的 V1 技术栈与 Slice 1 基础设施内满足。

---

## Frozen Technical Decisions

以下 R1–R5 已在 Plan Review 中做出选择并**冻结**；它们不是 Implement AI 可以自由重新选择的事项。

| # | 冻结选择 | 理由 | 变更条件 |
|---|---|---|---|
| **R1** | 幂等键为 JSON body 字段 `idempotencyKey` | Slice 1 runtime / Zod 单事实源如此；不创造第二套 transport | 若 Slice 1 final G9 最终改为 `Idempotency-Key` header，Slice 2 MUST 先返回 Plan Review 更新契约，不得 Implement 临场改变 |
| **R2** | Case 列表不分页，返回全部 `items` | U04 / §28.3 未给分页约束；返回全部才能无条件保证 primary 可识别 | 需要正式分页需求时才变更 |
| **R3** | API 字段 `primary`；DB 列 `is_primary` | `primary` 是 SQL 保留字；API 术语与 spec / 上游一致 | 契约字段重命名需显式评审 |
| **R4** | `case_events` append-only 由运行角色只授予 `SELECT / INSERT`，当前不加 trigger | 权限层阻断早于 trigger；runtime 无 UPDATE / DELETE 能力 | 需要防御 owner 误操作时再评审 |
| **R5** | Family 未解析时沿用 Slice 1 final `CURRENT_FAMILY_NOT_FOUND` 等正式 Family 语义 | FR-024 不得定义第二套 Family 错误码 | 上游 Family 语义变化时同步更新 |

以上为冻结技术决策，不改变 spec 的产品语义；不得作为未解决产品问题的替代。

---

## Blockers

**NONE**

本 Plan 无产品级歧义。Slice 1 的实现依赖按 `## 0. Slice 2 Implement Gate` 在 Implement 前重新验证；Gate 失败时报告 `BLOCKED — SLICE 1 IMPLEMENTATION DEPENDENCY`，而不是在本 Plan 中私建替代基础设施。若 G11 失败（current Family 多 Family 选择仍不确定），报告 `BLOCKED — SLICE 1 CURRENT FAMILY SEMANTICS NOT STABLE`，由 Slice 1 修复，Slice 2 不私自修。