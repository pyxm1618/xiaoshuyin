# Slice 23 — Developer Tasks

Feature: 023-reranker-provider-adapter-foundation  
Frozen Spec head: 092c18d514d46a1e4e40f3544d428302cde00fa8 (superseded historical head: 8fae7497df58446ad034d2986168f6a912444eb3)  
Frozen Spec blob: 4354ecac585d3d6c675c629d5304faf9422cf5b1 (superseded historical blob: 311511af1cfcda979d2b6896103c0a0c1d227b0b)

These tasks implement only the reranker provider adapter technical capability foundation. They do not authorize the governance prerequisite, Audit 2, merge, production route activation, Gold evaluation, or production model approval.

## Frozen Spec Authority Map

Mechanical traceability from every Slice 23 task (`T001`–`T012`) to Frozen Spec (`spec.md` head `092c18d514d46a1e4e40f3544d428302cde00fa8`, blob `4354ecac585d3d6c675c629d5304faf9422cf5b1`) requirements, acceptance scenarios, invariants, and exit criteria:

| Task | Frozen Spec Authority (FR / AS / Invariants / Upstream IDs) | Plan Section(s) | Exit Criteria |
|---|---|---|---|
| T001 | `FR-002`, `FR-005`, `FR-018`, `FR-020`; `AS-07`, `AS-08`, `AS-15`; `§9.2`, `§10 #1/#2/#13/#15`, `§16.1`–`§16.3`; `V1-C03`, `V1-C27`, `V1-X14` | §1, §4, §5, §7, §23 | Signed Developer preflight recording exact `DEVELOPMENT_BASE`, Frozen Spec blob `4354ecac...`, admitted planning freeze blobs, merged narrow ownership rule, provider contract validity, cross-slice test-boundary check, and `IMPLEMENTATION_GATE = OPEN` (or `BLOCKED` stop). |
| T002 | `FR-001`, `FR-003`, `FR-004`, `FR-007`, `FR-008`; `AS-01`, `AS-06`; `§10 #3/#9`; `V1-C24`, `V1-C37` | §8, §9, §10, §11 | Provider-neutral `RerankRequest` / `RerankResult` & input validation (`contracts.ts`, `index.ts`) rejecting blank/duplicate/out-of-range inputs with zero transport calls and zero provider-native/business-object leakage. |
| T003 | `FR-002`, `FR-005`, `FR-010`, `FR-019`; `AS-07`, `AS-08`; `§10 #1/#2/#11`; `V1-C03`, `V1-C27`, `V1-X11` | §5, §9, §13, §15 | Capability-local error taxonomy and lazy secret / strict base-URL config (`config.ts`, `errors.ts`) recording `qwen3-rerank` + `UNKNOWN_NOT_DOCUMENTED` revision without touching central error handler or `.env*`. |
| T004 | `FR-010`, `FR-011`, `FR-018`; `AS-08`, `AS-14`; `§10 #10/#11/#15`; `V1-C27`, `V1-C28` | §6, §14, §15 | Injectable `NATIVE_HTTP` transport (`transport.ts`) enforcing `10000ms` per-attempt deadline, max `2` attempts, `1000ms` backoff, retryable-only taxonomy, and zero fallback/SDK imports. |
| T005 | `FR-004`, `FR-005`, `FR-006`, `FR-007`, `FR-009`, `FR-010`; `AS-03`–`AS-06`; `§10 #1/#3`; `V1-C03`, `V1-C27` | §5, §10, §11, §12, §13 | Strict DashScope request builder & parser (`dashscope.ts`) enforcing `top_n=N`, `return_documents=false`, index-to-`candidateId` mapping, descending score order, `[0,1]` finite scores, and fail-closed `PARTIAL_RESPONSE` / `IDENTITY_MAPPING_FAILURE` / `MALFORMED_RESPONSE`. |
| T006 | `FR-001`, `FR-003`, `FR-004`, `FR-007`, `FR-008`, `FR-009`, `FR-012`; `AS-01`, `AS-03`, `AS-04`; `§10 #3/#4/#5/#14`; `V1-C24`, `V1-C28` | §9, §10, §11, §12 | Stateless rerank orchestration (`rerank.ts`, `index.ts`) delivering deterministic score-desc + input-index tie-break normalization (`rank=1..N`) with zero cache/persistence/route wiring. |
| T007 | `FR-005`, `FR-014`, `FR-015`, `FR-019`, `FR-020`; `AS-07`, `AS-09`, `AS-15`; `§10 #1/#11/#13`, `§16.3`; `V1-C03`, `V1-X11`, `V1-X14` | §17, §18, §19, §20 | Whitelist-only telemetry (`telemetry.ts`) and pure 5-state evidence machine (`evidence.ts`: `FAIL > BLOCKED > UNKNOWN > NOT_EVALUATED > PASS`) with `UNKNOWN_NOT_DOCUMENTED` revision guard and zero `READY` override. |
| T008 | `FR-001`, `FR-003`–`FR-011`, `FR-013`, `FR-014`, `FR-019`, `FR-020`; `AS-01`, `AS-03`–`AS-09`; `§10 #1/#3/#10/#12`, `## Acceptance Evidence`; `V1-C03`, `V1-C27`, `V1-C28`, `V1-X14` | §16, §18 | Complete remaining cross-module/adversarial offline coverage after T002–T007 focused RED/GREEN gates in the contract & DashScope fixture test suites (`tests/ai/reranker-provider-contract.test.ts`, `tests/ai/reranker-dashscope.test.ts`) passing with zero network/secrets and proving `CONTRACT_MECHANICS` only. |
| T009 | `FR-012`, `FR-016`, `FR-017`, `FR-018`, `FR-019`; `AS-10`, `AS-11`, `AS-12`, `AS-13`, `AS-14`; `§10 #4`–`#9/#14/#15`, `## Acceptance Evidence`; `V1-C24`, `V1-C34`, `V1-C37` | §3, §8, §16, §21 | Boundary & negative-scope architecture test (`tests/architecture/reranker-provider-boundary.test.ts`) + passing `guard-static.mjs` and `--self-test` proving zero DB/SDK/route/retrieval/Gold/gateway/secret violations. |
| T010 | `FR-005`, `FR-013`, `FR-014`, `FR-015`, `FR-019`, `FR-020`; `AS-02`, `AS-07`, `AS-08`, `AS-15`; `§10 #1/#11/#12/#13`, `## Acceptance Evidence`; `V1-C03`, `V1-C27`, `V1-X11`, `V1-X14` | §17, §18, §19 | Controlled opt-in live verification (`tests/ai/reranker-provider-live.test.ts`) recording external sanitized JSON + SHA-256 bound to clean exact `HEAD`, or preserving truthful `NOT_EVALUATED` / `BLOCKED` / `FAIL` / `UNKNOWN`. |
| T011 | `FR-012`, `FR-014`–`FR-020`; `AS-09`–`AS-15`; `§9.2`, `§10 #1/#13`, `§16.3`, `## Acceptance Evidence`; `V1-C03`, `V1-C27`, `V1-X14` | §21, §22 | All mandatory offline, architecture, static guard, governance, typecheck, `verify-all`, and diff-allowlist checks passing on stable final exact `HEAD` with exact-head live-evidence validity verified. |
| T012 | `FR-015`, `FR-016`, `FR-020`; `AS-10`, `AS-15`; `§16.3`, `## Acceptance Evidence`; `V1-C24`, `V1-C34`, `V1-X14` | §24, §25 | Complete independent Audit 2 handoff package binding exact `DEVELOPMENT_BASE`, final `HEAD`, Frozen Spec/Planning blobs, governance PR, provider sources/unknowns, test/guard outputs, preserved Gold/Reviewer gap, and Developer `STOP`. |

## Acceptance Evidence Contract

Aligned with Frozen Spec (`092c18d514d46a1e4e40f3544d428302cde00fa8` / `4354ecac585d3d6c675c629d5304faf9422cf5b1`) `## Acceptance Evidence`, completion of any Slice 23 task requires concrete repository/runtime artifacts owned by designated tasks (narrative claims never substitute for evidence):

| Evidence Category | Designated Evidence Owner(s) | Required Verifiable Evidence Contract |
|---|---|---|
| Governance & preflight gate evidence | `T001` (gate open/blocked), `T011` (final governance checks) | Remote read-back of admitted Spec/Plan/Checklist/Tasks blobs, merged narrow `.specify/implementation-ownership.json` PR/merge SHA/audit verdict, cross-slice test-boundary check, and exit-0 outputs from `validate-governance.mjs`, `run-governance-tests.mjs`, `validate-change-governance.mjs`, and `run-change-governance-tests.mjs`. |
| Offline contract & protocol evidence | `T002`–`T007` (module surfaces and task-owned focused RED/GREEN evidence), `T008` (adversarial matrix completion) | Per-task named focused tests with observed RED before production edits and GREEN before advancing, plus complete offline matrix test execution outputs of `bunx vitest run tests/ai/reranker-provider-contract.test.ts` and `bunx vitest run tests/ai/reranker-dashscope.test.ts` on synthetic/non-personal fixtures proving `CONTRACT_MECHANICS` only (never `LIVE_PROVIDER_CAPABILITY = PASS`). |
| Live-provider truthfulness evidence | `T010` (execution & external JSON), `T012` (handoff provenance) | When opted in via `RERANKER_LIVE_VERIFY=1`, external sanitized JSON at `RERANKER_LIVE_EVIDENCE_PATH` + SHA-256 bound to exact `HEAD`, clean tracked tree, provider/endpoint fingerprint, `qwen3-rerank` / `UNKNOWN_NOT_DOCUMENTED` revision state, request ID(s), usage, attempts, and lower/aggregate states; when unconfigured/not opted in, truthful `BLOCKED` / `NOT_EVALUATED` / `UNVERIFIED`. |
| Exact-head & regression evidence | `T010`, `T011`, `T012` | Final exact `HEAD` matching any live evidence head (`AS-15`), plus exit-0 outputs from `bun run typecheck` and `bun run verify-all` on that exact `HEAD`. |
| Scope-negative & secret/non-persistence evidence | `T009`, `T011` | Exit-0 outputs from `bunx vitest run tests/architecture/reranker-provider-boundary.test.ts`, `node scripts/guard-static.mjs`, `node scripts/guard-static.mjs --self-test`, `git diff --name-only "$DEVELOPMENT_BASE"...HEAD` allowlist check, and zero-diff checks on `package.json`, `bun.lock`, `apps/server/api/package.json`, `app.ts`, `routes`, `db`, and `.specify`. |
| Audit 2 handoff evidence | `T012` | Complete provenance bundle containing base/head SHAs, Spec/Planning blobs, changed files, governance prerequisite evidence, official provider source list + `UNKNOWN` items, offline/live/regression outputs, preserved `APPROVED PROFESSIONAL REVIEWER — UNASSIGNED` & Gold Eval `BLOCKED` state, and explicit Developer `STOP`. |

## T001 — Development-start Remote Truth / Governance / Dependency Gate

**Purpose**  
Re-establish exact remote truth and mechanically decide whether Developer mutation is authorized.

**Prerequisites**
- Corrected Spec/Plan/Checklist/Tasks are admitted to `main`.
- Plan AI 2 Audit 1 = FINAL PASS.
- Separate reranker ownership governance prerequisite (`apps/server/api/src/ai/reranker/` -> `023-reranker-provider-adapter-foundation`) is independently audited and merged to `main`.

**Allowed Paths**
- No repository mutation.
- Read-only Git/GitHub/provider-doc/governance inspection only.

**Forbidden Paths**
- All production/test/governance mutation.
- No merge, registry edit, provider call, route activation or implementation.

**Actions**
1. Fetch origin and record current origin/main.
2. Verify Frozen Spec exact blob = 4354ecac585d3d6c675c629d5304faf9422cf5b1.
3. Verify Frozen Spec commit 092c18d514d46a1e4e40f3544d428302cde00fa8 remains in planning lineage (preserving historical ancestor 8fae7497df58446ad034d2986168f6a912444eb3).
4. Record Planning Freeze exact head and plan/checklist/tasks blobs; verify they equal the Plan AI 2 handoff.
5. Re-read four Authority Doc blobs and classify any drift.
6. Re-read Slice 18–22 current states; verify no owner now absorbs Slice 23, and verify whether `tests/architecture/embedding-provider-boundary.test.ts` on current main still enforces an exclusive `/DASHSCOPE_|maas\.aliyuncs\.com|ALIBABA_DASHSCOPE/` scan outside `ai/embedding/` that would block `bun run verify-all` without modifying Slice 20 artifacts.
7. Search branches/PRs/current tree for competing 023/reranker implementation.
8. Re-read official Alibaba qwen3-rerank API, model, error and rate-limit pages.
9. Verify qwen3-rerank still supports native HTTP request/response semantics frozen in Plan §5.
10. Verify exact candidate model identity remains qwen3-rerank; record immutable revision/latest-alias status truthfully as documented/undocumented.
11. Re-read .specify/implementation-ownership.json and prove apps/server/api/src/ai/reranker/ resolves to 023-reranker-provider-adapter-foundation through one narrow rule.
12. Record governance prerequisite PR, merge SHA and independent governance audit verdict.
13. Verify scripts/guard-static.mjs and change-governance behavior still permit the planned native-HTTP seam without a new provider SDK allowance.
14. Define DEVELOPMENT_BASE = exact current origin/main after all prerequisite merges.
15. Confirm approved credential/egress availability status for optional live verification; absence does not block offline implementation, but must be recorded.

**Verification**
- git rev-parse origin/main -> exact DEVELOPMENT_BASE recorded.
- git rev-parse HEAD:specs/023-reranker-provider-adapter-foundation/spec.md -> 4354ecac585d3d6c675c629d5304faf9422cf5b1 after reconciliation.
- git merge-base --is-ancestor 092c18d514d46a1e4e40f3544d428302cde00fa8 HEAD -> exit 0.
- ownership resolution is narrow and unique for apps/server/api/src/ai/reranker/.
- provider contract facts still match the Plan or every changed fact is returned to planning.
- no competing implementation and no unresolved cross-slice test collision blocking `verify-all`.
- behind=0 before T002 mutation; ordinary merge reconciliation only, no rebase/force rewrite of Frozen lineage.

**Done Criteria**
- A signed/recorded Developer preflight states IMPLEMENTATION_GATE = OPEN and includes exact DEVELOPMENT_BASE, Frozen Spec identity, Planning Freeze identities, governance prerequisite evidence, provider contract status and live-credential state.
- If any prerequisite is absent, gate is BLOCKED and no T002+ action occurs.

**STOP Conditions**
- Frozen Spec drift.
- Authority conflict.
- Planning artifact drift.
- governance prerequisite missing, unaudited, unmerged, broad or ambiguous.
- competing 023 implementation/owner.
- provider contract now contradicts the frozen request/response/index/model semantics.
- implementation would require an undocumented provider guess.
- qwen3-rerank would need to be silently replaced.
- current main requires a different production seam or generic provider abstraction.

**Evidence Ownership**
- T001 Developer preflight report: main/base/head/merge-base, four Authority blobs, Frozen Spec blob, Planning Freeze blobs, governance PR/merge/audit, provider source identities, contract status, live prerequisite status, implementation gate.

**Coverage**
- FR-002, FR-005, FR-018, FR-020; AS-07, AS-08, AS-15.

---

## T002 — Implement Public Reranker Capability Contract and Input Validation

**Purpose**  
Create the provider-neutral capability input/output boundary without provider-native leakage or business-object ownership.

**Prerequisites**
- T001 IMPLEMENTATION_GATE = OPEN.

**Allowed Paths**
- apps/server/api/src/ai/reranker/index.ts
- apps/server/api/src/ai/reranker/contracts.ts

- tests/ai/reranker-provider-contract.test.ts (focused tests for T002; add before production edits).

**Forbidden Paths**
- all other files in this task;
- provider HTTP call;
- process.env/secret access;
- app.ts/routes;
- DB/persistence;
- retrieval/Gold/fusion/runtime types;
- provider-native response types in public exports.

**Actions**

**RED — before any production code change for this task**
1. First add named focused tests for this task's frozen deterministic behavior: public contract and input validation: exact identities/text/instruct, duplicate text allowed, blank/duplicate IDs and invalid candidate counts/query/text/instruct rejected before any transport; test the available validation seam without depending on later modules.
2. Run `bunx vitest run tests/ai/reranker-provider-contract.test.ts` (or the same command with a named-test filter) and record the expected failure caused by the missing behavior, not an unrelated setup or environment failure. Use synthetic fixtures/fakes only; do not require later-task production modules.

**GREEN**
3. Implement only the minimum allowed production behavior required by the focused tests, following the implementation details below.
4. Rerun exactly the same focused test command/filter and record PASS; rerun the full touched test file to preserve all earlier focused tests.
5. PASS before proceeding to the next task. Do not weaken assertions or defer this gate to T008.

Implementation details for GREEN step 3:
1. Define RerankRequest exactly as Plan §9: query, candidates[{candidateId,candidateText}], options.instruct.
2. Define normalized RerankResult exactly as Plan §10, with candidateId/score/rank and provider/config provenance, never provider index.
3. Validate query non-empty without rewriting exact text.
4. Validate candidate count 1..500.
5. Validate candidateId non-empty and unique by exact string equality; preserve exact bytes.
6. Validate candidateText non-empty; preserve exact bytes; permit duplicate text.
7. Validate instruct non-empty; preserve exact bytes.
8. Reject caller-supplied provider/model/endpoint/API key/timeout/retry override by type surface: those fields must not exist in RerankRequest.
9. Export only capability-facing types/functions through index.ts; do not export provider transport/protocol.
10. Do not include any relevance threshold, approval, Gold, professional, business state or route field.

**Verification**
- RED then GREEN: same named focused test(s) and same command/filter; expected missing-behavior failure before production edits, exit 0 afterward; full touched test file exits 0 before advancing.
- T002 owns and runs the focused contract tests for its input boundary in RED and GREEN; later architecture verification remains T009.
- Architecture test after T009 proves public output has no provider-native index/envelope and no business-object leakage.
- Invalid query, zero candidates, >500 candidates, blank/duplicate IDs, blank text/instruct must fail INVALID_INPUT with transport call count 0.

**Done Criteria**
- T002 focused tests were added and observed RED before its production edits, then GREEN on the same tests with earlier tests passing; both outputs and test names are retained before advancing.
- Public contract can represent valid one/multiple candidate reranking and fail all frozen input invalidities without any provider invocation.

**STOP Conditions**
- contract needs Case/Knowledge/Evidence/Consent/Safety/business object types.
- caller must select provider/model/endpoint.
- empty candidates need an inferred success semantics not in Plan.
- downstream must see provider-native result/index shape.

**Evidence Ownership**
- contracts.ts/index.ts blobs + T002 named focused contract tests and RED/GREEN command outputs + T009 public-boundary scan.

**Coverage**
- FR-001, FR-003, FR-004, FR-007, FR-008; AS-01, AS-06.

---

## T003 — Implement Capability-local Config, Errors and Secret Boundary

**Purpose**  
Freeze exact provider/config provenance and technical failure taxonomy without touching business Domain errors.

**Prerequisites**
- T002 contract exists.
- T001 provider contract still valid.

**Allowed Paths**
- apps/server/api/src/ai/reranker/config.ts
- apps/server/api/src/ai/reranker/errors.ts
- minimal type imports from contracts.ts.

- tests/ai/reranker-provider-contract.test.ts (focused tests for T003; add before production edits).

**Forbidden Paths**
- apps/server/api/src/plugins/error-handler.ts
- apps/server/api/src/runtime-env.ts
- package manifests;
- .env files;
- central Domain error taxonomy;
- model/provider fallback registry.

**Actions**

**RED — before any production code change for this task**
1. First add named focused tests for this task's frozen deterministic behavior: capability-local config and error behavior: exact provider/model and unknown revision, lazy secret access, strict base URL, safe error metadata and missing config distinct from authentication; exercise only the config/error seam, not future HTTP/parser behavior.
2. Run `bunx vitest run tests/ai/reranker-provider-contract.test.ts` (or the same command with a named-test filter) and record the expected failure caused by the missing behavior, not an unrelated setup or environment failure. Use synthetic fixtures/fakes only; do not require later-task production modules.

**GREEN**
3. Implement only the minimum allowed production behavior required by the focused tests, following the implementation details below.
4. Rerun exactly the same focused test command/filter and record PASS; rerun the full touched test file to preserve all earlier focused tests.
5. PASS before proceeding to the next task. Do not weaken assertions or defer this gate to T008.

Implementation details for GREEN step 3:
1. Define exactly the technical error codes:
   CONFIGURATION, AUTHENTICATION, AUTHORIZATION, RATE_LIMIT, TIMEOUT, PROVIDER_UNAVAILABLE, MALFORMED_RESPONSE, UNSUPPORTED_CAPABILITY, INVALID_INPUT, IDENTITY_MAPPING_FAILURE, PARTIAL_RESPONSE, UNKNOWN_PROVIDER_FAILURE.
2. Errors expose safe code/retryable/providerRequestId-if-safe metadata only; never raw response, query/text/instruct or credential.
3. Define capability config:
   - provider ALIBABA_DASHSCOPE;
   - modelId qwen3-rerank;
   - modelRevision null;
   - immutableRevisionPinStatus UNKNOWN_NOT_DOCUMENTED while official docs remain so;
   - native HTTP API surface;
   - approved workspace-specific base URL;
   - DASHSCOPE_API_KEY runtime secret;
   - attemptTimeoutMs=10000;
   - maxAttempts=2;
   - retryBackoffMs=1000.
4. Load secret lazily from environment only when the live/default transport is constructed/called.
5. Validate base URL: https, workspace-specific .maas.aliyuncs.com host, exact /api/v1 base path; no per-request override.
6. Do not accept a caller/provider model override.
7. Do not manufacture a model revision, latest alias, cost or provider model echo.
8. Distinguish missing config from provider authentication failure.

**Verification**
- RED then GREEN: same named focused test(s) and same command/filter; expected missing-behavior failure before production edits, exit 0 afterward; full touched test file exits 0 before advancing.
- T003 owns focused config/error tests and runs them in RED and GREEN; full provider error matrix remains T008.
- T009 architecture test proves central error handler/runtime-env/package manifests unchanged and no credential literals.
- T010 evidence records exact model revision state rather than invented version.

**Done Criteria**
- T003 focused tests were added and observed RED before its production edits, then GREEN on the same tests with earlier tests passing; both outputs and test names are retained before advancing.
- All technical failures are capability-local and exact provider/model/config provenance is representable without claiming production pinning.

**STOP Conditions**
- a business HTTP/Domain error must be modified.
- an undocumented model revision must be invented.
- a generic provider registry is required.
- secret would need to be committed or logged.

**Evidence Ownership**
- config.ts/errors.ts blobs + T003 named focused error/config tests and RED/GREEN command outputs + T009 secret/error boundary scan.

**Coverage**
- FR-002, FR-005, FR-010, FR-019; AS-07, AS-08.

---

## T004 — Implement Native HTTP Transport, Timeout and Bounded Retry

**Purpose**  
Create one injectable native HTTP transport with bounded client-time behavior and no silent fallback.

**Prerequisites**
- T003 config/error taxonomy frozen.

**Allowed Paths**
- apps/server/api/src/ai/reranker/transport.ts
- minimal imports from config.ts/errors.ts/contracts.ts.

- tests/ai/reranker-provider-contract.test.ts (focused tests for T004; add before production edits).

**Forbidden Paths**
- provider SDK imports;
- package.json/bun.lock;
- generic HTTP/provider gateway;
- retries outside the frozen policy;
- fallback provider/model;
- logs/raw response persistence.

**Actions**

**RED — before any production code change for this task**
1. First add named focused tests for this task's frozen deterministic behavior: native transport using fake HTTP/clock: per-attempt deadline, max two attempts, 1000ms backoff, retryable versus terminal categories and zero provider/model fallback.
2. Run `bunx vitest run tests/ai/reranker-provider-contract.test.ts` (or the same command with a named-test filter) and record the expected failure caused by the missing behavior, not an unrelated setup or environment failure. Use synthetic fixtures/fakes only; do not require later-task production modules.

**GREEN**
3. Implement only the minimum allowed production behavior required by the focused tests, following the implementation details below.
4. Rerun exactly the same focused test command/filter and record PASS; rerun the full touched test file to preserve all earlier focused tests.
5. PASS before proceeding to the next task. Do not weaken assertions or defer this gate to T008.

Implementation details for GREEN step 3:
1. Define a narrow injectable transport interface used by tests and the DashScope protocol module.
2. Default implementation uses global fetch/native runtime HTTP.
3. Construct Authorization: Bearer secret only at send time.
4. Use AbortController/client deadline of 10,000 ms per attempt.
5. Enforce at most 2 total attempts.
6. Wait exactly 1,000 ms before the second attempt, only if total budget remains.
7. Retry only:
   - connection failure/no response;
   - TIMEOUT;
   - documented temporary ServiceUnavailable/ModelUnavailable;
   - documented transient throttle classes.
8. Do not retry:
   - authentication/authorization;
   - invalid input;
   - quota/budget exhaustion;
   - unsupported capability;
   - malformed/partial/identity response;
   - unknown provider failure without explicit official classification.
9. Preserve provider request ID from failed HTTP response when safe and available.
10. Never switch provider/model.
11. Do not claim a provider server timeout semantic; only client timeout is owned here.

**Verification**
- RED then GREEN: same named focused test(s) and same command/filter; expected missing-behavior failure before production edits, exit 0 afterward; full touched test file exits 0 before advancing.
- T004 focused fake-transport tests assert attempt counts, deadlines, 1000ms backoff, retry categories, terminal categories and zero fallback in RED/GREEN; T008 completes the retry/error matrix.
- T009 architecture test proves no SDK dependency/import and only transport.ts performs egress.

**Done Criteria**
- T004 focused tests were added and observed RED before its production edits, then GREEN on the same tests with earlier tests passing; both outputs and test names are retained before advancing.
- every call has a hard bounded attempt count/deadline and retry behavior is mechanically testable.

**STOP Conditions**
- official SDK becomes mandatory for required capability.
- retry requires a queue/scheduler/platform.
- provider error cannot be classified without guessing and code attempts to retry anyway.
- generic transport framework would be introduced.

**Evidence Ownership**
- transport.ts blob + T004 named focused retry/timeout tests and RED/GREEN command outputs.

**Coverage**
- FR-010, FR-011, FR-018; AS-08, AS-14.

---

## T005 — Implement DashScope Request Mapping and Strict Response Parser

**Purpose**  
Encode only the verified native qwen3-rerank provider contract and fail closed on identity/shape ambiguity.

**Prerequisites**
- T002/T003/T004 complete.
- official Text Rerank API still matches Plan §5.

**Allowed Paths**
- apps/server/api/src/ai/reranker/dashscope.ts
- minimal imports from contracts/config/errors/transport.

- tests/ai/reranker-dashscope.test.ts (focused tests for T005; add before production edits).

**Forbidden Paths**
- OpenAI-compatible rerank surface;
- SDK response types;
- recursive/permissive score finder;
- provider shape fallback;
- business/retrieval code.

**Actions**

**RED — before any production code change for this task**
1. First add named focused tests for this task's frozen deterministic behavior: native request projection and strict parser: top_n=N, return_documents=false, exact instruct, valid identity/score/usage mapping, partial result, invalid index/score/schema and error normalization fail closed as frozen.
2. Run `bunx vitest run tests/ai/reranker-dashscope.test.ts` (or the same command with a named-test filter) and record the expected failure caused by the missing behavior, not an unrelated setup or environment failure. Use synthetic fixtures/fakes only; do not require later-task production modules.

**GREEN**
3. Implement only the minimum allowed production behavior required by the focused tests, following the implementation details below.
4. Rerun exactly the same focused test command/filter and record PASS; rerun the full touched test file to preserve all earlier focused tests.
5. PASS before proceeding to the next task. Do not weaken assertions or defer this gate to T008.

Implementation details for GREEN step 3:
1. Build endpoint by appending /services/rerank/text-rerank/text-rerank to the validated /api/v1 base URL.
2. Build request body exactly:
   - model=qwen3-rerank;
   - input.query exact;
   - input.documents candidateText in input order;
   - parameters.top_n=N;
   - parameters.return_documents=false;
   - parameters.instruct exact.
3. Parse JSON only from the native DashScope success envelope.
4. Require non-empty request_id.
5. Require output.results array.
6. Require usage.total_tokens non-negative integer.
7. Require results.length=N for success.
8. Require each index integer and in range 0..N-1.
9. Require each index exactly once and complete 0..N-1 coverage.
10. Require relevance_score numeric, finite and in [0,1].
11. Require provider results non-increasing by relevance_score as documented.
12. Map provider index only to exact input candidate identity; never text-match.
13. Error mapping:
   - shorter valid results -> PARTIAL_RESPONSE;
   - duplicate/out-of-range/non-integer index -> IDENTITY_MAPPING_FAILURE;
   - invalid JSON/wrong envelope/invalid fields/ordering/score -> MALFORMED_RESPONSE.
14. Parse documented error code/message/request_id safely and map through T003 taxonomy.
15. Reject ambiguous/alternate result envelopes instead of precedence guessing.
16. Do not require a provider model/version echo because it is not documented.

**Verification**
- RED then GREEN: same named focused test(s) and same command/filter; expected missing-behavior failure before production edits, exit 0 afterward; full touched test file exits 0 before advancing.
- T005 runs its focused DashScope request/parser tests in RED and GREEN, covering valid request/response and representative fail-closed identity, partial, malformed, numeric and error cases.
- T008 completes the full matrix: valid one/many, reorder, ties, request shape, unknown/duplicate/missing/out-of-range index, malformed JSON/schema, string/null/NaN/Infinity/out-of-range score, partial/empty results, unexpected envelope, descending-order violation and error mapping.

**Done Criteria**
- T005 focused tests were added and observed RED before its production edits, then GREEN on the same tests with earlier tests passing; both outputs and test names are retained before advancing.
- a provider response produces a normalized intermediate result only if every candidate maps exactly once under the verified contract.

**STOP Conditions**
- provider docs and observed live contract conflict materially.
- a response can be accepted only by guessing an identity or alternate envelope.
- provider requires a different model or undocumented field.

**Evidence Ownership**
- dashscope.ts blob + T005 named focused provider fixture tests and RED/GREEN command outputs + official provider source identities; T008 owns remaining adversarial matrix evidence.

**Coverage**
- FR-004, FR-005, FR-006, FR-007, FR-009, FR-010; AS-03, AS-04, AS-05, AS-06.

---

## T006 — Implement Deterministic Rerank Orchestration and Normalized Output

**Purpose**  
Compose validation, config, transport and provider parsing into one stateless capability call with exact deterministic output semantics.

**Prerequisites**
- T002–T005 complete.

**Allowed Paths**
- apps/server/api/src/ai/reranker/rerank.ts
- apps/server/api/src/ai/reranker/index.ts only for final public factory/export wiring.

- tests/ai/reranker-provider-contract.test.ts (focused tests for T006; add before production edits).

**Forbidden Paths**
- app.ts/routes;
- DB/cache;
- retrieval/fusion;
- threshold/approval logic;
- fallback model/provider.

**Actions**

**RED — before any production code change for this task**
1. First add named focused tests for this task's frozen deterministic behavior: stateless capability orchestration using fake transport: validation before egress, one/many candidates, provider reorder, exact-score tie by original input index, rank 1..N, all-candidate exact identity and no partial success.
2. Run `bunx vitest run tests/ai/reranker-provider-contract.test.ts` (or the same command with a named-test filter) and record the expected failure caused by the missing behavior, not an unrelated setup or environment failure. Use synthetic fixtures/fakes only; do not require later-task production modules.

**GREEN**
3. Implement only the minimum allowed production behavior required by the focused tests, following the implementation details below.
4. Rerun exactly the same focused test command/filter and record PASS; rerun the full touched test file to preserve all earlier focused tests.
5. PASS before proceeding to the next task. Do not weaken assertions or defer this gate to T008.

Implementation details for GREEN step 3:
1. Validate input before transport.
2. Resolve exact capability config.
3. Invoke DashScope transport through the narrow internal seam.
4. Require all-candidate provider contract from T005.
5. Normalize public results:
   - score descending;
   - exact equal-score tie break by original input index ascending;
   - rank 1..N;
   - candidateId exact;
   - no provider index.
6. Preserve configured provider/model/revision state and request ID/usage in normalized result.
7. Keep call stateless: no cross-request cache/result store.
8. Do not compare scores across requests or apply threshold/top-N business policy.
9. Export only the public capability function/factory through index.ts.

**Verification**
- RED then GREEN: same named focused test(s) and same command/filter; expected missing-behavior failure before production edits, exit 0 afterward; full touched test file exits 0 before advancing.
- T006 focused contract tests prove one/many candidate success, provider reorder, exact-score ties, duplicate candidate text and all-candidate coverage in RED and GREEN.
- T009 proves no persistence/retrieval/route wiring.

**Done Criteria**
- T006 focused tests were added and observed RED before its production edits, then GREEN on the same tests with earlier tests passing; both outputs and test names are retained before advancing.
- one capability call returns exactly one normalized result for every input candidate or one technical failure; no partial success object.

**STOP Conditions**
- a threshold/business meaning is required.
- a cache/store is proposed.
- retrieval candidate generation becomes necessary.
- deterministic tie behavior cannot be implemented from exact input identity.

**Evidence Ownership**
- rerank.ts/index.ts blobs + T006 named focused normalized-output tests and RED/GREEN command outputs.

**Coverage**
- FR-001, FR-003, FR-004, FR-007, FR-008, FR-009, FR-012; AS-01, AS-03, AS-04.

---

## T007 — Implement Controlled Telemetry and Mechanical Evidence State Machine

**Purpose**  
Make technical truth derivation and observability explicit without content/secret leakage or READY laundering.

**Prerequisites**
- T003 config/errors and T006 normalized result contract complete.

**Allowed Paths**
- apps/server/api/src/ai/reranker/telemetry.ts
- apps/server/api/src/ai/reranker/evidence.ts

- tests/ai/reranker-provider-contract.test.ts (focused tests for T007; add before production edits).

**Forbidden Paths**
- telemetry platform integration;
- DB/file persistence in production code;
- raw query/document/instruct logging;
- manual aggregate PASS/READY override.

**Actions**

**RED — before any production code change for this task**
1. First add named focused tests for this task's frozen deterministic behavior: pure evidence state precedence, offline/live separation, unknown revision guard and whitelist-only telemetry excluding raw content/secrets and invented cost.
2. Run `bunx vitest run tests/ai/reranker-provider-contract.test.ts` (or the same command with a named-test filter) and record the expected failure caused by the missing behavior, not an unrelated setup or environment failure. Use synthetic fixtures/fakes only; do not require later-task production modules.

**GREEN**
3. Implement only the minimum allowed production behavior required by the focused tests, following the implementation details below.
4. Rerun exactly the same focused test command/filter and record PASS; rerun the full touched test file to preserve all earlier focused tests.
5. PASS before proceeding to the next task. Do not weaken assertions or defer this gate to T008.

Implementation details for GREEN step 3:
1. Define whitelist telemetry record containing only:
   provider, configured model/revision state, candidate count, attempt count, elapsed ms, terminal technical state/error code, provider request ID if available, totalTokens if available, safe fingerprints.
2. Exclude API key, Authorization, raw query/candidates/instruct and raw response.
3. Do not compute provider cost from public pricing; unavailable cost stays unknown/absent.
4. Implement state vocabulary exactly PASS/FAIL/BLOCKED/UNKNOWN/NOT_EVALUATED.
5. Implement lower predicates:
   CONTRACT_MECHANICS, LIVE_PROVIDER_CAPABILITY, CONFIG_IDENTITY, CLEANUP_SECRET_SAFETY.
6. CONFIG_IDENTITY records immutableRevisionPinStatus=UNKNOWN_NOT_DOCUMENTED while official qwen3-rerank revision remains undocumented and therefore cannot imply production pinnability.
7. Implement pure deriveAggregateTechnicalResult with precedence:
   FAIL > BLOCKED > UNKNOWN > NOT_EVALUATED > PASS.
8. Prohibit a mutable READY boolean or string from determining state.
9. Ensure mock/offline inputs cannot set LIVE_PROVIDER_CAPABILITY=PASS.

**Verification**
- RED then GREEN: same named focused test(s) and same command/filter; expected missing-behavior failure before production edits, exit 0 afterward; full touched test file exits 0 before advancing.
- T007 focused state/telemetry tests cover precedence, mock-laundering, unknown revision and telemetry redaction in RED/GREEN; T008 completes the state table and adversarial cases.
- T009 static scan rejects READY override and content/secret telemetry.

**Done Criteria**
- T007 focused tests were added and observed RED before its production edits, then GREEN on the same tests with earlier tests passing; both outputs and test names are retained before advancing.
- aggregate result is a pure deterministic function of lower evidence and no prose/manual flag can promote it.

**STOP Conditions**
- state depends on subjective interpretation.
- live/offline provenance cannot be separated.
- telemetry needs a new platform.
- raw content/secret would need to be retained.

**Evidence Ownership**
- evidence.ts/telemetry.ts blobs + T007 named focused state-machine/telemetry tests and RED/GREEN command outputs.

**Coverage**
- FR-005, FR-014, FR-015, FR-019, FR-020; AS-07, AS-09, AS-15.

---

## T008 — Complete Cross-module / Adversarial Offline Contract and Provider Fixture Test Matrix

**Purpose**  
Complete the cross-module / adversarial offline matrix after T002–T007 have already established focused test-first coverage. Prove contract mechanics adversarially without network, real credentials, Gold data or Professional truth. This is not first test creation.

**Prerequisites**
- T002–T007 implementation surfaces and task-owned focused tests exist; all six RED/GREEN gates have passed and evidence is recorded.

**Allowed Paths**
- tests/ai/reranker-provider-contract.test.ts
- tests/ai/reranker-dashscope.test.ts

**Forbidden Paths**
- network calls;
- real secrets;
- DB;
- Gold Dataset/professional labels;
- family/minor/private content;
- live-provider PASS evidence.

**Actions**
1. Extend the existing focused suites with missing valid cases; retain earlier focused tests:
   - one candidate;
   - multiple candidates;
   - deterministic provider reorder;
   - finite scores;
   - exact-score tie;
   - valid index mapping;
   - duplicate text with distinct IDs.
2. Complete missing invalid input cases:
   - empty query;
   - empty candidate set;
   - >500 candidates;
   - empty ID;
   - duplicate ID;
   - blank candidate text;
   - blank instruct.
3. Complete missing adversarial provider cases:
   - unknown result index;
   - duplicate result index;
   - missing candidate;
   - out-of-range/non-integer index;
   - malformed JSON;
   - wrong/ambiguous/unexpected schema;
   - NaN/Infinity/string/null/out-of-range score;
   - partial/empty result;
   - descending-order contract violation.
4. Complete provider error taxonomy tests for 400/401/403/404/429/5xx and unknown failure.
5. Complete retry/timeout tests with deterministic fake transport/clock where appropriate:
   - max 2 attempts;
   - 1000ms backoff;
   - transient vs terminal categories;
   - zero provider/model fallback.
6. Complete telemetry redaction cases.
7. Complete evidence-state table tests, including offline PASS + live NOT_EVALUATED cannot aggregate PASS.
8. Assert fake transport never reads a real API key and never creates live evidence.
9. Complete cross-module adversarial cases across the existing seams. Do not edit production code in T008; if a new case exposes missing frozen deterministic behavior, retain the failing test and return to the owning T002–T007 task for its bounded RED/GREEN correction, then rerun affected gates before completing T008.

**Verification**
- bunx vitest run tests/ai/reranker-provider-contract.test.ts
- bunx vitest run tests/ai/reranker-dashscope.test.ts
- both exit 0 with no network access.

**Done Criteria**
- every Checklist B/D/E/F/H offline item has at least one named test and all focused and adversarial tests pass; prior task-owned RED/GREEN evidence remains intact.
- only CONTRACT_MECHANICS can become PASS from this task.

**STOP Conditions**
- a missing case can only be tested against the real provider.
- fixture requires professional relevance judgment.
- a test marks provider live capability PASS.
- a test relaxes the contract to make malformed response succeed.

**Evidence Ownership**
- two test blobs + complete adversarial/cross-module Vitest output + test-name-to-checklist mapping, retaining the T002–T007 task-owned focused RED/GREEN evidence.

**Coverage**
- FR-001, FR-003..FR-011, FR-013, FR-014, FR-019, FR-020; AS-01, AS-03..AS-09.

---

## T009 — Build Architecture / Static Scope Guard Tests

**Purpose**  
Mechanically prove the implementation remains one narrow capability seam and does not become RAG, persistence or a provider platform.

**Prerequisites**
- T002–T008 complete.

**Allowed Paths**
- tests/architecture/reranker-provider-boundary.test.ts

**Forbidden Paths**
- production changes in this task;
- guard rule modification;
- governance registry modification.

**Actions**
1. Freeze approved production path prefix apps/server/api/src/ai/reranker/.
2. Assert no package.json/bun.lock provider SDK dependency and no dashscope/@alicloud provider SDK import.
3. Assert external egress construction occurs only in transport.ts.
4. Assert only index.ts is the public capability surface; provider protocol/transport are internal.
5. Assert no app.ts/route registration.
6. Assert no db/drizzle/pg/redis/cache/migration/readiness/result store.
7. Assert no retrieval, sparsevec, pg_jieba, RRF, fusion, hard-filter runtime, A/B/C evaluator, Context Builder, AI Task Runtime, TaskModelRegistry or Promptfoo platform code.
8. Assert no generic Model Gateway/provider registry/multi-provider fallback.
9. Assert no embedding adapter/provider path is created.
10. Assert no Gold metrics/thresholds/professional correctness/route winner semantics.
11. Assert no Case/Knowledge/Evidence/Consent/Safety/Professional-label business object leakage in public port.
12. Assert no credential literal, Authorization value, raw-content telemetry/evidence field.
13. Assert no READY override controls evidence.
14. Run repository static guard and self-test after the architecture test passes.

**Verification**
- bunx vitest run tests/architecture/reranker-provider-boundary.test.ts -> exit 0.
- node scripts/guard-static.mjs -> exit 0.
- node scripts/guard-static.mjs --self-test -> exit 0.

**Done Criteria**
- every scope/secret/static item in Checklist I and AS-11..AS-14 is mechanically covered and passes.

**STOP Conditions**
- passing requires editing scripts/guard-static.mjs.
- a new package/dependency or wider ownership path is needed.
- architecture test reveals any forbidden product scope.

**Evidence Ownership**
- architecture test blob + focused output + guard output + guard-self-test output.

**Coverage**
- FR-012, FR-016, FR-017, FR-018, FR-019; AS-10..AS-14.

---

## T010 — Controlled Optional Live Provider Verification

**Purpose**  
Produce truthful live qwen3-rerank capability evidence for the exact implementation head/config when approved access exists, or preserve BLOCKED/NOT_EVALUATED truth when it does not.

**Prerequisites**
- T002–T009 pass.
- exact implementation head committed.
- tracked tree clean.
- provider contract re-read immediately before run.
- only synthetic/permitted technical content.
- approved DASHSCOPE_API_KEY and egress/base URL if attempting live verification.

**Allowed Paths**
- tests/ai/reranker-provider-live.test.ts
- runtime evidence path outside repository, e.g. /tmp/xiaoshuyin-s23-reranker-live.json

**Forbidden Paths**
- committed evidence artifact;
- production code changes during/after evidence run without rerun;
- real family/minor/private data;
- Gold/professional labels;
- API key/raw Authorization/raw provider body in evidence.

**Actions**
1. Implement explicit opt-in guard RERANKER_LIVE_VERIFY=1.
2. If not opted in, report LIVE_PROVIDER_CAPABILITY=NOT_EVALUATED; do not fake a passing test artifact.
3. If opted in but approved credential/egress is missing, record BLOCKED.
4. Capture repository HEAD and clean tracked-tree status before request.
5. Use exact qwen3-rerank config and explicit synthetic instruction/query/candidate set.
6. Request all candidates with top_n=N and return_documents=false through the production adapter.
7. Record sanitized evidence required by Plan §17:
   head, provider, endpoint identity/fingerprint, model/revision state, request mode, timestamp, safe request/instruction fingerprints, synthetic candidate IDs, request ID(s), normalized score/order, totalTokens if present, attempts/latency, error/lower states.
8. Record provider contract source URL/update identity.
9. Write evidence outside source tree and compute SHA-256.
10. If real response conflicts with the frozen official contract, record FAIL/UNKNOWN and STOP; do not relax parser or change model.
11. If any implementation/test-contract production file changes after run, invalidate evidence and rerun on the final head if a live claim is retained.

**Verification**
- RERANKER_LIVE_VERIFY=1 RERANKER_LIVE_EVIDENCE_PATH=/tmp/xiaoshuyin-s23-reranker-live.json bunx vitest run tests/ai/reranker-provider-live.test.ts when approved access exists.
- evidence.repositoryHead == git rev-parse HEAD.
- git status --porcelain --untracked-files=no is empty.
- evidence secret/raw-content scan passes.
- sha256sum/shasum of evidence is captured by handoff.

**Done Criteria**
- LIVE_PROVIDER_CAPABILITY is exactly PASS, FAIL, BLOCKED, UNKNOWN or NOT_EVALUATED with reason and provenance.
- No state is promoted merely to make the Slice appear ready.

**STOP Conditions**
- evidence head != implementation head.
- tree is dirty.
- provider contract materially contradicts Plan.
- real content/secret would be exposed.
- response requires permissive identity/score repair.
- model/provider switch would be required.

**Evidence Ownership**
- live test blob; external evidence path + SHA-256; exact-head/config record; provider request ID(s) when available; terminal lower state.

**Coverage**
- FR-005, FR-013, FR-014, FR-015, FR-019, FR-020; AS-02, AS-07, AS-08, AS-15.

---

## T011 — Full Regression / Governance / Scope / Secret / Exact-head Closeout

**Purpose**  
Prove the final implementation head is internally consistent and remains within the authorized slice after all implementation changes.

**Prerequisites**
- T002–T010 complete or T010 truthfully NOT_EVALUATED/BLOCKED.
- all intended implementation changes committed.

**Allowed Paths**
- No new feature mutation.
- Only corrective changes within already-authorized implementation/test paths if a verification failure is found; any correction requires rerunning all affected verification and invalidates prior live evidence if head changes.

**Forbidden Paths**
- new scope;
- governance registry;
- Authority/Frozen Spec;
- Audit 2;
- merge.

**Actions**
1. Set/record exact DEVELOPMENT_BASE from T001.
2. Run focused offline tests.
3. Run architecture test.
4. Run static guard + self-test.
5. Run validate-governance + governance self-tests.
6. Run validate-change-governance with exact DEVELOPMENT_BASE + change-governance self-tests.
7. Run bun run typecheck.
8. Run bun run verify-all.
9. Run changed-file allowlist scan.
10. Prove package.json/bun.lock/apps/server/api/package.json unchanged.
11. Prove app.ts/routes unchanged.
12. Prove db/ unchanged.
13. Prove .specify/ unchanged in implementation diff.
14. Re-run secret/scope architecture scan.
15. Record final exact implementation head.
16. If final head differs from T010 live evidence head, mark prior live evidence invalid and rerun T010 if retaining a live claim.
17. Derive lower evidence states and AGGREGATE_TECHNICAL_RESULT mechanically; do not write READY manually.
18. Record all unresolved limitations, especially qwen3-rerank immutable revision pinning and any live BLOCKED/NOT_EVALUATED state.

**Verification**
~~~bash
bunx vitest run tests/ai/reranker-provider-contract.test.ts
bunx vitest run tests/ai/reranker-dashscope.test.ts
bunx vitest run tests/architecture/reranker-provider-boundary.test.ts
node scripts/guard-static.mjs
node scripts/guard-static.mjs --self-test
node .specify/scripts/validate-governance.mjs
node .specify/scripts/tests/run-governance-tests.mjs
node .specify/scripts/validate-change-governance.mjs --base "$DEVELOPMENT_BASE" --head HEAD
node .specify/scripts/tests/run-change-governance-tests.mjs
bun run typecheck
bun run verify-all
git diff --name-only "$DEVELOPMENT_BASE"...HEAD
git diff --exit-code "$DEVELOPMENT_BASE"...HEAD -- package.json bun.lock apps/server/api/package.json
git diff --exit-code "$DEVELOPMENT_BASE"...HEAD -- apps/server/api/src/app.ts apps/server/api/src/routes
git diff --exit-code "$DEVELOPMENT_BASE"...HEAD -- db
git diff --exit-code "$DEVELOPMENT_BASE"...HEAD -- .specify
~~~

Expected: all mandatory commands exit 0; final diff is within Plan §8. A live lower state may remain BLOCKED/UNKNOWN/NOT_EVALUATED; that is evidence truth, not a regression failure.

**Done Criteria**
- final exact implementation head is stable;
- all mandatory offline/governance/static/type/regression checks pass;
- live evidence state is truthful and exact-head bound if present;
- no scope/secret/governance drift;
- terminal technical state is mechanically derived.

**STOP Conditions**
- any mandatory command fails and correction requires out-of-scope change.
- changed-file allowlist violation.
- secret leakage.
- exact-head mismatch not repaired by rerun.
- lower evidence state would need prose override to claim success.

**Evidence Ownership**
- final command outputs; changed-file list; final implementation SHA; lower-state/aggregate record; scope/secret scans; exact-head binding record.

**Coverage**
- FR-012, FR-014..FR-020; AS-09..AS-15.

---

## T012 — Prepare Independent Audit 2 Handoff Package and STOP

**Purpose**  
Package the exact final evidence for a new independent highest-capability Audit 2 model without self-auditing or merging.

**Prerequisites**
- T011 complete.
- final implementation head stable.

**Allowed Paths**
- No new repository mutation required.
- Handoff/report output only.

**Forbidden Paths**
- production/test/governance changes;
- Audit 2 verdict by Developer;
- merge;
- route activation;
- model/route production approval.

**Actions**
1. Record exact development base.
2. Record exact final implementation head.
3. Record Frozen Spec head 092c18d514d46a1e4e40f3544d428302cde00fa8 and blob 4354ecac585d3d6c675c629d5304faf9422cf5b1 (noting superseded historical identity 8fae7497df58446ad034d2986168f6a912444eb3 / 311511af1cfcda979d2b6896103c0a0c1d227b0b).
4. Record Planning Freeze exact head and Plan/Checklist/Tasks blobs.
5. Record exact changed files.
6. Record governance prerequisite:
   - PR;
   - exact merged head/merge SHA;
   - independent governance audit PASS evidence;
   - exact ownership matcher.
7. Record official provider contract sources/update dates and every remaining UNKNOWN.
8. Record NATIVE_HTTP decision and exact provider/model/config tuple.
9. Record all focused offline test evidence.
10. Record static guard/governance/typecheck/verify-all evidence.
11. Record controlled live evidence state:
    - PASS/FAIL/BLOCKED/UNKNOWN/NOT_EVALUATED;
    - external evidence SHA-256 and exact-head binding if evidence exists.
12. Record CONFIG_IDENTITY production-pin limitation without rewriting it.
13. Record scope/secret scan results.
14. Record Professional Reviewer/Gold Dataset authority gap as PRESERVED.
15. Record AGGREGATE_TECHNICAL_RESULT derived by evidence.ts and its lower predicates.
16. List unresolved limitations with no proposed scope widening.
17. State explicitly: Developer did not perform Audit 2 and did not merge.

**Verification**
- handoff exact implementation head == git rev-parse HEAD.
- changed-file list in handoff == git diff --name-only "$DEVELOPMENT_BASE"...HEAD.
- Plan/Checklist/Tasks blob identities match remote planning freeze.
- if live evidence exists, evidence head == final implementation head and SHA-256 is recorded.
- every non-PASS lower state is preserved verbatim.

**Done Criteria**
- a fresh independent Audit 2 model can reproduce the verdict inputs without asking Developer to guess missing provenance.
- Developer terminal state = READY_FOR_INDEPENDENT_AUDIT_2 only as a process state, never product/reranker READY.

**STOP Conditions**
- any provenance field is missing.
- any evidence belongs to a different head/config.
- handoff attempts to hide BLOCKED/UNKNOWN/NOT_EVALUATED.
- handoff claims Gold/professional/route/model production approval.
- any new code change is proposed after package creation without returning to T011.

**Evidence Ownership**
- Audit 2 handoff package containing exact base/head/spec/planning blobs, changed files, governance evidence, provider sources, offline/live evidence, exact-head binding, full regression, scope/secret scans, limitations and terminal process state.

**Coverage**
- FR-015, FR-016, FR-020; AS-10, AS-15.

---

# Dependency Order

T001
→ T002
→ T003
→ T004
→ T005
→ T006
→ T007
→ T008
→ T009
→ T010
→ T011
→ T012
→ STOP

No task may skip its prerequisite. T010 may terminate truthfully as NOT_EVALUATED/BLOCKED; that does not authorize skipping T011/T012 or converting the state to PASS.

# Developer Terminal Rule

After T012:

> STOP. Hand off to a new independent Audit 2 model.

Developer must not perform Audit 2, merge, activate a route, change the model, build an evaluator, create Gold truth, or expand this Slice.
