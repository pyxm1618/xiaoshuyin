# Slice 18 — Professional Retrieval Gold Dataset Foundation

> Repository: pyxm1618/xiaoshuyin
>
> Slice: 018
>
> V1 Phase: Phase 3 — Professional Knowledge & AI
>
> Role boundary: Slice 18 Authority Reconciliation only
>
> Status: Selection PRESERVED + Authority Reconciliation — RECONCILED FROZEN SPEC
>
> Scope of this artifact: minimum Authority reconciliation of the existing Frozen Spec only
>
> Forbidden in this artifact: Plan / Checklist / Tasks / Audit 1 / implementation / migration / production code / test implementation / PR merge
>
> Selected capability: Professional Retrieval Gold Dataset Foundation
>
> Spec branch: spec/018-professional-retrieval-gold-dataset-authority-reconciliation
> Authority reconciliation base: origin/main @ 9aceaedf12b611d41fba06866dcd00e20eb5ea8d
> Previous Frozen Spec: 4624b3df6d59c6055421e175b95051782615de9a / bf7540ff3097ef14ca1c62a395b155abd4fde66a

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

Current remote baseline re-read during Authority Reconciliation:

~~~text
Repository:
pyxm1618/xiaoshuyin

Current origin/main:
9aceaedf12b611d41fba06866dcd00e20eb5ea8d

Original Slice 18 freeze baseline:
e7bb22d1abad58a6c9df6350744f092d88370aa3
~~~

The original freeze baseline is historical evidence only. This reconciled Spec is bound to current main and the current four Authority Docs.

Authority Doc blobs on the reconciliation baseline:

~~~text
Docs/总产品需求.md
97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29

Docs/V1产品需求.md
8eb660cd905d8fba4b52fe0f74bbc214b3113117

Docs/总体技术架构.md
6b4630803f371faf6d93f27361070223d0f661a0

Docs/V1技术设计.md
a0f09b8afda5532870150f03b713fed107359849
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

At this reconciliation freeze, current main is:

~~~text
9aceaedf12b611d41fba06866dcd00e20eb5ea8d
Merge pull request #57
feat(slice16): authority-reconciled psychological behavioral intervention contract foundation
~~~

The original Slice 18 freeze-time statement that main contained only Slice 1–12 plus PR #37 is historical and is **retired as current truth**.

Current main includes the merged Slice 16 runtime from PR #57. This does **not** mean Slice 16 is a clean prerequisite: §2.3 separately records the post-merge forensic blockers and unmerged remediation state. Slice 17 remains unmerged and therefore is not current-main runtime truth.
### 2.2 Current PostgreSQL baseline

Current CI already uses PostgreSQL 18 for database migration/integration jobs.

Therefore Slice 18 must not mislabel a PostgreSQL major-version upgrade as missing Phase 3 work.

Current package/runtime dependency inventory does not establish a production Professional RAG implementation, provider execution layer, Promptfoo runtime, or Knowledge retrieval store on main.

### 2.3 Current upstream runtime truth relevant to Slice 18

The original Slice 18 freeze-time runtime table is retired as current execution truth. It remains historical evidence only.

Current reconciliation snapshot:

| Upstream | Current remote truth | Slice 18 interpretation |
|---|---|---|
| origin/main | 9aceaedf12b611d41fba06866dcd00e20eb5ea8d | current reconciliation base |
| Slice 16 | PR #57 MERGED at 9aceaedf12b611d41fba06866dcd00e20eb5ea8d; post-merge forensic audit found 12 blocking findings; remediation PR #59 is OPEN / NOT MERGED and its PR contract requires independent targeted re-audit before merge; its moving exact Head/CI/audit state is deliberately re-read by T1801 rather than frozen here | merged = YES; remediation exists, but clean prerequisite / runtime usability = NOT YET PROVEN |
| Slice 17 | PR #58 was NOT MERGED at the reconciliation snapshot; its moving exact Head / draft / mergeability / CI / audit / merge state is deliberately re-read by T1801 rather than frozen here | implementation exists, but it is not current-main runtime truth and cannot satisfy T1801 until T1801 proves the current merged / audited / runtime-usable state |
| Professional Reviewer | APPROVED PROFESSIONAL REVIEWER — UNASSIGNED | production Gold-label approval prerequisite = BLOCKED |

Older Slice 13–15 freeze-time runtime statements are not T1801 predicates and are retired from this Spec as current-gate evidence.

### 2.4 Current Slice 17 authority truth

Slice 18 consumes the **authority-reconciled** Slice 17 planning package, not the older pre-reconciliation Slice 17 freeze as current authority.

Current remote authority package at this reconciliation freeze:

~~~text
spec/017-professional-knowledge-foundation-authority-reconciliation
  Head:
  9763bfd796aca9dbac20a94137dc330ef2b15971

  spec.md blob:
  83222f41929689f5d98ca45027c78a262ae6449f

plan/017-professional-knowledge-foundation-authority-reconciliation
  Head / Planning Freeze:
  62020e02c908b870ff4aa445d068d6b09c19405a

  plan.md:
  6120f92ebb891fb2a149c70ee2ba311fc578e94b

  checklist.md:
  5d087965a168e9a538583320e2e855b4466fd94e

  tasks.md:
  aee7ae367b74ace5fbb4f9c9b2edde21682ff53a
~~~

The older `spec/017-professional-knowledge-foundation` and `plan/017-professional-knowledge-foundation` snapshots remain historical evidence only; they are not the current authority consumed by this reconciliation.

Runtime truth is separate from planning authority: PR #58 was not merged at the reconciliation snapshot. Its current Head, draft/mergeability/CI state, merge state, independent audit result and runtime usability are volatile execution truth and are re-read by T1801; the planning package alone cannot satisfy that gate.
### 2.5 Existing Slice 18 authority before reconciliation

Immediately before this Authority Reconciliation created new branches, exhaustive `018` branch search found exactly:

~~~text
spec/018-professional-retrieval-gold-dataset
  Head:
  4624b3df6d59c6055421e175b95051782615de9a
  spec.md:
  bf7540ff3097ef14ca1c62a395b155abd4fde66a

plan/018-professional-retrieval-gold-dataset
  Head / original Planning Freeze:
  9254c6bf387dd5471f7935be056c122fd5508672
  plan.md:
  4a773fa48d26eb8dcabc5611767a9e40a8cbdc7b
  checklist.md:
  ca07705de0e280f233e7a8eec2d9da26eb03af54
  tasks.md:
  754dc21d714550503c8b18193461beaf9f414275

feat/018-*
  NONE
~~~

Those original spec/plan branches are preserved historically. They are superseded as **current Slice 18 authority** only by the unique authority-reconciliation Spec/Plan branches created by this task; they are not deleted or rewritten.

No competing `018-*authority*` branch existed before reconciliation.

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

## 9. Dataset Identity, Lifecycle, Review State, and Validity

The Gold Dataset has stable exact release identity. Lifecycle and review/validity are distinct dimensions and MUST NOT be collapsed into one enum.

Minimum release identity:

~~~text
dataset_name
dataset_version
manifest_hash
corpus_manifest_version
corpus_manifest_hash
locale
created_at
professional_approval_ref
released_at
retired_at?
~~~

Artifact lifecycle:

~~~text
lifecycle_status:
DRAFT
→ RELEASED
→ RETIRED
~~~

Review/validity state is independent:

~~~text
review_state:
CURRENT
↔ NEEDS_REVIEW

validity_state where separately materialized:
VALID / INVALID
~~~

Canonical semantics:

- DRAFT may change and is never production model/retrieval evidence;
- REVIEWED is **retired as a Gold Dataset lifecycle value**. Professional review is represented by an exact upstream professional approval binding, not by a lifecycle step;
- RELEASED means the exact release bytes are immutable and may be used only while all required professional/dependency validity predicates are current;
- a RELEASED artifact may simultaneously be NEEDS_REVIEW; that state blocks it from serving as current route-approval evidence without changing lifecycle_status;
- RETIRED is an intentional lifecycle decision and remains historically traceable; it is not a substitute for NEEDS_REVIEW;
- a substantive correction or materially impacted re-review creates a successor dataset version;
- no released dataset is edited in place;
- “latest” is not an acceptable identity for release evidence.

A current release is eligible for new route/model approval evidence only when:

1. lifecycle_status = RELEASED;
2. review_state = CURRENT;
3. validity is not INVALID;
4. the exact Professional approval is current, effective/published, not expired/withdrawn, and matches the exact artifact/content/source/scope;
5. all required Knowledge/package/provenance dependencies remain valid for that release.

Dependency drift never silently rewrites the immutable release. It creates an append-only revalidation/impact record tied to the exact release identity.

Re-review outcomes:

- **no material impact** → append revalidation evidence and restore CURRENT / VALID without changing released bytes;
- **material impact** → create and professionally approve a successor dataset version; old bytes remain immutable and cannot claim current validity;
- **cannot legally/professionally continue** → mark the exact affected release/case invalid for current use and, where the lifecycle owner intentionally withdraws it, RETIRE it. Retirement is not automatic merely because review is required.

The lifecycle belongs only to the evaluation artifact. It does not mirror or control Knowledge lifecycle.

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
professional_approval_binding_id
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

Model-assisted query drafts are allowed only as DRAFT and require valid Professional Authority approval through the exact `professional_approval_binding_id` before RELEASED.

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

## 14. Professional Approval / Label Governance

Professional Gold Dataset professional gold labels and review rubrics are **Professional Authority**. Slice 18 owns the evaluation artifact shape; it does not own or manufacture professional reviewer authority.

A Gold Dataset is valuable only if its labels are not generated or approved by the same system being evaluated.

A RELEASED professional Gold label/rubric requires a real approval that resolves through the existing Professional Authority owner and proves all of the following:

~~~text
real Staff assignment
PROFESSIONAL_REVIEW capability
matching professional qualification
qualification_scope matching approval_scope
auditable reviewer identity
artifact/package identity
exact dataset/case immutable version/content identity
dataset/case hashes
exact corpus manifest hash
source refs
approval scope
reviewer identity
qualification_ref
reviewed_at
approval status
effective/published version or effective period
~~~

Rules:

1. Staff assignment and PROFESSIONAL_REVIEW capability are necessary but not sufficient; the reviewer must also hold a matching professional qualification/scope.
2. released labels require identifiable real review evidence bound to the exact artifact and content hashes;
3. AI may propose DRAFT queries or DRAFT labels but cannot approve them;
4. a retrieval candidate, embedding model, reranker, LLM judge or Promptfoo judge cannot become the Gold label owner;
5. family account ownership, Family Manager/Guardian status, developer identity, fixture identity, or a generic admin flag does not grant professional benchmark approval authority;
6. substantive label/query/context/corpus change invalidates the prior approval for the changed bytes;
7. capability revocation, Staff-assignment invalidation, qualification revocation/scope mismatch, approval expiry/withdrawal, or approval/content-hash mismatch makes the affected approval unusable;
8. review evidence is consumed from the sanctioned authority seam; Slice 18 does not create Staff, RBAC, qualification, reviewer registry, or generic approval infrastructure;
9. if real authority, qualification, scope, assignment, approval evidence, or current validity cannot be proven, RELEASE and current route-approval evidence fail closed.

Current organization-level dependency:

> **APPROVED PROFESSIONAL REVIEWER — UNASSIGNED**

Therefore professional-quality RELEASE remains blocked until a real reviewer is assigned through the existing authority system. Slice 18 may not fabricate the reviewer, grant, qualification, corpus, or approval.

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

### FR-022 — Exact Professional approval binding
Professional approval binds the exact artifact/package identity, dataset/case hashes, corpus hash, source refs, approval scope, reviewer identity, Staff assignment, PROFESSIONAL_REVIEW capability, qualification_ref, qualification_scope, reviewed_at, approval status and effective/published identity.

### FR-023 — No authority laundering / self-approval
Model/retrieval candidate/AI judge/developer/fixture/family-role reviewer cannot approve Gold labels, and a populated approved/status field cannot substitute for real Professional Authority.

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

### FR-036 — Professional reviewer authenticity
A release can consume approval only from a real Staff assignment with PROFESSIONAL_REVIEW plus matching professional qualification/scope and auditable reviewer identity.

### FR-037 — Lifecycle/review-state separation
Gold Dataset lifecycle_status is independent from review_state/validity; REVIEWED is not a lifecycle status.

### FR-038 — NEEDS_REVIEW fail closed
A RELEASED dataset/case in NEEDS_REVIEW cannot be used as current production route/model approval evidence.

### FR-039 — Affected-only dependency propagation
Knowledge/provenance/package/policy/professional-approval changes mark only genuinely dependent dataset/case objects for revalidation; unrelated releases remain unchanged.

### FR-040 — Stale Professional approval rejection
Expired, withdrawn, capability-invalid, qualification-invalid, scope-mismatched, hash-mismatched or otherwise stale approval cannot authorize release or current evidence use.

### FR-041 — Revalidation outcome contract
No-material-impact re-review restores CURRENT/VALID by append-only evidence; material impact requires a successor release; impossible-to-continue dependencies invalidate current use.

### FR-042 — Immutable historical release under revalidation
Dependency/review state changes do not rewrite previously released bytes or historical evaluation evidence.

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

### AS-029 — Wrong capability
A real Staff actor without PROFESSIONAL_REVIEW cannot approve a Gold label; release fails closed.

### AS-030 — Qualification/scope mismatch
A Staff actor with PROFESSIONAL_REVIEW but missing/mismatched professional qualification or scope cannot approve the artifact.

### AS-031 — Revoked or stale authority
Revoked Staff assignment/capability/qualification, expired/withdrawn approval, or mismatched approval scope makes the affected approval unusable.

### AS-032 — Approval hash drift
The approved case/dataset/corpus bytes differ from the bound hashes; the affected release cannot be used as current approval evidence.

### AS-033 — RELEASED + NEEDS_REVIEW
An immutable RELEASED dataset whose upstream professional/Knowledge dependency materially changes remains RELEASED historically but enters NEEDS_REVIEW and is blocked for current route approval.

### AS-034 — Unrelated upstream change
An upstream asset changes that is not referenced by a dataset/case; that unrelated release remains CURRENT and is not mechanically invalidated or retired.

### AS-035 — Re-review with no material impact
Re-review proves no material impact; append-only revalidation evidence restores CURRENT/VALID without changing old release bytes.

### AS-036 — Re-review with material impact
Re-review finds material impact; a professionally approved successor dataset is required and the predecessor cannot claim current validity.

### AS-037 — Permanent dependency invalidity
A required dependency can no longer be legally/professionally used; the exact affected release/case is invalid for current use, and retirement occurs only when the lifecycle owner intentionally withdraws it.

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

Planning is permitted because the four current Docs plus the current authority-reconciled Slice 16 professional-definition contract and Slice 17 Professional Knowledge contract are sufficient to define the Gold Dataset contract without treating either feature implementation as current-main runtime truth.

### 26.2 Runtime / artifact dependencies for implementation

T1801 is the mandatory READ-ONLY first task. **No implementation edit of any kind, including schema/validator scaffolding, may occur unless every predicate below passes.**

Developer AI must re-read then-current remote truth and prove:

1. current main exact SHA and no unreviewed authority drift;
2. the reconciled Slice 18 Frozen Spec exact blob is the unique current Slice 18 spec authority;
3. Slice 16 merge state, post-merge audit state, remediation state and runtime usability are separately proven; merged alone is insufficient;
4. Slice 17 has independent Audit 2 PASS, is merged to current main, and its required Knowledge owner/seams are usable;
5. exact merged Knowledge id/version/content hash/lifecycle/package resolution exists;
6. a representative real PUBLISHED Professional Knowledge corpus exists;
7. a real Staff assignment exists for the approving reviewer;
8. the reviewer has PROFESSIONAL_REVIEW capability;
9. the reviewer has matching professional qualification with auditable qualification_ref and canonical qualification_scope;
10. the reviewer identity is auditable;
11. a sanctioned professional review/approval evidence seam exists;
12. approval binding supports exact artifact/package identity, version/content hash, source refs, approval scope, reviewer identity, qualification_ref, qualification_scope, reviewed_at, approval status and effective/published identity;
13. exact Scene/package identity is available from its real owner;
14. no duplicate Knowledge/package/reviewer/eval owner is required;
15. no Authority drift exists in the four Docs or consumed upstream contracts;
16. no competing Slice 18 spec/plan/feat authority exists.

Any false or unprovable predicate requires immediate STOP:

~~~text
Runtime Dependency Gate:
BLOCKED

Implement Gate:
BLOCKED

Development Authorization:
NOT GRANTED
~~~

Current reconciliation-time truth:

- Slice 16: MERGED through PR #57 at main 9aceaedf12b611d41fba06866dcd00e20eb5ea8d, but post-merge forensic blocking findings exist and remediation is only on an unmerged branch; clean prerequisite/runtime usability is NOT YET PROVEN.
- Slice 17: PR #58 is OPEN / DRAFT / NOT MERGED; current implementation exists but is not current-main runtime truth.
- Professional Reviewer: APPROVED PROFESSIONAL REVIEWER — UNASSIGNED.
- Therefore Runtime Dependency Gate = BLOCKED, Implement Gate = BLOCKED, Development Authorization = NOT GRANTED.

These blocks are correct planning outcomes and MUST NOT be bypassed with fake Knowledge, synthetic “real” corpus, string reviewer ids, fixture/developer/admin/AI approval, or a new duplicate authority system.

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

## 27A. Authority Reconciliation Record — 2026-11-17

### 27A.1 Authority Drift Matrix

| Area | Old Slice 18 | Current Authority | Conflict? | Required Action |
|---|---|---|---|---|
| Selection | Gold Dataset Foundation | Phase 3 still requires common Xiaoshuyin Gold Dataset before A/B/C route/model selection | NO | PRESERVE |
| Reviewer authority | generic “real professional/evaluation reviewer authority” | real Staff assignment + PROFESSIONAL_REVIEW + matching professional qualification/scope + auditable identity | YES | AMEND |
| Capability | no exact capability name | PROFESSIONAL_REVIEW required but insufficient alone | YES | AMEND |
| Qualification | generic real reviewer | qualification_ref and matching qualification scope required | YES | AMEND |
| Approval binding | case hash + corpus hash + evidence ref | exact artifact/package/version/content hash/source refs/approval scope/reviewer/qualification/reviewed_at/status/effective-published identity | YES | AMEND |
| Lifecycle | DRAFT→REVIEWED→RELEASED→RETIRED | lifecycle is distinct from review_state/validity_state | YES | RETIRE old combined enum / AMEND |
| NEEDS_REVIEW | absent for Gold Dataset | mandatory affected-object revalidation state | YES | AMEND |
| Dependency propagation | corpus drift invalidates “same corpus” claim | affected-only propagation; unrelated objects unchanged | YES | AMEND |
| Slice 16 Gate | runtime not merged | merged, but post-merge blocking findings/remediation mean clean usability is not yet proven | YES | RETIRE stale runtime statement |
| Slice 17 Gate | runtime not implemented/merged | implementation exists on PR #58 but remains not merged | YES | CLARIFY current truth |
| Reviewer assignment | unknown/not proven | APPROVED PROFESSIONAL REVIEWER — UNASSIGNED | YES | BLOCK release/development |
| Scope | Gold Dataset only | same bounded Gold Dataset responsibility; no RAG/pgvector/Promptfoo/runtime | NO | PRESERVE |

### 27A.2 Current Authority Doc identities

~~~text
Docs/总产品需求.md      97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29
Docs/V1产品需求.md      8eb660cd905d8fba4b52fe0f74bbc214b3113117
Docs/总体技术架构.md    6b4630803f371faf6d93f27361070223d0f661a0
Docs/V1技术设计.md      a0f09b8afda5532870150f03b713fed107359849
~~~

All four differ from the original Slice 18 planning baseline; Authority Drift = DETECTED.

### 27A.3 Requirement-by-requirement reconciliation

The following classifies every requirement identifier in the previous Frozen Spec. Nothing is silently deleted.

| Previous requirement | Classification | Reconciliation |
|---|---|---|
| FR-001 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-002 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-003 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-004 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-005 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-006 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-007 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-008 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-009 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-010 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-011 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-012 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-013 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-014 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-015 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-016 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-017 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-018 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-019 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-020 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-021 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-022 | AMEND | Exact Professional approval binding now includes Staff assignment, PROFESSIONAL_REVIEW, qualification/scope and immutable approval identity. |
| FR-023 | AMEND | Expanded from self-approval to full authority-laundering prohibition. |
| FR-024 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-025 | CLARIFY | Successor is specifically required when re-review finds material impact. |
| FR-026 | CLARIFY | RETIREMENT is lifecycle; it no longer substitutes for NEEDS_REVIEW. |
| FR-027 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-028 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-029 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-030 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-031 | CLARIFY | Exact evidence must also remain current under review/approval/dependency validity. |
| FR-032 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-033 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| FR-034 | CLARIFY | Exact dependency/source provenance is used for affected-only revalidation. |
| FR-035 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-001 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-002 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-003 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-004 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-005 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-006 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-007 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-008 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-009 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-010 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-011 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-012 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-013 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-014 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-015 | CLARIFY | Unresolved professional truth remains non-released and cannot be laundered into approval. |
| AS-016 | AMEND | Corpus drift now triggers affected-only NEEDS_REVIEW/revalidation rather than coarse invalidation. |
| AS-017 | CLARIFY | Material correction requires successor; review-only drift does not rewrite lifecycle. |
| AS-018 | AMEND | Draft AI content requires full Professional Authority approval, not generic human review. |
| AS-019 | AMEND | Candidate/model cannot satisfy Professional Authority. |
| AS-020 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-021 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-022 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-023 | AMEND | Hash drift explicitly invalidates the bound Professional approval. |
| AS-024 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-025 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-026 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-027 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| AS-028 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| NS-01 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| NS-02 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| NS-03 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| NS-04 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| NS-05 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| NS-06 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| NS-07 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| NS-08 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| NS-09 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| NS-10 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| NS-11 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| NS-12 | CLARIFY | No new Staff/RBAC/qualification/reviewer owner; existing authority is consumed. |
| NS-13 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| NS-14 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| NS-15 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| NS-16 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| NS-17 | PRESERVE | No current Authority conflict; original requirement remains in force. |
| NS-18 | PRESERVE | No current Authority conflict; original requirement remains in force. |

Additional current-Authority requirements are FR-036..FR-042 and AS-029..AS-037 above.

Section-level legacy statements:

| Previous statement | Classification | Reconciliation |
|---|---|---|
| DRAFT→REVIEWED→RELEASED→RETIRED as one lifecycle | RETIRE | replaced by independent lifecycle_status + review_state/validity semantics |
| “real professional/evaluation reviewer” without exact authority predicates | AMEND | replaced by Staff assignment + PROFESSIONAL_REVIEW + qualification/scope + auditable approval binding |
| Slice 16 runtime not merged | RETIRE | merged state recorded separately from post-merge audit/remediation usability |
| Slice 17 runtime not implemented/merged | CLARIFY | implementation exists but is not merged/current-main truth |
| schema/validator scaffolding may proceed while runtime gate blocked | RETIRE | T1801 now blocks every implementation edit until all predicates pass |

### 27A.4 Scope confirmation

Selection is PRESERVED:

> **Professional Retrieval Gold Dataset Foundation**

This reconciliation does not authorize retrieval execution, pgvector, sparsevec, pg_jieba, embeddings, reranking, Promptfoo setup, RAG A/B/C execution, AI Task Runtime, Context Builder, migrations, production DB work, real Gold labels, or production code.


## 28. Reconciled Frozen Spec Boundary

This artifact authorizes only the current product/architecture semantics of Slice 18 after Authority Reconciliation.

The corresponding reconciliation planning branch may:

- translate this Reconciled Frozen Spec into Plan;
- maintain Checklist and Tasks;
- perform complete Audit 1 over Spec + Plan + Checklist + Tasks;
- amend only these reconciliation artifacts when required to remove a demonstrated current-Authority conflict;
- freeze planning after CRITICAL/HIGH/MEDIUM = 0 and exact remote read-back.

It may not modify the four Authority Docs, upstream Slice authority/runtime, production code, tests or migrations, and may not broaden Slice 18 into pgvector/RAG/AI runtime work.

No Developer AI is authorized by this Spec or by Planning Freeze alone.

Final handoff state after Audit 1 and exact remote read-back must truthfully reflect runtime prerequisites. On the current reconciliation truth the required state is:

~~~text
Planning Freeze: PASS
Runtime Dependency Gate: BLOCKED
Implement Gate: BLOCKED
Development Authorization: NOT GRANTED
STOP
~~~
