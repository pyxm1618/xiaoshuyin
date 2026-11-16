# Slice 15 — Authority-Reconciled Implementation Tasks

**Feature**: 015-digital-use-review-runtime-authority-reconciliation  
**Execution rule**: Developer AI executes in dependency order from a fresh branch based on then-current origin/main. PR #39 is evidence only.  
**Production rule**: default Professional Content provider remains UNAVAILABLE until a real external authority is connected.

## Frozen Spec Authority Map

| Task | Frozen Spec requirements |
|---|---|
| T1501 | FR-001–FR-030 baseline/disposition gate |
| T1502 | FR-009–FR-015 |
| T1503 | FR-009–FR-015, FR-026, FR-030 |
| T1504 | FR-009–FR-021 |
| T1505 | FR-001, FR-003–FR-005, FR-008, FR-017, FR-022–FR-025 |
| T1506 | FR-001, FR-003–FR-005, FR-009–FR-021 |
| T1507 | FR-002–FR-004, FR-006–FR-008, FR-022–FR-025, FR-029 |
| T1508 | FR-002–FR-004, FR-006, FR-009–FR-021, FR-029 |
| T1509 | FR-017, FR-022–FR-026 |
| T1510 | FR-019 |
| T1511 | FR-005, FR-006, FR-020 |
| T1512 | FR-016–FR-021 |
| T1513 | FR-007, FR-008, FR-018 |
| T1514 | FR-030 |
| T1515 | FR-016, FR-027, FR-029, FR-030 |
| T1516 | FR-001–FR-030 non-regression |
| T1517 | FR-001–FR-030 closeout evidence |

## Acceptance Evidence Contract

Implementation is not complete until each task's named verification evidence exists on the exact implementation Head. Test-only approved package evidence proves only the legal runtime path; it never proves production Professional approval or release readiness.

## T1501 — Re-read Baseline and Reconcile PR #39

**Goal**  
Freeze the implementation start against then-current remote truth and prevent accidental resurrection of the old PR #39 authority.

**Exact Scope**  
Re-read origin/main, superseding spec, four Authority Docs, PR #39, merged #52–#55, current migration head, current node/Family Alliance/Contract/Case/Evidence/control-plane owners. Reproduce the PR #39 disposition table from plan.md against the new exact baseline.

**Allowed Files / Areas**  
No production mutation required for this task; implementation branch metadata/working notes only.

**Frozen Spec Authority**  
All FR-001–FR-030; especially supersession, migration and PR #39 disposition clauses.

**Prerequisites**  
None.

**Verification**  
Record exact main/spec/doc/migration heads. Confirm no spec/authority contradiction and no old migration 022 reuse. Confirm implementation branch starts from current main rather than PR #39.

**Stop Conditions**  
STOP on Spec blob drift that changes semantics, Authority contradiction, or new upstream owner that materially changes Professional Content contract.

**Acceptance / Evidence Ownership**  
Developer report owns baseline evidence; Audit 2 independently re-reads remote truth.

## T1502 — Professional Content Consumer Port + Unavailable Production Provider

**Goal**  
Create the smallest package consumer seam required by A5001/A5002 while production truthfully remains unavailable.

**Exact Scope**  
Define the exact package proof/resolution contract and an explicit production unavailable provider. Validate APPROVED + PUBLISHED/current/effective/scope/reviewer/hash requirements. Map non-selectable package results to current DEPENDENCY_UNAVAILABLE public behavior without creating a second global error model.

**Allowed Files / Areas**  
apps/server/api/src/services/ narrow Slice 15 review content module; minimal app composition wiring; relevant contracts if needed.

**Frozen Spec Authority**  
FR-009–FR-015.

**Prerequisites**  
T1501.

**Verification**  
Domain tests for missing/unapproved/unpublished/expired/retired/superseded/wrong-scope/wrong-version/wrong-hash/invalid-reviewer cases. Production default has no real package.

**Stop Conditions**  
STOP if implementation requires CMS/reviewer registry/credential DB/generic approval workflow or developer-defined questionnaire fields.

**Acceptance / Evidence Ownership**  
Professional package gate tests + production composition inspection.

## T1503 — Test-only Valid Package Provider and Structural Isolation

**Goal**  
Prove the future valid-package path without allowing fixture authority into production.

**Exact Scope**  
Create a synthetic exact APPROVED + PUBLISHED package provider under tests/** only. Add architecture/static guard proving production files cannot import/reference the fixture path or sentinel package identity. Ensure no env/config selector enables it in server.ts.

**Allowed Files / Areas**  
tests/**; minimal architecture/static guard extension if current repository convention requires it.

**Frozen Spec Authority**  
FR-009–FR-015, FR-026, FR-030.

**Prerequisites**  
T1502.

**Verification**  
Static/architecture test: production imports fixture => test fails. Production buildApp()/server.ts default resolves unavailable provider. Positive fixture is injectable only from tests/future real port composition, not selected by runtime env.

**Stop Conditions**  
STOP if a fake provider implementation must live in production directories.

**Acceptance / Evidence Ownership**  
Architecture test owns isolation proof; integration tests own synthetic positive-path use.

## T1504 — Package-bound Response and Artifact Contracts

**Goal**  
Replace old candidate-dimension authority with exact package-bound normalized response/artifact contracts.

**Exact Scope**  
Remove/avoid production A5001FamilyDimensions, A5001TargetDimensions and A5002ContractDimensions authority. Define narrow types for exact package identity/proof, normalized package-validated response identity, two Scene Artifact discriminators and provenance fields.

**Allowed Files / Areas**  
packages/contracts/src; packages/domain/src/scene-runtime-repository.ts; narrow review service types.

**Frozen Spec Authority**  
FR-009–FR-021.

**Prerequisites**  
T1502–T1503.

**Verification**  
Domain/architecture tests prove old candidate keys are not production authority; A5001/A5002 artifacts are distinct; package ID/version/hash and approval proof are required on completed artifacts.

**Stop Conditions**  
STOP if implementation starts creating generic forms/scoring schema or duplicates the Professional Content package body.

**Acceptance / Evidence Ownership**  
Contract tests + static source assertions.

## T1505 — A5001 Subject Resolver and Fail-closed Entry

**Goal**  
Bind A5001 to the exact current Family Alliance subject and fail closed before professional interaction when package is unavailable.

**Exact Scope**  
Server-resolve current Problem Formulation, A3000/Family Alliance anchor where applicable, A3002 selection revision, all selected target IDs/codes/revisions and feasibility/progress/help/source refs. Require at least one selected target; do not require all targets completed. Integrate current lifecycle/control gates without exact phase equality.

**Allowed Files / Areas**  
new/current A5001 review service; current Family Alliance/domain read helpers only if needed; current node-response dispatch.

**Frozen Spec Authority**  
FR-001, FR-003–FR-005, FR-008, FR-017, FR-022–FR-025.

**Prerequisites**  
T1504.

**Verification**  
Integration: no package => DEPENDENCY_UNAVAILABLE and no completed artifact/state; stale selection/target fails; partial execution subject can be review-ready; A5002 unaffected.

**Stop Conditions**  
STOP if resolver creates a second target lifecycle/readiness owner or restores case phase == GOALS.

**Acceptance / Evidence Ownership**  
A5001 integration + DB readback.

## T1506 — A5001 Valid-package Completion Path

**Goal**  
Prove legal A5001 REVIEW_COMPLETE with the synthetic exact package.

**Exact Scope**  
Resolve exact package, validate/normalize response through package adapter, revalidate subject/package/control gates at commit, write allowed Evidence refs/effects, append A5001 artifact, CAS A5001 Scene State, event/audit and idempotency atomically.

**Allowed Files / Areas**  
A5001 service; node-response transaction shell; existing Evidence/Scene APIs through owner seams.

**Frozen Spec Authority**  
FR-001, FR-003–FR-005, FR-009–FR-021.

**Prerequisites**  
T1503–T1505.

**Verification**  
Test provider positive path reaches only A5001 REVIEW_COMPLETE. Artifact DB readback binds exact selection/target revisions + package ID/version/hash. A5002 remains untouched.

**Stop Conditions**  
STOP if valid parse alone can complete review or if target truth is mutated by review.

**Acceptance / Evidence Ownership**  
A5001 positive integration and DB artifact readback.

## T1507 — A5002 Exact Contract Subject Resolver and Fail-closed Entry

**Goal**  
Bind A5002 to one exact Contract version without latest switching.

**Exact Scope**  
Resolve by exact Contract ID/version/revision; bind status, source template, terms fingerprint, dependency refs and lineage. Lock/re-read exact row at commit. New review requires owner-defined legal execution subject; historical review only when current owner explicitly permits exact historical subject.

**Allowed Files / Areas**  
new/current A5002 review service; phone-use-contract repository read helper if strictly necessary; node-response dispatch.

**Frozen Spec Authority**  
FR-002–FR-004, FR-006–FR-008, FR-022–FR-025, FR-029.

**Prerequisites**  
T1504.

**Verification**  
Integration: no package => fail closed; supplied old exact Contract is never switched to current active; stale revision/status fails; A5001 unaffected.

**Stop Conditions**  
STOP if implementation calls current/latest Contract selector to replace requested exact subject.

**Acceptance / Evidence Ownership**  
A5002 subject binding tests + DB readback.

## T1508 — A5002 Valid-package Completion Path and A4012 Negative Boundary

**Goal**  
Prove legal A5002 REVIEW_COMPLETE while mechanically preventing Contract mutation.

**Exact Scope**  
Validate exact package/response, append A5002 artifact, Scene completion, event/audit and idempotency. Allow only Evidence observation/ref relevant to an approved A4012 trigger. Do not invoke Contract draft/confirm/activate/supersede seams.

**Allowed Files / Areas**  
A5002 review service; node-response; Evidence/Scene owners via existing seams.

**Frozen Spec Authority**  
FR-002–FR-004, FR-006, FR-009–FR-021, FR-029.

**Prerequisites**  
T1503, T1507.

**Verification**  
Positive test package completes only A5002. DB readback proves Contract row count/version/status/supersedes lineage unchanged and no A4012 execution artifact/event is created.

**Stop Conditions**  
STOP on any Contract mutation side effect.

**Acceptance / Evidence Ownership**  
A5002 integration + Contract DB before/after evidence.

## T1509 — Authorization/RLS/Consent/Compliance/Safety and Provenance Matrix

**Goal**  
Prove valid Professional approval cannot override independent control planes or provenance rules.

**Exact Scope**  
Exercise wrong family/case/actor, participant privilege escalation, cross-family refs, Consent revoke, Compliance denial/unavailability, Safety Hold, parent/child/transcribed-child provenance and explicit unknown states.

**Allowed Files / Areas**  
review services only for integration seams; tests/integration, tests/db/security as needed.

**Frozen Spec Authority**  
FR-017, FR-022–FR-026.

**Prerequisites**  
T1506, T1508.

**Verification**  
Every denial leaves zero completed review residue. RLS forced isolation remains effective. Valid package + denied gate still fails.

**Stop Conditions**  
STOP if review code duplicates or bypasses any control-plane owner.

**Acceptance / Evidence Ownership**  
Security/integration/DB tests.

## T1510 — Idempotency Package/Subject Fingerprint

**Goal**  
Make idempotency exact to authority state, not only payload shape.

**Exact Scope**  
Extend A5001/A5002 request hashing to include actor/Case/node/stream, exact subject identity/revisions, Scene package, Professional package ID/version/hash and normalized response. Keep existing idempotency store/command type.

**Allowed Files / Areas**  
current node-response hashing path; no second ledger/table.

**Frozen Spec Authority**  
FR-019.

**Prerequisites**  
T1506, T1508.

**Verification**  
Same key/same exact authority replays; changed package/subject/response conflicts; A5001/A5002 do not collide.

**Stop Conditions**  
STOP if a new idempotency store or generic review command ledger is proposed.

**Acceptance / Evidence Ownership**  
Integration idempotency tests.

## T1511 — Subject and Package Drift Concurrency

**Goal**  
Prevent stale completion after target/Contract/package/approval drift.

**Exact Scope**  
Add commit-time exact revalidation and barrier-based race tests for A5001 selection/target changes, A5002 exact Contract changes, package version/hash/status/scope and approval-validity changes.

**Allowed Files / Areas**  
review services, provider port/revalidation seam, integration concurrency tests.

**Frozen Spec Authority**  
FR-005, FR-006, FR-020.

**Prerequisites**  
T1510.

**Verification**  
At most one same-node expected-revision writer wins. Package valid at preview but retired/changed before commit cannot reach REVIEW_COMPLETE.

**Stop Conditions**  
STOP if last-write-wins or cached approval is treated as commit authority.

**Acceptance / Evidence Ownership**  
Barrier-based integration tests.

## T1512 — Atomicity and Fault Injection

**Goal**  
Prove no partial professional review success can survive transaction failure.

**Exact Scope**  
Fault inject after Evidence write, after artifact insert and before Scene/idempotency settlement. Verify rollback of Evidence effects created by the command, artifact, Scene completion, event/audit and idempotency success.

**Allowed Files / Areas**  
test hooks consistent with repository conventions; review transaction shell; tests only.

**Frozen Spec Authority**  
FR-016–FR-021.

**Prerequisites**  
T1511.

**Verification**  
DB readback after injected failure shows no completed review residue and retry remains legal.

**Stop Conditions**  
STOP if the implementation requires cross-transaction eventual consistency for completion.

**Acceptance / Evidence Ownership**  
Fault-injection integration + DB evidence.

## T1513 — History, Re-entry and Package Version Preservation

**Goal**  
Preserve immutable past reviews across subject/package changes.

**Exact Scope**  
Append reassessment artifact revision with previous/supersedes link; retain old subject/package/provenance. Prove package v2 does not rewrite package v1 artifact.

**Allowed Files / Areas**  
review services; existing Scene Artifact supersession owner; tests.

**Frozen Spec Authority**  
FR-007, FR-008, FR-018.

**Prerequisites**  
T1512.

**Verification**  
DB readback of old and new artifacts, exact package hashes and subject revisions; no UPDATE-in-place semantics.

**Stop Conditions**  
STOP if historical artifact payload must be mutated to represent current truth.

**Acceptance / Evidence Ownership**  
History/reassessment integration tests.

## T1514 — SCHEDULED Unavailable Production Boundary

**Goal**  
Keep SCHEDULED as manifest eligibility without inventing Phase 4 scheduling truth.

**Exact Scope**  
Ensure production node-response remains USER_INITIATED and has no client-controlled SCHEDULED claim. Add no scheduler/job/notification owner. Test synthetic scheduled semantics only if needed through test-owned seam.

**Allowed Files / Areas**  
route/service contracts only if needed; architecture/integration tests.

**Frozen Spec Authority**  
FR-030.

**Prerequisites**  
T1505, T1507.

**Verification**  
No production route/config can assert an authentic scheduled trigger; no schedule/job/notification rows or APIs added.

**Stop Conditions**  
STOP if implementation requires pg-boss, cron, notification or fake trigger authority.

**Acceptance / Evidence Ownership**  
Architecture/static + route contract tests.

## T1515 — API/OpenAPI and Minimal Additive Migration

**Goal**  
Expose only the narrow current API contract and make the two review artifacts legal under the existing Scene Artifact owner.

**Exact Scope**  
At development start re-read migration head and allocate then-current next slot. Extend scene_artifacts type/source/type-source constraints for the two review artifacts only. Extend Zod/OpenAPI schemas narrowly and regenerate generated files. No generic Review endpoint/table.

**Allowed Files / Areas**  
db/migrations/<then-current-next>; packages/contracts; current Scene repository; existing Digital Use route; generated OpenAPI; migration evidence tooling only if required.

**Frozen Spec Authority**  
FR-016, FR-027, FR-029, FR-030.

**Prerequisites**  
T1504, T1506, T1508.

**Verification**  
Migration/upgrade tests pass from current head; DB accepts only correct A5001/A5002 type-source pairs; OpenAPI generate/check clean; old PR #39 022 absent.

**Stop Conditions**  
STOP if the next migration slot changed and was not re-read, or if a reviews/package/reviewer table is proposed.

**Acceptance / Evidence Ownership**  
Migration tests + schema DB readback + OpenAPI diff.

## T1516 — PR #55 Golden E2E Non-regression

**Goal**  
Prove Slice 15 did not regress the authority-converged Digital Use baseline.

**Exact Scope**  
Run existing Golden E2E/vertical convergence/runtime hardening and relevant scene/domain tests without weakening assertions.

**Allowed Files / Areas**  
Tests may be extended only for legitimate new Slice 15 behavior; existing baseline assertions cannot be deleted/relaxed to pass.

**Frozen Spec Authority**  
FR-001–FR-030 non-regression and Acceptance Scenario 48.

**Prerequisites**  
T1502–T1515.

**Verification**  
A1001→A2010, A3000/A4001 parallel lanes, A4003 HOLD, Family Alliance independence, current Contract content and authority convergence all pass.

**Stop Conditions**  
STOP on a baseline regression; fix implementation, not the Golden E2E expectation, unless current Authority formally changed.

**Acceptance / Evidence Ownership**  
Existing PR #55-derived integration/domain suites.

## T1517 — Exact-head Closeout and Audit 2 Evidence Package

**Goal**  
Produce a complete exact-head proof bundle for independent Audit 2.

**Exact Scope**  
Run full required checks, capture exact commit/tree, changed files, migration head, spec/doc blobs, test outputs, OpenAPI status, production-provider state and negative-space scan.

**Allowed Files / Areas**  
No semantic feature expansion. Evidence/log files only where repository convention permits.

**Frozen Spec Authority**  
All FR-001–FR-030 and all acceptance evidence rows.

**Prerequisites**  
T1501–T1516.

**Verification**  
typecheck, static guard, domain/scene tests, targeted review/DB suites, OpenAPI generate/check, governance validator/self-tests, verify-all and exact-head CI all PASS. Remote readback shows no Docs/spec mutation and production Professional provider remains UNAVAILABLE unless a real external authority was separately approved and integrated under a new authority event.

**Stop Conditions**  
STOP on any CI failure, head drift, authority drift, production fixture leakage or unresolved finding.

**Acceptance / Evidence Ownership**  
Developer provides exact-head evidence; independent Audit 2 owns final merge-safety decision.
