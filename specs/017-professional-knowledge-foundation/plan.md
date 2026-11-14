# Slice 17 Implementation Plan — Professional Knowledge Foundation

**Role**: Slice 17 Plan AI 2 — Plan + Checklist + Tasks + Audit 1 only  
**Repository**: pyxm1618/xiaoshuyin  
**Planning branch**: plan/017-professional-knowledge-foundation  
**Frozen Spec**: commit a345937868ca1b8d2cef65003d4197de4207eb52 / blob 866c3f77dd269c94d420d9c0ae6b918f114286ce  
**Execution context**: REMOTE-ONLY. Remote repository truth is authoritative; no local checkout is claimed.  
**Planning status**: COMPLETE subject to Audit 1  
**Runtime status**: BLOCKED — only T1701 read-only gate may run until all implementation prerequisites are real.

## 1. Authority Gate

| Authority | Exact planning-time truth | Result |
|---|---|---|
| origin/main | 17e81b2badfd5a706e15867e2faf504d88a72364 | PASS |
| Frozen Spec branch | spec/017-professional-knowledge-foundation | PASS |
| Frozen Spec commit | a345937868ca1b8d2cef65003d4197de4207eb52 | PASS |
| Frozen Spec blob | 866c3f77dd269c94d420d9c0ae6b918f114286ce | PASS — exact |
| Frozen Spec vs main | ahead 1 / behind 0 / one changed file | PASS |
| Docs/总产品需求.md | 67724000cb9bb81c40489c04db28d899bd1df74c | PASS |
| Docs/V1产品需求.md | 1900485a407e0634643f4f0bbe5ab02476dc4bfd | PASS |
| Docs/总体技术架构.md | 9b08371edc976fa281469dfee8dc19962452e3b0 | PASS |
| Docs/V1技术设计.md | 6f03d1a3c49bdc866945ae7f82df542f1292a147 | PASS |
| Slice 16 planning freeze | 40d6c4e19b9207b287aec03c5ba02868260dd8fe | PASS — planning only, not merged runtime |
| Current migration head | 015_digital_use_assessment_runtime.sql | PASS — record only, no number reserved |
| Current Scene identity | DIGITAL_USE / v1 | PASS |
| Current professional reviewer authority | none proven on main | BLOCKING runtime fact |
| Current merged Slice 16 runtime | absent | BLOCKING runtime fact |

### 1.1 Input drift

Frozen Spec commit/blob match exactly. Current main still matches the Slice 17 selection baseline. No semantic authority drift was found.

~~~text
Input Drift: NONE
~~~

Any later semantic drift in Frozen Spec or Authority Docs is a hard STOP and returns to Product Authority. Development-start T1701 may reconcile only non-semantic execution drift.

## 2. Scope and Phase Boundary

Slice 17 owns one narrow Phase 3 capability:

> authoritative Professional Knowledge Item identity/version + source provenance snapshot + real professional review + publication/retirement + exact Scene/package knowledge-set contribution + deterministic production-content eligibility.

It does not own retrieval. It does not own AI. It does not own intervention eligibility.

Slice 17 creates no:
- knowledge_embeddings;
- chunk persistence;
- document ingestion/parser/OCR/crawler;
- pgvector/sparsevec/pg_jieba;
- retrieval/search/ranking/RRF/reranker;
- RAG A/B/C or Gold Dataset execution;
- Context Builder;
- AI Task Runtime;
- TaskModelRegistry/model gateway/provider execution;
- Jev/Promptfoo runtime;
- Problem Formulation AI, A4003 AI or execution-support AI;
- Family Memory;
- InterventionInstance/Goal/Plan/Task/Checkin/Review/Outcome/Schedule/Notification;
- generic CMS, expert marketplace, RBAC builder, workflow engine or rule engine.

Knowledge Item is professionally reviewable semantic content. Chunk is a future retrieval implementation detail.

## 3. Repository Owner Inventory

Planning-time remote inspection established the following real owner graph.

| Concern | Current authoritative module / persistence | Merged now? | Caller-owned transaction / reuse note |
|---|---|---:|---|
| Case | packages/domain/src/cases.ts; db/migrations/002_case_core.sql | YES | existing PoolClient repository functions |
| Evidence | packages/domain/src/evidence.ts; db/migrations/004_evidence_core.sql | YES | existing owner, no Knowledge copy |
| Problem Formulation | packages/domain/src/problem-formulations.ts; apps/server/api/src/services/problem-formulations.ts | YES | repository functions accept caller PoolClient |
| Authorization | packages/authorization/src/authorize.ts + apps/server/api/src/authz.ts | YES | single authorize entry point; no professional mutation action exists yet |
| Family RLS | apps/server/api/src/db/tx.ts, db RLS functions | YES | caller-owned transaction available |
| Drizzle same-transaction seam | apps/server/api/src/db/drizzle-tx.ts | YES | same checked-out PoolClient exposed to retained raw helpers |
| Consent | consent_records owner + packages/compliance/src/supplemental-consent.ts | YES | existing purpose-scoped owner |
| Compliance | packages/compliance/src/feature-policy*.ts; migration 011 | YES | deterministic owner, no Knowledge copy |
| Safety | packages/domain/src/safety/*; migrations 009/010 | YES | cases.status remains current Safety truth |
| Scene Manifest/routing | packages/scenes/digital-use/node-manifest.ts + routing.ts | YES | sole topology truth |
| Scene/package identity | packages/scenes/digital-use/types.ts: DIGITAL_USE / v1 | YES | identity exists; no package registry/knowledge-set owner exists on main |
| Scene runtime/state | packages/domain/src/scene-runtime-*; migration 015 | YES | A1001 row anchors case package version |
| Shared idempotency | apps/server/api/src/idempotency.ts + packages/domain/src/idempotency.ts + idempotency_keys | YES | same-key replay/mismatch and caller-owned transaction path |
| Business audit | business_audit_events + case_events conventions | PARTIAL for Slice 17 | current business_audit_events is family-scoped; no sanctioned global professional-asset audit seam proven |
| Professional reviewer authorization | none found on main | NO | hard gate; no dummy/fake reviewer may be created |
| Slice 16 InterventionDefinition/provenance/package seam | frozen plan branch only | NO | conservative hard prerequisite for Slice 17 integration |
| Migration head | 015_digital_use_assessment_runtime.sql | YES | must re-read at implementation start |

### 3.1 Owner conclusions

1. Current main has a real Scene identity but not a production Scene Package registry able to own an immutable knowledge-version set snapshot.
2. Current main has no real professional reviewer/publisher authority.
3. Current main business audit is family-scoped and cannot be reused for global professional content by inventing a fake family.
4. Slice 16 is planned but unmerged; its future professional provenance/package/audit seam cannot be treated as runtime.
5. Therefore Slice 17 planning may complete, but implementation is currently blocked.

## 4. Development-Start Gate — T1701

T1701 is read-only. It is the only task allowed while the implement gate is blocked.

T1701 must re-read and record:
- then-current main SHA;
- Frozen Spec commit/blob;
- four Authority Docs;
- Slice 16 Audit 2 PASS + merged runtime availability;
- exact Scene/package owner and whether it can accept an exact knowledge-set contribution without a second registry;
- exact professional reviewer and publisher authority;
- Authorization owner;
- RLS/session context owner;
- Consent owner;
- Compliance owner;
- Safety owner;
- shared idempotency owner;
- professional/business audit owner suitable for non-family professional assets;
- caller-owned same-transaction seam;
- current migration head;
- any concrete Slice 13–15 integration seam actually touched by current code.

Hard stop conditions:
- Slice 16 is not merged/usable;
- professional reviewer authority is absent or fabricated;
- professional publisher authority is absent where distinct authority is required by the existing seam;
- package owner cannot prove exact package/version contribution + immutable historical snapshot;
- professional audit cannot be recorded without creating a private duplicate ledger or fake family;
- required composition cannot share one transaction;
- implementation would need a second Authorization/Consent/Compliance/Safety/Scene owner;
- semantic authority drift exists.

Current planning-time result:

~~~text
Implement Gate: BLOCKED
Development Authorization: NOT GRANTED
~~~

## 5. Ownership Model

### 5.1 Slice 17 owns

Slice 17 is the sole owner of:
- stable Knowledge Item identity;
- exact Knowledge Item version;
- draft origin provenance;
- content body/locale/category;
- typed hard-filter metadata;
- immutable per-version professional source provenance snapshot;
- Knowledge review decisions and exact reviewed revision/hash;
- Knowledge lifecycle state;
- Knowledge correction/successor chain;
- Knowledge retirement;
- Knowledge-side exact package contribution records only when delegated by the true package authority;
- deterministic knowledge production-eligibility result.

### 5.2 Slice 17 consumes

Slice 17 consumes without copying:
- Case/Family/Person/Participant;
- Evidence and Problem Formulation;
- Authorization;
- Consent;
- Compliance;
- Safety;
- Scene Manifest/routing/state;
- exact Scene/package identity/revision from its true owner;
- Slice 16 InterventionDefinition/provenance interfaces where an exact optional reference is needed;
- shared idempotency;
- sanctioned professional audit/event seam;
- shared transaction seam.

### 5.3 Knowledge is not Intervention authority

No implication is legal:

~~~text
Knowledge PUBLISHED
!= InterventionDefinition PUBLISHED
!= Intervention eligible
!= Plan active
~~~

And:

~~~text
InterventionDefinition PUBLISHED
!= Knowledge REVIEWED/PUBLISHED
~~~

An optional Knowledge → InterventionDefinition link must contain exact definition id + exact definition version. It is explanatory/provenance linkage only.

## 6. Minimal Domain Model

### 6.1 Knowledge Item identity

A logical item has:
- knowledge_item_id: stable UUID;
- stable knowledge_key/code within the professional scene namespace;
- scene_id;
- created actor/time;
- no mutable latest-version authority.

No family_id/case_id appears in professional Knowledge identity.

### 6.2 Knowledge Version

Each version has:
- knowledge_version_id;
- knowledge_item_id;
- explicit version;
- revision for pre-publication CAS;
- status: DRAFT / REVIEWED / PUBLISHED / RETIRED;
- content body;
- locale/language;
- semantic category;
- typed stage scope;
- typed age/development scope;
- typed applicability conditions;
- typed exclusion conditions;
- typed risk scope;
- draft_origin: HUMAN or AI_ASSISTED;
- optional exact InterventionDefinition reference;
- content/professional-metadata hash;
- supersedes_version_id where applicable;
- created/updated timestamps as technical metadata.

SYSTEM_IMPORT is intentionally not introduced in Slice 17 because bulk/source ingestion is negative scope. If a future import pipeline is approved, its provenance vocabulary is a later decision.

### 6.3 Professional source provenance snapshot

Do not create a generic document/source platform.

Each exact Knowledge version has one or more immutable source-reference snapshots containing, where available:
- stable source_key/reference;
- source_type;
- title;
- author;
- publisher;
- source version/date;
- external identifier/reference;
- access/review context;
- rights/status code where material;
- verification_state;
- reviewer-visible provenance note/reference;
- source fingerprint or equivalent exact identity when available.

Publication requires every required source reference to be verifiable under the approved professional review rules. UNVERIFIED/unknown/missing required source provenance blocks publication.

If Slice 16 exposes an authoritative reusable source-reference identity, Slice 17 references that exact ID and snapshots only the metadata needed to prove what the Knowledge reviewer saw. It does not convert a Slice 16 source ref into a Knowledge Item.

No raw PDF/full copyrighted source body is stored.

### 6.4 Review record

Review decisions are append-only records:
- knowledge_version_id;
- reviewed revision;
- reviewed professional hash;
- decision APPROVE / REJECT;
- reviewer actor;
- reviewer authority reference/role;
- reviewed_at;
- source refs reviewed;
- reason codes/note reference as bounded metadata.

The REVIEWED state is valid only when the current version revision/hash exactly matches the latest valid APPROVE decision.

### 6.5 Package inclusion contribution

A package inclusion is not a package registry. It contains only:
- exact authoritative scene/package identity;
- exact package revision/version stamp supplied by the true package owner;
- exact knowledge_version_id;
- inclusion decision actor/time;
- immutable binding identity.

It never creates or renames a Scene/package, never defines topology, and never resolves latest.

The preferred integration is a contribution command/port owned by the existing Scene Package authority. A subordinate Slice 17 inclusion relation is allowed only if that authority explicitly delegates the storage and still supplies the authoritative package identity/revision.

## 7. Persistence Strategy — Minimal Correct Structure

The target physical model is five narrow relations unless T1702 proves an already-merged owner can satisfy one or more without duplication:

1. professional_knowledge_items — stable logical identity only;
2. professional_knowledge_versions — content, lifecycle, revision, typed filter metadata and successor chain;
3. knowledge_version_source_refs — immutable provenance snapshot per version;
4. knowledge_reviews — immutable review/rejection provenance per exact revision/hash;
5. knowledge_package_inclusions — only if delegated by the real Scene Package owner; exact immutable contribution rows, never package identity truth.

No separate:
- knowledge_idempotency table;
- knowledge_audit ledger;
- knowledge package registry;
- source-document store;
- chunk/embedding tables.

Why review/source/inclusion are separate:
- review history must survive stale approval and rejection;
- source provenance may be one-to-many and independently queryable for source correction impact;
- package inclusion must be immutable and independently constrained against exact package identity;
- combining all three into one JSON blob would weaken atomicity, history and query boundaries.

## 8. Structured Filtering Metadata

Future retrieval must be able to hard-filter without interpreting prose.

Normalize or strongly type:
- scene_id;
- exact package identity via inclusion;
- lifecycle status;
- locale;
- semantic category;
- stage scope mode + stage codes;
- age/development scope mode + approved codes;
- risk scope mode + approved risk/policy codes.

Use bounded JSON only for variable predicate lists:
- applicability_conditions;
- exclusion_conditions.

A predicate entry is not a generic rules DSL. It must reference an already-approved Scene/package predicate code and contain only bounded comparison/value data supported by that owner. Arbitrary executable expressions and natural-language predicates are forbidden.

If the existing package authority has no approved predicate vocabulary for a required condition, the item cannot claim that condition is machine-filterable and cannot publish until the authoritative seam exists.

## 9. UNKNOWN / Missing / N/A / Explicit-All Semantics

Scope metadata uses explicit modes:

~~~text
VALUES          exact listed approved values
ALL             explicit all recognized values for that dimension
NOT_APPLICABLE  dimension intentionally does not apply
~~~

Missing database field is MISSING and is invalid for required publishable metadata. It is never converted to ALL.

Evaluation-time context distinguishes:

~~~text
KNOWN(value)
UNKNOWN
MISSING
NOT_APPLICABLE
~~~

Rules:
- VALUES + UNKNOWN/MISSING => no eligibility;
- VALUES + KNOWN(nonmatch) => no eligibility;
- VALUES + KNOWN(match) => dimension passes;
- ALL is an explicit professional decision, not a missing-value fallback;
- NOT_APPLICABLE is an explicit reviewed decision, not a wildcard inferred from absence;
- applicability condition UNKNOWN/MISSING => fail closed;
- exclusion condition UNKNOWN/MISSING => fail closed when the exclusion cannot safely be ruled out under the approved predicate contract;
- no item can publish with a required filter field merely absent.

## 10. Lifecycle State Machine

Frozen states:

~~~text
DRAFT
→ REVIEWED
→ PUBLISHED
→ RETIRED
~~~

Legal operations:

| Current | Operation | Result |
|---|---|---|
| DRAFT | edit same unreleased version with expected revision | DRAFT, revision + 1 |
| DRAFT | real review APPROVE exact revision/hash | REVIEWED |
| DRAFT | real review REJECT | DRAFT; append rejection, no approval |
| REVIEWED | substantive edit/source/scope change before publish | DRAFT, revision + 1; old approval becomes historical/stale |
| REVIEWED | publish exact reviewed revision with exact package contribution | PUBLISHED |
| PUBLISHED | retire | RETIRED |
| PUBLISHED | create substantive correction/successor | predecessor unchanged; new DRAFT version |
| RETIRED | create successor | predecessor remains RETIRED; new DRAFT version |

Illegal:
- DRAFT → PUBLISHED;
- REVIEWED → production-selectable without publication;
- PUBLISHED in-place content/source/filter/package-scope edit;
- PUBLISHED → DRAFT/REVIEWED;
- RETIRED → PUBLISHED on same version;
- RETIRED in-place semantic edit;
- any transition with stale revision/hash;
- any approval/publish by AI, developer flag, family actor or unauthorized account.

A source withdrawal or material reinterpretation never rewrites a published version. It causes retirement and/or a successor version according to the reviewed professional decision.

## 11. Versioning and Corrections

Version and revision are distinct:
- version identifies the professional semantic release candidate across history;
- revision is pre-publication optimistic concurrency for the same unreleased version.

Before publication:
- draft edits may increment revision;
- editing a REVIEWED revision invalidates review and returns status to DRAFT.

After publication:
- substantive changes create a successor version;
- old published/retired content, review and source snapshots are immutable;
- package scope change is substantive and therefore requires a successor Knowledge version plus a separately authorized package decision.

No updated_at value substitutes for semantic version identity.

## 12. Scene Package / Knowledge Set Ownership

This is a hard architecture gate.

Current main owns DIGITAL_USE/v1 identity and case runtime anchoring, but does not expose a package registry or immutable knowledge-set snapshot owner. Slice 17 therefore does not assume permission to append knowledge to v1.

At T1701/T1702 the developer must establish exactly one of these valid states:

A. Existing Scene Package authority exposes an exact, versioned contribution/freeze seam. Slice 17 calls that seam in the same transaction as publication.

B. Existing Scene Package authority explicitly delegates an immutable package→knowledge inclusion substructure to Slice 17. The delegated rows carry the authoritative package identity/revision but do not create package identity/topology.

Anything else is STOP.

Rules:
- no second scene_packages table;
- no second node manifest/router;
- no latest package;
- no mutable historical package snapshot;
- a frozen package version/revision cannot have its included Knowledge set silently appended/removed;
- changing the package set requires the package owner’s formally valid successor package/version/revision semantics;
- publication fails if the package owner cannot atomically prove the target inclusion;
- historical package snapshots remain exactly reconstructable.

## 13. Professional Reviewer / Publisher Authority

Review and publication require real accountable authenticated actors.

T1701 must locate the approved professional-content authority seam. It may expose one or multiple capabilities such as:
- create/edit professional draft;
- review professional content;
- publish professional content;
- retire professional content.

This Plan does not invent role names or separation-of-duties rules. The same human may hold multiple approved capabilities only if the authoritative seam says so.

Never accept:
- caller-supplied role string as authority;
- family manager status;
- developer identity by convention;
- test fixture identity in production;
- AI/model identity;
- hard-coded admin boolean;
- new generic RBAC/staff marketplace created by Slice 17.

Absent real authority => T1701 STOP.

## 14. Authorization and RLS

### 14.1 Professional asset mutation

Professional Knowledge is not family-scoped data. Do not force it through family RLS using a fake family_id.

Mutation must:
1. authenticate real actor;
2. resolve the existing professional-content capability from the authority proven at T1701;
3. use the same authoritative authorize/policy seam;
4. enter the sanctioned professional-asset database context/grant path supplied by that seam;
5. mutate only the professional Knowledge owner.

If the merged upstream system has no sanctioned professional-asset DB authorization/RLS/grant seam, implementation remains blocked. Slice 17 must not create a second auth system.

### 14.2 Published professional reads

Published Knowledge contains no family private data. Read access may use the professional asset read policy established by the same authority.

### 14.3 Case-scoped consumption

A future family/case consumer must first:
- authenticate actor;
- resolve family/case/purpose via existing Authorization;
- establish existing Family RLS context;
- check applicable Consent;
- check Compliance;
- check Safety;
- then evaluate published Knowledge scope.

Knowledge labels never grant minor/legal processing rights.

## 15. Deterministic Production Eligibility

This Slice provides an internal typed deterministic capability, not a retrieval endpoint.

Logical evaluation order:

1. caller authority/purpose is valid for the requested consumption context;
2. exact knowledge item/version exists under allowed disclosure rules;
3. status is PUBLISHED and not RETIRED;
4. exact package contribution exists for the authoritative scene/package revision;
5. scene matches;
6. stage matches;
7. age/development scope matches under explicit scope semantics;
8. applicability conditions are satisfied by approved structured context;
9. no exclusion condition matches and unresolved exclusion is handled fail-closed;
10. risk scope is compatible with the approved current context;
11. optional InterventionDefinition reference, if present, is only checked for reference integrity; Knowledge never grants intervention eligibility;
12. case-scoped use independently passes Authorization/Consent/Compliance/Safety;
13. return bounded typed result.

No model, RAG, embedding or network AI call is permitted.

### 15.1 Typed result

The internal result must contain at least:
- eligible boolean;
- exact knowledge_item_id;
- exact knowledge_version_id/version/revision;
- status;
- exact scene/package identity and binding stamp;
- stage/age/risk scope evaluation;
- applicability unresolved/mismatch reasons;
- exclusion hits/unresolved reasons;
- source provenance refs;
- optional exact InterventionDefinition ref;
- Authorization/Consent/Compliance/Safety blocker summary when case-scoped;
- reason_codes;
- evaluated_at and revision/control stamps sufficient for future revalidation.

This result is not a recommendation, not a Plan, and not a retrieved answer.

## 16. Failure and Anti-Enumeration Contract

Internal reason vocabulary must distinguish at least:

~~~text
UNKNOWN_ITEM
UNKNOWN_VERSION
DRAFT_NOT_ELIGIBLE
REVIEW_REQUIRED
NOT_PUBLISHED
RETIRED
SOURCE_UNVERIFIED
WRONG_SCENE
WRONG_PACKAGE
WRONG_STAGE
AGE_SCOPE_MISMATCH
APPLICABILITY_UNKNOWN
APPLICABILITY_MISMATCH
EXCLUSION_MATCHED
EXCLUSION_UNKNOWN
RISK_SCOPE_MISMATCH
UNAUTHORIZED
CONSENT_BLOCKED
COMPLIANCE_BLOCKED
SAFETY_BLOCKED
STALE_REVISION
IDEMPOTENCY_PAYLOAD_MISMATCH
INFRASTRUCTURE_ERROR
~~~

External disclosure is bounded:
- Slice 17 adds no public family retrieval/search endpoint.
- Any item-specific external/internal HTTP adapter authenticates before existence disclosure.
- Unauthorized/unknown/lifecycle/package mismatch results collapse to the existing non-enumerating not-found/unavailable envelope where the caller is not entitled to know existence.
- Internal services and audit may retain exact reason codes.
- Reviewer identity/internal source review notes are never exposed to unauthorized family callers.

## 17. Shared Idempotency

Reuse existing idempotency_keys owner and canonical request hashing. Extend only its approved command vocabulary.

Mutating command identities required by this Slice:
- KNOWLEDGE_DRAFT_CREATE;
- KNOWLEDGE_DRAFT_EDIT;
- KNOWLEDGE_REVIEW_DECIDE;
- KNOWLEDGE_PUBLISH;
- KNOWLEDGE_RETIRE;
- KNOWLEDGE_SUCCESSOR_CREATE.

Package inclusion is a sub-effect of KNOWLEDGE_PUBLISH, not a second independently committable truth.

Rules:
- actor + command type + idempotency key scope;
- same key + same canonical semantic payload => exact replay;
- same key + different semantic payload => conflict;
- replay still performs the currently required authorization needed to disclose the stored outcome;
- no idempotency success may commit if business mutation rolls back.

## 18. Concurrency

Every mutating command carries expected revision or equivalent CAS.

Required race semantics:
- two draft editors: one revision winner;
- two reviewers on same revision: at most one current approval transition; the other is stale;
- review vs draft edit: serialization/CAS prevents stale approval;
- publish vs edit: stale side loses; published semantic content cannot change;
- two publishers: at most one authoritative publication effect for the same version/package binding;
- publish vs retire: no state can be simultaneously eligible-for-new-use and retired;
- retire vs successor creation: operations serialize on predecessor identity; coherent final state may be RETIRED predecessor + one successor DRAFT, but no duplicate successor/resurrection;
- package contribution races serialize under the true package owner;
- stale package revision cannot receive a new inclusion.

Last-write-wins is forbidden.

## 19. Atomicity and Timeout / Outcome Unknown

A successful lifecycle command is one logical transaction across:
- Knowledge item/version state;
- source provenance snapshot as applicable;
- review provenance as applicable;
- package contribution for publish;
- shared idempotency settlement;
- sanctioned business audit event.

Forbidden partial states:
- PUBLISHED without exact valid review provenance;
- PUBLISHED without exact package contribution;
- PUBLISHED while audit says failure or audit missing when required;
- idempotency success without business commit;
- review state without review record;
- RETIRED state without audit.

Use one caller-owned same-database transaction and one checked-out connection. No nested independent transaction.

Technical timeout is outcome-unknown:
1. after timeout/reconnect, read shared idempotency by same actor/command/key;
2. exact hash + stored result => authoritative committed replay;
3. no record => command did not atomically settle; retry with the same key when dependencies are available;
4. idempotency read unavailable => remain OUTCOME_UNKNOWN; do not claim success/failure;
5. retry never creates duplicate publish/retire/audit.

Tests must cover commit-succeeded-but-response-lost and commit-did-not-succeed timeout paths.

## 20. Audit / Observability

Do not create a private knowledge_audit table merely because current business_audit_events is family-scoped.

T1701 must prove a sanctioned professional-asset audit owner, expected to come from merged Slice 16 or another approved shared owner. If none exists, STOP.

Authoritative audit events must cover:
- draft created;
- draft edited;
- review approved/rejected;
- reviewed content invalidated;
- published;
- retired;
- successor version created;
- package inclusion decision;
- source correction/withdrawal handling.

Audit metadata is bounded:
- actor;
- exact item/version/revision/hash;
- transition/reason;
- source ref IDs;
- package identity/revision;
- idempotency/request/correlation ID;
- time.

Do not log family narratives, credentials, full copyrighted source text or unrestricted reviewer notes.

Denied/failed attempts may use existing request telemetry but must not masquerade as committed business events.

## 21. Source Correction / Retirement Evolution

Professional source correction flow:
- identify affected versions by immutable source_key/reference;
- do not mutate published source snapshot;
- determine through real reviewer whether current Knowledge version must retire;
- create successor DRAFT when substantive content/source/scope changes;
- fresh review;
- fresh package publication through true package owner.

Source WITHDRAWN or knowledge RETIRED blocks future production eligibility immediately according to authoritative current state. Historical citations remain exact.

This Slice does not implement future RAG cache/index invalidation; it only exposes exact lifecycle truth that future consumers must re-check.

## 22. AI-Assisted Draft Boundary

AI-assisted text is allowed only as untrusted DRAFT provenance.

Slice 17 itself does not call a model and does not build an AI task.

A future supervised AI draft creator may submit:
- draft_origin = AI_ASSISTED;
- external draft provenance reference approved by its future owner.

It may not:
- review;
- approve;
- publish;
- retire;
- set source verification;
- set package authority;
- bypass lifecycle.

No test fixture can be promoted to production approval.

## 23. Migration Plan

No migration number is reserved now.

At implementation start:

~~~text
IF merged authoritative schema already satisfies Frozen Spec:
    NO MIGRATION
ELSE:
    allocate only then-next safe migration number after T1701/T1702
~~~

Never:
- edit a historical migration;
- pre-reserve 016 or any number;
- reuse occupied migration number;
- use drizzle-kit push as production migration;
- copy upstream owner tables.

Current planning baseline has no Knowledge owner, so a migration is likely, but that is not authorization to allocate it now.

## 24. Expected Module Strategy

T1702 freezes exact paths against then-current main. Expected narrow areas if architecture remains stable:
- packages/domain/** or the merged Slice 16 professional-asset package for Knowledge domain/repository;
- packages/scenes/digital-use/** only for exact package contribution adapter/types when sanctioned; node-manifest.ts and routing.ts remain read-only topology truth;
- packages/authorization/** only if extending the existing authorized action vocabulary to an already-real professional authority;
- apps/server/api/** only for narrow application adapters; no generic CMS/admin surface;
- db/schema/** and one reviewed migration only if required;
- tests/domain/**, tests/db/**, tests/integration/**, tests/architecture/**;
- scripts/guard-static.mjs for non-vacuous scope/ownership guards.

No apps/operations UI is required by this Slice.

## 25. Testing Contract

### 25.1 Domain tests

Cover:
- stable identity/version/revision;
- draft origin;
- complete/incomplete publishable metadata;
- source verification;
- legal and illegal lifecycle transitions;
- review staleness;
- published immutability;
- successor version;
- retired non-reactivation;
- scope modes and UNKNOWN/MISSING/N/A/ALL;
- applicability/exclusion/risk filtering;
- exact package binding;
- typed eligibility;
- no-model determinism.

### 25.2 DB / integration tests

Cover:
- fresh schema and upgrade;
- constraints/grants/RLS or sanctioned professional DB context;
- reviewer/publisher authorization;
- family actor denial;
- shared idempotency;
- concurrent transitions;
- transaction rollback;
- package contribution atomicity;
- historical package snapshot;
- source correction impact lookup;
- audit persistence;
- case-scoped Authorization/Consent/Compliance/Safety composition.

### 25.3 Negative tests

Mechanically prove no:
- embedding/chunk/vector/lexical/RAG;
- retrieval/search/ranker;
- AI Task/Context/Registry/Jev/Promptfoo;
- AI roleplay/execution support;
- Phase 4 truth;
- generic CMS/RBAC/workflow/rule engine;
- duplicate InterventionDefinition lifecycle;
- duplicate Case/Evidence/Formulation/Family Memory;
- duplicate Authorization/Consent/Compliance/Safety;
- alternate Manifest/router/package registry;
- raw source archive/copyrighted full text;
- family-private automatic Knowledge generation;
- AI-approved production content;
- floating latest.

### 25.4 Reliability / fault tests

Inject failure after:
- item/version insert;
- source snapshot write;
- review record/state transition;
- package contribution;
- audit write boundary;
- before idempotency settlement;
- transaction commit response loss.

Assert zero partial truth and authoritative readback behavior.

## 26. Exact-Head Verification Contract

Final Developer head must prove on the same exact SHA:
- typecheck PASS;
- static guard + non-vacuous guard self-test PASS;
- focused Slice 17 domain tests PASS;
- DB/integration/control-plane tests PASS;
- migration fresh/upgrade + historical migration integrity PASS if migration exists;
- grants/RLS/professional-asset DB authorization proof PASS;
- OpenAPI/contracts PASS only if a new server surface exists;
- existing Case/Evidence/Formulation/Safety/Compliance/Scene regression PASS;
- Slice 16 professional-owner regression PASS;
- FR 40/40, AS 41/41, NS 18/18 evidence;
- exact base/head/merge-base/ahead/behind;
- Docs/Frozen Spec mutation 0;
- AI/RAG/Phase4 forbidden scope 0.

Any commit after evidence collection invalidates exact-head evidence.

## 27. Functional Requirement Traceability

| FR | Plan section | Primary tasks | Test/evidence |
|---|---|---|---|
| FR-001 | §5–§7 | T1702,T1704,T1723 | single-owner schema/import guard |
| FR-002 | §6/§11 | T1703,T1704,T1706 | identity/version/immutability tests |
| FR-003 | §6–§9 | T1703,T1705,T1711 | publishable metadata/schema tests |
| FR-004 | §8–§9 | T1711,T1712 | missing-is-not-wildcard truth table |
| FR-005 | §6.3/§21 | T1705,T1710 | source verification/correction tests |
| FR-006 | §5/§6.3 | T1705,T1722 | privacy/static negative tests |
| FR-007 | §10/§15 | T1706,T1712 | DRAFT excluded test |
| FR-008 | §6.4/§13 | T1707,T1708 | real reviewer provenance test |
| FR-009 | §10/§15 | T1706,T1712 | REVIEWED excluded test |
| FR-010 | §10/§11 | T1706,T1710 | reviewed-edit invalidation test |
| FR-011 | §10/§19 | T1708,T1719 | publish precondition/atomicity tests |
| FR-012 | §12 | T1709,T1720 | exact package inclusion/no-latest test |
| FR-013 | §15 | T1712,T1721 | exact published-scope eligibility test |
| FR-014 | §8/§15 | T1711,T1712 | stage/age/applicability/exclusion/risk matrix |
| FR-015 | §10/§21 | T1706,T1712 | retired excluded/history test |
| FR-016 | §10–§11 | T1706,T1708 | same-version reactivation rejection |
| FR-017 | §10–§11 | T1706,T1710 | published immutability/successor test |
| FR-018 | §12 | T1709,T1720,T1723 | package history + no-registry guard |
| FR-019 | §5.3/§15 | T1714,T1722 | exact optional cross-reference independence |
| FR-020 | §5.3/§15 | T1714,T1722 | Intervention eligibility non-authority test |
| FR-021 | §13–§14 | T1707,T1713 | professional mutation auth test |
| FR-022 | §14–§15 | T1713,T1721 | actor/family/case/purpose authorization |
| FR-023 | §16 | T1715,T1721 | anti-enumeration response matrix |
| FR-024 | §14–§15 | T1713,T1722 | Consent owner/no-mutation test |
| FR-025 | §14–§15 | T1713,T1721 | Compliance/age fail-closed test |
| FR-026 | §15 | T1713,T1721 | Safety/exclusion non-override test |
| FR-027 | §22 | T1703,T1708,T1722 | AI draft never approves/publishes |
| FR-028 | §17 | T1708,T1717 | exact replay/mismatch tests |
| FR-029 | §18 | T1706,T1708,T1717 | CAS/race tests |
| FR-030 | §19–§20 | T1708,T1709,T1716,T1717 | atomic publish/audit/idempotency tests |
| FR-031 | §19 | T1717 | rollback + timeout/readback tests |
| FR-032 | §16/§20 | T1716 | bounded audit/result privacy tests |
| FR-033 | §21 | T1710,T1712 | source/Knowledge retirement tests |
| FR-034 | §2/§25 | T1722,T1723 | forbidden platform/schema/import guard |
| FR-035 | §15/§22/§25 | T1718,T1722 | no-model deterministic acceptance |
| FR-036 | §12/§15 | T1709,T1712 | wrong/unknown package no fallback |
| FR-037 | §15 | T1712,T1720 | empty-set truthful unavailable test |
| FR-038 | §5/§6.3 | T1705,T1722 | no Evidence/Formulation duplicate store |
| FR-039 | §15/§21 | T1712,T1721 | stale candidate draft/retired rejection |
| FR-040 | §4 | T1701 | read-only implement gate proof |

Functional Requirement coverage planned: **40/40**.

## 28. Acceptance Scenario Traceability

| AS | Primary tasks | Verification |
|---|---|---|
| AS-001 | T1708,T1719 | authorized complete draft remains nonproduction |
| AS-002 | T1708,T1718 | publish-without-review rejected |
| AS-003 | T1707,T1708,T1719 | exact real review provenance |
| AS-004 | T1707,T1713,T1721 | family admin review denied |
| AS-005 | T1707,T1722 | AI/fake reviewer rejected |
| AS-006 | T1706,T1712,T1718 | REVIEWED still nonproduction |
| AS-007 | T1708,T1709,T1719 | exact publish + package contribution |
| AS-008 | T1711,T1712,T1721 | full matching eligibility exact version |
| AS-009 | T1711,T1712 | wrong scene/stage no fallback |
| AS-010 | T1711,T1712 | age mismatch fail closed |
| AS-011 | T1711,T1712 | missing/UNKNOWN condition fail closed |
| AS-012 | T1711,T1712,T1713 | exclusion/risk block |
| AS-013 | T1709,T1712 | wrong package/latest rejected |
| AS-014 | T1712,T1715 | unknown item/version bounded result |
| AS-015 | T1706,T1712 | retired excluded |
| AS-016 | T1706,T1710,T1719 | retirement history preserved |
| AS-017 | T1706,T1710 | published edit creates successor draft |
| AS-018 | T1706,T1710 | reviewed metadata edit invalidates review |
| AS-019 | T1705,T1710 | source correction creates reviewed successor path |
| AS-020 | T1705,T1708 | unverifiable source prevents publication |
| AS-021 | T1708,T1717 | idempotent exact replay |
| AS-022 | T1708,T1717 | same key/different payload conflict |
| AS-023 | T1717 | concurrent review/publish authoritative convergence |
| AS-024 | T1706,T1717 | stale revision rejected |
| AS-025 | T1717 | partial transaction rollback |
| AS-026 | T1717 | timeout authoritative readback |
| AS-027 | T1707,T1715,T1721 | wrong actor + no existence leak |
| AS-028 | T1713,T1721 | wrong family/case denied |
| AS-029 | T1713,T1721 | Consent withdrawal blocks future consumption |
| AS-030 | T1713,T1721 | Compliance blocks despite content label |
| AS-031 | T1713,T1721 | Safety Hold blocks ordinary use |
| AS-032 | T1707,T1722 | AI draft cannot review/publish |
| AS-033 | T1722 | RAG candidate cannot promote authority |
| AS-034 | T1714,T1722 | Knowledge cannot pass Slice 16 eligibility |
| AS-035 | T1701,T1705,T1707,T1722 | missing reviewer/source remains NOT READY |
| AS-036 | T1709,T1720 | historical package snapshot unchanged |
| AS-037 | T1705,T1721,T1722 | cross-tenant family facts rejected |
| AS-038 | T1712,T1720 | empty published set truthful |
| AS-039 | T1714,T1722 | source ref does not create Knowledge Item |
| AS-040 | T1712,T1722 | unpublished excluded despite stale future cache hit |
| AS-041 | T1702,T1723,T1725 | existing owners/topology unchanged |

Acceptance Scenario coverage planned: **41/41**.

## 29. Negative Scope Traceability

| NS | Primary tasks | Mechanical proof |
|---|---|---|
| NS-01 | T1722,T1723,T1725 | no embedding/pgvector schema/import/call |
| NS-02 | T1722,T1723,T1725 | no retrieval/search/ranking/RAG |
| NS-03 | T1705,T1722,T1723 | no chunk/parser/source-ingestion pipeline |
| NS-04 | T1722,T1723 | no CMS/expert marketplace/RBAC/workflow platform |
| NS-05 | T1714,T1722,T1723 | no InterventionDefinition lifecycle/gate/Instance duplicate |
| NS-06 | T1722,T1723 | no AI Task/Context/Registry/provider/agent |
| NS-07 | T1722,T1723 | no Jev/Promptfoo runtime |
| NS-08 | T1722,T1723 | no A4003/Formulation/execution AI |
| NS-09 | T1722,T1723,T1725 | no Phase 4 truth |
| NS-10 | T1702,T1722,T1723 | no Case/Evidence/Formulation/Family Memory duplicate |
| NS-11 | T1713,T1722,T1723 | no Auth/Consent/Compliance/Safety duplicate |
| NS-12 | T1709,T1722,T1723 | no alternate Manifest/routing/package registry |
| NS-13 | T1705,T1722,T1723 | no raw source archive/full-text redistribution |
| NS-14 | T1705,T1722 | no automatic family-private Knowledge generation |
| NS-15 | T1707,T1722 | no unreviewed/AI-approved production content |
| NS-16 | T1706,T1709,T1722 | no floating latest/silent published overwrite |
| NS-17 | T1701,T1725 | no Docs/Frozen Slice 12–16 mutation |
| NS-18 | T1722,T1725 | no claim of RAG/production AI release |

Negative Scope coverage planned: **18/18**.

## 30. Planning Decisions Frozen by Plan AI 2

1. Knowledge lifecycle remains independent from Slice 16 Intervention lifecycle.
2. Minimal persistence is item + version + source snapshot + review record + delegated inclusion, not a generic CMS.
3. Key hard-filter dimensions are normalized/typed; variable conditions use bounded approved predicate references, not prose and not a generic rule DSL.
4. Missing, UNKNOWN, NOT_APPLICABLE and explicit ALL remain distinct.
5. Package contribution must go through the real Scene Package authority; no mutable second registry.
6. Review/publish authority must be real; current absence blocks implementation.
7. Shared idempotency and one transaction are mandatory.
8. Technical timeout resolves through authoritative idempotency readback.
9. No migration number is preallocated.
10. No AI/RAG/embedding/chunk/Phase 4 implementation enters Slice 17.

~~~text
Open Product Decisions: 0
Open Planning Decisions: 0
Scope Drift: 0
~~~

## 31. Stop Boundary

After Plan/Checklist/Tasks/Audit 1/Planning Freeze, Plan AI 2 stops.

No production code, schema, migration, implementation tests, implementation PR, Audit 2 or merge is authorized by this plan.
