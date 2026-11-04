# Data Model — 001-family-identity-core

**Feature**: `specs/001-family-identity-core/spec.md`
**Plan**: `plan.md`（决策 D-1—D-6）
**Target**: PostgreSQL 18（原生 `uuidv7()`）
**Migration**: 单次 reviewed SQL，顺序见 `plan.md` §D-6.4

> 本文是列级设计的唯一位置。所有表名来自 `Docs/V1技术设计.md` §7.1 / §7.7A / §7.9；`guardian_consent_requests`、`person_profile_values`、`idempotency_keys` 是 §7.7A / §2.2 / §8.5 显式要求但未给列级定义的物理投影，由 Plan 决定列级写法（§7.1：“列级字段与约束写法由实现决定”）。
>
> 本 Slice 不建：`cases`、`case_participants`、`assertions`、`observations`、`dialogue_messages`、`problem_formulations`、`scene_*`、`intervention_*`、`plan_*`、`task_*`、`ai_runs`、`memory_*`、`staff_assignments`、`data_requests`、`notifications`。

---

## 1. 枚举

```sql
CREATE TYPE age_band AS ENUM ('ADULT', 'MINOR_14_17', 'UNDER_14', 'UNKNOWN');
-- 严格等于 Docs/V1技术设计.md §7.7A 的 4 值；NOT_COLLECTED / DECLINED /
-- CONFLICTING / EXPIRED 属 §5 不变量 5 的通用状态，不是 age_band 取值。

CREATE TYPE provenance_source AS ENUM (
  'SELF_STATEMENT',        -- 本人陈述
  'GUARDIAN_OBSERVATION',  -- 家长观察
  'GUARDIAN_RELAY',        -- 家长转述
  'OTHER_MEMBER_RELAY',    -- 其他成员转述
  'MANUAL_DEVICE_DATA',    -- 手工录入的设备数据
  'STAFF_RECORD',          -- 工作人员记录
  'AI_HYPOTHESIS',         -- AI 假设
  'SOURCE_CONFIRMED'       -- 经相应来源确认的信息
);
-- 取 Docs/V1产品需求.md §2.2 的完整 8 类。本 Slice 的 API 写入白名单只含前 4 类。

CREATE TYPE profile_attribute AS ENUM ('DISPLAY_NAME', 'RELATION_DESCRIPTOR');
-- 本 Slice 封闭集合。刻意不含 AGE_BAND：age_band 的唯一载体是
-- person_compliance_profiles（见 plan.md D-4）。

CREATE TYPE profile_value_status AS ENUM ('RECORDED', 'SUPERSEDED', 'RETRACTED');

CREATE TYPE consent_decision AS ENUM ('GRANTED', 'REVOKED');

CREATE TYPE consent_request_status AS ENUM ('PENDING', 'GRANTED', 'EXPIRED', 'ABANDONED');

CREATE TYPE consent_purpose AS ENUM ('UNDER_14_GUARDIAN_CONSENT');

CREATE TYPE account_status AS ENUM ('ACTIVE', 'DISABLED');
```

**为什么用 PG enum 而不是 `text + CHECK`**：取值集合是本 Slice 的封闭事实；enum 让“写入非法来源”在类型层失败，也让 `person_profile_values` 不可能承载 `AGE_BAND`。新增取值需要 reviewed migration，符合 §7.0。

**约束说明**：枚举迁移代价高是已知代价，但本 Slice 的取值集合全部来自已批准文档（§7.7A 的 4 值、§2.2 的 8 类），不属于“未来可能扩展”的投机设计。

---

## 2. `accounts`

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `uuid` | PK, `DEFAULT uuidv7()` | §7.0 主键基线 |
| `wechat_openid` | `text` | `NOT NULL`, `UNIQUE` | 登录标识；**永不出现在 API 响应** |
| `session_epoch` | `integer` | `NOT NULL DEFAULT 0`, `CHECK (session_epoch >= 0)` | 登出即 +1，旧 token 全失效（D-1） |
| `status` | `account_status` | `NOT NULL DEFAULT 'ACTIVE'` | |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |
| `last_login_at` | `timestamptz` | NULL | 未知即 NULL，不补值 |

```sql
CREATE TABLE accounts (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  wechat_openid   text NOT NULL UNIQUE CHECK (length(wechat_openid) BETWEEN 1 AND 128),
  session_epoch   integer NOT NULL DEFAULT 0 CHECK (session_epoch >= 0),
  status          account_status NOT NULL DEFAULT 'ACTIVE',
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_login_at   timestamptz
);
```

- **无 RLS**：身份表不属于家庭作用域，登录必须在无家庭上下文时可用（D-5.4 / Open Review Item R-5）。
- 无 `person_id` 列：Account → Person 的关系由 `persons.account_id` 单向表达（D-1）。

---

## 3. `persons`

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `uuid` | PK, `DEFAULT uuidv7()` | |
| `account_id` | `uuid` | NULL, `UNIQUE`, FK → `accounts(id)` `ON DELETE RESTRICT` | 1:1 / 0..1 的唯一落点 |
| `created_by_account_id` | `uuid` | `NOT NULL`, FK → `accounts(id)` `ON DELETE RESTRICT` | 审计归属（谁录入） |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

```sql
CREATE TABLE persons (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  account_id             uuid UNIQUE REFERENCES accounts(id) ON DELETE RESTRICT,
  created_by_account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
```

**必须不存在的列**（结构断言测试）：

- `family_id` / 任何单家庭绑定列 → FR-017
- `source_kind` / `source` / 任何 Person 级来源列 → FR-003
- `role` / `is_guardian` / `is_admin` → FR-006

**为什么没有 `display_name`**：所有人物资料都是 per-value provenance 的载体，只能经 `person_profile_values` 写入；若 `persons` 上再放一个 `display_name`，就会出现“同一资料两种来源”的分裂，直接违反 FR-003。

---

## 4. `families`

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `uuid` | PK, `DEFAULT uuidv7()` | |
| `display_name` | `text` | NULL, `CHECK (length(display_name) <= 60)` | 家庭标签；未提供即 NULL |
| `created_by_person_id` | `uuid` | `NOT NULL`, `UNIQUE`, FK → `persons(id)` `ON DELETE RESTRICT` | 管理主体的唯一来源（D-2） |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

```sql
CREATE TABLE families (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  display_name          text CHECK (display_name IS NULL OR length(display_name) BETWEEN 1 AND 60),
  created_by_person_id  uuid NOT NULL UNIQUE REFERENCES persons(id) ON DELETE RESTRICT,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
```

- `UNIQUE(created_by_person_id)`：V1 一个 adult 只拥有一个 Family（plan.md R-2）。**不**限制一个 Person 被多少个 Family 包含——那由 `family_members` 决定，且本 Slice 允许（schema 级）。
- `display_name` 无 provenance：它是容器标签，不是用于判断的人物资料（§2.2 适用范围是“用于判断的信息”）。

---

## 5. `family_members`

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `uuid` | PK, `DEFAULT uuidv7()` | |
| `family_id` | `uuid` | `NOT NULL`, FK → `families(id)` `ON DELETE RESTRICT` | |
| `person_id` | `uuid` | `NOT NULL`, FK → `persons(id)` **`DEFERRABLE INITIALLY DEFERRED`** | 允许“先插 membership 再插 person”（D-5.4） |
| `joined_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

```sql
CREATE TABLE family_members (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id  uuid NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  person_id  uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT
               DEFERRABLE INITIALLY DEFERRED,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_members_family_person_key UNIQUE (family_id, person_id)
);
CREATE INDEX family_members_person_idx ON family_members (person_id);
```

**必须不存在的列**：`role` / `is_admin` / `is_owner` / `is_creator` / `is_guardian`（§7.1、FR-006）。成员关系只回答“属于哪个 Family”。

---

## 6. `guardian_consent_requests`（consent onboarding 最小状态）

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `uuid` | PK, `DEFAULT uuidv7()` | 同时作为客户端持有的不透明绑定 token |
| `family_id` | `uuid` | `NOT NULL`, FK → `families(id)` | 隔离作用域 |
| `guardian_person_id` | `uuid` | `NOT NULL`, FK → `persons(id)` | 发起同意的成年 Person |
| `declared_age_band` | `age_band` | `NOT NULL`, `CHECK (declared_age_band = 'UNDER_14')` | 本流程专属 |
| `notice_version` | `text` | `NOT NULL` | 已展示告知版本 |
| `notice_hash` | `text` | `NOT NULL`, `CHECK (notice_hash ~ '^[0-9a-f]{64}$')` | 告知正文 sha256 |
| `status` | `consent_request_status` | `NOT NULL DEFAULT 'PENDING'` | |
| `expires_at` | `timestamptz` | `NOT NULL` | `created_at + 24h` |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |
| `completed_at` | `timestamptz` | NULL | |
| `subject_person_id` | `uuid` | NULL, FK → `persons(id)` | 仅“对已存在未成年人重新同意”时非空 |

```sql
CREATE TABLE guardian_consent_requests (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id           uuid NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  guardian_person_id  uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  subject_person_id   uuid REFERENCES persons(id) ON DELETE RESTRICT,
  declared_age_band   age_band NOT NULL CHECK (declared_age_band = 'UNDER_14'),
  notice_version      text NOT NULL,
  notice_hash         text NOT NULL CHECK (notice_hash ~ '^[0-9a-f]{64}$'),
  status              consent_request_status NOT NULL DEFAULT 'PENDING',
  expires_at          timestamptz NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  CONSTRAINT gcr_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT gcr_completed_consistency CHECK (
    (status = 'GRANTED') = (completed_at IS NOT NULL)
  )
);
CREATE INDEX gcr_guardian_idx ON guardian_consent_requests (guardian_person_id);
```

**PII 边界（结构断言测试）**：本表**不得**出现 `child_name` / `birth_date` / `display_name` / `relation` 或任何可识别未成年人的列。合规性由“列不存在”证明，而不是由说明文档证明。

**过期语义**：无后台任务。读取时若 `status='PENDING' AND now() > expires_at` 视为 `EXPIRED`（并在同一事务内落状态），不引入 pg-boss。

---

## 7. `consent_records`

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `uuid` | PK, `DEFAULT uuidv7()` | |
| `family_id` | `uuid` | `NOT NULL`, FK → `families(id)` | 隔离作用域 |
| `guardian_person_id` | `uuid` | `NOT NULL`, FK → `persons(id)` | 监护人 |
| `guardian_account_id` | `uuid` | `NOT NULL`, FK → `accounts(id)` | 同意当时的登录身份 |
| `purpose` | `consent_purpose` | `NOT NULL` | 本 Slice 只允许 UNDER_14 监护人同意 |
| `decision` | `consent_decision` | `NOT NULL` | |
| `version` | `integer` | `NOT NULL`, `CHECK (version >= 1)` | 同一 subject + purpose 单调递增 |
| `onboarding_request_id` | `uuid` | `NOT NULL`, `UNIQUE`, FK → `guardian_consent_requests(id)` | 一次请求恰产出一行 |
| `bound_person_id` | `uuid` | NULL, FK → `persons(id)` | 被同意的未成年人；一次性绑定 |
| `bound_at` | `timestamptz` | NULL | |
| `notice_version` | `text` | `NOT NULL` | |
| `notice_hash` | `text` | `NOT NULL`, `CHECK (notice_hash ~ '^[0-9a-f]{64}$')` | |
| `policy_version` | `text` | `NOT NULL` | |
| `evidence` | `jsonb` | `NOT NULL` | 见下 |
| `decided_at` | `timestamptz` | `NOT NULL DEFAULT now()` | 服务端时间 |
| `supersedes_id` | `uuid` | NULL, FK → `consent_records(id)` | 版本链 |

```sql
CREATE TABLE consent_records (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id              uuid NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  guardian_person_id     uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  guardian_account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  purpose                consent_purpose NOT NULL,
  decision               consent_decision NOT NULL,
  version                integer NOT NULL CHECK (version >= 1),
  onboarding_request_id  uuid NOT NULL UNIQUE
                           REFERENCES guardian_consent_requests(id) ON DELETE RESTRICT,
  bound_person_id        uuid REFERENCES persons(id) ON DELETE RESTRICT,
  bound_at               timestamptz,
  notice_version         text NOT NULL,
  notice_hash            text NOT NULL CHECK (notice_hash ~ '^[0-9a-f]{64}$'),
  policy_version         text NOT NULL,
  evidence               jsonb NOT NULL CHECK (jsonb_typeof(evidence) = 'object'),
  decided_at             timestamptz NOT NULL DEFAULT now(),
  supersedes_id          uuid REFERENCES consent_records(id) ON DELETE RESTRICT,
  CONSTRAINT consent_binding_consistency CHECK (
    (bound_person_id IS NULL) = (bound_at IS NULL)
  ),
  CONSTRAINT consent_no_self_supersede CHECK (supersedes_id IS NULL OR supersedes_id <> id),
  CONSTRAINT consent_subject_not_guardian CHECK (
    bound_person_id IS NULL OR bound_person_id <> guardian_person_id
  )
);

-- 同一未成年人 + 同一 purpose 的版本号唯一（未绑定行为 NULL，不受此约束）
CREATE UNIQUE INDEX consent_subject_version_key
  ON consent_records (bound_person_id, purpose, version)
  WHERE bound_person_id IS NOT NULL;

CREATE INDEX consent_guardian_idx ON consent_records (guardian_person_id, decided_at DESC);
```

**`evidence` 的固定形状**（Zod 校验 + 存储前规范化）：

```json
{
  "channel": "MINIPROGRAM" | "TEST",
  "accepted_text_hash": "<sha256 of the accepted statement>",
  "declared_age_band": "UNDER_14",
  "client_ip_hash": "<hmac-sha256 hex, optional>",
  "user_agent_hash": "<hmac-sha256 hex, optional>"
}
```

不存原始 IP / UA；不存孩子任何资料。

**不可变触发器**：

```sql
CREATE FUNCTION consent_records_guard_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.guardian_person_id  IS DISTINCT FROM OLD.guardian_person_id
  OR NEW.guardian_account_id IS DISTINCT FROM OLD.guardian_account_id
  OR NEW.family_id           IS DISTINCT FROM OLD.family_id
  OR NEW.purpose             IS DISTINCT FROM OLD.purpose
  OR NEW.decision            IS DISTINCT FROM OLD.decision
  OR NEW.version             IS DISTINCT FROM OLD.version
  OR NEW.notice_version      IS DISTINCT FROM OLD.notice_version
  OR NEW.notice_hash         IS DISTINCT FROM OLD.notice_hash
  OR NEW.policy_version      IS DISTINCT FROM OLD.policy_version
  OR NEW.evidence            IS DISTINCT FROM OLD.evidence
  OR NEW.decided_at          IS DISTINCT FROM OLD.decided_at
  OR NEW.supersedes_id       IS DISTINCT FROM OLD.supersedes_id
  OR NEW.onboarding_request_id IS DISTINCT FROM OLD.onboarding_request_id
  THEN
    RAISE EXCEPTION 'CONSENT_RECORD_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF OLD.bound_person_id IS NOT NULL
     AND NEW.bound_person_id IS DISTINCT FROM OLD.bound_person_id THEN
    RAISE EXCEPTION 'CONSENT_BINDING_IS_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER consent_records_guard
  BEFORE UPDATE ON consent_records
  FOR EACH ROW EXECUTE FUNCTION consent_records_guard_update();
```

---

## 8. `person_compliance_profiles`

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `person_id` | `uuid` | PK, FK → `persons(id)` `ON DELETE RESTRICT` | 一人一 profile |
| `age_band` | `age_band` | `NOT NULL` | §7.7A |
| `minor_mode` | `boolean` | `NOT NULL` | 必须与 age_band 一致 |
| `guardian_person_id` | `uuid` | NULL, FK → `persons(id)` | 单值 guardian（§7.7A） |
| `guardian_consent_version` | `integer` | NULL | |
| `guardian_consent_record_id` | `uuid` | NULL, FK → `consent_records(id)` | 当前有效 version 的指向 |
| `verified_source` | `provenance_source` | `NOT NULL` | age_band 的来源载体 |
| `effective_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |
| `created_at` / `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

```sql
CREATE TABLE person_compliance_profiles (
  person_id                   uuid PRIMARY KEY REFERENCES persons(id) ON DELETE RESTRICT,
  age_band                    age_band NOT NULL,
  minor_mode                  boolean NOT NULL,
  guardian_person_id          uuid REFERENCES persons(id) ON DELETE RESTRICT,
  guardian_consent_version    integer CHECK (guardian_consent_version >= 1),
  guardian_consent_record_id  uuid REFERENCES consent_records(id) ON DELETE RESTRICT,
  verified_source             provenance_source NOT NULL,
  effective_at                timestamptz NOT NULL DEFAULT now(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pcp_minor_mode_matches_band
    CHECK (minor_mode = (age_band IN ('MINOR_14_17', 'UNDER_14'))),

  CONSTRAINT pcp_guardian_not_self
    CHECK (guardian_person_id IS NULL OR guardian_person_id <> person_id),

  -- 核心约束：UNDER_14 必须持有 guardian + consent 记录与版本
  CONSTRAINT pcp_under14_requires_consent CHECK (
    age_band <> 'UNDER_14'
    OR (guardian_person_id IS NOT NULL
        AND guardian_consent_record_id IS NOT NULL
        AND guardian_consent_version IS NOT NULL)
  ),

  -- 非 UNDER_14 不得挂 consent 记录（避免陈旧同意残留）
  CONSTRAINT pcp_non_under14_no_consent CHECK (
    age_band = 'UNDER_14' OR guardian_consent_record_id IS NULL
  ),

  CONSTRAINT pcp_consent_version_pair CHECK (
    (guardian_consent_record_id IS NULL) = (guardian_consent_version IS NULL)
  )
);
```

`pcp_under14_requires_consent` 是本 Slice 最关键的结构约束：它使“UNDER_14 profile 但没有同意”在数据库层不可表达。由于 profile 以 `person_id` 引用 Person，且正式 child Person 必须写 profile，因此“先建 Person 再补同意”直接失败（FR-008(a)）。

`pcp_non_under14_no_consent` 防止 `UNDER_14 → 其他 band` 后残留旧同意指针；本 Slice 不提供 band 变更 API，该约束是给未来变更命令的护栏。

---

## 9. `person_profile_values`（per-value provenance）

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `uuid` | PK, `DEFAULT uuidv7()` | |
| `person_id` | `uuid` | `NOT NULL`, FK → `persons(id)` | 资料属于谁 |
| `attribute` | `profile_attribute` | `NOT NULL` | 封闭集合 |
| `value_text` | `text` | `NOT NULL`, `CHECK` 长度 1–120 | |
| `source_kind` | `provenance_source` | `NOT NULL` | §2.2 来源 |
| `provided_by_person_id` | `uuid` | NULL, FK → `persons(id)` | 谁提供 |
| `recorded_by_account_id` | `uuid` | `NOT NULL`, FK → `accounts(id)` | 谁录入系统 |
| `observed_at` | `timestamptz` | NULL | 未知即 NULL |
| `recorded_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |
| `status` | `profile_value_status` | `NOT NULL DEFAULT 'RECORDED'` | |
| `supersedes_id` | `uuid` | NULL, FK → 本表 | 同源替换链 |

```sql
CREATE TABLE person_profile_values (
  id                      uuid PRIMARY KEY DEFAULT uuidv7(),
  person_id               uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  attribute               profile_attribute NOT NULL,
  value_text              text NOT NULL CHECK (length(value_text) BETWEEN 1 AND 120),
  source_kind             provenance_source NOT NULL,
  provided_by_person_id   uuid REFERENCES persons(id) ON DELETE RESTRICT,
  recorded_by_account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  observed_at             timestamptz,
  recorded_at             timestamptz NOT NULL DEFAULT now(),
  status                  profile_value_status NOT NULL DEFAULT 'RECORDED',
  supersedes_id           uuid REFERENCES person_profile_values(id) ON DELETE RESTRICT,

  CONSTRAINT ppv_no_self_supersede CHECK (supersedes_id IS NULL OR supersedes_id <> id),

  -- 人物类来源必须能指到提供者；非人物来源（设备/工作人员/AI）不得伪装成人物提供
  CONSTRAINT ppv_provider_required_for_person_sources CHECK (
    source_kind NOT IN ('SELF_STATEMENT', 'GUARDIAN_OBSERVATION',
                        'GUARDIAN_RELAY', 'OTHER_MEMBER_RELAY')
    OR provided_by_person_id IS NOT NULL
  )
);

CREATE INDEX ppv_current_idx
  ON person_profile_values (person_id, attribute)
  WHERE status = 'RECORDED';
```

**写入规则（应用层 + 测试断言）**：同一 `(person_id, attribute, source_kind)` 的新值插入前，把该组合下 `status='RECORDED'` 的行置为 `SUPERSEDED` 并把 `supersedes_id` 指向被替换行；不同 `source_kind` 的行**不**被替换，保持 `RECORDED` 并存（来源冲突保留）。

**不存在的列**（结构断言测试）：`is_confirmed` / `confirmed_at` / `conflict_flag`。确认与冲突处理属 Case 证据体系（§7.2），本 Slice 不建；缺失列意味着**不会**出现“被伪造的确认状态”。

---

## 10. `business_audit_events`

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `uuid` | PK, `DEFAULT uuidv7()` | |
| `family_id` | `uuid` | `NOT NULL`, FK → `families(id)` | 隔离作用域 |
| `actor_account_id` | `uuid` | `NOT NULL`, FK → `accounts(id)` | |
| `event_type` | `text` | `NOT NULL`, `CHECK` 见下 | |
| `resource_type` | `text` | `NOT NULL` | `FAMILY` / `PERSON` / `CONSENT` |
| `resource_id` | `uuid` | `NOT NULL` | |
| `metadata` | `jsonb` | `NOT NULL DEFAULT '{}'` | 不含孩子 PII |
| `occurred_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

```sql
CREATE TABLE business_audit_events (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id        uuid NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  actor_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  event_type       text NOT NULL CHECK (event_type IN (
                     'FAMILY_CREATED',
                     'MEMBER_CREATED',
                     'MEMBER_PROFILE_VALUE_RECORDED',
                     'CONSENT_REQUEST_CREATED',
                     'CONSENT_GRANTED',
                     'CONSENT_REVOKED')),
  resource_type    text NOT NULL CHECK (resource_type IN ('FAMILY','PERSON','CONSENT')),
  resource_id      uuid NOT NULL,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bae_family_time_idx ON business_audit_events (family_id, occurred_at DESC);
```

事件类型集合是本 Slice 的封闭集合；新增事件类型需要 reviewed migration（保证不会有未定义事件混入）。

---

## 11. `idempotency_keys`

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `uuid` | PK, `DEFAULT uuidv7()` | |
| `actor_account_id` | `uuid` | `NOT NULL`, FK → `accounts(id)` | |
| `command_type` | `text` | `NOT NULL`, `CHECK` 见下 | |
| `idempotency_key` | `text` | `NOT NULL`, `CHECK` 长度 8–128 | |
| `request_hash` | `text` | `NOT NULL`, `CHECK` 64 hex | 规范化 payload 的 sha256 |
| `response_status` | `integer` | `NOT NULL` | |
| `response_body` | `jsonb` | `NOT NULL` | 重放用快照 |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

```sql
CREATE TABLE idempotency_keys (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  actor_account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  command_type      text NOT NULL CHECK (command_type IN (
                      'FAMILY_CREATE','MEMBER_CREATE','MEMBER_UPDATE',
                      'GUARDIAN_CONSENT_REQUEST','GUARDIAN_CONSENT_GRANT',
                      'GUARDIAN_CONSENT_REVOKE')),
  idempotency_key   text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_hash      text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  response_status   integer NOT NULL,
  response_body     jsonb NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT idempotency_scope_key UNIQUE (actor_account_id, command_type, idempotency_key)
);
```

- **无 RLS**：非家庭作用域；只按 `actor_account_id` 读取（D-5.4 / R-5）。
- 幂等键的 `actor` 是 **Account**（§8.5 的 `actor_id`）；同一 Person 换设备仍是同一 Actor，符合“关键命令”的语义。

---

## 12. 关系图

```text
accounts 1 ──── 0..1 persons           (persons.account_id UNIQUE)
accounts 1 ──── *    persons           (persons.created_by_account_id)
persons  1 ──── *    families          (families.created_by_person_id, UNIQUE)
persons  * ──── *    families          (family_members, UNIQUE(family_id, person_id))
persons  1 ──── *    guardian_consent_requests
persons  1 ──── *    consent_records   (guardian_person_id)
persons  1 ──── 0..1 person_compliance_profiles
persons  1 ──── *    person_profile_values
consent_records 1 ── 0..1 person_compliance_profiles (guardian_consent_record_id)
consent_records 1 ── 0..* consent_records           (supersedes_id)
guardian_consent_requests 1 ── 1 consent_records     (UNIQUE onboarding_request_id)
families 1 ──── *    business_audit_events
```

无环：`person_compliance_profiles → consent_records → persons → accounts`；`families → persons`；`family_members → families, persons`（person_id 为可延迟外键）。

---

## 13. RLS 与角色

### 13.1 角色

```sql
-- 由 Compose init / CI 以超级用户执行，不写在业务 migration。
-- 口令由部署期注入（环境变量 / secret file），不得出现在 SQL、repo 或文档中（§4.3）。
CREATE ROLE xiaoshuyin_migrator LOGIN NOBYPASSRLS;
CREATE ROLE xiaoshuyin_app      LOGIN NOBYPASSRLS;
-- 表由 xiaoshuyin_migrator 创建（owner）；xiaoshuyin_app 只获 DML
```

| 检查 | 期望 |
|---|---|
| `pg_roles.rolbypassrls`（app） | `false` |
| `pg_class.relowner`（业务表） | `xiaoshuyin_migrator`，≠ app |
| `has_table_privilege('xiaoshuyin_app', t, 'SELECT')` | `true`（10 张表） |
| `has_table_privilege('xiaoshuyin_app', t, 'TRUNCATE')` | `false` |
| enum `USAGE` | `true` |

### 13.2 辅助函数与上下文入口

```sql
CREATE FUNCTION app_family_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.family_id', true), '')::uuid
$$;

CREATE FUNCTION app_person_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.person_id', true), '')::uuid
$$;

CREATE FUNCTION app_account_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.account_id', true), '')::uuid
$$;

CREATE FUNCTION app_current_purpose() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.purpose', true), '')
$$;
```

三个上下文入口，业务代码不得直接 `set_config`。

```sql
-- ① 身份自助：无 family 上下文（GET /me、GET /compliance/profile、登录后解析 self person）
CREATE FUNCTION app.set_identity_context(p_account_id uuid, p_purpose text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_person uuid;
BEGIN
  IF p_account_id IS NULL OR p_purpose IS NULL OR p_purpose = '' THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.account_id', p_account_id::text, true);
  PERFORM set_config('app.purpose',    p_purpose,          true);

  -- persons 策略含 account_id = app_account_id() 分支；UNIQUE(account_id) 保证 ≤1 行
  SELECT id INTO v_person FROM persons WHERE account_id = p_account_id;
  IF v_person IS NOT NULL THEN
    PERFORM set_config('app.person_id', v_person::text, true);
  END IF;
END $$;

-- ② 家庭作用域：最常见路径
CREATE FUNCTION app.set_family_context(
  p_family_id uuid, p_person_id uuid, p_purpose text
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_family_id IS NULL OR p_person_id IS NULL OR p_purpose IS NULL
     OR p_purpose = '' THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.family_id', p_family_id::text, true);
  PERFORM set_config('app.person_id', p_person_id::text, true);
  PERFORM set_config('app.purpose',   p_purpose,        true);

  -- 上下文已生效，因此该查询受 RLS 约束，只能看到目标家庭的行
  IF NOT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = p_family_id AND person_id = p_person_id
  ) THEN
    RAISE EXCEPTION 'FAMILY_MEMBERSHIP_REQUIRED' USING ERRCODE = '42501';
  END IF;
END $$;

-- ③ 家庭创建引导：家庭与 membership 都还不存在（唯一无 membership 前置的入口）
CREATE FUNCTION app.create_family(
  p_family_id uuid, p_creator_person_id uuid, p_display_name text
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_family_id IS NULL OR p_creator_person_id IS NULL THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.family_id', p_family_id::text, true);
  PERFORM set_config('app.person_id', p_creator_person_id::text, true);
  PERFORM set_config('app.purpose',   'FAMILY_MANAGEMENT',  true);

  -- 受 families WITH CHECK 约束：id = app_family_id() AND created_by_person_id = app_person_id()
  INSERT INTO families (id, display_name, created_by_person_id)
  VALUES (p_family_id, p_display_name, p_creator_person_id);
END $$;
```

**信任边界（必须写进实现注释）**：`set_config` 是内置函数，任何持有 app 角色的连接都能直接调用。GUC 型 RLS 的前提是“应用在 `authorize()` 之后诚实设置上下文”；它防的是**查询遗漏**（忘写 WHERE、JOIN 漏表），不是防恶意应用。§9.1 的定位原文即“防止查询遗漏导致跨家庭泄漏的第二道硬防线”，本设计不夸大其防护范围。

### 13.3 Policy

```sql
ALTER TABLE families                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE families                    FORCE  ROW LEVEL SECURITY;
ALTER TABLE family_members              ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members              FORCE  ROW LEVEL SECURITY;
ALTER TABLE guardian_consent_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_consent_requests   FORCE  ROW LEVEL SECURITY;
ALTER TABLE consent_records             ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records             FORCE  ROW LEVEL SECURITY;
ALTER TABLE persons                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons                     FORCE  ROW LEVEL SECURITY;
ALTER TABLE person_compliance_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_compliance_profiles  FORCE  ROW LEVEL SECURITY;
ALTER TABLE person_profile_values       ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_profile_values       FORCE  ROW LEVEL SECURITY;
ALTER TABLE business_audit_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_audit_events       FORCE  ROW LEVEL SECURITY;

-- 家庭级作用域：仅凭 family 上下文
CREATE POLICY gcr_scope ON guardian_consent_requests
  USING (family_id = app_family_id()) WITH CHECK (family_id = app_family_id());

CREATE POLICY consent_scope ON consent_records
  USING (family_id = app_family_id()) WITH CHECK (family_id = app_family_id());

CREATE POLICY audit_scope ON business_audit_events
  USING (family_id = app_family_id()) WITH CHECK (family_id = app_family_id());

-- families：family 上下文 OR actor 已是该家庭成员；写入只允许给自己建家庭
CREATE POLICY families_scope ON families
  USING (
    id = app_family_id()
    OR EXISTS (SELECT 1 FROM family_members fm
               WHERE fm.family_id = families.id
                 AND fm.person_id = app_person_id())
  )
  WITH CHECK (
    id = app_family_id()
    AND created_by_person_id = app_person_id()
  );

-- family_members：family 上下文 OR 自己的 membership 行（用于解析 current family）
CREATE POLICY family_members_scope ON family_members
  USING (
    family_id = app_family_id()
    OR person_id = app_person_id()
  )
  WITH CHECK (family_id = app_family_id());

-- persons：账号列比对 OR 自身 OR 家庭成员
CREATE POLICY persons_scope ON persons
  USING (
    account_id = app_account_id()
    OR id = app_person_id()
    OR EXISTS (SELECT 1 FROM family_members fm
               WHERE fm.person_id = persons.id
                 AND fm.family_id = app_family_id())
  )
  WITH CHECK (
    -- 只能创建/写入「绑定到当前账号的自己的 Person」，或家庭上下文中的成员
    account_id = app_account_id()
    OR EXISTS (SELECT 1 FROM family_members fm
               WHERE fm.person_id = persons.id
                 AND fm.family_id = app_family_id())
  );

-- 人物子表：自身 OR 家庭成员；写入只允许经家庭上下文
CREATE POLICY pcp_scope ON person_compliance_profiles
  USING (
    person_id = app_person_id()
    OR EXISTS (SELECT 1 FROM family_members fm
               WHERE fm.person_id = person_compliance_profiles.person_id
                 AND fm.family_id = app_family_id())
  )
  WITH CHECK (EXISTS (SELECT 1 FROM family_members fm
                      WHERE fm.person_id = person_compliance_profiles.person_id
                        AND fm.family_id = app_family_id()));

CREATE POLICY ppv_scope ON person_profile_values
  USING (
    person_id = app_person_id()
    OR EXISTS (SELECT 1 FROM family_members fm
               WHERE fm.person_id = person_profile_values.person_id
                 AND fm.family_id = app_family_id())
  )
  WITH CHECK (EXISTS (SELECT 1 FROM family_members fm
                      WHERE fm.person_id = person_profile_values.person_id
                        AND fm.family_id = app_family_id()));
```

**为什么 self 分支是列比对**：`account_id = app_account_id()` 与 `id = app_person_id()` 都是“表列 vs 已验签身份”的比较，不是应用层声明“我有权”。没有这两个分支，`GET /me` 在首次登录（尚无 membership）时会被 RLS 挡成 0 行——那是把合法自助读误杀，不是隔离。

**无任何上下文即空集**：三个 GUC 全未设置时，所有谓词求值为 `NULL` → 0 行。默认拒绝。

**写入的 self 分支只有一个用途**：`persons.WITH CHECK` 允许 `account_id = app_account_id()`，即「只能创建绑定到当前账号的自己的 Person」。它不允许创建 `account_id IS NULL` 的成员（那必须走 membership 分支），也不允许把 Person 绑到别的账号。`person_compliance_profiles` / `person_profile_values` / `family_members` 的 `WITH CHECK` 仍然只认 membership 与 family 上下文——self 上下文对它们只读。

**两条不同的插入顺序（各有原因）**：

| 命令 | 顺序 | 原因 |
|---|---|---|
| `POST /families` | Person（自己）→ Family → membership → profile → values → audit | `families.created_by_person_id` 是即时外键，Person 必须先存在 |
| `POST /families/:id/members` | membership → Person（无账号成员）→ profile → values → audit | 成员的 Person `account_id IS NULL`，无法走 self 分支，只能靠已存在的 membership 通过 `WITH CHECK` |

因此 `family_members.person_id` 的外键声明为 `DEFERRABLE INITIALLY DEFERRED`（提交时校验），而 `families.created_by_person_id` 保持即时校验。

**递归终止**：`family_members` 的 `USING` 只引用 GUC；`families` 引用 `family_members`；`family_members` 不引用 `families`。链条单向，无 `infinite recursion`。

**没有 RLS 的两张表**：`accounts`、`idempotency_keys`。理由与补偿控制见 `plan.md` D-5.4 / R-5。

---

## 14. 约束到需求的映射

| 约束 | 满足的 FR / 场景 |
|---|---|
| `persons.account_id UNIQUE` | FR-016、场景 14、SC-007 |
| `family_members UNIQUE(family_id, person_id)` | FR-017、场景 12、SC-006 |
| `persons` 无 `family_id` 列 | FR-017、场景 11、SC-006 |
| `persons` 无来源列 + `person_profile_values` 逐值来源 | FR-003、场景 3、SC-008 |
| `ppv_provider_required_for_person_sources` | FR-003 / §5 不变量 4（转述不得冒充本人） |
| `profile_attribute` 不含 `AGE_BAND` | D-4（单一载体） |
| `pcp_under14_requires_consent` | FR-008(a)、场景 4、D-3.5 |
| `pcp_minor_mode_matches_band` | FR-007 / §7.7A |
| `consent_records` 不可变触发器 | FR-010、V1-C39 证据强度 |
| `consent_subject_version_key` | FR-010、并发下版本唯一 |
| `families.created_by_person_id UNIQUE` | R-2（单家庭自有） |
| `idempotency_scope_key` | FR-014、SC-005 |
| FORCE RLS + `set_identity_context` / `set_family_context` / `create_family` | FR-012 / FR-013、场景 7、9 |
