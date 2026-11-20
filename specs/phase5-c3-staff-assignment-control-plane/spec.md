# Phase 5 / C3 — Staff Assignment Control Plane

## Upstream Traceability

- [V1 Product Requirements §22.2 and V1-C34](../../Docs/V1产品需求.md) define explicit, scoped, revocable and auditable Staff authority.
- [V1 Technical Design §28.10, D8 Staff contract and Phase 5](../../Docs/V1技术设计.md) define authentication, authorization, operational bootstrap and the Phase 5 boundary.
- [P2-AUTH-010](../phase2-authority-contract-foundation/spec.md) freezes the StaffPrincipal and SERVICE_CONTROL contract.
- [Slice 16](../016-psychological-behavioral-intervention-contract-authority-reconciliation/spec.md) and [Slice 17](../017-professional-knowledge-foundation/spec.md) establish the existing professional consumers and independent qualification and approval gates.

## Scope

C3 covers controlled Staff Authority Grant, Revoke, Read and durable mutation audit. The prerequisite registers implementation ownership. Delivery of the commands and their evidence belongs to the subsequent implementation.

| Requirement | Contract |
| --- | --- |
| C3-01 | Authenticate through the existing Account/session boundary and resolve a server-owned StaffPrincipal. Require current valid SERVICE_CONTROL for grant, revoke and internal inventory read. Enforce no self-grant, self-expansion or acquisition of business capability through a management action. SERVICE_CONTROL does not confer SAFETY_RESOLVE, PROFESSIONAL_REVIEW or other Staff business capabilities. Initial SERVICE_CONTROL bootstrap belongs to the auditable deployment operations boundary. Bootstrap execution is outside this slice. |
| C3-02 | Use staff_assignments as the single authority truth. Preserve the existing seven capabilities (PROFESSIONAL_REVIEW, SAFETY_REVIEW, SAFETY_RESOLVE, DATA_RIGHTS, QUALITY_REVIEW, EXCEPTION_SUPPORT and SERVICE_CONTROL). |
| C3-03 | Grant validates exact account/person binding, capability, validity window and scope. A CASE assignment must reference the exact GLOBAL grant for the same identity and capability, and the family must match the Case. |
| C3-04 | Revoke uses the existing revocation fields and preserves history. A revoked GLOBAL grant invalidates dependent CASE authority through existing parent validation. |
| C3-05 | Read answers Account/Person capabilities, Case assignments, parent links and effective status from current identity, Account status, wall-clock validity and the authority graph. Revoked, expired, future, disabled and invalid-parent authority fail closed. |
| C3-06 | Each grant or revoke mutation atomically records a durable Business Audit event with operator, time, target identity, capability, scope and applicable Case and parent references. Audit excludes credentials, secrets and unrelated personal or professional content. |
| C3-07 | Safety continues to require GLOBAL SAFETY_RESOLVE and an exact CASE SAFETY_RESOLVE assignment. Intervention and Professional Knowledge continue to validate their exact current GLOBAL PROFESSIONAL_REVIEW authority. Independent professional qualification and approval checks remain required where applicable. |
| C3-08 | Reuse existing command idempotency. Exact replay is stable and changed payloads fail closed. Mutation and audit roll back together. Preserve AUTH_ACCOUNT and AUTH_ROW serialization with downstream consumers. |
| C3-09 | Use bounded internal commands. Generic public admin APIs, arbitrary runtime table mutation, a second authority model, Admin UI, HR, credential management and D6 are outside C3 scope. |

## Acceptance Scenarios

- A current SERVICE_CONTROL operator can administer authority within the frozen contract. Ordinary Staff, Family users and inactive operators are denied. Self-grants and self-expansion fail closed.
- A valid GLOBAL grant and a correctly linked CASE assignment are visible as active. Incorrect identity, scope, capability, Case or parent is rejected. Read distinguishes revoked, expired and future rows from active authority and excludes disabled or invalid-parent authority from active results.
- Revocation preserves historical rows, is stable on repeat, and immediately affects subsequent consumer checks. Safety observes both grant and revoke. Intervention and Professional Knowledge observe exact current Staff authority and retain independent qualification and approval gates.
- Grant and revoke replay never duplicate audit. A reused key with a different payload fails closed. Failure between mutation and audit rolls back the operation. Competing authority mutations and consumer decisions serialize via existing keys.

## Acceptance Evidence

The implementation PR must provide exact-head evidence for the task verification contracts, scope and ownership validation, and consumer regressions. All implementation acceptance remains pending.
