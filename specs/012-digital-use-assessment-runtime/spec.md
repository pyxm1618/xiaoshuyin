# Feature Specification: Digital Use Assessment Runtime（A1001–A2010）

**Feature Directory**: specs/012-digital-use-assessment-runtime  
**Created**: 2026-11-11  
**Status**: Specify / Clarify FINAL PASS — FROZEN  
**V1 Phase**: Phase 2 — Digital Use Scene 忠实实现（Docs/V1技术设计.md §38）  
**Stage**: Selection Gate + Specify + Clarify only. No Plan / Checklist / Tasks / 审计一 / Implement / 审计二.  
**Authority baseline**: origin/main = 8e393c990be53c888c2e68d881bd8b23f9c37638

> 本 Spec 是四份正式 Docs 与已冻结上游 Slice 的下游投影。它不修改产品语义，不重新设计 Digital Use，不把尚未 merge 的 runtime 当作当前 production truth。
>
> 产品语义最终事实源仍为 Docs/V1产品需求.md；V1 技术实现边界与阶段顺序仍由 Docs/V1技术设计.md 决定。
>
> 本 Slice 的目标不是“做完整 Digital Use”，而是把 Phase 2 中紧随 Node Manifest / deterministic routing foundation 之后的 Assessment 主链，定义成可以由后续 Plan AI 2 直接规划的真实 runtime 合同。

---

## 1. Selection Gate

### 1.1 Authority / repository truth

Selection 时重新核对：

- Repository: pyxm1618/xiaoshuyin
- origin/main: 8e393c990be53c888c2e68d881bd8b23f9c37638
- Docs/总产品需求.md blob: 67724000cb9bb81c40489c04db28d899bd1df74c
- Docs/V1产品需求.md blob: 918d8574ad88773fe371985fd5c38080c944fec9
- Docs/总体技术架构.md blob: 9b08371edc976fa281469dfee8dc19962452e3b0
- Docs/V1技术设计.md blob: e7285fd8363c8a76ab4fd96a305037b5c675f961

Current runtime truth and future dependencies are intentionally separated:

- Slice 1–7 implementation runtime is already represented on main, with Slice 005 being a contract-only artifact rather than an implementation slice.
- Slice 8 Problem Formulation runtime is on draft PR #26, head e23cee82fd6953cb02b3ea139e2c2220ed152d90, and is not merged to main.
- Slice 9 Safety Hold Control Foundation has frozen/planned/audited artifacts; governance remediation PR #27 is open draft; Safety runtime and its authoritative Drizzle/Data Access outcome are not merged.
- Slice 10 Compliance Feature Policy Foundation is frozen/planned/Audit 1 passed, but its Implement Gate is blocked on the authoritative Slice 9 Drizzle/Data Access outcome.
- Slice 11 Digital Use Node Manifest / Deterministic Routing Foundation is frozen/planned/Audit 1 passed, but its Implement Gate is blocked; no Slice 11 runtime is on main.

Therefore:

**Planning Ready does not mean Runtime Available.**

This Slice may be specified now, but implementation may not consume Slice 8–11 as current runtime until their required implementations are merged and reconciled.

### 1.2 Formal phase order

Docs/V1技术设计.md §38 orders Phase 2 as:

1. Scene Package / single node-manifest.ts / deterministic routing.ts;
2. canonical snapshot + completeness/routing CI;
3. A1001–A2010;
4. FAMILY_ALLIANCE;
5. PHONE_USE_CONTRACT;
6. remaining Digital Use target / contract / review flow.

Slice 11 owns items 1–2.

The next explicit Phase 2 capability is therefore the Assessment / triage / preparation subgraph represented by A1001–A2010 and its reachable A1000 / 010xx branches.

### 1.3 Selection candidates

| Candidate | Why it may fit | Why not now / dependency | Decision |
|---|---|---|---|
| Digital Use Assessment Runtime | It is the next explicit §38 Phase 2 item; U05 requires Digital Use Assessment; Slice 11 already freezes the single routing authority it must consume. | Future implementation depends on Slice 8–11 runtime gates. | **SELECTED** |
| Scene Node Persistence Foundation only | scene_node_states / scene_artifacts are required by Phase 2 runtime. | Splitting persistence into an empty shell would create infrastructure with no independent user/business capability; persistence belongs inside the first real Scene runtime consumer. | REJECT AS SLICE 12 |
| FAMILY_ALLIANCE A3000–A3113 | Required by V1 and already frozen in the Manifest topology. | It is explicitly ordered after A1001–A2010 and depends on Assessment / formulation handoff. | DEFER |
| Goal Core / Plan Execution | Required by V1 Common Core. | Goal / Plan / Task / Checkin / Review execution loop is Phase 4; pulling it forward would violate §38. | DEFER |
| WAITING / Follow-up / Notifications | Needed later for active return and reminders. | Requires Plan/follow-up schedule and real notification capability; not the next Phase 2 block. | DEFER |

### 1.4 Final Selection

**Slice 12 = Digital Use Assessment Runtime（A1001–A2010 canonical subgraph）.**

One-sentence definition:

> 建立 Digital Use Scene 的第一个真实业务 runtime：在唯一 Manifest / deterministic routing 合同下，持久化并推进 A1001、01002、01003、A2001/A2002 及其 010xx 分支、A2003–A2010，形成可追溯 Evidence、Scene Node State 与用户可查看 Artifact，并在满足 Common Core 门禁时把 Assessment 正确交给 Problem Formulation，而不提前实现 A3000+、AI、Goal、Plan 或通知执行。

Why now:

- it directly follows Slice 11 in the approved Phase 2 order;
- it closes U05’s first real Scene runtime gap;
- it has a stable upstream canonical flow;
- it can consume, rather than duplicate, Slice 11 routing;
- it is independently testable without a real model.

Why not later candidates:

- Family Alliance / Contract are downstream of this flow;
- Goal / Plan are Phase 4;
- notification/follow-up execution depends on later Plan/Schedule runtime;
- a persistence-only slice would be an empty technical shell rather than a bounded business capability.

Selection Gate: **PASS**.

---

## 2. Problem / Purpose

Current main has no Digital Use Scene runtime and no scene_node_states / scene_artifacts runtime.

The approved V1 product, however, requires the family user to:

- describe the Digital Use problem;
- complete the Digital Use Assessment;
- preserve broad device scope, purpose-separated duration, functional impact, emotion and family-conflict evidence;
- route severe emotion/conflict and uncertain/other-needs branches truthfully;
- capture parent expectations, prior attempts and difficulties;
- preserve the willingness / motivation / alliance explanation branches;
- create the A2007 timeline and A2010 solution summary;
- never jump from raw questions directly to Goal without the formal Problem Formulation gate.

Without this Slice, Slice 11’s Manifest is only a static topology contract and U05 has no business runtime.

The purpose of Slice 12 is therefore:

> **turn the frozen Digital Use Assessment topology into a version-aware, authorized, auditable and deterministic business runtime, while preserving Evidence as the factual truth and keeping all downstream solution/AI/Plan capabilities outside this Slice.**

---

## 3. Goals

This Slice SHALL define the runtime contract for:

1. starting / resuming the Digital Use Assessment for an authorized current primary Case;
2. binding the Case to one published Scene Package / Manifest version for deterministic evaluation;
3. persisting current node progress in scene_node_states;
4. recording substantive Assessment facts through existing Evidence truth rather than inventing a second fact store;
5. recording node inputs / outputs by references and preserving Unknown / Conflict / Declined semantics;
6. executing only the canonical A1001–A2010 subgraph and its approved reachable branches;
7. using Slice 11 deterministic routing as the only node-topology decision authority;
8. persisting user-viewable A2007 and A2010 artifacts and the 01000 supplemental-assessment artifact boundary;
9. handing sufficient Assessment evidence to the Problem Formulation command without bypassing the formal PROBLEM_FORMULATION phase;
10. providing the approved Scene / node API surface;
11. guaranteeing authorization, Safety, Compliance, idempotency, optimistic concurrency, atomicity and truthful failure;
12. remaining fully testable without LLM, RAG, network-based decision logic or a second V1 Scene.

---

## 4. Scope

### 4.1 In Scope — canonical node runtime

The Slice owns runtime behavior for the following canonical subgraph defined by the current product flow and Slice 11:

**Assessment / triage / preparation nodes**

- A1001
- 01002
- 01003
- A2001
- A1000
- A2002
- 01005
- 01006
- 01004
- 01000
- A2003
- A2004
- A2005
- A2006
- A2007
- A2008
- A2009
- A2010

**A200401 is explicitly NOT a node.**

A200401 is a record marker created from A2003 content and consumed by later A2006 / A2008 semantics. It may appear in record/output metadata or references but MUST NOT become a navigable scene node.

### 4.2 In Scope — runtime objects

- scene_node_states as the current Scene progression projection;
- scene_artifacts only for product-required Scene outputs that are not core facts;
- existing assertions / observations / dialogue_messages as the truth-bearing Evidence layer;
- the current Case phase/status/primary/version contract;
- existing Consent / Authorization / RLS / Compliance / Safety gates;
- current business audit / case event / idempotency contracts;
- approved Scene APIs in Docs/V1技术设计.md §28.3;
- deterministic structured input / response validation against the published Manifest.

### 4.3 Out of Scope

This Slice MUST NOT implement:

- node-manifest.ts or routing.ts ownership already assigned to Slice 11;
- A3000–A3113 FAMILY_ALLIANCE runtime;
- A4001–A4012 PHONE_USE_CONTRACT runtime;
- A5001 / A5002 Review runtime;
- Goal / InterventionInstance / PlanVersion / Task / Checkin / Review / Outcome;
- real follow-up schedules, pg-boss jobs, notification dispatch or delivery claims;
- AI / RAG / prompt orchestration / model-based classification / model-generated routing;
- professional content management platform or Phase 3 Knowledge / Policy publication system;
- a second V1 Scene;
- concrete psychometric instrument design or scoring rules not frozen in the four authoritative Docs;
- participant permission expansion, new family roles or a second RBAC system;
- data-right deletion/export UI, Memory, Referral operations or Phase 5 operations;
- WeChat UI implementation;
- any V2–V5 capability.

---

## 5. Upstream Traceability

Primary product requirements:

- U05 — describe problem and complete Digital Use Assessment;
- V1-C02 / C03 — evidence type, provenance, unknown/conflict fidelity;
- V1-C04 — Assessment must lead through Problem Formulation before Goal;
- V1-C20 / C21 — identity/family/participant/access boundaries;
- V1-C24 — AI cannot independently confirm business truth;
- V1-C25 — Safety can interrupt ordinary flow;
- V1-C27 / C28 — truthful failures, retry/concurrency must not duplicate outcomes;
- V1-C29 — key blocked/empty/error states must be usable;
- V1-C30 — Scene-specific logic must not be rewritten into Common Core;
- V1-D00–D07 — Digital Use Assessment / triage / preparation fidelity;
- V1-D30–D34 — timeline/entry/help/record fidelity and current canonical authority;
- V1-D43 — full machine-verifiable node manifest authority.

Primary technical requirements:

- §5 domain invariants;
- §6.6 / §6.7 Case Status / Phase and normal phase transitions;
- §7.2 scene_node_states / scene_artifacts / Evidence;
- §8.5 idempotency;
- §8.6 optimistic concurrency/versioning;
- §9 / §9.1 Authorization + RLS;
- §10 Consent / child-participation boundaries;
- §12.2 / §12.3 Manifest + deterministic routing;
- §12.4 Problem Formulation handoff;
- §12.5 Digital Use mapping;
- §23 Domain Commands;
- §27 API/business error principles;
- §28.3 Case / Scene API;
- §32.2 Digital Use regression;
- §37 reliability;
- §38 implementation order;
- §40 release gates.

---

## 6. Ownership / Source of Truth

### 6.1 Product truth

Docs/V1产品需求.md remains the semantic authority for:

- which nodes exist;
- what each node means;
- approved branches;
- user inputs / decisions;
- outputs / records;
- parallel / re-entry / terminal semantics.

### 6.2 Code-side topology truth

After Slice 11 runtime is merged:

- node-manifest.ts is the single production node-definition truth;
- routing.ts is the single deterministic topology decision layer;
- canonical snapshot remains test/review-only.

Slice 12 MUST NOT define a second route table, second node registry or duplicated allowedNext map.

### 6.3 Current runtime state truth

scene_node_states owns the **current Scene progression projection** for a Case + published Scene Package.

It is not the source of truth for the substantive family facts contained in Assessment answers.

### 6.4 Business Evidence truth

Substantive facts / statements / observations collected by A1001, 01002, 01003, A2003 and relevant later nodes remain in the existing Evidence domain with provenance.

Examples:

- device usage;
- purpose-separated duration;
- functional impact;
- emotional-state answer;
- family-relationship/conflict answer;
- parent expectation;
- prior methods / result / difficulty.

Scene state references those records through input_refs / output_refs; it MUST NOT copy them into a parallel authoritative Assessment JSON blob and then treat that blob as the fact source.

### 6.5 Artifact truth

scene_artifacts owns user-visible/returnable outputs that are not themselves core factual truth, including at minimum:

- A2007 timeline artifact;
- A2010 solution-summary artifact;
- 01000 supplemental-assessment artifact / handoff record when that branch is used.

Artifact history does not replace Evidence history.

---

## 7. Scene Node State Contract

Each Scene Node state must preserve the current technical design semantics:

- case_id;
- scene_package_version;
- node_code;
- source_node_code;
- status: LOCKED / AVAILABLE / IN_PROGRESS / COMPLETED / SKIPPED / BLOCKED;
- branch_reason_codes[];
- input_refs[];
- output_refs[];
- entered_at;
- completed_at?;
- revision.

Rules:

1. source_node_code must remain traceable to the approved product identifier.
2. 01002 / 01003 leading zero semantics must never be lost.
3. A200401 must never appear as a node state.
4. revision is a concurrency/version token for current state; it is not permission to erase Evidence history.
5. one Case / package / node may not have two conflicting current states.
6. node availability is derived from the published Manifest, deterministic routing, current business gates and current node state; the client cannot mark a node AVAILABLE or COMPLETED by assertion.
7. no numeric adjacency inference is allowed.
8. a UI page may combine several nodes, but server-side node state and routing semantics remain distinct.

---

## 8. Canonical Runtime Semantics

### 8.1 Assessment entry

POST /api/v1/cases/:id/assessments represents the public Assessment entry surface already approved by §28.3.

It MUST NOT create a separate assessments source-of-truth table merely because the endpoint is named assessments.

On first legal entry, the runtime must:

- resolve the real Case and Family scope;
- require current primary Case;
- require the approved authorization / consent / compliance / safety gates;
- invoke the authoritative StartAssessment phase bridge when the Case is in INTAKE;
- bind the Scene run to the approved Digital Use Scene Package version;
- initialize / expose the legal A1001 entry state;
- create no duplicate Assessment business object.

If the Case is already in a legal ASSESSMENT state for the same current run, retry/resume returns the current projection rather than manufacturing a second Assessment.

A Case in a later phase MUST NOT be silently reset to ASSESSMENT by this endpoint. Reassessment must use the approved Common Core reassessment path.

### 8.2 A1001

A1001 MUST preserve:

- broad device scope: phone, tablet, computer, game console/game device and other approved related digital-device use;
- usage-purpose separation:
  - learning/research/homework;
  - necessary contact;
  - entertainment/gaming/video/social and other non-learning use;
- average daily duration over the recent two-week period per purpose;
- optional total duration as Evidence only;
- functional impact at least:
  - sleep;
  - study / necessary affairs;
  - real-world activity displacement;
- source certainty / estimate state when the user is uncertain;
- historical duration bands for 6–11 and 12–18 only as auxiliary Evidence.

Hard prohibitions:

- no universal under-6 Scene rejection;
- no invented under-6 duration band;
- no total-duration-only decision;
- no A/B/C/D-band-only decision;
- no device scope regression to phone/tablet only.

### 8.3 01002

01002 records the approved recent emotional-state selection:

- A–F product semantics remain authoritative;
- maximum two selections;
- the original answer is Evidence;
- 01002F preserves the severe-emotion priority route to 01005.

Selecting F is a routing signal under the approved product flow; it is not permission to invent a diagnosis.

### 8.4 01003

01003 records exactly one approved family relationship/conflict state A–F.

01003F preserves the severe-conflict priority route to 01006.

The response remains user/parent-reported Evidence; it is not promoted to an independently verified Fact by routing.

### 8.5 A2001

A2001 is legal only when integrated current Evidence supports the approved “no sufficient basis for Digital Use intervention” conclusion and no unresolved Unknown / Conflict would materially change it.

It MUST NOT be reached from duration or historical duration band alone.

Approved outcomes remain:

- general Digital Use advice → A1000;
- user elects to continue the current Digital Use problem → A2003;
- user elects other content → explicit terminal/main return.

A1000 presents approved general advice as content. That content MUST NOT be reinterpreted as the Assessment eligibility/routing threshold.

### 8.6 A2002

A2002 is legal when integrated Evidence indicates other needs / unresolved Unknown / Conflict requiring further assessment and the severe 01005/01006 priority branch did not already take precedence.

Approved outcomes remain:

- further assessment → 01004;
- continue current Digital Use problem → A2003;
- other content → explicit terminal/main return.

Again, duration band alone cannot trigger or exclude this node.

### 8.7 01005 / 01006

01005 and 01006 are priority branch nodes.

They may explain the approved concern and route toward main/external-other-problem handling.

This Slice MUST NOT:

- fabricate a second V1 Scene;
- claim an emotional/parent-child service exists if it is not actually implemented;
- fabricate a Referral status;
- treat a button/link as successful handoff.

The runtime must represent the approved terminal/external destination truthfully.

### 8.8 01004 / 01000

01004 preserves:

- explanation of purpose / method / use / estimated burden / disclaimer;
- explicit user acceptance or refusal before proceeding;
- refusal → return/terminal;
- acceptance → 01000.

The 01004 decision is a scoped supplemental-assessment consent fact. It MUST NOT be confused with:

- guardian relationship;
- guardian consent required for under-14 processing;
- identity-binding confirmation;
- blanket future-purpose consent.

01000 preserves the currently approved product categories:

- 情绪测评;
- 亲子互动模式测评.

The authoritative Docs do not freeze a concrete psychometric instrument item bank, scoring algorithm or clinical cut-off for those categories.

Therefore Slice 12 MUST NOT invent one.

Slice 12 owns:

- legal entry into 01000;
- category selection;
- structured supplemental-assessment artifact boundary;
- truthful result/feedback/handoff projection if an approved versioned assessment asset exists;
- return / external scene recommendation semantics.

Concrete unapproved scale questions, scoring and diagnostic interpretation are OUT OF SCOPE. Their absence must be exposed truthfully rather than replaced by a fake questionnaire or model guess.

### 8.9 A2003 / A200401

A2003 collects:

- parent expected device-use duration;
- reason;
- previously tried methods;
- observed effect;
- difficulties.

If the user is unwilling / impatient, the runtime does not force completion beyond product requirements; missing fields remain real missing/declined state rather than fabricated values.

A200401 is only the record marker for this captured content.

It MUST NOT be created as a node, route target or separate parallel truth.

### 8.10 A2004

A2004 asks whether the parent is willing to determine device-use duration together with the child.

Canonical branch semantics must remain intact:

- YES → A2005;
- NO-like outcomes → A2006;
- “tried before but did not work” remains the approved NO branch;
- an unresolved free-text intent that the product flow directs to the NO branch may use that routing reason.

Important fidelity rule:

> routing an unresolved intent through the approved NO branch does not rewrite the underlying Evidence into a factual “the user is unwilling”.

The original response/uncertainty remains traceable, and branch_reason records why that path was chosen.

### 8.11 A2005 / A2006 / A2008 / A2009

The approved willingness / motivation / family-alliance explanation / potential relationship branch semantics remain distinct.

These nodes MAY present existing approved content and collect the approved user decision.

They MUST NOT:

- create an InterventionInstance;
- activate FAMILY_ALLIANCE;
- activate PHONE_USE_CONTRACT;
- create a Goal or Plan;
- infer user agreement from silence.

Any product-defined “unable to determine → unwilling/no branch” is a routing rule only; it must preserve the original uncertain response provenance.

### 8.12 A2007

A2007 records the user’s chosen timeline and creates a user-visible timeline artifact.

The timeline is preparation data for later execution.

This Slice MAY produce a **follow-up draft / reminder basis** as required by §12.5, but MUST NOT:

- create an active Plan;
- create the Phase 4 case_followup_schedules business truth;
- enqueue pg-boss jobs;
- claim a reminder is scheduled or delivered.

The current product text includes suggested durations and explicitly notes that concrete product timing still requires later product design. Therefore those suggestions MUST NOT be hardened into mandatory scheduling defaults by Slice 12.

User-entered dates/durations remain the authoritative timeline input for this Slice.

### 8.13 A2010

A2010 creates a user-viewable solution-summary artifact derived from the approved timeline / preparation records.

It does not activate the solution.

The canonical route target after A2010 is A3000, but A3000 runtime belongs to a later Slice.

Until that runtime exists:

- Slice 12 may expose the deterministic route intent to A3000;
- it MUST NOT create/complete A3000 business work;
- it MUST NOT mark downstream Intervention/Plan execution as active;
- it MUST truthfully preserve the downstream-unavailable boundary.

---

## 9. Problem Formulation Handoff

V1-C04 and Docs/V1技术设计.md §12.4 require:

Assessment
→ candidate Problem Formulation
→ user-visible/correctable Problem Formulation
→ only then GOALS.

Slice 12 does not own Problem Formulation state or confirmation.

Once the frozen Slice 8 runtime is merged, Slice 12 must use its authoritative internal PresentProblemFormulation contract rather than:

- direct SQL;
- a second formulation table;
- embedding a formulation JSON into scene_node_states;
- jumping directly from A/010xx nodes to GOALS.

The exact handoff point is determined by the approved Assessment sufficiency contract, current Manifest phase metadata and current Evidence, not by numeric node adjacency.

The handoff must preserve:

- Evidence references;
- Unknown;
- Conflict;
- alternative/exit/reassessment information required by the Problem Formulation contract.

If the candidate cannot be formed without inventing facts, the runtime remains in a truthful Assessment state / blocked path; it does not fabricate a formulation.

---

## 10. Authorization / Privacy / Person Boundaries

### 10.1 Authorization

Every Scene read/write operation must use existing server-side authorization and RLS.

The client-supplied:

- family_id;
- case_id;
- person_id;
- nodeCode;
- source refs

are always untrusted parameters.

This Slice does not create a new role system.

### 10.2 Primary Case

Ordinary Assessment progression requires the current primary open Case, consistent with the existing Case contract and StartAssessment gate.

A stale client cannot continue ordinary progression after primary ownership changed.

### 10.3 Participant rights

Slice 12 does not grant children or other Case Participants new Assessment-write/read permissions merely because Participant runtime exists.

Any participant access must already be authorized by an approved purpose/visibility contract. Otherwise default deny.

### 10.4 Cross-family / cross-case / cross-person

The runtime must reject:

- references to Evidence belonging to another Case;
- references outside the authorized Family;
- cross-person fact reuse without the existing purpose/visibility authorization;
- client-controlled subject substitution.

No Scene state can weaken Evidence visibility.

---

## 11. Safety / Compliance / Consent

Safety, Compliance and Authorization are independent gates.

A routing result is never sufficient authority to perform a business transition.

### 11.1 Safety

When the current Case is SAFETY_HOLD or the authoritative Safety guard blocks ordinary progression:

- no ordinary node response may advance the Scene;
- no A2010/A3000 downstream transition may activate;
- retries remain blocked until the authoritative Safety release contract permits continuation.

Slice 12 does not implement EnterSafetyHold / ResolveRisk.

### 11.2 Compliance

When the authoritative Compliance feature policy says a required condition is unresolved/blocked:

- relevant Assessment interaction fails closed;
- node state must not be falsely completed;
- a model/UI cannot override the result.

Slice 12 does not create a second compliance decision system.

### 11.3 Consent

Consent is purpose-specific.

01004 supplemental-assessment consent cannot stand in for:

- under-14 guardian consent;
- model-processing consent if separately required;
- cross-member sharing consent;
- notification/contact consent.

Revocation of an applicable upstream Consent blocks future affected processing according to the existing Consent contract; it does not erase historical Evidence or Scene audit history by itself.

---

## 12. API Contract Surface

This Slice may implement only the already approved Scene / Assessment surface from Docs/V1技术设计.md §28.3:

~~~text
POST /api/v1/cases/:id/assessments

GET  /api/v1/cases/:id/scene
GET  /api/v1/cases/:id/scene/nodes/:nodeCode
POST /api/v1/cases/:id/scene/nodes/:nodeCode/responses
~~~

Rules:

1. POST assessments starts/resumes the approved Digital Use Assessment projection; it does not create a second assessment truth.
2. GET scene returns authorized current Scene projection only.
3. GET node returns only an authorized, manifest-known node projection and current legal state.
4. POST node response validates:
   - nodeCode exists in the published Manifest;
   - current package/version;
   - current reachability;
   - input/decision schema;
   - actor authorization;
   - Safety;
   - Compliance;
   - Consent;
   - primary Case;
   - expected node revision / concurrency contract.
5. Client-provided nextNode is never authoritative.
6. No extra public route is added merely to simplify tests.
7. A200401 is never addressable as a node endpoint.

Exact request/response DTO field names beyond the upstream-required semantics are Plan-level.

---

## 13. Idempotency

All public mutation commands in this Slice must reuse the existing V1 idempotency contract.

At minimum:

- scope remains actor + command_type + idempotency_key;
- same key + same canonical payload returns the original business result;
- same key + different canonical payload is a conflict;
- replay does not create duplicate Evidence, artifacts, node completions, events or phase transitions;
- idempotency completion is atomic with the business result.

No second idempotency table/store may be created.

---

## 14. Concurrency

Scene runtime must use optimistic concurrency consistent with V1’s version/revision architecture.

Required behavior:

- node response is evaluated against the current Case version / current node revision as applicable;
- if another valid write wins first, the stale write cannot overwrite it;
- two concurrent responses cannot produce two conflicting current routes;
- duplicate A2007/A2010 submissions cannot create duplicate current artifacts;
- primary-switch, Safety transition, Consent change or package/version drift that wins concurrently must be revalidated before commit.

A stale conflict returns a stable conflict result; it must not be “last write wins”.

---

## 15. Atomicity

For each successful node mutation, all business effects that define that result must commit atomically.

Depending on the node, this may include:

- Scene Node state/revision;
- Evidence write(s);
- scene artifact;
- Case event;
- business audit event;
- idempotency result;
- approved Common Core phase transition if this command is the legitimate caller.

If any required component fails, the transaction rolls back.

The runtime must never return success while leaving:

- Evidence saved but node state unchanged;
- node completed but artifact missing;
- route advanced without the required consent;
- Problem Formulation phase advanced without the formulation write;
- audit/idempotency claiming success for a rolled-back result.

---

## 16. Failure Semantics

The Slice must distinguish at least these classes:

### 16.1 Not found / unauthorized scope

Use the repository’s existing anti-enumeration behavior. Cross-family or unauthorized access must not reveal hidden resource existence.

### 16.2 Invalid / unknown node

Unknown, fabricated or A200401-as-node identifiers fail before business mutation.

### 16.3 Unreachable / wrong-phase node

A manifest-known node that is not currently reachable cannot be completed by direct API call.

### 16.4 Invalid response

Schema-invalid, over-selection, missing-required or impossible response shapes fail without partial Evidence/state writes.

### 16.5 Safety / Compliance / Consent blocked

Return the truthful blocking state from the authoritative gate. Do not remap it to success, skipped or a fabricated route.

### 16.6 Stale / concurrent conflict

Stale Case/node/package expectations fail as conflict and require client refresh/re-evaluation.

### 16.7 Infrastructure failure

Database / downstream infrastructure failure returns a true failure and rolls back the business mutation.

### 16.8 Downstream capability unavailable

When a canonical route points to a future capability that is not actually implemented, the runtime records/exposes the real boundary and MUST NOT claim the downstream work has begun.

---

## 17. Correction / Reassessment / Delete Semantics

### 17.1 Correction

This Slice does not authorize destructive in-place rewriting of historical Evidence.

Where an approved node is revisited through reassessment/re-entry:

- new Evidence supersedes/qualifies earlier Evidence using the existing Evidence contract;
- the old source remains traceable;
- node revision / current projection advances;
- downstream derived results must not continue treating known-corrected information as current truth.

### 17.2 Reassessment

Reassessment is not “POST assessments again and reset everything”.

It requires the approved Common Core reassessment transition and then reopens only the Scene work permitted by the current Manifest / policy.

Existing history remains.

### 17.3 Delete

Slice 12 introduces no Scene-specific delete command.

Data-right deletion remains governed by the V1 rights/deletion contract and later implementation slices. Lack of a Slice 12 delete endpoint does not weaken the global deletion obligation.

### 17.4 Expiry

Assessment answers do not silently expire merely because time passed.

Validity/age of Evidence remains represented by the existing Evidence semantics. Any later policy that requires refresh must explicitly re-evaluate; it cannot silently rewrite history.

---

## 18. Observability / Audit

Every successful business mutation must be attributable to:

- Case;
- Family scope;
- authenticated actor;
- scene_package_version;
- node_code / source_node_code;
- prior/current node revision;
- branch reason;
- referenced Evidence / artifact IDs;
- command/idempotency identity;
- timestamp;
- resulting route/state.

Privacy rules:

- audit metadata must not duplicate raw sensitive narrative unless the approved audit contract requires it;
- raw answer content remains in the proper Evidence/artifact store with normal authorization;
- logs/metrics must not become a shadow family-data store.

Topology/package version must be observable so later regressions can prove which flow version generated a route.

---

## 19. Determinism / AI Boundary

Slice 12 must be fully executable in deterministic tests without a real model.

Allowed:

- structured buttons/options;
- numeric/estimated inputs;
- user text recorded as raw user input / Evidence;
- deterministic validation/routing;
- deterministic template summary from recorded data;
- later model output only as non-authoritative candidate input after an approved AI slice exists.

Forbidden in Slice 12:

- LLM deciding next node;
- LLM changing an Evidence kind into Fact;
- RAG deciding eligibility;
- model output marking a node completed without deterministic validation;
- hidden “best effort” fallback route;
- AI creating the formal Problem Formulation and confirming it on behalf of the user.

---

## 20. Non-Goals / Anti-Expansion Rules

The following are explicit non-goals:

- no full Scene Engine framework;
- no XState;
- no one-service-per-node architecture;
- no one-table-per-node schema;
- no duplicated node registry;
- no duplicated Assessment JSON truth;
- no “fixing” product node numbers;
- no inferred numeric next-node rules;
- no second professional Scene;
- no generic rules DSL;
- no dynamic workflow builder;
- no Phase 3 model platform;
- no Phase 4 plan/follow-up scheduler;
- no UI design in this Spec;
- no modification of Docs or Slice 1–11 frozen semantics.

---

## 21. Functional Requirements

### FR-001 — Single Scene runtime truth

The current Digital Use Scene progression for a Case is represented through scene_node_states bound to a published Scene Package version, not through client state or a second workflow database.

### FR-002 — Manifest-only topology

All node identity, allowed-next, branch reason, parallel/re-entry metadata and input/output schema references are consumed from the Slice 11 Manifest/routing foundation.

### FR-003 — Evidence fidelity

Substantive Assessment answers are persisted through the existing Evidence model with provenance; node state stores references, not a competing fact truth.

### FR-004 — Assessment entry

The approved Assessment endpoint may enter/resume only the legal current primary Case flow and must use StartAssessment rather than bypassing the Case phase contract.

### FR-005 — A1001 fidelity

Broad device scope, purpose-separated duration, functional impact, source uncertainty and auxiliary-only historical bands are preserved.

### FR-006 — 01002 / 01003 fidelity

Emotional and relationship/conflict answers retain exact approved cardinality and priority-branch semantics without diagnostic inflation.

### FR-007 — Integrated triage

A2001/A2002 routing cannot be decided by total duration or historical duration band alone.

### FR-008 — Severe branches

01005/01006 preserve the approved priority route and truthful external/terminal behavior.

### FR-009 — Supplemental assessment boundary

01004 consent and 01000 category/handoff/artifact semantics are real, but no unapproved instrument/scoring system is invented.

### FR-010 — A2003 record fidelity

A2003 records expectation/reason/prior method/effect/difficulty and preserves A200401 only as a record marker.

### FR-011 — Decision-branch fidelity

A2004–A2009 preserve the approved YES/NO/willing/unwilling/agree/disagree route semantics and original uncertain response provenance.

### FR-012 — Timeline artifact

A2007 persists the user’s timeline as a user-visible Scene artifact without claiming an active reminder schedule.

### FR-013 — Summary artifact

A2010 creates a user-visible solution summary without activating A3000 or any Intervention/Plan.

### FR-014 — Problem Formulation gate

Assessment may only hand off through the authoritative Problem Formulation command; no direct Assessment→GOALS path is legal.

### FR-015 — Authorization / RLS

All Scene reads/writes are server-authorized and RLS-protected; no client ID can grant scope.

### FR-016 — Safety / Compliance / Consent precedence

A legal route does not bypass independent gates.

### FR-017 — Idempotency

Retries do not duplicate business outcomes.

### FR-018 — Concurrency

Stale node/Case/package state cannot overwrite newer truth.

### FR-019 — Atomicity

Node/Evidence/artifact/event/audit/idempotency results commit as one business result where applicable.

### FR-020 — Truthful downstream unavailability

Future A3000+ or second-scene capabilities are never represented as active before they actually exist.

### FR-021 — Deterministic execution

The complete Slice 12 acceptance suite can run without an LLM/network decision service.

### FR-022 — No upstream mutation

No Docs, frozen Slice 1–11 spec, or historical migration is modified to make this Slice fit.

---

## 22. Acceptance Scenarios

1. **A1001 broad device scope**: computer/game-device use is accepted and stored; the runtime does not reject it as “not phone”.
2. **Under-six fidelity**: an otherwise authorized under-six child is not rejected by an invented universal Scene eligibility gate.
3. **Purpose separation**: identical total duration with different learning/necessary-contact/non-learning distributions remains distinguishable Evidence.
4. **Duration-only negative test**: changing only historical A/B/C/D duration band cannot by itself force A2001/A2002/A2003.
5. **01002 cardinality**: more than two emotional selections are rejected atomically.
6. **01002F priority**: severe-emotion answer yields the approved 01005 route before ordinary triage.
7. **01003 cardinality**: more than one family-relationship option is rejected atomically.
8. **01003F priority**: severe-conflict answer yields 01006 before ordinary triage.
9. **A2001 advice path**: approved no-intervention integrated evidence can route to A1000 without converting the advice content into a gate.
10. **A2001 continue path**: the user may continue the current Digital Use concern to A2003.
11. **A2002 further-assessment path**: accepted further assessment reaches 01004, not a fabricated questionnaire.
12. **01004 decline**: refusal returns/terminates without creating 01000 completion.
13. **01004 consent isolation**: its consent cannot satisfy guardian consent or unrelated data purposes.
14. **01000 no invention**: only approved assessment categories are exposed; absent approved instrument/scoring content does not trigger model-generated questions.
15. **A200401 negative node test**: GET/POST against A200401 as node fails; A2003 can still record the marker.
16. **A2004 route fidelity**: YES→A2005 and approved NO-like outcomes→A2006 with explicit reason semantics.
17. **Unknown provenance fidelity**: a product-defined fallback branch never rewrites an uncertain user response into a false factual assertion.
18. **A2005/A2006/A2008/A2009 fidelity**: every approved branch is reachable and no hidden default branch is introduced.
19. **A2007 timeline artifact**: user-entered timeline is persisted and visible; no active follow-up schedule/job is created.
20. **A2010 summary artifact**: summary is generated from approved recorded data; A3000 remains downstream/unavailable until its owner runtime exists.
21. **Unknown node**: a fabricated node code cannot be written.
22. **Unreachable node**: a real node cannot be completed by directly calling its endpoint before prerequisites.
23. **Client next-node attack**: a client-supplied next node cannot override deterministic routing.
24. **Cross-family**: an actor cannot read/write another Family’s scene/evidence.
25. **Cross-case evidence**: one Case cannot reference another Case’s Evidence to satisfy a node.
26. **Participant escalation**: an invited/active participant does not gain assessment authority absent an approved visibility/purpose grant.
27. **Safety hold**: ordinary node progression is blocked by authoritative Safety state.
28. **Compliance block**: unresolved/blocked authoritative feature policy fails closed.
29. **Idempotent replay**: same key/same payload returns original result without duplicate Evidence/artifact/event.
30. **Idempotency mismatch**: same key/different payload conflicts.
31. **Concurrent node response**: two writes on the same expected revision cannot create two current branch outcomes.
32. **Primary switch race**: if primary status changes before commit, stale Assessment progression fails.
33. **Atomic failure**: injected failure after Evidence insert but before node completion leaves neither partial business result nor completed idempotency result.
34. **Problem Formulation handoff**: when sufficient approved Evidence exists, the runtime uses the authoritative PresentProblemFormulation seam and does not jump directly to GOALS.
35. **No-model regression**: the full canonical Assessment fixture reaches all intended Slice 12 branches without model/network routing.
36. **Scope negative**: changed-file review proves no A3000+, Goal/Plan, AI/RAG, notification runtime, second Scene, second manifest or second idempotency store was added.

---

## 23. Dependencies

### 23.1 Current main runtime dependencies

Available on current main and usable as current truth:

- Identity / Family baseline;
- Case Core;
- Evidence Core;
- Case Participant Core;
- Identity Binding runtime;
- Case Primary Switch;
- existing Authorization / RLS / idempotency / audit foundations from merged Slice 1–7.

### 23.2 Frozen future dependencies

These are design inputs only until their runtime is merged:

**Slice 8 — Problem Formulation Core**
- required for the real Assessment → Problem Formulation handoff;
- PR #26 is not current main runtime.

**Slice 9 — Safety Hold Control Foundation**
- required for the authoritative ordinary-progression Safety guard;
- authoritative Drizzle/Data Access foundation also lands through this dependency path.

**Slice 10 — Compliance Feature Policy Foundation**
- required for authoritative feature-level compliance evaluation.

**Slice 11 — Node Manifest / Deterministic Routing Foundation**
- required as the only node/topology/routing authority consumed by this Slice.

### 23.3 Not implementation dependencies

Slice 12 does NOT require before its own implementation:

- Phase 3 AI/RAG;
- FAMILY_ALLIANCE runtime;
- PHONE_USE_CONTRACT runtime;
- Goal/Plan/Task/Review runtime;
- notification delivery.

Those remain downstream.

---

## 24. Future Implement Gate

### Design Gate

**PASS.**

Selection, scope, ownership, data truth, route authority, failure semantics, authorization, idempotency, concurrency and downstream boundaries are fully defined without changing upstream product semantics.

### Future Implement Gate

**BLOCKED.**

Implementation may begin only after all of the following are true on then-current main:

1. Slice 8 Problem Formulation runtime has passed independent code audit and merged, with its StartAssessment / PresentProblemFormulation seams authoritative.
2. Slice 9 Safety Hold runtime and its approved authoritative Drizzle/Data Access foundation have merged, or an explicitly approved replacement closes the identical dependency without creating a second data path.
3. Slice 10 Compliance Feature Policy runtime has merged and its gate is authoritative.
4. Slice 11 Node Manifest / deterministic routing foundation has merged and is the only code-side Digital Use topology source.
5. latest main has been re-read after those merges; migration/order/shared-contract conflicts are reconciled.
6. this Frozen Spec has no authority drift against the four formal Docs.

Spec Frozen does NOT mean READY FOR DEVELOPMENT.

---

## 25. Clarifications

### C-01 — Is Slice 12 a persistence-only foundation?

**CLOSED — NO.**

scene_node_states / scene_artifacts are introduced only as the data projection required by the first real Digital Use runtime. A persistence-only shell is not a separate product Slice.

### C-02 — Is Slice 12 allowed to define its own node list / route table?

**CLOSED — NO.**

It consumes Slice 11. Any duplicate production route/node registry is forbidden.

### C-03 — Is there a separate Assessment business truth/table?

**CLOSED — NO.**

The approved architecture names Scene Node State + Evidence + artifacts. POST /assessments is an API/action surface, not permission to create a second Assessment source of truth.

### C-04 — Does A200401 become a node?

**CLOSED — NO.**

It remains a record marker.

### C-05 — May total duration or historical band decide the problem?

**CLOSED — NO.**

Integrated Evidence is required.

### C-06 — Is under six rejected from Digital Use Scene?

**CLOSED — NO.**

No universal minimum-age Scene gate exists.

### C-07 — What if 01000 needs a concrete scale?

**CLOSED BY SCOPE.**

Current authoritative Docs approve the categories and node semantics but do not freeze a concrete item bank/scoring algorithm. Slice 12 implements the consent/category/artifact/handoff boundary only and MUST NOT invent professional instrument content. A future approved content/instrument contract may plug into that boundary without changing this Slice’s runtime ownership.

### C-08 — Does 01004 consent replace other Consent?

**CLOSED — NO.**

It is purpose-scoped supplemental-assessment consent only.

### C-09 — Does A2007 schedule reminders?

**CLOSED — NO.**

It records the user timeline and follow-up draft/basis. Active follow-up schedule / jobs / notification delivery are downstream Phase 4 capabilities.

### C-10 — Does A2010 activate A3000?

**CLOSED — NO.**

It completes the summary and exposes the canonical downstream route. A3000 remains owned by the later FAMILY_ALLIANCE runtime.

### C-11 — Where is the Assessment → Problem Formulation handoff?

**CLOSED.**

The handoff occurs only when the approved Assessment sufficiency contract and current Manifest/phase metadata permit it. Slice 12 invokes the authoritative Slice 8 internal command; it does not infer the transition from numeric adjacency and never bypasses PROBLEM_FORMULATION.

### C-12 — Can model output choose routes?

**CLOSED — NO.**

Deterministic routing remains authoritative.

### C-13 — Can unresolved user intent be stored as a false YES/NO fact because the product has a fallback branch?

**CLOSED — NO.**

The branch follows the canonical fallback, while original uncertainty/provenance remains intact.

### C-14 — Can completed Assessment history be destructively reset on reassessment?

**CLOSED — NO.**

Reassessment preserves historical Evidence/artifacts and advances through explicit revisions/superseding records.

### C-15 — Does this Slice grant child/participant access?

**CLOSED — NO.**

No new participant visibility or mutation authority is created.

### C-16 — Are there any unresolved product decisions required for Plan AI 2?

**CLOSED — NO.**

Open Product Decisions = **0**.

---

## 26. Frozen Spec Gate

- Authority Gate: **PASS**
- Input Drift: **NONE**
- Selection Gate: **PASS**
- Selected capability: **Digital Use Assessment Runtime（A1001–A2010 canonical subgraph）**
- V1 Phase: **Phase 2**
- Specify: **COMPLETE**
- Clarify: **COMPLETE**
- Open Product Decisions: **0**
- Docs Modified: **NO**
- Slice 1–11 Semantics Modified: **NO**
- Scope Expansion: **NO**
- Production Code Modified: **NO**
- Plan: **NOT STARTED**
- Checklist: **NOT STARTED**
- Tasks: **NOT STARTED**
- Audit 1: **NOT STARTED**
- Implement: **NOT STARTED**
- Audit 2: **NOT STARTED**
- Design Gate: **PASS**
- Future Implement Gate: **BLOCKED**

**FROZEN SPEC READY FOR PLAN AI 2.**

---

## 27. Plan AI 1 Stop Boundary

This artifact intentionally stops before:

- Plan;
- Checklist;
- Tasks;
- 审计一;
- implementation;
- migration;
- tests/CI implementation;
- development PR;
- 审计二;
- merge.

The next permitted role for Slice 12 is Plan AI 2, operating from this Frozen Spec, the four authoritative Docs, the frozen upstream dependencies and fresh repository truth.
