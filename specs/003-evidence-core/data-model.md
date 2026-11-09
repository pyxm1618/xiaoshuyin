# Data Model — 003-evidence-core

**阶段**: Plan  
**边界**: 只设计 `dialogue_messages` / `assertions` / `observations` 及必要 enum / constraints / indexes / RLS / provenance relationships。本文不是 migration。

## 1. Reused type

`provenance_source` 直接复用 Slice 1 final enum；Slice 3 不复制第二套 source taxonomy。Implement Gate 必须核对 final 值。

## 2. New enums

### `assertion_kind`

```text
STATEMENT
FACT
HYPOTHESIS
```

恰三值；不含 OBSERVATION。

### `observation_value_state`

```text
KNOWN
UNKNOWN
NOT_COLLECTED
DECLINED
NOT_APPLICABLE
```

### `observation_value_type`

```text
TEXT
NUMBER
BOOLEAN
```

### `evidence_time_state`

```text
KNOWN
UNKNOWN
```

### `evidence_confirmation_status`

```text
UNCONFIRMED
SOURCE_CONFIRMED
DISPUTED
```

## 3. `dialogue_messages`

| column | type | rule |
|---|---|---|
| id | uuid | PK DEFAULT uuidv7() |
| family_id | uuid | NOT NULL, FK families |
| case_id | uuid | NOT NULL |
| actor_account_id | uuid | NOT NULL, FK accounts |
| source_person_id | uuid | NOT NULL |
| content | text | NOT NULL |
| recorded_at | timestamptz | NOT NULL DEFAULT now() |

Constraints：
- content 1..8000 且 `btrim(content)` 非空。
- `UNIQUE(id,family_id,case_id)`。
- `(case_id,family_id) -> cases(id,family_id)`。
- `(family_id,source_person_id) -> family_members(family_id,person_id)`。
- actor↔source person由 authenticated domain context 验证。
- runtime SELECT/INSERT only。

Indexes：
- `(case_id,recorded_at ASC,id ASC)`
- `(family_id,source_person_id,recorded_at DESC)`

## 4. Shared Evidence provenance columns

`assertions` / `observations` 各自显式持有：

```text
family_id uuid NOT NULL
case_id uuid NOT NULL
subject_person_id uuid NULL
source_kind provenance_source NOT NULL
source_person_id uuid NULL
source_message_id uuid NULL
occurred_time_state evidence_time_state NOT NULL
occurred_at timestamptz NULL
recorded_at timestamptz NOT NULL DEFAULT now()
valid_from timestamptz NULL
valid_until timestamptz NULL
confirmation_status evidence_confirmation_status NOT NULL
supersedes_id uuid NULL
conflict_group_id uuid NULL
```

Checks：
- KNOWN occurred time ↔ occurred_at non-null；UNKNOWN ↔ NULL。
- `valid_until > valid_from` when both non-null。
- Slice 1 既有 person-origin source kinds 明确为 `SELF_STATEMENT`、`GUARDIAN_OBSERVATION`、`GUARDIAN_RELAY`、`OTHER_MEMBER_RELAY`；这些值要求 `source_person_id` non-null。
- 当前 Slice production 对 `MANUAL_DEVICE_DATA`、`STAFF_RECORD`、`AI_HYPOTHESIS`、`SOURCE_CONFIRMED` 全部 fail closed；对应当前 writer contract 中 `source_person_id` 也 forbidden。完整 writer/relationship matrix 见 `contracts/evidence-domain.md`。
- source_message_id non-null时 source_person_id 也 non-null；repository验证 source person 与 message source 一致。

## 5. `assertions`

额外列：

```text
id uuid PK DEFAULT uuidv7()
kind assertion_kind NOT NULL
content text NOT NULL
```

content 1..8000 且 non-whitespace。

FK：
- `(case_id,family_id) -> cases(id,family_id)`
- `(family_id,subject_person_id) -> family_members(family_id,person_id)`
- `(family_id,source_person_id) -> family_members(family_id,person_id)`
- `(source_message_id,family_id,case_id) -> dialogue_messages(id,family_id,case_id)`
- `(supersedes_id,family_id,case_id) -> assertions(id,family_id,case_id)`
- no self supersede
- `UNIQUE(id,family_id,case_id)`

Indexes：case+recorded、case+subject、source_message、conflict_group、supersedes、valid_until。

FACT 结构上可表达；production domain 不提供 caller-selectable kind writer。

数据库最后防线：runtime app role 对 `assertions` 的 INSERT policy 必须包含：

```text
family_id = app_family_id()
AND kind <> 'FACT'
```

因此即使内部代码绕过 domain helper、直接使用 runtime DB client，`kind='FACT'` 仍由 PostgreSQL 拒绝。STATEMENT/HYPOTHESIS 在其它校验通过时可写。FACT test fixture 只能使用隔离的 migrator/test privileged context；future Fact Confirmation Slice 若要开放 FACT，必须显式修改该 policy/contract。

## 6. `observations`

额外列：

```text
id uuid PK DEFAULT uuidv7()
observation_code text NOT NULL
value_state observation_value_state NOT NULL
value_type observation_value_type NULL
value_text text NULL
value_number numeric NULL
value_boolean boolean NULL
unit text NULL
```

`observation_code` pattern：`^[a-z][a-z0-9_.-]{0,127}$`。它只是稳定 identifier，不是 ontology。

Typed-value CHECK：

- KNOWN → value_type non-null，且三个 value columns 恰一个 non-null；
- TEXT ↔ only value_text；
- NUMBER ↔ only value_number；
- BOOLEAN ↔ only value_boolean；
- UNKNOWN/NOT_COLLECTED/DECLINED/NOT_APPLICABLE → value_type/value columns/unit 全 NULL；
- unit 仅 KNOWN NUMBER 可非空。

因此 numeric 0 与 boolean false 都是明确 KNOWN value；UNKNOWN 不靠 null 推断。

FK/索引与 assertions 对称，并增加 `(case_id,observation_code,recorded_at DESC)`。

## 7. Conflict group

不新增 table。`conflict_group_id uuid` 为 opaque association。

Domain invariants：
1. 一次 group 操作至少 2 refs；
2. 全部同 Family/Case；
3. 可跨 assertions/observations；
4. 已有 non-null group不可移组；
5. 无 winner/rank/confidence；
6. assignment 不改变 kind/value/provenance/confirmation。

Runtime privilege：`UPDATE(conflict_group_id)` only。

## 8. Supersedes / currentness

Assertion只 supersede Assertion；Observation只 supersede Observation。旧 row不 UPDATE/DELETE，尤其 runtime 不得 UPDATE 已有 row 的 `supersedes_id`。新 row 只指向已存在旧 row，因此 append-only insert direction + no supersedes UPDATE 结构性阻止正常 production path 形成 cycle；只需验证 self-reference reject、旧 row supersedes mutation reject 与 production path 无法成环，不设计 graph cycle detector。

Currentness 至少考虑：

```text
(valid_from IS NULL OR valid_from <= now)
AND (valid_until IS NULL OR now < valid_until)
AND no successor referencing this row
```

Evidence Core 不自动把 current evidence 升级成 FACT。

## 9. RLS

三表均：

```sql
ENABLE ROW LEVEL SECURITY;
FORCE ROW LEVEL SECURITY;
```

Policies 按命令分开规划：

```text
SELECT / allowed UPDATE:
  USING family_id = app_family_id()

dialogue_messages / observations INSERT:
  WITH CHECK family_id = app_family_id()

assertions INSERT:
  WITH CHECK (
    family_id = app_family_id()
    AND kind <> 'FACT'
  )
```

最后一条是 Q5 的数据库 capability guard，不是 FACT confirmation workflow。RLS 仍不判断 manager/Participant/guardian/Purpose，也不把任何 row “确认成 FACT”；application/domain authorization 仍先行。

## 10. Runtime grants

| table | SELECT | INSERT | UPDATE | DELETE |
|---|---:|---:|---:|---:|
| dialogue_messages | yes | yes | no | no |
| assertions | yes | yes — 但 INSERT RLS 硬拒绝 `kind='FACT'` | conflict_group_id only | no |
| observations | yes | yes | conflict_group_id only | no |

## 11. Business audit extension

既有 `business_audit_events` 不新增列。

新增 whitelist：

```text
event_type: MESSAGE_RECORDED, ASSERTION_RECORDED, OBSERVATION_RECORDED
resource_type: DIALOGUE_MESSAGE, ASSERTION, OBSERVATION
```

metadata 固定 `{}`，不得含正文/PII。

## 12. Idempotency extension

既有 `idempotency_keys` 不新增列：

```text
command_type += CASE_MESSAGE_CREATE
```

唯一 scope、RLS、response snapshot 沿用 Slice 1 final。

## 13. Explicitly absent schema

不得新增 `evidence_items`、`case_participants`、`assessments`、`problem_formulations`、`scene_node_states`、`scene_artifacts`、`goals`、`plans`、`tasks`、Safety、AI、Memory、Embedding、Notification 表或 future placeholder columns。
