# Implementation Plan: Digital Use Full Node Manifest / Deterministic Routing Foundation

**Feature**: specs/011-digital-use-node-manifest-routing-foundation/spec.md  
**Planning Branch**: plan/011-digital-use-node-manifest-routing-foundation  
**Date**: 2026-11-11  
**V1 Phase**: Phase 2 — Digital Use Scene 忠实实现  
**Role**: Plan AI 2  
**Status**: PLAN COMPLETE / PRE-DEVELOPMENT AUDIT 1 PASS / FINAL PRE-DEVELOPMENT RE-AUDIT PASS / IMPLEMENT GATE BLOCKED

---

## Authority Gate Snapshot

Repository: pyxm1618/xiaoshuyin

Current origin/main:
8e393c990be53c888c2e68d881bd8b23f9c37638

Frozen Spec branch:
spec/011-digital-use-node-manifest-routing-foundation

Frozen Spec commit:
0960bebf7b373567443da0664f2f585861204f47

Frozen Spec blob:
8d47a2b8ad0431540598ceecef14550bd383fe1f

Authoritative Docs blobs on current main:
- Docs/总产品需求.md = 67724000cb9bb81c40489c04db28d899bd1df74c
- Docs/V1产品需求.md = 918d8574ad88773fe371985fd5c38080c944fec9
- Docs/总体技术架构.md = 9b08371edc976fa281469dfee8dc19962452e3b0
- Docs/V1技术设计.md = e7285fd8363c8a76ab4fd96a305037b5c675f961

Current dependency state:
- Slice 8: PR #26 is OPEN, DRAFT, mergeable, head e23cee82fd6953cb02b3ea139e2c2220ed152d90; implementation reports ready for independent code audit but is not merged.
- Slice 9: plan/009-safety-hold-control-foundation head 937456d77e9e5336ec04e2729606973daee3cb7a; Plan/Audit 1 are complete; no Slice 9 runtime branch is present on main and no authoritative Drizzle/Data Access foundation has landed.
- Slice 10: plan/010-compliance-feature-policy-foundation head 117c43f4be3ff6b0e41cbafe8aba8d165a8edb31; Plan/Audit 1/Final Re-audit are complete; Implement Gate remains blocked on Slice 9 Drizzle/Data Access or an approved replacement remediation.
- Current main contains migrations through 007 only, no db/schema directory, no Digital Use packages/scenes runtime, no scene_node_states runtime, no Safety Hold runtime, and no Compliance Feature Policy runtime.

Authority Gate: PASS  
Input Drift: NONE  
Frozen Spec Integrity: PASS

No Selection, Specify, Clarify, node inventory, Digital Use authority semantics, or product decision is reopened by this Plan.

---

## Upstream Traceability

This Plan is a technical projection of the Frozen Spec and the four authoritative Docs. It does not change product meaning.

| Frozen requirement | Upstream authority | Plan projection |
|---|---|---|
| FR-001, FR-021, FR-022, FR-023 | V1-D43; V1技术设计 §12.2–12.3 | one production manifest, one test-only canonical snapshot, routing consumes manifest |
| FR-002–FR-005, FR-031, FR-032, FR-035 | V1-D00, D32–D34, D43 | exact 75-node inventory, reversible source identity, sparse numbering, A200401 exclusion |
| FR-006–FR-010 | V1-D01–D07; §12.3; §32.2 | current Digital Use remediation, integrated Evidence routing, 01005/01006 priority semantics |
| FR-011–FR-015, FR-020, FR-034 | V1-D08–D31, D40 | non-linear target/help/scheduled entry and two parallel intervention streams |
| FR-016–FR-019, FR-033 | §12.2A | target validity, branch reasons, no default, reachability/orphan/dead-end fail-closed |
| FR-024, FR-025 | V1-C24; §12.3 | pure deterministic router; no model/network/database routing authority |
| FR-026 | V1-C20, C25, C38–C44 | topology result never bypasses Authorization/Consent/Safety/Compliance/RLS |
| FR-027–FR-030 | §38; V1-D33/D43; §32.2 | foundation only; no business runtime; no XState; full Digital Use fidelity regression |
| SC-001–SC-014 | Frozen Spec §21 | implementation and CI evidence matrix below |

The exact 75-node list in Frozen Spec §7.1 is inherited without alteration. A3033 remains canonical. A3023/A3030/A3031/A3032 remain absent. A200401 remains record-contract semantics only.

---

## Summary

Slice 11 will establish the smallest code-side Phase 2 foundation approved by Docs/V1技术设计.md:

1. one workspace package at packages/scenes, with the Digital Use Scene package rooted at packages/scenes/digital-use;
2. one production node-manifest.ts containing the only production Digital Use node-definition collection;
3. one lightweight pure routing.ts that reads the manifest and never defines a second route table;
4. one test-only canonical product snapshot at the exact path required by §12.2A;
5. pure validators for inventory, source identity, field fidelity, routing integrity, non-linear reachability, orphan/dead-end classification and parallel fidelity;
6. tests that cover all Frozen Acceptance Scenarios and required negative mutations;
7. a static architecture guard that permits the now-authorized packages/scenes path while preventing a second manifest/registry, runtime use of the snapshot, database/network/AI routing dependencies, numeric-range generation and obvious route-table duplication;
8. an existing-CI integration step for the Digital Use foundation suite plus full canonical regression.

The implementation will not create Scene persistence, Assessment services, API routes, database schema/migrations, Safety runtime, Compliance runtime, AI, RAG, UI, notifications, Goal/Plan/Task runtime or any other later-phase capability.

---

## Technical Baseline

**Runtime / Language**: Node.js 26.13.0, TypeScript 5.9 strict baseline, ESM/NodeNext, Bun scripts, Vitest 3.2 baseline.  
**Repository model**: modular monolith; root workspaces apps/server/* and packages/*.  
**Dependencies**: no new external dependency is required or permitted for this Slice.  
**Storage / Migration**: N/A. No database entity, migration, RLS policy, role, lock or transaction is introduced.  
**Testing / Eval**: Vitest pure unit/static/graph tests; existing guard:static; existing typecheck; existing verify-all; existing governance validator.  
**Deployment target**: static in-process Scene Package code only; no new service, worker or endpoint.  
**Approved architecture path**: Docs/V1技术设计.md §3 and §12.1 explicitly place Digital Use under packages/scenes/digital-use.  
**Snapshot path**: tests/fixtures/digital-use/v1-product-node-manifest.snapshot.json exactly as frozen in §12.2A.

Current repository reconciliation:
- root tsconfig includes packages/*/src only;
- existing package workspaces carry their own package.json + tsconfig + typecheck script;
- therefore packages/scenes will be created as a real workspace package with its own tsconfig that includes digital-use/**/*.ts, preserving the authoritative Docs path instead of relocating the Scene package into an invented src path;
- scripts/guard-static.mjs currently forbids packages/scenes because it predates Phase 2. Slice 11 must remove only that obsolete blanket prohibition and replace it with narrower Scene-foundation architecture guards.

No framework, workflow engine, state machine or graph library is added.

---

## Constitution Check

- [x] No new product semantics.
- [x] No V2–V5 scope pulled into V1.
- [x] No canonical A/010xx behavior reordered, merged, deleted, corrected, or renumbered.
- [x] Frozen technology stack and exclusions are respected.
- [x] Deterministic rules remain deterministic.
- [x] Authorization / Consent / RLS / Safety / Compliance remain independent and are not implemented here.
- [x] Data provenance/version/history requirements are preserved as static package/snapshot metadata only.
- [x] UNKNOWN, no-match, terminal, re-entry and non-linear reachability are explicit.
- [x] No new command idempotency or concurrency state is invented; routing is side-effect free.
- [x] Verification exists for every Frozen Acceptance Scenario and Success Criterion.
- [x] Snapshot is not runtime truth.
- [x] node-manifest.ts is the only production node-definition truth.
- [x] No XState, LLM, RAG, DB or network dependency is introduced.

Constitution Check: PASS.

---

## Implement Gate

Design Gate: PASS.

Future Implement Gate: BLOCKED at planning time.

Development MUST NOT begin until a fresh T1101 preflight proves all of the following on then-current main:

1. Slice 8 independent code audit is complete and its authoritative implementation is merged/reconciled;
2. Slice 9 Safety Hold runtime and the authoritative Drizzle/Data Access foundation are merged, or an explicitly approved replacement remediation closes the exact same technical blocker;
3. Slice 10 Implement Gate is open and its Compliance Feature Policy implementation is merged;
4. latest main and all four authority Docs are re-read after those merges;
5. all Phase 1 migration numbers, shared CHECK vocabularies, grants, authorization/error contracts and other shared-contract conflicts are reconciled.

Until those conditions are proven, the only valid status is:

PLAN FROZEN  
AUDIT 1 PASS  
READY FOR DEVELOPMENT WHEN IMPLEMENT GATE OPENS  
IMPLEMENT GATE BLOCKED

---

## Design

### Existing Contracts Reused

- Case phase type and Common Core phase semantics remain owned by packages/domain and current/future merged Phase 1 runtime.
- Authorization, Consent, RLS, Safety and Compliance remain independent external guards. The Scene package may carry policyRefs but may not execute or replace those authorities.
- Digital Use canonical flow remains owned by Docs/V1产品需求.md and projected by the Frozen Spec.
- Scene package path and Full Node Manifest contract are owned by Docs/V1技术设计.md §12.
- Existing package/tooling conventions are reused: private workspace package, TypeScript, Vitest, guard:static, verify-all.

### Data and Migration Impact

N/A.

Forbidden:
- db/migrations/**
- db/schema/**
- scene_node_states
- scene_artifacts
- any new RLS/grant/role
- any persistence repository

If implementation discovers that persistence is required to satisfy Slice 11, stop with SCOPE CONFLICT. Do not widen this Plan.

### Authorization / Safety / Compliance Impact

The router produces topology-only results, never business authorization.

Every route result is explicitly marked as topology authority only. A matched route means only:

“this destination is an approved topological outcome for the supplied already-authorized structured condition state.”

It does not mean:
- actor is authorized;
- consent exists;
- Safety allows progression;
- Compliance allows the feature;
- RLS permits data access;
- Common Core phase/state allows a business transition.

Later runtime must independently run Authorization, Consent, Safety, Compliance, identity/RLS and Common Core guards before applying any route.

The Slice 11 package will not import database repositories, Fastify, model providers, Safety implementation or Compliance evaluator merely to decide topology.

### API / Contract Impact

N/A.

No Fastify route, OpenAPI schema, generated client, request/response DTO or public endpoint is added.

### AI / RAG / Eval Impact

No AI/RAG/model dependency.

Model output is not a router input authority. A model-proposed node code cannot create a route that is absent from manifest + deterministic routing conditions.

### Async / Notification / Side-Effect Impact

N/A.

No job, notification, timer, queue or command side effect is created. SCHEDULED is represented as static entry semantics only.

---

## Project Structure

Future implementation is limited to the following planned paths unless T1101 finds a non-semantic repository reconciliation requirement. Any additional production area requires a stop-and-review.

### Scene workspace

packages/scenes/package.json  
- new private workspace package, name @xiaoshuyin/scenes;
- no external runtime dependency;
- exports only approved Digital Use foundation entry points.

packages/scenes/tsconfig.json  
- extends repository TypeScript baseline;
- includes digital-use/**/*.ts;
- no compiler-policy divergence.

packages/scenes/digital-use/index.ts  
- narrow exports for manifest, routing and validator public contracts;
- no business runtime.

packages/scenes/digital-use/types.ts  
- structural types only;
- no node inventory list;
- no route table;
- may import CasePhaseValue as a type from @xiaoshuyin/domain if current main still exposes the authoritative phase type.

packages/scenes/digital-use/node-manifest.ts  
- the single and only production Digital Use node-definition source;
- explicit 75 entries;
- no range generation;
- contains allowedNext/entry/parallel/policy/record references.

packages/scenes/digital-use/routing.ts  
- pure deterministic router;
- consumes node-manifest.ts;
- no duplicated node registry/table;
- no DB/network/AI calls.

packages/scenes/digital-use/validators.ts  
- pure manifest/snapshot/graph validators;
- no second canonical inventory;
- expected canonical values come from test fixture only when invoked by tests, never at runtime.

No assessment.ts, eligibility.ts, interventions runtime, persistence, plan.ts, follow-up.ts, review.ts or safety.ts is created in Slice 11. Those filenames are approved future Scene-package structure but remain out of this Slice.

### Canonical snapshot

tests/fixtures/digital-use/v1-product-node-manifest.snapshot.json  
- independent test/review fixture transcribed from the approved current V1 product flow/Frozen Spec;
- never imported by production code;
- never generated from node-manifest.ts;
- stores normalized expected node identities, source identities, required field semantics, branch/terminal expectations, parallel relations, entry/re-entry expectations and authority-remediation assertions;
- may include trace metadata such as approved requirement IDs and the Frozen Spec blob used to establish the fixture.

### Tests

tests/scenes/digital-use/manifest-completeness.test.ts  
tests/scenes/digital-use/source-identity.test.ts  
tests/scenes/digital-use/routing.test.ts  
tests/scenes/digital-use/graph-validation.test.ts  
tests/scenes/digital-use/parallel-fidelity.test.ts  
tests/scenes/digital-use/authority-regression.test.ts  
tests/scenes/digital-use/snapshot-fidelity.test.ts  
tests/scenes/digital-use/architecture-guard.test.ts

Exact test-file consolidation is allowed if and only if every named acceptance remains mechanically traceable and the final task/evidence map records the actual files. Tests must stay under tests/scenes/digital-use or tests/fixtures/digital-use.

### Static guard / CI

scripts/guard-static.mjs  
- remove only the obsolete Phase-1 blanket ban on packages/scenes;
- add narrow rules for single-source/no-node-registry/no-runtime-snapshot-import/no forbidden external dependency/no numeric generation/no duplicate route-definition shape.

.github/workflows/ci.yml  
- add or extend an existing step so tests/scenes/digital-use runs explicitly in CI;
- retain the existing canonical verify-all integration job for full regression;
- no new service or deployment job.

No other scripts/** or .github/** file is planned.

---

## Single Source of Truth

### Production truth hierarchy

1. Product authority: Docs/V1产品需求.md.
2. Technical architecture: Docs/V1技术设计.md.
3. Frozen Slice 11 implementation projection: spec.md.
4. Production code-side node truth: packages/scenes/digital-use/node-manifest.ts.
5. Runtime router: consumes #4.
6. Snapshot: test/review comparison only; never runtime truth.

### Forbidden duplicate truth

Implementation must fail static review if it introduces:
- node-registry.ts;
- another node-manifest.ts for Digital Use;
- a hard-coded API-side node list;
- a second production route table;
- a generated numeric inventory;
- a test fixture imported by production;
- a snapshot generator whose source is node-manifest.ts and whose output is then treated as independent proof.

### Static single-source guard

The future static guard must enforce at least:

1. exactly one production path named node-manifest.ts under packages/scenes/digital-use;
2. no production file named node-registry.ts or equivalent registered second node table;
3. production routing.ts imports the manifest;
4. production files other than node-manifest.ts may not declare registry-shaped entries containing nodeCode + sourceNodeCode + allowedNext;
5. no production import from tests/fixtures/digital-use;
6. no numeric range/gap-fill construction for A/010xx identities;
7. no routing import of pg, Fastify, model/RAG/provider/network modules;
8. no XState dependency/import.

The guard must detect architecture duplication, not ban every isolated node-code string needed for type narrowing, logging or future integration.

---

## Manifest Data Model

The Plan freezes the following implementation-level shape. Exact symbol spelling may vary only if semantics remain identical and the final audit can map every field one-to-one.

### Core manifest

DigitalUseNodeManifest is a readonly array/collection of DigitalUseNodeManifestEntry.

DigitalUseNodeManifestEntry contains:

- nodeCode
- sourceNodeCode
- phase
- stream, optional only when upstream has no stream
- prerequisites
- inputSchemaRefs
- decisionSchemaRefs
- interactionRefs
- outputRefs
- recordContract
- allowedNext
- canRunInParallelWith
- entryMode
- helpOrReentryRefs
- policyRefs
- authorityRefs

The Frozen Spec field names are preserved conceptually. Plural refs may be implemented as arrays when a node has multiple references.

### Node identity typing

There must not be a second manually maintained NodeCode union.

Preferred pattern:
- manifest is declared as const and satisfies the structural entry shape;
- DigitalUseNodeCode is derived from typeof manifest[number].nodeCode;
- source identity normalization helpers operate on strings and validated entries;
- tests compare derived identities to the independent snapshot.

This avoids a second production inventory hidden in a type declaration.

### Source identity

sourceNodeCode preserves the authoritative source literal/identity and must support reversible normalization for:
- 01002 / 01003 leading zeros;
- source forms with spacing such as A 2010, A 3070, A 4002;
- canonical normalized nodeCode.

Normalization may remove approved presentation spacing but may not invent or collapse identities.

Duplicate normalized source identity is a hard failure.

### Record contract

RecordContract is static metadata describing what the node records or references.

A200401 may appear only here or in equivalent record/reference metadata associated with A2003/A2006/A2008. It may not appear in the manifest node collection or as a navigable target.

### Allowed next route

Each allowedNext element is discriminated:

- NODE target: an existing canonical node code;
- TERMINAL/EXTERNAL target: an explicit non-node destination approved by the product flow.

Each branch also carries:
- reasonCode;
- conditionRef or equivalent deterministic condition identity;
- authorityRefs.

There is no DEFAULT reason/condition. A missing match returns BLOCKED/UNKNOWN; it never chooses the first edge.

### Entry and parallel metadata

entryMode is an explicit set drawn only from:
- ROUTED
- USER_INITIATED
- SCHEDULED

helpOrReentryRefs identifies approved help/re-entry anchors. It must not be used as a generic escape hatch to mark an otherwise orphan node reachable.

canRunInParallelWith stores explicit approved relations only. No parallel relation is inferred from numbering.

### Authority-remediation metadata

A1001 field references must visibly represent:
- phone;
- tablet;
- computer;
- game console/game device;
- other related digital device;
- learning/research/homework;
- necessary contact;
- entertainment/gaming/video/social/non-learning use;
- per-purpose duration;
- functional impact;
- sleep;
- real-world activity displacement;
- emotion;
- family relationship/conflict;
- historical duration bands as auxiliary Evidence only where applicable.

There is no universal under-six Scene eligibility predicate.

---

## Deterministic Router

### Pure function boundary

The router accepts:
- immutable Scene package/version identity;
- current canonical nodeCode;
- already-authorized structured routing facts/condition state;
- optional structured UNKNOWN/DECLINED/NOT_COLLECTED/CONFLICT states that are explicitly part of the frozen condition contract.

The router does not accept an authoritative nextNodeCode from callers.

It performs:
1. locate current node in manifest;
2. evaluate only approved condition references for that node against supplied structured state;
3. return the single matched explicit route, explicit terminal route, BLOCKED or UNKNOWN;
4. reject ambiguous multiple matches rather than choosing one.

### Result shape

RoutingResult is a discriminated union:

NODE_ROUTE
- authority = TOPOLOGY_ONLY
- fromNodeCode
- nextNodeCode
- reasonCode
- packageVersion

TERMINAL_ROUTE
- authority = TOPOLOGY_ONLY
- fromNodeCode
- terminalCode / external destination identity
- reasonCode
- packageVersion

BLOCKED
- authority = TOPOLOGY_ONLY
- fromNodeCode when known
- code such as NO_APPROVED_ROUTE, PREREQUISITE_UNSATISFIED, INVALID_ROUTING_INPUT
- reason details limited to static/domain-safe metadata

UNKNOWN
- authority = TOPOLOGY_ONLY
- fromNodeCode when known
- code such as UNKNOWN_OR_UNSUPPORTED_CONDITION
- no fallback destination

Unknown current node is not converted into a route.

### Integrated Evidence boundary

Slice 11 must not invent professional thresholds for A2001/A2002/A2003.

The router may consume a server-owned structured triage condition produced later by Assessment logic, but the topology contract must require provenance/basis sufficient to distinguish integrated Evidence from duration-only classification.

The foundation must reject/decline to route when the only basis supplied is:
- total duration;
- one historical A1001A-D duration band.

The foundation may represent integrated basis categories such as purpose, functional impact, sleep, real-activity displacement, emotion and family conflict without deciding professional thresholds that are not frozen upstream.

This preserves FR-008 without implementing Assessment runtime.

### Priority branches

01002F → 01005 and 01003F → 01006 remain explicit priority routes with reason semantics.

### No external authority

Routing evaluation has:
- no LLM;
- no model-proposed next node authority;
- no network;
- no database;
- no current clock dependency;
- no mutable process-global state;
- no hidden default;
- no numeric adjacency inference.

Same package version + same structured input produces semantically identical output.

---

## Canonical Snapshot

### Format

Path:
tests/fixtures/digital-use/v1-product-node-manifest.snapshot.json

The JSON fixture contains normalized review data, not executable routing logic:

- snapshotVersion;
- authorityRefs;
- frozenSpecBlob;
- nodes[] with expected nodeCode/sourceNodeCode and required semantic field projections;
- expected node-target branches and terminal/external branches with reason identities;
- expected entry-mode/re-entry classifications;
- expected parallel relation pairs;
- explicit nonNodeMarkers including A200401;
- explicit sparse-number assertions including A3033 and forbidden gap-fill identities;
- Digital Use authority-remediation assertions.

It contains no Family/Person/Case data.

### Source of truth

Snapshot is derived manually/reviewably from approved Docs + Frozen Spec, never from node-manifest.ts.

Snapshot != production source of truth.  
Snapshot != product authority.  
Snapshot != auto-generated mirror of implementation.

### Maintenance rule

Default on Manifest/snapshot mismatch: FAIL.

Do not auto-update the snapshot.

A later snapshot change is permitted only when:
- the change is traceable to an approved product-semantic source revision;
- the snapshot diff is reviewed alongside that authority change;
- the manifest/routing diff is reviewed against the new snapshot;
- full Digital Use fidelity regression runs.

Ordinary refactor or implementation convenience cannot modify the snapshot to remove a diff.

---

## Graph Validation

Validation operates on immutable manifest data and explicit snapshot expectations.

### Inventory pass

Hard fail on:
- node count != 75;
- missing canonical node;
- extra A/010xx node;
- duplicate nodeCode;
- duplicate normalized sourceNodeCode;
- A3033 absent/duplicated;
- A200401 present as node;
- A5001/A5002 missing or collapsed.

### Target and branch pass

For every allowedNext:
- NODE target must resolve to exactly one manifest node;
- TERMINAL/EXTERNAL target must resolve to an approved explicit terminal identity;
- reasonCode must be non-empty and non-default;
- conditionRef must be explicit;
- unsupported/multiple conditions cannot silently pick a target.

### Reachability model

Reachability is typed, not a single linear BFS.

Edge/entry classes:
- ROUTED_EDGE: allowedNext NODE edges;
- PARALLEL_ACTIVATION: explicit approved parallel relation;
- USER_ENTRY: node has approved USER_INITIATED entry plus a traceable product entry anchor;
- SCHEDULED_ENTRY: node has approved SCHEDULED entry plus a traceable schedule/timeline anchor;
- HELP_REENTRY: approved help/re-entry reference from a reachable context;
- SCENE_ENTRY: canonical Digital Use entry to A1001.

The validator computes:
1. routed reachability from A1001;
2. additional reachability from only approved non-linear entry anchors;
3. parallel activation without turning parallelism into a serial prerequisite;
4. help/re-entry reachability only when the reference itself is approved/known;
5. final canonical reachability classification for all 75 nodes.

A bare entryMode label without an approved anchor is insufficient to hide an orphan.

### Orphan

A canonical node is an orphan if it has:
- no routed path from a legal root;
- no valid user-initiated/scheduled root;
- no valid help/re-entry anchor;
- no valid parallel activation context.

Any unexplained orphan fails.

### Dead end

A non-terminal node is an accidental dead end if it has no:
- approved NODE continuation;
- approved explicit TERMINAL/EXTERNAL exit;
- approved scheduled/user/help re-entry continuation semantics;
- approved ongoing parallel/support semantics explicitly recognized by snapshot.

The validator must never fabricate next-number edges to repair a dead end.

### Parallel fidelity

The validator compares explicit production parallel relations to snapshot expectations.

Required cases include:
- A3001 communication preparation parallel with A3002/target feasibility work where approved;
- FAMILY_ALLIANCE and PHONE_USE_CONTRACT are independently reachable streams;
- contract refusal/non-participation does not make FAMILY_ALLIANCE unreachable;
- A5001 reviews FAMILY_ALLIANCE/target effects;
- A5002 reviews PHONE_USE_CONTRACT effects;
- A5001 and A5002 remain distinct.

Parallel relations are not converted into completion prerequisites unless upstream explicitly says so.

---

## Sparse / Non-Linear Topology Contract

The implementation must never:
- parse numeric suffixes and auto-increment;
- generate A3010–A3113 by ranges;
- insert missing numbers to make a sequence “complete”;
- infer A4004→A4005→…→A4009 solely from numeric order;
- infer review merging from similar numbering.

Mandatory targeted tests:

A3033
- exists exactly once;
- A3023/A3030/A3031/A3032 absent.

A200401
- appears only in record/reference semantics;
- cannot be current node or next node.

A4004–A4009
- all remain distinct and reachable through approved entry/ordering semantics;
- no mandatory adjacency is invented unless explicitly supported.

A3002 target family
- all actual target/feasibility/progress/help nodes are reachable through approved target-management/user/scheduled/help semantics;
- no range generation.

A5001 / A5002
- remain separate nodes and review scopes.

---

## Current Authority Regression

A dedicated deterministic suite must prove:

1. computer is representable in A1001 device scope;
2. game console/game device is representable;
3. phone/tablet are still present;
4. no universal age-6 Scene eligibility rejection exists;
5. learning/research/homework is distinct from necessary contact;
6. both are distinct from entertainment/gaming/video/social/non-learning use;
7. duration is per-purpose;
8. total duration is auxiliary Evidence only;
9. historical A1001A-D duration bands are auxiliary Evidence only;
10. duration-only input cannot decide A2001/A2002/A2003;
11. A2001/A2002 routing contract requires integrated Evidence basis;
12. functional impact remains available;
13. sleep remains available;
14. real-world activity displacement remains available;
15. emotion remains available;
16. family relationship/conflict remains available;
17. other approved evidence can be referenced;
18. 01002F → 01005 priority semantics remain;
19. 01003F → 01006 priority semantics remain;
20. old phone/tablet-only or under-six/duration-band-only semantics fail mutation tests.

These tests inspect deterministic contracts only. They do not invent Assessment thresholds.

---

## Testing Strategy

### Unit / manifest

Covers:
- exact inventory;
- source normalization;
- duplicate detection;
- mandatory field presence;
- A200401 boundary;
- A3033 sparse identity;
- A5001/A5002 separation.

### Pure routing

Covers:
- every explicit branch in Frozen Spec §11.1 that is in foundation scope;
- explicit terminal routes;
- BLOCKED and UNKNOWN;
- no default;
- no ambiguous multiple match;
- repeated identical evaluation determinism;
- model-proposed illegal route has no authority.

### Graph validation

Covers:
- invalid target;
- orphan;
- dead end;
- entry modes;
- help/re-entry;
- scheduled entry;
- parallel activation;
- A3002 target family reachability;
- A4004–A4009 non-linear reachability.

### Negative mutation fixtures

Tests must clone the manifest/snapshot in memory and mutate one property at a time. Required failures:
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
- A200401 promoted to node;
- A3033 removed;
- A5001/A5002 merged;
- old device scope regression;
- age-6 hard gate regression;
- duration-only routing;
- illegal model-created route.

Mutation tests do not modify the checked-in snapshot.

### Static architecture guard

Proves:
- exactly one production node manifest;
- no node-registry;
- routing consumes manifest;
- snapshot never imported by production;
- no DB/network/model/XState dependency;
- no generated numeric inventory;
- no Scene persistence/API/UI runtime leakage.

### Snapshot diff

Projects manifest into a canonical comparable representation and compares it to the independent JSON fixture.

Mismatch fails with a human-readable semantic diff. Test code may canonicalize/sort for comparison; it may not rewrite the fixture.

### Scope guard

Final exact-head diff must show only approved Slice 11 implementation surfaces:
- packages/scenes/**
- tests/scenes/digital-use/**
- tests/fixtures/digital-use/**
- scripts/guard-static.mjs
- .github/workflows/ci.yml
- package lock only if workspace metadata causes a deterministic lockfile update

Forbidden changes:
- Docs/**
- specs/** frozen artifacts
- apps/**
- db/**
- packages/domain runtime behavior
- packages/authorization runtime
- packages/compliance runtime
- future Safety runtime
- generated OpenAPI
- public API routes

Any required change outside the allowlist must stop for scope review instead of being smuggled into the Slice.

### Full regression

After targeted suite passes:
- bun run typecheck
- bun run guard:static
- bunx vitest run tests/scenes/digital-use
- bun run openapi:check
- bun run verify-all
- node .specify/scripts/validate-governance.mjs
- node .specify/scripts/tests/run-governance-tests.mjs

No existing test, snapshot, fixture or governance expectation may be weakened to make Slice 11 green.

---

## CI / Governance Plan

No new CI system is created.

Existing .github/workflows/ci.yml is extended minimally:

Static Checks:
- existing typecheck;
- existing guard:static.

Digital Use Foundation step:
- bunx vitest run tests/scenes/digital-use;
- this step must cover manifest completeness, routing integrity, snapshot fidelity, graph reachability, parallel fidelity and authority regression.

Canonical integration:
- existing Run canonical verify-all remains the full-regression exact-head evidence.

Contract:
- existing OpenAPI generate/check remains unchanged semantically and must stay green, proving no API drift.

CI evidence required on final development head:
- manifest suite PASS;
- guard:static PASS;
- typecheck PASS including @xiaoshuyin/scenes;
- full verify-all PASS;
- governance PASS;
- exact head SHA bound to the successful run.

No snapshot auto-accept/update job is permitted.

---

## Verification Plan

| Requirement / Acceptance | Test or evidence | Command / environment | Expected result |
|---|---|---|---|
| FR-001 / SC-011 | static architecture guard | bun run guard:static | exactly one production Digital Use manifest, no registry/duplicate truth |
| FR-002–004 / AS 1–3 | manifest/source tests | bunx vitest run tests/scenes/digital-use | exactly 75, reversible source identity, sparse codes preserved |
| FR-035 / AS 4 | manifest/record-contract test | same | A200401 absent from inventory, present only as record/reference semantic |
| FR-006–009 / AS 5–9 | authority-regression tests | same | broad device scope, no age-6 gate, no duration-only routing, 01005/01006 preserved |
| FR-010 / AS 10–11 | pure routing tests | same | explicit A2004/A2005/A2006/A2008/A2009 branches, no default |
| FR-011 / AS 12–14 | graph tests | same | A3000/A3001/A3002 target/help semantics reachable without numeric invention |
| FR-012 / AS 15–19 | manifest/graph tests | same | A4001–A4012 distinct, A4004–A4009 no invented chain, A4012 re-entry represented |
| FR-013–015 / AS 20–21 | parallel tests | same | family stream survives contract refusal; A5001/A5002 remain distinct |
| FR-016–020 / AS 22–29 | negative mutation graph suite | same | invalid target/reason/default/orphan/dead-end/parallel omission all fail |
| FR-021–022 / AS 30 | snapshot fidelity | same | semantic mismatch blocks; fixture is not rewritten |
| FR-023–025 / AS 31,35 | routing/static tests | same | router consumes manifest; illegal model node ignored/rejected; no-match fail-closed |
| FR-026 / AS 32 | boundary/static contract test | same | result marked topology-only; no bypass imports/authority semantics |
| FR-027–029 / AS 34 | scope/static diff | guard + git diff | no runtime persistence/API/UI/AI; UI consolidation cannot alter manifest identities |
| FR-030 | full regression | bun run verify-all | all prior suites and new fidelity suite green |
| FR-031–034 | negative/source/reachability tests | Digital Use suite | duplicate identities and false orphan/dead-end handling fail correctly |
| AS 33 | determinism test | Digital Use suite | concurrent/repeated pure evaluations identical, side-effect free |
| SC-001–010 | suite aggregate | CI Digital Use Foundation step | zero inventory/routing/reachability/authority drift |
| SC-012 | dependency/static scan | guard:static | zero DB/model/network dependency in router |
| SC-013–014 | exact-head diff | git diff origin/main...HEAD | zero runtime scope expansion and zero Docs changes |

All 35 Frozen Acceptance Scenarios are mapped across the tests above and expanded task evidence in tasks.md.

---

## Rollback / Recovery

There is no data migration or business side effect.

Rollback is a normal code revert of the Slice 11 implementation commit(s).

A rollback must remove:
- @xiaoshuyin/scenes workspace additions;
- manifest/router/validators;
- test fixture/tests;
- Slice 11-specific static guard/CI additions.

It must restore the prior packages/scenes blanket guard only if the entire Phase 2 Scene package is being reverted. No database or production-data recovery is required.

Snapshot must never be independently rolled forward while implementation is rolled back, or vice versa.

---

## Complexity Exceptions

None.

No approved architecture constraint requires an exception.

---

## Pre-Development Audit 1

Audit object:
Frozen Spec ↔ Plan ↔ Checklist ↔ Tasks ↔ Acceptance Evidence.

### Spec → Plan

PASS.

FR-001–FR-035, SC-001–SC-014 and Acceptance Scenarios 1–35 are represented by explicit design, validation and verification sections.

### Plan → Tasks

PASS.

Every planned production/test/governance action is assigned to T1101–T1116 in tasks.md.

### Tasks → Verification

PASS.

Every task contains:
- exact objective;
- allowed file/path scope;
- forbidden changes;
- implementation actions;
- verification actions;
- completion evidence;
- dependencies;
- hard stop conditions.

### Acceptance → Test

PASS.

Every Frozen Acceptance Scenario is covered by a named test class and the task evidence map. Negative failure semantics are not left to manual review.

### Out of Scope

PASS.

No Assessment runtime, persistence, DB, API, AI, Goal/Plan runtime, Safety runtime, Compliance runtime, UI, notification or worker capability is planned.

### Architecture

PASS.

No second node truth, second route truth, runtime snapshot, XState, hidden default or numeric adjacency is introduced.

### Authority

PASS.

The Plan preserves the post-PR #25 Digital Use authority remediation:
- computer/game devices included;
- no universal age-6 Scene gate;
- purpose-separated duration;
- A1001A-D auxiliary only;
- integrated Evidence routing.

### Implement Gate

PASS.

Planning readiness is not represented as implementation readiness. Implement Gate remains BLOCKED.

Audit 1 findings after planning remediation:
- CRITICAL: 0
- HIGH: 0
- MEDIUM: 0
- LOW: 0

Audit 1: PASS.

---

## Final Pre-Development Re-Audit

Re-verified planning inputs at the final planning pass:

- origin/main = 8e393c990be53c888c2e68d881bd8b23f9c37638;
- Frozen Spec commit = 0960bebf7b373567443da0664f2f585861204f47;
- Frozen Spec blob = 8d47a2b8ad0431540598ceecef14550bd383fe1f;
- four authoritative Docs blobs equal the Frozen Spec Authority Gate record;
- Slice 8 PR #26 remains open/draft and unmerged;
- Slice 9 remains planning-only relative to main; no authoritative Drizzle/Data Access foundation is on main;
- Slice 10 remains planning-only relative to main and implement-blocked;
- no new Phase 1 runtime, db/schema, Safety runtime or Compliance Feature Policy runtime is on main;
- no material shared-contract or migration drift exists because current main is unchanged from the frozen authority baseline.

Input Drift: NONE.  
Frozen Spec changed: NO.  
Docs changed: NO.  
Open Product Decisions: 0.  
Design Gate: PASS.  
Implement Gate: BLOCKED.

Final Pre-Development Re-Audit: PASS.

---

## Final Planning Status

PLAN FROZEN  
AUDIT 1 PASS  
READY FOR DEVELOPMENT WHEN IMPLEMENT GATE OPENS  
IMPLEMENT GATE BLOCKED

This Plan stops before implementation.
