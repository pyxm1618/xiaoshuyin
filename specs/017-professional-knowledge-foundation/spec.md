# Slice 17 — Professional Knowledge Foundation — Current-Main Formalization

> Repository: `pyxm1618/xiaoshuyin`  
> Feature: `017-professional-knowledge-foundation`  
> Phase: Phase 3 Entry / current-main reconciliation  
> Historical Frozen Spec: commit `9763bfd796aca9dbac20a94137dc330ef2b15971`, blob `83222f41929689f5d98ca45027c78a262ae6449f`  
> Historical Planning Freeze: `62020e02c908b870ff4aa445d068d6b09c19405a`  
> Current authority baseline at formalization: main `1f3ee477bbc1876dad0583b07f387a9d21f525c6`

This document does not replace the historical Frozen Spec as historical evidence. It formalizes the implementation that is actually present after current-main reconciliation and the Phase 2 authority/remediation work.

## Upstream Traceability

The current V1 authority requires Professional Content to remain a versioned asset whose existence is distinct from professional approval. In particular:

- `V1-D27`, `V1-D28`, and `V1-D29` preserve separate A5001 / A5002 review scopes.
- `V1-C34` requires explicit, revocable, scoped, auditable Staff Authority rather than a universal ADMIN role.
- `A5001`, `A5002`, and `01000` may use professional questionnaire/content only when an exact current APPROVED/PUBLISHED Professional Content Package exists; otherwise production fails closed.
- The historical Slice 17 Frozen Spec remains provenance for the Professional Knowledge lifecycle, approval, package, source, authorization, reliability, and audit contracts.

No authority in this formalization permits a developer, fixture, schema flag, AI, RAG, or runtime convention to manufacture Professional Reviewer approval.

## Scope

Slice 17 owns the Professional Knowledge foundation required to represent, review, release, version, consume, invalidate, and audit professional content without creating a second Staff, approval, Scene package, Consent, Compliance, Safety, Case, or AI authority.

In scope:

- Professional Knowledge item and immutable version identity;
- lifecycle `CANDIDATE → PUBLISHED → SUPERSEDED/RETIRED/EXPIRED`;
- review state `PENDING/CURRENT/NEEDS_REVIEW` as a separate dimension;
- validity state `UNKNOWN/VALID/INVALID` as a separate dimension;
- exact source provenance and source-set hashing;
- exact Professional Approval semantic binding and consumed approval evidence;
- Staff `PROFESSIONAL_REVIEW` assignment validation without equating Staff Authority to professional qualification;
- release/publication authority;
- deterministic family-facing consumption of only eligible published/current/valid content;
- FORCE RLS and least-privilege grants;
- exact-replay idempotency, optimistic concurrency, durable bounded audit evidence, and fail-closed dependency semantics;
- forward-only migration ownership and clean/upgrade migration verification.

## Lifecycle and Versioning Contract

A newly created runtime version starts only as:

```text
lifecycle_status = CANDIDATE
review_state     = PENDING
validity_state   = UNKNOWN
revision         = 1
released_at      = NULL
effective_from   = NULL
effective_to     = NULL
```

An application-role INSERT may not mint a pre-reviewed or directly consumable version. The physical database guard owns this invariant.

A Candidate may be edited with optimistic revision checks. Review and validity are independent from lifecycle. Publication is a controlled transition, not an INSERT shape or a caller-supplied flag. A published version's semantic content/hash/source-set/scope is immutable; material correction requires a successor. Terminal historical lifecycle states do not regress to active states.

The exact immutable identity is `knowledge_id + semantic_version`; `revision` is the mutable optimistic-concurrency counter for the same candidate/version row and must advance on mutation.

## Reviewer, Approval, Release, and Publication Authority

Professional review authority is composed from the existing Staff owner:

- an ACTIVE Account;
- an unrevoked, currently effective GLOBAL `PROFESSIONAL_REVIEW` staff assignment;
- the exact assignment/account/person tuple;
- a separate professional qualification fact;
- an exact Professional Approval proof.

`PROFESSIONAL_REVIEW` capability is not professional qualification. Professional qualification is not Professional Approval. Professional Approval is not publication. None may be inferred from another.

The release path must bind the approval proof to the exact Professional Knowledge semantics: item/version identity, content hash, source-set hash, full scope/package binding, reviewer identity, qualification scope, and effective time. Invalid facts and unavailable dependencies remain distinct fail-closed outcomes.

The physical `CANDIDATE → PUBLISHED` transition revalidates the exact reviewer Staff assignment at transition time under the same serialization protocol used by Staff mutation. Reviewer revoke, Account disable, or wall-clock expiry cannot race a successful publication.

## Family Consumption Boundary

Family-facing code is a consumer, never a Professional Knowledge administrator.

A family/case consumer may read only a version that remains:

```text
PUBLISHED
CURRENT
VALID
```

and also passes current actor/family/case/purpose authorization, Consent/Compliance/Safety composition, exact approval, exact Scene/package binding, and deterministic eligibility checks.

Wrong family/case/purpose or protected asset state remains non-enumerating. Family permission does not expose Candidate, Needs-Review, invalid, retired, superseded, expired, or unrelated professional assets.

## RLS and Grants

The five Professional Knowledge owner tables use ENABLE + FORCE RLS. The runtime role has no BYPASSRLS and no table-owner authority.

Mutation/read policies are purpose-bound. Professional administration requires current Professional Review Staff Authority. Family-facing read policies permit only already-published/current/valid assets under the consumption purpose; service composition applies the additional family/case, approval, Scene, Consent/Compliance/Safety, and eligibility gates.

Append-only source/review/approval evidence cannot be updated or deleted by the runtime role. The runtime role has no Professional Knowledge DELETE grant.

## Concurrency, Idempotency, Audit, and Failure Semantics

Mutating commands reuse the shared `idempotency_keys` authority. Same key + same semantic command replays one authoritative outcome; same key + different semantic request conflicts.

Candidate edits and lifecycle transitions use revision/CAS semantics. Release also serializes with reviewer Staff Authority mutation keys. Stale writers do not last-write-win.

Successful mutations and their Slice-owned audit/idempotency evidence settle atomically. Failed Professional Authority decisions leave no partial release state. Where a failed decision must be observable after rollback, the bounded denial receipt is written through the existing `business_audit_events` ledger with an exact logical dedupe fingerprint.

Known invalid authority and unavailable authority are different internal outcomes. Neither is converted into approval or availability.

## Migration Ownership

Slice 17 currently owns these forward-only migrations:

- `025_professional_knowledge_foundation.sql`
- `026_professional_authority_release_remediation.sql`
- `027_professional_knowledge_insert_lifecycle_guard.sql`

Historical migration files are immutable after use. The repository migration runner sorts complete filenames lexically, uses the complete filename as `schema_migrations.filename` identity, stores SHA-256 checksums, fails on checksum drift, and serializes migration execution.

Therefore the coexistence of `026_common_core_goal_confirm_goal_runtime.sql` and `026_professional_authority_release_remediation.sql` is not itself an identity collision. Clean-install and upgrade tests must prove deterministic composition.

## Acceptance Scenarios

1. A runtime direct INSERT of `PUBLISHED/CURRENT/VALID` Professional Knowledge is physically rejected.
2. A runtime direct INSERT of a Candidate preloaded as `CURRENT/VALID` is physically rejected.
3. A valid Candidate begins `CANDIDATE/PENDING/UNKNOWN/revision=1`.
4. Stale approval proof after semantic mutation cannot release; fresh exact proof can.
5. Malformed/expired approval or qualification timing fails closed.
6. Reviewer Staff revoke, Account disable, or expiry racing release cannot yield a successful publication.
7. Scene-package mismatch and other authority denials roll back business state.
8. INVALID and UNAVAILABLE authority outcomes remain distinct and durably auditable where required.
9. Family consumption cannot read Candidate/Needs-Review/invalid/retired/superseded/expired content.
10. Same idempotency key/same command replays; same key/different command conflicts.
11. Concurrent lifecycle mutations preserve one authoritative state.
12. Clean migration and historical upgrade migration produce the same current schema/authority composition.

## Acceptance Evidence

Primary evidence is executable repository evidence, including:

- `tests/professional-knowledge-phase2-authority.test.ts`
- `tests/professional-knowledge-audit2-remediation.integration.test.ts`
- `tests/professional-knowledge-release.integration.test.ts`
- `tests/professional-knowledge-reliability.integration.test.ts`
- `tests/professional-knowledge-consumption.integration.test.ts`
- `tests/professional-knowledge-foundation-db.integration.test.ts`
- `tests/professional-knowledge-semantic-evidence-gate.test.ts`
- `tests/db/migration-repro.test.ts`
- `tests/db/migration-upgrade-evidence.test.ts`
- `tests/db/rls.test.ts`
- exact-head CI;
- Spec Governance;
- latest-main + exact-PR-head composition with main as merge base.

## Explicit Out of Scope

This Slice does not implement or begin:

- RAG, pgvector, embedding, reranking, retrieval ranking, or Gold Dataset work;
- Context Builder;
- AI Task Runtime, AI SDK, model calls, prompt evaluation, or Promptfoo;
- a generic CMS, expert marketplace, qualification platform, or second Staff system;
- a second Professional Approval ledger;
- a second Scene package owner;
- Phase 4 InterventionInstance/Goal/Plan/Task/Checkin/Outcome/Schedule/Notification work;
- Production Enablement.

The next action after this Slice reaches exact-head/current-main verification is a new independent Slice 17 Final Audit. No merge is authorized by this spec.
