# Slice 8 Data Model — `problem_formulations`

> Planning artifact. No DDL is executed by this document.

## 1. Decision summary

Slice 8 adds exactly:

- one enum: `problem_formulation_status`;
- one business table: `problem_formulations`;
- no pointer table;
- no Evidence-ref relation table;
- no generic dependency table;
- no Assessment/Scene/Goal/Plan/Task/Risk/UI object.

The version row itself is the immutable business snapshot. Lifecycle/response fields may change under column-level runtime privileges; content cannot be updated after insert.

---

## 2. Enum

Exact frozen order:

```sql
DRAFT
PRESENTED
CONFIRMED
DISPUTED
NEEDS_REVIEW
SUPERSEDED
```

The type keeps `DRAFT` because it is part of the frozen vocabulary. Slice 8 does not persist observable DRAFT rows; a table CHECK rejects at-rest `DRAFT`.

---

## 3. Logical table

```text
problem_formulations
├── id                          uuid PK, server uuidv7
├── family_id                   uuid NOT NULL
├── case_id                     uuid NOT NULL
├── version                     integer NOT NULL
├── status                      problem_formulation_status NOT NULL
│
├── primary_problem             jsonb NOT NULL
├── key_factors                 jsonb NOT NULL
├── evidence_refs               jsonb NOT NULL
├── unknowns                    jsonb NOT NULL
├── conflicts                   jsonb NOT NULL
├── scene_fit                   text NOT NULL
├── alternative_explanations    jsonb NOT NULL
├── reassessment_conditions      jsonb NOT NULL
├── exit_conditions              jsonb NOT NULL
│
├── user_response               jsonb NULL
├── confirmed_by_person_id      uuid NULL
├── confirmed_at                timestamptz NULL
├── dependency_refs             jsonb NOT NULL
│
├── supersedes_version          integer NULL
├── created_at                  timestamptz NOT NULL DEFAULT now()
└── updated_at                  timestamptz NOT NULL DEFAULT now()
```

`confirmed_by_person_id` is the storage name for frozen `confirmed_by`; the public contract exposes `confirmedBy`.

---

## 4. JSON shapes

All JSON contracts are also represented by strict Zod/OpenAPI schemas. DB CHECKs prove top-level type/required structural facts; semantic cross-reference validation remains in Domain code because refs are heterogeneous.

### 4.1 EvidenceRef

```ts
type EvidenceRef =
  | { type: 'DIALOGUE_MESSAGE'; id: UUID }
  | { type: 'ASSERTION'; id: UUID }
  | { type: 'OBSERVATION'; id: UUID };
```

Canonical ordering for hashing/persistence is deterministic: de-duplicate identical `(type,id)` pairs and preserve a canonical sort by `type,id` before request hashing and insert.

### 4.2 PrimaryProblem

```ts
{
  text: string;          // trim() non-empty
  evidenceRefs: EvidenceRef[]; // >= 1 positive supporting ref
}
```

All `evidenceRefs` must also appear in top-level `evidence_refs`.

### 4.3 KeyFactor

```ts
{
  text: string;          // trim() non-empty
  evidenceRefs: EvidenceRef[]; // >= 1 positive supporting ref
}
```

`key_factors` is an explicit array and may be empty. A missing field is invalid.

### 4.4 Unknown

```ts
{
  topic: string; // trim() non-empty
  state: 'UNKNOWN' | 'NOT_COLLECTED' | 'DECLINED';
  evidenceRefs: EvidenceRef[];
}
```

- `UNKNOWN` / `DECLINED` originating from an Observation must include that Observation ref.
- an explicit `NOT_COLLECTED` item may have an empty ref array only when it is truly an explicit not-collected state rather than an invented answer.
- empty string, `0`, `false`, guessed value and `NOT_APPLICABLE` cannot be substituted for an unknown.

### 4.5 Conflict

```ts
{
  topic: string; // trim() non-empty
  conflictGroupId?: UUID;
  evidenceRefs: EvidenceRef[]; // >= 2 distinct refs when no group expands the set
}
```

The validator resolves the group/refs and proves the competing sides are retained. It never picks a winner.

### 4.6 Alternative explanation / reassessment / exit conditions

Each is an explicit array of structured text items:

```ts
{ text: string }
```

Empty array is valid. Missing field or blank item is invalid.

No Scene-specific enum or Digital Use node id is introduced.

### 4.7 UserResponse

Server-owned latest response:

```ts
{
  kind: 'CONFIRM' | 'DISPUTE' | 'CORRECTION';
  actorPersonId: UUID;
  respondedAt: ISODateTime; // DB/server time
  note?: string;
}
```

The client may only supply `note` on a public response operation. `kind`, actor and time are created by the server.

`Present` creates `user_response = NULL`.

A later response replaces `user_response` on the same current row because the frozen field is the **latest** response fact. Superseded versions preserve whatever response fact they had at supersession time.

### 4.8 DependencyRef

```ts
type DependencyRef =
  | { type: 'EVIDENCE'; evidence: EvidenceRef }
  | { type: 'CONSENT'; id: UUID; version?: number }
  | { type: 'POLICY'; key: string; version: string }
  | { type: 'PACKAGE'; key: string; version: string }
  | { type: 'CONTENT_VERSION'; key: string; version: string };
```

A `DependencyRef` is a traceable identity/version reference, never embedded dependency body text.

`EVIDENCE` dependencies are validated through the same Evidence resolver. Other types are validated whenever authoritative current-main data can determine validity; absence of a registry is not treated as “verified true”.

---

## 5. Constraints

### 5.1 Identity and Case scope

Planned constraints:

```text
PRIMARY KEY (id)
UNIQUE (case_id, version)
FOREIGN KEY (case_id, family_id) REFERENCES cases(id, family_id) ON DELETE RESTRICT
CHECK version >= 1
```

The formulation cannot migrate between Case or Family.

### 5.2 Version chain

```text
CHECK (
  (version = 1 AND supersedes_version IS NULL)
  OR
  (version > 1 AND supersedes_version = version - 1)
)
```

and a self composite FK:

```text
FOREIGN KEY (case_id, supersedes_version)
  REFERENCES problem_formulations(case_id, version)
  ON DELETE RESTRICT
```

Because every successor must target its immediate predecessor and version is unique per Case, self-loop, skip and cycle are structurally impossible.

### 5.3 Current fence

```text
UNIQUE INDEX problem_formulations_one_current_per_case
ON problem_formulations(case_id)
WHERE status <> 'SUPERSEDED';
```

This means at most one row per Case can be non-superseded.

`current` is still defined by the version chain's terminal node, not by a separate pointer. Repository code verifies that the terminal row is the sole non-superseded row; mismatch is an internal invariant failure.

### 5.4 No persisted DRAFT

```text
CHECK (status <> 'DRAFT')
```

This is a Slice 8 reachability constraint, not a seventh state. `DRAFT` remains in the enum so the frozen vocabulary is unchanged.

### 5.5 Confirmation pair

```text
CHECK ((confirmed_by_person_id IS NULL) = (confirmed_at IS NULL))
```

Status consistency:

```text
CONFIRMED             => confirmed pair present
PRESENTED             => confirmed pair absent
DISPUTED              => confirmed pair absent
NEEDS_REVIEW          => confirmed pair absent
SUPERSEDED            => pair may be present or absent (historical state preserved)
DRAFT                 => rejected by at-rest CHECK
```

Composite membership FK:

```text
FOREIGN KEY (family_id, confirmed_by_person_id)
REFERENCES family_members(family_id, person_id)
ON DELETE RESTRICT
```

The FK proves Family membership only. Application authorization proves current manager authority.

### 5.6 JSON top-level shape

DB-level CHECKs require:

- `primary_problem` object;
- `key_factors`, `evidence_refs`, `unknowns`, `conflicts`, `alternative_explanations`, `reassessment_conditions`, `exit_conditions`, `dependency_refs` arrays;
- `evidence_refs` non-empty;
- `user_response` NULL or object;
- `scene_fit` nonblank after trim.

Do not attempt to encode the entire Zod/domain grammar in SQL JSONPath. Semantic validation belongs to Domain code; DB remains a defense-in-depth structural layer.

---

## 6. Indexes

Planned minimum indexes:

```text
UNIQUE (case_id, version)
UNIQUE partial one-current-per-case (case_id WHERE status <> SUPERSEDED)
INDEX (family_id, case_id)
INDEX (case_id, version DESC)
INDEX (case_id, supersedes_version) WHERE supersedes_version IS NOT NULL
```

No GIN index is added to formulation JSON in V1 because Slice 8 has no search/filter query over JSON content. Add only after a measured query need.

---

## 7. RLS

`problem_formulations`:

```text
ENABLE ROW LEVEL SECURITY
FORCE ROW LEVEL SECURITY
```

Policies:

```text
problem_formulations_select
  FOR SELECT USING (family_id = app_family_id())

problem_formulations_insert
  FOR INSERT WITH CHECK (family_id = app_family_id())

problem_formulations_update
  FOR UPDATE
  USING (family_id = app_family_id())
  WITH CHECK (family_id = app_family_id())
```

No DELETE policy.

RLS does not encode “manager”, primary, Safety, phase or status. Those remain application/domain authorization and transition guards, consistent with existing architecture.

---

## 8. Runtime privileges

`xiaoshuyin_app`:

```text
GRANT SELECT, INSERT ON problem_formulations
GRANT UPDATE(status, user_response, confirmed_by_person_id, confirmed_at, updated_at)
  ON problem_formulations
GRANT USAGE ON TYPE problem_formulation_status
```

No DELETE, no TRUNCATE, no schema CREATE, no table ownership.

`cases` receives only:

```text
GRANT UPDATE(phase, version, updated_at) ON cases
```

Existing primary-switch column grants remain unchanged. `has_table_privilege('xiaoshuyin_app','cases','UPDATE')` must remain false.

---

## 9. Repository operations

Planned SQL seams in `packages/domain/src/problem-formulations.ts`:

```text
getCurrentProblemFormulation(caseId)
getProblemFormulationByVersion(caseId, version)
lockCurrentProblemFormulation(caseId)
insertProblemFormulationVersion(...)
transitionProblemFormulationStatus(expectedStatus, nextStatus, ...)
markCurrentFormulationSuperseded(...)

lockCaseForProblemFormulation(caseId)
advanceCasePhaseAndVersion(expectedVersion, fromPhase, toPhase)
bumpCaseVersionWithoutPhaseChange(expectedVersion)

resolveEvidenceRefs(...)
findAssertionSuccessors(...)
findObservationSuccessors(...)
hasTraceableProblemStatement(caseId)
```

Every mutating repository function uses conditional predicates or locked rows and checks affected-row count. A zero-row conditional update is a conflict/invariant signal, never “last write wins”.

---

## 10. Current-version algorithms

### 10.1 First Present

Under Family + Case lock:

1. no current row exists;
2. allocate version 1;
3. insert full `PRESENTED` row;
4. update Case phase/version;
5. event/audit/idempotency;
6. commit.

### 10.2 Present after Reassess

Under locks:

1. existing current formulation remains intact during ASSESSMENT;
2. validate new candidate;
3. set old current status `SUPERSEDED`;
4. insert `old.version+1`, `supersedes_version=old.version`, `PRESENTED`;
5. update Case phase/version;
6. event/audit/idempotency;
7. commit.

The old status update occurs before the insert to satisfy the partial unique current fence; transaction rollback restores old current if insert/event/audit fails.

### 10.3 Correction

Same sequence as Present-after-Reassess, except:

- Case remains `PROBLEM_FORMULATION`;
- new content is `old complete content + strict patch`, then fully revalidated;
- new `user_response` = server-created CORRECTION fact;
- confirmation pair always NULL on the new version.

### 10.4 Confirm / Dispute

No new formulation version.

- conditional status transition on the locked current row;
- update only permitted lifecycle columns;
- bump Case version;
- Confirm also advances Case phase to GOALS.

### 10.5 Reassess

No formulation row update at all.

- current formulation remains the sole current row with identical status/version/content;
- only Case phase/version change.

---

## 11. Evidence validity query semantics

For Assertion/Observation ref `R` at server timestamp `T`:

```text
visible under current Family RLS
AND R.case_id == target Case
AND (valid_from IS NULL OR valid_from <= T)
AND (valid_until IS NULL OR valid_until > T)
AND NOT EXISTS successor S with S.supersedes_id = R.id
```

For Dialogue Message:

```text
visible under Family RLS
AND message.case_id == target Case
```

Additional semantic classification:

- Observation state `UNKNOWN/NOT_COLLECTED/DECLINED` is unknown, not positive support.
- Assertion/Observation in an unresolved conflict group is conflict-bearing and cannot alone serve as a resolved positive fact.
- a disputed Evidence confirmation status is not silently treated as confirmed positive support.

The precise resolver returns enough classified metadata for the formulation validator; it does not copy Evidence content into formulation audit metadata.

---

## 12. Migration ownership and rollback

`008_problem_formulation_core.sql` owns:

- `problem_formulation_status`;
- `problem_formulations`;
- its constraints/indexes/RLS policies/grants;
- additive `cases.phase/version/updated_at` grant;
- additive branches/values in existing event/audit/idempotency CHECKs.

It does **not** own or rewrite prior domain data.

For test-only rollback evidence, reverse only 008's additions after proving there are no formulation rows. Once real formulation data exists, recovery is forward-only.

---

## 13. Data-model acceptance checks

The pre-development auditor must be able to answer PASS/FAIL for each:

1. one table and one enum only;
2. enum exact six labels/order;
3. no current pointer;
4. version monotonic and unique;
5. predecessor chain structurally contiguous;
6. at most one current;
7. history rows not deletable by runtime;
8. content not runtime-updatable;
9. confirmation pair/status consistency;
10. same-Family Case and confirmer integrity;
11. RLS ENABLE+FORCE;
12. no-context/wrong-Family direct SQL protection;
13. no generic dependency graph or Evidence duplicate model;
14. all frozen content fields represented;
15. no out-of-scope placeholder columns/relations.
