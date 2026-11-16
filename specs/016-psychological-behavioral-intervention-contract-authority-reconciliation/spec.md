# Slice 16 — Psychological / Behavioral Intervention Contract Foundation — Authority Reconciliation

> Artifact type: Authority Reconciliation Frozen Spec  
> Role: Plan AI 1 — Specify / Clarify only  
> Repository: pyxm1618/xiaoshuyin  
> Execution context: REMOTE-ONLY  
> Reconciliation branch: spec/016-psychological-behavioral-intervention-contract-authority-reconciliation  
> Authority baseline: exact main 46659c5c0a8ab1a3b322b7601722123bef8f88ce  
> Main tree: ab323a04923412f3ce4a17f857c1c4f21e0e5df7  
> Status: FROZEN only after exact-branch read-back confirms this file is the sole delta.

This artifact reconciles the historical Slice 16 specification with the 2026-11-16 Authority Convergence. It does not re-select Slice 16, create an implementation plan, authorize production professional content, or implement any runtime.

## 1. Reconciliation Authority Baseline

Authority hierarchy remains:

1. Docs/总产品需求.md — product and external-authority boundary;
2. Docs/V1产品需求.md — V1 product truth;
3. Docs/总体技术架构.md — long-lived architecture and Authority ownership;
4. Docs/V1技术设计.md — V1 implementation contract.

Exact reconciliation baseline:

~~~text
origin/main:
46659c5c0a8ab1a3b322b7601722123bef8f88ce

main tree:
ab323a04923412f3ce4a17f857c1c4f21e0e5df7

main CI:
SUCCESS
GitHub Actions run 43861277051

current migration head:
db/migrations/023_digital_use_review_runtime_authority_reconciled.sql
~~~

Current Authority Doc blobs:

~~~text
Docs/总产品需求.md
97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29

Docs/V1产品需求.md
8eb660cd905d8fba4b52fe0f74bbc214b3113117

Docs/总体技术架构.md
6b4630803f371faf6d93f27361070223d0f661a0

Docs/V1技术设计.md
a0f09b8afda5532870150f03b713fed107359849
~~~

Historical Slice 16 authority:

~~~text
Old Spec branch:
spec/016-psychological-behavioral-intervention-contract

Old Frozen Spec commit:
05aa4594cbb99c433035f9fa313376a7fec99785

Old Frozen Spec blob:
a6cd9fd723f9339b575757279703be554afaf0f6

Old Plan branch:
plan/016-psychological-behavioral-intervention-contract

Old Planning Freeze head:
40d6c4e19b9207b287aec03c5ba02868260dd8fe

Old planning merge-base:
7ec51889337d547766412a2ce954cff352e6d57b
~~~

Downstream planning heads read during reconciliation:

~~~text
Slice 17 plan:
a1d4e4390d313502696493573243adf401dbae90

Slice 18 plan:
9254c6bf387dd5471f7935be056c122fd5508672

Slice 19 plan:
a46cb8a9170bcfc253a6ad0d447ebc7dd5f31a05
~~~

## 2. Why Reconciliation Is Required

The historical Slice 16 Spec was correct about the need for a formal Psychological / Behavioral Intervention Contract, immutable definition versions, exact package binding, deterministic eligibility, and strict AI/RAG boundaries.

Its Authority baseline is no longer current.

All four formal Authority Docs changed semantically after the old Spec froze. Current main also now contains Slice 12–15 runtime, staff authority foundation, Single Case Phase convergence, and Slice 15's fail-closed Professional Content consumer seam.

The drift is therefore:

~~~text
Authority Drift:
SEMANTIC
~~~

It is not ordinary dependency drift and cannot be repaired by merely rebasing the old Plan.

## 3. Old Slice 16 Historical Authority

The historical Spec is preserved as audit evidence and is not modified.

The following historical decisions remain important inputs:

- intervention_definitions is the machine-executable Intervention definition truth;
- stable intervention_code does not replace exact definition id + immutable version;
- formal Intervention content cannot be invented by AI or RAG;
- hard eligibility gates cannot be delegated to RAG;
- approved/published historical content cannot be silently rewritten;
- retirement preserves history;
- formal consumers bind exact definition version and exact Scene/package version;
- floating latest is forbidden;
- deterministic eligibility is part of Slice 16;
- Slice 16 does not create InterventionInstance, Goal, Plan, Task, Checkin, Outcome, Schedule or Notification.

The historical statement that Slice 16 is the sole owner of professional review, publication and retirement Authority is superseded by this reconciliation.

## 4. Current Authority Drift

The current four Docs add or materially strengthen all of the following:

1. Professional Content Approval Plane as shared governance;
2. Staff Authority separated from Family/Guardian/ordinary Account;
3. explicit PROFESSIONAL_REVIEW capability;
4. Professional qualification as an independent fact;
5. APPROVED PROFESSIONAL REVIEWER — UNASSIGNED as current organizational dependency;
6. approval provenance bound to exact artifact/package identity, content version/hash, source refs, approval scope, reviewer identity, reviewer qualification/scope, reviewed_at and effective/published period;
7. DRAFT/CANDIDATE → PROFESSIONAL_REVIEW → APPROVED → PUBLISHED → SUPERSEDED/RETIRED/EXPIRED semantics;
8. prohibition on authority laundering through code, schema, fixtures, tests, approved flags, references or AI/developer judgment;
9. Single Case Phase Authority owned centrally by Common Core;
10. A5001/A5002/01000 fail-closed Professional Content Package behavior;
11. Phase 3 still begins with Psychological / Behavioral Intervention Contract + reviewed intervention_definitions.

This reconciliation applies those current semantics without expanding Slice 16 into a generic approval or staff platform.

## 5. Selection Retention Gate

Selected Slice remains:

> Psychological / Behavioral Intervention Contract Foundation

Selection is RETAINED because current V1 Product and V1 Technical Authority still explicitly require:

- Psychological / Behavioral Intervention Contract;
- reviewed intervention_definitions;
- deterministic Intervention Gate;
- exact approved/published professional content version before formal use;
- Phase 3 ordering that places this capability before retrieval/RAG consumers.

No current Authority proves the selected capability itself is wrong.

Selection Gate:

~~~text
PASS
Selection:
RETAINED
~~~

## 6. Old → New Delta Matrix

| Topic | Classification | Reconciled decision |
|---|---|---|
| Slice 16 selection | RETAIN | Psychological / Behavioral Intervention Contract Foundation remains selected. |
| intervention_definitions owner | RETAIN | Slice 16 owns InterventionDefinition domain identity, semantic content and immutable version history. |
| stable intervention identity + exact version | RETAIN | Formal use requires exact definition id/version; code alone is insufficient. |
| AI/RAG boundary | RETAIN | AI/RAG may propose or explain candidates but cannot approve, publish, invent or bypass hard gates. |
| deterministic eligibility | RETAIN | Slice 16 owns bounded deterministic eligibility semantics. |
| exact Scene/package binding | RETAIN | Exact Scene/package/definition versions are mandatory; floating latest remains forbidden. |
| historical immutability | RETAIN | Published/approved historical definitions are not silently rewritten; successor version required. |
| Phase 4 boundary | RETAIN | No InterventionInstance/Goal/Plan/Task/Checkin/Outcome/Schedule/Notification is created. |
| sole ownership of professional review state | AMEND | Canonical professional approval Authority/provenance is shared Professional Content Approval Plane; Slice 16 only consumes/verifies it and may persist a bounded projection/reference. |
| sole ownership of publication state | AMEND | Professional-content publication proof is Approval Plane truth; Scene/package inclusion is existing Scene/package owner truth; Slice 16 does not own either as a private parallel authority. |
| retirement state | AMEND | Definition version history remains Slice 16 domain truth, but professional content retired/superseded/expired validity is governed through the shared Approval Plane and projected into Slice 16 consumption. |
| reviewed_by_role | AMEND | Role text alone is not approval proof. Current proof requires reviewer identity, qualification ref/scope, assignment/capability validity, approval scope, exact content binding and time validity. |
| reviewer authority | AMEND | staff_assignments now exists and PROFESSIONAL_REVIEW is a recognized capability, but capability alone is insufficient. |
| professional qualification | NEW | Independent external fact; Slice 16 must consume proof/reference, not create a generic qualification owner. |
| approval artifact/proof | NEW | Exact immutable approval evidence must be resolved and revalidated; Slice 16 cannot mint it from its own definition row. |
| Development Implement Gate | AMEND | Development readiness is now separate from production professional approval/release readiness. |
| no real reviewer → all implementation blocked | RETIRE | Missing real reviewer blocks real approval/publication/release, not schema/domain/candidate/fail-closed development. |
| Slice 12–15 not merged | RETIRE | Current main contains their runtime and reconciled Slice 15. |
| migration head 011 | RETIRE | Current head is 023; future development allocates the then-next safe migration. |
| old owner/path assumptions | RETIRE | Plan AI 2 must use then-current main owners; old path guesses are not Authority. |
| shared Approval Plane integration | NEW | Slice 16 must use a narrow consumer seam analogous in principle to Slice 15, not build the plane. |
| production truthful unavailable state | NEW | With no real approved reviewer/content, definitions may exist only as candidate/draft/unavailable for production. |
| downstream Slice 17–19 impact | NEW | Must be read back against this reconciled Authority before their dependent work proceeds. |

## 7. Reconciled Purpose

Slice 16 establishes the machine-executable domain contract for formal psychological / behavioral Intervention definitions and the deterministic family/case eligibility decision for an exact definition version.

It must make it technically possible to develop and test:

- definition identity/version semantics;
- candidate definition persistence;
- exact professional approval proof consumption;
- exact Scene/package binding;
- deterministic eligibility;
- fail-closed behavior;
- provenance, versioning, idempotency, concurrency and audit;

without pretending that a real professional reviewer or approved production Intervention already exists.

## 8. Reconciled Scope

In scope:

- one InterventionDefinition domain owner;
- stable logical identity and immutable semantic versions;
- all V1 §2.7A required Intervention Contract fields;
- candidate/draft definition state;
- exact content identity/hash sufficient to bind an approval artifact;
- narrow shared-Approval-Plane consumer/reference seam;
- bounded approval validity projection needed for deterministic use;
- exact Scene/package/definition version binding;
- deterministic eligibility evaluation;
- current owner reads for Case, Evidence, Problem Formulation, Authorization, Consent, Compliance, Safety and Scene state;
- fail-closed production behavior;
- definition correction, supersession and historical inspection semantics;
- shared idempotency, concurrency, atomicity and business audit integration;
- tests proving no fake professional truth can enter production.

Candidate definition content may exist before professional approval. Candidate existence is not production approval.

## 9. Explicit Out of Scope

Out of scope:

- generic Professional Content Platform;
- generic CMS;
- reviewer registry/platform;
- professional qualification platform;
- credential verification platform;
- expert marketplace;
- generic Staff platform or Staff IAM;
- generic approval/workflow engine;
- legal authority platform;
- RAG, embeddings, retrieval or vector infrastructure;
- Professional Knowledge owner;
- Gold Dataset owner;
- Context Builder;
- AI Task Runtime;
- model gateway/registry;
- Phase 4 InterventionInstance;
- Goal, Plan, Task, Checkin, Review, Outcome, Follow-up Schedule or Notification;
- second Scene package registry;
- second Case phase owner;
- second Authorization/Consent/Compliance/Safety/Audit/Idempotency owner.

## 10. Reconciled Ownership / Source of Truth

### 10.1 InterventionDefinition Domain Truth

Slice 16 owns:

- definition identity;
- intervention_code;
- definition semantic content;
- immutable definition version;
- definition content hash/identity required for exact approval binding;
- definition-specific semantic successor history;
- definition-specific eligibility semantics;
- exact references to approved professional proof and allowed Scene/package version;
- bounded lifecycle projection needed to prevent new use of invalid/retired content;
- deterministic eligibility result.

### 10.2 Professional Approval Authority Truth

The shared Professional Content Approval Plane owns canonical approval Authority and provenance:

- whether the exact professional asset version was actually reviewed;
- whether the reviewer had valid matching qualification/scope;
- whether the reviewer had valid Staff assignment/capability for the approval;
- approval scope;
- exact artifact/package + version/hash binding;
- source refs;
- reviewer identity;
- reviewed_at;
- effective period;
- professional publication/retirement/supersession/expiry validity.

Slice 16 may persist an immutable approvalProofRef and bounded verification snapshot/reference for audit and deterministic exact binding. That projection is not a second approval source.

### 10.3 Existing owners consumed, not copied

Slice 16 consumes:

- Account/Person/Family/Participant owners;
- Case aggregate and Case lifecycle owner;
- Evidence owner;
- Problem Formulation owner;
- Authorization and RLS owner;
- Consent owner;
- Compliance owner;
- Safety owner;
- Scene Manifest/routing/state/package owner;
- business audit owner;
- shared idempotency and transaction seams;
- Staff Authority facts from staff_assignments;
- Professional qualification proof from its authoritative source when one exists.

## 11. Professional Content Approval Plane Integration

InterventionDefinition is a professional asset governed by the shared Professional Content Approval Plane.

It is not identical to the A5001/A5002 questionnaire Professional Content Package.

The required relationship is:

~~~text
InterventionDefinition exact identity/version/content hash
                +
shared Professional Approval proof
                +
existing Scene/package exact inclusion
                +
current family/case eligibility gates
                =
possible production consideration
~~~

A narrow Slice 16 consumer seam may resolve and revalidate already-issued professional approval proof. It must not create a generic approval platform.

A valid proof must be able to establish at least:

~~~text
artifact identity
definition id/version
content hash
source refs
approval scope
reviewer identity
reviewer qualification ref/scope
current staff assignment/capability proof or equivalent authoritative reference
review status = APPROVED
publication status = PUBLISHED
reviewed_at
effective_from/effective_to
published_at
lifecycle not RETIRED/SUPERSEDED/EXPIRED
~~~

Any mismatch fails closed.

## 12. Staff Authority Boundary

Current main contains staff_assignments through migration 021.

The recognized capability vocabulary includes PROFESSIONAL_REVIEW.

Therefore the historical statement that no Staff reviewer authority foundation exists is no longer accurate.

However:

~~~text
PROFESSIONAL_REVIEW capability
!=
Professional qualification
!=
professional approval
~~~

Slice 16 must not:

- duplicate staff_assignments;
- infer Staff capability from Family Manager/Guardian/ordinary Account;
- use generic Staff identity as professional qualification;
- create ADMIN=true;
- create a second Staff grant/revoke model.

Current production Staff verification code is concretely implemented for SAFETY_RESOLVE. Slice 16 must not assume that Safety-specific resolver is automatically a professional-review resolver.

## 13. Professional Qualification Boundary

Professional qualification is an independent authoritative fact.

Slice 16 does not own or create a generic qualification model.

At this reconciliation baseline, no concrete current-main professional qualification truth implementation/provider was established, and formal Authority states:

> APPROVED PROFESSIONAL REVIEWER — UNASSIGNED

Therefore:

- development may define the exact qualification proof/reference it must consume;
- tests may use explicitly test-only fixtures to prove validation logic;
- production may not treat fixtures, developers, AI, Staff identity or capability alone as qualification;
- absence, expiry, mismatch or unverifiability of qualification blocks professional approval validity.

This is a Production Approval Dependency, not a reason to invent a qualification platform inside Slice 16.

## 14. InterventionDefinition Domain Contract

Each exact definition version must be able to express at least:

~~~text
id
scene_id
intervention_code
version
content_hash
target_problem_or_mechanism
formulation_dependencies[]
supporting_evidence_requirements[]
applicable_conditions[]
exclusion_or_contraindication_conditions[]
age_and_development_scope
rationale
intervention_steps[]
participation_and_consent_requirements[]
baseline_and_observation
expected_observable_change[]
burden_and_barriers[]
adverse_or_worsening_signals[]
review_window_and_criteria
stop_reassess_safety_referral_conditions[]
allowed_combinations[]
conflicting_interventions[]
professional_source_refs[]
approval_proof_ref / projection
published/effective validity projection as needed
retirement/supersession validity projection as needed
~~~

Family-specific evidence bodies do not belong in the professional definition.

Method names such as CBT, MI, behavioral activation or family intervention are insufficient without the full contract.

## 15. Review / Approval / Publication / Retirement Semantics

The shared professional-content lifecycle is:

~~~text
DRAFT / CANDIDATE
→ PROFESSIONAL_REVIEW
→ APPROVED
→ PUBLISHED
→ SUPERSEDED / RETIRED / EXPIRED
~~~

Reconciled semantics:

- DRAFT/CANDIDATE may be developed and tested but cannot be production professional truth.
- PROFESSIONAL_REVIEW requires a real reviewer path; code cannot self-review.
- APPROVED requires exact proof from a valid qualified reviewer acting under valid authority.
- APPROVED alone does not authorize new production use if not PUBLISHED.
- PUBLISHED professional content still requires exact Scene/package inclusion and family/case eligibility.
- RETIRED/SUPERSEDED/EXPIRED blocks new use.
- historical exact versions and approval provenance remain inspectable.
- substantive changes require a new definition version and fresh approval/publication.
- a definition row's review/publication fields, if retained for projection, cannot become the canonical proof.

Definition-domain retirement and professional-content validity must not fork into contradictory truths. The canonical professional validity is read from/reconciled with the shared Approval Plane.

## 16. Exact Package / Definition Version Binding

Production consideration must bind:

~~~text
scene identity
+
exact Scene/package version
+
exact InterventionDefinition id
+
exact InterventionDefinition version
+
exact definition content hash
+
exact valid professional approval proof
~~~

No floating latest is allowed.

Current runtime already persists scene_package_version through the Scene runtime repository and reads it through getScenePackageBinding. Slice 16 reuses that owner.

Slice 16 does not create intervention_package_registry or another Scene package registry.

A package snapshot that contains an unpublished, unapproved, retired, superseded, expired or wrong-hash definition is invalid for new production use.

## 17. Deterministic Eligibility

Eligibility answers only:

> Is this exact, professionally valid, package-allowed InterventionDefinition currently eligible for consideration in this authorized current Case context?

It does not decide that a family must use the Intervention and does not create an InterventionInstance or Plan.

Required logical evaluation order:

~~~text
authorize actor / family / case / purpose
→ read current primary/open Case state
→ read current authoritative Problem Formulation
→ read required current Evidence
→ resolve exact Scene/package version
→ resolve exact InterventionDefinition id/version/hash
→ resolve/revalidate professional approval proof
→ require APPROVED + PUBLISHED + currently effective
→ reject retired/superseded/expired
→ require package exact inclusion
→ age/development scope
→ formulation dependencies
→ supporting Evidence requirements
→ applicable conditions
→ exclusions / contraindications
→ participation requirements
→ Consent
→ combination/conflict rules
→ Compliance
→ Safety
→ bounded eligibility result
~~~

Approval Authority is a prerequisite input to the evaluator, not private evaluator logic that invents approval.

UNKNOWN remains a first-class result. Missing required Formulation/Evidence is not converted to favorable truth unless the exact approved definition explicitly permits UNKNOWN and current Authority allows it.

The bounded result should carry exact revision/provenance references sufficient for a future consumer to revalidate freshness.

## 18. Authorization

Professional definition mutation and family/case eligibility are distinct authorization surfaces.

Family/Case ownership does not grant professional approval or publication authority.

Case-scoped eligibility must reject:

- wrong Family;
- wrong Case;
- wrong actor;
- wrong purpose;
- unauthorized cross-family Evidence;
- stale/invalid Case context;
- client-supplied ownership claims.

Unauthorized requests must follow existing anti-enumeration semantics.

## 19. RLS

Slice 16 must reuse current RLS patterns and runtime roles.

It must not create an RLS bypass for professional content or family data.

Where professional definitions are globally reusable assets, family-scoped RLS must not be misapplied as their professional approval Authority. Conversely, reading a global professional asset never grants access to family Evidence.

Any privileged professional-asset mutation path must be explicitly scoped and must not rely on household Family authority.

## 20. Consent

The definition may declare participation_and_consent_requirements, but it does not own Consent truth.

Eligibility consumes current authoritative Consent.

Missing, revoked, expired or otherwise invalid required Consent fails closed.

A parent action cannot fabricate child consent. A professional approval cannot override family Consent. AI/RAG cannot create Consent.

## 21. Compliance

Compliance remains an independent gate.

A valid professional approval does not override Compliance.

Current unresolved Legal Authority requirements remain external to Slice 16. If an applicable production behavior requires a current Legal Authority artifact and Compliance cannot establish it, that production behavior remains fail closed.

Slice 16 does not interpret law or create legal approval.

## 22. Safety

Safety has priority over ordinary Intervention progression.

Eligibility consumes current authoritative Safety state.

SAFETY_HOLD or another authoritative blocking Safety state prevents ordinary Intervention eligibility.

Slice 16 cannot resolve Safety, create Referral, downgrade risk or replace the Safety Rule Asset.

A definition may contain stop/reassess/Safety/Referral conditions; those are professional semantics for future consumers, not authority to mutate Safety state.

## 23. AI / RAG Boundary

AI may later:

- draft candidate Intervention content;
- propose a candidate from the already allowed definition set;
- explain approved content;
- help concretize approved steps;
- identify execution barriers;
- propose review candidates.

AI/RAG may not:

- create production Intervention truth;
- approve or publish a definition;
- act as professional reviewer;
- supply missing qualification;
- create approval proof;
- convert UNKNOWN to favorable truth;
- bypass age, Formulation, Evidence, exclusion, contraindication, Consent, Compliance, Safety or combination gates;
- turn retrieved text into a formal Intervention without an exact approved definition.

RAG is never the Intervention Gate.

## 24. Idempotency

Mutating Slice 16 commands must reuse the shared actor + command type + idempotency-key contract.

Requirements:

- exact replay returns the same committed business outcome;
- same key with materially different canonical payload conflicts;
- approval proof identity/content hash participates in the authoritative semantic fingerprint where applicable;
- replay may preserve historical committed truth but cannot authorize a new mutation using stale current authority;
- idempotency does not bypass authorization or approval validation.

No second idempotency store is created.

## 25. Concurrency

Lifecycle/version/package-binding mutations must serialize or use equivalent compare-and-swap/version preconditions.

Concurrent operations must not produce:

- two contradictory current versions;
- approval attached to a different content hash;
- publish-after-retire resurrection;
- stale package inclusion;
- lost retirement/supersession;
- stale reviewer assignment acceptance.

At most one valid transition wins; stale contenders fail deterministically.

## 26. Atomicity

A successful mutation that creates or changes authoritative Slice 16 truth must atomically commit all applicable effects:

- definition version/domain state;
- approval proof reference/projection;
- package-binding contribution/reference under the real package owner;
- business audit;
- idempotency settlement.

Partial failure rolls back the logical mutation.

Production approval itself is not minted inside this transaction unless the shared Approval Plane explicitly provides that authoritative operation in the future. This Slice primarily consumes and binds approval proof.

## 27. Audit / Provenance

Audit must preserve enough bounded evidence to reconstruct:

- actor;
- action;
- exact definition identity/version/hash;
- source refs;
- approvalProofRef;
- reviewer identity reference;
- qualification reference/scope;
- approval scope;
- review/effective/publication timestamps;
- exact Scene/package binding;
- before/after domain state;
- request/correlation/idempotency identity;
- reason/result.

Audit is not a second professional truth store.

Raw family narratives, credentials or unnecessary sensitive source content must not be copied into generic audit logs.

## 28. Failure Semantics

Distinct internal failures must remain distinguishable, including:

- definition unknown;
- definition version/hash mismatch;
- approval proof unavailable;
- approval proof mismatch;
- reviewer authority invalid/revoked/expired;
- qualification missing/mismatched/expired/unverifiable;
- not approved;
- not published;
- retired/superseded/expired;
- wrong approval scope;
- wrong Scene/package version;
- package does not include exact definition;
- wrong family/case/actor/purpose;
- stale Case/Formulation/Evidence;
- missing required Formulation/Evidence;
- age mismatch;
- exclusion/contraindication;
- participation/Consent blocked;
- combination conflict;
- Compliance blocked;
- Safety blocked;
- idempotency mismatch/contention;
- stale concurrent revision;
- infrastructure/dependency unavailable.

External error disclosure follows current privacy/anti-enumeration rules.

Dependency unavailable is not professional rejection, and technical success is not professional approval.

## 29. Correction / Evolution

Before professional approval/publication, candidate content may be corrected with audit.

After approval/publication, any substantive semantic change creates a successor definition version with a new content hash and requires fresh professional review/approval/publication.

Historical versions remain immutable and inspectable.

A current family/case eligibility result becomes stale when any relevant dependency changes, including:

- definition version/hash;
- professional approval validity;
- package version/inclusion;
- Case phase/status/primary state;
- Problem Formulation version/review state;
- Evidence;
- Consent;
- Compliance;
- Safety;
- combination context.

Material Problem Formulation correction uses the Common Core lifecycle owner and may force affected downstream eligibility to be recalculated; Slice 16 does not write a shadow Case phase.

## 30. Development Implement Gate

Development and production release are separate gates.

Current main now contains the necessary merged owners and seams to develop the bounded Slice 16 foundation:

- Slice 12 assessment runtime;
- Slice 13 Family Alliance runtime;
- Slice 14 Phone Use Contract runtime;
- Slice 15 authority-reconciled Review runtime;
- current Case/Phase owner;
- current Evidence and Problem Formulation owners;
- Authorization/RLS;
- Consent;
- Compliance;
- Safety;
- Scene Manifest/routing/state and scene_package_version binding;
- business audit;
- shared idempotency/transaction seams;
- staff_assignments capability foundation;
- Slice 15 narrow fail-closed Professional Content consumer pattern.

Development may therefore implement, after Plan AI 2 / Audit 1:

- schema/domain foundation;
- candidate InterventionDefinitions;
- approval-proof consumer integration;
- deterministic eligibility;
- fail-closed production provider behavior;
- tests including test-only approval fixtures that cannot become production truth.

It may not mark any candidate as real production APPROVED/PUBLISHED without real Authority.

~~~text
Planning Gate:
PASS

Development Implement Gate:
PASS
~~~

This PASS authorizes only the next planning stage, not immediate development by Plan AI 1.

## 31. Production Professional Approval / Release Gate

Current organizational Authority states:

~~~text
APPROVED PROFESSIONAL REVIEWER — UNASSIGNED
~~~

Current main has staff_assignments and PROFESSIONAL_REVIEW vocabulary, but capability alone is insufficient and no concrete production professional qualification truth/provider was established by this reconciliation.

Slice 15's production Professional Content provider is intentionally unavailable and fail closed; Slice 16 must remain consistent with that truthfulness.

Therefore:

~~~text
Production Professional Approval Gate:
BLOCKED

Production Publication / Release Gate:
BLOCKED
~~~

Blocked means:

- no InterventionDefinition may become real production professional truth;
- no fake approved seed;
- no developer reviewer;
- no test reviewer promoted to production;
- no AI/RAG approval;
- no fixture approval;
- no automatic PUBLISHED seed;
- no real-family formal Intervention availability from unapproved candidate content.

Candidate/draft/unavailable is the truthful state until a real qualified reviewer and valid approval proof exist.

## 32. Current Runtime Dependency Reality

Exact current runtime facts read during reconciliation:

- migration head is 023_digital_use_review_runtime_authority_reconciled.sql;
- migration 021 creates staff_assignments with explicit capability, scope, grant/revoke and validity semantics;
- packages/domain/src/safety/resolver-authority.ts provides a concrete Safety-specific Staff authority resolver for SAFETY_RESOLVE;
- this Safety resolver does not prove a generic PROFESSIONAL_REVIEW resolver or qualification owner;
- apps/server/api/src/services/digital-use-review-professional-content.ts consumes exact Professional Content proof and requires reviewerQualificationRef, valid reviewer proof, APPROVED + PUBLISHED + CURRENT and valid effective period;
- its production default intentionally returns unavailable because no real approved package/reviewer exists;
- Slice 15 review services resolve exact package identity, normalize through package-owned logic, persist proof identity and revalidate before commit;
- packages/domain/src/scene-runtime-repository.ts persists/reads scene_package_version and exposes getScenePackageBinding;
- apps/server/api/src/services/digital-use-case-lifecycle.ts treats Case phase as Common Core truth and Scene phase metadata as non-authoritative;
- apps/server/api/src/services/problem-formulations.ts owns central formulation/Case transitions and NEEDS_REVIEW resolution;
- shared idempotency and transaction seams already exist.

No old fixed migration number is frozen here. Future development must allocate the then-next safe reviewed migration after re-reading main.

## 33. Slice 17–19 Dependency Impact

### Slice 17 — Professional Knowledge Foundation

Impact:

~~~text
RECONCILIATION REQUIRED
~~~

Reason: its frozen authority currently treats Knowledge review/publication lifecycle as Slice 17's sole professional truth. Current shared Professional Content Approval Plane requires professional approval Authority/provenance to be external/shared, with qualification and assignment proof. Its Knowledge domain identity/version may remain Slice 17 truth, but approval Authority must be reconciled.

This Slice does not modify Slice 17.

### Slice 18 — Professional Retrieval Gold Dataset

Impact:

~~~text
RECONCILIATION REQUIRED
~~~

Reason: professional Gold labels/rubric are explicitly current Professional Authority content. Slice 18 correctly forbids self-approval, but its older baseline predates the shared Approval Plane and qualification/Staff convergence. Dataset artifact lifecycle may remain Slice 18 truth; professional label approval Authority must be reconciled.

This Slice does not modify Slice 18.

### Slice 19 — Professional Retrieval pgvector Readiness

Impact:

~~~text
READ-BACK REQUIRED
~~~

Reason: its core pgvector capability contract is infrastructure-only and does not depend on Intervention approval. However its planning text contains stale repository statements that no staff assignment source exists. Current main now has staff_assignments. Read-back is required before further dependent work, but no Slice 16 semantic redesign of pgvector is required.

This Slice does not modify Slice 19.

## 34. Functional Requirements

FR-001 — The selected capability SHALL remain Psychological / Behavioral Intervention Contract Foundation.

FR-002 — intervention_definitions SHALL remain the single InterventionDefinition domain owner.

FR-003 — Every formal definition SHALL have stable logical identity and exact immutable version.

FR-004 — intervention_code alone SHALL NOT authorize formal use.

FR-005 — Every version SHALL have an exact content identity/hash suitable for approval binding.

FR-006 — Every production-eligible definition SHALL express all required §2.7A semantic fields.

FR-007 — Family-specific Evidence bodies SHALL NOT be stored as universal professional definition content.

FR-008 — Method-name-only content SHALL NOT satisfy the formal Contract.

FR-009 — Published historical semantic content SHALL NOT be edited in place.

FR-010 — Substantive correction SHALL create a successor definition version.

FR-011 — Canonical professional approval Authority SHALL be consumed from the shared Professional Content Approval Plane.

FR-012 — Slice 16 SHALL NOT mint approval from a local review_status flag.

FR-013 — Approval SHALL bind exact definition id/version/content hash.

FR-014 — Approval SHALL bind source refs and approval scope.

FR-015 — Approval SHALL identify the real reviewer.

FR-016 — Approval SHALL require matching professional qualification proof/reference.

FR-017 — Approval SHALL require valid applicable Staff assignment/capability Authority.

FR-018 — PROFESSIONAL_REVIEW capability alone SHALL NOT equal qualification or approval.

FR-019 — reviewed_by_role alone SHALL NOT satisfy approval proof.

FR-020 — AI, RAG, developer, fixture, family identity or successful tests SHALL NOT create professional approval.

FR-021 — New production use SHALL require current APPROVED professional proof.

FR-022 — New production use SHALL require current PUBLISHED professional proof.

FR-023 — Retired, superseded or expired professional content SHALL NOT accept new production use.

FR-024 — Professional approval proof SHALL expose/refer to effective and publication periods.

FR-025 — Slice 16 MAY persist bounded approval projection/reference but SHALL NOT duplicate canonical approval truth.

FR-026 — Historical approval/provenance SHALL remain inspectable.

FR-027 — Formal consideration SHALL bind exact Scene identity and exact Scene/package version.

FR-028 — Formal consideration SHALL bind exact InterventionDefinition id/version/hash.

FR-029 — Floating latest SHALL be forbidden for definition or package selection.

FR-030 — Slice 16 SHALL reuse the existing Scene/package owner and scene_package_version binding.

FR-031 — A package containing an unapproved/unpublished/retired/wrong-hash definition SHALL be invalid for new formal use.

FR-032 — Slice 16 SHALL NOT create a second Scene package registry.

FR-033 — Slice 16 SHALL provide deterministic eligibility for an exact definition version.

FR-034 — Eligibility SHALL consume current authoritative Case state.

FR-035 — Eligibility SHALL consume current authoritative Problem Formulation and required Evidence.

FR-036 — Eligibility SHALL verify current professional approval before family-specific applicability.

FR-037 — Eligibility SHALL enforce age/development scope.

FR-038 — Eligibility SHALL enforce Formulation dependencies and preserve UNKNOWN.

FR-039 — Eligibility SHALL enforce required supporting Evidence.

FR-040 — Eligibility SHALL enforce applicable conditions.

FR-041 — Eligibility SHALL block applicable exclusion/contraindication.

FR-042 — Eligibility SHALL enforce participation requirements.

FR-043 — Eligibility SHALL consume authoritative Consent and fail closed when required Consent is invalid.

FR-044 — Eligibility SHALL enforce combination/conflict rules.

FR-045 — Eligibility SHALL consume authoritative Compliance.

FR-046 — Eligibility SHALL consume authoritative Safety and block ordinary progression under Safety block.

FR-047 — Eligibility SHALL reject wrong-family/wrong-case/wrong-actor/wrong-purpose contexts.

FR-048 — Eligibility allowed=true SHALL NOT create or activate an InterventionInstance or Plan.

FR-049 — A stale eligibility result SHALL NOT remain authoritative after a relevant dependency revision.

FR-050 — RAG/model output SHALL NOT override deterministic eligibility.

FR-051 — Professional definition mutation SHALL NOT be authorized by Family/Case ownership alone.

FR-052 — Slice 16 SHALL reuse current RLS/Authorization boundaries and preserve anti-enumeration.

FR-053 — Slice 16 SHALL reuse current Consent/Compliance/Safety owners without duplicating truth.

FR-054 — Slice 16 SHALL not create or mutate Common Core Case phase as a private state.

FR-055 — Slice 16 SHALL reuse shared idempotency semantics for mutations.

FR-056 — Same idempotency key with materially different canonical payload SHALL conflict.

FR-057 — Concurrent lifecycle/version/binding mutations SHALL prevent lost updates and resurrection.

FR-058 — Applicable domain mutation, audit and idempotency settlement SHALL be atomic.

FR-059 — Audit SHALL bind exact definition/version/hash, approval proof ref and package context.

FR-060 — Audit SHALL not become a second professional truth store.

FR-061 — Development SHALL permit candidate/draft definitions without falsely marking them production approved.

FR-062 — Production without a real qualified approved reviewer SHALL fail closed as candidate/unavailable.

FR-063 — Slice 16 SHALL create no Phase 4 business truth and no RAG/AI runtime.

FR-064 — Future implementation SHALL allocate the then-next safe migration rather than reusing the historical migration assumption.

## 35. Acceptance Scenarios

AS-001 — PROFESSIONAL_REVIEW capability exists but matching qualification is missing: professional approval is invalid and production use is blocked.

AS-002 — Qualification proof exists but the reviewer has no valid applicable Staff assignment/capability: approval is invalid and production use is blocked.

AS-003 — AI-generated Intervention draft: it may remain candidate but cannot approve or publish itself.

AS-004 — Test fixture carries an apparently valid reviewer proof: it is usable only in isolated tests and cannot become production truth.

AS-005 — Developer seed sets approved=true: no shared approval proof exists, therefore production eligibility remains blocked.

AS-006 — Real valid professional approval exists but publication is absent: no new production use.

AS-007 — Previously published definition is now retired: new use is blocked and historical records remain inspectable.

AS-008 — Approval proof scope does not cover the requested Intervention/Scene: fail closed.

AS-009 — Approval is valid but the current Scene/package version differs from the approved/included package: fail closed.

AS-010 — Request supplies correct intervention_code but wrong definition version: no floating-latest substitution; fail closed.

AS-011 — Reviewer assignment was valid at review time but is stale/revoked for a new approval attempt: the new approval attempt fails closed.

AS-012 — PROFESSIONAL_REVIEW capability is revoked before a new approval attempt: fail closed.

AS-013 — Qualification or approval effective period is expired where applicable: new production use fails closed.

AS-014 — Authorized definition is evaluated against the wrong Family or Case: fail closed without protected-object enumeration.

AS-015 — Required Consent is missing/revoked/expired: fail closed.

AS-016 — Compliance blocks the requested use: professional approval cannot override it.

AS-017 — Safety blocks ordinary progression: professional approval cannot override it.

AS-018 — Required Formulation dependency is missing/UNKNOWN: result remains blocked/UNKNOWN unless the exact approved definition explicitly permits UNKNOWN under current Authority.

AS-019 — Published Scene package snapshot contains an unpublished InterventionDefinition: the package/definition combination is invalid for new production use.

AS-020 — Historical retired definition is referenced by an old record: exact historical version and provenance remain inspectable and are not rewritten.

AS-021 — No real reviewer is configured: runtime remains truthful candidate/unavailable; no fake APPROVED/PUBLISHED state is produced.

AS-022 — Approval proof content hash differs from the definition content hash: fail closed.

AS-023 — approvalProofRef binds a different definition/version: fail closed.

AS-024 — A published definition receives substantive semantic edits: in-place mutation is rejected; a successor version and fresh approval are required.

AS-025 — Exact definition/version/hash has valid approval, valid publication, exact package inclusion and all current family gates pass: bounded eligibility may return allowed=true without creating a Phase 4 object.

AS-026 — Definition age/development scope does not match current authorized context: fail closed.

AS-027 — Applicable exclusion or contraindication is hit: ordinary eligibility is blocked.

AS-028 — Known conflicting Intervention combination is present: conflicting combination is blocked.

AS-029 — Required supporting Evidence is absent: allowed cannot become true.

AS-030 — Case phase has advanced while an otherwise valid parallel Scene stream remains legal: Slice 16 reads central Case truth and does not enforce a shadow exact-equality phase machine.

AS-031 — Material Problem Formulation correction changes the authoritative formulation: old eligibility becomes stale and must be recalculated; Slice 16 does not write Case phase itself.

AS-032 — Exact idempotent replay of an already committed mutation: same business result, no duplicate definition/audit effect.

AS-033 — Same idempotency key with materially different definition/approval payload: conflict.

AS-034 — Concurrent publish-binding and retirement/supersession attempt: serialization/version precondition allows at most one valid current outcome.

AS-035 — Failure after definition mutation but before audit/idempotency settlement: transaction rolls back the logical mutation.

AS-036 — Unauthorized actor guesses a definition/package/family target: external response follows anti-enumeration policy.

AS-037 — RAG retrieves strong supporting text for an unapproved definition: retrieval cannot make it eligible.

AS-038 — A user asks AI to create a new intervention and use it immediately: AI output remains candidate; no formal Intervention is activated.

AS-039 — Developer attempts to create InterventionInstance/Plan to prove end-to-end behavior: scope gate rejects the change.

AS-040 — Developer attempts to create intervention_package_registry instead of using current Scene/package binding: scope gate rejects the duplicate owner.

## 36. Negative Scope Scenarios

NS-001 — No generic Professional CMS.

NS-002 — No Professional Content Platform.

NS-003 — No expert marketplace.

NS-004 — No generic Staff platform.

NS-005 — No duplicate staff_assignments.

NS-006 — No Professional qualification owner/platform created by Slice 16.

NS-007 — No duplicate Professional Content Approval Plane.

NS-008 — No ADMIN=true universal authority.

NS-009 — No AI reviewer.

NS-010 — No RAG reviewer.

NS-011 — No developer approval.

NS-012 — No production fixture approval.

NS-013 — No automatically PUBLISHED seed.

NS-014 — No Phase 4 InterventionInstance.

NS-015 — No Goal object.

NS-016 — No Plan/PlanVersion activation.

NS-017 — No Task or Checkin.

NS-018 — No Outcome/Follow-up/Schedule/Notification.

NS-019 — No Professional Knowledge owner.

NS-020 — No RAG implementation.

NS-021 — No pgvector/embedding/reranking work.

NS-022 — No Context Builder.

NS-023 — No AI Task Runtime or model gateway.

NS-024 — No second Scene package registry.

NS-025 — No second Scene Manifest/routing owner.

NS-026 — No second Case phase/status owner.

NS-027 — No duplicate Evidence or Problem Formulation owner.

NS-028 — No duplicate Consent/Compliance/Safety owner.

NS-029 — No generic approval workflow engine.

NS-030 — No legal interpretation/Legal Authority platform.

## 37. Clarifications

C16R-01 — Is Slice 16 being re-selected?  
RESOLVED — NO. Selection is retained.

C16R-02 — Does current Staff Authority foundation exist?  
RESOLVED — YES. staff_assignments exists and includes PROFESSIONAL_REVIEW capability vocabulary.

C16R-03 — Does Staff capability prove professional qualification?  
RESOLVED — NO. Qualification is independent.

C16R-04 — Does Slice 16 build the missing qualification platform?  
RESOLVED — NO. It consumes authoritative proof/reference when available.

C16R-05 — Does Slice 16 own professional approval truth?  
RESOLVED — NO. Shared Professional Content Approval Plane is canonical.

C16R-06 — What does Slice 16 own around lifecycle?  
RESOLVED — Definition identity/content/version and bounded lifecycle projection/reference necessary for deterministic domain behavior; it does not duplicate canonical professional approval provenance.

C16R-07 — Is Professional Content Package the same object as InterventionDefinition?  
RESOLVED — NO. InterventionDefinition is its own professional asset identity/version governed by the Approval Plane. A5001/A5002 questionnaire packages remain separate professional content assets.

C16R-08 — Who owns Scene package composition?  
RESOLVED — Existing Scene/package owner. Slice 16 contributes exact approved definition references and consumes exact scene_package_version; it creates no second registry.

C16R-09 — Can development proceed without a real professional reviewer?  
RESOLVED — YES, for candidate schema/domain, approval-consumer seam, deterministic eligibility, fail-closed behavior and tests.

C16R-10 — Can production professional approval proceed without a real reviewer?  
RESOLVED — NO.

C16R-11 — Can production publication/release proceed now?  
RESOLVED — NO.

C16R-12 — May a test fixture represent approval?  
RESOLVED — Only in explicitly isolated test provenance; never as production provider/data.

C16R-13 — Can reviewer identity alone approve?  
RESOLVED — NO. Valid capability/assignment plus matching qualification/scope and exact approval proof are required.

C16R-14 — Can reviewed_by_role remain the only provenance field?  
RESOLVED — NO. It is insufficient under current Authority.

C16R-15 — Can the evaluator privately decide that a reviewer is qualified?  
RESOLVED — NO. It consumes qualification Authority.

C16R-16 — Can approval be cached forever once seen?  
RESOLVED — NO. Current validity/effective/retirement/revocation must be revalidated at the appropriate authoritative boundary.

C16R-17 — Does eligibility allowed=true activate an Intervention?  
RESOLVED — NO. Phase 4 remains out of scope.

C16R-18 — Does RAG own the hard Gate?  
RESOLVED — NO.

C16R-19 — Does a material definition correction rewrite history?  
RESOLVED — NO. New version + fresh approval.

C16R-20 — Does a retired version disappear?  
RESOLVED — NO. Historical inspection remains.

C16R-21 — Does Slice 16 write Case phase?  
RESOLVED — NO. Single Case Phase Authority remains Common Core.

C16R-22 — What migration number is assigned?  
RESOLVED — NONE in Plan AI 1. Development must allocate the then-next safe migration after exact-head read-back.

C16R-23 — Does lack of qualification implementation create an Open Product Decision?  
RESOLVED — NO. Authority already defines the boundary: it is an external Production Approval dependency and cannot be invented here.

C16R-24 — Does the current Legal Authority gap change Slice 16 selection?  
RESOLVED — NO. Applicable production behavior remains fail closed through the independent Compliance/Legal gate.

C16R-25 — Are Slice 17–19 modified here?  
RESOLVED — NO. Only impact classification is recorded.

Open Product Decisions:

~~~text
0
~~~

## 38. Frozen Reconciliation Gate

This reconciliation may be FROZEN only when exact read-back confirms:

~~~text
Authority Reconciliation:
PASS

Selection:
RETAINED

Open Product Decisions:
0

Scope Drift:
0

Duplicate Truth:
0

Phase Boundary Violation:
0

Old Slice 16 Historical Mutation:
0

Docs Mutation:
0

Production Mutation:
0

Plan Created:
NO

Checklist Created:
NO

Tasks Created:
NO

Development Performed:
NO

Audit 1 Performed:
NO
~~~

Gate decisions frozen by this artifact:

~~~text
Planning Gate:
PASS

Development Implement Gate:
PASS

Production Professional Approval Gate:
BLOCKED

Production Publication / Release Gate:
BLOCKED
~~~

Development PASS means only that Plan AI 2 may rebuild an executable Plan against then-current main. It does not authorize Plan AI 1 to develop.

## 39. Plan AI 1 Stop Boundary

After this reconciliation Spec is committed and exact read-back confirms integrity, Plan AI 1 stops.

It must not create or modify:

- plan.md;
- checklist.md;
- tasks.md;
- old Slice 16 files;
- Slice 17 files;
- Slice 18 files;
- Slice 19 files;
- Docs;
- production code;
- migrations;
- runtime tests;
- CI implementation;
- implementation PR;
- Audit 1;
- Audit 2;
- merge.

Next role:

> Plan AI 2

Required sequence:

~~~text
Reconciliation Frozen Spec
→ Plan AI 2
→ Plan / Checklist / Tasks
→ Audit 1
→ Development
→ Audit 2
→ Merge only after independent gates
~~~

Final reconciliation decision:

~~~text
AUTHORITY RECONCILIATION FROZEN
SELECTION RETAINED
READY FOR PLAN AI 2

Development Implement Gate:
PASS

Production Professional Approval Gate:
BLOCKED

Production Publication / Release Gate:
BLOCKED
~~~
