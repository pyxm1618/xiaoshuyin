# Slice 18 Planning Checklist — Professional Retrieval Gold Dataset Foundation

**Purpose**: Audit whether Plan/Tasks faithfully and completely translate the Frozen Spec without authority drift, scope expansion or fake dependency satisfaction.  
**Status**: COMPLETE — Audit 1 FINAL PASS / Planning Freeze PASS.  
**Interpretation**: A checked item means the planning package explicitly covers and requires that condition. It does not claim a future runtime/development action has already occurred. Runtime Dependency Gate remains BLOCKED.  
**Reconciled Frozen Spec**: f4ea6d8acfb175f15c6198e6b5e4354daf1102e6 / 16bed255125677de0dcc4ec71d740f1b0efaeccf  
**Previous Frozen Spec**: 4624b3df6d59c6055421e175b95051782615de9a / bf7540ff3097ef14ca1c62a395b155abd4fde66a  
**Planning branch**: plan/018-professional-retrieval-gold-dataset-authority-reconciliation  
**Checklist role**: planning-quality and future implementation verification criteria. This file is not a task list.

## A. Authority Integrity

- [x] A01 Reconciled Frozen Spec commit exists remotely.
- [x] A02 Reconciled Frozen Spec blob equals 16bed255125677de0dcc4ec71d740f1b0efaeccf.
- [x] A03 spec/018-professional-retrieval-gold-dataset-authority-reconciliation differs from current main only by spec.md.
- [x] A04 plan/018-professional-retrieval-gold-dataset-authority-reconciliation is the unique current reconciled planning authority; original spec/plan branches remain historical.
- [x] A05 Exhaustive 018 branch search found no competing authority-reconciliation spec/plan/feat branch.
- [x] A06 Docs/总产品需求.md current blob is 97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29.
- [x] A07 Docs/V1产品需求.md current blob is 8eb660cd905d8fba4b52fe0f74bbc214b3113117.
- [x] A08 Docs/总体技术架构.md current blob is 6b4630803f371faf6d93f27361070223d0f661a0.
- [x] A09 Docs/V1技术设计.md current blob is a0f09b8afda5532870150f03b713fed107359849.
- [x] A10 Slice 16 merge state, post-merge audit/remediation state and runtime usability are treated as separate facts.
- [x] A11 Slice 17 implementation/audit evidence is not treated as current-main runtime until merged and revalidated.
- [x] A12 APPROVED PROFESSIONAL REVIEWER — UNASSIGNED is treated as a real blocking dependency.
- [x] A13 Current Authority drift is reconciled explicitly; any unresolved Authority conflict triggers STOP.
- [x] A14 Reconciliation does not modify the four Authority Docs, upstream Slice artifacts, production code, tests or migrations.
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
- [x] B12 Professional approval bindings consume real Staff assignment/capability/qualification/evidence authority; they do not create a reviewer/qualification registry.
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
- [x] I08 Referenced Knowledge/package/provenance drift is detectable from exact dependency identity.
- [x] I09 Only affected dataset/case objects enter revalidation; unrelated changes do not cause blanket invalidation.
- [x] I10 Old evidence cannot claim validity on a changed corpus.
- [x] I11 Corpus manifest does not duplicate editable Knowledge body truth.

## J. Professional Review Authenticity

- [x] J01 Professional Gold labels/rubrics are explicitly treated as Professional Authority.
- [x] J02 RELEASED labels require a real current Staff assignment.
- [x] J03 RELEASED labels require PROFESSIONAL_REVIEW capability.
- [x] J04 PROFESSIONAL_REVIEW alone is insufficient; matching professional qualification/scope is required and the binding records canonical `qualification_scope`.
- [x] J05 Approval records auditable reviewer identity and qualification_ref.
- [x] J06 Approval binds exact artifact/package identity, version/content hashes, exact corpus hash, source refs and approval scope.
- [x] J07 Approval records reviewed_at, approval status and effective/published identity/period.
- [x] J08 AI/retrieval candidate/embedding/reranker/LLM judge/Promptfoo judge cannot approve Gold labels.
- [x] J09 Developer/test fixture/family role/generic admin flag cannot satisfy Professional Authority.
- [x] J10 Wrong/revoked capability fails closed.
- [x] J11 Missing/revoked assignment fails closed.
- [x] J12 Wrong/revoked qualification or qualification-scope mismatch fails closed.
- [x] J13 Stale/expired/withdrawn approval or content/hash drift fails closed.
- [x] J14 Offline validation distinguishes structural binding from authentic reviewer authority.
- [x] J15 Missing real reviewer authority blocks release/current evidence rather than creating a fake reviewer.
## K. Lifecycle, Review State, Validity and Correction

- [x] K01 DRAFT may change and cannot support production evidence.
- [x] K02 REVIEWED is retired as a Gold Dataset lifecycle status; review is represented by exact Professional approval binding.
- [x] K03 lifecycle_status is separate from review_state/validity_state.
- [x] K04 RELEASED + CURRENT/VALID may be eligible only with current approval/dependencies.
- [x] K05 RELEASED + NEEDS_REVIEW remains immutable history but cannot support current route approval.
- [x] K06 RETIRED is an intentional lifecycle state and does not substitute for NEEDS_REVIEW.
- [x] K07 Dependency drift marks only genuinely affected dataset/case objects NEEDS_REVIEW.
- [x] K08 Unrelated upstream changes do not invalidate unrelated dataset/case objects.
- [x] K09 No-material-impact re-review restores CURRENT/VALID by append-only evidence without rewriting release bytes.
- [x] K10 Material-impact re-review requires a professionally approved successor dataset version.
- [x] K11 Permanent dependency invalidity blocks current use; retirement occurs only when the lifecycle owner intentionally withdraws the release.
- [x] K12 RELEASED bytes are immutable.
- [x] K13 Successor identifies exact predecessor; original release is not rewritten.
- [x] K14 Retirement/revalidation history is append-only.
- [x] K15 No current/latest mutable alias is used as evidence.
- [x] K16 Release remote read-back can recover exact identity after lost response.
- [x] K17 No second idempotency system is introduced.
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
- [x] P03 No implementation edit of any kind runs if T1801 returns NO/BLOCKED.
- [x] P04 T1801 re-reads current main exact SHA.
- [x] P05 T1801 verifies the reconciled Slice 18 Frozen Spec exact blob and unique authority.
- [x] P06 T1801 separately verifies Slice 16 merge/audit/remediation/runtime usability; merged alone is insufficient.
- [x] P07 T1801 requires Slice 17 independent Audit 2 PASS, merge to current main and usable runtime seams.
- [x] P08 Exact Knowledge id/version/hash/lifecycle/package resolution must exist on merged main.
- [x] P09 Representative real PUBLISHED Professional Knowledge corpus must exist.
- [x] P10 Real Staff assignment must exist.
- [x] P11 PROFESSIONAL_REVIEW capability must exist.
- [x] P12 Matching professional qualification scope must exist as `qualification_scope` together with qualification_ref.
- [x] P13 Auditable reviewer identity must exist.
- [x] P14 Sanctioned professional review/approval evidence seam must exist.
- [x] P15 Approval binding must support exact artifact/package/version/content/source/scope/reviewer/qualification/reviewed_at/status/effective-published identity.
- [x] P16 Exact Scene/package identity must be reusable without a second registry.
- [x] P17 No second Knowledge/package/reviewer/eval owner may be needed.
- [x] P18 No current Authority drift may be present.
- [x] P19 No competing Slice 18 authority may exist.
- [x] P20 BLOCKED is an acceptable final planning result.
- [x] P21 Planning Freeze PASS does not imply Implement Gate PASS.
- [x] P22 Current planning-time runtime gate is truthfully BLOCKED.
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

### Q1 — Current Authority Fidelity
- [x] S01 Reconciled artifacts obey current four Docs and do not retain contradictory old Authority.

### Q2 — Selection Preservation
- [x] S02 Selection remains Professional Retrieval Gold Dataset Foundation; no re-selection occurred.

### Q3 — Professional Authority
- [x] S03 Gold labels/rubrics are Professional Authority and cannot be approved by product/architecture/developer/AI authority.

### Q4 — Reviewer Authenticity
- [x] S04 Real Staff assignment + PROFESSIONAL_REVIEW + matching qualification/scope + auditable identity are required.

### Q5 — Approval Binding
- [x] S05 Approval is exact to immutable artifact/content/source/scope and current approval identity.

### Q6 — Lifecycle Separation
- [x] S06 lifecycle_status is separate from review_state/validity; REVIEWED is not a lifecycle status.

### Q7 — NEEDS_REVIEW
- [x] S07 NEEDS_REVIEW blocks affected RELEASED evidence without mechanically retiring it.

### Q8 — Dependency Propagation
- [x] S08 Only truly dependent dataset/case objects are revalidated; unrelated objects are unaffected.

### Q9 — Runtime Truth
- [x] S09 merged/audited/remediated/usable/planned states are not conflated for Slice 16/17.

### Q10 — Scope
- [x] S10 No RAG runtime, pgvector, embedding, Promptfoo, generic platform or production DB scope was added.

### Q11 — Gate Truth
- [x] S11 Planning may pass while Runtime Dependency/Implement Gate remain BLOCKED.

### Q12 — Traceability
- [x] S12 Every reconciled/new FR/AS requirement maps to Plan/Tasks/test-evidence expectations.
## T. Planning Freeze Preconditions

- [x] T01 Plan is complete.
- [x] T02 Checklist is complete and is not merely a copy of Tasks.
- [x] T03 Tasks are executable and include Goal/Prerequisites/Inputs/Behavior/Forbidden/Verification/Evidence/Mapping/STOP.
- [x] T04 Complete Audit 1 has been run after all reconciled planning content exists.
- [x] T05 CRITICAL findings = 0.
- [x] T06 HIGH findings = 0.
- [x] T07 MEDIUM findings = 0.
- [x] T08 Any execution-ambiguity LOW is remediated before freeze.
- [x] T09 Final planning delta contains only plan.md/checklist.md/tasks.md relative to reconciled Frozen Spec base.
- [x] T10 Remote read-back confirms plan/checklist/tasks blobs.
- [x] T11 Remote read-back confirms reconciled Frozen Spec blob preservation.
- [x] T12 Reconciled spec branch remains unpolluted.
- [x] T13 No competing authority-reconciliation plan/018 branch exists.
- [x] T14 Planning head is stable at final read-back.
