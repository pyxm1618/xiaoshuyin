# Slice 19 Planning Checklist — Professional Retrieval PostgreSQL 18 / pgvector Readiness

Purpose: independent completeness and audit checklist for Slice 19. This is not a task sequence.

Repository: pyxm1618/xiaoshuyin
Frozen Spec: 9c02823268c564bde15bc7cd7caf76fa43164ca2
Frozen Spec blob: 5bba922dbf93ed4f376d21f1a30124247b33f7fb
Planning branch: plan/019-professional-retrieval-pgvector-readiness

## A. Frozen Spec Fidelity

- [x] Selected Slice remains 019-professional-retrieval-pgvector-readiness.
- [x] Responsibility remains bounded PostgreSQL 18 / pgvector dense-vector readiness.
- [x] PostgreSQL major remains 18; no database-major migration is planned.
- [x] pgvector READY is not RAG READY.
- [x] pgvector READY does not select candidate A, B or C.
- [x] Exact pgvector minor/patch is evidence, not permanent product authority.
- [x] No HNSW/IVFFlat requirement is introduced.
- [x] No production Knowledge embedding schema is introduced.
- [x] No user-facing API or AI behavior is introduced.
- [x] Frozen Spec blob remains exact.

## B. Authority Integrity

- [x] Current origin/main re-read from GitHub remote.
- [x] Four Authority Docs re-read and blobs verified.
- [x] Slice 16 Frozen Intervention authority re-read.
- [x] Slice 17 Frozen Professional Knowledge authority re-read.
- [x] Slice 18 Frozen Gold Dataset authority re-read.
- [x] Slice 19 copies none of those truth owners.
- [x] No competing Slice 19 spec/plan/implementation authority exists.
- [x] No Authority Doc mutation is planned.
- [x] No upstream Frozen artifact mutation is planned.
- [x] Input Drift classified as NONE at planning start.

## C. Repository Format Discovery

- [x] db/schema inspected as canonical Drizzle schema location.
- [x] db/migrations inspected as reviewed persistent schema history.
- [x] db/init inspected as privileged Stage A bootstrap seam.
- [x] scripts/db-migrate.mjs inspected as canonical migration runner.
- [x] scripts/db-evidence.mjs inspected as existing DB evidence seam.
- [x] scripts/guard-static.mjs inspected as canonical static/scope guard.
- [x] scripts/verify-all.mjs inspected as canonical exact-head verification runner.
- [x] .github/workflows/ci.yml inspected.
- [x] PostgreSQL 18 CI service baseline verified.
- [x] existing role bootstrap verified.
- [x] tests/db role/RLS conventions inspected.
- [x] no existing pgvector readiness owner found.
- [x] no second bootstrap/readiness framework is planned.

## D. PostgreSQL 18 Baseline

- [x] Stage A CI is already real PostgreSQL 18.
- [x] Actual server_version/server_version_num must be queried.
- [x] Major other than 18 prevents READY.
- [x] Unknown server version prevents READY.
- [x] No upgrade, downgrade or database replacement is planned.
- [x] PostgreSQL patch changes require fresh evidence, not authority rewrite.

## E. Real pgvector Extension

- [x] CI will use an actual pgvector-enabled PostgreSQL 18 image.
- [x] Image source must be official pgvector upstream packaging.
- [x] Image must be pinned to a stable explicit pgvector version.
- [x] Image must also be pinned to immutable digest.
- [x] Actual extension availability must be queried from PostgreSQL.
- [x] Actual extension installation must be queried from pg_extension.
- [x] Exact extversion must be recorded.
- [x] CREATE EXTENSION success alone is insufficient for READY.
- [x] No mock/fake vector implementation can satisfy READY.
- [x] No package/image tag alone can satisfy READY.

## F. Extension Lifecycle Semantics

- [x] extension unavailable maps to UNAVAILABLE.
- [x] extension available but not installed after sanctioned setup maps to BLOCKED.
- [x] installation/enablement denied remains distinguishable.
- [x] unknown extension version maps to UNKNOWN.
- [x] environment unreachable maps to UNKNOWN.
- [x] PostgreSQL major mismatch maps to BLOCKED.
- [x] vector type failure maps to BLOCKED.
- [x] insert failure maps to BLOCKED.
- [x] read-back mismatch maps to BLOCKED.
- [x] distance execution/ordering failure maps to BLOCKED.
- [x] not checked maps to NOT_EVALUATED.
- [x] READY requires every required predicate.
- [x] no boolean-only failure collapse is allowed.

## G. Vector Capability Probe

- [x] probe uses real PostgreSQL 18 + pgvector.
- [x] probe uses vector(3).
- [x] probe uses deterministic synthetic vectors only.
- [x] vector type is actually created/used in TEMP scope.
- [x] insert is actually executed.
- [x] read-back is actually verified.
- [x] dimensionality/value semantics are verified.
- [x] exact distance operation is actually executed.
- [x] expected order is checked.
- [x] expected distances are checked.
- [x] invalid vector dimension is a known-bad real DB test.
- [x] probe state is temporary and leaves no permanent business table.
- [x] no embedding/model network call is used.

## H. Environment Identity and Stage Isolation

- [x] current READY target is STAGE_A_CI_INTEGRATION only.
- [x] evidence binds exact repository commit.
- [x] evidence binds exact GitHub run id.
- [x] evidence binds exact run attempt.
- [x] evidence binds exact environment kind/id.
- [x] evidence binds exact image ref/digest.
- [x] evidence binds exact PostgreSQL version.
- [x] evidence binds exact pgvector version.
- [x] evidence includes checked_at.
- [x] evidence includes evidence_ref.
- [x] Stage A local does not inherit CI readiness.
- [x] Stage B does not inherit Stage A readiness.
- [x] Stage C does not inherit Stage A/B readiness.
- [x] stale/different-Head evidence is rejected.
- [x] wrong-stage/wrong-environment evidence is rejected.
- [x] no Stage B/C provisioning is planned.

## I. Security and DB Role Boundary

- [x] extension enablement is separated from runtime use.
- [x] extension enablement uses privileged bootstrap authority.
- [x] runtime probe uses DATABASE_URL / xiaoshuyin_app.
- [x] xiaoshuyin_app remains non-superuser.
- [x] xiaoshuyin_app remains NOBYPASSRLS.
- [x] xiaoshuyin_app remains non-owner.
- [x] xiaoshuyin_app has no public schema CREATE.
- [x] no runtime CREATE EXTENSION is allowed.
- [x] xiaoshuyin_migrator role semantics are not expanded for convenience.
- [x] no BYPASSRLS grant is introduced.
- [x] no RLS policy is weakened or disabled.
- [x] existing Authorization remains unchanged.
- [x] existing role/RLS regression remains mandatory.
- [x] no public PostgreSQL exposure is introduced.
- [x] no secrets enter evidence.

## J. Data and Persistence Boundary

- [x] only synthetic deterministic vector values are used.
- [x] no family/minor data is used.
- [x] no household chat is used.
- [x] no production Professional Knowledge body is used.
- [x] no Gold Dataset label/case is used.
- [x] no knowledge_items table is used by the probe.
- [x] no knowledge_embeddings table is created.
- [x] no permanent probe table is created.
- [x] readiness evidence is not a business source of truth.
- [x] no generic readiness registry is created.

## K. Explicit Non-Goals / Scope Guard

- [x] no sparsevec.
- [x] no DashScope dense+sparse.
- [x] no pg_jieba.
- [x] no professional dictionary.
- [x] no pg_textsearch.
- [x] no embedding adapter/model call.
- [x] no reranker.
- [x] no A/B/C retrieval implementation.
- [x] no RRF/fusion.
- [x] no Gold Dataset execution/scoring.
- [x] no Recall/nDCG/MRR.
- [x] no Promptfoo RAG Eval.
- [x] no Context Builder.
- [x] no AI Task Runtime.
- [x] no TaskModelRegistry/provider execution.
- [x] no reviewer/staff authority.
- [x] no generic vector/RAG/platform service.
- [x] no HNSW/IVFFlat tuning.
- [x] no production business migration.
- [x] no package dependency/lockfile change.

## L. Non-Vacuous Validation

- [x] happy-path real DB test is required.
- [x] PG17 known-bad sample exists.
- [x] unknown PostgreSQL version sample exists.
- [x] extension unavailable sample exists.
- [x] extension not enabled sample exists.
- [x] install-denied sample exists.
- [x] unknown pgvector version sample exists.
- [x] vector type failure sample exists.
- [x] invalid vector sample exists.
- [x] insert failure sample exists.
- [x] read mismatch sample exists.
- [x] distance failure sample exists.
- [x] wrong ordering sample exists.
- [x] environment unreachable sample exists.
- [x] wrong environment evidence sample exists.
- [x] missing version/Head evidence sample exists.
- [x] fake/mock evidence sample exists.
- [x] stage leakage sample exists.
- [x] runtime privilege escalation sample exists.
- [x] forbidden dependency/path sample exists.
- [x] static guard self-test must fail when the expected rule is bypassed.
- [x] tests cannot manufacture READY without a real DB probe.

## M. CI and Canonical Verification

- [x] db-migrate and integration DB service images are aligned.
- [x] privileged extension bootstrap runs before migrations.
- [x] integration uses the existing runtime/migrator/admin separation.
- [x] pgvector readiness is added to canonical verify-all.
- [x] historical verify-all gates are not deleted or weakened.
- [x] readiness JSON is uploaded with existing exact-head evidence artifact.
- [x] typecheck remains required.
- [x] targeted Vitest remains required.
- [x] full regression remains required.
- [x] role/RLS regression remains required.
- [x] static guard remains required.
- [x] static guard self-test remains required.
- [x] governance validation remains required.
- [x] governance self-test remains required.

## N. Exact-head Integrity

- [x] final base/head/merge-base/ahead/behind must be recorded.
- [x] every final test must run against the same exact Head.
- [x] readiness artifact repository_commit must equal that Head.
- [x] workflow run id/attempt must be recorded.
- [x] evidence from an older commit cannot be combined into final PASS.
- [x] evidence from another environment cannot be combined into final PASS.
- [x] changed-file set must remain within planned implementation delta.
- [x] Frozen Spec blob must be re-read at development start and Audit 2 handoff.

## O. Development-start Gate

- [x] T1901 is the first task.
- [x] T1901 is READ-ONLY.
- [x] T1901 re-reads current origin/main.
- [x] T1901 verifies Frozen Spec exact blob.
- [x] T1901 verifies Planning Freeze exact head.
- [x] T1901 re-reads four Authority Docs.
- [x] T1901 checks competing Slice 19 authority.
- [x] T1901 checks equivalent readiness implementation already merged.
- [x] T1901 checks PostgreSQL 18 baseline still real.
- [x] T1901 checks role/RLS security contracts still real.
- [x] T1901 checks scope remains implementable without drift.
- [x] any semantic conflict returns READY FOR DEVELOPMENT = NO and STOP.

## P. Audit 1

- [x] Q1 Frozen Spec Fidelity reviewed.
- [x] Q2 Scope Convergence reviewed.
- [x] Q3 Authority Preservation reviewed.
- [x] Q4 Dependency Truth reviewed.
- [x] Q5 Environment Truth reviewed.
- [x] Q6 pgvector Capability Proof reviewed.
- [x] Q7 Security / Role Integrity reviewed.
- [x] Q8 Failure Semantics reviewed.
- [x] Q9 Validation Non-Vacuity reviewed.
- [x] Q10 Implement Gate Truthfulness reviewed.
- [x] CRITICAL findings = 0.
- [x] HIGH findings = 0.
- [x] MEDIUM findings = 0.
- [x] LOW requiring Developer guesswork = 0.

## Q. Planning Freeze / Audit 2 Handoff

- [x] final plan.md exists.
- [x] final checklist.md exists.
- [x] final tasks.md exists.
- [x] spec.md is unchanged.
- [x] final planning branch is based on the Frozen Spec commit.
- [x] final changed files are spec.md + the three planning artifacts relative to main.
- [x] final Plan/Checklist/Tasks blobs must be read back remotely.
- [x] current origin/main must be re-read before freeze.
- [x] four Authority Doc blobs must be re-read before freeze.
- [x] competing branches must be rechecked.
- [x] Scope Drift must remain 0.
- [x] Audit 1 must remain FINAL PASS.
- [x] Audit 2 handoff contract includes exact base/head/Frozen blob/versions/environment/probe/security/tests/scope/full regression.
