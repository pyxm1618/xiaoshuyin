# Slice 21 — Planning / Developer Mechanical Checklist

> Feature: `021-sparsevec-readiness-spike`  
> Frozen Spec blob: `952a64610f09997a86571e1e1f390eb5660170ca`  
> Purpose: mechanical PASS / FAIL / NOT APPLICABLE verification. This checklist does not authorize development.

Status values for Developer execution: `PASS`, `FAIL`, `NOT APPLICABLE`. Any required item that is not PASS blocks positive Stage A readiness.

| ID | Mechanical check | Required result | Evidence |
|---|---|---|---|
| C21-01 | Frozen Spec exact head re-read | `688ad88e...` or formally reconciled same frozen blob | git/GitHub read-back |
| C21-02 | Frozen Spec blob re-read | exactly `952a64610f09997a86571e1e1f390eb5660170ca` | file blob |
| C21-03 | Spike remains test/evidence only | no production retrieval/RAG runtime | diff |
| C21-04 | No pg_jieba/RRF/reranker/Gold Dataset work | zero implementation delta | diff/grep |
| C21-05 | No production migration/table/index/route | zero persistent DB/product delta | diff + DB absence |
| C21-06 | No Context Builder / AI Task Runtime / generic framework | zero delta | diff |
| C21-07 | Slice 20 implementation dependency | implementation exists, Audit 2 PASS, merged main | remote truth |
| C21-08 | Public Slice 20 normalized adapter only | no raw HTTP/parser/parallel provider path in Slice 21 | imports/diff |
| C21-09 | Governance mode | test-only fixed-exempt surface | changed paths |
| C21-10 | New production ownership | NOT REQUIRED while diff stays test-only | validator |
| C21-11 | Change-binding | NOT REQUIRED while diff stays fixed-exempt | validator |
| C21-12 | PG target | actual PostgreSQL major 18 | SQL evidence |
| C21-13 | pgvector target | actual extversion 0.8.7 | SQL evidence |
| C21-14 | Runtime role boundary | `xiaoshuyin_app`, non-superuser, NOBYPASSRLS, no public CREATE | SQL evidence |
| C21-15 | Sparse D | exactly 1,000,000,000 for all sparse rows/query | mapping/DB evidence |
| C21-16 | Mapping origin | provider index 0 maps to SQL 1 | unit test |
| C21-17 | Mapping high boundary | provider D-1 maps to SQL D; provider D rejects | unit test |
| C21-18 | Canonical order/duplicates | unsorted normalized input rejects; duplicate including zero rejects | unit test |
| C21-19 | Numeric boundary | NaN/Inf/float32 overflow/nonzero-underflow reject; exact zero handling correct | unit test |
| C21-20 | Empty/all-zero | rejected for retrieval | unit test |
| C21-21 | Dense vs sparse dimensions | independently asserted; high sparse key > dense dim accepted if <D | unit/DB test |
| C21-22 | Storage boundary | 16,000 nnz PASS; 16,001 expected FAIL | real DB |
| C21-23 | HNSW boundary | 1,000 nnz PASS; 1,001 expected incompatibility, no truncation | real DB |
| C21-24 | Dimension boundary | sparsevec(D) PASS; sparsevec(D+1) expected FAIL | real DB |
| C21-25 | Actual provider linked provenance | adapter -> normalized -> mapping -> DB row join by stable IDs | evidence |
| C21-26 | Actual payload DB roundtrip | sparse coordinates/D and float32 weights agree | real DB evidence |
| C21-27 | Sparse metric | `<#>` sign/value/order matches independent IP | analytical + real fixture |
| C21-28 | Dense metric | `<=>` cosine order/score computed independently | real fixture |
| C21-29 | HNSW execution plan | EXPLAIN proves disposable HNSW index path; planner setting restored | EXPLAIN + cleanup |
| C21-30 | Chinese corpus size | exactly 6 documents, 3 queries | manifest |
| C21-31 | Non-degenerate corpus | 3 distinct expected docs; >=2 unrelated distractors/query; >=3 topic/source sections | manifest |
| C21-32 | Source provenance/rights | source ref/version + PERMITTED_FOR_TEST + SHA-256 present | manifest |
| C21-33 | Privacy | no real family/minor/patient/private data | manifest/evidence scan |
| C21-34 | Expectations frozen pre-run | manifest commit precedes provider execution; no post-hoc edit | git/evidence |
| C21-35 | Chinese technical correctness | expected match strict fused #1 and above declared distractors for all 3 queries | linked result |
| C21-36 | Fusion formula | per-query per-channel min-max + fixed 0.5/0.5 exactly | unit/evidence |
| C21-37 | Fusion edge cases | constant channel -> all 0 normalized; missing/duplicate/nonfinite fail; ties deterministic | unit tests |
| C21-38 | Raw score preservation | dense/sparse raw scores retained | evidence |
| C21-39 | Evidence schema | all required identity/provenance/version/score/cleanup fields present | schema test |
| C21-40 | Evidence lineage | provider request -> normalized hash -> mapped hash -> DB readback -> score -> fusion joinable | evidence |
| C21-41 | State machine | lower statuses derived mechanically | architecture test |
| C21-42 | Aggregate PASS | only all four VERIFIED + dependency identity + clean cleanup | architecture test |
| C21-43 | FAIL semantics | deterministic incompatibility can complete Spike but Candidate A not ready | architecture test |
| C21-44 | BLOCKED semantics | dependency/credential/permission/source unavailable never becomes PASS | architecture test |
| C21-45 | UNKNOWN semantics | inconclusive/unexpected evidence never becomes PASS | architecture test |
| C21-46 | NOT_EVALUATED semantics | skipped required execution never becomes PASS | architecture test |
| C21-47 | No professional approval invention | no clinical/professional label or claim | manifest/evidence |
| C21-48 | Production authority deferred | fusion/metric/index choices marked SPIKE ONLY | code/evidence strings |
| C21-49 | No guard/ownership/governance mutation | `.specify/**` and `scripts/**` unchanged by implementation | diff |
| C21-50 | Success cleanup | no temp table/index remains | real DB |
| C21-51 | Failure cleanup | injected failure still leaves no temp object | real DB |
| C21-52 | Rerun cleanup | two consecutive harness runs do not collide | real DB |
| C21-53 | Planner cleanup | `enable_seqscan` change is transaction-local/reset | real DB |
| C21-54 | Secret hygiene | no secret/API key/auth header/raw provider body in repo/evidence/log output | scan/test |
| C21-55 | Provider source text evidence | evidence stores identities/fingerprints, not unapproved raw source text | artifact |
| C21-56 | Canonical governance validation | current validators PASS | command output |
| C21-57 | Static guard | guard + self-test PASS without Slice 21 guard edits | command output |
| C21-58 | Canonical regression | existing `verify-all` PASS on exact final head | command output |
| C21-59 | Exact-head evidence | all final evidence and checks bind one exact head | report/artifact |
| C21-60 | Audit 2 handoff boundary | Developer stops at READY FOR INDEPENDENT AUDIT 2 | final report |

## Frozen Acceptance Scenario Coverage

| Scenario | Required checklist evidence |
|---|---|
| AS-01 actual normalized query/doc output | C21-07,C21-08,C21-25 |
| AS-02 mapping boundaries | C21-15..C21-21 |
| AS-03 PG identity/readback/exact metrics | C21-12..C21-14,C21-26..C21-28 |
| AS-04 D/nnz/HNSW/index behavior | C21-22..C21-24,C21-29 |
| AS-05 Chinese sample + fusion | C21-30..C21-38 |
| AS-06 linked evidence + cleanup | C21-39,C21-40,C21-50..C21-53 |
| AS-07 blocked/unknown/fail truthfulness | C21-41..C21-46 |
| AS-08 repeatability/security/governance | C21-49,C21-52,C21-54..C21-59 |

## Frozen Negative Scenario Coverage

| Scenario | Required checklist evidence |
|---|---|
| NS-01 invalid sparse inputs | C21-18..C21-20 |
| NS-02 namespace/dimension misuse | C21-15,C21-17,C21-21 |
| NS-03 DB/version/role/boundary failures | C21-12..C21-14,C21-22..C21-24 |
| NS-04 fake/detached evidence | C21-25,C21-39,C21-40 |
| NS-05 sample/channel/score/tie negatives | C21-31,C21-35,C21-37 |
| NS-06 index not exercised / cleanup failure | C21-29,C21-50..C21-53 |
| NS-07 permission/privacy/secret/professional-label violation | C21-32,C21-33,C21-47,C21-54,C21-55 |
| NS-08 persistent/product/provider/governance scope creep | C21-03..C21-11,C21-48,C21-49 |

## Planning Audit 1 Checklist

These items are assessed by Plan AI 2, not Developer AI.

- [x] Frozen Spec blob unchanged.
- [x] Current main and frozen branch topology re-read.
- [x] Main drift inspected; only unrelated ownership registry delta; NO SEMANTIC IMPACT.
- [x] Slice 19 current readiness/harness inspected.
- [x] Slice 20 Spec/Plan/Checklist/Tasks inspected.
- [x] PR #118 confirmed governance-only and not an implementation gate substitute.
- [x] No Slice 20 implementation PR/branch found.
- [x] No competing Slice 21 implementation found.
- [x] Current ownership/change-governance classification inspected.
- [x] Governance mode resolved: NO NEW PRODUCTION OWNERSHIP REQUIRED.
- [x] Exact allowed/forbidden implementation paths frozen.
- [x] Mapping contract executable and boundary-complete.
- [x] PG storage/HNSW boundaries separated.
- [x] Actual provider -> actual DB linked proof required.
- [x] Metric operator/sign/order/reference/tolerance frozen.
- [x] Spike-only fusion formula and edge behavior frozen.
- [x] Chinese sample minimum/protocol/freeze rule frozen.
- [x] Persistence/cleanup success/failure/rerun mechanics frozen.
- [x] Evidence schema and state derivation frozen.
- [x] PASS vs execution-completed-with-FAIL semantics separated.
- [x] Slice 20 implementation hard gate remains CLOSED at planning time.
- [x] Every FR/AS/NS maps to Plan + Checklist + Task.
- [x] No full retrieval/pg_jieba/RRF/reranker/Gold/Context/AI-runtime scope introduced.

Planning Audit 1 result is recorded only after `plan.md`, `checklist.md` and `tasks.md` are committed and re-read from the planning exact head.
