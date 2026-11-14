# Slice 17 Implementation Plan — Professional Knowledge Foundation

**Role**: Slice 17 Plan AI 2  
**Repository**: pyxm1618/xiaoshuyin  
**Planning branch**: spec/017-professional-knowledge-foundation  
**Frozen Spec commit**: a345937868ca1b8d2cef65003d4197de4207eb52  
**Frozen Spec blob**: 866c3f77dd269c94d420d9c0ae6b918f114286ce  
**Execution context**: REMOTE-ONLY  
**Planning status**: COMPLETE / Audit 1 PASS  
**Development status**: BLOCKED; T1701 is the only permitted first development action and is read-only.

## 1. Authority and Frozen Input Verification

Remote truth re-read before planning:

| Input | Planning-time truth | Result |
|---|---|---|
| origin/main | 17e81b2badfd5a706e15867e2faf504d88a72364 | PASS |
| Planning branch before Plan | a345937868ca1b8d2cef65003d4197de4207eb52 | PASS |
| Frozen Spec commit | a345937868ca1b8d2cef65003d4197de4207eb52 | PASS |
| Frozen Spec blob | 866c3f77dd269c94d420d9c0ae6b918f114286ce | PASS |
| Branch relation before Plan | ahead 1 / behind 0 | PASS |
| Changed file before Plan | spec.md only | PASS |
| Four Authority Docs | fully read from current main | PASS |
| Slice 16 spec/plan/checklist/tasks | fully read from its planning branch | PASS |
| Current migration head | 015_digital_use_assessment_runtime.sql | OBSERVED only |
| Digital Use Scene/package identity | DIGITAL_USE / v1 | PASS |

Input Drift: NONE.

Authority order remains 总产品需求 → V1产品需求 → 总体技术架构 → V1技术设计. Frozen Spec cannot be edited by this role. Later semantic authority drift is STOP, not an implementation convenience.

## 2. Repository Owner Inventory

| Concern | Current real owner / module | Merged? | Caller-owned tx? | Slice 17 disposition |
|---|---|---:|---:|---|
| Case | packages/domain/src/cases.ts | YES | YES, PoolClient | consumer only |
| Evidence | packages/domain/src/evidence.ts + repository.ts | YES | YES | refs/facts only; no copy |
| Problem Formulation | packages/domain/src/problem-formulations.ts | YES | YES | consumer only |
| Authorization | packages/authorization/src/authorize.ts + server authz | YES | facts loaded in tx | reuse only |
| RLS transaction | apps/server/api/src/db/tx.ts | YES | YES | one checked-out client |
| Drizzle RLS seam | apps/server/api/src/db/drizzle-tx.ts | YES | YES, currently Safety-typed | reverify/generalize only if sanctioned |
| Consent | packages/compliance/src/repository.ts + supplemental-consent.ts | YES | YES | reuse only |
| Compliance | packages/compliance feature-policy repository/service | YES | YES | transaction-time decision |
| Safety | packages/domain/src/safety/* | YES | YES | independent hard gate |
| Scene Manifest / routing | packages/scenes/digital-use/node-manifest.ts / routing.ts | YES | N/A | topology authority unchanged |
| Scene/package identity | packages/scenes/digital-use/types.ts | YES | N/A | DIGITAL_USE / v1 |
| Scene runtime/state | packages/domain/src/scene-runtime-repository.ts/schema.ts | YES, Slice 12 | YES | read exact case package binding |
| Shared idempotency | packages/domain/src/idempotency.ts + apps/server/api/src/idempotency.ts | YES | YES | extend, never duplicate |
| Family/Case business audit | business_audit_events via existing domain/Safety owner | YES | YES | not sufficient for generic professional asset |
| Professional reviewer authority | no staff/reviewer/professional runtime path found; authorize has no professional capability | NO | N/A | hard gate |
| Professional non-family audit seam | current business_audit_events requires family_id NOT NULL | NOT SUFFICIENT | N/A | must use sanctioned audit-owner extension |
| Scene package knowledge-version-set contribution | package identity exists; no merged knowledge-set seam found | NO usable seam | N/A | hard gate |
| Slice 16 professional-definition runtime | planning artifacts only | NO | N/A | hard-gate input |
| Slice 13 | development branch exists, not main | NO | — | check only if concrete seam consumed |
| Slice 14 / 15 | planning branches, not main | NO | — | not automatic hard dependencies |
| Migration head | 015_digital_use_assessment_runtime.sql | YES | — | re-read at implementation |

Owner conclusions:

1. Current Scene package identity is real but there is no merged professional knowledge-set registry/contribution seam.
2. Slice 17 cannot create a second package registry. Knowledge-set inclusion must be owned by Scene Package authority.
3. Current business_audit_events is family-scoped. A generic Knowledge audit cannot fake family_id. A professional audit projection is legal only if sanctioned and owned by the existing audit authority.
4. No real professional-reviewer capability is proven on current main.
5. Slice 16 is planned, not merged; its future InterventionDefinition truth must stay logically independent from Knowledge.

## 3. Development-Start Gate

T1701 rechecks then-current remote truth before any production/schema/test edit.

Hard predicates:

- Frozen Spec/Docs integrity;
- current main and migration head;
- Slice 16 merged/usable professional-definition/provenance seam, or an authority-backed strict-independence proof allowed by Frozen Spec;
- one Scene Package knowledge-set owner/contribution seam with exact version and historical snapshot/CAS;
- real authenticated professional reviewer authority;
- explicit professional content mutation authority;
- sanctioned non-family professional audit path under existing audit owner;
- current Case/Evidence/Formulation/Authorization/RLS/Consent/Compliance/Safety owners;
- shared idempotency and one caller-owned transaction seam;
- concrete Slice 13–15 dependencies only where actually consumed.

If any hard predicate fails: STOP / DO NOT IMPLEMENT. No fabricated reviewer, package owner, audit owner, auth system or RBAC platform.

Current truth:

~~~text
Slice 16 runtime: NOT MERGED
Professional reviewer authority: ABSENT / NOT PROVEN
Package knowledge-set contribution seam: NOT MERGED
Professional non-family audit seam: NOT SUFFICIENT

Development Implement Gate: BLOCKED
Development Authorization: NOT GRANTED
~~~

## 4. Scope and Sole Truth

Slice 17 owns:

- Knowledge Item stable logical identity;
- semantic content versions;
- source provenance required for review;
- review decisions;
- DRAFT / REVIEWED / PUBLISHED / RETIRED lifecycle;
- correction/successor/retirement history;
- deterministic exact-version downstream content eligibility.

It does not own Scene Package identity/version, InterventionDefinition lifecycle/eligibility, Case, Evidence, Formulation, Authorization, Consent, Compliance, Safety, Family Memory, retrieval/RAG/AI runtime or Phase 4 truth.

Knowledge publication never makes an InterventionDefinition eligible. InterventionDefinition publication never publishes Knowledge. Optional cross-reference is exact-version metadata only.

## 5. Minimal Data Model

The minimum justified logical model is four core relations plus an exact version-source binding, while package binding remains under Scene Package authority.

### 5.1 Knowledge logical identity

A professional_knowledge_items concept contains stable knowledge_id, stable semantic subject/category identity, creator/time and no family/case/private narrative.

### 5.2 Knowledge semantic version

A professional_knowledge_versions concept contains:

- knowledge_id + exact semantic version;
- draft revision/CAS counter;
- lifecycle status exactly DRAFT / REVIEWED / PUBLISHED / RETIRED;
- body;
- language/locale;
- subject/category;
- scene scope;
- reviewed package scope;
- stage scope;
- age/development scope;
- applicability predicates;
- exclusion predicates;
- authoritative risk scope/level reference;
- draft origin provenance;
- semantic/content hash;
- supersedes lineage;
- lifecycle timestamps/revisions.

Draft revision is not semantic version. DRAFT may be edited with CAS. Review binds exact revision/hash. A substantive REVIEWED edit invalidates review and returns nonproduction DRAFT. PUBLISHED/RETIRED semantic payload is immutable; correction creates successor version.

### 5.3 Professional source refs

A professional_source_refs concept is a narrow provenance owner, not a document system:

- source_ref_id;
- source type;
- title/author/publisher where available;
- identifier/reference;
- source version/date where available;
- access/review context;
- rights/status where material;
- verification state and revision;
- withdrawal/retirement state;
- verifier actor/time/authority as required.

No raw PDF, source body, OCR, crawler payload, parser output or proprietary redistribution.

### 5.4 Version-to-source binding

An exact knowledge_version_source_refs relation binds Knowledge version to exact source identity/revision used in review. This supports multiple sources, later withdrawal and historical proof without rewriting a published Knowledge version.

### 5.5 Append-only review record

A professional_knowledge_reviews concept records:

- exact knowledge_id/version;
- exact draft revision/content hash;
- APPROVE or REJECT;
- authenticated reviewer actor;
- server-resolved reviewer responsibility/authority ref;
- reviewed_at;
- exact source-set revision/hash;
- bounded reason.

Rejections and stale prior reviews remain history.

### 5.6 Package binding is not a Knowledge registry

The Scene Package owner must expose or own the subordinate exact binding:

scene_id + exact package_version + exact knowledge_id + exact knowledge_version + package-set revision/snapshot.

No latest alias. Historical bindings are immutable. If no authoritative seam exists, T1701 blocks.

## 6. Professional Source Semantics

A source reference is not verified merely because it exists. Publication requires verifiable material source provenance.

Source state must distinguish unverified, verified and withdrawn semantics using repository-approved labels. A withdrawn/materially invalid source blocks new use of dependent Knowledge versions while preserving old content and review history.

Source correction:

1. preserve old source identity/revision;
2. change source status through authorized provenance command;
3. resolve dependent exact Knowledge versions;
4. block affected new consumption;
5. create successor Knowledge version if content/provenance must change;
6. require fresh real review and exact package publication.

No family Evidence becomes professional source content automatically.

## 7. Hard-Filter Metadata and Missing Semantics

Normalized/typed:

- scene;
- package scope;
- stage;
- locale;
- age/development;
- risk scope/level reference;
- lifecycle status;
- source verification;
- exact source/version links.

Applicability and exclusion may be bounded structured JSON only when every predicate has an authoritative fact/condition reference, bounded operator, typed expected value/state and explicit UNKNOWN behavior. No prose condition, script or generic rule DSL.

For every publication-critical dimension:

- MISSING is invalid for publication;
- UNKNOWN is not ALL;
- NOT_APPLICABLE is legal only if schema explicitly allows it;
- ALL is an explicit reviewed value;
- unsupported predicates fail closed;
- evaluation-time missing/UNKNOWN fails closed unless exact reviewed metadata plus existing policy explicitly allow that state.

Age/development and risk reuse authoritative Compliance/Safety/package vocabularies. Slice 17 does not invent age policy or LOW/MEDIUM/HIGH thresholds. If a required authoritative vocabulary is unavailable, publication is NOT READY.

## 8. Lifecycle and Version State Machine

Frozen state machine:

~~~text
DRAFT -> REVIEWED -> PUBLISHED -> RETIRED
~~~

Legal paths:

- create DRAFT;
- edit DRAFT with expected revision;
- review REJECT -> append decision; remain/return DRAFT;
- review APPROVE current exact revision/hash -> REVIEWED;
- substantive edit REVIEWED -> DRAFT + stale prior review;
- publish REVIEWED only with complete verified metadata and exact package inclusion -> PUBLISHED;
- retire PUBLISHED -> RETIRED;
- create successor from published/retired -> new DRAFT version.

Forbidden:

- DRAFT -> PUBLISHED;
- REVIEWED production use;
- PUBLISHED in-place semantic edit;
- RETIRED -> PUBLISHED same version;
- stale review/publish;
- silent source/filter/package-scope edit;
- latest substitution.

Draft origin is typed HUMAN / AI_ASSISTED / SYSTEM_IMPORT unless a merged authoritative vocabulary supersedes labels. It is provenance only and gives no review/publish authority. No AI runtime is needed.

### Review submission semantics

Frozen Spec defines no SUBMITTED lifecycle state and this Slice must not invent a review queue/workflow truth. The authoritative lifecycle mutation is the real reviewer decision on one exact DRAFT revision/hash.

If a then-current merged professional-workflow owner already exposes a distinct review-request/submit command, Slice 17 may call that seam only as non-authoritative coordination: it must carry exact knowledge/version/revision/hash, use shared idempotency, create no professional approval, and never make content production-selectable. If no such owner exists, T1708 proceeds directly from an exact DRAFT target to the authorized review decision; Developer must not create a new SUBMITTED state, queue table or generic workflow engine.

## 9. Scene Package / Knowledge Set Ownership

Current merged authority:

- DIGITAL_USE / v1 identity: packages/scenes/digital-use/types.ts;
- Slice 11 manifest/routing: topology;
- Slice 12 scene runtime: case-bound scene_package_version;
- no merged professional knowledge-set binding owner.

Plan contract:

1. Scene Package remains sole package identity/version owner.
2. No knowledge_packages or alternate registry.
3. Publication resolves exact package identity and expected set revision.
4. First publication and exact package inclusion settle atomically.
5. Historical package snapshot is immutable/inspectable.
6. A successor Knowledge version never silently replaces an old package member.
7. Package-set change uses package owner CAS/serialization.
8. New package version, if necessary, comes from package owner, never Slice 17 invention.
9. Wrong/unknown package never falls back to nearest/latest.
10. Expanding reviewed package scope after publication is substantive; it requires a successor/fresh review unless exact scope was already reviewed.

## 10. Professional Reviewer / Mutation Authority

Capabilities, not invented role names:

- create/edit professional draft;
- review professional content;
- publish;
- retire/source-status mutate as authorized;
- read unpublished professional assets.

Review additionally requires real accountable professional responsibility. Family manager, Case owner, developer, fixture, hard-coded admin, model, import job or client-supplied role is insufficient.

Reviewer and publisher may be the same actor only if existing authoritative authorization allows both; this Plan neither invents nor removes separation-of-duties.

No generic staff/RBAC platform is authorized. Absent real merged authority means T1701 BLOCKED.

## 11. Deterministic Production Eligibility

This is hard filtering, not RAG.

For one exact knowledge_id/version and one exact package/context:

1. authenticate/authorize requested purpose;
2. resolve exact item/version;
3. require PUBLISHED and not retired;
4. verify current source refs valid for new use;
5. resolve exact package-set inclusion;
6. scene match;
7. stage match;
8. age/development match;
9. applicability predicates satisfied;
10. no exclusion;
11. risk scope compatible with authoritative policy/Safety facts;
12. for family/case use, independently evaluate current Consent, Compliance and Safety;
13. return typed deterministic result.

Result includes eligible boolean, exact Knowledge/version/revision, exact package/set revision, source refs/revisions, reason codes, filter outcomes, control-plane policy/revision refs as applicable, evaluated_at and correlation id.

Infrastructure failure is an error, not NOT_ELIGIBLE. Empty eligible set is truthful and must not trigger synthetic content.

## 12. Authorization / RLS / Control Planes

Professional asset lifecycle and family/case consumption are separate surfaces.

Professional rows are not family rows. Never set a fake family context to make RLS/audit succeed. T1701/T1702 must locate approved non-family professional principal/RLS capability.

Family/case consumption uses current Authorization + RLS context and validates actor/family/case/purpose, exact Case/Scene package, age/development facts, Consent, Compliance and Safety.

Knowledge lifecycle cannot mint/change Consent; item age labels cannot grant Compliance; Knowledge cannot clear Safety Hold or redefine risk.

## 13. Anti-enumeration

Internal reasons remain precise: UNKNOWN_ITEM, UNKNOWN_VERSION, NOT_PUBLISHED, RETIRED, WRONG_PACKAGE, WRONG_STAGE, AGE_SCOPE_MISMATCH, APPLICABILITY_UNKNOWN, EXCLUSION_MATCHED, UNAUTHORIZED, CONSENT_BLOCKED, COMPLIANCE_BLOCKED, SAFETY_BLOCKED, STALE_REVISION, INFRASTRUCTURE_FAILURE.

External family/case boundary follows existing anti-enumeration:

- unauthorized/cross-tenant protected existence is not disclosed;
- reviewer identity/internal review detail is never family-facing;
- bounded NOT_AVAILABLE/NOT_ELIGIBLE categories only when existing policy permits;
- infrastructure failure remains distinct internally.

No public browse-all professional draft endpoint is required.

## 14. Shared Idempotency

Reuse existing actor + command type + idempotency key + canonical payload hash owner.

Covered mutations:

- create item/initial version;
- edit draft;
- review decision;
- publish + package inclusion composite;
- retire;
- create successor/correction;
- source verify/update/withdraw;
- separate package inclusion only if package owner requires it.
- a distinct review-request/submit command only if an already-authoritative professional workflow owner exposes it; such coordination is non-authoritative and cannot add a lifecycle state.

Rules:

~~~text
same actor + command + key + same semantic payload
=> same authoritative result, zero duplicate side effects

same actor + command + key + changed semantic payload
=> conflict, zero business mutation
~~~

Protected replay reauthorizes disclosure. No knowledge_idempotency table.

## 15. Concurrency

Every mutable aggregate uses expected revision/CAS or equivalent serialization.

Required races:

- two draft editors;
- two reviewers;
- review vs edit;
- publish vs edit;
- two publishers/package contributors;
- publish vs retire;
- retire vs successor;
- source withdrawal vs publish;
- package binding/set change;
- stale expected revision.

At most one valid transition wins. No last-write-wins and no retired/published resurrection.

## 16. Atomicity / Timeout / Readback

A successful lifecycle command atomically settles applicable:

- item/version state;
- review/source provenance;
- exact package contribution;
- authoritative audit;
- shared idempotency success.

Use one checked-out caller-owned transaction. No nested transaction/second client.

Timeout:

- commit succeeded but response lost -> authoritative readback/idempotency replay returns one result;
- no commit/rollback plus timeout -> readback shows no success; legal replay can execute once;
- outcome unknown is never guessed;
- publish/retire retry cannot duplicate.

Fault injection must cover each persistence boundary.

## 17. Audit / Observability

Current business_audit_events requires family_id and cannot simply store generic Professional Knowledge events.

Implementation must use a sanctioned extension of existing audit authority. A separate physical professional audit projection is acceptable only if that authority owns it; it is not a Slice 17 private truth ledger.

Audit create, draft edit, review approve/reject, publish/package inclusion, retire, successor correction, source verify/withdraw with actor, exact item/version/revision, source refs, package identity, before/after status, reason, correlation id and time.

No family narrative, credentials or full copyrighted source material in audit/logs. Denied telemetry cannot claim a lifecycle transition.

## 18. Future RAG Seam Only

Future RAG can consume exact knowledge_id/version, PUBLISHED state, exact package inclusion, typed hard-filter metadata and exact source provenance.

Slice 17 exposes no embedding, chunking, search, rank, fusion, rerank, prompt/context or answer generation.

Knowledge Item != Chunk. Future chunks must point to immutable published exact version.

Allowed future seam: Scene Package owner returns exact package-set members; caller evaluates exact versions deterministically. This is not free-text retrieval.

Exact InterventionDefinition references are metadata only. No Knowledge result grants Intervention eligibility.

## 19. Migration

Planning-time main head is 015_digital_use_assessment_runtime.sql. Slice 13 development already has a prospective 016, so Slice 17 must reserve nothing.

At T1701/T1702:

~~~text
IF then-current authoritative schema is sufficient:
    NO MIGRATION
ELSE:
    allocate then-next safe migration after re-reading main
~~~

No historical edits, occupied-number reuse, drizzle-kit push substitution or duplicate owner tables.

## 20. Implementation Surface

T1702 chooses exact paths after gate pass. Expected narrow surfaces if architecture remains:

- one approved professional domain owner under packages/**;
- packages/scenes/digital-use/** only through current Scene Package owner for knowledge-set contribution;
- db/schema, migrations, RLS only if needed;
- apps/server/api only for narrow internal/application composition;
- contracts only if a real transport surface exists;
- domain/db/integration/architecture tests;
- static guard only for non-vacuous owner/scope rules.

No generic CMS or staff platform.

## 21. Verification Strategy

Must cover:

1. lifecycle/version/source/filter domain tests;
2. real reviewer/mutation authorization;
3. DB constraints/RLS/grants/migration fresh+upgrade;
4. package binding/history and topology isolation;
5. family/case Auth/Consent/Compliance/Safety;
6. idempotency replay/mismatch;
7. race/CAS;
8. atomic rollback/fault injection;
9. commit-success-response-loss and no-commit timeout/readback;
10. anti-enumeration/privacy;
11. no-model/no-network acceptance;
12. static owner/scope guard for all forbidden platforms;
13. relevant historical owner regressions;
14. exact-head full relevant suite.

Pure unit fakes may test behavior, but a fixture cannot satisfy the production reviewer gate.

## 22. FR Traceability

| FR | Plan | Task(s) | Test/Evidence |
|---|---|---|---|
| FR-001 | §4/§5 | T1702,T1704,T1725 | single owner/schema/import guard |
| FR-002 | §5/§8 | T1703,T1704,T1706 | identity/version/CAS/immutability |
| FR-003 | §5/§7 | T1703,T1704,T1705,T1712 | publishable metadata/filter schema |
| FR-004 | §7 | T1703,T1712,T1720 | missing/UNKNOWN fails closed |
| FR-005 | §6 | T1705,T1708,T1709,T1720 | source verification/provenance |
| FR-006 | §5/§12 | T1703,T1705,T1724,T1725 | privacy/store/log guards |
| FR-007 | §8/§11 | T1703,T1708,T1712 | DRAFT negative |
| FR-008 | §8/§10 | T1707,T1708 | real reviewer exact-revision proof |
| FR-009 | §8/§11 | T1708,T1712 | REVIEWED-only negative |
| FR-010 | §8 | T1706,T1708,T1716 | review invalidation |
| FR-011 | §8/§9 | T1708,T1709 | publish preconditions |
| FR-012 | §9 | T1709,T1722 | exact package inclusion/no latest |
| FR-013 | §11 | T1712,T1713,T1719 | exact-version eligibility |
| FR-014 | §7/§11 | T1712,T1713 | scope mismatch matrix |
| FR-015 | §8 | T1710,T1712 | retirement new-use block |
| FR-016 | §8 | T1710 | no retired resurrection |
| FR-017 | §5/§8 | T1706,T1710 | published immutability/successor |
| FR-018 | §9 | T1709,T1722 | package snapshot history |
| FR-019 | §4/§18 | T1702,T1719,T1725 | Knowledge/Intervention isolation |
| FR-020 | §4/§11/§18 | T1712,T1719,T1725 | no intervention/Plan authority |
| FR-021 | §10 | T1701,T1707,T1711 | professional mutation authority |
| FR-022 | §12 | T1713 | actor/family/case/purpose auth |
| FR-023 | §13 | T1714,T1724 | anti-enumeration |
| FR-024 | §12 | T1713,T1725 | Consent unchanged/composed |
| FR-025 | §7/§12 | T1712,T1713 | Compliance/age composition |
| FR-026 | §12 | T1713,T1725 | Safety independent hard block |
| FR-027 | §5/§18 | T1703,T1707,T1725 | AI draft only/no AI authority |
| FR-028 | §14 | T1715 | shared idempotency |
| FR-029 | §15 | T1716 | CAS/race matrix |
| FR-030 | §16 | T1709,T1715,T1718,T1723 | atomic state/provenance/binding/audit/idempotency |
| FR-031 | §16 | T1717,T1723 | rollback + timeout/readback |
| FR-032 | §13/§17 | T1714,T1718,T1724 | bounded audit/reasons |
| FR-033 | §6/§8/§11 | T1705,T1710,T1712 | source/item retirement |
| FR-034 | §18/§20 | T1719,T1725 | no RAG/vector/model/Phase4 |
| FR-035 | §10/§21 | T1707,T1720,T1725 | no-model + real-review gate |
| FR-036 | §9/§11 | T1709,T1712,T1722 | wrong exact package/version no fallback |
| FR-037 | §9/§11 | T1709,T1712 | truthful empty set |
| FR-038 | §4/§6/§12 | T1705,T1724,T1725 | no Evidence/Formulation duplicate |
| FR-039 | §11/§18 | T1712,T1719,T1725 | stale candidate cannot promote |
| FR-040 | §3 | T1701,T1702 | implement gate |

Coverage: **40/40**.

## 23. Acceptance Traceability

| AS | Task(s) | Assertion |
|---|---|---|
| AS-001 | T1706,T1720 | explicit acceptance assertion |
| AS-002 | T1708,T1709,T1720 | explicit acceptance assertion |
| AS-003 | T1707,T1708,T1720 | explicit acceptance assertion |
| AS-004 | T1707,T1711,T1724 | explicit acceptance assertion |
| AS-005 | T1707,T1725 | explicit acceptance assertion |
| AS-006 | T1708,T1712,T1720 | explicit acceptance assertion |
| AS-007 | T1709,T1722 | explicit acceptance assertion |
| AS-008 | T1712,T1713,T1721 | explicit acceptance assertion |
| AS-009 | T1712,T1720 | explicit acceptance assertion |
| AS-010 | T1712,T1720 | explicit acceptance assertion |
| AS-011 | T1712,T1720 | explicit acceptance assertion |
| AS-012 | T1712,T1713,T1720 | explicit acceptance assertion |
| AS-013 | T1709,T1712,T1722 | explicit acceptance assertion |
| AS-014 | T1712,T1714 | explicit acceptance assertion |
| AS-015 | T1710,T1712 | explicit acceptance assertion |
| AS-016 | T1710,T1718,T1721 | explicit acceptance assertion |
| AS-017 | T1706,T1710,T1720 | explicit acceptance assertion |
| AS-018 | T1706,T1708,T1720 | explicit acceptance assertion |
| AS-019 | T1705,T1710,T1721 | explicit acceptance assertion |
| AS-020 | T1705,T1709,T1720 | explicit acceptance assertion |
| AS-021 | T1715,T1723 | explicit acceptance assertion |
| AS-022 | T1715,T1723 | explicit acceptance assertion |
| AS-023 | T1716,T1723 | explicit acceptance assertion |
| AS-024 | T1716,T1723 | explicit acceptance assertion |
| AS-025 | T1717,T1723 | explicit acceptance assertion |
| AS-026 | T1717,T1723 | explicit acceptance assertion |
| AS-027 | T1711,T1714,T1724 | explicit acceptance assertion |
| AS-028 | T1713,T1714,T1724 | explicit acceptance assertion |
| AS-029 | T1713,T1721 | explicit acceptance assertion |
| AS-030 | T1713,T1721 | explicit acceptance assertion |
| AS-031 | T1713,T1721 | explicit acceptance assertion |
| AS-032 | T1707,T1725 | explicit acceptance assertion |
| AS-033 | T1719,T1725 | explicit acceptance assertion |
| AS-034 | T1719,T1725 | explicit acceptance assertion |
| AS-035 | T1701,T1705,T1707,T1725 | explicit acceptance assertion |
| AS-036 | T1709,T1722 | explicit acceptance assertion |
| AS-037 | T1705,T1724 | explicit acceptance assertion |
| AS-038 | T1712,T1719 | explicit acceptance assertion |
| AS-039 | T1705,T1719,T1725 | explicit acceptance assertion |
| AS-040 | T1719,T1725 | explicit acceptance assertion |
| AS-041 | T1702,T1721,T1725 | explicit acceptance assertion |

Coverage: **41/41**.

## 24. Negative Scope Traceability

| NS | Task(s) | Mechanical proof |
|---|---|---|
| NS-01 | T1725 | no embeddings/pgvector |
| NS-02 | T1719,T1725 | no search/rank/RAG |
| NS-03 | T1705,T1725 | no chunk/parser/ingestion |
| NS-04 | T1701,T1702,T1725 | no CMS/expert/RBAC/workflow platform |
| NS-05 | T1702,T1719,T1725 | no Intervention lifecycle/gate/instance |
| NS-06 | T1719,T1725 | no AI Task/Context/model/provider/agent |
| NS-07 | T1725 | no Jev/Promptfoo runtime |
| NS-08 | T1725 | no A4003/Formulation/execution AI |
| NS-09 | T1725 | no Phase4 truth |
| NS-10 | T1702,T1725 | no Case/Evidence/Formulation/Memory duplicate |
| NS-11 | T1702,T1713,T1725 | no Auth/Consent/Compliance/Safety duplicate |
| NS-12 | T1702,T1709,T1722,T1725 | no alternate manifest/routing/package registry |
| NS-13 | T1705,T1724,T1725 | no raw source archive/copyright redistribution |
| NS-14 | T1705,T1724,T1725 | no family data auto-transformation |
| NS-15 | T1707,T1709,T1725 | no unreviewed/AI-approved production content |
| NS-16 | T1706,T1709,T1710,T1725 | no latest/silent overwrite |
| NS-17 | T1727,T1728 | Docs/Slice12-16 frozen artifacts unchanged |
| NS-18 | T1719,T1725,T1728 | no RAG/production-AI release claim |

Coverage: **18/18**.

## 25. Planning Freeze Decisions

Technical planning decisions:

1. stable item identity separate from semantic version;
2. pre-publication draft revision/CAS separate from semantic version;
3. append-only reviews bind exact revision/hash;
4. narrow source refs with exact version binding; no source document platform;
5. typed hard-filter metadata; no wildcard-by-absence;
6. package binding owned by Scene Package authority;
7. first publication + package inclusion atomic;
8. professional lifecycle auth separate from family/case use;
9. shared idempotency + caller-owned transaction + existing control planes reused;
10. current family audit is not abused; professional audit must be sanctioned under existing audit owner;
11. exact-version deterministic eligibility only;
12. no migration number reservation.

Open Product Decisions: 0.  
Open Planning Decisions: 0.  
Scope Drift: 0.

## 26. Stop Boundary

Audit 1 may remediate only plan.md, checklist.md or tasks.md. No Frozen Spec, Docs, production, migration, tests, CI, upstream artifacts or main may be modified.

Planning does not authorize development. The next role is a new Developer AI starting T1701 read-only.
