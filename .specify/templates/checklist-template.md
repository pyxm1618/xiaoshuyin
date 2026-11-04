# Requirements Quality Checklist: [FEATURE NAME]

**Feature**: [link]  
**Created**: [DATE]

> This is a reviewer-owned requirements-quality gate. Checked does not mean implementation is complete.

## Traceability

- [ ] CHK001 Every requirement maps to an approved upstream ID or technical-design section.
- [ ] CHK002 No requirement creates a second product/architecture source of truth.
- [ ] CHK003 Every acceptance scenario names the relevant upstream requirement.

## Scope

- [ ] CHK004 In Scope, Out of Scope, and Non-Goals are explicit.
- [ ] CHK005 No V2–V5 capability has been pulled into V1 without approval.
- [ ] CHK006 No unrelated refactor or “future-proofing” is required for acceptance.

## Product Fidelity

- [ ] CHK007 Canonical A/010xx semantics are preserved where applicable.
- [ ] CHK008 UNKNOWN, refusal, failure, stale, and conflict states are represented truthfully.
- [ ] CHK009 User-visible success cannot be reached through a shortcut absent from the approved flow.

## Architecture and Boundaries

- [ ] CHK010 Frozen V1 technology choices and explicit exclusions are respected.
- [ ] CHK011 Deterministic business gates are not delegated to free-form AI.
- [ ] CHK012 Authorization, Consent, RLS, Safety, Compliance, privacy, and provenance impacts are explicit.

## Verification

- [ ] CHK013 Every acceptance item has a concrete verification path.
- [ ] CHK014 Tasks can be completed without weakening tests, fixtures, snapshots, or eval expectations.
- [ ] CHK015 Required real-platform / staging / migration / eval evidence is identified where unit tests are insufficient.

## Review Decision

- [ ] CHK016 No unresolved `NEEDS UPSTREAM DECISION` blocker remains.
- [ ] CHK017 The slice is small enough to implement and review independently.
