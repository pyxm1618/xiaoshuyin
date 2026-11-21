# Phase 5 / D6 — Implementation Plan

## Upstream Traceability

Project V1-C24, V1-C25, V1-C34, V1-C35, V1-C37, V1-X01, V1-X14, V1-C40, Digital Use A4003/A5001/A5002/01000, and V1 Technical Design §6.6, §27, §27B.1, §28.10, §32.9A, and §40 through requirements D6-01 to D6-08 in [spec.md](spec.md). Preserve the existing C2 Safety production entry, C3 Staff Assignment authority graph, Slice 16 intervention contract reconciliation, and Slice 17 professional knowledge lifecycle.

## Constitution Check

### Architectural Seams and Application Namespace

D6 integrates real external authority and content into frozen production seams without introducing parallel architectures, second approval ledgers, or a second Staff authority system:
1. **Safety Production Seam**: Preserve `createSafetyProductionService` and `SafetyProductionAuthorityProvider` defined in `apps/server/api/src/app.ts`. The implementation resolves the external authoritative source first; if present, it wires deterministic, version-verified evaluation into the seam, and if absent, it preserves `UNAVAILABLE` fail-closed.
2. **Professional Knowledge Seam**: Preserve `ProfessionalApprovalProvider` and `ProfessionalQualificationProvider` in `packages/domain/src/professional-knowledge.ts` and their consumers in `apps/server/api/src/services/professional-knowledge.ts` and `apps/server/api/src/services/professional-knowledge-consumption.ts`. Authoritative sources are resolved first; if absent, providers remain fail-closed without inventing fake reviewer identities, manufactured qualifications, or forged approval ledgers.
3. **Narrow Scene Package Binding Seam**: D6 ownership is restricted strictly to the exact path `packages/scenes/digital-use/professional-knowledge-binding.ts` (shared with `017-professional-knowledge-foundation`), with zero ownership over the broader `packages/scenes/digital-use/` prefix. Real approved knowledge references may enter the registry only when fully verified; otherwise, the empty baseline remains frozen.
4. **Preserved A4003 Roleplay Seam**: Existing runtime ownership of `apps/server/api/src/services/digital-use-roleplay.ts` is fully preserved under historical feature `012-digital-use-assessment-runtime`. D6 receives only narrow shared integration authority on `apps/server/api/src/services/digital-use-roleplay-adapter.ts` (`RoleplayAdapter`, `RoleplayProfessionalContentAuthority`, `RoleplayModelPromptAuthorityProvider`). Implementation is bounded strictly to the narrow A4003 provider adapter, excluding generic AI platforms, multi-agent frameworks, TaskModelRegistry, or RAG platforms.

### Explicit Boundary on Real-World Authority

The implementation plan recognizes the boundary between code readiness and real-world human authority:
- Code integration provides the verified reading path, cryptographic hash checks, time window validation, and fail-closed behaviors.
- Real-world professional reviewers, qualifications, clinical approvals, and deterministic safety rules must be supplied by qualified external humans. If real-world assets are missing, the production code must remain safely fail-closed, reporting `REAL EXTERNAL AUTHORITY: MISSING` and `D6 NOT CLOSED` rather than synthesizing fake data or artificial bypasses. This is an authoritative, expected outcome rather than an implementation defect.

### Requirements Quality and Artifact Review

The specification identifies authoritative inputs, error modes, exact version identities, and fail-closed outcomes. Each requirement has traceable implementation and verification tasks in `tasks.md`. Scope expansion is explicitly blocked by contract.

## Verification Plan

Implementation must be verified via:
1. Targeted unit and integration tests for `SafetyProductionAuthorityProvider`, `ProfessionalQualificationProvider`, `ProfessionalApprovalProvider`, and `RoleplayAdapter`;
2. Fail-closed verification covering missing assets, expired credentials, hash mismatch, identity drift during evaluation, and unassigned reviewers;
3. C2 Safety, C3 Staff authority, Slice 16, Slice 17, and Digital Use regressions;
4. Full validation suite execution: Contract, Static Checks, DB Migration, Unit Tests, Integration Tests, Verify-All, and Spec Governance on exact candidate HEAD.
