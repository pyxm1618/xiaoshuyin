# Phase 5 / C3 — Implementation Plan

## Upstream Traceability

Project V1-C34, V1 Technical Design §28.10 D8 and P2-AUTH-010 through C3-01 to C3-09 in [spec.md](spec.md). Preserve migration 021 authority graph, exact-case RLS and serialization, and the existing Slice 16 and 17 professional boundaries.

## Constitution Check

The internal application namespace is `apps/server/api/src/staff-authority/`. Keep the commands together in that namespace. Safety, Intervention and Professional Knowledge retain their consumer responsibilities. No separate domain namespace is reserved.

Reserve `db/migrations/029_staff_assignment_control_plane.sql` as the next forward-only migration after 028. Recheck main before implementation. Use narrowly executable grant and revoke primitives and controlled read support as needed. Reuse the existing mutation and account-status triggers, authority checks and Business Audit storage. Extend audit vocabulary or integrity checks only as required. Apply least-privilege execution and retain the runtime's existing restrictions on direct table writes.

Compose bounded Grant, Revoke and Read commands using verified server-owned identity and current SERVICE_CONTROL. Reuse command idempotency with exact-payload checks. Establish mutation, read-back and audit behavior within the existing transaction contract. Keep deployment bootstrap, generic public admin APIs, UI, credential management and D6 outside the implementation.

### Requirements Quality and Artifact Review

The spec identifies the operator, target facts, permitted operations and observable fail-closed outcomes. Each requirement has a verification task. The application namespace and exact migration path are the only paths reserved by this plan. Consumer regression tasks exercise existing entry points and preserve their independent gates.

## Verification Plan

Verify authorization and lifecycle transitions in the internal command and DB suites. Exercise rollback, exact replay, mismatch, audit cardinality and concurrent Safety and professional consumer decisions. Run Staff foundation, Safety resolver, Intervention and Professional Knowledge authority regressions, followed by Contract, Static Checks, DB Migration, Unit Tests, Integration Tests, Verify-All and Spec Governance. Bind results to the implementation candidate head and apply repository provenance rules to task completion.
