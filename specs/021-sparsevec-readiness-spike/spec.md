# Slice 21 — Sparsevec Readiness Spike

Status: DRAFT / NOT FROZEN — Specify / Clarify candidate only
Feature: 021-sparsevec-readiness-spike
Phase: 3 — Professional Knowledge & AI
No Plan, Checklist, Tasks, implementation authorization, audit or merge is implied.

## 1. Purpose
Verify the smallest end-to-end technical feasibility question for RAG candidate A: whether actual DashScope dense+sparse results obtained through Slice 20 can be mapped without coordinate loss into the Slice 19 target pgvector sparsevec type, queried correctly and fused in a disposable experiment. Produce reproducible positive, negative or blocked evidence, not a production retrieval service. A failed experiment is a legitimate result; it is not readiness.

## 2. Authority / Upstream Traceability
| Authority | Relevant obligation |
|---|---|
| Docs/总产品需求.md §§28,31A,32 | Model replaceability, professional authority, formal document precedence and no speculative future work. |
| Docs/V1产品需求.md §2.3, V1-C34, V1-X14 | Truthful unknown/capability state and professional authority boundaries. |
| Docs/总体技术架构.md §§11.1–11.5,17.5,18A,19A | Candidate A spike including actual Chinese professional sample retrieval correctness; A/B/C comparison and production selection later; controlled external access. |
| Docs/V1技术设计.md §§4.2,13.1–13.6,20, Phase 3 and release criteria | PG18/pgvector, genuine sparse payload mapping, dimension, nnz, insert/read/distance, target index/query behavior, fusion prototype; separate Gold Dataset and pinned production version. |
| specs/019-professional-retrieval-pgvector-readiness/spec.md | Dense pgvector readiness, stage and privilege boundary. |
| specs/020-embedding-provider-adapter-foundation/spec.md and corresponding plan/checklist/tasks | Sole provider adapter and normalized output contract; no persistence or retrieval in 020. |

Four Docs and frozen upstream specifications remain controlling. No amendment or inferred professional approval. References to commit IDs below are verification snapshots only. External technical references: Alibaba Cloud Model Studio synchronous embedding API, https://help.aliyun.com/en/model-studio/text-embedding-synchronous-api ; pgvector v0.8.7 README and src/sparsevec.h, src/sparsevec.c, src/hnsw.h, src/hnswutils.c at https://github.com/pgvector/pgvector/tree/v0.8.7 . External documentation is not runtime evidence.

## 3. Problem Statement
Provider vocabulary-coordinate indices and pgvector SQL indices, vector dimension, numeric storage precision, distance sign and storage/index limits are different contracts. Dense readiness and normalized parsing do not prove sparse readiness. Candidate A requires direct linked observation of actual provider payload, actual target database behavior, actual Chinese sample retrieval and prototype fusion before candidate implementation may claim this prerequisite satisfied.

## 4. Scope
### In Scope
- Consume Slice 20's public normalized embedding result; verify compatibility of real candidate dense+sparse outputs for query and document samples under one recorded configuration.
- Deterministic bounded mapping to sparsevec, disposable DB fixture with dense and sparse values, insertion, structured readback, exact distance/ranking, target-version index behavior and limit probes.
- Small real Chinese professional-text technical retrieval sample, predeclared source identities and expected technical matches, paired dense/sparse scores and disposable fusion mechanics.
- Reproducible, stage-specific evidence of success, failure and unavailable conditions; cleanup and least privilege.

### Non-Goals
No production index selection, score optimization, model or route choice, evaluation benchmark, user-facing capability or generalized library. Prefer temporary test-only code and existing harnesses, not enduring abstraction.

## 5. Explicit Out of Scope / Out of Scope
Embedding Provider Port, HTTP transport, SDK, provider parsing/normalization redesign, retry/timeout, provider error/telemetry/cost/secret/model/output_type contract (020 owns them); dense readiness/bootstrap changes (019 owns them); chunking, ingestion, production knowledge_embeddings or schema/migrations/lifecycle, retrieval pipeline, hard filters, pg_jieba, RRF, qwen3-rerank or evaluation, Gold Dataset A/B/C execution, Context Builder, AI Task Runtime, TaskModelRegistry, Promptfoo framework, production pinned models/routes or RAG API, Family Memory, generic vector/AI frameworks, other vector DBs, V2–V5 capabilities. No upstream edits or professional labels. No governance changes in this specification stage.

## 6. Upstream Dependencies
Planning: admitted 019 and 020 authority documents plus four Docs, no actual provider invocation required for Specify. Implementation: 019 merged and exact Stage A dense readiness reproducible on current target; 020 implementation Audit 2 PASS, merged into main, usable public normalized port available; no copy or parallel provider path. 020's actual provider coverage may be obtained during authorized verification; its offline-only status does not satisfy 021's positive evidence gate. 016/017/018 are semantic boundaries, not requirements to run intervention, knowledge ingestion or formal Gold Dataset runtime. Use approved-for-test nonpersonal professional text, no professional approval bypass. Production: deployment-stage-specific PG/extension compatibility, approved external processing, candidate A spike result, A/B/C Gold Dataset and pinned routes/models, all other formal release prerequisites; no inherited readiness.

## 7. Domain / Technical Invariants
One provider identity/configuration and coordinate namespace per experiment; common dimension for all sparse documents and queries; immutable sample IDs join dense and sparse results; no mixed models/versions or sample/config drift. Dense dimension is not sparse dimension. No token hashing, reindexing based on token strings, collision merging, clipping, truncation or per-vector dimension. All numeric operations finite; failed or missing observations never become successes. No production data access, business writes, provider route changes or lasting DB artifacts. Evidence scoped to tested version, stage, model/config, corpus, commit and run.

## 8. Sparse Payload Contract
Input is 020's validated normalized sparse list of index and value (optional token metadata), coupled to the same item's dense result, source ID, configured model/version, output type and provider provenance. Do not parse raw HTTP in 021. The raw shape is upstream-owned: HTTP output.embeddings with sparse_embedding entries; strict envelope validation belongs to 020. Provider index denotes vocabulary position/key, not dense coordinate; require nonnegative safe integer, uniqueness including zero-weight entries, and finite numeric value. Canonical ascending order, no duplicate summation. Recheck representability at DB boundary, not second provider normalization. If authoritative sparse_vocabulary_max is available enforce it; missing bound is not inferred from observed maximum or dense dimension. Record observed min/max and nnz separately. Provider underlying base/full vocabulary size may be unknown; do not claim either from documentation examples. Use the same actual port configuration for document/query roles permitted by 020 and record it; do not invent text_type fields or bypass the port. Missing sparse results are not empty successful results.

## 9. Sparsevec Mapping Contract
Spike-only proposed coordinate capacity D = 1,000,000,000 (v0.8.7 supported dimension ceiling), independent of model vocabulary size; use one D across all rows and queries. If a verified provider namespace bound exceeds D or an observed key is outside [0,D), fail closed, no compression. If no authoritative bound exists, only observed in-range payload compatibility can be asserted. Map provider nonnegative key i injectively to SQL textual index i+1 (1-based), ascending. This rule preserves distinct keys regardless of unproven provider vocabulary-base semantics. Example synthetic keys 0:0.5 and 7:-0.25 map to {1:0.5,8:-0.25}/1000000000. Canonical text {index:value,...}/D is sufficient; use parameter binding, not interpolated SQL. Binary protocol is not required; if used it must match exact extension version's network-order dimension, nnz, reserved zero, zero-based int32 indices then float4 weights; cannot reuse text's 1-based indices in binary. Validate before removing exact ±0; reject all-zero or empty sparse input for retrieval even if DB supports an empty vector. Validate representability in float32, reject overflow and nonzero-underflow-to-zero; do not silently clamp. Compare readback to expected float32 weights with explicit round-trip semantics, exact coordinate/dimension equality. DB can reject malformed representation; no automatic remapping/retry. Production dimension/namespace policy is deferred.

## 10. PostgreSQL / pgvector Verification Contract
Use Slice 19 Stage A target PostgreSQL 18 and extension 0.8.7, current pinned image pgvector/pgvector:0.8.7-pg18-trixie@sha256:5895949dfcdf308eb0cd31c950c93c14895c77f33fbedfecf1fa511ab1d4bcd2. Actual server minor and installed extension version, image digest and role must be queried in evidence; config alone insufficient. Drift invalidates matching claims; no implicit version upgrade. Stage B/C separately NOT_EVALUATED until independently proven.
- Existing privileged bootstrap is only extension creator; app role must remain non-superuser/non-BYPASSRLS with no public schema CREATE or extension ownership. Use disposable temp tables/indexes and cleanup, no new production migration.
- Actual sparsevec(D) insert and readback of genuine normalized payload, including exact dimension and coordinates; validate typed columns and mismatched dimension insert/distance failure.
- Exact sparse inner product via <#> (negative inner product; negate for descending similarity); dense cosine via <=> (1-distance for similarity). These are probe metrics, not production policy. Independent numeric reference from float32 weights, bounded tolerance fixed before execution, exact order with stable ID ties, nonfinite rejected. Dense zero vector rejected for cosine; no silent substitution. Verify known analytical fixtures and actual linked provider sample.
- Exact storage/type max 16,000 nnz and D max 1e9; HNSW sparse index max 1,000 nnz at v0.8.7. Distinguish configured 020 cap from DB limits, use controlled synthetic boundary fixtures through separate DB probe for 16,000/16,001 and 1,000/1,001 and D/D+1; no full dense expansion. Do not demand provider generate boundary cases. Actual payload above 16,000 is incompatible. Above 1,000 but within storage limit: do not truncate, record exact-scan viability and index incompatibility separately.
- Verify target-version index/query behavior with disposable HNSW sparsevec_ip_ops, actual EXPLAIN evidence that controlled index path executes (test-session planner settings if needed, reset on cleanup), compare bounded results with exact reference, test limit rejection. Also attempt supported actual sample path, record any actual payload incompatibility. ANN is not guaranteed exact globally. No production index, parameter tuning, latency SLA or performance claim. An observed HNSW limit is an informative result, not a positive HNSW readiness claim; a bounded exact-search spike may pass if all required exact-path/actual-sample/fusion gates and explicit index-behavior observations pass. Unexpected behavior or missing required probe blocks the spike. Future production index selection is independent.

## 11. Fusion Prototype Boundary
Use actual paired dense/sparse scores for the same small fixed candidate set, with stable sample IDs, both scores required, no unauthorized IDs or duplicates. For mechanics only, independently min-max normalize each finite channel per query, constant channel maps to zero; combine equal weights 0.5/0.5, descending score and stable sample-ID tie-break. Record raw scores, normalized scores, combined scores, identities and reference calculation. No weight search, RRF, reranking, relevance benchmark or production ranking policy; no fallback to one channel if missing. Deterministic numeric fixture plus actual Chinese sample proof. A real sample with genuine source text must be distinguished from synthetic numeric boundary tests. Use a minimal fixed corpus (at least three distinct sources/excerpts, at least two topics, at least two queries including a repeated run); exact source/term identification and unrelated distractors predeclared. No invented professional clinical relevance labels, no post-hoc cherry-picking. Record source version/ref, text fingerprint, query identity, returned ranked IDs and expected technical retrieval checks. Only lawful permitted-for-test professional text without family/minor/private data and with outbound permission; if technical correctness cannot be demonstrated without professional judgement, obtain real approval or mark blocked. No Gold Dataset performance claims.

## 12. Persistence Boundary
No permanent schema, knowledge_embeddings, migration, materialized index, business row, runtime registry or production route. Temporary isolated table/index/session for probes only; drop/rollback and verify absence after success/failure. Evidence artifact is not embedding persistence. Retain only necessary permitted test evidence under repository artifact policy; no production records. A separate test-only SQL fixture is allowed, not a migration in the production migration chain.

## 13. Error / Fail-Closed Semantics / Edge, Failure, and Unknown States
Differentiate invalid/malformed/duplicate/out-of-range/unrepresentable/empty input, dimension or namespace mismatch, upstream/provider unavailable, permissions/version mismatch, failed DB read/write/query/index, nonfinite score, unexpected ranking, missing evidence and cleanup failure. Preserve 020's provider error classifications, no new transport retry. No partial success substitution, dummy embedding, retry with another model, silent dense-only fallback, guessed zero scores or automatic route changes. Explicit failure if observed incompatibility; BLOCKED if dependency/permission unavailable; NOT_EVALUATED if not run; UNKNOWN for inconclusive evidence. These are evidence outcomes, not new persistent domain enums.

## 14. Evidence Model
Each artifact records run ID/time, repo exact commit, upstream 019/020 heads/port provenance, stage, image digest, queried PG/extension versions, execution role category, model/config and echo availability, allowed source refs/fingerprints, provider request IDs and safe normalized payload evidence or access-controlled immutable reference, dimension/mapping policy, counts, limits, actual SQL results, readback comparison, distance/reference results and tolerances, EXPLAIN/index observations, fusion/sample IDs and results, negative cases, cleanup and limitations. Positive linked proof must connect real adapter outputs to actual target DB inserts/readbacks and scores, not independent unlinked fixtures. Controlled tests may replay verifiably captured real payload only with lineage; positive end-to-end gate requires actual provider-origin evidence for the precise query/document experiment through merged 020, not a fabricated fixture or undocumented HTTP request. No secrets or unapproved raw text, sanitize by default; provenance sufficient for independent reproduction. Record all attempted samples and failures. Production readiness is not derived here.

## 15. Readiness States
Orthogonal evidence flags, each defaults to NOT_EVALUATED:
- MAPPING_CONTRACT_VERIFIED: offline deterministic/negative mapping checks only.
- SPARSE_PAYLOAD_VERIFIED: actual candidate-specific dense+sparse provider call through 020, with normalized output and traceable configuration, validated sample identities, nonempty compatible values; not inferred from mocks or 020 generic adapter tests.
- PGVECTOR_SPARSEVEC_VERIFIED: real target-version DB integration for linked provider payload plus type/dimension/nnz/index/query/role/cleanup probes. Synthetic-only DB success may be reported as fixture verification, not this flag. Index observations distinguish exact scan viability from HNSW compatibility.
- FUSION_PROTOTYPE_VERIFIED: actual paired scores from same real payload/DB experiment plus deterministic formula checks, Chinese sample technical correctness and tie/negative cases.
Aggregate SPARSEVEC_SPIKE_PASS_STAGE_A requires all above positive, evidence lineage and cleanup complete, 019 and 020 applicable evidence valid. Otherwise report FAIL/BLOCKED/UNKNOWN/NOT_EVALUATED with reasons, never READY. This is candidate A prerequisite evidence only, not RAG readiness. Actual failed spike can be closed as a documented FAIL after independent audit; missing provider/DB evidence cannot be represented as completed positive spike. B/C unaffected. Stage B/C not inherited. Production route remains undecided.

## 16. Security / Secrets Boundary
Use 020 controlled secret injection and approved outbound endpoint/configuration only. No credentials in repo, CLI arguments, artifacts or logs. No new secret mechanism, direct HTTP path or permissive CI secrets. No real family, minors, patient, restricted or unauthorized text. Respect external access and test source rights; do not send private knowledge without authorization. No role grants, bypass, public schema writes or production DB tests. Respect upstream guard and failure handling.

## 17. Observability Boundary
Use existing 020 telemetry/cost/error records, correlate by run and request IDs. Only bounded probe summaries and evidence artifacts; no new telemetry schema, metrics service, cost accounting or tracing framework. Configured model/version distinguished from provider echo. Missing telemetry or cost evidence not invented; 020 obligations remain independently governed.

## 18. Governance Boundary
Current registry uses longest match; unknown production paths fail closed. 019 owns its bootstrap exact path; Rule 19 protects its scoped readiness implementation; global no permanent pgvector_readiness table and privilege restrictions remain. 020 governance PR #118 proposed own adapter prefix only; 021 cannot claim that path. No registered 021 production ownership observed. Prefer test-only surfaces; Plan AI 2 must classify concrete paths against current validator and change-binding rules. If a new implementation path actually needs ownership, separately admit spec/planning, then narrow independent governance prerequisite before development; no blanket allowance or speculative registry entry. Existing scoped Rule 19 does not require relaxation for a separate disposable spike. Rule 8 remains intact. No changes to ownership, guard, change-bindings or authority Docs during this stage.

## User Scenarios & Testing
This is infrastructure verification without new product UI or user-facing behavior. Operators can reproduce an exact-stage spike and see truthful readiness/failure; downstream retrieval designers receive only bounded technical evidence. Test the mapping with known fixtures, real provider + DB linked runs, actual Chinese source samples, limit/index and negative cases. No claim of professional or business acceptance.

## 19. Acceptance Scenarios
- AS-01 Real 020 normalized dense+sparse query/doc output with stable config and sample IDs; expected key/value representation produced without raw HTTP access.
- AS-02 Zero and high sparse index, unrelated dense dim, unsorted synthetic boundary fixture canonicalized (upstream canonical port order expected); uniqueness validated before zero removal, float32 readback and same dimension for different max keys.
- AS-03 Real PG18/0.8.7 image and app-role proof, actual payload insertion and structured readback; exact sparse distance and dense score agree with independent calculation and stable expected ordering.
- AS-04 Actual DB boundary probes for dimension, 16k nnz storage and 1k HNSW; positive/negative behavior and observed indexed query plan, actual-payload index compatibility separately reported.
- AS-05 Real Chinese professional excerpts and fixed queries/distractors, actual retrieval technical checks passed, paired fusion computed reproducibly, no model/route/ranking policy selected.
- AS-06 Evidence positively links actual provider, actual DB, sample and fusion; cleanup verified, no lasting schema/data changes, no cross-stage readiness inheritance.
- AS-07 Missing provider/DB/permission/coverage produces explicit blocked or unknown status; a reproducible negative candidate A result is reported without pretending readiness.
- AS-08 Repeat run on same permitted identity/config, no leaked secrets, no business or professional authority writes, scope and governance intact.

## 20. Negative Scenarios
NS-01 duplicate key including zero; negative, fractional, unsafe or out-of-range index; NaN/Inf; missing/malformed input; empty/all zero; float32 overflow/underflow: reject.
NS-02 dense dimension used as sparse bound, per-vector max+1, token hash, mixed namespace/model/versions: reject.
NS-03 DB dimension mismatch, oversized nnz, index 1,001, wrong PG/extension/role, missing extension: fail or explicit documented index incompatibility; no truncation/upgrade/escalation.
NS-04 provider fake/fixture success, DB mocked, detached evidence or skipped Chinese sample/fusion: no positive spike.
NS-05 missing/duplicate sample IDs, absent channel, nonfinite distance, constant scores, ties: reject invalid input; constant channel and ties follow declared mechanics.
NS-06 actual index plan not exercised, unexpected behavior, failed cleanup: fail/block; no false claim.
NS-07 missing outbound permission, private data, raw secrets, professional label without approval: stop affected test.
NS-08 persistent table, production retrieval, provider bypass, new route/pin, reworked 019/020, broad governance changes: prohibited.

## Requirements
- FR-001 [UPSTREAM: V1技术设计 §4.2; 总体技术架构 §11.3] Actual provider payload to actual target sparsevec verification, including dimensions, nnz, insert/read/distance and index/query behavior is mandatory.
- FR-002 [UPSTREAM: V1技术设计 §13.3; 020] Consume public normalized result only; preserve all 020 responsibilities and provenance.
- FR-003 [UPSTREAM: V1技术设计 §4.2; 019] Preserve stage-specific target and privilege boundaries; use isolated disposable probe.
- FR-004 [UPSTREAM: 总体技术架构 §11.3; V1技术设计 §13.2] Verify actual Chinese technical retrieval and bounded fusion mechanics; no final ranking policy.
- FR-005 [UPSTREAM: V1-C34; V1技术设计 release criteria] Real evidence required for positive claims, explicit failure/unknown and candidate A prerequisite status.
- FR-006 [UPSTREAM: V1-X14; 总体技术架构 §§17.5,19A; V1技术设计 §13.1] Approved-for-test external content, professional and publication boundaries remain independent.
- FR-007 [UPSTREAM: V1技术设计 §§13.2–13.6,20] Defer production retrieval, Gold Dataset route selection and pinned model/version; protect B/C.
- FR-008 [UPSTREAM: 019/020; repository governance] No ownership/guard bypass or competing implementation, no lasting schema.

## Key Entities
No new production entity. Ephemeral sample identity, normalized embedding result from 020, sparsevec probe value, paired score, evidence run/ref.

## 21. Implementation Gate
Before Developer AI: frozen 021 spec plus Plan AI 2 Plan/Checklist/Tasks and Audit 1 PASS; real current-main reconcile; 019 merged and exact compatible runtime; 020 actual implementation Audit 2 PASS + merged main, public port verified available; applicable governance prerequisites merged. Provider credential availability is a real-evidence dependency, not permission to duplicate 020. Missing credential blocks successful spike, not grounds for fabricated evidence. No Developer AI authorization in this spec.

## 22. Exit Criteria / Success Criteria
SC-001 All scope/negative acceptance evidence and real linked provider/DB/fusion/sample gates satisfy §15 for positive spike, or explicitly verified FAIL with cause and candidate A not eligible.
SC-002 No production migration, persistent embedding schema, business changes, provider duplication or guard bypass; cleanup verified.
SC-003 Real evidence reproducible and stage-scoped; no unsupported READY, production choice or clinical relevance claim. Independent Audit 2 and merge are later process steps, not this role.
SC-004 Missing external evidence remains BLOCKED, never positive or completed readiness.

## Acceptance Evidence
| Gate | Evidence |
|---|---|
| Mapping | deterministic and adversarial fixture checks, expected float32 representation |
| Provider | actual 020 invocation, normalized result and linked run provenance |
| DB | actual target PG/extension/role, typed round-trip, distances, limits, EXPLAIN, cleanup |
| Chinese sample | real permitted source refs, predefined technical expectations, actual result IDs and repeated query |
| Fusion | paired actual scores, reference formula, ties and missing-score negatives |
| Boundary | path/diff, governance verification, no migration/production persistence or unauthorized data |

## 23. Deferred Responsibilities
Production retrieval/knowledge schema and lifecycle, lexical pg_jieba/RRF, reranker, approved professional Gold Dataset A/B/C evaluation, metrics/route and production model pinning, production dimension/namespace drift handling, performance/index strategy, context, AI runtime and family memory. No implicit authorizations.

## 24. Assumptions and Open Questions
Resolved candidate direction: choose smallest independent candidate-A readiness spike; include actual sample, index/query behavior and fusion because formal Authority requires them. No permanent migration. Fixed spike-only D proposal does not assert provider vocabulary size. Do not use observed max to define full vocabulary.
Future execution evidence: actual provider sparse support/envelope, configured model behavior, namespace bounds, observed nnz, real target PG minor and managed stage compatibility must be observed; none claimed now. Check approved sample provenance before provider egress. If exact merged 020 Port cannot express needed query/document experiment or its actual limit conflicts with authority, stop and return to 020 authority reconciliation, never workaround in 021.
Freeze blockers: exhaustive semantic reading of all four Docs and all 019/020 artifacts has not been completed in this pass (full contents retrieved, relevant clauses examined; not equivalent to full reading). Complete cross-PR and source-body conflict verification and review the candidate D, metrics and sample acceptance against full upstream authority before freeze. No product decision is silently assumed approved. The draft is not authority for Plan AI 2 until these checks close.
Remote snapshot (execution evidence, not normative): main 52af5d6719e0732c09cbe203769e3215857c7798; 019 implementation #110 and follow-up #111 merged; 020 planning artifacts present, #118 governance OPEN, no actual adapter path in main; no 021 path at baseline. Open PRs #115/#118/#122/#124/#133. No real provider or DB execution performed in Plan AI 1.
