# Data Model — 004-case-participant-core

**Feature**: `specs/004-case-participant-core/spec.md`
**阶段**: Plan（Phase 1）
**权威**: `Docs/V1技术设计.md` §7.0 / §7.1 / §7.7A / §7.9 / §8.5 / §9 / §9.1 / §10 / §28.8；`specs/005-invited-identity-binding-contract/spec.md`。
**边界**: 本文只描述本 Slice 真正需要的参与资源；不建 Evidence、Assessment、Formulation、Scene、Plan / Task、Notification、AI、Memory、005 binding attempt 或第二套 audit。

> 本文不是 migration。正式变更只能通过 `db/migrations/<next-after-final-merged-main>_case_participant_core.sql` 的 reviewed migration 进入环境。
> 不修改 `001_initial_schema.sql` / `002_case_core.sql` / `003_case_idempotency_key_bytes.sql`。

---

## 1. 新增 enum

### `case_participation_state`

```text
PENDING
ACTIVE
DECLINED
EXPIRED
WITHDRAWN
```

语义（与 spec OQ-1—OQ-3 一一映射，不新增状态）：

| 值 | 含义 | 是否 terminal | 是否有 active capability |
|---|---|---|---|
| `PENDING` | 参与资源存在，等待 target 处理；无 active participant capability | 否 | 否 |
| `ACTIVE` | 已显式 accept 的有限参与 | 否 | 是 |
| `DECLINED` | target 拒绝；从未获得 capability | 是 | 否 |
| `EXPIRED` | pending 超过服务端 TTL；从未获得 capability | 是 | 否 |
| `WITHDRAWN` | 曾 active，之后退出；historical inactive | 是 | 否 |

> 不新增 `REVOKED` / `CANCELLED` / `INVITED` / `ACCEPTED` 等重复状态。`pending` 与 `active` 已分别表达“资源存在”与“capability 存在”。

---

## 2. `case_participants`

### 2.1 列

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT uuidv7()` | 参与资源标识；创建后不可变 |
| `family_id` | `uuid` | `NOT NULL`，`FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE RESTRICT` | 目标 Family；与 Case 一致 |
| `case_id` | `uuid` | `NOT NULL` | 目标 Case；由复合 FK 保证同 Family |
| `person_id` | `uuid` | `NOT NULL`，`FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE RESTRICT` | target / participant Person；不是 Account |
| `state` | `case_participation_state` | `NOT NULL`，无默认值 | 生命周期状态；应用必须显式写入 |
| `invite_token_hash` | `text` | `NOT NULL UNIQUE`，`CHECK (invite_token_hash ~ '^[0-9a-f]{64}$')` | `sha256(token)` hex；token 由 `HMAC-SHA256(PARTICIPATION_INVITE_TOKEN_SECRET, "participation-invite:v1:" + id)` 派生；token 明文不落库 |
| `invite_expires_at` | `timestamptz` | `NOT NULL`，无默认值；`CHECK (invite_expires_at > created_at)` | 服务端 TTL 计算；不得永久 |
| `created_by_person_id` | `uuid` | `NOT NULL`，`FOREIGN KEY (created_by_person_id) REFERENCES persons(id) ON DELETE RESTRICT` | 创建邀请的 Case manager |
| `accepted_at` | `timestamptz` | `NULL` | PENDING → ACTIVE 时写入；WITHDRAWN 保留 |
| `declined_at` | `timestamptz` | `NULL` | PENDING → DECLINED 时写入 |
| `expired_at` | `timestamptz` | `NULL` | PENDING → EXPIRED 物化时写入；`>= invite_expires_at` |
| `withdrawn_at` | `timestamptz` | `NULL` | ACTIVE → WITHDRAWN 时写入；`>= accepted_at` |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | 服务端时间 |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | 状态转换时更新 |

**为什么 `state` 不给默认值**：应用必须显式写入 `PENDING`；遗漏写入直接失败，避免“默认成功”。  
**为什么 `invite_expires_at` 不给默认值**：TTL 必须来自已批准的服务端配置，不允许 DB 默认偷偷冻结数字。  
**为什么没有 `version`**：本 Slice 只做状态转换，使用行锁 + 条件 UPDATE 即可；不引入未使用的乐观锁字段。  
**为什么没有 `account_id` / `age_band` / `guardian_person_id` / `consent_*`**：这些事实分别由 `persons.account_id`、`person_compliance_profiles`、`consent_records` 拥有；复制到本表会形成第二真相源。

### 2.2 约束与索引

| 名称 | 形式 | 目的 |
|---|---|---|
| `case_participants_pkey` | `PRIMARY KEY (id)` | 主键 |
| `case_participants_case_family_fk` | `FOREIGN KEY (case_id, family_id) REFERENCES cases (id, family_id) ON DELETE RESTRICT` | Case 必须属于同一 Family；复用 Slice 2 的 `cases(id, family_id)` 唯一键 |
| `case_participants_person_family_fk` | `FOREIGN KEY (person_id, family_id) REFERENCES family_members (person_id, family_id) ON DELETE RESTRICT` | target Person 必须在目标 Family 中；需要 `family_members (person_id, family_id)` 唯一键 |
| `case_participants_family_fk` | `FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE RESTRICT` | Family 完整性 |
| `case_participants_person_fk` | `FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE RESTRICT` | Person 完整性 |
| `case_participants_creator_fk` | `FOREIGN KEY (created_by_person_id) REFERENCES persons(id) ON DELETE RESTRICT` | 创建者完整性 |
| `case_participants_token_key` | `UNIQUE (invite_token_hash)` | token 全局唯一定位 |
| `case_participants_one_live_per_case_person` | `UNIQUE INDEX (case_id, person_id) WHERE state IN ('PENDING','ACTIVE')` | 同一 Case / Person 最多一个 live 参与资源；terminal 历史不受限 |
| `case_participants_family_case_idx` | `INDEX (family_id, case_id)` | Family / Case 读取辅助 |
| `case_participants_person_idx` | `INDEX (person_id)` | target / participant 自查辅助 |
| `case_participants_expiry_idx` | `INDEX (invite_expires_at) WHERE state = 'PENDING'` | 过期判定辅助（不是后台 job） |
| `case_participants_state_timestamps_check` | `CHECK (...)` | state 与时间戳一一对应（见 §2.3） |
| `case_participants_expired_at_after_deadline_check` | `CHECK (expired_at IS NULL OR expired_at >= invite_expires_at)` | 不得提前伪造过期 |
| `case_participants_withdrawn_after_accept_check` | `CHECK (withdrawn_at IS NULL OR (accepted_at IS NOT NULL AND withdrawn_at >= accepted_at))` | 退出必须发生在 accept 之后 |
| `case_participants_accept_after_create_check` | `CHECK (accepted_at IS NULL OR accepted_at >= created_at)` | 时间顺序 |
| `case_participants_decline_after_create_check` | `CHECK (declined_at IS NULL OR declined_at >= created_at)` | 时间顺序 |

**`family_members` 增量**：

```sql
ALTER TABLE family_members
  ADD CONSTRAINT family_members_person_family_key UNIQUE (person_id, family_id);
```

- 仅当 final merged main 尚不存在该唯一键时添加；若已存在等价约束，Implement 直接复用。
- 该唯一键只服务复合 FK，不改变 `family_members` 的业务语义，不新增角色 / guardian 列。

### 2.3 状态与时间戳 CHECK（语义等价）

```sql
CHECK (
  (state = 'PENDING'
    AND accepted_at IS NULL AND declined_at IS NULL
    AND expired_at IS NULL AND withdrawn_at IS NULL)
  OR
  (state = 'ACTIVE'
    AND accepted_at IS NOT NULL AND declined_at IS NULL
    AND expired_at IS NULL AND withdrawn_at IS NULL)
  OR
  (state = 'DECLINED'
    AND accepted_at IS NULL AND declined_at IS NOT NULL
    AND expired_at IS NULL AND withdrawn_at IS NULL)
  OR
  (state = 'EXPIRED'
    AND accepted_at IS NULL AND declined_at IS NULL
    AND expired_at IS NOT NULL AND withdrawn_at IS NULL)
  OR
  (state = 'WITHDRAWN'
    AND accepted_at IS NOT NULL AND declined_at IS NULL
    AND expired_at IS NULL AND withdrawn_at IS NOT NULL)
)
```

- `WITHDRAWN` 必须保留 `accepted_at`：退出是“曾经参与后退出”，不是“从未参与”。
- `DECLINED` / `EXPIRED` 不得有 `accepted_at`：它们从未获得 capability。
- `DECLINED` 不得有 `expired_at`，`EXPIRED` 不得有 `declined_at`：拒绝 ≠ 过期。
- `PENDING` 不得有任何终态时间戳。

---

## 3. RLS 与授权

### 3.1 表级

| 表 | `ENABLE ROW LEVEL SECURITY` | `FORCE ROW LEVEL SECURITY` |
|---|---|---|
| `case_participants` | 是 | 是 |

### 3.2 Policy

| Policy | 命令 | `USING` | `WITH CHECK` | 用途 |
|---|---|---|---|---|
| `case_participants_family_scope` | `ALL` | `family_id = app_family_id()` | `family_id = app_family_id()` | manager 建邀请 / 读取；target 在 family context 下的状态转换 |
| `case_participants_self_read` | `SELECT` | `person_id = app_person_id()` | — | target / participant 在无 family 上下文时按 id 解析自己的 participation |
| `case_participants_invite_token_read` | `SELECT` | `state = 'PENDING' AND invite_token_hash = app_invite_token_hash()` | — | 未认证 invite lookup 精确按 token 读取 safe view；terminal 行不通过 token 上下文可见 |

**组合行为**：

- SELECT：三条 policy 以 OR 组合；满足任一即可见。
- INSERT / UPDATE / DELETE：只有 `family_scope` 生效；token / self policy 不授予写权限。
- 无上下文：`app_family_id()` / `app_person_id()` / `app_invite_token_hash()` 均为 NULL → 谓词 NULL → SELECT 0 行；写入被拒。

### 3.3 invite safe view

```sql
CREATE VIEW case_participant_invite_public
WITH (security_invoker = true) AS
SELECT id AS participation_id,
       state,
       invite_expires_at AS expires_at,
       created_at
FROM case_participants
WHERE state = 'PENDING';

GRANT SELECT ON case_participant_invite_public TO xiaoshuyin_app;
```

- view 只暴露 `participation_id` / `state` / `expires_at` / `created_at`；不含 `person_id` / `case_id` / `family_id` / `invite_token_hash`。
- `security_invoker = true` 使底层 `case_participants` 的 RLS 继续生效；view 不绕过 token policy。
- 未认证 invite lookup 的 repository 只查询该 view，不查询 base table；guard test 断言不使用 `SELECT *` / base table。
- view 是 DB 层列投影，与应用层 repository、OpenAPI response 共同形成三层边界；它不是业务授权事实。

### 3.4 上下文函数

```sql
CREATE FUNCTION app_invite_token_hash() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.invite_token_hash', true), '')
$$;

CREATE FUNCTION app.set_invite_token_context(p_token_hash text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_token_hash IS NULL OR p_token_hash = ''
     OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.invite_token_hash', p_token_hash, true);
END $$;
```

- `set_invite_token_context` 只设置 token 上下文，不设置 family / person / account；因此不会让未认证 caller 读取家庭数据。
- `family_scope` 仍需要 `app.family_id`；token 查询不能顺便建立 family 上下文。
- 应用层必须先 authorize，再设置上下文；RLS 不替代 `authorize()`。

### 3.5 运行角色与 GRANT

| 对象 | `xiaoshuyin_app` 权限 |
|---|---|
| `case_participants` | `SELECT, INSERT, UPDATE`（无 `DELETE`；历史保留） |
| `case_participant_invite_public` | `SELECT`（仅安全列） |
| `case_participation_state` | `USAGE` |
| `app.set_invite_token_context(text)` | `EXECUTE` |
| `app_invite_token_hash()` | `EXECUTE` |

- `xiaoshuyin_migrator` 是 table owner，只跑 DDL。
- `xiaoshuyin_app` 非 owner、`NOBYPASSRLS`。
- 不新增角色；不修改 Slice 1 / 2 的角色权限。

---

## 4. 既有表的最小增量

### 4.1 `business_audit_events`

**不新增列**。扩展现有 CHECK 白名单：

| 维度 | 新增值 |
|---|---|
| `event_type` | `PARTICIPATION_INVITE_CREATED`、`PARTICIPATION_ACCEPTED`、`PARTICIPATION_DECLINED`、`PARTICIPATION_EXPIRED`、`PARTICIPATION_WITHDRAWN` |
| `resource_type` | `CASE_PARTICIPANT` |

`resource_id` = `case_participants.id`。`family_id` = 参与资源的 Family。`actor_account_id` = 触发该事件的已验证 Account。`metadata` 只放 id / state / expiresAt / fromState / toState，不放 token / openid / PII。

### 4.2 `idempotency_keys`

**不新增列**。扩展 `command_type` CHECK：

```text
PARTICIPATION_INVITE_CREATE
PARTICIPATION_ACCEPT
PARTICIPATION_DECLINE
PARTICIPATION_WITHDRAW
```

- 新 command 都非 `CASE_CREATE`，继续使用 `idempotency_key text NOT NULL`。
- 不修改 `idempotency_key_bytes` / CASE_CREATE 语义。
- 不新建第二张幂等表。

### 4.3 `family_members`

**不新增列**。新增 `UNIQUE (person_id, family_id)`（若 final merged main 尚无）以支持复合 FK。

### 4.4 `cases` / `case_events` / `persons` / `person_compliance_profiles` / `consent_records`

**不新增列、不修改语义**。本 Slice 只读取：
- `cases(id, family_id, status)`：验证 Case 存在与归属；
- `persons(id, account_id)` / auth 解析：确认 target / participant identity；
- `person_compliance_profiles` / `consent_records`：Compliance gate；
- `family_members`：复合 FK 与 membership。

**不写入** `persons.account_id` / `person_compliance_profiles` / `consent_records` / `family_members` / `cases` / `case_events`。

---

## 5. 关系图

```text
families 1 ──── * cases
families 1 ──── * family_members * ──── persons
families 1 ──── * case_participants
cases    1 ──── * case_participants      (复合 FK: case_id, family_id)
persons  1 ──── * case_participants      (person_id / created_by_person_id)
families 1 ──── * business_audit_events  (既有)
accounts 1 ──── * idempotency_keys       (既有)

case_participants:
  family_id + case_id  → cases(id, family_id)
  person_id + family_id → family_members(person_id, family_id)
  created_by_person_id → persons(id)
```

**基数与不变量**：
- 一个 Case → 0..N 参与资源；一个 Person → 0..N 参与资源（跨 Case）。
- 同一 `(case_id, person_id)` → 最多一个 PENDING / ACTIVE；terminal 历史可多条。
- 一个 participation → 恰好一个 `state`；恰好一个 `invite_token_hash`。
- 一个成功状态转换 → 恰好一条 `business_audit_events`。
- 一次成功命令 → 恰好一条 `idempotency_keys`（同 key 重放不新增）。

---

## 6. 事务内写入顺序

### 6.1 建邀请

```text
SET identity context
→ resolve current Family
→ SET family context
→ authorize(PARTICIPATION_INVITE_CREATE)
→ idempotency 占位 / 冲突读取
→ verify target Person ∈ Family（复合 FK 兜底）
→ Compliance gate（target）
→ generate token + hash
→ INSERT case_participants(state='PENDING', expires_at=...)
→ INSERT business_audit_events(PARTICIPATION_INVITE_CREATED)
→ idempotency 回填
→ COMMIT
```

### 6.2 accept

```text
SET identity context
→ SET invite-token context
→ SELECT participation by token hash（safe columns / internal family）
→ SET family context（membership 校验）
→ authorize(PARTICIPATION_ACCEPT_SELF)
→ SELECT case_participants FOR UPDATE
→ verify actor.personId = person_id
→ verify state='PENDING' AND now() < invite_expires_at（否则物化 EXPIRED）
→ Compliance gate re-check（target current state）
→ UPDATE state='ACTIVE', accepted_at=now()
→ INSERT business_audit_events(PARTICIPATION_ACCEPTED)
→ idempotency 回填
→ COMMIT
```

### 6.3 decline

```text
SET identity context
→ SELECT participation by id + person_id = app_person_id()
→ SET family context
→ authorize(PARTICIPATION_DECLINE_SELF)
→ SELECT FOR UPDATE
→ verify state='PENDING' AND not expired
→ UPDATE state='DECLINED', declined_at=now()
→ INSERT business_audit_events(PARTICIPATION_DECLINED)
→ idempotency 回填
→ COMMIT
```

### 6.4 withdraw

```text
SET identity context
→ SELECT participation by id + person_id = app_person_id()
→ SET family context
→ authorize(PARTICIPATION_WITHDRAW_SELF)
→ SELECT FOR UPDATE
→ verify state='ACTIVE'
→ UPDATE state='WITHDRAWN', withdrawn_at=now()
→ INSERT business_audit_events(PARTICIPATION_WITHDRAWN)
→ idempotency 回填
→ COMMIT
```

### 6.5 GET participation

```text
SET identity context
→ SELECT participation by id + person_id = app_person_id()（self read）
   → found: 若 PENDING 且过期：
       SELECT ... FOR UPDATE
       → UPDATE ... WHERE state='PENDING' AND now() >= invite_expires_at
       → 仅当 UPDATE 影响 1 行时 INSERT business_audit_events(PARTICIPATION_EXPIRED)
       → 返回最小状态
   → not found: resolve current Family → SET family context → authorize(PARTICIPATION_READ_MANAGER)
     → SELECT by id within Family; 若 PENDING 且过期，执行同样的 FOR UPDATE / 条件 UPDATE / exactly-once audit
     → 返回最小状态
     → not found: 404
```

- GET 不写 `case_events`；不写 access log。
- GET 的过期物化是唯一允许写 audit 的读路径；因为它改变真实状态，必须留痕。
- 物化必须 `SELECT ... FOR UPDATE` + 条件 UPDATE；只有 UPDATE 影响 1 行才写 audit，0 行不写 audit。并发两个 GET 时，只有一个事务能写 `PARTICIPATION_EXPIRED`。
- 若 PENDING 行到期后从未被访问，不自动写 audit；有效状态仍为 EXPIRED，可由 `invite_expires_at` + state + 当前时间追溯（Plan closeout 明确定义，见 `research.md` R-4）。

任一写入失败 → 整个事务回滚，不允许部分成功。

---

## 7. Migration 内容清单（不含序号）

按此顺序写入新的 reviewed migration（被引用唯一键必须先于复合 FK 存在）：

1. `CREATE TYPE case_participation_state`。
2. `ALTER TABLE family_members ADD CONSTRAINT family_members_person_family_key UNIQUE (person_id, family_id)`（若 final merged main 尚无）。
3. `CREATE TABLE case_participants`：列、主键、state 检查、时间戳检查。
4. `case_participants` 复合 FK：`(case_id, family_id)`、`(person_id, family_id)`、`family_id`、`person_id`、`created_by_person_id`。
5. `case_participants` 索引：token unique、partial unique live、family/case、person、pending expiry。
6. `CREATE FUNCTION app_invite_token_hash()` / `app.set_invite_token_context(text)`。
7. `ALTER TABLE case_participants ENABLE + FORCE ROW LEVEL SECURITY`。
8. `CREATE POLICY` 三条：family scope、self read、invite-token read（`state = 'PENDING'`）。
9. `CREATE VIEW case_participant_invite_public WITH (security_invoker = true)` + `GRANT SELECT`。
10. `GRANT`：`SELECT, INSERT, UPDATE` on `case_participants`；view `SELECT`；enum `USAGE`；function `EXECUTE`。
11. 扩展 `business_audit_events.event_type` / `resource_type` CHECK。
12. 扩展 `idempotency_keys.command_type` CHECK。

**顺序约束**：第 2 步的 `(person_id, family_id)` 唯一键是第 4 步复合 FK 的被引用唯一键；第 1 步 enum 必须先于表；RLS / policy 在表结构完成后启用；既有 CHECK 扩展最后执行。

**禁止**：
- 修改历史 migration；
- `drizzle-kit push`；
- 在 migration 中写业务数据 / 回填；
- 建 `participation_invites` 第二领域表、第二张幂等表、第二套审计表；
- 改 `case_events` 的 metadata shape；
- 建 005 binding attempt 表 / 端点；
- 为未来对象建空表 / 占位列 / 预留索引。

---

## 8. 明确不存在的对象（结构断言清单）

表 / 领域对象：
`participation_invites`、`binding_attempts`、`identity_binding_attempts`、`assertions`、`observations`、`dialogue_messages`、`problem_formulations`、`scene_node_states`、`scene_artifacts`、`safety_states`、`goals`、`intervention_instances`、`plan_versions`、`tasks`、`checkins`、`reviews`、`case_followup_schedules`、`notifications`、`notification_attempts`、`ai_runs`、`memory_*`、`data_requests`、`participation_audit_events`（第二套 audit）。

列 / 字段：
`case_participants` 不含 `role`、`account_id`、`age_band`、`guardian_person_id`、`consent_record_id`、`binding_state`、`visibility`、`deleted_at`。

枚举 / 事件 / 命令：
- 无 `REVOKED` / `CANCELLED` / `INVITED` / `ACCEPTED` 等重复状态；
- 无 manager cancel / Family manager cancel / creator cancel 命令；
- 无 `PARTICIPATION_VIEWED` / `PARTICIPATION_LISTED` read-audit 事件；
- 无 generic participant response command / endpoint / schema。

路由：
- 无 `POST /api/v1/participations/:id/responses`；
- 无 participant 列表 / 批量 / 管理 / 通用 response / Evidence / Assessment / Formulation / Scene / Plan / Task / Notification / UI 路由。

**测试要求**：`information_schema.columns` / `pg_constraint` / `pg_policies` / route enumeration 必须输出真实结果，不能只写“设计上不存在”。

---

## 9. 数据完整性不变量（可执行）

1. `state` 属于 `{PENDING, ACTIVE, DECLINED, EXPIRED, WITHDRAWN}`；无默认值。
2. 每个 state 只允许对应的时间戳组合；WITHDRAWN 必有 `accepted_at` + `withdrawn_at`。
3. `invite_expires_at > created_at`；`expired_at >= invite_expires_at`；`withdrawn_at >= accepted_at`。
4. `invite_token_hash` 为 64 位 hex 且全局唯一；token 由确定性 HMAC 派生；token 明文不在 `case_participants` / `idempotency_keys` / 审计 / 日志中；same-key create replay 由 `participationId` 重新派生同一 token。
5. `(case_id, family_id)` 必须匹配真实 Case；`(person_id, family_id)` 必须匹配真实 `family_members`。
6. 同一 `(case_id, person_id)` 最多一个 PENDING / ACTIVE。
7. `created_by_person_id` 必须是真实 Person；本 Slice 不验证其 manager 资格于 DB 层（由应用 `authorize()` + `families.created_by_person_id` 判定）。
8. 无 RLS 上下文时 `case_participants` 查询 0 行、写入拒绝。
9. terminal 行不可通过应用路径变为 PENDING / ACTIVE；DB CHECK + 条件 UPDATE 双重保证。
10. `case_participant_invite_public` view 只暴露 `participation_id` / `state` / `expires_at` / `created_at`；token lookup 不查询 base table 的敏感列。
11. 不写 `case_events` / `assertions` / `observations` / `persons.account_id` / `person_compliance_profiles` / `consent_records` / `cases`。