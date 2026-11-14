# Slice 19 Tasks — Professional Retrieval PostgreSQL 18 / pgvector Readiness Foundation

Repository: pyxm1618/xiaoshuyin
Planning branch: plan/019-professional-retrieval-pgvector-readiness
Frozen Spec commit: 9c02823268c564bde15bc7cd7caf76fa43164ca2
Frozen Spec blob: 5bba922dbf93ed4f376d21f1a30124247b33f7fb

Execution rule:
- Tasks are ordered.
- T1901 is READ-ONLY and gates every implementation edit.
- T1902+ may execute only when T1901 returns READY FOR DEVELOPMENT = YES.
- No task may modify Frozen Spec, Authority Docs or upstream Slice artifacts.
- Any STOP condition ends Slice 19 development and returns for authority/planning reconciliation.

## T1901 — Development-start Authority / Implement Gate

Goal:
Re-establish exact remote truth immediately before development and decide whether implementation is still authorized.

Prerequisites:
- Planning Freeze exists.
- Audit 1 = FINAL PASS.
- No implementation edit has started.

Inputs:
- current origin/main;
- Frozen Spec branch/commit/blob;
- final Planning Freeze head and Plan/Checklist/Tasks blobs;
- four Authority Docs;
- Slice 16–18 Frozen authority;
- current CI/DB role/RLS baseline;
- current repository tree/branches.

Behavior:
READ-ONLY only.
Re-read and verify:
1. current origin/main;
2. Frozen Spec exact blob = 5bba922dbf93ed4f376d21f1a30124247b33f7fb;
3. Planning Freeze exact head and all three planning blobs;
4. four Authority Docs and semantic compatibility;
5. Slice 16 Intervention owner remains separate;
6. Slice 17 Knowledge owner remains separate;
7. Slice 18 Gold Dataset owner remains separate;
8. no competing Slice 19 authority;
9. no semantically equivalent pgvector readiness implementation already merged;
10. PostgreSQL 18 remains the executable CI baseline;
11. Migrator/Runtime separation remains real;
12. Runtime remains non-owner and NOBYPASSRLS;
13. RLS security contract is not replaced;
14. expected implementation delta remains sufficient;
15. no scope item has become impossible without changing Frozen semantics.

Forbidden:
- any repository write;
- implementation code;
- branch rewrite/rebase;
- modifying planning to fit semantic drift;
- silently accepting an equivalent second owner.

Verification:
Produce an implement-gate matrix with PASS/FAIL for all 15 checks and classify any main movement as benign execution drift or semantic/input/authority drift.

Evidence:
- exact main SHA;
- exact planning head;
- exact Frozen blob;
- Authority Doc blobs;
- competing-branch search;
- current CI PostgreSQL service evidence;
- current role/RLS file refs.

FR / AS / NS Mapping:
FR-001, FR-002, FR-003, FR-004
AS-029, AS-030
NS-21

STOP Conditions:
- Frozen Spec blob changed;
- Authority semantic conflict;
- competing Slice 19 owner;
- equivalent implementation already merged and cannot be proven identical owner;
- PostgreSQL 18 no longer baseline;
- DB role/RLS security model changed materially;
- implementation requires scope outside Frozen Spec.

Output:
READY FOR DEVELOPMENT = YES only if every gate passes.
Otherwise READY FOR DEVELOPMENT = NO / STOP.

## T1902 — Establish the Real PostgreSQL 18 + pgvector CI Substrate

Goal:
Replace the plain CI PostgreSQL service with an actual pgvector-enabled PostgreSQL 18 service without turning the image version into product authority.

Prerequisites:
T1901 PASS.

Inputs:
- .github/workflows/ci.yml;
- official pgvector upstream release/image metadata;
- PostgreSQL 18 requirement;
- D19-02.

Behavior:
1. Resolve the current stable non-prerelease official pgvector release supporting PostgreSQL 18.
2. Use official pgvector/pgvector packaging.
3. Use the PG18 trixie line unless official support evidence says it is unavailable.
4. Resolve the immutable image digest.
5. Pin semantic version + immutable digest.
6. Apply exactly the same image ref to db-migrate and integration jobs.
7. Make the exact image ref available to readiness evidence.
8. Preserve existing PostgreSQL database/user/password fixture semantics.

Forbidden:
- plain postgres:18 for the two target CI jobs after completion;
- latest-only or floating pgvector tag;
- community image when official image is available;
- changing PostgreSQL major;
- adding sparsevec-specific tests;
- adding pg_jieba;
- adding package dependencies;
- changing docker-compose.stage-a.yml in this Slice.

Verification:
- static CI contract test sees identical immutable pgvector PG18 image refs in both jobs;
- image tag is explicit stable version;
- digest is present;
- no PostgreSQL major change.

Evidence:
- exact image reference;
- official upstream provenance used for selection;
- CI contract test output.

FR / AS / NS Mapping:
FR-003, FR-012, FR-014, FR-016, FR-039
AS-001, AS-004
NS-03, NS-07, NS-20

STOP Conditions:
- official PG18 pgvector packaging cannot be verified;
- no immutable digest can be resolved;
- only a PostgreSQL major other than 18 is supported;
- implementation would require an unapproved custom database platform.

## T1903 — Add Privileged pgvector Extension Bootstrap

Goal:
Enable the vector extension through the existing privileged Stage A bootstrap seam while keeping runtime and migrator authority unchanged.

Prerequisites:
T1902 complete.

Inputs:
- db/init/01-roles.sh;
- new db/init/02-pgvector.sh;
- CI admin PostgreSQL context.

Behavior:
Create db/init/02-pgvector.sh that:
1. requires explicit privileged PostgreSQL environment;
2. connects as the approved Stage A admin path;
3. verifies PostgreSQL major 18;
4. queries pg_available_extensions for vector;
5. fails distinctly if unavailable;
6. executes CREATE EXTENSION IF NOT EXISTS vector;
7. reads exact extversion from pg_extension;
8. emits sanitized setup output;
9. is idempotent;
10. grants no new privilege to xiaoshuyin_app or xiaoshuyin_migrator.

Wire the script in both CI DB jobs after role bootstrap and before migration/readiness work.

Forbidden:
- runtime DATABASE_URL for CREATE EXTENSION;
- granting SUPERUSER or BYPASSRLS;
- making xiaoshuyin_app/xiaoshuyin_migrator extension owner for convenience;
- editing db/migrations;
- creating a generic extension manager.

Verification:
- extension bootstrap succeeds in real CI;
- unavailable and denied setup paths are distinguishable;
- repeated execution is safe;
- roles regression remains unchanged.

Evidence:
- setup log with PostgreSQL major and exact extversion, no secrets;
- CI ordering proof;
- roles test output.

FR / AS / NS Mapping:
FR-012, FR-013, FR-014, FR-024, FR-025, FR-026
AS-001, AS-005
NS-18, NS-19, NS-21

STOP Conditions:
- privileged setup requires changing application runtime privilege;
- extension installation can only be made to work by weakening RLS/security;
- current main already contains a different canonical extension bootstrap owner.

## T1904 — Implement Narrow Readiness Evidence / Status Contract

Goal:
Create a bounded machine-readable contract that classifies actual pgvector readiness without becoming a generic capability registry.

Prerequisites:
T1901 PASS; plan status semantics unchanged.

Inputs:
- Frozen Spec §19/§21/FR-036..040;
- scripts/lib/pgvector-readiness.mjs;
- evidence fields defined in Plan D19-06/07.

Behavior:
Implement the narrow helper that:
1. accepts one environment-bound probe result;
2. validates exact required evidence fields;
3. produces only READY/BLOCKED/UNAVAILABLE/UNKNOWN/NOT_EVALUATED;
4. preserves reason codes;
5. rejects READY unless probe_mode = REAL_DATABASE;
6. rejects stale/wrong commit identity;
7. rejects missing/unpinned image identity;
8. rejects wrong environment identity;
9. rejects elevated runtime role evidence;
10. rejects incomplete probe predicates;
11. does not perform vector math in JavaScript as a replacement for DB proof.

Required reason semantics include:
POSTGRES_MAJOR_MISMATCH
POSTGRES_VERSION_UNKNOWN
PGVECTOR_NOT_AVAILABLE
PGVECTOR_ENABLE_FAILED
PGVECTOR_VERSION_UNKNOWN
VECTOR_TYPE_UNAVAILABLE
VECTOR_INSERT_FAILED
VECTOR_READBACK_FAILED
VECTOR_DISTANCE_QUERY_FAILED
ROLE_OR_PERMISSION_INVALID
ENVIRONMENT_UNREACHABLE
EVIDENCE_INCOMPLETE

Additional narrow reason codes may be added only when they refine these semantics without creating new product authority.

Forbidden:
- generic readiness/capability registry;
- boolean-only status;
- model/provider concepts;
- business truth;
- fake vector implementation.

Verification:
architecture/evidence tests cover every status and known-bad payload.

Evidence:
test output plus final evidence-schema example generated by real probe.

FR / AS / NS Mapping:
FR-005, FR-006, FR-008, FR-027, FR-036, FR-037, FR-038, FR-039, FR-040
AS-018, AS-019, AS-027
NS-22

STOP Conditions:
- status contract requires changing Frozen semantics;
- evidence owner expands into business/runtime registry.

## T1905 — Implement the Real Runtime pgvector Capability Probe

Goal:
Prove real dense-vector capability through the existing minimum-privilege runtime role.

Prerequisites:
T1902–T1904 complete; extension installed in target CI DB.

Inputs:
- DATABASE_URL for xiaoshuyin_app;
- exact environment identity;
- exact image ref;
- scripts/pgvector-readiness.mjs;
- helper from T1904.

Behavior:
The script must:
1. connect to PostgreSQL through DATABASE_URL;
2. query actual server version and major;
3. query vector availability/install/version;
4. query current runtime role/security facts;
5. require xiaoshuyin_app, non-superuser, NOBYPASSRLS, no public schema CREATE;
6. begin an isolated transaction/session;
7. create a TEMP table with vector(3);
8. insert origin [0,0,0], near [1,0,0], far [3,0,0];
9. read vectors back and confirm dimensions/values;
10. execute pgvector exact L2 distance query from [0,0,0];
11. assert order origin, near, far;
12. assert distances 0,1,3 within a small tolerance;
13. clean up temporary state;
14. write sanitized evidence JSON;
15. exit 0 only for READY; otherwise exit non-zero with truthful status/reasons.

Forbidden:
- CREATE EXTENSION;
- permanent table;
- family/child/professional data;
- Knowledge/Gold dataset;
- network model/provider call;
- TypeScript/JavaScript vector-distance imitation as readiness proof.

Verification:
real DB test and direct script execution against the target CI DB.

Evidence:
pgvector-readiness.json and command output.

FR / AS / NS Mapping:
FR-009..026, FR-036, FR-038..040
AS-001, AS-006..013, AS-028
NS-01, NS-02, NS-04, NS-05, NS-06, NS-11

STOP Conditions:
- runtime can pass only with elevated privilege;
- actual pgvector operations cannot be executed;
- probe needs real business data;
- probe needs permanent Knowledge schema.

## T1906 — Bind Readiness Evidence to the Exact CI Environment

Goal:
Make the readiness artifact auditably tied to one exact GitHub Actions environment/run/head.

Prerequisites:
T1905 functional.

Inputs:
- .github/workflows/ci.yml;
- GitHub Actions run metadata;
- PGVECTOR readiness environment inputs.

Behavior:
In integration job supply:
- stage = STAGE_A;
- environment_kind = CI_INTEGRATION;
- deterministic environment_id derived from repository/run id/run attempt;
- GITHUB_SHA / exact checked-out Head;
- exact pinned image ref;
- output path in runner temp.

Add readiness JSON to the existing verify-all artifact upload.

Do not create a new persistent readiness service or source-controlled current-status file.

Forbidden:
- reusing old artifact;
- manually entered READY flag;
- copying Stage A status to B/C;
- embedding secrets;
- artifact not bound to exact Head.

Verification:
CI contract test checks metadata inputs and artifact inclusion.
Evidence validator checks exact identity.

Evidence:
artifact name/ref, run id, attempt, SHA, image ref.

FR / AS / NS Mapping:
FR-005, FR-006, FR-012..016, FR-027, FR-039, FR-040
AS-019
NS-22

STOP Conditions:
- CI cannot bind evidence to exact checkout;
- artifact would expose credentials;
- output cannot be retained with exact-head verification.

## T1907 — Add Real Database Capability Tests

Goal:
Make READY depend on actual pgvector behavior, not metadata-only assertions.

Prerequisites:
T1905 complete.

Inputs:
- tests/db/pgvector-readiness.test.ts;
- real CI DB.

Behavior:
Tests must use actual database connections and cover:
- PG18 server major;
- extension installed/version;
- vector type;
- insert/read;
- deterministic L2 query/order/distances;
- invalid dimension rejection;
- TEMP relation cleanup.

Tests must not mock pg or vector operators.

Forbidden:
- in-memory vector simulation;
- stubbed extension metadata;
- string-only fake evidence.

Verification:
targeted Vitest against the real pgvector-enabled DB.

Evidence:
Vitest output showing real DB tests.

FR / AS / NS Mapping:
FR-009, FR-010, FR-017..023, FR-036
AS-001, AS-007..013
NS-22

STOP Conditions:
- tests pass without a real database;
- tests can pass against plain postgres without vector.

## T1908 — Add Failure-Semantics and Known-Bad Evidence Tests

Goal:
Prove the classifier/validator is non-vacuous and preserves Frozen failure distinctions.

Prerequisites:
T1904 complete.

Inputs:
- tests/architecture/pgvector-readiness-evidence.test.ts.

Behavior:
Add synthetic evidence fixtures for:
- PostgreSQL 17;
- PostgreSQL version unknown;
- extension unavailable;
- extension available but not enabled;
- setup denied;
- extension version unknown;
- vector type failure;
- insert failure;
- read mismatch;
- distance execution failure;
- wrong distance order;
- environment unreachable;
- missing Head;
- wrong Head;
- missing/float image ref;
- wrong stage/environment;
- MOCK probe mode;
- runtime superuser;
- runtime BYPASSRLS;
- runtime schema CREATE;
- partial success.

Every fixture must assert the exact non-READY status/reason or validation rejection.

Forbidden:
- using synthetic fixtures as production READY evidence;
- collapsing all failures to false/NOT_READY.

Verification:
targeted architecture test must fail if any required predicate is removed from READY gating.

Evidence:
test matrix output.

FR / AS / NS Mapping:
FR-008, FR-010, FR-011, FR-015, FR-036..040
AS-002..011, AS-018, AS-019, AS-027
NS-22

STOP Conditions:
- a missing/failed required predicate can still produce READY;
- failure classes cannot be represented without rewriting Frozen Spec.

## T1909 — Verify Security / Role / RLS Preservation

Goal:
Prove Slice 19 adds no privilege escalation or RLS weakening.

Prerequisites:
T1903/T1905 complete.

Inputs:
- existing tests/db/roles.test.ts;
- existing RLS tests;
- real readiness evidence.

Behavior:
Run and preserve existing role/RLS regression.
Add only Slice 19 assertions needed to prove:
- current runtime role is xiaoshuyin_app;
- runtime rolsuper=false;
- runtime rolbypassrls=false;
- runtime public schema CREATE=false;
- extension owner is not xiaoshuyin_app;
- no new public-schema permanent probe relation exists.

Forbidden:
- editing existing RLS policy to make probe pass;
- runtime owner/BYPASSRLS/superuser;
- broad new database grants.

Verification:
roles/RLS tests + readiness evidence security block.

Evidence:
exact role query outputs and existing regression output.

FR / AS / NS Mapping:
FR-024, FR-025, FR-026
AS-014, AS-015
NS-21

STOP Conditions:
- any security regression;
- capability works only after privilege expansion.

## T1910 — Prove Stage Isolation and Stale-Evidence Rejection

Goal:
Prevent one environment or run from inheriting another environment’s READY claim.

Prerequisites:
T1904/T1906 complete.

Inputs:
- evidence validator;
- CI metadata contract.

Behavior:
Tests must prove:
- Stage A CI evidence is one environment only;
- changing environment_id invalidates reuse;
- changing repository_commit invalidates reuse;
- changing image ref/version requires fresh evidence;
- Stage B absent remains NOT_EVALUATED conceptually;
- Stage C documentation/support does not create READY evidence;
- no function copies READY across stages.

Forbidden:
- shared global READY flag;
- environment-agnostic evidence;
- latest/current alias as evidence identity.

Verification:
architecture tests with stale/wrong-stage samples.

Evidence:
test output and final artifact identity.

FR / AS / NS Mapping:
FR-005, FR-006, FR-007, FR-008, FR-016, FR-039
AS-016, AS-017, AS-019

STOP Conditions:
- validator cannot distinguish environments;
- CI evidence lacks exact environment/run identity.

## T1911 — Extend Existing Static Scope Guard

Goal:
Mechanically reject Slice 19 scope creep without creating another guard framework.

Prerequisites:
T1901 PASS.

Inputs:
- scripts/guard-static.mjs;
- existing --self-test mechanism.

Behavior:
Add a narrow Slice 19 boundary rule and synthetic self-tests that catch:
- knowledge_embeddings schema;
- packages/rag/packages/ai implementation for this Slice;
- sparsevec;
- pg_jieba;
- pg_textsearch;
- model/provider/embedding/reranker adapter imports;
- RRF/fusion retrieval;
- HNSW/IVFFlat;
- permanent readiness registry/table;
- runtime CREATE EXTENSION;
- runtime SUPERUSER/BYPASSRLS grants.

Preserve all existing guard rules.

Forbidden:
- deleting/weakening earlier guards;
- a new parallel static-guard framework;
- broad bans that silently redefine future product authority.

Verification:
- bun run guard:static;
- node scripts/guard-static.mjs --self-test;
- known-bad fixtures demonstrably hit the expected rule.

Evidence:
guard output + self-test fixture count.

FR / AS / NS Mapping:
FR-001, FR-002, FR-004, FR-022, FR-023, FR-026, FR-028..035
AS-013, AS-020..026, AS-028
NS-01..22

STOP Conditions:
- scope protection requires changing Frozen Spec;
- existing guard architecture cannot be extended without breaking prior owners.

## T1912 — Integrate with Canonical verify-all

Goal:
Make pgvector readiness part of the repository’s existing exact-head final verification rather than a side command.

Prerequisites:
T1905–T1911 green.

Inputs:
- scripts/verify-all.mjs;
- canonical CI environment.

Behavior:
Append a new pgvector readiness final gate to existing verify-all.
Preserve historical verification rows/gates.
The new gate runs:
- real readiness command;
- required targeted tests if not already covered by canonical full suite;
- failure propagation.

It must use the same exact checkout and DB environment as the rest of canonical integration verification.

Forbidden:
- separate competing final-verification runner;
- deleting historical gates;
- treating a non-zero readiness result as warning.

Verification:
canonical node scripts/verify-all.mjs exits 0 only when all existing gates and Slice 19 readiness pass.

Evidence:
verify-all log containing pgvector readiness gate.

FR / AS / NS Mapping:
All FR-001..040 as final composition coverage.
All AS-001..030 through designated tests/gates.
All NS-01..22 through scope and negative tests.

STOP Conditions:
- readiness cannot be integrated without weakening canonical verification;
- verify-all can pass when readiness is non-READY.

## T1913 — Exact-head Full Validation / Convergence

Goal:
Converge the implementation to one exact final Head with no mixed-commit evidence.

Prerequisites:
T1902–T1912 complete.

Inputs:
- final candidate Head;
- current origin/main;
- all targeted/full commands.

Behavior:
On one exact Head:
1. record base/head/merge-base/ahead/behind;
2. verify changed-file set;
3. run typecheck;
4. run targeted architecture tests;
5. run real DB pgvector test;
6. run real readiness command;
7. run guard-static;
8. run guard-static self-test;
9. run roles/RLS regression;
10. run canonical verify-all;
11. run governance validation;
12. run governance self-test;
13. confirm readiness JSON repository_commit equals exact Head;
14. confirm artifact comes from the same run/attempt;
15. confirm no forbidden files or dependencies changed.

Forbidden:
- combining green results from earlier Head;
- amending final Head after evidence without rerun;
- accepting dirty generated/provenance state.

Verification:
all commands PASS on the same SHA.

Evidence:
exact-head validation matrix.

FR / AS / NS Mapping:
All Frozen requirements by composition.

STOP Conditions:
- any command fails;
- Head changes after evidence;
- changed-file scope drifts;
- readiness artifact does not bind exact final Head.

## T1914 — Evidence Freeze / Audit 2 Handoff

Goal:
Produce a zero-guess handoff for an independent Audit 2 AI and stop development.

Prerequisites:
T1913 exact-head convergence PASS.

Inputs:
- exact final Head and base;
- Frozen Spec identity;
- readiness artifact;
- test/CI/governance evidence.

Behavior:
Freeze and report:
- repository;
- exact base;
- exact final Head;
- merge base;
- ahead/behind;
- Frozen Spec commit/blob;
- four Authority Doc blobs;
- changed files;
- image tag + digest;
- actual PostgreSQL server version;
- actual pgvector extversion;
- environment stage/kind/id;
- workflow run id/attempt;
- extension bootstrap evidence;
- runtime role/security evidence;
- vector type/insert/read/distance evidence;
- invalid-vector evidence;
- final readiness status/reasons;
- guard/static evidence;
- targeted tests;
- full verify-all;
- governance checks;
- artifact name/ref.

Explicitly state:
pgvector READY does not mean RAG READY and selects no A/B/C candidate.

Forbidden:
- merge;
- Audit 2;
- additional implementation after evidence freeze;
- rewriting evidence after Head freeze.

Verification:
remote read-back of exact final Head and evidence references.

Evidence:
final Developer report + CI artifact.

FR / AS / NS Mapping:
FR-001, FR-027, FR-039, FR-040
NS-22

STOP Conditions:
- remote Head drift;
- missing exact evidence;
- any final gate not PASS.

Final output:
READY FOR INDEPENDENT AUDIT 2
STOP.
