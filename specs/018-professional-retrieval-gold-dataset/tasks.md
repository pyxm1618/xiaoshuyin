# Slice 18 Tasks — Professional Retrieval Gold Dataset Foundation

**Repository**: pyxm1618/xiaoshuyin  
**Planning branch**: plan/018-professional-retrieval-gold-dataset  
**Frozen Spec**: 4624b3df6d59c6055421e175b95051782615de9a / bf7540ff3097ef14ca1c62a395b155abd4fde66a  
**Execution rule**: T1801 is mandatory and READ-ONLY. If T1801 is NO/BLOCKED, STOP. T1802–T1822 are not authorized in that run.

Each task must record exact-head evidence and must not infer success from a planning artifact.

---

## T1801 — Development-start Authority / Dependency Gate

**Goal**  
Decide from then-current remote truth whether any Slice 18 implementation work is authorized.

**Prerequisites**  
- Frozen Spec commit/blob available.
- Planning package Audit 1 FINAL PASS / Planning Freeze PASS.
- Remote access to current main and relevant upstream branches/commits.

**Inputs**  
- current origin/main SHA;
- four Authority Docs and blobs;
- Slice 16 Frozen Spec/planning authority and merged runtime state;
- Slice 17 Frozen Spec/planning authority and merged runtime state;
- current Scene/package owner;
- current professional/evaluation reviewer authority;
- current professional audit/review evidence seam;
- branch inventory for 018;
- current repo eval artifact inventory.

**Required behavior**  
READ-ONLY. Re-read and record all of the following:
1. Slice 17 runtime has independent Audit 2 PASS and is merged to main.
2. Merged Slice 17 can resolve exact Knowledge id/version/content hash/lifecycle/package binding.
3. A representative real PUBLISHED V1 Professional Knowledge corpus exists.
4. Required Slice 16 provenance/intervention authority is merged and usable where Slice 17 depends on it.
5. Real professional/evaluation reviewer authority exists and can produce accountable review evidence.
6. Exact Scene/package identity is available from the real owner.
7. A sanctioned professional review/audit evidence seam exists for non-family professional assets.
8. No second Knowledge/package/reviewer/eval owner is needed.
9. Frozen Spec/four Docs/Slice 16/17 semantics have no authority drift.
10. No competing Slice 18 spec/plan/feat authority exists.
11. No newly merged canonical eval artifact format makes this Plan a duplicate.

Return exactly one state:
- READY FOR DEVELOPMENT = YES; or
- READY FOR DEVELOPMENT = NO.

**Forbidden behavior**  
- no file edit;
- no code/test/migration/schema change;
- no fake Knowledge corpus;
- no synthetic corpus used to satisfy production prerequisite;
- no dummy/AI/developer/hard-coded reviewer;
- no new RBAC/audit/package owner;
- no treating plan/spec branch as runtime.

**Verification**  
- compare exact main to relevant upstream merge commits;
- read actual merged modules/persistence;
- prove representative published Knowledge records/artifacts are real;
- prove reviewer authority through actual owner/seam, not a string assertion;
- exhaust Slice 18 branch search.

**Evidence**  
A gate report with exact SHAs/blobs, owner paths/seams, corpus evidence, reviewer evidence, branch inventory and YES/NO decision.

**Mapping**  
Frozen Spec §26; FR-022/023/032; AS-018/019/026; STOP conditions.

**STOP condition**  
Any required predicate is false or unprovable. If STOP: Runtime Dependency Gate=BLOCKED, Implement Gate=BLOCKED, Development Authorization=NOT GRANTED. Execute nothing after T1801.

**Planning-time known result**  
BLOCKED: Slice 17 runtime is not merged; Slice 16 runtime is not merged; real reviewer authority is not proven.

---

## T1802 — Discover / Reuse Canonical Eval Artifact Format

**Goal**  
Ensure Slice 18 creates no parallel evaluation authority.

**Prerequisites**  
T1801 PASS.

**Inputs**  
Current repository tree, packages/contracts, eval/test fixtures, scripts, any newly merged eval tooling.

**Required behavior**  
- search for an existing authoritative eval/gold artifact family;
- distinguish test snapshots from evaluation authority;
- if a semantically equivalent canonical format exists, reuse it and document mapping to the Frozen Spec;
- otherwise establish only eval/professional-retrieval as the bounded Slice 18 artifact family described in plan.md.

**Forbidden behavior**  
- repurposing Digital Use node snapshot as Gold truth;
- adding a generic eval registry/platform;
- creating two Gold formats.

**Verification**  
Repository-wide path/content inventory plus one written format decision.

**Evidence**  
Format-discovery matrix listing candidate paths, authority status and REUSE/NOT AUTHORITY decision.

**Mapping**  
FR-001/035; NS-06/12; plan §§4–5.

**STOP condition**  
A second authoritative format exists but cannot be safely reused without changing Frozen Spec/Plan semantics.

---

## T1803 — Typed Gold Dataset Schema / Contracts

**Goal**  
Create strict machine-readable contracts for dataset, corpus, case, review binding and retirement records.

**Prerequisites**  
T1801 PASS; T1802 format decision.

**Inputs**  
Frozen Spec §§9–16, plan §§5–10, existing Zod contract conventions.

**Required behavior**  
Using existing packages/contracts + Zod:
- define dataset manifest schema;
- define corpus manifest/member schema;
- define case schema;
- define review-binding schema;
- define retirement record schema;
- export inferred TypeScript types;
- freeze finite enums for lifecycle, query origin, relevance grades, forbidden reason classes, hard-filter dimensions, label state, fixture role;
- strict-parse unknown authority-significant fields.

**Forbidden behavior**  
- production API route/schema;
- DB table/schema;
- retrieval/model/provider types;
- generic workflow state engine.

**Verification**  
Contract tests for valid minimal objects and invalid enum/unknown-field/version cases.

**Evidence**  
Changed files, test names/results, exact exported contract names.

**Mapping**  
FR-001/002/003/006/007/009/010/011/012/013/022/024/025/026/030/035; AS-001..018, AS-021..023.

**STOP condition**  
Typed contract requires inventing a new business owner or runtime API.

---

## T1804 — Corpus Manifest Identity / Hash Contract

**Goal**  
Produce a reproducible exact snapshot of the authoritative Knowledge corpus without copying Knowledge authority.

**Prerequisites**  
T1801 PASS; real merged Slice 17 resolver; T1803 contracts.

**Inputs**  
Authoritative Knowledge ids, versions, content hashes, lifecycle, scene/package contribution and source refs from Slice 17; exact Scene/package owner.

**Required behavior**  
- consume exact Slice 17 refs through the merged authoritative read seam;
- create corpus manifest payload with exact member identity/hash/lifecycle/package data;
- mark each member PRODUCTION_MEMBER or NEGATIVE_FILTER_FIXTURE;
- require positive production members to be PUBLISHED and production-eligible;
- compute corpus_manifest_hash by canonicalJsonV1 + SHA-256;
- reject unresolved/missing/implicit versions;
- preserve enough provenance refs for traceability.

**Forbidden behavior**  
- copying editable Knowledge body as second truth;
- modifying Knowledge lifecycle;
- creating a package registry;
- retrieval indexing/embedding.

**Verification**  
Tests for stable hash, changed-member hash drift, missing ref, wrong version, non-PUBLISHED positive and negative-fixture isolation.

**Evidence**  
Corpus validation output + exact resolved Knowledge refs and source owner path.

**Mapping**  
FR-003/004/005/014/026/034; AS-006/007/008/009/016/022.

**STOP condition**  
Authoritative exact Knowledge resolution is not available from merged runtime.

---

## T1805 — Case Identity / Hash / Query Provenance

**Goal**  
Create stable immutable case identity and permitted query-origin semantics.

**Prerequisites**  
T1803; T1804.

**Inputs**  
Frozen Spec §11/§16; plan §§6/8.

**Required behavior**  
- stable case_id;
- exact dataset_version;
- query_text;
- allowed query_origin_type;
- scenario/context;
- requirement_refs;
- rationale;
- review_binding_id;
- case_hash using canonicalJsonV1 + SHA-256 excluding self-hash;
- reject real-family origin categories and floating source identity.

**Forbidden behavior**  
- raw customer/chat/case export;
- real family/account/person/case identifiers;
- AI approval.

**Verification**  
Hash determinism, semantic-change hash drift, allowed/forbidden provenance matrix.

**Evidence**  
Contract tests and validator evidence.

**Mapping**  
FR-006/007/008/030/034; AS-012/018/020/023.

**STOP condition**  
Production case authoring would require real household data.

---

## T1806 — Relevant / Graded / Forbidden / Expected-Empty / UNKNOWN Semantics

**Goal**  
Mechanically separate all label states required by Frozen Spec.

**Prerequisites**  
T1803/T1805.

**Inputs**  
Plan §9.

**Required behavior**  
- relevance grade PRIMARY=2;
- relevance grade SUPPORTING=1;
- only positives in expected_relevant;
- forbidden_results separate, exact and reason-classed;
- expected_empty explicit;
- label_state RESOLVED/UNRESOLVED;
- RELEASED requires RESOLVED;
- expected_empty requires expected_relevant empty;
- same exact ref cannot be both positive and forbidden;
- forbidden reason retains authority_refs.

**Forbidden behavior**  
- treating UNKNOWN as irrelevant;
- treating UNKNOWN as expected_empty;
- treating forbidden as merely low score;
- turning relevance gain into business eligibility.

**Verification**  
Positive/negative matrix including AS-001/002/014/015 and overlap failures.

**Evidence**  
Exact schema assertions and failure codes.

**Mapping**  
FR-009/010/011/012/019/020; AS-001/002/014/015/025.

**STOP condition**  
Any representation collapses distinct Frozen Spec semantics.

---

## T1807 — Hard-Filter Expectation Representation

**Goal**  
Represent expected retrieval/filter behavior without creating a second rule engine.

**Prerequisites**  
T1803/T1804/T1806.

**Inputs**  
Existing Scene/package, Slice 17 Knowledge metadata, Slice 16 applicability/provenance where applicable.

**Required behavior**  
Support dimensions:
- SCENE;
- STAGE;
- AGE_OR_DEVELOPMENT;
- PACKAGE_VERSION;
- LIFECYCLE;
- APPLICABILITY;
- EXCLUSION_OR_CONTRAINDICATION;
- RISK_COMPATIBILITY.

Each expectation records ALLOW/EXCLUDE/EXPECT_EMPTY + authority_refs + rationale.

**Forbidden behavior**  
- reimplementing Scene routing;
- copying Safety/Compliance/Authorization logic;
- changing Knowledge/Intervention eligibility;
- runtime evaluator.

**Verification**  
Cases for wrong scene/stage/age/package/lifecycle/exclusion with exact upstream refs.

**Evidence**  
Schema + test matrix showing expected behavior only.

**Mapping**  
FR-013/014/015/016/020/032; AS-003..011, AS-025/026.

**STOP condition**  
A dimension cannot be represented without duplicating an upstream owner.

---

## T1808 — Real Review Evidence Binding

**Goal**  
Bind released labels to authentic external professional/evaluation review authority.

**Prerequisites**  
T1801 proves real reviewer authority; T1803/T1804/T1805.

**Inputs**  
Real reviewer owner/seam, exact case hashes, exact corpus hash.

**Required behavior**  
- create immutable review binding with review_owner_ref, review_evidence_ref, reviewed_case_hashes, reviewed_corpus_manifest_hash, APPROVED_FOR_GOLD_RELEASE decision, reviewed_at and binding_hash;
- resolve reviewer/evidence through the actual sanctioned authority during release creation;
- invalidate binding if any reviewed case/corpus payload changes.

**Forbidden behavior**  
- AI reviewer;
- retrieval/model candidate self-grading;
- developer flag;
- fixture reviewer;
- hard-coded admin;
- family account authority;
- new generic reviewer/RBAC service.

**Verification**  
Valid authority-backed binding passes; missing authority, changed hash, candidate self-approval and fake fixture cases fail.

**Evidence**  
Exact owner/seam path, evidence ref, binding hash, test results.

**Mapping**  
FR-022/023; AS-018/019/023; NS-12.

**STOP condition**  
Real reviewer authority or evidence seam is absent/unavailable.

---

## T1809 — Release Lifecycle / Immutability / Successor / Retirement

**Goal**  
Implement DRAFT→REVIEWED→RELEASED→RETIRED semantics without mutating released bytes.

**Prerequisites**  
T1803/T1808.

**Inputs**  
Plan §7.

**Required behavior**  
- DRAFT mutable and non-evidence;
- REVIEWED binds exact payload;
- RELEASED immutable;
- RETIRED derived from append-only retirement record;
- substantive correction creates a new dataset_version;
- successor records exact predecessor;
- old release preserved;
- retired release barred from new route-approval evidence.

**Forbidden behavior**  
- editing released manifest/cases in place;
- replacing old release;
- mutable latest alias;
- second workflow engine.

**Verification**  
Lifecycle tests, mutation rejection, successor chain, retirement history.

**Evidence**  
Exact failure/success traces + immutable old blob/hash proof.

**Mapping**  
FR-024/025/026; AS-017/028; NS-15/17.

**STOP condition**  
Lifecycle design requires in-place mutation of released artifact.

---

## T1810 — Deterministic Offline Validator

**Goal**  
Create one deterministic validator for contracts, hashes, refs, review, lifecycle, privacy and coverage.

**Prerequisites**  
T1803–T1809.

**Inputs**  
All Slice 18 artifact files plus authoritative resolution input required by release build.

**Required behavior**  
Implement failure codes at least:
SCHEMA_INVALID, HASH_MISMATCH, DUPLICATE_CASE_ID, FLOATING_REFERENCE, REFERENCE_INVALID, CORPUS_MISMATCH, UNRESOLVED_LABEL, EXPECTED_EMPTY_CONFLICT, FORBIDDEN_POSITIVE_OVERLAP, REVIEW_MISSING, REVIEW_BINDING_MISMATCH, PRIVACY_GUARD_FAILED, IMMUTABLE_RELEASE_MODIFIED, SUCCESSOR_INVALID, SYNTHETIC_EVIDENCE_FORBIDDEN, COVERAGE_INCOMPLETE.

Validator must run offline/CI after required authoritative snapshot inputs are materialized.

**Forbidden behavior**  
- provider/model network calls;
- retrieval execution;
- generic platform installation.

**Verification**  
Happy-path synthetic structure + every negative self-test from T1813/T1817/T1818/T1819.

**Evidence**  
CLI output, exit codes, machine-readable failure objects.

**Mapping**  
FR-030/031/033; AS-021/022/023/027/028.

**STOP condition**  
Validation depends on a live model/provider or non-reproducible external state.

---

## T1811 — Privacy / No-Real-Family-Data Guard

**Goal**  
Prevent released benchmark artifacts from containing raw/identifiable family or minor data.

**Prerequisites**  
T1805/T1810.

**Inputs**  
Case/query/rationale/provenance/review metadata.

**Required behavior**  
- allow only approved synthetic/professional query origins;
- reject family_id/account_id/person_id/real case_id fields;
- reject known direct-identifier patterns such as email and phone-like values;
- reject raw customer/private-chat/export provenance markers;
- require review privacy attestation for release.

**Forbidden behavior**  
- claiming regex proves complete anonymization;
- deriving Gold data from real households in Slice 18.

**Verification**  
Known-bad synthetic identifier fixtures fail with PRIVACY_GUARD_FAILED; approved professional synthetic fixtures pass.

**Evidence**  
Privacy test matrix and release review attestation field.

**Mapping**  
FR-008/033; AS-020/027; NS-11.

**STOP condition**  
A proposed production case is derived from real family/minor data.

---

## T1812 — Exact Reference / No-Floating-Latest Guard

**Goal**  
Mechanically enforce exact dataset/corpus/Knowledge identities.

**Prerequisites**  
T1804/T1810.

**Inputs**  
Manifest/corpus/case refs.

**Required behavior**  
Reject:
- latest/current aliases;
- missing version;
- implicit corpus;
- missing Knowledge ref;
- hash mismatch;
- positive ref outside corpus;
- wrong package/version snapshot.

**Forbidden behavior**  
No fallback resolution to latest.

**Verification**  
Dedicated violating samples for every forbidden reference pattern.

**Evidence**  
REFERENCE_INVALID/FLOATING_REFERENCE/CORPUS_MISMATCH assertions.

**Mapping**  
FR-002/003/004/031; AS-006/016/021/022/023; NS-15.

**STOP condition**  
Any release path resolves a ref dynamically to latest.

---

## T1813 — Synthetic Validator Fixture Isolation

**Goal**  
Provide validator self-tests without creating fake production-quality evidence.

**Prerequisites**  
T1810.

**Inputs**  
eval/professional-retrieval/synthetic/validator-self-test.

**Required behavior**  
- all fixture manifests declare SYNTHETIC;
- synthetic corpus members use obviously non-production identities;
- validator can run against them;
- production release/evidence command rejects synthetic identity.

**Forbidden behavior**  
- counting synthetic fixture coverage as real benchmark quality;
- using synthetic Knowledge to satisfy T1801.

**Verification**  
Synthetic structure passes mechanics; attempt to label it production fails SYNTHETIC_EVIDENCE_FORBIDDEN.

**Evidence**  
Two explicit command/test results.

**Mapping**  
FR-033; AS-027; NS-16.

**STOP condition**  
Synthetic fixtures are indistinguishable from production releases.

---

## T1814 — Required Coverage + Metric Compatibility Projection

**Goal**  
Ensure real released labels support all Frozen coverage dimensions and future metrics, without running any candidate.

**Prerequisites**  
T1801 PASS and real corpus/reviewer; T1804–T1811.

**Inputs**  
Real professionally authored/reviewed cases.

**Required behavior**  
- create/validate representative cases for all 18 required coverage dimensions;
- preserve PRIMARY/SUPPORTING gains;
- expose a pure projection for future Recall@K/nDCG@K/MRR, forbidden leakage, expected-empty and hard-filter fidelity;
- expose pre/post-rerank compatible label shape only;
- make coverage validator reject missing dimensions.

**Forbidden behavior**  
- A/B/C execution;
- embedding/reranker call;
- latency/cost measurement;
- winner threshold;
- route selection.

**Verification**  
Coverage matrix maps every dimension to at least one real case_id; projection tests use static result lists only to prove shape/math inputs, not candidate quality.

**Evidence**  
Coverage matrix + projection tests.

**Mapping**  
FR-016/017/018/019/020/021/027/028; AS-010..014/024/025; NS-14.

**STOP condition**  
A required dimension cannot be authored/reviewed from the real corpus without fabricating professional truth.

---

## T1815 — Future Eval Consumer Exact-Evidence Contract

**Goal**  
Define the exact immutable handoff future A/B/C/embedding/reranker evaluators must consume.

**Prerequisites**  
T1803/T1804/T1814.

**Inputs**  
Release identity.

**Required behavior**  
Consumer contract requires:
- git_commit_sha;
- dataset_version;
- manifest_hash;
- corpus_manifest_version;
- corpus_manifest_hash;
- case hashes;
- review_bindings_hash.

Consumer may read labels but cannot mutate them.

**Forbidden behavior**  
- friendly-name-only dataset selection;
- latest alias;
- production route winner decision;
- evaluator writing Gold labels.

**Verification**  
Contract rejects incomplete/floating evidence refs and mutation fields.

**Evidence**  
Typed consumer contract tests.

**Mapping**  
FR-018/021/031; AS-024; NS-15/18.

**STOP condition**  
Consumer contract would require retrieval implementation in Slice 18.

---

## T1816 — Negative Scope / Static Guard

**Goal**  
Mechanically prevent Slice 18 from expanding into RAG/AI/DB/platform work.

**Prerequisites**  
T1802 format decision.

**Inputs**  
Git delta from exact development base + package dependency delta.

**Required behavior**  
Fail on unauthorized changes to:
- db/migrations/**;
- Gold persistence under db/schema/**;
- packages/rag/**;
- packages/ai/**;
- packages/memory/**;
- production Gold API routes;
- provider/model network call modules;
- pgvector/sparsevec/pg_jieba/pg_textsearch runtime;
- retrieval/ranking/reranking/fusion execution;
- generic RBAC/CMS/workflow/eval registry;
- dependencies added solely for forbidden capabilities.

Provide a pure detector testable with synthetic path/dependency lists.

**Forbidden behavior**  
Guard exemptions that silently allow the same forbidden capability elsewhere.

**Verification**  
Known-bad synthetic delta samples fail; allowed contracts/eval/scripts/tests delta passes.

**Evidence**  
Scope-test matrix and exact diff.

**Mapping**  
FR-027/028/029/032/035; NS-01..14/18.

**STOP condition**  
Implementation requires any forbidden capability.

---

## T1817 — Artifact Integrity / Hash Tests

**Goal**  
Prove hash and manifest integrity are non-vacuously enforced.

**Prerequisites**  
T1803/T1810.

**Inputs**  
Canonical hash functions and synthetic fixtures.

**Required behavior**  
Test:
- object-key reordering stable;
- array reordering changes hash where order is semantic;
- payload edit changes hash;
- wrong case hash rejected;
- wrong corpus hash rejected;
- wrong manifest hash rejected;
- wrong review_bindings_hash rejected.

**Forbidden behavior**  
Tests that only compute hashes without a known wrong-hash failure sample.

**Verification**  
Specific HASH_MISMATCH assertions.

**Evidence**  
Vitest output.

**Mapping**  
FR-002/003/006/022/030/031; AS-023.

**STOP condition**  
Hash verification can be bypassed by reserializing or omitting authority-significant fields.

---

## T1818 — Lifecycle / Successor / Immutability Tests

**Goal**  
Prove released history cannot be silently rewritten.

**Prerequisites**  
T1809/T1810.

**Inputs**  
Synthetic release history plus, when available, real release delta.

**Required behavior**  
Test:
- released directory modification rejected;
- released file deletion rejected;
- successor uses new dataset_version;
- predecessor exact and existing;
- retirement record append-only;
- retired release rejected for new approval evidence;
- original old hashes remain unchanged.

**Forbidden behavior**  
In-place correction.

**Verification**  
IMMUTABLE_RELEASE_MODIFIED and SUCCESSOR_INVALID negative assertions plus valid successor case.

**Evidence**  
Lifecycle test output and hash comparison.

**Mapping**  
FR-024/025/026; AS-017; NS-17.

**STOP condition**  
History cannot be proven immutable.

---

## T1819 — Privacy / Reference / Review Negative Tests

**Goal**  
Close the highest-risk release-validation negatives with executable proof.

**Prerequisites**  
T1808/T1811/T1812.

**Inputs**  
Synthetic known-bad fixtures.

**Required behavior**  
At minimum prove failure for:
- raw customer origin;
- direct identifier;
- latest ref;
- missing Knowledge version;
- positive non-PUBLISHED member;
- expected ref outside corpus;
- absent reviewer evidence;
- changed case hash after review;
- AI/candidate/test-fixture approval.

**Forbidden behavior**  
Any fake reviewer accepted merely because a field is populated.

**Verification**  
Assert exact reason code for each case.

**Evidence**  
Named negative test matrix.

**Mapping**  
FR-004/008/022/023/030; AS-018..023; NS-11/15.

**STOP condition**  
Any invalid sample is accepted by the release validator.

---

## T1820 — Exact Traceability Matrix

**Goal**  
Provide Audit 2 a mechanical mapping from every Frozen requirement/scenario to implementation evidence.

**Prerequisites**  
T1802–T1819 complete.

**Inputs**  
FR-001..035; AS-001..028; NS-01..18; actual files/tests/commands.

**Required behavior**  
Create a traceability artifact/evidence table mapping each:
- FR -> file/function/test/command;
- AS -> fixture/test/result;
- NS -> scope guard/diff/test;
- coverage dimension -> real case_id.

No requirement may map only to prose.

**Forbidden behavior**  
- marking BLOCKED prerequisite as PASS;
- mapping a synthetic validator fixture as real production retrieval evidence.

**Verification**  
Coverage audit reports zero unmapped FR/AS/NS.

**Evidence**  
Exact traceability matrix bound to head.

**Mapping**  
All FR/AS/NS.

**STOP condition**  
Any requirement lacks executable or artifact evidence.

---

## T1821 — Exact-Head Full Regression

**Goal**  
Prove Slice 18 exact head preserves repository behavior and all Slice 18 guards.

**Prerequisites**  
All implementation tasks complete; exact head stable.

**Inputs**  
Final branch head.

**Required behavior**  
Run at least:
- full TypeScript typecheck;
- full Vitest regression;
- existing guard:static;
- Slice 18 validator;
- Slice 18 scope guard;
- governance validator + governance self-test;
- any existing verify-all path required by current main;
- exact diff review against implementation base.

Do not edit tests merely to hide a regression.

**Forbidden behavior**  
- stale-head evidence;
- partial suite reported as full suite;
- uncommitted evidence mutation after run.

**Verification**  
All required commands PASS on the same exact head, except explicitly external/non-Slice gates must be reported truthfully rather than fabricated.

**Evidence**  
Command, exit code, exact head SHA, relevant outputs.

**Mapping**  
FR-030/031/035; Audit 2 readiness.

**STOP condition**  
Any blocking regression, scope drift or head drift.

---

## T1822 — Evidence Freeze / Audit 2 Handoff

**Goal**  
Freeze one exact implementation head and evidence package for independent Audit 2.

**Prerequisites**  
T1821 PASS.

**Inputs**  
Final remote head, spec blob, implementation diff, validation/regression evidence, release evidence if a real release was authorized.

**Required behavior**  
Remote read-back must record:
- origin/main base used for development;
- feature branch exact head;
- merge-base, ahead/behind;
- Frozen Spec blob;
- changed files;
- Gold contract/artifact blobs;
- validator/scope guard evidence;
- traceability matrix;
- exact dataset/corpus/review hashes if a real RELEASED dataset exists;
- explicit statement whether a production-quality release was or was not created.

Audit 2 handoff must separate:
- validator synthetic evidence;
- real professional corpus/review evidence;
- future retrieval execution, which remains absent.

**Forbidden behavior**  
- PR merge;
- claiming A/B/C quality evidence;
- claiming route selection;
- claiming synthetic fixtures are production Gold;
- altering Frozen Spec.

**Verification**  
Second remote read-back confirms the same exact head and blobs.

**Evidence**  
Audit 2 handoff report bound to exact head.

**Mapping**  
FR-018/028/030/031/033; AS-024/027/028; NS-14/16.

**STOP condition**  
Remote head/blob drift or incomplete evidence.

---

# Task Dependency Summary

~~~text
T1801 GATE
  |
  +-- NO -> STOP
  |
  +-- YES
       -> T1802
       -> T1803
       -> T1804
       -> T1805
       -> T1806
       -> T1807
       -> T1808
       -> T1809
       -> T1810
       -> T1811
       -> T1812
       -> T1813
       -> T1814
       -> T1815
       -> T1816
       -> T1817
       -> T1818
       -> T1819
       -> T1820
       -> T1821
       -> T1822
       -> STOP FOR AUDIT 2
~~~

# Planning-Time Gate Result

As of the Plan AI 2 planning baseline:

~~~text
Slice 17 runtime merged: NO
Slice 16 runtime merged where required: NO
Real professional/evaluation reviewer authority proven: NO

Runtime Dependency Gate: BLOCKED
Implement Gate: BLOCKED
Development Authorization: NOT GRANTED
READY FOR DEVELOPMENT: NO
~~~

This blocked implementation state is intentional and does not prevent Plan/Checklist/Tasks from being complete or Planning Freeze from passing.
