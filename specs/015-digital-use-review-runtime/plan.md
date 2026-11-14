# Slice 15 Implementation Plan — Digital Use Review Runtime

**Role**: Slice 15 Plan AI 2 — Plan + Checklist + Tasks + Pre-Development Audit 1 only  
**Repository**: `pyxm1618/xiaoshuyin`  
**Planning branch**: `plan/015-digital-use-review-runtime`  
**Frozen Spec**: `246465f00156d37c03d33fd638ae9e605ceab3d9` / blob `0c6e9dd80fa74734d641ad9ff7b4b66ba3930801` / 1620 lines  
**Execution context**: remote-only; no local checkout, local branch, working tree or fabricated `git fetch` output.  
**Planning status**: COMPLETE  
**Runtime status**: NOT AUTHORIZED — both stream gates currently BLOCKED

## 1. Authority Gate

| Authority | Exact input | Planning result |
|---|---|---|
| origin/main | `7ec51889337d547766412a2ce954cff352e6d57b` | PASS |
| Frozen Spec branch/commit | `spec/015-digital-use-review-runtime` / `246465f00156d37c03d33fd638ae9e605ceab3d9` | PASS |
| Frozen Spec blob | `0c6e9dd80fa74734d641ad9ff7b4b66ba3930801` | PASS — exact |
| Docs/总产品需求.md | `67724000cb9bb81c40489c04db28d899bd1df74c` | PASS — exact authority blob |
| Docs/V1产品需求.md | `918d8574ad88773fe371985fd5c38080c944fec9` | PASS — exact authority blob |
| Docs/总体技术架构.md | `9b08371edc976fa281469dfee8dc19962452e3b0` | PASS — exact authority blob |
| Docs/V1技术设计.md | `e7285fd8363c8a76ab4fd96a305037b5c675f961` | PASS — exact authority blob |
| Slice 8 | PR #26 merged; same-transaction owner remediation PR #32 merged on current main | authoritative |
| Slice 9 | PR #28 merged | sole Safety owner |
| Slice 10 | PR #30 merged | sole Compliance owner |
| Slice 11 | PR #31 merged | sole Manifest/routing owner |
| Slice 12 | plan head `496f8d33c7147fcb77848fa1acc8e990d75c2ab0`; runtime not merged | blocker |
| Slice 13 | plan head `f2d13df2d12e7a75e09da4ebcf22fe6579e008a4`; runtime not merged | A5001 blocker |
| Slice 14 | plan head `81de51936a34360ff4b1aaca9b18c7434f21e7b5`; runtime not merged | A5002 blocker |

**Planning Input Drift: NO DRIFT.** Current main equals the Frozen Spec baseline and all four Docs blobs are unchanged. Semantic authority drift: NONE.

Any future Frozen blob mismatch is `STOP — FROZEN SPEC MUTATION`. Any future semantic authority change is `STOP — SEMANTIC AUTHORITY DRIFT`; lower artifacts may not rewrite product meaning.

## 2. Scope / Phase Boundary

Slice 15 implements exactly two separate bounded Phase 2 Scene-local effect evaluations: `A5001 / FAMILY_ALLIANCE_REVIEW` and `A5002 / PHONE_USE_CONTRACT_REVIEW`.

`REVIEW_COMPLETE` means only a valid Scene effect-evaluation interaction for that one node/scope committed. It is not success, Case Outcome, Case closure or Common Core Review completion.

Phase 3 AI/RAG/model runtime and Phase 4 Common Core Review, CASE_OVERALL, Outcome, Goal/Plan/Task/Checkin, Follow-up Schedule, pg-boss and Notification are outside this Slice and are not implementation prerequisites.

## 3. Owner / Seam Contract

| Concern | Authoritative owner | Slice 15 consumes | Forbidden duplicate |
|---|---|---|---|
| node identity/topology/entry | Slice 11 manifest/routing | A5001/A5002 + USER_INITIATED/SCHEDULED metadata | registry/route table/numeric adjacency |
| Scene state | merged Slice 12 | current node projection/revision | second Scene state |
| Scene artifact | merged Slice 12 | typed append/supersede effect-evaluation artifact | Review table/entity |
| A5001 subject | merged Slice 13 | target-list/item/revision/progress/history | copied target truth |
| A5002 subject | merged Slice 14 | exact Contract-version/execution/support/supersession history | copied Contract truth |
| Evidence | Evidence Core | refs and owner-approved writes | second Evidence store |
| Authorization/RLS | existing owners | actor/resource/action + forced RLS | RBAC/visibility clone |
| Consent | existing Consent owner | current purpose-scoped validity | second consent ledger |
| Compliance | Slice 10 | server-owned feature policy result | second evaluator/client flag |
| Safety | Slice 9 | ordinary-progression guard | second Safety state |
| idempotency/audit | existing shared owners | command slot/event/audit | private ledger |
| transaction | merged shared transaction + in-transaction owner seams | one checked-out client/business transaction | nested/sequential transaction |
| scheduled trigger | future Phase 4 owner | future authentic context only | cron/job/schedule row |
| AI | future Phase 3 | never command authority | model-required completion |

## 4. Development-Start Dual-Stream Implement Gate

**T1501 executes read-only before any production edit.**

### 4.1 A5001 gate
Required: Slice8/9/10/11 authoritative; Slice12 Audit2 PASS + merged with Scene State/Artifact/API/transaction/idempotency; Slice13 Audit2 PASS + merged with Family Alliance target/progress/history; Evidence atomic provenance seam; shared RLS/Auth/Consent/audit reconciled; no semantic drift. **Slice14 is NOT REQUIRED.**

Current state: **BLOCKED** — Slice12 and Slice13 runtime are not merged.

### 4.2 A5002 gate
Required: Slice8/9/10/11 authoritative; Slice12 Audit2 PASS + merged; Slice14 Audit2 PASS + merged with Contract-version/execution-support/supersession history; Evidence atomic provenance seam; shared contracts reconciled; no semantic drift. **Slice13 is NOT REQUIRED.**

Current state: **BLOCKED** — Slice12 and Slice14 runtime are not merged.

### 4.3 Incremental unlock
`A5001=PASS/A5002=BLOCKED` and `A5001=BLOCKED/A5002=PASS` are legal. Only the PASS stream and strictly necessary shared work may proceed. One stream PASS never means Slice15 CLOSED. Final implementation completion requires both streams, full acceptance, no Phase4 truth and independent Audit2 PASS.

## 5. Persistence / Revision / Transaction

T1502 first inspects the actually merged Slice12 owner. Default is to extend existing `scene_node_states` / `scene_artifacts`, revision/CAS, Evidence, audit/event and idempotency seams. A new table is not presumed.

A5001 and A5002 use the exact Frozen discriminators:

- `DIGITAL_USE_A5001_EFFECT_EVALUATION`
- `DIGITAL_USE_A5002_EFFECT_EVALUATION`

They are not generic Review records and must not share one opaque optional-field blob. Common artifact metadata is frozen as: Case reference through the owner; node code; stream discriminator; `scene_package_version`; `artifact_schema_version`; exact subject reference + subject revision/version; `source_refs`; `evidence_refs`; `submitted_by` / actor provenance; `created_at`; artifact revision; supersedes/revision relationship; and explicit UNKNOWN / DECLINED / NOT_COLLECTED semantics where applicable.

A5001 binds Family Alliance + selected target-list/target revisions. A5002 binds one exact Contract version/revision. Core observations remain Evidence. A5001 cannot carry Contract-review-only fields as authority; A5002 cannot carry Family-Alliance-target-review-only fields as authority.

A successful command atomically couples, as applicable: Evidence ref/write, Scene Artifact, Scene Node State, audit/event and idempotency settlement in the authoritative same-client transaction. Failure rolls back the whole business mutation.

## 6. Typed Contract / API

Use existing server-authoritative Zod/OpenAPI style and merged Slice12 Scene read/submission surface unless T1502 proves another already-authoritative owner surface. Do not create `/api/reviews`, `/reviews`, Review service/repository, generic Review DTO or endpoint-per-review topology.

Server resolves node/stream/package/subject/entry/revisions. Client cannot authoritatively choose stream, next node, Contract replacement, target truth or scheduled trigger.

Canonical idempotency fingerprint is stream-specific and binds server-resolved Case/node, exact subject identity/version/revision, expected node/subject revisions, package version and normalized validated payload under the existing actor + command-type + key owner.

## 7. A5001 Contract

Subject: authorized Case Family Alliance + selected target-list + relevant target revisions. Approved source material, where present: A3000 self-assessment history; A3001 communication-preparation history; A3002 selected target-list revisions; target-item concrete target text; target feasibility payload/revisions; Scene-level target progress; help/problem-response history; relevant Evidence with provenance; and historical A5001 artifacts.

The Frozen semantic dimensions are: attention to the child’s emotion/emotional support; negotiation and genuine child participation/voice; trust / genuine vs perfunctory agreement; family-member coordination and consistency; parent emotional stability; parent promise/behavior consistency; plus for selected targets what was attempted, not/partially attempted, barriers/obstacles, approved-help use, observed changes/effects, adverse/unexpected changes, and uncertainty/insufficient evidence. Display wording may vary but these dimensions cannot be changed into a new semantic gate.

Partial target execution is legal; all targets need not complete. No universal success score/threshold or diagnosis is authorized. Every applicable required dimension must support explicit UNKNOWN/DECLINED/NOT_COLLECTED where allowed. Child input is optional unless later formal authority changes; genuine child input retains genuine provenance, parent-transcribed material remains parent-sourced, and missing information stays UNKNOWN/NOT_COLLECTED.

Correction/re-entry appends/supersedes history. A5001 never completes A5002, creates Outcome/Common Review, or depends on Slice14 as a business prerequisite.

## 8. A5002 Contract

Subject: one exact authoritative Contract version/revision/status/execution/source-package identity. Approved source material, where present: formal A4010 Contract version; execution period; parent support measures; supervision measures and A4006 execution log/artifacts; incentives; breach responsibilities; A4011 execution-support/FAQ history; A4012 supersession/version history; relevant Evidence with provenance; and historical A5002 artifacts.

The Frozen evaluation dimensions are: whether/how the agreed Contract was actually carried out; partial/non-execution; parent-side support/cooperation; supervision experience; incentive experience where relevant; breach/responsibility experience where relevant; observed benefits; adverse/unexpected changes; new problems; uncertainty/insufficient evidence; and whether an already-approved A4012 trigger condition appears to be present as an observation. No generic Contract score may be invented.

No silent switch to a newer Contract is allowed. A5002 may record evidence relevant to the already-approved A4012 triggers (execution period completed; new problem requires adjustment; approved adjustment condition present), but never executes A4012, invents an A5002→A4012 route, treats the observation as mutual Contract confirmation, or creates/activates/supersedes/rewrites a Contract. Historical A5002 remains bound to the old Contract after later supersession. Slice13 is not a business prerequisite.

## 9. Authorization / RLS / Anti-Enumeration

Every read/write resolves authenticated actor → Family → Case → subject under existing Authorization and RLS. Cover wrong Family, wrong Case, wrong subject, wrong actor, participant escalation, cross-Family/cross-Case Evidence, child provenance and current primary Case. Participant membership alone grants no submit privilege.

RLS does not replace application authorization. Any additive RLS change may only extend an authoritative owner. Existing anti-enumeration/error vocabulary remains authoritative.

## 10. Independent Control Plane

Authorization, Consent, Compliance and Safety remain independent. No ALLOW overrides another BLOCK. Commit-time revalidation covers current primary Case, actor/scope, subject revisions, package/version, Evidence refs and all four gates.

Race evidence is mandatory for Consent revoke-before-commit, Safety change, Compliance change, primary switch, subject revision drift and package drift. Client booleans cannot bypass a gate. Infrastructure failure remains infrastructure failure.

## 11. Idempotency / Concurrency / Atomicity

A5001 and A5002 independently prove same-key+same-payload replay and same-key+different-payload conflict. Expected node and subject revisions use existing optimistic/CAS owner; same-revision concurrency has one current winner and stale writers fail. Cross-stream writes cannot overwrite.

Fault injection must prove rollback after Evidence/ref work and before artifact/state/audit/idempotency settlement. Failed business transaction leaves no successful idempotency result.

## 12. Correction / Re-entry / History

Correction and USER_TIMELINE_REVIEW re-entry never rewrite earlier evaluation content. A5001 creates later artifact revision. A5002 for a later Contract version creates a new artifact bound to that version. Every re-entry reruns primary/Auth/Consent/Compliance/Safety/package/subject-revision gates.

## 13. Scheduled Entry

USER_INITIATED is real production entry and works without Phase4 Schedule when the relevant stream gate passes.

SCHEDULED is entry eligibility only. Production requires future authoritative trigger context; until then capability is truthfully unavailable. Slice15 creates no cron/timer/pg-boss/schedule row/notification truth. Tests may use a synthetic authoritative-trigger fixture only in test context; it cannot become production capability.

## 14. Deterministic No-AI Boundary

Both nodes must reach bounded REVIEW_COMPLETE with deterministic logic and no real model, network AI, RAG or Phase4 runtime. Model output alone is never authority. Exact-head Phase2 fixture covers AS-65/66/70, and guards reject generic questionnaire/workflow/rules/scoring/recommendation engines.

## 15. Migration Planning

No migration number is reserved. T1501/T1502 re-read then-current migration head after upstream merges. If Slice12 storage is sufficient, result is **NO MIGRATION**. If a narrow owner change is required, allocate only the then-next safe number; never edit historical migrations or create a Review table.

## 16. Verification Strategy

Evidence layers include unit, domain, repository, migration if applicable, RLS, contract/OpenAPI, integration, idempotency, concurrency, fault injection, security-negative, scope-negative, static repository guard and exact-head regression. No scenario is “covered generally”.

## 17. Development Task Graph

17 tasks are derived from actual owner seams: gate; owner reconciliation; typed contract; three A5001 layers; three A5002 layers; shared auth/control/idempotency/concurrency/atomicity/history/scheduled boundaries; exact-head closeout.

T1501 → T1502 → T1503 precedes an unlocked stream. A5001: T1504→T1505→T1506. A5002: T1507→T1508→T1509. T1510–T1516 attach only to unlocked streams. T1517 requires both streams complete.

## 18. Requirement Coverage Matrix — 50/50

| FR | Frozen requirement | Plan coverage | Owner task(s) | Mechanical verification |
|---|---|---|---|---|
| FR-001 | Slice 15 implements exactly A5001 and A5002 bounded Digital Use effect-evaluation runtime. | §6 Typed contract/API + §3 owner map | T1503,T1504,T1507,T1517 | Typed contract + manifest/route/API inventory proves distinct server-owned identities and no local topology authority. |
| FR-002 | A5001 and A5002 remain separate canonical node identities. | §6 Typed contract/API + §3 owner map | T1503,T1517 | Typed contract + manifest/route/API inventory proves distinct server-owned identities and no local topology authority. |
| FR-003 | A5001 stream remains FAMILY_ALLIANCE_REVIEW. | §6 Typed contract/API + §3 owner map | T1503,T1504 | Typed contract + manifest/route/API inventory proves distinct server-owned identities and no local topology authority. |
| FR-004 | A5002 stream remains PHONE_USE_CONTRACT_REVIEW. | §6 Typed contract/API + §3 owner map | T1503,T1507 | Typed contract + manifest/route/API inventory proves distinct server-owned identities and no local topology authority. |
| FR-005 | Slice 11 Manifest/routing remains the only topology authority. | §6 Typed contract/API + §3 owner map | T1502,T1506,T1509,T1517 | Typed contract + manifest/route/API inventory proves distinct server-owned identities and no local topology authority. |
| FR-006 | no local route table, numeric adjacency, client nextNode or duplicate node registry is permitted. | §6 Typed contract/API + §3 owner map | T1506,T1509,T1517 | Typed contract + manifest/route/API inventory proves distinct server-owned identities and no local topology authority. |
| FR-007 | Slice 15 SHALL NOT create Common Core Review truth. | §2 Phase boundary + §4 gates | T1503,T1517 | DB/API/static + deterministic integration proves bounded Scene completion and no Common Review/Outcome/Phase3/4 prerequisite. |
| FR-008 | Slice 15 SHALL NOT create Outcome truth. | §2 Phase boundary + §4 gates | T1517 | DB/API/static + deterministic integration proves bounded Scene completion and no Common Review/Outcome/Phase3/4 prerequisite. |
| FR-009 | Scene REVIEW_COMPLETE SHALL have only the bounded semantics defined in this Spec. | §2 Phase boundary + §4 gates | T1506,T1509,T1517 | DB/API/static + deterministic integration proves bounded Scene completion and no Common Review/Outcome/Phase3/4 prerequisite. |
| FR-010 | Phase 3 AI and Phase 4 Review/Schedule SHALL NOT be implementation prerequisites for deterministic A5001/A5002 behavior. | §2 Phase boundary + §4 gates | T1501,T1516,T1517 | DB/API/static + deterministic integration proves bounded Scene completion and no Common Review/Outcome/Phase3/4 prerequisite. |
| FR-011 | Scene State uses the Slice 12 owner. | §5 Persistence/transaction | T1502,T1505,T1508 | Repository/schema/history inventory proves Slice12 Scene owners, Evidence refs, separate discriminators and no generic Review persistence. |
| FR-012 | Scene Artifact uses the Slice 12 owner. | §5 Persistence/transaction | T1502,T1505,T1508 | Repository/schema/history inventory proves Slice12 Scene owners, Evidence refs, separate discriminators and no generic Review persistence. |
| FR-013 | A5001 and A5002 use separate typed artifact discriminators/schemas. | §5 Persistence/transaction | T1503,T1505,T1508 | Repository/schema/history inventory proves Slice12 Scene owners, Evidence refs, separate discriminators and no generic Review persistence. |
| FR-014 | substantive family observations use/refer to Evidence Core. | §5 Persistence/transaction | T1505,T1508,T1514 | Repository/schema/history inventory proves Slice12 Scene owners, Evidence refs, separate discriminators and no generic Review persistence. |
| FR-015 | no generic reviews table/entity/repository/API may be introduced. | §5 Persistence/transaction | T1502,T1503,T1517 | Repository/schema/history inventory proves Slice12 Scene owners, Evidence refs, separate discriminators and no generic Review persistence. |
| FR-016 | history is revisioned/superseding, never destructively overwritten. | §5 Persistence/transaction | T1515 | Repository/schema/history inventory proves Slice12 Scene owners, Evidence refs, separate discriminators and no generic Review persistence. |
| FR-017 | legal A5001 entry requires a valid Family Alliance/target-list subject. | §7 A5001 | T1504,T1506 | A5001 domain/integration/provenance tests prove legal subject, partial targets, unknowns, optional genuine child provenance and no score/cross-completion. |
| FR-018 | A5001 evaluates Family Alliance and selected target implementation effect, not Contract effect. | §7 A5001 | T1504 | A5001 domain/integration/provenance tests prove legal subject, partial targets, unknowns, optional genuine child provenance and no score/cross-completion. |
| FR-019 | A5001 may use A3000 self-assessment, A3002 target revisions, target feasibility/progress/help history and Evidence. | §7 A5001 | T1504,T1505 | A5001 domain/integration/provenance tests prove legal subject, partial targets, unknowns, optional genuine child provenance and no score/cross-completion. |
| FR-020 | A5001 does not require all targets to be complete. | §7 A5001 | T1504,T1517 | A5001 domain/integration/provenance tests prove legal subject, partial targets, unknowns, optional genuine child provenance and no score/cross-completion. |
| FR-021 | A5001 does not invent a universal success score/threshold. | §7 A5001 | T1504,T1517 | A5001 domain/integration/provenance tests prove legal subject, partial targets, unknowns, optional genuine child provenance and no score/cross-completion. |
| FR-022 | child input is optional unless later formal authority explicitly requires it; genuine child input retains genuine provenance. | §7 A5001 | T1504,T1510 | A5001 domain/integration/provenance tests prove legal subject, partial targets, unknowns, optional genuine child provenance and no score/cross-completion. |
| FR-023 | A5001 REVIEW_COMPLETE never implies A5002 completion, Case Outcome or Common Core Review completion. | §7 A5001 | T1506,T1517 | A5001 domain/integration/provenance tests prove legal subject, partial targets, unknowns, optional genuine child provenance and no score/cross-completion. |
| FR-024 | legal A5002 entry requires an exact valid Contract-version subject. | §8 A5002 | T1507,T1509 | A5002 domain/repository tests prove exact Contract version, A4011/A4012 separation, historical provenance and no Contract mutation/cross-completion. |
| FR-025 | A5002 evaluates Contract execution/effect, not Family Alliance target-list effect. | §8 A5002 | T1507 | A5002 domain/repository tests prove exact Contract version, A4011/A4012 separation, historical provenance and no Contract mutation/cross-completion. |
| FR-026 | A5002 may reference Contract terms/version, execution period, supervision/support/incentive/breach context and Evidence where available. | §8 A5002 | T1507,T1508 | A5002 domain/repository tests prove exact Contract version, A4011/A4012 separation, historical provenance and no Contract mutation/cross-completion. |
| FR-027 | A5002 remains distinct from A4011 execution support. | §8 A5002 | T1507,T1509 | A5002 domain/repository tests prove exact Contract version, A4011/A4012 separation, historical provenance and no Contract mutation/cross-completion. |
| FR-028 | A5002 may observe approved A4012 trigger conditions but SHALL NOT create/activate/supersede a Contract. | §8 A5002 | T1507,T1508,T1517 | A5002 domain/repository tests prove exact Contract version, A4011/A4012 separation, historical provenance and no Contract mutation/cross-completion. |
| FR-029 | A5002 REVIEW_COMPLETE never implies A5001 completion, Case Outcome or Common Core Review completion. | §8 A5002 | T1509,T1517 | A5002 domain/repository tests prove exact Contract version, A4011/A4012 separation, historical provenance and no Contract mutation/cross-completion. |
| FR-030 | USER_INITIATED entry works without Phase 4 Schedule when all gates pass. | §12–13 Re-entry/scheduled | T1506,T1509,T1516 | Entry/re-entry tests prove USER_INITIATED, truthful SCHEDULED-unavailable, no scheduler side effect and current gate/revision recheck. |
| FR-031 | SCHEDULED is an entry eligibility, not a scheduler. | §12–13 Re-entry/scheduled | T1516 | Entry/re-entry tests prove USER_INITIATED, truthful SCHEDULED-unavailable, no scheduler side effect and current gate/revision recheck. |
| FR-032 | production SCHEDULED entry requires authentic trigger context from the future authoritative Schedule owner. | §12–13 Re-entry/scheduled | T1516 | Entry/re-entry tests prove USER_INITIATED, truthful SCHEDULED-unavailable, no scheduler side effect and current gate/revision recheck. |
| FR-033 | before that owner exists, scheduled production capability is truthfully unavailable. | §12–13 Re-entry/scheduled | T1516 | Entry/re-entry tests prove USER_INITIATED, truthful SCHEDULED-unavailable, no scheduler side effect and current gate/revision recheck. |
| FR-034 | no cron/job/notification truth may be created by Slice 15. | §12–13 Re-entry/scheduled | T1516,T1517 | Entry/re-entry tests prove USER_INITIATED, truthful SCHEDULED-unavailable, no scheduler side effect and current gate/revision recheck. |
| FR-035 | every re-entry rechecks all current gates and revisions. | §12–13 Re-entry/scheduled | T1511,T1515,T1516 | Entry/re-entry tests prove USER_INITIATED, truthful SCHEDULED-unavailable, no scheduler side effect and current gate/revision recheck. |
| FR-036 | Authorization and RLS are server authoritative. | §9–10 RLS/control plane | T1510 | Authorization/RLS/control-plane negative tests prove independent fail-closed gates, anti-enumeration and no participant escalation. |
| FR-037 | Consent remains separately authoritative. | §9–10 RLS/control plane | T1511 | Authorization/RLS/control-plane negative tests prove independent fail-closed gates, anti-enumeration and no participant escalation. |
| FR-038 | Compliance remains Slice 10 authoritative. | §9–10 RLS/control plane | T1511 | Authorization/RLS/control-plane negative tests prove independent fail-closed gates, anti-enumeration and no participant escalation. |
| FR-039 | Safety remains Slice 9 authoritative and Safety Hold cannot be overridden. | §9–10 RLS/control plane | T1511 | Authorization/RLS/control-plane negative tests prove independent fail-closed gates, anti-enumeration and no participant escalation. |
| FR-040 | participant membership alone grants no review privilege. | §9–10 RLS/control plane | T1510 | Authorization/RLS/control-plane negative tests prove independent fail-closed gates, anti-enumeration and no participant escalation. |
| FR-041 | existing idempotency is reused; same key/same payload replays and mismatch conflicts. | §11–12 Reliability/history | T1512 | Idempotency/concurrency/fault/history tests prove replay/mismatch, one-winner CAS, atomicity, preserved history and infra-error fidelity. |
| FR-042 | stale revisions cannot last-write-win. | §11–12 Reliability/history | T1513 | Idempotency/concurrency/fault/history tests prove replay/mismatch, one-winner CAS, atomicity, preserved history and infra-error fidelity. |
| FR-043 | concurrent same-node submissions produce one current winner. | §11–12 Reliability/history | T1513 | Idempotency/concurrency/fault/history tests prove replay/mismatch, one-winner CAS, atomicity, preserved history and infra-error fidelity. |
| FR-044 | review submission commits Evidence refs/artifact/state/audit/idempotency atomically. | §11–12 Reliability/history | T1514 | Idempotency/concurrency/fault/history tests prove replay/mismatch, one-winner CAS, atomicity, preserved history and infra-error fidelity. |
| FR-045 | corrections/re-entry preserve prior history. | §11–12 Reliability/history | T1515 | Idempotency/concurrency/fault/history tests prove replay/mismatch, one-winner CAS, atomicity, preserved history and infra-error fidelity. |
| FR-046 | infrastructure failure remains infrastructure failure. | §11–12 Reliability/history | T1506,T1509,T1514 | Idempotency/concurrency/fault/history tests prove replay/mismatch, one-winner CAS, atomicity, preserved history and infra-error fidelity. |
| FR-047 | deterministic fixtures can complete A5001/A5002 without real AI. | §14–16 No-AI/negative-space verification | T1517 | Static/import/API/schema guards + no-network exact-head fixture prove no AI authority, generic engine or Phase4 truth. |
| FR-048 | AI output is never review authority. | §14–16 No-AI/negative-space verification | T1517 | Static/import/API/schema guards + no-network exact-head fixture prove no AI authority, generic engine or Phase4 truth. |
| FR-049 | no generic questionnaire/workflow/rules/scoring/recommendation engine is introduced. | §14–16 No-AI/negative-space verification | T1517 | Static/import/API/schema guards + no-network exact-head fixture prove no AI authority, generic engine or Phase4 truth. |
| FR-050 | no Phase 4 Plan/Task/Checkin/Review/Outcome/Schedule/Notification truth is introduced. | §14–16 No-AI/negative-space verification | T1517 | Static/import/API/schema guards + no-network exact-head fixture prove no AI authority, generic engine or Phase4 truth. |

## 19. Acceptance Coverage Matrix — 70/70

| AS | Frozen scenario | Test layer | Owner task(s) | Expected mechanical assertion |
|---|---|---|---|---|
| AS-01 | Legal A5001 USER_INITIATED entry with valid Family Alliance target subject succeeds. | contract/integration/dependency | T1504,T1506 | Assert exact node/stream/subject discriminator, legal entry and sibling independence; dependency inventory rejects unauthorized sibling prerequisite. |
| AS-02 | Legal A5002 USER_INITIATED entry with valid Contract-version subject succeeds. | contract/integration/dependency | T1507,T1509 | Assert exact node/stream/subject discriminator, legal entry and sibling independence; dependency inventory rejects unauthorized sibling prerequisite. |
| AS-03 | A5001 output is stored only as the A5001 artifact type and node A5001 state. | contract/integration/dependency | T1505,T1517 | Assert exact node/stream/subject discriminator, legal entry and sibling independence; dependency inventory rejects unauthorized sibling prerequisite. |
| AS-04 | A5002 output is stored only as the A5002 artifact type and node A5002 state. | contract/integration/dependency | T1508,T1517 | Assert exact node/stream/subject discriminator, legal entry and sibling independence; dependency inventory rejects unauthorized sibling prerequisite. |
| AS-05 | completing A5001 leaves A5002 incomplete. | contract/integration/dependency | T1506 | Assert exact node/stream/subject discriminator, legal entry and sibling independence; dependency inventory rejects unauthorized sibling prerequisite. |
| AS-06 | completing A5002 leaves A5001 incomplete. | contract/integration/dependency | T1509 | Assert exact node/stream/subject discriminator, legal entry and sibling independence; dependency inventory rejects unauthorized sibling prerequisite. |
| AS-07 | A5001 submitted with Contract-review payload/scope is rejected. | contract/integration/dependency | T1503,T1504 | Assert exact node/stream/subject discriminator, legal entry and sibling independence; dependency inventory rejects unauthorized sibling prerequisite. |
| AS-08 | A5002 submitted with Family-Alliance-review payload/scope is rejected. | contract/integration/dependency | T1503,T1507 | Assert exact node/stream/subject discriminator, legal entry and sibling independence; dependency inventory rejects unauthorized sibling prerequisite. |
| AS-09 | A5001 does not require Slice 14/Contract runtime as a business prerequisite once A5001 dependencies are available. | contract/integration/dependency | T1501,T1517 | Assert exact node/stream/subject discriminator, legal entry and sibling independence; dependency inventory rejects unauthorized sibling prerequisite. |
| AS-10 | A5002 does not require Slice 13/Family Alliance runtime as a business prerequisite once A5002 dependencies are available. | contract/integration/dependency | T1501,T1517 | Assert exact node/stream/subject discriminator, legal entry and sibling independence; dependency inventory rejects unauthorized sibling prerequisite. |
| AS-11 | A5001 bound to another Case’s target item is denied. | security/RLS/provenance | T1510 | Assert authoritative Case/Family/actor/source visibility and provenance; deny wrong scope without leakage; preserve explicit unknown/missing child input. |
| AS-12 | A5002 bound to another Case’s Contract version is denied. | security/RLS/provenance | T1510 | Assert authoritative Case/Family/actor/source visibility and provenance; deny wrong scope without leakage; preserve explicit unknown/missing child input. |
| AS-13 | cross-Family source/evidence reference is denied by application authorization and RLS. | security/RLS/provenance | T1510 | Assert authoritative Case/Family/actor/source visibility and provenance; deny wrong scope without leakage; preserve explicit unknown/missing child input. |
| AS-14 | wrong actor is denied. | security/RLS/provenance | T1510 | Assert authoritative Case/Family/actor/source visibility and provenance; deny wrong scope without leakage; preserve explicit unknown/missing child input. |
| AS-15 | participant presence without the required action privilege cannot submit review. | security/RLS/provenance | T1510 | Assert authoritative Case/Family/actor/source visibility and provenance; deny wrong scope without leakage; preserve explicit unknown/missing child input. |
| AS-16 | genuine child input remains child-sourced. | security/RLS/provenance | T1504,T1510 | Assert authoritative Case/Family/actor/source visibility and provenance; deny wrong scope without leakage; preserve explicit unknown/missing child input. |
| AS-17 | parent-transcribed child opinion is not silently reclassified as child-sourced. | security/RLS/provenance | T1504,T1510 | Assert authoritative Case/Family/actor/source visibility and provenance; deny wrong scope without leakage; preserve explicit unknown/missing child input. |
| AS-18 | missing optional child input does not create fabricated child data and does not automatically block a valid parent-sourced review. | security/RLS/provenance | T1504 | Assert authoritative Case/Family/actor/source visibility and provenance; deny wrong scope without leakage; preserve explicit unknown/missing child input. |
| AS-19 | unknown/insufficient source remains explicit UNKNOWN/NOT_COLLECTED rather than being inferred. | security/RLS/provenance | T1504,T1507 | Assert authoritative Case/Family/actor/source visibility and provenance; deny wrong scope without leakage; preserve explicit unknown/missing child input. |
| AS-20 | A5001 can review a partially executed target list; all targets need not be complete. | domain/history/scope-negative | T1504 | Assert partial-target/history semantics and absence of Goal/Task/Checkin/universal scoring. |
| AS-21 | A5001 preserves old target-list/progress history after a new evaluation. | domain/history/scope-negative | T1515 | Assert partial-target/history semantics and absence of Goal/Task/Checkin/universal scoring. |
| AS-22 | A5001 does not create Common Core Goal/Task/Checkin. | domain/history/scope-negative | T1517 | Assert partial-target/history semantics and absence of Goal/Task/Checkin/universal scoring. |
| AS-23 | A5001 cannot convert its responses into a universal success score absent formal authority. | domain/history/scope-negative | T1504,T1517 | Assert partial-target/history semantics and absence of Goal/Task/Checkin/universal scoring. |
| AS-24 | A5002 binds the exact Contract version under evaluation. | domain/repository/history | T1507 | Assert exact Contract-version provenance, no silent switch and no A4012/Plan/Outcome side effect. |
| AS-25 | stale/superseded-current mismatch cannot silently switch the review to another Contract version. | domain/repository/history | T1507,T1513 | Assert exact Contract-version provenance, no silent switch and no A4012/Plan/Outcome side effect. |
| AS-26 | historical A5002 remains bound to the old Contract after A4012 later supersedes it. | domain/repository/history | T1507,T1515 | Assert exact Contract-version provenance, no silent switch and no A4012/Plan/Outcome side effect. |
| AS-27 | A5002 can record evidence suggesting an A4012 trigger without creating a new Contract version. | domain/repository/history | T1507,T1508 | Assert exact Contract-version provenance, no silent switch and no A4012/Plan/Outcome side effect. |
| AS-28 | A5002 completion does not execute A4012. | domain/repository/history | T1507,T1517 | Assert exact Contract-version provenance, no silent switch and no A4012/Plan/Outcome side effect. |
| AS-29 | A5002 does not create Checkin/Outcome/Plan truth from A4011 support history. | domain/repository/history | T1517 | Assert exact Contract-version provenance, no silent switch and no A4012/Plan/Outcome side effect. |
| AS-30 | wrong Family is denied without cross-family enumeration. | control-plane integration/race | T1510 | Assert current Authorization/Consent/Compliance/Safety/primary gates fail closed and leave no completed residue. |
| AS-31 | wrong Case is denied. | control-plane integration/race | T1510 | Assert current Authorization/Consent/Compliance/Safety/primary gates fail closed and leave no completed residue. |
| AS-32 | Safety Hold blocks ordinary review completion and leaves no completed artifact/state residue. | control-plane integration/race | T1511 | Assert current Authorization/Consent/Compliance/Safety/primary gates fail closed and leave no completed residue. |
| AS-33 | Compliance block leaves no completed artifact/state residue. | control-plane integration/race | T1511 | Assert current Authorization/Consent/Compliance/Safety/primary gates fail closed and leave no completed residue. |
| AS-34 | required Consent revoked before commit blocks completion. | control-plane integration/race | T1511 | Assert current Authorization/Consent/Compliance/Safety/primary gates fail closed and leave no completed residue. |
| AS-35 | Authorization denial cannot be bypassed by valid Consent. | control-plane integration/race | T1511 | Assert current Authorization/Consent/Compliance/Safety/primary gates fail closed and leave no completed residue. |
| AS-36 | Compliance/Safety/Consent checks cannot be bypassed by client flags. | control-plane integration/race | T1511 | Assert current Authorization/Consent/Compliance/Safety/primary gates fail closed and leave no completed residue. |
| AS-37 | same idempotency key + same A5001 payload returns the original committed result. | idempotency | T1512 | Assert idempotent replay/mismatch, one-winner CAS, stale conflicts, cross-stream isolation and full rollback on injected failure. |
| AS-38 | same idempotency key + different payload returns idempotency conflict. | idempotency | T1512 | Assert idempotent replay/mismatch, one-winner CAS, stale conflicts, cross-stream isolation and full rollback on injected failure. |
| AS-39 | same idempotency key behavior is independently proven for A5002. | idempotency | T1512 | Assert idempotent replay/mismatch, one-winner CAS, stale conflicts, cross-stream isolation and full rollback on injected failure. |
| AS-40 | two concurrent A5001 submissions with the same expected node revision produce one current winner; stale writer fails. | concurrency | T1513 | Assert idempotent replay/mismatch, one-winner CAS, stale conflicts, cross-stream isolation and full rollback on injected failure. |
| AS-41 | two concurrent A5002 submissions with the same expected subject/node revision produce one current winner. | concurrency | T1513 | Assert idempotent replay/mismatch, one-winner CAS, stale conflicts, cross-stream isolation and full rollback on injected failure. |
| AS-42 | stale target-list revision causes a truthful conflict with no last-write-wins. | concurrency | T1513 | Assert idempotent replay/mismatch, one-winner CAS, stale conflicts, cross-stream isolation and full rollback on injected failure. |
| AS-43 | stale Contract version/revision causes a truthful conflict. | concurrency | T1513 | Assert idempotent replay/mismatch, one-winner CAS, stale conflicts, cross-stream isolation and full rollback on injected failure. |
| AS-44 | injected failure after Evidence write but before artifact/state commit rolls the whole business transaction back. | fault-injection | T1514 | Assert idempotent replay/mismatch, one-winner CAS, stale conflicts, cross-stream isolation and full rollback on injected failure. |
| AS-45 | injected failure before idempotency settlement leaves no successful idempotency record. | fault-injection | T1514 | Assert idempotent replay/mismatch, one-winner CAS, stale conflicts, cross-stream isolation and full rollback on injected failure. |
| AS-46 | A5001 concurrent write cannot overwrite A5002 and vice versa. | concurrency | T1513 | Assert idempotent replay/mismatch, one-winner CAS, stale conflicts, cross-stream isolation and full rollback on injected failure. |
| AS-47 | USER_TIMELINE_REVIEW re-entry creates a later A5001 artifact revision and preserves prior history. | history/re-entry | T1515 | Assert append/supersede history, prior-content immutability and full gate/revision recheck on re-entry. |
| AS-48 | A5002 re-entry for a later Contract version creates a new artifact bound to that version and preserves prior review. | history/re-entry | T1515 | Assert append/supersede history, prior-content immutability and full gate/revision recheck on re-entry. |
| AS-49 | correction never destructively rewrites the earlier evaluation. | history/re-entry | T1515 | Assert append/supersede history, prior-content immutability and full gate/revision recheck on re-entry. |
| AS-50 | re-entry rechecks primary Case, Authorization, Consent, Compliance, Safety, package and revisions. | history/re-entry | T1511,T1515 | Assert append/supersede history, prior-content immutability and full gate/revision recheck on re-entry. |
| AS-51 | USER_INITIATED A5001 works when Phase 4 Schedule is absent. | scheduled-entry integration/negative | T1516 | Assert USER_INITIATED without Phase4; untrusted SCHEDULED unavailable with zero schedule/job/notification truth; fixture is test-only. |
| AS-52 | USER_INITIATED A5002 works when Phase 4 Schedule is absent. | scheduled-entry integration/negative | T1516 | Assert USER_INITIATED without Phase4; untrusted SCHEDULED unavailable with zero schedule/job/notification truth; fixture is test-only. |
| AS-53 | production request claiming SCHEDULED without authoritative schedule-trigger context is rejected as schedule capability unavailable. | scheduled-entry integration/negative | T1516 | Assert USER_INITIATED without Phase4; untrusted SCHEDULED unavailable with zero schedule/job/notification truth; fixture is test-only. |
| AS-54 | no schedule/job/notification row is created by that rejection. | scheduled-entry integration/negative | T1516 | Assert USER_INITIATED without Phase4; untrusted SCHEDULED unavailable with zero schedule/job/notification truth; fixture is test-only. |
| AS-55 | test-only synthetic scheduled trigger can exercise entry semantics without becoming production capability. | scheduled-entry integration/negative | T1516 | Assert USER_INITIATED without Phase4; untrusted SCHEDULED unavailable with zero schedule/job/notification truth; fixture is test-only. |
| AS-56 | a future authentic scheduled trigger still cannot bypass current Authorization/Consent/Compliance/Safety/revision gates. | scheduled-entry integration/negative | T1511,T1516 | Assert USER_INITIATED without Phase4; untrusted SCHEDULED unavailable with zero schedule/job/notification truth; fixture is test-only. |
| AS-57 | A5001 completion creates no Common Core Review record. | scope-negative/static/exact-head | T1517 | Assert DB/API/import/route inventory contains no forbidden Phase3/4/generic Review truth and exact-head no-network fixture reaches bounded REVIEW_COMPLETE. |
| AS-58 | A5002 completion creates no Common Core Review record. | scope-negative/static/exact-head | T1517 | Assert DB/API/import/route inventory contains no forbidden Phase3/4/generic Review truth and exact-head no-network fixture reaches bounded REVIEW_COMPLETE. |
| AS-59 | neither node creates CASE_OVERALL. | scope-negative/static/exact-head | T1517 | Assert DB/API/import/route inventory contains no forbidden Phase3/4/generic Review truth and exact-head no-network fixture reaches bounded REVIEW_COMPLETE. |
| AS-60 | neither node creates Outcome. | scope-negative/static/exact-head | T1517 | Assert DB/API/import/route inventory contains no forbidden Phase3/4/generic Review truth and exact-head no-network fixture reaches bounded REVIEW_COMPLETE. |
| AS-61 | neither node creates or adjusts Plan. | scope-negative/static/exact-head | T1517 | Assert DB/API/import/route inventory contains no forbidden Phase3/4/generic Review truth and exact-head no-network fixture reaches bounded REVIEW_COMPLETE. |
| AS-62 | neither node creates Task or Checkin. | scope-negative/static/exact-head | T1517 | Assert DB/API/import/route inventory contains no forbidden Phase3/4/generic Review truth and exact-head no-network fixture reaches bounded REVIEW_COMPLETE. |
| AS-63 | neither node creates Follow-up Schedule. | scope-negative/static/exact-head | T1517 | Assert DB/API/import/route inventory contains no forbidden Phase3/4/generic Review truth and exact-head no-network fixture reaches bounded REVIEW_COMPLETE. |
| AS-64 | neither node creates pg-boss job or Notification truth. | scope-negative/static/exact-head | T1517 | Assert DB/API/import/route inventory contains no forbidden Phase3/4/generic Review truth and exact-head no-network fixture reaches bounded REVIEW_COMPLETE. |
| AS-65 | no AI/model call is required to complete the deterministic happy path. | scope-negative/static/exact-head | T1517 | Assert DB/API/import/route inventory contains no forbidden Phase3/4/generic Review truth and exact-head no-network fixture reaches bounded REVIEW_COMPLETE. |
| AS-66 | model output alone cannot complete either node. | scope-negative/static/exact-head | T1517 | Assert DB/API/import/route inventory contains no forbidden Phase3/4/generic Review truth and exact-head no-network fixture reaches bounded REVIEW_COMPLETE. |
| AS-67 | repository scope guard finds no second node registry/routing table. | scope-negative/static/exact-head | T1517 | Assert DB/API/import/route inventory contains no forbidden Phase3/4/generic Review truth and exact-head no-network fixture reaches bounded REVIEW_COMPLETE. |
| AS-68 | repository scope guard finds no generic Review engine/entity/table/API introduced by Slice 15. | scope-negative/static/exact-head | T1517 | Assert DB/API/import/route inventory contains no forbidden Phase3/4/generic Review truth and exact-head no-network fixture reaches bounded REVIEW_COMPLETE. |
| AS-69 | repository scope guard finds no generic questionnaire/forms/rules/scoring engine. | scope-negative/static/exact-head | T1517 | Assert DB/API/import/route inventory contains no forbidden Phase3/4/generic Review truth and exact-head no-network fixture reaches bounded REVIEW_COMPLETE. |
| AS-70 | exact-head full deterministic Phase 2 fixture can reach valid A5001 and A5002 Scene REVIEW_COMPLETE without real AI or Phase 4 runtime. | scope-negative/static/exact-head | T1517 | Assert DB/API/import/route inventory contains no forbidden Phase3/4/generic Review truth and exact-head no-network fixture reaches bounded REVIEW_COMPLETE. |

## 20. Negative-Space Coverage Matrix — 28/28

| NS | Frozen prohibition | Mechanical proof | Owner task(s) |
|---|---|---|---|
| NS-01 | generic Review domain owner. | Static symbol/import/domain-owner guard rejects generic Review owner/service/aggregate. | T1517 |
| NS-02 | reviews table/repository/API owned by Slice 15. | Migration/table/repository/API inventory rejects reviews table, generic repository and /reviews surface. | T1517 |
| NS-03 | CASE_OVERALL Review. | Schema/API/static guard rejects CASE_OVERALL Review record/discriminator. | T1517 |
| NS-04 | Outcome write. | DB mutation/API/import guard rejects Outcome writes. | T1517 |
| NS-05 | Plan/Task/Checkin write. | DB/API/import guard rejects Plan/Task/Checkin writes. | T1517 |
| NS-06 | Follow-up Schedule write. | DB/API/import guard rejects Follow-up Schedule writes. | T1517 |
| NS-07 | scheduler/cron/pg-boss job creation. | Worker/import/schema guard rejects cron/timer/pg-boss jobs. | T1517 |
| NS-08 | notification/delivery status. | Notification module/table/status inventory rejects notification/delivery truth. | T1517 |
| NS-09 | generic questionnaire/form builder. | Static symbol/import/schema guard rejects generic questionnaire/form builder. | T1517 |
| NS-10 | generic scoring/effectiveness engine. | Static domain/import guard rejects generic scoring/effectiveness engine. | T1517 |
| NS-11 | AI evaluator authority. | No-network/import guard + domain test rejects model authority. | T1517 |
| NS-12 | second node manifest/registry. | Static repository guard asserts Slice11 manifest is sole registry. | T1517 |
| NS-13 | second routing table. | Static repository guard asserts Slice11 routing is sole route table. | T1517 |
| NS-14 | numeric next-node inference. | Static guard rejects numeric next-node inference. | T1517 |
| NS-15 | client-authoritative node/stream/next route. | Contract/security tests reject client-authoritative stream/nextNode. | T1517 |
| NS-16 | second Scene state or artifact owner. | Owner table/schema/import inventory proves no duplicate Scene/Evidence store. | T1502,T1517 |
| NS-17 | second Evidence store. | Owner table/schema/import inventory proves no duplicate Scene/Evidence store. | T1502,T1517 |
| NS-18 | second Consent/Compliance/Safety/Authorization owner. | Owner import/action inventory proves only existing Authorization/Consent/Compliance/Safety owners are consumed. | T1510,T1511,T1517 |
| NS-19 | second idempotency/audit system. | Schema/table/import guard proves existing idempotency/audit owner is reused. | T1512,T1517 |
| NS-20 | destructive overwrite of prior evaluation history. | Before/after history test proves prior artifact remains unchanged and later revision is appended/superseding. | T1515 |
| NS-21 | A5001/A5002 semantic collapse. | Typed discriminator + manifest tests prove A5001/A5002 cannot collapse. | T1503,T1517 |
| NS-22 | A5001 completion automatically completing A5002. | Complete A5001 then assert A5002 state/artifact unchanged. | T1506,T1517 |
| NS-23 | A5002 automatically creating A4012. | A5002 negative test asserts no Contract mutation and no A4012 invocation. | T1507,T1508,T1517 |
| NS-24 | fake scheduled execution. | Production import/route/DB inventory + runtime negative test proves no fake schedule/notification capability. | T1516,T1517 |
| NS-25 | fake notification. | Production import/route/DB inventory + runtime negative test proves no fake schedule/notification capability. | T1516,T1517 |
| NS-26 | fake child input. | Provenance test rejects child-source fabrication; genuine child source requires genuine identity. | T1504,T1510,T1517 |
| NS-27 | Phase 3/4 implementation pulled into Slice 15. | Dependency/import/route/schema guards prohibit AI runtime and Phase4 Review/Plan/Task/Checkin/Outcome/Schedule/Notification. | T1517 |
| NS-28 | modification of four formal Docs or frozen Slice 8–14 semantics. | Exact-head diff/blob guard asserts four Docs and frozen Slice 8–15 authority unchanged. | T1501,T1517 |

## 21. Audit 1 Contract

Audit1 compares Frozen Spec vs Plan vs Checklist vs Tasks. Required: exact Frozen blob; FR50/50; AS70/70; NS28/28; A5001/A5002 separation; Phase2/4 boundary; single owners; dependency fidelity; executable tasks; no hidden product decision; checklist FAIL=0; Scope Drift=0.

Planning Quality Gate and Runtime Dependency Gate are separate. Audit1 PASS does not open either stream.

## 22. Planning Freeze

Plan COMPLETE. Checklist COMPLETE. Tasks COMPLETE. Audit1 FINAL PASS after post-commit exact revalidation. Open Product Decisions 0. Open Planning Decisions 0. Scope Drift 0. A5001 Gate BLOCKED. A5002 Gate BLOCKED. Overall Implement Gate BLOCKED. READY FOR DEVELOPMENT NO.
