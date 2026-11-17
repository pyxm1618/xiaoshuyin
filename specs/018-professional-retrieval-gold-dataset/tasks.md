# Slice 18 Tasks — Professional Retrieval Gold Dataset Foundation

**Repository**: pyxm1618/xiaoshuyin  
**Planning branch**: plan/018-professional-retrieval-gold-dataset-authority-reconciliation  
**Reconciled Frozen Spec**: f4ea6d8acfb175f15c6198e6b5e4354daf1102e6 / 16bed255125677de0dcc4ec71d740f1b0efaeccf  
**Previous Frozen Spec**: 4624b3df6d59c6055421e175b95051782615de9a / bf7540ff3097ef14ca1c62a395b155abd4fde66a  
**Execution rule**: T1801 is mandatory and READ-ONLY. If T1801 is NO/BLOCKED, STOP. T1802–T1822 are not authorized in that run.

Each task must record exact-head evidence and must not infer success from a planning artifact.

---

## T1801 — Development-start Authority / Dependency Gate

**Goal**  
Decide from then-current remote truth whether any Slice 18 implementation work is authorized.

**Prerequisites**  
- Reconciled Frozen Spec exact commit/blob available.
- Planning package Audit 1 FINAL PASS / Planning Freeze PASS.
- Remote access to current main and relevant upstream branches/PRs.

**Inputs**  
- current origin/main SHA;
- current four Authority Docs and blobs;
- reconciled Slice 18 Spec/Plan/Checklist/Tasks identities;
- Slice 16 merge/audit/remediation/runtime truth;
- Slice 17 merge/Audit 2/runtime truth;
- current Professional Knowledge resolver/corpus truth;
- current Scene/package owner;
- current Staff/PROFESSIONAL_REVIEW/qualification authority;
- current professional approval/review evidence seam;
- exhaustive 018 branch inventory.

**Required behavior**  
READ-ONLY. Re-read and record all of the following:
1. current main exact SHA;
2. reconciled Slice 18 Frozen Spec exact blob and unique current authority;
3. Slice 16 current merge state, post-merge audit state, remediation state and runtime dependency usability;
4. Slice 17 current merge state, independent Audit 2 result and runtime dependency usability;
5. exact merged Knowledge id/version/content hash/lifecycle/package resolution;
6. representative real PUBLISHED Professional Knowledge corpus;
7. real Staff assignment for the approving reviewer;
8. current PROFESSIONAL_REVIEW capability;
9. matching professional qualification with auditable qualification_ref and canonical qualification_scope;
10. auditable reviewer identity;
11. sanctioned professional review/approval evidence seam;
12. approval binding supports exact artifact/package identity, immutable version/content hash, source refs, approval scope, reviewer identity, qualification_ref, qualification_scope, reviewed_at, approval status and effective/published identity;
13. exact Scene/package identity from its real owner;
14. no duplicate Knowledge/package/reviewer/eval owner is required;
15. no current Authority drift in the four Docs/reconciled Spec/consumed upstream contracts;
16. no competing Slice 18 authority exists.

Return exactly one state:
- READY FOR DEVELOPMENT = YES; or
- READY FOR DEVELOPMENT = NO.

**Forbidden behavior**  
- no file edit;
- no code/test/migration/schema/validator/fixture change;
- no real Gold label creation;
- no fake Knowledge corpus or synthetic corpus used to satisfy production prerequisites;
- no string-only reviewer id, dummy/AI/developer/fixture/family-role/hard-coded-admin approval;
- no Staff/RBAC/qualification/reviewer/eval owner creation;
- no treating plan/spec/feature branch as merged runtime;
- no treating merged state alone as proof of clean/usable upstream runtime.

**Verification**  
- compare exact main to upstream merge/remediation heads;
- verify independent audit/remediation status separately from merge state;
- read actual merged Knowledge owner/seams and representative published corpus;
- prove reviewer Staff assignment, PROFESSIONAL_REVIEW and qualification/scope through actual authority owner, not a populated field;
- prove approval binding shape and current validity;
- exhaust Slice 18 branch search.

**Evidence**  
A gate report with exact SHAs/blobs, merge/audit/remediation states, owner paths/seams, corpus evidence, reviewer authority/qualification evidence, approval-binding evidence, branch inventory and YES/NO decision.

**Mapping**  
Reconciled Spec §26/§27A; FR-022/023/032/036/040; AS-018/019/026/029..032; STOP conditions.

**STOP condition**  
Any required predicate is false or unprovable. If STOP: Runtime Dependency Gate=BLOCKED, Implement Gate=BLOCKED, Development Authorization=NOT GRANTED. Execute nothing after T1801.

**Planning-time known result**  
BLOCKED: Slice 16 is merged but clean/runtime usability is not yet proven after post-merge forensic findings and unmerged remediation; Slice 17 PR #58 is not merged; APPROVED PROFESSIONAL REVIEWER — UNASSIGNED.

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
Create strict machine-readable contracts for dataset, corpus, case, Professional approval binding, retirement and append-only revalidation records.

**Prerequisites**  
T1801 PASS; T1802 format decision.

**Inputs**  
Frozen Spec §§9–16, plan §§5–10, existing Zod contract conventions.

**Required behavior**  
Using existing packages/contracts + Zod:
- define dataset manifest schema;
- define corpus manifest/member schema;
- define case schema;
- define Professional approval/review-binding schema;
- define retirement record schema;
- define append-only revalidation/validity-event schema;
- export inferred TypeScript types;
- freeze finite enums for artifact lifecycle_status, review_state/validity, query origin, relevance grades, forbidden reason classes, hard-filter dimensions, label state and fixture role; explicitly reject REVIEWED as a lifecycle status;
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
FR-001/002/003/006/007/009/010/011/012/013/022/024/025/026/030/035/037/038/041/042; AS-001..018, AS-021..023, AS-033..037.

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

## T1808 — Professional Approval Evidence Binding

**Goal**  
Bind released professional Gold labels/rubrics to authentic Professional Authority.

**Prerequisites**  
T1801 proves real reviewer Staff/capability/qualification authority; T1803/T1804/T1805.

**Inputs**  
Real Professional Authority owner/seam, Staff assignment ref, PROFESSIONAL_REVIEW grant/capability ref, reviewer identity, qualification_ref, qualification_scope, approval_scope, exact case hashes, exact corpus hash, exact source refs.

**Required behavior**  
- create immutable approval/review binding that records reviewer Staff assignment, PROFESSIONAL_REVIEW authority, qualification_ref, qualification_scope, approval_scope, reviewer identity, exact artifact/package identity, exact dataset/case hashes, exact corpus hash, source refs, reviewed_at, approval status, effective/published identity and binding_hash;
- resolve all reviewer/qualification/approval evidence through the actual sanctioned authority during release creation;
- require qualification scope to match approval scope;
- invalidate current use of the affected binding when assignment/capability/qualification is revoked, qualification scope no longer matches, approval expires/is withdrawn, or any approved artifact/case/corpus hash changes.

**Forbidden behavior**  
- AI reviewer;
- retrieval/model candidate self-grading;
- developer flag;
- fixture reviewer;
- hard-coded/generic admin;
- family/guardian role authority;
- PROFESSIONAL_REVIEW capability without matching professional qualification;
- string-shaped reviewer id treated as authority;
- new Staff/RBAC/qualification/reviewer service.

**Verification**  
Valid Staff assignment + PROFESSIONAL_REVIEW + matching qualification/scope + exact current approval passes. Missing/revoked assignment, wrong/revoked capability, wrong qualification, wrong qualification scope, stale/expired/withdrawn approval, changed hash, candidate/AI/developer/fixture/family-role reviewer all fail closed.

**Evidence**  
Exact owner/seam path, assignment/capability/qualification refs, approval evidence ref, approval/binding hash, exact negative test results.

**Mapping**  
FR-022/023/036/040; AS-018/019/023/029..032; NS-12.

**STOP condition**  
Any required real reviewer authority, qualification/scope or approval evidence seam is absent/unavailable.

---
## T1809 — Lifecycle / Review-State / Validity / Dependency Revalidation

**Goal**  
Implement lifecycle separately from review/validity state while preserving immutable released bytes and affected-only dependency propagation.

**Prerequisites**  
T1803/T1808.

**Inputs**  
Plan §§7/11/12; exact dependency refs; current Professional approval evidence.

**Required behavior**  
- artifact lifecycle is DRAFT -> RELEASED -> RETIRED; REVIEWED is rejected as a lifecycle value;
- review_state is CURRENT or NEEDS_REVIEW; validity may independently become INVALID when current use is no longer lawful/professionally valid;
- DRAFT is mutable and non-evidence;
- RELEASED bytes are immutable;
- RELEASED + CURRENT/VALID may be used only with current approval/dependencies;
- RELEASED + NEEDS_REVIEW remains historical but is barred from current route/model approval evidence;
- Knowledge version/content/provenance changes, professional approval withdrawal/expiry, reviewer qualification/scope changes, package/policy/professional-asset changes trigger impact analysis;
- only dataset/case objects with real dependency refs to the changed upstream object enter NEEDS_REVIEW; unrelated objects remain unchanged;
- no-material-impact re-review appends revalidation evidence and restores/retains CURRENT/VALID without modifying release bytes;
- material-impact re-review requires a new professionally approved successor dataset_version with exact predecessor;
- permanently unusable dependency makes the exact affected object invalid for current use;
- RETIRED is derived from append-only retirement history only when lifecycle owner intentionally withdraws the release; NEEDS_REVIEW never mechanically becomes RETIRED;
- old release bytes/hashes remain preserved.

**Forbidden behavior**  
- editing released manifest/cases in place;
- blanket invalidation/retirement of all datasets for an unrelated upstream change;
- using RETIRED to stand in for review-required;
- continuing to use NEEDS_REVIEW/INVALID release as current authoritative route approval evidence;
- mutable latest alias;
- second workflow/review engine.

**Verification**  
Tests cover RELEASED+CURRENT, RELEASED+NEEDS_REVIEW, related vs unrelated dependency drift, no-material-impact re-review, material-impact successor, invalidation, intentional retirement and immutable old bytes.

**Evidence**  
Exact state/impact traces + immutable old blob/hash proof + dependency-ref impact evidence.

**Mapping**  
FR-024/025/026/037/038/039/041/042; AS-016/017/028/033..037; NS-15/17.

**STOP condition**  
Design requires in-place release mutation, blanket invalidation, or conflates lifecycle with review/validity.

---
## T1810 — Deterministic Offline Validator

**Goal**  
Create one deterministic validator for contracts, hashes, refs, Professional approval, lifecycle/review/validity, dependency revalidation, privacy and coverage.

**Prerequisites**  
T1803–T1809.

**Inputs**  
All Slice 18 artifact files plus authoritative resolution input required by release build.

**Required behavior**  
Implement failure codes at least:
SCHEMA_INVALID, HASH_MISMATCH, DUPLICATE_CASE_ID, FLOATING_REFERENCE, REFERENCE_INVALID, CORPUS_MISMATCH, UNRESOLVED_LABEL, EXPECTED_EMPTY_CONFLICT, FORBIDDEN_POSITIVE_OVERLAP, REVIEW_MISSING, REVIEW_BINDING_MISMATCH, PROFESSIONAL_AUTHORITY_INVALID, QUALIFICATION_SCOPE_MISMATCH, APPROVAL_STALE, REVALIDATION_REQUIRED, DEPENDENCY_INVALID, PRIVACY_GUARD_FAILED, IMMUTABLE_RELEASE_MODIFIED, SUCCESSOR_INVALID, SYNTHETIC_EVIDENCE_FORBIDDEN, COVERAGE_INCOMPLETE.

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
FR-030/031/033/038/040/041/042; AS-021/022/023/027/028/029..037.

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

## T1818 — Lifecycle / Dependency Revalidation / Successor / Immutability Tests

**Goal**  
Prove released history cannot be silently rewritten and dependency/review drift affects only genuinely dependent objects.

**Prerequisites**  
T1809/T1810.

**Inputs**  
Synthetic release/dependency history plus, when available, real release delta.

**Required behavior**  
Test:
- REVIEWED rejected as lifecycle value;
- RELEASED + CURRENT/VALID eligible only when approval/dependencies current;
- RELEASED + NEEDS_REVIEW rejected for current route approval evidence;
- referenced upstream content hash change marks affected benchmark state NEEDS_REVIEW;
- unrelated upstream change leaves unrelated benchmark CURRENT;
- reviewer qualification/capability/assignment revocation invalidates only affected approval/evidence;
- package version supersession sends affected dataset/cases into revalidation path;
- no-material-impact re-review restores CURRENT/VALID via append-only evidence;
- material-impact re-review requires successor new dataset_version;
- invalid dependency blocks current use;
- released directory modification/deletion rejected;
- predecessor exact and existing;
- retirement record append-only and never used as automatic review replacement;
- original old hashes remain unchanged.

**Forbidden behavior**  
In-place correction, blanket invalidation, or automatic RELEASED->RETIRED for review drift.

**Verification**  
Assert exact REVALIDATION_REQUIRED / DEPENDENCY_INVALID / IMMUTABLE_RELEASE_MODIFIED / SUCCESSOR_INVALID outcomes plus valid unaffected and valid re-review cases.

**Evidence**  
Lifecycle/dependency test output, impact mapping and hash comparison.

**Mapping**  
FR-024/025/026/037/038/039/041/042; AS-016/017/033..037; NS-17.

**STOP condition**  
History/affected-only propagation/immutability cannot be mechanically proven.

---
## T1819 — Privacy / Reference / Professional-Authority Negative Tests

**Goal**  
Close the highest-risk release-validation negatives with executable proof.

**Prerequisites**  
T1808/T1811/T1812.

**Inputs**  
Synthetic known-bad fixtures and authority-binding counterfactuals.

**Required behavior**  
At minimum prove failure for:
- raw customer origin;
- direct identifier;
- latest ref;
- missing Knowledge version;
- positive non-PUBLISHED member;
- expected ref outside corpus;
- absent reviewer evidence;
- changed case/corpus hash after approval;
- wrong capability;
- revoked capability;
- missing/revoked Staff assignment;
- wrong/revoked qualification;
- qualification scope mismatch;
- approval scope mismatch;
- stale/expired/withdrawn approval;
- AI/candidate/test-fixture/developer/family-role approval.

**Forbidden behavior**  
Any fake or stale reviewer authority accepted merely because an id/status field is populated.

**Verification**  
Assert exact reason code for each case.

**Evidence**  
Named negative test matrix.

**Mapping**  
FR-004/008/022/023/030/036/040; AS-018..023/029..032; NS-11/12/15.

**STOP condition**  
Any invalid authority/reference/privacy sample is accepted by the release validator.

---
## T1820 — Exact Traceability Matrix

**Goal**  
Provide Audit 2 a mechanical mapping from every Frozen requirement/scenario to implementation evidence.

**Prerequisites**  
T1802–T1819 complete.

**Inputs**  
FR-001..042; AS-001..037; NS-01..18; actual files/tests/commands.

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
Coverage audit reports zero unmapped FR-001..042 / AS-001..037 / NS-01..18.

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
- exact dataset/corpus/Professional-approval/revalidation hashes if a real RELEASED dataset exists;
- explicit statement whether a production-quality release was or was not created.

Audit 2 handoff must separate:
- validator synthetic evidence;
- real professional corpus + Staff/PROFESSIONAL_REVIEW/qualification/approval evidence;
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

As of the Authority Reconciliation planning baseline:

~~~text
Slice 16 merged: YES
Slice 16 clean/runtime prerequisite proven: NO
Slice 16 remediation: EXISTS ON UNMERGED BRANCH

Slice 17 implementation exists: YES
Slice 17 runtime merged to main: NO

APPROVED PROFESSIONAL REVIEWER assigned: NO
PROFESSIONAL_REVIEW + matching qualification/scope approval path proven usable: NO

Runtime Dependency Gate: BLOCKED
Implement Gate: BLOCKED
Development Authorization: NOT GRANTED
READY FOR DEVELOPMENT: NO
~~~

This blocked implementation state is intentional and does not prevent Plan/Checklist/Tasks from being complete or Planning Freeze from passing.
