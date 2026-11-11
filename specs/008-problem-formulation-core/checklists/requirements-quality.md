# Slice 8 — Pre-development Requirements Quality Checklist

> This checklist is for the **new independent Pre-development Audit AI**. It is deliberately unmarked. Each row requires an explicit PASS/FAIL finding backed by repository evidence. A single FAIL blocks plan freezing/development.

## Audit verdict rule

```text
PASS  = requirement is unambiguous, upstream-traceable, implementation-feasible on the verified baseline,
        and has a mechanical verification path.
FAIL  = ambiguity, contradiction, missing invariant, unbounded scope, unverifiable requirement,
        or an implementation decision that would require a new product decision.
```

The auditor must not “fix” a FAIL inside this checklist. It must return the Plan to the owner/Plan AI.

---

## A. Frozen input / scope

| ID | PASS only if | FAIL if |
|---|---|---|
| CQ-001 | `main` still resolves to the audited implementation base or drift has been explicitly reconciled | Plan silently targets a different implementation truth |
| CQ-002 | frozen Spec commit is still `6a0df...` and Spec remains unchanged | Spec was edited by Plan work |
| CQ-003 | Spec branch relationship was independently verified as one Spec-only commit | extra code/docs exist on the frozen input branch |
| CQ-004 | authority order is explicitly preserved | Plan treats lower-level implementation as authority over Docs/Spec |
| CQ-005 | only `008-problem-formulation-core` is planned | Assessment/Scene/Goal/Safety/UI scope is pulled in |
| CQ-006 | OC-1 StartAssessment remains a minimal internal phase bridge | it becomes an Assessment engine/session/questionnaire/public endpoint |
| CQ-007 | OC-2 Dispute and Reassess remain separate | Dispute automatically triggers reassessment |
| CQ-008 | OC-3 exposes exactly four public formulation operations | any fifth public formulation/assessment transition endpoint appears |
| CQ-009 | no `Docs/**`, frozen `spec.md`, historical migration or existing Slice spec is planned for modification | Plan requires upstream artifact edits |
| CQ-010 | Open Product Decisions remains 0 | any required business choice is still unresolved |

---

## B. Upstream traceability / FR coverage

| ID | PASS only if | FAIL if |
|---|---|---|
| CQ-011 | FR-001 is implemented as a distinct formulation object, not merged into Case/Evidence/etc. | duplicate/merged truth source |
| CQ-012 | FR-002 exact six statuses/order are preserved | extra/renamed/reordered state |
| CQ-013 | FR-003 version starts at 1, monotonic, unique per Case, max one current | version/current invariant not mechanically enforceable |
| CQ-014 | FR-004 and FR-011 create a new complete version for substantive correction | history is mutated in place or patch-only history is stored |
| CQ-015 | FR-005/FR-030 identify only dialogue message or STATEMENT assertion as Start carrier | client free text/test fixture can satisfy Start |
| CQ-016 | FR-006 Present is a real internal command with no public endpoint | hidden/public present route or SQL shortcut exists |
| CQ-017 | FR-007 Evidence fidelity has a deterministic validation algorithm | “check Evidence” is left generic |
| CQ-018 | FR-008/009 Confirm guard contract and dependency revalidation are fully specified | GOALS can be reached without all frozen guards |
| CQ-019 | FR-010 Dispute leaves Case phase unchanged | Dispute changes phase |
| CQ-020 | FR-012 Reassess changes only Case phase/version and retains formulation | current formulation is silently changed/superseded by Reassess itself |
| CQ-021 | FR-013 has one and only one Slice-8 path into GOALS: Confirm | another command can enter GOALS |
| CQ-022 | FR-014 real-user authority is structural, not prompt-only | AI/system principal can reach Confirm/Dispute/Correct or confirmed_by |
| CQ-023 | FR-015 uses existing Slice 7 primary truth | duplicate primary flag/pointer/decision system |
| CQ-024 | FR-016 reuses five-state CaseStatus and existing Safety/Closed errors | PAUSED/Safety engine is reintroduced |
| CQ-025 | FR-017/018 use existing authorize + RLS architecture | new RBAC/role matrix or RLS-only authorization is invented |
| CQ-026 | FR-019 uses existing idempotency table/scope and true user actor | second idempotency store/system actor |
| CQ-027 | FR-020 defines both stale Case and stale formulation handling plus race outcomes | old-view overwrite remains possible |
| CQ-028 | FR-021 requires atomic event + business audit and replay de-duplication | audit/event is optional/best effort |
| CQ-029 | FR-022 exact four-route OpenAPI/runtime check exists | extra public route can escape contract tests |
| CQ-030 | FR-023 atomic rollback/fault injection is planned | partial success can remain |
| CQ-031 | FR-024 true empty state is concrete and non-fabricated | placeholder/default confirmed formulation |
| CQ-032 | FR-025/028/029 negative-space guard remains testable | out-of-scope placeholder tables/routes/modules are allowed |
| CQ-033 | FR-026 stores dependency refs but does not claim generic propagation | artifact dependency graph/propagation sneaks in |
| CQ-034 | FR-027 SUPERSEDED history is retained and runtime deletion denied | history can be deleted/reactivated |

---

## C. State semantics

| ID | PASS only if | FAIL if |
|---|---|---|
| CQ-035 | `DRAFT` is in enum but not persisted/observable in Slice 8 | DRAFT becomes a hidden current state without frozen behavior |
| CQ-036 | PRESENTED is the only state Confirm accepts | DISPUTED/NEEDS_REVIEW/SUPERSEDED/CONFIRMED can Confirm |
| CQ-037 | DISPUTED remains current and correctable | dispute deletes/supersedes automatically |
| CQ-038 | NEEDS_REVIEW remains current, non-confirmable, correctable | it confirms or changes phase automatically |
| CQ-039 | CONFIRMED is read-only in Slice 8 and Case is GOALS | confirmed row is correctable in GOALS by this Slice |
| CQ-040 | SUPERSEDED is noncurrent, read-only, permanent history | it can become current or mutate content |
| CQ-041 | every legal transition is listed and every other transition fails closed | implicit/default transitions remain |

---

## D. Version/current/history model

| ID | PASS only if | FAIL if |
|---|---|---|
| CQ-042 | no pointer table/current-id column is required | second current source of truth is introduced |
| CQ-043 | `(case_id,version)` uniqueness and predecessor chain are specified | version gaps/reuse/cycles are not bounded |
| CQ-044 | DB has an at-most-one-current fence under concurrency | current uniqueness relies only on application hope |
| CQ-045 | repository derives/validates current from version chain | status-only winner selection can mask corrupt chain |
| CQ-046 | correction old→SUPERSEDED + new→PRESENTED is one transaction | temporary committed zero/two-current state possible |
| CQ-047 | new corrected version clears confirmed fields | confirmation leaks across content changes |
| CQ-048 | runtime cannot UPDATE immutable content columns | direct SQL can rewrite history |
| CQ-049 | runtime cannot DELETE formulations | history retention depends only on route behavior |

---

## E. Data model quality

| ID | PASS only if | FAIL if |
|---|---|---|
| CQ-050 | all frozen fields are represented | any §18.1 field is missing |
| CQ-051 | structured JSON shapes are explicit and strict at API/domain layer | opaque arbitrary JSON/free-form objects |
| CQ-052 | top-level DB JSON/type checks provide defense in depth | malformed top-level values can persist freely |
| CQ-053 | `scene_fit` is explicit but Scene-agnostic | Digital Use/scene-specific vocabulary is hardcoded |
| CQ-054 | `confirmed_by` maps to real Person membership + manager authorization | arbitrary UUID/model actor can persist |
| CQ-055 | user_response is server-owned latest response fact | client can spoof kind/actor/time |
| CQ-056 | no Evidence/dependency relation table is needed for the frozen semantics | Plan adds polymorphic duplicate truth without FK value |
| CQ-057 | no GIN/search/index speculation is added without a query need | premature future indexing/modeling |

---

## F. Evidence fidelity / dependencies

| ID | PASS only if | FAIL if |
|---|---|---|
| CQ-058 | refs resolve only to existing dialogue/assertion/observation rows | new Evidence type/model appears |
| CQ-059 | same Family + same Case validation is explicit | cross-Case/cross-Family ref can pass |
| CQ-060 | assertion/observation current validity checks supersession + validity window | stale Evidence can Confirm |
| CQ-061 | UNKNOWN/NOT_COLLECTED/DECLINED cannot satisfy positive support | unknown is promoted to fact |
| CQ-062 | conflicts retain all relevant sides/no winner | one source can silently overwrite conflict |
| CQ-062A | ConflictItem accepts group-only with server resolver proof or no-group + >=2 distinct refs; mixed group+refs must agree | OpenAPI/domain requires refs unconditionally, accepts one-ref/no-group, or lets group and refs contradict |
| CQ-062B | every Evidence side returned by every `conflictGroupId` resolver is included in the server-derived `authoritativeEvidenceSet` | group-only sides are used only for ConflictItem format validation then discarded |
| CQ-063 | primary problem and each key factor require positive support | unsupported deterministic claim can persist |
| CQ-064 | nested evidence refs are reconciled to top-level snapshot | hidden/untracked support refs can exist |
| CQ-064A | for formulation-content commands, `authoritativeEvidenceSet = top-level refs UNION all server-resolved conflict-group sides` is the single Evidence input to validity/fidelity processing | any downstream path falls back to top-level refs alone |
| CQ-065 | dependency union is traceable and bounded | dependency payload embeds arbitrary bodies |
| CQ-066 | Confirm revalidates all determinable dependencies | dependency validation happens only at Present |
| CQ-066A | **Client cannot strip mandatory dependency**: server derives mandatory Evidence/current UNDER_14 Consent refs and Present/Correction require mandatory ⊆ complete candidate dependency set | caller-provided dependencyRefs are treated as the full truth |
| CQ-066B | Confirm re-derives server mandatory dependencies and proves mandatory(now) ⊆ current valid stored dependencies | Confirm only loops over whatever refs were previously stored |
| CQ-066C | mandatory EVIDENCE dependencies are derived from every member of `authoritativeEvidenceSet`, including group-only conflict sides | group-resolved sides can be omitted merely because they are absent from top-level refs |
| CQ-066D | Confirm re-resolves current conflict groups before mandatory completeness/validity checks | Confirm trusts the previously stored top-level Evidence snapshot and misses current group truth |
| CQ-067 | unsupported future dependency registry is reported as not currently verifiable, not guessed valid | false verification claim |
| CQ-068 | NEEDS_REVIEW propagation remains explicitly deferred | future propagation engine is partially invented |

---

## G. Phase / Case version

| ID | PASS only if | FAIL if |
|---|---|---|
| CQ-069 | Start: INTAKE→ASSESSMENT only | extra phase transitions |
| CQ-070 | Present: ASSESSMENT→PROBLEM_FORMULATION only | direct ASSESSMENT→GOALS |
| CQ-071 | Confirm: PROBLEM_FORMULATION→GOALS only | another status can drive GOALS |
| CQ-072 | Dispute/Correction do not change phase | they silently reassess/advance |
| CQ-073 | Reassess: PROBLEM_FORMULATION→ASSESSMENT only | actual Assessment workflow is executed |
| CQ-074 | all six successful writes increment existing `cases.version` | stale aggregate changes can be invisible to optimistic concurrency |
| CQ-075 | public stale Case control uses `If-Match` as a transport of existing Case version only | a second business version is invented |
| CQ-075A | every DB-backed integer version is capped at 2147483647 and If-Match is parsed/range-checked before SQL; 2147483648 is rejected | JS-safe-integer max leaks into contract or DB overflow can become 500 |
| CQ-076 | internal commands receive expected Case version | internal path can bypass stale-view protection |

---

## H. Authorization / RLS / actor

| ID | PASS only if | FAIL if |
|---|---|---|
| CQ-077 | GET current reuses CASE_READ | redundant read action changes permissions |
| CQ-078 | six mutation actions are additive Case actions under FAMILY_MANAGEMENT | new role/purpose/resource matrix |
| CQ-079 | authorization uses authoritative same-transaction facts | caller-provided role/manager flag is trusted |
| CQ-079A | processed Person set is server-derived from actor + Case creator + ACTIVE participants + authoritative Evidence subject/source refs | caller chooses who is subject to processing compliance |
| CQ-079B | **Consent/Compliance revalidated from server truth** with existing compliance seams for every Slice 8 mutation | authorization success is treated as proof that Consent/compliance is still valid |
| CQ-079C | **UNDER_14 processing gate cannot be bypassed**; current Consent id/version/notice must still satisfy existing gate | missing/revoked/stale Consent or stripped dependency can continue processing |
| CQ-079D | processed Person derivation consumes the complete `authoritativeEvidenceSet`, including subject/source on conflict-group-resolved sides | processing Persons are derived only from top-level refs |
| CQ-079E | a group-only conflict whose resolved side references an UNDER_14 Person executes the existing minor-processing/Consent gate | omitting `evidenceRefs` from ConflictItem bypasses UNDER_14 processing compliance |
| CQ-080 | recognized no-access cases collapse to CASE_NOT_FOUND without swallowing infrastructure failure | enumeration leak or fake 404 for 5xx |
| CQ-081 | new table ENABLE + FORCE RLS | RLS optional/not forced |
| CQ-082 | RLS is Family isolation, not a replacement for authorize() | manager/business policy is duplicated into SQL |
| CQ-083 | app role is non-owner/NOBYPASSRLS | privileged runtime bypass exists |
| CQ-084 | no-context and wrong-Family direct SQL tests exist | RLS behavior is asserted only by code inspection |
| CQ-085 | no DELETE policy/grant | direct deletion remains possible |

---

## I. Primary / Safety / status guards

| ID | PASS only if | FAIL if |
|---|---|---|
| CQ-086 | every mutation locks/re-reads `cases.is_primary` | stale primary read can authorize a write |
| CQ-087 | GET current remains readable after demotion when authorized | data disappears with primary status |
| CQ-088 | SAFETY_HOLD blocks all six writes with existing semantic | any normal progression bypass |
| CQ-089 | CLOSED blocks all six writes | closed Case can mutate formulation |
| CQ-090 | WAITING/LOST_CONTACT are not given new Slice 8 semantics | Plan invents lifecycle behavior |
| CQ-091 | no PAUSED/PauseCase/ResumeCase is reintroduced | removed Case-level PAUSED returns |

---

## J. Idempotency / concurrency

| ID | PASS only if | FAIL if |
|---|---|---|
| CQ-092 | all six writes use existing idempotency table | any second store/cache |
| CQ-093 | exact logical key representation is specified and compatible with current bytea Case commands | lossy hash/truncation/reserved-prefix identity |
| CQ-094 | replay lookup occurs after auth but before mutable business-state checks | replay can change based on newer state |
| CQ-095 | same-key mismatch returns existing error | payload can overwrite prior key result |
| CQ-096 | deterministic post-auth business 4xx replay strategy is explicit | same key can later produce a different business result |
| CQ-097 | infrastructure failure rolls back slot/business state | failed attempt becomes a false replay success |
| CQ-098 | canonical lock order is idempotency→Family→Case→formulation | opposite order can deadlock with Slice 7 |
| CQ-099 | Present/Correction current creation is protected by lock + DB uniqueness | dual current possible |
| CQ-100 | all required pairwise races have expected loser semantics | “concurrency tested” is generic |
| CQ-101 | SwitchPrimaryCase races share the Family serialization point | primary guard can race with demotion |
| CQ-101A | Present/Switch, Confirm/Switch, **Correction/Switch**, and Reassess/Switch are each explicit real-concurrency tests | Correction is hidden behind a generic “non-phase mutation” or substituted by Dispute |

---

## K. Events / audit

| ID | PASS only if | FAIL if |
|---|---|---|
| CQ-102 | exact event names are frozen in Plan | free strings/runtime-defined event names |
| CQ-103 | existing case-event CHECK values/branches are preserved | migration broadens/removes old validation |
| CQ-104 | metadata is strict and content-free | problem text/user note/PII enters audit/event |
| CQ-105 | exactly one event + one business audit per successful command | missing or duplicated records |
| CQ-106 | exact idempotent replay adds neither | replay duplicates history |
| CQ-107 | audit resource type addition is exactly PROBLEM_FORMULATION (plus existing CASE use) | generic/unbounded resource type |

---

## L. Migration / privileges

| ID | PASS only if | FAIL if |
|---|---|---|
| CQ-108 | next migration is based on actual current list and named `008_problem_formulation_core.sql` if unchanged | numeric assumption ignores repo state |
| CQ-109 | both existing `004_*` files are included in migration evidence | test assumes one migration per number |
| CQ-110 | 008 is additive and no old migration is edited | history rewrite |
| CQ-111 | Case UPDATE is column-level only for phase/version/updated_at | table-level Case UPDATE becomes true |
| CQ-112 | formulation UPDATE grant excludes content/version/scope chain | direct immutable-history rewrite |
| CQ-113 | fresh migration test exists | only upgrade path tested |
| CQ-114 | 001–007→008 upgrade test exists | only fresh path tested |
| CQ-115 | second apply no-op/replay test exists | migration is not reproducible |
| CQ-116 | transactional failure/rollback evidence exists | partial DDL may survive |
| CQ-117 | shared CHECK names/definitions are read from real pre-development DB/schema before authoring | stale copied constraint SQL |

---

## M. OpenAPI / runtime contract

| ID | PASS only if | FAIL if |
|---|---|---|
| CQ-118 | contract contains exactly four Slice 8 paths/operations | internal command exposed |
| CQ-119 | GET current has a concrete true-empty response | absence semantics remain undecided |
| CQ-120 | mutations declare Idempotency-Key + If-Match | retry/stale Case contract absent |
| CQ-121 | strict schemas reject server-owned fields | client can set status/version/confirmed_by |
| CQ-121A | OpenAPI/Zod ConflictItem and DB-backed version bounds match the domain rules | contract still requires evidenceRefs for group-only or exposes >2147483647 |
| CQ-122 | Correction body is patch input but response/new row is complete version | patch-only persistence |
| CQ-123 | error categories preserve 404 anti-enumeration/409 conflicts/422 validation | semantic categories collapse |
| CQ-124 | frozen YAML is added to semantic-equivalence union | generated contract can drift silently |
| CQ-125 | generated artifacts are produced only by `openapi:generate` | hand-editing generated JSON/types |
| CQ-126 | runtime route enumeration proves no fifth operation | OpenAPI-only proof hides runtime route |

---

## N. Tests / negative paths / acceptance

| ID | PASS only if | FAIL if |
|---|---|---|
| CQ-127 | DB/domain/integration/OpenAPI layers are all separately planned | one broad integration suite is expected to prove everything |
| CQ-128 | frozen acceptance scenarios 1–25 are all mapped | any scenario has no mechanical evidence |
| CQ-129 | user-required A–K scenarios are all mapped | any A–K scenario is missing |
| CQ-130 | wrong family/actor/case/nonprimary/phase/Safety/Closed/stale/superseded/dependency/retry paths exist | major negative path omitted |
| CQ-130A | named negatives cover missing/revoked/stale Consent, UNDER_14 block, mandatory dependency omitted, dependency stripped by Correction, client dependency set incomplete, and 2147483647/2147483648 boundaries | any S8-PA-001/003 bypass remains untested |
| CQ-130B | mandatory tests cover group-only conflict + UNDER_14 compliance, group-only conflict + omitted resolved Evidence dependency for Present/Correction, and Confirm-time re-resolution with missing/stale group dependency | the conflict resolver path is not exercised through compliance/dependency closure |
| CQ-131 | real concurrent requests are used for race tests | concurrency is mocked/sequential only |
| CQ-132 | transaction fault injection verifies zero partial writes | atomicity only inferred from BEGIN/COMMIT |
| CQ-133 | AI/system-confirm negative persistence check exists | only type-level assertion |
| CQ-134 | generated/runtime OpenAPI drift test exists | generated JSON is trusted without runtime comparison |

---

## O. Existing-governance reconciliation / out-of-scope protection

| ID | PASS only if | FAIL if |
|---|---|---|
| CQ-135 | `guard-static` removes only the now-owned formulation table from forbidden list | broad scope guard disabled |
| CQ-136 | Case scope tests are narrowed, not deleted | old protections disappear |
| CQ-137 | DB evidence/count tests are updated exactly for 008 | brittle old counts are simply removed |
| CQ-138 | roles tests preserve table-level Case UPDATE=false | least privilege regression |
| CQ-139 | all unrelated forbidden tables/routes remain forbidden | future objects are admitted “for convenience” |
| CQ-140 | internal commands are tested through a real application-service seam | test-only public route/SQL fixture becomes production shortcut |

---

## P. Final development verification design

| ID | PASS only if | FAIL if |
|---|---|---|
| CQ-141 | focused Slice 8 tests are named/locatable | no targeted debugging path |
| CQ-142 | migration/role/db-evidence commands are included | DB correctness relies on unit tests |
| CQ-143 | OpenAPI generate + semantic check are included | contract can drift |
| CQ-144 | typecheck/static guard/coverage/full test/verify-all are included | repository-wide regressions can escape |
| CQ-145 | final `git diff --check`, name-status and clean-tree review are included | scope drift cannot be mechanically spotted |
| CQ-146 | final review explicitly checks Docs/spec/history migrations unchanged | forbidden artifact edits can slip through |

---

## Required auditor output

The independent Pre-development Audit AI should output:

```text
SLICE 8 — PRE-DEVELOPMENT AUDIT

Checklist PASS: <n>/146
Checklist FAIL: <n>/146
CRITICAL: <n>
HIGH: <n>
MEDIUM: <n>
LOW: <n>

Open Product Decisions: <n>
Scope Drift: <n>

FINAL: PASS / FAIL
```

`PASS` is permitted only when all 146 checklist rows pass and Open Product Decisions = 0. A PASS may then authorize the separate owner step `PLAN FROZEN`; this Plan AI does not make that declaration.
