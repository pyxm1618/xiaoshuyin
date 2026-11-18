# Tasks: Common Core Goal / ConfirmGoal Runtime Prerequisite

## Execution Rules

These tasks are executed only after required governance prerequisites are merged into main. Never edit the four Authority Docs to make implementation easier. Never merge from the Developer AI.

## TCG01 — Development-start Remote Truth

Read exact main SHA, CI, migration head, Authority Docs, AGENTS, Authority Unit registry, implementation ownership, PR #70/#58/#63/#67 and current Case/Problem Formulation owners. Confirm no semantic drift and allocate the real next migration number.

**Verification:** exact SHA/migration/owner inventory recorded; no production mutation before PASS.

## TCG02 — Goal persistence and repository

Implement the minimum Goal schema/repository with exact Case + Problem Formulation binding, full Goal Contract fields, dependency refs, review state, confirmation provenance, integrity constraints, forced RLS and concurrency-safe current/confirmation invariants.

**Verification:** fresh/replay migration; FK/cross-case negative tests; RLS/family isolation; confirmation integrity.

## TCG03 — Goal contract validator

Implement deterministic completeness and currentness validation. Blank/empty placeholder content cannot become confirmable.

**Verification:** valid and incomplete Goal domain tests; stale dependency/formulation tests.

## TCG04 — Explicit Goal authorization action

Add `CASE_CONFIRM_GOAL` to the existing single authorization entry point and server adapter using exact Case resource + Family-management manager authority. No second authorization framework.

**Verification:** allow/deny matrix, cross-family/cross-case denial, invalid actor denial.

## TCG05 — ConfirmGoal authoritative command

Implement one authoritative command with canonical locking, expected Case version, current phase GOALS, current confirmed/current formulation, Goal binding/completeness/currentness, Consent/Safety/Compliance revalidation, dependency freshness, confirmation provenance, Case phase/version transition, audit/history and idempotency in one transaction.

**Verification:** success, wrong phase, stale formulation, blocked gates, rollback fault injection.

## TCG06 — API projection

Implement the existing `POST /api/v1/cases/:id/goals` surface using strict request schema and current project route/application conventions. Do not invent Plan endpoints.

**Verification:** contract/OpenAPI checks and HTTP integration tests.

## TCG07 — Duplicate / concurrency / stale protection

Prove same Goal/version replay is idempotent, conflicting Goal/version or stale expected Case version conflicts, and concurrent confirmation produces only one authoritative result.

**Verification:** real PostgreSQL concurrency tests with final-state assertions.

## TCG08 — Canonical integration proof

Using only real application/domain commands, establish current confirmed Problem Formulation → GOALS → valid Goal → ConfirmGoal → PLANNING.

**Verification:** no administrator SQL phase update; exact final Goal/Case/audit state asserted.

## TCG09 — Static negative-scope guard

Prove A2010 and Scene services do not directly write PLANNING; no Plan/ActivatePlan/Intervention/Review runtime was added; PR #70 content was not copied into this feature.

**Verification:** architecture/static tests over production and relevant tests.

## TCG10 — Exact-head verification and handoff

Run canonical commands discovered from current package/workflows: Contract, Static Checks, DB Migration, Unit Tests, Integration Tests, Spec Governance and full verify. Re-read main and candidate Head for drift.

**Verification:** all required checks PASS on exact candidate Head; open Draft PR for independent audit; do not merge.
