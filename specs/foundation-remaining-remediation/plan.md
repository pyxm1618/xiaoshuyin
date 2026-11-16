# Implementation Plan: Foundation Remaining Remediation

## Upstream Traceability

- V1-C39
- V1-C44
- V1-D02
- V1-X05
- V1-X06
- V1-X09

## Constitution Check

PASS. Work modifies existing authoritative owners only, keeps Docs unchanged, preserves fail-closed Professional/Legal authority, and does not enter Digital Use Vertical Convergence.

## Verification Plan

- Consent: PostgreSQL integration tests for current-head revoke, stale/superseded rejection, concurrency, rollback, and audit atomicity.
- Identity: concurrent HTTP first-login integration test proving one Account/Person and no uniqueness 500.
- Routing/Evidence: deterministic truth-table tests including missing, conflict, explicit false, and NOT_APPLICABLE.
- Progression: Common Core guard plus Problem Formulation consumer regression for WAITING.
- Review lifecycle: Evidence supersession -> NEEDS_REVIEW -> stale review evidence rejected -> current evidence re-read -> authorized resolution.
- Governance: machine-derived Git blob fingerprints for exactly four Authority Docs plus self-test for drift/refesh.
- Hardening: pin Bun to the exact version observed in successful base CI; retain PostgreSQL major 18 absent exact patch authority; only add HTTP protections when deployment/client-IP semantics are authoritative.
- Final gate: PR CI + Spec Governance at exact final head; no merge.
