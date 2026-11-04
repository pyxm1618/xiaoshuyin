# Data Model — 002-case-core

**Feature**: `specs/002-case-core/spec.md`
**阶段**: Phase 1（Plan）
**权威来源**: `Docs/V1技术设计.md` §7.0 / §7.2 / §7.8 / §7.9 / §8.1 / §8.5 / §9.1；列级实现由本 Plan 决定。
**边界**: 本文只描述本 Slice 真正需要的表与约束；不建 Participant、Evidence、Problem Formulation、Safety、Plan、Task、Notification、AI、Memory。

> 本文不是 migration。正式变更只能通过 `db/migrations/<next-after-slice1-final>_case_core.sql` 的 reviewed migration 进入环境。
> 不修改 `db/migrations/001_initial_schema.sql`。

---

## 1. 新增 enum

### `case_status`（严格照 §6.1，顺序不可重排）

```text
OPEN
WAITING
PAUSED
LOST_CONTACT
SAFETY_HOLD
CLOSED
```

### `case_phase`（严格照 §6.2，顺序不可重排）

```text
INTAKE
ASSESSMENT
PROBLEM_FORMULATION
GOALS
PLANNING
EXECUTION
REVIEW
MAINTENANCE
CLOSED
```

**说明**
- 数据库承载完整词汇，是为了让未来正式转换命令无需重建类型；**本 Slice 没有任何可达路径**写入 `OPEN + INTAKE` 之外的值。
- status 与 phase 是两个独立 enum，不得合并成组合枚举，也不得互相推导。
- `xiaoshuyin_app` 需要两个类型的 `USAGE` 授权。

---

## 2. `cases`

### 2.1 列

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT uuidv7()` | 系统生成；创建后不可变 |
| `family_id` | `uuid` | `NOT NULL`，FK → `families(id)` `ON DELETE RESTRICT` | Family 归属；创建后不可迁移 |
| `created_by_person_id` | `uuid` | `NOT NULL`，FK → `persons(id)` `ON DELETE RESTRICT` | 来自已验证 actor；客户端不可指定 |
| `status` | `case_status` | `NOT NULL` | 本 Slice 只写 `OPEN` |
| `phase` | `case_phase` | `NOT NULL` | 本 Slice 只写 `INTAKE` |
| `is_primary` | `boolean` | `NOT NULL` | DB 列名避开 SQL 保留字 `primary`；API 暴露为 `primary` |
| `version` | `integer` | `NOT NULL`，`CHECK (version >= 1)` | 初始 `1`；本 Slice 只读 |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | 服务端时间 |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | 创建时等于 `created_at`；本 Slice 无更新路径 |

**为什么 status / phase 不给默认值**：应用必须显式写入 `OPEN + INTAKE`。若给数据库默认值，遗漏写入的代码仍会“成功”，不利于 fail-closed；显式写入让漏写直接失败。

### 2.2 约束与索引

| 名称 | 形式 | 目的 |
|---|---|---|
| `cases_pkey` | `PRIMARY KEY (id)` | 主键 |
| `cases_id_family_key` | `UNIQUE (id, family_id)` | 供 `case_events` 复合 FK 引用 |
| `cases_one_primary_open_per_family` | `UNIQUE INDEX (family_id) WHERE is_primary AND status <> 'CLOSED'` | **单 primary 数据库不变量**（§8.1） |
| `cases_family_list_idx` | `INDEX (family_id, is_primary DESC, created_at ASC)` | 列表排序 |
| `cases_family_status_idx` | `INDEX (family_id, status)` | 未来状态筛选 / 存在性判定辅助 |
| `cases_version_check` | `CHECK (version >= 1)` | 版本基线 |
| `cases_family_fk` | `FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE RESTRICT` | 归属完整性 |
| `cases_creator_fk` | `FOREIGN KEY (created_by_person_id) REFERENCES persons(id) ON DELETE RESTRICT` | 创建者完整性 |

### 2.3 明确不存在的列（结构断言）

`title`、`summary`、`description`、`problem_description`、`problem_summary`、任何 evidence-like 自由文本、`visibility`、`case_role`、`participant_id`、`deleted_at`（本 Slice 无删除路径）。

**测试要求**：`information_schema.columns` / `pg_attribute` 断言这些列不存在。

---

## 3. `case_events`

### 3.1 列

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT uuidv7()` | |
| `family_id` | `uuid` | `NOT NULL` | 与 Case 一致的 Family 作用域 |
| `case_id` | `uuid` | `NOT NULL` | 引用真实 Case |
| `actor_account_id` | `uuid` | `NOT NULL`，FK → `accounts(id)` `ON DELETE RESTRICT` | 发起 actor（与 `business_audit_events` 一致；§8.5 的 actor 为 Account） |
| `event_type` | `text` | `NOT NULL`，`CHECK (event_type IN ('CASE_CREATED'))` | 本 Slice 封闭事件集合 |
| `metadata` | `jsonb` | `NOT NULL DEFAULT '{}'` | 只允许 `{ "primary": boolean, "version": integer }`；不含正文 / PII |
| `occurred_at` | `timestamptz` | `NOT NULL DEFAULT now()` | 服务端时间 |

### 3.2 约束与索引

| 名称 | 形式 | 目的 |
|---|---|---|
| `case_events_case_family_fk` | `FOREIGN KEY (case_id, family_id) REFERENCES cases (id, family_id) ON DELETE RESTRICT` | **事件不得跨 Family 挂到 Case** |
| `case_events_actor_fk` | `FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE RESTRICT` | actor 完整性 |
| `case_events_case_time_idx` | `INDEX (case_id, occurred_at ASC)` | 按 Case 追溯领域历史 |
| `case_events_family_time_idx` | `INDEX (family_id, occurred_at ASC)` | 家庭作用域审计 |

### 3.3 append-only

- `xiaoshuyin_app` 只授予 `SELECT, INSERT`；**不授予 `UPDATE, DELETE`**。
- 不新增 trigger；权限层已阻断 runtime 修改。
- 不得通过覆盖或删除历史事件伪造当前状态（§7.8）。
- 事件只服务真实写动作；读取不写事件（D7）。

### 3.4 明确不存在的事件

`CASE_VIEWED`、`CASE_LISTED`、`CASE_ACCESSED` 等 read-audit 事件类型不定义、不写入。本 Slice 也不存在任何访问日志表。

---

## 4. `business_audit_events`（既有表，最小增量）

### 4.1 不新增列

沿用 Slice 1 结构：`id` / `family_id` / `actor_account_id` / `event_type` / `resource_type` / `resource_id` / `metadata` / `occurred_at`。

### 4.2 增量取值

| 维度 | 新增值 |
|---|---|
| `event_type` | `CASE_CREATED` |
| `resource_type` | `CASE` |

`resource_id` = 新建 Case 的 `id`。
`metadata` = `{ "primary": boolean, "version": integer }`（与 `case_events` 一致，便于审计关联）。

### 4.3 扩展方式

- 既有 `event_type` / `resource_type` 是内联匿名 CHECK。
- 新 migration 用 `DROP CONSTRAINT` + `ADD CONSTRAINT` 扩展白名单。
- 实现前读取 `pg_constraint` 确认真实约束名（默认预期为 `business_audit_events_event_type_check` / `business_audit_events_resource_type_check`，但不得假设）。
- 不修改 001 migration。

### 4.4 职责边界

`business_audit_events` 是跨资源业务审计，**不是** Case 领域历史，也**不是** access log。
不复制第二套 audit platform；不为 GET 写审计（D7）。

---

## 5. `idempotency_keys`（既有表，最小增量）

### 5.1 不新增列

沿用 Slice 1 结构：
`id` / `actor_account_id` / `command_type` / `idempotency_key` / `request_hash` / `response_status` / `response_body` / `created_at`，
唯一键 `UNIQUE (actor_account_id, command_type, idempotency_key)`。

### 5.2 增量取值

| 维度 | 新增值 |
|---|---|
| `command_type` | `CASE_CREATE` |

### 5.3 使用约束

- 同一张表；**不新建第二张幂等表**。
- 所有 lookup / 占位 / 回填 / replay 都在 `withRlsTransaction` 内执行；该表 RLS 为 `actor_account_id = app_account_id()`（Slice 1），无 identity 上下文时 0 行 / 拒写。
- 占位：首次插入使用 `response_status = 0`、`response_body = '{}'`，同一事务内回填真实响应。
- `request_hash` 组成见 `research.md` R-4：`{ familyId, body }`。`familyId` 是服务端已验证的 canonical command context，不是客户端提交字段（客户端提交 → 422）。
- 相同 key + 相同 hash → 返回原 `response_status` / `response_body`；相同 key + 不同 hash → `MISMATCH` → 409 `IDEMPOTENCY_PAYLOAD_MISMATCH`。
- 当前 public 请求体只有 `idempotencyKey`，`body` 恒为 `{}`，因此 HTTP 层不存在第二种合法 business payload；mismatch 分支在 shared idempotency domain / repository contract 层验证，不在 HTTP 层伪造。

### 5.4 扩展方式

- `command_type` 为内联匿名 CHECK；用 reviewed migration `DROP CONSTRAINT` + `ADD CONSTRAINT` 扩展。
- 实现前读取 `pg_constraint` 确认真实约束名（默认预期 `idempotency_keys_command_type_check`）。

---

## 6. RLS 与授权

### 6.1 表级

| 表 | `ENABLE ROW LEVEL SECURITY` | `FORCE ROW LEVEL SECURITY` |
|---|---|---|
| `cases` | 是 | 是 |
| `case_events` | 是 | 是 |

### 6.2 Policy

| 表 | Policy | `USING` | `WITH CHECK` |
|---|---|---|---|
| `cases` | `cases_family_scope` | `family_id = app_family_id()` | `family_id = app_family_id()` |
| `case_events` | `case_events_family_scope` | `family_id = app_family_id()` | `family_id = app_family_id()` |

### 6.3 行为

| 情形 | 结果 |
|---|---|
| 无 `app.family_id` 上下文 | 谓词求值 NULL → SELECT 0 行；INSERT 被拒 |
| `app.family_id` 指向 Family A，查询 Family B 的 Case | 0 行 |
| `app.family_id` 指向 Family A，插入 `family_id = B` 的事件 | 被 `WITH CHECK` 拒绝；即使绕过，复合 FK 也会拒绝 |
| 运行角色 `xiaoshuyin_app` | 非 owner、`NOBYPASSRLS` |

**RLS 不做的事**：不判 manager、不判 participant、不判 purpose 矩阵、不写 Case role / Visibility Matrix。

### 6.4 GRANT

| 对象 | `xiaoshuyin_app` 权限 |
|---|---|
| `cases` | `SELECT, INSERT`（本 Slice 无 UPDATE/DELETE 路径） |
| `case_events` | `SELECT, INSERT`（append-only） |
| `case_status` / `case_phase` | `USAGE` |

> 最小授权原则：本 Slice 没有修改 Case 的命令，因此不授予 `UPDATE`。未来 `switch-primary` / 状态转换 Slice 通过新的 reviewed migration 显式授权并审计。

---

## 7. 关系图

```text
persons 1 ──── *    families           (families.created_by_person_id, UNIQUE)
persons 1 ──── *    family_members     (UNIQUE(family_id, person_id))
families 1 ──── *    cases              (cases.family_id)
persons 1 ──── *    cases              (cases.created_by_person_id)
cases 1 ──── *    case_events          ((case_id, family_id) → cases(id, family_id))
families 1 ──── *    business_audit_events  (既有)
accounts 1 ──── *    idempotency_keys       (既有)
```

**基数与不变量**
- 一个 Family → 多个 Case；一个 Case 只属于一个 Family。
- 一个 Family → **最多一个** `is_primary AND status <> 'CLOSED'` 的 Case。
- 一个 Case → 至少一条 `CASE_CREATED` 事件（创建事务内写入）。
- 一个 Case 创建 → 恰好一条 `business_audit_events` `CASE_CREATED`。
- 一次成功创建 → 恰好一条 `idempotency_keys`（同 key 重放不新增）。

---

## 8. 本 Slice 明确不存在的对象（结构断言清单）

表：
`case_participants`、`participation_invites`、`assertions`、`observations`、`dialogue_messages`、`problem_formulations`、`scene_node_states`、`scene_artifacts`、`safety_states`、`goals`、`intervention_instances`、`plan_versions`、`tasks`、`checkins`、`reviews`、`case_followup_schedules`、`notifications`、`notification_attempts`、`ai_runs`、`memory_*`、`data_requests`。

enum / 事件 / 审计 / 命令：
- 无 Case Status / Phase 转换命令、无 `SAFETY_HOLD` 写入路径。
- 无 `CASE_VIEWED` / `CASE_LISTED` 等 read-audit 事件。
- 无 Case role / Permission DSL / Visibility Matrix 表或列。

路由：
- 无 `/api/v1/cases/current`、`pause`、`resume`、`switch-primary`、`close`、`recurrences`、`messages`、`assessments`、`participants`、`scene`、`problem-formulations`。

**测试要求**：结构 introspection + 路由枚举断言必须输出真实结果，不能只写“设计上不存在”。

---

## 9. 事务内数据写入顺序（摘要）

```text
idempotency 占位
→ families 行锁
→ cases 存在性判定
→ cases INSERT
→ case_events INSERT
→ business_audit_events INSERT
→ idempotency 回填
→ COMMIT
```

任一写入失败 → 整个事务回滚，不允许部分成功。
读取路径只 SELECT `cases`，不写 `case_events` / `business_audit_events`。

---

## 10. Migration 内容清单（不含序号）

按此顺序写入新的 reviewed migration：

1. `CREATE TYPE case_status`
2. `CREATE TYPE case_phase`
3. `CREATE TABLE cases`（含列 CHECK、FK）
4. `CREATE UNIQUE INDEX cases_one_primary_open_per_family`
5. `CREATE UNIQUE INDEX cases_id_family_key`（或 UNIQUE 约束）
6. `CREATE TABLE case_events`（含复合 FK、事件类型 CHECK）
7. `CREATE INDEX`：列表、Case 时间线、Family 时间线
8. `ALTER TABLE cases ENABLE/FORCE ROW LEVEL SECURITY` + policy
9. `ALTER TABLE case_events ENABLE/FORCE ROW LEVEL SECURITY` + policy
10. `GRANT`：`cases` / `case_events` 的 `SELECT, INSERT`；enum `USAGE`
11. 扩展 `business_audit_events.event_type` / `resource_type` CHECK
12. 扩展 `idempotency_keys.command_type` CHECK

**禁止**
- 修改 `001_initial_schema.sql`
- `drizzle-kit push`
- 在 migration 中写业务数据或回填
- 建第二张幂等表 / 第二套审计表
- 为未来对象建“空表 / 占位索引 / 预留列”