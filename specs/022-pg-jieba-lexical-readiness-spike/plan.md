# Slice 22 — pg_jieba Lexical Readiness Spike — Plan

Feature: 022-pg-jieba-lexical-readiness-spike  
Role: Plan AI 2  
Status: PLANNING CANDIDATE — becomes frozen only after Audit 1 FINAL PASS.

## 1. Remote Truth / Planning Baseline

Planning began from the frozen Slice 22 Spec and then reconciled one non-semantic main drift by an ordinary two-parent merge.

- Repository: pyxm1618/xiaoshuyin
- Frozen Spec branch: spec/022-pg-jieba-lexical-readiness-spike
- Frozen Spec head: c583e7d67d3cca7bb5b9f1b533f08448c2362334
- Frozen Spec blob: c11c595d3fc9390bb569651562ba52c36cf9546b
- Historical Spec parent main: 3161677256c479e0e6754554a07e08a1fbaf16ef
- Current main at reconciliation: d24e5449a9c7589b70013c0d35f610a63bc6ec89
- Planning branch: plan/022-pg-jieba-lexical-readiness-spike
- Reconciled pre-artifact head: c46c546bbbc192cc668fbf6ded077746e2e9259b

The main drift from 3161677... to d24e544... contains Workline D Safety / Identity / Authorization / Participation remediation and migrations 032/036. It does not modify the four Authority Docs, Slice 22 Spec, Stage A Docker/pgvector substrate, implementation-ownership registry, change-governance validator, or pg_jieba semantics. Authority conflict: NONE.

Current upstream state relevant to 022:
- Slice 19 PostgreSQL 18 Stage A substrate is present on main.
- Slice 20 implementation is not required and remains independently incomplete; PR #118 is only its governance prerequisite.
- Slice 21 planning is frozen independently; its implementation/result is not required for 022.
- No competing Slice 22 implementation branch was observed before planning branch creation.

## 2. Frozen Authority

The sole feature authority is:
- specs/022-pg-jieba-lexical-readiness-spike/spec.md
- blob c11c595d3fc9390bb569651562ba52c36cf9546b

Controlling formal documents observed on the frozen Spec lineage:
- Docs/总产品需求.md — blob 97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29
- Docs/V1产品需求.md — blob 379cb8cfb377924cd21ccfe55baa5aecdf207f5e
- Docs/总体技术架构.md — blob 6b4630803f371faf6d93f27361070223d0f661a0
- Docs/V1技术设计.md — blob afef9fcc4af41b6137e5020717135972a3d515fc

Relevant upstream feature authorities remain 016, 017, 019, 020 and the frozen 021 planning lineage. No upstream artifact is amended by this Slice.

Frozen interpretation:
- formal Candidate A = dense + sparse
- formal Candidate B = dense + pg_jieba lexical
- formal Candidate C = dense-only
- Slice 22 proves only Candidate B lexical substrate readiness
- Slice 22 does not select a route and does not create production lexical retrieval.

## 3. Scope Boundary

### In scope

1. Actual PostgreSQL 18 + actual pg_jieba build/load/runtime compatibility.
2. Actual Chinese tokenization using pg_jieba.
3. A bounded, pre-run-frozen test lexicon sourced only from authorized formal-doc terminology.
4. Mechanically observable baseline-versus-loaded lexicon behavior.
5. A bounded lexical retrieval query over a fixed Chinese corpus using PostgreSQL full-text-search surfaces supplied by pg_jieba.
6. PASS / FAIL / BLOCKED / UNKNOWN / NOT_EVALUATED evidence.
7. Success, failure and rerun cleanup in a disposable environment.
8. Exact-head, exact-environment, exact-lexicon, exact-corpus and run-family binding.

### Explicitly out of scope

No dense retrieval, embeddings, Slice 20 adapter calls, sparsevec, fusion, RRF, reranker, qwen3-rerank, Gold Dataset evaluation, route selection, rag_route_version, production dictionary, production RAG, Context Builder, AI Task Runtime, TaskModelRegistry, Promptfoo framework, Family Memory, generic retrieval framework, production schema/index, production knowledge rows or production API.

Any implementation requirement that crosses this boundary is a STOP.

## 4. Dependency Model

### Planning dependencies

Satisfied:
- frozen Slice 22 Spec exists;
- Authority conflict remains NONE;
- Slice 19 Stage A substrate exists;
- current governance rules and repository structure were re-read;
- actual pg_jieba upstream mechanics were investigated.

Not dependencies:
- Slice 20 implementation completion;
- Slice 21 execution result.

### Implementation dependencies

Developer may execute only when:
1. Plan/Checklist/Tasks are frozen and Audit 1 is FINAL PASS.
2. Developer rebases nothing; instead it starts from or ordinarily reconciles to current main with behind = 0 while preserving frozen Spec/planning history.
3. current main still contains the Slice 19 Stage A PostgreSQL 18 baseline.
4. Docker-compatible disposable execution is available.
5. the pinned pg_jieba upstream source and its pinned submodule can be obtained, or a truthful BLOCKED result is recorded without claiming incompatibility.
6. lexicon/corpus fixtures are committed and fingerprinted before any runtime outcome is observed.
7. no competing 022 implementation exists.
8. implementation remains test-only; otherwise governance must be reclassified before any product-path mutation.

## 5. Governance Classification

Current change governance explicitly lists tests/ under FIXED_EXEMPT_PREFIXES. The following planned implementation surface is therefore fixed-exempt and does not require a feature ownership rule or change-binding manifest:

- tests/fixtures/pg-jieba-readiness/Dockerfile
- tests/fixtures/pg-jieba-readiness/xiaoshuyin_022_test.dict
- tests/fixtures/pg-jieba-readiness/lexicon-manifest.json
- tests/fixtures/pg-jieba-readiness/corpus-manifest.json
- tests/fixtures/pg-jieba-readiness/readiness-state.ts
- tests/architecture/pg-jieba-readiness-evidence.test.ts
- tests/db/pg-jieba-readiness.test.ts

The parent directories tests/fixtures, tests/architecture and tests/db were observed on current main. The pg-jieba-readiness fixture subdirectory is new but remains under the verified fixed-exempt prefix.

Governance decision:

GOVERNANCE PREREQUISITE: NOT REQUIRED

This decision is conditional on the implementation diff remaining a subset of the seven paths above plus the already-frozen planning artifacts. If implementation requires apps/, packages/, db/, .github/, .specify/, scripts/, docker-compose.stage-a.yml, package manifests, or any other production/infra path, Developer must STOP before mutation and return for governance/planning review.

## 6. Hard Implementation Gate

The gate is mechanical.

OPEN only if all are true:
- frozen Spec blob == c11c595d3fc9390bb569651562ba52c36cf9546b;
- Audit 1 == FINAL PASS;
- current main reconciliation == behind 0 at Developer start;
- Slice 19 Stage A PG18 base image identity remains observable;
- planned changed paths remain test-only fixed-exempt;
- no competing 022 implementation exists;
- lexicon/corpus source authority can be proven before runtime;
- Docker daemon/build execution and source retrieval are available enough to attempt the pinned build.

State handling at gate:
- inability to access Docker, base image, upstream source or required build repositories without proving technical incompatibility => BLOCKED;
- observed incompatibility after the exact source and target are obtained and the relevant build/load/runtime step executes => FAIL at the applicable lower evidence predicate, not BLOCKED;
- incomplete or contradictory identity evidence => UNKNOWN;
- no attempt => NOT_EVALUATED.

No Slice 20 or Slice 21 outcome may close this gate by itself.

## 7. Target Environment Contract

The target substrate is the current Slice 19 Stage A base:

- PostgreSQL major: 18, observed at runtime; configuration alone is insufficient.
- Base image currently pinned on main:
  pgvector/pgvector:0.8.7-pg18-trixie@sha256:5895949dfcdf308eb0cd31c950c93c14895c77f33fbedfecf1fa511ab1d4bcd2
- Runtime application role: xiaoshuyin_app.
- Runtime role invariants: NOSUPERUSER, NOBYPASSRLS, no CREATE on public schema.
- Extension installation/CREATE EXTENSION is privileged setup and must not run as xiaoshuyin_app.

Slice 22 shall derive a disposable test image from that exact immutable Stage A image. It must not edit docker-compose.stage-a.yml or db/init. The derived image may install compile tooling and the pinned pg_jieba source only inside the test image.

One run family uses the same derived image identity for:
- BASELINE environment: upstream default user dictionary only.
- LEXICON_LOADED environment: upstream default user dictionary plus the frozen xiaoshuyin_022_test dictionary.
- FAILURE_INJECTION environment: a deliberately missing/invalid test dictionary identity or equivalent bounded failure fixture.

Each environment uses a fresh disposable PostgreSQL data volume. No environment is a production-readiness environment.

Required runtime identity evidence:
- repository exact implementation head;
- base main and merge base;
- changed-file list;
- base image immutable reference;
- derived image ID/digest;
- PostgreSQL server_version and server_version_num;
- pg_config version/path;
- pg_jieba source commit and submodule commit;
- extension default/installed version;
- hashes of pg_jieba.so, pg_jieba.control, installed extension SQL and frozen custom dictionary;
- SHOW shared_preload_libraries;
- SHOW pg_jieba.user_dict when the GUC exists;
- extension owner;
- current_user and runtime role security flags;
- run_family_id.

## 8. pg_jieba Compatibility Verification

### Pinned upstream source identity

The planning research snapshot freezes the intended source-under-test to the current upstream repository state, not to an arbitrary fork:

- repository: jaiminpan/pg_jieba
- upstream branch snapshot: master
- exact source commit: d0ffac8028328b2566a889ff4db3d74ba63d1b42
- libjieba gitlink/submodule: 391121d5db0f31dd5ce9795d4d34812f20eeb25c
- pg_jieba.control default_version: 1.1.1

No source patch is allowed in Slice 22. If this pinned source cannot compile/load/run against exact PostgreSQL 18 after its source and build prerequisites are successfully obtained, that is observed incompatibility for this tested build and maps to FAIL. A future fork/patch/package choice would be a new decision, not a hidden rescue path inside this Spike.

### Upstream mechanics that shape the plan

Observed upstream behavior:
- pg_jieba is a native C/C++ PostgreSQL extension built with CMake/make and PostgreSQL server headers.
- it installs its shared object, extension control/SQL, base dictionary, HMM model and user dictionary into PostgreSQL install/share paths.
- it exposes parser/config surfaces including jieba, jiebacfg, jiebaqry, jiebamp and jiebahmm.
- intended query/tokenization surfaces include ts_debug, to_tsvector and to_tsquery/full-text-search operators.
- custom dictionaries are files in PostgreSQL tsearch_data.
- pg_jieba.user_dict is a postmaster-level GUC available when the library is loaded through shared_preload_libraries and requires restart to change reliably.
- jieba_reload_dict() is backend-process-local in practical behavior; it is not suitable as the positive multi-backend evidence mechanism.
- PostgreSQL 18 full-text search does not require an index for correctness; GIN/GiST are acceleration choices. Slice 22 therefore uses bounded non-indexed lexical matching and makes no index-readiness claim.
- pg_jieba.control does not mark the extension trusted. PostgreSQL 18 therefore treats CREATE EXTENSION as privileged setup by default; installation occurs only in the disposable environment and never as xiaoshuyin_app.
- the extension is installed into public only after confirming the runtime app role has no CREATE privilege there; queries use an explicit regconfig and never mutate default_text_search_config.

Therefore the positive path uses fresh postmaster startup with frozen dictionary configuration, not mutable post-hoc dictionary edits or jieba_reload_dict().

### Compatibility PASS

PG_JIEBA_COMPATIBILITY = PASS only when one exact derived image:
1. builds from the exact Stage A base;
2. obtains the exact pinned source/submodule;
3. compiles and installs without source patch;
4. starts PostgreSQL 18 with pg_jieba preloaded;
5. CREATE EXTENSION pg_jieba succeeds under privileged setup;
6. pg_available_extensions and pg_extension identities are observed;
7. public.jiebacfg (or the mechanically observed extension schema equivalent) and parser surfaces exist;
8. xiaoshuyin_app can execute the required read-only tokenizer/search surfaces without privilege escalation;
9. all required identity hashes/versions are present.

## 9. Lexicon Contract

### Authorized source set

The lexicon is not a production professional dictionary. It is a three-term technical fixture using only exact product/domain terminology already present in formal Authority Docs.

Frozen terms:
1. 家庭联盟
   - source identity: Docs/总产品需求.md
   - source version: blob 97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29
   - source reference: line 971 in the frozen planning snapshot
   - authority class: existing product/domain terminology
2. 手机使用合约
   - source identity: Docs/总产品需求.md
   - source version: blob 97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29
   - source reference: line 995
   - authority class: existing product/domain terminology
3. 小树荫
   - source identity: Docs/总产品需求.md
   - source version: blob 97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29
   - source reference: document title / line 1
   - authority class: product name

Each is permitted for this technical test because it is exact text already in the project's formal Authority Docs and no clinical/professional meaning, synonymy, scoring or relevance judgment is added.

### File contract

xiaoshuyin_022_test.dict shall contain exactly the three terms above, one UTF-8 term per line, no frequency and no POS tag. Exact bytes, order and terminal newline are frozen by commit and SHA-256.

lexicon-manifest.json shall record for every term:
- exact term;
- source path;
- source blob;
- source reference;
- authority class;
- test-use permission = FROZEN_SPEC_OPTION_A_FORMAL_TERM;
- no_new_professional_judgment = true;
- dictionary filename;
- dictionary SHA-256;
- fixture git blob SHA when available.

Freeze rule:
- lexicon fixture commit/blob/fingerprint must exist before the first baseline or loaded runtime observation in a run family.
- any lexicon byte change invalidates the entire run family.
- Developer may not replace a term after observing baseline/loaded behavior.
- if the frozen terms cannot form a non-degenerate authorized test, state = BLOCKED; do not invent replacements.

### Baseline and loaded configuration

BASELINE:
- pg_jieba.user_dict = jieba_user

LEXICON_LOADED:
- pg_jieba.user_dict = jieba_user,xiaoshuyin_022_test

The same pg_jieba build, PostgreSQL image and corpus are used for both.

LEXICON_LOAD is intentionally identity/load-only. It is PASS only when provenance is valid, the exact frozen dictionary hash is present in tsearch_data, postmaster startup succeeds with the exact loaded user_dict value, and the observed config/file identity matches the frozen manifest. Tokenization behavior is not used to manufacture LEXICON_LOAD PASS; behavior is evaluated separately under TOKENIZATION.

## 10. Corpus / Query Fixture Contract

The corpus is technical, bounded, lawful project text from the formal Authority Docs. It contains no real family/minor/patient/private data and is not a Professional Gold Dataset.

Frozen corpus:

D01
- text: 历史方案中的“家庭联盟”“共同目标”“共同约定”应继续保留。
- source: Docs/总产品需求.md
- source blob: 97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29
- source reference: line 971

D02
- text: 手机使用合约等历史设计有价值。
- source: Docs/总产品需求.md
- source blob: 97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29
- source reference: line 995

D03
- text: 数字使用按实际活动与影响理解，可以涉及手机、平板、电脑和游戏设备；不能沿用旧资料中“电脑不属于手机”的设备排除来漏掉真实问题。学习、联系家人和娱乐用途分开记录，不以统一小时数单独判断是否需要干预。
- source: Docs/总产品需求.md
- source blob: 97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29
- source reference: line 809

D04
- text: 小树荫的长期使命不是“让家长获得更多家庭教育知识”，而是：
- source: Docs/总产品需求.md
- source blob: 97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29
- source reference: line 37

Frozen technical queries:
- Q01 text = 手机使用合约; expected literal technical match set = [D02]; declared distractors = [D01,D03,D04]
- Q02 text = 家庭联盟; expected literal technical match set = [D01]; declared distractors = [D02,D03,D04]

These are literal-string technical expectations, not clinical relevance or Professional Gold labels.

corpus-manifest.json must record IDs, exact text, source path/blob/reference, SHA-256 of exact UTF-8 text, privacy classification NON_PERSONAL_FORMAL_PRODUCT_DOC, permission FROZEN_SPEC_PERMITTED_FORMAL_DOC_FIXTURE, query IDs, expected literal match IDs and distractor IDs.

Freeze order:
1. commit lexicon and corpus fixtures;
2. capture their git blobs and SHA-256 values;
3. only then start baseline/loaded runtime;
4. no expectation, query, text or ID may change after observation without a new exact head and completely new run family.

## 11. Tokenization Verification

Actual pg_jieba is mandatory. No mock/fallback tokenizer can produce PASS.

For D01, D02 and D04 in both BASELINE and LEXICON_LOADED:
- query ts_debug with the pg_jieba config;
- query to_tsvector with the same config;
- retain raw rows/serialized output;
- execute three times using three fresh database connections under the same postmaster identity.

TOKENIZATION = PASS only if:
- actual pg_jieba parser/config identity is proven;
- all three repetitions in each applicable environment produce byte-normalized equivalent token/lexeme output;
- no fallback config/tokenizer is used;
- output is nonempty where the frozen source text contains expected searchable lexemes.

A crash, parser error or reproducibly unstable result on the exact identity maps to FAIL after compatibility/setup prerequisites are proven. Missing environment/source access maps to BLOCKED. Incomplete identity/output maps to UNKNOWN.

## 12. Lexicon-Sensitive Verification

The one required predeclared differential term is fixed before runtime:

- PRIMARY_DIFFERENTIAL_TERM = 手机使用合约
- probe document = D02
- required loaded lexeme = 手机使用合约

家庭联盟 and 小树荫 remain authorized dictionary entries and may be observed, but they are not fallback alternatives for the required differential proof. Developer may not switch the primary term after seeing results.

The differential portion of TOKENIZATION is PASS only if:
1. BASELINE uses exactly jieba_user;
2. LEXICON_LOADED uses exactly jieba_user,xiaoshuyin_022_test;
3. LEXICON_LOAD is already independently PASS from file/config/postmaster identity;
4. BASELINE D02 does not contain 手机使用合约 as one searchable lexeme;
5. LEXICON_LOADED D02 contains 手机使用合约 as one searchable lexeme;
6. the loaded D02 result is identical across three fresh connections.

If baseline already emits 手机使用合约 as one lexeme, or the loaded environment does not emit it as one lexeme, the predeclared differential is not proven and TOKENIZATION = FAIL with reason PRIMARY_DIFFERENTIAL_NOT_OBSERVED. Do not select 家庭联盟 or 小树荫 as a rescue term.

The predicates remain orthogonal:
- LEXICON_LOAD = provenance + frozen file fingerprint + tsearch_data presence + exact postmaster user_dict configuration + successful environment load.
- TOKENIZATION = actual pg_jieba output + repeated-run determinism + the one predeclared baseline/loaded differential above.
- LEXICAL_QUERY = independent bounded FTS match behavior over the frozen corpus.

## 13. Lexical Retrieval Verification

The lexical query uses only PostgreSQL full-text search backed by actual pg_jieba. It does not create a production retrieval pipeline.

Use the LEXICON_LOADED environment and an in-query VALUES/CTE corpus or equivalent transaction-local construction; no permanent table or index is required.

Required technical operation:
1. construct the four frozen corpus rows in-memory;
2. build document vectors with the observed pg_jieba jiebacfg regconfig;
3. build each plain query with the same pg_jieba config using a parameterized plain-text query constructor;
4. apply the PostgreSQL full-text match operator;
5. return matched doc IDs in deterministic doc_id order.

No rank tuning is required. This is boolean lexical technical correctness, not quality evaluation.

LEXICAL_QUERY = PASS only if three repeated runs on fresh connections produce:
- Q01 exact match set [D02];
- Q02 exact match set [D01];
- no distractor in either match set;
- exact corpus/query fingerprints equal the frozen manifests;
- all outputs and SQL/config identities are captured.

No dense score, sparse score, fusion, RRF, rerank or relevance metric may be introduced.

## 14. Negative / Failure Verification

Architecture/state-machine tests must mechanically prove:
- compatibility cannot PASS when extension/source/environment identity is missing;
- source/package unavailable maps BLOCKED, not FAIL;
- observed PG18 build/load/runtime incompatibility maps FAIL, not BLOCKED;
- incomplete/conflicting evidence maps UNKNOWN;
- never-run maps NOT_EVALUATED;
- invalid or unauthorized lexicon provenance cannot PASS;
- post-observation lexicon/corpus fingerprint drift invalidates the run;
- tokenization without lexicon proof cannot aggregate PASS;
- lexical query mismatch cannot aggregate PASS;
- mock/fallback tokenizer cannot aggregate PASS;
- cleanup failure forces aggregate FAIL.

At least one real injected-failure environment must also be attempted after the positive harness exists:
- start the same derived image with a deliberately missing user-dictionary name or otherwise mechanically equivalent bounded invalid lexicon configuration;
- prove it cannot produce LEXICON_LOAD PASS;
- destroy that failed environment and prove cleanup.

This injected failure is not evidence that upstream is incompatible; it is a negative state-machine/cleanup proof.

## 15. Evidence State Machine

Mandatory lower predicates:
- PG_JIEBA_COMPATIBILITY
- LEXICON_LOAD
- TOKENIZATION
- LEXICAL_QUERY
- CLEANUP

Each has exactly:
- PASS
- FAIL
- BLOCKED
- UNKNOWN
- NOT_EVALUATED

No boolean readiness flag is manually authored.

Aggregate derivation priority:
1. if CLEANUP == FAIL => aggregate FAIL;
2. else if any mandatory predicate == FAIL => aggregate FAIL;
3. else if any mandatory predicate == BLOCKED => aggregate BLOCKED;
4. else if any mandatory predicate == UNKNOWN => aggregate UNKNOWN;
5. else if any mandatory predicate == NOT_EVALUATED => aggregate NOT_EVALUATED;
6. else if all five == PASS => aggregate PASS;
7. else => UNKNOWN.

The implementation must expose a pure deterministic deriveAggregateState(evidence) function covered by architecture tests. Runtime code supplies observations only; it never sets aggregate PASS directly.

Reason codes must identify at least:
- SOURCE_UNAVAILABLE
- BASE_IMAGE_UNAVAILABLE
- DOCKER_UNAVAILABLE
- BUILD_PREREQUISITE_UNAVAILABLE
- PG18_BUILD_INCOMPATIBLE
- EXTENSION_INSTALL_INCOMPATIBLE
- EXTENSION_LOAD_INCOMPATIBLE
- RUNTIME_ROLE_INCOMPATIBLE
- IDENTITY_INCOMPLETE
- LEXICON_PROVENANCE_INVALID
- LEXICON_FINGERPRINT_MISMATCH
- LEXICON_LOAD_FAILED
- PRIMARY_DIFFERENTIAL_NOT_OBSERVED
- TOKENIZATION_FAILED
- TOKENIZATION_NON_REPRODUCIBLE
- LEXICAL_QUERY_MISMATCH
- FALLBACK_FORBIDDEN
- FIXTURE_DRIFT
- CLEANUP_FAILED.

## 16. Cleanup / Isolation

Disposable state is mandatory.

Per run family:
- unique BASELINE container + disposable data volume;
- unique LEXICON_LOADED container + disposable data volume;
- unique FAILURE_INJECTION container + disposable data volume;
- one uniquely tagged derived test image.

Success cleanup:
- stop/remove all three containers;
- remove their exact disposable volumes;
- remove the exact derived image tag after required hashes/identity are captured;
- verify no matching containers/volumes remain;
- verify no product schema/table/index/business row was created;
- verify no host PostgreSQL config/tsearch_data was modified.

Expected-failure cleanup:
- cleanup runs in finally semantics even if build/start/CREATE EXTENSION/token/query fails;
- removal checks are evidence predicates, not best effort.

Unexpected-failure cleanup:
- same finally cleanup path;
- if cleanup cannot be proven, CLEANUP = FAIL.

Rerun:
- any final aggregate PASS or observed technical FAIL must be reproduced by a second clean attempt on the same exact implementation head + fixture blobs, with a new run_family_id and fresh containers/volumes;
- a compatibility FAIL is rerun through the same build/load failing stage; a later token/query FAIL is rerun from a fresh environment through that same failing stage;
- BLOCKED/UNKNOWN may terminate without a second positive execution because the missing/inconclusive dependency is itself the reason no reproducible technical result exists;
- no rerun may reuse prior PostgreSQL data;
- evidence must prove no residue is required for PASS or for a claimed reproducible FAIL.

The committed xiaoshuyin_022_test.dict is an authorized test fixture, not an installed production dictionary. No host/production dictionary install is permitted.

## 17. Security / Privacy

- never use real family, minor, patient or user data;
- corpus is limited to the frozen formal product-doc excerpts above;
- never store API keys or other external model credentials; none are needed;
- database passwords are ephemeral runtime secrets and must not be committed or emitted into evidence;
- privileged setup is limited to disposable container extension creation;
- xiaoshuyin_app remains NOSUPERUSER/NOBYPASSRLS and receives no new grant;
- no production DB is contacted;
- no network call other than obtaining the pinned public build source/base/build dependencies is part of lexical verification;
- evidence stores safe identities/hashes/raw token/query outputs only for the frozen permitted corpus.

## 18. Exact-Head Evidence Binding

One positive or negative run family is valid only when all evidence binds to the same tuple:

RUN_FAMILY_ID = hash(
  repository exact implementation head,
  base main,
  merge base,
  changed-file set,
  frozen Spec blob,
  derived image identity,
  PostgreSQL identity,
  pg_jieba source/submodule/build hashes,
  lexicon git blob + SHA-256,
  corpus manifest git blob + SHA-256,
  query manifest identity
)

Do not combine:
- compatibility evidence from one head with query evidence from another;
- baseline from one image with loaded behavior from another build;
- tokenization before fixture freeze with retrieval after fixture edits;
- results from different corpus or lexicon fingerprints.

Runtime evidence must be emitted outside the committed source tree or as attached run output so that evidence generation does not change the exact implementation head it claims to bind. Its own SHA-256 is recorded in the Developer handoff.

Any implementation change after runtime evidence invalidates that run family and requires a full rerun on the new exact head.

## 19. Verification Commands / Suites

Developer shall implement and run the following categories; exact package-manager invocation must use the repository's existing Bun/Vitest conventions at the current main.

Static/planning/governance:
- verify Frozen Spec blob unchanged;
- verify changed files are exactly/subset of the seven planned test-only paths;
- run current change-governance validator and confirm fixed-exempt test-only classification;
- run current static guard and its self-test;
- run canonical verify-all.

Architecture:
- run tests/architecture/pg-jieba-readiness-evidence.test.ts;
- prove all five states and aggregate precedence;
- prove provenance/fingerprint/freeze constraints.

Real Stage A-derived execution:
- explicitly opt in with PG_JIEBA_READINESS_TEST=1;
- build exact derived image from the pinned base and upstream source;
- execute tests/db/pg-jieba-readiness.test.ts;
- capture compatibility, baseline, loaded, tokenization, lexical query, failure-injection and cleanup evidence;
- repeat the complete successful/terminal run once with a fresh run_family_id for rerun reproducibility.

No command may invoke embeddings, sparsevec, fusion, RRF, reranking or Gold Dataset evaluation.

## 20. STOP Conditions

Developer must STOP before widening or mutating outside this Plan when:
- Frozen Spec blob changes;
- Authority Docs conflict with the frozen boundary;
- current main introduces a semantic conflict affecting pg_jieba/Stage A/governance;
- any lexicon/corpus term requires new professional/clinical judgment;
- test terms would need to be invented or post-hoc replaced;
- implementation needs apps/, packages/, db/, .github/, .specify/, scripts/, docker-compose.stage-a.yml or package dependency changes;
- source patch/fork is required to make pg_jieba pass;
- another tokenizer/search engine is required;
- a permanent schema/table/index is required;
- Slice 20/21 behavior is being pulled into 022;
- RRF/reranker/dense/sparse/Gold evaluation becomes necessary;
- evidence cannot distinguish FAIL from BLOCKED/UNKNOWN;
- exact head/environment/fixture/run binding cannot be proven;
- cleanup requires touching a shared/production environment.

## 21. Developer Handoff Boundary

Developer is authorized only to implement/execute the frozen seven-file test-only surface and produce one truthful terminal Spike result.

Developer final handoff must include:
- current main;
- exact implementation head;
- merge base; ahead/behind; changed files;
- Frozen Spec head/blob;
- plan/checklist/tasks blobs;
- governance classification;
- base and derived image identities;
- PG18 identity;
- pg_jieba source/submodule/extension/build hashes;
- execution role/security facts;
- lexicon manifest/blob/SHA-256 and per-term provenance;
- corpus/query manifest/blob/SHA-256;
- raw baseline and loaded tokenization observations;
- lexicon differential observation;
- raw lexical query matched IDs;
- real failure-injection observation;
- five lower evidence states + reason codes;
- mechanically derived aggregate state;
- cleanup and rerun evidence;
- runtime evidence artifact SHA-256;
- canonical regression/governance results;
- limitations.

A reproducible technical FAIL may be READY FOR INDEPENDENT AUDIT 2. A missing dependency that yields BLOCKED is not converted into FAIL or PASS.

Developer must not perform Audit 2 or merge.

## 22. Requirement Traceability

| Requirement | Plan sections | Checklist | Tasks |
|---|---|---|---|
| FR-001 | 7,8,15,18 | C22-ENV-01..08, C22-COMP-01..09 | T001,T006,T011 |
| FR-002 | 8,11,12 | C22-TOK-01..10 | T005,T008 |
| FR-003 | 9,12 | C22-LEX-01..12 | T003,T007,T008 |
| FR-004 | 9,12 | C22-LEX-09, C22-TOK-09..10 | T003,T008 |
| FR-005 | 10,13 | C22-CORP-01..10, C22-QRY-01..08 | T003,T009 |
| FR-006 | 11,13,18 | C22-EVD-01..11 | T008,T009,T010 |
| FR-007 | 15 | C22-STATE-01..10 | T004,T010 |
| FR-008 | 15,18 | C22-STATE-08..10, C22-HEAD-01..09 | T010,T011 |
| FR-009 | 6,14,15 | C22-NEG-01..12, C22-STATE-01..10 | T004,T010 |
| FR-010 | 16 | C22-CLN-01..10 | T009,T010,T011 |
| FR-011 | 3,20 | C22-SCOPE-01..10 | T001,T002,T011 |
| FR-012 | 2,3,9,10,21 | C22-AUTH-01..10 | T001,T003,T012 |
| AS-01 | 7,8,18 | C22-ENV-01..08, C22-COMP-01..09 | T006 |
| AS-02 | 11,12 | C22-TOK-01..10 | T008 |
| AS-03 | 9,12 | C22-LEX-01..12, C22-TOK-09..10 | T007,T008 |
| AS-04 | 10,13 | C22-QRY-01..08 | T009 |
| AS-05 | 14,15 | C22-NEG-01..12 | T004,T009,T010 |
| AS-06 | 3,15,21 | C22-SCOPE-01..10, C22-STATE-01..10 | T010,T012 |
| AS-07 | 16 | C22-CLN-01..10 | T009,T010 |
| AS-08 | 16,17,18 | C22-CLN-08..10, C22-PRIV-01..08, C22-HEAD-01..09 | T011,T012 |
| NS-01 | 8,15 | C22-COMP-05..09, C22-NEG-01..03 | T006,T010 |
| NS-02 | 6,8,15 | C22-NEG-01..03 | T001,T006,T010 |
| NS-03 | 7,15,18 | C22-ENV-01..08, C22-STATE-01..10 | T006,T010 |
| NS-04 | 9,10,14 | C22-AUTH-01..10, C22-NEG-04..06 | T003,T004 |
| NS-05 | 9,10,18 | C22-LEX-10..12, C22-CORP-08..10, C22-HEAD-01..09 | T003,T006,T011 |
| NS-06 | 10,18 | C22-CORP-08..10, C22-HEAD-01..09 | T003,T011 |
| NS-07 | 11,12,14 | C22-TOK-01..10, C22-NEG-07 | T004,T008 |
| NS-08 | 12,15 | C22-LEX-01..12, C22-TOK-01..10, C22-STATE-01..10 | T008,T010 |
| NS-09 | 13,15 | C22-QRY-01..08, C22-STATE-01..10 | T009,T010 |
| NS-10 | 3,20 | C22-SCOPE-01..10 | T001,T002,T011 |
| NS-11 | 3,5,16,20 | C22-GOV-01..08, C22-CLN-01..10 | T002,T011 |
| NS-12 | 2,9,10,17 | C22-AUTH-01..10, C22-PRIV-01..08 | T003,T012 |

No FR, AS or NS is orphaned.
