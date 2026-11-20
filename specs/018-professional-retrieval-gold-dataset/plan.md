# Slice 18 Implementation Plan — Professional Retrieval Gold Dataset Foundation

**Role**: Slice 18 Plan AI 2 — Plan + Checklist + Tasks + Audit 1 only  
**Repository**: pyxm1618/xiaoshuyin  
**Planning branch**: plan/018-professional-retrieval-gold-dataset-authority-reconciliation  
**Reconciled Frozen Spec**: commit 1f7f6804e99dd688a91accc73a18519c8cd69a2a / blob 1d18fa97a29b3a26d3ff9b0da8dbaf4007649af3  
**Previous Frozen Spec**: commit 4624b3df6d59c6055421e175b95051782615de9a / blob bf7540ff3097ef14ca1c62a395b155abd4fde66a  
**Planning base**: exact Reconciled Frozen Spec commit 1f7f6804e99dd688a91accc73a18519c8cd69a2a  
**Execution context**: REMOTE-ONLY. GitHub remote truth is authoritative. No local checkout, local HEAD, local working tree, or local git state is claimed.  
**Planning status**: CURRENT-MAIN RECONCILED — Audit 1 FINAL PASS / Planning Freeze PASS (2026-11-20 refresh).  
**Runtime status**: BLOCKED. T1801 is the only task allowed while the development-start gate is blocked.

## 1. Authority Gate

This reconciliation is derived from the exact current four Authority Docs plus current remote upstream truth. The old planning baseline is historical evidence only.

| Authority | Exact remote truth | Reconciliation result |
|---|---|---|
| origin/main | 1b7a9d817713692cc1b895a7f601f07e8123f8fa | PASS as 2026-11-20 reconciliation snapshot; T1801 re-reads at execution |
| Reconciled Spec branch | spec/018-professional-retrieval-gold-dataset-authority-reconciliation | PASS |
| Reconciled Spec head | 1f7f6804e99dd688a91accc73a18519c8cd69a2a | PASS |
| Reconciled Spec blob | 1d18fa97a29b3a26d3ff9b0da8dbaf4007649af3 | PASS |
| Previous Frozen Spec | 4624b3df6d59c6055421e175b95051782615de9a / bf7540ff3097ef14ca1c62a395b155abd4fde66a | historical / preserved |
| Docs/总产品需求.md | 97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29 | current |
| Docs/V1产品需求.md | 379cb8cfb377924cd21ccfe55baa5aecdf207f5e | current |
| Docs/总体技术架构.md | 6b4630803f371faf6d93f27361070223d0f661a0 | current |
| Docs/V1技术设计.md | afef9fcc4af41b6137e5020717135972a3d515fc | current |
| Slice 16 | PR #57 MERGED; remediation PR #59 MERGED as ae161c4680cd3e744d7337291922b487d6e03970; exact-head PR #59 CI/Spec Governance PASS and post-merge main CI/Spec Governance PASS | old unmerged-remediation blocker RETIRED; T1801 still re-reads audit provenance/runtime usability |
| Slice 17 | PR #58 MERGED as current main 1b7a9d817713692cc1b895a7f601f07e8123f8fa; exact-head PR CI/Spec Governance PASS and post-merge main CI/Spec Governance PASS | old not-merged blocker RETIRED; merged Knowledge runtime is current-main truth; T1801 still re-reads Audit 2 provenance/runtime usability |
| Production-approved Professional Knowledge corpus | Digital Use Scene package v1 exact binding is empty | BLOCKED |
| Professional Reviewer | APPROVED PROFESSIONAL REVIEWER — UNASSIGNED; production approval/qualification providers are UNAVAILABLE | BLOCKED |
| Competing Slice 18 reconciliation authority | none found after exhaustive 018 branch search | PASS |

### 1.1 Authority drift

~~~text
Authority Drift:
NON-CONFLICTING — 2026-11-20 current-main Authority evolution

Historical 2026-11-17 Authority Reconciliation Drift:
RESOLVED

Selection Drift:
NONE

Selection:
PRESERVE — Professional Retrieval Gold Dataset Foundation
~~~

The current four Authority Docs changed after the original freeze. The reconciled Spec resolves only these conflicts:

1. Professional Gold labels/rubrics are Professional Authority;
2. approval requires real Staff assignment + PROFESSIONAL_REVIEW + matching qualification/scope + auditable reviewer identity;
3. approval binding is exact to artifact/package/version/content/source/scope;
4. lifecycle is separate from review_state/validity_state;
5. NEEDS_REVIEW is an affected-object fail-closed revalidation state;
6. dependency drift propagates only to genuinely dependent dataset/case objects;
7. T1801 reflects current Slice 16/17/reviewer truth and blocks all implementation while any predicate is unproven.

No retrieval, model, database, RAG, pgvector, Promptfoo, AI runtime or generic approval-platform scope is added.
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
- the existing Professional Authority owner for real Staff assignment, PROFESSIONAL_REVIEW capability, matching professional qualification/scope and auditable approval evidence.

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
  revalidations/
    <dataset_version>/
      <event_id>.json
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
lifecycle_status_at_release
corpus_manifest_version
corpus_manifest_hash
case_ids[]
case_hashes{}
review_bindings_hash
professional_approval_binding_hash
predecessor_dataset_version?
created_at
released_at
manifest_hash
~~~

For an immutable release cut, lifecycle_status_at_release must equal RELEASED. Current lifecycle/review validity is derived from append-only retirement/revalidation records; it is not rewritten into released bytes.

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
professional_approval_binding_id
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

## 7. Dataset Lifecycle, Review State, Validity and Immutability

Lifecycle and review validity are independent.

~~~text
artifact lifecycle_status:
DRAFT -> RELEASED -> RETIRED

review_state:
CURRENT <-> NEEDS_REVIEW

validity where separately materialized:
VALID / INVALID
~~~

`REVIEWED` is not a lifecycle status. Professional review is an upstream approval prerequisite bound by §12.

Operational interpretation:

- DRAFT may change and cannot support production retrieval evidence.
- RELEASED is an exact immutable artifact cut.
- RELEASED + CURRENT/VALID may support new route approval only while all bound professional/dependency predicates remain current.
- RELEASED + NEEDS_REVIEW remains historical RELEASED bytes but is barred from current route/model approval evidence.
- RETIRED means the lifecycle owner intentionally withdraws the release from new use; it is not a substitute for NEEDS_REVIEW.
- INVALID means the exact affected object cannot legally/professionally continue to serve current evidence; invalidation does not rewrite release bytes.

A released directory is never edited in place. Retirement and revalidation are append-only records outside the release bytes.

Revalidation outcomes:

1. dependency/professional change is unrelated → no state change;
2. related change with no material impact → append revalidation evidence and restore/retain CURRENT/VALID;
3. related material impact → create and professionally approve a successor dataset_version; predecessor bytes remain immutable and cannot claim current validity;
4. dependency permanently unusable → affected release/case remains invalid for current use; RETIRED only if lifecycle owner intentionally retires it.

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

## 11. Corpus Binding and Affected-Only Dependency Drift

Every RELEASED dataset binds one exact corpus manifest.

Rules:

1. expected_relevant and forbidden_results refs resolve to exact members of the bound corpus manifest;
2. positive refs are PUBLISHED and production_eligible_at_snapshot=true;
3. non-PUBLISHED/RETIRED members may exist only as explicit NEGATIVE_FILTER_FIXTURE members used to test leakage;
4. no case uses latest or implicit Knowledge version;
5. member content hash equals the authoritative Slice 17 content hash at snapshot creation;
6. corpus scene/package identity resolves through the real owner;
7. changing a referenced member identity/hash/lifecycle/package/provenance changes the exact dependency identity and requires impact evaluation;
8. Knowledge content/version/provenance changes, Professional approval withdrawal/expiry, reviewer qualification/scope changes, package version changes, policy changes, and other professional dependency invalidation trigger revalidation only for dataset/case objects that actually reference the changed dependency;
9. unrelated upstream changes do not mechanically invalidate or retire unrelated dataset/case objects;
10. while an affected release/case is NEEDS_REVIEW or INVALID, it cannot serve as current route approval evidence;
11. old historical evaluation evidence remains tied to its old exact corpus/release identity and cannot claim applicability to the changed corpus.

The corpus manifest is a snapshot of exact refs/hashes, not a second editable Knowledge registry.
## 12. Professional Review Authority and Exact Approval Binding

Professional Gold labels/rubrics are Professional Authority.

The implementation consumes the existing sanctioned Professional Authority seam discovered by T1801. Slice 18 creates no Staff owner, capability system, qualification registry, reviewer registry, RBAC service or generic approval platform.

Minimum authority predicates for a release approval:

~~~text
real_staff_assignment_ref
PROFESSIONAL_REVIEW capability/grant
reviewer_identity_ref
qualification_ref
qualification_scope
approval_scope
artifact/package identity
exact dataset/case version/content hashes
exact corpus_manifest_hash
source_refs
reviewed_at
approval_status
effective/published identity or effective period
binding_hash
~~~

A Staff capability alone is insufficient; professional qualification and scope must match the artifact approval scope.

`review-bindings.json` contains immutable references/bindings to the real approval, not a new authority registry.

Requirements:

- real Staff assignment must be current;
- PROFESSIONAL_REVIEW must be current and scoped;
- reviewer qualification must be current and match approval scope;
- approval binds exact immutable artifact/case/corpus identities and source refs;
- approval status/effective or published identity must be current;
- AI/retrieval candidate/LLM judge/Promptfoo judge cannot approve;
- developer/test fixture/family role/generic admin flag cannot approve;
- changed approved bytes/hash, changed scope, expired/withdrawn approval, revoked capability/assignment/qualification, or qualification-scope mismatch invalidates the affected approval for current use;
- absence/unavailability of any required authority predicate keeps release/current evidence fail closed.

Offline validation can prove exact binding/hash integrity. Authenticity must resolve through the real authority owner; a string-shaped reviewer id or `approved: true` cannot prove authority.

Current organization truth remains:

> APPROVED PROFESSIONAL REVIEWER — UNASSIGNED
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
professional_approval_binding_hash
current_revalidation_evidence_hash?
~~~

A future consumer must record these exact values. It cannot record only a friendly dataset name.

## 20. Development-Start Gate — T1801

T1801 is READ-ONLY, FIRST, and the only executable task while the gate is blocked.

It must re-read then-current remote truth and prove every predicate:

1. current main exact SHA;
2. reconciled Slice 18 Frozen Spec exact blob and unique current authority;
3. Slice 16 current merge state, post-merge audit state, remediation state and runtime usability;
4. Slice 17 current merge state, independent Audit 2 status and runtime usability;
5. exact merged Knowledge id/version/hash/lifecycle/package resolution;
6. representative real PUBLISHED Professional Knowledge corpus;
7. real Staff assignment for the reviewer;
8. PROFESSIONAL_REVIEW capability;
9. matching professional qualification/scope with qualification_ref;
10. auditable reviewer identity;
11. sanctioned professional review/approval evidence seam;
12. approval binding supports exact artifact/package/version/content hash/source refs/approval scope/reviewer/qualification/reviewed_at/status/effective-published identity;
13. exact Scene/package identity;
14. no duplicate Knowledge/package/reviewer/eval owner;
15. no Authority drift after this reconciliation;
16. no competing Slice 18 authority.

If any predicate fails:

~~~text
READY FOR DEVELOPMENT = NO
Runtime Dependency Gate = BLOCKED
Implement Gate = BLOCKED
Development Authorization = NOT GRANTED
STOP
~~~

No schema, validator, fixture, test, migration, real Gold label, production artifact or production-code edit may follow in that run.

Current-main refresh planning-time result — 2026-11-20:

- Slice 16 PR #57 and remediation PR #59 are merged; current-main runtime seams are present and current CI / Spec Governance are green; T1801 still independently re-reads audit provenance and runtime usability rather than inferring them from merge status;
- Slice 17 PR #58 is merged as current main and the Professional Knowledge runtime is present; T1801 still re-reads independent Audit 2 provenance and runtime usability;
- the current Digital Use v1 production-approved Professional Knowledge set is exactly EMPTY;
- APPROVED PROFESSIONAL REVIEWER remains UNASSIGNED and production approval / qualification providers remain UNAVAILABLE;
- therefore T1801 currently returns BLOCKED.

This is an expected correct result, not a planning defect.
## 21. Implementation Sequence After T1801 PASS

Only after T1801 passes, implementation proceeds in dependency order:

1. re-confirm/reuse any canonical eval format;
2. add typed Gold contracts and hash canonicalization;
3. add corpus manifest builder/validator using the real Slice 17 read seam;
4. add case/query provenance and label semantics;
5. add hard-filter expectation representation;
6. bind real Staff/PROFESSIONAL_REVIEW/qualification-backed Professional approval evidence;
7. add lifecycle/review-state/validity separation, affected-only dependency revalidation, release/retirement/successor handling;
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

### 23.3 Lifecycle / review-state / dependency tests
- DRAFT does not count as release evidence;
- REVIEWED is rejected as a lifecycle status;
- RELEASED + CURRENT/VALID can be eligible only with current approval/dependencies;
- RELEASED + NEEDS_REVIEW is blocked from current route approval evidence;
- dependency drift marks only affected objects NEEDS_REVIEW;
- unrelated upstream change leaves unrelated releases CURRENT;
- no-material-impact re-review restores CURRENT/VALID by append-only evidence;
- material-impact re-review requires a successor version;
- permanent dependency invalidity blocks current use;
- RELEASED artifact mutation is rejected;
- retirement is append-only and is not used as a substitute for NEEDS_REVIEW;
- retired release cannot be used for new route approval metadata.

### 23.4 Professional approval tests
- exact artifact/case/corpus/source/scope hash binding;
- valid Staff assignment + PROFESSIONAL_REVIEW + matching qualification/scope passes;
- wrong capability, revoked capability, missing/revoked assignment, wrong qualification, wrong qualification scope fail;
- stale/expired/withdrawn approval and hash drift fail;
- absent evidence fails;
- AI/candidate/test fixture/developer/family-role reviewer cannot satisfy release authority.

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
| FR-036..040 Professional authority / lifecycle separation / NEEDS_REVIEW / affected-only propagation / stale approval | 7, 11, 12, 20, 23 | T1801, T1808, T1809, T1818, T1819 |
| FR-041..042 revalidation outcomes / immutable history | 7, 11, 19, 23 | T1809, T1818, T1822 |

Acceptance scenarios AS-001..AS-037 are mapped in tasks.md to executable test/evidence tasks. Negative scenarios NS-01..NS-18 are mapped primarily to T1816 plus exact-delta Audit 2 evidence.

## 24A. Exact Planning Traceability Matrix

**Q12 canonical planning mapping:** the range-based family rows in §23 are readability summaries only and MUST NOT be used as mechanical traceability evidence. This §24A matrix plus the exact ledger in Tasks T1820 and Checklist §U is the authoritative one-by-one planning crosswalk.

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
| FR-036 | T1801, T1808, T1819 |
| FR-037 | T1809, T1818 |
| FR-038 | T1809, T1818 |
| FR-039 | T1804, T1809, T1818 |
| FR-040 | T1808, T1819 |
| FR-041 | T1809, T1818 |
| FR-042 | T1809, T1818, T1822 |

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
| AS-029 | T1808, T1819 |
| AS-030 | T1808, T1819 |
| AS-031 | T1808, T1819 |
| AS-032 | T1808, T1819 |
| AS-033 | T1809, T1818 |
| AS-034 | T1809, T1818 |
| AS-035 | T1809, T1818 |
| AS-036 | T1809, T1818 |
| AS-037 | T1809, T1818 |

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
7. released bytes are immutable; lifecycle is distinct from review_state/validity; retirement/revalidation are append-only;
8. Professional approval is consumed from real Staff assignment + PROFESSIONAL_REVIEW + matching qualification/scope and is never invented;
9. synthetic fixtures are physically isolated and cannot satisfy production evidence;
10. validator and scope guards require positive failure self-tests;
11. metric compatibility contains no candidate execution and no production thresholds;
12. T1801 blocks every implementation edit until all runtime/authority prerequisites are real.

## 26. Audit 1 Contract

After reconciled Spec, Plan, Checklist and Tasks all exist, Audit 1 must re-read the **entire** planning package and answer exactly:

- Q1 Frozen Spec Identity;
- Q2 Authority Fidelity;
- Q3 Selection Preservation;
- Q4 Professional Authority;
- Q5 Reviewer Authority;
- Q6 Approval Binding;
- Q7 Lifecycle / Review-State Separation;
- Q8 NEEDS_REVIEW;
- Q9 Dependency Propagation;
- Q10 Runtime Truth Volatility;
- Q11 Gate Truth;
- Q12 Traceability.

Scope drift remains a separate cross-cutting Audit 1 condition and must be 0.

Any CRITICAL/HIGH/MEDIUM planning defect is remediated only in the reconciled Spec/Plan/Checklist/Tasks when required by current Authority. Four Authority Docs, production code/tests/migrations and upstream Slice artifacts are not editable.

Audit 1 must be complete, not delta-only.

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

Audit 1 was rerun over the complete reconciled Spec + Plan + Checklist + Tasks after all Authority-remediation edits.

Findings discovered and closed during reconciliation / final Audit 1:

~~~text
MEDIUM-01 — stale pre-reconciliation current-main / Slice 17 authority snapshots remained in the Reconciled Spec.
Remediation: replaced them with current main, current Slice 17 authority-reconciliation package, and explicit historical-retirement wording.

MEDIUM-02 — Professional approval binding was semantically correct in direction but not mechanically canonical end-to-end.
Remediation: normalized professional_approval_binding_id, qualification_ref, qualification_scope, auditable reviewer identity, exact approval binding and reconciled handoff/gate vocabulary.

MEDIUM-03 — PR #58 moving exact runtime Head was still frozen in the reconciled Spec and Plan.
Remediation: removed the moving PR Head from Frozen/Planning Authority and delegated exact Head/draft/mergeability/CI/audit/merge/runtime re-read to T1801.

MEDIUM-04 — Q12 was previously asserted from aggregate coverage while Checklist/Tasks did not expose a complete one-by-one FR/AS/NS → Plan/Checklist/Task/Verification/Evidence crosswalk.
Remediation: §24A remains the exact plan mapping; Tasks T1820 now carries the canonical 97-row exact planning traceability ledger and Checklist §U verifies every individual FR/AS/NS row. Range notation elsewhere is summary-only and cannot satisfy Q12.

LOW-01 — T1801 referred to Slice 16/17 remediation and audit truth generically without naming the active PR read-backs.
Remediation: T1801 now explicitly re-reads PR #59 and PR #58 exact current Heads, CI/check state, audit/remediation state and merge/runtime usability without freezing their values.
~~~

Complete post-remediation Audit 1:

~~~text
Q1 Frozen Spec Identity: PASS
Q2 Authority Fidelity: PASS
Q3 Selection Preservation: PASS
Q4 Professional Authority: PASS
Q5 Reviewer Authority: PASS
Q6 Approval Binding: PASS
Q7 Lifecycle / Review-State Separation: PASS
Q8 NEEDS_REVIEW: PASS
Q9 Dependency Propagation: PASS
Q10 Runtime Truth Volatility: PASS
Q11 Gate Truth: PASS
Q12 Traceability: PASS

FR traceability: 42/42
AS traceability: 37/37
NS traceability: 18/18

CRITICAL: 0
HIGH: 0
MEDIUM: 0
LOW: 0

Audit 1: FINAL PASS
Scope Drift: 0
Planning Freeze: PASS
~~~

The four MEDIUM findings and one LOW finding above are closed findings, not open findings at freeze.

Planning Freeze does not grant development authorization. Runtime truth remains a separate T1801 gate and must be re-read at development start:

~~~text
Runtime Dependency Gate: BLOCKED
Implement Gate: BLOCKED
Development Authorization: NOT GRANTED
READY FOR DEVELOPMENT: NO
~~~

Any future semantic Authority drift requires a new reconciliation; volatile PR/CI/remediation state remains T1801 runtime truth.

## 29. Current-Main Reconciliation + Audit 1 Refresh — 2026-11-20

### 29.1 Reconciliation Matrix

| Area | Frozen Planning Truth | Current Main Truth | Drift | Action |
|---|---|---|---|---|
| main | 9aceaedf12b611d41fba06866dcd00e20eb5ea8d | 1b7a9d817713692cc1b895a7f601f07e8123f8fa | YES | REFRESH |
| Authority Docs | 97c69… / 8eb660… / 6b4630… / a0f09b… | 97c69… / 379cb8… / 6b4630… / afef9f… | YES | CLARIFY |
| Slice 16 | PR #59 unmerged | PR #59 merged; current-main CI/Spec Governance green | YES | REFRESH |
| Slice 17 | PR #58 unmerged | PR #58 merged; current-main CI/Spec Governance green | YES | REFRESH |
| Knowledge runtime | not current-main truth | merged exact identity/version/hash/lifecycle/package/eligibility seams exist | YES | REFRESH |
| production corpus | unproven | Digital Use v1 exact production-approved Knowledge set is empty | YES | CLARIFY |
| reviewer authority | unassigned | unassigned; production providers fail closed | NO | PRESERVE |
| Spec identity | 222ed94a… / 41337427… | 1f7f6804e99dd688a91accc73a18519c8cd69a2a / 1d18fa97a29b3a26d3ff9b0da8dbaf4007649af3 | YES | REFRESH |
| Plan state | DRAFT wording | Audit 1 FINAL PASS / Planning Freeze PASS | YES | REFRESH |
| Checklist identity | stale f4ea6d8a… / 16bed255… | canonical refreshed Spec identity | YES | REFRESH |
| Tasks T1801 result | Slice 16/17 unmerged blockers | those blockers retired; corpus/reviewer remain blocked | YES | REFRESH |
| Selection | Gold Dataset | Gold Dataset | NO | PRESERVE |

### 29.2 Refresh Findings Closed

- MEDIUM-R01 — stale current main / PR #59 / PR #58 assertions. CLOSED by dated current-main refresh.
- MEDIUM-R02 — Checklist canonical Spec identity stale. CLOSED by canonical identity sync.
- MEDIUM-R03 — Plan status still said DRAFT after prior freeze. CLOSED.
- MEDIUM-R04 — T1801 planning-time known result still named retired unmerged blockers. CLOSED.
- MEDIUM-R05 — Plan §20 still retained a stale “Current planning-time result” asserting unmerged Slice 16 remediation / Slice 17 PR #58. CLOSED by replacing that current-state assertion with the 2026-11-20 merged runtime truth while preserving T1801 as the authoritative runtime read-back.

### 29.3 Full Audit 1 Refresh

~~~text
Q1 Current Main Fidelity: PASS
Q2 Authority Fidelity: PASS
Q3 Selection Preservation: PASS
Q4 Professional Authority: PASS
Q5 Reviewer Authority: PASS
Q6 Lifecycle / Review State: PASS
Q7 Knowledge Runtime Alignment: PASS
Q8 Production Corpus Truth: PASS — truthfully EMPTY/BLOCKED
Q9 Reviewer Runtime Truth: PASS — truthfully UNASSIGNED/BLOCKED
Q10 T1801 Correctness: PASS
Q11 Artifact Consistency: PASS
Q12 Traceability: PASS

FR traceability: 42/42
AS traceability: 37/37
NS traceability: 18/18

CRITICAL: 0
HIGH: 0
MEDIUM: 0
LOW: 0

Audit 1: FINAL PASS
Planning Freeze: PASS
Scope Drift: 0
~~~

Planning Freeze is planning-quality authority only. It does not grant implementation authorization. T1801 must now be executed READ-ONLY against then-current remote truth.

