# Slice 10 Engineering Tasks — 010-compliance-feature-policy-foundation

Status: **PLANNING COMPLETE / TARGETED AUDIT 1 PASS / FINAL RE-AUDIT PASS / PLAN RE-FROZEN / IMPLEMENT GATE OPEN**

These are future Development AI tasks. They do not authorize implementation now.

Global rules for every task:

- do not edit `Docs/**`;
- do not edit the Frozen Slice 10 `spec.md`;
- do not create a public feature-policy browse/admin/mutation API;
- do not build AI/RAG/model runtime;
- do not build Digital Use/A4003 runtime;
- do not build usage sessions/timers/reminder dispatch;
- do not build generated-content/export runtime;
- do not build PIPIA/regulatory workflows;
- do not create a second Compliance Profile, guardian, consent, Safety, authorization, transaction or idempotency truth;
- do not use raw-pg-only fallback after the Drizzle gate;
- reviewed SQL migration remains production schema-change truth;
- stop on any real Spec gap instead of inventing product semantics.

## Task Index

- [ ] T1001 [REQ:FR-028,FR-030,V1-C20,V1-C21,§7.0,§38] Reconcile development-start authority, current main, Slice 8/9 state, Slice 9-or-remediation Drizzle foundation, migration/RLS/compliance baseline before any production edit [VERIFY:git fetch && git status --short && git rev-parse origin/main; compare Frozen Spec blob; inspect current db/schema, lockfile, migrations, authorize/RLS/compliance facts and exact main CI]
- [ ] T1002 [REQ:FR-028,FR-029,V1-C20,V1-C21,§7.0,§9.1] Consume the verified authoritative Drizzle same-client transaction/schema foundation (Slice 9 or approved Data Access Remediation) without creating a second data-access path [VERIFY:bun run typecheck; focused Drizzle same-client identity/RLS transaction tests; schema loading/parity evidence]
- [ ] T1003 [REQ:FR-001,FR-004,FR-005,FR-006,FR-007,FR-008,FR-009,FR-010,FR-029,V1-C43,§7.7A] Add reviewed compliance feature-policy persistence, version/effective-period invariants, least-privilege grants and exact Drizzle projection [VERIFY:bun run test -- --run tests/db/*compliance*; bun run db:evidence -- --no-archive; migration fresh/upgrade/replay/rollback introspection]
- [ ] T1004 [REQ:FR-002,FR-003,FR-023,V1-C30] Implement server-owned feature identity/contract-revision types and registry/mapping boundary with no Scene-specific product branch [VERIFY:bun run test -- --run tests/domain/*feature*identity*; bun run guard:static; code search proves no client-authoritative feature string or A4003/Digital Use branch in Common Core evaluator]
- [ ] T1005 [REQ:FR-005,FR-006,FR-007,FR-008,FR-009,FR-010,FR-016,FR-017,FR-018,FR-019,FR-020,FR-021,FR-030,V1-C38,V1-C43] Implement pure deterministic policy selection/evaluation and obligation/provenance result semantics [VERIFY:bun run test -- --run tests/domain/*feature*policy*; fixed-time deterministic tests; no network/model imports]
- [ ] T1006 [REQ:FR-011,FR-012,FR-013,FR-014,FR-015,V1-C39,§7.7A,§27B] Compose the evaluator with existing Compliance Profile, age/minor, guardian relationship and current guardian-consent gate without duplicating truth [VERIFY:bun run test -- --run tests/domain/*compliance* tests/integration/*compliance*; age/guardian/consent matrix passes]
- [ ] T1007 [REQ:FR-022,FR-027,FR-029,V1-C20,V1-C21,V1-C25,V1-C26,§9,§9.1] Integrate authorization/RLS/anti-enumeration and independent Safety/Compliance gate precedence without new RBAC or Safety behavior [VERIFY:bun run test -- --run tests/integration/*compliance* tests/integration/*scope*; unauthorized/cross-family/fault-injection tests; bun run guard:static]
- [ ] T1008 [REQ:FR-004,FR-007,FR-008,FR-009,FR-010,FR-021,§13A,§27B] Implement controlled reviewed policy publication/supersession representation with no runtime/public admin command and no fake review workflow [VERIFY:migration/provisioning tests prove version history, effective interval closure, overlap rejection, provenance and runtime mutation denial]
- [ ] T1009 [REQ:FR-008,FR-009,FR-010,FR-020,FR-021,FR-030,V1-C27,V1-C28] Close concurrency, snapshot, stale-revision and infrastructure-failure semantics for evaluation/publication [VERIFY:concurrent publication test; overlapping-corruption fail-closed test; policy supersession snapshot test; database failure propagation test]
- [ ] T1010 [REQ:FR-016,FR-017,FR-018,FR-019,FR-022,FR-023,FR-024,FR-025,FR-026,FR-027,V1-C38,V1-C43] Add only the internal compliance service composition/consumer contract required by the foundation and prove no public OpenAPI surface or downstream runtime was added [VERIFY:bun run openapi:check; generated operation set unchanged; diff/static scan contains no timer/notification/export/PIPIA/regulatory/A4003 runtime]
- [ ] T1011 [REQ:FR-001,FR-002,FR-003,FR-004,FR-005,FR-006,FR-007,FR-008,FR-009,FR-010,FR-011,FR-012,FR-013,FR-014,FR-015,FR-016,FR-017,FR-018,FR-019,FR-020,FR-021,FR-022,FR-023,FR-024,FR-025,FR-026,FR-027,FR-028,FR-029,FR-030] Complete the full Slice 10 domain/integration/database acceptance matrix and map all 16 Frozen acceptance scenarios to automated evidence [VERIFY:bun run test -- --run; acceptance mapping report shows scenarios 1..16 PASS]
- [ ] T1012 [REQ:FR-023,FR-024,FR-025,FR-026,FR-027,FR-028,FR-029,FR-030,V1-C30,§38] Add/narrow architecture guards and run regression against every prior slice/remediation actually merged into the then-current main baseline [VERIFY:bun run guard:static; bun run typecheck; bun run openapi:check; bun run db:evidence -- --no-archive; bun run test -- --run]
- [ ] T1013 [REQ:FR-001,FR-002,FR-003,FR-004,FR-005,FR-006,FR-007,FR-008,FR-009,FR-010,FR-011,FR-012,FR-013,FR-014,FR-015,FR-016,FR-017,FR-018,FR-019,FR-020,FR-021,FR-022,FR-023,FR-024,FR-025,FR-026,FR-027,FR-028,FR-029,FR-030,Constitution] Perform final exact-head convergence/governance verification and stop for independent post-development audit without merging [VERIFY:node .specify/scripts/validate-governance.mjs; node .specify/scripts/tests/run-governance-tests.mjs; git diff origin/main...HEAD; exact-head CI/check evidence]

---

## T1001 — Development-start Authority / Input / Dependency Gate

**Purpose**

Prove that implementation starts from current authority and that the Slice 9 Drizzle dependency is real, merged and usable before any Slice 10 production edit.

**Dependencies**

- Frozen Slice 10 Spec;
- Plan / Checklist / Tasks frozen;
- none of the later implementation tasks may start before this task passes.

**Expected files / areas**

Read-only inspection only:

- `Docs/**`;
- `specs/008-*/**`;
- `specs/009-*/**`;
- `specs/010-*/**`;
- `db/migrations/**`;
- `db/schema/**`;
- `bun.lock`, package manifests;
- transaction/data-access code;
- `packages/compliance/**`;
- `packages/authorization/**`;
- RLS/grant migrations/tests;
- CI status.

**Implementation requirements**

1. Fetch current `origin/main`.
2. Verify branch/worktree is a clean Slice 10 development environment if local git is available.
3. Recompute input drift from the Frozen Spec base to latest main.
4. Re-read any relevant drift without altering Frozen product semantics.
5. Verify the authoritative Frozen Spec v2 commit/blob are still `bc12a0d64a9bd2cf09bbc0dfe0d3ffa305da97e1` / `ba38ccdafe85bbb044d994292a6a7237337eb474`.
6. Verify whether Slice 8 is merged; if merged, inspect its actual migration/shared vocabulary/runtime interfaces.
7. Verify whether Slice 9 is merged.
8. Independently verify whether a separately approved Data Access Remediation has merged and, if so, whether it supplies the same §7.0 same-client/identity/RLS/migration invariants.
9. Do not accept Slice 9 or remediation planning documents as implementation evidence.
10. Inspect actual `db/schema`.
11. Inspect actual locked `drizzle-orm` / `drizzle-kit` versions.
12. Inspect actual shared Drizzle transaction seam and prove same-client identity/RLS semantics.
13. Re-list all migration prefixes and choose no Slice 10 number yet if dependency is blocked.
14. Re-read current:
    - `authorize()`;
    - Person/Family/RLS context;
    - Compliance Profile;
    - guardian consent;
    - age enum/minor mode;
    - current DB grants;
    - static scope guards;
    - current CI baseline.
15. Check whether a new feature-policy consumer has appeared on main and classify compatibility.

**Hard STOP conditions**

If neither the Slice 9 Drizzle foundation nor a separately approved Data Access Remediation is merged and proven on current main:

`T1001 = STOP — IMPLEMENT GATE BLOCKED / DATA ACCESS REMEDIATION REQUIRED`

If the available authoritative implementation demonstrates narrow Drizzle cannot preserve authoritative transaction/RLS semantics:

`T1001 = STOP — SEPARATE DATA ACCESS REMEDIATION REQUIRED`

If new upstream Docs/Frozen semantics create a real contradiction:

`STOP — SPEC GAP`

**Tests required**

No Slice 10 implementation test yet. Run current baseline verification only.

**Acceptance evidence**

- exact main SHA;
- exact Frozen Spec blob;
- input-drift classification;
- Slice 8 merge/head status;
- Slice 9 merge/head status;
- separate Data Access Remediation merge/status if any;
- exact authoritative Drizzle source path (Slice 9 or remediation);
- actual Drizzle files/versions/seam evidence;
- migration list/highest prefix;
- compliance/profile/consent schema facts;
- authorization/RLS/grant facts;
- clean development branch/worktree evidence;
- baseline test/CI status.

**Out of scope**

- “temporarily” implementing raw pg;
- editing planning artifacts to waive the dependency;
- fixing unrelated baseline defects.

---

## T1002 — Consume the authoritative Drizzle foundation

**Purpose**

Use the one authoritative typed data-access/transaction seam established by Slice 9; do not create another data layer.

**Dependencies**

- T1001 PASS;
- either Slice 9 Drizzle foundation or a separately approved Data Access Remediation is present on current main and passed T1001.

**Expected files / areas**

- existing Slice 9 `db/schema/**`;
- existing shared server DB transaction module;
- only narrowly required Slice 10 additions to the existing schema projection.

**Implementation requirements**

1. Reuse the actual checked-out-client Drizzle seam from main.
2. Preserve:
   - exact checked-out PoolClient;
   - Drizzle-owned transaction semantics;
   - `app.set_identity_context`;
   - identity-context consistency assertion;
   - `app.set_family_context`;
   - Family RLS;
   - broken-client eviction/original-error propagation.
3. Do not open a nested raw transaction.
4. Do not check out a second client for compliance reads.
5. Add read-only/repeatable-read capability only through the existing seam if needed for consistent evaluation snapshots.
6. Reviewed SQL migration remains production DDL truth.
7. `db/schema` remains a typed projection.
8. Do not use `drizzle-kit push`.

**Tests required**

- same-client identity/RLS test;
- repeatable-read or equivalent consistent-snapshot test;
- connection failure propagation;
- typed schema load/parity.

**Acceptance evidence**

- exact reused transaction helper;
- no second transaction abstraction in diff;
- focused tests green;
- exact locked Drizzle versions.

**Out of scope**

- repository-wide raw-pg rewrite;
- changing Slice 9 Safety semantics.

**STOP conditions**

Any need for a second transaction system or raw-pg-only fallback stops Slice 10.

---

## T1003 — Add policy persistence / migration / typed projection

**Purpose**

Create the single versioned feature-policy truth with strong lifecycle, overlap and least-privilege constraints.

**Dependencies**

- T1001;
- T1002;
- migration number reconciled against latest main.

**Expected files / areas**

- one new reviewed migration, filename number decided at implementation;
- existing `db/schema/**`;
- DB migration/structure/grant tests;
- DB evidence harness only if required by then-current canonical schema expectations.

**Implementation requirements**

Create `compliance_feature_policies` with Plan §5 semantics.

Required invariants:

- uuidv7 PK;
- feature code + feature contract revision;
- positive policy version;
- exact applicability CHECK;
- exact rule CHECKs;
- REQUIRED/NOT_APPLICABLE provenance requirements;
- valid effective interval;
- self supersession integrity;
- unique exact version identity;
- indexes for exact feature/revision/time selection;
- publication overlap guard implemented as a same-feature PostgreSQL advisory-lock + BEFORE INSERT/UPDATE effective-period trigger that rejects intersecting half-open intervals;
- immutable judgment fields after publication;
- lifecycle-only closure allowed to controlled publisher;
- table owned by migrator;
- ENABLE/FORCE RLS on the policy table;
- runtime RLS policy exposes only currently effective rows at transaction time;
- app/runtime receives column-level SELECT only for evaluator-required columns;
- app/runtime cannot SELECT decision_basis/review_evidence/approval/publication history columns;
- app/runtime has no INSERT/UPDATE/DELETE/TRUNCATE;
- migrator/provisioning role has the explicit RLS policy required for controlled history/publication while remaining NOBYPASSRLS;
- no Family/person/consent data duplicated in this table.

The policy table is global truth. Its RLS policy is an active-row least-privilege boundary, not a Family tenancy model and it must not introduce a second family/person context. Existing Family RLS for Person/consent reads remains independently mandatory.

**Tests required**

- fresh migration;
- upgrade from all prior current migrations;
- second apply/replay no-op;
- failed migration rollback;
- exact columns/types/checks/FKs/indexes;
- overlap rejection;
- relrowsecurity / relforcerowsecurity true on policy table;
- runtime sees only current effective rows;
- runtime SELECT succeeds only on evaluator-required columns;
- runtime historical/review-provenance column reads denied;
- runtime INSERT/UPDATE/DELETE/TRUNCATE denied;
- migrator controlled publication works through its explicit RLS policy;
- Drizzle projection parity;
- no unrelated DDL loss.

**Acceptance evidence**

Catalog/introspection output and test results.

**Out of scope**

- production seed of an unreviewed feature-policy conclusion;
- generated content / PIPIA / regulatory tables or workflows.

**STOP conditions**

Any need to modify an historical migration or weaken existing RLS/grants stops the task.

---

## T1004 — Implement server-owned Feature Identity

**Purpose**

Ensure policy selection cannot be driven by client/page/prompt strings and remains Scene-extensible.

**Dependencies**

- T1001.

**Expected files / areas**

- `packages/compliance/src/feature-identity.ts`;
- package exports;
- focused domain/static tests.

**Implementation requirements**

1. Define `featureCode + featureContractRevision` as the canonical identity pair.
2. Make policy version a distinct type.
3. Provide server-only descriptor/registry/mapping.
4. Do not put feature-code authority in public request schema.
5. Reject unknown/unregistered identities.
6. Reject stale/mismatched contract revision.
7. Permit future Scene-owned descriptor registration without Common Core behavior branching.
8. No production A4003/Digital Use literal is required for Slice 10 acceptance.
9. Tests use synthetic fixture descriptors.

**Tests required**

- registered identity resolves;
- unknown string rejected;
- duplicate conflicting registration rejected;
- revision mismatch rejected;
- client/page name cannot construct authority;
- no Scene-specific branch.

**Acceptance evidence**

Focused tests + static scan.

**Out of scope**

Scene implementation.

**STOP conditions**

If the only way to identify a feature is a client-provided free string, stop and remediate the mapping design.

---

## T1005 — Implement pure policy evaluator

**Purpose**

Implement mechanically testable policy selection and obligation/provenance semantics.

**Dependencies**

- T1003 data contract;
- T1004 feature descriptor contract.

**Expected files / areas**

- `packages/compliance/src/feature-policy.ts`;
- focused domain tests.

**Implementation requirements**

1. Pure function receives a validated snapshot and fixed evaluation time.
2. It does not read DB/network/model/clock.
3. Zero active policy → fail closed.
4. Multiple active policies → fail closed.
5. UNKNOWN applicability → fail closed + regulatory/evidence obligation.
6. REQUIRED applies approved policy obligations.
7. NOT_APPLICABLE removes only the anthropomorphic special-rule obligations; it does not disable global/upstream requirements.
8. BASELINE cannot downgrade upstream requirements.
9. `MINORS_BLOCKED` is generic and Scene-agnostic.
10. REQUIRED must enforce the cross-field contract: AI disclosure REQUIRED and usage reminder REQUIRED.
11. NOT_APPLICABLE must not carry/emit the anthropomorphic usage-reminder rule; its usage-reminder rule is BASELINE.
12. UNKNOWN blocks regardless of other stored rule values.
13. Return exact feature/revision/policy/applicability/effective-time provenance.
14. Do not persist an evaluation audit row.
15. Distinguish business fail-closed decisions from infrastructure exceptions.
16. Provide/use the pure server-owned obligation-support guard so a required obligation unsupported by the consuming command fails closed with COMPLIANCE_CAPABILITY_UNAVAILABLE; supported-obligation declarations are never client input.

**Tests required**

- REQUIRED / NOT_APPLICABLE / UNKNOWN;
- missing / future / expired / overlap;
- fixed-time determinism;
- obligations;
- provenance;
- no model/network dependencies.

**Acceptance evidence**

Domain suite proves Frozen Scenarios 1–5, 10–12, 14–15 where applicable.

**Out of scope**

Downstream obligation execution.

---

## T1006 — Compose existing Person / guardian / consent facts

**Purpose**

Make feature evaluation consume the one existing Compliance Profile / guardian-consent truth.

**Dependencies**

- T1005;
- T1002 transaction foundation.

**Expected files / areas**

- compliance repository/snapshot loader;
- existing age-gate composition;
- domain/integration tests.

**Implementation requirements**

1. Reuse `person_compliance_profiles`.
2. Reuse `guardian_person_id`.
3. Reuse current guardian-consent record/evidence semantics.
4. Reuse or compose `assertMinorProcessingAllowed`; do not create a second baseline age gate.
5. ADULT remains non-minor.
6. MINOR_14_17 remains minor mode and does not get UNDER_14 consent only because of age.
7. UNDER_14 requires current valid guardian consent.
8. UNKNOWN age blocks.
9. Feature policy may only add stricter access.
10. Guardian is represented by existing relationship; do not add GUARDIAN age band.
11. Missing/malformed consent evidence remains fail closed.

**Tests required**

- ADULT;
- MINOR_14_17;
- UNDER_14 valid consent;
- UNDER_14 missing/revoked/invalid consent;
- UNKNOWN;
- guardian mismatch;
- subject mismatch;
- notice mismatch;
- malformed evidence;
- generic MINORS_BLOCKED across both minor bands.

**Acceptance evidence**

Frozen Scenarios 7–10 pass.

**Out of scope**

Consent issuance/revocation workflow redesign.

**STOP conditions**

Any duplicate age/guardian/consent persistence is a blocking defect.

---

## T1007 — Authorization / RLS / Safety independence / privacy

**Purpose**

Integrate compliance without weakening authorization, tenant isolation or Safety and without creating an enumeration oracle.

**Dependencies**

- T1002;
- T1005;
- T1006;
- no semantic dependency on Slice 9 Safety implementation; if the Safety guard is present on current main, integration tests must compose with it, otherwise Slice 10 proves only the independent Compliance contract and must not fabricate Safety.

**Expected files / areas**

- internal application-service composition only;
- existing authorization facts/actions only if an additive action is truly required;
- integration/privacy tests;
- no public feature-policy route.

**Implementation requirements**

1. Use existing `authorize()`.
2. Resolve actor/Family/Person before exposing compliance details.
3. Keep Person/consent reads inside existing RLS transaction.
4. Policy-table global read does not imply Person access.
5. Unauthorized/cross-family requests preserve existing generic semantics.
6. If current main contains the authoritative Safety guard, policy-only internal evaluation is not blocked merely because Case is in SAFETY_HOLD.
7. If current main contains the authoritative Safety guard, ordinary progression preserves that existing guard before downstream effect.
8. If Safety is not yet merged because the Drizzle dependency was instead satisfied by an approved Data Access Remediation, Slice 10 does not invent Safety behavior; it preserves the independent integration contract for later consumers.
9. Compliance ALLOW does not override Safety/Authorization/Domain block.
10. Safety ALLOW does not override Compliance UNKNOWN/missing/block.
11. Do not change Slice 9 state/guard semantics if present.
12. Do not expose review evidence or complete policies to client.
13. Infrastructure/fact-query errors propagate rather than becoming an ordinary denial.

**Tests required**

- cross-family target;
- unauthorized actor;
- when Safety is present: held Case + internal policy evaluation;
- when Safety is present: held Case + ordinary progression remains blocked;
- when Safety is present: Compliance ALLOW + Safety block;
- when Safety is present: Compliance block + Safety allow;
- when Safety is absent but approved Data Access Remediation opened the Drizzle gate: no fabricated Safety state/guard appears in the Slice 10 diff;
- fact-query/DB failure propagation;
- no policy/profile enumeration.

**Acceptance evidence**

Frozen Scenario 13 + privacy/RLS tests.

**Out of scope**

New authorization framework or Safety command.

---

## T1008 — Controlled policy publication / supersession representation

**Purpose**

Provide a real reviewed version-publication path without building a public/runtime policy-management product.

**Dependencies**

- T1003.

**Expected files / areas**

- reviewed migration/provisioning SQL or narrowly controlled migration helper;
- DB tests.

**Implementation requirements**

1. Publication is deployment/internal provisioning, not user request.
2. Serialize by exact feature identity.
3. Lock/re-read current effective row.
4. Validate monotonic next policy version.
5. Close prior effective interval and link supersession in same transaction.
6. Insert new immutable judgment.
7. Reject overlap, backwards effective time and conflicting stale publication.
8. Store approved/review evidence/publication source provenance.
9. Do not invent reviewer/staff accounts.
10. Do not add public/admin API.
11. Do not extend `idempotency_keys` because no runtime mutable command exists.
12. Migration replay remains the current publication idempotency boundary.

**Tests required**

- first publish;
- supersede;
- old version preserved;
- stale version rejected;
- concurrent conflicting publish serialized/rejected;
- overlap rejected by the DB trigger even when a caller skips its precheck;
- two concurrent first-publish attempts for one feature are serialized by the same trigger/advisory lock;
- runtime role cannot publish;
- no public route.

**Acceptance evidence**

DB history and concurrency evidence.

**Out of scope**

Human review workflow/UI.

**STOP conditions**

If publication requires a fake staff workflow or public mutation endpoint, stop.

---

## T1009 — Concurrency / snapshot / error hardening

**Purpose**

Close races and ensure real failures never become false policy decisions.

**Dependencies**

- T1005–T1008.

**Expected files / areas**

- compliance repository/service;
- concurrency/fault-injection tests.

**Implementation requirements**

1. Capture evaluation time once.
2. A business command uses its existing transaction; compliance does not open another.
3. Use one consistent snapshot for policy + relevant Person/consent facts.
4. Return the exact version actually read.
5. Policy supersession after the snapshot does not mutate returned provenance.
6. Long-running cross-transaction recheck is documented as downstream responsibility, not implemented here.
7. Overlap/corruption yields ambiguity, never “latest wins”.
8. No currently effective row — whether truly missing, future-only, or expired history — maps to COMPLIANCE_POLICY_MISSING at runtime; runtime is not granted historical-policy visibility merely to distinguish those subcases.
9. Database/transaction failure propagates as infrastructure error.
10. Rollback/failure does not produce an ALLOW snapshot.
11. Preserve original error on rollback failure according to shared transaction seam.

**Tests required**

- concurrent publish;
- overlap corruption;
- policy supersession during evaluation;
- expired/future/no-active policy all fail closed without historical-row exposure to runtime;
- consent/profile change around evaluation;
- connection error;
- rollback error/original error preservation where shared seam supports injection.

**Acceptance evidence**

Deterministic race/fault tests.

**Out of scope**

Global distributed locking.

---

## T1010 — Internal service composition / no public surface

**Purpose**

Expose the foundation to future server consumers without accidentally shipping a policy product or downstream execution runtime.

**Dependencies**

- T1005–T1009.

**Expected files / areas**

- internal compliance service export/composition;
- static/OpenAPI tests.

**Implementation requirements**

1. Provide internal evaluator service callable by authorized server code.
2. Inputs use canonical feature descriptor, not raw client feature string.
3. No public feature-policy endpoint.
4. No public policy response schema containing review evidence.
5. Do not add Timer/Notification/Export/PIPIA/Regulatory/A4003 runtime.
6. Do not change generated OpenAPI operation set.
7. Required obligations are returned, not executed.

**Tests required**

- OpenAPI semantic equivalence;
- static route scan;
- scope-negative scan;
- internal typing test.

**Acceptance evidence**

Frozen Scenarios 6, 11, 12, 16.

**Out of scope**

Any downstream consumer implementation.

**STOP conditions**

Any required public endpoint is a Spec gap, not an implementation convenience.

---

## T1011 — Full acceptance test matrix

**Purpose**

Turn every Frozen acceptance scenario and key failure state into automated evidence.

**Dependencies**

- T1003–T1010.

**Expected files / areas**

- `tests/domain/**`;
- `tests/integration/**`;
- `tests/db/**`;
- existing test helpers only.

**Implementation requirements**

Build a traceable test matrix for:

- policy applicability/effective selection;
- feature identity/revision;
- person/age/guardian/consent;
- obligations;
- authorization/RLS/privacy;
- concurrency/snapshot;
- infrastructure failures;
- migrations/grants/schema;
- scope negatives.

Every Frozen Scenario 1..16 must point to at least one passing automated test or mechanical diff/static check.

**Tests required**

Run all new focused suites and then full `bun run test -- --run`.

**Acceptance evidence**

Scenario-to-test mapping with exact test names/results.

**Out of scope**

Changing historical expected outputs to hide regressions.

**STOP conditions**

Any scenario requiring a new product decision returns to Spec authority.

---

## T1012 — Architecture guards / combined regression

**Purpose**

Prove Slice 10 did not weaken any prior slice/remediation actually merged on current main or smuggle later-phase runtime into Common Core.

**Dependencies**

- T1011.

**Expected files / areas**

- `scripts/guard-static.mjs` only if a narrow new guard is necessary;
- existing DB/OpenAPI/governance verification;
- no CI workflow change unless current main already requires a generated guard artifact update.

**Implementation requirements**

Mechanical negatives must cover:

- no second Compliance Profile/guardian/consent truth;
- no second Safety truth;
- no second authorization/transaction/idempotency system;
- no raw-pg-only Slice 10 path;
- no public policy API;
- no client-authoritative feature string;
- no Common Core A4003/Digital Use branch;
- no timer/session/notification;
- no generated-content/export runtime;
- no PIPIA/regulatory workflow;
- no fake staff/reviewer queue.

Run all prior-slice regressions present on then-current main.

**Tests required**

```bash
bun run guard:static
bun run typecheck
bun run openapi:check
bun run db:evidence -- --no-archive
bun run test -- --run
```

Plus any current-main exact equivalents added before implementation.

**Acceptance evidence**

All commands exit 0 and full regression count/output is recorded.

**Out of scope**

“Fixing” unrelated failing baseline tests by altering product assertions.

**STOP conditions**

A baseline failure must be classified before any remediation; unrelated failures are not silently absorbed into Slice 10.

---

## T1013 — Final exact-head convergence / handoff to Audit 2

**Purpose**

Prove the exact implementation head matches Frozen Spec/Plan/Tasks and stop before merge for independent post-development audit.

**Dependencies**

- T1001–T1012 PASS.

**Expected files / areas**

Read/verification only except mechanical generated artifacts already required by approved implementation.

**Implementation requirements**

1. Re-fetch origin/main.
2. Reconfirm Frozen Spec blob unchanged.
3. Re-read Plan/Checklist/Tasks.
4. Inspect exact diff.
5. Confirm no Docs change.
6. Confirm no Frozen Spec change.
7. Confirm scope-negative list.
8. Confirm exact migration number/current shared vocabulary reconciliation.
9. Run governance validator/self-test.
10. Run exact-head CI/checks.
11. Record exact implementation head.
12. Stop for a new independent Audit 2 AI.
13. Do not merge main.

**Tests required**

```bash
node .specify/scripts/validate-governance.mjs
node .specify/scripts/tests/run-governance-tests.mjs
bun run verify-all
```

If `verify-all` changes before implementation, use current canonical equivalent plus the explicit T1012 commands.

**Acceptance evidence**

- exact head SHA;
- exact base SHA;
- exact diff file list;
- Frozen Spec blob;
- all verification outputs;
- CI exact-head binding;
- unresolved findings = 0.

**Out of scope**

- merge;
- Audit 2 self-approval.

**STOP conditions**

Any unresolved implementation or governance finding prevents handoff as merge-safe.


---

## Planning Freeze

Audit 1: **PASS after planning remediation**

Final Pre-development Re-audit: **PASS**

Open Product Decisions: **0**

Unresolved Planning Findings: **0**

Implement Gate: **OPEN**

Reason: former Slice 9 Drizzle dependency is now satisfied on current main; PR #28 and post-merge remediation PR #29 are merged, and the authoritative Drizzle same-client / identity / RLS transaction foundation is present.

`S10R01_GOVERNANCE_STAGE1_HEADING_GAP`: **CLOSED** — authoritative Frozen Spec v2 contains all four canonical Stage 1 headings.

Historical Frozen Spec v1 commit/blob are non-authoritative. Authoritative provenance is Frozen Spec v2 commit `bc12a0d64a9bd2cf09bbc0dfe0d3ffa305da97e1` / blob `ba38ccdafe85bbb044d994292a6a7237337eb474`.

Governance Validator: **PASS** — exit status `0`.
Governance Self-tests: **PASS** — exit status `0`, `15/15` cases passed.

**SLICE 10 — PLAN RE-FROZEN**

**READY FOR DEVELOPMENT**
