# Slice 21 — Sparsevec Readiness Spike

Status: FROZEN — Specify / Clarify COMPLETE — Plan AI 1 final authority closeout
Feature: 021-sparsevec-readiness-spike
Phase: 3 — Professional Knowledge & AI
No Plan, Checklist, Tasks, implementation authorization, audit or merge is implied.

## 1. Purpose
Verify the smallest end-to-end technical feasibility question for RAG candidate A: whether actual DashScope dense+sparse results obtained through Slice 20 can be mapped without coordinate loss into the Slice 19 target pgvector sparsevec type, queried correctly and fused in a disposable experiment. Produce reproducible positive, negative or blocked evidence, not a production retrieval service. A failed experiment is a legitimate result; it is not readiness.

## 2. Upstream Traceability (Authority)
| Authority | Relevant obligation |
|---|---|
| Docs/总产品需求.md §§28,31A,32 | Model replaceability, professional authority, formal document precedence and no speculative future work. |
| Docs/V1产品需求.md product-frozen authority preamble; V1-C03, V1-C27, V1-C37, V1-X08 | Preserve truthful unknown/failure states; AI/RAG cannot manufacture professional approval or turn missing evidence into readiness. |
| Docs/总体技术架构.md §§11.1–11.5,17.5,18A,19A | Candidate A spike including actual Chinese professional sample retrieval correctness; A/B/C comparison and production selection later; controlled external access. |
| Docs/V1技术设计.md §§4.2,13.1–13.6,20, Phase 3 and release criteria | PG18/pgvector, genuine sparse payload mapping, dimension, nnz, insert/read/distance, target index/query behavior, fusion prototype; separate Gold Dataset and pinned production version. |
| specs/019-professional-retrieval-pgvector-readiness/spec.md | Dense pgvector readiness, stage and privilege boundary. |
| specs/020-embedding-provider-adapter-foundation/spec.md and corresponding plan/checklist/tasks | Sole provider adapter and normalized output contract; no persistence or retrieval in 020. |

Four Docs and frozen upstream specifications remain controlling. No amendment or inferred professional approval. References to commit IDs below are verification snapshots only. External technical references: Alibaba Cloud Model Studio synchronous embedding API, https://help.aliyun.com/en/model-studio/text-embedding-synchronous-api ; pgvector v0.8.7 README and src/sparsevec.h, src/sparsevec.c, src/hnsw.h, src/hnswutils.c at https://github.com/pgvector/pgvector/tree/v0.8.7 . External documentation is not runtime evidence.

## 3. Problem Statement
Provider vocabulary-coordinate indices and pgvector SQL indices, vector dimension, numeric storage precision, distance sign and storage/index limits are different contracts. Dense readiness and normalized parsing do not prove sparse readiness. Candidate A requires direct linked observation of actual provider payload, actual target database behavior, actual Chinese sample retrieval and prototype fusion before candidate implementation may claim this prerequisite satisfied.

## 4. Scope
### In Scope
- Consume Slice 20's public normalized embedding result; verify compatibility of real candidate dense+sparse outputs for query and document samples under one recorded experiment configuration that is identical across roles except the provider-defined role-specific text_type (§8).
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
One provider identity/configuration (identical across roles except the provider-defined role-specific text_type of §8) and coordinate namespace per experiment; common dimension for all sparse documents and queries; immutable sample IDs join dense and sparse results; no mixed models/versions or sample/config drift. Dense dimension is not sparse dimension. No token hashing, reindexing based on token strings, collision merging, clipping, truncation or per-vector dimension. All numeric operations finite; failed or missing observations never become successes. No production data access, business writes, provider route changes or lasting DB artifacts. Evidence scoped to tested version, stage, model/config, corpus, commit and run.

## 8. Sparse Payload Contract
Input is 020's validated normalized sparse list of index and value (optional token metadata), coupled to the same item's dense result, source ID, configured model/version, output type and provider provenance. Do not parse raw HTTP in 021. The raw shape is upstream-owned: HTTP output.embeddings with sparse_embedding entries; strict envelope validation belongs to 020. Provider index denotes vocabulary position/key, not dense coordinate; require nonnegative safe integer, uniqueness including zero-weight entries, and finite numeric value. Canonical ascending order, no duplicate summation. Recheck representability at DB boundary, not second provider normalization. If authoritative sparse_vocabulary_max is available enforce it; missing bound is not inferred from observed maximum or dense dimension. Record observed min/max and nnz separately. Provider underlying base/full vocabulary size may be unknown; do not claim either from documentation examples. Role-specific text_type contract (S21-SPEC-02): within one Slice 21 experiment, document/corpus embedding calls SHALL use provider-defined text_type = document and retrieval-query embedding calls SHALL use text_type = query. Both roles SHALL use the same experiment/provider/model configuration except the provider-defined role-specific text_type; corpus/document calls use document, retrieval-query calls use query. Provider identity, configured model identity, model version/revision under test, dense dimension, output type, sparse coordinate namespace and approved provider endpoint/family SHALL be identical across both roles; text_type is the only permitted role-specific difference. Each role's text_type SHALL be set explicitly through Slice 20's existing controlled runtime configuration (verified on current main as textType = query | document, default document) and recorded per call in evidence; the Slice 20 default SHALL NOT be relied on implicitly for either role. Both roles SHALL be obtained only through the merged Slice 20 public factory/Port, e.g. separate provider instances created through the existing public contract whose controlled configuration differs only in text_type. No direct HTTP, second provider client, copied parser, arbitrary provider options, self-invented request fields or Slice 20 production modification. A query embedded as document, a document embedded as query, or any other cross-role identity drift invalidates the experiment. If expressing both roles would require changing the Slice 20 production interface, stop with UPSTREAM SLICE 20 PORT CAPABILITY RECONCILIATION REQUIRED; Slice 21 must not modify Slice 20.

Candidate A Spike model identity (S21-SPEC-03): per Docs/总体技术架构.md §§11.1,11.5 and Docs/V1技术设计.md §13.2, Candidate A is qwen3.7-text-embedding dense+sparse. The configured model identity of every Slice 21 Candidate A experiment SHALL be qwen3.7-text-embedding for both roles. If configured_model_id != qwen3.7-text-embedding, the run is INVALID EXPERIMENT CONFIG (or BLOCKED when the model is unavailable) and is not Candidate A evidence: it cannot set SPARSE_PAYLOAD_VERIFIED = VERIFIED, SPARSEVEC_SPIKE_PASS_STAGE_A = true or any Candidate A readiness PASS. A provider model echo, when present, remains governed by Slice 20 (mismatch is terminal). The model version/revision under test is recorded as an experiment observation only. This Spike model identity is not a production pin: production model/version/revision selection is DEFERRED TO LATER GOLD DATASET EVAL; no production model selection, revision pinning, route selection or Candidate A win is implied, and Candidates B/C are unaffected. Missing sparse results are not empty successful results.

## 9. Sparsevec Mapping Contract
Spike-only coordinate capacity D = 1,000,000,000 (v0.8.7 supported dimension ceiling), independent of model vocabulary size; use one D across all rows and queries. D is only this Spike's coordinate-capacity choice: it is not DashScope vocabulary-size Authority and not a future production sparse-dimension policy. If a verified provider namespace bound exceeds D or an observed key is outside [0,D), fail closed, no compression. If no authoritative bound exists, only observed in-range payload compatibility can be asserted. Map provider nonnegative key i injectively to SQL textual index i+1 (1-based), ascending. This rule preserves distinct keys regardless of unproven provider vocabulary-base semantics. Example synthetic keys 0:0.5 and 7:-0.25 map to {1:0.5,8:-0.25}/1000000000. Canonical text {index:value,...}/D is sufficient; use parameter binding, not interpolated SQL. Binary protocol is not required; if used it must match exact extension version's network-order dimension, nnz, reserved zero, zero-based int32 indices then float4 weights; cannot reuse text's 1-based indices in binary. Validate before removing exact ±0; reject all-zero or empty sparse input for retrieval even if DB supports an empty vector. Validate representability in float32, reject overflow and nonzero-underflow-to-zero; do not silently clamp. Compare readback to expected float32 weights with explicit round-trip semantics, exact coordinate/dimension equality. DB can reject malformed representation; no automatic remapping/retry. Production dimension/namespace policy is deferred.

## 10. PostgreSQL / pgvector Verification Contract
Use Slice 19 Stage A target PostgreSQL 18 and extension 0.8.7, current pinned image pgvector/pgvector:0.8.7-pg18-trixie@sha256:5895949dfcdf308eb0cd31c950c93c14895c77f33fbedfecf1fa511ab1d4bcd2. Actual server minor and installed extension version, image digest and role must be queried in evidence; config alone insufficient. Drift invalidates matching claims; no implicit version upgrade. Stage B/C separately NOT_EVALUATED until independently proven.
- Existing privileged bootstrap is only extension creator; app role must remain non-superuser/non-BYPASSRLS with no public schema CREATE or extension ownership. Use disposable temp tables/indexes and cleanup, no new production migration.
- Actual sparsevec(D) insert and readback of genuine normalized payload, including exact dimension and coordinates; validate typed columns and mismatched dimension insert/distance failure.
- Exact sparse inner product via <#> (negative inner product; mechanically verify the sign/direction and negate for descending similarity); dense cosine via <=> (1-distance for similarity). These are Spike verification metrics only, not V1 final production ranking policy. Independent numeric reference from float32 weights, bounded tolerance fixed before execution, exact order with deterministic declared tie handling, nonfinite rejected. Dense zero vector rejected for cosine; no silent substitution. Verify known analytical fixtures and actual linked provider sample. HNSW availability or operator-class choice must not be used to reverse-infer a production metric or ranking route.
- Exact storage/type max 16,000 nnz and D max 1e9; HNSW sparse index max 1,000 nnz at v0.8.7. Distinguish configured 020 cap from DB limits, use controlled synthetic boundary fixtures through separate DB probe for 16,000/16,001 and 1,000/1,001 and D/D+1; no full dense expansion. Do not demand provider generate boundary cases. Actual payload above 16,000 is incompatible. Above 1,000 but within storage limit: do not truncate, record exact-scan viability and index incompatibility separately.
- Verify target-version index/query behavior with disposable HNSW sparsevec_ip_ops, actual EXPLAIN evidence that controlled index path executes (test-session planner settings if needed, reset on cleanup), compare bounded results with exact reference, test limit rejection. Also attempt supported actual sample path, record any actual payload incompatibility. ANN is not guaranteed exact globally. No production index, parameter tuning, latency SLA or performance claim. An observed HNSW limit is an informative result, not a positive HNSW readiness claim; a bounded exact-search spike may pass if all required exact-path/actual-sample/fusion gates and explicit index-behavior observations pass. Unexpected behavior or missing required probe blocks the spike. Future production index selection is independent.

## 11. Fusion Prototype Boundary
Use actual paired dense/sparse scores for the same bounded candidate set, with stable sample IDs, both scores required, no unauthorized IDs or duplicates. Slice 21 SHALL use one predeclared, deterministic and independently recomputable minimal fusion mechanics solely to prove the mechanical dense/sparse paired-score loop. Plan AI 2 must freeze the exact reference formula and all constant-channel/tie/missing-score handling before execution; a simple formula such as per-channel normalization followed by fixed 0.5/0.5 weighting may be chosen as a non-normative Spike reference, but no formula or weight in this Spec is production ranking Authority. Record raw scores, transformed scores, combined scores, identities and independent reference calculation. No weight search, tuning, RRF, reranking, relevance benchmark or production ranking policy; no fallback to one channel if missing, and the Spike mechanics must not constrain later Gold Dataset route selection.

Deterministic numeric fixtures must be complemented by real Chinese professional-text retrieval proof. Use real, lawful and permitted-for-test Chinese professional text with explicit source provenance, at least one unrelated distractor, and query/expected technical match declared before execution; no post-hoc cherry-picking and no self-created clinical/professional Gold label. The corpus and query set must be large enough to form a non-degenerate retrieval test, but the concrete minimum corpus/query counts are delegated to Plan AI 2 based on executability rather than frozen here without upstream Authority. A real sample with genuine source text must remain distinguishable from synthetic numeric boundary tests. Record source version/ref, text fingerprint, query identity, returned ranked IDs and expected technical retrieval checks. Only text without family/minor/private data and with outbound permission may be used; if technical correctness cannot be demonstrated without professional judgement, obtain real approval or mark blocked. No Gold Dataset performance claims.

## 12. Persistence Boundary
No permanent schema, knowledge_embeddings, migration, materialized index, business row, runtime registry or production route. Temporary isolated table/index/session for probes only; drop/rollback and verify absence after success/failure. Evidence artifact is not embedding persistence. Retain only necessary permitted test evidence under repository artifact policy; no production records. A separate test-only SQL fixture is allowed, not a migration in the production migration chain.

## 13. Error / Fail-Closed Semantics / Edge, Failure, and Unknown States
Differentiate invalid/malformed/duplicate/out-of-range/unrepresentable/empty input, dimension or namespace mismatch, upstream/provider unavailable, permissions/version mismatch, failed DB read/write/query/index, nonfinite score, unexpected ranking, missing evidence and cleanup failure. Preserve 020's provider error classifications, no new transport retry. No partial success substitution, dummy embedding, retry with another model, silent dense-only fallback, guessed zero scores or automatic route changes. Explicit failure if observed incompatibility; BLOCKED if dependency/permission unavailable; NOT_EVALUATED if not run; UNKNOWN for inconclusive evidence. These are evidence outcomes, not new persistent domain enums.

## 14. Evidence Model
Each artifact records run ID/time, repo exact commit, upstream 019/020 heads/port provenance, stage, image digest, queried PG/extension versions, execution role category, model/config and echo availability, allowed source refs/fingerprints, provider request IDs and safe normalized payload evidence or access-controlled immutable reference, dimension/mapping policy, counts, limits, actual SQL results, readback comparison, distance/reference results and tolerances, EXPLAIN/index observations, fusion/sample IDs and results, negative cases, cleanup and limitations. Positive linked proof must connect real adapter outputs to actual target DB inserts/readbacks and scores, not independent unlinked fixtures. Controlled tests may replay verifiably captured real payload only with lineage; positive end-to-end gate requires actual provider-origin evidence for the precise query/document experiment through merged 020, not a fabricated fixture or undocumented HTTP request. No secrets or unapproved raw text, sanitize by default; provenance sufficient for independent reproduction. Record all attempted samples and failures. Production readiness is not derived here.

## 15. Readiness States
Orthogonal evidence flags, each defaults to NOT_EVALUATED:
- MAPPING_CONTRACT_VERIFIED: offline deterministic/negative mapping checks only.
- SPARSE_PAYLOAD_VERIFIED: actual candidate-specific dense+sparse provider call through 020 with configured model identity qwen3.7-text-embedding and the §8 role-specific text_type (document for corpus, query for retrieval queries), with normalized output and traceable configuration, validated sample identities, nonempty compatible values; not inferred from mocks or 020 generic adapter tests.
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
NS-02 dense dimension used as sparse bound, per-vector max+1, token hash, mixed namespace/model/versions, cross-role identity drift other than text_type, query embedded with text_type = document or document with text_type = query: reject. Configured model identity other than qwen3.7-text-embedding: INVALID EXPERIMENT CONFIG / BLOCKED, never Candidate A positive evidence.
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
- FR-005 [UPSTREAM: V1-C03, V1-C27, V1-X08; V1技术设计 release criteria] Real evidence is required for positive claims; failure/unknown/unverified states remain explicit and cannot be converted into readiness.
- FR-006 [UPSTREAM: 总产品需求 §31A; V1产品需求 product-frozen authority preamble/V1-C37; 总体技术架构 §§17.5,19A; V1技术设计 §13.1] Approved-for-test external content, professional approval and publication boundaries remain independent; Slice 21 creates no professional Gold label or approval.
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
| Chinese sample | real permitted source refs, predeclared technical expectations, unrelated distractor(s), actual result IDs and independently reproducible checks; Plan AI 2 freezes the concrete non-degenerate corpus/query minimum before execution |
| Fusion | paired actual scores, reference formula, ties and missing-score negatives |
| Boundary | path/diff, governance verification, no migration/production persistence or unauthorized data |

## 23. Deferred Responsibilities
Production retrieval/knowledge schema and lifecycle, lexical pg_jieba/RRF, reranker, approved professional Gold Dataset A/B/C evaluation, metrics/route and production model pinning, production dimension/namespace drift handling, performance/index strategy, context, AI runtime and family memory. No implicit authorizations.

## 24. Final Clarify Closeout
Resolved candidate direction: choose the smallest independent candidate-A sparsevec readiness Spike; include actual sparse payload mapping, dimension/nnz limits, real insert/read/distance, target-version index/query behavior, bounded fusion prototype and real Chinese professional-text retrieval correctness because formal Authority requires them. No permanent migration. Spike-only D = 1,000,000,000 does not assert provider vocabulary size and must not be generalized into production dimension policy. Observed max index never defines full vocabulary.

Q01 — CLOSED. Four controlling Docs were re-checked for Professional Authority, V1 scope, AI/RAG authority, Phase 3 sequence, sparsevec readiness, Chinese professional sample, external-provider/data boundaries, readiness truthfulness, production route/pinned-version rules and Gold Dataset ownership. Authority Conflict: NONE.

Q02 — CLOSED. Slice 19 remains the PostgreSQL 18 + pgvector dense-vector readiness owner only. Slice 20 remains the sole provider Port/Adapter owner for transport, raw response parsing, normalized dense/sparse output, sparse validation/canonical ordering, retry/timeout, provider error normalization, telemetry, cost, secret handling and provider-verification truth. Slice 21 consumes only Slice 20 public normalized output and owns only the DB-boundary sparsevec compatibility Spike described here. Upstream Ownership Conflict: NONE.

Q03 — CLOSED. Remote main, open PRs, relevant branches, production/test/script paths and ownership registry were checked for competing sparsevec/dense+sparse/fusion/retrieval/knowledge_embeddings/pg_jieba/embedding/021 work. No competing Slice 21 owner, branch, PR or production implementation was found. Competing Slice 21 Implementation: NONE.

Q04 — CLOSED. D/nnz/index mapping facts remain Spike contracts; fusion mechanics are deterministic/predeclared but the exact formula/weights are delegated to Plan AI 2 and are not production ranking Authority; Chinese professional sample correctness remains mandatory while exact corpus/query counts are delegated to Plan AI 2; inner product/<#> is a Spike verification metric with negative-inner-product direction independently checked, not V1 final ranking policy.

Future execution observations are evidence inputs, not open Specify/Clarify decisions: actual provider sparse support/envelope, configured model behavior, namespace bounds, observed nnz, real target PG minor and later managed-stage compatibility must be observed when authorized. If the merged Slice 20 public Port cannot express the required query/document experiment or its verified contract conflicts with this Authority, stop and return to upstream authority reconciliation rather than bypassing it.

Open Product Decisions at Plan AI 1 boundary: 0.
Open Architecture Decisions Required Before Plan AI 2: 0.
Implementation remains NOT AUTHORIZED until the §21 gate is satisfied.

## 25. Plan AI 1 Targeted Spec Correction Record
Bounded correction of the previously frozen Spec (head 688ad88ee4bbadce29a884f9e31d6e85bc8fee48, spec.md blob 952a64610f09997a86571e1e1f390eb5660170ca), now SUPERSEDED BY TARGETED SPEC CORRECTION; history is retained in Git. Only three Spec-level defects are closed:
- S21-SPEC-01 — CLOSED: §2 heading made compatible with the current Spec governance matcher for Upstream Traceability; Authority content unchanged; no validator change, whitelist or exemption.
- S21-SPEC-02 — CLOSED: §8 freezes document = document and query = query text_type with otherwise identical experiment identity, through the Slice 20 public Port only; Slice 20 production modification required: NO.
- S21-SPEC-03 — CLOSED: §8 freezes the Candidate A Spike configured model identity as qwen3.7-text-embedding; production pinned model/version/revision DEFERRED TO LATER GOLD DATASET EVAL.
All other frozen contracts (D, 1-based mapping, float32, nnz limits, PostgreSQL 18 / pgvector 0.8.7, <#> and dense cosine verification, linked real evidence, Chinese retrieval, fusion prototype, cleanup and all exclusions) are unchanged. Plan/Checklist/Tasks reconciliation belongs to Plan AI 2. Open Product Decisions: 0. Open Architecture Decisions Requiring Another Specify Cycle: 0. Developer AI: NOT AUTHORIZED.
