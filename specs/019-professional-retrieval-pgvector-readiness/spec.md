# Slice 19 — Professional Retrieval PostgreSQL 18 / pgvector Readiness Foundation

> Repository: pyxm1618/xiaoshuyin
>
> Slice: 019
>
> Feature: 019-professional-retrieval-pgvector-readiness
>
> V1 Phase: Phase 3 — Professional Knowledge & AI
>
> Role boundary: Plan AI 1 only
>
> Execution context: REMOTE-ONLY / GitHub authoritative remote
>
> Status: Selection + Specify + Clarify FINAL PASS — FROZEN SPEC after exact remote commit/blob read-back
>
> Scope of this artifact: Remote truth recovery → Selection Gate → Specify → Clarify → Frozen Spec only
>
> Forbidden in this artifact: Plan / Checklist / Tasks / Audit 1 / production implementation / migrations / implementation tests / Audit 2 / merge

This Slice freezes the minimum shared database-capability readiness contract needed before any V1 Professional RAG retrieval candidate is implemented.

The central boundary is:

> PostgreSQL 18 + pgvector vector capability is a formally required shared V1 substrate for retrieval candidates A, B and C. Proving that shared substrate does not select A, B or C and does not prove retrieval quality.

This Slice does not implement sparsevec readiness, pg_jieba, embedding, reranking, Knowledge embeddings, RAG, Gold Dataset execution, Context Builder, AI Task Runtime, TaskModelRegistry or any user-facing AI feature.

---

## 1. Authority Baseline

Authority hierarchy:

1. Docs/总产品需求.md — long-term product truth;
2. Docs/V1产品需求.md — V1 product truth;
3. Docs/总体技术架构.md — long-lived architecture truth;
4. Docs/V1技术设计.md — V1 implementation contract;
5. Frozen Slice Contracts — downstream bounded contracts that may not rewrite the four Authority Docs.

Exact remote baseline immediately before Slice 19 branch creation:

~~~text
Repository:
pyxm1618/xiaoshuyin

origin/main:
e7bb22d1abad58a6c9df6350744f092d88370aa3
~~~

Authority Doc blobs:

~~~text
Docs/总产品需求.md
67724000cb9bb81c40489c04db28d899bd1df74c

Docs/V1产品需求.md
1900485a407e0634643f4f0bbe5ab02476dc4bfd

Docs/总体技术架构.md
9b08371edc976fa281469dfee8dc19962452e3b0

Docs/V1技术设计.md
6f03d1a3c49bdc866945ae7f82df542f1292a147
~~~

No Authority Doc mutation is authorized by this Slice.

Authority Gate: PASS.

---

## 2. Repository Reality Check

Current main was re-read directly from GitHub remote.

### 2.1 PostgreSQL baseline

Current CI already runs database migration and integration jobs on:

~~~text
postgres:18
~~~

The current CI workflow therefore proves that PostgreSQL major 18 is already the repository's executable CI baseline.

However, current main does not configure or prove pgvector readiness:

- no pgvector extension setup was found;
- no CREATE EXTENSION vector path was found;
- no vector column capability probe was found;
- no vector insert/read/distance-query proof was found;
- no pgvector readiness evidence artifact was found;
- current CI service uses the plain PostgreSQL 18 image.

Therefore the missing shared capability is not “upgrade the project to PostgreSQL 18”.

The missing capability is:

> prove pgvector vector readiness on the already-authoritative PostgreSQL 18 baseline without prematurely building retrieval.

### 2.2 No existing Phase 3 retrieval owner on main

Remote inspection found no current main implementation or owner for:

- pgvector retrieval;
- sparsevec;
- pg_jieba;
- knowledge_embeddings;
- Professional RAG;
- retrieval config;
- vector registry;
- Gold Dataset runtime;
- Context Builder;
- AI Task Runtime;
- TaskModelRegistry;
- provider execution;
- reviewer registry;
- generic model registry.

No hidden retrieval platform exists to reuse.

No second retrieval/database readiness authority may be created later beside the one bounded contract defined by this Slice.

### 2.3 Authorization reality relevant to Selection

Current single authorize() implementation contains Family, Case, participation, identity-binding, Safety-resolution and narrow phone-use-contract capabilities.

It does not currently contain a professional-content reviewer/publisher/evaluation-review capability or a concrete staff-assignment source.

Current Authority requires staff assignment and professional content/policy review, but current main does not yet provide the real professional staff authority required by Slices 16–18.

That is a real dependency gap, but it is not silently repaired inside this Slice.

---

## 3. Frozen Slice 16–18 Authority Recovery

### 3.1 Slice 16

Feature:

~~~text
016-psychological-behavioral-intervention-contract
~~~

Frozen Spec:

~~~text
commit:
05aa4594cbb99c433035f9fa313376a7fec99785

blob:
a6cd9fd723f9339b575757279703be554afaf0f6
~~~

Planning Freeze head:

~~~text
40d6c4e19b9207b287aec03c5ba02868260dd8fe
~~~

Planning blobs re-read:

~~~text
plan.md
f3d47ab301cda9668811eb6b1748ef1685c67c39

checklist.md
04da0caf0732a5e99aef248cc807b9db1cb2f1b5

tasks.md
30e08b93746b9d40a631ec5ce81c0cf4406bd090
~~~

Frozen meaning preserved:

- InterventionDefinition is the professional action truth;
- deterministic eligibility cannot be replaced by RAG/AI;
- Knowledge/RAG/pgvector are out of Slice 16;
- real professional reviewer authority is required before truthful production approval;
- no generic RBAC may be invented merely to make the gate green.

Current branch being behind newer main commits is historical branch topology, not proof of semantic drift. The exact Frozen Spec blob remains intact and current Authority Docs do not contradict its owned semantics.

Slice 16 Authority: PASS.

### 3.2 Slice 17

Feature:

~~~text
017-professional-knowledge-foundation
~~~

Frozen Spec commit:

~~~text
a345937868ca1b8d2cef65003d4197de4207eb52
~~~

Current spec-branch convergence head:

~~~text
22e69a546e00a37b6bf26fb3e28b10e18fd6f024
~~~

Frozen Spec blob:

~~~text
866c3f77dd269c94d420d9c0ae6b918f114286ce
~~~

Planning Freeze head:

~~~text
a1d4e4390d313502696493573243adf401dbae90
~~~

Planning blobs re-read:

~~~text
plan.md
117ee8c5ef34230984f693cdc31443ee0be0d848

checklist.md
b46b8993c771d41cd9e03a36d7722b638c0282fa

tasks.md
395fcdb51f9fde3716e27b27193b0b8cfa3c8834
~~~

The spec branch contains only the authoritative spec artifact after convergence. The previously competing planning files on that branch were retired; the plan branch is the sole planning authority.

Frozen meaning preserved:

- Slice 17 owns Professional Knowledge Item/version/review/publication truth;
- retrieval, embeddings and pgvector remain downstream;
- Knowledge cannot become Intervention eligibility;
- implementation is blocked by real professional authority/package integration, not by planning ambiguity.

Slice 17 Authority: PASS.

### 3.3 Slice 18

Feature:

~~~text
018-professional-retrieval-gold-dataset
~~~

Frozen Spec:

~~~text
commit:
4624b3df6d59c6055421e175b95051782615de9a

blob:
bf7540ff3097ef14ca1c62a395b155abd4fde66a
~~~

Planning Freeze head:

~~~text
9254c6bf387dd5471f7935be056c122fd5508672
~~~

Planning blobs re-read:

~~~text
plan.md
4a773fa48d26eb8dcabc5611767a9e40a8cbdc7b

checklist.md
ca07705de0e280f233e7a8eec2d9da26eb03af54

tasks.md
754dc21d714550503c8b18193461beaf9f414275
~~~

Slice 18 remains:

~~~text
Planning: COMPLETE
Audit 1: FINAL PASS
Runtime Dependency Gate: BLOCKED
Implement Gate: BLOCKED
Development Authorization: NOT GRANTED
~~~

Its Frozen purpose is the versioned Gold Dataset evaluation truth, not retrieval infrastructure.

Its future seams explicitly include PostgreSQL/pgvector readiness, sparsevec readiness, pg_jieba readiness, adapters, retrieval, scoring, Context Builder and AI runtime, while explicitly refusing to pre-number those seams into future Slices.

Slice 18 Authority: PASS.

---

## 4. Problem / Why Now

The Phase 3 authority chain now defines three distinct truths:

1. Slice 16 — what a professionally reviewed InterventionDefinition is and when it is eligible;
2. Slice 17 — what reviewed/published Professional Knowledge is;
3. Slice 18 — how future Professional Retrieval candidates must be judged on one common Gold Dataset.

The earlier reason for not beginning retrieval infrastructure was valid:

> do not build retrieval technology before the benchmark contract exists.

That condition has now changed at the planning-authority level.

Slice 18 has frozen the benchmark semantics and explicitly prevents any future infrastructure slice from changing Gold truth to suit a technology.

At the same time, current main already runs PostgreSQL 18 but has no pgvector capability.

The four Authority Docs already require PostgreSQL 18 + pgvector as the shared vector substrate for V1 retrieval. This is not an A/B/C winner decision:

- Candidate A needs pgvector vector + sparsevec;
- Candidate B needs pgvector dense vector + pg_jieba lexical retrieval;
- Candidate C needs pgvector dense vector only.

Therefore the next minimum technology capability that can be defined without choosing a retrieval route is:

> PostgreSQL 18 + pgvector vector readiness.

This closes one real shared prerequisite while leaving all route-specific choices open for later evidence.

---

## 5. Slice 19 Selection Gate

### 5.1 Selection criteria

Every candidate is judged against:

- Authority readiness;
- dependency readiness;
- independent value;
- fake-scaffold risk;
- premature implementation/technology lock-in risk;
- duplicate-authority risk;
- overlap with Slices 16–18;
- whether adjacent capabilities share one success criterion;
- scope size;
- whether a smaller prerequisite exists;
- whether planning and development dependencies differ.

### 5.2 Selection Matrix

| Candidate | Authority readiness | Dependency readiness | Independent value | Premature / duplicate risk | Scope size | Decision |
|---|---|---|---|---|---|---|
| A. PostgreSQL 18 / pgvector vector readiness | HIGH — explicitly frozen in V1 architecture/design | HIGH — PostgreSQL 18 already executes in CI; no professional corpus needed for capability probe | HIGH — shared prerequisite for A/B/C | LOW if limited to capability/readiness evidence | SMALL / COHERENT | **SELECT** |
| B. DashScope dense+sparse → sparsevec readiness Spike | HIGH as a required candidate-A gate | MEDIUM — depends on pgvector target readiness plus real DashScope sparse payload behavior | HIGH for A only | HIGH if done before shared vector substrate; route-A specific | SEPARATE | DEFER |
| C. pg_jieba + professional dictionary readiness | HIGH as candidate-B path | MEDIUM/LOW — route-B specific; professional dictionary/corpus semantics not executable yet | HIGH for B only | Route-B lock-in risk if pulled forward | SEPARATE | DEFER |
| D. embedding adapter foundation | HIGH as later V1 component | LOW/MEDIUM — provider/model evidence and retrieval consumer are not ready | Medium | Could turn first candidate into de facto production choice before Eval | SEPARATE | DEFER |
| E. reranker adapter foundation | HIGH as later V1 component | LOW/MEDIUM — meaningful use follows retrieval candidates | Medium | Premature provider/runtime coupling | SEPARATE | DEFER |
| F. Gold Dataset execution / scoring foundation | HIGH | LOW — Slice 18 RELEASED production dataset and runnable candidates do not exist | High later | Fake scoring scaffold risk now | MEDIUM | DEFER |
| G. A/B/C retrieval foundation | HIGH | LOW — route-specific readiness, Gold execution and actual corpus are absent | High later | Too broad; would combine store/filter/search/rank/fusion | LARGE | DEFER |
| H. Context Builder | HIGH | LOW — purpose-bound RAG/Memory inputs are not ready | Medium later | Generic context platform risk | MEDIUM | DEFER |
| I. AI Task Runtime | HIGH | LOW — bounded production AI task/context/model route not yet ready | Medium later | Generic AI platform risk | MEDIUM | DEFER |
| J. TaskModelRegistry / provider execution | HIGH | LOW — task-level Eval evidence is not ready | Medium later | Model router before evidence | MEDIUM | DEFER |
| K. Professional staff/reviewer authority foundation | REAL REQUIREMENT — §9 staff assignment, §28.10 professional review, V1-X14 real capability | BLOCKED — current Authority does not yet freeze staff identity/bootstrap/grant/revoke ownership sufficiently to safely create a new authority | Very high if properly authorized; blocks S16–18 | **HIGH** risk of inventing generic RBAC/reviewer registry or fake reviewer solely to clear gates | Potentially LARGE | **BLOCKED / DEFER** |
| L. Duplicate Gold Dataset schema/validator scaffold | Already owned by Slice 18 | Blocked by Slice 18 runtime gate | None beyond Slice 18 | Duplicate authority | DUPLICATE | REJECT |
| M. Generic retrieval/vector platform | Not required | N/A | None beyond concrete V1 needs | Severe overdesign / second authority | LARGE | REJECT |

### 5.3 Why Candidate K is not silently selected

The repository has a real staff/reviewer gap.

That gap must remain visible.

However, current formal Authority only establishes that:

- Authorization considers staff assignment;
- V1 needs professional content/policy review;
- real capabilities must exist;
- fake reviewer identities and generic staff/RBAC platforms are forbidden.

Current main does not provide:

- a concrete professional staff identity source;
- a trusted staff bootstrap authority;
- assignment grant/revoke ownership;
- a professional staff authentication path;
- a sanctioned reviewer registry to reuse.

Creating those semantics inside Slice 19 merely because Slices 16–18 are blocked would require new security/operations authority not already frozen.

Therefore:

> reviewer authority is a genuine prerequisite gap, but not a legitimate hidden implementation inside this Slice.

It remains BLOCKED/DEFER and must be solved through a separately authorized narrow contract when its identity/bootstrap authority is sufficiently defined.

This does not block an independent pgvector capability slice because pgvector readiness uses no reviewer, family, Case, professional Knowledge or Gold labels.

### 5.4 Why A is selected instead of A+B or A+B+C

A, B and C do not share one success criterion.

PostgreSQL 18 / pgvector vector readiness proves:

- correct PostgreSQL major;
- extension availability;
- vector type/operation capability;
- environment-specific evidence.

Sparsevec readiness additionally requires:

- a real DashScope dense+sparse payload;
- sparse encoding/parsing compatibility;
- non-zero/dimension semantics;
- sparsevec insert/read/distance behavior;
- candidate-A-specific fusion feasibility.

pg_jieba readiness additionally requires:

- a separate extension/runtime dependency;
- Chinese lexical behavior;
- a Xiaoshuyin professional dictionary;
- candidate-B-specific tokenization/search evidence.

They have different external dependencies, different failure modes and different route implications.

Combining them would turn one shared infrastructure proof into a multi-route retrieval technology package.

Selection Gate: PASS.

---

## 6. Selected Slice Definition

Selected Slice:

> **019-professional-retrieval-pgvector-readiness**

Responsibility:

> Establish one bounded, reproducible, environment-scoped readiness contract and evidence path proving that the authoritative PostgreSQL 18 environment can provide the pgvector dense-vector capability required by all V1 Professional Retrieval candidates.

This Slice proves database capability.

It does not prove retrieval quality.

It does not select a route.

It does not store professional Knowledge embeddings.

It does not run a model.

---

## 7. Goals

Slice 19 SHALL:

1. preserve PostgreSQL major 18 as the V1 database baseline;
2. establish pgvector vector capability as a real, testable dependency rather than a documentation assumption;
3. prove extension availability using actual database capability evidence;
4. prove basic vector type creation/use in a bounded readiness probe;
5. prove vector insert, read and distance-query behavior;
6. record the exact PostgreSQL and pgvector versions actually tested;
7. preserve distinct readiness status per environment/stage;
8. make UNKNOWN / UNAVAILABLE / BLOCKED explicit rather than green by default;
9. produce reproducible readiness evidence suitable for future retrieval slices;
10. remain independent of Professional Knowledge content and Gold labels;
11. avoid any production Knowledge embedding schema;
12. avoid route-specific sparsevec or lexical capability;
13. avoid vector-index/performance tuning unless separately justified by later evidence;
14. avoid generic infrastructure registry/platform design;
15. preserve all existing database authorization/RLS/runtime-role rules.

---

## 8. Explicit Non-Goals

Slice 19 MUST NOT implement or authorize:

- PostgreSQL major migration away from 18;
- Professional Knowledge persistence;
- knowledge_embeddings production table;
- Knowledge chunking;
- document ingestion;
- pgvector sparsevec readiness;
- DashScope sparse adapter;
- embedding provider calls;
- qwen3.7 embedding adapter;
- pg_jieba;
- professional lexical dictionary;
- pg_textsearch;
- RAG candidate A;
- RAG candidate B;
- RAG candidate C;
- hybrid retrieval;
- RRF/fusion;
- reranker adapter/calls;
- candidate ranking;
- Gold Dataset execution;
- Recall/nDCG/MRR scoring;
- route-selection thresholds;
- Promptfoo RAG regression;
- Context Builder;
- AI Task Runtime;
- ai_runs;
- TaskModelRegistry;
- Vercel AI SDK provider execution;
- Jev;
- user-facing AI features;
- Family Memory;
- new professional reviewer/staff RBAC;
- generic vector database platform;
- generic extension registry;
- generic infrastructure capability registry;
- generic cloud provisioning system;
- HNSW/IVFFlat production tuning without later measured need;
- a second database owner or migration authority.

---

## 9. Truth Ownership

### 9.1 Slice 19 owns only bounded readiness truth

Slice 19 may own only evidence such as:

~~~text
environment_scope
postgres_major
postgres_version
pgvector_extension_name
pgvector_extension_version
extension_available
extension_create_or_enable_result
vector_type_probe_result
vector_insert_result
vector_read_result
vector_distance_query_result
readiness_status
checked_at
evidence_ref
build_or_environment_fingerprint
~~~

Exact physical representation is a Plan AI 2 implementation detail.

This truth means only:

> the tested database environment has or does not have the required dense-vector capability.

### 9.2 Slice 19 does not own

Slice 19 MUST NOT own or override:

- Family truth;
- Case truth;
- Evidence truth;
- Problem Formulation truth;
- Consent truth;
- Authorization truth;
- Compliance truth;
- Safety truth;
- Intervention truth;
- Professional Knowledge truth;
- Gold Dataset truth;
- Scene Package truth;
- Plan / Task / Review / Outcome truth;
- model routing truth;
- retrieval-quality truth;
- professional-review authority;
- deployment business-release truth.

### 9.3 Readiness evidence is not retrieval correctness

These implications are forbidden:

~~~text
pgvector READY
=> RAG READY

pgvector READY
=> candidate A selected

pgvector READY
=> embedding model approved

pgvector READY
=> professional Knowledge corpus ready

pgvector READY
=> production release ready
~~~

---

## 10. Core Readiness Contract

A tested environment is pgvector-vector READY only when all required predicates for that exact environment are proven by evidence:

1. server reports PostgreSQL major 18;
2. pgvector extension is actually available to the environment through the sanctioned deployment/build path;
3. pgvector extension can be enabled/created or is verifiably enabled through a managed equivalent;
4. exact extension version is observable;
5. vector type capability is actually usable;
6. a bounded test vector can be inserted;
7. the exact vector can be read back without silent corruption;
8. at least one deterministic distance/similarity query executes with expected ordering/behavior;
9. the probe uses the same runtime/migrator role boundaries appropriate to the operation being proven;
10. evidence is bound to one exact environment/build identity;
11. no required predicate is UNKNOWN.

A documentation statement that pgvector “should be supported” is not READY evidence.

A package/image tag alone is not READY evidence.

A successful CREATE EXTENSION alone is not READY evidence.

---

## 11. Environment / Stage Boundary

V1 architecture defines three infrastructure stages:

~~~text
Stage A — Local Development / CI
Stage B — Early Pilot / Lighthouse
Stage C — Managed Production / TencentDB PostgreSQL 18
~~~

Slice 19 freezes one rule:

> readiness is environment-scoped and must never be copied from one stage to another by assumption.

### 11.1 Stage A

Current main already has real CI PostgreSQL 18.

Stage A is the immediate implementation target for this Slice because it can produce reproducible shared capability evidence without any family/professional data.

A future implementation may also provide an equivalent local controlled build path consistent with the V1 architecture.

### 11.2 Stage B

If an actual Early Pilot environment exists during later verification, the same readiness contract may be applied to it.

Slice 19 does not provision Lighthouse.

Absence of a real Stage B environment is recorded as NOT_EVALUATED / UNKNOWN for Stage B, not as READY and not as failure of Stage A.

### 11.3 Stage C

If an actual Managed Production PostgreSQL environment exists, the same readiness contract may be applied to it.

Slice 19 does not provision TencentDB.

Managed service documentation alone cannot convert Stage C to READY. Actual supported extension/equivalent capability evidence is required before production deployment claims it.

### 11.4 No cross-stage inheritance

Forbidden:

~~~text
CI READY => Early Pilot READY
CI READY => Managed Production READY
Early Pilot READY => Managed Production READY
~~~

Each stage requires its own evidence when that stage becomes a real deployment target.

---

## 12. PostgreSQL 18 Contract

PostgreSQL 18 is already a formal V1 technical requirement and current CI reality.

Slice 19 SHALL NOT reopen the database-major decision.

Required behavior:

- readiness probe records actual server_version/server_version_num or equivalent authoritative server fact;
- major != 18 fails the V1 pgvector readiness contract for that environment;
- unknown server version is UNKNOWN, never READY;
- existing migrator/runtime role separation is preserved;
- runtime role remains non-owner and NOBYPASSRLS;
- no pgvector readiness work may weaken RLS;
- no extension setup may silently make the application runtime role a superuser, table owner or extension owner merely for convenience.

---

## 13. pgvector Contract

The formal capability required by this Slice is the pgvector dense vector capability.

Required semantics:

- extension identity is exact and inspectable;
- actual installed/enabled version is recorded;
- the tested version must support the exact vector operations needed by the readiness probe;
- a future version change invalidates old “same version” evidence;
- version aliases such as latest are not sufficient evidence;
- readiness evidence must identify how the extension entered the environment: controlled image/build, package installation, or managed equivalent;
- extension installation/enablement uses privileged migration/infrastructure context, not normal family runtime authority;
- application/runtime data access continues through existing minimum-privilege DB role rules.

This Slice does not select a permanent pgvector extension minor version in product authority.

The exact tested version is evidence, and later upgrades require re-proving readiness.

---

## 14. Vector Capability Probe

The capability probe is intentionally narrower than a retrieval implementation.

It SHALL prove:

1. vector type can be created/used in the target test context;
2. known finite numeric vector values are accepted;
3. insert succeeds;
4. read-back preserves expected dimensionality/value semantics;
5. a deterministic distance/similarity operation executes;
6. ordering or returned distance behavior is checked against known test vectors;
7. failure is explicit and machine-detectable.

The probe MUST use synthetic/non-family vectors.

It MUST NOT require:

- Knowledge Items;
- real embeddings;
- a model network call;
- Gold Dataset;
- family/minor data;
- a permanent production Knowledge embedding table.

A temporary/test-only probe relation or equivalent isolated mechanism may be chosen by Plan AI 2, provided it cannot become a second production Knowledge store.

---

## 15. Index / Performance Boundary

This Slice is capability readiness, not performance engineering.

It does not require HNSW, IVFFlat or another approximate index merely to declare vector capability READY.

Formal V1 architecture already allows small initial scale to prioritize correctness before index complexity.

Therefore:

- basic exact vector operations are in scope;
- approximate-index tuning is out of scope;
- production latency/storage/cost comparison belongs to future retrieval Eval;
- an index may not be introduced here merely because pgvector supports it.

---

## 16. Data / Persistence Boundary

Slice 19 creates no new business-data truth.

No production family/professional table is required.

No knowledge_embeddings production schema is authorized.

Readiness evidence may be source-controlled CI evidence, a bounded machine-readable artifact or an equivalent existing infrastructure evidence mechanism chosen by Plan AI 2.

Any representation MUST:

- identify exact environment/build;
- identify exact PostgreSQL/pgvector versions;
- preserve probe result and failure state;
- be reproducible;
- not become a generic infrastructure registry;
- not become a runtime business source of truth.

If an existing canonical readiness/evidence mechanism exists at implementation start, it must be reused rather than duplicated.

---

## 17. Runtime Boundary

Slice 19 is infrastructure readiness only.

It does not add:

- family-facing API;
- professional-content API;
- retrieval API;
- search endpoint;
- AI endpoint;
- model provider call;
- background AI job;
- user-visible behavior.

A readiness probe may execute in CI/deployment verification.

It MUST NOT run on every family request.

It MUST NOT become a hidden production health dependency that writes business data.

---

## 18. Dependency Contract

### 18.1 Planning dependencies

Satisfied:

- four Authority Docs are current and internally sufficient;
- Slice 16 Frozen Intervention authority is recovered;
- Slice 17 Frozen Knowledge authority is recovered;
- Slice 18 Frozen Gold Dataset authority is recovered;
- no competing Slice 19 authority exists;
- current main proves PostgreSQL 18 CI baseline;
- current main proves pgvector readiness is not already implemented.

Planning Dependency Gate: PASS.

### 18.2 Runtime dependencies for this Slice

This Slice does not require Slice 16, 17 or 18 runtime to exist in order to prove pgvector dense-vector capability.

It requires no:

- real professional reviewer;
- real Knowledge corpus;
- Gold Dataset release;
- embedding provider;
- family data.

Current PostgreSQL 18 CI provides a real executable baseline from which the missing pgvector capability can be implemented and tested.

Therefore on the current repository baseline:

~~~text
Runtime Dependency Gate:
PASS
~~~

This statement does not change Slices 16–18 runtime gates. Their own reviewer/Knowledge dependencies remain blocked.

### 18.3 Governance dependency

Plan AI 1 does not authorize Developer AI.

Before development, Slice 19 still requires:

- Plan AI 2 Plan;
- Checklist;
- Tasks;
- Audit 1 FINAL PASS;
- Planning Freeze;
- development-start remote reconciliation against then-current main.

Therefore at Plan AI 1 freeze:

~~~text
Implement Gate:
BLOCKED BY REQUIRED PLANNING GOVERNANCE

Development Authorization:
NOT GRANTED
~~~

If Plan AI 2/Audit 1 completes and no semantic/runtime drift appears, the current baseline has no additional upstream runtime dependency requiring fake professional data.

---

## 19. Failure / UNKNOWN / Unavailable Semantics

Readiness status must distinguish at least the following semantics:

~~~text
READY
BLOCKED
UNAVAILABLE
UNKNOWN
NOT_EVALUATED
~~~

Definitions:

- READY — every required predicate for the exact environment is proven;
- BLOCKED — an expected required capability exists in principle but a concrete checked prerequisite prevents readiness;
- UNAVAILABLE — the environment does not provide the required capability through the sanctioned path;
- UNKNOWN — a required fact/result could not be established reliably;
- NOT_EVALUATED — no actual check has been performed for that environment.

Rules:

1. UNKNOWN is never READY.
2. NOT_EVALUATED is never READY.
3. extension absent is not silently “install later = READY”.
4. permission failure is not automatically extension unavailability; failure class must remain distinguishable.
5. database connection/infrastructure failure is not a vector semantic failure.
6. one environment's READY state does not fill another environment's UNKNOWN.
7. probe failure cannot fall back to a mock implementation and still claim READY.

Machine-readable reasons must be possible for at least:

~~~text
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
~~~

Exact enum spelling is Plan AI 2 territory; semantic distinctions are frozen here.

---

## 20. Authorization / Security Boundary

Readiness work may require privileged extension setup but must preserve existing separation:

~~~text
migrator / infrastructure authority
!=
application runtime authority
~~~

Required:

- extension setup uses an approved privileged path;
- normal runtime role is not granted superuser/BYPASSRLS/table-owner powers;
- readiness tests verify or preserve existing role separation where relevant;
- no Family authorization bypass is introduced;
- no RLS policy is weakened to make the probe pass;
- secrets do not enter committed repo evidence;
- no public PostgreSQL port or cloud exposure is introduced by this Slice.

Because the readiness probe uses synthetic infrastructure data, it creates no new Family Consent purpose.

---

## 21. Observability / Evidence

Every READY claim must be supported by bounded evidence.

At minimum evidence identifies:

- repository/commit or build identity where applicable;
- environment scope;
- PostgreSQL actual version;
- pgvector actual version;
- extension enablement/availability result;
- vector type probe result;
- insert result;
- read-back result;
- distance-query result;
- role/permission context relevant to the check;
- checked_at;
- evidence_ref;
- final readiness status.

Evidence must not contain:

- database passwords;
- provider keys;
- family text;
- child data;
- professional Knowledge bodies;
- real Case identifiers.

A stale evidence record from a different environment/build/version cannot be used as current proof.

---

## 22. Functional Requirements

### Authority and scope

FR-001 — Slice 19 SHALL own only bounded PostgreSQL 18 / pgvector readiness evidence.

FR-002 — Slice 19 SHALL NOT own retrieval quality, Gold labels, professional Knowledge, Intervention, model or business truth.

FR-003 — Current PostgreSQL major authority SHALL remain 18.

FR-004 — No second database/retrieval/vector registry authority SHALL be created.

### Environment identity

FR-005 — Every readiness result SHALL identify one exact environment scope.

FR-006 — Stage A/B/C readiness SHALL remain distinct.

FR-007 — READY in one stage SHALL NOT imply READY in another.

FR-008 — NOT_EVALUATED / UNKNOWN SHALL NOT be converted to READY.

### PostgreSQL

FR-009 — Readiness SHALL observe the actual PostgreSQL server version.

FR-010 — PostgreSQL major other than 18 SHALL prevent V1 pgvector READY for that environment.

FR-011 — PostgreSQL version unavailable/unknown SHALL prevent READY.

### pgvector

FR-012 — Readiness SHALL prove actual pgvector extension availability.

FR-013 — Readiness SHALL prove actual extension enablement/managed-equivalent availability.

FR-014 — Readiness SHALL record the exact tested pgvector version.

FR-015 — Unknown extension version SHALL prevent READY.

FR-016 — Extension/version change SHALL require fresh readiness evidence.

### Vector capability

FR-017 — Readiness SHALL prove vector type capability.

FR-018 — Readiness SHALL prove vector insert.

FR-019 — Readiness SHALL prove exact read-back semantics sufficient for the probe.

FR-020 — Readiness SHALL prove at least one deterministic vector distance/similarity query.

FR-021 — Readiness SHALL assert expected query ordering/behavior against known synthetic vectors.

FR-022 — No real model/embedding network call SHALL be required.

FR-023 — No family/minor/professional corpus data SHALL be required.

### Security

FR-024 — Existing migrator/runtime role separation SHALL be preserved.

FR-025 — Application runtime SHALL NOT become superuser, table owner or BYPASSRLS to satisfy readiness.

FR-026 — Existing RLS/Authorization SHALL NOT be weakened.

FR-027 — Secrets SHALL NOT be persisted in readiness artifacts.

### Boundary

FR-028 — No production knowledge_embeddings schema SHALL be created.

FR-029 — No sparsevec readiness SHALL be claimed by this Slice.

FR-030 — No pg_jieba readiness SHALL be claimed by this Slice.

FR-031 — No A/B/C retrieval candidate SHALL be implemented.

FR-032 — No embedding/reranker adapter SHALL be implemented.

FR-033 — No Gold Dataset execution/scoring SHALL occur.

FR-034 — No Context Builder/AI Task/TaskModelRegistry/provider runtime SHALL be created.

FR-035 — No HNSW/IVFFlat tuning SHALL be required for this readiness contract.

### Evidence / failure

FR-036 — READY SHALL require all required exact-environment predicates to pass.

FR-037 — BLOCKED/UNAVAILABLE/UNKNOWN/NOT_EVALUATED SHALL remain distinct from READY.

FR-038 — Infrastructure unreachable SHALL NOT be mislabeled as professional/retrieval-quality failure.

FR-039 — Evidence SHALL bind exact environment/build and tested DB/extension versions.

FR-040 — Evidence SHALL be reproducible and contain no prohibited sensitive data.

---

## 23. Acceptance Scenarios

AS-001 — Current PostgreSQL 18 + valid pgvector:
The exact test environment reports PostgreSQL 18, pgvector is enabled, vector insert/read/distance query passes, all evidence is complete; that environment may report READY.

AS-002 — PostgreSQL 17:
pgvector may function technically, but V1 readiness returns not READY because the authoritative major is 18.

AS-003 — PostgreSQL version unknown:
Readiness remains UNKNOWN, not READY.

AS-004 — Plain postgres:18 with no pgvector:
PostgreSQL baseline passes, pgvector readiness does not.

AS-005 — Extension advertised but not actually creatable/enabled:
Readiness is BLOCKED/UNAVAILABLE according to the verified failure, not READY.

AS-006 — pgvector enabled, version unreadable:
Readiness remains UNKNOWN/not READY.

AS-007 — vector type unavailable:
Readiness fails even if extension metadata exists.

AS-008 — insert fails:
Readiness fails with vector insert reason.

AS-009 — read-back corrupt/mismatched:
Readiness fails; successful insert alone is insufficient.

AS-010 — distance query fails:
Readiness fails; CRUD alone is insufficient.

AS-011 — distance query returns unexpected known-vector ordering:
Readiness fails instead of accepting “query executed” as proof.

AS-012 — synthetic vectors only:
Full readiness probe passes without any real family/professional/model data.

AS-013 — no model network:
Full readiness acceptance can pass with network model providers absent.

AS-014 — runtime role elevation attempt:
A solution that makes the application role superuser/BYPASSRLS merely to use vector fails the Slice contract.

AS-015 — RLS weakening:
Readiness work that disables/weakens existing RLS fails scope/security acceptance.

AS-016 — Stage A READY, Stage B absent:
Stage A remains READY; Stage B is NOT_EVALUATED. Stage B is not inherited.

AS-017 — Stage A READY, Stage C docs say supported:
Stage C remains NOT_EVALUATED/UNKNOWN until actual managed capability evidence exists.

AS-018 — pgvector version changed:
Old evidence cannot prove readiness for the changed extension version.

AS-019 — PostgreSQL patch changed:
The implementation records new actual version and reruns the probe; it does not silently reuse stale evidence.

AS-020 — Knowledge schema request:
Developer attempts to add production knowledge_embeddings “for convenience”; scope gate rejects it.

AS-021 — sparsevec request:
Developer attempts to add sparsevec payload testing; scope gate rejects it as a later candidate-A Spike.

AS-022 — pg_jieba request:
Developer attempts to combine lexical readiness; scope gate rejects it as a later candidate-B responsibility.

AS-023 — HNSW request:
Developer adds HNSW because pgvector supports it without measured need; scope gate rejects it.

AS-024 — retrieval endpoint request:
No user/internal search endpoint is created by this Slice.

AS-025 — Gold score request:
No Recall/nDCG/MRR result is claimed by pgvector readiness.

AS-026 — route claim:
A successful pgvector probe does not mark A, B or C selected/ready.

AS-027 — secrets in evidence:
Readiness artifact containing DB password/provider secret fails validation/review.

AS-028 — family data in probe:
Readiness probe using real family/minor data fails the Slice boundary.

AS-029 — existing extension/evidence owner appears before development:
Developer must reuse/reconcile the existing authoritative mechanism and STOP rather than create a parallel owner if equivalence cannot be proven.

AS-030 — main semantic drift:
If the four Authority Docs or consumed Frozen Slices change this Slice's semantics before development, implementation stops for authority reconciliation.

---

## 24. Negative Scope Scenarios

NS-01 — No knowledge_embeddings production table.

NS-02 — No Knowledge chunking or document ingestion.

NS-03 — No sparsevec payload/encoding/distance readiness.

NS-04 — No DashScope call.

NS-05 — No qwen embedding adapter.

NS-06 — No reranker adapter/call.

NS-07 — No pg_jieba extension/dictionary work.

NS-08 — No pg_textsearch.

NS-09 — No A/B/C search implementation.

NS-10 — No RRF/fusion.

NS-11 — No retrieval/rerank endpoint.

NS-12 — No Gold Dataset labels/scoring/threshold selection.

NS-13 — No Promptfoo platform work.

NS-14 — No Context Builder.

NS-15 — No AI Task Runtime.

NS-16 — No TaskModelRegistry/model router.

NS-17 — No user-facing AI feature.

NS-18 — No professional reviewer/RBAC bootstrap hidden inside this Slice.

NS-19 — No generic vector platform/capability registry.

NS-20 — No approximate-index optimization without later measured need.

NS-21 — No Family/Case/Evidence/Formulation/Consent/Compliance/Safety/Intervention/Knowledge truth mutation.

NS-22 — No claim that database readiness equals production RAG readiness.

---

## 25. Producer / Consumer Contracts

### 25.1 Producer

A future Slice 19 implementation produces only:

- a real PostgreSQL 18 + pgvector capability path for the targeted executable environment;
- a reproducible vector capability probe;
- exact readiness evidence/status.

### 25.2 Authorized future consumers

Future consumers may include:

- DashScope sparsevec readiness Spike;
- pg_jieba/dense retrieval path setup where dense vector capability is required;
- dense-only candidate C;
- embedding/retrieval implementations;
- A/B/C retrieval Eval;
- deployment readiness checks.

Consumers may rely only on the exact environment/version evidence they actually share.

### 25.3 Forbidden consumers/interpretations

No consumer may interpret Slice 19 readiness as:

- permission to publish Professional Knowledge;
- professional reviewer approval;
- Gold Dataset release;
- embedding-model approval;
- reranker approval;
- retrieval-route selection;
- user-facing AI release.

---

## 26. Future Slice Seams

After this shared substrate, future authority must still independently select and freeze coherent slices for:

1. DashScope dense+sparse → sparsevec readiness Spike;
2. pg_jieba + Xiaoshuyin professional dictionary readiness;
3. embedding adapter/evaluation;
4. reranker adapter/evaluation;
5. A/B/C retrieval implementation;
6. RRF/fusion;
7. Gold Dataset execution/scoring + route-selection thresholds;
8. Promptfoo RAG regression;
9. Context Builder;
10. AI Task Runtime;
11. TaskModelRegistry/provider execution;
12. user-facing AI capabilities;
13. the separate professional staff/reviewer authority gap when upstream identity/bootstrap authority is sufficiently defined.

This list remains seams, not a pre-numbered Slice schedule.

---

## 27. Implement Gate

### 27.1 Planning dependency gate

~~~text
PASS
~~~

Selection, ownership, failure semantics and scope can be frozen from current Authority.

### 27.2 Runtime dependency gate

~~~text
PASS
~~~

Reason:

- current main already executes PostgreSQL 18 in CI;
- pgvector capability itself is the Slice deliverable, not a missing upstream runtime;
- the readiness probe can be real with synthetic data;
- no Slice 16/17/18 runtime, reviewer, Knowledge corpus, model provider or Gold release is required.

### 27.3 Development authorization at Plan AI 1 boundary

~~~text
Implement Gate:
BLOCKED

Block reason:
mandatory Plan AI 2 → Audit 1 → Planning Freeze governance has not yet occurred.

Development Authorization:
NOT GRANTED
~~~

Plan AI 2 may not weaken this Spec.

After Plan AI 2 / Audit 1 / Planning Freeze, Developer AI may be authorized only if a fresh remote reconciliation shows:

- no semantic Authority drift;
- no competing Slice 19 authority;
- no already-merged equivalent readiness owner;
- PostgreSQL 18 executable baseline still exists;
- implementation can preserve DB role/RLS/security contracts;
- exact delta remains inside this Slice.

---

## 28. Clarify — Resolved Decisions

### C19-01 — Is Slice 19 selected just because pgvector appears first in a future-seam list?

NO.

It is selected because current evidence now shows:

- PostgreSQL 18 is already executable;
- pgvector is the smallest missing shared substrate across A/B/C;
- the common Gold Dataset semantics are already Frozen, removing the prior benchmark-authority gap;
- pgvector vector readiness does not choose a route.

### C19-02 — Does Slice 19 include PostgreSQL 18 upgrade work?

NO.

Current CI already uses PostgreSQL 18. The Slice verifies/preserves the major and adds pgvector readiness.

### C19-03 — Does pgvector READY select candidate A?

NO.

A additionally requires sparsevec + DashScope sparse compatibility and later comparative Eval.

### C19-04 — Does candidate B also benefit from pgvector?

YES.

B still needs dense vector retrieval plus pg_jieba lexical retrieval/fusion. The shared dense vector substrate does not make B selected.

### C19-05 — Does candidate C benefit from pgvector?

YES.

C is dense-only and still requires the dense vector substrate.

### C19-06 — Why not combine sparsevec?

Because sparsevec has a distinct external provider payload contract and candidate-A-specific success/failure semantics. It is not required for B/C.

### C19-07 — Why not combine pg_jieba?

Because pg_jieba is candidate-B-specific, has a different extension/dictionary dependency and requires separate lexical/professional-dictionary evidence.

### C19-08 — Does this Slice create knowledge_embeddings?

NO.

Capability proof must remain isolated from production Knowledge persistence.

### C19-09 — Does this Slice need the Slice 18 RELEASED dataset?

NO.

Gold Dataset is required for retrieval-quality comparison, not for proving that PostgreSQL can execute vector operations.

Slice 18 Frozen authority is still crucial because it prevents later candidate-specific infrastructure from redefining benchmark truth.

### C19-10 — Is professional reviewer authority a real blocker?

YES for Slices 16–18 production implementation.

It is not a runtime dependency of pgvector readiness.

### C19-11 — Why not make Slice 19 the reviewer-authority Slice?

Because current Authority defines the need for staff assignment/review but does not yet define the concrete staff identity/bootstrap/grant/revoke owner needed to create a safe authority. Doing so here would risk inventing a generic RBAC/reviewer registry or fake reviewer, which upstream Frozen Specs explicitly forbid.

That candidate remains BLOCKED/DEFER, not forgotten.

### C19-12 — Does Stage A READY make Stage C READY?

NO.

Every deployment stage has independent evidence.

### C19-13 — Must Slice 19 provision Lighthouse or TencentDB?

NO.

It may evaluate a real environment if one exists, but cloud provisioning is not this Slice's responsibility.

### C19-14 — Must HNSW be enabled?

NO.

The readiness contract proves core vector capability. Performance/index design follows later measured retrieval requirements.

### C19-15 — Is extension minor version frozen here?

NO.

Authority freezes capability, not an arbitrary unverified extension minor. The exact tested extension version is recorded and pinned in readiness evidence; upgrades require revalidation.

### C19-16 — Can a mock pgvector implementation satisfy readiness?

NO.

The evidence must come from actual PostgreSQL 18 + pgvector capability.

### C19-17 — Can a successful extension create alone satisfy readiness?

NO.

Vector insert/read/distance behavior must also pass.

### C19-18 — Does this Slice require a database migration?

Not as product semantics.

Extension enablement/build/probe mechanics are Plan AI 2 decisions. No production business-schema migration is authorized merely by this Spec.

### C19-19 — Does Plan AI 1 grant development because runtime dependencies pass?

NO.

The mandatory Plan AI 2 / Audit 1 / Planning Freeze governance remains unfinished.

Clarification status:

~~~text
Open Product Decisions:
0

Open Architecture Decisions Required for Plan AI 2:
0

Clarification:
COMPLETE
~~~

Plan AI 2 still owns implementation planning details such as exact controlled image/build mechanism, evidence file/module paths and test harness shape. Those are not open product/architecture semantics.

---

## 29. Frozen Spec Boundary

This Spec freezes only:

- selection of the shared PostgreSQL 18 / pgvector vector-readiness responsibility;
- its truth boundary;
- environment-specific readiness semantics;
- vector capability minimum proof;
- explicit failure states;
- security/role boundary;
- non-goals;
- future consumer seams;
- governance gates.

It does not freeze implementation filenames, Docker image/vendor packaging, extension minor version, migration numbering, test filenames or CI job names.

Those implementation choices must preserve this contract and existing architecture.

Frozen Spec Gate requires:

~~~text
Authority Gate: PASS
Selection Gate: PASS
Authority Docs unchanged
Slice 16 authority intact
Slice 17 authority intact
Slice 18 authority intact
No competing Slice 19 authority
Open Product Decisions: 0
Open Architecture Decisions Required for Plan AI 2: 0
Scope Drift: 0
Docs Mutation: 0
Upstream Frozen Artifact Mutation: 0
Production Code Mutation: 0
Plan Created: NO
Checklist Created: NO
Tasks Created: NO
Development Performed: NO
~~~

---

## 30. Plan AI 1 Stop Boundary

Plan AI 1 stops after:

- creating this Spec on the Slice 19 spec branch;
- committing it;
- remote read-back;
- proving exact spec blob/head/base/ahead/behind/changed-file set;
- re-reading Authority inputs for drift.

Plan AI 1 MUST NOT create or modify:

- plan.md;
- checklist.md;
- tasks.md;
- production code;
- migration;
- tests;
- CI;
- package dependencies;
- Docker/deployment configuration;
- Audit 1;
- implementation PR;
- Audit 2.

Next role:

> Slice 19 Plan AI 2

---

## 31. Final Frozen Decision

~~~text
Selected Slice:
019-professional-retrieval-pgvector-readiness

Selected Responsibility:
Professional Retrieval PostgreSQL 18 / pgvector Readiness Foundation

Selection Gate:
PASS

Why:
PostgreSQL 18 is already the executable baseline; pgvector dense-vector capability is the smallest missing shared substrate required by all A/B/C retrieval candidates. The Gold Dataset benchmark authority is now Frozen, so proving the shared substrate no longer means choosing retrieval technology before evaluation. sparsevec and pg_jieba remain route-specific later responsibilities.

Planning Dependency Gate:
PASS

Runtime Dependency Gate:
PASS

Implement Gate:
BLOCKED pending mandatory Plan AI 2 / Audit 1 / Planning Freeze

Development Authorization:
NOT GRANTED

Clarification:
COMPLETE

Open Product Decisions:
0

Open Architecture Decisions Required for Plan AI 2:
0

Scope Drift:
0

READY FOR PLAN AI 2:
YES
~~~
