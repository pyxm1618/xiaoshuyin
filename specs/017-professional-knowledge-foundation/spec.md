# Slice 17 — Professional Knowledge Foundation

> Role: Plan AI 1 / Selection → Specify → Clarify → Frozen Spec only.
> Feature: `017-professional-knowledge-foundation`.
> Phase: Phase 3 — Professional Knowledge & AI.
> Status: SPEC FROZEN upon successful commit / integrity read-back. This is not implementation approval.

## 1. Authority Baseline

Authority hierarchy: `Docs/总产品需求.md` (long-term product) → `Docs/V1产品需求.md` (V1 product scope) → `Docs/总体技术架构.md` (long-lived architecture) → `Docs/V1技术设计.md` (V1 technical contract). The four documents are authoritative in their respective scopes; `Docs/reference/*` is historical input, not equal authority.

Read baseline on 2026-11-14: main `17e81b2badfd5a706e15867e2faf504d88a72364`; technical authority `V1技术设计.md` §7.5, §13, §38; overall architecture §6 and §11; long-term product §25; V1 product §2.7A and AI/asset governance. Frozen Slice 16 spec blob `a6cd9fd723f9339b575757279703be554afaf0f6`, planning freeze `40d6c4e19b9207b287aec03c5ba02868260dd8fe`. Their professional intervention contract and deterministic eligibility are not part of this Slice.

This Spec cannot amend or displace an Authority Doc. Authority conflict, if subsequently proven, blocks implementation and requires separate governance; it is never silently resolved inside Slice 17.

## 2. Repository Reality Check

Remote default branch `main` SHA above includes the Slice 12 deterministic Digital Use Assessment runtime, its migrations through `015_digital_use_assessment_runtime.sql`, and existing Case, Evidence, Problem Formulation, Safety, Compliance, Consent, Authorization, scene routing/state owners. There is no merged `knowledge_items` or `knowledge_embeddings` schema, professional retrieval store, pgvector RAG runtime, Context Builder or AI Task Runtime.

Slices 13–16 are independently frozen planning artifacts on branches, not merged runtime. Slice 13 development branch existed at selection; Slice 14/15 have frozen plans; Slice 16 has frozen professional-definition contract/plan but not merged runtime. A planning artifact, a fixture, or a prospective schema is not executable production truth.

The Slice 12–16 frozen spec/plan/checklist/tasks artifacts have been retrieved by exact repository path. This spec does not mutate those files. No Slice 17 filename collision was observed in remote branch inventory at selection.

## 3. Phase Boundary Gate

Phase 2's final explicitly bounded Digital Use business block is Slice 15 A5001/A5002; Phase 3 begins with Slice 16 professional Intervention definitions. Slice 17 remains within Phase 3. It creates a distinct reviewed professional *explanatory/content* truth before retrieval. It does not finish Phase 2, perform Phase 4 Plan/Task/Review, or activate AI. Phase gate PASS.

## 4. Selection Gate

Each candidate is evaluated on formal authority, owner, prerequisites, whether it creates or consumes business truth, independent validity, premature architecture/duplication risk:

| Candidate | Authority / truth | Dependency / independent readiness | Decision |
|---|---|---|---|
| Professional Knowledge persistence / knowledge_items | §7.5/§13: creates reviewed explanatory professional content distinct from intervention eligibility | Can independently version, professionally review and publish without search or model; consumes exact package scope | **SELECT** |
| PostgreSQL 18 + pgvector retrieval foundation | §13/§38: technical substrate; consumes indexed knowledge | No published knowledge consumer or measured vector requirement yet; premature infrastructure | DEFER |
| Dense/sparse/lexical readiness Spike | §11/§13: technical feasibility experiment | Requires actual professional Chinese corpus, agreed retrieval gold cases and target environment; not a production knowledge owner | DEFER |
| RAG A/B/C + Gold Dataset Eval | §13: retrieval consumer and evaluation | Requires reviewed published versions, hard filters, grounded corpus, adapter/readiness | DEFER |
| Context Builder | §14A: composition of authorized domain/context and RAG | Knowledge/retrieval and purpose-bound context sources incomplete; no reason to duplicate domain truth | DEFER |
| AI Task Runtime | §15–16: candidate execution | Requires approved purpose/context/gates and result validation, not first content owner | DEFER |
| TaskModelRegistry / provider execution | §19: model routing infrastructure | Needs real bounded tasks and benchmark evidence; not an independent domain truth | DEFER |
| Jev / bounded decision Shadow | §32.11: evaluation shadow | Needs AI candidate, deterministic policy reference and datasets | DEFER |
| Promptfoo / AI Eval platform | §32: quality tooling | Can plan test cases early, but standalone platform now has no released AI/RAG candidate to assess; does not replace reviewed knowledge | DEFER |
| Problem Formulation AI | V1 AI support | Requires bounded AI Task, Context, model routing; cannot own Formulation | DEFER |
| A4003 roleplay AI | Phase 3 and Slice 14 seam | Requires adult/guardian-only compliance, AI contracts and active Phase 2 seam; no independent knowledge owner | DEFER |
| Execution-support AI | Phase 3 | Requires AI runtime/Context and authentic execution facts; must not invent Phase 4 truth | DEFER |
| Other earlier Phase 3 capability | Formal Docs and Slice 16 scanned for more-upstream production truth | Intervention Contract is already frozen; knowledge-review/content truth is the next minimal missing professional asset; no stronger independently necessary predecessor identified | NOT SELECTED |

**Why now:** intervention action eligibility and professional explanation are two different truths. The second must exist as reviewed, package/version-bound content before embedding/RAG can reliably select it. **Why not earlier:** Slice 16 first closed the higher-risk intervention authority gate; content cannot be allowed to become an eligibility surrogate. **Why not later:** building retrieval, context or model calls first would force placeholder content, floating knowledge versions, or fake approval. This is not a mandated B→C→D sequence: the decision is based on owner and prerequisite direction.

Selection PASS: `Professional Knowledge Foundation`.

## 5. Selected Slice / Problem / Purpose

A professional Knowledge Item is an authored, traceable, scoped unit of educational/psychological explanatory content describing *why/how*, limits, uncertainties, applicability or caution relevant to a V1 professional scene. It is not a family statement, model response, therapeutic authority, InterventionDefinition or execution instruction.

Purpose: establish a single authoritative, immutable-when-published, professionally governed knowledge content lifecycle and exact package/version inclusion contract, allowing subsequent RAG to consume only eligible published professional assets without inventing review or professional authority.

## 6. Goals

Create a minimal V1 professional knowledge truth; ensure real source/reviewer provenance, explicit lifecycle, exact version and package inclusion, fail-closed production eligibility, bounded corrections, auditability and privacy. Maintain independently verifiable deterministic lifecycle behavior with no embedding, retrieval or model. No generic CMS or expert platform.

## 7. In Scope

- Author and persist professional Knowledge Item identities/versions and review/publication/retirement lifecycle.
- Bind each released knowledge version to explicit V1 scene/package-version scope, stage, age/development scope, applicability, exclusions, risk and professional source metadata.
- Support exact approved package knowledge-version set snapshot and traceable history, not an unqualified latest lookup.
- Deterministically decide whether a version is *eligible for downstream knowledge consumption* in a supplied approved package/context. This is content scope filtering, **not** psychological intervention eligibility.
- Protect professional asset mutation and any case-scoped use with established authorization/control gates.
- Preserve full professional attribution, correction history, versioned source references, idempotency and audit.
- Allow human-origin source material and AI-assisted **drafts**, never AI review/approval.
- Preserve distinct status for not yet sourced/reviewed/published assets; never synthesize production content to satisfy a test.

## 8. Explicit Out of Scope

No professional-source ingestion pipeline, bulk import, raw copyrighted document repository, document parsing/chunking, `knowledge_embeddings`, vector/dense/sparse/lexical index, `pgvector`/sparsevec/pg_jieba, embedding/rerank providers, retrieval endpoint, RAG A/B/C, Gold Dataset execution, Context Builder, AI Task Runtime, TaskModelRegistry, model gateway, Jev, Promptfoo platform, generated answer release, AI scene/roleplay/execution support, Family Memory, InterventionInstance, Plan/Task/Review/Outcome/Schedule/Notification, generic CMS, expert marketplace/RBAC, generic workflow/rule engine, new scene routing or new Safety/Consent/Compliance owner.

A bounded professional Knowledge Item is **not** a storage location for copied family evidence or raw source PDFs. Future chunking must preserve pointer to an immutable published Knowledge Item version rather than retroactively change it.

## 9. Ownership / Source of Truth

| Truth | Sole owner | Slice 17 |
|---|---|---|
| Case, family/people/participant identity | Existing Common Core | Validated consumer only |
| Evidence and source-person assertions | Existing Evidence Core | No copy; never used as professional source content |
| Problem Formulation | Existing Formulation Core | Consumer only |
| Authorization / Consent / Compliance / Safety | Existing control planes | Re-check; no bypass or duplicate |
| Scene node and routing / scene state | Slice 11/12 owners | Uses exact identity/version only |
| Professional InterventionDefinition, provenance, package eligibility | Slice 16 | References approved version as needed, cannot edit or infer eligibility |
| Professional Knowledge Item content/version/review/publication/retirement | **Slice 17** | Sole new truth |
| Scene package professional knowledge-version set | Existing Scene Package authority; Slice 17 defines knowledge-set contribution | Exact inclusion semantics only, no second package registry/router |
| RAG, model/context, Phase 4 execution | Future designated owners | No truth created |

The distinction is mandatory: a published Knowledge Item can explain a method; it cannot make an unapproved InterventionDefinition eligible. Source refs used in Slice 16 remain source/provenance references for definitions, not implicitly a Knowledge Item. No automatic cross-publication or mutual lifecycle coupling.

## 10. Domain Semantics

A Knowledge Item version has stable `knowledge_id`, explicit immutable content revision/version, a content body, authored language/locale, subject/semantic category, scope metadata, professional source refs and lifecycle record. Minimum filtering metadata: `scene_id`, exact `package_version` binding at publication, stage, age/development scope, applicability conditions, exclusion conditions, risk level and source. Optional intervention-definition references are precise versioned links, never authorization rules.

A Knowledge Item is one independently reviewable professional content unit; it is not necessarily one future retrieval chunk. Changes to content, meaning, source, applicability, exclusions, age/risk or package scope are substantive version changes after publication. Draft metadata can be corrected before release with audit. Absence of a field needed for reliable filtering is not an implicit wildcard.

The content may include explicit uncertainty, contraindication explanations and referral signposting, but any action gate remains with its authoritative deterministic owner. AI-generated drafts are untrusted material until an identified authorized professional reviewer actually approves a specific version.

## 11. Persistence Semantics

One logical Knowledge Item identity can have multiple immutable professional content versions. Store normalized metadata sufficient to perform exact lifecycle, version binding and published eligibility checks without reading model output. The current eligible knowledge set is a function of explicit published versions and exact approved package binding, never a mutable free-text list or `latest` alias. Publication and binding changes leave an inspectable historical snapshot.

Attributable professional sources record type, identifier/reference, publisher/author where known, source version/date where available, access/review context and rights/status where material. An unresolved or unverified source does not become verified merely by being referenced. This Slice does not retain source full text or distribute third-party proprietary material by default. If source evidence is insufficient for professional review, publication remains blocked.

## 12. Versioning

Version identity is stable and exact. Published content and its reviewed metadata are immutable. Correction after publication creates a successor version, a real fresh professional review and a distinct publication decision. Historical citations remain bound to old exact versions. No active historical package snapshot is silently rewritten; changes to current package inclusion follow authorized package versioning. An old published version may be historically readable with proper privileges without being newly consumable.

## 13. Review / Publication / Lifecycle

Semantic states: **DRAFT → REVIEWED → PUBLISHED → RETIRED**. `REVIEWED` means professional approval of the exact version by authorized reviewer role with reviewer identity/role and timestamp; it does not itself authorize production consumption. Review rejection returns or retains a nonproduction draft state with an auditable decision and no fraudulent approval. `PUBLISHED` requires previously reviewed version, complete source/applicability/exclusion/risk metadata and exact approved package inclusion. `RETIRED` blocks any new production knowledge selection; historical evidence is retained. A retired version cannot be republished in place. A new version starts nonproduction and requires fresh review.

Neither an AI draft, a family owner, a developer flag, an import job, nor a successful test fixture grants professional review. Any unresolved professional source or missing real authorized reviewer means NOT READY, not synthetic publication.

## 14. Authorization / Privacy

Professional asset create/edit/review/publish/retire operations require explicitly granted professional content authority; ordinary Family membership, paid status and Case ownership confer none. Reviewer and publisher are traceable real actors with corresponding approved authority; no platform-wide staff management system is introduced here. Professional content has its own privileged asset scope; future case-scoped consumption must perform current family/case/purpose Authorization first, then select allowed professional versions. Unauthorized IDs and package existence are not leaked by API responses. Internal audit may preserve true reason codes subject to privacy rules.

No family private narratives, identifiable health/behavior statements, child profile, message or case evidence shall be stored in Knowledge Item content/source metadata or logs. A real-world vignette must be anonymized and authorized before any professional-content use; no automatic extraction from customer records in this Slice.

## 15. Consent Boundary

Knowledge asset management cannot mint, change or infer a family/child Consent record. A later case-context selection requires applicable current processing purpose and Consent from existing owner; withdrawal prevents new affected processing but does not rewrite the immutable professional knowledge version. Absence of family data in the knowledge store does not excuse downstream consent evaluation.

## 16. Compliance Boundary

Compliance profile, policy, AI disclosure and age rules remain existing control-plane facts. Content marked appropriate for an age group does not grant legal eligibility to that minor. Missing, incompatible or unresolved required compliance state fails closed for any family-scoped knowledge delivery.

## 17. Safety Boundary

Safety remains the Slice 9 authoritative owner. Knowledge text may contain safety guidance but cannot clear a Safety Hold, redefine risk, authorize contraindicated intervention or downgrade a block. If a referenced professional source or content version is retired for safety relevance, future eligibility stops immediately; affected downstream references must carry invalidation/review semantics when such consumers exist, without creating Phase 4 artifacts in this Slice.

## 18. AI Boundary

AI may create proposed draft text only under authorized supervised workflow; it has no reviewer/publisher or decision authority. No real model call is required to verify this Slice. Future RAG can quote/retrieve published eligible knowledge within scope, never promote draft/retired knowledge, impersonate a reviewer, or override Slice 16 eligibility, Case truth or Safety/Consent/Compliance.

## 19. Idempotency

Mutating commands reuse the shared actor + command type + idempotency-key contract. Exact replay returns the same authoritative outcome with no new version/audit side effects; same key with materially different command payload conflicts. Replay does not bypass currently required authorization for disclosure; historical outcome readback respects access boundaries.

## 20. Concurrency

Material lifecycle changes require version precondition/compare-and-swap or equivalent reliable serialization. Concurrent review, release, retirement, and version amendment cannot overwrite another professional decision; at most one valid current transition wins. Stale replays cannot resurrect retired versions or alter immutable published data. Exact published package-set changes are serialized under its true owner.

## 21. Atomicity

For each successful lifecycle command, version/state changes, source/reviewer attribution, allowed package-binding reference where applicable, idempotency settlement and business audit outcome are one logical atomic operation. Partial failure rolls back the entire mutation. No published item may point to uncommitted review provenance or phantom package-version binding. A technical timeout remains outcome-unknown until authoritative readback, never assumed success.

## 22. Failure Semantics

Unknown ID/version, wrong actor/scope, invalid stage/age/conditions/source, review refusal, missing real professional approval, unpublished/retired version, wrong package, stale version, idempotency conflict, safety/compliance/consent block, and infrastructure failure are distinct internal outcomes. External disclosure follows existing anti-enumeration policy. Publication is fail-closed; no fallback to draft, unbound, retired or nearest package version. Infrastructure outage is not proof of professional unfitness or success. Empty eligible set is a truthful empty/not-ready result, not an invitation to hallucinate professional content.

## 23. Correction / Evolution

Pre-release edits retain audit attribution and invalidate prior review if reviewed content/metadata changes. Post-release substantive correction creates new draft version → real review → exact publication; existing history survives. Retiring a source or knowledge version blocks future consumption of that version; any later RAG cache/index must respect exact current publication/retirement state, even if stale vectors exist. No destructive overwrite or silent rebinding of historical references.

## 24. Observability / Audit

Audit create, review/reject, publish, retire, version correction and package inclusion decisions with authorized actor, exact item/version, source refs, reason, before/after status, request/correlation ID and time. Do not log sensitive family content, credentials or full copyrighted source material. Distinguish content not ready vs infrastructure failure; expose bounded nonsecret eligibility exclusion reason and exact version for future verification.

## 25. Dependency Gates

**Planning:** OPEN — four formal Docs and Slice 16 frozen semantics available. Slice 13–15 may plan/develop independently; no need to pretend they are merged.

**Future implementation:** BLOCKED until implementation-start reconciliation verifies that required single-authority scene/package version and Slice 16 professional provenance/binding interfaces are merged/usable, or proves a strictly independent, non-duplicative knowledge-content lifecycle can be implemented without them. A merged Slice 16 is the conservative initial hard prerequisite for authoritative package/provenance integration. Slice 13–15 merger status must be checked for any concrete affected integration seam, but none is automatically a hard requirement merely by numbering. Plan AI 2 must preserve rather than waive these gates.

**Downstream only:** pgvector/PG18 retrieval substrate, embedding/sparse Spike, RAG A/B/C Eval, Context Builder, AI Task, registry, Jev, Promptfoo, roleplay/support, Phase 4. They are consumers and cannot be pulled into this slice.

## 26. Clarifications / Decisions

C01 Knowledge is professional content, not Case/Family Memory. C02 Knowledge lifecycle is logically independent from InterventionDefinition lifecycle; it may reference exact definition versions but cannot approve them. C03 Only PUBLISHED+in approved exact package knowledge set+scope match is production-selectable. C04 Source reference alone is not source verification; source refs on interventions are not Knowledge Items. C05 Draft/REVIEWED are never production content. C06 Publication requires a real accountable professional reviewer. C07 A content body is not a retrieval chunk. C08 No embedding/index/search in this Slice. C09 AI drafts never approve/publish. C10 Existing authorization/control planes are authoritative and must be checked at family-scoped use. C11 Package-set changes cannot be a second independent Scene Package registry. C12 Raw source file storage is deferred, with legitimate source traceability required now. C13 No fixed knowledge quantity is invented; an empty published set is honest. C14 Package binding cannot float to latest. C15 No professional recommendation/eligibility based purely on knowledge. C16 Historical published versions remain immutable and auditable.

Open Product Decisions: **0**. The professional readiness of real source material/reviewers is an operational implement/release gate, not permission to invent approval.


## 27. Functional Requirements

- **FR-001** — Exactly one Knowledge Item professional-content owner exists; it does not duplicate InterventionDefinition.
- **FR-002** — Every item has a stable identifier and each substantive version has an exact immutable version identity.
- **FR-003** — Every publishable version contains attributable body, language, scene, stage, age/development scope, conditions, exclusions, risk and source provenance.
- **FR-004** — Missing required applicability/exclusion/risk metadata cannot mean universal applicability.
- **FR-005** — Professional references identify real source/version and reviewable provenance; unverifiable source prevents publication.
- **FR-006** — Knowledge content excludes identifiable family/child records and is not extracted from private cases by default.
- **FR-007** — DRAFT is not production selectable.
- **FR-008** — REVIEWED requires a real authorized professional decision, identity/role, exact revision and time.
- **FR-009** — REVIEWED alone is not production selectable.
- **FR-010** — Changing reviewed substantive content invalidates its approval and requires fresh review.
- **FR-011** — PUBLISHED requires completed review and complete professional content/source metadata.
- **FR-012** — PUBLISHED requires exact approved Scene/package-version inclusion; no floating latest.
- **FR-013** — Only PUBLISHED with matching exact scope may be offered to a future downstream content consumer.
- **FR-014** — Wrong stage/age/applicability/exclusion/risk scope fails closed.
- **FR-015** — RETIRED forbids new production content selection while preserving historical identity.
- **FR-016** — Retired version cannot be reactivated by mutation; successor is new version and review.
- **FR-017** — Published content and reviewed metadata are immutable; correction is superseding/versioned.
- **FR-018** — Package knowledge-version set history is exact and inspectable without creating a second package registry.
- **FR-019** — Knowledge and InterventionDefinition versioning/review remain distinct, with exact optional cross-reference only.
- **FR-020** — Knowledge never decides Intervention eligibility or Plan activation.
- **FR-021** — Professional mutation requires explicit staff/professional content authority, not family ownership.
- **FR-022** — Case-scoped content consumption must check existing Authorization for actor/family/case/purpose.
- **FR-023** — Unauthorized identity/scope checks cannot leak protected item/package existence.
- **FR-024** — Consent remains authoritative in its existing control plane; no knowledge lifecycle command changes Consent.
- **FR-025** — Compliance/age/purpose restrictions remain authoritative and cannot be bypassed by item labels.
- **FR-026** — Safety Hold and exclusion authority cannot be overridden by knowledge text or model.
- **FR-027** — AI drafts remain nonproduction; models and RAG cannot approve or publish a version.
- **FR-028** — Lifecycle commands reuse shared exact-replay/mismatch-conflict idempotency.
- **FR-029** — Stale revision commands and conflicting concurrent transitions cannot last-write-win.
- **FR-030** — Successful lifecycle change, provenance, binding, idempotency and audit settle atomically.
- **FR-031** — Partial failure rolls back all lifecycle business effects; unknown technical result requires readback.
- **FR-032** — Lifecycle and exclusions expose bounded auditable version/provenance/reason without sensitive data.
- **FR-033** — Source/knowledge retirement blocks new use and preserves prior exact historical references.
- **FR-034** — No embedding/chunk/vector/lexical retrieval, RAG, model execution or Phase 4 truth is created.
- **FR-035** — Deterministic no-model acceptance proves review/publication/scope lifecycle without fake professional sign-off.
- **FR-036** — Wrong or unknown package/version cannot fall back to a different package or content revision.
- **FR-037** — An empty genuine published knowledge set remains explicitly not ready, not synthetic published content.
- **FR-038** — Source and knowledge metadata cannot be used to create another Evidence or Problem Formulation store.
- **FR-039** — Production inclusion must prevent draft/retired knowledge despite stale downstream candidate references.
- **FR-040** — Implement gate remains blocked until authoritative required owner seams actually exist.


## 28. Acceptance Scenarios

- **AS-001** — Authorized professional creates an attributed complete draft; it remains nonproduction.
- **AS-002** — Attempt to publish a draft without review is rejected, with no package inclusion.
- **AS-003** — Real authorized reviewer approves an exact complete draft revision and records provenance.
- **AS-004** — Review by ordinary Family administrator is denied despite valid Case membership.
- **AS-005** — Professional review by a model-generated identity or AI-generated approval token is rejected.
- **AS-006** — Reviewed knowledge remains unavailable for production until separate published-and-bound state.
- **AS-007** — Approved publisher releases exact reviewed version to exact approved package version; it becomes scoped eligible.
- **AS-008** — Published item matches correct scene, stage, age and applicable conditions and no exclusion; downstream eligibility returns exact version.
- **AS-009** — Wrong scene or wrong stage returns no eligible content, never approximate fallback.
- **AS-010** — Wrong age/development scope fails closed.
- **AS-011** — Missing/UNKNOWN required conditions fail closed; no implied wildcard.
- **AS-012** — Applicable exclusion or higher risk condition blocks content selection.
- **AS-013** — Wrong package version and floating latest are rejected.
- **AS-014** — Unknown item ID/version is not treated as draft or latest.
- **AS-015** — Retired published version cannot be selected for a new use.
- **AS-016** — Retirement preserves old historical citations and review/published provenance.
- **AS-017** — Changing published content creates successor draft, not in-place overwrite.
- **AS-018** — Change to reviewed-only metadata invalidates review; new review required.
- **AS-019** — Correction of professional source produces new appropriately reviewed version.
- **AS-020** — Invalid or unverifiable source metadata prevents production publication.
- **AS-021** — Same idempotency key and exact payload replay returns same outcome with one effect.
- **AS-022** — Same idempotency key and changed payload conflicts with no new effect.
- **AS-023** — Two concurrent review/publish attempts settle to a single valid authoritative state.
- **AS-024** — Stale expected revision cannot overwrite newer publication/retirement.
- **AS-025** — Partial transaction failure leaves no published, bound, audited partial record.
- **AS-026** — Timeout/unknown commit outcome is resolved by authoritative readback, not guessed success.
- **AS-027** — Wrong actor denied professional content mutation, and unauthorized item existence not leaked.
- **AS-028** — Wrong family and wrong case denied at any case-scoped consumption boundary.
- **AS-029** — Consent withdrawn blocks affected case-context consumption while not altering immutable generic professional item.
- **AS-030** — Compliance/age policy blocks affected consumer even if item says age appropriate.
- **AS-031** — Safety Hold blocks ordinary affected use even if knowledge describes a seemingly safe action.
- **AS-032** — An AI draft cannot become reviewed/published without real human review.
- **AS-033** — A RAG candidate citing unapproved or retired content cannot promote it into authority.
- **AS-034** — A Knowledge Item describing an unapproved InterventionDefinition does not pass Slice 16 eligibility.
- **AS-035** — No real professional reviewer/source available leaves honest NOT READY status, never a fake green production status.
- **AS-036** — Historical published package snapshot remains unchanged when successor package includes a different version.
- **AS-037** — Attempted cross-tenant family facts inside professional source metadata is rejected/redacted under privacy policy.
- **AS-038** — An empty published package knowledge set yields truthful unavailable/empty response, not model-generated filler.
- **AS-039** — Reused professional_source_ref in a definition does not implicitly create/publish a Knowledge Item.
- **AS-040** — Unpublished item remains excluded even with cached/proposed embedding or RAG hit.
- **AS-041** — Existing Scene routing, Evidence, Consent, Compliance and Safety owners are unchanged by all scenarios.


## 29. Negative Scope Scenarios

- **NS-01** — No knowledge_embeddings, embedding model call or pgvector schema.
- **NS-02** — No retrieval index, search API, ranking, fusion, reranker or RAG A/B/C.
- **NS-03** — No chunk persistence, document parser or generic source-ingestion pipeline.
- **NS-04** — No generic CMS, expert marketplace, RBAC builder or workflow platform.
- **NS-05** — No new InterventionDefinition lifecycle, second intervention gate or InterventionInstance.
- **NS-06** — No AI Task Runtime, Context Builder, TaskModelRegistry, provider router or agent framework.
- **NS-07** — No Jev bounded decision or Promptfoo evaluation platform runtime.
- **NS-08** — No A4003 roleplay, problem-formulation generation or execution-support AI.
- **NS-09** — No Phase 4 Goal/Plan/Task/Checkin/Review/Outcome/Schedule/Notification.
- **NS-10** — No second Case/Evidence/Formulation/Family Memory truth.
- **NS-11** — No second Authorization/Consent/Compliance/Safety owner.
- **NS-12** — No alternate node Manifest, Scene routing or independent package registry.
- **NS-13** — No full raw professional document archive or default copyrighted material redistribution.
- **NS-14** — No family private data transformed into professional Knowledge Item automatically.
- **NS-15** — No unreviewed or AI-approved professional production content.
- **NS-16** — No floating latest knowledge binding or silent overwrite of published history.
- **NS-17** — No amendment to four Docs or frozen Slice 12–16 artifacts.
- **NS-18** — No actual RAG release or production AI answer claimed by completion of Slice 17.


## 30. Dependencies and Traceability

Upstream: approved four Docs; existing Common Core controls; Slice 11 Scene Manifest/package identity; Slice 12 scene state where applicable; Slice 16 exact InterventionDefinition/professional source binding interface for integration. Slice 13–15 are planned Phase 2 runtime and must not be represented as merged; concrete coupling is evaluated at implementation-start. Downstream: PG18/pgvector, sparse/lexical Spike, Gold Dataset/RAG A/B/C, Context Builder, Task Runtime/Model Registry, Eval, Jev, Phase 4 all remain future work.

This Spec governs semantics, not database file names, migration numbers, class names, test filenames or implementation sequence. Plan AI 2 is responsible for technical planning, checklist, tasks and Audit 1, subject to exact frozen Spec.

## 31. Frozen Spec Gate

Authority Gate: PASS. Repository Reality Gate: PASS (remote main + branch states inspected). Phase Boundary Gate: PASS. Selection Gate: PASS. Goals/In Scope/Out of Scope/Ownership/Dependencies: COMPLETE. FR/Acceptance/Negative Scope: COMPLETE. Clarifications: COMPLETE. Open Product Decisions: **0**. Scope Drift: **0**. Planning Gate: **OPEN**. Future Implement Gate: **BLOCKED** pending real owner integration availability and development-start reconciliation.

Freeze means the semantic contract is stable for independent planning. It does not mean a professional content corpus was reviewed, a runtime exists, or a PR is merge-safe.

## 32. Plan AI 1 Stop Boundary

No Plan, Checklist, Tasks, Analyze/Audit 1, production code, migration, implementation tests, Audit 2, or merge may be performed by this role. Plan AI 2 owns all following planning work.

## 33. Final Frozen Decision

**Selected Slice:** Professional Knowledge Foundation  
**Feature Slug:** `017-professional-knowledge-foundation`  
**Phase:** Phase 3 — Professional Knowledge & AI  
**Selection:** PASS  
**Planning:** OPEN  
**Future Implement:** BLOCKED  
**Open Product Decisions:** 0  
**Scope Drift:** 0  
**Decision upon write/read-back:** READY FOR PLAN AI 2. **STOP.**
