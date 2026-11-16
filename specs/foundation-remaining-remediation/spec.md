# Feature Specification: Foundation Remaining Remediation

## Upstream Traceability

This remediation is a downstream implementation projection of the current four authoritative Docs. It does not create product, professional, or legal authority.

- V1-C39 — minor / guardian consent is server-enforced and fail-closed.
- V1-C44 — identity binding and ordinary-login identity semantics remain deterministic and non-duplicating.
- V1-D02 — Integrated Triage is mutually exclusive, priority-ordered, and has no default fallthrough.
- V1-X05 — conflicting evidence remains conflict.
- V1-X06 — concurrency / retry must not overwrite or duplicate authoritative truth.
- V1-X09 — Common Core and Digital Use Scene must pass together.

## Scope

In scope only:

- Consent current-head integrity and transactional audit evidence.
- Race-safe first-login identity creation.
- Fail-closed routing for missing/conflicting priority truth.
- NOT_APPLICABLE unknown-like Evidence convergence.
- Common Core WAITING ordinary-progression denial.
- Evidence invalidation / review / reassessment foundation lifecycle verification.
- Machine-verifiable binding of governance to the four authoritative Docs.
- Bun reproducibility and evidence-based low-risk HTTP hardening assessment.

Out of scope: Digital Use Vertical Convergence, A3000/A4001 stream redesign, Family Alliance/Phone Contract downstream rewind, A4003/A4004/A5001/A5002, Slice 15–19, Mini Program, Goal/Plan/Task loop, and any new professional/legal authority.

## Acceptance Scenarios

1. A stale or superseded guardian Consent cannot be revoked as current; concurrent successor/revoke races converge to one chain head.
2. Every authoritative Consent mutation that requires audit commits its audit evidence atomically with the mutation.
3. Two concurrent first logins for one external identity converge to one Account and one Person without expected uniqueness becoming HTTP 500.
4. Missing priority truth is INSUFFICIENT/UNKNOWN; conflict is BLOCKED; explicit false remains false.
5. NOT_APPLICABLE has the same non-determinate semantics through Evidence, Problem Formulation, routing, and snapshots.
6. WAITING cannot perform ordinary progression, while authorized review/correction/resolver paths remain legal.
7. Superseded Evidence marks dependent formulation NEEDS_REVIEW; stale Evidence cannot clear it; current Evidence can be re-read and reviewed through the existing owner.
8. Relevant change to any of the four authoritative Docs causes governance drift failure until the machine-derived authority fingerprint is deliberately refreshed.
9. Bun is exact-pinned from a previously successful exact-base CI environment. PostgreSQL remains major-pinned unless an exact patch authority exists.
10. No permissive Compliance policy, fake professional/legal approval, duplicate truth source, or production bypass is introduced.

## Acceptance Evidence

- Real PostgreSQL integration tests for Consent chain, audit atomicity, concurrent first login, and Evidence review lifecycle.
- Pure domain / routing truth-table tests for priority truth, NOT_APPLICABLE, and WAITING.
- Governance self-tests that mutate an Authority Doc and prove drift detection fails.
- Canonical repository static, type, unit, integration, migration, contract, and Spec Governance gates on the exact PR head.
