# Implementation Plan: Case Participant 核心地基（case_participants / 邀请 · 接受 · 拒绝 · 退出）

**Feature**: `specs/004-case-participant-core/spec.md`
**Date**: 2026-11-06
**V1 Phase**: Phase 1 — Common Core 地基（`Docs/V1技术设计.md` §38「Account / Person / Family / Participant」）
**Plan base (feature head)**: `6efc1a02aa7e5cb76c763b9a495cd437eff75a24`
**Docs baseline**: `Docs/V1产品需求.md` v3.7、`Docs/V1技术设计.md` v3.12
**Upstream identity contract**: `specs/005-invited-identity-binding-contract/spec.md`（已 merge `main` `ed0d5fbee8c6764be704da8d80fb27ad2172222b`）

> 本文件是已批准上游文档与冻结 spec 的实现投影，不是第二次产品设计。Plan 只决定“如何实现”，不重新决定“产品应该是什么”。任何超出已批准范围的项都必须在 `## Complexity Exceptions` / `## Dependency Gate` 显式列出，不得静默生效。

---

## Upstream Traceability

| Plan 决策 | 上游 ID / 章节 |
|---|---|
| 单一 Case 参与资源（`case_participants`），invite token 只是传输载体 | spec OQ-1、§7.1、§28.8 |
| 生命周期 pending → accepted(active) / declined / expired；active → withdrawn | spec OQ-1—OQ-3、§10、U11 |
| decline 只由 target Person 本人发起；withdraw 只由 active Participant 本人发起 | spec OQ-2 / OQ-3、§10、U11、005 §5.6.4 |
| pending 资源 ≠ active Participant capability；accept 后才产生有限权限 | spec OQ-1、§10、V1-C20 |
| terminal 资源不可重新 accept / 重新激活 | spec FR-015、SC-005、§5 不变量 17 |
| 邀请只能由 Case 管理主体创建；Case 管理资格复用 Slice 2 冻结语义 | spec FR-003、§9、`specs/002-case-core` |
| target 必须是目标 Family 中已合法存在的 Person | spec FR-004、§1.5、§7.1 |
| token 不可枚举；查询不得泄露 Person / Family / Case / guardian / age / consent / compliance | spec FR-006 / FR-022、§37.2、V1-C21 |
| Identity ≠ Participation；Case B / Case C 分流；no-P2；不重绑 | spec FR-005 / FR-009、§10、§28.1 / §28.8、V1-C44、005 |
| UNDER_14 consent-first / current guardian / current consent / applicable Compliance | spec FR-010、§7.7A、§10、V1-C39、005 §5.4 |
| 最小授权：Participant 只获得当前 Case 的明确有限权限；无 Case 全量读取 | spec FR-017 / FR-018 / FR-025、§9、V1-C20 / V1-C21 |
| 生命周期可审计，复用 `business_audit_events`，不建第二套 audit | spec FR-023、§7.9、§38 |
| 关键命令幂等：`actor_id + command_type + idempotency_key` | spec FR-016、§8.5、V1-C28 |
| 六条最小 public routes；明确 DEFER `/participations/:id/responses` | spec FR-026—FR-028、§28.8 |
| `GET /participations/:id` 只返回 participation 自身最小状态 | spec FR-027、OQ-5 |
| 无 Evidence / Assessment / Formulation / Scene / Plan / Task / AI / 通知 / UI | spec Out of Scope、§7.2、Slice 3 边界 |
| Implement 依赖 Slice 1 / Slice 2 完成并通过 Converge 后 merge main | spec FR-030、AGENTS、Constitution III、§38 |

**Blocking rule**: 无法追溯到上表的实现细节一律不进入 Plan。spec 的 `FR-001`—`FR-031` 与 `SC-001`—`SC-015` 是本 Plan 的完整需求集合。

---

## Summary

本 Slice 交付 Phase 1 的 **Case Participant 最小纵切**：

1. **一个领域对象**：`case_participants` 同时承载 pending 参与资源与 active participation；`participation-invites/:token` 只是待接受资源的传输 / 呈现入口，不是第二领域对象（OQ-1）。
2. **冻结生命周期**：`PENDING → ACTIVE | DECLINED | EXPIRED`，`ACTIVE → WITHDRAWN`；terminal 不可复活；`DECLINED ≠ WITHDRAWN ≠ EXPIRED`。
3. **六条 public routes**：建邀请、目标查看邀请、接受、拒绝、退出、读取 participation 最小状态；不建 generic responses / participant 管理端点 / Evidence 端点。
4. **Identity seam**：accept 的身份前置只消费“已认证 actor 的 resolved `personId` 是否等于 participation 的 target `person_id`”。Slice 4 **不写** `persons.account_id`、不创建 Person、不重绑、不自动 accept；Case B 与 Case C 在 accept 层不可区分。
5. **Compliance gate**：建邀请与 accept 两处重新读取当前 Compliance / guardian / consent；decline / withdraw 不被合规 gate 阻断，保证退出与拒绝始终可用。
6. **TTL**：`invite_expires_at` 由**服务端必需配置**给出有限值；Plan 不冻结任何具体数字；无配置时 fail-closed，绝不 fallback 为永久有效。
7. **过期**：不引入后台定时器；pending 资源在 `invite_expires_at` 后按**有效状态**判定为 EXPIRED，并在首次有授权的读取 / 命令访问时物化 + 审计。
8. **幂等 / 并发**：复用既有 `idempotency_keys` 与 `runIdempotentCommand`；接受 / 拒绝 / 退出用行锁 + 条件更新收敛到恰好一个合法结果。
9. **RLS**：`case_participants` ENABLE + FORCE；family scope + self read + invite-token read 三条策略；应用层 `authorize()` 仍是业务权限事实。
10. **审计**：只复用 `business_audit_events`，扩展事件类型与 `resource_type`；不写 `case_events`、不建第二套 audit、不记录 token / openid / PII。

不做（与 spec 一致）：Assessment、Problem Formulation、Scene、Evidence 写入、Assertion / Observation、Goals / Interventions / Plan / Task、AI / RAG / Memory / Safety、真实通知发送、前端 UI、通用 participant response、generic RBAC、跨 Family participant、participant-to-participant 可见性、完整数据权利工作流。

---

## Technical Baseline

`Docs/V1技术设计.md` 是权威；以下只抄本 Slice 相关子集。**不新增任何未批准依赖。**

**Runtime / Language**: Node.js 26 LTS（development baseline `26.13.0`）+ ESM + TypeScript；Fastify 5 stable（`5.12.8` security patch）。

**Dependencies**（全部来自 §2 / §4.1，exact patch 由 lockfile 固定）：
- 服务端：`fastify@5.12.8`、`fastify-type-provider-zod@7`
- 契约：`zod@>=4.2`、`@fastify/swagger`、`openapi-typescript`、`openapi-fetch`
- 数据：`drizzle-orm@0.45` stable line、`drizzle-kit@0.31` stable line、`node-postgres`（`pg`）
- 测试：`vitest`
- 运行时内建：`node:crypto`（token 生成 / hash）、现有 `runIdempotentCommand`

**明确不引入**：
- 任何第三方鉴权 / JWT 库、任何 RBAC / 权限 DSL、任何额外 migration 框架；
- `testcontainers` 或其它测试容器库（沿用 §4 Stage A 的 Docker Compose + `DATABASE_URL`);
- 后台 job / worker / pg-boss（本 Slice 不发送通知、不做定时过期）；
- 第二套幂等表、第二套 audit 表、第二张 participant 表；
- 005 的 binding attempt 存储 / 端点（由 005 runtime 拥有，不在本 Slice 重造）。

**Storage / Migration**:
- PostgreSQL 18（原生 `uuidv7()`）。
- 双角色：`xiaoshuyin_migrator`（table owner，只跑 DDL）/ `xiaoshuyin_app`（非 owner、`NOBYPASSRLS`、最小 DML）。
- 变更只经 `db/migrations/` 下 reviewed SQL；禁止 `drizzle-kit push`。
- Drizzle 负责 schema 类型与事务；RLS、policy、索引、函数用显式 SQL。

**Testing / Eval**:
- `vitest`：domain / authorization / RLS / transaction / integration / API contract。
- 本 Slice 无 AI / RAG / Promptfoo / Gold Dataset 需求，故不建 `ai-eval`、不产生任何 eval 声明。
- 数据库级验证用**同一 PostgreSQL 18 实例**跑真实 SQL 断言，不是 mock。

**Deployment target**: Stage A（Local / CI）Docker Compose。本 Slice 不产出 Stage B/C 证据，也不声称任何平台能力。

---

## Constitution Check

*GATE: MUST PASS before implementation planning proceeds.*

- [x] **No new product semantics.** 只实现 spec FR-001—FR-031。`case_participants`、状态枚举、token 存储、RLS、TTL 表达、错误映射属 §7.1 / §7.7A / §8.5 / §9 / §9.1 / §10 / §28.8 / OQ-1—OQ-6 显式下放给 Plan 的技术决定。
- [x] **No V2–V5 scope pulled into V1.** 无跨 Family participant、无 multi-family switcher、无 generic RBAC、无 Evidence / Assessment / Formulation / Scene / Plan / Task / AI / Notification。
- [x] **No canonical A/010xx behavior reordered.** Digital Use 未被触及；本 Slice 无任何 A/010xx 节点、无 routing、无 manifest。
- [x] **Frozen technical stack and exclusions are respected.** 依赖清单严格等于 §2 / §4.1；主动排除后台 job、通知、第二套幂等 / 审计框架。
- [x] **Deterministic rules remain deterministic.** 参与状态机、过期判定、授权、幂等、并发收敛、审计全部是纯规则 + 数据库约束，无模型参与。
- [x] **Authorization / Consent / RLS / Safety / Compliance implications are addressed.** 三角色授权 + 双层隔离 + current guardian / consent 复检 + UNKNOWN fail-closed；Safety 本 Slice 无作用对象，显式 N/A。
- [x] **Data provenance/version/history requirements are preserved.** participation 行保留完整状态时间戳；terminal 历史只追加不删除；审计事件只追加。
- [x] **Failure/UNKNOWN/concurrency/idempotency behavior is designed where applicable.** 默认拒绝、UNKNOWN 不推断、行锁 + 条件更新、partial unique index、幂等重放 / mismatch、真实失败状态码。
- [x] **Verification path exists for every acceptance item.** 见 `## Verification Plan` 与 `quickstart.md`。

**结论：PASS。无 Complexity Exception。**

---

## Design

### 决策索引

| # | 决策 | 章节 |
|---|---|---|
| D-1 | 模块 / 包归属与不新增依赖 | §D-1 |
| D-2 | 数据模型与单一参与资源 | §D-2 |
| D-3 | DB migration 策略 | §D-3 |
| D-4 | 领域状态模型 | §D-4 |
| D-5 | API routes 与最小 surface | §D-5 |
| D-6 | 授权流程 | §D-6 |
| D-7 | Identity prerequisite flow（Case B / Case C） | §D-7 |
| D-8 | Compliance / Consent 复检点 | §D-8 |
| D-9 | 幂等 | §D-9 |
| D-10 | 并发 | §D-10 |
| D-11 | RLS | §D-11 |
| D-12 | 审计 | §D-12 |
| D-13 | 防枚举与失败语义 | §D-13 |
| D-14 | TTL / expiry policy | §D-14 |
| D-15 | 测试策略 | §D-15 |
| D-16 | 可观测性 / 日志 | §D-16 |
| D-17 | 依赖 / Implement gate | §D-17 |

列级 schema 见 `data-model.md`；API 契约见 `contracts/participation-api.openapi.yaml`；授权 / RLS / 幂等 / 事务见 `contracts/authorization-rls-and-idempotency.md`；生命周期 / identity seam / 审计 / 防枚举见 `contracts/participant-lifecycle-and-identity-seam.md`；可执行验证路径见 `quickstart.md`。

---

### D-1 模块 / 包归属

| 路径 | 职责 | 约束 |
|---|---|---|
| `packages/domain/src/participants.ts` | participation 纯状态机、token 生成 / hash、参与资源 repository、过期有效状态判定 | 所有 `case_participants` SQL 只在此文件；路由不得直接持有 SQL（沿用 Slice 1 / 2 的 guard R4） |
| `packages/domain/src/idempotency.ts` | 扩展 `IdempotencyCommandType`：`PARTICIPATION_INVITE_CREATE` / `PARTICIPATION_ACCEPT` / `PARTICIPATION_DECLINE` / `PARTICIPATION_WITHDRAW` | 只扩展类型，不新建第二套幂等实现 |
| `packages/authorization/src/authorize.ts` | 扩展 `AuthInput` / `Action` / `Purpose` / `Resource`，增加 participation 维度 | 不新建 `authorizeParticipation()`；所有判定仍走单一 `authorize()` |
| `packages/contracts/src/schemas.ts` | 新增 participation Zod schemas（camelCase） | strict schema；客户端不得提交 `familyId` / `caseId` / `state` / token 等越权字段 |
| `packages/contracts/src/env.ts` | 新增必需配置 `PARTICIPATION_INVITE_TTL_SECONDS`（正整数） | 无默认值；缺失 / 非正 → 启动失败（fail-closed） |
| `packages/compliance/src/age-gate.ts` | 复用 `assertMinorProcessingAllowed` 作为参与 eligibility gate | 不复制 Age Matrix；不新增 consent 类型 |
| `apps/server/api/src/routes/participations.ts` | 六条路由的 HTTP 编排 | 不持有 SQL；只调用 domain / authorization / compliance |
| `apps/server/api/src/plugins/auth.ts` | 仅对 `GET /api/v1/participation-invites/:token` 放行未认证访问 | 不得放行 accept / decline / withdraw / GET participation |
| `apps/server/api/src/db/tx.ts` | 复用现有 `withIdentityTransaction` / `withRlsTransaction`；新增 invite-token 上下文入口（如需要） | 不在事务外 `SET LOCAL`；不绕过 `authorize()` |
| `db/migrations/<next>_case_participant_core.sql` | enum / 表 / 约束 / 索引 / RLS / GRANT / CHECK 扩展 | 不修改 001 / 002 / 003；不建第二张 participant 表 |
| `tests/**` | 单元 / 集成 / DB / RLS / 并发 / API contract / 负向安全 | Plan 只设计，不写测试代码 |

**不新增**：`packages/participants/` 独立包、`apps/server/worker`、`packages/notifications`、`packages/identity-binding`（005 runtime 不在本 Slice）。

---

### D-2 数据模型与单一参与资源

完整列级设计见 `data-model.md`。本节只冻结语义：

- **一张表**：`case_participants`，同时承载 pending 参与资源与 active / terminal 历史。
- **不建第二张 invite 表**：`invite_token_hash` 是同一行的传输载体列；token 明文不落库。
- **不复制第二真相源**：
  - Family membership 只在 `family_members`；`case_participants` 不存 role / guardian / account / consent 状态；
  - Account↔Person 只在 `persons.account_id`；`case_participants` 不存 account_id / binding state；
  - Compliance / consent 只在 `person_compliance_profiles` / `consent_records`；`case_participants` 不存 age_band / guardian / consent snapshot。
- **目标 Person**：`person_id` 必须属于目标 Family，由应用校验 + 复合 FK / RLS 双层保证。
- **Case 归属**：`case_id` 必须属于同一 `family_id`，由复合 FK 保证。
- **唯一性**：同一 `(case_id, person_id)` 最多一个 **PENDING 或 ACTIVE** 参与资源；terminal 历史可多条。该约束是防止重复活跃参与的结构防线，不是新业务状态。
- **token**：32 字节随机、base64url 传输、SHA-256 hex 存储；全局唯一；明文只在创建响应返回一次。
- **TTL**：`invite_expires_at` NOT NULL，无 DB 默认值；由服务端配置生成。
- **历史**：`accepted_at` / `declined_at` / `expired_at` / `withdrawn_at` 与 state 一一对应；WITHDRAWN 保留 `accepted_at`。

---

### D-3 DB Migration 策略

**文件**：`db/migrations/<next-after-final-merged-main>_case_participant_core.sql`。
- 基于当前 Plan base，若 `main` 的最新业务 migration 为 `003_case_idempotency_key_bytes.sql`，本 Slice 使用 `004_case_participant_core.sql`；Implement 时必须读取当时 final merged `main` 的最新编号，不硬编码编号。
- 不修改 `001_initial_schema.sql` / `002_case_core.sql` / `003_case_idempotency_key_bytes.sql`。

**顺序**（被引用唯一键必须先于复合 FK 存在）：

```text
01  CREATE TYPE case_participation_state
02  ALTER TABLE family_members
      ADD CONSTRAINT family_members_person_family_key UNIQUE (person_id, family_id)
      -- 仅当 final merged main 尚无该唯一键时；用于 (person_id, family_id) 复合 FK
03  CREATE TABLE case_participants
04  case_participants 自身约束 / 索引 / 复合 FK
05  CREATE FUNCTION app_invite_token_hash() / app.set_invite_token_context()
06  ALTER TABLE case_participants ENABLE + FORCE ROW LEVEL SECURITY
07  CREATE POLICY family scope / self read / invite-token read
08  GRANT SELECT, INSERT, UPDATE ON case_participants TO xiaoshuyin_app
    GRANT USAGE ON TYPE case_participation_state TO xiaoshuyin_app
    GRANT EXECUTE ON FUNCTION app.set_invite_token_context(text) TO xiaoshuyin_app
09  ALTER TABLE business_audit_events DROP/ADD event_type CHECK
10  ALTER TABLE business_audit_events DROP/ADD resource_type CHECK
11  ALTER TABLE idempotency_keys DROP/ADD command_type CHECK
```

**禁止**：
- 修改历史 migration；`drizzle-kit push`；在 migration 中写业务数据 / 回填；
- 建 `participation_invites` 第二领域表、第二张幂等表、第二套审计表；
- 改 `case_events` 的 metadata shape（本 Slice 不写 `case_events`）；
- 建 005 binding attempt 表 / 端点（005 runtime 拥有）；
- 为未来对象建空表 / 占位列 / 预留索引。

**Migration 失败处理**：任一 DDL 失败即整个 migration 回滚；不得手工部分应用。Implement 必须在空库与已有 001/002/003 的库上各重放一次。

---

### D-4 领域状态模型

```text
PENDING ──accept──→ ACTIVE ──withdraw──→ WITHDRAWN (historical inactive)
   │
   ├──decline──→ DECLINED (terminal)
   └──expire───→ EXPIRED  (terminal)
```

**不变量**：
1. `PENDING` 不是 active Participant；此时 `active participant capability = 0`。
2. `ACTIVE` 只能由 `PENDING` 经显式 accept 产生；不存在隐式 accept。
3. `DECLINED` / `EXPIRED` / `WITHDRAWN` 是 terminal；不可 accept、不可复活、不可重新激活。
4. `DECLINED ≠ WITHDRAWN ≠ EXPIRED`：三者时间戳、审计事件、外部语义分开。
5. `WITHDRAWN` 保留 `accepted_at`，表示“曾经合法参与，之后退出”；不得删除历史。
6. 同一 `(case_id, person_id)` 最多一个 PENDING / ACTIVE；terminal 历史可多条。
7. 过期判定：`state = PENDING AND now() >= invite_expires_at` 在业务上等价于 `EXPIRED`，即使尚未物化。
8. 物化规则：有授权的 accept / decline / GET participation 在观察到过期时，先以条件 UPDATE 写 `EXPIRED` + `expired_at`，再返回真实结果；未认证 invite lookup 只返回 `UNAVAILABLE`，不改写行。

**状态 / 时间戳 CHECK**（详见 `data-model.md`）：每个 state 只允许对应的时间戳组合；WITHDRAWN 必须同时有 `accepted_at` 与 `withdrawn_at`；EXPIRED 的 `expired_at` 必须 `>= invite_expires_at`。

---

### D-5 API routes 与最小 surface

严格取自 spec FR-026，path 与 §28.8 一字不差：

| Method | Path | 目的 | 认证 | 幂等 |
|---|---|---|---|---|
| `POST` | `/api/v1/cases/:id/participation-invites` | 建邀请 | 必需 | `PARTICIPATION_INVITE_CREATE` |
| `GET` | `/api/v1/participation-invites/:token` | 目标查看邀请 | 可选 / 未认证 | 否 |
| `POST` | `/api/v1/participation-invites/:token/accept` | 接受 | 必需 | `PARTICIPATION_ACCEPT` |
| `POST` | `/api/v1/participations/:id/decline` | 拒绝 | 必需 | `PARTICIPATION_DECLINE` |
| `POST` | `/api/v1/participations/:id/withdraw` | 退出 | 必需 | `PARTICIPATION_WITHDRAW` |
| `GET` | `/api/v1/participations/:id` | 读取 participation 最小状态 | 必需 | 否 |

**不存在的 routes**（结构断言）：
- `POST /api/v1/participations/:id/responses`（明确 DEFER）；
- 任何 participant 管理 / 列表 / 批量 / generic response / Evidence / Assessment / Formulation / Scene / Plan / Task / Notification / UI route；
- `/cases/current`、`pause`、`resume`、`switch-primary`、`close`、`recurrences`、`messages`、`assessments`、`participants` 等 Case Core 之外的 route。

**响应最小字段**：

```text
ParticipationResource {
  id, caseId, personId, state,
  createdAt, acceptedAt?, declinedAt?, expiredAt?, withdrawnAt?
}
```

- 不返回：Family 详情、Case 内容、Evidence、家长原始消息、其他 Participant、Formulation、Plan、任何 Case 业务对象。
- `GET /participations/:id` 不得成为隐式 Case read。
- 建邀请响应额外返回 `inviteToken`（仅一次）与 `expiresAt`；后续任何读取不再返回 token。
- 未认证 invite lookup 只返回 `{ participationId, state: 'PENDING', expiresAt, notice }`；不返回 `personId` / `caseId` / `familyId` / guardian / age / consent / compliance。

完整 schema / 状态码 / 错误码见 `contracts/participation-api.openapi.yaml`。

---

### D-6 授权流程

**三类 actor**（spec FR-020）：

| actor | 资格来源 | 可做什么 | 不得做什么 |
|---|---|---|---|
| Case manager / inviter | 目标 Family 的 V1 管理主体 = 创建该 Family 的 adult Person（Slice 1 / 2 冻结） | 在合法 Case context 创建 invite；读取该 participation 的最小状态 | 自动成为 Participant；绕过 Compliance gate；代 target accept / decline |
| invite target | `actor.personId === participation.person_id` | 查看自己的 invite / accept / decline / 读取自己的 participation | 处理别人的 invite；become Case manager；读取 Case 内容 |
| active Participant | 同上且 `state = ACTIVE` | withdraw / 读取自己的 participation | 自动获得 Case 读取；调用 manager-only Case 命令；读取其他 Participant 内容 |

**`authorize()` 扩展**（不新建第二入口）：

- 新增 `Action`：`PARTICIPATION_INVITE_CREATE`、`PARTICIPATION_READ_SELF`、`PARTICIPATION_ACCEPT_SELF`、`PARTICIPATION_DECLINE_SELF`、`PARTICIPATION_WITHDRAW_SELF`、`PARTICIPATION_READ_MANAGER`。
- 新增 `Resource`：`PARTICIPATION`。
- 新增 `Purpose`：`PARTICIPATION`（self actions）；manager actions 沿用 `FAMILY_MANAGEMENT`。
- 扩展 `AuthInput`：
  ```ts
  participation: { personId: string; state: CaseParticipationState } | null
  ```
- 判定顺序（fail-closed）：
  1. action / purpose 不在注册表 → DENY / `UNSUPPORTED_ACTION` / `UNSUPPORTED_PURPOSE`；
  2. `PARTICIPATION_INVITE_CREATE`：`family === null` / `case === null` → DENY；`family.createdByPersonId !== actor.personId` → DENY / `NOT_FAMILY_MANAGER`；否则 ALLOW（manager）。
  3. `PARTICIPATION_READ_MANAGER`：同 manager 判定；`participation === null` → DENY / `PARTICIPATION_CONTEXT_REQUIRED`。
  4. self actions：`participation === null` → DENY / `PARTICIPATION_CONTEXT_REQUIRED`；`participation.personId !== actor.personId` → DENY / `NOT_PARTICIPANT`；否则 ALLOW。
  5. 非 participation actions：保持 Slice 1 / Slice 2 行为不变。
  6. 任何内部异常 → DENY / `AUTHORIZATION_ERROR`。
- **状态检查不在 `authorize()` 内重复实现**：`authorize()` 判“谁可以尝试”；具体状态转换由 domain service 在行锁下判定，并由 DB CHECK / 条件 UPDATE 作最后防线。`authorize()` 可接收 state 用于日志与拒绝明显越权动作，但不得成为状态机第二真相源。

**Guardian / Family membership**：
- 普通 Family membership 不自动授予 invite 创建、participant 读取或 Case 读取。
- guardian relationship 只用于未成年人 Compliance gate 与 005 身份确认，不自动授予任何 Case / Participant 权限。
- 非 manager 的 guardian（即使同时是 Family member）不能创建 invite、不能读取他人 participation。

**Case-wide access**：本 Slice 不修改 Slice 2 的 Case 授权。活跃 Participant 调用 `GET /api/v1/cases/:id` 仍按 Slice 2 的 manager-only 语义失败（`404 CASE_NOT_FOUND`）。Participant 只通过 `GET /participations/:id` 读取自己的最小参与状态。

---

### D-7 Identity prerequisite flow（Case B / Case C）

**唯一身份前置**：`authenticated actor → persons.account_id → personId` 已由现有 auth plugin 解析。Slice 4 **只比较**：

```text
actor.personId === participation.person_id
```

**不读、不写、不复制 `persons.account_id`**；不创建 Person；不重绑；不 merge；不自动 accept。

| 情形 | 内部事实 | accept 结果 | 外部表现 |
|---|---|---|---|
| Case B：P1 已有 Account B，当前 Account == B | auth 解析 `actor.personId = P1` | 允许（复用既有 binding） | 200 + pending → active |
| Case B：P1 已有 Account B，当前 Account != B | `actor.personId != P1` | 拒绝 | 404 generic；无 rebind |
| Case C：P1 无 Account，005 binding 尚未 COMMITTED | `actor.personId` 为 null 或其它 Person | 拒绝；`active participation = 0` | 404 generic；不泄露 Case C |
| Case C：005 binding 已 COMMITTED | `actor.personId = P1` | 允许；仍需显式 accept | 200 + pending → active |
| 普通登录先行：A↔P2 已成立，之后打开 P1 邀请 | `actor.personId = P2 != P1` | 拒绝 | 404 generic；A↔P2 与 P1 不变 |

**Identity ≠ Participation**：
- binding success 只让 `actor.personId = P1`；不会自动把 `PENDING` 改为 `ACTIVE`。
- accept 仍是独立的显式用户动作；测试必须断言 binding 成功后 `active participation` 仍为 0，直到 accept。
- decline / withdraw 不自动解除 binding；binding 由 005 runtime 拥有，Slice 4 不设计 unlink。

**Invitation flow routing invariant**：
- 从 participation invitation 进入 Case C 时，产品 / 客户端流程必须在调用普通 `/api/v1/auth/wechat` 之前 route 到 005 invitation-aware bootstrap；Slice 4 不实现该 bootstrap。
- Slice 4 的 accept 端点**不对外区分 Case B / Case C**；两者都只返回同一个“identity prerequisite 是否满足”的结果。这样“下一步可继续动作”不会成为 Case C / guardian / consent 的 oracle。
- Case B 的正确 Account 不需要重走双确认；是否短路由 005 runtime 决定，Slice 4 只消费最终 `actor.personId`。

**005 runtime 边界**：
- 005 contract 已 merge；其 runtime（invitation-aware bootstrap 端点 / attempt 存储 / 双确认 / candidate recognition / Age Gate 1/2）**尚未在 `main` 实现**。
- Slice 4 **不得**自行实现 identity proof / candidate recognition / binding attempt / no-P2 bootstrap。
- Slice 4 的 Case C 端到端验收依赖 005 runtime 提供最终 Account↔P1 binding；在 005 runtime 可用前，Implement Gate 保持 BLOCKED（见 §D-17）。

---

### D-8 Compliance / Consent 复检点

复用 Slice 1 的 `assertMinorProcessingAllowed(personId, deps)`，不复制 Age Matrix，不新增 consent 类型。

| 时点 | 检查 | 失败结果 |
|---|---|---|
| 建邀请 | 读取 target Person 当前 Compliance Profile；`UNKNOWN` / `PROFILE_MISSING` / UNDER_14 缺 current guardian 或 current valid guardian consent / applicable gate 失败 → BLOCK | `403 PARTICIPATION_TARGET_INELIGIBLE`；零邀请写入；不返回 age / guardian / consent 细节 |
| accept | **重新读取**当前 Profile / guardian / consent / Compliance；不得使用 stale snapshot；UNDER_14 缺当前有效同意 → BLOCK；MINOR_14_17 只要求该年龄段 applicable gates；ADULT 不因年龄要求 UNDER_14 consent；UNKNOWN → BLOCK | `404 PARTICIPATION_NOT_FOUND`（generic）；`active participation = 0`；无部分写入 |
| decline | 不做 Compliance gate | 保证拒绝始终可用；decline 是合法结果 |
| withdraw | 不做 Compliance gate | 保证退出始终可用；withdraw 是合法结果 |

**不变**：
- guardian relationship 仍只来自 `person_compliance_profiles.guardian_person_id`；
- guardian consent 仍只来自 `consent_records` 的当前有效版本；
- `case_participants` 不存 age_band / guardian / consent 快照，避免第二真相源；
- 不新建 guardian policy / consent 类型 / Compliance Profile 字段；
- 不把 invite / accept 倒置为「invite → create child Person → consent later」。

**ADULT / Case C 边界**：005 明确 ADULT 的 invited identity binding NOT SUPPORTED。ADULT 若已有自有 Account（Case B），accept 可按上述规则走；ADULT 若 Account = none，005 runtime 不会为其建立 invited binding，accept 只会得到 generic failure。Slice 4 不为 ADULT 发明新绑定路径。

---

### D-9 幂等

**复用**：`idempotency_keys` 表、`runIdempotentCommand()`、`canonicalJson()` / `hashPayload()` / `decideIdempotency()`。不新建第二套幂等框架。

**新增 `command_type`**：`PARTICIPATION_INVITE_CREATE`、`PARTICIPATION_ACCEPT`、`PARTICIPATION_DECLINE`、`PARTICIPATION_WITHDRAW`。

**物理 key**：
- 新 command type 都**不是** `CASE_CREATE`，继续使用既有 `idempotency_key text NOT NULL` 表示 logical key；
- 不需要 `idempotency_key_bytes`；现有 `idempotency_keys_key_representation_check` 已保证「非 CASE_CREATE → text only」；
- 不修改 `003_case_idempotency_key_bytes.sql` 的 CASE_CREATE 语义。

**canonical payload / hash**：

| command | scope | canonical payload（进入 hash） |
|---|---|---|
| `PARTICIPATION_INVITE_CREATE` | actor_account + command + key | `{ familyId: 已验证当前 Family, caseId: path case, personId: body target }` |
| `PARTICIPATION_ACCEPT` | 同上 | `{ inviteTokenHash, participationId }`（token 明文不落库；hash 用于一致性） |
| `PARTICIPATION_DECLINE` | 同上 | `{ participationId }` |
| `PARTICIPATION_WITHDRAW` | 同上 | `{ participationId }` |

**决策表**：

| 现有记录 | hash | 结果 |
|---|---|---|
| 无 | — | `EXECUTE`：占位 → 业务 → 回填 → commit |
| 有 | 相同 | `REPLAY`：返回原 status / body；不重复写 participation / audit |
| 有 | 不同 | `MISMATCH` → `409 IDEMPOTENCY_PAYLOAD_MISMATCH`；不改原资源 |

**并发同 key**：由既有事务级 advisory lock + 唯一索引串行化；第一个提交则第二个 replay，第一个回滚则第二个执行。

**不可达性说明**：本 Slice 的 public command shape 存在真实可变 path / body（不同 `caseId` / `personId` / token / participationId），因此同 key 不同 canonical payload 的 mismatch **是可达的**；测试必须在 HTTP / shared repository 层真实验证，不得伪造。这与 Slice 2 的 `CASE_CREATE` 形状不同，不得照搬“HTTP 不可达”的结论。

---

### D-10 并发

**所有状态转换**在 `withRlsTransaction` 内执行：

```text
BEGIN
→ set identity context
→ resolve participation / token context → family context
→ authorize()
→ SELECT ... FROM case_participants WHERE id = $1 FOR UPDATE   // 串行化点
→ 重新检查 state + expires_at
→ 条件 UPDATE（WHERE id = $1 AND state = expected）
→ INSERT business_audit_events
→ idempotency 回填
→ COMMIT
```

| 场景 | 规则 | 结果 |
|---|---|---|
| double accept（同 key） | advisory lock + unique key | 第二个 replay 原结果；只有一个 active |
| double accept（不同 key） | 行锁；第一个 PENDING→ACTIVE；第二个看到 ACTIVE | 返回 200 当前 ACTIVE（幂等收敛）；不新增行 |
| accept vs decline | 行锁；先者赢；后者看到对方 terminal / active | 后者 `409 PARTICIPATION_STATE_CONFLICT`（授权 target）或 `404`（非 target）；不产生矛盾结果 |
| accept vs expiry | 行锁 + `now() >= invite_expires_at` | 过期者先物化 EXPIRED + audit，commit 后返回 generic 失败；不产生 active |
| decline vs expiry | 同上 | 只有一个 terminal（DECLINED 或 EXPIRED），不互相覆盖 |
| withdraw replay | 行锁 + 条件 UPDATE | 第一次 ACTIVE→WITHDRAWN；第二次返回 200 当前 WITHDRAWN；不复活 |
| withdraw before accept | 条件 UPDATE `WHERE state='ACTIVE'` 0 行 | `409 PARTICIPATION_STATE_CONFLICT`（currentState=PENDING）；不改变状态 |
| concurrent invite create（同 case/person） | partial unique index `(case_id, person_id) WHERE state IN ('PENDING','ACTIVE')` | 一个成功；另一个 409 `PARTICIPATION_ALREADY_EXISTS`；无重复 live resource |
| concurrent invite create（不同 target） | 独立行 | 各自成功；互不覆盖 |

**原则**：
- 不用应用层内存锁 / 进程内 Map 作为业务真相；
- 不用“check-then-insert”替代数据库约束；
- 不以自动重试掩盖死锁 / 锁超时；真实失败返回 500；
- 不引入 workflow engine / saga / outbox。

---

### D-11 RLS

`RLS 是 defense-in-depth，不是业务授权事实`。应用层 `authorize()` 仍先执行。

**表**：`case_participants` `ENABLE` + `FORCE ROW LEVEL SECURITY`。

| Policy | 命令 | `USING` | `WITH CHECK` |
|---|---|---|---|
| `case_participants_family_scope` | ALL | `family_id = app_family_id()` | `family_id = app_family_id()` |
| `case_participants_self_read` | SELECT | `person_id = app_person_id()` | — |
| `case_participants_invite_token_read` | SELECT | `invite_token_hash = app_invite_token_hash()` | — |

- `app_invite_token_hash()` = `NULLIF(current_setting('app.invite_token_hash', true), '')`。
- `app.set_invite_token_context(token_hash)` 只设置 `app.invite_token_hash`；要求非空、64 位 hex；无 family / person / account 上下文。
- **invite-token policy 只用于 SELECT**：未认证邀请查看只允许读取安全列（participation id / state / expires_at / created_at），不得读取 / 返回 `person_id` / `case_id` / `family_id`；repository 必须使用专用 safe-column 查询，路由不得 `SELECT *`。
- **self policy 只用于 SELECT 解析**：decline / withdraw 先用它按 id + `person_id = app_person_id()` 解析 family_id，再 `set_family_context()` 获得写上下文；写入仍受 family policy 约束。
- 无上下文 → 谓词 NULL → 0 行 / 写入拒绝。
- 运行角色 `xiaoshuyin_app`：非 owner、`NOBYPASSRLS`、`SELECT/INSERT/UPDATE`；不授予 `DELETE`（历史保留）。
- 不修改 Slice 1 / 2 既有 policy；不在 RLS 中实现 manager / participant 角色矩阵。

**应用层职责**：`authorize()` 判 actor 是否 manager / target / participant；RLS 防查询遗漏。二者不得互相替代。

---

### D-12 审计

**只复用 `business_audit_events`**，不写 `case_events`，不建第二套 audit。

| event_type | 触发 | actor | resource_type | metadata |
|---|---|---|---|---|
| `PARTICIPATION_INVITE_CREATED` | invite 成功创建 | manager account | `CASE_PARTICIPANT` | `{ caseId, personId, state: 'PENDING', expiresAt }` |
| `PARTICIPATION_ACCEPTED` | PENDING → ACTIVE | target account | `CASE_PARTICIPANT` | `{ caseId, personId, fromState: 'PENDING', toState: 'ACTIVE' }` |
| `PARTICIPATION_DECLINED` | PENDING → DECLINED | target account | `CASE_PARTICIPANT` | `{ caseId, personId, fromState: 'PENDING', toState: 'DECLINED' }` |
| `PARTICIPATION_EXPIRED` | PENDING → EXPIRED（物化时） | 触发物化的已认证 account | `CASE_PARTICIPANT` | `{ caseId, personId, fromState: 'PENDING', toState: 'EXPIRED', expiresAt, materializedOnAccess: true }` |
| `PARTICIPATION_WITHDRAWN` | ACTIVE → WITHDRAWN | participant account | `CASE_PARTICIPANT` | `{ caseId, personId, fromState: 'ACTIVE', toState: 'WITHDRAWN' }` |

**规则**：
- 每个成功状态转换与 business 写入同一事务；任一失败整体回滚；
- 幂等 replay 不追加第二组 audit；
- 不记录 invite token / token hash / wechat_openid / 家长原话 / PII；
- 不为审计创建 Person / Account；
- 未授权尝试不写审计（避免噪声与 oracle）；若未来安全审计要求，另行设计；
- expiry 的 `occurred_at` 是物化时间，metadata 中的 `expiresAt` 是真实到期时间；不得伪造为到期瞬间；
- `actor_account_id` 对 expiry 物化事件是“触发物化的已认证 account”，不是“造成到期的原因”；metadata 明确 `materializedOnAccess`。

**CHECK 扩展**：
- `business_audit_events.event_type` 增加上述 5 个值；
- `business_audit_events.resource_type` 增加 `CASE_PARTICIPANT`；
- `idempotency_keys.command_type` 增加 4 个 participation command；
- 扩展前读取 `pg_constraint` 确认真实约束名；不假设默认名。

---

### D-13 防枚举与失败语义

**统一原则**：外部错误不区分“目标不存在 / 跨 Family / 无权限 / 已过期 / 已终止”，除非 actor 已经是被授权的 target / manager。

| 场景 | 外部结果 | 响应体 |
|---|---|---|
| 未认证访问需要认证的 route | `401 UNAUTHENTICATED` | 无业务字段 |
| 建邀请：Case 不存在 / 属于其它 Family / actor 非 manager | `404 CASE_NOT_FOUND` | 逐字节一致，无 Case / Family / Person 字段 |
| 建邀请：actor 无任何 Family | `404 CURRENT_FAMILY_NOT_FOUND` | Slice 1 既有语义 |
| 建邀请：actor 多 Family 歧义 | `409 CURRENT_FAMILY_AMBIGUOUS` | Slice 1 既有语义；不猜测 |
| 建邀请：target 不合法 / Compliance 不满足 | `403 PARTICIPATION_TARGET_INELIGIBLE` | 无 age / guardian / consent / compliance 细节 |
| 建邀请：target 已有 PENDING / ACTIVE participation | `409 PARTICIPATION_ALREADY_EXISTS` | 无 Case / Person 细节 |
| invite token：无效 / 已过期 / 已拒绝 / 已退出 / 不存在 | `404 INVITATION_NOT_AVAILABLE` | 全部一致；不区分原因 |
| invite token：有效 PENDING | `200` | 仅 `participationId` / `state` / `expiresAt` / generic notice |
| accept：未认证 | `401 UNAUTHENTICATED` | — |
| accept：actor 不是 target / binding 未满足 / 资源不可用 | `404 PARTICIPATION_NOT_FOUND` | 全部一致；不泄露 Case B / C / guardian / consent |
| decline / withdraw / GET participation：actor 不是 target / manager / 资源不存在 | `404 PARTICIPATION_NOT_FOUND` | 全部一致 |
| 授权 target 的非法状态转换（如 accept on DECLINED、withdraw on PENDING） | `409 PARTICIPATION_STATE_CONFLICT` | 仅 `{ currentState }`；不含 Case / Family / guardian / consent |
| 同 key 不同 canonical payload | `409 IDEMPOTENCY_PAYLOAD_MISMATCH` | 不改原资源 |
| strict schema 失败 / 越权字段 | `422 VALIDATION_ERROR` | 零业务写入 |
| 未预期错误 / DB 约束破坏 | `500 INTERNAL_ERROR` | 不伪装成功 |

**禁止**：
- 用 403 代替 404 泄露 Case 是否存在；
- 用 404 代替 409 掩盖授权 target 的真实状态冲突；
- 在 404 / 403 / 409 中放入 target Person / Family / Case / guardian / age / consent / compliance 字段；
- 通过“下一步可继续动作”差异形成 Case C / consent 的 oracle；
- 把 UNKNOWN / DECLINED / EXPIRED / WITHDRAWN 写成成功。

---

### D-14 TTL / expiry policy

**配置**：`packages/contracts/src/env.ts` 新增：

```text
PARTICIPATION_INVITE_TTL_SECONDS: integer > 0
```

- **无默认值**；缺失 / 非整数 / <= 0 → 启动配置校验失败（fail-closed）。
- 服务端在创建 invite 时计算 `invite_expires_at = created_at + TTL`。
- caller **不得**提交 / 覆盖 / 延长 TTL；请求体 strict schema 不含 TTL 字段。
- 不提供 `expiresAt` 客户端输入；不接受“永久邀请”。
- **具体数值不在本 Plan 冻结**；生产值属 §34.1 的 RELEASE / POLICY GATE，必须在上线前按真实服务目的、法规、供应商条款批准。
- 测试 / CI 可注入一个显式的 test-only 值；该值不是产品 TTL，不得写入产品文档或 production default。
- 不使用 `interval '24 hours'` 之类硬编码；不得 fallback 为永久 `expires_at = infinity`。

**过期表达**：
- 不使用 pg-boss / 后台定时器 / Temporal；
- pending 过期按有效状态判定；有授权的 accept / decline / GET 在观察到过期时物化 + 审计；
- 未认证 invite lookup 只返回 `UNAVAILABLE`，不物化、不写 audit；
- 物化是幂等的：条件 `WHERE state='PENDING' AND now() >= invite_expires_at`，0 行表示已被其它事务处理；
- 到期后不可 accept、不可重新激活；历史行保留；
- 清理 / 归档属未来数据生命周期 Slice，本 Slice 不删除历史。

---

### D-15 测试策略

Plan 只设计测试，不写测试代码。测试分层：

| 层 | 覆盖 | 关键断言 |
|---|---|---|
| unit / domain | 状态机、token hash、有效过期判定、错误映射、`authorize()` 新分支 | 每个转换只允许合法前置；terminal 不可复活；Case B/C 外部结果一致 |
| integration / API | 六条 route 的 happy path + 失败路径 | 最小字段；无 Case / Family / Evidence 泄漏；strict 422 零写入 |
| DB constraints | enum / CHECK / 复合 FK / partial unique / uuidv7 | 结构 introspection；非法状态/时间戳/跨 Family 插入被拒 |
| DB / RLS | family / self / invite-token policies；无上下文；错误 Family | 0 行 / 写入拒绝；token safe-column 查询；不跨家庭 |
| authorization | manager / target / participant / guardian / 非成员 | 三角色独立；guardian 不自动授权；Participant 无 Case manager 能力 |
| idempotency | 同 key replay / 不同 hash mismatch / 并发同 key | 原结果返回；业务结果数不变；409 可达 |
| concurrency | double accept / accept vs decline / accept vs expiry / withdraw replay / concurrent invite | 恰好一个合法结果；无重复行；无复活 |
| negative security | wrong Family / wrong Case / wrong Person / wrong Account / expired / unauthorized / forwarded invite / multi-family Case C | 统一 generic；无 Person / Family / Case / guardian / age / consent / compliance 字段 |
| API contract | OpenAPI operation 集合、strict schema、生成物一致性 | 恰好 6 个 participation operations；无 `/responses`；`openapi:check` PASS |
| cross-slice | Participant 调用 Case manager routes；accept / decline / withdraw 无 Evidence | Case route 仍 404 / 403；`assertions` / `observations` 计数 +0 |

**必须覆盖的 spec 场景**：
- Case B correct Account / wrong Account；
- Case C identity COMMITTED / PENDING / terminal（通过 005 runtime 或受控 fixture；不得伪造真实绑定）；
- accept success / replay / accept vs decline race / accept after expiry；
- decline success / replay / decline 不关 Case / 不阻断家长；
- withdraw success / replay / withdraw before accept reject / terminal 不复活；
- wrong Family / wrong Person / forwarded invite / multi-family Case C block / UNDER_14 invalid current consent；
- GET participation participant / manager / unauthorized；
- 审计事件存在且无第二套 audit；
- 结构 / 路由枚举无越界对象。

**测试数据纪律**：
- 不 mock 数据库；使用真实 PostgreSQL 18；
- 不为了让测试通过而削弱断言 / 修改冻结期望；
- 005 Case C 场景必须真实经过 005 runtime，或明确标记 `BLOCKED — 005 RUNTIME NOT AVAILABLE`；不得用直接写 `persons.account_id` 冒充端到端 bootstrap（可作为 Case B fixture，但不得声称覆盖 Case C bootstrap）。

---

### D-16 可观测性 / 日志

- 复用 Fastify 内建结构化日志；不引入第三方日志库。
- 不记录：invite token 明文、token hash、`wechat_openid`、家长原话、age / guardian / consent / compliance 私密状态。
- 可记录：`participationId`、`caseId`（内部）、`state`、`result`、错误码；优先使用不透明 id。
- 审计事实以 `business_audit_events` 为准，日志不是业务真相。
- 不新增 metrics / tracing / APM 框架；真实平台 observability 属 Phase 5 / release gate。

---

### D-17 依赖 / Implement gate

| 依赖 | 当前真实状态 | 对本 Slice 的意义 |
|---|---|---|
| Slice 1 `001-family-identity-core` | **MERGED** 到 `origin/main`（`ed0d5fb` 含实现）；`tests/evidence/converge.md` 存在收敛证据 | 提供 Person / Family / `family_members` / guardian / consent / Compliance / `authorize()` / RLS / 幂等 / `business_audit_events` |
| Slice 2 `002-case-core` | **IMPLEMENTATION IN PROGRESS — NOT MERGED**（分支 `feat/002-case-core`，HEAD `dd5d2ca`；`specs/002-case-core` 不在 `main`） | 提供 `cases`、Case manager 语义、Case RLS、`CASE_CREATE` 幂等、`case_events`、audit |
| 005 identity contract | **MERGED** 到 `origin/main`（PR #11，main `ed0d5fb`） | Case B / Case C、candidate recognition、Age / Compliance gates、no-P2、lifecycle separation |
| 005 identity runtime | **NOT IMPLEMENTED**（`main` 无 invitation-aware bootstrap 端点 / attempt 存储 / 双确认运行时） | Case C 端到端 accept 需要 COMMITTED Account↔P1 binding；Slice 4 不得自行实现 |
| Slice 3 `003-evidence-core` | **NOT A DEPENDENCY** | 本 Slice 明确不写 Evidence（FR-019）；不因编号自动要求 merge |

**Implement Gate：BLOCKED。**

至少满足以下全部条件才可 OPEN：

```text
Slice 1: MERGED + convergence evidence
Slice 2: Implement complete → Independent Converge PASS → merged main
005 identity contract: MERGED
005 identity runtime: available for Case C acceptance（或 Slice 4 明确缩减为 Case B only 的已批准变更）
Slice 4 Plan: FINAL PASS
```

- Plan 完成 **不** 代表 Implement Gate 自动 OPEN。
- Slice 3 不是硬依赖；若未来发现真实 Evidence 依赖，必须显式记录并重新评审，不得为了序号人为 merge。
- 不得用 Slice 4 私建替代 Case / Consent / RLS / 幂等 / 审计 / identity binding 基础设施。
- 不得在 Slice 4 分支修改 Slice 1 / 2 / 3 文件、重新设计其冻结基线或修改正式 `Docs/**`。

---

## Project Structure

只列本 Slice 真实会触碰的路径（Plan 阶段只写设计，不创建代码）：

```text
apps/server/api/src/
  plugins/auth.ts                 # 仅放行 GET invite token
  routes/participations.ts        # 六条 route
  db/tx.ts                        # 复用现有事务入口（必要时加 invite-token 上下文）
  app.ts                          # 注册 participation routes

packages/
  authorization/src/authorize.ts  # participation actions / purpose / resource
  compliance/src/age-gate.ts      # 复用现有 gate（不新增矩阵）
  contracts/src/schemas.ts        # participation Zod schemas
  contracts/src/env.ts            # PARTICIPATION_INVITE_TTL_SECONDS
  domain/src/participants.ts      # 状态机 / token / repository
  domain/src/idempotency.ts       # 新 command types
  domain/src/index.ts             # 导出 participants

db/
  migrations/<next>_case_participant_core.sql
  # 不修改 001_initial_schema.sql / 002_case_core.sql / 003_case_idempotency_key_bytes.sql

tests/
  domain/participants-*.test.ts
  integration/participations-*.test.ts
  db/participants-*.test.ts
  # no ai-eval
```

**不创建**：`apps/miniprogram`、`apps/operations`、`packages/scenes`、`packages/ai`、`packages/rag`、`packages/memory`、`packages/notifications`、`apps/server/worker`、任何 005 runtime 模块。

---

## Verification Plan

> 本表是 Plan 阶段的验证设计；所有命令在 Plan 阶段**未执行**，不得作为已通过证据。完整可执行步骤见 `quickstart.md`。

### Requirement Coverage（FR → Design → Verification）

| FR | 技术落点 | 验证落点 |
|---|---|---|
| FR-001 | D-2 / D-6 | `participants-schema.test.ts`、`participants-authorization.test.ts` |
| FR-002 | D-2 / D-3 | `participants-schema.test.ts`、`participants-constraints.test.ts` |
| FR-003 | D-6 / D-8 | `participations-invite.test.ts` |
| FR-004 | D-2 / D-8 | `participations-invite.test.ts`、`participants-constraints.test.ts` |
| FR-005 | D-7 | `participations-identity-seam.test.ts` |
| FR-006 | D-5 / D-13 | `participations-invite-lookup.test.ts`、`participations-anti-enumeration.test.ts` |
| FR-007 | D-4 / D-10 | `participations-accept-concurrency.test.ts` |
| FR-008 | D-6 / D-7 | `participations-scope.test.ts` |
| FR-009 | D-7 | `participations-identity-seam.test.ts` |
| FR-010 | D-8 | `participations-compliance.test.ts` |
| FR-011 | D-4 / D-10 | `participations-decline.test.ts` |
| FR-012 | D-4 / D-12 | `participations-decline.test.ts`、`participations-audit.test.ts` |
| FR-013 | D-4 / D-10 | `participations-withdraw.test.ts` |
| FR-014 | D-4 / D-12 | `participations-withdraw.test.ts`、`participations-audit.test.ts` |
| FR-015 | D-4 / D-14 | `participations-expiry.test.ts`、`participants-domain.test.ts` |
| FR-016 | D-9 / D-10 | `participations-idempotency.test.ts`、`participations-accept-concurrency.test.ts` |
| FR-017 | D-6 / D-11 | `participations-scope.test.ts` |
| FR-018 | D-6 | `participations-scope.test.ts` |
| FR-019 | D-12 / contracts | `participants-evidence-boundary.test.ts` |
| FR-020 | D-6 | `participants-authorization.test.ts` |
| FR-021 | D-11 | `participants-rls.test.ts` |
| FR-022 | D-13 | `participations-anti-enumeration.test.ts` |
| FR-023 | D-12 | `participations-audit.test.ts` |
| FR-024 | D-7 / D-8 | `participations-identity-seam.test.ts`、`participations-compliance.test.ts` |
| FR-025 | D-6 / D-8 | `participations-scope.test.ts` |
| FR-026 | D-5 | `participations-route-surface.test.ts`、`openapi:check` |
| FR-027 | D-5 | `participations-read.test.ts`、`openapi:check` |
| FR-028 | D-5 | `participations-route-surface.test.ts` |
| FR-029 | D-2 / D-3 | `participants-constraints.test.ts` |
| FR-030 | D-17 | `validate-governance.mjs` + `quickstart.md` §1 |
| FR-031 | D-9 / D-10 / D-12 | `participations-rollback.test.ts`、`participations-idempotency.test.ts` |

| Requirement / Acceptance | Test or evidence | Command / environment | Expected result |
|---|---|---|---|
| FR-001 / FR-002：独立 Case 参与关系；绑定 Case + Family + Person | domain + DB schema | `bunx vitest run tests/domain/participants-domain.test.ts tests/db/participants-schema.test.ts` | 只有 `case_participants`；无 role / guardian / account / consent 快照列；复合 FK 存在 |
| FR-003 / FR-004：只有 Case manager 可建邀请；target 必须在目标 Family | integration + DB | `bunx vitest run tests/integration/participations-invite.test.ts` | 非 manager 404；跨 Family Person 拒绝；零写入 |
| FR-005 / FR-009：Case B 复用 / mismatch；Case C 先 binding；binding ≠ accept | integration（005 runtime 或明确 BLOCKED） | `bunx vitest run tests/integration/participations-identity-seam.test.ts` | 正确 Account accept；错误 Account 404；Case C 未 COMMITTED 时 active=0；COMMITTED 后仍需 accept |
| FR-006 / FR-022：token 不可枚举；查询不泄露私密字段 | integration + security | `bunx vitest run tests/integration/participations-invite-lookup.test.ts` | 无效/过期/终止统一 404；200 仅返回 participationId / state / expiresAt / notice |
| FR-007 / FR-016：accept 恰好一个 active；重复/并发收敛 | integration + DB concurrency | `bunx vitest run tests/integration/participations-accept-concurrency.test.ts` | active 计数 = 1；行数不重复增长；同 key replay |
| FR-008 / FR-017 / FR-018：accept 不授予 Case 读取 / manager 能力 | integration cross-slice | `bunx vitest run tests/integration/participations-scope.test.ts` | Participant 调 Case route 仍 404；无 Case 内容返回 |
| FR-010 / FR-024：UNDER_14 / Consent / Compliance 复检 | integration + compliance | `bunx vitest run tests/integration/participations-compliance.test.ts` | 无效 current consent → 建邀请 403 / accept generic 404；无 active；无 stale snapshot |
| FR-011 / FR-012：decline 合法、保留历史、不关 Case | integration + DB | `bunx vitest run tests/integration/participations-decline.test.ts` | DECLINED 行存在；Case 状态不变；家长独立操作不被阻断 |
| FR-013 / FR-014：withdraw 停权、保留历史、不复活 | integration + DB | `bunx vitest run tests/integration/participations-withdraw.test.ts` | 后续能力拒绝；WITHDRAWN 历史存在；accept 不能再激活 |
| FR-015 / SC-005：terminal 不可重新激活；expiry 终态 | domain + integration | `bunx vitest run tests/domain/participants-domain.test.ts tests/integration/participations-expiry.test.ts` | DECLINED / EXPIRED / WITHDRAWN 再 accept 失败；无新 active |
| FR-019 / SC-004：无 Evidence 副作用 | DB | `bunx vitest run tests/db/participants-evidence-boundary.test.ts` | `assertions` / `observations` 计数 +0；无 Evidence 表写入 |
| FR-020 / FR-021：三角色授权；RLS 双层 | domain + integration + DB | `bunx vitest run tests/domain/participants-authorization.test.ts tests/integration/participations-authorization.test.ts tests/db/participants-rls.test.ts` | manager / target / participant 分离；无上下文 0 行；错误 Family 0 行 / 拒写 |
| FR-023 / SC-013：审计可追溯、无第二套 audit | integration + DB | `bunx vitest run tests/integration/participations-audit.test.ts` | 5 类事件存在；`resource_type = CASE_PARTICIPANT`；无第二张 audit 表 |
| FR-025：未来对象访问仍需独立授权 | integration | `bunx vitest run tests/integration/participations-scope.test.ts` | participation 行不构成 Case / Evidence / Formulation / Plan 访问 |
| FR-026 / FR-027 / SC-007：恰好 6 条 routes；最小 GET payload | API contract | `bun run openapi:check` + route enumeration test | 6 个 participation operations；无 `/responses`；GET 字段恰为最小集合 |
| FR-028：无 generic participant response | route / schema enumeration | `bunx vitest run tests/integration/participations-route-surface.test.ts` | 不存在 generic response route / schema / blob |
| FR-029：Case → 0..N Participant；(Case, Person) 唯一 active | DB + integration | `bunx vitest run tests/db/participants-constraints.test.ts` | partial unique 存在；多 Person / 多 Case 合法；重复 live 被拒 |
| FR-030 / Acceptance 19：Implement gate | governance evidence | `node .specify/scripts/validate-governance.mjs` + `quickstart.md` §1 | Gate BLOCKED 时不得声称 Implement complete |
| FR-031：真实失败状态；无部分写入 | integration + DB rollback | `bunx vitest run tests/integration/participations-rollback.test.ts` | 审计 / participation / idempotency 任一失败 → 整体回滚；无假成功 |
| SC-001：cross-Family writes = 0 | DB + integration | `bunx vitest run tests/db/participants-rls.test.ts tests/integration/participations-cross-family.test.ts` | 跨 Family 邀请 / 参与被拒；UUID 存在不构成合法关系 |
| SC-002 / SC-014：并发 / 幂等不重复 | integration + DB | `bunx vitest run tests/integration/participations-accept-concurrency.test.ts tests/integration/participations-idempotency.test.ts` | 一个 active；重放不新增；mismatch 409 |
| SC-003：Participant 不能调 manager-only Case 命令 | integration | `bunx vitest run tests/integration/participations-scope.test.ts` | 404 / 403 按 Slice 2 语义；无 Case 数据 |
| SC-006：未授权 token lookup 不泄露 | integration + security | `bunx vitest run tests/integration/participations-invite-lookup.test.ts` | 无 Person / Family / Case / guardian / age / consent / compliance 字段 |
| SC-008：无 duplicate Person / binding | integration + DB | `bunx vitest run tests/integration/participations-identity-seam.test.ts` | Person 数不增加；Account↔Person 1:1；无 rebind / merge |
| SC-009 / SC-010：decline / withdraw 历史与权限 | integration + DB | `bunx vitest run tests/integration/participations-decline.test.ts tests/integration/participations-withdraw.test.ts` | 历史保留；权限停止；Case 不自动关闭 |
| SC-011 / SC-012：anti-enumeration / UNDER_14 block | integration + security | `bunx vitest run tests/integration/participations-anti-enumeration.test.ts tests/integration/participations-compliance.test.ts` | 三类建邀请失败一致；UNDER_14 无同意阻断 |
| SC-015：结构 / 路由枚举无越界对象 | structure + route enumeration | `bunx vitest run tests/db/participants-structure.test.ts tests/integration/participations-route-surface.test.ts` | 无 formulation / scene / evidence writer / assessment / generic response / AI / plan / task / notification |
| Migration / RLS / 角色 / uuidv7 | DB verification | `bun run db:migrate && bun run db:evidence` | `relrowsecurity = true`、`relforcerowsecurity = true`、app role 非 owner / `rolbypassrls = false`、`uuidv7()` 默认值 |

**全量收尾**：
```bash
bun run typecheck
bun run guard:static
bunx vitest run
bun run openapi:generate
bun run openapi:check
node .specify/scripts/validate-governance.mjs
node .specify/scripts/tests/run-governance-tests.mjs
```

---

## Rollback / Recovery

本 Slice 引入新表 / enum / policy / CHECK 扩展，属于 schema-changing slice。

- **未 merge 前**：丢弃 feature 分支即可；不修改 001/002/003。
- **merge 后**：只能通过**新的 reviewed migration** 回滚：
  - `DROP POLICY` → `DISABLE / DROP ROW LEVEL SECURITY`（仅本表）→ `DROP TABLE case_participants` → `DROP TYPE case_participation_state`；
  - 恢复 `business_audit_events` / `idempotency_keys` 的 CHECK 白名单（删除新增值前必须确认没有对应历史行）；
  - 删除 `family_members_person_family_key`（仅当没有其它对象依赖）；
  - 删除 `app.set_invite_token_context` / `app_invite_token_hash()`。
- **禁止**：修改历史 migration、`drizzle-kit push`、直接删除 audit / participation 历史、用 `TRUNCATE` 清理。
- **配置故障**：若 `PARTICIPATION_INVITE_TTL_SECONDS` 配错，修配置并重启；不改写已有 `invite_expires_at` 历史；不把已发出的邀请延长。
- **并发 / 状态 bug**：先停止相关 route 的写入（部署层禁用），保留数据与审计；修复后通过新 migration / 代码回滚；不得删除历史来“重置”。
- **005 runtime 故障**：Case C accept 失败按 generic 返回；不 fallback 为普通登录或自动 accept。

---

## Complexity Exceptions

无。

本 Plan 未引入：
- 新框架 / 新服务 / 新依赖；
- 第二套幂等 / 审计 / 身份绑定 / RLS；
- 通用 workflow engine / saga / outbox / 后台 job；
- 跨 Family / multi-family / 通用 RBAC；
- KYC / 人脸 / 电话 / 视频 / 政府 ID 等身份证明机制（005 明确禁止）。

---

## Plan Quality Gate（self-review）

| 检查 | 结果 |
|---|---|
| 每个 FR 是否有技术落点 | PASS：FR-001—FR-031 均映射到 D-1—D-17 / contracts / tests |
| 每个 Acceptance 是否可验证 | PASS：见 `## Verification Plan` 与 `quickstart.md` |
| 每个 Success Criterion 是否可验证 | PASS：SC-001—SC-015 均有测试 / DB / contract 证据 |
| 无业务需求被遗漏 | PASS：31 FR / 19 Acceptance / 15 SC 全覆盖 |
| 无新业务需求被发明 | PASS：未新增状态、角色、consent 类型、Evidence、Case 读取、manager cancel |
| 无 Out-of-Scope 被实现 | PASS：结构 / 路由枚举测试显式断言 |
| 无 unresolved placeholder | PASS：TTL 以必需配置表达；005 runtime 以明确 BLOCKED 依赖表达；notice 以版本化静态文案表达 |
| 无 TODO / TBD 可由 Plan 解决却未解决 | PASS |
| TTL 数值未被偷偷发明 | PASS：只定义配置接口与 release gate，不写具体数字 |
| `spec.md` diff = 0 | PASS（本轮未修改） |
| `Docs/**` diff = 0 | PASS（本轮未修改） |

---

## Plan Status

```text
SLICE 4 PLAN FINAL PASS
READY FOR CHECKLIST
```

**注意**：Plan PASS **不** 等于 Implement Gate OPEN。Implement Gate 当前为 `BLOCKED`，原因见 §D-17。