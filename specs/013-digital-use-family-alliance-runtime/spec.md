# Slice 13 — Digital Use Family Alliance Runtime

**Feature Directory**: specs/013-digital-use-family-alliance-runtime  
**Created**: 2026-11-11  
**Status**: Selection + Specify + Clarify FINAL PASS — FROZEN SPEC  
**Role Boundary**: Plan AI 1 only. No Plan / Checklist / Tasks / Audit 1 / Implement / development PR / merge.  
**V1 Phase**: Phase 2 — Digital Use Scene faithful implementation  
**Selected Capability**: FAMILY_ALLIANCE Runtime — A3000–A3113 actual canonical nodes  
**Authority Baseline at Freeze Start**: origin/main = 6fab0b79a942c5bf961a2201138ed02bf3197859

> This specification is a downstream projection of the four formal Docs and frozen upstream contracts.
>
> It does not redesign the product, does not modify upstream semantics, and does not treat unmerged implementation as current production truth.
>
> Product semantics remain owned by Docs/V1产品需求.md. V1 implementation boundaries and phase order remain owned by Docs/V1技术设计.md.

---

## 1. Authority Gate

### 1.1 Current remote truth

Repository:

~~~text
pyxm1618/xiaoshuyin
~~~

Fresh remote verification at Slice 13 start:

~~~text
Current origin/main:
6fab0b79a942c5bf961a2201138ed02bf3197859

Commit:
Merge pull request #28 from pyxm1618/feat/009-safety-hold-control-foundation
feat(slice9): implement safety hold control foundation
~~~

The prompt supplied the earlier baseline:

~~~text
8e393c990be53c888c2e68d881bd8b23f9c37638
~~~

Comparison from that baseline to current main:

- main is ahead by 18 commits;
- behind = 0;
- the delta is Slice 9 Safety Hold Control implementation, migration, tests, supporting data-access work, and its already-approved planning artifacts;
- none of the four formal Docs changed in that delta.

Therefore the input change is:

~~~text
NON-SEMANTIC DEPENDENCY EXECUTION DRIFT
~~~

It advances an upstream runtime dependency but does not change Slice 13 product semantics, Phase 2 order, node inventory, routing authority, or truth ownership.

### 1.2 Open PR / runtime truth

Fresh remote state:

- PR #26 — Slice 8 Problem Formulation Core: OPEN, draft, NOT MERGED.
- PR #28 — Slice 9 Safety Hold Control Foundation: MERGED into current main as 6fab0b79....
- Slice 10: frozen spec/plan lineage exists; no feature runtime branch found.
- Slice 11: frozen spec/plan lineage exists; no feature runtime branch found.
- Slice 12: frozen spec/plan lineage exists; no feature runtime branch found.
- No pre-existing Slice 13 branch existed before this specification branch was created.

This specification strictly distinguishes:

~~~text
Frozen Contract
!=
Current Runtime
!=
Future Dependency
~~~

### 1.3 Four formal Docs

The four formal Docs were re-read under their current authority relationship:

~~~text
Docs/总产品需求.md
  blob 67724000cb9bb81c40489c04db28d899bd1df74c

Docs/V1产品需求.md
  blob 918d8574ad88773fe371985fd5c38080c944fec9

Docs/总体技术架构.md
  blob 9b08371edc976fa281469dfee8dc19962452e3b0

Docs/V1技术设计.md
  blob e7285fd8363c8a76ab4fd96a305037b5c675f961
~~~

Authority order remains:

~~~text
总产品需求
→ V1产品需求
→ 总体技术架构
→ V1技术设计
→ this Slice specification
~~~

### 1.4 Frozen upstream contracts

Re-read upstream Slice specifications:

- Slice 8 — Problem Formulation Core
  - frozen spec blob: 6a5656abab211a4dd80f6e1b0e20d358193ffb17
  - implementation currently remains unmerged PR #26.
- Slice 9 — Safety Hold Control Foundation
  - spec blob: da96c56e73432d11ba2d8eae040e52f7838ff759
  - runtime is current main truth after PR #28 merge.
- Slice 10 — Compliance Feature Policy Foundation
  - frozen spec blob: a911bcc0c168e00efa015d53d5c120bece28c5a7
  - runtime not on main.
- Slice 11 — Digital Use Node Manifest / Deterministic Routing Foundation
  - frozen spec blob: 8d47a2b8ad0431540598ceecef14550bd383fe1f
  - runtime not on main.
- Slice 12 — Digital Use Assessment Runtime
  - frozen spec blob: e0ed342dc144fedf5b516b5295a23cbcc31722bc
  - runtime not on main.

### 1.5 Authority Gate result

~~~text
Authority Gate:
PASS

Input Drift:
RECONCILED — NON-SEMANTIC DEPENDENCY EXECUTION DRIFT
~~~

No authority conflict requires stopping Slice 13 specification.

---

## 2. Selection Gate

### 2.1 Formal Phase 2 order

Docs/V1技术设计.md §38 currently orders Phase 2 as:

1. Scene Package / single node-manifest.ts / deterministic routing.ts;
2. canonical snapshot + completeness/routing CI;
3. A1001–A2010;
4. FAMILY_ALLIANCE stream — A3000–A3113 actual nodes;
5. PHONE_USE_CONTRACT stream — A4001–A4012;
6. target-list / feasibility fidelity, contract assets, roleplay, A5001/A5002 and remaining Digital Use fidelity.

Slice 11 freezes items 1–2.

Slice 12 freezes the runtime contract for item 3.

The next explicit bounded Scene capability is FAMILY_ALLIANCE.

### 2.2 Candidate comparison

| Candidate | Why it could be done now | Why it should / should not be next | Dependencies | Independent business capability | Size / shell risk | Decision |
|---|---|---|---|---|---|---|
| A. FAMILY_ALLIANCE A3000–A3113 | It is the next explicit Phase 2 capability and its canonical topology is already frozen by Slice 11. | It follows Assessment and precedes the Contract stream. | Slice 8, 9, 10, 11, 12 runtime contracts. | YES — alliance preparation, target management, feasibility, Scene-level progress and help/re-entry form one user-visible stream. | Large node count but coherent; splitting creates incomplete target truth. | **SELECTED** |
| B. PHONE_USE_CONTRACT A4001–A4012 | Required by V1 and is a parallel solution stream. | It is explicitly ordered after FAMILY_ALLIANCE. A4003 additionally has adult/guardian-only Simulation and later AI obligations. | Manifest/routing, Compliance, Assessment/solution entry, later AI for full A4003 behavior. | YES, but it is not the next capability. | Larger downstream dependency surface. | DEFER |
| C. Goal / Intervention Core | Common Core eventually needs formal Goal and InterventionInstance. | §38 places these in Phase 4; pulling them forward would let Common Core abstraction rewrite the Phase 2 canonical Scene. | confirmed Problem Formulation, reviewed intervention definitions, later Plan. | YES later. | Premature architecture if done now. | DEFER |
| D. Plan / Task / Checkin / Review Runtime | Required for the complete V1 execution loop. | Explicit Phase 4 work; the words “目标 / 任务 / 进度” in A300x do not authorize these domain objects now. | Goal, Intervention, follow-up/review contracts. | YES later. | Severe scope expansion now. | DEFER |
| E. Notification / Schedule / Follow-up Runtime | Needed for active reminders and durable service. | Phase 4; depends on real Plan/follow-up truth and delivery authorization. | Plan, schedules, pg-boss, notification adapter. | YES later. | A standalone early slice would be an infrastructure shell. | DEFER |
| F. A5001/A5002 Review Runtime | Required to review the two solution streams. | It follows both streams and depends on Review semantics; doing it before either stream runtime would create an empty review surface. | FAMILY_ALLIANCE, PHONE_USE_CONTRACT, later Review Core. | Not yet. | Technical shell now. | DEFER |
| G. Scene persistence foundation only | scene_node_states and Scene artifacts are required. | Slice 12 already owns the first real Scene persistence consumer. Creating another foundation would duplicate authority. | Slice 12. | NO as a separate product capability. | Duplicate infrastructure. | REJECT |

### 2.3 Selection result

~~~text
SELECTED:
Digital Use Family Alliance Runtime
FAMILY_ALLIANCE / A3000–A3113 actual canonical nodes

DEFERRED:
PHONE_USE_CONTRACT A4001–A4012
A5001/A5002
Goal / Intervention Core
Plan / Task / Checkin / Review
Notification / Schedule / Follow-up
AI / RAG / professional model runtime
~~~

### 2.4 Why now

This is the first capability after A1001–A2010 in the approved Phase 2 sequence.

It turns the post-Assessment solution boundary into a real, user-observable Family Alliance stream while consuming, rather than duplicating:

- Slice 8 Problem Formulation authority;
- Slice 9 Safety authority;
- Slice 10 Compliance authority;
- Slice 11 Manifest/routing authority;
- Slice 12 Scene State / Evidence / Artifact runtime boundary.

### 2.5 Why not earlier

Before Slice 11, there was no single canonical machine topology.

Before Slice 12, there was no real Digital Use Scene runtime/state/artifact boundary and no A2010 handoff.

Therefore FAMILY_ALLIANCE would previously have forced duplicated routing or a standalone technical shell.

### 2.6 Why not later

Deferring FAMILY_ALLIANCE and implementing PHONE_USE_CONTRACT, Goal Core or Phase 4 execution first would violate §38 and would risk letting generic abstractions redefine the original Digital Use Scene.

---

## 3. Why This Slice Is One Slice

The node count is not the slicing criterion.

The business capability is:

> an authorized family can enter the FAMILY_ALLIANCE solution stream, understand/revisit the alliance principles, perform repeatable self-assessment, prepare communication, select/reselect the canonical target list, work through the approved target-specific feasibility/progress/help semantics, and preserve a coherent current Scene projection without pretending that Common Core Goal/Plan/Task already exists.

Splitting this into “A3000–A3002 first” and “target nodes later” would create a half-product:

- A3002 would allow target selection but selected targets would not have their canonical evaluation/progress/help behavior;
- target-list management would claim capabilities that do not yet exist;
- mandatory/selected targets could become current truth without a legal runtime for their next product steps.

Splitting by target family would also create inconsistent truth:

- one selected target could be fully supported while another canonical selected target is structurally unavailable;
- re-selection and current target-list semantics would depend on deployment order rather than product rules.

The FAMILY_ALLIANCE stream therefore remains one Slice.

This does **not** require one giant transaction. Each user business action retains its own bounded atomicity. Slice cohesion is a business/state-machine boundary, not a transaction-size instruction.

---

## 4. Goals

Slice 13 SHALL define the runtime contract for:

1. legal entry into FAMILY_ALLIANCE after the approved Assessment / Problem Formulation gates;
2. A3000 principle/self-assessment behavior, including repeatability and non-blocking result semantics;
3. A3001 communication-preparation behavior;
4. A3001 and A3002/feasibility parallel fidelity;
5. A3002 target-list selection, confirmation, submission, management, recording and re-selection;
6. all actual A3010–A3113 target-module nodes frozen by Slice 11;
7. target-specific feasibility semantics without inventing a numerical feasibility threshold;
8. Scene-level progress semantics without creating Common Core Task/Checkin runtime;
9. target-specific help/problem-response access and re-entry;
10. current Scene state and target-item revisions without last-write-wins;
11. substantive Evidence provenance without a second Evidence truth;
12. truthful downstream boundaries for PHONE_USE_CONTRACT, A5001 and Phase 4;
13. authorization, Consent, Compliance and Safety enforcement;
14. idempotency, concurrency, atomicity and auditability;
15. deterministic no-model execution for all topology and business gates owned by this Slice.

---

## 5. Non-Goals

Slice 13 is not:

- a generic workflow engine;
- a generic Scene engine;
- a generic form/questionnaire engine;
- a rules DSL;
- XState;
- event sourcing;
- CQRS;
- a second policy engine;
- a second idempotency system;
- a second audit platform;
- an AI agent runtime;
- a Goal/Plan/Task implementation;
- a notification scheduler;
- a professional-content CMS;
- a new Scene.

Node count does not justify any framework abstraction beyond the minimum existing Scene contracts.

---

## 6. Authority / Ownership

### 6.1 Product semantics owner

Docs/V1产品需求.md remains the unique V1 product-semantic source for:

- node meaning;
- target-list meaning;
- explicit target inventory;
- user inputs;
- outputs/records;
- parallel relationships;
- time/user-initiated/help/re-entry semantics;
- Family Alliance professional content.

Slice 13 may not simplify, reorder, merge or rewrite those semantics.

### 6.2 Node / routing owner

Slice 11 remains the only code-side authority for:

- node-manifest.ts;
- canonical node identity;
- prerequisites;
- allowed routes;
- branch reasons;
- parallel relations;
- entry modes;
- help/re-entry references.

Slice 13 is a consumer.

Forbidden:

- second node registry;
- second route table;
- API-local route truth;
- numeric next-node inference;
- client-authoritative nextNode.

### 6.3 Evidence owner

Existing Evidence Core remains the substantive factual truth.

Slice 13 must not create:

- a “Family Alliance answers” factual truth table;
- an authoritative JSON answer blob;
- a second Fact/Statement/Observation system.

### 6.4 Problem Formulation owner

Slice 8 remains the owner of Problem Formulation.

Slice 13 may require a valid current confirmed formulation as an entry gate, but it may not create, confirm, dispute, correct or overwrite formulation truth.

### 6.5 Safety owner

Slice 9 remains the only Safety control authority.

Slice 13 only consumes the ordinary-progression guard and current Case Safety state.

### 6.6 Compliance owner

Slice 10 remains the feature-policy authority.

Slice 13 consumes the eventual authoritative evaluator; it must not recreate age/minor/guardian/AI applicability rules.

### 6.7 Assessment owner

Slice 12 remains the A1001–A2010 runtime owner and the owner of the first Scene-state/artifact runtime boundary.

Slice 13 does not re-run triage or redefine Assessment evidence.

### 6.8 Common Core future owners

The following remain downstream Common Core truths and are not created by this Slice:

- Goal;
- InterventionInstance;
- PlanVersion;
- Task;
- Checkin;
- Review;
- Outcome;
- Follow-up Schedule.

The Scene stream identity FAMILY_ALLIANCE does not itself prove that a Common Core InterventionInstance or active Plan exists.

---

## 7. In Scope

### 7.1 FAMILY_ALLIANCE stream runtime

In scope:

- legal availability/entry of A3000;
- A3000 repeatable self-assessment;
- A3001 communication preparation;
- A3002 target-list lifecycle;
- the actual A3010–A3113 node runtime;
- approved target/feasibility/progress/help content and user input;
- Scene-state revisions;
- Digital Use target-item structured Scene artifacts;
- references to Evidence and existing upstream truths;
- user-initiated, scheduled-intent, help and re-entry semantics already present in the Manifest.

### 7.2 Structured target capability

The approved Digital Use structured target object may represent, semantically:

- case;
- canonical target_code;
- selected / not selected current state;
- user-authored concrete target/measure text where the product requires it;
- feasibility payload;
- Scene-level progress state/records;
- help-history references;
- revision/history;
- dependencies/provenance necessary to prove which product/package semantics governed the result.

Exact columns, indexes and migration layout belong to Plan AI 2.

---

## 8. Out of Scope

Explicitly out of scope:

- A4001–A4012 PHONE_USE_CONTRACT runtime;
- A5001/A5002 review runtime;
- Common Core Goal runtime;
- InterventionInstance runtime;
- PlanVersion runtime;
- Task runtime;
- Checkin runtime;
- Review runtime;
- Outcome runtime;
- Follow-up Schedule;
- notification dispatch;
- pg-boss;
- true WeChat reminders;
- A4003 roleplay;
- AI / LLM / model calls;
- RAG;
- Prompt runtime;
- Memory;
- Operations UI;
- Human Ops;
- new Scene;
- generic workflow/rules/form/state-machine platform;
- XState;
- modifications to Docs;
- modifications to existing frozen Slice specifications.

---

## 9. Canonical Flow / Node Scope

### 9.1 Exact canonical inventory

Slice 13 owns runtime behavior for exactly the following **43** FAMILY_ALLIANCE nodes already frozen by Slice 11:

**Stream entry / preparation / target management**
- A3000
- A3001
- A3002

**Sleep**
- A3010
- A3011
- A3012
- A3013

**Exercise**
- A3020
- A3021
- A3022
- A3033

**Hobbies**
- A3040
- A3041
- A3042
- A3043

**Chores**
- A3050
- A3051
- A3052
- A3053

**Family gathering**
- A3060
- A3061
- A3062
- A3063

**Outdoor activity**
- A3070
- A3071
- A3072
- A3073

**Emotion regulation 1**
- A3080
- A3081
- A3082
- A3083

**Time management**
- A3090
- A3091
- A3092
- A3093

**Family relationship**
- A3100
- A3101
- A3102
- A3103

**Emotion regulation 2**
- A3110
- A3111
- A3112
- A3113

No range generation is permitted.

A3033 is intentional.

No A3023 / A3030 / A3031 / A3032 may be invented.

### 9.2 A3000

A3000:

- presents the approved Family Alliance principles/content;
- collects the approved self-assessment;
- preserves the source/provenance of the user’s answers;
- allows the self-assessment to be repeated;
- does not use the score/result as a blocker for continuation;
- may expose the approved “continue later / user actively continue” semantics;
- does not create a Common Core Goal, Plan or InterventionInstance.

### 9.3 A3001 and A3002 parallel relationship

After the legal Family Alliance entry has been established:

- A3001 communication preparation may begin;
- A3002 target management may become legally available according to the Manifest;
- A3001 does not have to complete before A3002 can begin;
- target feasibility work may progress while A3001 is in progress;
- completing A3002 does not imply A3001 was completed;
- neither branch may falsely complete the other.

The implementation must not turn the approved parallel relation into a serial wizard.

### 9.4 A3002 Target List

A3002 must preserve:

- approved canonical target inventory;
- mandatory/conditional target logic only where current approved product/Manifest rules define it;
- user selection;
- confirmation/submission;
- management;
- evaluation access;
- record access;
- re-selection.

The target list is a Scene-level structured artifact.

It is **not** a Common Core Goal collection.

### 9.5 Target modules

Each canonical target module retains its product-specific node identities and semantics.

Where the source has no explicit numeric next edge, Slice 13 consumes Slice 11 user-initiated/scheduled/help/re-entry metadata. It must not infer “next number”.

### 9.6 Specific fidelity exceptions

**Time management** remains in the current canonical inventory because the later formal V1 Digital Use execution contract explicitly preserves the target and Slice 11 freezes A3090–A3093. Earlier raw-mirror wording suggesting deletion does not authorize Slice 13 to remove it.

**A3111** remains a canonical node identity because the current node table and Slice 11 frozen inventory retain it. The detailed Emotion Regulation 2 content explicitly says that a separate feasibility assessment is not to be performed. Slice 13 therefore MUST NOT invent a new Emotion Regulation 2 feasibility questionnaire, threshold or score merely to fill the node. Its runtime behavior must preserve the canonical A3111 identity while honoring the approved N/A/no-separate-feasibility semantics represented by the authoritative product/Manifest contract.

This is fidelity preservation, not a new professional rule.

---

## 10. Business Truth Model

Slice 13 recognizes five truth categories.

### 10.1 Evidence

Substantive statements/observations about real family behavior, needs, motivation, capability, obstacles, emotion or actual execution remain Evidence with provenance.

A user feasibility score or narrative is user-provided input, not an independently verified Fact or diagnosis.

### 10.2 Scene Node State

Current node progression remains represented by the existing Scene Node State contract:

~~~text
Case + Scene Package Version + Node Code
→ one current node-state aggregate
→ revisioned, deterministic current projection
~~~

There must never be two conflicting current node states for the same aggregate.

### 10.3 Scene Artifact / Digital Use target item

The target-list/target-item structured object owns Scene-specific product state such as:

- selected target;
- current concrete target text;
- feasibility payload;
- Scene-level progress;
- help-history references;
- current revision.

This is not a second Evidence truth and not a Common Core Goal/Task.

### 10.4 Existing Common Core truth

Slice 13 consumes, without redefining:

- Case;
- current primary status;
- Problem Formulation;
- identity/Family/participant;
- Authorization;
- Consent;
- Safety;
- Compliance.

### 10.5 Future downstream truth

Slice 13 may reference a future boundary but may not create current truth for:

- PHONE_USE_CONTRACT;
- Goal;
- InterventionInstance;
- Plan;
- Task;
- Checkin;
- Review;
- Outcome;
- Follow-up Schedule.

---

## 11. Entry / Exit Contract

### 11.1 Legal entry

FAMILY_ALLIANCE cannot be entered merely because the client calls A3000.

Legal entry requires all upstream conditions applicable to the current request, including:

1. authenticated and authorized Family/Case scope;
2. current primary, non-closed Case;
3. current published Digital Use Scene Package / Manifest version;
4. Slice 12’s canonical solution-stage/A2010 boundary is legitimately reached;
5. the formal Problem Formulation gate has been satisfied — no Assessment-to-solution bypass;
6. current Consent/Compliance requirements are satisfied;
7. current authoritative Safety guard permits ordinary progression;
8. Slice 11 routing says A3000 is currently reachable.

Where the confirmed Problem Formulation transition places the Case in GOALS, Slice 13 consumes that upstream state. It does not bypass or recreate the transition.

A2010 route intent alone is not authority to skip Problem Formulation.

### 11.2 Legal exit

Slice 13 does not invent a single “Family Alliance completed” condition when the product does not define one.

In particular:

- not all target items must be forced to complete;
- partial target progress remains real;
- user-declined / unknown / not-yet-completed states remain real;
- Scene target progress is not Outcome;
- a completed node is not equivalent to an active Plan or solved Case.

When canonical routing exposes a later boundary such as PHONE_USE_CONTRACT or A5001, Slice 13 may expose that route/availability truth but must not claim downstream runtime has begun if it is unavailable.

---

## 12. Routing Boundary

Slice 13 consumes the Slice 11 deterministic router.

Routing decisions must be based on:

- the current published Manifest/package;
- current valid Scene state;
- structured approved user responses;
- existing Evidence references where required;
- independent business gates.

Routing must not be based on:

- node number adjacency;
- client nextNode;
- an LLM;
- arbitrary fallback;
- a second local route table.

Unknown/no-match must fail closed or preserve an explicit unknown/blocked state.

---

## 13. Evidence Contract

1. Evidence remains provenance-aware.
2. UNKNOWN, NOT_COLLECTED, DECLINED, CONFLICT and N/A remain distinct.
3. A user feasibility answer cannot be promoted to Fact simply because a target was selected.
4. Child agreement cannot be invented from a parent’s statement.
5. Family-member statements remain attributed to their real source.
6. Re-entry never destructively rewrites prior Evidence.
7. Corrections/superseding inputs retain history.
8. Target-item payload may reference Evidence; it must not become an authoritative duplicate of the Evidence itself.
9. Help/re-entry interactions that produce new substantive user observations must retain new provenance rather than mutating old source records.

---

## 14. Scene State / Artifact Contract

### 14.1 Scene node current state

Slice 13 extends the Slice 12 Scene runtime boundary; it does not create a second Scene state system.

Current-state rules:

- one current state per Case/package/node;
- revisioned writes;
- explicit status;
- legal reachability only;
- branch/reason traceability;
- input/output references;
- history preserved through events/revisions rather than destructive replacement.

### 14.2 A3000 self-assessment

The Family Alliance self-assessment is repeatable.

A later assessment:

- does not delete the prior one;
- does not silently replace historical answers;
- advances the current projection/revision;
- remains source-attributed;
- still does not become a mandatory pass/fail gate to A3001.

### 14.3 Target list revisions

A target-list re-selection creates a new current selection revision/semantic state.

It must not:

- erase previous selection history;
- silently change old progress records into another target;
- mutate one target’s history into another target’s history.

### 14.4 Feasibility semantics

The approved feasibility dimensions are:

- concrete / quantified behavior;
- need;
- motivation / benefit;
- ability / possibility;
- challenge / resistance.

The current product explicitly does **not** authorize a universal numerical cutoff at which a target becomes “feasible”.

Therefore:

- no invented feasibility threshold;
- no model-generated eligibility score;
- no automatic diagnosis;
- user judgment remains real;
- the system may present approved guidance to make a target more feasible;
- any professional gate outside this Scene artifact remains owned by its upstream/downstream authority.

### 14.5 Scene-level progress semantics

The “task progress” nodes in A301x–A311x are canonical Scene semantics.

In Slice 13 they represent:

- user-recorded progress/observations associated with the Scene target;
- target-item revision/projection;
- Evidence references where substantive observations are recorded.

They do **not** create:

- Common Core Task;
- Task state truth;
- Checkin;
- Plan execution truth;
- Outcome.

The naming overlap is not authority to pull Phase 4 forward.

### 14.6 Help/re-entry

Help nodes and re-entry use only Manifest-approved entry semantics.

Help content:

- is approved professional content, not free model invention;
- may create help-history references;
- does not rewrite prior Evidence;
- does not secretly change target selection or progress.

---

## 15. Authorization

Slice 13 creates no new role.

Every read/write must use existing server-owned:

- authenticated actor;
- Family scope;
- Case scope;
- current participant/visibility/purpose rules;
- RLS.

Rules:

1. Family membership alone does not create new rights.
2. The product language “family alliance” does not automatically grant every family member read/write access.
3. Child participation or child confirmation must have a real authorized source; a parent cannot manufacture the child’s response.
4. Cross-Family access is denied.
5. Cross-Case target/Evidence references are denied.
6. Client-supplied person/family/case/target IDs are untrusted.
7. Unauthorized requests must preserve the repository’s anti-enumeration contract.

---

## 16. Safety / Compliance / Consent

Authorization, Consent, Compliance and Safety remain independent authorities.

### 16.1 Authorization / scope first

The service must establish legal resource scope before revealing protected Case/Family state.

A route result never grants scope.

### 16.2 Consent

Applicable Consent must be valid for the processing/purpose being performed.

A Family Alliance Scene response cannot be used as:

- guardian consent;
- cross-member access consent;
- notification consent;
- unrelated AI/model-processing consent.

Consent revocation blocks affected future processing according to the authoritative upstream contract and does not silently erase history.

### 16.3 Compliance

Slice 13 consumes the future Slice 10 feature-policy decision.

It does not create:

- a second age band;
- a second minor-mode truth;
- a second guardian relation;
- a local “minor allowed” shortcut.

UNKNOWN/unavailable required Compliance truth fails closed.

### 16.4 Safety

The merged Slice 9 Safety guard is authoritative.

When the Case is SAFETY_HOLD or ordinary progression is otherwise denied:

- no ordinary A3000–A3113 progression succeeds;
- retries do not bypass the hold;
- no target selection/progress write is falsely reported as completed;
- this Slice cannot ResolveRisk.

Safety has business precedence over ordinary FAMILY_ALLIANCE progression.

### 16.5 Evaluation-order boundary

The exact SQL/lock/query order belongs to Plan AI 2.

The frozen semantic requirement is:

~~~text
authorized scope
+ required Consent
+ required Compliance
+ current Safety permission
+ current Case/package/node revision
+ canonical routing/business validation
must all be valid before the ordinary business result commits.
~~~

No gate may be omitted because another gate passed.

---

## 17. Idempotency

Slice 13 reuses the existing V1 idempotency authority.

Required semantics:

- same actor + command type + same idempotency key + same canonical payload returns the original business result;
- same key + different canonical payload conflicts;
- replay cannot create duplicate Evidence;
- replay cannot create duplicate node completion;
- replay cannot create duplicate target selection/revision;
- replay cannot create duplicate progress/help record;
- replay cannot create duplicate event/audit result;
- idempotency success cannot survive a rolled-back business result.

No second idempotency store is permitted.

---

## 18. Concurrency

Concurrency must preserve one current truth.

At minimum:

- two concurrent A3002 selection updates cannot both become current;
- two concurrent writes to the same target item cannot silently overwrite each other;
- two concurrent progress writes against one expected revision cannot produce two incompatible current projections;
- primary-Case switch racing with a node response forces revalidation;
- Safety Hold racing with ordinary progression forces revalidation before commit;
- Consent revocation racing with processing forces revalidation;
- Compliance policy/effective-state change racing with processing forces revalidation where applicable;
- Scene Package/Manifest version drift forces revalidation;
- stale target revision fails rather than last-write-wins.

The implementation must never create two current target truths for one Case + target_code.

---

## 19. Atomicity

Each successful business action commits all required effects as one business result.

Depending on the action this may include:

- current Scene Node state/revision;
- Evidence writes/references;
- target-list or target-item structured artifact revision;
- help/progress record;
- Case/business event or audit metadata;
- idempotency result.

Required invariants:

- no Evidence-only half commit with node state still unchanged;
- no node completion without the required target artifact;
- no target selection partially applied across one submitted selection set;
- no audit/idempotency success for rolled-back business data;
- no route advancement if required Safety/Compliance/Consent state became invalid before commit.

Exact transaction mechanics are Plan AI 2 territory.

---

## 20. Correction / Re-entry

### 20.1 Correction

Corrections are additive/superseding.

They do not UPDATE history into a different past.

### 20.2 A3000 repeat

Repeated self-assessment creates a later assessment/current projection while preserving prior source history.

### 20.3 A3002 re-selection

Re-selection is explicit.

Changing the selected target list:

- advances the target-list revision/current state;
- preserves former selections;
- does not delete old target progress;
- does not pretend old work belongs to a new target.

### 20.4 Target re-entry

Re-entering a target/feasibility/progress/help node requires current Manifest permission.

If new information contradicts prior information:

- preserve both sources;
- represent conflict/correction truthfully;
- do not silently choose one.

### 20.5 Primary / package drift during re-entry

Re-entry is not a bypass.

The system rechecks current primary Case, package/version, routing, Authorization, Consent, Compliance and Safety.

---

## 21. Failure Semantics

The runtime must distinguish, at minimum:

1. resource not found / unauthorized scope;
2. unknown/fabricated node;
3. canonical node but currently unreachable;
4. wrong Case / cross-Case reference;
5. invalid target code;
6. schema-invalid response;
7. UNKNOWN / DECLINED / CONFLICT business state;
8. Safety blocked;
9. Compliance blocked / unresolved;
10. Consent missing/revoked;
11. stale Case/node/target/package revision;
12. idempotency payload mismatch;
13. concurrent write conflict;
14. infrastructure failure;
15. downstream capability unavailable.

Failures must be truthful.

A missing future A4001/A5001/Goal/Plan runtime is not “success”.

No best-effort hidden route is allowed.

---

## 22. Observability / Audit

Every successful mutation must be attributable, as applicable, to:

- Family;
- Case;
- authenticated actor;
- Scene Package version;
- node code/source node code;
- prior/current node revision;
- target_code;
- target-list/target-item revision;
- branch/re-entry/help reason;
- Evidence/artifact references;
- idempotency identity;
- timestamp.

Audit/logging must not become a shadow store of raw sensitive family narratives.

Approved professional content/version references must remain traceable where needed.

No AI-run provenance is invented because Slice 13 is no-model.

---

## 23. Dependencies

### 23.1 Current runtime available on main

Current main provides, among earlier foundations:

- identity/Family/Case baseline;
- Evidence Core;
- Authorization/RLS/idempotency/audit foundations;
- Slice 9 Safety Hold Control runtime.

### 23.2 Frozen-but-not-current runtime dependencies

**Slice 8 — Problem Formulation Core**

Required because FAMILY_ALLIANCE cannot legally bypass the confirmed Problem Formulation / GOALS gate.

Current state: PR #26 open/draft, not merged.

**Slice 10 — Compliance Feature Policy Foundation**

Required as the feature-policy authority where applicable.

Current state: frozen/planned; no feature runtime branch currently present.

**Slice 11 — Node Manifest / Deterministic Routing Foundation**

Required as the only node/routing authority.

Current state: frozen/planned; no feature runtime branch currently present.

**Slice 12 — Digital Use Assessment Runtime**

Required for Scene-state/artifact runtime, A1001–A2010 execution, A2010 solution boundary and Assessment-side handoff.

Current state: frozen/planned; no feature runtime branch currently present.

### 23.3 Downstream, not implementation blockers

The following are downstream and must not be pulled into Slice 13 merely to make it “complete”:

- PHONE_USE_CONTRACT runtime;
- Phase 3 AI/RAG;
- Common Core Goal/Intervention/Plan/Task/Checkin/Review runtime;
- notifications/follow-up;
- A5001/A5002.

They may be release/activation dependencies for later full V1 behavior, but they are not permission to expand Slice 13.

---

## 24. Future Implement Gate

### 24.1 Planning readiness

~~~text
Planning Ready:
YES
~~~

This specification can be handed to Plan AI 2.

### 24.2 Runtime availability

~~~text
Runtime Available:
NO
~~~

Planning Ready does not mean Runtime Available.

### 24.3 Implement Gate

~~~text
Implement Gate:
BLOCKED
~~~

Before Slice 13 implementation may begin, the then-current main must contain and reconcile:

1. Slice 8 Problem Formulation runtime after independent Audit 2 PASS and merge;
2. Slice 9 Safety runtime — already merged at this freeze, but must remain authoritative after subsequent rebases;
3. Slice 10 Compliance Feature Policy runtime after required audit/merge;
4. Slice 11 Node Manifest / deterministic routing runtime after required audit/merge;
5. Slice 12 Digital Use Assessment runtime after required audit/merge;
6. a fresh authority re-read proving no Docs / frozen-contract / migration / shared-runtime drift invalidates this specification.

If any dependency changes semantics, Slice 13 must reconcile before implementation rather than silently patching upstream contracts.

Phase 3/4 work is **not** a prerequisite for implementing this bounded Phase 2 runtime and must not be dragged forward.

---

## 25. Acceptance Scenarios

### 25.1 Entry / happy path

1. **Legal entry**: current authorized primary Case reaches the valid A2010 solution boundary, Problem Formulation is currently confirmed, required gates pass, and deterministic routing admits A3000; FAMILY_ALLIANCE becomes available without bypassing Problem Formulation.
2. **A3000 non-blocking**: any valid self-assessment result permits the approved continuation; the runtime does not create a pass/fail threshold.
3. **A3000 repeat**: the user repeats self-assessment; prior history remains and a new current revision is visible.
4. **Parallel start**: A3001 and A3002/target-feasibility work can progress in parallel; neither requires the other to complete first.
5. **Target list**: user selects, confirms and submits a valid canonical set; the target-list current revision is saved atomically.
6. **Target re-selection**: user later changes selection; previous selection/progress history remains.
7. **Feasibility**: an applicable target records the approved dimensions without a fabricated feasibility cutoff.
8. **Scene progress**: a target progress node records Scene-level progress and Evidence refs without creating a Common Core Task/Checkin.
9. **Help**: a reachable help node can be entered/re-entered through Manifest-approved semantics and does not rewrite prior target truth.

### 25.2 Fidelity / target scope

10. **Exact inventory**: exactly the 43 canonical FAMILY_ALLIANCE node identities are addressable; no inferred missing range node exists.
11. **A3033 fidelity**: exercise help remains A3033; A3023/A3030/A3031/A3032 are rejected.
12. **Time-management fidelity**: A3090–A3093 remain canonical and are not deleted by earlier raw-mirror wording.
13. **A3111 fidelity**: A3111 remains a canonical node identity, but no unapproved Emotion Regulation 2 feasibility questionnaire/score/threshold is invented.
14. **Target-code attack**: fabricated/noncanonical target code is rejected.
15. **No numeric adjacency**: a client cannot force the next target/help node merely by choosing the next number.

### 25.3 Unknown / declined / conflict

16. **Unknown**: missing knowledge remains UNKNOWN/NOT_COLLECTED and does not become a default positive answer.
17. **Declined**: user declines an optional input; the decline is preserved and not interpreted as failure/success.
18. **Conflict**: parent/child or repeated source conflict remains visible; runtime does not choose a fact winner by itself.
19. **Partial completion**: some targets have progress while others do not; the stream is not falsely marked globally complete.

### 25.4 Authorization / isolation

20. **Unauthorized**: an unauthorized actor cannot read/write Family Alliance state.
21. **Cross-family**: Family A cannot read/write Family B target state or Evidence.
22. **Wrong-case**: a target/Evidence reference from another Case cannot satisfy the current Case node.
23. **Participant escalation**: being a Case Participant does not by itself grant Family Alliance mutation authority.
24. **Child source fidelity**: parent input cannot be stored as the child’s real agreement/statement.

### 25.5 Safety / Compliance / Consent

25. **Safety blocked**: current SAFETY_HOLD blocks ordinary A3000–A3113 progression and no success state is committed.
26. **Safety race**: Safety Hold wins before commit; the ordinary node write revalidates and fails.
27. **Compliance blocked**: authoritative policy BLOCK/required unresolved state fails closed.
28. **Compliance unknown**: missing required policy is not treated as ALLOW.
29. **Consent revoked**: applicable Consent is revoked before commit; affected processing does not complete.
30. **Gate separation**: Authorization ALLOW alone does not override Consent/Compliance/Safety denial.

### 25.6 Idempotency / concurrency / atomicity

31. **Idempotent replay**: same key/same payload returns the original result with no duplicate target/Evidence/event.
32. **Idempotency mismatch**: same key/different payload conflicts.
33. **Concurrent A3002 write**: two writes against one expected selection revision cannot both become current.
34. **Concurrent target write**: two incompatible writes against the same target revision cannot last-write-win.
35. **Primary switch race**: primary Case changes before commit; stale Family Alliance progression fails.
36. **Package drift**: Scene Package/Manifest version changes before commit; stale evaluation cannot apply silently.
37. **Atomic failure**: failure after Evidence/target preparation but before node completion leaves no partial business result and no completed idempotency result.

### 25.7 Re-entry / downstream boundaries

38. **Re-entry**: user re-enters A3000/A3002/help through approved Manifest semantics; history remains and current gates are rechecked.
39. **PHONE_USE_CONTRACT unavailable**: canonical parallel route may be visible, but Slice 13 does not create/complete A4001 work.
40. **A5001 unavailable**: later review boundary is represented truthfully without creating Review truth.
41. **No Common Core Goal**: selected Scene target does not create a goals row/domain truth.
42. **No Plan**: feasibility/progress does not activate a Plan.
43. **No Task/Checkin**: Scene “task progress” does not create Phase 4 Task/Checkin truth.
44. **No AI authority**: the complete topology/business-routing acceptance fixture can run without an LLM/network decision service.

---

## 26. Scope Guard

A Slice 13 implementation is out of scope if it introduces any of the following merely for convenience:

- second node registry;
- second route table;
- second Evidence truth;
- second Safety evaluator/state;
- second Compliance evaluator;
- second idempotency infrastructure;
- Goal/Intervention/Plan/Task/Checkin/Review domain runtime;
- PHONE_USE_CONTRACT runtime;
- A5001/A5002;
- AI/RAG/Prompt runtime;
- notification/scheduler/pg-boss;
- generic workflow/rule/form/state-machine engine;
- XState;
- Operations/Human Ops;
- new Scene.

If implementation appears to require one of these, it must stop and escalate the boundary conflict rather than expanding this Slice.

---

## 27. Open Questions

### Product questions

~~~text
Open Product Decisions:
0
~~~

No unresolved product-owner decision is required for Plan AI 2.

### Technical questions intentionally left to Plan AI 2

These are not product clarifications:

- exact migration identifier;
- exact table/column/index representation of target-item revisions;
- exact module/service names;
- exact transaction/lock order;
- exact HTTP DTO field names;
- exact test-file layout;
- exact static-guard implementation.

They may not change the frozen semantics above.

---

## 28. Clarification Resolution

### C1 — Where does FAMILY_ALLIANCE enter?

**RESOLVED.**

Canonical product routing points from A2010 toward A3000, but Common Core forbids bypassing Problem Formulation.

Therefore actual business entry requires both:

- legal canonical solution-stage/A2010 route intent;
- the authoritative Problem Formulation gate to be satisfied.

A2010 alone cannot directly force A3000 past Common Core.

### C2 — Are A3001 and A3002 serial?

**RESOLVED — NO.**

The product explicitly permits A3001 to proceed in parallel with A3002/target feasibility. No A3001-completion prerequisite may be invented.

### C3 — Must every parallel branch complete?

**RESOLVED — NO GENERAL ALL-COMPLETE RULE EXISTS.**

Each node/target preserves its own true state. The product does not authorize a fabricated “all targets completed = Family Alliance complete” rule.

### C4 — Is Target List a Common Core Goal?

**RESOLVED — NO.**

It is a Digital Use Scene structured target artifact. The product mapping to future Goal/Task capability describes eventual Common Core carrying capacity; it does not pull Phase 4 objects into Phase 2.

### C5 — What is feasibility truth?

**RESOLVED.**

Feasibility is a versioned Scene-level structured target payload containing approved dimensions and user-sourced inputs. It is not a diagnosis, not a standalone domain truth, and has no invented universal pass threshold.

### C6 — What is progress truth?

**RESOLVED.**

A301x–A311x progress is Scene-level target progress/observation for this Slice. It is not Phase 4 Task/Checkin/Plan execution truth.

### C7 — What does re-entry do?

**RESOLVED.**

Re-entry is allowed only where Manifest semantics permit it. It advances current Scene/target revisions while preserving historical Evidence/artifacts and rechecking all current gates.

### C8 — How do FAMILY_ALLIANCE and PHONE_USE_CONTRACT relate?

**RESOLVED.**

They are two canonical parallel solution streams. Slice 13 implements only FAMILY_ALLIANCE. It may not require the Contract stream to complete first and may not fake A4001–A4012 runtime.

### C9 — Does “家庭联盟” grant family-wide authorization?

**RESOLVED — NO.**

Product participation language does not override Authorization/Consent/RLS. Only currently authorized sources may read/write.

### C10 — Does Slice 13 need AI?

**RESOLVED — NO.**

Routing, eligibility owned by this Slice, target selection validation, feasibility structure and state progression remain deterministic. Approved content may be presented without making an LLM an authority.

### C11 — Are A3033 / A309x / A3111 mistakes to fix?

**RESOLVED — NO SILENT FIXING.**

- A3033 is canonical sparse numbering.
- A3090–A3093 remain canonical under the later formal execution contract.
- A3111 remains a canonical node identity while honoring the explicit no-separate-feasibility-content exception; no new professional scoring content is invented.

### C12 — Does the Scene stream create InterventionInstance?

**RESOLVED — NO.**

FAMILY_ALLIANCE is a canonical Scene stream identity in Phase 2. Formal Common Core InterventionInstance/Plan activation remains downstream and cannot be inferred from Scene completion.

### C13 — Can Scene progress be used as Outcome?

**RESOLVED — NO.**

Outcome/Review remains downstream. Scene progress is not proof of improvement.

### C14 — What if a future downstream capability is unavailable?

**RESOLVED.**

Expose the real unavailable boundary; never mark it started/completed.

---

## 29. Frozen Spec Gate

~~~text
SLICE 13 — PLAN AI 1

Authority Gate:
PASS

Input Drift:
RECONCILED — NON-SEMANTIC DEPENDENCY EXECUTION DRIFT

Selection:
PASS

Selected Capability:
Digital Use Family Alliance Runtime
FAMILY_ALLIANCE / A3000–A3113 actual canonical nodes

Whole-Slice Decision:
PASS — keep as one bounded Slice

Canonical Node Count:
43

Specify:
FINAL PASS

Clarify:
FINAL PASS

Open Product Decisions:
0

Docs Changed:
NO

Existing Frozen Specs Changed:
NO

Production Code Changed:
NO

Migration Changed:
NO

Tests Changed:
NO

CI Changed:
NO

Plan:
NOT STARTED

Checklist:
NOT STARTED

Tasks:
NOT STARTED

Audit 1:
NOT STARTED

Implement:
NOT STARTED

Implement Gate:
BLOCKED

READY FOR PLAN AI 2
~~~

### Implement Gate blockers at freeze time

- Slice 8 runtime not merged;
- Slice 10 runtime not implemented/merged;
- Slice 11 runtime not implemented/merged;
- Slice 12 runtime not implemented/merged.

Slice 9 is no longer a blocker because PR #28 is merged into current main.

### Plan AI 1 stop boundary

This specification intentionally stops before:

- plan.md;
- checklist.md;
- tasks.md;
- Audit 1;
- production implementation;
- migration;
- tests/CI implementation;
- development PR;
- Audit 2;
- merge.

The next permitted role is **Plan AI 2**.
