# Xiaoshuyin Development Constitution

## Core Principles

### I. Approved Documents Are the Authority
`Docs/V1产品需求.md` has final authority over V1 product semantics. `Docs/V1技术设计.md` has final authority over V1 implementation design. `Docs/总产品需求.md` and `Docs/总体技术架构.md` constrain long-term direction and version boundaries. Generated specifications, plans, tasks, code, tests, prompts, and agent output MUST conform to these sources and MUST NOT silently supersede them.

### II. One Source of Truth, Downstream Projections Only
A feature `spec.md` is an implementation-scoped projection of approved requirements, not a new product specification. A `plan.md` is a projection of the approved technical design, not permission to redesign the system. A `tasks.md` is an execution breakdown, not permission to add scope. Any conflict MUST be resolved at the authoritative source before implementation continues.

### III. Phase-Bounded, Slice-Bounded Delivery
The V1 implementation sequence is the Phase 1–6 roadmap already defined in `Docs/V1技术设计.md`. Work MUST be delivered as small, reviewable slices inside those phases. No agent may implement “all V1” in one undifferentiated run. A slice MUST have explicit in-scope, out-of-scope, upstream requirement IDs, acceptance criteria, and verification evidence.

### IV. Deterministic Business System Before AI Autonomy
Xiaoshuyin is not an autonomous-agent runtime. Case state, routing, consent, authorization, safety, compliance, professional gates, plan activation, persistence, and business side effects remain deterministic and testable as defined by the technical design. AI may operate only inside the approved bounded capability layer.

### V. Traceability Is Mandatory
Every feature MUST trace to approved upstream identifiers such as U01–U20, V1-Cxx, V1-Dxx, V1-Xxx, A/010xx nodes, or an explicit technical-design section. Every implementation task MUST identify what requirement it satisfies and how completion will be verified. Orphan features and unverifiable tasks are prohibited.

### VI. Tests and Evidence Before Completion
Deterministic behavior is developed test-first where practical. Tests, snapshots, fixtures, Gold Dataset expectations, and acceptance criteria MUST NOT be weakened to accommodate incorrect code. No work may be called complete, passing, fixed, safe, or ready without fresh evidence from the appropriate verification path.

### VII. Safety, Authorization, Compliance, and Data Boundaries Cannot Be Bypassed
Authorization, Consent, RLS, Safety, Compliance, privacy, provenance, versioning, and regulatory release gates are independent constraints. A feature that bypasses any required gate fails regardless of functional success. UNKNOWN and failure states remain explicit.

### VIII. Explicit Change Control
Agents and developers MUST NOT silently change approved requirements, the frozen V1 stack, canonical A/010xx semantics, or V1/V2–V5 boundaries. A necessary change starts with an explicit upstream document revision and impact review, then updates downstream artifacts and tests.

## Development Workflow and Quality Gates

For production V1 work, use the full Spec Kit quality path:

`specify → clarify → plan → checklist → tasks → analyze → implement → converge`

Before implementation:
- upstream requirements are identified;
- scope and non-goals are explicit;
- unresolved ambiguity is zero or explicitly blocked;
- Constitution Check passes;
- checklist review has no blocking unchecked item;
- tasks are dependency ordered and independently verifiable;
- analyze reports no unresolved blocker.

After implementation:
- required tests/evals/real-platform checks run;
- upstream requirements are re-read;
- converge finds no remaining implementation gap;
- CI evidence is inspected;
- PR review remains separate from merge.

## Repository-Specific Constraints

- Do not rewrite the Digital Use canonical flow for elegance.
- Do not add a second Scene in V1.
- Do not introduce frameworks or infrastructure explicitly excluded by `V1技术设计.md`.
- Do not create duplicate runtime sources for Node Manifest/routing/contracts.
- Do not use a model, prompt, RAG result, or agent output as a substitute for a formal business fact or gate.
- Do not claim a platform, notification, migration, RLS, model, compliance, or production capability without the real verification required by the technical design.

## Governance

This constitution governs implementation process only. It does not replace the four formal product/technical documents.

Amendments require:
1. an explicit reason;
2. confirmation that no authoritative product/technical semantics are being changed accidentally;
3. version increment;
4. review of affected templates, feature artifacts, CI checks, and AGENTS.md.

**Version**: 1.0.0 | **Ratified**: 2026-11-04 | **Last Amended**: 2026-11-04
