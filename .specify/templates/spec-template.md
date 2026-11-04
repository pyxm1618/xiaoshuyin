# Feature Specification: [FEATURE NAME]

**Feature Directory**: `specs/[###-feature-name]`  
**Created**: [DATE]  
**Status**: Draft  
**V1 Phase**: [Phase 1–6 from Docs/V1技术设计.md]

> This feature spec is a downstream implementation projection. It MUST NOT introduce product semantics absent from the approved Xiaoshuyin documents.

## Upstream Traceability

| Upstream ID / Section | Source | What this slice implements |
|---|---|---|
| [e.g. V1-C01] | `Docs/V1产品需求.md` | [exact behavior] |
| [technical section if needed] | `Docs/V1技术设计.md` | [exact implementation contract] |

**Blocking rule**: If required behavior cannot be traced to an approved source, mark it `NEEDS UPSTREAM DECISION` and do not implement it.

## Scope

### In Scope
- [specific behavior]

### Out of Scope
- [explicit exclusions]
- V2–V5 capabilities not required by this slice.

### Non-Goals
- [things this slice intentionally does not optimize or redesign]

## User Scenarios & Testing

### User Story 1 — [title] (Priority: P1)

[approved user behavior]

**Upstream IDs**: [IDs]

**Independent Test**: [how this behavior is demonstrated independently]

## Acceptance Scenarios

1. **Given** [state], **When** [action], **Then** [expected result]. **Upstream**: [ID]
2. **Given** [failure/edge state], **When** [action], **Then** [truthful non-success result]. **Upstream**: [ID]

## Edge, Failure, and Unknown States

- [UNKNOWN / NOT_COLLECTED / DECLINED / CONFLICT / failure / stale / concurrency case]
- [authorization/safety/compliance boundary if applicable]

## Requirements

- **FR-001** [UPSTREAM: V1-Cxx] System MUST [behavior].
- **FR-002** [UPSTREAM: V1-Dxx/Axxxx] System MUST [behavior].

No requirement may be invented to make implementation easier.

## Key Entities

- [Only entities required by approved design; do not invent architecture here.]

## Success Criteria

- **SC-001**: [measurable user/business outcome or deterministic acceptance]
- **SC-002**: [required error/failure behavior]

## Acceptance Evidence

| Acceptance item | Verification type | Required evidence |
|---|---|---|
| [item] | unit/integration/e2e/eval/real-platform | [command, test, report, or observed evidence] |

## Assumptions and Open Questions

Only list assumptions already permitted by upstream documents.

- [NEEDS UPSTREAM DECISION: ...] — blocking
