# Slice 21 — Developer Tasks

> Feature: `021-sparsevec-readiness-spike`
> Frozen Spec head / blob: `8792c4cf4e366b5507ac451a68cd31b73e7f5261` / `77d1caf4de6fdead3efcdb0cf3e8c594d444efbd`
> Tasks are frozen by Plan AI 2 for a later Developer AI. Development authorization at planning time: **NOT AUTHORIZED** (Developer Implementation Gate CLOSED — Plan §4).
> Execution is strictly sequential (dependency graph at the end). A STOP ends development; it is never bypassed.
> "Plan §n" / "C21-nn" refer to `plan.md` / `checklist.md` of the same planning head. S = `implementation_subject_head`, F = `final_pr_head` (Plan §13).

## Frozen Spec Authority Map

| Task | Frozen Spec authority (sections / requirements) | Acceptance scenarios | Negative scenarios |
|---|---|---|---|
| T001 | §6 Upstream Dependencies; §21 Implementation Gate; FR-002, FR-003, FR-008 | AS-08 | NS-03, NS-08 |
| T002 | §18 Governance Boundary; §12; FR-008 | AS-08 | NS-08 |
| T003 | §11 (Chinese sample); §16; §14; FR-004, FR-006 | AS-05 | NS-05, NS-07 |
| T004 | §8 Sparse Payload Contract; §9 Mapping Contract; §7; FR-001, FR-002, FR-005 | AS-02 | NS-01, NS-02 |
| T005 | §10 PostgreSQL/pgvector (identity, role, insert/readback, `<#>`, `<=>`); §12; FR-001, FR-003, FR-005 | AS-03, AS-06 | NS-03, NS-06 |
| T006 | §10 (16,000 / 1,000 / D limits, HNSW, EXPLAIN); §12; FR-001, FR-003, FR-005 | AS-04 | NS-03, NS-06 |
| T007 | §8 (S21-SPEC-02 text_type, S21-SPEC-03 model identity); §14; §16; §17; FR-001, FR-002, FR-005 | AS-01, AS-03, AS-06, AS-07 | NS-02, NS-04, NS-07 |
| T008 | §11 (real Chinese retrieval, predeclared expectations); FR-004, FR-005, FR-006 | AS-05, AS-07 | NS-04, NS-05, NS-07 |
| T009 | §11 Fusion Prototype Boundary; FR-004, FR-005, FR-007 | AS-05, AS-07 | NS-05 |
| T010 | §13 Fail-Closed; §14 Evidence Model; §15 Readiness States; §12; FR-005, FR-008 | AS-06, AS-07, AS-08 | NS-04, NS-06, NS-07, NS-08 |
| T011 | §15; §18; §22 Exit Criteria; FR-001..FR-008 | AS-01..AS-08 | NS-01..NS-08 |
| T012 | §22 (SC-001..SC-004); §21; FR-005, FR-007, FR-008 | AS-07, AS-08 | NS-08 |

Every Frozen Spec FR, AS and NS appears in at least one row; no task is unmapped.

## Acceptance Evidence Contract

| Task | Required evidence | Verification path | Positive evidence | Negative evidence | Blocked evidence | Owner |
|---|---|---|---|---|---|---|
| T001 | remote-truth gate report | git/GitHub read-back (Plan §1, §4) | all seven gate predicates (a–g) TRUE | — | any predicate FALSE → `STOP: GATE CLOSED` with the failing predicate | Developer (report) |
| T002 | governance classification report | V-GOV (Plan §17) | six paths fixed-exempt; ownership delta NONE | non-test path needed → STOP | validator unavailable → BLOCKED | Developer (report) |
| T003 | committed manifest + architecture manifest tests | V-ARCH; C21-30..C21-34, C21-74..C21-77 | 6 docs / 3 queries frozen, anchors + key-term checks pass | — | source unavailable / anchor absent / key-term check fails / reproduction prohibited → BLOCKED | Developer (fixture) |
| T004 | mapping/numeric architecture tests | V-ARCH; C21-15..C21-21 | all positive cases accept exactly | all §6 rejects reject with the frozen code | — | Developer (tests) |
| T005 | real DB test output (identity, readback, metrics, cleanup) | V-DB; C21-12..C21-14, C21-26..C21-28, C21-50..C21-53, C21-80 | identity + analytical metrics within frozen tolerances | expected SQL errors observed under SAVEPOINT | no TEMP privilege / DB unreachable in manual mode → BLOCKED; in CI RUN mode → FAIL | Developer (tests) |
| T006 | DB boundary matrix + EXPLAIN + planner restore | V-DB; C21-22..C21-24, C21-29, C21-62, C21-63 | D, 16,000, 1,000 PASS; index path in EXPLAIN | D+1, 16,001, 1,001 FAIL as expected | probe cannot run → not positive | Developer (tests) |
| T007 | linked provider→DB lineage in evidence | V-PROV; C21-25, C21-40, C21-70..C21-73 | `SPARSE_PAYLOAD_VERIFIED = VERIFIED` | INVALID_EXPERIMENT_CONFIG / incompatible payload → FAIL | missing secret / endpoint / model / gate → BLOCKED | Developer (run at S); Slice 20 keeps provider truth ownership |
| T008 | Chinese section of evidence | V-PROV; C21-30..C21-35, C21-38 | 6 linked candidates × 3 queries with both channels | missing channel / sample → reject | unauthorized source → BLOCKED | Developer (run at S) |
| T009 | fusion tests + fused rows in evidence | V-ARCH + V-PROV; C21-35..C21-38, C21-78, C21-79 | recompute ≤ 1e-12 and 3/3 strict #1 | deterministic mechanics error → FAIL; ranking miss → UNKNOWN | — | Developer |
| T010 | final sanitized evidence + state tests + cleanup proofs | V-ARCH, V-SEC; C21-39, C21-41..C21-46, C21-55, C21-61, C21-64..C21-68, C21-84 | schema valid, states derived | cleanup FAIL forces FAIL | lower BLOCKED propagates | Developer |
| T011 | exact-head validation matrix on F | V-GOV, V-GUARD, V-CANON, V-HEAD, V-SEC, V-SPEC; C21-56..C21-59, C21-63, C21-69, C21-81, C21-83 | every command exit 0; S→F evidence-only | any failure → STOP | CI unavailable → BLOCKED | Developer |
| T012 | Audit 2 handoff report | remote read-back of S, F, blobs | complete handoff, Developer stopped | — | dependency still unavailable → BLOCKED status in handoff | Developer (report); independent Audit 2 owns the verdict |

---

## T001 — Remote Reconciliation / Implementation Gate

**Frozen Spec Authority**
- §6, §21; FR-002, FR-003, FR-008 (see Authority Map).

**Prerequisites**
- Planning head = the exact Audit-1-passed remote planning head.

**Allowed paths**
- none (read-only).

**Forbidden paths**
- every repository path.

**Actions**
1. `git fetch origin`; record `origin/main`, `origin/spec/021-sparsevec-readiness-spike`, `origin/plan/021-sparsevec-readiness-spike` SHAs.
2. `git rev-parse origin/spec/021-sparsevec-readiness-spike:specs/021-sparsevec-readiness-spike/spec.md` must equal `77d1caf4de6fdead3efcdb0cf3e8c594d444efbd`; same blob on the planning head.
3. Slice 19: read the latest successful canonical CI run on `main`; confirm `G9` and `G11` PASS in its `verify-all.log` artifact and the pinned image in `PGVECTOR_IMAGE_REF`.
4. Slice 20: confirm PR #142 merged (`27a0ac5761b16ff7837a28936438f30aca1d68e0` → `db07babd42976e5e13dbe08bc3e5f1a9b1c8cbaf`) and `origin/main:apps/server/api/src/ai/embedding/index.ts` exports `createEmbeddingProvider` and `loadEmbeddingRuntimeConfig`; `config.ts` accepts `EMBEDDING_TEXT_TYPE` ∈ {query, document}.
5. Slice 20 Audit 2: locate durable independent Audit 2 PASS evidence per Plan §4 item 4 (PR #142 reviews/comments, successor PR/issue, or committed audit record on `main` naming exact head `27a0ac57…`). Record its URL/commit as `slice20_audit2_evidence_ref`.
6. Search remote branches, open PRs and `origin/main` tree for any Slice 21 implementation (`git ls-tree -r --name-only origin/main | grep -i sparsevec`; branch names containing `021`).
7. Record validator/CI blob SHAs (Plan §1 table) and note any drift.
8. Confirm Slice 21 planning admission (Plan §4 item 7): `git rev-parse origin/main:specs/021-sparsevec-readiness-spike/<file>` for `spec.md`, `plan.md`, `checklist.md`, `tasks.md` equal the Audit-1-passed planning-head blobs.

### Verification
- Mechanical predicates, each TRUE: (a) spec blob = `77d1caf4…`; (b) Slice 19 G9/G11 PASS on latest main CI; (c) PR #142 merged and public exports present; (d) `slice20_audit2_evidence_ref` non-empty and resolvable; (e) no competing Slice 21 implementation; (f) `tests/` prefix still in `FIXED_EXEMPT_PREFIXES` of `validate-change-governance.mjs`; (g) Slice 21 planning admitted to main (Action 8).
- Any validator/CI blob drift vs Plan §1 is listed and re-read before T002.

**Done**
- Gate report with all seven predicates TRUE (a–g) and every SHA recorded (C21-01, C21-02, C21-07, C21-82, C21-85 PASS).

**STOP**
- Predicate (d) FALSE → `STOP: DEVELOPER IMPLEMENTATION GATE CLOSED — Slice 20 durable Audit 2 evidence not established` (the expected result at planning time).
- Predicate (g) FALSE → `STOP: Slice 21 planning admission to main required` (separate planning PR; not a Developer action).
- Any other predicate FALSE; spec blob drift; Port semantic conflict → `UPSTREAM SLICE 20 PORT CAPABILITY RECONCILIATION REQUIRED`.

**Acceptance / Evidence Ownership**
- Developer gate report (Acceptance Evidence Contract row T001). Values are copied into evidence `slice19_provenance` / `slice20_provenance` in T010.

---

## T002 — Governance Classification Recheck

**Frozen Spec Authority**
- §18, §12; FR-008.

**Prerequisites**
- T001 Done.

**Allowed paths**
- none (classification only).

**Forbidden paths**
- every repository path.

**Actions**
1. Create the implementation branch `feat/021-sparsevec-readiness-spike` from current `origin/main` (which already contains the admitted Slice 21 Spec/Planning per T001 (g)); no rebase.
2. Confirm the planned diff will be exactly the six Plan §5.1 paths.
3. Run `node .specify/scripts/validate-governance.mjs`, `node .specify/scripts/tests/run-governance-tests.mjs`, `node .specify/scripts/validate-change-governance.mjs --base origin/main --head HEAD`, `node .specify/scripts/tests/run-change-governance-tests.mjs` on the branch head before implementation files exist.

### Verification
- All four commands exit 0.
- `git diff --quiet origin/main HEAD -- .specify/ .github/ scripts/ apps/ packages/ db/ Docs/` exits 0.

**Done**
- `GOVERNANCE PREREQUISITE: NOT REQUIRED`; `NO production ownership delta`.

**STOP**
- Any of `apps/**`, `packages/**`, `db/**`, `.specify/**`, `scripts/**`, `.github/**`, package or lockfile change would be needed.

**Acceptance / Evidence Ownership**
- Developer classification report (row T002).

---

## T003 — Test Harness Foundation + Chinese Manifest Freeze

**Frozen Spec Authority**
- §11, §14, §16; FR-004, FR-006.

**Prerequisites**
- T002 Done. No provider call has occurred for this Slice.

**Allowed paths**
```text
tests/helpers/sparsevec-readiness.ts
tests/fixtures/sparsevec-readiness/chinese-sample-manifest.json
tests/architecture/sparsevec-readiness-evidence.test.ts
```

**Forbidden paths**
- every other path; any provider call; any `Docs/reference/**` text; any edit of Plan §10.4 identities.

**Actions**
1. Create helper skeleton with the Plan §5.1 constants and the manifest validator.
2. For D01–D06 apply the Plan §10.4 extraction rule (`S21-EXTRACT-V1`) to the exact URLs and anchors; record `excerpt`, `text_sha256`, `source_fetched_at`, `http_status`.
3. Write the manifest with exactly the Plan §10.4 fields, IDs, titles, authority, URLs, anchors, queries (exact text), `query_sha256` (SHA-256 of UTF-8 NFKC query text), targets, key terms and distractors.
4. Architecture tests: cardinality 6/3; unique IDs; targets {D01, D02, D03}; distractor sets exactly as frozen; each excerpt starts with its NFKC anchor; 30 ≤ length ≤ 400; `text_sha256` recomputes; key term ∈ query ∧ ∈ target excerpt ∧ ∉ each declared distractor excerpt; rights/outbound/privacy fields as frozen.
5. Commit (this commit becomes `manifest_commit`).

### Verification
- `bunx vitest run tests/architecture/sparsevec-readiness-evidence.test.ts` exits 0 with the manifest tests executed (not skipped).
- `git log -1 --format=%H -- tests/fixtures/sparsevec-readiness/chinese-sample-manifest.json` recorded as `manifest_commit`.
- No provider-call code path is executable yet (provider test file absent at this commit).

**Done**
- Manifest committed and passing; C21-30..C21-34, C21-74..C21-77 PASS.

**STOP**
- Source unreachable, reproduction prohibition displayed, anchor absent, excerpt < 30 code points, key-term check fails, or private data present → BLOCKED; no substitute source, query or target.

**Acceptance / Evidence Ownership**
- Frozen manifest commit + architecture output (row T003).

---

## T004 — Sparse Mapping / Numeric Contract

**Frozen Spec Authority**
- §7, §8, §9; FR-001, FR-002, FR-005.

**Prerequisites**
- T003 Done.

**Allowed paths**
```text
tests/helpers/sparsevec-readiness.ts
tests/architecture/sparsevec-readiness-evidence.test.ts
```

**Forbidden paths**
- every other path; raw provider parsing; DB access; token hashing/reindexing; truncation; per-vector D.

**Actions**
1. Implement Plan §6 rules 1–12 in the exact validation order with the frozen reject codes.
2. Implement canonical text `{c:v,...}/1000000000` for parameter binding only.
3. Implement the DB mode function of Plan §7.1 as a pure helper (inputs: env object) and test RUN / FAIL / SKIP cases, including "only `DATABASE_URL` set" → SKIP.
4. Tests: index 0 → 1; D-1 → D; D reject; key 5000 with dense dim 1024 accepted; non-ascending reject; duplicate incl. zero-valued duplicate reject; NaN/±Inf reject; `3.5e38` overflow reject; `1e-46` underflow reject; ±0 removal; all-zero / empty / null reject; `sparseVocabularyMax` defined/undefined behavior.
5. State test: only the full mapping suite derives `MAPPING_CONTRACT_VERIFIED = VERIFIED`.

### Verification
- `bunx vitest run tests/architecture/sparsevec-readiness-evidence.test.ts` exits 0; each listed case is a named test.
- Removing any single rule makes at least one named test fail (each rule has a dedicated negative test).

**Done**
- C21-15..C21-21 and C21-62 (mode function) PASS.

**STOP**
- Mapping would require hashing, collision merge, clipping, truncation, per-vector D or raw provider parsing.

**Acceptance / Evidence Ownership**
- Architecture test output; `mapping_result` in evidence (row T004).

---

## T005 — Real DB Sparsevec Storage / Readback / Metrics

**Frozen Spec Authority**
- §10, §12; FR-001, FR-003, FR-005.

**Prerequisites**
- T004 Done; Stage A DB (pinned image, Slice 19 bootstrap, migrations applied) reachable as `xiaoshuyin_app`.

**Allowed paths**
```text
tests/db/sparsevec-readiness.test.ts
tests/helpers/sparsevec-readiness.ts
```

**Forbidden paths**
- every other path; permanent objects; grants; superuser connection for probes; provider calls; repository writes.

**Actions**
1. Gate the suite with the Plan §7.1 mode function (RUN / FAIL / SKIP).
2. Query and assert Plan §7 identity and role facts.
3. TEMP tables `s21_sparse(sample_id text primary key, sparse sparsevec(1000000000))` and `s21_dense(sample_id text primary key, dense vector(3))` for analytical fixtures.
4. Analytical sparse fixture (Plan §8.1) and dense fixture (Plan §8.2); assert values, signs, order and tolerances `1e-5` / `1.25e-4`.
5. Readback of `{1:0.5,1000000000:-0.25}/1000000000`: exact D, coordinates, float32 weights.
6. Expected-error cases (dimension mismatch insert and distance) under SAVEPOINT.
7. Cleanup: success path, injected-failure path, rerun (Plan §12).

### Verification
- Local: `SPARSEVEC_DB_READINESS_TEST=1 PGVECTOR_EXPECTED_VERSION=0.8.7 PGVECTOR_IMAGE_REF=pgvector/pgvector:0.8.7-pg18-trixie@sha256:5895949dfcdf308eb0cd31c950c93c14895c77f33fbedfecf1fa511ab1d4bcd2 DATABASE_URL=<Stage A app-role URL> bunx vitest run tests/db/sparsevec-readiness.test.ts` exits 0 with 0 skipped.
- Without any identity variable the suite reports SKIP; with a partial identity it FAILS (mode tests from T004 plus one live assertion).

**Done**
- C21-12..C21-14, C21-26..C21-28, C21-50..C21-53, C21-80 PASS.

**STOP**
- Elevated role or grant needed; permanent relation needed; version/image drift; cleanup unprovable.

**Acceptance / Evidence Ownership**
- Real DB test output (row T005); DB facts copied into evidence by T007/T010.

---

## T006 — Synthetic DB Boundaries + HNSW Behavior

**Frozen Spec Authority**
- §10, §12; FR-001, FR-003, FR-005.

**Prerequisites**
- T005 Done.

**Allowed paths**
```text
tests/db/sparsevec-readiness.test.ts
tests/helpers/sparsevec-readiness.ts
```

**Forbidden paths**
- every other path; provider-generated boundary data; truncation/remapping; permanent indexes; session-level planner changes.

**Actions**
1. Run every row of the Plan §7.2 boundary table with deterministic fixtures.
2. Disposable HNSW `sparsevec_ip_ops` index on a TEMP table (≤ 1,000 nnz rows); `SET LOCAL enable_seqscan = off`; `EXPLAIN (FORMAT JSON, COSTS OFF)`; assert the index name appears in the plan JSON.
3. Compare HNSW results with the exact reference as an observation.
4. Assert `enable_seqscan` restored and no `s21_%` relation remains.

### Verification
- Same command as T005 exits 0 with 0 skipped; named tests exist for D, D+1, 16,000, 16,001, 1,000, 1,001, EXPLAIN index path, planner restore.
- In canonical CI (identity of Plan §7.1) the suite runs (no skip) — proven later by T011 C21-63.

**Done**
- C21-22..C21-24, C21-29, C21-53, C21-62 PASS.

**STOP**
- Passing requires truncation/remapping; boundary behavior not observable on the exact target; index path not observable.

**Acceptance / Evidence Ownership**
- DB boundary matrix + EXPLAIN JSON (row T006).

---

## T007 — Actual Slice 20 Provider → Actual DB Linked Run

**Frozen Spec Authority**
- §8 (S21-SPEC-02, S21-SPEC-03), §14, §16, §17; FR-001, FR-002, FR-005.

**Prerequisites**
- T001..T006 Done; manifest committed (T003); all five execution-affecting files final and committed → this commit is S; `git status --porcelain --untracked-files=all` empty; `DASHSCOPE_API_KEY` and `DASHSCOPE_EMBEDDING_BASE_URL` available only in the operator's process environment.

**Allowed paths**
```text
tests/ai/sparsevec-readiness-provider-db.test.ts   (committed in S before execution)
tests/helpers/sparsevec-readiness.ts               (committed in S before execution)
tests/evidence/sparsevec-readiness-stage-a.json    (written by the run; committed only in T011's evidence-only commit)
```

**Forbidden paths**
- every other path; Slice 20 edits; direct HTTP; raw response parsing; internal Slice 20 module imports; API key in code/CLI args/evidence/logs; any provider call before S exists.

**Actions**
1. Gate: `SPARSEVEC_PROVIDER_VERIFY=1` plus Plan §7.1 manual opt-in; otherwise SKIP.
2. Assert `git rev-parse HEAD` = S and clean tree; store `implementation_subject_head = S`.
3. Create document and query Port instances via `createEmbeddingProvider({ env })` with env exactly per Plan §10.2 (explicit `EMBEDDING_TEXT_TYPE=document` / `query`).
4. One `embed()` for D01–D06 (document instance) and one for Q01–Q03 (query instance), `outputType: 'dense+sparse'`, `denseDimension: 1024`.
5. Verify identity invariants (C21-70..C21-73); OK outcomes; 6 + 3 items; dense length 1024; non-null nonempty sparse; Plan §6 mapping for every item.
6. Insert into TEMP `s21_items(sample_id text primary key, role text, dense vector(1024), sparse sparsevec(1000000000))` with bound parameters; read back; compute lineage hashes (Plan §10.3).
7. Compute exact dense and sparse DB scores for every (query, document) pair; compare to independent references within frozen tolerances; attempt HNSW path if every row ≤ 1,000 nnz.
8. Re-assert `git rev-parse HEAD` = S at run end.

### Verification
- Command V-PROV (Plan §17) executed at HEAD = S exits 0 and writes the evidence file to `SPARSEVEC_EVIDENCE_PATH`.
- Evidence `provider_calls[]` has exactly two entries (document, query) satisfying C21-70..C21-73; `items[]` has 9 entries with all lineage hashes.
- If the Slice 20 config fails with `SECRET_MISSING` / `CONFIG_MISSING`: evidence written with `SPARSE_PAYLOAD_VERIFIED = BLOCKED` and no positive flag.

**Done**
- `SPARSE_PAYLOAD_VERIFIED = VERIFIED` with complete linkage, or a truthfully derived FAIL/BLOCKED.

**STOP**
- Credential/endpoint unavailable → BLOCKED (no fabricated evidence); model ≠ `qwen3.7-text-embedding` or cross-role drift → INVALID_EXPERIMENT_CONFIG; raw provider bypass needed; payload incompatible with D/float32/16,000 → FAIL; Slice 20 Port cannot express roles → `UPSTREAM SLICE 20 PORT CAPABILITY RECONCILIATION REQUIRED`.

**Acceptance / Evidence Ownership**
- Linked evidence (row T007); Slice 20 retains transport/normalization/telemetry/cost ownership.

---

## T008 — Real Chinese Retrieval Technical Results

**Frozen Spec Authority**
- §11; FR-004, FR-005, FR-006.

**Prerequisites**
- T007 linked scores available in the same run at S.

**Allowed paths**
```text
tests/ai/sparsevec-readiness-provider-db.test.ts   (code already in S)
tests/evidence/sparsevec-readiness-stage-a.json    (run output)
```

**Forbidden paths**
- every other path; manifest edits; clinical/professional relabeling; extra queries or documents.

**Actions**
1. For Q01–Q03 use exactly the six candidates D01–D06 with both DB-derived raw scores.
2. Record exact dense and sparse rankings, manifest identity (`chinese_manifest_id`, `chinese_manifest_sha256`) and source fingerprints.
3. Pass the paired scores to T009 (same run); record all attempted samples and failures.

### Verification
- Evidence `queries[]` has 3 entries × 6 candidates, each with `raw_dense` and `raw_sparse` finite.
- `chinese_manifest_sha256` = SHA-256 of the manifest blob at S; manifest blob unchanged between `manifest_commit` and S (C21-74).

**Done**
- All 18 (query, candidate) pairs linked; no expectation changed.

**STOP**
- Manifest drift; missing channel or sample; unauthorized source; any need to reinterpret a miss with professional judgement.

**Acceptance / Evidence Ownership**
- Chinese section of the evidence (row T008).

---

## T009 — Fixed Fusion Reference and Chinese Outcome

**Frozen Spec Authority**
- §11; FR-004, FR-005, FR-007.

**Prerequisites**
- T008 paired raw scores.

**Allowed paths**
```text
tests/helpers/sparsevec-readiness.ts               (code already in S)
tests/architecture/sparsevec-readiness-evidence.test.ts (code already in S)
tests/ai/sparsevec-readiness-provider-db.test.ts   (code already in S)
tests/evidence/sparsevec-readiness-stage-a.json    (run output)
```

**Forbidden paths**
- weight search/tuning, RRF, reranker, Gold Dataset optimization, single-channel fallback, post-hoc label/query/corpus/weight/normalization changes.

**Actions**
1. Apply Plan §11 exactly (per-query per-channel min-max; constant channel → 0; 0.5/0.5; sort fused desc then `sample_id` asc).
2. Fail closed on missing channel, duplicate ID, non-finite score, count ≠ 6.
3. Independent recomputation; record `recompute_max_abs_diff` (must be ≤ 1e-12).
4. Per query compute `strict_first` (expected target fused strictly greater than all others); `chinese_queries_passed`.
5. Architecture fixtures: constant channel, missing channel, duplicate, non-finite, exact tie (tie-break deterministic but `strict_first = false`).

### Verification
- `bunx vitest run tests/architecture/sparsevec-readiness-evidence.test.ts` exits 0 with the fusion fixtures.
- Evidence `fusion_reference.formula_id = "S21-MINMAX-0.5-0.5-V1"` and `recompute_max_abs_diff <= 1e-12`.
- Derived flag: 3/3 → VERIFIED; mechanics error → FAIL; technical chain VERIFIED with < 3/3 → UNKNOWN (C21-78).

**Done**
- `FUSION_PROTOTYPE_VERIFIED` derived mechanically; no tuning occurred.

**STOP**
- Any temptation to change weights, normalization, queries, targets, distractors or candidate set after seeing scores.

**Acceptance / Evidence Ownership**
- Fusion tests + fused rows in evidence (row T009).

---

## T010 — Evidence Aggregation + Cleanup Truth

**Frozen Spec Authority**
- §12, §13, §14, §15; FR-005, FR-008.

**Prerequisites**
- T004..T009 produced terminal values in the same run at S.

**Allowed paths**
```text
tests/helpers/sparsevec-readiness.ts               (code already in S)
tests/architecture/sparsevec-readiness-evidence.test.ts (code already in S)
tests/evidence/sparsevec-readiness-stage-a.json    (run output)
```

**Forbidden paths**
- manual flag setting; hiding failures; secrets, raw provider bodies, excerpts or vector arrays in evidence; DB/planner residue; keys `repo_head`, `final_pr_head`, `containing_commit`.

**Actions**
1. Populate every Plan §14 key (including the V1技术设计 §4.2 fields, `tencentdb_kernel_version = "NOT_APPLICABLE_STAGE_A"`, `evidence_ref = "tests/evidence/sparsevec-readiness-stage-a.json#subject=<S>#run=<run_id>"`).
2. Derive lower flags, aggregate, `candidate_a_readiness_state`, `execution_completion_state`, `sparsevec_spike_status`, `readiness_status`, `rag_candidate_status` with Plan §15 precedence.
3. Verify cleanup and planner restoration; cleanup failure forces FAIL.
4. Run the evidence schema, vocabulary, no-overclaim, no-self-reference-key and privacy tests against the written file.

### Verification
- `bunx vitest run tests/architecture/sparsevec-readiness-evidence.test.ts` exits 0 with the evidence file present (schema/state/privacy tests executed, not skipped).
- `node -e` read of the evidence shows `implementation_subject_head = S` and the state fields equal the helper derivation.
- Plan §13.4 negated secret grep exits 0 with empty stdout on the Slice 21 paths.

**Done**
- One sanitized artifact truthfully representing PASS / FAIL / BLOCKED / UNKNOWN / NOT_EVALUATED.

**STOP**
- Cleanup/planner restoration failure; incomplete lineage; any state requiring manual override.

**Acceptance / Evidence Ownership**
- Final evidence artifact + architecture state tests (row T010).

---

## T011 — Evidence-Only Commit, Exact-Head Regression and Convergence

**Frozen Spec Authority**
- §15, §18, §22; FR-001..FR-008.

**Prerequisites**
- T010 evidence file produced at S.

**Allowed paths**
```text
tests/evidence/sparsevec-readiness-stage-a.json   (the only file in the evidence-only commit)
```

**Forbidden paths**
- every other path; amending S; rebasing; merging `main` after S (that creates a new S and requires a full rerun); weakening tests/guards/governance.

**Actions**
1. Commit only the evidence file on top of S → F; push the branch; open/update the PR.
2. Run on F: V-ARCH; V-DB (manual opt-in); V-GOV (four commands); V-GUARD (two commands); Plan §13.4 scans; Plan §13.2 convergence commands with S from the evidence.
3. Wait for exact-head CI on F; download artifact `verify-all-<F>-<attempt>`; assert `verify-all: PASS` and C21-63 no-skip proof for `tests/db/sparsevec-readiness.test.ts`.
4. Re-read remote: F, changed files vs `origin/main` (exactly the six paths), spec blob, ownership file equality, `.github/` equality.

### Verification
- Every command in Actions 2–4 exits 0 on F; C21-54, C21-56..C21-59, C21-63, C21-69, C21-81, C21-83 PASS.
- `git merge-base --is-ancestor S F` exits 0 and `git diff --name-only S F` = `tests/evidence/sparsevec-readiness-stage-a.json`.
- No new provider call is made on F.

**Done**
- Canonical regression and governance PASS; evidence remains truthful; S→F evidence-only.

**STOP**
- Any regression/governance/guard failure; S→F delta outside the evidence path; head drift; scope widening. A required code fix invalidates the evidence → new S + full rerun from T007.

**Acceptance / Evidence Ownership**
- Exact-head validation matrix and remote read-back (row T011).

---

## T012 — Evidence Freeze / Audit 2 Handoff / STOP

**Frozen Spec Authority**
- §21, §22; FR-005, FR-007, FR-008.

**Prerequisites**
- T011 Done.

**Allowed paths**
- none (report only).

**Forbidden paths**
- every repository path; Audit 2; merge; next-slice work.

**Actions**
Report: repository; current main; S; F; merge base / ahead / behind; Frozen Spec head/blob; planning head; Slice 19 provenance; Slice 20 provenance incl. `slice20_audit2_evidence_ref`; changed files; governance mode; PG/pgvector/image identity; role facts; provider calls (model, text_type, request IDs); mapping/D/nnz; DB round-trip; metrics/references/tolerances; HNSW/boundaries; manifest identity; raw/normalized/fused scores; `chinese_queries_passed`; four flags; aggregate; `candidate_a_readiness_state`; `execution_completion_state`; `sparsevec_spike_status`; `rag_candidate_status`; `readiness_status`; cleanup; scans; canonical regression run ID; limitations.

### Verification
- Remote read-back confirms F, S ancestry, spec blob `77d1caf4…`, changed files and evidence blob; the report lists every field above with no placeholder.

**Done**
- Developer status (`C21-60`): `READY FOR INDEPENDENT AUDIT 2` (PASS or reproducible FAIL evidence complete), `BLOCKED` (dependency/credential/source/permission unavailable) or `INCONCLUSIVE` (UNKNOWN). Developer stops.

**STOP**
- Do not perform Audit 2; do not merge; no production retrieval work.

**Acceptance / Evidence Ownership**
- Developer handoff report + evidence at F (row T012); the independent Audit 2 role owns the verdict.

## Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> [S frozen] -> T007 -> T008 -> T009 -> T010 -> T011 [F] -> T012
```

T001 STOPs at planning time (Slice 20 durable Audit 2 evidence not found); T007 is impossible until T001 passes.
