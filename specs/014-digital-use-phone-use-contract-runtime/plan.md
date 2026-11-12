# Slice 14 Implementation Plan — Digital Use Phone Use Contract Runtime

> Feature: PHONE_USE_CONTRACT / A4001–A4012
>
> Role boundary: Plan AI 2 only
>
> Frozen Spec commit: 3984a04b1b30b2beb96f146f65668bfb95ae05a3
>
> Frozen Spec blob: e21d5948b99fb96b6f28452304cc2afc1c61ba32
>
> Planning branch: plan/014-digital-use-phone-use-contract-runtime
>
> Planning status: FROZEN after Audit 1 FINAL PASS
>
> Runtime status: NOT IMPLEMENTED

---

## 1. Planning Input / Repository Truth

This planning run has no local Git checkout. Therefore no git fetch was claimed or simulated. Repository truth was re-read directly from GitHub remote refs and file blobs.

Verified repository state at planning start:

| Item | Verified truth |
|---|---|
| Repository | pyxm1618/xiaoshuyin |
| origin/main | eaf2bb3adc2d9499a4ed84d0ca560c55209628f8 |
| Frozen Spec branch | spec/014-digital-use-phone-use-contract-runtime |
| Frozen Spec branch SHA | 3984a04b1b30b2beb96f146f65668bfb95ae05a3 |
| Frozen Spec commit | 3984a04b1b30b2beb96f146f65668bfb95ae05a3 |
| Frozen Spec blob | e21d5948b99fb96b6f28452304cc2afc1c61ba32 |
| Planning branch | plan/014-digital-use-phone-use-contract-runtime, created from the Frozen Spec commit |
| Frozen branch vs main | ahead 1 / behind 0; only spec.md differs |
| Open PR | #32 fix(slice8): caller-owned same-transaction command seam, head 441beaec6e2c7525a8a37c26063cd8e331b61eef, mergeable, unmerged |
| PR #32 scope | problem-formulations service + two architecture/integration tests; no Docs/Frozen Spec change |
| Slice 8 | runtime merged through PR #26; later same-transaction seam remediation PR #32 remains open |
| Slice 9 | runtime merged through PR #28 |
| Slice 10 | runtime merged through PR #30 |
| Slice 11 | runtime merged through PR #31; current main is its merge commit |
| Slice 12 Spec | 5e397fee86eb29da1acc1a5a1d176e0c73aa8849, blob e0ed342dc144fedf5b516b5295a23cbcc31722bc |
| Slice 12 Plan | plan branch head 496f8d33c7147fcb77848fa1acc8e990d75c2ab0; Plan/Checklist/Tasks/Audit 1 complete; no runtime PR |
| Slice 13 Spec | 07f3692b9f4e79b98a27a0c7f21913e0e6776b34, blob c3e9bf9aa9296e54c8faec0ec83cc15a2d75289b |
| Slice 13 Plan | plan branch head f2d13df2d12e7a75e09da4ebcf22fe6579e008a4; Plan/Checklist/Tasks/Audit 1 complete; no runtime PR |

Formal Docs re-read on current main:

| Authority | Blob |
|---|---|
| Docs/总产品需求.md | 67724000cb9bb81c40489c04db28d899bd1df74c |
| Docs/V1产品需求.md | 918d8574ad88773fe371985fd5c38080c944fec9 |
| Docs/总体技术架构.md | 9b08371edc976fa281469dfee8dc19962452e3b0 |
| Docs/V1技术设计.md | e7285fd8363c8a76ab4fd96a305037b5c675f961 |

### Drift classification

- SEMANTIC AUTHORITY DRIFT: NONE.
- DEPENDENCY EXECUTION DRIFT: PRESENT, NON-SEMANTIC. Slice 8 has an open same-transaction seam remediation PR and upstream implementation state has advanced since older Slice 12/13 planning snapshots.
- REPOSITORY / MECHANICAL DRIFT: NONE affecting the Frozen Spec. Current main remains the same main used by Slice 14 Plan AI 1; the Frozen Spec branch is exactly one spec commit ahead.

No condition exists that authorizes changing the Frozen Spec.

---

## 2. Authority Order

Implementation must preserve this order:

1. four formal Docs;
2. merged/frozen upstream owner contracts;
3. Slice 14 Frozen Spec;
4. this Plan;
5. checklist.md;
6. tasks.md;
7. implementation.

Lower artifacts may resolve physical implementation detail only. They may not alter product semantics.

Primary V1 anchors for this Slice are V1-D15–V1-D26 and V1-D35–V1-D42, plus the V1 technical design contracts for Digital Use structured artifacts, commands, API, confirmation provenance, versioning and Phase boundaries.

---

## 3. Goal / Scope

Deliver the minimum complete Phase 2 runtime for PHONE_USE_CONTRACT A4001–A4012, after the Implement Gate opens.

The implementation must provide:

- deterministic Scene integration for all twelve canonical nodes;
- the five-question preparation gate;
- versioned template, four examples and FAQ access;
- bounded A4003 SIMULATION persistence and adapter boundary;
- typed preparation/support artifacts for A4004–A4009;
- authoritative versioned phone-use Contract truth;
- genuine adult/child confirmation provenance;
- atomic A4010 activation;
- bounded A4011 static/support runtime without Phase 4 truth;
- A4012 new-version supersession;
- authorization, RLS, Consent, Compliance and Safety composition;
- idempotency, concurrency, correction and atomic rollback;
- truthful unavailable states for Phase 3/4/downstream capabilities;
- exact acceptance and governance evidence.

This Slice does not redesign A4001–A4012.

---

## 4. Explicit Non-Goals

Slice 14 does not implement:

- FAMILY_ALLIANCE A3000–A3113;
- A5001 or A5002;
- real model/provider execution;
- RAG;
- generic AI task framework;
- prompt-management platform;
- agent framework;
- persistent child persona or role memory;
- Goal;
- InterventionInstance;
- Plan / PlanVersion;
- Task;
- Checkin;
- Review;
- Outcome;
- Follow-up Schedule;
- pg-boss runtime;
- notification scheduling or delivery;
- generic Contract engine;
- generic workflow/forms/rules engine;
- XState;
- CQRS;
- event sourcing;
- microservice split;
- one-table-per-node;
- one-service-per-node;
- a second Manifest/router;
- a second Evidence, Consent, Safety, Compliance, Authorization, Idempotency, Audit or Scene-state owner.

---

## 5. Development-Start Implement Gate

Planning is complete now. Development is not authorized now.

T1401 is the only engineering task allowed to execute while this gate is blocked.

T1401 must re-read then-current remote truth and prove all of the following before any T1402+ work:

1. current origin/main is exact and recorded;
2. all four formal Docs are re-read/blob-compared;
3. Slice 14 Frozen Spec commit/blob is exact and unchanged;
4. Slice 8 runtime remains authoritative and its required same-transaction owner seam is merged/available;
5. Slice 9 Safety runtime remains merged/authoritative;
6. Slice 10 Compliance runtime remains merged/authoritative;
7. Slice 11 Manifest/routing runtime remains merged and the only node/routing truth;
8. Slice 12 has completed implementation, independent Audit 2 PASS and merge to main;
9. Slice 12 actual runtime exposes authoritative Scene State, Scene Artifact and legal A2010 solution-stage seams required by Slice 14;
10. Slice 12 generic Scene API/command/revision/transaction contracts are reconciled from code, not assumed from its plan;
11. current migration list and applied ordering are re-read; no migration number is preallocated by this Plan;
12. current shared RLS transaction, idempotency, audit/event and authorization seams are re-read;
13. existing Identity/Participant/Authorization owners can represent genuine child Contract confirmation for the exact Case/Contract action;
14. existing Consent owner can represent required processing consent independently from Contract confirmation;
15. current Compliance owner supports DIGITAL_USE_ROLEPLAY_A4003 and applicable obligation/capability semantics;
16. current Safety owner supports same-transaction ordinary-progression revalidation;
17. open PRs are re-read, including any replacement/superseding remediation for PR #32;
18. Slice 13 state is re-read only for mechanical migration/shared-seam collisions; Slice 13 runtime completion is not a business prerequisite;
19. no Phase 3 or Phase 4 capability is falsely assumed present;
20. no semantic authority drift exists.

Hard STOP conditions:

- Slice 12 not merged/Audit 2 PASS;
- required Scene State/Artifact/A2010 owner seam absent;
- genuine child confirmation cannot be represented without a new identity/consent owner;
- same-transaction composition cannot be achieved through authoritative owners;
- semantic authority drift would change Frozen Spec meaning;
- a migration/shared owner collision cannot be resolved without changing upstream semantics.

Current status:

IMPLEMENT GATE: BLOCKED.

Current exact blocker: Slice 12 Digital Use Assessment / Scene State / Artifact runtime has Plan/Audit 1 only; it is not implemented, independently Audit 2 passed or merged.

Slice 13 is not a hard runtime prerequisite.

---

## 6. Owner / Single-Source Inventory

| Concern | Authoritative owner | Slice 14 use | Forbidden duplication |
|---|---|---|---|
| Case / primary / phase | existing Common Core | read, lock, revalidate | no Slice 14 case state |
| Family | existing Family owner | scope and FK | no family shadow |
| Participant / Identity | existing owners | actor/party provenance | no child identity shadow |
| Problem Formulation / solution boundary | Slice 8 + Slice 12 A2010 integration | legal stream entry | no direct formulation SQL |
| Safety | Slice 9 | ordinary-progression guard + final revalidation | no safety boolean/state |
| Compliance | Slice 10 | server feature evaluation/capability | no local evaluator |
| Consent | existing Consent owner | current processing-consent validation | Contract confirmation is not Consent |
| Manifest / Routing | Slice 11 | canonical node/re-entry/allowed-next | no route table/numeric inference |
| Scene State | Slice 12 runtime | current node projection/revision | no contract-specific scene-state table |
| Scene Artifact | Slice 12 runtime | typed quiz/tool/support/document artifacts | no generic artifact platform |
| Evidence / provenance | existing Evidence owner | source refs only where factual | no evidence copy |
| Idempotency | existing owner | all mutation command families | no private store |
| Audit / Case Event | existing owner | append audit/event | no parallel audit ledger |
| Professional content/package | current Digital Use package/professional owner | versioned quiz/template/examples/FAQ | no second content owner |
| Phone-use Contract | Slice 14 | digital_use_contract_versions | no generic Contract engine |
| Roleplay SIMULATION | Slice 14 | roleplay_sessions/turns | never child fact/persona |
| Phase 3 AI | future Phase 3 owner | optional adapter capability only | no model/RAG framework |
| Phase 4 execution | future Phase 4 owner | truthful future boundary only | no Task/Checkin/Schedule/Notification |

If a required seam is absent, STOP for owner-approved narrow remediation. A local replacement truth is prohibited.

---

## 7. Planned Engineering Structure

Exact filenames must be reconciled in T1402 against then-current merged Slice 12 conventions. Responsibilities are fixed.

Expected bounded areas:

- db/migrations/<next>_digital_use_phone_use_contract_runtime.sql
- existing shared Drizzle schema projection for approved Slice 14 tables
- packages/scenes/digital-use for pure phone-contract schemas/builders/content refs, without topology duplication
- existing domain/application layer for Contract aggregate commands and roleplay bounded repository/service
- packages/contracts for request/response/OpenAPI schemas
- existing authorization package only if an owner-approved narrow action enum is required
- apps/server/api for V1-design-approved contract/roleplay routes plus reuse of Slice 12 Scene routes
- tests across domain/repository/DB/RLS/API/integration/concurrency/idempotency/fault/governance

Do not create an A400x directory architecture that mechanically maps one node to one service/table/controller.

---

## 8. Persistence Plan

### 8.1 digital_use_contract_versions

This is the sole authoritative family phone-use Contract aggregate.

Minimum planned fields after T1402 reconciliation:

- id UUID PK;
- family_id UUID;
- case_id UUID;
- version positive integer;
- draft_revision positive integer;
- status: DRAFT / PENDING_CONFIRMATION / ACTIVE / SUPERSEDED / PAUSED;
- adult_party_person_id;
- child_party_person_id;
- purpose typed value;
- phone_use_rules typed JSON/columns under a validated schema;
- execution_period typed value;
- parent_support_measures typed value;
- supervision_measures typed value;
- incentives typed value;
- breach_responsibilities typed value;
- source_template_version;
- dependency_refs typed ref array;
- parent_confirmation typed object/ref bound to actor + exact draft_revision + time;
- child_confirmation typed object/ref bound to the authenticated child actor + exact draft_revision + time;
- supersedes_id nullable self-reference;
- update_reason/update_trigger nullable for A4012;
- created_by_person_id;
- created_at;
- activated_at nullable;
- superseded_at nullable;
- paused_at nullable;
- lifecycle/audit metadata required by repository convention.

Database/domain invariants:

- UNIQUE(case_id, version);
- one current ACTIVE row per Case via a database-enforced partial unique rule;
- supersedes_id cannot point to self and must refer to the same Case in application/repository validation;
- material ACTIVE/SUPERSEDED content is immutable through production command paths;
- DRAFT/PENDING material edits use expected draft_revision CAS;
- confirmation is valid only when its confirmed_revision equals the current draft_revision;
- material edit never carries an old confirmation forward as current;
- initial A4010 activation cannot silently replace an existing ACTIVE contract outside the approved supersession command path;
- A4012 activation changes old ACTIVE → SUPERSEDED and new version → ACTIVE atomically;
- no DELETE/TRUNCATE in normal runtime.

The physical shape may use bounded typed JSON for complex section values. It must not become an untyped catch-all payload.

### 8.2 roleplay_sessions

Minimum:

- id;
- family_id / case_id;
- actor_person_id;
- status limited to bounded session lifecycle required by the interaction;
- provenance_kind fixed to SIMULATION;
- scene_package_version;
- professional_content_version;
- compliance_policy/version refs;
- prompt/model refs only when a real future adapter supplies them;
- revision;
- selected_turn_id nullable;
- created_at / completed_at.

No persistent child persona field exists.

If the production Phase 3 adapter is unavailable, capability check fails truthfully before a fake roleplay result is created. No canned production session may be marked complete.

### 8.3 roleplay_turns

Minimum:

- id;
- session_id;
- round_index;
- user_simulated_child_input;
- adapter_parent_output;
- output provenance/version refs;
- user_rating nullable;
- created_at.

Rules:

- every turn is SIMULATION;
- immutable after creation except a narrow rating field or append-only rating event per repository convention;
- no turn writes child Statement/Fact/Evidence/Consent;
- selected result is a session reference to a real turn, not copied into child truth;
- deterministic test adapter is test-only and cannot be configured as a production provider.

### 8.4 A4001 quiz persistence

No quiz-engine table.

Use the Slice 12 Scene Artifact owner with a typed artifact such as PHONE_USE_CONTRACT_QUIZ_ATTEMPT containing:

- exact five answers;
- wrong question ids;
- pass/fail result;
- quiz/content version;
- actor/source;
- attempt sequence/ref;
- created_at.

Scene node state owns current completion. Historical attempts remain append-only artifacts.

### 8.5 A4002 professional assets

No family persistence is created by GET/view.

Template, exactly four examples and their versions are read from the approved professional/package owner. Optional access/audit metadata uses existing audit, not a family Contract row.

### 8.6 A4004–A4009 preparation artifacts

Use typed Scene Artifacts for preparation/support outputs rather than one table per node:

- PHONE_USE_CONTRACT_TOOL_SELECTION;
- PHONE_USE_DURATION_COMPONENT;
- PHONE_USE_SUPERVISION_COMPONENT;
- PHONE_USE_SUPERVISION_LOG;
- PHONE_USE_INCENTIVE_COMPONENT;
- PHONE_USE_BREACH_COMPONENT;
- PARENT_SELF_REGULATION_CHECKLIST/DOCUMENT.

Each schema carries source refs, professional/content version, revision/supersedes metadata through the Scene Artifact owner.

Do not mirror the same current value into a second independent Contract truth. A4010 may reference/consume these artifacts when building the formal DRAFT.

### 8.7 Contract draft

No separate contract_drafts table.

The DRAFT/PENDING_CONFIRMATION row in digital_use_contract_versions is the Contract draft truth. Pre-A4010 tool artifacts are preparation inputs, not a second draft aggregate.

Draft corrections:

- expected draft_revision required;
- increment revision;
- current confirmations become non-current because they are revision-bound;
- audit/event records the change;
- ACTIVE history is never edited.

### 8.8 A4010 view document

Use a typed Scene Artifact projection containing:

- authoritative contract_version_id;
- rendering/schema version;
- source/content refs;
- generated-content metadata only if applicable.

The document cannot be edited to change the Contract.

### 8.9 A4011 support artifacts

Approved static FAQ remains professional content.

Permitted support/execution logs use typed Scene Artifact revisions. They never create Checkin/Task/Review/Outcome.

---

## 9. Node-by-Node Runtime Contract

| Node | Responsibility | Input contract | Output / artifact | State transition | Persistence owner | Entry condition | Completion condition | Re-entry / correction | Failure behavior | Downstream |
|---|---|---|---|---|---|---|---|---|---|---|
| A4001 | teach principles + five-question gate | exactly five answers, expected node/package revisions, idempotency | typed quiz-attempt artifact, wrong ids, approved explanations | current node completes only on all-correct attempt | Scene State + Scene Artifact owners | legal PHONE_USE_CONTRACT entry | all five correct in one valid current-version attempt | retry appends attempt; prior failures remain | invalid/incomplete/wrong => no completion; gates/drift fail closed | A4002 only after pass |
| A4002 | expose template + four examples | current asset/package version; explicit review acknowledgement for node response | template/examples refs; no family fact | completion records reviewed current asset version | professional owner + Scene State | A4001 completed and Manifest reachable | current approved template + all four examples successfully available/reviewed | stale asset requires refresh/review | stale/unapproved asset blocks completion | A4003 |
| A4003 | adult communication SIMULATION | adult/guardian actor, session revision, simulated child utterance, adapter capability | roleplay session/turns, ratings, selected turn; SIMULATION refs | select valid result completes node | roleplay tables + Scene State | A4002 complete, adult/guardian, gates pass, real adapter capability available | valid rounds exist and user explicitly selects preferred result under current refs | additional rounds allowed; selection revisioned | minor blocked; adapter absent => DOWNSTREAM_AI_UNAVAILABLE and node incomplete | A4004 only after legitimate completion |
| A4004 | tool catalog / re-entry hub | selected tool(s), expected node revision | tool-selection Scene artifact | catalog interaction does not imply all tools complete | Scene Artifact + Scene State | Manifest-approved route/re-entry | bounded catalog action recorded; no all-tools gate | freely re-enterable under current gates | fabricated tool code/unreachable entry rejected | approved A4005–A4009 entry only |
| A4005 | collaborative duration | family-entered proposal, true source refs, expected revision | typed duration component artifact | own node/component revision only | Scene Artifact | Manifest tool reachability | valid component saved | new artifact revision; no history delete | stale revision/source mismatch/gates fail | available back to A4004/A4010 per Manifest; does not force A4006 |
| A4006 | supervision measures + permitted log | selected/proposed measures; source refs; optional Scene-level log | supervision component + typed log artifact | own revision only | Scene Artifact | Manifest reachability | valid component/log saved as applicable | append/supersede artifact | no Checkin creation; stale/gate fail | approved re-entry/A4010 |
| A4007 | incentive plan | actual family incentive content + source refs | incentive component artifact | own revision | Scene Artifact | Manifest reachability | valid family result saved | append/supersede | example cannot auto-copy; stale/gates fail | approved re-entry/A4010 |
| A4008 | breach responsibility | actual family term + source refs | breach component artifact | own revision | Scene Artifact | Manifest reachability | valid family result saved | append/supersede | unapproved/high-risk/fabricated term fails policy; stale/gates fail | approved re-entry/A4010 |
| A4009 | parent self-regulation | parent commitments/method selections | typed checklist/document artifact | own revision | Scene Artifact | Manifest reachability | approved artifact saved | append/supersede | never Task/Memory; stale/gates fail | approved re-entry/A4010 |
| A4010 | create/confirm/activate formal Contract | validated eight-section draft, template/dependency refs, real party confirmations, revisions | digital_use_contract_versions ACTIVE row + view document | DRAFT/PENDING → ACTIVE exactly once; Scene node completes atomically | Slice 14 Contract + Scene owners | Manifest reachable; final draft valid; no hidden all-tools gate | exact current revision has required genuine confirmations and all gates pass | draft revision before activation; material ACTIVE change prohibited | missing/invalid confirmation stays DRAFT/PENDING; atomic rollback on fault | A4011 available only after ACTIVE |
| A4011 | static FAQ + bounded execution support | current ACTIVE contract id/version, support request, expected revisions | FAQ content refs; typed Scene support/log artifact | no Phase 4 lifecycle state | professional + Scene Artifact | relevant current Contract and gates | each support action truthfully completed; node semantics do not create Review | user re-enters; terms never silently changed | AI/follow-up unavailable is truthful; Safety blocks ordinary support | approved tool re-entry or A4012 trigger |
| A4012 | create new version and supersede | current ACTIVE id/version, approved trigger/reason, revised draft, fresh confirmations | new contract version + new document | old ACTIVE stays ACTIVE while draft pending; on valid activation old → SUPERSEDED/new → ACTIVE atomically | Slice 14 Contract + Scene owners | current ACTIVE + legal trigger + Manifest entry | new version current-revision confirmed by real parties and all gates pass | new draft revisions allowed; never revive superseded old version | stale/concurrent/fault => old ACTIVE preserved, no partial new ACTIVE | updated A4011 support; A5002 remains downstream unavailable |

No numeric adjacency in this table is routing authority. Slice 11 Manifest/routing remains authoritative.

---

## 10. Professional Content / Asset Contract

A4001 quiz, A4002 template, four examples and A4011 FAQ are versioned professional/package assets.

Requirements:

- current approved asset version is server-resolved;
- asset refs are server-owned;
- all four examples remain complete;
- example selection/view never writes family Contract truth;
- family values arise only from explicit family input with real provenance;
- stale/retired package/content version cannot silently write a current draft;
- historical Contract retains source_template_version;
- content change creates a new content/package version, not a silent mutation;
- no general RAG/knowledge platform is created by Slice 14.

A4001 answer key remains exactly TRUE, FALSE, FALSE, FALSE, FALSE under the Frozen authority.

---

## 11. A4003 Phase 2 Adapter Boundary

Define only a narrow interface owned by the PHONE_USE_CONTRACT integration layer, conceptually:

~~~text
RoleplayCapability
- isAvailable(current feature/compliance/package context)

RoleplayAdapter
- create/continue one bounded simulated-parent turn
- input: authorized adult actor, SIMULATION session, simulated-child user text, current revision/version refs
- output: typed simulated-parent result + provenance/version refs
~~~

Production Phase 2 default before real Phase 3 exists:

- capability unavailable;
- no model call;
- no canned response pretending to be model output;
- no node completion.

Future Phase 3 may supply an approved adapter. Slice 14 does not know provider SDK, RAG, agent, long-term memory or prompt platform internals.

Every roleplay response remains labeled SIMULATION and cannot satisfy child confirmation.

---

## 12. Contract Lifecycle / Versioning

### 12.1 Initial A4010

1. create DRAFT version under aggregate lock;
2. validate current template and eight structural categories;
3. bind source_template_version and dependency_refs;
4. allow explicit N/A/optional values where approved without deleting section identity;
5. collect adult and child confirmations independently, server-attributed to authenticated actors;
6. each confirmation binds to exact draft_revision;
7. when all current-revision confirmations and gates are valid, confirm command performs one atomic activation;
8. ACTIVE is immutable in material meaning;
9. generated/view document is only a projection.

### 12.2 Confirmation provenance

Server derives party role from authoritative Contract parties + authenticated Person + Authorization. Client cannot submit an authoritative role switch.

Adult confirmation minimum provenance:

- confirmer_person_id;
- authenticated actor/session reference according to existing owner convention;
- confirmed contract id/version/draft_revision;
- confirmed_at.

Child confirmation minimum provenance:

- authenticated child Person equals the relevant Contract child party;
- existing Identity/Participant/Authorization owner proves the exact action;
- current applicable Consent/Compliance is valid;
- exact contract id/version/draft_revision;
- confirmed_at;
- no parent proxy;
- no AI/simulation source;
- no identity-binding/guardian-consent substitution.

If this cannot be represented through existing owners, STOP.

### 12.3 Draft edit after confirmation

A material edit increments draft_revision. Confirmations for older revisions remain historical/auditable but are not valid for activation. The parties must confirm the new revision.

### 12.4 A4012

1. lock/re-read exact current ACTIVE;
2. validate approved trigger;
3. create new DRAFT with new formal version and supersedes_id;
4. copy prior terms as starting draft, preserving explicit update_reason;
5. revised draft has its own draft_revision;
6. both current parties re-confirm;
7. final transaction marks new ACTIVE and old SUPERSEDED;
8. partial old/new state is impossible;
9. history and supersedes chain remain readable/auditable.

No material UPDATE of ACTIVE terms.

### 12.5 PAUSED

The approved status vocabulary is preserved. Slice 14 must not invent a new pause workflow or endpoint merely because PAUSED exists. If the then-current authoritative Manifest/owner exposes an approved pause transition, reuse it; otherwise the status remains reserved by the approved schema and no speculative behavior is added.

---

## 13. API / Command Boundary

### 13.1 Reuse Slice 12 Scene surface

After T1401 proves the actual merged Slice 12 surface, reuse its generic node projection/response contract for ordinary node semantics, expected to include:

- GET /api/v1/cases/:id/scene
- GET /api/v1/cases/:id/scene/nodes/:nodeCode
- POST /api/v1/cases/:id/scene/nodes/:nodeCode/responses

Ordinary A4001, A4002 acknowledgement, A4004–A4009 and bounded A4011 Scene actions use the generic Scene command seam where the merged contract supports them.

Client nextNode is never authoritative.

### 13.2 Explicit V1 technical-design Contract routes

Plan preserves the approved API surface:

~~~text
GET  /api/v1/cases/:id/digital-use/contract/template
GET  /api/v1/cases/:id/digital-use/contract/examples
GET  /api/v1/cases/:id/digital-use/contract/current
POST /api/v1/cases/:id/digital-use/contract/drafts
PATCH /api/v1/cases/:id/digital-use/contract/drafts/:version
POST /api/v1/cases/:id/digital-use/contract/:version/confirm
POST /api/v1/cases/:id/digital-use/contract/:version/revise
GET  /api/v1/cases/:id/digital-use/contract/faq
~~~

No extra activate endpoint is required. ConfirmContractVersion records the current actor's confirmation and may activate atomically when all current-revision required confirmations/gates are satisfied.

The revise endpoint creates an A4012 DRAFT/new version; it never edits ACTIVE terms in place.

### 13.3 Explicit roleplay routes

~~~text
POST /api/v1/cases/:id/digital-use/roleplays
POST /api/v1/cases/:id/digital-use/roleplays/:sessionId/turns
POST /api/v1/cases/:id/digital-use/roleplays/:sessionId/rate
POST /api/v1/cases/:id/digital-use/roleplays/:sessionId/select
~~~

Every route is adult/guardian-only server-side.

### 13.4 Explicit command families

Reuse the V1 technical-design command vocabulary:

- SaveContractDraft;
- ConfirmContractVersion;
- SupersedeContractVersion;
- SaveRoleplayResult;
- generic RecordSceneNodeResponse for ordinary Scene node input.

Physical class/function names reconcile with the current code. Semantics do not.

High-impact business truth uses explicit commands; do not hide activation/supersession inside an arbitrary generic JSON handler.

### 13.5 Error classes

Map to current repository error conventions while preserving at least:

- NOT_FOUND_OR_UNAUTHORIZED_SCOPE;
- INVALID_NODE_OR_NONCANONICAL_NODE;
- ILLEGAL_DIRECT_ENTRY;
- INVALID_PAYLOAD;
- QUIZ_NOT_PASSED;
- MISSING_REQUIRED_CONFIRMATION;
- INVALID_CONFIRMATION_SOURCE;
- SAFETY_BLOCKED;
- COMPLIANCE_BLOCKED;
- CONSENT_BLOCKED;
- STALE_REVISION;
- IDEMPOTENCY_MISMATCH;
- PACKAGE_OR_MANIFEST_DRIFT;
- DEPENDENCY_OWNER_UNAVAILABLE;
- DOWNSTREAM_AI_UNAVAILABLE;
- DOWNSTREAM_FOLLOWUP_UNAVAILABLE;
- DOWNSTREAM_REVIEW_UNAVAILABLE;
- infrastructure/atomic-operation failure.

Anti-enumeration behavior follows existing owners.

---

## 14. Transaction / Gate Composition

All mutations use one authoritative same-client RLS transaction. No nested transaction and no second checked-out client for business effects.

Minimum orchestration:

1. authenticate;
2. resolve real actor / Family / Case and authorize requested action;
3. establish RLS context;
4. acquire shared idempotency identity only after anti-enumeration-safe scope establishment;
5. lock/re-read current Case/primary and relevant Scene/Contract aggregate;
6. verify expected Case/package/Manifest/node/Contract revisions;
7. validate applicable Consent through owner;
8. run authoritative Safety ordinary-progression guard;
9. evaluate Compliance/capability through owner;
10. validate Manifest reachability and node/business preconditions;
11. execute bounded business write;
12. run pure authoritative routing where needed;
13. write Scene state/artifact and Contract/roleplay changes;
14. write audit/event;
15. revalidate mutable owner versions needed to close races: primary Case, Consent, Safety, Compliance, package/Manifest and aggregate revision;
16. settle shared idempotency result;
17. commit.

If merged Slice 12 establishes a stricter authoritative composition order, use it. The invariant is independent non-bypassable gates plus final race-closing revalidation.

No Authorization ALLOW result may override Consent, Safety or Compliance denial.

---

## 15. Idempotency

Shared owner only.

Mutation families:

- A4001 quiz submit;
- generic node response/tool save;
- Contract draft create;
- Contract draft update;
- Contract confirm;
- Contract revise/A4012 draft create;
- roleplay session create;
- roleplay turn;
- rating;
- selection;
- A4011 support artifact writes.

Canonical behavior:

- same actor + command identity + key + canonical payload => original stable result;
- same key + different canonical payload => conflict;
- concurrent same-key => one business execution;
- failed transaction => no completed idempotency result;
- replay => no duplicate artifact, roleplay turn, Contract version, confirmation, Scene completion, audit or event;
- replay does not grant new unrelated authorization.

Request fingerprint contains request semantics and expected revision tokens, not mutable server facts that would make exact retry impossible.

---

## 16. Concurrency

Mandatory protections:

| Race | Required result |
|---|---|
| same A4001 key | one attempt/business result; replay for duplicate |
| same node/component revision | CAS; one incompatible writer wins |
| A4005–A4009 independent tools | legal independent writes may coexist; no global wizard lock |
| draft edit vs edit | one current draft_revision; stale writer conflicts |
| adult confirm vs child confirm | both can land without lost update; activation sees both only if same current draft_revision |
| confirm vs material edit | old-revision confirmation cannot activate edited draft |
| two initial activations | partial unique ACTIVE + aggregate lock => at most one current ACTIVE |
| two A4012 drafts | both drafts may exist only if product/aggregate rules allow, but only one can supersede the exact current ACTIVE into current ACTIVE; stale branch cannot win later |
| two A4012 activations | one supersession winner; other stale/conflict |
| primary switch | final Case revalidation blocks stale success |
| Safety Hold race | committed hold/version change wins over ordinary progression |
| Consent revocation | stale consent success forbidden |
| Compliance policy change | stale policy/capability success forbidden |
| package/Manifest/content drift | stale write/activation forbidden |
| child source invalidation | activation/support cannot retain false current confirmation authority |

No last-write-wins for formal Contract truth.

---

## 17. Atomicity / Fault Injection

### A4001 pass transaction

Atomic unit:

- quiz attempt artifact;
- wrong-item refs;
- Scene completion only if all correct;
- audit/event;
- idempotency completion.

### A4004–A4009 save transaction

Atomic unit:

- source/provenance validation;
- typed artifact revision;
- Scene node output/revision as applicable;
- audit/event;
- idempotency.

### A4003 selection/completion transaction

Atomic unit:

- valid selected roleplay turn;
- rating/selection current revision;
- selected result reference;
- Scene A4003 completion/output;
- audit/event;
- idempotency.

No child Evidence write is part of this transaction.

### A4010 confirm/activation transaction

Atomic unit:

- current actor confirmation for exact draft_revision;
- when activation conditions become satisfied: one ACTIVE version;
- any allowed lifecycle change;
- A4010 Scene completion/output;
- A4011 availability projection;
- A4010 document artifact reference;
- audit/event;
- idempotency.

### A4012 activation transaction

Atomic unit:

- exact old ACTIVE lock/recheck;
- new current-revision confirmations;
- new ACTIVE;
- old SUPERSEDED;
- A4012 Scene output/current projection;
- new document artifact;
- audit/event;
- idempotency.

Mandatory injected failure points include after every business-effect class and immediately before idempotency completion. Every failure must leave no partial success truth.

---

## 18. Correction / Supersession / Drift

- A4001 retry appends attempt; no old-attempt rewrite.
- A4004–A4009 correction creates a new Scene artifact revision/supersedes link under the owner contract.
- Contract DRAFT correction increments draft_revision; stale edit conflicts; confirmation validity remains revision-bound.
- ACTIVE material correction is not an edit: A4012 new version required.
- SUPERSEDED history is immutable.
- source/Evidence correction uses existing Evidence/dependency invalidation owner; historical Contract remains.
- child confirmation/source correction or invalidation blocks future reliance and invokes existing dependency review/invalidation semantics; it does not silently relabel the parent as child.
- professional asset correction creates a new version; historical Contract keeps old source_template_version.
- package/Manifest drift fails stale operation.
- roleplay selected result correction changes only current simulation selection/revision; it cannot mutate child facts because none exist.
- Consent revocation blocks affected future processing while lawful historical Contract truth remains.
- Safety/Compliance changes block current progression without rewriting history.

---

## 19. A4011 / Phase 4 Boundary

Allowed in Slice 14:

- static approved FAQ;
- current Contract context;
- user-initiated support re-entry;
- routing to approved A4004–A4009 tools;
- typed Scene-level execution/support artifact;
- truthful personalized-AI unavailable state;
- truthful follow-up/reminder unavailable state.

Forbidden:

- Task;
- Checkin;
- Review;
- Outcome;
- Follow-up Schedule;
- pg-boss;
- notification request/dispatch/SENT/DELIVERED;
- fake reminder;
- private cron/scheduler;
- auto-created A5002.

The Contract remains valid even when Phase 4 is unavailable. User-initiated return remains possible.

---

## 20. Migration / Database Plan

No migration is written during planning.

T1401/T1402 must re-read the exact then-current migration list. The development migration receives the next safe repository order at that time. No number is reserved now.

Migration rules:

- additive / forward-only;
- historical migrations immutable;
- create only approved new Slice 14 tables and minimum enum/check/index/grant changes;
- clean bootstrap from empty DB;
- upgrade from exact then-current main;
- second apply/repeat behavior according to repository migration framework;
- ENABLE RLS + FORCE RLS where Family data is stored;
- runtime role remains NOBYPASSRLS and non-owner;
- least-privilege SELECT/INSERT/narrow UPDATE;
- no normal DELETE/TRUNCATE/public grants;
- FK to authoritative Case/Family/Person identities;
- UNIQUE(case_id, version);
- partial unique current ACTIVE Contract;
- roleplay session/turn ownership and same-Case integrity;
- indexes for current Contract, supersedes lookup, roleplay session order and authorized projections;
- constraint/check coverage for version/revision/status/provenance shape;
- source/provenance integrity validated in domain/repository where DB cannot express cross-owner semantics;
- rollback of a failed migration leaves no half-installed schema;
- later application rollback preserves historical data and uses forward remediation rather than destructive table drops.

---

## 21. RLS / Authorization Matrix

Database RLS is a hard Family isolation boundary. Application Authorization remains the stronger business permission.

Required negative coverage:

- no auth context;
- wrong Family;
- wrong Case;
- wrong participant;
- participant without mutation authority;
- wrong/current-primary mismatch;
- wrong Contract party;
- parent attempting child confirmation;
- minor attempting A4003;
- cross-Case artifact/Evidence/Contract ref;
- cross-Family roleplay session/turn;
- stale/revoked participation where relevant;
- purpose mismatch;
- enumeration-safe unauthorized/not-found response.

No UI hiding is security.

---

## 22. Observability / Audit

Use existing business audit/case event owners.

Record safe metadata as applicable:

- Family / Case;
- authenticated actor;
- node/source node;
- contract id/version/draft_revision/status transition;
- roleplay session/turn ids and SIMULATION marker, not private text in operational logs;
- professional/package/content versions;
- source/dependency refs;
- confirmation actor IDs and exact revision;
- old/new active version IDs;
- supersedes relation;
- route reason/entry mode;
- idempotency outcome;
- gate decision/version refs;
- artifact ids/revisions;
- blocked/unavailable classification.

Do not log raw family narratives, quiz answers, roleplay text, private Contract content or child data into ordinary infrastructure logs merely for debugging.

---

## 23. Testing / Verification Strategy

Future implementation must include:

- unit;
- domain;
- repository;
- database constraints;
- migration upgrade;
- migration fresh bootstrap;
- RLS;
- authorization;
- Consent;
- Compliance;
- Safety;
- service/application;
- API contract;
- OpenAPI generation/client drift;
- Scene/Manifest integration;
- routing integration;
- idempotency;
- concurrency;
- fault injection/atomicity;
- provenance/security-negative;
- professional asset/version drift;
- correction/supersession;
- downstream-unavailable;
- full repository regression;
- governance/static scope guard;
- exact-head CI.

All A4001–A4012 nodes require node-level evidence; one happy-path E2E is insufficient.

A deterministic full Phase 2 fixture must execute without a real model/network decision service. A4003 uses a controlled test-only adapter for its positive fixture; a production-unavailable fixture proves no false completion.

---

## 24. Negative-Space Architecture Guard

Future static/diff/governance evidence must fail if Slice 14 introduces:

- second Manifest or node registry;
- second router or API-local topology;
- numeric next-node inference;
- client nextNode authority;
- private Consent ledger;
- private Compliance evaluator;
- private Safety state;
- private Evidence truth;
- private Scene state;
- private idempotency/audit store;
- parent-manufactured child confirmation;
- AI/simulation-manufactured child confirmation;
- roleplay output as child Evidence/Statement/Fact;
- persistent child persona;
- canned production roleplay pretending real AI;
- real AI/RAG/agent framework;
- generic Contract engine;
- generic workflow/forms/rules engine;
- giant untyped A4004–A4009 blob;
- one table/service/controller per node;
- Goal/Plan/Task/Checkin/Review/Outcome;
- Follow-up/pg-boss/Notification runtime;
- fake reminder/SENT;
- A5001/A5002 runtime;
- in-place ACTIVE Contract material update;
- loss of superseded history;
- two current ACTIVE contracts;
- Slice 13 as business prerequisite;
- upstream Docs/Slice 1–13 semantic edits;
- XState;
- CQRS;
- event sourcing;
- microservice split.

---

## 25. Implementation Order

1. T1401 — Development-start Authority / Implement Gate.
2. T1402 — Reconcile merged owner seams, API and transaction contracts.
3. T1403 — Additive Contract/Roleplay persistence, migration and RLS.
4. T1404 — Shared typed schemas, refs, provenance and error vocabulary.
5. T1405 — Professional content/version binding.
6. T1406 — PHONE_USE_CONTRACT Scene orchestration integration.
7. T1407 — A4001 preparation quiz.
8. T1408 — A4002 template/four examples.
9. T1409 — A4003 roleplay domain/persistence/adapter boundary.
10. T1410 — A4003 approved roleplay API surface and truthful unavailable behavior.
11. T1411 — A4004 catalog/re-entry.
12. T1412 — A4005 duration component.
13. T1413 — A4006 supervision/log.
14. T1414 — A4007 incentive component.
15. T1415 — A4008 breach-responsibility component.
16. T1416 — A4009 parent self-regulation artifact.
17. T1417 — Contract DRAFT aggregate and SaveContractDraft.
18. T1418 — Genuine party confirmation provenance.
19. T1419 — A4010 atomic activation/document/A4011 entry.
20. T1420 — A4011 FAQ/static support/re-entry.
21. T1421 — A4012 new-version/supersession.
22. T1422 — Public Contract API/OpenAPI + Scene projection integration.
23. T1423 — Authorization/RLS/Consent/Compliance/Safety hardening.
24. T1424 — Idempotency/concurrency/atomicity/fault hardening.
25. T1425 — Correction/drift/downstream-unavailable hardening.
26. T1426 — Full acceptance/governance/exact-head convergence and Audit 2 handoff.

Only T1401 may run before Implement Gate PASS. T1402–T1426 require T1401 PASS.

---

## 26. Functional Requirement Traceability

| FR | Plan coverage | Checklist | Task owner | Future evidence |
|---|---|---|---|---|
| FR-001 | §§1–2 | A | T1401,T1426 | authority/blob/diff |
| FR-002 | §§6,9,13,24 | A,C,S,Z | T1406,T1422,T1426 | manifest/routing integration |
| FR-003 | §§5,9,24 | B,Z | T1401,T1406,T1426 | parallel sibling fixture |
| FR-004 | §§8.4,9 | D | T1407 | quiz domain/integration |
| FR-005 | §§8.4,17 | D,W | T1407 | attempt history |
| FR-006 | §§8.5,10 | E | T1405,T1408 | asset isolation/version |
| FR-007 | §§8.1,9,12 | H,K | T1417,T1419 | contract schema |
| FR-008 | §§9,11,21 | F,M | T1409,T1410,T1423 | minor denial |
| FR-009 | §§8.2–8.3,11 | F,L,X | T1409,T1410,T1426 | provenance/static |
| FR-010 | §11 | X | T1409,T1410,T1426 | adapter/no-AI guard |
| FR-011 | §§9,13 | G,S | T1411 | re-entry/no-chain |
| FR-012 | §§8.6,9 | G,Q | T1412 | duration provenance |
| FR-013 | §§8.6,9,19 | G,I,Y | T1413 | no Checkin |
| FR-014 | §§8.6,9 | G,Q | T1414 | example/family separation |
| FR-015 | §§8.6,9 | G,Q | T1415 | example/family separation |
| FR-016 | §§8.6,9 | G,R,Y | T1416 | artifact/no Task/Memory |
| FR-017 | §§8,24 | C,G,Z | T1403,T1426 | schema/static guard |
| FR-018 | §§8.1,12.2,21 | H,L,M | T1418,T1419,T1423 | confirmation-source negatives |
| FR-019 | §§8.1,12 | H,K | T1403,T1417 | DB/domain |
| FR-020 | §§8.1,12,16 | H,K,U | T1403,T1419,T1424 | partial unique/concurrency |
| FR-021 | §§14,17 | H,V | T1419,T1424 | fault injection |
| FR-022 | §§10,19 | I | T1405,T1420 | FAQ completeness |
| FR-023 | §§9,19,24 | I,Y,Z | T1420,T1426 | static/scope-negative |
| FR-024 | §§11,19 | I,X | T1420,T1425 | AI unavailable |
| FR-025 | §§12.4,18 | J,K,W | T1421 | no in-place update |
| FR-026 | §§8.1,12.4,18 | J,K,W | T1421 | supersedes/history |
| FR-027 | §§12.2,12.4 | J,L | T1418,T1421 | re-confirmation |
| FR-028 | §§6,14,21 | M,AB | T1423 | auth/RLS negatives |
| FR-029 | §§6,14 | N,L | T1423 | consent separation |
| FR-030 | §§6,14 | O,X | T1423 | compliance fail-closed |
| FR-031 | §§6,14,17 | P | T1423,T1424 | Safety block/race |
| FR-032 | §§8–12,18 | Q,L | T1404,T1412-T1418 | provenance |
| FR-033 | §15 | T | T1424 | replay/mismatch/concurrent key |
| FR-034 | §16 | U | T1424 | stale revision races |
| FR-035 | §17 | V | T1424 | rollback injection |
| FR-036 | §18 | W | T1425 | correction/dependency invalidation |
| FR-037 | §§11,19 | X,Y | T1425 | truthful unavailable |
| FR-038 | §§6,24 | C,Z | T1402,T1426 | static/diff owner guard |
| FR-039 | §§1–2,24 | A,Z,AD | T1401,T1426 | exact changed-file review |
| FR-040 | §§11,23 | X,AC | T1409,T1426 | deterministic no-network fixture |

No FR is without a task, checklist owner or future evidence class.

---

## 27. Acceptance Traceability

Acceptance IDs AS-01..AS-80 correspond exactly to Frozen Spec scenarios 1..80.

| AS | Scenario shorthand | Primary task(s) | Future evidence |
|---|---|---|---|
| AS-01 | legal A4001 entry | T1406,T1423 | integration |
| AS-02 | illegal direct A4002/A4010 | T1406,T1422,T1423 | security/integration |
| AS-03 | FAMILY_ALLIANCE absent/in progress | T1406,T1426 | parallel integration |
| AS-04 | contract non-adoption no fake child agreement | T1418,T1426 | integration/provenance |
| AS-05 | all five correct | T1407 | domain/integration |
| AS-06 | wrong answer history/explanation | T1407 | artifact/domain |
| AS-07 | read-only not pass | T1407 | integration |
| AS-08 | retry preserves wrong history | T1407 | integration |
| AS-09 | template current structure | T1405,T1408 | contract/asset |
| AS-10 | four examples | T1405,T1408 | asset |
| AS-11 | example isolation | T1408,T1426 | integration/static |
| AS-12 | asset drift | T1405,T1424,T1425 | stale/version |
| AS-13 | eligible adult roleplay | T1409,T1410 | integration |
| AS-14 | minor denied | T1410,T1423 | compliance/security |
| AS-15 | no child fact from roleplay | T1409,T1426 | provenance/static |
| AS-16 | no child confirmation from roleplay | T1409,T1418,T1426 | provenance |
| AS-17 | no persona memory | T1409,T1426 | static |
| AS-18 | real AI unavailable | T1410,T1425 | unavailable |
| AS-19 | deterministic roleplay fixture | T1409,T1426 | deterministic integration |
| AS-20 | A4004 re-entry | T1411,T1423 | integration |
| AS-21 | no numeric tool chain | T1411,T1426 | routing/static |
| AS-22 | A4005 save/revision | T1412,T1424 | integration/concurrency |
| AS-23 | A4005 provenance | T1412,T1418 | provenance |
| AS-24 | A4006 log no Checkin | T1413,T1426 | integration/scope-negative |
| AS-25 | A4007 separate family result | T1414 | integration |
| AS-26 | A4008 separate family result | T1415 | integration |
| AS-27 | A4009 Scene artifact | T1416,T1426 | artifact/scope-negative |
| AS-28 | partial tool use no all-tools gate | T1411-T1419,T1426 | integration |
| AS-29 | valid A4010 activation | T1417-T1419,T1423,T1424 | integration/DB |
| AS-30 | missing adult confirmation | T1418,T1419 | domain |
| AS-31 | missing child confirmation | T1418,T1419 | domain |
| AS-32 | parent false child confirmation blocked | T1418,T1423 | security |
| AS-33 | AI confirmation blocked | T1409,T1418 | provenance |
| AS-34 | wrong child/wrong Case blocked | T1418,T1423 | authorization |
| AS-35 | optional/N/A sections preserved | T1417,T1419 | contract/schema |
| AS-36 | duplicate activation replay | T1419,T1424 | idempotency |
| AS-37 | concurrent activation | T1419,T1424 | concurrency/DB |
| AS-38 | stale draft | T1417,T1424 | concurrency |
| AS-39 | activation fault rollback | T1419,T1424 | fault injection |
| AS-40 | document is projection | T1419,T1426 | artifact/integration |
| AS-41 | static FAQ | T1405,T1420 | asset/API |
| AS-42 | support re-entry | T1420,T1423 | integration |
| AS-43 | AI support unavailable | T1420,T1425 | unavailable |
| AS-44 | support routes to tool without rewriting terms | T1420,T1406 | routing/integration |
| AS-45 | no Checkin leakage | T1420,T1426 | scope-negative |
| AS-46 | no reminder fabrication | T1420,T1425,T1426 | scope-negative |
| AS-47 | Safety blocks support | T1420,T1423,T1424 | Safety race |
| AS-48 | period-complete new draft | T1421 | integration |
| AS-49 | new-problem new draft | T1421 | integration |
| AS-50 | pending revision leaves old ACTIVE | T1421,T1424 | lifecycle |
| AS-51 | valid supersede atomic | T1421,T1424 | DB/integration |
| AS-52 | history preserved | T1421,T1425 | repository |
| AS-53 | no in-place ACTIVE update | T1421,T1426 | domain/static |
| AS-54 | concurrent supersede | T1421,T1424 | concurrency |
| AS-55 | stale supersede | T1421,T1424 | concurrency |
| AS-56 | supersede fault rollback | T1421,T1424 | fault injection |
| AS-57 | no private scheduler | T1421,T1425,T1426 | scope-negative |
| AS-58 | unauthorized actor | T1423 | authorization |
| AS-59 | cross-family | T1423 | RLS/integration |
| AS-60 | Consent revoked before commit | T1423,T1424 | concurrency |
| AS-61 | Consent revoked after active | T1425 | dependency invalidation |
| AS-62 | Compliance blocked/unresolved | T1423 | compliance |
| AS-63 | Safety blocked | T1423 | Safety |
| AS-64 | Safety race | T1424 | concurrency |
| AS-65 | owner unavailable fail closed | T1401,T1402,T1425 | dependency |
| AS-66 | idempotent replay | T1424 | idempotency |
| AS-67 | idempotency mismatch | T1424 | idempotency |
| AS-68 | concurrent draft update | T1424 | concurrency |
| AS-69 | primary switch race | T1424 | concurrency |
| AS-70 | package/Manifest drift | T1424,T1425 | stale/version |
| AS-71 | professional asset drift | T1405,T1425 | version |
| AS-72 | Evidence correction | T1425 | dependency/correction |
| AS-73 | child-source correction/conflict | T1418,T1425 | provenance/dependency |
| AS-74 | A5002 unavailable | T1425,T1426 | downstream unavailable |
| AS-75 | no second Manifest/router | T1426 | diff/static |
| AS-76 | no generic contract/workflow/forms/rules engine | T1426 | diff/static |
| AS-77 | no Phase 4 owners | T1426 | diff/static |
| AS-78 | no Follow-up/pg-boss/Notification runtime | T1426 | diff/static |
| AS-79 | no real AI/RAG/Agent platform | T1426 | diff/static |
| AS-80 | no Docs/Slice 1–13 semantic mutation | T1426 | exact-head diff |

80/80 Frozen acceptance scenarios have a task and future verification owner.

---

## 28. Negative-Space Traceability

Every Frozen Spec §31 prohibition is covered by checklist section Z and T1426. High-risk prohibitions additionally have direct task evidence:

- fake child confirmation: T1418/T1423;
- simulation as child truth: T1409/T1418;
- real-AI masquerade: T1410/T1425;
- giant blob/table-per-node: T1403/T1426;
- Phase 4 leakage: T1420/T1426;
- in-place ACTIVE update: T1421/T1426;
- two ACTIVE versions: T1403/T1424;
- control-plane bypass/duplication: T1402/T1423/T1426;
- upstream semantic mutation: T1401/T1426.

---

## 29. Pre-Development Audit 1

Audit object:

Frozen Spec ↔ Plan ↔ checklist.md ↔ tasks.md ↔ FR/Acceptance/Negative-Space ↔ future verification.

Audit checks:

- Frozen Spec exactness: PASS.
- Authority order: PASS.
- Repository truth/drift classification: PASS.
- Scope: PASS.
- Slice 12 hard dependency: PASS.
- Slice 13 non-prerequisite rule: PASS.
- Owner inventory / no duplicate truth: PASS.
- A4001: PASS.
- A4002: PASS.
- A4003 Phase 2/3 boundary: PASS.
- A4004–A4009 distinct responsibilities: PASS.
- A4010 Contract truth / genuine confirmation: PASS.
- A4011 Phase 4 boundary: PASS.
- A4012 supersession/history: PASS.
- Persistence minimization: PASS.
- API / command boundary: PASS.
- Authorization / Consent / Compliance / Safety independence: PASS.
- Idempotency: PASS.
- Concurrency: PASS.
- Atomicity: PASS.
- Correction / drift: PASS.
- Migration/RLS strategy: PASS.
- Negative space: PASS.
- FR-001–FR-040 mapping: PASS.
- AS-01–AS-80 mapping: PASS.
- Every task has Frozen authority and evidence ownership: PASS.
- Open Product Decisions: 0.
- Open Planning Decisions: 0.
- Scope Drift: 0.

Findings found during planning and resolved before freeze:

1. A4001 attempts need history but do not justify a Quiz Engine/table. Resolved to typed Scene Artifact + Scene state completion.
2. A4005–A4009 need structured data but not one table per node or giant blob. Resolved to bounded typed Scene Artifacts feeding the formal Contract aggregate.
3. A Contract draft must not become a second table. Resolved to DRAFT/PENDING rows in digital_use_contract_versions.
4. A4003 real AI is Phase 3. Resolved to a narrow adapter capability with truthful production unavailable semantics; deterministic fake is test-only.
5. Confirmation concurrency could otherwise lose one party or survive a material edit. Resolved by revision-bound confirmation provenance plus CAS/aggregate locking.
6. The V1 technical design exposes dedicated Contract/Roleplay routes while Slice 12 provides generic Scene routes. Resolved by using dedicated routes only for formal Contract/roleplay operations and the generic Scene route for ordinary node submissions; no duplicate Scene runtime.
7. A4011 historical reminder language could tempt Phase 4 leakage. Resolved to static/support Scene semantics + truthful follow-up unavailable.
8. PR #32 is an execution dependency remediation, not Frozen Spec authority. Resolved by making it a T1401 exact-state reconciliation item, not a new product prerequisite.

Audit 1: FINAL PASS.

---

## 30. Planning Freeze

Plan: COMPLETE.

Checklist: COMPLETE.

Tasks: COMPLETE.

Audit 1: FINAL PASS.

Open Product Decisions: 0.

Open Planning Decisions: 0.

Scope Drift: 0.

Frozen Spec mutation: 0.

Docs mutation: 0.

Production code mutation: 0.

Implement Gate: BLOCKED.

READY FOR DEVELOPMENT: NO.

Stop state: WAITING FOR IMPLEMENT GATE.

No production implementation, migration, tests, PR, merge or Audit 2 is authorized by this Plan AI 2 artifact.
