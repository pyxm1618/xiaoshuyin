# Implementation Plan: 002-case-core（Case 核心地基）

**Feature**: `specs/002-case-core/spec.md`
**Date**: 2026-11-04
**V1 Phase**: Phase 1 — Common Core 地基（`Docs/V1技术设计.md` §38）
**Slice**: SLICE 2 — Case 容器（`cases` / `case_events` / 单一主要 Case）
**阶段**: Plan — Post-Slice1 Final Dependency Reconciliation（2026-11-07；不改产品语义、不改业务代码）
**前置状态**: Slice 1（`001-family-identity-core`）已 `Final Independent Audit II PASS` → PR #13 merged main → post-merge CI PASS → **CLOSED**，不得重新打开。

---

## 0. Baseline 与 Slice 2 Implement Gate

### 0.1 Baseline（2026-11-07 Post-Slice1 现场只读事实）

| 项 | 值 |
|---|---|
| `origin/main`（最新） | `ee9d07e059566884e0329fb0eb4a4ab9dbf8ea83`（PR #13 merge：Slice 1 Final remediation） |
| Slice 1 状态 | `Final Independent Audit II PASS` → PR #13 merged main → post-merge CI PASS → **CLOSED** |
| Slice 1 Final 关键 commit | `0480e38`（close final audit II F1–F11）、`95cd47b`（refresh T070 quickstart evidence）、`ee9d07e`（PR #13 merge） |
| Slice 2 当前 Head（本 reconciliation 前） | `9ac76f7e8e1640d5e5a448faa062296bd65443f9` |
| Slice 2 分支 / worktree | `feat/002-case-core`（`/Users/milushangdi/Projects/xiaoshuyin-002-case-core`） |
| 旧 merge base | `ed0d5fbee8c6764be704da8d80fb27ad2172222b` |
| Ahead / Behind（`origin/main...HEAD`） | **behind 4 / ahead 38**（以现场 `git rev-list --left-right --count` 为准） |
| Slice 2 工作树状态 | clean（本 reconciliation 开始时） |
| 冻结 Spec | `specs/002-case-core/spec.md`（**产品语义不变；本轮不修改**） |

> **本轮性质**：不是重新 Specify / Clarify / 设计 Case / 重做 Independent Converge，而是检查最新 Slice 1 Final baseline 对 Slice 2 已冻结 Plan / Contracts / Tasks 的影响，并完成最小 dependency reconciliation。**禁止修改 `apps/**`、`packages/**`、`db/**`、`tests/**`、`scripts/**`、`Docs/**`、`specs/001-family-identity-core/**`。**

### 0.2 Dependency Gate（Post-Slice1 Final）

进入下一阶段 Slice 2 implementation 前，必须逐项满足下列固定顺序。**任一不满足即停止**：

| # | Gate 项 | 当前状态（2026-11-07） |
|---|---|---|
| 1 | Slice 1 Final Audit II PASS | **已满足**（CLOSED） |
| 2 | Slice 1 merged `main` | **已满足**（`ee9d07e`） |
| 3 | Slice 1 post-merge CI PASS | **已满足** |
| 4 | merge latest `main` into `feat/002-case-core` | **下一阶段执行**（禁止 rebase / force push） |
| 5 | resolve shared-infrastructure conflicts | **下一阶段执行** |
| 6 | preserve Slice 1 Final guarantees | **下一阶段执行** |
| 7 | adapt Slice 2 idempotency contract to `Idempotency-Key` header | **下一阶段执行**（本 Plan 已完成契约修正） |
| 8 | full regression | **下一阶段执行** |

> Gate 4–8 由**开发 AI** 在 merge 阶段执行；本轮计划 AI 只完成 Plan / Contract / Tasks / Quickstart 的依赖修正，**不执行 merge、不改业务代码**。

**技术验证项（Gate 4 完成后现场重跑）**：

| # | 验证项 | 验证方式 |
|---|---|---|
| G1 | Slice 1 Final 已合并 main | `git merge-base --is-ancestor ee9d07e origin/main` 退出 0 |
| G2 | Slice 2 已包含最新 main | `git merge origin/main`（普通 merge，禁止 rebase / force push）；`git merge-base --is-ancestor origin/main HEAD` 退出 0 |
| G3 | Slice 1 Final schema / migration 一致 | `families.created_by_person_id NOT NULL UNIQUE`、`family_members` UNIQUE、`business_audit_events` / `idempotency_keys` 列与 CHECK；`schema_migrations` 记录 |
| G4 | Slice 1 Final `authorize()` 形状可增量扩 Case | 现行为 **`AuthorizeFacts` 结构化模型**（见 §0.3）；Case 扩展不得回退为旧的 `family.createdByPersonId` 扁平参数 |
| G5 | `withRlsTransaction` 可复用 | 签名不变；事务内 `set_config(..., true)`；`families` UPDATE 权限满足 `FOR UPDATE` |
| G6 | Slice 1 Final idempotency 行为全绿 | **`Idempotency-Key` header**；`runIdempotentCommand` 共享编排；replay / MISMATCH / 事务内回填 |
| G7 | `business_audit_events` Final 结构 | reviewed CHECK、family RLS、append-only 可用 |
| G8 | RLS / roles / cross-family tests 全绿 | `relrowsecurity` / `relforcerowsecurity`、`rolbypassrls=false`、owner 非 app、无上下文零行 |
| G9 | OpenAPI 基线已稳定 | Slice 1 Final 使用 **`apps/server/api/src/openapi-spec.ts` + frozen YAML ↔ runtime semantic equivalence**；不得回退为“只比较生成文件 diff” |
| G10 | Slice 1 Final CI + independent converge PASS | 全 job green；converge 无未解决 gap |
| G11 | current Family 确定性语义 | 沿用 Slice 1 Final（含 `CURRENT_FAMILY_AMBIGUOUS`）；不得依赖无 `ORDER BY` 的 `rows[0]` |

**Gate 失败处理**：停止，报告 `BLOCKED — SLICE 1 IMPLEMENTATION DEPENDENCY`，列出失败项与现场输出。
**Current Family 专项**：若 G11 失败，报告 `BLOCKED — SLICE 1 CURRENT FAMILY SEMANTICS NOT STABLE`。
**禁止**：为了继续而私建替代 Family / Consent / RLS / 幂等 / 审计 / 授权基础设施；禁止在 Slice 2 分支重设计 Slice 1 冻结基线。

### 0.3 已知 Slice 1 Final 真实形状（2026-11-07 只读盘点）

> 下表是**最新 main（`ee9d07e`）**的真实形状，取代旧 Plan 对 Slice 1 早期实现的假设。Slice 2 必须**继承**这些保证，不得回退到旧形状。

| Shared Area | Slice 1 Final 真实形状 | 对 Slice 2 的约束 |
|---|---|---|
| Migration | `db/migrations/001_initial_schema.sql` 单文件；9 张业务表 ENABLE+FORCE RLS；`accounts` 无 RLS | Slice 2 只新增 `002_case_core.sql` / `003_case_idempotency_key_bytes.sql`，不修改 001 |
| Family manager | `families.created_by_person_id uuid NOT NULL UNIQUE` | Case manager 判定复用该事实，但**通过 `AuthorizeFacts.familyCreatedByPersonId`**，不是旧的 `family.createdByPersonId` |
| RLS / 事务 | `withRlsTransaction` 先 `set_identity_context` 再 `set_family_context`，`set_config(..., true)` | Case 业务事务直接复用，不自建上下文 |
| `authorize()` | **结构化 `AuthorizeFacts` + 结构化 `Resource` 对象**；`case: null` 硬编码（Slice 1）；`basis = { membership, manager, purpose }`；`DenyReason` 含 `NO_ACTOR` / `NOT_FAMILY_MEMBER` / `NOT_FAMILY_MANAGER` / `NOT_GUARDIAN` / `AGE_BAND_UNKNOWN` / `AUTHORIZATION_ERROR` | Slice 2 增量扩展时**必须沿用 `AuthorizeFacts` 模型**，不得恢复旧的 `family.createdByPersonId` + 扁平 `Resource` 字符串 |
| Route 授权适配 | **新增 `apps/server/api/src/authz.ts`**：`decideFamilyAction` / `requireFamilyAction` / `requireSelfAction` / `denyToError`，在同一事务内读 facts | Slice 2 必须复用该唯一入口；不得新建 `authorizeCase()` 或第二套 facts 读取 |
| 幂等 transport | **`Idempotency-Key` HTTP header**（`readIdempotencyKey(req)`，8–128） | Case create 必须使用同一 header；**不得**再接受 body `idempotencyKey` |
| 幂等编排 | `runIdempotentCommand`（peek → identity tx → advisory lock → recheck → business fn → insert）；`idempotency_keys` text 列 | Case 的 bytea amendment 必须与 Slice 1 text 路径共存（见 D-11.1） |
| Contracts | `packages/contracts/src/schemas.ts` 为 **`z.strictObject`**；Slice 1 六个命令的请求体**均无 `idempotencyKey`**；`creator` / `values` / `value` / `source` / `declaredAgeBand` / `channel` 为 Final 形状 | Slice 2 必须采用 Final schemas 作基线，只追加无业务字段的 Case schema |
| Error handler | 统一 `toHttpError`；`FORBIDDEN` / `NOT_FAMILY_MEMBER` / `NOT_FAMILY_MANAGER` / `CURRENT_FAMILY_AMBIGUOUS` 等 Final 码；generic 500 契约由 Slice 1 Final 强化 | Slice 2 只追加 `CASE_NOT_FOUND` / `CASE_ACCESS_DENIED`，并保留 Final 全部码与 generic 500 |
| Runtime env / logging | **新增 `apps/server/api/src/runtime-env.ts`**：生产 fail-fast（`SESSION_SECRET` / `EVIDENCE_HASH_PEPPER` / WeChat secrets）、生产不得 fallback fake provider；`app.ts` 含 `requestLogSerializer`（不记录 raw IP / UA / authorization） | Slice 2 `app.ts` 必须保留 runtime-env / log privacy / provider 选择，只追加 `registerCaseRoutes` |
| OpenAPI | **新增 `apps/server/api/src/openapi-spec.ts`**：从 Zod 构建 generated JSON；frozen YAML ↔ runtime **semantic equivalence**（`openapi-check`） | Slice 2 必须适配该生成 / 检查架构，把自己的 frozen YAML 纳入语义等价检查；不得回退为“只比较生成文件 diff” |
| Test setup | **新增 `tests/setup/api.ts`** | Slice 2 测试必须复用，不复制第二套 app 构建 helper |
| DB evidence / coverage | `db-evidence.mjs` / `coverage-audit.mjs` 已按 Final 计数（9 表 / 10 业务表 / 8 enum / 9 policy） | Slice 2 只做合法增量（11 / 12 / 10 / 11），不得删除 Final 断言 |
| Static guard | `guard-static.mjs` Final 规则 | Slice 2 只追加 `cases` / `case_events` 与 forbidden table scope，不得覆盖丢失 Final guard |
| Current Family | Final 含 `CURRENT_FAMILY_AMBIGUOUS`（多 Family owned 时确定性拒绝，禁止 `rows[0]`） | Slice 2 沿用，不定义第二套 Family 错误码 |

> **关键结论**：Slice 2 当前分支（`9ac76f7`）的 `authorize.ts`、`authz.ts`（缺失）、`idempotency.ts`、`schemas.ts`、`app.ts`、`openapi-generate.mjs` / `openapi-check.mjs` 均基于 **Slice 1 Final 之前的旧基线**。merge main 后必须按上表逐项收敛，**不得**只解决文本冲突而保留旧实现。

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
| metadata | `metadata` | `jsonb NOT NULL`；`CHECK` 要求 JSON object 且 key 恰为 `{primary, version}`；无默认值，必须显式写入 |
| occurred | `occurred_at` | `timestamptz NOT NULL DEFAULT now()` |

**Composite FK**：`(case_id, family_id) REFERENCES cases(id, family_id)`，要求 `cases` 有 `UNIQUE (id, family_id)`。
这条数据库不变量保证事件不可能挂到别的 Family 的 Case 上——即使应用层写错 `family_id`，FK 也会拒绝。

**`metadata` 形状约束（可执行，不是应用层约定）**：reviewed migration 必须为 `case_events.metadata` 建立约束 `case_events_metadata_shape_check`，语义等价于：

```text
jsonb_typeof(metadata) = 'object'
AND metadata ? 'primary'
AND metadata ? 'version'
AND metadata - 'primary' - 'version' = '{}'::jsonb
AND jsonb_typeof(metadata -> 'primary') = 'boolean'
AND jsonb_typeof(metadata -> 'version') = 'number'
AND (metadata ->> 'version')::numeric = trunc((metadata ->> 'version')::numeric)
AND (metadata ->> 'version')::numeric >= 1
```

- 前四项保证 key 集合**恰好**为 `{primary, version}`，拒绝任何额外 key（包括 title / description / 正文 / 用户输入 / PII 字段）。
- `primary` 必须是 boolean；`version` 必须是 integer-compatible number 且 `>= 1`。
- `metadata` **不设默认值**：缺 key、空对象或多余 key 都直接违反 CHECK，创建代码必须显式写入两个字段。
- 不引入通用 JSON Schema engine、不建 metadata framework；只使用 PostgreSQL 原生 CHECK。

**append-only**：`xiaoshuyin_app` 对 `case_events` 只授予 `SELECT, INSERT`，不授予 `UPDATE, DELETE`。
不使用 trigger 兜底，因为最小权限已从权限层阻断；migrator 属于 DDL 角色，不属于 runtime。

#### 2.3 既有表的最小增量

- `business_audit_events`：新增 `event_type = 'CASE_CREATED'`、`resource_type = 'CASE'`。沿用 `family_id` / `actor_account_id` / `resource_id` / `metadata` / `occurred_at`，不新增列。
- `idempotency_keys`：
  - **002_case_core baseline**：只扩展 `command_type = 'CASE_CREATE'`；002 本身**不新增** `idempotency_keys` 列。
  - **Round 2 Owner-approved amendment**：`003_case_idempotency_key_bytes.sql` 新增 `idempotency_key_bytes`；见 D-11.1。
  - 两个阶段都**不新建第二张幂等表**。
- `families` / `persons` / `family_members`：只读使用，不修改。

---

### D-3 Primary Case 并发方案（冻结）

#### 3.1 目标

> 同一 Family 最多一个 `is_primary = true AND status <> 'CLOSED'` 的 Case。

并满足：两个合法、不同幂等键的并发 create 请求，在「Family 当前无 Case」时**都应确定性完成**：一个成为 primary，一个成为 candidate；不得失败、不得两个 primary。

#### 3.1.1 当前 primary 与历史 primary（冻结语义）

> `is_primary = true` 表示“当前 primary assignment”，不是“历史上曾经当过 primary”。

- 本 Slice 所有 Case 只能 `OPEN`，因此一个 Family 最多一个 `is_primary = true`；`GET /api/v1/cases` 中 `primary = true` **唯一表示当前 primary**。
- 未来 `CloseCase` / `SwitchPrimaryCase` / recurrence / replacement 若使某 Case 不再是当前 primary，对应未来 Slice 必须在**自己的事务合同**内清除或转移旧 primary 的 `is_primary`；历史事实由领域事件 / 历史记录表达，不靠长期保留 `is_primary = true`。
- 本 Slice 不实现任何转换、不新增 transition、不改变 primary 字段语义；此处只记录未来合同，防止把 partial unique index 的历史兼容能力误读为 API 的 `primary` 语义。
- 未来 Slice 必须先更新本冻结语义与 Contract，再实现清除 / 转移；不得在完成转换后仍让历史 Case 以 `primary = true` 对外暴露。

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
| 同 Family，同 key，不同 payload | 仅 shared contract 语义：一个成功；另一个 `MISMATCH → 409`。在**同一 actor + 同一 current Family canonical context** 下，当前 CASE_CREATE 请求体无第二种合法 payload，该行不由 public HTTP 触发 |
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
0.1 readIdempotencyKey(req)：header `Idempotency-Key`（8–128）；缺失/非法 → 422 VALIDATION_ERROR
1. 解析当前目标 Family（identity 上下文事务，复用 Slice 1 Final 语义）
   0 行 → 404 CURRENT_FAMILY_NOT_FOUND（Slice 1 错误码，不定义第二套）
   多行 → 沿用 Slice 1 Final `CURRENT_FAMILY_AMBIGUOUS`；G11 未通过时禁止 Implement
2. withRlsTransaction({familyId, accountId, personId, purpose: 'FAMILY_MANAGEMENT'})
3. requireFamilyAction(tx, {
     action: 'CASE_CREATE',
     family: { familyId },
     case: null,
     resource: { type: 'FAMILY', familyId },
     purpose: 'FAMILY_MANAGEMENT'
   })                                   ← 复用 authz.ts；同事务内读 AuthorizeFacts
   DENY NOT_FAMILY_MEMBER / NOT_FAMILY_MANAGER → 403 CASE_ACCESS_DENIED（无任何 Case 数据）
4. 幂等占位（CASE_CREATE bytea 路径）：reserveIdempotency(...) ON CONFLICT DO NOTHING
   - 未插入（已有行）→ getReservedIdempotency（FOR SHARE，bytes + legacy text）
       hash 相同 → REPLAY：返回已存 status/body；不取 Family 锁、不写业务
       hash 不同 → 409 IDEMPOTENCY_PAYLOAD_MISMATCH
   - 插入成功 → 首次执行
5. SELECT id FROM families WHERE id = $1 FOR UPDATE        ← Family 串行化点
6. SELECT EXISTS(primary 未结 Case)                        ← 独立语句、新快照
7. INSERT cases(..., status='OPEN', phase='INTAKE', is_primary=<判定>, version=1)
8. INSERT case_events(..., 'CASE_CREATED', metadata={primary, version})
9. INSERT business_audit_events(..., 'CASE_CREATED', 'CASE', caseId, metadata={primary, version})
10. completeIdempotency(...) 回填 201 + 完整响应
11. COMMIT
13. 返回 201 + 响应体
```

**原子性**：`Case`、`case_event`、`business_audit_event`、`idempotency response` 要么全部成立，要么全部不成立。
任何一步抛错 → `withRlsTransaction` 的 catch 执行 `ROLLBACK` → 外层映射真实错误。
**部分成功禁止**：不允许「先建 Case，事后再写事件/审计/幂等」。

`GET` 列表 / 详情**不进入写事务**：仍在 `withRlsTransaction` 内只读（RLS 需要 family 上下文），不写 `case_events` / `business_audit_events`。

---

### D-5 幂等（`CASE_CREATE`）

#### 5.1 Transport（A-2 决定；Post-Slice1 Final **UPDATED**）

**决定（R1 最终态）**：`CASE_CREATE` 的幂等键由 **`Idempotency-Key` HTTP header** 承载（8–128 字符），与 Slice 1 Final 的六个 mutating command 完全一致。`POST /api/v1/cases` 的 **JSON 请求体不再包含 `idempotencyKey`**；业务 body 是 strict 空对象 `{}`（或按正式 contract 定义为无业务字段的 strict object）。

**Spec 关系**：`spec.md` 的 A-2 明确「§8.5 未规定 header 还是 body；由 Plan 决定，但不得改变本 Spec 的幂等语义」。因此本次是 **transport / implementation dependency 修正，不是产品语义变化**：
- 幂等 scope、replay、MISMATCH→409、并发同 key 语义**完全不变**；
- Spec 中 `{idempotencyKey}` 的表述按 A-2 解释为“Plan 决定 transport 前的示意”，正式 contract 以本 Plan / OpenAPI 的 header 为准；
- **本轮不修改 `spec.md`**（产品语义未变）。

**理由**：
1. Slice 1 Final 的 **`Idempotency-Key` header 已正式冻结**：`apps/server/api/src/idempotency.ts` 导出 `readIdempotencyKey(req)`，六个命令全部走 header；继续使用 body 会形成第二套 transport。
2. Slice 1 Final 的 `packages/contracts/src/schemas.ts` 已移除六个命令的 body `idempotencyKey`，统一改为 `z.strictObject` + header；Slice 2 必须继承同一事实源。
3. 只有 header 是正式 contract；**不得**长期同时支持 body + header。

**确定禁止**：
- 不得从 body 读取 `idempotencyKey`；
- 不得把 `idempotencyKey` 写入 `CreateCaseRequest` schema；
- 不得创建第二套 header parser（必须复用 `readIdempotencyKey`）；
- 不得在 OpenAPI 中保留 body `idempotencyKey` 与 header 并存的双重定义。

**冻结状态**：R1 已从“body”正式更新为“header”。Implement AI 不得临场重新选择。

#### 5.1.1 长度与 validation convention

直接复用 Slice 1 Final 的 header convention：`readIdempotencyKey` 要求 header 为单一字符串、长度 **8–128**；缺失 / 数组 / 越界统一映射为 `422 VALIDATION_ERROR`（`Idempotency-Key header is required`）。Slice 2 不新增第二种长度规则、不新增 body fallback。

#### 5.2 Canonical payload hash

```text
request_hash = sha256(canonicalJson({
  familyId: <已验证的当前目标 Family ID>,
  body: <Zod strict 解析后的业务请求体>
}))
```

- `canonicalJson`（排序键、无空白）与 `hashPayload` 复用 `packages/domain/src/idempotency.ts`。
- **`Idempotency-Key` header 不进入 hash**（它已在 logical scope 中）。
- **当前 `body` 规范化结果恒为 `{}`**：`CreateCaseRequest` 不含任何业务字段，header 也不进入 body。
- **familyId 是 canonical command context，不是客户端提交字段**：它不属于 idempotency scope，但会改变业务结果的归属。若不进 hash，同一 key 可在不同 Family 之间回放，属于跨家庭数据泄漏（违反 FR-010 / V1-C21）；若允许客户端提交 `familyId`，则会伪造上下文。客户端提交 `familyId` 仍按 strict schema 返回 422。
- **actor / command_type 不重复进入 hash**：logical scope 已经是
  `(actor_account_id, command_type, logical idempotencyKey)`，重复混入没有额外区分力，只会让 payload 语义与 scope 语义耦合。该理由必须在实现注释中写明。
  - physical representation / uniqueness 见 **D-11.1**：legacy / Slice 1 使用 text unique，新 `CASE_CREATE` 使用 bytea unique；不得把物理 text 唯一键写成完整的现行 scope。
- **请求体必须经过 Zod strict 解析后再 hash**：未知字段直接 422，不进入 hash；因此不存在「同语义不同序」误判。
- 未来若 hash 输入语义需要变化，必须通过新 `command_type` 或显式迁移处理，不得静默改算法。

#### 5.3 Replay / Mismatch

| 情形 | 行为 |
|---|---|
| 相同 key + 相同 hash | 返回已存 `response_status`（201）与 `response_body`；不新建 Case；不追加 `case_event` / `business_audit_event`；不增加任何行 |
| 相同 key + 不同 hash | `MISMATCH` → `409 IDEMPOTENCY_PAYLOAD_MISMATCH`；不修改原 Case、不写任何新行 |
| 不同 key | 各自独立执行业务（受 primary 串行化约束） |

**Mismatch 可达性（当前命令形状，冻结澄清）**：在**当前 V1 管理语义 + 同一 actor + 同一 current Family canonical context** 下，`POST /api/v1/cases` 的 business body 恒为 `{}`（`Idempotency-Key` 在 header，不进入 body）；canonical context 中的 `familyId` 又由服务端当前 Family 解析唯一确定。因此本 Slice 的 **public HTTP API 不存在第二种合法业务 payload**，`409 IDEMPOTENCY_PAYLOAD_MISMATCH` 在当前 public HTTP command shape 中不可达。该分支仍必须在 **shared idempotency domain / repository contract 层**实现并验证（same scope key + different `request_hash` → `MISMATCH` → 409 映射），但**不得**通过切换 actor（会改变 scope）、伪造 Family 上下文或新增无业务意义字段制造假场景；也不得为了测试可达而扩大 public 请求体。

**canonical hash 仍完整保留**：

```text
{ familyId: verifiedCurrentFamilyId, body: {} }
```

未来若正式语义允许同一 actor 在多个 Family 执行 `CASE_CREATE`（例如显式 Family context），相同 scope key + 不同 `familyId` 会得到不同 hash 并**正确进入 MISMATCH**。这不是当前 public HTTP 测试场景，也不得删除 `familyId` hash；它是防止同一 key 跨 Family 回放的必需组成（D-5.2 / R-4）。

**占位模式**：`INSERT ... ON CONFLICT DO NOTHING RETURNING id` 先占位（`response_status=0`、`response_body='{}'`，同事务内回填）。
并发同 key 时，第二个事务在唯一索引冲突上等待第一个提交/回滚：提交 → 第二个读到已提交行 → REPLAY；回滚 → 第二个插入成功并执行。占位值在事务外不可见，不会泄露。

#### 5.4 不使用第二张表

`CASE_CREATE` 复用 `idempotency_keys`。

- **002_case_core 对 `idempotency_keys` 的原始扩展**：只扩展 `command_type` CHECK 白名单。
- **Round 2 amendment**：另由 reviewed migration `003_case_idempotency_key_bytes.sql` 扩展 exact physical representation（见 D-11.1）。

任何阶段都不得新建 `case_idempotency` 或类似表。

---

### D-6 Authorization 增量（不新建 `authorizeCase()`）

#### 6.1 扩展点（Post-Slice1 Final **UPDATED**）

> Slice 1 Final 已把 `authorize()` 重构为 **`AuthorizeFacts` 结构化模型**。Slice 2 必须在该模型上增量扩展，**不得**恢复旧的 `family.createdByPersonId` + 扁平 `Resource` 字符串。

| 维度 | Slice 1 Final 现状 | Slice 2 增量 |
|---|---|---|
| `Action` | 9 个 Family / Consent 动作 | 新增 `CASE_CREATE`、`CASE_LIST`、`CASE_READ` |
| `Resource` | 结构化 union：`{ type:'SELF'; personId }` / `{ type:'FAMILY'; familyId }` / `{ type:'MEMBER'; familyId; personId }` / `{ type:'CONSENT'; familyId; consentId? }` | 新增 `{ type:'CASE'; familyId: string; caseId: string }` |
| `AuthInput.case` | 固定 `null` | `{ caseId: string } \| null` |
| `AuthInput.family` | `{ familyId } \| null` | **保持 `{ familyId }`**；不得新增 `createdByPersonId`（Final 已将该职责收敛到 facts） |
| `AuthInput.facts` | `AuthorizeFacts`：`membership` / `familyCreatedByPersonId` / `actorAgeBand` / `guardianPersonId` / `targetIsFamilyMember` / `familyId` | **复用同一 facts 字段**；Case 动作读取 `facts.membership` 与 `facts.familyCreatedByPersonId` |
| `basis` | `{ membership: true; manager: boolean; purpose: Purpose }` | 保持完整 basis，不得退化为 `{ manager }` |
| `DenyReason` | `NO_ACTOR` / `UNSUPPORTED_*` / `FAMILY_CONTEXT_REQUIRED` / `NOT_FAMILY_MEMBER` / `NOT_FAMILY_MANAGER` / `NOT_GUARDIAN` / `AGE_BAND_UNKNOWN` / `AUTHORIZATION_ERROR` | 新增 `CASE_CONTEXT_REQUIRED`（其余复用，不新增 Case 专用 deny 词） |

#### 6.2 判定规则（fail-closed；基于 Final `AuthorizeFacts`）

```text
1. action 不属于注册表                                  → DENY / UNSUPPORTED_ACTION
2. purpose 不属于注册枚举                               → DENY / UNSUPPORTED_PURPOSE
3. actor.accountId / actor.personId 缺失                → DENY / NO_ACTOR
4. Case 动作：family === null                           → DENY / FAMILY_CONTEXT_REQUIRED
5. Case 动作：purpose !== 'FAMILY_MANAGEMENT'           → DENY / UNSUPPORTED_PURPOSE
6. Case 动作：facts.membership !== true                 → DENY / NOT_FAMILY_MEMBER
7. Case 动作：facts.familyCreatedByPersonId 缺失或 ≠ actor.personId
                                                        → DENY / NOT_FAMILY_MANAGER
8. CASE_CREATE / CASE_LIST：
   case !== null                                        → DENY / UNSUPPORTED_DIMENSION
   resource.type !== 'FAMILY' 或 resource.familyId !== family.familyId
                                                        → DENY / NOT_FAMILY_MEMBER
9. CASE_READ 且 case === null                           → DENY / CASE_CONTEXT_REQUIRED
10. CASE_READ：resource.type !== 'CASE'
    或 resource.familyId !== family.familyId
    或 resource.caseId !== case.caseId                  → DENY / NOT_FAMILY_MEMBER
11. 通过                                                 → ALLOW / { membership: true, manager: true, purpose }
12. 非 Case 动作：保持 Final 行为；case !== null 仅对非 Case 动作 → UNSUPPORTED_DIMENSION
13. 任何内部异常                                         → DENY / AUTHORIZATION_ERROR
```

**规则 6 的理由**：Case 管理主体必然是目标 Family 成员（`families.created_by_person_id` 由创建 Family 的 adult 写入，且该 adult 是成员）。`current Family` 的合法解析也以 membership 为前提。因此 Case 动作要求 `facts.membership === true` 是 fail-closed，不构成新的产品语义。

**规则 7 的理由**：manager 判定必须使用 Final 的 `facts.familyCreatedByPersonId`，而不是旧的 `family.createdByPersonId`；缺失 facts 时一律 DENY，不得默认放行。

**规则 10 的理由**：`resource` 是请求方提供的**未验证参数**；即使 `authorize()` 不判断 Case 归属（由 RLS 保证），也必须拒绝 resource 与已解析 family / case 不一致的伪造上下文。

#### 6.3 Case 归属不由 `authorize()` 推断

`authorize()` 是纯函数，不读数据库，因此**不判断** `case.familyId`。Case 是否属于当前 Family 由两层保证：

1. `withRlsTransaction` 设置 `app.family_id`；
2. 所有 Case 查询在 RLS policy `family_id = app_family_id()` 下执行；跨 Family 的 Case 返回 0 行。

`case_id` 只作为「待验证参数」进入查询，ID 存在不构成访问依据。

#### 6.4 不建立的东西

不建 Case role、Participant role、RBAC、Visibility Matrix、Permission DSL、`case_participants` 表或占位。
普通 Family membership / guardian relationship 不自动授予 Case 访问（FR-009）。

#### 6.4.1 唯一授权入口：复用 Final `authz.ts`（**UPDATED**）

Slice 1 Final 新增 `apps/server/api/src/authz.ts`，提供：
- `decideFamilyAction(tx, req)`：在同一事务内读 facts 并调用 `authorize()`；
- `requireFamilyAction(tx, req)`：DENY 时抛错；
- `denyToError(reason)`：统一 deny → HTTP 映射。

Slice 2 **必须复用该 adapter**，只做增量：
1. 扩展 `FamilyActionRequest`，允许可选 `caseId`；
2. `readFacts` 继续读取 `membership` / `familyCreatedByPersonId`（Case 归属仍由 RLS 保证，不在 facts 中判断）；
3. 调用同一 `authorize()`，传入结构化 `Resource` 与 `case` 维度；
4. Case 路由的 deny 映射：
   - `CASE_CREATE` / `CASE_LIST`（Family 已解析）：`NOT_FAMILY_MEMBER` / `NOT_FAMILY_MANAGER` → `403 CASE_ACCESS_DENIED`；
   - `CASE_READ`（Family 已解析）：任何 Case deny → `404 CASE_NOT_FOUND`（不泄露存在性）；
   - Family 未解析：沿用 Slice 1 Family 错误码，不进入 Case 分支。

**禁止**：新建 `authorizeCase()`、第二套 facts 读取、第二套 header / family 解析、把 deny 映射散落在路由的多个分支里。

#### 6.5 错误映射

> 统一由 §6.4.1 的 `authz.ts` 映射；下表是 Case 路由层的最终 HTTP 语义。

| 情形 | 端点 | 响应 |
|---|---|---|
| 非管理主体（Family 已解析，含 guardian 同时是该 Family 成员） | `POST /cases`、`GET /cases` | `403 {"code":"CASE_ACCESS_DENIED","message":"Case access denied"}` |
| 非管理主体（Family 已解析，含 guardian 同时是该 Family 成员） | `GET /cases/:id` | `404 {"code":"CASE_NOT_FOUND","message":"Case not found"}`；不泄露 Case 是否存在 |
| Case 不存在 / 跨 Family / 无访问资格（Family 已解析） | `GET /cases/:id` | 同上，**响应体逐字节一致**，无 `details` |
| Actor 尚无任何 Family | 三个端点 | 沿用 Slice 1 `404 CURRENT_FAMILY_NOT_FOUND`，不带 Case 字段 |
| Actor 不是目标 Family 成员（包括仅有 guardian relationship） | 三个端点 | current Family 无法合法解析为目标 Family；沿用 Slice 1 Family 授权 / current-family 失败语义，不返回 Case 数据，**不得**转换为 `CASE_ACCESS_DENIED` / `CASE_NOT_FOUND`，不得定义第二套 Family 错误码 |
| 目标 Family 未合法解析（其它 Slice 1 失败情形） | 三个端点 | 沿用 Slice 1 Family 授权失败语义，不定义第二套 Family 错误码 |

说明：详情端点对「Family 已解析但非管理主体」选择 404 而非 403，是 D6 的明确要求；该 404 不削弱 RLS（RLS 仍零行 / 拒写）。
补充（场景 9A / 9B）：guardian 同时是目标 Family 成员时走上述 403 / 404 Case 语义；guardian 但不是目标 Family 成员时，current Family 未合法解析，必须在进入 Case 授权分支前沿用 Slice 1 Family 语义，不得转换为 Case 层 403 / 404，也不得用于验证 Case manager 权限。

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
- **幂等键**：`Idempotency-Key` HTTP header（8–128），通过 Slice 1 Final `readIdempotencyKey(req)` 读取；缺失 / 非法 → `422 VALIDATION_ERROR`。
- 请求体（strict，`additionalProperties: false`）：**无业务字段**（`{}`）；不得包含 `idempotencyKey`。
- 客户端提交 `familyId` / `createdByPersonId` / `creator` / `status` / `phase` / `primary` / `version` / `title` / `description` / `problemDescription` / `idempotencyKey` 等任何未声明字段 → `422 VALIDATION_ERROR`（显式拒绝，不静默忽略），且**零业务写入**：不创建 Case、不写 `case_event`、不写 `business_audit_event`、不留新的业务幂等结果。
- 成功：`201` + `CaseResponse`（identity context 的 Case 容器）。
- 错误：`401 UNAUTHENTICATED`、`403 CASE_ACCESS_DENIED`、`404 CURRENT_FAMILY_NOT_FOUND`、`409 IDEMPOTENCY_PAYLOAD_MISMATCH`（合同保留；body 恒为 `{}`，public HTTP 层不可达，见 D-5.3）、`422 VALIDATION_ERROR`、`500 INTERNAL_ERROR`。

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
| migration 内容顺序 | 严格按下列可执行顺序；**被引用的唯一键必须先于复合 FK 存在**：<br>1) `CREATE TYPE case_status` / `case_phase`<br>2) `CREATE TABLE cases`<br>3) `cases` 自身约束：PK、`UNIQUE (id, family_id)`、`version >= 1`、family / creator FK<br>4) `cases` 索引：`cases_one_primary_open_per_family` partial unique、列表 / 状态索引<br>5) `CREATE TABLE case_events`：family FK、actor FK、复合 FK `(case_id, family_id) REFERENCES cases(id, family_id)`、`event_type` CHECK<br>6) `case_events` 索引 / `metadata` shape CHECK<br>7) `cases` / `case_events` ENABLE + FORCE RLS<br>8) policies（`cases` / `case_events`）<br>9) GRANT（表 `SELECT, INSERT`；enum `USAGE`）<br>10) 扩展 `business_audit_events` / `idempotency_keys` 既有 CHECK 白名单 |
| migration 顺序理由 | `case_events` 的复合 FK 需要 `cases` 的 `UNIQUE (id, family_id)` 作为被引用唯一键；若先建 `case_events` 再建该唯一约束，按字面执行会失败。因此 migration 必须把 `cases` 自身约束（含 `UNIQUE (id, family_id)`）放在第 3 步、`case_events` 放在第 5 步。RLS / policy 在两张表都建好后再启用，避免中间态；既有 CHECK 扩展仍最后执行。 |
| 回滚 | **本节回滚描述仅针对 `002_case_core` migration**：本 Slice 无数据回填；回滚 = 删除新表 / 新 enum / 新 policy / 新索引 + 还原两个 CHECK 白名单（实现阶段提供 down 步骤说明，不自动执行）。`003` amendment 的回滚独立见 D-11.1，不得套用本节 |

**为什么 CHECK 扩展放在最后**：新表与 RLS 先就位，避免在扩展白名单与建表之间出现「可写入但无表」或「有表但不可写」的中间态；整个 migration 在一个事务中执行（`db-migrate.mjs` 已保证）。

#### D-11.1 Amendment — exact CASE_CREATE idempotency key storage（Owner-approved，Round 2）

逻辑 scope 不变：`actor_account_id + command_type + logical idempotencyKey`，且必须是**精确身份**（相同 logical key → 相同 scope；不同 logical key → 不同 scope），不得用概率性 digest 代替。

物理表示补充（新增 reviewed migration `db/migrations/003_case_idempotency_key_bytes.sql`）：

| 项 | 决定 |
|---|---|
| 新列 | `idempotency_key_bytes bytea NULL`；保留 `idempotency_key text` 并允许其为 NULL |
| 表示不变量 | `command_type <> 'CASE_CREATE'` → text NOT NULL 且 bytes NULL；`CASE_CREATE` → text 与 bytes **恰有其一** |
| 唯一性 | 保留 `UNIQUE (actor_account_id, command_type, idempotency_key)`；新增 `UNIQUE (actor_account_id, command_type, idempotency_key_bytes)` |
| 新 CASE_CREATE 表示 | logical key 的 UTF-16LE bytes（deterministic / reversible / injective，可表示 NUL 与 lone surrogate） |
| legacy 兼容 | 003 之前的 raw text CASE_CREATE 行继续按 raw logical identity 读取（bytes IS NULL） |
| 禁止 | digest、UUID 占位命名空间、base64 text 身份、截断；以及任何 reserved prefix（`u:` / `h:`）语义 |
| 不变量保持 | 不新建第二张幂等表；Slice 1 六个 command 的物理语义与唯一性完全不变 |
| 回滚（仅 003） | **取决于是否已产生 new-format rows，不存在无条件 schema rollback**。状态 A / B 见下方 D-11.2；不回滚 002 |
| forward 数据影响 | 003 前进方向**无数据回填**（不重写任何既有行） |

#### D-11.2 003 rollback / recovery（不是无条件 schema downgrade）

003 一旦写入 new-format `CASE_CREATE` 行（`idempotency_key IS NULL AND idempotency_key_bytes IS NOT NULL`），就**不存在无损的纯 schema rollback**：PostgreSQL `text` 无法表示 U+0000 与 lone surrogate，因此连「把所有 bytea 解码回 text」都不是通用可逆操作。

**状态 A — 尚未产生 new-format rows**

以只读查询确认不存在该形态的行：

```sql
SELECT NOT EXISTS (
  SELECT 1 FROM idempotency_keys
  WHERE command_type = 'CASE_CREATE'
    AND idempotency_key_bytes IS NOT NULL
) AS rollback_safe;
```

`rollback_safe = true` 时，可按 reviewed 步骤人工回滚：

1. `DROP INDEX idempotency_scope_key_bytes`
2. `ALTER TABLE idempotency_keys DROP CONSTRAINT idempotency_keys_key_representation_check`
3. `ALTER TABLE idempotency_keys DROP COLUMN idempotency_key_bytes`
4. `ALTER TABLE idempotency_keys ALTER COLUMN idempotency_key SET NOT NULL`

**状态 B — 已存在 new-format rows**

`rollback_safe = false` 时：

- **禁止**直接执行状态 A 的第 3 / 4 步（必然 `23502`，或丢失 exact identity）；
- 必须先制定 reviewed **data disposition / migration plan**，至少明确：
  - 这些 idempotency records 是否保留；
  - 是否改为停止回滚（推荐：保持 003 在线）；
  - 是否需要 archive / 导出；
  - 是否存在可逆到 `text` 的 subset（仅不含 NUL / lone surrogate 的 key）；
  - 不可表示 key（NUL / lone surrogate）如何处置；
  - 如何保证 logical idempotency identity 不被改变；
  - 如何避免历史 `CASE_CREATE` 请求在回滚后被重复执行。
- 在数据处理方案获批前：**不得** `DROP COLUMN idempotency_key_bytes`，**不得** `SET idempotency_key NOT NULL`。

**禁止的表述**：不得声称「把 bytea 全部转回 text 即可回滚」——bytea 表示的存在原因正是 text 无法精确表示全部合法 JS strings。

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
- Slice 1 Final 真实契约：`packages/authorization/src/authorize.ts`（`AuthorizeFacts`）、`apps/server/api/src/authz.ts`（唯一 route adapter）、`apps/server/api/src/idempotency.ts`（header + `readIdempotencyKey`）、`apps/server/api/src/runtime-env.ts`、`apps/server/api/src/openapi-spec.ts`、`apps/server/api/src/db/tx.ts`、`apps/server/api/src/plugins/error-handler.ts`、`packages/contracts/src/schemas.ts`、`tests/setup/api.ts`。

## Data and Migration Impact

- 新增 2 张表（`cases` / `case_events`）、2 个 enum（`case_status` / `case_phase`）、1 个 partial unique index、4 个普通索引、2 条 policy、若干 GRANT。
- 新增 1 个复合外键 `case_events (case_id, family_id) → cases (id, family_id)`，因此 `cases` 需要 `UNIQUE (id, family_id)`；migration 必须先建立该唯一约束，再创建 `case_events` 复合外键。
- `case_events.metadata` 新增 `case_events_metadata_shape_check`：JSON object 且 key 恰为 `{primary, version}`，拒绝正文 / PII / 额外 key；无默认值。
- 既有表变更（现行事实）：
  - `002_case_core`：`business_audit_events` 两个 CHECK 白名单扩值；`idempotency_keys` 一个 CHECK 白名单扩值。**无列变更、无数据回填。**
  - `003_case_idempotency_key_bytes.sql`（Round 2 Owner-approved amendment）：新增 nullable `idempotency_key_bytes bytea`；`idempotency_key text` 改为 nullable；新增 representation CHECK；新增 `UNIQUE (actor_account_id, command_type, idempotency_key_bytes)` 索引；**无数据回填**。
- `001` 不修改；`002` 不修改；不新建第二张幂等表。
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

只列本 Slice 真实会触碰或**必须复用**的路径（源自 `Docs/V1技术设计.md` §3 与 Slice 1 Final 实际形状）：

```text
specs/002-case-core/
  spec.md                                  # 冻结（本轮不修改）
  plan.md                                  # 本文件（已做 dependency reconciliation）
  research.md                              # Phase 0（R-3 / R-8 / R-16 已更新）
  data-model.md                            # Phase 1
  contracts/
    cases-api.openapi.yaml                 # 3 端点契约（header transport）
    authorization-rls-and-idempotency.md   # 授权 / RLS / 幂等 / 事务（已更新）
    case-events-and-business-audit.md      # 事件与审计
  quickstart.md                            # Phase 1 验证指南（已更新）

db/migrations/
  <next-after-slice1-final>_case_core.sql  # 新增；不写死序号
  003_case_idempotency_key_bytes.sql        # 已存在的 CASE_CREATE bytea amendment

packages/contracts/src/schemas.ts           # 采用 Slice 1 Final 基线；只追加 Case schema（无 body idempotencyKey）
packages/authorization/src/authorize.ts    # 在 Final AuthorizeFacts 模型上增量扩展 Case 维度
apps/server/api/src/authz.ts               # Slice 1 Final adapter；复用并增量支持 caseId（不得新建 authorizeCase）
apps/server/api/src/runtime-env.ts         # Slice 1 Final runtime boundary；复用
apps/server/api/src/openapi-spec.ts        # Slice 1 Final OpenAPI builder；扩展 Case operations
apps/server/api/src/routes/cases.ts        # 新增 Case 路由
apps/server/api/src/app.ts                 # 保留 runtime-env / log privacy / provider；追加 registerCaseRoutes
apps/server/api/src/plugins/error-handler.ts # 保留 Final 全部码 + generic 500；追加 CASE_NOT_FOUND / CASE_ACCESS_DENIED
scripts/openapi-generate.mjs               # 适配 Final openapi-spec.ts 架构
scripts/openapi-check.mjs                  # 适配 frozen YAML ↔ runtime semantic equivalence
scripts/guard-static.mjs                   # 保留 Final guards + 追加 cases/case_events scope
tests/setup/api.ts                         # Slice 1 Final test helper；复用

tests/db/cases-schema.test.ts              # 新增
tests/db/cases-rls.test.ts                 # 新增
tests/db/cases-primary-concurrency.test.ts # 新增
tests/domain/case-authorization.test.ts    # 新增（基于 AuthorizeFacts）
tests/integration/cases-create.test.ts     # 新增
tests/integration/cases-read.test.ts       # 新增
tests/integration/cases-authorization.test.ts # 新增
tests/integration/cases-idempotency.test.ts   # 新增
tests/integration/cases-scope.test.ts      # 新增
```

**既有测试的合法增量对齐**（不是削弱，而是把 Slice 1 Final 的计数投影扩展到 Slice 2 新对象）：

- `tests/db/rls.test.ts`：表 / policy 计数按 Slice 2 新表扩展（9 → 11）。
- `tests/db/roles.test.ts`：`TABLES` 清单加 `cases` / `case_events`，保留原 10 表断言。
- `scripts/guard-static.mjs`：`FAMILY_TABLES` 加 `cases` / `case_events`；保留 Slice 1 Final 全部 guard。
- `scripts/db-evidence.mjs` / `scripts/coverage-audit.mjs`：只做计数与 Slice 2 覆盖增量，不删除 Final 断言。

> 这些修改在下一阶段 merge / Implement 执行；本轮 Plan reconciliation **不修改任何代码、migration、tests 或 scripts**。

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
| FR-008 / FR-009 / FR-024 / 场景 8 / 场景 9A / 场景 9B（manager allow / member deny / guardian deny） | integration | `bunx vitest run tests/integration/cases-authorization.test.ts tests/integration/cases-read.test.ts` | **manager**：create/list 201/200；**普通 Family 成员、guardian + Family 成员但非 manager**：create/list `403 CASE_ACCESS_DENIED`，detail `404 CASE_NOT_FOUND`，均无 Case 数据；**guardian 但不是目标 Family 成员**：current Family 未合法解析，沿用 Slice 1 Family 语义（如 `CURRENT_FAMILY_NOT_FOUND`），响应不含 Case 字段，**不出现** `CASE_ACCESS_DENIED` / `CASE_NOT_FOUND` |
| FR-010 / FR-023 / SC-004（跨家庭 + 详情 404 anti-enumeration） | integration + DB | `bunx vitest run tests/integration/cases-read.test.ts` | Family A 读 Family B Case → `404 CASE_NOT_FOUND`，响应体无任何 Case 字段；Family A 的 RLS 上下文直查 Family B Case → 0 行 |
| FR-011 / §9.1（RLS ENABLE/FORCE、无上下文、错误 Family、runtime role） | DB 结构 + 直连查询 | `bunx vitest run tests/db/cases-rls.test.ts` | `relrowsecurity=true`、`relforcerowsecurity=true`；无上下文 SELECT 0 行、INSERT 被拒；错误 family 0 行；`rolbypassrls=false`；owner 为 migrator |
| FR-012 / FR-013 / SC-009（HTTP 可达幂等、version 初始值） | integration + domain | `bunx vitest run tests/domain/case-authorization.test.ts tests/integration/cases-idempotency.test.ts` | 同 key 同 canonical payload（含并发）返回原 201 body 且只有一个业务结果；`version=1` 且无更新路径改变它 |
| FR-012 / §8.5（shared idempotency mismatch contract） | domain + repository/service contract | `bunx vitest run tests/domain/idempotency-hash.test.ts` 与 `tests/integration/cases-idempotency.test.ts` 的 repository/service contract 用例 | 相同 scope key + 不同 `request_hash` → `MISMATCH` → 映射 `409 IDEMPOTENCY_PAYLOAD_MISMATCH`；不改原 Case/结果、不写新行。**不得声称 public HTTP API 存在可达的 different-payload 请求**；不得用换 actor（scope 改变）制造假 mismatch |
| FR-014 / SC-007（Case + event + audit 原子） | integration + DB | `bunx vitest run tests/integration/cases-create.test.ts` | 成功创建后各存在 1 条 `CASE_CREATED`；构造事件 / 审计写入失败时 Case 不落库（回滚证据） |
| CHK068（`case_events.metadata` 可证明不含正文 / PII） | integration + database constraint | `bunx vitest run tests/db/cases-schema.test.ts tests/integration/cases-create.test.ts` | 实际 `CASE_CREATED` 行的 metadata key 集合**恰好**为 `{primary, version}`，无 title / description / family 正文 / 用户输入 / PII；`case_events_metadata_shape_check` 存在；直接 DB 写入额外 key、非 object、非 boolean `primary`、非 integer-compatible `version` 均被 CHECK 拒绝（SQLSTATE 23514） |
| FR-015 / 场景 13（客户端不能指定业务字段） | integration + database | `bunx vitest run tests/integration/cases-create.test.ts` | 携带 status / phase / primary / version / creator / familyId / title 等任何未声明字段 → `422 VALIDATION_ERROR`；**零业务写入**：`cases`、`case_events`、`business_audit_events`、`idempotency_keys` 均无新增；DB 不存在“忽略非法字段后用服务端值创建”的行 |
| FR-016 / FR-017 / SC-010（列表识别 primary、详情独立 status/phase） | integration | `bunx vitest run tests/integration/cases-read.test.ts` | 列表返回 `items`，primary 唯一可识别，每项含 phase/status/version；详情两字段独立；不存在 `/cases/current` |
| FR-019 / FR-020 / FR-021 / FR-022（真实失败、无越界对象、候选无副作用、空结果） | integration + introspection | `bunx vitest run tests/integration/cases-read.test.ts tests/integration/cases-scope.test.ts` | 空 Family → `200 {items: []}`；无 placeholder；无 Plan / Task / Follow-up / Notification 表或路由 |
| FR-025 / D7（读不写审计） | integration + DB | `bunx vitest run tests/integration/cases-read.test.ts` | 读取前后 `case_events` / `business_audit_events` 行数不变；不存在 read-audit 事件类型 |
| SC-003 / SC-005 / SC-008 / SC-011 | 汇总以上用例 | `bunx vitest run`（DB 环境） | 全部通过；无跳过、无 expected-fail |
| 静态守卫（无 drizzle push / 无 secret / 无越界目录） | static guard | `bun run guard:static` | PASS（0 violations）；需在实现阶段把 `cases` / `case_events` 纳入 family table 检查 |
| Typecheck / 单测回归 | CI | `bun run typecheck`、`bunx vitest run tests/domain` | 全绿；Slice 1 既有 domain 测试不被削弱 |
| 迁移可重放 / 结构一致 | migration runner | `bun run db:migrate`（migrator 角色） | 一次成功；重复执行 SKIP；`schema_migrations` 与新文件一致 |
| final CI + converge | CI / converge report | `.github/workflows/ci.yml` 全 job + converge | 全绿；无未解决 gap（G10） |

### Post-Slice1 强制验证顺序（下一阶段开发 AI）

> Plan 阶段只定义；以下命令在 merge / Implement 后执行，Plan 阶段全部**未执行**。

```bash
bun run typecheck
bun run guard:static

bunx vitest run tests/domain
bunx vitest run tests/db
bunx vitest run tests/integration
bunx vitest run

bun run db:migrate
bun run db:migrate

bun run db:evidence

bun run openapi:generate
bun run openapi:check

bun run coverage:audit

node scripts/verify-all.mjs --archive

node .specify/scripts/validate-governance.mjs
node .specify/scripts/tests/run-governance-tests.mjs
```

必须同时满足：
- **Slice 1 regression**：Slice 1 Final 既有 domain / db / integration 测试全绿，不被削弱；
- **Slice 2 full suite**：Case 专项 + 全量 `bunx vitest run`；
- `0 failed` / `0 skipped`；
- `db:migrate` 两次：首次 APPLY，第二次全 SKIP；
- `openapi:generate` 两次：生成物 hash 一致（路径限定 `packages/generated/`）；
- `openapi:check`：frozen YAML ↔ runtime semantic equivalence PASS，**不得**回退为“只比较生成文件 diff”；
- `db:evidence` / `coverage:audit` / `verify-all --archive` / governance 全部 PASS；
- `Docs/**` diff = 0。

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
3. **数据（按 migration 分别说明，不得合并成一句）**：
   - `002_case_core`：前进方向无业务数据回填、无跨表复制；其自身的 schema rollback 见 D-11。
   - `003_case_idempotency_key_bytes.sql`：**前进方向无数据回填**；但这不等于「回滚不需要数据处理」。一旦运行后已产生 bytea-only `CASE_CREATE` 行，回滚可能需要 reviewed data disposition / migration，且不存在无条件 schema rollback（见 D-11.2）。不得把「forward 无 backfill」写成「rollback 永远不涉及数据迁移」。
4. **不自动执行**：任何 down migration 都必须人工 review，不在 runtime 自动运行。

---

## Complexity Exceptions

无。所有约束均可在已批准的 V1 技术栈与 Slice 1 基础设施内满足。

---

## Frozen Technical Decisions

以下 R1–R5 已在 Plan Review 中做出选择并**冻结**；它们不是 Implement AI 可以自由重新选择的事项。

| # | 冻结选择 | 理由 | 变更条件 |
|---|---|---|---|
| **R1** | 幂等键为 **`Idempotency-Key` HTTP header**（8–128），body 无业务字段 | Slice 1 Final 已正式冻结 header transport；复用 `readIdempotencyKey`，不创建第二套 parser；Spec A-2 将 transport 委派给 Plan | transport 再变化必须回到 Plan Review；不得 body + header 并存 |
| **R6** | Case 授权复用 Slice 1 Final `AuthorizeFacts` + `authz.ts`，只增量扩 Case action / resource / case 维度 | Slice 1 Final 已重构 authorize；恢复旧扁平参数会产生第二个授权形状 | 上游 authorize 形状再变时回 Plan Review |
| **R7** | Slice 2 `app.ts` 保留 Slice 1 Final `runtime-env.ts` fail-fast + `requestLogSerializer` + `createWechatProvider`，只追加 `registerCaseRoutes` | Slice 1 Final F1 / F11 已冻结生产 secret / 日志隐私边界 | 不得回退硬编码 secret 或 fake provider fallback |
| **R8** | OpenAPI 生成 / 检查复用 Slice 1 Final `openapi-spec.ts` + frozen YAML ↔ runtime semantic equivalence | Slice 1 Final 已淘汰“只比较生成文件 diff”的弱检查 | 不得回退弱检查；Slice 2 frozen YAML 必须纳入语义等价 |
| **R9** | `packages/contracts/src/schemas.ts` 采用 Slice 1 Final 的 `z.strictObject` 基线；Slice 2 只追加无业务字段的 Case schema | Slice 1 Final 已移除六个命令的 body `idempotencyKey` | 不得保留旧版 body key 或旧字段名 |
| **R2** | Case 列表不分页，返回全部 `items` | U04 / §28.3 未给分页约束；返回全部才能无条件保证 primary 可识别 | 需要正式分页需求时才变更 |
| **R3** | API 字段 `primary`；DB 列 `is_primary` | `primary` 是 SQL 保留字；API 术语与 spec / 上游一致 | 契约字段重命名需显式评审 |
| **R4** | `case_events` append-only 由运行角色只授予 `SELECT / INSERT`，当前不加 trigger | 权限层阻断早于 trigger；runtime 无 UPDATE / DELETE 能力 | 需要防御 owner 误操作时再评审 |
| **R5** | Family 未解析时沿用 Slice 1 final `CURRENT_FAMILY_NOT_FOUND` 等正式 Family 语义 | FR-024 不得定义第二套 Family 错误码 | 上游 Family 语义变化时同步更新 |

以上为冻结技术决策，不改变 spec 的产品语义；不得作为未解决产品问题的替代。

---

## Blockers

**产品 / 语义 blockers：NONE。**

**实现依赖 blockers（下一阶段）：**

| # | Blocker | 状态 |
|---|---|---|
| B1 | Slice 1 Final Audit II PASS / merged main / post-merge CI PASS | **CLOSED** |
| B2 | Gate 4：merge latest `main` into `feat/002-case-core` | **OPEN（下一阶段）** |
| B3 | Gate 5：resolve shared-infrastructure conflicts（见下方矩阵） | **OPEN（下一阶段）** |
| B4 | Gate 6 / 7：preserve Slice 1 Final guarantees + adapt header contract | **OPEN（下一阶段）** |
| B5 | Gate 8：full regression | **OPEN（下一阶段）** |

> 本 Plan 不私建替代基础设施。Gate 失败时报告 `BLOCKED — SLICE 1 IMPLEMENTATION DEPENDENCY`；G11 失败报告 `BLOCKED — SLICE 1 CURRENT FAMILY SEMANTICS NOT STABLE`。

---

## Post-Slice1 Dependency Reconciliation（2026-11-07）

### R-1 分析范围

以现场核验为准：

- Latest main：`ee9d07e059566884e0329fb0eb4a4ab9dbf8ea83`
- Slice 2（`feat/002-case-core`）previous Head：`9ac76f7e8e1640d5e5a448faa062296bd65443f9`
- Old merge base：`ed0d5fbee8c6764be704da8d80fb27ad2172222b`
- Ahead / Behind：**38 / 4**

比较路径：

```text
packages/authorization/src/authorize.ts
packages/contracts/src/schemas.ts

apps/server/api/src/app.ts
apps/server/api/src/authz.ts
apps/server/api/src/plugins/error-handler.ts
apps/server/api/src/idempotency.ts
apps/server/api/src/runtime-env.ts

scripts/guard-static.mjs
scripts/openapi-generate.mjs
scripts/openapi-check.mjs
scripts/db-evidence.mjs
scripts/coverage-audit.mjs
scripts/verify-all.mjs
package.json
tests/setup/api.ts
```

### R-2 Dependency Impact Matrix

| Shared Area | Slice 1 Final（`ee9d07e`） | Slice 2 Current（`9ac76f7`） | Conflict? | Plan / Contract Change Required? | Later Code Action（下一阶段） |
|---|---|---|---|---|---|
| **Authorization** | 结构化 `AuthorizeFacts` + 结构化 `Resource` 对象 + `apps/server/api/src/authz.ts`（`decideFamilyAction` / `requireFamilyAction` / `denyToError`）；`case: null` 硬编码 | 旧扁平 `Resource` 字符串 + `family.createdByPersonId`；`case: { caseId }`；无 `authz.ts` | **YES（HIGH）** | **YES** — D-6 / contract §2 / research R-8 / tasks T016/T029/T044 | merge 后重写 Case 增量：复用 `AuthorizeFacts` + `authz.ts`，只扩 Case action / resource / case 维度；禁止恢复旧扁平参数 |
| **Idempotency transport** | **`Idempotency-Key` header** + `readIdempotencyKey(req)` | body `idempotencyKey`（schemas / routes / quickstart / contract） | **YES（HIGH）** | **YES** — R1 / D-5.1 / contract §5.1 / OpenAPI / tasks T030/T045/T052/T075 / quickstart | 使用 `readIdempotencyKey`；移除 body key；body `{}`；不得双 transport |
| **Idempotency storage** | text `idempotency_key` + text unique；`runIdempotentCommand` | `003_case_idempotency_key_bytes.sql` + `cases.ts` bytea 精确身份 | **Compatible（additive）** | **NO**（Plan 已冻结 bytea） | merge 时保留 003 与 `cases.ts` bytea 路径；确认 representation CHECK 与 Slice 1 text 路径兼容；不得改 Slice 1 六命令物理语义 |
| **Runtime schemas** | `z.strictObject`；六个命令**无 body `idempotencyKey`**；`creator` / `values` / `value` / `source` / `declaredAgeBand` / `channel` 等 Final 形状 | 旧 `z.object`；六命令仍含 body key；旧字段名（如 `profileValues` / `subjectPersonId`） | **YES（HIGH）** | **YES** — R9 / D-9 / tasks T015/T030/T045 | merge 时采用 Final schemas 作基线；只追加 `CreateCaseRequest`（严格无业务字段）/ `CaseResponse` / `CaseListResponse` / `CaseStatus` / `CasePhase` |
| **OpenAPI generate / check** | `apps/server/api/src/openapi-spec.ts`（`buildOpenApiDocument`）+ frozen YAML ↔ runtime **semantic equivalence** | inline swagger 临时脚本；`openapi-check` 只做 “regenerate + 比较生成文件” 弱检查；无 `openapi-spec.ts` | **YES（HIGH）** | **YES** — R8 / G9 / tasks T076/T077/T079/T080 | 适配 Final 架构：扩展 `openapi-spec.ts` 的 Case operations；`openapi-check` 对 `specs/002-case-core/contracts/cases-api.openapi.yaml` 做语义等价；不得回退弱检查 |
| **Error handling** | `toHttpError` + Final 错误码全集（含 `FORBIDDEN` / `NOT_FAMILY_MEMBER` / `NOT_FAMILY_MANAGER` / `CURRENT_FAMILY_AMBIGUOUS`）；generic 500 | Final 码 + `CASE_NOT_FOUND` / `CASE_ACCESS_DENIED` + 自有 generic 500 / `logUnexpected` / validation 422 | **Compatible（additive）** | **NO**（Plan 已明确保留 Final 码 + 追加 Case 码） | merge 时保留 Final 全部码与行为，追加 Case 码与 Slice 2 generic 500；不得覆盖 Final 映射 |
| **Logging / privacy** | `app.ts` `requestLogSerializer`（不记录 raw IP / UA / authorization）+ logger redact | 旧 `app.ts` 无 serializer；`error-handler` 有 `logUnexpected` 白名单 | **YES（HIGH）** | **YES** — R7 / tasks T053 | 保留 Final `requestLogSerializer` / redact；`logUnexpected` 只能作为补充，不得替代或削弱 Final 隐私边界 |
| **Runtime env / provider** | `runtime-env.ts` fail-fast（secret 长度、生产不得 fallback fake provider） | 旧 `app.ts` 使用 `process.env['SESSION_SECRET'] ?? 'dev-secret-key-for-testing'` + 无条件 `FakeWechatProvider` | **YES（HIGH）** | **YES** — R7 / tasks T053 | 采用 `loadRuntimeConfig` / `createWechatProvider`；删除硬编码 fallback；只追加 `registerCaseRoutes` |
| **RLS transaction boundary** | `withRlsTransaction`（identity + family context，`set_config(..., true)`） | 复用 | **NO** | **NO** | 保留；Case 所有读写继续在 `withRlsTransaction` 内 |
| **UUIDv7** | PostgreSQL 原生 `uuidv7()`；11 / 12 张 id 表（含 Case 后） | 复用 | **NO** | **NO** | 保留；migration 不得改默认值 |
| **Static guard** | Final guard 全集 | Final + `cases` / `case_events` + forbidden table scope（纯增量） | **NO**（additive） | **NO** | merge 时确认 Final guard 未被覆盖；保留 Slice 2 增量 |
| **DB evidence** | 9 表 / 10 业务表 / 8 enum / 9 policy | 11 / 12 / 10 / 11（纯增量） | **NO**（additive） | **NO** | 保留 Final 断言 + Slice 2 计数增量；不得删 Final 断言 |
| **Coverage** | Slice 1 FR / SC / Acceptance | Slice 2 追加 25 FR / 11 SC / 18 Acceptance | **NO**（additive） | **NO** | 保留两者；`coverage:audit` 同时输出 001 / 002 |
| **CI** | 5 jobs（Static / Unit / DB Migration / Integration / Contract） | 同一 workflow；Slice 2 需在 merge 后重跑 | **NO**（verification only） | **NO** | merge 后必须重跑 5/5；旧 Slice 2 CI 结果作废 |
| **Test setup** | `tests/setup/api.ts` | 无（旧 setup） | **YES（MEDIUM）** | **YES** — Project Structure / tasks | 复用 Final `tests/setup/api.ts`；不复制第二套 app builder |
| **package scripts** | `bun scripts/openapi-generate.mjs` / `bun ...` | `node ...` | **YES（LOW）** | **YES** — tasks T076/T079 | 对齐 `bun` 调用，避免 runtime 差异 |

### R-3 保持冻结、不重新打开的 Slice 2 语义

以下内容**没有上游冲突**，本轮不重开：

```text
Case 容器 / cases / case_events
POST /cases、GET /cases、GET /cases/:id
OPEN + INTAKE
首个 Case primary=true；后续 Case candidate=false
single current primary invariant
Case version=1
Case manager authorization
ordinary member deny
guardian ≠ automatic Case access
cross-family anti-enumeration
Case RLS
CASE_CREATED 事件
business audit
read does not create audit
no /cases/current
no status transition
no switch-primary
no Participant
no Evidence Core
no title/description/problem text
003 bytea idempotency representation
```

### R-4 新发现的 blocker 与处理

| 级别 | 发现 | 处理 |
|---|---|---|
| HIGH | `authorize()` / `authz.ts` 形状漂移（远超 R1） | 已在 D-6 / contract §2 / research R-8 / tasks 中修正；下一阶段 merge 时按 Final 重写 |
| HIGH | `app.ts` 回退到旧 runtime：无 fail-fast、硬编码 secret fallback、无条件 fake provider | 已在 R7 / tasks T053 中冻结；下一阶段必须采用 Final runtime-env |
| HIGH | OpenAPI 生成 / 检查回退到旧弱检查 | 已在 R8 / tasks T076–T080 中冻结；下一阶段必须适配 `openapi-spec.ts` |
| HIGH | schemas 基线整体落后（旧字段名 + body key） | 已在 R9 / tasks T015/T030/T045 中冻结；下一阶段采用 Final schemas |
| MEDIUM | `tests/setup/api.ts` 未复用 | 已加入 Project Structure / tasks |
| LOW | `package.json` openapi 脚本 `node` vs `bun` | 已在矩阵标注；下一阶段对齐 |

### R-5 下一阶段 merge / remediation 指令（给开发 AI）

```bash
git fetch origin
git checkout feat/002-case-core
git merge origin/main          # 普通 merge，禁止 rebase / force push
git merge-base --is-ancestor origin/main HEAD
```

冲突解决原则（**Final 优先，Slice 2 增量保留**）：

1. `packages/authorization/src/authorize.ts`：以 Final 为基座，保留 Case 增量；
2. `apps/server/api/src/authz.ts`：保留 Final 文件，仅扩 `caseId`；
3. `apps/server/api/src/idempotency.ts`：以 Final 为基座（header + `readIdempotencyKey`），保留必要的 `resolveFamilyId` / `createFamily` 兼容（若路由仍需要）；
4. `packages/contracts/src/schemas.ts`：以 Final 为基座，追加 Case schema（无 body key）；
5. `apps/server/api/src/app.ts`：以 Final 为基座（runtime-env / logger / provider），追加 `registerCaseRoutes`；
6. `apps/server/api/src/plugins/error-handler.ts`：保留 Final 全部码 + Slice 2 Case 码 / generic 500；
7. `scripts/openapi-generate.mjs` / `openapi-check.mjs`：以 Final 的 `openapi-spec.ts` 架构为基座，纳入 Slice 2 frozen YAML；
8. `scripts/guard-static.mjs` / `db-evidence.mjs` / `coverage-audit.mjs`：保留 Final 断言 + Slice 2 增量。

merge 后必须重跑：

```bash
bun run typecheck
bun run guard:static
bunx vitest run
bun run db:migrate && bun run db:migrate
bun run db:evidence
bun run openapi:generate && bun run openapi:check
bun run coverage:audit
node scripts/verify-all.mjs --archive
node .specify/scripts/validate-governance.mjs
node .specify/scripts/tests/run-governance-tests.mjs
```

**禁止**：rebase、force push、为通过测试删除 Final 断言、回退 header / runtime-env / semantic equivalence、修改 `Docs/**` 或 Slice 1。