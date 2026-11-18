# Common Core Goal / ConfirmGoal Runtime — Tasks

## Execution Rules

- This feature is a direct projection of current V1 Authority.
- Do not implement production code until the repository-controlled ownership topology is merged into main.
- Do not modify Authority Docs.
- Do not modify PR #70, #58, #63 or #67.
- Do not merge any PR as part of developer execution.

## T-GCR-00 — Governance Prerequisite [VERIFY: Spec Governance]

**Goal:** establish the feature projection and finite implementation ownership without any product/runtime path change.

Expected changes:
- `specs/common-core-goal-confirmgoal-runtime/{spec.md,plan.md,checklist.md,tasks.md}`
- `.specify/implementation-ownership.json`

Acceptance evidence:
- no `apps/`, `packages/` or `db/` delta;
- no Authority Doc delta;
- no change-binding manifest;
- Spec Governance PASS on exact Head.

## T-GCR-01 — Runtime Remote-Truth Reconciliation [VERIFY: remote read-back]

After T-GCR-00 is independently audited and merged, re-read latest main, PR #70 readonly, Authority Docs, ownership, Authority Unit registry, migration sequence, workflows and Case/Problem Formulation runtime. If Authority Unit topology must change, perform that as a separate governance-only prerequisite before product implementation.

## T-GCR-02 — Goal Persistence [VERIFY: DB migration + DB tests]

Create the current-baseline migration and persistence owner with same-Case/formulation integrity, family isolation, RLS, confirmation auditability, review state and concurrency defenses. Do not implement Plan tables/runtime.

## T-GCR-03 — Goal Contract / Runtime [VERIFY: domain/service tests]

Create/save only legal Goals bound to the current confirmed formulation. Reject incomplete, stale, wrong-phase and invalid-reference Goals.

## T-GCR-04 — ConfirmGoal [VERIFY: service + integration tests]

Implement one atomic command that revalidates Case, formulation, Goal completeness, real actor confirmation, Authorization, Consent, Safety and Compliance, then settles Goal confirmation and `GOALS -> PLANNING`. Exact replay is idempotent; stale/competing commands conflict.

## T-GCR-05 — API / Composition [VERIFY: Contract + OpenAPI]

Expose only the Authority-listed `POST /api/v1/cases/:id/goals` projection using the current Fastify/Zod/idempotency/version pattern. Do not invent product endpoints.

## T-GCR-06 — Negative Ownership Guards [VERIFY: static tests]

Prove A2010, Scene services and client/request payloads cannot directly write `cases.phase = PLANNING`, and integration tests contain no administrator SQL phase fabrication.

## T-GCR-07 — Exact-Head Verification [VERIFY: full verify]

Run the repository canonical Contract, Static Checks, DB Migration, Unit Tests, Integration Tests, Spec Governance and full `verify-all`; freeze the exact Head for independent audit. Merge remains a separate owner decision.
