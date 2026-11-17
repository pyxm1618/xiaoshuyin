# Slice 17 — Professional Knowledge Foundation — Authority-Reconciled Frozen Spec

> Role: Slice 17 Authority-Reconciled Plan AI 1.
> Feature: 017-professional-knowledge-foundation.
> Purpose: reconcile the previously frozen Slice 17 semantic contract with the current four Authority Docs and current runtime truth.
> This document supersedes the prior Slice 17 Frozen Spec for future planning and implementation. It does not rewrite or invalidate historical Git authority.
> This is a Spec / Authority freeze only. It is not Plan, Audit 1, Development, Audit 2, merge approval, or production Professional Approval.

## 1. Previous Frozen Authority

Historical Frozen Spec:

~~~text
Commit:
a345937868ca1b8d2cef65003d4197de4207eb52

Blob:
866c3f77dd269c94d420d9c0ae6b918f114286ce

Path:
specs/017-professional-knowledge-foundation/spec.md
~~~

Historical authoritative planning package:

~~~text
Branch:
plan/017-professional-knowledge-foundation

Planning Freeze Head:
a1d4e4390d313502696493573243adf401dbae90

Plan Blob:
117ee8c5ef34230984f693cdc31443ee0be0d848

Checklist Blob:
b46b8993c771d41cd9e03a36d7722b638c0282fa

Tasks Blob:
395fcdb51f9fde3716e27b27193b0b8cfa3c8834
~~~

Those objects remain historical authority. They are not edited by this reconciliation. The old Plan / Checklist / Tasks are impact-analysis inputs only and are not current planning authority for this reconciled Spec. A new independent Plan AI 2 must create the new planning package.

## 2. Current Authority Inputs

Reconciliation baseline:

~~~text
origin/main:
46659c5c0a8ab1a3b322b7601722123bef8f88ce

.specify/authority-inputs.json:
0ab9f2d8534ef449ca3ed0ab6c1a1548179f878d
~~~

Pinned current Authority Docs:

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

Current Authority Inputs agree with .specify/authority-inputs.json. Input Drift: NONE.

Authority hierarchy remains:

~~~text
Docs/总产品需求.md
→ Docs/V1产品需求.md
→ Docs/总体技术架构.md
→ Docs/V1技术设计.md
→ this Slice Spec
~~~

This Spec cannot amend the four Authority Docs. A material conflict between those Docs would block this reconciliation rather than be silently resolved here. No such conflict was found for Slice 17.

## 3. Current Remote / Runtime Truth

At reconciliation time:

- Slice 13 is merged.
- Slice 14 is merged.
- Slice 15 authority-reconciled runtime is merged and is current main.
- current migration head on main is 023_digital_use_review_runtime_authority_reconciled.sql.
- Foundation database integrity, Account hard-disable, Problem Formulation review-state separation, Staff Authority / Safety resolver, Consent-chain integrity, Authorization hardening, and Digital Use vertical convergence are present on current main.
- current main has no merged Professional Knowledge owner equivalent to Slice 17.
- Slice 15 contains a Professional Content consumer/proof port and deliberately has no CMS, reviewer registry, credential platform, approval workflow, questionnaire platform, or scoring engine.
- Slice 15 production Professional Content provider is intentionally unavailable and fail-closed while real Professional Authority is unavailable.
- current main has Staff assignment/capability foundation including PROFESSIONAL_REVIEW, but Professional qualification remains an independent fact and is not created by generic Staff identity.
- Slice 16 PR #57 is OPEN, not merged, and therefore is not current-main runtime truth.
- Slice 16 current candidate Head is 6237a4f87e2277359ad128f09ea094a549eaaa53.
- Slice 16 candidate owns InterventionDefinition domain truth only and consumes external Professional Approval / qualification proof; it does not create those authorities.
- Slice 16 candidate migration 024 is not part of current main.

The current organizational Professional Authority dependency remains:

> APPROVED PROFESSIONAL REVIEWER — UNASSIGNED

This operational fact blocks production Professional Approval / release where required. It does not, by itself, prohibit development of a fail-closed foundation that cannot manufacture approval.

## 4. Authority Drift Matrix

| # | Old Slice 17 Clause / Assumption | Current Authority / Runtime Reality | Classification | Required Action |
|---|---|---|---|---|
| 1 | Slice 17 selection = Professional Knowledge Foundation | Professional Knowledge remains an explicit V1/Phase 3 asset and upstream truth for RAG | UNCHANGED | Preserve selection |
| 2 | Knowledge explains why/how and is not Family Memory | Current architecture explicitly preserves this separation | UNCHANGED | Preserve |
| 3 | Stable Knowledge identity + immutable released versions | Current architecture still requires versioned professional assets | UNCHANGED | Preserve |
| 4 | Slice 17 stores source provenance | Current Authority additionally requires reuse of canonical source identity where one exists and immutable reviewer-visible provenance evidence | CLARIFIED | Clarify snapshot/reference boundary |
| 5 | No RAG / embedding / chunking in Slice 17 | Retrieval remains downstream | UNCHANGED | Preserve |
| 6 | Knowledge cannot approve or decide Intervention eligibility | Current Authority and Slice 16 candidate strengthen this boundary | UNCHANGED | Preserve |
| 7 | Authorization / Consent / Compliance / Safety remain external owners | Current main has stronger single-owner control planes | UNCHANGED | Preserve |
| 8 | Anti-enumeration is required | Current security hardening reinforces it | UNCHANGED | Preserve |
| 9 | Historical exact version/reference traceability is required | Current dependency/version model reinforces it | UNCHANGED | Preserve |
| 10 | One lifecycle enum DRAFT → REVIEWED → PUBLISHED → RETIRED | Current Authority requires lifecycle_status separate from review_state / validity_state | SUPERSEDED | Replace combined state machine |
| 11 | REVIEWED means professional approval | PROFESSIONAL_REVIEW capability/review activity is not Professional Approval | SUPERSEDED | Separate review activity from external approval proof |
| 12 | Slice 17 review state can be the approval truth | Code/DB/Slice cannot manufacture Professional Authority | SUPERSEDED | Slice 17 consumes/persists proof reference, never creates authority |
| 13 | reviewer and publisher are implicitly distinct approved actors | Current Authority does not mandate a separate publisher capability or separation-of-duties rule | SUPERSEDED | Remove invented publisher-authority requirement |
| 14 | no real reviewer and unmerged Slice 16 block the whole implementation | Slice 15 and Slice 16 authority-reconciled pattern proves foundation/contracts may exist while production authority remains unavailable | SUPERSEDED | Split Development Gate from Production Release Gate |
| 15 | no independent Knowledge review/validity plane | Current Authority mandates CURRENT/VALID vs NEEDS_REVIEW semantics | NEW REQUIRED INVARIANT | Add independent validity/review state |
| 16 | approval can be inferred from review status | Current Authority requires external exact approval proof | NEW REQUIRED INVARIANT | Add approval-proof consumer boundary |
| 17 | staff reviewer role is sufficient authority | Staff capability + valid assignment + matching professional qualification/scope are distinct facts | NEW REQUIRED INVARIANT | Bind all three without laundering |
| 18 | approval evidence need not be separately revalidated | Current proof-contract pattern requires exact identity/hash/scope/source/reviewer/qualification/effective-period validation | NEW REQUIRED INVARIANT | Add resolve/revalidate fail-closed semantics |
| 19 | unavailable and invalid authority were not explicitly separated | Current runtime contracts distinguish dependency unavailable from proof invalidity | NEW REQUIRED INVARIANT | Preserve truthful internal distinction |
| 20 | one Implement Gate controlled both development and release | Current Authority supports foundation implementation with production release blocked | NEW REQUIRED INVARIANT | Define two gates |
| 21 | source retirement/correction only drove lifecycle retirement/successor | Current Authority requires NEEDS_REVIEW propagation before lifecycle mutation where impact is uncertain | NEW REQUIRED INVARIANT | Add dependency propagation rules |
| 22 | Scene package directly owns Knowledge lifecycle/binding semantics without explicit Professional Content Package distinction | Current Authority distinguishes professional approval artifacts/packages from Scene Package scene ownership | NEW REQUIRED INVARIANT | Freeze unique package ownership |
| 23 | Slice 13 was planning-only | Slice 13 is merged | IMPLEMENTATION-ONLY DRIFT | No product-semantic change |
| 24 | Slice 14 was planning-only | Slice 14 is merged | IMPLEMENTATION-ONLY DRIFT | No product-semantic change |
| 25 | Slice 15 was planning-only | Slice 15 authority-reconciled runtime is merged and provides a fail-closed Professional Content consumer pattern | IMPLEMENTATION-ONLY DRIFT | Plan AI 2 must reuse current seams |
| 26 | migration / security / Staff Authority baseline was older | migrations 018–023 and current Staff/security foundations now exist | IMPLEMENTATION-ONLY DRIFT | Plan AI 2 re-inventories exact runtime |
| 27 | Slice 16 was planning-only | PR #57 is an unmerged authority-reconciled implementation candidate | IMPLEMENTATION-ONLY DRIFT | Treat as candidate seam only until merged |
| 28 | later retrieval slices were future work | Slice 18/19 artifacts may exist, but remain downstream consumers | NO IMPACT | Do not pull retrieval into Slice 17 |
| 29 | physical audit table / schema was a planning concern | Current audit implementation has evolved, but product requirement is only auditable professional lifecycle/proof | NO IMPACT | Leave physical owner to Plan AI 2 |
| 30 | old Plan / Checklist / Tasks were authoritative for the old Spec | Historical package remains preserved but must not govern this reconciled Spec | NO IMPACT | New Plan AI 2 must re-plan |

Authority Drift: DETECTED.

Matrix summary:

~~~text
UNCHANGED: 8
CLARIFIED: 1
SUPERSEDED: 5
NEW REQUIRED INVARIANT: 8
IMPLEMENTATION-ONLY DRIFT: 5
NO IMPACT: 3
~~~

Only SUPERSEDED and NEW REQUIRED INVARIANT rows change the Frozen Spec semantics. CLARIFIED wording does not create a new product owner. IMPLEMENTATION-ONLY DRIFT is not promoted into product semantics.

## 5. Selection Revalidation

The Selection Gate is not reopened.

Selected Slice remains:

> Professional Knowledge Foundation

Reason:

- Professional Knowledge is still an explicit versioned professional asset.
- It remains necessary authoritative input before real RAG can safely consume professional content.
- No equivalent Professional Knowledge owner exists on current main.
- Slice 15 is a downstream Professional Content consumer for specific review packages, not a Knowledge owner.
- Slice 16 owns InterventionDefinition, not Knowledge.
- Slice 18/19 retrieval/evaluation/readiness work is downstream and cannot retroactively own Knowledge truth.

Selection Still Valid: PASS.

## 6. Purpose

A Professional Knowledge Item is a stable, versioned, attributable professional-content asset that explains professional background, why/how, limits, uncertainty, applicability, exclusions, caution, or educational context for an approved product/scene purpose.

It is not:

- Family Memory;
- Evidence or a family statement;
- Problem Formulation;
- a professional approval artifact by itself;
- an InterventionDefinition;
- an Intervention eligibility decision;
- a Safety decision;
- a Case/Phase truth;
- a generated answer;
- a retrieval chunk.

Slice 17 establishes authoritative Knowledge asset truth and the contract by which a Knowledge version may consume and validate external Professional Approval proof and participate in exact Scene Package version binding.

## 7. Preserved Semantics

The following old Slice 17 semantics remain valid:

- stable Knowledge identity;
- immutable released semantic versions;
- attributable professional source provenance;
- exact applicability/exclusion/risk metadata;
- historical traceability;
- fail-closed production eligibility;
- exact version/package binding, never floating latest;
- Knowledge is explanatory content and does not grant Intervention eligibility;
- family/case control planes are consumed, not duplicated;
- AI may assist drafting but cannot approve professional content;
- no fake reviewer, developer approval, AI approval, fixture promotion, or approved=true self-certification;
- no RAG, embeddings, chunk persistence, vector search, ranking, Context Builder, AI Task Runtime, TaskModelRegistry, or Phase 4 business truth;
- publication/release history is append/version based rather than destructive overwrite.

## 8. Superseded Semantics

The following old semantics are retired:

1. REVIEWED is no longer a Knowledge lifecycle state that means professional approval.
2. NEEDS_REVIEW must never be added to the Knowledge lifecycle enum.
3. A Staff PROFESSIONAL_REVIEW capability, reviewer role, database flag, successful test, or Slice freeze cannot itself create Professional Approval.
4. Slice 17 does not own Professional qualification and does not become a credential platform.
5. Slice 17 does not manufacture an approval record that becomes authoritative merely because it is persisted locally.
6. A distinct publisher capability / mandatory reviewer-versus-publisher separation-of-duties rule is not invented by this Slice.
7. Absence of a real assigned reviewer no longer blocks development of the entire fail-closed foundation.
8. Slice 16 merge is not a blanket prerequisite for the core Knowledge foundation; only an integration that references InterventionDefinition may depend on its usable authoritative seam.

## 9. Ownership / Single Source of Truth

| Truth | Sole authority / owner | Slice 17 relationship |
|---|---|---|
| Knowledge identity, semantic content version, Knowledge lifecycle, Knowledge validity projection, source-provenance snapshot | Slice 17 | Owns |
| Professional Approval authority | External Professional Authority | Consumes exact proof; never manufactures it |
| Professional qualification | Independent Professional Authority fact | Consumes exact qualification proof/reference only |
| Staff capability / assignment / revocation | Existing Staff Authority | Consumes; no second Staff/RBAC owner |
| Scene Package identity/version and exact Knowledge version set | Existing Scene Package authority | Contributes/references through owner seam; no second registry |
| Professional Content Package identity/version where a package is used | Existing/approved Professional Content Package authority | Consumes exact package/proof identity; no generic package registry |
| InterventionDefinition and Intervention eligibility | Slice 16 designated owner when authoritative | Optional exact reference only; never owns/approves |
| Case / Phase | Common Core | Consumer only |
| Evidence / Problem Formulation | Existing owners | Consumer only |
| Authorization / Consent / Compliance / Safety | Existing control planes | Consumer/composition only |
| RAG / retrieval / Context / model execution | Future designated owners | Downstream only |

No current-main equivalent Professional Knowledge owner was found. Slice 17 therefore does not duplicate an existing Knowledge truth.

## 10. Knowledge Lifecycle, Professional Approval, and Validity

These dimensions are independent.

### 10.1 Knowledge lifecycle / release

Knowledge lifecycle expresses where the content asset is in its own business/release history.

The semantic minimum is:

~~~text
pre-release candidate / draft
→ published release
→ superseded / retired / expired when applicable
~~~

A released Knowledge version is immutable. A substantive change creates a successor version.

The exact persisted enum names are an implementation detail for Plan AI 2 so long as they preserve these semantics.

### 10.2 Professional review / approval plane

Professional review and Professional Approval are not Knowledge lifecycle values.

The architecture-level approval plane is:

~~~text
candidate content
→ professional review activity
→ external Professional Approval decision/proof
→ publication/release if all release gates pass
~~~

Definitions:

- REVIEWED: historical review activity/evidence only. It is not a sufficient authority status.
- APPROVED: a current external Professional Approval proof exists and exactly matches the Knowledge artifact/version/hash/source/scope plus reviewer authority/qualification facts.
- PUBLISHED: the Knowledge version has been released for the exact approved product/scene scope after all required gates, including valid approval proof, have passed.

A version may have been reviewed and still be unapproved, rejected, expired, revoked, mismatched, or unpublished.

### 10.3 Review / validity state

Each current Knowledge version must separately represent whether it remains trustworthy/usable under its dependencies.

At minimum:

~~~text
CURRENT / VALID
NEEDS_REVIEW
~~~

Where current Authority proves an asset can no longer legally or professionally be used, the system must represent an invalid / unusable outcome and fail closed. The exact persistence vocabulary is implementation detail; it must not be encoded as a fake lifecycle transition.

Rules:

- NEEDS_REVIEW never automatically changes lifecycle_status.
- NEEDS_REVIEW cannot be treated as an unaffected authoritative production basis.
- no material impact after review → restore CURRENT / VALID without lifecycle mutation;
- material semantic change → create successor version and obtain fresh approval;
- authority/source condition makes use invalid → immediately suppress new production use and retain historical references.

## 11. Professional Approval Plane

Slice 17 is an Approval Authority consumer, not an Approval Authority creator.

A valid production approval proof must bind, at minimum:

~~~text
Knowledge artifact identity
exact Knowledge content version
exact content hash
source refs / provenance identity
approval scope
approval proof identity
reviewer identity
Staff assignment / authority reference
PROFESSIONAL_REVIEW capability
professional qualification reference
qualification scope matching approval scope
reviewed_at
approval status
effective period
publication/release status where applicable
~~~

Rules:

- the proof must match the exact content that is loaded/used;
- content/hash/source/scope drift invalidates the match;
- expired/revoked/mismatched/unverifiable reviewer or qualification proof fails closed;
- a current Staff assignment cannot substitute for professional qualification;
- a professional qualification cannot substitute for a Staff assignment/capability;
- code, DB fields, tests, fixtures, AI outputs, or historical references cannot synthesize approval;
- production proof resolution must distinguish dependency unavailable from proof invalidity internally;
- external disclosure remains bounded and anti-enumerating;
- approval must be revalidated at the authoritative release/consumption boundary where stale-proof races are possible.

Slice 17 may persist an immutable approval-proof reference or bounded snapshot required to prove what exact authority was consumed. That local record is evidence of consumption, not the source that creates Professional Approval.

## 12. Staff Authority / Professional Qualification Boundary

Professional asset administration is not Family authority.

A real professional operation requires the applicable current Staff authority facts, including explicit capability/assignment/scope/revocation checks.

PROFESSIONAL_REVIEW means:

> the Staff actor is authorized to perform the relevant professional-review operation within the assignment scope.

It does not mean:

- the actor has a matching professional qualification;
- the content is approved;
- an approval proof exists;
- the actor may approve arbitrary professional scopes;
- the actor may publish arbitrary content;
- the actor is a universal administrator.

Professional qualification remains an independent fact. Slice 17 consumes qualification reference/scope/status from its true owner/provider and must not create a credentialing platform.

No ADMIN=true, reviewer=true, hard-coded qualification, synthetic reviewer, or developer/AI reviewer may create production authority.

## 13. Publication Authority / Publisher Decision

Current Authority does not mandate a separate PUBLISH capability or reviewer-versus-publisher separation-of-duties rule.

Therefore Slice 17 freezes the following, and no more:

- publication is a controlled release operation;
- publication requires a current exact Professional Approval proof and all other required release gates;
- publication requires an authorized Staff operation under the established Staff Authority model;
- no rule may assume reviewer == publisher as an authority shortcut;
- no rule may require reviewer != publisher unless a future Authority Doc explicitly adds separation of duties;
- Slice 17 does not invent a publisher registry, publisher role, or generic approval workflow.

## 14. Professional Content Package / Knowledge / Scene Package Boundary

Three concepts must not be collapsed.

### 14.1 Professional Knowledge Item

The Knowledge Item/version is the professional explanatory content asset owned by Slice 17.

A Knowledge version may itself be the exact artifact targeted by Professional Approval, or may be released as an exact member of an approved Professional Content Package where the true package owner defines such packaging.

Slice 17 must not create a generic Professional Content Package registry merely to make approval possible.

### 14.2 Professional Content Package

Professional Content Package is an approval/release container for professional content where current product/architecture authority uses such a package.

It owns its own exact package identity/version/content hash and approval proof contract through its true authority.

Slice 17 may:

- reference an exact approved Professional Content Package version;
- validate that an exact Knowledge version/hash is the content actually covered by the proof;
- preserve immutable proof/binding evidence.

Slice 17 may not:

- mint a package as approved;
- create a second Professional Content Package registry;
- treat package existence as approval.

### 14.3 Scene Package

Scene Package is the scene/business package authority.

Current V1 technical authority requires a published scenario package version to lock an exact Knowledge version set.

Therefore the exact Scene Package version → Knowledge version set is owned by the Scene Package authority, not by Slice 17.

Slice 17 may contribute an exact Knowledge version reference through the authoritative Scene Package seam. It must not create:

- another scene_packages registry;
- another node manifest/router;
- a floating latest relation;
- a mutable rewrite of a historical Scene Package snapshot.

A Scene Package may reference exact Professional Knowledge assets and, where applicable, exact Professional Content Package versions. That reference does not create Professional Approval.

## 15. Source Provenance

Every publishable Knowledge version must preserve reviewable professional provenance sufficient to establish what sources the reviewer saw and what source identity was approved.

Rules:

- if a canonical source identity/reference already exists under an upstream professional owner, reuse that identity rather than creating a competing source truth;
- Slice 17 may retain an immutable Knowledge-review provenance snapshot necessary for exact historical proof;
- source reference alone is not verification or approval;
- unresolved/unverifiable required source provenance prevents production release;
- raw copyrighted source-document ingestion, full document archive, OCR/parser/crawler, and generic source platform remain out of scope;
- a source correction/withdrawal does not silently rewrite an already released Knowledge version.

## 16. Source / Approval / Package Dependency Propagation

Propagation is impact-scoped, not global.

### 16.1 Source withdrawn or corrected

If a source change may affect a Knowledge version's professional meaning, applicability, exclusion, risk, or approval basis:

- affected Knowledge version enters NEEDS_REVIEW;
- new production use is suppressed while material impact is unresolved;
- historical exact references remain;
- no-material-impact review restores CURRENT / VALID;
- material impact requires a successor Knowledge version and fresh approval;
- a source proven unusable for current production may invalidate production eligibility immediately.

### 16.2 Approval expiry / revocation / invalid proof

Approval expiry, revocation, or proof invalidity immediately removes production eligibility.

It does not mechanically rewrite Knowledge lifecycle.

If the Knowledge content/hash/source/scope is unchanged, approval expiry/revocation alone does not force a semantic successor version. A later new valid approval proof for that same exact version may restore production eligibility; any external issuer requirement for a different artifact version remains external Professional Authority, not Slice 17 content-version semantics.

If the content/source/scope changed materially, a successor version and fresh approval are required.

### 16.3 Professional qualification / Staff authority revocation

Revoking a reviewer's current Staff assignment or qualification does not rewrite historical approval evidence.

For new production use, the current approval proof must remain valid under the applicable Authority contract. If current Authority requires that the proof is no longer valid, the Knowledge version fails closed and may require review/reapproval.

The system must not silently convert an invalid reviewer/qualification state into CURRENT approval.

### 16.4 Scene Package supersession

Scene Package supersession does not automatically invalidate the underlying Knowledge content.

- historical Scene Package bindings remain exact;
- a successor Scene Package must explicitly bind its own exact Knowledge version set;
- a Knowledge version is marked NEEDS_REVIEW only when the package change materially affects its applicability/meaning/dependency;
- no floating latest package or implicit rebinding is allowed.

### 16.5 InterventionDefinition reference supersession

An optional Knowledge → InterventionDefinition reference is explanatory only.

If an exact referenced InterventionDefinition becomes superseded/retired and that change may alter the Knowledge explanation, the affected Knowledge enters NEEDS_REVIEW.

Knowledge cannot make an Intervention current, approved, or eligible.

## 17. Persistence / Versioning Semantics

One logical Knowledge identity may have multiple exact semantic versions.

Requirements:

- stable Knowledge identity;
- exact semantic version identity;
- exact content hash;
- immutable released content and reviewed metadata;
- explicit successor/supersedes relation;
- exact source provenance snapshot;
- exact external approval-proof reference/snapshot when approved;
- independent lifecycle and review/validity state;
- historical bindings retained.

Pre-release candidate edits may be revisioned with optimistic concurrency. A substantive change after publication creates a successor version.

No mutable latest alias is an authority.

The physical table layout, migration number, Drizzle type, command names, and transaction implementation are Plan AI 2 concerns.

## 18. Deterministic Production Eligibility

Production eligibility is a deterministic content eligibility decision, not an Intervention decision.

A Knowledge version can be eligible for a new downstream production use only when all applicable conditions are true:

- exact Knowledge version exists;
- lifecycle/publication state permits new use;
- review/validity state is CURRENT / VALID;
- current external Professional Approval proof is valid for the exact version/hash/source/scope;
- exact Scene Package binding is valid for the requested scene/package version;
- any applicable Professional Content Package binding/proof matches exactly;
- stage, age/development, applicability, exclusion, risk, locale and other required hard-filter metadata match;
- downstream actor/family/case/purpose Authorization is valid when family-scoped use is requested;
- applicable Consent, Compliance and Safety gates pass;
- required upstream professional references are current enough for the requested use.

Fail closed on missing, unknown, stale, mismatched, retired, superseded, expired, unapproved, unavailable, or invalid required authority.

No fallback to a nearby version, nearest package, draft, stale cached candidate, or model-generated replacement.

## 19. Authorization Boundary

Two different access domains exist.

### 19.1 Professional asset administration

Professional administration includes create/edit candidate, read unpublished professional assets, perform review operations, release/publish where authorized, supersede/retire, and inspect professional history.

These operations require Staff / Professional authority.

Family Manager, Guardian, ordinary Family Account, Case ownership, paid status, or ordinary participant status do not grant professional asset administration.

### 19.2 Family-facing downstream consumption

Family-facing use is purpose-bound consumption of already eligible professional content.

It must compose:

~~~text
current actor/family/case/purpose Authorization
+ applicable Consent
+ Compliance
+ Safety
+ exact eligible Professional Knowledge
~~~

Family-facing permission to consume a published item never grants browse/read access to the unpublished professional asset store.

Unauthorized actors must not be able to enumerate Knowledge IDs, versions, package existence, reviewer identity, approval state, or unpublished history through response differences.

## 20. Consent / Compliance / Safety Boundaries

Consent remains with its existing owner. Knowledge administration cannot mint/change/infer family Consent.

Compliance remains with its existing owner. Age labels or Knowledge metadata cannot grant legal/compliance eligibility.

Safety remains with its existing owner. Knowledge text cannot:

- clear Safety Hold;
- downgrade risk;
- create Safety professional rules;
- authorize a contraindicated Intervention;
- override Safety Resolver authority.

Professional Knowledge may explain safety concepts, but executable Safety authority remains outside Slice 17.

## 21. AI Boundary

AI may assist with candidate drafting only.

AI cannot:

- create Professional Approval;
- create professional qualification;
- grant Staff authority;
- publish/release production Knowledge by self-certification;
- turn test fixtures into production authority;
- resolve a missing Professional Authority dependency by hallucinating content;
- override deterministic production eligibility.

No real model call is necessary to prove Slice 17 foundation behavior.

## 22. Reliability / History

Mutating commands must preserve the repository's shared exact-replay/mismatch-conflict idempotency semantics.

Concurrent candidate edits, release, supersession, retirement, and proof/binding updates must not last-write-win over newer authoritative state.

A successful lifecycle/release action must atomically settle the Slice-owned mutation plus the required exact proof/binding/audit/idempotency evidence that belongs in that transaction. It must not create a partial published truth pointing to uncommitted or mismatched authority.

Technical timeout is outcome-unknown until authoritative readback.

Historical exact versions, approval-proof references, and Scene Package bindings remain inspectable under authorized access even when no longer eligible for new use.

## 23. Audit / Observability

Professional lifecycle and authority consumption must be auditable.

At minimum audit:

- candidate creation and substantive edit;
- review request/result evidence where represented;
- external approval-proof binding/revalidation outcome;
- publication/release;
- supersession/retirement/expiry handling;
- validity → NEEDS_REVIEW / restoration / invalidation;
- source dependency change handling;
- Scene Package exact binding contribution;
- authorization/authority denial reason in bounded internal form.

Do not log family private narratives, credentials, full copyrighted source material, or unnecessary professional reviewer personal data.

This Spec does not choose a physical audit table. Plan AI 2 must reuse or minimally extend the authoritative audit owner rather than create an unnecessary second ledger.

## 24. Development Implement Gate

Development Implement Gate: OPEN.

Meaning:

Slice 17 foundation may be implemented without a currently assigned real Professional Reviewer, provided the implementation cannot convert its own code/schema/test fixtures into Professional Approval.

Development may implement:

- stable candidate Knowledge identity;
- semantic versioning / immutable history;
- source provenance/reference model;
- lifecycle and independent review/validity state;
- exact content hashing;
- external approval-proof provider/consumer contract;
- exact proof validation/revalidation and fail-closed outcomes;
- Staff authority integration through the existing owner;
- professional qualification consumer seam without credential ownership;
- exact Scene Package contribution/consumer seam without second package registry;
- deterministic production eligibility;
- historical/audit/anti-enumeration/reliability mechanics;
- explicit test-only synthetic authority fixtures that are structurally unreachable from production.

Development must not require Slice 16 to be merged merely to create the core Knowledge foundation.

If a concrete implementation path references InterventionDefinition, it must consume the current authoritative Slice 16 owner when that owner is merged/usable; until then that optional integration remains unavailable/fail-closed rather than being duplicated.

A missing real reviewer is not permission to create fake authority.

## 25. Professional Production Release Gate

Professional Production Release Gate: BLOCKED.

Current reason:

> APPROVED PROFESSIONAL REVIEWER — UNASSIGNED

Until a real current Professional Approval authority exists and the exact Knowledge version has a valid approval proof, production must not claim:

- Professional Knowledge APPROVED;
- Professional Knowledge professionally PUBLISHED for family service;
- a Professional Content Package containing that content is approved merely because Slice 17 stored it;
- a professional questionnaire/instrument is approved;
- an Intervention is approved;
- a professional Safety rule is approved.

Production behavior must remain truthful and fail closed.

The Production Release Gate may open only from real authority evidence, not from a future code change that toggles a boolean.

## 26. Dependencies

### Already satisfied / current-main foundations

- four current Authority Docs;
- Authority Inputs pinning;
- Slice 13 merged;
- Slice 14 merged;
- Slice 15 authority-reconciled runtime merged;
- current Authorization / Consent / Compliance / Safety owners;
- Staff assignment/capability foundation;
- current security / anti-enumeration / Account hard-disable foundations;
- Problem Formulation lifecycle/review-state separation precedent.

### Implementation-time conditional dependency

Slice 16 is not a blanket prerequisite.

If Slice 17 implementation includes an exact InterventionDefinition reference, it must wait for or consume the actual authoritative merged Slice 16 seam. No second Intervention owner may be created.

The exact physical Scene Package contribution seam and professional audit seam must be re-inventoried by Plan AI 2. Missing physical seams may require fail-closed ports/minimal extensions; they do not change the ownership frozen here.

### Release-time external dependency

Real Professional Reviewer / Professional Approval authority remains required for production approval/release.

### Downstream-only dependencies

The following remain downstream and must not be implemented in Slice 17:

- embeddings;
- chunk persistence;
- pgvector;
- sparsevec;
- pg_jieba;
- lexical retrieval;
- dense/sparse retrieval;
- RRF/fusion;
- reranker;
- RAG A/B/C;
- Professional Retrieval Gold Dataset execution;
- Context Builder;
- AI Task Runtime;
- TaskModelRegistry;
- Promptfoo runtime;
- Jev production runtime;
- model/provider execution.

Slice 18/19 planning or implementation cannot retroactively alter Slice 17's professional truth ownership.

## 27. Explicit Out of Scope

No:

- RAG/retrieval implementation;
- embeddings/chunks/vector tables;
- generic CMS;
- generic source ingestion/document platform;
- reviewer marketplace;
- credentialing platform;
- generic approval workflow engine;
- generic RBAC/Admin=true system;
- second Staff Authority;
- second Professional Content Package registry;
- second Scene Package registry;
- second node manifest/router;
- second InterventionDefinition owner;
- second Safety owner;
- second Authorization/Consent/Compliance owner;
- Family Memory truth;
- Case/Evidence/Formulation duplication;
- Plan/Task/Review/Outcome/Schedule/Notification Phase 4 truth;
- professional questionnaire/scoring/cutoff invention;
- fake reviewer/qualification/approval;
- legal authority invention;
- raw copyrighted source archive;
- production AI answer release.

## 28. Clarifications / Frozen Decisions

C01 — Professional Knowledge Foundation remains Slice 17.

C02 — Knowledge lifecycle and review/validity state are independent dimensions.

C03 — REVIEWED is review evidence/activity, not an approval lifecycle status.

C04 — APPROVED means a valid external Professional Approval proof exists for the exact artifact/version/hash/source/scope.

C05 — PUBLISHED means released for exact approved scope after all release gates; it is not proof of professional authority by itself.

C06 — Slice 17 owns Knowledge truth, not Professional Approval authority.

C07 — PROFESSIONAL_REVIEW capability proves permission to perform a scoped operation; it does not prove qualification or approval.

C08 — Professional qualification is an independent fact consumed from its real owner/provider.

C09 — Approval proof binds exact content identity, sources, approval scope, reviewer identity, Staff assignment/capability, qualification/scope, timestamps/effective period and proof identity.

C10 — Slice 17 may persist a bounded immutable proof reference/snapshot but cannot mint authority by persisting it.

C11 — Professional Content Package and Scene Package are different authorities.

C12 — Slice 17 does not create a generic Professional Content Package registry. A Knowledge asset may be approved directly as an artifact or be covered by an exact existing package.

C13 — Scene Package authority owns the exact knowledge-version set for each Scene Package version.

C14 — Slice 17 never creates a second Scene Package registry/router.

C15 — Publisher separation-of-duties is not mandated by current Authority. No separate publisher role/capability is invented.

C16 — Development Implement Gate and Professional Production Release Gate are separate.

C17 — Development Implement Gate is OPEN for a fail-closed foundation.

C18 — Professional Production Release Gate is BLOCKED while APPROVED PROFESSIONAL REVIEWER — UNASSIGNED.

C19 — No real reviewer means no production professional approval/release, not “no code may be developed”.

C20 — Source correction/withdrawal propagates NEEDS_REVIEW only to genuinely affected Knowledge versions.

C21 — Approval expiry/revocation immediately suppresses production eligibility but does not mechanically mutate lifecycle.

C22 — Scene Package supersession does not automatically invalidate Knowledge; exact historical bindings remain.

C23 — optional InterventionDefinition references never grant or decide Intervention eligibility.

C24 — Knowledge remains fully independent from Safety, Case truth, Formulation truth and Intervention eligibility.

C25 — No RAG / embedding / chunking is introduced.

C26 — Test fixtures may prove protocols but are never production Professional Authority.

C27 — No duplicate Professional Knowledge owner exists on current main.

C28 — Physical table names, migration number, audit storage and code module layout are Plan AI 2 implementation concerns.

Open Product Decisions: 0.

## 29. Prior FR Reconciliation Classification

Every prior FR-001…FR-040 is classified below.

### UNCHANGED

~~~text
FR-001 FR-002 FR-003 FR-004 FR-005 FR-006 FR-007
FR-014 FR-015 FR-016 FR-017 FR-018 FR-019 FR-020
FR-022 FR-023 FR-024 FR-025 FR-026 FR-027 FR-028 FR-029
FR-031 FR-032 FR-034 FR-035 FR-036 FR-037 FR-038
~~~

### MODIFIED

~~~text
FR-010 FR-011 FR-012 FR-013 FR-021 FR-030 FR-033 FR-039
~~~

### SPLIT

~~~text
FR-008 FR-009
~~~

Those old REVIEWED semantics are split into review activity, external Professional Approval proof, publication/release, and validity requirements.

### RETIRED

~~~text
FR-040
~~~

The old whole-implementation blocker is retired and replaced by separate Development Implement and Professional Production Release gates.

### NEW

~~~text
FR-041 FR-042 FR-043 FR-044 FR-045 FR-046
FR-047 FR-048 FR-049 FR-050 FR-051 FR-052
~~~

## 30. Functional Requirements

- FR-001 — Exactly one Professional Knowledge owner exists; Slice 17 does not duplicate InterventionDefinition or another professional truth.
- FR-002 — Every Knowledge Item has a stable identity and every substantive semantic version has an exact immutable version identity.
- FR-003 — Every publishable version carries content, language/locale, scene/purpose, stage, age/development scope, applicability, exclusions, risk and attributable source provenance required by its scope.
- FR-004 — Missing required applicability/exclusion/risk metadata never means universal applicability.
- FR-005 — Required professional source identity/provenance must be reviewable; unresolved/unverifiable required provenance prevents production release.
- FR-006 — Professional Knowledge content/source metadata does not become a store for identifiable Family/child Case data.
- FR-007 — A pre-release candidate/draft is never production selectable.
- FR-008 — A review activity/result is auditable but cannot by itself produce Professional Approval.
- FR-009 — APPROVED production status requires a current external Professional Approval proof exactly bound to the Knowledge artifact/version/hash/source/scope and reviewer authority/qualification facts.
- FR-010 — A substantive content/source/applicability/exclusion/risk/scope change invalidates the old approval match for new production use and requires successor/fresh review/approval as applicable.
- FR-011 — PUBLISHED/released Knowledge requires complete metadata, exact current Professional Approval proof and all applicable release gates.
- FR-012 — New production use requires exact Scene Package version → Knowledge version binding through the authoritative Scene Package owner; no floating latest.
- FR-013 — Only exact PUBLISHED/released + CURRENT/VALID + currently approved + scope-matching Knowledge may be production eligible.
- FR-014 — Wrong scene/stage/age/applicability/exclusion/risk/locale/required scope fails closed.
- FR-015 — Superseded/retired/expired/unusable versions cannot be selected for new production use while historical identity remains.
- FR-016 — A terminal/superseded released version is not reactivated by in-place semantic mutation; substantive correction uses a successor.
- FR-017 — Released content and the semantic metadata covered by its approval hash are immutable.
- FR-018 — Scene Package Knowledge-set history remains exact, inspectable and owned by the Scene Package authority.
- FR-019 — Knowledge and InterventionDefinition lifecycle/approval remain independent; optional cross-reference is exact and explanatory only.
- FR-020 — Knowledge never decides Intervention eligibility, Plan activation, Safety outcome, Case truth or Formulation truth.
- FR-021 — Professional asset administration uses current Staff Authority capability/assignment/scope and cannot be granted by Family roles.
- FR-022 — Family-facing downstream consumption composes current actor/family/case/purpose Authorization before content use.
- FR-023 — Unauthorized callers cannot infer protected Knowledge/package/reviewer/approval/unpublished existence through externally distinguishable errors.
- FR-024 — Knowledge lifecycle/administration cannot create, modify or infer Consent truth.
- FR-025 — Compliance/age/purpose authority remains external and cannot be overridden by Knowledge labels.
- FR-026 — Safety authority remains external; Knowledge cannot clear or downgrade Safety controls.
- FR-027 — AI-assisted content remains candidate until real authority proof exists; AI cannot approve/publish by self-certification.
- FR-028 — Mutating Knowledge commands reuse the repository's shared exact-replay / mismatch-conflict idempotency semantics.
- FR-029 — Stale revisions and concurrent transitions cannot last-write-win over newer Knowledge state/proof/binding.
- FR-030 — Successful release/lifecycle mutation atomically binds the required exact Knowledge state plus proof/binding/audit/idempotency evidence owned by that transaction; partial authority truth is forbidden.
- FR-031 — Partial failure rolls back business effects; timeout/unknown outcome requires authoritative readback.
- FR-032 — Professional Knowledge lifecycle, proof consumption, source impact and release decisions are auditable without sensitive/private/full-source leakage.
- FR-033 — Source/approval/package/upstream change propagates NEEDS_REVIEW or invalidation only to genuinely affected Knowledge/dependents while preserving history.
- FR-034 — Slice 17 creates no embedding, chunk, vector/lexical retrieval, RAG, model runtime, Context Builder or Phase 4 truth.
- FR-035 — Tests prove the protocol without promoting synthetic reviewer/qualification/approval fixtures into production.
- FR-036 — Wrong/unknown package/version/hash/proof never falls back to a different package, version or nearest content.
- FR-037 — An empty genuinely approved/published Knowledge set remains truthful unavailable/empty rather than synthetic content.
- FR-038 — Professional Knowledge does not create another Evidence, Problem Formulation, Family Memory or source-of-family-truth store.
- FR-039 — Stale cached/downstream references cannot make unapproved, NEEDS_REVIEW, invalid, retired, superseded or expired Knowledge production eligible.
- FR-040 — Development Implement Gate and Professional Production Release Gate are independent; development may proceed fail-closed while professional release remains blocked.
- FR-041 — Knowledge lifecycle_status is independent from review_state / validity_state; NEEDS_REVIEW is never a lifecycle value.
- FR-042 — NEEDS_REVIEW suppresses use as an unaffected authoritative production basis without mechanically changing lifecycle.
- FR-043 — Review resolution follows: no material impact → CURRENT/VALID; material impact → successor + fresh approval; cannot legally/professionally continue → invalid/unusable.
- FR-044 — PROFESSIONAL_REVIEW capability + valid Staff assignment are necessary operation-authority facts but never substitute for matching professional qualification or approval proof.
- FR-045 — Professional qualification is consumed as an independent scoped fact and is not manufactured by Slice 17.
- FR-046 — Exact approval proof binds Knowledge identity/version/hash, source refs, approval scope, proof identity, reviewer identity, Staff authority reference, qualification reference/scope and effective/reviewed/publication timing.
- FR-047 — Professional Authority unavailable and Professional Authority invalid/mismatched remain distinct internal fail-closed outcomes; neither becomes approval.
- FR-048 — Slice 17 is an approval-proof consumer and may retain bounded immutable proof evidence, but local persistence never becomes the authority that creates approval.
- FR-049 — Professional Content Package and Scene Package are distinct; Slice 17 creates neither a generic Professional Content Package registry nor a second Scene Package registry.
- FR-050 — Current APPROVED PROFESSIONAL REVIEWER — UNASSIGNED state forbids production professional approval/release but does not forbid development of candidate/version/proof-consumer foundation.
- FR-051 — Canonical professional source identity is reused when available; Slice 17 stores only the immutable Knowledge-review provenance snapshot/reference needed for its own truth.
- FR-052 — Current Authority does not impose a separate publisher capability or reviewer/publisher separation of duties; publication still requires authorized Staff operation plus a valid exact Professional Approval proof, and no reviewer==publisher shortcut is assumed.

Functional Requirements: 52.

## 31. Acceptance Scenarios

- AS-001 — Authorized candidate-authoring path creates a complete Knowledge candidate; it remains nonproduction.
- AS-002 — Candidate content with no Professional Approval proof cannot be released.
- AS-003 — A Staff actor with PROFESSIONAL_REVIEW capability but no matching qualification cannot create valid Professional Approval.
- AS-004 — A matching qualification without valid Staff assignment/capability cannot create valid Professional Approval.
- AS-005 — Family Manager/Guardian/Case owner cannot administer professional Knowledge merely because Family authorization is valid.
- AS-006 — An AI identity, developer flag, approved=true field or production configuration cannot manufacture approval.
- AS-007 — A test-only synthetic provider can prove protocol behavior but is structurally unreachable as production authority.
- AS-008 — Exact real approval proof matching Knowledge id/version/hash/source/scope/reviewer/qualification is accepted as external authority evidence.
- AS-009 — Same proof with wrong Knowledge version fails closed.
- AS-010 — Same proof with wrong content hash fails closed.
- AS-011 — Same proof with changed source refs fails closed.
- AS-012 — Same proof with wrong approval scope fails closed.
- AS-013 — Revoked/expired/unverifiable Staff authority proof fails closed.
- AS-014 — Missing/revoked/expired/mismatched professional qualification fails closed.
- AS-015 — Expired/revoked Professional Approval proof prevents new production use without rewriting Knowledge lifecycle.
- AS-016 — Professional Authority provider unavailable yields truthful dependency-unavailable behavior, not approved=false fabricated authority.
- AS-017 — Reviewed activity without APPROVED external proof remains nonproduction.
- AS-018 — APPROVED external proof without publication/release does not make Knowledge family-facing production content.
- AS-019 — PUBLISHED/released Knowledge with review_state NEEDS_REVIEW is excluded from new authoritative production use.
- AS-020 — No-material-impact re-review restores CURRENT/VALID without changing lifecycle.
- AS-021 — Material source/content/scope change creates a successor version and requires fresh approval.
- AS-022 — Source withdrawal that makes current use invalid immediately suppresses new use and preserves historical citations.
- AS-023 — Approval expires while content/hash/source/scope is unchanged; production use stops, and a later new valid proof for that same exact version restores eligibility without forced Knowledge content-version churn.
- AS-024 — Scene Package v1 historical binding remains unchanged when Scene Package v2 binds another Knowledge version.
- AS-025 — Scene Package supersession alone does not mark unrelated Knowledge NEEDS_REVIEW.
- AS-026 — Scene Package change that materially changes Knowledge applicability marks only affected Knowledge NEEDS_REVIEW.
- AS-027 — Knowledge exact InterventionDefinition reference becomes superseded; affected explanatory content enters NEEDS_REVIEW when material, but no Intervention eligibility is changed by Knowledge.
- AS-028 — Knowledge explaining an unapproved InterventionDefinition cannot make the Intervention eligible.
- AS-029 — Wrong scene/stage returns no eligible content and never approximate fallback.
- AS-030 — Wrong age/development scope fails closed.
- AS-031 — Missing/UNKNOWN required applicability data fails closed rather than being interpreted as ALL.
- AS-032 — Applicable exclusion or incompatible risk scope blocks content eligibility.
- AS-033 — Wrong Scene Package version cannot resolve floating latest Knowledge.
- AS-034 — Wrong Professional Content Package identity/version/hash cannot authorize a Knowledge version.
- AS-035 — A Professional Content Package exists but has no valid approval proof; existence does not create approval.
- AS-036 — An approved Professional Content Package exact version may cover an exact Knowledge version only when the proof/content binding actually matches.
- AS-037 — Retired/superseded/expired Knowledge remains historically readable under proper authorization but unavailable for new production use.
- AS-038 — Published content correction never overwrites the released version in place.
- AS-039 — Same idempotency key + same semantic command replays one authoritative result.
- AS-040 — Same idempotency key + materially different command conflicts with no duplicate business effect.
- AS-041 — Two concurrent release/supersede/retire transitions cannot produce contradictory current truth.
- AS-042 — Stale expected revision/proof cannot overwrite newer authoritative state.
- AS-043 — Partial transaction failure leaves no half-released Knowledge/proof/binding/audit state.
- AS-044 — Commit-succeeded/response-lost outcome is resolved by authoritative readback rather than guessed.
- AS-045 — Wrong Family/Case/purpose is denied at family-facing consumption without exposing unpublished professional asset existence.
- AS-046 — Consent withdrawal blocks affected downstream family processing while leaving generic immutable Knowledge history intact.
- AS-047 — Compliance restriction blocks delivery even when Knowledge metadata claims an age match.
- AS-048 — Safety Hold/control blocks affected downstream use even if Knowledge text appears reassuring.
- AS-049 — Empty approved/published Knowledge set returns truthful empty/unavailable and no model-generated filler.
- AS-050 — With APPROVED PROFESSIONAL REVIEWER — UNASSIGNED, development/test foundation can be complete while Professional Production Release Gate remains BLOCKED and production exposes no fake approved Knowledge.

Acceptance Scenarios: 50.

## 32. Negative Scope Scenarios

- NS-01 — No knowledge_embeddings table, embedding call or pgvector work.
- NS-02 — No retrieval/search/ranking/fusion/RRF/reranker/RAG A/B/C.
- NS-03 — No chunk persistence, document parser, OCR, crawler or generic source-ingestion pipeline.
- NS-04 — No generic CMS.
- NS-05 — No reviewer marketplace or professional staffing marketplace.
- NS-06 — No credentialing/qualification-management platform.
- NS-07 — No generic approval workflow engine.
- NS-08 — No generic RBAC builder or ADMIN=true universal authority.
- NS-09 — No second Staff Authority.
- NS-10 — No second Professional Content Package registry.
- NS-11 — No second Scene Package registry, node Manifest or router.
- NS-12 — No new InterventionDefinition lifecycle, second Intervention gate or InterventionInstance owner.
- NS-13 — No new Safety, Authorization, Consent or Compliance owner.
- NS-14 — No second Case/Evidence/Formulation/Family Memory truth.
- NS-15 — No AI Task Runtime, Context Builder, TaskModelRegistry, model gateway or agent framework.
- NS-16 — No Jev production decision or Promptfoo runtime.
- NS-17 — No A4003 roleplay, Problem Formulation AI or execution-support AI.
- NS-18 — No Phase 4 Goal/Plan/Task/Checkin/Review/Outcome/Schedule/Notification runtime.
- NS-19 — No raw professional-document archive or default copyrighted-material redistribution.
- NS-20 — No Family private records automatically transformed into Professional Knowledge.
- NS-21 — No fake reviewer, fake qualification, developer approval, AI approval, fixture approval, approved=true authority laundering or test-artifact promotion.
- NS-22 — No floating latest Knowledge/package binding or silent historical rewrite.
- NS-23 — No Professional Approval authority created by Slice 17; only proof consumption/validation.
- NS-24 — No amendment to the four Authority Docs, historical Slice 17 Frozen Spec, old Plan/Checklist/Tasks, Slice 16, or later Slice authority.

Negative Scope Scenarios: 24.

## 33. Dependency / Gate Summary

~~~text
Selection:
PASS

Selected Slice:
Professional Knowledge Foundation

Development Implement Gate:
OPEN

Professional Production Release Gate:
BLOCKED

Blocking release dependency:
APPROVED PROFESSIONAL REVIEWER — UNASSIGNED

Slice 16:
OPEN PR #57 / NOT MERGED
Not a blanket core-development blocker.
Required only for any concrete exact InterventionDefinition integration seam.

RAG / retrieval:
DOWNSTREAM ONLY
~~~

## 34. Frozen Spec Integrity Gate

Required freeze conditions:

- Current main exact SHA known: PASS
- Current Authority Inputs exact blobs known: PASS
- Previous Frozen Spec commit/blob verified: PASS
- Previous historical Frozen Spec preserved: PASS
- Slice 16 current state/head verified: PASS
- Authority Drift Matrix complete: PASS
- Selection still valid: PASS
- lifecycle vs review/validity separation complete: PASS
- REVIEWED / APPROVED / PUBLISHED distinction complete: PASS
- Professional Approval external-proof boundary complete: PASS
- Staff capability / qualification boundary complete: PASS
- Professional Content Package ownership complete: PASS
- Scene Package ownership complete: PASS
- source provenance boundary complete: PASS
- NEEDS_REVIEW propagation complete: PASS
- Knowledge / Intervention boundary complete: PASS
- Development vs Production Release gates separated: PASS
- dependencies reclassified: PASS
- Functional Requirements complete: PASS
- Acceptance Scenarios complete: PASS
- Negative Scope complete: PASS
- duplicate owner detected: NO
- Open Product Decisions: 0
- Scope Drift: 0

## 35. Authority-Reconciliation Decision

Previous Frozen Authority remains historically valid for the authority/runtime state in which it was created.

Current Authority has superseded only the affected semantics identified by the Drift Matrix.

The reconciled Slice 17 contract is:

> Build Professional Knowledge as a versioned authoritative content foundation that can exist and be tested without laundering Professional Authority. Keep Knowledge lifecycle independent from review/validity, consume exact external Professional Approval/qualification proof, let the true Scene Package owner bind exact Knowledge versions, fail closed for production while Professional Authority is unassigned, and remain upstream of — but separate from — RAG and Intervention eligibility.

## 36. Plan AI 1 Stop Boundary

This role stops after this reconciled Frozen Spec is written and integrity-checked.

Do not continue into:

- plan.md;
- checklist.md;
- tasks.md;
- Audit 1;
- production code;
- migration;
- implementation tests;
- Slice 16 changes;
- Audit 2;
- merge.

Final Frozen Decision:

~~~text
Selected Slice:
Professional Knowledge Foundation

Selection:
PASS

Development Implement Gate:
OPEN

Professional Production Release Gate:
BLOCKED

Open Product Decisions:
0

Scope Drift:
0

Decision:
READY FOR NEW PLAN AI 2
~~~

STOP.
