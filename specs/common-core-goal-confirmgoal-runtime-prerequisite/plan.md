# Plan: Common Core Goal / ConfirmGoal Runtime Prerequisite

## Upstream Traceability

This plan implements only the contracts listed in `spec.md`. Authority Docs remain read-only.

## Constitution Check

- Single Common Core Case phase authority: preserved.
- Authorization / Consent / Safety / Compliance: independent fail-closed gates.
- RLS: mandatory second line of family isolation.
- No V2–V5 pull-forward: PASS.
- No Plan/Intervention/Review runtime: PASS.
- No Authority Doc mutation: PASS.
- Production ownership must be pre-registered before implementation: REQUIRED.
- New migration must be allocated only after a fresh main/migration read-back: REQUIRED.

## Architecture

### Domain / persistence

Planned modules:

~~~text
packages/domain/src/goal-schema.ts
packages/domain/src/goal-repository.ts
packages/domain/src/goal-runtime.ts
packages/domain/src/index.ts
~~~

The Goal owner holds typed persistence shape, completeness validation, exact formulation binding, dependency validation, review-state semantics, confirmation state/provenance and the authoritative mutation primitives used by ConfirmGoal.

### Application service

Planned module:

~~~text
apps/server/api/src/services/goal-runtime.ts
~~~

The service owns one RLS transaction and composes:

1. authentication-derived actor/family context;
2. explicit Goal authorization action;
3. deterministic idempotency slot;
4. canonical Family → Case → current Problem Formulation → Goal lock order;
5. Case phase/version check;
6. current CONFIRMED/CURRENT formulation check;
7. Goal completeness/currentness and exact formulation binding;
8. Consent gate;
9. Safety gate;
10. Compliance gate;
11. dependency freshness;
12. Goal confirmation provenance;
13. atomic Case `GOALS → PLANNING` and version update;
14. domain/audit history;
15. idempotency settlement.

No Scene service calls `UPDATE cases SET phase='PLANNING'`.

### Authorization

Add only the explicit `CASE_CONFIRM_GOAL` action to the existing single authorization owner and route adapter. It uses the existing Family-management manager semantics and exact Case resource matching; no new role system is introduced.

### API

Planned route:

~~~text
POST /api/v1/cases/:id/goals
~~~

The route uses strict input validation, authenticated actor, current Family resolution, expected Case version and idempotency. It may represent create/save + explicit confirmation intent in the minimal Authority-compatible command shape, but must not invent a second public Goal endpoint unless current Authority is explicitly changed upstream.

### Database

Provisional migration ownership is registered for:

~~~text
db/migrations/026_common_core_goal_confirmgoal_runtime.sql
~~~

Before production implementation starts, re-read `main` and the migration directory. If 026 has been consumed, STOP and reconcile governance before writing a different migration number.

The migration must provide:

- Goal table with Case and exact Problem Formulation FK/integrity;
- family/case isolation;
- one authoritative current/confirmed Goal invariant as required by the command model;
- confirmation actor/time auditability;
- review_state `CURRENT / NEEDS_REVIEW`;
- server-owned confirmation constraints;
- forced RLS and grants matching existing runtime role patterns;
- concurrency-safe uniqueness/conditional constraints;
- no Plan/Intervention/Review tables.

## Test Strategy

### Domain/service

Valid Goal; incomplete Goal; stale formulation; wrong phase; invalid actor; Safety blocked; Consent/Compliance blocked; successful ConfirmGoal; duplicate and concurrent confirmation.

### Database

Fresh migration and replay; FK/cross-case rejection; forced RLS; family isolation; confirmation integrity; no second current confirmed Goal.

### Integration

Use real application commands to establish a confirmed current Problem Formulation and GOALS Case, create a valid Goal, run ConfirmGoal and assert PLANNING. No admin SQL Case-phase write is permitted.

### Static / governance

Guard against:

- A2010 direct phase write;
- Scene direct phase write;
- client-specified Case phase;
- admin SQL PLANNING fabrication in the new path;
- product files outside the pre-registered ownership set;
- accidental Plan/Intervention/Review implementation.

## Dependency / Stop Conditions

1. This planning/ownership prerequisite must merge first.
2. If current governance requires Authority Unit topology registration for the Goal/ConfirmGoal units, that registry change must land as a separate governance-only PR because Authority Unit registry changes cannot coexist with a new spec or production implementation.
3. Only after all required topology prerequisites are on `main` may the production runtime branch be created from the then-current `main`.
4. Any Authority semantic drift returns to planning; implementation convenience never edits Authority.
