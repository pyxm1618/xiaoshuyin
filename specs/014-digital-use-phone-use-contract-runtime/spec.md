# Slice 14 — Digital Use Phone Use Contract Runtime

> Role: Plan AI 1
>
> Scope: Selection → Specify → Clarify → Frozen Spec
>
> Repository: pyxm1618/xiaoshuyin
>
> Frozen against origin/main: eaf2bb3adc2d9499a4ed84d0ca560c55209628f8
>
> Selected capability: Digital Use Phone Use Contract Runtime — PHONE_USE_CONTRACT / A4001–A4012
>
> V1 implementation phase: Phase 2 — Digital Use Scene fidelity
>
> Status: FROZEN SPEC — READY FOR PLAN AI 2
>
> Runtime status: NOT IMPLEMENTED

This specification is a downstream projection of the four formal Docs and existing frozen/runtime owners. It does not redesign Digital Use, Common Core, Safety, Compliance, Consent, Evidence, Scene Manifest, Routing, AI/RAG, Phase 4 execution infrastructure, or professional content.

---

## 1. Authority Gate

### 1.1 Repository truth at Selection

Repository:

- pyxm1618/xiaoshuyin

Remote main re-read immediately before the Slice 14 branch was created:

- origin/main = eaf2bb3adc2d9499a4ed84d0ca560c55209628f8
- latest main is the merge of PR #31, Slice 11 Digital Use Node Manifest / Deterministic Routing Foundation.

Execution environment note:

- this run used authenticated GitHub remote access rather than a local checkout;
- therefore a local current branch and local working-tree status do not exist in this execution context;
- remote refs and file blobs were re-read directly before freeze;
- the Slice 14 spec branch was created from the exact main SHA above, not from a chat-supplied historical SHA.

Open pull requests at the final pre-freeze remote re-read:

- none.

Existing Slice 14 artifacts before branch creation:

- no 014 directory on main;
- no branch containing 014 or slice14;
- no Slice 14 PR.

Therefore there is no competing Slice 14 artifact and no second Slice 14 is being created.

### 1.2 Formal Docs

The four formal authorities were completely re-read from current main.

| Authority | Blob |
|---|---|
| Docs/总产品需求.md | 67724000cb9bb81c40489c04db28d899bd1df74c |
| Docs/V1产品需求.md | 918d8574ad88773fe371985fd5c38080c944fec9 |
| Docs/总体技术架构.md | 9b08371edc976fa281469dfee8dc19962452e3b0 |
| Docs/V1技术设计.md | e7285fd8363c8a76ab4fd96a305037b5c675f961 |

Authority order is frozen as:

1. formal Docs;
2. already frozen upstream Slice contracts;
3. this Slice 14 Frozen Spec.

Reference files or older mirrored wording cannot override the current V1 Product Requirements.

### 1.3 Current upstream state

The current repository state was rechecked rather than copied from historical planning reports.

| Slice | Frozen contract | Plan / Audit 1 | Runtime implementation | Main status relevant to Slice 14 |
|---|---|---|---|---|
| 8 — Problem Formulation Core | present on main; spec blob 6a5656abab211a4dd80f6e1b0e20d358193ffb17 | completed historically | PR #26 implemented and merged | runtime is current main truth |
| 9 — Safety Hold Control Foundation | present on main | completed historically | PR #28 plus post-merge PR #29 merged | runtime is current main truth |
| 10 — Compliance Feature Policy Foundation | present on main | completed | PR #30 merged; PR records independent audit PASS / MERGE SAFE | runtime is current main truth |
| 11 — Node Manifest / Deterministic Routing | present on main; spec blob 8d47a2b8ad0431540598ceecef14550bd383fe1f | completed | PR #31 merged | runtime is current main truth |
| 12 — Digital Use Assessment Runtime | Frozen Spec commit 5e397fee86eb29da1acc1a5a1d176e0c73aa8849; blob e0ed342dc144fedf5b516b5295a23cbcc31722bc | plan branch 496f8d33c7147fcb77848fa1acc8e990d75c2ab0; Audit 1 FINAL PASS | no feature/runtime branch found; no runtime PR | planning truth only; NOT on main |
| 13 — Digital Use Family Alliance Runtime | Frozen Spec commit 07f3692b9f4e79b98a27a0c7f21913e0e6776b34; blob c3e9bf9aa9296e54c8faec0ec83cc15a2d75289b | plan head f2d13df2d12e7a75e09da4ebcf22fe6579e008a4; Audit 1 FINAL PASS | no feature/runtime branch found; no runtime PR | planning truth only; NOT on main |

For Slices 8–11, merge-to-main is current runtime truth. A later Slice 14 development start must still re-read the exact independent-audit and current-main evidence rather than treating this planning table as a permanent release certificate.

For Slices 12–13, frozen/planned contracts are design authority only. They are not production runtime.

### 1.4 Authority drift classification

The four Docs blobs match the blobs recorded by the Slice 12/13 planning artifacts. Slice 8–11 execution state advanced since those older planning reports, but the formal Docs and frozen Slice 12/13 product semantics did not change.

Classification:

- dependency execution drift: RECONCILED;
- semantic authority drift: NONE;
- product conflict: NONE.

Authority Gate: PASS.

---

## 2. Selection Gate

### 2.1 Formal Phase 2 sequence

Docs/V1技术设计.md §38 freezes Phase 2 in this order:

1. Digital Use Scene package / single node-manifest / deterministic routing;
2. canonical product snapshot + Manifest completeness/routing CI;
3. A1001–A2010 Assessment;
4. FAMILY_ALLIANCE A3000–A3113 actual canonical nodes;
5. PHONE_USE_CONTRACT A4001–A4012;
6. A5001 / A5002 reviews.

The same authority explicitly places:

- professional knowledge and real AI runtime in Phase 3;
- Goal / InterventionInstance / Plan / Task / Checkin / Review / Outcome / Follow-up / pg-boss / Notification in Phase 4.

V1 Product Requirements also freezes FAMILY_ALLIANCE and PHONE_USE_CONTRACT as two parallel solution streams. One stream must not be made a business prerequisite for the other.

### 2.2 Candidate comparison

| Candidate | Decision | Reason |
|---|---|---|
| A. PHONE_USE_CONTRACT A4001–A4012 | SELECTED | exact next bounded Phase 2 capability; formal detailed product sub-spec exists; has independent business value; uses existing Manifest/Scene owners; completes the second canonical solution stream boundary without entering A500x |
| B. A5001 / A5002 Review Runtime | DEFERRED | formally after both Phase 2 streams and also depends on Phase 4 Review truth; selecting it now would skip the contract stream and pull downstream Review semantics forward |
| C. Goal / Intervention Core | DEFERRED | Phase 4 Common Core; current Phase 2 Digital Use fidelity remains incomplete; selecting it now violates §38 implementation order |
| D. Plan / Task / Checkin / Review Runtime | DEFERRED | Phase 4; would create downstream owners before completing A4001–A4012 and risks confusing Scene progress/support with Common Core execution truth |
| E. Notification / Follow-up / Schedule | DEFERRED | Phase 4 durable execution infrastructure; A4011 may reference the future boundary but Slice 14 must not create schedule/job/reminder truth |
| F. Professional Knowledge / AI / RAG Runtime | DEFERRED | Phase 3; A4003 needs a future real AI execution adapter, but that dependency does not authorize pulling Phase 3 platform work into Slice 14 |
| G. Other capability discovered in the Docs | REJECTED AS NEXT SLICE | no formal capability appears between FAMILY_ALLIANCE and PHONE_USE_CONTRACT that has higher phase-order authority; template/examples/FAQ/roleplay are components of A4001–A4012, not separate Slices |

### 2.3 Selection result

SELECTED:

Digital Use Phone Use Contract Runtime
PHONE_USE_CONTRACT
A4001–A4012

Selection Gate: PASS.

---

## 3. Selected Capability

Slice 14 implements the bounded Phase 2 runtime contract for the canonical PHONE_USE_CONTRACT stream:

A4001
→ A4002
→ A4003
→ A4004
→ A4005–A4009 as distinct tool/preparation components without invented numeric adjacency
→ A4010
→ A4011
→ A4012

The exact node topology and legal entry/re-entry modes are consumed from the merged Slice 11 Manifest. Slice 14 must not create a second registry, a second route table, or a hidden workflow.

A4001–A4012 are not a generic contract platform. They are the Digital Use Scene's approved phone-use-contract capability.

---

## 4. Why Now

This is the correct next specification because:

1. Slice 11 has already made the canonical A4001–A4012 topology machine-addressable on main.
2. Slice 12 has frozen the Assessment / Scene State / Artifact runtime that will own the A2010 solution boundary when implemented.
3. Slice 13 has frozen the sibling FAMILY_ALLIANCE stream and explicitly confirms the two streams are parallel rather than serial.
4. §38 places PHONE_USE_CONTRACT immediately after FAMILY_ALLIANCE and before A5001/A5002, Phase 3 AI, and Phase 4 execution infrastructure.
5. The four formal Docs already contain a complete A4001–A4012 detailed professional sub-spec, including the template, four examples and FAQ.
6. Delaying this Slice in favor of Phase 3/4 would leave the second canonical Phase 2 stream unspecified while downstream capabilities advance.

---

## 5. Why One Slice

A4001–A4012 remain one Slice because they share one bounded business purpose and one versioned Contract truth:

- preparation and education;
- template/examples;
- communication rehearsal boundary;
- preparation tools;
- formal contract creation;
- execution support boundary;
- version update.

Splitting these nodes would create a partially owned Contract truth and duplicate activation/versioning boundaries.

Keeping them together does not mean pulling all future infrastructure into this Slice. The Slice explicitly keeps:

- real AI execution behind a Phase 3 adapter;
- Common Core Plan/Task/Checkin/Review behind Phase 4 owners;
- reminders, schedules and pg-boss behind Phase 4;
- A5002 Review outside this Slice.

Thus the Slice is one business capability with hard downstream seams, not an all-in-one platform.

---

## 6. Goals

Slice 14 must specify a future implementation that:

1. faithfully executes the canonical A4001–A4012 node semantics;
2. consumes Slice 11 Manifest/routing rather than redefining topology;
3. consumes the Slice 12 Scene State / Scene Artifact owner once runtime exists;
4. introduces only the already-authorized Digital Use Contract Version and Roleplay Session/Turn truth described by V1 technical design;
5. keeps professional template, quiz, four examples and FAQ versioned and distinct from family facts;
6. preserves true actor/source provenance for parent and child inputs;
7. prevents any parent or AI from manufacturing child confirmation;
8. activates a formal Contract only through versioned, atomic, current-state validation;
9. updates an active Contract only by creating a new version with a supersedes chain;
10. keeps A4003 adult/guardian-only and SIMULATION-only;
11. remains deterministic and testable without a real model by defining an AI adapter boundary;
12. fails truthfully when Phase 3 AI or Phase 4 follow-up infrastructure is unavailable;
13. preserves the sibling FAMILY_ALLIANCE stream and contract-refusal branch;
14. preserves Authorization, Consent, Compliance, Safety, Evidence, Idempotency, Audit and Scene owners.

---

## 7. Non-Goals

Slice 14 does not implement or own:

- a generic contract engine;
- a generic workflow/rules/forms/questionnaire engine;
- XState;
- CQRS;
- event sourcing;
- microservices;
- one service per node;
- one table per node;
- a new DSL;
- a new policy engine;
- a second node registry;
- a second route table;
- a second Scene State owner;
- a second Evidence owner;
- a second Consent owner;
- a second Safety owner;
- a second Compliance owner;
- a second Idempotency store;
- a second Audit truth;
- Common Core Goal;
- formal InterventionInstance runtime;
- Plan Version runtime;
- Task runtime;
- Checkin runtime;
- Review / Outcome runtime;
- Follow-up Schedule;
- pg-boss jobs;
- Notification delivery;
- A5001/A5002;
- a production LLM provider;
- RAG;
- Prompt orchestration platform;
- long-term role persona memory;
- generic Agent runtime;
- Family Memory;
- UI redesign;
- a second Scene.

---

## 8. Out of Scope

The following product behavior remains downstream even when A4001–A4012 references it:

- personalized AI roleplay execution when the Phase 3 approved AI runtime is absent;
- AI-generated A4011 personalized support when the approved AI/support runtime is absent;
- automatic/scheduled A4012 entry;
- real reminder delivery;
- Common Core execution Checkins;
- A5002 effect evaluation;
- Case-level Outcome;
- Plan activation;
- notification status;
- professional-content redesign.

Slice 14 may expose truthful capability-unavailable state for these boundaries. It must not fabricate completion.

---

## 9. Ownership / Source of Truth

### 9.1 Product semantics

Owner:

- Docs/V1产品需求.md, especially V1-D15–V1-D26 and V1-D35–V1-D42;
- Docs/V1技术设计.md §§7.4, 12.5, 12.6, 23, 27B, 28.6, 29.3, 32, 38, 39.

Slice 14 cannot silently improve, simplify or replace this professional content.

### 9.2 Node identity and routing

Owner:

- merged Slice 11 node-manifest.ts and routing.ts.

Slice 14 consumes:

- node identities;
- phases;
- stream identity;
- allowed next;
- entry mode;
- help/re-entry refs;
- policy refs.

No second node/routing truth is allowed.

### 9.3 Scene State and generic Scene Artifacts

Owner:

- Slice 12 Frozen Contract and, once implemented, its authoritative runtime.

Slice 14 may use the owner seam; it may not create a private alternative Scene-state store.

### 9.4 Evidence / provenance

Owner:

- existing Evidence Core / assertions / observations and current provenance contracts.

Parent input stays parent-sourced. Child input becomes child-sourced only when it actually originates from an authorized child source.

### 9.5 Phone-use Contract truth

The V1 technical design already authorizes:

- digital_use_contract_versions

Slice 14 owns implementation of this approved Digital Use-specific truth when development begins. It is not permission to create a generic Contract platform.

Logical fields include:

- case reference;
- version;
- status: DRAFT / PENDING_CONFIRMATION / ACTIVE / SUPERSEDED / PAUSED;
- parties;
- purpose;
- phone_use_rules;
- execution_period;
- parent_support_measures;
- supervision_measures;
- incentives;
- breach_responsibilities;
- source_template_version;
- parent_confirmation;
- child_confirmation only from a genuine child source;
- supersedes_id when applicable;
- dependency_refs.

At most one current ACTIVE phone-use Contract version may exist for one Case.

### 9.6 Roleplay truth

The V1 technical design already authorizes:

- roleplay_sessions;
- roleplay_turns.

These persist SIMULATION practice only:

- session;
- round input/output references;
- rating;
- selected result;
- professional/prompt/compliance version refs.

They are not Statement, Fact, Consent, child persona or child memory.

### 9.7 Professional assets

The current V1 Product Requirements are the approved semantic baseline for:

- A4001 principles and five questions;
- A4002 template;
- all four examples;
- A4011 FAQ;
- support principles.

At runtime these are versioned Digital Use Scene Package / professional assets. They must never be copied into Family truth merely because they are examples.

Slice 14 must not create a general Professional Knowledge/RAG platform to carry them.

### 9.8 Existing control-plane owners

Slice 14 only consumes:

- Case / primary truth;
- Family / Participant / Identity truth;
- Authorization;
- Consent;
- Compliance;
- Safety;
- Idempotency;
- business audit / case event;
- package/version truth.

If an exact required seam does not exist when implementation starts, development stops for an owner-approved narrow seam. Slice 14 must not create a replacement owner.

---

## 10. Runtime Dependencies

### 10.1 Planning dependencies

Planning is valid now because the following contracts are frozen and their semantics can be consumed:

- Slice 11 Manifest/routing runtime on main;
- Slice 12 Frozen Spec + Plan/Audit 1;
- Slice 13 Frozen Spec + Plan/Audit 1;
- the four formal Docs.

### 10.2 Hard runtime dependencies for Slice 14 development

Before production implementation may cross the Implement Gate, then-current main must provide:

1. Slice 8 Problem Formulation owner and legal solution-stage gate;
2. Slice 9 Safety Hold owner;
3. Slice 10 Compliance feature-policy owner;
4. Slice 11 Manifest/routing owner;
5. Slice 12 Digital Use Assessment / Scene State / Artifact runtime, including the legal A2010 solution boundary and its reconciled owner seams.

The first four are currently merged but must be revalidated at development start.

Slice 12 is currently not implemented/merged and is therefore the current hard blocker.

### 10.3 Slice 13 is not a runtime prerequisite

Slice 13 FAMILY_ALLIANCE runtime is not a business prerequisite for Slice 14.

Reason:

- V1-D08 and Slice 11 explicitly define FAMILY_ALLIANCE and PHONE_USE_CONTRACT as independent parallel streams;
- A4001 can be available from the approved solution-stage context without requiring A3000–A3113 completion;
- refusal/absence in PHONE_USE_CONTRACT must not block FAMILY_ALLIANCE, and the inverse dependency is equally unauthorized;
- Slice 14 does not consume Slice 13 target-item persistence or target-progress owners.

Slice 13 remains a planning/sibling-boundary dependency for consistency and collision avoidance, not a hard runtime dependency.

If a future shared migration or seam creates a mechanical dependency, development must reconcile that exact implementation fact without converting it into a new business prerequisite.

### 10.4 Phase 3 AI is not an Implement Gate prerequisite

Real AI/RAG is not required to implement the deterministic Phase 2 Contract runtime.

However:

- production A4003 cannot be falsely completed when no approved roleplay AI adapter/runtime exists;
- deterministic tests may use a controlled fixture/fake adapter to prove the A4003 contract;
- real roleplay becomes genuinely available only when the Phase 3 approved AI runtime exists and passes all Compliance/Release gates.

### 10.5 Phase 4 runtime is not an Implement Gate prerequisite

Goal / Plan / Task / Checkin / Review / Follow-up / Notification are not prerequisites for implementing this bounded Phase 2 stream.

A4011 and A4012 must preserve their future integration seams while remaining truthful about unavailable downstream capabilities.

---

## 11. Entry Contract

### 11.1 Stream entry

Legal initial entry to A4001 requires all of the following at commit time:

- current authenticated actor;
- authorized target Family and Case;
- current primary Case;
- Digital Use Scene/package is current and allowed;
- current solution-stage context is legally reached through the authoritative A2010 / Problem Formulation boundary;
- current Problem Formulation gate is satisfied;
- current Manifest/routing says A4001 is reachable;
- no ordinary-progression Safety block;
- applicable Compliance obligations are satisfied;
- applicable Consent remains valid;
- expected Case / Scene revision is current.

A client cannot force A4001 by sending a node code.

### 11.2 Parallel stream rule

A3000 completion is not an A4001 prerequisite.

FAMILY_ALLIANCE can be absent, in progress or completed without changing legal A4001 entry unless an explicit future product revision says otherwise.

### 11.3 Direct node entry

A4002–A4012 may only be entered through the current Manifest and this Spec's node-specific preconditions.

User-initiated or scheduled entry metadata does not mean unrestricted direct access. Every re-entry rechecks:

- authorization;
- current Case/primary;
- package/Manifest version;
- Safety;
- Compliance;
- Consent;
- contract/node revision;
- node-specific business prerequisite.

---

## 12. Exit Contract

### 12.1 A4010

A4010 exits successfully only when:

- the contract draft is valid against the current template schema;
- both sides' actual confirmation requirements are satisfied;
- no parent/AI has fabricated child confirmation;
- current dependencies and control-plane gates pass;
- the version becomes ACTIVE atomically;
- any previous ACTIVE version is superseded only when the operation is a legitimate replacement;
- A4010 Scene state/output is committed;
- A4011 becomes the legal execution-support entry.

A4010 does not create a Common Core Plan.

### 12.2 A4011

A4011 provides the current approved execution-support boundary.

It may:

- expose approved static FAQ/support content;
- accept permitted Scene-level execution/support artifacts;
- route the user back to approved A4004–A4009 help/tool entries;
- expose truthful AI-support unavailable status if Phase 3 support is unavailable.

It does not create:

- Checkin truth;
- Follow-up Schedule;
- pg-boss job;
- Notification truth;
- Review/Outcome.

### 12.3 A4012

A4012 produces a new Contract version.

Successful replacement requires:

- current ACTIVE version;
- approved update trigger;
- a new DRAFT/PENDING_CONFIRMATION version;
- supersedes_id pointing to the prior version;
- both sides re-confirm the revised terms;
- atomic activation of the new version;
- atomic superseding of the old ACTIVE version;
- preserved history.

### 12.4 Downstream boundary

Slice 14 does not complete A5002.

If A5002/Review is unavailable, the runtime exposes that real boundary rather than inventing Review truth.

---

## 13. Node-by-Node Semantics

### 13.1 A4001 — Contract preparation / education / quiz

Purpose:

- teach the approved principles before formal contract drafting;
- verify understanding through the approved five true/false questions.

Legal entry:

- only through the legal PHONE_USE_CONTRACT stream entry.

Approved five-question semantics:

1. each contract item is formulated together by parent and child — TRUE;
2. if the child does not meet every requirement the contract has failed — FALSE;
3. parents should not negotiate/compromise with the child — FALSE;
4. the contract constrains only the child and not the parent — FALSE;
5. a longer contract duration is always better — FALSE.

The answer key is part of the versioned professional quiz asset and cannot be changed independently of the governing professional content.

Inputs:

- five answers;
- actor/source;
- current package/content version;
- client submission/idempotency identity.

Outputs / records:

- answer attempt;
- wrong-question identifiers;
- explanations for incorrect answers from the approved professional content;
- current completion state;
- content/version refs.

Completion:

- all five questions must be correct in a valid attempt;
- merely opening/reading the material never equals PASS;
- wrong answers retain their record and return explanations;
- the user may retry without destroying prior attempt history.

Allowed transition:

- A4002 only after the all-correct gate.

Future-use boundary:

- wrong-item history may be available to future support/recommendation logic;
- Slice 14 does not create notification/push jobs from that history.

Blocked:

- Safety / Compliance / Consent / Authorization / stale package / stale Case;
- invalid or incomplete five-answer payload;
- unapproved quiz asset.

### 13.2 A4002 — Template and four examples

Purpose:

- present the formal contract structure;
- present all four approved examples as professional examples.

Professional asset contract:

- template is versioned;
- four examples are complete versioned professional assets;
- examples illustrate possible family completion;
- examples are not Family facts;
- example values must never auto-populate a family's Contract truth unless the user explicitly chooses/enters a value and the resulting family input retains the real user source.

Required formal structure from V1-D36:

- contract parties;
- purpose;
- phone-use rules/details;
- execution period;
- parent support measures;
- supervision measures;
- incentives;
- breach responsibilities.

Inputs:

- asset access only;
- optional user selection/navigation;
- no family truth is created by viewing.

Outputs:

- access/audit record where required;
- template version ref;
- professional example version refs.

Completion:

- the approved template/examples are successfully presented/reviewed according to current interaction contract;
- do not reduce the four examples to one or two generic summaries.

Transition:

- A4003.

### 13.3 A4003 — Communication roleplay / SIMULATION

Purpose:

- communication training before the user discusses contract creation with the child.

Actor:

- adult/guardian only;
- minor actor is denied server-side.

Simulation roles:

- adult user plays the child;
- AI simulates the parent;
- AI is not a parent identity;
- session is SIMULATION.

Inputs:

- adult user's simulated child utterance/challenge;
- current approved communication principles/content refs;
- roleplay session/round context;
- no real child statement is inferred.

Outputs:

- roleplay turns;
- user ratings;
- user-selected preferred result;
- AI summary/principles/dialogue reference where the real AI runtime exists;
- professional/prompt/compliance/model refs when applicable.

Hard provenance boundary:

- simulation output is never a child Statement;
- never a child Fact;
- never child Evidence;
- never child Consent;
- never child contract confirmation;
- no persistent child persona;
- no role persona long-term memory.

Phase 2 / Phase 3 boundary:

- Slice 14 freezes and later implements the deterministic roleplay domain/API/persistence/adapter contract;
- it does not implement the real model, RAG, prompt platform or agent runtime;
- if no approved AI runtime is available, production returns truthful DOWNSTREAM_UNAVAILABLE and must not mark A4003 completed;
- deterministic acceptance fixtures may provide a controlled fake adapter to exercise the full node contract.

Completion:

- roleplay supports repeated rounds;
- the user explicitly rates/selects a preferred result according to the approved interaction contract;
- no fixed arbitrary round count is invented where the Docs do not define one;
- node completion cannot be manufactured by a fake production response.

Transition:

- A4004 after legitimate completion.

### 13.4 A4004 — Tool catalog / re-entry hub

Purpose:

- explain available preparation tools;
- allow user selection based on need;
- remain re-enterable.

Canonical tools remain distinct:

- A4005 duration;
- A4006 supervision;
- A4007 incentives;
- A4008 breach responsibilities;
- A4009 parent self-regulation.

Rules:

- do not create a mandatory A4005→A4006→A4007→A4008→A4009 numeric chain;
- do not collapse the five tools into one opaque JSON workflow;
- do not create five independent business engines;
- tool selection/re-entry is governed by the Manifest.

Outputs:

- bounded tool-selection Scene artifact/revision when needed;
- selected tool refs and provenance.

Completion:

- catalog presentation/selection does not mean every tool has been completed.

Re-entry:

- allowed through Manifest-approved user-initiated entry;
- every re-entry rechecks current gates and revisions.

### 13.5 A4005 — Collaborative phone-use duration

Purpose:

- help the family determine phone-use duration together.

Inputs:

- user-entered proposed/agreed rules;
- approved data references if available;
- real source refs;
- child input only when genuinely sourced.

Rules:

- comparison data is advisory after solution-stage entry;
- it must never become Scene eligibility, Problem/No Problem or Intervention/No Intervention truth;
- parent-provided statements about the child's view remain parent-sourced unless the authoritative Evidence owner has a genuine child source.

Output:

- structured draft component / note;
- source refs;
- revision.

Completion:

- a valid current draft result is saved;
- completion of A4005 does not itself imply child confirmation of the final Contract.

### 13.6 A4006 — Supervision measures

Purpose:

- provide approved age/development-relevant supervision options for discussion;
- support recording execution observations.

Inputs:

- chosen/proposed supervision measures;
- real user/source refs;
- optional Scene-level execution log data.

Rules:

- supervision still requires discussion with the child;
- Slice 14 does not convert the A4006 log into a Phase 4 Checkin;
- no new Checkin table or owner is created.

Outputs:

- structured contract-draft component;
- typed Scene artifact/log where required;
- history/revision.

### 13.7 A4007 — Incentive plan

Purpose:

- present approved principles/examples;
- save the family's actual incentive proposal/result.

Rules:

- professional examples stay professional assets;
- only user-provided/confirmed family content becomes family Contract draft truth;
- no automatic reward selection from an example.

Outputs:

- structured incentive draft component;
- source/version refs;
- revision.

### 13.8 A4008 — Breach responsibility

Purpose:

- present approved principles/examples;
- save the family's actual breach-responsibility proposal/result.

Rules:

- no example punishment is auto-copied into family truth;
- current Safety/Compliance/policy gates remain authoritative;
- AI cannot invent or approve a high-impact term outside approved content.

Outputs:

- structured breach-responsibility draft component;
- provenance and revision.

### 13.9 A4009 — Parent self-regulation

Purpose:

- provide approved methods/tools for parent self-regulation and role-model commitments.

Outputs:

- parent-support/self-regulation draft content where applicable;
- viewable document/checklist as a typed Scene artifact;
- source/content version refs.

Rules:

- this is not Family Memory;
- it does not create a Common Core Task;
- parent commitments remain actor-attributed and versioned.

### 13.10 A4010 — Formal Contract creation and activation

Purpose:

- form the actual phone-use Contract from the approved template and the parties' real inputs.

Required structure:

- parties;
- purpose;
- phone-use rules;
- execution period;
- parent support measures;
- supervision measures;
- incentives;
- breach responsibilities.

The FAQ states not every item must necessarily carry a substantive value for every family. Therefore:

- the schema/section identities must be preserved;
- optional/not-applicable decisions must be represented truthfully;
- Slice 14 must not invent a universal all-fields-nonempty gate;
- it also must not silently delete sections from the formal structure.

A4005–A4009 relationship:

- these are preparation/support components, not an invented mandatory numeric chain;
- A4010 may consume their current outputs;
- A4010 still validates the final Contract itself and its required confirmations;
- completion of any tool node does not equal final Contract confirmation.

Confirmation semantics:

- adult-side confirmation must come from the authorized adult/guardian party;
- child-side confirmation must come from a genuine child source authorized for that exact Contract/Case;
- parent input cannot set child_confirmation=true;
- AI output cannot set child_confirmation=true;
- SIMULATION cannot set child_confirmation=true;
- contract agreement is not privacy Consent;
- identity-binding confirmation is not contract confirmation.

Missing required party confirmation:

- Contract remains DRAFT or PENDING_CONFIRMATION;
- activation is blocked;
- no ACTIVE state;
- no A4011 completion/entry is fabricated.

If the existing Authorization/Participant owner cannot represent the narrow genuine child confirmation action at development start, implementation must STOP for an owner-approved seam. Slice 14 may not invent a second child identity/consent/attestation system.

Versioning:

- initial activation creates the first ACTIVE version;
- no in-place mutation of an already ACTIVE Contract's material terms;
- source_template_version and dependency_refs are mandatory;
- generated/view document points back to the authoritative Contract version rather than becoming a second Contract truth.

Transition:

- legitimate ACTIVE Contract makes A4011 available.

### 13.11 A4011 — Contract execution support / FAQ

Purpose:

- support the family while executing an ACTIVE Contract;
- preserve all approved FAQ topics.

Approved FAQ scope includes:

- paper/printed versus electronic copy;
- whether all fields are required;
- compromise;
- incentives/rewards;
- child refusal to sign;
- breach responsibility;
- regret after signing;
- duration;
- relapse;
- depressive mood boundary;
- punishment/negative consequences;
- reward motivation;
- multiple contracts.

Phase 2 capability:

- approved static FAQ/support content can be retrieved by version;
- support can route the user to approved A4004–A4009 modules/re-entry;
- permitted Scene-level support/log artifacts can be saved;
- current Contract version is always explicit.

Phase 3 boundary:

- AI personalized answer/support is only available through an approved future AI task/runtime;
- without it, do not fabricate an AI answer; expose the static approved content or truthful downstream-unavailable state.

Phase 4 boundary:

- no Checkin truth;
- no Follow-up Schedule;
- no pg-boss;
- no Notification;
- no automatic reminder state;
- no Review/Outcome.

The old product wording that the user should receive reminders is preserved as a future integration requirement, not implemented by a private Slice 14 scheduler.

Re-entry:

- only with a current applicable Contract version and current gates;
- support never silently changes formal Contract terms.

Transition to A4012:

- execution period completed; or
- a new problem requires Contract adjustment.

### 13.12 A4012 — Contract update / supersession

Purpose:

- update the phone-use Contract without destroying history.

Approved triggers:

1. an execution period has completed and the parties are updating;
2. a new issue/problem requires adjustment;
3. where current approved product content permits, both parties agree an adjustment is needed.

Rules:

- do not UPDATE the old ACTIVE Contract into new terms;
- create a new DRAFT from the current version;
- set supersedes_id to the prior version;
- record update reason/trigger and dependency refs;
- re-run current authorization/consent/compliance/safety/package gates;
- both sides re-confirm the revised terms;
- only after confirmation does the new version become ACTIVE;
- old version becomes SUPERSEDED;
- history remains readable according to Authorization/Data Rights.

Scheduled entry:

- Slice 11 records SCHEDULED as an allowed future entry mode;
- Slice 14 does not create its own scheduler;
- until Phase 4 Follow-up Schedule exists, user-initiated/legal routed update remains available and scheduled execution is truthfully unavailable.

Correction boundary:

- draft corrections may advance the draft revision;
- any material change to an ACTIVE Contract requires a new Contract version;
- historical ACTIVE/SUPERSEDED content is never silently overwritten.

---

## 14. Persistence / Artifact Semantics

### 14.1 Required approved persistence categories

Future implementation may use only the persistence shapes already authorized by V1 technical design:

- scene_node_states via Slice 12 owner;
- scene_artifacts via Slice 12 owner;
- digital_use_contract_versions;
- roleplay_sessions;
- roleplay_turns;
- existing Evidence / assertions / observations;
- existing idempotency/audit mechanisms.

### 14.2 No giant blob / no table-per-node

A4004–A4009 must not be implemented as:

- one untyped giant JSON blob containing every business concept; or
- a new table for each A400x node.

The physical design must preserve the logical Contract fields and typed bounded Scene artifacts with validated schemas.

Plan AI 2 may choose the minimum column/typed-JSON representation consistent with:

- explicit field semantics;
- version/revision checks;
- provenance;
- queryability needed by activation;
- historical preservation.

It may not collapse distinct semantics merely for convenience.

### 14.3 Document artifacts

Generated/viewable A4010 Contract document is a projection of one Contract version.

It stores/refers to:

- contract version id;
- rendering/schema version;
- content/provenance refs.

It never becomes an independent mutable Contract truth.

### 14.4 A4006 / A4009 artifacts

Use the bounded Scene Artifact owner for:

- supervision execution log;
- parent self-regulation checklist/document;
- other explicitly approved viewable Scene artifacts.

Do not create Common Core Checkin/Task truth.

---

## 15. Versioning

The following versions/revisions are distinct and must not be conflated:

- scene_package_version;
- Manifest/package version;
- professional quiz/template/example/FAQ version;
- Contract version;
- Contract draft revision;
- Scene node revision;
- roleplay session/turn version refs;
- Consent version;
- Compliance policy version;
- Safety policy/version where applicable;
- idempotency result version;
- Case version.

Contract rule:

- ACTIVE material content is immutable historical truth;
- A4012 makes a new version;
- supersedes chain is permanent and auditable.

Professional asset rule:

- changing quiz/template/examples/FAQ requires a new professional/package version;
- historical Contract versions retain the exact source_template_version they used.

---

## 16. Authorization

Every read/write must consume the existing authorize()/RLS owner.

Required dimensions:

- actor;
- current target Family;
- Case;
- resource;
- action;
- purpose;
- participation;
- current primary status where progression requires it.

Hard rules:

- client family_id/case_id is untrusted input;
- cross-family reads/writes fail;
- wrong-Case artifact/contract refs fail;
- ordinary Case Participant status does not automatically grant Contract mutation;
- adult/guardian authority does not authorize impersonating the child;
- A4003 requires adult/guardian;
- child Contract confirmation, when supported, is limited to the authenticated child Person who is the relevant Contract party and is currently authorized for that exact action;
- no family-wide child visibility is introduced.

If the current Authorization owner lacks an exact narrow action required by this Spec, development must STOP for owner-approved extension rather than create local permission truth.

---

## 17. Consent

Consent remains an independent owner and is not Contract agreement.

Rules:

- phone-use Contract confirmation does not grant data-processing Consent;
- child_confirmation does not create guardian consent;
- guardian consent does not equal Contract confirmation;
- identity-binding confirmation does not equal Contract confirmation;
- Simulation does not equal Consent;
- A4003 and all child-related processing recheck current applicable Consent;
- Consent revoked before commit blocks affected writes;
- Consent revoked after activation triggers the existing dependency invalidation/review boundary and blocks further affected processing without deleting lawful historical Contract truth.

Slice 14 must not add a private consent boolean/table/state.

---

## 18. Compliance

Compliance is independent from Authorization and Safety.

At minimum:

- A4003 feature identity uses the existing authoritative feature-policy owner;
- A4003 AI-parent simulation is adult/guardian-only;
- minor actor is hard-blocked server-side;
- session is SIMULATION;
- no persona memory;
- real AI output later requires AI identity/generated-content labeling and applicable release policy;
- UNDER_14 child personal-information processing requires current valid guardian consent under the existing Compliance owner;
- UNKNOWN age is not silently treated as adult;
- required regulatory/PIPIA/feature obligations fail closed where the existing policy says so.

Slice 14 cannot weaken these gates for flow convenience.

---

## 19. Safety

Safety State / SAFETY_HOLD remains owned by Slice 9.

Every ordinary progression/mutation must:

- run/reuse authoritative ordinary-progression guard;
- re-read current Safety state inside the authoritative transaction before commit;
- fail closed if Safety becomes blocking;
- commit no normal success state when blocked.

Safety race:

- a hold established between initial read and commit wins;
- no A4001 pass, draft save, Contract activation, roleplay completion or A4012 supersession may commit around it.

A4011 ordinary execution support is also suppressed when current Safety policy blocks normal Digital Use support. Approved static Safety/Referral support remains owned elsewhere.

---

## 20. Evidence Provenance

Required provenance distinctions:

- parent statement ≠ child statement;
- parent report of child view ≠ genuine child confirmation;
- professional example ≠ family Evidence;
- template ≠ family fact;
- roleplay simulation ≠ child statement/fact/evidence;
- AI output ≠ child input;
- adult confirmation ≠ child confirmation.

A Contract version must retain:

- source refs for material family inputs where applicable;
- confirmation actors and times;
- template/content version;
- dependency refs.

Conflicting family inputs remain conflict/uncertainty until the authoritative owner resolves them. Slice 14 cannot choose a winner merely to activate a Contract.

---

## 21. Idempotency

Use the existing idempotency owner.

Key command families include at minimum:

- A4001 quiz submit;
- ordinary node response/save;
- tool-selection save;
- Contract draft create/update;
- Contract party confirmation;
- Contract activation;
- A4012 new-version create/confirm;
- roleplay session/turn/rating/select operations when available.

Rules:

- same actor + command + idempotency key + identical payload returns the original authoritative result;
- same key + different payload conflicts;
- duplicate retries create no duplicate Contract version, confirmation, Scene output, audit result or roleplay result;
- an idempotent replay does not bypass current authorization for new unrelated access;
- failed/rolled-back operation never leaves a completed idempotency result.

No Slice 14 private idempotency table/store.

---

## 22. Concurrency

High-impact writes require current expected revision/version.

At minimum protect:

- Contract draft revision;
- current ACTIVE Contract pointer/state;
- party confirmations;
- A4010 activation;
- A4012 supersession;
- Scene node current revision;
- package/Manifest version;
- primary Case/version.

Concurrent rules:

- two incompatible writes against one draft revision cannot both become current;
- stale client cannot overwrite a newer draft;
- two A4010 activations cannot produce two ACTIVE current versions;
- concurrent A4012 operations cannot both supersede the same current version into two current ACTIVE contracts;
- parent and child confirmations must not lose each other under concurrency;
- activation happens once when all required confirmations and gates are current;
- Case primary switch/package drift before commit makes stale progression fail.

No last-write-wins on formal Contract truth.

---

## 23. Atomicity

### 23.1 A4001 pass

One authoritative transaction/command boundary must atomically persist:

- attempt/result;
- wrong-item refs;
- node completion only when all correct;
- audit/event;
- idempotency completion.

Failure leaves no false completed gate.

### 23.2 A4005–A4009 save

One transaction must atomically validate:

- actor/scope;
- current Case/package/node;
- expected revision;
- gates;
- typed component/artifact;
- source refs;
- Scene output/revision;
- audit/idempotency.

### 23.3 A4010 activation

One transaction must:

1. authorize;
2. lock/re-read Case and current Contract aggregate;
3. revalidate primary/phase/package/Manifest;
4. revalidate Safety/Compliance/Consent;
5. validate template/source_template_version;
6. validate actual party confirmations;
7. prevent fabricated child_confirmation;
8. validate dependency refs;
9. activate exactly one new version;
10. supersede any legitimately replaced ACTIVE version when applicable;
11. complete A4010 node/output;
12. make A4011 entry available;
13. write audit/event;
14. settle idempotency.

No Follow-up Schedule or pg-boss job is invented if the Phase 4 owner is absent.

### 23.4 A4012 activation

One transaction must atomically:

- lock current active version;
- prove the new draft supersedes that exact version;
- recheck all gates;
- validate both re-confirmations;
- mark new version ACTIVE;
- mark old version SUPERSEDED;
- update node/output/current pointer semantics;
- audit/event;
- settle idempotency.

Fault injection between old/new version updates must prove rollback leaves the old version current and no partial new ACTIVE truth.

---

## 24. Correction / Supersession

Correction and Contract revision are distinct.

Draft:

- editable through explicit draft revision;
- stale revision conflicts;
- history/audit required where the approved owner requires it.

ACTIVE Contract:

- material term change is never an in-place correction;
- use A4012 and a new version.

Source/Evidence correction:

- existing owner records correction/supersession;
- affected Contract dependencies are re-evaluated through the existing dependency invalidation/review boundary;
- Slice 14 does not rewrite historical Contract content.

Professional asset correction:

- new professional/package version;
- historical Contract keeps original source version;
- current applicability may require revalidation.

---

## 25. Re-entry

Re-entry is allowed only where the Manifest/product explicitly allows it.

A4001:

- retry after wrong answers preserves prior attempt history.

A4004:

- tool catalog is re-enterable.

A4005–A4009:

- user can revisit through approved tool/re-entry semantics;
- saves create new current revisions without deleting history.

A4011:

- user can return for support while a relevant Contract version exists.

A4012:

- user-initiated entry after an approved trigger;
- future scheduled entry only through the real Phase 4 owner.

Every re-entry rechecks:

- authorization;
- primary Case;
- package/Manifest;
- Safety;
- Compliance;
- Consent;
- current Contract/Scene revision.

Re-entry never revives a superseded Contract as current.

---

## 26. Error Semantics

The future runtime must distinguish at least:

- NOT_FOUND_OR_UNAUTHORIZED_SCOPE;
- INVALID_NODE_OR_NONCANONICAL_NODE;
- ILLEGAL_DIRECT_ENTRY;
- INVALID_PAYLOAD;
- QUIZ_NOT_PASSED;
- MISSING_REQUIRED_CONFIRMATION;
- INVALID_CONFIRMATION_SOURCE;
- SAFETY_BLOCKED;
- COMPLIANCE_BLOCKED;
- CONSENT_BLOCKED;
- STALE_REVISION;
- IDEMPOTENCY_MISMATCH;
- PACKAGE_OR_MANIFEST_DRIFT;
- DEPENDENCY_OWNER_UNAVAILABLE;
- DOWNSTREAM_AI_UNAVAILABLE;
- DOWNSTREAM_FOLLOWUP_UNAVAILABLE;
- DOWNSTREAM_REVIEW_UNAVAILABLE;
- ATOMIC_OPERATION_FAILED / infrastructure failure.

Exact HTTP status/code strings are Plan AI 2 implementation detail only if existing API conventions do not already decide them.

Rules:

- failure must expose real state;
- no success envelope with a failed background dependency;
- no partial Contract activation;
- no false child confirmation;
- no false reminder/schedule;
- no false Review.

---

## 27. AI / Simulation Boundary

### 27.1 Phase 2 contract

Slice 14 owns only the bounded business integration seam for A4003 and future A4011 AI support:

- allowed actor;
- session identity;
- SIMULATION label;
- request/response schema;
- current input revision;
- professional/prompt/compliance refs;
- persistence;
- selection/rating;
- stale result handling;
- domain validation before node completion.

### 27.2 Phase 3 owner

Phase 3 owns:

- actual model provider;
- TaskModelRegistry;
- Context Builder;
- RAG;
- prompt execution;
- response release;
- generated-content labels;
- AI tracing/eval.

Slice 14 cannot implement substitutes for these.

### 27.3 Production-unavailable behavior

Before the Phase 3 capability is actually available:

- A4003 endpoint/capability can report downstream unavailable;
- no invented canned response may masquerade as real AI roleplay;
- A4003 is not completed;
- A4004 is not reached by pretending the AI ran.

Deterministic fixture:

- test-only fake adapter is allowed to prove the Phase 2 contract;
- it must be impossible to confuse with a production model/provider.

---

## 28. Downstream Unavailable Semantics

### 28.1 A4003 real AI unavailable

Return truthful downstream AI unavailable; preserve any valid pre-call state; do not complete node.

### 28.2 A4011 personalized AI support unavailable

Serve approved static FAQ where appropriate; otherwise return truthful support-unavailable state. Do not fabricate personalized AI advice.

### 28.3 Follow-up / reminder unavailable

Do not create local scheduler, cron, queue or fake SENT state.

The Contract remains valid; user-initiated return remains available.

### 28.4 A5002 unavailable

Expose Review as downstream unavailable/not yet implemented. Never create a generic Review row or mark A5002 complete.

### 28.5 Sibling FAMILY_ALLIANCE runtime unavailable

PHONE_USE_CONTRACT does not fail merely because Slice 13 runtime is absent. The sibling stream's unavailable state must be truthful and independent.

---

## 29. Functional Requirements

FR-001 — Authority fidelity  
Implementation MUST follow the four current formal Docs and this Frozen Spec; lower artifacts cannot override them.

FR-002 — Manifest-only topology  
All A4001–A4012 node identity, entry, re-entry and allowed-next checks MUST consume Slice 11 Manifest/routing.

FR-003 — Parallel stream fidelity  
A4001 MUST NOT depend on A3000–A3113 completion.

FR-004 — A4001 five-question gate  
Exactly the approved five-question understanding gate MUST exist; all-correct is required; reading alone is not pass.

FR-005 — A4001 wrong-answer history  
Wrong-question ids and approved explanations MUST be retained with provenance/version.

FR-006 — A4002 professional asset boundary  
Template and all four examples MUST remain complete versioned professional assets and MUST NOT become Family truth by viewing.

FR-007 — Contract structure fidelity  
Formal Contract MUST preserve the eight V1-D36 structural categories without inventing an all-fields-nonempty rule.

FR-008 — A4003 adult-only  
A4003 MUST fail closed for minor actors.

FR-009 — A4003 simulation provenance  
Roleplay MUST be SIMULATION and MUST NOT create child Statement/Fact/Evidence/Consent/confirmation/persona memory.

FR-010 — A4003 Phase 3 seam  
Slice 14 MUST define/consume a bounded AI adapter seam and MUST NOT build real AI/RAG/Agent runtime.

FR-011 — A4004 re-entry  
Tool catalog MUST remain re-enterable and MUST NOT create a mandatory numeric chain.

FR-012 — A4005 fidelity  
Duration support MUST preserve collaborative determination and MUST NOT reuse duration references as assessment/routing gates.

FR-013 — A4006 fidelity  
Supervision content/log MUST remain Scene-level and MUST NOT create Phase 4 Checkin truth.

FR-014 — A4007 fidelity  
Incentive principles/examples and family result MUST remain distinct and source-preserving.

FR-015 — A4008 fidelity  
Breach-responsibility principles/examples and family result MUST remain distinct and source-preserving.

FR-016 — A4009 fidelity  
Parent self-regulation methods/tools and document/checklist artifact MUST be preserved without creating Task/Memory truth.

FR-017 — No giant blob/table-per-node  
Physical persistence MUST preserve typed logical components without either an opaque all-purpose JSON truth or one table per A400x node.

FR-018 — Genuine party confirmation  
A4010 MUST require the actual parties' confirmation required by the product contract; no parent/AI/simulation may fabricate child_confirmation.

FR-019 — Versioned Contract truth  
A formal Contract MUST use digital_use_contract_versions with source_template_version and dependency_refs.

FR-020 — Single current active version  
A Case MUST NOT have two current ACTIVE phone-use Contract versions.

FR-021 — A4010 atomic activation  
A4010 Contract activation, node output and audit/idempotency result MUST be atomic.

FR-022 — A4011 FAQ completeness  
The full approved FAQ topic set MUST remain accessible as versioned support content.

FR-023 — A4011 Phase 4 boundary  
A4011 MUST NOT create Plan/Task/Checkin/Follow-up/pg-boss/Notification/Review/Outcome truth.

FR-024 — A4011 AI boundary  
Personalized AI support MUST remain unavailable unless the approved Phase 3 runtime exists.

FR-025 — A4012 new version  
A4012 MUST create a new Contract version and MUST NOT mutate old ACTIVE terms in place.

FR-026 — Supersedes/history  
A4012 MUST preserve supersedes_id, prior versions, update reason and auditability.

FR-027 — Re-confirmation  
A4012 revised terms MUST be re-confirmed by the required real parties before new activation.

FR-028 — Authorization/RLS  
All reads/writes MUST use existing authorization and Family isolation; cross-family/wrong-case operations fail.

FR-029 — Consent separation  
Contract confirmation MUST NOT be used as data-processing Consent.

FR-030 — Compliance separation  
Compliance feature/age/minor obligations MUST remain independent and fail closed.

FR-031 — Safety precedence  
Current SAFETY_HOLD/ordinary-progression guard MUST preempt A400x ordinary progression.

FR-032 — Provenance  
Parent, child, professional asset and simulation sources MUST remain distinguishable.

FR-033 — Idempotency  
Duplicate/retry operations MUST not duplicate Contract/Scene/roleplay/audit business results; mismatched payload conflicts.

FR-034 — Concurrency  
Stale Contract/Scene/Case/package revisions MUST fail rather than overwrite current truth.

FR-035 — Atomic rollback  
Faults in high-impact Contract activation/supersession MUST leave no partial active/superseded pair.

FR-036 — Correction propagation  
Source/Consent/Policy/package invalidation MUST use existing dependency owners and MUST not silently rewrite historical Contract versions.

FR-037 — Downstream truthfulness  
Missing AI/follow-up/review capability MUST be reported as unavailable rather than simulated as success.

FR-038 — No upstream owner duplication  
Slice 14 MUST NOT create second Case/Family/Participant/Identity/Evidence/Formulation/Safety/Compliance/Consent/Manifest/Routing/Idempotency/Audit/Scene-state truth.

FR-039 — No upstream mutation  
Implementation MUST NOT change frozen upstream semantics merely to make Slice 14 convenient.

FR-040 — Deterministic Phase 2 proof  
The complete business/persistence/routing contract MUST be testable with deterministic fixtures without a real model/network decision service.

---

## 30. Acceptance Scenarios

### 30.1 Entry and basic flow

1. Legal entry: authorized primary Digital Use Case at the approved A2010/Problem Formulation solution boundary can enter A4001 without requiring A3000 completion.
2. Illegal direct entry: client calls A4002/A4010 without legal prerequisites; request fails with no write.
3. Parallel sibling: FAMILY_ALLIANCE is absent/in progress; legal A4001 remains available.
4. Contract refusal/non-adoption: user/child does not adopt the Contract path; no child agreement is invented and FAMILY_ALLIANCE remains independently available.

### 30.2 A4001

5. All five correct: one valid attempt answers all correctly; A4001 completes and A4002 becomes available.
6. Wrong answer: at least one wrong answer records wrong ids, returns approved explanations, and does not complete A4001.
7. Read-only: user only views preparation material; node remains not passed.
8. Retry: user later passes; old wrong-attempt history remains and current completion is deterministic.

### 30.3 A4002

9. Template access: current approved template version is returned with all required structural categories.
10. Four examples: all four approved examples are accessible.
11. Example isolation: viewing/selecting an example does not create a family Contract fact or confirmation.
12. Asset drift: template/example version becomes stale before a family write; stale operation cannot silently apply.

### 30.4 A4003

13. Eligible adult: authorized adult/guardian can start the SIMULATION boundary.
14. Minor denied: minor actor cannot enter AI-parent roleplay even if UI exposes the endpoint.
15. No child fact: roleplay turn containing a simulated child statement never appears as child Evidence/Statement/Fact.
16. No child confirmation: selected roleplay result cannot satisfy A4010 child confirmation.
17. No persona memory: roleplay cannot create a persistent child persona/memory.
18. Real AI unavailable: Phase 3 adapter absent; production returns truthful downstream unavailable and A4003 remains incomplete.
19. Deterministic fixture: controlled test adapter can run multiple rounds, rating/selection and node completion without production AI.

### 30.5 A4004–A4009

20. A4004 re-entry: user returns to the tool catalog; history remains and current gates are rechecked.
21. No numeric chain: A4005 completion does not force A4006; tools remain independently reachable through approved semantics.
22. A4005 save/revision: current duration draft saves with source refs; stale revision conflicts.
23. A4005 provenance: parent reports child's view; system does not convert it into genuine child confirmation.
24. A4006 save/log: supervision measure and permitted Scene-level log save without creating Common Core Checkin.
25. A4007 save/revision: incentive result saves separately from professional examples.
26. A4008 save/revision: breach-responsibility result saves separately from professional examples.
27. A4009 artifact: parent self-regulation document/checklist is generated/saved as Scene artifact, not Task/Memory.
28. Partial tool use: some A4005–A4009 tools are unused; system does not fabricate their completion or impose an unauthorized all-tools gate.

### 30.6 A4010 activation

29. Valid activation: current draft, real confirmations, package/gates/dependencies valid; exactly one ACTIVE Contract version results and A4011 becomes available.
30. Missing adult confirmation: activation blocked.
31. Missing child confirmation: activation blocked; draft remains pending.
32. False child confirmation prevention: parent attempts child_confirmation=true; blocked and no ACTIVE version.
33. AI confirmation prevention: AI/simulation output supplied as child confirmation; blocked.
34. Wrong child/wrong Case confirmation: blocked.
35. Optional sections: approved optional/N/A semantics are represented without deleting the formal section identities.
36. Duplicate activation: same idempotency key/payload returns original result with no second ACTIVE version.
37. Concurrent activation: two attempts cannot create two current ACTIVE versions.
38. Stale draft: old expected revision cannot overwrite/activate newer draft.
39. Atomic failure: injected failure during activation leaves no partial ACTIVE/node-complete/audit mismatch.
40. Contract document: view document references the authoritative Contract version and cannot be independently mutated into a second truth.

### 30.7 A4011 support

41. Static FAQ: approved FAQ topics are accessible by current content version.
42. Support re-entry: user returns with current active Contract; current Contract version and gates are re-read.
43. AI support unavailable: personalized AI runtime absent; no fabricated AI answer.
44. Tool routing: support routes to an approved A4004–A4009 module without rewriting Contract terms.
45. No Checkin owner leakage: execution support/log does not create a Common Core Checkin.
46. No reminder fabrication: Phase 4 scheduler/notification absent; no fake schedule/SENT state.
47. Safety during execution: Safety becomes blocking; ordinary A4011 support/progression stops without modifying historical Contract truth.

### 30.8 A4012 supersession

48. Period-complete update: current Contract is copied to a new draft with update reason and supersedes_id.
49. New-problem update: same versioning rule applies.
50. Revised terms pending: before both confirmations, old ACTIVE remains current and new draft/pending is not ACTIVE.
51. Valid supersede: both re-confirm; new version becomes ACTIVE and old becomes SUPERSEDED atomically.
52. Historical preservation: old version remains readable/auditable subject to authorization/data rights.
53. No in-place update: attempt to change material terms on old ACTIVE version is rejected/redirected to A4012 versioning.
54. Concurrent supersede: two revisions from the same current ACTIVE cannot both become current.
55. Stale supersede: current active changed since draft; stale activation fails.
56. Atomic supersede failure: injected failure leaves old version ACTIVE and no partial new ACTIVE state.
57. Scheduled path unavailable: Phase 4 scheduler absent; no private scheduler is created; user-initiated legal update still works.

### 30.9 Control planes / isolation

58. Authorization failure: unauthorized actor cannot read/write Contract stream state.
59. Cross-family: Family A cannot read/write Family B Contract, roleplay or artifacts.
60. Consent revoked before commit: affected operation fails with no success write.
61. Consent revoked after active Contract: affected future processing is blocked/invalidated through existing dependency owner; history remains.
62. Compliance blocked: required obligation is unresolved/BLOCK; operation fails closed.
63. Safety blocked: SAFETY_HOLD prevents ordinary progression.
64. Safety race: hold appears before commit; transaction revalidation fails.
65. Upstream owner unavailable: required Scene/Consent/Auth owner seam missing; implementation/runtime fails closed rather than creating private truth.

### 30.10 Idempotency / concurrency / drift / correction

66. Idempotent replay: same key/same payload returns original result with no duplicate.
67. Idempotency mismatch: same key/different payload conflicts.
68. Concurrent draft update: incompatible writes cannot both become current.
69. Primary switch race: Case ceases to be current primary before progression commit; stale progression fails.
70. Package/Manifest drift: package/version changes before commit; stale evaluation does not apply.
71. Professional asset drift: source template/content version is retired/changed; operation follows current owner policy and cannot silently bind the wrong version.
72. Evidence correction: referenced source is corrected; existing dependency propagation is invoked and historical Contract is not overwritten.
73. Child-source correction/conflict: child confirmation/source becomes invalid or conflicting; system does not silently retain a falsely authoritative confirmation.
74. Downstream A5002 unavailable: no Review truth or false completion is created.

### 30.11 Negative-space proof

75. Changed-file review proves no second Manifest/routing registry.
76. Changed-file review proves no generic contract/workflow/forms/rules engine.
77. Changed-file review proves no Goal/Plan/Task/Checkin/Review/Outcome owner.
78. Changed-file review proves no Follow-up/pg-boss/Notification runtime.
79. Changed-file review proves no real AI/RAG/Agent platform.
80. Changed-file review proves no upstream Docs/Slice 1–13 semantic mutation.

---

## 31. Negative-Space Requirements

The implementation is incorrect if it does any of the following:

- introduces a second Digital Use node definition source;
- hardcodes a private next-node chain outside Manifest/routing;
- makes Slice 13 FAMILY_ALLIANCE completion prerequisite to A4001;
- turns professional examples into family facts;
- auto-copies example durations/punishments/rewards;
- treats opening A4001 content as quiz pass;
- lets partial/wrong quiz pass;
- treats parent report as genuine child confirmation;
- lets parent toggle child_confirmation;
- lets AI or simulation confirm the child's agreement;
- treats Contract agreement as privacy Consent;
- creates child persona memory from roleplay;
- exposes A4003 to a minor actor;
- ships a canned production response masquerading as real A4003 AI;
- creates a generic AI/agent/RAG runtime;
- creates a generic Contract engine;
- stores A4004–A4009 as an untyped opaque catch-all blob;
- creates one business table/service per node;
- creates Phase 4 Goal/Plan/Task/Checkin/Review truth;
- creates a private scheduler/cron/pg-boss/Notification path;
- marks reminders SENT when no provider capability exists;
- performs material UPDATE on an ACTIVE Contract version;
- discards superseded Contract history;
- creates two ACTIVE current Contract versions;
- invents A5002 Review;
- bypasses Safety/Compliance/Consent because Authorization passed;
- uses UI hiding as authorization;
- creates a second idempotency/audit/evidence/consent/safety/compliance truth;
- changes Docs or Slice 1–13 semantics from Slice 14 implementation.

---

## 32. Development Implement Gate

Planning status:

READY FOR PLAN AI 2.

Runtime implementation status:

BLOCKED.

Before Slice 14 development starts, a fresh development-start gate MUST verify:

1. current origin/main is re-read;
2. all four formal Docs are re-read or blob-compared and no semantic drift exists;
3. this Frozen Spec blob is unchanged;
4. no competing 014 artifact/branch has become authoritative;
5. Slice 8 runtime remains merged and its required Problem Formulation/solution-stage seams are authoritative;
6. Slice 9 Safety runtime remains merged/authoritative;
7. Slice 10 Compliance runtime remains merged/authoritative;
8. Slice 11 Manifest/routing runtime remains merged and is still the only node/routing truth;
9. Slice 12 has passed independent Audit 2 and merged to main;
10. Slice 12 actual runtime provides the required Scene State / Scene Artifact / legal A2010 integration seams;
11. migration order is re-read after Slice 12 merge;
12. shared RLS/transaction/idempotency/audit owner seams are re-read;
13. the authoritative Consent/Authorization owners can support the required phone-contract actions without a parallel owner;
14. genuine child Contract confirmation can be represented through existing Identity/Participant/Authorization provenance without inventing a second identity/consent system; otherwise STOP for owner-approved seam;
15. current main still has no authority drift against V1-D15–D26 / D35–D42 and §38;
16. Slice 13 runtime is NOT mechanically required unless a real shared implementation seam introduced after this freeze proves otherwise; any such dependency must be reconciled as implementation drift, not invented product sequencing;
17. no Phase 3/4 implementation is silently required to satisfy Phase 2; unavailable downstreams have truthful fail/degrade semantics.

Current exact blocker at this freeze:

- Slice 12 Digital Use Assessment / Scene State runtime is planned and Audit 1 passed, but is NOT implemented, Audit 2 passed, or merged to current main.

Therefore:

Implement Gate = BLOCKED — waiting for Slice 12 runtime Audit 2 PASS + merge and development-start reconciliation.

---

## 33. Open Questions / Clarification Resolution

Open Product Decisions:

0.

### C1 — Is PHONE_USE_CONTRACT really the next Slice?

RESOLVED — YES.

§38 and the canonical Digital Use flow place A4001–A4012 after the already-frozen FAMILY_ALLIANCE work and before A5001/A5002, Phase 3 AI, and Phase 4 execution infrastructure.

### C2 — Is Slice 13 runtime a prerequisite?

RESOLVED — NO.

The streams are explicitly parallel. Slice 13 is a sibling planning boundary, not a business runtime dependency.

### C3 — Is Slice 12 runtime a prerequisite?

RESOLVED — YES.

Slice 14 requires the actual Scene State/Artifact runtime and legal A2010 solution boundary. Those are Slice 12 runtime responsibilities, not private Slice 14 owners.

### C4 — Must Slice 14 implement real AI for A4003?

RESOLVED — NO.

Phase 2 implements the deterministic business/API/persistence/adapter contract. Phase 3 implements real AI. Production cannot fake completion before Phase 3.

### C5 — Can A4003 be skipped because AI is later?

RESOLVED — NO.

The canonical node remains. If real AI is unavailable, the capability is truthfully unavailable; no unauthorized skip edge is invented.

### C6 — Are A4005–A4009 a mandatory numeric chain?

RESOLVED — NO.

Slice 11 DU-011-B explicitly forbids inventing numeric adjacency. They remain distinct re-enterable preparation/support components.

### C7 — Must every A4005–A4009 tool be completed before A4010?

RESOLVED — NO UNIVERSAL ALL-TOOLS GATE.

The Docs preserve all formal Contract sections but the approved FAQ says not every item must be substantively filled for every family. A4010 validates the final Contract and confirmations; it does not infer completion from an invented all-tools checklist.

### C8 — Can the parent confirm for the child?

RESOLVED — NO.

V1-D37 requires both sides to confirm/agree, and the technical design explicitly prohibits parent fabrication of child_confirmation.

### C9 — What if no genuine child confirmation seam exists at implementation time?

RESOLVED — STOP FOR OWNER SEAM.

Keep the Contract DRAFT/PENDING_CONFIRMATION. Do not weaken the requirement and do not invent a Slice 14 identity/consent truth.

### C10 — Can professional examples prefill family Contract truth?

RESOLVED — NO AUTOMATIC FACT CREATION.

They are professional examples. Only explicit family input with real provenance can become family draft/Contract content.

### C11 — Does A4011 create Checkin/Follow-up/Notification now?

RESOLVED — NO.

Those are Phase 4 owners. Slice 14 preserves support/re-entry and future integration refs only.

### C12 — Does A4011 still have value before Phase 3/4?

RESOLVED — YES, BOUNDED.

Approved static FAQ/support, current Contract context, manual re-entry and Scene-level support/log artifacts are valid Phase 2 capability. Personalized AI and automatic reminders remain unavailable until their real owners exist.

### C13 — Is an A4012 edit an UPDATE?

RESOLVED — NO.

Material update always creates a new Contract version with supersedes_id and both-party re-confirmation.

### C14 — Does Slice 14 implement A5002?

RESOLVED — NO.

A5002 is a separate downstream Review node and formally follows the Phase 2 streams.

### C15 — Does this Slice create InterventionInstance / Plan?

RESOLVED — NO.

PHONE_USE_CONTRACT is a canonical Phase 2 Scene stream. Common Core Intervention/Plan runtime remains Phase 4.

### C16 — Is the A4001 answer key open?

RESOLVED — NO.

The current approved professional principles make the five true/false results determinable: TRUE, FALSE, FALSE, FALSE, FALSE. Any future change is a versioned professional-content change, not a runtime guess.

### C17 — Are there unresolved Product Owner decisions for Plan AI 2?

RESOLVED — NO.

Open Product Decisions = 0.

---

## 34. Final Freeze

SLICE 14 — PLAN AI 1 FREEZE

Authority Gate:
PASS

Selection Gate:
PASS

Selected Capability:
Digital Use Phone Use Contract Runtime
PHONE_USE_CONTRACT / A4001–A4012

V1 Phase:
Phase 2

Specify:
FINAL PASS

Clarify:
FINAL PASS

Open Product Decisions:
0

Scope Drift:
0

Docs Modified:
0

Upstream Slice Files Modified:
0

Production Code Modified:
0

Migration Modified:
0

Tests Modified:
0

CI Modified:
0

Plan:
NOT STARTED

Checklist:
NOT STARTED

Tasks:
NOT STARTED

Audit 1:
NOT STARTED

Implementation:
NOT STARTED

Audit 2:
NOT STARTED

Planning Status:
READY FOR PLAN AI 2

Runtime Status:
NOT IMPLEMENTED

Implement Gate:
BLOCKED — Slice 12 Digital Use Assessment / Scene State runtime must pass Audit 2, merge to current main, and the development-start owner/migration/authority reconciliation above must pass.

Plan AI 1 stops here.

No plan.md, checklist.md or tasks.md is authorized by this artifact.
No Audit 1 or implementation is performed by this artifact.
