# Slice 23 — Mechanical Acceptance Checklist

Repository: pyxm1618/xiaoshuyin  
Feature: 023-reranker-provider-adapter-foundation  
Frozen Spec blob: 311511af1cfcda979d2b6896103c0a0c1d227b0b

Every item is binary/mechanical. “Looks correct”, “reasonable”, “seems aligned” are not acceptance criteria.

## A. Development-start / Authority / Governance

- [ ] C23-G01 — Frozen Spec blob. Command: git rev-parse HEAD:specs/023-reranker-provider-adapter-foundation/spec.md. Expected: 311511af1cfcda979d2b6896103c0a0c1d227b0b at the development branch after current-main reconciliation. Evidence owner: T001 gate record.
- [ ] C23-G02 — Frozen Spec exact source commit is preserved in ancestry. Command: git merge-base --is-ancestor 8fae7497df58446ad034d2986168f6a912444eb3 HEAD. Expected exit 0. Evidence owner: T001.
- [ ] C23-G03 — Current main captured. Command: git rev-parse origin/main. Expected: exact SHA recorded in T001 evidence; no historical SHA assumed. Evidence owner: T001.
- [ ] C23-G04 — Planning Freeze exact head/blobs recorded and read back from remote before development. Expected: values equal Plan AI 2 final report. Evidence owner: T001.
- [ ] C23-G05 — No competing 023 implementation. Commands: remote branch/PR search + git grep -nE "qwen3-rerank|reranker" -- apps packages. Expected: no competing production owner outside authorized seam. Evidence owner: T001.
- [ ] C23-G06 — Authority blobs re-read. Expected four Docs blobs match current admitted Authority or any change is explicitly assessed as non-conflicting; otherwise STOP. Evidence owner: T001.
- [ ] C23-G07 — Provider contract source re-read from official Alibaba Cloud pages. Expected endpoint/request/response/index/score/top_n/model facts still support Plan §5. Evidence owner: T001.
- [ ] C23-G08 — Current qwen3-rerank immutable revision remains documented or explicitly UNKNOWN. Expected: no guessed revision/“-latest” claim. Evidence owner: T001/T010.
- [ ] C23-G09 — Separate ownership prerequisite exists on current main. Expected .specify/implementation-ownership.json resolves PREFIX apps/server/api/src/ai/reranker/ to feature 023-reranker-provider-adapter-foundation and no broader parent rule was introduced. Evidence owner: T001.
- [ ] C23-G10 — Governance prerequisite was independently audited and merged before product implementation. Evidence: merged PR URL/merge SHA + independent governance verdict. Evidence owner: T001.
- [ ] C23-G11 — Implementation PR does not modify ownership registry. Command: git diff --name-only "$DEVELOPMENT_BASE"...HEAD | grep -F ".specify/implementation-ownership.json". Expected no output. Evidence owner: T011.
- [ ] C23-G12 — Change governance. Command: node .specify/scripts/validate-change-governance.mjs --base "$DEVELOPMENT_BASE" --head HEAD. Expected exit 0. Evidence owner: T011.
- [ ] C23-G13 — Governance validator. Command: node .specify/scripts/validate-governance.mjs. Expected exit 0. Evidence owner: T011.
- [ ] C23-G14 — Governance self-tests. Command: node .specify/scripts/tests/run-governance-tests.mjs. Expected exit 0. Evidence owner: T011.
- [ ] C23-G15 — Change-governance self-tests. Command: node .specify/scripts/tests/run-change-governance-tests.mjs. Expected exit 0. Evidence owner: T011.

## B. FR-001 .. FR-020

- [ ] C23-FR-001 — Capability-specific port. Exact paths: apps/server/api/src/ai/reranker/index.ts + contracts.ts. Test: bunx vitest run tests/ai/reranker-provider-contract.test.ts. Expected downstream normalized types contain no provider-native output/result/index envelope. Evidence owner: T002/T006/T008.
- [ ] C23-FR-002 — First candidate only. Static test must prove configured provider/model is ALIBABA_DASHSCOPE/qwen3-rerank and no alternative production model/fallback list exists. Command: bunx vitest run tests/architecture/reranker-provider-boundary.test.ts. Evidence owner: T003/T009.
- [ ] C23-FR-003 — Unique caller identity. Contract test must reject empty/whitespace-only candidateId and exact duplicate candidateId with provider call count 0. Evidence owner: T002/T008.
- [ ] C23-FR-004 — Exact identity preservation. DashScope tests must prove provider index i maps only to the exact input candidateId at i; unknown/duplicate/out-of-range indices fail closed. Evidence owner: T005/T008.
- [ ] C23-FR-005 — Exact provider/model/config provenance. Evidence record contains provider, API surface, endpoint identity/fingerprint, model id, revision state, instruction fingerprint, timeout/retry constants. Immutable qwen3-rerank revision is not fabricated. Evidence owner: T003/T007/T010.
- [ ] C23-FR-006 — Strict response validation. tests/ai/reranker-dashscope.test.ts rejects invalid JSON, missing output.results, wrong field types, alternate/conflicting envelopes and unexpected structural shapes. Evidence owner: T005/T008.
- [ ] C23-FR-007 — Finite documented scores. Tests reject non-number, null, NaN, Infinity and values outside [0,1]; no replacement/default. Evidence owner: T005/T008.
- [ ] C23-FR-008 — Deterministic normalized order. Tests prove descending score and exact-score tie break by original input index ascending; rank=1..N. Evidence owner: T006/T008.
- [ ] C23-FR-009 — Partial response fail-closed. Adapter sets top_n=N; tests prove result count <N or empty result on non-empty request yields PARTIAL_RESPONSE, not success. Evidence owner: T005/T006/T008.
- [ ] C23-FR-010 — Error normalization. Tests cover CONFIGURATION, AUTHENTICATION, AUTHORIZATION, RATE_LIMIT, TIMEOUT, PROVIDER_UNAVAILABLE, MALFORMED_RESPONSE, UNSUPPORTED_CAPABILITY, INVALID_INPUT, IDENTITY_MAPPING_FAILURE, PARTIAL_RESPONSE, UNKNOWN_PROVIDER_FAILURE. Evidence owner: T003/T004/T005/T008.
- [ ] C23-FR-011 — Bounded retry. Fake transport test proves maxAttempts=2, backoff=1000ms, no third call, no fallback, non-retryable categories call provider once. Evidence owner: T004/T008.
- [ ] C23-FR-012 — No persistence. Architecture test proves no db/drizzle/pg/redis/cache/migration import/use and changed-file list contains no db/. Evidence owner: T009/T011.
- [ ] C23-FR-013 — Safe fixture content. Offline/live test fixtures are synthetic/permitted and contain no family/minor/private/professional label data. Evidence owner: T008/T010.
- [ ] C23-FR-014 — Offline/live separation. Pure fixture tests can set only CONTRACT_MECHANICS. State-machine test proves fixture PASS cannot make LIVE_PROVIDER_CAPABILITY PASS. Evidence owner: T007/T008.
- [ ] C23-FR-015 — Truthful live evidence. Live test only sets PASS after actual HTTP success on exact head/config; not-run=NOT_EVALUATED; missing approved credential/egress=BLOCKED. Evidence owner: T010.
- [ ] C23-FR-016 — No Gold quality claim. Architecture/scope scan finds zero metric/winner/approval semantics: Recall, MRR, nDCG, Precision, uplift, professionally correct, route winner, relevant threshold. Evidence owner: T009/T011.
- [ ] C23-FR-017 — No route activation. Changed-file scan contains no route/app.ts/TaskModelRegistry/rag_route_version/rerank_route_version activation. Evidence owner: T009/T011.
- [ ] C23-FR-018 — No duplicate provider foundation. Architecture test proves no embedding adapter/provider path and no generic gateway/provider registry/fallback orchestration. Evidence owner: T009/T011.
- [ ] C23-FR-019 — Controlled observability. Telemetry test proves whitelist fields only and excludes query, candidate text, instruct text, API key, Authorization header, raw provider body; unknown cost is not manufactured. Evidence owner: T007/T008/T010.
- [ ] C23-FR-020 — Failure remains valid. State-machine tests prove reproducible incompatibility can terminate FAIL/UNKNOWN/BLOCKED without model switch/validation relaxation/scope widening. Evidence owner: T007/T011/T012.

## C. AS-01 .. AS-15

- [ ] C23-AS-01 — Offline valid one/multiple candidate cases. Command: bunx vitest run tests/ai/reranker-provider-contract.test.ts tests/ai/reranker-dashscope.test.ts. Expected exact all-candidate normalized result. Evidence owner: T008.
- [ ] C23-AS-02 — Controlled live technical verification. Command when authorized: RERANKER_LIVE_VERIFY=1 RERANKER_LIVE_EVIDENCE_PATH=/tmp/xiaoshuyin-s23-reranker-live.json bunx vitest run tests/ai/reranker-provider-live.test.ts. Expected truthful lower state, never synthetic PASS. Evidence owner: T010.
- [ ] C23-AS-03 — Missing provider candidate -> PARTIAL_RESPONSE. Fake response length N-1. Expected no RerankResult. Evidence owner: T005/T008.
- [ ] C23-AS-04 — Unknown/duplicate provider item -> IDENTITY_MAPPING_FAILURE. Expected no inferred mapping. Evidence owner: T005/T008.
- [ ] C23-AS-05 — Malformed/ambiguous response -> MALFORMED_RESPONSE. Expected no permissive parser/fallback envelope. Evidence owner: T005/T008.
- [ ] C23-AS-06 — Invalid numeric score -> MALFORMED_RESPONSE. Expected no default score. Evidence owner: T005/T008.
- [ ] C23-AS-07 — Missing/unpinned configuration. Expected CONFIG_IDENTITY remains UNKNOWN for production pinnability while official immutable qwen3-rerank revision is undocumented; never READY. Evidence owner: T003/T007/T010.
- [ ] C23-AS-08 — Provider unavailable. Fake/live evidence maps missing credential/egress/service to CONFIGURATION/BLOCKED/PROVIDER_UNAVAILABLE as applicable and never switches provider/model. Evidence owner: T004/T010.
- [ ] C23-AS-09 — Mock laundering prevention. State test proves CONTRACT_MECHANICS=PASS + LIVE_PROVIDER_CAPABILITY=NOT_EVALUATED + CONFIG_IDENTITY=UNKNOWN + CLEANUP_SECRET_SAFETY=PASS => AGGREGATE_TECHNICAL_RESULT=UNKNOWN exactly, by the frozen precedence; never PASS. Evidence owner: T007/T008.
- [ ] C23-AS-10 — Gold authority still missing does not block adapter mechanics but blocks quality/production claim. Handoff explicitly records Gold/Professional Authority gap. Evidence owner: T012.
- [ ] C23-AS-11 — Professional truth laundering. Architecture/scope scan rejects professional correctness/approval/Gold label semantics. Evidence owner: T009/T011.
- [ ] C23-AS-12 — Retrieval scope creep. Changed-file/static scan rejects dense retrieval, sparsevec, pg_jieba, RRF, fusion, hard-filter runtime and A/B/C evaluator code. Evidence owner: T009/T011.
- [ ] C23-AS-13 — Persistence creep. No db/migration/cache/readiness/result store. Evidence owner: T009/T011.
- [ ] C23-AS-14 — Generic provider platform creep. No Model Gateway/provider registry/multi-provider fallback/framework. Evidence owner: T009/T011.
- [ ] C23-AS-15 — Exact-head evidence. Live evidence head equals final implementation head; any post-evidence implementation change invalidates prior live evidence and forces rerun. Evidence owner: T010/T011/T012.

## D. Input / Provider Projection

- [ ] C23-I01 — query non-empty; invalid query produces INVALID_INPUT and zero transport calls. Evidence owner: T002/T008.
- [ ] C23-I02 — candidate count 1..500; 0 and >500 reject before network. Evidence owner: T002/T008.
- [ ] C23-I03 — candidateId exact preservation; no trim/rewrite/hash as downstream identity. Evidence owner: T002/T008.
- [ ] C23-I04 — duplicate candidate text is accepted and distinguished by position/ID. Evidence owner: T002/T008.
- [ ] C23-I05 — candidateText blank rejects; nonblank exact bytes are projected in input order. Evidence owner: T002/T008.
- [ ] C23-I06 — instruct is required by the internal contract, non-empty and exact; no implicit provider default used in accepted request. Evidence owner: T002/T008.
- [ ] C23-I07 — caller cannot pass API key, endpoint, model override, provider override or timeout/retry override in RerankRequest. Evidence owner: T002/T009.
- [ ] C23-I08 — top_n is always candidate count and return_documents is always false. Evidence owner: T005/T008.
- [ ] C23-I09 — token-count limits are not guessed from character length; provider InvalidParameter/over-limit 400 -> INVALID_INPUT. Evidence owner: T005/T008.

## E. Output / Identity / Ordering

- [ ] C23-O01 — success result length equals input candidate count. Evidence owner: T006/T008.
- [ ] C23-O02 — each input candidateId appears exactly once. Evidence owner: T006/T008.
- [ ] C23-O03 — provider index never appears in public result type. Evidence owner: T002/T009.
- [ ] C23-O04 — rank is 1..N after deterministic normalization. Evidence owner: T006/T008.
- [ ] C23-O05 — provider response must be non-increasing by score before tie normalization. Evidence owner: T005/T008.
- [ ] C23-O06 — equal scores order by original input index ascending. Evidence owner: T006/T008.
- [ ] C23-O07 — request_id non-empty and usage.total_tokens nonnegative integer for accepted live/provider success. Evidence owner: T005/T008.
- [ ] C23-O08 — no threshold/approved/relevant/professional flag exists in output. Evidence owner: T002/T009.

## F. Timeout / Retry / Error

- [ ] C23-R01 — transport uses explicit AbortController/client deadline, 10,000ms per attempt. Evidence owner: T004/T008.
- [ ] C23-R02 — at most 2 attempts. Evidence owner: T004/T008.
- [ ] C23-R03 — second attempt only after 1,000ms policy backoff and only if budget remains. Evidence owner: T004/T008.
- [ ] C23-R04 — 401 never retries. Evidence owner: T004/T008.
- [ ] C23-R05 — 403 never retries. Evidence owner: T004/T008.
- [ ] C23-R06 — InvalidParameter/400 never retries. Evidence owner: T004/T008.
- [ ] C23-R07 — quota/budget exhaustion 429 never retries. Evidence owner: T004/T008.
- [ ] C23-R08 — transient throttling may retry once, no fallback. Evidence owner: T004/T008.
- [ ] C23-R09 — 503 ServiceUnavailable/ModelUnavailable may retry once. Evidence owner: T004/T008.
- [ ] C23-R10 — malformed/partial/identity errors never retry because a second identical semantic response must not be used to hide contract failure. Evidence owner: T004/T008.
- [ ] C23-R11 — UNKNOWN_PROVIDER_FAILURE is terminal unless exact official code is explicitly classified. Evidence owner: T004/T008.

## G. Secrets / Observability / Evidence

- [ ] C23-S01 — DASHSCOPE_API_KEY appears only as environment variable name/config access, never literal credential. Architecture scan expected no sk-* credential literals outside explicit fake placeholders. Evidence owner: T009/T011.
- [ ] C23-S02 — Authorization header value cannot appear in telemetry/error/evidence snapshots. Evidence owner: T007/T008/T010.
- [ ] C23-S03 — raw query/candidate/instruct content absent from telemetry and live evidence. Evidence owner: T007/T010.
- [ ] C23-S04 — live evidence stored outside repository, e.g. /tmp/xiaoshuyin-s23-reranker-live.json. Evidence owner: T010.
- [ ] C23-S05 — live evidence records exact repo head, clean tree, provider, endpoint identity/fingerprint, model/revision state, instruction fingerprint, safe request fingerprint, candidate IDs, result scores/order, request ID, usage, attempts, timestamp and terminal states. Evidence owner: T010.
- [ ] C23-S06 — live evidence has SHA-256 included in Audit 2 handoff. Evidence owner: T012.
- [ ] C23-S07 — cost not returned by provider is recorded UNKNOWN/not emitted; no pricing multiplication in adapter. Evidence owner: T007/T009.

## H. Evidence State Machine

- [ ] C23-E01 — only PASS/FAIL/BLOCKED/UNKNOWN/NOT_EVALUATED are accepted lower/aggregate state values. Evidence owner: T007/T008.
- [ ] C23-E02 — CONTRACT_MECHANICS derives from offline suites only. Evidence owner: T007/T008.
- [ ] C23-E03 — LIVE_PROVIDER_CAPABILITY PASS requires real opt-in live call. Evidence owner: T007/T010.
- [ ] C23-E04 — CONFIG_IDENTITY cannot declare production pinnability PASS while immutable qwen3-rerank revision remains undocumented. Evidence owner: T007/T010.
- [ ] C23-E05 — CLEANUP_SECRET_SAFETY requires redaction/scope/no-persistence checks. Evidence owner: T007/T011.
- [ ] C23-E06 — aggregate derivation precedence: FAIL > BLOCKED > UNKNOWN > NOT_EVALUATED > PASS. Table-driven tests cover every branch. Evidence owner: T007/T008.
- [ ] C23-E07 — no READY field/string controls outcome. Evidence owner: T007/T009.

## I. Scope / Static / Full Regression

- [ ] C23-X01 — Changed files subset. Command: git diff --name-only "$DEVELOPMENT_BASE"...HEAD. Expected only Plan §8 production/test paths plus already-frozen specs. Evidence owner: T011.
- [ ] C23-X02 — Static guard. Command: node scripts/guard-static.mjs. Expected exit 0. Evidence owner: T009/T011.
- [ ] C23-X03 — Static guard self-test. Command: node scripts/guard-static.mjs --self-test. Expected exit 0. Evidence owner: T009/T011.
- [ ] C23-X04 — Typecheck. Command: bun run typecheck. Expected exit 0. Evidence owner: T011.
- [ ] C23-X05 — Canonical full regression. Command: bun run verify-all. Expected exit 0. Evidence owner: T011.
- [ ] C23-X06 — package.json and bun.lock unchanged. Command: git diff --exit-code "$DEVELOPMENT_BASE"...HEAD -- package.json bun.lock apps/server/api/package.json. Expected exit 0. Evidence owner: T011.
- [ ] C23-X07 — app.ts/routes unchanged. Command: git diff --exit-code "$DEVELOPMENT_BASE"...HEAD -- apps/server/api/src/app.ts apps/server/api/src/routes. Expected exit 0. Evidence owner: T011.
- [ ] C23-X08 — db unchanged. Command: git diff --exit-code "$DEVELOPMENT_BASE"...HEAD -- db. Expected exit 0. Evidence owner: T011.
- [ ] C23-X09 — no .specify delta in implementation PR. Command: git diff --exit-code "$DEVELOPMENT_BASE"...HEAD -- .specify. Expected exit 0. Evidence owner: T011.
- [ ] C23-X10 — no retrieval/Gold/runtime platform scope. Architecture test command exits 0. Evidence owner: T009/T011.

## J. Audit 2 Handoff / Terminal Discipline

- [ ] C23-H01 — Handoff records exact development base and exact implementation head. Evidence owner: T012.
- [ ] C23-H02 — Handoff records Frozen Spec head/blob and Plan/Checklist/Tasks blobs. Evidence owner: T012.
- [ ] C23-H03 — Handoff records complete changed-file list. Evidence owner: T012.
- [ ] C23-H04 — Handoff records governance prerequisite PR/merge/audit evidence. Evidence owner: T012.
- [ ] C23-H05 — Handoff records official provider contract sources and all UNKNOWN items, especially immutable revision pinning. Evidence owner: T012.
- [ ] C23-H06 — Handoff records focused tests, static/governance/typecheck/verify-all outputs. Evidence owner: T012.
- [ ] C23-H07 — Handoff records live evidence state; NOT_EVALUATED/BLOCKED/UNKNOWN is preserved and not marketed as PASS. Evidence owner: T012.
- [ ] C23-H08 — Handoff records exact-head binding and evidence SHA-256 if live evidence exists. Evidence owner: T012.
- [ ] C23-H09 — Handoff records Professional Gold/Reviewer gap as preserved. Evidence owner: T012.
- [ ] C23-H10 — Developer STOP after package creation; no Audit 2, merge, route activation or production claim. Evidence owner: T012.

## Completion Gate

Checklist acceptance requires:

- FR: 20/20 checked;
- AS: 15/15 checked;
- all Governance/Scope/Secret/Evidence/Regression items checked or truthfully marked BLOCKED/NOT_EVALUATED where the contract allows;
- no lower non-PASS state is overwritten by prose;
- exact implementation head is stable;
- Developer stops for a new independent Audit 2 model.
