# Feature Specification: Phase 2 Authority Contract Foundation

## Upstream Traceability

This feature is a **downstream contract slot only** for the already-approved remediation program. It does not create product, technical, professional, legal, or runtime authority.

Relevant existing upstream identifiers include V1-X09 and U04/U07/U09/U19. Concrete D3/D4/D5/D7/D8 semantics remain pending until the four formal Authority Docs change through the repository Authority Impact process.

Status: **PENDING_AUTHORITY_RECONCILIATION**

## Scope

In scope only:

- provide one repository-controlled downstream specification identity that future Phase 2 Authority convergence can bind to where no existing feature/spec owner exists;
- provide a non-runtime verification artifact for that contract slot;
- remain intentionally free of concrete D3/D4/D5/D7/D8 answers until the Authority Docs are changed;
- allow later Authority convergence to update this specification and its verification artifact in the same PR.

Out of scope:

- changing any of the four Authority Docs;
- changing `.specify/authority-unit-registry.json`;
- changing production runtime, database schema/migrations, APIs, authorization, Safety, Consent, Case lifecycle, Goal/Plan/Review behavior, Staff behavior, frontend behavior, or Slice 17;
- claiming that any Phase 2 remediation item is implemented or complete.

## Requirements

- **P2-SLOT-001** — This specification MUST remain a downstream projection, never an Authority source.
- **P2-SLOT-002** — Until an Authority convergence PR changes this section, the implementation status MUST remain `PENDING_AUTHORITY_RECONCILIATION`.
- **P2-SLOT-003** — No production code, database object, public API, UI behavior, or business-state transition may be derived from this placeholder alone.
- **P2-SLOT-004** — A later Authority convergence PR MUST replace/extend these placeholder requirements with exact downstream contracts and update the registered verification artifact in the same change.

## Acceptance Scenarios

1. Given the current main branch, adding this feature does not change any Authority Doc or production/runtime file.
2. The architecture verification proves the slot is explicitly pending and cannot be mistaken for completed D3/D4/D5/D7/D8 implementation.
3. A future Authority convergence can mechanically demonstrate a real downstream delta because the registered `## Requirements` section and verification artifact both have a known pre-change baseline.

## Acceptance Evidence

- `tests/architecture/phase2-authority-contract-foundation.test.ts` verifies the slot identity, pending status, and no-runtime-authority marker.
- Repository Spec Governance and normal CI must pass on the exact PR head.
