# Implementation Plan: 007-case-primary-switch（Case 主问题切换 / `SwitchPrimaryCase`）

**Feature**: `specs/007-case-primary-switch/spec.md`（已冻结 · SPECIFY / CLARIFY FINAL PASS）
**Date**: 2026-11-07
**V1 Phase**: Phase 1 — Common Core 地基（`Docs/V1技术设计.md` §38；Case 控制面容量补全）
**Slice**: SLICE 007 — Case 主问题切换
**阶段**: Plan → Checklist → Tasks → **审计一**。本文件不含实现、migration、runtime 代码或测试实现。

---

## 0. Baseline 与 Implement Gate

### 0.1 Baseline（本轮现场核对，2026-11-07 14:43 +08:00）

| 项 | 值 |
|---|---|
| Repository | `pyxm1618/xiaoshuyin` |
| Branch | `feat/007-case-primary-switch` |
| 本轮起点 Head（= 已审核 Spec Head） | `69cfe6f661b26f3261b2c71b297eb3ab9a977468` |
| `origin/main` | `ee9d07e059566884e0329fb0eb4a4ab9dbf8ea83` |
| 分支相对 main | `HEAD` 已包含 `origin/main`（`git merge-base --is-ancestor origin/main HEAD` 成立）；无落后 |
| Working tree | clean（`git status --porcelain` 空） |
| 冻结 Spec 状态 | `Specify / Clarify FINAL PASS — READY FOR PLAN AI 2` |
| `specs/002-case-core` 是否在 main | **否**（`specs/` 在 main 上只有 001 / 005 / 007） |
| Slice 2 实现分支 | `feat/002-case-core` = `9ac76f7e8e1640d5e5a448faa062296bd65443f9`（本地与 origin 一致） |
| Slice 2 相对 main | 领先 **38** 个提交，落后 **4** 个提交（Slice 1 final remediation：`af6bb0c`、`0480e38`、`95cd47b`、`ee9d07e`） |

> **Baseline 事实的含义**：Slice 2 的实现分支尚**未**包含 Slice 1 final 的四个 remediation 提交。这既不是 007 的问题，也不能被 007 掩盖；它使「Slice 2 合并 main」本身仍是一个需要 Slice 2 自己完成的动作（见 §0.3 G2）。

### 0.2 本轮可以完成什么 / 不可以完成什么

```text
PLAN / CHECKLIST / TASKS 可以完成    ← 基于 Slice 2 的【冻结合同】+ 真实分支代码形状
IMPLEMENT 不可以开始                 ← Slice 2 尚未完成审计二 PASS 并 merge main
```

本 Plan 对 Slice 2 的引用分为两类，任何时候都不得混淆：

| 类别 | 内容 | 本 Plan 的用法 |
|---|---|---|
| **已可直接读取的真实代码** | `feat/002-case-core` 上的 `db/migrations/002_case_core.sql`、`003_case_idempotency_key_bytes.sql`、`packages/domain/src/cases.ts`、`packages/authorization/src/authorize.ts`、`apps/server/api/src/routes/cases.ts`、`apps/server/api/src/db/tx.ts`、`apps/server/api/src/plugins/error-handler.ts`、`packages/contracts/src/schemas.ts`、`tests/**` | 用于把 Plan 的每个落点写成**具体文件 + 具体函数 + 具体约束名**，而不是抽象描述 |
| **只存在于分支、不在 main** | 以上全部 | **不得**作为「已经可用」的基线；Implement 前必须重新验证（§0.3） |

### 0.3 Implement Gate（G1—G8，任一失败即停止）

**固定失败文案**：

```text
IMPLEMENT BLOCKED — SLICE 2 NOT MERGED
IMPLEMENT BLOCKED — SLICE 2 CONTRACT DRIFT
IMPLEMENT BLOCKED — SLICE 2 SEMANTICS CHANGED
```

| # | Gate 项 | 现场验证方式 | 失败文案 |
|---|---|---|---|
| **G1** | Slice 2 已完成**审计二 PASS** | 读取 Slice 2 的独立审计结论记录（PR review / converge 报告），确认结论为 PASS 且无未解决 finding | `IMPLEMENT BLOCKED — SLICE 2 NOT MERGED` |
| **G2** | Slice 2 已 merge `main`，且 merge 后包含 Slice 1 final remediation | `git fetch origin`；`git merge-base --is-ancestor <slice2-final-head> origin/main` 退出 0；`git rev-parse origin/main` 记录；`git log --oneline origin/main \| grep -c ""` 与 merge 前对比 | `IMPLEMENT BLOCKED — SLICE 2 NOT MERGED` |
| **G3** | 当前 `origin/main` 真实包含 `cases` / `case_events` 运行时 | `git show origin/main:db/migrations/` 列出 `*_case_core.sql`、`*_case_idempotency_key_bytes.sql`；`git show origin/main:apps/server/api/src/routes/cases.ts` 存在；`git show origin/main:packages/domain/src/cases.ts` 存在 | `IMPLEMENT BLOCKED — SLICE 2 NOT MERGED` |
| **G4** | 锁 / 幂等 / 事件 / 授权语义与 Slice 2 冻结一致 | 逐项核对 `lockFamilyForPrimaryDecision`（`SELECT id FROM families WHERE id=$1 FOR UPDATE`）、`reserveIdempotency` / `getReservedIdempotency` / `completeIdempotency`、`case_events_metadata_shape_check` 的真实定义、`decideCaseAction()` 的分支结构 | `IMPLEMENT BLOCKED — SLICE 2 CONTRACT DRIFT` |
| **G5** | `case_events` CHECK 与 `idempotency_keys` CHECK 的真实约束名与真实谓词 | `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid IN ('case_events'::regclass,'idempotency_keys'::regclass,'business_audit_events'::regclass)`；与 §D-9 的假设逐字比对 | `IMPLEMENT BLOCKED — SLICE 2 CONTRACT DRIFT` |
| **G6** | 运行角色上 `cases` 仅有 `SELECT, INSERT`、`case_events` 仅有 `SELECT, INSERT`；`families` 具备 `UPDATE` | `has_table_privilege` / `has_column_privilege` 实测 | `IMPLEMENT BLOCKED — SLICE 2 CONTRACT DRIFT` |
| **G7** | 迁移编号基线 | `ls db/migrations`，确认 `003_*` 是当前最大编号；004 可用且未被占用 | `IMPLEMENT BLOCKED — MIGRATION NUMBERING CONFLICT` |
| **G8** | Slice 2 merge 后未改变本 Plan 依赖的语义：`is_primary` 含义（当前 assignment，非历史）、`version` 从 1 起、`CASE_CREATE` 幂等 body 字段 transport、`authorize()` 无 `authorizeCase()`、`case_events.metadata` 形状约束仍为「恰为 `{primary, version}`」 | 若任一项变化 → 停止，先把差异写入本 Plan 的 `## Change Reconciliation`，再重新执行审计一 | `IMPLEMENT BLOCKED — SLICE 2 SEMANTICS CHANGED` |

> **Gate 语义**：G1—G8 全部 PASS 只表示「依赖满足」，不表示「007 的 Plan 已通过审计二」。本 Plan 永远是 `PLAN FROZEN` 而不是 `READY FOR IMPLEMENTATION`。

---

## Upstream Traceability

| Upstream ID / Section | Source | 本 Plan 的投影 |
|---|---|---|
| V1-C01 | `Docs/V1产品需求.md` §24 | `FR-001`，D-3 / D-4 的单 primary 串行化与唯一索引兜底 |
| V1-C21 | `Docs/V1产品需求.md` §24 | `FR-003` / `FR-016`，D-6 授权 + D-7 RLS |
| V1-C24 | `Docs/V1产品需求.md` §24 | `FR-009`，D-12（无 AI 通道、无建议接口） |
| V1-C25 | `Docs/V1产品需求.md` §24 | `FR-005`，D-5（`SAFETY_HOLD_BLOCKED` 双向谓词） |
| V1-C27 | `Docs/V1产品需求.md` §24 | `FR-017`，D-8（真实失败表，无 200 伪装） |
| V1-C28 | `Docs/V1产品需求.md` §24 | `FR-010` / `FR-011` / `FR-015`，D-3 / D-8 |
| §2.1 六条切换规则 | `Docs/V1产品需求.md` | `FR-008`（说明理由）、`FR-007`（保留原 Case）、`FR-019`（旧提醒前向义务）、`FR-003`（有权用户）、`FR-005`（安全不可规避） |
| §5 不变量 2 / 12 / 17 / 19 / 20 | `Docs/V1技术设计.md` | `FR-001` / `FR-005` / `FR-015` / `FR-006` |
| §6.1 / §6.2 | `Docs/V1技术设计.md` | `FR-006`：本 Slice **只读** status / phase，D-4 显式不写 |
| §7.8 / §7.9 | `Docs/V1技术设计.md` | `FR-012`，D-9（两侧事件 + 一条审计，同事务） |
| §8.1 | `Docs/V1技术设计.md` | `FR-001`，D-3（唯一索引 + Family 行锁） |
| §8.5 | `Docs/V1技术设计.md` | `FR-010`，D-7（`CASE_SWITCH_PRIMARY` 复用 `idempotency_keys`） |
| §8.6 | `Docs/V1技术设计.md` | `FR-011`，D-6（`expectedPrimaryCaseId` + `expectedPrimaryVersion`） |
| §9 | `Docs/V1技术设计.md` | `FR-003`，D-10（`authorize()` 增量一个 action） |
| §9.1 | `Docs/V1技术设计.md` | `FR-016`，D-7（RLS 为第二道防线；无上下文零行） |
| §23 | `Docs/V1技术设计.md` | `FR-002` / `FR-009`：`SwitchPrimaryCase` 是正式 Domain Command，模型只能 request / propose |
| §28.3 | `Docs/V1技术设计.md` | `FR-002`：只新增 `POST /api/v1/cases/:id/switch-primary` |
| §29.4 | `Docs/V1技术设计.md` | `FR-004` / `FR-005` / `FR-006` / `FR-012`：D-4 事务序列逐条对应 §29.4 六步 |
| §37.2 | `Docs/V1技术设计.md` | `FR-015` / `FR-017`：跨家庭硬阻断；重试不重复产生业务结果 |
| §38 Phase 1 | `Docs/V1技术设计.md` | 本 Slice 只补 Case 控制面，不越入 Phase 2—6 |
| §39 V1-C01 行 | `Docs/V1技术设计.md` | 验收「并发创建/切换后最多一个 primary」→ D-3.4 + 并发测试 |
| Slice 2 冻结投影 | `specs/002-case-core/**` + `feat/002-case-core` 真实代码 | `cases.is_primary` / `version` / `case_events` / `CASE_CREATE` / Family 锁原语 / Case 管理主体 |

**Blocking rule**：任何无法追溯到上表的扩展必须标记 `NEEDS UPSTREAM DECISION` 且不得实现。**本 Plan 未使用该标记。**

Spec 映射：`FR-001`—`FR-020`（20 条）、Acceptance Scenarios 1—23、§19 Success Criteria 1—6、§3 Non-Goals 1—13。

---

## Summary

007 在 Slice 2 已冻结的 `cases` 容器上补一个**唯一的主线变更命令**：

1. 新增 `POST /api/v1/cases/:id/switch-primary`：把路径目标设为当前唯一 primary，把原 primary 降为非 primary。
2. 一个事务内完成：`Family 行锁 → 重读当前 primary 与目标 → 五类状态冲突判定 → 降级 → 升级 → 两侧事件 → 一条审计 → 幂等快照 → COMMIT`。
3. 复用 `authorize()` 的 Case 分支（新增一个 `CASE_SWITCH_PRIMARY` action），不建 `authorizeCase()`、不建 Case role / RBAC。
4. 复用 `idempotency_keys`（新增 `CASE_SWITCH_PRIMARY`），**复用 bytea 精确身份**，不建第二张幂等表。
5. **零 schema 扩张**：0 张新表、0 个新列、0 个新索引、0 个新 enum、0 条新 policy；只做 4 处 reviewed CHECK 替换 + 1 条列级 GRANT + 1 个新 migration 文件。
6. 只增控制面：`status` / `phase` / 计划 / 任务 / 提醒 / 通知 / 证据 / 安全记录全部不动。

---

## Technical Baseline

以 `Docs/V1技术设计.md` 为权威；本 Slice **不引入任何新依赖**。

**Runtime / Language**：Node.js `26.13.0`；TypeScript 5.9；ESM（继承 Slice 1 / 2）。
**Dependencies**：Fastify 5 + `fastify-type-provider-zod` 7 + Zod ≥ 4.2 + `pg`；Drizzle 仅作 schema 类型与事务设施；RLS / 索引 / 约束用显式 reviewed SQL。
**Storage / Migration**：PostgreSQL 18（原生 `uuidv7()`）；`db/migrations/*.sql` reviewed migration；migrator / runtime 双角色；禁止 `drizzle-kit push`。
**Testing**：Vitest；domain 纯函数 + DB 结构 / RLS + integration + 真实多连接并发。
**Deployment target**：Stage A local / CI（`docker-compose.stage-a.yml`）。

未批准依赖 / 框架 / 服务 / 架构变更 = BLOCKER。**本 Plan 无此类变更。**

---

## Constitution Check

*GATE: MUST PASS before implementation planning proceeds.*

- [x] **No new product semantics.** 全部行为可追溯至 V1-C01 / C21 / C24 / C25 / C27 / C28、§2.1、§5、§6.1、§6.2、§7.8、§7.9、§8.1、§8.5、§8.6、§9、§9.1、§23、§28.3、§29.4、§37.2、§38、§39。字段名 / 错误码 / 事件字面量属 Spec §22 A-1 / A-3 / A-4 明确授权的技术选择。
- [x] **No V2–V5 scope pulled into V1.** 无 Participant / Evidence / Formulation / Safety 实现 / Plan / Task / Schedule / Notification / AI / RAG / Memory / UI / 数据权利。
- [x] **No canonical A/010xx behavior reordered, merged, deleted, or renumbered.** 本 Slice 不触碰 Digital Use 节点与路由。
- [x] **Frozen stack and exclusions respected.** 无新依赖；无 pg-boss / pgvector / XState / 第二套框架；无 `drizzle-kit push`。
- [x] **Deterministic rules remain deterministic.** 主线判定、冲突分类、幂等、授权、RLS 全部是纯规则 + 数据库约束，无模型参与（`FR-009`）。
- [x] **Authorization / Consent / RLS / Safety / Compliance addressed.** `authorize()` 增量一个 action；`withRlsTransaction` 复用；ENABLE + FORCE RLS 不动；Safety 只消费 `status` 谓词（`FR-005` / `FR-014` 不实现任何安全对象）；Consent 不参与（§8 of Spec）。
- [x] **Provenance / version / history preserved.** 两侧 append-only 事件 + 一条审计；`version` 原子 `+1`；不覆盖、不删除、不压缩历史（`FR-012`、`FR-007`）。
- [x] **Failure / concurrency / idempotency designed.** D-8 固定失败表；D-3 并发收敛；D-7 幂等三态；无部分成功。
- [x] **Verification path exists for every acceptance item.** 见 `## Verification Plan` 的 FR 覆盖表与 Acceptance 覆盖表；每条都有测试文件 + 命令。

**Post-design re-check**：设计完成后重新核对上述 9 项，结论仍全部通过（`## Complexity Exceptions` 为空，`## Blockers` 为 NONE）。

---

## Design

### D-1 实现模型

#### 1.1 上下文视图

```text
[微信小程序 / 运营端（本 Slice 不实现 UI）]
        │ HTTPS + Bearer session token（Slice 1 auth）
        ▼
[Fastify API  apps/server/api]
        │  Case routes（既有 3 条 + 新增 1 条）
        ├──────────────► [packages/authorization]  authorize() 新增 CASE_SWITCH_PRIMARY
        ├──────────────► [packages/domain]         decideSwitchPrimary()（纯函数）
        │                                          + cases.ts repository（全部 SQL）
        └──────────────► [packages/contracts]      SwitchPrimaryCaseRequest / Response
        │
        ▼ withRlsTransaction（复用 Slice 2，不新建包装器）
[PostgreSQL 18]
  ├─ families（只读 creator + 行锁）
  ├─ cases（唯一新增写路径：is_primary / version / updated_at）
  ├─ case_events（新增 2 个事件类型，append-only）
  ├─ business_audit_events（新增 1 个事件类型）
  └─ idempotency_keys（新增 1 个 command_type）
```

- 上游：客户端只调用一个端点；当前 Family 由服务端从已验证 context 解析，客户端不得提交 `familyId`。
- 下游：无模型 / 无队列 / 无通知 / 无外部副作用。
- 中间件：仅 PostgreSQL；无缓存、无消息队列、无分布式锁。

#### 1.2 组件职责

| 组件 | 职责 | 明确不负责 |
|---|---|---|
| `apps/server/api/src/routes/cases.ts`（新增一个 `app.post`） | 认证、current family 解析、Schema 校验、调用 authorize、编排事务、错误映射 | 不写 SQL、不自行判 primary、不实现第二套幂等 |
| `packages/domain/src/case-primary-switch.ts`（新增，纯函数） | 冲突分类与顺序、陈旧视图比对、事件/审计 payload 组装 | 不读库、不写库、不决定锁 |
| `packages/domain/src/cases.ts`（增量） | 全部 `cases` / `case_events` / `business_audit_events` SQL | 不做业务判定、不吞 23505 |
| `packages/authorization/src/authorize.ts`（增量） | 新增 `CASE_SWITCH_PRIMARY` 的 fail-closed 判定 | 不读库、不判 Case 是否存在 |
| `packages/contracts/src/schemas.ts`（增量） | strict 请求 / 响应 Schema（代码侧单事实源） | 不承载业务规则 |
| `withRlsTransaction`（复用，不改） | identity + family 上下文、BEGIN / COMMIT / ROLLBACK | 不决定业务顺序 |

配置项：**无新增**。复用 `DATABASE_URL`（app 角色）、`MIGRATION_DATABASE_URL`（migrator 角色）、`SESSION_SECRET`。

#### 1.3 状态与流程（本 Slice 只改变一件事）

```text
                 ┌──────────────────────────────────────────┐
                 │ Family F                                 │
                 │   A: is_primary=true  ............┐      │
                 │   B: is_primary=false ────────────┼──┐   │
                 └───────────────────────────────────┼──┼───┘
                                                     │  │
             POST /cases/B/switch-primary  ──────────┘  │
                     │                                   │
                     ▼                                   │
                 ┌──────────────────────────────────────────┐
                 │   A: is_primary=false, version+1  ◄──────┘
                 │   B: is_primary=true,  version+1
                 │   A.status / A.phase  不变
                 │   B.status / B.phase  不变
                 └──────────────────────────────────────────┘
```

**无转换边、无状态机、无 phase 推进、无执行恢复。** 目标 Case 被设为 main 之后**仍然**是切换前的 `status` / `phase`（Spec §6.5.2、`FR-006`）。

---

### D-2 数据模型（**零扩张**）

#### 2.1 明确不做的事

```text
new business tables  = 0
new columns          = 0
new indexes          = 0
new enums            = 0
new RLS policies     = 0
```

`cases` 的列集合必须保持 Slice 2 冻结的 9 列（`tests/db/cases-schema.test.ts` 的 `CASES_COLUMNS` 全等断言是硬门禁）。**禁止新增** `switch_reason`、`previous_primary_id`、`primary_since`、`switched_at` 等把历史压到当前行的字段（Spec §17.1.5）。

#### 2.2 本 Slice 唯一写 `cases` 的三列

| 列 | 写法 | 约束 |
|---|---|---|
| `is_primary` | `= true`（目标） / `= false`（原 primary） | 唯一索引 `cases_one_primary_open_per_family` 继续兜底 |
| `version` | `= version + 1`（**SQL 内自增**，不做读-改-写） | `CHECK (version >= 1)` |
| `updated_at` | `= now()` | 与事务时间一致；`cases` 无 `updated_at` 触发器，必须显式写 |

**不得写**：`status`、`phase`、`family_id`、`created_by_person_id`、`id`、`created_at`。

#### 2.3 事件与审计（只扩词汇，不扩结构）

| 载体 | 增量 | 形状 |
|---|---|---|
| `case_events.event_type` | `+ CASE_PRIMARY_ASSIGNED`、`+ CASE_PRIMARY_REVOKED` | 白名单 CHECK 替换（见 D-9） |
| `case_events.metadata`（target 侧） | 新事件类型的形状 | `{ primary: true, version: <int>, previousPrimaryCaseId: <uuid\|null>, reason: <string> }` |
| `case_events.metadata`（old 侧） | 新事件类型的形状 | `{ primary: false, version: <int>, newPrimaryCaseId: <uuid>, reason: <string> }` |
| `business_audit_events.event_type` | `+ CASE_PRIMARY_SWITCHED` | 白名单 CHECK 替换 |
| `business_audit_events.metadata` | 无结构约束（`jsonb NOT NULL DEFAULT '{}'`） | `{ targetCaseId, previousPrimaryCaseId, newPrimaryCaseId, previousVersion, newVersion, reason }` |

**为什么 reason 存在事件里而不是 `cases` 行上**：Spec §10.5「理由必须随历史保留，不得只在当前状态上保留最后一次理由」；`cases` 只保留当前 assignment，历史必须落在 append-only 载体（Spec §17.1.5 明令禁止 `switch_reason` 列）。

**为什么两侧各写一条 `case_events`**：Spec §6.4.1 / §6.4.2 明确要求「原 primary 追加失去主线事件、目标追回成为主线事件」；单条 Family 级事件无法按 Case 重建单 Case 时间线（Spec §17.2「必须能按 Case 与按 Family 重建」）。

**为什么还写一条 `business_audit_events`**：Spec §6.4.3 + §7.9 要求跨资源统一审计；`business_audit_events` 是唯一审计载体（不得建第二套）。

---

### D-3 并发方案（本 Slice 最关键的技术内容）

#### 3.1 目标

> 同一 Family 在任意时刻最多一个 `is_primary = true AND status <> 'CLOSED'` 的 Case，且在 `SwitchPrimaryCase` 与 `CreateCase` 的所有交错下都成立。

#### 3.2 四层机制与各自职责（缺一不可，且**不许**互相替代）

| 层 | 机制 | 具体形状 | 唯一负责的事 | 明确不负责 |
|---|---|---|---|---|
| **L1 应用串行化** | Family 行锁 | `SELECT id FROM families WHERE id = $1 FOR UPDATE`（复用 Slice 2 的 `lockFamilyForPrimaryDecision`，不新写第二个锁函数） | 把**同一 Family 的所有 primary 变更命令**（`CASE_CREATE` 与 `CASE_SWITCH_PRIMARY`）排成全序 | 不保证单条 `UPDATE` 的原子性（那是 SQL 本身） |
| **L2 重读判定** | 锁后**独立语句**重读 | `getCurrentPrimaryForUpdate()`：`SELECT ... FROM cases WHERE family_id=$1 AND is_primary AND status<>'CLOSED' FOR UPDATE` | 在拿到 L1 后的**新快照**上重新决定「谁是当前 primary」与「版本是多少」 | 不替代 L3（仍可能被绕过路径写入） |
| **L3 数据库不变量** | partial unique index | `cases_one_primary_open_per_family ON cases (family_id) WHERE is_primary AND status <> 'CLOSED'`（**已存在，不重建**） | 拒绝任何绕过 L1 / L2 的第二条 primary 写入 | 不决定「该不该切换」，也不产生业务语义 |
| **L4 乐观并发** | 客户端视图 + 版本比对 | `expectedPrimaryCaseId` + `expectedPrimaryVersion` 与服务端 L2 结果比对 | 拒绝基于陈旧视图的覆盖写（Spec §8.6） | 不替代 L1；两个都基于同一有效视图的并发请求仍由 L1 定序 |

#### 3.3 锁顺序（所有 Case 写路径统一，**不得出现反向顺序**）

```text
① idempotency 占位    INSERT ... ON CONFLICT DO NOTHING RETURNING id        （行锁：唯一索引）
② families 行锁       SELECT id FROM families WHERE id=$1 FOR UPDATE         （强锁）
③ cases 行锁          SELECT ... FROM cases WHERE id = ANY($ids) ORDER BY id FOR UPDATE
④ 业务 UPDATE / INSERT
⑤ idempotency 回填
⑥ COMMIT
```

- ②③ 的顺序**必须**与 Slice 2 的 `CASE_CREATE` 一致（先 Family，后 Case）；`CASE_CREATE` 只取 ②（不读既有 Case 行），因此不存在 ③→② 的可能。
- ③ 内部对多个 Case 按 `id ASC` 排序加锁，避免两个未来命令以不同顺序锁同一对 Case 造成环路。
- **唯一允许的强锁对象是 `families` 行与 `cases` 行**；不使用 advisory lock（Slice 2 的 `lockIdempotencyKey` advisory 函数属 Slice 1 legacy 路径，本 Slice **不调用**它）。
- 由于 ② 已经把同 Family 的所有写者排成全序，③ 在实践中不会被第二个切换事务争用；保留排序是为了让未来「关闭 + 切换」「暂停 + 切换」等新命令继承同一顺序。

#### 3.4 死锁分析（必须写清，不能只说「数据库会处理」）

| 潜在环路 | 是否存在 | 理由 |
|---|---|---|
| switch(F) → switch(F) | 否 | ② 把同 Family 串成单列；后来的事务在 ② 排队，未持任何 Case 锁 |
| switch(F) → create(F) | 否 | create 只取 ②，不取 ③；两者在 ② 上串行 |
| switch(F1) → switch(F2) | 否 | 不同 Family 不共享 `families` 行，也不共享 `cases` 行（复合 FK 保证 Case 只属一个 Family） |
| ③ 内部两行互为反向 | 否 | 固定 `ORDER BY id ASC`，全库同一顺序 |
| idempotency（①）与业务锁（②③） | 否 | ① 只锁 `idempotency_keys` 的索引项；没有任何路径先取 ②③ 再取 ① |

**结论**：锁图是「按 Family 分区的偏序 + 分区内全序」，不存在环。

#### 3.5 唯一索引冲突的处置（不得当正常分支）

- 正常情况下 L1 / L2 保证不会出现第二条 primary，因此 `23505` on `cases_one_primary_open_per_family` **永不**是正常业务分支。
- 出现即代表不变量被绕过（代码缺陷或外部写入）：**事务整体回滚 → 500 `INTERNAL_ERROR`**。
- 路由层**不得**捕获 `23505` 并映射成 409 / 200（Spec §9.2.5、`FR-015`）。
- 测试必须证明：并发切换 / 创建后 `count(*) WHERE is_primary AND status<>'CLOSED' <= 1`，且**没有**任何一次 500。

#### 3.6 隔离级别与重试

- 使用 Slice 1 / 2 的默认 **READ COMMITTED**；不升 SERIALIZABLE（会引入不必要的可重试失败）。
- 应用**不做自动重试**（不在应用层放大事务）。
- 锁等待超时 / 死锁 → 回滚 → 500 真实失败；客户端可凭同一幂等键安全重试。
- 同 key 的并发重试由 ①（唯一索引占位）串行化，不依赖进程内缓存。

---

### D-4 `SwitchPrimaryCase` 事务序列（唯一确定）

> 与 `Docs/V1技术设计.md` §29.4 六步逐条对应；`§29.4` 第 7 条「旧主线未来普通 Schedule 取消 / 同事务 enqueue job」在当前**无 Schedule / 无 pg-boss**，按 Spec `FR-019` 冻结为前向义务，不在本事务内出现（见 §13.7 与 D-13）。

```text
 0. 认证      Bearer → actor {accountId, personId}；缺失 → 401 UNAUTHENTICATED
 1. Family    withIdentityTransaction → requireCurrentFamily()
              NONE → 404 CURRENT_FAMILY_NOT_FOUND
              AMBIGUOUS → 409 CURRENT_FAMILY_AMBIGUOUS
 2. 开事务    withRlsTransaction({familyId, accountId, personId, purpose:'FAMILY_MANAGEMENT'})
 3. 读 creator getFamilyById() → families.created_by_person_id（RLS 已限定）
 4. 授权      authorize({actor, product:'V1',
                family:{familyId, createdByPersonId}, case:{caseId},
                resource:'CASE', action:'CASE_SWITCH_PRIMARY',
                purpose:'FAMILY_MANAGEMENT'})
              DENY → 404 CASE_NOT_FOUND（统一，不泄露；见 D-10.4）
 ── 幂等（先于任何状态判定，理由见 D-7.5）────────────────────
 5. lookup    getReservedIdempotency(tx, {actorAccountId, 'CASE_SWITCH_PRIMARY', keyBytes, legacyKeyText})
              ├ 命中 + hash 相同 → REPLAY：COMMIT，返回已存 200 body（零写入）
              └ 命中 + hash 不同 → MISMATCH：COMMIT（零写入），外层 409 IDEMPOTENCY_PAYLOAD_MISMATCH
 6. reserve   reserveIdempotency(tx, {... requestHash})  （占位 response_status=0, body '{}'）
              └ 未插入（并发同 key）→ 重新 lookup → REPLAY / MISMATCH
 ── 状态前置（§29.4 第 1—6 步 + Spec §6.3 第 3—8 条）─────────
 7. 锁 Family lockFamilyForPrimaryDecision(tx, familyId)              ← §29.4-1
 8. 重读 cur  getCurrentPrimaryForUpdate(tx, familyId)                ← §29.4-2
              >1 行 → 不变量破坏 → 抛 INTERNAL_ERROR（整体回滚）
 9. 重读 tgt  getCaseForUpdate(tx, caseId)                            ← §29.4-2
              0 行（不存在 / 跨 Family / RLS 隐藏）→ 404 CASE_NOT_FOUND
10. CLOSED    tgt.status = 'CLOSED'        → 409 CASE_CLOSED            ← §29.4-4
11. 目标安全  tgt.status = 'SAFETY_HOLD'   → 409 SAFETY_HOLD_BLOCKED    ← Spec §6.3-5
12. 当前安全  cur?.status = 'SAFETY_HOLD'  → 409 SAFETY_HOLD_BLOCKED    ← §29.4-3
13. 已是主线  tgt.id = cur?.id            → 409 CASE_ALREADY_PRIMARY    ← Spec §6.3-7
14. 陈旧视图  decideStale(cur, expected*)  → 409 STALE_PRIMARY_VIEW     ← Spec §6.3-8 / §8.6
15. 理由      reason trim 非空且 ≤500      → 422 VALIDATION_ERROR        ← Spec §6.3-9
 ── 写入（§29.4「同一事务保证最多一个 primary」）──────────────
16. 降级      UPDATE cases SET is_primary=false, version=version+1,
                          updated_at=now()
              WHERE id = cur.id RETURNING ...                          ← 必须先于 17
17. 升级      UPDATE cases SET is_primary=true,  version=version+1,
                          updated_at=now()
              WHERE id = tgt.id RETURNING ...
18. 事件 old  INSERT case_events (CASE_PRIMARY_REVOKED, {primary:false, version, newPrimaryCaseId, reason})
19. 事件 tgt  INSERT case_events (CASE_PRIMARY_ASSIGNED, {primary:true, version, previousPrimaryCaseId, reason})
20. 审计      INSERT business_audit_events (CASE_PRIMARY_SWITCHED, 'CASE', targetId, metadata)
21. 回填      UPDATE idempotency_keys SET response_status=200, response_body=<完整响应>
22. COMMIT
23. 200 + body
```

**四个不可协商的细节**：

1. **必须先降级（16）再升级（17）**。反过来会在同一语句序列内出现两条未结 primary，触发非延迟的 partial unique index → `23505` → 整个命令恒失败。降级后的「零 primary 中间态」对其他事务不可见（未提交），且唯一索引允许 0 条。
2. **每个 `UPDATE ... RETURNING` 必须断言恰好 1 行**。返回 0 行说明该行在本 Family 的 RLS 上下文中不可见（越权 / 上下文错误 / 行已变），必须抛 `INTERNAL_ERROR` 回滚，**不得**当作「无需更新」继续（否则会写出半个切换）。
3. **`version` 必须在 SQL 内自增**，不得先 `SELECT version` 再 `SET version = $n`（会丢失并发写）。
4. **升序（16→17）不是「先升后降」的等价重排**；Implementation 不得为「读起来更自然」调换。

---

### D-5 状态冲突判定（纯函数，可穷举单测）

`decideSwitchPrimary(input): SwitchDecision`（`packages/domain/src/case-primary-switch.ts`，无 I/O）

```ts
type SwitchDecision =
  | { kind: 'DENY'; code: 'CASE_CLOSED' | 'SAFETY_HOLD_BLOCKED'
                     | 'CASE_ALREADY_PRIMARY' | 'STALE_PRIMARY_VIEW' }
  | { kind: 'ALLOW'; demote: null | { caseId: string; expectedVersion: number };
                     promote: { caseId: string } };
```

判定顺序（与 D-4 第 10—15 步逐一对应，**不得重排**）：

| # | 条件 | 结果 |
|---|---|---|
| 1 | `target.status === 'CLOSED'` | `DENY CASE_CLOSED` |
| 2 | `target.status === 'SAFETY_HOLD'` | `DENY SAFETY_HOLD_BLOCKED` |
| 3 | `current?.status === 'SAFETY_HOLD'` | `DENY SAFETY_HOLD_BLOCKED` |
| 4 | `current?.caseId === target.caseId` | `DENY CASE_ALREADY_PRIMARY` |
| 5 | 视图比对失败（见 D-6.3） | `DENY STALE_PRIMARY_VIEW` |
| 6 | 其余 | `ALLOW`（`demote = current ?? null`） |

**为什么顺序固定**：`CLOSED` 是终态，必须优先于 `SAFETY_HOLD`（Spec §6.3 第 4 条先于第 5 条）；「已是 primary」必须先于「陈旧视图」，否则一个重复点击会被误报成 `STALE_PRIMARY_VIEW`，掩盖真实的终态无操作冲突（Spec Q1）。

**为什么是纯函数**：Spec Q3a 要求 `SAFETY_HOLD` / `CLOSED` 谓词「用单元测试覆盖全部状态值」，且**不得**通过直接 `UPDATE status` 制造测试前置。6 个 status 值 × 视图 4 态 = 24 组合，全部可在 domain 层穷举，不需要伪造数据库状态。

---

### D-6 陈旧视图 / 乐观并发（`FR-011`）

#### 6.1 触发条件与表达方式（Spec §22 A-3 的技术选择）

请求体**必须**携带两条视图字段，二者对客户端都是必填（可显式 `null`）：

```json
{
  "idempotencyKey": "…",
  "reason": "…",
  "expectedPrimaryCaseId": "<uuid> | null",
  "expectedPrimaryVersion": 3 | null
}
```

- `expectedPrimaryCaseId = null` **且** `expectedPrimaryVersion = null`：客户端声明「我以为这个 Family 现在没有未结 primary」（晋升分支）。
- 两者都非 null：客户端声明「我以为当前 primary 是这个 Case、版本是 N」。

**为什么两者都要，而不是只给 `expectedPrimaryCaseId`**：只给 Case id 无法识别 `A → B → A` 的往返切换（客户端视图 A 与当前 A 相同，但 `version` 已前进两版）；这正是 §8.6「旧版本请求不能覆盖新状态」要拦的情形。Spec §6.3 第 8 条允许「期望的当前 primary **或**期望版本」，本 Plan 选择两者兼有，属**加强**而非放宽。

#### 6.2 Schema 级联约束（strict，`422`）

| 组合 | 结果 |
|---|---|
| 键缺失（undefined） | `422 VALIDATION_ERROR`（不得退化为「无条件覆盖」） |
| `expectedPrimaryCaseId=null` 且 `expectedPrimaryVersion=null` | 合法（晋升视图） |
| `expectedPrimaryCaseId=<uuid>` 且 `expectedPrimaryVersion=<int ≥ 1>` | 合法 |
| 一个 null 一个非 null | `422 VALIDATION_ERROR`（视图自相矛盾） |

zod 用 `superRefine` 表达这条跨字段不变量；`additionalProperties`（`strictObject`）= false，任何未声明字段（`isPrimary`、`primary`、`version`、`status`、`phase`、`familyId` 等）→ `422` 零写入（Acceptance 14）。

#### 6.3 比对规则（在 L2 重读之后执行）

设 `cur` = 锁定后的当前未结 primary（可能为 `null`）：

| `cur` | 客户端视图 | 结果 |
|---|---|---|
| `null` | `{null, null}` | 通过（晋升） |
| `null` | 非空视图 | `STALE_PRIMARY_VIEW` |
| 非 null | `{null, null}` | `STALE_PRIMARY_VIEW` |
| 非 null | id 不同 | `STALE_PRIMARY_VIEW` |
| 非 null | id 相同、version 不同 | `STALE_PRIMARY_VIEW` |
| 非 null | id 相同、version 相同 | 通过 |

**禁止**：把版本比较做成「大于等于即可」；禁止在版本缺失时跳过比较；禁止用「最后写入者获胜」替代。

---

### D-7 幂等（`CASE_SWITCH_PRIMARY`）

#### 7.1 复用既有基础设施（不建第二张表）

- 复用 `idempotency_keys`（Slice 1 表 + Slice 2 的 `idempotency_key_bytes` 精确身份扩展）。
- 命令类型白名单新增 `CASE_SWITCH_PRIMARY`（reviewed migration）。
- 运行时白名单 `packages/domain/src/idempotency.ts › IDEMPOTENCY_COMMAND_TYPES` 同步新增（并有注册一致性测试）。

#### 7.2 Transport

`idempotencyKey` 为 **JSON body 必填字段**（8—128 字符），与 `CASE_CREATE` 及 Slice 1 的既有 transport 完全一致；不新增 header 机制（Slice 2 冻结 R1 的延续，不得出现两套 transport）。

#### 7.3 Canonical payload hash

```text
request_hash = sha256(canonicalJson({
  familyId:  <服务端已验证的当前 Family>,        // 防止同 key 跨 Family 回放
  targetCaseId: <路径参数 :id>,                  // 必需：不写进 hash 会让「同 key 换目标」变成 REPLAY
  body: { reason, expectedPrimaryCaseId, expectedPrimaryVersion }   // 去掉 idempotencyKey
}))
```

- `canonicalJson` / `hashPayload` 复用 `packages/domain/src/idempotency.ts`。
- `targetCaseId` **必须**进 hash：Spec §9.1(3) 明确「同 key 指向另一个目标 Case → 409 mismatch」，而该分支在本命令上**可达**（与 `CASE_CREATE` 不同）。
- `reason` **必须**进 hash：它改变事件与审计内容，属「会改变业务结果的输入」（Spec §9.1(4)）。
- `actor` / `command_type` 不重复进 hash：logical scope 已是 `(actor_account_id, command_type, logical key)`（沿用 Slice 2 D-5.2 的理由，实现注释必须写明）。

#### 7.4 三态行为

| 情形 | 行为 | 写入 |
|---|---|---|
| 同 key + 同 hash | 返回已存 `200` body；不降级、不升级、不追加事件/审计、不递增版本 | 0 |
| 同 key + 不同 hash | `409 IDEMPOTENCY_PAYLOAD_MISMATCH`；原结果不变 | 0 |
| 同 key 并发 | 唯一索引占位串行化：恰好一个执行；其余在占位释放后走 REPLAY | 1 个业务结果 |
| 首次执行但业务失败（409 / 422 / 500） | 事务回滚 → 占位消失 → 无幂等快照（Spec §11「失败零写入」） | 0 |

**为什么失败必须回滚占位**：若留下 `response_status=0` 的行，后续同 key 请求会命中「占位」状态，既不能重放也不能重执行，形成永久毒化。Slice 2 已用「同事务回填 + 失败回滚」解决，本 Slice 沿用同模式（`completeIdempotency` 在同一事务内 UPDATE）。

#### 7.5 为什么幂等 lookup 必须早于状态判定（**显式排序决定**）

Spec §6.3 的编号把幂等放在第 10 条（最后），但其自身注解只规定三条硬约束：授权先于重放、Family 先于 Case、安全谓词先于写入。若严格按编号把幂等放在状态判定之后，会产生一个与 Spec §9.1(2) 直接冲突的可观测结果：

> 一次已提交的成功切换，在 `target` 已成为 primary 之后再重放同 key 同 payload，
> 会在「已是 primary」这一步被拒绝成 `409 CASE_ALREADY_PRIMARY`，而不是返回原结果。

Spec §9.1(2) 与 Acceptance 16 明确要求重放返回原结果。因此本 Plan **冻结**以下优先级（记为 **R-2**）：

```text
授权  >  幂等识别（REPLAY / MISMATCH）  >  状态前置（CLOSED / SAFETY / ALREADY / STALE / reason）
```

并显式承认两个可观测后果：

1. 重放在**任何**状态下都返回原结果（满足 Acceptance 16）；
2. 同 key 不同 payload 的 mismatch 会在状态判定之前返回 `409`，即使新目标不可见——该组合不被任何 Acceptance Scenario 固定，且 mismatch 分支本身零状态读取、零写入，不属于「用 409 掩盖 404」。

**这不是修改产品语义**：重放与 mismatch 都是「不产生业务结果」的分支，它们不读也不写 Case 状态，因此状态前置条件对其不适用。

---

### D-8 失败语义（与 Spec §11 逐条一致）

| 类别 | 触发点（D-4 步骤） | HTTP | 业务写入 | 幂等快照 |
|---|---|---|---|---|
| `UNAUTHENTICATED` | 0 | `401` | 无 | 无 |
| `CURRENT_FAMILY_NOT_FOUND` | 1 | `404` | 无 | 无 |
| `CURRENT_FAMILY_AMBIGUOUS` | 1 | `409` | 无 | 无 |
| `CASE_NOT_FOUND` | 4（DENY）/ 9（0 行） | `404` | 无 | 无 |
| `VALIDATION_ERROR` | Schema / 15 | `422` | 无 | 无（回滚占位） |
| `CASE_ALREADY_PRIMARY` | 13 | `409` | 无 | 无 |
| `CASE_CLOSED` | 10 | `409` | 无 | 无 |
| `SAFETY_HOLD_BLOCKED` | 11 / 12 | `409` | 无 | 无 |
| `STALE_PRIMARY_VIEW` | 14 | `409` | 无 | 无 |
| `IDEMPOTENCY_PAYLOAD_MISMATCH` | 5 / 6 | `409` | 无，原结果不变 | 原快照不变 |
| `INTERNAL_ERROR` | 不可达的 `23505` / 0 行 UPDATE / 未知 | `500` | 必须整体回滚 | 无 |

**补充规则（必须由测试证明）**

- 重放 ≠ 失败：同 key 同 payload 的重放返回 `200` 原结果，不得返回 409。
- 不得伪造成功：冲突 / 无权 / 终态一律返回真实失败，不得返回 `200` + 未变更状态。
- 不得成功但无证据：不存在「主线已变但历史缺失」或「历史已写但主线未变」的持久态。
- `500` 响应体固定为 `{ code: 'INTERNAL_ERROR', message: 'An internal error occurred' }`（复用既有 `errorHandler`），不泄露 SQLSTATE / 查询 / 参数。

---

### D-9 Migration 策略（单文件、reviewed、可回滚）

#### 9.1 文件与位置

```text
db/migrations/004_case_primary_switch.sql     ← 编号在 Implement 时以 `ls db/migrations` 实测为准
```

- **编号必须在 Slice 2 合并之后才确定**。在 007 分支当前状态（Slice 2 未合并）下，`db/migrations/` 只有 `001_initial_schema.sql`；若此刻按「最大编号 + 1」取名会得到 `002_*`，与 Slice 2 的 `002_case_core.sql` **冲突**。正确的编号是在 G2/G3 通过、`origin/main` 已含 `001` / `002` / `003` 之后再取 `003 + 1 = 004`。
- 若 Slice 2 合并时的编号不是 `001`—`003`，以真实最大序号 + 1 命名（G7）。
- **不修改** `001_initial_schema.sql`、`002_case_core.sql`、`003_case_idempotency_key_bytes.sql`。
- 禁止 `drizzle-kit push`；迁移由 `xiaoshuyin_migrator` 在一个事务内执行（`db-migrate.mjs` 已保证）。

#### 9.2 变更清单（5 处，全部为「替换 / 授权」，无新增结构）

| # | 对象 | 操作 | 目标定义 |
|---|---|---|---|
| 1 | `case_events_event_type_check` | `DROP` + `ADD` | `event_type IN ('CASE_CREATED','CASE_PRIMARY_ASSIGNED','CASE_PRIMARY_REVOKED')` |
| 2 | `case_events_metadata_shape_check` | `DROP` + `ADD` | 按 `event_type` 分支的**逐类型收窄**（见 9.3） |
| 3 | `business_audit_events_event_type_check` | `DROP` + `ADD` | 原 7 值 + `CASE_PRIMARY_SWITCHED` |
| 4 | `idempotency_keys_command_type_check` | `DROP` + `ADD` | 原 7 值 + `CASE_SWITCH_PRIMARY` |
| 5 | `idempotency_keys_key_representation_check` | `DROP` + `ADD` | `CASE_CREATE` **与** `CASE_SWITCH_PRIMARY` 都允许 bytea-only 表示（见 9.4） |
| 6 | `cases` 授权 | `GRANT UPDATE (is_primary, version, updated_at) ON cases TO xiaoshuyin_app` | **列级**，不是表级（见 9.5） |

> 输入顺序：1→2→3→4→5→6；全部在单事务内。约束名以 G5 现场 `pg_constraint` 实测为准；若名称不同，先记录真实名再改文件（不得假设默认名）。

#### 9.3 `case_events_metadata_shape_check` 的逐类型收窄（不得放宽为任意 jsonb）

```text
CHECK (
  (event_type = 'CASE_CREATED' AND
     jsonb_typeof(metadata)='object'
     AND metadata ? 'primary' AND metadata ? 'version'
     AND metadata - 'primary' - 'version' = '{}'::jsonb
     AND jsonb_typeof(metadata->'primary')='boolean'
     AND <version 为整数且 >= 1>)

  OR (event_type = 'CASE_PRIMARY_ASSIGNED' AND
     jsonb_typeof(metadata)='object'
     AND metadata ? 'primary' AND metadata ? 'version'
     AND metadata ? 'previousPrimaryCaseId' AND metadata ? 'reason'
     AND metadata - 'primary' - 'version' - 'previousPrimaryCaseId' - 'reason' = '{}'::jsonb
     AND metadata->'primary' = 'true'::jsonb
     AND <version 为整数且 >= 1>
     AND (jsonb_typeof(metadata->'previousPrimaryCaseId')='null'
          OR jsonb_typeof(metadata->'previousPrimaryCaseId')='string')
     AND jsonb_typeof(metadata->'reason')='string'
     AND btrim(metadata->>'reason') <> ''
     AND length(metadata->>'reason') <= 500)

  OR (event_type = 'CASE_PRIMARY_REVOKED' AND
     … 同上，primary = false，键集合为 {primary, version, newPrimaryCaseId, reason} …)
)
```

**为什么必须逐类型分支**：`CASE_CREATED` 的「额外 key 一律拒绝」性质（Slice 2 CHK068）必须**原样保留**；如果把约束放宽成 `jsonb_typeof(metadata)='object'`，等于把「不得写入标题 / 正文 / PII」的可执行不变量降级为约定。

**reason 长度上限的一致性**：API 层 `max(500)` 计 UTF-16 code unit，DB 层 `length()` 计字符；对任何输入 API 上限都 ≤ DB 上限（代理对情况下字符数更少），因此 API 通过的值不会被 DB 拒绝。这是有意的方向选择，必须写进实现注释。

#### 9.4 `idempotency_keys_key_representation_check` 必须同步扩展（易漏点）

当前定义（`003`）：

```text
(command_type <> 'CASE_CREATE' AND idempotency_key IS NOT NULL AND idempotency_key_bytes IS NULL)
OR (command_type = 'CASE_CREATE' AND (恰有其一 NOT NULL))
```

若只把 `CASE_SWITCH_PRIMARY` 加入 `command_type` 白名单而**不动**这条 CHECK，则新命令会被强制走 `text` 列，含 `U+0000` / lone surrogate 的合法 key 将无法写入，且与 `CASE_CREATE` 的精确身份保证不一致。因此必须改为：

```text
(command_type NOT IN ('CASE_CREATE','CASE_SWITCH_PRIMARY') AND text NOT NULL AND bytes IS NULL)
OR (command_type IN ('CASE_CREATE','CASE_SWITCH_PRIMARY') AND (恰有其一 NOT NULL))
```

唯一性继续由两条唯一约束覆盖：`idempotency_scope_key`（text）与 `idempotency_scope_key_bytes`（bytea）；**不新增第三个索引**。

#### 9.5 `cases` 的 UPDATE 授权必须是列级（否则破坏 Slice 2 的 append-only 语义）

- 表级 `GRANT UPDATE ON cases` 会使 `has_table_privilege(...,'UPDATE')=true`，直接违反 Slice 2 的冻结断言「app 对 `cases` 只有 SELECT / INSERT」，并把 `status` / `phase` / `family_id` 一并暴露为可写。
- 因此只授予 `UPDATE (is_primary, version, updated_at)`。
- Implementation 必须**实测** `has_table_privilege` / `has_column_privilege` 的真实返回值并归档；若 PostgreSQL 对列级授权在 `has_table_privilege` 上也返回 `true`，则测试改为以 `has_column_privilege` 为准并记录实测差异——**不得**为了通过断言而升级为表级授权。

#### 9.6 RLS

- `cases` 现有 policy `cases_family_scope` 已含 `USING` + `WITH CHECK`，`UPDATE` 自动受其约束；**不新增 policy**。
- 错误 Family 上下文下 `UPDATE ... RETURNING` 返回 0 行 → D-4 细节 2 抛 `INTERNAL_ERROR`（不静默成功）。
- `case_events` 仍只有 `SELECT, INSERT`：本 Slice 不授予 `UPDATE` / `DELETE`（append-only 保持）。

#### 9.7 回滚

| 项 | 说明 |
|---|---|
| 前置判定 | 回滚前必须确认是否已产生 `CASE_PRIMARY_ASSIGNED` / `CASE_PRIMARY_REVOKED` / `CASE_SWITCH_PRIMARY` 行；存在则**不得**直接还原 CHECK（会 `23514` 失败） |
| 无新格式数据时 | 逆序：撤销列级 GRANT → 还原 5 个 CHECK → 完成。无表 / 列 / 索引需要删除 |
| 已产生数据时 | 必须另立 reviewed data disposition：这些事件与幂等行是否保留、是否导出、是否保持 004 在线；**不得**以「本 Slice 无 backfill」为由声称回滚无数据影响 |
| 执行方式 | 只允许人工 reviewed 步骤，不在 runtime 自动执行 |

#### 9.8 前向影响

- 无数据回填，无跨表复制。
- 迁移幂等：`db-migrate.mjs` 以 `schema_migrations` 记录跳过已应用文件；`tests/db/migration-repro.test.ts` 的第二次 apply no-op 断言必须继续成立。
- 迁移**不改变**任何表 / 列 / 索引计数 → `migration-repro.test.ts` 的 `EXPECTED_TABLE_NAMES` / `EXPECTED_POLICIES` 保持原值（这是「零 schema 扩张」的机器证据）。

---

### D-10 Authorization（`FR-003` / `FR-013`）

#### 10.1 唯一执行主体

当前目标 Family 的 V1 管理主体 = `families.created_by_person_id` 对应的 ADULT Person（Slice 1 冻结）。判定复用 `authorize()` 的 Case 分支与调用方已读取的 `createdByPersonId`；本 Slice **不新增** Case role / RBAC / Visibility Matrix / 「管理员」抽象。

#### 10.2 `authorize()` 的增量（最小）

| 维度 | 增量 |
|---|---|
| `Action` | `+ 'CASE_SWITCH_PRIMARY'` |
| `REGISTERED_ACTIONS` | 同步加入（否则 `UNSUPPORTED_ACTION`） |
| `CASE_ACTIONS` | 同步加入（走 `decideCaseAction()`） |
| 判定规则 | 复用既有 5 条：`family=null → FAMILY_CONTEXT_REQUIRED`；`purpose≠FAMILY_MANAGEMENT → UNSUPPORTED_PURPOSE`；`createdByPersonId` 缺失或 ≠ actor → `NOT_FAMILY_MANAGER`；**必须**带 `case` 维度（与 `CASE_READ` 同组，缺失 → `CASE_CONTEXT_REQUIRED`） |
| 明确不做 | 不新建 `authorizeCase()`；不新增 Purpose；不把 `primary` 写进授权输入 |

#### 10.3 为什么授权判定不读 Case 归属

`authorize()` 是纯函数。`caseId` 是否属于当前 Family 由两层保证：`withRlsTransaction` 设置 `app.family_id` + `cases_family_scope` RLS。`case_id` 只是待验证参数（§9）。

#### 10.4 对外错误映射（anti-enumeration）

| 情形 | 响应 |
|---|---|
| 非管理主体（Family 已解析） | `404 {"code":"CASE_NOT_FOUND","message":"Case not found"}` |
| 目标不存在 / 属于其他 Family | 同上，**响应体逐字节一致** |
| 路径 id 不是合法 UUID | 同上（不返回 422，与 Slice 2 的 case-id 口径一致） |
| 目标存在但 `status=CLOSED` / `SAFETY_HOLD` | `409`（此时 actor 已确认是管理主体，不构成枚举泄露） |
| Actor 不是目标 Family 成员（含仅 guardian 关系） | Family 上下文未合法成立 → 沿用 Slice 1 `CURRENT_FAMILY_NOT_FOUND` / `CURRENT_FAMILY_AMBIGUOUS`，**不得**转换为 `CASE_NOT_FOUND` |

**为什么 DENY 统一 404 而不是 403**：本端点是 case-scoped（路径含 `:id`），Spec §7.4 与 Q7 已冻结 404；Slice 2 的 403 `CASE_ACCESS_DENIED` 只用于 Family 级集合 / 创建端点。

---

### D-11 Safety（只消费状态谓词，不实现任何 Safety 能力）

- 读取 `cases.status` 的现有枚举值 `SAFETY_HOLD`，作为切换守卫的双向阻断条件（`FR-005`）。
- **不创建**：`safety_states`、`risk_events`、Safety service、Safety 状态机、支持资源、风险词检测、`EnterSafetyHold` / `ResolveRisk`。
- **不可绕过**：不得通过「先切走再处理」把 `SAFETY_HOLD` 的 Case 变成非主线来规避安全状态（产品 §2.1 第 6 条）。
- 谓词写成对 `status` 的确定性判定，绝不写常量：`status === 'SAFETY_HOLD'`，由 domain 单测穷举。
- 前向义务：Safety Slice 落地时本谓词自动生效；Safety Slice **不得**重写第二套主线切换守卫（Spec §13.8）。

---

### D-12 API 契约

#### 12.1 `POST /api/v1/cases/:id/switch-primary`

- 认证：Bearer（`onRequest: app.authenticate`，先于 Schema 校验，保持 401 先于 422）。
- 路径参数 `:id` = **目标** Case。Schema 文档标注 `format: uuid`，但**不用它做校验门**（非法 id 必须收敛到 `404 CASE_NOT_FOUND`）。
- 请求体（`strictObject`，`additionalProperties=false`）：

```json
{
  "idempotencyKey": "string(8..128)",
  "reason": "string(1..500)",
  "expectedPrimaryCaseId": "uuid | null",
  "expectedPrimaryVersion": "integer(>=1) | null"
}
```

- 成功：`200` + `SwitchPrimaryCaseResponse`
- 错误：`401`、`404 CASE_NOT_FOUND` / `CURRENT_FAMILY_NOT_FOUND`、`409 CASE_ALREADY_PRIMARY` / `CASE_CLOSED` / `SAFETY_HOLD_BLOCKED` / `STALE_PRIMARY_VIEW` / `IDEMPOTENCY_PAYLOAD_MISMATCH` / `CURRENT_FAMILY_AMBIGUOUS`、`422 VALIDATION_ERROR`、`500 INTERNAL_ERROR`

#### 12.2 响应 schema（A-1 的技术选择）

```json
{
  "primary": { "id": "...", "status": "OPEN", "phase": "INTAKE",
               "primary": true, "version": 4,
               "createdAt": "...", "updatedAt": "..." },
  "previousPrimary": { "…": "同上结构，或 null（晋升分支）" },
  "switchedAt": "2026-11-07T06:43:01.000Z"
}
```

- `primary` 是**新** primary（即路径目标）切换后的完整 `CaseResponse`；`previousPrimary` 是被降级的原 primary（无则 `null`）。
- **为什么返回两侧**：Spec §18.1.1 要求「返回结果真实反映 B 为当前主线」；同时返回降级结果让原子交换可被客户端与测试同时观测，避免「只有一个对象变了」的误判。
- **为什么不返回 `reason`**：理由由客户端提供，已在事件与审计中持久化；把它放进响应会让用户文本进入 `idempotency_keys.response_body` 与可能的日志面，属无收益的扩张。
- **为什么是 `200` 而非 `201`**：本命令不创建新资源，只改变既有资源的归属标记。
- `SwitchPrimaryCaseResponse` 是**新** schema，**不修改** `CaseResponse` / `CaseListResponse`（Slice 2 冻结的 7 字段断言必须继续成立）。

#### 12.3 明确不新增的路由

`/cases/current`、`/cases/:id/primary`、`/cases/:id/pause`、`/resume`、`/close`、`/recurrences`、`/messages`、`/assessments`、`/participants`、`/scene/**`、`/problem-formulations/**`、`/evidence/**`、任何批量切换、任何第二真相源端点（`FR-002` / `FR-014`）。

#### 12.4 OpenAPI 与生成物

- `packages/contracts/src/schemas.ts` 是代码侧**唯一**事实源；路由通过 `fastify-type-provider-zod` 声明 `schema`。
- 生成链路不变：`bun run openapi:generate` → `packages/generated/openapi.json` + `openapi.d.ts`；不得 hand-edit 生成物。
- `scripts/openapi-generate.mjs` **无需修改**（新端点在同一 `registerCaseRoutes` 内）。
- Slice 2 的三个既有 operation（`createCase` / `listCases` / `getCase`）语义不得改变。

---

### D-13 明确不做（与 Spec §3 Non-Goals 对齐）

- 不实现 `PauseCase` / `ResumeCase` / `WaitForInformation` / `ResumeAfterInformation` / `MarkLostContact` / `UserReturned` / `CloseCase` / `CreateRecurrence`。
- 不实现任何 Phase 转换命令（`StartAssessment` / `ConfirmProblemFormulation` / `ConfirmGoal` / `ActivatePlan` / `OpenReview` / `CompleteReview` / `EnterMaintenance` …）。
- 不建立 Safety State / `risk_events` / Safety service / 风险词检测 / 支持资源。
- 不写 Outcome / Closure Reason / Referral / Case 间关联。
- 不创建 Follow-up Schedule / Task / Notification 的迁移或取消逻辑；只冻结「降级 Case 不得保留仍会继续普通推进的语义」并在 Spec §13.7 留 Phase 4 前向义务。
- 不建立「晋升审批流」（候选评估 / 排序 / 建议 / 审批 / 投票 / 多管理员）。
- 不引入 AI：不生成理由、不推荐目标、不允许模型调用该命令、不提供 propose 通道。
- 不新增第二真相源：无 `/cases/current`、不复制 primary 到新表、不用列表排序伪装。
- 不扩展可见性：不定义孩子 / 其他成员 / Participant 切换后能看到什么。
- 不做数据权利 / 导出 / UI / 性能数字。

---

## Existing Contracts Reused

| 契约 | 来源 | 复用方式 |
|---|---|---|
| `families.created_by_person_id` 唯一 + Family 管理主体语义 | Slice 1（main） | 只读 |
| `authorize()` 纯函数 + Case 分支 | Slice 2（分支） | 增量一个 action |
| `withRlsTransaction(pool, {familyId, accountId, personId, purpose}, fn)` | Slice 2（分支） | 直接复用，不改签名 |
| `app.set_family_context` / `app_family_id()` | Slice 1（main） | 只读 |
| `lockFamilyForPrimaryDecision` | Slice 2（分支） | 直接复用（同一锁顺序） |
| `cases_one_primary_open_per_family` | Slice 2（分支） | 只依赖，不重建、不弱化 |
| `idempotency_keys` + `idempotency_key_bytes` + `decideIdempotency` | Slice 1 + Slice 2 | 新增一个 command_type |
| `case_events`（append-only、复合 FK、metadata 形状约束） | Slice 2 | 新增 2 个事件类型 |
| `business_audit_events` | Slice 1 + Slice 2 | 新增 1 个事件类型 |
| `errorHandler` / `toHttpError` / `ERROR_MAP` | Slice 1 + Slice 2 | 新增 4 个错误码 |
| `CaseResponse` / `CaseListResponse` | Slice 2 | 只读复用，不修改 |

---

## Data and Migration Impact

```text
new business tables            = 0
new columns                    = 0
new indexes                    = 0
new enums                      = 0
new RLS policies               = 0
replaced CHECK constraints     = 5   (case_events ×2, business_audit_events ×1, idempotency_keys ×2)
new column-level GRANT         = 1   (cases: is_primary, version, updated_at)
new migration files            = 1   (004_case_primary_switch.sql)
data backfill                  = 0
```

- 不修改 `001` / `002` / `003`。
- 不新建第二张幂等表或第二套审计表。
- 无 pgvector / pg_jieba / pg-boss / Drizzle push。

---

## Authorization / Safety / Compliance Impact

- **Authorization**：`authorize()` 新增一个 action；管理主体判定不变；未知 / 缺失上下文 fail-closed。
- **RLS**：不新增 policy；`cases` 的 UPDATE 由既有 `cases_family_scope` 约束；`case_events` 仍不可 UPDATE / DELETE。
- **Consent**：不参与、不要求、不替代、不创建（Spec §8）。
- **Safety**：只读 `status` 谓词；无新对象、无副作用、无绕过路径。
- **Compliance**：不采集新个人资料；事件 / 审计只存 `reason`（用户自述文本，Spec §10.1 明确要求保留）与 Case 标识符；不写 token / openid / 孩子原话 / 证据内容。
- **Minor policy**：执行主体恒为 ADULT 管理主体；不产生「孩子被要求确认主线」的语义。

---

## API / Contract Impact

- 新增 1 个端点契约与 2 个 Zod schema；**不修改**既有 3 个 Case 端点语义。
- `ERROR_MAP` 新增：`CASE_ALREADY_PRIMARY: 409`、`CASE_CLOSED: 409`、`SAFETY_HOLD_BLOCKED: 409`、`STALE_PRIMARY_VIEW: 409`。
- OpenAPI 必须可由 Zod 生成且 `openapi:check` 无 drift。

---

## AI / RAG / Eval Impact

**N/A**。不调用模型、不写 prompt、不做 RAG、不产生 AI run / Memory / Follow-up（`FR-009`）。

## Async / Notification / Side-Effect Impact

**N/A（无外部副作用）**。纯同步事务；不 enqueue pg-boss、不发通知、不触发 AI、不创建 Schedule。

---

## Project Structure（本 Slice 会触碰的路径）

```text
specs/007-case-primary-switch/
  spec.md                              # 冻结，本 Slice 不修改
  plan.md                              # 本文件（新增）
  checklists/requirements-quality.md   # 新增
  tasks.md                             # 新增

db/migrations/
  004_case_primary_switch.sql          # 新增（编号以实测为准）

packages/contracts/src/schemas.ts      # 新增 SwitchPrimaryCaseRequest / Response（不改既有）
packages/authorization/src/authorize.ts# 新增 CASE_SWITCH_PRIMARY
packages/domain/src/idempotency.ts     # 新增 CASE_SWITCH_PRIMARY 到 command type 列表
packages/domain/src/cases.ts           # 新增 repository 函数（不改既有函数语义）
packages/domain/src/case-primary-switch.ts  # 新增：纯决策函数 + 事件/审计 payload 组装
apps/server/api/src/routes/cases.ts    # 新增 1 个 POST（不动既有 3 个）
apps/server/api/src/plugins/error-handler.ts # 新增 4 个错误码映射

tests/domain/case-primary-switch-decision.test.ts   # 新增
tests/domain/case-primary-switch-contracts.test.ts  # 新增
tests/domain/case-primary-switch-authorization.test.ts # 新增
tests/db/case-primary-switch-schema.test.ts         # 新增
tests/db/case-primary-switch-rls.test.ts            # 新增
tests/db/case-primary-switch-concurrency.test.ts    # 新增
tests/integration/case-primary-switch-happy.test.ts     # 新增
tests/integration/case-primary-switch-conflicts.test.ts # 新增
tests/integration/case-primary-switch-authorization.test.ts # 新增
tests/integration/case-primary-switch-idempotency.test.ts   # 新增
tests/integration/case-primary-switch-atomicity.test.ts     # 新增
tests/integration/openapi-case-primary-switch.test.ts       # 新增

tests/integration/cases-scope.test.ts   # 精确收窄 `FORBIDDEN_ROUTE_FRAGMENTS`
tests/integration/openapi-cases.test.ts # 精确收窄 path / operation 集合
tests/db/roles.test.ts                  # `cases` 的 UPDATE 断言改为列级实测
tests/db/cases-events-metadata.test.ts  # 标题与断言收敛到「新词汇 + 读取审计仍被拒」
scripts/guard-static.mjs                # 无需改动（禁止表清单不变）
```

**不得触碰**：`Docs/**`、`specs/001-006/**`、`spec.md`、`db/migrations/001|002|003`。

---

## Verification Plan

> 本 Plan 只定义验证路径，**不执行**任何测试。Plan 阶段所有 command 均未运行，不得作为通过证据。

### V-1 FR 覆盖表（20 / 20）

| FR | 设计落点 | 主要验证 | 命令 |
|---|---|---|---|
| FR-001 | D-3 / D-4 | 唯一 primary；降级+升级 | `bunx vitest run tests/integration/case-primary-switch-happy.test.ts tests/db/case-primary-switch-concurrency.test.ts` |
| FR-002 | D-12 | 仅 1 个新端点；无第二真相源 | `bunx vitest run tests/integration/case-primary-switch-scope.test.ts tests/integration/openapi-case-primary-switch.test.ts` |
| FR-003 | D-10 | manager 允许；member / 跨家庭 / guardian 拒绝 | `bunx vitest run tests/integration/case-primary-switch-authorization.test.ts` |
| FR-004 | D-4-10 | `CLOSED` → 409 | `bunx vitest run tests/domain/case-primary-switch-decision.test.ts tests/integration/case-primary-switch-conflicts.test.ts` |
| FR-005 | D-4-11/12 / D-11 | 双向 `SAFETY_HOLD` 阻断 | 同上 + `tests/db/case-primary-switch-schema.test.ts` |
| FR-006 | D-2.2 / D-13 | `status` / `phase` 零变化 | `bunx vitest run tests/integration/case-primary-switch-happy.test.ts`（前后快照比对） |
| FR-007 | D-2.3 / D-13 | 原 Case 数据不删不改 | 同上（`updated_at` 之外全列比对 + 事件 append-only） |
| FR-008 | D-5 / D-9.3 | reason 必填、保留、不被覆盖 | `tests/integration/case-primary-switch-happy.test.ts`（往返切换后两条 reason 并存） |
| FR-009 | D-13 | 无 AI 通道 | `tests/integration/case-primary-switch-scope.test.ts`（无 propose / suggest 路由与表） |
| FR-010 | D-7 | 同 key 重放 / mismatch（HTTP 可达） | `bunx vitest run tests/integration/case-primary-switch-idempotency.test.ts` |
| FR-011 | D-6 | 陈旧视图 409；版本前进 | `tests/integration/case-primary-switch-conflicts.test.ts` |
| FR-012 | D-2.3 / D-9.3 | 两侧事件 + 一条审计，同事务 | `bunx vitest run tests/integration/case-primary-switch-atomicity.test.ts` |
| FR-013 | D-10 | 无 Case role / RBAC | `tests/domain/case-primary-switch-authorization.test.ts` + scope 断言 |
| FR-014 | D-13 | 无越界表 / 路由 | `tests/integration/case-primary-switch-scope.test.ts` + `tests/db/migration-repro.test.ts` |
| FR-015 | D-3.5 | 唯一约束冲突 = 500 且回滚 | `tests/db/case-primary-switch-concurrency.test.ts` |
| FR-016 | D-9.6 | RLS 无上下文 / 错误 Family | `bunx vitest run tests/db/case-primary-switch-rls.test.ts` |
| FR-017 | D-8 | 真实失败，无 200 伪装 | `tests/integration/case-primary-switch-conflicts.test.ts` |
| FR-018 | D-2.2 | 不补默认值 / 默认理由 | `tests/domain/case-primary-switch-contracts.test.ts` |
| FR-019 | Spec §13.7 / D-13 | 不伪造 Schedule 迁移；前向义务已冻结 | `tests/integration/case-primary-switch-scope.test.ts`（无 schedule / notification 表与路由） |
| FR-020 | D-9.2 | 越界守卫**精确收窄**而非删除 | `bunx vitest run tests/integration/cases-scope.test.ts tests/integration/openapi-cases.test.ts` |

### V-2 Acceptance 覆盖表（23 / 23）

| # | 场景 | 测试文件 | 关键断言 |
|---|---|---|---|
| 1 | 首次切换 | `case-primary-switch-happy` | B primary / A 非 primary；两侧 `version+1`；`status`/`phase` 不变；`GET /cases` 立即一致 |
| 2 | 往返切换 | `case-primary-switch-happy` | 回到 A primary；两条 reason 都可通过事件重建 |
| 3 | 晋升（无 primary） | `case-primary-switch-happy` | `previousPrimary=null`；非 500；仍只有一个 primary |
| 4 | 读取一致 | `case-primary-switch-happy` | 列表 primary 唯一；无 `/cases/current` |
| 5 | 非管理主体 | `case-primary-switch-authorization` | `404 CASE_NOT_FOUND`，响应体不含 status/phase/primary |
| 6 | 跨家庭 | `case-primary-switch-authorization` | 404 + 直连 RLS 查询 0 行 |
| 7 | guardian 非成员 | `case-primary-switch-authorization` | `CURRENT_FAMILY_NOT_FOUND`，**不是** Case 层错误 |
| 8 | 目标不存在 / 非法 ID | `case-primary-switch-conflicts` | 统一 404，非 422 |
| 9 | 已是 primary | `case-primary-switch-conflicts` | 409；`version` 不变；无事件 |
| 10 | 目标已关闭 | `case-primary-switch-conflicts` | 409（domain 谓词）+ DB fixture 不可达说明 |
| 11 | 当前 primary SAFETY_HOLD | `case-primary-switch-decision`（穷举）+ `case-primary-switch-conflicts` | 409；零写入 |
| 12 | 目标 SAFETY_HOLD | 同上 | 409；零写入 |
| 13 | 空 / 缺 / 超长 reason | `case-primary-switch-conflicts` | 422；`cases` / `case_events` / `business_audit_events` / `idempotency_keys` 均零新增 |
| 14 | 未声明字段 / 缺视图 | `case-primary-switch-conflicts` | 422；零写入 |
| 15 | 无副作用 | `case-primary-switch-happy` | 越界表计数为 0；两 Case 内容未改写 |
| 16 | 同 key 重放（含并发） | `case-primary-switch-idempotency` | 返回原 body；事件/审计计数不变；版本不变 |
| 17 | 同 key 不同目标 | `case-primary-switch-idempotency` | 409 mismatch；原结果不变 |
| 18 | 并发双切换（不同目标） | `case-primary-switch-concurrency` | 恰好 1 成功 + 1 `STALE_PRIMARY_VIEW`；计数 ≤ 1 |
| 19 | 并发切换与创建 | `case-primary-switch-concurrency` | 计数 ≤ 1；创建语义未变 |
| 20 | 陈旧视图 | `case-primary-switch-conflicts` | 409；零写入 |
| 21 | RLS 无上下文 | `case-primary-switch-rls` | SELECT 0 行；UPDATE 0 行；INSERT 被拒 |
| 22 | 审计原子性 | `case-primary-switch-atomicity` | 注入审计失败 → 整体回滚；`cases` 未变；无事件；无幂等快照 |
| 23 | 结构越界 | `case-primary-switch-scope` | 无越界表 / 路由；`/cases/current` 不存在；`case_events` 词汇恰为 3 值 |

### V-3 命令与期望（Implement 阶段逐条真实执行）

| 目标 | 命令 | 期望 |
|---|---|---|
| 结构与约束 | `bunx vitest run tests/db/case-primary-switch-schema.test.ts` | 5 个 CHECK 的新定义存在；`cases` 列集合仍为 9；无新表 / 新索引（对比 `002` 后状态） |
| 授权矩阵 | `bunx vitest run tests/domain/case-primary-switch-authorization.test.ts` | 6 条 fail-closed 分支全绿；既有 Slice 1/2 授权测试不被削弱 |
| 契约 | `bunx vitest run tests/domain/case-primary-switch-contracts.test.ts` | strict 拒绝 6 类未声明字段；视图四态组合正确 |
| 决策 | `bunx vitest run tests/domain/case-primary-switch-decision.test.ts` | 6 status × 4 视图全部覆盖 |
| 事务 | `bunx vitest run tests/integration/case-primary-switch-atomicity.test.ts` | 审计失败 → 回滚；无半条历史 |
| 并发 | `bunx vitest run tests/db/case-primary-switch-concurrency.test.ts` | `count(*) ≤ 1`；无 500；重复运行稳定 |
| RLS | `bunx vitest run tests/db/case-primary-switch-rls.test.ts` | 无上下文 0 行 / 拒写；错误 Family 0 行 |
| 越界守卫 | `bunx vitest run tests/integration/cases-scope.test.ts` | 仍禁止 `/cases/current`、pause、resume、close、recurrences…；仅放行新端点 |
| OpenAPI | `bun run openapi:check` | `PASS (no drift)`；4 个 Case operation；既有 3 个不变 |
| 全量回归 | `bunx vitest run` | 全绿；无 skip / expected-fail |
| 静态守卫 | `bun run guard:static` | `PASS (0 violations)` |
| 类型 | `bun run typecheck` | 通过（base + api 两个工程） |
| 迁移可重放 | `bun run db:migrate` ×2 | 第一次 APPLY，第二次全 SKIP |
| 迁移结构不变 | `bunx vitest run tests/db/migration-repro.test.ts` | 表 / policy / enum 计数**不变**（零扩张证据） |
| 角色权限 | `bunx vitest run tests/db/roles.test.ts` | `case_events` 仍只有 SELECT+INSERT；`cases` 列级 UPDATE 实测归档 |

**环境**：PostgreSQL 18（Stage A compose 或 CI service）；`DATABASE_URL` = app 角色；`MIGRATION_DATABASE_URL` = migrator 角色；`TEST_ADMIN_DATABASE_URL` = 测试断言用管理员连接。
**证据要求**：每条结果必须来自真实命令输出；不能运行的环境报告 `BLOCKED` / `NOT VERIFIED`，不得以「设计已存在」代替证据。

---

## Rollback / Recovery

1. **代码回滚**：移除新增 POST 路由与两个 schema；`authorize()` 与 `cases.ts` 的回滚为纯增量（删除新增分支即可，既有行为不变）。
2. **schema 回滚**：见 D-9.7（无表 / 列 / 索引需要删除，但 5 个 CHECK 与 1 条 GRANT 需要还原，且必须先判定是否已有新词汇数据）。
3. **数据**：前进方向无回填；回滚**不等于**无数据影响——一旦产生 `CASE_PRIMARY_*` / `CASE_SWITCH_PRIMARY` 行，还原 CHECK 会失败，必须另立 data disposition。
4. **不自动执行**：任何 down 步骤必须人工 review，不在 runtime 自动运行。

---

## Complexity Exceptions

**无。** 全部约束均可在已批准的 V1 技术栈与 Slice 1 / 2 基础设施内满足。

---

## Frozen Technical Decisions

以下为本 Plan 冻结的技术选择；Implement AI **不得**临场重新选择。变更必须返回 Plan Review 并重跑审计一。

| # | 冻结选择 | 理由 | 变更条件 |
|---|---|---|---|
| **R-1** | 端点为 `POST /api/v1/cases/:id/switch-primary`，`:id` 是目标；成功 `200` | §28.3 冻结路径；不新建资源故非 201 | 上游契约变更 |
| **R-2** | 幂等识别（REPLAY / MISMATCH）先于状态前置；授权先于幂等 | 否则重放会被误判为状态冲突，违反 §9.1(2) / Acceptance 16 | §9.1 语义变更 |
| **R-3** | 视图 = `expectedPrimaryCaseId` + `expectedPrimaryVersion`，二者必填可 null，且 null 必须成对 | 只给 id 无法拦截 `A→B→A` | §8.6 放宽 |
| **R-4** | 先降级后升级 | partial unique index 非延迟，反向恒失败 | 索引改为 DEFERRABLE（禁止） |
| **R-5** | `version` 在 SQL 内 `= version + 1` | 避免读-改-写丢失并发 | 无 |
| **R-6** | 事件词汇 `CASE_PRIMARY_ASSIGNED` / `CASE_PRIMARY_REVOKED`；审计 `CASE_PRIMARY_SWITCHED` | 与既有 `CASE_CREATED` 命名一致；不暗示状态机 | 需要与 Slice 2 词汇表对齐时 |
| **R-7** | `cases` 只授列级 `UPDATE (is_primary, version, updated_at)` | 保持 Slice 2 的「无表级 UPDATE」不变量 | 无（禁止升级为表级） |
| **R-8** | `metadata` 形状 CHECK 逐 `event_type` 分支，不放宽为任意 jsonb | 保留「不得写入正文 / PII」的可执行不变量 | 无 |
| **R-9** | 响应返回 `primary` + `previousPrimary` + `switchedAt`，不返回 `reason` | 可观测的原子交换；避免用户文本进入幂等快照 | 契约评审 |
| **R-10** | `SAFETY_HOLD` / `CLOSED` 谓词只做 domain 穷举测试，不伪造 `status` | Spec Q3a 明文要求 | Safety / Closure Slice 落地后改为真实前置 |

---

## Change Reconciliation（与既有 Slice 的预期收窄）

1. **`specs/002-case-core` FR-018 与越界守卫**：`FR-018` 声明 `/switch-primary` 不存在。本 Slice 是**范围合法收窄**（Spec `FR-020`）：断言从「`/switch-primary` 不存在」精确改为「除 `POST /cases/:id/switch-primary` 外仍无其他越界路由」，其余禁止项全部保留。**不得**删除该守卫、**不得**改成「不再检查越界」。
2. **`tests/integration/openapi-cases.test.ts`**：`casePaths` 断言从 2 个 path 精确扩为 3 个，operation 从 3 个扩为 4 个；既有 `createCase` / `listCases` / `getCase` 的 operationId、security、response 形状断言**逐条保留**。
3. **`specs/002-case-core` plan §3.1.1（current vs historical primary）**：Slice 2 已冻结「`is_primary` 表示当前 assignment，不是历史」并要求未来 Slice 在转移旧 primary 时清除标记。本 Slice **正是**该合同的第一位执行者：降级即清除，历史进事件，不保留 `is_primary=true` 的历史行。因此无需修改 002 的语义；若 Slice 2 审计二要求改写其 §3.1.1 措辞，那是 Slice 2 自身范围，007 不代办。
4. **`tests/db/roles.test.ts`**：`cases` 的 `UPDATE=false` 断言必须收窄为「表级 UPDATE 仍为 false / 列级 UPDATE 仅三列」。这是 002 冻结意图（append-only）在新命令下的正确投影，**不是**放宽。
5. **`tests/db/cases-events-metadata.test.ts`**：`event_type vocabulary is closed to CASE_CREATED` 的**标题**必须收敛为「读取审计词汇仍被拒」；其断言体（`CASE_VIEWED` 被拒）保持有效，**不得**删除。
6. **`tests/db/migration-repro.test.ts`**：表 / policy / enum 计数**不得**变化（零扩张），因此该文件**不应**出现 diff；若出现 diff，说明本 Slice 偷偷加了结构 → 视为失败。

---

## Blockers

**NONE（无产品级 / 语义级阻断）。**

唯一阻断是**程序性**的：

```text
IMPLEMENT BLOCKED BY:
Slice 2 (specs/002-case-core) 尚未完成审计二 PASS 并 merge main
```

并且 Slice 2 当前落后 `origin/main` **4** 个提交（Slice 1 final remediation）。这意味着「Slice 2 merge main」不是一次空操作：它必须自己完成 merge、重跑其 gate 与全量测试。007 **不得**代替 Slice 2 做这件事，也**不得**在旧分支上假装依赖已满足。

---

## 审计一 — 开发前计划审计（Audit 1）

> 本轮由计划 AI 2 自行执行，独立于 Plan / Checklist / Tasks 的撰写过程。审计对象：`spec.md`（冻结）→ `plan.md` → `checklists/requirements-quality.md` → `tasks.md`。

### A. Spec → Plan

| 检查项 | 结论 | 证据 |
|---|---|---|
| 语义漂移 | 无 | 20 条 FR 的每条结论都能落到 §D-1—D-13 的具体段落；未新增 Spec 之外的能力 |
| 漏项 | 无 | §6.3 的 10 条前置、§6.4 的 5 条效果、§6.5 的 5 条后置不变量均有落点 |
| 新增未经批准的能力 | 无 | 未出现 pause / resume / close / recurrence / PF / participant / evidence / safety 实现 |
| 错误依赖 | 无 | 只依赖 Slice 1（已合并）+ Slice 2（冻结合同，未合并）；无 Slice 3/4/005/006 依赖 |
| 记录的技术选择是否都在 Spec §22 授权范围内 | 是 | A-1（字段命名 / 包装）→ D-12；A-2（reason 上限 500）→ D-9.3；A-3（视图形态）→ D-6；A-4（枚举字面量）→ D-2.3 |
| 与上游 Docs 的一致性 | 一致 | §29.4 六步在 D-4 中逐条编号标注；§8.6 / §8.5 / §8.1 / §9.1 均有对应段 |

### B. Plan → Tasks

| 检查项 | 结论 | 证据 |
|---|---|---|
| 每个设计决策都有可执行 Task | 是 | D-1—D-13 全部在 `tasks.md` 的 Phase 0—12 中有对应任务（映射表见 tasks.md §Coverage） |
| Task 是否含文件 / 依赖 / 验收 / 验证命令 | 是 | 每条任务均为 `Task ID / 目标 / 文件 / Depends / Acceptance / Verify / REQ` 六元组 |
| 是否有「设计已存在但无任务」的空洞 | 无 | 审计逐条比对 D-1—D-13 与任务列表 |
| 是否存在「先实现后测试」的任务边 | 无 | Phase 2（RED）先于 Phase 3—9（实现）；依赖图无前向边 |

### C. FR / Acceptance 覆盖

| 维度 | 结果 |
|---|---|
| FR 覆盖 | **20 / 20**（V-1 表逐条有设计落点 + 测试文件 + 命令） |
| Acceptance 覆盖 | **23 / 23**（V-2 表逐条有测试文件 + 关键断言） |
| Success Criteria 覆盖 | 6 / 6（SC-1→V-2 #1/#2；SC-2→#18/#19/#21；SC-3→#5—#14；SC-4→#1/#2/#22；SC-5→#18/#19/#22；SC-6→Spec §13 合同 + R-* 冻结项） |
| 是否存在仅靠「设计已存在」代替测试的 FR | 无 |

### D. 并发（专项）

| 检查项 | 结论 | 证据 |
|---|---|---|
| switch vs switch（不同目标） | 收敛 | L1 串行 → 后者在 L2 看到新 primary → 视图不匹配 → 409 `STALE_PRIMARY_VIEW`（确定性，可断言） |
| switch vs switch（同目标） | 收敛 | 后者在步骤 13 命中 `CASE_ALREADY_PRIMARY`（先于视图比对） |
| switch vs create | 收敛 | 两者都先取 Family 行锁；create 只看 `EXISTS`，不持 Case 锁；两种提交顺序都只留 1 个未结 primary |
| same key concurrent | 收敛 | 唯一索引占位先于状态读取；后者阻塞后走 REPLAY |
| stale view | 可验证 | 视图 = (id, version)，`A→B→A` 往返也能被拦 |
| database uniqueness | 明确使用，不当兜底 | L3 只作最后防线；出现即 500 + 回滚，且测试断言并发场景无 500 |
| lock ordering | 无环 | ①→②→③ 全序；③ 内部 `ORDER BY id ASC`；无反向路径（D-3.4 逐条列证） |
| 是否只写「数据库会处理」 | 否 | D-3.2 逐层列职责，D-3.4 逐项排除环路 |

### E. Negative Space（实现完成后仍不得存在）

`PauseCase` / `ResumeCase` / `CloseCase` / `CreateRecurrence` / Problem Formulation / Evidence writer / Participant / Safety runtime / AI / Notification / Plan / Task / `/cases/current` / 第二套审计 / 第二套幂等 / 第二套授权 —— 全部在 D-13 明确排除，并在 tasks.md 的 scope 守卫任务中以「断言不存在」的形式落地（不是「不写就算」）。

### F. Dependency Honesty

| 检查项 | 结论 |
|---|---|
| 是否错误宣布 READY FOR IMPLEMENTATION | 否；本 Plan 结论为 `PLAN FROZEN` + `IMPLEMENT BLOCKED` |
| 是否掩盖 Slice 2 落后 main 4 个提交 | 否；§0.1 与 `## Blockers` 明确记录 |
| 是否把「分支存在」当作「依赖已满足」 | 否；§0.2 显式区分「冻结合同可用于 Plan」与「代码进入基线才可 Implement」 |

### 审计一结论

```text
PLAN / CHECKLIST / TASKS FINAL PASS
AUDIT 1 FINAL PASS
PLAN FROZEN

IMPLEMENT BLOCKED BY:
Slice 2 审计二 PASS + merge main
```

**未解决计划问题：0。**
