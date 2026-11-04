# Implementation Plan: [FEATURE]

**Feature**: `specs/[###-feature-name]/spec.md`  
**Date**: [DATE]  
**V1 Phase**: [Phase 1–6]

## Upstream Traceability

List the exact approved product requirement IDs and technical-design sections this plan implements. The plan MUST NOT change their meaning.

## Summary

[Smallest technical approach that satisfies the approved feature spec and frozen V1 design.]

## Technical Baseline

Use `Docs/V1技术设计.md` as the authority. Copy only the subset relevant to this slice.

**Runtime / Language**: [approved baseline]  
**Dependencies**: [approved baseline]  
**Storage / Migration**: [approved baseline]  
**Testing / Eval**: [approved baseline]  
**Deployment target**: [approved baseline]

Any proposed dependency, framework, service, or architecture not already approved is a BLOCKER requiring upstream review.

## Constitution Check

*GATE: MUST PASS before implementation planning proceeds.*

- [ ] No new product semantics.
- [ ] No V2–V5 scope pulled into V1.
- [ ] No canonical A/010xx behavior reordered, merged, deleted, or renumbered.
- [ ] Frozen technical stack and exclusions are respected.
- [ ] Deterministic rules remain deterministic.
- [ ] Authorization / Consent / RLS / Safety / Compliance implications are addressed.
- [ ] Data provenance/version/history requirements are preserved.
- [ ] Failure/UNKNOWN/concurrency/idempotency behavior is designed where applicable.
- [ ] Verification path exists for every acceptance item.

Any unchecked item blocks implementation.

## Design

### Existing Contracts Reused
- [domain/API/schema/manifest/routing contract]

### Data and Migration Impact
- [tables, constraints, migrations, RLS; or N/A]

### Authorization / Safety / Compliance Impact
- [explicit impact; or N/A with reason]

### API / Contract Impact
- [Zod/OpenAPI/client impact; or N/A]

### AI / RAG / Eval Impact
- [model/prompt/RAG/eval impact; or N/A]

### Async / Notification / Side-Effect Impact
- [idempotency/UNKNOWN/retry impact; or N/A]

## Project Structure

List only real paths from `Docs/V1技术设计.md` that this slice will touch.

## Verification Plan

| Requirement / Acceptance | Test or evidence | Command / environment | Expected result |
|---|---|---|---|
| [ID] | [test/eval/e2e] | [exact command or environment] | [observable result] |

## Rollback / Recovery

[Only if this slice changes schema, policy, package versions, external side effects, or release state.]

## Complexity Exceptions

Leave empty unless an approved design constraint cannot be satisfied. Every exception requires explicit upstream approval.
