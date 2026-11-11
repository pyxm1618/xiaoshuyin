# Slice 13 Engineering Tasks — 013-digital-use-family-alliance-runtime

These are future development tasks. Plan AI 2 does not execute them. T1301 is a hard gate; T1302+ are forbidden until T1301 PASS.

## T1301 — Development-start Authority / Implement Gate

**Goal**  
Prove development may start; otherwise stop before any production edit.

**Expected Scope**  
Re-read then-current origin/main, four Docs blobs, Slice 13 Frozen Spec blob, Slice 8/9/10/11/12 merge/audit state, migration list, open PRs and planning/runtime seams. Record semantic vs dependency execution vs repository drift.

**Mandatory Contracts**  
Slice 13 §24. Required owners must exist on main: Slice 8 Problem Formulation, Slice 9 Safety, Slice 10 Compliance, Slice 11 Manifest/router, Slice 12 Assessment/Scene runtime. No fallback owner may be created.

**Verification**  
Remote SHA/blob evidence; exact merge/audit evidence; compare migration order; verify Slice 13 spec unchanged; STOP on any missing owner or semantic drift.

**Prerequisites**  
None. This is the only first development task.

**Frozen Spec Authority**  
Frozen Spec §§23-24, §29; S13-FR-034.

**Acceptance / Evidence Ownership**  
Gate evidence only; no acceptance scenario may be executed before PASS.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1302 — Reconcile merged owner seams and transaction contracts

**Goal**  
Bind Slice 13 to actual merged interfaces without duplicating upstream truth.

**Expected Scope**  
Inspect merged symbols for Problem Formulation read/gate, Safety ordinary-progression guard, Compliance snapshot/evaluator/supported-obligation guard, Consent validation/version, Slice 11 manifest/router, Slice 12 Scene repository/artifact/API transaction seam, Evidence writers and existing idempotency/audit.

**Mandatory Contracts**  
Use owners as-is. If same-transaction/caller-owned composition required by Slice 13 is absent and cannot be achieved by a non-semantic owner-approved extraction, STOP. No direct SQL mutation of problem_formulations, Safety, Compliance, Consent or Assessment owner truth.

**Verification**  
Static dependency map + compile-time imports + explicit owner-seam inventory; no second policy/router/evidence/idempotency state.

**Prerequisites**  
T1301 PASS.

**Frozen Spec Authority**  
Frozen Spec §§6,10,11,12,16,23-24; S13-FR-002/011/019-024.

**Acceptance / Evidence Ownership**  
Mapped through the Frozen Requirement/Acceptance matrices in plan.md.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1303 — Additive Family Alliance target-item persistence, migration and RLS

**Goal**  
Add the minimum persistent Scene-specific target-item revision model while extending, not replacing, Slice 12 Scene persistence.

**Expected Scope**  
Create one additive migration `<reconciled-next>_digital_use_family_alliance_runtime.sql` after T1301 migration reconciliation. Add `digital_use_target_items` append/supersede revision rows; reuse `scene_node_states` and `scene_artifacts` unchanged except narrowly required shared vocabulary/index changes.

**Mandatory Contracts**  
No family_alliance_answers, goals, tasks, checkins, outcomes or second Scene tables. Target-item current uniqueness is one non-superseded row per Case+target_code. Full A3002 selection revision is atomic and traceable. ENABLE/FORCE RLS; Family hard boundary; runtime NOBYPASSRLS; no normal DELETE/TRUNCATE.

**Verification**  
Clean bootstrap + upgrade migration + replay/second-apply behavior + schema constraints + partial/current uniqueness + RLS/grants + wrong/no context denial + rollback on migration failure.

**Prerequisites**  
T1301,T1302.

**Frozen Spec Authority**  
Frozen Spec §§7.2,10.3,14,15,19,20; S13-FR-012/014/018/027.

**Acceptance / Evidence Ownership**  
Mapped through the Frozen Requirement/Acceptance matrices in plan.md.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1304 — Shared contracts, command identity and error vocabulary

**Goal**  
Freeze DTOs and command/error semantics for Family Alliance without adding per-node endpoints.

**Expected Scope**  
Extend merged Slice 12 Scene response contract with FAMILY_ALLIANCE node payload discriminators, expected node/target/list/package revisions, server-owned route metadata and target projections. Reuse existing Scene mutation command/idempotency namespace where semantically identical; otherwise add one bounded Family Alliance Scene-response command identity, not per-node identities.

**Mandatory Contracts**  
No client nextNode authority; no client Family/package/compliance feature selection; stable errors distinguish anti-enumerated scope, validation, fabricated/unreachable node, stale revisions, Safety, Compliance, Consent, dependency unavailable, concurrent conflict and infrastructure failure.

**Verification**  
Schema/contract tests + generated OpenAPI check with zero route-count expansion unless T1301 proves merged Slice 12 lacks the approved generic Scene operation.

**Prerequisites**  
T1302.

**Frozen Spec Authority**  
Frozen Spec §§17,21-22; S13-FR-025/029-031.

**Acceptance / Evidence Ownership**  
Mapped through the Frozen Requirement/Acceptance matrices in plan.md.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1305 — Target-item repository and authorized projection primitives

**Goal**  
Provide narrow same-transaction reads/writes for current target revisions and user-visible projections.

**Expected Scope**  
Implement repository functions for current target set, current target item, insert-next revision, supersede-current metadata, full A3002 selection snapshot, source/Evidence/artifact reference validation and authorized projection reads.

**Mandatory Contracts**  
All refs same Family/Case/purpose; expected revisions are CAS inputs; no destructive substantive UPDATE; no raw private Evidence duplication; target-list projection derives from current target-item revisions rather than a second list truth.

**Verification**  
Repository tests for first write/revision/reselection, target history, cross-Case refs, current uniqueness, stale CAS, RLS and transaction rollback.

**Prerequisites**  
T1303,T1304.

**Frozen Spec Authority**  
Frozen Spec §§10,13-15,18-20; S13-FR-011-014/018/026-028.

**Acceptance / Evidence Ownership**  
Mapped through the Frozen Requirement/Acceptance matrices in plan.md.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1306 — Canonical Family Alliance node execution orchestration

**Goal**  
Create one bounded server orchestration for A3000-A3113 responses that consumes Manifest routing and all independent gates.

**Expected Scope**  
Implement one execution path around merged generic Scene response service. Transaction order: authorize/RLS scope → idempotency acquisition → read expected Case/package/node/target basis → validate current primary/open Case → Consent owner check → Compliance owner evaluation/capability guard → Safety ordinary-progression guard → Manifest-known/reachable node + node payload validation → Evidence/target/artifact writes → pure router → CAS Scene/target revisions → audit/event → final owner-version/gate revalidation needed for races → idempotency success → commit.

**Mandatory Contracts**  
Router/topology remains Slice 11; business handlers own only node semantics. A2010 intent cannot bypass Problem Formulation. No nested transaction, second checked-out client, external network, LLM or hidden route fallback. Mutable authority versions/tokens must be revalidated before commit; if merged owners cannot provide safe revalidation, STOP.

**Verification**  
Service/integration tests for gate order, fabricated/unreachable node, no client nextNode, owner calls, route reasons, rollback, dependency/infrastructure propagation.

**Prerequisites**  
T1302-T1305.

**Frozen Spec Authority**  
Frozen Spec §§11-12,16-19,21; S13-FR-003/019-027/030.

**Acceptance / Evidence Ownership**  
Mapped through the Frozen Requirement/Acceptance matrices in plan.md.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1307 — A3000 Family Alliance principles/self-assessment runtime

**Goal**  
Implement A3000 faithfully as repeatable, source-attributed and non-blocking.

**Expected Scope**  
Present approved/versioned Family Alliance content; record substantive user answers through Evidence owner; persist a bounded `FAMILY_ALLIANCE_SELF_ASSESSMENT` Scene artifact containing content/schema version, Evidence refs and display projection; advance A3000 node revision. Reassessment appends new Evidence/artifact revision.

**Mandatory Contracts**  
No score/cutoff may block continuation. Prior assessments remain. No Goal/Plan/InterventionInstance. Re-route only through current Manifest after reassessment; no downstream reset.

**Verification**  
AS-01/02/03, correction/reassessment tests, provenance/history tests, scope-negative Goal/Plan checks.

**Prerequisites**  
T1306.

**Frozen Spec Authority**  
Frozen Spec §§9.2,14.2,20.2,25.1; S13-FR-004/028.

**Acceptance / Evidence Ownership**  
Mapped through the Frozen Requirement/Acceptance matrices in plan.md.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1308 — A3001 communication-preparation runtime and parallel availability

**Goal**  
Implement A3001 professional preparation semantics without serializing A3002.

**Expected Scope**  
Serve approved/versioned communication-preparation content and record only Manifest-required user input/state/Evidence refs. Node state is independent from A3002/target feasibility. Persist no new artifact unless Manifest record contract requires a user-saveable output.

**Mandatory Contracts**  
A3001 completion is never a prerequisite invented for A3002; A3002 completion never completes A3001. No free-model content.

**Verification**  
AS-04 plus parallel availability/read projection tests and static check that no A3001→A3002 hard prerequisite is introduced outside Manifest.

**Prerequisites**  
T1306.

**Frozen Spec Authority**  
Frozen Spec §§9.3,14.6,25.1; S13-FR-005.

**Acceptance / Evidence Ownership**  
Mapped through the Frozen Requirement/Acceptance matrices in plan.md.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1309 — A3002 Target List selection, management and re-selection

**Goal**  
Implement the canonical Target List as a Scene target artifact, not Common Core Goal.

**Expected Scope**  
Validate exactly the ten canonical target codes; on submit/reselect create one coherent selection revision by inserting a new revision for each canonical target item in one transaction, keyed to the new A3002 node revision; preserve all prior item/progress revisions. Provide authorized current projection and historical references.

**Mandatory Contracts**  
No goals row, Goal aggregate/status, destructive progress reassignment or fabricated target. User can select/confirm/submit/manage/evaluate/record/reselect only within Manifest/product contract.

**Verification**  
AS-05/06/14/41; full-set atomicity; stale selection revision; deselect/reselect history; idempotent replay.

**Prerequisites**  
T1305,T1306.

**Frozen Spec Authority**  
Frozen Spec §§9.4,14.3,20.3,25; S13-FR-006.

**Acceptance / Evidence Ownership**  
Mapped through the Frozen Requirement/Acceptance matrices in plan.md.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1310 — Shared target-family semantic primitives

**Goal**  
Implement minimal reusable target/feasibility/progress/help primitives without collapsing family-specific semantics.

**Expected Scope**  
Create bounded pure validators/builders for TARGET, FEASIBILITY, PROGRESS and HELP roles. Feasibility schema preserves five approved dimensions; progress payload remains node-specific and Scene-level; help records content/version/history refs. Handler dispatch may identify node-specific semantics but contains no allowedNext/prerequisite/parallel topology.

**Mandatory Contracts**  
No universal feasibility score, no generic workflow/questionnaire engine, no Phase 4 Task/Checkin/Outcome, no second manifest/route table. UNKNOWN/NOT_COLLECTED/DECLINED/CONFLICT remain distinct.

**Verification**  
Domain tests for each role + negative threshold/scoring imports + handler/topology static guard.

**Prerequisites**  
T1306,T1309.

**Frozen Spec Authority**  
Frozen Spec §§9.5,13-14,26; S13-FR-007/015-017/032-033.

**Acceptance / Evidence Ownership**  
Mapped through the Frozen Requirement/Acceptance matrices in plan.md.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1311 — SLEEP canonical family runtime (A3010/A3011/A3012/A3013)

**Goal**  
Implement the SLEEP target family's exact canonical target → feasibility → progress → help semantics.

**Expected Scope**  
Implement A3010, A3011, A3012, A3013 using shared primitives plus the family-specific approved interaction/content references. Target node updates target-item semantics; feasibility records the five approved dimensions; progress records Scene-level progress/Evidence refs; help uses Manifest-approved help/re-entry.

**Mandatory Contracts**  
No node renumbering, numeric adjacency, invented thresholds, Task/Checkin/Outcome, or cross-family semantic compression.   

**Verification**  
Canonical path integration test for A3010 → A3011 → A3012 → A3013; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard.

**Prerequisites**  
T1310.

**Frozen Spec Authority**  
Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007.

**Acceptance / Evidence Ownership**  
AS-07/08/09 + HX-12.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1312 — EXERCISE canonical family runtime (A3020/A3021/A3022/A3033)

**Goal**  
Implement the EXERCISE target family's exact canonical target → feasibility → progress → help semantics.

**Expected Scope**  
Implement A3020, A3021, A3022, A3033 using shared primitives plus the family-specific approved interaction/content references. Target node updates target-item semantics; feasibility records the five approved dimensions; progress records Scene-level progress/Evidence refs; help uses Manifest-approved help/re-entry.

**Mandatory Contracts**  
No node renumbering, numeric adjacency, invented thresholds, Task/Checkin/Outcome, or cross-family semantic compression. A3033 is the help node; A3023/A3030/A3031/A3032 must not exist.  

**Verification**  
Canonical path integration test for A3020 → A3021 → A3022 → A3033; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard. Sparse-number negative fixture included.

**Prerequisites**  
T1310.

**Frozen Spec Authority**  
Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007/008.

**Acceptance / Evidence Ownership**  
AS-07/08/09/11 + HX-12.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1313 — HOBBIES canonical family runtime (A3040/A3041/A3042/A3043)

**Goal**  
Implement the HOBBIES target family's exact canonical target → feasibility → progress → help semantics.

**Expected Scope**  
Implement A3040, A3041, A3042, A3043 using shared primitives plus the family-specific approved interaction/content references. Target node updates target-item semantics; feasibility records the five approved dimensions; progress records Scene-level progress/Evidence refs; help uses Manifest-approved help/re-entry.

**Mandatory Contracts**  
No node renumbering, numeric adjacency, invented thresholds, Task/Checkin/Outcome, or cross-family semantic compression.   

**Verification**  
Canonical path integration test for A3040 → A3041 → A3042 → A3043; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard.

**Prerequisites**  
T1310.

**Frozen Spec Authority**  
Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007.

**Acceptance / Evidence Ownership**  
AS-07/08/09 + HX-12.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1314 — CHORES canonical family runtime (A3050/A3051/A3052/A3053)

**Goal**  
Implement the CHORES target family's exact canonical target → feasibility → progress → help semantics.

**Expected Scope**  
Implement A3050, A3051, A3052, A3053 using shared primitives plus the family-specific approved interaction/content references. Target node updates target-item semantics; feasibility records the five approved dimensions; progress records Scene-level progress/Evidence refs; help uses Manifest-approved help/re-entry.

**Mandatory Contracts**  
No node renumbering, numeric adjacency, invented thresholds, Task/Checkin/Outcome, or cross-family semantic compression.   

**Verification**  
Canonical path integration test for A3050 → A3051 → A3052 → A3053; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard.

**Prerequisites**  
T1310.

**Frozen Spec Authority**  
Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007.

**Acceptance / Evidence Ownership**  
AS-07/08/09 + HX-12.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1315 — FAMILY_GATHERING canonical family runtime (A3060/A3061/A3062/A3063)

**Goal**  
Implement the FAMILY_GATHERING target family's exact canonical target → feasibility → progress → help semantics.

**Expected Scope**  
Implement A3060, A3061, A3062, A3063 using shared primitives plus the family-specific approved interaction/content references. Target node updates target-item semantics; feasibility records the five approved dimensions; progress records Scene-level progress/Evidence refs; help uses Manifest-approved help/re-entry.

**Mandatory Contracts**  
No node renumbering, numeric adjacency, invented thresholds, Task/Checkin/Outcome, or cross-family semantic compression.   

**Verification**  
Canonical path integration test for A3060 → A3061 → A3062 → A3063; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard.

**Prerequisites**  
T1310.

**Frozen Spec Authority**  
Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007.

**Acceptance / Evidence Ownership**  
AS-07/08/09 + HX-12.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1316 — OUTDOOR_ACTIVITY canonical family runtime (A3070/A3071/A3072/A3073)

**Goal**  
Implement the OUTDOOR_ACTIVITY target family's exact canonical target → feasibility → progress → help semantics.

**Expected Scope**  
Implement A3070, A3071, A3072, A3073 using shared primitives plus the family-specific approved interaction/content references. Target node updates target-item semantics; feasibility records the five approved dimensions; progress records Scene-level progress/Evidence refs; help uses Manifest-approved help/re-entry.

**Mandatory Contracts**  
No node renumbering, numeric adjacency, invented thresholds, Task/Checkin/Outcome, or cross-family semantic compression.   

**Verification**  
Canonical path integration test for A3070 → A3071 → A3072 → A3073; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard.

**Prerequisites**  
T1310.

**Frozen Spec Authority**  
Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007.

**Acceptance / Evidence Ownership**  
AS-07/08/09 + HX-12.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1317 — EMOTION_REGULATION_1 canonical family runtime (A3080/A3081/A3082/A3083)

**Goal**  
Implement the EMOTION_REGULATION_1 target family's exact canonical target → feasibility → progress → help semantics.

**Expected Scope**  
Implement A3080, A3081, A3082, A3083 using shared primitives plus the family-specific approved interaction/content references. Target node updates target-item semantics; feasibility records the five approved dimensions; progress records Scene-level progress/Evidence refs; help uses Manifest-approved help/re-entry.

**Mandatory Contracts**  
No node renumbering, numeric adjacency, invented thresholds, Task/Checkin/Outcome, or cross-family semantic compression.   

**Verification**  
Canonical path integration test for A3080 → A3081 → A3082 → A3083; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard.

**Prerequisites**  
T1310.

**Frozen Spec Authority**  
Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007.

**Acceptance / Evidence Ownership**  
AS-07/08/09 + HX-12.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1318 — TIME_MANAGEMENT canonical family runtime (A3090/A3091/A3092/A3093)

**Goal**  
Implement the TIME_MANAGEMENT target family's exact canonical target → feasibility → progress → help semantics.

**Expected Scope**  
Implement A3090, A3091, A3092, A3093 using shared primitives plus the family-specific approved interaction/content references. Target node updates target-item semantics; feasibility records the five approved dimensions; progress records Scene-level progress/Evidence refs; help uses Manifest-approved help/re-entry.

**Mandatory Contracts**  
No node renumbering, numeric adjacency, invented thresholds, Task/Checkin/Outcome, or cross-family semantic compression.  A3090-A3093 must remain canonical. 

**Verification**  
Canonical path integration test for A3090 → A3091 → A3092 → A3093; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard. A3090-A3093 retention fixture included.

**Prerequisites**  
T1310.

**Frozen Spec Authority**  
Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007/009.

**Acceptance / Evidence Ownership**  
AS-07/08/09/12 + HX-12.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1319 — FAMILY_RELATIONSHIP canonical family runtime (A3100/A3101/A3102/A3103)

**Goal**  
Implement the FAMILY_RELATIONSHIP target family's exact canonical target → feasibility → progress → help semantics.

**Expected Scope**  
Implement A3100, A3101, A3102, A3103 using shared primitives plus the family-specific approved interaction/content references. Target node updates target-item semantics; feasibility records the five approved dimensions; progress records Scene-level progress/Evidence refs; help uses Manifest-approved help/re-entry.

**Mandatory Contracts**  
No node renumbering, numeric adjacency, invented thresholds, Task/Checkin/Outcome, or cross-family semantic compression.   

**Verification**  
Canonical path integration test for A3100 → A3101 → A3102 → A3103; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard.

**Prerequisites**  
T1310.

**Frozen Spec Authority**  
Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007.

**Acceptance / Evidence Ownership**  
AS-07/08/09 + HX-12.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1320 — EMOTION_REGULATION_2 canonical family runtime (A3110/A3111/A3112/A3113)

**Goal**  
Implement the EMOTION_REGULATION_2 target family's exact canonical target → feasibility → progress → help semantics.

**Expected Scope**  
Implement A3110, A3111, A3112, A3113 using shared primitives plus the family-specific approved interaction/content references. Target node updates target-item semantics; feasibility records the five approved dimensions; progress records Scene-level progress/Evidence refs; help uses Manifest-approved help/re-entry.

**Mandatory Contracts**  
No node renumbering, numeric adjacency, invented thresholds, Task/Checkin/Outcome, or cross-family semantic compression.   A3111 must remain reachable feasibility and must not be auto-skipped or scored by invented professional rules.

**Verification**  
Canonical path integration test for A3110 → A3111 → A3112 → A3113; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard. A3111 reachability + no-threshold fixture included.

**Prerequisites**  
T1310.

**Frozen Spec Authority**  
Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007/010.

**Acceptance / Evidence Ownership**  
AS-07/08/09/13 + HX-12.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1321 — Parallel projection, help/re-entry and correction integration

**Goal**  
Make parallel/re-entry semantics observable and history-safe across the whole stream.

**Expected Scope**  
GET Scene projection exposes independent reachable/active node states rather than a single serial cursor. Re-entry validates Manifest mode/references and all current gates. A3000 reassessment, A3002 reselection and target help/progress updates recompute reachability without global reset. Downstream A4001/A5001 availability is represented only as unavailable/route boundary when runtime absent.

**Mandatory Contracts**  
No all-targets-complete global rule; no branch completes another; no direct SQL rewind; no old Evidence/artifact deletion; no A400/A500 runtime.

**Verification**  
AS-04/06/09/18/19/38/39/40 plus re-entry vs current-write and partial-completion tests.

**Prerequisites**  
T1307-T1320.

**Frozen Spec Authority**  
Frozen Spec §§9.3,11.2,14.6,20,25.7; S13-FR-005/017/028/033.

**Acceptance / Evidence Ownership**  
Mapped through the Frozen Requirement/Acceptance matrices in plan.md.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1322 — Scene API/OpenAPI extension and server-authoritative route projection

**Goal**  
Expose Family Alliance through the minimum existing Scene API surface.

**Expected Scope**  
Reuse merged Slice 12 GET scene, GET scene node and POST scene node response operations. Do not add a Family Alliance endpoint family. Extend response projection with authorized target-list/items, expected revision tokens, active/reachable node set, server-owned route reason/entry mode and downstream availability. Update generated OpenAPI only for these schema extensions.

**Mandatory Contracts**  
No public policy/router API; client cannot choose nextNode, Family, package, source node, target outside canonical set or feature-policy result. Unknown/fabricated/unreachable node and dependency unavailable remain distinct.

**Verification**  
Contract/OpenAPI tests; route-count assertion; client-nextNode attack; fabricated node; stable error mapping; no hidden bypass route.

**Prerequisites**  
T1304,T1306,T1321.

**Frozen Spec Authority**  
Frozen Spec §§12,21; S13-FR-024/029-030.

**Acceptance / Evidence Ownership**  
Mapped through the Frozen Requirement/Acceptance matrices in plan.md.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1323 — Authorization, RLS and security-negative hardening

**Goal**  
Prove Family/Case/primary/participant/purpose boundaries at application and DB layers.

**Expected Scope**  
Reuse existing authorize actions where sufficient; add only minimum Scene action vocabulary if merged owner lacks it, never a new role. Apply target-table RLS. Validate every client ID/ref under authorized scope. Exercise current-primary mutation boundary and anti-enumeration.

**Mandatory Contracts**  
Family membership alone is insufficient; participant presence alone is insufficient; child source cannot be fabricated; cross-Family/cross-Case refs fail; route result grants no authorization.

**Verification**  
AS-14/20-24 plus no-context RLS, wrong Family, wrong Case, wrong participant, wrong primary, purpose mismatch and enumeration-safe response tests.

**Prerequisites**  
T1303,T1305,T1306.

**Frozen Spec Authority**  
Frozen Spec §15, §16.1, §25.4; S13-FR-018.

**Acceptance / Evidence Ownership**  
Mapped through the Frozen Requirement/Acceptance matrices in plan.md.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1324 — Idempotency, concurrency, gate-race and atomicity hardening

**Goal**  
Mechanically prove no stale success, duplicate business result, last-write-wins or partial commit.

**Expected Scope**  
Add replay/mismatch, same-node, A3001/A3002 parallel, same-target, reselection-vs-progress, A3000-vs-downstream, primary switch, Safety, Compliance, Consent, package drift and re-entry races. Add fault injection after each business-effect class through idempotency completion.

**Mandatory Contracts**  
One current node/target truth; legal independent parallel operations may coexist; same aggregate uses expected revision/CAS; final mutable-authority revalidation is mandatory. Business result and idempotency success commit together.

**Verification**  
AS-25-38 and HX-01..HX-09/HX-11/HX-15; repeat fault suite proves zero residue across Evidence, target, Scene state, artifact, audit/event and idempotency.

**Prerequisites**  
T1306-T1323.

**Frozen Spec Authority**  
Frozen Spec §§17-20,25.5-25.7; S13-FR-025-028.

**Acceptance / Evidence Ownership**  
Mapped through the Frozen Requirement/Acceptance matrices in plan.md.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## T1325 — Full acceptance, scope governance and exact-head closeout

**Goal**  
Prove the implementation head matches the frozen Slice 13 contract and contains no scope leakage.

**Expected Scope**  
Run complete 44-scenario matrix + ten family-path fixture + static architecture guards + migration/RLS/contracts + repository-native full CI. Freeze exact head evidence and diff against then-current main.

**Mandatory Contracts**  
Exactly 43 nodes protected; A3033/A309x/A3111 guards; no A400 runtime, Phase 4 runtime, AI/RAG, second router/Evidence/Safety/Compliance/idempotency truth, generic workflow engine, one-service/table-per-node architecture or Docs/Frozen Spec edits.

**Verification**  
All acceptance IDs PASS, all scope-negative guards PASS, exact-head CI PASS, changed-file review PASS, no generated artifact drift hidden, Audit 2 handoff only after this task.

**Prerequisites**  
T1301-T1324.

**Frozen Spec Authority**  
Frozen Spec §§25-29; S13-FR-001/008-010/031-035.

**Acceptance / Evidence Ownership**  
AS-01..AS-44 + HX-01..HX-15.

**Completion Rule**  
Complete only when the exact implementation head satisfies the scope and verification above with no unresolved finding; otherwise FAIL/STOP.

## Task Traceability Summary

Task Count: 25

| Task | Frozen authority | Primary future evidence |
|---|---|---|
| T1301 | Frozen Spec §§23-24, §29; S13-FR-034. | Remote SHA/blob evidence; exact merge/audit evidence; compare migration order; verify Slice 13 spec unchanged; STOP on any missing owner or semantic drift. |
| T1302 | Frozen Spec §§6,10,11,12,16,23-24; S13-FR-002/011/019-024. | Static dependency map + compile-time imports + explicit owner-seam inventory; no second policy/router/evidence/idempotency state. |
| T1303 | Frozen Spec §§7.2,10.3,14,15,19,20; S13-FR-012/014/018/027. | Clean bootstrap + upgrade migration + replay/second-apply behavior + schema constraints + partial/current uniqueness + RLS/grants + wrong/no context denial + rollback on migration failure. |
| T1304 | Frozen Spec §§17,21-22; S13-FR-025/029-031. | Schema/contract tests + generated OpenAPI check with zero route-count expansion unless T1301 proves merged Slice 12 lacks the approved generic Scene operation. |
| T1305 | Frozen Spec §§10,13-15,18-20; S13-FR-011-014/018/026-028. | Repository tests for first write/revision/reselection, target history, cross-Case refs, current uniqueness, stale CAS, RLS and transaction rollback. |
| T1306 | Frozen Spec §§11-12,16-19,21; S13-FR-003/019-027/030. | Service/integration tests for gate order, fabricated/unreachable node, no client nextNode, owner calls, route reasons, rollback, dependency/infrastructure propagation. |
| T1307 | Frozen Spec §§9.2,14.2,20.2,25.1; S13-FR-004/028. | AS-01/02/03, correction/reassessment tests, provenance/history tests, scope-negative Goal/Plan checks. |
| T1308 | Frozen Spec §§9.3,14.6,25.1; S13-FR-005. | AS-04 plus parallel availability/read projection tests and static check that no A3001→A3002 hard prerequisite is introduced outside Manifest. |
| T1309 | Frozen Spec §§9.4,14.3,20.3,25; S13-FR-006. | AS-05/06/14/41; full-set atomicity; stale selection revision; deselect/reselect history; idempotent replay. |
| T1310 | Frozen Spec §§9.5,13-14,26; S13-FR-007/015-017/032-033. | Domain tests for each role + negative threshold/scoring imports + handler/topology static guard. |
| T1311 | Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007. | Canonical path integration test for A3010 → A3011 → A3012 → A3013; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard. |
| T1312 | Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007/008. | Canonical path integration test for A3020 → A3021 → A3022 → A3033; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard. Sparse-number negative fixture included. |
| T1313 | Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007. | Canonical path integration test for A3040 → A3041 → A3042 → A3043; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard. |
| T1314 | Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007. | Canonical path integration test for A3050 → A3051 → A3052 → A3053; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard. |
| T1315 | Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007. | Canonical path integration test for A3060 → A3061 → A3062 → A3063; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard. |
| T1316 | Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007. | Canonical path integration test for A3070 → A3071 → A3072 → A3073; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard. |
| T1317 | Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007. | Canonical path integration test for A3080 → A3081 → A3082 → A3083; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard. |
| T1318 | Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007/009. | Canonical path integration test for A3090 → A3091 → A3092 → A3093; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard. A3090-A3093 retention fixture included. |
| T1319 | Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007. | Canonical path integration test for A3100 → A3101 → A3102 → A3103; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard. |
| T1320 | Frozen Spec §§9.1,9.5-9.6,14.4-14.6,25.2; S13-FR-007/010. | Canonical path integration test for A3110 → A3111 → A3112 → A3113; target/feasibility/progress/help record fidelity; re-entry/history; node identity guard. A3111 reachability + no-threshold fixture included. |
| T1321 | Frozen Spec §§9.3,11.2,14.6,20,25.7; S13-FR-005/017/028/033. | AS-04/06/09/18/19/38/39/40 plus re-entry vs current-write and partial-completion tests. |
| T1322 | Frozen Spec §§12,21; S13-FR-024/029-030. | Contract/OpenAPI tests; route-count assertion; client-nextNode attack; fabricated node; stable error mapping; no hidden bypass route. |
| T1323 | Frozen Spec §15, §16.1, §25.4; S13-FR-018. | AS-14/20-24 plus no-context RLS, wrong Family, wrong Case, wrong participant, wrong primary, purpose mismatch and enumeration-safe response tests. |
| T1324 | Frozen Spec §§17-20,25.5-25.7; S13-FR-025-028. | AS-25-38 and HX-01..HX-09/HX-11/HX-15; repeat fault suite proves zero residue across Evidence, target, Scene state, artifact, audit/event and idempotency. |
| T1325 | Frozen Spec §§25-29; S13-FR-001/008-010/031-035. | All acceptance IDs PASS, all scope-negative guards PASS, exact-head CI PASS, changed-file review PASS, no generated artifact drift hidden, Audit 2 handoff only after this task. |

No task authorizes Docs/Frozen Spec edits, production work before T1301 PASS, development PR creation by Plan AI 2, Audit 2, or merge.