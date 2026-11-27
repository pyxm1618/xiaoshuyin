# Slice 23 — Plan AI 2 Development Plan

Repository: pyxm1618/xiaoshuyin  
Feature: 023-reranker-provider-adapter-foundation  
Role: Plan AI 2 — Plan / Checklist / Tasks / Audit 1 only (Targeted Planning Reconciliation)  
Frozen Spec branch: origin/spec-correction/023-targeted  
Frozen Spec head: 092c18d514d46a1e4e40f3544d428302cde00fa8  
Frozen Spec blob: 4354ecac585d3d6c675c629d5304faf9422cf5b1  
Superseded Frozen Spec head (historical only): 8fae7497df58446ad034d2986168f6a912444eb3  
Superseded Frozen Spec blob (historical only): 311511af1cfcda979d2b6896103c0a0c1d227b0b  
Previous Planning Freeze head (historical only): 2c03ca64a53f92acf837816c65630c9546ff7cda

> This plan authorizes no production implementation by itself. Implementation Gate: BLOCKED until Admission + ownership governance prerequisite + Developer T001 current-main reconciliation PASS.

## 1. Remote Truth

Planning reconciliation preserves the existing `origin/plan/023-reranker-provider-adapter-foundation` (`2c03ca64a53f92acf837816c65630c9546ff7cda`) lineage and merges the corrected Frozen Spec lineage (`origin/spec-correction/023-targeted` at `092c18d514d46a1e4e40f3544d428302cde00fa8`, which already includes `origin/main` at `e7885234f4b5c4aec61d6a9dfc2b6ff5e6304512`) without rewriting frozen history.

- New Frozen Spec branch: `origin/spec-correction/023-targeted`
- New Frozen Spec exact head: `092c18d514d46a1e4e40f3544d428302cde00fa8`
- New Frozen Spec blob: `4354ecac585d3d6c675c629d5304faf9422cf5b1`
- Superseded Frozen Spec head (historical / superseded): `8fae7497df58446ad034d2986168f6a912444eb3`
- Superseded Frozen Spec blob (historical / superseded): `311511af1cfcda979d2b6896103c0a0c1d227b0b`
- Previous Planning Freeze branch / head (historical / superseded): `origin/plan/023-reranker-provider-adapter-foundation` / `2c03ca64a53f92acf837816c65630c9546ff7cda` (Plan `09cd4cf7a5c0334ccb699aed6c0a06b518045269`, Checklist `d86fb6cd0f07784d960b0cdb1a514818de2a4e04`, Tasks `b4fa24600edc1e920a8bad6cbe14ed06a4017df7`)
- Current main reconciled at planning correction: `e7885234f4b5c4aec61d6a9dfc2b6ff5e6304512` (`chore(s20): close post-merge planning and task evidence (#147)`)
- Previous planning main observation (superseded): `e8b1d490fc8dab5af6cffaf30a5651fc7f6304f7`
- Correction branch: `plan-correction/023-targeted` (branched from `2c03ca64a53f92acf837816c65630c9546ff7cda`, merged `origin/spec-correction/023-targeted`)
- Existing 023 PRs / competing 023 implementation: none observed.

Current Authority Doc blobs on current main (`e7885234f4b5c4aec61d6a9dfc2b6ff5e6304512`) remain exactly the identities recorded by the Frozen Spec:

- Docs/总产品需求.md — 97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29
- Docs/V1产品需求.md — 379cb8cfb377924cd21ccfe55baa5aecdf207f5e
- Docs/总体技术架构.md — 6b4630803f371faf6d93f27361070223d0f661a0
- Docs/V1技术设计.md — afef9fcc4af41b6137e5020717135972a3d515fc

Current-main drift classification (`e8b1d490` -> `e7885234`):

- **Authority Drift**: NONE (all four Authority Doc blobs unchanged).
- **Implementation-Surface Drift**: Slice 20 (`020-embedding-provider-adapter-foundation`) ownership (`#118`), implementation (`#142`), and post-merge closeout (`#147`) landed on `origin/main` (`apps/server/api/src/ai/embedding/`). Per Frozen Spec §9.2 reuse evaluation, all 10 modules under `apps/server/api/src/ai/embedding/` are embedding-specific and `FEATURE`-owned by `020-embedding-provider-adapter-foundation`; no capability-neutral shared primitive exists, so Slice 23 preserves its narrow independent seam (`apps/server/api/src/ai/reranker/`) without importing `ai/embedding/` or building a generic gateway. No `reranker` or `023` production owner exists on current main. However, PR #142 also added `tests/architecture/embedding-provider-boundary.test.ts`, whose line 94–102 scan currently forbids `/DASHSCOPE_|maas\.aliyuncs\.com|ALIBABA_DASHSCOPE/` in any `.ts` file under `apps/server/api/src` outside `ai/embedding/`; this test-boundary drift does not alter Slice 23 semantics and is captured as an explicit T001 verification/gate check before T002+.
- **Provider-Contract-Relevant Drift**: NONE (`PARTIAL`, `NATIVE_HTTP`, `qwen3-rerank` unchanged).
- **Governance Drift**: Current `.specify/scripts/validate-governance.mjs` requires `## Upstream Traceability`, `## Constitution Check`, and `## Verification Plan` in `plan.md`, plus `## Frozen Spec Authority Map` and `## Acceptance Evidence Contract` in structured `tasks.md`. `.specify/scripts/validate-change-governance.mjs` added `POST_MERGE_CLOSEOUT` task-provenance checks (`#145`, `#147`), which do not affect unchecked planning tasks. `.specify/implementation-ownership.json` still has no `023` / `apps/server/api/src/ai/reranker/` rule.
- **Command Drift**: Governance/static/typecheck/`verify-all` command entrypoints remain unchanged; `bun run verify-all` now runs Slice 20's `tests/architecture/embedding-provider-boundary.test.ts`.

Authority drift: NONE.  
Frozen Spec drift: NONE (rebound cleanly to `092c18d514d46a1e4e40f3544d428302cde00fa8` / `4354ecac585d3d6c675c629d5304faf9422cf5b1`).

## 2. Authority

The four Authority Docs and Frozen Slice boundaries establish all of the following:

1. qwen3-rerank is the V1 first reranker candidate, not a production-approved model.
2. Candidate A, Candidate B and Candidate C all pass through a reranker before Top Context.
3. A/B/C must ultimately be compared on the same Xiaoshuyin Gold Dataset.
4. Production model usage requires pinned model/version evidence and cannot silently rely on a floating alias.
5. Provider/model replaceability is required, while V1 explicitly does not authorize a generic Model Gateway.
6. Professional Gold labels/rubrics cannot be authored or approved by AI, Developer, fixture data, model output, schema flags or tests.
7. hard filter precedes reranking in the production retrieval architecture.
8. Authorization, Consent, Compliance and Safety remain independent gates and cannot be bypassed by retrieval/reranking.
9. UNKNOWN / BLOCKED / NOT_EVALUATED capability does not become READY.
10. Slice 23 cannot create Professional Authority, route approval, production relevance thresholds or a production RAG winner.

Authority conflict: NONE.

## Upstream Traceability

Mechanical mapping from the canonical upstream IDs and requirements in Frozen Spec (`spec.md` blob `4354ecac585d3d6c675c629d5304faf9422cf5b1`, `## Upstream Traceability`) to Plan sections and downstream tasks/checks (zero new requirement IDs invented):

| Canonical Upstream ID / Anchor | Frozen Spec Requirement / Boundary | Plan Section(s) | Downstream Task(s) / Check(s) |
|---|---|---|---|
| `V1-C03` | `FR-005`–`FR-010`, `FR-014`, `FR-015`, `FR-019`, `FR-020`; `AS-03`–`AS-09` (no fabricated deterministic values for `UNKNOWN` / unavailable / partial / unverified states) | §5, §10–§13, §15, §17–§20, §23 | `T003`, `T005`, `T006`, `T007`, `T008`, `T010`, `T012`; `C23-FR-005`..`C23-FR-010`, `C23-E01`..`C23-E07` |
| `V1-C24` | `§8.1`, `§8.3`, `§10 #4/#5/#8`, `FR-016`; `AS-11` (scores/outputs are technical signals only, never Domain Commands or Professional Authority) | §2, §3, §9, §10, §12, §21 | `T002`, `T006`, `T009`, `T011`, `T012`; `C23-O08`, `C23-FR-016`, `C23-AS-11` |
| `V1-C27` | `FR-009`–`FR-011`, `FR-014`, `FR-015`, `FR-020`; `AS-05`–`AS-09`, `AS-15` (truthful failure surfacing; no silent fallback; offline never proves live) | §13, §14, §16–§18, §23 | `T003`, `T004`, `T005`, `T007`, `T008`, `T010`, `T011`, `T012`; `C23-R01`..`C23-R11`, `C23-AS-05`..`C23-AS-09` |
| `V1-C28` | `FR-011`, `FR-012` (bounded stateless retry; zero duplicate business effects; no silent provider/model switch) | §14, §21 | `T004`, `T006`, `T008`, `T009`; `C23-FR-011`, `C23-FR-012`, `C23-R02`, `C23-R03` |
| `V1-C34` | `FR-013`, `FR-016`; `AS-10`, `AS-11` (`APPROVED PROFESSIONAL REVIEWER — UNASSIGNED` preserved; synthetic/non-personal fixtures only) | §2, §16, §17, §21 | `T008`, `T009`, `T010`, `T011`, `T012`; `C23-FR-013`, `C23-AS-10`, `C23-AS-11`, `C23-H09` |
| `V1-C37` | `§8.2`, `§10 #6/#7`, `FR-016`, `FR-017` (no bypass of Authorization/Consent/Compliance/Safety/hard filters; no Intervention/RAG eligibility truth) | §2, §3, §8, §21 | `T009`, `T011`; `C23-FR-017`, `C23-AS-12`, `C23-X07` |
| `V1-X11` | `FR-007`, `FR-019` (record only returned usage/cost facts; unavailable cost stays `UNKNOWN`, never zero-filled or multiplied) | §10, §17, §20 | `T005`, `T007`, `T008`, `T009`, `T010`; `C23-FR-019`, `C23-S07` |
| `V1-X14` | `FR-014`, `FR-015`, `FR-020`; `AS-01`, `AS-02`, `AS-09`, `AS-10`, `AS-15` (offline proves contract only; live requires exact-head real call; blocked/absent remains explicit) | §16–§19, §22, §24 | `T007`, `T008`, `T010`, `T011`, `T012`; `C23-FR-014`, `C23-FR-015`, `C23-AS-01`, `C23-AS-02`, `C23-AS-09`, `C23-AS-15` |
| Provider / Model Replaceability (`Docs/总产品需求.md` §28; `Docs/V1技术设计.md` §19–§20) | `FR-001`, `FR-018`; `AS-14` (capability-specific replaceable reranker port; no generic Model Gateway) | §3, §4, §6, §8–§10, §21 | `T001`, `T002`, `T006`, `T009`, `T011`; `C23-FR-001`, `C23-FR-018`, `C23-AS-14` |
| `qwen3-rerank` Candidate & Pinned Provenance (`Docs/总体技术架构.md` §11.5; `Docs/V1技术设计.md` §19–§20) | `FR-002`, `FR-005`, `FR-017`; `AS-02`, `AS-07` (`qwen3-rerank` candidate only; explicit provenance; reject floating aliases; immutable revision `UNKNOWN_NOT_DOCUMENTED`) | §5, §6, §9, §15, §18, §23 | `T001`, `T003`, `T005`, `T007`, `T010`, `T012`; `C23-FR-002`, `C23-FR-005`, `C23-G07`, `C23-G08`, `C23-E04` |
| A/B/C Reranker Stage & Upstream Hard Filters (`Docs/总体技术架构.md` §11.1; `Docs/V1技术设计.md` §13.2, §13.4, §40) | `FR-003`, `FR-004`; `AS-03`, `AS-04`, `AS-12` (route-neutral; caller-owned identity preservation; zero retrieval/RRF/hard-filter runtime) | §3, §9–§11, §21 | `T002`, `T005`, `T006`, `T008`, `T009`, `T011`; `C23-FR-003`, `C23-FR-004`, `C23-I01`..`C23-I09`, `C23-AS-12` |
| No Professional Authority & Gold Eval Boundary (`Docs/总产品需求.md` §31A; `Docs/V1产品需求.md` Preamble; `Docs/总体技术架构.md` §11.1, §19A; `Docs/V1技术设计.md` §32.13, §40) | `FR-013`, `FR-016`; `AS-10`, `AS-11` (synthetic/non-personal fixtures; no `Recall`/`nDCG`/`MRR`/route-winner/approval claim) | §2, §3, §12, §16, §17, §21 | `T008`, `T009`, `T010`, `T011`, `T012`; `C23-FR-013`, `C23-FR-016`, `C23-AS-10`, `C23-AS-11` |
| Admitted Upstream Slice Boundaries (Slices 17–20) | `FR-012`, `FR-016`, `FR-018`; `AS-10`, `AS-12`–`AS-14` (zero knowledge store, zero Gold runtime, zero DB migration, zero duplicate embedding path or generic gateway) | §1, §3, §4, §7, §8, §21 | `T001`, `T009`, `T011`; `C23-G05`, `C23-FR-012`, `C23-FR-018`, `C23-X08` |

## Constitution Check

Mechanical verification against `AGENTS.md` and Frozen Spec (`092c18d514d46a1e4e40f3544d428302cde00fa8` / `4354ecac585d3d6c675c629d5304faf9422cf5b1`):

| Check | Status | Mechanical Basis |
|---|---|---|
| Authority Docs unchanged | PASS | `Docs/**` diff = 0; all four Authority blobs match `Docs/` on `origin/main` (`e7885234...`) |
| Frozen Spec Authority | PASS | Bound strictly to `092c18d514d46a1e4e40f3544d428302cde00fa8` / blob `4354ecac585d3d6c675c629d5304faf9422cf5b1`; zero edits to `spec.md` |
| No scope widening | PASS | Exact `20 / 20` FR, `15 / 15` AS, `12` Tasks; only `apps/server/api/src/ai/reranker/` + 4 test files planned, plus the single mandatory governance-metadata manifest in §8 (no production scope increase) |
| No Professional Authority creation | PASS | `APPROVED PROFESSIONAL REVIEWER — UNASSIGNED` preserved; zero reviewer/approval tables or labels (`FR-016`, `AS-11`) |
| No Gold Eval | PASS | Zero Gold Dataset authoring/scoring/metrics (`Recall`, `nDCG`, `MRR`, uplift); Slice 18 boundary preserved (`AS-10`) |
| No generic Model Gateway | PASS | `NATIVE_HTTP` transport; capability-specific `ai/reranker/` port only; zero provider registry/multi-provider fallback (`FR-018`, `AS-14`) |
| No DB / persistence | PASS | `db/` unchanged; zero migrations, tables, or caches (`FR-012`, `AS-13`, `C23-X08`) |
| No route activation | PASS | `apps/server/api/src/app.ts` and `routes/` untouched; zero `rag_route_version` / `rerank_route_version` activation (`FR-017`, `C23-X07`) |
| Provider replaceability | PASS | `contracts.ts` / `index.ts` expose provider-neutral `RerankRequest` / `RerankResult` without DashScope envelope/index leakage (`FR-001`, `C23-O03`) |
| Failure remains truthful | PASS | `PASS \| FAIL \| BLOCKED \| UNKNOWN \| NOT_EVALUATED` state machine; no `READY` boolean; `PARTIAL` provider contract (`FR-014`, `FR-015`, `FR-020`) |
| Exact-head evidence | PASS | `§19`, `AS-15`, `T010`–`T012` bind evidence to clean exact `HEAD` and config/model/version tuple |
| Separate governance prerequisite | PASS | `apps/server/api/src/ai/reranker/` ownership PR remains separate from planning admission and from product implementation (`§7`, `T001`) |

## 3. Frozen Scope

Slice 23 owns exactly:

> one reranker capability-specific port, one provider-specific qwen3-rerank adapter seam, and one technical evidence boundary.

It does not own:

- retrieval or Professional RAG runtime;
- dense/sparse retrieval;
- sparsevec;
- pg_jieba;
- RRF or fusion;
- hard-filter production runtime;
- A/B/C execution/comparison;
- Gold Dataset authoring/scoring;
- Recall, MRR, nDCG, Precision or reranker uplift;
- ranking thresholds or Top-N production policy;
- Context Builder;
- AI Task Runtime;
- TaskModelRegistry;
- Promptfoo platform;
- generic provider/model gateway;
- model fallback;
- route activation;
- persistence, cache, DB table or migration;
- user-facing route;
- Professional Reviewer creation.

Any need to cross this boundary is a STOP and returns to planning/authority review.

## 4. Repository Discovery

Current repository facts re-read from current main:

- Server runtime: TypeScript/ESM under apps/server/api.
- Zod 4 is already a server dependency.
- No DashScope/@alicloud reranker SDK is present in apps/server/api/package.json.
- Existing runtime environment convention is apps/server/api/src/runtime-env.ts: explicit required values, no hard-coded production fallback, fail-closed production default.
- Existing HTTP/business error handler is apps/server/api/src/plugins/error-handler.ts. Slice 23 MUST NOT extend it for provider technical errors; reranker errors remain local technical errors.
- Slice 20 (`020-embedding-provider-adapter-foundation`) has now landed on current `origin/main` via PR #118 (ownership), PR #142 (implementation at `apps/server/api/src/ai/embedding/`), and PR #147 (post-merge closeout). Per Frozen Spec §9.2 reuse evaluation, inspection of all 10 files in `apps/server/api/src/ai/embedding/` confirms they are embedding-specific (`EmbeddingRuntimeConfig`, `EmbeddingProviderPort`, `EmbeddingTelemetryRecord`, `EVC-01`..`EVC-10` evidence model) and exclusively `FEATURE`-owned by `020-embedding-provider-adapter-foundation`. No capability-neutral shared provider primitive exists on main; therefore Slice 23 MUST NOT import from `apps/server/api/src/ai/embedding/`, duplicate an embedding path, or introduce a generic gateway.
- Cross-slice test-boundary fact observed on current `origin/main`: PR #142 added `tests/architecture/embedding-provider-boundary.test.ts`, whose lines 94–102 assert that no `.ts` file under `apps/server/api/src` outside `apps/server/api/src/ai/embedding/` matches `/DASHSCOPE_|maas\.aliyuncs\.com|ALIBABA_DASHSCOPE/`. Because `bun run verify-all` runs all `tests/**/*.test.ts` and Slice 23 forbids modifying Slice 18–22 artifacts inside the Slice 23 implementation PR, Developer T001 MUST check whether that exclusive assertion still blocks `apps/server/api/src/ai/reranker/` on current main and treat an unresolved collision as a `BLOCKED` / STOP condition rather than editing Slice 20 tests.
- scripts/guard-static.mjs:
  - Rule 8 contains provider import tokens including dashscope and @alicloud; native HTTP with global fetch introduces no such provider SDK import.
  - Rule 19 is scoped so future independent adapter paths can exist; its self-tests explicitly distinguish Slice 19 surface from future adapter paths. Slice 23 must still run the guard and self-test.
- .specify/implementation-ownership.json:
  - resolution = LONGEST_MATCH;
  - policy = unknown production paths fail closed and registry changes may not ride with product implementation;
  - no reranker, provider, embedding or apps/server/api/src/ai/reranker ownership rule exists on current main.
- validate-change-governance.mjs:
  - apps/, packages/, db/ are production paths;
  - tests/, specs/, scripts/, .specify/, .github/, Docs/ are fixed-exempt prefixes.
  - For a PR changing product paths, the validator nevertheless requires exactly one changed `.specify/change-bindings/*.json` manifest, with exact product-path binding. The sole authorized Slice 23 manifest and its T011 closeout are defined in §8/§22; a planning-only correction must not create it.
- Root package scripts verified:
  - bun run typecheck -> scripts/typecheck-all.mjs
  - bun run verify-all -> scripts/verify-all.mjs
  - bunx vitest is the current test convention.
- Existing governance commands verified:
  - node .specify/scripts/validate-governance.mjs
  - node .specify/scripts/tests/run-governance-tests.mjs
  - node .specify/scripts/validate-change-governance.mjs --base <base> --head HEAD
  - node .specify/scripts/tests/run-change-governance-tests.mjs
  - node scripts/guard-static.mjs
  - node scripts/guard-static.mjs --self-test

No current repository fact requires packages/ai, packages/rag, apps/server/api/src/providers, a generic gateway, a DB migration or a new dependency.

## 5. Provider Contract Verification

Official sources re-verified during Plan AI 2:

- Alibaba Cloud Model Studio Text Rerank API:
  https://help.aliyun.com/en/model-studio/text-rerank-api
- Alibaba Cloud Model Studio Rerank:
  https://help.aliyun.com/en/model-studio/rerank
- Alibaba Cloud Model Studio error codes:
  https://help.aliyun.com/en/model-studio/error-code
- Alibaba Cloud Model Studio rate limiting:
  https://help.aliyun.com/en/model-studio/rate-limit
- qwen3-rerank model information:
  https://help.aliyun.com/en/model-studio/qwen3-rerank

Verified native DashScope HTTP contract for qwen3-rerank:

- method: POST
- workspace-specific endpoint path:
  https://{WorkspaceId}.{region}.maas.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank
- documented regions include cn-beijing, ap-southeast-1 and us-east-1; live config must provide one approved exact workspace-specific base URL.
- authentication: Authorization: Bearer <DASHSCOPE_API_KEY>
- content type: application/json
- model: qwen3-rerank
- request:
  - input.query: string
  - input.documents: string[]
  - parameters.top_n: optional; default is all documents
  - parameters.return_documents: optional, default false, supported by qwen3-rerank
  - parameters.instruct: optional; qwen3-rerank supports custom English instruction
- qwen3-rerank documented limits:
  - maximum documents: 500
  - maximum tokens per query/document: 4,000
  - maximum request tokens: 120,000
  - provider returns HTTP 400 rather than truncating an over-limit query/document.
- response:
  - request_id: string
  - output.results[] ordered by relevance_score descending
  - each result has index = original documents-array position
  - relevance_score is documented as 0.0–1.0; higher is more relevant
  - scores are relative to the current request and must not be compared across requests
  - usage.total_tokens is documented; prompt_tokens is not a qwen3-rerank requirement
- failure response exposes provider code/message/request_id when available.
- 401 InvalidApiKey, 403 AccessDenied, 400 InvalidParameter, 404 ModelNotFound/NotFound, 429 throttling/quota and 5xx service failures are documented.
- rate limiting can return 429; temporary service pressure can return 503.
- qwen3-rerank model info currently documents RPM/TPM limits, but those values are operational observations/configuration, not adapter correctness criteria.
- top_n intentionally permits returning fewer than all documents. Therefore Slice 23 MUST set top_n = input candidate count and require exact all-candidate coverage. A shorter result is PARTIAL_RESPONSE, not success.
- the provider does not carry caller candidate IDs. Mapping is therefore input order -> provider index -> exact caller candidateId.
- no documented provider behavior permits an unknown/duplicate/out-of-range index to be repaired.

Verified SDK difference:

- official current docs show a DashScope SDK structured response surface and SDK exceptions, while native HTTP exposes the raw output.results envelope.
- the current repository is TypeScript and has no official DashScope reranker SDK dependency.
- native HTTP permits strict validation against the documented raw provider JSON without introducing an SDK dependency or SDK-native types into the downstream contract.

Officially undocumented / not safe to infer:

- an immutable dated/revision-specific qwen3-rerank model identifier;
- a qwen3-rerank -latest alias;
- a server-side timeout guarantee;
- a provider mode that returns a partially successful result set because of per-item failures;
- deterministic provider tie order for exactly equal scores;
- a provider response model/version echo.

These remain UNKNOWN / IMPLEMENTATION-TIME VERIFY. They MUST NOT be guessed.

Provider Contract status for planning: PARTIAL. Core transport/request/response/error contract is verified; immutable model revision pinning and the above provider semantics are not documented.

## 6. Transport Decision

Decision: NATIVE_HTTP.

Reasons:

1. The official native HTTP qwen3-rerank contract is explicit enough for strict parsing.
2. The repository already runs in a fetch-capable JS/TS runtime and Slice 20 also chose native HTTP for its separate embedding capability (landing without any generic shared transport primitive); no shared generic transport is required.
3. No DashScope/@alicloud SDK dependency exists today.
4. Native HTTP exposes the raw documented JSON, which improves strict response validation and malformed/ambiguous-shape testing.
5. It minimizes supply-chain and bundle/runtime complexity.
6. It avoids leaking SDK response/error classes into downstream types.
7. It avoids Rule 8 provider SDK import tokens, so no static-guard allowance is needed.
8. It remains provider-replaceable because the public port is provider-neutral while only the internal adapter is DashScope-specific.
9. Creating a generic shared gateway merely to reuse transport is explicitly forbidden.

OpenAI-compatible rerank HTTP is not selected because it adds no benefit for this single provider-specific capability and would introduce a second provider surface to validate.

## 7. Governance Classification

Planned production seam:

apps/server/api/src/ai/reranker/

Current ownership registry has no matching owner. Unknown production paths fail closed.

Therefore:

GOVERNANCE PREREQUISITE = REQUIRED.

Implementation Gate: BLOCKED until:
1. corrected Spec/Plan/Checklist/Tasks are admitted to `main`;
2. reranker ownership governance prerequisite (`apps/server/api/src/ai/reranker/` -> `023-reranker-provider-adapter-foundation`) is independently audited and merged to `main`;
3. Developer T001 current-main reconciliation PASS (including verification that no unresolved cross-slice test collision blocks `verify-all`).

The governance prerequisite must be a separate governance-only PR, independently audited and merged before Developer T002+ may begin. The implementation PR MUST NOT modify .specify/implementation-ownership.json.

Exact ownership need:

- matcher kind: PREFIX
- matcher path: apps/server/api/src/ai/reranker/
- ownership kind: FEATURE
- feature: 023-reranker-provider-adapter-foundation
- one rule only; no apps/server/api/src/ai/ parent ownership; no providers/ wildcard; no package-level generic owner.

Suggested governance rule id (name is governance-PR implementation detail, semantic ownership is frozen):
reranker-provider-adapter-023

No scripts/guard-static.mjs modification is planned or authorized in MODE A / NATIVE_HTTP. If implementation discovers a real need for a provider SDK import, STOP and return to planning; do not widen Rule 8 inside the implementation PR.

## 8. Implementation Surface

Allowed production paths, after governance prerequisite merge:

- apps/server/api/src/ai/reranker/index.ts
- apps/server/api/src/ai/reranker/contracts.ts
- apps/server/api/src/ai/reranker/config.ts
- apps/server/api/src/ai/reranker/errors.ts
- apps/server/api/src/ai/reranker/transport.ts
- apps/server/api/src/ai/reranker/dashscope.ts
- apps/server/api/src/ai/reranker/rerank.ts
- apps/server/api/src/ai/reranker/evidence.ts
- apps/server/api/src/ai/reranker/telemetry.ts

Allowed test paths:

- tests/ai/reranker-provider-contract.test.ts
- tests/ai/reranker-dashscope.test.ts
- tests/ai/reranker-provider-live.test.ts
- tests/architecture/reranker-provider-boundary.test.ts

No fixture file is required; deterministic provider envelopes may be defined inside tests.

Required governance metadata (T011 only, not feature implementation):

- .specify/change-bindings/023-reranker-provider-adapter-foundation.json
- Exactly one changed change-binding manifest is required in the final implementation PR. Follow the current validator and existing Slice 20 schema v2 precedent: `schemaVersion: 2`, valid `changeId`, `classification: FEATURE_IMPLEMENTATION`, exactly one `featureBindings` entry with `feature: 023-reranker-provider-adapter-foundation`, `specPath: specs/023-reranker-provider-adapter-foundation`, and `implementationPaths` equal to the exact final changed production paths from the §8 allowlist. No test paths, unrelated paths, duplicate bindings or other feature ownership. T011 creates or finalizes and commits this metadata before final governance verification; any later production correction must reconcile the binding and reverify the final exact head.

Forbidden implementation changes include:

- app.ts or route registration;
- packages/**;
- db/**;
- migrations;
- scripts/**;
- `.specify/**` in the implementation PR except exactly one changed manifest at `.specify/change-bindings/023-reranker-provider-adapter-foundation.json` as specified above; `.specify/implementation-ownership.json`, `.specify/scripts/**` (including `.specify/scripts/tests/**`), a second change-binding manifest and all other `.specify/**` changes remain forbidden;
- package.json/bun.lock unless a new dependency becomes unavoidable, in which case STOP;
- Slice 18–22 artifacts;
- retrieval/fusion/Gold/eval/runtime code.

## 9. Input Contract

Public capability input:

~~~ts
type RerankRequest = {
  query: string;
  candidates: readonly {
    candidateId: string;
    candidateText: string;
  }[];
  options: {
    instruct: string;
  };
};
~~~

Rules:

- query MUST be a non-empty string after whitespace check; exact original text is sent unchanged.
- candidates MUST contain 1..500 items. Empty set is INVALID_INPUT and makes zero provider calls.
- candidateId is caller-owned and opaque.
- candidateId MUST be a non-empty exact string; it is never trimmed/rewritten.
- duplicate candidateId by exact string equality is INVALID_INPUT before provider call.
- candidateText MUST be non-empty after whitespace check; exact original text is sent unchanged.
- duplicate candidateText is permitted because provider index, not text equality, maps identity.
- instruct is required by Xiaoshuyin's technical port even though optional at the provider; requiring it removes provider-default drift from exact config provenance. It must be non-empty and is sent unchanged.
- provider/model/endpoint/API key/timeout/retry are NOT caller-supplied request fields.
- candidate business objects, Knowledge objects, Evidence objects, Case objects, Authorization state, Consent state, Safety state and professional labels are forbidden.
- provider payload projection is exactly candidates.map(candidateText), preserving input order.
- caller candidate IDs are not sent to the provider.
- provider/model are resolved from the capability adapter configuration, not a business caller override.
- token limits are provider-tokenizer limits. Slice 23 MUST NOT invent a character-count approximation. Provider 400 over-limit errors normalize to INVALID_INPUT.

Runtime/provider configuration:

- provider = ALIBABA_DASHSCOPE
- modelId = qwen3-rerank
- modelRevision = UNKNOWN_NOT_DOCUMENTED, never fabricated
- approved workspace-specific base URL, non-secret
- DASHSCOPE_API_KEY, secret, runtime only
- API surface = DASHSCOPE_NATIVE_HTTP
- top_n = candidate count, adapter-owned
- return_documents = false, adapter-owned
- attemptTimeoutMs = 10000, Xiaoshuyin policy, not provider SLA
- maxAttempts = 2, Xiaoshuyin policy
- retryBackoffMs = 1000, Xiaoshuyin policy
- total request budget <= 21000ms plus negligible local parsing time; no unbounded retry.

## 10. Output Contract

Normalized public result:

~~~ts
type RerankResult = {
  provider: "ALIBABA_DASHSCOPE";
  configuredModelId: "qwen3-rerank";
  configuredModelRevision: null;
  providerRequestId: string;
  usage: { totalTokens: number };
  results: readonly {
    candidateId: string;
    score: number;
    rank: number;
  }[];
};
~~~

Rules:

- success contains every input candidate exactly once.
- provider-native index does not leak downstream.
- rank is 1-based position in the normalized deterministic output.
- score is a technical provider signal only.
- score MUST be a finite number and MUST be within the provider-documented range [0,1].
- request_id MUST be a non-empty string.
- usage.total_tokens MUST be a non-negative integer.
- raw provider body, endpoint secret, API key and document text do not appear in the result.
- no relevance threshold, approval flag, Gold label or business decision is included.

## 11. Identity Mapping

Mechanical mapping algorithm:

1. Validate unique caller candidateId values before any provider call.
2. Create documents[] in exact candidate input order.
3. Set top_n = candidate count.
4. Parse only the documented native HTTP success path output.results.
5. Require results.length === candidate count.
6. Require every provider result index to be an integer in [0, candidateCount-1].
7. Require every provider index to appear exactly once.
8. Map index i only to input candidates[i].candidateId.
9. Require exact coverage of indices 0..N-1.
10. Unknown, duplicate, missing, out-of-range or non-integer index => IDENTITY_MAPPING_FAILURE or PARTIAL_RESPONSE as defined below; never guess.

Error distinction:

- valid result array shorter than N with otherwise valid unique in-range items => PARTIAL_RESPONSE.
- duplicate/unknown/out-of-range/non-integer index => IDENTITY_MAPPING_FAILURE.
- missing/invalid output.results shape => MALFORMED_RESPONSE.
- empty output.results for non-empty input => PARTIAL_RESPONSE.

## 12. Score Semantics

Provider relevance_score is only a reranker technical signal.

It is NOT:

- Professional truth;
- a Gold label;
- clinical/diagnostic score;
- approval;
- relevance threshold;
- business decision;
- route winner;
- production ranking threshold.

Provider response order must be non-increasing by relevance_score because that ordering is documented. A provider result violating that contract fails MALFORMED_RESPONSE.

Tie semantics are local deterministic normalization, not provider relevance semantics:

- after strict response validation, equal-score items are ordered by their original input index ascending;
- rank is then assigned 1..N;
- no claim is made that the first tied item is professionally more relevant.

Scores from different requests MUST NOT be compared, because the provider explicitly documents scores as request-relative.

## 13. Error Taxonomy

Slice 23 uses a capability-local technical taxonomy only:

- CONFIGURATION
- AUTHENTICATION
- AUTHORIZATION
- RATE_LIMIT
- TIMEOUT
- PROVIDER_UNAVAILABLE
- MALFORMED_RESPONSE
- UNSUPPORTED_CAPABILITY
- INVALID_INPUT
- IDENTITY_MAPPING_FAILURE
- PARTIAL_RESPONSE
- UNKNOWN_PROVIDER_FAILURE

No provider error becomes a business Domain error. No changes to the central HTTP error handler are authorized.

Provider mapping rules:

- missing/invalid approved runtime config -> CONFIGURATION
- HTTP 401 / InvalidApiKey -> AUTHENTICATION
- HTTP 403 / AccessDenied -> AUTHORIZATION
- HTTP 429 throttling or quota -> RATE_LIMIT, with retryability derived from documented code:
  - transient throttle/burst/concurrency/resource-overload forms: retryable within budget;
  - allocation/quota/budget exhaustion: terminal for this call.
- client AbortController deadline -> TIMEOUT
- connection failure or documented temporary 503 ModelUnavailable/ServiceUnavailable -> PROVIDER_UNAVAILABLE
- invalid JSON / wrong success shape / invalid required fields / invalid score -> MALFORMED_RESPONSE
- provider explicitly says model/API capability unsupported -> UNSUPPORTED_CAPABILITY
- local invalid request or provider InvalidParameter/over-limit 400 -> INVALID_INPUT
- index cannot uniquely map -> IDENTITY_MAPPING_FAILURE
- valid result collection does not cover all candidates -> PARTIAL_RESPONSE
- any unclassified provider failure -> UNKNOWN_PROVIDER_FAILURE; no guessing.

## 14. Timeout / Retry

Timeout owner: reranker adapter transport.

Frozen policy:

- per-attempt timeout: 10,000 ms
- max attempts: 2 total
- fixed backoff before second attempt: 1,000 ms
- no third attempt
- no infinite retry
- no provider/model fallback
- total external-call budget is bounded.

Retryable only:

- network connection failure with no provider response;
- TIMEOUT;
- documented temporary provider unavailability (503 ServiceUnavailable / ModelUnavailable);
- documented transient rate throttling, if total budget remains.

Non-retryable:

- CONFIGURATION;
- AUTHENTICATION;
- AUTHORIZATION;
- exhausted allocation/quota/budget;
- INVALID_INPUT;
- UNSUPPORTED_CAPABILITY;
- MALFORMED_RESPONSE;
- IDENTITY_MAPPING_FAILURE;
- PARTIAL_RESPONSE;
- UNKNOWN_PROVIDER_FAILURE unless a future official contract explicitly classifies the exact code retryable.

Duplicate-effect reasoning:

- reranking is a read-like external inference call with no Xiaoshuyin business write;
- retry does not duplicate business state;
- it may duplicate provider computation/billing, so attempts remain limited and each attempt is observable.
- provider request IDs from attempts may be recorded in sanitized live evidence if available.

Provider server-side timeout/unknown execution state is not documented; Slice 23 therefore owns only client timeout semantics.

## 15. Config / Secrets

- DASHSCOPE_API_KEY is the only credential required by the adapter.
- It is read lazily at live-call construction/use time from runtime environment and never committed.
- The base URL is non-secret but must be explicit and validated:
  - https only;
  - workspace-specific *.maas.aliyuncs.com host;
  - exact /api/v1 base path;
  - rerank endpoint path appended by adapter;
  - no per-request endpoint override.
- model id is fixed to qwen3-rerank in this Slice.
- no undocumented model revision is accepted as if verified.
- provider API key is never included in request/result/error/telemetry/evidence.
- Authorization header is constructed only at the transport boundary and is not serialized into logs/evidence.
- no .env file or .env.example change is planned.
- test credentials use non-secret placeholders and fake transport only.
- live verification requires an approved secret and egress path; absence is BLOCKED / NOT_EVALUATED, not PASS.

## 16. Offline Tests

New test entrypoints to create:

1. tests/ai/reranker-provider-contract.test.ts
   - one candidate
   - multiple candidates
   - unique caller IDs
   - duplicate ID reject
   - empty ID reject
   - empty candidate set reject
   - exact candidate text projection
   - deterministic output
   - equal-score tie -> input-index tie break
   - finite/range score
   - retry/timeout classification
   - no fallback
   - telemetry redaction
   - evidence state derivation

2. tests/ai/reranker-dashscope.test.ts
   - exact native request shape
   - qwen3-rerank model id
   - top_n == N
   - return_documents == false
   - exact instruct
   - request_id and usage parsing
   - valid index mapping
   - unknown index
   - duplicate index
   - out-of-range index
   - missing candidate
   - empty provider result
   - malformed JSON
   - wrong envelope/schema
   - string/null/NaN/Infinity score through parser-unit adversarial paths
   - score outside [0,1]
   - ambiguous/unexpected response shape
   - provider results not descending
   - partial response
   - provider error normalization

3. tests/architecture/reranker-provider-boundary.test.ts
   - only approved production seam exists
   - no provider SDK dependency/import
   - no direct provider call outside transport.ts
   - no app route/wiring
   - no DB/drizzle/redis/cache/migration/persistence
   - no retrieval/sparsevec/pg_jieba/RRF/fusion/Gold/eval/runtime
   - no generic gateway/registry/fallback
   - no business Domain object/type leakage
   - only index.ts exports public port types/functions
   - secrets/log payload redaction
   - forbidden changed-path checks.

Offline tests prove CONTRACT_MECHANICS only. They can never set LIVE_PROVIDER_CAPABILITY = PASS.

## 17. Live Verification

New opt-in entrypoint:

tests/ai/reranker-provider-live.test.ts

Invocation class:

~~~bash
RERANKER_LIVE_VERIFY=1 RERANKER_LIVE_EVIDENCE_PATH=/tmp/xiaoshuyin-s23-reranker-live.json bunx vitest run tests/ai/reranker-provider-live.test.ts
~~~

The test is not part of ordinary offline CI unless approved secret/egress is intentionally supplied.

Preconditions:

- T001 gate PASS;
- clean exact implementation head;
- approved DASHSCOPE_API_KEY;
- approved workspace-specific egress/base URL;
- exact qwen3-rerank candidate model;
- synthetic/permitted non-personal content;
- no family/minor/private data.

The live request uses a frozen technical query/candidate set and an explicit non-professional instruction. It MUST request all candidates via top_n=N.

Sanitized evidence must contain at least:

- repository exact head;
- tracked-tree clean state;
- provider = ALIBABA_DASHSCOPE;
- exact endpoint host/path identity or safe fingerprint;
- configured model id;
- configured model revision state;
- request mode/API surface;
- instruction SHA-256;
- timestamp;
- safe request fingerprint;
- candidate synthetic IDs;
- candidate count;
- provider request ID(s), if available;
- provider contract source identity/update date;
- normalized candidate IDs/scores/order;
- usage.total_tokens when returned;
- attempt count;
- latency;
- terminal error state if any;
- lower evidence states;
- aggregate state.

Evidence MUST NOT contain:

- API key;
- Authorization header;
- raw secret;
- full raw provider response;
- unnecessary raw query/candidate content;
- family/minor/private data.

State behavior:

- test not opted into -> LIVE_PROVIDER_CAPABILITY = NOT_EVALUATED;
- opted in but approved secret/egress missing -> BLOCKED;
- real response incompatible -> FAIL or UNKNOWN according to evidence;
- real exact-contract success -> PASS for this lower predicate only.

## 18. Evidence State Machine

Allowed state vocabulary only:

PASS | FAIL | BLOCKED | UNKNOWN | NOT_EVALUATED

Lower predicates:

1. CONTRACT_MECHANICS
2. LIVE_PROVIDER_CAPABILITY
3. CONFIG_IDENTITY
4. CLEANUP_SECRET_SAFETY
5. AGGREGATE_TECHNICAL_RESULT

Definitions:

CONTRACT_MECHANICS
- PASS only when focused offline contract/protocol/architecture suites pass.
- FAIL when implementation contract is mechanically wrong.
- UNKNOWN only if test evidence cannot be bound/interpreted.
- BLOCKED only if required local execution environment is unavailable.
- never inferred from live provider success.

LIVE_PROVIDER_CAPABILITY
- PASS only from a real provider call on exact head/config.
- FAIL for reproducible provider-contract incompatibility after valid access.
- BLOCKED for missing approved credential/egress/access.
- UNKNOWN for attempted but inconclusive/unexpected evidence.
- NOT_EVALUATED if live verification was not attempted.

CONFIG_IDENTITY
- PASS only when provider, API surface, endpoint identity, model id, request configuration and all known revision facts are explicit.
- Current official docs do not expose a documented immutable qwen3-rerank revision. Therefore the implementation must record modelRevision = null and immutableRevisionPin = UNKNOWN_NOT_DOCUMENTED.
- This unresolved production pin fact makes CONFIG_IDENTITY = UNKNOWN for production-pinnability; it MUST NOT be relabeled PASS by a Developer string.
- A future official immutable revision requires a controlled planning/spec reconciliation before production approval.

CLEANUP_SECRET_SAFETY
- PASS only when no secret/raw private data/persistence/residue is found and evidence location is outside committed source.
- FAIL if credential/content leakage or unauthorized persistence occurs.
- BLOCKED/UNKNOWN remain explicit if the scan cannot be completed.

AGGREGATE_TECHNICAL_RESULT is mechanically derived:
1. any FAIL -> FAIL;
2. else any BLOCKED -> BLOCKED;
3. else any UNKNOWN -> UNKNOWN;
4. else any NOT_EVALUATED -> NOT_EVALUATED;
5. else all lower predicates PASS -> PASS.

No Developer-set READY boolean exists. A technical aggregate PASS still does not mean production model approval, Gold quality PASS or route activation.

## 19. Exact-Head Binding

Any live evidence is valid only for:

(repository exact implementation head, tracked clean tree, provider, endpoint identity, model id/revision state, request mode/config, fixture fingerprint).

Rules:

- capture git rev-parse HEAD immediately before live execution;
- tracked working tree must be clean;
- evidence file is written outside the repository tree;
- evidence records exact head;
- final implementation head MUST equal evidence head;
- any production-code/test-contract change after live evidence invalidates that evidence;
- rerun live verification on the new final head if a live-provider PASS/FAIL claim is retained;
- evidence from a different head/config/model is invalid and cannot satisfy Audit 2.

## 20. Observability

Controlled observability is capability-local and whitelist-only.

Permitted telemetry fields:

- provider;
- configured model id/revision state;
- candidate count;
- attempt count;
- elapsed milliseconds;
- terminal technical state/error code;
- provider request ID when available;
- total token usage when available;
- safe config/request fingerprint.

Forbidden telemetry:

- API key/Authorization header;
- query/candidate raw text;
- instruct raw text;
- business object IDs unless synthetic test IDs;
- raw response body;
- Professional labels;
- inferred provider cost if provider does not return an exact cost fact.

No OTel/Phoenix/Langfuse integration and no new telemetry platform is authorized.

## 21. Scope Guard

Implementation changed-file allowlist is the production seam plus four named tests in §8 and exactly one required governance-metadata manifest at `.specify/change-bindings/023-reranker-provider-adapter-foundation.json`.

Hard STOP if diff contains:

- db/ or migration;
- package.json/bun.lock;
- app.ts/routes;
- packages/;
- scripts/;
- any `.specify/**` delta other than the single authorized manifest in §8, including ownership registry, governance validator/self-tests or a second manifest; a missing required manifest at final closeout is also a hard STOP;
- retrieval/RAG/fusion/Gold/Context/AI Runtime files;
- generic gateway/provider registry;
- another embedding adapter;
- provider fallback;
- route activation;
- professional labels/metrics/thresholds.

The governance prerequisite is a different PR and may modify only the ownership registry required by §7.

## 22. Verification Commands

The following commands are current repository commands or explicitly marked NEW test entrypoints.

Focused NEW tests:

~~~bash
bunx vitest run tests/ai/reranker-provider-contract.test.ts
bunx vitest run tests/ai/reranker-dashscope.test.ts
bunx vitest run tests/architecture/reranker-provider-boundary.test.ts
~~~

Optional controlled NEW live test:

~~~bash
RERANKER_LIVE_VERIFY=1 RERANKER_LIVE_EVIDENCE_PATH=/tmp/xiaoshuyin-s23-reranker-live.json bunx vitest run tests/ai/reranker-provider-live.test.ts
~~~

Current static/governance/type/regression commands:

~~~bash
node scripts/guard-static.mjs
node scripts/guard-static.mjs --self-test
node .specify/scripts/validate-governance.mjs
node .specify/scripts/tests/run-governance-tests.mjs
node .specify/scripts/validate-change-governance.mjs --base "$DEVELOPMENT_BASE" --head HEAD
node .specify/scripts/tests/run-change-governance-tests.mjs
bun run typecheck
bun run verify-all
~~~

Changed-file scan:

~~~bash
git diff --name-only "$DEVELOPMENT_BASE"...HEAD
specify_changed=$(git diff --name-only --no-renames "$DEVELOPMENT_BASE"...HEAD -- .specify) && test "$specify_changed" = '.specify/change-bindings/023-reranker-provider-adapter-foundation.json'
git diff --exit-code "$DEVELOPMENT_BASE"...HEAD -- .specify/implementation-ownership.json .specify/scripts/
~~~

The exact path equality must exit 0 and proves the entire changed .specify path set is the one authorized manifest (no second manifest or other .specify file); the explicit zero-diff check proves the ownership registry and all governance scripts/self-tests remain unchanged. Run the change-governance validator above on the same committed final exact HEAD; its exit 0 is mandatory.

Secret/scope scan is mechanically owned by tests/architecture/reranker-provider-boundary.test.ts; it must inspect the allowed changed implementation/tests for literal credential material, Authorization values, provider SDK dependencies, forbidden imports and forbidden scopes. It is run by the focused architecture command above and again by verify-all if included in the repository-wide Vitest run.

Expected results:
- all commands exit 0, except live provider test may truthfully end in an evidence state other than PASS without being rewritten as success;
- changed files are a subset of §8 (production/test paths plus the single required manifest) plus frozen planning artifacts already present on the branch; no new planning mutation is authorized;
- the `.specify` changed-path set is exactly the authorized manifest; ownership registry and governance scripts/self-tests are unchanged; no other `.specify` delta; change governance exits 0.

## Verification Plan

Consolidated mechanical verification contract summarizing §16–§19 and §22 (no change to test semantics):

| Verification Track | Required Entrypoint(s) / Command(s) | Scope & Evidence Semantics |
|---|---|---|
| Focused offline contract & protocol suite | `bunx vitest run tests/ai/reranker-provider-contract.test.ts`; `bunx vitest run tests/ai/reranker-dashscope.test.ts` | Proves `CONTRACT_MECHANICS` only on synthetic/non-personal fixtures (input validation, identity mapping, strict response parsing, finite scores, tie break, error taxonomy, bounded retry, redaction, state-machine precedence). Never sets `LIVE_PROVIDER_CAPABILITY = PASS`. |
| Architecture & negative-scope boundary suite | `bunx vitest run tests/architecture/reranker-provider-boundary.test.ts` | Proves seam isolation (`apps/server/api/src/ai/reranker/`), zero provider SDK dependency, egress only in `transport.ts`, `index.ts`-only public exports, zero DB/persistence/route/retrieval/Gold/gateway/fallback/secret leakage/READY override. |
| Optional controlled live provider verification | `RERANKER_LIVE_VERIFY=1 RERANKER_LIVE_EVIDENCE_PATH=/tmp/xiaoshuyin-s23-reranker-live.json bunx vitest run tests/ai/reranker-provider-live.test.ts` | Opt-in only on clean exact `HEAD` with approved `DASHSCOPE_API_KEY`, approved workspace base URL, `qwen3-rerank`, `top_n=N`, `return_documents=false`, and safe synthetic fixtures. Absent opt-in -> `NOT_EVALUATED`; missing secret/egress -> `BLOCKED`; incompatible contract -> `FAIL`/`UNKNOWN`. Evidence written outside repo with SHA-256. |
| Repository static, governance & full regression gates | `node scripts/guard-static.mjs`; `node scripts/guard-static.mjs --self-test`; `node .specify/scripts/validate-governance.mjs`; `node .specify/scripts/tests/run-governance-tests.mjs`; `node .specify/scripts/validate-change-governance.mjs --base "$DEVELOPMENT_BASE" --head HEAD`; `node .specify/scripts/tests/run-change-governance-tests.mjs`; `bun run typecheck`; `bun run verify-all` | Exact-head verification of static guard (unchanged), Spec/Change governance, TypeScript compilation, and canonical repository regression. |
| Diff & exact-head provenance closeout | `git diff --name-only "$DEVELOPMENT_BASE"...HEAD`; exit-0 diffs on `package.json`, `bun.lock`, `apps/server/api/package.json`, `apps/server/api/src/app.ts`, `apps/server/api/src/routes`, `db`, `.specify/implementation-ownership.json`, `.specify/scripts/`; exact `.specify` changed-path equality to the single authorized manifest per §22 | Confirms allowlist compliance and exact-head binding for independent Audit 2 handoff (`T011`–`T012`). |

## 23. STOP Conditions

Developer MUST STOP before further mutation if any of the following is true:

1. Frozen Spec blob != 4354ecac585d3d6c675c629d5304faf9422cf5b1.
2. Authority Docs conflict with the Frozen Spec.
3. current main introduces a competing 023/reranker owner or implementation.
4. governance prerequisite for apps/server/api/src/ai/reranker/ is absent/not independently audited/not merged.
5. official provider contract no longer supports the planned endpoint/request/response/model semantics.
6. implementation requires guessing provider identity/index/score/partial semantics.
7. qwen3-rerank is no longer a supported candidate and changing model would be required.
8. a provider SDK/new package dependency becomes necessary.
9. a generic gateway/provider registry is required.
10. DB persistence/migration/cache is required.
11. retrieval, sparsevec, pg_jieba, RRF, fusion, hard-filter runtime or A/B/C evaluation becomes necessary.
12. Professional/Gold truth would need to be invented.
13. a route/app.ts/user-facing API must be activated.
14. real family/minor/private content is required.
15. evidence cannot distinguish FAIL/BLOCKED/UNKNOWN/NOT_EVALUATED.
16. exact-head binding cannot be proven.
17. implementation diff escapes the allowlist.
18. secrets appear in repository/log/evidence.
19. production model pinning is claimed despite the currently undocumented immutable qwen3-rerank revision.

## 24. Developer Handoff

Developer receives only after corrected Spec/Plan/Checklist/Tasks are admitted to main and the separate governance prerequisite is independently audited and merged:

- exact current development base;
- Frozen Spec head/blob;
- Planning Freeze head and plan/checklist/tasks blobs;
- exact implementation allowlist;
- exact governance ownership rule required/merged;
- official provider source list and verified/unknown contract table;
- NATIVE_HTTP decision;
- input/output/error/retry/evidence contracts;
- verification commands;
- STOP conditions.

Developer must execute tasks in order, never skip T001, and stop after preparing the Audit 2 package. Developer must not perform Audit 2.

## 25. Exact Requirement Traceability

| FR | Plan sections | Checklist | Tasks |
|---|---|---|---|
| FR-001 | 3,8,9,10 | C23-FR-001 | T002,T006,T008 |
| FR-002 | 5,6,15 | C23-FR-002 | T001,T003,T005 |
| FR-003 | 9,11 | C23-FR-003 | T002,T006,T008 |
| FR-004 | 10,11 | C23-FR-004 | T005,T006,T008 |
| FR-005 | 5,9,15,18,19 | C23-FR-005 | T001,T003,T007,T010 |
| FR-006 | 5,10,11 | C23-FR-006 | T005,T008 |
| FR-007 | 10,12 | C23-FR-007 | T005,T006,T008 |
| FR-008 | 10,12 | C23-FR-008 | T006,T008 |
| FR-009 | 5,10,11 | C23-FR-009 | T005,T006,T008 |
| FR-010 | 13 | C23-FR-010 | T003,T004,T005,T008 |
| FR-011 | 14 | C23-FR-011 | T004,T008 |
| FR-012 | 3,8,21 | C23-FR-012 | T009,T011 |
| FR-013 | 16,17 | C23-FR-013 | T008,T010 |
| FR-014 | 16,18 | C23-FR-014 | T007,T008,T010 |
| FR-015 | 17,19 | C23-FR-015 | T010,T011,T012 |
| FR-016 | 12,21 | C23-FR-016 | T009,T011,T012 |
| FR-017 | 3,21 | C23-FR-017 | T009,T011 |
| FR-018 | 3,4,6,21 | C23-FR-018 | T001,T009,T011 |
| FR-019 | 15,17,20 | C23-FR-019 | T003,T007,T010 |
| FR-020 | 13,18,23 | C23-FR-020 | T001,T007,T011,T012 |

Acceptance traceability:

| AS | Checklist | Tasks |
|---|---|---|
| AS-01 | C23-AS-01 | T002,T005,T006,T008 |
| AS-02 | C23-AS-02 | T010 |
| AS-03 | C23-AS-03 | T005,T008 |
| AS-04 | C23-AS-04 | T005,T008 |
| AS-05 | C23-AS-05 | T005,T008 |
| AS-06 | C23-AS-06 | T005,T008 |
| AS-07 | C23-AS-07 | T003,T007,T010 |
| AS-08 | C23-AS-08 | T003,T004,T010 |
| AS-09 | C23-AS-09 | T007,T008,T011 |
| AS-10 | C23-AS-10 | T009,T012 |
| AS-11 | C23-AS-11 | T009,T011 |
| AS-12 | C23-AS-12 | T009,T011 |
| AS-13 | C23-AS-13 | T009,T011 |
| AS-14 | C23-AS-14 | T009,T011 |
| AS-15 | C23-AS-15 | T010,T011,T012 |

Non-goal traceability:

- retrieval/RAG/RRF/fusion/hard filter runtime -> §3/§21 + T009/T011 STOP.
- Gold/professional evaluation -> §3/§12/§21 + T009/T011/T012 STOP.
- generic Model Gateway -> §3/§6/§21 + architecture test/T009.
- persistence/DB migration -> §3/§8/§21 + architecture test/T009.
- route activation -> §3/§8/§21 + architecture test/T009.
- model fallback -> §14/§21 + contract test/T004/T008.
- Professional truth creation -> §2/§12/§23 + T009/T012.

## Planning Decision

- FR coverage planned: 20/20.
- AS coverage planned: 15/15.
- Governance prerequisite: REQUIRED.
- Current implementation gate: BLOCKED until corrected Spec/Plan/Checklist/Tasks are admitted to main, the separate reranker ownership governance prerequisite is independently audited and merged, and Developer T001 current-main reconciliation passes.
- Provider contract: PARTIAL due immutable qwen3-rerank revision/latest-alias/server-timeout/partial-failure semantics being undocumented; no guess is permitted.
- Transport: NATIVE_HTTP.
- Professional Authority gap: PRESERVED.
- Production reranker approval: NOT AUTHORIZED.
