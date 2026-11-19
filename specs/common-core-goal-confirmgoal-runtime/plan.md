# Common Core Goal / ConfirmGoal Runtime — Implementation Plan

## Upstream Traceability

This plan implements only the current Authority projected in `spec.md`. Authority Docs are immutable inputs for this feature.

## Constitution Check

- Authority Phase: `Phase 4 — Execution Closure / 执行闭环`.
- Early prerequisite rationale: current Phase 3 T1 canonical deterministic E2E requires the real `GOALS -> ConfirmGoal -> PLANNING` path; this prerequisite does not start full Phase 4 or reorder the roadmap.
- One Common Core Case phase authority: PASS by design.
- A2010 completion is required for ConfirmGoal eligibility: PASS by design.
- No Scene/A2010 direct phase write: PASS by design.
- ConfirmGoal re-checks current primary / advancement authority at execution time: required.
- Authorization / Consent / Safety / Compliance fail closed: required.
- No Plan/Intervention/Review expansion: required.
- No Authority changes: required.
- Runtime work MUST NOT begin until the implementation-ownership prerequisite has merged into main.

## Implementation Topology

Expected production paths after the governance prerequisite is merged and latest main is re-read:

- `packages/domain/src/goal-*.ts` — typed Goal schema/repository/domain primitives; use only the finite modules actually needed by the runtime implementation.
- `packages/domain/src/index.ts` — SHARED Goal public-domain export composition only.
- `packages/authorization/src/authorize.ts` — SHARED existing single authorization owner; future runtime may add the explicit `CASE_CONFIRM_GOAL` action through the registered feature allowlist and MUST NOT create a second authorization framework.
- `apps/server/api/src/services/goals.ts` — Goal application orchestration and `ConfirmGoal` transaction composition.
- `apps/server/api/src/routes/goals.ts` — `POST /api/v1/cases/:id/goals` boundary.
- `apps/server/api/src/app.ts` — SHARED route composition only.
- `apps/server/api/src/openapi-spec.ts` — SHARED existing static OpenAPI projection only if required by the current contract workflow.
- `packages/generated/openapi.json` — SHARED generated output from the existing OpenAPI generator; MUST be regenerated/committed when the source projection changes.
- `packages/generated/openapi.d.ts` — SHARED generated output from the existing OpenAPI generator; MUST be regenerated/committed when the source projection changes.
- `db/migrations/026_common_core_goal_confirm_goal_runtime.sql` — planned next migration on the current baseline; MUST be renumbered through a new governance prerequisite if latest main occupies 026 before implementation starts.

No Plan runtime module is permitted.

## Shared Error Contract Constraint

The future Goal runtime MUST first reuse the repository's existing public error contracts and schemas when they can express the Authority-required failure semantics.

This prerequisite does **not** pre-authorize `apps/server/api/src/plugins/error-handler.ts`, `packages/contracts/src/schemas.ts`, or other shared error infrastructure. If runtime implementation proves that the current formal error contract cannot express an Authority-required Goal/ConfirmGoal error or schema, the runtime developer MUST stop and create a separate minimal governance/ownership prerequisite before modifying that shared infrastructure.

## Persistence Design

The migration will project the V1 Goal minimum model with:

- Case and Problem Formulation version identity;
- Goal contract fields;
- dependency references;
- confirmation actor/time;
- review state;
- immutable/auditable confirmation identity;
- same-Case/formulation integrity;
- current-confirmed uniqueness/concurrency defense appropriate to the repository pattern;
- forced RLS/family isolation consistent with existing Case/Problem Formulation tables.

## Application / Command Design

`ConfirmGoal` executes as one atomic database transaction. The concrete code ordering may follow the repository's established transaction/authorization pattern, but the following semantic gates MUST all be re-read/re-validated at execution time before advancement:

1. lock/re-read Case and validate expected Case version;
2. verify current Case `phase = GOALS`;
3. verify current primary / advancement authority still permits this Case to advance;
4. read/lock current Problem Formulation and require `CONFIRMED / CURRENT`;
5. read Goal and verify exact binding to the current formulation/version;
6. verify Goal contract completeness;
7. verify Digital Use A2010 solution-stage prerequisite = `COMPLETED`;
8. verify the current user confirmation is real, traceable and attributable to an authenticated actor;
9. re-check Authorization through the existing single authorization owner;
10. re-check Consent;
11. re-check Safety;
12. re-check Compliance;
13. perform stale/concurrency checks for Case/formulation/Goal and reject competing or stale advancement;
14. atomically persist Goal confirmation/audit and perform exactly one `GOALS -> PLANNING` Case advancement;
15. return the existing authoritative result on exact idempotent replay.

A Goal that was saved while the Case was primary does not retain permanent advancement permission. If primary / advancement authority changes before `ConfirmGoal`, the command rejects and Case remains GOALS.

A2010 completion is only an eligibility prerequisite. A2010, Scene services and clients cannot write `cases.phase = PLANNING`; only Common Core `ConfirmGoal` owns that transition.

## API Boundary

Use only the Authority-listed `POST /api/v1/cases/:id/goals` capability. The exact create/confirm request shape must follow the current repository Fastify/Zod/idempotency/If-Match pattern after re-reading latest main; no new product endpoint is invented.

The current OpenAPI workflow generates `packages/generated/openapi.json` and `packages/generated/openapi.d.ts` from `apps/server/api/src/openapi-spec.ts`, and CI requires the committed generated artifacts to remain synchronized.

## Migration Strategy

Before runtime coding, re-read the actual latest migration sequence. Current planning baseline ends at `025_slice16_post_merge_forensic_remediation.sql`; therefore `026_common_core_goal_confirm_goal_runtime.sql` is only reserved by this topology prerequisite. If main changes first, stop and reconcile governance rather than reusing an occupied number.

## Verification Plan

- Contract completeness and pure validation.
- A2010 incomplete rejection: `ConfirmGoal` rejected, Case remains GOALS, Goal not promoted to authoritative confirmed Goal.
- Primary/advancement eligibility changed after Goal creation: `ConfirmGoal` rejected and Case remains GOALS.
- Authorization / Consent / Safety / Compliance gate matrix.
- Wrong phase / stale formulation / stale Case version.
- Duplicate and concurrent confirmation.
- DB FK, same-Case binding, RLS/family isolation.
- Atomic rollback.
- Real canonical integration path from confirmed/current Problem Formulation through A2003-A2010, A2010 COMPLETED, valid Goal and `ConfirmGoal` to PLANNING with no administrator SQL phase fabrication.
- Static guards proving A2010/Scene cannot directly write PLANNING and proving A2010 completion is required before `ConfirmGoal`.
- OpenAPI source + generated output synchronization through the existing generator/check.
- Exact-head repository Contract, Static Checks, DB Migration, Unit Tests, Integration Tests, Spec Governance and `verify-all` in the runtime PR.

## Stop Conditions

Stop rather than guess if latest main changes the Goal Authority, phase command, gate ownership, migration sequence, implementation ownership, or current Problem Formulation/Case transaction pattern.

Also stop if the current formal public error contract cannot express an Authority-required Goal/ConfirmGoal failure. Do not expand error-handler/contracts under this prerequisite; create a separate minimal governance/ownership prerequisite only when that need is proven.
