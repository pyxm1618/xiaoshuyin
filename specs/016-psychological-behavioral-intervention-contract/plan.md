# Slice 16 Implementation Plan — Psychological / Behavioral Intervention Contract Foundation

**Role**: Slice 16 Plan AI 2 — Plan + Checklist + Tasks + Pre-Development Audit 1 only  
**Repository**: `pyxm1618/xiaoshuyin`  
**Planning branch**: `plan/016-psychological-behavioral-intervention-contract`  
**Frozen Spec**: commit `05aa4594cbb99c433035f9fa313376a7fec99785` / blob `a6cd9fd723f9339b575757279703be554afaf0f6`  
**Execution context**: REMOTE-ONLY. No local checkout exists in this run; local branch / HEAD / working tree and literal `git fetch origin` execution are N/A and are not fabricated. Remote truth is re-read from GitHub.  
**Planning status**: COMPLETE  
**Planning Quality Gate**: pending Audit 1 at authoring time  
**Runtime status**: BLOCKED — Development-Start Implement Gate is not satisfied

## 1. Authority Gate

| Authority | Exact truth | Planning result |
|---|---|---|
| Current `origin/main` | `7ec51889337d547766412a2ce954cff352e6d57b` | PASS |
| Frozen Spec branch | `spec/016-psychological-behavioral-intervention-contract` | PASS |
| Frozen Spec commit | `05aa4594cbb99c433035f9fa313376a7fec99785` | PASS |
| Frozen Spec blob | `a6cd9fd723f9339b575757279703be554afaf0f6` | PASS — exact |
| Frozen Spec branch vs commit | identical / 0 ahead / 0 behind | PASS |
| `Docs/总产品需求.md` | `67724000cb9bb81c40489c04db28d899bd1df74c` | PASS — exact |
| `Docs/V1产品需求.md` | `918d8574ad88773fe371985fd5c38080c944fec9` | PASS — exact |
| `Docs/总体技术架构.md` | `9b08371edc976fa281469dfee8dc19962452e3b0` | PASS — exact |
| `Docs/V1技术设计.md` | `e7285fd8363c8a76ab4fd96a305037b5c675f961` | PASS — exact |
| Current migration head | `011_compliance_feature_policy_foundation.sql` | PASS — PR #30 added 011; PR #31/#32 add no migrations |
| Current Scene/package identity | `DIGITAL_USE / v1` | PASS — Slice 11 types |
| Same-transaction seam | caller-owned `PoolClient` seam exists for Problem Formulation | PASS — PR #32 |
| Planning branch before this plan | absent | PASS — created without overwriting prior planning work |

### 1.1 Input drift

Frozen authority baseline and current `origin/main` are the same SHA. All four Authority Docs blobs are unchanged.

```text
Input Drift:
NONE
```

If any of those semantic authorities change before development, T1601 must classify the change. Non-semantic dependency/execution drift may be reconciled in implementation-start inventory only. Semantic drift is a hard STOP and returns to Plan AI 1 / Product Authority; this Plan may not rewrite the Frozen Spec.

## 2. Scope / Phase Boundary

Slice 16 is exactly the first Phase 3 professional hard-gate capability:

> authoritative Psychological / Behavioral Intervention Contract definition truth + real professional review/publication/retirement lifecycle + immutable versions + exact Scene/package/version binding + narrow deterministic eligibility evaluation.

Slice 16 owns:

- one authoritative `intervention_definitions` professional truth;
- definition lifecycle state and revision;
- real reviewer provenance attached to lifecycle decisions;
- publication/retirement truth;
- immutable historical versions;
- exact definition version ↔ exact Scene/package version binding;
- professional source provenance;
- deterministic, side-effect-free eligibility for one exact definition version;
- a typed eligibility result suitable for future Phase 4 consumers.

Slice 16 consumes, never duplicates:

- Family / Account / Person;
- Case;
- Evidence;
- Problem Formulation;
- Authorization and RLS;
- Consent;
- Compliance;
- Safety;
- Slice 11 Scene Manifest / routing / `DIGITAL_USE/v1`;
- shared idempotency;
- business audit/event conventions;
- caller-owned transaction seams.

Explicitly out of scope:

- InterventionInstance;
- Goal;
- Plan / PlanVersion activation;
- Task;
- Checkin;
- Common Core Review;
- Outcome;
- Follow-up Schedule;
- Notification / pg-boss work;
- RAG / pgvector / sparsevec / pg_jieba;
- Context Builder;
- AI Task Runtime;
- TaskModelRegistry / provider gateway;
- Promptfoo platform work;
- Jev;
- A4003 model runtime;
- execution-support AI;
- generic CMS;
- generic professional rules engine;
- generic workflow/intervention engine;
- a new staff/RBAC platform.

`allowed=true` means only that one exact published definition version may enter later formal Intervention consideration under the evaluated current context. It performs no Phase 4 write.

## 3. Current Repository Owner Inventory

| Concern | Current authoritative truth | Slice 16 contract |
|---|---|---|
| Case | existing Common Core | consume only |
| Evidence | Evidence Core | consume refs/current authoritative evidence only |
| Problem Formulation | Slice 8 owner | consume current exact version/dependencies; use existing in-transaction seam where composition requires it |
| Safety | Slice 9 | independent hard gate; never duplicate |
| Compliance | Slice 10 | independent hard gate; use transaction-time evaluator |
| Scene/package/topology | Slice 11 `packages/scenes/digital-use/*` | read `DIGITAL_USE/v1`; manifest/routing read-only |
| Slice 12–15 runtime | not merged on current main | hard runtime dependency |
| shared idempotency | existing `idempotency_keys` owner | reuse; no second store |
| audit | existing business-audit conventions | reuse/extend, no private ledger |
| transaction | existing `withRlsTransaction` plus caller-owned `PoolClient` seams | one business transaction; no nested owner transaction |
| professional reviewer authority | no real reusable reviewer authority proven on current main | T1601 hard gate; no fabricated reviewer |

Static guard currently treats `apps/operations`, `packages/ai`, `packages/rag`, etc. as forbidden absent/later-phase paths. Slice 16 must extend existing guard rules narrowly rather than opening unrelated platform paths.

## 4. Development-Start Implement Gate — T1601

Planning quality and runtime readiness are independent.

Before any production/schema/test implementation, T1601 performs a read-only inventory against then-current main and requires all predicates below.

### 4.1 Required merged runtime

All four must be independently Audit-2-passed and merged to main:

1. Slice 12 — Digital Use Assessment Runtime;
2. Slice 13 — Digital Use Family Alliance Runtime;
3. Slice 14 — Digital Use Phone Use Contract Runtime;
4. Slice 15 — Digital Use Review Runtime.

A planning branch, Frozen Spec, Audit 1, open PR, or unmerged implementation branch does not satisfy this gate.

### 4.2 Required owner/seam truth

T1601 must re-locate and record the then-authoritative owner/module for:

- Case;
- Evidence;
- current Problem Formulation;
- Authorization;
- RLS context;
- Consent;
- Compliance;
- Safety;
- Scene Manifest / package identity;
- current migration head;
- caller-owned transaction seam;
- shared idempotency owner;
- audit/event owner;
- real professional reviewer authorization/provenance responsibility.

Every dependency must exist as merged runtime and must remain single-source-of-truth.

### 4.3 Professional reviewer authority gate

Formal production review requires a real, accountable, authorized human professional responsibility. The repository currently does not prove such an authority.

T1601 must find a legitimate existing principal/authorization responsibility approved by product/operations authority. It must **not** create:

- a dummy reviewer;
- an AI reviewer;
- an automatically approved reviewer;
- a fake expert account;
- an expert marketplace;
- a new generic staff/RBAC platform merely to unblock Slice 16.

If no valid authority exists at development start:

```text
IMPLEMENT GATE = BLOCKED
STOP BEFORE PRODUCTION EDIT
```

The correct result is truthful NOT READY, not fabricated approval.

### 4.4 Current planning-time result

Current main has not merged Slice 12, 13, 14 or 15, and real professional reviewer authority is not proven.

```text
Runtime Dependency Gate: BLOCKED
Implement Gate: BLOCKED
READY FOR DEVELOPMENT: NO
```

## 5. Professional Definition Contract

The implementation must preserve the complete semantic contract below. T1602 chooses the smallest repository-compatible physical representation after inspecting then-current schema/enum conventions; this Plan does not pre-decide unnecessary SQL normalization.

Required semantic fields:

- `id`;
- `scene_id`;
- `intervention_code`;
- `version`;
- `target_problem_or_mechanism`;
- `formulation_dependencies`;
- `supporting_evidence_requirements`;
- `applicable_conditions`;
- `exclusion_or_contraindication_conditions`;
- `age_and_development_scope`;
- `rationale`;
- `intervention_steps`;
- `participation_and_consent_requirements`;
- `baseline_and_observation`;
- `expected_observable_change`;
- `burden_and_barriers`;
- `adverse_or_worsening_signals`;
- `review_window_and_criteria`;
- `stop_reassess_safety_referral_conditions`;
- `allowed_combinations`;
- `conflicting_interventions`;
- `professional_source_refs`;
- `review_status` / equivalent lifecycle state;
- `reviewed_by_role`;
- `reviewed_at`;
- `published_at`;
- `retired_at`.

The implementation may add only repository-required technical metadata such as revision/CAS, timestamps, actor IDs, canonical payload hash or audit linkage. Technical metadata may not change professional semantics.

A method/therapy name alone is never a valid definition.

`supporting_evidence_requirements`, conditions and source refs are professional definition data. Family-specific Evidence, child-specific facts, case observations and case-specific Formulation truth never live inside `intervention_definitions`.

## 5.1 Initial V1 Digital Use Formal Intervention Definition Set

The implementation must inventory the **formal Intervention candidates** actually required by the current V1 Digital Use product baseline and materialize reviewed definition versions only where the full Contract can be supported by authoritative professional source material.

At minimum, the inventory must cover the Frozen Spec §7.2 families:

1. internal motivation;
2. emotional regulation;
3. sleep / routine;
4. time management / procrastination;
5. family relationship / interaction;
6. parent consistency;
7. rewards / incentives;
8. supervision;
9. parent self-regulation;
10. family communication / parent-response methods **when used as a formal Intervention**.

This is an inventory of professional Intervention families, not permission to promote every Phase 2 node/template/example/FAQ/support artifact into `intervention_definitions`.

For each candidate family, implementation evidence must show one of:

- **REVIEWED + PUBLISHED**: complete Contract, traceable source refs, real authorized professional review, exact package binding; or
- **NOT READY / UNPUBLISHED**: missing/insufficient professional source material, incomplete Contract, or review not completed.

No developer or model may invent intervention steps, thresholds, contraindications, age boundaries, review criteria or source claims merely to make all ten families publishable.

The system implementation may still truthfully expose an unpublished definition/version where allowed by lifecycle semantics, but no such version is production-eligible for formal use.

## 6. UNKNOWN / Condition Semantics

The implementation must reuse existing Evidence/Formulation semantics where equivalent. Where a typed evaluation value is needed, it must distinguish at least the semantic states:

- KNOWN_TRUE;
- KNOWN_FALSE;
- UNKNOWN;
- DECLINED;
- NOT_COLLECTED;
- CONFLICT.

No mapping may collapse missing information into false/true. No model may infer a missing hard-gate fact.

A required UNKNOWN/missing dependency fails closed unless **both**:

1. the exact reviewed definition explicitly permits UNKNOWN for that requirement; and
2. current authoritative policy permits proceeding.

## 7. Lifecycle State Machine

Semantic states:

```text
DRAFT
  -> REVIEW
  -> APPROVED
  -> PUBLISHED
  -> RETIRED
```

Exact enum labels follow then-current repository naming conventions, but semantics are fixed.

Allowed behavior:

- DRAFT may be edited/version-prepared before approval under revision control;
- REVIEW means submitted for real professional review;
- APPROVED requires real authorized professional reviewer decision and provenance;
- PUBLISHED requires APPROVED + complete contract + exact allowed package binding in one atomic command;
- RETIRED forbids new formal use but preserves history.

Forbidden behavior:

- unreviewed → formal use;
- REVIEW but not approved → formal use;
- APPROVED but unpublished/unbound → formal use;
- PUBLISHED without valid professional approval;
- RETIRED → new formal use;
- in-place semantic rewrite of published history;
- reactivating the same retired historical version.

Material semantic change after approval/publication creates a new version.

## 8. Professional Review / Provenance

A review decision records enough immutable provenance to prove:

- who/which authenticated actor performed it;
- which authorized professional responsibility/role was used;
- exact definition id/version/revision reviewed;
- decision;
- reviewed_at;
- relevant professional source refs/version;
- before/after lifecycle revision;
- audit correlation.

`reviewed_by_role` is not a free client string. It derives from a real authorized reviewer responsibility verified server-side.

AI, RAG, a family actor, a client flag or an unauthenticated process cannot satisfy approval.

Insufficient source material or absent real reviewer leaves the definition unapproved/unpublished. No developer may fill missing professional content by assumption.

## 9. Exact Scene / Package / Definition Binding

Current known package identity is:

```text
scene = DIGITAL_USE
package = v1
```

T1602 must reconcile this with then-current Slice 11/12–15 merged runtime.

The minimal binding contract is:

```text
exact definition id
+ exact definition version
+ exact scene id/code
+ exact package version
+ publication/binding revision
```

Formal consumers may never request or resolve “latest intervention definition” as authority.

A package/version must resolve an inspectable exact definition-version set. Historical bindings remain inspectable after later versions are introduced.

Slice 16 must not modify Slice 11 node-manifest topology, route prerequisites, streams or routing ownership. A professional definition binding is not a second Scene package system.

Where current schema permits, package binding should remain inside the single professional-definition owner rather than introducing a second package truth. A separate binding relation is permitted only if T1602 proves it is the minimal necessary representation; it still belongs to the same Slice 16 owner and cannot duplicate Scene identity/topology.

## 10. Versioning / Correction / Retirement

- stable `intervention_code` may have multiple historical definition versions;
- published semantic content is immutable;
- material correction creates a new version;
- source correction records affected provenance and drives a new review/version path as required;
- retirement is a state transition, never deletion;
- retired records remain readable for historical proof;
- historical package/definition references stay valid as historical facts;
- retirement does not rewrite old Plans/Interventions/Reviews;
- Slice 16 exposes retirement/status truth only; future Phase 4 owner propagates `NEEDS_REVIEW` or equivalent when required.

## 11. Deterministic Eligibility Evaluation

Purpose:

> For one exact definition version and one authorized current Case context, decide whether the definition is currently eligible to be considered by a downstream formal Intervention consumer.

Required evaluation order:

1. authenticate actor / establish authoritative Family+Case RLS context;
2. resolve exact Case and current Problem Formulation / Evidence snapshot;
3. resolve exact definition id + version;
4. require real professional approval;
5. require published and not retired;
6. require exact Scene/package/version binding;
7. evaluate age/development scope;
8. evaluate formulation dependencies;
9. evaluate supporting evidence requirements;
10. evaluate applicable conditions;
11. evaluate exclusions / contraindications;
12. evaluate participation requirements;
13. evaluate Consent independently;
14. evaluate Compliance independently;
15. evaluate allowed-combination / conflict constraints against only authoritative available context;
16. evaluate Safety independently;
17. return typed result with revision/provenance stamps.

Every required blocker yields `allowed=false`. Infrastructure failure fails closed and returns an error, never a best-effort allow.

Eligibility is deterministic and requires no model/network AI call.

## 12. Typed Eligibility Result

The exact TypeScript shape may follow repository conventions, but must structurally represent:

- `allowed`;
- definition id;
- definition version;
- definition lifecycle/revision;
- scene id/code;
- package version;
- package/binding revision or equivalent stable stamp;
- reason codes;
- evidence refs actually considered;
- formulation version/revision considered;
- unmet formulation dependencies;
- missing evidence requirements;
- UNKNOWN / DECLINED / NOT_COLLECTED / CONFLICT conditions;
- exclusion/contraindication hits;
- age/development mismatch;
- participation requirements;
- consent blockers;
- compliance blockers;
- combination/conflict result;
- safety blockers;
- adverse/worsening signals to monitor;
- review criteria reference;
- authoritative revision stamps sufficient for future staleness revalidation;
- evaluated_at / trace correlation as repository convention permits.

The result is immutable evaluation output, not business authority. A later Phase 4 write must revalidate relevant revisions; a stale result cannot authorize a downstream write.

## 13. Combination / Conflict

Definition metadata is executable professional policy, not display copy.

The evaluator must distinguish:

- COMPATIBLE;
- INCOMPATIBLE;
- REQUIRES_SEQUENCING;
- UNKNOWN.

The comparison operates on exact definition versions.

At Slice 16 time there may be no authoritative active InterventionInstance. Therefore:

- do not create one;
- do not invent active-plan truth;
- implement the pure exact-definition compatibility evaluator and typed future-consumer seam;
- consume existing authoritative combination context only if a then-current merged owner legitimately provides it;
- UNKNOWN context fails according to the reviewed definition/policy semantics, not by guess.

## 14. Authorization / RLS / Privacy

### 14.1 Professional asset lifecycle

Create/review/approve/publish/retire are not Family/Case powers. They require the real professional/operations responsibility proven by T1601.

RLS/grants must separate professional asset mutation from family-scoped eligibility. A normal family actor must not gain professional mutation capability.

### 14.2 Family/Case eligibility

Eligibility flow must establish:

```text
authenticated actor
-> authoritative Family
-> authoritative Case
-> current Formulation/Evidence
-> deterministic eligibility
```

It must reuse the existing Authorization API and FORCE RLS conventions.

Forbidden:

- cross-family reads;
- unauthorized cross-case evidence;
- participant escalation;
- client-selected purpose elevation;
- different error details that violate current anti-enumeration policy.

Professional definitions themselves contain no family-sensitive narrative.

## 15. Consent / Compliance / Safety Independence

Authorization, Consent, Compliance and Safety are four independent gates.

No implication is legal:

- Safety PASS does not imply Consent PASS;
- Consent PASS does not imply Compliance PASS;
- Authorization does not equal Compliance;
- professional approval does not override Safety;
- publication does not override any family-specific control plane.

Any required gate BLOCK/UNKNOWN according to its authoritative owner yields `allowed=false`.

Slice 16 does not persist a duplicate copy of any control-plane truth.

## 16. Idempotency

Lifecycle commands requiring shared idempotency:

- create definition/version;
- submit review;
- approve;
- publish;
- retire.

Canonical rule:

```text
same key + same semantic payload => replay exact business result
same key + different semantic payload => conflict
```

Reuse the existing `idempotency_keys` owner and canonical payload hashing conventions. Do not create a second command ledger.

Pure eligibility evaluation is side-effect-free and need not consume an idempotency slot unless then-current API convention requires one for a wrapper request; it must never create professional or family business truth.

## 17. Concurrency / Revision Control

Lifecycle commands use explicit expected revision/CAS or equivalent repository convention.

Required race behavior:

- two reviewers on same expected revision → at most one authoritative transition wins; stale writer conflicts;
- publish vs retire → cannot end as simultaneously active-for-new-use and retired;
- two publishes for same package/intervention binding → one authoritative winner;
- edit vs publish → stale edit or publish conflicts; no silent overwrite;
- stale version update → rejected;
- new semantic version creation → uniqueness enforced.

No last-write-wins semantics for professional state.

## 18. Atomicity / Transaction Semantics

A lifecycle command that changes business truth must atomically include as applicable:

- definition/version write;
- lifecycle transition;
- package binding;
- reviewer provenance;
- audit/domain event;
- idempotency completion.

Forbidden partial states include:

- published but audit missing;
- published but binding missing;
- review saved but lifecycle not changed;
- retired but audit missing;
- successful idempotency settlement when business state rolled back.

When composing existing owners, use the existing caller-owned same-`PoolClient` transaction seam. No nested transaction and no second database checkout may create split authority.

Fault-injection tests must prove rollback at boundaries.

## 19. Observability / Audit

At minimum record or emit existing audit/event equivalents for:

- definition created;
- review submitted;
- approved;
- publication attempted;
- published;
- retired;
- version superseded;
- eligibility evaluated;
- eligibility blocked.

**Audit/observability split**: successful professional-truth mutations use the authoritative business audit/event path in the same transaction as the state change. A denied/failed `publication attempted` or eligibility-blocked attempt may use the existing bounded request/observability channel after the final outcome is known, but it is non-authoritative telemetry and MUST NOT claim a lifecycle transition or successful business state. No separate professional truth ledger is created.

Audit information must include, where applicable:

- actor;
- definition id/version;
- command/reason code;
- exact Scene/package;
- before/after revision;
- timestamp;
- reviewer/professional provenance;
- source/provenance reference;
- trace/request correlation.

Family eligibility audit must minimize sensitive payloads: record IDs/reason codes/revision stamps, not unnecessary family narrative.

## 20. Failure Semantics

All failures are fail-closed.

| Failure | Required semantic outcome |
|---|---|
| definition not found | not allowed / domain-not-found semantics without unauthorized leakage |
| unreviewed | unavailable |
| unapproved | unavailable |
| unpublished | unavailable |
| retired | unavailable for new use |
| wrong package | not allowed |
| stale definition/package/formulation/control-plane revision | conflict/re-evaluate; not authority |
| invalid lifecycle transition | deterministic conflict/validation error |
| unauthorized reviewer | denied; zero lifecycle mutation |
| wrong family/case/actor | existing Authorization/anti-enumeration semantics |
| missing formulation | not allowed |
| missing evidence | not allowed |
| UNKNOWN required condition | not allowed unless explicit approved exception + policy |
| age mismatch | not allowed |
| contraindication | not allowed |
| Consent blocked/revoked | not allowed |
| Compliance blocked/unresolved | not allowed |
| Safety hold/block | not allowed |
| combination conflict | not allowed for conflicting combination |
| infrastructure error | error; never best-effort allow |
| transaction fault | full rollback; no successful idempotency result |

## 21. AI / RAG Boundary

Static guard + tests must enforce:

- AI cannot create authoritative definition truth;
- AI cannot approve;
- AI cannot publish;
- AI cannot retire;
- AI cannot override age/development scope;
- AI cannot override exclusion/contraindication;
- AI cannot override Authorization;
- AI cannot override Consent;
- AI cannot override Compliance;
- AI cannot override Safety;
- RAG cannot promote unpublished/retired content;
- RAG cannot replace professional source provenance;
- no real model/network call is required for lifecycle or eligibility tests.

Candidate drafting/explanation may exist in a future Slice but is not implemented here.

## 22. Migration Plan

No migration number is reserved by this Plan.

T1601/T1602 must re-read the then-current migration head immediately before implementation.

Decision rule:

```text
IF an existing merged authoritative owner can satisfy the contract without schema change:
    NO MIGRATION
ELSE:
    allocate only the then-next safe migration number
    create one reviewed forward migration
```

Never:

- edit a historical migration;
- reuse an occupied number;
- pre-reserve `012` or any other number now;
- use `drizzle-kit push` for production;
- create duplicate Case/Evidence/Consent/Compliance/Safety/Scene tables.

At the current planning baseline, no `intervention_definitions` owner exists, so a migration is likely, but implementation must still revalidate the then-current schema first.

## 23. Expected Module / File Strategy

T1602 freezes the exact implementation paths after inspecting then-current merged Slice 12–15 and repository conventions. The developer does not redesign ownership; it chooses one path from this contract and records it before edits.

Expected areas if the current architecture remains stable:

- `packages/domain/**` or a single narrow existing professional-domain owner for definition lifecycle/repository semantics;
- `packages/scenes/digital-use/**` only for the exact Digital Use package projection/binding and deterministic Scene-specific eligibility inputs; Slice 11 manifest/routing files remain read-only unless only type-safe imports are needed;
- `db/schema/**`, `db/migrations/**`, `db/rls/**` only if T1602 proves schema/RLS changes necessary;
- `apps/server/api/**` only for a narrow internal/application adapter consistent with current server composition; no generic admin CMS/API;
- `packages/contracts/**` / generated OpenAPI only if an actual server surface is required by repository convention;
- `tests/domain/**`, `tests/scenes/digital-use/**`, `tests/db/**`, `tests/integration/**`, `tests/architecture/**`;
- `scripts/guard-static.mjs` for Slice 16 scope/authority guards.

Forbidden implementation paths/concepts are enforced semantically, not by inventing an alternative platform.

## 24. Testing Contract

### 24.1 Domain tests

Must cover:

- lifecycle legal/illegal transitions;
- required-field completeness;
- real-review provenance semantics;
- version immutability/new version;
- retirement;
- exact package binding;
- eligibility order;
- UNKNOWN/DECLINED/NOT_COLLECTED/CONFLICT;
- age/development scope;
- formulation dependencies;
- evidence requirements;
- exclusions/contraindications;
- allowed combinations/conflicts;
- typed result and staleness stamps.

### 24.2 Integration / DB tests

Must cover:

- schema/constraint/repository behavior;
- RLS/grants;
- professional lifecycle authorization;
- wrong family/case/actor;
- cross-family/cross-case Evidence;
- Consent;
- Compliance;
- Safety;
- shared idempotency replay/mismatch;
- concurrency;
- atomic rollback;
- exact package binding;
- migration fresh install and upgrade;
- audit/event persistence.

### 24.3 Negative tests

Must prove:

- unreviewed/unpublished/retired cannot be used;
- wrong version/package cannot be used;
- AI/model assertion cannot override truth;
- RAG/unpublished retrieval cannot promote eligibility;
- cross-family/cross-case access fails;
- no InterventionInstance/Goal/Plan/Task/Checkin/Review/Outcome/Schedule/Notification truth is created;
- no generic CMS/rule/workflow/intervention engine;
- no second professional truth;
- no second control-plane/Scene truth.

### 24.4 Fault / rollback tests

Inject failure after:

- definition/version write;
- review write;
- lifecycle transition;
- package binding;
- audit write boundary;
- before idempotency completion.

Assert complete rollback and no misleading success/audit.

## 25. Exact-Head Verification Contract

On the final implementation head, the development AI must prove at least:

```text
typecheck PASS
guard/static PASS
focused Slice 16 domain tests PASS
Slice 16 DB/integration tests PASS
RLS/grants verification PASS
migration fresh-install + upgrade verification PASS
OpenAPI/contracts PASS (if surface exists)
AI/RAG/Phase4 scope guard PASS
relevant historical owner regression PASS
full relevant regression PASS
exact-head branch/base/behind evidence PASS
```

Tests must run against the exact reviewed head. A test result from an earlier head cannot be used as final evidence.

## 26. Requirement Traceability

| FR | Plan owner | Primary task(s) | Verification |
|---|---|---|---|
| FR-001 | §2/§3/§5 | T1602,T1604 | single-owner schema/import/static guard |
| FR-002 | §5/§10 | T1603,T1604 | schema/domain contract tests |
| FR-003 | §9 | T1608,T1610 | exact-version negative test |
| FR-004 | §5 | T1603,T1607 | completeness + publish tests |
| FR-005 | §5 | T1603,T1611 | family-data separation tests |
| FR-006 | §8/§10 | T1609 | provenance/version correction tests |
| FR-007 | §5 | T1603,T1620 | method-name-only publish rejection |
| FR-008 | §7 | T1605,T1607 | unreviewed blocked |
| FR-009 | §7 | T1605,T1607 | unapproved blocked |
| FR-010 | §7/§9 | T1607,T1608 | approved-unpublished blocked |
| FR-011 | §7/§10 | T1605,T1607 | retired blocked |
| FR-012 | §8 | T1606,T1607 | reviewer provenance tests |
| FR-013 | §8/§21 | T1606,T1620 | fake AI/family reviewer rejection |
| FR-014 | §7/§9 | T1607,T1608 | atomic publish preconditions |
| FR-015 | §10 | T1605,T1609 | retirement history test |
| FR-016 | §7/§10 | T1605,T1607 | same-version reactivation rejection |
| FR-017 | §10 | T1605,T1609 | material change=new version |
| FR-018 | §10 | T1605 | published immutability |
| FR-019 | §9 | T1608 | no floating latest |
| FR-020 | §9 | T1608,T1621 | manifest/topology unchanged guard |
| FR-021 | §9/§10 | T1608,T1609 | historical binding readable |
| FR-022 | §11 | T1610,T1611 | deterministic evaluator tests |
| FR-023 | §11–§15 | T1610,T1612 | authoritative snapshot integration |
| FR-024 | §2/§11 | T1620,T1621 | Phase 4 zero-write/static guard |
| FR-025 | §6/§11 | T1611 | UNKNOWN fail-closed |
| FR-026 | §11 | T1611 | missing Evidence blocked |
| FR-027 | §11 | T1611 | exclusion blocked |
| FR-028 | §11 | T1611 | age/development blocked |
| FR-029 | §11/§15 | T1612 | participation/Consent blocked |
| FR-030 | §13 | T1613 | conflict evaluator |
| FR-031 | §15 | T1612 | Compliance block |
| FR-032 | §15 | T1612 | Safety block |
| FR-033 | §12 | T1614 | typed result contract |
| FR-034 | §12 | T1614,T1619 | stale revision revalidation |
| FR-035 | §14 | T1606,T1618 | family actor cannot mutate professional asset |
| FR-036 | §14 | T1612,T1619 | wrong family/case/actor |
| FR-037 | §14 | T1610,T1619 | cross-family evidence rejected |
| FR-038 | §14 | T1619 | anti-enumeration assertions |
| FR-039 | §16 | T1607,T1616 | shared idempotent replay |
| FR-040 | §16 | T1607,T1616 | same key/different payload conflict |
| FR-041 | §17 | T1605,T1616 | concurrency/CAS tests |
| FR-042 | §18 | T1607,T1616 | transaction atomicity |
| FR-043 | §18 | T1616,T1619 | fault rollback |
| FR-044 | §15 | T1612,T1621 | independent owner/static guard |
| FR-045 | §21 | T1620,T1621 | RAG cannot own eligibility |
| FR-046 | §21 | T1620 | model override negative |
| FR-047 | §21/§24 | T1617,T1620 | no network/model test |
| FR-048 | §3/§14/§15 | T1602,T1621 | duplicate-truth guard |
| FR-049 | §2 | T1620,T1621 | Phase 4 zero truth |
| FR-050 | §2/§21 | T1620,T1621 | generic-platform guard |
| FR-051 | §4/§7/§8 | T1601,T1606,T1607 | real review+publish readiness evidence |
| FR-052 | §4/§8 | T1601,T1606,T1609,T1620 | truthful NOT READY tests/report |

Functional Requirement Coverage planned: **52/52**.

## 27. Acceptance Scenario Traceability

| Acceptance | Primary task(s) | Verification |
|---|---|---|
| AS-01 | T1603,T1606,T1607,T1617,T1618 | definition completeness / real review / publish preconditions |
| AS-02 | T1603,T1606,T1607,T1617,T1618 | definition completeness / real review / publish preconditions |
| AS-03 | T1603,T1606,T1607,T1617,T1618 | definition completeness / real review / publish preconditions |
| AS-04 | T1605,T1606,T1607,T1617,T1618 | review/publish/retire lifecycle negatives |
| AS-05 | T1605,T1606,T1607,T1617,T1618 | review/publish/retire lifecycle negatives |
| AS-06 | T1605,T1606,T1607,T1617,T1618 | review/publish/retire lifecycle negatives |
| AS-07 | T1605,T1606,T1607,T1617,T1618 | review/publish/retire lifecycle negatives |
| AS-08 | T1605,T1606,T1607,T1617,T1618 | review/publish/retire lifecycle negatives |
| AS-09 | T1605,T1606,T1607,T1617,T1618 | review/publish/retire lifecycle negatives |
| AS-10 | T1605,T1609,T1617,T1618 | immutability / new version / source correction |
| AS-11 | T1605,T1609,T1617,T1618 | immutability / new version / source correction |
| AS-12 | T1605,T1609,T1617,T1618 | immutability / new version / source correction |
| AS-13 | T1608,T1618,T1621 | exact package / wrong-stale package / topology isolation |
| AS-14 | T1608,T1618,T1621 | exact package / wrong-stale package / topology isolation |
| AS-15 | T1608,T1618,T1621 | exact package / wrong-stale package / topology isolation |
| AS-16 | T1608,T1618,T1621 | exact package / wrong-stale package / topology isolation |
| AS-17 | T1610,T1612,T1618,T1619 | Authorization/RLS/family/case/Evidence isolation |
| AS-18 | T1610,T1612,T1618,T1619 | Authorization/RLS/family/case/Evidence isolation |
| AS-19 | T1610,T1612,T1618,T1619 | Authorization/RLS/family/case/Evidence isolation |
| AS-20 | T1610,T1612,T1618,T1619 | Authorization/RLS/family/case/Evidence isolation |
| AS-21 | T1610,T1612,T1618,T1619 | Authorization/RLS/family/case/Evidence isolation |
| AS-22 | T1610,T1612,T1618,T1619 | Authorization/RLS/family/case/Evidence isolation |
| AS-23 | T1610,T1611,T1614,T1617,T1619 | Formulation/Evidence/UNKNOWN/staleness |
| AS-24 | T1610,T1611,T1614,T1617,T1619 | Formulation/Evidence/UNKNOWN/staleness |
| AS-25 | T1610,T1611,T1614,T1617,T1619 | Formulation/Evidence/UNKNOWN/staleness |
| AS-26 | T1610,T1611,T1614,T1617,T1619 | Formulation/Evidence/UNKNOWN/staleness |
| AS-27 | T1610,T1611,T1614,T1617,T1619 | Formulation/Evidence/UNKNOWN/staleness |
| AS-28 | T1610,T1611,T1614,T1617,T1619 | Formulation/Evidence/UNKNOWN/staleness |
| AS-29 | T1611,T1617 | age/exclusion/reassess classification without action |
| AS-30 | T1611,T1617 | age/exclusion/reassess classification without action |
| AS-31 | T1611,T1617 | age/exclusion/reassess classification without action |
| AS-32 | T1613,T1617 | combination compatibility/conflict |
| AS-33 | T1613,T1617 | combination compatibility/conflict |
| AS-34 | T1612,T1619 | Consent/Compliance/Safety independent gates |
| AS-35 | T1612,T1619 | Consent/Compliance/Safety independent gates |
| AS-36 | T1612,T1619 | Consent/Compliance/Safety independent gates |
| AS-37 | T1612,T1619 | Consent/Compliance/Safety independent gates |
| AS-38 | T1612,T1619 | Consent/Compliance/Safety independent gates |
| AS-39 | T1612,T1619 | Consent/Compliance/Safety independent gates |
| AS-40 | T1612,T1619 | Consent/Compliance/Safety independent gates |
| AS-41 | T1607,T1616,T1618,T1619 | idempotency/concurrency/atomic rollback |
| AS-42 | T1607,T1616,T1618,T1619 | idempotency/concurrency/atomic rollback |
| AS-43 | T1607,T1616,T1618,T1619 | idempotency/concurrency/atomic rollback |
| AS-44 | T1607,T1616,T1618,T1619 | idempotency/concurrency/atomic rollback |
| AS-45 | T1607,T1616,T1618,T1619 | idempotency/concurrency/atomic rollback |
| AS-46 | T1607,T1616,T1618,T1619 | idempotency/concurrency/atomic rollback |
| AS-47 | T1620,T1621 | AI/RAG no authority and no model dependency |
| AS-48 | T1620,T1621 | AI/RAG no authority and no model dependency |
| AS-49 | T1620,T1621 | AI/RAG no authority and no model dependency |
| AS-50 | T1620,T1621 | AI/RAG no authority and no model dependency |
| AS-51 | T1620,T1621 | AI/RAG no authority and no model dependency |
| AS-52 | T1605,T1608,T1620,T1621 | historical preservation / Phase boundary / no generic engine |
| AS-53 | T1605,T1608,T1620,T1621 | historical preservation / Phase boundary / no generic engine |
| AS-54 | T1605,T1608,T1620,T1621 | historical preservation / Phase boundary / no generic engine |
| AS-55 | T1605,T1608,T1620,T1621 | historical preservation / Phase boundary / no generic engine |
| AS-56 | T1605,T1608,T1620,T1621 | historical preservation / Phase boundary / no generic engine |
| AS-57 | T1605,T1608,T1620,T1621 | historical preservation / Phase boundary / no generic engine |
| AS-58 | T1605,T1608,T1620,T1621 | historical preservation / Phase boundary / no generic engine |
| AS-59 | T1601,T1606,T1609,T1620 | real reviewer/source truthfulness |
| AS-60 | T1601,T1606,T1609,T1620 | real reviewer/source truthfulness |

Acceptance Scenario Coverage planned: **60/60**.

## 28. Negative Scope Traceability

| Negative Scope | Primary task(s) | Mechanical proof |
|---|---|---|
| NS-01 | T1620,T1621,T1623 | static + DB/file scope inventory proves no Phase 4 business truth/jobs |
| NS-02 | T1620,T1621,T1623 | static + DB/file scope inventory proves no Phase 4 business truth/jobs |
| NS-03 | T1620,T1621,T1623 | static + DB/file scope inventory proves no Phase 4 business truth/jobs |
| NS-04 | T1620,T1621,T1623 | static + DB/file scope inventory proves no Phase 4 business truth/jobs |
| NS-05 | T1620,T1621,T1623 | static + DB/file scope inventory proves no Phase 4 business truth/jobs |
| NS-06 | T1620,T1621,T1623 | static + DB/file scope inventory proves no Phase 4 business truth/jobs |
| NS-07 | T1620,T1621,T1623 | file/import/schema inventory proves no knowledge/RAG/vector/Context/AI/Jev/Promptfoo/A4003/execution-AI implementation |
| NS-08 | T1620,T1621,T1623 | file/import/schema inventory proves no knowledge/RAG/vector/Context/AI/Jev/Promptfoo/A4003/execution-AI implementation |
| NS-09 | T1620,T1621,T1623 | file/import/schema inventory proves no knowledge/RAG/vector/Context/AI/Jev/Promptfoo/A4003/execution-AI implementation |
| NS-10 | T1620,T1621,T1623 | file/import/schema inventory proves no knowledge/RAG/vector/Context/AI/Jev/Promptfoo/A4003/execution-AI implementation |
| NS-11 | T1620,T1621,T1623 | file/import/schema inventory proves no knowledge/RAG/vector/Context/AI/Jev/Promptfoo/A4003/execution-AI implementation |
| NS-12 | T1620,T1621,T1623 | file/import/schema inventory proves no knowledge/RAG/vector/Context/AI/Jev/Promptfoo/A4003/execution-AI implementation |
| NS-13 | T1620,T1621,T1623 | file/import/schema inventory proves no knowledge/RAG/vector/Context/AI/Jev/Promptfoo/A4003/execution-AI implementation |
| NS-14 | T1620,T1621,T1623 | file/import/schema inventory proves no knowledge/RAG/vector/Context/AI/Jev/Promptfoo/A4003/execution-AI implementation |
| NS-15 | T1620,T1621,T1623 | file/import/schema inventory proves no knowledge/RAG/vector/Context/AI/Jev/Promptfoo/A4003/execution-AI implementation |
| NS-16 | T1620,T1621,T1623 | file/import/schema inventory proves no knowledge/RAG/vector/Context/AI/Jev/Promptfoo/A4003/execution-AI implementation |
| NS-17 | T1601,T1602,T1620,T1621 | owner/static review proves no generic CMS/rules/workflow/intervention engine/new staff-RBAC platform |
| NS-18 | T1601,T1602,T1620,T1621 | owner/static review proves no generic CMS/rules/workflow/intervention engine/new staff-RBAC platform |
| NS-19 | T1601,T1602,T1620,T1621 | owner/static review proves no generic CMS/rules/workflow/intervention engine/new staff-RBAC platform |
| NS-20 | T1601,T1602,T1620,T1621 | owner/static review proves no generic CMS/rules/workflow/intervention engine/new staff-RBAC platform |
| NS-21 | T1602,T1612,T1621 | single-owner/control-plane guard |
| NS-22 | T1602,T1608,T1621 | Slice 11 manifest/routing single-truth guard |
| NS-23 | T1603,T1609,T1620 | definition schema/content separation tests |
| NS-24 | T1608,T1620 | exact-version negative test; no latest authority |
| NS-25 | T1620,T1621,T1623 | Phase 4 leakage scope guard and changed-file inventory |

Negative Scope Coverage planned: **25/25**.

## 29. Planning Decisions Frozen by Plan AI 2

No new product decision is introduced. The planning-only implementation choices are:

1. use the existing owners/seams rather than duplicate truth;
2. use one authoritative professional-definition owner;
3. implement lifecycle with optimistic revision/CAS and shared idempotency;
4. keep package binding exact and historical;
5. make eligibility deterministic, typed and side-effect-free;
6. require a real reviewer authority at T1601; absent authority blocks development;
7. do not preallocate a migration;
8. do not build Phase 4 or AI/RAG infrastructure.

```text
Open Product Decisions: 0
Open Planning Decisions: 0
```

## 30. Stop Boundary

After Plan / Checklist / Tasks / Audit 1 freeze, Plan AI 2 stops.

Forbidden in this planning branch:

- production schema/migration implementation;
- runtime code;
- implementation tests;
- implementation PR;
- Audit 2;
- merge to main.

