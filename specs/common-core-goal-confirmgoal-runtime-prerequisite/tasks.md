# Tasks: Common Core Goal / ConfirmGoal Runtime Prerequisite

## Task Index

- [ ] T001 [REQ:GCR-001,GCR-002,GCR-003,GCR-007] [VERIFY:exact main/CI/migration/owner Remote Truth]
- [ ] T002 [REQ:GCR-001,GCR-002,GCR-003,GCR-004,GCR-005,GCR-006,GCR-013,GCR-016,GCR-019] [VERIFY:fresh/replay migration + DB integrity/RLS tests]
- [ ] T003 [REQ:GCR-001,GCR-002,GCR-005,GCR-013] [VERIFY:Goal completeness/currentness domain tests]
- [ ] T004 [REQ:GCR-004,GCR-009] [VERIFY:authorization allow/deny matrix]
- [ ] T005 [REQ:GCR-006,GCR-007,GCR-008,GCR-010,GCR-011,GCR-012,GCR-013,GCR-014,GCR-015,GCR-016,GCR-017,GCR-019] [VERIFY:ConfirmGoal service + atomicity/idempotency tests]
- [ ] T006 [REQ:GCR-018] [VERIFY:HTTP contract/OpenAPI integration tests]
- [ ] T007 [REQ:GCR-015,GCR-016,GCR-017] [VERIFY:PostgreSQL duplicate/concurrency/stale tests]
- [ ] T008 [REQ:GCR-002,GCR-007,GCR-014,GCR-020] [VERIFY:real formulation→GOALS→Goal→ConfirmGoal→PLANNING integration proof]
- [ ] T009 [REQ:GCR-007,GCR-018,GCR-020] [VERIFY:static negative-scope and no-direct-phase-write guards]
- [ ] T010 [REQ:GCR-001,GCR-020] [VERIFY:Contract+Static+DB+Unit+Integration+Spec Governance+full verify exact-head]

## Execution Rules

These tasks are executed only after required governance prerequisites are merged into main. Never edit the four Authority Docs to make implementation easier. Never merge from the Developer AI.

## T001 — Development-start Remote Truth

Read exact main SHA, CI, migration head, Authority Docs, AGENTS, Authority Unit registry, implementation ownership, PR #70/#58/#63/#67 and current Case/Problem Formulation owners. Confirm no semantic drift and allocate the real next migration number.

**Verification:** exact SHA/migration/owner inventory recorded; no production mutation before PASS.

## T002 — Goal persistence and repository

Implement the minimum Goal schema/repository with exact Case + Problem Formulation binding, full Goal Contract fields, dependency refs, review state, confirmation provenance, integrity constraints, forced RLS and concurrency-safe current/confirmation invariants.

**Verification:** fresh/replay migration; FK/cross-case negative tests; RLS/family isolation; confirmation integrity.

## T003 — Goal contract validator

Implement deterministic completeness and currentness validation. Blank/empty placeholder content cannot become confirmable.

**Verification:** valid and incomplete Goal domain tests; stale dependency/formulation tests.

## T004 — Explicit Goal authorization action

Add `CASE_CONFIRM_GOAL` to the existing single authorization entry point and server adapter using exact Case resource + Family-management manager authority. No second authorization framework.

**Verification:** allow/deny matrix, cross-family/cross-case denial, invalid actor denial.

## T005 — ConfirmGoal authoritative command

Implement one authoritative command with canonical locking, expected Case version, current phase GOALS, current confirmed/current formulation, Goal binding/completeness/currentness, Consent/Safety/Compliance revalidation, dependency freshness, confirmation provenance, Case phase/version transition, audit/history and idempotency in one transaction.

**Verification:** success, wrong phase, stale formulation, blocked gates, rollback fault injection.

## T006 — API projection

Implement the existing `POST /api/v1/cases/:id/goals` surface using strict request schema and current project route/application conventions. Do not invent Plan endpoints.

**Verification:** contract/OpenAPI checks and HTTP integration tests.

## T007 — Duplicate / concurrency / stale protection

Prove same Goal/version replay is idempotent, conflicting Goal/version or stale expected Case version conflicts, and concurrent confirmation produces only one authoritative result.

**Verification:** real PostgreSQL concurrency tests with final-state assertions.

## T008 — Canonical integration proof

Using only real application/domain commands, establish current confirmed Problem Formulation → GOALS → valid Goal → ConfirmGoal → PLANNING.

**Verification:** no administrator SQL phase update; exact final Goal/Case/audit state asserted.

## T009 — Static negative-scope guard

Prove A2010 and Scene services do not directly write PLANNING; no Plan/ActivatePlan/Intervention/Review runtime was added; PR #70 content was not copied into this feature.

**Verification:** architecture/static tests over production and relevant tests.

## T010 — Exact-head verification and handoff

Run canonical commands discovered from current package/workflows: Contract, Static Checks, DB Migration, Unit Tests, Integration Tests, Spec Governance and full verify. Re-read main and candidate Head for drift.

**Verification:** all required checks PASS on exact candidate Head; open Draft PR for independent audit; do not merge.
