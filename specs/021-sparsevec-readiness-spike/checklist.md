# Slice 21 — Planning / Developer Mechanical Checklist

> Feature: `021-sparsevec-readiness-spike`
> Frozen Spec head / blob: `8792c4cf4e366b5507ac451a68cd31b73e7f5261` / `77d1caf4de6fdead3efcdb0cf3e8c594d444efbd`
> Purpose: mechanical PASS / FAIL / NOT APPLICABLE verification of Developer execution. This checklist does not authorize development and does not self-record any audit verdict.

Status values for Developer execution: `PASS`, `FAIL`, `NOT APPLICABLE`. Any required item that is not PASS blocks a positive Stage A result. "Plan §" references `plan.md` of the same planning head.

## Identity, Scope and Gate

| ID | Mechanical check | Required result | Evidence |
|---|---|---|---|
| C21-01 | Frozen Spec head re-read | `origin/spec/021-sparsevec-readiness-spike` = `8792c4cf…` or a later head whose `spec.md` blob is unchanged | git read-back |
| C21-02 | Frozen Spec blob | `spec.md` blob = `77d1caf4de6fdead3efcdb0cf3e8c594d444efbd` at planning head, S and F | `git rev-parse <head>:specs/021-sparsevec-readiness-spike/spec.md` |
| C21-03 | Spike remains test/evidence only | no production retrieval / RAG runtime | `git diff --name-only origin/main...F` |
| C21-04 | No pg_jieba / RRF / reranker / Gold Dataset work | zero delta / zero imports | diff + grep |
| C21-05 | No production migration / table / index / route | zero persistent DB / product delta | diff + DB absence (C21-50) |
| C21-06 | No Context Builder / AI Task Runtime / generic framework | zero delta | diff |
| C21-07 | Slice 20 implementation merged | PR #142 head `27a0ac57…` merged as `db07babd…`; bounded remediation PR #153 head `ff89fc97…` merged as `5c2ff5a1…` and present on current `origin/main` | remote truth |
| C21-08 | Public Slice 20 entry only | imports only `apps/server/api/src/ai/embedding/index.ts`; no `port/contracts/transport/dashscope-protocol/config` module import; no `fetch`/HTTP client in Slice 21 files | grep on the six files |
| C21-09 | Governance mode | changed paths ⊆ the six Plan §5.1 paths | changed paths |
| C21-10 | New production ownership | NOT REQUIRED | `validate-change-governance` PASS |
| C21-11 | Change-binding | NOT REQUIRED | `validate-change-governance` PASS |
| C21-81 | Ownership registry | `git diff --quiet origin/main F -- .specify/implementation-ownership.json` exits 0 | git |
| C21-82 | Slice 20 independent Audit 2 remediation lineage (Plan §4 item 4) | complete lineage verified before T002: original Audit 2 FAIL on `27a0ac57…` (`issuecomment-7189854137`) + final remediation closeout PASS on `ff89fc97…` (`issuecomment-7206763327`) + remediation merge `5c2ff5a1…` present in current `main`; otherwise T001 STOP | T001 report |
| C21-85 | Slice 21 planning admitted to main (Plan §4 item 7) | `origin/main` blobs of `spec.md`, `plan.md`, `checklist.md`, `tasks.md` equal the Audit-1-passed planning blobs | T001 report |

## Database Target and Mapping

| ID | Mechanical check | Required result | Evidence |
|---|---|---|---|
| C21-12 | PG target | `server_version_num` major = 18 (queried) | SQL |
| C21-13 | pgvector target | `extversion` = `0.8.7` (queried), `extname` = `vector` | SQL |
| C21-14 | Runtime role | `xiaoshuyin_app`, `rolsuper=false`, `rolbypassrls=false`, no `public` CREATE, not extension owner | SQL |
| C21-15 | Sparse D | exactly 1,000,000,000 for every sparse row and query | mapping + DB |
| C21-16 | Mapping origin | provider 0 → SQL 1 | architecture test |
| C21-17 | Mapping high boundary | provider D-1 → SQL D; provider D → reject | architecture test |
| C21-18 | Order / duplicates | non-ascending → reject; duplicate incl. zero-valued duplicate → reject before zero removal | architecture test |
| C21-19 | Numeric boundary | NaN/±Inf reject; `Math.fround` overflow reject; nonzero underflow-to-zero reject; ±0 removed only after validation | architecture test |
| C21-20 | Empty / all-zero / null sparse | reject (`EMPTY_SPARSE` / `SPARSE_MISSING`) | architecture test |
| C21-21 | Dense vs sparse dimension | independent; key > 1024 accepted when < D | architecture + DB |
| C21-22 | Storage boundary | 16,000 nnz PASS; 16,001 FAIL | real DB |
| C21-23 | HNSW boundary | 1,000 nnz PASS; 1,001 incompatibility recorded; no truncation | real DB |
| C21-24 | Dimension boundary | `sparsevec(1000000000)` PASS; `sparsevec(1000000001)` FAIL | real DB |
| C21-26 | Linked payload round-trip | D, coordinates and `Math.fround` weights exactly equal | real DB evidence |
| C21-27 | Sparse metric | `<#>` = −IP; analytical fixture −0.3125; tolerance `1e-5·max(1,|ref|)` | analytical + linked |
| C21-28 | Dense metric | `1 − <=>` vs reference within `DENSE_COSINE_ABS_TOL = 1.25e-4`; analytical fixture 0.7071067811865475 | analytical + linked |
| C21-80 | Dense tolerance frozen | constant equals `1.25e-4` in helper at S; identical in evidence `tolerances.dense_cosine_abs`; no other value anywhere | grep + evidence |
| C21-29 | HNSW execution plan | EXPLAIN JSON names the disposable index; `enable_seqscan` restored | EXPLAIN + SHOW |

## DB CI Execution Contract

| ID | Mechanical check | Required result | Evidence |
|---|---|---|---|
| C21-62 | Mode derivation | RUN iff canonical CI Stage A identity or manual opt-in (Plan §7.1); PARTIAL identity → FAIL; else SKIP; `DATABASE_URL` alone never triggers | architecture test of the mode function + DB suite |
| C21-63 | No silent skip in canonical CI | exact-head CI `vitest-results.json`: `tests/db/sparsevec-readiness.test.ts` ≥ 1 assertion, all `passed`, 0 skipped/pending/todo | CI artifact |
| C21-83 | CI workflow untouched | `git diff --quiet origin/main F -- .github/` exits 0 | git |

## Provider Identity and Lineage

| ID | Mechanical check | Required result | Evidence |
|---|---|---|---|
| C21-70 | Candidate A model | every provider call `configured_model_id = qwen3.7-text-embedding` | evidence `provider_calls[]` |
| C21-71 | Document role | document call `text_type = document` set explicitly via `EMBEDDING_TEXT_TYPE` | evidence + test source |
| C21-72 | Query role | query call `text_type = query` set explicitly | evidence + test source |
| C21-73 | Cross-role identity | model, version label, dense dimension 1024, output type `dense+sparse`, endpoint fingerprint identical across roles; only `text_type` differs | evidence |
| C21-25 | Linked provenance | Port → normalized → mapping → DB row → score → fusion joinable by `sample_id` for all 9 items | evidence `items[]` |
| C21-40 | Lineage hashes | `normalized_sparse_sha256`, `mapped_sparsevec_text_sha256`, `db_readback_sha256`, `dense_sha256` present per item | evidence |

## Chinese Corpus and Fusion

| ID | Mechanical check | Required result | Evidence |
|---|---|---|---|
| C21-30 | Corpus size | exactly 6 documents (D01–D06) and 3 queries (Q01–Q03) | manifest |
| C21-31 | Non-degenerate | 3 distinct targets (D01, D02, D03); each query ≥ 2 declared distractors exactly as Plan §10.4 | manifest |
| C21-32 | Source identity | title, authority, URL, published, anchor, `extraction_rule_id = S21-EXTRACT-V1`, `text_sha256` per document exactly as Plan §10.4 | manifest |
| C21-75 | Extraction rule | excerpt reproducible from fetched page by Plan §10.4 rule; 30 ≤ length ≤ 400 code points; starts with NFKC anchor | T003 output |
| C21-76 | Outbound permission | `rights_basis = PUBLIC_OFFICIAL_GOVERNMENT_INFORMATION`, `outbound_permission = PERMITTED_PUBLIC_NONPERSONAL`; no `Docs/reference/**` text | manifest + grep |
| C21-33 | Privacy | `contains_personal_data = false` for all; no family/minor/patient/private data | manifest + scan |
| C21-77 | Key-term basis | key term in query and target excerpt; absent from declared distractors | architecture test |
| C21-34 | Frozen pre-run | `manifest_commit` ancestor of S; no provider call before that commit; no manifest change in S→F | git + evidence |
| C21-74 | Corpus frozen before provider call | manifest blob at S = manifest blob at the `manifest_commit` | git |
| C21-36 | Fusion formula | per-query per-channel min-max; constant channel → 0; `0.5·dense + 0.5·sparse`; sort fused desc, `sample_id` asc | architecture + evidence |
| C21-37 | Fusion negatives | missing channel, duplicate ID, non-finite, count ≠ 6 → reject; tie fixture deterministic | architecture test |
| C21-38 | Raw scores preserved | raw/normalized/fused per candidate per query stored | evidence |
| C21-35 | Chinese positive rule | each expected target strict fused #1 (no tie-break); PASS requires 3/3 | evidence `chinese_queries_passed` |
| C21-78 | Ranking-miss semantics | technical chain VERIFIED + `chinese_queries_passed < 3` → `FUSION_PROTOTYPE_VERIFIED = UNKNOWN`, `candidate_a_readiness_state = UNKNOWN`, `execution_completion_state = INCONCLUSIVE`; never PASS, never FAIL by itself | architecture state test |
| C21-79 | No post-hoc tuning | queries/targets/corpus/weights/normalization/distractors/tolerances unchanged between `manifest_commit`, S and F; no rerank/RRF/retry-until-ranking | git diff + grep |

## Evidence, States and Two-Head Model

| ID | Mechanical check | Required result | Evidence |
|---|---|---|---|
| C21-39 | Evidence schema | every Plan §14 key present with in-vocabulary value | architecture schema test |
| C21-64 | V1技术设计 §4.2 fields | `postgres_version, tencentdb_kernel_version, extension_name, extension_version, sparsevec_spike_status, rag_candidate_status, readiness_status, checked_at, evidence_ref` all present | schema test |
| C21-65 | `sparsevec_spike_status` | ∈ {PASS_STAGE_A, FAIL, BLOCKED, UNKNOWN, NOT_EVALUATED} and equals state-machine output | schema + state test |
| C21-66 | `rag_candidate_status` | ∈ the five `CANDIDATE_A_SPARSEVEC_PREREQUISITE_*` values only | schema test |
| C21-67 | `readiness_status` bounded | ∈ {PASS_STAGE_A, FAIL, BLOCKED, UNKNOWN, NOT_EVALUATED}; `readiness_scope = CANDIDATE_A_SPARSEVEC_SPIKE_STAGE_A_ONLY` | schema test |
| C21-68 | No overclaim | status-typed fields (Plan §14 list) contain no `READY` / `SELECTED` / `WINNER` / `PRODUCTION` token; `candidate_b_status = candidate_c_status = UNAFFECTED`; `rag_readiness = NOT_DERIVED` | schema test |
| C21-41 | State machine | lower flags derived by helper predicates only | architecture test |
| C21-42 | Aggregate PASS | only all four VERIFIED + cleanup CLEAN + identities valid | architecture test |
| C21-43 | FAIL semantics | deterministic technical incompatibility → COMPLETED_WITH_FAIL; Candidate A not met | architecture test |
| C21-44 | BLOCKED semantics | gate/credential/permission/source unavailable never PASS | architecture test |
| C21-45 | UNKNOWN semantics | inconclusive evidence never PASS | architecture test |
| C21-46 | NOT_EVALUATED semantics | skipped execution never PASS | architecture test |
| C21-61 | Subject head | evidence `implementation_subject_head` = `git rev-parse HEAD` at run start and end; tree clean except evidence path | evidence + T010 log |
| C21-69 | S → F convergence | Plan §13.2 commands all exit 0; only `tests/evidence/sparsevec-readiness-stage-a.json` differs | T011 log |
| C21-84 | No self-reference keys | evidence has no `repo_head`, `final_pr_head`, `containing_commit` key | schema test |
| C21-47 | No professional approval invention | no clinical/professional label or claim | manifest + evidence |
| C21-48 | Production authority deferred | metric/fusion/index strings marked SPIKE ONLY; `production_route_selection = DEFERRED_TO_GOLD_DATASET` | evidence |
| C21-49 | No guard / ownership / governance mutation | `.specify/**`, `scripts/**`, `.github/**` unchanged | diff |

## Cleanup, Security and Regression

| ID | Mechanical check | Required result | Evidence |
|---|---|---|---|
| C21-50 | Success cleanup | no `s21_%` relation remains | real DB |
| C21-51 | Failure cleanup | injected failure leaves no `s21_%` relation | real DB |
| C21-52 | Rerun | two consecutive runs succeed without collision | real DB |
| C21-53 | Planner cleanup | `enable_seqscan` equals pre-probe value | real DB |
| C21-54 | Secret hygiene | Plan §13.4 negated grep exits 0 with empty stdout on F | scan |
| C21-55 | Privacy of evidence | no 20-code-point excerpt substring; forbidden keys absent; no vector arrays | architecture test |
| C21-56 | Governance validators | `validate-governance`, governance self-tests, `validate-change-governance --base origin/main --head HEAD`, change-governance self-tests PASS on F | command output |
| C21-57 | Static guard | `guard-static` + `--self-test` PASS without guard edits | command output |
| C21-58 | Canonical regression | exact-head CI `verify-all` PASS on F | CI run |
| C21-59 | Exact-head binding | S and F recorded; T011 checks run on F; provider truth from S only | report |
| C21-60 | Audit 2 handoff boundary | Developer stops at READY FOR INDEPENDENT AUDIT 2 / BLOCKED / INCONCLUSIVE | final report |

## Frozen Acceptance Scenario Coverage

| Scenario | Required checklist evidence |
|---|---|
| AS-01 real normalized query/doc output | C21-07, C21-08, C21-25, C21-70..C21-73 |
| AS-02 mapping boundaries | C21-15..C21-21 |
| AS-03 PG identity / readback / exact metrics | C21-12..C21-14, C21-26..C21-28, C21-80 |
| AS-04 D / nnz / HNSW / index behavior | C21-22..C21-24, C21-29 |
| AS-05 Chinese sample + fusion | C21-30..C21-38, C21-74..C21-79 |
| AS-06 linked evidence + cleanup | C21-39, C21-40, C21-50..C21-53, C21-61, C21-69 |
| AS-07 blocked / unknown / fail truthfulness | C21-41..C21-46, C21-65..C21-68, C21-78 |
| AS-08 repeatability / security / governance | C21-49, C21-52, C21-54..C21-59, C21-62, C21-63, C21-81..C21-84 |

## Frozen Negative Scenario Coverage

| Scenario | Required checklist evidence |
|---|---|
| NS-01 invalid sparse inputs | C21-18..C21-20 |
| NS-02 namespace / dimension / role / model misuse | C21-15, C21-17, C21-21, C21-70..C21-73 |
| NS-03 DB / version / role / boundary failures | C21-12..C21-14, C21-22..C21-24 |
| NS-04 fake / detached evidence | C21-25, C21-39, C21-40, C21-61, C21-63 |
| NS-05 sample / channel / score / tie negatives | C21-31, C21-35, C21-37 |
| NS-06 index not exercised / cleanup failure | C21-29, C21-50..C21-53 |
| NS-07 permission / privacy / secret / professional-label violation | C21-32, C21-33, C21-47, C21-54, C21-55, C21-76, C21-77 |
| NS-08 persistent / product / provider / governance scope creep | C21-03..C21-11, C21-48, C21-49, C21-81, C21-83 |

## Planning Reconciliation Record (Plan AI 2)

Closed planning defects (mechanically re-checkable on this planning head):

- A1–A3: `plan.md` contains `## Upstream Traceability`, `## Constitution Check` (CC-01..CC-12 with PASS/BLOCKED), `## Verification Plan`.
- A4–A6: `tasks.md` contains `## Frozen Spec Authority Map` (rows T001–T012), `## Acceptance Evidence Contract`, and a `### Verification` section in every structured task T001–T012.
- B: two-head evidence model; no evidence field equals its own containing commit (Plan §13).
- C: DB CI execution contract on existing CI identity; no workflow change (Plan §7.1).
- D: V1技术设计 §4.2 fields and bounded status vocabularies (Plan §14).
- E: dense cosine tolerance frozen at 1.25e-4 (Plan §8.2).
- F: PASS / FAIL / UNKNOWN semantics for the 6×3 sample (Plan §15).
- G: corpus, extraction rule, queries, targets, distractors and outbound permission frozen (Plan §10.4).

The Audit 1 verdict for this planning head is reported externally against the exact remote head; this file intentionally contains no self-referential audit result.
