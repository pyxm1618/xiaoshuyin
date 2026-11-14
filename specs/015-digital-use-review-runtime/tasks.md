# Slice 15 Development Tasks — Digital Use Review Runtime

**Repository**: `pyxm1618/xiaoshuyin`  
**Planning branch**: `plan/015-digital-use-review-runtime`  
**Frozen Spec authority**: `246465f00156d37c03d33fd638ae9e605ceab3d9` / `0c6e9dd80fa74734d641ad9ff7b4b66ba3930801`  
**Planning status**: FROZEN after Audit1 FINAL PASS  
**Implementation status**: NOT STARTED / OVERALL IMPLEMENT GATE BLOCKED

Only T1501 may execute while both stream gates are blocked, and T1501 is read-only. If one gate later passes, only that stream and strictly necessary shared work may proceed. T1517 requires both streams complete.

## T1501 — Development-start Authority / dual-stream Implement Gate

**Task ID**  
T1501

**Goal**  
Development-start Authority / dual-stream Implement Gate

**Expected Scope**  
Re-read then-current main, four Docs, Frozen Spec, Slice 8–11 runtime owners, Slice 12/13/14 Audit 2 + merge state, Evidence/transaction/RLS/Authorization/Consent/audit seams, open PRs and migration head; compute A5001 and A5002 gates independently.

**Allowed Files / Areas**  
READ-ONLY repository/remote inspection only; no production/test/migration/Docs edit.

**Mandatory Contracts**  
A5001 requires Slice 12 + 13 and explicitly not 14. A5002 requires Slice 12 + 14 and explicitly not 13. One stream may PASS while the other remains BLOCKED. Frozen mutation/semantic drift is STOP.

**Prerequisites**  
Authenticated repository access and exact Frozen Spec identity.

**Frozen Spec Authority**  
Frozen Spec §28.3–§28.5; FR-001–010, FR-030–040.

**Verification**  
Record exact SHAs/blobs/Audit2/merge evidence; assert every gate predicate mechanically. Planning-time expected result: A5001 BLOCKED, A5002 BLOCKED.

**Stop Conditions**  
STOP on Frozen blob mismatch, semantic authority drift, absent sole-owner runtime, missing required Audit2+merge, or unresolved owner collision.

## T1502 — Authoritative seam / persistence / transaction reconciliation

**Task ID**  
T1502

**Goal**  
Authoritative seam / persistence / transaction reconciliation

**Expected Scope**  
After a stream gate passes, inspect actual merged Slice 12 Scene State/Artifact/API/repository/revision/CAS/transaction/idempotency/audit seams, Evidence owner, and only that stream's Slice 13 or 14 subject owner; decide whether any migration is required.

**Allowed Files / Areas**  
Initially read-only inspection of merged owner code/schema/migrations. Any later schema change must extend only the proven authoritative owner.

**Mandatory Contracts**  
Prefer existing owner. Forbidden: reviews, digital_use_reviews, generic_review_results, review_engine, second_scene_states, second_scene_artifacts, second_evidence. No migration number is preallocated.

**Prerequisites**  
T1501 PASS for at least one stream; blocked sibling remains untouched.

**Frozen Spec Authority**  
FR-011–016, FR-036, FR-041–046; NS-01–02, NS-16–19, NS-28.

**Verification**  
Owner/schema/import inventory proves single truth; call graph proves one authoritative same-client transaction; explicitly record NO MIGRATION when sufficient.

**Stop Conditions**  
STOP if implementation needs a second truth, historical migration edit, upstream semantic rewrite, or unauthorized sibling dependency.

## T1503 — Typed Scene review artifacts / command / API contracts

**Task ID**  
T1503

**Goal**  
Typed Scene review artifacts / command / API contracts

**Expected Scope**  
Define two discriminated typed payload/result/artifact contracts for A5001 and A5002, expected revisions, canonical payload fingerprints and server-owned entry context aligned with merged Scene/Zod/OpenAPI style.

**Allowed Files / Areas**  
Existing Digital Use Scene schema/types and packages/contracts; generated contract artifacts only per repository convention. Slice 11 manifest/routing remains read-only.

**Mandatory Contracts**  
No generic Review DTO/service/repository/route. Exact discriminators are DIGITAL_USE_A5001_EFFECT_EVALUATION and DIGITAL_USE_A5002_EFFECT_EVALUATION. Common metadata must carry Case owner ref, node, stream, scene_package_version, artifact_schema_version, exact subject+revision/version, source_refs, evidence_refs, submitted_by provenance, created_at, artifact revision, supersedes/revision and explicit UNKNOWN/DECLINED/NOT_COLLECTED where applicable. Client cannot authoritatively choose stream/next node/scheduled truth.

**Prerequisites**  
T1502 for the unlocked stream(s). Do not implement a blocked sibling merely to share types.

**Frozen Spec Authority**  
FR-001–006, FR-009, FR-013, FR-015, FR-041; NS-01–03, NS-12–15, NS-21.

**Verification**  
Zod/type/OpenAPI tests reject cross-scope payloads; route/schema inventory finds no generic Review surface; canonical fingerprint is deterministic.

**Stop Conditions**  
STOP if merged Scene surface cannot carry the contract without redefining ownership/topology or if a generic Review abstraction is proposed.

## T1504 — A5001 domain / subject / provenance semantics

**Task ID**  
T1504

**Goal**  
A5001 domain / subject / provenance semantics

**Expected Scope**  
Bind exact Case + Family Alliance + selected target-list/target revisions; consume A3000 self-assessment, A3001 communication-preparation, A3002 target revisions, target text, feasibility, Scene progress, help/problem history, Evidence and prior A5001. Project the frozen Family Alliance dimensions (emotional support, child voice/negotiation, trust, coordination, parent stability, parent promise consistency) plus target-attempt/barrier/help/change/adverse-change/uncertainty dimensions; preserve UNKNOWN/DECLINED/NOT_COLLECTED and genuine optional child provenance; allow partial target progress.

**Allowed Files / Areas**  
Existing Digital Use Scene/domain area reconciled by T1502; no Contract-owner changes.

**Mandatory Contracts**  
No Slice14 prerequisite, no all-target-complete gate, no universal score/threshold, no Outcome/Goal/Task/Checkin, no fabricated child input.

**Prerequisites**  
T1501 A5001 PASS; T1502; A5001 tranche of T1503.

**Frozen Spec Authority**  
FR-017–023, FR-047–049; AS-01,07,11,16–23.

**Verification**  
Pure/domain tests for valid subject, wrong scope, partial targets, unknowns, source provenance, no scoring and bounded REVIEW_COMPLETE.

**Stop Conditions**  
STOP on missing authoritative target seam, need to infer a score, or any Contract/A5002 ownership.

## T1505 — A5001 persistence / Evidence / Scene owner integration

**Task ID**  
T1505

**Goal**  
A5001 persistence / Evidence / Scene owner integration

**Expected Scope**  
Persist validated A5001 via authoritative Scene Artifact/State owner; bind target/list revisions and Evidence refs; compose audit/event/idempotency within authoritative transaction; preserve revision history.

**Allowed Files / Areas**  
Merged Slice12 Scene repository/service + existing Evidence/audit/idempotency owner; Slice13 subject owner read/validation seam; additive owner schema only if T1502 proves unavoidable.

**Mandatory Contracts**  
No A5001 table/repository. Evidence remains Evidence Core. Artifact is typed Scene-local history.

**Prerequisites**  
T1504; T1502 owner transaction proof; T1501 A5001 PASS.

**Frozen Spec Authority**  
FR-011–016, FR-019, FR-022, FR-044–046.

**Verification**  
Repository/integration tests assert exact refs, scope, append/supersede history, single owner and all-or-nothing effects.

**Stop Conditions**  
STOP if Evidence/artifact/state/audit/idempotency cannot share authoritative transaction or persistence duplicates upstream truth.

## T1506 — A5001 Scene API / USER_INITIATED integration

**Task ID**  
T1506

**Goal**  
A5001 Scene API / USER_INITIATED integration

**Expected Scope**  
Wire A5001 into merged generic Scene read/submission owner; validate server-owned node/stream/package/entry/subject revisions and bounded REVIEW_COMPLETE.

**Allowed Files / Areas**  
Existing Slice12 Scene routes/services/contracts only; no new Review route family and no Slice11 topology edit.

**Mandatory Contracts**  
USER_INITIATED works without Phase4. A5001 completion cannot complete A5002 or Common Review/Outcome.

**Prerequisites**  
T1504,T1505; T1501 A5001 PASS.

**Frozen Spec Authority**  
FR-001–006, FR-009–010, FR-023, FR-030, FR-046.

**Verification**  
Contract/OpenAPI/integration tests prove legal entry, cross-payload rejection, sibling incompletion, stable failures and no `/reviews` route.

**Stop Conditions**  
STOP if API requires generic Review endpoint, local router, client nextNode/stream authority or Phase4 truth.

## T1507 — A5002 domain / exact Contract-version semantics

**Task ID**  
T1507

**Goal**  
A5002 domain / exact Contract-version semantics

**Expected Scope**  
Bind one exact Contract version/revision/status/execution/source-package subject; consume A4010 terms/version, execution period, parent support, A4006 supervision log/artifacts, incentives, breach responsibilities, A4011 support, A4012 history, Evidence and prior A5002. Project the frozen dimensions (execution/partial execution, parent cooperation, supervision, incentives, breach responsibilities, benefits, adverse changes, new problems, uncertainty and approved A4012-trigger observation) without generic scoring or executing A4012.

**Allowed Files / Areas**  
Existing Digital Use Scene/domain area; Slice14 Contract owner read/validation only except already-authoritative integration seam.

**Mandatory Contracts**  
No Slice13 prerequisite, no silent version switch, no Contract create/activate/supersede, no A4012 execution, no Outcome/Plan/Checkin.

**Prerequisites**  
T1501 A5002 PASS; T1502; A5002 tranche of T1503.

**Frozen Spec Authority**  
FR-024–029, FR-047–049; AS-02,08,12,24–29.

**Verification**  
Domain tests prove exact version binding, stale/superseded mismatch, historical binding, trigger-evidence-only behavior and bounded REVIEW_COMPLETE.

**Stop Conditions**  
STOP on missing Contract history seam, silent subject switch or any attempt to execute A4012.

## T1508 — A5002 persistence / Contract provenance / Evidence integration

**Task ID**  
T1508

**Goal**  
A5002 persistence / Contract provenance / Evidence integration

**Expected Scope**  
Persist A5002 via authoritative Scene Artifact/State owner with exact Contract subject/version refs, Evidence refs, audit/event/idempotency and immutable historical binding.

**Allowed Files / Areas**  
Merged Slice12 Scene owner + Evidence/audit/idempotency + Slice14 Contract owner read/validation seam; additive owner schema only if T1502 proves unavoidable.

**Mandatory Contracts**  
No A5002/Review table; historical review remains bound after Contract supersession; A5002 writes no Contract aggregate state.

**Prerequisites**  
T1507; T1502 transaction proof; T1501 A5002 PASS.

**Frozen Spec Authority**  
FR-011–016, FR-026–029, FR-044–046.

**Verification**  
Repository/integration tests assert exact Contract ref, no Contract mutation, append/supersede artifact history and atomic composition.

**Stop Conditions**  
STOP if provenance requires copying Contract truth or transaction mutates the Contract aggregate.

## T1509 — A5002 Scene API / USER_INITIATED integration

**Task ID**  
T1509

**Goal**  
A5002 Scene API / USER_INITIATED integration

**Expected Scope**  
Wire A5002 into merged generic Scene read/submission owner with server-owned node/stream/package/revision validation and bounded REVIEW_COMPLETE.

**Allowed Files / Areas**  
Existing Slice12 Scene routes/services/contracts; no generic Review or Contract-review route family.

**Mandatory Contracts**  
USER_INITIATED works without Phase4. Completion cannot complete A5001, create Outcome/Common Review or execute A4012.

**Prerequisites**  
T1507,T1508; T1501 A5002 PASS.

**Frozen Spec Authority**  
FR-001–006, FR-009–010, FR-029–030, FR-046.

**Verification**  
Contract/OpenAPI/integration tests prove legal entry, exact subject response, cross-payload rejection, sibling incompletion and no generic Review API.

**Stop Conditions**  
STOP if endpoint duplicates Scene owner or hides Contract/version mismatch.

## T1510 — Authorization / RLS / anti-enumeration / source scope

**Task ID**  
T1510

**Goal**  
Authorization / RLS / anti-enumeration / source scope

**Expected Scope**  
Enforce wrong Family/Case/subject/actor, participant escalation, cross-Family/cross-Case Evidence, child provenance and current primary Case using existing Authorization + forced RLS.

**Allowed Files / Areas**  
Existing Authorization owner and authoritative owner-table RLS only if needed; Scene services/security tests. No second RBAC/visibility system.

**Mandatory Contracts**  
Participant membership alone grants no submit privilege. Application auth and RLS both protect cross-Family data. Add only minimum existing-owner action vocabulary if truly required.

**Prerequisites**  
T1502; production integration only for stream(s) with T1501 PASS.

**Frozen Spec Authority**  
FR-022, FR-036, FR-040; AS-11–18, AS-30–31.

**Verification**  
Security-negative/RLS tests for wrong family/case/actor/subject, participant escalation, Evidence scope and genuine child provenance; no-context RLS fails closed.

**Stop Conditions**  
STOP if existing owner cannot express action without semantic redesign or a parallel authorization model is required.

## T1511 — Consent / Compliance / Safety / primary / package commit-time composition

**Task ID**  
T1511

**Goal**  
Consent / Compliance / Safety / primary / package commit-time composition

**Expected Scope**  
Re-read and revalidate independent authoritative gates immediately before commit; cover races for consent revoke, Safety change, Compliance change, primary Case change, subject revision drift and package drift.

**Allowed Files / Areas**  
Consumer-side Scene command composition + existing owner seams; no duplicate owner implementation.

**Mandatory Contracts**  
No ALLOW overrides another gate; SAFETY_HOLD blocks ordinary completion; client flags are never authority; infrastructure errors remain infrastructure errors.

**Prerequisites**  
T1502,T1510 plus applicable stream domain/service.

**Frozen Spec Authority**  
FR-035, FR-037–040, FR-046; AS-32–36, AS-50, AS-56.

**Verification**  
Integration/race tests assert zero completed artifact/state residue on gate failure and exact error/infra propagation.

**Stop Conditions**  
STOP if an authoritative owner seam is absent/cannot compose in the authoritative transaction or would require duplicated control truth.

## T1512 — Idempotency / canonical fingerprint

**Task ID**  
T1512

**Goal**  
Idempotency / canonical fingerprint

**Expected Scope**  
Reuse existing idempotency owner with stream-specific command identities and canonical fingerprints bound to server-resolved Case/node/subject/version/revisions/package/validated payload.

**Allowed Files / Areas**  
Existing idempotency vocabulary/owner + Scene command composition/tests; no private idempotency store.

**Mandatory Contracts**  
Same key+same canonical payload returns original result; same key+different payload conflicts; A5001/A5002 command identities cannot collide.

**Prerequisites**  
T1503 plus applicable stream command.

**Frozen Spec Authority**  
FR-041, FR-046; AS-37–39; NS-19.

**Verification**  
Replay/mismatch/failed-attempt retry/stream-separation tests assert no duplicate artifact/state/event writes.

**Stop Conditions**  
STOP if command vocabulary change mutates historical semantics or proposes another idempotency system.

## T1513 — Concurrency / stale revisions / cross-stream isolation

**Task ID**  
T1513

**Goal**  
Concurrency / stale revisions / cross-stream isolation

**Expected Scope**  
Use existing CAS/revision seam for node + target-list or Contract subject revisions; prove one winner per expected revision and no cross-stream overwrite.

**Allowed Files / Areas**  
Authoritative Scene CAS/revision seam + subject-owner revision evidence + concurrency tests.

**Mandatory Contracts**  
No last-write-wins. A5001 and A5002 discriminators/states are isolated. Stale subject revisions conflict truthfully.

**Prerequisites**  
T1505/T1508 as applicable; T1512.

**Frozen Spec Authority**  
FR-042–043; AS-40–43, AS-46.

**Verification**  
Barrier-based concurrent tests prove exactly one winner, stable stale conflict and cross-stream non-overwrite.

**Stop Conditions**  
STOP if safe CAS cannot be achieved without redefining upstream owner semantics.

## T1514 — Atomicity / fault injection / audit settlement

**Task ID**  
T1514

**Goal**  
Atomicity / fault injection / audit settlement

**Expected Scope**  
Couple Evidence ref/write handling, Scene Artifact, Scene State, audit/event and idempotency settlement; inject failures at intermediate boundaries.

**Allowed Files / Areas**  
Authoritative Scene transaction composition + Evidence/audit/idempotency owner seams + fault-injection tests.

**Mandatory Contracts**  
No partial-success business state; failed transaction leaves no successful idempotency settlement; infrastructure failures are not business success.

**Prerequisites**  
T1505/T1508 as applicable; T1511–T1513.

**Frozen Spec Authority**  
FR-014, FR-044, FR-046; AS-44–45.

**Verification**  
Post-failure DB assertions prove rollback of new effects while preserving preexisting history.

**Stop Conditions**  
STOP if writes cannot share authoritative transaction or a compensating/second-truth mechanism is proposed.

## T1515 — Correction / revision / re-entry / history

**Task ID**  
T1515

**Goal**  
Correction / revision / re-entry / history

**Expected Scope**  
Append/supersede later A5001 evaluation revisions and A5002 reviews for later Contract versions; preserve all prior content; rerun current gates/revisions on every re-entry.

**Allowed Files / Areas**  
Authoritative Scene Artifact/State history seam + integration tests; no destructive rewrite of prior evaluation.

**Mandatory Contracts**  
History is append/supersede. A5002 later-version review is newly bound; A5001 timeline re-entry preserves earlier artifact.

**Prerequisites**  
Applicable stream service + T1511–T1514.

**Frozen Spec Authority**  
FR-016, FR-035, FR-045; AS-21,26,47–50; NS-20.

**Verification**  
Before/after history tests prove prior rows/artifacts unchanged plus new current revision and gate revalidation.

**Stop Conditions**  
STOP if owner model can only overwrite history or correction rewrites target/Contract truth.

## T1516 — Scheduled-entry truthful-unavailable seam

**Task ID**  
T1516

**Goal**  
Scheduled-entry truthful-unavailable seam

**Expected Scope**  
Keep USER_INITIATED real; treat SCHEDULED as entry eligibility only; require future authoritative trigger for production and return capability unavailable until it exists; provide test-only synthetic trigger fixture.

**Allowed Files / Areas**  
Scene entry validation + test fixtures only. Forbidden production areas: cron/timer/worker schedule, pg-boss enqueue, schedule row, notification/delivery write.

**Mandatory Contracts**  
Synthetic trigger is test-only and cannot become production truth. Future authentic trigger still passes all current gates.

**Prerequisites**  
T1506/T1509 as applicable; T1511.

**Frozen Spec Authority**  
FR-030–035; AS-51–56; NS-06–08, NS-24–25.

**Verification**  
Production-negative tests reject untrusted SCHEDULED; DB/static guards prove no schedule/job/notification writes; USER_INITIATED succeeds without Phase4; fixture stays test-only.

**Stop Conditions**  
STOP if implementation requires scheduler/job/notification/fake production trigger or any Phase4 owner.

## T1517 — Full acceptance / negative-space / deterministic Phase2 exact-head closeout

**Task ID**  
T1517

**Goal**  
Full acceptance / negative-space / deterministic Phase2 exact-head closeout

**Expected Scope**  
Run complete FR/AS/NS evidence, schema/API/import/route/table/static guards, no-network deterministic fixture reaching both A5001 and A5002 REVIEW_COMPLETE, exact-head regression and Audit2 handoff.

**Allowed Files / Areas**  
Tests + narrow existing governance/static guard/contract verification only as needed; no feature expansion during closeout.

**Mandatory Contracts**  
Both stream gates and implementations must complete; no real AI/RAG/Phase4 truth; independent Audit2 remains required.

**Prerequisites**  
All tasks for both streams complete; both T1501 stream gates PASS at final head.

**Frozen Spec Authority**  
FR-001–050; AS-01–70; NS-01–28; Frozen Spec §28.5.

**Verification**  
Mechanical FR50/50 AS70/70 NS28/28, exact-head CI, forbidden-artifact inventories, no-network deterministic AS-65/66/70 and independent Audit2 evidence package.

**Stop Conditions**  
STOP closeout on any failed acceptance, forbidden artifact, scope drift, missing exact-head proof or incomplete stream.


## Execution Order

T1501 → T1502 → T1503.  
A5001: T1504 → T1505 → T1506.  
A5002: T1507 → T1508 → T1509.  
Shared enforcement/evidence: T1510 → T1511 → T1512 → T1513 → T1514 → T1515 → T1516, applied only to unlocked streams.  
Final exact-head closeout: T1517 after both streams complete.

Total Tasks: 17  
Open Product Decisions: 0  
Open Planning Decisions: 0
