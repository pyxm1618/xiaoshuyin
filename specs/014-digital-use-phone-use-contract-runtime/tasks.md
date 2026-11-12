# Slice 14 Engineering Tasks — Digital Use Phone Use Contract Runtime

> Feature: PHONE_USE_CONTRACT / A4001–A4012
>
> Frozen Spec commit: `3984a04b1b30b2beb96f146f65668bfb95ae05a3`
>
> Rule: T1401 is the only task permitted before the Development Implement Gate passes. T1402–T1426 require T1401 PASS.
>
> These are future engineering execution tasks. This planning artifact does not implement them.

---

## T1401 — Development-start Authority / Implement Gate

### Goal

Prove that then-current main is legally and mechanically ready for Slice 14 implementation without changing Frozen Spec semantics.

### Expected Scope

Re-read remote repository truth immediately before development:
- then-current `origin/main`;
- all four formal Docs and their blobs;
- Slice 14 Frozen Spec commit/blob;
- Slice 8, 9, 10, 11 merged runtime state;
- Slice 12 Frozen Spec, planning state, runtime PR/Audit 2/merge state and actual merged code;
- Slice 13 Frozen Spec/planning/runtime state;
- all relevant open PRs, including the current Slice 8 same-transaction seam remediation or its successor;
- exact migration list/order;
- authoritative transaction/RLS/idempotency/audit/authorization/Consent/Safety/Compliance/Scene seams.

Hard gate:
- Slice 12 runtime independent Audit 2 = PASS;
- Slice 12 merged to then-current main;
- actual A2010 legal solution boundary exists;
- actual authoritative Scene State and Scene Artifact seams exist;
- actual Scene API/command/revision/transaction contract is usable by Slice 14;
- genuine child Contract confirmation can be represented through existing Identity/Participant/Authorization provenance;
- required same-transaction composition is available;
- no semantic authority drift exists.

Slice 13 completion is not a business prerequisite. Inspect it only for mechanical migration/schema/shared-seam collisions.

### Mandatory Contracts

- No Frozen Spec mutation.
- No Docs/upstream semantic mutation.
- No implementation before this task PASS.
- Missing owner seam => STOP for owner-approved narrow remediation.
- Semantic authority drift => STOP.
- Slice 13 cannot be converted into a new business prerequisite.
- Phase 3/4 absence must remain truthful, not treated as a reason to fabricate capability.

### Verification

Produce an exact development-start gate record with:
- SHA/blob evidence;
- PR/runtime states;
- compare/diff evidence where drift exists;
- migration inventory;
- owner/seam inventory;
- classification of any drift as semantic, dependency-execution or mechanical;
- explicit PASS/BLOCKED decision.

### Prerequisites

None. This is the sole permitted first engineering task.

### Frozen Spec Authority

Frozen Spec §§1, 9–10, 32–34; FR-001, FR-003, FR-038, FR-039.

### Acceptance / Evidence Ownership

AS-01, AS-03, AS-65, AS-80; implement-gate evidence itself.

### Completion Rule

PASS only when every hard dependency above is proven on then-current main. Otherwise STOP/BLOCKED. No T1402+ work may start.

---

## T1402 — Reconcile merged owner seams, API and transaction contracts

### Goal

Bind Slice 14 to the exact merged upstream owners and remove all planning assumptions before schema/application work.

### Expected Scope

Inspect actual current interfaces for:
- Case/current-primary/version;
- Problem Formulation/A2010 solution-stage entry;
- Slice 11 Manifest/routing;
- Slice 12 Scene State, Scene Artifact, generic Scene API and transaction composition;
- Authorization/RLS context;
- Consent owner/version/revocation;
- Slice 9 Safety ordinary-progression guard;
- Slice 10 Compliance feature/capability evaluator;
- idempotency;
- audit/Case event;
- professional/package asset resolution.

Define the narrow integration map and exact same-client transaction composition. Reconcile current error vocabulary and OpenAPI conventions.

### Mandatory Contracts

- No duplicate owner or wrapper truth.
- No direct SQL into upstream-owned Problem Formulation/Scene/Consent/Safety/Compliance truth.
- No nested/separate business-effect transaction if owner contract requires same transaction.
- No private next-node logic.
- If exact child-confirmation authorization or owner revalidation seam is missing, STOP for owner-approved remediation.

### Verification

Architecture/interface inventory, compile-time imports, transaction ownership tests/fixtures, static guards proving no second owner. Confirm current Slice 12 API seam rather than copying its plan text.

### Prerequisites

T1401 PASS.

### Frozen Spec Authority

Frozen Spec §§9–10, 16–23, 26; FR-002, FR-028–FR-039.

### Acceptance / Evidence Ownership

AS-01–AS-04, AS-58–AS-65, AS-69–AS-74, AS-75, AS-80.

### Completion Rule

Complete only when every required owner seam is explicit and composition is safe. Any unresolved seam is STOP, not a local workaround.

---

## T1403 — Additive Contract/Roleplay persistence, migration and RLS

### Goal

Create only the approved Slice 14 business persistence required for versioned Contract and roleplay SIMULATION truth.

### Expected Scope

After re-reading exact migration order, add the next safe forward migration for:
- `digital_use_contract_versions`;
- `roleplay_sessions`;
- `roleplay_turns`;
- minimum shared enum/check/index/grant vocabulary needed by those tables.

Implement:
- Contract version uniqueness;
- draft revision;
- approved status vocabulary;
- parties/source/dependency/provenance fields;
- self supersedes relation;
- one-current-ACTIVE per Case database enforcement;
- roleplay Case/Family/session/turn integrity;
- Family RLS;
- FORCE RLS where repository policy requires;
- runtime NOBYPASSRLS/non-owner least privilege.

Do not create quiz/tool/A400x-per-node tables.

### Mandatory Contracts

- Additive/forward-only; historical migrations immutable.
- No separate contract_drafts table.
- No generic Contract engine/schema platform.
- No table per node.
- No normal DELETE/TRUNCATE/public grants.
- ACTIVE/SUPERSEDED material history is not destructively rewritten by ordinary commands.

### Verification

Migration fresh bootstrap, upgrade from exact then-current main, framework-appropriate repeat/second-apply test, DB constraints/indexes, one-current-ACTIVE concurrency proof, FK integrity, RLS no-context/cross-Family denial, grants, failed-migration rollback.

### Prerequisites

T1401, T1402.

### Frozen Spec Authority

Frozen Spec §§9.5–9.6, 14–15, 22–24; FR-017, FR-019, FR-020, FR-025, FR-026, FR-028, FR-034, FR-035.

### Acceptance / Evidence Ownership

AS-29, AS-37, AS-48–AS-56, AS-59, AS-68.

### Completion Rule

Complete only when the schema enforces the approved aggregate invariants and introduces no unapproved persistence owner.

---

## T1404 — Shared typed schemas, references, provenance and error vocabulary

### Goal

Define the bounded type contracts needed by all A400x handlers without creating a generic forms/workflow engine.

### Expected Scope

Implement validated schemas/types for:
- typed Scene artifact payloads used by A4001 and A4004–A4009/A4011;
- Contract eight-section values;
- dependency/source refs;
- Contract draft revision and confirmation provenance;
- roleplay SIMULATION session/turn/rating/selection;
- stale/idempotency/unavailable/error responses;
- professional asset/version refs.

Reuse current repository error and ref conventions wherever possible.

### Mandatory Contracts

- Parent/child/professional/simulation provenance are distinguishable.
- No opaque catch-all payload.
- No new generic schema DSL.
- No local HTTP/error stack that hides owner errors.
- Client-provided actor role or confirmation source is not authoritative.

### Verification

Schema/domain unit tests, invalid payload tests, provenance discriminator tests, ref scope tests, stable error-contract tests, static scan for prohibited generic engines.

### Prerequisites

T1402, T1403.

### Frozen Spec Authority

Frozen Spec §§14–15, 20, 26–27; FR-007, FR-009, FR-017, FR-018, FR-032, FR-037.

### Acceptance / Evidence Ownership

AS-15–AS-17, AS-23, AS-32–AS-35, AS-58–AS-65.

### Completion Rule

Complete when every later task can use typed contracts without inventing a second business owner or generic engine.

---

## T1405 — Professional content/version binding

### Goal

Bind A4001 quiz, A4002 template/four examples and A4011 FAQ to approved versioned professional/package assets.

### Expected Scope

Implement current server-owned asset resolution for:
- five-question A4001 asset and approved answer key;
- formal eight-section template;
- exactly four complete examples;
- full approved FAQ/support topics.

Track asset/package versions and stale/retired handling. Do not duplicate professional content ownership.

### Mandatory Contracts

- Answer key remains TRUE/FALSE/FALSE/FALSE/FALSE.
- Examples are professional assets, never Family facts by view/selection.
- No auto-copy into Contract truth.
- Historical Contract retains source_template_version.
- Retired/stale content cannot silently be used for a current write.
- No RAG/platform work.

### Verification

Asset completeness/version tests, four-example count/content-identity test, eight-section template test, FAQ topic completeness, stale/retired asset test, static proof no family fact creation from GET/view.

### Prerequisites

T1402, T1404.

### Frozen Spec Authority

Frozen Spec §§9.7, 13.1–13.2, 13.11, 15; FR-004–FR-007, FR-022, FR-032.

### Acceptance / Evidence Ownership

AS-05–AS-12, AS-35, AS-41, AS-71.

### Completion Rule

Complete only when approved content is versioned, complete and cleanly separated from Family truth.

---

## T1406 — PHONE_USE_CONTRACT Scene orchestration integration

### Goal

Integrate the twelve canonical PHONE_USE_CONTRACT nodes with merged Slice 12 Scene runtime while preserving Slice 11 topology authority.

### Expected Scope

Extend the existing bounded Scene execution orchestration with phone-contract node semantic dispatch only. Reuse:
- Scene State;
- Scene Artifact;
- Manifest/routing;
- authorization/RLS transaction;
- current primary/A2010 entry;
- Safety/Compliance/Consent gates;
- idempotency/audit.

Support legal initial A4001 entry, Manifest-approved direct/re-entry behavior, route reason projection and truthful sibling/downstream availability.

### Mandatory Contracts

- No second manifest/router.
- No numeric adjacency.
- No client nextNode authority.
- A3000 completion is not A4001 prerequisite.
- Direct A4002/A4010 without prerequisites fails with no write.
- Node semantic handlers do not own topology.

### Verification

Scene integration tests for legal/illegal entry, fabricated node, unreachable node, sibling FAMILY_ALLIANCE absent/in-progress, client-nextNode attack, route reason fidelity, no second topology static guard.

### Prerequisites

T1402, T1404, merged Slice 12 runtime.

### Frozen Spec Authority

Frozen Spec §§9.2–9.3, 11–13, 25–26; FR-002, FR-003, FR-011, FR-038.

### Acceptance / Evidence Ownership

AS-01–AS-04, AS-20–AS-21, AS-44, AS-75.

### Completion Rule

Complete only when all A400x reachability remains server-authoritative and parallel-stream semantics are preserved.

---

## T1407 — A4001 preparation quiz

### Goal

Implement the approved five-question preparation gate with immutable attempt history.

### Expected Scope

Using the generic Scene response command:
- accept exactly five answers;
- resolve current quiz/content version;
- evaluate approved key;
- create typed quiz-attempt Scene artifact;
- retain wrong-question IDs;
- return approved explanations;
- complete A4001 only when all five answers are correct;
- support retries without deleting prior attempts.

### Mandatory Contracts

- Reading/viewing does not pass.
- Partial/wrong answers do not pass.
- No Quiz Engine/table.
- Attempt, completion, audit/event and idempotency settle atomically.
- Safety/Compliance/Consent/authorization/package drift can block.

### Verification

Unit/domain tests for key, invalid/partial payload, wrong answer, all correct; integration for read-only, retry/history, stale content; idempotency/concurrency/fault tests for attempt+completion atomicity.

### Prerequisites

T1404–T1406.

### Frozen Spec Authority

Frozen Spec §13.1, §§21–23; FR-004, FR-005, FR-033–FR-035.

### Acceptance / Evidence Ownership

AS-05–AS-08, AS-66–AS-67.

### Completion Rule

Complete only when node completion is mechanically impossible without one valid all-correct current-version attempt.

---

## T1408 — A4002 template and four examples

### Goal

Expose approved current template and four examples without creating Family truth.

### Expected Scope

Implement contract template/examples read surface and A4002 Scene review/completion behavior. Resolve current asset versions, return all eight template sections and all four examples, and record only the minimum Scene review/completion reference required.

### Mandatory Contracts

- GET/view is read-only family-wise.
- No auto-population.
- No confirmation creation.
- Stale asset before a family write cannot silently apply.
- Exactly four examples remain accessible.

### Verification

API contract/OpenAPI tests, four-example completeness, template structure, no-family-write assertions, asset drift test, A4002 completion/reachability integration.

### Prerequisites

T1405–T1407.

### Frozen Spec Authority

Frozen Spec §13.2, §14, §15; FR-006, FR-007.

### Acceptance / Evidence Ownership

AS-09–AS-12.

### Completion Rule

Complete when A4002 is fully usable while professional examples remain isolated from Family business facts.

---

## T1409 — A4003 roleplay domain, persistence and adapter boundary

### Goal

Implement the deterministic Phase 2 roleplay business contract without implementing real AI.

### Expected Scope

Implement:
- SIMULATION session lifecycle;
- roleplay turn persistence;
- user rating;
- selected result;
- expected revision handling;
- adult/guardian actor requirement at domain boundary;
- narrow roleplay capability/adapter interface;
- deterministic test-only adapter;
- completion only after a valid selected result under current version refs.

Persist no child Statement/Fact/Evidence/Consent/persona.

### Mandatory Contracts

- Adult user plays child; adapter simulates parent.
- SIMULATION provenance is immutable.
- No persistent child persona.
- No generic AI/RAG/Agent framework.
- No production canned fake.
- Selection never satisfies child confirmation.

### Verification

Domain/repository tests for session/turn ordering, rating/select, stale revision, selected result, repeated rounds, simulation provenance; static scan for persona/child-Evidence writes; deterministic fixture positive path.

### Prerequisites

T1403–T1406, T1408.

### Frozen Spec Authority

Frozen Spec §§9.6, 13.3, 27; FR-008–FR-010, FR-032, FR-040.

### Acceptance / Evidence Ownership

AS-13, AS-15–AS-17, AS-19, AS-33.

### Completion Rule

Complete when the entire roleplay business contract can be proven deterministically without a real model/network provider and cannot contaminate child truth.

---

## T1410 — A4003 roleplay APIs and truthful production-unavailable behavior

### Goal

Expose the approved roleplay endpoints with server-side adult/guardian enforcement and truthful Phase 3 capability failure.

### Expected Scope

Implement approved routes:
- create session;
- add turn;
- rate;
- select.

Integrate authoritative Authorization/Compliance/Safety/Consent and adapter capability check. When no approved production adapter exists, return `DOWNSTREAM_AI_UNAVAILABLE`, preserve legitimate pre-call state and leave A4003 incomplete.

### Mandatory Contracts

- Minor blocked server-side.
- UNKNOWN age cannot be treated as adult.
- No UI-only guard.
- No fake response/session completion.
- Infrastructure failure differs from policy block and downstream unavailable.

### Verification

API/OpenAPI tests, minor/unknown/adult matrix, unavailable adapter fixture, no fake turn/completion assertion, same-key replay, cross-Family roleplay RLS test.

### Prerequisites

T1409, T1423 may later add full hardening; initial owner seams from T1402 are required.

### Frozen Spec Authority

Frozen Spec §§13.3, 16–19, 26–28; FR-008–FR-010, FR-024, FR-028–FR-031, FR-037.

### Acceptance / Evidence Ownership

AS-13–AS-19, AS-43, AS-58–AS-65.

### Completion Rule

Complete when production accurately distinguishes allowed simulation, policy denial, infrastructure failure and unavailable Phase 3 capability.

---

## T1411 — A4004 tool catalog and re-entry hub

### Goal

Implement the re-enterable A4004 tool catalog without serializing A4005–A4009 into a wizard.

### Expected Scope

Present canonical tool choices and persist only a bounded typed tool-selection Scene artifact if required. Use Manifest entry/re-entry metadata for A4005–A4009 availability.

### Mandatory Contracts

- A4005–A4009 remain independent approved components.
- No mandatory numeric chain.
- Catalog completion/selection does not mean all tools complete.
- Every re-entry rechecks current gates/revisions.

### Verification

Routing/integration tests for each approved tool entry, re-entry preserving history, no numeric adjacency, partial tool use, stale/gate failures.

### Prerequisites

T1406, T1408; A4003 must be legitimately complete for normal routed entry where Manifest requires it.

### Frozen Spec Authority

Frozen Spec §13.4, §25; FR-011.

### Acceptance / Evidence Ownership

AS-20, AS-21, AS-28, AS-44.

### Completion Rule

Complete only when the catalog is a navigation/support hub and not a second workflow engine.

---

## T1412 — A4005 collaborative duration component

### Goal

Persist the family's current duration proposal/result with real provenance and revision semantics.

### Expected Scope

Implement typed PHONE_USE_DURATION_COMPONENT Scene artifact, source refs, revision/CAS and approved professional reference display.

### Mandatory Contracts

- Collaborative determination preserved.
- Comparison/reference duration is advisory only.
- It cannot become Assessment/Problem/Intervention routing truth.
- Parent report of child view remains parent-sourced.
- Completion does not equal final child Contract confirmation.

### Verification

Domain/integration tests for valid save, parent provenance, genuine child source where available, stale revision, re-entry/history, no route-gate use of duration reference.

### Prerequisites

T1411, T1405, T1404.

### Frozen Spec Authority

Frozen Spec §13.5, §§20, 23–25; FR-012, FR-032.

### Acceptance / Evidence Ownership

AS-22, AS-23, AS-28, AS-68.

### Completion Rule

Complete when a typed current preparation artifact exists without creating confirmation or assessment truth.

---

## T1413 — A4006 supervision measures and Scene-level log

### Goal

Persist approved supervision preparation and bounded execution observations without creating Phase 4 Checkin truth.

### Expected Scope

Implement typed supervision component and permitted Scene-level log artifact, provenance, revision and re-entry.

### Mandatory Contracts

- Supervision remains a jointly discussed Contract component.
- Scene-level log only.
- No Checkin table/row/owner.
- No automatic task/schedule/notification side effect.

### Verification

Artifact/domain/integration tests for save/log/revision; static/scope-negative test proving no Checkin/Task/Follow-up creation.

### Prerequisites

T1411, T1404, T1405.

### Frozen Spec Authority

Frozen Spec §13.6, §14.4; FR-013.

### Acceptance / Evidence Ownership

AS-24, AS-28, AS-45.

### Completion Rule

Complete when supervision is usable in the Contract preparation stream while Phase 4 ownership remains untouched.

---

## T1414 — A4007 incentive component

### Goal

Persist the family's actual incentive proposal separately from professional examples.

### Expected Scope

Implement typed incentive component artifact with source/content version refs, revision and correction history.

### Mandatory Contracts

- Professional example remains professional content.
- No automatic reward selection/copy.
- Only explicit family input becomes family preparation truth.
- Current Safety/Compliance policy remains authoritative.

### Verification

Example/family separation tests, valid save, stale revision, re-entry/correction, provenance tests.

### Prerequisites

T1411, T1404, T1405.

### Frozen Spec Authority

Frozen Spec §13.7, §§20, 24; FR-014, FR-032.

### Acceptance / Evidence Ownership

AS-25, AS-28, AS-71.

### Completion Rule

Complete when family result and professional examples are mechanically distinguishable and history-preserving.

---

## T1415 — A4008 breach-responsibility component

### Goal

Persist the family's actual breach-responsibility proposal with provenance and current policy validation.

### Expected Scope

Implement typed breach component artifact, approved principles/examples presentation, revision and correction.

### Mandatory Contracts

- No example punishment is auto-copied.
- AI cannot invent/approve an unreviewed high-impact term.
- Safety/Compliance/professional content gates remain effective.
- Family result remains separate from examples.

### Verification

Valid save, example isolation, unsafe/unapproved term policy fixture as supported by current content contract, stale revision, provenance and correction tests.

### Prerequisites

T1411, T1404, T1405.

### Frozen Spec Authority

Frozen Spec §13.8, §§18–20, 24; FR-015, FR-030–FR-032.

### Acceptance / Evidence Ownership

AS-26, AS-28, AS-62–AS-63, AS-71.

### Completion Rule

Complete only when breach terms are explicit family content under current approved constraints.

---

## T1416 — A4009 parent self-regulation artifact

### Goal

Implement the approved parent self-regulation methods/tools and viewable checklist/document as Scene artifact.

### Expected Scope

Create typed parent commitments/self-regulation artifact with actor attribution, source/content version, revision and re-entry history.

### Mandatory Contracts

- Not Family Memory.
- Not Common Core Task.
- Parent commitments remain actor-attributed.
- No scheduler/reminder side effect.

### Verification

Artifact schema/provenance tests, revision/re-entry tests, static negative proof no Task/Memory write.

### Prerequisites

T1411, T1404, T1405.

### Frozen Spec Authority

Frozen Spec §13.9, §14.4; FR-016, FR-032.

### Acceptance / Evidence Ownership

AS-27, AS-28, AS-77.

### Completion Rule

Complete when the document/checklist is a bounded Scene artifact and no Phase 4/Memory owner leaks in.

---

## T1417 — Contract DRAFT aggregate and SaveContractDraft

### Goal

Create and revise the authoritative formal Contract draft without a second draft store.

### Expected Scope

Implement SaveContractDraft over `digital_use_contract_versions` DRAFT/PENDING rows:
- allocate formal version under aggregate rules;
- preserve eight section identities;
- accept explicit optional/N/A semantics;
- bind source_template_version;
- bind dependency/source refs;
- consume selected current A4005–A4009 artifacts as references/inputs where applicable;
- expected draft_revision CAS;
- material edit increments revision;
- prior-revision confirmations are no longer activation-valid.

### Mandatory Contracts

- No separate contract_drafts table.
- No all-fields-nonempty requirement.
- No all-tools-complete requirement.
- No professional example auto-copy.
- No material edit to ACTIVE/SUPERSEDED row.
- Draft write is transactional with audit/idempotency.

### Verification

Repository/domain/API tests for create/update, optional/N/A, stale revision, source refs, template drift, no ACTIVE edit, revision-bound confirmation invalidation.

### Prerequisites

T1403–T1405, T1412–T1416 as optional preparation inputs; no universal requirement that all are complete.

### Frozen Spec Authority

Frozen Spec §§13.10, 14–15, 21–24; FR-007, FR-017–FR-019, FR-033–FR-036.

### Acceptance / Evidence Ownership

AS-28, AS-29, AS-35, AS-38, AS-68, AS-70–AS-72.

### Completion Rule

Complete when DRAFT/PENDING rows are the sole formal draft truth and support safe revision without history overwrite.

---

## T1418 — Genuine party confirmation provenance

### Goal

Implement confirmation actions that can never let a parent, AI or simulation manufacture the child's agreement.

### Expected Scope

Implement server-derived confirmation identity for exact Contract/version/draft_revision:
- authorized adult/guardian party confirmation;
- authenticated child party confirmation only through existing Identity/Participant/Authorization owner;
- exact action and current applicable Consent/Compliance;
- actor/time/revision provenance;
- independent concurrent confirmation updates;
- invalidation/staleness on draft revision change.

Do not add a child identity, attestation or Consent subsystem.

### Mandatory Contracts

- Parent cannot confirm as child.
- AI/roleplay cannot confirm as child.
- Guardian consent/identity binding is not Contract confirmation.
- Wrong child/wrong Case fails.
- Missing genuine child seam => STOP.
- Confirmation binds to exact current draft_revision.

### Verification

Authorization/provenance/domain/integration tests:
parent attack, AI/simulation attack, wrong child, wrong Case, missing child confirmation, missing adult confirmation, concurrent adult/child confirmations, edit-after-confirm stale confirmation, child-source correction/conflict.

### Prerequisites

T1402–T1404, T1417.

### Frozen Spec Authority

Frozen Spec §§13.10, 16–20, 22, 24; FR-018, FR-027–FR-032.

### Acceptance / Evidence Ownership

AS-30–AS-34, AS-50–AS-51, AS-58–AS-65, AS-73.

### Completion Rule

Complete only when every valid child confirmation is cryptographically/session/identity-bound through the authoritative existing owner and no proxy path exists.

---

## T1419 — A4010 atomic activation, document and A4011 entry

### Goal

Activate the first/current formal phone-use Contract exactly once when all current requirements are satisfied.

### Expected Scope

Implement ConfirmContractVersion activation path:
1. authorize and establish RLS transaction;
2. lock/re-read Case/current Contract aggregate;
3. validate primary/phase/package/Manifest;
4. revalidate Safety/Compliance/Consent;
5. validate template/source version/dependency refs;
6. validate exact current-revision party confirmations;
7. enforce one current ACTIVE;
8. transition DRAFT/PENDING → ACTIVE;
9. complete A4010 Scene output;
10. expose legal A4011 entry;
11. create/reference Contract view-document Scene artifact;
12. audit/event + idempotency in same transaction.

No Follow-up Schedule/job is created.

### Mandatory Contracts

- No false child confirmation.
- No two current ACTIVE versions.
- No half-commit between Contract/Scene/document/audit/idempotency.
- Document is projection, not second truth.
- A4011 availability only follows legitimate ACTIVE Contract.

### Verification

Valid activation, missing confirmations, false source attacks, optional sections, duplicate replay, concurrent activation, stale draft, injected failures at each effect boundary, document projection test, database uniqueness.

### Prerequisites

T1417, T1418, T1406.

### Frozen Spec Authority

Frozen Spec §§12.1, 13.10, 15, 21–23; FR-018–FR-021, FR-028–FR-035.

### Acceptance / Evidence Ownership

AS-29–AS-40, AS-36–AS-39.

### Completion Rule

Complete when exactly one authoritative ACTIVE Contract and matching Scene state can be committed or the whole command rolls back.

---

## T1420 — A4011 FAQ, static support and re-entry

### Goal

Provide the bounded Phase 2 execution-support experience for a current Contract without leaking Phase 3/4 ownership.

### Expected Scope

Implement:
- current Contract read context;
- full versioned FAQ read;
- static approved support;
- Manifest-approved routing back to A4004–A4009;
- typed Scene-level support/log artifact;
- support re-entry with gate/revision revalidation;
- truthful personalized-AI unavailable;
- truthful follow-up/reminder unavailable.

### Mandatory Contracts

- Support never silently edits Contract terms.
- No Checkin/Task/Review/Outcome.
- No Follow-up Schedule/pg-boss/Notification.
- No fake AI answer/reminder.
- Safety can block ordinary support without altering Contract history.

### Verification

FAQ completeness, re-entry, tool routing, no-term-mutation, AI unavailable, no Checkin, no reminder state, Safety block/race, scope-static guard.

### Prerequisites

T1419, T1405, T1406.

### Frozen Spec Authority

Frozen Spec §§12.2, 13.11, 25, 28.2–28.4; FR-022–FR-024, FR-031, FR-037.

### Acceptance / Evidence Ownership

AS-41–AS-47, AS-74, AS-77–AS-79.

### Completion Rule

Complete when A4011 is useful with only approved Phase 2 capabilities and all unavailable downstreams remain truthful.

---

## T1421 — A4012 new-version creation and atomic supersession

### Goal

Implement Contract revision by creating a new version, never by mutating old ACTIVE meaning.

### Expected Scope

Implement SupersedeContractVersion:
- require exact current ACTIVE;
- validate approved trigger/reason;
- create new formal DRAFT version with `supersedes_id`;
- copy prior terms only as starting draft;
- revise under draft_revision;
- require both current parties to re-confirm exact revised revision;
- leave old ACTIVE current while pending;
- atomically switch new → ACTIVE and old → SUPERSEDED;
- produce new view document/Scene output;
- preserve full history.

Scheduled entry remains unavailable without Phase 4; user-initiated legal entry works.

### Mandatory Contracts

- No material UPDATE to ACTIVE.
- Re-confirmation mandatory.
- Stale current-active basis fails.
- One current ACTIVE maximum.
- Fault leaves old ACTIVE current.
- No private scheduler.

### Verification

Period-complete trigger, new-problem trigger, pending state, valid supersede, history read, in-place update rejection, concurrent/stale supersession, injected rollback, no scheduler, user-initiated revision.

### Prerequisites

T1417–T1420.

### Frozen Spec Authority

Frozen Spec §§12.3, 13.12, 15, 22–24, 28.3; FR-025–FR-027, FR-033–FR-036.

### Acceptance / Evidence Ownership

AS-48–AS-57, AS-68.

### Completion Rule

Complete only when version history and supersedes semantics remain correct under retries, races and failures.

---

## T1422 — Public Contract API/OpenAPI and Scene projection integration

### Goal

Expose the approved Contract API surface and integrate it coherently with the generic Scene surface without creating duplicate lifecycle logic.

### Expected Scope

Implement/verify:
- GET template;
- GET examples;
- GET current Contract;
- POST draft;
- PATCH draft version;
- POST confirm;
- POST revise;
- GET FAQ;
- approved roleplay routes from T1410;
- generic Scene projection/reachable-node representation for A4001–A4012.

Update OpenAPI/generated client according to repository conventions.

### Mandatory Contracts

- Dedicated Contract routes invoke the same domain commands/aggregate as Scene semantics; no second state machine.
- Client cannot force next node.
- Direct illegal entry has stable failure and no write.
- Anti-enumeration preserved.
- No hidden/test-only production route.

### Verification

API contract/OpenAPI/generation tests, route inventory, direct-entry negatives, generated-client drift, current Contract read authorization, no duplicate implementation architecture guard.

### Prerequisites

T1406–T1421.

### Frozen Spec Authority

Frozen Spec §§11–13, 16, 26; FR-002, FR-028, FR-039.

### Acceptance / Evidence Ownership

AS-02, AS-09–AS-10, AS-13–AS-14, AS-29, AS-41–AS-44, AS-58–AS-59.

### Completion Rule

Complete when public API faithfully projects one authoritative Scene/Contract domain with no alternate workflow.

---

## T1423 — Authorization, RLS, Consent, Compliance and Safety hardening

### Goal

Prove all control planes independently protect every Slice 14 read/write.

### Expected Scope

Apply application authorization + DB RLS and test:
- no context;
- wrong Family/Case/participant/current-primary;
- wrong Contract party;
- parent-as-child confirmation attack;
- minor A4003;
- cross-Case refs;
- cross-Family Contract/roleplay/artifacts;
- purpose mismatch;
- Consent missing/revoked;
- Compliance BLOCK/unresolved/unsupported obligation;
- Safety Hold.

Ensure owner-specific version/revalidation tokens are available to transaction close.

### Mandatory Contracts

- Authorization does not replace Consent/Compliance/Safety.
- RLS does not replace application Authorization.
- Contract confirmation does not replace Consent.
- Minor roleplay block is server-side.
- No local policy/consent/safety truth.

### Verification

Security-negative, RLS, integration and API tests; server/DB role tests; anti-enumeration; no-context and cross-Family denial; parent child-confirmation attack; minor A4003; Consent/Compliance/Safety block matrices.

### Prerequisites

T1402–T1422.

### Frozen Spec Authority

Frozen Spec §§16–19, 23, 26; FR-018, FR-028–FR-032, FR-038.

### Acceptance / Evidence Ownership

AS-14, AS-23, AS-30–AS-34, AS-47, AS-58–AS-65.

### Completion Rule

Complete only when each independent control plane can block the operation without partial business success.

---

## T1424 — Idempotency, concurrency, atomicity and fault hardening

### Goal

Mechanically prove no duplicate, stale, lost-update or half-committed Contract/Scene truth.

### Expected Scope

Exercise:
- same key/same payload;
- same key/different payload;
- concurrent same key;
- same component/draft revision races;
- independent A4005–A4009 writes;
- adult/child confirmation concurrency;
- confirmation-vs-edit;
- concurrent A4010 activation;
- concurrent A4012 supersession;
- primary switch;
- Safety/Consent/Compliance/package/Manifest/content drift;
- fault injection across quiz/tool/roleplay/A4010/A4012 transaction boundaries;
- idempotency completion rollback.

### Mandatory Contracts

- One business execution per key.
- No LWW on formal Contract truth.
- One current ACTIVE.
- Final mutable-authority revalidation before commit.
- Business success and idempotency success commit together.
- Fault leaves zero partial success residue.

### Verification

Concurrency/idempotency/fault suites plus DB uniqueness read-back. Assert all expected tables/artifacts/Scene state/audit/idempotency after each injected failure.

### Prerequisites

T1407–T1423.

### Frozen Spec Authority

Frozen Spec §§21–23; FR-020, FR-021, FR-033–FR-035.

### Acceptance / Evidence Ownership

AS-36–AS-39, AS-50–AS-56, AS-60, AS-64, AS-66–AS-70.

### Completion Rule

Complete only when every listed race/failure has deterministic allowed outcomes and no partial Contract/Scene state.

---

## T1425 — Correction, drift and downstream-unavailable hardening

### Goal

Prove historical preservation and truthful behavior when sources, policies, assets or downstream capabilities change.

### Expected Scope

Cover:
- A4001 retry history;
- A4004–A4009 artifact correction;
- Contract draft correction/revision;
- Evidence/source correction;
- child-confirmation source invalidation/conflict;
- professional asset retirement/version drift;
- package/Manifest drift;
- Consent revocation after active Contract;
- roleplay selected-result correction;
- personalized AI unavailable;
- follow-up/reminder unavailable;
- A5002 unavailable;
- upstream owner unavailable.

### Mandatory Contracts

- No silent historical rewrite.
- ACTIVE material changes use A4012.
- Source invalidation uses existing owner dependency propagation.
- Downstream unavailable is never success.
- No fake Review/Schedule/notification/AI.

### Verification

Correction/invalidation integration tests, historical read-back, dependency-ref tests, stale asset/package tests, downstream-unavailable API tests, scope-negative assertions.

### Prerequisites

T1417–T1424.

### Frozen Spec Authority

Frozen Spec §§24–28; FR-024–FR-027, FR-036, FR-037.

### Acceptance / Evidence Ownership

AS-42–AS-47, AS-52–AS-57, AS-61, AS-65, AS-70–AS-74.

### Completion Rule

Complete when every correction/drift/unavailable case preserves truthful current and historical state without creating substitute downstream truth.

---

## T1426 — Full acceptance, governance, exact-head convergence and Audit 2 handoff

### Goal

Prove the exact implementation head satisfies the complete Frozen Slice 14 contract and contains no scope leakage.

### Expected Scope

Run:
- all 80 Frozen Acceptance Scenarios;
- all FR-001–FR-040 evidence;
- node-level A4001–A4012 fixtures;
- deterministic no-real-model full Phase 2 fixture;
- migration upgrade/fresh bootstrap/RLS/grants;
- API/OpenAPI/generated client;
- Manifest/routing integration;
- idempotency/concurrency/fault;
- security/provenance;
- correction/downstream unavailable;
- repository-native full regression;
- static architecture/scope guards;
- exact-head changed-file review.

Bind successful CI/evidence to the exact development head and prepare independent Audit 2 handoff only.

### Mandatory Contracts

Changed-file/static review must prove:
- no second Manifest/router;
- no numeric routing/client nextNode;
- no duplicate upstream owner;
- no generic Contract/workflow/forms/rules/AI engine;
- no table/service/controller per node proliferation;
- no Phase 4/A5001/A5002 runtime;
- no private scheduler/pg-boss/Notification;
- no real AI/RAG/Agent platform;
- no fake child confirmation/persona;
- no in-place ACTIVE Contract update;
- no Docs/Frozen Spec/upstream semantic edits.

### Verification

All 80 AS PASS, all 40 FR evidence PASS, all negative-space guards PASS, full CI PASS, exact-head diff PASS, Frozen Spec blob exact, Docs exact, dependency state recorded. No waiver through test deletion/guard weakening.

### Prerequisites

T1401–T1425 all complete.

### Frozen Spec Authority

Frozen Spec §§29–34; FR-001–FR-040.

### Acceptance / Evidence Ownership

AS-01–AS-80, all negative-space requirements, exact-head governance.

### Completion Rule

Complete only when exact implementation head has zero unresolved critical/high/medium/low planning-contract finding and is ready for an independent code Audit 2. This task does not perform Audit 2, create/merge a PR on behalf of Plan AI 2, or authorize self-merge.

---

# Task Traceability Summary

Task count: 26.

| Task | Primary Frozen authority | Primary future evidence |
|---|---|---|
| T1401 | §§1,9–10,32–34; FR-001/003/038/039 | exact remote SHA/blob/dependency/owner/migration gate |
| T1402 | §§9–10,16–23,26 | owner seam/transaction/interface inventory + architecture guards |
| T1403 | §§9.5–9.6,14–15,22–24 | migration/DB/RLS/constraint/current-active tests |
| T1404 | §§14–15,20,26–27 | schema/provenance/error-contract tests |
| T1405 | §§9.7,13.1–13.2,13.11,15 | professional asset completeness/version/drift tests |
| T1406 | §§9.2–9.3,11–13,25–26 | Scene/Manifest entry/routing/parallel tests |
| T1407 | §13.1, §§21–23 | A4001 all-correct/wrong/retry/atomic tests |
| T1408 | §13.2, §§14–15 | A4002 template/four examples/isolation |
| T1409 | §§9.6,13.3,27 | A4003 deterministic SIMULATION domain/provenance |
| T1410 | §§13.3,16–19,26–28 | roleplay API/minor/unavailable/security |
| T1411 | §§13.4,25 | tool catalog/re-entry/no numeric chain |
| T1412 | §§13.5,20,23–25 | A4005 component/provenance/revision |
| T1413 | §§13.6,14.4 | A4006 Scene log/no Checkin |
| T1414 | §§13.7,20,24 | A4007 example/family separation |
| T1415 | §§13.8,18–20,24 | A4008 example/family separation/policy |
| T1416 | §§13.9,14.4 | A4009 artifact/no Task/Memory |
| T1417 | §§13.10,14–15,21–24 | DRAFT/revision/source/schema tests |
| T1418 | §§13.10,16–20,22,24 | real-party confirmation provenance/security |
| T1419 | §§12.1,13.10,15,21–23 | A4010 activation/current-active/atomicity |
| T1420 | §§12.2,13.11,25,28 | A4011 FAQ/support/no Phase 4 |
| T1421 | §§12.3,13.12,15,22–24,28.3 | A4012 supersession/history/concurrency |
| T1422 | §§11–13,16,26 | API/OpenAPI/direct-entry/anti-enumeration |
| T1423 | §§16–19,23,26 | Authorization/RLS/Consent/Compliance/Safety matrix |
| T1424 | §§21–23 | idempotency/concurrency/fault-injection |
| T1425 | §§24–28 | correction/drift/downstream-unavailable |
| T1426 | §§29–34 | 40 FR + 80 AS + negative-space + exact-head evidence |

# Acceptance Evidence Ownership

All Frozen Acceptance Scenarios AS-01–AS-80 are mapped in plan.md §27 to one or more T1401–T1426 tasks. No Acceptance Scenario is left without a future verification owner.

# Functional Requirement Ownership

All Frozen Functional Requirements FR-001–FR-040 are mapped in plan.md §26 to Plan, Checklist, Task and future evidence. No task exists without Frozen Spec authority.

# Planning Freeze

These tasks define future implementation only.

Current Implement Gate: BLOCKED.

Reason: Slice 12 Digital Use Assessment / Scene State / Scene Artifact runtime has not yet completed implementation, independent Audit 2 PASS and merge to current main.

READY FOR DEVELOPMENT: NO.

Plan AI 2 stops before implementation, migration creation, test implementation, development PR, merge or Audit 2.
