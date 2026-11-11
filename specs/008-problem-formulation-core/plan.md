# Implementation Plan: 008-problem-formulation-core

> Planning artifact only. This document does not authorize implementation. It becomes eligible for freezing only after a new independent pre-development audit passes.

## 0. Immutable inputs and planning gate

### 0.1 Independently verified frozen input

Repository: `pyxm1618/xiaoshuyin`

| Item | Independently verified result |
|---|---|
| Implementation baseline | `main@e8add9013bd1a71fd6496fa2dc22243ed061cba5` |
| Current `main` vs pinned baseline | identical (`ahead=0`, `behind=0`) |
| Frozen Spec branch | `spec/008-problem-formulation-core` |
| Frozen Spec commit | `6a0df0021cf4dd0f489178a192479a52ea6027f4` |
| Spec branch vs implementation baseline | `ahead=1`, `behind=0` |
| Changed files on Spec branch | exactly `specs/008-problem-formulation-core/spec.md` |
| Frozen Spec diff | one new file, 963 lines |

**Frozen input gate: PASS.** No implementation truth is taken from the Spec branch except the frozen `spec.md` itself.

### 0.2 Authority order re-read

The following were re-read from the pinned implementation baseline:

1. `Docs/总产品需求.md`
2. `Docs/V1产品需求.md`
3. `Docs/总体技术架构.md`
4. `Docs/V1技术设计.md`
5. `specs/002-case-core/**`
6. `specs/003-evidence-core/**`
7. `specs/004-case-participant-core/**`
8. `specs/007-case-primary-switch/**`
9. current implementation under `packages/**`, `apps/server/api/**`, `db/migrations/**`, `scripts/**`, `tests/**`

Authority remains:

```text
总产品需求
→ V1产品需求
→ 总体技术架构
→ V1技术设计
→ Frozen Slice 8 Spec
→ this Plan / Checklist / Tasks
→ future Implementation
```

No material `Frozen Spec ↔ authoritative Docs` conflict was found. Owner Clarifications OC-1/2/3 narrow an implementation boundary without contradicting upstream contracts.

### 0.3 Planning blockers

No blocker from the frozen blocker list is open:

- Correction semantics are unique enough to implement: patch request → server merges against current immutable version → validates full result → persists a complete new version.
- current-version invariant is defined without a pointer table.
- all six formulation states and their legal transitions are explicit.
- Reassess keeps the current formulation unchanged and moves only Case phase back to `ASSESSMENT`.
- all mutation actors are real authenticated Account/Person contexts; no system/AI actor is introduced.
- public/internal API boundary is closed: exactly four public formulation endpoints; Start/Present/Reassess are internal.

**Open Product Decisions: 0.**

---

## 1. Goal and hard scope

Slice 8 establishes the Common Core `Problem Formulation` aggregate: versioned, auditable, correctable, disputable, confirmable, re-enterable into Assessment, primary/Safety guarded, Evidence-faithful, RLS isolated, idempotent and concurrency-safe.

It also contains the minimum internal phase bridge `StartAssessment` solely so the frozen Problem Formulation flow is reachable in real runtime.

It does **not** implement Assessment content, Digital Use Scene, AI, RAG, Goal, Plan, Task, Review, Safety runtime, WAITING/LOST_CONTACT lifecycle, UI, notification, dependency propagation engine, or a generic artifact graph.

---

## 2. Reused implementation truth

### 2.1 Case Core / Primary

Existing and reused:

- `cases(id, family_id, status, phase, is_primary, version, ...)`
- `cases_id_family_key UNIQUE(id, family_id)`
- `cases_one_primary_open_per_family` partial unique index
- `case_events` append-only history with strict event-type and metadata CHECKs
- Slice 7 canonical Family serialization point and `SwitchPrimaryCase` locking discipline
- existing five-state `case_status`: `OPEN / WAITING / LOST_CONTACT / SAFETY_HOLD / CLOSED`
- no Case-level `PAUSED`

Slice 8 does not create a second primary truth source.

### 2.2 Evidence Core

Existing and reused read-only facts:

- `dialogue_messages`
- `assertions` (`STATEMENT / FACT / HYPOTHESIS`, validity windows, supersedes, conflict group)
- `observations` (`KNOWN / UNKNOWN / NOT_COLLECTED / DECLINED / NOT_APPLICABLE`, validity windows, supersedes, conflict group)

Slice 8 creates no second Evidence model and does not mutate Evidence rows.

### 2.3 Authorization / RLS

Existing and reused:

- single `authorize()` entry point
- route adapter `requireFamilyAction()` / `decideFamilyAction()`
- `withRlsTransaction()`
- Family manager fact = `families.created_by_person_id`
- runtime role `xiaoshuyin_app` is not table owner and has `NOBYPASSRLS`

Slice 8 adds Case-scoped actions to the closed authorization registry; it does not create RBAC, Case roles, a Visibility Matrix, or a new Purpose.

### 2.4 Idempotency

Existing and reused:

- `idempotency_keys`
- logical scope `(actor_account_id, command_type, idempotency_key)`
- `Idempotency-Key` header, 8–128 characters
- canonical request hashing
- byte-exact UTF-16LE key representation already used by newer Case mutation commands
- slot reservation / completion helpers

No second idempotency table or cache is allowed.

### 2.5 Migration reality

The pinned main contains these migration files:

```text
001_initial_schema.sql
002_case_core.sql
003_case_idempotency_key_bytes.sql
004_evidence_core.sql
004_identity_binding_runtime.sql
005_case_participant_core.sql
006_case_status_paused_removal.sql
007_case_primary_switch.sql
```

The reviewed Slice 8 migration filename is therefore planned as:

```text
db/migrations/008_problem_formulation_core.sql
```

The duplicate numeric prefix `004` is an existing historical fact; migration execution is filename-sorted and records the full filename. No historical migration is renamed or modified.

---

## 3. Architecture

### 3.1 Components

```text
Public HTTP (4 routes only)
    ↓ authenticate / strict schema / current Family resolution
Problem Formulation application service
    ↓ authorize in the same RLS transaction
    ↓ idempotency slot
    ↓ Family lock → Case lock → current formulation lock
Domain policy / Evidence validation
    ↓
Repository writes
    problem_formulations
    cases.phase + cases.version
    case_events
    business_audit_events
    idempotency_keys
```

Internal callers use the same application service boundary for:

```text
StartAssessment
PresentProblemFormulation
ReassessFromFormulation
```

They are not test fixtures, SQL shortcuts, or HTTP endpoints. A production caller is deferred to the owning future Slice.

### 3.2 Planned code ownership

- `packages/domain/src/problem-formulations.ts`: domain validation, Evidence/dependency resolution, row-level repository operations and pure transition decisions.
- `apps/server/api/src/services/problem-formulations.ts`: transaction orchestration shared by public routes and future internal callers; **no direct SQL**.
- `apps/server/api/src/routes/problem-formulations.ts`: the four approved public routes only.
- existing `packages/authorization`, `packages/contracts`, idempotency helpers, error handler and OpenAPI machinery receive additive changes only.

This preserves the existing static rule that family-scoped SQL belongs in `packages/**`, not route code.

---

## 4. Data model decisions

Full column-level design is in `data-model.md`. The decisions frozen by this Plan are:

1. exactly one new business table: `problem_formulations`;
2. exactly one new enum: `problem_formulation_status` in the frozen order:
   `DRAFT, PRESENTED, CONFIRMED, DISPUTED, NEEDS_REVIEW, SUPERSEDED`;
3. no `current_problem_formulation_pointer`, no current-id column on `cases`, no second source of truth;
4. no Evidence-ref relation table and no generic dependency relation table in Slice 8;
5. heterogeneous immutable reference snapshots are structured JSON arrays; their targets are revalidated by the application/domain layer under RLS;
6. every persisted Slice 8 row is a complete independently readable formulation version;
7. `DRAFT` remains a formal enum value but is not persisted by Slice 8. A CHECK rejects at-rest `DRAFT`, matching the frozen rule that Slice 8 has no observable current DRAFT;
8. runtime has no DELETE privilege/policy for formulation history.

### 4.1 Content storage

| Field | Storage | Shape / rule |
|---|---|---|
| `primary_problem` | `jsonb` | `{ text, evidenceRefs[] }`; nonblank text; positive support required |
| `key_factors` | `jsonb` | array of `{ text, evidenceRefs[] }`; empty array is explicit; each item needs positive support |
| `evidence_refs` | `jsonb` | strict array of heterogeneous Evidence refs; `PRESENTED` requires ≥1 |
| `unknowns` | `jsonb` | array of `{ topic, state, evidenceRefs[] }`, state only `UNKNOWN/NOT_COLLECTED/DECLINED` |
| `conflicts` | `jsonb` | array retaining both/all sides, with evidence refs and optional conflict-group reference |
| `scene_fit` | `text` | explicit, trimmed, nonblank; no Digital Use vocabulary is invented |
| `alternative_explanations` | `jsonb` | explicit array; empty allowed |
| `reassessment_conditions` | `jsonb` | explicit array; empty allowed |
| `exit_conditions` | `jsonb` | explicit array; empty allowed |
| `user_response` | `jsonb NULL` | server-owned latest response fact: kind, real actor Person, server time, optional note |
| `dependency_refs` | `jsonb` | strict heterogeneous dependency-ref array |

### 4.2 Version chain and current

Per Case:

- first persisted formulation has `version = 1`, `supersedes_version = NULL`;
- every later formulation has exactly `version = previous.version + 1` and `supersedes_version = previous.version`;
- `(case_id, version)` is unique;
- a self composite FK `(case_id, supersedes_version) → (case_id, version)` anchors the chain;
- a CHECK enforces `version=1 ↔ supersedes_version IS NULL`, otherwise `supersedes_version = version - 1`;
- the current formulation is the terminal chain node and must not be `SUPERSEDED`;
- a partial unique index on `(case_id) WHERE status <> 'SUPERSEDED'` is a database consistency fence that guarantees **at most one** current row. It is not a second current pointer.

Repository reads derive current from the terminal version and fail closed on chain/status inconsistency rather than silently selecting a winner.

### 4.3 Immutable history

Content columns, identity columns, version and supersedes chain are **not runtime-updatable**. Runtime `UPDATE` privilege is column-limited to lifecycle/response fields only:

```text
status
user_response
confirmed_by_person_id
confirmed_at
updated_at
```

Thus a presented version cannot be rewritten through direct runtime SQL. Correction inserts a new complete row and only changes the previous row's `status` to `SUPERSEDED`.

### 4.4 Confirmation integrity

- `confirmed_by_person_id` + `confirmed_at` are both NULL or both non-NULL.
- `CONFIRMED` requires both non-NULL.
- `PRESENTED / DISPUTED / NEEDS_REVIEW` require both NULL.
- a nullable composite FK `(family_id, confirmed_by_person_id)` targets existing Family membership, while domain authorization additionally proves that Person is the current V1 management subject.
- clients cannot supply either field.

---

## 5. Evidence and dependency fidelity

### 5.1 EvidenceRef

Allowed targets are only existing Slice 3 objects:

```text
DIALOGUE_MESSAGE
ASSERTION
OBSERVATION
```

Every ref is resolved under the same Family RLS context and must belong to the same `case_id` and `family_id`.

### 5.2 Current-valid Evidence

At `Present`, `Correction`, and `Confirm`, validation performs the determinable current check:

- referenced row exists and is visible in the target Family/Case;
- assertion/observation `valid_from` is NULL or ≤ server now;
- `valid_until` is NULL or > server now;
- no later assertion/observation row supersedes the referenced row;
- a `dialogue_message` remains an immutable source fact because it has no validity/supersession lifecycle;
- `UNKNOWN / NOT_COLLECTED / DECLINED` observations cannot satisfy positive support for `primary_problem` or a `key_factor`;
- conflict-group evidence cannot be silently treated as a resolved winner.

No mutation to Evidence occurs.

### 5.3 Unknown / conflict preservation

The validator mechanically checks:

- referenced unknown observation states appear in `unknowns` with the same state;
- `DECLINED` remains `DECLINED`, never a guessed answer;
- conflict groups referenced by the formulation are represented with all referenced conflicting sides;
- `primary_problem` and each `key_factor` reference at least one currently valid, non-unknown, non-conflict supporting Evidence ref;
- nested refs in problem/factors/unknowns/conflicts are members of the top-level `evidence_refs` snapshot.

### 5.4 DependencyRef

Structured union:

```text
EVIDENCE        → an EvidenceRef
CONSENT         → stable record id (+ version where the authoritative source has one)
POLICY          → stable key + version
PACKAGE         → stable key + version
CONTENT_VERSION → stable key + version
```

Slice 8 persists these refs and validates all targets that current main can authoritatively resolve. Evidence is always revalidated. Consent/Policy/Package/Content refs that current main can prove invalid block confirmation. A ref type for which no authoritative runtime registry exists is preserved but is **not falsely reported as verified**.

The future propagation engine (`Evidence correction / consent withdrawal / policy or package retirement → NEEDS_REVIEW`) remains deferred. No `artifact_dependencies` table is created.

---

## 6. Case version and optimistic concurrency

### 6.1 Plan decision for Spec A-5

Every successful Slice 8 write increments the existing `cases.version`, including formulation-only transitions that do not change `cases.phase`.

Rationale: `cases.version` is already the Case aggregate's concurrency token and is consumed by Slice 7. A formulation mutation changes the authoritative Case aggregate even when phase is unchanged; incrementing the existing version prevents stale primary-switch or formulation commands from overwriting a newer Case view without inventing another Case lock version.

| Command | Case phase effect | Case version |
|---|---|---|
| StartAssessment | `INTAKE → ASSESSMENT` | +1 |
| PresentProblemFormulation | `ASSESSMENT → PROBLEM_FORMULATION` | +1 |
| ConfirmProblemFormulation | `PROBLEM_FORMULATION → GOALS` | +1 |
| DisputeProblemFormulation | unchanged | +1 |
| CorrectProblemFormulation | unchanged | +1 |
| ReassessFromFormulation | `PROBLEM_FORMULATION → ASSESSMENT` | +1 |

### 6.2 Public transport

Public mutating formulation endpoints require an `If-Match` header representing the already-existing `cases.version`, for example:

```text
If-Match: "case-v12"
```

This is a transport representation of `cases.version`, **not** a new business version.

- missing/malformed `If-Match` → `422 VALIDATION_ERROR`;
- parsed value ≠ locked Case version → `409 STALE_CASE_VERSION`;
- GET current and mutation responses expose `caseVersion` and an equivalent `ETag` so clients can submit the next command without a second version source.

Internal commands take `expectedCaseVersion: number` in their application-service input and apply the same locked comparison.

---

## 7. Authorization and actor boundary

### 7.1 Authorization registry additions

Add these Case actions to the existing closed `Action` union / registries:

```text
CASE_START_ASSESSMENT
CASE_PRESENT_PROBLEM_FORMULATION
CASE_CONFIRM_PROBLEM_FORMULATION
CASE_DISPUTE_PROBLEM_FORMULATION
CASE_CORRECT_PROBLEM_FORMULATION
CASE_REASSESS_FROM_FORMULATION
```

GET current reuses existing `CASE_READ`; no second read permission is required.

All new actions:

- use `FAMILY_MANAGEMENT`;
- use existing `Resource { type:'CASE', familyId, caseId }`;
- require current Family membership + current Family creator/manager fact;
- require Case context;
- do not add a role, Purpose, Resource kind, Case role, participant-derived management permission, or RBAC matrix.

### 7.2 Real-user / AI authority boundary

Public mutation routes are bearer-authenticated and require an actual `accountId + personId`.

Internal application-service entry points require the same verified Account/Person request context and reject absent/synthetic principals. There is no `SYSTEM`, `AI`, or `MODEL` authorization principal for these commands.

`confirmed_by_person_id` is always copied from the verified current user after authorization; it is never accepted from candidate content or HTTP input.

This makes “AI/system confirms on behalf of user” structurally unreachable through the Slice 8 public or internal contract.

### 7.3 Authorization ordering inside the RLS transaction

`withRlsTransaction()` must establish the authenticated identity/Family database context before authorization facts can be read. That infrastructure step is **not** a Problem Formulation business read/write. Inside that transaction, `authorize()` must complete before any target formulation business read or mutation, Evidence-dependent decision, idempotent business outcome, or phase/status write. This preserves the frozen “authorize before business operation” rule while reusing the actual current authorization architecture.

### 7.4 Anti-enumeration

For the four public routes, after current Family resolution:

- known authorization denial, malformed Case id, nonexistent Case, cross-Family Case/formulation, and non-manager access collapse to the same `404 CASE_NOT_FOUND` body;
- unknown authorization/infrastructure failures propagate to the generic `500 INTERNAL_ERROR` handler and are never disguised as 404;
- current-Family resolution errors retain existing Slice 1 semantics.

---

## 8. Primary, Safety, Closed and phase guards

All six write commands require after locking/re-read:

```text
case.is_primary = true
case.status != SAFETY_HOLD
case.status != CLOSED
expected Case version == locked Case version
```

No additional blocker is invented for `WAITING` or `LOST_CONTACT` in this Slice.

Failures:

- non-primary → `409 CASE_NOT_PRIMARY`;
- Safety → existing `409 SAFETY_HOLD_BLOCKED`;
- Closed → existing `409 CASE_CLOSED`;
- phase mismatch → `409 CASE_PHASE_CONFLICT`.

GET current is read-only and may return a real formulation for a non-primary, Safety, Closed, WAITING or LOST_CONTACT Case if the caller otherwise has Case read authority.

---

## 9. Command contracts

### 9.1 Common transaction and replay rules for every write

1. authenticate/obtain real Account+Person context;
2. strict input validation and current Family resolution;
3. enter the existing Family RLS transaction;
4. perform `authorize()` using authoritative same-transaction facts;
5. compute canonical request hash and acquire the existing idempotency slot **before mutable business-state checks**;
6. replay/mismatch decision;
7. Family row lock;
8. target Case row lock and expected Case-version comparison;
9. current formulation row lock when applicable;
10. primary/Safety/Closed/phase/status/version/Evidence/dependency checks;
11. business writes;
12. case event + business audit;
13. complete idempotency snapshot;
14. commit atomically.

For a newly acquired key, deterministic business 4xx outcomes after authorization/slot acquisition are represented as command outcomes and stored as the original idempotent result with **zero business mutation**. Authentication, authorization, schema/transport errors and infrastructure failures are not converted into successful command snapshots. Infrastructure failure rolls back the entire transaction and slot.

### 9.2 `StartAssessment` — internal

| Dimension | Plan |
|---|---|
| Allowed Case phase | `INTAKE` only |
| Allowed formulation status | no formulation required; command creates none |
| Actor | real current Family V1 manager Account/Person |
| Authorization | `CASE_START_ASSESSMENT`, `FAMILY_MANAGEMENT`, Case resource |
| Consent/compliance | existing applicable authorization/consent/compliance truth may not be bypassed; no new consent model |
| Primary/Safety | primary required; `SAFETY_HOLD`/`CLOSED` blocked |
| Case version | required `expectedCaseVersion`; locked exact match |
| Formulation version/current | N/A |
| Input | idempotency key + Case context + expected Case version; no assessment payload |
| Evidence/dependency | at least one same-Case `dialogue_message` or current-visible `assertion kind=STATEMENT` |
| Business writes | update Case `phase=ASSESSMENT`, `version+1`, `updated_at` |
| Formulation effect | none |
| Case phase effect | `INTAKE → ASSESSMENT` |
| Event/audit | `CASE_ASSESSMENT_STARTED` |
| Idempotency | shared slot, `CASE_START_ASSESSMENT` |
| Concurrency | Family → Case lock; serializes against SwitchPrimaryCase and other Slice 8 writes |
| Replay | original outcome, no duplicate phase/event/audit |
| Conflict/error | missing traceable statement 422; wrong phase/nonprimary/stale/Safety/Closed 409; no access 404 |

This command never creates `assessment_sessions`, questionnaires, scene state, AI/RAG objects or a public endpoint.

### 9.3 `PresentProblemFormulation` — internal

| Dimension | Plan |
|---|---|
| Allowed Case phase | `ASSESSMENT` only |
| Allowed formulation status | none for first version; an existing current may be `PRESENTED/DISPUTED/NEEDS_REVIEW` only after a prior Reassess |
| Actor | real current Family V1 manager Account/Person request context |
| Authorization | `CASE_PRESENT_PROBLEM_FORMULATION` |
| Consent/compliance | existing applicable truth cannot be bypassed |
| Primary/Safety | primary required; Safety/Closed blocked |
| Case version | required and locked exact match |
| Formulation version/current | server allocates `1` or `current+1`; caller cannot specify |
| Input | complete `ProblemFormulationContentInput`; no server-owned fields |
| Evidence/dependency | full §5 validation, at least one current-valid Evidence ref |
| Business writes | old current → SUPERSEDED if present; insert complete new PRESENTED version; Case phase/version update |
| Formulation status effect | new `PRESENTED`; old current `SUPERSEDED` |
| Case phase effect | `ASSESSMENT → PROBLEM_FORMULATION` |
| Event/audit | `CASE_PROBLEM_FORMULATION_PRESENTED` |
| Idempotency | `PROBLEM_FORMULATION_PRESENT` |
| Concurrency | Family → Case → current formulation lock; unique current fence |
| Replay | same version/result, no duplicate row/event/audit |
| Conflict/error | malformed/fidelity invalid 422; phase/nonprimary/stale/Safety/Closed 409; access 404 |

No observable/persistent DRAFT is created. Future Assessment/AI is merely a caller of this contract.

### 9.4 `ConfirmProblemFormulation` — public

| Dimension | Plan |
|---|---|
| Endpoint | `POST /api/v1/cases/:id/problem-formulations/:version/confirm` |
| Allowed Case phase | `PROBLEM_FORMULATION` |
| Allowed formulation status | current `PRESENTED` only |
| Actor | real current Family V1 manager; never AI/system |
| Authorization | `CASE_CONFIRM_PROBLEM_FORMULATION` |
| Consent/compliance | current determinable dependency/consent/policy validity rechecked |
| Primary/Safety | primary required; Safety/Closed blocked |
| Case version | `If-Match` required, locked exact match |
| Formulation version/current | path version must equal locked current version |
| Input | strict `{ note?: string }`; no formulation/server fields |
| Evidence/dependency | realtime revalidation immediately before confirmation |
| Business writes | status CONFIRMED, confirmed_by verified Person, server confirmed_at, latest user_response=CONFIRM, Case phase/version update |
| Formulation status effect | `PRESENTED → CONFIRMED` |
| Case phase effect | `PROBLEM_FORMULATION → GOALS` |
| Event/audit | `CASE_PROBLEM_FORMULATION_CONFIRMED` |
| Idempotency | `PROBLEM_FORMULATION_CONFIRM` |
| Concurrency | same lock order; Confirm vs Confirm/Correction/Dispute/Reassess becomes a single ordered winner |
| Replay | original confirmed response; no duplicate phase/event/audit |
| Conflict/error | stale Case/version/status/dependency/nonprimary/Safety/Closed 409; invalid schema 422; access 404 |

This is the **only Slice 8 path into `GOALS`**.

### 9.5 `DisputeProblemFormulation` — public

| Dimension | Plan |
|---|---|
| Endpoint | `POST /api/v1/cases/:id/problem-formulations/:version/dispute` |
| Allowed Case phase | `PROBLEM_FORMULATION` |
| Allowed formulation status | current `PRESENTED` only |
| Actor | real current Family V1 manager |
| Authorization | `CASE_DISPUTE_PROBLEM_FORMULATION` |
| Consent/compliance | no bypass of existing gates |
| Primary/Safety | primary required; Safety/Closed blocked |
| Case version | `If-Match` required |
| Formulation version/current | path version must be current |
| Input | strict `{ note?: string }` |
| Evidence/dependency | no new content; referenced record remains current target |
| Business writes | status DISPUTED, latest user_response=DISPUTE, Case version+1 |
| Formulation status effect | `PRESENTED → DISPUTED` |
| Case phase effect | unchanged `PROBLEM_FORMULATION` |
| Event/audit | `CASE_PROBLEM_FORMULATION_DISPUTED` |
| Idempotency | `PROBLEM_FORMULATION_DISPUTE` |
| Concurrency | conflicts against Confirm/Correction/Reassess under same locks |
| Replay | original disputed result; repeated different-key dispute = state conflict |
| Conflict/error | wrong current/status/Case version/nonprimary/Safety/Closed 409; schema 422; access 404 |

Dispute does **not** invoke Reassess.

### 9.6 `CorrectProblemFormulation` — public

| Dimension | Plan |
|---|---|
| Endpoint | `POST /api/v1/cases/:id/problem-formulations/:version/corrections` |
| Allowed Case phase | `PROBLEM_FORMULATION` |
| Allowed formulation status | current `PRESENTED / DISPUTED / NEEDS_REVIEW` |
| Actor | real current Family V1 manager |
| Authorization | `CASE_CORRECT_PROBLEM_FORMULATION` |
| Consent/compliance | no bypass; full merged result revalidated |
| Primary/Safety | primary required; Safety/Closed blocked |
| Case version | `If-Match` required |
| Formulation version/current | path version must be current; server allocates +1 |
| Input | strict `{ changes: <partial content>, note?: string }`; at least one substantive changed content field; no server fields |
| Evidence/dependency | merge then validate the **complete** resulting formulation using the same Present rules |
| Business writes | old row status→SUPERSEDED; insert full new PRESENTED row with correction user_response and no confirmation; Case version+1 |
| Formulation status effect | old allowed status→SUPERSEDED; new→PRESENTED |
| Case phase effect | unchanged `PROBLEM_FORMULATION` |
| Event/audit | `CASE_PROBLEM_FORMULATION_CORRECTED` |
| Idempotency | `PROBLEM_FORMULATION_CORRECT` |
| Concurrency | Family → Case → current formulation; unique version/current constraints; loser 409 |
| Replay | returns originally created new version; no extra version |
| Conflict/error | empty/no-op correction 422; CONFIRMED/SUPERSEDED/noncurrent/GOALS/stale/nonprimary/Safety/Closed 409; access 404 |

The server performs `current complete content + changes → complete candidate → full validation → new row`. A correction is never stored as a patch-only version.

### 9.7 `ReassessFromFormulation` — internal

| Dimension | Plan |
|---|---|
| Allowed Case phase | `PROBLEM_FORMULATION` |
| Allowed formulation status | any existing current formulation status that remains in `PROBLEM_FORMULATION`; `CONFIRMED` is unreachable because its Case phase is GOALS |
| Actor | real user request context |
| Authorization | `CASE_REASSESS_FROM_FORMULATION` |
| Consent/compliance | existing applicable gates not bypassed |
| Primary/Safety | primary required; Safety/Closed blocked |
| Case version | required expected Case version |
| Formulation version/current | current row must exist and is locked; not modified |
| Input | current formulation context + a domain-validated reassessment basis; **no new reason enum is invented** |
| Evidence/dependency | no content rewrite; caller/domain policy must tie basis to an existing correction/conflict/alternative/reassessment condition |
| Business writes | Case phase ASSESSMENT, Case version+1 only |
| Formulation status effect | none |
| Case phase effect | `PROBLEM_FORMULATION → ASSESSMENT` |
| Event/audit | `CASE_REASSESSMENT_STARTED` |
| Idempotency | `CASE_REASSESS_FROM_FORMULATION` |
| Concurrency | same Family/Case/current locks; serializes against Confirm/Dispute/Correction/SwitchPrimaryCase |
| Replay | original reassessment outcome; no second phase event |
| Conflict/error | no current/wrong phase/stale/nonprimary/Safety/Closed 409; access 404 |

No actual Assessment workflow is executed.

---

## 10. Lock ordering and concurrency

### 10.1 Canonical lock order

All Slice 8 write paths use the existing Case-family ordering:

```text
1. idempotency slot / exact key unique-row contention
2. families row FOR UPDATE
3. target cases row FOR UPDATE
4. current problem_formulations row FOR UPDATE (if any)
5. Evidence/dependency re-read needed for the command
6. business UPDATE / INSERT
7. case_events
8. business_audit_events
9. idempotency completion
10. COMMIT
```

No Slice 8 path may lock Case/formulation before Family and then acquire Family later.

### 10.2 Why the Family lock is required

It is not a new primary mechanism. It reuses Slice 7's serialization point so a formulation mutation cannot pass `is_primary=true` while `SwitchPrimaryCase` concurrently demotes that Case. After acquiring the Family lock, Slice 8 locks and re-reads the target Case before every guard decision.

### 10.3 Required race outcomes

| Race | Required result |
|---|---|
| concurrent Present / Present | one new current version; other 409 or replay, never two current |
| Correction / Correction | one new version; loser current/version conflict |
| Confirm / Confirm (different keys) | one confirm; loser state/version conflict |
| Confirm / Correction | exactly one legal outcome; loser 409 |
| Confirm / Dispute | exactly one legal outcome; loser 409 |
| Confirm / Reassess | exactly one phase outcome; loser 409 |
| Correction / Dispute | exactly one current mutation; loser 409 |
| Reassess / Confirm | exactly one phase outcome; loser 409 |
| Present / SwitchPrimaryCase | Family lock orders them; if switch wins and demotes target, Present is non-primary conflict |
| Confirm / SwitchPrimaryCase | same; no confirmation on a Case that was already demoted before its serialized turn |
| Reassess / SwitchPrimaryCase | same; no reassessment on a demoted Case |
| same key concurrent | exactly one command result; all peers replay it |
| stale Case version | 409, zero business mutation |

READ COMMITTED remains the isolation level. Application-level automatic retry is not added; clients retry with the same idempotency key.

---

## 11. Events and business audit

### 11.1 New case-event vocabulary

Reviewed migration extends the existing closed CHECK with exactly:

```text
CASE_ASSESSMENT_STARTED
CASE_PROBLEM_FORMULATION_PRESENTED
CASE_PROBLEM_FORMULATION_CONFIRMED
CASE_PROBLEM_FORMULATION_DISPUTED
CASE_PROBLEM_FORMULATION_CORRECTED
CASE_REASSESSMENT_STARTED
```

The existing event values remain byte-for-byte accepted.

### 11.2 Strict metadata shapes

No event contains problem text, factors, unknowns, conflicts, user notes, Evidence content or other free-form formulation body.

Planned shapes:

```text
CASE_ASSESSMENT_STARTED
{ fromPhase, toPhase, version }

CASE_PROBLEM_FORMULATION_PRESENTED
{ formulationVersion, fromPhase, toPhase, version }

CASE_PROBLEM_FORMULATION_CONFIRMED
{ formulationVersion, fromStatus, toStatus, fromPhase, toPhase, version }

CASE_PROBLEM_FORMULATION_DISPUTED
{ formulationVersion, fromStatus, toStatus, version }

CASE_PROBLEM_FORMULATION_CORRECTED
{ fromFormulationVersion, toFormulationVersion, fromStatus, toStatus, version }

CASE_REASSESSMENT_STARTED
{ formulationVersion, fromPhase, toPhase, version }
```

The migration extends the current `case_events_metadata_shape_check` with per-event branches; it does not replace the CHECK with a generic `jsonb object` acceptance rule.

### 11.3 Business audit

Extend `business_audit_events.event_type` by the same six event names.

Extend `resource_type` by:

```text
PROBLEM_FORMULATION
```

Resource choices:

- StartAssessment / Reassess: `CASE`, `resource_id = case.id`.
- Present / Confirm / Dispute / Correction: `PROBLEM_FORMULATION`, `resource_id = affected current/new formulation id`.

Metadata is the same minimal identifier/state/version information or a strict subset of the case-event metadata. No user note or formulation body is copied.

---

## 12. Idempotency design

### 12.1 New command types

```text
CASE_START_ASSESSMENT
PROBLEM_FORMULATION_PRESENT
PROBLEM_FORMULATION_CONFIRM
PROBLEM_FORMULATION_DISPUTE
PROBLEM_FORMULATION_CORRECT
CASE_REASSESS_FROM_FORMULATION
```

The migration adds them to both:

- `idempotency_keys_command_type_check`
- `idempotency_keys_key_representation_check`

All six new commands use the existing exact UTF-16LE `bytea` key representation; no new index is added.

### 12.2 Canonical request hashes

Every hash includes the server-verified Family and Case identity plus the command's semantic payload.

Examples:

```text
Start:   { familyId, caseId, expectedCaseVersion }
Present: { familyId, caseId, expectedCaseVersion, fullCandidate }
Confirm: { familyId, caseId, formulationVersion, expectedCaseVersion, body }
Dispute: { familyId, caseId, formulationVersion, expectedCaseVersion, body }
Correct: { familyId, caseId, formulationVersion, expectedCaseVersion, changes, note }
Reassess:{ familyId, caseId, formulationVersion, expectedCaseVersion, validatedBasisFingerprint }
```

`Idempotency-Key` itself is scope, not part of the hash. Client key ordering is normalized through the existing canonical JSON/hash implementation.

---

## 13. RLS and privileges

### 13.1 `problem_formulations`

Migration must:

```text
ENABLE ROW LEVEL SECURITY
FORCE ROW LEVEL SECURITY
```

Policies:

```text
SELECT USING      family_id = app_family_id()
INSERT WITH CHECK family_id = app_family_id()
UPDATE USING/WITH CHECK family_id = app_family_id()
NO DELETE policy
```

RLS is Family isolation only; authorization remains `authorize()`.

Privileges for `xiaoshuyin_app`:

```text
SELECT, INSERT ON problem_formulations
UPDATE(status, user_response, confirmed_by_person_id, confirmed_at, updated_at)
USAGE ON TYPE problem_formulation_status
NO DELETE
```

### 13.2 `cases`

Add only:

```text
GRANT UPDATE (phase, version, updated_at) ON cases TO xiaoshuyin_app;
```

The existing Slice 7 grant on `is_primary, version, updated_at` remains. Table-level `UPDATE` must continue to be false.

### 13.3 Direct-SQL protection

DB tests must prove:

- no Family context → SELECT zero rows and INSERT/UPDATE denied;
- wrong Family context → zero rows / rejected writes;
- app role cannot DELETE formulation rows;
- app role cannot update content, version, case_id, family_id or supersedes chain;
- app role cannot update arbitrary Case columns;
- migrator owns new table; app role is `NOBYPASSRLS`.

---

## 14. Migration strategy

One reviewed additive file:

```text
db/migrations/008_problem_formulation_core.sql
```

Planned sequence:

1. `CREATE TYPE problem_formulation_status` with the exact six frozen labels/order.
2. `CREATE TABLE problem_formulations`.
3. add composite FK/confirmation FK/self-version-chain FK and CHECKs.
4. add unique/version/current/indexes.
5. ENABLE + FORCE RLS.
6. create SELECT/INSERT/UPDATE Family policies; no DELETE policy.
7. least-privilege grants and `cases.phase/version/updated_at` column grant.
8. extend `case_events_event_type_check`.
9. extend `case_events_metadata_shape_check` with exact per-event branches while preserving all old branches.
10. extend `business_audit_events_event_type_check`.
11. extend `business_audit_events_resource_type_check` with `PROBLEM_FORMULATION`.
12. extend `idempotency_keys_command_type_check`.
13. extend `idempotency_keys_key_representation_check` for the six new bytea-only command types.

No historical migration is modified. No data backfill is required because the table is new and no prior Case can already possess a formulation.

### 14.1 Required migration evidence

- fresh database: all migrations including both `004_*` files and 008 apply;
- upgrade database with `001`–`007` already recorded: exactly 008 applies;
- second application: no-op;
- all prior migration records/timestamps unchanged;
- failed 008 statement proves transaction rollback leaves no partial enum/table/constraint/grant changes;
- schema/role/policy introspection matches planned exact object set.

Rollback in a non-production/no-data validation environment may drop only 008-owned objects and restore the five extended shared CHECKs/grant state. Once real formulation history exists, destructive rollback is forbidden; recovery is forward-fix migration only.

---

## 15. Public API and OpenAPI

### 15.1 Exact public surface

Only:

```text
GET  /api/v1/cases/:id/problem-formulations/current
POST /api/v1/cases/:id/problem-formulations/:version/confirm
POST /api/v1/cases/:id/problem-formulations/:version/dispute
POST /api/v1/cases/:id/problem-formulations/:version/corrections
```

Forbidden public routes include `/start-assessment`, `/present`, `/reassess`, generic create, history/list, `/assessments`, and any fifth formulation operation.

### 15.2 GET current true-empty decision

For an authorized, existing Case with no formulation, GET returns:

```json
{
  "caseVersion": 3,
  "current": null
}
```

with status `200` and matching `ETag`.

This preserves a **true empty state** while letting the legitimate manager distinguish “no formulation yet” from “Case not found/no access”. Unauthorized/cross-Family/nonexistent Case remains uniform 404.

### 15.3 Mutation responses

- Confirm: `200`
- Dispute: `200`
- Correction: `201`

Each returns the current formulation envelope and updated `caseVersion` / `ETag`.

Each public POST requires:

- bearer auth;
- `Idempotency-Key` header;
- `If-Match` Case-version header;
- path Case id + formulation version;
- strict JSON body.

### 15.4 Error contract

Reuse:

```text
CASE_NOT_FOUND                     404
CURRENT_FAMILY_NOT_FOUND           existing
CURRENT_FAMILY_AMBIGUOUS           existing
CASE_CLOSED                        409
SAFETY_HOLD_BLOCKED                409
IDEMPOTENCY_PAYLOAD_MISMATCH       409
VALIDATION_ERROR                   422
```

Add:

```text
CASE_NOT_PRIMARY                    409
CASE_PHASE_CONFLICT                 409
STALE_CASE_VERSION                  409
PROBLEM_FORMULATION_VERSION_CONFLICT 409
PROBLEM_FORMULATION_STATE_CONFLICT   409
PROBLEM_FORMULATION_DEPENDENCY_INVALID 409
PROBLEM_FORMULATION_EVIDENCE_INVALID   422
TRACEABLE_PROBLEM_STATEMENT_REQUIRED   422
```

No 403 formulation-detail response is introduced; anti-enumeration remains 404 after Family resolution.

### 15.5 Frozen OpenAPI artifact and generator

Planning supplies `contracts/problem-formulation-api.openapi.yaml` as the Slice 8 frozen-contract candidate for the independent pre-development auditor.

Future implementation must:

1. add that file to `scripts/openapi-check.mjs`'s frozen document union;
2. register the four real routes using Zod contracts;
3. run **only** the formal generator: `bun run openapi:generate`;
4. commit generated `packages/generated/openapi.json` and `openapi.d.ts` only if the generator changes them;
5. run `bun run openapi:check` and dedicated runtime route-drift tests;
6. prove generated operation set is exactly the union of frozen contracts—no fifth endpoint.

No generated artifact is hand-edited.

---

## 16. Existing governance tests/scripts that must be reconciled, not weakened

Current main intentionally forbids future Problem Formulation objects. Slice 8 makes exactly that object legal, so these guards require surgical updates during implementation:

1. `scripts/guard-static.mjs`: remove only `problem_formulations` from the forbidden table patterns. Keep `scene_*`, goals, plan/task, risk, notifications, AI/memory, etc. forbidden.
2. `tests/integration/cases-scope.test.ts`: stop treating `/problem-formulations` and `problem_formulations` as globally forbidden; replace with exact Slice 8 route/table assertions while keeping all unrelated negative-space guards.
3. `tests/integration/openapi-cases.test.ts`: retain old Case operations and add/compose exact Slice 8 operations; do not weaken the operation-set assertion.
4. `tests/db/migration-repro.test.ts`: update exact table/enum/policy counts/names for the one new table, one new enum and new policies.
5. `tests/db/roles.test.ts`: add formulation privileges and `cases.phase` column privilege assertions while preserving table-level Case UPDATE=false.
6. `scripts/db-evidence.mjs`: include 008 in fresh/upgrade/replay evidence and expected RLS/table/enum/policy sets.

These are baseline reconciliation tasks, not scope expansion.

---

## 17. Test strategy

### 17.1 Database

Must prove:

- one enum with exact six labels/order;
- table columns/JSON top-level CHECKs;
- same-Family Case FK;
- confirmation Family-member FK;
- version starts at 1 and strict predecessor chain;
- `(case_id, version)` uniqueness;
- at-most-one-current partial unique constraint;
- at-rest DRAFT rejected;
- content direct UPDATE denied to runtime;
- DELETE denied;
- RLS ENABLE + FORCE and policies;
- app/migrator role facts;
- narrow Case phase grant;
- all shared CHECK whitelists are exact and retain previous values;
- fresh/upgrade/replay/rollback evidence.

### 17.2 Domain / application service

Must cover every command and pure transition decision:

- StartAssessment traceable-problem-statement carrier;
- Present full-candidate validation;
- Confirm exact guard ordering and AI-authority boundary;
- Dispute ≠ Reassess;
- Correction full merge/new version/no inherited confirmation;
- Reassess leaves formulation untouched;
- state/phase transition matrix;
- Evidence unknown/conflict/DECLINED fidelity;
- dependency validity decisions;
- primary/Safety/Closed guards;
- authorization actions;
- Case/formulation version checks;
- idempotency replay/mismatch/outcome persistence;
- lock/concurrency decision helpers.

### 17.3 Integration

Public:

- GET current populated + true empty;
- Confirm;
- Dispute;
- Corrections.

Internal application-service integration:

- StartAssessment;
- Present;
- Reassess.

Negative paths:

```text
wrong Family
wrong actor / ordinary member
wrong Case / malformed Case id
non-primary
wrong phase
SAFETY_HOLD
CLOSED
stale Case version
stale formulation version
SUPERSEDED / wrong status
dependency invalid
Evidence invalid / expired / superseded
retry / same-key replay
same-key mismatch
all required races
transaction fault injection / atomic rollback
```

### 17.4 OpenAPI / contract

- frozen YAML parses;
- generated schemas include exact four operations;
- Zod route schemas semantically match YAML;
- runtime routes match generated OpenAPI;
- no public Start/Present/Reassess/create/history endpoint;
- strict bodies reject server-owned/undeclared fields;
- `Idempotency-Key` and `If-Match` are declared on mutations;
- generated types are from the formal generator only.

### 17.5 Acceptance A–K mapping

| Scenario | Required proof |
|---|---|
| A StartAssessment | integration + DB phase/version/event/audit |
| B Present | internal service + DB new PRESENTED current + Case PF |
| C Confirm | public integration + DB CONFIRMED + GOALS |
| D Dispute | public integration + DB DISPUTED, phase unchanged |
| E Reassess | internal service + DB ASSESSMENT, formulation unchanged |
| F Correction | public integration + DB old SUPERSEDED/new current |
| G UNKNOWN/CONFLICT | domain + integration fidelity rejection/preservation |
| H AI/system cannot confirm | authorization/domain + persistence absence |
| I SAFETY_HOLD | all write commands blocked |
| J non-primary | all write commands blocked, read still works |
| K Confirm/Correction race | real concurrent integration/DB test, one outcome only |

All 25 frozen Spec acceptance scenarios must also be mapped by task-level tests; A–K is not a replacement for them.

---

## 18. Pre-development verification gate

Before the first implementation edit, the Development AI must re-run/record the following against the then-current branch. Any failed dependency check is a **STOP**, not permission to redesign the frozen Spec.

### G1 — immutable base reconciliation

- development branch descends from the pre-development-audited Plan head;
- no upstream drift has invalidated `main@e8add...` assumptions without explicit re-audit.

### G2 — migration sequence

- highest current prefix remains 007 and next reviewed file can still be 008;
- historical migration set is unchanged.

### G3 — Case contract

- `cases.phase`, `cases.version`, `is_primary`, Case-status enum and `cases_id_family_key` remain as planned;
- app still lacks general/table-level Case UPDATE.

### G4 — primary lock contract

- Slice 7 Family → Case lock order and `lockFamilyForPrimaryDecision`-equivalent seam remain canonical;
- no new command has introduced an opposite Case→Family order.

### G5 — authorization/RLS

- `authorize()` remains the sole business authorization entry;
- `withRlsTransaction` still establishes identity + Family context;
- app role remains non-owner/NOBYPASSRLS.

### G6 — Evidence carrier/validity

- `dialogue_messages`, `assertions`, `observations` shapes remain compatible;
- StartAssessment carriers remain dialogue message or `STATEMENT` assertion;
- supersedes/validity/conflict/value-state fields remain queryable.

### G7 — shared whitelist constraints

Read actual `pg_constraint` definitions/names for:

- case event type/metadata;
- business audit event/resource type;
- idempotency command/key representation.

Do not author 008 from stale copied SQL.

### G8 — idempotency exact-key seam

- exact bytea representation/slot helpers remain usable;
- no second general idempotency system has appeared.

### G9 — OpenAPI governance

- `openapi-check` still unions all frozen Slice contracts;
- formal generator command remains `bun run openapi:generate`.

### G10 — negative-space guards

- locate every current `problem_formulations` forbidden assertion before editing;
- change only those needed to admit the frozen Slice 8 table/four routes;
- all unrelated out-of-scope guards remain.

### G11 — baseline green

Run the repository's canonical baseline verification before RED tests. Any unexpected baseline failure must be diagnosed before Slice 8 code is written; do not weaken a test to manufacture green.

---

## 19. Planned project structure

Future implementation is expected to touch only these implementation/governance paths plus Slice 8 test files:

```text
db/migrations/008_problem_formulation_core.sql

packages/domain/src/problem-formulations.ts
packages/domain/src/idempotency.ts
packages/domain/src/index.ts
packages/contracts/src/schemas.ts
packages/authorization/src/authorize.ts

apps/server/api/src/services/problem-formulations.ts
apps/server/api/src/routes/problem-formulations.ts
apps/server/api/src/app.ts
apps/server/api/src/plugins/error-handler.ts

scripts/openapi-check.mjs
scripts/guard-static.mjs
scripts/db-evidence.mjs

packages/generated/openapi.json        # generator only
packages/generated/openapi.d.ts        # generator only

tests/domain/problem-formulations-*.test.ts
tests/db/problem-formulations-*.test.ts
tests/integration/problem-formulations-*.test.ts
tests/integration/openapi-problem-formulations.test.ts

tests/db/migration-repro.test.ts
tests/db/roles.test.ts
tests/integration/cases-scope.test.ts
tests/integration/openapi-cases.test.ts
```

No `Docs/**`, no old `spec.md`, no old migration, no Assessment/Scene/AI/Goal/Plan/Task/UI path.

---

## 20. Canonical final verification for future development

The development phase must end with real outputs from, at minimum:

```text
# focused Slice 8 tests
bunx vitest run tests/domain/problem-formulations-*.test.ts
bunx vitest run tests/db/problem-formulations-*.test.ts
bunx vitest run tests/integration/problem-formulations-*.test.ts tests/integration/openapi-problem-formulations.test.ts

# migration / roles / governance
bunx vitest run tests/db/migration-repro.test.ts tests/db/roles.test.ts
bun run db:evidence -- --no-archive

# contract generation + equivalence
bun run openapi:generate
bun run openapi:check

# repository-wide gates
bun run typecheck
bun run guard:static
bun run coverage:audit
bun run test -- --run
bun run verify-all

# final scope hygiene
git status --short
git diff --check
git diff --name-status <audited-base>...HEAD
```

If repository scripts use a different exact Vitest invocation at implementation time, use the canonical current script while preserving the same test set/evidence. Do not edit tests or scripts merely to hide a real failure.

Final diff review must mechanically confirm:

- frozen `spec.md` unchanged;
- `Docs/**` unchanged;
- no historical migration changed;
- no fifth public endpoint;
- no out-of-scope directory/object introduced;
- generated files match generator output;
- clean working tree after committed development evidence (the Plan phase itself does not commit).

---

## 21. Plan risks (not blockers)

1. **Existing guards intentionally forbid this future Slice.** `guard-static` and Case scope tests must be narrowed precisely; broad deletion of negative-space guards is unacceptable.
2. **Current uniqueness is high-risk.** The plan relies on version-chain rules + one partial unique current fence + Family/Case/current-row locks. Any implementation shortcut can create dual current rows.
3. **Case aggregate concurrency is shared with Slice 7.** All Slice 8 writes bump Case version and must preserve Family→Case ordering to avoid stale primary decisions or deadlocks.
4. **Dependency propagation remains deferred.** Confirm must perform realtime validation of all determinable refs; implementation must not claim that future invalidation propagation already exists.
5. **Three commands have no public production caller in this Slice.** Tests must call the real application-service command seam; they must not create hidden HTTP endpoints or SQL-only shortcuts.
6. **`cases.phase` write privilege does not currently exist.** 008 must add only the narrow column grant and keep table-level UPDATE false.
7. **Migration governance contains two `004_*` files.** Fresh/upgrade/replay evidence must use exact filenames rather than assuming one migration per numeric prefix.
8. **AI authority is a negative capability.** No synthetic principal, model route, server-owned confirmed-by override, or test-only bypass may leak into production exports.

---

## 22. Out-of-scope protection

Explicitly forbidden in Slice 8:

```text
Digital Use Scene / A1001–A5002
Assessment engine, questionnaires, assessment table/session
Scene runtime / node state / scene artifacts
AI / RAG / prompts / model output persistence
Goal / Intervention / Plan / Task / Execution / Review
Follow-up / Notification
Outcome / Maintenance / Closure / Recurrence / Referral
Safety State Core / EnterSafetyHold / ResolveRisk / risk engine
WAITING lifecycle / LOST_CONTACT lifecycle
Mini Program UI / Operations UI
generic dependency graph / artifact_dependencies
historical formulation list/export/delete API
```

No empty table, route, enum, package or placeholder is created for any of the above.

---

## 23. Planning conclusion

The frozen Spec is implementable against the pinned main without reopening product scope. The architecture reuses existing Case, Evidence, Authorization, RLS, Primary, Idempotency, Event and Audit infrastructure and requires one additive business table/enum plus controlled shared-whitelist/privilege changes.

This Plan is complete for **independent pre-development audit only**. It is not self-approved and is not an authorization to begin development.
