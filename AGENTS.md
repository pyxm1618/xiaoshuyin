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

`Docs/**` is enforced, not merely requested. Any change under `Docs/**` fails the `Spec Governance` check by default. An intended document change requires the `approved-docs-change` pull request label, applied by a human after reviewing the document diff. Agents MUST NOT add that label themselves, and the label does not excuse the change from review or from the validator.

Feature work never edits `Docs/**` as a side effect. If a slice appears to need a requirement change, report the conflict and stop.
