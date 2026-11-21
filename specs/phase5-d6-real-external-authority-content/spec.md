# Phase 5 / D6 — Real External Authority / Content

## Upstream Traceability

- [V1 Product Requirements V1-C24 and V1-C25](../../Docs/V1产品需求.md) define the strict boundary that AI only provides candidate suggestions and cannot confirm facts or become a final high-risk Safety authority; high-risk Safety decisions must come from approved, versioned, deterministic, professionally governed Safety Policy / Rule Assets, with EnterSafetyHold and ResolveRisk authority separated.
- [V1 Product Requirements V1-C34 and V1-C35](../../Docs/V1产品需求.md) mandate explicit, revocable, scoped, and auditable Staff authority, forbid fabricated expert reviews or fake queues, and separate professional qualification from general Staff identity.
- [V1 Product Requirements V1-C37 and V1-X01](../../Docs/V1产品需求.md) establish that psychological/behavioral intervention contracts and Digital Use Scene professional rules/content must bind exact approved, published versions, forbidding draft or superseded versions from overriding the current baseline.
- [V1 Product Requirements V1-X14 and V1-C40](../../Docs/V1产品需求.md) require internal and professional review workflows to verify only real capabilities, mandate adult/guardian-only eligibility for A4003 roleplay with strict simulation boundaries, and forbid contaminating real child facts or agreements.
- [V1 Product Requirements Digital Use A4003, A5001, A5002, and 01000](../../Docs/V1产品需求.md) specify that when downstream AI capability or approved professional content is unavailable, progression must HOLD without fake roleplay, canned output, or artificial progress to A4004; professional content boundaries for A5001/A5002/01000 require independent approved packages and fail closed when missing.
- [V1 Technical Design §6.6, §27, §27B.1, §28.10, §32.9A, §40](../../Docs/V1技术设计.md) define the frozen production seams:
  - Safety production precheck and trusted policy identity (`SafetyProductionAuthorityProvider`);
  - Professional qualification and approval providers (`ProfessionalQualificationProvider`, `ProfessionalApprovalProvider`);
  - Scene package professional knowledge binding (`packages/scenes/digital-use/professional-knowledge-binding.ts`);
  - A4003 roleplay adapter, professional content authority, and model/prompt authority (`RoleplayAdapter`, `RoleplayProfessionalContentAuthority`, `RoleplayModelPromptAuthorityProvider` in `apps/server/api/src/services/digital-use-roleplay-adapter.ts`).
- [Slice 16](../016-psychological-behavioral-intervention-contract-authority-reconciliation/spec.md) and [Slice 17](../017-professional-knowledge-foundation/spec.md) establish the psychological/behavioral intervention contract foundation and professional knowledge lifecycle (draft -> review -> approval -> release -> consumption), which D6 consumes rather than redesigns.
- [Phase 5 C3](../phase5-c3-staff-assignment-control-plane/spec.md) freezes the Staff Assignment Control Plane and confirms that Staff authority is the single internal truth without secondary RBAC or admin bypass.

## Scope

D6 enables existing production seams—which currently fail closed due to missing real external professional authority and content—to safely consume real, approved, versioned external professional authority and content. D6 is bounded strictly to external authority integration, identity/provenance binding, and fail-closed enforcement. D6 does not expand into a generic CMS, expert marketplace, AI orchestration engine, TaskModelRegistry, or RAG platform. D6 does not take over the existing roleplay runtime or the broad Scene package prefix.

### Boundary Between Code Seams and Real-World Authority

D6 formalization explicitly distinguishes between code integration seams and real-world external authority:

| Authority Dimension | Code / Integration Seam | Real-World Authority Status | Production Behavior |
| :--- | :--- | :--- | :--- |
| **Safety Production Authority** | `SafetyProductionAuthorityProvider` | MISSING (No reviewed deterministic rule asset yet provided by human authority) | `unavailableProductionSafetyAuthorityProvider` -> FAIL-CLOSED (`SAFETY_PRECHECK_INVALID`) |
| **Professional Qualification** | `ProfessionalQualificationProvider` | UNASSIGNED (No verified professional reviewer credential yet assigned in the real world) | `unavailableProductionProfessionalQualificationProvider` -> FAIL-CLOSED (`APPROVED PROFESSIONAL REVIEWER — UNASSIGNED`) |
| **Professional Approval** | `ProfessionalApprovalProvider` | MISSING (No immutable professional review/approval evidence ledger entry yet executed) | `unavailableProductionProfessionalApprovalProvider` -> FAIL-CLOSED (`PROVIDER_UNAVAILABLE`) |
| **Professional Knowledge Corpus** | `professional_knowledge_*` storage and publication seam | EMPTY (No published, current, professionally approved knowledge version in production) | Production Scene binding remains empty -> FAIL-CLOSED on consumption |
| **Scene Knowledge Binding** | Exact seam: `packages/scenes/digital-use/professional-knowledge-binding.ts` | EMPTY (`professionalKnowledgeRefs: []`) | Production binding resolves empty list; no unapproved content enters runtime |
| **A4003 Professional Content** | `RoleplayProfessionalContentAuthority` | MISSING (No approved roleplay professional content package yet released) | Omitted in production -> A4003 progression HOLD |
| **A4003 Model / Prompt Authority** | `RoleplayModelPromptAuthorityProvider` | MISSING (No CURRENT_APPROVED model or prompt authority reference yet sanctioned) | Omitted in production -> A4003 progression HOLD |
| **A4003 Production Adapter** | Exact seam: `apps/server/api/src/services/digital-use-roleplay-adapter.ts` | UNAVAILABLE (Downstream AI integration cannot activate without real approved content and authorities) | `unavailableProductionRoleplayAdapter` -> `isAvailable() = false`, progression HOLD |

AI developers cannot create, invent, self-approve, or simulate professional rules, cutoffs, qualifications, or clinical interpretations. When real-world authority is missing, the system must remain fail-closed.

### Requirements

| Requirement | Contract |
| :--- | :--- |
| D6-01 | **Safety Production Authority Seam & Exact Version Binding**: Production Safety precheck must consume only current, approved, published deterministic Safety Policy / Rule Assets via `SafetyProductionAuthorityProvider`. Evaluation input and output must verify exact identity (`policyRef`, `policyVersion`, `ruleRef`, `ruleVersion`). If the asset is missing, unapproved, expired, revoked, or superseded, the provider must return null/unavailable, failing closed into `SAFETY_PRECHECK_INVALID`. |
| D6-02 | **Safety Deterministic Evaluation & Identity Consistency**: Safety evaluation must be strictly deterministic; AI cannot serve as a high-risk Safety authority. If the trusted policy identity drifts between pre-evaluation and post-evaluation checks, the production entry must throw `SAFETY_PRECHECK_STALE` and reject progression. |
| D6-03 | **Professional Qualification External Verification**: `ProfessionalQualificationProvider` must verify real, independent professional qualification evidence (`qualificationRef`, `reviewerIdentity`, `reviewerAccountId`, `reviewerPersonId`, `scope`, `validFrom`, `validTo`). Professional qualification is decoupled from Staff `PROFESSIONAL_REVIEW` capability. Unassigned, invalid, or expired qualifications fail closed. |
| D6-04 | **Professional Approval External Proof Binding**: `ProfessionalApprovalProvider` must validate immutable review evidence bound to exact knowledge ID, semantic version, content hash, source-set hash, and verified reviewer qualification. Content modifications invalidate prior approvals; missing, mismatched, or revoked approvals fail closed. |
| D6-05 | **Scene Package Professional Knowledge Binding & Consumption**: Digital Use Scene Package bindings must include only `PUBLISHED`, `CURRENT`, `VALID`, and professionally approved Knowledge versions matching the exact Scene scope in `packages/scenes/digital-use/professional-knowledge-binding.ts`. Unapproved items cannot enter production bindings. Consumption must strictly reuse the existing `professional-knowledge-consumption` service, enforcing Family authorization, Case context, Consent, Compliance, and Safety. |
| D6-06 | **A4003 Professional Content Authority Binding**: A4003 roleplay communication strategies and scenario instructions must derive exclusively from an approved, published `RoleplayProfessionalContentAuthority`. Product freezing of contract text cannot be construed as professional roleplay content approval. Missing content keeps the capability unavailable. |
| D6-07 | **A4003 Model & Prompt Authority Seam**: A4003 runtime must consume explicit `CURRENT_APPROVED` model references and prompt version references via `RoleplayModelPromptAuthorityProvider`. Defaulting to arbitrary models, environment-variable approvals, or unversioned prompts is prohibited. Missing authority keeps the capability unavailable. |
| D6-08 | **A4003 Production Adapter Availability & Progression Hold**: The production `RoleplayAdapter` in `apps/server/api/src/services/digital-use-roleplay-adapter.ts` may report `isAvailable() = true` only when approved professional content, approved model authority, approved prompt authority, and the real downstream execution provider are simultaneously available and verified. If any dependency is unavailable, `isAvailable()` must return false and A4003 progression must be held (`HOLD`), never fake roleplay, canned output, or synthetic completion into A4004. Minor actor requests must be rejected per Compliance. Existing runtime logic in `apps/server/api/src/services/digital-use-roleplay.ts` is preserved. |

## Acceptance Scenarios

- **Safety Real Authority & Fail-Closed**: When a real, approved deterministic Safety asset is bound, Safety precheck evaluates deterministically and allows or holds per rule outputs. If the policy identity changes during evaluation or the asset is missing, evaluation fails closed without mutating Safety state.
- **Professional Qualification & Approval**: When a verified professional reviewer with a valid qualification approves a knowledge version, the provider resolves a valid proof. When qualification is unassigned or expired, or when content hash drifts from the approved proof, the provider returns `UNAVAILABLE` or `INVALID`, preventing publication and consumption.
- **Scene Binding & Consumption Integrity**: Scene packages binding real approved knowledge allow authorized Family members to consume content through established Consent and Compliance gates. Empty or test-only bindings never expose unapproved professional guidance in production.
- **A4003 Availability & Progression Hold**: When real roleplay professional content and approved model/prompt authorities are present, adult/guardian actors can execute roleplay simulations. When any authority is missing, the adapter reports unavailable, A4003 progression is held without fake progress, and minor actors are blocked.
- **Zero Test Pollution**: Production imports and startup configurations contain zero references to `tests/`, `fixtures/`, or artificial `approved=true` bypasses.

## Acceptance Evidence

Implementation PRs must provide exact-head automated test execution and logs proving:
1. Deterministic Safety precheck evaluation and fail-closed handling on missing, stale, or revoked policy assets;
2. Professional qualification and approval validation against immutable hashes;
3. Scene package knowledge resolution and consumption authorization;
4. A4003 adult-only progression, adapter availability reporting, and recoverable `HOLD` behavior when dependencies are unavailable;
5. Regressions for C2 Safety, C3 Staff authority, Slice 16, and Slice 17 pass without regressions;
6. Clean Spec Governance and full suite verification on exact candidate HEAD.
All implementation acceptance remains pending until implementation PR delivery.
