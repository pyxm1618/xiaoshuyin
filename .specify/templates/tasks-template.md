---
description: "Xiaoshuyin requirement-traceable implementation tasks"
---

# Tasks: [FEATURE NAME]

**Input**: `spec.md`, `plan.md`, approved upstream documents  
**Gate**: clarify/checklist/analyze blockers MUST be resolved before implementation.

## Required Task Format

Every implementation task MUST use:

`- [ ] T001 [REQ:<upstream-id>] <specific action and path> [VERIFY:<exact command/evidence>]`

Examples:
- `- [ ] T001 [REQ:V1-C02] Add source/provenance domain types in packages/domain/... [VERIFY:pnpm vitest ...]`
- `- [ ] T002 [REQ:V1-D43] Add manifest completeness fixture in tests/scenes/digital-use/... [VERIFY:pnpm vitest ...]`

A task without `REQ` or `VERIFY` is invalid.

## Phase A — Failing Tests / Contract Evidence

- [ ] T001 [REQ:...] Add the smallest failing test/contract/eval that proves the required behavior. [VERIFY:run test and confirm expected failure]

## Phase B — Minimal Implementation

- [ ] T002 [REQ:...] Implement only the code required to satisfy the approved behavior. [VERIFY:run targeted test and confirm pass]

## Phase C — Integration / Boundary Verification

- [ ] T003 [REQ:...] Verify affected authorization, safety, RLS, migration, API, routing, concurrency, or side-effect boundaries as applicable. [VERIFY:exact command/evidence]

## Phase D — Slice Regression

- [ ] T004 [REQ:...] Run the required slice regression and inspect output. [VERIFY:exact command/evidence]
- [ ] T005 [REQ:...] Re-read upstream IDs and verify no required behavior or failure path is missing. [VERIFY:documented converge evidence]

## Dependencies & Execution Order

- Tests/contracts before behavior implementation.
- Foundational prerequisites before dependent tasks.
- Do not parallelize tasks that touch the same contract or migration.
- Stop on an upstream conflict; do not invent a local workaround.

## Completion Contract

A task is complete only when:
1. its required implementation exists;
2. its stated verification was actually run;
3. observed output matches the expected result;
4. no test/fixture/requirement was weakened to achieve green;
5. deviations are recorded and reconciled upstream if they change intent.

The feature is not complete until Spec Kit convergence reports no remaining gap and required CI/acceptance evidence passes.
