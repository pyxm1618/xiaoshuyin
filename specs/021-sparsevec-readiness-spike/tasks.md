# Slice 21 — Developer Tasks

> Feature: `021-sparsevec-readiness-spike`  
> Planning role boundary: tasks are frozen by Plan AI 2; execution is for a later Developer AI only.  
> Current development authorization at planning time: **NOT AUTHORIZED**.

Task status is sequential. A STOP condition ends development; do not bypass it.

## T001 — Remote Reconciliation / Implementation Gate

**Prerequisites**
- Plan/Checklist/Tasks frozen.
- Audit 1 FINAL PASS.

**Allowed paths**
- no repository mutation.

**Forbidden**
- all implementation changes.

**Actions**
1. Re-read current `main`.
2. Re-read Slice 21 frozen spec head/blob.
3. Re-read Slice 19 current Stage A readiness identity.
4. Prove Slice 20 actual implementation exists, independent Audit 2 PASS, and merged main.
5. Prove Slice 20 public normalized adapter entry point is available.
6. Re-read PR #118 and any successor governance state.
7. Search for competing Slice 21 implementation.
8. Re-read current change-governance/ownership classification.
9. Confirm current planned test-only path set remains fixed-exempt.

**Verification / Done**
- all hard gate predicates PASS;
- exact main and Slice 20 implementation head/provenance recorded;
- Frozen Spec blob exact.

**STOP**
- Slice 20 implementation/Audit 2/merge absent;
- frozen blob drift;
- upstream adapter semantic conflict;
- competing implementation requiring reconciliation.

**Evidence owner**
- Developer final report / run evidence identity.

At the planning snapshot this task would STOP because Slice 20 implementation is not merged.

---

## T002 — Governance Classification Recheck

**Forbidden paths**
- all repository mutations; this task is classification/read-only.

**Verification**
- re-run/read the current change-governance classification for the frozen test-only paths and confirm no product path is present;
- confirm no ownership/change-binding prerequisite is required.

**Evidence ownership**
- Developer implementation-gate report: current validator identity, changed-path classification, governance-mode result.

**Prerequisite**
- T001 PASS.

**Allowed paths**
- no mutation.

**Actions**
1. Confirm implementation diff is restricted to the exact six test/evidence paths frozen in Plan §3.2.
2. Run current change-governance validator against a representative fixed-exempt path set if needed.
3. Confirm no ownership rule/change-binding is required.

**Done**
```text
GOVERNANCE PREREQUISITE: NOT REQUIRED
NO production ownership delta
```

**STOP**
- any `apps/**`, `packages/**`, `db/**`, `.specify/**`, `scripts/**`, CI or package change is required.

**Coverage**
- FR-008; AS-08; NS-08.
- Checklist C21-09..C21-11,C21-49.

---

## T003 — Test Harness Foundation + Chinese Manifest Freeze

**Forbidden paths**
- any live provider call before manifest freeze;
- any production path;
- private/family/minor/patient data;
- post-hoc expected-match edits after provider execution.

**Evidence ownership**
- frozen Chinese sample manifest commit + architecture manifest-validation output.

**Prerequisites**
- T002 PASS.
- No provider call has occurred for this run.

**Allowed paths**
```text
tests/helpers/sparsevec-readiness.ts
tests/fixtures/sparsevec-readiness/chinese-sample-manifest.json
tests/architecture/sparsevec-readiness-evidence.test.ts
```

**Actions**
1. Create the pure helper types/functions for mapping, float32 conversion, reference scoring, fusion and evidence-state derivation.
2. Create the six-document/three-query manifest exactly as Plan §11.
3. Verify every source is real, lawful and `PERMITTED_FOR_TEST`.
4. Record source ref/version and normalized text SHA-256.
5. Freeze one expected technical match and >=2 unrelated distractors for each query.
6. Record non-clinical expectation basis.
7. Add architecture tests asserting manifest cardinality, unique IDs, rights fields, fingerprints, three distinct expected targets, >=3 source/topic sections and privacy assertions.
8. Commit the manifest before T007 live provider execution.

**Verification / Done**
- 6 docs / 3 queries exact;
- manifest passes schema checks;
- manifest commit identity captured;
- no private/family/minor data;
- no provider call made before freeze.

**STOP**
- permission cannot be established;
- technical expected match requires new professional judgement;
- source contains prohibited private data.

**Coverage**
- FR-004, FR-006; AS-05; NS-05,NS-07.
- Checklist C21-30..C21-34,C21-47.

---

## T004 — Sparse Mapping / Numeric Contract

**Forbidden paths**
- raw provider parsing, DB access, token hashing/reindexing, truncation, collision merging, per-vector D.

**Evidence ownership**
- architecture mapping/numeric test output and mechanically derived mapping status.

**Prerequisites**
- T003 harness foundation exists.

**Allowed paths**
```text
tests/helpers/sparsevec-readiness.ts
tests/architecture/sparsevec-readiness-evidence.test.ts
```

**Actions**
Implement and test exactly the Plan §6 rules:
- D=1e9;
- index+1 mapping;
- D-1 pass / D reject;
- strict canonical input order;
- duplicate rejection before zero removal;
- finite checks;
- `Math.fround` representability;
- overflow and nonzero-underflow reject;
- exact +/-0 removal;
- empty/all-zero reject;
- dense/sparse dimension independence;
- canonical sparsevec text generation for parameter binding.

Add state-machine tests proving only the complete mapping suite derives `MAPPING_CONTRACT_VERIFIED=VERIFIED`.

**Verification / Done**
- all C21-15..C21-21 PASS;
- architecture suite fails if any boundary predicate is removed.

**STOP**
- mapping would require token hashing, collision merge, clipping, truncation, per-vector D or raw provider parsing.

**Coverage**
- FR-001,FR-002,FR-005; AS-02; NS-01,NS-02.

---

## T005 — Real DB Sparsevec Storage / Readback / Metric

**Forbidden paths**
- permanent tables/indexes, migrations, production/business rows, elevated role/grants, provider calls.

**Evidence ownership**
- real DB test output: server/extension/role identity, readback, analytical distance/reference, cleanup evidence.

**Prerequisites**
- T004 PASS.
- real Stage A DB available with current Slice 19 bootstrap.

**Allowed paths**
```text
tests/db/sparsevec-readiness.test.ts
tests/helpers/sparsevec-readiness.ts
```

**Actions**
1. Require explicit `SPARSEVEC_DB_READINESS_TEST=1`.
2. Connect through existing `DATABASE_URL` as app role.
3. Query actual PG/version/pgvector/role facts.
4. Create TEMP sparsevec(D) fixture and TEMP dense fixture only.
5. Run analytical `<#>` fixture from Plan §8.1.
6. Assert negative-IP sign, exact ordering and independent numeric tolerance.
7. Run dense cosine exact fixture with `<=>`.
8. Verify sparse readback dimension, coordinates and float32 weights.
9. Use SAVEPOINT for expected negative SQL cases.
10. Prove success cleanup, injected-failure cleanup and rerun absence.

**Verification / Done**
- target PG18 / pgvector 0.8.7 / app-role boundaries PASS;
- analytical DB similarity agrees with reference;
- cleanup C21-50..C21-52 PASS.

**STOP**
- elevated role/grant required;
- permanent relation needed;
- target version drift;
- cleanup cannot be proven.

**Coverage**
- FR-001,FR-003,FR-005; AS-03,AS-06; NS-03,NS-06.

---

## T006 — Synthetic DB Boundaries + HNSW Behavior

**Forbidden paths**
- provider-generated boundary fixtures, payload truncation/remapping, permanent indexes, session-level planner drift.

**Evidence ownership**
- real DB boundary matrix + EXPLAIN JSON/index-path observation + planner/cleanup proof.

**Prerequisites**
- T005 base DB harness PASS.

**Allowed paths**
```text
tests/db/sparsevec-readiness.test.ts
tests/helpers/sparsevec-readiness.ts
```

**Actions**
1. sparsevec(D) PASS.
2. sparsevec(D+1) expected FAIL.
3. 16,000 nonzero storage PASS.
4. 16,001 expected storage FAIL.
5. 1,000-nnz HNSW PASS.
6. 1,001-nnz HNSW expected incompatibility; never truncate.
7. Create disposable TEMP HNSW `sparsevec_ip_ops`.
8. If required, `SET LOCAL enable_seqscan=off`.
9. `EXPLAIN (FORMAT JSON, COSTS OFF)` bounded nearest-neighbor query and assert expected index node/name.
10. Compare bounded HNSW results with exact reference as an observation only.
11. Prove planner setting restoration and object cleanup.

**Verification / Done**
- C21-22..C21-24,C21-29,C21-53 PASS;
- HNSW/storage outcomes recorded separately.

**STOP**
- only way to pass is truncation/remapping;
- expected boundary behavior cannot be observed on exact target version;
- HNSW cannot be proven to execute.

**Coverage**
- FR-001,FR-003,FR-005; AS-04; NS-03,NS-06.

---

## T007 — Actual Slice 20 Provider -> Actual DB Linked Run

**Evidence ownership**
- sanitized linked provider-to-DB evidence artifact plus live verification test output; Slice 20 retains provider transport/normalization ownership.

**Prerequisites**
- T001..T006 PASS.
- Chinese manifest frozen before live call.
- approved provider credential available through Slice 20's existing secret mechanism.

**Allowed paths**
```text
tests/ai/sparsevec-readiness-provider-db.test.ts
tests/helpers/sparsevec-readiness.ts
tests/evidence/sparsevec-readiness-stage-a.json
```

**Forbidden**
- edits to Slice 20 production code;
- direct HTTP;
- raw response parsing;
- endpoint/API-key request fields;
- new secret mechanism.

**Actions**
1. Require explicit `SPARSEVEC_PROVIDER_VERIFY=1`.
2. Import only merged Slice 20 public entry point.
3. Invoke actual dense+sparse provider configuration for all six documents and three queries under one recorded model/output configuration.
4. Verify normalized dense+sparse output and canonical sparse boundaries.
5. Derive stable test IDs without claiming provider-owned IDs.
6. Map sparse output with T004 helper.
7. Insert paired dense/sparse results into TEMP DB rows using parameter binding.
8. Read back and hash normalized/mapped/DB representations.
9. Run exact dense and sparse scoring for the same six candidates/query.
10. Write linked provider request IDs, model/config provenance and DB lineage to sanitized evidence.

**Verification / Done**
- `SPARSE_PAYLOAD_VERIFIED=VERIFIED`;
- actual provider -> mapping -> DB provenance join exists for all required items;
- no detached synthetic substitution.

**STOP**
- credential/endpoint unavailable -> BLOCKED;
- provider missing required sparse output -> FAIL or BLOCKED according to observed provider semantics;
- raw provider bypass would be needed;
- payload incompatible with D/float32/16k -> FAIL.

**Coverage**
- FR-001,FR-002,FR-005; AS-01,AS-03,AS-06,AS-07; NS-04,NS-07.

---

## T008 — Real Chinese Retrieval Technical Correctness

**Forbidden paths**
- manifest expectation edits after live execution, production paths, provider internals/raw HTTP, clinical/professional relabeling.

**Verification**
- for each frozen query, prove exactly six linked candidate IDs with both DB-derived channels, unchanged manifest identity, expected target/distractor identities, and recorded ranking inputs.

**Evidence ownership**
- Chinese-sample section of the linked Stage A evidence artifact + live test output.

**Prerequisites**
- T007 linked actual scores available.
- Manifest identity exactly matches T003 frozen commit.

**Allowed paths**
```text
tests/ai/sparsevec-readiness-provider-db.test.ts
tests/evidence/sparsevec-readiness-stage-a.json
```

**Actions**
For each of the three queries:
1. use the same six candidate IDs;
2. preserve exact DB dense/sparse raw scores;
3. verify expected target/distractor identities from frozen manifest;
4. defer final combined success to T009 fixed fusion;
5. record returned exact rankings and all attempted samples/failures.

**Done**
- every real sample is linked and no source/expectation was changed post-provider execution.

**STOP**
- manifest drift;
- missing channel/sample ID;
- unauthorized source text;
- clinical/professional judgement is needed to reinterpret a failed result.

**Coverage**
- FR-004,FR-005,FR-006; AS-05,AS-07; NS-04,NS-05,NS-07.

---

## T009 — Fixed Fusion Reference

**Forbidden paths**
- weight search/tuning, RRF, reranker, Gold Dataset optimization, missing-channel fallback, post-hoc label changes.

**Verification**
- independent recomputation matches normalized/fused values within 1e-12;
- each expected target is strict fused #1 and strictly above all declared unrelated distractors;
- constant-channel/missing/duplicate/nonfinite/tie fixtures behave exactly as frozen.

**Evidence ownership**
- fusion architecture tests + raw/normalized/fused score rows in the linked evidence artifact.

**Prerequisites**
- T008 paired raw DB scores.

**Allowed paths**
```text
tests/helpers/sparsevec-readiness.ts
tests/architecture/sparsevec-readiness-evidence.test.ts
tests/ai/sparsevec-readiness-provider-db.test.ts
tests/evidence/sparsevec-readiness-stage-a.json
```

**Actions**
1. Apply per-query per-channel min-max normalization.
2. Constant channel -> all normalized scores 0.
3. `fused=0.5*dense_norm+0.5*sparse_norm`.
4. Reject missing channel, duplicate ID, nonfinite score.
5. Sort fused desc, then sample_id asc.
6. Independently recompute and compare at tolerance 1e-12.
7. For each query require expected target strict fused #1 and strictly above all declared unrelated distractors.
8. Exercise deterministic tie fixture but never count tie-break as Chinese correctness.

**Done**
- all three queries satisfy the frozen technical rule -> `FUSION_PROTOTYPE_VERIFIED=VERIFIED`;
- otherwise deterministic failure is recorded; no tuning.

**STOP**
- any temptation to weight-search, RRF, rerank or change expected labels after seeing scores.

**Coverage**
- FR-004,FR-005,FR-007; AS-05,AS-07; NS-05.

---

## T010 — Evidence Aggregation + Cleanup Truth

**Forbidden paths**
- manually setting a readiness flag, hiding attempted failures, storing secret/raw provider body/unapproved raw text, leaving DB/planner residue.

**Verification**
- evidence schema validation passes;
- lower-level statuses and aggregate state recompute from evidence predicates;
- DB absence/planner-restoration checks pass after success and injected failure;
- secret/privacy scan passes.

**STOP**
- cleanup or planner restoration fails;
- provider->mapping->DB->score->fusion lineage is incomplete;
- any final state requires manual override or unsupported inference.

**Evidence ownership**
- final sanitized evidence artifact + architecture state-machine tests + cleanup proofs.

**Prerequisites**
- T004..T009 have terminal evidence states.

**Allowed paths**
```text
tests/helpers/sparsevec-readiness.ts
tests/architecture/sparsevec-readiness-evidence.test.ts
tests/evidence/sparsevec-readiness-stage-a.json
```

**Actions**
1. Populate all Plan §14 required evidence fields.
2. Derive four lower statuses mechanically.
3. Derive Candidate A readiness and execution completion independently.
4. Verify all temp objects absent and planner state restored.
5. Ensure cleanup failure forces FAIL.
6. Run secret/privacy/raw-body evidence scans.
7. Ensure BLOCKED/UNKNOWN/NOT_EVALUATED can never become aggregate PASS.

**Done**
- one sanitized artifact truthfully represents PASS/FAIL/BLOCKED/UNKNOWN/NOT_EVALUATED.

**Coverage**
- FR-005,FR-008; AS-06,AS-07,AS-08; NS-04,NS-06,NS-07,NS-08.

---

## T011 — Exact-Head Regression / Governance / Scope Convergence

**Forbidden paths**
- weakening tests/guards/governance to obtain green status, mixing evidence from different heads, adding any path outside the frozen six-file surface.

**Verification**
- every command/gate in Actions 4-10 completes on one exact head;
- changed-file set and spec blob are re-read from remote;
- evidence repo_head equals that exact head.

**STOP**
- any regression/governance/guard gate fails;
- head drifts after evidence;
- changed-file scope widens;
- evidence and exact head cannot be bound mechanically.

**Evidence ownership**
- exact-head validation matrix, remote topology read-back, canonical test/governance/guard outputs, final artifact identity.

**Prerequisites**
- T010 artifact produced.
- no further implementation after evidence freeze unless all affected evidence is rerun.

**Allowed paths**
- no new implementation beyond correcting defects inside the six frozen Slice 21 paths; any correction invalidates earlier exact-head evidence and requires rerun.

**Actions**
1. Record current main, exact implementation head, merge base, ahead/behind and changed files.
2. Verify changed files are a subset of the six frozen test/evidence paths.
3. Verify Slice 21 spec blob unchanged.
4. Run architecture suite.
5. Run real DB suite.
6. Run live provider linked suite when claiming positive/negative candidate execution.
7. Run governance validators/self-tests.
8. Run static guard/self-test.
9. Run canonical `verify-all`.
10. Scan for secrets/raw provider bodies/private data.
11. Confirm no production path or change-binding delta.
12. Confirm evidence `repo_head` equals exact final head.

**Done**
- canonical regression and governance PASS;
- evidence state remains truthful on exact head.

A Candidate A `FAIL` may still satisfy T011 if the failure is the correctly observed Spike result. A skipped provider run may not be represented as positive completion/readiness.

**Coverage**
- all FR/AS/NS by composition.
- Checklist C21-54..C21-59.

---

## T012 — Evidence Freeze / Audit 2 Handoff / STOP

**Allowed paths**
- no repository mutation; handoff/report only.

**Forbidden paths**
- production or test changes, Audit 2, merge, implementation PR expansion, next-slice development.

**Verification**
- remote re-read confirms exact implementation head, frozen spec blob, changed files and evidence identity;
- handoff contains every field listed below and truthfully reflects PASS/FAIL/BLOCKED/UNKNOWN/NOT_EVALUATED.

**Done**
- a zero-guess independent Audit 2 handoff exists and Developer has stopped; no later code change exists on the audited head.

**Evidence ownership**
- final Developer report + exact-head Stage A evidence artifact; independent Audit 2 owns the later audit verdict.

**Coverage**
- FR-005,FR-007,FR-008; AS-07,AS-08; NS-08.

**Prerequisites**
- T011 exact-head convergence complete.

**Actions**
Report:

```text
repository
current main
exact implementation head
merge base / ahead / behind
Frozen Spec head/blob
Slice 19 provenance
Slice 20 merged implementation provenance
changed files
governance mode
PG/server/pgvector/image identity
execution role/security facts
provider model/config/request IDs
mapping/D/nnz evidence
DB roundtrip
metric/reference/tolerance
HNSW boundary/index behavior
Chinese manifest identity
raw dense/sparse scores
fusion reference results
four lower evidence statuses
candidate_a_readiness_state
execution_completion_state
cleanup status
secret/privacy scan
canonical regression
limitations
```

**Final Developer status**
- `READY FOR INDEPENDENT AUDIT 2` if the implementation/execution evidence is complete enough for independent audit, whether Candidate A result is PASS or a reproducible FAIL.
- `BLOCKED` if a required dependency/credential/source/permission remains unavailable.
- `INCONCLUSIVE` for UNKNOWN evidence.

**STOP**
Do not perform Audit 2. Do not merge. Do not create production retrieval work.

## Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006
                              |
                              +-> T007 -> T008 -> T009 -> T010 -> T011 -> T012
```

T007 is impossible until the Slice 20 hard gate in T001 is open.

## Frozen Coverage Matrix

| Task | FR | AS | NS |
|---|---|---|---|
| T001 | FR-002,FR-003,FR-008 | AS-08 | NS-03,NS-08 |
| T002 | FR-008 | AS-08 | NS-08 |
| T003 | FR-004,FR-006 | AS-05 | NS-05,NS-07 |
| T004 | FR-001,FR-002,FR-005 | AS-02 | NS-01,NS-02 |
| T005 | FR-001,FR-003,FR-005 | AS-03,AS-06 | NS-03,NS-06 |
| T006 | FR-001,FR-003,FR-005 | AS-04 | NS-03,NS-06 |
| T007 | FR-001,FR-002,FR-005 | AS-01,AS-03,AS-06,AS-07 | NS-04,NS-07 |
| T008 | FR-004,FR-005,FR-006 | AS-05,AS-07 | NS-04,NS-05,NS-07 |
| T009 | FR-004,FR-005,FR-007 | AS-05,AS-07 | NS-05 |
| T010 | FR-005,FR-008 | AS-06,AS-07,AS-08 | NS-04,NS-06,NS-07,NS-08 |
| T011 | FR-001..FR-008 | AS-01..AS-08 | NS-01..NS-08 |
| T012 | FR-005,FR-007,FR-008 | AS-07,AS-08 | NS-08 |

No Frozen Spec requirement is left without an executable task.
