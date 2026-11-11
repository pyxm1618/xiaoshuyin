# Feature Specification: Digital Use Full Node Manifest / Deterministic Routing Foundation

**Feature Directory**: specs/011-digital-use-node-manifest-routing-foundation  
**Created**: 2026-11-11  
**Status**: Specify / Clarify FINAL PASS — FROZEN  
**V1 Phase**: Phase 2 — Digital Use Scene 忠实实现（Docs/V1技术设计.md §38）  
**Stage**: Selection Gate + Specify + Clarify only. No Plan / Checklist / Tasks / Audit 1 / Implement.  
**Authority baseline**: origin/main = 8e393c990be53c888c2e68d881bd8b23f9c37638

> This specification is a downstream implementation projection. It does not redesign Digital Use, Common Core, Safety, Compliance, Assessment, Goal, Plan, Task, AI, RAG, UI, or storage.
>
> Product semantics are controlled by Docs/V1产品需求.md. Implementation architecture and Phase order are controlled by Docs/V1技术设计.md.
>
> If any later implementation cannot satisfy this specification without changing those documents, the implementation must stop and report an upstream conflict.

---

## 1. Selection Record

### 1.1 Phase Completion Audit

Current repository truth establishes two different conclusions:

- **Phase 1 runtime completion: NOT COMPLETE.**
  - Slice 8 Problem Formulation is implemented on draft PR #26 and is awaiting independent code audit / merge.
  - Slice 9 Safety Hold Control Foundation is frozen and planned; Audit 1 is PASS, but runtime is not merged.
  - Slice 10 Compliance Feature Policy Foundation is frozen and planned; Audit 1 is PASS, but its implement gate is blocked on the authoritative Drizzle/Data Access outcome from Slice 9 or an approved remediation.
- **Phase 1 design maturity for starting Phase 2 specification: SUFFICIENT.**
  - The authoritative Docs already freeze the relevant Common Core, Safety, Compliance, Problem Formulation, Digital Use authority-remediation, Scene Package, Node Manifest and deterministic-routing boundaries.
  - This Slice does not need to invent Phase 1 semantics or consume unfinished Phase 1 runtime.
  - Therefore Phase 2 may begin at the **design/specification layer**, but Phase 2 implementation remains gated by Phase 1 runtime completion.

This distinction is normative:

**Design dependency satisfied ≠ implementation dependency satisfied.**

### 1.2 Candidate Comparison

| Candidate | Decision | Reason |
|---|---|---|
| A — Full Node Manifest / Deterministic Routing Foundation | **SELECTED** | It is the first explicit item in Phase 2 (§38), V1-D43 requires it, and it can be specified without fake runtime or product invention. |
| B — Digital Use Assessment / A1001–A2010 | DEFER | It is ordered after the Scene Package / Manifest / Routing foundation and would otherwise duplicate or hard-code routing semantics outside the single manifest. It also needs the Phase 1 runtime gates to be authoritative before implementation. |
| C — Goal Core | DEFER | Goal is Phase 4 in §38. Pulling it forward would violate the approved implementation sequence. |
| D — Evidence FACT / HYPOTHESIS production path | DEFER / NOT A CURRENT SLICE | Slice 3 intentionally preserved Fact/Hypothesis semantics without inventing an arbitrary producer. No approved current producer contract justifies a standalone production path now. |
| E — WAITING / Resume | DEFER | The state contract exists, but the real blocker/schedule/revalidation producers are not yet present. A standalone runtime now would be a shell disconnected from real follow-up dependencies. |
| F — LOST_CONTACT | DEFER | It requires real agreed feedback nodes plus authorized contact-attempt evidence. Current follow-up/notification evidence producers do not yet exist, so implementing it now would fabricate evidence semantics. |
| G — Drizzle / Data Access Foundation | REJECT AS SLICE 11 | Slice 9 already owns the narrow Drizzle foundation in its approved plan. Slice 10 explicitly depends on that outcome. A new Slice 11 Data Access foundation would create duplicate authority. Only an explicitly approved remediation may be created if Slice 9 proves the narrow path impossible. |
| H — Scene Node persistence / other alternative | DEFER | No better independent capability was found. Persistent scene-node runtime would pull Assessment/database/runtime concerns into the first Phase 2 slice. The approved first capability is the static Scene Package manifest/routing foundation. |

### 1.3 Selection Result

**Selected capability: Digital Use Full Node Manifest / Deterministic Routing Foundation.**

The number 011 is assigned **after** capability selection.

---

## 2. Authority Gate

### 2.1 Remote truth

- Current origin/main: **8e393c990be53c888c2e68d881bd8b23f9c37638**
- Latest merged authority-remediation change: PR #25, Digital Use authority contract remediation.
- Current open PR: PR #26, Slice 8 Problem Formulation Core, draft, head e23cee82fd6953cb02b3ea139e2c2220ed152d90, marked READY FOR INDEPENDENT CODE AUDIT.
- Slice 9 plan head: 937456d77e9e5336ec04e2729606973daee3cb7a.
- Slice 10 plan head: 117c43f4be3ff6b0e41cbafe8aba8d165a8edb31.
- Existing specification lineage 001–010 was re-read, including the non-implementation 005 identity-binding contract and the 006 runtime slice.
- Current main contains no Digital Use node-manifest.ts, routing.ts, scene_node_states runtime, risk_events runtime, or compliance_feature_policies runtime.
- Current main contains drizzle-orm in the API package and db/drizzle.config.ts, but no checked-in db/schema entry and no authoritative completed Drizzle foundation. This remains owned by Slice 9’s approved plan.

### 2.2 Authoritative Docs re-read

Re-read in full:

- Docs/总产品需求.md
- Docs/V1产品需求.md
- Docs/总体技术架构.md
- Docs/V1技术设计.md

Current relevant blobs at Authority Gate:

- 总产品需求.md: 67724000cb9bb81c40489c04db28d899bd1df74c
- V1产品需求.md: 918d8574ad88773fe371985fd5c38080c944fec9
- 总体技术架构.md: 9b08371edc976fa281469dfee8dc19962452e3b0
- V1技术设计.md: e7285fd8363c8a76ab4fd96a305037b5c675f961

### 2.3 Input Drift

**Input Drift: NONE.**

The prompt’s reference main SHA equals current remote main, and the stated Slice 8/9/10 status remains materially accurate. The current Digital Use authority remediation is already part of that baseline and is inherited by this Slice.

---

## 3. Why This Slice Now

Docs/V1技术设计.md §38 orders Phase 2 as:

1. scene package / single node-manifest.ts / lightweight deterministic routing.ts;
2. current canonical snapshot + manifest completeness/routing CI;
3. A1001–A2010;
4. FAMILY_ALLIANCE;
5. PHONE_USE_CONTRACT;
6. A5001/A5002 and the remaining deterministic Digital Use flow.

V1-D43 additionally requires a checked-in Full Node Manifest to remain complete and faithful to the current canonical Digital Use flow.

Therefore the smallest correct next capability is **not Assessment runtime**. It is the deterministic, machine-verifiable flow contract that all later Digital Use runtime must consume.

This Slice prevents three failure classes before Assessment implementation begins:

1. duplicated routing truth across APIs/services;
2. silent omission/renumbering/serialisation of canonical A/010xx nodes;
3. regression back to pre-remediation Digital Use authority semantics.

---

## 4. Problem / Purpose

The V1 Digital Use canonical flow currently exists as authoritative product semantics and detailed technical design, but there is no checked-in Phase 2 machine projection on main.

Without a single manifest/routing foundation, later Assessment, Family Alliance, Contract, Review and UI work can independently hard-code:

- different node sets;
- different source codes;
- different branches;
- different parallel relationships;
- different assumptions about age, device scope or duration;
- hidden default branches;
- unreachable/orphan nodes.

The purpose of this Slice is to freeze the **single code-side deterministic topology contract** before any Digital Use runtime is built.

---

## 5. Goals

This Slice SHALL define the contract for:

1. one and only one code-side Digital Use Node Manifest;
2. the exact canonical V1 node inventory;
3. reversible node identity and source-node-code fidelity;
4. required node metadata;
5. deterministic routing based only on approved structured inputs and manifest rules;
6. explicit branch reason semantics with no hidden default branch;
7. explicit parallel relationships;
8. timeline / scheduled entry / user-initiated entry / help-reentry semantics;
9. graph completeness, reachability, orphan and dead-end validation;
10. a canonical V1-product snapshot used only for test/review comparison;
11. static/CI drift blocking;
12. preservation of the current Digital Use authority remediation.

It SHALL NOT implement Digital Use business runtime.

---

## Upstream Traceability

| Upstream | Source | Projection in this Slice |
|---|---|---|
| V1-D00 | V1产品需求 | Canonical Digital Use flow must be preserved as the current approved product flow. |
| V1-D01 | V1产品需求 | A1001/01002/01003 must preserve broad device scope, purpose-separated duration, functional impact, and auxiliary-only historical duration bands. |
| V1-D02 | V1产品需求 | A2001/A2002 routing uses integrated Evidence; 01005/01006 priority branches remain; duration-only routing is forbidden. |
| V1-D03–D07 | V1产品需求 | A1000/01004/01000/A2003–A2010 node semantics and branches remain represented. |
| V1-D08–D14 | V1产品需求 | FAMILY_ALLIANCE, A3000–A3113 actual nodes, target list, feasibility, progress/help and parallel relationships remain represented. |
| V1-D15–D26 | V1产品需求 | A4001–A4012 actual Contract-stream nodes and re-entry/update semantics remain represented. |
| V1-D27–D29 | V1产品需求 | A5001 and A5002 remain distinct review destinations. |
| V1-D30–D31 | V1产品需求 | Timeline, scheduled/proactive entry, user entry, help/re-entry and artifacts must be representable. |
| V1-D32–D34 | V1产品需求 | Current remediated product semantics override older reference semantics; UI consolidation cannot erase node semantics. |
| V1-D40–D43 | V1产品需求 | Parallel stream behavior, Full Node Manifest, snapshot fidelity and drift blocking are mandatory. |
| V1-C24 | V1产品需求 | AI/model output has no authority to mutate routing/business truth. |
| V1-C25 / V1-C38–C44 | V1产品需求 | Safety, Compliance, minor/guardian and identity boundaries remain independent gates; this Slice cannot bypass them. |
| V1-X09 / V1-X10 | V1产品需求 | Common Core + Digital Use Scene must coexist, and Digital Use remains the first Scene Package proving reuse. |
| §12.1–12.3 | V1技术设计 | Scene Package shape; node-manifest.ts is the single code-side projection; routing.ts consumes the manifest. |
| §12.2A | V1技术设计 | Canonical snapshot path/role, completeness, source-code fidelity, field fidelity, routing integrity, parallel fidelity, reachability and snapshot-diff gate. |
| §12.5 | V1技术设计 | Original flow → technical-object mapping must not lose node meaning. |
| §32.2 | V1技术设计 | Deterministic Digital Use fidelity regression requirements. |
| §38 Phase 2 | V1技术设计 | This capability is the first Phase 2 implementation item. |
| §40 Product/Flow Fidelity | V1技术设计 | Full Manifest + canonical snapshot + reachability/routing integrity are release gates. |

**Blocking rule:** any future manifest field, edge, branch, node, parallel relation, eligibility gate or routing rule that cannot be traced to an approved source is forbidden until an upstream change is approved.

---

## Scope

### 6.1 In Scope

This Slice freezes the following Phase 2 foundation contract:

- Digital Use Scene Package identity and package-version boundary;
- a single node-manifest.ts as the only runtime node-definition source;
- exact V1 node inventory;
- nodeCode and sourceNodeCode;
- node phase/stream metadata required by the approved manifest contract;
- prerequisites references/predicates;
- input schema / user-decision schema references;
- interaction/output/record contract references;
- allowedNext target semantics;
- explicit reason semantics for each branch;
- canRunInParallelWith relationships;
- ROUTED / USER_INITIATED / SCHEDULED entry semantics;
- help/re-entry references;
- policy references;
- deterministic routing contract;
- canonical snapshot contract;
- completeness and source-code fidelity;
- field/routing/parallel fidelity;
- reachability/orphan/dead-end checks;
- illegal target/illegal branch/missing reason detection;
- full regression trigger on manifest/routing semantic change.

### 6.2 Out of Scope

Explicitly out of scope:

- A1001–A2010 production runtime;
- scene_node_states persistence or Assessment database model;
- Assessment questionnaires or user-facing Assessment API implementation;
- Problem Formulation runtime changes;
- Safety implementation or professional Safety rules;
- Compliance feature-policy implementation;
- Goal / Intervention / Plan / Task / Checkin / Review runtime;
- A3000–A3113 production runtime;
- A4001–A4012 production runtime;
- A5001/A5002 production review runtime;
- AI / LLM / bounded decision / RAG / memory;
- UI / mini-program pages / Operations UI;
- notifications / schedules / pg-boss;
- Human Ops / professional review workflow;
- new Scene;
- XState or any second workflow/state-machine source;
- database migrations;
- public API routes;
- modification of Docs or existing Slice contracts.

### 6.3 Non-Goals

This Slice does not:

- simplify the canonical flow;
- make the old flow more elegant by renumbering nodes;
- decide professional validity of existing approved content;
- infer missing product branches;
- create fake terminal nodes to make graph checks pass;
- map UI screens one-to-one to nodes;
- make the manifest a business-state database;
- make the snapshot a production source of truth.

---

## 7. Canonical Node Inventory

### 7.1 Exact inventory

The Full Node Manifest SHALL contain exactly these **75** canonical node identities, no fewer and no extra invented A/010xx nodes:

**Assessment / triage / preparation**
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

**Family Alliance / target stream**
- A3000
- A3001
- A3002
- A3010, A3011, A3012, A3013
- A3020, A3021, A3022
- A3033
- A3040, A3041, A3042, A3043
- A3050, A3051, A3052, A3053
- A3060, A3061, A3062, A3063
- A3070, A3071, A3072, A3073
- A3080, A3081, A3082, A3083
- A3090, A3091, A3092, A3093
- A3100, A3101, A3102, A3103
- A3110, A3111, A3112, A3113

**Phone Use Contract stream**
- A4001
- A4002
- A4003
- A4004
- A4005
- A4006
- A4007
- A4008
- A4009
- A4010
- A4011
- A4012

**Separate review nodes**
- A5001
- A5002

### 7.2 Explicit non-node marker

**A200401 is not a Manifest node.** It is a record marker/record-contract semantic created from A2003 content and later consumed by A2006/A2008. It MUST NOT be converted into a navigable node merely because it resembles a node code.

### 7.3 Non-sequential numbering is authoritative

The implementation MUST NOT generate nodes by numeric range.

In particular:

- A3033 is intentional and MUST remain A3033;
- there is no permission to invent A3023, A3030, A3031, A3032, or any other gap-filling code;
- source formatting such as 01002, 01003, “A 2010”, “A 3070”, “A 4002” must remain reversibly traceable through sourceNodeCode even when nodeCode uses the approved normalized form.

---

## 8. Actors / Authority Boundary

The Manifest and routing foundation are **not authorization authorities**.

They may describe actor constraints or policy references required by later consumers, but they MUST NOT:

- grant Family/Case access;
- infer guardian status;
- create Consent;
- bypass authorize();
- bypass PostgreSQL RLS;
- bypass Safety;
- bypass Compliance;
- mutate Case status/phase;
- confirm Problem Formulation, Goal, Plan, Contract or Review;
- accept model output as an authoritative next-node decision.

Later Scene runtime must apply its independent Authorization / Consent / Safety / Compliance / Common Core gates before a routing result can produce a business transition.

---

## 9. Domain Concepts

### 9.1 Canonical Product Flow

The current V1 product semantics in Docs/V1产品需求.md, including PR #25 authority remediation. It remains the product source of truth.

### 9.2 Node Manifest

The **single code-side machine projection** of canonical Digital Use nodes. There SHALL NOT be a second node-registry.ts, duplicated route table in API code, or another production node-definition file.

### 9.3 Canonical Snapshot

The checked-in review/test fixture described by Docs/V1技术设计.md §12.2A.

Its role is only to prove that the code-side Manifest has not drifted from the approved product projection.

It is:

- not a runtime data source;
- not a product authority;
- not allowed to be edited merely to make an implementation test pass.

### 9.4 Deterministic Routing

A pure, testable decision layer that consumes the Manifest plus already-authorized structured state/evidence and returns an explicit allowed route / blocked route / terminal route with reason semantics.

It does not call an LLM, RAG, network service, database or external rule engine to decide topology.

### 9.5 Explicit Terminal / External Destination

Where the PRD says “return to main page” or route to another problem/scene, the graph may use an explicit terminal/external destination representation.

That representation MUST NOT fabricate a new A/010xx node or claim that a second V1 Scene exists.

---

## 10. Node Metadata Contract

Every Manifest entry MUST structurally carry or explicitly reference all applicable fields required by Docs/V1技术设计.md §12.2:

- nodeCode;
- sourceNodeCode;
- Case phase metadata;
- stream, when applicable;
- prerequisites;
- input schema reference, when applicable;
- user-decision schema reference, when applicable;
- interaction specification reference, when applicable;
- output schema reference, when applicable;
- record contract;
- allowedNext entries;
- a reason semantic for every allowed branch;
- canRunInParallelWith;
- entryMode: ROUTED / USER_INITIATED / SCHEDULED as applicable;
- helpOrReentryRefs;
- policyRefs.

A field may be empty only where the upstream node truly has no such semantics. “Not implemented yet” is not permission to omit a field whose canonical meaning already exists.

Exact TypeScript symbol names beyond the approved field names, enum literal spelling, file-internal helper names and data-structure layout are Plan-level implementation details.

---

## 11. State / Routing / Contract Semantics

### 11.1 Foundational route chain

The canonical route must preserve, at minimum:

- legal Scene entry → A1001;
- A1001 → 01002;
- 01002 → 01003;
- 01002F priority branch → 01005;
- 01003F priority branch → 01006;
- integrated Evidence triage into A2001 / A2002 / continuation of current Digital Use work as defined by current product rules;
- A2001: advice path → A1000; continue current issue → A2003; other-content intent → explicit return/terminal;
- A2002: further assessment → 01004; continue current Digital Use issue → A2003; other-content intent → explicit return/terminal;
- 01004: consent/accept → 01000; decline → explicit return/terminal;
- A2003 → A2004;
- A2004 YES → A2005; NO → A2006;
- A2005 willing → A2007; unwilling → A2008;
- A2006 willing → A2005; unwilling → A2009;
- A2008 agree → A2007; disagree → explicit return/terminal;
- A2009 agree → 01004; disagree → explicit return/terminal;
- A2007 → A2010;
- A2010 → solution-stage entry, preserving A3000 and the two-stream parallel semantics.

No route may be inferred from numeric adjacency alone.

### 11.2 A1001 current authority semantics

A1001 metadata and later routing MUST preserve all of the following:

**Device scope**
- phone;
- tablet;
- computer;
- game console / game device;
- other related digital-device use described by the current product contract.

**No universal minimum-age Scene rejection**
- no global “under 6 cannot enter Digital Use Scene” hard gate;
- no invented under-6 duration-band thresholds.

**Usage purpose separation**
- learning / research / homework;
- necessary contact;
- entertainment / gaming / video / social and other non-learning use.

**Duration semantics**
- duration is recorded per purpose;
- optional total duration is Evidence only;
- historical A/B/C/D duration bands are auxiliary Evidence only for the age bands where the PRD defines them.

**Integrated routing**
A1001 total duration or A/B/C/D band alone MUST NOT decide:

- eligibility;
- Problem / No Problem;
- Intervention / No Intervention;
- A2001 vs A2002 vs A2003;
- solution matching.

Routing must remain capable of consuming current relevant Evidence including functional impact, sleep, real-activity displacement, emotion, family relationship/conflict and other approved evidence.

### 11.3 FAMILY_ALLIANCE stream

The Manifest must preserve:

- A3000 family-alliance principle/self-assessment;
- A3000 result does not block continuation to A3001;
- A3001 communication preparation;
- A3001 can run in parallel with A3002 and target feasibility work;
- A3002 target list remains a management/reselection entry;
- each actual target node and its feasibility/progress/help node(s) remain addressable.

**DERIVED CLARIFICATION DU-011-A:** The product table does not authorize numeric-sequence inference for A3010–A3113. Reachability for target feasibility/progress/help nodes is therefore represented through the A3002 target-management context, explicit user/scheduled entry and help/re-entry metadata, not by inventing unapproved “next number” edges.

### 11.4 PHONE_USE_CONTRACT stream

The Manifest must preserve:

- A4001 five-question preparation gate;
- A4002 template/examples access;
- A4003 adult/guardian-only SIMULATION semantic reference, without implementing Compliance runtime here;
- A4004 tool catalog / re-entry;
- A4005–A4009 as distinct contract-preparation/support components;
- A4010 formal contract formation;
- A4010 → A4011 execution support;
- A4012 update/revision entry triggered by execution-period completion or a new problem;
- refusal to sign the contract does not erase/disable FAMILY_ALLIANCE.

**DERIVED CLARIFICATION DU-011-B:** The source groups A4004–A4009 as separate preparation/support components but does not authorize a new mandatory numeric chain between every adjacent code. The Manifest must keep all canonical nodes reachable and must encode only product-supported ordering/entry semantics; it MUST NOT manufacture adjacency to satisfy a graph test.

### 11.5 Parallel stream fidelity

FAMILY_ALLIANCE and PHONE_USE_CONTRACT are independent parallel Intervention streams.

The graph model MUST have an explicit way to prove:

- both streams are reachable from the approved solution-stage context;
- one stream does not require the other to be completed unless a specific upstream rule says so;
- refusal/absence in the contract stream does not block family-alliance progress;
- A5001 reviews FAMILY_ALLIANCE / target-list effects;
- A5002 reviews PHONE_USE_CONTRACT effects;
- A5001 and A5002 are not collapsed into one generic node.

### 11.6 Timeline / proactive entry / help semantics

Routing fidelity is not limited to synchronous “next node” edges.

The Manifest must represent approved:

- timeline-driven/scheduled entry;
- proactive/user-initiated entry;
- re-entry;
- help/support entry;
- parallel activation.

A graph validator MUST count these approved edge/entry types when determining legitimate reachability. It MUST NOT misclassify an intentionally user-initiated/help node as an orphan merely because it lacks a linear predecessor.

---

## 12. Functional Requirements

- **FR-001 [V1-D43]** There MUST be exactly one production Digital Use node-definition source: node-manifest.ts.
- **FR-002 [V1-D43/§12.2A]** The Manifest MUST contain exactly the 75 canonical node identities listed in §7.1.
- **FR-003 [V1-D43]** No generated numeric range may create missing/extra node codes.
- **FR-004 [V1-D43]** nodeCode normalization MUST be reversible through sourceNodeCode; leading zeros and source identity MUST be preserved.
- **FR-005 [V1-D00/D32/D34]** Manifest semantics MUST project the current canonical product flow, never older reference semantics.
- **FR-006 [V1-D01]** A1001 MUST carry broad device scope, purpose-separated use/duration, functional impact and auxiliary-only duration-band semantics.
- **FR-007 [V1-D01]** The Manifest/routing contract MUST NOT create a universal six-year minimum Scene eligibility gate.
- **FR-008 [V1-D02]** Routing MUST NOT use total duration or A1001A-D alone to determine A2001/A2002/A2003 or intervention status.
- **FR-009 [V1-D02]** 01002F/01003F priority branch semantics MUST remain represented.
- **FR-010 [V1-D03–D07]** A1000/01004/01000/A2003–A2010 nodes and their explicit branch semantics MUST remain represented.
- **FR-011 [V1-D08–D14]** A3000–A3113 actual nodes MUST preserve target list, feasibility, progress/help and parallel semantics without range invention.
- **FR-012 [V1-D15–D26]** A4001–A4012 MUST remain individually addressable and semantically distinct.
- **FR-013 [V1-D40]** Refusal/non-participation in PHONE_USE_CONTRACT MUST NOT block the approved FAMILY_ALLIANCE path.
- **FR-014 [V1-D27–D29]** A5001 and A5002 MUST remain two separate review nodes/scopes.
- **FR-015 [V1-D30/D31]** Scheduled, user-initiated, help/re-entry and parallel relationships MUST be machine-representable.
- **FR-016 [§12.2]** Every allowedNext edge MUST target an existing canonical node or an explicit terminal/external destination.
- **FR-017 [§12.2A]** Every non-terminal branch MUST have explicit reason semantics; hidden default branches are forbidden.
- **FR-018 [§12.2A]** Every canonical node MUST pass reachability classification using all approved entry modes, not only linear next edges.
- **FR-019 [§12.2A]** Orphan nodes, accidental dead ends and illegal targets MUST fail validation.
- **FR-020 [§12.2A]** Parallel relationships required by the PRD MUST fail validation if omitted or serialised.
- **FR-021 [§12.2A]** A canonical snapshot MUST exist as a non-runtime fixture for completeness/fidelity comparison.
- **FR-022 [§12.2A]** Snapshot changes MUST NOT be accepted merely because implementation changed; they require traceable product-semantic change.
- **FR-023 [§12.3]** routing.ts MUST consume the Manifest rather than duplicate node definitions.
- **FR-024 [§12.3]** Routing decisions MUST be deterministic and testable without model/network dependence.
- **FR-025 [V1-C24]** Model/AI output MUST NOT become an authoritative route merely by returning a node code.
- **FR-026 [V1-C25/V1-C38–C44]** Manifest/routing MUST NOT bypass independent Safety, Compliance, Consent, Authorization, identity or RLS gates.
- **FR-027 [§38]** This Slice MUST NOT implement A1001–A5002 business runtime or persistent scene state.
- **FR-028 [§38]** This Slice MUST NOT introduce XState or a second scene state source.
- **FR-029 [V1-D33]** UI/page consolidation MUST NOT remove or merge canonical node semantics.
- **FR-030 [V1-D43/§32.2]** Semantic change to Manifest/routing MUST trigger full Digital Use fidelity regression in later implementation.
- **FR-031 [V1-D43]** Duplicate nodeCode or duplicate canonical source identity MUST be a hard validation failure.
- **FR-032 [§12.2A]** Missing mandatory field/reference for a node with known canonical semantics MUST be a hard validation failure.
- **FR-033 [§12.2A]** Unknown/unsupported route conditions MUST fail closed; routing MUST NOT choose an arbitrary default.
- **FR-034 [V1-D30/D31]** A node with intentional USER_INITIATED/SCHEDULED/help entry MUST be distinguishable from an accidental orphan/dead-end.
- **FR-035 [V1-D32]** A200401 MUST remain a record marker/reference and MUST NOT become a Manifest node.

---

## 13. Failure Semantics

The future implementation MUST treat the following as blocking failures, not warnings:

- duplicate nodeCode;
- duplicate source-node identity after approved normalization;
- canonical node missing from Manifest;
- extra/invented A/010xx node;
- allowedNext points to nonexistent target;
- branch lacks explicit reason semantic;
- hidden default branch;
- required parallel relationship missing;
- canonical node unreachable under all approved entry modes;
- accidental non-terminal dead end;
- snapshot/Manifest semantic mismatch;
- sourceNodeCode cannot round-trip to canonical source identity;
- current authority-remediation field missing;
- universal six-year hard gate reintroduced;
- duration-only routing reintroduced;
- A5001/A5002 collapsed;
- A3033 “corrected” or range-generated away;
- A200401 promoted into a node.

There SHALL be no “best effort” route, fallback route or silent auto-fix.

---

## 14. Concurrency Expectations

This Slice defines static, versioned Scene Package metadata and a pure routing contract.

Therefore:

- routing evaluation MUST NOT depend on mutable process-global state;
- the same manifest/package version + same structured routing input MUST produce the same routing result;
- concurrent readers of one published package version MUST observe the same immutable topology;
- later runtime state/version concurrency remains owned by the consumer slice and Common Core, not by this Slice.

No new database lock, transaction or optimistic-lock design is introduced here.

---

## 15. Idempotency Expectations

This Slice creates no user/domain write command and therefore does **not** create a new idempotency store or command key.

For deterministic routing evaluation:

- repeat evaluation of identical versioned inputs is side-effect free;
- duplicate evaluation MUST NOT create business artifacts;
- later commands that apply a route remain subject to the existing Common Core idempotency contract.

---

## 16. Authorization / RLS / Privacy

This Slice must be data-minimal:

- Manifest and snapshot contain professional/product metadata only;
- no Family, Person, Case, message or child data belongs in them;
- routing tests/fixtures for this foundation use synthetic structured inputs;
- no new RLS policy or DB role is introduced;
- later consumers must call the approved authorization/compliance/safety gates independently.

No node metadata may be interpreted as permission to read family data.

---

## 17. Auditability

A future implementation must make topology change reviewable through:

- Scene Package/version identity;
- source requirement IDs;
- Manifest diff;
- canonical snapshot diff;
- deterministic validation results.

This Slice does not write business_audit_events because it performs no business mutation.

A product-semantic snapshot change without an approved upstream source is a governance failure.

---

## 18. DFX Constraints

### Determinism
- pure topology/routing logic;
- no LLM/RAG/network/database dependency for graph decisions.

### Maintainability
- one node source;
- no duplicated registry;
- no range-generation magic;
- explicit metadata and reason semantics.

### Testability
- graph validators operate directly on Manifest data;
- all 75 nodes are mechanically countable/addressable;
- negative mutations must be detectable.

### Reliability
- fail closed on invalid graph/unknown condition;
- invalid package cannot be treated as publishable.

### Performance
- Manifest/routing is lightweight in-process logic; no external round-trip is justified by this Slice.

### Security / Privacy
- no household data in Manifest/snapshot;
- no authorization bypass;
- no sensitive audit duplication.

### Portability
- no XState/runtime framework requirement;
- no UI dependency.

---

## User Scenarios & Testing

### User Story 1 — Product flow cannot silently drift (P1)

A later Digital Use runtime developer consumes one authoritative machine manifest. If a canonical node, branch, source code or parallel relationship disappears or changes, deterministic validation fails before the change can be accepted.

**Upstream IDs**: V1-D00, V1-D32–D34, V1-D43.

**Independent Test**: mutate one canonical field/edge in a test copy and prove validation rejects it without using a model or network.

### User Story 2 — Current Digital Use authority semantics survive implementation (P1)

A1001/A200x routing cannot regress to phone/tablet-only, universal age-6 eligibility, total-duration-only judgement, or A/B/C/D-driven intervention.

**Upstream IDs**: V1-D01, V1-D02, V1-D32, V1-D43.

**Independent Test**: synthetic routing fixtures prove computer/game-device inputs are representable, under-6 is not globally rejected, and equal total duration with different functional/evidence profiles can produce different allowed routing states.

### User Story 3 — Parallel solution streams remain parallel (P1)

FAMILY_ALLIANCE and PHONE_USE_CONTRACT remain distinct reachable streams; A5001/A5002 remain separate.

**Upstream IDs**: V1-D08, V1-D10, V1-D27–D29, V1-D40.

**Independent Test**: graph validation fails if the contract stream is made a prerequisite for family-alliance progress or if A5001/A5002 are merged.

---

## Acceptance Scenarios

1. **Given** the canonical V1 node inventory, **when** the Manifest is enumerated, **then** exactly 75 canonical nodes exist and no extra A/010xx node exists. **Upstream**: V1-D43.
2. **Given** A3033 and the sparse A302x/A303x source numbering, **when** inventory validation runs, **then** A3033 exists exactly once and no inferred A3023/A3030/A3031/A3032 appears. **Upstream**: V1-D12/D43.
3. **Given** source codes 01002/01003 and source literals with spacing such as A 2010/A 3070/A 4002, **when** normalization is applied, **then** nodeCode is stable and sourceNodeCode remains reversibly traceable without losing leading zeros/source identity. **Upstream**: V1-D43.
4. **Given** A200401, **when** the Manifest is enumerated, **then** it appears only as record-contract semantics and not as a navigable node. **Upstream**: V1-D04.
5. **Given** A1001, **when** field fidelity is validated, **then** phone/tablet/computer/game-device scope, purpose-separated duration, functional impact and auxiliary-only historical duration bands are represented. **Upstream**: V1-D01.
6. **Given** a child under six, **when** Scene eligibility metadata/routing is inspected, **then** no universal age-6 Scene hard gate exists. **Upstream**: V1-D01/D32.
7. **Given** identical total duration but different purpose/function/sleep/emotion/family-conflict evidence, **when** A200x routing inputs are evaluated, **then** the router does not decide solely from total duration or A/B/C/D band. **Upstream**: V1-D02.
8. **Given** 01002F, **when** priority routing is evaluated, **then** 01005 remains represented as the severe-emotion branch. **Upstream**: V1-D02.
9. **Given** 01003F, **when** priority routing is evaluated, **then** 01006 remains represented as the severe-conflict branch. **Upstream**: V1-D02.
10. **Given** A2004 YES and NO, **when** routing is evaluated, **then** YES permits A2005 and NO permits A2006 with explicit reason semantics. **Upstream**: V1-D05.
11. **Given** A2005/A2006/A2008/A2009 decisions, **when** routing is evaluated, **then** each approved branch is preserved and no hidden default chooses a path. **Upstream**: V1-D06.
12. **Given** A3000, **when** family-alliance self-assessment completes with any result, **then** the result itself does not block the approved continuation/re-entry into A3001. **Upstream**: V1-D09.
13. **Given** A3001 and target-list/feasibility work, **when** parallel fidelity is checked, **then** the approved parallel relationship exists. **Upstream**: V1-D10.
14. **Given** A3002 target management, **when** reachability is checked, **then** every actual target family and its feasibility/progress/help nodes can be reached through approved user/scheduled/help semantics without inventing numeric adjacency. **Upstream**: V1-D11–D14.
15. **Given** A4001, **when** contract-stream topology is checked, **then** the five-question gate and transition toward A4002 remain represented. **Upstream**: V1-D15.
16. **Given** A4003, **when** metadata is inspected, **then** it references adult/guardian-only SIMULATION/Compliance semantics but this Slice does not implement the Compliance evaluator. **Upstream**: V1-D17, V1-C40.
17. **Given** A4004–A4009, **when** graph validation runs, **then** all nodes remain reachable under approved entry semantics and validation does not invent unsupported mandatory linear adjacency. **Upstream**: V1-D18–D23.
18. **Given** A4010, **when** routing is checked, **then** the approved execution entry to A4011 remains represented. **Upstream**: V1-D24/D25.
19. **Given** execution-period completion or a new problem, **when** A4012 re-entry semantics are checked, **then** the update trigger remains representable without overwriting old contract-version semantics. **Upstream**: V1-D26.
20. **Given** contract refusal/non-participation, **when** stream reachability is checked, **then** FAMILY_ALLIANCE is still available where the PRD permits it. **Upstream**: V1-D40.
21. **Given** A5001 and A5002, **when** review topology is enumerated, **then** both exist separately and neither is replaced by a generic single review node. **Upstream**: V1-D27–D29.
22. **Given** an allowedNext target that does not exist, **when** graph validation runs, **then** validation fails. **Upstream**: V1-D43.
23. **Given** a duplicate nodeCode, **when** completeness validation runs, **then** validation fails. **Upstream**: V1-D43.
24. **Given** duplicate source-node identity after normalization, **when** source-code fidelity runs, **then** validation fails. **Upstream**: V1-D43.
25. **Given** a required branch with no reason semantic, **when** routing-integrity validation runs, **then** validation fails. **Upstream**: V1-D43.
26. **Given** an invented default route, **when** routing-integrity validation runs, **then** validation fails. **Upstream**: V1-D43.
27. **Given** a canonical node with no legitimate linear, parallel, user-initiated, scheduled or help/re-entry reachability, **when** reachability validation runs, **then** it is reported as an orphan and fails. **Upstream**: V1-D43.
28. **Given** a non-terminal node with no canonical onward/exit/re-entry semantics, **when** dead-end validation runs, **then** it fails rather than fabricating an edge. **Upstream**: V1-D43.
29. **Given** a required parallel relation removed from a test copy, **when** parallel-fidelity validation runs, **then** it fails. **Upstream**: V1-D43.
30. **Given** the canonical snapshot and Manifest differ semantically, **when** snapshot-diff validation runs, **then** the change is blocked until the product-source change is traceable and reviewed. **Upstream**: V1-D43.
31. **Given** a model output proposes an otherwise illegal next node, **when** routing authority is evaluated, **then** the model output cannot create that route. **Upstream**: V1-C24, §12.3.
32. **Given** authorization/safety/compliance denies a later runtime action, **when** a Manifest route would otherwise be topologically allowed, **then** the topology does not override the independent gate. **Upstream**: V1-C20/C25/C39–C44.
33. **Given** two concurrent pure routing evaluations with identical package version and inputs, **when** both complete, **then** they return semantically identical results and create no side effects. **Upstream**: §12.3, V1-C28.
34. **Given** a UI combines several nodes on one page, **when** the backend Manifest is inspected, **then** canonical node identities/branches remain intact. **Upstream**: V1-D33.
35. **Given** no authoritative route condition matches, **when** routing is evaluated, **then** the result is fail-closed/blocked or explicit unknown—not an arbitrary branch. **Upstream**: V1-D43, V1-C03.

---

## 19. Edge, Failure, and Unknown States

- UNKNOWN / NOT_COLLECTED / DECLINED / CONFLICT remains real input state; it cannot be coerced into a route merely to progress.
- “No matching route” is not permission for a default route.
- An external/terminal destination is explicit and distinguishable from a canonical node.
- Missing Policy/Safety/Compliance runtime is not treated as ALLOW by this topology layer.
- A snapshot mismatch is a governance failure, not an auto-update request.
- An intentional USER_INITIATED/SCHEDULED/help node is not an orphan merely because it lacks a linear predecessor.
- A node with no approved onward semantics is not “fixed” by numeric adjacency.

---

## 20. Key Entities

This Slice introduces only conceptual/static Scene Package entities:

- **DigitalUseNodeManifestEntry** — one canonical node projection.
- **DigitalUseNodeManifest** — exact versioned collection of all entries.
- **RoutingCondition / NodePredicate** — deterministic approved route condition.
- **AllowedNextRoute** — target + reason semantics.
- **ExplicitTerminalRoute** — approved non-node terminal/external outcome.
- **ParallelRelation** — approved non-serial relation.
- **EntryMode** — ROUTED / USER_INITIATED / SCHEDULED.
- **Canonical Product Snapshot** — non-runtime test/review projection.

No database entity is created by this Spec.

---

## 21. Success Criteria

- **SC-001**: exact canonical inventory count = 75; missing = 0; extra = 0.
- **SC-002**: duplicate canonical node/source identity = 0.
- **SC-003**: invalid next targets = 0.
- **SC-004**: hidden/default branches = 0.
- **SC-005**: required branch without reason semantics = 0.
- **SC-006**: unexplained canonical orphans = 0.
- **SC-007**: unexplained accidental dead ends = 0.
- **SC-008**: required parallel-relation omissions = 0.
- **SC-009**: canonical snapshot semantic drift = 0 unless backed by approved upstream change.
- **SC-010**: old Digital Use authority semantics regressions = 0.
- **SC-011**: production node-definition sources = exactly 1.
- **SC-012**: model/network/database dependencies in deterministic topology decision = 0.
- **SC-013**: new DB/API/UI/AI/Goal/Plan/Task/Safety/Compliance runtime delivered by this Slice = 0.
- **SC-014**: Docs changed by this Slice = 0.

---

## Acceptance Evidence

| Acceptance item | Verification type | Required future evidence |
|---|---|---|
| Exact 75-node inventory | unit/static | Manifest enumeration vs canonical snapshot |
| sourceNodeCode fidelity | unit/static | round-trip/normalization tests including 010xx and spaced source literals |
| duplicate/missing/extra node failure | negative unit | mutation fixtures rejected |
| illegal target / missing reason / hidden default | negative unit | graph/routing validator failures |
| reachability / orphan / dead-end | pure graph test | deterministic graph report based on all approved entry modes |
| parallel fidelity | pure graph test | A3001/A3002 and two-stream relation checks |
| A1001 authority remediation | deterministic fixture | device/purpose/duration/functional-impact field-fidelity tests |
| duration-only regression | deterministic fixture | same total duration, different evidence, no forced identical conclusion from duration alone |
| age-6 regression | deterministic fixture | under-6 not rejected by universal Scene gate |
| A5001/A5002 separation | unit/static | distinct nodes and review semantics |
| A3033 sparse numbering | unit/static | exact node exists; range-generated substitutes absent |
| A200401 boundary | unit/static | record marker present in contract refs; absent from node inventory |
| snapshot drift | static/CI | reviewed semantic diff gate |
| single source | static guard | no second node registry / duplicated runtime route table |
| no runtime scope leakage | diff/static | no DB migration, API route, scene persistence, AI/UI implementation |
| future full regression | CI | Digital Use fidelity suite on semantic manifest/routing changes |

This Plan AI 1 round does not create or run those implementation tests.

---

## 22. Deferred Dependencies

Deferred, not silently included:

1. **Slice 8 Problem Formulation final merge** — required before Phase 2 runtime can rely on the current Phase 1 formulation contract.
2. **Slice 9 Safety Hold Control runtime** — required for authoritative Safety guard semantics in later Scene execution; also owns the narrow Drizzle/Data Access foundation.
3. **Slice 10 Compliance Feature Policy runtime** — required before later Digital Use runtime can rely on feature-policy decisions such as A4003/minor access and other compliance obligations.
4. **Scene persistence / Scene Service** — later Phase 2 runtime slice.
5. **A1001–A2010 runtime** — next Digital Use capability after this foundation, subject to the implement gate.
6. **Family Alliance / Contract / Review runtime** — later Phase 2 slices.
7. **Professional/AI layer** — Phase 3.
8. **Goal/Plan/Task/Checkin/Review execution loop** — Phase 4.

---

## 23. Future Implement Gate

### Design Gate

**PASS.**

The selected capability is fully traceable, independently bounded, and does not require unresolved product decisions.

### Future Implement Gate

**BLOCKED.**

The formal §38 implementation sequence still requires Phase 1 runtime completion before Phase 2 implementation begins.

Minimum blockers to clear before Slice 11 implementation:

1. PR #26 / Slice 8 completes independent code audit and merges to main, or its final authoritative state is otherwise reconciled;
2. Slice 9 implementation lands on main with the approved Safety guard and authoritative Drizzle/Data Access foundation, or an explicitly approved replacement remediation closes the same technical gate;
3. Slice 10 implement gate opens, Slice 10 implementation lands on main, and its Compliance feature-policy foundation becomes authoritative;
4. latest main is re-read after those merges and no new Docs/governance/architecture drift invalidates this Spec;
5. any migration/shared-contract conflicts from Phase 1 are settled before Phase 2 code begins.

This Spec being frozen does **not** mean READY FOR DEVELOPMENT.

---

## 24. Clarifications

### A. Answered directly by authoritative Docs

**C-01 — Is Full Node Manifest optional?**  
CLOSED. No. V1-D43 / §12.2 / §40 make it mandatory.

**C-02 — Is node-manifest.ts allowed to coexist with node-registry.ts?**  
CLOSED. No. §12.2 says the Manifest is the single code-side node fact source.

**C-03 — May routing use an LLM to choose next nodes?**  
CLOSED. No. §12.3 requires deterministic routing; AI output is candidate context only.

**C-04 — May A1001 use one total duration to decide intervention?**  
CLOSED. No. Current authority remediation explicitly forbids it.

**C-05 — Is there a universal age-6 Scene gate?**  
CLOSED. No.

**C-06 — Are computer/game devices excluded because historical wording says phone?**  
CLOSED. No.

**C-07 — Can A3010–A3113 be generated by numeric ranges?**  
CLOSED. No. Only actual product nodes exist.

**C-08 — Can A5001/A5002 be merged?**  
CLOSED. No.

### B. DERIVED CLARIFICATIONS

**DU-011-A — Sparse target-node reachability**  
DERIVED CLARIFICATION. A3002 explicitly manages target selection/evaluation/record/reselection; target modules explicitly include target, feasibility, progress and help. Where a row does not define a numeric “next,” reachability must be modeled through target-management/user/scheduled/help entry semantics, not invented numeric adjacency.

**DU-011-B — A4004–A4009 ordering**  
DERIVED CLARIFICATION. The source requires all six distinct components but does not authorize a new mandatory adjacency between every numeric neighbor. Preserve each component’s approved role/reachability and only encode explicit ordering/entry semantics.

**DU-011-C — Graph reachability must include non-linear entry modes**  
DERIVED CLARIFICATION. Because the PRD explicitly includes timeline push, user-initiated entry, re-entry/help and parallel work, reachability validation cannot be defined as only allowedNext linear edges.

**DU-011-D — Phase metadata cannot bypass Common Core phases**  
DERIVED CLARIFICATION. Manifest phase metadata describes where a node belongs/operates, but no node may use that metadata to skip the global Problem Formulation / Goal / Plan / Safety / Compliance gates. Exact implementation representation is Plan-level; product phase semantics remain upstream-controlled.

**DU-011-E — Terminal route representation**  
DERIVED CLARIFICATION. “Return to main” / other-scene handoff is represented as an explicit terminal/external route, not a fabricated A/010xx node. Literal enum names are Plan-level.

### C. OPEN PRODUCT DECISIONS

**NONE.**

Open Product Decisions = **0**.

---

## 25. Frozen Spec Gate

- Authority Gate: **PASS**
- Input Drift: **NONE**
- Selection Gate: **PASS**
- Selected capability: **Digital Use Full Node Manifest / Deterministic Routing Foundation**
- V1 Phase: **Phase 2**
- Specify: **COMPLETE**
- Clarify: **COMPLETE**
- Open Product Decisions: **0**
- Docs Modified: **NO**
- Scope Expansion: **NO**
- Production Code Modified: **NO**
- Plan: **NOT STARTED**
- Checklist: **NOT STARTED**
- Tasks: **NOT STARTED**
- Audit 1: **NOT STARTED**
- Implement: **NOT STARTED**
- Design Gate: **PASS**
- Future Implement Gate: **BLOCKED**

**FROZEN SPEC READY FOR PLAN AI 2.**

---

## 26. Plan AI 1 Stop Boundary

This artifact intentionally stops before:

- Plan;
- requirements-quality checklist;
- Tasks;
- Audit 1;
- implementation;
- migration;
- runtime;
- test implementation;
- PR;
- merge.

The next permitted role is **Plan AI 2**, operating only from this Frozen Spec plus the authoritative Docs and fresh repository truth.
