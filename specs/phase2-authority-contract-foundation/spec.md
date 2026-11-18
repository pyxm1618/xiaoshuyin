# Feature Specification: Phase 2 Authority Contract Foundation

## Upstream Traceability

This feature is a **downstream projection only** of the four formal Authority Docs. It never creates product, technical, professional, legal, or runtime authority.

Phase 2 Authority convergence is now reflected here for the registry-bound D3/D7/D8 units. D4/D5 units continue to converge through their already-registered Compliance / Participant downstream owners.

Status: **CONVERGED**

## Scope

In scope:

- mechanically project the Phase 2 Authority contracts registered to this feature;
- provide non-runtime verification evidence for those contracts;
- expose unresolved Legal / Compliance dependencies as fail-closed dependencies rather than inventing runtime semantics.

Out of scope:

- production runtime remediation (C4-C7 / T1-T2);
- database/schema/migration changes;
- PR #58 / Slice 17;
- C1-C3, C8-C12, D6, E1-E4;
- claiming runtime implementation completion.

## Requirements

- **P2-AUTH-001 — D3 product projection:** Integrated Triage conflict semantics are dimension-local: same-dimension credible true/false = `CONFLICT`; a `CONFLICT` dimension is neither positive nor negative; an independent valid direct-impact `true` still establishes aggregate positive; 01002/01003 priority conflict always blocks.
- **P2-AUTH-002 — D7 frontend governance:** `Docs/frontend/*` is a downstream projection of the four Authority Docs, never a fifth Authority and never able to override them.
- **P2-AUTH-003 — GOALS→PLANNING:** `ConfirmGoal` is the one formal advancement command; A2010 completion is only a server-side eligibility prerequisite and never a second phase writer.
- **P2-AUTH-004 — Closure:** `CloseCase` carries closure reason, independent outcome, basis references, actor/source, server closure time, previous phase, version guard and conditional referral reference; it atomically closes status+phase and preserves immutable history.
- **P2-AUTH-005 — Review mapping:** every Review `next_action` maps to one explicit command/state effect; `PAUSE` pauses the Plan without inventing a PAUSED Case status or closing the Case.
- **P2-AUTH-006 — Review-state consistency:** Goal, InterventionInstance, PlanVersion, DigitalUseContractVersion and Task use `CURRENT / NEEDS_REVIEW` independently from lifecycle status; stale objects cannot remain an unchecked execution basis.
- **P2-AUTH-007 — Invitation lifecycle:** the formal V1 Technical Authority owns `PENDING / ACTIVE / DECLINED / EXPIRED / WITHDRAWN`; downstream Slice specs may project but never define or expand that lifecycle.
- **P2-AUTH-008 — INSUFFICIENT recovery:** recovery returns real missing requirements and a reachable A1001/01002/01003 collection/correction target; it never uses A2001/A2002 outcome pages as a substitute collection route.
- **P2-AUTH-009 — U19 Safety/Referral:** Safety entry is internal `EnterSafetyHold` from an approved Safety decision; resolution is Staff-only with `SAFETY_RESOLVE` + valid assignment/evidence; Referral uses the existing six-state lifecycle and explicit transition commands/APIs.
- **P2-AUTH-010 — Staff:** login resolves a server-owned StaffPrincipal; capability/assignment authorization is explicit, scoped, revocable and audited; `STAFF_ACCESS_ADMIN` manages grants only and cannot self-grant or imply business capabilities.
- **P2-AUTH-011 — No runtime claim:** these contracts close Authority ambiguity only. Production/runtime drift is intentionally deferred to Phase 3 and MUST NOT be represented here as already remediated.

## Acceptance Scenarios

1. The four formal Authority Docs remain the only Authority layer; this spec is downstream-only.
2. Registry-bound Phase 2 units have concrete, mechanically testable downstream statements instead of a pending placeholder.
3. No production source, migration or runtime behavior is changed by this convergence.
4. Any unresolved legal/compliance scope remains explicit and fail-closed rather than being silently interpreted by code.

## Acceptance Evidence

- `tests/architecture/phase2-authority-contract-foundation.test.ts` verifies the converged downstream status and core D3/D7/D8 contracts.
- Repository Spec Governance and all required CI checks must pass on the exact PR head.
