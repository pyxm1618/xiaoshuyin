# Slice 22 — pg_jieba Lexical Readiness Spike — Plan

Feature: 022-pg-jieba-lexical-readiness-spike  
Role: Plan AI 2 — Targeted Planning Correction Continuation  
Status: TARGETED PLANNING CORRECTION CANDIDATE — becomes frozen only after Audit 1 FINAL PASS.

## 1. Remote Truth / Planning Baseline

Planning began from the frozen Slice 22 Spec, was subsequently reconciled in `spec-correction/022-governance` (`210363fb3e6a739c49c4aa6e95338b80935dd465`, blob `b489bf974032b3bfed678443cda42001ec162f63`) against current main (`e7885234f4b5c4aec61d6a9dfc2b6ff5e6304512`), and now continues as a targeted planning correction without altering the corrected Spec.

- Repository: pyxm1618/xiaoshuyin
- Corrected Spec branch: spec-correction/022-governance
- Corrected Spec head: 210363fb3e6a739c49c4aa6e95338b80935dd465 (supersedes historical spec head c583e7d67d3cca7bb5b9f1b533f08448c2362334)
- Corrected Spec blob: b489bf974032b3bfed678443cda42001ec162f63 (supersedes historical spec blob c11c595d3fc9390bb569651562ba52c36cf9546b)
- Current main at targeted correction: e7885234f4b5c4aec61d6a9dfc2b6ff5e6304512
- Merge base with origin/main: e7885234f4b5c4aec61d6a9dfc2b6ff5e6304512 (behind = 0)
- Previous planning branch (superseded): plan/022-pg-jieba-lexical-readiness-spike (head 3f6d2c0f9ac30bdaab895c9b0e36523ccc844d6d)
- Planning correction branch: plan-correction/022-targeted
- Historical implementation PR under remediation: #149 (head 32599a4be8f54ee99692b9521fe1d1ae9b01176b)

The current main (`e7885234f4b5c4aec61d6a9dfc2b6ff5e6304512`) preserves the four Authority Docs unchanged, preserves Slice 19 Stage A Docker/pgvector substrate (`docker-compose.stage-a.yml`), preserves `tests/` under `FIXED_EXEMPT_PREFIXES` in `.specify/scripts/validate-change-governance.mjs`, and introduces no semantic conflict with Slice 22. Authority conflict: NONE.

Current upstream state relevant to 022:
- Slice 19 PostgreSQL 18 Stage A substrate is present on main.
- Slice 20 implementation is not required for 022 lexical substrate verification.
- Slice 21 planning is frozen independently; its implementation/result is not required for 022.
- No competing Slice 22 implementation PR is merged on main; PR #149 (`32599a4be8f54ee99692b9521fe1d1ae9b01176b`) requires targeted remediation after this planning correction is frozen and audited.

## 2. Frozen Authority

The sole feature authority is:
- specs/022-pg-jieba-lexical-readiness-spike/spec.md
- head 210363fb3e6a739c49c4aa6e95338b80935dd465
- blob b489bf974032b3bfed678443cda42001ec162f63

Controlling formal documents observed on `HEAD` and `origin/main` (`e7885234f4b5c4aec61d6a9dfc2b6ff5e6304512`):
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

## Upstream Traceability

This Plan directly traces to and does not widen the approved upstream bindings recorded in the Corrected Spec (`specs/022-pg-jieba-lexical-readiness-spike/spec.md`, blob `b489bf974032b3bfed678443cda42001ec162f63`):

- `Docs/V1技术设计.md` §4.2, §13.1–§13.2, §20 & `Docs/总体技术架构.md` §11.1: PostgreSQL 18 Stage A substrate and V1 RAG Candidate B (`qwen3.7 dense + pg_jieba + 小树荫专业词典`) lexical readiness prerequisite prior to RRF/rerank and A/B/C Gold Dataset comparison (`pg_textsearch` remains DEFERRED).
- `V1-C03` (`Docs/V1产品需求.md`): real `UNKNOWN` / `NOT_EVALUATED` / `BLOCKED` / inconclusive observations cannot be fabricated into `PASS` or determinate readiness; incomplete identity, unverified failure injection, or fake/stale `run_family_id` bindings must never pass.
- `V1-C27` (`Docs/V1产品需求.md`): infrastructure, build, SQL, tokenization, query, or cleanup failures and runtime exceptions must surface truthful terminal states and preserved failure evidence rather than silent exit or fabricated success.
- `V1-C34`, `V1-C37` (`Docs/V1产品需求.md`): Staff/Professional Review authority and reviewed Psychological/Behavioral Intervention Contracts cannot be bypassed, substituted, or invented by AI, test lexicons, or corpus fixtures.
- `V1-X14` (`Docs/V1产品需求.md`): only real, actually verified `pg_jieba` capability on the exact Stage A PostgreSQL 18 target counts as readiness; mock tokenizers, fallback substitutions, unconsumed negative checks, or unverified head/fixture assumptions cannot pass.

## Constitution Check

Mechanical verification against `AGENTS.md` and the Corrected Spec (`210363fb3e6a739c49c4aa6e95338b80935dd465` / blob `b489bf974032b3bfed678443cda42001ec162f63`):

| Check | Status | Mechanical Basis |
|---|---|---|
| Authority Docs unchanged | PASS | `Docs/**` diff = 0; all four Authority blobs match `origin/main` (`e7885234f4b5c4aec61d6a9dfc2b6ff5e6304512`) |
| Corrected Spec byte-exact | PASS | `specs/022-pg-jieba-lexical-readiness-spike/spec.md` blob remains `b489bf974032b3bfed678443cda42001ec162f63` unchanged |
| No scope widening | PASS | Exact `12` FR (`FR-001`–`FR-012`), `8` AS (`AS-01`–`AS-08`), `12` NS (`NS-01`–`NS-12`), `12` Tasks (`T001`–`T012`); test-only 7-file surface under `tests/` |
| No Professional Authority invention | PASS | Lexicon limited to 3 formal-doc terms (`§9`); corpus limited to 4 formal-doc excerpts (`§10`); zero clinical/Gold labels (`V1-C34`, `V1-C37`) |
| No Candidate B RAG / Gold Eval / route choice | PASS | Zero dense, sparsevec, embeddings, RRF, reranker, Gold scoring, `rag_route_version`, or production schema/index/API |
| Real capability without mock/fallback | PASS | Actual `pg_jieba` on exact Stage A PG18 substrate required; zero mock/fallback substitution (`V1-X14`) |
| Failure & exception truthfulness | PASS | `PASS \| FAIL \| BLOCKED \| UNKNOWN \| NOT_EVALUATED` state machine; failure injection consumed by evaluator; any stage exception captures, classifies, cleans up, and emits terminal evidence (`V1-C03`, `V1-C27`) |
| Exact-head & recomputable run-family binding | PASS | `run_family_id` mechanically recomputed from repo HEAD, all implementation/fixture blobs & hashes, upstream source, environment, and attempt identity; arbitrary non-empty strings rejected (`V1-C03`, `V1-X14`) |
| Governance exemption boundary | PASS | All planned implementation paths stay under `FIXED_EXEMPT_PREFIXES` (`tests/`) with zero `.specify/` or product-path mutation |

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
- corrected Spec blob == b489bf974032b3bfed678443cda42001ec162f63 (head == 210363fb3e6a739c49c4aa6e95338b80935dd465);
- Audit 1 == FINAL PASS;
- current main reconciliation == behind 0 at Developer start;
- Slice 19 Stage A PG18 base image identity remains observable;
- planned changed paths remain test-only fixed-exempt;
- no competing un-reconciled 022 implementation exists (targeted remediation operates strictly on the audited remediation target);
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
- repository exact implementation head (`repo_head`) and clean working-tree proof (`working_tree_clean == true`, zero uncommitted/untracked drift on tracked/implementation paths);
- base main and merge base;
- changed-file list;
- exact Git blob SHAs for all implementation and fixture files (`implementation_file_blobs`, including `Dockerfile` blob, `readiness-state.ts` blob, DB harness `pg-jieba-readiness.test.ts` blob, architecture test blob, `xiaoshuyin_022_test.dict` blob, `lexicon-manifest.json` blob, and `corpus-manifest.json` blob);
- base image immutable reference;
- derived image ID/digest;
- PostgreSQL `server_version`, `server_version_num`, and execution stage/environment identity;
- `pg_config` version/path;
- upstream source identity (`pg_jieba` repo, commit, `libjieba` submodule commit, declared extension version);
- extension default/installed version;
- hashes of `pg_jieba.so`, `pg_jieba.control`, installed extension SQL, frozen custom dictionary SHA-256, and frozen corpus manifest SHA-256;
- `SHOW shared_preload_libraries`;
- `SHOW pg_jieba.user_dict` when the GUC exists;
- extension owner;
- `current_user` and runtime role security flags;
- unique `attempt_identity` (attempt nonce/ID and sequence/timestamp binding);
- mechanically recomputable `run_family_id` derived deterministically from all required identity components above (arbitrary non-empty strings are rejected).

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

Architecture/state-machine tests (`tests/architecture/pg-jieba-readiness-evidence.test.ts`) must mechanically prove:
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
- cleanup failure (including failure-injection cleanup failure or cleanup stage exception) forces aggregate FAIL;
- `failure_injection` observation is mandatory for positive readiness and must be consumed by `evaluateReadinessEvidence` / evaluator assertions:
  - missing `failure_injection` observation or unconsumed `failed_as_expected` flag cannot produce aggregate PASS;
  - if injected invalid dictionary configuration produces `LEXICON_LOAD PASS` (does not fail as expected), evaluator forces `LEXICON_LOAD = FAIL` (`LEXICON_LOAD_FAILED`) and prevents aggregate PASS;
  - injected invalid dictionary failure must NOT misclassify `PG_JIEBA_COMPATIBILITY` as `PG18_BUILD_INCOMPATIBLE` / `EXTENSION_INSTALL_INCOMPATIBLE` / `EXTENSION_LOAD_INCOMPATIBLE`;
  - missing or failed `failure_injection` cleanup proof forces `CLEANUP = FAIL` (`CLEANUP_FAILED`);
- stage exception handling (`startup`, `build`, `SQL`, `tokenization`, `query`, `cleanup`) must route through `capture -> classify -> cleanup -> terminal evidence artifact`, never leaving missing terminal evidence on unexpected throws;
- exact-head and recomputable `run_family_id` adversarial coverage explicitly proves rejection (never PASS) for all six failure modes:
  1. `fake run_family_id` (e.g., arbitrary UUID or non-empty string not matching deterministic recomputation over all required identity inputs);
  2. `working-tree drift` (`working_tree_clean !== true` / dirty working tree or uncommitted changes);
  3. `fixture drift` (lexicon or corpus blob/SHA-256 mismatch against frozen expected manifest);
  4. `mixed-head evidence` (any implementation file blob, `Dockerfile` blob, `readiness-state.ts` blob, DB harness blob, or stage environment/source identity differs from the single bound head/build);
  5. `stale evidence` (evidence generated against a prior head/attempt identity presented for the current expected head/blobs);
  6. `head mismatch` (`repo_head`, `base_main`, `merge_base`, or `frozen_spec_blob` disagrees with expected binding).

At least one real injected-failure environment must also be executed and consumed by the evaluator in `tests/db/pg-jieba-readiness.test.ts` after the positive harness exists:
- start the same derived image with a deliberately missing user-dictionary name (`nonexistent_022_dict`) or otherwise mechanically equivalent bounded invalid lexicon configuration;
- pass structured `failure_injection` execution, classification, and cleanup observations directly into `ReadinessObservation` consumed by `evaluateReadinessEvidence`;
- mechanically prove it cannot produce `LEXICON_LOAD PASS` and is NOT misclassified as PG18 incompatibility (`PG_JIEBA_COMPATIBILITY` remains independent);
- destroy that failed environment (container + volume) and produce explicit removal/cleanup evidence bound to `CLEANUP`.

This injected failure is not evidence that upstream is incompatible; it is a mandatory negative state-machine/cleanup proof consumed by the readiness evaluator.

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

The implementation must expose a pure deterministic `deriveAggregateState(evidence)` function and `evaluateReadinessEvidence(obs, expected)` evaluator covered by architecture tests. Runtime code supplies observations only; it never sets aggregate PASS directly.

Mandatory evaluator consumption & terminal-exception contracts:
- `evaluateReadinessEvidence` must consume `obs.failure_injection` (requiring `attempted === true`, `observed_lexicon_load_pass === false`, `misclassified_as_pg18_incompatibility === false`, and `cleanup_verified === true` before aggregate `PASS` is possible). Recording `rawEvidence.failure_injection.failed_as_expected` alone without evaluator consumption is forbidden.
- `evaluateReadinessEvidence` must recompute `run_family_id` deterministically from all required §18 identity components (`computeRunFamilyId(...)`) and verify `obs.run_family_id === recomputed` plus exact blob/head/working-tree match; any non-matching or arbitrary non-empty `run_family_id` invalidates positive readiness.
- Every runtime execution stage (`startup`, `build`, `SQL`, `tokenization`, `query`, `cleanup`) must enforce exception terminal-evidence discipline:
  `exception -> capture (stage, redacted error, raw state) -> classify (truthful BLOCKED / FAIL / UNKNOWN + reason code) -> cleanup (finally path + removal verification) -> terminal evidence artifact (evaluateReadinessEvidence + JSON artifact write + SHA-256)`
  Uncaught `throw -> process exit -> no terminal evidence` is strictly forbidden.

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
- RUN_FAMILY_ID_MISMATCH
- WORKING_TREE_DRIFT
- STALE_OR_MIXED_HEAD_EVIDENCE
- LEXICON_PROVENANCE_INVALID
- LEXICON_FINGERPRINT_MISMATCH
- LEXICON_LOAD_FAILED
- FAILURE_INJECTION_NOT_CONSUMED
- FAILURE_INJECTION_UNEXPECTED_PASS
- FAILURE_INJECTION_MISCLASSIFIED_INCOMPATIBLE
- PRIMARY_DIFFERENTIAL_NOT_OBSERVED
- TOKENIZATION_FAILED
- TOKENIZATION_NON_REPRODUCIBLE
- LEXICAL_QUERY_MISMATCH
- FALLBACK_FORBIDDEN
- FIXTURE_DRIFT
- STAGE_EXCEPTION_CAPTURED
- CLEANUP_FAILED.

## 16. Cleanup / Isolation

Disposable state is mandatory.

Per run family:
- unique BASELINE container + disposable data volume;
- unique LEXICON_LOADED container + disposable data volume;
- unique FAILURE_INJECTION container + disposable data volume;
- one uniquely tagged derived test image.

Success cleanup:
- stop/remove all three containers (explicitly including the `FAILURE_INJECTION` container);
- remove their exact disposable volumes (explicitly including the `FAILURE_INJECTION` volume);
- remove the exact derived image tag after required hashes/identity are captured;
- verify no matching containers/volumes remain (producing per-environment cleanup verification evidence including `failure_injection_cleanup_verified`);
- verify no product schema/table/index/business row was created;
- verify no host PostgreSQL config/tsearch_data was modified.

Expected-failure cleanup:
- cleanup runs in `finally` semantics even if `startup`, `build`, `SQL`, `tokenization`, `query`, or `failure_injection` fails or throws;
- removal checks are evidence predicates, not best effort, and `failure_injection` cleanup forms explicit evidence consumed by `CLEANUP`.

Unexpected-failure cleanup:
- same `finally` cleanup path wrapped with exception capture so cleanup errors themselves cannot abort terminal artifact emission;
- if cleanup throws or removal cannot be proven, `CLEANUP = FAIL` with `CLEANUP_FAILED`, and the terminal evidence artifact is still written and hashed.

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

One positive or negative run family is valid only when all evidence binds to one exact clean head/environment/attempt tuple and carries a mechanically recomputable `run_family_id`:

```text
RUN_FAMILY_ID = sha256(canonical_json({
  repo_head,
  base_main,
  merge_base,
  changed_files,
  frozen_spec_blob,
  working_tree_clean,
  implementation_file_blobs,   // sorted map of all changed/implementation file Git blobs
  dockerfile_blob,             // tests/fixtures/pg-jieba-readiness/Dockerfile Git blob
  readiness_state_blob,        // tests/fixtures/pg-jieba-readiness/readiness-state.ts Git blob
  db_harness_blob,             // tests/db/pg-jieba-readiness.test.ts Git blob
  lexicon_identity: { dict_blob, manifest_blob, dict_sha256 },
  corpus_identity: { manifest_blob, corpus_sha256, query_manifest_identity },
  upstream_source_identity: { pg_jieba_repo, pg_jieba_commit, libjieba_commit, extension_version },
  environment_identity: { base_image_ref, derived_image_id, pg_server_version, pg_server_version_num, runtime_role },
  attempt_identity: { attempt_id, attempt_nonce, attempt_started_at }
}))
```

Mechanical rules:
- `readiness-state.ts` must export the deterministic `computeRunFamilyId(...)` derivation and `evaluateReadinessEvidence` must recompute and verify `obs.run_family_id === expectedRunFamilyId`.
- An arbitrary non-empty string (e.g., raw `randomUUID()` not derived from the above tuple) MUST FAIL validation and MUST NOT pass `evaluateReadinessEvidence`.
- `working_tree_clean !== true` (working-tree drift) MUST invalidate positive readiness.
- Any mismatch in `repo_head`, `implementation_file_blobs`, `dockerfile_blob`, `readiness_state_blob`, `db_harness_blob`, lexicon/corpus blob or SHA-256, upstream source identity, environment identity, or attempt identity (mixed-head evidence, stale evidence, fixture drift, or head mismatch) MUST reject aggregate PASS.

Do not combine:
- compatibility evidence from one head with query evidence from another;
- baseline from one image with loaded behavior from another build;
- tokenization before fixture freeze with retrieval after fixture edits;
- results from different corpus or lexicon fingerprints;
- evidence from an earlier commit/dirty tree with a different target HEAD.

Runtime evidence must be emitted outside the committed source tree or as attached run output so that evidence generation does not change the exact implementation head it claims to bind. Its own SHA-256 is recorded in the Developer handoff.

Any implementation change after runtime evidence invalidates that run family and requires a full rerun on the new exact head.

## 19. Verification Commands / Suites

Developer shall implement and run the following categories; exact package-manager invocation must use the repository's existing Bun/Vitest conventions at the current main.

Static/planning/governance:
- verify Corrected Spec blob unchanged (`b489bf974032b3bfed678443cda42001ec162f63`);
- verify changed files are exactly/subset of the seven planned test-only paths;
- run current governance and change-governance validators (`node .specify/scripts/validate-governance.mjs` and `node .specify/scripts/validate-change-governance.mjs`) and confirm fixed-exempt test-only classification;
- run current static guard and its self-test (`node scripts/guard-static.mjs` and `node scripts/guard-static.mjs --self-test`);
- run canonical verify-all (`bun run verify-all`).

Architecture:
- run `tests/architecture/pg-jieba-readiness-evidence.test.ts`;
- prove all five states and aggregate precedence;
- prove provenance/fingerprint/freeze constraints;
- prove failure-injection evaluator consumption, non-PG18-incompatibility classification, and failure-injection cleanup enforcement;
- prove exception terminal-evidence state-machine invariants (`capture -> classify -> cleanup -> terminal evidence artifact`);
- prove recomputable `run_family_id` verification and explicitly test adversarial rejection of: `fake run_family_id`, `working-tree drift`, `fixture drift`, `mixed-head evidence`, `stale evidence`, and `head mismatch`.

Real Stage A-derived execution:
- explicitly opt in with `PG_JIEBA_READINESS_TEST=1`;
- verify clean working tree and exact head before run;
- build exact derived image from the pinned base and upstream source;
- execute `tests/db/pg-jieba-readiness.test.ts`;
- capture compatibility, baseline, loaded, tokenization, lexical query, evaluator-consumed failure-injection, stage exception handling (guaranteed terminal artifact emission), and cleanup evidence;
- repeat the complete successful/terminal run once with a fresh `attempt_identity` and freshly recomputed `run_family_id` for rerun reproducibility.

No command may invoke embeddings, sparsevec, fusion, RRF, reranking or Gold Dataset evaluation.

## Verification Plan

Consolidated mechanical verification contract governing Developer remediation and verification closeout:

| Verification Track | Required Command(s) / Target(s) | Mechanical Proof Contract |
|---|---|---|
| Planning & Change Governance | `node .specify/scripts/validate-governance.mjs`; `node .specify/scripts/validate-change-governance.mjs --base "$DEVELOPMENT_BASE" --head HEAD`; `node scripts/guard-static.mjs`; `node scripts/guard-static.mjs --self-test` | Corrected Spec blob `b489bf974032b3bfed678443cda42001ec162f63` unchanged; changed files remain within the frozen 7-file `tests/` fixed-exempt surface; zero product/governance drift. |
| Architecture & Adversarial Evidence Contract | `bunx vitest run tests/architecture/pg-jieba-readiness-evidence.test.ts` | Proves 5-state machine, aggregate precedence, failure-injection evaluator consumption & non-incompatibility classification, terminal exception capture/cleanup invariants, recomputable `run_family_id`, and all 6 adversarial identity defects (`fake run_family_id`, `working-tree drift`, `fixture drift`, `mixed-head evidence`, `stale evidence`, `head mismatch`). |
| Real Stage A Disposable DB Spike | `PG_JIEBA_READINESS_TEST=1 PG_JIEBA_EVIDENCE_OUT=/tmp/xiaoshuyin-s22-evidence.json bunx vitest run tests/db/pg-jieba-readiness.test.ts` (plus clean second rerun with distinct `attempt_identity` & `run_family_id`) | Verifies exact PG18 + pinned `pg_jieba` build/load, frozen 3-term lexicon differential, disposable CTE lexical query, evaluator-consumed failure injection + cleanup proof, `capture -> classify -> cleanup -> terminal evidence artifact` on any stage exception, and deterministic rerun reproducibility. |
| Full Repository Regression | `bun run verify-all` | Confirms repository-wide regression passes on exact candidate `HEAD` without widening into Candidate B RAG, Slice 20/21, or Gold Dataset evaluation. |

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
- exact implementation head and clean working-tree proof;
- merge base; ahead/behind; changed files;
- Corrected Spec head/blob (`210363fb3e6a739c49c4aa6e95338b80935dd465` / `b489bf974032b3bfed678443cda42001ec162f63`);
- plan/checklist/tasks blobs;
- all implementation and fixture Git blobs (`Dockerfile`, `readiness-state.ts`, DB harness, architecture test, lexicon/corpus manifests and dictionary);
- governance classification;
- base and derived image identities;
- PG18 identity;
- pg_jieba source/submodule/extension/build hashes;
- execution role/security facts;
- lexicon manifest/blob/SHA-256 and per-term provenance;
- corpus/query manifest/blob/SHA-256;
- `attempt_identity` and recomputable `run_family_id` verification proof;
- raw baseline and loaded tokenization observations;
- lexicon differential observation;
- raw lexical query matched IDs;
- real failure-injection observation, evaluator-consumed outcome, non-PG18-incompatibility proof, and failure-injection cleanup proof;
- stage exception terminal-evidence confirmation (`capture -> classify -> cleanup -> terminal evidence artifact` for `startup`, `build`, `SQL`, `tokenization`, `query`, `cleanup`);
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
| FR-006 | 11,13,18 | C22-EVD-01..12 | T008,T009,T010 |
| FR-007 | 15 | C22-STATE-01..10 | T004,T010 |
| FR-008 | 15,18 | C22-STATE-08..10, C22-HEAD-01..12 | T010,T011 |
| FR-009 | 6,14,15 | C22-NEG-01..15, C22-STATE-01..10 | T004,T010 |
| FR-010 | 16 | C22-CLN-01..10 | T009,T010,T011 |
| FR-011 | 3,20 | C22-SCOPE-01..10 | T001,T002,T011 |
| FR-012 | 2,3,9,10,21 | C22-AUTH-01..10 | T001,T003,T012 |
| AS-01 | 7,8,18 | C22-ENV-01..08, C22-COMP-01..09 | T006 |
| AS-02 | 11,12 | C22-TOK-01..10 | T008 |
| AS-03 | 9,12 | C22-LEX-01..12, C22-TOK-09..10 | T007,T008 |
| AS-04 | 10,13 | C22-QRY-01..08 | T009 |
| AS-05 | 14,15 | C22-NEG-01..15 | T004,T009,T010 |
| AS-06 | 3,15,21 | C22-SCOPE-01..10, C22-STATE-01..10 | T010,T012 |
| AS-07 | 16 | C22-CLN-01..10 | T009,T010 |
| AS-08 | 16,17,18 | C22-CLN-08..10, C22-PRIV-01..08, C22-HEAD-01..12 | T011,T012 |
| NS-01 | 8,15 | C22-COMP-05..09, C22-NEG-01..03 | T006,T010 |
| NS-02 | 6,8,15 | C22-NEG-01..03 | T001,T006,T010 |
| NS-03 | 7,15,18 | C22-ENV-01..08, C22-STATE-01..10 | T006,T010 |
| NS-04 | 9,10,14 | C22-AUTH-01..10, C22-NEG-04..06 | T003,T004 |
| NS-05 | 9,10,18 | C22-LEX-10..12, C22-CORP-08..10, C22-HEAD-01..12 | T003,T006,T011 |
| NS-06 | 10,18 | C22-CORP-08..10, C22-HEAD-01..12 | T003,T011 |
| NS-07 | 11,12,14 | C22-TOK-01..10, C22-NEG-07 | T004,T008 |
| NS-08 | 12,15 | C22-LEX-01..12, C22-TOK-01..10, C22-STATE-01..10 | T008,T010 |
| NS-09 | 13,15 | C22-QRY-01..08, C22-STATE-01..10 | T009,T010 |
| NS-10 | 3,20 | C22-SCOPE-01..10 | T001,T002,T011 |
| NS-11 | 3,5,16,20 | C22-GOV-01..08, C22-CLN-01..10 | T002,T011 |
| NS-12 | 2,9,10,17 | C22-AUTH-01..10, C22-PRIV-01..08 | T003,T012 |

No FR, AS or NS is orphaned.
