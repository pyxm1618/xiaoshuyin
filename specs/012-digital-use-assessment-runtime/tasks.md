# Slice 12 Engineering Tasks — 012-digital-use-assessment-runtime

Repository: pyxm1618/xiaoshuyin
Role: Slice 12 Plan AI 2
Execution status: NOT STARTED — NARROW RECONCILED / AUDIT 1 FINAL PASS / IMPLEMENT GATE BLOCKED
Previous Frozen authority input: 5e397fee86eb29da1acc1a5a1d176e0c73aa8849 / e0ed342dc144fedf5b516b5295a23cbcc31722bc
Reconciliation baseline: bb9ae9ffae681ad7afd5ca014f91b402142b102d / PR #34 MERGED

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
- T1219: Full 36-scenario + 22 Integrated Triage authority acceptance / no-model / scope / governance convergence — depends on T1218.
- T1220: Exact-head convergence and independent Audit 2 handoff — depends on T1219.

## Frozen Spec Authority Map

Every task has explicit Frozen Spec authority. This map is normative for scope review; a task may not add behavior outside the listed FR/section authority.

| Task | Frozen Spec authority |
|---|---|
| T1201 | §23–§24 Dependencies / Future Implement Gate; FR-022 |
| T1202 | §6 Ownership; §10–§15 owner integration boundaries; FR-002, FR-014–FR-019, FR-022 |
| T1203 | §7 Scene Node State; §10 Authorization/RLS; §15 Atomicity; FR-001, FR-015, FR-019 |
| T1204 | §10–§13 Authorization/API/Idempotency; FR-004, FR-015–FR-017, FR-022 |
| T1205 | §6–§7 data truth; §10/§14/§15; FR-001, FR-003, FR-015, FR-018, FR-019 |
| T1206 | §7 state/artifact contract; §8.12–§8.13; FR-001, FR-012, FR-013, FR-019 |
| T1207 | §8.1 Assessment entry; §10–§15; FR-004, FR-015–FR-019 |
| T1208 | §7 / §10 / §12 read semantics; FR-001, FR-002, FR-015 |
| T1209 | §8 canonical runtime; §11–§15; FR-002, FR-003, FR-015–FR-019, FR-021 |
| T1210 | §8.2–§8.4; FR-005, FR-006 |
| T1211 | §8.5–§8.7 + Integrated Triage Authority; FR-007, FR-008, FR-020 |
| T1212 | §8.8 01004/01000 and §11.3 Consent; FR-009, FR-016, FR-020 |
| T1213 | §8.9–§8.11; FR-010, FR-011 |
| T1214 | §8.12; FR-012, FR-020 |
| T1215 | §8.13; FR-013, FR-020 |
| T1216 | §9 Problem Formulation Handoff; §15 Atomicity; FR-014, FR-019 |
| T1217 | §12 API Contract Surface; §16 Failure Semantics; FR-004, FR-015–FR-020 |
| T1218 | §10–§16 security/reliability contracts; FR-015–FR-019 |
| T1219 | §22 Acceptance Scenarios 1–36 + §22.1 Integrated Triage Authority Matrix 1–22; FR-001–FR-022 |
| T1220 | §24 Future Implement Gate / §26 Frozen Spec Gate; FR-022 |


## T1201 — Development-start Authority / Dependency / Implement Gate

### Goal

Development-start Authority / Dependency / Implement Gate.

### Expected scope

- Re-read fresh main, the reconciled Slice 12 planning authority, four Docs, merged Slice 8–11 owner seams, PR #33 Consent owner seam, and the approved 01004 disclosure-authority prerequisite. No production write occurs until every gate is PASS.

### Mandatory contracts

- Slice 8 Problem Formulation owner runtime and caller-owned same-transaction seam must still be present.
- Slice 9 Safety Hold, Slice 10 Compliance and Slice 11 manifest/router ownership must still be present and authoritative.
- Consent owner purpose-scoped 01004 seam must still be present; no second Consent truth may be created.
- An upstream-approved 01004 supplemental-assessment disclosure authority must exist and be consumable through the existing Consent seam.
- If the disclosure authority remains absent, STOP. Do not begin T1202 production reconciliation, migration or runtime work.

### Verification

- Record exact main SHA, Docs blobs, owner symbols, merge evidence and disclosure authority identity/reference/version/hash source.
- Current reconciliation result: all runtime owner dependencies PASS; approved 01004 disclosure authority FAILS / BLOCKS implementation.

### Prerequisites

None.


## T1202 — Reconcile merged owner contracts and shared vocabularies

### Goal

Reconcile merged owner contracts and shared vocabularies after T1201 opens the Implement Gate.

### Expected scope

- Map current merged Slice 8 phase/formulation seams, Slice 9 Safety/Data Access, Slice 10 Compliance, Slice 11 manifest/router, Evidence/Case/idempotency/authorization/audit contracts, and the PR #33 purpose-scoped Consent owner seam.
- Consume the upstream-approved 01004 disclosure authority proven by T1201; do not author or approve a substitute inside Slice 12.

### Mandatory contracts

- No duplicate owner abstraction.
- Reuse merged node-code type, caller-owned transaction seams, Evidence writers, recordPurposeScopedConsentDecision, idempotency and server-owned Compliance feature identity.
- Do not edit historical migrations.
- No local disclosure catalog/authority may be invented to bypass the T1201 blocker.

### Verification

- Produce a development evidence map from each Slice 12 responsibility to the exact merged owner symbol and current migration/shared vocabulary.
- Prove the approved 01004 disclosure authority is server-owned and external to Scene/Evidence truth.

### Prerequisites

T1201 PASS / Implement Gate OPEN.

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
- Provide T1211 with authoritative current Evidence states sufficient to classify Missing Family versus Conflict Family without creating a second Evidence store.

### Mandatory contracts

- Broad devices; no under-six invented gate; historical bands auxiliary; no duration-only decision.
- 01002 max two selections and 01003 exactly one selection; original responses remain Evidence.
- Preserve missing / no record / NOT_COLLECTED / DECLINED / UNKNOWN without usable current value / CONFLICTING / contradictory / mutually incompatible current Evidence as distinct authoritative states.
- Missing != Conflict; NOT_COLLECTED != Conflict; DECLINED != Conflict.
- Estimate with an explicit usable value remains collected Evidence and is not silently converted to UNKNOWN.
- T1210 MUST NOT decide A2001, A2002 or A2003 and MUST NOT own Integrated Triage outcome truth.

### Verification

- Unit/service/integration tests for broad devices, purpose separation, functional-impact dimensions, estimate/UNKNOWN, missing/no-record, NOT_COLLECTED, DECLINED, CONFLICTING/contradictory fixtures, 01002/01003 cardinality and atomic invalid-input rollback.
- Prove fixtures expose enough state for T1211 to classify Missing versus Conflict mechanically.

### Prerequisites

T1209.


## T1211 — A2001 / A1000 / A2002 / 01005 / 01006 triage

### Goal

A2001 / A1000 / A2002 / 01005 / 01006 triage.

### Expected scope

- Implement one pure deterministic Integrated Triage evaluator over authoritative current Evidence.
- Derive only the approved predicates and emit at most one normal Integrated Triage condition, or one priority/fail-closed result.
- Project approved A1000 advice and truthful 01005/01006 terminal/external behavior without a second Scene or Referral truth.

### Mandatory contracts

- Compute only approved predicates: EMOTION_F, FAMILY_CONFLICT_F, DIRECT_DIGITAL_USE_IMPACT_POSITIVE, DIRECT_DIGITAL_USE_IMPACT_NEGATIVE, OTHER_NEEDS_POSITIVE, CLEAN_NON_DIGITAL_USE_STATE, MATERIAL_UNRESOLVED, OTHER_NEEDS_MATERIAL_UNRESOLVED.
- 01002 Missing Family: missing / no record / NOT_COLLECTED / DECLINED / required Evidence absent with no approved substitute, or UNKNOWN without usable current F value → INSUFFICIENT.
- 01002 Conflict Family: existing route-driving Evidence is CONFLICTING, contradictory, mutually incompatible, invalid/incompatible or cannot be safely parsed → BLOCKED.
- Valid 01002F → 01005. Only valid 01002 non-F proceeds to 01003.
- 01003 uses the same Missing-versus-Conflict classification after 01002F=false; valid 01003F → 01006.
- Both valid F → 01005 wins; preserve 01003F Evidence; no second normal outcome.
- Required direct-impact Missing Family → INSUFFICIENT.
- Existing route-driving direct-impact Conflict that prevents a safe positive/negative conclusion → BLOCKED.
- A2003 initial triage requires DIRECT_DIGITAL_USE_IMPACT_POSITIVE or other approved current Evidence explicitly supporting continuation of the current Digital Use problem.
- A2002 requires DIRECT_DIGITAL_USE_IMPACT_NEGATIVE plus OTHER_NEEDS_POSITIVE or OTHER_NEEDS_MATERIAL_UNRESOLVED.
- A2001 requires CLEAN_NON_DIGITAL_USE_STATE plus no material unresolved.
- No provable normal predicate → INSUFFICIENT.
- A2001/A2002/A2003 are mutually exclusive. Multiple normal predicates / invalid ambiguity fail closed as BLOCKED rather than selecting by order.
- No professional threshold invention.
- No duration-only or historical-band-only route.
- No default fallthrough or absence-based inference.
- No LLM / RAG / network classifier / client route truth.
- Missing != Conflict; NOT_COLLECTED != Conflict; DECLINED != Conflict.
- Evaluator reads existing Evidence truth only; no second Evidence store.
- A2001/A2002 downstream user choice to continue to A2003 is not part of the initial triage evaluator truth.

### Verification

- Mechanical branch matrix covers at least:
  - 01002 missing / NOT_COLLECTED / DECLINED / UNKNOWN-without-value → INSUFFICIENT;
  - 01002 Conflict → BLOCKED;
  - 01002F only → 01005;
  - after valid 01002 non-F, 01003 missing / NOT_COLLECTED / DECLINED / UNKNOWN-without-value → INSUFFICIENT;
  - 01003 Conflict → BLOCKED;
  - 01003F only → 01006;
  - both-F → 01005 and preserve 01003F;
  - direct-impact Missing → INSUFFICIENT;
  - direct-impact Conflict → BLOCKED;
  - duration-only → INSUFFICIENT;
  - clean low-impact → A2001;
  - negative direct impact + other-needs positive → A2002;
  - negative direct impact + other-needs material unresolved → A2002;
  - positive direct impact → A2003;
  - positive direct impact + non-severe other-needs → A2003 with Evidence preservation;
  - no normal predicate provable → INSUFFICIENT;
  - no default fallthrough;
  - repeated identical fixture without model/network dependency → identical outcome.
- Explicitly prove zero LLM/RAG/network-classifier route calls.

### Prerequisites

T1210.


## T1212 — 01004 / 01000 supplemental-assessment boundary

### Goal

01004 / 01000 supplemental-assessment boundary.

### Expected scope

- Implement scoped accept/decline through the authoritative Consent owner, consuming the upstream-approved 01004 disclosure authority proven at T1201.
- Implement approved category selection, boundary artifact and truthful approved-instrument-unavailable state.

### Mandatory contracts

- 01004 consent is an authoritative DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT Consent record/result in the existing Consent owner; Scene state may reference it but cannot own it.
- Use the merged recordPurposeScopedConsentDecision seam and exact approved server-owned disclosure reference/version/hash.
- No second consent table/state machine and no Slice 12 private disclosure authority/catalog.
- If the approved disclosure authority is absent or rejects the submitted identity, fail closed; do not fabricate a disclosure or mark 01004 complete.
- 01000 only 情绪测评 and 亲子互动模式测评; no invented item bank/scoring/diagnosis/model fallback.

### Verification

- Accept/decline persistence through the Consent owner, disclosure-approval fail-closed behavior, consent isolation, refusal auditability, category, no-invention, missing-instrument, artifact provenance and no-false-completion tests.

### Prerequisites

T1211 and T1201 approved 01004 disclosure-authority gate PASS.


## T1213 — A2003 / A200401 / A2004–A2009

### Goal

A2003 / A200401 / A2004–A2009.

### Expected scope

- Keep A2003 content collection unchanged: expected duration, reason, prior methods, observed effect and difficulty.
- Map A200401 marker metadata and A2004/A2005/A2006/A2008/A2009 decision branches.
- Preserve the distinction between initial Integrated Triage entry to A2003 and a later explicit A2001/A2002 user choice to continue the current Digital Use problem.

### Mandatory contracts

- A200401 never node/route/state/endpoint.
- Missing stays missing; YES/NO-like semantics exact; fallback preserves uncertainty.
- No silence-as-agreement or downstream activation.
- Initial A2003 route truth is owned by T1211 positive Digital Use Evidence.
- A later user choice from A2001/A2002 to continue is a downstream user-decision route only; it MUST NOT be back-written as DIRECT_DIGITAL_USE_IMPACT_POSITIVE or other initial triage Evidence.

### Verification

- Full branch table, Unknown provenance and A200401 negative GET/POST/state tests.
- Test initial A2003 and downstream-user-choice A2003 as distinct route reasons with no truth conflation and no hidden default.

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


## T1219 — Full 36-scenario + 22 Integrated Triage authority acceptance / no-model / scope / governance convergence

### Goal

Full 36-scenario + 22 Integrated Triage authority acceptance / no-model / scope / governance convergence.

### Expected scope

- Run named mechanical evidence for every original Frozen acceptance scenario plus every PR #34 Integrated Triage Authority matrix case.
- Run deterministic full canonical fixture, scope guard and full repository regression.

### Mandatory contracts

- 58/58 acceptance cases have one-to-one mechanical evidence.
- No LLM/RAG/network routing truth; no downstream runtime.
- Identical authoritative Evidence fixtures repeat to identical triage outcome without model/network dependency.
- Missing Family and Conflict Family fixtures are mechanically distinguishable.
- A2001/A2002/A2003 are mutually exclusive; no hidden default.
- Changed-file proof shows no second Scene/manifest/Evidence/idempotency/Consent truth, workflow engine, scheduler or out-of-scope phase.

### Verification

- One-to-one acceptance evidence table for original 1–36 plus Integrated Triage 1–22.
- Full fixture PASS, governance/static/full regression PASS on exact implementation head.

### Prerequisites

T1218.

## T1220 — Exact-head convergence and independent Audit 2 handoff

### Goal

Exact-head convergence and independent Audit 2 handoff.

### Expected scope

- Read-only final authority/diff/check revalidation and exact-head test execution.

### Mandatory contracts

- Reconciled Slice 12 Spec/Plan/Checklist/Tasks and authoritative Docs remain unchanged from the development-start baseline; no historical migration rewrite; zero scope drift; all required CI/checks on same head; Development AI cannot self-declare merge-safe or merge main.

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

### Integrated Triage Authority acceptance — 22 additional cases

37. 01002F only → 01005.
38. 01003F only after valid 01002 non-F → 01006.
39. Both F → 01005, preserve 01003F, no second outcome.
40. 01002 missing → INSUFFICIENT.
41. 01002 NOT_COLLECTED → INSUFFICIENT.
42. 01002 DECLINED → INSUFFICIENT.
43. 01002 conflicting / CONFLICTING / incompatible → BLOCKED.
44. 01003 missing after valid 01002 non-F → INSUFFICIENT.
45. 01003 NOT_COLLECTED after valid 01002 non-F → INSUFFICIENT.
46. 01003 DECLINED after valid 01002 non-F → INSUFFICIENT.
47. 01003 conflicting / CONFLICTING / incompatible after valid 01002 non-F → BLOCKED.
48. Duration-only → INSUFFICIENT.
49. Clean low-impact → A2001.
50. Other-needs positive + negative direct impact → A2002.
51. Other-needs material unresolved + negative direct impact → A2002.
52. Positive direct Digital Use impact → A2003.
53. Positive direct Digital Use impact + non-severe other-needs → A2003 and preserve other-needs Evidence.
54. Direct-impact required Evidence missing / NOT_COLLECTED / DECLINED / UNKNOWN-without-usable-value → INSUFFICIENT.
55. Existing route-driving direct-impact conflict / incompatible facts → BLOCKED.
56. No provable normal predicate → INSUFFICIENT.
57. No default fallthrough / no absence-based normal outcome.
58. Repeat identical fixture with no model/network dependency → deterministic identical outcome.

## Planning Freeze

Task Count: 20
FR Coverage: 22/22
Acceptance Coverage: 58/58
Open Product Decisions: 0
Open Planning Decisions: 0
Scope Drift: 0
Production Code Mutation: 0
Audit 1: FINAL PASS
Implement Gate: BLOCKED — APPROVED 01004 DISCLOSURE AUTHORITY ABSENT
