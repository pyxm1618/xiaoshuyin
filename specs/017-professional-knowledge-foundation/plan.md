# Implementation Plan: Slice 17 — Professional Knowledge Foundation — Authority-Reconciled

**Feature**: `specs/017-professional-knowledge-foundation/spec.md`  
**Planning role**: Slice 17 Authority-Reconciled Plan AI 2  
**Date**: 2026-11-17  
**V1 Phase**: Phase 3 foundation only; retrieval/RAG remains downstream  
**Frozen Spec branch**: `spec/017-professional-knowledge-foundation-authority-reconciliation`  
**Frozen Spec commit**: `9763bfd796aca9dbac20a94137dc330ef2b15971`  
**Frozen Spec blob**: `83222f41929689f5d98ca45027c78a262ae6449f`  
**Planning baseline `origin/main`**: `46659c5c0a8ab1a3b322b7601722123bef8f88ce`  
**Previous planning package**: `SUPERSEDED` — historical only; no task or design below is inherited from it.

## Upstream Traceability

This plan is a downstream implementation projection only. It does not amend the four Authority Docs or the Frozen Spec.

Authority inputs at planning time:

| Authority input | Exact blob |
|---|---|
| `Docs/总产品需求.md` | `97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29` |
| `Docs/V1产品需求.md` | `8eb660cd905d8fba4b52fe0f74bbc214b3113117` |
| `Docs/总体技术架构.md` | `6b4630803f371faf6d93f27361070223d0f661a0` |
| `Docs/V1技术设计.md` | `a0f09b8afda5532870150f03b713fed107359849` |
| `.specify/authority-inputs.json` | `0ab9f2d8534ef449ca3ed0ab6c1a1548179f878d` |

Primary upstream anchors: `Docs/总体技术架构.md` §6, §11, §19A; `Docs/V1技术设计.md` §7.0, §7.5, §7.10, §8, §9, §9.1, §12.1, §12.3B.5, §13, §28.10, §29, §30; and the frozen Slice 17 `FR-001..FR-052`, `AS-001..AS-050`, `NS-001..NS-024`.

## Summary

Build the smallest authoritative Professional Knowledge truth layer that can safely exist before a real Professional Reviewer is assigned. Slice 17 owns stable Knowledge identity, exact semantic versions, source-provenance snapshots, review/validity projection, consumed external approval-proof evidence, deterministic Knowledge eligibility, and history. It **does not** own Professional Approval, professional qualification, Staff Authority, Scene Package, Professional Content Package, InterventionDefinition, family truth, Safety, Compliance, Consent, or any RAG/retrieval runtime.

The implementation is allowed to finish while the production release gate stays blocked. Correct completion may therefore be:

```text
Implementation: COMPLETE
Professional Production Release: BLOCKED
Production approved Knowledge: NONE
Blocking dependency: APPROVED PROFESSIONAL REVIEWER — UNASSIGNED
```

No test fixture, `approved=true`, code path, database status, Staff role, AI output, or CI success may convert that blocked production posture into approval.

## Technical Baseline

**Runtime / language**: Node.js `26.13.0`, TypeScript, Bun `1.4.4`.  
**Database**: PostgreSQL 18, reviewed forward-only SQL migrations, Drizzle + node-postgres, UUIDv7.  
**Transactions**: existing caller-owned / Drizzle-owned single-connection seams in `apps/server/api/src/db/tx.ts` and `apps/server/api/src/db/drizzle-tx.ts`.  
**Authorization**: existing `authorize()` owner in `packages/authorization` plus `apps/server/api/src/authz.ts`; RLS remains independent defense.  
**Idempotency**: existing `idempotency_keys` + `packages/domain/src/idempotency.ts` + `apps/server/api/src/idempotency.ts`; no Knowledge-specific store.  
**Audit**: existing append-only `business_audit_events`; extend minimally if needed, never create a second general audit ledger.  
**Scene**: existing `packages/scenes/digital-use` package/version/manifest owner; no second Scene registry.  
**Testing**: Vitest, DB migration/evidence verification, static architecture guard, full `bun run verify-all`.  
**Deployment target**: existing V1 server/database stack; no new service, vector DB, CMS, credential system, or workflow engine.

## Constitution Check

| Gate | Decision |
|---|---|
| No new product semantics | PASS |
| No V2–V5 capability pulled into V1 | PASS |
| No A/010xx topology behavior changed | PASS |
| Frozen technical stack/exclusions respected | PASS |
| Deterministic eligibility remains deterministic | PASS |
| Authorization/Consent/RLS/Safety/Compliance boundaries explicit | PASS |
| Provenance/version/history preserved | PASS |
| Failure/UNKNOWN/concurrency/idempotency designed | PASS |
| Concrete verification exists for every FR/AS/NS | PASS |

## P1 — Development-start Truth Gate and Gate Separation

`T1701` is mandatory, read-only, and runs before any implementation mutation. It re-fetches current `origin/main`, current Authority Doc blobs, Frozen Spec branch/commit/blob, new planning freeze head/blobs, Slice 16 PR/merge state, migration head, current Professional Knowledge search results, Staff/qualification/Scene/Professional Content/audit/idempotency/transaction owners, and duplicate-owner risks.

The developer **must not stop merely because** `APPROVED PROFESSIONAL REVIEWER — UNASSIGNED` remains true. That condition keeps `Professional Production Release Gate = BLOCKED` while `Development Implement Gate = OPEN`.

`T1701` stops implementation only if one of these becomes true:

1. Frozen Spec or Authority inputs drift incompatibly;
2. a merged equivalent Professional Knowledge owner now exists and the plan would duplicate it;
3. the current Scene/Staff/transaction/audit owners no longer offer a legal reuse/extension path;
4. implementation would require manufacturing Professional Approval/qualification/Staff authority;
5. a new upstream conflict makes the frozen semantics unimplementable without changing `spec.md` or Docs.

## P2 — Current Owner Inventory and Single-owner Decisions

| Truth / capability | Current owner at planning time | Merged? | Transaction / access note | Slice 17 decision |
|---|---|---:|---|---|
| Account authority | `apps/server/api/src/auth/account-authority.ts` | YES | authenticated identity boundary | Reuse |
| Family/Case authorization | `packages/authorization/src/authorize.ts`, `apps/server/api/src/authz.ts` | YES | current transaction facts | Extend only with bounded Knowledge-consumption action/purpose if required |
| Staff capability/assignment | `staff_assignments`, migration `021_safety_resolver_staff_authority.sql` | YES | existing Staff truth; runtime is read-only for authority rows | Reuse/minimally extend; no reviewer/admin table |
| Safety Staff resolver precedent | `packages/domain/src/safety/resolver-authority.ts` | YES | same-tx resolve/revalidate pattern | Learn pattern; do not copy Safety owner |
| Professional qualification | no merged production owner | NO | external dependency | Consumer port + fail-closed production default; no credential platform |
| Family RLS | DB policies + `apps/server/api/src/db/tx.ts`, `drizzle-tx.ts` | YES | one checked-out client / caller-owned composition | Reuse |
| Consent | `consent_records` and consent-chain owners | YES | existing owner | Consume only |
| Compliance | `packages/compliance`, `apps/server/api/src/compliance/evaluate-compliance.ts` | YES | authorization + compliance same REPEATABLE READ snapshot | Consume only |
| Safety | `packages/domain/src/safety`, `apps/server/api/src/safety` | YES | independent gate | Consume only |
| Case lifecycle | Common Core Case owner (`packages/domain/src/cases.ts` and Case services) | YES | canonical status/phase | Consume only |
| Evidence | `packages/domain/src/evidence.ts`, migration 004 | YES | canonical family Evidence | Consume only; never source professional Knowledge from family facts automatically |
| Problem Formulation | `packages/domain/src/problem-formulations.ts`, service + migrations 008/020 | YES | independent `review_state` precedent | Consume only |
| Scene topology / package identity | `packages/scenes/digital-use`, `DIGITAL_USE_PACKAGE_VERSION`, one `node-manifest.ts` | YES | package is code-owned immutable version authority today | Extend the same package owner with exact Knowledge refs only; no second registry |
| Scene runtime | `scene_node_states`, `scene_artifacts`, `packages/domain/src/scene-runtime-*` | YES | exact stored `scene_package_version` | Reuse |
| Professional Content consumer | `apps/server/api/src/services/digital-use-review-professional-content.ts` | YES | narrow Slice 15 consumer, fail-closed provider | Reuse pattern only; Slice 17 remains Knowledge owner |
| Professional Content Package registry | none on current main | NO | package authority is external/true owner | Do not create one |
| Professional Knowledge owner | none on current main | NO | selected Slice 17 truth | Create exactly one |
| Canonical professional source registry | none discovered on current main | NO | family `provenance.ts` is not professional source truth | Persist only opaque canonical refs + immutable Knowledge-review snapshots; reuse a canonical source owner if one exists at dev start |
| Shared idempotency | `idempotency_keys`, domain + API idempotency modules | YES | exact replay/mismatch; caller-owned tx helpers | Extend command vocabulary only |
| Business/domain audit | `business_audit_events`, append-only hardening migration 018 | YES | current main is family-shaped | Minimally extend existing owner for global professional assets; reconcile Slice 16 first if it merges |
| Migration authority | `db/migrations/*` | YES | current merged head 023 | Allocate next safe migration at development time; no pre-reserved number |
| InterventionDefinition | Slice 16 PR #57 candidate only | NO | Audit-1 re-read head `15fd5d7f7bc37d597200c81a8879785d5edeb1b2`; Spec Governance PASS; CI still running; unresolved P1 review threads | Optional integration unavailable/fail-closed until authoritative; never duplicate |

### Slice 16 classification

At Audit 1 re-read PR #57 is `OPEN`, `merged=false`, exact head `15fd5d7f7bc37d597200c81a8879785d5edeb1b2`. Spec Governance is `SUCCESS`; CI is still `IN_PROGRESS`; two Codex P1 review threads from the prior reviewed head remain unresolved on the current PR head. The branch is 16 commits ahead of the previously observed `6237a4f...`, but none of those commits are merged into `main`. It is therefore **candidate seam only**. Slice 17 may learn from its provider/revalidation shape, but no task may import its schema or treat candidate migration 024 as current-main truth. `T1701` reclassifies it from execution-time current truth at development start.

## P3 — Minimal Knowledge Persistence Model

Use a normalized minimum, not one-table-per-concept and not a giant JSON document.

### P3.1 `professional_knowledge_items`

Stable identity only: UUIDv7 id, stable server-owned key/code, creation metadata. It is the aggregate identity, not a release/approval status holder.

### P3.2 `professional_knowledge_versions`

One immutable semantic version row per item/version with:

- `item_id`, integer semantic `version`, `content_hash`, canonical `source_set_hash`;
- professional explanatory `content`;
- locale, scene/purpose, stage;
- age/development scope, applicability conditions, exclusions, risk metadata;
- optional exact explanatory `InterventionDefinition` reference (`id + exact version + hash`) only when an authoritative owner exists;
- `lifecycle_status`: `CANDIDATE | PUBLISHED | SUPERSEDED | RETIRED | EXPIRED`;
- `review_state`: `PENDING | CURRENT | NEEDS_REVIEW`;
- `validity_state`: `UNKNOWN | VALID | INVALID`;
- optimistic `revision`;
- `supersedes_id`, release/effective timestamps as needed;
- creator identity reference and immutable creation timestamps.

`EXPIRED` is reserved for a Knowledge release's own effective window. **External approval expiry must not move lifecycle to EXPIRED.**

Released semantic fields are immutable. Pre-release candidate edits increment `revision`; after publication, any substantive correction creates a successor semantic version.

Bounded JSON is allowed for typed applicability/exclusion/risk predicates where the current domain already uses structured payloads. Identity, lifecycle, hashes, version, review state, validity state, relations, and audit-critical fields stay first-class columns.

### P3.3 `professional_knowledge_source_snapshots`

Immutable per-version source evidence: canonical opaque `source_ref`, optional external version/hash/locator, source-set ordering/key, required/optional marker, and snapshot hash/time. It stores **no raw source body**, crawler result, OCR text, PDF archive, or generic ingestion state.

If an authoritative canonical professional source owner appears before implementation, these rows reference that identity rather than creating competing source truth.

### P3.4 `professional_knowledge_review_evidence`

Append-only historical professional review activity. It records exact Knowledge version/revision/hash/source-set, reviewer identity, the Staff authority reference used for the review operation, external qualification ref/scope/status evidence, review activity/result, and timestamps.

It deliberately has **no local `APPROVED` meaning**. A recorded review can coexist with no Professional Approval.

### P3.5 `professional_knowledge_approval_evidence`

Append-only bounded evidence of an **external** proof that Slice 17 actually consumed/revalidated. It records proof identity/digest, exact Knowledge item/version/hash/source-set/scope, reviewer identity, exact Staff authority reference, professional qualification ref/scope, effective period, provider outcome, and optional exact Professional Content Package container identity.

This row is evidence of consumption, not the authority source. Production eligibility always revalidates current external truth.

### P3.6 Explicitly not created

No `knowledge_idempotency`; no `knowledge_embeddings`; no chunks; no raw-source archive; no reviewer/qualification registry; no `knowledge_package_inclusions` by default; no `scene_packages`; no generic Professional Content Package registry; no Knowledge-owned InterventionDefinition table; no new generic audit ledger.

## P4 — Professional Administration and External Authority Composition

### P4.1 Administration actor authority

Candidate create/edit/unpublished read/history/retire/supersede are professional-asset administration operations. They require the existing Staff Authority owner and a current `PROFESSIONAL_REVIEW` assignment in its actual current scope. Family Manager/Guardian/participant status never qualifies.

A narrow Professional Review Staff resolver may be added **over `staff_assignments`** only if current owner APIs do not expose the required check. It may not create a second Staff store. Where proof validation needs to validate a reviewer other than the current release actor, use a narrow trusted validation function/owner seam that validates an exact `staff_assignment` reference; do not weaken RLS or infer authority from proof text.

### P4.2 Qualification boundary

Professional qualification stays external. Define a narrow provider with discriminated outcomes:

```text
VALID(exact qualification ref + scope)
INVALID(missing/revoked/expired/mismatched/unverifiable)
UNAVAILABLE(provider/transport/timeout)
```

No local qualification table, hard-coded profession, test-only default, or staff-role inference.

### P4.3 Professional Approval provider

Define a Knowledge-specific external consumer port with **non-null discriminated outcomes**:

```text
RESOLVED(exact proof)
INVALID(reason: missing/revoked/expired/mismatch/not-approved/...)
UNAVAILABLE(reason: timeout/provider/transport/...)
```

A resolved proof is locally revalidated against exact Knowledge item/version/hash/source-set/scope, reviewer identity, exact Staff authority ref/capability/scope, external qualification ref/scope/status, approval proof identity, review/approval status, effective period, and optional Professional Content Package member binding.

Provider outage is `DEPENDENCY_UNAVAILABLE`; a returned bad/expired/mismatched proof is `INVALID`. Never translate one into the other.

Production composition uses an explicitly unavailable/fail-closed provider until a real authority is connected. There is no environment flag or `approved=true` shortcut. Synthetic providers live in test-only modules and architecture guards prove they are absent from production import/composition paths.

### P4.4 Publisher rule

Do not add `PUBLISHER`, a publisher registry, mandatory second approver, or reviewer/publisher separation. Release is an authorized Staff operation that additionally requires a valid current exact external approval proof. The release actor need not be inferred to be the reviewer and no equality/inequality rule is invented.

## P5 — Source, Professional Content Package, Scene Package, and Intervention Boundaries

### P5.1 Professional source provenance

`professional_knowledge_source_snapshots` owns only the immutable Knowledge-review snapshot/reference. Source correction/withdrawal is consumed as a dependency event/reference from the true source owner. Required source provenance that is unresolved/unverifiable blocks release.

### P5.2 Professional Content Package

Slice 17 does not create a package registry. If external approval is package-scoped, the approval provider must prove:

```text
package id + exact package version + package hash
+ exact member Knowledge id/version/hash/source-set/scope
+ exact approval proof
```

Slice 17 persists the bounded consumed evidence only. Package existence alone never authorizes Knowledge.

### P5.3 Scene Package binding — owner and physical representation

Binding authority is the existing Scene Package owner, not Knowledge.

Current main owns Digital Use Scene Package identity in `packages/scenes/digital-use` (`DIGITAL_USE_PACKAGE_VERSION = v1`) and persists that exact version on Scene runtime rows. It has no generic `scenario_packages` table. Therefore this plan does **not** invent one and does **not** create `knowledge_package_inclusions`.

The minimum implementation is:

1. extend the same versioned Scene Package owner with an immutable exact `professionalKnowledgeRefs` set (stable Knowledge id/key + exact semantic version + content hash/source-set hash);
2. historical package versions are never rewritten; a different set belongs to a successor Scene Package version;
3. current production `v1` may truthfully bind the empty set while no approved Knowledge exists;
4. Knowledge release may commit only when the exact target Scene Package version already proves an exact binding to that Knowledge version through this owner seam;
5. release stores an immutable binding snapshot/reference in its own release/audit evidence, but does not become the binding authority;
6. if development-start truth shows a different authoritative Scene storage seam now exists, T1701 replaces the physical mechanism with that owner seam while preserving these semantics.

Because a code-owned Scene Package version is immutable, release *verifies* a pre-existing exact owner binding rather than mutating Scene authority inside the Knowledge transaction. If current truth instead exposes transactional delegated Scene storage, the same caller-owned release transaction must use that delegated owner function. If neither a stable immutable read seam nor a legal same-transaction delegated seam exists, implementation stops rather than creating a Knowledge-owned inclusion table.

### P5.4 InterventionDefinition

Core Knowledge foundation has no dependency on Slice 16. If Slice 16 is merged/authoritative at development start, an optional explanatory reference can validate exact `InterventionDefinition id + version + hash` through that owner. If not, the optional integration remains unavailable/fail-closed. Knowledge approval never approves an InterventionDefinition; Intervention approval never approves Knowledge.

## P6 — Lifecycle, Review/Validity, and Dependency Propagation

Three independent dimensions are enforced:

```text
lifecycle_status: CANDIDATE | PUBLISHED | SUPERSEDED | RETIRED | EXPIRED
review_state:     PENDING | CURRENT | NEEDS_REVIEW
validity_state:   UNKNOWN | VALID | INVALID
external approval: resolved dynamically from current authority
```

Rules:

- `NEEDS_REVIEW` is never a lifecycle value.
- Candidate edit changes `revision`, not semantic version.
- Publication freezes semantic fields.
- A substantive published change creates a successor.
- `PUBLISHED + NEEDS_REVIEW` is historically published but ineligible for new production use.
- `INVALID` is a fail-closed validity outcome, not a fake retirement transition.
- no-material-impact review may restore `CURRENT/VALID` on the same version.
- material change creates a successor and requires fresh approval.
- source withdrawal/correction affects only Knowledge versions whose exact source snapshot is impacted.
- approval expiry/revocation stops eligibility but **does not** change lifecycle or force a new content version; a later valid exact proof may restore eligibility for the same version when content/hash/source/scope are unchanged.
- Staff/qualification revocation preserves historical evidence but invalidates current eligibility when the current approval contract no longer validates.
- Scene Package supersession alone never marks Knowledge `NEEDS_REVIEW`; only a material applicability/meaning/risk-context change affects the exact dependent Knowledge.
- optional InterventionDefinition supersession affects only Knowledge that references that exact definition and only when the change may alter explanation/applicability.

No global “invalidate all Knowledge” operation is accepted.

## P7 — Deterministic Production Eligibility

One pure/domain decision receives only authoritative, already-resolved facts and returns `ELIGIBLE | INELIGIBLE | UNKNOWN_DEPENDENCY` with internal reason codes.

New downstream production use requires all applicable facts:

1. exact Knowledge identity/version/hash exists;
2. lifecycle is `PUBLISHED`;
3. review state is `CURRENT`;
4. validity state is `VALID`;
5. exact external approval proof is valid now;
6. exact Scene Package version binding contains the exact Knowledge version/hash;
7. any Professional Content Package proof/member binding matches exactly;
8. scene, purpose, stage, locale, age/development, applicability, exclusion and risk hard filters match;
9. any optional upstream professional reference is sufficiently current;
10. family-facing caller is separately authorized and Consent/Compliance/Safety pass when the use is family-scoped.

Missing/UNKNOWN required metadata or authority fails closed. There is no nearest version, floating latest, stale cache, draft, alternate package, or model-generated replacement.

The resolver must final-revalidate external proof at the authoritative consumption boundary whenever a stale-proof race is possible.

## P8 — Authorization, RLS, Consent, Compliance, Safety, Anti-enumeration

Professional administration and family consumption are separate authorization surfaces.

### Professional administration

Use identity-scoped transaction context plus the existing Staff Authority. New Knowledge tables use `ENABLE/FORCE RLS`, least-privilege grants, and policies that expose unpublished/admin rows only to properly verified professional Staff operations. No Family membership path can satisfy admin RLS.

### Family-facing consumption

Use the existing single `authorize()` entry point with an explicit bounded Knowledge-consumption action/purpose if the current action vocabulary has no suitable existing action. In the same family RLS transaction:

```text
authenticated actor
→ exact target Family/Case/purpose authorization
→ Consent
→ Compliance
→ Safety
→ exact Knowledge eligibility
→ bounded content response
```

Knowledge never changes any of those external truths.

Unauthorized/unauthorized-scope requests must collapse object existence and professional internals. A non-authorized caller cannot distinguish unknown Knowledge, known-but-unauthorized, unpublished/candidate, NEEDS_REVIEW, retired, wrong package, invalid approval, reviewer identity, or qualification detail from the external error matrix. Internal reason codes remain bounded and auditable. Infrastructure failures remain 5xx/dependency-unavailable rather than being collapsed into authorization denial.

## P9 — Idempotency, Concurrency, Atomicity, and Timeout Readback

### Shared idempotency only

Extend the existing command vocabulary for the minimal business commands, expected to include:

- create candidate;
- edit candidate;
- create successor;
- record professional review activity/result;
- release/publish;
- retire/supersede;
- validity/review transition caused by a dependency event.

A Scene binding mutation is **not** a Knowledge command when binding remains code-owned immutable Scene Package metadata. If the current Scene owner later exposes a delegated binding command, its idempotency stays with that owner.

### Concurrency strategy

- candidate edit: row/aggregate lock + expected `revision` CAS;
- review vs edit: review evidence binds exact revision/hash/source-set; changed candidate makes review stale;
- approval arrival vs edit: approval proof must match final locked hash/source-set;
- release vs edit: lock exact version; once published semantic columns become immutable;
- release vs retire/supersede/two release attempts: deterministic lock ordering + state/revision CAS + shared idempotency;
- retire vs successor: lock chain head and exact predecessor; one authoritative result;
- validity propagation vs release: lock exact version/dependency row and re-read review/validity immediately before transition;
- package binding race: verify immutable exact Scene package binding, or use the Scene owner's own serialization if it is transactional;
- stale proof: final external revalidation immediately before state transition;
- stale revision: 409/conflict equivalent; never last-write-wins.

### Authoritative release transaction

Use one caller-owned existing transaction/checked-out connection. A successful release atomically:

1. verifies actor Staff authority;
2. locks exact Knowledge item/version and validates expected revision;
3. verifies complete source/metadata and `CURRENT/VALID`;
4. verifies exact Scene Package binding through its owner;
5. resolves and final-revalidates exact external Professional Approval + qualification + Staff-assignment proof facts;
6. transitions lifecycle to `PUBLISHED` with release timestamps;
7. appends bounded external approval evidence + exact Scene binding snapshot;
8. appends `business_audit_events`;
9. settles the existing shared idempotency record.

Any database failure rolls back all Slice-owned effects. External authority calls are not transactionally owned; therefore only the final validated proof is persisted, and later use must revalidate current authority.

A client timeout/connection loss after submit is `OUTCOME_UNKNOWN`. Recovery uses shared idempotency readback and exact Knowledge version/history; no blind retry that can create a second release.

## P10 — Audit and Historical Read

Extend the existing `business_audit_events` owner, not a private ledger. At development start:

- if Slice 16 has merged and already widened this owner for global professional assets, reuse that shape and extend only allowed resource/event vocabularies;
- otherwise use the smallest forward-only extension required for `PROFESSIONAL_KNOWLEDGE`, keeping family-scoped audit semantics unchanged.

Audit candidate creation/edit, review evidence, external proof resolve/revalidate result, release, supersede/retire/Knowledge expiry, `NEEDS_REVIEW`/restore/invalidate, source dependency handling, Scene binding snapshot, and bounded authority denial.

Audit metadata contains stable IDs, versions, hashes, proof refs/digests, reason codes, and scope identifiers—not family narratives, credentials, full copyrighted source text, or unnecessary reviewer personal data.

Authorized professional history may read exact retired/superseded versions and proof/binding snapshots; family consumers never gain unpublished-history browse authority.

## P11 — Release Command and Production Gate

Publication is a controlled internal/application command; no public API or CMS UI is required by this Slice. The implementation may expose internal administration service functions and tests only.

The release command must never create or infer Professional Approval. It only consumes current exact proof and commits a Knowledge lifecycle transition when every gate is true.

Production default remains:

```text
Professional Approval provider: unavailable/fail-closed
Professional qualification provider: unavailable/fail-closed where needed
Production approved/published Knowledge set: empty
Professional Production Release Gate: BLOCKED
```

The schema and deterministic release path may be fully implemented and protocol-tested with synthetic providers without changing this production truth.

## P12 — Data / Migration / Grant Strategy

Current merged migration head at planning time is `023_digital_use_review_runtime_authority_reconciled.sql`; Slice 16's `024` exists only in an unmerged PR. **No migration number is reserved by this plan.**

At T1701 the developer re-lists merged migrations and open competing PRs. If current merged schema cannot satisfy Slice 17, allocate the then-next conflict-safe forward-only migration after owner reconciliation. Never modify historical migrations.

The migration must verify:

- unique stable item key and `(item_id, semantic_version)`;
- single-successor/chain integrity as required;
- immutable released semantic columns;
- revision/CAS constraints;
- exact source/evidence foreign keys and uniqueness;
- `ENABLE/FORCE RLS`;
- runtime least privilege;
- shared idempotency command vocabulary extension;
- existing business audit owner extension only if required;
- no RAG/vector/chunk tables;
- no reviewer/qualification/Scene/Professional Content package registry.

## P13 — AI, Test Fixtures, Scope, and Final Posture

AI may produce candidate draft text only inside an authorized supervised workflow. Slice 17 adds no model provider, agent, AI Task Runtime, prompt runtime, Context Builder, embedding, retrieval, reranking, Gold Dataset runtime, or Jev/Promptfoo production runtime.

Synthetic qualification/approval/Scene-binding fixtures exist only under test paths. Static/composition tests prove they cannot be imported/selected by production default composition, including via environment variables.

No operations UI, generic CMS, generic approval engine, credentialing system, marketplace, publisher role, or generic RBAC is required.

Final implementation convergence must prove all 52 FR, 50 AS and 24 NS, run `bun run verify-all`, re-read current remote truth, and explicitly report that implementation completeness does not open the Professional Production Release Gate.

## Project Structure

Expected touch surface; T1701 must reconcile paths with current main before writing:

**New Slice-owned domain/application files**
- `packages/domain/src/professional-knowledge.ts`
- `packages/domain/src/professional-knowledge-schema.ts`
- `packages/domain/src/professional-knowledge-repository.ts`
- `apps/server/api/src/services/professional-knowledge-authority.ts`
- `apps/server/api/src/services/professional-knowledge.ts`
- `apps/server/api/src/services/professional-knowledge-eligibility.ts`
- `apps/server/api/src/services/professional-knowledge-dependencies.ts`

**Existing owners that may receive minimal extensions**
- `packages/domain/src/idempotency.ts`
- `apps/server/api/src/idempotency.ts`
- `packages/authorization/src/authorize.ts`
- `apps/server/api/src/authz.ts`
- `packages/scenes/digital-use/types.ts` / same Scene Package owner seam
- existing audit repository/SQL owner
- `db/migrations/<next-safe-number>_professional_knowledge_foundation.sql` (number deliberately unresolved until T1701)

**Verification**
- `tests/professional-knowledge-foundation-domain.test.ts`
- `tests/professional-knowledge-authority-boundary.test.ts`
- `tests/professional-knowledge-provenance.test.ts`
- `tests/professional-knowledge-mutations.integration.test.ts`
- `tests/professional-knowledge-review-validity.integration.test.ts`
- `tests/professional-knowledge-approval-authority.test.ts`
- `tests/professional-knowledge-scene-binding.test.ts`
- `tests/professional-knowledge-eligibility.integration.test.ts`
- `tests/professional-knowledge-release.integration.test.ts`
- `tests/professional-knowledge-dependency-propagation.integration.test.ts`
- `tests/professional-knowledge-consumption.integration.test.ts`
- `tests/professional-knowledge-audit-readback.integration.test.ts`
- `tests/professional-knowledge-production-composition.guard.test.ts`
- `tests/professional-knowledge-reliability.integration.test.ts`
- `tests/professional-knowledge-architecture-guard.test.ts`

Exact file grouping may be reduced during implementation if fewer files preserve the same single-owner design. No public API route is required merely for completeness.

## Verification Plan

Targeted verification commands are attached to each task in `tasks.md`. The mandatory slice-level finish is:

```bash
bun run typecheck
bun run guard:static
bun run test
bun run db:migrate
bun run db:evidence
bun run verify-all
```

Database commands must run against the repository's supported clean test database environment. A command that cannot run is `NOT VERIFIED`, not PASS.

## Rollback / Recovery

Schema changes are forward-only. Do not edit historical migrations. If a new migration is unsafe before merge, add a forward remediation migration rather than rewriting applied history.

Runtime release mutations are transactional. A failed transaction leaves no published state. A lost client response is recovered from authoritative idempotency/history readback. A later approval expiry/revocation changes eligibility, not historical lifecycle; do not “rollback” a published version destructively.

## Complexity Exceptions

None. No approved requirement requires a second owner, generic platform, public API, CMS, credential system, RAG runtime, or publisher role.

## FR Traceability Matrix — 52/52

| FR | Requirement summary | Plan section | Development task(s) | Test / evidence |
|---|---|---|---|---|
| FR-001 | Exactly one Professional Knowledge owner; no duplicate InterventionDefinition or other existing truth owner. | P2 | T1701,T1703,T1717 | development-start remote-truth/owner gate transcript (git/GitHub read-back) |
| FR-002 | Stable Knowledge identity plus immutable exact semantic-version identity. | P3 | T1702,T1703,T1706 | tests/professional-knowledge-foundation-domain.test.ts |
| FR-003 | Publishable versions carry content, locale, scene/purpose, stage, age/development, applicability, exclusions, risk, and source provenance. | P3 | T1702,T1703 | tests/professional-knowledge-foundation-domain.test.ts |
| FR-004 | Missing required applicability metadata never widens to universal applicability. | P7 | T1702,T1710 | tests/professional-knowledge-foundation-domain.test.ts |
| FR-005 | Required source identity/provenance is reviewable; unresolved/unverifiable source provenance blocks release. | P5 | T1705,T1710,T1711 | tests/professional-knowledge-provenance.test.ts |
| FR-006 | Knowledge/source metadata must not contain Family/child identifiable data. | P3/P10 | T1702,T1714 | tests/professional-knowledge-foundation-domain.test.ts |
| FR-007 | Pre-release candidate content is never production selectable. | P6/P7 | T1706,T1710 | tests/professional-knowledge-mutations.integration.test.ts |
| FR-008 | Review activity/evidence is auditable but is not Professional Approval. | P4/P6 | T1707,T1714 | tests/professional-knowledge-review-validity.integration.test.ts |
| FR-009 | APPROVED requires current external exact Professional Approval proof bound to artifact/version/hash/source/scope/reviewer authority/qualification. | P4 | T1708,T1711 | tests/professional-knowledge-approval-authority.test.ts |
| FR-010 | Substantive content/source/applicability/exclusion/risk/scope change invalidates old approval match and requires successor/fresh review/approval. | P6/P9 | T1706,T1712 | tests/professional-knowledge-mutations.integration.test.ts |
| FR-011 | PUBLISHED requires complete metadata, exact current approval proof, and all release gates. | P6/P11 | T1711 | tests/professional-knowledge-release.integration.test.ts |
| FR-012 | Exact Scene Package version → Knowledge version set binding goes through the authoritative Scene Package owner; no floating latest. | P5 | T1709,T1711 | tests/professional-knowledge-scene-binding.test.ts |
| FR-013 | Production eligibility requires exact published + CURRENT/VALID + approved + scope matching Knowledge. | P7 | T1710 | tests/professional-knowledge-eligibility.integration.test.ts |
| FR-014 | Wrong scene/stage/age/applicability/exclusion/risk/locale/scope fails closed. | P7 | T1710 | tests/professional-knowledge-eligibility.integration.test.ts |
| FR-015 | Retired/superseded/expired Knowledge is unavailable for new production use while history remains. | P6/P10 | T1712,T1714 | tests/professional-knowledge-dependency-propagation.integration.test.ts |
| FR-016 | Terminal/superseded released content is not reactivated in place; correction uses a successor. | P6 | T1706,T1712 | tests/professional-knowledge-mutations.integration.test.ts |
| FR-017 | Released content and approved semantic metadata are immutable. | P3/P6 | T1703,T1706,T1711 | fresh-db migration + bun run db:evidence + RLS/grant assertions |
| FR-018 | Scene Package Knowledge-set history remains exact/inspectable under the Scene owner. | P5/P10 | T1709,T1714 | tests/professional-knowledge-scene-binding.test.ts |
| FR-019 | Knowledge and InterventionDefinition lifecycle/approval remain independent; any reference is exact and explanatory only. | P2/P5 | T1701,T1710,T1712 | development-start remote-truth/owner gate transcript (git/GitHub read-back) |
| FR-020 | Knowledge never decides Intervention eligibility, Plan activation, Safety, Case, or Problem Formulation truth. | P2/P7 | T1710,T1717 | tests/professional-knowledge-eligibility.integration.test.ts |
| FR-021 | Professional administration uses Staff authority; Family roles never grant it. | P4/P8 | T1704,T1713 | tests/professional-knowledge-authority-boundary.test.ts |
| FR-022 | Family-facing consumption composes actor/family/case/purpose Authorization. | P8 | T1713 | tests/professional-knowledge-consumption.integration.test.ts |
| FR-023 | Anti-enumeration protects Knowledge IDs/versions/packages/reviewer/approval/unpublished existence. | P8 | T1713 | tests/professional-knowledge-consumption.integration.test.ts |
| FR-024 | Knowledge cannot create, modify, or infer Consent. | P8 | T1713 | tests/professional-knowledge-consumption.integration.test.ts |
| FR-025 | Compliance remains external. | P8 | T1713 | tests/professional-knowledge-consumption.integration.test.ts |
| FR-026 | Safety remains external. | P8 | T1713 | tests/professional-knowledge-consumption.integration.test.ts |
| FR-027 | AI assistance may draft candidates only; AI cannot approve/publish. | P4/P13 | T1706,T1715 | tests/professional-knowledge-mutations.integration.test.ts |
| FR-028 | Mutating commands reuse shared exact-replay/mismatch idempotency semantics. | P9 | T1706,T1716 | tests/professional-knowledge-mutations.integration.test.ts |
| FR-029 | Stale revisions/concurrency cannot last-write-win. | P9 | T1706,T1716 | tests/professional-knowledge-mutations.integration.test.ts |
| FR-030 | Release/lifecycle action atomically commits Slice-owned state + exact proof/binding evidence + audit + idempotency. | P9/P11 | T1711,T1716 | tests/professional-knowledge-release.integration.test.ts |
| FR-031 | Partial failure rolls back; timeout is outcome-unknown until authoritative readback. | P9 | T1714,T1716 | tests/professional-knowledge-audit-readback.integration.test.ts |
| FR-032 | Audit is sufficient without leaking family narratives, credentials, full copyrighted sources, or unnecessary reviewer personal data. | P10 | T1714 | tests/professional-knowledge-audit-readback.integration.test.ts |
| FR-033 | Dependency propagation is impact-scoped. | P6 | T1712,T1716 | tests/professional-knowledge-dependency-propagation.integration.test.ts |
| FR-034 | No RAG/embedding/chunking/retrieval/reranking/fusion/Context Builder/AI Task Runtime in Slice 17. | P13 | T1715,T1717 | tests/professional-knowledge-production-composition.guard.test.ts + guard:static |
| FR-035 | Synthetic authority fixtures are protocol-test only and structurally unreachable from production authority. | P4/P13 | T1715 | tests/professional-knowledge-production-composition.guard.test.ts + guard:static |
| FR-036 | Wrong/unknown package/version/hash/proof never falls back to a nearby version. | P7 | T1710,T1716 | tests/professional-knowledge-eligibility.integration.test.ts |
| FR-037 | An empty approved set remains empty/unavailable; no synthetic approved content. | P7/P13 | T1710,T1715 | tests/professional-knowledge-eligibility.integration.test.ts |
| FR-038 | No duplicate Evidence/Problem Formulation/Memory/family truth. | P2/P13 | T1701,T1717 | development-start remote-truth/owner gate transcript (git/GitHub read-back) |
| FR-039 | Stale downstream cache cannot establish production eligibility. | P7/P9 | T1710,T1716 | tests/professional-knowledge-eligibility.integration.test.ts |
| FR-040 | Development Implement Gate and Professional Production Release Gate remain independent. | P1/P13 | T1701,T1718 | development-start remote-truth/owner gate transcript (git/GitHub read-back) |
| FR-041 | Lifecycle is separate from review/validity; NEEDS_REVIEW is not a lifecycle value. | P3/P6 | T1702,T1703,T1707 | tests/professional-knowledge-foundation-domain.test.ts |
| FR-042 | NEEDS_REVIEW suppresses new production use without mechanically changing lifecycle. | P6/P7 | T1707,T1710,T1712 | tests/professional-knowledge-review-validity.integration.test.ts |
| FR-043 | Review resolution: no material impact restores CURRENT/VALID; material change creates successor+fresh approval; unusable becomes invalid. | P6 | T1707,T1712 | tests/professional-knowledge-review-validity.integration.test.ts |
| FR-044 | PROFESSIONAL_REVIEW Staff capability/assignment is necessary operation authority but not qualification or approval. | P4 | T1704,T1708 | tests/professional-knowledge-authority-boundary.test.ts |
| FR-045 | Professional qualification is an independent external fact. | P4 | T1704,T1708 | tests/professional-knowledge-authority-boundary.test.ts |
| FR-046 | Approval proof exactly binds Knowledge identity/version/hash/source/scope/reviewer authority/qualification/effective period. | P4 | T1708,T1711 | tests/professional-knowledge-approval-authority.test.ts |
| FR-047 | Authority dependency unavailable is internally distinct from invalid/mismatched/expired/revoked proof. | P4/P9 | T1708,T1716 | tests/professional-knowledge-approval-authority.test.ts |
| FR-048 | Slice 17 may persist bounded immutable consumed-proof evidence but persistence is never the Approval Authority. | P4/P10 | T1708,T1714 | tests/professional-knowledge-approval-authority.test.ts |
| FR-049 | Professional Content Package and Scene Package are distinct; Slice 17 creates neither a second registry. | P5 | T1709,T1710,T1717 | tests/professional-knowledge-scene-binding.test.ts |
| FR-050 | Reviewer unassigned blocks production release, not development of fail-closed foundation. | P1/P13 | T1701,T1715,T1718 | development-start remote-truth/owner gate transcript (git/GitHub read-back) |
| FR-051 | Reuse canonical source identity when it exists; Slice 17 owns only Knowledge-specific immutable source snapshot/reference. | P5 | T1705,T1717 | tests/professional-knowledge-provenance.test.ts |
| FR-052 | Do not invent publisher capability or reviewer/publisher separation of duties; release is authorized Staff operation + valid exact proof. | P4/P11 | T1704,T1711,T1717 | tests/professional-knowledge-authority-boundary.test.ts |

## Acceptance Scenario Matrix — 50/50

| AS | Scenario summary | Task(s) | Verification evidence |
|---|---|---|---|
| AS-001 | Candidate persists but remains non-production. | T1702,T1706 | tests/professional-knowledge-foundation-domain.test.ts |
| AS-002 | No approval proof → release denied. | T1708,T1711 | tests/professional-knowledge-approval-authority.test.ts |
| AS-003 | Valid Staff capability but missing qualification → no approval/review authority. | T1704,T1707 | tests/professional-knowledge-authority-boundary.test.ts |
| AS-004 | Valid qualification but missing Staff authority → no approval/review authority. | T1704,T1707 | tests/professional-knowledge-authority-boundary.test.ts |
| AS-005 | Family authority does not grant Knowledge administration. | T1704,T1713 | tests/professional-knowledge-authority-boundary.test.ts |
| AS-006 | AI/developer/approved=true/test success cannot create approval. | T1708,T1715 | tests/professional-knowledge-approval-authority.test.ts |
| AS-007 | Synthetic authority provider is unreachable from production composition. | T1702,T1706 | tests/professional-knowledge-foundation-domain.test.ts |
| AS-008 | Exact real valid proof can satisfy approval gate. | T1708,T1711 | tests/professional-knowledge-approval-authority.test.ts |
| AS-009 | Wrong Knowledge version fails. | T1708,T1710 | tests/professional-knowledge-approval-authority.test.ts |
| AS-010 | Wrong content hash fails. | T1708,T1710 | tests/professional-knowledge-approval-authority.test.ts |
| AS-011 | Changed source refs/provenance fails. | T1705,T1708 | tests/professional-knowledge-provenance.test.ts |
| AS-012 | Wrong approval scope fails. | T1708,T1710 | tests/professional-knowledge-approval-authority.test.ts |
| AS-013 | Revoked/expired/unverifiable Staff authority fails. | T1704,T1708 | tests/professional-knowledge-authority-boundary.test.ts |
| AS-014 | Missing/revoked/expired/unverifiable qualification fails. | T1704,T1708 | tests/professional-knowledge-authority-boundary.test.ts |
| AS-015 | Approval expiry/revocation stops new production use without lifecycle rewrite. | T1708,T1712 | tests/professional-knowledge-approval-authority.test.ts |
| AS-016 | Provider unavailable remains dependency-unavailable, not a business 'not approved' conclusion. | T1708,T1716 | tests/professional-knowledge-approval-authority.test.ts |
| AS-017 | Reviewed but no external APPROVED proof remains non-production. | T1707,T1708 | tests/professional-knowledge-review-validity.integration.test.ts |
| AS-018 | Valid APPROVED proof without publication remains unavailable to family production use. | T1711,T1710 | tests/professional-knowledge-release.integration.test.ts |
| AS-019 | PUBLISHED + NEEDS_REVIEW is excluded from new production use. | T1707,T1710 | tests/professional-knowledge-review-validity.integration.test.ts |
| AS-020 | No-material-impact re-review restores CURRENT/VALID without lifecycle mutation. | T1707,T1712 | tests/professional-knowledge-review-validity.integration.test.ts |
| AS-021 | Material source/content/scope change creates successor and requires fresh approval. | T1706,T1712 | tests/professional-knowledge-mutations.integration.test.ts |
| AS-022 | Source withdrawal that invalidates current use immediately suppresses new use while historical citation remains. | T1705,T1712 | tests/professional-knowledge-provenance.test.ts |
| AS-023 | Approval expiry with unchanged content/hash/source/scope can later regain eligibility on same exact Knowledge version with a new valid proof. | T1708,T1712 | tests/professional-knowledge-approval-authority.test.ts |
| AS-024 | Scene Package v1 historical binding remains unchanged when v2 binds a different Knowledge set. | T1709,T1712 | tests/professional-knowledge-scene-binding.test.ts |
| AS-025 | Scene Package supersession alone does not mark unrelated Knowledge NEEDS_REVIEW. | T1709,T1712 | tests/professional-knowledge-scene-binding.test.ts |
| AS-026 | Material Scene Package applicability change marks only affected Knowledge NEEDS_REVIEW. | T1709,T1712 | tests/professional-knowledge-scene-binding.test.ts |
| AS-027 | Exact InterventionDefinition reference supersession may mark affected Knowledge NEEDS_REVIEW but never changes Intervention eligibility. | T1710,T1712 | tests/professional-knowledge-eligibility.integration.test.ts |
| AS-028 | Knowledge explaining an unapproved Intervention does not make that Intervention eligible. | T1710 | tests/professional-knowledge-eligibility.integration.test.ts |
| AS-029 | Wrong scene/stage fails with no fallback. | T1710 | tests/professional-knowledge-eligibility.integration.test.ts |
| AS-030 | Wrong age/development fails. | T1710 | tests/professional-knowledge-eligibility.integration.test.ts |
| AS-031 | Missing/UNKNOWN required applicability fails closed. | T1710 | tests/professional-knowledge-eligibility.integration.test.ts |
| AS-032 | Exclusions/incompatible risk block eligibility. | T1710 | tests/professional-knowledge-eligibility.integration.test.ts |
| AS-033 | Wrong Scene Package version never floats to latest. | T1709,T1710 | tests/professional-knowledge-scene-binding.test.ts |
| AS-034 | Wrong Professional Content Package id/version/hash cannot authorize Knowledge. | T1708,T1710 | tests/professional-knowledge-approval-authority.test.ts |
| AS-035 | Package existence without valid proof is not approval. | T1708,T1710 | tests/professional-knowledge-approval-authority.test.ts |
| AS-036 | Exact Professional Content Package covers Knowledge only when the proof's member binding matches exact Knowledge version/hash/source/scope. | T1708,T1710 | tests/professional-knowledge-approval-authority.test.ts |
| AS-037 | Retired/superseded/expired history remains authorized-history-readable but cannot serve new production use. | T1712,T1714 | tests/professional-knowledge-dependency-propagation.integration.test.ts |
| AS-038 | Published correction never overwrites history. | T1706,T1712 | tests/professional-knowledge-mutations.integration.test.ts |
| AS-039 | Same idempotency key + same command/payload replays exact result. | T1706,T1716 | tests/professional-knowledge-mutations.integration.test.ts |
| AS-040 | Same key with different payload conflicts and does not duplicate mutation. | T1706,T1716 | tests/professional-knowledge-mutations.integration.test.ts |
| AS-041 | Concurrent release/supersede/retire operations cannot commit contradictory truth. | T1711,T1716 | tests/professional-knowledge-release.integration.test.ts |
| AS-042 | Stale expected revision or stale proof cannot overwrite current truth. | T1706,T1708,T1716 | tests/professional-knowledge-mutations.integration.test.ts |
| AS-043 | Partial transaction failure cannot leave half-published Knowledge. | T1711,T1716 | tests/professional-knowledge-release.integration.test.ts |
| AS-044 | Lost response is reconciled by authoritative readback/idempotency. | T1714,T1716 | tests/professional-knowledge-audit-readback.integration.test.ts |
| AS-045 | Wrong family/case/purpose denies without existence disclosure. | T1713 | tests/professional-knowledge-consumption.integration.test.ts |
| AS-046 | Consent withdrawal blocks family downstream use while generic immutable Knowledge history remains. | T1713 | tests/professional-knowledge-consumption.integration.test.ts |
| AS-047 | Compliance restriction blocks delivery even when Knowledge metadata appears compatible. | T1713 | tests/professional-knowledge-consumption.integration.test.ts |
| AS-048 | Safety Hold/decision blocks delivery even when Knowledge text appears safe. | T1713 | tests/professional-knowledge-consumption.integration.test.ts |
| AS-049 | Empty approved/published set remains truthfully empty. | T1710,T1715 | tests/professional-knowledge-eligibility.integration.test.ts |
| AS-050 | Reviewer unassigned permits implementation completion but production release remains blocked with zero fake approved Knowledge. | T1715,T1718 | tests/professional-knowledge-production-composition.guard.test.ts + guard:static |

## Negative Scope Matrix — 24/24

| NS | Forbidden expansion / proof obligation | Task(s) | Verification evidence |
|---|---|---|---|
| NS-001 | No knowledge_embeddings, embedding generation, pgvector/sparsevec work. | T1715,T1717 | tests/professional-knowledge-production-composition.guard.test.ts + guard:static |
| NS-002 | No retrieval/search/ranking/fusion/RRF/reranker/RAG implementation. | T1715,T1717 | tests/professional-knowledge-production-composition.guard.test.ts + guard:static |
| NS-003 | No chunking/parser/OCR/crawler/generic ingestion platform. | T1705,T1717 | tests/professional-knowledge-provenance.test.ts |
| NS-004 | No generic CMS. | T1717 | tests/professional-knowledge-architecture-guard.test.ts + traceability script |
| NS-005 | No reviewer marketplace. | T1717 | tests/professional-knowledge-architecture-guard.test.ts + traceability script |
| NS-006 | No credentialing/qualification-management platform. | T1704,T1717 | tests/professional-knowledge-authority-boundary.test.ts |
| NS-007 | No generic approval workflow engine. | T1708,T1717 | tests/professional-knowledge-approval-authority.test.ts |
| NS-008 | No generic RBAC or ADMIN=true. | T1704,T1717 | tests/professional-knowledge-authority-boundary.test.ts |
| NS-009 | No second Staff Authority. | T1701,T1704,T1717 | development-start remote-truth/owner gate transcript (git/GitHub read-back) |
| NS-010 | No second Professional Content Package registry. | T1709,T1717 | tests/professional-knowledge-scene-binding.test.ts |
| NS-011 | No second Scene Package registry, node Manifest, or router. | T1701,T1709,T1717 | development-start remote-truth/owner gate transcript (git/GitHub read-back) |
| NS-012 | No new/duplicate InterventionDefinition lifecycle, eligibility gate, or InterventionInstance owner. | T1701,T1710,T1717 | development-start remote-truth/owner gate transcript (git/GitHub read-back) |
| NS-013 | No new Safety/Authorization/Consent/Compliance owner. | T1713,T1717 | tests/professional-knowledge-consumption.integration.test.ts |
| NS-014 | No second Case/Evidence/Problem Formulation/Family Memory truth. | T1701,T1717 | development-start remote-truth/owner gate transcript (git/GitHub read-back) |
| NS-015 | No AI Task Runtime, Context Builder, TaskModelRegistry, model gateway, or agent framework. | T1715,T1717 | tests/professional-knowledge-production-composition.guard.test.ts + guard:static |
| NS-016 | No Jev production runtime or Promptfoo runtime. | T1715,T1717 | tests/professional-knowledge-production-composition.guard.test.ts + guard:static |
| NS-017 | No A4003 roleplay, Problem Formulation AI, or execution-support AI. | T1715,T1717 | tests/professional-knowledge-production-composition.guard.test.ts + guard:static |
| NS-018 | No Phase 4 Goal/Plan/Task/Checkin/Review/Outcome/Schedule/Notification runtime. | T1715,T1717 | tests/professional-knowledge-production-composition.guard.test.ts + guard:static |
| NS-019 | No raw professional-document archive or copyrighted-source redistribution. | T1705,T1717 | tests/professional-knowledge-provenance.test.ts |
| NS-020 | No automatic promotion of Family private records into Professional Knowledge. | T1705,T1717 | tests/professional-knowledge-provenance.test.ts |
| NS-021 | No fake reviewer/qualification/developer approval/AI approval/fixture promotion/approved=true laundering. | T1708,T1715,T1717 | tests/professional-knowledge-approval-authority.test.ts |
| NS-022 | No floating latest binding or historical rewrite. | T1709,T1712,T1717 | tests/professional-knowledge-scene-binding.test.ts |
| NS-023 | No Professional Approval authority created locally; only consume/validate external proof. | T1708,T1717 | tests/professional-knowledge-approval-authority.test.ts |
| NS-024 | No amendments to Docs, frozen spec, old planning package, Slice 16, or later authority artifacts. | T1701,T1717,T1718 | development-start remote-truth/owner gate transcript (git/GitHub read-back) |