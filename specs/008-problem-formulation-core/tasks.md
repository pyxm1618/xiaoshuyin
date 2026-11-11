# Slice 8 — Implementation Tasks

> Planning artifact only. None of these tasks has been executed. Stable task IDs are reserved for the future Development AI and independent audits.

## Task rules

- `[S]` = serial. Must not be executed in parallel with another task that edits the same file or shared migration/governance surface.
- `[P]` = may run in parallel **only** after dependencies are complete and only with the other explicitly non-conflicting tasks in that phase.
- All migration authoring/application tasks are serial.
- Generated OpenAPI files are never hand-edited.
- Every task must finish with the listed verification before its dependents start.
- No task may modify `Docs/**`, frozen `spec.md`, or migrations `001`–`007`.

## Requirement keys

`FR-001`–`FR-030` refer to the Frozen Slice 8 Spec. `AS-1`–`AS-25` refer to its 25 acceptance scenarios. User acceptance A–K is covered explicitly in Phase 8.

---

# Phase 0 — Pre-development gates

## T801 [S] — Revalidate immutable inputs

**Maps:** all FRs; pre-development G1

**What**  
Re-resolve `main`, the audited Plan head, frozen Spec commit/branch, and diff scope immediately before development.

**Why**  
Implementation must not begin on stale or drifted product/implementation truth.

**Where**  
Read-only Git state; no file changes.

**Depends on**  
Independent Pre-development Audit = PASS and owner-authorized Plan freeze.

**How to verify**  
Record exact SHA, merge-base, ahead/behind and changed-file list. STOP if frozen Spec or authoritative baseline changed without re-audit.

---

## T802 [S] — Run canonical baseline before RED work

**Maps:** FR-023, FR-025; G11

**What**  
Run current repository baseline test/typecheck/static/OpenAPI/DB verification before Slice 8 edits.

**Why**  
Pre-existing failures must not be misattributed to Slice 8 or “fixed” by weakening its tests.

**Where**  
No planned source change; capture command outputs externally or in the repository's approved evidence mechanism.

**Depends on**  
T801.

**How to verify**  
Baseline commands exit 0, or development stops with a diagnosed upstream blocker.

---

## T803 [S] — Introspect real DB constraints, grants and roles

**Maps:** FR-018, FR-021, FR-019; G2/G3/G5/G7/G8

**What**  
Read actual `pg_constraint`, `pg_policies`, `information_schema.role_*_grants`, table owners, enum labels and migration records for Case/Event/Audit/Idempotency/Evidence.

**Why**  
008 must extend the real current whitelist and privilege state, not stale copied SQL.

**Where**  
Read-only database queries; no migration file yet.

**Depends on**  
T802.

**How to verify**  
Evidence records exact constraint names/definitions and confirms app/migrator `NOBYPASSRLS`, Case table-level UPDATE=false, migrations through 007 present including both `004_*` files.

---

## T804 [P] — Inventory negative-space guards that currently forbid Slice 8

**Maps:** FR-022, FR-025, FR-028, FR-029; G10

**What**  
Locate every test/static rule that forbids `problem_formulations` or `/problem-formulations` and classify which assertion must be narrowed versus retained.

**Why**  
The new owned object must become legal without accidentally legalizing future Scene/Goal/Plan/Safety/UI objects.

**Where**  
Read-only inventory of `scripts/guard-static.mjs`, `tests/integration/cases-scope.test.ts`, OpenAPI scope tests and related governance scripts.

**Depends on**  
T802.

**How to verify**  
Inventory contains all current matches and a proposed exact replacement for each. No file modified yet.

---

## T805 [P] — Revalidate primary lock order and Evidence carrier seam

**Maps:** FR-007, FR-015, FR-020, FR-030; G4/G6

**What**  
Re-read current Slice 7 lock helpers and Slice 3 Evidence repository fields before implementation design is translated into code.

**Why**  
Family→Case ordering and valid Evidence fields are hard dependencies for concurrency/fidelity.

**Where**  
Read-only `packages/domain/src/case-primary-switch.ts`, `packages/domain/src/repository.ts`, `packages/domain/src/evidence.ts`, relevant migrations/tests.

**Depends on**  
T802.

**How to verify**  
Confirm Family is still the canonical primary serialization point and dialogue/STATEMENT/supersedes/validity/conflict/value-state data remains available. STOP if incompatible.

---

# Phase 1 — RED tests and contract anchors

## T806 [P] — Add RED DB schema/current/history/RLS tests

**Maps:** FR-001–FR-004, FR-018, FR-027; AS-12/16/17/20

**What**  
Write failing DB tests for enum/table shape, version chain, current uniqueness, DRAFT persistence rejection, immutable content privileges, RLS, DELETE denial and same-Family FKs.

**Why**  
Database invariants must be executable before migration implementation.

**Where**  
`tests/db/problem-formulations-schema.test.ts`  
`tests/db/problem-formulations-rls.test.ts`

**Depends on**  
T803, T805.

**How to verify**  
Tests fail only because 008 objects/grants do not yet exist; no unrelated failures.

---

## T807 [P] — Add RED domain state/version tests

**Maps:** FR-002–FR-004, FR-010–FR-013, FR-020, FR-027; AS-10/11/12/15/25

**What**  
Write pure/domain tests for the exact six-state transition matrix, current/version rules, correction merge semantics, Confirm/Dispute/Reassess decisions and Case-version expectations.

**Why**  
Illegal transitions must fail mechanically rather than by route convention.

**Where**  
`tests/domain/problem-formulations-state.test.ts`  
`tests/domain/problem-formulations-version.test.ts`

**Depends on**  
T801.

**How to verify**  
Tests compile against planned exported types or remain intentionally RED with explicit missing symbols; each frozen legal/illegal transition has an assertion.

---

## T808 [P] — Add RED Evidence/dependency fidelity tests

**Maps:** FR-007, FR-009, FR-026, FR-030; AS-2/4/8/22

**What**  
Test same-Case refs, superseded/expired refs, unknown states, DECLINED, positive support, traceable problem statement and determinable dependency invalidity. Add exact ConflictItem cases (group-only valid, explicit two-distinct-ref valid, one-ref/no-group invalid, unresolvable group invalid, group+refs mismatch invalid) and mandatory-dependency completeness cases (server-required Evidence/Consent omitted, client set incomplete).

**Why**  
Evidence fidelity is a core invariant, not a later integration detail.

**Where**  
`tests/domain/problem-formulations-evidence.test.ts`

**Depends on**  
T805.

**How to verify**  
Every frozen Evidence failure mode has an explicit expected domain error/category; contract/domain tests prove the five ConflictItem forms and prove client dependency refs cannot redefine or omit the server-derived mandatory set.

---

## T809 [P] — Add RED authorization/AI-boundary tests

**Maps:** FR-014, FR-017; AS-9/16/18

**What**  
Test the six planned Case actions, manager-only decisions, missing real actor rejection, and absence of AI/system confirmer authority.

**Why**  
The AI authority boundary must be structural and mechanically tested.

**Where**  
`tests/domain/problem-formulations-authorization.test.ts`

**Depends on**  
T801.

**How to verify**  
Tests identify required action registry additions and prove no synthetic principal is accepted by planned command types.

---

## T810 [P] — Add RED OpenAPI/runtime-surface tests

**Maps:** FR-022, FR-024, FR-028; AS-5/20/21

**What**  
Test exact four public operations, true-empty current envelope, strict bodies, required headers, ConflictItem's conditional group-or-pair contract, PostgreSQL-integer version maxima, and absence of Start/Present/Reassess/create/history routes.

**Why**  
Public/internal separation is a frozen product boundary.

**Where**  
`tests/integration/openapi-problem-formulations.test.ts`  
`tests/integration/problem-formulations-scope.test.ts`

**Depends on**  
T801.

**How to verify**  
New tests are RED because Slice 8 routes/schemas are absent, while all pre-existing route tests remain unchanged/green.

---

# Phase 2 — Shared contracts and domain primitives

## T811 [S] — Extend authorization action registry

**Maps:** FR-014, FR-017

**What**  
Add exactly six mutation actions with `FAMILY_MANAGEMENT` + Case resource semantics; retain `CASE_READ` for GET current.

**Why**  
All commands need explicit authorization without a new RBAC model.

**Where**  
`packages/authorization/src/authorize.ts`

**Depends on**  
T809.

**How to verify**  
T809 becomes green for action matrices; old authorization tests remain green; no new Purpose/Resource/role.

---

## T812 [S] — Add strict Zod/public/domain input schemas

**Maps:** FR-002, FR-006–FR-012, FR-022, FR-024, FR-026

**What**  
Define strict EvidenceRef, DependencyRef, content, response, correction, path/header and public envelope schemas matching the planned OpenAPI candidate. Every DB-backed integer version is 1..2147483647. ConflictItem accepts group-only or no-group + >=2 distinct refs; mixed group+refs is structurally accepted but domain consistency-validated. If-Match performs lexical validation plus integer parse/range validation before any repository/SQL call.

**Why**  
Client/server-owned boundaries and JSON shape must be one executable contract.

**Where**  
`packages/contracts/src/schemas.ts`

**Depends on**  
T810.

**How to verify**  
Schema unit/integration tests reject unknown fields, client status/version/confirmed fields, empty changes, malformed refs and malformed/out-of-range If-Match. Explicit boundaries: 2147483647 accepted; 2147483648 rejected for path formulation version, numeric DB-backed versions/caseVersion where represented, and If-Match before DB access.

---

## T813 [S] — Add Problem Formulation domain types and pure transition policy

**Maps:** FR-001–FR-004, FR-008, FR-010–FR-013, FR-027, FR-029

**What**  
Create the domain module with exact status vocabulary, transition guards, complete-content/correction merge validation and typed domain errors.

**Why**  
State/version semantics need a single reusable policy surface independent of HTTP.

**Where**  
`packages/domain/src/problem-formulations.ts`  
`packages/domain/src/index.ts`

**Depends on**  
T807, T812.

**How to verify**  
T807 green; no Assessment/Scene/Goal/AI import/dependency exists.

---

## T814 [S] — Add Evidence/current-validity resolvers and fidelity validator

**Maps:** FR-007, FR-009, FR-026, FR-030

**What**  
Implement read-only resolvers for dialogue/assertion/observation refs, successor/validity classification, conflict/unknown preservation, positive-support proof and traceable-problem-statement check. Add the server-side conflict-group resolver needed for group-only ConflictItem proof and read-only resolvers that expose Evidence subject/source Person ids for the Slice 8 processing-Person derivation.

**Why**  
Present/Correction/Confirm must reason from current Slice 3 facts without duplicating Evidence.

**Where**  
`packages/domain/src/problem-formulations.ts`  
`packages/domain/src/repository.ts` only if an existing shared repository seam is the established ownership pattern.

**Depends on**  
T813, T808.

**How to verify**  
T808 green; Evidence tables remain unmodified; no Evidence write is introduced.

**Parallel note**  
Serial with T813/T815 if they edit the same domain file. Do not parallelize same-file edits.

---

## T815 [S] — Extend idempotency command vocabulary/types

**Maps:** FR-019, FR-020

**What**  
Add the six planned command-type literals and reuse exact bytea Case-key utilities/slot semantics.

**Why**  
Slice 8 must use the shared idempotency system and exact logical key identity.

**Where**  
`packages/domain/src/idempotency.ts`

**Depends on**  
T803.

**How to verify**  
Existing idempotency unit tests plus new command-type/key-representation tests compile and pass at TypeScript level; no second table/store.

---

# Phase 3 — Migration (strictly serial)

## T816 [S, MIGRATION] — Author `008_problem_formulation_core.sql`

**Maps:** FR-001–FR-004, FR-018–FR-021, FR-027

**What**  
Create the one additive reviewed migration exactly in Plan §14 order: enum/table/constraints/indexes/RLS/policies/grants/Case phase grant/event/audit/idempotency whitelist extensions.

**Why**  
This is the persistent structural foundation and highest-risk shared-schema change.

**Where**  
`db/migrations/008_problem_formulation_core.sql`

**Depends on**  
T803, T806, T813, T815.

**How to verify**  
Run only focused migration/schema/RLS tests first. Confirm no files `001`–`007` changed. Inspect exact SQL diff. Do not perform any other migration edit in parallel.

---

## T817 [S] — Turn schema/RLS/role tests green

**Maps:** FR-003, FR-004, FR-018, FR-027

**What**  
Complete DB test assertions against the real 008 structure and least-privilege behavior.

**Why**  
The migration is not accepted merely because it applies.

**Where**  
`tests/db/problem-formulations-schema.test.ts`  
`tests/db/problem-formulations-rls.test.ts`

**Depends on**  
T816.

**How to verify**  
Focused DB tests pass under app/migrator/admin roles and direct-SQL negative cases.

---

# Phase 4 — Application service and commands

## T818 [S] — Implement shared transaction/lock/idempotency orchestration seam

**Maps:** FR-015–FR-021, FR-023

**What**  
Create the application service transaction skeleton: real user context → RLS transaction → existing requireFamilyAction/authorize → idempotency slot → Family lock → Case lock → formulation lock → server-derived processing-Person set → existing getComplianceProfileForUpdate/getConsentRecordForGate/getCurrentNoticeHash/assertMinorProcessingAllowed gate → command-specific mandatory-dependency check → outcome persistence. Do not duplicate the compliance decision tree.

**Why**  
All six commands need one canonical ordering and replay policy; duplicated route-level orchestration would drift.

**Where**  
`apps/server/api/src/services/problem-formulations.ts`

**Depends on**  
T811, T813, T814, T815, T817.

**How to verify**  
Unit/integration harness proves lock/helper call order and deterministic 4xx/no-business-write outcome persistence; no SQL appears in `apps/**`.

---

## T819 [S] — Implement StartAssessment

**Maps:** FR-005, FR-015–FR-021, FR-023, FR-030; AS-1/2

**What**  
Implement internal Start command using existing requireFamilyAction/authorize, server-resolved traceable statement check, server-derived processing-Person set, existing Consent/minor-processing gate, primary/Safety/Closed/phase/Case-version gates, Case update, event, audit and idempotency.

**Why**  
It is the minimum legal phase bridge into ASSESSMENT.

**Where**  
`apps/server/api/src/services/problem-formulations.ts`  
`packages/domain/src/problem-formulations.ts`

**Depends on**  
T818.

**How to verify**  
Dedicated internal-service integration tests: success, no statement, nonprimary, Safety, wrong phase, stale Case, retry, missing Consent, revoked Consent, stale/notice-mismatched Consent, and UNDER_14 processing blocked. Every blocked compliance case asserts zero phase/event/audit/idempotent-business mutation; no Assessment/formulation object is created.

---

## T820 [S] — Implement PresentProblemFormulation

**Maps:** FR-006, FR-007, FR-015–FR-021, FR-023, FR-029; AS-3/4/22/24

**What**  
Implement internal Present with complete content validation, Evidence fidelity, server-derived processing-Person compliance gate, mandatory dependency derivation and completeness proof, version allocation, optional old-current supersession after Reassess, Case phase/version update and atomic history.

**Why**  
This is the sole internal bridge from ASSESSMENT into a current PRESENTED formulation.

**Where**  
`apps/server/api/src/services/problem-formulations.ts`  
`packages/domain/src/problem-formulations.ts`

**Depends on**  
T819.

**How to verify**  
Version-1 and post-Reassess version-N integration tests; invalid Evidence, missing/revoked/stale Consent, UNDER_14 block, mandatory dependency omitted, and client dependency set incomplete all yield zero formulation/phase mutation. No DRAFT/AI/Scene side effect.

---

## T821 [S] — Implement ConfirmProblemFormulation

**Maps:** FR-008, FR-009, FR-013–FR-021, FR-023, FR-026; AS-6/7/8/9/11/13/14/24

**What**  
Implement current PRESENTED confirmation with realtime server-truth processing-Person compliance revalidation, mandatory dependency re-derivation + subset proof, determinable stored dependency/Evidence validation, real-user confirmer, Case GOALS/version update, event/audit/idempotency.

**Why**  
Confirm is the only legal Slice 8 path into GOALS and the highest-authority mutation.

**Where**  
`apps/server/api/src/services/problem-formulations.ts`  
`packages/domain/src/problem-formulations.ts`

**Depends on**  
T820.

**How to verify**  
Internal service tests prove exact guards, AI/system absence, missing/revoked/stale Consent, UNDER_14 block, mandatory dependency omitted from stored current, stale dependency refusal and atomic outcome. Confirm never trusts only the stored/client-supplied dependency list.

---

## T822 [S] — Implement DisputeProblemFormulation

**Maps:** FR-010, FR-014–FR-021, FR-023; AS-10/11

**What**  
Implement PRESENTED→DISPUTED response with the same server-derived processing-Person Consent/compliance gate, Case version bump but no phase change/reassessment.

**Why**  
Owner clarification explicitly requires disagreement without automatic reassessment.

**Where**  
`apps/server/api/src/services/problem-formulations.ts`  
`packages/domain/src/problem-formulations.ts`

**Depends on**  
T821.

**How to verify**  
Service test asserts phase unchanged, repeated different-key dispute conflicts, same-key replay exact, Confirm after dispute conflicts.

---

## T823 [S] — Implement CorrectProblemFormulation

**Maps:** FR-003, FR-004, FR-011, FR-014–FR-021, FR-023, FR-027; AS-12/24/25

**What**  
Implement strict partial correction input, complete server merge/revalidation, server-derived processing-Person compliance gate, mandatory dependency re-derivation on the merged result, old SUPERSEDED + new PRESENTED full version, no inherited confirmation, Case version bump. A patch must not be able to strip a server-required dependency.

**Why**  
Corrections must preserve immutable history and force re-confirmation.

**Where**  
`apps/server/api/src/services/problem-formulations.ts`  
`packages/domain/src/problem-formulations.ts`

**Depends on**  
T822.

**How to verify**  
DB snapshot proves old content byte-equivalent except lifecycle fields; new row is complete; no-op/empty/GOALS/current-stale paths fail as planned. Add negative tests for dependency stripped by Correction, newly required dependency omitted after merge, missing/revoked/stale Consent and UNDER_14 processing blocked; every rejection leaves old current untouched.

---

## T824 [S] — Implement ReassessFromFormulation

**Maps:** FR-012, FR-015–FR-021, FR-023; AS-15

**What**  
Implement internal PROBLEM_FORMULATION→ASSESSMENT command with domain-validated existing basis, the same server-derived processing-Person Consent/compliance gate over the locked current formulation, current formulation preserved, Case version bump and audit/event/idempotency.

**Why**  
Reassessment is independent from Dispute and must not rewrite history.

**Where**  
`apps/server/api/src/services/problem-formulations.ts`  
`packages/domain/src/problem-formulations.ts`

**Depends on**  
T823.

**How to verify**  
Before/after formulation row is identical; only Case phase/version + event/audit/idempotency changes. Follow-up Present supersedes old current into version+1.

---

# Phase 5 — Public HTTP surface / errors / OpenAPI

## T825 [S] — Add exact new error codes and mappings

**Maps:** FR-008–FR-010, FR-015–FR-020, FR-023

**What**  
Add planned 409/422 error literals and HTTP mappings without changing existing error meanings.

**Why**  
Failure semantics must be stable and distinguish validation from state conflict without leaking existence.

**Where**  
`apps/server/api/src/plugins/error-handler.ts` and the repository's canonical error-code type location, if separate.

**Depends on**  
T819–T824.

**How to verify**  
Error-map tests cover every new literal/status and preserve existing mappings; unknown failures still 500.

---

## T826 [S] — Implement the four public routes only

**Maps:** FR-008–FR-011, FR-014, FR-017, FR-022–FR-024; AS-5–14/16/18/19/21/25

**What**  
Add GET current, POST confirm, POST dispute, POST corrections; parse Idempotency-Key/If-Match/path/body; enforce 1..2147483647 for every DB-backed integer version; parse/range-check If-Match before any repository/SQL call; delegate to the shared service; implement 200-null true empty and ETag.

**Why**  
Public API must exactly match frozen §28.3/OC-3 and reuse the internal command logic rather than duplicate it.

**Where**  
`apps/server/api/src/routes/problem-formulations.ts`

**Depends on**  
T812, T821–T825.

**How to verify**  
Focused route integration tests prove exact status/error bodies, no route-level SQL, path version 2147483647 accepted / 2147483648 rejected, and If-Match case-v2147483647 accepted / case-v2147483648 rejected before DB access.

---

## T827 [S] — Register only the approved route plugin

**Maps:** FR-022, FR-025, FR-028

**What**  
Register the formulation route module and nothing for Start/Present/Reassess.

**Why**  
Runtime route surface must match frozen API, not just OpenAPI.

**Where**  
`apps/server/api/src/app.ts`

**Depends on**  
T826.

**How to verify**  
`app.printRoutes()` contains exactly the four Slice 8 operations and no fifth formulation/assessment transition route.

---

## T828 [S] — Add Slice 8 frozen YAML to semantic OpenAPI union

**Maps:** FR-022

**What**  
Register `specs/008-problem-formulation-core/contracts/problem-formulation-api.openapi.yaml` in the existing semantic checker and require full response-body equivalence for Slice 8.

**Why**  
Generated/runtime schemas must not silently drift from the audited contract.

**Where**  
`scripts/openapi-check.mjs`

**Depends on**  
T827 and owner-audited contract file.

**How to verify**  
Before generation, checker reports only expected generated drift; old frozen contracts remain checked.

---

## T829 [S, GENERATOR] — Generate OpenAPI artifacts formally

**Maps:** FR-022

**What**  
Run the repository generator; do not manually edit generated JSON/types.

**Why**  
Generated artifacts must remain reproducible from route Zod schemas.

**Where**  
Generated by command into:  
`packages/generated/openapi.json`  
`packages/generated/openapi.d.ts`

**Depends on**  
T828.

**How to verify**  
`bun run openapi:generate` succeeds; immediate second run is diff-no-op; `bun run openapi:check` passes.

---

## T830 [S] — Turn OpenAPI/runtime-surface tests green

**Maps:** FR-022, FR-024; AS-5/20/21

**What**  
Finalize exact operation, schema, response, header, true-empty and forbidden-route assertions, including ConflictItem group-only/pair conditionality and the 2147483647 version ceiling.

**Why**  
Both generated contract and real runtime must be mechanically bounded.

**Where**  
`tests/integration/openapi-problem-formulations.test.ts`  
`tests/integration/problem-formulations-scope.test.ts`

**Depends on**  
T829.

**How to verify**  
Dedicated tests + `openapi:check` pass and enumerate no fifth route. Contract tests cover group-only valid, evidence-pair valid, single evidence without group invalid, invalid/unresolvable group rejected by domain resolver, and integer boundary 2147483647/2147483648.

---

# Phase 6 — Governance reconciliation

## T831 [S] — Narrow static scope guard exactly for Slice 8

**Maps:** FR-001, FR-025, FR-028, FR-029

**What**  
Remove only `problem_formulations` from the current forbidden-table list and, if needed, update comments to the new owned-scope boundary.

**Why**  
The legitimate new table must pass while all future-slice guards remain enforced.

**Where**  
`scripts/guard-static.mjs`

**Depends on**  
T816.

**How to verify**  
`bun run guard:static` passes; a temporary/fixture forbidden `goals` or `scene_node_states` definition is still caught by the guard test mechanism.

---

## T832 [S] — Reconcile legacy Case scope tests without weakening them

**Maps:** FR-022, FR-025

**What**  
Replace old “no problem_formulations” assertions with exact one-table/four-route ownership assertions while retaining every unrelated forbidden table/route.

**Why**  
Historical Slice 2 scope tests must evolve from “future object forbidden” to “Slice 8 exact surface” rather than be deleted.

**Where**  
`tests/integration/cases-scope.test.ts`  
`tests/integration/openapi-cases.test.ts`

**Depends on**  
T827, T830.

**How to verify**  
Old Case semantics remain green; all unrelated negative-space assertions still execute.

---

## T833 [S] — Update migration reproduction and exact role tests

**Maps:** FR-018, FR-023, FR-025, FR-027

**What**  
Update exact object names/counts, new enum/table/policies, formulation grants and Case phase column grant while keeping Case table-level UPDATE=false.

**Why**  
Current governance tests are exact and must recognize 008 without becoming looser.

**Where**  
`tests/db/migration-repro.test.ts`  
`tests/db/roles.test.ts`

**Depends on**  
T817.

**How to verify**  
Both tests pass on fresh migrated DB; direct privilege queries match the Plan.

---

## T834 [S] — Update DB evidence script for 008

**Maps:** FR-018, FR-023, FR-027

**What**  
Extend expected table/enum/policy/privilege/migration evidence and upgrade path to include 008 while retaining both 004 migration files.

**Why**  
Final evidence must prove the real schema rather than a stale pre-Slice-8 object set.

**Where**  
`scripts/db-evidence.mjs`

**Depends on**  
T833.

**How to verify**  
`bun run db:evidence -- --no-archive` passes fresh rebuild, 001–007→008 upgrade and replay without modifying tracked evidence.

---

# Phase 7 — Idempotency, concurrency and atomicity

## T835 [P] — Add idempotency replay/mismatch integration matrix

**Maps:** FR-019, FR-021, FR-023; AS-14

**What**  
For all six write commands, test same key/same request replay, same key/different payload 409, concurrent same-key replay, no duplicate business/event/audit rows, and deterministic post-auth 4xx replay.

**Why**  
Idempotency must cover internal and public commands consistently.

**Where**  
`tests/integration/problem-formulations-idempotency.test.ts`

**Depends on**  
T824, T826, T834.

**How to verify**  
Matrix passes with exact row counts and original response snapshots.

---

## T836 [P] — Add same-current mutation race matrix

**Maps:** FR-003, FR-020, FR-021, FR-023; AS-13

**What**  
Run real concurrent DB/HTTP/service calls for Present/Present, Correction/Correction, Confirm/Confirm, Confirm/Correction, Confirm/Dispute, Confirm/Reassess, Correction/Dispute, Reassess/Confirm.

**Why**  
A lock design is not proven until competing real transactions demonstrate one valid outcome.

**Where**  
`tests/db/problem-formulations-concurrency.test.ts`  
`tests/integration/problem-formulations-concurrency.test.ts`

**Depends on**  
T824, T826, T834.

**How to verify**  
Every race asserts one winner (or replay), loser 409 where applicable, one current row, valid Case phase/version and no duplicate event/audit.

---

## T837 [P] — Add Primary Switch cross-command race tests

**Maps:** FR-015, FR-020; AS-19

**What**  
Race SwitchPrimaryCase independently against Present, Confirm, **Correct**, and Reassess using real concurrent requests/service calls. Correction is a mandatory standalone race because it SUPERSEDEs the old current, INSERTs a new current and increments Case version. Also cover Dispute/SwitchPrimaryCase if practical, but Dispute does not substitute for Correction.

**Why**  
Family serialization must prevent stale-primary progression.

**Where**  
`tests/integration/problem-formulations-primary-switch-concurrency.test.ts`

**Depends on**  
T824, T826, T834.

**How to verify**  
For each of Present/Switch, Confirm/Switch, Correct/Switch and Reassess/Switch: if switch serializes first and demotes target, the formulation command is 409 with zero business mutation; if the formulation command serializes first, its complete valid result commits before switch. Correction assertions include exactly one current row, intact supersedes chain and correct Case version. Never a write that observes a post-switch nonprimary Case as primary.

---

## T838 [P] — Add transaction fault-injection atomicity tests

**Maps:** FR-021, FR-023; AS-24

**What**  
Inject failures after formulation write, Case phase/version write, event write and audit write for Present/Confirm/Correction.

**Why**  
Atomic rollback must be demonstrated at the failure seams most likely to produce partial state.

**Where**  
`tests/integration/problem-formulations-atomicity.test.ts`

**Depends on**  
T824, T826, T834.

**How to verify**  
After each injected failure, formulation/version/current, Case phase/version, event, audit and idempotency state all match the pre-command snapshot.

---

# Phase 8 — Full frozen acceptance / negative-path closure

## T839 [P] — Close StartAssessment + Present acceptance scenarios

**Maps:** FR-005–FR-007, FR-015, FR-016, FR-030; AS-1–4; user A/B/G/I/J

**What**  
Complete integration coverage for success/rejection of Start and Present, including traceable statement, Evidence fidelity, server-truth Consent/compliance, primary/Safety, mandatory dependency completeness and zero out-of-scope objects.

**Where**  
`tests/integration/problem-formulations-start-present.test.ts`

**Depends on**  
T835–T838.

**How to verify**  
AS-1–4 and A/B/G/I/J each have named assertions and DB row checks, plus named negatives for missing Consent, revoked Consent, stale/notice-mismatched Consent, UNDER_14 processing blocked, mandatory dependency omitted and client dependency set incomplete.

---

## T840 [P] — Close current/Confirm acceptance scenarios

**Maps:** FR-008, FR-009, FR-013–FR-018, FR-024, FR-026; AS-5–9/16–19/21; user C/H/I/J

**What**  
Cover populated/empty current, Confirm success, stale/noncurrent/wrong-status/dependency invalid, server-mandatory dependency completeness, server-truth Consent/compliance revalidation, wrong family/actor, nonprimary, Safety, AI/system boundary.

**Where**  
`tests/integration/problem-formulations-current-confirm.test.ts`

**Depends on**  
T835–T838.

**How to verify**  
AS-5–9/16–19/21 and C/H/I/J map to explicit test names; confirmed_by is the real actor Person only. Explicit negatives: missing/revoked/stale Consent, UNDER_14 processing blocked, mandatory dependency omitted from stored current, and Confirm-time server mandatory set not contained in current valid dependency set.

---

## T841 [P] — Close Dispute/Correction/Reassess acceptance scenarios

**Maps:** FR-003, FR-004, FR-010–FR-012, FR-020, FR-027; AS-10–12/15/25; user D/E/F/K

**What**  
Cover Dispute phase stability, Confirm-after-dispute conflict, correction complete new version/history, Correction dependency anti-strip/incomplete-set rejection, Consent/compliance rejection on Dispute/Correction/Reassess, Reassess unchanged formulation, post-Reassess Present and GOALS correction rejection.

**Where**  
`tests/integration/problem-formulations-response-flow.test.ts`

**Depends on**  
T835–T838.

**How to verify**  
AS-10–12/15/25 and D/E/F/K have explicit before/after row snapshots.

---

## T842 [P] — Close fidelity/out-of-scope/audit acceptance scenarios

**Maps:** FR-007, FR-021–FR-023, FR-025, FR-028, FR-029; AS-20/22/23/24; user G

**What**  
Verify DECLINED/conflict fidelity, exact negative-space schema/routes, content-free event/audit metadata and no partial writes.

**Where**  
`tests/integration/problem-formulations-fidelity-scope-audit.test.ts`

**Depends on**  
T831–T838.

**How to verify**  
AS-20/22/23/24 pass and no event/audit JSON contains primary problem, unknown/conflict content or response notes.

---

# Phase 9 — Migration and contract evidence closure

## T843 [S, MIGRATION] — Prove fresh / upgrade / replay / rollback behavior

**Maps:** FR-018, FR-023, FR-027

**What**  
Run 008 through an empty PostgreSQL 18 database, an exact 001–007 database, a second no-op application and controlled migration-failure rollback scenario.

**Why**  
A reviewed SQL file is not sufficient evidence of reproducibility.

**Where**  
Existing migration test/evidence harness plus Slice 8 DB tests; no second migration file.

**Depends on**  
T834, T839–T842.

**How to verify**  
Record exact `schema_migrations` filenames/timestamps, object fingerprints and zero partial objects after forced failure.

---

## T844 [S] — Prove OpenAPI semantic equivalence and runtime drift closure

**Maps:** FR-022, FR-024

**What**  
Regenerate, semantic-check frozen contracts, run runtime route enumeration and strict schema tests.

**Why**  
The public boundary must be proven simultaneously at frozen YAML, generated artifact and real Fastify runtime.

**Where**  
No manual generated-file edits; use formal generator/checker and OpenAPI tests.

**Depends on**  
T830, T832, T839–T842.

**How to verify**  
`bun run openapi:generate` then `bun run openapi:check` pass; second generation is diff-no-op; runtime has exactly four Slice 8 public operations.

---

# Phase 10 — Canonical full verification and scope review

## T845 [S] — Run focused Slice 8 verification

**Maps:** FR-001–FR-030; AS-1–AS-25; user A–K

**What**  
Run all Slice 8 domain/DB/integration/OpenAPI/concurrency/atomicity tests together.

**Why**  
Individual phases may pass while the composed command graph regresses.

**Where**  
Test runner only.

**Depends on**  
T843, T844.

**How to verify**  
All focused test files pass in one run with real DB concurrency tests enabled.

---

## T846 [S] — Run repository-wide canonical verification

**Maps:** FR-023, FR-025 plus regression safety for all upstream slices

**What**  
Run the repository-wide verification suite defined by the final audited Plan/current package scripts.

**Why**  
Slice 8 must not regress Slice 1/2/3/4/5/7 or governance tooling.

**Where**  
Repository root commands.

**Depends on**  
T845.

**How to verify**  
At minimum all exit 0:

```text
bun run typecheck
bun run guard:static
bun run db:evidence -- --no-archive
bun run openapi:generate
bun run openapi:check
bun run coverage:audit
bun run test -- --run
bun run verify-all
```

A second `openapi:generate` must be a no-op.

---

## T847 [S] — Final clean-tree / diff / scope review

**Maps:** FR-022, FR-025, FR-028, FR-029; task governance

**What**  
Mechanically inspect final changes before handing to the independent implementation audit.

**Why**  
Passing tests do not prove scope discipline or absence of unauthorized artifact edits.

**Where**  
Git diff/status only; no new implementation change unless a concrete defect is found and re-verified.

**Depends on**  
T846.

**How to verify**  
Run and review:

```text
git status --short
git diff --check
git diff --name-status <audited-development-base>...HEAD
git diff <audited-development-base>...HEAD -- Docs/ specs/008-problem-formulation-core/spec.md db/migrations/001_initial_schema.sql db/migrations/002_case_core.sql db/migrations/003_case_idempotency_key_bytes.sql db/migrations/004_evidence_core.sql db/migrations/004_identity_binding_runtime.sql db/migrations/005_case_participant_core.sql db/migrations/006_case_status_paused_removal.sql db/migrations/007_case_primary_switch.sql
```

Required final facts:

- working tree clean after the intended development commit(s);
- frozen Spec unchanged;
- `Docs/**` unchanged;
- migrations 001–007 unchanged;
- only one new migration 008;
- no out-of-scope directories/tables/routes;
- no fifth formulation public endpoint;
- generated artifacts match generator output;
- no test/static guard was broadly deleted or skipped.

Stop at:

```text
IMPLEMENTATION COMPLETE
READY FOR INDEPENDENT IMPLEMENTATION AUDIT
```

The Development AI must not declare MERGE SAFE.

---

# Dependency graph summary

```text
T801 → T802
T802 → T803
T802 → T804 [P]
T802 → T805 [P]

T803/T805 → T806 [P]
T801 → T807 [P]
T805 → T808 [P]
T801 → T809 [P]
T801 → T810 [P]

T809 → T811
T810 → T812
T807/T812 → T813
T813/T808 → T814
T803 → T815

T803/T806/T813/T815 → T816 [MIGRATION SERIAL]
T816 → T817

T811/T813/T814/T815/T817 → T818
T818 → T819 → T820 → T821 → T822 → T823 → T824

T819–T824 → T825
T812/T821–T825 → T826 → T827 → T828 → T829 → T830

T816 → T831
T827/T830 → T832
T817 → T833 → T834

T824/T826/T834 → T835 [P], T836 [P], T837 [P], T838 [P]
T835–T838 → T839 [P], T840 [P], T841 [P]
T831–T838 → T842 [P]

T834/T839–T842 → T843 [MIGRATION SERIAL]
T830/T832/T839–T842 → T844
T843/T844 → T845 → T846 → T847
```

Tasks marked `[P]` are safe to run concurrently only where the graph allows and their listed files do not overlap. If implementation consolidates two planned test files or code locations, those tasks automatically become serial.
