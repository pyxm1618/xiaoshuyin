# Contract — Authorization, RLS, Idempotency & Transaction

**Feature**: `specs/002-case-core/spec.md`
**阶段**: Plan（Phase 1）
**权威**: `Docs/V1技术设计.md` §8.1 / §8.5 / §9 / §9.1 / §28.3；Slice 1 冻结契约。
**状态**: 契约基线。实现必须遵守；不得以 RLS 存在为由跳过 `authorize()`。

---

## 1. 端点与数据访问总览

| 端点 | 动作 | 授权 | 数据访问 | 写副作用 |
|---|---|---|---|---|
| `POST /api/v1/cases` | `CASE_CREATE` | 当前 Family 的 V1 管理主体 | Family 行锁、cases / events / audit / idempotency 写入 | Case + case_event + business_audit_event + idempotency |
| `GET /api/v1/cases` | `CASE_LIST` | 同上 | `cases` 只读 | 无 |
| `GET /api/v1/cases/:id` | `CASE_READ` | 同上（无资格统一 404） | `cases` 只读（RLS 限定 Family） | 无 |

---

## 2. `authorize()` 增量契约

### 2.1 输入形状（扩展现有 `AuthInput`）

| 字段 | Slice 1 | Slice 2 |
|---|---|---|
| `actor` | `{ accountId, personId }` | 不变 |
| `product` | `'V1'` | 不变 |
| `family` | `{ familyId } \| null` | `{ familyId; createdByPersonId?: string } \| null` |
| `case` | `null` | `{ caseId: string } \| null` |
| `resource` | `SELF \| FAMILY \| MEMBER \| CONSENT` | 新增 `CASE` |
| `action` | 9 个注册动作 | 新增 `CASE_CREATE` / `CASE_LIST` / `CASE_READ` |
| `purpose` | `SELF_IDENTITY \| FAMILY_MANAGEMENT \| GUARDIAN_CONSENT` | 不新增枚举；Case 动作要求 `FAMILY_MANAGEMENT` |

### 2.2 判定顺序（fail-closed）

```text
1. 若 action 不属于注册表                         → DENY / UNSUPPORTED_ACTION
2. 若 purpose 不属于注册枚举                      → DENY / UNSUPPORTED_PURPOSE
3. Case 动作：
   a. family === null                             → DENY / FAMILY_CONTEXT_REQUIRED
   b. purpose !== 'FAMILY_MANAGEMENT'             → DENY / UNSUPPORTED_PURPOSE
   c. family.createdByPersonId 缺失                → DENY / NOT_FAMILY_MANAGER
   d. family.createdByPersonId !== actor.personId → DENY / NOT_FAMILY_MANAGER
   e. CASE_CREATE / CASE_LIST 且 case !== null    → DENY / UNSUPPORTED_DIMENSION
   f. CASE_READ 且 case === null                  → DENY / CASE_CONTEXT_REQUIRED
   g. 其他                                          → ALLOW / { manager: true }
4. 非 Case 动作：
   - 保持 Slice 1 行为不变（含 case !== null → UNSUPPORTED_DIMENSION）
5. 任何内部异常                                   → DENY / AUTHORIZATION_ERROR
```

**规则 c / d 的理由**：`authorize()` 是纯函数，不能查数据库；manager 判定只能基于调用方已经读取并验证的 `family.createdByPersonId`。
缺失该字段时不能默认放行（fail-closed）。
`isFamilyManager(family, actorPersonId)` 仍保留为同一判定的纯函数实现。

### 2.3 明确不做

- 不新建 `authorizeCase()` 或第二个权限入口。
- 不建 Case role、Participant role、RBAC、Visibility Matrix、Permission DSL。
- 不把普通 membership / guardian relationship / 已知 `case_id` 作为 Case 访问依据。
- 不在 `authorize()` 中读数据库或判断 Case 归属。
- 不新增 Purpose 枚举；Case 管理沿用 `FAMILY_MANAGEMENT`。

---

## 3. Case 归属与 `case_id` 的处理

`case_id` / `family_id` 只作为**待验证参数**。

| 问题 | 由谁保证 |
|---|---|
| Case 是否属于当前 Family | `withRlsTransaction` 设置 `app.family_id` + `cases` RLS policy `family_id = app_family_id()` |
| actor 是否是当前 Family 管理主体 | `authorize()` + `families.created_by_person_id` |
| actor 是否是 Family 成员 | `set_family_context` 的 membership 校验（Slice 1） |
| ID 存在是否等于有权访问 | 不等于；先授权，再查询；查询返回 0 行即 404 |

**前提顺序（场景 9A / 9B）**：只有当 current Family 已合法解析（actor 是该 Family 的 `family_member`）时，才进入 Case 授权分支。actor 仅有 guardian relationship 但不是目标 Family 成员时，Family 上下文未合法成立，必须在解析阶段沿用 Slice 1 Family 语义；不得进入 `authorize()` 的 Case 分支，也不得映射为 `CASE_ACCESS_DENIED` / `CASE_NOT_FOUND`。

---

## 4. RLS 契约

### 4.1 表与 policy

| 表 | ENABLE | FORCE | USING | WITH CHECK |
|---|---|---|---|---|
| `cases` | 是 | 是 | `family_id = app_family_id()` | 同左 |
| `case_events` | 是 | 是 | `family_id = app_family_id()` | 同左 |

### 4.2 预期行为矩阵

| 场景 | `cases` SELECT | `cases` INSERT | `case_events` SELECT | `case_events` INSERT |
|---|---|---|---|---|
| 无 `app.family_id` | 0 行 | 拒绝 | 0 行 | 拒绝 |
| Family A 上下文，Family A Case | 可见 | 允许（family_id = A） | 可见 | 允许 |
| Family A 上下文，Family B Case | 0 行 | 拒绝（family_id = B） | 0 行 | 拒绝 |
| Family A 上下文，事件的 case 属于 B | — | — | 0 行 | RLS 拒绝或复合 FK 拒绝 |

### 4.3 运行角色

- `xiaoshuyin_app`：非 table owner、`NOBYPASSRLS`、仅 `SELECT, INSERT`（`cases` / `case_events`）。
- `xiaoshuyin_migrator`：table owner，只跑 DDL，不作为应用 runtime。
- `xiaoshuyin_app` 对 `families` 需要 `SELECT` 与 `UPDATE`：`SELECT ... FOR UPDATE` 是 primary 串行化点，PostgreSQL 要求 `UPDATE` 权限。Slice 1 的 GRANT 已包含；Implement Gate G5 必须现场确认。若 final 收紧授权，必须回到评审，不得改为无锁 check-then-insert。
- `accounts` 维持 Slice 1 无 RLS 的例外与窄访问补偿；本 Slice 不访问 `accounts`（除现有 auth 插件）。

### 4.4 禁止

- 不要在 RLS policy 中加入 manager / participant / visibility / purpose 矩阵。
- 不要因为 RLS 已启用而跳过 `authorize()`。
- 不要在事务外 `SET LOCAL` 后从连接池查询。
- 不要用 `sql.raw` 拼接 family / person / purpose。
- 不要使用 owner / BYPASSRLS 运行时角色。

---

## 5. 幂等契约（`CASE_CREATE`）

### 5.1 键与 scope

```text
actor_account_id + command_type='CASE_CREATE' + idempotency_key
```

- 复用 `idempotency_keys`；不新建第二张表。
- `idempotency_key`：JSON body `idempotencyKey`，8–128 字符（Frozen Technical Decision **R1**）。
- 同一张表的 RLS：`actor_account_id = app_account_id()`；无 identity 上下文 0 行 / 拒写。
- lookup / 占位 / 回填 / replay 全部在 `withRlsTransaction` 内。
- **scope 不含 family**：切换 Family 必须换 actor 视角才成立；`familyId` 只通过 canonical hash 参与一致性判定（见 5.2），不作为 scope 的一部分。

**物理表示（Owner-approved amendment，Round 2）**：scope 的第三维是 **logical** `idempotencyKey`，必须是精确身份。新 `CASE_CREATE` 行把 logical key 的 UTF-16LE bytes 存入 `idempotency_key_bytes`（`bytea`），`idempotency_key` 留 NULL；Slice 1 六个 command 与 003 之前的 legacy `CASE_CREATE` 行仍使用 raw text 列。两列由 CHECK 强制「非 CASE_CREATE → text only；CASE_CREATE → 恰有其一」，并由两个 UNIQUE 约束分别覆盖。禁止用 digest / 占位 namespace / base64 text / 截断替代 logical identity。

### 5.2 Canonical payload hash

```text
request_hash = sha256(canonicalJson({
  familyId: <已验证当前目标 Family ID>,
  body: <Zod strict 解析后的请求体，去掉 idempotencyKey>
}))
```

| 输入 | 是否进入 hash | 理由 |
|---|---|---|
| `familyId`（服务端已验证的当前目标 Family） | 是 | 不属于 scope；决定结果归属；不进入会跨 Family 回放。它是 canonical command context，**不是客户端提交字段**；客户端提交 `familyId` → 422 |
| `idempotencyKey` | 否 | 已在 scope 中 |
| `actor_account_id` | 否 | 已在 scope 中 |
| `command_type` | 否 | 已在 scope 中 |
| 请求体其他字段 | 是（当前恒为空 `{}`） | 保持「同 key 不同 payload → 409」语义 |

**可达性（冻结澄清）**：在**当前 V1 管理语义 + 同一 actor + 同一 current Family canonical context** 下，public `POST /api/v1/cases` 唯一合法业务 body 是 `{idempotencyKey}`；去掉幂等键后 `body = {}`，`familyId` 由服务端 current Family 解析唯一确定。因此当前 public HTTP command shape **不存在第二种合法 business payload**，mismatch 分支在 HTTP 层不可达；该分支在 shared idempotency domain / repository contract 层验证。

canonical hash 仍保留 `{ familyId: verifiedCurrentFamilyId, body: {} }`。未来若正式语义允许同一 actor 在多个 Family 执行 `CASE_CREATE`，相同 scope key + 不同 `familyId` 会得到不同 hash 并正确进入 mismatch；这不是当前 public HTTP 测试场景，不得删除 `familyId` hash。

### 5.3 决策表

| 现有记录 | hash 比较 | 结果 |
|---|---|---|
| 无 | — | `EXECUTE`（首次，占位后执行业务） |
| 有 | 相同 | `REPLAY`：返回原 status / body；不写新 Case / event / audit |
| 有 | 不同 | `MISMATCH`：409 `IDEMPOTENCY_PAYLOAD_MISMATCH`；不修改原 Case |

**验证分层（必须遵守）**
- HTTP integration：只验证 same key replay、concurrent same key、Case/event/audit 不重复。
- shared idempotency contract（domain / repository-service）：验证 same scope key + different `request_hash` → `MISMATCH` → 409 映射。
- **禁止**声称 public HTTP API 存在可达的合法 different-payload 请求；**禁止**用换 actor（scope 改变）制造 mismatch。

### 5.4 占位与回填

- 首次：`INSERT ... ON CONFLICT (scope) DO NOTHING RETURNING id`，占位 `response_status=0` / `response_body='{}'`。
- 业务成功后：同一事务 `UPDATE` 回填 `201` + 完整响应体。
- 并发同 key：第二个事务等待唯一索引判定；第一个提交则 REPLAY，第一个回滚则第二个执行。
- 占位值在事务外不可见，不泄露。

---

## 6. Case Create 事务序列（冻结）

```text
0. 认证（Bearer → actor）
1. 解析当前目标 Family（identity 上下文事务）
   0 行 → 404 CURRENT_FAMILY_NOT_FOUND
   >1 行 → 沿用 Slice 1 final 多 Family 语义
2. withRlsTransaction({familyId, accountId, personId, purpose:'FAMILY_MANAGEMENT'})
3. SELECT created_by_person_id FROM families WHERE id = $1
4. authorize(CASE_CREATE, family:{familyId, createdByPersonId}, case:null)
   DENY → 403 CASE_ACCESS_DENIED
5. idempotency 占位 / 冲突读取与比对（REPLAY 或 409 在此返回）
6. SELECT id FROM families WHERE id = $1 FOR UPDATE      ← Family 串行化点
7. SELECT EXISTS(primary 未结 Case)                       ← 独立语句、新快照
8. INSERT cases(status='OPEN', phase='INTAKE', is_primary=<判定>, version=1)
9. INSERT case_events('CASE_CREATED', metadata={primary, version})
10. INSERT business_audit_events('CASE_CREATED', 'CASE', caseId, metadata)
11. UPDATE idempotency_keys 回填 201 + response_body
12. COMMIT
13. 返回 201
```

**不变量**
- 所有写步骤同一事务；任一失败整体回滚。
- REPLAY 分支不获取 Family 锁，不写业务。
- 锁顺序固定；未来 Case 写命令必须沿用「先 Family 行锁」。
- 应用不自动重试；锁超时 / 死锁 → 500 真实失败。

---

## 7. 错误语义

| 错误码 | HTTP | 使用场景 | 响应体 |
|---|---:|---|---|
| `UNAUTHENTICATED` | 401 | 缺少 / 无效 token | `{code,message}` |
| `CASE_ACCESS_DENIED` | 403 | Family 已解析，actor 非管理主体（list / create） | 无 Case 数据 |
| `CURRENT_FAMILY_NOT_FOUND` | 404 | 当前 Family 未解析（Slice 1 语义；包括 actor 不是目标 Family 成员 / 仅有 guardian relationship） | 无 Case 数据 |
| `CASE_NOT_FOUND` | 404 | 详情：不存在 / 跨 Family / 无资格（Family 已解析） | 逐字节一致，无 Case 字段 |
| `IDEMPOTENCY_PAYLOAD_MISMATCH` | 409 | 同 key 不同 hash | 不改原 Case |
| `VALIDATION_ERROR` | 422 | strict schema 失败（含越权字段） | **零业务写入**：Case / `case_event` / `business_audit_event` / 新幂等结果均无新增 |
| `INTERNAL_ERROR` | 500 | 未预期错误 / 不变量破坏 | 不伪装成功 |

**禁止**
- 用 403 代替详情的 404（违反 D6）。
- 用 404 代替 list / create 的 403（违反 D6 / FR-024）。
- 把 guardian 但不是目标 Family 成员的场景转换为 `CASE_ACCESS_DENIED` / `CASE_NOT_FOUND`；该场景必须沿用 Slice 1 Family 语义，也不得用于验证 Case manager 权限。
- 用 200 / 201 掩盖失败。
- 在 404 / 403 响应中放入 Case 字段、Family 字段、`details` 或存在性提示。

---

## 8. 验证映射

| 契约 | 测试 |
|---|---|
| authorize 规则 2.2 | `tests/domain/case-authorization.test.ts` |
| 归属与 404 / 403 语义 | `tests/integration/cases-authorization.test.ts`、`tests/integration/cases-read.test.ts` |
| RLS 4.2 | `tests/db/cases-rls.test.ts` |
| 幂等 5.3 / 5.4（HTTP 可达行为） | `tests/integration/cases-idempotency.test.ts`（replay + 并发同 key） |
| 幂等 MISMATCH 合同（shared layer） | `tests/domain/idempotency-hash.test.ts` + repository/service contract 用例；**不是** HTTP 可达场景 |
| 事务序列 6 | `tests/integration/cases-create.test.ts`、`tests/db/cases-primary-concurrency.test.ts` |