# Slice 22 — Developer Tasks

Feature: 022-pg-jieba-lexical-readiness-spike  
These tasks implement only the frozen lexical-substrate Spike. They do not authorize Audit 2 or merge.

## T001 — Remote Truth and Implementation Gate

**Purpose**  
Re-establish current remote truth and decide whether implementation execution is authorized without redoing product decisions.

**Prerequisites**
- Plan/Checklist/Tasks frozen.
- Audit 1 FINAL PASS.

**Allowed Paths**
- No repository mutation.

**Forbidden Paths**
- All code/test/fixture/governance mutation.

**Actions**
1. Read current main, Frozen Spec head/blob and frozen planning head/blobs.
2. Compare planning branch/current main; if main drifted, classify whether drift touches 022 Authority, Stage A, governance or planned test paths.
3. Confirm Slice 19 Stage A PG18 baseline remains present.
4. Confirm Slice 20 implementation is not being made a dependency.
5. Confirm Slice 21 result is not being made a dependency.
6. Search for competing 022 implementation/PR.
7. Confirm Docker/source access is sufficient to attempt the pinned build.
8. Confirm formal Authority Doc blobs required for lexicon/corpus provenance remain readable.

**Verification**
- behind = 0 before implementation mutation, using ordinary reconciliation if necessary;
- Frozen Spec blob exact;
- no competing 022 implementation;
- no Authority conflict.

**Done Criteria**
- implementation gate report records OPEN, or a truthful BLOCKED/RETURN condition with reason.

**STOP Conditions**
- Frozen Spec drift;
- semantic Authority conflict;
- current main removes/incompatibly changes Slice19 Stage A contract;
- competing implementation requires reconciliation;
- product judgment is needed.

**Evidence Ownership**
- Developer preflight report: main/head/merge base, Spec identity, upstream states, gate state/reason.

**Coverage**
- FR-001,FR-008,FR-011,FR-012; AS-01,AS-06; NS-02,NS-03,NS-10,NS-12.

---

## T002 — Governance and Frozen Path Recheck

**Purpose**  
Prove the implementation remains test-only and needs no governance prerequisite.

**Prerequisites**
- T001 gate OPEN.

**Allowed Paths**
- No mutation during classification.

**Forbidden Paths**
- .specify/ registry or change-binding edits;
- product/infra mutation.

**Actions**
1. Re-read current validate-change-governance.mjs.
2. Confirm tests/ remains a fixed-exempt prefix.
3. Freeze the only allowed implementation paths:
   - tests/fixtures/pg-jieba-readiness/Dockerfile
   - tests/fixtures/pg-jieba-readiness/xiaoshuyin_022_test.dict
   - tests/fixtures/pg-jieba-readiness/lexicon-manifest.json
   - tests/fixtures/pg-jieba-readiness/corpus-manifest.json
   - tests/fixtures/pg-jieba-readiness/readiness-state.ts
   - tests/architecture/pg-jieba-readiness-evidence.test.ts
   - tests/db/pg-jieba-readiness.test.ts
4. Confirm no ownership rule/change-binding is required for this set.

**Verification**
- governance classifier/validator recognizes the intended diff as fixed-exempt;
- zero product path.

**Done Criteria**
- GOV mode = TEST_ONLY_FIXED_EXEMPT;
- GOVERNANCE PREREQUISITE = NOT REQUIRED.

**STOP Conditions**
- any required implementation path falls outside the seven frozen paths;
- tests/ no longer fixed-exempt;
- a registry exception would be required.

**Evidence Ownership**
- Developer governance preflight output and current validator blob/hash.

**Coverage**
- FR-011,FR-012; AS-06; NS-10,NS-11.

---

## T003 — Freeze Authorized Lexicon and Corpus Fixtures

**Purpose**  
Create the bounded authorized non-professional test lexicon/corpus before any runtime outcome can influence selection.

**Prerequisites**
- T002 PASS.
- No pg_jieba runtime observation has been executed for this implementation head/run family.

**Allowed Paths**
- tests/fixtures/pg-jieba-readiness/xiaoshuyin_022_test.dict
- tests/fixtures/pg-jieba-readiness/lexicon-manifest.json
- tests/fixtures/pg-jieba-readiness/corpus-manifest.json

**Forbidden Paths**
- all other files;
- any invented professional term/synonym/label/frequency/POS;
- family/minor/private text.

**Actions**
1. Create dictionary with exactly:
   - 家庭联盟
   - 手机使用合约
   - 小树荫
   one UTF-8 term per line, no weight/POS.
2. Create lexicon manifest with exact source path/blob/reference, authority class, permission and no-new-professional-judgment flag.
3. Create corpus manifest with D01-D04 and Q01-Q02 exactly as Plan §10.
4. Record literal expected match sets and distractors exactly as frozen.
5. Compute SHA-256 of exact dictionary and every text/query payload.
6. Commit fixtures before any baseline/loaded execution.
7. Record fixture git blobs.

**Verification**
- C22-AUTH-01..10 PASS;
- C22-LEX-01..03,C22-LEX-09,C22-LEX-11 PASS;
- C22-CORP-01..10 PASS.

**Done Criteria**
- immutable fixture commit exists and all provenance/fingerprints are complete.

**STOP Conditions**
- any term/source requires professional judgment;
- source blob/reference cannot be proven;
- a non-degenerate corpus cannot be formed from permitted text;
- runtime was already observed before fixture freeze.

**Evidence Ownership**
- fixture git blobs + manifest SHA-256 values + source Authority blob identities.

**Coverage**
- FR-003,FR-004,FR-005,FR-012; AS-03,AS-04; NS-04,NS-05,NS-06,NS-12.

---

## T004 — Implement Evidence State Machine and Adversarial Architecture Tests

**Purpose**  
Make PASS/FAIL/BLOCKED/UNKNOWN/NOT_EVALUATED mechanical before real execution.

**Prerequisites**
- T003 fixture identities frozen.

**Allowed Paths**
- tests/fixtures/pg-jieba-readiness/readiness-state.ts
- tests/architecture/pg-jieba-readiness-evidence.test.ts

**Forbidden Paths**
- runtime/production code;
- any manually set aggregate PASS override.

**Actions**
1. Implement the five lower predicates and exact state vocabulary from Plan §15.
2. Implement aggregate precedence exactly.
3. Implement mandatory reason-code validation.
4. Add adversarial cases for unavailable source/Docker/base image => BLOCKED.
5. Add observed compile/load incompatibility => FAIL.
6. Add identity incomplete => UNKNOWN.
7. Add no attempt => NOT_EVALUATED.
8. Add lexicon/corpus fingerprint drift and unauthorized provenance.
9. Add fallback/mock rejection.
10. Add tokenization-only, lexicon-only and query-mismatch partial states.
11. Add cleanup failure precedence.
12. Add mixed-head/image/fixture evidence rejection.

**Verification**
- architecture suite covers every row C22-NEG-01..12, C22-STATE-01..10 and C22-HEAD-01..07.

**Done Criteria**
- no constructed evidence object can reach aggregate PASS unless all five lower predicates are PASS and identities match.

**STOP Conditions**
- a state requires subjective/manual interpretation;
- state semantics conflict with Frozen Spec;
- unavailable and incompatible cannot be separated mechanically.

**Evidence Ownership**
- architecture test output and state-machine source blob.

**Coverage**
- FR-007,FR-008,FR-009; AS-05,AS-06; NS-01..NS-09.

---

## T005 — Implement Disposable Derived-Stage-A Harness

**Purpose**  
Build the exact upstream pg_jieba source against the exact Stage A PG18 base without changing production infrastructure.

**Prerequisites**
- T003 fixtures frozen.
- T004 state machine available.

**Allowed Paths**
- tests/fixtures/pg-jieba-readiness/Dockerfile
- tests/db/pg-jieba-readiness.test.ts

**Forbidden Paths**
- docker-compose.stage-a.yml;
- db/init/**;
- .github/**;
- scripts/**;
- package manifests/lockfiles;
- source patches/forks;
- production migrations.

**Actions**
1. Dockerfile FROM the exact Slice19 immutable Stage A image.
2. Install only build prerequisites needed to compile upstream pg_jieba inside the derived image.
3. Fetch/checkout exactly pg_jieba d0ffac8028328b2566a889ff4db3d74ba63d1b42.
4. Initialize and verify libjieba exactly 391121d5db0f31dd5ce9795d4d34812f20eeb25c.
5. Build/install without source patch.
6. Copy the frozen custom dictionary into pg_config --sharedir / tsearch_data through the image build.
7. In the DB test, implement unique run-family container/volume naming, startup, health, privileged CREATE EXTENSION, runtime-role connection, evidence collection and finally cleanup.
8. Start pg_jieba through shared_preload_libraries and use startup user_dict values from Plan §9.
9. Never use jieba_reload_dict() as the positive cross-backend mechanism.
10. Keep all evidence secrets redacted.

**Verification**
- Dockerfile/source scan proves exact pins and no patch;
- test code has unconditional finally cleanup;
- no production path touched.

**Done Criteria**
- harness is syntactically/test-discoverable and ready for exact-head execution.

**STOP Conditions**
- build requires editing upstream source;
- build requires production Docker/DB changes;
- a non-pg_jieba tokenizer is proposed;
- permanent DB state is required.

**Evidence Ownership**
- Dockerfile blob, harness blob, build/source identity fields in runtime evidence.

**Coverage**
- FR-001,FR-003,FR-010,FR-011; AS-01,AS-07; NS-01,NS-07,NS-10,NS-11.

---

## T006 — Candidate Exact-Head Freeze Before Runtime

**Purpose**  
Prevent runtime evidence from being collected against a moving implementation/fixture target.

**Prerequisites**
- T003-T005 implementation complete.
- architecture tests pass offline.

**Allowed Paths**
- No new mutation during freeze/read-back.

**Forbidden Paths**
- runtime execution before identity freeze.

**Actions**
1. Commit all Slice22 implementation/test fixture changes.
2. Push candidate branch.
3. Read back exact implementation head from GitHub.
4. Read back all seven changed-file blobs.
5. Read current main, merge base, ahead/behind and changed files.
6. Confirm Frozen Spec and planning blobs unchanged.
7. Confirm changed-file set is subset of seven allowed paths.
8. Compute fixture hashes and run_family_id seed.
9. If head changes after this point, discard all runtime evidence and repeat T006.

**Verification**
- exact head/fixture identities mechanically complete.

**Done Criteria**
- one exact candidate head is frozen for execution.

**STOP Conditions**
- head/fixture mismatch;
- scope widening;
- behind != 0 without ordinary reconciliation;
- any file changes after freeze without returning to T006.

**Evidence Ownership**
- remote exact-head read-back and fixture identity manifest.

**Coverage**
- FR-006,FR-008; AS-01,AS-08; NS-05,NS-06.

---

## T007 — Execute PG18 Compatibility and Environment Identity

**Purpose**  
Determine whether the pinned actual pg_jieba build is compatible with exact PG18 Stage A.

**Prerequisites**
- T006 exact head frozen.
- explicit PG_JIEBA_READINESS_TEST=1 opt-in.
- Docker/build execution available enough to attempt.

**Allowed Paths**
- no repository mutation;
- disposable Docker image/container/volume state only.

**Forbidden Paths**
- source patching;
- fallback source/fork;
- production/shared PostgreSQL.

**Actions**
1. Pull/inspect exact Stage A base.
2. Obtain exact upstream source/submodule.
3. Build derived image.
4. Capture source/submodule/build and installed file hashes.
5. Start BASELINE environment with shared preload and upstream default user dictionary.
6. Create extension as disposable admin.
7. Query PG/version/extension/parser/config identities.
8. Connect as xiaoshuyin_app and query role security facts.
9. Exercise a minimal read-only pg_jieba tokenization call.
10. Classify PG_JIEBA_COMPATIBILITY mechanically.

**Verification**
- C22-ENV-01..08 and C22-COMP-01..09.

**Done Criteria**
- compatibility is one truthful terminal state with reason/evidence.

**STOP Conditions**
- source/base/build dependency unavailable => record BLOCKED and proceed only to cleanup/evidence handoff;
- actual incompatibility => record FAIL, do not patch/rescue;
- identity inconclusive => UNKNOWN;
- do not continue positive downstream predicates unless compatibility PASS.

**Evidence Ownership**
- build logs, Docker identity, PostgreSQL catalog output, role facts, lower predicate.

**Coverage**
- FR-001,FR-006,FR-007,FR-009; AS-01,AS-06; NS-01,NS-02,NS-03.

---

## T008 — Execute Lexicon Load, Tokenization and Differential Proof

**Purpose**  
Prove the frozen custom lexicon is actually loaded and changes real pg_jieba behavior as predeclared.

**Prerequisites**
- T007 PG_JIEBA_COMPATIBILITY = PASS.
- frozen fixture identity matches T006.

**Allowed Paths**
- no repository mutation;
- disposable BASELINE and LEXICON_LOADED environments.

**Forbidden Paths**
- lexicon edit;
- jieba_reload_dict positive proof;
- term replacement;
- fallback tokenizer.

**Actions**
1. Record BASELINE SHOW shared_preload_libraries and pg_jieba.user_dict = jieba_user.
2. Run ts_debug + to_tsvector for D01,D02,D04 across three fresh connections; capture raw outputs.
3. Start fresh LEXICON_LOADED environment using the same derived image and user_dict = jieba_user,xiaoshuyin_022_test.
4. Verify in-container custom dictionary SHA-256 equals frozen manifest.
5. Run identical probes across three fresh connections.
6. Prove per-environment repeat stability.
7. Derive LEXICON_LOAD only from provenance, exact dictionary fingerprint/tsearch_data presence, successful startup and exact user_dict identity.
8. Compare the one predeclared primary differential term 手机使用合约 in D02: require it absent as one BASELINE lexeme and present as one LEXICON_LOADED lexeme.
9. Do not substitute 家庭联盟 or 小树荫 if the primary differential fails.
10. Derive TOKENIZATION from actual pg_jieba output, repeated-run stability and the primary differential.

**Verification**
- C22-LEX-04..12 and C22-TOK-01..08.

**Done Criteria**
- both predicates are terminal and evidence contains raw baseline/loaded outputs.

**STOP Conditions**
- fixture changed;
- custom dictionary identity cannot be shown;
- a term would need replacement after observation;
- tokenizer/output source cannot be attributed to actual pg_jieba.

**Evidence Ownership**
- raw baseline/loaded token rows, vector output, config/file hashes, lower states/reasons.

**Coverage**
- FR-002,FR-003,FR-004,FR-006,FR-007; AS-02,AS-03; NS-04,NS-05,NS-07,NS-08.

---

## T009 — Execute Lexical Query, Injected Failure and Cleanup

**Purpose**  
Prove reproducible lexical retrieval correctness and disposal behavior without building Candidate B.

**Prerequisites**
- T008 LEXICON_LOAD = PASS and TOKENIZATION = PASS.
- corpus/query fixture identity matches T006.

**Allowed Paths**
- no repository mutation;
- LEXICON_LOADED and FAILURE_INJECTION disposable environments.

**Forbidden Paths**
- permanent table/index;
- dense/sparse/fusion/RRF/rerank;
- ranking tuning;
- query/expected-match edits.

**Actions**
1. In LEXICON_LOADED, construct D01-D04 through VALUES/CTE or equivalent transaction-local data.
2. Use actual pg_jieba config to build document vector and plain query.
3. Execute Q01 and Q02; return deterministic matched doc IDs.
4. Repeat each query three times on fresh connections.
5. Require exact Q01=[D02], Q02=[D01].
6. Record raw SQL/config identity and matched IDs.
7. Start FAILURE_INJECTION with a deliberately missing test dictionary identity or equivalent bounded invalid lexicon configuration.
8. Prove the injected failure cannot yield LEXICON_LOAD PASS and is not mislabeled upstream incompatibility.
9. Execute finally cleanup for every container/volume/image path.
10. Inspect that exact run-family containers/volumes are absent and no host/production state changed.

**Verification**
- C22-QRY-01..08, C22-NEG-10..11, C22-CLN-01..07.

**Done Criteria**
- LEXICAL_QUERY and CLEANUP each have terminal states and raw evidence.

**STOP Conditions**
- query correctness would require a professional relevance judgment;
- permanent object/index is required;
- any route-quality/ranking work is proposed;
- cleanup cannot be completed => CLEANUP FAIL.

**Evidence Ownership**
- query result rows, negative-startup observation, Docker cleanup checks, lower states.

**Coverage**
- FR-005,FR-006,FR-009,FR-010; AS-04,AS-05,AS-07; NS-09,NS-11.

---

## T010 — Aggregate Evidence and Rerun Reproducibility

**Purpose**  
Derive one truthful Slice22 result and prove it does not depend on residue.

**Prerequisites**
- T007-T009 terminal evidence exists, or an upstream terminal BLOCKED/FAIL/UNKNOWN has correctly short-circuited later positive work while cleanup still ran.

**Allowed Paths**
- no repository mutation;
- runtime evidence file outside committed source tree.

**Forbidden Paths**
- manual aggregate override;
- combining different exact heads/images/fixtures;
- hiding attempted failures.

**Actions**
1. Populate the five lower predicate states and reason codes.
2. Derive aggregate with readiness-state.ts only.
3. Produce sanitized evidence artifact outside the committed tree; compute SHA-256.
4. If the terminal result is aggregate PASS or an observed technical FAIL, remove all first-run state and execute a second clean attempt with a fresh run_family_id, same exact head/source/fixtures and fresh volumes. A compatibility FAIL must be reproduced through the same failing build/load stage; a later FAIL must be reproduced through the same failing stage from a clean environment.
5. BLOCKED/UNKNOWN may stop without a second technical run only because the recorded unavailable/inconclusive dependency prevents such a result.
6. Compare the declared technical outputs/states between applicable runs.
7. Record all attempts, including failures.

**Verification**
- C22-STATE-01..10, C22-CLN-08..10, C22-HEAD-01..08.

**Done Criteria**
- one truthful aggregate PASS/FAIL/BLOCKED/UNKNOWN/NOT_EVALUATED is mechanically derived;
- any final PASS or observed technical FAIL has clean rerun/reproduction proof; BLOCKED/UNKNOWN retains the explicit reason a reproducible technical result could not be obtained.

**STOP Conditions**
- evidence requires mixing run families;
- first-run residue is needed;
- aggregate needs manual judgment;
- secret/private content leaks into artifact.

**Evidence Ownership**
- final sanitized runtime artifact + SHA-256 + rerun comparison.

**Coverage**
- FR-006,FR-007,FR-008,FR-009,FR-010; AS-05..AS-08; NS-01..NS-09.

---

## T011 — Exact-Head Regression and Scope Convergence

**Purpose**  
Prove the terminal evidence belongs to the final exact implementation head and the rest of the repository remains green.

**Prerequisites**
- T010 terminal evidence.
- no implementation changes after the evidenced head.

**Allowed Paths**
- no new mutation unless correcting a defect within the seven frozen files; any correction invalidates runtime evidence and returns to T006.

**Forbidden Paths**
- weakening guards/tests/governance;
- scope widening;
- mixing stale evidence.

**Actions**
1. Re-read current main and exact implementation head from GitHub.
2. Read merge base, ahead/behind and changed files.
3. Re-read Frozen Spec, Plan, Checklist, Tasks blobs.
4. Confirm changed files remain within the frozen seven implementation paths plus planning artifacts.
5. Confirm runtime evidence repo_head equals exact final head.
6. Run new architecture suite.
7. Run explicit real DB Spike suite as applicable to the claimed terminal state.
8. Run current change-governance validator.
9. Run static guard and self-test.
10. Run canonical verify-all.
11. Run secret/privacy/scope scans.
12. If any source file changes, return to T006 and rerun all affected runtime evidence.

**Verification**
- C22-REG-01..06 and C22-HEAD-01..09.

**Done Criteria**
- exact-head regression/gov/scope checks PASS while the terminal Spike result remains truthful.

**STOP Conditions**
- regression/governance fails;
- head drift after evidence;
- changed-file scope widens;
- evidence cannot bind to final head.

**Evidence Ownership**
- exact-head verification matrix and canonical command outputs.

**Coverage**
- all FR/AS/NS by composition.

---

## T012 — Developer Handoff and STOP

**Purpose**  
Prepare a zero-guess independent Audit 2 package without performing Audit 2.

**Prerequisites**
- T011 complete, or a truthful earlier BLOCKED/UNKNOWN terminal state has all available evidence and cleanup bound to an exact head.

**Allowed Paths**
- no repository mutation; report/handoff only.

**Forbidden Paths**
- Audit 2;
- merge;
- production RAG work;
- next-slice development.

**Actions**
Report:
1. repository, current main, exact implementation head;
2. merge base, ahead/behind, changed files;
3. Frozen Spec/Plan/Checklist/Tasks heads/blobs;
4. governance mode;
5. Stage A base + derived image identity;
6. PG18 + pg_jieba source/submodule/version/build hashes;
7. runtime role/security facts;
8. lexicon and corpus/query identities/provenance/fingerprints;
9. raw baseline/loaded tokenization and differential;
10. raw lexical query outputs;
11. failure-injection result;
12. five lower states/reasons;
13. mechanically derived aggregate state;
14. cleanup/rerun result;
15. runtime evidence artifact SHA-256;
16. canonical regression/governance results;
17. limitations and explicit statement that no production readiness/route selection is implied.

**Verification**
- C22-HO-01..05 and exact-head checklist all satisfied.

**Done Criteria**
- READY FOR INDEPENDENT AUDIT 2 for a complete PASS or reproducible FAIL execution;
- BLOCKED for unavailable dependency/source/environment;
- INCONCLUSIVE for UNKNOWN evidence.

**STOP Conditions**
- always STOP after handoff.
- do not audit or merge.

**Evidence Ownership**
- Developer final report owns the handoff; independent Audit 2 owns the later audit verdict.

**Coverage**
- FR-006,FR-008,FR-009,FR-010,FR-012; AS-06..AS-08; NS-12.

## Dependency Graph

T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007 -> T008 -> T009 -> T010 -> T011 -> T012

T007 may terminate the positive execution chain with FAIL/BLOCKED/UNKNOWN, but cleanup/evidence/handoff obligations still apply. No task authorizes scope widening.
