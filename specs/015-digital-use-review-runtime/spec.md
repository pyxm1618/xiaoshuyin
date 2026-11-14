# Feature Specification: Digital Use Review Runtime

Repository: pyxm1618/xiaoshuyin

Slice: 15

Identity: Digital Use Review Runtime

Status: SPECIFY / CLARIFY FINAL PASS — FROZEN

Plan AI 1 only. This artifact does not authorize Plan, Checklist, Tasks, implementation, migration, API implementation, test implementation, PR, merge, or Audit 2.

---

## 0. Plan AI 1 Stop Boundary

This specification performs only:

Selection → Specify → Clarify → Frozen Spec.

It does not create or modify plan.md, checklist.md, tasks.md, production code, tests, migrations, CI, runtime APIs, database schema, or upstream frozen authority.

Any later implementation must consume this Frozen Spec without reopening product meaning unless formal authority has changed.

---

## 1. Repository Baseline and Slice Identity Collision Gate

### 1.1 Remote baseline

The repository was re-read directly from the authenticated GitHub remote immediately before Slice 15 branch creation.

Execution context is remote-only. There is no local checkout in this run, so a local current branch and local working-tree status do not exist and are not fabricated.

Baseline:

- Repository: pyxm1618/xiaoshuyin
- Remote baseline ref: main
- Remote HEAD / origin/main equivalent: 7ec51889337d547766412a2ce954cff352e6d57b
- Baseline commit: Merge pull request #32 from pyxm1618/fix/slice8-same-transaction-seam
- Ahead of remote main at baseline: 0
- Behind remote main at baseline: 0
- Local working tree: N/A — no local checkout; remote refs/blobs were read directly
- Open pull requests at final pre-creation check: 0

The chat-supplied SHA was not trusted as authority; the remote was re-read and independently resolved to the same SHA.

### 1.2 Slice 15 collision search

The following were rechecked before branch creation:

- branches containing 015;
- branches containing slice15;
- default-branch repository content matching 015-*;
- open and historical PR searches for Slice 15 / 015-digital-use-review-runtime;
- historical governance/remediation identities relevant to the prior Consent numbering incident.

Result:

- no spec/015-* branch existed;
- no plan/015-* branch existed;
- no feat/015-* branch existed;
- no specs/015-* authority existed on main;
- no Slice 15 PR existed;
- historical PR #15 is a pull-request number for Slice 3, not Slice 15 identity;
- historical references to “phase 15” are not Slice 15 identity;
- Consent remediation remains outside the formal Slice 15 namespace.

Identity Collision Gate: PASS.

---

## 2. Authority Gate

### 2.1 Formal authority

All four formal Docs were re-read from current main. Their current blobs are:

- Docs/总产品需求.md
  - blob 67724000cb9bb81c40489c04db28d899bd1df74c
- Docs/V1产品需求.md
  - blob 918d8574ad88773fe371985fd5c38080c944fec9
- Docs/总体技术架构.md
  - blob 9b08371edc976fa281469dfee8dc19962452e3b0
- Docs/V1技术设计.md
  - blob e7285fd8363c8a76ab4fd96a305037b5c675f961

Authority order remains:

总产品需求
→ V1产品需求
→ 总体技术架构
→ V1技术设计
→ Slice Frozen Spec.

Product semantic authority remains Docs/V1产品需求.md.

Implementation boundary and phase-order authority remain Docs/V1技术设计.md.

No Slice specification may silently amend either.

### 2.2 Upstream Slice authority

The following upstream authorities were re-read:

- specs/008-problem-formulation-core
- specs/009-safety-hold-control-foundation
- specs/010-compliance-feature-policy-foundation
- specs/011-digital-use-node-manifest-routing-foundation
- Slice 12 — Digital Use Assessment Runtime frozen/planning authority
- Slice 13 — Digital Use Family Alliance Runtime frozen/planning authority
- Slice 14 — Digital Use Phone Use Contract Runtime frozen/planning authority

Planning truth and runtime truth are kept separate.

Current runtime truth on main includes the merged Slice 11 node-manifest / deterministic-routing foundation and the earlier control-plane owners. Slice 12, Slice 13, and Slice 14 currently have frozen Spec/Plan artifacts but no authoritative merged runtime and therefore are not treated as production truth.

### 2.3 Relevant upstream frozen artifact identities

Slice 12 planning branch:
- plan/012-digital-use-assessment-runtime
- Frozen Spec blob e0ed342dc144fedf5b516b5295a23cbcc31722bc
- Plan blob 269c2c5dc30e63a40e1fb32c8d5c9c4ea1db8238
- Audit 1: FINAL PASS
- Checklist: 318 PASS / 0 FAIL
- Implement Gate: BLOCKED at planning freeze

Slice 13 planning branch:
- plan/013-digital-use-family-alliance-runtime
- Frozen Spec blob c3e9bf9aa9296e54c8faec0ec83cc15a2d75289b
- Plan blob 3f6f2ea0caed639316cb6bc8f22006f609c21115
- Audit 1: FINAL PASS
- Open Product Decisions: 0
- Scope Drift: 0
- Implement Gate: BLOCKED at planning freeze

Slice 14 planning branch:
- plan/014-digital-use-phone-use-contract-runtime
- Frozen Spec blob e21d5948b99fb96b6f28452304cc2afc1c61ba32
- Plan blob 7939683d511cc4510520404065aafae4c330e7b3
- Audit 1: FINAL PASS
- Checklist: 410 PASS / 0 FAIL / 0 N/A
- Open Product Decisions: 0
- Scope Drift: 0
- Implement Gate: BLOCKED

Authority Gate: PASS.

---

## 3. Formal Phase Order

Docs/V1技术设计.md §38 freezes Phase 2 in the following relevant order:

1. Digital Use Scene package;
2. single node-manifest.ts;
3. deterministic routing.ts;
4. canonical product snapshot / completeness and routing CI;
5. A1001–A2010 Assessment;
6. FAMILY_ALLIANCE A3000–A3113 actual canonical nodes;
7. PHONE_USE_CONTRACT A4001–A4012;
8. A5001 / A5002;
9. Digital Use fidelity tests.

The same authority then places:

Phase 3:
- Professional Knowledge;
- RAG;
- AI Task Runtime;
- model execution;
- AI support / roleplay runtime.

Phase 4:
- Goal;
- InterventionInstance;
- Plan;
- Task;
- Checkin;
- Common Core Review;
- Outcome;
- Follow-up Schedule;
- pg-boss;
- Notification Adapter.

The Phase 2 completion condition is explicit:

The original Digital Use flow must be able to run through deterministic test fixtures without a real model.

Therefore A5001/A5002 cannot require Phase 3 AI or Phase 4 Common Core Review/Schedule infrastructure in order for Phase 2 to complete.

---

## 4. Selection Gate

### 4.1 Candidate comparison

| Candidate | Phase authority | Current fit | Decision |
|---|---|---|---|
| A. A5001 / A5002 Digital Use Review Runtime | Explicit final Digital Use block in Phase 2 | Both nodes exist in merged Slice 11 Manifest; both solution streams are already frozen by Slice 13/14 planning authority | SELECTED |
| B. Phase 3 Professional Knowledge / AI Foundation | Phase 3 | Begins only after the deterministic Digital Use Scene is complete | DEFER |
| C. Common Core Goal / Intervention Core | Phase 4 | Pulling it forward would reverse the approved phase order and risk rewriting Scene semantics | DEFER |
| D. Plan / Task / Checkin / Common Core Review / Outcome Runtime | Phase 4 | Explicitly downstream; cannot own A5001/A5002 Phase 2 completion | DEFER |
| E. Follow-up / Schedule / Notification | Phase 4 | SCHEDULED entry eligibility does not authorize scheduler/job/notification implementation | DEFER |
| F. Any higher-priority capability discovered in current Docs | No capability exists between A4001–A4012 and A5001/A5002 in §38 | No higher-priority Phase 2 block found | NONE |

### 4.2 Q1 — Is A5001/A5002 the final explicit Phase 2 Digital Use runtime block?

YES.

Evidence chain:

- V1 Product Requirements V1-D27 requires A5001 to separately evaluate Family Alliance / target-list implementation effect.
- V1-D28 requires A5002 to separately evaluate phone-use Contract effect.
- V1-D29 prohibits collapsing the two into one generic review.
- V1 Technical Design §38 places A5001/A5002 after A3000–A3113 and A4001–A4012 and before Phase 3.
- merged Slice 11 Manifest contains A5001 and A5002 as the final two canonical Digital Use nodes.

Q1: PASS.

### 4.3 Q2 — One Slice or two?

A5001 and A5002 SHALL be delivered under one Slice 15 identity while preserving two non-interchangeable semantic scopes.

Why one Slice:

- both are the same final Phase 2 capability class: bounded Digital Use Scene effect evaluation;
- both consume the same Manifest/routing owner;
- both consume the same Scene State / Scene Artifact owner;
- both use the same Authorization / Consent / Compliance / Safety / idempotency / audit control plane;
- both expose the same entry-mode pattern: USER_INITIATED and SCHEDULED;
- both terminate with REVIEW_COMPLETE at the Scene-node level;
- a two-Slice split would duplicate persistence/API/control-plane integration without creating meaningful independent infrastructure.

Why this does NOT merge their semantics:

- A5001 has stream FAMILY_ALLIANCE_REVIEW;
- A5002 has stream PHONE_USE_CONTRACT_REVIEW;
- each binds a different upstream subject;
- each has a different artifact schema discriminator;
- each has different evidence sources and effect-evaluation dimensions;
- one cannot satisfy or overwrite the other;
- completion of one never implies completion of the other.

Independent deployability:

- A5001 may be independently enabled once its own runtime dependencies are available.
- A5002 may be independently enabled once its own runtime dependencies are available.
- A5001 does not wait for Slice 14 as a business dependency.
- A5002 does not wait for Slice 13 as a business dependency.
- the combined Slice 15 may be developed in stream-bounded increments, but Slice 15 cannot be declared complete until both scopes are implemented and reconciled.

Q2: PASS.

### 4.4 Selected Slice

Selected identity:

Slice 15 — Digital Use Review Runtime

Selected scope:

- A5001 FAMILY_ALLIANCE_REVIEW
- A5002 PHONE_USE_CONTRACT_REVIEW

Selection Gate: PASS.

---

## 5. Why Now

Slice 11 already provides the canonical machine topology and explicitly represents A5001/A5002.

Slice 12 freezes the first real Scene State / Scene Artifact runtime owner.

Slice 13 freezes the Family Alliance stream and its target-list / feasibility / Scene-progress semantics.

Slice 14 freezes the Phone Use Contract stream and Contract-version / execution-support semantics.

The next formal Phase 2 responsibility is therefore the two stream-specific effect-evaluation nodes.

Starting Phase 3 or Phase 4 before specifying this boundary would leave Phase 2 semantically incomplete and would create an unacceptable risk that generic Common Core Review infrastructure retroactively rewrites Digital Use Scene meaning.

---

## 6. Goals

Slice 15 SHALL define a future runtime that:

1. implements legal A5001 entry and bounded Family Alliance / target-list effect evaluation;
2. implements legal A5002 entry and bounded phone-use Contract effect evaluation;
3. preserves A5001 and A5002 as separate node identities and separate semantic scopes;
4. reuses Slice 11 as the only node/routing authority;
5. reuses Slice 12 Scene State / Scene Artifact runtime rather than creating a second Scene state system;
6. reuses Evidence Core for substantive family observations;
7. consumes Slice 13 target-list / target-item / feasibility / Scene-progress truth for A5001;
8. consumes Slice 14 Contract version / execution-support truth for A5002;
9. supports valid USER_INITIATED entry without requiring Phase 4 scheduling;
10. represents SCHEDULED as an entry capability, not a scheduler implementation;
11. preserves correction, re-entry and historical evaluations without destructive overwrite;
12. enforces Authorization, Consent, Compliance and Safety independently;
13. reuses existing idempotency/audit infrastructure;
14. remains deterministically testable without real AI;
15. reaches Scene-node REVIEW_COMPLETE without creating Common Core Review, Outcome, Plan, Task, Checkin, Schedule or Notification truth.

---

## 7. Non-Goals / Out of Scope

Slice 15 does NOT implement or own:

- generic Review framework;
- generic Review entity;
- generic reviews table;
- Common Core CASE_OVERALL Review;
- Goal;
- InterventionInstance;
- Plan or Plan Version;
- Task;
- Checkin;
- Outcome;
- Closure;
- Maintenance state transition;
- generic recommendation engine;
- generic metrics/scoring platform;
- generic questionnaire engine;
- form builder;
- workflow engine;
- rules engine / DSL;
- XState;
- CQRS;
- event sourcing;
- microservices;
- AI evaluator;
- AI decision authority;
- RAG;
- vector database;
- Professional Knowledge runtime;
- Follow-up Schedule;
- scheduler / cron;
- pg-boss job creation;
- Notification dispatch;
- delivery/read truth;
- second routing table;
- second node registry;
- second Scene state owner;
- second Evidence owner;
- second Consent owner;
- second Compliance owner;
- second Safety owner;
- second Authorization/RBAC system;
- second idempotency store;
- second audit system;
- new Digital Use solution stream;
- modification of Docs;
- modification of Slice 8–14 frozen semantics.

---

## 8. Phase 2 Scene Review vs Phase 4 Common Core Review

### 8.1 Q3 — Relationship

A5001/A5002 are Scene-local effect-evaluation nodes.

Phase 4 Review is a Common Core domain truth.

They are related by future projection/consumption, not identity.

The V1 Technical Design contains final-model fields for Review and maps A5001/A5002 to distinct review_scope values, but §38 explicitly schedules Common Core Review implementation in Phase 4 while A5001/A5002 must already complete Phase 2.

The only authority-consistent interpretation is:

- Phase 2 captures the canonical Digital Use effect-evaluation interaction and its source/provenance as bounded Scene artifacts;
- Phase 2 marks A5001/A5002 Scene-node completion;
- Phase 4 may later create formal Common Core Review truth that references these Scene artifacts/evidence as sources;
- Phase 4 must not retroactively overwrite or reinterpret the preserved Scene history;
- Slice 15 must not dual-write a future Review row.

### 8.2 Scene phase label is not Common Core Review ownership

Slice 11 Manifest sets both A5001 and A5002 phase = REVIEW.

That label classifies their canonical Scene position.

It does NOT authorize Slice 15 to:

- create the Common Core Review aggregate;
- transition or own Case phase truth independently;
- create CASE_OVERALL review;
- assign Common Core next_action;
- create Outcome.

Any Common Core Case phase transition remains owned by the existing/future Common Core lifecycle authority.

### 8.3 Q4 — Is bounded Scene-local review runtime allowed before Phase 4?

YES.

It is required by the combination of:

- Phase 2 containing A5001/A5002;
- Phase 2 deterministic-completion requirement;
- Phase 4 separately owning generic Review.

The bounded runtime may persist only Scene-local evaluation artifacts and Scene-node state/provenance.

It must not create future Common Core Review truth.

Phase 2 / Phase 4 Review Boundary: RESOLVED.

---

## 9. Ownership / Source-of-Truth Map

| Concern | Owner | Slice 15 may | Slice 15 must not |
|---|---|---|---|
| Product semantics | Docs/V1产品需求.md | project exact A5001/A5002 meaning | rewrite or simplify product flow |
| V1 implementation order | Docs/V1技术设计.md | obey Phase 2 boundary | pull Phase 3/4 owners forward |
| Node identity | Slice 11 node-manifest.ts | consume A5001/A5002 metadata | create another registry |
| Routing | Slice 11 routing.ts | ask whether entry is legal | create local allowedNext logic |
| Case / primary / lifecycle | existing Common Core owner | validate current Case | create shadow Case phase/state |
| Scene State | Slice 12 owner | advance A5001/A5002 current node projection | create private review-node state |
| Scene Artifact | Slice 12 owner | store typed A5001/A5002 evaluation artifacts | create generic Review store |
| Evidence | Evidence Core | create/reference substantive observations through owner seam | treat artifact JSON as second factual truth |
| Problem Formulation | Slice 8 owner | reference current formulation when relevant | mutate/confirm/reassess it |
| Family Alliance | Slice 13 owner | read target-list/target-item/feasibility/progress history | alter target truth as a side effect of review |
| Phone Use Contract | Slice 14 owner | read exact Contract version/execution-support history | update/supersede Contract as a side effect of review |
| Review-like Scene data | Slice 15 through Slice 12 Artifact owner | persist two bounded typed evaluation artifact schemas | become Common Core Review |
| Common Core Review | Phase 4 owner | expose downstream-unavailable truth; later provide source refs | create Review aggregate/table/API/CASE_OVERALL |
| Outcome | Phase 4 owner | record source observations only | declare IMPROVED/NO_CHANGE/WORSENED as Outcome truth |
| Safety | Slice 9 owner | call ordinary-progression guard | resolve/override Safety Hold |
| Compliance | Slice 10 owner | consume feature-policy decision | create local minor/AI rules |
| Consent | authoritative Consent owner | validate current purpose/scope | store private consent boolean |
| Authorization | existing authorize + RLS owners | authorize exact action/scope | infer permission from participation/UI |
| Idempotency | existing repository-wide / Scene owner | reuse command idempotency | create second idempotency ledger |
| Audit | business_audit_events / case_events owner | append required audit/event refs | create second audit truth |
| Scheduling | Phase 4 Follow-up Schedule owner | accept authentic future schedule trigger context | create schedule/cron/timer truth |
| Notification | Phase 4 Notification owner | report capability unavailable | create notification/delivery truth |
| AI | Phase 3 AI owner | later consume non-authoritative assistance if approved | require AI to complete A5001/A5002 or let AI decide truth |

Ownership Gate: PASS.

---

## 10. Runtime Dependencies and Implement Gates

### 10.1 Dependency classification

| Dependency | A5001 | A5002 | Classification |
|---|---|---|---|
| Slice 8 Problem Formulation | inherited semantic prerequisite | inherited semantic prerequisite | upstream owner; not reimplemented |
| Slice 9 Safety | hard control-plane dependency | hard control-plane dependency | must remain authoritative |
| Slice 10 Compliance | hard control-plane dependency | hard control-plane dependency | must remain authoritative |
| Slice 11 Manifest / Routing | hard runtime dependency | hard runtime dependency | already on main; only topology owner |
| Slice 12 Scene State / Artifact Runtime | hard runtime dependency | hard runtime dependency | common direct blocker |
| Slice 13 Family Alliance Runtime | hard runtime dependency | not a business dependency | A5001 subject owner |
| Slice 14 Phone Use Contract Runtime | not a business dependency | hard runtime dependency | A5002 subject owner |
| Phase 3 AI | not a dependency | not a dependency | deterministic Phase 2 must work without it |
| Phase 4 Common Core Review | downstream only | downstream only | not an Implement Gate prerequisite |
| Phase 4 Outcome | downstream only | downstream only | not an Implement Gate prerequisite |
| Phase 4 Follow-up Schedule | optional future entry adapter | optional future entry adapter | scheduled production trigger unavailable until owner exists |
| Phase 4 Notification | not a dependency | not a dependency | no delivery truth in Slice 15 |

### 10.2 Independent stream unlock

A5001 may begin implementation after Slice 12 + Slice 13 authoritative runtime are merged/reconciled, without waiting for Slice 14.

A5002 may begin implementation after Slice 12 + Slice 14 authoritative runtime are merged/reconciled, without waiting for Slice 13.

This is not permission to create separate Slice identities.

Slice 15 final completion requires both A5001 and A5002.

### 10.3 Current Implement Gate

At this freeze:

- Slice 11 runtime exists on main.
- Slice 12 runtime is not merged.
- Slice 13 runtime is not merged.
- Slice 14 runtime is not merged.

Therefore:

A5001 Implement Gate: BLOCKED.
A5002 Implement Gate: BLOCKED.
Slice 15 Final Implement Gate: BLOCKED.

Planning may continue to Plan AI 2. Development is not authorized.

---

## 11. Persistence / Artifact Semantics

### 11.1 No generic Review persistence in Slice 15

Slice 15 SHALL NOT create:

- reviews table;
- review entity/aggregate;
- review repository;
- generic Review API;
- CASE_OVERALL record;
- generic review_scope owner.

### 11.2 Scene State

A5001/A5002 current node status and revision SHALL use the authoritative Slice 12 Scene State owner.

Conceptual invariant:

one current projection per Case + bound Scene package + node code, with revisioned history/audit as defined by the owner.

A5001 and A5002 are different node codes and therefore cannot overwrite one another.

### 11.3 Scene Artifact types

Slice 15 defines two distinct logical Artifact schema discriminators to be carried by the authoritative Scene Artifact owner:

- DIGITAL_USE_A5001_EFFECT_EVALUATION
- DIGITAL_USE_A5002_EFFECT_EVALUATION

They are not generic Review records.

Common artifact metadata SHALL include:

- case reference through the owner;
- node code;
- stream discriminator;
- scene_package_version;
- artifact_schema_version;
- exact subject reference and subject revision/version;
- source_refs;
- evidence_refs;
- submitted_by / actor provenance;
- created_at;
- artifact revision;
- supersedes/revision relationship when corrected or re-entered;
- explicit UNKNOWN / DECLINED / NOT_COLLECTED semantics where applicable.

The artifact payload may contain bounded user responses and evaluation observations, but any substantive family fact used elsewhere as factual truth must be created/referenced through Evidence Core.

### 11.4 No giant cross-stream blob

A5001 and A5002 SHALL NOT share one opaque payload whose meaning depends on optional fields.

Their schemas must be discriminated and mechanically validated.

A5001 artifact cannot carry Contract-review-only fields as authoritative semantics.

A5002 artifact cannot carry Family-Alliance-target-review-only fields as authoritative semantics.

---

## 12. Entry Contract — Common Rules

Every A5001/A5002 submission/re-entry must revalidate at commit time:

1. authenticated actor;
2. authorized Family and Case;
3. current primary, non-closed Case unless an authoritative owner explicitly permits historical read-only review;
4. current bound Digital Use Scene Package / Manifest version;
5. exact node identity;
6. Manifest-permitted entry mode;
7. stream-specific subject exists in the same Family/Case;
8. expected Scene node revision is current;
9. expected subject revision/version is current for a current-subject submission;
10. applicable Consent is valid;
11. Compliance permits the action;
12. Safety permits ordinary progression;
13. all source/evidence refs belong to the permitted scope;
14. idempotency fingerprint matches the request;
15. no client-supplied next node, stream, review_scope or subject identity may override server truth.

A participant relationship alone never grants review read/write authority.

---

## 13. A5001 — FAMILY_ALLIANCE_REVIEW Semantics

### 13.1 Identity

Canonical node:
- A5001

Manifest:
- phase: REVIEW
- stream: FAMILY_ALLIANCE_REVIEW
- role: FAMILY_ALLIANCE_REVIEW
- entry: USER_INITIATED, SCHEDULED
- terminal: REVIEW_COMPLETE
- terminal reason: FAMILY_ALLIANCE_REVIEW_COMPLETE
- help/re-entry: USER_TIMELINE_REVIEW

A5001 is not A5002 and is not CASE_OVERALL.

### 13.2 Review subject

A5001 evaluates the implementation effect of:

- Family Alliance;
- the selected target list;
- the relevant target-item revisions.

A valid current submission must bind the exact target-list/target-item subject revisions being evaluated.

It does not require every target to be completed.

No formal product authority defines “all targets complete” as a prerequisite.

### 13.3 Approved source material

A5001 may consume/reference, where present:

- A3000 Family Alliance self-assessment history;
- A3001 communication-preparation history;
- A3002 selected target-list revisions;
- target-item concrete target text;
- target feasibility payload/revisions;
- Scene-level target progress;
- help/problem-response history;
- relevant Evidence with provenance;
- relevant historical A5001 artifacts for comparison.

### 13.4 Family Alliance evaluation dimensions

The semantic dimensions must be derived from already-approved Family Alliance content, not invented by Slice 15.

At minimum the evaluation may revisit the approved A3000 self-assessment dimensions:

- attention to the child’s emotion/emotional support;
- negotiation and genuine child participation/voice;
- trust / genuine vs perfunctory agreement;
- family-member coordination and consistency;
- parent emotional stability;
- parent promise/behavior consistency.

For the selected target list, the evaluation also covers:

- what was attempted;
- what was not attempted or only partially attempted;
- barriers/obstacles;
- use of approved help;
- observed changes/effects;
- adverse or unexpected changes;
- uncertainty / insufficient evidence.

No universal score, feasibility cutoff, success threshold or diagnostic label may be invented.

### 13.5 Questionnaire boundary

The Product Requirement names A5001 interaction as an evaluation questionnaire but does not freeze a separate canonical list of display sentences or a scoring rubric.

Therefore the Frozen semantic contract is:

- questionnaire fields must project the approved dimensions above;
- every required dimension must support an explicit unknown/not-collected/declined state where applicable;
- display wording may be refined without changing semantic dimensions;
- no answer may be transformed into a new professional score or diagnosis without later formal authority.

This is sufficient for deterministic Phase 2 execution and does not require a Product Owner decision.

### 13.6 Child input

Child input is not a mandatory A5001 completion prerequisite because the formal authority does not require it for every review.

If genuine child input exists:

- preserve the actual child source;
- apply current authorization/consent;
- do not let parent/AI impersonate the child;
- conflicting sources remain conflicting.

If child input does not exist, the system may still record an authorized parent-sourced review with appropriate provenance and uncertainty.

### 13.7 A5001 completion

A5001 reaches Scene-node REVIEW_COMPLETE only when:

- a valid bounded A5001 evaluation artifact has been committed;
- all required semantic fields are present or explicitly represented as UNKNOWN/DECLINED/NOT_COLLECTED where allowed;
- source provenance is valid;
- all control-plane gates pass;
- Scene State current projection advances atomically.

A5001 REVIEW_COMPLETE means:

the A5001 effect-evaluation interaction was validly recorded.

It does NOT mean:

- target goals were achieved;
- Family Alliance was effective;
- the Case improved;
- Common Core Review completed;
- Outcome exists;
- the Case is closed;
- A5002 completed.

---

## 14. A5002 — PHONE_USE_CONTRACT_REVIEW Semantics

### 14.1 Identity

Canonical node:
- A5002

Manifest:
- phase: REVIEW
- stream: PHONE_USE_CONTRACT_REVIEW
- role: PHONE_USE_CONTRACT_REVIEW
- entry: USER_INITIATED, SCHEDULED
- terminal: REVIEW_COMPLETE
- terminal reason: CONTRACT_REVIEW_COMPLETE
- help/re-entry: USER_TIMELINE_REVIEW

A5002 is not A5001 and is not CASE_OVERALL.

### 14.2 Review subject

A5002 evaluates the effect of an exact phone-use Contract version.

The review SHALL bind:

- contract version id;
- contract version/revision/status relevant to the evaluation;
- execution-period context;
- exact source template/package version where already owned by Slice 14.

The system must never silently switch an A5002 submission from one Contract version to another.

### 14.3 Approved source material

A5002 may consume/reference, where present:

- the formal A4010 Contract version;
- execution period;
- parent support measures;
- supervision measures and A4006 execution log/artifacts;
- incentives;
- breach responsibilities;
- A4011 execution-support / FAQ history;
- A4012 supersession/version history;
- relevant Evidence with provenance;
- relevant historical A5002 artifacts.

Absence of a source is represented truthfully; it is not fabricated.

### 14.4 Evaluation dimensions

A5002 evaluates, without inventing a generic Contract score:

- whether/how the agreed Contract was actually carried out;
- areas of partial/non-execution as user-reported or evidenced;
- parent-side support/cooperation;
- supervision experience;
- incentive experience where relevant;
- breach/responsibility experience where relevant;
- observed benefits;
- adverse/unexpected changes;
- new problems;
- uncertainty / insufficient evidence;
- whether an already-approved A4012 trigger condition appears to be present as an observation.

### 14.5 A4011 boundary

A4011 is execution support / FAQ / help.

A5002 is retrospective effect evaluation.

A5002 must not become a second A4011 support engine.

A4011 history may be a source reference; it is not A5002 completion truth.

### 14.6 A4012 boundary

A5002 may record that review evidence suggests one of the already-approved A4012 trigger conditions:

- execution period completed;
- a new problem requires adjustment;
- an existing approved adjustment condition is present.

But A5002 SHALL NOT:

- create a new Contract version;
- supersede the current Contract;
- route by inventing an A5002 → A4012 edge;
- auto-activate A4012;
- treat an observation as mutual Contract confirmation.

A4012 remains Slice 14 owned and is entered only through its own current authoritative routing/re-entry contract.

### 14.7 A5002 completion

A5002 reaches Scene-node REVIEW_COMPLETE only when a valid A5002 artifact, provenance, node revision and control-plane checks commit atomically.

A5002 REVIEW_COMPLETE means:

the effect evaluation for the bound Contract version was validly recorded.

It does NOT mean:

- Contract effective;
- Contract failed;
- new Contract version created;
- Common Core Review completed;
- Outcome exists;
- Case closed;
- A5001 completed.

---

## 15. REVIEW_COMPLETE Semantics

REVIEW_COMPLETE is a Scene Manifest terminal for the individual node.

There are two independent terminal reasons:

- FAMILY_ALLIANCE_REVIEW_COMPLETE for A5001;
- CONTRACT_REVIEW_COMPLETE for A5002.

Neither terminal is a Common Core Outcome.

Neither terminal implies the other node has run.

Neither terminal changes the historical source artifacts.

Neither terminal authorizes Closure, Maintenance, Plan adjustment or Reassessment by itself.

Future Phase 4 Common Core Review may consume the preserved evidence/artifact and decide an authorized next action under its own contract.

---

## 16. User-Initiated and Scheduled Entry

### 16.1 Entry qualification is not scheduling infrastructure

Manifest entryMode = SCHEDULED means:

the node is eligible to be entered from an authentic future scheduled trigger.

It does not mean:

Slice 15 owns a scheduler.

### 16.2 USER_INITIATED

USER_INITIATED production entry is available when:

- node/stream prerequisites are satisfied;
- all common entry gates pass;
- the actor explicitly requests the review;
- current revisions are valid.

A user-initiated review does not require Phase 4 Follow-up Schedule.

### 16.3 SCHEDULED before Phase 4

Until the authoritative Phase 4 Follow-up Schedule / trigger runtime exists:

- no production component in Slice 15 may claim a SCHEDULED trigger;
- no cron/timer/job may be created;
- no fake schedule row may be created;
- no notification may be sent or recorded;
- scheduled capability is truthfully unavailable.

A test-only deterministic fixture may inject a synthetic schedule-trigger capability to verify A5001/A5002 entry semantics, but it must be structurally test-only and cannot masquerade as production.

### 16.4 Future adapter seam

Once Phase 4 exists, Slice 15 may consume an authentic schedule-trigger context from the authoritative owner.

The trigger does not bypass:

- Authorization;
- Consent;
- Compliance;
- Safety;
- current Case;
- current package;
- subject version;
- node revision.

### 16.5 Manual/system calls

An explicit human/system API call without an authoritative schedule trigger is not SCHEDULED.

If otherwise legal, it is handled under the appropriate user/system-authorized entry category; it cannot fabricate schedule provenance.

Scheduled Entry Boundary: RESOLVED.

---

## 17. Evidence Provenance

### 17.1 Evidence remains factual truth

Substantive new observations created during A5001/A5002 that are meant to function as family facts/observations outside the artifact must be written through the authoritative Evidence owner.

The Scene artifact references those Evidence records.

It must not copy an observation into artifact JSON and then treat that copy as the authoritative fact.

### 17.2 Same-transaction owner seam

Where a review submission creates substantive Evidence and completes the Scene artifact/node in one user operation, future implementation must compose through an authoritative caller-owned same-transaction Evidence seam.

If the merged owner cannot support the required atomic composition:

STOP for a narrow owner-approved seam.

Do not create a second Evidence table or accept two-transaction partial truth.

### 17.3 Provenance fidelity

Every source remains distinguishable:

- parent source;
- genuine child source;
- other authorized family source;
- prior Scene artifact;
- Evidence record;
- Contract/target artifact;
- professional content reference.

A parent statement does not become child fact.

AI output does not become family fact merely because it is present in a later phase.

---

## 18. Authorization / Consent / Compliance / Safety

### 18.1 Authorization

All read/write operations must use current server-side Authorization and RLS.

Negative access must cover:

- wrong Family;
- wrong Case;
- wrong subject;
- wrong actor;
- cross-family references;
- participant privilege escalation;
- unauthorized historical review access.

Frontend visibility is never authorization.

### 18.2 Consent

Consent remains an independent owner.

Consent revocation or missing required consent blocks future affected review processing.

Historical records are not silently deleted merely because consent changes; subsequent visibility/use follows the authoritative Data Rights/Consent contract.

No private review_consent field is authoritative.

### 18.3 Compliance

Compliance remains Slice 10 owned.

Slice 15 does not create age/guardian/AI applicability logic.

Missing/ambiguous/blocked required policy fails closed according to the owner.

### 18.4 Safety

Safety remains Slice 9 owned.

A Safety Hold blocks ordinary review progression under the authoritative guard.

Slice 15 cannot resolve Safety Hold.

A blocked review cannot leave a completed Scene node or fake evaluation artifact.

---

## 19. Idempotency

Slice 15 SHALL reuse the authoritative existing command idempotency infrastructure.

No second store is permitted.

Mutation identity must include the existing actor + command type + idempotency key contract.

The canonical fingerprint must include at least the semantics necessary to distinguish:

- Case;
- node A5001 vs A5002;
- bound subject identity;
- expected subject revision/version;
- expected Scene node revision;
- scene/package version where required;
- normalized evaluation payload.

Required behavior:

- same key + same payload → replay original committed result;
- same key + different payload → idempotency mismatch/conflict;
- concurrent same key → one business execution;
- failed transaction → no successful idempotency result.

---

## 20. Concurrency / Atomicity

### 20.1 Lock/CAS boundaries

Future implementation SHALL follow existing owner lock order and transaction discipline.

At minimum it must atomically revalidate:

- current Case / primary;
- current package/Manifest;
- entry mode;
- Safety/Compliance/Consent/Authorization;
- Scene node expected revision;
- exact A5001 target-list/target revision or A5002 Contract version/revision;
- source reference scope.

### 20.2 Same-node races

Two concurrent submissions against the same expected A5001 or A5002 node revision must not both become the new current revision.

One legal winner is permitted.

The stale writer must receive a truthful conflict and may retry against current state.

### 20.3 Cross-scope independence

A5001 and A5002 are separate node scopes.

A write to one must not overwrite, supersede or semantically complete the other.

Shared Case/Family locks may be used only according to existing owner discipline, not to invent a single global review record.

### 20.4 Atomic commit set

One successful review submission that contains new substantive observations must atomically settle, as applicable:

- authoritative Evidence writes/references;
- new typed Scene artifact revision;
- Scene node current projection/revision;
- business audit / case event;
- idempotency result.

A5002 completion does not mutate Contract version in that transaction.

A5001 completion does not mutate target selection/progress truth in that transaction except through a separately authorized upstream command, which is not part of the review command.

Fault injection must prove no partial artifact/node/idempotency success.

---

## 21. Versioning / Correction / Supersession

The following version identities remain distinct:

- scene_package_version;
- node Manifest/package version;
- Scene node revision;
- A5001 artifact schema/revision;
- target-list revision;
- target-item revision;
- A5002 artifact schema/revision;
- Contract version;
- Contract draft/version revision where applicable;
- Evidence version/source history;
- Consent/Compliance/Safety policy versions.

### 21.1 Correction

Material correction creates a new artifact revision/superseding projection.

Historical artifact payloads are preserved.

Evidence correction uses the Evidence owner and preserves source history.

No UPDATE may rewrite a prior review into a different past.

### 21.2 Re-entry

A5001/A5002 re-entry is allowed only under Manifest-approved entry semantics and after all current gates are rechecked.

Re-entry may create a later evaluation artifact even when the node previously reached REVIEW_COMPLETE.

The current Scene projection advances; historical evaluation artifacts remain.

### 21.3 Contract supersession

An A5002 artifact stays bound to the exact Contract version it evaluated.

If that Contract is later superseded, the old review remains historical truth.

A new review of the new Contract version creates a separate later A5002 artifact; it does not rewrite the prior one.

---

## 22. Error / Unavailable Semantics

Plan AI 2 must bind these semantic classes to the authoritative merged repository error vocabulary rather than inventing a parallel global error system.

Required distinct classes:

- authentication missing;
- authorization denied / anti-enumeration not-found as owned upstream;
- wrong Family/Case/subject;
- node not reachable;
- stream subject missing;
- wrong stream / node-scope mismatch;
- invalid evaluation payload;
- stale Scene revision;
- stale target/Contract subject revision/version;
- idempotency mismatch;
- Safety blocked;
- Compliance blocked/unavailable;
- Consent missing/revoked;
- scheduled trigger capability unavailable;
- downstream Phase 4 Review/Outcome unavailable;
- infrastructure failure.

Rules:

- infrastructure failure is never converted into business denial/success;
- scheduled capability unavailable is never represented as “scheduled”;
- downstream Common Core Review unavailable is not A5001/A5002 failure after the Scene artifact itself validly completes;
- invalid/blocked/stale submissions write no completed node truth;
- errors must not disclose cross-family existence.

---

## 23. AI Boundary

Phase 2 A5001/A5002 must run deterministically without a real model.

AI is not required for:

- entry validation;
- scope selection;
- node completion;
- provenance;
- effect-evaluation artifact validation;
- history;
- idempotency;
- routing;
- Safety/Compliance/Consent/Authorization.

A future Phase 3 AI capability may assist with:

- natural-language phrasing;
- summarizing user-provided material;
- explaining approved professional content.

But it must not:

- choose A5001 vs A5002 contrary to Manifest;
- manufacture missing observations;
- impersonate a family member;
- assign Outcome;
- complete the node without validated source/input;
- create Common Core Review truth;
- override Safety/Compliance/Consent/Authorization.

AI Boundary: RESOLVED.

---

## 24. Downstream Unavailable Semantics

Slice 15 must truthfully expose that the following may be unavailable until their owner phases exist:

- Common Core Review;
- Outcome;
- Plan adjustment;
- Task/Checkin;
- Follow-up Schedule;
- pg-boss;
- Notification.

A5001/A5002 Scene completion must not be withheld merely because Phase 4 is absent.

Instead:

- complete the bounded Scene evaluation if its own contract is satisfied;
- expose downstream capability as unavailable/not implemented where needed;
- do not fabricate next action, outcome, schedule or delivery.

This preserves Phase 2 deterministic completion without manufacturing Phase 4 truth.

---

## 25. Functional Requirements

### Identity / authority

FR-001 — Slice 15 implements exactly A5001 and A5002 bounded Digital Use effect-evaluation runtime.
FR-002 — A5001 and A5002 remain separate canonical node identities.
FR-003 — A5001 stream remains FAMILY_ALLIANCE_REVIEW.
FR-004 — A5002 stream remains PHONE_USE_CONTRACT_REVIEW.
FR-005 — Slice 11 Manifest/routing remains the only topology authority.
FR-006 — no local route table, numeric adjacency, client nextNode or duplicate node registry is permitted.

### Phase boundary

FR-007 — Slice 15 SHALL NOT create Common Core Review truth.
FR-008 — Slice 15 SHALL NOT create Outcome truth.
FR-009 — Scene REVIEW_COMPLETE SHALL have only the bounded semantics defined in this Spec.
FR-010 — Phase 3 AI and Phase 4 Review/Schedule SHALL NOT be implementation prerequisites for deterministic A5001/A5002 behavior.

### Persistence

FR-011 — Scene State uses the Slice 12 owner.
FR-012 — Scene Artifact uses the Slice 12 owner.
FR-013 — A5001 and A5002 use separate typed artifact discriminators/schemas.
FR-014 — substantive family observations use/refer to Evidence Core.
FR-015 — no generic reviews table/entity/repository/API may be introduced.
FR-016 — history is revisioned/superseding, never destructively overwritten.

### A5001

FR-017 — legal A5001 entry requires a valid Family Alliance/target-list subject.
FR-018 — A5001 evaluates Family Alliance and selected target implementation effect, not Contract effect.
FR-019 — A5001 may use A3000 self-assessment, A3002 target revisions, target feasibility/progress/help history and Evidence.
FR-020 — A5001 does not require all targets to be complete.
FR-021 — A5001 does not invent a universal success score/threshold.
FR-022 — child input is optional unless later formal authority explicitly requires it; genuine child input retains genuine provenance.
FR-023 — A5001 REVIEW_COMPLETE never implies A5002 completion, Case Outcome or Common Core Review completion.

### A5002

FR-024 — legal A5002 entry requires an exact valid Contract-version subject.
FR-025 — A5002 evaluates Contract execution/effect, not Family Alliance target-list effect.
FR-026 — A5002 may reference Contract terms/version, execution period, supervision/support/incentive/breach context and Evidence where available.
FR-027 — A5002 remains distinct from A4011 execution support.
FR-028 — A5002 may observe approved A4012 trigger conditions but SHALL NOT create/activate/supersede a Contract.
FR-029 — A5002 REVIEW_COMPLETE never implies A5001 completion, Case Outcome or Common Core Review completion.

### Entry / scheduling

FR-030 — USER_INITIATED entry works without Phase 4 Schedule when all gates pass.
FR-031 — SCHEDULED is an entry eligibility, not a scheduler.
FR-032 — production SCHEDULED entry requires authentic trigger context from the future authoritative Schedule owner.
FR-033 — before that owner exists, scheduled production capability is truthfully unavailable.
FR-034 — no cron/job/notification truth may be created by Slice 15.
FR-035 — every re-entry rechecks all current gates and revisions.

### Control plane

FR-036 — Authorization and RLS are server authoritative.
FR-037 — Consent remains separately authoritative.
FR-038 — Compliance remains Slice 10 authoritative.
FR-039 — Safety remains Slice 9 authoritative and Safety Hold cannot be overridden.
FR-040 — participant membership alone grants no review privilege.

### Reliability

FR-041 — existing idempotency is reused; same key/same payload replays and mismatch conflicts.
FR-042 — stale revisions cannot last-write-win.
FR-043 — concurrent same-node submissions produce one current winner.
FR-044 — review submission commits Evidence refs/artifact/state/audit/idempotency atomically.
FR-045 — corrections/re-entry preserve prior history.
FR-046 — infrastructure failure remains infrastructure failure.

### No-AI / no-overdesign

FR-047 — deterministic fixtures can complete A5001/A5002 without real AI.
FR-048 — AI output is never review authority.
FR-049 — no generic questionnaire/workflow/rules/scoring/recommendation engine is introduced.
FR-050 — no Phase 4 Plan/Task/Checkin/Review/Outcome/Schedule/Notification truth is introduced.

---

## 26. Acceptance Scenarios

All scenarios must be mechanically testable in future implementation.

### Entry and separation

AS-01 — Legal A5001 USER_INITIATED entry with valid Family Alliance target subject succeeds.
AS-02 — Legal A5002 USER_INITIATED entry with valid Contract-version subject succeeds.
AS-03 — A5001 output is stored only as the A5001 artifact type and node A5001 state.
AS-04 — A5002 output is stored only as the A5002 artifact type and node A5002 state.
AS-05 — completing A5001 leaves A5002 incomplete.
AS-06 — completing A5002 leaves A5001 incomplete.
AS-07 — A5001 submitted with Contract-review payload/scope is rejected.
AS-08 — A5002 submitted with Family-Alliance-review payload/scope is rejected.
AS-09 — A5001 does not require Slice 14/Contract runtime as a business prerequisite once A5001 dependencies are available.
AS-10 — A5002 does not require Slice 13/Family Alliance runtime as a business prerequisite once A5002 dependencies are available.

### Subject / provenance

AS-11 — A5001 bound to another Case’s target item is denied.
AS-12 — A5002 bound to another Case’s Contract version is denied.
AS-13 — cross-Family source/evidence reference is denied by application authorization and RLS.
AS-14 — wrong actor is denied.
AS-15 — participant presence without the required action privilege cannot submit review.
AS-16 — genuine child input remains child-sourced.
AS-17 — parent-transcribed child opinion is not silently reclassified as child-sourced.
AS-18 — missing optional child input does not create fabricated child data and does not automatically block a valid parent-sourced review.
AS-19 — unknown/insufficient source remains explicit UNKNOWN/NOT_COLLECTED rather than being inferred.

### A5001 specifics

AS-20 — A5001 can review a partially executed target list; all targets need not be complete.
AS-21 — A5001 preserves old target-list/progress history after a new evaluation.
AS-22 — A5001 does not create Common Core Goal/Task/Checkin.
AS-23 — A5001 cannot convert its responses into a universal success score absent formal authority.

### A5002 specifics

AS-24 — A5002 binds the exact Contract version under evaluation.
AS-25 — stale/superseded-current mismatch cannot silently switch the review to another Contract version.
AS-26 — historical A5002 remains bound to the old Contract after A4012 later supersedes it.
AS-27 — A5002 can record evidence suggesting an A4012 trigger without creating a new Contract version.
AS-28 — A5002 completion does not execute A4012.
AS-29 — A5002 does not create Checkin/Outcome/Plan truth from A4011 support history.

### Control-plane negatives

AS-30 — wrong Family is denied without cross-family enumeration.
AS-31 — wrong Case is denied.
AS-32 — Safety Hold blocks ordinary review completion and leaves no completed artifact/state residue.
AS-33 — Compliance block leaves no completed artifact/state residue.
AS-34 — required Consent revoked before commit blocks completion.
AS-35 — Authorization denial cannot be bypassed by valid Consent.
AS-36 — Compliance/Safety/Consent checks cannot be bypassed by client flags.

### Idempotency / concurrency / atomicity

AS-37 — same idempotency key + same A5001 payload returns the original committed result.
AS-38 — same idempotency key + different payload returns idempotency conflict.
AS-39 — same idempotency key behavior is independently proven for A5002.
AS-40 — two concurrent A5001 submissions with the same expected node revision produce one current winner; stale writer fails.
AS-41 — two concurrent A5002 submissions with the same expected subject/node revision produce one current winner.
AS-42 — stale target-list revision causes a truthful conflict with no last-write-wins.
AS-43 — stale Contract version/revision causes a truthful conflict.
AS-44 — injected failure after Evidence write but before artifact/state commit rolls the whole business transaction back.
AS-45 — injected failure before idempotency settlement leaves no successful idempotency record.
AS-46 — A5001 concurrent write cannot overwrite A5002 and vice versa.

### Re-entry / history

AS-47 — USER_TIMELINE_REVIEW re-entry creates a later A5001 artifact revision and preserves prior history.
AS-48 — A5002 re-entry for a later Contract version creates a new artifact bound to that version and preserves prior review.
AS-49 — correction never destructively rewrites the earlier evaluation.
AS-50 — re-entry rechecks primary Case, Authorization, Consent, Compliance, Safety, package and revisions.

### Scheduled entry

AS-51 — USER_INITIATED A5001 works when Phase 4 Schedule is absent.
AS-52 — USER_INITIATED A5002 works when Phase 4 Schedule is absent.
AS-53 — production request claiming SCHEDULED without authoritative schedule-trigger context is rejected as schedule capability unavailable.
AS-54 — no schedule/job/notification row is created by that rejection.
AS-55 — test-only synthetic scheduled trigger can exercise entry semantics without becoming production capability.
AS-56 — a future authentic scheduled trigger still cannot bypass current Authorization/Consent/Compliance/Safety/revision gates.

### Phase boundary / negative space

AS-57 — A5001 completion creates no Common Core Review record.
AS-58 — A5002 completion creates no Common Core Review record.
AS-59 — neither node creates CASE_OVERALL.
AS-60 — neither node creates Outcome.
AS-61 — neither node creates or adjusts Plan.
AS-62 — neither node creates Task or Checkin.
AS-63 — neither node creates Follow-up Schedule.
AS-64 — neither node creates pg-boss job or Notification truth.
AS-65 — no AI/model call is required to complete the deterministic happy path.
AS-66 — model output alone cannot complete either node.
AS-67 — repository scope guard finds no second node registry/routing table.
AS-68 — repository scope guard finds no generic Review engine/entity/table/API introduced by Slice 15.
AS-69 — repository scope guard finds no generic questionnaire/forms/rules/scoring engine.
AS-70 — exact-head full deterministic Phase 2 fixture can reach valid A5001 and A5002 Scene REVIEW_COMPLETE without real AI or Phase 4 runtime.

Acceptance Scenario Set: 70 scenarios.

---

## 27. Negative-Space Requirements

A future Slice 15 implementation is invalid if it introduces any of the following:

NS-01 — generic Review domain owner.
NS-02 — reviews table/repository/API owned by Slice 15.
NS-03 — CASE_OVERALL Review.
NS-04 — Outcome write.
NS-05 — Plan/Task/Checkin write.
NS-06 — Follow-up Schedule write.
NS-07 — scheduler/cron/pg-boss job creation.
NS-08 — notification/delivery status.
NS-09 — generic questionnaire/form builder.
NS-10 — generic scoring/effectiveness engine.
NS-11 — AI evaluator authority.
NS-12 — second node manifest/registry.
NS-13 — second routing table.
NS-14 — numeric next-node inference.
NS-15 — client-authoritative node/stream/next route.
NS-16 — second Scene state or artifact owner.
NS-17 — second Evidence store.
NS-18 — second Consent/Compliance/Safety/Authorization owner.
NS-19 — second idempotency/audit system.
NS-20 — destructive overwrite of prior evaluation history.
NS-21 — A5001/A5002 semantic collapse.
NS-22 — A5001 completion automatically completing A5002.
NS-23 — A5002 automatically creating A4012.
NS-24 — fake scheduled execution.
NS-25 — fake notification.
NS-26 — fake child input.
NS-27 — Phase 3/4 implementation pulled into Slice 15.
NS-28 — modification of four formal Docs or frozen Slice 8–14 semantics.

---

## 28. Development Implement Gate

### 28.1 Planning readiness

Ready For Plan AI 2: YES.

### 28.2 Development authorization

Implement Authorized: NO.

### 28.3 A5001 stream gate

Before A5001 implementation may begin, then-current main must prove:

1. current origin/main re-read;
2. four formal Docs unchanged semantically;
3. this Frozen Spec exact;
4. Slice 8 Problem Formulation owner remains authoritative;
5. Slice 9 Safety owner remains authoritative;
6. Slice 10 Compliance owner remains authoritative;
7. Slice 11 remains the only Manifest/routing owner;
8. Slice 12 has passed independent Audit 2, merged, and provides authoritative Scene State / Scene Artifact / generic Scene submission/read / transaction / idempotency seams;
9. Slice 13 has passed independent Audit 2 and merged, providing authoritative Family Alliance target-list/target-item/feasibility/progress/history semantics;
10. actual Evidence owner supports the atomic provenance composition required by this Spec, or an owner-approved narrow seam is added before A5001 work continues;
11. migration/shared RLS/Authorization/Consent/audit contracts are re-read;
12. no semantic drift requires changing this Spec.

Slice 14 is not an A5001 business prerequisite.

### 28.4 A5002 stream gate

Before A5002 implementation may begin, then-current main must prove items 1–8 above plus:

9. Slice 14 has passed independent Audit 2 and merged, providing authoritative Contract-version / execution-support / supersession history;
10. actual Evidence owner supports required atomic provenance composition;
11. shared contracts are reconciled;
12. no semantic drift requires changing this Spec.

Slice 13 is not an A5002 business prerequisite.

### 28.5 Final Slice 15 completion gate

Slice 15 cannot be declared implementation-complete until:

- both A5001 and A5002 stream gates have passed;
- both scopes are implemented;
- no Phase 4 truth was introduced;
- deterministic no-real-model acceptance passes for both;
- exact-head independent Audit 2 passes.

Current blocking evidence:

- Slice 12 runtime is not merged;
- Slice 13 runtime is not merged;
- Slice 14 runtime is not merged.

Current Implement Gate: BLOCKED.

---

## 29. Clarification Resolution

### C15-01 — Is A5001/A5002 the correct next Slice?

RESOLVED — YES.

They are the final explicit Phase 2 Digital Use block before Phase 3.

### C15-02 — One Slice or two?

RESOLVED — ONE Slice with two strictly separated scopes.

Shared infrastructure integration is the same; business subjects and artifacts remain distinct.

### C15-03 — Does Scene phase REVIEW mean Common Core Review exists?

RESOLVED — NO.

It is a Scene node phase label. Phase 4 owns Common Core Review truth.

### C15-04 — Can Phase 2 persist anything review-like?

RESOLVED — YES, bounded Scene effect-evaluation artifacts through the existing Scene Artifact owner.

No generic Review entity/table is allowed.

### C15-05 — What does REVIEW_COMPLETE mean?

RESOLVED — valid Scene effect-evaluation interaction committed for that one node/scope.

It is not success, Outcome, Case closure or Common Core Review completion.

### C15-06 — Must A5001 wait for A5002 or Slice 14?

RESOLVED — NO.

A5001 depends on Slice 12 + Slice 13, not Slice 14.

### C15-07 — Must A5002 wait for A5001 or Slice 13?

RESOLVED — NO.

A5002 depends on Slice 12 + Slice 14, not Slice 13.

### C15-08 — Does SCHEDULED mean Slice 15 implements scheduler/notification?

RESOLVED — NO.

It is entry eligibility only. Production scheduled trigger is unavailable until the Phase 4 owner exists.

### C15-09 — Can USER_INITIATED review work before Phase 4?

RESOLVED — YES.

It remains subject to all normal gates.

### C15-10 — Is child input mandatory for A5001/A5002 completion?

RESOLVED — NO formal authority makes it universally mandatory.

If present, genuine source/provenance and consent apply. No impersonation is allowed.

### C15-11 — Must Slice 15 invent the exact text of an evaluation questionnaire?

RESOLVED — NO.

The semantic dimensions are derived from already-approved Family Alliance / Contract content. Exact display wording is presentation copy and must not introduce new semantic gates/scores.

### C15-12 — Does A5002 trigger A4012?

RESOLVED — NO.

It may record evidence relevant to an already-approved trigger, but A4012 remains independently owned/routed.

### C15-13 — Is Phase 3 AI required to finish Phase 2?

RESOLVED — NO.

That would contradict the explicit deterministic Phase 2 completion condition.

### C15-14 — Is Phase 4 Review an Implement Gate?

RESOLVED — NO.

It is downstream. Slice 15 completes only the Scene-local evaluation and preserves future integration refs.

### C15-15 — Are there unresolved Product Owner decisions?

RESOLVED — NO.

All material questions are resolved by formal authority, frozen upstream contracts, existing owners and derived boundary clarification.

Open Product Decisions: 0.

---

## 30. Final Freeze

Selection Gate: PASS.

Identity Collision Gate: PASS.

Authority Gate: PASS.

Four formal Docs aligned: YES.

Slice 11 Manifest aligned: YES.

Slice 12–14 frozen planning contracts aligned: YES.

A5001 / A5002 separation preserved: YES.

Phase 2 / Phase 4 Review boundary resolved: YES.

Scheduled-entry boundary resolved: YES.

Ownership conflict: 0.

Duplicate truth: 0 authorized.

Overdesign: 0 authorized.

Hidden Phase 3 implementation: 0 authorized.

Hidden Phase 4 implementation: 0 authorized.

Acceptance scenarios: 70 mechanically defined.

Negative-space requirements: 28.

Open Product Decisions: 0.

Scope Drift: 0.

Implement Gate: BLOCKED.

Implement Authorized: NO.

Ready For Plan AI 2: YES.

Frozen Spec: YES.

Plan AI 1 stops here.
