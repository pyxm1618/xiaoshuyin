# Feature Specification: Common Core Goal / ConfirmGoal Runtime

**Feature Directory**: `specs/common-core-goal-confirmgoal-runtime`  
**Status**: PLANNED / GOVERNANCE-PREREQUISITE ONLY  
**Authority baseline**: `origin/main@9b474bb633c3e62c162cf810d759014008e43950`  
**Authority Phase**: `Phase 4 — Execution Closure / 执行闭环`

> This feature is a downstream implementation projection of the current V1 Authority. It does not create or modify product semantics.
>
> Goal belongs to Phase 4, but this PR does **not** start or reorder full Phase 4 implementation. The prerequisite is being registered early only because the current Phase 3 T1 canonical deterministic E2E must traverse the real Common Core `GOALS -> ConfirmGoal -> PLANNING` path, while current main lacks the finite governance/ownership prerequisite required for a future runtime PR. Plan / Intervention / Review runtime remains out of scope.

## Upstream Traceability

| Authority | Projection |
|---|---|
| `Docs/V1产品需求.md` §2.4 | Case phase is distinct from service status. |
| `Docs/V1产品需求.md` §2.5 | A current confirmed Problem Formulation is required before Goal confirmation. |
| `Docs/V1产品需求.md` §2.6 | Goal contract: baseline, target change, observation method/window, protective conditions, parent actions, participant responsibility evidence when required, review point. |
| `Docs/V1产品需求.md` Case Phase / Digital Use parallel-lanes contract | `GOALS` does not skip A2003-A2010; A2010 solution-stage prerequisites remain part of the normal flow. |
| `Docs/V1技术设计.md` §6.7 | `GOALS --ConfirmGoal--> PLANNING` is the formal phase transition; primary and Safety guard Confirm Goal. |
| `Docs/V1技术设计.md` §7.3 | Goal minimum model and `CURRENT / NEEDS_REVIEW` review state. |
| `Docs/V1技术设计.md` §12.3B.6 | Common Core Case aggregate is the single Case phase authority; A2010 completion is a ConfirmGoal eligibility prerequisite and A2010 is not a phase writer. |
| `Docs/V1技术设计.md` §28.3 | Public Goal capability is `POST /api/v1/cases/:id/goals`. |
| `Docs/V1技术设计.md` Phase 4 | Goal is part of `Phase 4 — Execution Closure / 执行闭环`. |

## Scope

In scope for the future runtime only:

1. V1 minimum Goal persistence owned by Common Core.
2. Goal creation/save only for a legal current `GOALS` Case and the current confirmed Problem Formulation.
3. Exact persistence of Goal contract fields, dependency refs, review state, confirmation actor and confirmation time.
4. A server-owned `ConfirmGoal` application/domain command.
5. Atomic Goal confirmation plus `cases.phase: GOALS -> PLANNING`.
6. Authorization, Consent, Safety and Compliance fail-closed gates.
7. Stale formulation / stale Case version protection.
8. Duplicate and concurrent `ConfirmGoal` convergence.
9. Family / Case isolation, FK integrity, RLS and auditable confirmation.
10. The existing Authority endpoint shape `POST /api/v1/cases/:id/goals`; no product endpoint invention.

This prerequisite PR itself contains no production/runtime implementation.

## Explicit Out of Scope

- Full Phase 4 implementation or roadmap reordering.
- Plan persistence/runtime, `ActivatePlan`, Intervention Selection, Review runtime.
- Phase 3 C4/C5/C6/T1/T2 production code.
- C8-C12, Slice 17, Professional Knowledge, frontend, production-readiness work.
- Direct A2010 or Scene writes to `cases.phase`.
- Admin-SQL phase fabrication in tests.
- Authority Doc changes.
- Changes to PR #70, #58, #63 or #67.

## Requirements

- **GCR-001 — Goal contract fidelity:** a confirmable Goal MUST contain non-empty baseline refs, target description, observation method, observation window, protective conditions, parent actions, review point, dependency refs, and participant evidence whenever a participant responsibility is represented.
- **GCR-002 — Formulation binding:** every Goal MUST bind the exact current confirmed Problem Formulation version for the same Case.
- **GCR-003 — Legal creation state:** Goal creation/save MUST reject a Case that is not in `GOALS`, is not primary/eligible under current Case advancement authority, or has a non-current/non-confirmed formulation.
- **GCR-004 — Real confirmation:** AI MUST NOT manufacture user confirmation. Confirmation actor/time MUST be server persisted and traceable to an authenticated authorized actor.
- **GCR-005 — ConfirmGoal gate:** `ConfirmGoal` MUST lock/re-read the current Case and server-side re-check all advancement prerequisites at execution time: current Case phase is `GOALS`; the Case still satisfies current primary / advancement authority; the current Problem Formulation is `CONFIRMED / CURRENT`; the Goal contract is complete; the Goal is bound to the exact current formulation/version; the user confirmation is real and traceable; Digital Use A2010 solution-stage prerequisite is `COMPLETED`; and Authorization, Consent, Safety and Compliance are not blocking. A2010 completion is an eligibility prerequisite only; it is not a phase writer.
- **GCR-006 — Single phase writer:** only the Common Core owner executing `ConfirmGoal` may perform `GOALS -> PLANNING`; A2010, Scene services and clients MUST NOT write that transition.
- **GCR-007 — Atomicity:** Goal confirmation, confirmation audit and Case phase advancement MUST commit or roll back as one transaction.
- **GCR-008 — Idempotency/concurrency:** replay of the same Goal/version returns the authoritative result without a second transition; a competing Goal/version or stale Case version conflicts; concurrent confirms converge to one authoritative confirmed current Goal.
- **GCR-009 — DB integrity:** Goal belongs to one Case/Family, references a valid formulation version for that Case, and invalid cross-case/cross-family references fail closed.
- **GCR-010 — Review state:** a Goal usable as downstream execution basis MUST expose `CURRENT / NEEDS_REVIEW` separately from lifecycle/confirmation state.
- **GCR-011 — No empty confirmed Goal:** DB/application invariants MUST prevent construction of a confirmed/current Goal that bypasses the formal command where the existing lifecycle defense pattern requires database enforcement.
- **GCR-012 — Integration proof:** a real canonical path MUST prove `confirmed/current Problem Formulation -> Case GOALS -> A2003 ... A2010 normal solution-stage flow -> A2010 solution-stage prerequisite COMPLETED -> valid Goal -> ConfirmGoal -> Case PLANNING` without administrator SQL phase writes. A2010 completion MUST NOT itself write `PLANNING`.
- **GCR-013 — Single-endpoint Goal transport:** the only public Goal mutation endpoint is `POST /api/v1/cases/:id/goals`, and its request body MUST be a strict discriminated union with required `operation = SAVE | CONFIRM`. `SAVE` persists an unconfirmed Goal/version bound to the exact current Problem Formulation, returns its exact persisted identity/version, never executes `ConfirmGoal`, never writes confirmation actor/time, and never advances Case phase. `CONFIRM` MUST explicitly target an already-persisted exact `goalId`/`goalVersion`, MUST NOT create a missing Goal or mutate/save Goal contract content, and is the only operation that maps to the formal `ConfirmGoal` command. Missing/unknown `operation`, implicit field-presence inference, `goalId`-presence inference, second-call inference, `confirm: true/false`, automatic confirmation of a complete Goal, and any second public Goal confirmation endpoint are forbidden. Existing Authentication, `If-Match`, `Idempotency-Key`, ETag and Case-version concurrency conventions remain independent of this discriminator.

## Acceptance Scenarios

1. Case remains current primary/advancement-eligible, current formulation is confirmed/current, A2010 solution-stage prerequisite is COMPLETED, Goal is complete and exactly bound, all gates allow, and real actor confirmation advances exactly once to PLANNING.
2. Incomplete Goal is rejected and Case remains GOALS.
3. Goal bound to a stale formulation is rejected.
4. Case outside GOALS is rejected.
5. Invalid/unauthorized actor is rejected without information leakage.
6. Authorization, Safety, Consent or Compliance block prevents confirmation and phase change.
7. Duplicate replay returns the existing authoritative result without duplicate confirmation side effects.
8. Concurrent confirms yield one authoritative confirmed current Goal and one phase advancement.
9. Cross-family/cross-case Goal or formulation references fail at application and/or DB defense.
10. Tests never fabricate PLANNING with administrator SQL.
11. **A2010 incomplete negative:** with Case phase = GOALS, Problem Formulation = CONFIRMED/CURRENT and a complete Goal, if A2010 solution-stage prerequisite != COMPLETED, `ConfirmGoal` is rejected, Case remains GOALS, and the Goal is not promoted to the authoritative confirmed Goal.
12. **Primary changed negative:** after `operation = SAVE` persists a Goal while the Case is primary, if primary / advancement authority changes before `operation = CONFIRM` targets that same exact saved Goal/version, `ConfirmGoal` is rejected and Case remains GOALS.

## Acceptance Evidence

Future runtime PR must provide:

- domain/service tests for GCR-001 through GCR-008;
- explicit negative tests for A2010 incomplete and primary/advancement eligibility changing after Goal creation;
- PostgreSQL migration/integrity/RLS tests for GCR-009 through GCR-011;
- integration proof for GCR-012;
- architecture/static guards proving both that A2010/Scene runtime cannot write `GOALS -> PLANNING` and that A2010 completion is required before `ConfirmGoal`;
- canonical Contract, Static Checks, DB Migration, Unit Tests, Integration Tests, Spec Governance and `verify-all` evidence on the exact candidate Head.

This prerequisite branch intentionally contains no production/runtime implementation.
