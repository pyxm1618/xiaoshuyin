# Contract — Authorization, RLS, Idempotency & Transaction

**Feature**: `specs/004-case-participant-core/spec.md`
**阶段**: Plan（Phase 1）
**权威**: `Docs/V1技术设计.md` §8.5 / §9 / §9.1 / §10 / §28.8；Slice 1 / Slice 2 冻结契约；`specs/005-invited-identity-binding-contract/spec.md`。
**状态**: 契约基线。实现必须遵守；不得以 RLS 存在为由跳过 `authorize()`。

---

## 1. 端点与数据访问总览

| 端点 | 动作 | 授权 | 数据访问 | 写副作用 |
|---|---|---|---|---|
| `POST /api/v1/cases/:id/participation-invites` | `PARTICIPATION_INVITE_CREATE` | 当前 Family 的 V1 管理主体 | `cases` / `family_members` / `person_compliance_profiles` / `consent_records` 只读；`case_participants` / `business_audit_events` / `idempotency_keys` 写入 | participation + audit + idempotency |
| `GET /api/v1/participation-invites/:token` | 无 `authorize()`（未认证 capability） | token possession；不构成 identity proof | `case_participants` 按 token safe-column 只读 | 无 |
| `POST /api/v1/participation-invites/:token/accept` | `PARTICIPATION_ACCEPT_SELF` | target Person 本人；identity prerequisite 满足 | `case_participants` 读写；Compliance / consent 只读 | state + audit + idempotency |
| `POST /api/v1/participations/:id/decline` | `PARTICIPATION_DECLINE_SELF` | target Person 本人 | `case_participants` 读写 | state + audit + idempotency |
| `POST /api/v1/participations/:id/withdraw` | `PARTICIPATION_WITHDRAW_SELF` | active Participant 本人 | `case_participants` 读写 | state + audit + idempotency |
| `GET /api/v1/participations/:id` | `PARTICIPATION_READ_SELF` / `PARTICIPATION_READ_MANAGER` | participant 本人或 Case Family manager | `case_participants` 只读（过期时可物化 EXPIRED） | 过期物化 + audit |

---

## 2. `authorize()` 增量契约

### 2.1 输入形状（扩展现有 `AuthInput`）

| 字段 | Slice 1 / 2 | Slice 4 |
|---|---|---|
| `actor` | `{ accountId, personId }` | 不变 |
| `product` | `'V1'` | 不变 |
| `family` | `{ familyId; createdByPersonId? } \| null` | 不变 |
| `case` | `{ caseId } \| null` | 不变 |
| `resource` | `SELF \| FAMILY \| MEMBER \| CONSENT \| CASE` | 新增 `PARTICIPATION` |
| `action` | 既有 action 表 | 新增 §2.2 |
| `purpose` | `SELF_IDENTITY \| FAMILY_MANAGEMENT \| GUARDIAN_CONSENT` | 新增 `PARTICIPATION` |
| `participation` | — | 新增 `{ personId: string; state: CaseParticipationState } \| null` |

### 2.2 新增 Action

```text
PARTICIPATION_INVITE_CREATE
PARTICIPATION_READ_SELF
PARTICIPATION_ACCEPT_SELF
PARTICIPATION_DECLINE_SELF
PARTICIPATION_WITHDRAW_SELF
PARTICIPATION_READ_MANAGER
```

### 2.3 判定顺序（fail-closed）

```text
1. action 不在注册表                         → DENY / UNSUPPORTED_ACTION
2. purpose 不在注册枚举                      → DENY / UNSUPPORTED_PURPOSE
3. PARTICIPATION_INVITE_CREATE:
   a. family === null 或 case === null        → DENY / FAMILY_CONTEXT_REQUIRED
   b. purpose !== 'FAMILY_MANAGEMENT'         → DENY / UNSUPPORTED_PURPOSE
   c. family.createdByPersonId 缺失            → DENY / NOT_FAMILY_MANAGER
   d. family.createdByPersonId !== actor.personId → DENY / NOT_FAMILY_MANAGER
   e. 否则                                     → ALLOW / { manager: true }
4. PARTICIPATION_READ_MANAGER:
   a. 同 3a—3d
   b. participation === null                   → DENY / PARTICIPATION_CONTEXT_REQUIRED
   c. 否则                                     → ALLOW / { manager: true }
5. self actions (READ_SELF / ACCEPT_SELF / DECLINE_SELF / WITHDRAW_SELF):
   a. purpose !== 'PARTICIPATION'               → DENY / UNSUPPORTED_PURPOSE
   b. participation === null                    → DENY / PARTICIPATION_CONTEXT_REQUIRED
   c. participation.personId !== actor.personId → DENY / NOT_PARTICIPANT
   d. 否则                                      → ALLOW / { participant: true }
6. 非 participation actions: 保持 Slice 1 / 2 行为不变
7. 任何内部异常                                 → DENY / AUTHORIZATION_ERROR
```

**新增 DenyReason**：`PARTICIPATION_CONTEXT_REQUIRED`、`NOT_PARTICIPANT`。

**状态检查的职责**：
- `authorize()` 判“谁可以尝试该动作”；它接收 `participation.state` 仅用于拒绝明显越权（如已 terminal 的 accept），不实现完整状态机。
- 具体状态转换由 domain service 在行锁下判定，并由 DB CHECK / 条件 UPDATE 作最后防线。
- 不得把 `authorize()` 变成状态机第二真相源，也不得新建 `authorizeParticipation()`。

### 2.4 明确不做

- 不建 Case role、Participant role、RBAC、Visibility Matrix、Permission DSL。
- 不把普通 membership / guardian relationship / 已知 `case_id` / 已知 `participation_id` 作为访问依据。
- 不在 `authorize()` 中读数据库或判断 Case / participation 归属。
- 不新增 generic participant response action。
- 不改变 Slice 1 / Slice 2 既有 action 的语义。

---

## 3. 授权语义

### 3.1 三角色

| actor | 判定 | 可做什么 |
|---|---|---|
| Case manager / inviter | `family.createdByPersonId === actor.personId`（Slice 1 / 2 冻结） | 建邀请；读取该 Family 内 participation 最小状态 |
| invite target | `actor.personId === participation.person_id` | 查看自己的 invite；accept / decline；读取自己的 participation |
| active Participant | 同上且 `state = ACTIVE` | withdraw；读取自己的 participation |

### 3.2 Guardian / membership 边界

- 普通 Family membership **不**自动授予 invite 创建或 participant 读取。
- guardian relationship **不**自动授予 Case / Participant 权限；只在未成年人 Compliance gate 与 005 身份确认中使用。
- 非 manager 的 guardian 即使同时是 Family member，也不能创建邀请或读取他人 participation。
- 创建 Family 的 adult 是 manager；这是 Family 聚合事实，不是 `family_members` 角色。

### 3.3 Case-wide access

- 本 Slice 不修改 Slice 2 的 Case 授权。
- 活跃 Participant 调用 `GET /api/v1/cases/:id` 仍按 Slice 2 的 manager-only 语义失败（`404 CASE_NOT_FOUND`）。
- Participant 只通过 `GET /participations/:id` 读取自己的最小参与状态。
- 任何未来业务对象访问仍需独立 Visibility / Purpose / feature authorization（spec FR-025）。

---

## 4. RLS 契约

### 4.1 表与 policy

| 表 | ENABLE | FORCE | Policy | USING | WITH CHECK |
|---|---|---|---|---|---|
| `case_participants` | 是 | 是 | `case_participants_family_scope`（ALL） | `family_id = app_family_id()` | 同左 |
| `case_participants` | 是 | 是 | `case_participants_self_read`（SELECT） | `person_id = app_person_id()` | — |
| `case_participants` | 是 | 是 | `case_participants_invite_token_read`（SELECT） | `invite_token_hash = app_invite_token_hash()` | — |

### 4.2 行为矩阵

| 场景 | SELECT | INSERT / UPDATE |
|---|---|---|
| 无 `app.family_id` / `app.person_id` / `app.invite_token_hash` | 0 行 | 拒绝 |
| Family A 上下文，Family A participation | 可见 | 允许（family_id = A） |
| Family A 上下文，Family B participation | 0 行 | 拒绝 |
| identity 上下文，`person_id = app_person_id()` | 自己的 participation 可见 | 仍需 family context |
| token 上下文，精确 token hash | 仅该行可见（应用只 select 安全列） | 拒绝 |
| 运行角色 `xiaoshuyin_app` | 非 owner、`NOBYPASSRLS` | `SELECT, INSERT, UPDATE` |

### 4.3 上下文

- `app_family_id()` / `app_person_id()` / `app_account_id()` / `app.purpose`：复用 Slice 1。
- 新增 `app.invite_token_hash` / `app_invite_token_hash()` / `app.set_invite_token_context(text)`。
- token 上下文只设置 token hash，不设置 family / person / account；未认证 caller 不能借此读取家庭数据。
- 所有家庭级写必须在 `withRlsTransaction` 内；所有 self 解析先走 identity context，再 `set_family_context`。
- 禁止：事务外 `SET LOCAL` 后从连接池查询；`sql.raw` 拼接 family / person / purpose；owner / BYPASSRLS runtime role；因 RLS 存在而跳过 `authorize()`。

### 4.4 运行角色

- `xiaoshuyin_app`：非 table owner、`NOBYPASSRLS`、`SELECT, INSERT, UPDATE` on `case_participants`；无 `DELETE`。
- `xiaoshuyin_migrator`：table owner，只跑 DDL，不作为应用 runtime。
- 不修改 Slice 1 / 2 角色权限；不新增角色。

### 4.5 明确不做

- 不在 RLS policy 中判 manager / participant / purpose 矩阵。
- 不把 token policy 用于写。
- 不用 `SELECT *` 读取 token 行；repository 必须只 select 安全列。
- 不用 `SECURITY DEFINER` 绕过 RLS。

---

## 5. 幂等契约

### 5.1 键与 scope

```text
actor_account_id + command_type + idempotency_key
```

| command_type | 用途 |
|---|---|
| `PARTICIPATION_INVITE_CREATE` | 建邀请 |
| `PARTICIPATION_ACCEPT` | 接受 |
| `PARTICIPATION_DECLINE` | 拒绝 |
| `PARTICIPATION_WITHDRAW` | 退出 |

- 复用 `idempotency_keys`；不新建第二张表。
- 新 command 非 `CASE_CREATE`，继续使用 `idempotency_key text NOT NULL`。
- 不修改 `idempotency_key_bytes` / CASE_CREATE 语义。
- 所有 lookup / 占位 / 回填 / replay 在 identity context 事务内执行；RLS `actor_account_id = app_account_id()`。

### 5.2 Canonical payload hash

```text
request_hash = sha256(canonicalJson({
  <server-verified context>,
  <path / body identifiers>
}))
```

| command | 进入 hash 的字段 | 理由 |
|---|---|---|
| `PARTICIPATION_INVITE_CREATE` | `familyId`（服务端已验证）、`caseId`（path）、`personId`（body） | 防止跨 Family / 跨 Case / 跨 target 回放 |
| `PARTICIPATION_ACCEPT` | `inviteTokenHash`、`participationId` | token 明文不落库；hash 用于一致性 |
| `PARTICIPATION_DECLINE` | `participationId` | 同 key 不同 participation → 409 |
| `PARTICIPATION_WITHDRAW` | `participationId` | 同上 |

- `idempotencyKey` / `actor_account_id` / `command_type` 已在 scope 中，不重复进入 hash。
- 客户端不得提交 `familyId` / `caseId` / `participationId` 作为 body 字段；path 参数由服务端解析。
- 本 Slice 的 mismatch **HTTP 可达**（不同 path / body），必须真实验证；不得照搬 Slice 2 的“HTTP 不可达”结论。

### 5.3 决策表

| 现有记录 | hash | 结果 |
|---|---|---|
| 无 | — | `EXECUTE`：占位 → 业务 → 回填 → commit |
| 有 | 相同 | `REPLAY`：返回原 status / body；不重复写 participation / audit |
| 有 | 不同 | `MISMATCH` → `409 IDEMPOTENCY_PAYLOAD_MISMATCH`；不改原资源 |

### 5.4 占位与回填

- 首次：`INSERT ... ON CONFLICT (scope) DO NOTHING RETURNING id`，占位 `response_status=0` / `response_body='{}'`。
- 业务成功后：同一事务 `UPDATE` 回填真实 status + response body。
- 并发同 key：第二个事务等待唯一索引判定；第一个提交则 REPLAY，第一个回滚则第二个执行。
- 占位值在事务外不可见，不泄露。

### 5.5 明确不做

- 不新建第二套幂等框架 / 表 / 内存缓存。
- 不把读操作（GET invite / GET participation）纳入幂等。
- 不把 005 binding attempt 的 attempt identity 当作 participation idempotency；两者生命周期分开。

---

## 6. 事务序列

### 6.1 建邀请

```text
0. 认证（Bearer → actor）
1. identity context → resolve current Family
   0 行 → 404 CURRENT_FAMILY_NOT_FOUND
   >1 行 → 沿用 Slice 1 final 多 Family 语义 / 409 CURRENT_FAMILY_AMBIGUOUS
2. withRlsTransaction({ familyId, accountId, personId, purpose: 'FAMILY_MANAGEMENT' })
3. SELECT created_by_person_id FROM families WHERE id = $1
4. authorize(PARTICIPATION_INVITE_CREATE, family:{familyId, createdByPersonId}, case:{caseId})
   DENY → 404 CASE_NOT_FOUND（统一反枚举）
5. idempotency 占位 / 冲突读取与比对（REPLAY 或 409 在此返回）
6. SELECT case 存在且属于 family（RLS 兜底）
7. SELECT target Person ∈ family（复合 FK 兜底）
8. Compliance gate(target) → BLOCK → 403 PARTICIPATION_TARGET_INELIGIBLE
9. 检查 (caseId, personId) 无 live participation；partial unique 兜底
10. generate token + hash + expires_at
11. INSERT case_participants(state='PENDING')
12. INSERT business_audit_events(PARTICIPATION_INVITE_CREATED)
13. UPDATE idempotency_keys 回填 201 + response_body
14. COMMIT
15. 返回 201（inviteToken 只在此返回）
```

### 6.2 accept

```text
0. 认证（Bearer → actor）
1. identity context
2. token context：app.set_invite_token_context(sha256(path token))
3. SELECT participation by token hash（内部读取 family_id / person_id；不返回给客户端）
4. set_family_context(family_id, actor.personId)（会员校验；失败 → 404 generic）
5. authorize(PARTICIPATION_ACCEPT_SELF, participation:{personId, state})
   - actor.personId !== participation.personId → 404 generic
6. idempotency 占位 / 冲突读取与比对
7. SELECT case_participants FOR UPDATE
8. 重新检查 state / expires_at / actor identity
   - expired → 物化 EXPIRED + audit，commit 后 404/409 generic
   - terminal → 409 PARTICIPATION_STATE_CONFLICT（授权 target）
9. Compliance gate(target, current) → BLOCK → 404 generic；不产生 active
10. UPDATE state='ACTIVE', accepted_at=now()
11. INSERT business_audit_events(PARTICIPATION_ACCEPTED)
12. idempotency 回填
13. COMMIT
14. 返回 200 ParticipationResource
```

### 6.3 decline / withdraw

```text
0. 认证
1. identity context
2. SELECT participation by id + person_id = app_person_id()
   0 行 → 404 PARTICIPATION_NOT_FOUND
3. set_family_context(family_id, actor.personId)
4. authorize(PARTICIPATION_DECLINE_SELF / WITHDRAW_SELF)
5. idempotency 占位 / 冲突读取
6. SELECT FOR UPDATE
7. 重新检查 state
   - decline: 只允许 PENDING；expired → 物化 EXPIRED；其它 → 409
   - withdraw: 只允许 ACTIVE；其它 → 409
8. UPDATE state / timestamp
9. INSERT business_audit_events
10. idempotency 回填
11. COMMIT
```

### 6.4 GET participation

```text
1. identity context
2. SELECT by id + person_id = app_person_id()
   found → 若 PENDING 且过期：SELECT FOR UPDATE → UPDATE EXPIRED + audit → 返回
          否则直接返回
   not found →
3. resolve current Family → set_family_context
4. authorize(PARTICIPATION_READ_MANAGER, participation)
5. SELECT by id within Family → 返回或 404
```

**不变量**：
- 所有写步骤同一事务；任一失败整体回滚。
- REPLAY 分支不获取 participation 行锁，不写业务。
- 锁顺序固定：participation 行锁 → audit insert → idempotency 回填。
- 应用不自动重试；锁超时 / 死锁 → 500 真实失败。

---

## 7. 错误语义

| 错误码 | HTTP | 使用场景 | 响应体 |
|---|---:|---|---|
| `UNAUTHENTICATED` | 401 | 缺少 / 无效 token | 无业务字段 |
| `CASE_NOT_FOUND` | 404 | 建邀请：Case 不存在 / 跨 Family / actor 非 manager（统一） | 无 Case / Family / Person 字段 |
| `CURRENT_FAMILY_NOT_FOUND` | 404 | 当前 Family 未解析（Slice 1 语义） | 无 Case 数据 |
| `CURRENT_FAMILY_AMBIGUOUS` | 409 | actor 多 Family 歧义（Slice 1 语义） | 不猜测 |
| `PARTICIPATION_TARGET_INELIGIBLE` | 403 | target Compliance / guardian / consent / eligibility 不满足 | 无 age / guardian / consent 细节 |
| `PARTICIPATION_ALREADY_EXISTS` | 409 | 同一 (caseId, personId) 已有 PENDING / ACTIVE | 无 Case / Person 细节 |
| `INVITATION_NOT_AVAILABLE` | 404 | invite token 无效 / 过期 / 已拒绝 / 已退出 / 不存在 | 全部一致 |
| `PARTICIPATION_NOT_FOUND` | 404 | accept / decline / withdraw / GET：未授权 / 非 target / 非 manager / 不存在 | 全部一致 |
| `PARTICIPATION_STATE_CONFLICT` | 409 | 授权 target / participant 的非法状态转换 | 仅 `{ currentState }` |
| `IDEMPOTENCY_PAYLOAD_MISMATCH` | 409 | 同 key 不同 canonical payload | 不改原资源 |
| `VALIDATION_ERROR` | 422 | strict schema 失败 / 越权字段 | 零业务写入 |
| `INTERNAL_ERROR` | 500 | 未预期错误 / 不变量破坏 | 不伪装成功 |

**禁止**：
- 用 403 / 404 差异泄露 Case 是否存在或 actor 是否 manager；
- 在 404 / 403 / 409 中放入 target Person / Family / Case / guardian / age / consent / compliance 字段；
- 用 200 / 201 掩盖失败；
- 把 UNKNOWN / DECLINED / EXPIRED / WITHDRAWN 写成成功。

---

## 8. 验证映射

| 契约 | 测试 |
|---|---|
| `authorize()` 规则 2.3 | `tests/domain/participants-authorization.test.ts` |
| 三角色 / guardian 边界 | `tests/integration/participations-authorization.test.ts` |
| RLS 4.2 / 4.3 | `tests/db/participants-rls.test.ts` |
| 幂等 5.3 / 5.4（HTTP 可达） | `tests/integration/participations-idempotency.test.ts` |
| 事务序列 6.1—6.4 | `tests/integration/participations-invite.test.ts`、`participations-accept.test.ts`、`participations-decline.test.ts`、`participations-withdraw.test.ts`、`participations-read.test.ts` |
| 并发 | `tests/integration/participations-accept-concurrency.test.ts`、`tests/db/participants-constraints.test.ts` |
| 错误语义 / 防枚举 | `tests/integration/participations-anti-enumeration.test.ts`、`tests/integration/participations-http-boundary.test.ts` |