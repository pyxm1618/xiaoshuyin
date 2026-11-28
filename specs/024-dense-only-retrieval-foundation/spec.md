# Slice 24 — Dense-only Candidate C Retrieval Foundation

**Feature Directory**: `specs/024-dense-only-retrieval-foundation`
**Created**: 2026-11-28
**Status**: FROZEN SPEC — Planning AI 1 selection / specify / clarify boundary
**V1 Phase**: Phase 3 — Professional Knowledge and AI
**Reference main (observation, not a future execution pin)**: `80cf8d267ce6b8b771635f49e5fd0f68b5694a89`

This downstream projection does not change any of the four Authority Docs, existing frozen slice semantics, professional/Legal Authority, or the V1 A/B/C candidate definition. It authorizes preparation of Plan / Checklist / Tasks by Planning AI 2, not production implementation, production data processing, route selection, or merge.

## Upstream Traceability

| Upstream | Authority source | Binding for this slice |
|---|---|---|
| Professional assets, model replaceability, approval boundary | Docs/总产品需求.md §§25, 28, 31A, 32 | Maintain versioned knowledge; derived embeddings never become professional truth; no manufactured approval or model lock-in. |
| V1-C03, V1-C27 | Docs/V1产品需求.md §24; Docs/V1技术设计.md §§13, 36 | Explicit unavailable, invalid, stale, empty and failure outcomes; no synthetic success. |
| V1-C20, V1-C21, V1-C39, V1-C41 | Docs/V1产品需求.md §§17.3, 18, 19A, 24; Docs/V1技术设计.md §§9, 9.1, 14A.1 | Current actor, Family, Case, visibility, purpose, Consent and external processing boundaries before retrieval/egress. |
| V1-C24, V1-C25, V1-C37, V1-X01 | Docs/V1产品需求.md §§2.7A, 19, 20, 24, 26; Docs/V1技术设计.md §§12.8, 13.1–13.4, 32.6 | AI and RAG never override Safety, Intervention, published/current professional rules or other deterministic gates. |
| V1-C34, V1-X14 | Docs/V1产品需求.md professional reviewer blocking dependencies, §§24, 26; Docs/总体技术架构.md §19A | Staff capability, professional qualification, exact approval, publication and test evidence are distinct. |
| V1-C28 | Docs/V1产品需求.md §24; Docs/V1技术设计.md §§7.0, 8 | Retry/concurrency cannot produce contradictory derived records; use existing authority where applicable. |
| V1-X11 | Docs/V1产品需求.md §26; Docs/V1技术设计.md §§20, 37 | Provider identity, cost/usage when available, latency and uncertainty recorded truthfully. |
| Professional RAG | Docs/总体技术架构.md §§11.1–11.5; Docs/V1技术设计.md §§7.5, 13.1–13.6 | Candidate C is required dense-only baseline: qwen3.7 dense → pgvector → qwen3-rerank. Knowledge embeddings, hard filters and provenance are explicit. |
| DB and migration | Docs/V1技术设计.md §§4.0A, 4.2, 7.0, 9.1, 13.6 | PostgreSQL 18 / pgvector, reviewed forward migrations, Drizzle/node-postgres, least privilege, correctness before optional index optimization. |
| Downstream evaluation / release | Docs/总体技术架构.md §§11, 17.5, 19A; Docs/V1技术设计.md §§14A, 15, 20, 32.6, 32.13, 38 Phase 3, 40 | Common approved Gold Dataset compares A/B/C, pinned production model/route, stage-specific readiness and external data approval later. |

Authority observation: the four exact-main blobs respectively are `97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29` (总产品需求), `379cb8cfb377924cd21ccfe55baa5aecdf207f5e` (V1产品需求), `f2e1589e3f87d1970f5ce342887fc7d3bf95dee4` (总体技术架构), `2885694c1833c9643797c0947a1b7e581ae2fb05` (V1技术设计). Governance: AGENTS.md, .specify/README.md, constitution, spec-template, implementation-ownership registry and validators. Authority wins over historical slice observations, which must be refreshed at development start.

## Selection Gate and Current Reality

At reference main, CI run 46103105108 and Spec Governance run 46103105087 both succeeded on push of exact main. These are not substitute independent Audit 2 verdicts.

- 016 Intervention contract: merged PR #57 and subsequent remediation; reuse exact Intervention definition authority, not create a new one.
- 017 Professional Knowledge: merged PR #58; current-main spec blob a4603885e5f54365e926a4705262c170a7ee47bd. Domain `packages/domain/src/professional-knowledge.ts` evaluates eligibility; consumption service `apps/server/api/src/services/professional-knowledge-consumption.ts` composes authorization/RLS/Compliance/Safety and exact version resolution; repository and migrations 025/026/027/028/031 own existing identity/lifecycle. No chunk/embedding/retrieval owner in that slice. Current production approval resolver is UNAVAILABLE (APPROVED PROFESSIONAL REVIEWER — UNASSIGNED); Scene v1 knowledge refs empty in `packages/scenes/digital-use/professional-knowledge-binding.ts`. Do not infer usable production corpus from merged code.
- 018 Gold Dataset: reconciled planning branch `plan/018-professional-retrieval-gold-dataset-authority-reconciliation` at 575495386d52f58a690155f103107ae0afa9bd6d, spec blob 1d18fa97a29b3a26d3ff9b0da8dbaf4007649af3. T1801 development gate BLOCKED by empty approved corpus, unavailable real reviewer/qualification/approval (and any unproven predicates); no RELEASED production Gold Dataset. Evaluation authority remains there, not re-created here.
- 019 dense substrate: PR #110 and #111 merged; PG18 + pgvector 0.8.7 Stage A pinned image, real vector probe and G9/G11. Test/probe-only vector objects are not production Knowledge storage. Reuse existing extension bootstrap; no extension installation by runtime role.
- 020 Embedding Port: main implementation PR #142 and remediation #153 merged. Original Audit 2 FAIL followed by independent remediation PASS at ff89fc97a4dd13b441a7ae474420674f82050f2f (https://github.com/pyxm1618/xiaoshuyin/pull/153#issuecomment-7206763327). Main tasks T011 remains unchecked; live coverage not established by this observation. Public entry `apps/server/api/src/ai/embedding/index.ts`; use normalized port, dense mode, existing controlled query/document role config; no private transport import, provider reimplementation or persistence inside 020.
- 021 Sparsevec: PR #168 OPEN at 80cd3466615a258a7517a48ecb411ce0b45a2494, admitted spec/plan via #165/#167. Branch evidence `tests/evidence/sparsevec-readiness-stage-a.json` blob 2deee1b12c3bedd69ac13062c30f5d5ae8161507: synthetic mapping/DB/distance verified, real sparse payload BLOCKED:SECRET_MISSING, fusion NOT_EVALUATED, aggregate BLOCKED. No Candidate A elimination and no B/C dependency.
- 022 lexical spike: PR #149 merged, reported Stage A PG_JIEBA_COMPATIBILITY, LEXICON_LOAD, TOKENIZATION, LEXICAL_QUERY, CLEANUP PASS. This is lexical feasibility, not candidate B full chain or production selection; no dependency for C.
- 023 Reranker Port: spec/plan admitted (#150/#154), ownership #151 merged. Implementation branch `feat/023-reranker-provider-adapter-foundation` head e7f9432ff8b2e2fcde0624594bccfb91a2e80746, ahead 32 / behind 0, 14 paths restricted to its own seam/tests/binding; exact push CI 46115333329 and governance 46115333363 success. No open implementation PR and no final independent exact-head Audit 2 PASS independently established in this observation. Frozen spec blob 4354ecac585d3d6c675c629d5304faf9422cf5b1 and normalized contract are sufficient planning inputs. Reuse its public entry after audited merge; its rank is technical signal only.
- Main tree, open PRs and 024 branch search show no existing Slice 24 or Candidate C implementation in the identified retrieval seams. Open unrelated remediation PRs #159/#160/#161/#162/#164 are not authorized work for this slice. No main 024 production path ownership exists. Re-read affected paths, governance and competing work before development.

Selection criterion: smallest naturally complete next technical capability with explicit Authority, independently verifiable value, current/frozen dependencies and no duplicate ownership.

| Candidate | Decision and reason |
|---|---|
| Dense-only Candidate C | SELECT. Authority-required comparison baseline; missing persistence, prefilter + dense query + rerank composition. Reusable dense substrate for later A/B. |
| Knowledge embeddings persistence/lifecycle alone | INCLUDE minimum derived persistence inside C. A standalone store with no actual retrieval consumer would separate one natural responsibility; no separate knowledge lifecycle engine. |
| Professional hard filter alone | INCLUDE only retrieval composition/allow-set constraint. Existing 017 owns rules; a standalone new engine duplicates authority. |
| Hybrid / RRF | DEFER. A/B-specific combination, not necessary for C; A prerequisite remains blocked and B lexical result is only a spike. |
| A/B/C formal quality evaluation | DEFER/BLOCKED for professional quality. Requires released 018 benchmark and executable comparable candidates; never fabricate labels or thresholds. |
| Full Professional Retrieval Runtime | DEFER. Route registration/selection, production activation and full application service are broader than one technical candidate. |
| Context Builder | DEFER. Consumer of eligible Top Context; separate responsibilities per §14A. |
| AI Task Runtime | DEFER. Downstream bounded AI orchestration per §15; no retrieval foundation shortcut. |

## Purpose and Scope

One goal: establish a bounded, reusable **persisted dense retrieval + reranking technical foundation** for Candidate C, from exact versioned knowledge-derived chunks and embeddings, through pre-ranking eligibility, actual pgvector dense retrieval and the normalized reranker, to bounded traceable Top Context candidates. It is not a temporary vector readiness spike, not a production RAG route, and not a professional quality claim.

### In Scope

1. Minimal deterministic/reproducible source-bound chunk representation; minimal durable `knowledge_embeddings` projection and controlled write/read seam, referencing exact Slice 17 version/content identity. Only the persistence necessary to support real retrieval, not a separate CMS or chunking platform.
2. Exact embedding compatibility/identity and retrieval suppression upon upstream lifecycle/approval/applicability changes; no new knowledge lifecycle truth. Reuse Slice 20 public Embedding Provider Port with document/query roles, never provider-specific protocol or raw responses.
3. Retrieval-specific pre-ranking admissible corpus formation: compose existing Authorization/RLS, Consent/Compliance/Safety, 017 eligibility, Scene and 016 Intervention authority; enforce exact version/chunk/embedding compatibility. No duplicate rules.
4. Actual PG18/pgvector dense distance retrieval over the eligible set, bounded top-K, stable candidate identity and deterministic tie contract. Invoke existing Slice 23 public Reranker Port only for permitted candidates, then bounded Top Context with source/version/score provenance.
5. Stage A tests: offline mechanism, real DB migration/storage/query/negative scope, controlled real embedding/reranker and complete C chain using approved-for-test nonpersonal samples. Separate technical evidence states and explicit production non-readiness.
6. No production API/route or automatic invocation; callable bounded internal foundation and controlled test/verification entry only.

### Out of Scope

A/B full implementation; sparsevec, lexical/pg_jieba, RRF/fusion; pg_textsearch (DEFERRED); Gold Dataset creation/release, professional relevance judgment/labels/rubric/thresholds and A/B/C formal evaluation; production rag_route_version, embedding_route_version, rerank_route_version registration/selection/approval or production model pin; Context Builder, AI Task Runtime, TaskModelRegistry, Vercel AI SDK generation, Promptfoo evaluation framework, Family Memory, user-facing endpoint, autonomous decisions, generic retrieval/vector/model gateway, multi-vendor platform, new independent DB/search engine, V2–V5, production enablement, unrelated refactor or edits to existing Authority.

### Non-Goals

No automatic ingestion scheduler, crawling, OCR, CMS, chunk optimization framework, generic indexing/version management, HNSW/IVFFlat tuning, re-embedding fleet orchestration, async rebuild worker, production migration rollout, broad ownership change, professional reviewer/qualification/approval registry, role or consent-purpose invention. Future A/B can reuse the dense seam without forcing a general-purpose framework today.

## Ownership and Key Entities

| Owner | Truth retained |
|---|---|
| Slice 17 / existing knowledge and approval owners | knowledge_id, version identity, immutable content/source-set hashes and metadata, publication/review/validity/effective window, review/approval/qualification, eligibility and dependency impact. |
| Scene package / Slice 16 | exact Scene package binding and Intervention identity/validity, no RAG authority. |
| Existing authorization, consent, RLS, compliance, safety | verified actor/scope/purpose, current gates, external processing decision, no bypass. |
| Slice 19 | PostgreSQL/pgvector capability and extension bootstrap, stage-specific readiness. |
| Slice 20 / 23 | normalized provider request/response, transport, configuration, model provenance, retry/error/telemetry and provider evidence. |
| Slice 18 | Gold Dataset truth, coverage and label release. |
| Slice 24 | minimal derived chunks/embeddings, compatible corpus admission, bounded dense/rerank composition, candidate identities and technical evidence. |

Logical entities (not SQL/schema prescriptions):
- exact KnowledgeVersion reference, source-set/content hash, deterministic chunk identity and exact chunk text hash with source locator or reconstructible provenance; chunk is a projection of approved source text, not a rewritten professional fact.
- derived KnowledgeEmbedding: exact version/chunk identity, embedding model/configuration identity, dimension, document role, validated dense vector, necessary generation provenance; unique logical identity for a compatible representation.
- verified retrieval context (internal server-owned, not caller authority): actor/purpose/Case/Family/target, Scene/version/stage/age/applicability/exclusions/risk/locale and relevant current gate/evidence references; separate controlled test context only in tests.
- eligible candidate reference and result: stable candidate/chunk identity, exact version/content/source references, dense score/distance and rerank score/rank, bounded order, relevant technical provenance.
- scoped technical evidence: execution identity, stage, corpus/query provenance, environment/provider/configuration observations and lower/aggregate results; not a business entity or approval artifact.

## Core Contracts and Invariants

### Knowledge Embedding Persistence / Lifecycle

Use one minimal durable projection of exact immutable Knowledge version/chunk material. The plan may choose a single table or minimal supporting chunk representation if justified by actual schema and requirements; do not preselect physical columns, SQL, migration number or indexing algorithm. No new second content store with independent authority. Chunk text, if persisted, must be exact derived material and bound to its source/hash; never independently edit or summarize as professional truth. No orphan vector or implicit current/latest binding. The writer must validate source identity, current approved/published/version state and authorized processing/egress before making material available; revalidate exact source and eligibility at persistence/consumption boundaries. Existing 017 approval/Scene owner must authorize the source, not the embedding writer. Controlled test-only synthetic records and explicit injected test authority are isolated and cannot be invoked from production composition.

Successful writes must survive restart/new transaction and be usable by retrieval with exact document role and compatible query config. Retry/replay of the same logical projection does not multiply rows or silently overwrite different bytes/provenance; conflicting material or stale source rejects or requires a new distinct compatible projection under existing version semantics. No partial failed batch may be represented as a complete eligible corpus/ready projection. No family query or query embedding persisted as knowledge. No copy of approval flags that acts as truth. No requirement to eagerly delete all old vectors: current joins/resolution must suppress stale, withdrawn, superseded, retired, expired, invalid, needs-review or no longer bound knowledge immediately at authoritative read time; historical retention/erasure remains subject to existing rights/retention policy. No re-embedding scheduler is required.

Only query and document embeddings from compatible provider/model/configuration identity, dimension and designated roles may be compared. Reject wrong dimension, non-finite/invalid values and invalid metric domain, wrong source hashes, unknown/unreconcilable identity, duplicate/conflicting projection and stale generation. No zero padding/truncation, mixing revisions or silent fallback. Record configured vs observed model identity separately; UNKNOWN provider revision must remain UNKNOWN and must not imply immutable production pin. Controlled live technical experiment can use the same explicit configuration and attempt lineage without claiming production revision proof, where upstream Port contracts permit. Do not alter provider contract to achieve PASS.

### Hard Filter / Retrieval Composition

Logical order mandated by §13.4:
Authorization + applicable Consent/Compliance/Safety → Published/current/valid/effective → Scenario/exact Scene binding → Stage → Age/Applicability (incl. exclusions, locale, risk, applicable Intervention) → exact Version/chunk/embedding compatibility → eligible set → dense distance/order/top-K → reranker → bounded Top Context.

Reuse existing deterministic eligibility evaluator, real approval/Scene/intervention resolution, RLS transaction and verified facts ownership. No caller-controlled allow list, age band, approval status, scenario binding, purpose or synthetic production resolver. The current 017 service resolves one requested version, so 024 must establish pre-ranking eligible candidate selection, not assert 017 already does retrieval. Database coarse predicates may narrow the set but cannot replace domain evaluation; mandatory rules must be applied before a version enters the ranking relation. No global search then postfilter, no ineligible candidate influencing nearest-neighbor ordering/top-K, no invalid candidate ID/text sent to reranker or included in response. An eligibility dependency unavailable is distinct from known ineligibility and true empty set. If a required authority cannot be resolved reliably, block the affected retrieval; no broadened fallback.

RLS and explicit application authorization remain independent. Use least privilege, no BYPASSRLS/runtime table owner, approved purpose, parameterized transaction-bound context and fail-closed grants/policies for the new projection. Unauthorized/nonexistent/protected identities remain non-enumerating. No new public route. Internal scores and candidate IDs do not confer permission. At persistence, query/ranking, provider dispatch and result release, consume current coherent authorized identity; detect relevant lifecycle, binding, revocation or context drift and discard/reject stale results, never reuse a previously allowed set as continuing authorization. Revalidate before dispatch and before result consumption; do not claim an already transmitted external request can be recalled retroactively. Plan selects bounded concurrency/snapshot mechanism, respecting existing transaction and provider budgets; no independent lifecycle framework.

### Dense Query and Rerank

Candidate C uses qwen3.7-text-embedding dense mode and qwen3-rerank candidate as specified, with explicit controlled experimental config, not production pin. Use actual PG18 pgvector distance on admitted candidates. Plan chooses metric compatible with Port/model and PG target, deterministic tie order, bounded top-K/output limits and verification tolerance before execution; no relevance threshold or gold label invented. Missing compatible vectors or incomplete required corpus is an explicit availability/coverage condition, not silently treated as empty or as fully ready. An empty eligible set with all required gates/corpus resolution complete is a truthful empty result; do not call reranker on zero candidates.

Reranker receives only eligible bounded candidate IDs + exact allowed texts and query under applicable external processing permission, via public 023 port; use explicit instruction/config and bounded limits per 023 contract. Verify result completeness/identity, no foreign/duplicate IDs, invalid score/rank or unauthorized candidate. No second provider protocol, ranking authority, score fallback or alternate model. Return ordered subset of the same admitted identities, exact source/version references and necessary score/configuration provenance. No AI-generated final recommendation, business write, Case/Plan/Intervention activation or response release. A technical result is not professional relevance or final Top Context for production; Context Builder consumes only when later authorized.

### Data / security / evidence boundaries

No real Family, minor, sensitive, private or unapproved text in live technical verification; use synthetic nonpersonal and lawfully permitted source samples. Approved-for-test source use is not professional approval. Real professional Knowledge use requires its existing exact approval and processing rights; production external query processing additionally requires all applicable Consent, Compliance, Safety and external_ai_data_policy_version. No credentials in repository, logs, artifacts or call arguments; reuse approved config/egress. No raw provider payload, query text, vectors or professional/private text in ordinary logs/telemetry; sanitized minimum evidence and fingerprints, only specifically permitted external artifact when needed for independent recomputation, never secrets. Reuse existing request/cost records, observed timing and UNKNOWN for unavailable usage/cost. No new logging/registry platform.

## Edge, Failure, and Unknown States

Separate request validity, eligibility/authority, persistence/compatibility, DB query, embedding and reranker failures, and technical evidence status. Known denied/ineligible is not unavailable; true empty is not blocked; unknown metadata does not pass. Missing credential/config/permission or dependency is BLOCKED; not attempted NOT_EVALUATED; inconclusive identity/evidence UNKNOWN or NOT_VERIFIED; observed incompatible/incorrect behavior FAIL. Successful lower mechanics do not promote aggregate provider or C readiness. No partial result after required provider/DB/identity failure, no bypass of Safety/Consent/RLS, no fallback to hybrid/lexical/dense without required reranker, no unauthorized details. Formal production route approval is NOT AUTHORIZED independently of any technical status. Existing upstream error semantics retained; names of internal result types left to Plan.

## Requirements

- **FR-001** [UPSTREAM: V1-C24; V1技术设计 §§7.5,13.1–13.4] SHALL deliver one bounded dense-only candidate foundation from durable source-bound vectors to reranked candidate output, without production route.
- **FR-002** [UPSTREAM: V1-X01; §7.5/13.1] SHALL bind every chunk/vector to exact 017 version, content/source identity and chunk provenance; no independent editable knowledge authority.
- **FR-003** [UPSTREAM: V1-C28; §7.0/13.1] SHALL persist and read compatible derived vectors via reviewed forward migration and controlled seam; duplicate/retry/concurrent conflict cannot silently mutate exact projection or create contradictory identity.
- **FR-004** [UPSTREAM: V1-X01; §13.1/13.4] SHALL suppress any stale/ineligible/withdrawn/expired/invalid/not-current source projection before ranking regardless of retained vectors.
- **FR-005** [UPSTREAM: V1-C03; §13.3/20] SHALL consume only the existing 020 public normalized embedding contract with document/query roles and explicit compatible model/config/dimension; reject malformed/mixed vectors and record uncertainty.
- **FR-006** [UPSTREAM: V1-C20/C21/C39/C41; §9/9.1/13.4] SHALL enforce verified actor, scope, purpose, consent, independent application authorization and RLS before retrieving; no new role/purpose/permission bypass.
- **FR-007** [UPSTREAM: V1-X01, V1-C37; §13.4/32.6] SHALL reuse 017 eligibility, exact Scene and 016 Intervention and professional approval authority; unknown or unavailable required facts fail closed.
- **FR-008** [UPSTREAM: V1-C25/C37; §12.8/13.4] SHALL enforce current Compliance/Safety before ordinary retrieval/egress; never override business/professional authority.
- **FR-009** [UPSTREAM: §13.4; V1-C21] SHALL establish the admitted set before any ranking/top-K/fusion/reranker consumption; rejected identities cannot influence ranking or leave the boundary.
- **FR-010** [UPSTREAM: §4.2/13.2/13.6] SHALL execute actual PG18/pgvector dense distance over compatible eligible candidates, with bounded top-K and stable declared ordering, verified independently.
- **FR-011** [UPSTREAM: §13.2/13.4/20] SHALL use public 023 reranker on only admitted IDs/texts, validate exact returned identities/scores/ranks, enforce bounded result and no alternate path.
- **FR-012** [UPSTREAM: V1-X01, V1-C27; §13/14A] SHALL preserve source/version/chunk and technical score/config provenance; reject stale authorization/version/corpus results across asynchronous boundaries.
- **FR-013** [UPSTREAM: V1-C03/C27; §36] SHALL distinguish valid empty, denial, unavailable, malformed, stale, incomplete corpus and failed dependency; no fake success or broadened/partial fallback.
- **FR-014** [UPSTREAM: V1-C21/C41, V1-X11/X14; §32.13/37] SHALL enforce authorized nonpersonal technical corpus, controlled egress/secrets and sanitized exact execution evidence; do not persist family queries or leak content/credentials.
- **FR-015** [UPSTREAM: §4.2/13/40; V1-X14] SHALL demonstrate deterministic offline and real PG18/pgvector persistence/retrieval/guard/migration mechanics. Mocks cannot satisfy DB or provider verification.
- **FR-016** [UPSTREAM: §13.2/20/40; V1-C27] SHALL independently record real embedding and reranker evidence, and actual end-to-end Stage A C execution before asserting C technical VERIFIED; absent dependencies remain blocked/unverified.
- **FR-017** [UPSTREAM: §20/32.6/38/40; V1-X01/X14] SHALL defer professional Gold evaluation, pinned route/model approval, A/B hybrid, and production activation; no technical experiment approves a clinical/professional label.
- **FR-018** [UPSTREAM: AGENTS.md, constitution; §7.0/13] SHALL preserve exact upstream paths/contracts, bounded scope, migration/security and ownership governance, separate admission/ownership before implementation, no unsupported registry authority or weakened tests.

## User Scenarios & Testing

These are internal foundation consumers, not new UI or business journeys.

- P1: An authorized technical caller can prepare exact source-bound compatible document vectors and query them on PG18, then obtain bounded reranked references. Independent test: controlled corpus, close/reopen DB transaction, known ordering oracle and normalized reranker identity.
- P1: A closer but ineligible or stale document is never admitted to distance/top-K/reranker. Independent test: adversarial closer vector, exact version/hash and permission/eligibility negatives, actual runtime role and captured reranker inputs.
- P1: Dependency absence, invalid provider reply or stale authorization cannot appear as verified usable output. Independent test: fail injection, gate precedence, zero unauthorized calls, no partial publication or result.
- P2: An evaluator can reproduce the technical C chain against a declared corpus and configuration, without Gold labels or production approval. Independent test: real PG18, actual two providers and exact-head evidence; blocked truth preserved if unavailable.

## Acceptance Scenarios

- AS-01 (FR-002/003): Given exact approved test Knowledge version and derived chunk, when written/read in real isolated PG18, after independent connection/restart the same exact identity, provenance and vector remain; no orphan or source-hash substitution.
- AS-02 (FR-003/004): Duplicate same logical generation and retry/concurrency preserve one authoritative representation; conflicting or stale writes reject; successor, retirement, expiry, invalidity, NEEDS_REVIEW, approval withdrawal and binding change suppress old projection without inventing lifecycle state.
- AS-03 (FR-005): document/query roles and compatible configured identity/dimension are validated; wrong role/model/config/version/hash/dimension, invalid/nonfinite vector and missing compatible corpus never silently rank. Configured vs observed revision remain distinct.
- AS-04 (FR-006/008): wrong actor/family/case/purpose, missing consent, Safety Hold or Compliance denial, missing verified age or authority, insufficient RLS context, runtime role bypass attempts cannot read protected candidates, embed prohibited inputs, or send reranker content; no information enumeration.
- AS-05 (FR-007/009): adversarial candidates include nonpublished, review not current, invalid, expired/future, missing/invalid approval, wrong Scene/version/stage/age/locale/risk, exclusion, unmet applicability and mismatched Intervention. Each is rejected before distance/top-K and external reranker; known valid candidates remain. Unavailable authority is distinguished from ineligible.
- AS-06 (FR-009/010): closer denied vector would win an unfiltered top-K; real PG query is over admitted candidate relation only, expected eligible IDs/order verified by independent numerical oracle and query/selection evidence. Test top-K/tie/empty limits; no global retrieval then filter or ranking interference.
- AS-07 (FR-011/012): exact admitted IDs/texts are sent only through normalized public reranker; complete valid output returns bounded ordered eligible references with provenance; foreign/duplicate/missing/invalid result is rejected. No reranker on true empty.
- AS-08 (FR-004/012): material authority/version/hash drift during generation, DB retrieval or rerank invalidates affected writes/results, rechecks before dispatch/release; no stale cache or newly denied result; test controlled interleavings and pre-dispatch denial.
- AS-09 (FR-013/014): network/timeout/config/credential/permission/DB failures preserve original normalized failure and truthful evidence; missing required provider never generates dummy vector/rank. No secrets, real family/private text, unauthorized query or raw content logs.
- AS-10 (FR-015): actual clean/upgrade migration on PG18 target and real runtime-role vector write/read/distance query pass, RLS/grants/privilege verified; test cleanup; no historical migration edits or existing extension owner changes.
- AS-11 (FR-016): controlled actual embedding document+query and actual reranker through admitted ports, real DB persistence/read/query, explicit pre-ranking admit/deny and returned candidates, reproducible technical oracle and provenance, complete one coherent attempt lineage. Source sample manifest and technical expectations predeclared before run; no professional label. Separate true provider evidence from fixture tests.
- AS-12 (FR-016/017): absent live evidence yields BLOCKED/NOT_VERIFIED/NOT_EVALUATED, no C technical PASS; observed incompatible actual behavior yields FAIL, never silent route substitution; Gold/production status remain separate even if live succeeds.
- AS-13 (FR-017/018): negative-scope test confirms no A/B/sparse/lexical/fusion, no second eligibility/provider/approval, no production route/endpoint/Context Builder/AI Task Runtime/Gold execution; no existing authority or unauthorized path change.
- AS-14 (FR-018): exact head regression, static architecture/ownership, governance, required CI and evidence lineage are reproducible, stale/mixed/head mismatch cannot satisfy claims; no test weakening.

## Success Criteria

- SC-001: FR-001–018 and AS-01–14 are traceable to concrete Plan/Tasks/test evidence, including negative scope.
- SC-002: Mandatory offline mechanics and real PG18 storage/query/migration/RLS evidence PASS; no blocked/ineligible candidate reaches ranking or reranker in the prescribed adversarial matrix.
- SC-003: Positive complete C technical verification requires actual document+query embedding, actual reranker and real PG18 chain on exact subject head/config/corpus with independently checkable evidence. No professional quality claim. If missing external dependency, record precisely which lower states passed and C technical result BLOCKED/NOT_VERIFIED; a bounded implementation-only audit/hand-off may be labelled as such, never full positive technical closure. Genuine observed technical failure may be recorded as FAIL evidence, not readiness.
- SC-004: Production remains not authorized until downstream formal Gold evaluation, pinned production route/model, approved corpus, external processing, environment and all formal release gates. No Candidate A/B disposition inferred from C.

## Acceptance Evidence

| Evidence class | Mandatory or deferred | Required evidence |
|---|---|---|
| Offline contract / negative scope | Mandatory PASS | deterministic fake ports/test-only authority; adversarial eligibility, identity, lifecycle, ordering, stale/concurrent and error tests; capture call counts, no unauthorized input. Never real provider proof. |
| Real DB | Mandatory PASS | reviewed schema and clean/upgrade migration, actual PG18/pgvector version/image, runtime role/grants/FORCE RLS where applicable, actual durable insert/read/distance/order/eligible relation, independent numeric oracle, cleanup, historical migration unchanged. |
| Real Embedding | Required for positive C technical chain, not design or start of authorized offline implementation | actual qwen3.7 document/query dense calls through 020 port, configured identity/roles/dimension, observed model echo/envelope/availability, provider request and attempt evidence, compatible vectors. Existing valid 020 evidence can support adapter capability only; cannot replace actual C calls. No need to require sparse EVC coverage for C. |
| Real Reranker | Required for positive C technical chain, not design or start of authorized offline implementation | actual qwen3-rerank through 023 public port, candidate identity/score/rank normalization, request id/config and unknown immutable revision explicitly recorded. 023 evidence may support adapter capability, not replace actual C execution. |
| Complete C Stage A | Required for positive C technical closure | one coherent actual chain, controlled nonpersonal corpus and query, source/chunk/version/embedding config identity, eligibility decisions, actual PG dense order, exact reranker input/output and Top Context IDs, independent mechanical oracle, no Gold claims; predeclared corpus and expectations, no cherry-picked results. |
| Formal Gold quality | Deferred | later RELEASED 018 corpus/Gold labels, common A/B/C comparison with Recall/nDCG/MRR, terminology, negation/exclusion, hard-filter fidelity, rerank quality, latency/storage/cost; no thresholds invented here. |
| Production | Deferred | approved pinned route/model, stage B/C compatibility, real Professional/Legal Authority, Consent/Compliance/Safety/data policies, all §40 gates. |
| Regression/governance | Mandatory | exact subject HEAD/clean tree, current main/reconciliation, frozen artifact blobs, actual changed-path list, mandatory canonical regression, static/architecture guards, migration and CI output, applicable independent audit evidence. No stale, unrelated or mixed evidence. |

Evidence records MUST distinguish offline, actual database, actual providers and integrated-chain states. Bind exact implementation subject SHA, immutable fixture/corpus/config identity, DB environment and stage, attempt/run identity, observed provider request references and sanitized evidence hashes; independently recomputable decisions/order or bounded reproducible artifact, without storing unauthorized texts or secrets. A final evidence-only commit may refer to immutable subject head only with verified unchanged implementation/fixtures and explicit lineage. Plan AI 2 defines exact evidence form and acceptance mappings; no additional review stage introduced by this Spec.

## Clarify Closeout and Dependencies

- Q1: INCLUDE minimal production-shaped derived storage and lifecycle suppression, controlled technical verification only. §7.5 and §13.1 plus concrete consumer establish necessity. No separate autonomous Knowledge Embeddings lifecycle, indexing platform, automatic jobs or production ingestion activation. The production schema is needed; actual real production corpus/processing is not permitted or required for Stage A mechanism tests.
- Q2: Slice 17 owns eligibility; Slice 24 owns candidate admission/order/compatibility and the integration gap. Use current verified gate owners; no authority copied or manufactured. No hard-coded SQL or ranking algorithm decided at Spec.
- Q3: Offline and real DB required; real embedding, real reranker and actual integrated chain required for a positive full technical result. They do not block Specify/Plan or authorized offline development. Gold/production are later gates. Missing credential is not technical FAIL, and positive technical evidence does not mean approved production. No 018/021 blocking inherited by C; 022 is irrelevant to C.
- No open product decision, architecture decision, authority conflict or scope question identified within this projection. Metric/limits, exact tables/constraints, chunk identity derivation, transaction/snapshot discipline, migration slot, evidence matrix and precise allowed paths belong to Plan, not new Owner product decisions.
- Overengineering assessment: minimum necessary durable projection + prefilter + real dense query + rerank, no standalone chunk/persistence platform or generalized retrieval/gateway. Existing owners remain unchanged. Removing persistence reduces this to another spike; removing prefilter violates Authority; removing reranker removes the required C stage.

## Gates / Governance

Selection Gate = PASS (selected C).
Specify / Clarify = COMPLETE at this specification boundary.
Spec Freeze = this spec content on spec-only branch; commit and Git blob identity recorded by remote read-back at handoff, not self-referential in this file.
Planning Gate = READY FOR PLAN AI 2. Planning uses stable upstream frozen contracts and current code, does not require credentials, approved corpus, 021 positive result or 023 merge just to plan. No Plan, Checklist, Tasks, Audit 1 or implementation is created by this stage.

Developer Gate = CLOSED. Opening requires Plan/Checklist/Tasks and cross-artifact analysis / Audit 1 PASS against exact frozen identities; planning admission onto current main per repository governance; separate narrow ownership registration/required governance admission before production paths are edited (new retrieval seam, reviewed migration/schema paths, only any necessary shared paths explicitly authorized); actual path ownership and consuming change-binding. No registry change with consuming implementation; no path broadening or guard relaxation. Current main re-read, no competing implementation, authoritative 016/017 usable and audit provenance reconciled for required seams, 019 Stage A real dense readiness reproducible, 020 audited merged normalized public Port, 023 final independent Audit 2 PASS + merged implementation and compatible public Port + successful post-merge checks. Current 023 implementation dependency is not satisfied. If 023 final contract materially changes, reconcile affected design before implementing; do not copy unfinished provider. Slice 18 formal corpus/reviewer, 021 sparse live evidence and 022 lexical are not development dependencies for bounded C technical foundation; real credentials/egress not gate-opening requirements for offline mechanics. Any positive live step is gated by actual permitted config, data rights and dependencies.

Planning AI 2 shall specify concrete minimal path topology and verify all existing guards, especially Slice 17 Rule 17, Slice 19 Rule 19, Slice 20/23 provider-boundary guards and migration role/security. Existing code/tests/guards cannot be changed merely to bypass constraints; if an unavoidable real ownership/guard conflict exists, stop and use authorized bounded governance rather than silently relaxing. All new production paths currently require admission; migration naming/ownership must consider concurrent remediation and actual migration chain. No local implementation or provider call is authorized in this Spec stage.

## Stop Conditions

Stop before implementation if any required Developer Gate predicate is absent/unproven, Authority conflicts, ownership unknown or competing implementation found. Stop affected execution on revoked/unknown required authority, source/hash/model incompatibility, missing external authorization, failed required tests, mixed/stale evidence or attempts to broaden scope. A blocked live step must remain blocked; do not run production or fabricate evidence to clear it. Any needed semantic change goes through upstream change control. No main merge by Planning AI 1.

**Planning AI 1 stop**: FROZEN SPEC — READY FOR PLAN AI 2; developer not authorized; formal Gold quality and production activation not authorized.
