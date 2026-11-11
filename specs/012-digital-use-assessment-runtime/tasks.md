# Slice 12 Engineering Tasks — 012-digital-use-assessment-runtime

Repository: pyxm1618/xiaoshuyin
Role: Slice 12 Plan AI 2
Execution status: NOT STARTED — IMPLEMENT GATE BLOCKED
Frozen authority: 5e397fee86eb29da1acc1a5a1d176e0c73aa8849 / e0ed342dc144fedf5b516b5295a23cbcc31722bc

Every task is a closed engineering increment with Goal, Expected scope, Mandatory contracts, Verification and Prerequisites.

## Task Index

- T1201: Development-start Authority / Dependency / Implement Gate — depends on None.
- T1202: Reconcile merged owner contracts and shared vocabularies — depends on T1201.
- T1203: Scene persistence migration / Drizzle projection / RLS — depends on T1202.
- T1204: Shared contracts / Authorization / errors / command identities — depends on T1202.
- T1205: Scene repository / data-access primitives — depends on T1203, T1204.
- T1206: Scene projection / artifact domain primitives — depends on T1204, T1205.
- T1207: Assessment start / resume — depends on T1205, T1206 and T1201 Slice 8 seam gate.
- T1208: Authorized Scene / node reads — depends on T1205, T1206.
- T1209: Canonical node-completion orchestration — depends on T1205, T1206.
- T1210: A1001 / 01002 / 01003 Evidence semantics — depends on T1209.
- T1211: A2001 / A1000 / A2002 / 01005 / 01006 triage — depends on T1210.
- T1212: 01004 / 01000 supplemental-assessment boundary — depends on T1211.
- T1213: A2003 / A200401 / A2004–A2009 — depends on T1211.
- T1214: A2007 timeline artifact without scheduler — depends on T1213.
- T1215: A2010 solution summary / downstream-unavailable boundary — depends on T1214.
- T1216: Authoritative Problem Formulation handoff — depends on T1209–T1215 and T1201 same-transaction seam PASS.
- T1217: Four public APIs / OpenAPI / generated client — depends on T1207, T1208, T1209, T1216.
- T1218: Idempotency / concurrency / atomicity / security hardening — depends on T1207–T1217.
- T1219: Full 36-scenario acceptance / no-model / scope / governance convergence — depends on T1218.
- T1220: Exact-head convergence and independent Audit 2 handoff — depends on T1219.

## T1201 — Development-start Authority / Dependency / Implement Gate

### Goal

Development-start Authority / Dependency / Implement Gate.

### Expected scope

- Read latest main, Frozen Spec, four Docs, Slice 8–11 audit/merge state and actual merged integration seams. No production write.

### Mandatory contracts

- All six implement-gate conditions must be proven remotely. Verify merged Slice 8 exposes an owner-approved caller-owned same-transaction StartAssessment/PresentProblemFormulation seam; otherwise STOP.

### Verification

- Record exact SHAs/blobs/merge evidence/import seams and classify drift. Gate failure stops all following tasks.

### Prerequisites

None.

## T1202 — Reconcile merged owner contracts and shared vocabularies

### Goal

Reconcile merged owner contracts and shared vocabularies.

### Expected scope

- Map merged Slice 8 phase/formulation seams, Slice 9 Drizzle/Safety, Slice 10 Compliance, Slice 11 manifest/router, and current Evidence/Case/idempotency/authorization/audit contracts.

### Mandatory contracts

- No duplicate owner abstraction. Reuse merged node-code type, same-client transaction, Evidence writers, idempotency and server-owned Compliance feature identity. Do not edit historical migrations.

### Verification

- Produce a development evidence map from each planned responsibility to actual merged symbols and next migration/shared vocab state.

### Prerequisites

T1201.

## T1203 — Scene persistence migration / Drizzle projection / RLS

### Goal

Scene persistence migration / Drizzle projection / RLS.

### Expected scope

- Add next-available additive SQL migration and typed schema for scene_node_states and scene_artifacts only, plus minimal shared vocab extensions actually required.

### Mandatory contracts

- Current-state uniqueness, package binding, Case/Family FK, A200401 DB-negative, append-only artifacts, ENABLE+FORCE RLS, least privilege, no Assessment/answer/workflow/scheduler/downstream tables.

### Verification

- Fresh + upgrade migration tests, schema/RLS/grant tests, cross-Family isolation, A200401 insert rejection, artifact immutability.

### Prerequisites

T1202.

## T1204 — Shared contracts / Authorization / errors / command identities

### Goal

Shared contracts / Authorization / errors / command identities.

### Expected scope

- Add request/response schemas, minimal Scene/Assessment authorization actions, shared error mappings and idempotency/event vocab extensions required by the four approved APIs.

### Mandatory contracts

- Participant presence alone grants no Assessment authority. No client nextNode/feature/package authority. Preserve anti-enumeration and existing Purpose semantics unless merged owner requires an approved extension.

### Verification

- Contract/domain authorization matrix and stable error tests; generated contract compatibility.

### Prerequisites

T1202.

## T1205 — Scene repository / data-access primitives

### Goal

Scene repository / data-access primitives.

### Expected scope

- Implement narrow same-transaction repository functions for current projection, CAS updates, artifacts, package binding and typed ref validation.

### Mandatory contracts

- No routing in repository, no business permission hidden in SQL, no direct duplicate Evidence writes, no second transaction, no ambiguous latest-row fallback.

### Verification

- Repository tests for normal/stale/missing/package mismatch/cross-Case ref/artifact append/A200401/rollback cases.

### Prerequisites

T1203, T1204.

## T1206 — Scene projection / artifact domain primitives

### Goal

Scene projection / artifact domain primitives.

### Expected scope

- Implement pure state transition, revision, typed-ref, A200401 marker, artifact revision, A2007 timeline, A2010 summary and downstream-unavailable builders.

### Mandatory contracts

- Consume Slice 11 node identity/router; artifacts are not Evidence truth; no generic DSL/state machine; deterministic no-model behavior.

### Verification

- Unit/domain deterministic tests including invalid refs, revision boundary, marker-only and summary provenance.

### Prerequisites

T1204, T1205.

## T1207 — Assessment start / resume

### Goal

Assessment start / resume.

### Expected scope

- Implement POST assessments service transaction: authorize/gate/resolve package/StartAssessment/resume/A1001 initialization/audit/idempotency.

### Mandatory contracts

- Current primary open Case only; INTAKE uses same-transaction StartAssessment; ASSESSMENT resumes; later phase never resets; no Assessment object/table; phase+A1001 are atomic.

### Verification

- Integration tests for first start, resume, replay/mismatch, non-primary, later phase, Safety/Compliance/Consent/package blocks and injected A1001 failure rollback.

### Prerequisites

T1205, T1206 and T1201 Slice 8 seam gate.

## T1208 — Authorized Scene / node reads

### Goal

Authorized Scene / node reads.

### Expected scope

- Implement GET scene and GET node current projections and authorized artifact visibility.

### Mandatory contracts

- Server state only; Manifest-known node; A200401/fabricated node rejected; participation alone grants no access; reads do not mutate.

### Verification

- Contract/integration/security tests for manager, wrong Family/Case/person/participant, artifact visibility and no-write behavior.

### Prerequisites

T1205, T1206.

## T1209 — Canonical node-completion orchestration

### Goal

Canonical node-completion orchestration.

### Expected scope

- Implement one bounded response transaction that composes owner gates, Evidence, Scene refs/artifacts, Slice 11 router, CAS, event/audit, optional formulation handoff and idempotency.

### Mandatory contracts

- Authorization before non-leaking replay; verify primary/phase/package/revision; Safety then Compliance; no client nextNode, default route or numeric adjacency; one transaction.

### Verification

- Service/integration tests for success, fabricated/unreachable node, invalid response, router BLOCKED/UNKNOWN, stale revision, replay and rollback.

### Prerequisites

T1205, T1206.

## T1210 — A1001 / 01002 / 01003 Evidence semantics

### Goal

A1001 / 01002 / 01003 Evidence semantics.

### Expected scope

- Implement node-specific validation and Evidence mapping for device/purpose/duration/impact/uncertainty/emotion/relationship responses.

### Mandatory contracts

- Broad devices; no under-six invented gate; historical bands auxiliary; no duration-only decision; 01002 max two/F priority; 01003 exactly one/F priority; reported answers do not become stronger truth.

### Verification

- Unit/service/integration tests for broad devices, purpose separation, Unknown/estimate, cardinality, priority and atomic invalid-input rollback.

### Prerequisites

T1209.

## T1211 — A2001 / A1000 / A2002 / 01005 / 01006 triage

### Goal

A2001 / A1000 / A2002 / 01005 / 01006 triage.

### Expected scope

- Implement integrated-evidence triage, approved advice projection and truthful severe-branch terminal/external behavior.

### Mandatory contracts

- No professional threshold invention; material Unknown/Conflict blocks fabricated certainty; duration/band alone insufficient; no fake second Scene/Referral/handoff.

### Verification

- Branch matrix tests for A2001/A2002 options, duration-only negatives, Unknown/Conflict and severe priority precedence.

### Prerequisites

T1210.

## T1212 — 01004 / 01000 supplemental-assessment boundary

### Goal

01004 / 01000 supplemental-assessment boundary.

### Expected scope

- Implement scoped accept/decline, approved category selection, boundary artifact and truthful approved-instrument-unavailable state.

### Mandatory contracts

- 01004 consent is isolated from guardian/other purposes. 01000 only 情绪测评 and 亲子互动模式测评; no invented item bank/scoring/diagnosis/model fallback.

### Verification

- Decline, consent-isolation, category, no-invention, missing-instrument, artifact provenance and no-false-completion tests.

### Prerequisites

T1211.

## T1213 — A2003 / A200401 / A2004–A2009

### Goal

A2003 / A200401 / A2004–A2009.

### Expected scope

- Map A2003 Evidence, A200401 marker metadata and A2004/A2005/A2006/A2008/A2009 decision branches.

### Mandatory contracts

- A200401 never node/route/state/endpoint. Missing stays missing. YES/NO-like semantics exact. Fallback branch preserves uncertainty; no silence-as-agreement or downstream activation.

### Verification

- Full branch table, Unknown provenance and A200401 negative GET/POST/state tests; no hidden default.

### Prerequisites

T1211.

## T1214 — A2007 timeline artifact without scheduler

### Goal

A2007 timeline artifact without scheduler.

### Expected scope

- Persist user-entered timeline as append-only user-visible Scene artifact and optional reminder-basis metadata.

### Mandatory contracts

- No case_followup_schedules, Plan/Task, pg-boss, notification scheduling/delivery claim or mandatory invented timing default.

### Verification

- Artifact readback/provenance/replay/correction tests plus static scheduler/job/notification negative.

### Prerequisites

T1213.

## T1215 — A2010 solution summary / downstream-unavailable boundary

### Goal

A2010 solution summary / downstream-unavailable boundary.

### Expected scope

- Generate deterministic user-viewable summary artifact and expose canonical route intent to A3000.

### Mandatory contracts

- Recorded approved data only; no A3000 state/work, FAMILY_ALLIANCE, Intervention, Goal or Plan activation; downstream remains unavailable while owner runtime absent.

### Verification

- Deterministic artifact, provenance, replay and no-A3000-state/static scope tests.

### Prerequisites

T1214.

## T1216 — Authoritative Problem Formulation handoff

### Goal

Authoritative Problem Formulation handoff.

### Expected scope

- Compose approved Assessment sufficiency with the merged Slice 8 caller-owned transaction seam and build candidate only from authoritative current Evidence.

### Mandatory contracts

- Preserve Evidence refs/Unknown/Conflict/dependencies; no direct SQL, formulation JSON or direct GOALS; formulation and Scene business result must be one transaction.

### Verification

- Integration/fault/race tests prove successful handoff, rollback on formulation failure, no half-commit and no GOALS before owner confirmation.

### Prerequisites

T1209–T1215 and T1201 same-transaction seam PASS.

## T1217 — Four public APIs / OpenAPI / generated client

### Goal

Four public APIs / OpenAPI / generated client.

### Expected scope

- Register exactly POST assessments, GET scene, GET node and POST node response; update schemas/OpenAPI/generated client.

### Mandatory contracts

- Authorization/RLS on every route; mutation idempotency/revision expectations; no A200401 addressability; no hidden/test/bypass/public gate-control route.

### Verification

- Route inventory, contract/error, OpenAPI generation and generated-client drift tests.

### Prerequisites

T1207, T1208, T1209, T1216.

## T1218 — Idempotency / concurrency / atomicity / security hardening

### Goal

Idempotency / concurrency / atomicity / security hardening.

### Expected scope

- Run retry/race/fault/security suites and make only in-scope remediation needed to satisfy frozen contracts.

### Mandatory contracts

- One legal winner; no stale success/last-write-wins/partial commit; owner gates and anti-enumeration remain authoritative; no replacement infrastructure.

### Verification

- Cover replay/mismatch, same-node/branch/primary/Safety/Consent/Compliance/package/formulation/artifact races, eight fault points, cross-Family/cross-Case/person/participant/visibility/purpose/client-authority attacks.

### Prerequisites

T1207–T1217.

## T1219 — Full 36-scenario acceptance / no-model / scope / governance convergence

### Goal

Full 36-scenario acceptance / no-model / scope / governance convergence.

### Expected scope

- Run named mechanical evidence for every Frozen acceptance scenario, deterministic full canonical fixture, scope guard and full repository regression.

### Mandatory contracts

- No LLM/RAG/network routing; no downstream runtime; changed-file proof shows no second Scene/manifest/Evidence/idempotency truth, workflow engine, scheduler or out-of-scope phase.

### Verification

- One-to-one acceptance evidence table 1–36, full fixture PASS, governance/static/full regression PASS on exact implementation head.

### Prerequisites

T1218.

## T1220 — Exact-head convergence and independent Audit 2 handoff

### Goal

Exact-head convergence and independent Audit 2 handoff.

### Expected scope

- Read-only final authority/diff/check revalidation and exact-head test execution.

### Mandatory contracts

- Frozen Spec/Docs unchanged; no historical migration rewrite; zero scope drift; all required CI/checks on same head; Development AI cannot self-declare merge-safe or merge main.

### Verification

- Record final head, merge-base/ahead/behind, Docs/Spec blobs, changed files and exact-head CI/suite results; output only READY FOR INDEPENDENT AUDIT 2.

### Prerequisites

T1219.

## Acceptance Evidence Contract

T1219 must preserve explicit mechanical evidence for all 36 Frozen scenarios:

1. A1001 broad device scope.
2. Under-six fidelity.
3. Purpose separation.
4. Duration-only negative.
5. 01002 cardinality.
6. 01002F priority.
7. 01003 cardinality.
8. 01003F priority.
9. A2001 advice path.
10. A2001 continue path.
11. A2002 further-assessment path.
12. 01004 decline.
13. 01004 consent isolation.
14. 01000 no invention.
15. A200401 negative node.
16. A2004 route fidelity.
17. Unknown provenance fidelity.
18. A2005/A2006/A2008/A2009 fidelity.
19. A2007 timeline artifact / no scheduler.
20. A2010 summary / no A3000 runtime.
21. Unknown/fabricated node.
22. Unreachable node.
23. Client nextNode attack.
24. Cross-Family.
25. Cross-Case Evidence.
26. Participant escalation.
27. Safety Hold.
28. Compliance block.
29. Idempotent replay.
30. Idempotency mismatch.
31. Concurrent node response.
32. Primary switch race.
33. Atomic injected failure.
34. PresentProblemFormulation handoff.
35. Full no-model canonical fixture.
36. Scope negative.

## Planning Freeze

Task Count: 20
Open Planning Decisions: 0
Scope Drift: 0
Implement Gate: BLOCKED
