# Common Core Goal / ConfirmGoal Runtime — Implementation Plan

## Upstream Traceability

This plan implements only the current Authority projected in `spec.md`. Authority Docs are immutable inputs for this feature.

## Constitution Check

- One Common Core Case phase authority: PASS by design.
- No Scene/A2010 direct phase write: PASS by design.
- Authorization / Consent / Safety / Compliance fail closed: required.
- No Plan/Intervention/Review expansion: required.
- No Authority changes: required.
- Runtime work MUST NOT begin until the implementation-ownership prerequisite has merged into main.

## Implementation Topology

Expected production paths after the governance prerequisite is merged and latest main is re-read:

- `packages/domain/src/goal-*.ts` — typed Goal schema/repository/domain primitives; use only the finite modules actually needed by the runtime implementation.
- `packages/domain/src/index.ts` — Goal public-domain export composition only.
- `packages/authorization/src/authorize.ts` — add the explicit `CASE_CONFIRM_GOAL` action to the existing single authorization owner; do not create a second authorization framework.
- `apps/server/api/src/services/goals.ts` — Goal application orchestration and `ConfirmGoal` transaction composition.
- `apps/server/api/src/routes/goals.ts` — `POST /api/v1/cases/:id/goals` boundary.
- `apps/server/api/src/app.ts` — route composition only.
- `apps/server/api/src/openapi-spec.ts` — existing static OpenAPI projection only if required by the current contract workflow.
- `db/migrations/026_common_core_goal_confirm_goal_runtime.sql` — planned next migration on the current baseline; MUST be renumbered through a new governance prerequisite if latest main occupies 026 before implementation starts.

No Plan runtime module is permitted.

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

`ConfirmGoal` executes in one database transaction:

1. authorize actor against current Family/Case through the existing single authorization owner using the explicit `CASE_CONFIRM_GOAL` action;
2. lock Case and validate expected Case version;
3. require `phase = GOALS`;
4. read/lock current Problem Formulation and require confirmed/current;
5. read Goal and require exact formulation binding and complete contract;
6. validate traceable user confirmation;
7. re-check Authorization;
8. re-check Consent;
9. re-check Safety;
10. re-check Compliance;
11. reject stale Goal/formulation;
12. atomically settle Goal confirmation/audit and update Case to `PLANNING` with one Case-version advancement;
13. return the existing authoritative result on exact idempotent replay.

## API Boundary

Use only the Authority-listed `POST /api/v1/cases/:id/goals` capability. The exact create/confirm request shape must follow the current repository Fastify/Zod/idempotency/If-Match pattern after re-reading latest main; no new product endpoint is invented.

## Migration Strategy

Before runtime coding, re-read the actual latest migration sequence. Current planning baseline ends at `025_slice16_post_merge_forensic_remediation.sql`; therefore `026_common_core_goal_confirm_goal_runtime.sql` is only reserved by this topology prerequisite. If main changes first, stop and reconcile governance rather than reusing an occupied number.

## Verification Plan

- Contract completeness and pure validation.
- Authorization / Consent / Safety / Compliance gate matrix.
- Wrong phase / stale formulation / stale Case version.
- Duplicate and concurrent confirmation.
- DB FK, same-Case binding, RLS/family isolation.
- Atomic rollback.
- Real integration path from confirmed Problem Formulation to PLANNING with no admin SQL phase fabrication.
- Static guards for forbidden A2010/Scene phase writes.
- Exact-head repository Contract, Static Checks, DB Migration, Unit Tests, Integration Tests, Spec Governance and `verify-all` in the runtime PR.

## Stop Conditions

Stop rather than guess if latest main changes the Goal Authority, phase command, gate ownership, migration sequence, implementation ownership, or current Problem Formulation/Case transaction pattern.
