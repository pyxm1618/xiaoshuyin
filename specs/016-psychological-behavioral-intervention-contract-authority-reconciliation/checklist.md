# Slice 16 — Authority-Reconciled Pre-Development Verification Matrix

> Purpose: Plan AI 2 checklist and Audit 1 input.  
> This is not a development TODO list. Each row verifies that the Frozen Spec has an executable, bounded Plan/Task/test contract before development begins.  
> Frozen spec blob: 5bc22645af2008d6f774e39f57bae391fa2543c7.

Status vocabulary: PASS / FAIL / N/A. Audit 1 may pass only with FAIL = 0.

## A. Authority, frozen input and current reality

| ID | Verification | Status | Planning evidence |
|---|---|---|---|
| C16-A01 | Frozen reconciliation spec path and blob match exact expected authority | PASS | plan §1; T1601 exact blob hard gate |
| C16-A02 | origin/main, tree, CI and migration head were re-read rather than assumed | PASS | plan §1/§3; T1601 |
| C16-A03 | Four Authority Doc blobs equal the reconciliation baseline; no post-freeze semantic drift | PASS | plan §1; T1601 repeat check |
| C16-A04 | Old Slice 16 spec/plan are historical only and are not implementation Authority | PASS | plan preamble/§1; T1614 historical mutation check |
| C16-A05 | Non-semantic drift is reconcilable in implementation inventory; semantic drift stops and returns to Plan AI 1 | PASS | plan §19; T1601 |
| C16-A06 | Slice selection remains Psychological / Behavioral Intervention Contract Foundation; no re-selection | PASS | plan §1; FR-001 / T1601 |

## B. Ownership, Professional Approval, Staff and qualification

| ID | Verification | Status | Planning evidence |
|---|---|---|---|
| C16-B01 | InterventionDefinition identity/content/version/hash/history has one Slice 16 domain owner | PASS | plan §2/§4; T1602 |
| C16-B02 | Shared Professional Content Approval Plane remains canonical approval owner | PASS | plan §2/§5; T1603 |
| C16-B03 | Scene/package publication/inclusion remains existing package owner truth | PASS | plan §2/§6; T1604 |
| C16-B04 | Family/Case eligibility result is separate from all three upstream truths | PASS | plan §2/§7; T1607 |
| C16-B05 | No local approved flag, reviewed_by_role, fixture, developer or AI/RAG fact can become approval Authority | PASS | plan §4.2/§5/§14; T1603/T1610/T1613 |
| C16-B06 | Approval proof binds exact definition id + version + content hash + source refs + scope + reviewer + time | PASS | plan §5.1; T1603 |
| C16-B07 | Staff Authority reuses staff_assignments and does not create a second Staff table/model | PASS | plan §3/§5.3; T1603/T1613 |
| C16-B08 | Existing SAFETY_RESOLVE resolver/context is recognized as Safety-specific and is not reused as PROFESSIONAL_REVIEW authority | PASS | plan §3/§5.3; T1603 |
| C16-B09 | PROFESSIONAL_REVIEW capability remains distinct from professional qualification | PASS | plan §2/§5.4; T1603 |
| C16-B10 | No professional qualification platform is created; absent/unverifiable qualification fails closed | PASS | plan §5.4; T1603 |

## C. Definition domain, version/hash, package and eligibility

| ID | Verification | Status | Planning evidence |
|---|---|---|---|
| C16-C01 | Full §2.7A/Frozen §14 Intervention contract fields are included in typed semantic payload | PASS | plan §4.3; T1602 |
| C16-C02 | Stable intervention_code and exact immutable version are both represented; code alone cannot authorize use | PASS | plan §4.2; T1602 |
| C16-C03 | Server-owned deterministic content_hash is specified and cannot be client supplied | PASS | plan §4.3; T1602 |
| C16-C04 | Material semantic/source change creates successor version and fresh approval requirement | PASS | plan §4.2/§9; T1602/T1608 |
| C16-C05 | Historical versions remain inspectable after supersession/retirement | PASS | plan §4.2/§9; T1608 |
| C16-C06 | Current case scene_package_version is read through getScenePackageBinding | PASS | plan §3/§6; T1604 |
| C16-C07 | Exact package inclusion and professional approval are separate required gates | PASS | plan §6; T1604/T1607 |
| C16-C08 | Floating latest definition/package/approval fallback is forbidden | PASS | plan §6/§12; T1604/T1611/T1613 |
| C16-C09 | Deterministic evaluator order covers every frozen hard gate and no model call | PASS | plan §7.2; T1607 |
| C16-C10 | Eligibility result is typed, structured, auditable and carries exact provenance/freshness refs | PASS | plan §7.3; T1607/T1611 |

## D. UNKNOWN, Authorization, RLS, Consent, Compliance and Safety

| ID | Verification | Status | Planning evidence |
|---|---|---|---|
| C16-D01 | UNKNOWN / DECLINED / NOT_COLLECTED / CONFLICTING remain first-class and are never favorable defaults | PASS | plan §7.4; T1605/T1607 |
| C16-D02 | Case/Problem Formulation/Evidence are current-owner reads; Slice 16 writes no Case phase | PASS | plan §3/§7.1; T1605 |
| C16-D03 | Family/case authorization uses the existing authorize entry point and preserves anti-enumeration | PASS | plan §8.1; T1606 |
| C16-D04 | Staff professional-asset authority is isolated from household Family/Guardian authority | PASS | plan §8.2; T1603/T1606 |
| C16-D05 | RLS remains enabled/current; no BYPASSRLS/table-owner runtime or household-RLS reuse as Staff authority | PASS | plan §8; T1602/T1606 |
| C16-D06 | Consent, Compliance and Safety are independent current-owner gates; none is implied by approval or another gate | PASS | plan §8.3–§8.5; T1606/T1607 |
| C16-D07 | Legal Authority gap is not interpreted by Slice 16; applicable Compliance behavior fails closed | PASS | plan §8.4; T1606 |

## E. Idempotency, concurrency, atomicity, audit and failure semantics

| ID | Verification | Status | Planning evidence |
|---|---|---|---|
| C16-E01 | Shared actor + command + idempotency-key infrastructure is reused | PASS | plan §10.1; T1609 |
| C16-E02 | Same key/same semantic payload exact replay and same key/different payload conflict are explicit | PASS | plan §10.1; T1609 |
| C16-E03 | Version/lifecycle/binding concurrency has one winner and stale-writer conflict | PASS | plan §10.2; T1609 |
| C16-E04 | One caller-owned transaction/client commits local domain effects + audit + idempotency; no nested transaction | PASS | plan §10.3; T1609 |
| C16-E05 | Business audit carries bounded exact provenance but is not a second approval truth store | PASS | plan §11; T1609 |
| C16-E06 | Complete fail-closed failure taxonomy exists, including infrastructure/dependency unavailability | PASS | plan §12; T1611 |

## F. Migration, phase boundary, production gates and downstream compatibility

| ID | Verification | Status | Planning evidence |
|---|---|---|---|
| C16-F01 | No migration number is frozen now; Development allocates then-next safe number after T1601 | PASS | plan §13; T1601/T1602 |
| C16-F02 | Historical migrations remain immutable and production migration contains no professional approval seed | PASS | plan §13; T1602/T1614 |
| C16-F03 | Candidate/test content is allowed only without fake production approval/publication | PASS | plan §4.4; T1610 |
| C16-F04 | Production reviewer/qualification/approval absence is deliberately tested as unavailable/blocked | PASS | plan §5.2/§14.6; T1610 |
| C16-F05 | Development Implement Gate is independent from Production Professional Approval and Publication/Release gates | PASS | plan §1; T1610/T1614 |
| C16-F06 | Phase 4 objects (InterventionInstance/Goal/Plan/Task/etc.) are explicitly excluded | PASS | plan §7.5/§14.7; T1613 |
| C16-F07 | Slice 15 package semantics remain unchanged; Slice 17 gets only clear exact definition/provenance consumer seams | PASS | plan §15; T1614 |

## G. Negative scope and test strategy

| ID | Verification | Status | Planning evidence |
|---|---|---|---|
| C16-G01 | Generic Professional CMS/Content Platform/approval workflow/expert marketplace are mechanically guarded out | PASS | plan §14.7; T1613 |
| C16-G02 | Generic Staff/qualification platform and duplicate Staff/Approval/package/Case owners are guarded out | PASS | plan §14.7; T1613 |
| C16-G03 | RAG/pgvector/embedding/reranking/Knowledge/Context Builder/AI Task Runtime are guarded out | PASS | plan §14.7; T1613 |
| C16-G04 | Domain/approval/auth-gate/idempotency/concurrency/atomicity/architecture test suites are all specified | PASS | plan §14; T1612/T1613 |
| C16-G05 | All 64 Functional Requirements map to Plan + Task + verification | PASS | plan §16; T1612 |
| C16-G06 | All 40 Acceptance Scenarios map to tasks/tests | PASS | plan §17; T1612 |
| C16-G07 | All 30 Negative Scope scenarios map to architecture/scope guards | PASS | plan §18; T1613 |

## H. Audit 1 executability and stop boundary

| ID | Verification | Status | Planning evidence |
|---|---|---|---|
| C16-H01 | Every Development Task states goal, expected files/modules, dependencies and implementation boundary | PASS | tasks.md T1601–T1614 |
| C16-H02 | Every Development Task states verification, FR/AS/NS mapping, negative/failure tests and scope guard | PASS | tasks.md T1601–T1614 |
| C16-H03 | T1601 is the mandatory Development-Start Exact Authority Read-back | PASS | tasks.md T1601 |
| C16-H04 | Development AI has no unresolved architecture/product decision to re-decide | PASS | plan §20; tasks.md |
| C16-H05 | Plan AI 2 stop boundary is Planning Freeze only; no development/Audit2/merge is authorized now | PASS | this matrix + Frozen Spec |
| C16-H06 | Audit 1 finding gate is limited to Frozen Spec contradiction/coverage/owner/leakage/gate/phase/executability/reliability issues | PASS | Frozen Spec + planned Audit 1 |
| C16-H07 | Planning artifacts are confined to reconciliation directory; spec/Docs/production remain immutable in this turn | PASS | branch scope read-back required |

## Coverage summary

~~~text
Checklist PASS: 60
Checklist FAIL: 0
Checklist N/A: 0

Functional Requirement planning coverage: 64/64
Acceptance Scenario planning coverage: 40/40
Negative Scope planning coverage: 30/30
~~~

## Pre-development gate conclusion

~~~text
Frozen Spec Integrity: PASS
Input Drift: NONE
Open Product Decisions: 0
Open Planning Decisions: 0
Scope Drift: 0
Duplicate Authority: 0
Planning Quality Gate: PASS candidate, subject to Audit 1 exact read-back
Development Implement Gate: PASS
Production Professional Approval Gate: BLOCKED
Production Publication / Release Gate: BLOCKED
~~~
