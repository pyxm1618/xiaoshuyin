# Slice 16 — Authority-Reconciled Development Tasks

> Frozen input: spec.md blob 5bc22645af2008d6f774e39f57bae391fa2543c7  
> Plan input: plan.md on this planning branch  
> Rule: Development AI executes these tasks in order. It does not redesign ownership or merge production approval/release gates with the Development Implement Gate.

## Execution rules

For every task:

- preserve the Frozen Spec byte-for-byte;
- never edit the four Authority Docs;
- never edit historical migrations;
- never create fake reviewer/qualification/approval/published truth;
- use then-current main after T1601, not stale paths from historical Slice 16;
- stop and return to Plan AI 1 on semantic Authority drift;
- reconcile only non-semantic implementation/path/migration drift;
- no Phase 4 business objects and no RAG/AI runtime.

---

## T1601 — Development-Start Exact Authority Read-back

### Goal

Bind implementation to the exact then-current repository reality before any code or migration is created.

### Expected files/modules

No production file change. This is a mandatory read-back gate.

### Dependencies

Frozen reconciliation spec + frozen Plan/Checklist/Tasks.

### Mechanical execution

Read and record:

1. origin/main SHA and tree SHA;
2. latest main CI conclusion and exact head;
3. current migration directory and migration head;
4. Frozen reconciliation spec blob; it must still be 5bc22645af2008d6f774e39f57bae391fa2543c7;
5. current blobs of all four Authority Docs;
6. current owner paths for:
   - Case/status/phase;
   - Problem Formulation;
   - Evidence;
   - Scene/package binding and Digital Use package owner;
   - Staff Authority/staff_assignments;
   - Professional Content approval-consumer precedent;
   - Authorization/RLS;
   - Consent;
   - Compliance;
   - Safety;
   - idempotency;
   - business audit;
   - transaction seam;
7. current branch and relevant open PR inventory;
8. confirm current reviewer operational state.

Compare with planning inventory.

### Drift gate

Non-semantic implementation drift:
- path moved;
- migration head advanced;
- owner refactored without semantic change;
- CI number changed.

Result: update implementation inventory in the development report and continue.

Semantic Authority drift:
- approval owner changed;
- InterventionDefinition owner changed;
- qualification owner/meaning changed;
- Staff assignment/capability semantics changed;
- Case Phase owner changed;
- Scene/package owner/inclusion semantics changed;
- eligibility semantics changed;
- Phase 3/4 boundary changed.

Result:

~~~text
STOP — SEMANTIC AUTHORITY DRIFT — RETURN TO PLAN AI 1
~~~

### Verification

- exact Frozen Spec blob PASS;
- current main/CI/migration recorded;
- all owner paths proven from then-current main;
- no implementation mutation occurred before gate result.

### FR mapping

FR-001, FR-064.

### AS mapping

All AS depend on this baseline; no scenario is executed here.

### NS mapping

NS-004–NS-007, NS-024–NS-030 are specifically rechecked for owner drift.

### Negative tests

N/A — read-back gate only.

### Failure tests

Any spec blob mismatch or semantic Authority change must stop development.

### Scope guard

No code, schema, tests, migration or Docs change.

---

## T1602 — InterventionDefinition Persistence, Typed Schema, Identity, Version and Hash

### Goal

Create the single InterventionDefinition domain truth with immutable exact versions and no approval laundering.

### Expected files/modules

~~~text
db/migrations/<then-next>_psychological_behavioral_intervention_contract.sql
packages/domain/src/intervention-definition-schema.ts
packages/domain/src/intervention-definitions.ts
packages/domain/src/intervention-definition-repository.ts
packages/domain/src/index.ts
db/schema/index.ts
tests/db/intervention-definitions-migration.test.ts
tests/db/intervention-definitions-schema.test.ts
tests/domain/intervention-definitions.test.ts
~~~

The migration filename is allocated only after T1601.

### Dependencies

T1601 PASS.

### Implementation boundary

Own only:
- definition identity;
- scene_id;
- stable intervention_code;
- exact semantic version;
- exact content hash;
- full contract semantic payload;
- domain successor/retirement history.

Do not persist canonical Professional Approval truth.

### Mechanical execution

1. Allocate then-next safe migration; do not reuse/reserve a historical number.
2. Add intervention_definitions with PostgreSQL 18 uuidv7 primary key and repository conventions.
3. Enforce uniqueness of (scene_id, intervention_code, version).
4. Add same-chain supersedes integrity.
5. Represent all Frozen Spec §14 / V1 §2.7A semantic fields in a typed schema. Use typed scalar/JSONB fields according to existing conventions; do not create one unvalidated free-form blob.
6. Add a domain-only definition_state if needed for CANDIDATE/current semantic version/superseded/retired history. Its meaning must explicitly exclude APPROVED/PUBLISHED.
7. Implement canonical server-side semantic serializer + SHA-256 content_hash. Unknown authority fields are rejected.
8. Ensure semantic rows are immutable after persistence. A substantive correction creates a successor version.
9. Add repository reads by exact id/version/hash and exact logical identity/version. Do not implement “latest approved” or floating-latest production lookup.
10. Add retirement/supersession write primitives that preserve history.
11. Re-export the typed schema from db/schema/index.ts; do not duplicate table definition there.
12. Add grants/RLS consistent with globally reusable professional assets:
    - do not apply family-scoped RLS as approval Authority;
    - family runtime may read only through server-side domain/service composition;
    - mutation must not be authorized by household Family status;
    - no BYPASSRLS/table-owner runtime.
13. Do not seed real Intervention content, reviewer, qualification, approval, publication or package inclusion.

### Verification

- fresh DB migration passes;
- upgrade from all historical migrations through new migration passes;
- migration checksum/history tests pass;
- exact row version cannot be overwritten;
- same chain cannot fork silently;
- content_hash changes on semantic/source-ref change;
- caller-supplied hash cannot override server hash;
- family Evidence bodies cannot be persisted as definition semantics;
- no approved/published authority column can independently authorize use.

### FR mapping

FR-002–FR-010, FR-026, FR-061, FR-064.

### AS mapping

AS-020, AS-024.

### NS mapping

NS-007, NS-024–NS-028.

### Negative tests

- method-name-only payload rejected as incomplete;
- missing required contract field rejected;
- cross-code supersedes rejected;
- duplicate version rejected;
- in-place semantic update rejected;
- attempt to add approved=true/reviewed_by_role authority rejected by architecture guard;
- production migration contains no professional content seed.

### Failure tests

- hash mismatch;
- stale successor version;
- wrong predecessor;
- duplicate concurrent version attempt;
- migration replay/history integrity failure.

### Scope guard

No approval platform, package registry, Case/Phase write, Phase 4 object or RAG component.

---

## T1603 — Narrow Professional Approval / Staff / Qualification Consumer Seam

### Goal

Consume and revalidate real Professional Approval without making Slice 16 an approval, Staff or qualification owner.

### Expected files/modules

~~~text
apps/server/api/src/services/intervention-professional-authority.ts
tests/support/intervention-professional-authority.ts
tests/integration/intervention-professional-authority.test.ts
tests/architecture/intervention-professional-authority-boundary.test.ts
~~~

T1603 may read staff_assignments through current Staff Authority interfaces/queries. It must not add a second Staff table.

### Dependencies

T1601, T1602.

### Implementation boundary

Build only an Intervention-specific resolve/revalidate seam.

The proof must establish:
- exact artifact/definition identity;
- exact definition version;
- exact content hash;
- professional source refs;
- approval scope;
- reviewer identity ref;
- Staff assignment/capability proof/ref;
- professional qualification ref + scope + status;
- reviewed_at;
- APPROVED status;
- PUBLISHED status;
- effective/published period;
- non-retired/non-superseded/non-expired lifecycle.

### Mechanical execution

1. Define the typed InterventionProfessionalAuthorityProvider resolve/revalidate contract.
2. Validate exact definition id/version/hash before any proof can be considered.
3. Validate source refs and approval scope.
4. Require real reviewer identity reference.
5. Require Staff authority proof/reference for PROFESSIONAL_REVIEW.
6. Require matching professional qualification proof/reference independently from Staff capability.
7. Require APPROVED + PUBLISHED + current/effective lifecycle.
8. Revalidate effective window and lifecycle at the use boundary.
9. Implement an explicit unavailable production provider as current default.
10. Implement isolated test-only provider under tests/support.
11. Add architecture guards preventing production modules from importing test provider.
12. For a future Staff actor performing an asset mutation, add only a bounded self-authority read against current staff_assignments under an identity-scoped transaction. Do not call or generalize the SAFETY_RESOLVE-specific app.set_staff_case_context()/app.staff_case_authorized() path.
13. Do not create a qualification table/provider database. Qualification is consumed from an external/shared proof provider; production remains unavailable until one exists.
14. Do not implement a generic “approve” or “publish” command. Slice 16 cannot mint the proof it consumes.

### Verification

- valid fully bound isolated proof resolves in tests;
- wrong id/version/hash/scope/source fails;
- missing reviewer identity fails;
- PROFESSIONAL_REVIEW capability without qualification fails;
- qualification without valid Staff authority fails;
- role string alone fails;
- expired/revoked/unverifiable authority fails;
- unapproved/unpublished/retired proof fails;
- default production provider returns unavailable;
- no environment flag can promote it.

### FR mapping

FR-011–FR-026, FR-036, FR-051.

### AS mapping

AS-001–AS-013, AS-021–AS-023.

### NS mapping

NS-004–NS-013, NS-029.

### Negative tests

- fake approved boolean;
- reviewed_by_role only;
- developer identity;
- Family Manager/Guardian as reviewer;
- generic Staff identity without capability;
- capability without qualification;
- qualification fixture imported into production;
- AI/RAG-generated proof;
- stale/revoked Staff assignment;
- expired qualification;
- proof for another definition/version/hash.

### Failure tests

Provider unavailable/infrastructure failure propagates as unavailable/error and never as APPROVED.

### Scope guard

No generic Professional Content Platform, Staff IAM, qualification registry, workflow engine or approval database.

---

## T1604 — Exact Scene/Package Inclusion Consumer

### Goal

Bind exact InterventionDefinition identity to the existing Digital Use Scene/package owner without creating a second package registry.

### Expected files/modules

~~~text
packages/scenes/digital-use/intervention-definitions.ts
packages/scenes/digital-use/index.ts
apps/server/api/src/services/intervention-eligibility.ts   # consumer integration only
tests/scenes/digital-use/intervention-package-binding.test.ts
~~~

### Dependencies

T1602, T1603.

### Implementation boundary

Package inclusion answers only whether a particular exact definition identity/version/hash is included by a particular exact package version. It is not professional approval.

### Mechanical execution

1. Define a package-owned exact inclusion result/API under packages/scenes/digital-use.
2. Inputs must include scene/package version + exact definition id/version/hash.
3. At family/case runtime, read the case binding with getScenePackageBinding(tx, caseId).
4. Compare exact package version; do not infer latest/current package.
5. Production inclusion remains empty/unavailable for formal InterventionDefinitions until real professional approval/release exists.
6. Tests may inject exact package inclusion fixtures, isolated from production.
7. Do not create intervention_package_registry, intervention_scene_registry or a second node manifest.

### Verification

- wrong package version fails;
- wrong id/version/hash fails;
- package inclusion without valid approval still cannot yield eligibility;
- valid approval without package inclusion still cannot yield eligibility;
- test fixture cannot alter production package owner;
- no floating latest path exists.

### FR mapping

FR-027–FR-032.

### AS mapping

AS-008–AS-010, AS-019, AS-025, AS-040.

### NS mapping

NS-024, NS-025.

### Negative tests

- “latest package” fallback;
- “latest approved definition” lookup;
- unapproved candidate inserted into production inclusion to satisfy test;
- second registry/table/manifest.

### Failure tests

Missing package binding or inclusion provider -> fail closed.

### Scope guard

No Scene routing redesign, no node-manifest duplication.

---

## T1605 — Current Case / Problem Formulation / Evidence Snapshot and Freshness

### Goal

Build the read-only authoritative family/case snapshot required by the deterministic evaluator.

### Expected files/modules

~~~text
apps/server/api/src/services/intervention-eligibility.ts
packages/domain/src/intervention-eligibility.ts
tests/integration/intervention-eligibility-snapshot.test.ts
tests/domain/intervention-eligibility-unknown.test.ts
~~~

### Dependencies

T1602, T1604.

### Implementation boundary

Consume current owners. Do not create Case, Phase, Evidence or Formulation truth.

### Mechanical execution

1. Read the current primary/open Case under the caller's existing family/RLS transaction.
2. Capture exact Case status/phase/version.
3. Read current authoritative CONFIRMED/CURRENT Problem Formulation through existing owner semantics.
4. Capture formulation id/version/review_state.
5. Read only Evidence required by the exact definition, preserving provenance, revision/value-state/conflict semantics.
6. Preserve UNKNOWN, DECLINED, NOT_COLLECTED and CONFLICTING as distinct states.
7. Capture dependency revision refs sufficient to determine staleness.
8. Read age/development facts only from authoritative current profile/Evidence sources.
9. Reuse getScenePackageBinding for exact scene_package_version.
10. Do not require exact equality between manifest node phase and Case phase.
11. Do not write/advance/rollback Case phase.
12. If current Formulation is NEEDS_REVIEW, absent or superseded, eligibility snapshot is blocked/stale.

### Verification

- Case is wrong family/case -> denied;
- closed/non-primary/non-open Case -> blocked;
- later valid Case phase does not create a shadow phase failure;
- formulation correction makes prior eligibility stale;
- UNKNOWN remains UNKNOWN;
- conflicting/missing evidence never becomes false/safe.

### FR mapping

FR-034, FR-035, FR-038, FR-039, FR-049, FR-054.

### AS mapping

AS-014, AS-018, AS-029–AS-031.

### NS mapping

NS-026, NS-027.

### Negative tests

- direct Scene phase write;
- latest formulation lookup ignoring CURRENT/CONFIRMED validity;
- AI-filled missing Evidence;
- conflict auto-resolution;
- family narrative copied into professional definition.

### Failure tests

Stale Case/Formulation/Evidence revision -> deterministic stale/blocked result.

### Scope guard

No second lifecycle owner and no Phase 4 object.

---

## T1606 — Authorization, RLS, Participation, Consent, Compliance and Safety Composition

### Goal

Compose independent current control-plane gates around eligibility without conflating them with professional approval.

### Expected files/modules

~~~text
apps/server/api/src/services/intervention-eligibility.ts
tests/integration/intervention-authorization-rls.test.ts
tests/integration/intervention-gates.test.ts
~~~

No new Consent/Compliance/Safety owner module is expected.

### Dependencies

T1603, T1605.

### Implementation boundary

Use existing authorize/RLS/Consent/Compliance/Safety owners only.

### Mechanical execution

1. Authenticate actor before protected reads.
2. Open one existing family/RLS transaction for family/case evaluation.
3. Use current authorization entry point for exact actor/family/case/purpose; identifiers remain untrusted parameters.
4. Ensure denied callers do not receive professional/package/family object existence details.
5. Read participation requirements from exact definition and current participant context.
6. Resolve required current Consent through existing owner. Missing/revoked/expired/unverifiable -> BLOCK/UNKNOWN.
7. Evaluate Compliance through current transaction-time evaluator/owner; do not convert infrastructure failure to ALLOW.
8. Consume current Safety state/guard. SAFETY_HOLD or authoritative block -> BLOCK.
9. Keep Staff/professional asset mutation on identity-scoped Staff path, separate from household family RLS.
10. Never use Family membership, Guardian or ordinary Account as professional-review authority.
11. Never disable RLS or use BYPASSRLS/table-owner runtime.
12. Applicable Legal Authority absence remains a Compliance fail-closed dependency; Slice 16 does not interpret law.

### Verification

- cross-family/cross-case/wrong-purpose/wrong-actor denied;
- anti-enumeration preserved;
- staff vs household authority separation proven;
- missing/revoked Consent blocks;
- Compliance block/unknown blocks;
- Safety block/unknown blocks;
- approval cannot override any of those gates.

### FR mapping

FR-042–FR-047, FR-051–FR-053.

### AS mapping

AS-014–AS-017, AS-036.

### NS mapping

NS-004, NS-008, NS-028, NS-030.

### Negative tests

- Family Manager mutates professional definition;
- professional reviewer gains family Evidence visibility from Staff identity;
- approval implies Consent;
- approval implies Compliance;
- Safety pass implies Consent;
- approval overrides Safety;
- RLS disabled/bypassed.

### Failure tests

Authorization/Consent/Compliance/Safety dependency failure -> fail closed and no downstream authoritative mutation.

### Scope guard

No new Consent/Compliance/Safety/Legal platform.

---

## T1607 — Deterministic Typed Intervention Eligibility Evaluator

### Goal

Implement the pure bounded evaluator for one exact definition and one exact current Case snapshot.

### Expected files/modules

~~~text
packages/domain/src/intervention-eligibility.ts
apps/server/api/src/services/intervention-eligibility.ts
packages/domain/src/index.ts
tests/domain/intervention-eligibility.test.ts
tests/integration/intervention-eligibility.test.ts
~~~

### Dependencies

T1602–T1606.

### Implementation boundary

Evaluator owns only the deterministic result. It cannot approve, publish, assign Staff, qualify reviewers, write Case phase or create Phase 4 objects.

### Mechanical execution

1. Define typed input snapshot and typed result from plan.md §7.
2. Evaluate in exact frozen order:
   authorization/context -> Case -> Formulation -> Evidence -> Scene/package -> exact definition -> approval -> publication/effective/lifecycle -> package inclusion -> age -> formulation deps -> evidence requirements -> applicable conditions -> exclusions -> participation -> Consent -> combination/conflict -> Compliance -> Safety.
3. Return structured reasonCodes and blocker arrays, not a single boolean.
4. Include exact definition id/version/hash, scene/package version, approvalProofRef, Evidence refs and dependency revision refs.
5. allowed=true only when every required gate is positively satisfied.
6. Preserve UNKNOWN as first class.
7. Evaluate conflicts among exact co-considered definition refs without creating InterventionInstance.
8. No model/RAG/classifier call.
9. No create/propose/activate InterventionInstance or Plan side effect.

### Verification

- deterministic same snapshot -> same result;
- full positive isolated fixture -> allowed=true;
- each gate independently blocks;
- UNKNOWN never permits by default;
- wrong definition/package/proof fails before family applicability can become true;
- result can be invalidated by dependency revision change;
- no mutation occurs during pure evaluation.

### FR mapping

FR-033, FR-036–FR-050.

### AS mapping

AS-018, AS-019, AS-025–AS-031, AS-037, AS-038.

### NS mapping

NS-009, NS-010, NS-014–NS-023.

### Negative tests

- RAG strong text on unapproved definition;
- AI-created candidate used immediately;
- age mismatch;
- exclusion/contraindication;
- missing Evidence;
- combination conflict;
- allowed=true creates Phase 4 object.

### Failure tests

Unknown/infrastructure/dependency unavailable -> allowed=false or propagated infrastructure error, never default allow.

### Scope guard

Pure deterministic evaluator; no AI/RAG/Phase4.

---

## T1608 — Candidate Version / Supersession / Retirement Commands

### Goal

Implement bounded internal domain/service commands for Definition-domain lifecycle while keeping Professional Approval external.

### Expected files/modules

~~~text
apps/server/api/src/services/intervention-definitions.ts
packages/domain/src/intervention-definitions.ts
packages/domain/src/intervention-definition-repository.ts
tests/integration/intervention-definition-lifecycle.test.ts
~~~

### Dependencies

T1602, T1603, T1606.

### Implementation boundary

Allowed commands:
- create candidate;
- create successor/new version;
- request professional review only through a real shared-plane request port if present; otherwise truthful unavailable;
- resolve/revalidate proof;
- retire/supersede domain version;
- request/check package inclusion through the package owner.

Forbidden commands:
- local approve;
- local publish;
- local qualify reviewer;
- local grant Staff capability.

### Mechanical execution

1. Require authenticated Staff identity for professional asset mutation.
2. Require current applicable PROFESSIONAL_REVIEW authority and matching qualification proof for production mutation paths.
3. Use server-generated id/version/hash and immutable semantic payload.
4. Create successor row instead of semantic UPDATE.
5. Retire/supersede with explicit expected revision/version precondition.
6. Preserve historical exact rows.
7. If no shared review-request operation exists, return DEPENDENCY_UNAVAILABLE; do not invent a queue/workflow.
8. Approval proof consumption is read/revalidate only; it cannot mutate local approved/published state.
9. Package binding uses package-owner operation/consumer only.
10. Emit bounded audit metadata via T1609 seam.

### Verification

- candidate creation produces CANDIDATE/domain state only;
- no approved/published local state created;
- successor preserves old row;
- retirement prevents new formal eligibility;
- historical exact row remains inspectable;
- missing Staff/qualification prevents asset mutation;
- unavailable review port is truthful unavailable.

### FR mapping

FR-009, FR-010, FR-023, FR-026, FR-051, FR-061.

### AS mapping

AS-003, AS-006, AS-007, AS-011, AS-012, AS-020, AS-024.

### NS mapping

NS-001–NS-008, NS-011–NS-013, NS-029.

### Negative tests

- UPDATE semantic payload in place;
- developer “approve” mutation;
- request review creates local APPROVED state;
- retire deletes history;
- package binding bypasses package owner.

### Failure tests

Stale revision, proof unavailable, Staff/qualification invalid, package owner unavailable -> no partial mutation.

### Scope guard

No generic CMS/workflow.

---

## T1609 — Idempotency, Concurrency, Atomicity and Business Audit

### Goal

Make all Slice 16 mutating operations replay-safe, race-safe, atomic and auditable using shared infrastructure.

### Expected files/modules

~~~text
apps/server/api/src/services/intervention-definitions.ts
apps/server/api/src/idempotency.ts                 # reuse/extend only if generic helper needs no semantic change
packages/domain/src/intervention-definition-repository.ts
tests/integration/intervention-idempotency.test.ts
tests/integration/intervention-concurrency.test.ts
tests/integration/intervention-atomicity.test.ts
tests/integration/intervention-audit.test.ts
~~~

### Dependencies

T1608.

### Implementation boundary

No second idempotency table, transaction framework or audit owner.

### Mechanical execution

1. Use actor + command_type + idempotency_key shared semantics.
2. Authorize/current-authority-check before a new mutation.
3. Canonical request hash includes all material semantic inputs and exact proof/package refs where relevant.
4. Lock/replay with existing idempotency helpers.
5. Same key + same payload -> exact committed replay.
6. Same key + different payload -> conflict.
7. Version creation serializes one logical intervention_code chain; at most one next version wins.
8. Revalidate approval/authority immediately before an operation that depends on it.
9. Use CAS/expected revision for retirement/supersession/binding.
10. Use one caller-owned transaction/client; no nested transaction.
11. In that transaction commit all applicable local domain effects + audit + idempotency settlement.
12. Roll back all local effects on any failure.
13. Record bounded audit events from plan.md §11 without family narrative/credential bodies.

### Verification

- exact replay has no duplicate definition/audit;
- payload mismatch conflicts;
- two concurrent version creates -> one winner, one deterministic stale/conflict;
- retire/bind race -> no resurrection;
- failure between domain write and audit/idempotency -> rollback;
- audit contains exact definition/version/hash/proof/package/reason refs;
- audit cannot be queried as approval Authority.

### FR mapping

FR-055–FR-060.

### AS mapping

AS-032–AS-035.

### NS mapping

NS-007, NS-029.

### Negative tests

- second idempotency store;
- nested transaction;
- side effect committed before audit/idempotency;
- audit field interpreted as approval truth.

### Failure tests

Contention, stale revision, rollback, DB/infrastructure failure.

### Scope guard

Reuse current idempotency/transaction/audit owners.

---

## T1610 — Truthful Production-Unavailable Composition and Test-Only Fixture Isolation

### Goal

Prove Development can PASS while real production professional approval/release stays BLOCKED.

### Expected files/modules

~~~text
apps/server/api/src/services/intervention-professional-authority.ts
apps/server/api/src/services/intervention-eligibility.ts
tests/support/intervention-professional-authority.ts
tests/support/intervention-definition-fixtures.ts
tests/integration/intervention-production-unavailable.test.ts
tests/architecture/intervention-test-fixture-isolation.test.ts
~~~

### Dependencies

T1603, T1607.

### Implementation boundary

Production default has no real reviewer/qualification/proof/package inclusion. Tests may use explicit isolated fixtures only.

### Mechanical execution

1. Wire production composition to unavailable professional Authority provider.
2. Do not add an env/config escape hatch that returns approved.
3. Ensure no candidate/test seed can be selected by production provider.
4. Keep all synthetic reviewer/qualification/approval/inclusion fixtures under tests/support.
5. Add static import guard from production -> tests/support.
6. In production-unavailable test, exact candidate may load but professional authority result is unavailable/pending; allowed=false.
7. Verify no APPROVED/PUBLISHED state is persisted as fallback.
8. Verify package production inclusion remains absent until real release Authority exists.

### Verification

Required passing behavior:

~~~text
no real reviewer / qualification / approval proof
→ definition may be candidate
→ production professional authority unavailable
→ no formal package-approved candidate set
→ eligibility allowed=false
~~~

### FR mapping

FR-020–FR-023, FR-061, FR-062.

### AS mapping

AS-003–AS-006, AS-021, AS-037, AS-038.

### NS mapping

NS-009–NS-013.

### Negative tests

- environment variable enables approval;
- fixture imported by production;
- migration seed approved/published;
- fallback “use latest draft”;
- AI fills proof.

### Failure tests

Provider unavailable must be treated as truthful unavailable, not 500-to-allow or fake rejection.

### Scope guard

Production approval/release gates remain BLOCKED after development.

---

## T1611 — Bounded Error Taxonomy, Exports and Internal Consumer Contract

### Goal

Expose the Slice 16 foundation to future consumers without inventing a public product API or leaking internal authority detail.

### Expected files/modules

~~~text
packages/domain/src/intervention-definitions.ts
packages/domain/src/intervention-eligibility.ts
packages/domain/src/index.ts
apps/server/api/src/services/intervention-definitions.ts
apps/server/api/src/services/intervention-eligibility.ts
tests/domain/intervention-failure-semantics.test.ts
tests/integration/intervention-error-disclosure.test.ts
~~~

### Dependencies

T1602–T1610.

### Implementation boundary

Internal typed services only. No new family-facing route is required by this Slice.

### Mechanical execution

1. Define internal error/reason families for all Frozen Spec §28 failures.
2. Keep professional rejection distinct from dependency unavailable.
3. Keep authorization denial externally anti-enumerated.
4. Do not disclose reviewer qualification/Staff details to unauthorized callers.
5. Export only reviewed domain/service surfaces from package roots.
6. Keep raw repository write primitives non-public where existing domain patterns require controlled writers.
7. Provide future-consumer typed refs:
   - definition id/version/hash;
   - approvalProofRef/status;
   - scene/package version;
   - reason/provenance refs;
   - staleness/dependency refs.
8. Do not add a public HTTP route unless T1601 discovers a then-current Authority-mandated route; if so semantic drift must be assessed first.

### Verification

Every failure family has deterministic internal behavior and safe disclosure.

### FR mapping

FR-013, FR-024, FR-033, FR-047, FR-049, FR-059, FR-060.

### AS mapping

AS-014, AS-022, AS-023, AS-036.

### NS mapping

NS-001, NS-002, NS-029, NS-030.

### Negative tests

- nearest/latest fallback;
- technical unavailable reported as approval rejection/approval success;
- reviewer identity/qualification leak on unauthorized request.

### Failure tests

Exercise every failure family in plan.md §12.

### Scope guard

No public product surface expansion.

---

## T1612 — Full Requirement / Acceptance / Integration Test Matrix

### Goal

Create executable evidence for every FR and AS without using test fixtures as production Authority.

### Expected files/modules

At least:

~~~text
tests/db/intervention-definitions-migration.test.ts
tests/db/intervention-definitions-schema.test.ts
tests/domain/intervention-definitions.test.ts
tests/domain/intervention-eligibility.test.ts
tests/domain/intervention-eligibility-unknown.test.ts
tests/domain/intervention-failure-semantics.test.ts
tests/integration/intervention-professional-authority.test.ts
tests/integration/intervention-package-binding.test.ts
tests/integration/intervention-eligibility-snapshot.test.ts
tests/integration/intervention-authorization-rls.test.ts
tests/integration/intervention-gates.test.ts
tests/integration/intervention-definition-lifecycle.test.ts
tests/integration/intervention-idempotency.test.ts
tests/integration/intervention-concurrency.test.ts
tests/integration/intervention-atomicity.test.ts
tests/integration/intervention-audit.test.ts
tests/integration/intervention-production-unavailable.test.ts
~~~

File grouping may be consolidated, but no scenario coverage may disappear.

### Dependencies

T1602–T1611.

### Mechanical execution

Create a traceability matrix in tests/comments or a test evidence report that proves:

- FR-001–FR-064 each have one or more executable/static tests;
- AS-001–AS-040 each have a named test;
- no acceptance scenario is satisfied only by a fixture value without exercising its gate.

Minimum suites:

1. Domain identity/version/hash/immutability.
2. Approval integration: valid isolated proof, missing/wrong qualification, revoked/expired Staff, wrong scope/hash/version, expired proof, fixture isolation.
3. Authorization/RLS: cross-family/case, Staff-vs-household, unauthorized mutation, anti-enumeration.
4. Gates: age, Formulation, Evidence, exclusion, participation, Consent, Compliance, Safety, conflict.
5. Idempotency/concurrency/atomicity.
6. Production-unavailable gate.
7. Static architecture guard.

### Verification

Coverage audit reports:

~~~text
FR 64/64
AS 40/40
NS 30/30 guarded
~~~

### FR mapping

FR-001–FR-064.

### AS mapping

AS-001–AS-040.

### NS mapping

NS-001–NS-030.

### Negative tests

All negative matrices from T1602–T1611.

### Failure tests

All failure families from plan.md §12.

### Scope guard

Tests may prove unavailable/blocked behavior but cannot seed production truth.

---

## T1613 — Static Architecture / Negative-Scope Guard

### Goal

Mechanically prevent duplicate Authority and Phase-4/RAG scope creep.

### Expected files/modules

~~~text
tests/architecture/intervention-authority-guard.test.ts
tests/architecture/intervention-test-fixture-isolation.test.ts
tests/architecture/intervention-negative-scope.test.ts
~~~

### Dependencies

T1602–T1612.

### Mechanical execution

Guard against production additions matching or semantically equivalent to:

- generic Professional CMS / Content Platform;
- expert marketplace;
- reviewer registry/platform;
- qualification registry/platform;
- reviewer_assignments_v2 / professional_staff / expert_users / admin_reviewers;
- duplicate staff_assignments;
- generic approval workflow/approval truth;
- approved boolean or reviewed_by_role as authority;
- ADMIN=true universal authority;
- intervention_package_registry / intervention_scene_registry;
- second Scene Manifest/routing owner;
- second Case phase/status owner;
- duplicate Evidence/Formulation/Consent/Compliance/Safety owner;
- production import from tests/support;
- AI/RAG reviewer/approval/publish;
- developer/fixture production approval;
- auto-PUBLISHED production seed;
- InterventionInstance;
- Goal;
- Plan/PlanVersion activation;
- Task;
- Checkin;
- Review;
- Outcome;
- Follow-up Schedule;
- Notification;
- Professional Knowledge owner;
- RAG;
- pgvector/embedding/reranking;
- Context Builder;
- AI Task Runtime/model gateway;
- legal interpretation/platform.

The guard must be semantic/path-aware enough not to flag historical specs/docs as production implementation.

### Verification

Intentionally mutate representative forbidden patterns in test fixtures or source strings and prove guard fails non-vacuously.

### FR mapping

FR-012, FR-018–FR-020, FR-029, FR-032, FR-048, FR-050, FR-054, FR-060, FR-063.

### AS mapping

AS-003–AS-005, AS-037–AS-040.

### NS mapping

NS-001–NS-030.

### Negative tests

The guard itself is the negative test suite.

### Failure tests

Guard must fail if forbidden production pattern is introduced and pass on historical documentation/reference text.

### Scope guard

This task changes tests only.

---

## T1614 — Exact-Head Final Development Verification and Slice 17 Consumer Seam Read-back

### Goal

Finish development with an exact-head evidence set suitable for independent Audit 2, without merging.

### Expected files/modules

No new product functionality. Test/evidence metadata only if repository convention requires it.

### Dependencies

T1601–T1613.

### Mechanical execution

1. Re-read exact implementation Head.
2. Re-read origin/main and calculate ahead/behind/merge-base.
3. Confirm Frozen Spec blob still exact.
4. Confirm only intended Slice 16 implementation/test/migration files changed.
5. Confirm old Slice 16 historical spec/plan untouched.
6. Confirm Docs unchanged.
7. Confirm no Phase 4/RAG/AI/duplicate-owner files.
8. Confirm migration number was then-next and all prior migrations unchanged.
9. Run lint/typecheck/static checks.
10. Run migration fresh/upgrade/checksum suites.
11. Run all Slice 16 domain/integration/architecture tests.
12. Run full repository CI-equivalent suite.
13. Confirm production provider remains unavailable and production approval/release gates remain BLOCKED.
14. Read back Slice 17 interface expectations without editing Slice 17. Confirm Slice 16 exposes:
    - exact definition id/version/hash;
    - professional approval proof ref/status/provenance;
    - exact scene/package binding;
    - source refs;
    - bounded eligibility/freshness refs.
15. Produce Development final report for independent Audit 2.
16. Do not perform Audit 2 and do not merge.

### Verification

Required final development state:

~~~text
Frozen Spec Integrity: PASS
FR Coverage: 64/64
AS Coverage: 40/40
NS Guard Coverage: 30/30
Development Implement Gate: PASS
Production Professional Approval Gate: BLOCKED
Production Publication / Release Gate: BLOCKED
Development performed: YES
Audit 2 performed: NO
Merge performed: NO
~~~

### FR mapping

FR-001–FR-064 read-back.

### AS mapping

AS-001–AS-040 read-back.

### NS mapping

NS-001–NS-030 read-back.

### Negative tests

Final architecture guard and production-unavailable proof.

### Failure tests

Any head drift during verification, failed full suite, spec/doc mutation, migration history mutation, duplicate Authority, fake professional truth or scope leakage blocks handoff.

### Scope guard

Stop after development report. Independent Audit 2 is a different role.

---

## Task dependency graph

~~~text
T1601
  ↓
T1602
  ├──────────────┐
  ↓              ↓
T1603          T1604
  └──────┬───────┘
         ↓
       T1605
         ↓
       T1606
         ↓
       T1607
      ↙     ↘
   T1608   T1610
      ↓      ↓
   T1609     │
      └──┬───┘
         ↓
       T1611
         ↓
       T1612
         ↓
       T1613
         ↓
       T1614
~~~

Development Tasks: 14.

## Mechanical completion rule

Development is complete only when every task T1601–T1614 is either PASS or development stopped because the semantic-drift stop boundary fired. There is no “partial green CI means complete” shortcut.
