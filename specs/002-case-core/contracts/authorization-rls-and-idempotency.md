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

### 2.1 输入形状（在 Slice 1 Final 模型上增量扩展）

> Slice 1 Final 已把 `authorize()` 重构为 **`AuthorizeFacts` 结构化模型**。本契约基于 Final 形状，**不得**恢复旧的 `family.createdByPersonId` + 扁平 `Resource` 字符串。

| 字段 | Slice 1 Final | Slice 2 |
|---|---|---|
| `actor` | `{ accountId, personId }` | 不变 |
| `product` | `'V1'` | 不变 |
| `family` | `{ familyId: string } \| null` | **保持 `{ familyId }`**；不得新增 `createdByPersonId` |
| `case` | `null`（Final 硬编码） | `{ caseId: string } \| null` |
| `resource` | 结构化 union：`{ type:'SELF'; personId }` / `{ type:'FAMILY'; familyId }` / `{ type:'MEMBER'; familyId; personId }` / `{ type:'CONSENT'; familyId; consentId? }` | 新增 `{ type:'CASE'; familyId: string; caseId: string }` |
| `facts` | `AuthorizeFacts`：`membership` / `familyCreatedByPersonId` / `actorAgeBand` / `guardianPersonId` / `targetIsFamilyMember` / `familyId` | **复用同一 facts**；Case 动作使用 `facts.membership` 与 `facts.familyCreatedByPersonId` |
| `action` | 9 个注册动作 | 新增 `CASE_CREATE` / `CASE_LIST` / `CASE_READ` |
| `purpose` | `SELF_IDENTITY \| FAMILY_MANAGEMENT \| GUARDIAN_CONSENT` | 不新增枚举；Case 动作要求 `FAMILY_MANAGEMENT` |
| `basis` | `{ membership: true; manager: boolean; purpose }` | 保持完整 basis；不得退化为 `{ manager }` |
| `DenyReason` | Final 集合（含 `NO_ACTOR` / `NOT_FAMILY_MEMBER` / `NOT_FAMILY_MANAGER` / `NOT_GUARDIAN` / `AGE_BAND_UNKNOWN` / `AUTHORIZATION_ERROR`） | 新增 `CASE_CONTEXT_REQUIRED` |

**Route 层输入形状（冻结）**：Case route 必须调用
`requireFamilyAction(tx, { accountId, personId, familyId, action, purpose, resource, caseId? })`。
`AuthInput` 表描述的是 `authorize()` 的输入，**不是** `requireFamilyAction()` 的输入。由 `authz.ts` 内部读取 `AuthorizeFacts` 并构造 `authorize({ actor, product, family, case, resource, action, purpose, facts })`。Route **不得**自行构造 `actor` / `family` / `case` / `facts`，不得新建 `authorizeCase()`。

### 2.2 判定顺序（fail-closed；基于 Final `AuthorizeFacts`）

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
   case !== null                                         → DENY / UNSUPPORTED_DIMENSION
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

**规则 6 / 7 的理由**：`authorize()` 是纯函数，不能查数据库；manager 判定只能基于调用方已经读取并验证的 `facts.membership` 与 `facts.familyCreatedByPersonId`。缺失 facts 时不能默认放行（fail-closed）。`isFamilyManager(family, actorPersonId)` 仍保留为同一判定的纯函数实现，但 Case 分支以 facts 为准。

**规则 10 的理由**：`resource` 是请求方提供的未验证参数；即使 Case 归属由 RLS 保证，也必须拒绝 resource 与已解析 family / case 不一致的伪造上下文。

### 2.3 明确不做

- 不新建 `authorizeCase()` 或第二个权限入口。
- 不建 Case role、Participant role、RBAC、Visibility Matrix、Permission DSL。
- 不把普通 membership / guardian relationship / 已知 `case_id` 作为 Case 访问依据。
- 不在 `authorize()` 中读数据库或判断 Case 归属。
- 不新增 Purpose 枚举；Case 管理沿用 `FAMILY_MANAGEMENT`。
- **不恢复** Slice 1 Final 已淘汰的 `family.createdByPersonId` / 扁平 `Resource` 字符串；manager 判定只使用 `facts.familyCreatedByPersonId`。

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
- `idempotency_key`：**`Idempotency-Key` HTTP header**（8–128 字符），通过 Slice 1 Final `readIdempotencyKey(req)` 读取（Frozen Technical Decision **R1**）。body **不包含**幂等键。
- 同一张表的 RLS：`actor_account_id = app_account_id()`；无 identity 上下文 0 行 / 拒写。
- lookup / 占位 / 回填 / replay 全部在 `withRlsTransaction` 内。
- **scope 不含 family**：切换 Family 必须换 actor 视角才成立；`familyId` 只通过 canonical hash 参与一致性判定（见 5.2），不作为 scope 的一部分。

**物理表示（Owner-approved amendment，Round 2）**：scope 的第三维是 **logical** `idempotencyKey`，必须是精确身份。新 `CASE_CREATE` 行把 logical key 的 UTF-16LE bytes 存入 `idempotency_key_bytes`（`bytea`），`idempotency_key` 留 NULL；Slice 1 六个 command 与 003 之前的 legacy `CASE_CREATE` 行仍使用 raw text 列。两列由 CHECK 强制「非 CASE_CREATE → text only；CASE_CREATE → 恰有其一」，并由两个 UNIQUE 约束分别覆盖。禁止用 digest / 占位 namespace / base64 text / 截断替代 logical identity。

### 5.2 Canonical payload hash

```text
request_hash = sha256(canonicalJson({
  familyId: <已验证当前目标 Family ID>,
  body: <Zod strict 解析后的业务请求体>
}))
```

| 输入 | 是否进入 hash | 理由 |
|---|---|---|
| `familyId`（服务端已验证的当前目标 Family） | 是 | 不属于 scope；决定结果归属；不进入会跨 Family 回放。它是 canonical command context，**不是客户端提交字段**；客户端提交 `familyId` → 422 |
| `Idempotency-Key` header | 否 | 已在 scope 中；header 不进入 body |
| `actor_account_id` | 否 | 已在 scope 中 |
| `command_type` | 否 | 已在 scope 中 |
| 请求体业务字段 | 是（当前恒为 `{}`） | 保持「同 key 不同 payload → 409」语义；body 不得含 `idempotencyKey` |

**可达性（冻结澄清）**：在**当前 V1 管理语义 + 同一 actor + 同一 current Family canonical context** 下，public `POST /api/v1/cases` 的 business body 恒为 `{}`（`Idempotency-Key` 在 header），`familyId` 由服务端 current Family 解析唯一确定。因此当前 public HTTP command shape **不存在第二种合法 business payload**，mismatch 分支在 HTTP 层不可达；该分支在 shared idempotency domain / repository contract 层验证。

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

### 5.4 占位与回填（CASE_CREATE bytea path）

- CASE_CREATE 首次由 `reserveIdempotency` 写入：
  `INSERT INTO idempotency_keys (actor_account_id, command_type, idempotency_key, idempotency_key_bytes, request_hash, response_status, response_body) VALUES ($1, $2, NULL, $3, $4, 0, '{}'::jsonb) ON CONFLICT DO NOTHING RETURNING id`
  —— `idempotency_key` 为 NULL，`idempotency_key_bytes` = logical key 的 **UTF-16LE bytes**。
- 唯一身份：`(actor_account_id, command_type, idempotency_key_bytes)`；`003` 的 representation CHECK 保证「非 CASE_CREATE → text only；CASE_CREATE → 恰有其一」。
- `getReservedIdempotency`：先按 bytes 查 `FOR SHARE`；未命中且 logical key 为 text-safe 时兼容 legacy `CASE_CREATE` text 行（`idempotency_key = $3 AND idempotency_key_bytes IS NULL`）。
- 业务成功后：同一事务 `completeIdempotency` 按 bytes 回填 `201` + 完整响应体。
- 并发同 key：第二个事务等待唯一索引判定；第一个提交则 REPLAY，第一个回滚则第二个执行。
- 占位值在事务外不可见，不泄露。
- **Slice 1 六个既有命令继续使用 text `idempotency_key` path**；不得删除 `003`、不得把 `CASE_CREATE` 改回 text、不得修改 Slice 1 六命令的物理语义。

---

## 6. Case Create 事务序列（冻结）

```text
0. 认证（Bearer → actor）
0.1 readIdempotencyKey(req) → 8–128 header
    缺失 / 非法 → 422 VALIDATION_ERROR（不得从 body 读取）
1. 解析当前目标 Family（identity 上下文事务）
   0 行 → 404 CURRENT_FAMILY_NOT_FOUND
   >1 行 → 沿用 Slice 1 Final 多 Family 语义（含 CURRENT_FAMILY_AMBIGUOUS）
2. withRlsTransaction({familyId, accountId, personId, purpose:'FAMILY_MANAGEMENT'})
3. requireFamilyAction(tx, {
     accountId: actor.accountId,
     personId: actor.personId,
     familyId,
     action: 'CASE_CREATE',
     purpose: 'FAMILY_MANAGEMENT',
     resource: { type: 'FAMILY', familyId }
   })
   authz.ts 在同一事务内读 facts（membership / familyCreatedByPersonId），
   并在内部构造 authorize({ actor, product, family, case, resource, action, purpose, facts })
   DENY NOT_FAMILY_MEMBER / NOT_FAMILY_MANAGER → 403 CASE_ACCESS_DENIED
4. idempotency 占位 / 冲突读取与比对（REPLAY 或 409 在此返回）
5. SELECT id FROM families WHERE id = $1 FOR UPDATE      ← Family 串行化点
6. SELECT EXISTS(primary 未结 Case)                       ← 独立语句、新快照
7. INSERT cases(status='OPEN', phase='INTAKE', is_primary=<判定>, version=1)
8. INSERT case_events('CASE_CREATED', metadata={primary, version})
9. INSERT business_audit_events('CASE_CREATED', 'CASE', caseId, metadata)
10. UPDATE idempotency_keys 回填 201 + response_body
11. COMMIT
12. 返回 201
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
| `VALIDATION_ERROR` | 422 | strict schema 失败（含越权字段）；缺失 / 非法 `Idempotency-Key` header | **零业务写入**：Case / `case_event` / `business_audit_event` / 新幂等结果均无新增 |
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
| authorize 规则 2.2（Final `AuthorizeFacts`） | `tests/domain/case-authorization.test.ts`；`tests/domain/authorization.test.ts`（Slice 1 regression） |
| 归属与 404 / 403 语义 | `tests/integration/cases-authorization.test.ts`、`tests/integration/cases-read.test.ts` |
| `authz.ts` 唯一入口（不新建 `authorizeCase()`） | 静态断言 + `tests/integration/cases-authorization.test.ts` |
| RLS 4.2 | `tests/db/cases-rls.test.ts` |
| 幂等 5.1–5.4（HTTP 可达行为） | `tests/integration/cases-idempotency.test.ts`（header replay + 并发同 key） |
| 幂等 MISMATCH 合同（shared layer） | `tests/domain/idempotency-hash.test.ts` + repository/service contract 用例；**不是** HTTP 可达场景 |
| 事务序列 6 | `tests/integration/cases-create.test.ts`、`tests/db/cases-primary-concurrency.test.ts` |
| Slice 1 Final regression | `bunx vitest run tests/domain tests/db tests/integration`（既有 Final 断言不得削弱） |
| OpenAPI semantic equivalence | `bun run openapi:check`（frozen YAML ↔ runtime） |
| 全量回归 | `bunx vitest run`；`node scripts/verify-all.mjs --archive` |