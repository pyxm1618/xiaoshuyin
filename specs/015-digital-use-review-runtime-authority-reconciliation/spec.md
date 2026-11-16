# Feature Specification: Digital Use Review Runtime — Authority Reconciliation

**Feature Directory**: specs/015-digital-use-review-runtime-authority-reconciliation  
**Created**: 2026-11-16  
**Status**: SPECIFY / CLARIFY FINAL PASS — FROZEN  
**V1 Phase**: Phase 2 — Digital Use Scene  
**Execution Context**: REMOTE-ONLY / GitHub authoritative remote  
**Supersedes**: conflicting portions of the historical Slice 15 Frozen Spec only; the historical artifact remains immutable

This specification is the current Slice 15 implementation contract derived from the authoritative main and current Authority Docs. It does not amend product or architecture Authority. It does not modify, delete, or rewrite the old Slice 15 Frozen Spec, planning package, or PR #39.

Plan AI 1 stop boundary: this artifact authorizes only the superseding Frozen Spec. It does not authorize plan.md, checklist.md, tasks.md, production code, tests, migrations, CI changes, PR #39 changes, merge, or Audit 2.

---

## Upstream Traceability

### Current remote baseline

- Repository: pyxm1618/xiaoshuyin
- Authoritative baseline: origin/main
- Exact baseline SHA: ff6f8f7da783656e41641031df5ddecf745096ef
- Baseline includes:
  - PR #52 — Authority Convergence
  - PR #53 — Foundation Remaining Remediation
  - PR #54 — Digital Use Vertical Convergence
  - PR #55 — End-to-End Closeout
- Current migration head: db/migrations/022_foundation_remaining_consent_chain_integrity.sql
- Current migration-head blob: 4c7af9c2d2c26b7f244050c82518f16dc25f0973

### Current Authority Docs

| Authority | Exact blob | Relevant current authority |
|---|---|---|
| Docs/总产品需求.md | 97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29 | Authority vs Professional/Legal approval boundary; AI and safety principles; long-term product boundary |
| Docs/V1产品需求.md | 8eb660cd905d8fba4b52fe0f74bbc214b3113117 | A5001/A5002 independent lifecycle; Professional Content gate; Case phase; provenance; Consent/Compliance/Safety |
| Docs/总体技术架构.md | 6b4630803f371faf6d93f27361070223d0f661a0 | Professional Content Approval Plane; single Case lifecycle owner; professional content as versioned assets |
| Docs/V1技术设计.md | a0f09b8afda5532870150f03b713fed107359849 | Phase 2/3/4 boundaries; A5001/A5002 package gate; data ownership; idempotency/concurrency; Common Core Review boundary |

The repository authority snapshot at .specify/authority-inputs.json binds the same four blobs.

### Canonical upstream identifiers and sections

This spec projects, among others:

- A5001 — FAMILY_ALLIANCE_REVIEW
- A5002 — PHONE_USE_CONTRACT_REVIEW
- A4012 — Contract revision/update owner boundary
- V1-D27 — A5001 scope
- V1-D28 — A5002 scope
- V1-D29 — A5001/A5002 separation
- V1-D43 — Digital Use canonical flow/manifest authority
- Docs/V1产品需求.md §2.2–2.14, §17–20, and Authority Convergence Contract §F–H
- Docs/总体技术架构.md §6, §13–14, §19A
- Docs/V1技术设计.md §7.3–7.5, §8, §9, §12.3B, §29–30, §38

### Historical Slice 15 inputs

- Old Frozen Spec commit: 246465f00156d37c03d33fd638ae9e605ceab3d9
- Old Frozen Spec blob: 0c6e9dd80fa74734d641ad9ff7b4b66ba3930801
- Old Planning commit: 26652fe800563f1b3c1be222ff8a111f29c70f3b
- Old Plan blob: 142aa099628b51341e59bcfa15fa30643df127fc
- Old Checklist blob: ba3cc4ab135502289e7f8720fee66e089fed9316
- Old Tasks blob: b1d8ecbf98aff0e5f42c7f9af67da0009b4618d6
- Prior implementation evidence: PR #39, feat/015-digital-use-review-runtime
- PR #39 current exact head at reconciliation: 114ecb63a570e963435e08b4c08053f0054130d4
- PR #39 status at reconciliation: OPEN / DRAFT / NOT MERGED

### Authority hierarchy

For Slice 15, precedence is:

1. current four Authority Docs;
2. this downstream superseding Slice 15 Spec;
3. historical Slice 15 Frozen Spec where not superseded;
4. historical Plan / Checklist / Tasks;
5. PR #39 implementation and tests as prior implementation evidence only.

No implementation, test, schema, migration, approved flag, or old frozen text can manufacture Professional Authority.

### Current production baseline evidence

PR #55/current main proves the legal production boundary before Slice 15:

- A1001 through A2010 can reach the two independent A3000 / A4001 lanes;
- A4001 product-comprehension retry semantics are real;
- missing Professional Content for A4003 produces truthful HOLD without fake roleplay or A4004;
- Family Alliance remains independently usable while A4003 is held;
- product-authority content references preserve exact source/version provenance.

Slice 15 MUST NOT regress this baseline.

---

## Scope

### In Scope

Slice 15 freezes and later implements only:

- A5001 FAMILY_ALLIANCE_REVIEW lifecycle infrastructure;
- A5002 PHONE_USE_CONTRACT_REVIEW lifecycle infrastructure;
- independent review-ready subject detection and binding;
- exact Family Alliance target-list / target revision binding;
- exact Phone Use Contract identity / version / revision binding;
- distinct typed Scene-local review artifacts;
- Professional Content Package resolution and validation as a consumed dependency;
- fail-closed production behavior when professional authority is unavailable or invalid;
- REVIEW_COMPLETE only when the exact professional package gate and all other gates pass;
- provenance, Evidence references, history, revision, supersession, re-entry;
- Authorization, RLS, Consent, Compliance and Safety composition;
- idempotency, concurrency and atomicity;
- USER_INITIATED entry;
- SCHEDULED entry eligibility boundary only;
- A4012 observe-only boundary;
- deterministic positive-path verification using an explicitly test-only valid-package fixture;
- deterministic fail-closed verification using production-default unavailable authority.

### Out of Scope

Slice 15 does not own or implement:

- Professional Reviewer identity, credential verification, qualification registry, HR, marketplace, license database, assignment platform, or generic staff/RBAC platform;
- a generic Professional Content Platform, CMS, approval workflow engine, or package marketplace;
- creation of actual A5001/A5002 questionnaire items or professional dimensions;
- professional scoring, cutoff, success threshold, diagnostic or clinical interpretation;
- AI-generated substitute questionnaires, scoring, thresholds, or professional conclusions;
- Common Core Review aggregate/table/repository/API;
- CASE_OVERALL review;
- Outcome;
- Goal, InterventionInstance, Plan, Task, Checkin;
- Follow-up Schedule, scheduler, cron, pg-boss job creation, Notification or delivery truth;
- a second Scene State, Scene Artifact, Evidence, Consent, Compliance, Safety, Authorization, RLS, idempotency, audit, Contract or Case owner;
- A4003 redesign;
- A4012 execution;
- modification of the four Authority Docs;
- modification of the historical Slice 15 Frozen Spec or PR #39.

### Non-Goals

- Do not preserve invalid old semantics because code already exists.
- Do not make Phase 2 look complete by fabricating Professional approval.
- Do not create a reusable generic review/scoring/questionnaire framework.
- Do not pull Phase 3 AI or Phase 4 Common Core execution infrastructure forward.
- Do not allocate a migration number in this Spec.

---

## Purpose and Reconciliation Outcome

The old Slice 15 correctly identified A5001 and A5002 as two independent final Digital Use review streams, but it incorrectly promoted candidate evaluation dimensions into sufficient production semantics and allowed a valid bounded Scene artifact to imply REVIEW_COMPLETE without a current approved Professional Content Package.

Current Authority explicitly supersedes that assumption.

The reconciled contract separates two truth layers:

### Layer A — Non-professional runtime / lifecycle infrastructure

This layer is valid product/architecture scope and can be implemented now:

- review-ready subject detection;
- independent A5001/A5002 eligibility;
- exact subject identity and version binding;
- Case/Family/Contract/target provenance;
- Scene State / Scene Artifact integration;
- Evidence references;
- history/revision/supersession;
- authorization/RLS/Consent/Compliance/Safety;
- idempotency/concurrency/atomicity;
- re-entry;
- USER_INITIATED entry;
- SCHEDULED eligibility boundary.

### Layer B — Professional effect-evaluation content

This layer cannot be invented by Slice 15:

- actual questionnaire items/prompts;
- professional required dimensions;
- professional scoring;
- cutoff;
- success/failure threshold;
- professional, diagnostic or clinical interpretation;
- response-to-professional-conclusion mapping.

Layer B requires a current exact APPROVED + PUBLISHED Professional Content Package and real Professional Reviewer approval proof.

Current state is therefore Path B:

> Slice 15 implements lifecycle infrastructure plus a fail-closed Professional Content gate. Production professional evaluation remains unavailable until real authority exists.

---

## Supersession Contract

The historical Slice 15 Frozen Spec remains immutable historical evidence. This spec supersedes only its meanings that conflict with current Authority.

A historical statement is reusable only when its current meaning can be derived from the current Authority Docs. Reuse is never based merely on old freeze status.

### Core Requirement Reconciliation Register

| # | Old/core requirement | Decision | Current rule |
|---:|---|---|---|
| 1 | A5001 identity | RETAIN | A5001 remains FAMILY_ALLIANCE_REVIEW. |
| 2 | A5002 identity | RETAIN | A5002 remains PHONE_USE_CONTRACT_REVIEW. |
| 3 | A5001/A5002 stream separation | RETAIN | Separate eligibility, subjects, artifacts and completion; no forced sequence. |
| 4 | Exact review subject binding | RETAIN | Every review instance binds the exact authoritative subject and revisions. |
| 5 | A5002 exact Contract version binding | RETAIN | Never switch to latest Contract for convenience. |
| 6 | A5001 Family Alliance / target binding | RETAIN | Bind exact current Family Alliance target-selection and target-item revision set being reviewed. |
| 7 | Separate artifact identities | RETAIN | A5001 and A5002 remain mechanically distinguishable Scene-local artifacts. |
| 8 | Scene State ownership | RETAIN | Consume the current authoritative Scene State owner; create no second owner. |
| 9 | Scene Artifact ownership | RETAIN | Consume the current authoritative Scene Artifact owner; create no generic Review owner. |
| 10 | Evidence ownership | RETAIN | Substantive family facts/observations remain Evidence-owner truth. |
| 11 | Source/provenance fidelity | RETAIN | Parent, child, other actor, Evidence, subject and professional package sources stay distinct. |
| 12 | Revision/history | RETAIN | Historical reviews and source versions remain immutable and traceable. |
| 13 | Supersession | RETAIN | Corrections/reassessment append or supersede; no destructive rewrite. |
| 14 | Idempotency | RETAIN | Reuse current authoritative idempotency owner. |
| 15 | Concurrency | RETAIN | Stale node/subject/package versions cannot last-write-win. |
| 16 | Atomicity | RETAIN | Successful review effects settle atomically through authoritative owner seams. |
| 17 | Authorization | RETAIN | Server-side current Authorization remains independent and mandatory. |
| 18 | PostgreSQL RLS | RETAIN | RLS remains the database isolation backstop. |
| 19 | Consent | RETAIN | Current purpose-bound Consent is independently authoritative. |
| 20 | Compliance | RETAIN | Current Compliance policy/gate is independently authoritative. |
| 21 | Safety | RETAIN | Safety independently gates ordinary review progression and cannot be overridden. |
| 22 | USER_INITIATED entry | RETAIN | Allowed only when subject, package and all current gates pass. |
| 23 | SCHEDULED as manifest eligibility | RETAIN | SCHEDULED does not make Slice 15 a scheduler owner. |
| 24 | Production scheduled trigger runtime | DEFERRED | Requires the future authoritative Phase 4 Schedule/trigger owner. |
| 25 | Re-entry / USER_TIMELINE_REVIEW | RETAIN | Re-entry rechecks all current subject/package/control-plane versions. |
| 26 | Child input | RETAIN | Genuine child input is independent provenance and not universally mandatory; never fabricate it. |
| 27 | A4012 relation | RETAIN | A5002 may observe evidence relevant to an existing trigger but never creates/executes A4012. |
| 28 | Common Core Review boundary | RETAIN | Slice 15 creates no Common Core Review truth. |
| 29 | Phase 3 AI not required for deterministic lifecycle | RETAIN | AI is not required for gates, subject binding, package validation or persistence. |
| 30 | Phase 4 no pull-forward | RETAIN | No Goal/Plan/Task/Checkin/Review/Outcome/Schedule/Notification owner is created. |
| 31 | AI is not review authority | RETAIN | AI cannot approve content or turn missing professional truth into a conclusion. |
| 32 | Case/Formulation currentness | RETAIN | Consume the single Case lifecycle owner and current authoritative Formulation; no exact node-phase shadow machine. |
| 33 | No generic Review/questionnaire/scoring platform | RETAIN | Narrow stream-specific implementation only. |
| 34 | Valid bounded artifact alone may produce REVIEW_COMPLETE | SUPERSEDED | REVIEW_COMPLETE additionally requires a current valid APPROVED+PUBLISHED exact Professional Content Package and package-defined completeness. |
| 35 | Candidate questionnaire fields are the production runtime contract | SUPERSEDED | Candidate fields are not production authority until exact content is professionally approved/published. |
| 36 | Six old A5001 Family dimensions are authoritative production dimensions | SUPERSEDED | Candidate-only; no production authority. |
| 37 | Seven old A5001 Target dimensions are authoritative production dimensions | SUPERSEDED | Candidate-only; no production authority. |
| 38 | Old A5002 execution/effect dimensions are authoritative production dimensions | SUPERSEDED | Candidate-only; no production authority. |
| 39 | Deterministic Phase 2 happy path may complete A5001/A5002 without Professional Content authority | SUPERSEDED | No real model is required, but professional completion requires valid package authority; tests may use a test-only valid-package fixture. |
| 40 | Display wording may be freely refined around fixed candidate dimensions | SUPERSEDED | Exact professional questionnaire/content is package-owned and versioned; presentation cannot invent or alter professional semantics. |
| 41 | Use old candidate dimensions as a production substitute while approval is missing | PROHIBITED | Fail closed instead. |
| 42 | Use AI-generated substitute questionnaire/content when approval is missing | PROHIBITED | Fail closed instead. |
| 43 | Actual A5001/A5002 questionnaire items/prompts | EXTERNAL-AUTHORITY-BLOCKED | Requires real approved/published Professional Content. |
| 44 | Professional required dimensions | EXTERNAL-AUTHORITY-BLOCKED | Requires real Professional approval for exact package content. |
| 45 | Professional scoring | EXTERNAL-AUTHORITY-BLOCKED | No implementation-defined scoring. |
| 46 | Cutoff / success-failure threshold | EXTERNAL-AUTHORITY-BLOCKED | No hard-coded threshold. |
| 47 | Professional/diagnostic/clinical interpretation | EXTERNAL-AUTHORITY-BLOCKED | Requires real Professional approval and package mapping. |
| 48 | Real reviewer/package approval proof for production enablement | EXTERNAL-AUTHORITY-BLOCKED | Current reviewer is UNASSIGNED; no fake proof is allowed. |
| 49 | Old migration slot 022 for Slice 15 | SUPERSEDED | Current main already owns migration 022; future development must re-read then-current migration head and allocate no number in advance. |
| 50 | Old baseline and old upstream-runtime availability assumptions | SUPERSEDED | Current main ff6f8f7... plus PR #52–#55 is the only planning baseline. |

Reconciliation totals:

- RETAIN: 32
- SUPERSEDED: 9
- PROHIBITED: 2
- DEFERRED: 1
- EXTERNAL-AUTHORITY-BLOCKED: 6

---

## A5001 — FAMILY_ALLIANCE_REVIEW Semantics

### Identity

- Canonical node: A5001
- Canonical stream: FAMILY_ALLIANCE_REVIEW
- Canonical role: FAMILY_ALLIANCE_REVIEW
- Manifest phase metadata: REVIEW
- Entry modes: USER_INITIATED, SCHEDULED
- Re-entry reference: USER_TIMELINE_REVIEW
- Terminal topology: REVIEW_COMPLETE only when FAMILY_ALLIANCE_REVIEW_COMPLETE is truthfully established.

A5001 is not A5002 and is not CASE_OVERALL.

### Review-ready subject

A5001 evaluates only the implementation/effect of the real Family Alliance and the current target-list subject for the same Case.

The authoritative subject must be server-resolved from current owners and at minimum bind:

- Family;
- Case;
- current authoritative Problem Formulation dependency;
- Family Alliance subject identity;
- exact target-selection/list revision;
- exact selected target-item identities and revisions;
- relevant target feasibility/progress/help/history refs where they exist;
- Scene package/version identity.

At least one real selected target must exist for a target-list effect subject. The review does not require every selected target to be completed. Partial execution, non-execution and insufficient observation may be real review evidence if the approved package permits those response states.

Slice 15 must not create a second Family Alliance readiness model. If the authoritative Family Alliance owner marks the subject stale, superseded, NEEDS_REVIEW, invalid, or otherwise not current-usable, A5001 is not review-ready until that owner makes the subject valid for review.

### Professional content binding

A5001 professional interaction additionally binds an exact package whose approval scope explicitly authorizes A5001/FAMILY_ALLIANCE_REVIEW for the applicable scene/package version.

An A5002-only package does not authorize A5001 unless its immutable approval scope explicitly includes A5001.

### Completion

A5001 may reach REVIEW_COMPLETE only after all of the following are true in the authoritative operation:

1. exact A5001 subject is review-ready;
2. a valid current APPROVED + PUBLISHED A5001 Professional Content Package resolves;
3. exact package identity/version/hash is verified;
4. approval proof is valid for that exact package and scope;
5. the package-defined required response is complete, with truthful unresolved states where the package allows them;
6. actor, Authorization, RLS, Consent, Compliance and Safety gates pass;
7. source/Evidence refs are valid for the same Family/Case/purpose;
8. expected node, subject and package versions remain current at commit;
9. artifact/state/audit/idempotency settlement is atomic.

A5001 REVIEW_COMPLETE means only:

> the professionally authorized A5001 evaluation interaction for the exact bound subject and exact content definition was validly recorded.

It does not mean the Family Alliance worked, targets succeeded, the Case improved, Outcome exists, Common Core Review completed, or A5002 completed.

---

## A5002 — PHONE_USE_CONTRACT_REVIEW Semantics

### Identity

- Canonical node: A5002
- Canonical stream: PHONE_USE_CONTRACT_REVIEW
- Canonical role: PHONE_USE_CONTRACT_REVIEW
- Manifest phase metadata: REVIEW
- Entry modes: USER_INITIATED, SCHEDULED
- Re-entry reference: USER_TIMELINE_REVIEW
- Terminal topology: REVIEW_COMPLETE only when CONTRACT_REVIEW_COMPLETE is truthfully established.

A5002 is not A5001 and is not CASE_OVERALL.

### Review-ready subject

A5002 evaluates one exact real phone-use Contract version for the same Family/Case.

The server-resolved subject binds at minimum:

- Contract aggregate identity;
- exact Contract version identity;
- exact version/revision token required by the current Contract owner;
- lifecycle/execution status required by the current Contract owner;
- exact source template/package version;
- execution-period context;
- immutable Contract terms identity/fingerprint where the owner exposes it;
- lineage/supersession refs relevant to history;
- Scene package/version identity.

A DRAFT or merely PENDING Contract is not silently promoted into an effect-review subject. For historical review/re-entry, a non-current Contract version may be used only when the authoritative Contract owner explicitly exposes that exact version as a legitimate review subject; Slice 15 must never switch a submission to latest.

### Professional content binding

A5002 professional interaction additionally binds an exact package whose approval scope explicitly authorizes A5002/PHONE_USE_CONTRACT_REVIEW for the applicable scene/package version.

An A5001-only package does not authorize A5002 unless its immutable approval scope explicitly includes A5002.

### A4012 boundary

A5002 may preserve review evidence that is relevant to an already-authorized A4012 trigger condition.

A5002 must never:

- create A4012;
- execute A4012;
- create or activate a new Contract version;
- supersede the Contract;
- fabricate mutual confirmation;
- invent an A5002 to A4012 route.

A4012 remains owned by the current Phone Use Contract owner.

### Completion

A5002 may reach REVIEW_COMPLETE only when the same Professional Content, control-plane, version, provenance and atomicity gates defined for A5001 pass for the exact A5002 subject and package.

A5002 REVIEW_COMPLETE does not mean the Contract succeeded or failed, does not create a new Contract, does not execute A4012, and does not imply A5001/Common Core Review/Outcome completion.

---

## Independent Eligibility and Case / Formulation Currentness

A5001 and A5002 are independently eligible.

- A5001 does not wait for A5002.
- A5002 does not wait for A5001.
- A5001 completion does not unlock or complete A5002.
- A5002 completion does not unlock or complete A5001.
- If one stream was never used or is not applicable, no fake review is created for it.
- If both streams are applicable, overall V1 two-lane review completeness requires both applicable professional reviews to complete truthfully.

Case phase is a single coarse Common Core truth. A5001/A5002 must not create a second phase machine or require node.phase == cases.phase exact equality.

The current authoritative Problem Formulation must still be a legal execution/review basis. Material correction/reassessment of Formulation uses the Common Core owner and causes only genuinely affected downstream subjects/reviews to become NEEDS_REVIEW/blocked/invalid according to their owners.

---

## Professional Content Package Dependency

### Required package proof

Before any production professional questionnaire is shown, accepted, interpreted or completed, Slice 15 must resolve one exact current Professional Content Package carrying at least:

- artifact_id or package_id;
- content_version;
- immutable content_hash;
- source_refs;
- approval_scope;
- review_status;
- reviewer_identity;
- reviewer_qualification_ref;
- reviewed_at;
- effective_from;
- effective_to where applicable;
- published_at;
- package lifecycle/status sufficient to prove APPROVED and PUBLISHED.

The resolver must verify the loaded content against the exact identity/version/hash. A version label without a matching hash is insufficient.

### Validity rules

A package is unavailable for new production evaluation when any of these is true:

- missing;
- DRAFT/CANDIDATE;
- pending Professional review;
- unapproved;
- approved but unpublished;
- expired;
- retired;
- superseded for new use;
- outside effective period;
- approval scope does not cover the exact node/stream/use;
- content version does not match;
- content hash does not match;
- source/approval identity cannot be verified;
- reviewer approval proof is invalid, revoked, mismatched or unverifiable;
- the professional owner reports the package is not production-selectable.

There is no nearest-version, old-version, candidate, AI, fixture, or hard-coded fallback in production.

### Owner boundary

Slice 15 consumes Professional Content Package proof. It does not create a generic package/approval platform.

Current Authority defines the required proof but current main does not establish an APPROVED/PUBLISHED A5001/A5002 package or a real assigned Professional Reviewer.

Until a designated owner exists, the dependency is an external implementation/release gate. Plan AI 2 may define the narrow consumer port needed by Slice 15, but must not invent the external authority system behind that port.

---

## Professional Reviewer Dependency

Current organization-level state is:

> APPROVED PROFESSIONAL REVIEWER — UNASSIGNED

A valid approval must ultimately be traceable to a real human reviewer with:

- real Staff assignment;
- PROFESSIONAL_REVIEW capability;
- qualification/scope matching the exact reviewed content;
- auditable reviewer identity;
- approval bound to the exact package/version/hash;
- approval scope;
- reviewed_at;
- valid approval status/effective publication state.

Slice 15 may validate/consume this proof. It must not create:

- reviewer identities;
- credential verification;
- qualification database;
- HR/staff platform;
- license database;
- marketplace;
- generic approval workflow.

A reviewer later becoming unavailable does not by itself let Slice 15 guess whether an already-issued approval remains valid. The authoritative approval owner decides validity/revocation; Slice 15 consumes that result.

---

## Fail-Closed Production Behavior

When a real review-ready subject exists but the Professional Content Package is absent or invalid, production must truthfully fail closed.

### Production may

- show that professional assessment is currently unavailable or pending approval;
- expose non-professional subject readiness without pretending the professional evaluation exists;
- keep existing Family Alliance or Phone Contract workflow state;
- preserve lawful historical reviews and their exact old package identity;
- preserve existing Evidence/history;
- record an ordinary audit/failure event through existing owners if repository conventions require it;
- allow the independent sibling stream to continue according to its own prerequisites.

### Production must not

- display the old candidate dimensions as an approved questionnaire;
- display an AI-generated substitute questionnaire;
- accept a professional review response against unapproved content;
- create a completed professional evaluation artifact;
- calculate a score, cutoff result, success/failure result or professional conclusion;
- fabricate package identity/hash;
- fabricate Professional approval;
- use approved=true as circular proof;
- mark A5001 or A5002 REVIEW_COMPLETE;
- complete the sibling stream;
- create Outcome/Common Core Review;
- turn missing professional authority into A4003-style HOLD semantics by analogy unless the authoritative A5001/A5002 owner explicitly defines such a state;
- invent a permanent BLOCKED state merely because the package is currently unavailable.

The stable semantic result is professional-content-unavailable/pending-approval. The exact API error/status vocabulary is selected by Plan AI 2 from the then-current repository vocabulary; this Spec does not invent a second global error model.

---

## REVIEW_COMPLETE Semantics

REVIEW_COMPLETE remains a canonical Scene terminal, but the old completion predicate is superseded.

For A5001 or A5002, REVIEW_COMPLETE is legal only when:

- the exact stream subject is review-ready;
- the exact Professional Content Package is current, approved, published, in scope and hash-verified;
- package-defined response completeness is satisfied;
- all current actor/Authorization/RLS/Consent/Compliance/Safety gates pass;
- current Case/Formulation/Scene/subject/package versions pass commit-time validation;
- provenance is complete;
- the authoritative artifact and Scene State update settle atomically.

Without a valid package, no valid response can be considered a completed professional assessment, even if an old schema can parse the payload.

Historical completion remains historical truth bound to its original package. Later package retirement/supersession does not rewrite the past; current use/validity may require reassessment or NEEDS_REVIEW according to the authoritative package/dependency owner.

REVIEW_COMPLETE never means:

- professional success;
- clinical success;
- target achieved;
- Contract effective;
- Outcome;
- Case closure;
- Common Core Review completion;
- sibling review completion.

---

## Artifact Semantics

Slice 15 may extend the existing authoritative Scene Artifact vocabulary with two narrow discriminators:

- DIGITAL_USE_A5001_EFFECT_EVALUATION
- DIGITAL_USE_A5002_EFFECT_EVALUATION

These are Scene-local professional evaluation records, not a generic Review aggregate.

Every completed artifact must bind:

- case/family context through authoritative owner;
- node and stream;
- scene/package version;
- artifact schema version;
- exact subject identity/version/revisions;
- exact Professional Content package id/version/hash;
- approval-proof reference or equivalent immutable proof identity;
- source_refs;
- evidence_refs;
- submitted_by provenance;
- created_at;
- artifact revision;
- supersedes/previous revision where applicable;
- package-defined response payload or normalized response identity;
- explicit unresolved states where the approved package permits them.

The artifact must not duplicate the Professional Content Package body as a second content owner. It binds the immutable package identity/hash.

No single opaque cross-stream artifact is allowed.

---

## Evidence and Provenance

Evidence remains the factual truth owner.

If a review submission contains substantive family observations intended for reuse outside the questionnaire response, those observations must be written through or referenced from the authoritative Evidence owner.

Rules:

- parent statement remains parent-sourced;
- genuine child input remains child-sourced;
- parent-transcribed child opinion is not silently upgraded to child source;
- AI text is not family Evidence merely because it appears in a review flow;
- professional questionnaire response and professional interpretation are not automatically family Fact;
- conflicting sources remain conflicting;
- UNKNOWN / NOT_COLLECTED / DECLINED remain explicit;
- source refs must be scope-valid for the same authorized Family/Case/purpose.

Professional package provenance and family Evidence provenance are different truths and must not be collapsed.

---

## History, Revision, Supersession and Re-entry

A completed review is immutable historical truth for:

- exact subject version;
- exact package version/hash;
- exact response;
- exact provenance;
- exact approval proof used at the time.

Corrections and reassessments create a new review artifact/revision/instance and reference the previous one. They do not UPDATE the old past into a new past.

A new Professional Content Package version:

- does not rewrite old reviews;
- cannot silently reinterpret old responses;
- requires new approval for its own exact content;
- may be used only for new eligible review/reassessment after it is valid for production.

A retired/expired/superseded package is not accepted for a new submission.

Every re-entry rechecks:

- Case/current primary state as applicable;
- authoritative Formulation currentness;
- subject currentness/version;
- exact package currentness/version/hash/scope;
- approval validity;
- Authorization;
- RLS;
- Consent;
- Compliance;
- Safety;
- node revision;
- idempotency.

---

## Authorization, RLS, Consent, Compliance and Safety

These are independent gates.

### Authorization

- server-side current Authorization decides allowed read/write action;
- participant presence alone grants no review privilege;
- UI visibility never grants authority;
- cross-Family/cross-Case/other-subject references fail without enumeration leakage.

### RLS

- current PostgreSQL RLS remains the database isolation backstop;
- no new bypass role or second family-isolation system is created;
- review persistence must work under the current runtime-role/RLS model.

### Consent

- consume the current purpose-bound Consent owner;
- missing/revoked required Consent blocks new affected processing;
- historical records are not silently deleted by a review command;
- Slice 15 does not create a private review_consent truth.

### Compliance

- consume the current Compliance owner;
- missing/ambiguous/unverified required Compliance/Legal Authority result fails closed according to that owner;
- Slice 15 does not invent guardian, minor, jurisdiction, PIPIA or regulatory rules.

### Safety

- consume current deterministic Safety precheck/hold owner;
- Safety Hold blocks ordinary review progression;
- professional approval never bypasses Safety;
- Slice 15 cannot resolve Safety Hold or redefine risk rules.

No gate can be overridden by another gate returning ALLOW.

---

## Idempotency

Slice 15 reuses the current authoritative idempotency owner.

The canonical request identity must distinguish at least:

- actor;
- Case;
- node A5001 vs A5002;
- stream;
- exact subject identity;
- exact subject revisions/version;
- expected Scene node revision;
- scene/package version;
- exact Professional Content package id/version/hash;
- normalized validated response.

Required behavior:

- same key + same canonical request returns the original committed result;
- same key + different canonical request conflicts;
- failed transaction does not settle success;
- A5001 and A5002 cannot collide under one opaque review command identity.

---

## Concurrency

No last-write-wins is permitted for high-impact review completion.

At commit time the authoritative transaction must detect drift in:

- Case/currentness where applicable;
- Formulation dependency;
- Scene node revision;
- A5001 target-list/target revisions;
- A5002 exact Contract version/revision;
- Professional Content package identity/version/hash/status;
- approval validity where the owner exposes a version/revision;
- Consent/Compliance/Safety state where required by owner contracts.

Concurrent same-node submissions against one expected revision produce at most one current winning revision. The stale writer receives a truthful conflict/retry outcome.

A5001 writes must not overwrite A5002 and vice versa.

---

## Atomicity

A successful professional review submission must settle, as applicable, in one authoritative logical transaction:

- validated/referenced Evidence effects;
- typed Scene Artifact revision;
- Scene node current projection/revision;
- business audit/case event;
- idempotency settlement.

The transaction must not mutate Family Alliance target truth or Contract truth as a side effect of review.

A package/approval/subject/gate change detected before commit prevents REVIEW_COMPLETE and leaves no partial completed review residue.

Infrastructure failure remains infrastructure failure and is not business success or professional invalidity.

---

## USER_INITIATED and SCHEDULED Entry

### USER_INITIATED

USER_INITIATED is a real Slice 15 production entry mode only when:

- exact stream subject is review-ready;
- valid exact Professional Content package exists;
- current control-plane and version gates pass;
- authorized actor explicitly initiates the review.

If the subject is ready but professional content is unavailable, return the fail-closed unavailable semantic result and do not complete the node.

### SCHEDULED

SCHEDULED remains a manifest eligibility only.

Slice 15 does not create:

- schedule rows;
- cron/timer;
- pg-boss job;
- notification;
- delivery/read state.

Before the Phase 4 Schedule/trigger owner exists, production SCHEDULED execution is truthfully unavailable.

A test-only synthetic scheduled-trigger fixture may validate entry semantics but must be structurally unable to masquerade as production authority.

A future authentic trigger never bypasses current subject/package/Auth/Consent/Compliance/Safety/version gates.

---

## A4012 Boundary

A5002 may record or reference observations that a package-approved review says are relevant to an already-defined A4012 trigger.

That observation is not Contract mutation.

A5002 cannot:

- create an A4012 command;
- activate A4012;
- create a Contract draft;
- confirm parties;
- supersede an active Contract;
- invent an adjustment condition;
- treat a professional interpretation as mutual agreement.

Any later Contract change is a separate authorized A4012 operation owned by the Contract runtime.

---

## AI Boundary

AI is not a substitute for Professional Authority.

AI may later assist, within approved boundaries, with:

- natural-language interaction around approved questionnaire content;
- explanation of approved content;
- summarization of user-provided material;
- drafting non-authoritative support text.

AI must not:

- generate substitute questionnaire items for production;
- define professional dimensions;
- score or set cutoffs;
- determine success/failure;
- issue professional/clinical conclusions without an approved mapping;
- fabricate package/reviewer approval;
- invent family observations;
- impersonate a child;
- choose a sibling stream contrary to subject truth;
- bypass Authorization/Consent/Compliance/Safety;
- complete A5001/A5002 without the exact approved package.

No real model call is required to implement or test Slice 15 lifecycle/gating correctness.

---

## Common Core Review and Phase Boundaries

### Phase 2

Slice 15 remains the final bounded Digital Use Scene review runtime.

Its responsibility is narrow Scene-local subject/package-gated evaluation capture and terminal semantics.

### Phase 3

Professional Knowledge, RAG, AI runtime and model execution do not become Slice 15 owners.

The absence of Phase 3 AI is not a reason to relax professional approval.

### Phase 4

Common Core Review, Outcome, Goal, Plan, Task, Checkin, Follow-up Schedule, pg-boss and Notification remain Phase 4.

Slice 15 must not create:

- reviews table or Review aggregate;
- generic review_scope owner;
- CASE_OVERALL;
- Outcome;
- next_action authority;
- Plan adjustment;
- scheduler/notification truth.

Future Common Core Review may consume the preserved A5001/A5002 artifacts/Evidence as inputs under its own authority. It does not retroactively become the owner of Slice 15 history.

---

## Migration Expectations

Plan AI 1 creates no migration.

Current main migration head is:

- 022_foundation_remaining_consent_chain_integrity.sql
- blob 4c7af9c2d2c26b7f244050c82518f16dc25f0973

PR #39's historical 022_digital_use_review_runtime.sql is therefore not reusable as migration 022.

Plan AI 2 / Developer AI must:

1. re-read the then-current migration head;
2. inspect the then-current authoritative Scene Artifact/State schema;
3. prefer no migration if the existing owner can represent the required narrow artifacts safely;
4. if an additive owner extension is unavoidable, allocate the next then-current migration number at development time;
5. never edit historical migrations;
6. never create a generic reviews table for Slice 15;
7. preserve RLS and authoritative runtime-role boundaries.

No migration number is frozen by this Spec.

---

## Old PR #39 Implementation Disposition

PR #39 is prior implementation evidence only. Nothing in it is Authority.

| PR #39 area | Disposition | Required treatment |
|---|---|---|
| A5001/A5002 node and stream identities | KEEP | Reuse only because current Manifest/Authority independently confirms them. |
| Exact A5002 Contract/version/revision binding concept | KEEP | Reconcile to current Contract owner; never latest-switch. |
| A5001 target-list/target revision binding concept | KEEP | Reconcile to current Family Alliance owner/currentness semantics. |
| Distinct Scene Artifact discriminator concept | KEEP | Keep narrow separation if current owner supports it. |
| Provenance/history/idempotency/concurrency/atomicity concepts | KEEP | Re-derive against current main owner seams. |
| A4012 observe-only boundary | KEEP | Current Authority independently confirms it. |
| packages/contracts/src/digital-use-review-schemas.ts | REPLACE | Old hard-coded candidate dimensions cannot be the production professional contract. New contract must be package-driven or package-bound. |
| digital-use-family-alliance-review.ts production completion logic | DISABLE | It must not accept candidate dimensions and emit REVIEW_COMPLETE without valid package authority. |
| digital-use-phone-contract-review.ts production completion logic | DISABLE | Same: add exact package/approval gate and current-owner reconciliation before any completion path. |
| Candidate A5001 six Family + seven Target dimensions | NOT AUTHORITY | May remain only as historical/candidate/test evidence; cannot be production semantics absent real approval. |
| Candidate A5002 dimensions | NOT AUTHORITY | Same. |
| Old review happy-path tests asserting candidate payload → REVIEW_COMPLETE | REPLACE | Replace with package-gated positive path and fail-closed no-package cases. |
| Old no-real-model deterministic concept | ADAPT | Keep no-model requirement, but positive professional completion needs a structurally test-only valid package fixture. |
| digital-use-node-response review integration patch | ADAPT | Reconcile current main; server-resolved subject/package identity must feed validation/idempotency. |
| digital-use-assessment A5001/A5002 reachability patch | ADAPT | Reachability must reflect current subject/lifecycle and package availability without creating a second phase machine. |
| SCHEDULED untrusted-claim rejection concept | ADAPT | Preserve truthful unavailable boundary using current API/error vocabulary. |
| Family Alliance gate exports / shared seams | ADAPT | Re-read current main; expose only a narrow owner-approved seam if still needed. |
| PR #39 digital-use-phone-contract-gates.ts | NOT AUTHORITY | File is absent from current main; do not transplant it merely because it once worked. |
| PR #39 Phone Contract service edits | NOT AUTHORITY | Current main has later PR #54/#55 convergence; re-derive against current service. |
| scene-runtime-repository artifact vocabulary extension | ADAPT | Add only if current authoritative owner still needs explicit enum/schema extension. |
| phone-use-contract repository history-list helper | ADAPT | Reuse only if current owner lacks equivalent capability and exact history binding requires it. |
| db/migrations/022_digital_use_review_runtime.sql | DELETE | Never cherry-pick/reuse; slot 022 is occupied by current main. A future additive migration, if any, gets a then-current number. |
| Generated OpenAPI/client changes | REPLACE | Regenerate only from the new authoritative package-gated API contract. |
| Old Slice15 spec/plan/checklist/tasks inside PR #39 | NOT AUTHORITY | Preserve as history; do not edit to make old governance green. |

DELETE here means delete/omit that historical PR #39 implementation delta from any rebased/new implementation path; it does not authorize rewriting Git history.

---

## Development Gates

Development may begin only after Plan AI 2 re-reads then-current remote truth and proves each gate.

### Baseline gate

- exact origin/main recorded;
- no unreviewed base drift;
- four Authority Docs exact blobs recorded;
- this superseding Frozen Spec exact blob recorded;
- historical old Spec remains untouched;
- PR #39 is treated only as evidence.

### Professional Authority gate

For production enablement:

- designated Professional Content Package owner is known;
- exact A5001/A5002 package availability is read from that owner;
- package proof supports identity/version/hash/scope/state/effective period;
- Professional Reviewer approval proof is real and valid;
- no candidate/hard-coded/test package is allowed in production.

Current state at this freeze:

- Reviewer: UNASSIGNED
- A5001/A5002 approved/published package: UNAVAILABLE / NOT PROVEN
- production professional evaluation enablement: BLOCKED

This does not block implementation of the fail-closed consumer path.

### Runtime owner gates

Plan AI 2 must re-read the then-current owners for:

- Case lifecycle / phase;
- Problem Formulation currentness;
- Scene Manifest/routing;
- Scene State;
- Scene Artifact;
- Family Alliance / target selection / feasibility / progress / help history;
- Phone Use Contract / version / revision / supersession history;
- Evidence;
- Authorization;
- RLS;
- Consent;
- Compliance;
- Safety;
- idempotency;
- business audit/event;
- migration head.

If safe implementation would require a second owner, STOP.

### Baseline regression gate

Slice 15 must preserve the PR #55/current-main legal E2E boundary, including:

- A1001 → A2010 continuity;
- A3000 and A4001 independent parallel availability;
- A4003 dependency/professional-content unavailable → HOLD with no fake completion;
- Family Alliance continuing independently while A4003 is held.

### Package-drift gate

A package must be revalidated at commit time or through an equivalent authoritative version/CAS guarantee. Hash/version/status/scope drift invalidates the pending completion.

### Legal/Compliance gate

Slice 15 does not solve the separate LEGAL AUTHORITY — UNASSIGNED dependency. Where the current Consent/Compliance owner requires a valid Legal Authority artifact for the specific processing, it fails closed. Slice 15 must consume that result rather than inventing legal scope.

---

## Engineering Completion vs Production Enablement

### Can Slice 15 be engineering-complete while Reviewer is UNASSIGNED?

YES.

Current Authority explicitly defines both:

1. the non-professional lifecycle/runtime contract; and
2. the required fail-closed behavior when Professional Content is absent.

Therefore engineering completion does not require fabricating a real Professional package.

Slice 15 engineering completion may be declared only when:

- A5001/A5002 subject/lifecycle infrastructure is implemented against current owners;
- production default truthfully fails closed without an approved package;
- no candidate questionnaire is exposed as professional content;
- no REVIEW_COMPLETE occurs without valid authority;
- a test-only exact valid-package fixture proves the future legal positive path mechanically;
- the fixture is structurally separated from production configuration and cannot satisfy release readiness;
- all other acceptance/negative-space gates pass;
- independent Audit 2 passes.

Engineering completion is not production professional-content readiness and not full V1 release readiness.

### Current selected implementation path

Path B — lifecycle + fail-closed Professional Content gate.

Path A becomes a production enablement state only after real external authority exists; it does not require rewriting this Spec.

---

## Later Slice Dependency

NO LATER SLICE DEPENDENCY.

Reconciliation evidence:

- Slice 16 owns Psychological / Behavioral Intervention definitions, not the A5001/A5002 Professional Content Package, and its own frozen dependency expects Slice 15 to merge first.
- Slice 17 owns professional explanatory/knowledge content, not A5001/A5002 review questionnaire authority.
- Slice 18 owns retrieval Gold Dataset evaluation truth, not A5001/A5002 questionnaire authority.
- Slice 19 is pgvector readiness and explicitly records the real Professional Reviewer/staff-authority gap as external/deferred rather than inventing it.

Therefore no Slice 16–19 owner must precede Slice 15.

The real dependency is external Professional Authority/package availability for production enablement, not a later Slice ordering dependency.

---

## Requirements

### Identity and separation

- **FR-001 [UPSTREAM: A5001/V1-D27]** A5001 SHALL remain FAMILY_ALLIANCE_REVIEW.
- **FR-002 [UPSTREAM: A5002/V1-D28]** A5002 SHALL remain PHONE_USE_CONTRACT_REVIEW.
- **FR-003 [UPSTREAM: V1-D29]** The two streams SHALL have independent eligibility, subjects, artifacts and completion.
- **FR-004 [UPSTREAM: V1-D29]** Neither stream SHALL force, unlock, complete or overwrite the other.

### Subject and lifecycle

- **FR-005 [UPSTREAM: A5001]** A5001 SHALL bind the exact authoritative Family Alliance/target-list subject and revisions.
- **FR-006 [UPSTREAM: A5002]** A5002 SHALL bind the exact authoritative Contract identity/version/revision and SHALL NOT switch to latest.
- **FR-007 [UPSTREAM: V1-D27/V1-D28]** Re-entry SHALL preserve prior history and create a new revision/instance when required.
- **FR-008 [UPSTREAM: Docs/V1产品需求.md §2.4]** Material upstream invalidation SHALL use current validity/NEEDS_REVIEW semantics rather than destructive lifecycle rewriting.

### Professional Content

- **FR-009 [UPSTREAM: Docs/V1产品需求.md §F]** Production professional interaction SHALL require a current exact APPROVED+PUBLISHED package.
- **FR-010 [UPSTREAM: Docs/V1技术设计.md §12.3B.5]** Package proof SHALL bind identity/version/hash/source refs/scope/reviewer proof/reviewed-at/effective/published state.
- **FR-011 [UPSTREAM: Docs/V1产品需求.md §F]** Old candidate dimensions SHALL NOT become production authority.
- **FR-012 [UPSTREAM: Docs/V1产品需求.md §F]** Missing/invalid professional content SHALL fail closed.
- **FR-013 [UPSTREAM: Docs/V1产品需求.md §F]** No production REVIEW_COMPLETE SHALL occur without valid package authority.
- **FR-014 [UPSTREAM: Docs/总体技术架构.md §19A.4]** Code/test/schema flags SHALL NOT manufacture approval.
- **FR-015 [UPSTREAM: Docs/V1产品需求.md §F]** Actual questionnaire/scoring/cutoff/professional interpretation SHALL remain external-authority-owned.

### Persistence/provenance

- **FR-016 [UPSTREAM: Docs/V1技术设计.md §7.4/§8]** Slice 15 SHALL reuse current Scene State/Artifact owners and create no generic Review owner.
- **FR-017 [UPSTREAM: Docs/V1产品需求.md §2.2]** Family factual observations SHALL remain Evidence-owner truth with source provenance.
- **FR-018 [UPSTREAM: Docs/V1产品需求.md §17]** Historical review/package/subject identities SHALL remain immutable and traceable.
- **FR-019 [UPSTREAM: Docs/V1技术设计.md §8.5]** Existing idempotency SHALL be reused.
- **FR-020 [UPSTREAM: Docs/V1技术设计.md §8.6/§30]** Stale concurrent writes SHALL fail truthfully.
- **FR-021 [UPSTREAM: Docs/V1技术设计.md §29/§30]** Successful effects SHALL settle atomically.

### Control planes

- **FR-022 [UPSTREAM: Docs/V1产品需求.md §18]** Authorization and RLS SHALL remain independent mandatory gates.
- **FR-023 [UPSTREAM: Docs/V1产品需求.md §17.3/§18]** Consent SHALL remain an independent purpose-bound gate.
- **FR-024 [UPSTREAM: Docs/V1产品需求.md §19A]** Compliance SHALL remain an independent gate.
- **FR-025 [UPSTREAM: Docs/V1产品需求.md §20]** Safety SHALL remain an independent gate and Slice 15 SHALL NOT resolve Safety Hold.
- **FR-026 [UPSTREAM: Docs/V1产品需求.md §19]** AI SHALL NOT substitute for professional authority or family fact.

### Phase boundaries

- **FR-027 [UPSTREAM: Docs/V1技术设计.md §38]** Slice 15 SHALL create no Common Core Review/Outcome/Plan/Task/Checkin/Schedule/Notification truth.
- **FR-028 [UPSTREAM: Docs/V1技术设计.md §38]** No real AI/model call SHALL be required for deterministic lifecycle/gate verification.
- **FR-029 [UPSTREAM: A4012]** A5002 SHALL NOT execute Contract revision.
- **FR-030 [UPSTREAM: A5001/A5002]** SCHEDULED SHALL remain entry eligibility only until the authoritative Phase 4 trigger owner exists.

---

## Acceptance Scenarios

### Professional Content gate

1. **Given** a valid A5001 subject and no approved/published A5001 package, **when** the user initiates A5001, **then** professional assessment is unavailable/pending approval and A5001 does not reach REVIEW_COMPLETE.
2. **Given** a valid A5002 subject and no approved/published A5002 package, **when** the user initiates A5002, **then** professional assessment is unavailable/pending approval and A5002 does not reach REVIEW_COMPLETE.
3. **Given** a package that is expired, **when** a new review is attempted, **then** fail closed with no completed professional artifact/state.
4. **Given** a package that is retired, **when** a new review is attempted, **then** fail closed.
5. **Given** a package that is superseded for new use, **when** a new review is attempted, **then** fail closed rather than choosing the old version.
6. **Given** package metadata whose content version or content hash does not match the loaded content, **when** review starts/commits, **then** fail closed.
7. **Given** reviewer proof that is unassigned, invalid, revoked, mismatched in qualification/scope, or unverifiable under the approval owner, **when** package validity is checked, **then** fail closed.
8. **Given** an exact package that is APPROVED, PUBLISHED, effective, hash-valid and scope-valid with valid reviewer proof, **when** the matching subject and all control gates pass, **then** the legal evaluation path may proceed.
9. **Given** an A5001-only approved package, **when** A5002 is attempted, **then** the package does not authorize A5002 unless exact approval scope explicitly includes it.
10. **Given** an A5002-only approved package, **when** A5001 is attempted, **then** the package does not authorize A5001 unless exact approval scope explicitly includes it.
11. **Given** old candidate dimensions but no valid package, **when** production review is attempted, **then** those dimensions are not shown/accepted as approved professional content.
12. **Given** missing professional content, **when** an AI could generate plausible questions, **then** no substitute questionnaire/scoring/conclusion is produced.

### REVIEW_COMPLETE

13. **Given** a parseable old candidate payload but no valid package, **when** submitted, **then** no REVIEW_COMPLETE is recorded.
14. **Given** a complete package-defined response and valid exact package/subject/control gates, **when** atomically committed, **then** the matching node may reach REVIEW_COMPLETE.
15. **Given** A5001 reaches REVIEW_COMPLETE, **then** A5002, Common Core Review, Outcome and Case closure remain unchanged unless separately authorized.
16. **Given** A5002 reaches REVIEW_COMPLETE, **then** A5001, Common Core Review, Outcome and Case closure remain unchanged unless separately authorized.
17. **Given** a historical completed review whose package is later retired, **then** the historical record retains the old package id/version/hash and is not rewritten.
18. **Given** a new package version, **then** old reviews keep their old content definition and any reassessment creates a new revision/instance.

### Subject binding and independence

19. **Given** an A5001 submission, **then** it binds the exact Family Alliance target selection and selected target revisions resolved by the current owner.
20. **Given** a partially executed target list, **then** lack of all-target completion does not by itself make the subject impossible to review.
21. **Given** an A5002 review, **then** it binds one exact Contract version and cannot silently switch to a newer Contract.
22. **Given** a stale Contract/target revision, **when** commit occurs, **then** the stale writer fails without last-write-wins.
23. **Given** A5001 is ready and A5002 is not, **then** A5001 does not wait for A5002.
24. **Given** A5002 is ready and A5001 is not, **then** A5002 does not wait for A5001.
25. **Given** one stream was never used/not applicable, **then** no fake review is created for it.

### Provenance and child input

26. **Given** genuine child input, **then** child provenance remains distinct and current Consent/Authorization applies.
27. **Given** parent-transcribed child opinion, **then** it is not relabeled as child-authored.
28. **Given** no child input, **then** no child data is fabricated; absence is not universally treated as a completion blocker unless the exact approved package requires it.
29. **Given** UNKNOWN/NOT_COLLECTED/DECLINED permitted by the package, **then** those states remain explicit and are not converted to negative/zero.

### Package/history currentness

30. **Given** a package changes between initial validation and commit, **then** the pending completion fails or retries against current authority.
31. **Given** a materially corrected upstream Formulation invalidates the review subject, **then** the stale subject cannot complete under the old currentness.
32. **Given** a valid historical review, **then** later target/Contract/package changes do not mutate that historical artifact.

### Authorization/RLS/Consent/Compliance/Safety

33. **Given** wrong Family/Case/subject refs, **then** application authorization and RLS prevent cross-family/cross-case use without enumeration leakage.
34. **Given** participant membership but no required action privilege, **then** review submit is denied.
35. **Given** required Consent revoked before commit, **then** no completed review residue is committed.
36. **Given** Compliance denies or required legal applicability is unavailable, **then** fail closed.
37. **Given** Safety Hold, **then** ordinary A5001/A5002 completion is blocked and Slice 15 does not resolve the hold.
38. **Given** professional approval is valid, **when** Safety/Compliance/Consent denies, **then** approval does not override the denial.

### Idempotency/concurrency/atomicity

39. **Given** same idempotency key and same canonical A5001 request including package identity/hash, **then** return the original committed result.
40. **Given** same key with a different package/subject/response, **then** return idempotency conflict.
41. **Given** two concurrent same-node submissions at one expected revision, **then** at most one becomes current.
42. **Given** failure after Evidence work but before final artifact/state/idempotency settlement, **then** no partial successful review remains.
43. **Given** concurrent A5001/A5002 work, **then** neither overwrites or semantically completes the other.

### A4012 / scheduling / phase boundaries

44. **Given** A5002 evidence relevant to an approved A4012 trigger, **then** it may record/reference the observation but does not create/execute A4012 or a Contract revision.
45. **Given** production claims SCHEDULED without an authentic Phase 4 trigger, **then** scheduled capability is unavailable and no job/schedule/notification truth is created.
46. **Given** USER_INITIATED with a valid package and all gates, **then** Phase 4 Schedule absence does not block the user-initiated path.
47. **Given** Slice 15 completion, **then** no generic reviews table/API, CASE_OVERALL, Outcome, Goal/Plan/Task/Checkin, Schedule, pg-boss or Notification truth exists because of Slice 15.
48. **Given** the current PR #55 Golden E2E baseline, **then** Slice 15 changes do not regress A1001→A2010, A3000/A4001 parallel lanes, A4003 HOLD, or Family Alliance independence.
49. **Given** no real model, **then** all lifecycle, package-gate, provenance, authorization, concurrency and fail-closed tests remain deterministic.
50. **Given** a test-only valid-package fixture, **then** it can prove the future positive path but cannot make production or release readiness appear approved.

---

## Edge, Failure, and Unknown States

The implementation must preserve distinct semantics for:

- no review-ready subject;
- stale subject;
- subject NEEDS_REVIEW;
- package missing;
- package unapproved;
- package approved but unpublished;
- package expired;
- package retired;
- package superseded;
- package scope mismatch;
- package version mismatch;
- package hash mismatch;
- reviewer proof invalid/unverifiable;
- incomplete package-defined response;
- UNKNOWN;
- NOT_COLLECTED;
- DECLINED;
- conflicting Evidence;
- authorization denial;
- RLS denial;
- Consent missing/revoked;
- Compliance blocked/unavailable;
- Safety Hold;
- stale node revision;
- stale Case/Formulation dependency;
- idempotency mismatch;
- concurrent stale writer;
- scheduled trigger unavailable;
- infrastructure failure.

None may be silently converted into professional success or REVIEW_COMPLETE.

---

## Negative-Space Requirements

A Slice 15 implementation is invalid if it introduces or relies on any of the following:

- old candidate dimensions becoming production Professional Authority;
- AI-generated substitute questionnaire;
- AI-generated professional scoring;
- generic scoring engine;
- hard-coded professional success threshold/cutoff;
- generic Review owner;
- reviews table/repository/API owned by Slice 15;
- CASE_OVERALL;
- second Scene State owner;
- second Scene Artifact owner;
- second Evidence owner;
- second Consent owner;
- second Safety owner;
- second Compliance owner;
- second Authorization/RLS owner;
- second Contract owner;
- second Case phase owner;
- fake Professional approval;
- approved=true without a real approval artifact;
- hard-coded reviewer bypass;
- fake reviewer identity/qualification;
- generic Professional Reviewer/RBAC/HR/marketplace platform;
- generic Professional Content Platform/CMS/workflow created by Slice 15;
- A5001/A5002 semantic collapse;
- A5001 → A5002 forced sequence;
- A5002 → A5001 forced sequence;
- A5002 executing A4012;
- A5002 creating/superseding/activating Contract;
- Phase 3 AI/RAG pulled forward to compensate for missing authority;
- Phase 4 Common Core Review pulled forward;
- Outcome/Goal/Plan/Task/Checkin pull-forward;
- scheduler/notification pull-forward;
- fake SCHEDULED trigger;
- fake child input;
- exact node.phase == cases.phase used as a generic authorization rule;
- reuse of PR #39 migration slot 022;
- modification of Docs/**;
- mutation of the historical Slice 15 Frozen Spec/planning package;
- weakening PR #55 baseline behavior to make Slice 15 pass.

---

## Acceptance Evidence

This Plan AI 1 artifact does not implement or run the future feature. The following evidence is mandatory for later completion.

| Acceptance item | Verification type | Required evidence |
|---|---|---|
| Authority/package fail-closed | domain + integration | no-package, unapproved, unpublished, expired, retired, superseded, wrong-hash, wrong-scope and invalid-reviewer tests |
| Valid package positive path | domain + integration | structurally test-only exact APPROVED+PUBLISHED package fixture; matching hash/scope/reviewer proof; successful exact subject completion |
| Production/test separation | architecture/static guard | proof the fixture cannot satisfy production configuration/release readiness |
| A5001/A5002 separation | domain + integration | cross-stream payload/package/subject rejection and sibling incompletion |
| A5001 subject binding | integration + DB readback | exact target selection/target revisions/package identity persisted |
| A5002 subject binding | integration + DB readback | exact Contract identity/version/revision/package identity persisted; no latest switch |
| History/reassessment | integration + DB readback | old subject/package versions preserved; new revision appended |
| Evidence/provenance | integration + DB | parent/child/source distinctions and Evidence owner refs preserved |
| Authorization/RLS | security + DB | wrong-family/case/actor/source negative tests under forced RLS |
| Consent/Compliance/Safety | integration | each independent gate blocks completion with zero completed residue |
| Idempotency | integration | replay/mismatch/package-change behavior |
| Concurrency | barrier-based integration | one winner per expected revision; stale writer fails |
| Atomicity | fault injection + DB readback | no partial Evidence/artifact/state/audit/idempotency success |
| A4012 boundary | integration | review observation creates no Contract revision/A4012 execution |
| Phase 4 negative space | architecture/static guard | no generic Review/Outcome/Plan/Task/Checkin/Schedule/Notification owner introduced |
| Migration | migration + upgrade verification | then-current additive migration only if required; historical migration untouched |
| Baseline non-regression | current Golden E2E | A1001→A2010, parallel A3000/A4001, A4003 HOLD, Family Alliance independence still pass |
| Governance | repository validator | spec/plan/tasks lifecycle validation appropriate to the current stage |
| Final completion | exact-head CI + independent Audit 2 | exact-head required CI and independent audit PASS |

---

## Old Candidate Dimensions — Exact Disposition

The historical A5001 six Family dimensions, seven Target dimensions, and historical A5002 dimension set are:

> CANDIDATE-ONLY / NOT PRODUCT AUTHORITY / NOT PROFESSIONAL APPROVAL.

They may be retained as:

- historical design evidence;
- candidate material for a future real Professional Reviewer;
- test data only when explicitly labeled candidate/nonproduction.

They may not be:

- presented in production as approved questionnaire content;
- used to create REVIEW_COMPLETE without a separately approved exact package;
- treated as immutable Product semantics;
- used as scoring/cutoff/professional interpretation;
- laundered into approval because PR #39 tests once passed.

If a future Professional Reviewer approves content that happens to contain some or all of those dimensions, authority comes from the new exact approval/package identity, not from this historical Slice 15 artifact.

---

## Open Decisions and Contradiction Gate

Open Product Decisions: 0.

Current Authority has already decided:

- A5001/A5002 identity and separation;
- subject/version/provenance/history lifecycle;
- package/reviewer dependency;
- fail-closed production behavior;
- Review completion prohibition while package is unavailable;
- Case phase ownership;
- A4012 boundary;
- AI boundary;
- Phase 3/4 negative space.

External Professional Reviewer/package availability is an operational authority dependency, not an unresolved Product Decision.

Authority Contradictions found in the four current Authority Docs: 0.

If a future re-read finds a real contradiction between the current four Authority Docs, implementation must STOP with AUTHORITY CONTRADICTION rather than resolving it locally.

---

## Success Criteria

- **SC-001**: one superseding Slice 15 spec exists without mutating the old Frozen Spec or Docs.
- **SC-002**: all core old requirements are mechanically classified as RETAIN / SUPERSEDED / PROHIBITED / DEFERRED / EXTERNAL-AUTHORITY-BLOCKED.
- **SC-003**: no production professional evaluation can complete without a valid exact APPROVED+PUBLISHED package.
- **SC-004**: A5001 and A5002 remain independent and exact-subject-bound.
- **SC-005**: old candidate dimensions have no production authority.
- **SC-006**: Slice 15 can be engineering-complete under Path B while production professional enablement remains externally blocked.
- **SC-007**: no later Slice must precede Slice 15.
- **SC-008**: Plan AI 2 can create plan/checklist/tasks without guessing product meaning.

---

## Assumptions and Open Questions

No unresolved product assumption is used.

The following are implementation-start readbacks, not Open Product Decisions:

- exact then-current owner APIs/seams;
- exact then-current error vocabulary;
- whether Scene Artifact vocabulary extension needs a migration;
- exact then-current migration number;
- exact designated Professional Content Package consumer port when an owner exists.

These must be resolved from repository truth without changing this Spec's semantics.

---

## Final Freeze

Authority Gate: PASS.  
Repository Reality Gate: PASS.  
Authority Contradictions: 0.  
Open Product Decisions: 0.  
Scope Drift: 0.

A5001 Identity: FROZEN.  
A5002 Identity: FROZEN.  
A5001/A5002 Separation: FROZEN / PASS.  
Professional Content Boundary: FROZEN.  
Professional Reviewer Boundary: FROZEN.  
Fail-Closed Semantics: FROZEN.  
REVIEW_COMPLETE Semantics: FROZEN.  
Common Core Review Boundary: FROZEN.  
Phase 3 Boundary: FROZEN.  
Phase 4 Boundary: FROZEN.  
Later Slice Dependency: NONE.

Current Reviewer State: UNASSIGNED.  
Current A5001/A5002 Professional Package Availability: UNAVAILABLE / NOT PROVEN APPROVED+PUBLISHED.  
Current Production Professional Evaluation Enablement: BLOCKED.  
Slice 15 Engineering Completion Model: PATH B — ALLOWED.

Ready For Plan AI 2: YES.

Next step, and only next step after this freeze:

PLAN AI 2 — PLAN / CHECKLIST / TASKS + AUDIT 1.

STOP.
