# Slice 13 Implementation Plan — 013-digital-use-family-alliance-runtime

**Role**: Plan AI 2 — Plan + Checklist + Tasks + Pre-Development Audit 1 only  
**Planning Branch**: `plan/013-digital-use-family-alliance-runtime`  
**Frozen Spec Commit**: `07f3692b9f4e79b98a27a0c7f21913e0e6776b34`  
**Frozen Spec Blob**: `c3e9bf9aa9296e54c8faec0ec83cc15a2d75289b`  
**Frozen Spec Lines**: `1470`  
**Planning decision**: implementation remains BLOCKED; this Plan does not authorize production work.

## 1. Authority Gate

### 1.1 Remote truth

- Current origin/main: `6fab0b79a942c5bf961a2201138ed02bf3197859`.
- Slice 13 Frozen Spec commit/blob/line-count: exact match.
- Planning branch is created from the Frozen Spec commit lineage, not from an unrelated working branch.
- Current open runtime PR relevant to the gate: Slice 8 PR #26, OPEN/DRAFT, head `21ed135e1b98f7d4f5a48df96d5def42c2c33219`, unmerged, and diverged from current main.
- Slice 9 PR #28 is merged at current main; merged runtime head `7b4f5796ef1c6ac1126f9b7bb687293df8a8ceef`.
- Slice 10/11/12 have planning branches but no merged runtime.

### 1.2 Four formal Docs blobs

| Doc | Blob |
|---|---|
| `Docs/总产品需求.md` | `67724000cb9bb81c40489c04db28d899bd1df74c` |
| `Docs/V1产品需求.md` | `918d8574ad88773fe371985fd5c38080c944fec9` |
| `Docs/总体技术架构.md` | `9b08371edc976fa281469dfee8dc19962452e3b0` |
| `Docs/V1技术设计.md` | `e7285fd8363c8a76ab4fd96a305037b5c675f961` |

The re-read confirms Phase 2 owns deterministic Digital Use Scene runtime; FAMILY_ALLIANCE is A3000-A3113 actual nodes; A3001/A3002 parallelism is explicit; Common Core mapping cannot rewrite canonical flow; Phase 4 Goal/Intervention/Plan/Task/Checkin/Review/Outcome remains later.

### 1.3 Frozen upstream contracts

| Slice | Frozen branch / contract | Spec blob | Runtime classification now |
|---|---|---|---|
| 8 Problem Formulation | `spec/008-problem-formulation-core` | `6a5656abab211a4dd80f6e1b0e20d358193ffb17` | Future dependency; PR #26 open/draft/unmerged; feature head preserves Docs and Frozen Spec blobs |
| 9 Safety | `spec/009-safety-hold-control-foundation` | `9d11288aa063ae2a3b8e1942334083f9d82a804b` | Current merged runtime at main |
| 10 Compliance | `spec/010-compliance-feature-policy-foundation` | `a911bcc0c168e00efa015d53d5c120bece28c5a7` | Frozen/planned future dependency |
| 11 Manifest/routing | `spec/011-digital-use-node-manifest-routing-foundation` | `8d47a2b8ad0431540598ceecef14550bd383fe1f` | Frozen/planned future dependency |
| 12 Assessment runtime | `spec/012-digital-use-assessment-runtime` | `e0ed342dc144fedf5b516b5295a23cbcc31722bc` | Frozen/planned future dependency |

### 1.4 Drift classification

`Input Drift: RECONCILED — NON-SEMANTIC DEPENDENCY EXECUTION DRIFT`.
Slice 8 implementation/test head advanced, but its Frozen Spec and all four formal Docs blobs remain unchanged. Current main and Slice 13 Frozen Spec also match the freeze authority. No product semantic, ownership, canonical node inventory, routing, gate, Safety, Compliance or Consent contract drift was found.

**Authority Gate: PASS.**

## 2. Frozen Requirement Traceability

The following `S13-FR-*` identifiers are planning-only traceability aliases for Frozen Spec requirements; they are not new product requirements.

| ID | Frozen requirement | Plan | Checklist | Task | Future Test Evidence |
|---|---|---|---|---|---|
| S13-FR-001 | Whole-slice fidelity: exactly 43 canonical FAMILY_ALLIANCE nodes, no range generation | §3, §9 | D/S/T | T1325 | manifest exact-inventory + AS-10/11/12/13 + static scope fixture |
| S13-FR-002 | Ownership: consume existing Evidence, Problem Formulation, Safety, Compliance, Consent, Assessment and routing owners | §6, §10 | C/J/L | T1302,T1306 | owner-seam compile/static audit + integration composition tests |
| S13-FR-003 | Legal entry requires authorized current primary/open Case, current package, A2010 boundary, Problem Formulation, Consent, Compliance, Safety and router reachability | §11 | E/L | T1306,T1307 | entry integration fixture AS-01 |
| S13-FR-004 | A3000 is repeatable and non-blocking regardless of self-rating | §9.2, §14.2 | E/Q/S | T1307 | A3000 domain/integration AS-02/03 |
| S13-FR-005 | A3001 and A3002/feasibility remain canonically parallel | §9.3 | F/S | T1308,T1321 | parallel integration/concurrency AS-04 + HX-02 |
| S13-FR-006 | A3002 Target List supports selection/confirm/submit/manage/evaluate/record/reselection and is not Goal | §9.4, §14.3 | G/Q | T1309 | A3002 selection/reselection integration AS-05/06/41 |
| S13-FR-007 | All ten target families preserve target/feasibility/progress/help semantics | §9.5 | D/H/I/S | T1310-T1320 | ten family-path fixtures HX-12 + AS-07/08/09 |
| S13-FR-008 | A3033 is canonical sparse numbering; A3023/A3030/A3031/A3032 are forbidden | §9.1, §9.6 | D/T | T1312,T1325 | sparse-number manifest/static/acceptance AS-11 |
| S13-FR-009 | A3090-A3093 remain canonical | §9.6 | D/T | T1318,T1325 | A3090-A3093 reachability/acceptance AS-12 |
| S13-FR-010 | A3111 remains reachable feasibility and cannot invent professional threshold/scoring | §9.6, §14.4 | D/H/T | T1320,T1325 | A3111 reachability + no-threshold AS-13/HX-13 |
| S13-FR-011 | Five truth categories remain separate: Evidence, Scene Node State, Scene Artifact/target item, existing Common Core, future downstream | §10 | C/J | T1302-T1306 | ownership/static duplicate-truth guard + repository integration |
| S13-FR-012 | Scene state extends Slice 12: one current Case/package/node projection, revisioned, legal reachability, history preserved | §14.1 | J/N/O | T1303,T1305,T1306 | scene-state repository/CAS/concurrency tests |
| S13-FR-013 | Substantive user facts remain authoritative Evidence with provenance; Scene state references rather than duplicates | §13 | J | T1305-T1320 | Evidence provenance/cross-Case/source-fidelity integration |
| S13-FR-014 | Family Alliance artifacts are bounded and versioned; no generic artifact platform | §14 | J/T | T1303,T1305,T1307-T1320 | artifact/revision repository + scope-negative platform guard |
| S13-FR-015 | Feasibility preserves five approved dimensions without universal score/cutoff/diagnosis | §14.4 | H/T | T1310-T1320 | feasibility domain matrix + no-score static guard |
| S13-FR-016 | Scene progress is not Phase 4 Task/Checkin/Plan execution/Outcome | §14.5 | I/T | T1310-T1325 | progress scope-negative Task/Checkin/Outcome tests AS-08/43 |
| S13-FR-017 | Help/re-entry uses Slice 11 Manifest entry/re-entry metadata only | §14.6, §20 | I/Q | T1310,T1321 | help/re-entry Manifest integration AS-09/38 |
| S13-FR-018 | Authorization/RLS enforce Family, Case, primary, participant, purpose, role and anti-enumeration boundaries | §15 | K | T1323 | authorization/RLS/security-negative AS-20..24 |
| S13-FR-019 | Slice 9 is the sole Safety authority; ordinary progression is blocked under Safety Hold | §16.4 | L/N | T1306,T1324 | Safety block/race integration AS-25/26 |
| S13-FR-020 | Slice 10 is the sole Compliance feature-policy authority; required UNKNOWN/unavailable fails closed | §16.3 | L | T1302,T1306,T1324 | Compliance block/unknown/race AS-27/28 + HX-06 |
| S13-FR-021 | Consent remains separately owned; revocation blocks future affected processing without erasing history | §16.2 | L/Q | T1302,T1306,T1324 | Consent revoke/race AS-29 + HX-07 |
| S13-FR-022 | Slice 8 remains Problem Formulation owner; Slice 13 only validates/reads the confirmed gate | §6.4, §11 | C/E/T | T1302,T1306 | Problem Formulation entry/static owner guard AS-01 |
| S13-FR-023 | Slice 12 remains Assessment and Scene runtime owner; Slice 13 does not rerun A1001-A2010 | §6.7, §23 | C/T | T1302,T1303 | Assessment ownership/scope-negative static guard |
| S13-FR-024 | Slice 11 is the unique node/routing authority; no numeric adjacency/client nextNode/second route table | §6.2, §12 | C/P/T | T1302,T1306,T1322,T1325 | routing/static/client-nextNode AS-15 + HX-10/14 |
| S13-FR-025 | Existing idempotency authority is reused and atomically coupled to business commit | §17 | M/O | T1324 | idempotency replay/mismatch AS-31/32 |
| S13-FR-026 | Concurrency prevents last-write-wins/two-current truths while allowing legal parallel operations | §18 | N | T1324 | concurrency matrix AS-33..36 + HX-01..09 |
| S13-FR-027 | Canonical mutation effects are all-or-nothing | §19 | O | T1306,T1324 | fault-injection atomicity AS-37 |
| S13-FR-028 | Correction/reassessment/reselection/re-entry are additive/superseding and preserve history | §20 | Q | T1307,T1309,T1321 | correction/reassessment/reselection/re-entry integration AS-03/06/38 |
| S13-FR-029 | Minimal server-authoritative API reuses Scene surface, expected revisions and stable errors | §21 + Plan AI 2 mandate | P | T1304,T1322 | contract/OpenAPI route-count/server-authority tests |
| S13-FR-030 | Failure semantics distinguish denial, dependency unavailable, stale/conflict and infrastructure failure | §21 | P | T1304,T1322,T1324 | error-contract + dependency/infrastructure failure tests HX-11 |
| S13-FR-031 | Audit metadata is sufficient without logging raw private narratives | §22 | R | T1304,T1306,T1325 | audit/logging metadata/privacy tests |
| S13-FR-032 | No AI/LLM/RAG/prompt/model authority in Slice 13 | §8, §26 | T | T1325 | AI/RAG/model import and no-network scope-negative AS-44 |
| S13-FR-033 | No A4001-A4012 or Phase 4 Goal/Intervention/Plan/Task/Checkin/Review/Outcome runtime | §8, §10.5, §26 | T | T1325 | A400/Phase4 scope-negative AS-39..43 |
| S13-FR-034 | Development is blocked until Slice 8/10/11/12 runtime owners are audited/merged and reconciled | §24 | B/U | T1301 | T1301 remote authority/merge/migration gate evidence |
| S13-FR-035 | All 44 frozen Acceptance Scenarios have future mechanical test evidence | §25 | S | T1307-T1325 | full AS-01..AS-44 exact-head acceptance matrix |

## 3. Scope Contract

### In scope
- Complete FAMILY_ALLIANCE runtime for exactly 43 frozen canonical nodes as one Slice.
- A3000 self-assessment, A3001 communication preparation, A3002 target lifecycle, and all A3010-A3113 target-family semantics.
- Extension of the merged Slice 12 Scene state/artifact runtime and one bounded `digital_use_target_items` revision model.
- Evidence references/writes through the Evidence owner; deterministic routing through Slice 11; authoritative gates through their owners.
- Minimal contract/API schema extension, authorization/RLS, idempotency, concurrency, atomicity, observability and mechanical tests.

### Out of scope
- A4001-A4012, A5001/A5002 runtime, Goal, InterventionInstance, PlanVersion, Task, Checkin, Review, Outcome, schedule/notification/pg-boss.
- AI/LLM/RAG/prompt/model routing/embedding/recommendation/scoring.
- New Scene, generic workflow/rules/form engine, XState, event sourcing, CQRS, microservices, generic artifact platform or second policy engine.
- Docs/Frozen Spec edits or upstream owner semantic rewrites.

## 4. Dependency / Implement Gate

Planning is complete-able while implementation is blocked. `T1301` is a hard development-start gate and must execute before any production edit.

Current blockers:
1. Slice 8 Problem Formulation runtime: PR #26 remains open/draft/unmerged and must reach independent Audit 2 PASS + merge.
2. Slice 10 Compliance Feature Policy runtime: not implemented/audited/merged.
3. Slice 11 node-manifest/deterministic routing runtime: not implemented/audited/merged.
4. Slice 12 Assessment/Scene runtime: not implemented/audited/merged.
Slice 9 Safety is merged and is not a blocker, but T1301 must prove it remains authoritative after all later merges.

If a required owner is absent, if transaction-safe composition cannot be obtained without semantic redesign, or if frozen semantics drift: **STOP**. Slice 13 may not implement a fallback owner.

## 5. Ownership Map

| Truth/capability | Owner | Slice 13 may do | Slice 13 must not do |
|---|---|---|---|
| Canonical product meaning | formal Docs + Slice 13 Frozen Spec | implement frozen behavior | rewrite/simplify product semantics |
| Node identity/topology/routes | Slice 11 | manifest lookup, reachability, route result | second node registry/route table/numeric inference |
| Evidence | existing Evidence Core | append/supersede through owner; store refs | answers/facts JSON truth table |
| Scene node state/artifacts | Slice 12 | extend owner model and repositories | second scene-state/artifact platform |
| Problem Formulation | Slice 8 | read/validate current confirmed gate | create/confirm/dispute/correct/direct SQL mutate |
| Safety | Slice 9 | ordinary-progression guard/current state | ResolveRisk/second Safety evaluator |
| Compliance | Slice 10 | internal evaluator + capability guard | local age/minor/guardian/AI policy |
| Consent | existing Consent owner | validate required purpose/version/revocation | private Family Alliance consent ledger |
| Case/primary/participant/auth | existing Common Core | authorize/revalidate/RLS | new role or family-wide access shortcut |
| Idempotency/audit/events | existing shared infrastructure | reuse atomically | second idempotency/audit store |
| Phase 4 truths | future owners | expose unavailable boundary only | create Goal/Plan/Task/Checkin/Outcome |

## 6. Architecture / Runtime Boundary

### 6.1 Minimum implementation shape
- Reuse `packages/scenes/digital-use/node-manifest.ts` and `routing.ts` from Slice 11.
- Add only bounded Family Alliance semantic code under the merged Digital Use Scene/application structure. Logical modules are `family-alliance-types`, `family-alliance-semantics`, `family-alliance-repository`, and one `family-alliance` execution composition; T1302 reconciles exact paths to merged Slice 12 without creating a new package when an owner package already exists.
- API composition reuses Slice 12 generic Scene endpoints. No endpoint-per-node and no Family Alliance endpoint family.
- One additive migration may add `digital_use_target_items` plus only narrowly required shared vocabulary/index/grant changes.
- Node-specific handlers are allowed only for node business semantics. They may not contain `allowedNext`, prerequisites, parallel topology or a second canonical node list used for reachability.

### 6.2 Canonical execution roles
The 43 node handlers reduce only to these semantic roles: `SELF_ASSESSMENT`, `COMMUNICATION_PREP`, `TARGET_LIST`, `TARGET`, `FEASIBILITY`, `PROGRESS`, `HELP`. This role abstraction does not erase family-specific payload/content references and does not own topology.

### 6.3 Exact canonical inventory
A3000, A3001, A3002, A3010, A3011, A3012, A3013, A3020, A3021, A3022, A3033, A3040, A3041, A3042, A3043, A3050, A3051, A3052, A3053, A3060, A3061, A3062, A3063, A3070, A3071, A3072, A3073, A3080, A3081, A3082, A3083, A3090, A3091, A3092, A3093, A3100, A3101, A3102, A3103, A3110, A3111, A3112, A3113

No range generation. A3033 is intentional. A3023/A3030/A3031/A3032 are non-nodes. A3090-A3093 and A3111 are mandatory.

## 7. Scene State Model

- Reuse `scene_node_states` from Slice 12; do not create a Family Alliance scene-state table.
- Aggregate identity remains Case + current bound Scene Package + nodeCode; one current projection per Case/node with revision CAS.
- Package version is provenance/binding, not permission for two current copies.
- Status remains the Slice 12 contract; Slice 13 does not invent a second lifecycle enum.
- `input_refs`/`output_refs`, branch/reason codes, source node identity, entered/completed timestamps and revision remain authoritative projection metadata.
- Parallelism is represented by independent current/available node projections. There is no single global wizard cursor. A3001 and A3002 may both be active/available.
- Completion is per node/target only. No fabricated `FAMILY_ALLIANCE_COMPLETED` truth and no all-targets-complete requirement.
- Re-entry increments current projection/revision through legal Manifest semantics; no delete/reset/rewind SQL.

## 8. Evidence Model

- Substantive statements about family behavior, need, motivation, capability, obstacles, emotion and actual execution are written by the authoritative Evidence owner with actor/source provenance.
- User-authored target text and Scene target structure may live in the target artifact because they are Scene intent/state, but observed claims used as facts must remain Evidence.
- Scene/target rows store typed Evidence refs, not copied raw narratives as final truth.
- UNKNOWN, NOT_COLLECTED, DECLINED, CONFLICT and N/A remain distinct.
- Parent input cannot be attributed to a child. Re-entry/correction appends/supersedes Evidence and preserves prior sources.

## 9. Artifact Model

### 9.1 A3000
Persist a versioned `FAMILY_ALLIANCE_SELF_ASSESSMENT` Scene artifact through Slice 12 artifact owner. It contains approved content/schema version, source node, Evidence refs and display projection. Raw substantive narrative remains Evidence. Reassessment appends a new artifact revision/supersedes link.

### 9.2 Target List / target items
`digital_use_target_items` is the canonical structured Scene target artifact for A3002/A3010-A3113. Do not mirror the same authoritative target payload into `scene_artifacts`.

Minimum revision-row fields after T1301 reconciliation:
- `id`, `family_id`, `case_id`, `scene_package_version`, `target_code`.
- `selection_revision` = A3002 revision that established the selection basis.
- `revision` = per target-item monotonic revision.
- `selected`.
- `concrete_target_text` when the approved node collects it.
- typed `feasibility_payload` carrying the five approved dimensions when collected.
- typed node-specific `progress_payload` and `progress_evidence_refs`; no universal Phase-4-like task state machine.
- `help_history_refs` to approved help interaction/artifact/event records.
- `source_refs`, `supersedes_id`, `superseded_at`, `created_at`, creator/audit identity as consistent with repository conventions.

Current uniqueness: one non-superseded row per Case + target_code. Substantive historical rows remain immutable; only lifecycle supersession metadata may close a prior current row inside the same transaction that inserts its replacement.

### 9.3 A3002 full-set revision
Every A3002 submit/reselect writes a coherent snapshot across all ten canonical target codes in one transaction. Each target receives a new item revision bound to the new A3002/selection revision, selected or not selected. Later target-specific feasibility/progress/help revisions keep that selection basis until the next A3002 reselection.

### 9.4 Bounded artifact rule
A3001/help may create an additional user-saveable Scene artifact only when the merged Manifest `recordContract`/approved product output requires one. No generic artifact engine or speculative document type is created.

## 10. Canonical Node Execution Model

All execution begins with a Manifest-known node and legal reachability. Business semantics never make a node canonical.

One mutation orchestration performs, inside one same-client authoritative transaction:
1. authenticate/resolve real actor, Family and Case; authorize requested resource/purpose and establish RLS context;
2. acquire shared idempotency identity only after anti-enumeration-safe scope establishment;
3. read expected Case/package/node/target basis and current primary/open Case;
4. validate expected Case/package/node/target revisions;
5. validate required Consent through owner;
6. evaluate Compliance through Slice 10 owner and supported-obligation guard;
7. run Slice 9 ordinary-progression Safety guard;
8. validate current Problem Formulation gate where entry/re-entry requires it;
9. resolve Slice 11 Manifest entry, reachability, entryMode/help/re-entry metadata and structured payload schema;
10. run only the node-specific semantic handler;
11. write required Evidence and bounded Scene/target artifact revision;
12. call Slice 11 pure router with server-owned structured facts;
13. CAS node/target current revisions and materialize only legal next/parallel availability;
14. write case/business audit/event metadata;
15. revalidate mutable owner versions/tokens required to close races: primary/Case, Consent, Compliance, Safety and package binding;
16. complete shared idempotency result with the stable business response;
17. commit all effects.

If any merged owner cannot support the required same-transaction snapshot/revalidation semantics, T1302 stops development rather than implementing a local replacement.

## 11. Parallel Execution

- A3001 and A3002 do not depend on each other's completion.
- Feasibility for a selected target may progress while A3001 is IN_PROGRESS where Manifest permits.
- Independent legal writes use independent node/target expected revisions; a conflict in one branch does not mark the other completed or failed.
- Same-aggregate writes use CAS and one-current uniqueness; no last-write-wins.
- Scene reads expose sets of active/reachable nodes and target projections; they must not collapse to one serial `currentNode` authority.
- Database transactions may briefly serialize on shared owner rows during final revalidation, but product reachability/availability remains parallel; no persistent serial wizard prerequisite is introduced.

## 12. Target List Semantics

- Exactly ten target families are canonical: SLEEP, EXERCISE, HOBBIES, CHORES, FAMILY_GATHERING, OUTDOOR_ACTIVITY, EMOTION_REGULATION_1, TIME_MANAGEMENT, FAMILY_RELATIONSHIP, EMOTION_REGULATION_2.
- Target selection is a Scene-level structured artifact, not Common Core Goal.
- A3002 owns selection/reselection revision; target family nodes update their target item under the current selection basis.
- Deselection preserves prior feasibility/progress/help history. It does not reassign old progress to another target.
- Re-selecting a previously used target exposes preserved history but does not fabricate current progress; current semantics come from the new revision + Manifest-approved re-entry.
- No target may be auto-created from numeric node patterns or client input outside the canonical ten.

## 13. Feasibility Semantics

Each feasibility node preserves exactly these approved dimensions:
1. concrete / quantified behavior;
2. need;
3. motivation / benefit;
4. ability / possibility;
5. challenge / resistance.

Payload values are user-sourced/approved structured inputs. No universal score, probability, cutoff, diagnosis, AI eligibility model or professional threshold is added. `A3111` follows the same rule and remains present/reachable.

## 14. Progress / Help / Re-entry

- Progress nodes record Scene-level target progress/observations and Evidence refs; they do not create Task, Checkin, Plan execution or Outcome.
- There is no new universal progress lifecycle beyond the frozen Scene/node/target payload contract. Family-specific payloads remain typed and bounded.
- Help nodes use approved/versioned professional content and Manifest help/re-entry metadata; help cannot silently change selection/progress.
- Help history is reference-based and provenance-aware.
- Re-entry always rechecks current primary, package, Authorization, Consent, Compliance, Safety, expected revisions and Manifest reachability.
- A3000 reassessment, A3002 reselection, ordinary correction and formal upstream reassessment are distinct operations; none is implemented as global reset.

## 15. Authorization / RLS

- Application authorization and DB RLS both apply; passing one never substitutes for the other.
- Mutations require the current primary/open Case and the existing authorized action/purpose. Reads follow existing participant/visibility/purpose contracts.
- Family membership alone and Participant presence alone do not grant mutation authority.
- Every client-supplied Case/person/target/ref is untrusted and resolved under current scope.
- Cross-Family and cross-Case target/Evidence refs fail.
- Child-specific confirmation/statement requires a real authorized child source; parent input cannot be reattributed.
- `digital_use_target_items` uses ENABLE/FORCE RLS, Family-bound policy, runtime NOBYPASSRLS and least-privilege SELECT/INSERT/narrow lifecycle UPDATE; no DELETE/TRUNCATE/public grants.
- Unauthorized/not-found behavior follows the repository anti-enumeration contract, not a Family Alliance-specific disclosure.

## 16. Safety

Slice 9 is the only Safety authority. Slice 13 calls only its ordinary-progression guard/current state. SAFETY_HOLD blocks A3000-A3113 progression, including retries/re-entry. Slice 13 never calls ResolveRisk or writes Safety state.

Race rule: the final Case/Safety revalidation must fail an ordinary command if Safety/Case version changed before the command obtains its final valid commit basis. No ordinary result may report success after a committed prior Safety Hold.

## 17. Compliance

Slice 13 resolves only a server-owned FAMILY_ALLIANCE feature descriptor and calls the Slice 10 authoritative snapshot/evaluator/capability guard. Client feature/policy input is ignored/rejected.
- BLOCK, missing effective policy, multiple/invalid policy, UNKNOWN applicability or unsupported required obligation fails closed.
- Infrastructure/database failure propagates as infrastructure failure, not ordinary Compliance denial.
- T1302 must consume the merged owner policy-version/snapshot revalidation contract. If a racing policy change cannot be proven safe without a local policy engine, STOP.

## 18. Consent

- Required consent is validated through the existing owner for exact actor/subject/purpose.
- Family Alliance answer/selection is never guardian, cross-member, notification or AI-processing consent.
- Revocation blocks affected future processing and preserves historical Evidence/Scene data.
- T1302 must bind to an owner version/lock/revalidation seam sufficient to reject stale success on revocation races. No private consent boolean/table is permitted.

## 19. Idempotency

- Reuse the existing repository-wide idempotency store.
- Canonical fingerprint includes Case, nodeCode, expected package/node/target/selection revision as applicable, structured response/action and server-approved command identity. Mutable server state is not inserted into the client request hash.
- same key + same canonical payload returns original stable business result.
- same key + different payload conflicts.
- Replay duplicates no Evidence, artifact, target revision, node completion, audit/event or help/progress record.
- Failed transaction leaves retry possible.
- Idempotency success is written in the same transaction as business success.
- No `family_alliance_idempotency` table/service.

## 20. Concurrency

| Race | Required result |
|---|---|
| same node response | CAS/replay: one compatible current revision; no LWW |
| A3001 vs A3002 | both may succeed when independently legal; neither completes the other |
| same target feasibility/progress | one expected-revision winner; stale writer conflicts |
| A3002 reselection vs target progress | coherent selection/target basis; stale basis fails, old progress remains |
| A3000 reassessment vs downstream | downstream revalidates current node/package/gates; reassessment history retained |
| primary switch | stale command fails at final Case/current-primary revalidation |
| Safety Hold | committed prior Safety/version change blocks ordinary commit |
| Compliance change | authoritative policy snapshot/version is revalidated; stale success forbidden |
| Consent revocation | authoritative consent version is revalidated; stale success forbidden |
| package/Manifest drift | stale package token fails |
| re-entry vs current write | one current projection per node/target; history preserved |

No two current truths. Legal operations on independent branches/targets may coexist; conflict handling is aggregate-scoped rather than global reset.

## 21. Atomicity

A canonical mutation may touch Evidence, node state, target item, Scene artifact, audit/event and idempotency. They form one business transaction.

Mandatory fault-injection points:
1. after Evidence preparation/write;
2. after target revision insert but before supersession/current CAS;
3. after Scene artifact write;
4. after node state CAS;
5. after router result but before next/parallel projection;
6. after audit/event;
7. during final gate revalidation;
8. during idempotency completion.

Every injected failure must leave no partial business result and no completed idempotency result. Router evaluation itself is pure and has no separate commit.

## 22. Correction / Reassessment

| Operation | Owner/meaning | History behavior |
|---|---|---|
| ordinary correction | Scene/Evidence correction through legal Manifest re-entry | append/supersede Evidence/target/artifact; increment revision |
| A3000 reassessment | repeat Family Alliance self-assessment | new Evidence + artifact revision; no downstream reset |
| A3002 reselection | explicit Target List change | new full selection revision; old target progress retained |
| help/re-entry | Manifest-approved entry | new help/progress refs only as actually produced; no hidden mutation |
| formal upstream reassessment | Common Core/Slice 8/12 owner | Slice 13 consumes resulting current state only |

DELETE, TRUNCATE, global reset, direct SQL rewind and rewriting history are forbidden.

## 23. API / Error Contract

### 23.1 Surface
Slice 13 adds **zero new public route families**. It reuses the merged Slice 12 Scene surface:
- `GET /api/v1/cases/:id/scene`;
- `GET /api/v1/cases/:id/scene/nodes/:nodeCode`;
- `POST /api/v1/cases/:id/scene/nodes/:nodeCode/responses`.

`POST /assessments` remains Slice 12 Assessment-only and is not repurposed for Family Alliance.

Scene responses extend the authorized projection with target list/items, node/target/list/package revision tokens, active/reachable nodes, server-owned route reason/entry mode, artifact refs and truthful downstream availability. Mutation payload is discriminated by node semantics and requires Idempotency-Key + expected revision tokens.

### 23.2 Stable failure classes
- anti-enumerated unauthorized/not-found;
- wrong Family/Case/participant/current-primary;
- fabricated/unknown node;
- canonical but unreachable node;
- invalid/fabricated target code;
- schema-invalid response;
- preserved UNKNOWN/DECLINED/CONFLICT business state;
- stale Case/package/node/selection/target revision;
- Safety blocked;
- Compliance blocked/unresolved/capability unavailable;
- Consent missing/revoked;
- idempotency mismatch;
- concurrent conflict;
- dependency/downstream unavailable;
- infrastructure/internal failure.

These map to existing repository HTTP/error vocabulary after T1302; Slice 13 must not collapse them into one generic conflict or invent a second error stack.

## 24. Observability / Audit

Successful mutations record, through existing audit/event authority, as applicable:
- Family, Case, authenticated actor;
- package version;
- nodeCode and sourceNodeCode;
- prior/new node revision;
- route reason and entry mode/re-entry/help reason;
- target_code, selection revision and target revision;
- Evidence/artifact refs;
- idempotency identity/result;
- authoritative gate decision/version references sufficient for audit without raw policy payload;
- timestamp.

Blocked attempts may record safe classification metadata according to existing audit policy. Operational logs/metrics must not copy raw private answers, family narratives, full Evidence payloads or sensitive artifact contents. There is no AI-run provenance.

## 25. Testing Strategy

Required layers: unit, domain, service, repository, migration, RLS, contract, OpenAPI, integration, concurrency, idempotency, fault injection, security-negative, scope-negative, governance and exact-head CI.

### 25.1 Frozen Acceptance Scenarios
| ID | Scenario | Mechanical expected result | Owner task | Future evidence class |
|---|---|---|---|---|
| AS-01 | Legal entry | authorized primary/open Case + current package + A2010 + confirmed formulation + gates + router admit A3000 | T1306,T1307 | integration |
| AS-02 | A3000 non-blocking | every valid self-rating allows approved continuation; no threshold | T1307 | domain/integration |
| AS-03 | A3000 repeat | prior history remains; later current revision becomes visible | T1307 | integration |
| AS-04 | Parallel start | A3001 and A3002/feasibility can progress without mutual completion prerequisite | T1308,T1321 | integration/concurrency |
| AS-05 | Target list | valid canonical set is saved as one atomic selection revision | T1309 | integration |
| AS-06 | Target re-selection | new selection revision preserves prior selections/progress | T1309,T1321 | integration |
| AS-07 | Feasibility | five approved dimensions are recorded with no fabricated cutoff | T1310-T1320 | domain/integration |
| AS-08 | Scene progress | progress + Evidence refs without Task/Checkin creation | T1310-T1320 | integration/scope-negative |
| AS-09 | Help | Manifest-approved help/re-entry preserves target truth | T1310,T1321 | integration |
| AS-10 | Exact inventory | exactly 43 addressable FAMILY_ALLIANCE nodes; no inferred gaps | T1325 | manifest/acceptance |
| AS-11 | A3033 fidelity | A3033 accepted; A3023/A3030/A3031/A3032 rejected | T1312,T1325 | acceptance/static |
| AS-12 | Time management fidelity | A3090-A3093 retained and reachable | T1318,T1325 | acceptance |
| AS-13 | A3111 fidelity | A3111 reachable and no unapproved threshold/scoring | T1320,T1325 | acceptance |
| AS-14 | Target-code attack | fabricated target_code rejected | T1309,T1323 | security-negative |
| AS-15 | No numeric adjacency | next-number/client-forced routing rejected | T1306,T1322,T1325 | security/static |
| AS-16 | Unknown | UNKNOWN/NOT_COLLECTED does not become default positive | T1310-T1320 | domain |
| AS-17 | Declined | DECLINED remains distinct from success/failure | T1310-T1320 | domain |
| AS-18 | Conflict | conflicting sources remain visible; no fact winner invented | T1310,T1321 | domain/integration |
| AS-19 | Partial completion | partial target progress does not create global stream completion | T1321 | integration |
| AS-20 | Unauthorized | unauthorized actor cannot read/write Family Alliance state | T1323 | security-negative |
| AS-21 | Cross-family | Family A cannot access Family B targets/Evidence | T1323 | RLS/integration |
| AS-22 | Wrong-case | cross-Case target/Evidence refs cannot satisfy current Case | T1323 | integration |
| AS-23 | Participant escalation | participant presence alone grants no mutation authority | T1323 | security-negative |
| AS-24 | Child source fidelity | parent input cannot be stored as child agreement/statement | T1323 | integration |
| AS-25 | Safety blocked | SAFETY_HOLD blocks A3000-A3113 and commits no success state | T1306,T1324 | integration |
| AS-26 | Safety race | Safety change before final commit revalidation makes ordinary write fail | T1324 | concurrency |
| AS-27 | Compliance blocked | authoritative BLOCK/unresolved policy fails closed | T1306,T1324 | integration |
| AS-28 | Compliance unknown | required missing/UNKNOWN policy is not ALLOW | T1306,T1324 | integration |
| AS-29 | Consent revoked | revocation before final commit prevents affected processing | T1324 | concurrency |
| AS-30 | Gate separation | Authorization ALLOW cannot override Consent/Compliance/Safety denial | T1306,T1324 | integration |
| AS-31 | Idempotent replay | same key+payload returns original result without duplicates | T1324 | idempotency |
| AS-32 | Idempotency mismatch | same key+different canonical payload conflicts | T1324 | idempotency |
| AS-33 | Concurrent A3002 | two writes against one expected selection revision cannot both become current | T1324 | concurrency |
| AS-34 | Concurrent target write | same target revision cannot last-write-win | T1324 | concurrency |
| AS-35 | Primary switch race | primary change before commit invalidates stale progression | T1324 | concurrency |
| AS-36 | Package drift | package/version drift prevents stale apply | T1324 | concurrency |
| AS-37 | Atomic failure | failure mid-command leaves no partial business/idempotency result | T1324 | fault-injection |
| AS-38 | Re-entry | approved re-entry preserves history and rechecks all gates | T1321,T1324 | integration |
| AS-39 | PHONE_USE_CONTRACT unavailable | route availability may be exposed; no A4001 work is created/completed | T1321,T1325 | scope-negative |
| AS-40 | A5001 unavailable | review boundary is truthful; no Review truth is created | T1321,T1325 | scope-negative |
| AS-41 | No Common Core Goal | selected target creates no Goal truth | T1325 | scope-negative |
| AS-42 | No Plan | feasibility/progress activates no Plan | T1325 | scope-negative |
| AS-43 | No Task/Checkin | Scene progress creates no Phase 4 Task/Checkin | T1325 | scope-negative |
| AS-44 | No AI authority | full bounded topology/business fixture runs without LLM/network decision service | T1325 | governance |

### 25.2 Additional mandatory hardening evidence
| ID | Evidence | Task |
|---|---|---|
| HX-01 | same-node concurrent response: one legal current winner/replay, no LWW | T1324 |
| HX-02 | A3001/A3002 concurrent writes: both may succeed when independently legal | T1324 |
| HX-03 | same target concurrent feasibility/progress updates: one revision winner | T1324 |
| HX-04 | target reselection vs progress write: stale target/list basis fails or is serialized without cross-target mutation | T1324 |
| HX-05 | A3000 reassessment vs downstream node write: history preserved and downstream command revalidates current gates/revisions | T1324 |
| HX-06 | Compliance effective-policy change during command: owner snapshot/version is revalidated; stale success forbidden | T1324 |
| HX-07 | Consent revocation during command: authoritative consent version revalidated; stale success forbidden | T1324 |
| HX-08 | Scene package/version drift during command: stale command rejected | T1324 |
| HX-09 | re-entry vs current write: one current projection per aggregate, history preserved | T1324 |
| HX-10 | client nextNode/sourceNode/feature policy injection cannot alter server authority | T1322,T1323 |
| HX-11 | dependency unavailable differs from business denial and infrastructure failure | T1322,T1324 |
| HX-12 | all ten target families execute their canonical target/feasibility/progress/help path | T1311-T1320 |
| HX-13 | A3111 is not skipped and has no new scoring/threshold logic | T1320,T1325 |
| HX-14 | fabricated canonical-looking node/target identities fail closed | T1322,T1323 |
| HX-15 | wrong participant/current-primary transitions are revalidated at commit | T1323,T1324 |

### 25.3 Family-path matrix
| Target family | Canonical path | Task |
|---|---|---|
| SLEEP | A3010 → A3011 → A3012 → A3013 | T1311 |
| EXERCISE | A3020 → A3021 → A3022 → A3033 | T1312 |
| HOBBIES | A3040 → A3041 → A3042 → A3043 | T1313 |
| CHORES | A3050 → A3051 → A3052 → A3053 | T1314 |
| FAMILY_GATHERING | A3060 → A3061 → A3062 → A3063 | T1315 |
| OUTDOOR_ACTIVITY | A3070 → A3071 → A3072 → A3073 | T1316 |
| EMOTION_REGULATION_1 | A3080 → A3081 → A3082 → A3083 | T1317 |
| TIME_MANAGEMENT | A3090 → A3091 → A3092 → A3093 | T1318 |
| FAMILY_RELATIONSHIP | A3100 → A3101 → A3102 → A3103 | T1319 |
| EMOTION_REGULATION_2 | A3110 → A3111 → A3112 → A3113 | T1320 |

## 26. Governance / Scope Guards

Future implementation must add/extend narrow static/diff guards proving:
1. Slice 11 remains the only production Digital Use node manifest/router; no API/service-local topology.
2. exactly 43 Slice 13 nodes are accepted by Family Alliance semantics; no generated range/gap fill.
3. A3033 exists; A3023/A3030/A3031/A3032 are absent.
4. A3090-A3093 and A3111 remain.
5. no `family_alliance_answers`, second Evidence store, second Scene state, second Safety/Compliance/Consent/idempotency system.
6. no Goal/InterventionInstance/PlanVersion/Task/Checkin/Review/Outcome writes/imports introduced by Slice 13.
7. no A4001-A4012 or A5001/A5002 runtime handlers.
8. no LLM/RAG/prompt/model/embedding/network decision dependency.
9. no XState/workflow engine/rules DSL/event sourcing/CQRS/microservice.
10. no one-service/table/endpoint-per-node proliferation.
11. no client nextNode or numeric adjacency routing.
12. Docs and all Frozen Specs remain unchanged.

## 27. Implementation Order

T1301 — Development-start Authority / Implement Gate
T1302 — Reconcile merged owner seams and transaction contracts
T1303 — Additive Family Alliance target-item persistence, migration and RLS
T1304 — Shared contracts, command identity and error vocabulary
T1305 — Target-item repository and authorized projection primitives
T1306 — Canonical Family Alliance node execution orchestration
T1307 — A3000 Family Alliance principles/self-assessment runtime
T1308 — A3001 communication-preparation runtime and parallel availability
T1309 — A3002 Target List selection, management and re-selection
T1310 — Shared target-family semantic primitives
T1311 — SLEEP canonical family runtime (A3010/A3011/A3012/A3013)
T1312 — EXERCISE canonical family runtime (A3020/A3021/A3022/A3033)
T1313 — HOBBIES canonical family runtime (A3040/A3041/A3042/A3043)
T1314 — CHORES canonical family runtime (A3050/A3051/A3052/A3053)
T1315 — FAMILY_GATHERING canonical family runtime (A3060/A3061/A3062/A3063)
T1316 — OUTDOOR_ACTIVITY canonical family runtime (A3070/A3071/A3072/A3073)
T1317 — EMOTION_REGULATION_1 canonical family runtime (A3080/A3081/A3082/A3083)
T1318 — TIME_MANAGEMENT canonical family runtime (A3090/A3091/A3092/A3093)
T1319 — FAMILY_RELATIONSHIP canonical family runtime (A3100/A3101/A3102/A3103)
T1320 — EMOTION_REGULATION_2 canonical family runtime (A3110/A3111/A3112/A3113)
T1321 — Parallel projection, help/re-entry and correction integration
T1322 — Scene API/OpenAPI extension and server-authoritative route projection
T1323 — Authorization, RLS and security-negative hardening
T1324 — Idempotency, concurrency, gate-race and atomicity hardening
T1325 — Full acceptance, scope governance and exact-head closeout

Only T1301 may start while the current Implement Gate is blocked. T1302+ require T1301 PASS on then-current main.

## 28. Rollback / Migration Concerns

- Migration is additive and receives the next repository-safe numeric prefix only after T1301 inspects all merged upstream migrations; the semantic suffix is fixed as `digital_use_family_alliance_runtime.sql`. This avoids pre-allocating a number that later upstream remediation may consume.
- Never edit/reorder an already-applied historical migration.
- Before production data, application routes can be disabled while additive tables remain. After real data exists, preserve target/Evidence/artifact history and use forward remediation; do not drop the target table to roll back code.
- Migration tests prove clean bootstrap, exact-main upgrade, repeated application behavior, RLS/grants, constraint/current uniqueness and rollback on failed migration.
- If Slice 12 already creates an equivalent approved target table before Slice 13 starts, T1301/T1302 must reconcile to that owner model and Slice 13 must not create a duplicate table.

## 29. Pre-Development Audit 1

| Audit question | Result |
|---|---|
| Frozen requirements covered by Plan/Checklist/Tasks | PASS |
| All 44 Frozen Acceptance Scenarios have a future test owner | PASS |
| Every task has Frozen Spec authority and bounded verification | PASS |
| Whole Slice / 43 nodes preserved | PASS |
| A3033 sparse numbering preserved; fake gap nodes forbidden | PASS |
| A3090-A3093 retained | PASS |
| A3111 retained and no invented professional threshold | PASS |
| A3001/A3002 parallel semantics preserved | PASS |
| Target List remains Scene artifact, not Goal | PASS |
| Feasibility remains structured user/product payload, not scoring truth | PASS |
| Progress remains Scene-level, not Task/Checkin/Outcome | PASS |
| Help/re-entry consumes Manifest; no numeric routing | PASS |
| No duplicate Evidence/Scene/Safety/Compliance/Consent/idempotency truth | PASS |
| No Phase 4 / A400 / AI leakage | PASS |
| No generic workflow/platform overengineering | PASS |
| Every future mutation task has owner/transaction/revision/verification | PASS |
| Implement Gate remains hard-blocking | PASS |

**Audit 1 mechanical evidence:** 43/43 canonical nodes referenced; 44/44 Frozen Acceptance IDs present in Plan and Checklist; 25/25 task blocks contain Goal/Expected Scope/Mandatory Contracts/Verification/Prerequisites/Frozen Spec Authority; Checklist = 502 PASS / 0 FAIL; branch diff from Frozen Spec lineage = exactly plan.md/checklist.md/tasks.md.

**Audit 1: FINAL PASS.** No Frozen Spec edit was required.

## 30. Final Pre-Development Re-Audit

**Result: PASS.**

Final remote re-read after Audit 1 remediation established:

- current origin/main remains `6fab0b79a942c5bf961a2201138ed02bf3197859`;
- Slice 13 Frozen Spec remains commit `07f3692b9f4e79b98a27a0c7f21913e0e6776b34`, blob `c3e9bf9aa9296e54c8faec0ec83cc15a2d75289b`, 1470 lines;
- the four formal Docs remain blobs `67724000cb9bb81c40489c04db28d899bd1df74c`, `918d8574ad88773fe371985fd5c38080c944fec9`, `9b08371edc976fa281469dfee8dc19962452e3b0`, `e7285fd8363c8a76ab4fd96a305037b5c675f961`;
- Slice 8/9/10/11/12 Frozen Spec blobs remain respectively `6a5656abab211a4dd80f6e1b0e20d358193ffb17`, `9d11288aa063ae2a3b8e1942334083f9d82a804b`, `a911bcc0c168e00efa015d53d5c120bece28c5a7`, `8d47a2b8ad0431540598ceecef14550bd383fe1f`, `e0ed342dc144fedf5b516b5295a23cbcc31722bc`;
- Slice 8 PR #26 remains OPEN/DRAFT/unmerged at head `21ed135e1b98f7d4f5a48df96d5def42c2c33219`;
- Slice 9 PR #28 remains merged, with merge commit equal to current main;
- Slice 10/11/12 still have planning branches only and no open runtime PR;
- the planning branch diff from the Slice 13 Frozen Spec lineage contains exactly `plan.md`, `checklist.md`, and `tasks.md`;
- no production source, migration, test or CI file is changed;
- 35/35 requirement-trace rows contain Plan + Checklist + Task + Future Test Evidence;
- 43/43 canonical nodes, 44/44 Frozen Acceptance Scenarios, 25/25 task contracts and 502/502 PASS checklist items remain mechanically present.

**Input Drift: RECONCILED — NON-SEMANTIC DEPENDENCY EXECUTION DRIFT.**

The only dependency execution drift is Slice 8 implementation/test progress relative to the original freeze; its Frozen Spec and all four formal Docs remain unchanged. No semantic drift was found in product meaning, ownership, canonical inventory, routing, entry/exit gates, Safety, Compliance or Consent authority.

**Implement Gate: BLOCKED.**

Current blockers remain Slice 8, Slice 10, Slice 11 and Slice 12 runtime merge/audit requirements. Slice 9 remains merged and authoritative.

## 31. Planning Freeze

Planning decisions are closed:
- Open Product Decisions: 0.
- Open Planning Decisions: 0.
- Scope Drift: 0.
- Whole-Slice decision: unchanged.
- READY FOR DEVELOPMENT: NO.
- Stop state: `WAITING FOR IMPLEMENT GATE`.

No production implementation is authorized by this file.