# Slice 21 — Sparsevec Readiness Spike — Implementation Plan

> Repository: `pyxm1618/xiaoshuyin`  
> Feature: `021-sparsevec-readiness-spike`  
> Role: Plan AI 2 — Plan / Checklist / Tasks / Audit 1 only  
> Frozen Spec branch: `spec/021-sparsevec-readiness-spike`  
> Frozen Spec exact head: `688ad88ee4bbadce29a884f9e31d6e85bc8fee48`  
> Frozen Spec blob: `952a64610f09997a86571e1e1f390eb5660170ca`  
> Planning branch: `plan/021-sparsevec-readiness-spike`  
> Status after Audit 1 PASS: PLANNING FROZEN / WAITING FOR IMPLEMENTATION GATE / DEVELOPMENT NOT AUTHORIZED

## 1. Remote Truth and Reconciliation

Planning was reconciled against remote GitHub before authoring.

- Current `main`: `3161677256c479e0e6754554a07e08a1fbaf16ef`.
- Frozen Spec branch exact head re-read: `688ad88ee4bbadce29a884f9e31d6e85bc8fee48`.
- Frozen Spec blob re-read: `952a64610f09997a86571e1e1f390eb5660170ca`.
- Frozen Spec branch vs current main before planning sync: ahead 4 / behind 2; merge base `f4765ce004affc464392bf6ade45d886913ed8a9`.
- The two newer main commits changed only `.specify/implementation-ownership.json`; no Slice 19/20/21 RAG, pgvector, provider, test-harness or Authority Doc semantics changed.
- Planning branch was created from the Frozen Spec exact head and merged current main without rebasing frozen history.
- Semantic impact of the two-main-commit drift on this Plan: **NO SEMANTIC IMPACT**.
- Slice 19 implementation PR #110 and post-merge remediation PR #111 are merged. Current Stage A PG18/pgvector harness is therefore a valid upstream substrate to reuse.
- Slice 20 planning authority PR #112 is merged.
- Slice 20 governance prerequisite PR #118 is **OPEN / NOT MERGED**. It is governance-only and is not Slice 20 implementation.
- No Slice 20 implementation PR/branch was found.
- No competing Slice 21 implementation branch/PR was found; only the Frozen Spec branch existed before this planning branch.

If any of these facts change before implementation, T001 must re-read remote truth. No stale planning snapshot authorizes development.

## 2. Authority and Scope

This Plan consumes the Frozen Spec without reopening Q01–Q04.

The Spike is:

> disposable, reproducible, evidence-producing technical verification of Candidate A sparsevec compatibility.

It is not:

- a production retrieval service;
- a reusable sparse framework;
- a production embedding persistence layer;
- a permanent `knowledge_embeddings` schema;
- a production index strategy;
- a ranking framework;
- a RAG engine;
- Gold Dataset execution;
- pg_jieba/RRF/reranking;
- Context Builder or AI Task Runtime.

No production migration, production route, permanent table, lasting index, new provider transport, new secret mechanism or Authority Doc mutation is authorized.

## 3. Governance Decision

### 3.1 Current repository classification

Current `.specify/scripts/validate-change-governance.mjs` classifies:

- production paths: `apps/**`, `packages/**`, `db/**`;
- fixed exempt paths: `.specify/**`, `.github/**`, `specs/**`, `tests/**`, `scripts/**`, `Docs/**`.

Unknown production paths fail closed through `.specify/implementation-ownership.json` using `LONGEST_MATCH`.

### 3.2 Slice 21 implementation surface

The Spike can be completed entirely on fixed-exempt test/evidence surfaces while consuming, but not modifying, the future merged Slice 20 public adapter.

Allowed implementation paths are limited to:

```text
tests/helpers/sparsevec-readiness.ts
tests/architecture/sparsevec-readiness-evidence.test.ts
tests/db/sparsevec-readiness.test.ts
tests/ai/sparsevec-readiness-provider-db.test.ts
tests/fixtures/sparsevec-readiness/chinese-sample-manifest.json
tests/evidence/sparsevec-readiness-stage-a.json
```

The evidence JSON may be generated/updated only by an authorized execution and must remain sanitized.

Forbidden implementation changes include:

```text
apps/**
packages/**
db/**
.github/**
.specify/**
scripts/**
Docs/**
package.json
bun.lock
docker-compose.stage-a.yml
specs/021-sparsevec-readiness-spike/spec.md
specs/019-*/**
specs/020-*/**
```

Reading/importing the merged Slice 20 public adapter from its public entry point is allowed. Editing it is not.

### 3.3 Final governance ruling

```yaml
SLICE 21 GOVERNANCE MODE:
NO NEW PRODUCTION OWNERSHIP REQUIRED

GOVERNANCE PREREQUISITE:
NOT REQUIRED

Reason:
  - all Slice 21 implementation files are under tests/**
  - current change-governance treats tests/** as fixed exempt
  - no apps/**, packages/** or db/** path is created or modified
  - no implementation ownership or change-binding is needed for this Spike
```

If implementation later proves that any production path must change, **STOP**. Do not add ownership in the implementation PR. Return to planning/governance and create a separate minimal governance prerequisite if still authorized.

## 4. Hard Implementation Gate

Planning may finish while Slice 20 is incomplete. Development may not begin until all of the following are independently re-proven on then-current main:

1. Slice 19 remains merged and its Stage A PG18/pgvector 0.8.7 readiness is reproducible.
2. Slice 20 actual product implementation exists.
3. Slice 20 independent Audit 2 = PASS.
4. Slice 20 implementation is merged to `main`.
5. The public normalized adapter seam is available from the merged production entry point and can produce the Frozen Spec's required dense+sparse result for the query/document experiment.
6. All applicable Slice 20 governance prerequisites are merged.
7. Frozen Slice 21 spec blob remains `952a64610f09997a86571e1e1f390eb5660170ca`.
8. No competing Slice 21 owner/implementation has appeared.

Current gate result at planning time:

```text
IMPLEMENTATION GATE: CLOSED
blocking dependency: Slice 20 actual implementation + Audit 2 PASS + merge main are absent
PR #118 does not satisfy this dependency
```

If the merged Slice 20 public adapter cannot express this experiment without raw-provider bypass or semantic expansion, STOP and return to upstream authority reconciliation.

## 5. Test-Only Architecture

### 5.1 File responsibilities

`tests/helpers/sparsevec-readiness.ts`
- pure Slice 21 mapping validator/encoder;
- float32 boundary checks;
- independent sparse dot-product reference;
- fixed Spike-only fusion reference;
- evidence-state derivation helpers;
- no network and no DB connection.

`tests/architecture/sparsevec-readiness-evidence.test.ts`
- mapping positives/negatives;
- float32/zero/order/duplicate/dimension invariants;
- analytical `<#>` sign fixture reference;
- fusion reference, constant-channel, missing-channel and deterministic tie tests;
- evidence state-machine and aggregate derivation tests.

`tests/db/sparsevec-readiness.test.ts`
- real PostgreSQL 18 + pgvector 0.8.7 Stage A DB probe;
- app-role/security check;
- sparsevec storage/readback/distance;
- synthetic D/nnz/HNSW boundaries;
- disposable HNSW index and EXPLAIN evidence;
- failure-safe cleanup and rerun absence proof.

`tests/ai/sparsevec-readiness-provider-db.test.ts`
- explicit opt-in only;
- imports only the merged Slice 20 public adapter entry point;
- actual provider call;
- normalized dense+sparse output;
- Slice 21 mapping;
- actual DB insert/readback/exact scores;
- Chinese sample retrieval;
- fixed fusion;
- sanitized linked evidence output.

`tests/fixtures/sparsevec-readiness/chinese-sample-manifest.json`
- pre-execution corpus/query manifest;
- exact source identity/version/ref;
- rights status;
- text/query fingerprints;
- expected technical match IDs and unrelated distractors;
- no real family/minor/private data.

`tests/evidence/sparsevec-readiness-stage-a.json`
- sanitized final execution evidence for PASS/FAIL/BLOCKED/UNKNOWN/NOT_EVALUATED;
- never contains API keys, raw provider bodies, unapproved raw text or personal data.

No new generic library is created.

## 6. Frozen Sparse Mapping Contract

Spike sparse coordinate capacity:

```text
D = 1,000,000,000
provider normalized index = non-negative integer
SQL sparsevec textual coordinate = 1-based
sql_index = normalized_index + 1
```

Rules:

1. All query/document sparse vectors use the same D.
2. Dense dimension is independent and must never bound sparse indices.
3. Actual Slice 20 normalized input must already be strictly ascending by index. Slice 21 rechecks this boundary; an unsorted normalized result is an upstream-contract violation and fails closed, not silently re-normalized.
4. Uniqueness is rechecked before zero removal, including zero-valued entries.
5. Values must be finite.
6. Convert every nonzero value with JavaScript `Math.fround` semantics before DB encoding.
7. Reject if `Math.fround(value)` is non-finite.
8. Reject a nonzero input whose `Math.fround(value) === 0` (nonzero underflow-to-zero).
9. Exact `+0` and `-0` are removed only after validation.
10. Empty/all-zero post-filter sparse payload is rejected for retrieval.
11. Highest valid provider key is `D - 1`, mapping to SQL coordinate D.
12. Provider key `>= D` is rejected; no compression, hashing, collision merge or truncation.
13. Canonical SQL text is `{index:value,...}/D`, but actual payload is always supplied through query parameter binding; never interpolate payload text into SQL.
14. Readback must preserve exact D and exact coordinate set. Weight comparison is against expected float32 values.

Required mapping tests include:

- provider index 0 -> SQL 1;
- provider index D-1 -> SQL D;
- provider index D -> reject;
- high index much larger than dense dimension -> accept when < D;
- unsorted normalized input -> reject;
- duplicate index including zero-valued duplicate -> reject;
- NaN/Inf -> reject;
- float32 overflow -> reject;
- nonzero float32 underflow -> reject;
- exact zero removal -> accept only if other nonzero entries remain;
- empty/all-zero -> reject;
- same D across all rows/query;
- dense and sparse dimensions demonstrably independent.

## 7. Real DB Probe Contract

Target identity is fixed by the Frozen Spec:

```text
PostgreSQL major: 18
pgvector: 0.8.7
image:
pgvector/pgvector:0.8.7-pg18-trixie@sha256:5895949dfcdf308eb0cd31c950c93c14895c77f33fbedfecf1fa511ab1d4bcd2
runtime role: xiaoshuyin_app
```

The test must query actual server/version/extension/role. Configuration alone is insufficient.

Every DB probe uses TEMP objects only. Expected-error cases use SAVEPOINT/ROLLBACK TO SAVEPOINT so an expected failure does not poison cleanup.

Required synthetic boundaries:

- `sparsevec(D)` creation/insert: PASS.
- `sparsevec(D+1)`: expected FAIL.
- storage 16,000 nonzero entries: PASS.
- storage 16,001 nonzero entries: expected FAIL.
- HNSW sparsevec 1,000 nonzero entries: PASS.
- HNSW sparsevec 1,001 nonzero entries: expected incompatibility.
- actual provider payload >16,000 nonzero entries: Candidate A FAIL under tested contract.
- actual payload >1,000 and <=16,000: do **not** truncate; exact-scan compatibility may still be VERIFIED while `actual_hnsw_compatible=false` is recorded.

No provider call is used to manufacture synthetic boundary vectors.

## 8. Distance and Ranking Verification

### 8.1 Sparse exact inner product

Database operator:

```sql
sparse_embedding <#> $query_sparsevec
```

pgvector `<#>` is negative inner product. Therefore:

```text
db_distance = sparse_embedding <#> query
sparse_similarity = -db_distance
SQL exact ranking: ORDER BY sparse_embedding <#> $query ASC, sample_id ASC
```

Independent reference:

```text
reference_ip = sum(Math.fround(q_i) * Math.fround(d_i)) over matching coordinates
```

Acceptance tolerance for DB vs independent reference:

```text
abs(db_similarity - reference_ip) <= 1e-5 * max(1, abs(reference_ip))
```

Analytical fixture frozen for sign/direction:

```text
query/doc A = {1:0.5, 8:-0.25}/D
reference inner product(A,A) = 0.3125
expected DB <#> = -0.3125

doc B = {1:0.25, 8:0.5}/D
reference inner product(query,B) = 0
A must rank before B
```

### 8.2 Dense exact cosine

Dense values come from the same Slice 20 normalized result. Dense zero vectors are rejected.

```sql
dense_embedding <=> $query_vector
```

```text
dense_similarity = 1 - cosine_distance
SQL ranking: ORDER BY dense_embedding <=> $query ASC, sample_id ASC
```

Dense dimension is taken from the merged Slice 20 configured/normalized result and is never reused as sparse D.

### 8.3 Tie handling

All DB exact-order assertions use `sample_id ASC` only as a deterministic tie-breaker.

Tie-breakers never make the Chinese retrieval correctness criterion pass: the expected technical match must have a strictly higher fused score than every declared unrelated distractor.

These metrics are **SPIKE VERIFICATION ONLY — NOT PRODUCTION RANKING AUTHORITY**.

## 9. HNSW Behavior Probe

HNSW is a separate observation from exact sparse retrieval.

- Create disposable HNSW on TEMP sparsevec column with `sparsevec_ip_ops`.
- Use bounded test data.
- Use transaction-local planner control only if required: `SET LOCAL enable_seqscan = off`.
- Run `EXPLAIN (FORMAT JSON, COSTS OFF)` for an `ORDER BY embedding <#> query LIMIT k` query.
- Mechanically assert the expected HNSW index is present in the plan.
- Transaction end/reset must restore planner state.
- Compare bounded returned IDs/scores with exact reference, while explicitly recording that ANN is not a global exactness guarantee.
- Record 1,001-nnz HNSW incompatibility without truncating payload.
- A real payload over HNSW's 1,000-nnz limit does not by itself invalidate exact sparsevec compatibility if every exact-path gate passes; it must be reported truthfully as index incompatibility.

Unexpected HNSW behavior or inability to execute the required probe is not a positive observation.

## 10. Real Provider -> Real DB Linked Evidence

Positive evidence must form one provenance chain:

```text
merged Slice 20 public adapter
  -> actual provider dense+sparse call
  -> normalized outputs
  -> Slice 21 mapping
  -> actual PG18/pgvector sparsevec + dense vector TEMP rows
  -> readback
  -> exact sparse and dense scores
  -> Chinese retrieval
  -> fixed fusion
  -> one linked evidence artifact
```

Rules:

- Import only Slice 20's public adapter entry point. Do not import transport/parser internals.
- Do not parse raw HTTP in Slice 21.
- Do not create a second provider client.
- Do not pass endpoint/API key as Slice 21 request data.
- Use Slice 20 controlled runtime configuration/secret injection.
- Use the same configured model/output type/coordinate namespace for corpus and query calls.
- No invented `text_type` or query/document provider field.
- Stable Slice 21 `sample_id` / `query_id` is test-harness identity, not provider authority.
- Provider request IDs, configured model provenance and observed normalized sparse stats are linked to the DB rows by these stable test identities.
- A provider-only PASS plus an unrelated synthetic DB PASS is insufficient.

## 11. Chinese Professional Sample Protocol

This is a technical retrieval sample, not a clinical Gold Dataset.

Frozen minimum:

```text
documents: exactly 6
queries: exactly 3
distinct expected target documents: 3
unrelated distractors per query: at least 2
minimum distinct topic/source sections represented: 3
```

Before **any** live provider call, `chinese-sample-manifest.json` must be committed/frozen on the implementation branch and must contain:

- manifest ID/version;
- six stable document IDs;
- three stable query IDs;
- source provenance and source version/ref for every document;
- `rights_status = PERMITTED_FOR_TEST`;
- normalized-text SHA-256 fingerprint;
- no family/minor/patient/private-data assertion;
- query text and query SHA-256;
- one predeclared expected technical match ID per query;
- at least two predeclared unrelated distractor IDs per query;
- a non-clinical expectation basis such as explicit source-topic/section match;
- freeze commit SHA/timestamp.

No post-provider edit of expectations is allowed in the same evidence run. Any manifest change invalidates prior run evidence and requires a fresh provider/DB run.

If permitted real source text or a non-clinical expected technical match cannot be established without professional judgment, mark the affected run **BLOCKED**. Do not invent clinical labels.

Technical success for each query:

1. all six candidates have both dense and sparse DB-derived raw scores;
2. the expected match has strictly greater fused score than every declared unrelated distractor;
3. the expected match ranks #1 in the six-document fused result;
4. no tie-break rule is used to manufacture success.

This 6x3 protocol is deliberately small but non-degenerate: it proves multi-document ranking across three independent query/target pairs and unrelated distractors without becoming a benchmark.

## 12. Spike-Only Fusion Reference

Frozen reference mechanics:

```text
candidate set = the same 6 document IDs for one query

for each channel c in {dense, sparse}:
  min_c = min(raw score)
  max_c = max(raw score)

  if max_c > min_c:
    norm_c(x) = (x - min_c) / (max_c - min_c)
  else:
    norm_c(x) = 0 for every candidate

fused(x) = 0.5 * dense_norm(x) + 0.5 * sparse_norm(x)
```

Rules:

- raw dense/sparse scores are always retained;
- missing channel, duplicate sample ID or non-finite score fails closed;
- constant channel contributes no discrimination and receives all-zero normalized scores;
- no weight tuning/search;
- no RRF;
- no reranker;
- no Gold Dataset optimization;
- deterministic final sort: fused descending, then `sample_id ASC`;
- independent recomputation must match stored normalized/fused values within `1e-12`.

```text
SPIKE REFERENCE ONLY
NOT PRODUCTION AUTHORITY
```

## 13. Persistence and Cleanup

Hard boundary:

```text
NO production migration
NO permanent table
NO production knowledge_embeddings
NO lasting index
NO business row
NO production route
```

DB harness requirements:

1. TEMP tables/indexes only.
2. Expected failures isolated by SAVEPOINT.
3. `finally` cleanup path always runs.
4. Success path verifies TEMP object absence after cleanup/transaction end.
5. Injected failure path verifies the same absence.
6. Rerun test executes the harness twice and proves no leftover relation/index/name collision.
7. Planner override is transaction-local or explicitly reset.
8. Cleanup failure sets aggregate result to FAIL; it can never coexist with PASS.

## 14. Evidence Artifact Contract

`tests/evidence/sparsevec-readiness-stage-a.json` must contain at least:

```text
schema_version
run_id
timestamp
repo_head
frozen_spec_head
frozen_spec_blob
slice19_provenance
slice20_head
slice20_public_adapter_ref
stage
postgres_version
postgres_version_num
pgvector_version
image_digest
execution_role
runtime_superuser
runtime_bypassrls
runtime_public_schema_create
configured_model
configured_output_type
provider_request_ids
observed_sparse_stats
dimension_policy
sparse_dimension
dense_dimension
nnz
mapping_result
db_roundtrip_result
distance_result
independent_calculation
tolerance
index_behavior
actual_hnsw_compatible
chinese_manifest_id
chinese_sample_identities
source_fingerprints
fusion_raw_scores
fusion_reference_scores
negative_probes
cleanup_status
limitations
flags
candidate_a_readiness_state
execution_completion_state
final_evidence_state
```

For each real query/document item, store lineage identifiers and hashes sufficient to join:

```text
sample/query id
provider request id
normalized sparse SHA-256
mapped sparsevec SHA-256
DB readback SHA-256
raw dense score(s)
raw sparse score(s)
```

Do not store:

- API keys/secrets;
- authorization headers;
- raw provider response body;
- unapproved raw source text in evidence;
- family/minor/patient/private data.

The fixture may contain permitted test text; the evidence file references it by identity/fingerprint.

## 15. Mechanical Evidence State Machine

Each lower-level status is one of:

```text
VERIFIED
FAIL
BLOCKED
UNKNOWN
NOT_EVALUATED
```

### MAPPING_CONTRACT_VERIFIED

`VERIFIED` only if all mapping/float32/order/duplicate/zero/D tests in the architecture suite pass.

No provider or DB evidence is required for this flag.

### SPARSE_PAYLOAD_VERIFIED

`VERIFIED` only if:

- implementation gate proves Slice 20 merged + Audit 2 PASS;
- actual provider call occurs through merged public Slice 20 adapter;
- all 6 documents + 3 queries return normalized nonempty dense+sparse outputs under one recorded config;
- provider provenance/request IDs are present as available under Slice 20 contract;
- normalized sparse inputs satisfy canonical order, uniqueness, finite/float32/D compatibility and nonempty post-zero filtering;
- evidence lineage hashes are written.

Mocks/fixtures alone can never set this to VERIFIED.

### PGVECTOR_SPARSEVEC_VERIFIED

`VERIFIED` only if:

- actual target identity = PG18 + pgvector 0.8.7 + pinned image evidence;
- runtime role boundary is correct;
- linked real provider payloads are inserted/read back from actual sparsevec(D) and dense vector TEMP rows;
- exact sparse/dense scores match independent references within tolerance;
- synthetic D/16k/HNSW boundary probes produce expected results;
- HNSW EXPLAIN proves the disposable index path can execute for the supported fixture;
- cleanup/rerun absence verification passes.

Synthetic-only DB success cannot set this flag.

### FUSION_PROTOTYPE_VERIFIED

`VERIFIED` only if:

- the same linked real sample IDs have both dense and sparse DB-derived scores;
- fixed min-max + 0.5/0.5 mechanics exactly match independent recomputation;
- missing-channel/constant-channel/tie/duplicate/nonfinite negative cases pass;
- all three predeclared Chinese queries satisfy the strict expected-match technical rule.

### Aggregate

`SPARSEVEC_SPIKE_PASS_STAGE_A = true` only when all four statuses are VERIFIED, exact dependency identities are valid and cleanup is CLEAN.

`candidate_a_readiness_state` is derived:

- PASS: aggregate true.
- FAIL: required execution completed and a deterministic incompatibility/incorrect result was observed, including cleanup failure.
- BLOCKED: a prerequisite, credential, permission or approved test-source dependency is unavailable.
- UNKNOWN: execution occurred but evidence is inconclusive/unexpected.
- NOT_EVALUATED: required execution did not run.

`execution_completion_state` is independent:

- `COMPLETED_WITH_PASS`
- `COMPLETED_WITH_FAIL`
- `BLOCKED`
- `INCONCLUSIVE`
- `NOT_EVALUATED`

A reproducible FAIL can therefore complete the Spike implementation without making Candidate A ready. BLOCKED/UNKNOWN/NOT_EVALUATED can never be described as positive readiness.

No Developer-set boolean is authoritative; the helper derives final state from lower evidence predicates.

## 16. Verification Commands

Developer may adapt exact command syntax only to the merged repository runner, not semantics. Expected command classes:

```bash
bunx vitest run tests/architecture/sparsevec-readiness-evidence.test.ts

SPARSEVEC_DB_READINESS_TEST=1 \
PGVECTOR_EXPECTED_VERSION=0.8.7 \
DATABASE_URL=<existing Stage A app-role URL> \
bunx vitest run tests/db/sparsevec-readiness.test.ts

SPARSEVEC_PROVIDER_VERIFY=1 \
DATABASE_URL=<existing Stage A app-role URL> \
SPARSEVEC_EVIDENCE_PATH=tests/evidence/sparsevec-readiness-stage-a.json \
bunx vitest run tests/ai/sparsevec-readiness-provider-db.test.ts

node .specify/scripts/validate-governance.mjs
node .specify/scripts/tests/run-governance-tests.mjs
node .specify/scripts/validate-change-governance.mjs --base origin/main --head HEAD
node .specify/scripts/tests/run-change-governance-tests.mjs
node scripts/guard-static.mjs
node scripts/guard-static.mjs --self-test
node scripts/verify-all.mjs
```

Secrets remain injected only through Slice 20's existing runtime mechanism; do not print them in command lines or evidence.

## 17. STOP Conditions

Immediately STOP and do not improvise if any occurs:

1. Frozen Spec blob changes.
2. Authority Docs or merged Slice 20 contract materially conflict with the Frozen Spec.
3. Slice 20 is not implementation-complete, Audit-2-PASS and merged.
4. Public Slice 20 normalized port cannot support the required experiment.
5. A raw provider client/parser would be needed.
6. Any `apps/**`, `packages/**` or `db/**` modification is required.
7. A production migration/table/index/route is required.
8. PG18/pgvector target drifts from the Frozen contract without authority reconciliation.
9. Test sources lack permission or contain private/family/minor data.
10. A Chinese expected match requires clinical/professional judgement not already available.
11. Cleanup cannot be mechanically proven.
12. Evidence cannot join provider -> mapping -> DB -> score -> fusion by stable IDs.
13. A missing channel would require fallback.
14. HNSW success would require payload truncation or remapping.
15. Any result would need to be labelled READY without all lower flags VERIFIED.

## 18. Frozen-Spec Traceability

| Frozen requirement | Plan coverage | Checklist | Tasks |
|---|---|---|---|
| FR-001 actual provider -> actual sparsevec | §§7,10,14,15 | C21-15..C21-29 | T007,T008,T010 |
| FR-002 consume Slice 20 public normalized result | §§4,10 | C21-07,C21-08,C21-25 | T001,T007 |
| FR-003 stage/privilege/disposable DB | §§7,13 | C21-12..C21-14,C21-20..C21-24 | T005,T006,T010 |
| FR-004 Chinese retrieval + bounded fusion | §§11,12 | C21-30..C21-37 | T003,T008,T009 |
| FR-005 truthful evidence/failure states | §§14,15 | C21-38..C21-46 | T010,T011,T012 |
| FR-006 approved test content / no professional approval invention | §11 | C21-30..C21-33,C21-47 | T003,T008 |
| FR-007 defer production retrieval/Gold/pinning | §§2,12 | C21-03..C21-06,C21-48 | all |
| FR-008 governance/no lasting schema | §§3,13 | C21-09..C21-14,C21-49 | T002,T010,T011 |

Acceptance scenarios AS-01..AS-08 and negative scenarios NS-01..NS-08 are each assigned in `tasks.md` and mechanically represented in `checklist.md`. No Frozen requirement is intentionally left to Developer judgement.

## 19. Developer Handoff Boundary

After Audit 1 PASS this Plan is frozen.

Current state remains:

```yaml
PLANNING: COMPLETE
AUDIT_1: FINAL_PASS
READY_FOR: WAITING_FOR_IMPLEMENTATION_GATE
DEVELOPMENT: NOT_AUTHORIZED
BLOCKER: Slice 20 actual implementation + independent Audit 2 PASS + merge main
```

No implementation, implementation PR, Audit 2 or merge is authorized by this Plan.
