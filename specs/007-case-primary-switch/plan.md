# Implementation Plan: 007-case-primary-switch（Case 主问题切换 / `SwitchPrimaryCase`）

**Feature**: `specs/007-case-primary-switch/spec.md`（冻结 · SPECIFY / CLARIFY FINAL PASS）
**Frozen Spec Head**: `00db327746fab7fcc02f1dd3734c6965bfd95444`
**Date**: 2026-11-07（Round 2 — post-refreeze reconciliation）
**V1 Phase**: Phase 1 — Common Core 地基（`Docs/V1技术设计.md` §38；Case 控制面容量补全）
**阶段**: Plan → Checklist → Tasks → 审计一。本文件不含实现代码、migration 文件、测试实现。

> **本版不是上一版的排版整理，而是基于 `00db327` 的重新核对结果。**
> 上一版 Plan（生成于 `69cfe6f`）与本轮冻结 Spec 存在 **3 处实质冲突**（幂等传输、事务编排、基线事实），已在 §Reconciliation Round 2 逐条列出并修正。任何未被本版显式保留的旧结论，一律视为过期。

---

## 0. Baseline 与 Implement Gate

### 0.1 现场核对（2026-11-07 16:45 +08:00，命令输出，非摘要）

| 项 | 值 | 核对方式 |
|---|---|---|
| Repository | `pyxm1618/xiaoshuyin` | — |
| Branch | `feat/007-case-primary-switch` | `git rev-parse --abbrev-ref HEAD` |
| 本轮起点 Head | `00db327746fab7fcc02f1dd3734c6965bfd95444`（= 冻结 Spec Head） | `git rev-parse HEAD` |
| `origin/main` | `ee9d07e059566884e0329fb0eb4a4ab9dbf8ea83` | `git rev-parse origin/main` |
| 分支相对 main | merge-base == `origin/main`；分支不落后 | `git merge-base HEAD origin/main` |
| Working tree | clean | `git status --short` 空 |
| `origin/main` 的 migration | **仅** `db/migrations/001_initial_schema.sql` | `git ls-tree -r --name-only origin/main -- db/migrations/` |
| `origin/main` 是否含 `cases` / `case_events` | **否** | 同上 + `git ls-tree origin/main -- apps/server/api/src/routes/` |
| Slice 2 分支 Head | `fb30f28d386ae628f3b1f06c526929f724819be9` | `git rev-parse origin/feat/002-case-core` |
| Slice 2 相对 main | **41 ahead / 4 behind** | `git rev-list --left-right --count origin/main...origin/feat/002-case-core` |
| Slice 2 分支的 migration | `001` / `002_case_core.sql` / `003_case_idempotency_key_bytes.sql` | `git ls-tree -r --name-only origin/feat/002-case-core -- db/migrations/` |
| `Docs/V1产品需求.md` | v3.7 | 文件头 |
| `Docs/V1技术设计.md` | v3.12 | 文件头 |

> **三点必须记住的现场事实**
>
> 1. `origin/main` 上**没有** Case runtime。Slice 2 的 `cases` / `case_events` / 唯一索引 / `CASE_CREATE` 幂等类型全部只存在于 `feat/002-case-core`。
> 2. Slice 2 分支是 **pre-reconciliation 形状**：`apps/server/api/src/routes/cases.ts` 从 **body** 读 `idempotencyKey`；对 `origin/feat/002-case-core` 的 `apps` / `packages` / `tests` 做 grep，**找不到任何** `idempotency-key` header 的代码用法（只有 `tests/evidence/*.md` 里的事后说明）。
> 3. `origin/main` 上**已经存在** Slice 1 冻结的 header 助手 `apps/server/api/src/idempotency.ts › readIdempotencyKey()`（`req.headers['idempotency-key']`，8—128，缺失/越界 → `VALIDATION_ERROR` 422）。**这就是本 Slice 必须使用的传输实现**，不是要新造的东西。

### 0.2 本轮能完成什么 / 不能完成什么

```text
PLAN / CHECKLIST / TASKS / 审计一  可以完成   ← 基于冻结 Spec + Slice 2 分支的真实代码形状
IMPLEMENT 不可以开始                ← Slice 2 未完成审计二 PASS、未 merge main
```

| 类别 | 内容 | 本 Plan 的用法 |
|---|---|---|
| **main 上可直接依赖** | `authorize()`、`withRlsTransaction` 之外的 3 个 tx 包装、`app.set_family_context` / `app_family_id()`、`families.created_by_person_id`、`idempotency_keys` + `idempotency_scope` RLS、`business_audit_events`、`readIdempotencyKey()`、`ERROR_MAP`、`errorHandler` | 直接复用，不重写 |
| **只在 Slice 2 分支** | `cases` / `case_events` / `cases_one_primary_open_per_family` / `version` / `CASE_CREATE` / `lockFamilyForPrimaryDecision` / `reserveIdempotency` 系列 / `decideCaseAction()` / `CaseResponse` / 越界守卫测试 | 只用于**读形状**，不得当成"已可用基线"；Implement 前必须由 Gate 重新验证 |

### 0.3 Implement Gate（G1—G10，任一失败即停止）

**固定失败文案（原文照抄，不得改写）**：

```text
IMPLEMENT BLOCKED — SLICE 2 NOT MERGED
IMPLEMENT BLOCKED — SLICE 2 CONTRACT DRIFT
IMPLEMENT BLOCKED — SLICE 2 SEMANTICS CHANGED
IMPLEMENT BLOCKED — IDEMPOTENCY TRANSPORT DRIFT
IMPLEMENT BLOCKED — MIGRATION NUMBERING CONFLICT
IMPLEMENT BLOCKED — BASELINE NOT GREEN
```

| # | Gate | 现场验证方式 | 失败文案 |
|---|---|---|---|
| **G1** | Slice 2 已完成**审计二 PASS**且无未解决 finding | 读取 Slice 2 的独立审计结论（PR review / converge 报告），确认结论为 PASS 且无 open finding；仅有"有条件 PASS"不算 | `SLICE 2 NOT MERGED` |
| **G2** | Slice 2 已 merge `main` | `git fetch origin`；`git merge-base --is-ancestor <slice2-final-head> origin/main` 退出 0；记录新旧 `origin/main` SHA 与 `<old>..origin/main` 提交清单 | `SLICE 2 NOT MERGED` |
| **G3** | `origin/main` 真实包含 Case runtime | `git ls-tree -r --name-only origin/main -- db/migrations/ apps/server/api/src/routes/ packages/domain/src/` 必须同时出现 `*_case_core.sql`、`*_case_idempotency_key_bytes.sql`、`routes/cases.ts`、`domain/src/cases.ts` | `SLICE 2 NOT MERGED` |
| **G4** | 锁与主键决策语义未 drift | `lockFamilyForPrimaryDecision` 仍为 `SELECT id FROM families WHERE id = $1 FOR UPDATE`；`existsCurrentPrimary` 仍是**独立语句**（未折叠进 INSERT）；`cases_one_primary_open_per_family` 的 `indexdef` 仍为 `(family_id) WHERE is_primary AND status <> 'CLOSED'` | `SLICE 2 CONTRACT DRIFT` |
| **G5** | 幂等语义未 drift | `reserveIdempotency` 仍为 `ON CONFLICT DO NOTHING` + 占位 `0`/`'{}'`；`getReservedIdempotency` 仍 `FOR SHARE`；`completeIdempotency` 仍按 `actor+command+bytes` 回填；`IDEMPOTENCY_COMMAND_TYPES` 未被改写语义 | `SLICE 2 CONTRACT DRIFT` |
| **G6** | 授权语义未 drift | `authorize()` 仍为纯函数 fail-closed；`CASE_ACTIONS` 仍只有 `CASE_CREATE` / `CASE_LIST` / `CASE_READ`；**不存在** `authorizeCase()`；`MANAGER_ACTIONS` / `Purpose` 集合未变 | `SLICE 2 CONTRACT DRIFT` |
| **G7** | DB 约束名与谓词**实测**等于本 Plan D-9 的假设 | `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid IN ('case_events'::regclass,'business_audit_events'::regclass,'idempotency_keys'::regclass) ORDER BY conname;` 与 D-9.1 表逐字比对 | `SLICE 2 CONTRACT DRIFT` |
| **G8** | migration 编号未冲突 | `ls db/migrations` 取真实最大序号 N；目标文件必须为 `{N+1}_case_primary_switch.sql` 且**不存在**。**禁止**在 Slice 2 未合并时硬编码 `002`/`004` | `MIGRATION NUMBERING CONFLICT` |
| **G9** | 当前 `origin/main` 全量基线绿 | 在 merge 后的 main 上跑 `bun run typecheck`、`bun run guard:static`、`bunx vitest run`、`bun run openapi:check`，四条全 exit 0 且无 skip / expected-fail | `BASELINE NOT GREEN` |
| **G10** | Case 命令族**只有一种**幂等传输 | 合并后的 main 上：`git grep -n "idempotencyKey" -- apps/server/api/src/routes/ packages/contracts/src` 在 Case 路由与 Case 契约中**必须为空**；`readIdempotencyKey(` 必须在 `routes/cases.ts` 中被调用；`CreateCaseRequest` 不得再有 `idempotencyKey` 字段 | `IDEMPOTENCY TRANSPORT DRIFT` |

> **G10 为什么是硬门禁**：冻结 Spec §9.1.2 规定幂等键"必须通过 `Idempotency-Key` header 传递，不得另造 body 字段或第二套传输方式"。若 Slice 2 合并时仍保留 body 传输，007 单独改成 header 会让同一资源族出现两套 transport——这正是 Spec 禁止的形态。此时 007 **不得**自行改写 Slice 2，必须停下来要求 Slice 2 先完成它自己的 T091。
>
> **失败文案的写法**：上表"失败文案"列只写后缀；实际输出**必须**带 `IMPLEMENT BLOCKED — ` 前缀，即完整串必须与上方代码块逐字一致（例如 G8 必须输出 `IMPLEMENT BLOCKED — MIGRATION NUMBERING CONFLICT`）。不得自创文案、不得只输出后缀。
>
> **Gate 语义**：G1—G10 全绿只表示"依赖满足"，不表示 007 已通过审计二。本 Plan 恒为 `PLAN FROZEN`，永远不是 `READY FOR IMPLEMENTATION`。

---

## Upstream Traceability

| Upstream ID / Section | Source | 本 Plan 的投影 |
|---|---|---|
| V1-C01 | `Docs/V1产品需求.md` §24 | FR-001 → D-3（四层并发）+ D-4（降级→升级顺序） |
| V1-C21 | `Docs/V1产品需求.md` §24 | FR-016 → D-9.7（RLS 不动） |
| V1-C24 | `Docs/V1产品需求.md` §24 | FR-009 → D-13（无 AI 通道） |
| V1-C25 | `Docs/V1产品需求.md` §24 | FR-005 → D-11（双向 `SAFETY_HOLD` 谓词） |
| V1-C27 | `Docs/V1产品需求.md` §24 | FR-017 → D-8（真实失败表） |
| V1-C28 | `Docs/V1产品需求.md` §24 | FR-010 / FR-011 / FR-015 → D-7 / D-6 / D-3.5 |
| §2.1 六条切换规则 | `Docs/V1产品需求.md` | FR-008（理由）、FR-007（保留原 Case）、FR-019（旧提醒前向义务）、FR-003（有权用户）、FR-005（安全不可规避） |
| §5 不变量 1 / 2 / 12 / 17 / 19 / 20 | `Docs/V1技术设计.md` | FR-013 / FR-001 / FR-005 / FR-015 / FR-006 |
| §6.1 / §6.2 | `Docs/V1技术设计.md` | FR-006：只读 `status` / `phase`，D-2.2 显式不写 |
| §6.6 / §6.7 | `Docs/V1技术设计.md` | FR-006：切换不在状态转换表内 |
| §7.8 / §7.9 | `Docs/V1技术设计.md` | FR-012 → D-2.3（两侧事件 + 一条审计） |
| §8.1 | `Docs/V1技术设计.md` | FR-001 → D-3.2 L3（partial unique index） |
| §8.5 | `Docs/V1技术设计.md` | FR-010 → D-7（`CASE_SWITCH_PRIMARY`） |
| §8.6 | `Docs/V1技术设计.md` | FR-011 → D-6（视图 = id + version） |
| §9 / §9.1 | `Docs/V1技术设计.md` | FR-003 / FR-016 → D-10 / D-9.7 |
| §23 | `Docs/V1技术设计.md` | FR-009：`SwitchPrimaryCase` 是正式 Domain Command |
| §28.3 | `Docs/V1技术设计.md` | FR-002：唯一新增端点 |
| §29.4 | `Docs/V1技术设计.md` | FR-004 / 005 / 006 / 012 → D-4 六条前置逐条对应 |
| §37.2 | `Docs/V1技术设计.md` | FR-015 / FR-017：跨家庭硬阻断、重试不重复 |
| §38 Phase 1 | `Docs/V1技术设计.md` | 不越入 Phase 2—6 |
| §39 V1-C01 行 | `Docs/V1技术设计.md` | 验收"并发创建/切换后最多一个 primary" → D-3 + 并发测试 |
| Slice 1（已合并） | `origin/main` 真实代码 | `authorize()` 形状、`readIdempotencyKey()`、`withRlsTransaction`、RLS、`business_audit_events` |
| Slice 2（分支，未合并） | `origin/feat/002-case-core@fb30f28` | `cases` 9 列、`case_events`、唯一索引、`CASE_CREATE`、锁原语、`decideCaseAction()` |

**Blocking rule**：任何无法追溯到上表的扩展必须标记 `NEEDS UPSTREAM DECISION` 且不得实现。**本 Plan 未使用该标记。**

Spec 映射：FR-001—FR-020（20 条）、Acceptance Scenarios 1—23、Success Criteria 1—6、Non-Goals 1—13、Clarifications Q1—Q15 + Q3a。

---

## Summary

007 在 Slice 2 的 `cases` 容器上补**唯一一条**主线变更命令：

1. 新增 `POST /api/v1/cases/:id/switch-primary`：把路径目标设为当前唯一 primary，把原 primary 降为非 primary。
2. 幂等键走 **`Idempotency-Key` HTTP header**（复用 main 上的 `readIdempotencyKey()`），**不新增 body 字段**。
3. 单事务：`幂等占位 → Family 行锁 → 重读当前 primary 与目标 → 五类冲突 → 降级 → 升级 → 两侧事件 → 一条审计 → 幂等回填 → COMMIT`。
4. 授权复用 `authorize()` + 新增一个 `CASE_SWITCH_PRIMARY` action；**不建** `authorizeCase()`。
5. **零 schema 扩张**：0 新表 / 0 新列 / 0 新索引 / 0 新 enum / 0 新 policy；只有 5 个 CHECK 替换 + 1 条列级 GRANT + 1 个新 migration 文件。
6. `status` / `phase` / 计划 / 任务 / 提醒 / 通知 / 证据 / 安全记录全部不动。

---

## Technical Baseline

以 `Docs/V1技术设计.md` 为权威；**不引入任何新依赖**。

**Runtime**：Node.js（继承 Slice 1 / 2）；TypeScript 5.9；ESM。
**Dependencies**：Fastify 5 + `fastify-type-provider-zod` 7 + Zod ≥ 4.2 + `pg`；Drizzle 仅作 schema 类型与事务设施；RLS / 索引 / 约束用显式 reviewed SQL。
**Storage / Migration**：PostgreSQL 18（原生 `uuidv7()`）；`db/migrations/*.sql` reviewed；migrator / runtime 双角色；禁止 `drizzle-kit push`。
**Testing**：Vitest；domain 纯函数 + DB 结构 / RLS + integration + 真实多连接并发。
**Deployment target**：Stage A local / CI（`docker-compose.stage-a.yml`）。

未批准依赖 / 框架 / 服务 / 架构变更 = BLOCKER。**本 Plan 无此类变更。**

---

## Constitution Check

*GATE: MUST PASS before implementation planning proceeds.*

- [x] **No new product semantics.** 全部行为可追溯至 V1-C01 / C21 / C24 / C25 / C27 / C28、§2.1、§5、§6.1、§6.2、§6.6、§6.7、§7.8、§7.9、§8.1、§8.5、§8.6、§9、§9.1、§23、§28.3、§29.4、§37.2、§38、§39。字段名 / 错误码 / 事件字面量属 Spec §22 A-1 / A-3 / A-4 明确授权的技术选择。
- [x] **No V2–V5 scope pulled into V1.** 无 Participant / Evidence / Formulation / Safety 实现 / Plan / Task / Schedule / Notification / AI / RAG / Memory / UI / 数据权利。
- [x] **No canonical A/010xx behavior reordered.** 不触碰 Digital Use 节点与路由。
- [x] **Frozen stack and exclusions respected.** 无新依赖；无 pg-boss / pgvector / XState / 第二套框架。
- [x] **Deterministic rules remain deterministic.** 主线判定、冲突分类、幂等、授权、RLS 全是纯规则 + 数据库约束，无模型参与（FR-009）。
- [x] **Authorization / Consent / RLS / Safety / Compliance addressed.** `authorize()` 增量一个 action；`withRlsTransaction` 复用；ENABLE + FORCE RLS 不动；Safety 只消费 `status` 谓词。
- [x] **Provenance / version / history preserved.** 两侧 append-only 事件 + 一条审计；`version` 原子 `+1`；不覆盖、不删除。
- [x] **Failure / concurrency / idempotency designed.** D-8 失败表；D-3 并发收敛；D-7 幂等五态；无部分成功。
- [x] **Verification path exists for every acceptance item.** 见 V-1 / V-2 覆盖表，每条都有测试文件 + 命令。

**Post-design re-check**：设计完成后重新核对 9 项，结论仍全部通过（`## Complexity Exceptions` 为空，`## Blockers` 为 NONE）。

---

## Design

### D-1 实现模型

#### 1.1 上下文视图

```text
[客户端（本 Slice 不实现 UI）]
        │ HTTPS + Bearer session token（Slice 1 auth）
        │ + Idempotency-Key header（Slice 1 冻结）
        ▼
[Fastify API  apps/server/api]
        ├─ routes/cases.ts            既有 3 条 + 新增 1 条
        ├─ idempotency.ts             readIdempotencyKey()（复用，不改）
        ├──────────────────────────► [packages/authorization] authorize() + CASE_SWITCH_PRIMARY
        ├──────────────────────────► [packages/domain]        decideSwitchPrimary()（纯函数）
        │                                                   + cases.ts repository（全部 SQL）
        └──────────────────────────► [packages/contracts]     SwitchPrimaryCaseRequest / Response
        │
        ▼ withRlsTransaction（复用，不改签名）
[PostgreSQL 18]
  ├─ families                只读 creator + 行锁
  ├─ cases                   唯一新增写路径：is_primary / version / updated_at
  ├─ case_events             2 个新事件类型，append-only
  ├─ business_audit_events   1 个新事件类型
  └─ idempotency_keys        1 个新 command_type（bytea 精确身份）
```

- 上游只调一个端点；当前 Family 由服务端解析，客户端**不得**提交 `familyId`。
- 下游无模型 / 队列 / 通知 / 外部副作用。
- 只有 PostgreSQL；无缓存、无消息队列、无分布式锁。

#### 1.2 组件职责

| 组件 | 职责 | 明确不负责 |
|---|---|---|
| `apps/server/api/src/routes/cases.ts`（新增一个 `app.post`） | 认证、header 读取、current family 解析、Schema 校验、调用 authorize、编排事务、错误映射 | 不写 SQL、不自行判 primary、不实现第二套幂等 |
| `apps/server/api/src/idempotency.ts`（**复用，不修改**） | `readIdempotencyKey(req)` 的 header 解析与 8—128 校验 | 不参与本命令的事务编排 |
| `packages/domain/src/case-primary-switch.ts`（新增，纯函数） | 冲突分类与固定顺序、陈旧视图比对、事件 / 审计 payload 组装 | 不读库、不写库、不决定锁 |
| `packages/domain/src/cases.ts`（增量） | `cases` / `case_events` / `business_audit_events` 全部 SQL；幂等占位获取 | 不做业务判定、不吞 23505 |
| `packages/authorization/src/authorize.ts`（增量） | 新增 `CASE_SWITCH_PRIMARY` 的 fail-closed 判定 | 不读库、不判 Case 是否存在 |
| `packages/contracts/src/schemas.ts`（增量） | strict 请求 / 响应 Schema（代码侧单事实源） | 不承载业务规则 |
| `withRlsTransaction`（复用，不改） | identity + family 上下文、BEGIN / COMMIT / ROLLBACK | 不决定业务顺序 |

配置项：**无新增**。复用 `DATABASE_URL`、`MIGRATION_DATABASE_URL`、`SESSION_SECRET`。

#### 1.3 状态与流程（只改变一件事）

```text
                 Family F
                   A: is_primary = true        ← 当前主线
                   B: is_primary = false       ← 候选

POST /cases/B/switch-primary + Idempotency-Key + reason + 视图(A, A.version)
                     │
                     ▼  单事务
                   A: is_primary = false, version + 1
                   B: is_primary = true,  version + 1
                   A.status / A.phase 不变
                   B.status / B.phase 不变
                   两侧 case_events + 一条 business_audit_events + 幂等快照
```

**无状态机、无 phase 推进、无执行恢复。** 目标被设为主线后**仍然**是切换前的 `status` / `phase`（Spec §6.5.2、FR-006）。

---

### D-2 数据模型（零扩张）

#### 2.1 明确不做

```text
new business tables  = 0
new columns          = 0
new indexes          = 0
new enums            = 0
new RLS policies     = 0
```

`cases` 列集合必须保持 Slice 2 冻结的 **9 列**（`tests/db/cases-schema.test.ts › CASES_COLUMNS` 全等断言是硬门禁）。**禁止新增** `switch_reason` / `previous_primary_id` / `primary_since` / `switched_at`（Spec §17.1.5）。

#### 2.2 唯一写 `cases` 的三列

| 列 | 写法 | 约束 |
|---|---|---|
| `is_primary` | `= true`（目标） / `= false`（原 primary） | 沿用 `cases_one_primary_open_per_family` |
| `version` | `= version + 1`（**SQL 内自增**，不做读-改-写） | 沿用 `cases_version_check (version >= 1)` |
| `updated_at` | `= now()` | `cases` 无自更新触发器，必须显式写 |

**不得写**：`status`、`phase`、`family_id`、`created_by_person_id`、`id`、`created_at`。

**`is_primary` 的写入路径必须保持封闭可枚举**（Spec §13.1）：当前只有两条——Slice 2 的创建时判定（`CASE_CREATE`）与本 Slice 的切换命令。本 Slice **不得**打开第三条写入口（不写触发器、不写 view、不加 default、不在其它命令里顺手置位）。未来若要新增（例如关闭时清理主线），必须由对应上游合同显式冻结。

**`updated_at` 不参与任何业务判断**（Spec §17.1.3）：它只作提交时间的观测值，不用于并发控制（并发由视图 + `version` 承担）、不用于排序语义、不用于"最近一次切换"的推导（那必须来自事件）。

#### 2.3 事件与审计（只扩词汇，不扩结构）

| 载体 | 增量 | 形状 |
|---|---|---|
| `case_events.event_type` | `+ CASE_PRIMARY_ASSIGNED`、`+ CASE_PRIMARY_REVOKED` | 白名单 CHECK 替换（D-9.2） |
| `case_events.metadata`（目标侧） | `CASE_PRIMARY_ASSIGNED` | `{ primary: true, version: <int ≥1>, previousPrimaryCaseId: <uuid\|null>, reason: <string> }` |
| `case_events.metadata`（原侧） | `CASE_PRIMARY_REVOKED` | `{ primary: false, version: <int ≥1>, newPrimaryCaseId: <uuid>, reason: <string> }` |
| `business_audit_events.event_type` | `+ CASE_PRIMARY_SWITCHED` | 白名单 CHECK 替换 |
| `business_audit_events.metadata` | 无结构约束 | `{ targetCaseId, previousPrimaryCaseId, newPrimaryCaseId, previousVersion, newVersion, reason }` |

- `version` 存的是**该行更新后的版本**（来自 `UPDATE ... RETURNING`），不是旧版本。
- `reason` 存**原始字符串**（不 trim、不截断），与 canonical payload hash 的输入完全一致。
- **为什么 reason 进事件而不是 `cases` 行**：Spec §10.5 要求理由随历史保留；§17.1.5 明令禁止 `switch_reason` 列。
- **为什么两侧各写一条**：Spec §6.4.1 / §6.4.2 明确要求两侧事件；单条 Family 级事件无法按 Case 重建时间线（§17.2）。
- **为什么还写一条审计**：Spec §6.4.3 + §7.9 要求跨资源统一审计；`business_audit_events` 是唯一载体。

---

### D-3 并发方案

#### 3.1 目标

> 同一 Family 在任意时刻最多一个 `is_primary = true AND status <> 'CLOSED'` 的 Case，且在 `SwitchPrimaryCase` 与 `CreateCase` 的所有交错下都成立。

#### 3.2 四层机制（缺一不可，且不许互相替代）

| 层 | 机制 | 具体形状 | 唯一负责 | 明确不负责 |
|---|---|---|---|---|
| **L1 应用串行化** | Family 行锁 | `lockFamilyForPrimaryDecision`：`SELECT id FROM families WHERE id = $1 FOR UPDATE`（**复用**，不新写第二个锁函数） | 把同 Family 的所有 primary 变更命令（`CASE_CREATE` 与本命令）排成全序 | 不保证单条 `UPDATE` 的原子性 |
| **L2 锁后重读** | 独立语句 | `getCurrentPrimaryForUpdate`：`SELECT ... WHERE family_id=$1 AND is_primary AND status <> 'CLOSED' FOR UPDATE` | 在拿到 L1 后的新快照上重新决定"谁是当前 primary / 版本多少" | 不替代 L3 |
| **L3 数据库不变量** | partial unique index | `cases_one_primary_open_per_family ON cases (family_id) WHERE is_primary AND status <> 'CLOSED'`（**已存在，不重建**） | 拒绝任何绕过 L1 / L2 的第二条 primary 写入 | 不决定"该不该切换" |
| **L4 乐观并发** | 客户端视图 | `expectedPrimaryCaseId` + `expectedPrimaryVersion` 与 L2 结果比对 | 拒绝基于陈旧视图的覆盖写（§8.6） | 不替代 L1 |

#### 3.3 锁顺序（全库统一，不得出现反向顺序）

```text
① 幂等占位   INSERT ... ON CONFLICT DO NOTHING RETURNING id   （唯一索引上的行锁）
② families   SELECT id FROM families WHERE id=$1 FOR UPDATE   （强锁）
③ cases      SELECT ... FROM cases WHERE id = ANY($ids) ORDER BY id FOR UPDATE
④ 业务 UPDATE / INSERT
⑤ 幂等回填
⑥ COMMIT
```

- ②③ 顺序必须与 Slice 2 的 `CASE_CREATE` 一致（先 Family，后 Case）；`CASE_CREATE` 只取 ②，因此不存在 ③→② 的反向边。
- ③ 内部按 `id ASC` 排序加锁，避免未来"关闭 + 切换"等命令以不同顺序锁同一对 Case 形成环。
- **唯一允许的强锁对象**是 `families` 行与 `cases` 行。**不调用** Slice 1 的 `lockIdempotencyKey()` advisory 函数（本命令走唯一索引占位，见 D-7.5）。
- 由于 ② 已把同 Family 写者排成全序，③ 在实践中不会被第二个切换事务争用；保留排序是为了让未来命令继承同一顺序。

#### 3.4 死锁分析

| 潜在环路 | 是否存在 | 理由 |
|---|---|---|
| switch(F) → switch(F) | 否 | ② 把同 Family 串成单列；后者在 ② 排队时未持任何 Case 锁 |
| switch(F) → create(F) | 否 | create 只取 ②，不取 ③ |
| switch(F1) → switch(F2) | 否 | 不同 Family 不共享 `families` 行，也不共享 `cases` 行（复合 FK） |
| ③ 内部两行互为反向 | 否 | 固定 `ORDER BY id ASC` |
| ① 与 ②③ | 否 | 没有任何路径先取 ②③ 再取 ① |

**结论**：锁图是"按 Family 分区的偏序 + 分区内全序"，无环。

#### 3.5 唯一索引冲突的处置（不得当正常分支）

- 正常情况下 L1 / L2 保证不会出现第二条 primary，因此 `23505` on `cases_one_primary_open_per_family` **永不**是正常业务分支。
- 出现即代表不变量被绕过：**整体回滚 → 500 `INTERNAL_ERROR`**。
- 路由层**不得**捕获 `23505` 映射成 409 / 200（FR-015）。
- 测试必须证明：并发后 `count(*) WHERE is_primary AND status <> 'CLOSED' <= 1`，且并发场景**没有**任何一次 500。

#### 3.6 隔离级别与重试

- 默认 **READ COMMITTED**；不升 SERIALIZABLE（会引入不必要的可重试失败）。
- 应用层**不做**业务自动重试（不在应用层放大事务）；唯一例外是 D-7.5 的幂等占位有界重试（≤2 次，纯索引冲突，不改业务状态）。
- 锁等待超时 / 死锁 → 回滚 → 500 真实失败；客户端可凭**同一幂等键**安全重试。

---

### D-4 事务序列（唯一确定，与 Spec §6.3A 逐行对应）

> §29.4 的六条前置全部落地；顺序按 Spec §6.3A（见 §Change Reconciliation 的 REC-05 说明：§29.4 编号是**前置清单**，不是求值顺序）。

```text
 0a. app.authenticate (onRequest)              → 缺失/无效 401 UNAUTHENTICATED
 0b. readIdempotencyKey(req)                   → 缺失/长度越界 422 VALIDATION_ERROR
 0c. SwitchPrimaryCaseRequest.safeParse(body)  → 失败 422 VALIDATION_ERROR
        （strict：未知字段 / 缺 reason / 空白 reason / 超长 / 缺视图键 /
          只给视图一项 / 视图 id 非 uuid 全部在此拦截）
 1.  withIdentityTransaction → requireCurrentFamily(personId)
        NONE      → 404 CURRENT_FAMILY_NOT_FOUND
        AMBIGUOUS → 409 CURRENT_FAMILY_AMBIGUOUS
 ── 此后进入单一 RLS 事务 ────────────────────────────────
 2.  withRlsTransaction({familyId, accountId, personId, purpose:'FAMILY_MANAGEMENT'})
 3.  getFamilyById(tx, familyId) → createdByPersonId
 4.  authorize({actor, product:'V1', family:{familyId, createdByPersonId},
                case:{caseId}, resource:'CASE', action:'CASE_SWITCH_PRIMARY',
                purpose:'FAMILY_MANAGEMENT'})
        DENY → 404 CASE_NOT_FOUND（统一体，见 D-10.4）
5a.  acquireIdempotencySlot(tx, {actorAccountId, commandType, keyBytes, requestHash})
        OWNED     → 继续
        REPLAY    → return 已存 (status, body)   ← 不读 Case、不判状态
        MISMATCH  → throw 409 IDEMPOTENCY_PAYLOAD_MISMATCH（零写入）
        POISONED  → throw INTERNAL_ERROR（占位已提交，不变量破坏）
        CONTENTION→ throw INTERNAL_ERROR（有界重试耗尽）
 6.  lockFamilyForPrimaryDecision(tx, familyId) → 0 行 → INTERNAL_ERROR
 7.  getCurrentPrimaryForUpdate(tx, familyId)  → >1 行 → INTERNAL_ERROR
 8.  getCaseForUpdate(tx, caseId)              → 0 行 → 404 CASE_NOT_FOUND
 9.  decideSwitchPrimary({current, target, expected})
        DENY(CASE_CLOSED)        → 409 CASE_CLOSED
        DENY(SAFETY_HOLD_BLOCKED)→ 409 SAFETY_HOLD_BLOCKED
        DENY(CASE_ALREADY_PRIMARY)→409 CASE_ALREADY_PRIMARY
        DENY(STALE_PRIMARY_VIEW) → 409 STALE_PRIMARY_VIEW
        ALLOW                    → 继续
 9b. reason 业务复核（Spec §6.3A 第 9 步，「冗余防线」）
        —— 0c 已拒绝空 / 空白 / 超长，故此步在本 Plan 中是**可证明不可达的
           域内断言**：实现若保留，只允许 assert 不得产出新的 422；
           绝不允许把已由 0c 决定的 422 推后，也不允许覆盖第 9 步的 409。
10.  降级（仅当 current 存在）：UPDATE cases SET is_primary=false,
        version=version+1, updated_at=now() WHERE id=$current RETURNING ...
        断言恰好 1 行
11.  升级：UPDATE cases SET is_primary=true, version=version+1,
        updated_at=now() WHERE id=$target RETURNING ...
        断言恰好 1 行
12.  INSERT case_events (CASE_PRIMARY_REVOKED)  ← 仅当 current 存在
13.  INSERT case_events (CASE_PRIMARY_ASSIGNED)
14.  INSERT business_audit_events (CASE_PRIMARY_SWITCHED, 'CASE', targetId)
15.  completeIdempotency(tx, {status:200, body})
16.  COMMIT（由 withRlsTransaction 完成）
17.  200 + body
```

**不可协商的细节**

1. **必须先降级（10）再升级（11）**。反过来会在同一语句序列内出现两条未结 primary，触发非延迟的 partial unique index → `23505` → 命令恒失败。降级后的"零 primary 中间态"对其他事务不可见（未提交），且唯一索引允许 0 条。
2. **每个 `UPDATE ... RETURNING` 必须断言恰好 1 行**。0 行说明该行在本 Family 的 RLS 上下文中不可见（越权 / 上下文错误 / 行已变），必须抛 `INTERNAL_ERROR` 回滚，**不得**当作"无需更新"继续。
3. **`version` 必须在 SQL 内自增**，不得先 `SELECT version` 再 `SET version = $n`。
4. **路径 `:id` 必须先过 `UUID_PATTERN` 形状守卫**（`routes/cases.ts` 已有该常量）。未过 → 直接 `404 CASE_NOT_FOUND`，**不得**把非 uuid 文本送进 `WHERE id = $1`（会触发 `22P02` → 500，违反 Acceptance 8）。
5. **`switchedAt` 取目标行 `RETURNING updated_at`**，不另调 `now()` 或 `Date.now()`；响应必须来自已提交数据。

---

### D-5 状态冲突判定（纯函数，可穷举单测）

`decideSwitchPrimary(input): SwitchDecision`（`packages/domain/src/case-primary-switch.ts`，无 I/O）

```ts
type SwitchDecision =
  | { kind: 'DENY'; code: 'CASE_CLOSED' | 'SAFETY_HOLD_BLOCKED'
                     | 'CASE_ALREADY_PRIMARY' | 'STALE_PRIMARY_VIEW' }
  | { kind: 'ALLOW'; demote: null | { caseId: string };
                     promote: { caseId: string } };
```

判定顺序（与 D-4 第 9 步逐一对应，**不得重排**）：

| # | 条件 | 结果 |
|---|---|---|
| 1 | `target.status === 'CLOSED'` | `DENY CASE_CLOSED` |
| 2 | `target.status === 'SAFETY_HOLD'` | `DENY SAFETY_HOLD_BLOCKED` |
| 3 | `current?.status === 'SAFETY_HOLD'` | `DENY SAFETY_HOLD_BLOCKED` |
| 4 | `current !== null && current.caseId === target.caseId` | `DENY CASE_ALREADY_PRIMARY` |
| 5 | 视图不匹配（见 D-6.3） | `DENY STALE_PRIMARY_VIEW` |
| 6 | 其余 | `ALLOW`（`demote = current === null ? null : {caseId: current.caseId}`） |

**为什么顺序固定**：`CLOSED` 是终态，必须优先于 `SAFETY_HOLD`（Spec §6.3 第 4 条先于第 5 条）；「已是 primary」必须先于「陈旧视图」，否则重复点击会被误报成 `STALE_PRIMARY_VIEW`，掩盖真实的终态无操作冲突（Q1）。

**为什么是纯函数**：Spec Q3a 要求 `SAFETY_HOLD` / `CLOSED` 谓词"用单元测试覆盖全部状态值"，且**不得**通过直接 `UPDATE status` 制造测试前置。6 个 status × 4 类视图 = 24 组合可完全穷举。

**输入不做 I/O，也不接受 `isPrimary` 之外的写入意图**：`demote` / `promote` 只是 id，是否写入由 D-4 决定。

---

### D-6 陈旧视图 / 乐观并发（FR-011）

#### 6.1 表达方式（Spec §22 A-3 的技术选择）

请求体**必须**携带两条视图字段，二者对客户端都是必填（可显式 `null`）：

```json
{
  "reason": "原来那条线已经处理完，现在主要处理孩子上学的问题",
  "expectedPrimaryCaseId": "0192f0c4-...-..." ,
  "expectedPrimaryVersion": 3
}
```

- 两者都为 `null`：客户端声明"我认为这个 Family 现在没有未结 primary"（晋升分支）。
- 两者都非 null：客户端声明"我认为当前 primary 是这个 Case、版本是 N"。

**为什么两者都要**：只给 id 无法识别 `A → B → A`（客户端看到 A，但主线已前进两版）；只给 version 无法识别"换成了另一个 Case"。这正是 §8.6"旧版本请求不能覆盖新状态"要拦的情形。

#### 6.2 Schema 级联约束（strict，422）

| 组合 | 结果 |
|---|---|
| `expectedPrimaryCaseId` 键缺失（undefined） | `422 VALIDATION_ERROR` |
| `expectedPrimaryVersion` 键缺失 | `422 VALIDATION_ERROR` |
| 双 `null` | 合法（晋升视图） |
| `uuid` + 整数 ≥ 1 | 合法 |
| 一 null 一非 null | `422 VALIDATION_ERROR`（视图自相矛盾） |
| id 不是 uuid 字面量 | `422 VALIDATION_ERROR`（形状错误，不进入状态判定） |
| version 为 0 / 负数 / 小数 | `422 VALIDATION_ERROR` |

zod 用 `superRefine` 表达跨字段不变量；`strictObject` 拒绝任何未声明字段（`isPrimary`、`primary`、`version`、`status`、`phase`、`familyId`、`targetCaseId`、`idempotencyKey`）→ `422` 零写入（Acceptance 14）。

> **注意**：`idempotencyKey` 出现在此禁止清单里，因为它已迁移到 header（R-11）。任何客户端把 key 放进 body 必须被 `422` 拒绝，而不是被静默忽略——否则会出现两套 transport。

#### 6.3 比对规则（L2 重读之后执行）

设 `cur` = 锁定后的当前未结 primary（可能为 `null`），`e` = 客户端视图。

| `cur` | `e` | 结果 |
|---|---|---|
| `null` | `{null, null}` | 通过（晋升） |
| `null` | 非空视图 | `STALE_PRIMARY_VIEW` |
| 非 null | `{null, null}` | `STALE_PRIMARY_VIEW` |
| 非 null | id 不同 | `STALE_PRIMARY_VIEW` |
| 非 null | id 相同、version 不同 | `STALE_PRIMARY_VIEW` |
| 非 null | id 相同、version 相同 | 通过 |

- **UUID 大小写归一**：`expectedPrimaryCaseId` 与路径 `:id` 在比较与进 hash 之前统一 `toLowerCase()`。否则客户端回显大写 uuid 会被误判为陈旧视图。
- **禁止**：版本"大于等于即可"；版本缺失时跳过比较；"最后写入者获胜"。

---

### D-7 幂等（`CASE_SWITCH_PRIMARY`）—— **传输走 header**

#### 7.1 复用既有基础设施（不建第二张表）

- 复用 `idempotency_keys`（Slice 1 表 + Slice 2 的 `idempotency_key_bytes` 精确身份）。
- 命令类型白名单新增 `CASE_SWITCH_PRIMARY`（reviewed migration）。
- 运行时白名单 `packages/domain/src/idempotency.ts › IDEMPOTENCY_COMMAND_TYPES` 同步新增，并有注册一致性测试。

#### 7.2 Transport（**本轮修正点**）

| 项 | 冻结值 |
|---|---|
| 传递方式 | HTTP header **`Idempotency-Key`** |
| 长度 | 8—128（UTF-16 code units，沿用 Slice 1 `readIdempotencyKey`） |
| 解析函数 | `apps/server/api/src/idempotency.ts › readIdempotencyKey(req)`（**main 上已存在，直接调用**） |
| body 字段 | **禁止**出现 `idempotencyKey`；schema 为 `strictObject`，出现即 422 |
| 失败语义 | header 缺失 / 越界 → `422 VALIDATION_ERROR`（由 `readIdempotencyKey` 抛出） |

> **为什么不是 body**：冻结 Spec §9.1.2 / §17.3 / FR-010 三处都写明必须使用 Slice 1 已冻结的 `Idempotency-Key` header，且"不得另造 body 字段或第二套传输方式"。上一版 Plan 的 `body.idempotencyKey` 属对 pre-reconciliation Slice 2 分支的错误继承，已废弃（见 §Reconciliation Round 2 第 2 条）。

#### 7.3 精确身份（bytea-only）

- `CASE_SWITCH_PRIMARY` 的行**只使用** `idempotency_key_bytes`（UTF-16LE），`idempotency_key` 为 `NULL`。
- 该命令**没有** pre-003 历史，因此**不需要** legacy text 回退：`getReservedIdempotency` 调用时 `legacyKeyText` 传 `null`。
- 为使上述结论可证明，D-9.3 把 CHECK 收紧为"`CASE_SWITCH_PRIMARY` 必须是 bytea-only"（比"恰有其一"更强），从而**结构上排除** text-only 行存在的可能。

#### 7.4 Canonical payload hash

```text
request_hash = sha256(canonicalJson({
  familyId,                                        // 服务端已验证，防跨 Family 回放
  targetCaseId,                                    // 路径 :id，小写归一
  reason,                                          // 原样，不 trim
  expectedPrimaryCaseId,                           // 小写归一或 null
  expectedPrimaryVersion                           // int 或 null
}))
```

- `canonicalJson` / `hashPayload` 复用 `packages/domain/src/idempotency.ts`。
- `targetCaseId` **必须**进 hash：Spec §9.1.3 明确"同 key 指向另一个目标 → 409"；该分支在本命令上**可达**。
- `reason` **必须**进 hash：它改变事件与审计内容（§9.1.4）。
- `actor` / `command_type` 不重复进 hash：logical scope 已是 `(actor_account_id, command_type, logical key)`（沿用 Slice 2 D-5.2 理由，实现注释须写明）。
- **不包含** `idempotencyKey` 本身（它是 scope，不是 payload）。

#### 7.5 五态行为与占位获取（有界重试）

`acquireIdempotencySlot(tx, input)`（放 `packages/domain/src/cases.ts`，SQL 留在 packages，满足 guard R4）：

```text
for attempt in 1..2:
    if reserveIdempotency(tx, ...) returns true    → return OWNED
    row = getReservedIdempotency(tx, ...)          // FOR SHARE，阻塞直到对端提交/回滚
    if row is null                                  → continue（对端已回滚，重试占位）
    if row.response_status = 0                      → return POISONED
    if row.request_hash = requestHash               → return REPLAY(status, body)
    else                                            → return MISMATCH
return CONTENTION
```

| 情形 | 行为 | 写入 |
|---|---|---|
| 同 key + 同 hash | 返回已存 `200` body；不降级、不升级、不追加事件/审计、不递增版本 | 0 |
| 同 key + 不同 hash | `409 IDEMPOTENCY_PAYLOAD_MISMATCH`；原结果不变 | 0 |
| 同 key 并发 | 唯一索引占位串行化：恰好一个执行；其余在释放后走 REPLAY | 1 个业务结果 |
| 首次执行但业务失败（409 / 422 / 500） | 事务回滚 → 占位消失 → 无幂等快照 | 0 |
| 占位被提交但未回填（`response_status = 0`） | `500 INTERNAL_ERROR`，**不得**当作 REPLAY 返回 status 0 | 0 |

**为什么失败必须回滚占位**：留下 `response_status = 0` 的行会让后续同 key 请求既不能重放也不能重执行，形成永久毒化。`withRlsTransaction` 在抛错时 `ROLLBACK`，占位随之消失——这正是 Spec §9.3"失败路径必须整体回滚，包括幂等占位行"。

**为什么占位必须早于状态判定**（Spec §6.3A 约束 2）：若占位放在状态判定之后，一个与首次请求**并发**的同 key 重试会先看到已被改写的世界状态（`CASE_ALREADY_PRIMARY`），从而返回 409 而不是原结果，直接违反 Acceptance 16"含并发重试"。

**为什么有界重试**：`ON CONFLICT DO NOTHING` 在对端回滚后会返回 0 行且不留行，此时必须重试一次；上限 2 次是为了让"无法收敛"变成显式 500 而不是无限循环。

#### 7.6 为什么不用 Slice 1 的 `runIdempotentCommand()`

`apps/server/api/src/idempotency.ts › runIdempotentCommand()` 会**自己** `pool.connect()` + `BEGIN` + `set_identity_context`，其 `fn` 只拿到 client，没有 `set_family_context`。本命令必须同时具备 identity + **family** 上下文、Family 行锁与 Case 行锁，且全部在同一条连接、同一个事务内（Spec §9.3）。把 `withRlsTransaction(pool, …)` 嵌进去会申请**第二条连接**，事务边界被拆开。

因此冻结：

- **传输**复用 `readIdempotencyKey()`（Slice 1）；
- **占位与回填**复用 `reserveIdempotency` / `getReservedIdempotency` / `completeIdempotency`（Slice 2）；
- **事务**由 `withRlsTransaction` 唯一持有；
- **不调用** `runIdempotentCommand()` 与 `lockIdempotencyKey()`。

> 这不是"第二套幂等"：三者写的是同一张 `idempotency_keys`、同一组唯一约束、同一套 replay 判定（`decideIdempotency`）。区别只在编排位置，且被 Spec §9.3 的单事务要求强制。

#### 7.7 不得污染 `CASE_CREATE`

本 Slice **不修改** `CASE_CREATE` 的任何行为。若合并后的 main 上 `CASE_CREATE` 仍用 body 传输，那是 Slice 2 自己的未完成项（其 T091），由 G10 拦截，**不得**由 007 顺手改。

---

### D-8 失败语义（与 Spec §11 逐条一致）

| 类别 | 触发点（D-4 步骤） | HTTP | 业务写入 | 幂等快照 |
|---|---|---|---|---|
| `UNAUTHENTICATED` | 0a | `401` | 无 | 无 |
| `CURRENT_FAMILY_NOT_FOUND` | 1 | `404` | 无 | 无 |
| `CURRENT_FAMILY_AMBIGUOUS` | 1 | `409` | 无 | 无 |
| `CASE_NOT_FOUND` | 4（DENY）/ 8（0 行）/ 非法 uuid | `404` | 无 | 无 |
| `VALIDATION_ERROR` | 0b / 0c | `422` | 无 | 无（未占位） |
| `CASE_ALREADY_PRIMARY` | 9 | `409` | 无 | 占位已回滚 |
| `CASE_CLOSED` | 9 | `409` | 无 | 占位已回滚 |
| `SAFETY_HOLD_BLOCKED` | 9 | `409` | 无 | 占位已回滚 |
| `STALE_PRIMARY_VIEW` | 9 | `409` | 无 | 占位已回滚 |
| `IDEMPOTENCY_PAYLOAD_MISMATCH` | 5a | `409` | 无，原结果不变 | 原快照不变 |
| `INTERNAL_ERROR` | 6 / 7 / 10 / 11 断言失败、`23505`、`POISONED`、`CONTENTION`、未知 | `500` | 必须整体回滚 | 无 |

**必须由测试证明**

- 重放 ≠ 失败：同 key 同 payload 的重放返回 `200` 原结果，不得返回 409。
- 422 不得被 409 掩盖：请求形状错误（哪怕同时存在陈旧视图）必须返回 422。
- 不得伪造成功：冲突 / 无权 / 终态一律真实失败，不得 `200` + 未变更状态。
- 不得成功但无证据：不存在"主线已变但历史缺失"或"历史已写但主线未变"的持久态。
- `500` 响应体固定为 `{ code: 'INTERNAL_ERROR', message: 'An internal error occurred' }`（复用既有 `errorHandler`），不泄露 SQLSTATE / SQL / 参数。

---

### D-9 Migration 策略（单文件、reviewed、可回滚）

#### 9.1 文件与编号

```text
db/migrations/{N+1}_case_primary_switch.sql
```

- `N` 必须在 Slice 2 合并后**从真实 `ls db/migrations` 读取**（G8）。当前基线：main 只有 `001`；Slice 2 分支有 `001/002/003`。
- **禁止**在 Slice 2 未合并时取名 `002_*`（与 `002_case_core.sql` 冲突）。
- **不修改** `001_initial_schema.sql` / `002_case_core.sql` / `003_case_idempotency_key_bytes.sql`。
- 禁止 `drizzle-kit push`；迁移由 `xiaoshuyin_migrator` 在单事务内执行（`scripts/db-migrate.mjs` 已保证）。

#### 9.2 变更清单（**6 处**：5 个 CHECK 替换 + 1 条列级 GRANT）

| # | 对象 | 操作 | 目标定义（设计级，非最终 SQL） |
|---|---|---|---|
| 1 | `case_events_event_type_check` | DROP + ADD | `event_type IN ('CASE_CREATED','CASE_PRIMARY_ASSIGNED','CASE_PRIMARY_REVOKED')` |
| 2 | `case_events_metadata_shape_check` | DROP + ADD | 按 `event_type` **逐类型分支**（D-9.3） |
| 3 | `business_audit_events_event_type_check` | DROP + ADD | 原 7 值 + `CASE_PRIMARY_SWITCHED` |
| 4 | `idempotency_keys_command_type_check` | DROP + ADD | 原 7 值 + `CASE_SWITCH_PRIMARY` |
| 5 | `idempotency_keys_key_representation_check` | DROP + ADD | `CASE_CREATE` 保持"恰有其一"；`CASE_SWITCH_PRIMARY` 收紧为 **bytea-only**（D-9.4） |
| 6 | `cases` 授权 | `GRANT UPDATE (is_primary, version, updated_at) ON cases TO xiaoshuyin_app` | **列级**，不是表级（D-9.6） |

- 执行顺序 1→2→3→4→5→6，全部在单事务内。
- **不改** `business_audit_events_resource_type_check`：`CASE` 已在其白名单内（`('FAMILY','PERSON','CONSENT','CASE')`）。
- 约束名以 G7 的 `pg_constraint` 实测为准；若名称不同，先记录真实名再改文件，**不得**假设默认名。

#### 9.3 `case_events_metadata_shape_check` 的逐类型收窄

```text
CHECK (
  (event_type = 'CASE_CREATED'
     AND 键集合恰为 {primary, version}
     AND jsonb_typeof(primary)='boolean'
     AND version 为整数且 >= 1)                       ← 与 002 完全等价，不放宽

  OR (event_type = 'CASE_PRIMARY_ASSIGNED'
     AND 键集合恰为 {primary, version, previousPrimaryCaseId, reason}
     AND metadata->'primary' = 'true'::jsonb
     AND version 为整数且 >= 1
     AND (previousPrimaryCaseId 为 null 或 string)
     AND jsonb_typeof(reason)='string' AND btrim(reason) <> '' AND length(reason) <= 500)

  OR (event_type = 'CASE_PRIMARY_REVOKED'
     AND 键集合恰为 {primary, version, newPrimaryCaseId, reason}
     AND metadata->'primary' = 'false'::jsonb
     AND version 为整数且 >= 1
     AND newPrimaryCaseId 为 string
     AND jsonb_typeof(reason)='string' AND btrim(reason) <> '' AND length(reason) <= 500)
)
```

**为什么必须逐类型分支**：`CASE_CREATED` 的"额外 key 一律拒绝"（Slice 2 `cases-events-metadata.test.ts` 的 `rejects extra keys (title / description / PII)`）必须**原样保留**。放宽成单一 `jsonb_typeof(metadata)='object'` 等于把"不得写入正文 / PII"从可执行不变量降级为约定。

**数值子句必须用 `CASE WHEN` 守护**：沿用 002 的写法，避免非数字 `version` 触发 cast 错误而不是干净的 CHECK 违规。

**reason 长度方向**：API 用 JS `.length`（UTF-16 code units）限 500；DB `length()` 计字符。对任意输入，字符数 ≤ code unit 数，故 API 通过的值必不违反 DB 上限。实现注释须写明这一方向选择。

#### 9.4 `idempotency_keys_key_representation_check` 的收紧（易漏点）

现状（`003`）：`CASE_CREATE` 允许 text-only、bytes-only 或两者皆 NULL（"恰有其一"），其余命令强制 text-only 且 bytes NULL。

若只把 `CASE_SWITCH_PRIMARY` 加入 `command_type` 白名单而不动这条 CHECK，`reserveIdempotency` 写入的 `idempotency_key = NULL` 会直接违反约束 → 命令恒 422/500。

目标定义：

```text
(command_type NOT IN ('CASE_CREATE','CASE_SWITCH_PRIMARY')
    AND idempotency_key IS NOT NULL AND idempotency_key_bytes IS NULL)
OR (command_type = 'CASE_CREATE'
    AND ((text NOT NULL AND bytes NULL) OR (text NULL AND bytes NOT NULL)))   ← 原语义不变
OR (command_type = 'CASE_SWITCH_PRIMARY'
    AND idempotency_key IS NULL AND idempotency_key_bytes IS NOT NULL)        ← 收紧为 bytea-only
```

- 唯一性继续由 `idempotency_scope_key`（text）与 `idempotency_scope_key_bytes`（bytea）覆盖；**不新增第三个索引**。
- 该 CHECK **不在 Spec §16 的 11 条清单内**，但已在 `003` 中实测存在；本 Plan 将其记为第 12 条 reconciliation（见 §D-14.12），不得被实现 AI 当作"Spec 没提就不用改"。

#### 9.5 为什么 `cases` 的 UPDATE 必须是列级

- 表级 `GRANT UPDATE ON cases` 会把 `status` / `phase` / `family_id` / `created_by_person_id` 一并暴露为可写，直接破坏 Slice 2 的 append-only 意图与 FR-006。
- 列级授权下 PostgreSQL 的 `has_table_privilege(..., 'UPDATE')` **返回 false**（表级与列级是两套判定，列级需 `has_column_privilege`）——这是既有语义，但**仍须由 T715 实测确认**；因此 Slice 2 `roles.test.ts` 的"表级 UPDATE = false"断言**不需要被放宽**。
- 冻结：该断言必须**原样保留**，另加 `has_column_privilege` 正向断言。若实测 `has_table_privilege` 返回 true，说明 GRANT 写成了表级 → **改 migration，不改测试**。

#### 9.6 RLS

- `cases` 现有 policy `cases_family_scope` 已含 `USING` + `WITH CHECK`，`UPDATE` 自动受其约束；**不新增 policy**。
- 错误 Family 上下文下 `UPDATE ... RETURNING` 返回 0 行 → D-4 细节 2 抛 `INTERNAL_ERROR`，不静默成功。
- `case_events` 仍只有 `SELECT, INSERT`：不授予 `UPDATE` / `DELETE`（append-only 保持）。
- `idempotency_keys` 的 `idempotency_scope` policy（identity 级）不变；本命令在 `withRlsTransaction` 内调用，identity 上下文已就位。

#### 9.7 回滚

| 项 | 说明 |
|---|---|
| 前置判定 | 回滚前必须确认是否已产生 `CASE_PRIMARY_ASSIGNED` / `CASE_PRIMARY_REVOKED` / `CASE_SWITCH_PRIMARY` 行；存在则**不得**直接还原 CHECK（会 `23514` 失败） |
| 无新格式数据 | 逆序：撤销列级 GRANT → 还原 5 个 CHECK。无表 / 列 / 索引需删除 |
| 已产生数据 | 必须另立 reviewed data disposition：事件与幂等行是保留、导出还是保持 migration 在线；**不得**以"前进无 backfill"声称"回滚无数据影响" |
| 执行方式 | 只允许人工 reviewed 步骤，不在 runtime 自动执行 |

#### 9.8 前向影响

- 无数据回填，无跨表复制。
- `db-migrate.mjs` 以 `schema_migrations` 跳过已应用文件；`tests/db/migration-repro.test.ts` 的第二次 apply no-op 断言必须继续成立。
- 迁移**不改变**表 / 列 / 索引计数 → `EXPECTED_TABLES(12)` / `EXPECTED_ENUMS(10)` / `EXPECTED_POLICIES(11)` 保持原值（"零 schema 扩张"的机器证据）。

---

### D-10 Authorization（FR-003 / FR-013）

#### 10.1 唯一执行主体

当前目标 Family 的管理主体 = `families.created_by_person_id` 对应的 ADULT Person（Slice 1 冻结）。复用 `authorize()` 的 Case 分支与调用方已读取的 `createdByPersonId`；**不新增** Case role / RBAC / Visibility Matrix / "管理员"抽象。

#### 10.2 `authorize()` 的最小增量

| 维度 | 增量 |
|---|---|
| `Action` union | `+ 'CASE_SWITCH_PRIMARY'` |
| `REGISTERED_ACTIONS` | 同步加入（否则 `UNSUPPORTED_ACTION`） |
| `CASE_ACTIONS` | 同步加入（走 `decideCaseAction()`） |
| `decideCaseAction` 的 case 维度分支 | 现为 `action === 'CASE_READ' && case === null → CASE_CONTEXT_REQUIRED`；扩展为 `(CASE_READ 或 CASE_SWITCH_PRIMARY) && case === null` |
| 集合动作的维度分支 | `CASE_CREATE` / `CASE_LIST` 仍要求 `case === null`；**不得**把 `CASE_SWITCH_PRIMARY` 加进去 |
| 明确不做 | 不新建 `authorizeCase()`；不新增 `Purpose`；不把 `primary` 写进授权输入；不改 `MANAGER_ACTIONS` |

#### 10.3 为什么授权判定不读 Case 归属

`authorize()` 是纯函数。`caseId` 是否属于当前 Family 由两层保证：`withRlsTransaction` 设置 `app.family_id` + `cases_family_scope` RLS。`case_id` 只是待验证参数（§9）。

#### 10.4 对外错误映射（anti-enumeration）

| 情形 | 响应 |
|---|---|
| 非管理主体（Family 已解析） | `404 {"code":"CASE_NOT_FOUND","message":"Case not found"}` |
| 目标不存在 / 属于其他 Family | 同上，**响应体逐字节一致** |
| 路径 id 不是合法 UUID | 同上（**不返回 422**，与 Slice 2 的 case-id 口径一致） |
| 目标存在但 `CLOSED` / `SAFETY_HOLD` | `409`（此时 actor 已确认是管理主体，不构成枚举泄露） |
| actor 不是目标 Family 成员（含仅 guardian 关系） | Family 上下文未合法成立 → 沿用 `CURRENT_FAMILY_NOT_FOUND` / `CURRENT_FAMILY_AMBIGUOUS`，**不得**转为 `CASE_NOT_FOUND` |

**为什么 DENY 统一 404 而不是 403**：本端点是 case-scoped（路径含 `:id`），Spec §7.4 与 Q7 已冻结 404；Slice 2 的 403 `CASE_ACCESS_DENIED` 只用于 Family 级集合 / 创建端点。

**必须显式覆盖 `ERROR_MAP` 的通用映射**：`ERROR_MAP` 把 `NOT_FAMILY_MANAGER` 映射为 `403`。路由必须在 `authorize()` 返回 DENY 时就地构造 `404 CASE_NOT_FOUND`（与 `GET /cases/:id` 相同的覆盖方式），**不得**把 `NOT_FAMILY_MANAGER` 抛给通用 handler 变成 403（Spec §16.11）。

**成员关系由解析与 RLS 函数共同保证，路由不得自己加成员判定**（已现场核对 `origin/main`）：

- `resolveCurrentFamily(tx, personId)` 的 SQL 是 `families JOIN family_members ON fm.family_id = f.id WHERE fm.person_id = $1`，**只有成员关系才会产生 RESOLVED**；因此"仅有 guardian 关系、不是成员"的 actor 得到的是 `NONE`（→ `404 CURRENT_FAMILY_NOT_FOUND`）或 `AMBIGUOUS`（→ `409`），**天然满足** Acceptance 7，无需任何 Case 层分支。
- `app.set_family_context()` 在 `family_members` 无对应行时 `RAISE EXCEPTION 'FAMILY_MEMBERSHIP_REQUIRED' USING ERRCODE = '42501'`。因解析已保证成员关系，该异常在本命令中是**不可达的**；若真的出现，说明 `resolveCurrentFamily` 与 `family_members` 不一致，属真实故障 → `500`，**不得**捕获后静默改写成 404（那会把故障伪装成"资源不存在"）。
- `getFamilyById(tx, familyId)` 返回 `null` 时（正常情况下不可达），按 `authorize()` fail-closed 处理：`createdByPersonId` 缺失 → `NOT_FAMILY_MANAGER` → 覆盖为 `404 CASE_NOT_FOUND`，**不得**返回 500 或泄露 Family 信息。

---

### D-11 Safety（只消费状态谓词，不实现任何 Safety 能力）

- 读取 `cases.status` 的现有枚举值 `SAFETY_HOLD`，作为切换守卫的**双向**阻断条件（FR-005）。
- **不创建**：`safety_states`、`risk_events`、Safety service、Safety 状态机、支持资源、风险词检测、`EnterSafetyHold` / `ResolveRisk`。
- **不可绕过**：不得通过"先切走再处理"把 `SAFETY_HOLD` 的 Case 变成非主线来规避安全状态（产品 §2.1 第 6 条）。
- 谓词写成对 `status` 的确定性判定（`status === 'SAFETY_HOLD'`），绝不写常量；由 domain 单测穷举全部 6 个 status。
- 前向义务：Safety Slice 落地时该谓词自动生效；Safety Slice **不得**重写第二套主线切换守卫（Spec §13.8）。

---

### D-12 API 契约

#### 12.1 `POST /api/v1/cases/:id/switch-primary`

- 认证：`onRequest: app.authenticate`（先于 header 读取与 body 校验，保证 401 先于 422）。
- 路径 `:id` = **目标** Case；Schema 文档标注 `format: uuid`，但**不用它做校验门**；路由内先用 `UUID_PATTERN` 判定，失败直接 404。
- 请求 header：`Idempotency-Key`（必填，8—128）。
- 请求体（`strictObject`）：

```json
{
  "reason": "string(1..500，trim 后非空)",
  "expectedPrimaryCaseId": "uuid | null",
  "expectedPrimaryVersion": "integer(>=1) | null"
}
```

- 成功：`200` + `SwitchPrimaryCaseResponse`
- 错误：`401` / `404 CASE_NOT_FOUND` / `404 CURRENT_FAMILY_NOT_FOUND` / `409 CASE_ALREADY_PRIMARY` / `409 CASE_CLOSED` / `409 SAFETY_HOLD_BLOCKED` / `409 STALE_PRIMARY_VIEW` / `409 IDEMPOTENCY_PAYLOAD_MISMATCH` / `409 CURRENT_FAMILY_AMBIGUOUS` / `422 VALIDATION_ERROR` / `500 INTERNAL_ERROR`

#### 12.2 响应 schema（Spec §22 A-1 的技术选择）

```json
{
  "primary": { "id": "...", "status": "OPEN", "phase": "INTAKE",
               "primary": true, "version": 4,
               "createdAt": "...", "updatedAt": "..." },
  "previousPrimary": { "…": "同结构，或 null（晋升分支）" },
  "switchedAt": "2026-11-07T08:45:02.000Z"
}
```

- `primary` = 路径目标切换后的完整 `CaseResponse`；`previousPrimary` = 被降级的原 primary，无则 `null`。
- `switchedAt` 取目标行 `RETURNING updated_at`。
- **为什么返回两侧**：Spec §6.4.6 要求"新的 primary、原 primary（可为空）与两者提交后的 version"；同时返回降级结果让原子交换可被客户端与测试同时观测。
- **为什么不返回 `reason`**：理由由客户端提供，已在事件与审计中持久化；放进响应会让用户文本进入 `idempotency_keys.response_body` 与可能的日志面，属无收益的扩张。
- **为什么是 `200` 而非 `201`**：不创建新资源，只改变既有资源的归属标记。
- `SwitchPrimaryCaseResponse` 是**新** schema；**不修改** `CaseResponse` / `CaseListResponse`（Slice 2 冻结的 7 字段断言必须继续成立）。

#### 12.3 明确不新增的路由

`/cases/current`、`/cases/:id/primary`、`/cases/:id/pause`、`/resume`、`/close`、`/recurrences`、`/messages`、`/assessments`、`/participants`、`/scene/**`、`/problem-formulations/**`、`/evidence/**`、任何批量切换、任何第二真相源端点（FR-002 / FR-014）。

#### 12.4 OpenAPI 与生成物

- `packages/contracts/src/schemas.ts` 是代码侧**唯一**事实源；路由通过 `fastify-type-provider-zod` 声明 `schema`。
- 生成链路不变：`bun run openapi:generate` → `packages/generated/openapi.json` + `openapi.d.ts`；不得 hand-edit。
- `scripts/openapi-generate.mjs` **无需修改**（新端点在同一 `registerCaseRoutes` 内）。
- 预期生成结果：Case path 集合由 2 项变 3 项（`/api/v1/cases`、`/api/v1/cases/{id}`、`/api/v1/cases/{id}/switch-primary`）；Case operation 由 3 个变 4 个；既有 3 个 operation 的 operationId / security / tags 不变。
- `Idempotency-Key` 必须以 header parameter 出现在新 operation 上，形状与 Slice 1 的 `components.parameters.IdempotencyKey` 一致（不得另造一个内联 param）。

---

### D-13 明确不做（与 Spec §3 Non-Goals 对齐）

- 不实现 `PauseCase` / `ResumeCase` / `WaitForInformation` / `ResumeAfterInformation` / `MarkLostContact` / `UserReturned` / `CloseCase` / `CreateRecurrence`。
- 不实现任何 Phase 转换命令（`StartAssessment` / `ConfirmProblemFormulation` / `ConfirmGoal` / `ActivatePlan` / `OpenReview` / `CompleteReview` / `EnterMaintenance` …）。
- 不建立 Safety State / `risk_events` / Safety service / 风险词检测 / 支持资源。
- 不写 Outcome / Closure Reason / Referral / Case 间关联。
- 不创建 Follow-up Schedule / Task / Notification 的迁移或取消逻辑；只冻结"降级 Case 不得保留仍会继续普通推进的语义"，并在 Spec §13.7 留 Phase 4 前向义务。
- 不建立"晋升审批流"（候选评估 / 排序 / 建议 / 审批 / 投票 / 多管理员）。
- 不引入 AI：不生成理由、不推荐目标、不允许模型调用该命令、不提供 propose 通道。
- 不新增第二真相源：无 `/cases/current`、不复制 primary 到新表、不用列表排序伪装。
- 不扩展可见性：不定义孩子 / 其他成员 / Participant 切换后能看到什么。
- 不做数据权利 / 导出 / UI / 性能数字。

---

### D-14 Reconciliation With Existing Code（14 条，逐条给出增量方案）

> 前 11 条源自 Spec §16；第 12—14 条为本轮现场核对新增（Spec §16 未列举，但真实存在，漏掉即写不出可运行的实现或会误伤既有测试）。

| # | 现有事实 | 本 Slice 的精确处理 | 不得做什么 |
|---|---|---|---|
| 1 | `tests/integration/cases-scope.test.ts` 的 `FORBIDDEN_ROUTE_FRAGMENTS` 含 **14** 项，其中 `'/switch-primary'`；并断言 `roots.length === 1`、`caseBlock` 含 `/:id (GET)` | 从列表移除 `'/switch-primary'`（**只减 1 项**），新增"只允许 `POST /api/v1/cases/:id/switch-primary`"的正向断言；`printRoutes` 相关断言**重新实测后**再改（不得假设 `/:id (GET)` 渲染不变） | 删除整个守卫；把断言改成"不再检查越界"；顺手删掉其余 13 项 |
| 2 | `tests/integration/openapi-cases.test.ts` 断言 `casePaths.sort()` 恰为 2 项、operations 恰为 3 项；另有一个循环把 `switch-primary` 当作禁止片段，检查串是 `/api/v1/cases/switch-primary`（**不会**匹配新路径 `/api/v1/cases/{id}/switch-primary`） | `casePaths` 扩为 3 项、operations 扩为 4 项；把 `switch-primary` 从该禁止循环中移除并改为正向断言（保留 `current` / `pause` / `resume` / `close` / `recurrences`） | 保留一个"存在却仍被列为禁止"的自相矛盾断言；删掉其它禁止项 |
| 3 | `002_case_core.sql` 只 `GRANT SELECT, INSERT ON cases, case_events` | 新 migration 追加**列级** `GRANT UPDATE (is_primary, version, updated_at) ON cases` | 表级 `GRANT UPDATE ON cases`；修改 002 文件 |
| 4 | `tests/db/cases-schema.test.ts › CASES_COLUMNS` 对 `cases` 做 **9 列全等**断言 | 不新增任何列；理由与历史只落事件 / 审计 | 新增 `switch_reason` / `previous_primary_id` / `primary_since` / `switched_at` |
| 5 | `case_events_event_type_check` 当前仅允许 `'CASE_CREATED'` | 新 migration 扩为三值白名单 | 放宽为任意字符串 / 去掉 CHECK |
| 6 | `case_events_metadata_shape_check` 当前是**全局**"恰为 `{primary, version}`" | 改为按 `event_type` 分支；`CASE_CREATED` 分支与原定义等价 | 放宽为单一 `jsonb_typeof='object'`；删掉额外 key 的拒绝 |
| 7 | `business_audit_events_event_type_check` 现为 7 值；`resource_type` 白名单已含 `CASE` | 只加 `CASE_PRIMARY_SWITCHED`；**不动** `resource_type` CHECK | 重复添加 `CASE`；删除既有值 |
| 8 | `idempotency_keys_command_type_check` 现为 7 值 | 加 `CASE_SWITCH_PRIMARY` | 改写既有 7 值语义 |
| 9 | `authorize()` 的 `Action` / `CASE_ACTIONS` / `decideCaseAction()` | 加一个 action + 扩展 case 维度分支 | 新建 `authorizeCase()`；改 `MANAGER_ACTIONS` / `Purpose` |
| 10 | `specs/002-case-core/spec.md` 头部仍写 `Status: Draft` | **不修复**（属 Slice 2 范围） | 顺手改 Slice 2 文档 |
| 11 | `ERROR_MAP` 把 `NOT_FAMILY_MANAGER` 映射为 `403`；`GET /cases/:id` 已在路由内覆盖为 `404 CASE_NOT_FOUND` | 新路由做**同样**的覆盖 | 让 `NOT_FAMILY_MANAGER` 落到通用 403 |
| 12 | `idempotency_keys_key_representation_check`（003）强制非 `CASE_CREATE` 走 text-only | 收紧为：`CASE_SWITCH_PRIMARY` 必须 bytea-only；`CASE_CREATE` 语义不变 | 只改 `command_type` 白名单而不动这条 CHECK（会让占位 INSERT 恒失败） |
| 13 | `apps/server/api/src/routes/cases.ts`（分支）从 **body** 读 `idempotencyKey`；main 上已有 `readIdempotencyKey()` header 助手但分支未使用 | 新路由**只**用 header；G10 拦截 Slice 2 合并后仍留 body 的情形 | 继承分支的 body 传输；或在 007 内提供两套传输 |
| 14 | `tests/db/case-idempotency-representation.test.ts` 断言 `idempotency_keys_key_representation_check` **按名存在**（不比对谓词文本），且只覆盖 `FAMILY_CREATE` / `CASE_CREATE` | 本 Slice **不修改**该文件——它的断言在新 CHECK 下仍然成立；`CASE_SWITCH_PRIMARY` 的 bytea-only 覆盖放在**新文件** `tests/db/case-primary-switch-schema.test.ts` | 为了让新分支通过而放宽该文件；把新命令塞进它的 `CASE_CREATE` 用例

**必须保持绿灯且不得修改的既有测试**（它们不触碰本 Slice 的变更点，但会因实现失误而变红）：`tests/db/cases-primary-concurrency.test.ts`（`CASE_CREATE` 并发与 23505 拒绝）、`tests/db/cases-rls.test.ts`、`tests/integration/cases-create.test.ts`、`tests/integration/cases-idempotency*.test.ts`、`tests/integration/cases-rollback.test.ts`。若其中任一需要改动才能通过，说明实现越界，**停止并回到本 Plan**。

---

## Existing Contracts Reused

| 契约 | 来源 | 复用方式 |
|---|---|---|
| `families.created_by_person_id` + 管理主体语义 | Slice 1（main） | 只读 |
| `readIdempotencyKey(req)` | Slice 1（main） | 直接调用，不改 |
| `authorize()` 纯函数 + Case 分支 | Slice 2（分支） | 增量一个 action |
| `withRlsTransaction(pool, {familyId, accountId, personId, purpose}, fn)` | Slice 2（分支） | 直接复用，不改签名 |
| `app.set_family_context` / `app_family_id()` | Slice 1（main） | 只读 |
| `lockFamilyForPrimaryDecision` | Slice 2（分支） | 直接复用（同一锁顺序） |
| `cases_one_primary_open_per_family` | Slice 2（分支） | 只依赖，不重建、不弱化 |
| `idempotency_keys` + `idempotency_key_bytes` + `decideIdempotency` | Slice 1 + Slice 2 | 新增一个 command_type |
| `case_events`（append-only、复合 FK、metadata 形状约束） | Slice 2（分支） | 新增 2 个事件类型 |
| `business_audit_events` | Slice 1 + Slice 2 | 新增 1 个事件类型 |
| `errorHandler` / `toHttpError` / `ERROR_MAP` | Slice 1 + Slice 2 | 新增 4 个错误码 |
| `CaseResponse` / `CaseListResponse` | Slice 2（分支） | 只读复用，不修改 |

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
new migration files            = 1   ({N+1}_case_primary_switch.sql)
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
- **Compliance**：不采集新个人资料；事件 / 审计只存 `reason`（用户自述文本，Spec §10.5 要求保留）与 Case 标识符；不写 token / openid / 孩子原话 / 证据内容。
- **Minor policy**：执行主体恒为 ADULT 管理主体；不产生"孩子被要求确认主线"的语义。

---

## API / Contract Impact

- 新增 1 个端点契约 + 2 个 Zod schema；**不修改**既有 3 个 Case 端点语义。
- `ERROR_MAP` 新增：`CASE_ALREADY_PRIMARY: 409`、`CASE_CLOSED: 409`、`SAFETY_HOLD_BLOCKED: 409`、`STALE_PRIMARY_VIEW: 409`。
- OpenAPI 必须可由 Zod 生成且 `openapi:check` 无 drift。

---

## AI / RAG / Eval Impact

**N/A**。不调用模型、不写 prompt、不做 RAG、不产生 AI run / Memory / Follow-up（FR-009）。

## Async / Notification / Side-Effect Impact

**N/A（无外部副作用）**。纯同步事务；不 enqueue pg-boss、不发通知、不触发 AI、不创建 Schedule。

---

## Project Structure（本 Slice 会触碰的路径）

```text
specs/007-case-primary-switch/
  spec.md                              # 冻结，本 Slice 不修改
  plan.md                              # 本文件
  checklists/requirements-quality.md   # 校验清单
  tasks.md                             # 任务图

db/migrations/
  {N+1}_case_primary_switch.sql        # 新增（编号以 G8 实测为准）

packages/contracts/src/schemas.ts       # 新增 SwitchPrimaryCaseRequest / Response（不改既有）
packages/authorization/src/authorize.ts # 新增 CASE_SWITCH_PRIMARY
packages/domain/src/idempotency.ts      # 新增 CASE_SWITCH_PRIMARY 到 command type 列表
packages/domain/src/cases.ts            # 新增 repository 函数（不改既有函数语义）
packages/domain/src/case-primary-switch.ts       # 新增：纯决策函数 + payload 组装
apps/server/api/src/routes/cases.ts     # 新增 1 个 POST（不动既有 3 个）
apps/server/api/src/plugins/error-handler.ts     # 新增 4 个错误码映射

tests/domain/case-primary-switch-decision.test.ts        # 新增
tests/domain/case-primary-switch-idempotency.test.ts     # 新增（占位获取五态 + 有界重试）
tests/domain/case-primary-switch-contracts.test.ts       # 新增
tests/domain/case-primary-switch-authorization.test.ts   # 新增
tests/db/case-primary-switch-schema.test.ts              # 新增
tests/db/case-primary-switch-rls.test.ts                 # 新增
tests/db/case-primary-switch-concurrency.test.ts         # 新增
tests/integration/case-primary-switch-happy.test.ts      # 新增
tests/integration/case-primary-switch-conflicts.test.ts  # 新增
tests/integration/case-primary-switch-authorization.test.ts # 新增
tests/integration/case-primary-switch-idempotency.test.ts   # 新增
tests/integration/case-primary-switch-atomicity.test.ts     # 新增
tests/integration/case-primary-switch-scope.test.ts         # 新增
tests/integration/openapi-case-primary-switch.test.ts       # 新增

tests/integration/cases-scope.test.ts   # 精确收窄 FORBIDDEN_ROUTE_FRAGMENTS（只减 1 项）
tests/integration/openapi-cases.test.ts # 精确收窄 path / operation 集合
tests/db/roles.test.ts                  # 保留表级断言 + 新增列级正向断言
tests/db/cases-events-metadata.test.ts  # 只改用例标题，断言体保留
```

**不得触碰**：`Docs/**`、`specs/001-006/**`、`spec.md`、`db/migrations/001|002|003`、`scripts/guard-static.mjs`。

---

## Verification Plan

> 本 Plan 只定义验证路径，**不执行**任何测试。Plan 阶段所有命令均未运行，不得作为通过证据。

### V-1 FR 覆盖表（20 / 20）

| FR | 设计落点 | 主要验证 | 命令 |
|---|---|---|---|
| FR-001 | D-3 / D-4 | 唯一 primary；降级 + 升级；DB 约束兜底 | `bunx vitest run tests/integration/case-primary-switch-happy.test.ts tests/db/case-primary-switch-concurrency.test.ts` |
| FR-002 | D-12 | 仅 1 个新端点；无第二真相源 | `bunx vitest run tests/integration/case-primary-switch-scope.test.ts tests/integration/openapi-case-primary-switch.test.ts` |
| FR-003 | D-10 | manager 允许；member / 跨家庭 / guardian 拒绝 | `bunx vitest run tests/integration/case-primary-switch-authorization.test.ts` |
| FR-004 | D-4-9 / D-5 | `CLOSED` → 409 | `bunx vitest run tests/domain/case-primary-switch-decision.test.ts tests/integration/case-primary-switch-conflicts.test.ts` |
| FR-005 | D-4-9 / D-11 | 双向 `SAFETY_HOLD` 阻断 | 同上 |
| FR-006 | D-2.2 / D-13 | `status` / `phase` 零变化 | `bunx vitest run tests/integration/case-primary-switch-happy.test.ts`（前后快照比对） |
| FR-007 | D-2.3 / D-13 | 原 Case 数据不删不改 | `bunx vitest run tests/integration/case-primary-switch-happy.test.ts` |
| FR-008 | D-5 / D-9.3 | reason 必填、保留、不被覆盖 | `bunx vitest run tests/integration/case-primary-switch-happy.test.ts`（往返后两条 reason 并存） |
| FR-009 | D-13 | 无 AI 通道 | `bunx vitest run tests/integration/case-primary-switch-scope.test.ts` |
| FR-010 | D-7 | header 幂等；重放 / mismatch（HTTP 可达） | `bunx vitest run tests/integration/case-primary-switch-idempotency.test.ts tests/domain/case-primary-switch-idempotency.test.ts` |
| FR-011 | D-6 | 陈旧视图 409；两侧版本前进 | `bunx vitest run tests/integration/case-primary-switch-conflicts.test.ts` |
| FR-012 | D-2.3 / D-9.3 | 两侧事件 + 一条审计，同事务 | `bunx vitest run tests/integration/case-primary-switch-atomicity.test.ts` |
| FR-013 | D-10 | 无 Case role / RBAC | `bunx vitest run tests/domain/case-primary-switch-authorization.test.ts` |
| FR-014 | D-13 | 无越界表 / 路由 | `bunx vitest run tests/integration/case-primary-switch-scope.test.ts tests/db/migration-repro.test.ts` |
| FR-015 | D-3.5 | 唯一约束冲突 = 500 且回滚 | `bunx vitest run tests/db/case-primary-switch-concurrency.test.ts` |
| FR-016 | D-9.6 | RLS 无上下文 / 错误 Family | `bunx vitest run tests/db/case-primary-switch-rls.test.ts` |
| FR-017 | D-8 | 真实失败，无 200 伪装；422 不被 409 掩盖 | `bunx vitest run tests/integration/case-primary-switch-conflicts.test.ts` |
| FR-018 | D-2.2 / D-6 | 不补默认值 / 默认理由 | `bunx vitest run tests/domain/case-primary-switch-contracts.test.ts` |
| FR-019 | D-13 / Spec §13.7 | 不伪造 Schedule 迁移；前向义务已冻结 | `bunx vitest run tests/integration/case-primary-switch-scope.test.ts` |
| FR-020 | D-14.1 / D-14.2 | 越界守卫**精确收窄**而非删除 | `bunx vitest run tests/integration/cases-scope.test.ts tests/integration/openapi-cases.test.ts` |

### V-2 Acceptance 覆盖表（23 / 23）

| # | 场景 | 测试文件 | 关键断言 |
|---|---|---|---|
| 1 | 首次切换 | `happy` | B primary / A 非 primary；两侧 `version+1`；`status`/`phase` 不变；`GET /cases` 立即一致 |
| 2 | 往返切换 | `happy` | 回到 A primary；两条 reason 均可由事件重建 |
| 3 | 晋升（无 primary） | `happy` | `previousPrimary=null`；非 500；仍只有一个 primary |
| 4 | 读取一致 | `happy` | 列表 primary 唯一；无 `/cases/current` |
| 5 | 非管理主体 | `authorization` | 404 `CASE_NOT_FOUND`；响应体不含 status/phase/primary |
| 6 | 跨家庭 | `authorization` | 404 + 该 Family 上下文直连查询 0 行 |
| 7 | guardian 非成员 | `authorization` | `CURRENT_FAMILY_NOT_FOUND`，**不是** Case 层错误 |
| 8 | 目标不存在 / 非法 ID | `conflicts` | 统一 404，**非 422** |
| 9 | 已是 primary | `conflicts` | 409；`version` 不变；无事件 |
| 10 | 目标已关闭 | `decision` 穷举 + `conflicts` | 409；零写入；不隐式重开 |
| 11 | 当前 primary SAFETY_HOLD | `decision` 穷举 + `conflicts` | 409；零写入 |
| 12 | 目标 SAFETY_HOLD | 同上 | 409；零写入 |
| 13 | 空 / 缺 / 超长 reason / 缺视图 / 视图自相矛盾 | `conflicts` | 422；四张表零新增；**且同时存在陈旧视图时必须 422 而非 409** |
| 14 | 未声明字段 | `conflicts` | 422 零写入（含 `isPrimary` / `version` / `status` / `phase` / `familyId` / `idempotencyKey`） |
| 15 | 无副作用 | `happy` | 越界表计数为 0；两 Case 内容未改写 |
| 16 | 同 key 重放（含并发、含世界已变化） | `idempotency` | 返回原 body；事件 / 审计 / 版本计数不变 |
| 17 | 同 key 不同目标 / 不同 reason | `idempotency` | 409 mismatch；原结果不变 |
| 18 | 并发双切换（不同目标） | `concurrency` | 1 成功 + 1 `STALE_PRIMARY_VIEW`；计数 ≤ 1；无 500 |
| 19 | 并发切换与创建 | `concurrency` | 计数 ≤ 1；创建语义未变 |
| 20 | 陈旧视图 | `conflicts` | 409；零写入 |
| 21 | RLS 无上下文 | `rls` | SELECT 0 行；UPDATE 0 行；INSERT 被拒 |
| 22 | 审计原子性 | `atomicity` | 注入审计失败 → 整体回滚；`cases` 未变；无事件；无幂等快照 |
| 23 | 结构越界 | `scope` | 无越界表 / 路由；`/cases/current` 不存在；Case operation = 4；`case_events` 词汇恰为 3 值 |

### V-3 命令与期望（Implement 阶段逐条真实执行）

| 目标 | 命令 | 期望 |
|---|---|---|
| 结构与约束 | `bunx vitest run tests/db/case-primary-switch-schema.test.ts` | 5 个 CHECK 新定义存在；`cases` 仍 9 列；无新表 / 新索引 |
| 授权矩阵 | `bunx vitest run tests/domain/case-primary-switch-authorization.test.ts` | 6 条 fail-closed 分支全绿；既有 Slice 1/2 授权测试不被削弱 |
| 契约 | `bunx vitest run tests/domain/case-primary-switch-contracts.test.ts` | strict 拒绝全部未声明字段；视图六态正确 |
| 决策 | `bunx vitest run tests/domain/case-primary-switch-decision.test.ts` | 6 status × 4 视图全组合 |
| 幂等占位 | `bunx vitest run tests/domain/case-primary-switch-idempotency.test.ts` | OWNED / REPLAY / MISMATCH / POISONED / CONTENTION 五态；有界重试 ≤2 |
| 事务 | `bunx vitest run tests/integration/case-primary-switch-atomicity.test.ts` | 审计失败 → 回滚；无半条历史 |
| 并发 | `bunx vitest run tests/db/case-primary-switch-concurrency.test.ts` | `count(*) <= 1`；无 500；连跑 3 次稳定 |
| RLS | `bunx vitest run tests/db/case-primary-switch-rls.test.ts` | 无上下文 0 行 / 拒写；错误 Family 0 行 |
| 越界守卫 | `bunx vitest run tests/integration/cases-scope.test.ts` | 仍禁止 `/cases/current`、pause、resume、close、recurrences…；仅放行新端点 |
| OpenAPI | `bun run openapi:check` | PASS（no drift）；Case operation = 4；既有 3 个不变 |
| 全量回归 | `bunx vitest run` | 全绿；无 skip / expected-fail |
| 静态守卫 | `bun run guard:static` | `PASS (0 violations)` |
| 类型 | `bun run typecheck` | base + api 两个工程通过 |
| 迁移可重放 | `bun run db:migrate` ×2 | 第一次 APPLY，第二次全 SKIP |
| 迁移结构不变 | `bunx vitest run tests/db/migration-repro.test.ts` | 表 / policy / enum 计数不变 |
| 角色权限 | `bunx vitest run tests/db/roles.test.ts` | 表级 UPDATE/INSERT 断言不变；列级三列 true、其余 false |
| 治理 | `node .specify/scripts/validate-governance.mjs` | PASS；`Docs/**` diff = 0 |

**环境**：PostgreSQL 18（Stage A compose 或 CI service）；`DATABASE_URL` = app 角色；`MIGRATION_DATABASE_URL` = migrator 角色；`TEST_ADMIN_DATABASE_URL` = 测试断言用管理员连接。
**证据要求**：每条结果必须来自真实命令输出；不能运行的环境报告 `BLOCKED` / `NOT VERIFIED`。

---

## Rollback / Recovery

1. **代码回滚**：移除新增 POST 路由与两个 schema；`authorize()` 与 `cases.ts` 的回滚为纯增量（删除新增分支即可）。
2. **schema 回滚**：见 D-9.7（无表 / 列 / 索引需删除，但 5 个 CHECK 与 1 条 GRANT 需还原，且必须先判定是否已有新词汇数据）。
3. **数据**：前进方向无回填；回滚**不等于**无数据影响——一旦产生 `CASE_PRIMARY_*` / `CASE_SWITCH_PRIMARY` 行，还原 CHECK 会失败，必须另立 data disposition。
4. **不自动执行**：任何 down 步骤必须人工 review。

---

## Complexity Exceptions

**无。** 全部约束均可在已批准的 V1 技术栈与 Slice 1 / 2 基础设施内满足。

---

## Frozen Technical Decisions

Implement AI **不得**临场重新选择。变更必须返回 Plan Review 并重跑审计一。

| # | 冻结选择 | 理由 | 变更条件 |
|---|---|---|---|
| **R-1** | 端点 `POST /api/v1/cases/:id/switch-primary`，`:id` 是目标；成功 `200` | §28.3 冻结路径；不新建资源故非 201 | 上游契约变更 |
| **R-2** | 幂等识别（REPLAY / MISMATCH）在**授权之后、任何状态判定之前**；授权先于幂等 | Spec §6.3A 三条硬约束；否则重放会被误判为状态冲突 | §9.1 语义变更 |
| **R-3** | 视图 = `expectedPrimaryCaseId` + `expectedPrimaryVersion`，二者必填可 null，且 null 必须成对 | 只给 id 拦不住 `A→B→A` | §8.6 放宽 |
| **R-4** | 先降级后升级 | partial unique index 非延迟，反向恒失败 | 索引改 DEFERRABLE（禁止） |
| **R-5** | `version` 在 SQL 内 `= version + 1` | 避免读-改-写丢失并发 | 无 |
| **R-6** | 事件词汇 `CASE_PRIMARY_ASSIGNED` / `CASE_PRIMARY_REVOKED`；审计 `CASE_PRIMARY_SWITCHED` | 与 `CASE_CREATED` 命名一致；不暗示状态机 | 需要与 Slice 2 词汇表对齐时 |
| **R-7** | `cases` 只授**列级** `UPDATE (is_primary, version, updated_at)` | 保持 append-only 意图与 FR-006 | 无（禁止升级为表级） |
| **R-8** | `metadata` 形状 CHECK **逐 event_type 分支**，不放宽为任意 jsonb | 保留"不得写正文 / PII"的可执行不变量 | 无 |
| **R-9** | 响应 `primary` + `previousPrimary` + `switchedAt`，不返回 `reason`；`switchedAt` 取 `RETURNING updated_at` | 可观测的原子交换；避免用户文本进入幂等快照 | 契约评审 |
| **R-10** | `SAFETY_HOLD` / `CLOSED` 谓词只做 domain 穷举测试，不伪造 `status` | Spec Q3a 明文要求 | Safety / Closure Slice 落地后改为真实前置 |
| **R-11** | 幂等键**只走 `Idempotency-Key` header**（`readIdempotencyKey`），body 禁止出现 `idempotencyKey` | Spec §9.1.2 / §17.3 / FR-010；Slice 1 已冻结 | 上游合同变更（不允许） |
| **R-12** | UUID（路径 `:id` 与 `expectedPrimaryCaseId`）在比较与进 hash 前统一小写化 | PostgreSQL uuid 输出小写；不归一会把合法重试误判为 mismatch / 陈旧 | 无 |
| **R-13** | `CASE_SWITCH_PRIMARY` 幂等行**只允许 bytea**（`idempotency_key` 为 NULL），`legacyKeyText` 传 `null` | 该命令无 pre-003 历史；结构上排除 text-only 行即可证明无需回退 | 无 |
| **R-14** | 占位获取有界重试 **≤2**，耗尽 → `CONTENTION` → 500 | `ON CONFLICT DO NOTHING` 在对端回滚后不留行，必须重试一次；上限防止死循环 | 无 |
| **R-15** | `reason` **不做 trim / 截断变换**；校验"原始长度 ≤500 且 trim 后非空"，存原值，hash 用原值 | 保证 hash ↔ 存储值一一对应；避免 API 与 DB 长度口径漂移 | 上游给出口径 |
| **R-16** | 不调用 `runIdempotentCommand()` / `lockIdempotencyKey()`；事务由 `withRlsTransaction` 唯一持有 | 该编排器自持事务且无 family 上下文，嵌入会拆开事务边界 | Slice 1 编排器改造（不在本 Slice） |

---

## Change Reconciliation（Round 2 — 相对上一版 Plan 的实质修正）

> 本节存在的意义：让审计一和后续开发 AI 能看出"哪些旧结论被推翻、为什么"，而不是在两个版本之间猜。

| # | 旧结论（`69cfe6f` 版 Plan） | 本轮实测 / 冻结 Spec | 处理 |
|---|---|---|---|
| 1 | 本轮起点 Head `69cfe6f`；Slice 2 = `9ac76f7e`，38 ahead / 4 behind | Head `00db327`；Slice 2 = `fb30f28`，**41 ahead / 4 behind** | 修正 §0.1；Spec 里的 `f9a454b` 也是更早的快照，以真实值为准 |
| 2 | **`idempotencyKey` 为 JSON body 必填字段**，不新增 header 机制 | Spec §9.1.2 / §17.3 / FR-010：**必须**用 `Idempotency-Key` header；main 上 `readIdempotencyKey()` 已存在 | **推翻**旧结论；D-7.2 / R-11 重写；Tasks 全量替换 body 断言 |
| 3 | D-4 直接"幂等 lookup → reserve → 锁"但未说明编排位置 | `runIdempotentCommand` 自持事务且无 family 上下文，无法嵌入 `withRlsTransaction` | 新增 D-7.6 / R-16；明确只复用三个 domain 函数 |
| 4 | 占位冲突后"重新 lookup → REPLAY / MISMATCH"（无 null 分支） | `ON CONFLICT DO NOTHING` 在对端回滚后返回 0 行且无行可查 | 新增 D-7.5 有界重试 + `CONTENTION` / `POISONED` |
| 5 | D-9.2 标题写"5 处"，表内实际 6 行 | 5 个 CHECK + 1 条 GRANT = 6 | 统一为 6 |
| 6 | `legacyKeyText` 沿用 `isLegacyTextLookupSafe()` | 该命令无历史行；allow text-only 会留下歧义 | R-13 + D-9.4 收紧为 bytea-only |
| 7 | D-9.5 对 `has_table_privilege` 是否返回 true 持"两种都记录"的开放态度 | 列级授权下 `has_table_privilege` 为 false 是 PostgreSQL 的确定语义 | 改为"断言必须保持 false；若为 true 则 migration 写错" |
| 8 | Project Structure 未列 `case-primary-switch-scope.test.ts`，但 V-1 / V-2 多次引用 | 内部不一致 | 补齐文件清单 |
| 9 | Tasks T775 引用 `scripts/guard-static.mjs` 的 `FORIDDEN_TABLE_PATTERNS`（不存在） | 真实常量是 `FORBIDDEN_PATHS` + `db/` 扫描的 `R6-scope-guard` 规则 | 改为真实名称 |
| 10 | 未覆盖 Spec §16 之外的 `idempotency_keys_key_representation_check` 来源 | 该 CHECK 在 `003` 中真实存在，Spec §16 未列举 | D-14.12 记为第 12 条 |
| 11 | 未说明 `Docs/V1技术设计.md` §29.4 把 Authorization 列在第 5 步，而 Spec §6.3A 把它放在锁之前 | §29.4 是**前置清单**（六条全要满足），不是求值顺序；Spec §6.3A 已冻结运行时顺序 | 新增 REC-05（见下）|

**REC-05（新增的语义说明）**：`Docs/V1技术设计.md` §29.4 的第 1—6 条是**前置条件清单**，其编号不构成运行时求值顺序；Spec §6.3 亦明文"编号也不是事务步骤顺序"。本 Plan 按 §6.3A 把授权放在锁与状态判定之前，理由是：若先判安全状态再判授权，一个非管理主体会收到 `409 SAFETY_HOLD_BLOCKED`，从而推断出自己无权管理的 Case 的安全状态——直接违反 V1-C21 与 Spec §7.4 的 anti-enumeration 要求。§29.4 的六条前置在本 Plan 中**全部**被满足，一条未减。

---

## Blockers

**NONE（无产品级 / 语义级阻断）。**

唯一阻断是**程序性**的：

```text
IMPLEMENT BLOCKED BY:
Slice 2 (specs/002-case-core) 尚未完成审计二 PASS 并 merge main
```

补充事实（不是推断）：

1. `origin/main` = `ee9d07e`，`db/migrations/` 只有 `001_initial_schema.sql`；`cases` / `case_events` / `CASE_CREATE` / 唯一索引均不在 main。
2. `origin/feat/002-case-core` = `fb30f28`，相对 main **41 ahead / 4 behind**。落后的 4 个提交是 Slice 1 final remediation（`af6bb0c`、`0480e38`、`95cd47b`、`ee9d07e`）。
3. 该分支仍是 pre-reconciliation 形状：Case 路由从 body 读 `idempotencyKey`。这使 **G10（单一幂等传输）** 在 Slice 2 合并后可能仍然失败——那不是 007 的缺陷，但会继续阻断 007。
4. 因此"Slice 2 merge main"不是空操作：它必须自己完成 merge、重跑 gate 与全量测试。007 **不得**代替 Slice 2 做这件事，也**不得**在旧分支上假装依赖已满足。

**Late E2E dependency（不阻断核心开发，但阻断最终端到端收口，Spec §14.4）**

- V1-C29 的 U01—U20 完整旅程（切换只是其中一段）。
- V1-C18 的暂停 / 恢复验收（属后续状态 Slice + Phase 4）。
- Phase 4 的 Schedule / Notification（Spec §13.7 前向义务）。
- Phase 5 的数据权利与导出（切换历史是否进入导出由该 Slice 决定）。

这四项**不构成本 Slice 的 Implement 阻断**，但不得在 T786 的完成报告里被写成"已验证"。

---

## 审计一 — 开发前计划审计（Audit 1）

> 本轮由计划 AI 2 执行。撰写与审计在时间上分开：Plan / Checklist / Tasks 全部落盘后，**重新从冻结 Spec 出发**逐层核对，不复用撰写时的结论。

### A. Spec → Plan

| 检查项 | 结论 | 证据 |
|---|---|---|
| 语义漂移 | 无 | 20 条 FR 均落到 D-1—D-14 的具体段落；未新增 Spec 之外的能力 |
| 漏项 | 无 | §6.3 的 10 条前置、§6.3A 的 12 步顺序、§6.4 的 6 条效果、§6.5 的 5 条后置不变量、§7 的 7 条授权/可见性、§9 的三节、§10 的 6 条可审计性均有落点 |
| 新增未经批准能力 | 无 | 无 pause / resume / close / recurrence / PF / participant / evidence / safety 实现 |
| 错误依赖 | 无 | 只依赖 Slice 1（已合并）+ Slice 2（分支）；无 Slice 3/4/005/006 依赖 |
| 技术选择在 Spec §22 授权内 | 是 | A-1 → D-12；A-2（500）→ D-9.3；A-3 → D-6；A-4 → D-2.3。传输不属 A 类，由 §9.1.2 直接冻结 |
| 与 Docs 一致 | 一致（含 REC-05 的显式说明） | §29.4 六条前置在 D-4 中逐条满足；§8.6 / §8.5 / §8.1 / §9.1 均有对应段 |
| 是否偷改产品语义 | 否 | 未修改 `spec.md`；未把"重新分诊"并入本命令（Q12） |

### B. Plan → Checklist → Tasks

| 检查项 | 结论 | 证据 |
|---|---|---|
| 每个设计决策都有可执行 Task | 是 | D-1—D-14 与 R-1—R-16 在 `tasks.md` 的 Phase 0—12 中均有对应任务（映射见 tasks.md §Coverage Map）|
| Task 六元组完整 | 是 | 每条含 Task ID / REQ / 目标 / 文件 / 依赖 / VERIFY |
| 不可执行措辞 | 0 | 全文无"完善一下 / 视情况 / 必要时"类表述 |
| 测试先于实现 | 是 | Phase 2（RED）先于 Phase 3—9（实现）；依赖图无前向边 |
| 循环依赖 | 无 | 依赖边全部满足 `依赖 id < 任务 id`；图为 DAG |
| 引用不存在的文件 / 常量 | 0 | 已核对 `guard-static.mjs` 真实常量名、`readIdempotencyKey` 真实位置、13 个测试文件均在 Project Structure 中 |

### C. FR / Acceptance 覆盖

| 维度 | 结果 |
|---|---|
| FR 覆盖 | **20 / 20**（V-1 逐条有设计落点 + 测试文件 + 命令） |
| Acceptance 覆盖 | **23 / 23**（V-2 逐条有测试文件 + 关键断言） |
| Success Criteria | 6 / 6（SC-1→V-2 #1/#2；SC-2→#15；SC-3→#5—#14/#20；SC-4→#1/#2/#22；SC-5→#18/#19/#22；SC-6→Spec §13 + R-* 冻结项） |
| 仅靠"设计已存在"代替测试的 FR | 0 |
| 用 domain 穷举代替 DB 前置的项 | Acceptance 10—12，按 Spec Q3a 明确标注，未伪造 `status` |

### D. 并发专项

| 检查项 | 结论 | 证据 |
|---|---|---|
| switch vs switch（不同目标） | 收敛且可断言 | L1 串行 → 后者在 L2 看到新 primary → 视图不匹配 → 409 `STALE_PRIMARY_VIEW` |
| switch vs switch（同目标） | 收敛且可断言 | 后者命中 `CASE_ALREADY_PRIMARY`（早于视图比对） |
| switch vs create | 收敛 | 两者共用 ② Family 锁；create 只看 `EXISTS`，不持 Case 锁 |
| same key concurrent | 收敛 | 唯一索引占位先于状态读取；后者阻塞后走 REPLAY |
| stale view | 可拦截 | 视图 = (id, version)；`A→B→A` 亦被拦 |
| database uniqueness | 当最后防线，不当兜底 | 出现即 500 + 回滚；并发测试断言无 500 |
| lock ordering | 无环 | ①→②→③ 全序；③ 内部 `ORDER BY id ASC`；D-3.4 逐条排除 |
| 是否只写"数据库会处理" | 否 | D-3.2 逐层列职责，D-3.4 逐项列证 |

### E. Negative Space

`PauseCase` / `ResumeCase` / `CloseCase` / `CreateRecurrence` / Problem Formulation / Evidence writer / Participant / Safety runtime / AI / Notification / Plan / Task / `/cases/current` / 第二套审计 / 第二套幂等 / 第二套授权 —— 全部在 D-13 明确排除，并在 tasks.md 的 scope 守卫任务中以**断言不存在**的形式落地。

### F. Dependency Honesty

| 检查项 | 结论 |
|---|---|
| 是否错误宣布 READY FOR IMPLEMENTATION | 否；结论为 `PLAN FROZEN` + `IMPLEMENT BLOCKED` |
| 是否掩盖 Slice 2 落后 main 4 个提交 | 否；§0.1 与 `## Blockers` 明确记录 |
| 是否把"分支存在"当作"依赖已满足" | 否；§0.2 显式区分 |
| 是否把 Implement blocker 误写成 Planning blocker | 否；`## Blockers` 写 `NONE`，`Implement Blockers` 单列 |
| 是否依赖不存在的 runtime | 否；D-14 明确哪些在 main、哪些在分支 |

### 审计一结论

```text
PLAN / CHECKLIST / TASKS FINAL PASS
AUDIT 1 FINAL PASS
PLAN FROZEN

IMPLEMENT BLOCKED BY:
Slice 2 审计二 PASS + merge main
```

**未解决计划问题：0。**
