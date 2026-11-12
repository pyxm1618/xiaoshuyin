# Slice 16 Development Tasks — Psychological / Behavioral Intervention Contract Foundation

**Repository**: `pyxm1618/xiaoshuyin`  
**Planning branch**: `plan/016-psychological-behavioral-intervention-contract`  
**Frozen Spec authority**: `05aa4594cbb99c433035f9fa313376a7fec99785` / `a6cd9fd723f9339b575757279703be554afaf0f6`  
**Planning status**: FROZEN only after Audit 1 FINAL PASS  
**Implementation status at planning time**: NOT STARTED / IMPLEMENT GATE BLOCKED

Only **T1601** may run while the Implement Gate is blocked, and T1601 is read-only. No production/schema/test implementation may begin until T1601 records `READY FOR DEVELOPMENT = YES`.

## Dependency Order

```text
T1601  Development-start Implement Gate
  ↓
T1602  Owner/schema/seam reconciliation
  ↓
T1603  Typed contracts
  ↓
T1604  Persistence/RLS (conditional migration)
  ├─→ T1605 lifecycle
  └─→ T1606 real reviewer auth/provenance
          ↓
        T1607 lifecycle commands
          ↓
        T1608 exact package binding
          ↓
        T1609 source/version correction

T1608 + merged upstream owners
  ↓
T1610 eligibility snapshot
  ↓
T1611 deterministic professional core
  ├─→ T1612 Auth/Consent/Compliance/Safety
  └─→ T1613 combination/conflict
          ↓
        T1614 typed result/staleness
          ↓
        T1615 audit/observability

T1607/T1608/T1615 → T1616 reliability proof
T1603/T1605/T1611/T1613/T1614 → T1617 domain acceptance
T1604–T1609 → T1618 DB/lifecycle integration
T1610–T1616 → T1619 control-plane integration
Core complete → T1620 negative suite → T1621 static guard
Persistence/contracts complete → T1622 structural verification
T1617–T1622 → T1623 exact-head regression
T1623 → T1624 Audit 2 handoff
```

## T1601 — Development-start Authority / Implement Gate
**Goal**  
Re-establish then-current remote truth before any production edit and decide whether Slice 16 may start implementation.

**Prerequisites**  
Planning branch frozen; authenticated repository access.

**Expected scope / files**  
READ-ONLY only. Inspect then-current main, four Authority Docs, this Frozen Spec, merged Slice 12–15 Audit 2 evidence/PRs, current Case/Evidence/Formulation/Authorization/RLS/Consent/Compliance/Safety/Scene owners, migration head, transaction seam, idempotency owner, audit owner, and professional reviewer authority. No file mutation.

**Mandatory actions**
1. Re-read `origin/main`, Frozen Spec blob and four Docs blobs.
2. Confirm Slice 12, 13, 14, 15 each: independent Audit 2 PASS + merged to main.
3. Locate exact current owner files/modules; do not rely on this Plan's historical path snapshot.
4. Locate then-current migration head.
5. Prove one caller-owned transaction composition seam and one shared idempotency owner.
6. Prove a legitimate real professional reviewer authorization/provenance responsibility. A dummy user, AI, client flag or newly invented generic RBAC platform does not qualify.
7. Classify drift: NONE / non-semantic execution drift / semantic STOP.

**Gate outcome**  
Only if every predicate passes: `READY FOR DEVELOPMENT = YES`. Otherwise stop before production edit.

**Verification**  
Record exact SHAs/blobs, PR/Audit2/merge evidence, owner paths, migration head and reviewer authority evidence.

**Negative / failure proof**  
A plan branch or unmerged feature branch cannot satisfy a runtime gate. Missing reviewer authority returns BLOCKED rather than fabricating approval.

**Mapping**  
[REQ: FR-048,FR-051,FR-052] [AS: AS-59,AS-60] [NS: NS-20,NS-21,NS-22]

## T1602 — Authoritative owner / schema / seam reconciliation and migration decision
**Goal**  
Freeze the smallest correct physical implementation against the actually merged repository after T1601 passes.

**Prerequisites**  
T1601 PASS.

**Expected scope / files**  
Read then-current `db/schema/**`, `db/migrations/**`, `db/rls/**`, `packages/domain/**`, `packages/scenes/digital-use/**`, shared idempotency/audit modules, and merged Slice 12–15 owner files. Produce an implementation inventory before edits. Exact new/extended paths are chosen here once and used by all later tasks.

**Mandatory decisions**
- confirm exactly one `intervention_definitions` owner;
- decide whether one table/owner can also carry exact package binding or whether one subordinate binding relation is minimally necessary;
- reuse current enum/revision/UUID/timestamp conventions;
- reuse existing RLS/grants pattern;
- reuse shared idempotency/audit/transaction primitives;
- preserve Slice 11 manifest/routing as sole topology truth;
- decide `NO MIGRATION` if sufficient; otherwise allocate only then-next safe migration number.

**Forbidden**
Second Case/Evidence/Formulation/Auth/Consent/Compliance/Safety/Scene/professional truth, generic CMS/rule/workflow engine, preallocated migration number.

**Verification**  
Owner graph and import graph show one professional-definition source of truth; migration decision is justified from then-current schema.

**Stop conditions**  
Any requirement for duplicate truth, historical migration edit, semantic Frozen Spec change, or unapproved generic platform.

**Mapping**  
[REQ: FR-001,FR-048,FR-050] [AS: AS-16,AS-57,AS-58] [NS: NS-17,NS-18,NS-19,NS-21,NS-22]

## T1603 — Typed professional definition and evaluation contracts
**Goal**  
Define the exact domain types/schemas for professional definition content, lifecycle metadata, condition truth states and eligibility result.

**Prerequisites**  
T1602 owner/path freeze.

**Expected files / modules**  
The single owner module selected by T1602, expected under existing `packages/**`; if API contracts are required, the existing `packages/contracts/**` convention. Do not create AI/RAG packages.

**Required definition fields**  
All Frozen Spec fields: id, scene_id, intervention_code, version, target_problem_or_mechanism, formulation_dependencies, supporting_evidence_requirements, applicable_conditions, exclusion/contraindication conditions, age/development scope, rationale, intervention_steps, participation/consent requirements, baseline/observation, expected change, burden/barriers, adverse signals, review window/criteria, stop/reassess/safety/referral conditions, allowed combinations, conflicts, professional source refs, review status, reviewed_by_role, reviewed_at, published_at, retired_at.

**Truth-state contract**  
Reuse repository equivalent or encode KNOWN_TRUE / KNOWN_FALSE / UNKNOWN / DECLINED / NOT_COLLECTED / CONFLICT without collapsing missing states.

**Eligibility result**  
Typed, deterministic and immutable; include exact definition/package/version, reason codes, evidence refs, formulation/control-plane revision stamps, blockers, adverse signals and review criteria.

**Verification**  
Schema/type tests reject method-name-only definitions, missing required publishable fields, family narrative in professional definitions and malformed reason/provenance structures.

**Negative proof**  
No family-specific Evidence copy; no model-generated truth field; no generic rule DSL.

**Mapping**  
[REQ: FR-002,FR-004,FR-005,FR-007,FR-025,FR-033] [AS: AS-02,AS-03,AS-24,AS-25,AS-26,AS-27] [NS: NS-23]

## T1604 — Persistence / migration / RLS / grants for the sole professional owner
**Goal**  
Implement only the persistence proven necessary by T1602.

**Prerequisites**  
T1601 PASS; T1602 migration decision; T1603 contracts.

**Expected files / modules**  
Only the then-current authoritative `db/schema/**` projection, one then-next reviewed `db/migrations/<next>_*.sql` if needed, and `db/rls/**`/repository files selected by T1602. If T1602 says NO MIGRATION, this task becomes a repository-only extension and records N/A for migration creation.

**Required persistence invariants**
- stable id + scene + intervention_code + explicit version;
- unique semantic version identity;
- revision/CAS support;
- published content cannot be silently updated;
- retired history retained;
- professional asset read/mutation permissions separated from family eligibility;
- least privilege grants;
- exact package binding representation is historical and non-floating.

**Verification**  
Fresh DB + upgrade path + constraint tests + RLS policy/grant introspection. Historical migrations remain byte-identical.

**Rollback proof**  
Migration transaction fails cleanly on injected/invalid state; no half-created owner.

**Mapping**  
[REQ: FR-001,FR-002,FR-017,FR-018,FR-021,FR-035] [AS: AS-10,AS-11,AS-20,AS-52,AS-53] [NS: NS-21,NS-22]

## T1605 — Lifecycle repository and immutable version semantics
**Goal**  
Implement DRAFT → REVIEW → APPROVED → PUBLISHED → RETIRED with optimistic revision control and immutable published history.

**Prerequisites**  
T1603; T1604 persistence available.

**Expected files / modules**  
The T1602-selected professional owner/repository module; no generic workflow engine.

**Required behavior**
- legal transition matrix only;
- expected revision required for mutation;
- published/retired semantic record immutable;
- material correction creates a new version;
- same retired historical version cannot be reactivated;
- retirement never deletes history;
- source/version history remains inspectable.

**Verification**  
Domain/repository tests for every legal transition and every illegal skip/back-edge; stale revisions conflict; historical versions remain readable.

**Negative / rollback**  
No last-write-wins; no delete/rewrite of published history.

**Mapping**  
[REQ: FR-008,FR-009,FR-010,FR-011,FR-015,FR-016,FR-017,FR-018,FR-041] [AS: AS-04,AS-06,AS-08,AS-09,AS-10,AS-11,AS-45,AS-52,AS-53]

## T1606 — Real professional reviewer authorization and provenance adapter
**Goal**  
Bind review/approval to the legitimate real reviewer authority proven by T1601.

**Prerequisites**  
T1601 must have recorded a real approved reviewer responsibility. If not, STOP; this task must not invent one.

**Expected files / modules**  
Reuse the then-current authenticated principal/authorization path plus the T1602 professional owner. No `apps/operations` shell or staff/RBAC platform unless it already exists as approved merged authority.

**Required behavior**
- server resolves reviewer role/responsibility;
- family/Case ownership never authorizes professional mutation;
- `reviewed_by_role` derives from server-authorized responsibility;
- record actor, exact definition version/revision, decision, reviewed_at, source provenance;
- AI/RAG/family actor cannot satisfy review.

**Verification**  
Authorized real-review fixture passes; normal family actor, unauthenticated actor, fake role string and AI/system approval attempts fail with zero business writes.

**Mapping**  
[REQ: FR-012,FR-013,FR-035,FR-051,FR-052] [AS: AS-01,AS-05,AS-20,AS-59,AS-60] [NS: NS-20]

## T1607 — Lifecycle commands with shared idempotency and one transaction
**Goal**  
Implement bounded commands: create definition/version, submit review, approve, publish, retire.

**Prerequisites**  
T1604–T1606.

**Expected files / modules**  
T1602-selected application/domain service; existing shared idempotency and transaction modules; existing audit primitive. No new idempotency store.

**Command contract**
- same key + same semantic payload = replay same business result;
- same key + different payload = conflict;
- each mutation accepts expected revision;
- command-local state + review provenance + package binding + audit/event + idempotency completion commit atomically as applicable.

**Publish preconditions**  
Complete contract, real APPROVED review, exact allowed Scene/package binding, no retired same-version resurrection.

**Retire preconditions**  
Published/eligible historical version only according to lifecycle matrix; history preserved.

**Verification**  
Replay/mismatch, stale revision, invalid transition, unauthorized reviewer and rollback tests.

**Mapping**  
[REQ: FR-008,FR-009,FR-010,FR-011,FR-012,FR-013,FR-014,FR-015,FR-016,FR-039,FR-040,FR-041,FR-042,FR-043] [AS: AS-01,AS-02,AS-04,AS-05,AS-06,AS-07,AS-08,AS-09,AS-41,AS-42,AS-43,AS-44,AS-45,AS-46]

## T1608 — Exact DIGITAL_USE package/definition binding
**Goal**  
Bind exact reviewed definition versions to the exact current Digital Use Scene/package without creating a second Scene system.

**Prerequisites**  
T1602; T1605–T1607; then-current Slice 11/12–15 package identity verified.

**Expected files / modules**  
The professional owner plus a narrow Digital Use projection under existing `packages/scenes/digital-use/**` if required. `node-manifest.ts` and `routing.ts` remain topology owners and must not be rewritten for intervention semantics.

**Required behavior**
- exact definition id + exact version + exact scene + exact package version;
- no `latest` lookup;
- package resolves inspectable exact definition-version set;
- one active new-use binding per applicable package/intervention identity;
- historical bindings retained;
- wrong/stale package fails closed.

**Verification**  
Package resolution tests, concurrent publish tests, historical lookup, manifest/routing snapshot regression.

**Mapping**  
[REQ: FR-003,FR-010,FR-014,FR-019,FR-020,FR-021] [AS: AS-13,AS-14,AS-15,AS-16,AS-43,AS-52] [NS: NS-22,NS-24]

## T1609 — Initial V1 definition set, professional source provenance, correction and retirement history
**Goal**  
Inventory the Frozen Spec §7.2 V1 Digital Use formal Intervention families, materialize only source-supported professional definitions, make source/version provenance inspectable, and ensure correction never rewrites published history.

**Prerequisites**  
T1603–T1608.

**Expected files / modules**  
Same professional owner only; source refs are references/metadata, not a new knowledge/RAG platform.

**Required behavior**
- inventory at minimum: internal motivation; emotional regulation; sleep/routine; time management/procrastination; family relationship/interaction; parent consistency; rewards/incentives; supervision; parent self-regulation; family communication/parent-response when used as a formal Intervention;
- do not auto-promote every Phase 2 node/template/example/FAQ/support artifact;
- for each candidate, record the authoritative source material used and Contract completeness;
- only complete, real-reviewed candidates may become PUBLISHED and exactly package-bound;
- insufficient source content or incomplete Contract remains NOT READY / unpublished;
- developer/model must not invent steps, thresholds, age boundaries, contraindications, review criteria or sources;
- version-aware professional_source_refs;
- reviewer can inspect sources used for exact definition version;
- changed/withdrawn source identifies affected versions;
- material correction creates new definition version/review path;
- old published/retired source provenance remains historical;
- restricted professional source bodies/internal review material are not automatically exposed to family/runtime surfaces; only approved content and necessary provenance are exposed.

**Verification**  
Produce a ten-family-or-more inventory tied to the actual current V1 formal Intervention candidates. Each candidate must end in either REVIEWED+PUBLISHED with exact source/reviewer/package evidence or explicit NOT READY/UNPUBLISHED with the missing Contract/source reason. Run source correction/withdrawn-source tests; prove no historical rewrite and no AI/developer auto-fill.

**Mapping**  
[REQ: FR-006,FR-015,FR-017,FR-021,FR-052] [AS: AS-11,AS-12,AS-53,AS-60] [NS: NS-07,NS-08,NS-23]

## T1610 — Authoritative eligibility snapshot loader
**Goal**  
Load one consistent authorized snapshot for exact definition + exact Case/Formulation/Evidence/package/control-plane revisions.

**Prerequisites**  
T1608; merged Slice 12–15 owners located by T1601.

**Expected files / modules**  
T1602-selected eligibility module plus existing owner repositories/seams. Use one caller-owned `PoolClient` where a consistent transaction snapshot is required.

**Required behavior**
- authorize actor/purpose first;
- establish Family/Case RLS context;
- resolve exact current Case;
- resolve current exact Problem Formulation version;
- resolve authoritative Evidence refs only;
- resolve exact definition id/version and package binding;
- record revision stamps needed for stale-result detection;
- reject cross-family/cross-case Evidence.

**Verification**  
Wrong-family/case/actor, cross-family/cross-case Evidence, stale formulation/package snapshot and consistent-snapshot tests.

**Mapping**  
[REQ: FR-022,FR-023,FR-034,FR-036,FR-037] [AS: AS-17,AS-18,AS-19,AS-21,AS-22,AS-23,AS-28]

## T1611 — Pure deterministic professional eligibility core
**Goal**  
Evaluate professional conditions without model calls or writes.

**Prerequisites**  
T1603; T1610 snapshot.

**Expected files / modules**  
Pure domain/Scene eligibility module selected by T1602. No database writes, no network/model dependency.

**Evaluation order**
1. reviewed/published/not retired/exact package already established;
2. age/development;
3. formulation dependencies;
4. evidence requirements;
5. applicable conditions;
6. exclusions/contraindications;
7. condition-state fail-closed semantics.

**UNKNOWN semantics**  
KNOWN_TRUE / KNOWN_FALSE / UNKNOWN / DECLINED / NOT_COLLECTED / CONFLICT remain distinct. Required UNKNOWN fails unless exact reviewed definition + current policy explicitly permit it.

**Verification**  
Truth-table unit tests, age mismatch, missing formulation/evidence, conflict, exclusion and reassessment-classification tests.

**Negative proof**  
No model guesses; no action/Case transition on REASSESS result class.

**Mapping**  
[REQ: FR-022,FR-025,FR-026,FR-027,FR-028,FR-033] [AS: AS-23,AS-24,AS-25,AS-26,AS-27,AS-29,AS-30,AS-31]

## T1612 — Authorization / participation / Consent / Compliance / Safety gate composition
**Goal**  
Compose four independent hard control planes and participation requirements after professional-definition checks.

**Prerequisites**  
T1610 snapshot; authoritative owner seams from T1601.

**Expected files / modules**  
Eligibility application service plus existing Authorization, Consent, Compliance and Safety modules only. No copied policy tables or client authority.

**Required behavior**
- family/Case authorization independent;
- participation requirements evaluated;
- Consent current validity independent;
- Compliance transaction-time result independent;
- Safety hold/block independent and last hard gate before allow;
- any required BLOCK/UNKNOWN fails closed;
- publication/approval never bypasses family gates;
- participation requirement is not Consent, parent action cannot imply child Consent, and published definitions cannot imply Consent;
- definition age/development scope never substitutes for the authoritative Compliance age/minor profile;
- A4003-specific Compliance remains under its feature policy;
- Safety Hold cannot be bypassed by selecting another ordinary Intervention;
- this task never releases Safety and never creates Referral.

**Verification**  
Wrong actor, participant escalation, Consent present/missing/revoked, parent-action-does-not-imply-child-Consent, published-definition-does-not-imply-Consent, Compliance block/unresolved, age-scope-vs-Compliance-profile independence, A4003 policy non-ownership, Safety Hold, alternate-intervention Safety bypass rejection, no Safety release/Referral write, and professional approval under Safety Hold.

**Mapping**  
[REQ: FR-029,FR-031,FR-032,FR-035,FR-036,FR-037,FR-038,FR-044] [AS: AS-17,AS-18,AS-19,AS-20,AS-21,AS-22,AS-34,AS-35,AS-36,AS-37,AS-38,AS-39,AS-40] [NS: NS-21]

## T1613 — Exact-version combination/conflict evaluator and future-consumer seam
**Goal**  
Make `allowed_combinations` and `conflicting_interventions` executable without creating Phase 4 state.

**Prerequisites**  
T1603 definitions; T1611 core.

**Expected files / modules**  
Pure professional eligibility module. No InterventionInstance/Plan/Task repository.

**Required result classes**  
COMPATIBLE / INCOMPATIBLE / REQUIRES_SEQUENCING / UNKNOWN.

**Required behavior**
- compare exact definition versions;
- known explicit conflict blocks the combination;
- explicit compatible pair does not fail merely because multiple definitions exist;
- sequence requirement is returned as metadata only;
- if no authoritative active-intervention context exists, expose a pure comparison seam for a future consumer and do not invent state.

**Verification**  
Pair/matrix tests including symmetry/directionality as definition semantics require, unknown context, explicit sequencing and conflict.

**Mapping**  
[REQ: FR-030,FR-033] [AS: AS-32,AS-33] [NS: NS-01,NS-03]

## T1614 — Typed eligibility result, reason codes and staleness contract
**Goal**  
Return a structured, auditable result that cannot become timeless authority.

**Prerequisites**  
T1610–T1613.

**Expected files / modules**  
T1603 result contract + eligibility application service.

**Required result data**
allowed; exact definition/package identifiers and revisions; reason codes; evidence refs; formulation revision; unmet dependencies; missing requirements; truth-state details; exclusions; age mismatch; participation/Consent/Compliance/Safety blockers; combination result; adverse signals; review criteria reference; evaluated_at/trace; all relevant revision stamps.

**Staleness rule**  
A future consumer must reject/re-evaluate when relevant definition/package/Formulation/Evidence/Consent/Compliance/Safety revision changed.

**Verification**  
Snapshot tests and stale-revision matrix, including Consent revoked after earlier allow and stale package/formulation.

**Mapping**  
[REQ: FR-033,FR-034] [AS: AS-15,AS-28,AS-36,AS-45]

## T1615 — Business audit / observability integration
**Goal**  
Record professional lifecycle and eligibility decisions through existing audit/event conventions without leaking unnecessary family data.

**Prerequisites**  
T1607 lifecycle; T1614 result.

**Expected files / modules**  
Existing business audit/event owner or its sanctioned extension selected by T1602. No private Slice 16 audit ledger.

**Events**
definition created; review submitted; approved; publication attempted; published; retired; version superseded; eligibility evaluated; eligibility blocked.

**Required metadata**
actor; definition/version; command/reason; package; before/after revision; timestamp; reviewer/source provenance; request/trace correlation. Family audit uses IDs/reason codes/revisions, not unnecessary narrative.

**Authority split**
Successful professional truth changes must write authoritative business audit/event in the same transaction. Denied/failed attempts and eligibility blocks may emit bounded non-authoritative request/observability metadata only after the final outcome is known; they must not claim a lifecycle transition and must not become a second professional truth store.

**Verification**  
Authoritative audit assertions for successful mutations; bounded observability assertions for denied/block paths; unauthorized/failing transaction cannot claim success.

**Mapping**  
[REQ: FR-006,FR-012,FR-042,FR-043] [AS: AS-01,AS-07,AS-41,AS-46]

## T1616 — Idempotency, concurrency and fault-injection proof suite
**Goal**  
Prove lifecycle correctness under retries, races, stale writers and transaction faults.

**Prerequisites**  
T1607/T1608/T1615.

**Expected files / modules**  
Focused integration/DB tests using existing shared test harness. Production change only if a test exposes a real contract defect.

**Required race tests**
- same command same key/same payload replay;
- same key/different payload conflict;
- two reviewers same expected revision;
- concurrent publish;
- publish vs retire;
- edit vs publish;
- stale version update;
- distinct semantic version uniqueness.

**Required fault injection**
Failure after definition/version write, review state, binding, audit boundary and before idempotency completion. Assert rollback leaves no partial truth and no completed idempotency success.

**Verification**  
Run the focused race/fault suite repeatedly against the real shared idempotency/transaction implementation; assert one authoritative winner, deterministic stale/conflict errors, exact replay, zero duplicate audits, and zero partial rows after each injected failure.

**Mapping**  
[REQ: FR-039,FR-040,FR-041,FR-042,FR-043] [AS: AS-41,AS-42,AS-43,AS-44,AS-45,AS-46]

## T1617 — Domain acceptance test matrix
**Goal**  
Implement the pure/domain acceptance suite required by the Frozen Spec.

**Prerequisites**  
T1603,T1605,T1611,T1613,T1614.

**Expected files / modules**  
`tests/domain/**` and/or `tests/scenes/digital-use/**` following current repository layout.

**Coverage**
complete/missing/method-only definition; lifecycle transitions; immutable history/new version; exact package semantics where pure; UNKNOWN states; age/development; formulation/evidence requirements; exclusion/reassess; combination; typed result/staleness.

**No-network assertion**  
Test environment must fail if a model/network AI call is attempted.

**Verification**  
Focused suite maps each named acceptance to explicit assertions, not only line coverage.

**Mapping**  
[REQ: FR-002,FR-004,FR-007,FR-008,FR-009,FR-010,FR-011,FR-017,FR-018,FR-022,FR-025,FR-026,FR-027,FR-028,FR-030,FR-033,FR-047] [AS: AS-02,AS-03,AS-04,AS-06,AS-08,AS-09,AS-10,AS-11,AS-23,AS-24,AS-25,AS-26,AS-27,AS-29,AS-30,AS-31,AS-32,AS-33,AS-51]

## T1618 — DB / RLS / professional lifecycle integration suite
**Goal**  
Prove persistence, professional authorization, package binding, lifecycle and historical behavior against the real database.

**Prerequisites**  
T1604–T1609.

**Expected files / modules**  
`tests/db/**`, `tests/integration/**`, existing migration/RLS harnesses.

**Coverage**
fresh schema + upgrade; grants; FORCE RLS; authorized reviewer vs family actor; create/review/approve/publish/retire; exact package/wrong package; historical binding; source correction; idempotency/concurrency; audit.

**Verification**  
Database introspection proves intended tables/enums/policies only; no forbidden tables appear.

**Mapping**  
[REQ: FR-001,FR-003,FR-012,FR-014,FR-015,FR-019,FR-020,FR-021,FR-035,FR-039,FR-040,FR-041,FR-042] [AS: AS-01,AS-05,AS-07,AS-12,AS-13,AS-14,AS-16,AS-20,AS-41,AS-42,AS-43,AS-44,AS-45,AS-52,AS-53]

## T1619 — Family/Case control-plane and atomic eligibility integration suite
**Goal**  
Prove real eligibility integration with existing owners and rollback semantics.

**Prerequisites**  
T1610–T1616; merged upstream runtime.

**Expected files / modules**  
`tests/integration/**` plus existing owner fixtures.

**Coverage**
wrong Family/Case/actor; cross-family/cross-case Evidence; current/stale Formulation; Consent present/missing/revoked; Compliance allow/block/unresolved; Safety hold; combination conflict; stale result; infrastructure error; same-client snapshot; audit minimization.

**Rollback**
Injected failure during any composed write/audit path leaves no partial Slice 16 truth. Eligibility itself remains side-effect-free.

**Verification**  
Assert application denial + database RLS denial where applicable, exact reason-code/result stamps, no protected existence leakage, no family-sensitive narrative in generic logs, and transaction rollback under injected owner/infrastructure failures.

**Mapping**  
[REQ: FR-023,FR-029,FR-031,FR-032,FR-034,FR-036,FR-037,FR-038,FR-043,FR-044] [AS: AS-17,AS-18,AS-19,AS-21,AS-22,AS-23,AS-28,AS-34,AS-35,AS-36,AS-37,AS-38,AS-39,AS-40,AS-46]

## T1620 — Negative authority / AI / RAG / Phase-boundary regression suite
**Goal**  
Mechanically prove forbidden authority paths and scope leakage remain impossible.

**Prerequisites**  
Core Slice 16 implementation complete.

**Expected files / modules**  
`tests/architecture/**`, `tests/integration/**`, `tests/scenes/digital-use/**`. No AI/RAG implementation is created for the test.

**Required negatives**
- AI/model/RAG approval/publish/override rejected;
- unpublished/retired/wrong-contract candidates cannot pass;
- model assertion cannot become Evidence/Formulation fact;
- no InterventionInstance/Goal/Plan/Task/Checkin/Review/Outcome/Schedule/Notification truth;
- no knowledge/RAG/vector/Context/AI runtime/Jev/Promptfoo/A4003/execution-AI scope;
- no generic CMS/rules/workflow/intervention engine;
- no new staff/RBAC platform;
- no duplicate professional/control-plane/Scene truth;
- no family narrative in definitions;
- no floating latest.

**Verification**  
DB/schema/file/import inventory plus executable negative cases.

**Mapping**  
[REQ: FR-013,FR-024,FR-045,FR-046,FR-047,FR-048,FR-049,FR-050,FR-051,FR-052] [AS: AS-47,AS-48,AS-49,AS-50,AS-51,AS-54,AS-55,AS-56,AS-57,AS-58,AS-59,AS-60] [NS: NS-01,NS-02,NS-03,NS-04,NS-05,NS-06,NS-07,NS-08,NS-09,NS-10,NS-11,NS-12,NS-13,NS-14,NS-15,NS-16,NS-17,NS-18,NS-19,NS-20,NS-21,NS-22,NS-23,NS-24,NS-25]

## T1621 — Static architecture guard for single truth and forbidden platforms
**Goal**  
Extend `scripts/guard-static.mjs` with narrow Slice 16 rules that detect ownership and scope violations without opening later-phase paths.

**Prerequisites**  
T1602 exact owner paths frozen.

**Expected files / modules**  
`scripts/guard-static.mjs` plus its self-test/architecture tests only.

**Guard requirements**
- only selected professional owner may define `intervention_definitions` truth;
- no second node registry/routing;
- no direct Scene topology rewrite;
- no forbidden Phase 4 tables/entities/routes;
- no RAG/AI/Context/model platform;
- no generic CMS/rules/workflow/intervention engine;
- no duplicate Authorization/Consent/Compliance/Safety truth;
- no floating latest helper used as formal authority;
- no AI/RAG review/publish authority path.

**Self-test**  
Each rule has at least one synthetic violating sample proving the guard is non-vacuous.

**Verification**  
Run `guard:static` and the guard self-test; each Slice 16 rule must both pass on the real tree and fail on its synthetic violating sample. Confirm existing Slice 9/10/11 guard rules remain green and were not weakened.

**Mapping**  
[REQ: FR-020,FR-024,FR-044,FR-045,FR-048,FR-049,FR-050] [AS: AS-16,AS-47,AS-48,AS-54,AS-55,AS-56,AS-57,AS-58] [NS: NS-01,NS-02,NS-03,NS-04,NS-05,NS-06,NS-07,NS-08,NS-09,NS-10,NS-11,NS-12,NS-13,NS-14,NS-15,NS-16,NS-17,NS-18,NS-19,NS-20,NS-21,NS-22,NS-24,NS-25]

## T1622 — Migration / RLS / contracts / OpenAPI verification
**Goal**  
Run repository-standard structural verification for every changed persistence or contract surface.

**Prerequisites**  
T1604 and any contract/API changes complete.

**Expected files / modules**  
Tests/scripts only as required by existing repository verification conventions; generated OpenAPI artifacts only if an actual HTTP surface was added.

**Required verification**
- official migration runner fresh DB;
- upgrade from historical main-compatible state;
- migration history integrity;
- RLS/grants verification;
- schema projection equivalence;
- OpenAPI generate/check if applicable;
- no unapproved public professional CMS route.

**Failure rule**  
Any mismatch is a Slice 16 defect unless proven pre-existing on exact base; do not weaken tests to pass.

**Verification**  
Capture exact command results for official migration fresh-install/upgrade, historical migration integrity, schema projection, RLS/grant introspection and OpenAPI generate/check when applicable; verify the working diff contains no generated drift after checks.

**Mapping**  
[REQ: FR-001,FR-018,FR-035,FR-036,FR-042,FR-043] [AS: AS-10,AS-17,AS-18,AS-20,AS-46]

## T1623 — Exact-head regression / scope / historical-owner verification
**Goal**  
Prove the exact implementation head satisfies Slice 16 without regressing existing owners.

**Prerequisites**  
T1617–T1622 all green.

**Expected scope / files**  
No new feature work. Verification only; minimal defect fixes must return to the owning task and re-run this task.

**Commands / evidence**
- typecheck;
- static guard + guard self-test;
- focused Slice 16 domain;
- Slice 16 DB/integration;
- migration fresh/upgrade;
- RLS/grants;
- OpenAPI/contracts when applicable;
- relevant Case/Evidence/Formulation/Safety/Compliance/Scene regression;
- full relevant test suite;
- compare exact base/head; behind=0 at audit package time;
- changed-file inventory proves Docs=0, Frozen Spec=0, Phase4/AI/RAG forbidden scope=0.

**Verification**  
All listed commands must PASS on the exact same implementation head. Re-read the exact head after the final command; any new commit invalidates the evidence and requires T1623 to run again.

**Mapping**  
[REQ: FR-001–FR-052] [AS: AS-01–AS-60] [NS: NS-01–NS-25]

## T1624 — Implementation evidence freeze and Audit 2 handoff
**Goal**  
Freeze exact-head evidence for a new independent Audit 2 AI without performing Audit 2.

**Prerequisites**  
T1623 PASS.

**Expected scope / files**  
Evidence/report artifacts only according to existing project convention. No merge.

**Evidence must include**
base SHA, exact head SHA, merge base/ahead/behind, changed files, migration identities, schema/RLS/grant evidence, test commands/results, FR 52/52, AS 60/60, NS 25/25, static guard proof, professional reviewer authority evidence, exact package binding, rollback/concurrency/idempotency evidence, no Docs/spec mutation.

**Stop boundary**  
Development AI does not approve its own work, does not merge main and does not perform Audit 2.

**Verification**  
Recompute package/file hashes and exact branch head, verify the evidence package binds only that head, and verify no merge/Audit2 action occurred. The handoff is complete only when an independent auditor can reproduce the cited evidence.

**Mapping**  
[REQ: FR-001–FR-052] [AS: AS-01–AS-60] [NS: NS-01–NS-25]


## Coverage Freeze

- Functional Requirements: **52/52**
- Acceptance Scenarios: **60/60**
- Negative Scope Scenarios: **25/25**
- Development tasks: **24**

No task authorizes production work while T1601 is BLOCKED. No task authorizes Audit 2 or merge.
