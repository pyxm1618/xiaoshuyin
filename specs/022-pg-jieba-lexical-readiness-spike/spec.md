# Slice 22 — pg_jieba Lexical Readiness Spike

> Feature: `022-pg-jieba-lexical-readiness-spike`
>
> Role boundary: Plan AI 1 — Specify + Clarify only.
>
> Status: FROZEN only after remote read-back proves this `spec.md` is the sole branch delta.

## 1. Purpose

Verify the smallest independent technical prerequisite for V1 RAG Candidate B: whether the target PostgreSQL 18 Stage A substrate can run `pg_jieba`, load a bounded Xiaoshuyin lexicon from authorized sources, tokenize real permitted Chinese text deterministically enough for lexical retrieval, and execute a reproducible lexical query in a disposable experiment.

This Slice produces truthful PASS / FAIL / BLOCKED / UNKNOWN / NOT_EVALUATED evidence. It does not build production RAG and does not select a production route.

## 2. Authority / Upstream Traceability

Controlling authority:

- `Docs/总产品需求.md`
- `Docs/V1产品需求.md`
- `Docs/总体技术架构.md`
- `Docs/V1技术设计.md`
- `specs/016-psychological-behavioral-intervention-contract-authority-reconciliation/spec.md`
- `specs/017-professional-knowledge-foundation/spec.md`
- `specs/019-professional-retrieval-pgvector-readiness/spec.md`
- `specs/020-embedding-provider-adapter-foundation/{spec,plan,checklist,tasks}.md`
- `specs/021-sparsevec-readiness-spike/{spec,plan,checklist,tasks}.md` from its current frozen planning branch until admitted to main.

Authority facts relevant to this Slice:

1. V1 RAG candidates remain A = dense+sparse, B = dense+pg_jieba lexical, C = dense-only.
2. Candidate B requires `pg_jieba + 小树荫专业词典` before later RRF and rerank evaluation.
3. `pg_textsearch` is DEFERRED and is not a V1 production candidate.
4. Candidate A sparsevec readiness and Candidate B lexical readiness are distinct substrate questions.
5. Final production route selection requires A/B/C comparison on the same Xiaoshuyin Gold Dataset and cannot be inferred from a technical Spike.
6. Professional Gold labels, clinical judgments, intervention authority and professional dictionary meaning cannot be invented by AI, code, tests or this Slice.

Authority Conflict: NONE.

## 3. Problem Statement

Current main proves PostgreSQL 18 + pgvector dense readiness through Slice 19. Slice 20 defines the embedding provider boundary but has not yet completed actual implementation. Slice 21 is frozen for Candidate A sparsevec readiness but is not yet implemented.

None of those facts proves Candidate B's lexical substrate.

The missing technical fact is narrower:

> On the exact Stage A PostgreSQL 18 target, can `pg_jieba` be made available, can an authorized bounded Xiaoshuyin lexicon be loaded without inventing professional authority, and can real permitted Chinese text be tokenized and queried reproducibly enough to establish Candidate B lexical substrate readiness?

Without that proof, starting A/B/C Gold Dataset evaluation would conflate missing infrastructure with retrieval quality.

## 4. In Scope

- Verify actual `pg_jieba` availability and compatibility on the exact Stage A PostgreSQL 18 target used by the project.
- Record exact PostgreSQL, `pg_jieba`, packaging/source and execution-environment identity used by the Spike.
- Verify real Chinese tokenization on a bounded permitted-for-test corpus.
- Verify loading and use of a bounded Xiaoshuyin test lexicon whose entries have explicit authority/provenance.
- Verify that predeclared lexicon terms affect tokenization/query behavior in the intended technical manner.
- Execute a bounded disposable lexical retrieval experiment with predeclared query-to-document technical expectations and unrelated distractors.
- Record deterministic/reproducible positive, negative, blocked and inconclusive evidence.
- Verify cleanup and absence of lasting business or production retrieval state.

## 5. Explicit Out of Scope

This Slice SHALL NOT:

- implement RAG Candidate B end-to-end;
- call or modify Slice 20 embedding provider behavior;
- depend on Slice 21 PASS;
- implement dense retrieval, sparsevec, dense+sparse fusion, RRF, reranking or qwen3-rerank;
- execute A/B/C Gold Dataset evaluation or create Gold labels/rubrics;
- choose a production RAG route, embedding version, reranker version, weights, ranking policy or `rag_route_version`;
- create production knowledge ingestion, chunking, embedding persistence, lexical persistence, retrieval APIs or permanent retrieval tables/indexes;
- create or approve a production professional dictionary;
- invent professional terms, synonyms, clinical interpretations, relevance judgments, intervention rules or safety rules;
- add `pg_textsearch` as an alternative;
- build Context Builder, AI Task Runtime, TaskModelRegistry, Promptfoo framework, Family Memory, a generic retrieval framework, generic vector abstraction, provider framework or multi-provider orchestration;
- alter existing Slice 16–21 authority artifacts.

## 6. Upstream Dependencies

### Planning dependencies

Specify and Plan may proceed now using the current four Authority Docs plus the frozen/admitted Slice 16–21 artifacts.

Slice 20 implementation completion is NOT required to Specify or Plan this Slice.

Slice 21 execution result is NOT required to Specify or Plan this Slice.

### Implementation dependencies

Before Developer AI may execute this Spike:

- Slice 22 Spec, Plan, Checklist and Tasks must be frozen and Audit 1 must PASS.
- Developer must reconcile to current main with behind = 0.
- Slice 19 PostgreSQL 18 Stage A baseline must remain available and compatible.
- A real disposable Stage A PostgreSQL 18 environment capable of testing the intended `pg_jieba` package/build must be available.
- Every test lexicon entry and source text must have an explicit permitted source and provenance under §8.
- Any required implementation-ownership or governance prerequisite must be separately admitted and independently audited before implementation; no self-authorizing governance delta is allowed.

Slice 20 implementation is not an implementation dependency because this Slice does not consume embeddings.

Slice 21 is not an implementation dependency because Candidate B lexical substrate can be tested independently of Candidate A sparsevec outcome.

### Slice 21 result matrix

- IF Slice 21 PASS: Slice 22 remains independently required for Candidate B; neither result selects the production route.
- IF Slice 21 FAIL: Candidate A may become ineligible on the tested target, but Slice 22 remains valid because B and C are explicitly preserved alternatives.
- IF Slice 21 BLOCKED / UNKNOWN / NOT_EVALUATED: Slice 22 may still execute if its own dependencies are satisfied; full A/B/C comparative evaluation remains unable to claim complete candidate coverage.
- No Slice 21 outcome authorizes Gold Dataset evaluation, reranker approval or production route selection by itself.

## 7. Domain / Technical Invariants

1. This is a technical readiness Spike, not professional-content approval.
2. Exact environment identity is part of the evidence; success on an unbound environment does not establish readiness.
3. Real `pg_jieba` behavior must be observed. Mock tokenization cannot produce a positive readiness result.
4. Lexicon entries must be predeclared before the retrieval run and must have explicit provenance.
5. No term may be added because the AI believes it is professionally important.
6. Query/document technical expectations must be frozen before execution; no post-hoc relabeling after observing results.
7. Missing, blocked or inconclusive observations never become PASS.
8. No silent fallback to another tokenizer, extension, language model or search engine.
9. No production route, score threshold, ranking weight or relevance metric is inferred from this Spike.
10. No lasting business data, production knowledge state or production retrieval index is created.
11. `pg_textsearch` remains outside V1 candidate scope.
12. Professional Authority and technical retrieval evidence remain separate.

## 8. Authorized Test Lexicon and Corpus Contract

The bounded test lexicon SHALL contain only entries whose text and reason for inclusion can be traced to one of the following:

1. exact terminology already present in the current four formal Authority Docs where inclusion does not create a new professional judgment; or
2. an existing professional content artifact that already carries valid approval/provenance for the intended test use.

The Slice SHALL NOT author the production Xiaoshuyin professional dictionary.

For each lexicon entry, evidence must record:

- exact term;
- source identity/version;
- source reference;
- whether it is product/domain terminology or approved professional content;
- test-use permission/provenance;
- immutable fingerprint of the frozen test lexicon.

If a required test term would need new clinical/professional judgment, that term is prohibited unless real Professional Authority exists. If a non-degenerate lexicon test cannot be formed without such judgment, the affected evidence state is BLOCKED.

The retrieval corpus must use real, lawful, permitted-for-test Chinese text without family/minor/private data. Technical expected matches may demonstrate literal/terminological retrieval correctness, but SHALL NOT be represented as Professional Gold labels or clinical relevance judgments.

## 9. Functional Requirements

- FR-001: The Spike SHALL verify actual `pg_jieba` compatibility on the exact target PostgreSQL 18 Stage A environment and record version/source identity.
- FR-002: The Spike SHALL demonstrate actual Chinese tokenization without mock substitution.
- FR-003: The Spike SHALL load a frozen bounded Xiaoshuyin test lexicon satisfying §8 and prove the loaded lexicon is the one used by the test.
- FR-004: The Spike SHALL include at least one predeclared term whose tokenization/query behavior differentiates lexicon-loaded behavior from the applicable baseline.
- FR-005: The Spike SHALL execute a disposable lexical retrieval query over a non-degenerate permitted Chinese corpus with predeclared technical expected match(es) and unrelated distractor(s).
- FR-006: The Spike SHALL record raw observable token/query outputs sufficient for independent reproduction, subject to source rights and privacy constraints.
- FR-007: The Spike SHALL distinguish extension availability, lexicon-load verification, tokenization verification and lexical-query verification as separate evidence predicates.
- FR-008: The aggregate positive result SHALL require all mandatory predicates to be positive on one exact head/environment/run family.
- FR-009: The Spike SHALL preserve explicit FAIL / BLOCKED / UNKNOWN / NOT_EVALUATED outcomes and reasons.
- FR-010: The Spike SHALL verify cleanup and absence of lasting production/business retrieval state.
- FR-011: The Spike SHALL not consume or alter embedding, sparsevec, fusion, RRF, rerank or Gold Dataset authority.
- FR-012: The Spike SHALL not create professional approval, production dictionary authority or production RAG readiness.

## 10. Acceptance Scenarios

- AS-01: Exact PostgreSQL 18 target identity and actual `pg_jieba` identity are observed and reproducibly bound to evidence.
- AS-02: Real permitted Chinese text is tokenized by actual `pg_jieba`; repeated execution under the same identity produces the declared technical behavior.
- AS-03: A frozen authorized test lexicon is loaded; its fingerprint and provenance are recorded; a predeclared lexicon-sensitive term demonstrates the intended observable tokenization effect.
- AS-04: A bounded lexical query over the frozen corpus returns the predeclared technical target(s) against unrelated distractor(s) using only the lexical substrate under test.
- AS-05: Negative fixtures prove missing/invalid lexicon, unsupported term assumptions, malformed/unavailable extension state and query failure do not become readiness.
- AS-06: Evidence distinguishes environment/package compatibility from retrieval correctness and contains no Gold Dataset or production-route claim.
- AS-07: All disposable test state is removed or proven isolated after success and injected failure.
- AS-08: Re-run on the same frozen identities produces reproducible evidence without secret, private-family or unauthorized professional-content leakage.

## 11. Negative / Failure Scenarios

- NS-01: `pg_jieba` cannot install/load/run on the exact target because of observed incompatibility -> FAIL for the applicable target; do not substitute another tokenizer.
- NS-02: Required package/source cannot currently be obtained or environment access is unavailable without proving incompatibility -> BLOCKED.
- NS-03: Version or environment identity cannot be established -> UNKNOWN or BLOCKED; never PASS.
- NS-04: Lexicon entry lacks permitted provenance or requires new professional judgment -> reject the entry; if the required test cannot continue, BLOCKED.
- NS-05: Lexicon is edited after seeing retrieval results -> evidence invalid; rerun from a newly frozen identity.
- NS-06: Query/document expected match is changed post-hoc -> evidence invalid.
- NS-07: Mock tokenizer, synthetic fake extension success or another search engine is used -> no positive readiness.
- NS-08: Tokenization works but lexicon load cannot be proven -> aggregate result is not PASS.
- NS-09: Lexicon loads but bounded lexical query cannot demonstrate the predeclared technical behavior -> FAIL or UNKNOWN according to observed evidence.
- NS-10: Any attempt is made to add RRF, reranker, dense scoring, sparsevec fusion, Gold labels or production tuning -> STOP as scope violation.
- NS-11: Persistent production retrieval schema/index/business rows are required -> STOP and return to planning/authority review.
- NS-12: Professional Authority is inferred from documentation, schema, tests, code flags or AI judgment -> STOP.

## 12. Planning Gate

Plan AI 2 may begin when:

- this Spec is frozen on an exact branch head and blob;
- current main and relevant 019/020/021 states have been re-read;
- Authority Conflict remains NONE;
- Open Product Decisions = 0;
- Open Architecture Decisions Required Before Plan AI 2 = 0.

Planning may proceed before Slice 20 or Slice 21 development completion because this Slice's What/Why/Boundary is independently determinable.

Plan AI 2 must not widen the Slice into Candidate B end-to-end RAG.

## 13. Implementation Gate

Developer AI is authorized only after all of the following are true:

1. Plan/Checklist/Tasks exist and Audit 1 = FINAL PASS.
2. Current-main reconciliation is complete and exact implementation head starts from a current, auditable base.
3. Slice 19 Stage A PostgreSQL 18 baseline is available.
4. The intended `pg_jieba` package/build and exact target environment can be tested without falsifying evidence.
5. The bounded lexicon and corpus satisfy §8 before outcome observation.
6. Any governance/ownership prerequisite identified by Plan AI 2 has been independently audited and merged before product/test implementation requiring it.
7. No competing Slice 22 implementation exists.

Not implementation blockers for this Slice:

- Slice 20 implementation not yet merged;
- Slice 21 PASS/FAIL/BLOCKED/UNKNOWN, provided Slice 22's own dependencies are satisfied.

## 14. Production Gate

This Slice SHALL NOT mark production lexical retrieval READY.

Before RAG Candidate B can be considered for production, later work must independently satisfy at least:

- production professional knowledge approval/publication requirements;
- production lexical dictionary authority and lifecycle;
- Candidate B complete dense + lexical + RRF + rerank implementation/evaluation;
- qwen3-rerank evaluation;
- the same Xiaoshuyin Gold Dataset comparison across A/B/C, subject to candidate availability and truthful failed/blocked states;
- approved and pinned `rag_route_version`, embedding version and reranker version;
- target deployment-stage PostgreSQL/`pg_jieba` compatibility;
- authorization/hard-filter ordering and all formal release gates.

A Slice 22 PASS is only Candidate B lexical substrate evidence.

## 15. Evidence Requirements

Positive or negative Spike evidence must bind:

- exact repository head;
- base main / merge base;
- changed-file scope;
- exact PostgreSQL version;
- exact `pg_jieba` package/build/source identity;
- target stage/environment identity;
- execution role/security facts relevant to the test;
- frozen test lexicon identity/fingerprint and per-entry provenance;
- frozen corpus/query/expected-technical-match identity and provenance;
- observed tokenization outputs;
- observed lexicon-sensitive behavior;
- observed lexical query results;
- all attempted failure/blocked cases;
- cleanup/isolation proof;
- explicit lower-level evidence predicates;
- aggregate state and reason;
- limitations.

Evidence must not contain credentials, private family/minor data, unapproved restricted professional text or fabricated Gold labels.

## 16. Open Questions

Open Product Decisions: NONE.

Open Architecture Decisions Required Before Plan AI 2: NONE.

Execution-time observations that do not block Specify/Plan:

- actual `pg_jieba` PG18 compatibility;
- exact available package/build identity;
- exact observed tokenizer behavior;
- exact observed lexical query behavior.

Those are the subject of the Spike and must be reported as evidence rather than guessed during planning.

## 17. STOP Conditions

STOP and do not widen or reinterpret this Spec if any of the following occurs:

- the four controlling Authority Docs conflict on Candidate B or `pg_jieba`;
- a real professional judgment is required to create the lexicon/corpus expectation and no valid Professional Authority exists;
- implementation requires modifying existing Slice 16–21 authority;
- implementation requires a second embedding/provider path;
- implementation requires RRF, reranker, dense/sparse fusion, Gold Dataset evaluation or production route selection to prove this narrower substrate;
- a different tokenizer/search engine must be substituted for `pg_jieba`;
- a permanent production retrieval schema/index is required;
- governance would need a broad or speculative ownership exception;
- evidence cannot distinguish FAIL from BLOCKED/UNKNOWN;
- the exact head/environment/provenance cannot be mechanically bound.

## 18. Selection-Gate Clarification

The user's Selection Candidate A (`pg_jieba / lexical retrieval readiness`) corresponds to the substrate for formal V1 RAG Candidate B. These names SHALL NOT be conflated.

Why this is the next minimum Slice:

- Slice 19 already proves the shared PostgreSQL 18 + pgvector dense substrate.
- Slice 20 isolates provider/embedding transport but is not required to prove lexical substrate.
- Slice 21 isolates RAG Candidate A sparsevec readiness and deliberately defers pg_jieba.
- Formal A/B/C evaluation cannot fairly compare Candidate B until its required lexical substrate exists.
- Reranker/fusion production evaluation and Context Builder are downstream of retrieval substrate and route-evaluation authority.
- This Slice can return a truthful negative result without forcing a route choice.

Why the other candidates are not selected now:

- A/B/C Gold Dataset evaluation: too early; Candidate A sparse readiness is not yet executed, Candidate B lexical substrate is unverified, and Professional Gold labels cannot be invented.
- reranker/fusion evaluation readiness: downstream and cross-candidate; doing it now would mix substrate readiness with route-quality evaluation.
- Context Builder: too early because Professional RAG route/context authority is not yet selected or production-ready.
- AI Task Runtime / TaskModelRegistry / Promptfoo: Phase 3 capabilities, but not the smallest missing prerequisite for the currently active Professional RAG dependency chain.

Plan AI 1 stops after this Spec is frozen. No Plan, Checklist, Tasks, Audit 1, development, Audit 2 or merge is authorized by this artifact.
