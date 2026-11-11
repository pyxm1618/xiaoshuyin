# Slice 9 Engineering Tasks — 009-safety-hold-control-foundation

## Governance Task Index

These lines are a machine-readable governance index for the existing T901–T920 contracts below. They keep the same Task IDs, order and dependencies. The checkbox syntax is governance metadata only; it does not assert or alter implementation completion state.

- [ ] T901 Development-start environment isolation and input reconciliation [REQ:plan §24 Implement Gate] [VERIFY:clean independent worktree + baseline CI-equivalent verification + latest-main/migration/shared-vocabulary reconciliation]
- [ ] T902 Establish the narrow Drizzle §7.0 foundation without weakening identity/RLS defence [REQ:FR-027; plan §5 Drizzle Strategy] [VERIFY:Drizzle CLI/config/schema-loading smoke + migrated-DB schema parity + same-client identity/Family/RLS transaction tests]
- [ ] T903 Add the reviewed Safety migration and Risk Event schema [REQ:FR-001,FR-016,FR-018; plan §§4,12,16] [VERIFY:fresh/upgrade/failed migration + exact grant/RLS evidence + Drizzle schema parity]
- [ ] T904 Implement Safety domain types and deterministic precheck [REQ:FR-002,FR-003,FR-004,FR-021; plan §6.1] [VERIFY:deterministic unit matrix + malformed/unapproved input tests + no-network/model static dependency scan]
- [ ] T905 Implement Risk Event, Case Event and Business Audit persistence [REQ:FR-012,FR-016,FR-017; plan §13] [VERIFY:DB constraints/RLS + three-record persistence assertions + raw-content-negative checks]
- [ ] T906 Extend authorization vocabulary and implement resolver fact sources [REQ:FR-013,FR-014,FR-022; plan §8] [VERIFY:authorization fact/action tests + production composition deny-by-default + infrastructure-error propagation]
- [ ] T907 Implement EnterSafetyHold [REQ:FR-005,FR-006,FR-007,FR-021,FR-023; plan §6.2] [VERIFY:EnterSafetyHold integration/DB state-event-audit-idempotency assertions + closed/stale/negative paths]
- [ ] T908 Implement reusable AssertOrdinaryProgressionAllowed [REQ:FR-003,FR-008,FR-010; plan §7] [VERIFY:transaction-backed guard tests proving DB status controls outcome + non-global-write regression]
- [ ] T909 Integrate shared Safety semantics into SwitchPrimaryCase without regression [REQ:FR-009; plan §§7,15] [VERIFY:existing Slice 7 SwitchPrimary suite + held current/target precedence + auth/idempotency/concurrency regression]
- [ ] T910 Implement ResolveRisk with production fail-closed authority [REQ:FR-011,FR-012,FR-015,FR-023; plan §6.3] [VERIFY:production fail-closed + controlled resolver success + evidence validation + WAITING/phase/no-autoresume assertions]
- [ ] T911 Close idempotency integration and vocabulary [REQ:FR-019; plan §10] [VERIFY:same-store replay/mismatch/concurrent-key tests + one idempotency row per command key + no-second-store scan]
- [ ] T912 Prove RLS, grants and structural isolation with latest-main reconciliation [REQ:FR-018; plan §12] [VERIFY:real runtime role privilege matrix + risk_events ENABLE/FORCE RLS + cross-Family tests + cases-rls/roles regression]
- [ ] T913 Complete domain/unit error and privacy matrix [REQ:FR-002,FR-004,FR-017,FR-028; plan §§14,17] [VERIFY:table-driven unit error/status mapping + metadata non-leak assertions]
- [ ] T914 Complete Safety integration behavior and regressions [REQ:FR-007,FR-008,FR-009,FR-014,FR-015,FR-019,FR-028; plan §§15,17,23] [VERIFY:real service-composition Safety integration + DB trace assertions + OpenAPI/public-route negative]
- [ ] T915 Atomicity and failure-injection suite [REQ:FR-006,FR-027,FR-028; plan §§9,18] [VERIFY:staged fault injection with full rollback and no completed idempotency result]
- [ ] T916 Concurrency and stale-decision suite [REQ:FR-020,FR-021; plan §11] [VERIFY:real concurrent transaction races + stale N→N+1 precheck rejection]
- [ ] T917 Close the Slice 8 integration seam [REQ:FR-025; plan §15] [VERIFY:six-command held-block tests if runtime exists, otherwise static/contract six-command guard-seam evidence]
- [ ] T918 Mechanically enforce unique Safety entry/exit and scope negatives [REQ:FR-001,FR-005,FR-011,FR-022,FR-023,FR-024; plan §§20,24] [VERIFY:changed-path/schema/route/import/export scans + guard:static real-tree PASS and synthetic bypass FAIL]
- [ ] T919 Reconcile migration, RLS and existing shared-regression evidence after parallel development [REQ:FR-018,FR-019,FR-027; plan §§16,24] [VERIFY:latest-main re-fetch + migration-order/CHECK/grant reconciliation + fresh/upgrade/replay/failed-migration regressions]
- [ ] T920 Final combined regression, acceptance proof and scope closeout [REQ:FR-001 through FR-028; plan §§17,23,24] [VERIFY:focused Safety suites + shared DB/migration regressions + scope-negative scans + bun run guard:static + bun run test -- --run + bun run verify-all + changed-file review]

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

## T901 — Development-start environment isolation and input reconciliation

**Purpose**

Prove Slice 9 starts from a valid authoritative baseline in its own clean execution environment.

**Implementation requirements**

1. Fetch real origin/main and reconcile only Slice-9-relevant drift.
2. Verify the Frozen Spec commit/blob remains unchanged.
3. Re-read current Slice 8 branch, PR, development state and any local WIP before coding.
4. Re-list migrations and current shared CHECK definitions.
5. Re-verify authorize(), RLS, idempotency and SwitchPrimary lock/precedence.
6. Use a separate Slice 9 development branch/worktree based on reconciled latest main.
7. The Slice 9 worktree must be clean before the first production edit.
8. No Slice 8 uncommitted or untracked WIP may be present in the Slice 9 worktree.
9. Do not develop Slice 9 directly on feat/008-problem-formulation-core or any other Slice 8 worktree.
10. Do not auto-stash, delete, reset or clean Slice 8 WIP to satisfy this gate.
11. Run baseline CI-equivalent verification before the first production edit.

If requirements 6–10 are not satisfied: **T901 = STOP**.

**Parallel development rule**

Slice 8 + Slice 9 remains allowed only with different branch, different clean worktree, and different Development AI. Whichever branch merges second must rebase latest main, reconcile migrations/shared vocabulary/grants, and run combined regression.

**Acceptance evidence**

- exact main SHA;
- exact Frozen Spec blob;
- drift classification;
- Slice 8 state;
- branch/worktree identity and clean status;
- explicit proof no Slice 8 WIP is present;
- migration highest prefix;
- baseline verification result.

**Out of scope**

- changing the Frozen Spec;
- fixing unrelated baseline defects;
- altering or cleaning Slice 8 WIP.


## T902 — Establish the narrow Drizzle §7.0 foundation without weakening identity/RLS defence

**Purpose**

Create the narrow Slice-9 Drizzle schema/query/transaction path while preserving the current identity-context consistency defence.

**Verified baseline**

- apps/server/api/package.json declares drizzle-orm ^0.45.0.
- current bun.lock resolves drizzle-orm 0.45.4.
- drizzle-kit is not currently locked.
- current main apps/server/api/src/db/tx.ts contains assertIdentityContextMatches.
- official stable Drizzle releases currently expose drizzle-kit 0.31.11; this is a candidate, not a frozen planning pin.

**Implementation requirements**

1. Re-confirm the then-current drizzle-orm resolution, Bun toolchain and lockfile.
2. Select and lock an exact drizzle-kit version proven compatible with that toolchain; do not pin 0.31.x from memory.
3. Prove the exact selection with lockfile plus focused Drizzle CLI/config/schema-loading verification.
4. Create the minimum typed db/schema projection required by Slice 9.
5. Reviewed SQL migrations remain the only production schema-change mechanism.
6. Build a checked-out PoolClient Drizzle transaction seam in which all of the following are true inside one transaction:
   - Drizzle uses the exact checked-out PoolClient;
   - Drizzle owns BEGIN/COMMIT/ROLLBACK;
   - app.set_identity_context executes inside the transaction;
   - the existing assertIdentityContextMatches semantic is reused or preserved before Family context is trusted;
   - app.set_family_context executes inside the same transaction;
   - authorization fact reads, retained raw helpers, idempotency and Drizzle query-builder writes stay on that same client;
   - connection-error listener and broken-client eviction behavior are preserved;
   - no nested raw transaction and no second checked-out client are introduced.
7. Use query builder for ordinary Slice-9-owned writes.
8. Explicit SQL remains limited to justified RLS context, locking, complex idempotency and introspection cases.
9. Add migrated-DB schema parity tests.
10. Do not use drizzle-kit push and do not generate destructive unrelated DDL from a partial schema.

**STOP condition**

If narrow Drizzle compliance cannot preserve same-client identity/RLS/idempotency semantics without a second transaction, second schema truth, or broad repository rewrite: DRIZZLE GATE BLOCKED — SEPARATE DATA ACCESS REMEDIATION REQUIRED. Do not continue with raw-pg-only Safety code.

**Required verification**

- commit/rollback;
- wrong account/person/purpose context rejected before Family-context work;
- identity context + identity consistency assertion + Family context + RLS all on the same transaction;
- retained raw helper, if any, uses the exact same checked-out client;
- connection failure does not return a broken client;
- exact drizzle-kit version and compatibility smoke output;
- schema projection parity.


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

## T912 — Prove RLS, grants and structural isolation with latest-main reconciliation

**Purpose**

Make Family isolation and least privilege mechanical without regressing existing Case grants.

**Latest-main grant rule**

Before changing expectations, re-read current main. At the currently verified main, cases table-level UPDATE is denied; column UPDATE is allowed on is_primary, version and updated_at; status is denied. Slice 9 adds only the Safety-required narrow status capability. Therefore the current expected post-S9 writable set is is_primary, status, version, updated_at.

If Slice 8 or another authorized main change has legitimately added a Case column grant before development reaches this task, preserve that latest-main grant and test the union. Do not hard-code an old four-column set over a newer main.

**Required checks as the real runtime role**

- risk_events: ENABLE RLS + FORCE RLS;
- runtime risk_events privileges exactly SELECT + INSERT;
- risk_events UPDATE, DELETE and TRUNCATE denied;
- no Family context: Risk Event SELECT empty and INSERT denied;
- wrong Family: empty/denied;
- correct Family: only matching Family/Case rows permitted;
- cross-Family Case link and resolution self-link rejected structurally;
- app remains non-owner and NOBYPASSRLS;
- cases table-level UPDATE remains denied;
- approved column-level UPDATE succeeds and unapproved columns remain denied;
- case_events remains append-only.

**Existing regression reconciliation**

Reconcile, do not delete or weaken, tests/db/cases-rls.test.ts and tests/db/roles.test.ts.

**Acceptance evidence**

Exact latest-main-plus-S9 privilege/policy matrix and proof no legitimate existing grant was lost.


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

## T918 — Mechanically enforce unique Safety entry/exit and scope negatives

**Unique transition enforcement**

At minimum scan and reconcile:

1. generic Case status update helpers;
2. direct SQL UPDATE cases SET status patterns;
3. repository/data-access helpers;
4. SwitchPrimaryCase paths;
5. test-support helpers;
6. migration/test-only utilities;
7. other Domain Commands;
8. production imports, exports and re-exports.

Mechanical invariant: EnterSafetyHold is the only formal production Domain transition path into SAFETY_HOLD; ResolveRisk is the only formal production Domain transition path out of SAFETY_HOLD. Test setup/helpers may directly construct fixture state only when they are test-only and cannot be imported into production.

**Executable scope-negative assertions**

Use the appropriate combination of changed-path/git-diff scan, schema enumeration, route/OpenAPI enumeration, package/import/export scan and static guards to prove Slice 9 adds none of:

- support_resources;
- referrals or Referral runtime;
- staff queue;
- operations dashboard;
- Guardrails integration;
- risk_review model runtime;
- Digital Use Scene;
- node-manifest;
- excluded routing expansion;
- Goal, Intervention, Plan, Task, Review or Follow-up runtime;
- public Safety mutation route;
- safety_states current-state table.

Keep existing unrelated static prohibitions intact.

**Required tests/evidence**

- guard self-tests with synthetic forbidden bypass fixtures where supported;
- synthetic direct-SQL/generic-helper/test-helper production-import bypass detection;
- route/OpenAPI/schema/import inventory with zero forbidden additions;
- bun run guard:static passes the real tree and fails the synthetic bypass.


## T919 — Reconcile migration, RLS and existing shared-regression evidence after parallel development

**Purpose**

Close migration/CHECK/grant/vocabulary conflicts and prove existing Case/RLS/migration behavior was not broken.

**Implementation requirements**

1. Fetch latest main again.
2. Recompute the actual next migration number. Migration prefix is not frozen.
3. Ensure Slice 8 and Slice 9 cannot carry the same migration number into main.
4. If Slice 8 landed first, preserve every Slice 8 Case Event, audit, idempotency, authorization/error vocabulary item and legitimate Case grant.
5. If Slice 9 lands first, use the real next prefix and require Slice 8 to rebase/renumber later.
6. Before any complete CHECK replacement, re-read latest-main case_events, business_audit_events, idempotency command/key representation, authorization facts/actions, error vocabulary and cases grants.
7. Rebuild exact expected table/enum/policy/grant counts.
8. Do not modify historical migrations.
9. Run fresh, upgrade, replay and failed-migration evidence.
10. Keep Frozen Spec and Docs unchanged.

**Current verified existing regression baseline**

- tests/db/cases-rls.test.ts
- tests/db/roles.test.ts
- tests/db/migration-case-primary-switch-upgrade.test.ts
- tests/db/migration-upgrade-evidence.test.ts
- tests/db/migration-repro.test.ts
- tests/db/case-primary-switch-shared-vocabulary.test.ts
- relevant Case-primary/idempotency/RLS tests for every touched shared surface

Re-read latest main at T919 and add any newer relevant test. Running only new Safety tests is not sufficient.

**Acceptance evidence**

- final migration order;
- pg_catalog privilege/CHECK output;
- existing-regression matrix results;
- no latest-main vocabulary/grant literal lost.


## T920 — Final combined regression, acceptance proof and scope closeout

**Purpose**

Produce a development result suitable for independent post-development Audit 2.

**Required final matrix**

- focused Safety domain tests;
- focused Safety integration tests;
- focused Safety DB/RLS/concurrency/atomicity tests;
- all relevant existing RLS tests, including cases-rls and roles coverage;
- all relevant migration fresh/upgrade/repro tests;
- SwitchPrimary regression;
- shared-vocabulary regression;
- scope-negative static/schema/route/import assertions from T918;
- bun run typecheck;
- bun run guard:static;
- bun run coverage:audit;
- bun run test -- --run;
- bun run verify-all;
- OpenAPI generate/check when a registered contract artifact is touched;
- git diff --check;
- final changed-file/scope review.

If Slice 8 has merged before T920, S8 + S9 combined regression is mandatory and must prove every Slice 8 ordinary progression command is blocked by current SAFETY_HOLD through the shared transaction-backed guard.

**Mechanical closeout assertions**

- Frozen Spec unchanged;
- Docs unchanged;
- no historical migration changed;
- no Phase 5/support/referral/staff/operations object;
- no Guardrails/risk_review/Digital Use/node-manifest/excluded routing/Goal/Intervention/Plan/Task/Review/Follow-up expansion;
- no public Safety mutation endpoint;
- no safety_states;
- cases.status remains the only current Safety truth;
- production resolver remains fail-closed;
- controlled resolver remains test-only and absent from production import/export graph;
- EnterSafetyHold is the only formal production entry to hold;
- ResolveRisk is the only formal production exit from hold;
- Risk Event contains no raw user text;
- all FR-001..FR-028 evidence links are satisfied.

Stop at DEVELOPMENT COMPLETE — READY FOR INDEPENDENT AUDIT 2. Do not self-declare MERGE SAFE.


# Shared-file / parallel-development warning

Slice 8 + Slice 9 feature development may run in parallel only with different branch, different clean worktree and different Development AI. They may not share a dirty worktree.

High-conflict surfaces that the second branch must rebase and reconcile mechanically:

- migration numbering;
- case_events event/metadata CHECKs;
- business_audit_events event/resource CHECKs;
- idempotency command/key-representation CHECK/vocabulary;
- cases grants;
- authorization facts/actions;
- error vocabulary;
- packages/authorization/src/authorize.ts;
- packages/domain/src/idempotency.ts;
- packages/domain/src/index.ts;
- apps/server/api/src/db/tx.ts;
- scripts/guard-static.mjs;
- scripts/db-evidence.mjs;
- tests/db/cases-rls.test.ts;
- tests/db/roles.test.ts;
- tests/db/migration-case-primary-switch-upgrade.test.ts;
- tests/db/migration-upgrade-evidence.test.ts;
- tests/db/migration-repro.test.ts;
- tests/db/case-primary-switch-shared-vocabulary.test.ts.

**Parallel development decision: ALLOWED WITH ISOLATION.** Final migration/shared-vocabulary/grant integration is serialized; the later branch rebases latest main and runs combined regression.
