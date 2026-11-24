# Slice 23 — Reranker Provider Adapter Foundation

Repository: pyxm1618/xiaoshuyin  
Feature: 023-reranker-provider-adapter-foundation  
Phase: 3 — Professional Knowledge & AI  
Role: Plan AI 1 — Selection / Specify / Clarify only  
Status: FROZEN SPEC CANDIDATE — becomes authoritative only after remote commit/blob read-back  
Base main at branch creation: c8a71bd1d4e699a48b757f0e4731bda640935e1a

This specification freezes what Slice 23 is allowed to be. It does not authorize Plan, Checklist, Tasks, Audit 1, implementation, Audit 2, merge, production route selection, or production release.

The selected responsibility is deliberately narrower than “reranker evaluation”:

> Establish one bounded, provider-replaceable reranker capability contract and technical evidence boundary for the V1 first reranker candidate, qwen3-rerank, without performing Professional Gold Dataset quality evaluation and without approving any production model or RAG route.

---

## 1. Authority Baseline

The authority order remains:

1. Docs/总产品需求.md
2. Docs/V1产品需求.md
3. Docs/总体技术架构.md
4. Docs/V1技术设计.md
5. Frozen Slice specifications, only within the authority delegated by the four documents

Authority document identities read from current main at Slice 23 selection time:

~~~text
Docs/总产品需求.md
blob 97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29

Docs/V1产品需求.md
blob 379cb8cfb377924cd21ccfe55baa5aecdf207f5e

Docs/总体技术架构.md
blob 6b4630803f371faf6d93f27361070223d0f661a0

Docs/V1技术设计.md
blob afef9fcc4af41b6137e5020717135972a3d515fc
~~~

Relevant authority is explicit:

- V1 Professional RAG compares candidates A, B and C on one Xiaoshuyin Gold Dataset.
- A, B and C all end in qwen3-rerank before Top Context.
- qwen3-rerank is the first V1 reranker candidate, not an automatically approved production choice.
- production rerank route/version must bind to Gold Dataset evidence and a pinned model version.
- model/provider replaceability is required; V1 must not build a generic Model Gateway merely because multiple providers may exist later.
- AI/model output cannot create Professional Authority.
- Professional Gold labels/rubrics require real Professional Authority.
- current organization-level Professional Reviewer status remains APPROVED PROFESSIONAL REVIEWER — UNASSIGNED.
- unknown, unavailable, unreviewed or unevaluated capability must fail closed rather than being represented as READY.

No Authority Doc is modified by Slice 23.

---

## 2. Remote Truth at Selection

Remote truth was re-read before branch creation.

~~~text
Current main:
c8a71bd1d4e699a48b757f0e4731bda640935e1a

Latest main commit:
fix(remed-c): close post-merge #10 and #24 (#134)

Existing Slice 23 branch/spec/PR before creation:
NONE

Competing Phase 3 planning branches:
Slice 21 and Slice 22 planning branches exist;
no competing 023 planning/spec branch exists.

Relevant open PRs:
#118 — Slice 20 governance prerequisite, OPEN, governance-only
#115 — remediation workline F, OPEN DRAFT; not a Slice 23 planning owner
~~~

The move from d24e5449a9c7589b70013c0d35f610a63bc6ec89 to current main c8a71bd1d4e699a48b757f0e4731bda640935e1a is a later merged remediation-C commit. No Slice 23 owner or reranker runtime was introduced by that drift.

---

## 3. Slice 17–22 State Recovery

The following states are deliberately not collapsed into a single “done” flag.

| Slice | Spec | Planning / Audit 1 | Implementation | Audit 2 / Merge truth used here | Runtime / Production truth relevant to Slice 23 |
|---|---|---|---|---|---|
| 017 Professional Knowledge | Frozen historical authority + current-main formalization | Historical planning exists | Runtime implementation is merged on main via PR #58 and later remediation work exists | This Plan AI 1 does not infer independent Audit 2 merely from merge status | Professional Knowledge runtime exists, but representative production-approved corpus remains unavailable for Slice 18 and Professional Reviewer remains unassigned |
| 018 Professional Retrieval Gold Dataset Foundation | Reconciled Frozen Spec exists | Planning complete; Audit 1 FINAL PASS | Implement Gate BLOCKED | Not implemented / not merged as a runtime release | No RELEASED production-quality Gold Dataset; real reviewer/qualification/approval prerequisites are missing |
| 019 PG18 / pgvector dense readiness | Frozen/admitted | Planned | PR #110 merged; targeted remediation PR #111 merged | Merged implementation/remediation are remote facts; this Slice does not manufacture a separate Audit 2 verdict | Stage A PG18 + pgvector dense substrate is the current shared retrieval substrate |
| 020 Embedding Provider Adapter Foundation | Frozen Revision 4 admitted to main | Plan AI 2 FINAL PASS; Audit 1 rerun complete | Product implementation NOT AUTHORIZED at current gate | Governance PR #118 remains OPEN; no Slice 20 implementation is merged | Provider remains PROVIDER_NOT_VERIFIED |
| 021 Sparsevec Readiness Spike | Frozen | Planning frozen; Audit 1 complete | Development currently blocked by Slice 20 implementation/Audit 2/merge dependency | No implementation/Audit 2/merge | Candidate A sparsevec/fusion technical result does not yet exist |
| 022 pg_jieba Lexical Readiness Spike | Frozen | Planning frozen; Audit 1 complete | No implementation found; its plan explicitly does not depend on Slice 20 or Slice 21 results | No implementation/Audit 2/merge | Candidate B lexical technical result does not yet exist |

Important consequence:

> Planning readiness, implementation readiness, runtime readiness and production readiness are different facts.

Slice 23 must not use any planning artifact as evidence that a missing runtime result exists.

---

## 4. Selection Gate

### 4.1 Decision criteria

Every candidate was assessed against:

- Authority
- Upstream readiness
- Independent value
- Prematurity
- Duplication
- Product / Professional truth dependency
- Scope size
- Independent testability
- Failure value
- Minimality

### 4.2 Candidate matrix

| Candidate | Authority | Upstream readiness | Independent value / testability | Main risk now | Decision |
|---|---|---|---|---|---|
| A. Professional RAG A/B/C Gold Dataset Evaluation | Explicitly required | LOW: no RELEASED Slice 18 Gold Dataset; A is blocked on 20→21; B has no 22 result; common reranker capability absent | Very high later | Would fabricate readiness or evaluate incomplete candidates | DEFER + CURRENTLY BLOCKED |
| B. RRF / Hybrid fusion evaluation foundation | Required for Candidate B mechanics | LOW/MEDIUM: needs actual dense and lexical outputs; 22 has not executed | Useful later | Candidate-B-specific ranking work before its substrates exist | DEFER |
| C. qwen3-rerank adapter / reranker evaluation readiness | qwen3-rerank is explicit first reranker candidate; provider/model replaceability required | HIGH for technical adapter specification; formal quality evaluation remains blocked by Gold Dataset | HIGH: common downstream capability for A/B/C; technical contract can be tested with synthetic/non-professional fixtures | Scope could accidentally absorb Gold Eval or generic provider gateway | SELECT, NARROWED TO ADAPTER FOUNDATION |
| D. Dense-only Candidate C readiness / evaluation prerequisite | Candidate C is mandatory baseline | LOW/MEDIUM: needs working dense provider path and reranker for a meaningful end-to-end path | Useful later | Would create retrieval/eval scaffolding before 20 and 23 runtime capability | DEFER |
| E. Professional Retrieval Runtime Foundation | Explicit V1 capability | LOW: no approved route, no released Gold evidence, no complete candidate stack | High later | Too broad; would combine hard filters, retrieval, ranking, persistence and route selection | DEFER |
| F. Context Builder | Formal V1 component | LOW for current Phase 3 retrieval execution | High later | Generic context platform before current RAG/model consumer is ready | DEFER |
| G. AI Task Runtime | Formal V1 component | LOW/MEDIUM | High later | Generic AI runtime before bounded task/context/model route is ready | DEFER |
| H. TaskModelRegistry | Formal V1 lightweight component | LOW: evaluated task/model evidence does not yet exist | Medium later | Route table before evidence; risks turning candidate into approval | DEFER |
| I. Promptfoo / Eval Runtime Foundation | Explicit V1 quality tool | LOW/MEDIUM: canonical Gold release and runnable AI/RAG candidates are absent | High later | Tooling platform before canonical consumers/evidence | DEFER |
| J1. Professional Reviewer / qualification authority foundation | Real required dependency | BLOCKED by Authority: reviewer is explicitly UNASSIGNED and Professional Authority cannot be invented by Product/Architecture AI | High if supplied by real authority | Authority laundering / generic reviewer-RBAC invention | BLOCKED — AUTHORITY GAP |
| J2. Generic RAG / provider / model gateway platform | Not required for V1 | N/A | No independent value over concrete needs | Overdesign / duplicate authority | REJECT |
| J3. Second embedding provider path | Already owned by Slice 20 | N/A | None | Duplicate owner | REJECT |

Selection result:

> SELECT 023-reranker-provider-adapter-foundation.

The word “evaluation” is intentionally excluded from the Slice name because formal reranker quality evaluation requires the RELEASED Gold Dataset and belongs downstream. Slice 23 only creates the technical capability seam and evidence needed so that later Gold evaluation can run without inventing provider behavior.

---

## 5. Purpose

One sentence:

> Slice 23 establishes the minimum provider-replaceable reranker capability contract and truthful technical verification boundary needed before the same reranker stage can be used by Professional RAG candidates A, B and C.

It does not decide whether qwen3-rerank is good enough.

---

## 6. Problem Statement / Why Now

The Phase 3 chain has already separated several truths:

- Slice 18 owns how retrieval quality is judged.
- Slice 19 owns dense pgvector substrate readiness.
- Slice 20 owns embedding provider capability.
- Slice 21 owns Candidate-A sparsevec technical feasibility.
- Slice 22 owns Candidate-B lexical technical feasibility.

All three Authority-defined retrieval candidates converge on a reranker before Top Context.

At present, no reranker runtime owner or normalized reranker provider capability exists on current main. If the project waits until the full A/B/C evaluator is built to define the reranker boundary, the evaluator would be forced to invent provider parsing, model/config semantics, item identity mapping, error behavior and evidence semantics inside evaluation code. That would mix provider truth with evaluation truth.

Conversely, building a full retrieval runtime or full Gold evaluation now is premature because required upstream runtime facts do not exist.

The minimum independent gap is therefore:

> establish the reranker provider capability seam now; leave relevance quality, route choice and production approval to the later Gold evaluation.

A technical FAIL, BLOCKED or UNVERIFIED result is still useful: it tells the project whether the first reranker candidate can be called and normalized under a truthful contract without changing Professional truth or selecting a route.

---

## 7. Scope

### 7.1 In Scope

Slice 23 owns only:

1. one capability-specific reranker provider port/contract;
2. one concrete adapter/readiness path for the Authority-named first candidate qwen3-rerank;
3. explicit configured provider/model/version provenance;
4. bounded request and response semantics for reranking a query against a finite candidate set;
5. exact preservation of caller-owned candidate identity across provider request and normalized result;
6. strict validation of missing, duplicate, unknown or ambiguous result items;
7. finite score / ranking result validation without treating scores as Professional truth;
8. normalized provider failure semantics;
9. bounded timeout/retry behavior and no silent cross-provider fallback;
10. safe telemetry/cost/usage evidence where actually available, without inventing unavailable provider facts;
11. offline contract verification using synthetic or clearly non-professional/non-personal fixtures;
12. optional controlled real-provider technical verification that remains distinct from offline/mock evidence;
13. exact-head/config/provider/model evidence sufficient for later independent Audit 2;
14. negative scope guards proving that this Slice did not become retrieval, Gold Eval or a generic provider platform.

### 7.2 Out of Scope

Slice 23 MUST NOT implement, own, approve or infer:

- Gold Dataset authoring, professional labels, rubrics or reviewer approval;
- Slice 18 RELEASED dataset creation;
- Recall@K, nDCG@K, MRR or production winner thresholds;
- formal qwen3-rerank quality approval;
- embedding evaluation or a second embedding adapter;
- dense retrieval;
- sparsevec retrieval;
- pg_jieba;
- RRF;
- Candidate-A fusion policy;
- Candidate A/B/C end-to-end execution;
- hard-filter production retrieval;
- chunking or ingestion;
- knowledge_embeddings / knowledge_chunks persistence;
- retrieval cache;
- database migration or persistent reranker tables;
- rag_route_version selection;
- rerank_route_version production activation;
- production model approval;
- TaskModelRegistry;
- Context Builder;
- AI Task Runtime;
- ai_runs;
- Promptfoo framework;
- Jev / bounded decision runtime;
- Vercel AI SDK generic gateway work;
- generic provider/model gateway;
- automatic multi-provider fallback;
- user-facing AI behavior;
- Professional Reviewer / qualification / approval authority;
- Legal Authority;
- Production Enablement.

---

## 8. Truth Ownership

### 8.1 Slice 23 owns

Only technical reranker capability truth, such as:

- whether a configured reranker provider request is contract-valid;
- whether provider response can be normalized without identity loss;
- whether all required candidate results are present and unambiguous;
- what exact configured provider/model/version was tested;
- whether technical provider verification was actually performed;
- whether the tested capability is VERIFIED / FAILED / BLOCKED / UNKNOWN / NOT_EVALUATED under the eventual Plan-defined evidence vocabulary.

The exact state names may be refined by Plan AI 2, but missing or non-live evidence can never be promoted to a live-provider success.

### 8.2 Slice 23 consumes but does not own

- Professional Knowledge truth — Slice 17;
- Professional Gold Dataset truth — Slice 18;
- dense pgvector substrate truth — Slice 19;
- embedding provider truth — Slice 20;
- Candidate-A sparsevec Spike truth — Slice 21;
- Candidate-B pg_jieba lexical Spike truth — Slice 22;
- Authorization / Consent / Compliance / Safety truth — their existing owners;
- future retrieval candidate sets and hard-filtered candidate identity — future retrieval owner;
- future model route approval — TaskModelRegistry / release-evidence owner.

### 8.3 Forbidden implications

The following are invalid:

~~~text
reranker technical provider verification PASS
=> qwen3-rerank is production approved

reranker technical provider verification PASS
=> Candidate A/B/C quality PASS

reranker technical provider verification PASS
=> Gold Dataset release exists

reranker technical provider verification PASS
=> rag_route_version selected

mock/fixture contract PASS
=> live provider verified
~~~

---

## 9. Dependencies

### 9.1 Planning Dependencies

Plan AI 2 may plan Slice 23 using:

- the four current Authority Docs;
- this Frozen Spec;
- Slice 18 Frozen Gold Dataset contract as the downstream evaluation boundary;
- Slice 19–22 boundaries so ownership is not duplicated;
- current repository governance rules;
- current official provider contract documentation/evidence needed to make implementation unambiguous.

Planning does NOT require:

- Slice 18 implementation;
- a RELEASED Gold Dataset;
- Slice 20 implementation result;
- Slice 21 execution result;
- Slice 22 execution result;
- a real Professional Reviewer;
- a production RAG route.

Therefore Slice 21/22 may remain unexecuted while Slice 23 Planning proceeds.

### 9.2 Implementation Dependencies

Plan completion alone does not authorize implementation.

Before Developer AI may modify product/runtime paths, all of the following must be true:

1. Plan / Checklist / Tasks are frozen by Plan AI 2.
2. Audit 1 is FINAL PASS.
3. current main and this Frozen Spec exact blob are re-read.
4. no competing Slice 23 implementation or owner exists.
5. the provider contract required for the selected implementation mode is verified sufficiently to avoid guessing endpoint, request shape, response mapping or model identity semantics.
6. any production implementation path is covered by exact repository implementation ownership.
7. because current registry policy is “Unknown production paths fail closed; registry changes are governance-sensitive and may not ride with product implementation”, any new ownership registration required for Slice 23 must be a separate governance prerequisite, independently audited and merged before product implementation.
8. no implementation requires modifying Slice 17–22 ownership to make the Slice pass.
9. no real family/minor/private content is required for technical verification.
10. credentials / provider availability, if required for live technical verification, are provided through an approved secret/egress path. Their absence yields BLOCKED / UNVERIFIED evidence, never a fake success.

Slice 20 implementation is NOT a semantic prerequisite for defining or implementing the reranker-specific capability. However:

> Slice 23 must not create a second generic provider abstraction or a second embedding provider path.

If a capability-neutral provider egress/security/telemetry primitive has actually landed by implementation time, Plan AI 2 must evaluate reuse. If none exists, Slice 23 may own only the minimum reranker-specific seam, not a generic provider platform.

Slice 21 and Slice 22 execution results are NOT implementation prerequisites for this technical adapter foundation.

### 9.3 Production Dependencies

Slice 23 alone can never make Professional RAG production-ready.

Production use of a reranker requires, at minimum:

- representative eligible PUBLISHED Professional Knowledge;
- real Professional Authority for the Gold labels/rubrics;
- a RELEASED/current/valid Slice 18 Gold Dataset;
- actual runnable retrieval candidate(s);
- Slice 20 embedding capability for routes that require it;
- Slice 21 result for Candidate A if A remains a candidate;
- Slice 22 result for Candidate B if B remains a candidate;
- Candidate C dense-only baseline retained for comparison;
- A/B/C evaluation on the same exact Gold Dataset/corpus;
- formal reranker quality evaluation on that same evidence;
- pinned production provider/model/version;
- approved rerank_route_version / rag_route_version;
- TaskModelRegistry/release evidence when those production owners exist;
- applicable external data, legal, compliance, safety and production release gates.

---

## 10. Domain / Technical Invariants

Only invariants relevant to this Slice are frozen:

1. Fail closed. Missing, malformed, ambiguous, partial, stale or unavailable provider evidence cannot become PASS.
2. No floating production model identity. “latest” or equivalent silent-moving aliases cannot be production approval evidence.
3. Candidate identity is caller-owned. Reranking may reorder candidates; it may not invent, drop, merge or silently duplicate candidate identity.
4. Provider score is not Professional truth.
5. Reranker output is not a Domain Command and has no business write authority.
6. Reranker technical verification does not bypass Authorization, Consent, Compliance, Safety, lifecycle or hard filters.
7. Hard filtering remains upstream of production reranking as required by Professional RAG authority.
8. No fake Professional Authority. AI, Developer, fixture, model or Promptfoo judge cannot approve professional labels.
9. No provider lock-in in downstream contracts. Provider-specific raw shapes do not leak beyond the adapter seam.
10. No silent fallback to another provider/model when the configured candidate fails.
11. No secret or raw provider credential in repository/evidence/logs.
12. No real family/minor/private data is required to verify this Slice.
13. Evidence is exact-head and exact-config scoped. Success on one model/config/endpoint contract does not imply another.
14. No persistence is introduced solely to support reranker readiness.
15. No generic gateway/framework is created by this Slice.

---

## 11. Functional Requirements

FR-001 — Capability-specific port  
A downstream caller must be able to request reranking through one reranker capability contract without depending on provider-native response shapes.

FR-002 — First candidate boundary  
The first concrete provider/model candidate is qwen3-rerank because current V1 Authority names it. This is candidate status only, not production approval.

FR-003 — Explicit input identity  
Every candidate presented to the reranker must carry a unique caller-owned identity. Empty or duplicate candidate identities fail before a result can be accepted.

FR-004 — Identity preservation  
Normalized results must map only to the exact input candidate set. Unknown, missing or duplicated result identity cannot be guessed or silently repaired.

FR-005 — Exact model/config provenance  
Provider, configured model identifier/version/revision and other authority-significant request configuration must be explicit in evidence. Production approval must never rely on a floating model alias.

FR-006 — Strict response validation  
A provider response is successful only when its required result structure can be parsed under a verified provider contract. Unknown or ambiguous shapes fail closed; no recursive “find something that looks like scores” parser is allowed.

FR-007 — Finite scoring  
Accepted numeric scores must be finite. Missing, NaN, infinite or otherwise invalid score values cannot be replaced with zero or an inferred value.

FR-008 — Order semantics  
If normalized output exposes an order, that order must be deterministically linked to exact input identities. Tie behavior must be explicit enough for tests; it cannot be represented as professional relevance truth.

FR-009 — Partial response handling  
A partial result is not silently accepted as a complete rerank. The Plan must freeze whether the provider contract permits any partial mode; absent explicit Authority/contract support, partial completion fails closed.

FR-010 — Error normalization  
Provider authentication, authorization, rate-limit, timeout, unavailable, malformed-response and unsupported-capability failures must remain distinguishable enough for a caller/evidence consumer to act correctly.

FR-011 — Bounded retry  
Retries, if allowed by the provider contract, must be bounded. Retry must not create duplicate business effects and must not switch providers/models silently.

FR-012 — No persistence  
The reranker capability is stateless with respect to business truth. Slice 23 does not create database tables, migrations, knowledge persistence or long-lived rerank state.

FR-013 — Safe technical fixture  
Offline and live technical verification must use synthetic or clearly permitted non-personal/non-family content that does not require a new professional judgment.

FR-014 — Offline/live evidence separation  
Mock, fixture or fake transport tests may prove contract mechanics only. They cannot produce a “live provider verified” claim.

FR-015 — Live evidence truthfulness  
If controlled live-provider verification is attempted, the evidence must bind the exact head, provider, model/config, request mode, observed contract and result. If it cannot be attempted, the state remains BLOCKED / NOT_EVALUATED / equivalent — never PASS.

FR-016 — No Gold quality claim  
No result in this Slice may claim Recall, nDCG, MRR, rerank delta, professional correctness, route winner or production quality.

FR-017 — No route activation  
Slice 23 does not register or activate a production rag_route_version or rerank_route_version.

FR-018 — No duplicate provider foundation  
Slice 23 cannot implement another embedding provider path and cannot create a generic provider gateway to “share” future capabilities.

FR-019 — Controlled observability  
Telemetry/cost/usage fields may record only facts actually available from the provider/runtime. Unknown cost/usage remains unknown. Logs/evidence must exclude secrets and unnecessary raw content.

FR-020 — Failure has value  
A reproducible incompatibility or provider-contract failure is a valid technical conclusion. The Developer must not widen scope, tune relevance, change model, add fallback or relax validation merely to make the Slice pass.

---

## 12. Acceptance Scenarios

AS-01 — Offline contract success  
Given a fixed synthetic query and finite candidate set, a provider-contract fixture returns one valid result per exact candidate identity. The normalized result preserves all identities, accepted scores and deterministic ordering. Result: contract mechanics may PASS; live provider verification remains NOT_EVALUATED unless separately executed.

AS-02 — Controlled live technical verification  
Given an approved credential/egress path and pinned candidate configuration, a real qwen3-rerank call satisfies the frozen provider contract and maps all candidates exactly. Result: live technical capability may be verified for that exact evidence tuple only. No Gold or production quality claim follows.

AS-03 — Candidate missing from provider result  
Input has N unique candidates; accepted provider result omits one required candidate. Result: fail closed; no inferred score/order.

AS-04 — Unknown or duplicate provider item  
Provider output contains an identity/index that cannot map uniquely to one input candidate. Result: fail closed.

AS-05 — Malformed or ambiguous response  
The response does not match the verified contract, or two incompatible shapes make normalization ambiguous. Result: fail closed; no precedence guess.

AS-06 — Invalid numeric result  
A required score is missing, NaN, infinite or non-numeric. Result: fail closed.

AS-07 — Unpinned / missing configuration  
The required provider/model/version configuration cannot be resolved exactly enough for evidence. Result: BLOCKED/UNVERIFIED, not READY.

AS-08 — Provider unavailable  
Credential, endpoint or provider service is unavailable. Result: BLOCKED/UNVERIFIED with explicit reason; no fallback model/provider.

AS-09 — Mock evidence laundering  
All fixture tests pass but no live provider call exists. Result: contract mechanics may pass; provider verification must remain unverified.

AS-10 — Gold authority missing  
Reranker technical capability verifies successfully while Slice 18 still has no RELEASED Gold Dataset. Result: Slice 23 can complete technically, but reranker quality/production approval remains blocked.

AS-11 — Professional truth laundering attempt  
An implementation attempts to label qwen3-rerank “professionally correct”, approve Gold labels, or infer a route winner from technical fixtures. Result: scope violation and failure.

AS-12 — Retrieval scope creep  
An implementation introduces dense retrieval, sparsevec, pg_jieba, RRF, fusion tuning, hard-filter runtime or A/B/C evaluator code. Result: scope violation.

AS-13 — Persistence scope creep  
An implementation adds a migration/table/cache to persist reranker readiness/results solely for this Slice. Result: scope violation unless a later formal Authority explicitly creates a separate owner.

AS-14 — Generic provider platform scope creep  
An implementation creates a generic Model Gateway/provider registry/automatic fallback framework. Result: scope violation.

AS-15 — Exact-head evidence  
A final technical claim is backed by evidence from a different code head/config/model than the implementation being audited. Result: evidence invalid; cannot PASS.

---

## 13. Explicit Non-Goals

To prevent later scope expansion, Slice 23 is explicitly NOT:

- “Professional RAG Foundation”
- “RAG Runtime”
- “Reranker Eval”
- “A/B/C Eval”
- “RRF/Fusion”
- “Dense Candidate C”
- “Model Registry”
- “AI Gateway”
- “AI Runtime”
- “Promptfoo Platform”
- “Professional Reviewer System”
- “Knowledge Store”
- “Vector Store”
- “Context Platform”

It is one capability-specific provider boundary.

---

## 14. Clarify Record

### Q01 — Can Slice 23 be the full A/B/C Gold Dataset Eval?

Evidence:
- Slice 18 planning gate records no representative production-approved Knowledge corpus and no approved Professional Reviewer/qualification/approval provider.
- Slice 18 implementation/release is therefore blocked.
- Slice 20 product implementation is not yet authorized.
- Slice 21 is blocked on Slice 20.
- Slice 22 is planned but not executed.
- no reranker capability exists.

Decision:
NO.

Why:
Full evaluation would require facts that do not exist.

Frozen consequence:
A/B/C full Eval is DEFERRED and currently BLOCKED. No fake Gold labels, candidate outputs or scores may be created.

### Q02 — Does Slice 23 need Slice 21 or Slice 22 execution results?

Evidence:
A, B and C all use the reranker after their own candidate-generation mechanics.

Decision:
NO for adapter specification/technical capability.

Why:
Reranker provider normalization can be verified independently of how candidate IDs were generated.

Frozen consequence:
Slice 23 planning/implementation may proceed without importing or fabricating Slice 21/22 results. Production A/B/C evaluation still needs the relevant candidate results.

### Q03 — Is formal reranker quality evaluation part of Slice 23?

Evidence:
Authority binds production rerank route/model approval to Gold Dataset evidence; Slice 18 owns that evaluation truth.

Decision:
NO.

Why:
Combining adapter verification with Gold quality evaluation would merge provider truth and professional evaluation truth.

Frozen consequence:
Slice 23 ends at technical capability evidence. Quality/winner/threshold decisions remain downstream.

### Q04 — Does naming qwen3-rerank mean the model is production-selected?

Evidence:
V1 Authority calls it the first reranker candidate and separately requires Gold evaluation and pinned production versions.

Decision:
NO.

Why:
Candidate != approved route.

Frozen consequence:
No production route/model approval may be emitted by this Slice.

### Q05 — May Slice 23 create a generic provider gateway so embedding and reranking share infrastructure?

Evidence:
V1 explicitly uses lightweight capability-specific adapters/TaskModelRegistry and defers a generic Gateway until real cross-provider complexity exists.

Decision:
NO.

Why:
That would be premature framework construction.

Frozen consequence:
Only a minimal reranker-specific seam is permitted. Reuse already-landed neutral primitives when they genuinely exist; do not build them speculatively.

### Q06 — Is Slice 20 a hard runtime dependency for Slice 23?

Evidence:
Slice 20 owns embedding provider semantics, not reranker semantics. Both are separate model capabilities.

Decision:
NO as a semantic prerequisite.

Why:
Making reranker capability wait for embedding implementation would be unnecessary serial coupling. Conversely, duplicating Slice 20's embedding path would be invalid.

Frozen consequence:
The two Slices may progress independently, but Slice 23 cannot duplicate embedding ownership or invent a generic shared gateway.

### Q07 — Does technical reranker verification require a real Professional Reviewer?

Evidence:
Professional Authority is required for professional labels/rubrics and production professional content, not for verifying that a provider API returns a structurally valid rerank response on synthetic/non-professional text.

Decision:
NO for technical adapter verification; YES later for released professional Gold evidence.

Why:
This preserves the authority boundary without blocking unrelated provider mechanics.

Frozen consequence:
Technical fixtures must not contain self-created professional labels. Production quality evaluation remains blocked until authentic Professional Authority exists.

### Q08 — May reranker output create business/professional truth?

Evidence:
Four Authority Docs prohibit model output from independently creating product/professional truth.

Decision:
NO.

Frozen consequence:
Reranker output is ranking evidence only and has no Domain Command, Fact, Consent, Safety, Plan or Professional Approval write authority.

### Q09 — Should Slice 23 persist rerank results or readiness?

Evidence:
No Authority requires a persistent reranker readiness store; V1 favors minimal infrastructure.

Decision:
NO.

Frozen consequence:
No migration/table/cache/second knowledge store is authorized.

### Q10 — Does the current repository already own a reranker production path?

Evidence:
Current implementation ownership registry contains no reranker owner, and repository search found no reranker runtime implementation.

Decision:
NO.

Why:
Unknown production paths fail closed under current governance.

Frozen consequence:
Plan AI 2 must classify the smallest implementation seam. If new production ownership is needed, it must be registered in a separate governance prerequisite before Developer code.

### Q11 — Can real family/minor data be used for provider verification because the final product will eventually process it?

Evidence:
V1 external Eval/provider data boundaries require purpose approval; technical adapter correctness does not require real household data.

Decision:
NO.

Frozen consequence:
Slice 23 technical verification uses synthetic or clearly permitted non-personal content. Real-family processing is a production gate, not a Slice 23 shortcut.

### Q12 — What happens if qwen3-rerank is unavailable or incompatible?

Evidence:
V1 requires truthful UNKNOWN/BLOCKED/FAIL states and forbids silent fallback.

Decision:
Record the terminal technical fact; do not widen scope.

Frozen consequence:
A reproducible FAIL or truthful BLOCKED result can still complete the technical investigation for Audit 2. It does not authorize swapping models, adding a gateway or changing Gold truth inside Slice 23.

Authority conflict after clarification:
NONE.

Open Product Decisions after clarification:
NONE.

The unresolved Professional Reviewer assignment is an external Professional Authority dependency, not an Open Product Decision.

---

## 15. Implementation Gate

Planning Freeze is not Development Authorization.

The implementation gate is OPEN only after all implementation dependencies in §9.2 are satisfied.

At this Spec freeze:

~~~text
Spec Gate:
PASS subject to remote freeze read-back

Planning Gate:
NOT STARTED — next role is Plan AI 2

Implementation Gate:
BLOCKED BY PROCESS until Plan AI 2 + Audit 1
and by any governance prerequisite identified for the production seam

Gold / Production Reranker Eval Gate:
BLOCKED — no RELEASED Gold Dataset / Professional Reviewer authority
~~~

The blocked production evaluation state does not block Plan AI 2 from planning this technical adapter foundation.

---

## 16. Exit Criteria

### 16.1 Spec complete

Only when:

- Selection Gate is frozen;
- Clarify questions are frozen;
- one Slice responsibility exists;
- current remote branch/file are read back;
- exact Frozen Spec head/blob are recorded externally;
- no Plan/Checklist/Tasks artifact exists on the spec branch.

### 16.2 Planning complete

Requires later:

- Plan AI 2 Plan;
- Checklist;
- Tasks;
- complete Audit 1;
- Planning Freeze exact head/blobs.

Planning complete does not imply implementation may start.

### 16.3 Implementation complete

Requires later:

- implementation stays within the Frozen Spec;
- required governance prerequisite is merged first;
- contract/adversarial tests pass;
- any claimed live-provider evidence is truthful and exact-head bound;
- no forbidden scope is introduced;
- Developer stops for independent Audit 2;
- independent Audit 2 PASS is obtained before merge.

A technical FAIL/BLOCKED provider result may still be an honestly completed experiment if the implementation/evidence contract itself is complete and independently audited. It is not a readiness PASS.

### 16.4 Production ready

Not achievable by Slice 23 alone.

Production readiness requires the downstream dependencies in §9.3, including real Professional Authority, RELEASED Gold Dataset evidence, same-dataset A/B/C comparison, reranker quality evidence, pinned routes/models and all release gates.

---

## 17. Final Quality Gate

Authority:
- no Authority Doc changed;
- no new product requirement invented;
- qwen3-rerank remains candidate, not approved truth.

Scope:
- one capability-specific owner;
- no retrieval platform;
- no generic model/provider platform.

Dependency:
- Planning / Implementation / Production dependencies are separate;
- Slice 21/22 runtime results are not falsely required for planning;
- Gold/professional dependencies are not falsely declared ready.

Professional Truth:
- no fake reviewer;
- no fake Gold labels;
- no model/AI self-approval.

Architecture:
- no duplicate embedding owner;
- no duplicate Knowledge store;
- no second vector database;
- no generic Gateway;
- no TaskModelRegistry/Context/AI Runtime expansion.

Executability:
- Plan AI 2 has a bounded responsibility, explicit ownership boundary, functional requirements, negative cases, dependencies and implementation gate;
- implementation-specific file layout and task sequencing are intentionally left to Plan AI 2.

---

## 18. Plan AI 1 Freeze Decision

~~~text
SELECT:
023-reranker-provider-adapter-foundation

DEFER:
Professional RAG A/B/C Gold Dataset Evaluation
RRF / hybrid fusion evaluation foundation
Dense-only Candidate C readiness/evaluation prerequisite
Professional Retrieval Runtime Foundation
Context Builder
AI Task Runtime
TaskModelRegistry
Promptfoo / Eval Runtime Foundation

BLOCKED:
Full A/B/C Gold Dataset Eval — current upstream runtime/evaluation truth missing
Professional Reviewer / qualification authority creation — AUTHORITY GAP / external Professional Authority required

REJECT:
Generic RAG platform
Generic provider/model gateway
Second embedding provider path
Any duplicate Knowledge/vector/eval authority
~~~

Plan AI 1 decision:

> FINAL PASS if and only if remote read-back confirms this branch contains exactly this Frozen Spec at one stable exact head/blob.

Next authorized role after successful remote freeze:

> Plan AI 2.

STOP after Frozen Spec.
