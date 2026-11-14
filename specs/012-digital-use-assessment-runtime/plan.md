# Slice 12 Implementation Plan — 012-digital-use-assessment-runtime

Repository: pyxm1618/xiaoshuyin
Role: Slice 12 Plan AI 2
Previous Frozen Spec commit: 5e397fee86eb29da1acc1a5a1d176e0c73aa8849
Previous Frozen Spec blob: e0ed342dc144fedf5b516b5295a23cbcc31722bc
Previous Planning Head: 496f8d33c7147fcb77848fa1acc8e990d75c2ab0
Final closeout baseline origin/main: ac3e6212c06781a8597af5928a08c62a24623889 / CI #429 SUCCESS
Status: NARROW RECONCILIATION COMPLETE / AUDIT 1 FINAL PASS PRESERVED / FINAL DEVELOPMENT-START GATE PASS / IMPLEMENT GATE OPEN

This Plan translates the Frozen Spec into an executable engineering contract. It does not authorize development.


## 1. Authority Gate

Narrow reconciliation verified fresh remote truth:

- origin/main = ac3e6212c06781a8597af5928a08c62a24623889.
- PR #34 Integrated Triage Authority Remediation = MERGED / CLOSED.
- Previous Frozen Spec input commit = 5e397fee86eb29da1acc1a5a1d176e0c73aa8849; blob = e0ed342dc144fedf5b516b5295a23cbcc31722bc.
- Previous Planning input head = 496f8d33c7147fcb77848fa1acc8e990d75c2ab0.
- Docs/总产品需求.md = 67724000cb9bb81c40489c04db28d899bd1df74c.
- Docs/V1产品需求.md = 43457f881ead7b991267266bf01db1fdb2af54e4.
- Docs/总体技术架构.md = 9b08371edc976fa281469dfee8dc19962452e3b0.
- Docs/V1技术设计.md = 88db9d938a409a30addb4b86aec783301940049b.
- Selection Gate, Slice identity, A1001–A2010 topology and downstream scope are not reopened.
- Only spec.md, plan.md, checklist.md and tasks.md may change in this reconciliation.
- No Docs, production code, migration, tests implementation or historical owner artifact may be changed.

Authority drift classification: **RECONCILED — PR #34 SEMANTIC AUTHORITY DELTA ONLY, WITH CURRENT DEPENDENCY EXECUTION TRUTH REFRESHED.**

## 2. Frozen Requirement Traceability

FR-001 Single Scene runtime truth → sections 6–8 → T1203/T1205/T1206.
FR-002 Manifest-only topology → sections 4 and 8 → T1202/T1209.
FR-003 Evidence fidelity → sections 4, 7 and 9 → T1210–T1213.
FR-004 Assessment entry → section 8 → T1207.
FR-005 A1001 fidelity → section 9 → T1210.
FR-006 01002/01003 fidelity → section 9 → T1210.
FR-007 Integrated triage → section 9 → T1211.
FR-008 Severe branches → section 9 → T1211.
FR-009 Supplemental-assessment boundary → section 9 → T1212.
FR-010 A2003/A200401 fidelity → sections 7 and 9 → T1213.
FR-011 A2004–A2009 fidelity → section 9 → T1213.
FR-012 A2007 timeline artifact → sections 7 and 9 → T1214.
FR-013 A2010 summary artifact → sections 7 and 9 → T1215.
FR-014 Problem Formulation gate → section 10 → T1216.
FR-015 Authorization/RLS → sections 7 and 11 → T1203/T1204/T1218.
FR-016 Safety/Compliance/Consent precedence → sections 11–12 → T1207/T1209/T1218.
FR-017 Idempotency → section 13 → T1207/T1209/T1218.
FR-018 Concurrency → section 14 → T1218.
FR-019 Atomicity → section 15 → T1207/T1209/T1216/T1218.
FR-020 Truthful downstream unavailability → sections 9 and 16 → T1212/T1215.
FR-021 Deterministic execution → section 19 → T1219.
FR-022 No upstream mutation → section 20 → T1201/T1219/T1220.

Acceptance mapping:

- 1–8 → T1210, with 4/6/8 also exercised by T1211.
- 9–11 → T1211/T1212.
- 12–14 → T1212.
- 15–18 → T1213 and negative hardening in T1218.
- 19 → T1214.
- 20 → T1215.
- 21–33 → T1205/T1208/T1209/T1218 as applicable.
- 34 → T1216.
- 35–36 → T1219.
- T1219 must retain an explicit one-to-one evidence table for all 36 scenarios at implementation head.

## 3. Scope Contract

In scope:

- first real Digital Use Assessment/Triage/Preparation runtime;
- canonical nodes A1001, 01002, 01003, A2001, A1000, A2002, 01005, 01006, 01004, 01000, A2003, A2004, A2005, A2006, A2007, A2008, A2009, A2010;
- Scene current projection;
- Scene artifacts needed by 01000 boundary, A2007 and A2010;
- Evidence integration;
- four approved public APIs;
- StartAssessment and PresentProblemFormulation owner integration;
- Safety, Compliance, Consent and Authorization gates;
- idempotency, optimistic concurrency, atomicity, auditability and security negatives.

Explicitly out of scope:

- A3000–A3113 FAMILY_ALLIANCE runtime;
- A4001–A4012 PHONE_USE_CONTRACT runtime;
- A5001/A5002 Review runtime;
- Goal, InterventionInstance, PlanVersion, Task, Checkin, Review, Outcome;
- real follow-up schedules, pg-boss jobs and notification dispatch;
- AI, RAG, prompts, model routing and model-generated questionnaire content;
- a second Scene;
- generic workflow, rule, form or questionnaire engines;
- XState;
- one-service-per-node or one-table-per-node architecture;
- a second manifest, route table, Evidence truth or idempotency store.

A200401 is a record marker only. It is never a node, route target, scene_node_state, endpoint or second business truth.

## 4. Ownership / Reuse Mapping

### Slice 11

Consumes the merged authoritative Digital Use node-manifest and deterministic router. Slice 12 must not duplicate node identities, allowedNext, route tables or numeric adjacency. Client-provided nextNode is never authority.

### Evidence Core

Substantive facts remain in existing dialogue_messages/assertions/observations and approved Evidence writers. Scene state stores refs and progression only. No Assessment answers truth table or Assessment JSON source of truth.

### Slice 8

StartAssessment, PresentProblemFormulation, Problem Formulation state/version and reassessment remain Slice 8/Common Core ownership. Slice 12 may only call authoritative owner seams; it must not write problem_formulations directly or embed formulation JSON into Scene state.

### Slice 9

Consumes the authoritative same-client Drizzle/RLS transaction foundation and ordinary-progression Safety guard. Slice 12 does not implement Safety state transitions or a new data-access abstraction.

### Slice 10

Consumes server-owned Feature Identity and Compliance evaluation/obligation guard. Client feature codes are not authority. Common Core evaluator receives no Digital Use-specific branch logic.

### Existing merged owners

Reuse current Case/primary/version, Authorization, Consent, Participation, idempotency, business audit and Case event mechanisms. Participant presence alone does not grant Assessment authority.

Consent is an owner boundary, not Scene/Evidence truth. The 01004 accept/decline decision must be represented through the authoritative Consent owner contract with an explicit supplemental-assessment purpose/scope and auditable decision state. Slice 12 must not store a private consent boolean in scene_node_states, scene_artifacts or ordinary Evidence and then treat it as Consent truth. At development reconciliation, if the merged Consent owner cannot represent this purpose-scoped accept/decline without semantic distortion, STOP for an owner-approved narrow Consent seam/schema remediation; Slice 12 may not invent a parallel consent ledger.


## 5. Development-Start Implement Gate

Planning/Audit reconciliation is complete. The previous exact prerequisite has been closed by PR #35; production development is now authorized by this gate.

Current verified dependency state on main ac3e6212c06781a8597af5928a08c62a24623889:

1. Slice 8 Problem Formulation Core — PR #26 MERGED: PASS.
2. Slice 9 Safety Hold Control Foundation — PR #28 MERGED; PR #29 post-merge test-context remediation MERGED: PASS.
3. Slice 10 Compliance Feature Policy Foundation — PR #30 MERGED: PASS.
4. Slice 11 Digital Use Node Manifest / deterministic routing foundation — PR #31 MERGED: PASS.
5. Slice 8 caller-owned same-transaction command seam — PR #32 MERGED: PASS. Main exports the owner seam for StartAssessment and PresentProblemFormulation inside a caller-owned transaction; Slice 12 must consume it and cannot duplicate it.
6. 01004 purpose-scoped Consent owner capability — PR #33 MERGED: PASS. Main exposes recordPurposeScopedConsentDecision in the one Consent ledger; Scene/Evidence cannot become Consent truth.
7. latest main / migration order / shared-contract re-read: PASS.
8. Frozen Slice 12 semantics reconciled to PR #34 Integrated Triage Authority: PASS.
9. approved 01004 supplemental-assessment disclosure authority — PR #35 MERGED; exact purpose/reference/version/hash authority present: **PASS**.

**IMPLEMENT GATE: OPEN.**

Previous blocker closure:

> PR #35 now supplies APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY and CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE for DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT. packages/compliance/src/supplemental-consent.ts deliberately remains fail-closed by default, so Slice 12 must explicitly inject the approved authority into the existing recordPurposeScopedConsentDecision seam. No second Consent truth or private Slice 12 disclosure authority is permitted.

Gate closure evidence:

- current main was re-read and equals ac3e6212c06781a8597af5928a08c62a24623889;
- CI #429 completed successfully;
- exact server-owned disclosure reference/version/hash authority is present;
- the single Consent owner seam is preserved;
- no new Authority / owner capability is required before development.

## 6. Planned Project Structure

Exact names may reconcile with merged Slice 8–11 structure, but responsibilities are fixed.

- db/migrations/<next>_digital_use_assessment_runtime.sql: additive tables/RLS/grants/shared vocab extensions only.
- merged shared Drizzle schema path: typed projection for new tables.
- packages/scenes/digital-use assessment-specific pure validators/builders: no second manifest/router.
- packages/domain or merged Scene application layer: narrow repository/service integration using owner seams.
- packages/contracts: request/response schemas for four approved APIs.
- packages/authorization: only minimal approved Scene/Assessment actions if merged owners do not already provide them.
- apps/server/api: four approved routes only.
- tests: domain/service/repository/migration/RLS/contract/integration/concurrency/idempotency/fault/security/acceptance.
- scripts or CI: only narrow extension of existing governance/CI; no new deployment system.

No production file may become a second node registry or route authority.

## 7. Data Model

### 7.1 scene_node_states

Purpose: current Scene progression projection, not historical family-fact truth.

Minimum fields:

- id uuid primary key.
- family_id uuid.
- case_id uuid.
- scene_package_version text.
- node_code text.
- source_node_code text.
- status: LOCKED / AVAILABLE / IN_PROGRESS / COMPLETED / SKIPPED / BLOCKED.
- branch_reason_codes text array.
- input_refs JSON array.
- output_refs JSON array.
- entered_at.
- completed_at nullable.
- revision integer >= 1.

Required invariants:

- composite Case/Family FK with RESTRICT.
- one current projection row per Case/node; package version is part of the bound projection, not a loophole for two simultaneously-current copies.
- no A200401 row.
- 01002/01003 remain strings with leading zero.
- refs are structured arrays.
- state/timestamp shape is valid.
- revision uses compare-and-set and cannot silently reset.
- table is sparse; do not prepopulate the full graph.

The first legal A1001 projection anchors the current Scene package binding. All current Slice 12 node projections must match it. Formal owner-authorized reassessment may rebind the current projection only atomically while preserving Evidence/artifact provenance; ordinary node response cannot silently rebind package.

### 7.2 scene_artifacts

Purpose: user-viewable Scene output history that is not core Evidence truth.

Minimum fields:

- id uuid primary key.
- family_id / case_id.
- scene_package_version.
- artifact_type.
- schema_version.
- source_node_code.
- structured content/data.
- owner identity.
- server-owned visibility.
- structured source_refs.
- revision.
- supersedes_id.
- created_at.

Required invariants:

- Case/Family FK with RESTRICT.
- owner resolves to same authorized Family.
- append-only normal runtime.
- correction appends a new revision; no in-place historical rewrite.
- artifact provenance carries package/source refs.
- Slice 12 writes only 01000 boundary/handoff, A2007 timeline and A2010 summary artifact classes.

If Slice 11 remains code-backed, store its validated immutable package version; do not invent a package table merely for an FK. If merged Slice 11 already owns a package table, use that owner contract after T1202 reconciliation.

### 7.3 Reference integrity

input_refs/output_refs/source_refs are typed discriminated refs to existing authoritative records such as DIALOGUE_MESSAGE, ASSERTION, OBSERVATION, SCENE_ARTIFACT and RECORD_MARKER.

A200401 may exist only as RECORD_MARKER metadata associated with A2003 content.

Every ref is resolved inside the authorized business transaction and must prove:

- same Family;
- same Case where Case-scoped;
- allowed visibility/purpose;
- current/superseded validity when current truth is required.

Cross-Case Evidence ref is a hard failure.

### 7.4 RLS / grants / retention

Both new tables:

- ENABLE ROW LEVEL SECURITY.
- FORCE ROW LEVEL SECURITY.
- runtime remains NOBYPASSRLS/non-owner.
- Family is a DB hard boundary.
- application Authorization is the stronger business permission boundary.

Node state receives only minimum SELECT/INSERT/column-level UPDATE. Artifacts receive SELECT/INSERT only in normal runtime. No normal DELETE/TRUNCATE/public grants.

Slice 12 adds no delete endpoint. RESTRICT prevents accidental cascade erasure. Later global data-right deletion remains owner-governed. Consent revocation blocks future affected processing but does not erase historical Evidence/Scene audit history by itself.

### 7.5 01004 Consent persistence boundary

01004 is not ordinary Assessment Evidence. Its accept/decline outcome is a purpose-scoped Consent fact owned by the existing Consent domain.

Development rules:

- use the authoritative Consent owner repository/service and its current version/audit semantics;
- introduce only the minimum owner-approved purpose/decision vocabulary required to represent supplemental-assessment consent if that vocabulary is not already present after upstream merges;
- acceptance and refusal must both be auditable without fabricating guardian identity or reusing UNDER_14 guardian-consent semantics;
- the decision must bind to the authorized actor/subject/Case and exact supplemental-assessment purpose required by 01004;
- 01004 Consent does not authorize unrelated processing and does not grant Family/Case/Participant access;
- node state may reference the Consent record/result but cannot become the Consent source of truth;
- if the owner contract cannot represent this safely, the implementation stops rather than falling back to Evidence or Scene JSON.

No second consent table or Slice 12 consent state machine is permitted.

## 8. Runtime Transaction Model

All mutations use one authoritative same-client transaction. No nested transaction and no second checked-out client.

### 8.1 Assessment start/resume

Flow:

1. authenticate and resolve real actor/Family/Case;
2. authorize via existing owner;
3. establish RLS context;
4. lock/re-read current Case and require current primary/open Case;
5. run authoritative Safety, Consent and Compliance gates;
6. resolve authoritative Slice 11 package version;
7. INTAKE only: invoke same-transaction StartAssessment owner seam;
8. already legal ASSESSMENT for same run: resume, do not create a second Assessment object;
9. later phase: conflict/reassessment-required, never reset via POST assessments;
10. initialize/expose A1001 current projection if absent;
11. write required owner event/audit;
12. complete shared idempotency result atomically and commit.

A StartAssessment success with failed A1001 initialization is forbidden; fault injection must prove rollback of the whole business result.

### 8.2 Scene/node reads

GET scene and GET node:

- re-resolve authorization/RLS every request;
- return only current server projection and authorized artifacts;
- expose current Case/package/node revision tokens;
- derive current/reachable/available status from stored projection + Slice 11 topology + owner gates;
- reject fabricated node and A200401;
- never mutate state merely because the client is stale.

### 8.3 Node completion

Single bounded orchestration, not one service per node.

Transaction order:

1. resolve/authorize actor + real Family/Case.
2. perform anti-enumeration-safe idempotency acquisition.
3. lock/re-read Case and current node projection.
4. verify primary, phase, package and expected revision.
5. run Safety.
6. run Compliance and supported-obligation guard.
7. validate applicable Consent.
8. validate manifest node, reachability and input/decision schema.
9. write node-specific Evidence/marker/artifact.
10. derive structured routing facts from authoritative current data.
11. call Slice 11 deterministic router.
12. compare-and-set current node revision/status.
13. create/update only legal routed projection.
14. write event/audit.
15. invoke same-transaction owner handoff if Assessment sufficiency requires Problem Formulation.
16. complete idempotency with the stable business response.
17. commit.

No client nextNode, numeric adjacency, hidden default or route-first authorization.

## 9. Canonical Node Semantics

A1001:
- accept phone, tablet, computer, game console/game device and approved other related device.
- preserve learning/research/homework, necessary contact and entertainment/gaming/video/social/non-learning purposes.
- preserve recent two-week average daily duration by purpose.
- optional total duration is Evidence only.
- preserve sleep, study/necessary-affairs and real-world activity displacement.
- preserve estimate/uncertainty.
- historical bands for 6–11 and 12–18 are auxiliary only.
- no universal under-six rejection, no invented under-six band, no duration-only route.

01002:
- approved A–F semantics, maximum two selections.
- original response remains Evidence.
- F is priority signal to 01005, not diagnosis.
- T1210 must preserve missing / no record / NOT_COLLECTED / DECLINED / UNKNOWN-without-usable-current-value / CONFLICTING / contradictory / incompatible states so T1211 can classify them mechanically.
- T1210 does not decide A2001/A2002/A2003.

01003:
- exactly one approved A–F response.
- F is priority signal to 01006.
- remains reported Evidence.
- T1210 preserves the same legal Evidence-state distinctions and never collapses Missing into Conflict.
- T1210 does not decide A2001/A2002/A2003.

Integrated Triage evaluator — T1211:
- consumes one authoritative current Evidence snapshot; no second Evidence store.
- computes only approved pure deterministic predicates: EMOTION_F, FAMILY_CONFLICT_F, DIRECT_DIGITAL_USE_IMPACT_POSITIVE, DIRECT_DIGITAL_USE_IMPACT_NEGATIVE, OTHER_NEEDS_POSITIVE, CLEAN_NON_DIGITAL_USE_STATE, MATERIAL_UNRESOLVED, OTHER_NEEDS_MATERIAL_UNRESOLVED.
- classifies Missing Family before route predicates: missing / no record / NOT_COLLECTED / DECLINED / required Evidence absent with no approved substitute, and UNKNOWN without a usable current route value → INSUFFICIENT.
- classifies Conflict Family separately: existing route-driving Evidence that is CONFLICTING, contradictory, mutually incompatible, invalid/incompatible or cannot be safely parsed → BLOCKED.
- Missing != Conflict; NOT_COLLECTED != Conflict; DECLINED != Conflict.
- fixed priority: classify 01002 first. Missing→INSUFFICIENT; Conflict→BLOCKED; valid F→01005; only valid non-F proceeds.
- only after 01002F=false classify 01003. Missing→INSUFFICIENT; Conflict→BLOCKED; valid F→01006; only valid non-F proceeds to ordinary triage.
- both valid F → 01005 wins; preserve 01003F Evidence; emit no second normal outcome.
- direct-impact required Missing Family → INSUFFICIENT.
- direct-impact route-driving Conflict that prevents a safe sign → BLOCKED.
- DIRECT_DIGITAL_USE_IMPACT_POSITIVE, or other approved current Evidence explicitly supporting continuation of the current Digital Use problem → A2003.
- DIRECT_DIGITAL_USE_IMPACT_NEGATIVE + OTHER_NEEDS_POSITIVE → A2002.
- DIRECT_DIGITAL_USE_IMPACT_NEGATIVE + OTHER_NEEDS_MATERIAL_UNRESOLVED → A2002.
- CLEAN_NON_DIGITAL_USE_STATE + no material unresolved → A2001.
- otherwise → INSUFFICIENT.
- A2001/A2002/A2003 are mutually exclusive; if multiple normal predicates are produced, fail closed as BLOCKED/ambiguous rather than choosing by order.
- No default fallthrough, duration-only route, professional threshold invention, LLM/RAG/classifier truth or client route truth.
- evaluator derives approved predicates from Evidence, then emits at most one normal Integrated Triage condition.

A2001:
- positive proof only: CLEAN_NON_DIGITAL_USE_STATE and no material unresolved.
- cannot be inferred from absence of A2002/A2003.
- retains advice→A1000, downstream user choice to continue→A2003, approved terminal return.

A2002:
- positive proof only: DIRECT_DIGITAL_USE_IMPACT_NEGATIVE plus OTHER_NEEDS_POSITIVE or OTHER_NEEDS_MATERIAL_UNRESOLVED.
- general Missing/Unknown is never routed here merely because further information would be useful.
- retains further assessment→01004, downstream user choice to continue→A2003, approved terminal return.

A2003 initial triage:
- requires positive direct Digital Use impact or other approved current Evidence explicitly supporting continuation.
- duration/band alone and default fallthrough are insufficient.
- positive direct impact + non-severe other-needs signal still yields initial A2003 while preserving other-needs Evidence.

A1000:
- approved advice content only; content is not an eligibility threshold.

01005/01006:
- preserve priority semantics and truthful external/terminal boundary.
- no fake second Scene, Referral state or successful handoff.

01004:
- explicit purpose/method/use/burden/disclaimer and explicit accept/decline.
- accept/decline is persisted only through the merged authoritative Consent owner seam under DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT; Scene state stores only the resulting reference/projection.
- decline terminates/returns without 01000 completion.
- consent is only supplemental-assessment consent; it cannot replace guardian, identity, AI, sharing or notification consent.
- Consent owner capability is now READY on main via PR #33.
- production integration must consume the PR #35 approved 01004 disclosure authority with its exact server-owned reference/version/hash through the existing Consent owner seam; Slice 12 may not invent/self-approve disclosure content.

01000:
- only 情绪测评 and 亲子互动模式测评.
- if no approved versioned instrument exists, expose approved-instrument-unavailable.
- never invent item bank, scoring, diagnostic cut-off or model questionnaire.

A2003 content collection:
- Evidence fields remain unchanged: expected duration, reason, prior methods, observed effect and difficulties.
- missing/declined stays real missing/declined.
- A200401 is record marker only.
- distinguish the initial Integrated Triage entry into A2003 from the later approved user-decision route where a user on A2001/A2002 explicitly chooses to continue the current Digital Use problem.
- the later user choice is not an initial triage predicate and must never be back-written as positive direct-impact Evidence.

A2004:
- YES→A2005.
- approved NO-like outcomes including tried-before-not-worked→A2006.
- approved fallback may choose NO branch but must preserve original uncertainty/provenance.

A2005/A2006/A2008/A2009:
- preserve each approved willingness/motivation/family-alliance explanation branch.
- no silence-as-agreement and no Intervention/Goal/Plan activation.

A2007:
- persist user-entered timeline and user-visible artifact.
- may create reminder/follow-up basis metadata only.
- no schedule truth, pg-boss job, notification or claimed delivery.
- suggested durations are not mandatory defaults.

A2010:
- deterministic user-visible solution summary derived from approved recorded data.
- may expose canonical route intent to A3000.
- must not create/complete A3000 or activate FAMILY_ALLIANCE/Intervention/Plan.
- while owner runtime is absent, downstream status is explicitly unavailable.

## 10. Problem Formulation Handoff

Assessment never goes directly to GOALS.

Handoff point is determined only by approved Assessment sufficiency + merged Slice 11 Manifest/phase metadata + current Evidence. It is never inferred from node numbering.

Candidate must preserve:

- current Evidence refs;
- Unknown;
- Conflict;
- alternative/exit/reassessment information required by Slice 8;
- mandatory dependency refs required by owner.

If a valid candidate cannot be formed without inventing facts, remain truthfully in Assessment/blocked state.

The handoff must run through an authoritative Slice 8 caller-owned transaction seam. Direct problem_formulations SQL, embedded formulation JSON, or two-transaction Scene→formulation partial success is forbidden. If merged Slice 8 cannot expose a same-transaction seam without semantic redesign, implementation stops.

## 11. Authorization / Consent / Privacy

Every read/write uses existing authorize plus RLS. Client Family, Case, Person, node and refs are untrusted.

Ordinary Assessment progression requires current primary open Case.

Invited/active participants do not gain Assessment read/write rights merely through Case participation. Access requires an existing approved purpose/visibility contract; otherwise deny.

Negative matrix includes:

- cross-Family;
- cross-Case;
- wrong Person/subject substitution;
- wrong participant;
- revoked participation;
- wrong visibility;
- wrong purpose;
- stale primary authority;
- cross-Case Evidence/artifact refs.

01004 supplemental consent cannot satisfy unrelated Consent. Revocation blocks future affected processing but does not erase history.

## 12. Safety / Compliance

Ordinary mutation order preserves independent gates:

Authentication → Authorization/Consent context → Safety → Compliance → domain preconditions → business effect.

Safety:
- use merged Slice 9 ordinary-progression guard inside caller transaction.
- held Case makes no ordinary node progress, no A2010/A3000 activation and no fake success.
- Slice 12 does not implement EnterSafetyHold/ResolveRisk.

Compliance:
- use merged Slice 10 server-owned feature descriptor and evaluator.
- no client feature code.
- missing/ambiguous/blocked policy or unsupported required obligation fails closed.
- infrastructure failure remains infrastructure failure, not ALLOW/BLOCK fabrication.
- record exact feature/revision/policy provenance needed by owner contract without logging private answers.

## 13. Idempotency

Reuse the single existing idempotency infrastructure.

Mutation identities conceptually cover:
- Assessment start/resume, reusing Slice 8 owner command identity when that is authoritative.
- Scene node response.

Scope remains actor + command_type + idempotency_key.

Fingerprint contains canonical request semantics: Case id, node code where applicable, expected package/revision, expected Case version where owner requires it, and structured response. Mutable server state is not inserted into the request hash.

Behavior:
- same key/same payload → original replay.
- same key/different payload → conflict.
- concurrent same-key → one business execution.
- in-progress work never returns fake success.
- failed transaction leaves retry possible.
- replay duplicates no Evidence/artifact/event/formulation/state.
- authorization is re-established before replay; key is not an access token.
- business commit and idempotency completion are atomic.

No second idempotency table/store.

## 14. Concurrency

Use expected node revision plus owner Case/package expectations where applicable.

Required races:

- same-node double submit;
- mutually exclusive branch submit;
- primary switch;
- Safety transition;
- Consent change/revocation;
- Compliance policy/effective snapshot change;
- package/version drift;
- Problem Formulation/reassessment transition;
- duplicate A2007/A2010 artifact creation.

Rules:

- compare-and-set increments revision exactly once.
- one legal writer wins.
- stale writer returns stable conflict/block.
- no last-write-wins overwrite.
- no two current mutually-exclusive branch outcomes.
- current package binding cannot split.
- stale pre-lock/pre-gate snapshot cannot produce success.

## 15. Atomicity / Fault Injection

Depending on node, one successful transaction may include:

- Evidence;
- A200401 marker metadata;
- Scene artifact;
- node state/revision;
- routed next projection;
- Case/Scene event;
- business audit;
- Problem Formulation handoff;
- idempotency completion.

Inject failures at minimum:

1. after Evidence write;
2. after marker construction/write;
3. during artifact insert;
4. after node CAS before next projection;
5. after router decision before audit/event;
6. during PresentProblemFormulation;
7. after audit/event before idempotency completion;
8. during idempotency completion.

Every injected failure must roll back the whole business result. Forbidden partial states include Evidence without node completion, node completion without required artifact, route advance without required consent, formulation phase advance without formulation write, or idempotency success after business rollback.

## 16. API Surface

Only:

- POST /api/v1/cases/:id/assessments.
- GET /api/v1/cases/:id/scene.
- GET /api/v1/cases/:id/scene/nodes/:nodeCode.
- POST /api/v1/cases/:id/scene/nodes/:nodeCode/responses.

POST assessments:
- start/resume only.
- path Case id is untrusted until authorized.
- mutation uses existing idempotency contract and owner-required expected Case version.
- client cannot choose Family/package/phase.

GET scene:
- authorized current projection and visible artifacts only.
- no mutation/idempotency.

GET node:
- Manifest-known node lookup only.
- server validates authorization/reachability.
- A200401/fabricated node fail.

POST response:
- structured response only.
- requires Idempotency-Key and expected node revision plus any owner-required Case expectation.
- client nextNode/feature code/Family/package selection is never authority.

Responses expose enough for safe rendering: Case/version, package version, current node/source identity, node status/revision, authorized visible artifacts, server-owned route reason, downstream availability and refresh/conflict state.

Stable error classes distinguish anti-enumerated unauthorized/not-found, validation, fabricated/A200401 node, unreachable/wrong phase, stale package/Case/node, Safety, Compliance, Consent, approved instrument unavailable, downstream unavailable and infrastructure failure. Map to existing canonical HTTP vocabulary rather than duplicating meanings.

No hidden/test/bypass/public route-mutation route.

## 17. Correction / Reassessment

Ordinary correction is legal only through Manifest-approved re-entry.

Correction:
- writes new Evidence using existing supersedes semantics;
- keeps old Evidence;
- appends artifact revision;
- increments current node revision;
- recomputes derived current projection;
- preserves audit history and original uncertain/declined values.

Formal reassessment remains Common Core-owned:
- POST assessments cannot reset history.
- use authoritative reassessment command.
- preserve Evidence/artifact history.
- reopen only Manifest-permitted work.
- update current projection by revision, not destructive delete/truncate.
- package rebind, if required, is atomic and owner-authorized.
- no direct phase reset.

## 18. Observability

Business audit metadata is sufficient to reconstruct:

- case_id and family_id;
- actor identity per existing audit contract;
- package version;
- node/source node;
- prior/new revision;
- route reason;
- Evidence/artifact refs;
- idempotency outcome;
- Safety/Compliance block class;
- Problem Formulation handoff;
- artifact type/revision;
- timestamp.

Operational logs must not copy raw private narrative, full Assessment answers, hidden consent/policy evidence or full artifact content. Logs/metrics must not become a shadow family-data store.

## 19. Verification Strategy

Required suites:

- Unit: node input validators, artifact/marker builders, triage guards, deterministic summaries.
- Domain: state/revision/ref invariants, A200401 marker-only, no invented route.
- Service: start/resume/read/complete/handoff/correction/error mapping.
- Repository: CAS, package binding, ref integrity, artifact append-only.
- Migration: fresh bootstrap + upgrade from then-current main.
- RLS: ENABLE/FORCE, grants, no-context deny, cross-Family deny.
- Contract/OpenAPI: all four routes, DTOs, errors, no hidden route.
- Integration: all canonical branches and owner gates.
- Idempotency: replay/mismatch/concurrent key/failed retry.
- Concurrency: all races in section 14.
- Fault injection: all points in section 15.
- Security negative: cross-Family/cross-Case/participant/visibility/purpose/client authority attacks.
- Scope negative: no A3000+, AI/RAG/scheduler/second Scene/second manifest/second Evidence/idempotency truth.
- Governance: Frozen Spec/Docs unchanged.
- Exact-head CI: repository-native full canonical checks.

Named mandatory regressions:

- A200401 negative-node.
- 01004 decline and consent isolation.
- 01000 no-invention.
- Unknown provenance fidelity.
- A2004–A2009 branch fidelity.
- A2007 artifact with no scheduler.
- A2010 summary with no A3000 runtime.
- fabricated and unreachable node.
- client nextNode attack.
- cross-Family/cross-Case Evidence.
- participant escalation.
- same-node concurrency.
- primary-switch race.
- atomic injected failure.
- PresentProblemFormulation handoff.
- full no-model canonical fixture.
- Integrated Triage 22-case matrix: 01002/01003 Missing-vs-Conflict, both-F, direct-impact Missing/Conflict, A2001/A2002/A2003 positive proofs, duration-only, no-normal-proof, no-default and repeat determinism.
- explicit proof that identical authoritative fixtures produce identical outcomes with zero LLM/RAG/network-classifier truth calls.
- scope negative.

The full canonical fixture traverses all intended Slice 12 branches without LLM, RAG, network routing or fake downstream runtime.

## 20. Governance / Static Guards / CI

Static/governance review must fail if Slice 12 adds:

- second node-manifest or node-registry;
- API-side route table;
- numeric next-node inference;
- client nextNode authority;
- A200401 node/route;
- Assessment/answer truth table;
- per-node service/table architecture;
- second idempotency store;
- direct problem_formulations SQL;
- duplicate Safety/Compliance policy logic;
- A3000+ runtime;
- scheduler/pg-boss/notification runtime;
- AI/RAG/model imports in Assessment routing;
- XState/workflow/rule DSL.

CI must preserve repository-native governance/static/type/unit/domain/DB/RLS/contract/integration suites and add only minimum discovery required for Slice 12 suites. Do not weaken an existing guard to make Slice 12 pass.

## 21. Implementation Order

1. T1201 Authority/dependency gate.
2. T1202 merged owner/interface reconciliation.
3. T1203 migration/schema/RLS.
4. T1204 contracts/authorization/errors.
5. T1205 repository.
6. T1206 pure projection/artifact domain.
7. T1207 Assessment start/resume.
8. T1208 reads.
9. T1209 generic node completion.
10. T1210 A1001/01002/01003.
11. T1211 A2001/A1000/A2002/01005/01006.
12. T1212 01004/01000.
13. T1213 A2003/A200401/A2004–A2009.
14. T1214 A2007.
15. T1215 A2010.
16. T1216 Problem Formulation handoff.
17. T1217 API/OpenAPI.
18. T1218 concurrency/idempotency/fault/security hardening.
19. T1219 acceptance/no-model/scope/governance convergence.
20. T1220 exact-head closeout and Audit 2 handoff.

## 22. Rollback / Migration Concerns

Migration is additive and uses next available order after T1202 reconciliation. Never edit a historical migration.

Before production data exists, application rollout can stop using new routes while additive tables remain. After real data exists, do not drop Scene tables merely to roll back application code; preserve Evidence/artifacts/audit history and use forward remediation.

Migration tests must prove clean bootstrap, upgrade from exact then-current main, RLS/grants, owner/runtime role separation, no sequence collision and preservation of prior shared CHECK vocabulary.

## 23. Pre-Development Audit 1 — Narrow Reconciliation

Previous Audit 1 remains FINAL PASS and is preserved; this final closeout only revalidates dependency truth, PR #35 blocker closure and the Implement Gate.

Results:

- Authority consistency: PASS.
- Scope isolation: PASS.
- Frozen capability / node identity unchanged: PASS.
- Spec ↔ Plan: PASS.
- Plan ↔ Checklist: PASS.
- Checklist ↔ Tasks: PASS.
- FR-001–FR-022 coverage: 22/22 PASS.
- Original Acceptance 1–36 coverage: 36/36 PASS.
- Integrated Triage Authority Matrix coverage: 22/22 PASS.
- Combined mechanical acceptance coverage: 58/58 PASS.
- Owner boundaries: PASS.
- Slice 11 sole node-manifest/routing ownership: PASS.
- Evidence Core substantive truth ownership: PASS.
- Slice 8 Problem Formulation ownership / same-transaction seam: PASS.
- Slice 9 Safety Hold ownership: PASS.
- Slice 10 Compliance ownership: PASS.
- Consent single-owner capability: PASS.
- Integrated Triage determinism: PASS.
- Missing / Conflict uniqueness: PASS.
- 01002 / 01003 priority order: PASS.
- both-F precedence / Evidence preservation: PASS.
- A2001 positive proof / no default: PASS.
- A2002 positive proof / no general-missing sink: PASS.
- A2003 positive proof / no duration-only: PASS.
- Normal-outcome mutual exclusivity: PASS.
- Exhaustiveness / fail-closed: PASS.
- No professional threshold invention: PASS.
- No LLM/RAG/classifier truth ownership: PASS.
- A200401 negative: PASS.
- 01000 no-invention: PASS.
- A2007 no-scheduler: PASS.
- A2010 no-A3000 runtime: PASS.
- Authorization/RLS/idempotency/concurrency/atomicity boundaries: PASS.
- Production code mutation by reconciliation: 0.
- Docs mutation by reconciliation: 0.
- Open Product Decisions: 0.
- Open Planning Decisions: 0.
- Scope Drift: 0.

Audit 1 verdict: **FINAL PASS.**

## 24. Current Dependency Re-Audit / Implement Gate

Revalidated against origin/main ac3e6212c06781a8597af5928a08c62a24623889:

- Slice 8 runtime PR #26: MERGED.
- Slice 9 runtime PR #28: MERGED; PR #29 remediation: MERGED.
- Slice 10 runtime PR #30: MERGED.
- Slice 11 runtime PR #31: MERGED.
- Slice 8 caller-owned same-transaction seam PR #32: MERGED and present in main.
- Consent 01004 owner capability PR #33: MERGED and present in main.
- Integrated Triage Authority PR #34: MERGED / CLOSED and reconciled.
- current Docs blobs: exact as recorded in §1.
- approved 01004 disclosure authority: **PRESENT / PASS via PR #35**.
- production default supplemental-assessment disclosure authority: fail-closed.

Dependency truth classification: **RECONCILED TO CURRENT MAIN.**

Implement Gate: **OPEN.**

Previous blocker: **CLOSED**. PR #35 provides the approved 01004 supplemental-assessment disclosure authority; Slice 12 must consume it through the existing Consent owner seam and still may not invent disclosure content or a second authority.

## 25. Planning Freeze

Plan: COMPLETE — NARROW RECONCILED.
Checklist: COMPLETE — NARROW RECONCILED.
Tasks: COMPLETE — NARROW RECONCILED.
Audit 1: FINAL PASS — PRESERVED.
FR Coverage: 22/22.
Acceptance Coverage: 58/58.
Open Product Decisions: 0.
Open Planning Decisions: 0.
Docs mutation: 0.
Production code mutation: 0.
Scope Drift: 0.
Final Development-Start Gate: PASS.
Implement Gate: OPEN — READY FOR SLICE 12 DEVELOPMENT.
