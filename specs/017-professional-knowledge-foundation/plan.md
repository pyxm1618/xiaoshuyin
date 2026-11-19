# Implementation Plan — Slice 17 Current-Main Reconciliation and Final Closure

## Upstream Traceability

This plan implements only the current formalized `017-professional-knowledge-foundation` contract. Upstream anchors are `V1-D27`, `V1-D28`, `V1-D29`, `V1-C34`, `A5001`, `A5002`, and the Professional Content gate for `01000`. Historical provenance remains the Frozen Spec at commit `9763bfd796aca9dbac20a94137dc330ef2b15971` and Planning Freeze `62020e02c908b870ff4aa445d068d6b09c19405a`.

## Summary

The implementation is already substantially present. Phase 3 Entry does not redesign it. It reconciles PR #58 with current Phase 2 main, re-verifies every historical finding against the composed code/database/test authority, closes only current Slice 17 merge blockers, and stops for an independent final audit.

Current targeted closure work is limited to:

1. current-main reconciliation without deleting either Phase 2 or Slice 17 authority;
2. DB-level closure of direct consumable INSERT bypass;
3. current `specs/017-*` formalization and change-governance binding;
4. exact-head and current-main composition verification.

## Constitution Check

- Single owner: no duplicate Staff, Approval, Scene package, idempotency, audit, Consent, Compliance, Safety, or Case owner is introduced.
- Fail closed: unknown, stale, invalid, unavailable, expired, revoked, mismatched, or unbound authority does not become approval/publication.
- Historical migrations: no used migration is renamed or rewritten; new DB hardening is forward-only.
- Runtime least privilege: FORCE RLS/grants remain authoritative; Family roles cannot administer professional assets.
- Phase boundary: no RAG, retrieval, Context Builder, AI runtime, model call, or Production Enablement work is permitted.
- Merge boundary: this plan does not authorize merging PR #58.

## Current-Main Reconciliation Contract

The latest Phase 2 main must be an ancestor of the exact PR head before final verification. Shared files must preserve both Phase 2 Goal authority and Slice 17 Professional Knowledge authority. Migration tests must reflect the composed migration set rather than choosing stale branch counts.

The two `026_*.sql` migrations are evaluated under the actual runner contract: complete filename identity + lexical ordering + checksum, not numeric-prefix aesthetics.

## Blocker Remediation

### Direct INSERT lifecycle bypass

A forward-only DB migration enforces that the runtime application role can INSERT only a pristine Candidate. Existing 025/026 identities remain untouched. Adversarial DB tests exercise the real application role under Professional Knowledge admin context.

### Spec / governance ownership

The current spec, plan, tasks, checklist and exactly one change-binding manifest must describe the actual reconciled implementation. Repository implementation ownership remains a separate governance authority and must not be self-authorized in the same product PR.

## Verification Plan

Final verification must cover:

- lint and typecheck;
- unit/integration/contract/full repository tests;
- Professional Knowledge lifecycle/release/approval/reliability/consumption suites;
- adversarial direct-insert DB tests;
- RLS and grant tests;
- concurrency and idempotency tests;
- clean DB migration;
- historical upgrade DB migration;
- migration replay/checksum behavior;
- Spec Governance;
- exact PR head;
- latest main + exact PR head composition;
- Phase 2 regression check;
- final Head Drift read-back.

Any current-main regression, new CRITICAL/HIGH finding, governance ownership failure, CI failure, or head drift keeps the Slice at NOT READY.
