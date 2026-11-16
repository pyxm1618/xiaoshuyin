# Slice 16 — Psychological / Behavioral Intervention Contract Foundation — Authority-Reconciled Plan

> Role: Plan AI 2  
> Repository: pyxm1618/xiaoshuyin  
> Planning branch: plan/016-psychological-behavioral-intervention-contract-authority-reconciliation  
> Frozen reconciliation spec: specs/016-psychological-behavioral-intervention-contract-authority-reconciliation/spec.md  
> Frozen spec blob: 5bc22645af2008d6f774e39f57bae391fa2543c7  
> Planning baseline main: 46659c5c0a8ab1a3b322b7601722123bef8f88ce  
> Planning baseline tree: ab323a04923412f3ce4a17f857c1c4f21e0e5df7  
> Current migration head at planning freeze: db/migrations/023_digital_use_review_runtime_authority_reconciled.sql  
> Planning status: COMPLETE after checklist/tasks + Audit 1 read-back.

This Plan is a translation of the Authority Reconciliation Frozen Spec. It is not a continuation of the historical Slice 16 Plan and it does not authorize production professional content.

## 1. Planning authority and gate separation

Exact planning read-back established:

- origin/main = 46659c5c0a8ab1a3b322b7601722123bef8f88ce;
- main tree = ab323a04923412f3ce4a17f857c1c4f21e0e5df7;
- main CI run 43861277051 = SUCCESS;
- migration head = 023_digital_use_review_runtime_authority_reconciled.sql;
- reconciliation head = 0b0385f6efa07e930a09874d914453a0743cebbf;
- reconciliation spec blob = 5bc22645af2008d6f774e39f57bae391fa2543c7;
- all four Authority Doc blobs exactly equal the Frozen Spec baseline.

Input Drift classification at planning time:

~~~text
NONE
~~~

No post-freeze semantic Authority drift exists. The four gates remain separate:

~~~text
Planning Quality Gate:                expected PASS after Audit 1
Development Implement Gate:           PASS
Production Professional Approval Gate: BLOCKED
Production Publication / Release Gate: BLOCKED
~~~

Current reviewer operational state remains:

~~~text
APPROVED PROFESSIONAL REVIEWER — UNASSIGNED
~~~

Development may implement schema/domain/candidate/test-only fixtures, a narrow approval-proof consumer seam, deterministic eligibility, fail-closed production behavior, idempotency/concurrency/atomicity/audit and tests. Development must not manufacture a reviewer, qualification, approval proof, PUBLISHED state or production formal Intervention.

## 2. Non-negotiable ownership model

Four distinct truths must remain separate:

| Truth | Canonical owner | Slice 16 role |
|---|---|---|
| InterventionDefinition identity/content/version/hash/history | Slice 16 | OWNS |
| Professional Approval Authority/provenance | Shared Professional Content Approval Plane | CONSUMES / REVALIDATES |
| Scene/package publication and exact inclusion | Existing Scene/package owner | CONSUMES |
| Family/Case eligibility | Slice 16 deterministic evaluator over existing owners | OWNS RESULT, NOT INPUT TRUTHS |

Slice 16 does not create a second owner for Staff, professional qualification, Case/Phase, Evidence, Problem Formulation, Authorization, RLS, Consent, Compliance, Safety, business audit or idempotency.

The following equalities are forbidden:

~~~text
PROFESSIONAL_REVIEW capability == professional qualification
professional qualification == professional approval
definition lifecycle == professional approval lifecycle
professional approval == Scene/package inclusion
Scene/package inclusion == family/case eligibility
eligibility allowed == InterventionInstance / Plan activation
~~~

## 3. Current repository reality to reuse

The implementation must bind to then-current main. At planning freeze the authoritative inventory is:

| Capability | Current implementation reality | Plan decision |
|---|---|---|
| Case/Phase | apps/server/api/src/services/digital-use-case-lifecycle.ts and Common Core Problem Formulation service; cases.phase is canonical | READ ONLY; no shadow phase |
| Problem Formulation | apps/server/api/src/services/problem-formulations.ts + packages/domain/src/problem-formulations.ts | Consume current CONFIRMED/CURRENT version; material correction makes eligibility stale |
| Evidence | packages/domain/src/evidence.ts and existing repositories | Consume current provenance/unknown/conflict semantics; never fill missing truth |
| Scene/package binding | packages/domain/src/scene-runtime-repository.ts::getScenePackageBinding | Reuse exact case scene_package_version |
| Scene package code owner | packages/scenes/digital-use/*; node-manifest.ts is the single flow projection | Add only a package-owned intervention-inclusion consumer surface; no new registry |
| Staff Authority | db/migrations/021_safety_resolver_staff_authority.sql::staff_assignments | Reuse table and serialization principles; do not duplicate |
| Existing Staff resolver | packages/domain/src/safety/resolver-authority.ts | SAFETY_RESOLVE-specific; MUST NOT be treated as PROFESSIONAL_REVIEW resolver |
| Professional content consumer precedent | apps/server/api/src/services/digital-use-review-professional-content.ts | Reuse narrow resolve/revalidate/fail-closed pattern, not A5001/A5002 package domain |
| Production professional provider | unavailableProductionProfessionalReviewContentProvider | Confirms truthful unavailable production posture |
| Authorization | @xiaoshuyin/authorization + apps/server/api/src/authz.ts | Family/case eligibility uses existing authorize/CASE_READ semantics; Staff asset authority is separate |
| RLS/transactions | apps/server/api/src/db/tx.ts and apps/server/api/src/db/drizzle-tx.ts | One caller-owned transaction/client; no nested transaction |
| Consent | existing consent_records and @xiaoshuyin/compliance repositories/routes | Read current authoritative consent only |
| Compliance | @xiaoshuyin/compliance + evaluateComplianceAtTransactionTime / current composition | Independent gate; no approval override |
| Safety | packages/domain/src/safety/* and current Case Safety state | Independent gate; no approval override |
| Idempotency | apps/server/api/src/idempotency.ts + domain idempotency primitives | Reuse actor+command+key semantics |
| Business audit | business_audit_events / insertAuditEvent and existing specialized writers | Reuse; audit is not approval truth |
| Drizzle schema entry | db/schema/index.ts re-exports package-owned typed schemas | New typed DB projection lives in package domain, not duplicated under db/schema |
| Migration | 023 current head | Development allocates then-next safe migration only after T1601 |

Important implementation constraint: migration 021's app.set_staff_case_context() and app.staff_case_authorized() are intentionally hard-coded to SAFETY_RESOLVE and SAFETY_RESOLUTION. They are not reusable as a Professional Review context. Slice 16 may reuse staff_assignments as the Authority fact source, but must not weaken or generalize Safety-specific RLS as a shortcut.

## 4. Development architecture

### 4.1 Expected production modules

Development is expected to create or extend these bounded modules. Exact filenames are frozen enough that the Development AI should not redesign ownership; minor filename adjustments are allowed only if T1601 finds non-semantic path drift.

~~~text
packages/domain/src/intervention-definition-schema.ts
packages/domain/src/intervention-definitions.ts
packages/domain/src/intervention-definition-repository.ts
packages/domain/src/intervention-eligibility.ts
packages/domain/src/index.ts
db/schema/index.ts

packages/scenes/digital-use/intervention-definitions.ts
packages/scenes/digital-use/index.ts

apps/server/api/src/services/intervention-professional-authority.ts
apps/server/api/src/services/intervention-definitions.ts
apps/server/api/src/services/intervention-eligibility.ts
~~~

No public family-facing HTTP route is required by this foundation Slice. Candidate/version/lifecycle operations are internal service/domain commands for a future authorized Operations surface; eligibility is an internal typed service for future Phase 4 consumers. Creating a new external API contract would add an unfrozen product surface and is therefore out of scope unless then-current Authority already introduced one before development starts.

Expected future test modules are defined in tasks.md; Plan AI 2 creates none of them.

### 4.2 Logical persistence model

Development SHALL add one canonical domain table for exact InterventionDefinition versions. The physical SQL may follow existing PostgreSQL/Drizzle conventions, but the logical contract is fixed:

~~~text
intervention_definitions
- id uuidv7 primary identity
- scene_id
- intervention_code               stable logical identity
- version                         exact immutable semantic version
- content_hash                    sha256 of canonical semantic payload
- semantic contract fields        §2.7A / Frozen Spec §14
- definition_state                domain-only revision state, never approval
- supersedes_id?                  immutable predecessor link
- retired_at?                     definition-domain no-new-use marker
- created_at
~~~

Required uniqueness/integrity:

- exact id is unique;
- (scene_id, intervention_code, version) is unique;
- supersedes_id may only point to the same scene_id + intervention_code chain;
- version creation is monotonic within one logical definition chain;
- content_hash is recomputed server-side from canonical typed semantic content;
- a persisted semantic version is never edited in place;
- substantive correction creates a successor version;
- retirement/supersession preserves historical rows;
- family-specific Evidence bodies never enter this table.

The table MUST NOT have an authority-bearing approved boolean, reviewed_by_role authority, fixture marker that can be interpreted as approval, or PUBLISHED flag that can independently authorize use.

A local approvalProofRef cache/table is deliberately NOT required in the first implementation. The exact approval proof is resolved/revalidated from the shared Approval Plane at use time and is carried in the bounded resolved view, eligibility result and audit. This avoids creating a second approval source of truth. If a later Authority requires a persisted projection, that is a future additive change, not grounds for Slice 16 to invent one now.

### 4.3 Exact semantic content and hash

The canonical semantic payload contains all professional semantic fields required by the Frozen Spec:

~~~text
target_problem_or_mechanism
formulation_dependencies
supporting_evidence_requirements
applicable_conditions
exclusion_or_contraindication_conditions
age_and_development_scope
rationale
intervention_steps
participation_and_consent_requirements
baseline_and_observation
expected_observable_change
burden_and_barriers
adverse_or_worsening_signals
review_window_and_criteria
stop_reassess_safety_referral_conditions
allowed_combinations
conflicting_interventions
professional_source_refs
~~~

Hash rules:

1. validate the complete typed payload before hashing;
2. reject unknown/server-owned authority fields;
3. serialize with one canonical serializer and schema-defined field order;
4. preserve array order where the contract makes order meaningful;
5. hash exact UTF-8 canonical bytes with SHA-256;
6. never trust a client-supplied content_hash;
7. id/version are separately bound by approval and need not be used as substitutes for content hash;
8. a material source-ref change creates new semantic content/version and therefore cannot silently reuse old approval.

A resolved InterventionDefinition may expose approvalProofRef and approval validity as transient/projection fields, but those are not part of the canonical definition row and cannot make the row approved.

### 4.4 Candidate content boundary

The repository receives no developer-authored production Intervention seed. Development/tests may create minimal synthetic test definitions whose provenance is explicitly TEST_ONLY and whose semantic content exists only to exercise schema/evaluator behavior.

Production behavior with no real professional content remains:

~~~text
candidate may exist
+
approval authority unavailable
=
NOT_PROFESSIONALLY_APPROVED / PENDING_APPROVAL / UNAVAILABLE
allowed = false
~~~

A developer, migration, AI/RAG output, test fixture or environment flag cannot transition candidate content into production APPROVED/PUBLISHED truth.

## 5. Professional Authority consumer design

### 5.1 Narrow Approval Plane port

apps/server/api/src/services/intervention-professional-authority.ts SHALL define an Intervention-specific consumer port, not a generic approval platform.

Conceptual contract:

~~~ts
type InterventionApprovalQuery = {
  definitionId: string
  definitionVersion: number | string
  definitionContentHash: string
  sceneId: string
  approvalScope: string
}

type InterventionApprovalProof = {
  approvalProofRef: string
  artifactIdentity: string
  definitionId: string
  definitionVersion: number | string
  definitionContentHash: string
  sourceRefs: readonly string[]
  approvalScope: string
  reviewerIdentityRef: string
  staffAssignmentRef: string
  reviewerQualificationRef: string
  reviewerQualificationScope: string
  reviewerAuthorityStatus: 'VALID' | 'REVOKED' | 'EXPIRED' | 'UNVERIFIABLE'
  qualificationStatus: 'VALID' | 'REVOKED' | 'EXPIRED' | 'MISMATCHED' | 'UNVERIFIABLE'
  reviewStatus: 'APPROVED' | 'DRAFT' | 'REJECTED' | 'REVOKED'
  publicationStatus: 'PUBLISHED' | 'UNPUBLISHED'
  lifecycleStatus: 'CURRENT' | 'RETIRED' | 'SUPERSEDED' | 'EXPIRED'
  reviewedAt: string
  effectiveFrom: string
  effectiveTo: string | null
  publishedAt: string
}

interface InterventionProfessionalAuthorityProvider {
  resolve(query: InterventionApprovalQuery): Promise<InterventionApprovalProof | null>
  revalidate(query: InterventionApprovalQuery & { approvalProofRef: string }): Promise<InterventionApprovalProof | null>
}
~~~

The exact TypeScript names may be adjusted for repository naming consistency, but the fields and authority separation are not optional.

Validation requires exact definition id + exact version + exact content hash, matching scope/source provenance, real reviewer identity, valid Staff authority proof/reference, valid matching professional qualification proof/reference, APPROVED, PUBLISHED, current lifecycle and effective window.

### 5.2 Production provider

The default production provider SHALL be an explicit unavailable provider while APPROVED PROFESSIONAL REVIEWER — UNASSIGNED and no real qualification/Approval Plane provider exists.

No environment flag, seed, fixture or developer override may turn it into valid production proof.

Test providers must live under tests/support and must be impossible to import from production composition through architecture guards.

### 5.3 Staff Authority

Staff Authority remains staff_assignments.

Two cases must be distinguished:

1. A future Staff actor performing an InterventionDefinition asset mutation: use an identity-scoped transaction and verify that same actor's current applicable PROFESSIONAL_REVIEW authority from staff_assignments; never use household membership and never reuse the SAFETY_RESOLVE-specific app.set_staff_case_context() path.
2. A family/case eligibility request validating an already-issued approval proof: do not switch the family actor's RLS identity to the historical reviewer or bypass RLS to inspect arbitrary staff rows. The shared Approval Plane provider must return/revalidate the authoritative Staff assignment proof/reference as part of the proof.

Any new self-verifier must be bounded to PROFESSIONAL_REVIEW and current reviewer identity; it may not become a generic Staff IAM system.

### 5.4 Professional qualification

No qualification table/registry/platform is created.

A narrow ProfessionalQualificationProofProvider/reference is consumed through the professional-authority seam. Production default is unavailable until a real authoritative provider exists. Tests may inject isolated test-only proof.

Capability without qualification fails closed. Qualification without Staff authority fails closed. Both without an exact approval proof still fail closed.

## 6. Scene/package inclusion

Scene/package inclusion remains the existing package owner's truth.

packages/scenes/digital-use/intervention-definitions.ts SHALL expose a bounded exact-inclusion contract owned by the Digital Use package. It is not a registry database and it does not approve content.

Eligibility must establish:

~~~text
case's exact getScenePackageBinding()
+
exact scene identity
+
exact definition id
+
exact definition version
+
exact definition content hash
+
package-owner inclusion result
~~~

No latest/current floating selection is allowed.

Because production professional approval/release is currently blocked, the production package must not acquire a real formal Intervention inclusion merely to make tests pass. Test-only package inclusion fixtures may prove the contract. A future approved package release can populate the production inclusion owner after real approval exists.

An unapproved, unpublished, wrong-hash, retired, superseded or expired definition remains invalid even if a package fixture/reference mentions it.

## 7. Deterministic eligibility

### 7.1 Evaluation snapshot

apps/server/api/src/services/intervention-eligibility.ts composes existing owners inside one caller-owned family/RLS transaction and builds an immutable evaluation snapshot containing at least:

- authenticated actor/account/person;
- exact family/case/purpose;
- current primary/open Case id/status/phase/version;
- current authoritative Problem Formulation id/version/review state;
- required current Evidence refs/revisions/value states/conflict state;
- current age/development facts from authoritative profile/evidence;
- exact scene + scene_package_version;
- exact InterventionDefinition id/version/content_hash;
- current professional approval proof result;
- exact package inclusion result;
- current participation/Consent result;
- current Compliance result;
- current Safety result;
- any explicitly supplied exact co-considered InterventionDefinition refs for combination/conflict evaluation.

Case Phase is read-only. Later valid phases remain legal; no node.phase == cases.phase shadow gate is introduced.

### 7.2 Evaluation order

The pure domain evaluator in packages/domain/src/intervention-eligibility.ts consumes the snapshot in the Frozen Spec order:

~~~text
Authorization
→ current primary/open Case
→ current authoritative Problem Formulation
→ required Evidence
→ exact Scene/package
→ exact definition id/version/hash
→ current professional approval proof
→ APPROVED + PUBLISHED + effective/current
→ no retired/superseded/expired
→ exact package inclusion
→ age/development
→ formulation dependencies
→ supporting Evidence requirements
→ applicable conditions
→ exclusions/contraindications
→ participation requirements
→ Consent
→ combination/conflict
→ Compliance
→ Safety
→ typed bounded result
~~~

No LLM, RAG, classifier or model call appears in the hard evaluator.

### 7.3 Typed result

The result must be structured and sufficient for audit/future freshness checks:

~~~ts
type InterventionEligibilityResult = {
  allowed: boolean
  definitionId: string
  definitionVersion: number | string
  definitionContentHash: string
  sceneId: string
  scenePackageVersion: string
  approvalProofRef: string | null
  approvalStatus: string
  professionalAuthorityBlockers: readonly string[]
  missingFormulationDependencies: readonly string[]
  missingEvidenceRequirements: readonly string[]
  ageScopeResult: 'MATCH' | 'MISMATCH' | 'UNKNOWN'
  applicableConditionResult: 'MATCH' | 'NOT_MATCH' | 'UNKNOWN'
  exclusionHits: readonly string[]
  participationRequirements: readonly string[]
  consentResult: 'ALLOW' | 'BLOCK' | 'UNKNOWN'
  complianceResult: 'ALLOW' | 'BLOCK' | 'UNKNOWN'
  combinationConflicts: readonly string[]
  safetyResult: 'ALLOW' | 'BLOCK' | 'UNKNOWN'
  reasonCodes: readonly string[]
  evidenceRefs: readonly string[]
  caseRevision: number
  formulationVersion: number | string
  dependencyRevisionRefs: readonly string[]
}
~~~

The exact enums may be expanded, but UNKNOWN cannot collapse into false/safe/allowed.

allowed=true requires every required gate to be positively established. Dependency unavailable, infrastructure failure or unverified authority never becomes ALLOW.

### 7.4 Evidence / UNKNOWN rules

The evaluator reuses current Evidence/Formulation semantics. UNKNOWN, DECLINED, NOT_COLLECTED and CONFLICTING remain distinguishable.

- missing required Evidence -> allowed=false;
- conflicting material Evidence -> allowed=false;
- required formulation dependency UNKNOWN -> allowed=false unless the exact approved definition explicitly and unambiguously declares that dependency UNKNOWN-safe and current Authority permits it;
- no model fills a missing value;
- no nearest/latest definition substitutes for a missing exact one.

### 7.5 Combination boundary

Slice 16 does not create InterventionInstance. Combination/conflict evaluation operates over exact definition refs being considered in the bounded request. In the current pre-Phase-4 system there are no authoritative InterventionInstance rows to read. A future Phase 4 consumer must pass its authoritative current exact definition refs into this already-defined evaluator; Slice 16 does not pre-create the Phase 4 owner.

## 8. Authorization, RLS, Consent, Compliance and Safety composition

### 8.1 Family/Case eligibility

Eligibility is family/case scoped and begins with the existing authorization entry point, using the current CASE_READ action with FAMILY_MANAGEMENT purpose on the exact Case, unless T1601 finds a semantic Authority change (which would STOP rather than silently substitute a new action). Request IDs are untrusted parameters.

The composition must remain:

~~~text
authenticate
→ one family/RLS transaction
→ authorize actor/family/case/purpose
→ authoritative Case/Formulation/Evidence reads
→ exact professional/package reads
→ Consent
→ Compliance
→ Safety
→ pure eligibility result
→ bounded business audit
~~~

Known authorization denial is anti-enumerated according to existing policy. Infrastructure failure is not collapsed into a business denial.

### 8.2 Professional asset mutation

Professional asset mutation is not family authority. It uses a Staff identity-scoped transaction, valid PROFESSIONAL_REVIEW authority, matching qualification proof and exact operation scope. Family Manager/Guardian/ordinary Account cannot mutate professional assets.

No household app.family_id context is used as Staff authority.

### 8.3 Consent

The definition declares participation/consent requirements, but Consent truth stays with the existing Consent owner. Missing/revoked/expired/unverifiable required Consent blocks. Parent action never fabricates child Consent.

### 8.4 Compliance

Compliance remains independent. Approval does not imply Compliance. If no authoritative applicable compliance decision can be established, result is BLOCK/UNKNOWN, never ALLOW.

Slice 16 does not create Legal Authority. Where a production behavior depends on currently unassigned Legal Authority, the corresponding production path remains fail closed.

### 8.5 Safety

Current Safety state and current authoritative Safety gate are independent inputs. SAFETY_HOLD or equivalent authoritative block prevents ordinary eligibility. Slice 16 never resolves Safety, changes risk, creates Referral or substitutes its own rule asset.

## 9. Definition commands and lifecycle

Internal service commands SHALL be designed for:

- create candidate definition;
- create successor/new version;
- submit/reference a professional-review request only if an authoritative shared Approval Plane operation exists; otherwise return truthful unavailable;
- resolve/revalidate an approval proof without minting it;
- bind/check package inclusion through the package owner only;
- retire/supersede definition-domain version;
- evaluate eligibility.

No command can set APPROVED/PUBLISHED locally.

Candidate semantic correction creates a successor version rather than editing the persisted semantic row. This stronger immutable-version rule satisfies the Frozen Spec's correction/history contract and avoids ambiguous approval reuse.

Retired/superseded versions accept no new formal use but remain queryable for historical audit/provenance.

## 10. Idempotency, concurrency and atomicity

### 10.1 Idempotency

Every mutating command uses the shared actor + command_type + idempotency_key store.

Canonical payload hash includes all business-significant inputs. Where an operation consumes professional proof, the exact approvalProofRef + definition id/version/hash + relevant package version participate in semantic identity.

Rules:

~~~text
same key + same canonical semantic payload
→ exact committed replay

same key + different canonical semantic payload
→ conflict
~~~

Authorization/current authority is checked before a new mutation. Historical exact replay may return the previously committed business outcome, but cannot be used to authorize a fresh mutation under stale authority.

### 10.2 Concurrency

Use row locks/CAS/version preconditions and the existing transaction/advisory-lock conventions to prove:

- two concurrent version creates produce one authoritative next version;
- stale definition revision loses;
- approval proof is revalidated immediately before any binding/use that depends on it;
- retirement/supersession cannot race with new formal binding into resurrection;
- package inclusion and definition retirement cannot silently cross;
- revoked/expired reviewer authority cannot be accepted for a new operation;
- no silent overwrite.

No global lock unrelated to the logical definition chain is introduced.

### 10.3 Atomicity

A successful mutation commits in one caller-owned transaction, on one checked-out client, all applicable local effects:

- definition-domain version/state;
- package-owner contribution/reference if a real package-owner mutation is available;
- business audit;
- idempotency settlement.

Professional approval is not minted in this transaction. Approval proof is an external/shared authoritative input that is revalidated.

Any failure before settlement rolls back the logical mutation. No nested transaction and no second checked-out connection may split truth.

## 11. Business audit and provenance

Audit events must be bounded and must not become professional truth.

Record event classes for:

- candidate definition created;
- definition successor version created;
- review requested only when a real shared operation exists;
- approval proof resolved/revalidated;
- professional approval blocked/unavailable;
- exact package inclusion checked/bound where applicable;
- definition retired/superseded;
- eligibility evaluated;
- eligibility blocked.

Metadata may include:

- actor identity/reference;
- definition id/version/hash;
- approvalProofRef;
- reviewer identity reference;
- qualification ref/scope reference;
- approval scope;
- scene/package version;
- reason codes;
- revision;
- timestamp;
- correlation/request/idempotency identity.

Do not copy raw family narrative, credential bodies or unnecessary sensitive professional source content into generic audit.

## 12. Failure semantics

All failures are fail-closed and distinguishable internally. At minimum:

| Failure family | Required behavior |
|---|---|
| definition missing / wrong id/version/hash | no nearest/latest fallback |
| approval proof missing/unavailable | allowed=false; production unavailable |
| approval wrong definition/version/hash/scope | allowed=false |
| reviewer Staff authority revoked/expired/unverifiable | allowed=false |
| qualification missing/mismatch/expired/unverifiable | allowed=false |
| not APPROVED / not PUBLISHED | allowed=false |
| approval outside effective window | allowed=false |
| definition or professional proof retired/superseded/expired | no new use |
| wrong Scene/package or no exact inclusion | allowed=false |
| stale definition/package/approval revision | conflict/retry from fresh truth |
| cross-family/cross-case/wrong actor/purpose | anti-enumerated denial |
| missing/UNKNOWN formulation | allowed=false unless exact approved UNKNOWN-safe rule |
| missing Evidence / material conflict | allowed=false |
| age/development mismatch | allowed=false |
| applicable condition not proven | allowed=false |
| exclusion/contraindication hit | allowed=false |
| participation/Consent block | allowed=false |
| Compliance block/unknown | allowed=false |
| Safety block/unknown | allowed=false |
| combination conflict | allowed=false |
| dependency/infrastructure unavailable | never translated into approval or ALLOW |
| transaction failure | rollback |
| idempotency mismatch/contention | deterministic conflict/failure |

External disclosure uses existing privacy/anti-enumeration conventions.

## 13. Migration strategy

Plan AI 2 reserves no migration number.

T1601 must re-read then-current db/migrations immediately before implementation. The Development AI allocates exactly the then-next safe migration, leaves 001..current head byte-for-byte untouched, and adds only Slice 16 schema/RLS/grant/index/constraint changes required by this bounded foundation.

No professional content seed, reviewer seed, qualification seed, approval seed or package publication seed is allowed in the production migration.

## 14. Test strategy

### 14.1 Domain tests

Prove exact identity/version/hash, canonical hashing, immutable versions, successor chains, retirement/supersession, definition contract completeness, package exactness, deterministic eligibility and UNKNOWN behavior.

### 14.2 Professional Authority integration

Prove valid isolated proof, missing qualification, wrong qualification scope, missing/revoked/expired Staff authority, wrong approval scope/hash/version, expired approval, unpublished approval, retired proof, and test-fixture isolation.

### 14.3 Authorization/RLS

Prove cross-family/cross-case denial, anti-enumeration, household-vs-Staff separation, unauthorized mutation, runtime role constraints and no Safety resolver reuse.

### 14.4 Gate tests

Prove independent age/development, Formulation, Evidence, exclusion/contraindication, participation, Consent, Compliance, combination conflict and Safety behavior.

### 14.5 Idempotency/concurrency/atomicity

Prove exact replay, key/payload mismatch, two-version race, stale revision, retire/bind race, authority revocation race as applicable, and rollback before audit/idempotency settlement.

### 14.6 Production gate tests

Production composition with no real reviewer/qualification/approval provider MUST return truthful professional-content unavailable and allowed=false. This is a passing test, not an implementation defect.

### 14.7 Static architecture guards

Guards reject:

- generic Professional CMS/Content Platform;
- professional qualification platform/registry;
- expert marketplace;
- second staff table;
- ADMIN=true authority;
- second Approval Plane;
- second Scene/package registry/manifest;
- second Case Phase owner;
- duplicate Evidence/Formulation/Consent/Compliance/Safety owner;
- AI/RAG approval;
- developer/fixture approval in production;
- production approved/published seeds;
- InterventionInstance, Goal, Plan, Task, Checkin, Review, Outcome, Schedule or Notification implementation;
- RAG/pgvector/embedding/Context Builder/AI runtime work.

## 15. Slice 15 compatibility and downstream seams

Slice 15 remains unchanged. Its A5001/A5002 Professional Content Package domain is not InterventionDefinition. Slice 16 may copy only its narrow resolve/revalidate/fail-closed consumer pattern.

Slice 17 remains RECONCILIATION REQUIRED. Slice 16 must expose a clear future consumer seam carrying:

~~~text
definition id/version/content_hash
approvalProofRef + professional provenance result
scene/package version + exact inclusion result
source refs
bounded eligibility reason/provenance
~~~

Slice 17 cannot force Slice 16 back to old sole-approval ownership.

Slice 18/19 are not modified.

## 16. Traceability — Functional Requirements

Every Frozen Spec FR has a Plan owner and a Development Task.

| FR | Plan owner | Task |
|---|---|---|
| FR-001 | §1 selection retained | T1601 |
| FR-002 | §2/§4 definition owner | T1602 |
| FR-003 | §4.2 version identity | T1602 |
| FR-004 | §4.2 exact identity; code alone insufficient | T1602 |
| FR-005 | §4.3 content hash | T1602 |
| FR-006 | §4.3 full semantic contract | T1602 |
| FR-007 | §4.2 no family Evidence in definition | T1602 |
| FR-008 | §4.3 method-name insufficient | T1602 |
| FR-009 | §4.2 immutable history | T1602/T1608 |
| FR-010 | §9 successor version | T1608 |
| FR-011 | §5 shared Approval Plane consumer | T1603 |
| FR-012 | §5 no local approval flag | T1603/T1613 |
| FR-013 | §5 exact id/version/hash approval binding | T1603 |
| FR-014 | §5 source refs/scope | T1603 |
| FR-015 | §5 real reviewer identity | T1603 |
| FR-016 | §5 qualification proof | T1603 |
| FR-017 | §5 Staff assignment/capability | T1603 |
| FR-018 | §2/§5 capability != qualification/approval | T1603/T1613 |
| FR-019 | §4/§5 reviewed_by_role insufficient | T1603/T1613 |
| FR-020 | §4.4/§5 no AI/RAG/developer/fixture approval | T1610/T1613 |
| FR-021 | §5/§7 current APPROVED required | T1603/T1607 |
| FR-022 | §5/§7 current PUBLISHED required | T1603/T1607 |
| FR-023 | §5/§9 no new use after invalid lifecycle | T1603/T1608 |
| FR-024 | §5 effective/publication periods | T1603 |
| FR-025 | §4.2/§5 no duplicate approval truth | T1603 |
| FR-026 | §9/§11 historical provenance inspectable | T1608/T1609 |
| FR-027 | §6 exact Scene/package | T1604 |
| FR-028 | §6 exact definition id/version/hash | T1604 |
| FR-029 | §6 no floating latest | T1604/T1613 |
| FR-030 | §3/§6 reuse getScenePackageBinding/package owner | T1604 |
| FR-031 | §6 invalid package/definition combinations fail | T1604/T1607 |
| FR-032 | §6 no second registry | T1604/T1613 |
| FR-033 | §7 deterministic eligibility | T1607 |
| FR-034 | §7 current Case | T1605 |
| FR-035 | §7 current Formulation/Evidence | T1605 |
| FR-036 | §7 professional proof before applicability | T1603/T1607 |
| FR-037 | §7 age/development | T1607 |
| FR-038 | §7 UNKNOWN/Formulation dependencies | T1605/T1607 |
| FR-039 | §7 supporting Evidence | T1605/T1607 |
| FR-040 | §7 applicable conditions | T1607 |
| FR-041 | §7 exclusions/contraindications | T1607 |
| FR-042 | §7 participation | T1606/T1607 |
| FR-043 | §8 Consent | T1606/T1607 |
| FR-044 | §7 combination/conflict | T1607 |
| FR-045 | §8 Compliance | T1606/T1607 |
| FR-046 | §8 Safety | T1606/T1607 |
| FR-047 | §8 Authorization/anti-enumeration | T1606 |
| FR-048 | §7.5 no Phase 4 activation | T1607/T1613 |
| FR-049 | §7 dependency revisions/staleness | T1605/T1607 |
| FR-050 | §7 no RAG/model override | T1607/T1613 |
| FR-051 | §8.2 professional mutation not family authority | T1603/T1606 |
| FR-052 | §8 Authorization/RLS | T1606 |
| FR-053 | §8 reuse Consent/Compliance/Safety | T1606 |
| FR-054 | §3/§7 no Case phase mutation | T1605/T1613 |
| FR-055 | §10 idempotency reuse | T1609 |
| FR-056 | §10 key/payload mismatch | T1609 |
| FR-057 | §10 concurrency | T1609 |
| FR-058 | §10 atomicity | T1609 |
| FR-059 | §11 exact audit binding | T1609 |
| FR-060 | §11 audit not professional truth | T1609/T1613 |
| FR-061 | §4.4 candidate without fake approval | T1610 |
| FR-062 | §1/§4.4 production unavailable | T1610 |
| FR-063 | §14/§7.5 no Phase 4/RAG/AI runtime | T1613 |
| FR-064 | §13 then-next migration | T1601/T1602 |

Coverage: 64/64.

## 17. Traceability — Acceptance Scenarios

Every AS is listed individually so exact-ID coverage can be mechanically audited.

| AS | Planned verification | Tasks |
|---|---|---|
| AS-001 | Capability present, qualification absent -> invalid approval | T1603 |
| AS-002 | Qualification present, Staff authority absent -> invalid approval | T1603 |
| AS-003 | AI draft remains candidate | T1610/T1613 |
| AS-004 | Test reviewer proof stays test-only | T1610/T1613 |
| AS-005 | Developer approved=true cannot create approval | T1610/T1613 |
| AS-006 | Approved but unpublished -> no use | T1603/T1607 |
| AS-007 | Retired published definition -> no new use, history retained | T1603/T1608 |
| AS-008 | Wrong approval scope -> fail closed | T1603/T1604 |
| AS-009 | Wrong Scene/package version -> fail closed | T1604/T1607 |
| AS-010 | Correct code, wrong exact version -> no fallback | T1602/T1604 |
| AS-011 | Stale/revoked assignment for new approval attempt -> fail closed | T1603 |
| AS-012 | PROFESSIONAL_REVIEW revoked -> fail closed | T1603 |
| AS-013 | Qualification/approval effective period expired -> fail closed | T1603 |
| AS-014 | Wrong Family/Case -> anti-enumerated fail closed | T1606 |
| AS-015 | Required Consent missing/revoked/expired -> fail closed | T1606/T1607 |
| AS-016 | Compliance block cannot be overridden by approval | T1606/T1607 |
| AS-017 | Safety block cannot be overridden by approval | T1606/T1607 |
| AS-018 | Missing/UNKNOWN Formulation dependency stays blocked/UNKNOWN | T1605/T1607 |
| AS-019 | Package snapshot with unpublished definition is invalid | T1604/T1607 |
| AS-020 | Historical retired definition remains inspectable | T1608 |
| AS-021 | No real reviewer -> truthful unavailable | T1610 |
| AS-022 | Approval hash mismatch -> fail closed | T1603 |
| AS-023 | Proof binds another definition/version -> fail closed | T1603 |
| AS-024 | Substantive edit requires successor + fresh approval | T1602/T1608 |
| AS-025 | All gates pass -> bounded allowed=true only | T1607 |
| AS-026 | Age/development mismatch -> fail closed | T1607 |
| AS-027 | Exclusion/contraindication hit -> blocked | T1607 |
| AS-028 | Conflicting Intervention combination -> blocked | T1607 |
| AS-029 | Required supporting Evidence absent -> blocked | T1605/T1607 |
| AS-030 | Later legal Case phase does not create shadow exact-phase gate | T1605/T1607 |
| AS-031 | Material Formulation correction stales eligibility; no Case-phase write | T1605/T1607 |
| AS-032 | Exact idempotent replay -> same result/no duplicate effect | T1609 |
| AS-033 | Same key + different payload -> conflict | T1609 |
| AS-034 | Publish/bind vs retire/supersede race -> one valid winner | T1609 |
| AS-035 | Failure before audit/idempotency settlement -> rollback | T1609 |
| AS-036 | Unauthorized target guessing preserves anti-enumeration | T1606/T1611 |
| AS-037 | RAG text cannot legalize unapproved definition | T1607/T1613 |
| AS-038 | AI-created Intervention remains candidate, not activated | T1610/T1613 |
| AS-039 | InterventionInstance/Plan attempt rejected by scope guard | T1613 |
| AS-040 | Second intervention package registry rejected | T1604/T1613 |

Coverage: 40/40.

## 18. Traceability — Negative Scope

Every NS is listed individually so guard coverage can be mechanically audited.

| NS | Required guard | Tasks |
|---|---|---|
| NS-001 | No generic Professional CMS | T1613 |
| NS-002 | No Professional Content Platform | T1613 |
| NS-003 | No expert marketplace | T1613 |
| NS-004 | No generic Staff platform | T1613 |
| NS-005 | No duplicate staff_assignments | T1613 |
| NS-006 | No professional qualification owner/platform | T1603/T1613 |
| NS-007 | No duplicate Professional Content Approval Plane | T1603/T1613 |
| NS-008 | No ADMIN=true universal authority | T1613 |
| NS-009 | No AI reviewer | T1610/T1613 |
| NS-010 | No RAG reviewer | T1610/T1613 |
| NS-011 | No developer approval | T1610/T1613 |
| NS-012 | No production fixture approval | T1610/T1613 |
| NS-013 | No automatically PUBLISHED seed | T1610/T1613 |
| NS-014 | No Phase 4 InterventionInstance | T1613 |
| NS-015 | No Goal object | T1613 |
| NS-016 | No Plan/PlanVersion activation | T1613 |
| NS-017 | No Task or Checkin | T1613 |
| NS-018 | No Outcome/Follow-up/Schedule/Notification | T1613 |
| NS-019 | No Professional Knowledge owner | T1613 |
| NS-020 | No RAG implementation | T1613 |
| NS-021 | No pgvector/embedding/reranking work | T1613 |
| NS-022 | No Context Builder | T1613 |
| NS-023 | No AI Task Runtime/model gateway | T1613 |
| NS-024 | No second Scene package registry | T1604/T1613 |
| NS-025 | No second Scene Manifest/routing owner | T1604/T1613 |
| NS-026 | No second Case phase/status owner | T1605/T1613 |
| NS-027 | No duplicate Evidence/Problem Formulation owner | T1605/T1613 |
| NS-028 | No duplicate Consent/Compliance/Safety owner | T1606/T1613 |
| NS-029 | No generic approval workflow engine | T1603/T1613 |
| NS-030 | No legal interpretation/Legal Authority platform | T1606/T1613 |

Coverage: 30/30.

## 19. Development stop/return conditions

Development must STOP and return to Plan AI 1 if T1601 finds semantic Authority drift in any of:

- Professional Approval ownership;
- InterventionDefinition ownership;
- qualification Authority;
- Staff capability/assignment semantics;
- Scene/package ownership or exact binding;
- Case Phase ownership;
- deterministic eligibility semantics;
- Phase 3/Phase 4 boundary.

Non-semantic path/migration/refactor drift may be reconciled in implementation inventory without modifying the Frozen Spec or this architecture.

## 20. Planning decisions

Open Product Decisions: 0.  
Open Planning Decisions: 0.  
Scope Drift: 0.

The implementation is intentionally allowed to complete while production professional approval/release remain BLOCKED. That blocked state is required truthful behavior, not a reason to expand Slice 16 into a reviewer/qualification/approval platform.
