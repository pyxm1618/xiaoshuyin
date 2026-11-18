# Feature Specification: Common Core Goal / ConfirmGoal Runtime Prerequisite

**Feature Directory**: `specs/common-core-goal-confirmgoal-runtime-prerequisite`  
**Status**: PLANNING PREREQUISITE — NO PRODUCTION IMPLEMENTATION IN THIS CHANGE  
**Baseline**: `9b474bb633c3e62c162cf810d759014008e43950`

This feature is a downstream implementation projection of the current V1 Authority. It does not change Product or Technical Authority.

## Upstream Traceability

| Source | Contract projected here |
|---|---|
| `Docs/V1产品需求.md` §2.4 | Case phase and service status remain separate truths. |
| `Docs/V1产品需求.md` §2.6 | A formal Goal carries baseline, target change, observation method/window, protective conditions, parent actions, real participant responsibility source when applicable, and review point. |
| `Docs/V1技术设计.md` §6.7 | `GOALS --ConfirmGoal--> PLANNING` is the formal transition. |
| `Docs/V1技术设计.md` §7.3 | Minimum Goal model and `CURRENT / NEEDS_REVIEW` review-state contract. |
| `Docs/V1技术设计.md` §12.3B.6 | Common Core Case owner is the single Case phase writer; A2010 is eligibility only; Scene runtime cannot write `PLANNING`. |
| `Docs/V1技术设计.md` §28.3 | Existing public API surface includes `POST /api/v1/cases/:id/goals`. |
| `Docs/V1技术设计.md` §9 / §9.1 | Authorization and RLS are mandatory, independent gates. |
| `Docs/V1技术设计.md` §8.5 / §8.6 | Idempotency and stale-version/concurrency protection apply to authoritative commands. |

## Scope

This feature exists only to implement the smallest Common Core capability required to make the already-authorized `GOALS → PLANNING` transition real.

In scope:

1. one V1 Goal persistence owner;
2. typed Goal schema/repository primitives;
3. creation/saving of a Goal bound to the current confirmed/current Problem Formulation;
4. exact dependency references and review state;
5. real actor/time confirmation provenance;
6. one authoritative `ConfirmGoal` application/domain command;
7. atomic Goal confirmation + Case `GOALS → PLANNING`;
8. Authorization, Consent, Safety and Compliance revalidation at confirmation time;
9. family/case RLS isolation and referential integrity;
10. duplicate, concurrent and stale-formulation protection;
11. the existing `POST /api/v1/cases/:id/goals` surface as the minimal HTTP projection;
12. canonical tests proving a real confirmed formulation → GOALS → valid Goal → ConfirmGoal → PLANNING flow without administrative SQL phase fabrication.

## Requirements

- **GCR-001 Goal completeness** — no Goal may become confirmable unless every required V1 Goal Contract field is materially present. Empty arrays/blank strings cannot be used to fabricate completeness where the contract requires real content.
- **GCR-002 Formulation binding** — every Goal binds one exact current Problem Formulation id/version; confirmation rejects a stale, superseded, disputed, NEEDS_REVIEW or otherwise non-current/non-confirmed formulation.
- **GCR-003 Case binding** — a Goal belongs to exactly one Case and cannot reference another Case's formulation or dependencies.
- **GCR-004 Family isolation** — Goal reads/writes are protected by the existing family authorization entry point plus forced RLS; cross-family access fails closed.
- **GCR-005 Review state** — Goal review state is distinct from confirmation/lifecycle and supports `CURRENT / NEEDS_REVIEW`.
- **GCR-006 Confirmation provenance** — confirmation actor is an authenticated real Person and server confirmation time is persisted; AI/model output cannot confirm for the user.
- **GCR-007 Single phase authority** — only the Common Core ConfirmGoal owner may perform `GOALS → PLANNING`; Scene/A2010/client code never writes that transition.
- **GCR-008 Confirmation preconditions** — current Case must be primary/open and phase `GOALS`; current formulation must remain confirmed/current; Goal must remain complete/current; expected Case version must be current.
- **GCR-009 Authorization gate** — `ConfirmGoal` uses the single authorization entry point with an explicit Goal-confirm action under the existing Family-management semantics.
- **GCR-010 Consent gate** — applicable current Consent requirements are revalidated in the same transaction and block on missing/revoked/stale authority.
- **GCR-011 Safety gate** — authoritative Safety state/guard is revalidated and any block prevents confirmation/phase advancement.
- **GCR-012 Compliance gate** — current Compliance evaluation is revalidated and blocks/unknown failures do not become allow.
- **GCR-013 Dependency fidelity** — persisted dependency refs are exact, server-validated references; stale or cross-case refs fail closed.
- **GCR-014 Atomicity** — Goal confirmation provenance, Goal state, Case phase/version and audit/history commit or roll back together.
- **GCR-015 Idempotency** — same confirmed Goal/version replay returns the existing authoritative result and does not create duplicate confirmation side effects.
- **GCR-016 Concurrency** — concurrent ConfirmGoal attempts converge to one authoritative transition; no second current confirmed Goal or invalid intermediate Case phase is possible.
- **GCR-017 Wrong phase** — any Case not in `GOALS` is rejected without mutation.
- **GCR-018 Public boundary** — `POST /api/v1/cases/:id/goals` remains the only new public Goal surface required by current Authority; no Plan endpoint is invented here.
- **GCR-019 Auditability** — business history/audit records carry Case, Goal, formulation version, actor, from/to phase and resulting Case version.
- **GCR-020 No fabrication** — tests must not use administrator SQL to manufacture `PLANNING`; the integration proof must execute the real command path.

## Acceptance Scenarios

1. A valid GOALS Case with current CONFIRMED/CURRENT formulation accepts a complete Goal and ConfirmGoal atomically moves the Case to PLANNING.
2. An incomplete Goal cannot be confirmed and cannot advance the Case.
3. A Goal bound to an older formulation version is rejected after the current formulation changes.
4. A non-GOALS Case is rejected without Goal confirmation or phase mutation.
5. An unauthenticated/unauthorized actor cannot create or confirm a Goal.
6. Safety block prevents confirmation and leaves Goal/Case unchanged.
7. missing/stale Consent or blocking Compliance prevents confirmation and leaves Goal/Case unchanged.
8. duplicate ConfirmGoal produces one authoritative business result.
9. concurrent ConfirmGoal produces one authoritative confirmed Goal and one phase advancement.
10. cross-family/cross-case Goal/formulation/dependency references are rejected by application rules and database integrity/RLS.
11. the integration test reaches PLANNING only through ConfirmGoal, with no administrative SQL phase update.

## Explicit Out of Scope

- Plan persistence/runtime, `ActivatePlan`, Intervention selection, Review runtime;
- Phase 3 C4/C5/C6/T2 or any content from PR #70;
- C8–C12, Slice 17, Professional Knowledge, Production Readiness, frontend;
- changes to PR #58, #63, #67 or #70;
- changing any of the four Authority Docs;
- making A2010 or any Scene service a Case phase writer;
- any test-only fake phase helper or administrator SQL progression.

## Acceptance Evidence

The implementation PR must provide, on its exact Head:

- domain/service tests for valid, incomplete, stale formulation, wrong phase, invalid actor, Safety, Consent/Compliance and successful confirmation;
- PostgreSQL tests for Goal integrity, RLS/family isolation and cross-case reference rejection;
- integration proof: current confirmed formulation → GOALS → create valid Goal → ConfirmGoal → PLANNING;
- duplicate and concurrent confirmation evidence;
- static guard proving A2010/Scene have no direct `GOALS → PLANNING` writer and tests contain no admin SQL phase fabrication for this path;
- canonical Contract, Static Checks, DB Migration, Unit Tests, Integration Tests, Spec Governance and full verify.
