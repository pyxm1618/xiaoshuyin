# Slice 17 Development Tasks — Professional Knowledge Foundation

**Repository**: `pyxm1618/xiaoshuyin`  
**Planning branch**: `plan/017-professional-knowledge-foundation`  
**Frozen Spec authority**: `a345937868ca1b8d2cef65003d4197de4207eb52` / `866c3f77dd269c94d420d9c0ae6b918f114286ce`  
**Planning status**: FROZEN only after Audit 1 FINAL PASS  
**Implementation status at planning time**: NOT STARTED / IMPLEMENT GATE BLOCKED

Only **T1701** may run while the Implement Gate is BLOCKED. T1701 is read-only. No schema, production code, migration, implementation test or implementation PR work may begin until T1701 proves every hard prerequisite and records `READY FOR DEVELOPMENT = YES`.

## Dependency Order

~~~text
T1701  Development-start Authority / Dependency Gate
  ↓
T1702  Reconcile real owners / schema / transaction / migration head
  ↓
T1703  Typed Knowledge contracts + filter semantics
  ├─→ T1704  Minimal persistence / grants / conditional migration
  ├─→ T1705  Professional source provenance projection
  └─→ T1706  Lifecycle / version / immutable history
              ↓
           T1707  Real reviewer/publisher authority adapter
              ↓
           T1708  Lifecycle commands + shared idempotency
              ↓
           T1709  Exact Scene-package knowledge-set contribution
              ↓
           T1710  Source correction / successor evolution

T1703 + T1709
  ↓
T1711  Structured filter matcher / UNKNOWN semantics
  ↓
T1712  Deterministic Knowledge production eligibility
  ├─→ T1713  Case-scoped Auth/Consent/Compliance/Safety composition
  ├─→ T1714  Optional exact InterventionDefinition reference boundary
  └─→ T1715  Anti-enumeration / bounded read contract
              ↓
           T1716  Professional audit / observability
              ↓
           T1717  Concurrency / fault / timeout-readback proof

T1703–T1717 → T1718 Domain acceptance
T1704–T1710 → T1719 DB/RLS/lifecycle integration
T1709–T1712 → T1720 Package/Scene integration
T1712–T1717 → T1721 Family/control-plane eligibility integration
Core complete → T1722 Negative authority/scope suite → T1723 Static guard
Persistence/contracts complete → T1724 Structural verification
T1718–T1724 → T1725 Exact-head regression / traceability
T1725 → T1726 Evidence freeze / independent Audit 2 handoff
~~~

## T1701 — Development-start Authority / Dependency Gate

**Goal**  
Re-establish then-current remote truth and decide whether Slice 17 implementation is permitted. This task is read-only.

**Prerequisites**  
Planning Freeze PASS; repository access.

**Required reads**
1. current `origin/main`;
2. Frozen Spec commit/blob and all four Authority Docs;
3. Slice 16 exact implementation/Audit 2/merge state;
4. current Case, Evidence, Problem Formulation, Authorization, RLS, Consent, Compliance, Safety owners;
5. exact Scene Package identity/version owner and package knowledge-set contribution/freeze seam;
6. current professional reviewer and publisher authorization responsibility;
7. sanctioned professional-asset audit owner;
8. shared idempotency owner;
9. caller-owned same-transaction seam;
10. current migration head;
11. concrete Slice 13–15 seams only if current merged code proves Slice 17 actually touches them.

**PASS predicates**
- Slice 16 required professional owner/provenance/package interfaces are independently audited and merged/usable;
- a real accountable reviewer authority exists;
- a real publisher authority exists where the actual authority model requires it;
- a single Scene Package owner can accept/freeze exact knowledge-version contribution without a second registry;
- a sanctioned professional-asset audit/event path exists without fake family scope;
- Authorization/RLS/Consent/Compliance/Safety/idempotency/transaction seams are composable;
- no semantic authority drift.

**STOP predicates**
Any hard dependency missing, fake reviewer, dummy administrator, copied package registry, duplicate control plane, semantic drift, or required owner only existing on a plan/unmerged branch.

**Verification**  
Record exact SHAs/blobs, owner paths, merged PR/Audit2 evidence, package contribution contract, reviewer/publisher authority proof, audit owner, transaction seam and migration head.

**Mapping**  
[REQ: FR-040] [AS: AS-035] [NS: NS-17]

---

## T1702 — Reconcile authoritative owners, schema, transaction seams and migration decision

**Goal**  
Freeze the smallest correct physical implementation only after T1701 passes.

**Prerequisites**  
T1701 PASS.

**Required decisions**
- choose one Knowledge owner path;
- confirm no existing merged table already satisfies the frozen contract;
- confirm whether the true Package owner exposes contribution/freeze directly or delegates one subordinate inclusion relation;
- confirm professional-asset DB authorization/grant pattern;
- confirm professional audit path;
- confirm shared idempotency command-vocabulary extension path;
- freeze one caller-owned same-client transaction composition;
- re-read the migration head and choose NO MIGRATION or allocate then-next safe number.

**Forbidden**
A second Scene Package identity owner, second Manifest/router, second Authorization/Consent/Compliance/Safety owner, fake family-scoped audit, generic CMS/RBAC/workflow/rule engine, historical migration edits.

**Verification**  
Produce an owner/import/schema graph proving one Knowledge truth and zero duplicated owners.

**Mapping**  
[REQ: FR-001,FR-018,FR-034,FR-038,FR-040] [AS: AS-041] [NS: NS-04,NS-10,NS-11,NS-12,NS-17]

---

## T1703 — Typed Knowledge Item/version contracts and hard-filter semantics

**Goal**  
Define the exact typed domain contracts before persistence.

**Required types**
- stable Knowledge Item identity/key;
- explicit Knowledge version + pre-release revision;
- DRAFT / REVIEWED / PUBLISHED / RETIRED;
- body, locale/language, semantic category;
- stage scope mode/codes;
- age/development scope mode/codes;
- risk scope mode/codes;
- bounded applicability/exclusion predicate references;
- draft origin HUMAN / AI_ASSISTED;
- optional exact InterventionDefinition id/version reference;
- content/professional metadata hash;
- successor/supersedes reference;
- typed deterministic eligibility result and reason codes.

**Scope-state semantics**
Persisted: VALUES / ALL / NOT_APPLICABLE; missing remains invalid where required.  
Runtime: KNOWN(value) / UNKNOWN / MISSING / NOT_APPLICABLE.

**Negative proof**
No generic executable rule DSL, prose hard-filter, chunk type, embedding field, retrieval rank or AI authority field.

**Verification**  
Pure type/schema tests reject missing required publish metadata, invalid wildcard inference, malformed exact refs and unbounded predicate shapes.

**Mapping**  
[REQ: FR-002,FR-003,FR-004,FR-027,FR-034] [AS: AS-001,AS-011,AS-032] [NS: NS-01,NS-02,NS-03,NS-06,NS-07,NS-08]

---

## T1704 — Minimal persistence, professional-asset grants and conditional migration

**Goal**  
Implement only the persistence proven necessary by T1702.

**Expected minimal relations**
- `professional_knowledge_items`;
- `professional_knowledge_versions`;
- `knowledge_version_source_refs`;
- `knowledge_reviews`;
- `knowledge_package_inclusions` only if explicitly delegated by the true package owner.

**Required invariants**
- stable item identity;
- unique exact version identity;
- revision/CAS support;
- immutable published semantics;
- successor chain;
- professional asset grants separated from family RLS;
- no family_id/case_id professional-content ownership;
- least privilege runtime access;
- no private idempotency/audit/package registry.

**Migration rule**
If schema change is required, allocate only then-next safe migration after T1702. Use reviewed forward migration only.

**Verification**  
Fresh DB, upgrade, constraint, grant/RLS or sanctioned professional-context introspection, historical migration integrity.

**Mapping**  
[REQ: FR-001,FR-002,FR-017,FR-021,FR-028,FR-029,FR-030,FR-031] [AS: AS-017,AS-021,AS-022,AS-024,AS-025] [NS: NS-04,NS-10,NS-11,NS-12]

---

## T1705 — Professional source provenance projection without ingestion platform

**Goal**  
Persist reviewable, version-aware source provenance for exact Knowledge versions.

**Required source snapshot fields**
source key/reference, source type, title/author/publisher where available, source version/date where available, external identifier/reference, access/review context, rights/status where material, verification state, fingerprint/exact identity where available.

**Rules**
- source ref alone never means verified;
- required unverifiable source blocks publication;
- if Slice 16 offers a source identity, reference it exactly but do not make it a Knowledge Item;
- no raw PDF/full source body/crawler/OCR/parser/object store;
- no family private case/evidence text in source metadata;
- source_key permits affected-version lookup for later correction.

**Verification**  
Source validation tests, privacy tests, source-correction lookup tests, no-file-ingestion/schema inventory.

**Mapping**  
[REQ: FR-005,FR-006,FR-033,FR-038] [AS: AS-019,AS-020,AS-035,AS-037,AS-039] [NS: NS-03,NS-13,NS-14]

---

## T1706 — Lifecycle, semantic versioning and immutable history repository

**Goal**  
Implement the frozen lifecycle and pre-release revision behavior without a workflow engine.

**Legal semantics**
- DRAFT edit with expected revision → DRAFT revision+1;
- DRAFT + real APPROVE exact revision/hash → REVIEWED;
- DRAFT + REJECT → DRAFT + immutable rejection record;
- REVIEWED substantive edit → DRAFT revision+1; prior approval stale;
- REVIEWED publish handled by T1708/T1709 → PUBLISHED;
- PUBLISHED retire → RETIRED;
- PUBLISHED correction → predecessor unchanged + successor DRAFT;
- RETIRED successor → predecessor unchanged + successor DRAFT.

**Forbidden**
DRAFT→PUBLISHED, PUBLISHED in-place edits, PUBLISHED→DRAFT, same-version retired resurrection, stale revision transition, destructive historical overwrite.

**Verification**  
Full transition matrix, published immutability, reviewed-edit invalidation, successor uniqueness and stale-CAS tests.

**Mapping**  
[REQ: FR-007,FR-009,FR-010,FR-015,FR-016,FR-017,FR-029,FR-033] [AS: AS-006,AS-015,AS-016,AS-017,AS-018,AS-024] [NS: NS-16]

---

## T1707 — Real professional reviewer/publisher authority adapter

**Goal**  
Bind review/publication to the real authority proven at T1701.

**Prerequisites**  
T1701 must have proven the authoritative human professional-content capability. Otherwise STOP.

**Required behavior**
- resolve authenticated actor and professional content capability server-side;
- derive reviewer/publisher responsibility from the authoritative seam;
- bind review to exact version/revision/hash/source refs/time;
- family manager, developer flag, AI/model identity and caller role string cannot approve;
- do not invent separation-of-duties policy or generic RBAC;
- absence of real reviewer/source keeps item NOT READY.

**Verification**  
Real authorized fixture/capability passes; family actor, fake role, AI/system, unauthenticated and unavailable-authority cases make zero business writes.

**Mapping**  
[REQ: FR-008,FR-021,FR-027,FR-035,FR-040] [AS: AS-003,AS-004,AS-005,AS-027,AS-032,AS-035] [NS: NS-04,NS-15]

---

## T1708 — Lifecycle application commands with shared idempotency

**Goal**  
Implement bounded professional Knowledge lifecycle commands through existing idempotency and one transaction.

**Commands**
- KNOWLEDGE_DRAFT_CREATE;
- KNOWLEDGE_DRAFT_EDIT;
- KNOWLEDGE_REVIEW_DECIDE;
- KNOWLEDGE_PUBLISH;
- KNOWLEDGE_RETIRE;
- KNOWLEDGE_SUCCESSOR_CREATE.

**Rules**
- same actor/command/key + same canonical semantic payload => exact replay;
- same key + changed payload => conflict;
- authorization is required before disclosing a replay result where current access requires it;
- each mutation uses expected revision;
- package inclusion is an atomic sub-effect of publish, not a second independent publish command;
- no success idempotency record on rollback.

**Publish preconditions**
Exact current REVIEWED revision/hash, complete source/filter metadata, real reviewer provenance, exact package-owner contribution, not retired.

**Verification**  
Replay/mismatch, illegal transition, fake reviewer, stale revision and rollback tests.

**Mapping**  
[REQ: FR-008,FR-011,FR-016,FR-021,FR-027,FR-028,FR-029,FR-030,FR-031] [AS: AS-002,AS-003,AS-007,AS-020,AS-021,AS-022,AS-023,AS-024,AS-025,AS-026] [NS: NS-15,NS-16]

---

## T1709 — Exact Scene/package knowledge-set contribution and historical snapshots

**Goal**  
Integrate PUBLISHED Knowledge with the true Scene Package owner without creating a second registry.

**Prerequisites**  
T1701/T1702 prove either:
A. package owner contribution/freeze seam; or
B. explicit delegation of subordinate immutable inclusion rows.

**Required behavior**
- exact scene identity;
- exact package version/revision;
- exact Knowledge version;
- no latest resolution;
- frozen package snapshot cannot be silently mutated;
- package successor/change follows true owner semantics;
- publish + contribution are atomic;
- historical snapshots reconstruct exactly;
- wrong/stale package fails closed.

**Forbidden**
Creating `scene_packages`, changing node-manifest/routing, maintaining independent package current/latest truth.

**Verification**  
Correct/wrong/stale package tests, concurrent inclusion tests, immutable historical snapshot tests, Manifest/routing regression.

**Mapping**  
[REQ: FR-012,FR-018,FR-030,FR-036] [AS: AS-007,AS-013,AS-036] [NS: NS-12,NS-16]

---

## T1710 — Source correction, version correction and retirement evolution

**Goal**  
Make corrections traceable without mutating published professional history.

**Behavior**
- locate affected Knowledge versions by source identity;
- source withdrawal/reinterpretation never changes old snapshot in place;
- real professional decision determines retirement/successor path;
- substantive correction creates successor DRAFT;
- successor receives fresh source snapshot and fresh review;
- package inclusion follows new authorized publication;
- old exact citations remain intact.

**Verification**  
Changed/withdrawn source tests; old version hash/source/review/package snapshot remains byte/semantically unchanged; reviewed metadata edit returns to DRAFT.

**Mapping**  
[REQ: FR-005,FR-010,FR-015,FR-017,FR-033] [AS: AS-016,AS-017,AS-018,AS-019,AS-020] [NS: NS-16]

---

## T1711 — Structured filter matcher and UNKNOWN/MISSING semantics

**Goal**  
Implement pure deterministic hard-filter predicates suitable for future retrieval but independent of retrieval.

**Checks**
- scene;
- stage;
- age/development;
- applicability;
- exclusions;
- risk.

**Required semantics**
- VALUES + matching KNOWN passes;
- VALUES + nonmatching KNOWN fails;
- VALUES + UNKNOWN/MISSING fails;
- explicit ALL is allowed only when professionally reviewed as ALL;
- NOT_APPLICABLE remains distinct;
- applicability unresolved fails closed;
- exclusion unresolved fails closed when safe exclusion cannot be established;
- predicate identifiers must belong to the approved Scene/package vocabulary.

**Verification**  
Truth-table tests for every scope state; malformed/unapproved predicate code fails.

**Mapping**  
[REQ: FR-003,FR-004,FR-014] [AS: AS-008,AS-009,AS-010,AS-011,AS-012]

---

## T1712 — Pure deterministic Knowledge production eligibility

**Goal**  
Evaluate one exact Knowledge version for production-content candidacy without retrieval or model calls.

**Order**
1. exact item/version resolution;
2. PUBLISHED / not RETIRED;
3. exact package contribution;
4. scene;
5. stage;
6. age/development;
7. applicability;
8. exclusions;
9. risk;
10. optional exact InterventionDefinition reference integrity only;
11. return typed result.

**Rules**
- DRAFT/REVIEWED/RETIRED unavailable;
- wrong/unknown package/version never falls back;
- stale future cache/RAG candidate cannot promote content;
- empty published set remains truthful empty/not-ready;
- result never says the Intervention is eligible.

**Verification**  
No-network pure tests, exact version/result snapshot tests, empty-set/wrong-package/retired/stale-candidate tests.

**Mapping**  
[REQ: FR-007,FR-009,FR-013,FR-014,FR-015,FR-016,FR-033,FR-036,FR-037,FR-039] [AS: AS-006,AS-008,AS-009,AS-010,AS-011,AS-012,AS-013,AS-014,AS-015,AS-038,AS-040]

---

## T1713 — Case-scoped Authorization / Consent / Compliance / Safety composition

**Goal**  
Compose existing control planes for future family/case consumption without moving their truth into Knowledge.

**Required behavior**
- existing Authorization first: actor/family/case/purpose;
- existing Family RLS context;
- current applicable Consent;
- current Compliance/age/minor rules;
- current Safety state;
- then Knowledge eligibility;
- ordinary professional asset mutation never becomes family authority;
- Knowledge age labels do not satisfy Compliance;
- Knowledge text cannot clear Safety or grant Consent;
- wrong family/case/actor fails before sensitive existence disclosure.

**Verification**  
Wrong actor/family/case, Consent valid/revoked, Compliance allow/block/unknown, Safety Hold and exclusion independence tests.

**Mapping**  
[REQ: FR-021,FR-022,FR-024,FR-025,FR-026] [AS: AS-004,AS-028,AS-029,AS-030,AS-031,AS-037] [NS: NS-11]

---

## T1714 — Optional exact InterventionDefinition reference boundary

**Goal**  
Permit exact cross-reference while proving lifecycle and authority independence.

**Prerequisites**  
Merged Slice 16 reference-integrity seam from T1701.

**Required behavior**
- optional reference is exact definition id + exact definition version;
- source ref reuse does not create Knowledge;
- Knowledge publish never approves/publishes InterventionDefinition;
- InterventionDefinition publish never approves/publishes Knowledge;
- a Knowledge Item describing an unavailable Intervention cannot make Slice 16 eligibility pass;
- no InterventionInstance or second InterventionDefinition lifecycle.

**Verification**  
Cross-lifecycle matrix and Slice16 eligibility negative tests.

**Mapping**  
[REQ: FR-019,FR-020] [AS: AS-034,AS-039] [NS: NS-05]

---

## T1715 — Anti-enumeration and bounded item/read contract

**Goal**  
Ensure error differences do not become a professional-asset or family-data existence oracle.

**Rules**
- authenticate/authorize before protected item detail disclosure;
- internal reasons remain precise;
- unauthorized/unknown/unpublished/retired/wrong-package results collapse to the existing bounded unavailable/not-found envelope when caller lacks disclosure right;
- no public search/retrieval endpoint is added;
- reviewer identity/internal notes remain privileged;
- infrastructure failures are not mislabeled as professional unfitness.

**Verification**  
Response matrix compares status/code/body for unauthorized unknown/existing lifecycle variants; no protected identity inference.

**Mapping**  
[REQ: FR-023,FR-032] [AS: AS-014,AS-027]

---

## T1716 — Sanctioned professional business audit / observability integration

**Goal**  
Record lifecycle truth using the shared professional-asset audit owner proven by T1701.

**Events**
draft created/edited; review approved/rejected; review invalidated; published; retired; successor created; package inclusion; source correction/withdrawal decision.

**Rules**
- committed business audit is in the same transaction;
- no fake family_id;
- no private knowledge_audit ledger;
- denied/failed telemetry cannot claim a committed transition;
- metadata contains IDs/hashes/revisions/reason/source/package/correlation, not full copyrighted source or family narrative.

**Verification**  
Successful command has one authoritative event; rollback has zero success event; denied path emits only permitted non-authoritative telemetry.

**Mapping**  
[REQ: FR-030,FR-032] [AS: AS-025]

---

## T1717 — Idempotency race, concurrency, fault injection and timeout/readback proof

**Goal**  
Prove lifecycle reliability against duplicate requests, races, stale writers, transaction faults and outcome-unknown transport failures.

**Race matrix**
- two draft editors;
- two reviewers;
- review vs edit;
- publish vs edit;
- two publishers;
- publish vs retire;
- retire vs successor;
- package inclusion race;
- stale package revision.

**Fault injection**
After item/version insert, source snapshot, review write/state, package contribution, audit boundary, and before idempotency settlement.

**Timeout matrix**
- commit succeeded but response lost → same-key readback/replay proves success once;
- commit not settled before timeout → no idempotency record, safe same-key retry later;
- idempotency read unavailable → outcome remains UNKNOWN.

**Verification**  
Repeated integration tests prove one authoritative winner, no duplicate version/audit/package inclusion, no partial state, no blind retry.

**Mapping**  
[REQ: FR-028,FR-029,FR-030,FR-031] [AS: AS-021,AS-022,AS-023,AS-024,AS-025,AS-026]

---

## T1718 — Domain acceptance matrix

**Goal**  
Implement the pure/domain acceptance suite for identity, lifecycle, sources, filter semantics and deterministic eligibility.

**Coverage**
AS-001/002/006/008–020/032/034/035/038–040 as applicable to pure contracts; every scenario has explicit assertions and requirement tags.

**No-network guard**
Any model/RAG/network AI call fails the test.

**Verification**  
Focused domain suite passes on exact head.

**Mapping**  
[REQ: FR-002,FR-003,FR-004,FR-005,FR-007,FR-009,FR-010,FR-013,FR-014,FR-015,FR-016,FR-017,FR-019,FR-020,FR-027,FR-033,FR-035,FR-036,FR-037,FR-039] [AS: AS-001,AS-002,AS-006,AS-008,AS-009,AS-010,AS-011,AS-012,AS-013,AS-014,AS-015,AS-016,AS-017,AS-018,AS-019,AS-020,AS-032,AS-034,AS-035,AS-038,AS-039,AS-040]

---

## T1719 — DB / grants / professional lifecycle integration suite

**Goal**  
Prove persistence and lifecycle against the real database and real professional authority seam.

**Coverage**
fresh/upgrade schema; constraints; professional grants/context; real reviewer/publisher vs family actor; draft/review/publish/retire/successor; source provenance; idempotency; concurrency; atomic audit.

**Verification**
DB introspection proves only intended Knowledge relations/constraints exist and no family/RAG/Phase4 duplicate truth was added.

**Mapping**  
[REQ: FR-001,FR-002,FR-005,FR-008,FR-011,FR-015,FR-017,FR-021,FR-028,FR-029,FR-030,FR-031,FR-032] [AS: AS-001,AS-003,AS-004,AS-007,AS-016,AS-020,AS-021,AS-022,AS-023,AS-024,AS-025,AS-026,AS-027]

---

## T1720 — Scene Package contribution and historical-set integration suite

**Goal**  
Prove package integration does not create a second Scene system and historical sets are exact.

**Coverage**
correct package inclusion, wrong/stale package, no latest, concurrent package contribution, immutable historical snapshot, empty published set, node Manifest/routing unchanged.

**Verification**
Compare package/Manifest/routing truth before/after; inspect exact old/new knowledge-version sets.

**Mapping**  
[REQ: FR-012,FR-018,FR-036,FR-037] [AS: AS-007,AS-013,AS-036,AS-038] [NS: NS-12,NS-16]

---

## T1721 — Family/control-plane production-eligibility integration suite

**Goal**  
Prove future family/case Knowledge consumption composes existing owners and preserves privacy.

**Coverage**
wrong actor/family/case/purpose; Consent withdrawal; Compliance/age block; Safety Hold; stage/age/applicability/exclusion/risk; anti-enumeration; exact result provenance; cross-tenant family facts rejected.

**Verification**
Application denial plus RLS denial where applicable, bounded error envelopes, no sensitive Knowledge/family narrative leakage.

**Mapping**  
[REQ: FR-013,FR-014,FR-022,FR-023,FR-024,FR-025,FR-026,FR-032,FR-039] [AS: AS-004,AS-008,AS-027,AS-028,AS-029,AS-030,AS-031,AS-037,AS-040] [NS: NS-10,NS-11,NS-14]

---

## T1722 — Negative authority / AI / RAG / Phase-boundary regression suite

**Goal**  
Mechanically prove forbidden authority and scope cannot enter through implementation shortcuts.

**Required negatives**
- no embeddings/vector/lexical/chunk/parser/ingestion;
- no retrieval/search/ranking/RAG;
- no Context/AI Task/Registry/provider/Jev/Promptfoo;
- no A4003/Formulation/execution AI;
- no Phase 4 truth;
- no generic CMS/expert marketplace/RBAC/workflow/rule engine;
- no duplicate InterventionDefinition/Case/Evidence/Formulation/Family Memory/control plane;
- no alternate Manifest/router/package registry;
- no raw source archive;
- no automatic family-private Knowledge generation;
- no AI approval/publish;
- no floating latest;
- no Docs/Frozen upstream mutation;
- no claim that RAG/AI release exists.

**Verification**
DB/file/import/API inventory plus executable negative cases; synthetic future cached RAG/embedding reference never promotes DRAFT/RETIRED content.

**Mapping**  
[REQ: FR-006,FR-019,FR-020,FR-024,FR-027,FR-034,FR-035,FR-038,FR-039] [AS: AS-005,AS-032,AS-033,AS-034,AS-035,AS-037,AS-039,AS-040] [NS: NS-01,NS-02,NS-03,NS-04,NS-05,NS-06,NS-07,NS-08,NS-09,NS-10,NS-11,NS-12,NS-13,NS-14,NS-15,NS-16,NS-17,NS-18]

---

## T1723 — Static architecture guard for ownership and forbidden platforms

**Goal**  
Extend existing static guard narrowly and non-vacuously.

**Guard rules**
- exactly one Knowledge owner;
- no knowledge_embeddings/chunks/vector/search/RAG imports;
- no generic CMS/RBAC/workflow/rule engine;
- no InterventionDefinition lifecycle duplicate;
- no Case/Evidence/Formulation/Family Memory duplicate;
- no Authorization/Consent/Compliance/Safety duplicate;
- no alternate Manifest/router/package identity;
- no `latest` helper used as publication/eligibility authority;
- no AI/model review/publish authority;
- no raw source archive path introduced;
- no Phase 4 schema/routes.

**Self-test**
Each new rule must fail on at least one synthetic violating sample and pass on the real tree.

**Verification**
Static guard, guard self-test and all historical Slice 9/10/11/16 guard rules remain green.

**Mapping**  
[REQ: FR-001,FR-018,FR-034,FR-038] [AS: AS-041] [NS: NS-01,NS-02,NS-03,NS-04,NS-05,NS-06,NS-07,NS-08,NS-09,NS-10,NS-11,NS-12,NS-13,NS-14,NS-15,NS-16]

---

## T1724 — Migration / grants / contracts / OpenAPI structural verification

**Goal**  
Run repository-standard structural verification for every actually changed persistence/contract surface.

**Required verification**
- official migration runner fresh DB + historical upgrade if migration exists;
- migration history byte/integrity check;
- schema projection equivalence;
- professional grants/RLS/context introspection;
- shared idempotency command vocabulary;
- OpenAPI generate/check only if a server surface was actually added;
- no public generic professional CMS/search API.

**Failure rule**
Do not weaken historical tests or alter old migrations to make the Slice pass.

**Mapping**  
[REQ: FR-001,FR-021,FR-028,FR-030,FR-031] [AS: AS-021,AS-025,AS-027] [NS: NS-04,NS-12]

---

## T1725 — Exact-head regression, requirement coverage and scope convergence

**Goal**  
Prove the exact implementation head satisfies the entire Frozen Spec without regressing upstream owners.

**Required commands/evidence**
- typecheck;
- static guard + non-vacuous self-test;
- Slice 17 domain suite;
- DB/lifecycle suite;
- package integration suite;
- family/control-plane integration;
- reliability/fault/timeout suite;
- migration fresh/upgrade if applicable;
- grants/RLS/professional DB context;
- OpenAPI/contracts if applicable;
- relevant Case/Evidence/Formulation/Consent/Compliance/Safety/Scene/Slice16 regressions;
- full relevant regression;
- compare exact base/head/merge-base/ahead/behind;
- changed-file inventory proves Docs=0, Frozen Spec=0, forbidden scope=0.

**Traceability proof**
Mechanically verify every FR, AS and NS appears in executable evidence; no “implicitly covered” rows.

**Verification**
All evidence is generated against one exact head. Any later commit invalidates T1725.

**Mapping**  
[REQ: FR-001,FR-002,FR-003,FR-004,FR-005,FR-006,FR-007,FR-008,FR-009,FR-010,FR-011,FR-012,FR-013,FR-014,FR-015,FR-016,FR-017,FR-018,FR-019,FR-020,FR-021,FR-022,FR-023,FR-024,FR-025,FR-026,FR-027,FR-028,FR-029,FR-030,FR-031,FR-032,FR-033,FR-034,FR-035,FR-036,FR-037,FR-038,FR-039,FR-040] [AS: AS-001,AS-002,AS-003,AS-004,AS-005,AS-006,AS-007,AS-008,AS-009,AS-010,AS-011,AS-012,AS-013,AS-014,AS-015,AS-016,AS-017,AS-018,AS-019,AS-020,AS-021,AS-022,AS-023,AS-024,AS-025,AS-026,AS-027,AS-028,AS-029,AS-030,AS-031,AS-032,AS-033,AS-034,AS-035,AS-036,AS-037,AS-038,AS-039,AS-040,AS-041] [NS: NS-01,NS-02,NS-03,NS-04,NS-05,NS-06,NS-07,NS-08,NS-09,NS-10,NS-11,NS-12,NS-13,NS-14,NS-15,NS-16,NS-17,NS-18]

---

## T1726 — Implementation evidence freeze and independent Audit 2 handoff

**Goal**  
Freeze an exact-head evidence package for a new independent Audit 2 AI. Do not perform Audit 2.

**Prerequisites**
T1725 PASS.

**Evidence package**
- exact base/head/merge-base/ahead/behind;
- changed files;
- migration identity or explicit NO MIGRATION;
- schema/grants/RLS/professional authority evidence;
- reviewer/publisher authority evidence;
- exact package contribution/history evidence;
- audit/idempotency/concurrency/atomicity/timeout-readback evidence;
- FR 40/40, AS 41/41, NS 18/18;
- test commands/results;
- Frozen Spec/Docs mutation 0;
- AI/RAG/Phase4 forbidden scope 0.

**Stop boundary**
Developer AI must output `READY FOR INDEPENDENT AUDIT 2` and STOP. It may not audit itself, announce merge-safe, or merge main.

**Verification**
Re-read exact remote head and recompute evidence hashes/references. A later head requires full T1725/T1726 regeneration.

**Mapping**  
[REQ: FR-001,FR-002,FR-003,FR-004,FR-005,FR-006,FR-007,FR-008,FR-009,FR-010,FR-011,FR-012,FR-013,FR-014,FR-015,FR-016,FR-017,FR-018,FR-019,FR-020,FR-021,FR-022,FR-023,FR-024,FR-025,FR-026,FR-027,FR-028,FR-029,FR-030,FR-031,FR-032,FR-033,FR-034,FR-035,FR-036,FR-037,FR-038,FR-039,FR-040] [AS: AS-001,AS-002,AS-003,AS-004,AS-005,AS-006,AS-007,AS-008,AS-009,AS-010,AS-011,AS-012,AS-013,AS-014,AS-015,AS-016,AS-017,AS-018,AS-019,AS-020,AS-021,AS-022,AS-023,AS-024,AS-025,AS-026,AS-027,AS-028,AS-029,AS-030,AS-031,AS-032,AS-033,AS-034,AS-035,AS-036,AS-037,AS-038,AS-039,AS-040,AS-041] [NS: NS-01,NS-02,NS-03,NS-04,NS-05,NS-06,NS-07,NS-08,NS-09,NS-10,NS-11,NS-12,NS-13,NS-14,NS-15,NS-16,NS-17,NS-18]

## Coverage Freeze

- Functional Requirements: **40/40**
- Acceptance Scenarios: **41/41**
- Negative Scope Scenarios: **18/18**
- Development Tasks: **26**

No task authorizes implementation while T1701 is BLOCKED. No task authorizes Audit 2 or merge.
