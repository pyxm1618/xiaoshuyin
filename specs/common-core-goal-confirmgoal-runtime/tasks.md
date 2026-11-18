# Common Core Goal / ConfirmGoal Runtime — Tasks

## Execution Rules

- This feature is a direct projection of current V1 Authority.
- Do not implement production code until the repository-controlled ownership topology is merged into main.
- Do not modify Authority Docs.
- Do not modify PR #70, #58, #63 or #67.
- Do not merge any PR as part of developer execution.

## Tasks

- [x] T2001 [REQ:GCR-001,GCR-002,GCR-003,GCR-004,GCR-005,GCR-006,GCR-007,GCR-008,GCR-009,GCR-010,GCR-011,GCR-012] [VERIFY:Spec Governance] Establish only the feature projection and finite implementation ownership; no `apps/`, `packages/`, `db/`, Authority Doc, Authority Unit registry, or change-binding delta is permitted in this prerequisite.
- [ ] T2002 [REQ:GCR-002,GCR-003,GCR-005,GCR-006] [VERIFY:Remote Truth read-back] After T2001 is independently audited and merged, re-read latest main, PR #70 read-only, Authority Docs, ownership, Authority Unit registry, migration sequence, workflows, and current Case/Problem Formulation runtime before any product code.
- [ ] T2003 [REQ:GCR-001,GCR-002,GCR-009,GCR-010,GCR-011] [VERIFY:DB Migration + DB tests] Add the current-baseline Goal persistence owner with same-Case/formulation integrity, family isolation, forced RLS, confirmation auditability, review state, and concurrency defenses; do not create Plan runtime.
- [ ] T2004 [REQ:GCR-001,GCR-002,GCR-003,GCR-004] [VERIFY:Domain + service tests] Implement legal Goal create/save bound to the current confirmed formulation; reject incomplete, stale, wrong-phase, invalid-actor, and invalid-reference inputs.
- [ ] T2005 [REQ:GCR-005,GCR-006,GCR-007,GCR-008] [VERIFY:Service + integration tests] Implement one atomic `ConfirmGoal` command that revalidates Case, formulation, Goal contract, real user confirmation, Authorization, Consent, Safety, and Compliance, then performs exactly one `GOALS -> PLANNING` advancement with idempotent/concurrent convergence.
- [ ] T2006 [REQ:GCR-003,GCR-004,GCR-005] [VERIFY:Contract + OpenAPI] Expose only the Authority-listed `POST /api/v1/cases/:id/goals` projection using the current Fastify/Zod/idempotency/version pattern; do not invent a product endpoint.
- [ ] T2007 [REQ:GCR-006,GCR-012] [VERIFY:Static + integration negative guards] Prove A2010, Scene services, and client/request payloads cannot directly write `cases.phase = PLANNING`, and prove the canonical integration path contains no administrator SQL phase fabrication.
- [ ] T2008 [REQ:GCR-001,GCR-002,GCR-003,GCR-004,GCR-005,GCR-006,GCR-007,GCR-008,GCR-009,GCR-010,GCR-011,GCR-012] [VERIFY:Contract + Static Checks + DB Migration + Unit Tests + Integration Tests + Spec Governance + verify-all] Run all canonical exact-head verification, freeze the candidate Head for independent audit, and stop without merge.
