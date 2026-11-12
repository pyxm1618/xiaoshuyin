# Slice 16 — Psychological / Behavioral Intervention Contract Foundation

> Repository: pyxm1618/xiaoshuyin
>
> Slice: 016
>
> V1 Phase: Phase 3 — Professional Knowledge & AI
>
> Role boundary: Plan AI 1 only
>
> Status: SPECIFY / CLARIFY FINAL PASS — FROZEN
>
> Scope of this artifact: Selection Gate → Specify → Clarify → Frozen Spec only
>
> Forbidden in this artifact: Plan / Checklist / Tasks / Audit 1 / Implement / Audit 2 / production code changes
>
> Authority baseline: origin/main = 7ec51889337d547766412a2ce954cff352e6d57b
>
> Spec branch: spec/016-psychological-behavioral-intervention-contract
>
> Docs mutation: 0
>
> Production code mutation: 0

---

## 1. Authority Baseline

### 1.1 Repository truth

This Spec was selected from the current remote repository truth, not from chat history.

Verified current remote state:

| Item | Current truth |
|---|---|
| Repository | pyxm1618/xiaoshuyin |
| Default branch | main |
| Current origin/main | 7ec51889337d547766412a2ce954cff352e6d57b |
| Latest relevant merged runtime | PR #32, Slice 8 same-transaction seam remediation, included in current main |
| Main specs | specs/001 through specs/011 only |
| Slice 12–15 | separate spec/plan branches; not on main |
| Slice 16 pre-existing branch | none before this Spec branch was created |

Execution context is remote-only through the GitHub repository connector. There is no local checkout in this run. Therefore a local current branch, local HEAD and local working-tree clean/dirty status do not exist in this execution context and are not fabricated.

Remote authority was established from main. This independent Spec branch was then created directly from the exact current main SHA above. No rebase, force push or published-history rewrite is authorized.

### 1.2 Authoritative Docs

The current main blobs read for this selection are:

| Authority | Blob SHA |
|---|---|
| Docs/总产品需求.md | 67724000cb9bb81c40489c04db28d899bd1df74c |
| Docs/V1产品需求.md | 918d8574ad88773fe371985fd5c38080c944fec9 |
| Docs/总体技术架构.md | 9b08371edc976fa281469dfee8dc19962452e3b0 |
| Docs/V1技术设计.md | e7285fd8363c8a76ab4fd96a305037b5c675f961 |

Authority order for this Slice is:

~~~text
总产品需求
↓
V1产品需求
↓
总体技术架构
↓
V1技术设计
↓
Slice 16 Frozen Spec
~~~

For V1 product behavior and professional-service semantics, V1产品需求 has final V1 product authority. V1技术设计 determines implementation contracts and Phase order but cannot change product meaning.

No contradiction requiring a Docs change was found.

Authority Gate: PASS.

---

## 2. Current Repository Reality Check

### 2.1 Merged runtime truth on main

Current main contains the real merged runtime for the already implemented Common Core and first deterministic Scene foundation, including:

- Family / Account / Person foundations;
- Case Core;
- Evidence Core;
- Case Participant Core;
- invited existing-Person identity binding runtime;
- Case Primary Switch;
- Problem Formulation Core;
- Safety Hold Control Foundation;
- Compliance Feature Policy Foundation;
- Digital Use Full Node Manifest / Deterministic Routing Foundation;
- Authorization / RLS / idempotency / audit seams used by those owners.

The Digital Use package currently exposes a code-side package identity:

~~~text
scene = DIGITAL_USE
package version = v1
~~~

and the main branch has the authoritative Digital Use node-manifest and deterministic routing implementation from Slice 11.

### 2.2 What current main does not have

Current main has no authoritative implementation of:

- intervention_definitions;
- professional Intervention Contract persistence;
- professional Intervention review / approval / publication / retirement runtime;
- knowledge_items;
- knowledge_embeddings;
- Professional RAG;
- pgvector-backed professional retrieval;
- sparsevec retrieval runtime;
- Context Builder;
- AI Task Runtime;
- TaskModelRegistry;
- Jev / bounded-decision production or shadow runtime;
- Promptfoo-based production evaluation integration;
- Problem Formulation AI support;
- A4003 roleplay AI support;
- execution-support AI.

No evidence was found that another current main module already owns professional Intervention definition truth.

### 2.3 Slice 12–15 planning truth versus runtime truth

The following are planning artifacts, not merged runtime:

| Slice | Frozen Spec | Plan / Audit 1 | Runtime truth |
|---|---|---|---|
| 12 — Digital Use Assessment Runtime | PASS | Plan complete; Audit 1 FINAL PASS | NOT IMPLEMENTED / NOT MERGED |
| 13 — Digital Use Family Alliance Runtime | PASS | Plan complete; Audit 1 FINAL PASS | NOT IMPLEMENTED / NOT MERGED |
| 14 — Digital Use Phone Use Contract Runtime | PASS | Plan complete; Audit 1 FINAL PASS | NOT IMPLEMENTED / NOT MERGED |
| 15 — Digital Use Review Runtime | PASS | Plan complete; Audit 1 FINAL PASS | NOT STARTED / NOT MERGED |

Current known Frozen identities:

~~~text
Slice 12
commit 5e397fee86eb29da1acc1a5a1d176e0c73aa8849
blob   e0ed342dc144fedf5b516b5295a23cbcc31722bc

Slice 13
commit 07f3692b9f4e79b98a27a0c7f21913e0e6776b34
blob   c3e9bf9aa9296e54c8faec0ec83cc15a2d75289b

Slice 14
commit 3984a04b1b30b2beb96f146f65668bfb95ae05a3
blob   e21d5948b99fb96b6f28452304cc2afc1c61ba32

Slice 15
commit 246465f00156d37c03d33fd638ae9e605ceab3d9
blob   0c6e9dd80fa74734d641ad9ff7b4b66ba3930801
~~~

Some older planning branches are behind current main because implementation dependencies advanced after their planning freeze. Their Frozen product semantics remain planning inputs; their historical repository-state snapshots are not treated as current runtime truth.

---

## 3. Phase Boundary Gate

Docs/V1技术设计.md §38 currently freezes:

~~~text
Phase 1 — Common Core Foundation
Phase 2 — Digital Use Scene deterministic runtime
Phase 3 — Professional Knowledge & AI
Phase 4 — Execution Loop
Phase 5 — Long-term Memory / Operations / Rights
Phase 6 — Real Pilot
~~~

Phase 2 ends with the A5001 / A5002 deterministic Digital Use review boundary. Slice 15 freezes that final explicit Phase 2 block.

Therefore:

- Phase 1 / Phase 2 planning coverage is sufficient to begin Phase 3 planning;
- Phase 2 runtime completion is not yet sufficient to begin Phase 3 implementation;
- planning dependency and implementation dependency are intentionally separated.

Phase 3 Planning Gate: OPEN.

Phase 3 production Implement Gate: NOT YET SATISFIED.

---

## 4. Selection Gate

### 4.1 Candidates considered

Every required Phase 3 candidate was compared against product ownership, dependency direction, independent value and Phase boundaries.

| Candidate | Decision | Selection reasoning |
|---|---|---|
| A. Psychological / Behavioral Intervention Contract + reviewed intervention_definitions | SELECTED | Owns the professional truth that determines what a formal Intervention is and what conditions make it usable. It is explicitly the first Phase 3 capability and is a prerequisite for later formal Intervention selection, RAG-assisted explanation and AI proposal. |
| B. Professional Knowledge persistence / knowledge_items / professional content foundation | DEFER | Important but it does not own formal Intervention eligibility. Knowledge can explain why/how; it cannot substitute for the Intervention Contract or Gate. Building it first would leave the highest-impact professional action undefined. |
| C. PostgreSQL + pgvector professional retrieval foundation | DEFER | Retrieval infrastructure, not professional business truth. It should consume reviewed knowledge assets rather than precede the professional action contract. |
| D. Embedding / sparsevec / lexical retrieval spike | DEFER | Technical retrieval validation. It depends on a retrieval use case and Gold Dataset; it cannot establish which Intervention is professionally allowed. |
| E. RAG A/B/C + Gold Dataset Eval | DEFER | RAG is downstream professional context. Formal Docs explicitly prohibit RAG from creating or bypassing Intervention eligibility. |
| F. Context Builder | DEFER | Context Builder consumes current Domain state, policy, Family Memory and Professional RAG. It is not the owner of professional Intervention truth. |
| G. AI Task Runtime | DEFER | AI Task output is candidate-only and must be validated by Domain/Scene/Safety/Compliance. The professional contract must exist before AI is allowed to propose formal interventions. |
| H. TaskModelRegistry + provider/model execution | DEFER | Replaceable model-routing infrastructure. It has no authority to define professional Intervention semantics. |
| I. Bounded Decision / Jev Shadow | DEFER | Evaluation/shadow capability only; it cannot own hard professional gates and has no reason to precede the deterministic Intervention contract. |
| J. Promptfoo / AI Eval foundation | DEFER | Required later for AI/RAG quality and red team, but it evaluates capabilities rather than owning the professional Intervention truth itself. |
| K. Problem Formulation AI support | DEFER | Problem Formulation runtime is already authoritative on main. AI drafting is optional candidate assistance and depends on later AI Task / Context infrastructure. |
| L. A4003 roleplay AI support | DEFER | Phase 2 may truthfully report the AI capability unavailable. Roleplay AI requires later AI runtime and Compliance enforcement; it does not precede the Intervention contract. |
| M. Execution support AI | DEFER | Downstream AI assistance for an execution loop. It cannot precede the professional asset and future Phase 4 execution truth. |
| N. Higher-priority Phase 3 prerequisite discovered from authority | NONE | No authority-supported Phase 3 capability was found that is more upstream than the formal Intervention Contract. |

### 4.2 Why Candidate A is the correct first Phase 3 capability

The decision is not based only on list order.

The selected capability is first because it owns all four properties required for the first safe Phase 3 Slice:

1. Professional semantic ownership:
   It defines what a formal psychological / behavioral Intervention means, not merely how text about it is stored or retrieved.

2. Downstream prerequisite:
   Formal Plan selection must bind an exact reviewed/published Intervention definition version. RAG, AI Task, model routing and roleplay cannot replace that gate.

3. Independent runtime contract:
   Definition truth, review/publication lifecycle, exact version binding and deterministic eligibility evaluation can exist independently of Phase 4 InterventionInstance / Plan persistence.

4. Non-substitutability:
   If this capability is absent, a later model or RAG layer would be tempted to invent the missing professional decision boundary. The authoritative Docs explicitly prohibit that.

Selection Gate: PASS.

Selected Slice:

> Psychological / Behavioral Intervention Contract Foundation

Phase:

> Phase 3 — Professional Knowledge & AI

---

## 5. Problem / Purpose

The system currently has authoritative Case, Evidence, Problem Formulation, Safety, Compliance and deterministic Digital Use topology, but it does not yet have a first-class professional truth for formal psychological / behavioral interventions.

Without this Slice:

- a future AI could produce a plausible-sounding method with no reviewed contract;
- a RAG result could be mistaken for permission to use an Intervention;
- age/development scope, exclusions, consent needs and adverse signals could be hidden in prose rather than enforceable;
- an Intervention could change silently after historical use;
- a later Plan could reference only a free-text intervention code rather than a specific professional version;
- no deterministic owner would exist for the question: “Is this exact reviewed Intervention definition eligible for consideration under the current known state?”

Purpose:

> Establish one authoritative, versioned, professionally reviewed and package-bound Intervention definition truth, plus the deterministic eligibility contract needed to consume that truth safely, before any AI/RAG system can propose formal interventions.

---

## 6. Goals

Slice 16 SHALL:

1. establish intervention_definitions as the authoritative professional definition truth for formal V1 psychological / behavioral Interventions;
2. preserve the complete minimum Contract content required by V1产品需求 §2.7A;
3. make professional review, publication and retirement explicit and auditable;
4. make substantive semantic changes create a new version rather than mutate history;
5. bind an allowed Intervention definition to an exact Scene / package / version context;
6. require an exact definition id + version for any future formal Intervention consumer;
7. provide a deterministic, side-effect-free eligibility evaluation contract for current Case/Formulation/Evidence/control-plane state;
8. fail closed on UNKNOWN, missing required evidence, exclusions, age mismatch, consent requirements, Compliance blocks and Safety blocks;
9. preserve professional provenance;
10. prevent AI, RAG, client flags or family actors from creating professional authority;
11. keep all Phase 4 InterventionInstance / Goal / Plan / Task / Checkin / Review / Outcome runtime outside this Slice;
12. avoid generic CMS, generic rule engine, generic intervention engine and generic workflow infrastructure.

---

## 7. Scope

### 7.1 In Scope

This Slice owns exactly these capabilities:

1. Psychological / Behavioral Intervention Contract definition semantics.
2. intervention_definitions persistence semantics.
3. Stable intervention_code identity plus immutable explicit versions.
4. Professional source provenance.
5. Professional review state and review attribution.
6. Publication eligibility and published-at semantics.
7. Retirement semantics.
8. Historical immutability.
9. Exact Digital Use Scene / package binding semantics for approved definition versions.
10. The initial reviewed-definition set required for current V1 Digital Use formal interventions, subject to real professional review.
11. Deterministic Intervention eligibility evaluation against authoritative current state.
12. A typed eligibility result that future Phase 4 consumers can use without granting this Slice Phase 4 write authority.
13. Idempotent and concurrent-safe professional-definition lifecycle commands.
14. Auditable definition create/version/review/publish/retire operations.
15. Fail-closed integration semantics with existing Authorization, Consent, Compliance and Safety owners.

### 7.2 Formal V1 intervention families in scope

Where the current V1 Product baseline uses them as formal Interventions that may later enter a formal Plan, reviewed definitions MUST cover the relevant current Digital Use professional methods, including at minimum the families expressly identified by V1产品需求 §2.7A:

- internal motivation;
- emotional regulation;
- sleep / routine;
- time management / procrastination;
- family relationship / interaction;
- parent consistency;
- rewards / incentives;
- supervision;
- parent self-regulation;
- family communication / parent-response methods when used as a formal Intervention.

This list does not mean every Phase 2 node, example, FAQ or support artifact automatically becomes an InterventionDefinition.

A professional asset becomes an InterventionDefinition only if it is intended to be a formal Intervention under §2.7A and can satisfy the full Contract.

### 7.3 Deterministic eligibility evaluator is in scope

Slice 16 SHALL define a deterministic eligibility evaluator because the Contract is explicitly machine-executable in the V1 technical design and Domain Policy owns Intervention applicability.

The evaluator:

- consumes an exact published definition version;
- consumes authoritative current Case / Problem Formulation / Evidence / package / Consent / Compliance / Safety state;
- checks the definition’s formal conditions;
- returns a bounded eligibility result;
- has no authority to create InterventionInstance;
- has no authority to activate Plan;
- has no authority to mutate Case phase;
- does not call a model;
- does not use RAG as a gate.

This is a professional Gate evaluation capability, not a generic rules engine.

---

## 8. Explicit Out of Scope

Slice 16 MUST NOT implement:

- InterventionInstance;
- Goal;
- Plan or PlanVersion;
- Plan activation;
- Task;
- Checkin;
- Common Core Review;
- Outcome;
- Follow-up Schedule;
- pg-boss;
- Notification;
- A5001/A5002 runtime;
- Digital Use Assessment runtime;
- Family Alliance runtime;
- Phone Use Contract runtime;
- AI Task Runtime;
- Context Builder;
- TaskModelRegistry;
- model/provider adapters;
- Vercel AI SDK model execution;
- Jev / bounded Decision runtime;
- Problem Formulation AI drafting;
- A4003 roleplay AI;
- execution-support AI;
- Professional RAG;
- knowledge_items;
- knowledge_embeddings;
- pgvector retrieval;
- sparsevec retrieval;
- pg_jieba retrieval;
- embedding/reranker execution;
- RAG A/B/C evaluation;
- generic professional Knowledge Platform;
- generic CMS;
- generic rules engine;
- generic workflow engine;
- generic Intervention platform;
- generic scenario-package management platform;
- generic expert-review platform;
- a second Authorization system;
- a second Consent system;
- a second Compliance system;
- a second Safety system;
- a second Case/Evidence/Formulation truth;
- V2–V5 professional domains.

No Phase 4 business object may be introduced merely to demonstrate this Slice.

---

## 9. Upstream Traceability

Slice 16 directly projects the following authority:

### 9.1 Product authority

V1产品需求:

- §0.2 — future Scenes add/extend Intervention and Professional Knowledge while reusing Common Core;
- §2.5 — current Problem Formulation is authoritative and must remain correctable;
- §2.7 — formal Plan must explain why selected Interventions apply;
- §2.7A — complete Psychological / Behavioral Intervention Contract;
- §19 — AI can only propose from allowed Interventions and has no final business authority;
- V1-C24 — AI candidate-only boundary;
- V1-C37 — every formal psychological/behavioral Intervention requires a reviewed/versioned Contract and AI/RAG cannot bypass it;
- V1-X01 — production Digital Use professional rules/content must use current approved/published versions;
- V1-X03 / X04 / X06 — future end-to-end runtime must preserve truthful failure and version/concurrency behavior.

总产品需求:

- professional methods are first-class private professional assets;
- professional content must be sourced, reviewed, maintained and versioned;
- AI model is not the product foundation;
- professional knowledge must not be permanently hard-coded in scattered program logic.

### 9.2 Technical authority

总体技术架构:

- Professional Scene Package is first-class and versioned;
- intervention definitions belong to Scene Package;
- rule executor and professional content are separate;
- deterministic rules precede probabilistic decisions;
- RAG explains professional why/how and does not replace professional Gate;
- model/provider infrastructure is replaceable.

V1技术设计:

- §5 domain invariants — Intervention is first-class; model only proposes among published/applicable definitions;
- §7.5 — intervention_definitions schema and lifecycle semantics;
- §12.4 — Intervention selection records reason, evidence, blockers, stream and version;
- §12.7 — RAG does not own PolicyResult/Gate;
- §12.8 — Psychological / Behavioral Intervention Gate;
- §32.9A — required Intervention Contract regression cases;
- §38 Phase 3 — first Phase 3 item is Psychological / Behavioral Intervention Contract + reviewed intervention_definitions;
- §40 Professional — formal Interventions must bind reviewed, published Contract versions;
- §41 — Domain Policy determines professional hard boundaries and Intervention applicability; RAG and AI cannot override.

---

## 10. Ownership / Source of Truth

### 10.1 Slice 16 owns

Slice 16 is the sole owner of:

- professional Intervention definition identity;
- definition semantic content;
- definition version history;
- professional review state;
- publication state;
- retirement state;
- professional source provenance;
- exact definition-version eligibility semantics;
- exact definition-version binding to the current allowed Scene/package professional asset set;
- deterministic Intervention eligibility result.

### 10.2 Slice 16 consumes but does not own

It consumes authoritative facts from:

- Family / Person / Account owners;
- Case owner;
- Evidence owner;
- Problem Formulation owner;
- Scene Manifest / routing owner;
- Authorization owner;
- Consent owner;
- Compliance owner;
- Safety owner;
- business audit owner;
- shared idempotency / transaction infrastructure.

It MUST NOT copy those truths into a private Slice 16 store to avoid calling the real owner.

### 10.3 Future owners

The following remain future owners and are not created here:

- Phase 4 InterventionInstance;
- Phase 4 Goal / Plan / Task / Checkin / Review / Outcome;
- Professional Knowledge / RAG;
- AI Task / Context / Model runtime;
- long-term Memory.

An eligibility result is not an InterventionInstance.

A published definition is not a Plan.

---

## 11. Domain Semantics

### 11.1 InterventionDefinition

An InterventionDefinition is a professional, reusable, versioned definition of one formal psychological / behavioral intervention.

It is not:

- a family-specific recommendation;
- a family fact;
- a generated answer;
- a RAG chunk;
- a Plan;
- an InterventionInstance;
- a Scene node;
- a generic article.

### 11.2 intervention_code

intervention_code is the stable logical identity of the intervention across versions inside its Scene domain.

A code alone is insufficient for formal use.

Every future formal use MUST bind:

~~~text
intervention_definition_id
+
intervention_definition_version
~~~

and the applicable Scene/package version.

### 11.3 Definition versus family-specific evidence

The definition stores requirements and professional rules.

It MUST NOT store a family’s actual supporting evidence as if that evidence were universal professional content.

Therefore:

- supporting_evidence_requirements belongs to the definition;
- supporting_evidence_refs for a particular family belong to eligibility evaluation / future family-specific Intervention use;
- family Evidence remains owned by the Evidence domain.

### 11.4 Definition versus method name

A method label such as CBT, MI, behavioral activation or family intervention does not satisfy the Contract.

Publication requires the actual target, applicability, exclusions, steps, participation requirements, observation, adverse signals, review criteria and stop/reassess conditions.

---

## 12. Data / Persistence Semantics

The authoritative V1 technical design names intervention_definitions as the persistence owner.

Each version SHALL be able to express at least:

~~~text
id
scene_id
intervention_code
version
target_problem_or_mechanism
formulation_dependencies[]
supporting_evidence_requirements[]
applicable_conditions[]
exclusion_or_contraindication_conditions[]
age_and_development_scope
rationale
intervention_steps[]
participation_and_consent_requirements[]
baseline_and_observation
expected_observable_change[]
burden_and_barriers[]
adverse_or_worsening_signals[]
review_window_and_criteria
stop_reassess_safety_referral_conditions[]
allowed_combinations[]
conflicting_interventions[]
professional_source_refs[]
review_status
reviewed_by_role
reviewed_at
published_at?
retired_at?
~~~

### 12.1 Required-field semantics

A definition cannot become eligible for production formal use when a required semantic field is missing merely because the database row exists.

UNKNOWN or “not yet reviewed” professional content MUST remain unavailable rather than being completed by a model.

### 12.2 No family-specific sensitive truth in professional definitions

intervention_definitions MUST NOT contain:

- family_id;
- case narrative;
- raw child/family statements;
- family-specific Observation text;
- family-specific Consent truth;
- model-generated family summary.

Family-specific references are supplied at evaluation time and remain under their existing owners.

---

## 13. Version / Review / Publication Semantics

### 13.1 Semantic lifecycle

Exact storage enum design is downstream implementation detail, but the following product semantics are frozen:

1. Draft / unreviewed content is not eligible for formal use.
2. A definition without real professional approval is not eligible for formal use.
3. A definition that is approved but not currently published/allowed is not eligible for new formal use.
4. A definition that lacks valid publication/package binding is not eligible for new formal use.
5. A retired definition is not eligible for new formal use.
6. A definition is usable for new formal Intervention consideration only when it is:
   - professionally reviewed and approved;
   - published/allowed for the exact current package context;
   - not retired;
   - otherwise valid under the current Domain Gate.

The launch requirement “reviewed and published” is conjunctive in effect. No representation may treat an unreviewed published row or an approved-but-unpublished row as production-eligible.

### 13.2 Professional review

Professional review MUST record real provenance:

- reviewed_by_role;
- reviewed_at;
- review_status;
- source refs and version.

A model, RAG pipeline, family user or unauthenticated system process cannot count as professional approval.

reviewed_by_role records the real professional responsibility role. This Slice does not create a generic RBAC or expert marketplace merely to store that attribution.

### 13.3 Publication

Publication is a deliberate professional-asset state transition.

Publication MUST fail when:

- required fields are incomplete;
- professional review is absent/invalid;
- source provenance is missing where required;
- the target Scene/package does not allow the definition/version;
- a conflicting current binding would be created;
- the requested prior revision is stale.

### 13.4 Retirement

Retirement:

- prevents new formal use of that definition version;
- preserves the historical definition;
- preserves historical review and publication provenance;
- does not rewrite historical family records;
- does not silently reactivate an older or newer version.

If a retirement reason later affects an ACTIVE future Intervention/Plan, the authoritative future dependency propagation owner must cause the affected consumer to be re-evaluated / NEEDS_REVIEW as required by V1技术设计. Slice 16 freezes that downstream obligation but does not create Phase 4 objects.

### 13.5 Historical immutability

Once a definition version has been professionally approved/published, substantive semantic fields MUST NOT be edited in place.

Substantive change includes any change that can alter:

- target mechanism;
- formulation dependency;
- evidence requirement;
- applicability;
- exclusion/contraindication;
- age/development scope;
- rationale that changes professional meaning;
- intervention steps;
- participation/consent requirements;
- baseline/observation;
- expected change;
- burden/barrier handling;
- adverse signals;
- review criteria/window;
- stop/reassess/Safety/Referral conditions;
- combination/conflict rules;
- professional source interpretation.

Such change requires a new definition version and a new review/publication cycle.

Purely administrative metadata correction is allowed only if it cannot alter professional behavior and is fully audited. It MUST NOT be used as a loophole for semantic in-place edits.

---

## 14. Scene / Package Binding Semantics

### 14.1 Exact package context

A formal definition is not globally eligible merely because it is published somewhere.

Eligibility must be scoped to:

~~~text
scene_id
+
scene package version
+
intervention definition id
+
intervention definition version
~~~

### 14.2 Current Digital Use package

Current main exposes DIGITAL_USE package version v1.

Slice 16 may materialize only the professional-definition binding necessary to lock the approved Intervention definition set for that existing current Digital Use package.

It MUST NOT:

- create a generic package-management product;
- change Slice 11 node topology;
- change deterministic routing;
- silently mutate the package’s node semantics.

### 14.3 No floating latest

A published package binding MUST NOT mean “whatever intervention version is latest”.

It must lock exact definition versions.

After an approved package’s professional definition set is frozen, replacing a definition version requires the formally allowed new package/version relationship; historical package bindings remain inspectable.

---

## 15. Deterministic Intervention Eligibility Semantics

### 15.1 Purpose

The evaluator answers only:

> Given this exact reviewed definition version and this authorized current Case context, is the definition currently eligible to be considered by a downstream formal Intervention consumer?

It does not answer:

> Should this family definitely do this intervention?

and does not create the downstream business object.

### 15.2 Required evaluation order

The evaluator MUST preserve this logical order:

~~~text
authorize actor / family / case / purpose
→ read current primary/current Case context as required
→ read current confirmed Problem Formulation and referenced Evidence
→ resolve exact Scene/package version
→ resolve exact Intervention definition version
→ verify professional review + publication + not-retired
→ verify package allows exact version
→ age / development scope
→ formulation dependencies
→ required supporting evidence
→ applicable conditions
→ exclusion / contraindication conditions
→ participation requirements
→ Consent requirements
→ combination / conflict rules
→ current Compliance gate
→ current Safety state
→ produce bounded eligibility result
~~~

This logical order may be optimized internally only if it cannot change privacy, fail-closed behavior or business semantics.

### 15.3 Eligibility result

The bounded result MUST be able to express at least:

~~~text
allowed
intervention_definition_id
intervention_definition_version
scene_id
scene_package_version
evaluated_formulation_version
evidence_refs[]
unmet_formulation_dependencies[]
missing_evidence_requirements[]
exclusion_hits[]
participation_requirements[]
consent_blockers[]
combination_conflicts[]
adverse_signals_to_monitor[]
review_criteria_ref
reason_codes[]
control_revision_refs
~~~

The exact transport shape is Plan AI 2 / implementation design, but these semantics cannot be lost.

### 15.4 UNKNOWN

UNKNOWN is a real state.

If a required condition cannot be determined:

- the model cannot fill it;
- the evaluator cannot infer a favorable value;
- allowed must not become true unless the definition explicitly defines the dependency as safe under UNKNOWN and current policy permits that;
- the result must identify the unresolved dependency.

### 15.5 Exclusion / contraindication

A hit on an applicable exclusion or contraindication MUST block ordinary eligibility.

The result may indicate the approved next professional class of action such as reassessment, Safety or Referral, but Slice 16 MUST NOT create those downstream objects or claim they occurred.

### 15.6 Combination/conflict

Combination rules are evaluated only against explicit candidate/current professional definition references available from authoritative inputs.

Slice 16 MUST NOT invent a universal intervention-composition engine.

A known conflict yields not-allowed for the conflicting combination.

---

## 16. Authorization / Privacy

### 16.1 Professional asset mutation

Family membership or ownership of a Case does not grant authority to:

- create a professional definition;
- professionally approve it;
- publish it;
- retire it.

Professional asset mutation requires the existing authoritative internal/staff authorization boundary and real professional-review responsibility.

If current main lacks a sufficient concrete professional-review principal for a production mutation path, implementation must stop at the appropriate gate rather than invent a second staff/RBAC system.

### 16.2 Case-scoped eligibility

Eligibility evaluation that consumes family/case data MUST use the current authoritative Authorization owner.

It MUST reject:

- wrong Family;
- wrong Case;
- wrong actor;
- unauthorized purpose;
- cross-family Evidence;
- cross-case Evidence that is not explicitly valid for the current Case;
- client-supplied ownership claims.

### 16.3 Anti-enumeration

Unauthorized or cross-family evaluation MUST NOT disclose whether a target family/case/evidence object exists beyond what the current authoritative API/privacy contract permits.

### 16.4 Professional source privacy

Professional source material may have internal access restrictions. Publication and runtime consumption expose only the approved professional content/provenance necessary for the product behavior.

Operational logs MUST NOT copy family-sensitive payloads merely to explain eligibility.

---

## 17. Consent

The definition may declare participation_and_consent_requirements.

Those requirements do not create Consent truth.

The eligibility evaluator MUST consume the authoritative current Consent state and:

- fail closed when required Consent is absent, revoked, expired or otherwise invalid;
- preserve the difference between participation requirement and Consent;
- never infer a child’s consent from parent action;
- never infer Consent from a published professional definition;
- never let AI/RAG create Consent.

A Consent change after an eligibility evaluation makes the old result non-authoritative for a later write. Any future formal consumer must revalidate current Consent before commit.

---

## 18. Compliance

Slice 16 does not create a new Compliance policy.

Eligibility and professional-asset use MUST respect the current authoritative Compliance owner.

Required behavior:

- unresolved required Compliance condition fails closed;
- a client flag cannot override a Compliance block;
- professional approval cannot override Compliance;
- RAG/model output cannot override Compliance;
- age/development scope in an Intervention definition does not replace the product’s age/minor Compliance profile;
- A4003-specific Compliance remains owned by its existing/future feature policy, not this Slice.

---

## 19. Safety

Safety has higher priority than ordinary Intervention consideration.

The evaluator MUST:

- consume current authoritative Safety state;
- block ordinary Intervention eligibility under SAFETY_HOLD or another authoritative blocking state;
- not “solve” a Safety block by selecting a different ordinary intervention;
- not release Safety;
- not create Referral;
- preserve the definition’s stop/reassess/Safety/Referral conditions for future consumers.

Professional publication cannot waive current Case Safety.

---

## 20. AI Boundary

AI output is candidate-only.

AI MAY later:

- propose an Intervention from the currently allowed definition set;
- explain a published Intervention;
- help make approved steps concrete;
- discuss barriers;
- propose review candidates.

AI MUST NOT:

- create an InterventionDefinition as production truth without the professional review process;
- approve or publish a definition;
- retire a definition;
- mutate professional rules;
- make missing Evidence true;
- convert UNKNOWN to favorable;
- override exclusions;
- override age/development scope;
- override Consent;
- override Compliance;
- override Safety;
- override the deterministic eligibility result;
- create a formal InterventionInstance in this Slice;
- activate Plan.

RAG MUST NOT:

- create a formal Intervention from retrieved prose;
- convert a draft/unreviewed/retired definition into an allowed Intervention;
- bypass Domain Policy;
- substitute retrieved text for the Contract.

Slice 16 requires no model call to pass its deterministic acceptance path.

---

## 21. Idempotency

Mutating professional-asset commands are critical business/professional commands and MUST be idempotent.

At minimum this applies to the operations that materially create or transition definition truth, including:

- create initial definition/version;
- create new semantic version;
- record review decision;
- publish;
- retire.

Rules:

- same idempotency key + same semantic payload returns the same business result and creates no duplicate version/event;
- same idempotency key + different semantic payload conflicts;
- a failed/rolled-back transaction never leaves a completed idempotency success;
- read-only eligibility evaluation does not need a fake write-side idempotency record merely to appear “uniform”.

---

## 22. Concurrency

Concurrent professional lifecycle operations MUST preserve one coherent history.

Required semantics:

1. stale expected revision/version cannot silently overwrite a newer state;
2. concurrent publish attempts for conflicting bindings cannot both win;
3. publish racing with retirement cannot produce a version simultaneously usable and retired;
4. a substantive-edit command racing with publication cannot mutate the published semantic version in place;
5. package binding uses exact expected current package/asset revision;
6. eligibility evaluated against stale definition/package/Formulation/control revisions cannot be treated as current authority by a downstream write.

The exact lock/CAS implementation belongs to Plan AI 2, but lost-update behavior is forbidden.

---

## 23. Atomicity

Each professional truth mutation MUST be atomic across all business effects owned by that command.

Examples:

- definition-version row + lifecycle state + professional provenance + audit;
- review decision + review attribution + audit;
- publication state + exact package binding + audit;
- retirement state + audit.

Injected failure at any step MUST roll back the full business result.

Forbidden partial states include:

- published without valid review provenance;
- package binding pointing at a definition that did not publish;
- retired_at written while the runtime still marks that same version newly eligible;
- audit claiming success when the business state rolled back;
- idempotency success committed when the business state failed.

---

## 24. Failure Semantics

The runtime MUST distinguish business denial, stale/conflict and infrastructure failure without turning any of them into success.

Required classes include:

- unauthorized / anti-enumerated not-found;
- wrong Family;
- wrong Case;
- wrong actor;
- invalid definition payload;
- incomplete Contract;
- unknown intervention code/version;
- unreviewed definition;
- approved but unpublished/unbound definition;
- retired definition;
- stale definition revision;
- stale package version/binding;
- missing Formulation dependency;
- missing Evidence;
- UNKNOWN required condition;
- age/development mismatch;
- exclusion / contraindication;
- participation/Consent block;
- Compliance block/unresolved;
- Safety block;
- combination conflict;
- invalid lifecycle transition;
- same idempotency key / different payload;
- concurrent update conflict;
- authoritative dependency unavailable;
- database/infrastructure failure.

An infrastructure failure MUST NOT be converted into “not eligible for professional reasons” if that would hide system unavailability.

---

## 25. Correction / Version Evolution

### 25.1 Before publication

A draft may be revised while preserving enough review history to prove what was reviewed.

A materially revised draft invalidates any prior approval that applied to different semantic content.

### 25.2 After publication

A substantive correction requires a new definition version.

The old version remains historical.

### 25.3 Professional source correction

If a professional source is corrected, withdrawn or materially reinterpreted:

- affected definitions are identified by provenance;
- the current published version is not silently rewritten;
- review/publication must be reconsidered;
- retirement or a new version is used as appropriate;
- future dependent Phase 4 objects must revalidate according to their own owner contract.

### 25.4 User/family Evidence correction

A family Evidence or Problem Formulation correction does not mutate the professional definition.

It invalidates or changes the family-specific eligibility result and requires reevaluation against the unchanged professional definition.

---

## 26. Observability / Audit

Professional truth changes are auditable business events, not AI telemetry.

Audit MUST record enough to answer:

- who created/versioned/reviewed/published/retired the definition;
- which exact definition id/version was affected;
- which Scene/package binding was affected;
- what prior revision/state was expected;
- what lifecycle transition occurred;
- when it occurred;
- the professional review/source provenance references;
- the idempotency/business command identity where applicable.

Audit MUST NOT become a second professional truth store.

Eligibility evaluation may record bounded audit/trace metadata according to current privacy policy, but MUST NOT copy raw family narratives or sensitive Evidence bodies into generic logs.

AI trace, future RAG trace and business audit remain separate.

---

## 27. Functional Requirements

### Professional definition truth

FR-001 — The system SHALL have exactly one authoritative professional Intervention definition owner for this capability: intervention_definitions.

FR-002 — Every definition version SHALL have a stable id, scene_id, intervention_code and explicit version.

FR-003 — A code without an exact definition id/version SHALL NOT be sufficient for future formal use.

FR-004 — Every publishable definition SHALL carry all required §2.7A professional semantic fields.

FR-005 — supporting_evidence_requirements SHALL be professional requirements, not family-specific evidence copies.

FR-006 — professional_source_refs SHALL be traceable and version-aware enough to support professional review and correction.

FR-007 — a therapy/method label alone SHALL NOT satisfy the definition contract.

### Review / publication / retirement

FR-008 — an unreviewed definition SHALL NOT be eligible for formal use.

FR-009 — a professionally unapproved definition SHALL NOT be eligible for formal use.

FR-010 — an approved-but-unpublished/unbound definition SHALL NOT be eligible for new formal use.

FR-011 — a retired definition SHALL NOT be eligible for new formal use.

FR-012 — professional review SHALL preserve real reviewer-role and reviewed-at provenance.

FR-013 — AI/model/RAG/family actor SHALL NOT count as professional approval.

FR-014 — publication SHALL require complete contract content, valid review and exact allowed package binding.

FR-015 — retirement SHALL preserve historical definition and provenance.

FR-016 — a retired version SHALL NOT be reactivated by mutating the same historical version.

### Versioning / package binding

FR-017 — substantive change after approval/publication SHALL create a new definition version.

FR-018 — published semantic versions SHALL NOT be silently edited in place.

FR-019 — exact package binding SHALL identify exact definition versions; floating latest is forbidden.

FR-020 — the current DIGITAL_USE v1 package professional definition set SHALL NOT change node topology or routing ownership.

FR-021 — package binding history SHALL remain inspectable after later versions.

### Eligibility

FR-022 — the Slice SHALL provide deterministic eligibility semantics for an exact definition version.

FR-023 — eligibility SHALL consume authoritative current Case / Formulation / Evidence / Scene package / Consent / Compliance / Safety state.

FR-024 — eligibility SHALL NOT create InterventionInstance, Goal, Plan, Task, Checkin, Review, Outcome or Follow-up truth.

FR-025 — required UNKNOWN/missing Formulation dependencies SHALL fail closed unless the approved definition explicitly permits UNKNOWN and current policy allows it.

FR-026 — missing required Evidence SHALL prevent allowed=true.

FR-027 — applicable exclusion/contraindication SHALL prevent ordinary eligibility.

FR-028 — age/development mismatch SHALL prevent eligibility.

FR-029 — unmet participation/Consent requirement SHALL prevent eligibility.

FR-030 — known conflicting Intervention combination SHALL prevent the conflicting combination.

FR-031 — Compliance block/unresolved required obligation SHALL prevent eligibility.

FR-032 — Safety Hold/block SHALL prevent ordinary eligibility.

FR-033 — the eligibility result SHALL expose bounded reason/provenance/revision information sufficient for a future consumer to revalidate.

FR-034 — a later downstream write SHALL NOT treat a stale eligibility result as current authority after relevant definition/package/Formulation/Evidence/Consent/Compliance/Safety revision changes.

### Authorization / privacy

FR-035 — professional asset mutation SHALL NOT be authorized merely by Family/Case ownership.

FR-036 — case-scoped evaluation SHALL use authoritative Authorization and deny wrong-family/wrong-case/wrong-actor access.

FR-037 — cross-family or unauthorized Evidence refs SHALL NOT be consumed.

FR-038 — unauthorized evaluation SHALL NOT leak protected target existence beyond current anti-enumeration policy.

### Reliability

FR-039 — definition lifecycle mutations SHALL use existing shared idempotency semantics.

FR-040 — same idempotency key with a different semantic payload SHALL conflict.

FR-041 — lifecycle concurrency SHALL prevent lost updates and contradictory active/retired states.

FR-042 — command business effects, package binding, audit and idempotency success SHALL be atomic as applicable.

FR-043 — rollback SHALL leave no partial professional truth.

### Control-plane / AI boundaries

FR-044 — Consent, Compliance and Safety SHALL remain owned by their existing control planes.

FR-045 — RAG SHALL NOT own Intervention eligibility.

FR-046 — model output SHALL NOT override deterministic eligibility.

FR-047 — no real model/network AI call SHALL be required for the deterministic happy-path acceptance suite.

FR-048 — no second Case/Evidence/Formulation/Consent/Compliance/Safety/Scene routing truth SHALL be created.

### Phase boundary

FR-049 — Slice 16 SHALL create no Phase 4 business truth.

FR-050 — Slice 16 SHALL create no generic CMS, rule engine, workflow engine, Intervention platform, model gateway or vector platform.

FR-051 — current V1 Digital Use formal Interventions SHALL only become production-eligible when their definitions have undergone real professional review and valid publication.

FR-052 — lack of a real reviewer or sufficient professional source content SHALL remain a truthful NOT READY / unpublished state; the system SHALL NOT fabricate approval to make the Slice appear complete.

---

## 28. Acceptance Scenarios

### 28.1 Definition / lifecycle

AS-01 — Complete reviewed definition:
Given a definition with complete required fields and valid source provenance, when a real authorized professional review approves it and publication binds the exact version to the allowed Digital Use package, then it becomes eligible for later consideration subject to family-specific gates.

AS-02 — Missing required field:
A definition missing intervention_steps or another required contract field cannot publish.

AS-03 — Method-name-only content:
A row that says only “use CBT/MI/family intervention” without the required concrete contract cannot publish.

AS-04 — Unreviewed:
A draft with no valid professional review cannot publish or return allowed=true.

AS-05 — Fake AI reviewer:
An AI/model-generated approval cannot satisfy reviewed_by_role/reviewed_at and the definition remains unavailable.

AS-06 — Approved but not published:
The definition remains unavailable for new formal use.

AS-07 — Published without valid approval attempt:
The transition is blocked atomically.

AS-08 — Retired:
A previously published version can be read historically but cannot become newly eligible.

AS-09 — Reactivate retired same version:
Attempting to republish the same retired semantic version is rejected; a new valid version/review path is required.

AS-10 — Substantive edit after publication:
Attempted in-place change to applicability/steps/safety/review conditions is rejected.

AS-11 — New version:
A material correction creates a distinct version and preserves the old published historical record.

AS-12 — Source correction:
A changed/withdrawn professional source identifies affected definition provenance without silently rewriting history.

### 28.2 Package binding

AS-13 — Exact package binding:
DIGITAL_USE/v1 resolves the exact approved definition version set; no floating latest is used.

AS-14 — Wrong package:
A definition published for another Scene/package context is not eligible in current DIGITAL_USE/v1.

AS-15 — Stale package:
An eligibility request evaluated against a stale package version cannot be used as current authority.

AS-16 — Package topology isolation:
Publishing professional Intervention definitions changes no Slice 11 node-manifest node, route, prerequisite or stream truth.

### 28.3 Authorization / family / case

AS-17 — Wrong family:
An actor from Family A attempts eligibility evaluation for Family B; access is denied without protected cross-family detail leakage.

AS-18 — Wrong case:
An actor supplies a Case outside the authorized scope; evaluation is denied.

AS-19 — Wrong actor:
A person without the current authorized Case/purpose rights cannot evaluate family-sensitive eligibility.

AS-20 — Unauthorized professional mutation:
A normal family actor attempts to approve/publish/retire a professional definition; the command is denied.

AS-21 — Cross-family Evidence:
A valid definition plus Evidence from another Family is rejected and cannot influence eligibility.

AS-22 — Cross-case Evidence:
Unapproved cross-Case Evidence references do not become supporting evidence for the current Case.

### 28.4 Formulation / Evidence / UNKNOWN

AS-23 — Correct current formulation:
An exact current confirmed Formulation satisfying required dependencies is accepted as input.

AS-24 — Missing formulation dependency:
The evaluator returns not allowed / unmet dependency; no model fills the missing value.

AS-25 — UNKNOWN:
A required condition is UNKNOWN and the definition does not explicitly permit UNKNOWN; allowed remains false.

AS-26 — Missing evidence:
Required supporting evidence is not present; allowed remains false.

AS-27 — Conflicting evidence:
Conflicting sources remain conflicting; the evaluator does not choose a favorable fact merely to allow the Intervention.

AS-28 — Stale formulation:
The evaluation refers to an obsolete Formulation version; a future consumer must reject/re-evaluate before formal use.

### 28.5 Age / exclusion / combination

AS-29 — Age mismatch:
Definition age/development scope does not fit current authoritative state; eligibility is blocked.

AS-30 — Exclusion hit:
A defined contraindication/exclusion is present; ordinary eligibility is blocked.

AS-31 — Reassessment condition:
The result may identify REASSESS as the approved next class but creates no Assessment action or Case transition itself.

AS-32 — Combination allowed:
Two exact definition versions explicitly allowed together do not fail solely because they are multiple Interventions.

AS-33 — Combination conflict:
Two exact versions with a defined conflict cannot both be returned as an allowed combination.

### 28.6 Consent / Compliance / Safety

AS-34 — Consent satisfied:
A required current authoritative Consent is valid; the Consent gate does not block solely for absence.

AS-35 — Consent missing:
Required Consent is absent; allowed is false.

AS-36 — Consent revoked:
Consent was valid at an earlier evaluation but revoked before later use; the old result is stale and cannot authorize a downstream write.

AS-37 — Compliance blocked:
Current authoritative Compliance status blocks the feature; allowed is false.

AS-38 — Compliance UNKNOWN/unresolved:
A required unresolved Compliance obligation fails closed.

AS-39 — Safety Hold:
Current Safety Hold blocks ordinary Intervention eligibility.

AS-40 — Professional approval cannot bypass Safety:
Even a fully reviewed/published definition remains blocked for ordinary use under authoritative Safety Hold.

### 28.7 Version / concurrency / idempotency

AS-41 — Idempotent retry:
Same lifecycle command key + same payload returns one business result without duplicate definition version or audit success.

AS-42 — Same key different payload:
The command conflicts and does not alter professional truth.

AS-43 — Concurrent publish:
Two conflicting publish attempts cannot both become the package’s active exact binding.

AS-44 — Publish/retire race:
The final state cannot simultaneously authorize new use and be retired.

AS-45 — Stale expected revision:
A stale lifecycle update is rejected rather than overwriting newer professional state.

AS-46 — Atomic rollback:
Injected failure after writing part of review/publication but before package binding/audit completion rolls back the entire command and leaves no completed idempotency success.

### 28.8 AI / RAG authority

AS-47 — Model proposes unpublished intervention:
The candidate is rejected by deterministic professional eligibility.

AS-48 — RAG retrieves retired/unpublished content:
Retrieval does not change professional eligibility and cannot allow formal use.

AS-49 — Correct label, wrong contract:
AI names a legitimate psychological method but proposes steps/conditions that differ from the approved definition; it does not pass the Contract.

AS-50 — Model says missing evidence is true:
The evaluator ignores model assertion as business fact unless it has entered the authoritative Evidence/Formulation owners through their own legal process.

AS-51 — No model:
Full definition lifecycle and deterministic eligibility tests can pass without a model/network call.

### 28.9 Historical preservation / Phase boundary

AS-52 — Historical package:
An older package/definition binding remains readable after a new definition version is introduced.

AS-53 — Retirement history:
Retirement does not mutate historical family references or the old definition content.

AS-54 — No InterventionInstance:
Eligibility success creates no intervention_instances record.

AS-55 — No Plan:
Eligibility success creates/activates no Plan.

AS-56 — No Goal/Task/Checkin/Review/Outcome:
No Phase 4 business object is created by this Slice.

AS-57 — No generic engine:
Repository scope introduced by this Slice contains no generic rules/workflow/CMS/intervention platform used as a second business owner.

AS-58 — No duplicate truth:
Case, Evidence, Formulation, Consent, Compliance, Safety and Scene routing remain under existing owners.

### 28.10 Professional readiness truthfulness

AS-59 — Missing real reviewer:
If no authorized real professional reviewer is available, the definition remains unapproved/unpublished and production readiness is NOT claimed.

AS-60 — Insufficient professional source:
If current V1 material cannot safely fill a required Contract field without invention, that definition remains non-published rather than being completed by AI or developer assumption.

---

## 29. Negative Scope Scenarios

NS-01 — No InterventionInstance table/entity/API is introduced by Slice 16.

NS-02 — No Goal object is introduced.

NS-03 — No Plan/PlanVersion activation is introduced.

NS-04 — No Task or Checkin is introduced.

NS-05 — No Common Core Review or Outcome is introduced.

NS-06 — No Follow-up Schedule, pg-boss job or Notification truth is introduced.

NS-07 — No knowledge_items / knowledge_embeddings schema is introduced as part of this Slice.

NS-08 — No RAG retrieval implementation is introduced.

NS-09 — No pgvector/sparsevec/pg_jieba retrieval platform is introduced.

NS-10 — No Context Builder is introduced.

NS-11 — No AI Task Runtime is introduced.

NS-12 — No TaskModelRegistry/model gateway is introduced.

NS-13 — No Jev production/shadow decision runtime is introduced.

NS-14 — No Promptfoo evaluation platform work is pulled into the Slice merely for completeness.

NS-15 — No A4003 model runtime is introduced.

NS-16 — No execution-support AI is introduced.

NS-17 — No generic CMS is introduced.

NS-18 — No generic professional rules engine is introduced.

NS-19 — No generic workflow/intervention engine is introduced.

NS-20 — No new staff/RBAC platform is introduced.

NS-21 — No duplicate Authorization/Consent/Compliance/Safety truth is introduced.

NS-22 — No second node registry/routing truth is introduced.

NS-23 — No family-specific narrative is stored inside intervention_definitions.

NS-24 — No floating “latest Intervention version” is accepted as a formal package binding.

NS-25 — No Phase 4 leakage is allowed to justify “end-to-end testing”.

---

## 30. Dependencies

### 30.1 Planning dependencies

Planning dependencies are satisfied.

Slice 16 can be frozen now because:

- all four authoritative Docs already define the professional Contract;
- current main has the upstream Common Core owners required to understand the contract boundary;
- Slice 12–15 Frozen Specs define the remaining Phase 2 deterministic boundary;
- no unresolved product decision is required to decide what Slice 16 owns.

Planning Gate: OPEN.

### 30.2 Future implementation dependencies

Production implementation is not authorized by this Frozen Spec.

The Phase boundary semantics are:

1. Slice 12 Digital Use Assessment Runtime must complete independent Audit 2 and merge to current main.
2. Slice 13 Digital Use Family Alliance Runtime must complete independent Audit 2 and merge to current main.
3. Slice 14 Digital Use Phone Use Contract Runtime must complete independent Audit 2 and merge to current main.
4. Slice 15 Digital Use Review Runtime must complete independent Audit 2 and merge to current main.
5. Then-current main must still preserve the authoritative Case / Evidence / Problem Formulation / Authorization / Consent / Compliance / Safety / Manifest owners.
6. Current Docs and this Frozen Spec must show no semantic drift.
7. A real professional-review path/responsibility must exist before any definition can be truthfully claimed APPROVED/PUBLISHED for production.
8. Any implementation must reconcile the then-current migration head and exact package version without creating duplicate owner paths.

This is a semantic gate, not a Plan AI 2 task design. Plan AI 2 may make the development-start verification more precise but MUST NOT weaken the Phase boundary or substitute planned runtime for merged runtime.

Future Implement Gate: BLOCKED / NOT YET SATISFIED.

### 30.3 No Phase 3 infrastructure prerequisite

The selected Slice does not require any of the following before its professional contract can be planned:

- RAG;
- pgvector;
- embedding;
- Context Builder;
- AI Task Runtime;
- model registry;
- model provider;
- Promptfoo;
- Jev.

Those are downstream or parallel Phase 3 consumers/quality capabilities, not the owner of professional Intervention truth.

---

## 31. Clarifications

### C16-01 — Is Slice 16 allowed to enter Phase 3 while Slice 12–15 runtime is not merged?

RESOLVED — YES FOR PLANNING, NO FOR PRODUCTION IMPLEMENTATION.

Planning dependency and implementation dependency are separate. Phase 2 planning is frozen through A5001/A5002; Phase 3 product semantics can therefore be specified without pretending Phase 2 runtime exists.

### C16-02 — Why Intervention Contract before Professional Knowledge / RAG?

RESOLVED.

Professional knowledge can explain why/how. It cannot answer with authority whether a formal Intervention is allowed for a current family. The Contract owns the harder professional truth and is explicitly non-bypassable by RAG.

### C16-03 — Does Slice 16 include a runtime eligibility evaluator?

RESOLVED — YES, narrowly.

It includes deterministic definition eligibility evaluation because V1技术设计 makes the Contract machine-executable and Domain Policy owns Intervention applicability.

It does not create InterventionInstance or Plan.

### C16-04 — Does Slice 16 include professional review/publication/retirement lifecycle?

RESOLVED — YES.

Without lifecycle, “reviewed/published version” would be metadata fiction rather than an enforceable professional asset.

### C16-05 — Does APPROVED alone allow formal use?

RESOLVED — NO.

Current V1 launch semantics require formal Interventions to bind a reviewed and published Contract version. A merely approved but unpublished/unbound definition is not production-eligible.

### C16-06 — Does PUBLISHED without valid professional review allow formal use?

RESOLVED — NO.

Publication cannot bypass professional approval.

### C16-07 — Does Slice 16 build a professional CMS?

RESOLVED — NO.

It builds only the narrow professional truth/lifecycle needed by this contract. No generic content-management product is authorized.

### C16-08 — Does Slice 16 include knowledge_items?

RESOLVED — NO.

Professional Knowledge persistence is a separate Phase 3 capability. InterventionDefinition professional source refs may point to approved sources without becoming a generic knowledge store.

### C16-09 — Does Slice 16 include pgvector/RAG?

RESOLVED — NO.

Retrieval is downstream and cannot own the Intervention Gate.

### C16-10 — Are Phase 2 template/example/FAQ assets automatically InterventionDefinitions?

RESOLVED — NO.

Only formal psychological/behavioral interventions intended for future formal Plan use and satisfying §2.7A become InterventionDefinitions.

### C16-11 — Are Family Alliance / Phone Use Contract themselves generic Intervention engines?

RESOLVED — NO.

They remain Digital Use Scene streams. Slice 16 provides professional definitions needed by formal Interventions within the approved product semantics; it does not rename or replace the streams.

### C16-12 — Who may approve a definition?

RESOLVED at product-semantic level.

A real authorized professional responsibility role must perform the review and be attributable. This Spec does not invent a new expert marketplace or RBAC system. If the current runtime lacks a lawful concrete review principal at implementation time, the implementation gate must stop rather than fabricate one.

### C16-13 — Can an AI draft a definition?

RESOLVED.

AI may later assist drafting as non-authoritative content, but cannot itself approve/publish. This Slice does not require an AI drafting feature.

### C16-14 — What if current V1 source material is insufficient to fill every Contract field?

RESOLVED.

The definition remains incomplete/unpublished until real professional review supplies valid approved content through an authorized process. Developer or AI invention is forbidden. This is a professional-readiness condition, not an open product decision.

### C16-15 — What happens to active future Plans when a definition is retired?

RESOLVED at ownership boundary.

Historical Plan/Intervention records are never rewritten. Future Phase 4 dependency propagation must cause affected active consumers to re-evaluate / NEEDS_REVIEW when required by the retirement reason. Slice 16 owns retirement truth, not the future Plan mutation.

### C16-16 — Does eligibility allowed=true activate anything?

RESOLVED — NO.

It means only that the exact professional definition is currently eligible for consideration under the evaluated authoritative state. Formal selection/activation remains Phase 4.

### C16-17 — Can eligibility use a model when conditions are complex?

RESOLVED — NOT IN THIS SLICE.

The hard Gate is deterministic Domain Policy. Later bounded AI may produce candidate interpretation only after its own approved contract and eval; it cannot own the hard gate.

### C16-18 — Does a definition carry family-specific evidence refs?

RESOLVED — NO.

The definition carries evidence requirements. Family-specific refs are evaluation/future-instance provenance and remain under family data owners.

### C16-19 — Can one intervention_code have multiple historical published versions?

RESOLVED — YES AS HISTORY / PACKAGE-SCOPED VERSIONS.

A package binding must choose exact versions. No floating latest and no silent historical rewrite.

### C16-20 — Does retirement delete the old definition?

RESOLVED — NO.

It remains immutable historical professional evidence and cannot be newly used.

### C16-21 — Are wrong-family/wrong-case checks applicable even though definitions are professional assets?

RESOLVED — YES FOR CASE-SCOPED ELIGIBILITY.

Professional definition lifecycle is not family-scoped, but eligibility consumes family/case evidence and therefore must use authoritative family/case Authorization.

### C16-22 — Is a local working tree status available in this run?

RESOLVED — NO.

The current execution is remote-only. A local branch/worktree status is not fabricated. Remote main and remote Spec branch/commit identities are the Authority Baseline.

Open Product Decisions = 0.

---

## 32. Frozen Spec Gate

This Spec may be declared FROZEN only if all of the following remain true:

- Authority Gate PASS;
- Selection Gate PASS;
- Phase 3 planning boundary valid;
- no formal Docs contradiction;
- Open Product Decisions = 0;
- Scope Drift = 0;
- no Phase 4 object in scope;
- no second source of truth;
- no AI/RAG professional authority;
- no hidden generic platform;
- planning dependency semantics resolved;
- future implementation dependency semantics resolved;
- Docs mutation = 0;
- production code mutation = 0;
- only this spec.md is created by Plan AI 1.

Current result:

~~~text
Authority Gate: PASS
Selection Gate: PASS
Phase: Phase 3
Open Product Decisions: 0
Scope Drift: 0
Docs Mutation: 0
Production Code Mutation: 0
Plan Created: NO
Checklist Created: NO
Tasks Created: NO
Audit 1 Performed: NO
Development Performed: NO
~~~

Frozen Spec Gate: PASS.

---

## 33. Plan AI 1 Stop Boundary

Plan AI 1 stops after committing this Frozen Spec.

This role MUST NOT create or modify:

- plan.md;
- checklist.md;
- tasks.md;
- Audit 1 artifacts;
- production code;
- migrations;
- tests;
- package dependencies;
- CI configuration;
- PR implementation work.

Next role:

> PLAN AI 2

Plan AI 2 may translate this Frozen Spec into Plan / Checklist / Tasks and perform pre-development Audit 1. It may not rewrite the product meaning frozen here unless an authoritative upstream document has changed.

---

## 34. Final Frozen Decision

~~~text
Selected Slice:
Psychological / Behavioral Intervention Contract Foundation

Phase:
Phase 3 — Professional Knowledge & AI

Planning Gate:
OPEN

Future Implement Gate:
BLOCKED / NOT YET SATISFIED

Why:
Professional Intervention truth and its deterministic eligibility gate are the non-substitutable semantic prerequisite for later Professional Knowledge, RAG and AI proposal capabilities. AI infrastructure cannot safely precede the contract it is forbidden to override.

Open Product Decisions:
0

Scope Drift:
0

READY FOR PLAN AI 2:
YES
~~~
