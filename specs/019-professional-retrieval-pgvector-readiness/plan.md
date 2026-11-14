# Slice 19 Implementation Plan — Professional Retrieval PostgreSQL 18 / pgvector Readiness Foundation

Role: Slice 19 Plan AI 2 — Plan + Checklist + Tasks + Audit 1 only
Repository: pyxm1618/xiaoshuyin
Planning branch: plan/019-professional-retrieval-pgvector-readiness
Planning base: 9c02823268c564bde15bc7cd7caf76fa43164ca2
Frozen Spec commit: 9c02823268c564bde15bc7cd7caf76fa43164ca2
Frozen Spec blob: 5bba922dbf93ed4f376d21f1a30124247b33f7fb
Execution context: REMOTE-ONLY / GitHub authoritative remote
Planning status: COMPLETE subject to Audit 1 and final remote read-back

## 1. Authority Gate

Plan AI 2 re-read the current remote rather than trusting handoff values.

| Authority | Exact remote truth | Result |
|---|---|---|
| origin/main | e7bb22d1abad58a6c9df6350744f092d88370aa3 | PASS |
| Frozen Spec branch | spec/019-professional-retrieval-pgvector-readiness | PASS |
| Frozen Spec commit | 9c02823268c564bde15bc7cd7caf76fa43164ca2 | PASS |
| Frozen Spec blob | 5bba922dbf93ed4f376d21f1a30124247b33f7fb | PASS |
| Frozen Spec vs main | ahead 1 / behind 0; spec.md only | PASS |
| Docs/总产品需求.md | 67724000cb9bb81c40489c04db28d899bd1df74c | PASS |
| Docs/V1产品需求.md | 1900485a407e0634643f4f0bbe5ab02476dc4bfd | PASS |
| Docs/总体技术架构.md | 9b08371edc976fa281469dfee8dc19962452e3b0 | PASS |
| Docs/V1技术设计.md | 6f03d1a3c49bdc866945ae7f82df542f1292a147 | PASS |

No Authority Doc mutation is authorized.

### 1.1 Consumed Frozen Authority

Slice 16:
- Frozen Spec commit 05aa4594cbb99c433035f9fa313376a7fec99785
- Frozen Spec blob a6cd9fd723f9339b575757279703be554afaf0f6
- Planning Freeze 40d6c4e19b9207b287aec03c5ba02868260dd8fe
- plan blob f3d47ab301cda9668811eb6b1748ef1685c67c39
- checklist blob 04da0caf0732a5e99aef248cc807b9db1cb2f1b5
- tasks blob 30e08b93746b9d40a631ec5ce81c0cf4406bd090
- consumed meaning: InterventionDefinition and deterministic Intervention eligibility remain Slice 16 truth. RAG and pgvector cannot replace that truth.

Slice 17:
- Frozen Spec commit a345937868ca1b8d2cef65003d4197de4207eb52
- Frozen Spec blob 866c3f77dd269c94d420d9c0ae6b918f114286ce
- sole planning authority branch plan/017-professional-knowledge-foundation
- Planning Freeze a1d4e4390d313502696493573243adf401dbae90
- plan blob 117ee8c5ef34230984f693cdc31443ee0be0d848
- checklist blob b46b8993c771d41cd9e03a36d7722b638c0282fa
- tasks blob 395fcdb51f9fde3716e27b27193b0b8cfa3c8834
- consumed meaning: Professional Knowledge Item/version/review/publication truth remains Slice 17 truth. Slice 19 creates no Knowledge store or embedding lifecycle.

Slice 18:
- Frozen Spec commit 4624b3df6d59c6055421e175b95051782615de9a
- Frozen Spec blob bf7540ff3097ef14ca1c62a395b155abd4fde66a
- Planning Freeze 9254c6bf387dd5471f7935be056c122fd5508672
- plan blob 4a773fa48d26eb8dcabc5611767a9e40a8cbdc7b
- checklist blob ca07705de0e280f233e7a8eec2d9da26eb03af54
- tasks blob 754dc21d714550503c8b18193461beaf9f414275
- consumed meaning: Gold Dataset evaluation truth remains Slice 18 truth. Slice 19 executes no retrieval benchmark and creates no scoring truth.

Historical Slice 16/17 branch topology has diverged from newer main, but their exact Frozen blobs and sole planning authorities remain intact. This is historical topology, not semantic drift.

### 1.2 Input Drift

At planning start:
- origin/main equals the Slice 19 Frozen selection baseline;
- all four Authority Doc blobs equal the Frozen Spec record;
- Slice 16–18 consumed authority blobs remain intact;
- no plan/019 branch existed before this Plan AI 2 run;
- no competing Slice 19 authority was found.

Input Drift: NONE.

Any semantic change before development to PostgreSQL major, DB role/RLS model, Slice 19 Frozen semantics, or consumed Slice 16–18 ownership is a T1901 hard STOP.

## 2. Scope Convergence

Slice 19 owns only bounded, environment-specific PostgreSQL 18 / pgvector dense-vector readiness evidence.

It does not own:
- retrieval correctness;
- A/B/C selection;
- Knowledge;
- Gold labels;
- Intervention;
- embeddings or reranking;
- sparsevec;
- pg_jieba;
- RRF/fusion;
- Context Builder;
- AI Task Runtime;
- TaskModelRegistry;
- provider execution;
- user-facing AI behavior.

The implementation target for this Slice is one exact executable environment:

STAGE_A_CI_INTEGRATION

Stage A local Docker Compose, Stage B Lighthouse, and Stage C TencentDB are not granted READY by this Slice. Unless independently checked against their own actual environment identity, they remain NOT_EVALUATED. No status is inherited across environments.

## 3. Repository Format Discovery

Current main was inspected for the actual DB, CI, test and governance owners.

### 3.1 Existing canonical seams

- .github/workflows/ci.yml
  - db-migrate and integration jobs both use plain postgres:18 today.
  - integration executes canonical scripts/verify-all.mjs on the exact checked-out Head.
  - integration uploads exact-head verification artifacts.

- db/init/01-roles.sh
  - existing privileged Stage A bootstrap seam.
  - executes with PostgreSQL admin context.
  - creates xiaoshuyin_migrator and xiaoshuyin_app.
  - runtime remains NOBYPASSRLS.

- scripts/db-migrate.mjs
  - canonical reviewed business-schema migration runner.
  - uses MIGRATION_DATABASE_URL.
  - explicitly rejects application DDL privilege.
  - no drizzle-kit push.

- db/migrations
  - canonical persistent schema history.
  - no pgvector extension migration exists.

- scripts/guard-static.mjs
  - canonical static scope/security guard.
  - already has synthetic self-tests.
  - already forbids packages/rag, packages/ai and other future-slice paths.

- scripts/verify-all.mjs
  - canonical exact-head regression/provenance runner.
  - runs DB evidence, static checks and governance commands.
  - canonical CI invocation does not dirty the tree.

- tests/db and tests/architecture
  - existing homes for real DB role/RLS behavior and architecture/scope guards.

### 3.2 No existing owner to duplicate

Current main contains no:
- CREATE EXTENSION vector;
- pgvector-enabled CI service image;
- vector capability probe;
- pgvector readiness evidence artifact;
- extension manager;
- readiness registry;
- generic RAG/vector platform.

### 3.3 Migration decision

Slice 19 SHALL NOT add a db/migrations migration merely to enable pgvector.

Reason:
- no business schema is authorized;
- extension enablement is environment/bootstrap authority, not Knowledge persistence;
- current repo already has a privileged db/init seam;
- runtime must not receive extension-install authority;
- a migration would force the non-superuser migrator path to become extension-owner infrastructure without repository evidence that this is the canonical or permitted model.

Plan decision:
- add one narrow Stage A extension bootstrap script under existing db/init;
- keep db/migrations and db/schema unchanged;
- keep xiaoshuyin_migrator and xiaoshuyin_app role semantics unchanged.

If T1901 discovers that current main has introduced a canonical extension-install owner after this Planning Freeze, Developer AI must STOP rather than create a parallel path.

## 4. Implementation Decisions

### D19-01 — Exact target environment

The only READY claim required by this implementation is for the GitHub Actions integration-job PostgreSQL instance on one exact run/attempt/commit.

Evidence identity SHALL include:
- stage = STAGE_A;
- environment kind = CI_INTEGRATION;
- repository;
- exact git Head;
- GitHub run id and run attempt;
- exact PostgreSQL server version;
- exact pgvector extension version;
- exact pgvector image reference including immutable digest;
- checked_at;
- evidence_ref.

No Stage B/C/local status is copied into the Stage A evidence.

### D19-02 — Real pgvector packaging

Replace the plain PostgreSQL service image in the CI db-migrate and integration jobs with the official pgvector PostgreSQL 18 image.

Selection rule:
1. use official pgvector/pgvector packaging;
2. PostgreSQL major must be 18;
3. use the current stable, non-prerelease pgvector release explicitly advertised by official pgvector upstream for PostgreSQL 18 at T1902;
4. use the trixie PostgreSQL 18 image line unless official upstream no longer supports it;
5. pin semantic version plus immutable image digest in CI;
6. pass that exact image reference into readiness evidence;
7. the pgvector minor/patch is implementation evidence, not permanent product authority.

Planning-time upstream observation was pgvector 0.8.7 with PostgreSQL 18 image tags. Developer must revalidate upstream packaging at T1902. If official provenance, PG18 compatibility or immutable digest cannot be established, STOP.

No package.json or lockfile dependency is needed.

### D19-03 — Privileged extension enablement

Add db/init/02-pgvector.sh as the narrow existing-bootstrap extension step.

It SHALL:
- run only with explicit privileged PostgreSQL setup credentials;
- fail closed if server major is not 18;
- query pg_available_extensions for vector;
- distinguish extension unavailable from enable failure;
- execute CREATE EXTENSION IF NOT EXISTS vector;
- query and print the exact installed extversion;
- never print credentials;
- never grant runtime superuser, BYPASSRLS, schema CREATE, database CREATE or table ownership;
- be idempotent for repeated CI bootstrap.

CI calls this script after 01-roles.sh and before migrations in both DB jobs.

It is not a generic extension manager and has no sparsevec/pg_jieba behavior.

### D19-04 — Runtime capability probe

Add scripts/pgvector-readiness.mjs plus a narrow helper scripts/lib/pgvector-readiness.mjs.

The actual probe SHALL connect through DATABASE_URL as xiaoshuyin_app.

The runtime probe SHALL NOT install the extension.

It SHALL:
1. establish connection;
2. query server_version and server_version_num;
3. require PostgreSQL major 18;
4. query pg_available_extensions and pg_extension for vector;
5. require exact installed extversion;
6. query current runtime role attributes;
7. require current_user = xiaoshuyin_app;
8. require runtime rolsuper = false;
9. require runtime rolbypassrls = false;
10. require runtime has no CREATE on public schema;
11. create only a TEMP relation with embedding vector(3);
12. insert deterministic synthetic vectors;
13. read them back and verify dimensionality/value semantics;
14. run deterministic exact L2 distance using the pgvector distance operator;
15. verify expected ordering and numeric behavior;
16. rollback/drop temp probe state through transaction/session cleanup;
17. write one machine-readable readiness evidence JSON;
18. return non-zero unless the exact environment reaches READY.

Synthetic vectors:
- origin = [0,0,0]
- near = [1,0,0]
- far = [3,0,0]
- query = [0,0,0]

Expected L2 order:
origin, near, far

Expected distances:
0, 1, 3, checked with a small numeric tolerance.

The probe must use actual pgvector SQL. No mock/fake/string emulation can satisfy READY.

### D19-05 — Probe data boundary

All vector values are synthetic deterministic test values.

The probe SHALL NOT:
- read or write family/minor data;
- read or write knowledge_items;
- create knowledge_embeddings;
- consume Gold Dataset;
- call any model/provider;
- persist a permanent business table.

TEMP data is infrastructure evidence only and disappears with the session/transaction.

### D19-06 — Machine evidence contract

The evidence payload is narrow and non-business:

~~~text
schema_version
stage
environment_kind
environment_id
repository
repository_commit
build_fingerprint
image_ref
checked_at
evidence_ref
probe_mode
postgres:
  server_version
  server_version_num
  major
pgvector:
  extension_name
  available
  installed
  version
  extension_owner
security:
  runtime_role
  runtime_superuser
  runtime_bypass_rls
  runtime_public_schema_create
probes:
  vector_type
  insert
  readback
  distance
status
reason_codes[]
~~~

probe_mode for a READY artifact must be REAL_DATABASE.

No database URL, password, provider key, family text, child data, professional body or real Case identifier is allowed in evidence.

The canonical CI writes the JSON to runner temp and adds it to the existing verify-all GitHub Actions artifact. It is not committed as a stale readiness registry.

### D19-07 — Readiness status mapping

Machine status values are exactly:

READY
BLOCKED
UNAVAILABLE
UNKNOWN
NOT_EVALUATED

No boolean-only readiness is allowed.

Mapping:
- no actual probe performed for an environment → NOT_EVALUATED;
- environment unreachable → UNKNOWN + ENVIRONMENT_UNREACHABLE;
- PostgreSQL version unavailable → UNKNOWN + POSTGRES_VERSION_UNKNOWN;
- PostgreSQL major != 18 → BLOCKED + POSTGRES_MAJOR_MISMATCH;
- vector absent from pg_available_extensions on a reached PG18 environment → UNAVAILABLE + PGVECTOR_NOT_AVAILABLE;
- vector is available but not installed after sanctioned setup should have run → BLOCKED + PGVECTOR_ENABLE_FAILED;
- privileged setup is denied or wrong authority is used → BLOCKED + PGVECTOR_ENABLE_FAILED + ROLE_OR_PERMISSION_INVALID;
- installed extension version cannot be established → UNKNOWN + PGVECTOR_VERSION_UNKNOWN;
- runtime role violates non-superuser/NOBYPASSRLS/no-schema-CREATE expectations → BLOCKED + ROLE_OR_PERMISSION_INVALID;
- vector type fails → BLOCKED + VECTOR_TYPE_UNAVAILABLE;
- insert fails → BLOCKED + VECTOR_INSERT_FAILED;
- read-back mismatches → BLOCKED + VECTOR_READBACK_FAILED;
- distance query fails or returns wrong deterministic behavior → BLOCKED + VECTOR_DISTANCE_QUERY_FAILED;
- exact environment/head/image/evidence identity is missing or inconsistent → UNKNOWN + EVIDENCE_INCOMPLETE;
- every required predicate passes → READY with no failure reason.

The probe should stop at the first semantic layer that prevents truthful downstream checks, while preserving all facts already established. It must not manufacture later PASS values.

### D19-08 — Failure evidence and known-bad samples

Pure evidence/status classification tests may use synthetic known-bad records, but those fixtures can never generate production READY evidence.

Required negative cases:
- PG17;
- unknown PostgreSQL version;
- vector unavailable;
- available but not enabled;
- setup denied;
- unknown pgvector version;
- vector type failure;
- insert failure;
- read mismatch;
- distance execution failure;
- wrong distance ordering;
- environment unreachable;
- evidence missing exact Head;
- evidence wrong stage/environment id;
- fake probe_mode;
- stage leakage/copy attempt;
- runtime superuser;
- runtime BYPASSRLS;
- runtime public-schema CREATE;
- partial-success evidence.

The real DB suite also attempts an invalid vector dimension against vector(3) and must observe rejection. This is a test-harness integrity check, not a new product truth.

### D19-09 — Stage isolation

The evidence file represents exactly one environment.

The validator rejects:
- evidence whose stage/environment identity does not match the invocation;
- evidence whose repository_commit does not equal the exact checked-out Head;
- evidence whose image_ref is missing or unpinned;
- a READY claim with another stage/environment identity;
- a copied/stale evidence file from another run.

Stage A CI READY does not write Stage B or Stage C status. Their state remains NOT_EVALUATED until their own actual future check.

### D19-10 — Security/RLS preservation

No migration, table, RLS policy or Authorization code is changed by Slice 19.

The readiness suite must prove:
- xiaoshuyin_app remains NOBYPASSRLS;
- xiaoshuyin_app remains non-superuser;
- xiaoshuyin_app remains non-owner of business tables through existing role regression;
- xiaoshuyin_app has no public schema CREATE;
- existing RLS/roles tests still pass;
- extension enablement is performed by privileged bootstrap, never DATABASE_URL runtime;
- no family RLS context is needed because probe data is temporary, synthetic and non-business.

### D19-11 — Static scope enforcement

Extend the existing scripts/guard-static.mjs rather than creating a second static-guard framework.

The Slice 19 rule and its synthetic self-tests SHALL reject executable implementation attempts that introduce:
- knowledge_embeddings production schema;
- packages/rag or packages/ai ownership for this Slice;
- sparsevec;
- pg_jieba;
- pg_textsearch;
- DashScope/provider/model SDKs;
- embedding/reranker adapters;
- A/B/C retrieval;
- RRF/fusion;
- HNSW/IVFFlat;
- permanent readiness/extension registry tables;
- runtime CREATE EXTENSION;
- runtime superuser/BYPASSRLS grants.

The rule may be narrowly written around Slice 19 implementation surfaces so later separately authorized Slices can replace/retire it deliberately rather than inheriting accidental permanent bans.

Synthetic known-bad guard fixtures are mandatory so the rule cannot pass vacuously.

### D19-12 — CI integration and exact-head evidence

CI changes are restricted to .github/workflows/ci.yml.

Both db-migrate and integration PostgreSQL services use the same pinned PG18+pgvector image reference.

Both call:
1. db/init/01-roles.sh;
2. db/init/02-pgvector.sh;
3. existing migration flow.

The integration job additionally:
- defines exact Stage A CI evidence identity inputs;
- runs the real pgvector DB tests;
- runs canonical verify-all on the exact checkout;
- verify-all includes the pgvector readiness command as a new gate without weakening historical gates;
- uploads pgvector-readiness.json in the existing exact-head verification artifact.

No READY evidence from another commit/run may be combined with final validation.

### D19-13 — No local/Stage B/Stage C provisioning

This Slice does not modify docker-compose.stage-a.yml, provision Lighthouse, or provision TencentDB.

Those environments are not declared READY.

A later consumer may run the same readiness semantics against a real target environment, but must create new environment-bound evidence. Current Stage A CI evidence is not portable proof.

## 5. Expected Implementation Delta

Developer AI should need only the following files unless T1901 discovers a real canonical equivalent that requires reconciliation:

~~~text
.github/workflows/ci.yml
db/init/02-pgvector.sh
scripts/lib/pgvector-readiness.mjs
scripts/pgvector-readiness.mjs
scripts/guard-static.mjs
scripts/verify-all.mjs
tests/db/pgvector-readiness.test.ts
tests/architecture/pgvector-readiness-evidence.test.ts
tests/architecture/pgvector-readiness-ci-contract.test.ts
~~~

Explicitly forbidden delta:
- Docs/**
- specs/019/** Frozen planning/spec artifacts during development
- db/schema/**
- db/migrations/**
- docker-compose.stage-a.yml
- package.json
- lockfiles
- packages/rag/**
- packages/ai/**
- Knowledge/Gold/Intervention owners
- application runtime routes/services.

If a genuine implementation requirement falls outside the expected delta, Developer must classify it at the task STOP condition rather than silently broaden scope.

## 6. Test and Validation Design

### 6.1 Real database acceptance

The real CI database suite must run against actual PostgreSQL 18 with actual pgvector installed.

It proves:
- server major 18;
- extension available and installed;
- exact extversion observable;
- runtime role restrictions;
- vector(3) TEMP relation works;
- insert/read works;
- exact L2 distance works;
- deterministic ordering is origin → near → far;
- invalid dimension is actually rejected;
- no permanent probe table remains.

### 6.2 Lifecycle/failure semantics

Architecture/evidence tests prove every status mapping and reason code listed in D19-07.

They also prove a READY payload is rejected when:
- probe_mode is MOCK;
- exact commit differs;
- environment differs;
- image reference is not immutable;
- required version/probe field is missing;
- any required probe is non-PASS;
- runtime role privilege is elevated.

### 6.3 CI contract test

The CI contract test reads .github/workflows/ci.yml and proves:
- db-migrate and integration use a pgvector-enabled PG18 service image;
- image references are the same and immutable;
- plain postgres:18 is no longer the relevant DB service image in those jobs;
- privileged pgvector bootstrap executes before migration/readiness;
- runtime readiness uses DATABASE_URL;
- readiness evidence path is supplied;
- uploaded exact-head artifact includes the readiness JSON.

### 6.4 Scope guard self-test

guard-static --self-test must contain known-bad Slice 19 fixtures and demonstrate they trigger the new scope rule.

At minimum known-bad fixtures cover:
- knowledge_embeddings table;
- sparsevec;
- pg_jieba;
- HNSW/IVFFlat;
- provider/embedding adapter import;
- runtime CREATE EXTENSION;
- runtime BYPASSRLS/SUPERUSER grant.

## 7. Exact-head Verification Contract

Final Developer validation must be from one exact Head.

Required final gates on that exact Head:

1. git provenance / exact base-head relationship;
2. bun run typecheck;
3. targeted architecture/evidence tests;
4. targeted real DB pgvector test;
5. node scripts/pgvector-readiness.mjs producing READY evidence;
6. bun run guard:static;
7. node scripts/guard-static.mjs --self-test;
8. canonical node scripts/verify-all.mjs;
9. existing RLS/roles/db regression;
10. governance validation and governance self-test;
11. changed-file/scope review;
12. evidence artifact identity equals exact final Head.

A result from a prior Head, another workflow attempt, another database image, another stage, or another environment cannot be assembled into the final PASS.

## 8. Audit 2 Handoff Evidence

The final Developer handoff must make the following mechanically visible:

- exact base;
- exact final Head;
- merge base;
- ahead/behind;
- Frozen Spec commit and blob;
- four Authority Doc blobs;
- changed files;
- official pgvector image reference including digest;
- actual PostgreSQL server version;
- actual pgvector extension version;
- exact Stage A CI environment identity;
- privileged bootstrap evidence;
- runtime role/security evidence;
- vector type/insert/read/distance evidence;
- invalid-vector negative evidence;
- status/reason-code artifact;
- static scope guard and self-test evidence;
- targeted tests;
- full verify-all;
- governance checks;
- workflow run id/attempt;
- exact artifact name/ref.

Audit 2 must not need to infer that pgvector READY means RAG READY. The evidence must say only pgvector dense-vector readiness for the exact environment.

## 9. Dependency and Implement Gates

Planning Dependency Gate: PASS.

Runtime Dependency Gate: PASS.

Reason:
- current main executes PostgreSQL 18 in real CI;
- the missing pgvector capability is the Slice deliverable;
- the proof needs only synthetic data;
- no Slice 16/17/18 runtime, reviewer, Knowledge corpus, Gold release, model provider or family data is required.

At Plan AI 1 freeze, Implement Gate was blocked only by mandatory Plan AI 2 → Audit 1 → Planning Freeze governance.

If Audit 1 final pass and final remote reconciliation show no semantic drift or competing owner, this Plan opens the Implement Gate.

## 10. FR Traceability

| FR | Planned owner |
|---|---|
| FR-001 | T1901, T1911, T1914 |
| FR-002 | T1901, T1911 |
| FR-003 | T1901, T1902, T1905 |
| FR-004 | T1901, T1911 |
| FR-005 | T1904, T1906, T1910 |
| FR-006 | T1904, T1910 |
| FR-007 | T1910 |
| FR-008 | T1904, T1908, T1910 |
| FR-009 | T1905, T1907 |
| FR-010 | T1905, T1907, T1908 |
| FR-011 | T1905, T1908 |
| FR-012 | T1902, T1903, T1905 |
| FR-013 | T1903, T1905 |
| FR-014 | T1902, T1903, T1905 |
| FR-015 | T1905, T1908 |
| FR-016 | T1902, T1905, T1910 |
| FR-017 | T1905, T1907 |
| FR-018 | T1905, T1907 |
| FR-019 | T1905, T1907 |
| FR-020 | T1905, T1907 |
| FR-021 | T1905, T1907 |
| FR-022 | T1905, T1911 |
| FR-023 | T1905, T1911 |
| FR-024 | T1903, T1905, T1909 |
| FR-025 | T1905, T1909 |
| FR-026 | T1909, T1911 |
| FR-027 | T1904, T1906, T1914 |
| FR-028 | T1911 |
| FR-029 | T1911 |
| FR-030 | T1911 |
| FR-031 | T1911 |
| FR-032 | T1911 |
| FR-033 | T1911 |
| FR-034 | T1911 |
| FR-035 | T1911 |
| FR-036 | T1904, T1905, T1908 |
| FR-037 | T1904, T1908 |
| FR-038 | T1904, T1908 |
| FR-039 | T1904, T1906, T1910, T1914 |
| FR-040 | T1904, T1906, T1914 |

## 11. Acceptance Scenario Traceability

| Scenario | Planned execution |
|---|---|
| AS-001 | T1902, T1903, T1905, T1907 |
| AS-002 | T1908 |
| AS-003 | T1908 |
| AS-004 | T1902, T1908 |
| AS-005 | T1903, T1908 |
| AS-006 | T1905, T1908 |
| AS-007 | T1905, T1907, T1908 |
| AS-008 | T1905, T1907, T1908 |
| AS-009 | T1905, T1907, T1908 |
| AS-010 | T1905, T1907, T1908 |
| AS-011 | T1905, T1907, T1908 |
| AS-012 | T1905, T1907 |
| AS-013 | T1905, T1911 |
| AS-014 | T1909 |
| AS-015 | T1909, T1911 |
| AS-016 | T1910 |
| AS-017 | T1910 |
| AS-018 | T1904, T1908 |
| AS-019 | T1904, T1906, T1908 |
| AS-020 | T1911 |
| AS-021 | T1911 |
| AS-022 | T1911 |
| AS-023 | T1911 |
| AS-024 | T1911 |
| AS-025 | T1911 |
| AS-026 | T1911 |
| AS-027 | T1904, T1908 |
| AS-028 | T1905, T1911 |
| AS-029 | T1901 |
| AS-030 | T1901 |

## 12. Negative Scope Traceability

| Scenario | Planned execution |
|---|---|
| NS-01 | T1911 |
| NS-02 | T1911 |
| NS-03 | T1911 |
| NS-04 | T1911 |
| NS-05 | T1911 |
| NS-06 | T1911 |
| NS-07 | T1911 |
| NS-08 | T1911 |
| NS-09 | T1911 |
| NS-10 | T1911 |
| NS-11 | T1911 |
| NS-12 | T1911 |
| NS-13 | T1911 |
| NS-14 | T1911 |
| NS-15 | T1911 |
| NS-16 | T1911 |
| NS-17 | T1911 |
| NS-18 | T1911 |
| NS-19 | T1911 |
| NS-20 | T1911 |
| NS-21 | T1901, T1911 |
| NS-22 | T1904, T1914 |

## 13. Planning Decisions Frozen by Plan AI 2

The following implementation-level decisions are fixed for Developer execution without changing product authority:

1. only STAGE_A_CI_INTEGRATION is the current READY target;
2. Stage A local, Stage B and Stage C do not inherit readiness;
3. official pgvector PostgreSQL 18 image is used and pinned to immutable digest;
4. exact pgvector minor/patch is evidence, not permanent product authority;
5. extension enablement uses existing privileged db/init bootstrap seam;
6. no migration/schema/business table is added;
7. application runtime never installs extension;
8. runtime probe uses a TEMP vector(3) relation and deterministic synthetic vectors;
9. READY requires actual insert/read/distance behavior, not CREATE EXTENSION alone;
10. evidence is one exact environment/run/head artifact, not a registry;
11. statuses remain READY/BLOCKED/UNAVAILABLE/UNKNOWN/NOT_EVALUATED;
12. existing guard-static and verify-all are extended instead of creating parallel frameworks;
13. no package dependency, RAG module or vector platform is added;
14. Audit 2 receives exact evidence from one final Head.

## 14. Audit 1 Contract

Audit 1 independently answers:

Q1 Frozen Spec Fidelity
Q2 Scope Convergence
Q3 Authority Preservation
Q4 Dependency Truth
Q5 Environment Truth
Q6 pgvector Capability Proof
Q7 Security / Role Integrity
Q8 Failure Semantics
Q9 Validation Non-Vacuity
Q10 Implement Gate Truthfulness

Any CRITICAL/HIGH/MEDIUM planning defect, and any LOW that forces Developer guessing, must be remediated only in plan.md/checklist.md/tasks.md followed by full re-audit.

Frozen Spec, Authority Docs, production code, tests, migrations and upstream Slice artifacts are not editable during planning.

## 15. Audit 1 Closure

Audit 1 was executed after Plan, Checklist and Tasks were drafted as one planning package.

Final audit result:

~~~text
Q1 Frozen Spec Fidelity: PASS
Q2 Scope Convergence: PASS
Q3 Authority Preservation: PASS
Q4 Dependency Truth: PASS
Q5 Environment Truth: PASS
Q6 pgvector Capability Proof: PASS
Q7 Security / Role Integrity: PASS
Q8 Failure Semantics: PASS
Q9 Validation Non-Vacuity: PASS
Q10 Implement Gate Truthfulness: PASS

CRITICAL: 0
HIGH: 0
MEDIUM: 0
LOW: 0

Audit 1: FINAL PASS
Scope Drift: 0
~~~

Audit 1 specifically confirmed:
- no retrieval candidate is selected;
- no migration is invented;
- privileged install and runtime use are separated;
- actual vector behavior is required;
- evidence cannot cross environments;
- exact pgvector version remains evidence rather than product authority;
- known-bad tests make guards non-vacuous;
- current runtime dependencies are sufficient once planning governance freezes.

## 16. Stop Boundary

After final remote read-back proves Planning Freeze integrity, Plan AI 2 stops.

Expected final state if no remote drift appears:

~~~text
Planning Freeze: PASS
Runtime Dependency Gate: PASS
Implement Gate: PASS
READY FOR DEVELOPMENT: YES
Final State: READY FOR DEVELOPMENT
~~~
