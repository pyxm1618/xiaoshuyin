# Slice 9 Implementation Plan — 009-safety-hold-control-foundation

Status: **PLAN AI 2 COMPLETE / PRE-DEVELOPMENT AUDIT 1 PASS**

This file is planning only. It does not authorize merge, does not implement production code, and does not change the frozen Spec.

## 1. Verified Inputs

### 1.1 Repository and immutable references

- Repository: `pyxm1618/xiaoshuyin`
- Re-verified authoritative `origin/main`: `8e393c990be53c888c2e68d881bd8b23f9c37638`
- Latest merged change represented by that main: PR #25, Digital Use authority remediation.
- Current-main CI: run `42973063888`, completed **success** on the exact main SHA.
- Frozen Spec branch: `spec/009-safety-hold-control-foundation`
- Frozen Spec commit: `6737b90b7b0809fc12bdb2aae7fa46db45531403`
- Frozen Spec blob: `9d11288aa063ae2a3b8e1942334083f9d82a804b`
- Frozen Spec commit parent: exactly `8e393c990be53c888c2e68d881bd8b23f9c37638`.
- Compare `main...6737b90`: one commit ahead, zero behind, only `specs/009-safety-hold-control-foundation/spec.md` added.

**Input Drift: NONE.** The frozen Spec remains a legal direct child of the current authoritative main. Selection is not reopened.

### 1.2 Authoritative documents re-read

Planning re-read the required Safety / data / command / implementation contracts in:

- `Docs/V1产品需求.md`
- `Docs/V1技术设计.md`
- especially V1 技术设计 §6.6, §6.7, §7.0, §23, §27.1, §27.3, §38, §39, §41.

Controlling conclusions:

1. `cases.status` is the Case-status fact and `SAFETY_HOLD` is a Case status.
2. Entering hold suppresses ordinary generation/progression/reminders; it does not create a parallel state machine.
3. Only `ResolveRisk` exits `SAFETY_HOLD`, and the target status is `WAITING`; phase is not auto-resumed.
4. AI/models may propose/request; they do not own Safety mutation.
5. PostgreSQL owns business facts; Drizzle is the typed data-access layer, not a second business-fact source.
6. §7.0 requires **Drizzle schema + query builder + transaction**, with explicit SQL allowed for complex SQL/RLS/index/locking/CTE work.
7. Safety professional content, support resources, referral and operations are Phase 5 and are excluded here.

### 1.3 Slice 8 current state

- Frozen Slice 8 Spec: `6a0df0021cf4dd0f489178a192479a52ea6027f4`.
- Current Slice 8 planning head: `31c03a2355fa8b5972d56ea26684fb7f8df7b8f4`.
- The Slice 8 branch is three planning commits beyond its frozen Spec and contains `plan.md`, `tasks.md`, `data-model.md`, checklist and frozen API contract.
- No Slice 8 implementation PR or implementation branch was found; current main contains no Problem Formulation runtime.
- Slice 8 currently plans `008_problem_formulation_core.sql`.
- Slice 8 ordinary write commands are exactly:
  - `StartAssessment`
  - `PresentProblemFormulation`
  - `ConfirmProblemFormulation`
  - `DisputeProblemFormulation`
  - `CorrectProblemFormulation`
  - `ReassessFromFormulation`
- Its current plan locally checks `case.status != SAFETY_HOLD`; Slice 9 must provide the shared contract that replaces that duplicated local check when integration occurs.

## 2. Architecture Baseline

Current main has:

- `case_status = OPEN | WAITING | LOST_CONTACT | SAFETY_HOLD | CLOSED`.
- `cases.version` optimistic aggregate version.
- Family RLS and `withRlsTransaction`.
- one pure `authorize()` entry plus same-transaction fact loading.
- existing `idempotency_keys` store and canonical request hashing.
- append-only `case_events`.
- `business_audit_events`.
- Slice 7 `SwitchPrimaryCase` with deterministic Family → sorted Case locking and Safety precedence:
  1. target CLOSED
  2. target SAFETY_HOLD
  3. current SAFETY_HOLD
  4. already primary
  5. stale view
  6. allow.
- runtime persistence and transactions are currently overwhelmingly raw `node-postgres`.
- `drizzle-orm` is installed in the API workspace and `db/drizzle.config.ts` exists, but:
  - `db/schema` does not exist;
  - `drizzle-kit` is not present in the lockfile;
  - there is no real Drizzle runtime data-access path on main.

There is no `risk_events` table and no `safety_states` table.

## 3. Dependency Map

Slice 9 reuses, rather than replaces:

- Case aggregate: `cases.status`, `cases.phase`, `cases.version`.
- Primary serialization: Family row lock followed by Case row lock.
- Authorization: `@xiaoshuyin/authorization authorize()`.
- RLS context functions: `app.set_identity_context`, `app.set_family_context`.
- Idempotency: existing `idempotency_keys`, request hashing and exact key identity.
- Case lifecycle trace: `case_events`.
- Cross-resource business audit: `business_audit_events`.
- Existing Evidence carriers for resolution references when a controlled test exercises resolution.

Slice 9 adds only:

- deterministic Safety precheck contracts;
- one append-only Safety trace table `risk_events`;
- `EnterSafetyHold`;
- reusable ordinary-progression Safety guard;
- `ResolveRisk` domain contract with production authority fail-closed;
- required event/audit/idempotency vocabulary;
- a narrow Drizzle-compliant transaction/query path for Slice 9.

No Scene, AI, RAG, support, Referral, operations or professional Safety catalog is introduced.

## 4. Data Model

### 4.1 Single current Safety truth

The only current hold-state fact is:

`cases.status = 'SAFETY_HOLD'`

There is no `safety_states`, no `risk_events.current_state`, no active-state boolean, and no mutable Safety status row.

### 4.2 `risk_events` — append-only trace object

Planned logical shape:

| Column | Contract |
|---|---|
| `id` | uuid PK, DB default `uuidv7()` |
| `family_id` | uuid, required |
| `case_id` | uuid, required |
| `actor_account_id` | uuid, required originating authenticated context |
| `event_kind` | closed text CHECK: `HOLD_ENTERED` or `RISK_RESOLVED` |
| `decision_case_version` | integer >= 1; locked Case revision against which the event was decided |
| `policy_ref` | opaque non-sensitive policy identifier; required only for HOLD_ENTERED |
| `policy_version` | opaque reviewed version identifier; required only for HOLD_ENTERED |
| `rule_ref` | opaque deterministic rule identifier; required only for HOLD_ENTERED |
| `rule_version` | opaque deterministic rule version; required only for HOLD_ENTERED |
| `risk_category_ref` | bounded category code, never raw user text; required only for HOLD_ENTERED |
| `evidence_refs` | strict JSON array of typed opaque references; resolution requires non-empty |
| `resolution_of_risk_event_id` | same-Case HOLD_ENTERED event; required only for RISK_RESOLVED |
| `resolution_authority_ref` | opaque verified capability reference; required only for RISK_RESOLVED |
| `created_at` | server timestamp |

Structural invariants:

- composite FK `(case_id, family_id) -> cases(id, family_id)`;
- a same-Case composite self-FK for `resolution_of_risk_event_id`;
- HOLD_ENTERED requires policy/rule/category identity and forbids resolution-only fields;
- RISK_RESOLVED requires `resolution_of_risk_event_id`, non-empty evidence refs and authority ref, and does not duplicate the original policy/rule payload;
- unique partial fence prevents two RISK_RESOLVED rows for the same HOLD_ENTERED event;
- indexes on `(case_id, created_at, id)`, `(family_id, created_at, id)`, and resolution link as needed;
- no raw message text, formulation text, free-form risk narrative, review notes, support copy or model output.

### 4.3 Immutability

Runtime privileges are `SELECT, INSERT` only on `risk_events`.

No UPDATE/DELETE application repository function is created. DB tests verify the runtime role cannot mutate/delete a Risk Event. Historical trace correction, if ever required, must be a future explicit contract; Slice 9 does not silently overwrite history.

## 5. Drizzle Strategy

### 5.1 Gate result

**DRIZZLE GATE: PASS — Option A / Narrowly compliant.**

This is not Option C: current architecture does **not** already satisfy §7.0.

This is not a whole-repository data-layer rewrite. Slice 9 must establish a narrow, real Drizzle path for the persistence it owns.

### 5.2 Required implementation shape

Development must add:

1. the missing reviewed `drizzle-kit` development dependency;
2. `db/schema/` with the minimum typed Drizzle projections required by Slice 9:
   - `cases`
   - `risk_events`
   - `case_events`
   - `business_audit_events`
   - only additional touched tables if technically required;
3. a Drizzle-backed transaction entry for Slice 9 using the existing `node-postgres` pool and the existing RLS context functions;
4. Drizzle query-builder writes for ordinary Slice-9-owned CRUD:
   - Case status/version transition;
   - Risk Event insert;
   - Case Event insert;
   - Business Audit insert;
5. explicit `sql` only where justified by §7.0:
   - `FOR UPDATE` lock acquisition;
   - RLS `set_*_context` calls and identity verification;
   - existing idempotency-slot locking/replay mechanics if reused as-is;
   - catalog/introspection tests.

### 5.3 Transaction lifecycle

Do **not** replace the whole existing raw-pg transaction framework.

Add a narrow checked-out-client Drizzle transaction seam that:

- checks out one `pg.PoolClient`;
- preserves the existing connection-level error listener / broken-client eviction discipline;
- constructs Drizzle on that exact checked-out client;
- lets **Drizzle own BEGIN/COMMIT/ROLLBACK** for the Slice 9 transaction;
- establishes identity + Family RLS context inside that Drizzle transaction;
- may expose the same checked-out client only to already-existing shared fact/idempotency helpers that have not yet migrated, never to create a second transaction.

A Safety command may not open a raw nested transaction.

### 5.4 No second schema truth

Reviewed SQL migration files remain the only production schema-change vehicle. Drizzle schema is the type-safe code projection required by §7.0, not an independent business-fact source.

Mechanical parity is mandatory:

- fresh-migration DB introspection must match the Drizzle projection for every Slice 9 column/type/nullability relevant to runtime;
- migration reproduction tests remain authoritative for deployed objects;
- no `drizzle-kit push`;
- no broad migration generation against a partial schema that would attempt to drop unrelated existing tables.

If development cannot preserve these conditions, T902 stops development and the result becomes **DATA ACCESS CONTRACT NOT IMPLEMENTABLE NARROWLY** rather than falling back to raw-pg-only code.

## 6. Domain Command Design

### 6.1 `RunSafetyPrecheck`

Internal, pure/deterministic, no mutation.

Inputs:

- locked/current Case snapshot identity + status + version;
- server-owned **approved deterministic rule evaluation input** containing opaque policy/rule/category identities and structured reference IDs only.

It is not permitted to accept `isHighRisk=true` or equivalent caller boolean as authority.

Decision union:

- `ALLOW`
- `ENTER_HOLD`
- `ALREADY_HELD`

Every decision binds to Case ID + Case version. ENTER_HOLD additionally binds policy/rule/category version identity and evidence refs.

There is no network, LLM, RAG, Guardrails or external service call.

No professional risk-word catalog is invented. Tests provide deterministic approved fixtures. Production wiring does not claim complete risk recognition until a later approved policy source exists.

### 6.2 `EnterSafetyHold`

Internal Domain Command only. No HTTP endpoint.

Preconditions:

- authenticated originating Account/Person context;
- visible Case in the resolved Family;
- existing `authorize()` allows Case access for this internal action;
- precheck decision is valid ENTER_HOLD;
- decision Case version equals the locked current Case version;
- current approved policy/rule identity supplied by the trusted deterministic policy seam still matches the decision;
- Case is not CLOSED and not already SAFETY_HOLD.

Effects in one transaction:

- `cases.status -> SAFETY_HOLD`;
- preserve `cases.phase`;
- `cases.version += 1`;
- append HOLD_ENTERED Risk Event;
- append Case Event;
- append Business Audit Event;
- complete idempotency result.

### 6.3 `ResolveRisk`

Internal Domain Command only. No public route.

Preconditions:

- current Case status is exactly SAFETY_HOLD;
- expected Case revision equals locked revision;
- caller has separate verified resolver capability fact;
- production resolver fact source returns no capability by default;
- required review evidence refs are structurally valid, same Family/Case where applicable, and valid under their existing carrier contract;
- exactly one unresolved HOLD_ENTERED trace corresponds to the current held period; trace inconsistency is an internal invariant failure, never a second source of status truth.

Effects:

- `cases.status -> WAITING`;
- preserve phase;
- `cases.version += 1`;
- append RISK_RESOLVED Risk Event linked to the entry event;
- append Case Event and Business Audit Event;
- complete idempotency result.

No old task/phase resumes automatically.

## 7. Safety Guard Design

Export a reusable domain/application policy equivalent to:

`AssertOrdinaryProgressionAllowed(tx, caseId)`

Rules:

- reads the Case again **inside the caller-owned transaction**;
- never trusts a caller-provided status snapshot;
- if current status = SAFETY_HOLD, throws stable `SAFETY_HOLD_BLOCKED`;
- cross-Family/non-visible rows remain non-leaking;
- no mutation;
- no network;
- safe for all future ordinary progression commands.

A pure status-decision helper may exist for unit testing, but production command paths call the transaction-backed guard.

The guard is **not** globally installed on all writes. Evidence capture, consent, authorization, data rights and risk-resolution evidence are not blocked solely because the Case is held.

## 8. Authorization

### 8.1 Single authorization entry

Continue using the current `authorize()` registry/facts model. Do not introduce a parallel RBAC or Safety-role framework.

Planned additive actions:

- `CASE_ENTER_SAFETY_HOLD`
- `CASE_RESOLVE_RISK`

The exact action literals may be adjusted only to the repository's final naming convention; semantics may not change.

### 8.2 Enter authority

Family/Case access is authorized through `authorize()`, but that access alone does not authorize a hold transition. ENTER_HOLD also requires the trusted deterministic policy decision contract. There is no public client mutation path.

### 8.3 Resolve authority: production fail-closed

Add a **SafetyResolutionAuthority fact source port**, whose output is a fact fed into the existing authorization decision. It is not a second authorization engine.

Production implementation:

- returns no resolver capability;
- therefore `CASE_RESOLVE_RISK` denies by default;
- manager, guardian, ordinary member, admin-like string, model and system caller do not infer resolver authority.

Controlled test implementation:

- exists only in test/support composition;
- produces a typed verified resolver capability for transition-semantics tests;
- is not exported by the production app;
- creates no staff account, route, queue, hotline or human-service claim.

## 9. Transaction Model

Canonical successful `EnterSafetyHold` order:

1. validate internal command envelope and authenticated actor context;
2. resolve Family and enter one Drizzle-owned RLS transaction;
3. read authoritative authorization facts and call `authorize()`;
4. acquire/replay the existing idempotency slot;
5. if replay/mismatch, return without business locks/writes;
6. lock Family row `FOR UPDATE`;
7. lock target Case row `FOR UPDATE`;
8. re-read Case state/version and validate CLOSED / held / precheck freshness;
9. revalidate current approved policy/rule identity against the precheck decision;
10. update Case status/version, preserving phase;
11. insert HOLD_ENTERED Risk Event;
12. insert Case Event;
13. insert Business Audit Event;
14. complete idempotency result;
15. commit.

Canonical successful `ResolveRisk` uses the same order, then after Case lock:

- assert held + expected revision;
- resolve the single active hold trace for linkage without treating it as status truth;
- verify separate resolver authority and review evidence;
- update Case to WAITING;
- append resolution trace/events/audit;
- complete idempotency;
- commit.

No transaction contains an external call.

## 10. Idempotency

Reuse `idempotency_keys`; no new store/cache/table.

Add command vocabulary:

- `CASE_ENTER_SAFETY_HOLD`
- `CASE_RESOLVE_RISK`

Both use the existing exact key representation convention used by modern Case mutations and canonical request hashes.

Hash inputs include server-verified Family/Case identity, expected Case version, and semantic decision/reference IDs. The transport key itself is scope, not payload.

Semantics:

- same key + same payload -> replay exact original result, no duplicate transition/Risk Event/event/audit;
- same key + different payload -> `IDEMPOTENCY_PAYLOAD_MISMATCH`;
- deterministic authorized 4xx business outcome after slot acquisition may be stored as the command result with zero business mutation;
- auth/schema/infrastructure failure does not become a successful snapshot;
- internal failure rolls the slot back with all other writes.

## 11. Concurrency

All Case mutations in this Slice use the existing aggregate ordering:

`idempotency slot -> Family row -> Case row -> Risk Event row when needed -> evidence reads/locks -> writes -> events -> audit -> idempotency completion`

Required outcomes:

- two concurrent Enter attempts, different keys: at most one Case transition, exactly one version advance, one HOLD_ENTERED Risk Event; loser observes already held;
- same-key concurrent Enter: one execution, peers replay;
- two concurrent Resolve attempts: at most one held->WAITING transition and one resolution event; loser observes no longer held / conflict;
- same-key concurrent Resolve: one execution, peers replay;
- Enter vs SwitchPrimary and Enter vs Slice-8 progression are serialized by Family->Case ordering; whichever wins determines the valid later precondition;
- no opposite Case->Family lock order may be introduced.

Isolation remains READ COMMITTED unless an implementation test demonstrates a contract failure; changing isolation is not a planning escape hatch.

## 12. RLS

`risk_events`:

- ENABLE RLS;
- FORCE RLS;
- family-scope USING/WITH CHECK: `family_id = app_family_id()`;
- runtime SELECT + INSERT only;
- no UPDATE/DELETE policy/privilege.

`cases`:

- preserve existing Family RLS;
- add only column-level UPDATE required by Safety: `status, version, updated_at`;
- table-level UPDATE must remain false;
- do not grant phase write for Slice 9.

`case_events` remains append-only.

DB tests prove:

- no Family context: Risk Event invisible/write denied;
- wrong Family context: invisible/write denied;
- correct Family context: permitted only within authorized application path;
- cross-Family Case/Risk link impossible structurally and by RLS;
- runtime role remains NOBYPASSRLS and non-owner.

## 13. Event / Audit

### 13.1 Risk Event

Purpose: Safety-specific trace with policy/rule/evidence/authority references.

Contains the detailed Safety trace identifiers, but never raw sensitive text.

### 13.2 Case Event

Add strict event types:

- `CASE_SAFETY_HOLD_ENTERED`
- `CASE_RISK_RESOLVED`

Strict metadata only:

- fromStatus
- toStatus
- fromVersion
- toVersion
- riskEventId

No policy payload, evidence content or free text.

### 13.3 Business Audit Event

Add the same two action event types or repository-convention-equivalent literals while keeping resource_type = `CASE`.

Metadata is minimal:

- riskEventId
- fromVersion
- toVersion
- resolverAuthorityRef only for resolution when applicable.

Actor Account remains the existing audit actor field.

The three artifacts have distinct responsibilities; identical sensitive payload is not copied across them.

## 14. Error Model

Stable machine semantics:

| Condition | Planned machine semantic |
|---|---|
| no actor | existing `UNAUTHENTICATED` |
| no authority | existing non-leaking authorization denial / `CASE_NOT_FOUND` at an anti-enumerating boundary |
| invisible/cross-Family Case | `CASE_NOT_FOUND` |
| CLOSED | `CASE_CLOSED` |
| Enter when already held | `SAFETY_HOLD_ALREADY_ACTIVE` |
| ordinary progression while held | existing `SAFETY_HOLD_BLOCKED` |
| stale Case revision | `STALE_CASE_VERSION` |
| stale Case/policy-bound precheck | `SAFETY_PRECHECK_STALE` |
| malformed/unapproved precheck | `SAFETY_PRECHECK_INVALID` |
| invalid resolution evidence | `SAFETY_REVIEW_EVIDENCE_INVALID` |
| resolver explicitly denied | `SAFETY_RESOLUTION_AUTHORITY_DENIED` |
| no production resolver source | `SAFETY_RESOLUTION_AUTHORITY_UNAVAILABLE` |
| Resolve when no longer held | `SAFETY_HOLD_REQUIRED` |
| same key different payload | existing `IDEMPOTENCY_PAYLOAD_MISMATCH` |
| transaction/DB/unexpected | existing generic `INTERNAL_ERROR` |

No error body exposes another Family's object existence, evidence, risk category, policy match or review content.

## 15. Slice 8 Integration Contract

Current Slice 8 is planned but unimplemented. Slice 9 does **not** copy its runtime.

When Slice 8 implementation consumes the shared guard, all six ordinary write commands listed in §1.3 must obey:

1. authenticate / resolve Family / authorize under its existing contract;
2. acquire/replay idempotency according to Slice 8 semantics;
3. acquire the existing Family lock;
4. acquire/re-read the target Case lock;
5. call `AssertOrdinaryProgressionAllowed(tx, caseId)`;
6. only after the guard passes may command-specific phase/formulation writes occur.

Machine error: `SAFETY_HOLD_BLOCKED` (existing Slice 7/8 vocabulary).

No bypass rule:

- no command may trust a Case status passed from route, candidate object, model output or earlier read;
- no internal Slice 8 command gets a test-only bypass;
- read-only GET current formulation is not ordinary progression and is not blocked solely by Safety.

Version rule:

- Safety guard does not increment Case version;
- the command compares its expected version against the same locked Case snapshot after serialization;
- a Safety transition that wins first advances Case version and causes the later Slice 8 attempt to fail held/stale without business writes.

If Slice 8 merges before Slice 9 development finishes, integration becomes an actual development task. If Slice 8 is still unmerged, Slice 9 exposes the stable shared guard and records this mechanical contract; it does not edit Slice 8 planning files.

## 16. Migration Coordination

Current main highest prefix is 007. Slice 8 planning has provisionally claimed `008_problem_formulation_core.sql`.

Slice 9 planning therefore uses **provisional** name:

`009_safety_hold_control_foundation.sql`

The number is not a product/frozen-spec contract.

Both Slice 8 and Slice 9 extend shared CHECK/privilege surfaces, including Case Event, audit and idempotency vocabulary. Therefore merge is serialized:

- if Slice 8 lands first as 008, Slice 9 rebases latest main, keeps/renumbers to the next available prefix (normally 009), and rebuilds every shared CHECK from the actual post-008 definition;
- if Slice 9 is to land first, it must rebase current main and take the next available prefix (normally 008); Slice 8 must then rebase and renumber/re-author its migration to the next prefix;
- the **second** migration-bearing branch to merge must always re-read real `pg_constraint`, grants and migration history and preserve every literal introduced by the first;
- no branch may merge a stale DROP+ADD CHECK copied from a 007 baseline after the other branch has extended that CHECK.

Fresh, upgrade, replay and failed-migration rollback evidence are mandatory after final numbering.

**Parallel development: PARTIALLY.** Semantic/code work may proceed in parallel; shared migration/check/vocabulary closeout is serialized.

## 17. Test Strategy

### Unit

- precheck deterministic for identical inputs;
- held status produces ALREADY_HELD;
- no rule catalog invention / approved-input boundary;
- invalid decision shape rejected;
- guard decision semantics;
- Enter transition validation;
- Resolve transition validation;
- error mapping;
- event/audit metadata minimization.

### Integration

- Enter successful internal command;
- second Enter does not duplicate;
- ordinary command blocked with `SAFETY_HOLD_BLOCKED`;
- SwitchPrimary current-held and target-held regression with original precedence;
- production ResolveRisk fail-closed;
- controlled test resolver can exercise held->WAITING semantics without production route/role;
- idempotency replay/mismatch;
- stale Case version;
- stale precheck;
- no public Safety mutation route.

### DB

- migration fresh/upgrade/replay;
- Risk Event constraints, FKs, indexes;
- RLS and cross-Family isolation;
- runtime privilege matrix;
- exact atomic rollback;
- concurrent Enter;
- concurrent Resolve;
- single resolution per hold trace;
- cases.status remains the only current Safety-state column/table.

## 18. Failure Injection

At minimum:

1. Case UPDATE succeeds, Risk Event INSERT is injected to fail -> Case update, all events/audit/idempotency rollback.
2. Risk Event INSERT succeeds, Business Audit INSERT is injected to fail -> Case, Risk Event, Case Event, audit and idempotency all rollback.
3. Case Event insert failure -> same full rollback.
4. idempotency completion failure after all business writes -> full rollback.
5. transaction connection/rollback behavior preserves original failure and does not return a known-broken checked-out client to the healthy pool.

Fault injection is test-only and must not add a production bypass flag.

## 19. DFX

### Reliability

- one PostgreSQL transaction per mutation;
- no external I/O in transaction;
- deterministic Family->Case lock order;
- exact idempotency;
- failure-injection coverage;
- stale decision protection.

### Privacy

- Risk/Event/Audit records contain opaque IDs/codes and references, not raw user text;
- no model prompt, transcript, formulation body or free-form review notes are copied.

### Security

- authorize first;
- Family RLS second hard boundary;
- production resolver authority is deny-by-default;
- no public mutation endpoint;
- no system/model write authority.

### Maintainability

- one shared ordinary-progression guard;
- one Case status truth;
- one idempotency store;
- explicit event roles;
- Drizzle projection parity tests.

### Performance

- narrow row locks;
- indexed Risk Event Case/Family timelines;
- no network/LLM/RAG call;
- no global DB write lock.

## 20. Scope Guardrails

Explicitly forbidden:

- `support_resources`;
- support copy / hotline;
- Referral;
- staff queue, resolver UI, operations dashboard;
- fake expert/staff account;
- Alibaba Guardrails;
- `risk_review` model runtime;
- LLM/RAG;
- Digital Use Scene / manifest / A1001-A5002;
- Problem Formulation implementation;
- Goal / Intervention / Plan / Task / Review / Follow-up / Notification;
- new public Safety mutation route;
- a `safety_states` current-state table.

The existing static guard that forbids `safety_states` must remain. Slice 9 must not weaken unrelated future-table prohibitions.

## 21. Implementation Sequence

1. Reverify main, frozen inputs, Slice 8 head and migration state.
2. Establish the narrow Drizzle foundation and prove it with a focused transaction/schema test before Safety business code.
3. Add reviewed Safety migration / Risk Event schema / grants / vocabulary.
4. Add pure types, precheck and transition policies.
5. Add authorization facts and production deny-all resolver source.
6. Implement Risk Event/event/audit persistence through the Drizzle transaction.
7. Implement EnterSafetyHold.
8. Implement transaction-backed shared ordinary-progression guard.
9. Refactor SwitchPrimaryCase to consume shared semantics without changing precedence.
10. Implement ResolveRisk with controlled test-only authority composition.
11. Close idempotency/concurrency/atomicity tests.
12. Integrate Slice 8 only if its runtime has landed; otherwise prove/export the seam and retain the integration contract.
13. Add unique-exit static enforcement and governance updates.
14. Run focused + full verification, then re-check branch diff against audited planning head.

## 22. Rollback / Recovery

Migration:

- pre-production validation may roll back only objects created/extended by the final Safety migration and restore exact prior CHECK/grant definitions;
- once real Risk Event history exists, destructive rollback is forbidden; use a reviewed forward-fix migration.

Runtime:

- any command error rolls back the entire transaction;
- no manual direct SQL should be used to “repair” a partially committed Safety transition because partial commit must be impossible;
- a detected trace/status invariant mismatch returns internal failure and requires explicit engineering remediation, not inferred state mutation.

Drizzle:

- if schema parity or transaction ownership tests fail, do not fall back to raw-pg-only Safety code; stop under the Drizzle gate.

## 23. Acceptance Mapping

| Frozen acceptance area | Planned evidence |
|---|---|
| deterministic precheck | unit determinism + no-network/static dependency test |
| enter from unclosed state | internal command integration + DB state/event trace |
| closed cannot reopen | integration/DB negative test |
| ordinary progression blocked | shared guard integration test |
| SwitchPrimary preserved | existing regression suite + shared-guard regression |
| not a global write lock | evidence/consent/data-rights regression proves no automatic block |
| unique Resolve exit | controlled resolver test + static unique-exit guard |
| production fail closed | production composition test with no capability |
| WAITING/no auto-resume | Resolve integration asserts phase unchanged and no task/phase side effect |
| Risk Event trace | DB structure/content-minimization tests |
| RLS | no/wrong/correct Family DB tests |
| idempotency | replay/mismatch/concurrent same-key tests |
| concurrency | two Enter + two Resolve tests |
| stale precheck | N decision, N+1 Case, rejected Enter |
| stale policy identity | changed rule/policy version, rejected Enter |
| atomicity | failure injection at Case/Risk/Event/Audit/idempotency points |
| AI cannot write | no public/model adapter + static route/export test |
| no Phase 5 | final diff/static scope review |

## 24. Implement Gate

Development may start only while all are true:

1. current main is reconciled against this audited planning baseline;
2. Frozen Spec blob is unchanged;
3. no material Docs drift invalidates Safety semantics;
4. Drizzle §7.0 narrow path remains implementable;
5. `drizzle-kit` + `db/schema` + Drizzle transaction are treated as required work, not optional cleanup;
6. `cases.status` remains the sole current Safety truth;
7. no current production resolver authority has appeared without an authoritative contract update;
8. Slice 8 current state is re-read;
9. migration number/shared CHECK definitions are re-read;
10. existing `authorize()`, RLS and idempotency store remain canonical;
11. SwitchPrimary precedence is unchanged;
12. no public Safety mutation route is added;
13. no Phase 5 object appears;
14. test-only resolver capability remains test-only;
15. failure injection, concurrency, RLS and unique-exit evidence are executable.

Any failed gate is a STOP/reconciliation event, not permission to reinterpret the frozen Spec.

---

# Appendix A — Pre-Development Audit 1

## A.1 Result

- CRITICAL: 0
- HIGH: 0
- MEDIUM: 0
- LOW: 0
- Drizzle Gate: PASS
- Frozen Spec fully traced: PASS
- Product ambiguity: NONE
- Phase 5 leakage: NONE
- Fake Safety authority/service: NONE

**AUDIT 1: PASS**

## A.2 Spec -> Plan -> Tasks -> Evidence traceability

| Spec Requirement | Plan Section | Task | Test / Mechanical Evidence |
|---|---|---|---|
| FR-001 single current Safety truth | §4.1 | T903, T918 | schema introspection; static no-safety_states/current-state search |
| FR-002 deterministic precheck | §6.1 | T904, T913 | deterministic unit matrix |
| FR-003 current-state aware | §6.1, §7 | T904, T908 | held->ALREADY_HELD; transaction-backed guard |
| FR-004 no invented rule catalog | §6.1, §20 | T904, T913 | fixture-only approved rule input; no production catalog/static dependency scan |
| FR-005 only EnterSafetyHold enters hold | §6.2, §24 | T907, T918 | unique-entry source scan + transition tests |
| FR-006 preserve phase/version + atomic enter | §6.2, §9 | T907, T915 | phase unchanged, +1 version, failure injection rollback |
| FR-007 CLOSED cannot enter | §6.2, §14 | T907, T914 | closed negative integration test |
| FR-008 ordinary progression guard | §7 | T908, T914 | shared guard unit/integration |
| FR-009 SwitchPrimary invariant/precedence | §7, §15 | T909, T914 | existing SwitchPrimary suite + exact precedence assertions |
| FR-010 no global Safety write blackout | §7, §20 | T908, T920 | evidence/consent/data-rights regression and call-site inventory |
| FR-011 ResolveRisk unique exit | §6.3, §24 | T910, T918 | controlled resolution + static unique-exit enforcement |
| FR-012 resolution evidence refs | §4.2, §6.3 | T905, T910 | strict ref validation + cross-Case rejection |
| FR-013 separate resolver authority | §8.3 | T906, T910 | authorization facts test; family role alone denied |
| FR-014 production fail-closed | §8.3 | T906, T914 | production composition returns unavailable/denied |
| FR-015 Resolve -> WAITING/no autoresume | §6.3 | T910, T914 | status WAITING, phase unchanged, no progression side effects |
| FR-016 Risk Event trace | §4.2 | T903, T905 | DB constraints + persistence assertions |
| FR-017 audit minimization | §13 | T905, T913 | exact metadata shape/content-negative tests |
| FR-018 RLS | §12 | T903, T912 | no/wrong/correct Family tests; NOBYPASSRLS |
| FR-019 existing idempotency | §10 | T911, T914 | same-store replay/mismatch/static no-second-store |
| FR-020 concurrency | §11 | T916 | two-Enter/two-Resolve races |
| FR-021 stale precheck | §6.2, §11 | T907, T916 | N->N+1 stale decision rejection; policy-version stale test |
| FR-022 AI no mutation | §6, §8, §20 | T906, T918 | no model principal/export/route; auth/static tests |
| FR-023 no public Safety mutation route | §6, §20 | T907, T910, T918 | route/OpenAPI surface negative test |
| FR-024 no Phase 5 | §20 | T918, T920 | forbidden-path/object diff scan |
| FR-025 Slice 8 compatibility | §15 | T917 | six-command integration contract / actual integration if landed |
| FR-026 Digital Use neutral | §20 | T920 | no scene/node/A* diff |
| FR-027 atomic transaction | §9, §18 | T902, T915 | Drizzle transaction ownership + staged fault injection |
| FR-028 real failure semantics | §14 | T913, T914, T915 | machine-error matrix + internal failure propagation |

## A.3 Audit checks

### Spec -> Plan

PASS. Every Frozen Safety control requirement is represented above; no professional Safety content was added.

### Plan -> Tasks

PASS. Every implementation obligation has a concrete task in `tasks.md`, including the Drizzle foundation, migration coordination, shared guard, SwitchPrimary regression, test-only resolver composition and unique-exit enforcement.

### Acceptance -> Test

PASS. Acceptance is mechanically testable through Unit / Integration / DB / static evidence; no “manual inspection only” critical requirement remains.

### Out of Scope

PASS. No Phase 5 support, Referral, staff service, AI risk-review, Scene or Problem Formulation implementation is planned.

### Drizzle

PASS, conditional only on executing T902 exactly. The plan does not treat the current raw-pg architecture as compliant and does not permit a raw-only fallback.

### Parallel Slice 8

PASS. Six ordinary commands, guard location, transaction timing, machine error, version semantics and migration rebase rules are explicit.

### No fake Safety service

PASS. Production resolver authority is absent/deny-all; controlled capability is test-only and creates no user-visible or operational service.

---

# Appendix B — Shared-file conflict map

Highest rebase risk with Slice 8:

- `db/migrations/*problem_formulation* / *safety_hold*` numbering and shared CHECK rewrites
- `packages/authorization/src/authorize.ts`
- `packages/domain/src/idempotency.ts`
- `packages/domain/src/index.ts`
- Case event vocabulary/check constraints
- Business audit event vocabulary/check constraints
- idempotency command/key-representation constraints
- `apps/server/api/src/plugins/error-handler.ts`
- `scripts/guard-static.mjs`
- `scripts/db-evidence.mjs`
- `tests/db/migration-repro.test.ts`
- `tests/db/roles.test.ts`

The second branch to integrate must rebase and reconcile these mechanically; it must not resolve conflicts by keeping one branch's whitelist and dropping the other's literals.
