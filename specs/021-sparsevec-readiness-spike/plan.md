# Slice 21 — Sparsevec Readiness Spike — Implementation Plan

> Repository: `pyxm1618/xiaoshuyin`
> Feature: `021-sparsevec-readiness-spike`
> Role: Plan AI 2 (targeted planning reconciliation owner) — Plan / Checklist / Tasks only
> Frozen Spec branch: `spec/021-sparsevec-readiness-spike`
> Frozen Spec exact head: `8792c4cf4e366b5507ac451a68cd31b73e7f5261`
> Frozen Spec blob (`specs/021-sparsevec-readiness-spike/spec.md`): `77d1caf4de6fdead3efcdb0cf3e8c594d444efbd`
> Superseded Spec authority (history only): head `688ad88ee4bbadce29a884f9e31d6e85bc8fee48`, blob `952a64610f09997a86571e1e1f390eb5660170ca` — SUPERSEDED BY TARGETED SPEC CORRECTION.
> Planning branch: `plan/021-sparsevec-readiness-spike` (previous planning head `2363bb5e41e6f1a2b92ee4c9f406b784cab711d3` — NOT executable; superseded by this reconciliation).
> This document does not self-record its own Audit 1 verdict (no self-reference). The Audit 1 verdict is reported against the exact remote planning head outside this file.
> Developer AI: NOT AUTHORIZED by this document. See §4 Implementation Gate.

## 1. Remote Truth and Reconciliation

Remote truth was re-read with `git fetch`-equivalent remote reads and local Git on 2026-11-26 (Asia/Shanghai):

| Item | Value |
|---|---|
| `origin/main` | `e7885234f4b5c4aec61d6a9dfc2b6ff5e6304512` (`chore(s20): close post-merge planning and task evidence (#147)`); previous reconciliation point `21a2e372754843af5ee4daa109e75b693ce4feb1` (#145) |
| `origin/spec/021-sparsevec-readiness-spike` | `8792c4cf4e366b5507ac451a68cd31b73e7f5261` |
| `origin/plan/021-sparsevec-readiness-spike` before reconciliation | `2363bb5e41e6f1a2b92ee4c9f406b784cab711d3` |
| main ↔ Frozen Spec merge base / behind / ahead | `f4765ce004affc464392bf6ade45d886913ed8a9` / Spec behind main 16 / ahead 5 |
| main ↔ old Planning merge base / behind / ahead | `3161677256c479e0e6754554a07e08a1fbaf16ef` / 14 / 7 |
| Frozen Spec ↔ old Planning merge base | `688ad88ee4bbadce29a884f9e31d6e85bc8fee48` (old Planning lacked Spec commit `8792c4cf`) |
| Open PRs touching Slice 21 | none |
| Competing Slice 21 branches / implementation | none (only `spec/021-…` and `plan/021-…`; no `tests/**sparsevec**`, no `feat/021-*`) |

Reconciliation method (no rebase, no force push, no history rewrite):

1. normal merge commit of `origin/spec/021-sparsevec-readiness-spike` (`8792c4cf`) into the old Planning head;
2. normal merge commit of `origin/main` (`21a2e372`) into the result, then a second normal merge of `origin/main` (`e7885234`, PR #147) after main advanced;
3. correction commit touching only `plan.md`, `checklist.md`, `tasks.md`.

Mechanical reconciliation facts at the corrected planning state:

- `specs/021-sparsevec-readiness-spike/spec.md` blob = `77d1caf4de6fdead3efcdb0cf3e8c594d444efbd` (unchanged);
- tree delta versus `origin/main` = exactly the four Slice 21 spec-directory files (`spec.md`, `plan.md`, `checklist.md`, `tasks.md`);
- `.specify/implementation-ownership.json` is byte-identical to `origin/main` (the old Planning branch's ownership drift came from main history, PR #135, and converges by the normal merge); Slice 21 ownership delta = NONE.

Governance/CI contract identities read on `origin/main` (blob SHAs) and used by this Plan:

| Path | Blob |
|---|---|
| `.specify/scripts/validate-governance.mjs` | `65110866cfebc8ea313ea77d6e89ed4df3b362fd` |
| `.specify/scripts/validate-change-governance.mjs` | `9bbd481ec743adec0684835f3ad568edc7778124` |
| `.specify/scripts/validate-task-evidence-remote.mjs` | `96d7d73b22f5c32b71c87d9ff7ac639047133b68` |
| `.github/workflows/ci.yml` | `27ed989e330caab6641f1c4a2054a840eb5a5e3c` |
| `scripts/verify-all.mjs` | `2de9b5dc50836236a56c7bd89d886566047ac5c5` |
| `scripts/guard-static.mjs` | `50c6864fc9337b2ca5a996bc98dc5e7647be798c` |
| `.specify/implementation-ownership.json` | `07baeed2eaf0f98fce65e906a81ba869ac892247` |
| `apps/server/api/src/ai/embedding/index.ts` (Slice 20 public entry) | `e456ae2c00c429d2fc2be7c41d2b4e60e5e02427` |
| `apps/server/api/src/ai/embedding/config.ts` | `48f41c02af704df5b56ac6293ee5deb3fc9224b1` |
| `vitest.config.ts` | `2901fc914bcb50969d10275430e033625b0e96ce` |

Upstream state:

- Slice 19: merged; canonical CI `verify-all` executes `G9` (`tests/architecture/pgvector-readiness-evidence.test.ts`, `tests/db/pgvector-readiness.test.ts`) and `G11` (`scripts/pgvector-readiness.mjs`) against the pinned Stage A image.
- Slice 20 implementation: PR #142, exact head `27a0ac5761b16ff7837a28936438f30aca1d68e0`, merged as `db07babd42976e5e13dbe08bc3e5f1a9b1c8cbaf`. Public entry `apps/server/api/src/ai/embedding/index.ts` exports `createEmbeddingProvider(config = { env }, deps)`; role text type is selected only through the controlled runtime variable `EMBEDDING_TEXT_TYPE = query | document` (default `document`).
- Slice 20 Audit 2: **durable independent Audit 2 PASS evidence NOT FOUND** for exact head `27a0ac57…` (PR #142 body ends at "READY FOR AUDIT 2"; PR reviews are a bot COMMENTED review and two empty owner COMMENTED reviews; `.specify/task-provenance-registry.json` `s20-post-merge-closeout` is post-merge provenance, not an audit verdict; PR #145 states it makes no task-completion / PASS claim; PR #147 (`e7885234`) checks Slice 20 T001–T010, T012 via a POST_MERGE_CLOSEOUT manifest — T012 is "STOP at READY FOR AUDIT 2" — keeps T011 unchecked (`PROVIDER_NOT_VERIFIED`), has no PR review, and records no Audit 2 verdict). See §4.

If any value above changes before implementation, T001 re-reads remote truth; no stale snapshot authorizes development.

## 2. Upstream Traceability

This Plan consumes, and does not amend, the following authorities (precedence: four Docs → frozen upstream specs → Frozen Slice 21 Spec → this Plan):

| Authority | Obligation consumed by this Plan | Plan sections |
|---|---|---|
| `Docs/总产品需求.md` §§28, 31A, 32 | model replaceability; professional authority; formal document precedence; no speculative future work | §3, §5, §16 |
| `Docs/V1产品需求.md` preamble; V1-C03, V1-C27, V1-C37, V1-X08 | truthful UNKNOWN/FAIL; AI/RAG cannot manufacture professional approval or readiness | §13, §14, §15 |
| `Docs/总体技术架构.md` §§11.1–11.5, 17.5, 18A, 19A | Candidate A = `qwen3.7-text-embedding` dense+sparse → pgvector `vector` + `sparsevec` → fusion; Spike incl. real Chinese sample retrieval correctness; A/B/C chosen later on Gold Dataset | §6, §11, §12, §15 |
| `Docs/V1技术设计.md` §4.2 | Spike items (mapping, dimension, nnz, insert/read/distance, index/query behavior, fusion) and required record fields `postgres_version, tencentdb_kernel_version, extension_name, extension_version, sparsevec_spike_status, rag_candidate_status, readiness_status, checked_at, evidence_ref` | §13, §14 |
| `Docs/V1技术设计.md` §§13.1–13.6, 20 | Adapter ownership; no HNSW/production index decision now; pinned versions later | §5, §9, §16 |
| `specs/019-professional-retrieval-pgvector-readiness/spec.md` | Stage A target, privilege boundary, readiness ≠ RAG readiness | §7, §14 |
| `specs/020-embedding-provider-adapter-foundation/{spec,plan,tasks}.md` | sole provider Port/Adapter; normalized output; secrets/telemetry/cost owned by 020 | §10 |
| `specs/021-sparsevec-readiness-spike/spec.md` (blob `77d1caf4…`) | all FR-001..FR-008, AS-01..AS-08, NS-01..NS-08, §§8–15, §21 gate | whole Plan; §19 traceability |

## 3. Constitution Check

Each gate is evaluated mechanically against the Frozen Spec and current main. Result values: PASS / BLOCKED.

| # | Gate | Mechanical basis | Result |
|---|---|---|---|
| CC-01 | Authority precedence | Plan cites the Frozen Spec blob `77d1caf4…` and four Docs; no statement in Plan/Checklist/Tasks amends or reinterprets them; Spec file is byte-unchanged. | PASS |
| CC-02 | Scope containment | Only the six test/evidence paths of §5 may change during implementation; every other path is forbidden (§5.2). | PASS |
| CC-03 | Slice 19 boundary | No change to 019 bootstrap, `scripts/pgvector-readiness.mjs`, `scripts/lib/**`, `db/**`, Rule 19; Slice 21 only reuses the existing Stage A DB as `xiaoshuyin_app` with TEMP objects. | PASS |
| CC-04 | Slice 20 ownership boundary | Import only `apps/server/api/src/ai/embedding/index.ts`; no direct HTTP, no parser, no internal module import (`port.js`, `contracts.js`, `transport.js`, `dashscope-protocol.js`, `config.js` forbidden); no Slice 20 edit. | PASS |
| CC-05 | No product semantic rewrite | No `Docs/**`, no product enum/state, no user-facing capability. | PASS |
| CC-06 | No production persistence | No migration, permanent table, `knowledge_embeddings`, lasting index, business row; TEMP objects only with verified cleanup (§12). | PASS |
| CC-07 | No future-slice prebuild | No pg_jieba, RRF, reranker, Gold Dataset, Context Builder, AI Task Runtime, generic sparse/vector framework (§16). | PASS |
| CC-08 | Test-only implementation surface | All six paths are under `tests/**` (fixed-exempt in `validate-change-governance.mjs`); no new production ownership (§5.3). | PASS |
| CC-09 | Security / secret boundary | `DASHSCOPE_API_KEY` only via Slice 20 `env`; never in repo, CLI args, evidence, logs; no new secret mechanism; CI workflow unchanged (§10, §13.4). | PASS |
| CC-10 | No B/C selection | Evidence vocabulary forbids `RAG READY`, `SELECTED`, `WINNER`; Candidate B/C fields fixed to `UNAFFECTED` (§14). | PASS |
| CC-11 | No production model pinning | `qwen3.7-text-embedding` is the Spike configured identity only; `EMBEDDING_MODEL_VERSION_OR_REVISION` is a frozen observation label, not a pin (§10.2). | PASS |
| CC-12 | Implementation gate truthfulness | Slice 20 Audit 2 durable evidence NOT FOUND → Developer gate CLOSED (§4); Planning is not blocked by it. | PASS (planning) / gate CLOSED |

Constitution Check result: **PASS** for planning. No gate requires a Spec change.

## 4. Implementation Gate

Development may start only when T001 proves, on then-current remote truth, ALL of:

1. Frozen Spec blob = `77d1caf4de6fdead3efcdb0cf3e8c594d444efbd`; Planning head = the Audit-1-passed exact head.
2. Slice 19 merged; latest canonical CI on `main` shows `G9` and `G11` PASS with PG18 / pgvector 0.8.7 pinned image.
3. Slice 20 implementation merged (PR #142 → `db07babd…`), public entry exports `createEmbeddingProvider` and `loadEmbeddingRuntimeConfig`, and `EMBEDDING_TEXT_TYPE` accepts `query | document`.
4. **Slice 20 durable independent Audit 2 PASS evidence exists** for exact implementation head `27a0ac5761b16ff7837a28936438f30aca1d68e0`. "Durable" means one of: (a) a GitHub PR review or issue/PR comment on the repository, authored by an auditor role distinct from the Slice 20 Developer, naming the exact head and stating Audit 2 PASS; or (b) a committed audit record on `main` naming the exact head and the PASS verdict. Chat-only or narrative claims do not count.
5. No competing Slice 21 implementation/owner exists.
6. Current change-governance still classifies `tests/**` as fixed-exempt and the six paths need no ownership.
7. The Slice 21 Spec and the Audit-1-passed Planning are merged to `main` through a separate planning admission PR (repository practice, cf. Slice 20 PR #112 before PR #142): `origin/main:specs/021-sparsevec-readiness-spike/{spec,plan,checklist,tasks}.md` blobs equal the Audit-1-passed planning-head blobs. The implementation branch is created from that `main`, so the implementation PR diff is exactly the six §5.1 paths.

Planning-time result:

```text
DEVELOPER IMPLEMENTATION GATE: CLOSED
blocking dependencies:
  - Slice 20 durable independent Audit 2 PASS evidence NOT FOUND (exact head 27a0ac5761b16ff7837a28936438f30aca1d68e0)
  - Slice 21 Spec/Planning not yet admitted to main (item 7)
```

If the merged Slice 20 Port cannot express the query/document experiment without modifying Slice 20, STOP with `UPSTREAM SLICE 20 PORT CAPABILITY RECONCILIATION REQUIRED`.

`DASHSCOPE_API_KEY` availability is not a planning or gate-opening condition; missing credential makes T007 BLOCKED (§15), never fabricated.

## 5. Implementation Surface and Governance Mode

### 5.1 Allowed implementation paths (exactly six)

```text
tests/helpers/sparsevec-readiness.ts
tests/architecture/sparsevec-readiness-evidence.test.ts
tests/db/sparsevec-readiness.test.ts
tests/ai/sparsevec-readiness-provider-db.test.ts
tests/fixtures/sparsevec-readiness/chinese-sample-manifest.json
tests/evidence/sparsevec-readiness-stage-a.json
```

Responsibilities:

- `tests/helpers/sparsevec-readiness.ts` — pure functions only (no network, no DB): mapping validator/encoder (§6), float32 checks, sparse/dense independent references (§8), fusion reference (§11), evidence-state derivation (§15), evidence schema validator (§14), manifest validator (§10.4). Exported constants: `SPARSE_D = 1_000_000_000`, `SPARSE_IP_REL_TOL = 1e-5`, `DENSE_COSINE_ABS_TOL = 1.25e-4`, `FUSION_RECOMPUTE_ABS_TOL = 1e-12`, `EVIDENCE_PATH`, `MANIFEST_PATH`.
- `tests/architecture/sparsevec-readiness-evidence.test.ts` — offline mapping/numeric/fusion/state-machine/manifest/evidence-schema tests; if the evidence file exists it validates it; it never asserts Git ancestry (so it remains valid after merge).
- `tests/db/sparsevec-readiness.test.ts` — real PG18/pgvector 0.8.7 deterministic probes (§7–§9, §12) under the CI execution contract (§7.1). No provider call, no repository writes.
- `tests/ai/sparsevec-readiness-provider-db.test.ts` — opt-in linked real Provider → real DB run (§10); the only writer of the evidence file.
- `tests/fixtures/sparsevec-readiness/chinese-sample-manifest.json` — frozen corpus/query manifest (§10.4).
- `tests/evidence/sparsevec-readiness-stage-a.json` — sanitized evidence (§14); generated only by the provider test; committed only in the evidence-only commit (§13).

### 5.2 Forbidden paths

```text
apps/**  packages/**  db/**  scripts/**  .specify/**  .github/**  Docs/**
package.json  bun.lock  vitest.config.ts  tests/setup/**  docker-compose.stage-a.yml
specs/**  (including specs/021-sparsevec-readiness-spike/spec.md, plan.md, checklist.md, tasks.md)
any other tests/** path not listed in §5.1
```

### 5.3 Governance mode

```yaml
SLICE 21 GOVERNANCE MODE: NO NEW PRODUCTION OWNERSHIP REQUIRED
GOVERNANCE PREREQUISITE: NOT REQUIRED
CHANGE-BINDING: NOT REQUIRED
.specify/implementation-ownership.json Slice 21 delta vs origin/main: NONE
reason:
  - all six paths are under tests/** (FIXED_EXEMPT_PREFIXES in validate-change-governance.mjs)
  - tests/evidence/** is excluded from guard-static scanning; tests/** is exempt from Rule 19 sparsevec/knowledge_embeddings production checks
  - no apps/**, packages/**, db/** path is created or modified
```

If implementation proves any production path must change: STOP; no ownership is added in the implementation PR.

## 6. Frozen Sparse Mapping Contract

```text
D (sparse coordinate capacity, Spike-only) = 1_000_000_000
provider normalized index i: safe integer, 0 <= i <= D-1
SQL textual sparsevec coordinate = i + 1   (1-based)
canonical text = {c1:v1,c2:v2,...}/1000000000   (passed only as a bound query parameter)
```

Rules (order of validation is part of the contract):

1. Input is Slice 20 `EmbeddingItemResult.sparse` (`SparseEntry[]`), already validated by 020; Slice 21 re-checks at the DB boundary and never re-normalizes.
2. `sparse === null` or missing → reject (`SPARSE_MISSING`); missing sparse is never an empty success.
3. Each `index` must be `Number.isSafeInteger` and `>= 0`; `index >= D` → reject (`INDEX_OUT_OF_RANGE`); `index = D-1` → accept and maps to SQL `D`.
4. Strict ascending order required; any non-increasing neighbor → reject (`NON_CANONICAL_ORDER`). Duplicate detection (`DUPLICATE_INDEX`) is evaluated on the raw list **before** zero removal, so a duplicate whose value is 0 still rejects.
5. Each `value` must be finite (`NONFINITE_VALUE`).
6. `f = Math.fround(value)`: `!Number.isFinite(f)` → reject (`FLOAT32_OVERFLOW`); `value !== 0 && f === 0` → reject (`FLOAT32_UNDERFLOW_TO_ZERO`).
7. Only after 3–6 pass, entries with `value === 0` (`+0` or `-0`) are removed.
8. Empty or all-zero after removal → reject (`EMPTY_SPARSE`).
9. One D for every document and query row; dense dimension never bounds or derives sparse D.
10. If `loadEmbeddingRuntimeConfig(env).sparseVocabularyMax` is defined, `index >= sparseVocabularyMax` → reject; if undefined, record `sparse_vocabulary_bound = "NOT_PROVIDED"` and never infer a bound.
11. Readback must reproduce D, the exact coordinate set and `Math.fround` weights exactly (`===` per weight).
12. No token hashing, string reindexing, collision merge, clipping, truncation, per-vector D, binary protocol.

## 7. Real DB Probe Contract

Target identity (Frozen Spec §10):

```text
PostgreSQL major 18; pgvector extension "vector" version 0.8.7
image pgvector/pgvector:0.8.7-pg18-trixie@sha256:5895949dfcdf308eb0cd31c950c93c14895c77f33fbedfecf1fa511ab1d4bcd2
runtime role xiaoshuyin_app: rolsuper=false, rolbypassrls=false, no CREATE on schema public, not extension owner
```

Queried facts (SQL, never config): `SHOW server_version`, `current_setting('server_version_num')`, `SELECT extversion FROM pg_extension WHERE extname='vector'`, `current_user`, `rolsuper`, `rolbypassrls`, `has_schema_privilege(current_user,'public','CREATE')`, extension owner. Image digest source: CI → the workflow `services.postgres.image` value echoed by `PGVECTOR_IMAGE_REF`; local → `docker image inspect --format '{{index .RepoDigests 0}}'` captured by the operator and passed as `PGVECTOR_IMAGE_REF`; both must equal the pinned digest.

All probe objects are `CREATE TEMP TABLE` / indexes on temp tables; expected-error statements run inside `SAVEPOINT … ROLLBACK TO SAVEPOINT`. If the app role lacks TEMP privilege → BLOCKED (no grants).

### 7.1 DB CI execution contract (no silent skip)

`.github/workflows/ci.yml` is NOT modified. The DB suite derives its mode only from variables that canonical CI already sets for `verify-all` (integration job):

```text
CI_STAGE_A_IDENTITY :=
  PGVECTOR_STAGE === 'STAGE_A'
  && PGVECTOR_ENVIRONMENT_KIND === 'CI_INTEGRATION'
  && PGVECTOR_EXPECTED_VERSION === '0.8.7'
  && PGVECTOR_IMAGE_REF === 'pgvector/pgvector:0.8.7-pg18-trixie@sha256:5895949dfcdf308eb0cd31c950c93c14895c77f33fbedfecf1fa511ab1d4bcd2'
  && non-empty PGVECTOR_ENVIRONMENT_ID, PGVECTOR_REPOSITORY_COMMIT, GITHUB_RUN_ID

MANUAL_OPT_IN := SPARSEVEC_DB_READINESS_TEST === '1'
                 && PGVECTOR_EXPECTED_VERSION === '0.8.7' && PGVECTOR_IMAGE_REF === <pinned value above>

PARTIAL_IDENTITY := any of PGVECTOR_STAGE / PGVECTOR_ENVIRONMENT_KIND / PGVECTOR_EXPECTED_VERSION / PGVECTOR_IMAGE_REF
                    is set, or SPARSEVEC_DB_READINESS_TEST is set, but neither CI_STAGE_A_IDENTITY nor MANUAL_OPT_IN holds

mode = RUN      if CI_STAGE_A_IDENTITY || MANUAL_OPT_IN
mode = FAIL     if PARTIAL_IDENTITY          (suite fails with explicit reason; never skips)
mode = SKIP     otherwise                    (describe.skip with reason "NOT_EVALUATED: no Stage A identity")
```

`DATABASE_URL` presence is NOT a trigger (vitest.config.ts injects a default `DATABASE_URL`). In RUN mode an unreachable DB, wrong version, wrong role or missing extension is a test FAILURE, not a skip. `PGVECTOR_STAGE`/`PGVECTOR_ENVIRONMENT_KIND` values above are exactly those set by `.github/workflows/ci.yml` (blob `27ed989e…`) for `node scripts/verify-all.mjs`, whose G1 runs the full `bunx vitest run` (`include: tests/**/*.test.ts`).

Mechanical no-skip proof (T011): the exact-head CI artifact `vitest-results.json` (uploaded by the integration job as `verify-all-<sha>-<attempt>`) must list `tests/db/sparsevec-readiness.test.ts` with ≥ 1 assertion result, all `passed`, 0 `skipped`/`pending`/`todo`. External DashScope verification is not part of normal no-secret CI; the provider suite is SKIP in CI by design (§10.1).

### 7.2 Synthetic boundaries (separate DB probe, no provider)

| Probe | Expected |
|---|---|
| `sparsevec(1000000000)` column create + insert `{1:0.5,1000000000:-0.25}/1000000000` | PASS |
| `sparsevec(1000000001)` | FAIL (error) |
| storage 16,000 nnz | PASS |
| storage 16,001 nnz | FAIL (error) |
| HNSW `sparsevec_ip_ops` build over rows with 1,000 nnz | PASS |
| HNSW build/insert with a 1,001-nnz row | FAIL (index incompatibility) |
| dimension-mismatched insert and `<#>` between different dims | FAIL |
| dense zero vector with `<=>` | rejected by harness before SQL (`DENSE_ZERO_VECTOR`) |

Boundary fixtures are generated deterministically (coordinate `k` = `k`, weight = `Math.fround(1/(k+1))`); no full dense expansion; no provider-generated boundary data. Actual payload with nnz > 16,000 → FAIL; 1,000 < nnz ≤ 16,000 → exact-scan path may be VERIFIED with `actual_hnsw_compatible=false`; never truncate.

## 8. Distance and Ranking Verification (Spike only — not production ranking authority)

### 8.1 Sparse exact inner product (`<#>`, frozen)

```text
db_distance = sparse <#> query          (pgvector negative inner product)
sparse_similarity = -db_distance
reference_ip = Σ Math.fround(q_c) * Math.fround(d_c) over common coordinates (float64 accumulation)
tolerance: |sparse_similarity - reference_ip| <= SPARSE_IP_REL_TOL * max(1, |reference_ip|),  SPARSE_IP_REL_TOL = 1e-5
SQL order: ORDER BY sparse <#> $q ASC, sample_id ASC
```

Analytical fixture (frozen): `A = {1:0.5,8:-0.25}/D`, `B = {1:0.25,8:0.5}/D`, query `= A`: `ip(A,A)=0.3125` → DB `<#>` = `-0.3125`; `ip(A,B)=0` → A ranks before B.

### 8.2 Dense exact cosine (`<=>`, frozen before execution)

```text
dense_similarity = 1 - (dense <=> query)
reference_cos = dot(a,b) / (‖a‖·‖b‖) over Math.fround components (float64 accumulation)
tolerance: |dense_similarity - reference_cos| <= DENSE_COSINE_ABS_TOL,  DENSE_COSINE_ABS_TOL = 1.25e-4
SQL order: ORDER BY dense <=> $q ASC, sample_id ASC
```

Rationale (fixed, not tunable): pgvector 0.8.7 stores `vector` components as float4 and accumulates dot/norms in single precision; the standard float32 summation bound is ≈ n·u with u = 2⁻²⁴. For the frozen dense dimension n = 1024 (§10.2): 2·n·u = 1.2207e-4, rounded up to 1.25e-4 (factor 2 covers the dot and norm accumulations). This is a numeric-consistency bound only, not a quality threshold. Any dense dimension ≠ 1024 is `INVALID_EXPERIMENT_CONFIG`; the tolerance is never recomputed, widened or tuned after a run. Analytical dense fixture (frozen): `a=[1,0,0]`, `b=[1,1,0]` → cos = 0.7071067811865475; `a` vs `c=[0,1,0]` → 0 ; `a` ranks before `c`.

### 8.3 Ties and order

`sample_id ASC` is only the deterministic tie-breaker. When two adjacent reference scores differ by ≤ the channel tolerance, the pair is a declared `NEAR_TIE` group and either DB order within the group is accepted; outside near-tie groups the DB order must equal the reference order exactly. Tie-breakers never satisfy the Chinese technical rule (§11).

## 9. HNSW Behavior Probe

- disposable `CREATE INDEX … ON pg_temp.<t> USING hnsw (sparse sparsevec_ip_ops)` on bounded synthetic rows (≤ 1,000 nnz);
- `SET LOCAL enable_seqscan = off` inside the probe transaction only;
- `EXPLAIN (FORMAT JSON, COSTS OFF) SELECT … ORDER BY sparse <#> $q LIMIT 5` must contain a node with `"Index Name"` equal to the created index;
- after `COMMIT/ROLLBACK`, `SHOW enable_seqscan` must equal its pre-probe value;
- returned IDs are compared with the exact reference and recorded as observation (ANN is not globally exact);
- the actual linked payload is also attempted on the HNSW path when every row has ≤ 1,000 nnz; otherwise `actual_hnsw_compatible=false` with the observed max nnz;
- missing/unexpected plan or inability to run the probe → `PGVECTOR_SPARSEVEC_VERIFIED ≠ VERIFIED`.

## 10. Real Provider → Real DB Linked Run

### 10.1 Execution switch

`tests/ai/sparsevec-readiness-provider-db.test.ts` runs only when `SPARSEVEC_PROVIDER_VERIFY === '1'` AND the DB mode of §7.1 is RUN (manual opt-in); otherwise `describe.skip` with `NOT_EVALUATED`. When opted in and Slice 20 config fails with `SECRET_MISSING`/`CONFIG_MISSING`, the run records `BLOCKED` (no positive flag) and writes evidence only if `SPARSEVEC_EVIDENCE_PATH` is set. It never runs in normal CI.

### 10.2 Frozen experiment identity

Two Port instances are created only through `createEmbeddingProvider({ env })` from `apps/server/api/src/ai/embedding/index.ts`, with env identical except `EMBEDDING_TEXT_TYPE`:

| Variable | Document instance | Query instance |
|---|---|---|
| `EMBEDDING_MODEL_ID` | `qwen3.7-text-embedding` | `qwen3.7-text-embedding` |
| `EMBEDDING_MODEL_VERSION_OR_REVISION` | `S21-SPIKE-UNPINNED-OBSERVATION` | same |
| `EMBEDDING_DENSE_DIMENSION` | `1024` (provider-documented default) | same |
| `EMBEDDING_OUTPUT_TYPE_DENSE_SPARSE_PARAM` | `dense&sparse` | same |
| `EMBEDDING_TEXT_TYPE` | `document` (explicit) | `query` (explicit) |
| `DASHSCOPE_EMBEDDING_BASE_URL` | operator-provided approved `https://<workspace>.<region>.maas.aliyuncs.com` | identical value |
| `DASHSCOPE_API_KEY` | operator secret via process env only | identical |
| every other `EMBEDDING_*` | unset (Slice 20 defaults), recorded | identical |

Requests: one `embed()` call with the six documents (`outputType: 'dense+sparse'`, `denseDimension: 1024`, `configuredModelId`/`configuredModelVersionOrRevision` equal to the table) on the document instance; one call with the three queries on the query instance. Each call's `requestId` = `s21-<run_id>-doc` / `s21-<run_id>-query`. Evidence records per call: configured model, version label, explicit `text_type`, output type, dense dimension, `providerRequestId`, `providerModelEcho`, endpoint fingerprint, usage. Any cross-role difference other than `text_type`, a model other than `qwen3.7-text-embedding`, a query embedded as document (or vice versa) → `INVALID_EXPERIMENT_CONFIG`; no retry with another model; Slice 20 retries/timeouts are not overridden.

### 10.3 Lineage

```text
Slice 20 public Port → EmbeddingResult (dense + sparse, per item index)
→ Slice 21 mapping (§6) → TEMP rows (sample_id, dense vector(1024), sparse sparsevec(D)) via bound parameters
→ readback → exact dense/sparse scores (§8) → Chinese checks (§11) → fusion (§11) → evidence (§14)
per item: sample_id, provider_request_id, normalized_sparse_sha256, mapped_sparsevec_text_sha256, db_readback_sha256,
          dense_sha256, nnz, observed_min_index, observed_max_index, raw dense/sparse scores per query
```

A provider-only PASS plus a detached synthetic DB PASS is insufficient (NS-04). Replays of captured payloads cannot set positive flags.

### 10.4 Frozen Chinese technical corpus (6 documents × 3 queries)

Source policy: public official pages of the Ministry of Education of the PRC news site (`fx.xwapp.moe.gov.cn`, a `moe.gov.cn` domain); no `Docs/reference/**`, no internal consultant material, no family/minor/patient/private data.

Outbound permission rationale (RESOLVED, no user approval dependency): each excerpt is publicly published official government information about public policy, contains no personal data, is limited to ≤ 400 code points, keeps source attribution, and is sent to DashScope solely for this technical test. If a source page carries an explicit reproduction prohibition, is unavailable, or the anchor is absent, the affected document is BLOCKED (T003 STOP) — no substitution.

| doc_id | Source title (as published) | URL | Published (URL path) | Anchor (must occur in extracted text) | Role |
|---|---|---|---|---|---|
| D01 | 教育部等六部门印发通知部署做好预防中小学生沉迷网络游戏管理工作 | http://fx.xwapp.moe.gov.cn/article/202110/617b9997695ccf00015c2a1d.html | 2021-10 | `为深入贯彻《中华人民共和国未成年人保护法》` | target Q01 |
| D02 | 《近视防控三十问答》，转给师生家长 | http://fx.xwapp.moe.gov.cn/article/202306/648bc6d9ebf50d603fbc064b.html | 2023-06 | `第二届全国综合防控儿童青少年近视宣讲团` | target Q02 |
| D03 | 最新通知！教育部印发《学校新型冠状病毒感染防控工作方案》 | http://fx.xwapp.moe.gov.cn/article/202212/63ae672b6ada004457c8d005.html | 2022-12 | `为科学高效统筹学校新型冠状病毒感染防控和教育教学工作` | target Q03 |
| D04 | 研究生教育学科专业目录（2022年）发布，自2023年起实施 | https://fx.xwapp.moe.gov.cn/article/202209/63214de5f858056a22552341.html | 2022-09 | `通知要求，新版目录自2023年起实施` | distractor |
| D05 | 教育部等5部门联合印发意见，规范高校在线开放课程教学管理 | http://fx.xwapp.moe.gov.cn/article/202204/624665851916aa00012e9a5a.html | 2022-04 | `正式印发` | distractor |
| D06 | 教育部公布第三批基础学科拔尖学生培养计划2.0基地名单 | http://fx.xwapp.moe.gov.cn/article/202111/61a44c5f695ccf00015c496f.html | 2021-11 | `加快培养基础学科拔尖人才` | distractor |

Deterministic extraction rule (T003, executed once, before any provider call):

1. HTTP GET the URL; decode as UTF-8; remove `<script>`/`<style>` elements; strip all tags; HTML-unescape;
2. apply Unicode NFKC to the text and to the anchor; collapse every whitespace run to one ASCII space; trim;
3. `start` = index of the first occurrence of the NFKC anchor; absent → BLOCKED;
4. `window` = text[start : start + 400] (code points); if `window` contains `。` at code-point offset ≥ 30, cut after the last `。` in `window`; otherwise keep `window`;
5. excerpt length must be ≥ 30 code points, else BLOCKED;
6. `text_sha256` = SHA-256 of the UTF-8 bytes of the excerpt; `source_fetched_at` and HTTP status recorded;
7. the excerpt text is stored in the manifest; later runs use only the committed text (no refetch).

Frozen queries:

| query_id | Query text (exact) | expected target | key term (mechanical basis) | declared unrelated distractors |
|---|---|---|---|---|
| Q01 | 怎样预防中小学生沉迷网络游戏 | D01 | 网络游戏 | D04, D05 |
| Q02 | 儿童青少年近视防控有哪些常识和预防方法 | D02 | 近视 | D04, D06 |
| Q03 | 学校如何做好新型冠状病毒感染防控工作 | D03 | 新型冠状病毒感染 | D05, D06 |

Mechanical expectation basis (no professional judgement): the key term occurs (after NFKC) in the query and in the target excerpt, and in none of the declared distractors' excerpts. If this check fails after extraction → BLOCKED (no edits, no replacement). No clinical, psychological or intervention-quality judgement is required or allowed.

Manifest fields: `manifest_id = "s21-chinese-sample-v1"`, `manifest_version = 1`, per document `{doc_id, source_title, source_authority: "中华人民共和国教育部（moe.gov.cn）", source_url, source_published, anchor, extraction_rule_id: "S21-EXTRACT-V1", excerpt, text_sha256, source_fetched_at, http_status, rights_basis: "PUBLIC_OFFICIAL_GOVERNMENT_INFORMATION", outbound_permission: "PERMITTED_PUBLIC_NONPERSONAL", contains_personal_data: false}`, per query `{query_id, query_text, query_sha256, expected_doc_id, key_term, distractor_doc_ids}`, and `{privacy_assertion: "NO_FAMILY_MINOR_PATIENT_PRIVATE_DATA"}`. The manifest is committed inside `implementation_subject_head` before the first provider call; the commit that adds it is recorded as `manifest_commit` in evidence and must be an ancestor of `implementation_subject_head`.

## 11. Fusion Prototype and Chinese Outcome Rule

Spike reference only — not production ranking authority:

```text
per query q, candidates = D01..D06 (exactly six, unique sample_id)
for channel c in {dense, sparse}: raw_c = DB-derived similarity (dense_similarity / sparse_similarity)
  min_c, max_c over the six candidates
  norm_c(x) = (raw_c(x) - min_c) / (max_c - min_c)   if max_c > min_c
  norm_c(x) = 0                                       if max_c == min_c   (constant channel)
fused(x) = 0.5 * norm_dense(x) + 0.5 * norm_sparse(x)
sort: fused DESC, then sample_id ASC
missing channel / duplicate sample_id / non-finite score / candidate count ≠ 6 → reject (fail closed, no single-channel fallback)
independent recomputation must match stored norm/fused within FUSION_RECOMPUTE_ABS_TOL = 1e-12
```

Chinese technical rule per query (positive proof threshold): expected target has fused score strictly greater than every other candidate (strict #1; no tie-break used). `chinese_queries_passed = count of queries meeting the rule`; PASS requires `3/3`.

No post-hoc tuning: queries, expected targets, corpus, weights (0.5/0.5), normalization, distractors and candidate set cannot change after the first provider call; no rerank, RRF, retry-until-ranking or re-run selection. A changed manifest/formula requires a new `implementation_subject_head` and a full rerun, and the earlier evidence is retained as history and marked INVALID.

## 12. Persistence and Cleanup

TEMP objects only; savepoints for expected failures; `finally` cleanup; after success and after an injected failure the probe asserts `SELECT count(*) FROM pg_class WHERE relpersistence='t' AND relname LIKE 's21_%'` = 0 in a new session-level check and that no non-temp relation named `s21_%` exists; two consecutive runs do not collide; planner settings restored. Cleanup failure forces FAIL and can never coexist with PASS. No migration, permanent table, `knowledge_embeddings`, lasting index, business row or route.

## 13. Two-Head Evidence Model (no Git self-reference)

### 13.1 Definitions

- `implementation_subject_head` (S): the immutable commit containing all five execution-affecting files (`tests/helpers/sparsevec-readiness.ts`, the three test files, the manifest) at their final content. Real Provider / DB / Chinese / fusion execution runs with `git rev-parse HEAD == S` and a clean tree (`git status --porcelain --untracked-files=all` empty except the evidence path).
- `final_pr_head` (F): the PR head after exactly the evidence-only commit(s) on top of S.

The evidence JSON records `implementation_subject_head = S` (obtained from `git rev-parse HEAD` at run start and re-checked at run end). It records no field claiming to be its own containing commit: the keys `repo_head`, `final_pr_head`, `containing_commit` are forbidden in the evidence file. `repo_head` is not used; it is replaced by `implementation_subject_head`.

### 13.2 Allowed delta S → F

Allowed execution-affecting delta: **NONE**. Allowed path set: exactly `tests/evidence/sparsevec-readiness-stage-a.json`.

Mechanical convergence proof (T011), with `EV=tests/evidence/sparsevec-readiness-stage-a.json`:

```bash
git merge-base --is-ancestor "$S" "$F"                                  # must exit 0
test "$(git diff --name-only "$S" "$F")" = "$EV"                        # exactly one path
test -z "$(git rev-list --merges "$S..$F")"                             # no merge commits
for c in $(git rev-list "$S..$F"); do
  test "$(git diff-tree --no-commit-id --name-only -r "$c")" = "$EV"    # each commit evidence-only
done
test "$(node -e "console.log(JSON.parse(require('fs').readFileSync('$EV','utf8')).implementation_subject_head)")" = "$S"
git merge-base --is-ancestor "$(node -e "console.log(JSON.parse(require('fs').readFileSync('$EV','utf8')).manifest_commit)")" "$S"   # manifest frozen inside S
```

Any later change to helper, tests, manifest, queries, corpus, mapping, numeric rule, tolerance, provider config semantics, DB behavior, fusion or execution logic invalidates the evidence → new S + full rerun. If `main` must be merged after S is frozen, that merge is a new S (rerun required).

### 13.3 Final-head validation without new provider truth

On F (no new provider call): architecture suite; DB deterministic suite (manual opt-in locally and via canonical CI identity); `validate-governance`, governance self-tests, `validate-change-governance --base origin/main --head HEAD`, change-governance self-tests; `guard-static` + `--self-test`; canonical `verify-all` (exact-head CI); secret scan; privacy scan; §13.2 convergence proof; §7.1 no-skip proof.

### 13.4 Secret and privacy scans (frozen commands)

```bash
git grep -nIE 'sk-[A-Za-z0-9]{16,}|DASHSCOPE_API_KEY\s*[:=]\s*\S|Authorization:\s*Bearer\s+\S' "$F" -- tests/   # must be empty
```

Privacy scan (architecture test on the evidence file): no manifest excerpt substring of 20 code points appears in the evidence; forbidden keys `apiKey, api_key, authorization, raw_body, raw_response, excerpt, text, sparse_embedding, embedding` absent; no dense/sparse vector arrays stored (hashes and stats only).

## 14. Evidence Artifact Contract (`tests/evidence/sparsevec-readiness-stage-a.json`)

Required keys (all present; unknown values are explicit strings, never omitted):

```text
schema_version = 1
evidence_kind = "S21_SPARSEVEC_READINESS_SPIKE"
run_id, checked_at (ISO-8601 UTC), evidence_ref
implementation_subject_head, implementation_subject_tree_clean (true), manifest_commit
frozen_spec_head = "8792c4cf4e366b5507ac451a68cd31b73e7f5261", frozen_spec_blob = "77d1caf4de6fdead3efcdb0cf3e8c594d444efbd"
planning_head (Audit-1-passed exact head)
slice19_provenance {pgvector_readiness_ci_run, image_ref}
slice20_provenance {implementation_pr: 142, implementation_head: "27a0ac5761b16ff7837a28936438f30aca1d68e0", merge_commit: "db07babd42976e5e13dbe08bc3e5f1a9b1c8cbaf", audit2_evidence_ref, public_entry: "apps/server/api/src/ai/embedding/index.ts"}
stage = "STAGE_A", stage_b = "NOT_EVALUATED", stage_c = "NOT_EVALUATED"
postgres_version (SHOW server_version), postgres_version_num, tencentdb_kernel_version = "NOT_APPLICABLE_STAGE_A"
extension_name = "vector", extension_version (queried), image_ref, image_digest_source
execution_role, runtime_superuser, runtime_bypassrls, runtime_public_schema_create, extension_owner
provider_calls[] {role, text_type, configured_model_id, model_version_label, output_type, dense_dimension, request_id, provider_request_id, provider_model_echo, endpoint_config_fingerprint, usage_total_tokens}
configured_sparse_cap (Slice 20 maxSparseElements), sparse_vocabulary_bound ("NOT_PROVIDED" or value)
sparse_dimension = 1000000000, dense_dimension = 1024, dimension_policy = "S21_SPIKE_ONLY_D_1E9"
items[] (lineage per §10.3), observed_nnz_max, observed_min_index, observed_max_index
mapping_result, db_roundtrip_result, distance_result, independent_calculation
tolerances {sparse_ip_rel: 1e-5, dense_cosine_abs: 1.25e-4, fusion_recompute_abs: 1e-12}
index_behavior {hnsw_explain_index_used, planner_restored, synthetic_boundaries[], actual_hnsw_compatible}
chinese_manifest_id, chinese_manifest_sha256, source_fingerprints[], queries[] {query_id, expected_doc_id, ranked_doc_ids, raw_dense, raw_sparse, norm_dense, norm_sparse, fused, strict_first}
chinese_queries_passed (0..3)
fusion_reference {formula_id: "S21-MINMAX-0.5-0.5-V1", recompute_max_abs_diff}
negative_probes[], cleanup_status ("CLEAN" | "FAILED"), limitations[]
flags {MAPPING_CONTRACT_VERIFIED, SPARSE_PAYLOAD_VERIFIED, PGVECTOR_SPARSEVEC_VERIFIED, FUSION_PROTOTYPE_VERIFIED}
SPARSEVEC_SPIKE_PASS_STAGE_A (boolean)
candidate_a_readiness_state, execution_completion_state
sparsevec_spike_status, rag_candidate_status, readiness_status, readiness_scope
candidate_b_status = "UNAFFECTED", candidate_c_status = "UNAFFECTED"
rag_readiness = "NOT_DERIVED", production_route_selection = "DEFERRED_TO_GOLD_DATASET"
```

Bounded status vocabularies (values outside these sets fail the schema test):

- `sparsevec_spike_status` ∈ {`PASS_STAGE_A`, `FAIL`, `BLOCKED`, `UNKNOWN`, `NOT_EVALUATED`} — the Spike technical result.
- `rag_candidate_status` ∈ {`CANDIDATE_A_SPARSEVEC_PREREQUISITE_MET_STAGE_A`, `CANDIDATE_A_SPARSEVEC_PREREQUISITE_FAILED`, `CANDIDATE_A_SPARSEVEC_PREREQUISITE_BLOCKED`, `CANDIDATE_A_SPARSEVEC_PREREQUISITE_UNKNOWN`, `CANDIDATE_A_SPARSEVEC_PREREQUISITE_NOT_EVALUATED`} — Candidate A prerequisite / technical compatibility state only.
- `readiness_status` ∈ {`PASS_STAGE_A`, `FAIL`, `BLOCKED`, `UNKNOWN`, `NOT_EVALUATED`} with `readiness_scope = "CANDIDATE_A_SPARSEVEC_SPIKE_STAGE_A_ONLY"`.
- status-typed fields (`flags.*`, `SPARSEVEC_SPIKE_PASS_STAGE_A`, `candidate_a_readiness_state`, `execution_completion_state`, `sparsevec_spike_status`, `rag_candidate_status`, `readiness_status`, `readiness_scope`, `candidate_b_status`, `candidate_c_status`, `rag_readiness`, `production_route_selection`, `cleanup_status`) must take only the enumerated values above; for these fields any value equal to, or containing as an underscore-delimited token, `READY`, `SELECTED`, `WINNER` or `PRODUCTION` is rejected by the schema test. Free-text `limitations[]` is excluded from this token check but is still covered by the privacy scan.

`PASS_STAGE_A` never means RAG READY, Candidate A production selected, A/B/C winner, or production readiness.

## 15. Mechanical Evidence State Machine

Lower flags ∈ {`VERIFIED`, `FAIL`, `BLOCKED`, `UNKNOWN`, `NOT_EVALUATED`}, default `NOT_EVALUATED`, derived by helper functions from predicates (no Developer-set boolean):

- `MAPPING_CONTRACT_VERIFIED = VERIFIED` iff every §6 positive/negative architecture case passes.
- `SPARSE_PAYLOAD_VERIFIED = VERIFIED` iff gate open (§4), both calls through the public Port with §10.2 identity, 6 + 3 items returned with non-null nonempty sparse and 1024-dim dense, all items pass §6, lineage hashes present. `INVALID_EXPERIMENT_CONFIG` → `FAIL`; credential/endpoint/model unavailable → `BLOCKED`; provider returns no sparse for the documented dense&sparse request → `FAIL`.
- `PGVECTOR_SPARSEVEC_VERIFIED = VERIFIED` iff §7 identity/role, linked payload insert/readback exact, §8 references within tolerance (analytical + linked), §7.2 boundaries as expected, §9 EXPLAIN index path observed with planner restored, §12 cleanup CLEAN.
- `FUSION_PROTOTYPE_VERIFIED`: `fusion_mechanics_ok` := linked paired scores for the same six IDs, recompute ≤ 1e-12, and the constant/missing/duplicate/non-finite/tie fixtures behave as frozen.
  - `VERIFIED` iff `fusion_mechanics_ok` and `chinese_queries_passed = 3`;
  - `FAIL` iff `fusion_mechanics_ok` is false through a deterministic error;
  - `UNKNOWN` iff `fusion_mechanics_ok` and the three lower technical flags are VERIFIED but `chinese_queries_passed < 3`.

Aggregate:

```text
SPARSEVEC_SPIKE_PASS_STAGE_A = all four flags VERIFIED && cleanup_status = CLEAN && gate/lineage identities valid

candidate_a_readiness_state / execution_completion_state / sparsevec_spike_status / readiness_status / rag_candidate_status:
  PASS     : aggregate true                                   → COMPLETED_WITH_PASS / PASS_STAGE_A / PASS_STAGE_A / …_MET_STAGE_A
  FAIL     : any flag FAIL or cleanup FAILED (deterministic technical incompatibility, e.g. mapping incorrect,
             dimension incompatible, float representation incorrect, insert/readback incorrect, distance/reference mismatch,
             required pgvector behavior incorrect, payload incompatible with sparsevec limits, cleanup failure,
             deterministically invalid execution)                → COMPLETED_WITH_FAIL / FAIL / FAIL / …_FAILED
  BLOCKED  : no FAIL and any flag BLOCKED (gate, credential, permission, source unavailable)
                                                              → BLOCKED / BLOCKED / BLOCKED / …_BLOCKED
  UNKNOWN  : no FAIL/BLOCKED, technical chain VERIFIED, FUSION_PROTOTYPE_VERIFIED = UNKNOWN (tiny-sample ranking miss)
                                                              → INCONCLUSIVE / UNKNOWN / UNKNOWN / …_UNKNOWN
  NOT_EVALUATED : required execution did not run              → NOT_EVALUATED / NOT_EVALUATED / NOT_EVALUATED / …_NOT_EVALUATED
precedence: FAIL > BLOCKED > UNKNOWN > NOT_EVALUATED > PASS (PASS only if all positive)
```

A tiny 6×3 relevance miss with a valid technical chain is `UNKNOWN / INCONCLUSIVE`, never PASS and never, by itself, a deterministic Candidate A FAIL; route quality and A/B/C selection are DEFERRED TO GOLD DATASET.

## 16. Out of Scope (unchanged from Frozen Spec)

Production retrieval, permanent schema, migrations, `knowledge_embeddings`, pg_jieba, RRF, reranker (qwen3-rerank), Gold Dataset execution, Context Builder, AI Task Runtime, TaskModelRegistry, production model/route pinning, Family Memory, other vector DBs, generic frameworks, Slice 19/20 edits, Candidate B/C work (UNAFFECTED), Stage B/C (NOT_EVALUATED).

## 17. Verification Plan

Verification classes and the tasks owning them:

| Class | What | Command (exact) | Owner |
|---|---|---|---|
| V-ARCH | offline mapping/numeric/fusion/state/manifest/evidence schema | `bunx vitest run tests/architecture/sparsevec-readiness-evidence.test.ts` | T003, T004, T009, T010 |
| V-DB | real PG18/pgvector deterministic probes | local: `SPARSEVEC_DB_READINESS_TEST=1 PGVECTOR_EXPECTED_VERSION=0.8.7 PGVECTOR_IMAGE_REF=<pinned> DATABASE_URL=<Stage A app-role URL> bunx vitest run tests/db/sparsevec-readiness.test.ts`; CI: canonical identity (§7.1) via `node scripts/verify-all.mjs` | T005, T006, T011 |
| V-PROV | linked real Provider → DB → Chinese → fusion | `SPARSEVEC_PROVIDER_VERIFY=1 SPARSEVEC_DB_READINESS_TEST=1 PGVECTOR_EXPECTED_VERSION=0.8.7 PGVECTOR_IMAGE_REF=<pinned> DATABASE_URL=<…> SPARSEVEC_EVIDENCE_PATH=tests/evidence/sparsevec-readiness-stage-a.json <§10.2 EMBEDDING_* / DASHSCOPE_* via env> bunx vitest run tests/ai/sparsevec-readiness-provider-db.test.ts` (at HEAD = S) | T007–T010 |
| V-GOV | governance | `node .specify/scripts/validate-governance.mjs`; `node .specify/scripts/tests/run-governance-tests.mjs`; `node .specify/scripts/validate-change-governance.mjs --base origin/main --head HEAD`; `node .specify/scripts/tests/run-change-governance-tests.mjs` | T002, T011 |
| V-GUARD | static guard | `node scripts/guard-static.mjs`; `node scripts/guard-static.mjs --self-test` | T011 |
| V-CANON | canonical regression | exact-head CI integration job `node scripts/verify-all.mjs` PASS + artifact `vitest-results.json` no-skip proof (§7.1) | T011 |
| V-HEAD | two-head convergence | §13.2 commands | T011, T012 |
| V-SEC | secret / privacy | §13.4 | T010, T011 |
| V-SPEC | spec immutability | `git rev-parse HEAD:specs/021-sparsevec-readiness-spike/spec.md` = `77d1caf4…` | T001, T011, T012 |

Developer may not change command semantics; only path quoting/shell syntax may be adapted.

## 18. STOP Conditions

STOP (no improvisation) if: Frozen Spec blob drifts; Slice 20 Audit 2 durable evidence absent (T001); Slice 20 Port cannot express the experiment without modification; any forbidden path must change; a production migration/table/index/route is needed; PG/pgvector/image/role drift; a source is unavailable, prohibits reproduction, contains private data, or the anchor/key-term check fails; professional judgement would be needed; cleanup cannot be proven; lineage cannot join; a missing channel would need fallback; HNSW would need truncation/remapping; any result would be labelled READY; any post-hoc change to corpus/queries/targets/weights/tolerances would be needed to pass.

## 19. Frozen-Spec Traceability

| Frozen requirement | Plan | Checklist | Tasks |
|---|---|---|---|
| FR-001 actual provider → actual sparsevec (dimension, nnz, insert/read/distance, index/query) | §§6–10, 13–15 | C21-15..C21-29, C21-61..C21-66 | T004–T008, T010, T011 |
| FR-002 consume Slice 20 public normalized result only | §§4, 10 | C21-07, C21-08, C21-25, C21-70..C21-73 | T001, T007 |
| FR-003 stage/privilege/disposable DB | §§7, 12 | C21-12..C21-14, C21-50..C21-53, C21-62 | T005, T006, T010 |
| FR-004 Chinese retrieval + bounded fusion | §§10.4, 11 | C21-30..C21-38, C21-74..C21-80 | T003, T008, T009 |
| FR-005 truthful evidence/failure states | §§13–15 | C21-39..C21-46, C21-64..C21-69 | T010–T012 |
| FR-006 approved test content / no professional approval | §10.4 | C21-32, C21-33, C21-47, C21-76, C21-77 | T003, T008 |
| FR-007 defer production retrieval / Gold / pinning; protect B/C | §§3, 14, 16 | C21-03..C21-06, C21-48, C21-68 | all |
| FR-008 governance / no lasting schema | §§5, 12 | C21-09..C21-11, C21-49, C21-81 | T002, T010, T011 |
| §21 Implementation Gate | §4 | C21-07, C21-82 | T001 |

AS-01..AS-08 and NS-01..NS-08 are assigned in `tasks.md` (Frozen Spec Authority Map) and represented in `checklist.md`.

## 20. Developer Handoff Boundary

```yaml
PLANNING: reconciled to Frozen Spec 77d1caf4 and main e7885234 (Audit 1 verdict reported externally against exact head)
DEVELOPER IMPLEMENTATION GATE: CLOSED until Slice 20 durable independent Audit 2 PASS evidence is established and Slice 21 Spec/Planning are admitted to main (§4 item 7)
DEVELOPMENT: NOT AUTHORIZED
```
