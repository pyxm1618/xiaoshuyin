# Slice 9 Engineering Tasks — 009-safety-hold-control-foundation

Status: **READY FOR DEVELOPMENT after Audit 1 PASS**

These tasks are ordered by dependency. A Development AI executes them; it may not reopen product scope.

Global rules for every task:

- no `Docs/**` edits;
- no frozen `spec.md` edits;
- no public Safety mutation endpoint;
- no Phase 5 support/referral/operations content;
- no AI/RAG/Guardrails;
- no second Safety current-state source;
- no second idempotency system;
- no raw-pg-only fallback if the Drizzle gate cannot be satisfied.

## T901 — Development-start input reconciliation

**Purpose**

Prove the development branch is starting from a still-valid authoritative baseline.

**Files likely touched**

- none for production behavior;
- development evidence/log only if the repo's normal process requires it.

**Dependencies**

- audited Plan AI 2 head.

**Implementation requirements**

1. fetch real `origin/main`;
2. verify frozen Spec commit/blob unchanged;
3. compare current main to audited main `8e393c990be53c888c2e68d881bd8b23f9c37638`;
4. re-read current Slice 8 branch/PR state;
5. re-list migrations and actual shared CHECK definitions;
6. verify `authorize()`, RLS, idempotency and SwitchPrimary lock/precedence still match the Plan;
7. run baseline canonical verification before first production edit.

If material drift affects Safety, Drizzle, auth/RLS, idempotency, Case state, migration or Slice-8 integration, STOP for planning reconciliation.

**Tests required**

- current canonical baseline commands / CI-equivalent local verification.

**Acceptance evidence**

- exact main SHA;
- exact frozen Spec blob;
- drift classification;
- Slice 8 state;
- migration highest prefix;
- baseline green or a diagnosed pre-existing blocker.

**Out of scope**

- fixing unrelated baseline defects;
- changing the frozen Spec.

---

## T902 — Establish the narrow Drizzle §7.0 foundation

**Purpose**

Turn the current “dependency/config only” state into a real Slice-9-compliant Drizzle schema/query/transaction path without rewriting the whole repository.

**Files likely touched**

- root/package manifest as required;
- `bun.lock`;
- `db/drizzle.config.ts` only if needed to make the already-declared schema path real;
- `db/schema/**`;
- `apps/server/api/src/db/tx.ts` and/or a narrow `apps/server/api/src/db/drizzle.ts`;
- focused DB/transaction tests.

**Dependencies**

- T901.

**Implementation requirements**

1. add the missing compatible `drizzle-kit` development dependency;
2. create the minimal typed Drizzle schema projection used by Slice 9;
3. preserve reviewed SQL migrations as the production schema-change mechanism;
4. create a checked-out-`PoolClient` Drizzle transaction seam:
   - preserve connection-error listener / broken-client eviction behavior;
   - Drizzle owns BEGIN/COMMIT/ROLLBACK;
   - RLS identity + Family context are established inside the same transaction;
   - no nested raw transaction;
5. prove ordinary Slice-9-owned inserts/updates can use query builder;
6. allow explicit `sql` only for RLS functions, locking, complex idempotency and introspection;
7. add schema-parity tests against a migrated DB;
8. do not run/use `drizzle-kit push`;
9. do not let a partial Drizzle schema generate destructive unrelated DDL.

**STOP condition**

If a same-transaction Drizzle path cannot coexist with current auth/RLS/idempotency helpers without creating a second transaction, second schema truth, or broad repository rewrite:

`DRIZZLE GATE: BLOCKED — SEPARATE DATA ACCESS REMEDIATION REQUIRED`

Do not continue T903+ with raw-pg-only Safety code.

**Tests required**

- Drizzle transaction commit/rollback;
- RLS context visible inside Drizzle transaction;
- raw shared fact helper, if retained, demonstrably uses the exact same checked-out connection/transaction;
- thrown business error rolls back;
- connection-level failure does not leak/return a known-broken client;
- schema projection parity.

**Acceptance evidence**

- `drizzle-kit` installed;
- `db/schema` exists;
- at least one real Drizzle query-builder mutation and one real Drizzle-owned transaction test;
- no second transaction;
- no production push command.

**Out of scope**

- migrating pre-existing unrelated repositories to Drizzle;
- changing business semantics of existing commands.

---

## T903 — Add the reviewed Safety migration and Risk Event schema

**Purpose**

Create the append-only Risk Event trace and the exact grants/vocabulary required by Safety control.

**Files likely touched**

- one new migration, provisionally `db/migrations/009_safety_hold_control_foundation.sql`;
- `db/schema/**`;
- DB structure/migration tests;
- role/grant evidence tests.

**Dependencies**

- T901;
- T902;
- final migration number reconciliation.

**Implementation requirements**

1. re-read live/current shared CHECK definitions before authoring;
2. create `risk_events` with the Plan §4.2 shape;
3. add composite Case/Family FK and same-Case resolution self-link;
4. add event-kind CHECKs and strict entry/resolution shape checks;
5. add a unique partial fence preventing duplicate resolution of one hold trace;
6. add indexes for Case/Family timelines;
7. ENABLE + FORCE RLS;
8. create Family-scope policy;
9. grant runtime SELECT+INSERT only;
10. add narrow cases column UPDATE privilege for `status, version, updated_at`;
11. extend Case Event vocabulary and exact metadata shape;
12. extend Business Audit event vocabulary without widening resource payload;
13. extend idempotency command/key-representation vocabulary for Enter/Resolve;
14. preserve all values introduced by any already-merged Slice 8 migration;
15. update the matching Drizzle schema projection to exact parity;
16. no `safety_states`, current-status column, support resource or review table.

**Tests required**

- fresh DB migrations;
- upgrade from all prior migration files;
- second apply no-op;
- failed Safety migration rolls back completely;
- exact table/column/constraint/index/policy/grant introspection;
- app role cannot UPDATE/DELETE Risk Events;
- app role table-level UPDATE on cases remains false;
- Risk Event entry/resolution CHECKs reject malformed rows.

**Acceptance evidence**

- migration filename/order;
- migration history before/after;
- exact risk_events DDL introspection;
- exact grant/RLS evidence;
- Drizzle-schema parity.

**Out of scope**

- modifying historical migrations;
- data backfill;
- adding a current-state Safety table.

---

## T904 — Implement Safety domain types and deterministic precheck

**Purpose**

Create the pure Safety precheck contract without inventing a professional risk catalog.

**Files likely touched**

- a new Safety domain module under `packages/domain/src/**`;
- `packages/domain/src/index.ts` only for approved production-safe exports;
- focused domain tests.

**Dependencies**

- T901.

**Implementation requirements**

1. define strict typed runtime-validated structures for:
   - Case Safety snapshot;
   - approved deterministic rule evaluation input;
   - policy/rule/category identities;
   - evidence refs;
   - precheck decision union;
2. implement `RunSafetyPrecheck` as pure deterministic code;
3. if current state is SAFETY_HOLD, return ALREADY_HELD;
4. bind every decision to Case ID + Case version;
5. ENTER_HOLD must carry approved policy/rule/version/category references;
6. reject malformed/unapproved decision inputs;
7. do not accept a raw boolean as mutation authority;
8. no network, clock dependence, LLM, RAG, Guardrails or external service;
9. no built-in “professional” keyword/rule catalog;
10. tests use explicit approved deterministic fixtures.

**Tests required**

- same input -> byte/logically equivalent decision;
- held -> ALREADY_HELD;
- valid fixture -> ENTER_HOLD;
- no matching approved input -> ALLOW/no-enter semantics;
- malformed/missing policy/rule identity -> invalid;
- no external-call dependency.

**Acceptance evidence**

- pure test matrix;
- dependency/static scan showing no network/model integration.

**Out of scope**

- professional Safety content/rules;
- external policy service.

---

## T905 — Implement Risk Event, Case Event and Business Audit persistence

**Purpose**

Provide three distinct persistence responsibilities without payload duplication.

**Files likely touched**

- Safety persistence/repository module;
- Drizzle schema imports;
- event/audit metadata builders;
- unit and DB tests.

**Dependencies**

- T902;
- T903;
- T904.

**Implementation requirements**

1. use Drizzle query builder for Risk Event insert;
2. use Drizzle query builder for Safety Case Event insert;
3. use Drizzle query builder for Safety Business Audit insert;
4. implement exact metadata shapes from Plan §13;
5. Risk Event stores reference IDs/codes only, never raw user text;
6. Case Event stores state/version/riskEventId only;
7. Audit stores actor/action/version/riskEventId and resolver authority ref only when applicable;
8. no UPDATE/DELETE Risk Event method;
9. return inserted Risk Event ID for same-transaction Case Event/Audit linkage.

**Tests required**

- exact metadata equality;
- forbidden payload keys absent;
- DB CHECK rejects extra/malformed event metadata where applicable;
- Risk Event insert respects RLS and same-Case FK.

**Acceptance evidence**

- persistence tests showing three records with distinct minimal responsibilities.

**Out of scope**

- support resources;
- review narrative storage;
- mutable current Safety state.

---

## T906 — Extend authorization vocabulary and implement resolver fact sources

**Purpose**

Keep one authorization entry while guaranteeing production ResolveRisk remains fail-closed.

**Files likely touched**

- `packages/authorization/src/authorize.ts`;
- API/domain authorization adapter as needed;
- production composition;
- `tests/support/**` for controlled resolver fact source;
- authorization tests.

**Dependencies**

- T901;
- T904.

**Implementation requirements**

1. add explicit Case actions for EnterSafetyHold and ResolveRisk using the existing registry;
2. do not add a parallel Safety RBAC engine;
3. model resolver capability as a verified authorization fact;
4. production resolver fact source must return “no capability/unavailable”;
5. no family manager/guardian/member role may infer resolver capability;
6. controlled test fact source lives only in test composition and is not exported by production app;
7. AI/system/model actor gets no direct mutation path;
8. preserve current authorization error propagation: only known denials map to business denial; infrastructure failures propagate.

**Tests required**

- ordinary family manager cannot ResolveRisk in production;
- guardian cannot ResolveRisk by role;
- no capability -> unavailable/denied;
- controlled test capability -> authorization fact can allow test transition;
- unknown DB error is not collapsed to authorization denial;
- no cross-Family target leakage.

**Acceptance evidence**

- action registry/facts tests;
- production app composition test proves deny-by-default.

**Out of scope**

- real staff/resolver role;
- staff account;
- operations workflow.

---

## T907 — Implement EnterSafetyHold

**Purpose**

Make the protected, atomic entry transition real.

**Files likely touched**

- Safety application/service module;
- Safety persistence module;
- idempotency vocabulary/helper call sites;
- internal service composition;
- integration tests.

**Dependencies**

- T902–T906.

**Implementation requirements**

Execute in the exact Plan §9 order:

1. authenticated originating actor;
2. resolve Family;
3. one Drizzle-owned RLS transaction;
4. same-transaction authorization;
5. existing idempotency slot/replay;
6. Family row lock;
7. Case row lock/re-read;
8. validate visible same-Family Case;
9. CLOSED -> CASE_CLOSED;
10. already held -> SAFETY_HOLD_ALREADY_ACTIVE;
11. expected Case revision and precheck revision must match;
12. revalidate approved policy/rule identity against the current trusted deterministic seam;
13. update Case only if current preconditions still hold:
    - status -> SAFETY_HOLD;
    - phase unchanged;
    - version +1;
14. insert Risk Event;
15. insert Case Event;
16. insert Audit Event;
17. complete idempotency result;
18. commit.

No public route is registered.

**Tests required**

- enter from OPEN;
- enter from WAITING;
- enter from LOST_CONTACT;
- CLOSED rejected;
- already held does not create new trace/version;
- phase unchanged;
- version exactly +1;
- stale Case version rejected;
- stale precheck rejected;
- stale policy/rule identity rejected;
- replay exact result;
- mismatch 409;
- cross-Family/non-visible non-leaking.

**Acceptance evidence**

- full row/event/audit/idempotency assertions from one successful command and every negative path.

**Out of scope**

- deciding professional risk from user text;
- showing support content.

---

## T908 — Implement reusable AssertOrdinaryProgressionAllowed

**Purpose**

Provide the canonical transaction-backed Safety guard for all ordinary Case progression.

**Files likely touched**

- Safety domain/repository module;
- domain exports;
- guard tests.

**Dependencies**

- T904;
- T903 schema availability for Case projection.

**Implementation requirements**

1. accept caller-owned transaction + Case ID, not a caller status;
2. re-read real Case state inside that transaction;
3. hidden Case remains non-leaking;
4. SAFETY_HOLD -> `SAFETY_HOLD_BLOCKED`;
5. non-held -> allow from the Safety perspective;
6. no mutation/version bump;
7. no global registration on Evidence/Consent/Auth/Data Rights code paths.

**Tests required**

- held block;
- OPEN/WAITING/LOST_CONTACT allow from Safety perspective;
- caller stale fake status cannot bypass;
- cross-Family row not exposed;
- no writes.

**Acceptance evidence**

- transaction-backed test proves DB state, not parameter state, determines outcome.

**Out of scope**

- primary/phase/closed policy other than any command-specific ordering required by its own contract.

---

## T909 — Integrate shared Safety semantics into SwitchPrimaryCase without regression

**Purpose**

Replace duplicated Safety semantics while preserving Slice 7's exact behavior and precedence.

**Files likely touched**

- `packages/domain/src/case-primary-switch.ts` and/or SwitchPrimary orchestration;
- SwitchPrimary integration/domain tests.

**Dependencies**

- T908.

**Implementation requirements**

Preserve the exact denial order:

1. target CLOSED -> CASE_CLOSED;
2. target held -> SAFETY_HOLD_BLOCKED;
3. current held -> SAFETY_HOLD_BLOCKED;
4. current == target -> CASE_ALREADY_PRIMARY;
5. stale primary view -> STALE_PRIMARY_VIEW;
6. allow.

The shared Safety policy may be reused internally, but integration must not add a re-lock sequence that violates the existing single sorted Case-lock order.

Held current cannot be switched away. Held target cannot be promoted.

No-write behavior on every denial remains unchanged.

**Tests required**

- all existing Slice 7 tests;
- explicit target CLOSED+held-relevant precedence regression;
- current-held regression;
- target-held regression;
- authorization/idempotency/concurrency regression;
- no extra Case/Event/Audit writes on blocked attempts.

**Acceptance evidence**

- original suite green plus new shared-policy assertions.

**Out of scope**

- redesigning primary selection.

---

## T910 — Implement ResolveRisk with production fail-closed authority

**Purpose**

Implement the unique exit contract while keeping production resolution impossible until real authority exists.

**Files likely touched**

- Safety service/domain/persistence modules;
- authorization adapter;
- controlled test-support composition;
- integration tests.

**Dependencies**

- T902–T906;
- T907;
- T908.

**Implementation requirements**

1. no public route;
2. one Drizzle-owned RLS transaction;
3. authorize target access and resolve verified resolver capability fact;
4. production composition with no capability must fail before any mutation/evidence disclosure;
5. acquire/replay idempotency;
6. Family lock -> Case lock;
7. status must be SAFETY_HOLD;
8. expected Case revision must match;
9. resolve exactly one applicable unresolved HOLD_ENTERED trace for linkage; this trace is not status authority;
10. validate required typed review evidence refs under their existing carrier contracts;
11. controlled test authority may proceed;
12. update Case to WAITING, phase unchanged, version +1;
13. append RISK_RESOLVED Risk Event linked to hold entry;
14. append Case Event/Audit;
15. complete idempotency;
16. commit;
17. do not resume previous phase/task/reminder.

**Tests required**

- production authority unavailable/denied, zero writes;
- manager/guardian role alone denied;
- controlled test capability + valid evidence resolves;
- invalid/missing/cross-Case evidence rejected;
- stale revision rejected;
- no longer held -> SAFETY_HOLD_REQUIRED;
- phase unchanged;
- target WAITING;
- one version increment;
- replay/mismatch.

**Acceptance evidence**

- production and controlled-test compositions tested separately;
- no production route/export exposes controlled capability.

**Out of scope**

- human review service;
- support queue;
- staff model;
- risk_review AI.

---

## T911 — Close idempotency integration and vocabulary

**Purpose**

Prove Enter/Resolve use the existing exact idempotency system with no semantic fork.

**Files likely touched**

- `packages/domain/src/idempotency.ts`;
- shared idempotency repository/helper only as narrowly required;
- migration shared CHECK;
- idempotency tests.

**Dependencies**

- T903;
- T907;
- T910.

**Implementation requirements**

1. register exactly the two Safety command types;
2. use the existing canonical hash and exact key identity convention;
3. keep the same store/indexes;
4. reuse existing slot mechanics; if an adapter is required for Drizzle-owned transaction, it must operate on the same checked-out transaction, not open another;
5. persist deterministic authorized outcomes consistently;
6. infrastructure error rolls back slot;
7. no second mismatch predicate.

**Tests required**

- same key same payload;
- same key different payload;
- concurrent same key;
- rollback after late failure leaves no completed slot;
- corrupted/incomplete stored response fails safely.

**Acceptance evidence**

- one idempotency row per command key;
- same business result on replay;
- no duplicate business rows.

**Out of scope**

- new cache/table.

---

## T912 — Prove RLS, grants and structural isolation

**Purpose**

Make Family isolation and least privilege mechanical.

**Files likely touched**

- `tests/db/safety-*.test.ts`;
- `tests/db/roles.test.ts`;
- DB evidence script if it enumerates table/policy counts.

**Dependencies**

- T903.

**Implementation requirements**

Test as the real app role:

- no Family context: Risk Event SELECT zero / INSERT denied;
- wrong Family: zero / denied;
- correct Family: allowed only for matching family/case;
- composite FK rejects cross-Family Case link;
- resolution self-link cannot cross Case/Family;
- UPDATE/DELETE/TRUNCATE Risk Event denied;
- Case table-level UPDATE remains false;
- only status/version/updated_at Safety columns are newly writable;
- app remains non-owner/NOBYPASSRLS;
- case_events remains append-only.

**Tests required**

- direct pg_catalog/information_schema assertions plus runtime-role DML attempts.

**Acceptance evidence**

- exact privilege/policy matrix.

**Out of scope**

- authorization business rules in RLS.

---

## T913 — Complete domain/unit error and privacy matrix

**Purpose**

Make all pure semantics stable and testable.

**Files likely touched**

- `tests/domain/safety-*.test.ts`;
- error mapping tests;
- metadata builder tests.

**Dependencies**

- T904–T910.

**Implementation requirements**

Cover every planned stable machine semantic:

- UNAUTHENTICATED;
- authorization/invisible convergence;
- CASE_CLOSED;
- SAFETY_HOLD_ALREADY_ACTIVE;
- SAFETY_HOLD_BLOCKED;
- STALE_CASE_VERSION;
- SAFETY_PRECHECK_STALE;
- SAFETY_PRECHECK_INVALID;
- SAFETY_REVIEW_EVIDENCE_INVALID;
- SAFETY_RESOLUTION_AUTHORITY_DENIED;
- SAFETY_RESOLUTION_AUTHORITY_UNAVAILABLE;
- SAFETY_HOLD_REQUIRED;
- IDEMPOTENCY_PAYLOAD_MISMATCH;
- INTERNAL_ERROR.

Verify event/audit payloads reject/omit raw user content.

**Tests required**

- table-driven unit tests.

**Acceptance evidence**

- exact code/status mapping and non-leak assertions.

**Out of scope**

- new user-facing copy/support content.

---

## T914 — Complete Safety integration behavior and regressions

**Purpose**

Test real service composition across auth/RLS/idempotency/Case/Event/Audit.

**Files likely touched**

- `tests/integration/safety-*.test.ts`;
- existing SwitchPrimary regression files only if needed for added assertions;
- OpenAPI/scope tests for negative public surface.

**Dependencies**

- T907–T913.

**Implementation requirements**

Scenarios:

- successful Enter;
- repeated/different-key already-held;
- ordinary progression held block;
- SwitchPrimary current-held;
- SwitchPrimary target-held;
- Resolve production fail closed;
- Resolve controlled test success;
- idempotency replay/mismatch;
- stale version/precheck;
- cross-Family anti-enumeration;
- no public `/safety`, `/resolve-risk`, `/enter-hold` route;
- no AI/system principal path.

**Tests required**

- real Fastify/service composition where applicable; internal commands tested through the actual application-service seam, not SQL shortcuts.

**Acceptance evidence**

- command outcomes + DB state/trace assertions.

**Out of scope**

- adding endpoints just to make tests convenient.

---

## T915 — Atomicity and failure-injection suite

**Purpose**

Prove the exact transaction cannot partially commit.

**Files likely touched**

- dedicated DB/integration atomicity tests;
- test-only injectable persistence fault seam, if needed.

**Dependencies**

- T907;
- T910;
- T911.

**Implementation requirements**

Inject failures at:

1. after Case update / before Risk Event;
2. after Risk Event / before Case Event;
3. after Case Event / before Business Audit;
4. after Business Audit / before idempotency completion.

After each failure assert:

- Case status/version unchanged from pre-command;
- no new Risk Event;
- no new Case Event;
- no new Audit Event;
- no completed idempotency row/result.

Fault injection must be dependency/test composition, not a production request flag.

**Tests required**

- Enter and, where meaningful, Resolve failure stages.

**Acceptance evidence**

- before/after exact row counts and Case snapshot.

**Out of scope**

- swallowing failures or retrying inside the transaction.

---

## T916 — Concurrency and stale-decision suite

**Purpose**

Prove serialized aggregate semantics under real concurrent database transactions.

**Files likely touched**

- `tests/db/safety-concurrency.test.ts` or equivalent;
- stale-precheck integration/DB tests.

**Dependencies**

- T907;
- T910;
- T911.

**Implementation requirements**

Test:

- two concurrent Enter, different keys;
- concurrent same-key Enter;
- two concurrent Resolve, different keys under controlled authority;
- concurrent same-key Resolve;
- Enter vs SwitchPrimary;
- Enter vs one representative ordinary-progression test seam;
- precheck at Case version N, separate legal Case mutation -> N+1, then Enter with N decision -> reject;
- same Case version but approved policy/rule version changed -> reject/revalidate, never blindly apply.

Required invariants:

- at most one transition;
- at most one version advance for that transition;
- no duplicate Risk Event;
- no duplicate resolution of a hold event;
- no 500 from expected contention.

**Tests required**

- real concurrent connections/transactions, not sequential mocks.

**Acceptance evidence**

- final Case snapshot + exact event counts.

**Out of scope**

- broad load testing.

---

## T917 — Close the Slice 8 integration seam

**Purpose**

Ensure future/current Problem Formulation ordinary progression cannot bypass SAFETY_HOLD.

**Files likely touched**

If Slice 8 is still unmerged:
- Safety public domain export only;
- contract/static tests proving the guard seam is consumable;
- no Slice 8 runtime files.

If Slice 8 has merged:
- its six command/service call sites;
- their focused regression tests.

**Dependencies**

- T901 current Slice 8 reconciliation;
- T908.

**Implementation requirements**

For each of:

- StartAssessment;
- PresentProblemFormulation;
- ConfirmProblemFormulation;
- DisputeProblemFormulation;
- CorrectProblemFormulation;
- ReassessFromFormulation;

the guard point is:

`authorized/replay decision -> Family lock -> Case lock/re-read -> Safety guard -> command-specific progression writes`.

Do not change Slice 8 product semantics, endpoint set or formulation state machine.

**Tests required**

If runtime exists: each command held -> SAFETY_HOLD_BLOCKED and zero business mutation.

If runtime does not exist: static/contract evidence records the six-command list and guard API; do not invent placeholder commands.

**Acceptance evidence**

- either six real blocked-command tests or explicit “runtime not yet present” seam evidence with no duplicated implementation.

**Out of scope**

- implementing Problem Formulation.

---

## T918 — Enforce unique Safety entry/exit and scope statically

**Purpose**

Make bypass creation mechanically visible in CI.

**Files likely touched**

- `scripts/guard-static.mjs`;
- dedicated static tests/governance tests.

**Dependencies**

- T907;
- T908;
- T910.

**Implementation requirements**

Add narrow checks that prove:

1. no `safety_states` table/projection;
2. no production public Safety mutation route;
3. no model/AI module directly writes Case Safety status;
4. the SAFETY_HOLD entry transition primitive is reachable only from EnterSafetyHold service;
5. the SAFETY_HOLD -> non-held transition primitive is reachable only from ResolveRisk service;
6. no generic Case update helper can set arbitrary status;
7. test-only resolver implementation is absent from production imports/exports;
8. existing unrelated future-table guards remain intact.

Do not create brittle rules that forbid future legitimate non-Safety lifecycle work globally; scope checks to approved status-transition primitives/module boundaries.

**Tests required**

- guard self-tests with deliberately forbidden fixtures where the governance framework supports them.

**Acceptance evidence**

- `bun run guard:static` detects a synthetic bypass and passes the real tree.

**Out of scope**

- enforcing business authorization solely with regex.

---

## T919 — Reconcile migration/governance evidence after parallel development

**Purpose**

Close shared migration/check/CI conflicts with Slice 8 and update exact database evidence.

**Files likely touched**

- final Safety migration filename/content;
- `tests/db/migration-repro.test.ts`;
- `tests/db/roles.test.ts`;
- `scripts/db-evidence.mjs`;
- shared governance/static tests only as needed.

**Dependencies**

- T903;
- current integration order with Slice 8.

**Implementation requirements**

1. fetch latest main again;
2. determine actual migration number;
3. if Slice 8 has landed, preserve all Slice 8 Case Event/Audit/Idempotency literals and grants;
4. if Slice 9 is first, ensure its migration is the actual next migration and document that Slice 8 must rebase;
5. rebuild exact expected table/enum/policy/grant counts;
6. ensure no historical migration changed;
7. run fresh/upgrade/replay/failed-migration evidence;
8. preserve Spec Governance and Docs immutability.

**Tests required**

- migration reproduction;
- roles/grants;
- db evidence;
- static governance.

**Acceptance evidence**

- final migration order and pg_catalog output.

**Out of scope**

- silently keeping a stale whitelist after conflict resolution.

---

## T920 — Final regression, acceptance proof and scope closeout

**Purpose**

Produce a development result suitable for independent post-development Audit 2.

**Files likely touched**

- no new behavior should be added at this stage;
- generated artifacts only if an approved generator legitimately changes them.

**Dependencies**

- T901–T919.

**Implementation requirements**

Run at minimum:

- focused Safety domain tests;
- focused Safety integration tests;
- focused Safety DB/RLS/concurrency/atomicity tests;
- SwitchPrimary full regression;
- migration/roles evidence;
- `bun run typecheck`;
- `bun run guard:static`;
- `bun run coverage:audit`;
- `bun run test -- --run`;
- `bun run verify-all`;
- OpenAPI generate/check if any registered-contract artifact is touched (expected public Safety route delta = none);
- `git diff --check`;
- final changed-file/scope review.

Mechanically prove:

- frozen Spec unchanged;
- Docs unchanged;
- no historical migration changed;
- no Phase 5 object;
- no public Safety mutation endpoint;
- no `safety_states`;
- only `cases.status` is current Safety truth;
- production resolver remains fail-closed;
- controlled resolver remains test-only;
- Risk Event contains no raw user text;
- all FR-001..FR-028 evidence links are satisfied.

Stop at:

`DEVELOPMENT COMPLETE — READY FOR INDEPENDENT AUDIT 2`

Do not self-declare MERGE SAFE.

**Tests required**

- complete repository verification plus final exact-head provenance.

**Acceptance evidence**

- exact final head SHA;
- full command results;
- FR traceability evidence;
- clean scope diff.

**Out of scope**

- merge main;
- independent Audit 2.

---

# Shared-file / parallel-development warning

The following are high-conflict surfaces with Slice 8 and must be reconciled after rebase, never resolved by blindly choosing one side:

- migration numbering;
- Case Event CHECK + metadata CHECK;
- Business Audit event CHECK;
- idempotency command/key representation CHECK;
- `packages/authorization/src/authorize.ts`;
- `packages/domain/src/idempotency.ts`;
- `packages/domain/src/index.ts`;
- error vocabulary;
- `scripts/guard-static.mjs`;
- `scripts/db-evidence.mjs`;
- `tests/db/migration-repro.test.ts`;
- `tests/db/roles.test.ts`.

**Parallel development decision: PARTIALLY.** Feature implementation may run in parallel. Final migration/shared-vocabulary integration is serialized and the second branch must rebase.
