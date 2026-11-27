# Xiaoshuyin AI Development Rules

This repository is governed by the approved Xiaoshuyin product and technical documents. AI agents, coding assistants, and human implementers MUST follow these rules before changing implementation code.

## 1. Authoritative sources

Read these files before planning or implementing any V1 change:

1. `Docs/总产品需求.md` — long-term product direction and version boundaries.
2. `Docs/总体技术架构.md` — long-term technical architecture and V1/V2–V5 boundaries.
3. `Docs/V1产品需求.md` — **V1 product semantics source of truth**.
4. `Docs/V1技术设计.md` — **V1 implementation design source of truth**.

Authority is domain-specific:
- Product behavior, canonical flow, scope, user states, and V1 acceptance semantics come from `V1产品需求.md`.
- Implementation architecture, stack, data contracts, gates, test strategy, and Phase 1–6 sequence come from `V1技术设计.md`.
- The two long-term documents constrain direction but MUST NOT be used to silently pull V2–V5 work into V1.

Spec Kit artifacts under `specs/` are downstream implementation projections. They are NEVER a second product or architecture source of truth.

## 2. Non-negotiable boundaries

Agents and developers MUST NOT:

- silently rewrite or reinterpret approved product requirements;
- change the frozen V1 stack or architecture without an explicit approved upstream document change;
- reorder, merge, delete, renumber, or simplify A/010xx canonical-flow semantics;
- implement V2–V5 capabilities because they appear useful for future architecture;
- replace deterministic business rules with autonomous-agent behavior;
- bypass Authorization, Consent, Safety, Compliance, RLS, or version gates;
- change tests, snapshots, fixtures, or expected outputs merely to make incorrect implementation pass;
- treat UNKNOWN / DECLINED / CONFLICT / failure states as success;
- claim PASS, complete, fixed, safe, or ready without fresh verification evidence;
- merge a PR merely because an agent says it is ready.

## 3. Required delivery workflow

For each implementation slice:

1. Identify the existing `V1技术设计.md` Phase (1–6). Do not invent a parallel roadmap.
2. Create one feature directory under `specs/`.
3. Produce `spec.md` as a traceable projection of approved requirements.
4. Resolve ambiguity. Any unresolved product or architecture ambiguity is a BLOCKER, not permission for the agent to guess.
5. Produce `plan.md` using the frozen technical design.
6. Complete requirements-quality checklist review.
7. Produce `tasks.md` with requirement IDs and explicit verification evidence for every implementation task.
8. Run cross-artifact analysis before coding.
9. Implement in dependency order with tests.
10. Re-read the upstream requirements and converge implementation against spec/plan/tasks.
11. Run CI and inspect actual outputs before claiming completion.
12. Open/review a PR. Merge is a separate decision.

For large slices, implement one task group at a time. Do not ask an agent to “build all V1” in one execution.

## 4. Traceability contract

Every feature spec and meaningful implementation task MUST reference one or more approved upstream identifiers where applicable:

- `U01`–`U20`
- `V1-Cxx`
- `V1-Dxx`
- `V1-Xxx`
- Digital Use `Axxxx` / `010xx` nodes
- a specific technical-design section when the requirement is implementation-only

No orphan feature is allowed.

## 5. Verification contract

Implementation work is not complete until evidence exists.

At minimum:
- deterministic domain/routing/authorization/safety behavior: automated tests;
- schema/RLS/migration behavior: migration + database verification;
- API contracts: generated/validated contract checks;
- AI/RAG behavior: the approved eval path and required Gold Dataset coverage;
- user journeys: required integration/E2E or real-platform validation;
- production claims: only after the relevant staging/readiness/release evidence exists.

If a verification command or environment cannot run, report BLOCKED or NOT VERIFIED. Never substitute confidence for evidence.

## 6. Coding discipline

Use test-first development for deterministic behavior. For defects, establish root cause before fixing symptoms. Before any completion claim, run the full command that proves the claim and inspect its output.

Superpowers may be used for TDD, systematic debugging, plan execution, code review, and verification-before-completion. Superpowers is an execution discipline, not a product or architecture authority.

## 7. Change control

If implementation reveals that an approved requirement or architecture decision must change:
- stop implementation at the smallest safe point;
- record the conflict;
- change the authoritative document explicitly first;
- update affected spec/plan/tasks/tests afterward;
- never back-propagate an implementation convenience into the requirements silently.

`Docs/**` is enforced, not merely requested. The historical `approved-docs-change` label has **zero governance authority**: agents, connectors, or humans adding that label cannot authorize an Authority change or satisfy any required convergence evidence.

Any intended change to one of the four Authority Docs MUST:
- refresh `.specify/authority-inputs.json`;
- add exactly one machine-readable `.specify/authority-impacts/*.json` contract for the same change;
- declare the old/new Authority blob identities, impact classification, affected authoritative specs, required downstream artifacts, and `CONVERGED` completion state;
- change every declared downstream spec/artifact in the same reviewed change when downstream impact exists;
- use only the validator's finite exemption classes for a genuine metadata-only/no-downstream-impact correction;
- `FUTURE_UNIMPLEMENTED` and empty registered bindings are not evidence that a rule is actually unimplemented. For a normative future unit in either technical Authority Doc only, `REVISES_UNIMPLEMENTED_AUTHORITY` permits a document-only revision if a separately reviewed and Owner-merged governance change has already recorded `approvedUnimplementedRevision: { previousBlobSha, newBlobSha, reason }` for that unit in the base Authority Unit registry. The grant binds the exact old/new document Git blob identities, not arbitrary future edits; every changed normative unit using this classification must have a matching grant. Before granting it, independently establish that the precise revision affects only unimplemented technical detail, including checks for unregistered dependencies; do not grant changes to implemented technical requirements or existing business, safety, compliance or shared API contracts. If a real downstream dependency exists, stop and use separately registered real topology and normal convergence. The consuming PR must still declare explicitly empty registered and declared downstream, provide its own per-unit `impactAssessment`, and include only technical Authority Docs, the refreshed snapshot and one impact manifest; no file deletion or rename-away is allowed. The consuming PR must independently verify the assessment, exact scope and protected requirements again. Neither a grant nor an assessment substitutes for substantive review or Owner merge authority; do not create speculative grants or grant them in the consuming PR.
- complete exact-head automated CI / governance verification and an independent AI read-only/adversarial audit as development-process verification evidence. The independent AI audit is not a GitHub `APPROVED` review and MUST NOT be translated into `required_approving_review_count` or `require_last_push_approval`.

Repository governance additionally enforces three machine-verifiable provenance boundaries:

- production paths are owned only by the finite repository-controlled
  `.specify/implementation-ownership.json`; a change manifest cannot invent path ownership,
  shared ownership is explicit, and unknown production paths fail closed;
- Authority changes are evaluated through repository-controlled Authority Units in
  `.specify/authority-unit-registry.json`; a changed substantive unit must converge through
  a pre-registered feature/spec/downstream-requirement/artifact binding when real downstream dependencies exist; the document-only unimplemented technical revision path above requires a separately merged, exact-transition grant and does not change lifecycle or bindings.
  `NO_DOWNSTREAM_IMPACT` is restricted to mechanically bounded non-normative units;
- completed task evidence must bind the feature/task to the real merged implementation PR,
  exact implementation head, files actually changed by that PR, concrete verification
  artifacts, and the task's current `[VERIFY:...]` contracts.

These registries are governance authority, not per-PR self-declarations. Do not modify a
registry in the same change to authorize the product/Authority change that needs it. Changed-path checks include deletions and both endpoints of a rename; a caller-supplied path list must exactly match Git's actual diff.

Repository merge governance follows the **Single Owner + AI Development + Independent AI Audit + Automated CI / Governance Gates** model. GitHub human approval, a second human reviewer/account, and latest-push human approval are not merge gates. The protected automated controls remain required: exact required CI checks, default-branch Ruleset protection, review-thread resolution, no unauthorized bypass, implementation ownership, Authority impact convergence, task evidence/provenance, and adversarial governance tests. Independent AI audit remains mandatory process evidence and must be performed against the exact candidate Head by an AI independent from the development execution.

Feature work never edits `Docs/**` as a side effect. If a slice appears to need a requirement change, report the conflict and stop.
