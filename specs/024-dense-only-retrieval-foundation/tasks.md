# Slice 24 — Tasks

Frozen Spec d8d582e45442078778c30da0282a821dac87e300; exact Plan/Checklist in same planning commit. All tasks unchecked. No development before T2401 PASS. Path aliases index.ts, projection.ts, repository.ts, admission.ts refer ONLY to apps/server/api/src/ai/dense-retrieval/. Contract/DB tests = tests/ai/dense-retrieval-contract.test.ts and tests/db/dense-retrieval.integration.test.ts. All paths limited to Plan §6; any new need STOP. Each implementation task starts with relevant RED evidence before behavior edits, then GREEN; no changes to Frozen Spec or existing governance. Dependencies sequential unless explicitly independent; no separate parallel implementation.

- [ ] T2401 [REQ:V1-X14; FR-001, FR-015, FR-017, FR-018] Developer Gate and Remote Truth (read-only) [VERIFY:C13,C14,C15; AS-13,AS-14]
  - Plan: §8 rows C13, C14, C15; Checklist same IDs.
  - Prerequisites: None; formal planning and ownership admission required.
  - Allowed paths: None.
  - Required verification/evidence: C15 evidence: exact main CI/governance; spec/plan/checklist/tasks blobs; Audit 1 admission; registry and consuming binding eligibility; current migration slot/conflicts; 016/017 audit provenance, 019 reproducibility, 020 audited merge, 023 exact independent Audit 2 + merge/post-merge compatible port; no competing work.
  - Completion/STOP: All predicates proven before any edit. Missing evidence/slot or contract drift STOP. No provider key needed.

- [ ] T2402 [REQ:V1-C28,V1-X01; FR-002, FR-003, FR-004, FR-005, FR-013, FR-015, FR-018] Projection identity, schema and forward migration [VERIFY:C01,C02,C03,C10; AS-01,AS-02,AS-03,AS-10]
  - Plan: §8 rows C01, C02, C03, C10; Checklist same IDs.
  - Prerequisites: T2401.
  - Allowed paths: projection.ts, repository.ts, packages/domain/src/dense-retrieval-schema.ts, db/schema/index.ts, admitted db/migrations/042_knowledge_embeddings.sql, contract/DB tests and exact migration inventory tests; sole consuming change-binding manifest per Plan §6.
  - Required verification/evidence: Prepare consuming FEATURE_IMPLEMENTATION binding after T2401 PASS, exact authorized production paths before editing them, synchronize against actual diff; RED identity/hash/dimension/FK/unique/RLS and clean/upgrade inventory first; implement deterministic source-bound chunk and one table, role grants/FORCE RLS, GREEN actual PG18. bunx vitest run tests/ai/dense-retrieval-contract.test.ts tests/db/dense-retrieval.integration.test.ts tests/db/migration-repro.test.ts tests/db/migration-upgrade-evidence.test.ts.
  - Completion/STOP: One table, no second authority; historical SQL unchanged; exact path admission and migration conflicts resolved, otherwise STOP.

- [ ] T2403 [REQ:V1-C20,V1-C21,V1-C39,V1-C41,V1-C25,V1-C37,V1-X01; FR-003, FR-004, FR-006, FR-007, FR-008, FR-009, FR-012, FR-014] Shared existing eligibility and candidate admission [VERIFY:C02,C04,C05,C08; AS-02,AS-04,AS-05,AS-08]
  - Plan: §8 rows C02, C04, C05, C08; Checklist same IDs.
  - Prerequisites: T2402.
  - Allowed paths: admission.ts, professional-knowledge-consumption.ts (narrow owner helper extraction only), contract/DB tests.
  - Required verification/evidence: RED wrong actor/family/case/target/purpose, consent/compliance/safety/unknown, all 017 eligibility negatives and exact Scene/Intervention binding; current snapshot, full admitted relation/coverage; GREEN and existing 017 regression.
  - Completion/STOP: Existing consumption API/behavior unchanged, no duplicate rules, no fabricated production authority; unresolved owner seam STOP.

- [ ] T2404 [REQ:V1-C28,V1-C03,V1-X01,V1-C41; FR-002, FR-003, FR-004, FR-005, FR-012, FR-013, FR-014] Document generation and durable write [VERIFY:C01,C02,C03,C08,C09; AS-01,AS-02,AS-03,AS-08,AS-09]
  - Plan: §8 rows C01, C02, C03, C08, C09; Checklist same IDs.
  - Prerequisites: T2402,T2403.
  - Allowed paths: projection.ts, repository.ts, admission.ts, index.ts, contract/DB tests.
  - Required verification/evidence: RED exact approved source/rights, dense document normalized Port, float32, duplicate/concurrent/conflict, partial batch and drift while embed pending, denied dispatch; GREEN real DB replay/rollback/reconnect/restart and safe errors.
  - Completion/STOP: All vectors tied to exact immutable source/chunks and one compatible config; batch atomic, no stale write; missing real credentials does not block deterministic RED/GREEN.

- [ ] T2405 [REQ:V1-C21,V1-C03,V1-X01; FR-004, FR-005, FR-007, FR-009, FR-010, FR-012, FR-013] Actual dense retrieval [VERIFY:C03,C05,C06,C08; AS-03,AS-05,AS-06,AS-08]
  - Plan: §8 rows C03, C05, C06, C08; Checklist same IDs.
  - Prerequisites: T2402–T2404.
  - Allowed paths: repository.ts, admission.ts, index.ts, contract/DB tests.
  - Required verification/evidence: RED query role/config/hash/dim/missing coverage, pre-query gate; real PG18 admitted MATERIALIZED relation with adversarial closer denied vector, independent L2 oracle, ties, K=20 and empty; GREEN.
  - Completion/STOP: Distance solely over admitted compatible IDs; no post-filter, no global topK, no unauthorized query embed.

- [ ] T2406 [REQ:V1-C24,V1-C27,V1-C41; FR-001, FR-004, FR-006, FR-008, FR-011, FR-012, FR-013, FR-014, FR-016, FR-017] Public reranker composition and release revalidation [VERIFY:C04,C07,C08,C09,C16; AS-04,AS-07,AS-08,AS-09,AS-11,AS-12,AS-13]
  - Plan: §8 rows C04, C07, C08, C09, C16; Checklist same IDs.
  - Prerequisites: T2405.
  - Allowed paths: index.ts, admission.ts, contract/DB tests.
  - Required verification/evidence: RED exact normalized rerank input, complete identity/rank/score, missing/foreign/duplicate/invalid and no-call empty; before-dispatch and after-await drift; GREEN bounded Top 5, safe error, no partial output.
  - Completion/STOP: Use only merged 023 index public port; no adapter/route/fallback; authorization rechecked at final decision.

- [ ] T2407 [REQ:V1-X14,V1-C28,V1-C21; FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-017, FR-018] Mandatory offline and real DB verification/regression [VERIFY:C01,C02,C03,C04,C05,C06,C07,C08,C09,C10,C13,C14; AS-01,AS-02,AS-03,AS-04,AS-05,AS-06,AS-07,AS-08,AS-09,AS-10,AS-13,AS-14]
  - Plan: §8 rows C01, C02, C03, C04, C05, C06, C07, C08, C09, C10, C13, C14; Checklist same IDs.
  - Prerequisites: T2402–T2406.
  - Allowed paths: new contract/DB/architecture tests, corpus fixture; migration inventory tests only additive; no production changes outside previous tasks.
  - Required verification/evidence: Complete scope and adversarial interleaving matrix (add targeted RED/GREEN tests only as needed, return to owning task for any actual defect); actual clean/upgrade/restart role/grants/RLS/distance/cleanup; bunx vitest run tests/ai/dense-retrieval-contract.test.ts tests/db/dense-retrieval.integration.test.ts tests/architecture/dense-retrieval-boundary.test.ts tests/db/migration-repro.test.ts tests/db/migration-upgrade-evidence.test.ts; bun run verify-all -- --archive; bun run guard:static; node scripts/guard-static.mjs --self-test; bun run typecheck.
  - Completion/STOP: All mandatory offline/DB mechanics PASS; preserve canonical and 017/019/020/023 existing guards; any failed required test STOP.

- [ ] T2408 [REQ:V1-X11,V1-X14,V1-C27,V1-C41; FR-001, FR-010, FR-011, FR-013, FR-014, FR-016, FR-017] Controlled real provider and integrated C technical verification [VERIFY:C09,C11,C12,C16; AS-09,AS-11,AS-12,AS-13]
  - Plan: §8 rows C09, C11, C12, C16; Checklist same IDs.
  - Prerequisites: T2407; authorized nonpersonal manifest, real PG18, both permitted provider configs/credentials/rights.
  - Allowed paths: tests/ai/dense-retrieval-live.test.ts, tests/fixtures/dense-retrieval-corpus.json, sanitized tests/evidence/dense-retrieval-stage-a.json.
  - Required verification/evidence: Predeclare immutable manifest/oracle before attempt; bunx vitest run tests/ai/dense-retrieval-live.test.ts with existing port-controlled private config and explicit opt-in; actual document/query, persistence/read/L2, exact admitted rerank request/output, Top 5 and independent oracle in single lineage, separately record individual states; no real family input; inspect sanitized evidence.
  - Completion/STOP: Actual lower and full chain PASS only with real proof; missing dependency BLOCKED/NOT_VERIFIED, observed incompatibility FAIL; no fabricated data/route, no full closure.

- [ ] T2409 [REQ:V1-X14,V1-C27; FR-001, FR-013, FR-014, FR-015, FR-016, FR-017, FR-018] Exact subject closeout and Audit 2 handoff [VERIFY:C12,C13,C14,C15,C16; AS-11,AS-12,AS-13,AS-14]
  - Plan: §8 rows C12, C13, C14, C15, C16; Checklist same IDs.
  - Prerequisites: T2407; T2408 PASS or explicitly blocked/unverified/failed with evidence (not positive closeout).
  - Allowed paths: exact consuming .specify/change-bindings/024-dense-only-retrieval-foundation.json; sanitized evidence only; no registry, validators, CI, other specs.
  - Required verification/evidence: node .specify/scripts/validate-governance.mjs; node .specify/scripts/tests/run-governance-tests.mjs; node .specify/scripts/validate-change-governance.mjs --base $BASE --head HEAD; canonical verify-all, exact CI/governance; exact changed paths, frozen blobs, clean tree, evidence hashes and lineage; reconcile main, report all states per Plan §7.
  - Completion/STOP: Independent Audit 2 required later; no merge authorization by developer or implementation-only PASS; Gold/production NOT AUTHORIZED; stop if drift or missing necessary evidence.

## Closure
T2401 is a hard gate before any production/test modification. T2407 mandatory PASS; T2408 required for positive complete C technical closure. If T2408 blocked/unverified, T2409 may produce a truthful bounded implementation-only handoff, never authorize final merge, full technical closure or production. Independent Audit 2 not part of planning and not replaced by CI. Existing task evidence protocol controls marking completion; no task marked complete without required proof. All SC-001–004 mapped via C01–16.
