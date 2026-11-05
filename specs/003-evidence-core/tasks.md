# Tasks: 003-evidence-core（Evidence Core）

**Feature**: `specs/003-evidence-core`  
**Tasks authoring base**: `063d9d2beaef62288485e91ef08d2e7ce11f19e4`  
**Stage**: Tasks only  
**Frozen inputs**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/**`, `checklists/requirements-quality.md`, approved V1 Docs  
**Future Implement rule**: execute these tasks in dependency order; do not reinterpret product semantics.

> 本文件是未来 Implement AI 的唯一逐任务执行合同。当前 Tasks-generation 阶段所有任务保持未勾选。  
> Phase 0 是硬门禁：在 T009 明确 PASS 前，禁止执行 T010 以后任何测试、migration、business code 或 generated artifact 变更。  
> 任一依赖不满足固定停止：`BLOCKED — SLICE 3 IMPLEMENTATION DEPENDENCY`。  
> 发现 final dependency contract 改变 frozen Plan（尤其 Case authorization、current Family、Case composite key、idempotency transport/canonical/replay seam）时必须回 Plan Review；不得在 Implement 中猜测或复制基础设施。  
> TDD 顺序是硬约束：完整 RED（T012–T029）→ reviewed migration（T030–T036）→ domain/API GREEN（T037–T050）→ contract/generated（T051–T054）→ boundary/final verification。  
> Migration 实际 ordinal 只能在 Gate PASS 后由 T010 从 final main 读取，本文只使用占位 `<resolved-next>_evidence_core.sql`。

## Task Format

每项均包含：
- `Depends on`：真实依赖；
- `Files`：未来允许/需要触及或只读核对的明确路径；
- `Action`：可执行动作；
- `Verify`：机械验收；
- `Evidence`：Implement 必须保存到最终证据索引的结果。

`[P]` 仅表示在其依赖全部满足后，该任务与同批其它 `[P]` 任务不修改相同文件、也不依赖尚未确定的 schema/contract，可安全并行。Migration、共享 domain 文件、route、generated chain 均不标 `[P]`。


## Phase 0 — Implement Gate（硬门禁；T010 之前不得写任何 Slice 3 test/code/migration）

- [ ] T001 [P] [REQ:FR-020;CHK111;plan:0.2] Identify the actual Slice 1 final SHA from authoritative merge/converge evidence. [VERIFY:`git fetch origin`; `git merge-base --is-ancestor <slice1-final-sha> origin/main` exits 0 and independent Converge + CI evidence is green]
  - **Depends on**: ∅
  - **Files**: read-only: `specs/001-family-identity-core/**`, Git history, Slice 1 final PR/CI/converge evidence
  - **Action**: Identify the actual Slice 1 final SHA from authoritative merge/converge evidence. Require `Implement complete → independent Converge PASS → merged main`; do not use the Tasks-generation-time Head `1e6b1178...` as a frozen dependency. Record final SHA and evidence links.
  - **Verify**: `git fetch origin`; `git merge-base --is-ancestor <slice1-final-sha> origin/main` exits 0 and independent Converge + CI evidence is green
  - **Evidence**: Slice 1 final SHA, merge-base exit status, Converge evidence reference, CI run reference.

- [ ] T002 [P] [REQ:FR-020;CHK112;plan:0.2] Identify the actual Slice 2 final SHA. [VERIFY:`git fetch origin`; `git merge-base --is-ancestor <slice2-final-sha> origin/main` exits 0 and independent Converge + CI evidence is green]
  - **Depends on**: ∅
  - **Files**: read-only: `specs/002-case-core/**`, Git history, Slice 2 final PR/CI/converge evidence
  - **Action**: Identify the actual Slice 2 final SHA. Require `Implement complete → independent Converge PASS → merged main`; the frozen design Head `999295d...` is not proof of runtime implementation.
  - **Verify**: `git fetch origin`; `git merge-base --is-ancestor <slice2-final-sha> origin/main` exits 0 and independent Converge + CI evidence is green
  - **Evidence**: Slice 2 final SHA, merge-base exit status, Converge evidence reference, CI run reference.

- [ ] T003 [REQ:FR-020;CHK111-113;plan:0.2] Ordinary-merge the latest `origin/main` into the Slice 3 branch after both dependencies are actually merged. [VERIFY:`git merge-base --is-ancestor origin/main HEAD` exits 0; `git status --short` is clean; no force/rebase evidence]
  - **Depends on**: T001, T002
  - **Files**: branch `feat/003-evidence-core`; no Slice 3 business files
  - **Action**: Ordinary-merge the latest `origin/main` into the Slice 3 branch after both dependencies are actually merged. No rebase and no force push. Resolve only mechanical merge conflicts; any semantic conflict with frozen Slice 3 artifacts requires Plan Review.
  - **Verify**: `git merge-base --is-ancestor origin/main HEAD` exits 0; `git status --short` is clean; no force/rebase evidence
  - **Evidence**: Post-merge HEAD SHA and merge result. This SHA is the candidate pre-Implement baseline.

- [ ] T004 [P] [REQ:FR-004;FR-010;FR-021;CHK061-076;CHK111] Verify final Slice 1 Family / Person / guardian / consent-first semantics, `family_members(family_id,person_id)` uniqueness, exact 8-value `provenance_source`, deterministic current-Family semantics, and that guardian relationship does not grant Family access. [VERIFY:DB introspection + existing Family/guardian/current-Family tests pass; `provenance_source` values are exactly the frozen 8; `family_members` composite unique exists]
  - **Depends on**: T003
  - **Files**: read-only: `db/migrations/**`, `packages/domain/src/provenance.ts`, `packages/domain/src/repository.ts`, `packages/authorization/src/authorize.ts`, Family/guardian/current-Family tests
  - **Action**: Verify final Slice 1 Family / Person / guardian / consent-first semantics, `family_members(family_id,person_id)` uniqueness, exact 8-value `provenance_source`, deterministic current-Family semantics, and that guardian relationship does not grant Family access. Confirm UNDER_14 formal Person creation remains consent-first.
  - **Verify**: DB introspection + existing Family/guardian/current-Family tests pass; `provenance_source` values are exactly the frozen 8; `family_members` composite unique exists
  - **Evidence**: Schema query output, 8-value enum output, current-Family test output, guardian-vs-membership evidence.

- [ ] T005 [P] [REQ:FR-010;FR-011;FR-017;CHK093-105;CHK111] Verify final Slice 1 `withRlsTransaction`, runtime role non-owner/NOBYPASSRLS, RLS context functions, shared idempotency scope/hash/lock/second lookup/response snapshot, identity-level idempotency RLS, and `business_audit_events` structure. [VERIFY:Existing RLS/roles/idempotency/audit tests pass; DB queries prove runtime role `rolbypassrls=false`; shared idempotency table unique scope is `(actor_account_id,command_type,idempotency_key)`]
  - **Depends on**: T003
  - **Files**: read-only: `apps/server/api/src/db/tx.ts`, `apps/server/api/src/idempotency.ts`, `packages/domain/src/idempotency.ts`, `packages/domain/src/repository.ts`, `db/migrations/**`, DB role/RLS/audit tests
  - **Action**: Verify final Slice 1 `withRlsTransaction`, runtime role non-owner/NOBYPASSRLS, RLS context functions, shared idempotency scope/hash/lock/second lookup/response snapshot, identity-level idempotency RLS, and `business_audit_events` structure. Do not copy any of them.
  - **Verify**: Existing RLS/roles/idempotency/audit tests pass; DB queries prove runtime role `rolbypassrls=false`; shared idempotency table unique scope is `(actor_account_id,command_type,idempotency_key)`
  - **Evidence**: Function signatures, role/RLS query output, idempotency tests, audit/check constraint output.

- [ ] T006 [P] [REQ:FR-009;FR-010;FR-011;FR-017;CHK072;CHK096;CHK112] Verify final Slice 2 runtime shape: `cases` exists with `UNIQUE(id,family_id)` or contract-equivalent composite key; Case manager authorization and relevant Case action(s) are real; anti-enumeration is final; Case RLS is ENABLE/FORCE; `CASE_NOT_FOUND` / `CURRENT_FAMILY_NOT_FOUND` semantics are stable; CASE_CREATE audit/idempotency extensions are present. [VERIFY:Final Case tests pass and DB introspection proves schema/RLS; unauthorized/cross-Family detail behavior is mechanically indistinguishable per final contract]
  - **Depends on**: T003
  - **Files**: read-only: final `db/migrations/*case_core*.sql`, `packages/authorization/src/authorize.ts`, `apps/server/api/src/routes/cases.ts`, Case DB/domain/integration tests, generated OpenAPI
  - **Action**: Verify final Slice 2 runtime shape: `cases` exists with `UNIQUE(id,family_id)` or contract-equivalent composite key; Case manager authorization and relevant Case action(s) are real; anti-enumeration is final; Case RLS is ENABLE/FORCE; `CASE_NOT_FOUND` / `CURRENT_FAMILY_NOT_FOUND` semantics are stable; CASE_CREATE audit/idempotency extensions are present.
  - **Verify**: Final Case tests pass and DB introspection proves schema/RLS; unauthorized/cross-Family detail behavior is mechanically indistinguishable per final contract
  - **Evidence**: Case schema/constraint output, authorization test output, RLS output, error-contract/OpenAPI evidence.

- [ ] T007 [REQ:FR-017;CHK096;research:R-12;security:§6] Inspect the final shared idempotency helper specifically for Slice 3's safety ordering. [VERIFY:Code-path trace demonstrates no stored message response can be returned before current specific-Case authorization; otherwise emit `BLOCKED — SLICE 3 IMPLEMENTATION DEPENDENCY` and `Plan Review required`]
  - **Depends on**: T005, T006
  - **Files**: read-only: `apps/server/api/src/idempotency.ts` plus final Case authorization call sites
  - **Action**: Inspect the final shared idempotency helper specifically for Slice 3's safety ordering. It must permit `specific Case authorization → replay/mismatch` and still re-read/re-authorize inside EXECUTE. If final helper still hard-codes identity-only fast replay before any Case authorization, stop and require Plan Review/refactor at an approved shared seam. Do not add a route-local helper and do not copy a second idempotency engine.
  - **Verify**: Code-path trace demonstrates no stored message response can be returned before current specific-Case authorization; otherwise emit `BLOCKED — SLICE 3 IMPLEMENTATION DEPENDENCY` and `Plan Review required`
  - **Evidence**: Call-order trace with exact function/file references, or blocker evidence showing the unsupported seam.

- [ ] T008 [P] [REQ:FR-013;FR-015;CHK089-102;CHK111-112;§27A] Verify final Zod/OpenAPI single-source flow, actual generator/check commands, generated artifact paths, route registration pattern, stable error taxonomy, and CI job names. [VERIFY:`bun run openapi:check` (or final equivalent) passes on dependency-complete main; generator/check scripts and generated paths are real]
  - **Depends on**: T003
  - **Files**: read-only: `packages/contracts/src/schemas.ts`, `apps/server/api/src/app.ts`, `scripts/openapi-generate.mjs`, `scripts/openapi-check.mjs`, `packages/generated/**`, `.github/workflows/ci.yml`
  - **Action**: Verify final Zod/OpenAPI single-source flow, actual generator/check commands, generated artifact paths, route registration pattern, stable error taxonomy, and CI job names. Confirm Tasks will not hand-edit generated artifacts.
  - **Verify**: `bun run openapi:check` (or final equivalent) passes on dependency-complete main; generator/check scripts and generated paths are real
  - **Evidence**: OpenAPI command output, generator paths, CI job inventory, current error taxonomy.

- [ ] T009 [REQ:FR-020;CHK111-115;SC-010] Issue the Phase 0 verdict. [VERIFY:Gate evidence shows all checks PASS; otherwise output exactly `BLOCKED — SLICE 3 IMPLEMENTATION DEPENDENCY` and stop before T010]
  - **Depends on**: T004, T005, T006, T007, T008
  - **Files**: read-only Gate evidence; branch metadata only
  - **Action**: Issue the Phase 0 verdict. ALL dependency checks must pass before any Slice 3 RED test, migration, business code, or generated artifact is written. Capture `IMPLEMENT_BASE_SHA=HEAD` only on PASS. Any failure stops with the fixed dependency message; no Slice 1/2 repair is allowed from this branch.
  - **Verify**: Gate evidence shows all checks PASS; otherwise output exactly `BLOCKED — SLICE 3 IMPLEMENTATION DEPENDENCY` and stop before T010
  - **Evidence**: Gate checklist, `IMPLEMENT_BASE_SHA`, and explicit PASS/BLOCKED verdict.


## Phase 1 — Final Baseline Anchoring（Gate PASS 后只读锚定）

- [ ] T010 [P] [REQ:CHK108-110;plan:Migration-Strategy] Resolve the future migration filename from the real merged migration history, using the next ordinal after final Slice 1+2. [VERIFY:`ls db/migrations`; `SELECT filename FROM schema_migrations ORDER BY filename`; `SELECT conname,pg_get_constraintdef(oid) ...` all captured]
  - **Depends on**: T009
  - **Files**: read-only: `db/migrations/`, PostgreSQL `pg_constraint`, `schema_migrations`
  - **Action**: Resolve the future migration filename from the real merged migration history, using the next ordinal after final Slice 1+2. Record it as `<resolved>_evidence_core.sql`; do not modify old migrations. Query `pg_constraint` for the real `business_audit_events` and `idempotency_keys` CHECK names before any migration text is written.
  - **Verify**: `ls db/migrations`; `SELECT filename FROM schema_migrations ORDER BY filename`; `SELECT conname,pg_get_constraintdef(oid) ...` all captured
  - **Evidence**: Resolved migration filename and exact existing CHECK constraint names.

- [ ] T011 [P] [REQ:CHK003-008;CHK114;plan:Project-Structure] Confirm the final merged file topology and approved shared seams still match the frozen Plan. [VERIFY:All listed production seams exist and match their planned responsibilities; material drift count = 0]
  - **Depends on**: T009
  - **Files**: read-only: `packages/contracts/src/schemas.ts`, `packages/domain/src/{index.ts,repository.ts,idempotency.ts}`, `apps/server/api/src/{app.ts,idempotency.ts,routes/cases.ts}`, `scripts/openapi-generate.mjs`, test directories
  - **Action**: Confirm the final merged file topology and approved shared seams still match the frozen Plan. The implementation paths below are then frozen for this run. Material path/architecture drift that would require a new authorization/idempotency/schema pattern is a Plan Review, not an Implement improvisation.
  - **Verify**: All listed production seams exist and match their planned responsibilities; material drift count = 0
  - **Evidence**: File topology inventory and any non-material naming differences.


## Phase 2 — Database RED（TDD：只写失败测试）

- [ ] T012 [P] [REQ:FR-001;FR-002;SC-001;CHK009-010;CHK077] Write RED structural tests for the three tables, `assertion_kind={STATEMENT,FACT,HYPOTHESIS}`, Observation as a separate table, shared provenance columns, server-owned recorded timestamp defaults, and absence of `OBSERVATION` in assertion kind. [VERIFY:`bunx vitest run tests/db/evidence-schema.test.ts` fails for missing Slice 3 schema, not for syntax/fixture errors]
  - **Depends on**: T010, T011
  - **Files**: `tests/db/evidence-schema.test.ts`
  - **Action**: Write RED structural tests for the three tables, `assertion_kind={STATEMENT,FACT,HYPOTHESIS}`, Observation as a separate table, shared provenance columns, server-owned recorded timestamp defaults, and absence of `OBSERVATION` in assertion kind.
  - **Verify**: `bunx vitest run tests/db/evidence-schema.test.ts` fails for missing Slice 3 schema, not for syntax/fixture errors
  - **Evidence**: Expected RED output naming the missing tables/enums/columns.

- [ ] T013 [P] [REQ:FR-003;FR-005;SC-004;CHK054-055;CHK078-082] Write RED DB tests for Observation typed scalar CHECKs: KNOWN TEXT only `value_text`; KNOWN NUMBER only `value_number` including 0; KNOWN BOOLEAN only `value_boolean` including false; four unknown-like states require null type/value/unit; occurred-time KNOWN/UNKNOWN consistency; validity-window CHECK. [VERIFY:`bunx vitest run tests/db/evidence-observation-storage.test.ts` fails because Slice 3 enum/table/CHECKs are absent]
  - **Depends on**: T010, T011
  - **Files**: `tests/db/evidence-observation-storage.test.ts`
  - **Action**: Write RED DB tests for Observation typed scalar CHECKs: KNOWN TEXT only `value_text`; KNOWN NUMBER only `value_number` including 0; KNOWN BOOLEAN only `value_boolean` including false; four unknown-like states require null type/value/unit; occurred-time KNOWN/UNKNOWN consistency; validity-window CHECK.
  - **Verify**: `bunx vitest run tests/db/evidence-observation-storage.test.ts` fails because Slice 3 enum/table/CHECKs are absent
  - **Evidence**: RED output covering 0, false, NOT_APPLICABLE, occurred-time mismatch, and validity mismatch.

- [ ] T014 [P] [REQ:FR-007;FR-021;CHK069-075;CHK086-088] Write RED DB tests for Case composite FKs, subject/source Family-member composite FKs, source-message composite provenance FK, same-type same-Family/same-Case supersedes, self-reference reject, cross-Family/cross-Case reject, old-row preservation, and inability to UPDATE `supersedes_id` as runtime. [VERIFY:`bunx vitest run tests/db/evidence-fks-supersedes.test.ts` fails only because Slice 3 schema/grants are absent]
  - **Depends on**: T010, T011
  - **Files**: `tests/db/evidence-fks-supersedes.test.ts`
  - **Action**: Write RED DB tests for Case composite FKs, subject/source Family-member composite FKs, source-message composite provenance FK, same-type same-Family/same-Case supersedes, self-reference reject, cross-Family/cross-Case reject, old-row preservation, and inability to UPDATE `supersedes_id` as runtime.
  - **Verify**: `bunx vitest run tests/db/evidence-fks-supersedes.test.ts` fails only because Slice 3 schema/grants are absent
  - **Evidence**: RED output for subject/source cross-Family ref, source-message mismatch, supersedes self/cross-scope/update cases.

- [ ] T015 [P] [REQ:FR-011;CHK103-106] Write RED DB introspection/direct-access tests for ENABLE+FORCE RLS on all three tables, runtime non-owner/NOBYPASSRLS, command-specific policies, no-context SELECT=0/write denied, wrong-Family SELECT=0/write denied, correct-Family allowed where grants permit, column-level UPDATE only on `conflict_group_id`, and DELETE none. [VERIFY:`bunx vitest run tests/db/evidence-rls-grants.test.ts` is RED because Slice 3 policies/grants do not yet exist]
  - **Depends on**: T010, T011
  - **Files**: `tests/db/evidence-rls-grants.test.ts`
  - **Action**: Write RED DB introspection/direct-access tests for ENABLE+FORCE RLS on all three tables, runtime non-owner/NOBYPASSRLS, command-specific policies, no-context SELECT=0/write denied, wrong-Family SELECT=0/write denied, correct-Family allowed where grants permit, column-level UPDATE only on `conflict_group_id`, and DELETE none.
  - **Verify**: `bunx vitest run tests/db/evidence-rls-grants.test.ts` is RED because Slice 3 policies/grants do not yet exist
  - **Evidence**: RED RLS/grant assertions with pg_class/pg_roles/information_schema evidence.

- [ ] T016 [P] [REQ:FR-008;SC-001;CHK059-060;CHK104-107] Write the independent FACT hard-guard RED test. [VERIFY:`bunx vitest run tests/db/evidence-fact-guard.test.ts` is RED before the Slice 3 policy/table exists]
  - **Depends on**: T010, T011
  - **Files**: `tests/db/evidence-fact-guard.test.ts`
  - **Action**: Write the independent FACT hard-guard RED test. Under `xiaoshuyin_app` + correct Family context, direct `INSERT assertions(kind='FACT')` must be rejected; equivalent valid STATEMENT and HYPOTHESIS rows must be allowed after migration. Query `pg_policies` and fail if any additional permissive INSERT policy can OR-open FACT. Include only an isolated privileged test/migrator path for schema-level FACT fixtures.
  - **Verify**: `bunx vitest run tests/db/evidence-fact-guard.test.ts` is RED before the Slice 3 policy/table exists
  - **Evidence**: RED output plus exact planned `pg_policies` effective-policy assertion.

- [ ] T017 [P] [REQ:FR-017;CHK100-101;CHK108-110] Write RED tests that existing `business_audit_events` CHECKs will admit only the three approved new event/resource pairs and that `idempotency_keys. [VERIFY:`bunx vitest run tests/db/evidence-audit-idempotency.test.ts` fails on missing whitelist extensions]
  - **Depends on**: T010, T011
  - **Files**: `tests/db/evidence-audit-idempotency.test.ts`
  - **Action**: Write RED tests that existing `business_audit_events` CHECKs will admit only the three approved new event/resource pairs and that `idempotency_keys.command_type` will admit `CASE_MESSAGE_CREATE`; verify audit metadata for Slice 3 records is `{}` and no new audit/idempotency columns/tables are introduced.
  - **Verify**: `bunx vitest run tests/db/evidence-audit-idempotency.test.ts` fails on missing whitelist extensions
  - **Evidence**: RED CHECK-constraint output and expected approved vocabulary.


## Phase 3 — Domain / Integration / Contract RED（TDD：只写失败测试）

- [ ] T018 [P] [REQ:FR-001;FR-008;CHK016;CHK059-060] Write RED domain capability tests requiring the FACT discriminated-union semantic but production exports limited to `recordStatement`, `recordHypothesis`, `recordObservation`, `assignConflictGroup`. [VERIFY:`bunx vitest run tests/domain/evidence-capabilities.test.ts` is RED because the Evidence domain module does not exist]
  - **Depends on**: T010, T011
  - **Files**: `tests/domain/evidence-capabilities.test.ts`
  - **Action**: Write RED domain capability tests requiring the FACT discriminated-union semantic but production exports limited to `recordStatement`, `recordHypothesis`, `recordObservation`, `assignConflictGroup`. Mechanically assert absence of `recordFact/createFact/confirmFact/promoteToFact/updateAssertionKind/createAssertion(kind)/createEvidence(anything)` and that `recordHypothesis` has no currently admissible AI production caller/source.
  - **Verify**: `bunx vitest run tests/domain/evidence-capabilities.test.ts` is RED because the Evidence domain module does not exist
  - **Evidence**: RED export/capability assertions and forbidden-symbol list.

- [ ] T019 [P] [REQ:FR-004;FR-016;CHK061-068;SC-002;SC-009] Write RED table-driven tests for all 8 frozen provenance sources: the four allowed writer/source/subject relationship rules and four current-production disabled fail-closed rules. [VERIFY:`bunx vitest run tests/domain/evidence-provenance.test.ts` is RED because Slice 3 provenance validator/writers do not exist]
  - **Depends on**: T010, T011
  - **Files**: `tests/domain/evidence-provenance.test.ts`
  - **Action**: Write RED table-driven tests for all 8 frozen provenance sources: the four allowed writer/source/subject relationship rules and four current-production disabled fail-closed rules. Explicitly test guardian relation true but Family access false does not become authorization.
  - **Verify**: `bunx vitest run tests/domain/evidence-provenance.test.ts` is RED because Slice 3 provenance validator/writers do not exist
  - **Evidence**: 8/8 RED case matrix with expected writer/admissibility/reason.

- [ ] T020 [P] [REQ:FR-003;FR-005;CHK078-082;SC-004] Write RED pure-domain tests for typed Observation values, 0/false preservation, unknown-like states, NOT_APPLICABLE canonical mapping, occurred time state, server-owned recordedAt input rejection, and EXPIRED as derived rather than persisted state. [VERIFY:`bunx vitest run tests/domain/evidence-observation.test.ts` is RED for missing domain types/validators]
  - **Depends on**: T010, T011
  - **Files**: `tests/domain/evidence-observation.test.ts`
  - **Action**: Write RED pure-domain tests for typed Observation values, 0/false preservation, unknown-like states, NOT_APPLICABLE canonical mapping, occurred time state, server-owned recordedAt input rejection, and EXPIRED as derived rather than persisted state.
  - **Verify**: `bunx vitest run tests/domain/evidence-observation.test.ts` is RED for missing domain types/validators
  - **Evidence**: RED case table for TEXT/NUMBER/BOOLEAN/unknown/time behavior.

- [ ] T021 [P] [REQ:FR-006;FR-007;CHK083-088;SC-003;SC-005] Write RED tests for `assignConflictGroup`: >=2 refs, same Family/Case, mixed Assertion/Observation allowed, no migration of existing group, no winner/rank/confidence/majority/FACT side effect. [VERIFY:`bunx vitest run tests/domain/evidence-conflict-supersedes.test.ts` is RED because conflict/supersedes domain functions are absent]
  - **Depends on**: T010, T011
  - **Files**: `tests/domain/evidence-conflict-supersedes.test.ts`
  - **Action**: Write RED tests for `assignConflictGroup`: >=2 refs, same Family/Case, mixed Assertion/Observation allowed, no migration of existing group, no winner/rank/confidence/majority/FACT side effect. Add supersedes validation for new→existing old, same type/scope, no self, append-only cycle prevention without graph traversal.
  - **Verify**: `bunx vitest run tests/domain/evidence-conflict-supersedes.test.ts` is RED because conflict/supersedes domain functions are absent
  - **Evidence**: RED conflict and supersedes invariant matrix.

- [ ] T022 [P] [REQ:FR-010;FR-021;CHK069-076] Write RED domain tests for authorized Family/Case context, subject/source Family membership, guardian relationship independence, UNDER_14 no Person creation, source-message same Family/Case/source-person, and normalized `EVIDENCE_PERSON_REFERENCE_INVALID` without raw FK/RLS leakage. [VERIFY:`bunx vitest run tests/domain/evidence-person-reference.test.ts` is RED because Slice 3 validators/repository boundary are absent]
  - **Depends on**: T010, T011
  - **Files**: `tests/domain/evidence-person-reference.test.ts`
  - **Action**: Write RED domain tests for authorized Family/Case context, subject/source Family membership, guardian relationship independence, UNDER_14 no Person creation, source-message same Family/Case/source-person, and normalized `EVIDENCE_PERSON_REFERENCE_INVALID` without raw FK/RLS leakage.
  - **Verify**: `bunx vitest run tests/domain/evidence-person-reference.test.ts` is RED because Slice 3 validators/repository boundary are absent
  - **Evidence**: RED subject/source/source-message/guardian security matrix.

- [ ] T023 [P] [REQ:FR-009;FR-013;FR-019;CHK089-092;SC-007] Write RED integration tests for the approved message POST happy path, exact raw content preservation, whitespace-only rejection, forbidden extra fields (`familyId`, `actorId`, `sourcePersonId`, `subjectPersonId`, `recordedAt`, `assertionKind`) → 422 with zero writes, response exactly id/caseId/recordedAt, and success deltas: message +1, audit +1, Assertion +0, Observation +0, case_event +0. [VERIFY:`bunx vitest run tests/integration/messages-create.test.ts` is RED because the route/table are absent]
  - **Depends on**: T010, T011
  - **Files**: `tests/integration/messages-create.test.ts`
  - **Action**: Write RED integration tests for the approved message POST happy path, exact raw content preservation, whitespace-only rejection, forbidden extra fields (`familyId`, `actorId`, `sourcePersonId`, `subjectPersonId`, `recordedAt`, `assertionKind`) → 422 with zero writes, response exactly id/caseId/recordedAt, and success deltas: message +1, audit +1, Assertion +0, Observation +0, case_event +0.
  - **Verify**: `bunx vitest run tests/integration/messages-create.test.ts` is RED because the route/table are absent
  - **Evidence**: RED HTTP/DB delta assertions including Q4 automatic Assertion count = 0.

- [ ] T024 [P] [REQ:FR-010;FR-011;FR-018;FR-021;CHK069-076;CHK096;SC-006] Write RED integration tests for current-Family manager success, ordinary member/guardian without approved Case authority rejection, known cross-Family Case ID anti-enumeration, nonexistent Case equivalence, and wrong-Family RLS isolation. [VERIFY:`bunx vitest run tests/integration/messages-authorization.test.ts` is RED because the message route is absent]
  - **Depends on**: T010, T011
  - **Files**: `tests/integration/messages-authorization.test.ts`
  - **Action**: Write RED integration tests for current-Family manager success, ordinary member/guardian without approved Case authority rejection, known cross-Family Case ID anti-enumeration, nonexistent Case equivalence, and wrong-Family RLS isolation. Do not invent Participant permissions.
  - **Verify**: `bunx vitest run tests/integration/messages-authorization.test.ts` is RED because the message route is absent
  - **Evidence**: RED authorization/anti-enumeration response bodies and zero-write assertions.

- [ ] T025 [P] [REQ:FR-017;CHK056-057;CHK093-095] Write RED tests for `CASE_MESSAGE_CREATE`, exact canonical payload `{familyId,caseId,body:{content}}`, idempotencyKey exclusion, no trim/normalization, same-key/same-hash replay, same-key/different-content 409 zero writes, at least 20 concurrent same-key requests → one message/audit/idempotency result, and different key/same content → two independent messages. [VERIFY:`bunx vitest run tests/domain/message-idempotency-hash.test.ts tests/integration/messages-idempotency.test.ts` is RED only for missing Slice 3 command/route]
  - **Depends on**: T010, T011
  - **Files**: `tests/domain/message-idempotency-hash.test.ts`; `tests/integration/messages-idempotency.test.ts`
  - **Action**: Write RED tests for `CASE_MESSAGE_CREATE`, exact canonical payload `{familyId,caseId,body:{content}}`, idempotencyKey exclusion, no trim/normalization, same-key/same-hash replay, same-key/different-content 409 zero writes, at least 20 concurrent same-key requests → one message/audit/idempotency result, and different key/same content → two independent messages.
  - **Verify**: `bunx vitest run tests/domain/message-idempotency-hash.test.ts tests/integration/messages-idempotency.test.ts` is RED only for missing Slice 3 command/route
  - **Evidence**: RED hash fixtures plus replay/mismatch/concurrency/count assertions.

- [ ] T026 [P] [REQ:FR-010;FR-017;CHK096-098;research:R-12] Write the independent RED security regression: first create/store a message response for a key in an authorized Case; then reuse the same key while the requested Case is outside the actor's currently authorized Case context (or current access has been removed under final Slice 2 semantics). [VERIFY:`bunx vitest run tests/integration/messages-authorization-before-replay.test.ts` is RED until the approved message path exists; if final shared helper cannot support the required order, return to Plan Review]
  - **Depends on**: T010, T011
  - **Files**: `tests/integration/messages-authorization-before-replay.test.ts`
  - **Action**: Write the independent RED security regression: first create/store a message response for a key in an authorized Case; then reuse the same key while the requested Case is outside the actor's currently authorized Case context (or current access has been removed under final Slice 2 semantics). Assert the old snapshot is never replayed and target Case/message details never leak. This test must exercise the shared helper, not a route-local bypass.
  - **Verify**: `bunx vitest run tests/integration/messages-authorization-before-replay.test.ts` is RED until the approved message path exists; if final shared helper cannot support the required order, return to Plan Review
  - **Evidence**: RED security trace proving replay is authorization-sensitive.

- [ ] T027 [P] [REQ:FR-004;FR-006;FR-007;FR-016;FR-017;FR-021;CHK061-088] Write RED internal-service integration tests for authorized `recordStatement`/`recordObservation`, current `recordHypothesis` fail-closed production composition, person/source-message checks, guardian relay/observation separation, supersedes history, conflict assignment, business audit atomicity, and rollback on validation/audit failure. [VERIFY:`bunx vitest run tests/integration/evidence-write.test.ts` is RED because internal Evidence writers/schema do not exist]
  - **Depends on**: T010, T011
  - **Files**: `tests/integration/evidence-write.test.ts`
  - **Action**: Write RED internal-service integration tests for authorized `recordStatement`/`recordObservation`, current `recordHypothesis` fail-closed production composition, person/source-message checks, guardian relay/observation separation, supersedes history, conflict assignment, business audit atomicity, and rollback on validation/audit failure. No HTTP Evidence CRUD is introduced.
  - **Verify**: `bunx vitest run tests/integration/evidence-write.test.ts` is RED because internal Evidence writers/schema do not exist
  - **Evidence**: RED DB row/audit/rollback evidence for internal writers.

- [ ] T028 [P] [REQ:FR-013;FR-015;CHK089-102;§27A] Write RED generated-OpenAPI tests requiring exactly one Slice 3 public operation `createCaseMessage`, strict request fields, response without content, and mechanically fixed 401/404(oneOf)/409/422/500 code schemas. [VERIFY:`bunx vitest run tests/integration/openapi-evidence.test.ts` is RED because the operation is absent from generated OpenAPI]
  - **Depends on**: T010, T011
  - **Files**: `tests/integration/openapi-evidence.test.ts`
  - **Action**: Write RED generated-OpenAPI tests requiring exactly one Slice 3 public operation `createCaseMessage`, strict request fields, response without content, and mechanically fixed 401/404(oneOf)/409/422/500 code schemas. Assert no generic Evidence CRUD paths.
  - **Verify**: `bunx vitest run tests/integration/openapi-evidence.test.ts` is RED because the operation is absent from generated OpenAPI
  - **Evidence**: RED operation/schema/error-code assertions.

- [ ] T029 [P] [REQ:FR-012;FR-014;FR-015;FR-018;CHK003-006;CHK114;SC-008] Write RED/guard tests that enumerate runtime routes, production exports and database schema after Slice 3 and forbid: case_participants, assessments, problem_formulations, scene tables/artifacts, Goal/Plan/Task, Safety, AI/extractor/RAG/Memory/embeddings/notifications, `evidence_items`, generic Evidence routes, FACT route/confirmation flow, conflict-resolution engine and future placeholders. [VERIFY:`bunx vitest run tests/integration/evidence-scope.test.ts` initially fails on missing approved Slice 3 objects while retaining forbidden-scope assertions]
  - **Depends on**: T010, T011
  - **Files**: `tests/integration/evidence-scope.test.ts`
  - **Action**: Write RED/guard tests that enumerate runtime routes, production exports and database schema after Slice 3 and forbid: case_participants, assessments, problem_formulations, scene tables/artifacts, Goal/Plan/Task, Safety, AI/extractor/RAG/Memory/embeddings/notifications, `evidence_items`, generic Evidence routes, FACT route/confirmation flow, conflict-resolution engine and future placeholders.
  - **Verify**: `bunx vitest run tests/integration/evidence-scope.test.ts` initially fails on missing approved Slice 3 objects while retaining forbidden-scope assertions
  - **Evidence**: Scope enumeration fixture and forbidden-name/path/table/export set.


## Phase 4 — Reviewed Migration（单一 migration 文件，全串行）

- [ ] T030 [REQ:FR-001;FR-003;FR-009;CHK108-110] Create the single reviewed migration file using T010's real ordinal. [VERIFY:SQL review confirms enum sets and `dialogue_messages` columns/checks match `data-model.md`; migration file is the only new migration]
  - **Depends on**: T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022, T023, T024, T025, T026, T027, T028, T029
  - **Files**: `db/migrations/<resolved-next>_evidence_core.sql`
  - **Action**: Create the single reviewed migration file using T010's real ordinal. First add only the new enums in frozen order and `dialogue_messages` with uuidv7 PK, Family/Case/actor/source person/raw content/server recorded_at constraints. Do not apply partial migration to shared DB and do not edit older migrations.
  - **Verify**: SQL review confirms enum sets and `dialogue_messages` columns/checks match `data-model.md`; migration file is the only new migration
  - **Evidence**: Diff excerpt for enum/message sections and resolved filename.

- [ ] T031 [REQ:FR-001;FR-002;FR-008;CHK009-010;CHK059-060] Append `assertions`: approved provenance/time/validity/confirmation/supersedes/conflict columns plus `kind assertion_kind` and content. [VERIFY:SQL structure exactly matches frozen Data Model; assertion kind has exactly STATEMENT/FACT/HYPOTHESIS]
  - **Depends on**: T030
  - **Files**: `db/migrations/<resolved-next>_evidence_core.sql`
  - **Action**: Append `assertions`: approved provenance/time/validity/confirmation/supersedes/conflict columns plus `kind assertion_kind` and content. Preserve FACT structurally; do not create any FACT command, trigger or confirmation workflow.
  - **Verify**: SQL structure exactly matches frozen Data Model; assertion kind has exactly STATEMENT/FACT/HYPOTHESIS
  - **Evidence**: Assertions DDL diff and enum/column review.

- [ ] T032 [REQ:FR-001;FR-005;CHK054-055;CHK077-082] Append `observations` as a separate table with shared provenance/time/validity/conflict columns and `observation_code`, value_state/type/text/number/boolean/unit. [VERIFY:SQL structure contains all frozen Observation fields and no `assertions.kind=OBSERVATION` path]
  - **Depends on**: T031
  - **Files**: `db/migrations/<resolved-next>_evidence_core.sql`
  - **Action**: Append `observations` as a separate table with shared provenance/time/validity/conflict columns and `observation_code`, value_state/type/text/number/boolean/unit. Do not add `kind` or JSON catch-all payload.
  - **Verify**: SQL structure contains all frozen Observation fields and no `assertions.kind=OBSERVATION` path
  - **Evidence**: Observation DDL diff.

- [ ] T033 [REQ:FR-002;FR-003;FR-005;FR-007;FR-021;CHK069-088;CHK108] Append constraints/indexes/composite FKs/CHECKs in executable order: unique `(id,family_id,case_id)` where required; Case composite FKs; subject/source Family-member composite FKs; source-message same Family/Case FK; same-type supersedes composite FK + no self; occurred-time, validity, content and Observation typed-value checks; frozen indexes. [VERIFY:Static SQL review + targeted migration parser/introspection expectations from T012-T014; no FK references a unique key created later]
  - **Depends on**: T032
  - **Files**: `db/migrations/<resolved-next>_evidence_core.sql`
  - **Action**: Append constraints/indexes/composite FKs/CHECKs in executable order: unique `(id,family_id,case_id)` where required; Case composite FKs; subject/source Family-member composite FKs; source-message same Family/Case FK; same-type supersedes composite FK + no self; occurred-time, validity, content and Observation typed-value checks; frozen indexes. Old rows remain append-only.
  - **Verify**: Static SQL review + targeted migration parser/introspection expectations from T012-T014; no FK references a unique key created later
  - **Evidence**: Constraint/index/FK inventory mapped to Data Model sections.

- [ ] T034 [REQ:FR-008;FR-011;CHK103-105] Append ENABLE + FORCE RLS then command-specific policies. [VERIFY:SQL policy inventory matches frozen policy matrix and contains no generic permissive policy]
  - **Depends on**: T033
  - **Files**: `db/migrations/<resolved-next>_evidence_core.sql`
  - **Action**: Append ENABLE + FORCE RLS then command-specific policies. Use separate policies by command. The effective runtime Assertion INSERT path must be exactly Family scope AND `kind <> 'FACT'`; do not add a permissive FOR ALL/INSERT policy that can OR-open FACT. Messages/Observations INSERT remain Family-scoped.
  - **Verify**: SQL policy inventory matches frozen policy matrix and contains no generic permissive policy
  - **Evidence**: RLS/policy DDL diff with the FACT hard guard highlighted.

- [ ] T035 [REQ:FR-017;CHK100-110] Append minimal runtime grants and existing CHECK extensions last: messages SELECT/INSERT; assertions/observations SELECT/INSERT plus column-level `UPDATE(conflict_group_id)` only; no DELETE; enum USAGE; extend business audit event/resource whitelists with the exact three pairs; extend idempotency command whitelist with `CASE_MESSAGE_CREATE` using the real constraint names from T010. [VERIFY:SQL grant/CHECK review proves no table-wide UPDATE/DELETE and only approved whitelist additions]
  - **Depends on**: T034
  - **Files**: `db/migrations/<resolved-next>_evidence_core.sql`
  - **Action**: Append minimal runtime grants and existing CHECK extensions last: messages SELECT/INSERT; assertions/observations SELECT/INSERT plus column-level `UPDATE(conflict_group_id)` only; no DELETE; enum USAGE; extend business audit event/resource whitelists with the exact three pairs; extend idempotency command whitelist with `CASE_MESSAGE_CREATE` using the real constraint names from T010.
  - **Verify**: SQL grant/CHECK review proves no table-wide UPDATE/DELETE and only approved whitelist additions
  - **Evidence**: Grant matrix and before/after CHECK definitions.

- [ ] T036 [REQ:FR-001;FR-003;FR-005;FR-007;FR-008;FR-011;FR-017;FR-021;CHK103-110] Apply the complete migration in an isolated test database only after T030–T035 are complete, then run all Phase 2 DB RED tests. [VERIFY:`bunx vitest run tests/db/evidence-schema.test.ts tests/db/evidence-observation-storage.test.ts tests/db/evidence-fks-supersedes.test.ts tests/db/evidence-rls-grants.test.ts tests/db/evidence-fact-guard.test.ts tests/db/evidence-audit-idempotency.test.ts` all pass]
  - **Depends on**: T035
  - **Files**: migration + `tests/db/evidence-*.test.ts`
  - **Action**: Apply the complete migration in an isolated test database only after T030–T035 are complete, then run all Phase 2 DB RED tests. Fix only migration defects that violate frozen contracts until these DB tests are GREEN; do not change tests to fit implementation.
  - **Verify**: `bunx vitest run tests/db/evidence-schema.test.ts tests/db/evidence-observation-storage.test.ts tests/db/evidence-fks-supersedes.test.ts tests/db/evidence-rls-grants.test.ts tests/db/evidence-fact-guard.test.ts tests/db/evidence-audit-idempotency.test.ts` all pass
  - **Evidence**: RED→GREEN DB test output and final migration SHA/diff.


## Phase 5 — Evidence Domain / Repository GREEN（共享 domain 文件串行）

- [ ] T037 [REQ:FR-001;FR-003;FR-005;CHK053-055;CHK077-082] Create the Evidence domain types/validators: assertion discriminated union includes FACT semantically; Observation typed scalar union; occurred-time and validity validation; recordedAt excluded from caller draft input; NOT_APPLICABLE canonical state; no OBSERVATION assertion kind and no generic JSON Evidence type. [VERIFY:`bunx vitest run tests/domain/evidence-observation.test.ts` moves toward GREEN with value/time cases passing]
  - **Depends on**: T036
  - **Files**: `packages/domain/src/evidence.ts`
  - **Action**: Create the Evidence domain types/validators: assertion discriminated union includes FACT semantically; Observation typed scalar union; occurred-time and validity validation; recordedAt excluded from caller draft input; NOT_APPLICABLE canonical state; no OBSERVATION assertion kind and no generic JSON Evidence type.
  - **Verify**: `bunx vitest run tests/domain/evidence-observation.test.ts` moves toward GREEN with value/time cases passing
  - **Evidence**: Domain type/API diff and targeted test output.

- [ ] T038 [REQ:FR-004;FR-008;FR-016;CHK061-068] Add the exact 8-row provenance admissibility validator. [VERIFY:`bunx vitest run tests/domain/evidence-provenance.test.ts tests/domain/evidence-capabilities.test.ts` passes provenance/capability cases without a FACT writer]
  - **Depends on**: T037
  - **Files**: `packages/domain/src/evidence.ts`
  - **Action**: Add the exact 8-row provenance admissibility validator. Encode the four allowed writer/source/subject rules and fail closed for MANUAL_DEVICE_DATA, STAFF_RECORD, AI_HYPOTHESIS and SOURCE_CONFIRMED. `recordHypothesis` remains a named future-facing capability but current production composition has no admissible AI source/caller.
  - **Verify**: `bunx vitest run tests/domain/evidence-provenance.test.ts tests/domain/evidence-capabilities.test.ts` passes provenance/capability cases without a FACT writer
  - **Evidence**: 8/8 GREEN matrix and forbidden-capability assertion output.

- [ ] T039 [REQ:FR-006;FR-007;CHK083-088] Add conflict and supersedes domain validation: >=2 refs; same Family/Case; mixed assertion/observation conflict refs allowed; existing group immovable; no winner/rank/confidence/majority; same-type new→existing-old supersedes; no self/cross-scope; no graph traversal/cycle engine. [VERIFY:`bunx vitest run tests/domain/evidence-conflict-supersedes.test.ts` passes]
  - **Depends on**: T038
  - **Files**: `packages/domain/src/evidence.ts`
  - **Action**: Add conflict and supersedes domain validation: >=2 refs; same Family/Case; mixed assertion/observation conflict refs allowed; existing group immovable; no winner/rank/confidence/majority; same-type new→existing-old supersedes; no self/cross-scope; no graph traversal/cycle engine.
  - **Verify**: `bunx vitest run tests/domain/evidence-conflict-supersedes.test.ts` passes
  - **Evidence**: GREEN conflict/supersedes output and absence of graph-resolution abstractions.

- [ ] T040 [REQ:FR-010;FR-017;FR-019;FR-021;CHK069-076;CHK097-101] Add narrow repository primitives for dialogue messages and Evidence under an existing authorized transaction: load/revalidate Case; validate target Family member refs; validate source message Family/Case/source person; insert exact row; insert approved business audit with `{}` metadata; fetch refs; assign conflict group using only the allowed column. [VERIFY:`bun run typecheck` passes; repository SQL contains no caller-selectable assertion kind and no update of content/provenance/supersedes]
  - **Depends on**: T039
  - **Files**: `packages/domain/src/repository.ts`
  - **Action**: Add narrow repository primitives for dialogue messages and Evidence under an existing authorized transaction: load/revalidate Case; validate target Family member refs; validate source message Family/Case/source person; insert exact row; insert approved business audit with `{}` metadata; fetch refs; assign conflict group using only the allowed column. Do not add public CRUD or generic `createEvidence`.
  - **Verify**: `bun run typecheck` passes; repository SQL contains no caller-selectable assertion kind and no update of content/provenance/supersedes
  - **Evidence**: Repository diff with query inventory and typecheck output.

- [ ] T041 [REQ:FR-004;FR-006;FR-007;FR-008;FR-016;FR-017;FR-021;CHK061-088] Implement the four approved type-specific production functions `recordStatement`, `recordHypothesis`, `recordObservation`, `assignConflictGroup` over the authorized transaction/repository boundary. [VERIFY:`bunx vitest run tests/domain/evidence-capabilities.test.ts tests/domain/evidence-provenance.test.ts tests/domain/evidence-conflict-supersedes.test.ts tests/domain/evidence-person-reference.test.ts` passes]
  - **Depends on**: T040
  - **Files**: `packages/domain/src/evidence.ts`; `packages/domain/src/repository.ts`
  - **Action**: Implement the four approved type-specific production functions `recordStatement`, `recordHypothesis`, `recordObservation`, `assignConflictGroup` over the authorized transaction/repository boundary. Each write revalidates Case/Family, Person refs, provenance, source message, time/value/validity/supersedes and writes Evidence + audit atomically. `recordHypothesis` must fail closed under all currently disabled production provenance compositions; do not invent AI runtime plumbing.
  - **Verify**: `bunx vitest run tests/domain/evidence-capabilities.test.ts tests/domain/evidence-provenance.test.ts tests/domain/evidence-conflict-supersedes.test.ts tests/domain/evidence-person-reference.test.ts` passes
  - **Evidence**: Writer signatures, capability behavior, validation/audit transaction evidence.

- [ ] T042 [REQ:FR-001;FR-008;FR-012;FR-016;CHK016;CHK059-068] Export the approved Evidence types/functions from the production package and nothing else. [VERIFY:`bunx vitest run tests/domain/evidence-*.test.ts` passes; `rg`/export audit finds 0 forbidden writer exports]
  - **Depends on**: T041, T018, T019, T020, T021, T022
  - **Files**: `packages/domain/src/index.ts`; Phase 3 domain tests
  - **Action**: Export the approved Evidence types/functions from the production package and nothing else. Run the complete Evidence domain RED set to GREEN. Mechanically scan production exports/import graph for all forbidden FACT/generic writer symbols and AI caller plumbing.
  - **Verify**: `bunx vitest run tests/domain/evidence-*.test.ts` passes; `rg`/export audit finds 0 forbidden writer exports
  - **Evidence**: Domain test summary and production export list.


## Phase 6 — Message API / Idempotency / Security GREEN

- [ ] T043 [REQ:FR-013;CHK089-102;§27A] Add code-side Zod source schemas for CreateCaseMessageRequest and CaseMessageResponse plus mechanically fixed message error schemas. [VERIFY:`bun run typecheck` passes; schema tests/inspection show strict request and literal/enum error codes]
  - **Depends on**: T042
  - **Files**: `packages/contracts/src/schemas.ts`
  - **Action**: Add code-side Zod source schemas for CreateCaseMessageRequest and CaseMessageResponse plus mechanically fixed message error schemas. Request must be strict and only contain content/idempotencyKey; response only id/caseId/recordedAt. Preserve existing contracts unchanged.
  - **Verify**: `bun run typecheck` passes; schema tests/inspection show strict request and literal/enum error codes
  - **Evidence**: Contract source diff with exact request/response/error shapes.

- [ ] T044 [REQ:FR-017;CHK056-057;CHK093-095] Extend the existing shared idempotency command-type contract with `CASE_MESSAGE_CREATE`; reuse existing canonicalJson/hash/decision code. [VERIFY:`bunx vitest run tests/domain/message-idempotency-hash.test.ts` passes exact hash/scope/whitespace/idempotencyKey-exclusion fixtures]
  - **Depends on**: T043
  - **Files**: `packages/domain/src/idempotency.ts`; `tests/domain/message-idempotency-hash.test.ts`
  - **Action**: Extend the existing shared idempotency command-type contract with `CASE_MESSAGE_CREATE`; reuse existing canonicalJson/hash/decision code. Add only the Message canonical-context construction needed to hash verified familyId + caseId + exact stored content; do not create a second engine/cache/table.
  - **Verify**: `bunx vitest run tests/domain/message-idempotency-hash.test.ts` passes exact hash/scope/whitespace/idempotencyKey-exclusion fixtures
  - **Evidence**: Command-type diff and canonical hash fixture output.

- [ ] T045 [REQ:FR-009;FR-010;FR-013;FR-017;FR-019;CHK089-099] Implement the sole Message POST route. [VERIFY:`bun run typecheck` passes and code-path inspection shows Case authorization before any replay return plus EXECUTE reauthorization]
  - **Depends on**: T044, T040, T041, T023, T024, T025, T026
  - **Files**: `apps/server/api/src/routes/messages.ts`
  - **Action**: Implement the sole Message POST route. Required order: authenticate → strict parse → resolve current Family → RLS-scoped load Case → approved Case-management authorization preflight → canonical hash → shared idempotency → EXECUTE tx sets RLS context/locks/second lookup → re-read Case + re-authorize → insert dialogue_message → insert MESSAGE_RECORDED audit `{}` → persist response snapshot → commit. Store exact content; automatic Assertion/Observation count stays zero. No route-local idempotency engine.
  - **Verify**: `bun run typecheck` passes and code-path inspection shows Case authorization before any replay return plus EXECUTE reauthorization
  - **Evidence**: Route diff and call-order trace.

- [ ] T046 [REQ:FR-009;FR-015;CHK089;SC-007] Register only the new Message route using the existing application route-registration pattern. [VERIFY:`bun run typecheck` passes; route enumeration adds exactly one Slice 3 operation]
  - **Depends on**: T045
  - **Files**: `apps/server/api/src/app.ts`
  - **Action**: Register only the new Message route using the existing application route-registration pattern. Do not register GET/PATCH/DELETE messages or any assertions/observations/evidence/assessment/formulation/scene/participant endpoint.
  - **Verify**: `bun run typecheck` passes; route enumeration adds exactly one Slice 3 operation
  - **Evidence**: App registration diff and route inventory.

- [ ] T047 [REQ:FR-009;FR-010;FR-013;FR-016;FR-018;FR-019;FR-021;SC-002;SC-006;SC-007] Drive the core Message and internal Evidence integration RED tests to GREEN without weakening assertions. [VERIFY:`bunx vitest run tests/integration/messages-create.test.ts tests/integration/messages-authorization.test.ts tests/integration/evidence-write.test.ts` all pass]
  - **Depends on**: T046, T023, T024, T027
  - **Files**: `tests/integration/messages-create.test.ts`; `tests/integration/messages-authorization.test.ts`; `tests/integration/evidence-write.test.ts`
  - **Action**: Drive the core Message and internal Evidence integration RED tests to GREEN without weakening assertions. Validate message/audit exact deltas, forbidden fields 422+zero writes, response privacy, Case authorization/anti-enumeration, internal writer provenance/person-reference behavior, audit atomicity and no public Evidence API.
  - **Verify**: `bunx vitest run tests/integration/messages-create.test.ts tests/integration/messages-authorization.test.ts tests/integration/evidence-write.test.ts` all pass
  - **Evidence**: GREEN integration outputs with row-count and response assertions.

- [ ] T048 [REQ:FR-017;CHK093-095] Drive Message idempotency RED tests to GREEN using the shared engine: replay original result, mismatch 409 with zero new writes, >=20 concurrent same-key requests produce exactly one message/audit/idempotency result, and different key/same content produces two raw messages. [VERIFY:`bunx vitest run tests/domain/message-idempotency-hash.test.ts tests/integration/messages-idempotency.test.ts` passes all four scenarios]
  - **Depends on**: T047, T025
  - **Files**: `tests/domain/message-idempotency-hash.test.ts`; `tests/integration/messages-idempotency.test.ts`; shared idempotency implementation
  - **Action**: Drive Message idempotency RED tests to GREEN using the shared engine: replay original result, mismatch 409 with zero new writes, >=20 concurrent same-key requests produce exactly one message/audit/idempotency result, and different key/same content produces two raw messages.
  - **Verify**: `bunx vitest run tests/domain/message-idempotency-hash.test.ts tests/integration/messages-idempotency.test.ts` passes all four scenarios
  - **Evidence**: Concurrency counts, replay body equality, mismatch zero-write evidence.

- [ ] T049 [REQ:FR-010;FR-017;CHK096-098] Drive the authorization-before-replay security regression GREEN. [VERIFY:`bunx vitest run tests/integration/messages-authorization-before-replay.test.ts` passes and trace confirms no replay before Case authorization]
  - **Depends on**: T048, T026
  - **Files**: `tests/integration/messages-authorization-before-replay.test.ts`; `apps/server/api/src/idempotency.ts` only if the already-approved shared seam requires the reviewed minimal change
  - **Action**: Drive the authorization-before-replay security regression GREEN. The old stored response must never be returned for a request whose current specific Case is not authorized. If satisfying this requires a new idempotency engine or changes frozen semantics, STOP for Plan Review rather than patching locally.
  - **Verify**: `bunx vitest run tests/integration/messages-authorization-before-replay.test.ts` passes and trace confirms no replay before Case authorization
  - **Evidence**: Security test output and final shared-helper call-order evidence.

- [ ] T050 [REQ:FR-017;CHK098-101;SC-007] Verify transactional failure behavior: deliberately fail audit or downstream write in isolated tests and prove message/evidence/idempotency business state rolls back as specified; prove successful Message/Evidence writes never create `case_events`, AI jobs or background jobs and audit metadata remains `{}` with no content/value/PII. [VERIFY:`bunx vitest run tests/integration/evidence-write.test.ts tests/integration/messages-create.test.ts` passes rollback/no-side-effect assertions]
  - **Depends on**: T049, T027
  - **Files**: `tests/integration/evidence-write.test.ts`; `tests/integration/messages-create.test.ts`; repository/audit paths
  - **Action**: Verify transactional failure behavior: deliberately fail audit or downstream write in isolated tests and prove message/evidence/idempotency business state rolls back as specified; prove successful Message/Evidence writes never create `case_events`, AI jobs or background jobs and audit metadata remains `{}` with no content/value/PII.
  - **Verify**: `bunx vitest run tests/integration/evidence-write.test.ts tests/integration/messages-create.test.ts` passes rollback/no-side-effect assertions
  - **Evidence**: Rollback row counts, audit metadata samples, case_events delta = 0.


## Phase 7 — OpenAPI / Generated Artifacts（生成链串行）

- [ ] T051 [REQ:FR-013;FR-015;CHK089-102;§27A] Update the OpenAPI generation bootstrap only as required to register the final Message route/source schemas. [VERIFY:`bun run openapi:generate` completes and discovers `createCaseMessage`]
  - **Depends on**: T050
  - **Files**: `scripts/openapi-generate.mjs`
  - **Action**: Update the OpenAPI generation bootstrap only as required to register the final Message route/source schemas. Do not edit generated JSON/types by hand and do not create a second OpenAPI source.
  - **Verify**: `bun run openapi:generate` completes and discovers `createCaseMessage`
  - **Evidence**: Generator diff and generation output.

- [ ] T052 [REQ:FR-013;CHK089-102] Run the generator, hash only the generated artifact paths, run it a second time, and require identical hashes with no second-run residual diff. [VERIFY:two consecutive `shasum -a 256 packages/generated/openapi.json packages/generated/openapi.d.ts` results are identical; second generation leaves no generated-path residual diff]
  - **Depends on**: T051
  - **Files**: `packages/generated/openapi.json`; `packages/generated/openapi.d.ts`
  - **Action**: Run the generator, hash only the generated artifact paths, run it a second time, and require identical hashes with no second-run residual diff. Generated files may change in the implementation diff; determinism is path-scoped, not whole-branch cleanliness.
  - **Verify**: two consecutive `shasum -a 256 packages/generated/openapi.json packages/generated/openapi.d.ts` results are identical; second generation leaves no generated-path residual diff
  - **Evidence**: First/second hashes and generated-only status output.

- [ ] T053 [REQ:FR-013;FR-015;CHK089-102] Drive OpenAPI RED test GREEN and structurally compare generated output to the frozen contract: one Slice 3 operation `createCaseMessage`; strict request; response no raw content; fixed 401/404 oneOf/409/422/500 codes; no generic Evidence CRUD. [VERIFY:`bunx vitest run tests/integration/openapi-evidence.test.ts` passes and structural diff against frozen YAML has zero semantic differences]
  - **Depends on**: T052, T028
  - **Files**: `tests/integration/openapi-evidence.test.ts`; `specs/003-evidence-core/contracts/messages-api.openapi.yaml` read-only
  - **Action**: Drive OpenAPI RED test GREEN and structurally compare generated output to the frozen contract: one Slice 3 operation `createCaseMessage`; strict request; response no raw content; fixed 401/404 oneOf/409/422/500 codes; no generic Evidence CRUD. A contract mismatch is BLOCKED; do not alter the frozen contract from Implement.
  - **Verify**: `bunx vitest run tests/integration/openapi-evidence.test.ts` passes and structural diff against frozen YAML has zero semantic differences
  - **Evidence**: OpenAPI test output and frozen-vs-generated comparison result.

- [ ] T054 [REQ:FR-013;§27A;CHK102] Run the repository's final OpenAPI drift gate after deterministic generation. [VERIFY:`bun run openapi:check` exits 0 with no drift]
  - **Depends on**: T053
  - **Files**: generated OpenAPI paths and OpenAPI check scripts
  - **Action**: Run the repository's final OpenAPI drift gate after deterministic generation.
  - **Verify**: `bun run openapi:check` exits 0 with no drift
  - **Evidence**: OpenAPI check output.


## Phase 8 — Database / Security / Scope Boundary Verification

- [ ] T055 [REQ:FR-001;FR-011;FR-017;CHK108-110] Verify both migration paths: fresh empty PostgreSQL 18 replay from migration 001 onward, and upgrade of a database containing final Slice 1+2 schema/data. [VERIFY:fresh DB migrate + existing DB upgrade + second apply all exit 0; schema_migrations contains expected ordered files]
  - **Depends on**: T054, T036
  - **Files**: `db/migrations/<resolved-next>_evidence_core.sql`; migration runner; DB verification tests
  - **Action**: Verify both migration paths: fresh empty PostgreSQL 18 replay from migration 001 onward, and upgrade of a database containing final Slice 1+2 schema/data. Second application must be no-op per migrator semantics. Never use `drizzle-kit push`.
  - **Verify**: fresh DB migrate + existing DB upgrade + second apply all exit 0; schema_migrations contains expected ordered files
  - **Evidence**: Fresh/upgrade/reapply logs and schema_migrations output.

- [ ] T056 [REQ:FR-008;FR-011;CHK103-107] Run direct catalog verification for owners, NOBYPASSRLS, ENABLE/FORCE RLS, command-specific policies, column grants/no DELETE, and enumerate `pg_policies`. [VERIFY:`bunx vitest run tests/db/evidence-rls-grants.test.ts tests/db/evidence-fact-guard.test.ts` passes; `pg_policies` effective INSERT set is exactly the reviewed set]
  - **Depends on**: T055, T015, T016
  - **Files**: `tests/db/evidence-rls-grants.test.ts`; `tests/db/evidence-fact-guard.test.ts`; PostgreSQL catalogs
  - **Action**: Run direct catalog verification for owners, NOBYPASSRLS, ENABLE/FORCE RLS, command-specific policies, column grants/no DELETE, and enumerate `pg_policies`. Prove no second permissive Assertion INSERT policy can OR-bypass `kind <> 'FACT'`.
  - **Verify**: `bunx vitest run tests/db/evidence-rls-grants.test.ts tests/db/evidence-fact-guard.test.ts` passes; `pg_policies` effective INSERT set is exactly the reviewed set
  - **Evidence**: pg_roles/pg_class/pg_policies/grant query output.

- [ ] T057 [REQ:FR-008;FR-011;FR-021;CHK069-076;CHK103-107] Execute the direct-DB security matrix as `xiaoshuyin_app`: no context SELECT 0/write denied; wrong Family SELECT 0/write denied; correct Family legal operations succeed; correct Family direct FACT INSERT rejected while otherwise-valid STATEMENT/HYPOTHESIS INSERTs succeed; Family A subject/source ref to Family B-only Person rejected. [VERIFY:targeted DB tests pass all no/wrong/correct/FACT/person-reference cases]
  - **Depends on**: T056, T014, T016
  - **Files**: `tests/db/evidence-rls-grants.test.ts`; `tests/db/evidence-fact-guard.test.ts`; `tests/db/evidence-fks-supersedes.test.ts`
  - **Action**: Execute the direct-DB security matrix as `xiaoshuyin_app`: no context SELECT 0/write denied; wrong Family SELECT 0/write denied; correct Family legal operations succeed; correct Family direct FACT INSERT rejected while otherwise-valid STATEMENT/HYPOTHESIS INSERTs succeed; Family A subject/source ref to Family B-only Person rejected. Confirm raw DB errors are not exposed by public HTTP paths.
  - **Verify**: targeted DB tests pass all no/wrong/correct/FACT/person-reference cases
  - **Evidence**: SQLSTATE/outcome matrix and HTTP leakage check.

- [ ] T058 [REQ:FR-017;CHK100-101;CHK108-110] Verify final audit/idempotency CHECK extensions, exactly approved event/resource vocabulary, `CASE_MESSAGE_CREATE`, audit metadata `{}`, and zero `case_events` mirror for Message/Assertion/Observation writes. [VERIFY:`bunx vitest run tests/db/evidence-audit-idempotency.test.ts tests/integration/messages-create.test.ts tests/integration/evidence-write.test.ts` passes]
  - **Depends on**: T057, T017, T050
  - **Files**: `tests/db/evidence-audit-idempotency.test.ts`; integration write tests; `business_audit_events`; `idempotency_keys`; `case_events`
  - **Action**: Verify final audit/idempotency CHECK extensions, exactly approved event/resource vocabulary, `CASE_MESSAGE_CREATE`, audit metadata `{}`, and zero `case_events` mirror for Message/Assertion/Observation writes. Confirm no new idempotency/audit table exists.
  - **Verify**: `bunx vitest run tests/db/evidence-audit-idempotency.test.ts tests/integration/messages-create.test.ts tests/integration/evidence-write.test.ts` passes
  - **Evidence**: Constraint definitions, metadata samples, case_events before/after counts.

- [ ] T059 [REQ:FR-008;FR-012;FR-014;FR-015;FR-018;CHK003-006;CHK114;SC-008] Drive the independent scope guard GREEN. [VERIFY:`bunx vitest run tests/integration/evidence-scope.test.ts tests/domain/evidence-capabilities.test.ts` passes; forbidden count = 0]
  - **Depends on**: T058, T029, T018
  - **Files**: `tests/integration/evidence-scope.test.ts`; production route/export/schema inventory
  - **Action**: Drive the independent scope guard GREEN. Enumerate actual DB tables, Fastify routes, production exports and import graph; require the approved three Slice 3 tables/one route/four type-specific exports and forbid every future-Slice object/capability named in the frozen scope. Mechanically recheck no FACT HTTP route or FACT/generic writer exists.
  - **Verify**: `bunx vitest run tests/integration/evidence-scope.test.ts tests/domain/evidence-capabilities.test.ts` passes; forbidden count = 0
  - **Evidence**: Route/table/export inventory and forbidden-capability scan.


## Phase 9 — Implement Final Verification / Self-Convergence / Handoff

- [ ] T060 [REQ:FR-001-FR-021;SC-001-SC-010;CHK115] Run the complete local regression without skipping expected failures: typecheck, static guard, all domain tests, all DB tests, all integration tests and OpenAPI check. [VERIFY:`bun run typecheck`; `bun run guard:static`; `bunx vitest run tests/domain`; `bunx vitest run tests/db`; `bunx vitest run tests/integration`; `bun run openapi:check` all exit 0]
  - **Depends on**: T042, T050, T054, T059
  - **Files**: all implementation/test paths
  - **Action**: Run the complete local regression without skipping expected failures: typecheck, static guard, all domain tests, all DB tests, all integration tests and OpenAPI check. Do not weaken tests/fixtures/snapshots to obtain green.
  - **Verify**: `bun run typecheck`; `bun run guard:static`; `bunx vitest run tests/domain`; `bunx vitest run tests/db`; `bunx vitest run tests/integration`; `bun run openapi:check` all exit 0
  - **Evidence**: Command-by-command exit status and test counts.

- [ ] T061 [REQ:FR-008;FR-011;FR-013;FR-017;FR-021;CHK096-110] Run the focused final deterministic gates again after the full regression: fresh migration/upgrade evidence, RLS/policy/FACT direct DB tests, authorization-before-replay security test, OpenAPI double-generation hash check, and scope guard. [VERIFY:all focused gates pass; generated hashes remain identical; FACT INSERT remains denied; authorization-before-replay remains green]
  - **Depends on**: T060, T055, T057, T054
  - **Files**: migration/security/OpenAPI evidence only
  - **Action**: Run the focused final deterministic gates again after the full regression: fresh migration/upgrade evidence, RLS/policy/FACT direct DB tests, authorization-before-replay security test, OpenAPI double-generation hash check, and scope guard. This catches late drift after earlier GREEN steps.
  - **Verify**: all focused gates pass; generated hashes remain identical; FACT INSERT remains denied; authorization-before-replay remains green
  - **Evidence**: Final focused security/migration/OpenAPI evidence bundle.

- [ ] T062 [REQ:FR-001-FR-021;Acceptance-1-13;CHK001-115] Audit actual implementation/test evidence against the frozen coverage matrices below. [VERIFY:coverage output states `FR 21/21`, `Acceptance 13/13`, `Checklist 115/115`, with missing lists empty]
  - **Depends on**: T061
  - **Files**: `specs/003-evidence-core/tasks.md` coverage matrices read-only; actual test inventory
  - **Action**: Audit actual implementation/test evidence against the frozen coverage matrices below. Every FR must have at least one implementation task and one mechanical verification task; all 13 Acceptance Scenarios and all CHK001–CHK115 must be covered. Missing coverage is BLOCKED, not an invitation to reinterpret scope.
  - **Verify**: coverage output states `FR 21/21`, `Acceptance 13/13`, `Checklist 115/115`, with missing lists empty
  - **Evidence**: Coverage audit table populated with actual test/evidence references.

- [ ] T063 [REQ:quickstart:§1-13;SC-001-SC-010] Execute the frozen quickstart verification against a real test environment: migration, message happy path, idempotency, authorization/anti-enumeration, Person refs, 8-source provenance, Observation states/time, conflict, supersedes, FACT reachability and OpenAPI. [VERIFY:Every quickstart expected result matches; any mismatch is reported as a concrete gap]
  - **Depends on**: T061
  - **Files**: `specs/003-evidence-core/quickstart.md` read-only; running implementation
  - **Action**: Execute the frozen quickstart verification against a real test environment: migration, message happy path, idempotency, authorization/anti-enumeration, Person refs, 8-source provenance, Observation states/time, conflict, supersedes, FACT reachability and OpenAPI. Do not modify quickstart to fit behavior.
  - **Verify**: Every quickstart expected result matches; any mismatch is reported as a concrete gap
  - **Evidence**: Quickstart run log with status codes/row counts/catalog results.

- [ ] T064 [REQ:AGENTS:§3/§7;constitution:V/VI;CHK001-008;CHK113-115] Perform Implement final governance and diff classification. [VERIFY:`node .specify/scripts/validate-governance.mjs` and `node .specify/scripts/tests/run-governance-tests.mjs` pass; frozen-upstream diff is empty; unexpected implementation diff count = 0]
  - **Depends on**: T062, T063
  - **Files**: frozen upstream paths; full implementation diff; governance scripts
  - **Action**: Perform Implement final governance and diff classification. Relative to `IMPLEMENT_BASE_SHA`, frozen upstream (`Docs/**`, AGENTS.md, constitution, Slice 3 spec/plan/research/data-model/quickstart/contracts/checklist) must have no semantic changes. `tasks.md` may only gain completion/evidence updates during Implement. Classify every other diff as expected business code, migration, tests, generated artifacts/required guards/config, or unexpected; unexpected count must be 0. Run governance scripts.
  - **Verify**: `node .specify/scripts/validate-governance.mjs` and `node .specify/scripts/tests/run-governance-tests.mjs` pass; frozen-upstream diff is empty; unexpected implementation diff count = 0
  - **Evidence**: Frozen-path diff output, full diff classification, governance PASS/self-test counts.

- [ ] T065 [REQ:§40;constitution:VI;CHK115] Push normally and require every real required CI job for the final implementation Head to complete successfully. [VERIFY:final GitHub Actions run conclusion success for every required job]
  - **Depends on**: T064
  - **Files**: `.github/workflows/ci.yml`; GitHub Actions run for final implementation Head
  - **Action**: Push normally and require every real required CI job for the final implementation Head to complete successfully. No placeholder/allowed-failure job may substitute for required validation.
  - **Verify**: final GitHub Actions run conclusion success for every required job
  - **Evidence**: Final Head SHA, workflow URL, per-job conclusions.

- [ ] T066 [REQ:FR-001-FR-021;SC-001-SC-010;Acceptance-1-13;constitution:VI] Implement AI performs self-convergence/evidence collection only: re-read frozen Spec/Plan/Contracts/Checklist, compare implementation against every requirement/security/scope gate, record remaining gaps, and verify no upstream semantics changed. [VERIFY:self-check records requirement/security/scope/CI evidence and `remaining gaps = 0`; otherwise BLOCKED with exact task IDs]
  - **Depends on**: T062, T063, T064, T065
  - **Files**: no new product artifact; evidence/reporting only
  - **Action**: Implement AI performs self-convergence/evidence collection only: re-read frozen Spec/Plan/Contracts/Checklist, compare implementation against every requirement/security/scope gate, record remaining gaps, and verify no upstream semantics changed. This is NOT independent Converge and must not claim merge safety.
  - **Verify**: self-check records requirement/security/scope/CI evidence and `remaining gaps = 0`; otherwise BLOCKED with exact task IDs
  - **Evidence**: Implementation self-convergence evidence with explicit note `not independent Converge`.

- [ ] T067 [REQ:AGENTS:§3;constitution:VI] Final Implement handoff. [VERIFY:T001–T066 all complete; remaining gaps=0; working tree clean; fixed handoff text emitted]
  - **Depends on**: T066
  - **Files**: final implementation state; no new code
  - **Action**: Final Implement handoff. Only when T001–T066 are genuinely complete and all gates/tests/migration/OpenAPI/governance/CI/coverage evidence are green, output exactly `IMPLEMENT COMPLETE — READY FOR INDEPENDENT CONVERGE` and stop. Do not perform independent Converge, do not declare MERGE SAFE, do not merge main.
  - **Verify**: T001–T066 all complete; remaining gaps=0; working tree clean; fixed handoff text emitted
  - **Evidence**: Final implementation evidence index and fixed handoff statement.


## TDD Map

| RED evidence | GREEN implementation / verification |
|---|---|
| T012 schema separation | T030–T036 migration; T055–T057 final DB verification |
| T013 Observation storage/time | T032–T037; T036/T057 |
| T014 Person/FK/supersedes | T033/T040/T041; T036/T057 |
| T015 RLS/grants | T034/T035; T036/T056/T057 |
| T016 FACT guard + pg_policies | T034/T035; T036/T056/T057 |
| T017 audit/idempotency CHECKs | T035; T036/T058 |
| T018 capabilities / FACT absence | T037/T038/T041/T042; T059 |
| T019 provenance 8-row matrix | T038/T041/T042; T047/T059 |
| T020 Observation domain/time | T037/T042 |
| T021 conflict/supersedes | T039/T041/T042; T047 |
| T022 Person/source-message security | T040/T041/T042; T047/T057 |
| T023 Message raw-only/strict/response | T043–T047 |
| T024 Message auth/anti-enumeration | T045–T047 |
| T025 idempotency/hash/concurrency | T044/T045/T048 |
| T026 authorization-before-replay | Phase 0 T007 gate, then T045/T049 |
| T027 internal Evidence transaction | T037–T042/T047/T050 |
| T028 OpenAPI contract | T043/T051–T054 |
| T029 scope guard | T059 |

**Rule**: RED must fail for the intended missing Slice 3 behavior, not for test syntax, missing environment, broken fixture, or unrelated dependency. Existing green tests may not be weakened.

## Coverage Matrix — FR 21 / 21

| FR | Implementation tasks | Mechanical verification tasks |
|---|---|---|
| FR-001 | T030–T033, T037 | T012, T028, T036, T059 |
| FR-002 | T031, T033, T037 | T012, T014, T036 |
| FR-003 | T033, T037 | T013, T020, T036, T057 |
| FR-004 | T038, T041 | T019, T027, T042, T047 |
| FR-005 | T032, T033, T037 | T013, T020, T036, T057 |
| FR-006 | T039, T041 | T021, T027, T042, T047 |
| FR-007 | T033, T039, T041 | T014, T021, T036, T047 |
| FR-008 | T031, T034, T037–T042 | T016, T018, T036, T056, T057, T059 |
| FR-009 | T030, T043, T045, T046 | T023, T047, T053 |
| FR-010 | T004–T007, T040, T041, T045 | T022, T024, T026, T047, T049 |
| FR-011 | T034, T035 | T015, T036, T056, T057 |
| FR-012 | T037–T042 | T029, T059 |
| FR-013 | T043, T045, T051 | T028, T053, T054 |
| FR-014 | T033, T039 | T029, T059, T062 |
| FR-015 | T046, T051 | T028, T029, T053, T059 |
| FR-016 | T038–T041 | T019–T022, T027, T047 |
| FR-017 | T035, T040, T041, T044, T045 | T017, T025–T027, T048–T050, T058 |
| FR-018 | T045, T046 | T024, T029, T059 |
| FR-019 | T030, T040, T045 | T023, T047, T059 |
| FR-020 | T001–T009 | T009, T064 |
| FR-021 | T033, T038, T040, T041 | T014, T022, T027, T047, T057 |

**FR coverage gate**: 21 / 21. T062 must revalidate against the actual implementation, not merely this authoring matrix.

## Coverage Matrix — Acceptance Scenarios 13 / 13

| Acceptance | Primary tasks |
|---|---|
| 1 — raw message + source/time + auto Assertion 0 | T023, T030, T045, T047 |
| 2 — guardian→child Statement stays STATEMENT | T019, T038, T041, T027/T047 |
| 3 — conflict retains both sources/no winner | T021, T039, T027/T047 |
| 4 — UNKNOWN/NOT_COLLECTED/DECLINED/N/A round-trip | T013, T020, T032, T037, T036 |
| 5 — Hypothesis cannot become FACT | T016, T018, T034, T038, T041, T057/T059 |
| 6 — supersedes retains old history | T014, T021, T033, T039, T047 |
| 7 — Family A cannot access Family B Evidence | T015, T024, T034, T056/T057 |
| 8 — provenance traceability | T012/T014, T038–T041, T047 |
| 9 — only approved Message POST | T028, T046, T053, T059 |
| 10 — Observation separate from Assertion | T012, T032, T036 |
| 11 — future AI/extractor cannot confirm FACT | T018/T019, T038/T041, T059 |
| 12 — dependency missing ⇒ Implement BLOCKED | T001–T009 |
| 13 — Family A Evidence cannot reference Family B-only Person | T014, T022, T033, T040/T041, T047/T057 |

**Acceptance coverage gate**: 13 / 13.

## Coverage Matrix — Checklist CHK001–CHK115

Checklist 不按 115 项机械复制 Task；以下连续区间保证没有编号缺口：

| Checklist range | Covering tasks |
|---|---|
| CHK001–CHK008 — governance/authority/scope | T001–T011, T029, T059, T064 |
| CHK009–CHK029 — FR completeness/security | T012–T022, T030–T042, T055–T059, T062 |
| CHK030–CHK042 — Acceptance scenarios | T019–T029, T047–T050, T057–T059, T062 |
| CHK043–CHK052 — Success Criteria | T060–T063 |
| CHK053–CHK060 — Q1/Q2/Q3/Q4/Q5 | T012–T018, T023–T025, T030–T054, T057/T059 |
| CHK061–CHK068 — provenance matrix | T019, T038, T041/T042, T047, T059 |
| CHK069–CHK076 — Person refs/authorization | T014, T022, T024, T027, T040/T041, T047/T049, T057 |
| CHK077–CHK088 — Observation/conflict/supersedes | T013/T014, T020/T021, T032/T033, T037–T042, T047, T056/T057 |
| CHK089–CHK102 — Message/idempotency/audit/OpenAPI | T023–T028, T043–T054, T058/T059 |
| CHK103–CHK115 — RLS/grants/migration/dependencies/scope/testability | T001–T011, T015–T017, T030–T036, T055–T067 |

**Checklist coverage gate**: CHK001–CHK115 = 115 / 115 covered; T062 must confirm actual evidence.

## Dependency Graph

下图由每个 Task 的 `Depends on` 字段生成；正文与图必须保持一致。任何未来 task 编辑都必须重新检查 graph。

- T001 ← ∅
- T002 ← ∅
- T003 ← T001, T002
- T004 ← T003
- T005 ← T003
- T006 ← T003
- T007 ← T005, T006
- T008 ← T003
- T009 ← T004, T005, T006, T007, T008
- T010 ← T009
- T011 ← T009
- T012 ← T010, T011
- T013 ← T010, T011
- T014 ← T010, T011
- T015 ← T010, T011
- T016 ← T010, T011
- T017 ← T010, T011
- T018 ← T010, T011
- T019 ← T010, T011
- T020 ← T010, T011
- T021 ← T010, T011
- T022 ← T010, T011
- T023 ← T010, T011
- T024 ← T010, T011
- T025 ← T010, T011
- T026 ← T010, T011
- T027 ← T010, T011
- T028 ← T010, T011
- T029 ← T010, T011
- T030 ← T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022, T023, T024, T025, T026, T027, T028, T029
- T031 ← T030
- T032 ← T031
- T033 ← T032
- T034 ← T033
- T035 ← T034
- T036 ← T035
- T037 ← T036
- T038 ← T037
- T039 ← T038
- T040 ← T039
- T041 ← T040
- T042 ← T041, T018, T019, T020, T021, T022
- T043 ← T042
- T044 ← T043
- T045 ← T044, T040, T041, T023, T024, T025, T026
- T046 ← T045
- T047 ← T046, T023, T024, T027
- T048 ← T047, T025
- T049 ← T048, T026
- T050 ← T049, T027
- T051 ← T050
- T052 ← T051
- T053 ← T052, T028
- T054 ← T053
- T055 ← T054, T036
- T056 ← T055, T015, T016
- T057 ← T056, T014, T016
- T058 ← T057, T017, T050
- T059 ← T058, T029, T018
- T060 ← T042, T050, T054, T059
- T061 ← T060, T055, T057, T054
- T062 ← T061
- T063 ← T061
- T064 ← T062, T063
- T065 ← T064
- T066 ← T062, T063, T064, T065
- T067 ← T066

### Dependency Graph Integrity

- Undefined dependencies: **0**
- Self dependencies: **0**
- Forward dependencies: **0**
- Cycles: **0**
- Shared-file conflicts among `[P]`: **0 by design** — Phase 2/3 parallel tasks each own distinct test files; Phase 0/1 parallel tasks are read-only.
- Migration edits: **T030 → T031 → T032 → T033 → T034 → T035**, same file, fully serial.
- Shared Evidence domain edits: **T037 → T038 → T039 → T040 → T041 → T042**, serial at the shared seam.
- Message route: T045 is the sole route implementation task; T046 only registers it afterward.
- Generated artifacts: **T051 → T052 → T053 → T054**, serial; no hand editing.

### Main Serial Gates

不声明“唯一最长路径”；主要串行门禁为：

`T001/T002 → T003 → T004/T005/T006/T008 → T007 → T009 → T010/T011 → RED T012–T029 → migration T030–T036 → domain T037–T042 → API T043–T050 → OpenAPI T051–T054 → DB/security T055–T059 → final T060–T067`.

## File Ownership / Parallel Safety

- `[P]` 的 Phase 2/3 RED 任务各自创建不同测试文件；禁止在这些并行任务中顺手修改 production code、migration 或共享 test helper。
- 如果某 RED test 真正需要新增共享 helper，先停止该并行 batch，把 helper 作为新的串行 task 回到 Tasks Review；不得让两个并行任务编辑同一 helper。
- `db/migrations/<resolved-next>_evidence_core.sql` 只由 T030–T035 串行编辑。
- `packages/domain/src/evidence.ts` 只由 T037–T039、T041 串行编辑；`repository.ts` 在 T040 之后由 T041 消费。
- `packages/contracts/src/schemas.ts` 只在 T043 修改。
- `packages/domain/src/idempotency.ts` 只在 T044 修改。
- `apps/server/api/src/routes/messages.ts` 只在 T045 创建/修改。
- `apps/server/api/src/app.ts` 只在 T046 注册。
- generated files 只由 generator 在 T052 产生，禁止 hand-edit。

## Implement Gate — Required Stop Conditions

以下任何一项出现，立即停止，固定输出 `BLOCKED — SLICE 3 IMPLEMENTATION DEPENDENCY`：

1. Slice 1 未 Implement complete / independent Converge PASS / merged main；
2. Slice 2 未 Implement complete / independent Converge PASS / merged main；
3. final Family/Person/guardian/consent-first/`family_members`/`provenance_source` 与 frozen assumptions 不一致；
4. final Case composite key / Case authorization / anti-enumeration / RLS / errors 与 frozen assumptions 不一致；
5. final shared idempotency transport/hash/scope/locking/response snapshot 与 Q3 不一致；
6. **final shared helper 不能支持 specific Case authorization before replay fast-path**；
7. final current-Family semantics 不确定；
8. runtime role/RLS/audit/OpenAPI/CI baseline 不真实或不稳定。

第 3–7 项如改变 frozen Plan 关键假设，需要 **Plan Review**。不得：
- 私自修 Slice 1/2；
- 复制第二套 idempotency/audit/authorization；
- 用 route-local replay hack；
- 先写 migration/tests 再说；
- 继续 T010 以后任务。

## FACT Production Capability Freeze

未来 Implement 必须同时证明：

- DB/domain semantic 中 FACT **存在**；
- production exports 只有 `recordStatement` / `recordHypothesis` / `recordObservation` / `assignConflictGroup`；
- `recordHypothesis` 当前没有 production-admissible AI source/caller；
- `xiaoshuyin_app + correct Family context + INSERT FACT` **DB reject**；
- otherwise-valid STATEMENT/HYPOTHESIS direct runtime INSERT 可通过 DB capability guard（仍受其它约束）；
- `pg_policies` 中不存在另一 permissive INSERT policy 通过 OR 放开 FACT；
- test-only FACT fixture 只能走隔离 privileged test/migrator context，不能进入 production import graph；
- no FACT HTTP route / confirmation workflow / generic assertion writer。

## Implementation Diff Governance

未来 Implement 的正常 diff **可以且应该**包含：
- business/domain/repository/API code；
- 新 migration；
- tests；
- generator 产生的 OpenAPI/types；
- frozen Plan 明确需要的最小 guard/config 变更。

未来 Implement 不得擅改：
- `Docs/**`
- `AGENTS.md`
- `.specify/memory/constitution.md`
- Slice 3 `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `quickstart.md`
- `contracts/**`
- `checklists/**`
- Slice 1 / Slice 2 frozen artifacts

如果实现揭示上游必须改变，走正式 upstream loop；不得让 T064 “解释掉”语义漂移。

## Implement Self-Check vs Independent Converge

T066 是 **Implement AI 自检 / evidence collection**，不是独立 Converge。  
Implement AI 不得因为 T066 为 green 就宣布：
- `MERGE SAFE`
- independent Converge PASS
- 可以合并 main

独立 Converge 必须由新的独立 AI 在 Implement 完成后执行。

## Completion Contract

### 当前 Tasks-generation 阶段

本文件创建完成时：
- T001–T067 全部保持未勾选；
- 不执行 Phase 0 Gate；
- 不执行 RED；
- 不写 migration/business code/tests；
- 不进入 Analyze / Implement。

当前阶段只允许结论：**Tasks artifact ready for review.**

### 未来 Implement 阶段

只有 T001–T066 全部真实完成、所有依赖/测试/security/migration/OpenAPI/governance/CI/coverage 证据 green、remaining gap=0，T067 才允许输出：

`IMPLEMENT COMPLETE — READY FOR INDEPENDENT CONVERGE`

随后停止。不得自行执行 independent Converge。
