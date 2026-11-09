# Contract — Case Events & Business Audit

**Feature**: `specs/002-case-core/spec.md`
**阶段**: Plan（Phase 1）
**权威**: `Docs/V1技术设计.md` §7.8（`case_events` 领域历史）、§7.9（`business_audit_events` 审计）、§8.5（actor）、§38 Phase 1。
**Owner Decisions**: D7（本 Slice 不实现 Case read audit）。

---

## 1. 职责区别（不可合并）

| 维度 | `case_events` | `business_audit_events` |
|---|---|---|
| 语义 | Case 的**领域历史** | **业务审计**：谁在何时对哪个资源做了什么 |
| 作用域 | `(family_id, case_id)` | `(family_id, resource_type, resource_id)` |
| 生命周期 | 随 Case 长期保留；append-only | 长期追加审计 |
| 消费方（未来） | Case 时间线、状态/阶段演化追溯、依赖传播 | 运营 / 合规审计、跨资源检索 |
| 本 Slice 对外读取 | 无 | 无 |
| 是否 access log | 否 | 否 |
| 是否可覆盖 / 删除 | 否 | 否（追加） |

**为什么不合并**
- §7.8 与 §7.9 定义了两种不同语义；合并会让一方牺牲定位。
- 业务审计需要统一 `resource_type`；领域事件需要 Case 复合外键与稳定 Case 时间线。
- 新建第三张「case audit」表等于复制第二套 audit platform，被 spec 明确禁止。

**为什么同一事务写两张表**
- 防止「Case 已存在但无创建证据」的中间状态（FR-014 / SC-007）。
- 两张表任一写入失败 → 整个 Case 创建事务回滚。

---

## 2. `case_events` 契约

### 2.1 行语义（本 Slice 唯一事件）

| 字段 | 值 |
|---|---|
| `event_type` | `CASE_CREATED` |
| `family_id` | 当前目标 Family（服务端上下文，客户端不可指定） |
| `case_id` | 新建 Case 的 id |
| `actor_account_id` | 已验证 actor 的 account |
| `metadata` | `{ "primary": <boolean>, "version": <integer> }`（DB CHECK 强制 key 集合恰为 `primary` / `version`） |
| `occurred_at` | 服务端事务时间 |

**`metadata` 形状不变量**：`case_events_metadata_shape_check` 要求 JSON object 且 key 集合**恰好**为 `{primary, version}`；`primary` 为 boolean，`version` 为 integer-compatible number 且 `>= 1`；`metadata` 无默认值。任何额外 key、正文、用户输入或 PII 都会在数据库层被拒绝，而不是只靠应用约定。

### 2.2 禁止内容

- 不保存 title / summary / description / problem_description / 任何 evidence-like 文本。
- 不保存孩子原话、聊天内容、证据引用。
- 不保存访问日志（`CASE_VIEWED` / `CASE_LISTED` 不存在）。
- 不预造未来状态机事件的 payload（pause / resume / close / switch-primary 等）。
- 不记录「读取」这一动作。

### 2.3 append-only

- runtime 只有 `SELECT, INSERT`；无 `UPDATE, DELETE`。
- 不得通过覆盖 / 删除历史事件伪造当前状态。
- 未来若需要修正，只能追加新事件类型（reviewed migration），不得改写旧行。

### 2.4 作用域不变量

- 复合 FK `(case_id, family_id) → cases(id, family_id)`：事件必须与 Case 同 Family。
- RLS `family_id = app_family_id()`：无上下文 0 行；跨 Family 0 行 / 拒写。
- 不能存在「事件有、Case 无」的状态（FK 保证）。

---

## 3. `business_audit_events` 增量契约

### 3.1 行语义

| 字段 | 值 |
|---|---|
| `event_type` | `CASE_CREATED` |
| `resource_type` | `CASE` |
| `resource_id` | 新建 Case 的 id |
| `family_id` | 当前目标 Family |
| `actor_account_id` | 已验证 actor 的 account |
| `metadata` | `{ "primary": <boolean>, "version": <integer> }` |
| `occurred_at` | 服务端事务时间 |

### 3.2 不增量

- 不新增列。
- 不新增第二套审计表 / 审计平台。
- 不为 GET / list / detail 写审计（D7）。
- 不记录 Case 内容字段或 PII。

### 3.3 扩展方式

- `event_type` / `resource_type` 的 CHECK 白名单通过 reviewed migration `DROP CONSTRAINT` + `ADD CONSTRAINT` 扩展。
- 实现前读取 `pg_constraint` 确认真实约束名。
- 不修改 001 migration。

---

## 4. 幂等重放与并发

| 场景 | `case_events` | `business_audit_events` |
|---|---|---|
| 首次创建成功 | +1 行 `CASE_CREATED` | +1 行 `CASE_CREATED` |
| 同 key 同 payload 重放 | 不增加 | 不增加 |
| MISMATCH（shared contract；当前 CASE_CREATE 请求体形状下 HTTP 不可达） | 不增加 | 不增加 |
| 业务事务失败 | 回滚，不留下 | 回滚，不留下 |
| 并发两个不同 key | 各 +1 行；对应两个不同 Case | 各 +1 行 |
| GET / list / detail | 不增加（D7） | 不增加（D7） |

**证据要求**：读取前后对两表执行 `count(*)`，断言行数不变；创建后按 `resource_id` / `case_id` 断言各恰好 1 行；并断言 `case_events.metadata` key 集合恰为 `{primary, version}`，直接 DB 写入额外 key / 正文 / PII 被 `case_events_metadata_shape_check` 拒绝。

---

## 5. 与 Case 创建事务的关系

```text
INSERT cases
→ INSERT case_events(CASE_CREATED)
→ INSERT business_audit_events(CASE_CREATED, CASE)
→ UPDATE idempotency 回填
→ COMMIT
```

- 顺序固定；事件与审计必须在 Case 行之后（复合 FK / 语义依赖）。
- 任一失败 → 整体回滚。
- 不允许异步补写事件或审计（本 Slice 无 pg-boss / outbox）。

---

## 6. 明确不存在

- 不存在 `CASE_VIEWED` / `CASE_LISTED` / `CASE_ACCESSED` 事件类型。
- 不存在 read-audit 表、访问频次表、审计查询端点。
- 不存在 Case 状态 / 阶段转换事件（`CASE_WAITING`、`CASE_PAUSED`、`CASE_CLOSED`、`PHASE_CHANGED` 等）。
- 不存在 Safety / Plan / Task / Notification 事件。
- 不存在第二个 audit 写入入口（例如 `case_audit_events`）。

**测试要求**：对 `event_type` 取值集合、`pg_constraint`、路由清单做真实 introspection 断言。