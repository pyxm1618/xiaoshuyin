# Slice 15 — Authority-Reconciled Review Runtime Implementation Plan

**Feature**: 015-digital-use-review-runtime-authority-reconciliation  
**Planning baseline**: origin/main ff6f8f7da783656e41641031df5ddecf745096ef  
**Frozen Spec commit**: bbbee99c7d81380459b0b2dbe057893fb7651c07  
**Frozen Spec blob**: 14eba76907914f39ffdc9e6ae86cd6499651a7b5  
**Planning stage**: Plan AI 2 / Development Readiness  
**Implementation strategy**: NEW IMPLEMENTATION BRANCH FROM THEN-CURRENT MAIN; selectively transplant only still-valid concepts from PR #39.  
**Production Professional Content state**: UNAVAILABLE until a real external authority provides a current APPROVED + PUBLISHED exact package with valid reviewer proof.

## Upstream Traceability

| Authority | Exact blob / state | Planning consequence |
|---|---|---|
| Docs/总产品需求.md | 97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29 | Professional Authority is external; code/tests cannot manufacture approval; AI is not professional truth. |
| Docs/V1产品需求.md | 8eb660cd905d8fba4b52fe0f74bbc214b3113117 | Evidence provenance, Case/Formulation currentness, independent Authorization/Consent/Compliance/Safety, A5001/A5002 package gate. |
| Docs/总体技术架构.md | 6b4630803f371faf6d93f27361070223d0f661a0 | Consume Professional Content approval proof; do not build a CMS/reviewer platform; reuse control-plane owners. |
| Docs/V1技术设计.md | a0f09b8afda5532870150f03b713fed107359849 | Scene Artifact/State ownership, idempotency/concurrency/atomicity, Phase 2/3/4 boundaries, A5001/A5002 package gate. |
| Superseding Slice 15 spec.md | 14eba76907914f39ffdc9e6ae86cd6499651a7b5 | Direct feature authority for A5001/A5002, Path B, package-bound completion, negative space and acceptance evidence. |
| Current Scene manifest | current main | A5001 = FAMILY_ALLIANCE_REVIEW; A5002 = PHONE_USE_CONTRACT_REVIEW; independent USER_INITIATED/SCHEDULED eligibility and REVIEW_COMPLETE topology already exist. |
| Current Family Alliance owner | current main | A5001 consumes A3002 selection revision and selected target-item identities/revisions plus feasibility/progress/help/source history; no second target lifecycle. |
| Current Phone Contract owner | current main | A5002 consumes one exact Contract identity/version/revision/status/template/dependency lineage; no latest-version substitution. |
| Current Case lifecycle owner | current main | Case phase is coarse Common Core truth; minimum-phase semantics are monotonic, not exact node.phase equality. |
| PR #55 baseline | merged into current main | A1001→A2010, A3000/A4001 parallel lanes, A4003 HOLD and Family Alliance independence are protected regressions. |

No Authority contradiction was found. Slice 16–19 remain non-owning dependencies for this feature; the unresolved dependency is external Professional Authority/package availability.

## Summary

Implement the authority-reconciled Slice 15 as two narrow Scene-local professional review streams on top of the existing Digital Use runtime:

- A5001 binds an exact current Family Alliance target-list subject.
- A5002 binds an exact Phone Use Contract version subject.
- Both consume one exact Professional Content Package through a narrow consumer port.
- Production defaults to an explicit unavailable provider. With the current organization state APPROVED PROFESSIONAL REVIEWER — UNASSIGNED, production cannot show/accept a professional questionnaire and cannot reach REVIEW_COMPLETE.
- Tests may inject a structurally test-only APPROVED + PUBLISHED package provider to prove the future legal positive path.
- No generic Review aggregate/table/API, scoring engine, CMS, reviewer registry, scheduler, AI fallback or Phase 4 owner is introduced.
- Completed review artifacts remain immutable and bind exact subject + package identity/version/hash + provenance.
- Existing Authorization, RLS, Consent, Compliance, Safety, Case/Formulation, Evidence, Scene, Contract and idempotency owners remain authoritative.

Public fail-closed vocabulary should reuse the current Digital Use error model. Missing/non-selectable Professional Content maps at the API boundary to DEPENDENCY_UNAVAILABLE; internal package-resolution reasons remain structurally distinct for tests/audit without creating a second global error taxonomy.

## Technical Baseline

Current main already provides:

- canonical A5001/A5002 nodes in packages/scenes/digital-use/node-manifest.ts;
- one node-response transaction shell with Authorization before idempotency, RLS context, Case/Scene locking, current Compliance/Safety checks, Scene CAS, event/audit and idempotency settlement;
- Family Alliance append-only target rows with selection_revision, revision, feasibility, progress, help history and source refs;
- Phone Contract version rows with id, version, draft_revision, status, source_template_version, dependency refs and supersession lineage;
- Problem Formulation currentness owner;
- Scene Artifact JSONB persistence and supersession graph;
- shared Evidence owner;
- current API/OpenAPI generation;
- current migration head 022_foundation_remaining_consent_chain_integrity.sql.

Current main does not provide:

- an A5001/A5002 Professional Content Package owner;
- a real approved/published A5001/A5002 package;
- a real assigned Professional Reviewer;
- A5001/A5002 review semantics in the node-response dispatcher;
- Scene Artifact DB vocabulary for the two review artifact discriminators.

Therefore Path B is mandatory.

## Constitution Check

PASS before development, subject to the following non-negotiable constraints:

1. Single owner: no new Case, Scene State, Scene Artifact, Evidence, Consent, Compliance, Safety, Authorization/RLS, Contract or idempotency owner.
2. Professional Authority: no developer-defined questionnaire dimensions, scoring, cutoff, interpretation or fake approval.
3. Deterministic core: package gate, subject binding, lifecycle, provenance, concurrency and atomicity are testable without a real model.
4. Fail closed: unavailable/invalid package cannot create completed professional artifacts or REVIEW_COMPLETE.
5. Historical truth: completed artifacts are append-only revisions with exact old package identity preserved.
6. Phase boundary: no Common Core Review/Outcome/Goal/Plan/Task/Checkin/Schedule/Notification/pg-boss pull-forward.
7. Migration discipline: never reuse old PR #39 migration 022; allocate the then-current next slot only when development starts.
8. Governance: Docs/** and superseding spec.md remain read-only during implementation.

Any implementation requiring relaxation of these constraints must STOP and return to planning/authority reconciliation.

## Implementation Strategy

### Branch decision

Use a fresh implementation branch from then-current origin/main after re-reading remote truth.

Do not continue, rebase-force or convert PR #39 into the authoritative implementation branch.

Reasoning:

- PR #39 head 114ecb63a570e963435e08b4c08053f0054130d4 and current main have materially diverged.
- current main includes PR #52–#55 authority convergence and owner changes absent from PR #39;
- PR #39 uses obsolete exact Case-phase assumptions;
- PR #39 contains candidate professional dimensions now explicitly non-authoritative;
- PR #39 owns obsolete migration 022, which collides with current main;
- current node-response, Family Alliance, Contract, Compliance and Golden E2E behavior have changed materially.

Selective reuse means re-deriving small concepts against current main, not cherry-picking files or commits.

## PR #39 Disposition

| PR #39 file | Disposition | Planning rule |
|---|---|---|
| packages/contracts/src/digital-use-review-schemas.ts | REPLACE | Remove fixed candidate dimensions from production authority; replace with narrow package-bound request/proof/artifact contracts. |
| apps/server/api/src/services/digital-use-family-alliance-review.ts | REPLACE | Reuse only the idea of server-resolved subject snapshot, append-only history and Evidence refs; rewrite against current owner, package gate and current phase semantics. |
| apps/server/api/src/services/digital-use-phone-contract-review.ts | REPLACE | Reuse exact-version/lineage concepts only; never resolve a requested historical subject by switching to current active/latest. |
| apps/server/api/src/services/digital-use-node-response.ts | ADAPT | Modify current main only. Add review dispatch, package/subject fingerprinting and commit-time revalidation without reverting PR #52–#55 logic. |
| apps/server/api/src/services/digital-use-assessment.ts | ADAPT | Add only narrow A5001/A5002 readiness/projection behavior if required; do not restore phase equality or latest-contract shortcuts. |
| apps/server/api/src/services/digital-use-family-alliance.ts | REUSE | Current owner truth; consume it. Do not port PR #39 mutations over current main. |
| apps/server/api/src/services/digital-use-phone-contract.ts | REUSE | Current Contract owner; review may read exact versions but cannot execute mutation seams. |
| apps/server/api/src/services/digital-use-phone-contract-gates.ts | IGNORE / NOT AUTHORITY | File no longer exists on current main; current contract dependency/consent gates are integrated in the current owner and must be consumed there. |
| packages/domain/src/scene-runtime-repository.ts | ADAPT | Extend current artifact union/source vocabulary only; preserve currentness/supersession semantics. |
| packages/domain/src/phone-use-contract-repository.ts | REUSE / ADAPT | Reuse get-by-id/get-by-version and lineage fields; add only a read/lock helper if current exact-subject validation cannot be expressed safely. |
| db/migrations/022_digital_use_review_runtime.sql | DELETE / DO NOT PORT | Obsolete slot and baseline. Re-derive minimal additive migration at development time. |
| apps/server/api/src/routes/digital-use-assessment.ts | ADAPT | Keep existing node response endpoint; no generic Review API. |
| packages/contracts/src/digital-use-assessment-schemas.ts | ADAPT | Add only narrow package-bound optimistic tokens/projection fields needed by current API. |
| packages/contracts/src/index.ts | ADAPT | Export only new narrow contracts. |
| packages/generated/openapi.json | REPLACE | Regenerate from the authoritative current contract after implementation. |
| packages/generated/openapi.d.ts | REPLACE | Regenerate from the authoritative current contract after implementation. |
| scripts/db-evidence.mjs | ADAPT ONLY IF REQUIRED | Add migration evidence only if the new additive Scene Artifact extension requires it. |
| specs/015-digital-use-review-runtime/spec.md | IGNORE / NOT AUTHORITY | Historical immutable spec; superseded. |
| specs/015-digital-use-review-runtime/plan.md | IGNORE / NOT AUTHORITY | Historical planning evidence only. |
| specs/015-digital-use-review-runtime/checklist.md | IGNORE / NOT AUTHORITY | Historical planning evidence only. |
| specs/015-digital-use-review-runtime/tasks.md | IGNORE / NOT AUTHORITY | Historical planning evidence only. |
| tests/domain/digital-use-review-a5001-contracts.test.ts | REPLACE | Old fixed-dimension authority tests are invalid; replace with package-bound contracts and negative authority tests. |
| tests/domain/digital-use-review-slice15-closeout.test.ts | REPLACE | Rebuild closeout around Path B and production/test isolation. |
| tests/integration/digital-use-a5001-review-runtime.test.ts | REPLACE | Rebuild against current owners and fail-closed/default provider. |
| tests/integration/digital-use-a5002-review-runtime.test.ts | REPLACE | Rebuild exact-version, historical binding and A4012-negative coverage. |
| tests/integration/digital-use-canonical-no-model.test.ts | ADAPT | Preserve current main baseline and add deterministic Slice 15 assertions only. |
| tests/scenes/digital-use/phone-use-contract-governance.test.ts | ADAPT | Preserve current manifest/Contract ownership checks; add no forced A5001/A5002 sequence assertions if needed. |
| tests/architecture/consent-single-owner-implementation.test.ts | REUSE CURRENT MAIN | Do not port old copy; current owner test remains authoritative. |
| tests/db/digital-use-a5001-review-migration.test.ts | REPLACE | Rebuild for the new then-current migration and both narrow artifact discriminators. |
| tests/db/migration-case-primary-switch-upgrade.test.ts | IGNORE PR39 COPY | Current main copy is authority; Slice 15 must not alter unrelated upgrade semantics. |
| tests/db/migration-case-status-paused-removal.test.ts | IGNORE PR39 COPY | Same. |
| tests/db/migration-consent-supplemental-upgrade.test.ts | IGNORE PR39 COPY | Same. |
| tests/db/migration-upgrade-evidence.test.ts | ADAPT ONLY IF REQUIRED | Extend only if migration evidence framework requires the new additive migration. |
| tests/db/problem-formulations-main009-upgrade.test.ts | IGNORE PR39 COPY | Current main copy is authority. |

## Professional Content Consumer Seam

Create one narrow Slice 15 consumer port, not a platform.

The port resolves an exact package for a requested review scope and returns either:

- UNAVAILABLE with a structured internal reason; or
- a resolved package adapter containing immutable proof metadata, loaded-content identity sufficient for hash verification, exact scope, and a package-owned response validator/normalizer.

Minimum proof consumed by Slice 15:

- package_id or artifact_id;
- content_version;
- content_hash;
- source_refs;
- approval_scope;
- review_status;
- reviewer_identity;
- reviewer_qualification_ref;
- reviewed_at;
- effective_from;
- effective_to where applicable;
- published_at;
- package lifecycle/status.

The consumer must verify:

- exact stream/node/scene-package scope;
- APPROVED + PUBLISHED and current/effective state;
- immutable content hash matches loaded package content identity;
- reviewer proof is present and valid according to the provider contract;
- no retired/expired/superseded/candidate package is selectable for new use.

The provider owns professional content interpretation. Slice 15 does not implement questionnaire fields, generic JSON-schema forms, scoring or clinical mapping.

### Production provider

Production composition uses an explicit unavailable provider until a real external authority adapter exists.

The server entrypoint must not select a test fixture through environment variables, package IDs, feature flags or fallback content.

### Test-only provider

The positive-path fixture lives only under tests/** and implements the same port with:

- synthetic package ID/version/hash;
- explicit APPROVED + PUBLISHED metadata;
- synthetic reviewer proof clearly marked test-only;
- a tiny package-defined response contract sufficient to prove binding/completeness;
- no reuse of historical six/seven/candidate dimensions as implicit professional truth.

### Structural isolation

Mechanical protections:

1. production modules import only the port and production unavailable provider;
2. test fixture implementation exists only in tests/**;
3. no production env/config switch selects fixture content;
4. static architecture/guard test rejects production references/imports to the test fixture path or fixture sentinel identity;
5. production server.ts calls buildApp() with the default unavailable provider;
6. buildApp may accept the port as an injection seam for tests/future real authority, but production contains no fake provider implementation.

## Response / Package Contract Design

Do not revive A5001FamilyDimensions, A5001TargetDimensions or A5002ContractDimensions as production schemas.

The review response accepted by runtime is:

- opaque to Slice 15 except for package identity binding and package-owned validation;
- normalized by the exact resolved package adapter;
- persisted with package-defined unresolved states exactly as validated;
- hashed/canonicalized for idempotency after package validation;
- bound to package ID/version/hash in the artifact.

The client cannot self-assert approval. Package identity used for execution is server-resolved, not trusted from the response body.

The existing node-response route remains the mutation surface. No generic /reviews endpoint is added.

For the current production-unavailable state, A5001/A5002 submit attempts resolve the subject, evaluate current control-plane eligibility as required, then fail with the existing DEPENDENCY_UNAVAILABLE API vocabulary before any completed professional artifact/state is written.

## A5001 Subject Design

Server-resolve an immutable subject fingerprint from current owners:

- family_id and case_id;
- current Problem Formulation identity/version/currentness;
- scene package version;
- Family Alliance anchor identity where current owner exposes it, including the current A3000 self-assessment artifact when present and current;
- A3002 target-selection node revision;
- coherent selection_revision;
- every currently selected target item ID, target_code and exact revision;
- selected target source_refs;
- feasibility_payload if present;
- progress_payload and progress_evidence_refs if present;
- help_history_refs if present.

Eligibility requires:

- same Family/Case, OPEN primary Case and legal current lifecycle according to central owner;
- current authoritative Problem Formulation;
- coherent target selection with at least one selected real target;
- required current Family Alliance subject owners not stale/superseded/invalid;
- no requirement that every target has completed progress;
- no A5002 dependency.

Commit-time re-read must compare the exact subject fingerprint. Selection or selected-target revision drift aborts completion.

## A5002 Subject Design

The request/interaction must bind one exact Contract identity/version/revision. Resolve it by exact ID/version, never by getCurrentActivePhoneUseContract as a convenience selector.

Fingerprint:

- family_id and case_id;
- current Problem Formulation identity/version/currentness;
- scene package version;
- contract ID;
- contract version;
- draft_revision;
- status;
- source_template_version;
- immutable terms fingerprint derived from exact row fields;
- dependency_refs;
- supersedes_id/update lineage;
- execution-period context and activation/supersession timestamps where relevant.

New user-initiated effect review normally requires the exact row to be an eligible execution subject, initially ACTIVE under current owner rules. Historical re-entry may bind a SUPERSEDED exact version only when the current Contract owner explicitly exposes that exact version as a legal historical review subject; Slice 15 never switches it to latest.

Commit-time lock/re-read of that exact row is required. Any identity/version/revision/status/terms drift fails without mutating Contract truth.

## Artifact Design

Extend the existing Scene Artifact vocabulary with exactly:

- DIGITAL_USE_A5001_EFFECT_EVALUATION from A5001;
- DIGITAL_USE_A5002_EFFECT_EVALUATION from A5002.

Each completed artifact stores:

- node/stream;
- artifact schema version;
- exact subject fingerprint/identity;
- exact Professional Content package ID/version/hash;
- immutable approval-proof reference/identity;
- normalized package-defined response or normalized response identity;
- evidence/source refs;
- submitted-by provenance;
- artifact revision;
- supersedes/previous artifact ID for reassessment;
- created_at through existing owner.

Do not duplicate the Professional Content body inside the artifact.

## Evidence and Provenance

Reuse Evidence Core for observations intended to become reusable family evidence.

- parent observations remain parent-sourced;
- child-authored input remains child-sourced and requires current authorization/consent;
- parent-transcribed child claims remain parent-transcribed provenance;
- questionnaire answers are not automatically Facts;
- package/professional provenance is separate from family Evidence provenance;
- UNKNOWN/NOT_COLLECTED/DECLINED remain explicit when the exact package permits them;
- all referenced Evidence/Scene/Target refs must validate to the same authorized Family/Case/purpose.

## Case / Formulation Boundary

Use current digital-use-case-lifecycle and current Problem Formulation owner.

Never restore PR #39 caseRow.phase === GOALS exact equality.

A5001/A5002 eligibility is determined by:

- current Case lifecycle legality using monotonic minimum phase semantics;
- current authoritative Problem Formulation;
- review-ready stream subject;
- current Scene node state;
- independent control-plane gates.

Scene manifest phase REVIEW remains descriptive topology metadata and does not become a second Case phase machine.

## Authorization / RLS / Consent / Compliance / Safety

All are independent mandatory gates.

Authorization:
- reuse requireFamilyAction or the then-current equivalent;
- participant membership alone is insufficient;
- wrong family/case/actor must fail without enumeration leakage.

RLS:
- all DB work remains inside withRlsTransaction with current family/person/purpose context;
- no bypass role or second isolation mechanism.

Consent:
- consume current purpose-bound owner;
- revoked/missing required consent prevents new affected review completion;
- no review_consent table or private consent truth.

Compliance:
- consume current owner and legal-authority fail-closed outcome;
- a valid professional package never overrides Compliance denial/unavailability.

Safety:
- current SAFETY_HOLD and ordinary progression owner remain authoritative;
- Slice 15 cannot resolve a Safety Hold;
- valid professional approval never bypasses Safety.

## Idempotency

Reuse DIGITAL_USE_NODE_RESPONSE and the existing idempotency store/orchestrator.

For A5001/A5002, the canonical request hash must include:

- actor identity;
- family/case;
- node and stream;
- expected Case/node revisions;
- scene package version;
- exact subject identity and revisions/version;
- exact Professional package ID/version/hash;
- normalized validated response.

Behavior:

- same key + same exact authority/request = replay;
- same key + changed package = mismatch;
- same key + changed subject = mismatch;
- same key + changed normalized response = mismatch;
- A5001/A5002 cannot collide because node/stream/subject are part of the hash.

Subject/package resolution needed for hashing occurs only after authorization/RLS visibility is established.

## Concurrency

Use the current canonical lock order and existing CAS owners.

At commit:

1. lock Family/Case as current owner requires;
2. lock/re-read Scene node;
3. revalidate Case/Formulation;
4. re-read exact A5001 target subject or exact A5002 Contract subject;
5. re-resolve/revalidate the exact Professional package and approval proof;
6. re-check required Consent/Compliance/Safety currentness;
7. validate refs;
8. write Evidence effects if any;
9. insert typed review artifact;
10. CAS Scene node to completed REVIEW_COMPLETE route;
11. write event/audit;
12. settle idempotency in the same transaction.

If package identity/hash/status/scope/approval validity changes between preview and commit, no REVIEW_COMPLETE is committed. The public failure uses current error vocabulary; internal tests must distinguish the drift reason.

## Atomicity

The authoritative logical transaction must include, as applicable:

- Evidence writes/refs;
- review Scene Artifact;
- Scene State revision;
- business audit/case event;
- idempotency settlement.

Fault injection must prove rollback if failure occurs after Evidence/artifact work but before settlement.

The transaction never updates Family Alliance targets or Phone Contract rows as a side effect of review.

## History / Re-entry / Supersession

Completed artifacts are immutable.

Reassessment creates a new artifact revision with supersedes/previous reference. Old artifact retains:

- old subject identity/revisions;
- old package ID/version/hash;
- old response/provenance;
- old approval-proof identity.

A new Professional package never rewrites historical responses.

A later subject change may make a new review necessary, but does not mutate history.

## A4012 Boundary

A5002 may persist/reference an observation that the approved package says is relevant to an already-defined A4012 trigger.

A5002 must not call:

- Contract draft creation;
- A4012 update command;
- confirmation;
- activation;
- supersede mutation.

Architecture/integration tests must assert Contract row count/version/status/lineage is unchanged by A5002 review completion.

## USER_INITIATED / SCHEDULED

Production HTTP node-response is USER_INITIATED.

Do not add a client-controlled entryMode that can claim SCHEDULED.

SCHEDULED remains manifest eligibility only until Phase 4 owns authenticated trigger truth. Slice 15 adds no schedule/job/notification table or route.

A synthetic scheduled entry may be tested only through test-owned seams if needed; it cannot be selected by production composition.

## AI / Phase 3 Boundary

No model call, RAG, embedding, generated questionnaire, generated scoring or AI professional conclusion is required or permitted to compensate for missing Professional Authority.

Slice 16–19 are not prerequisites:

- Slice 16 owns Psychological/Behavioral Intervention definitions;
- Slice 17 owns Professional Knowledge;
- Slice 18 owns retrieval Gold Dataset evaluation;
- Slice 19 owns pgvector readiness.

Later Slice dependency: NONE.

## Common Core Review / Phase 4 Boundary

Do not create or modify:

- reviews table/repository/API;
- CASE_OVERALL;
- Outcome;
- Goal;
- Plan;
- Task;
- Checkin;
- Follow-up Schedule;
- pg-boss;
- Notification.

A5001/A5002 artifacts may later be inputs to Common Core Review, but Slice 15 does not own that review.

## API / OpenAPI Impact

Prefer the existing endpoints:

- GET /api/v1/cases/:id/scene/nodes/:nodeCode
- POST /api/v1/cases/:id/scene/nodes/:nodeCode/responses

No generic Review endpoint.

Expected contract changes are narrow:

- add package-bound optimistic/identity fields only if the server needs an explicit client token to prevent stale interaction submission;
- never accept client asserted approval/reviewer status;
- extend Scene Artifact response enum for the two new artifact types;
- add only existing-vocabulary error behavior required for DEPENDENCY_UNAVAILABLE and current stale codes;
- regenerate packages/generated/openapi.json and openapi.d.ts from schemas.

If a package interaction token is exposed, it must be an opaque server-issued identity binding exact package ID/version/hash and must still be revalidated at commit; it is not approval proof by itself.

## Migration Decision

ADDITIVE MIGRATION REQUIRED AT DEVELOPMENT.

Reason: current scene_artifacts has strict CHECK constraints for artifact_type, source_node_code and type/source pair. A5001/A5002 are not currently legal Scene Artifact sources/types.

Migration scope is limited to extending the existing Scene Artifact vocabulary/constraints for the two discriminators. No new reviews table, package table, reviewer table or generic workflow schema.

The current remote migration head is:

022_foundation_remaining_consent_chain_integrity.sql

Do not hard-code the Slice 15 migration number in planning. At development start, re-read remote main and allocate the then-current next slot. Never reuse PR #39 022_digital_use_review_runtime.sql.

## Test Strategy

### Domain / contract

- old candidate dimension keys are absent from production authority;
- package proof validation: missing, draft, unapproved, unpublished, expired, retired, superseded, wrong scope, wrong version/hash, invalid reviewer proof;
- exact package synthetic positive path;
- A5001/A5002 package cross-scope rejection;
- response normalization bound to package identity;
- no AI fallback.

### Integration

A5001:
- subject readiness and exact target revisions;
- partial target execution remains reviewable when package allows;
- stale selection/target drift fails;
- package missing default production path fails closed;
- test provider positive path reaches only A5001 REVIEW_COMPLETE.

A5002:
- exact Contract ID/version/revision binding;
- no current/latest switching;
- stale Contract fails;
- historical exact-version behavior only when owner exposes legal historical subject;
- positive test package completes only A5002;
- Contract row/version/status/lineage unchanged; A4012 not executed.

Control planes:
- wrong family/case/actor;
- participant privilege escalation;
- cross-family refs;
- Consent revoked;
- Compliance unavailable/denied;
- Safety Hold;
- valid package plus denied independent gate still fails.

Idempotency/concurrency:
- replay same key/exact package/subject/response;
- conflict on package/subject/response change;
- barrier tests for subject drift and package drift;
- one winner for same expected node revision.

Atomicity:
- fault injection after Evidence/artifact creation but before Scene/idempotency settlement;
- zero completed residue after rollback.

History:
- package v1 review remains immutable after package v2;
- reassessment creates new artifact revision and supersession link.

Architecture:
- no production import/reference of tests fixture;
- no old candidate dimensions in production review authority;
- no generic Review/Phase 4 owner;
- no A4012 mutation call from review modules;
- no scheduler/notification pull-forward.

DB:
- additive migration extends only Scene Artifact constraints;
- RLS remains forced/current;
- upgrade from current migration head passes.

## Golden E2E Regression

PR #55 baseline is a hard non-regression gate.

At minimum rerun current exact tests covering:

- A1001→A2010;
- integrated triage recovery;
- A3000/A4001 parallel materialization;
- Family Alliance target behavior;
- A4003 capability HOLD and recovery boundary;
- Phone Contract current content behavior;
- Digital Use vertical convergence.

Slice 15 tests may add coverage but must not weaken or rewrite these assertions merely to pass.

## Verification Plan

Development closeout must include:

1. bun run typecheck
2. bun run guard:static
3. bunx vitest run tests/domain
4. bunx vitest run tests/scenes/digital-use
5. targeted A5001/A5002 integration suites
6. targeted DB migration/RLS suites
7. bun run openapi:generate
8. bun run openapi:check
9. node .specify/scripts/validate-governance.mjs
10. node .specify/scripts/tests/run-governance-tests.mjs
11. bun run verify-all with required DB environment
12. exact-head CI readback and independent Audit 2.

Verification must include DB readback for artifact subject/package binding and no Contract mutation, and architecture/static evidence that production cannot import the test-only package provider.

## Rollback / Recovery

Code rollback:
- revert the Slice 15 implementation commit(s) while preserving existing Family Alliance/Contract owner history.

Migration rollback strategy:
- because the migration is additive CHECK vocabulary, prefer forward repair over destructive rollback after production use;
- no table/data ownership migration is introduced;
- historical review artifacts, once validly created, must not be deleted merely because a future package is retired.

Runtime recovery:
- if Professional Content provider is unavailable, default production remains fail closed and existing Family Alliance/Contract flows remain intact;
- provider recovery triggers fresh resolution/revalidation, not replay of stale approval state.

## Complexity Exceptions

Allowed bounded complexity:

- one narrow Professional Content consumer port;
- one explicit unavailable production provider;
- two stream-specific subject resolvers/executors;
- one minimal additive Scene Artifact vocabulary migration;
- test-only provider fixture and architecture guard.

Explicitly rejected complexity:

- generic DI framework;
- Professional Content CMS;
- reviewer registry/credential service;
- generic forms/scoring engine;
- generic Review platform;
- scheduler;
- AI/RAG fallback;
- new workflow engine.

## Development Gates

Before writing production code, Developer AI must:

1. re-read origin/main and all changed current owners;
2. confirm superseding spec blob remains 14eba76907914f39ffdc9e6ae86cd6499651a7b5 or STOP on drift;
3. re-read migration head and allocate the then-current next slot;
4. create a fresh implementation branch from then-current main;
5. treat PR #39 only as non-authoritative evidence;
6. preserve production provider = unavailable until real authority exists.

STOP if any current Authority Doc conflicts with the Frozen Spec, if a real upstream Professional Content owner appears with a materially different contract, or if implementation would require a generic Review/Professional platform.

## Audit 1 Development-Readiness Result

PASS — READY FOR DEVELOPMENT.

Reason: every Frozen Spec requirement has an implementation owner, verification class and explicit negative-space guard; production/test Professional Content isolation is structural; PR #39 is no longer a baseline; migration collision is resolved by reallocation at development time; no open product or planning decision remains.
