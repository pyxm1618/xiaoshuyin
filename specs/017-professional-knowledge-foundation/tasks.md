# Slice 17 Development Tasks — Professional Knowledge Foundation

**Repository**: pyxm1618/xiaoshuyin  
**Planning branch**: spec/017-professional-knowledge-foundation  
**Frozen Spec**: a345937868ca1b8d2cef65003d4197de4207eb52 / 866c3f77dd269c94d420d9c0ae6b918f114286ce  
**Implementation status at planning time**: NOT STARTED / IMPLEMENT GATE BLOCKED

Only **T1701** may execute while the gate is blocked. It is read-only.

## Dependency Order

~~~text
T1701 read-only development gate
  -> T1702 owner/package/audit/schema reconciliation
  -> T1703 typed contracts
     -> T1704 persistence/RLS
     -> T1705 source provenance
     -> T1706 identity/version/edit semantics
        -> T1707 real professional authority
        -> T1708 review
        -> T1709 publish + exact package contribution
        -> T1710 retire/correct/successor
  -> T1711 professional asset access
  -> T1712 pure exact-version eligibility
  -> T1713 family/case control-plane composition
  -> T1714 anti-enumeration
T1708–T1710 -> T1715 idempotency
T1706–T1710 -> T1716 concurrency/CAS
T1708–T1718 -> T1717 timeout/readback
core -> T1718 audit
T1712–T1714 -> T1719 future exact-ref seam
core -> T1720–T1725 verification suites/guards
T1720–T1725 -> T1726 traceability
T1726 -> T1727 exact-head convergence
T1727 -> T1728 Audit 2 handoff
~~~

## T1701 — Development-start Authority / Dependency Gate

**Goal**: read-only re-establishment of then-current truth.

**Must reverify**
- main, merge-base/ancestry, Frozen Spec blob, four Docs semantics;
- migration head;
- Slice 16 merged runtime/provenance seam or Frozen-authorized strict independence;
- one Scene Package exact knowledge-set owner/contribution seam with history/CAS;
- real professional reviewer authority;
- professional create/edit/review/publish/retire authorization;
- sanctioned non-family professional audit path under existing audit owner;
- Case/Evidence/Formulation/Auth/RLS/Consent/Compliance/Safety owners;
- shared idempotency and caller-owned transaction seam;
- Slice 13–15 only where concrete coupling exists.

**STOP if** any hard predicate is missing, a second owner would be required, or reviewer/package/audit authority would need fabrication.

**Evidence**: exact SHAs/blobs, owner paths, merge status, migration head, authority evidence.

[REQ: FR-021,FR-040] [AS: AS-035] [NS: NS-04]

## T1702 — Reconcile authoritative owners / package / audit / schema

Prerequisite: T1701 PASS.

Freeze one physical owner graph and exact implementation paths. Prove one Knowledge owner, existing package owner contribution seam, sanctioned audit-owner extension, professional auth/RLS seam, transaction seam and migration decision.

NO MIGRATION is legal. Otherwise allocate then-next safe number only after re-reading main. No package registry, private audit ledger, generic RBAC/CMS/rules/workflow, duplicate Evidence/Formulation/control plane or historical migration edit.

Verification: owner/import graph + package/audit authority proof + migration decision.

[REQ: FR-001,FR-019,FR-040] [AS: AS-041] [NS: NS-04,NS-05,NS-10,NS-11,NS-12]

## T1703 — Typed Knowledge contracts / lifecycle / filter vocabulary

Define stable identity, semantic version, draft revision, exact lifecycle, draft-origin provenance, source refs, explicit scopes, bounded predicates and typed eligibility result.

Required: DRAFT/REVIEWED/PUBLISHED/RETIRED only; missing/UNKNOWN/NOT_APPLICABLE/ALL distinct; risk/age reuse authority; no generic DSL; no family narrative fields.

Verification: schema/type negative tests.

[REQ: FR-002,FR-003,FR-004,FR-006,FR-007,FR-027] [AS: AS-001,AS-010,AS-011] [NS: NS-14,NS-15]

## T1704 — Minimal persistence / migration / RLS / grants

Implement only T1702-proven persistence: logical item, versions, source refs, version-source binding, append-only reviews, and package binding only under package authority.

Invariants: unique exact versions; CAS; published/retired immutable; least privilege; no family private columns; unpublished hidden from family runtime; no latest.

Verification: fresh/upgrade migration, constraints, schema inventory, RLS/grants, historical migration hashes.

[REQ: FR-001,FR-002,FR-003] [AS: AS-017,AS-041] [NS: NS-01,NS-10,NS-11,NS-12]

## T1705 — Professional source provenance

Implement source identity/version/date/reference, publisher/author where available, review/access context, rights/status where material, verification revision/state and withdrawal.

No PDF/raw body/OCR/crawler/parser/object store. No family Evidence promotion.

Verification: unverifiable source blocks publication; withdrawal blocks affected new use; old source snapshot/history survives; privacy/copyright negatives.

[REQ: FR-005,FR-006,FR-033,FR-038] [AS: AS-019,AS-020,AS-035,AS-037,AS-039] [NS: NS-03,NS-13,NS-14]

## T1706 — Identity/version/edit/review invalidation/successor

Implement DRAFT CAS edits, exact review-hash binding support, REVIEWED substantive edit -> DRAFT, immutable published/retired payload, and successor DRAFT semantic version.

Source/filter/age/risk/package-scope change is substantive. Administrative changes are allowlisted and cannot affect eligibility.

Verification: stale edit, review invalidation, published edit rejection, successor uniqueness/history.

[REQ: FR-002,FR-010,FR-016,FR-017] [AS: AS-017,AS-018] [NS: NS-16]

## T1707 — Real professional reviewer / mutation authority adapter

Prerequisite: T1701 proves real merged authority.

Resolve server-side capabilities; review requires accountable professional responsibility. Family owner, fixture, developer flag, AI identity, client role string and hard-coded admin cannot qualify.

No new generic staff/RBAC platform.

Verification: real authority succeeds; all false authority paths fail with zero writes.

[REQ: FR-008,FR-021,FR-027,FR-035] [AS: AS-003,AS-004,AS-005,AS-032,AS-035] [NS: NS-04,NS-15]

## T1708 — Review decision command

Review one exact current draft revision/hash and source-set revision.

APPROVE -> append decision + REVIEWED. REJECT -> append decision + DRAFT/nonproduction. Stale revision/hash fails. REVIEWED is never production content.

Use expected revision and shared idempotency.

**Submission semantics**: Frozen Spec has no SUBMITTED state. T1708's authoritative mutation is the reviewer decision on an exact DRAFT revision. If T1702 proves an existing professional-workflow owner has a separate review-request command, integrate it only as non-authoritative idempotent coordination carrying the exact revision/hash. Do not create a queue table, SUBMITTED status or generic workflow owner.

Verification: approve/reject/stale/replay/unauthorized/reviewed-only negative; if an existing review-request seam is used, verify replay/mismatch and prove it cannot approve or publish.

[REQ: FR-008,FR-009,FR-010,FR-011] [AS: AS-002,AS-003,AS-006,AS-018]

## T1709 — Publish + exact Scene Package contribution

Publish only REVIEWED exact version with valid real review, verified sources, complete hard-filter metadata and exact reviewed package scope.

In one logical transaction: package-owner CAS/binding, version PUBLISHED, audit and idempotency settlement.

No latest, no PUBLISHED without binding, no invented package version, no silent package replacement.

Verification: publish without review/source, wrong/latest/stale package, concurrent publisher, package history, truthful empty set.

[REQ: FR-005,FR-011,FR-012,FR-018,FR-030,FR-036,FR-037] [AS: AS-002,AS-007,AS-013,AS-020,AS-036,AS-038] [NS: NS-12,NS-16]

## T1710 — Retirement / source invalidation / correction / successor

PUBLISHED -> RETIRED with expected revision. Preserve history. Same version cannot reactivate. Correction creates new DRAFT successor and fresh review path. Source withdrawal can immediately block new use without mutating old content.

Verification: retire/new-use block/history/resurrection rejection/source correction/successor.

[REQ: FR-015,FR-016,FR-017,FR-033] [AS: AS-015,AS-016,AS-017,AS-019] [NS: NS-16]

## T1711 — Professional asset access boundary

Professional create/edit/review/publish/retire and unpublished reads require explicit professional capability. Do not fake Family RLS context. DB grants/RLS must match app authorization.

Verification: family user cannot read unpublished/mutate; real professional authority works only through approved seam.

[REQ: FR-021] [AS: AS-004,AS-027]

## T1712 — Pure deterministic exact-version eligibility

For one exact version evaluate: PUBLISHED/not retired -> source valid -> exact package inclusion -> scene -> stage -> age/development -> applicability -> exclusion -> risk compatibility.

Missing/UNKNOWN required facts fail closed. Explicit ALL is reviewed metadata. No DB writes/model/search.

Return typed exact IDs/revisions/reasons.

Verification: full truth table including draft/reviewed/retired/wrong package/scene/stage/age/missing/exclusion/risk/empty.

[REQ: FR-004,FR-007,FR-009,FR-013,FR-014,FR-015,FR-025,FR-033,FR-036,FR-037,FR-039] [AS: AS-006,AS-008,AS-009,AS-010,AS-011,AS-012,AS-013,AS-014,AS-015,AS-038,AS-040]

## T1713 — Family/case Authorization / Consent / Compliance / Safety

Authorize actor/family/case/purpose, establish RLS, load current Case/Scene package, authoritative age/development facts, Consent, transaction-time Compliance and current Safety. Compose independently around T1712.

No copied control-plane truth. Required BLOCK/UNKNOWN fails closed; infrastructure exceptions stay exceptions.

Verification: wrong actor/family/case, consent withdrawal, compliance block/unresolved, Safety Hold, age label cannot grant legal access, Knowledge cannot clear Safety.

[REQ: FR-013,FR-014,FR-022,FR-024,FR-025,FR-026] [AS: AS-008,AS-028,AS-029,AS-030,AS-031,AS-041] [NS: NS-11]

## T1714 — Anti-enumeration / bounded external result

Keep detailed internal reason codes but preserve existing anti-enumeration. Unauthorized callers cannot distinguish protected item/version/package existence. Family output excludes reviewer identity/internal review notes.

Verification: envelope equivalence for protected unknown/draft/retired/wrong-package/wrong-actor cases; infrastructure remains internally distinct.

[REQ: FR-023,FR-032] [AS: AS-014,AS-027,AS-028]

## T1715 — Shared idempotency integration

Extend the existing shared command vocabulary/orchestration for create, edit, review, publish/package contribution, retire, successor and source lifecycle mutations.

same key+same semantic payload => exact replay. Same key+different payload => conflict. Protected replay reauthorizes.

No knowledge-specific idempotency store.

Verification: replay/mismatch per command; one version/review/binding/audit effect.

[REQ: FR-028,FR-030] [AS: AS-021,AS-022]

## T1716 — CAS / concurrency matrix

Test two editors, two reviewers, review-vs-edit, publish-vs-edit, two publishers, publish-vs-retire, retire-vs-successor, source-withdraw-vs-publish, package-set race, stale revision.

At most one valid transition wins; no last-write-wins.

[REQ: FR-010,FR-029] [AS: AS-023,AS-024]

## T1717 — Timeout / outcome-unknown / readback

Prove:
1. commit succeeds + response lost -> readback/replay returns one committed result;
2. no commit/rollback + timeout -> no success; legal retry executes once;
3. publish/retire retry does not duplicate;
4. readback is authorization-protected.

Use authoritative resource state + shared idempotency identity. Never guess success/failure.

[REQ: FR-031] [AS: AS-025,AS-026]

## T1718 — Authoritative professional audit integration

Prerequisite: sanctioned existing audit-owner extension.

Audit create/edit/review approve/reject/publish+package inclusion/retire/successor/source verify-withdraw. Success event in same transaction. Denied telemetry cannot claim business transition.

No fake family_id, private audit ledger, family narrative or raw source text.

[REQ: FR-030,FR-032] [AS: AS-016,AS-025]

## T1719 — Future exact-ref consumer seam only

Allow exact package-set member resolution plus exact-version fetch/evaluation/provenance. No search, embedding, chunking, rank, rerank, fusion, context/prompt or answer generation.

InterventionDefinition exact reference is metadata only; no eligibility propagation.

[REQ: FR-013,FR-019,FR-020,FR-034,FR-039] [AS: AS-033,AS-034,AS-038,AS-039,AS-040] [NS: NS-01,NS-02,NS-05,NS-06]

## T1720 — Domain acceptance suite

No-network deterministic tests for lifecycle, source, filters and immutable history. Test fixtures do not count as real reviewer-gate evidence.

Explicitly cover AS-001–AS-020 where domain-level plus pure parts of AS-032/035/038/040.

[REQ: FR-003,FR-004,FR-005,FR-007,FR-009,FR-014,FR-035] [AS: AS-001,AS-002,AS-003,AS-006,AS-009,AS-010,AS-011,AS-012,AS-017,AS-018,AS-020,AS-035,AS-038,AS-040]

## T1721 — DB / RLS / control-plane integration suite

Fresh/upgrade migration, constraints, grants/RLS, professional vs family access, source/version history, wrong family/case, Consent withdrawal, Compliance and Safety integration.

[REQ: FR-013,FR-022,FR-024,FR-025,FR-026,FR-033] [AS: AS-008,AS-016,AS-019,AS-029,AS-030,AS-031,AS-041]

## T1722 — Scene Package owner / historical snapshot suite

Prove exact DIGITAL_USE/package identity, package-owner CAS, publication binding, wrong package, no latest, historical package snapshot unchanged and Slice 11 routing/Slice 12 state ownership intact.

[REQ: FR-012,FR-018,FR-036] [AS: AS-007,AS-013,AS-036,AS-041] [NS: NS-12,NS-16]

## T1723 — Reliability / race / rollback / timeout suite

Cover AS-021–AS-026 and T1716/T1717. Inject failure after version, review, source check, package binding, audit and before idempotency completion. Assert zero partial truth and deterministic single winner/readback.

[REQ: FR-028,FR-029,FR-030,FR-031] [AS: AS-021,AS-022,AS-023,AS-024,AS-025,AS-026]

## T1724 — Security / privacy / anti-enumeration suite

Wrong actor/family/case, unpublished read, protected ID/package existence, family narrative/source metadata rejection, log privacy, raw copyrighted source rejection, replay disclosure and Evidence/Formulation duplication negatives.

[REQ: FR-006,FR-023,FR-032,FR-038] [AS: AS-004,AS-027,AS-028,AS-037] [NS: NS-10,NS-13,NS-14]

## T1725 — Negative scope / static architecture guard

Mechanically prove all NS-01–NS-18. Any new static guard must have a synthetic violating sample, so it is non-vacuous.

Guard no embeddings/vector/search/chunk/parser/RAG/AI runtime/Jev/Promptfoo/A4003/Phase4/CMS/RBAC/workflow/second Intervention/control plane/package registry/floating latest/fake reviewer. Existing owner guards cannot be weakened.

[REQ: FR-001,FR-006,FR-019,FR-020,FR-024,FR-026,FR-027,FR-034,FR-035,FR-038,FR-039] [AS: AS-005,AS-032,AS-033,AS-034,AS-035,AS-039,AS-040,AS-041] [NS: NS-01,NS-02,NS-03,NS-04,NS-05,NS-06,NS-07,NS-08,NS-09,NS-10,NS-11,NS-12,NS-13,NS-14,NS-15,NS-16,NS-17,NS-18]

## T1726 — Exact traceability proof

Reconcile implementation evidence to every Frozen ID.

Required: FR 40/40; AS 41/41; NS 18/18. No implicit row without an assertion/evidence path.

[REQ: FR-001–FR-040] [AS: AS-001–AS-041] [NS: NS-01–NS-18]

## T1727 — Exact-head regression / governance convergence

On one exact head run typecheck, static guard+self-test, Slice 17 domain/DB/integration/reliability/security/package tests, migration fresh/upgrade if applicable, relevant historical owner regressions and full relevant suite.

Recompute exact base/head/merge-base/ahead/behind and changed files. Frozen Spec, Docs and Slice12–16 frozen artifacts must be unchanged. Any new commit invalidates evidence and requires rerun.

[REQ: FR-001–FR-040] [AS: AS-001–AS-041] [NS: NS-01–NS-18]

## T1728 — Evidence freeze / independent Audit 2 handoff

Freeze base/head, changed files, migration identity, schema/RLS/grants, real reviewer authority, package authority, professional audit authority, idempotency/concurrency/rollback/timeout evidence, FR 40/40, AS 41/41, NS 18/18 and scope guards.

Developer does not perform Audit 2, declare merge-safe or merge main.

[REQ: FR-001–FR-040] [AS: AS-001–AS-041] [NS: NS-01–NS-18]

## Coverage Freeze

- Functional Requirements: **40/40**
- Acceptance Scenarios: **41/41**
- Negative Scope Scenarios: **18/18**
- Tasks: **28**
