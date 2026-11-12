---
description: "Slice 11 requirement-traceable implementation tasks — planning artifact only"
---

# Tasks: Digital Use Full Node Manifest / Deterministic Routing Foundation

**Input**: Frozen spec.md + plan.md + checklist.md + four authoritative Docs  
**Planning Branch**: plan/011-digital-use-node-manifest-routing-foundation  
**Status**: TASKS COMPLETE / NOT AUTHORIZED FOR EXECUTION / IMPLEMENT GATE BLOCKED  
**Execution rule**: T1101 is a mandatory future development-start gate. No production/test/CI implementation task may begin unless T1101 passes on then-current main.

## Required Task Format

Every implementation task has:
- a canonical task line with REQ + VERIFY;
- Objective;
- Allowed files / directories;
- Forbidden modifications;
- Implementation actions;
- Verification actions;
- Completion evidence;
- Dependencies;
- Rollback;
- Failure / stop conditions.

No task grants authority to modify the Frozen Spec or authoritative Docs.

---

## Execution Order

```text
T1101  Authority / Implement Gate preflight
  ↓
T1102  Independent canonical snapshot + intentionally failing contract tests
  ↓
T1103  Minimal @xiaoshuyin/scenes workspace shell
  ↓
T1104  Explicit 75-node manifest + structural types
  ↓
T1105  Inventory / source / field validators
  ↓
T1106  Pure deterministic router
  ↓
T1107  Typed non-linear reachability / orphan / dead-end validator
  ↓
T1108  Parallel-fidelity validator/tests
  ↓
T1109  Current Digital Use authority-remediation regression
  ↓
T1110  Sparse/non-linear topology targeted regression
  ↓
T1111  Snapshot semantic-diff gate
  ↓
T1112  Static single-source / architecture / scope guard
  ↓
T1113  Full negative-mutation + 35-scenario acceptance convergence
  ↓
T1114  Minimal CI integration
  ↓
T1115  Full regression + exact scope proof
  ↓
T1116  Exact-head convergence / governance / handoff to independent Audit 2
```

Tasks that touch the same manifest/routing/validator contract are intentionally sequential. Test files may be split internally only if traceability remains exact.

---

- [ ] T1101 [REQ:FR-027,FR-030,V1-C20,V1-C25,§38] Re-run the development-start Authority/Implement Gate against latest main and stop before any edit unless all Phase 1 blockers are truly closed [VERIFY:git fetch; git rev-parse origin/main; compare Frozen Spec blob; inspect four Docs blobs, PR #26 merge/audit state, Slice 9 Safety+Drizzle/Data Access authority, Slice 10 merged Compliance foundation, migrations/shared contracts, and current CI]

### T1101 — Development-start Authority / Implement Gate

**Objective**

Prove that the repository has actually reached the point where Phase 2 implementation is permitted. Planning completion is not sufficient evidence.

**Allowed files / directories**

Read-only inspection only:
- `Docs/**`;
- `specs/008-*/**`, `specs/009-*/**`, `specs/010-*/**`, `specs/011-*/**`;
- current branches/PRs/commits/CI;
- `packages/**`, `apps/**`, `db/**`, `scripts/**`, `.github/**` for reconciliation only.

**Forbidden modifications**

All files. This task is preflight only.

**Implementation actions**

1. Fetch latest remote truth.
2. Verify Frozen Spec blob remains `8d47a2b8ad0431540598ceecef14550bd383fe1f`.
3. Classify input drift as NONE / NON-MATERIAL / MATERIAL.
4. Re-read all four authority Docs after any upstream merges.
5. Verify Slice 8 final independent code audit and merge/reconciliation.
6. Verify Slice 9 authoritative Safety runtime and same-client Drizzle/Data Access foundation are on main, or verify an explicitly approved replacement remediation satisfying the same technical blocker.
7. Verify Slice 10 Implement Gate opened and Compliance Feature Policy implementation is on main.
8. Reconcile the actual latest migration sequence; do not assume 008/009/010 numbering.
9. Re-read shared CHECK vocabularies, grants, authorization/error contracts, Case phase/status vocabulary and package layout.
10. Verify no new upstream authority change invalidates Slice 11 product semantics.
11. Verify development branch/worktree is clean and based on latest authoritative main while preserving the frozen Spec lineage/reference.

**Verification actions**

- exact SHA/blob comparison;
- remote PR/branch/commit inspection;
- current-main diff from the frozen authority baseline;
- current CI status inspection;
- current migration/shared-contract inventory.

**Completion evidence**

A signed-off preflight record containing:
- latest main SHA;
- Frozen Spec blob;
- four Docs blobs;
- Slice 8 final merge/audit evidence;
- Slice 9 exact authoritative Data Access/Safety implementation path;
- Slice 10 exact authoritative implementation path;
- migration/shared-contract conflict map;
- Input Drift classification;
- explicit `IMPLEMENT GATE: OPEN`.

**Dependencies**

None. Mandatory first task.

**Rollback**

N/A; read-only.

**Failure / stop conditions**

Immediately stop with the matching reason if:
- Frozen Spec blob changed → `STOP — FROZEN SPEC DRIFT`;
- Docs/canonical inventory/Phase order changed materially → `STOP — MATERIAL INPUT DRIFT`;
- Slice 8 not finally reconciled;
- Slice 9 authoritative Drizzle/Data Access blocker unresolved;
- Slice 10 not merged/authoritative;
- Phase 1 migration/shared-contract conflict remains;
- any implementation requires changing Frozen product meaning.

At the planning baseline of 2026-11-11 this task would **not pass** because the Implement Gate is still BLOCKED.

---

- [ ] T1102 [REQ:FR-002,FR-004,FR-006,FR-009,FR-011,FR-012,FR-014,FR-015,FR-021,FR-022,FR-035] Create the independent V1-product snapshot and smallest failing Digital Use contract tests before production Scene code exists [VERIFY:bunx vitest run tests/scenes/digital-use; expected initial failures prove missing manifest/router/validators while snapshot itself parses and contains exactly the approved canonical expectations]

### T1102 — Canonical Snapshot + Failing Contract Evidence

**Objective**

Create the independent test/review projection first, so production manifest code cannot define its own acceptance truth.

**Allowed files / directories**

- `tests/fixtures/digital-use/v1-product-node-manifest.snapshot.json`;
- `tests/scenes/digital-use/**`.

**Forbidden modifications**

- `packages/**`;
- `apps/**`;
- `db/**`;
- `scripts/**`;
- `.github/**`;
- `Docs/**`;
- `specs/**`.

**Implementation actions**

1. Transcribe the exact 75 canonical node identities from the approved current product projection.
2. Include source identity expectations, required semantic fields, explicit branch/terminal expectations, entry/re-entry classifications and parallel relations.
3. Encode A200401 under `nonNodeMarkers`, never under nodes.
4. Encode A3033 and explicit forbidden gap-fill identities.
5. Encode post-PR #25 Digital Use authority-remediation assertions.
6. Add initial tests that import future public contracts and fail for the expected absence of implementation.
7. Ensure snapshot is human-reviewable JSON and contains no executable rule or household data.
8. Do not derive/generate snapshot content from production code.

**Verification actions**

- JSON parse/schema-shape assertion in tests;
- exact count = 75;
- source-code expectation checks;
- initial Vitest run documents expected red failures caused only by missing foundation implementation.

**Completion evidence**

- snapshot blob hash;
- 75-node count report;
- red-test output proving the test truth exists before production implementation;
- reviewer diff linking snapshot sections to Frozen Spec/Docs.

**Dependencies**

T1101 PASS.

**Rollback**

Delete only the newly added snapshot/test files.

**Failure / stop conditions**

Stop if the snapshot requires any node, branch, threshold, terminal or parallel relation not traceable to approved authority; do not fill ambiguity locally.

---

- [ ] T1103 [REQ:FR-001,FR-023,FR-024,FR-027,§3,§12.1] Establish the minimal approved @xiaoshuyin/scenes workspace shell at packages/scenes/digital-use without business runtime or external dependencies [VERIFY:bun install --frozen-lockfile where applicable; bun run typecheck; workspace package resolves and only foundation exports exist]

### T1103 — Minimal Scene Workspace

**Objective**

Make the authoritative `packages/scenes/digital-use/` path a real TypeScript workspace without creating future runtime shells.

**Allowed files / directories**

- `packages/scenes/package.json`;
- `packages/scenes/tsconfig.json`;
- `packages/scenes/digital-use/index.ts`;
- `packages/scenes/digital-use/types.ts`;
- `bun.lock` only if the existing package manager deterministically requires workspace metadata reconciliation.

**Forbidden modifications**

- any business-runtime Scene file such as assessment/eligibility/interventions/plan/follow-up/review/safety implementation;
- external dependencies;
- DB/API/UI/AI code;
- Docs/specs.

**Implementation actions**

1. Add private workspace package `@xiaoshuyin/scenes`.
2. Reuse repository TypeScript baseline.
3. Configure package-local TypeScript include for `digital-use/**/*.ts`.
4. Export only Slice 11 foundation types/contracts.
5. Reuse current authoritative Case phase type as a type-only dependency if latest-main reconciliation confirms it remains canonical; do not duplicate phase semantics.
6. Keep package dependency graph minimal and cycle-free.

**Verification actions**

- workspace package discovery;
- TypeScript compile;
- lockfile diff inspection if changed;
- dependency graph inspection.

**Completion evidence**

- exact workspace package/tsconfig diff;
- typecheck PASS;
- no external dependency additions.

**Dependencies**

T1101, T1102.

**Rollback**

Remove the workspace shell and any lockfile-only reconciliation caused solely by it.

**Failure / stop conditions**

Stop if the authoritative repository layout has changed such that `packages/scenes/digital-use` can no longer be used without an upstream architecture decision.

---

- [ ] T1104 [REQ:FR-001,FR-002,FR-003,FR-004,FR-005,FR-006,FR-007,FR-009,FR-010,FR-011,FR-012,FR-014,FR-015,FR-031,FR-032,FR-035] Implement the explicit 75-entry production node-manifest.ts and structural types with no numeric generation or second inventory [VERIFY:bunx vitest run tests/scenes/digital-use/manifest-completeness.test.ts tests/scenes/digital-use/source-identity.test.ts; bun run typecheck]

### T1104 — Full Node Manifest

**Objective**

Create the single production machine projection of all approved Digital Use nodes.

**Allowed files / directories**

- `packages/scenes/digital-use/types.ts`;
- `packages/scenes/digital-use/node-manifest.ts`;
- `packages/scenes/digital-use/index.ts`;
- focused manifest/source tests under `tests/scenes/digital-use/**`.

**Forbidden modifications**

- second registry/table;
- numeric loops/ranges that manufacture identities;
- routing business implementation beyond type references;
- snapshot changes merely to match code;
- DB/API/UI/AI.

**Implementation actions**

1. Define readonly structural manifest types.
2. Enter all 75 canonical entries explicitly.
3. Preserve `sourceNodeCode` source identity and reversible normalization expectations.
4. Carry phase, stream, prerequisites, schema/decision/interaction/output refs, record contract, allowedNext, reasons/condition refs, parallel relations, entry modes, help/re-entry refs and policy/authority refs as applicable.
5. Represent A200401 only in record/reference semantics.
6. Derive `DigitalUseNodeCode` from the manifest rather than writing a second 75-item union.
7. Preserve A3033 and the intentional gaps.
8. Keep A5001/A5002 distinct.

**Verification actions**

- inventory count;
- expected set equality to snapshot;
- source round-trip tests;
- mandatory field checks;
- explicit forbidden-code absence checks;
- TypeScript compile.

**Completion evidence**

- manifest blob;
- test output showing count 75, missing 0, extra 0, duplicates 0;
- source identity report.

**Dependencies**

T1103.

**Rollback**

Revert manifest/types/index changes and focused tests together.

**Failure / stop conditions**

Stop on any node/field whose meaning cannot be traced to Frozen Spec/current approved authority. Do not invent a value to satisfy type completeness.

---

- [ ] T1105 [REQ:FR-002,FR-003,FR-004,FR-016,FR-017,FR-019,FR-021,FR-031,FR-032,FR-035] Implement pure inventory/source/field/target/branch validators that hard-fail invalid manifests without auto-fix [VERIFY:bunx vitest run tests/scenes/digital-use/manifest-completeness.test.ts tests/scenes/digital-use/source-identity.test.ts tests/scenes/digital-use/graph-validation.test.ts]

### T1105 — Core Manifest Validators

**Objective**

Make completeness, identity, mandatory-field and basic routing-integrity failures mechanical.

**Allowed files / directories**

- `packages/scenes/digital-use/validators.ts`;
- `packages/scenes/digital-use/index.ts`;
- relevant `tests/scenes/digital-use/**`.

**Forbidden modifications**

- snapshot auto-writer;
- runtime persistence;
- router decision logic not needed for validation;
- DB/network/model dependencies.

**Implementation actions**

Implement pure validations for:
- exact inventory;
- missing/extra node;
- duplicate nodeCode;
- duplicate normalized source identity;
- source round-trip;
- mandatory known field/reference;
- allowed NODE target existence;
- approved terminal/external target shape;
- missing/empty branch reason;
- default branch marker;
- A200401 node prohibition;
- A3033/gap-fill invariants;
- A5001/A5002 distinctness.

**Verification actions**

Run focused positive + one-property negative mutation cases.

**Completion evidence**

Validator result/error-code matrix and green focused tests.

**Dependencies**

T1104.

**Rollback**

Revert validator and its tests; manifest remains independently reviewable.

**Failure / stop conditions**

Any validator that “repairs”, drops or silently normalizes an invalid semantic condition is a blocking defect.

---

- [ ] T1106 [REQ:FR-008,FR-009,FR-010,FR-016,FR-017,FR-023,FR-024,FR-025,FR-026,FR-033] Implement routing.ts as a pure manifest-consuming topology router with NODE_ROUTE/TERMINAL_ROUTE/BLOCKED/UNKNOWN and no default or external authority [VERIFY:bunx vitest run tests/scenes/digital-use/routing.test.ts; static dependency scan; repeated-identical-input determinism assertions]

### T1106 — Deterministic Router

**Objective**

Implement only the deterministic topology decision layer.

**Allowed files / directories**

- `packages/scenes/digital-use/routing.ts`;
- `packages/scenes/digital-use/types.ts` for result/input types only;
- `packages/scenes/digital-use/index.ts`;
- `tests/scenes/digital-use/routing.test.ts`.

**Forbidden modifications**

- hard-coded duplicate route table independent of manifest;
- LLM/RAG/network/database/current-clock access;
- professional threshold invention;
- authorization/safety/compliance execution;
- business-state write.

**Implementation actions**

1. Accept package/version, current node and structured routing condition state.
2. Evaluate only the explicit allowedNext condition references for the current manifest node.
3. Return exactly one discriminated topology result.
4. Reject zero-match as BLOCKED/UNKNOWN as appropriate.
5. Reject multiple-match as ambiguous/fail-closed.
6. Mark success results as topology-only authority.
7. Preserve explicit terminal/external destinations.
8. Preserve 01002F→01005 and 01003F→01006 priority semantics.
9. Require an integrated-evidence basis for A200x triage contracts rather than accepting total duration or A1001A-D alone.
10. Ignore/reject caller/model-proposed node codes that do not correspond to the deterministic rule outcome.

**Verification actions**

- branch matrix;
- no-match;
- unknown input;
- multiple match;
- terminal route;
- repeated/concurrent pure evaluation;
- illegal model-proposed route;
- dependency/static scan.

**Completion evidence**

Green routing suite + static proof of no forbidden imports.

**Dependencies**

T1104, T1105.

**Rollback**

Revert routing and routing tests without changing manifest or snapshot.

**Failure / stop conditions**

Stop if a branch requires a new professional threshold or business authorization decision that is not frozen upstream.

---

- [ ] T1107 [REQ:FR-011,FR-015,FR-018,FR-019,FR-034,DU-011-A,DU-011-C] Implement typed non-linear graph reachability, orphan and dead-end validation across routed/user/scheduled/help/re-entry/parallel entry semantics [VERIFY:bunx vitest run tests/scenes/digital-use/graph-validation.test.ts; all 75 nodes receive a legitimate reachability classification and injected orphan/dead-end mutations fail]

### T1107 — Reachability / Orphan / Dead-End Validator

**Objective**

Prove legitimate reachability without forcing a false linear workflow.

**Allowed files / directories**

- `packages/scenes/digital-use/validators.ts`;
- `packages/scenes/digital-use/types.ts` if graph classification types are needed;
- `tests/scenes/digital-use/graph-validation.test.ts`.

**Forbidden modifications**

- invented numeric edges;
- generic “all USER_INITIATED nodes are reachable” shortcut;
- fake root nodes;
- persistence/state-machine framework.

**Implementation actions**

1. Model SCENE_ENTRY, ROUTED_EDGE, USER_ENTRY, SCHEDULED_ENTRY, HELP_REENTRY and PARALLEL_ACTIVATION distinctly.
2. Start canonical scene routing at A1001.
3. Require traceable anchors for non-linear entry.
4. Compute reachability over approved edge/entry classes.
5. Detect unexplained orphan nodes.
6. Detect accidental non-terminal dead ends.
7. Treat explicit terminal/external exits correctly.
8. Preserve A3002 target-management context and target/help reachability.
9. Preserve A4004–A4009 reachability without numeric adjacency.

**Verification actions**

- positive reachability report for all 75;
- orphan mutation;
- fake USER_INITIATED masking mutation;
- dead-end mutation;
- missing terminal mutation;
- numeric adjacency mutation.

**Completion evidence**

Deterministic graph report: canonical orphans = 0, accidental dead ends = 0, invented edges = 0.

**Dependencies**

T1105, T1106.

**Rollback**

Revert graph-validator increment and focused tests.

**Failure / stop conditions**

If a node can only be made reachable by inventing an unsupported transition, stop and report upstream/spec conflict.

---

- [ ] T1108 [REQ:FR-011,FR-013,FR-014,FR-015,FR-020,V1-D40] Implement explicit parallel-fidelity validation for A3001/target work, FAMILY_ALLIANCE vs PHONE_USE_CONTRACT, refusal independence, and A5001/A5002 separation [VERIFY:bunx vitest run tests/scenes/digital-use/parallel-fidelity.test.ts; missing/serialized relation mutations fail]

### T1108 — Parallel Fidelity

**Objective**

Prevent the implementation from silently serializing explicitly parallel product work.

**Allowed files / directories**

- `packages/scenes/digital-use/validators.ts`;
- `tests/scenes/digital-use/parallel-fidelity.test.ts`.

**Forbidden modifications**

- new product dependency between streams;
- merging A5001/A5002;
- business Intervention runtime.

**Implementation actions**

1. Validate A3001 parallel relation to A3002/target feasibility context.
2. Validate both intervention streams are independently reachable.
3. Validate contract refusal/non-participation does not make FAMILY_ALLIANCE unreachable.
4. Validate A5001 and A5002 review their distinct streams/scopes.
5. Fail on required relation omission.
6. Fail when a parallel relation is encoded as a completion prerequisite without authority.

**Verification actions**

Positive and mutation tests.

**Completion evidence**

Parallel-fidelity matrix with zero omissions/serialization defects.

**Dependencies**

T1107.

**Rollback**

Revert parallel validator/tests only.

**Failure / stop conditions**

Stop if current product authority no longer supports the frozen parallel relation.

---

- [ ] T1109 [REQ:FR-005,FR-006,FR-007,FR-008,FR-009,V1-D01,V1-D02,§32.2] Add deterministic regression proving current device/age/purpose/duration/integrated-Evidence semantics and 01005/01006 priority routing [VERIFY:bunx vitest run tests/scenes/digital-use/authority-regression.test.ts; pre-PR#25 semantic mutations all fail]

### T1109 — Current Digital Use Authority Regression

**Objective**

Lock the post-PR #25 product semantics into the foundation tests without inventing Assessment runtime.

**Allowed files / directories**

- `tests/scenes/digital-use/authority-regression.test.ts`;
- narrow static metadata corrections in `node-manifest.ts` / `routing.ts` only when the failing test demonstrates deviation from already-approved semantics.

**Forbidden modifications**

- new clinical/professional thresholds;
- universal age gate;
- duration-band-only decisions;
- Compliance/Safety implementation.

**Implementation actions**

Test that:
- phone, tablet, computer, game console/device and related devices are representable;
- no universal age-6 Scene gate exists;
- learning/research/homework, necessary contact and entertainment/gaming/video/social/non-learning purposes are distinct;
- duration is per-purpose;
- total duration and A1001A-D are auxiliary only;
- integrated basis can represent functional impact, sleep, real-world displacement, emotion, family conflict and other approved Evidence;
- duration-only basis cannot force A2001/A2002/A2003;
- 01002F/01003F priority routes remain.

**Verification actions**

Positive fixtures plus old-semantics mutation fixtures.

**Completion evidence**

Authority regression report with old-semantics regressions = 0.

**Dependencies**

T1106.

**Rollback**

Revert authority tests and only the directly corresponding manifest/router correction.

**Failure / stop conditions**

If passing requires inventing how evidence thresholds produce a professional conclusion, stop; that belongs to later Assessment runtime.

---

- [ ] T1110 [REQ:FR-003,FR-011,FR-012,FR-014,FR-034,FR-035,DU-011-A,DU-011-B] Add focused sparse/non-linear topology tests for A3033, A200401, A3002 target families, A4004–A4009 and A5001/A5002 [VERIFY:bunx vitest run tests/scenes/digital-use/source-identity.test.ts tests/scenes/digital-use/graph-validation.test.ts; all forbidden inferred identities/edges remain absent]

### T1110 — Sparse / Non-Linear Topology Regression

**Objective**

Protect exactly the known areas where numeric intuition can corrupt the canonical flow.

**Allowed files / directories**

- focused `tests/scenes/digital-use/**`;
- manifest/validator corrections only when required by the frozen contract.

**Forbidden modifications**

- range helpers;
- next-number helpers;
- auto-gap filling;
- mandatory A4004→A4005→... chain unless explicitly traceable.

**Implementation actions**

Add exact assertions for:
- A3033 exists once;
- A3023/A3030/A3031/A3032 absent;
- A200401 non-node;
- A3002 target/feasibility/progress/help non-linear reachability;
- A4004–A4009 distinctness and approved reachability;
- A5001/A5002 separate identity/review semantics.

**Verification actions**

Run focused tests and mutation cases.

**Completion evidence**

Sparse topology report with inferred-node count = 0 and inferred-edge count = 0.

**Dependencies**

T1107, T1108.

**Rollback**

Revert focused tests/corrections.

**Failure / stop conditions**

Any test proposal that assumes numeric adjacency without source authority must be rejected, not implemented.

---

- [ ] T1111 [REQ:FR-021,FR-022,FR-030,§12.2A] Implement a one-way semantic comparison from production manifest/routing projection to the independent checked-in snapshot, failing on drift without rewriting the fixture [VERIFY:bunx vitest run tests/scenes/digital-use/snapshot-fidelity.test.ts; intentional semantic mutation yields readable FAIL and snapshot file remains byte-identical]

### T1111 — Snapshot Fidelity / Diff Gate

**Objective**

Turn the canonical snapshot into a real review gate while preserving its independence.

**Allowed files / directories**

- `packages/scenes/digital-use/validators.ts` only for pure projection helpers if appropriate;
- `tests/scenes/digital-use/snapshot-fidelity.test.ts`;
- no snapshot edit unless a defect is proven against unchanged authority, in which case stop for review before changing it.

**Forbidden modifications**

- snapshot auto-generation from manifest;
- snapshot rewrite/update command;
- production import of snapshot.

**Implementation actions**

1. Canonicalize/sort the runtime projection for deterministic test comparison.
2. Compare inventory, source identity, required field semantics, routing, terminals, entry/re-entry and parallel relations.
3. Produce reviewable semantic diffs.
4. Treat any mismatch as failure.
5. Keep snapshot untouched during test execution.

**Verification actions**

- clean comparison PASS;
- intentional semantic mutation FAIL;
- hash snapshot before/after test and prove unchanged.

**Completion evidence**

Snapshot test output + before/after identical blob/hash.

**Dependencies**

T1104–T1110.

**Rollback**

Revert comparator/test changes; do not alter snapshot independently.

**Failure / stop conditions**

If a mismatch reflects a real product-authority change, stop and return to upstream change control rather than accepting it locally.

---

- [ ] T1112 [REQ:FR-001,FR-003,FR-023,FR-024,FR-025,FR-027,FR-028,SC-011,SC-012] Replace only the obsolete packages/scenes blanket ban with narrow static single-source/architecture/scope guards and add guard regression tests [VERIFY:bun run guard:static; bunx vitest run tests/scenes/digital-use/architecture-guard.test.ts; injected node-registry/snapshot-import/numeric-generator/forbidden-router-dependency fixtures fail]

### T1112 — Static Architecture / Single-Source Guard

**Objective**

Allow the approved Phase 2 Scene package while making duplicate truth and runtime leakage mechanically difficult.

**Allowed files / directories**

- `scripts/guard-static.mjs`;
- `tests/scenes/digital-use/architecture-guard.test.ts`;
- test fixtures local to the architecture-guard test if needed.

**Forbidden modifications**

- weakening unrelated existing guard rules;
- broad allowlisting of `packages/scenes`;
- disabling R6 or other security rules;
- new production runtime.

**Implementation actions**

1. Remove only the obsolete blanket `packages/scenes` forbidden path.
2. Require exactly one Digital Use `node-manifest.ts`.
3. Reject `node-registry.ts` or equivalent duplicate registry patterns.
4. Reject production imports from `tests/fixtures/digital-use`.
5. Detect duplicate registry-shaped declarations outside the manifest with careful false-positive boundaries.
6. Reject numeric/range generation of A/010xx inventories.
7. Reject router dependency on DB, Fastify, network, model/RAG/provider or XState modules.
8. Preserve all existing unrelated static rules.

**Verification actions**

- baseline guard PASS;
- mutation/fixture guard failures for each new rule;
- existing guard regression suite PASS.

**Completion evidence**

Static guard output: 0 violations on canonical implementation; each injected violation produces its intended rule code.

**Dependencies**

T1104, T1106, T1111.

**Rollback**

Revert only Slice 11 guard additions and architecture tests; if the whole Slice is reverted, restore the prior packages/scenes prohibition.

**Failure / stop conditions**

Stop if enforcing single-source would require a brittle blanket ban that breaks legitimate isolated references or existing architecture.

---

- [ ] T1113 [REQ:FR-001,FR-002,FR-003,FR-004,FR-005,FR-006,FR-007,FR-008,FR-009,FR-010,FR-011,FR-012,FR-013,FR-014,FR-015,FR-016,FR-017,FR-018,FR-019,FR-020,FR-021,FR-022,FR-023,FR-024,FR-025,FR-026,FR-027,FR-028,FR-029,FR-030,FR-031,FR-032,FR-033,FR-034,FR-035] Complete the full negative-mutation matrix and map all 35 Frozen Acceptance Scenarios to executable evidence [VERIFY:bunx vitest run tests/scenes/digital-use; acceptance mapping shows 35/35 PASS and every required mutation is observed to fail for the intended reason]

### T1113 — Full Acceptance / Negative Mutation Convergence

**Objective**

Prove the entire Frozen Spec contract, not just selected happy paths.

**Allowed files / directories**

- `tests/scenes/digital-use/**`;
- narrow manifest/router/validator corrections driven by a frozen requirement.

**Forbidden modifications**

- weakening snapshot/tests;
- deleting difficult acceptance cases;
- changing Frozen Spec;
- broad production refactor.

**Implementation actions**

Complete explicit mutation coverage for:
- missing node;
- extra node;
- duplicate node;
- duplicate source identity;
- invalid target;
- missing reason;
- default branch;
- orphan;
- dead end;
- missing parallel relation;
- invented numeric adjacency;
- A200401 as node;
- A3033 removed;
- A5001/A5002 merged;
- old device scope;
- age-6 hard gate;
- duration-only route;
- model-created illegal route.

Map Frozen Acceptance Scenarios 1–35 to exact test names/assertions.

**Verification actions**

Run the full Slice 11 scene suite and produce an acceptance matrix.

**Completion evidence**

- 35/35 acceptance PASS;
- required negative mutations all rejected;
- no expected-failure/skip/todo hiding a required case.

**Dependencies**

T1104–T1112.

**Rollback**

Revert convergence-only test additions/corrections as a unit.

**Failure / stop conditions**

Any acceptance scenario requiring out-of-scope runtime causes a scope review; do not fabricate that runtime.

---

- [ ] T1114 [REQ:FR-030,§12.2A,§32.2] Add the minimal existing-CI hook that explicitly runs the Digital Use foundation suite while retaining exact-head full regression and existing contract gates [VERIFY:inspect .github/workflows/ci.yml; CI run on exact head shows Digital Use foundation, typecheck, guard:static, verify-all and OpenAPI checks all PASS]

### T1114 — CI Integration

**Objective**

Make manifest/routing semantic drift block CI without creating a new CI architecture.

**Allowed files / directories**

- `.github/workflows/ci.yml` only.

**Forbidden modifications**

- new deployment workflow;
- snapshot auto-update step;
- removal/weakening of current jobs;
- DB service changes unrelated to current existing jobs;
- production code.

**Implementation actions**

1. Add an explicit `bunx vitest run tests/scenes/digital-use` gate in the most appropriate existing job or minimal new test job within ci.yml.
2. Keep typecheck + guard:static.
3. Keep canonical verify-all exact-head run.
4. Keep OpenAPI contract checks.
5. Ensure failures propagate non-zero.
6. Do not add a snapshot acceptance/update mechanism.

**Verification actions**

Inspect workflow syntax and successful exact-head Actions run.

**Completion evidence**

CI run ID/head SHA with all required gates PASS.

**Dependencies**

T1113.

**Rollback**

Revert only the Slice 11 CI step.

**Failure / stop conditions**

Stop if CI integration requires broad workflow restructuring unrelated to Slice 11.

---

- [ ] T1115 [REQ:FR-026,FR-027,FR-028,FR-029,FR-030,SC-013,SC-014] Run targeted and full repository regression, prove exact implementation scope, and verify no Docs/spec/DB/API/UI/AI/runtime leakage [VERIFY:bun run typecheck; bun run guard:static; bunx vitest run tests/scenes/digital-use; bun run openapi:check; bun run verify-all; git diff --name-only <development-base>...HEAD against the approved allowlist]

### T1115 — Full Regression / Scope Proof

**Objective**

Prove the static foundation coexists with all prior authoritative runtime and changes only the approved surfaces.

**Allowed files / directories**

No new implementation surface. Only remediation within already-approved Slice 11 files if a Slice 11 defect is found.

**Forbidden modifications**

- Docs/**;
- frozen specs/**;
- apps/**;
- db/**;
- unrelated packages/** runtime;
- generated OpenAPI artifacts as a semantic change;
- any test weakening.

**Implementation actions**

1. Run targeted scene suite.
2. Run repository typecheck.
3. Run static guard.
4. Run OpenAPI drift check.
5. Run canonical verify-all.
6. Run governance validation/self-test.
7. Inspect exact diff from development base.
8. Confirm only:
   - packages/scenes/**;
   - tests/scenes/digital-use/**;
   - tests/fixtures/digital-use/**;
   - scripts/guard-static.mjs;
   - .github/workflows/ci.yml;
   - lockfile only if deterministic workspace metadata demanded it.
9. Confirm production node-definition sources = 1.
10. Confirm no migration, persistence, route, AI or UI code.

**Verification actions**

Commands in canonical task line plus diff/stat/grep evidence.

**Completion evidence**

Full regression logs + exact scope report + zero forbidden paths.

**Dependencies**

T1114.

**Rollback**

If a Slice 11 regression cannot be remediated within approved scope, revert the Slice rather than widening scope.

**Failure / stop conditions**

Any pre-existing unrelated failure must be classified honestly; any Slice-caused failure blocks closeout. Any required forbidden-path edit stops for scope review.

---

- [ ] T1116 [REQ:FR-001,FR-002,FR-003,FR-004,FR-005,FR-006,FR-007,FR-008,FR-009,FR-010,FR-011,FR-012,FR-013,FR-014,FR-015,FR-016,FR-017,FR-018,FR-019,FR-020,FR-021,FR-022,FR-023,FR-024,FR-025,FR-026,FR-027,FR-028,FR-029,FR-030,FR-031,FR-032,FR-033,FR-034,FR-035,Constitution] Perform final exact-head convergence/governance verification, freeze implementation evidence, and stop for a new independent Audit 2 without merging [VERIFY:node .specify/scripts/validate-governance.mjs; node .specify/scripts/tests/run-governance-tests.mjs; bun run verify-all; git diff <development-base>...HEAD; exact-head CI evidence; acceptance matrix 35/35]

### T1116 — Exact-Head Convergence / Independent Audit Handoff

**Objective**

End development at a fully evidenced, reviewable head and hand it to a fresh independent code-audit AI.

**Allowed files / directories**

No new feature implementation unless a directly attributable Slice 11 defect is found before freeze and remains within approved scope.

**Forbidden modifications**

- merge main;
- self-approve Audit 2;
- change Frozen planning artifacts to excuse a code defect;
- widen scope.

**Implementation actions**

1. Re-fetch latest main.
2. Reconcile any non-material main drift before final freeze.
3. Re-run Frozen Spec blob check.
4. Re-run all targeted/full/governance evidence on exact final head.
5. Recompute source-of-truth count, node count, snapshot fidelity, reachability, parallel fidelity and scope diff.
6. Freeze the final implementation evidence mapping.
7. Mark development only as `READY FOR INDEPENDENT CODE AUDIT`.
8. Stop.

**Verification actions**

Exact canonical commands in the task line plus PR/head binding if a development PR exists.

**Completion evidence**

- final development SHA;
- current base SHA;
- 35/35 acceptance matrix;
- exact-head CI run;
- full regression PASS;
- governance PASS;
- forbidden scope = 0;
- independent Audit 2 handoff statement.

**Dependencies**

T1115.

**Rollback**

If final convergence fails, unfreeze and remediate only within approved Slice scope; otherwise revert the Slice. Never merge a known failing head.

**Failure / stop conditions**

Any CRITICAL/HIGH unresolved implementation defect, authority drift, scope expansion, failed canonical gate or untraceable semantic diff blocks handoff.

---

## Dependency / Rollback Summary

- T1101 is an absolute gate and is currently blocked at planning time.
- T1102 establishes independent evidence before production code.
- T1103–T1112 build the minimum static foundation in dependency order.
- T1113 proves complete acceptance.
- T1114 only wires existing CI.
- T1115 proves whole-repository safety/scope.
- T1116 freezes and stops for independent Audit 2.

Because Slice 11 has no DB/business side effects, rollback is code-only. Snapshot and manifest must always be reverted/advanced coherently; never leave an implementation/snapshot mismatch hidden.

## Completion Contract

A future task is complete only when:
1. its required implementation exists;
2. its stated verification was actually run;
3. observed output matches the expected result;
4. no test/fixture/snapshot/requirement was weakened to achieve green;
5. every deviation remains traceable to approved authority;
6. no out-of-scope runtime was added;
7. exact-head evidence is retained.

Current planning state:

**TASKS: COMPLETE**  
**TASK EXECUTION: NOT STARTED**  
**IMPLEMENT GATE: BLOCKED**  
**READY FOR DEVELOPMENT WHEN IMPLEMENT GATE OPENS**
