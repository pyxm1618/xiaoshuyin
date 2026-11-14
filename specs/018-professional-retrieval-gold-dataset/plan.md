# Slice 18 Implementation Plan — Professional Retrieval Gold Dataset Foundation

**Role**: Slice 18 Plan AI 2 — Plan + Checklist + Tasks + Audit 1 only  
**Repository**: pyxm1618/xiaoshuyin  
**Planning branch**: plan/018-professional-retrieval-gold-dataset  
**Frozen Spec**: commit 4624b3df6d59c6055421e175b95051782615de9a / blob bf7540ff3097ef14ca1c62a395b155abd4fde66a  
**Planning base**: exact Frozen Spec commit 4624b3df6d59c6055421e175b95051782615de9a  
**Execution context**: REMOTE-ONLY. GitHub remote truth is authoritative. No local checkout, local HEAD, local working tree, or local git state is claimed.  
**Planning status**: COMPLETE subject to Audit 1 and final remote read-back.  
**Runtime status**: BLOCKED. T1801 is the only task allowed while the development-start gate is blocked.

## 1. Authority Gate

Planning was derived from the exact Frozen Spec and re-read remote authority, not from handoff assumptions.

| Authority | Exact remote truth | Result |
|---|---|---|
| origin/main | e7bb22d1abad58a6c9df6350744f092d88370aa3 | PASS |
| Frozen Spec branch | spec/018-professional-retrieval-gold-dataset | PASS |
| Frozen Spec branch head | 4624b3df6d59c6055421e175b95051782615de9a | PASS |
| Frozen Spec blob | bf7540ff3097ef14ca1c62a395b155abd4fde66a | PASS |
| Frozen Spec vs main | ahead 1 / behind 0; only spec.md added | PASS |
| Docs/总产品需求.md | 67724000cb9bb81c40489c04db28d899bd1df74c | PASS |
| Docs/V1产品需求.md | 1900485a407e0634643f4f0bbe5ab02476dc4bfd | PASS |
| Docs/总体技术架构.md | 9b08371edc976fa281469dfee8dc19962452e3b0 | PASS |
| Docs/V1技术设计.md | 6f03d1a3c49bdc866945ae7f82df542f1292a147 | PASS |
| Slice 16 Frozen Spec | 05aa4594cbb99c433035f9fa313376a7fec99785 / a6cd9fd723f9339b575757279703be554afaf0f6 | PASS |
| Slice 16 planning freeze | 40d6c4e19b9207b287aec03c5ba02868260dd8fe | PASS as planning only |
| Slice 17 Frozen Spec | a345937868ca1b8d2cef65003d4197de4207eb52 / 866c3f77dd269c94d420d9c0ae6b918f114286ce | PASS |
| Slice 17 spec branch current head | 22e69a546e00a37b6bf26fb3e28b10e18fd6f024; spec.md only | PASS |
| Slice 17 planning branch | plan/017-professional-knowledge-foundation | PASS; sole planning authority |
| Slice 17 planning freeze | a1d4e4390d313502696493573243adf401dbae90 | PASS as planning only |
| Existing plan/018 before creation | none | PASS |
| Existing feat/018 before creation | none | PASS |

### 1.1 Input drift

Current main and all four Authority Doc blobs equal the final Slice 18 selection baseline. The Slice 17 authority-convergence commit changed only the current spec-branch head and removed competing planning files while preserving the exact Frozen Spec blob and authoritative plan branch.

~~~text
Input Drift:
NONE
~~~

Any later semantic change to the Frozen Spec, four Authority Docs, Slice 16/17 owner semantics, or a new competing Slice 18 authority is a STOP. Developer AI may reconcile only non-semantic execution drift at T1801 and may not rewrite this planning package to conceal an authority change.

## 2. Scope and Owner Boundary

Slice 18 owns exactly one new truth family:

> Professional Retrieval Gold Dataset evaluation truth.

It owns:

- dataset identity and dataset version;
- immutable release manifest identity/hash;
- corpus manifest identity/hash;
- evaluation case identity/hash;
- query origin/provenance classification;
- graded relevant exact Knowledge refs;
- forbidden exact Knowledge refs plus evaluation reason class;
- expected-empty truth;
- hard-filter expectations for evaluation;
- review binding to exact payload/corpus hashes;
- release identity;
- predecessor/successor history and retirement event history.

It consumes, never duplicates:

- Professional Knowledge Item identity/version/content hash/lifecycle/package contribution from Slice 17;
- Intervention/professional provenance truth from Slice 16 where applicable;
- Scene/package identity from the existing Scene owner;
- Authorization, Consent, Compliance and Safety owners;
- any real professional/evaluation reviewer authority that exists at implementation time.

Gold labels are evaluation annotations only. They cannot activate an Intervention, progress a Case, confirm a Formulation, grant access or Consent, clear Safety, publish Knowledge, or select a production model/route.

## 3. Explicit Non-Goals

No implementation task may add or authorize:

- PostgreSQL upgrade work;
- pgvector, sparsevec, vector schema/index, knowledge_embeddings;
- DashScope provider adapters or embedding calls;
- pg_jieba runtime or professional lexical dictionary runtime;
- pg_textsearch;
- chunking, parser, crawler, ingestion pipeline;
- retrieval/search, RRF, fusion, reranking;
- RAG candidate A/B/C execution or route selection;
- production numeric winner thresholds;
- Context Builder;
- AI Task Runtime, ai_runs, TaskModelRegistry or provider execution;
- Vercel AI SDK execution;
- Jev, Promptfoo platform, DeepEval, Phoenix or Langfuse;
- Problem Formulation AI, A4003 model execution or execution-support AI;
- Family Memory;
- Phase 4 Goal/Plan/Execution runtime;
- generic CMS, RBAC, workflow or eval registry service;
- new Knowledge, Intervention, Authorization, Consent, Compliance or Safety owner;
- production database migration or online Gold Dataset service.

The implementation delta must remain source-controlled evaluation artifacts, validation/contracts, narrow CI/offline tooling and tests only.

## 4. Repository Format Discovery

Remote main was scanned before selecting the Slice 18 artifact form.

Findings:

1. No root eval/ directory or authoritative Gold Dataset format exists on current main.
2. No existing files implementing suite_version/case_id/expected-forbidden evaluation authority were found.
3. tests/fixtures/digital-use/v1-product-node-manifest.snapshot.json is a test/Review snapshot for Scene topology. It is not an eval authority and must not be repurposed as the Gold Dataset owner.
4. packages/contracts already uses Zod 4.2 and exported typed contracts.
5. Vitest is the existing test runner.
6. scripts/guard-static.mjs and scripts/verify-all.mjs are the existing static/final verification seams.
7. V1 technical design explicitly reserves an eval capability area and requires Xiaoshuyin Gold Dataset evidence.

Decision:

> There is no authoritative eval artifact format to reuse. Slice 18 may create one bounded Professional Retrieval artifact family, using existing Zod/Vitest/Node tooling and no new platform dependency.

## 5. Canonical Artifact Form

When T1801 eventually passes, the implementation shall use this minimal source-controlled structure unless then-current main already contains a semantically equivalent single authority, in which case T1801 must STOP and return for planning reconciliation rather than create a parallel format.

~~~text
packages/contracts/src/professional-retrieval-gold.ts
packages/contracts/src/index.ts

eval/professional-retrieval/
  releases/
    <dataset_version>/
      manifest.json
      corpus-manifest.json
      cases.json
      review-bindings.json
  retirements/
    <dataset_version>.json
  synthetic/
    validator-self-test/
      ...

scripts/
  validate-professional-retrieval-gold.mjs
  check-slice18-scope.mjs

tests/eval/
  professional-retrieval-gold-contract.test.ts
  professional-retrieval-gold-validator.test.ts
  professional-retrieval-gold-lifecycle.test.ts
  professional-retrieval-gold-privacy.test.ts
  professional-retrieval-gold-reference.test.ts
  professional-retrieval-gold-scope.test.ts
~~~

The exact filenames may be adjusted only to match a real equivalent convention discovered at T1801. The architecture may not move into packages/rag, packages/ai, a database table, an online registry or a provider-specific directory.

Artifact rules:

- JSON is the canonical released data encoding.
- Zod is the typed contract/parse layer because it is already present in packages/contracts.
- Release artifacts are machine-readable, human-reviewable and source-controlled.
- No duplicate Knowledge body is required in a released case; exact Knowledge refs/hashes are stored instead.
- Synthetic validator fixtures are physically separated under synthetic/ and carry explicit SYNTHETIC identity.
- A synthetic artifact can validate mechanics but can never satisfy the production-quality dataset gate.

## 6. Exact Identity and Hash Contract

All released identities are explicit. Floating latest references are invalid.

### 6.1 Dataset identity

Minimum release manifest fields:

~~~text
dataset_name
dataset_version
schema_version
locale
status
corpus_manifest_version
corpus_manifest_hash
case_ids[]
case_hashes{}
review_bindings_hash
predecessor_dataset_version?
created_at
released_at
manifest_hash
~~~

For a release, status must equal RELEASED.

### 6.2 Corpus identity

Minimum corpus manifest fields:

~~~text
corpus_manifest_version
scene_id
package_version
members[]
corpus_manifest_hash
~~~

Each member minimally contains:

~~~text
knowledge_id
knowledge_version
knowledge_content_hash
knowledge_lifecycle_state_at_snapshot
scene_id
package_version
production_eligible_at_snapshot
source_provenance_ref?
fixture_role
~~~

fixture_role is PRODUCTION_MEMBER or NEGATIVE_FILTER_FIXTURE. A negative fixture never becomes eligible merely because it appears in the corpus snapshot.

### 6.3 Case identity

Each case contains:

~~~text
case_id
dataset_version
locale
query_text
query_origin_type
scenario
context
hard_filter_expectations[]
expected_relevant[]
forbidden_results[]
expected_empty
label_state
evaluation_dimensions[]
rationale
requirement_refs[]
review_binding_id
case_hash
~~~

### 6.4 Hash algorithm

To avoid ambiguous developer choices, Slice 18 uses one deterministic hash convention:

- algorithm: SHA-256;
- displayed form: sha256:<lowercase hex>;
- input: UTF-8 bytes of canonicalJsonV1 for the payload;
- canonicalJsonV1 recursively sorts object keys lexicographically, preserves array order, forbids non-JSON values and serializes with JSON.stringify semantics;
- a self-hash field is omitted from the payload before hashing;
- case_hash hashes the case payload excluding case_hash;
- corpus_manifest_hash hashes the corpus manifest payload excluding corpus_manifest_hash;
- review_bindings_hash hashes the complete review binding payload;
- manifest_hash hashes the release manifest payload excluding manifest_hash.

The canonicalizer is evaluation tooling, not a new business platform. Unit tests must prove stable hashes under object-key reordering and changed hashes under semantic payload changes.

Git commit identity remains release evidence in addition to these hashes; it does not replace them.

## 7. Dataset Lifecycle and Immutability

Lifecycle semantics remain:

~~~text
DRAFT -> REVIEWED -> RELEASED -> RETIRED
~~~

Operational interpretation:

- DRAFT may change and cannot support production retrieval evidence.
- REVIEWED means real review evidence binds the exact case hashes and exact corpus manifest hash.
- RELEASED is an exact immutable artifact cut.
- RETIRED means the released artifact remains immutable but is no longer valid for new route approval.

A released directory is never edited in place. Retirement is represented by an append-only retirement record under eval/professional-retrieval/retirements/ so the original release bytes remain unchanged.

A substantive correction creates a new dataset_version and sets predecessor_dataset_version to the prior exact version. The old release is preserved. A retirement record may identify the successor but does not mutate the predecessor manifest.

No alias such as current or latest is valid release evidence.

## 8. Query Provenance Contract

Allowed query_origin_type values for RELEASED cases:

- PROFESSIONALLY_AUTHORED_SYNTHETIC;
- PROFESSIONALLY_REVIEWED_SYNTHETIC_PARAPHRASE;
- PROFESSIONALLY_AUTHORED_TERMINOLOGY_OR_NEGATION.

AI-assisted drafting may exist only before release and must be recorded as draft provenance. It cannot be the release approver.

Explicitly forbidden sources:

- raw customer message;
- real Case export;
- copied private chat;
- identifiable child/family narrative;
- real account/person/family/case identifiers.

A release validator must reject forbidden provenance types. Mechanical identifier scanning supplements but does not replace professional review.

## 9. Relevance, Forbidden, Empty and UNKNOWN Semantics

### 9.1 Graded relevance

The exact released relevance vocabulary is:

~~~text
PRIMARY = 2
SUPPORTING = 1
~~~

Only positively relevant items appear in expected_relevant.

Non-relevant is represented by absence from expected_relevant. It is not encoded as an unresolved zero-grade label.

The numeric gain is an evaluation ordinal only. It is not an eligibility score, safety score, clinical score or business decision threshold.

### 9.2 Forbidden result

forbidden_results is independent from relevance and contains exact Knowledge refs plus one or more closed reason classes:

~~~text
WRONG_SCENE
WRONG_STAGE
WRONG_AGE_OR_DEVELOPMENT
INAPPLICABLE
EXCLUSION_OR_CONTRAINDICATION
WRONG_PACKAGE_OR_VERSION
NOT_PUBLISHED
RETIRED
SOURCE_OR_STATUS_INVALID
SEMANTIC_NEGATION_OR_OPPOSITE
~~~

Each forbidden entry also carries authority_refs[] that point to the real upstream reason. The Gold Dataset records expected evaluation behavior; it does not become the owner of the underlying rule.

### 9.3 Expected empty

If expected_empty=true:

- expected_relevant must be empty;
- the case is a valid resolved benchmark case, not UNKNOWN;
- a nearest-neighbor fallback is not labeled correct.

### 9.4 Unresolved

label_state has exactly:

~~~text
RESOLVED
UNRESOLVED
~~~

RELEASED requires RESOLVED. UNRESOLVED cannot be converted to irrelevant or expected_empty automatically.

## 10. Hard-Filter Expectation Representation

Case context records enough exact evaluation context to reproduce an expected filter outcome without copying rule engines.

Minimum context can include:

- exact scene_id;
- exact package_version;
- exact stage identifier when applicable;
- age/development context as an authority-backed categorical/ref value;
- applicability context refs;
- exclusion/contraindication context refs;
- lifecycle snapshot expectation.

hard_filter_expectations[] uses a closed dimension vocabulary:

~~~text
SCENE
STAGE
AGE_OR_DEVELOPMENT
PACKAGE_VERSION
LIFECYCLE
APPLICABILITY
EXCLUSION_OR_CONTRAINDICATION
RISK_COMPATIBILITY
~~~

Each expectation contains:

~~~text
dimension
expected_behavior: ALLOW | EXCLUDE | EXPECT_EMPTY
authority_refs[]
rationale
~~~

The expectation describes what a later evaluator should observe. It does not reimplement Scene, Knowledge, Intervention, Safety or Compliance logic.

## 11. Corpus Binding and Drift

Every RELEASED dataset binds one exact corpus manifest.

Rules:

1. expected_relevant and forbidden_results refs must resolve to exact members of the bound corpus manifest;
2. positive refs must be PUBLISHED and production_eligible_at_snapshot=true;
3. non-PUBLISHED/RETIRED members may exist only as explicit NEGATIVE_FILTER_FIXTURE members used to test leakage;
4. no case may use latest or implicit Knowledge version;
5. corpus member content hash must equal the authoritative Slice 17 content hash at snapshot creation;
6. corpus manifest scene/package identity must resolve through the real Scene/package owner;
7. changing any member identity/hash/lifecycle/package snapshot changes corpus_manifest_hash;
8. old evaluation evidence cannot claim applicability to the changed corpus.

The corpus manifest is a snapshot of exact refs/hashes, not a second editable Knowledge registry.

## 12. Review Authority and Evidence Binding

RELEASED labels require real accountable human review authority.

The implementation must consume an existing sanctioned professional/evaluation reviewer authority discovered by T1801. Slice 18 may not invent reviewer privileges.

review-bindings.json contains immutable bindings, not a new reviewer registry. Minimum binding:

~~~text
review_binding_id
review_owner_ref
review_evidence_ref
reviewed_case_hashes[]
reviewed_corpus_manifest_hash
decision
reviewed_at
binding_hash
~~~

decision must be APPROVED_FOR_GOLD_RELEASE for a release binding.

Requirements:

- review_owner_ref must resolve through the real authority seam;
- review_evidence_ref points to real evidence from that seam;
- the same retrieval/model candidate being evaluated cannot supply approval;
- AI may not approve;
- developer/test fixture identity may not approve;
- family account ownership does not confer reviewer authority;
- case or corpus hash change invalidates the binding;
- absence/unavailability of real reviewer authority keeps the release blocked.

Offline validation can prove exact binding/hash integrity. It must not pretend a string-shaped reviewer id proves authentic authority; release creation must also prove the referenced reviewer/evidence through the real owner.

## 13. Privacy and Data-Provenance Guard

RELEASED artifacts are restricted to professional/synthetic benchmark material.

Mechanical release checks must reject:

- forbidden query origin types;
- fields representing family_id, account_id, person_id or real case_id;
- known direct identifiers such as email addresses and phone-like values in query/rationale fields;
- raw private-chat/customer-export provenance markers;
- secrets/provider keys.

Because no static detector can prove absence of every possible identifier, professional review must include a privacy attestation. The validator is a fail-closed guard, not a claim of perfect PII detection.

No real household data is needed to make the benchmark meaningful.

## 14. Initial Released Dataset Coverage Gate

Once runtime prerequisites are real, the initial production-quality release cannot be cut until representative RESOLVED cases cover all Frozen Spec dimensions:

1. direct Chinese professional terminology;
2. natural-language paraphrase;
3. short ambiguous phrasing;
4. negation;
5. exclusion/contraindication phrasing;
6. age/development mismatch;
7. stage mismatch;
8. scene mismatch;
9. package/version mismatch;
10. non-PUBLISHED lifecycle exclusion;
11. RETIRED exclusion;
12. semantically similar but professionally wrong content;
13. multiple supporting items;
14. one dominant primary plus supporting items;
15. truthful expected-empty;
16. source/reference fidelity where required;
17. demonstration/example not treated as universal rule;
18. Digital Use vocabulary useful for future lexical-vs-dense discrimination.

Coverage is semantic, not a numeric route threshold. The Plan does not prescribe a minimum benchmark size beyond enough distinct cases to non-vacuously cover every required dimension.

## 15. Metric Compatibility Only

The released schema must permit future consumers to compute on the same exact dataset/corpus:

- Recall@K;
- nDCG@K;
- MRR;
- hard-filter fidelity;
- forbidden-result leakage count/rate;
- expected-empty fidelity;
- terminology retrieval;
- negation/exclusion fidelity;
- scene/stage/age/package/lifecycle filter fidelity;
- pre/post-rerank delta.

Slice 18 may provide a pure projection from Gold labels to evaluator inputs. It must not execute candidate A/B/C, embedding or reranker calls and must not define production winner thresholds.

No value such as Recall@10 >= X, MRR >= Y, or leakage <= Z is authorized here.

## 16. Validator Contract

A deterministic offline validator is required.

It must validate at minimum:

- Zod schema validity;
- supported schema_version;
- exact SHA-256 hash validity;
- dataset_version consistency across manifest/cases;
- corpus manifest version/hash consistency;
- stable unique case_id values;
- unique exact Knowledge refs where duplication would be ambiguous;
- no floating latest/current alias;
- all relevant and forbidden refs exist in the bound corpus;
- all positive refs are PUBLISHED/eligible in the snapshot;
- negative lifecycle fixtures are explicitly marked;
- RELEASED cases are RESOLVED;
- expected_empty implies no positive refs;
- forbidden and expected-relevant sets do not overlap for the same exact ref;
- allowed query provenance;
- review bindings cover every released case hash and exact corpus hash;
- no missing review evidence refs;
- release artifacts contain no banned family identifier fields or direct-identifier patterns;
- predecessor linkage is exact if present;
- retirement records reference an existing immutable release;
- released directories are not modified/deleted in a later delta;
- synthetic fixtures are marked SYNTHETIC and excluded from production evidence;
- all required initial coverage dimensions are present before production-quality RELEASED status is accepted.

The validator must return distinct machine-readable failure codes for at least:

~~~text
SCHEMA_INVALID
HASH_MISMATCH
DUPLICATE_CASE_ID
FLOATING_REFERENCE
REFERENCE_INVALID
CORPUS_MISMATCH
UNRESOLVED_LABEL
EXPECTED_EMPTY_CONFLICT
FORBIDDEN_POSITIVE_OVERLAP
REVIEW_MISSING
REVIEW_BINDING_MISMATCH
PRIVACY_GUARD_FAILED
IMMUTABLE_RELEASE_MODIFIED
SUCCESSOR_INVALID
SYNTHETIC_EVIDENCE_FORBIDDEN
COVERAGE_INCOMPLETE
~~~

## 17. Non-Vacuous Self-Tests

The validator and scope guard must prove they can detect violations, not merely report zero matches.

Synthetic test-only fixtures must include at least one known failing sample for each critical guard family:

- wrong hash;
- duplicate case id;
- latest Knowledge ref;
- missing Knowledge ref;
- unresolved released label;
- expected_empty with a positive ref;
- same ref both positive and forbidden;
- missing/fake-shaped review binding with no authority evidence;
- identifiable family/account/case-shaped field;
- attempt to modify an existing released artifact;
- invalid successor/predecessor;
- synthetic corpus presented as production evidence;
- forbidden implementation path or dependency.

Tests must assert the specific expected failure code. These fixtures are marked SYNTHETIC and cannot be cited as retrieval-quality evidence.

## 18. Negative Scope / Static Guard

A narrow check-slice18-scope script must inspect the implementation delta against the exact development base.

It fails if Slice 18 adds or changes, absent explicit pre-existing equivalent reuse:

- db/migrations/**;
- db/schema/** for Gold Dataset persistence;
- packages/rag/**;
- packages/ai/**;
- packages/memory/**;
- production API routes/endpoints for Gold Dataset;
- provider adapters or network model calls;
- pgvector/sparsevec/pg_jieba/pg_textsearch runtime code;
- retrieval/ranking/reranking/fusion execution;
- new RBAC/CMS/workflow/eval registry services.

It must also fail on new production dependencies whose only purpose is one of those forbidden capabilities.

The detector must expose pure path/dependency checks so tests can feed synthetic forbidden deltas and prove non-vacuity.

## 19. Release and Remote Read-Back

A release is complete only when one exact source-control commit contains:

- exact release manifest;
- exact corpus manifest;
- exact cases;
- exact review bindings;
- all hashes mutually consistent;
- validator PASS;
- scope guard PASS.

If a client loses the response after the commit exists, remote read-back determines whether the exact release exists. No second idempotency store is added.

Release evidence for future consumers is:

~~~text
git_commit_sha
dataset_version
manifest_hash
corpus_manifest_version
corpus_manifest_hash
case_hashes
review_bindings_hash
~~~

A future consumer must record these exact values. It cannot record only a friendly dataset name.

## 20. Development-Start Gate — T1801

T1801 is READ-ONLY and is the only executable task while the gate is blocked.

It must re-read then-current remote truth and prove every predicate:

1. Slice 17 Professional Knowledge runtime has independent Audit 2 PASS and is merged to main.
2. Exact Knowledge id/version/content-hash/lifecycle/package resolution exists on merged main.
3. A representative real PUBLISHED V1 Professional Knowledge corpus exists.
4. Required Slice 16 Intervention/provenance authority is merged and usable where Slice 17 depends on it.
5. A real professional/evaluation reviewer authority exists and can produce accountable review evidence.
6. Exact Scene/package identity is available from its real owner.
7. A sanctioned professional audit/review evidence seam exists without fake family/global duplicate ledger.
8. No second Knowledge/package/eval owner is required.
9. No semantic drift exists in the four Authority Docs, Frozen Slice 18 Spec, or consumed Slice 16/17 authority.
10. No competing spec/plan/feat Slice 18 authority exists.
11. No newly merged canonical eval artifact format makes this Plan a parallel authority.

If any predicate fails:

~~~text
READY FOR DEVELOPMENT = NO
Runtime Dependency Gate = BLOCKED
Implement Gate = BLOCKED
Development Authorization = NOT GRANTED
STOP
~~~

No schema, validator, fixture, test, migration or production edit may follow in that run.

Current planning-time result:

- Slice 17 runtime is not implemented/merged.
- Slice 16 runtime is not merged.
- no real professional/evaluation reviewer authority is proven on main.
- therefore T1801 would currently return BLOCKED.

This is an expected correct result, not a planning defect.

## 21. Implementation Sequence After T1801 PASS

Only after T1801 passes, implementation proceeds in dependency order:

1. re-confirm/reuse any canonical eval format;
2. add typed Gold contracts and hash canonicalization;
3. add corpus manifest builder/validator using the real Slice 17 read seam;
4. add case/query provenance and label semantics;
5. add hard-filter expectation representation;
6. bind real review evidence;
7. add lifecycle/release/retirement/successor handling;
8. add deterministic offline validator;
9. add privacy and exact-reference guards;
10. add isolated synthetic self-test fixtures;
11. add metric-compatibility projection only;
12. add future-consumer exact evidence contract;
13. add negative scope guard;
14. create the first real reviewed dataset only from the representative published corpus;
15. run exact-head full regression and evidence freeze.

No later task may weaken an earlier gate.

## 22. Expected File / Module Strategy

Allowed implementation areas are intentionally narrow:

- packages/contracts for typed Zod schemas and exported types;
- eval/professional-retrieval for source-controlled evaluation artifacts only;
- scripts for offline validator/scope checks;
- tests/eval for Slice 18 tests;
- package.json / scripts/verify-all.mjs only as needed to wire the validator into existing verification.

Potential modifications to unrelated domain/application/DB code are a STOP and require justification against the Frozen Spec. No production route should be needed.

## 23. Testing Contract

Tests must cover:

### 23.1 Contract tests
- strict schema rejects unknown/invalid fields where ambiguity affects authority;
- exact finite vocabularies;
- canonical hash determinism;
- exact version/ref constraints.

### 23.2 Reference tests
- positive refs resolve;
- forbidden refs resolve;
- latest/current aliases fail;
- missing refs fail;
- wrong corpus hash fails;
- PUBLISHED/eligible positive requirement;
- negative lifecycle fixtures remain negative.

### 23.3 Lifecycle tests
- DRAFT/REVIEWED do not count as release evidence;
- RELEASED artifact mutation is rejected;
- successor creates a new version;
- retirement is append-only;
- retired release cannot be used for new route approval metadata.

### 23.4 Review tests
- exact case/corpus hash binding;
- changed payload invalidates review;
- absent evidence fails;
- AI/candidate/test fixture cannot satisfy release authority.

### 23.5 Privacy tests
- forbidden origin types fail;
- direct known identifiers fail;
- family/account/person/real-case fields fail;
- synthetic/professional content passes.

### 23.6 Non-vacuous negative tests
Every validator/scope guard family has at least one synthetic failing sample with an asserted failure code.

### 23.7 Coverage tests
The initial real release has non-vacuous cases for all 18 required coverage dimensions.

### 23.8 Regression
Run existing typecheck, Vitest, static guard, governance checks and exact-head verification. No existing tests may be weakened merely to make Slice 18 pass.

## 24. Traceability

| Frozen requirement family | Plan sections | Primary tasks |
|---|---|---|
| FR-001..005 authority/corpus/no duplicate Knowledge | 2, 5, 6, 11 | T1802-T1804, T1812 |
| FR-006..008 case/provenance/privacy | 6, 8, 13 | T1805, T1811 |
| FR-009..012 relevant/forbidden/empty/UNKNOWN | 9 | T1806 |
| FR-013..017 hard filters/negation/Chinese terminology | 10, 14 | T1807, T1814 |
| FR-018..021 shared benchmark/metric/rerank compatibility | 15 | T1814, T1815 |
| FR-022..023 review/no self-approval | 12 | T1808 |
| FR-024..026 immutable/successor/retired | 7 | T1809, T1818 |
| FR-027..029 no thresholds/retrieval/runtime DB | 3, 18 | T1816 |
| FR-030..031 reproducible validation/release evidence | 16, 19 | T1810, T1817, T1822 |
| FR-032 authority preservation | 2, 10 | T1807, T1816 |
| FR-033 synthetic isolation | 17 | T1813 |
| FR-034 provenance traceability | 8, 11, 12 | T1804, T1805, T1808 |
| FR-035 no generic platform | 3, 18 | T1816 |

Acceptance scenarios AS-001..AS-028 are mapped in tasks.md to executable test/evidence tasks. Negative scenarios NS-01..NS-18 are mapped primarily to T1816 plus exact-delta Audit 2 evidence.

## 24A. Exact Planning Traceability Matrix

This matrix expands every Frozen FR/AS/NS individually so Developer AI and Audit 2 do not need to infer coverage from ranges.

### Functional Requirements

| Requirement | Planned execution |
|---|---|
| FR-001 | T1802, T1803, T1816 |
| FR-002 | T1803, T1817 |
| FR-003 | T1804, T1817 |
| FR-004 | T1804, T1812 |
| FR-005 | T1804, T1816 |
| FR-006 | T1805, T1817 |
| FR-007 | T1805, T1811 |
| FR-008 | T1811, T1819 |
| FR-009 | T1806, T1814 |
| FR-010 | T1806, T1807 |
| FR-011 | T1806, T1810, T1814 |
| FR-012 | T1806 |
| FR-013 | T1807 |
| FR-014 | T1804, T1807, T1814 |
| FR-015 | T1807, T1814 |
| FR-016 | T1807, T1814 |
| FR-017 | T1814 |
| FR-018 | T1814, T1815 |
| FR-019 | T1814 |
| FR-020 | T1814 |
| FR-021 | T1814, T1815 |
| FR-022 | T1808 |
| FR-023 | T1808, T1819 |
| FR-024 | T1809, T1818 |
| FR-025 | T1809, T1818 |
| FR-026 | T1809, T1818 |
| FR-027 | T1814, T1816 |
| FR-028 | T1816 |
| FR-029 | T1816 |
| FR-030 | T1810, T1817, T1819 |
| FR-031 | T1815, T1822 |
| FR-032 | T1807, T1816 |
| FR-033 | T1813 |
| FR-034 | T1804, T1805, T1808 |
| FR-035 | T1816 |

### Acceptance Scenarios

| Scenario | Planned execution |
|---|---|
| AS-001 | T1806, T1814 |
| AS-002 | T1806, T1814 |
| AS-003 | T1807, T1814 |
| AS-004 | T1807, T1814 |
| AS-005 | T1807, T1814 |
| AS-006 | T1807, T1812, T1814 |
| AS-007 | T1804, T1807, T1814 |
| AS-008 | T1804, T1807, T1814 |
| AS-009 | T1804, T1807, T1814 |
| AS-010 | T1807, T1814 |
| AS-011 | T1807, T1814 |
| AS-012 | T1805, T1814 |
| AS-013 | T1814 |
| AS-014 | T1806, T1814 |
| AS-015 | T1806, T1810 |
| AS-016 | T1804, T1812, T1817 |
| AS-017 | T1809, T1818 |
| AS-018 | T1805, T1808, T1819 |
| AS-019 | T1808, T1819 |
| AS-020 | T1811, T1819 |
| AS-021 | T1812, T1819 |
| AS-022 | T1812, T1819 |
| AS-023 | T1817, T1819 |
| AS-024 | T1814, T1815 |
| AS-025 | T1807, T1814 |
| AS-026 | T1807, T1816 |
| AS-027 | T1810, T1813 |
| AS-028 | T1809, T1822 |

### Negative Scope Scenarios

| Scenario | Planned execution |
|---|---|
| NS-01 | T1816 |
| NS-02 | T1816 |
| NS-03 | T1816 |
| NS-04 | T1816 |
| NS-05 | T1816 |
| NS-06 | T1816 |
| NS-07 | T1816 |
| NS-08 | T1816 |
| NS-09 | T1816 |
| NS-10 | T1816 |
| NS-11 | T1811, T1816 |
| NS-12 | T1816 |
| NS-13 | T1816 |
| NS-14 | T1814, T1816 |
| NS-15 | T1812, T1815 |
| NS-16 | T1813 |
| NS-17 | T1809, T1818 |
| NS-18 | T1807, T1816 |

## 25. Planning Decisions Frozen by Plan AI 2

The following implementation-level decisions are fixed to eliminate Developer guesswork without changing Frozen product semantics:

1. one bounded artifact family under eval/professional-retrieval;
2. JSON release artifacts + existing Zod typed contracts;
3. no production DB persistence;
4. SHA-256 canonicalJsonV1 hashes;
5. relevance grades PRIMARY=2 and SUPPORTING=1 only;
6. irrelevant is absence, forbidden is separate, unresolved is non-released;
7. released bytes are immutable; retirement is append-only;
8. real review authority is consumed, never invented;
9. synthetic fixtures are physically isolated and cannot satisfy production evidence;
10. validator and scope guards require positive failure self-tests;
11. metric compatibility contains no candidate execution and no production thresholds;
12. T1801 blocks every implementation edit until all runtime/authority prerequisites are real.

## 26. Audit 1 Contract

Audit 1 must independently answer:

- Q1 Frozen Spec Fidelity;
- Q2 Scope Convergence;
- Q3 Authority Preservation;
- Q4 Dependency Truth;
- Q5 Reviewer Authenticity;
- Q6 Data Privacy;
- Q7 Reference Integrity;
- Q8 Lifecycle Integrity;
- Q9 Validation Non-Vacuity;
- Q10 Implement Gate truthfulness.

Any CRITICAL/HIGH/MEDIUM planning defect must be remediated only in plan.md/checklist.md/tasks.md, followed by a complete re-audit. Frozen Spec, Docs, production code, tests, migrations and upstream Slice artifacts are not editable during planning.

## 27. Stop Boundary

After Audit 1 FINAL PASS and Planning Freeze remote read-back, Plan AI 2 stops.

Planning completion does not imply development authorization.

Current expected final state is:

~~~text
Planning Freeze: PASS
Runtime Dependency Gate: BLOCKED
Implement Gate: BLOCKED
Development Authorization: NOT GRANTED
READY FOR DEVELOPMENT: NO
~~~

## 28. Audit 1 Closure

Audit 1 was performed only after Plan, Checklist and Tasks existed.

### Initial finding

~~~text
MEDIUM-01 — Planning traceability was expressed partly as FR/AS ranges.
Impact: Developer AI / Audit 2 would need to expand ranges manually, weakening mechanical coverage proof.
Remediation: Added §24A exact one-by-one mapping for all FR-001..035, AS-001..028 and NS-01..18.
~~~

No Frozen Spec, Authority Doc, production code, test, migration or upstream Slice artifact was changed.

A complete re-audit after remediation produced:

~~~text
Q1 Frozen Spec Fidelity: PASS
Q2 Scope Convergence: PASS
Q3 Authority Preservation: PASS
Q4 Dependency Truth: PASS
Q5 Reviewer Authenticity: PASS
Q6 Data Privacy: PASS
Q7 Reference Integrity: PASS
Q8 Lifecycle Integrity: PASS
Q9 Validation Non-Vacuity: PASS
Q10 Implement Gate: PASS

CRITICAL: 0
HIGH: 0
MEDIUM: 0
LOW: 0

Audit 1: FINAL PASS
Scope Drift: 0
~~~

The Audit 1 PASS applies to planning quality only. Runtime Dependency Gate and Implement Gate remain BLOCKED.

