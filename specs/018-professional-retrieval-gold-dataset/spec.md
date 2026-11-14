# Slice 18 — Professional Retrieval Gold Dataset Foundation

> Repository: pyxm1618/xiaoshuyin
>
> Slice: 018
>
> V1 Phase: Phase 3 — Professional Knowledge & AI
>
> Role boundary: Plan AI 1 only
>
> Status: Selection + Specify + Clarify FINAL PASS — FROZEN SPEC after exact remote commit/blob read-back
>
> Scope of this artifact: Selection Gate → Specify → Clarify → Frozen Spec only
>
> Forbidden in this artifact: Plan / Checklist / Tasks / Audit 1 / implementation / migration / production code / test implementation / PR merge
>
> Selected capability: Professional Retrieval Gold Dataset Foundation
>
> Spec branch: spec/018-professional-retrieval-gold-dataset

This specification freezes the minimum evaluation truth required before Xiaoshuyin builds or selects a Professional RAG retrieval implementation. It does not implement retrieval, pgvector, sparsevec, pg_jieba, embedding, reranking, Promptfoo, AI Task Runtime, model execution, or any user-facing AI feature.

The core rule is:

> Measure first, then build and select retrieval technology.

The Gold Dataset is experimental/evaluation authority only. It never becomes Family, Case, Evidence, Problem Formulation, Intervention, Knowledge, Authorization, Consent, Compliance, Safety, Scene Package, Plan, Task, Review, Outcome, or model authority.

---

## 1. Authority Baseline

Authority hierarchy:

1. Docs/总产品需求.md — long-term product truth;
2. Docs/V1产品需求.md — V1 product truth;
3. Docs/总体技术架构.md — long-lived architecture truth;
4. Docs/V1技术设计.md — V1 implementation contract.

Current remote baseline re-read during Selection:

~~~text
Repository:
pyxm1618/xiaoshuyin

Current origin/main:
e7bb22d1abad58a6c9df6350744f092d88370aa3
~~~

The baseline changed during this Plan AI 1 run because PR #37 was merged after the initial read. This Spec is intentionally bound to the later exact main, not to the stale handoff SHA.

Authority Doc blobs on the final baseline:

~~~text
Docs/总产品需求.md
67724000cb9bb81c40489c04db28d899bd1df74c

Docs/V1产品需求.md
1900485a407e0634643f4f0bbe5ab02476dc4bfd

Docs/总体技术架构.md
9b08371edc976fa281469dfee8dc19962452e3b0

Docs/V1技术设计.md
6f03d1a3c49bdc866945ae7f82df542f1292a147
~~~

Relevant formal Authority includes:

- professional knowledge must be maintainable/versioned rather than permanently hard-coded;
- AI/model output is not product truth;
- Professional Knowledge and Family Memory are distinct;
- V1 retrieval candidates A/B/C must be compared on the same Xiaoshuyin Gold Dataset;
- production embedding/reranker route versions must bind to Gold Dataset evidence and pinned model versions;
- evaluation suites have explicit suite_version, case_id, requirement ids, scenario, fixture, expected/forbidden behavior, review owner, result and evidence reference;
- deterministic authorization, lifecycle, hard-filter, safety and compliance rules remain authoritative regardless of retrieval score;
- production retrieval cannot use unpublished/retired/inapplicable content merely because a model scores it highly.

This Spec does not amend any Authority Doc.

---

## 2. Repository Reality Check

### 2.1 Current main

Current main contains Slice 1–12 runtime plus the narrow Authorization owner remediation merged through PR #37.

PR #37:

~~~text
Title:
fix(auth): add narrow child Contract-confirmation owner seam

Merged:
YES

Merge commit:
e7bb22d1abad58a6c9df6350744f092d88370aa3
~~~

The remediation does not implement Slice 14.

### 2.2 Current PostgreSQL baseline

Current CI already uses PostgreSQL 18 for database migration/integration jobs.

Therefore Slice 18 must not mislabel a PostgreSQL major-version upgrade as missing Phase 3 work.

Current package/runtime dependency inventory does not establish a production Professional RAG implementation, provider execution layer, Promptfoo runtime, or Knowledge retrieval store on main.

### 2.3 Slice 13–17 state

Planning artifacts are not runtime.

| Slice | Frozen / planning authority | Current runtime reality relevant to Slice 18 |
|---|---|---|
| 13 — Digital Use Family Alliance Runtime | Frozen Spec + Plan/Audit 1 exist | feature branch exists; current head 35477b700dbad36f17e0cf390485e04e3f827abe; not merged; after PR #37 merge it is 4 commits behind main |
| 14 — Digital Use Phone Use Contract Runtime | Frozen Spec + Plan/Audit 1 exist | no Slice 14 feature runtime branch found; narrow Authorization owner seam is now merged through PR #37; Slice 14 runtime itself is not merged |
| 15 — Digital Use Review Runtime | Frozen Spec + Plan/Audit 1 FINAL PASS | no runtime implementation on main |
| 16 — Psychological / Behavioral Intervention Contract Foundation | Frozen Spec 05aa4594cbb99c433035f9fa313376a7fec99785 / blob a6cd9fd723f9339b575757279703be554afaf0f6; planning freeze 40d6c4e19b9207b287aec03c5ba02868260dd8fe | runtime not merged; Implement Gate remains dependent on Slice 12–15 plus real professional review authority |
| 17 — Professional Knowledge Foundation | Frozen Spec a345937868ca1b8d2cef65003d4197de4207eb52 / blob 866c3f77dd269c94d420d9c0ae6b918f114286ce; planning freeze a1d4e4390d313502696493573243adf401dbae90 | runtime not implemented/merged; Implement Gate BLOCKED |

### 2.4 Slice 17 authority convergence

Remote branch truth was re-read.

~~~text
spec/017-professional-knowledge-foundation
  spec.md       PRESENT
  plan.md       ABSENT
  checklist.md  ABSENT
  tasks.md      ABSENT

plan/017-professional-knowledge-foundation
  spec.md       PRESENT
  plan.md       PRESENT
  checklist.md  PRESENT
  tasks.md      PRESENT
~~~

Exact Slice 17 Frozen Spec blob remains:

~~~text
866c3f77dd269c94d420d9c0ae6b918f114286ce
~~~

The spec branch head is the authority-convergence commit:

~~~text
22e69a546e00a37b6bf26fb3e28b10e18fd6f024
chore(slice17): retire non-authoritative tasks from spec branch
~~~

The authoritative Plan branch head remains:

~~~text
a1d4e4390d313502696493573243adf401dbae90
plan(slice17): finalize Audit 1 and planning freeze
~~~

Slice 17 competing planning authority is therefore retired. PASS.

### 2.5 Existing Slice 18 authority

Immediately before branch creation, remote search found:

~~~text
spec/018-*  NONE
plan/018-*  NONE
feat/018-*  NONE
~~~

No competing Slice 18 authority existed.

---

## 3. Problem / Why Now

Phase 3 now has two frozen professional truth contracts:

1. Slice 16 defines reviewed/published InterventionDefinition truth and deterministic intervention eligibility;
2. Slice 17 defines reviewed/published Professional Knowledge truth and exact package/version knowledge eligibility.

The next technical choices include pgvector, dense+sparse, pg_jieba, embedding, reranking and A/B/C retrieval.

Those choices must not be made by preference, vendor marketing, framework convenience, or a single hand-picked query.

Formal Authority requires the A/B/C candidates and embedding/reranker choices to be compared on a common Xiaoshuyin Gold Dataset.

If retrieval infrastructure is implemented before the benchmark truth is frozen, the project risks:

- selecting technology without an agreed definition of retrieval quality;
- changing evaluation examples after seeing candidate results;
- testing only happy-path semantic similarity while ignoring hard-filter leakage;
- allowing a retrieval score to hide a lifecycle/age/stage/exclusion violation;
- turning one model/provider result into de facto authority;
- duplicating Professional Knowledge in ad-hoc test fixtures;
- coupling later model routes to unversioned or floating evaluation evidence.

Therefore the next minimal upstream capability is not retrieval infrastructure.

It is the versioned, reviewable, exact-reference Professional Retrieval Gold Dataset that later retrieval implementations must consume.

---

## 4. Selection Gate

The candidate list was re-evaluated against current remote truth, the four Authority Docs, and Frozen Slices 13–17.

| Candidate | Authority / truth | Dependency / independent value | Premature / duplicate risk | Decision |
|---|---|---|---|---|
| 1. PostgreSQL 18 / pgvector bootstrap readiness | PostgreSQL 18 and pgvector are formal V1 technical requirements; readiness is technical evidence, not business truth | PostgreSQL 18 is already the CI baseline; pgvector can be tested independently | Building extension/runtime now would precede a frozen retrieval benchmark and real Knowledge runtime | DEFER |
| 2. dense+sparse readiness Spike | Explicitly required before candidate A may be READY | Useful feasibility experiment, but meaningful correctness evidence needs agreed professional Chinese benchmark cases and target corpus | Risk of optimizing a provider path before benchmark truth exists | DEFER |
| 3. lexical / pg_jieba readiness | Explicit candidate B prerequisite | Can be tested independently | It is a comparison path, not the benchmark authority; no reason to privilege it before the common dataset | DEFER |
| 4. Professional RAG retrieval foundation | Explicit V1 capability | Depends on published Knowledge, benchmark, selected route/readiness | Too broad; would combine store, filters, retrieval and ranking | DEFER |
| 5a. Professional Retrieval Gold Dataset Foundation | Explicitly required by §11/§32 and by embedding/reranker release evidence; creates evaluation truth only | Independently valuable: freezes how future retrieval quality is judged without running RAG | Low infrastructure risk; no duplicate business owner if it references exact Knowledge versions | **SELECT** |
| 5b. RAG A/B/C Gold Dataset execution | Explicitly required | Requires 5a plus actual candidates/readiness and authoritative corpus | Execution would be premature now | DEFER |
| 6. embedding / reranker Eval | Explicitly required | Requires Gold Dataset and provider adapters | Premature before benchmark and corpus | DEFER |
| 7. Context Builder | Formal V1 component | Requires purpose-bound current domain state plus authorized Memory/RAG inputs | Would be generic composition infrastructure without current retrieval consumer | DEFER |
| 8. AI Task Runtime | Formal V1 component | Needs bounded real task, Context, release rules and model route | Generic infrastructure risk if built before concrete tasks | DEFER |
| 9. TaskModelRegistry | Formal V1 component | Requires bounded task roles and actual evaluated model evidence | No independent product truth; route table before evidence is premature | DEFER |
| 10. provider adapter / Vercel AI SDK execution | Formal V1 implementation layer | Needs concrete task/model route | Provider infrastructure is not the next truth owner | DEFER |
| 11. bounded decision / Jev Shadow | Formal evaluation path | Requires task-specific gold labels and deterministic reference behavior | No bounded Phase 3 candidate is ready to shadow | DEFER |
| 12. Promptfoo / AI Eval foundation | Formal tool choice | Later consumes Gold Dataset and runnable candidates | Installing an eval platform before its canonical dataset/candidates adds tooling without evidence | DEFER |
| 13. Problem Formulation AI | V1 AI feature | Requires AI runtime/context/model/release contracts; cannot own Formulation | Downstream and high authority-leak risk | DEFER |
| 14. A4003 roleplay AI | V1 AI feature | Requires Slice 14 runtime plus adult/guardian Compliance gate and AI execution | Downstream; Slice 14 runtime not merged | DEFER |
| 15. execution-support AI | V1 AI feature | Requires authentic execution truth plus AI runtime/context | Downstream; must not invent Phase 4 facts | DEFER |
| 16. other Phase 3 prerequisite | The formal docs require a common, versioned Gold Dataset before model/retrieval release evidence can be meaningful | This is the split-out 5a selected above | It reduces rather than adds premature infrastructure | SELECTED AS 5a |

Selection result:

> **Slice 18 = Professional Retrieval Gold Dataset Foundation.**

The selected responsibility is intentionally narrower than “RAG Eval” and narrower than “AI Eval Foundation”.

---

## 5. Selected Slice Definition

Slice 18 creates one new kind of truth:

> **versioned professional-retrieval evaluation cases and labels used to judge later retrieval candidates against an exact authoritative professional corpus.**

A Gold Dataset case answers questions such as:

- for this professionally authored Chinese query, which exact published Knowledge versions are relevant;
- which exact Knowledge versions must not be returned;
- which hard filters must be satisfied before scoring;
- when the correct expected retrieval set is empty;
- which terminology/negation/exclusion distinction the future retrieval system must preserve.

It does not answer:

- whether a family fact is true;
- whether an Intervention is eligible;
- whether a Case should progress;
- whether a user is authorized;
- whether Consent exists;
- whether Safety is clear;
- whether Compliance allows the feature;
- which RAG architecture wins;
- which model is production-approved.

---

## 6. Goals

Slice 18 SHALL:

1. define one canonical Professional Retrieval Gold Dataset schema;
2. define exact dataset-version and manifest-hash identity;
3. bind each released evaluation case to an exact authoritative corpus manifest;
4. reference exact Slice 17 Knowledge Item ids + versions rather than floating “latest” knowledge;
5. represent graded relevant results and explicit forbidden results;
6. represent hard-filter expectations separately from relevance scoring;
7. cover Chinese professional terminology, paraphrase, negation, exclusions and truthful no-result cases;
8. make lifecycle/status/version/scene/stage/age/development hard-filter leakage mechanically detectable;
9. distinguish benchmark labels from Professional Knowledge truth;
10. record real review provenance for released labels;
11. allow safe model-assisted draft authoring only as non-authoritative draft material;
12. keep real family/minor data out of the Slice 18 dataset;
13. provide stable input for future A/B/C, embedding and reranker evaluation;
14. remain provider-neutral and retrieval-engine-neutral;
15. require immutable released versions and successor-version correction rather than in-place rewrite.

---

## 7. Explicit Non-Goals

Slice 18 SHALL NOT implement or authorize:

- PostgreSQL upgrade work;
- CREATE EXTENSION pgvector;
- vector column/schema/index;
- sparsevec;
- DashScope sparse adapter;
- pg_jieba;
- professional dictionary runtime;
- pg_textsearch;
- chunking;
- parser/crawler/document ingestion;
- knowledge_embeddings;
- dense embedding calls;
- sparse embedding calls;
- reranker calls;
- retrieval endpoint;
- hybrid search;
- RRF/fusion;
- candidate A/B/C execution;
- candidate selection;
- production pass/fail thresholds for A/B/C;
- Context Builder;
- AI Task Runtime;
- ai_runs;
- TaskModelRegistry;
- Vercel AI SDK;
- provider gateway;
- Jev;
- Promptfoo installation/platform;
- DeepEval;
- Phoenix/Langfuse;
- model-generated user responses;
- Problem Formulation AI;
- A4003 model runtime;
- execution-support AI;
- Family Memory;
- Scene routing changes;
- InterventionDefinition changes;
- Knowledge Item lifecycle changes;
- new professional CMS;
- new reviewer/staff RBAC;
- new Authorization/Consent/Compliance/Safety owner;
- generic eval workflow engine;
- database migration for Gold Dataset runtime persistence.

No user-facing production behavior changes in this Slice.

---

## 8. Truth Ownership

| Truth | Sole owner | Slice 18 relationship |
|---|---|---|
| Family / Account / Person / Participant | existing Common Core | not copied |
| Case | existing Case owner | not copied |
| Evidence / Statement / Fact / Hypothesis | existing Evidence owners | not copied |
| Problem Formulation | existing Formulation owner | not copied |
| Authorization / RLS | existing owner | no second owner |
| Consent | existing owner | no second owner |
| Compliance | existing owner | no second owner |
| Safety | existing owner | no second owner |
| Scene Manifest/routing/package identity | existing Scene owner | exact reference only where needed |
| InterventionDefinition / eligibility | Slice 16 | never inferred from retrieval labels |
| Professional Knowledge Item/version/lifecycle | Slice 17 | exact corpus reference only |
| Professional Retrieval Gold Dataset version/case/label/release manifest | **Slice 18** | sole new evaluation truth |
| RAG candidate result | future Eval owner | not created here |
| Model route | future TaskModelRegistry | not created here |
| User-visible AI output | future AI runtime/release owner | not created here |

A label such as “Knowledge K@v3 is relevant to query Q” is an evaluation annotation.

It is not a statement that K@v3 is appropriate for a particular family, and it never bypasses current Authorization, Consent, Compliance, Safety, Intervention eligibility or Knowledge eligibility.

---

## 9. Dataset Identity and Lifecycle

The Gold Dataset has stable exact release identity.

Minimum release identity:

~~~text
dataset_name
dataset_version
manifest_hash
corpus_manifest_version
corpus_manifest_hash
locale
created_at
review_evidence_ref
released_at
retired_at?
~~~

Lifecycle:

~~~text
DRAFT
→ REVIEWED
→ RELEASED
→ RETIRED
~~~

Semantics:

- DRAFT may change and is never production model/retrieval evidence;
- REVIEWED means the exact case/label payload has valid real review evidence;
- REVIEWED alone does not make it release evidence;
- RELEASED is immutable and may be used by later evaluation;
- RETIRED remains historically traceable but cannot be used for new production route approval;
- a substantive correction creates a successor dataset version;
- no released dataset is edited in place;
- “latest” is not an acceptable identity for release evidence.

The lifecycle belongs only to the evaluation artifact. It does not mirror or control Knowledge lifecycle.

---

## 10. Corpus Manifest Contract

A released Gold Dataset MUST bind to an exact corpus manifest.

The corpus manifest SHALL contain exact authoritative references sufficient to reproduce which Knowledge versions were eligible for that evaluation corpus.

Minimum member identity:

~~~text
knowledge_id
knowledge_version
knowledge_content_hash
scene_id
package_version
knowledge_lifecycle_state_at_snapshot
source/provenance snapshot ref where required
~~~

Rules:

1. actual benchmark corpus members must resolve to authoritative Slice 17 Knowledge versions;
2. production-quality benchmark cases may reference only exact PUBLISHED/eligible Knowledge versions for the snapshot unless the case explicitly tests exclusion of non-production states;
3. DRAFT/REVIEWED/RETIRED items may appear only as explicit negative/filter test fixtures and must be unambiguously marked as non-eligible;
4. the dataset cannot promote a Knowledge version;
5. the dataset cannot copy Knowledge lifecycle truth into a second mutable registry;
6. corpus drift changes the corpus manifest hash and invalidates old “same corpus” claims;
7. a future evaluation result is valid only for the exact dataset and exact corpus manifest it records.

### 10.1 No second Knowledge store

The Gold Dataset SHALL NOT become a second repository of authoritative professional content.

Default released cases store exact Knowledge refs/hashes and labels, not a duplicate editable copy of Knowledge body text.

A minimal synthetic corpus may exist only for schema/validator self-tests. It MUST be marked SYNTHETIC and MUST NOT count as production retrieval-quality evidence.

---

## 11. Gold Case Contract

Each released case SHALL have a stable case id and exact immutable payload.

Minimum fields:

~~~text
case_id
dataset_version
locale
query_text
query_origin_type
scenario
stage
age_or_development_context
filter_context
expected_relevant[]
forbidden_results[]
expected_empty
evaluation_dimensions[]
rationale
requirement_refs[]
review_owner_ref
review_evidence_ref
case_hash
~~~

### 11.1 Query origin

Allowed in Slice 18:

- professionally authored synthetic query;
- professionally reviewed synthetic paraphrase;
- professionally authored terminology/negation query.

Not allowed:

- raw customer message;
- identifiable child/family narrative;
- copied private chat;
- real Case export.

Model-assisted query drafts are allowed only as DRAFT and require human review before RELEASED.

### 11.2 Relevant labels

Each expected relevant result binds:

~~~text
knowledge_id
knowledge_version
relevance_grade
label_rationale
~~~

Relevance grade must use one frozen finite vocabulary selected by Plan AI 2 from this semantic contract, for example ordinal grades that distinguish primary/supporting/not-relevant. The Plan may choose exact numeric encoding; it may not change the meaning into a business eligibility score.

### 11.3 Forbidden labels

A forbidden result is stronger than “low relevance”.

It means future retrieval must not surface that result for the evaluated context because of an explicit benchmark reason, including:

- wrong scene;
- wrong stage;
- wrong age/development scope;
- incompatible applicability;
- exclusion/contraindication conflict;
- wrong package/version;
- DRAFT/REVIEWED but not PUBLISHED;
- RETIRED;
- source/status invalid for the snapshot;
- semantically opposite/negated intent.

Forbidden labels test retrieval and hard-filter fidelity only. The authoritative reason ultimately remains owned by the corresponding Knowledge/Policy/Domain owner.

### 11.4 Expected empty set

Some queries SHALL deliberately have:

~~~text
expected_empty = true
~~~

When no eligible professional Knowledge exists, the benchmark-correct behavior is no eligible result.

The evaluator must not force a nearest neighbor merely to avoid an empty response.

UNKNOWN, unresolved label, and expected-empty are distinct states.

---

## 12. Required Coverage Dimensions

The released initial dataset SHALL include representative cases for all of the following dimensions before it can support future production RAG selection evidence:

1. direct Chinese professional terminology;
2. natural-language paraphrase;
3. short ambiguous phrasing;
4. negation;
5. exclusion/contraindication phrasing;
6. age/development mismatch;
7. stage mismatch;
8. scene mismatch;
9. exact package/version mismatch;
10. non-PUBLISHED lifecycle exclusion;
11. RETIRED exclusion;
12. semantically similar but professionally wrong content;
13. multiple valid supporting items;
14. one dominant primary item plus weaker supporting items;
15. truthful no-result case;
16. source/reference fidelity where the Knowledge contract requires it;
17. wording that could otherwise tempt a retrieval system to treat a demonstration/example as a universal rule;
18. Digital Use professional vocabulary that lexical and dense candidates may handle differently.

The dataset does not need to reproduce every V1 user acceptance Case A–J. It covers retrieval-specific evaluation truth only.

---

## 13. Evaluation Dimensions Frozen by This Slice

Future candidate evaluation MUST be able to compute, on the same exact dataset/corpus:

- Recall@K;
- nDCG@K;
- MRR;
- hard-filter fidelity;
- forbidden-result leakage count/rate;
- expected-empty fidelity;
- professional terminology retrieval;
- negation/exclusion fidelity;
- age/stage/scene/version/lifecycle filter fidelity;
- rerank delta when a reranker is later evaluated.

Latency, storage, index cost and query cost remain future runtime measurements and are not Gold Dataset labels.

Slice 18 does not set numeric production winner thresholds.

A later RAG A/B/C Eval Frozen Spec must set or approve release thresholds before selecting a production route. Developer AI for Slice 18 must not invent them.

---

## 14. Review / Label Governance

A Gold Dataset is valuable only if its labels are not generated by the same system being evaluated.

Requirements:

1. released labels require identifiable real review evidence;
2. AI may propose DRAFT queries or DRAFT labels but cannot self-approve;
3. a retrieval candidate, embedding model, reranker, LLM judge or Promptfoo judge cannot become the Gold label owner;
4. family account ownership does not grant professional benchmark review authority;
5. developer/test fixture identity does not grant professional benchmark review authority;
6. review must bind the exact case hash and corpus manifest;
7. substantive label/query/context change invalidates prior review;
8. review evidence is referenced, not reimplemented through a new generic staff/RBAC system;
9. if no real reusable review authority exists, release remains BLOCKED.

Slice 18 may define the evaluation artifact; it may not fabricate the people/roles needed to review it.

---

## 15. Authorization / Consent / Compliance / Safety Boundary

### 15.1 Authorization

Slice 18 has no family runtime mutation endpoint and creates no family-facing data path.

Any future tool used to curate/review the dataset must reuse real professional/evaluation authority. No new generic RBAC platform is authorized.

### 15.2 Consent and privacy

Slice 18 RELEASED data MUST NOT contain raw or identifiable real family/minor data.

Allowed dataset content is professionally authored or synthetic benchmark material plus exact professional Knowledge references.

Therefore this Slice does not create a new family Consent purpose.

If a future slice wants to derive evaluation cases from real household data, that is a separate authority/data-policy decision and is out of scope here.

### 15.3 Compliance

Gold Dataset content is internal evaluation material. It does not waive AI identity, generated-content, minor-mode, external-provider, regulatory or data-processing requirements for any later runtime.

### 15.4 Safety

Safety rules remain authoritative.

A high retrieval score never clears SAFETY_HOLD or authorizes a dangerous recommendation.

Gold labels may include negative/safety-sensitive retrieval cases, but they do not become Safety truth.

---

## 16. Data / Provenance Boundary

Every released dataset version SHALL preserve:

- exact dataset version/hash;
- exact corpus version/hash;
- exact Knowledge refs;
- query origin type;
- label author/reviewer evidence ref;
- requirement references;
- release timestamp;
- predecessor/successor relationship if corrected.

The dataset SHALL NOT contain:

- passwords/secrets;
- provider API keys;
- raw private family text;
- child identifiers;
- account identifiers;
- case ids from real customers;
- copied source PDFs/books/articles as a substitute for Knowledge refs;
- full third-party copyrighted source archive.

Professional source provenance remains Slice 17/Slice 16 authority.

---

## 17. Persistence / Migration Boundary

Slice 18 requires a source-controlled, machine-readable evaluation artifact with immutable release identity.

The implementation may use repository files such as JSON/JSONL plus a release manifest/schema, as planned by Plan AI 2, provided the following remain true:

- no production business table is required;
- no database migration is required;
- no separate online Gold Dataset service is required;
- released artifact bytes have a deterministic hash;
- validation is reproducible in CI/offline tooling;
- released history remains inspectable;
- exact corpus/Knowledge refs are preserved.

If Plan AI 2 discovers an existing authoritative evaluation artifact format that satisfies the same contract, it SHALL reuse it instead of creating a parallel format.

No generic dataset registry service is authorized.

---

## 18. Idempotency / Concurrency / Timeout Semantics

Slice 18 has no production network mutation API.

Therefore the shared business idempotency table is not extended.

Release integrity is instead based on:

- source-control commit identity;
- exact dataset_version;
- exact manifest_hash;
- exact case_hash;
- exact corpus_manifest_hash.

Concurrent authoring changes must converge before RELEASED status is cut. A release must point to one exact immutable payload.

There is no “timeout means maybe released” runtime state. If an automation that creates a release artifact fails before the exact release commit exists, the release is not complete. If the exact release commit exists but a client loses the response, remote read-back determines the result.

No second idempotency system may be introduced.

---

## 19. Failure / UNKNOWN / Unavailable Semantics

The implementation SHALL fail closed when:

- a referenced Knowledge id/version cannot be resolved;
- a corpus hash does not match;
- a case hash does not match its reviewed payload;
- required review evidence is absent;
- a released case contains unresolved label state;
- an expected relevant id is not part of the bound corpus;
- a forbidden lifecycle/status case is accidentally marked as eligible positive;
- a “latest” Knowledge or dataset reference is used where exact identity is required;
- raw/identifiable family data is detected in released fixtures.

Required distinct states include:

~~~text
expected_empty
label_unresolved
corpus_unavailable
reference_invalid
review_missing
artifact_invalid
~~~

No arbitrary fallback result is allowed.

---

## 20. Observability / Audit Requirements

This Slice does not create runtime AI tracing or a business audit ledger.

Released artifacts must nevertheless be attributable through:

- Git commit;
- dataset/corpus hashes;
- review evidence reference;
- release metadata;
- successor history.

Validation failures should be visible to CI/offline evaluation tooling without logging raw prohibited data.

Future Promptfoo/Phoenix/model traces remain separate from Gold Dataset authority.

---

## 21. Functional Requirements

### FR-001 — Single Gold Dataset authority
There is one canonical Professional Retrieval Gold Dataset artifact family for V1.

### FR-002 — Exact dataset identity
Every released dataset has exact dataset_version and manifest_hash.

### FR-003 — Exact corpus identity
Every released dataset binds one exact corpus manifest version/hash.

### FR-004 — Exact Knowledge refs
Expected/forbidden results use exact Knowledge id + version, never floating latest.

### FR-005 — No duplicate Knowledge truth
The dataset does not become an editable second Knowledge store.

### FR-006 — Stable case identity
Every case has stable case_id and case_hash.

### FR-007 — Query provenance
Every query records an allowed origin type.

### FR-008 — No real family data
Released Slice 18 data contains no raw/identifiable family or minor information.

### FR-009 — Relevant labels
Cases support explicit graded relevant labels.

### FR-010 — Forbidden labels
Cases support explicit forbidden results and reason class.

### FR-011 — Expected empty
Cases support truthful expected-empty retrieval.

### FR-012 — UNKNOWN distinct
Unresolved labels cannot masquerade as irrelevant or empty.

### FR-013 — Hard-filter context
Cases can express scene/stage/age-development/version/lifecycle/applicability context.

### FR-014 — Lifecycle negatives
Dataset can test non-PUBLISHED and RETIRED exclusion.

### FR-015 — Semantic negatives
Dataset can test similar-but-professionally-wrong content.

### FR-016 — Negation/exclusion
Dataset includes negation and exclusion/contraindication cases.

### FR-017 — Chinese terminology
Dataset includes Chinese professional terminology and paraphrase.

### FR-018 — Shared benchmark
Future A/B/C candidates must consume the same exact released dataset/corpus for comparable evidence.

### FR-019 — Metric compatibility
Dataset supports Recall@K, nDCG@K and MRR computation.

### FR-020 — Hard-filter metric compatibility
Dataset supports filter fidelity and forbidden leakage measurement.

### FR-021 — Rerank comparison
Dataset labels support future pre/post-rerank comparison.

### FR-022 — Review binding
Review evidence binds exact case/corpus payload.

### FR-023 — No self-approval
Model/retrieval candidate/AI judge cannot approve its own Gold labels.

### FR-024 — Immutable release
RELEASED dataset/cases are immutable.

### FR-025 — Successor correction
Substantive correction creates a successor dataset version.

### FR-026 — Retired history
Retired dataset versions remain inspectable but not valid for new route approval.

### FR-027 — No numeric route threshold
Slice 18 does not invent production winner thresholds.

### FR-028 — No retrieval execution
Slice 18 performs no A/B/C, embedding or reranker execution.

### FR-029 — No runtime DB
Slice 18 requires no production database migration/service.

### FR-030 — Reproducible validation
Artifact/schema/hash validation is reproducible offline/CI.

### FR-031 — Exact release evidence
Later route/model evidence must record dataset_version + manifest_hash + corpus_manifest_hash.

### FR-032 — Authority preservation
Retrieval labels never override Authorization, Consent, Compliance, Safety, Intervention or Knowledge authority.

### FR-033 — Synthetic self-test isolation
Synthetic validator fixtures cannot count as production retrieval-quality evidence.

### FR-034 — Source/provenance preservation
Benchmark refs retain enough exact provenance to trace back to authoritative Knowledge.

### FR-035 — No generic platform
No generic eval workflow/registry/RBAC platform is created.

---

## 22. Acceptance Scenarios

### AS-001 — Exact relevant item
A Chinese professional query has one exact primary relevant Knowledge version; the case records it without copying authoritative Knowledge truth.

### AS-002 — Multiple relevant items
A query has primary and supporting items with graded labels; future ranking metrics can distinguish their order.

### AS-003 — Wrong scene
A semantically similar Knowledge item from the wrong scene is explicitly forbidden.

### AS-004 — Wrong stage
A semantically similar item from the wrong stage is forbidden.

### AS-005 — Wrong age/development
Age/development-incompatible content is forbidden even if semantically similar.

### AS-006 — Wrong package/version
A Knowledge item from an incompatible package/version cannot satisfy the expected result.

### AS-007 — Draft knowledge
DRAFT Knowledge is never a positive production result.

### AS-008 — Reviewed-not-published knowledge
REVIEWED but not PUBLISHED Knowledge is never a positive production result.

### AS-009 — Retired knowledge
RETIRED Knowledge is excluded from positive retrieval for a current production snapshot.

### AS-010 — Negation
A query containing a negated professional concept does not treat the opposite concept as relevant merely by token overlap.

### AS-011 — Contraindication
A query/context with an explicit exclusion does not reward retrieval of content that conflicts with that exclusion.

### AS-012 — Chinese terminology variant
Canonical term and natural-language paraphrase can point to the same relevant exact Knowledge version.

### AS-013 — Lexical/dense discriminator
A professionally meaningful term that may separate lexical from dense retrieval is represented without choosing the winning candidate.

### AS-014 — Expected empty
No eligible Knowledge exists; expected_empty is true and no nearest-neighbor fallback is labeled correct.

### AS-015 — Unresolved label
Reviewer cannot resolve relevance; the case remains non-released rather than becoming a false negative.

### AS-016 — Corpus drift
A Knowledge version changes; corpus hash changes and prior evaluation cannot claim to be on the new corpus.

### AS-017 — Dataset correction
A released label is found wrong; original release stays immutable and a successor dataset version is created.

### AS-018 — AI-authored draft
AI proposes a query/label; it remains DRAFT until real review evidence exists.

### AS-019 — Candidate self-grading
A retrieval/model candidate attempts to supply Gold labels; those labels cannot become RELEASED authority.

### AS-020 — Real family text rejection
A raw identifiable customer message is inserted into a release candidate; release validation fails.

### AS-021 — Floating latest rejection
A case references latest Knowledge instead of exact id/version; release fails.

### AS-022 — Missing Knowledge ref
Expected result references an absent Knowledge version; release fails.

### AS-023 — Hash mismatch
Case/corpus payload differs from reviewed hash; release fails.

### AS-024 — Same dataset comparison
Future candidates A/B/C can all record results against the same exact dataset/corpus identity.

### AS-025 — Hard-filter leakage visible
A candidate returns a high-similarity forbidden item; benchmark records it as leakage even if ranking metrics otherwise look good.

### AS-026 — No business authority leakage
A Gold label never activates Intervention, changes Case, confirms Formulation, clears Safety or grants Consent.

### AS-027 — Synthetic fixture isolation
Validator self-test corpus passes schema tests but cannot be presented as production RAG evidence.

### AS-028 — Release read-back
If release response is lost after the Git commit exists, exact remote read-back recovers one release identity with no duplicate version.

---

## 23. Negative Scope Scenarios

### NS-01
No pgvector extension or vector schema is created.

### NS-02
No sparsevec or DashScope adapter is implemented.

### NS-03
No pg_jieba runtime/dictionary is implemented.

### NS-04
No RAG retrieval endpoint/search/ranking/reranking/fusion is implemented.

### NS-05
No embedding or reranker provider call occurs.

### NS-06
No Promptfoo/DeepEval/Phoenix platform is installed as part of this Slice.

### NS-07
No AI Task Runtime/TaskModelRegistry/model gateway is created.

### NS-08
No user-facing AI feature is implemented.

### NS-09
No new Knowledge or Intervention owner is created.

### NS-10
No new Authorization/Consent/Compliance/Safety owner is created.

### NS-11
No real family/minor dataset is introduced.

### NS-12
No generic staff/RBAC/CMS/workflow/eval registry platform is introduced.

### NS-13
No production database migration is created.

### NS-14
No production candidate or numeric winner threshold is selected.

### NS-15
No “latest” dataset or Knowledge reference is accepted as release evidence.

### NS-16
No synthetic self-test fixture is counted as production quality evidence.

### NS-17
No released dataset is edited in place.

### NS-18
No Gold label is allowed to become business eligibility/permission truth.

---

## 24. Consumer / Producer Contracts

### 24.1 Producers

Future Slice 18 implementation produces:

- dataset schema;
- dataset release manifest;
- corpus manifest;
- reviewed/released Gold cases;
- deterministic hashes/validation evidence.

It does not produce retrieval results.

### 24.2 Consumers

Authorized future consumers include:

- pgvector/dense+sparse readiness experiments when they need stable correctness examples;
- pg_jieba lexical comparison;
- Professional RAG A/B/C Eval;
- embedding Eval;
- reranker Eval;
- later Promptfoo RAG regression harness;
- release evidence for exact rag_route_version / embedding_route_version / rerank_route_version.

Consumers must bind exact dataset/corpus versions.

No consumer may mutate the Gold labels during an evaluation run.

---

## 25. Future Slice Seams

This Slice intentionally leaves the following as separate future capabilities:

1. PostgreSQL/pgvector environment readiness;
2. DashScope dense+sparse → sparsevec readiness Spike;
3. pg_jieba + professional dictionary readiness;
4. embedding adapter;
5. reranker adapter;
6. A/B/C retrieval implementation;
7. RRF/fusion;
8. Gold Dataset execution/scoring and route-selection thresholds;
9. Promptfoo RAG regression;
10. Context Builder;
11. AI Task Runtime;
12. TaskModelRegistry/provider execution;
13. user-facing AI features.

A future slice may combine only capabilities that prove one minimal coherent responsibility under then-current authority. This Spec does not pre-authorize that combination.

---

## 26. Implement Gate

Planning and implementation readiness are separate.

### 26.1 Planning dependencies

Planning is permitted because the four Docs, Slice 16 Frozen professional-definition authority and Slice 17 Frozen Knowledge authority are sufficient to define the Gold Dataset contract without implementing them.

### 26.2 Runtime / artifact dependencies for implementation

Before Developer AI may create a RELEASED production-quality Gold Dataset, it must re-read current remote truth and prove:

1. Slice 17 Professional Knowledge runtime is independently audited and merged;
2. Slice 17 can resolve exact Knowledge ids/versions/content hashes/lifecycle/package bindings;
3. a real representative set of PUBLISHED V1 professional Knowledge exists;
4. Slice 16 professional definition/provenance authority required by Slice 17 is real/merged where applicable;
5. real professional/evaluation review authority exists and can supply accountable review evidence;
6. exact Scene/package identity is available without a second registry;
7. no competing Gold Dataset authority exists;
8. no authority drift changes the four Docs or Frozen Slice 17 semantics.

Current result:

~~~text
Planning:
READY

Runtime Dependency Gate:
BLOCKED

Implement Gate:
BLOCKED

Development Authorization:
NOT GRANTED
~~~

The current block is intentional. Developer AI must not satisfy it with fake Knowledge fixtures, fake reviewer identities, a hard-coded admin, or a second Knowledge/package/review owner.

A future Developer may implement schema/validator scaffolding only if Plan AI 2 explicitly proves such work has independent value without falsely marking a Gold Dataset RELEASED. This Spec itself grants no development authorization.

---

## 27. Clarify — Resolved Decisions

### C18-01 — Is Slice 18 “pgvector bootstrap” because Phase 3 lists it early?
NO. PostgreSQL 18 is already the current CI baseline, and building pgvector before the common benchmark would be technical-first rather than evidence-first. pgvector remains required later.

### C18-02 — Is Slice 18 full RAG Eval?
NO. Full A/B/C execution requires runnable candidates, corpus and readiness. Slice 18 freezes the benchmark truth only.

### C18-03 — Is this a generic AI Eval platform?
NO. It is one bounded Professional Retrieval dataset. Promptfoo remains a future consumer/tool.

### C18-04 — Does the dataset copy Knowledge bodies?
Not as a second authoritative store. Released cases use exact Knowledge refs/hashes. Synthetic validator fixtures are clearly isolated.

### C18-05 — Can a model generate Gold labels?
Only DRAFT proposals. RELEASED labels require real review evidence.

### C18-06 — Can real family chats seed the dataset?
Not in Slice 18. Released data is synthetic/professionally authored and contains no identifiable family/minor material.

### C18-07 — Does expected relevance mean the content is safe/authorized for a real family?
NO. Relevance annotation never replaces current hard gates or professional eligibility.

### C18-08 — What if there is no correct Knowledge result?
The case may explicitly require an empty eligible result. Nearest-neighbor fallback is not automatically correct.

### C18-09 — What if a label is uncertain?
It remains unresolved/non-released. UNKNOWN is not silently converted to irrelevant.

### C18-10 — Who owns hard-filter truth?
Existing Knowledge/Scene/Authorization/Consent/Compliance/Safety/Intervention owners. Slice 18 records expected evaluation behavior without duplicating those owners.

### C18-11 — Does Slice 18 choose numeric production thresholds?
NO. Thresholds and route selection belong to the future execution/evaluation Slice, after real candidate evidence exists.

### C18-12 — Does Slice 18 need a database?
NO production DB is required. The artifact is versioned evaluation data with deterministic hashes. A future Plan must reuse any existing canonical eval artifact format if one exists.

### C18-13 — Can REVIEWED Knowledge be positive corpus truth?
Not for production retrieval evidence. Positive production corpus members must be PUBLISHED/eligible in the exact snapshot.

### C18-14 — Does a dataset correction rewrite historical eval evidence?
NO. Corrections create a successor dataset version. Old route/model evidence remains bound to its old exact dataset.

### C18-15 — Does this Slice unblock Phase 3 development?
NO. It only defines the next minimal authority. Current Implement Gate remains BLOCKED by upstream runtime/reviewer reality.

Clarification status:

~~~text
Open Product Decisions:
0

Open Architecture Decisions required for Plan AI 2:
0

Clarification:
COMPLETE
~~~

---

## 28. Frozen Spec Boundary

This artifact authorizes only the product/architecture semantics of Slice 18.

Plan AI 2 may:

- translate this Frozen Spec into Plan;
- create Checklist;
- create Tasks;
- perform Audit 1;
- remediate planning-only defects without changing this Frozen Spec;
- freeze planning.

Plan AI 2 may not silently broaden this Slice into pgvector/RAG/AI runtime work.

No Developer AI is authorized by this Spec.

Final handoff state after exact remote read-back must be:

~~~text
READY FOR PLAN AI 2
Development Authorization: NOT GRANTED
STOP
~~~
