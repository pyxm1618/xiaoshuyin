# Data Model — Slice 3 Evidence Core

**Status**: Plan artifact — no migration executed

## 1. Reused Types

必须复用 Slice 1：

```sql
provenance_source = (
  SELF_STATEMENT,
  GUARDIAN_OBSERVATION,
  GUARDIAN_RELAY,
  OTHER_MEMBER_RELAY,
  MANUAL_DEVICE_DATA,
  STAFF_RECORD,
  AI_HYPOTHESIS,
  SOURCE_CONFIRMED
)
```

不得创建第二个来源 enum。

## 2. New Enums

```sql
CREATE TYPE assertion_kind AS ENUM (
  'STATEMENT',
  'FACT',
  'HYPOTHESIS'
);

CREATE TYPE assertion_confirmation_status AS ENUM (
  'UNCONFIRMED',
  'CONFIRMED',
  'DISPUTED'
);

CREATE TYPE observation_value_state AS ENUM (
  'KNOWN',
  'UNKNOWN',
  'NOT_COLLECTED',
  'DECLINED',
  'NOT_APPLICABLE'
);
```

这些是 Plan 设计，不代表对应 public 功能全部可达。

## 3. dialogue_messages

逻辑结构：

```sql
dialogue_messages (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id uuid NOT NULL,
  case_id uuid NOT NULL,
  author_person_id uuid NOT NULL,
  content text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
)
```

关键约束：

- `content <> ''`（trim 规则由 API schema执行）；
- `(case_id, family_id)` 必须指向同一真实 Case；
- author来自已验证 actor；客户端不能直接指定；
- 无 UPDATE/DELETE public contract。

## 4. assertions

```sql
assertions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id uuid NOT NULL,
  case_id uuid NOT NULL,
  kind assertion_kind NOT NULL,
  content text NOT NULL,
  source_kind provenance_source NOT NULL,
  subject_person_id uuid NOT NULL,
  source_person_id uuid,
  source_message_id uuid,
  occurred_at timestamptz,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  valid_from timestamptz,
  valid_until timestamptz,
  confirmation_status assertion_confirmation_status NOT NULL DEFAULT 'UNCONFIRMED',
  supersedes_id uuid,
  conflict_group_id uuid
)
```

约束：

- kind 不能为 OBSERVATION；
- source_message必须同Case/Family；
- supersedes必须同Case/Family且不能self；
- `valid_until >= valid_from`（两者都有时）；
- old row content/source/time immutable；
- public Slice 3 path不能创建 FACT/CONFIRMED。

## 5. observations

```sql
observations (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id uuid NOT NULL,
  case_id uuid NOT NULL,
  content text,
  value_state observation_value_state NOT NULL,
  source_kind provenance_source NOT NULL,
  subject_person_id uuid NOT NULL,
  source_person_id uuid,
  source_message_id uuid,
  occurred_at timestamptz,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  valid_from timestamptz,
  valid_until timestamptz,
  supersedes_id uuid,
  conflict_group_id uuid
)
```

约束：

```text
value_state = KNOWN            => content required
value_state != KNOWN           => content may be NULL; no synthetic 0/false/"none"
valid_until >= valid_from
supersedes_id != id
source_message / supersedes remain same Case + Family
```

## 6. Family / Case Ownership

三表都直接带 `family_id`，但这不是业务归属第二真相源；它用于 RLS 和 composite FK。

要求：

```text
child.family_id == cases.family_id
child.case_id == cases.id
```

必要时在 `cases(id, family_id)` 增加 supporting UNIQUE 供复合 FK 使用。

## 7. Person References

`subject_person_id` / `source_person_id` 不能只因 UUID 存在就视为合法。

实现必须验证：

- person存在；
- caller已在当前 Family transaction；
- source语义与person关系合法；
- UNDER_14 gate已由 Slice 1正式 Person建立流程保证；
- Participant权限未交付前，不开放child actor HTTP写路径。

不新建person role enum。

## 8. Conflict

`conflict_group_id` 是关联ID，不是“赢家ID”。

同一 conflict group：

- 可以有2+条记录；
- 所有记录保留；
- 不要求同kind，但调用方必须有业务理由；
- 本 Slice不提供 conflict resolution public API。

## 9. Supersession

- same entity type only；
- new row points old row；
- no self；
- repository在写入前检查直接cycle；
- 本 Slice至少保证线性常规链；复杂图/cycle检查在domain测试覆盖；
- old row不DELETE。

## 10. RLS

三表：

```sql
ENABLE ROW LEVEL SECURITY;
FORCE ROW LEVEL SECURITY;

USING (family_id = app_family_id())
WITH CHECK (family_id = app_family_id())
```

Runtime role：

- SELECT
- INSERT
- 不授予 DELETE
- UPDATE 如非本 Slice实际需要则不授予

## 11. Indexes

最小：

```text
dialogue_messages(case_id, recorded_at, id)
assertions(case_id, recorded_at, id)
assertions(conflict_group_id) WHERE conflict_group_id IS NOT NULL
assertions(supersedes_id) WHERE supersedes_id IS NOT NULL
observations(case_id, recorded_at, id)
observations(conflict_group_id) WHERE conflict_group_id IS NOT NULL
observations(supersedes_id) WHERE supersedes_id IS NOT NULL
```

不加search/vector index。

## 12. Explicitly Absent

- problem_formulations
- scene_node_states / scene_artifacts
- case_participants
- goals / plans / tasks
- ai_runs / memory
- evidence_items supertable
- generic evidence public CRUD
