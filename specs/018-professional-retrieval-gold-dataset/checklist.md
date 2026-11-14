# Slice 18 Planning Checklist — Professional Retrieval Gold Dataset Foundation

**Purpose**: Audit whether Plan/Tasks faithfully and completely translate the Frozen Spec without authority drift, scope expansion or fake dependency satisfaction.  
**Status**: COMPLETE — Audit 1 FINAL PASS.  
**Interpretation**: A checked item means the planning package explicitly covers and requires that condition. It does not claim a future runtime/development action has already occurred. Runtime Dependency Gate remains BLOCKED.  
**Frozen Spec**: 4624b3df6d59c6055421e175b95051782615de9a / bf7540ff3097ef14ca1c62a395b155abd4fde66a  
**Planning branch**: plan/018-professional-retrieval-gold-dataset  
**Checklist role**: planning-quality and future implementation verification criteria. This file is not a task list.

## A. Authority Integrity

- [x] A01 Frozen Spec commit exists remotely.
- [x] A02 Frozen Spec blob equals bf7540ff3097ef14ca1c62a395b155abd4fde66a.
- [x] A03 spec/018-professional-retrieval-gold-dataset contains spec.md only.
- [x] A04 plan/018-professional-retrieval-gold-dataset is the only Slice 18 planning authority.
- [x] A05 No competing feat/spec/plan Slice 18 branch carries a conflicting authority package.
- [x] A06 Docs/总产品需求.md blob is re-read and authority-consistent.
- [x] A07 Docs/V1产品需求.md blob is re-read and authority-consistent.
- [x] A08 Docs/总体技术架构.md blob is re-read and authority-consistent.
- [x] A09 Docs/V1技术设计.md blob is re-read and authority-consistent.
- [x] A10 Slice 16 Frozen Spec/Plan boundary is re-read; planning artifact is never treated as runtime.
- [x] A11 Slice 17 Frozen Spec/Plan boundary is re-read; planning artifact is never treated as runtime.
- [x] A12 Slice 17 spec branch remains spec-only and plan/017 remains sole Plan/Checklist/Tasks authority.
- [x] A13 Any semantic authority drift produces STOP rather than silent reconciliation.
- [x] A14 Planning never modifies Frozen Spec, Docs, upstream Slice artifacts, production code, tests or migrations.

## B. Single Truth Owner

- [x] B01 Slice 18 introduces only Professional Retrieval Gold Dataset evaluation truth.
- [x] B02 Professional Knowledge identity/version/content/lifecycle remains Slice 17 truth.
- [x] B03 Intervention/professional-definition truth remains Slice 16 truth.
- [x] B04 Scene/package truth remains with the existing Scene/package owner.
- [x] B05 Authorization remains with the existing Authorization owner.
- [x] B06 Consent remains with the existing Consent owner.
- [x] B07 Compliance remains with the existing Compliance owner.
- [x] B08 Safety remains with the existing Safety owner.
- [x] B09 Gold relevance does not become family applicability truth.
- [x] B10 Gold forbidden labels do not become a second hard-filter rule engine.
- [x] B11 Corpus manifest snapshots refs/hashes; it does not become a second editable Knowledge registry.
- [x] B12 Review bindings reference real authority; they do not create a reviewer registry.
- [x] B13 No new generic staff/RBAC owner is required.
- [x] B14 No new generic workflow/eval registry is required.

## C. Scope Convergence

- [x] C01 Scope is exactly Gold Dataset Foundation.
- [x] C02 No PostgreSQL upgrade work is planned.
- [x] C03 No pgvector/vector/sparsevec schema/index is planned.
- [x] C04 No DashScope/embedding provider call is planned.
- [x] C05 No pg_jieba runtime/dictionary is planned.
- [x] C06 No pg_textsearch work is planned.
- [x] C07 No chunking/parser/crawler/ingestion is planned.
- [x] C08 No knowledge_embeddings persistence is planned.
- [x] C09 No retrieval/search/RRF/fusion/reranking is planned.
- [x] C10 No RAG A/B/C execution is planned.
- [x] C11 No production route selection is planned.
- [x] C12 No production numeric winner threshold is planned.
- [x] C13 No Context Builder is planned.
- [x] C14 No AI Task Runtime/TaskModelRegistry/provider gateway is planned.
- [x] C15 No Jev/Promptfoo/DeepEval/Phoenix/Langfuse platform work is planned.
- [x] C16 No user-facing AI feature is planned.
- [x] C17 No Family Memory or Phase 4 runtime is planned.
- [x] C18 No production DB migration/table/service is planned.
- [x] C19 No generic CMS/RBAC/workflow is planned.
- [x] C20 Planned code areas remain contracts/eval/scripts/tests and narrow verification wiring only.

## D. Artifact Form

- [x] D01 Repo was scanned for an existing authoritative eval artifact format.
- [x] D02 If one exists at development start, it is reused; a parallel format is forbidden.
- [x] D03 Current Scene snapshot fixture is not falsely promoted to Gold authority.
- [x] D04 Artifact is source-controlled.
- [x] D05 Artifact is machine-readable.
- [x] D06 Artifact is human-reviewable.
- [x] D07 Artifact is deterministically hashable.
- [x] D08 Artifact can be validated offline/CI.
- [x] D09 No online registry/service is required.
- [x] D10 Synthetic validator fixtures are physically and semantically isolated.

## E. Exact Identity

- [x] E01 Released dataset has exact dataset_name and dataset_version.
- [x] E02 Released dataset has exact manifest_hash.
- [x] E03 Released dataset binds exact corpus_manifest_version/hash.
- [x] E04 Every case has stable case_id.
- [x] E05 Every case has exact case_hash.
- [x] E06 Every expected/forbidden Knowledge ref uses exact knowledge_id + knowledge_version.
- [x] E07 Every corpus member records authoritative content hash.
- [x] E08 Scene/package identity is exact, not implicit.
- [x] E09 No latest/current/floating alias is accepted as release evidence.
- [x] E10 Future consumer evidence includes exact dataset/corpus hashes, not friendly names only.
- [x] E11 Hash algorithm is deterministic and developer-guess-free.
- [x] E12 Key reordering does not change canonical payload hash.
- [x] E13 Semantic payload changes do change hash.

## F. Query Provenance and Privacy

- [x] F01 RELEASED query origin is professionally authored/reviewed synthetic only.
- [x] F02 AI-drafted material cannot self-approve.
- [x] F03 Raw customer messages are forbidden.
- [x] F04 Real Case exports are forbidden.
- [x] F05 Private chat copies are forbidden.
- [x] F06 Identifiable family/minor narratives are forbidden.
- [x] F07 Real family/account/person/case identifiers are forbidden.
- [x] F08 Validator mechanically rejects known direct-identifier patterns.
- [x] F09 Human/professional review remains responsible for residual privacy judgment.
- [x] F10 No claim is made that regex/static scanning alone proves full de-identification.
- [x] F11 No new family Consent purpose is introduced by Slice 18.

## G. Relevance / Forbidden / Empty / UNKNOWN

- [x] G01 Relevance vocabulary is finite and frozen.
- [x] G02 PRIMARY and SUPPORTING are distinct graded positives.
- [x] G03 Numeric relevance encoding is evaluation-only, not business eligibility.
- [x] G04 Irrelevant is absence from expected_relevant, not an unresolved zero label.
- [x] G05 Forbidden is stronger and separate from low relevance.
- [x] G06 Forbidden reasons use a closed evaluation reason vocabulary.
- [x] G07 Forbidden reasons retain upstream authority refs.
- [x] G08 expected_empty is an explicit resolved truth.
- [x] G09 expected_empty requires no positive refs.
- [x] G10 UNKNOWN/UNRESOLVED is distinct from irrelevant.
- [x] G11 UNKNOWN/UNRESOLVED is distinct from expected_empty.
- [x] G12 RELEASED cases cannot contain UNRESOLVED labels.
- [x] G13 Same exact ref cannot be both expected-positive and forbidden in one case.

## H. Hard-Filter Expectations

- [x] H01 Cases can express scene expectation.
- [x] H02 Cases can express stage expectation.
- [x] H03 Cases can express age/development expectation.
- [x] H04 Cases can express package/version expectation.
- [x] H05 Cases can express lifecycle expectation.
- [x] H06 Cases can express applicability expectation.
- [x] H07 Cases can express exclusion/contraindication expectation.
- [x] H08 Cases can express risk compatibility expectation where applicable.
- [x] H09 Expected behavior is represented without copying upstream rule engines.
- [x] H10 Every hard-filter expectation can carry exact authority refs.
- [x] H11 Gold hard-filter expectations never clear Authorization/Consent/Compliance/Safety.

## I. Corpus Binding

- [x] I01 One RELEASED dataset binds one exact corpus manifest.
- [x] I02 Positive refs exist in the bound corpus.
- [x] I03 Forbidden refs exist in the bound corpus if used for leakage testing.
- [x] I04 Positive refs are PUBLISHED/eligible at snapshot.
- [x] I05 DRAFT/REVIEWED/RETIRED members are only explicit negative fixtures.
- [x] I06 Negative fixtures are clearly marked non-eligible.
- [x] I07 Corpus members resolve to authoritative Slice 17 refs/hashes.
- [x] I08 Corpus drift changes corpus hash.
- [x] I09 Old evidence cannot claim validity on a changed corpus.
- [x] I10 Corpus manifest does not duplicate editable Knowledge body truth.

## J. Review Authenticity

- [x] J01 RELEASED labels require real accountable human review evidence.
- [x] J02 Reviewer authority must exist before release implementation proceeds.
- [x] J03 AI cannot approve Gold labels.
- [x] J04 Retrieval candidate cannot approve Gold labels.
- [x] J05 Embedding/reranker/model under evaluation cannot approve Gold labels.
- [x] J06 LLM judge cannot become Gold authority.
- [x] J07 Developer/test fixture identity cannot grant itself review authority.
- [x] J08 Family account ownership cannot grant benchmark authority.
- [x] J09 Review binds exact case hashes.
- [x] J10 Review binds exact corpus manifest hash.
- [x] J11 Changed case/corpus payload invalidates prior review.
- [x] J12 Offline validation distinguishes structural binding from authentic reviewer authority.
- [x] J13 Missing real reviewer authority blocks release rather than creating a fake reviewer.

## K. Lifecycle and Correction

- [x] K01 DRAFT may change and cannot support production evidence.
- [x] K02 REVIEWED is exact-payload reviewed but not yet released.
- [x] K03 RELEASED bytes are immutable.
- [x] K04 RETIRED remains historically inspectable.
- [x] K05 RETIRED cannot support new route approval.
- [x] K06 Substantive correction creates a new dataset version.
- [x] K07 Successor identifies exact predecessor.
- [x] K08 Original release is not rewritten to point forward.
- [x] K09 Retirement is append-only so the original release bytes remain unchanged.
- [x] K10 No current/latest mutable alias is used as evidence.
- [x] K11 Release remote read-back can recover exact identity after lost response.
- [x] K12 No second idempotency system is introduced.

## L. Validation

- [x] L01 Schema validity is mechanically checked.
- [x] L02 Hash validity is mechanically checked.
- [x] L03 Duplicate case ids fail.
- [x] L04 Floating refs fail.
- [x] L05 Missing Knowledge refs fail.
- [x] L06 Corpus mismatch fails.
- [x] L07 Unresolved release labels fail.
- [x] L08 Expected-empty conflicts fail.
- [x] L09 Forbidden/positive overlap fails.
- [x] L10 Missing review evidence fails.
- [x] L11 Review binding hash mismatch fails.
- [x] L12 Privacy guard violation fails.
- [x] L13 Released artifact modification/deletion fails.
- [x] L14 Invalid predecessor/successor fails.
- [x] L15 Synthetic fixture claimed as production evidence fails.
- [x] L16 Initial release coverage incompleteness fails.
- [x] L17 Failure output is machine-readable and reason-specific.
- [x] L18 Validation is deterministic offline/CI.

## M. Validation Non-Vacuity

- [x] M01 Wrong-hash synthetic sample is asserted to fail.
- [x] M02 Duplicate-id synthetic sample is asserted to fail.
- [x] M03 latest-ref synthetic sample is asserted to fail.
- [x] M04 Missing-ref synthetic sample is asserted to fail.
- [x] M05 UNRESOLVED-release synthetic sample is asserted to fail.
- [x] M06 expected_empty+positive synthetic sample is asserted to fail.
- [x] M07 positive+forbidden overlap synthetic sample is asserted to fail.
- [x] M08 Missing-review synthetic sample is asserted to fail.
- [x] M09 Privacy violation synthetic sample is asserted to fail.
- [x] M10 Released-mutation synthetic sample is asserted to fail.
- [x] M11 Invalid-successor synthetic sample is asserted to fail.
- [x] M12 Synthetic-as-production sample is asserted to fail.
- [x] M13 Forbidden path/dependency sample is asserted to fail.
- [x] M14 Each test asserts the expected failure code, not just any exception.
- [x] M15 Synthetic samples are excluded from production quality evidence.

## N. Coverage Semantics

- [x] N01 Direct Chinese professional terminology covered.
- [x] N02 Natural-language paraphrase covered.
- [x] N03 Short ambiguous phrasing covered.
- [x] N04 Negation covered.
- [x] N05 Exclusion/contraindication phrasing covered.
- [x] N06 Age/development mismatch covered.
- [x] N07 Stage mismatch covered.
- [x] N08 Scene mismatch covered.
- [x] N09 Package/version mismatch covered.
- [x] N10 Non-PUBLISHED lifecycle exclusion covered.
- [x] N11 RETIRED exclusion covered.
- [x] N12 Semantically similar but professionally wrong content covered.
- [x] N13 Multiple supporting items covered.
- [x] N14 Dominant primary plus supporting items covered.
- [x] N15 Truthful expected-empty covered.
- [x] N16 Source/reference fidelity covered where required.
- [x] N17 Demonstration/example not universalized covered.
- [x] N18 Digital Use lexical-vs-dense discriminator vocabulary covered.
- [x] N19 Coverage is non-vacuous and not satisfied by one synthetic catch-all case.
- [x] N20 No arbitrary benchmark-size target is invented.

## O. Metric Compatibility / Future Consumer

- [x] O01 Dataset supports Recall@K.
- [x] O02 Dataset supports nDCG@K.
- [x] O03 Dataset supports MRR.
- [x] O04 Dataset supports hard-filter fidelity.
- [x] O05 Dataset supports forbidden leakage count/rate.
- [x] O06 Dataset supports expected-empty fidelity.
- [x] O07 Dataset supports terminology fidelity.
- [x] O08 Dataset supports negation/exclusion fidelity.
- [x] O09 Dataset supports scene/stage/age/package/lifecycle fidelity.
- [x] O10 Dataset supports future rerank delta.
- [x] O11 A/B/C future candidates must consume the same exact dataset/corpus for comparable evidence.
- [x] O12 No candidate execution occurs in Slice 18.
- [x] O13 No embedding/reranker execution occurs in Slice 18.
- [x] O14 No production threshold is invented.
- [x] O15 Future consumer cannot mutate Gold labels during evaluation.
- [x] O16 Future consumer evidence records exact commit/dataset/corpus hashes.

## P. Development-Start Gate Truthfulness

- [x] P01 T1801 is the first task.
- [x] P02 T1801 is READ-ONLY.
- [x] P03 No implementation task runs if T1801 returns NO.
- [x] P04 Slice 17 must be Audit-2-passed and merged runtime, not merely planned.
- [x] P05 Exact Knowledge id/version/hash/lifecycle/package resolution must exist on merged main.
- [x] P06 Representative real PUBLISHED Knowledge corpus must exist.
- [x] P07 Required Slice 16 authority must be merged/usable where applicable.
- [x] P08 Real professional/evaluation reviewer authority must exist.
- [x] P09 Exact Scene/package identity must be reusable without a second registry.
- [x] P10 Sanctioned professional review/audit evidence seam must exist.
- [x] P11 No second owner may be needed to satisfy the gate.
- [x] P12 No semantic authority drift may be present.
- [x] P13 No competing Slice 18 authority may exist.
- [x] P14 Newly merged canonical eval format triggers reuse/reconciliation rather than a parallel authority.
- [x] P15 BLOCKED is an acceptable final planning result.
- [x] P16 Planning Freeze PASS does not imply Implement Gate PASS.
- [x] P17 Current planning-time runtime gate is truthfully BLOCKED.

## Q. Negative Scope Guard

- [x] Q01 Delta guard rejects db/migrations changes for Slice 18.
- [x] Q02 Delta guard rejects Gold persistence in db/schema.
- [x] Q03 Delta guard rejects packages/rag.
- [x] Q04 Delta guard rejects packages/ai.
- [x] Q05 Delta guard rejects packages/memory.
- [x] Q06 Delta guard rejects Gold production API endpoints.
- [x] Q07 Delta guard rejects provider/network model calls.
- [x] Q08 Delta guard rejects pgvector/sparsevec/pg_jieba/pg_textsearch runtime work.
- [x] Q09 Delta guard rejects retrieval/ranking/reranking/fusion execution.
- [x] Q10 Delta guard rejects new generic RBAC/CMS/workflow/eval registry services.
- [x] Q11 Delta guard rejects new dependencies added solely for forbidden capabilities.
- [x] Q12 Guard has synthetic violating path/dependency self-tests.

## R. Exact-Head Verification and Handoff

- [x] R01 Final implementation head is re-read remotely before Audit 2 handoff.
- [x] R02 Frozen Spec blob remains unchanged.
- [x] R03 Implementation diff is limited to authorized Slice 18 paths.
- [x] R04 Existing full typecheck passes.
- [x] R05 Existing full Vitest regression passes.
- [x] R06 Existing static guard passes.
- [x] R07 Slice 18 validator passes.
- [x] R08 Slice 18 scope guard passes.
- [x] R09 Governance checks pass.
- [x] R10 Synthetic non-vacuity tests pass.
- [x] R11 Real release, if created, has exact review/corpus evidence.
- [x] R12 No synthetic fixture is reported as production retrieval evidence.
- [x] R13 Evidence package binds exact head.
- [x] R14 Audit 2 can map every FR/AS/NS to executable evidence without guessing.

## S. Audit 1 Questions

### Q1 — Frozen Spec Fidelity
- [x] S01 Plan/Checklist/Tasks consume, not rewrite, Frozen Spec.
- [x] S02 No new product state/owner/platform is invented.

### Q2 — Scope Convergence
- [x] S03 Gold Dataset Foundation is not expanded into RAG/AI/vector infrastructure.

### Q3 — Authority Preservation
- [x] S04 Knowledge remains Slice 17 authority.
- [x] S05 Intervention remains Slice 16 authority.
- [x] S06 Gold labels remain evaluation truth only.

### Q4 — Dependency Truth
- [x] S07 Planning artifacts are never counted as merged runtime.
- [x] S08 Current missing dependencies remain BLOCKED.

### Q5 — Reviewer Authenticity
- [x] S09 No fake reviewer, hard-coded admin, AI approval or fixture approval exists.

### Q6 — Data Privacy
- [x] S10 No real family/minor data is authorized for release.

### Q7 — Reference Integrity
- [x] S11 All release refs are exact and floating latest is rejected.

### Q8 — Lifecycle Integrity
- [x] S12 Released bytes are immutable and correction is successor-based.

### Q9 — Validation Non-Vacuity
- [x] S13 Validator/static guards include synthetic known-bad samples.

### Q10 — Implement Gate
- [x] S14 Planning may pass while runtime/implement gate remains blocked.

## T. Planning Freeze Preconditions

- [x] T01 Plan is complete.
- [x] T02 Checklist is complete and is not merely a copy of Tasks.
- [x] T03 Tasks are executable and include Goal/Prerequisites/Inputs/Behavior/Forbidden/Verification/Evidence/Mapping/STOP.
- [x] T04 Audit 1 has been run after all planning content exists.
- [x] T05 CRITICAL findings = 0.
- [x] T06 HIGH findings = 0.
- [x] T07 MEDIUM findings = 0.
- [x] T08 Any execution-ambiguity LOW is remediated before freeze.
- [x] T09 Final planning commit contains only plan.md/checklist.md/tasks.md relative to Frozen Spec base.
- [x] T10 Remote read-back confirms plan/checklist/tasks blobs.
- [x] T11 Remote read-back confirms Frozen Spec blob preservation.
- [x] T12 spec/018 branch remains unpolluted.
- [x] T13 No competing plan/018 authority exists.
- [x] T14 Planning head is stable at final read-back.
