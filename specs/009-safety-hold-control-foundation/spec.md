# Slice 9 — Safety Hold Control Foundation

Status: FROZEN SPEC READY  
Slice: 009-safety-hold-control-foundation  
Selected Phase: Phase 1 — Common Core Foundation  
Repository: pyxm1618/xiaoshuyin  
Verified selection base: 8e393c990be53c888c2e68d881bd8b23f9c37638  
Authoritative Docs state: post-PR #25 Digital Use Authority Remediation  
Slice 8 frozen spec ref: 6a0df0021cf4dd0f489178a192479a52ea6027f4  
Slice 8 current spec branch head at selection time: 31c03a2355fa8b5972d56ea26684fb7f8df7b8f4  
Slice 8 frozen spec blob remains unchanged after the frozen commit.

This document defines the next independently reviewable Phase 1 capability after an independent Authority Gate, Phase 1 completion audit, and candidate selection. It does not modify any upstream product meaning.

---

## 1. Selection Record

### 1.1 Authority Gate

Independent review of all four authoritative documents at the verified base found no remaining Digital Use authority conflict.

- S9-AUTH-01 — CLOSED.
  - Digital Use is broad digital-device use, including phones, tablets, computers, game consoles / game devices, and related digital equipment.
  - No current authoritative rule excludes computers.
- S9-AUTH-02 — CLOSED.
  - There is no approved universal six-year minimum-age hard gate for the entire Digital Use Scene.
  - A concrete professional rule may have its own age applicability without becoming a Scene-wide minimum age.
- S9-AUTH-03 — CLOSED.
  - Learning, necessary contact, entertainment / game / video / social use are distinguished.
  - Total duration and historical duration bands are Evidence / Assessment dimensions only.
  - Duration alone cannot decide Problem / No Problem, Intervention / No Intervention, or A200x routing.

No new authority conflict was found.

AUTHORITY GATE: PASS

### 1.2 Phase 1 Completion Gate

PHASE 1 COMPLETION: NOT COMPLETE

Current main contains substantial Phase 1 foundations, but the Phase is not complete.

| Phase 1 capability | Current main status | Independent conclusion |
|---|---|---|
| Account / Person / Family / Participant | IMPLEMENTED | Real schema, authorization, participation, identity binding, RLS, tests exist. |
| Case Status / Phase | IMPLEMENTED foundation | Canonical enums and Case storage exist; full lifecycle commands are intentionally not all present. |
| Statement / Observation / Fact / Hypothesis | PARTIAL | Statement / Observation are real. FACT is schema-expressible but production writing is deliberately denied. Hypothesis writer fails closed until a legitimate producer exists. |
| Problem Formulation | NOT IMPLEMENTED IN MAIN | Slice 8 spec is frozen but its runtime is not in main. |
| Consent / Authorization | IMPLEMENTED foundation | Real guardian-consent and single authorize entry exist. |
| Compliance Profile / guardian consent | IMPLEMENTED | Current server-side profile and consent contracts exist. |
| Compliance feature policy | NOT IMPLEMENTED | No compliance_feature_policies runtime/table exists yet. |
| Safety State / SAFETY_HOLD invariant | PLACEHOLDER ONLY / PARTIAL | SAFETY_HOLD is a Case status and SwitchPrimaryCase has a local guard, but no complete Safety control layer exists. |
| deterministic Safety precheck interface | NOT IMPLEMENTED | No Safety package or deterministic precheck contract exists. |
| Domain Command Safety guard | NOT IMPLEMENTED | No single reusable Safety guard protects ordinary progression commands. |
| EnterSafetyHold | NOT IMPLEMENTED | No command/state transition/audit path exists. |
| ResolveRisk | NOT IMPLEMENTED | No command exists; no current approved resolver role is implemented. |
| Risk Event / equivalent audit object | NOT IMPLEMENTED | No risk_events artifact exists. |
| Domain Commands | PARTIAL | Commands for delivered slices exist; Phase 1 Safety guard and Problem Formulation commands do not yet exist in main. |
| business_audit_events / case_events | IMPLEMENTED foundation | Real append/audit infrastructure exists and is extended by delivered slices. |
| PostgreSQL / node-postgres | IMPLEMENTED | Real PostgreSQL transactions, migrations and runtime repositories exist. |
| Drizzle ORM / drizzle-kit | PARTIAL | drizzle-orm dependency and config exist, but db/schema is absent and current repositories/transactions are node-postgres based. |
| uuidv7 | IMPLEMENTED | Database-native uuidv7 baseline is real and tested. |
| Migrator / Runtime dual roles | IMPLEMENTED | Distinct NOBYPASSRLS roles exist. |
| RLS + withRlsTransaction | IMPLEMENTED | Real family-scoped transaction context and forced RLS exist. |
| Zod / OpenAPI typed contracts | IMPLEMENTED foundation | Runtime Zod contracts, OpenAPI generation/check, and generated OpenAPI types exist. |
| Node 26 / Fastify 5 baseline | IMPLEMENTED | Current repository and CI use the required baseline. |
| Temporal time/timezone standard | DEFERRED BY CURRENT CAPABILITY NEED | No current Phase 1 delivered capability requires calendar/follow-up scheduling; the standard remains authoritative for later time-sensitive implementation. |
| idempotency / versioning / concurrency | IMPLEMENTED foundation | Existing slices have real idempotency, optimistic versions, locking and concurrency tests. |

The next Slice must not absorb every remaining Phase 1 gap. It must close the smallest dependency-critical gap that is both independently reviewable and safe to implement.

### 1.3 Candidate Comparison

The following comparison was performed only after the Authority and Phase Completion Gates.

#### A. Safety Control Foundation — SELECTED

1. Formal V1 gap: SAFETY_HOLD is currently only a vocabulary plus one local switch guard; the mandatory control plane is absent.
2. Authority: V1产品需求 V1-C24/V1-C25 and Safety sections; V1技术设计 §§5, 6.6, 6.7, 23, 27, 32, 38, 39, 41; 总产品需求 Safety priority.
3. Phase: Phase 1.
4. Existing dependencies: Case status/version, authorization, RLS transaction, audit events, idempotency, concurrency patterns, SwitchPrimaryCase.
5. Missing dependencies: Safety precheck contract, Risk Event, EnterSafetyHold, reusable guard, ResolveRisk contract.
6. Slice 8 runtime dependency: NONE.
7. Design now: YES.
8. Implement now: YES at the control-foundation level; no Phase 5 operational service is required.
9. Cross-phase: NO if professional content, referral, human operations, Guardrails and AI risk review remain excluded.
10. Premature capability: NO.
11. Independent closure: YES — converts SAFETY_HOLD from a passive enum into an enforceable state-control contract.
12. Framework-only risk: NO — it owns a real state transition, real risk event, real command guard, audit/idempotency/concurrency semantics, and integrates with an already-real command.
13. Fake service required: NO. No fake expert, hotline, referral, AI service or operations queue is permitted.
14. If skipped: every new ordinary progression command and Phase 2 Scene runtime can expand before the mandatory non-bypassable Safety gate exists.
15. Slice size: appropriate for independent implementation/test/audit if Phase 5 content/operations stay out.

#### B. Digital Use Canonical Flow / Manifest Foundation

1. Gap: Phase 2 machine projection of canonical Digital Use does not exist.
2. Authority: V1技术设计 §§12, 32.2, 38, 39, 41 and V1-D00—D43.
3. Phase: Phase 2.
4. Existing dependencies: authoritative post-PR #25 canonical flow.
5. Missing dependencies: Phase 1 Safety foundation; Problem Formulation runtime remains unmerged.
6. Slice 8 dependency: no hard dependency for pure snapshot design, but later runtime integration depends on Common Core.
7. Design now: possible.
8. Implement now as the next project Slice: NO.
9. Cross-phase: YES if chosen before remaining mandatory Phase 1 control foundations.
10. Premature capability: YES as the next implementation.
11. Closure: a full manifest could close a Phase 2 contract.
12. Framework risk: high if reduced to registry/interfaces only.
13. Fake service required: no for deterministic graph tests.
14. If skipped now: nothing in current Phase 1 is newly blocked; it becomes necessary immediately after Phase 1 gates.
15. Size: a real full manifest is larger than the selected Safety foundation.

#### C. Full Node Manifest + Deterministic Routing

Same Phase 2 authority as B, but with stronger graph/routing completeness. It is valid only as a real projection of all approved nodes and relations; an empty registry is forbidden. It is not selected because Phase 1 Safety remains absent. It can be designed later without a model and must fail on missing/extra node, invalid next, hidden default, orphan, illegal dead-end, lost parallel relation and snapshot drift.

#### D. Digital Use Assessment Runtime

1. Gap: no Scene runtime exists.
2. Authority: V1技术设计 §§12, 23, 28, 38, 41.
3. Phase: Phase 2.
4. Existing dependencies: Evidence Core and Case Core.
5. Missing dependencies: manifest/routing, Safety guard; Problem Formulation production handoff is not in main.
6. Slice 8 dependency: eventual runtime handoff YES.
7. Design now: only after manifest contract is frozen.
8. Implement now: NO.
9. Cross-phase: would jump ahead.
10. Premature: YES.
11. Closure: potentially, but too broad now.
12. Framework-only risk: high if manifest is absent.
13. Fake service: no model is needed, but deterministic fixtures are required.
14. If skipped: current blocker remains Safety/Phase 1, not Assessment runtime.
15. Size: too large for the immediate next Slice.

#### E. A1001—A2010 Assessment Slice

This is Phase 2, depends on the canonical snapshot/manifest/routing and must preserve post-PR #25 device, age, purpose and duration semantics. It is not selected because it would implement Scene behavior before the Common Core Safety gate and before a full deterministic routing substrate.

#### F. Scene Package Foundation

A package-only shell without the real canonical nodes/routing would violate the selection standard. A real Scene Package belongs to Phase 2 and should arrive with actual manifest/routing fidelity, not as empty architecture. Not selected.

#### G. Dependency Propagation

Dependency invalidation/propagation is real but currently spans objects that do not yet all exist. The Slice 8 spec already defers broader propagation. Selecting it now would create cross-object framework code without complete producers/consumers. Not selected.

#### H. Goal Core

Goal / Intervention / Plan are Phase 4 under §38. Selecting Goal merely because Problem Formulation points to GOALS would violate the approved Phase order. Not selected.

#### I. WAITING / Resume

WAITING vocabulary exists, but ResumeAfterInformation requires a real blocker to clear and rechecks Authorization / Safety / Package; later follow-up scheduling also participates. A complete implementation is not the smallest current Phase 1 closure and would either be partial or pull in later lifecycle infrastructure. Not selected.

#### J. LOST_CONTACT

MarkLostContact requires at least two agreed feedback nodes plus at least one real authorized contact attempt. Those dependencies do not exist yet. Implementing it now would require fake schedules/contact attempts or a non-functional shell. Not selected.

#### K1. Compliance Feature Policy Foundation

This is a real Phase 1 gap. It is not selected ahead of Safety because no current delivered feature consumes the missing feature-policy matrix, while Safety is already a hard invariant over current and immediately upcoming ordinary progression commands. Feature policy must be completed before feature-specific minor/AI-release capabilities that depend on it, including later A4003/AI compliance behavior.

#### K2. Drizzle Data Access Remediation

This is a real Phase 1 technical gap: current main has node-postgres persistence, drizzle-orm dependency and drizzle config, but no db/schema and no Drizzle-owned transaction/query layer. It is not selected as the product/domain Slice because the real PostgreSQL/RLS/transaction substrate already exists and the immediate missing semantic gate is Safety. Plan AI 2 MUST nevertheless prove that Slice 9 persistence complies with the authoritative §7.0 Drizzle contract; it may not silently deepen raw-pg architectural drift. If that cannot be done within a narrow implementation without creating a second schema truth, implementation must stop and raise a separate data-access remediation blocker.

#### K3. Evidence FACT / HYPOTHESIS producer completion

The current Evidence model deliberately represents FACT/HYPOTHESIS while denying unsupported production writers. Hypothesis production depends on later approved AI/decision producers; inventing one now would violate phase boundaries. This is not the current blocker.

#### K4. Problem Formulation Core

Already owned by frozen Slice 8. Re-selecting it would duplicate scope and create a second truth source. Not selected.

### 1.4 Selection

SELECTED SLICE: 009-safety-hold-control-foundation

Why now:

- Phase 1 is not complete.
- Safety is explicitly a Phase 1 hard gate in §38.
- Current main exposes SAFETY_HOLD but cannot actually enter/resolve/audit it through the required domain contract.
- The selected foundation can be implemented without Scene, AI, Referral, professional support content or a fake human service.
- It creates a real reusable control that immediately protects an existing command and becomes an upstream dependency for Slice 8 integration and Phase 2 commands.

Why not Manifest / Assessment / Goal / later status lifecycle:

- Manifest and Assessment are Phase 2.
- Goal is Phase 4.
- WAITING/LOST_CONTACT complete semantics depend on later blockers/schedules/contact evidence.
- Safety is the earlier mandatory Common Core control.

---

## 2. Problem / Purpose

Current main stores SAFETY_HOLD as a valid Case status and SwitchPrimaryCase locally refuses a held current/target Case. That is not equivalent to a Safety foundation.

The repository currently lacks:

- a canonical Safety precheck contract;
- a real EnterSafetyHold transition;
- a Risk Event business/audit object;
- one reusable Safety guard for ordinary progression commands;
- a ResolveRisk-only exit contract;
- concurrency/idempotency rules for Safety state changes;
- transactionally coupled Case state + event + audit semantics.

Without these controls, future Problem Formulation and Digital Use runtime can add ordinary progression paths that accidentally bypass Safety.

This Slice establishes the minimum Phase 1 Safety control plane while deliberately excluding Phase 5 Safety operations.

---

## 3. Goal

After this Slice:

1. SAFETY_HOLD is an enforceable Case state, not only an enum value.
2. A deterministic Safety precheck contract exists and cannot depend on an LLM/network service.
3. EnterSafetyHold is the only Phase 1 command that enters SAFETY_HOLD.
4. A successful hold entry creates a traceable Risk Event plus Case event/audit evidence in the same transaction.
5. Ordinary progression commands have one reusable fail-closed Safety guard.
6. SwitchPrimaryCase uses/obeys that central Safety contract without weakening its existing behavior.
7. No ordinary command can release a held Case.
8. ResolveRisk is the unique legal exit contract; it requires real review evidence and separately verified resolution authority.
9. No current Family actor is silently granted Safety-resolution authority.
10. Safety professional content, support resources, referral and human operations remain Phase 5.

---

## 4. In Scope

- Canonical use of cases.status = SAFETY_HOLD as the current Safety hold truth.
- A Safety control domain module/package suitable for Common Core reuse.
- Deterministic Safety precheck interface and result contract.
- Current-Safety-state check as a mandatory precheck input.
- Internal EnterSafetyHold Domain Command.
- Minimal Risk Event persistence required to prove why/when a hold was entered and later resolved.
- Reusable ordinary-progression Safety guard.
- Integration of the guard with the existing SwitchPrimaryCase semantics.
- Contract-level integration seam for Slice 8 StartAssessment / Present / Confirm / Dispute / Corrections / Reassess and later Phase 2/4 ordinary commands.
- Internal ResolveRisk Domain Command contract as the unique legal hold exit.
- Fail-closed ResolveRisk authorization in current production until an approved resolver authority exists.
- Case versioning for Safety state transitions.
- Safety command idempotency.
- Concurrency protection.
- case_events and business_audit_events additions necessary for Safety transitions.
- RLS / Family isolation for Risk Event data.
- Privacy-minimized audit metadata.
- Unit, integration and database verification.

---

## 5. Out of Scope

This Slice MUST NOT implement:

- Safety professional guidance/content.
- Reviewed static support-resource text.
- support_resources.
- Referral lifecycle or referrals.
- Real-world emergency services or hotlines.
- Fake experts, fake reviewers, fake on-call staff or fake response SLAs.
- Operations UI, Safety queue or staff dashboard.
- A new staff role taxonomy merely to make ResolveRisk pass.
- Full staff_assignments implementation unless separately approved by upstream scope.
- Alibaba AI Guardrails.
- risk_review model route.
- Any LLM, RAG, embedding, prompt orchestration, agent framework or AI runtime.
- Digital Use Scene Package.
- node-manifest.ts or routing.ts.
- A1001—A5002 runtime.
- Problem Formulation implementation owned by Slice 8.
- Goal / Intervention / Plan / Task / Review / Follow-up.
- Notification suppression runtime that does not yet exist; only the future guard contract is established.
- WAITING/Resume full lifecycle.
- LOST_CONTACT lifecycle.
- Closure / Recurrence.
- broad dependency propagation.
- a safety_states table or any second current-Safety truth source.
- public EnterSafetyHold or ResolveRisk API endpoints.
- product-specific high-risk thresholds/pattern catalog not already approved upstream.
- changes to authoritative Docs.
- changes to the Slice 8 frozen spec.

---

## 6. Non-Goals

- This is not “Full Safety”.
- This is not a mental-health triage engine.
- This is not an expert-service platform.
- This is not a professional-content authoring Slice.
- This does not claim a user-facing Safety journey is production-ready.
- This does not decide who a future human Safety reviewer is.
- This does not decide a real-world escalation/referral destination.
- This does not let a model change Safety state.
- This does not make a generic workflow engine.
- This does not make Safety a new second Case lifecycle.

---

## 7. Upstream Requirements & Traceability

Primary upstream anchors:

- 总产品需求
  - Safety has higher priority than ordinary service flow.
  - High-risk situations must interrupt ordinary processing.
  - AI cannot independently remove a safety interruption.
  - Real-world/human services may only be claimed when actually available.

- V1产品需求
  - V1-C24: AI cannot independently confirm protected business facts or release Safety.
  - V1-C25: Safety can interrupt any phase and must not be bypassable by ordinary operations.
  - V1-C27: failures must report real state, not fake success.
  - V1-C28: retry/concurrency must not duplicate business results.
  - V1-C34/C35: human/Safety operations only represent real capability; no fake expert/empty queue.
  - Case I: Safety takes precedence over ordinary flow.

- 总体技术架构
  - Safety State and deterministic controls are Common Core concerns.
  - Safety Hold overrides ordinary flow.
  - AI does not own final Safety authority.

- V1技术设计
  - §5 invariants 10, 12, 17, 20, 28.
  - §6.6 Case Status transition contract.
  - §6.7 phase transitions guarded by Safety.
  - §7.7 Safety / Referral data domain.
  - §8 idempotency/version/concurrency principles.
  - §9 authorization and §9.1 RLS.
  - §23 Domain Commands.
  - §27.1 deterministic precheck.
  - §27.3 Safety Hold + Risk Event + ResolveRisk-only exit.
  - §32 release blockers.
  - §38 Phase 1 Safety State / SAFETY_HOLD invariant / deterministic precheck interface / Domain Command guard.
  - §39 V1-C25 traceability.
  - §41 final implementation principles.

No requirement in this Slice may redefine Digital Use device/age/purpose/duration semantics.

---

## 8. Actors

### 8.1 Ordinary authenticated actor

An authenticated Account/Person operating under existing Authorization and Family scope.

This actor does not gain the ability to directly request or clear SAFETY_HOLD merely because they are:

- Family manager;
- guardian;
- participant;
- Case creator.

### 8.2 Safety Policy caller

A trusted internal application/domain caller that obtains a deterministic precheck result from the approved Safety-precheck seam.

It is not a public client and does not accept a caller-supplied boolean such as “isHighRisk=true” as authority.

### 8.3 Safety resolution authority

An actor/capability that a future approved Authorization contract can prove is allowed to resolve Safety.

Current authoritative Docs do not define a concrete production resolver role. Therefore this Slice MUST NOT map Family manager, guardian, participant or ordinary Account to that authority by invention.

The current production posture is fail-closed: no approved resolver authority means no production release.

### 8.4 AI/system model

May not enter or resolve Safety by direct database write. Later model risk review may only propose a candidate for deterministic/domain validation and is out of scope here.

---

## 9. Domain Concepts

### 9.1 Current Safety Hold State

The current hold truth is the Case status:

SAFETY_HOLD

No safety_states table is introduced.

Risk Events explain and audit Safety control events; they do not become a second current-state source.

### 9.2 Deterministic Safety Precheck

A synchronous, deterministic contract evaluated before ordinary progression where required.

Inputs MUST support at least:

- current Case status/version;
- current approved Safety policy/rule version identity;
- deterministic rule inputs supplied by the approved policy evaluator;
- Scene rule result when a later Scene owns one.

The interface MUST NOT require:

- a model call;
- RAG;
- external network access;
- an agent;
- free-form model judgment.

The concrete professional high-risk rule catalog is not invented by this Slice.

### 9.3 Safety Precheck Decision

Minimum semantic outcomes:

- ALLOW — no deterministic hold condition established by the supplied approved rules/current state.
- ENTER_HOLD — deterministic policy requires Safety Hold.
- ALREADY_HELD — the Case is already SAFETY_HOLD; ordinary progression remains blocked.

Names/types may be refined by Plan AI 2, but these semantics may not change.

### 9.4 Risk Event

A Risk Event is a Family/Case-scoped business/audit object proving a Safety control occurrence.

At minimum it must make it possible to establish:

- the Case;
- when the risk control event occurred;
- deterministic source/category identity without raw sensitive free text;
- Safety policy/rule version identity when applicable;
- the Case revision against which the decision was made;
- whether the event initiated a hold or records an authorized resolution;
- resolution evidence references when a resolution is legitimately recorded;
- authorized actor/capability identity for resolution when applicable.

Risk Events MUST NOT duplicate raw user text into audit metadata.

### 9.5 Ordinary Progression Safety Guard

One reusable Domain Policy seam that answers whether a Case is allowed to perform an ordinary lifecycle/progression mutation.

If the Case is SAFETY_HOLD, ordinary progression MUST fail closed.

Safety control commands themselves are not “ordinary progression”.

Evidence/message capture, Consent/Authorization operations and data-rights operations are not globally disabled merely because a Case is held; each remains governed by its own contract. A future command can be added to the blocked set only when its upstream semantics classify it as ordinary progression.

---

## 10. State / Runtime Semantics

### 10.1 Entering Safety Hold

From any non-CLOSED Case status, a valid deterministic Safety policy decision may enter SAFETY_HOLD.

Required effects:

- Case.status becomes SAFETY_HOLD.
- Case.phase is preserved.
- Case.version advances exactly once.
- A Risk Event is persisted.
- A Case event is appended.
- A business audit event is appended.
- Idempotency result is persisted.
- All writes are atomic.

A CLOSED Case cannot be re-opened through EnterSafetyHold.

### 10.2 While Held

While Case.status = SAFETY_HOLD:

- ordinary progression is blocked;
- primary switching cannot switch away from a held current primary or promote a held target;
- future StartAssessment / Problem Formulation / Scene / Goal / Plan progression must consume the same guard;
- no ordinary command may rewrite status to OPEN/WAITING/LOST_CONTACT/CLOSED as a bypass;
- normal-model output cannot release Safety;
- evidence needed to understand/resolve risk may still be recorded through its own authorized path.

### 10.3 Resolving Risk

The only legal hold exit contract is ResolveRisk.

A successful ResolveRisk requires all of:

- current Case.status is SAFETY_HOLD;
- current Case revision is revalidated;
- required review evidence is explicitly referenced and valid under its own contract;
- a separately verified Safety-resolution authority is present;
- no ordinary actor privilege is substituted for that authority.

Successful transition:

SAFETY_HOLD → WAITING

Required effects:

- Case.phase is preserved.
- Case.version advances exactly once.
- a resolution Risk Event/evidence link is recorded;
- Case event and business audit event are recorded;
- old tasks/plans/reminders are NOT automatically resumed;
- no old schedule is implicitly recreated.

Current production has no approved resolver role. Therefore the production authorization mapping remains deny-by-default until a later approved Slice provides the real authority/operations contract.

### 10.4 Stale Precheck

A precheck result MUST NOT be applied against a different Case revision or a superseded policy/rule version without revalidation.

Implementation must either:

- evaluate and transition in one protected transaction; or
- bind the decision to revision/version and reject stale application.

The exact technical mechanism is Plan AI 2 scope.

### 10.5 Re-entry / duplicate hold

Same idempotency key + same request/decision replay returns the original result with no duplicate Case transition, Risk Event, Case event or audit.

A separate EnterSafetyHold attempt while already held MUST NOT create a second Case-status transition or reset the hold.

Additional risk-detail accumulation while already held belongs to later Safety Operations unless separately approved.

---

## 11. Commands / Operations

### 11.1 RunSafetyPrecheck

Internal deterministic operation.

Responsibilities:

- read/evaluate current Safety state;
- evaluate only approved deterministic rule inputs;
- return a typed decision;
- never mutate business state by itself;
- never call AI/network services.

### 11.2 EnterSafetyHold

Internal explicit Domain Command.

Responsibilities:

- authorize/validate the current request/case context;
- revalidate deterministic precheck authority;
- lock/revalidate current Case revision;
- reject CLOSED;
- atomically set SAFETY_HOLD;
- persist Risk Event + case event + business audit + idempotency result.

No public API endpoint is added.

### 11.3 AssertOrdinaryProgressionAllowed

Reusable Domain Policy/guard.

Responsibilities:

- inspect current Case state inside the command transaction;
- return/throw a stable non-leaking Safety-blocked result when held;
- be reusable by existing and future ordinary progression commands;
- be impossible to bypass by passing stale caller state.

The existing SwitchPrimaryCase behavior MUST remain at least as strict as before.

### 11.4 ResolveRisk

Internal explicit Domain Command and the only legal hold-exit contract.

Responsibilities:

- require SAFETY_HOLD;
- require current revision;
- require valid review evidence refs;
- require separately verified resolution authority;
- fail closed if authority is unavailable;
- atomically move to WAITING when legitimately authorized;
- persist resolution evidence/event/audit/idempotency;
- never auto-resume old work.

No public API endpoint is added in this Slice.

---

## 12. Authorization

- All Family/Case-scoped data access remains authorize-first and RLS-backed.
- Safety state does not create a shortcut around the existing single authorization entry.
- EnterSafetyHold is not a user-selectable status-update endpoint.
- Client-supplied Case status, “risk=true”, “resolved=true”, resolver role or policy-match flags are not authority.
- ResolveRisk MUST use a separately verified authorization/capability.
- Current Family manager / guardian / participant status MUST NOT be treated as Safety-resolution authority unless a future authoritative contract explicitly says so.
- AI/system principal MUST NOT resolve Safety.
- No current public actor receives a new ResolveRisk permission in this Slice.
- Cross-Family access returns the established non-leaking result and RLS denies direct cross-family rows.

---

## 13. Data / Artifact Semantics

### 13.1 cases

Reuse the existing cases row and status enum.

This Slice may add only the minimum reviewed migration/grants required to make Safety status/version transitions possible for the runtime role.

It MUST NOT alter the five canonical Case status values:

OPEN
WAITING
LOST_CONTACT
SAFETY_HOLD
CLOSED

### 13.2 risk_events

A new Risk Event persistence object is allowed because §27.3 explicitly requires a Risk Event when entering Safety Hold.

Logical requirements:

- Family scoped;
- Case scoped;
- server-generated identity/time;
- immutable identity and Case/Family ownership;
- traceable event kind;
- policy/rule version/reference when applicable;
- revision/reference to the Case decision point;
- evidence/reference fields rather than raw sensitive content;
- resolution record/reference when applicable;
- RLS enabled and forced;
- no cross-Family mutation;
- no public client-controlled authoritative fields.

The Plan may choose append-only event rows or another auditable representation, but MUST NOT create a second “current safety state” column/table that can disagree with cases.status.

### 13.3 case_events

Extend only with Safety state transition event vocabulary needed for this Slice.

Events must be append-only and metadata-minimized.

### 13.4 business_audit_events

Extend only with the necessary Safety command event/resource vocabulary.

Audit metadata MUST NOT copy:

- raw user message text;
- high-risk free text;
- full review notes;
- professional support content.

### 13.5 idempotency_keys

Extend the existing idempotency mechanism for Safety transition commands.

No second idempotency store is allowed.

---

## 14. Dependencies

### 14.1 Required upstream runtime dependencies already in main

- Case Core.
- case status/version.
- case_events.
- business_audit_events.
- idempotency infrastructure.
- authorize().
- withRlsTransaction and Family context.
- PostgreSQL transaction/locking patterns.
- Case Primary Switch semantics.
- generated/typed error/contract infrastructure where applicable.

### 14.2 Slice 8 dependency

Slice 8 runtime is NOT an upstream dependency of this Slice.

The Slice 8 frozen spec is a downstream/integration consumer because its StartAssessment and Problem Formulation mutations already require Safety blocking.

### 14.3 Downstream consumers

- Slice 8 runtime integration.
- Phase 2 RecordSceneNodeResponse / Digital Use routing.
- Goal/Plan/Task/Review commands.
- Follow-up/notification scheduling.
- Phase 5 Safety operations.
- future risk_review candidate flow after Phase 3, which may propose but never directly mutate Safety.

### 14.4 Technical data-access dependency

V1技术设计 §7.0 and §38 require Drizzle ORM / drizzle-kit / node-postgres.

Current main is only PARTIAL on that contract.

Plan AI 2 MUST explicitly resolve how Slice 9-owned schema/query/transaction work complies with that contract without:

- silently deepening raw-pg-only drift;
- introducing a second schema truth;
- rewriting unrelated delivered slices inside this Slice.

If no narrow compliant implementation is possible, implementation must stop with an implementation-only blocker and a separate data-access remediation Slice must precede coding. This is not an Owner/product decision.

---

## 15. Idempotency / Concurrency / Transactions

### 15.1 EnterSafetyHold

- requires idempotency;
- same key + same canonical request/decision returns the original outcome;
- same key + different payload/decision returns conflict;
- two concurrent distinct commands cannot produce two status transitions from the same Case revision;
- only one transition may advance the Case version;
- no duplicate Risk Event / case event / audit may be produced for one successful command.

### 15.2 ResolveRisk

- same idempotency rules;
- concurrent resolution attempts against one held revision allow at most one successful transition;
- a stale second request fails with state/version conflict;
- failed authorization or failed evidence validation produces zero business writes.

### 15.3 Atomicity

For each successful state command, these are one database transaction:

Case status/version
+
Risk Event
+
case_event
+
business_audit_event
+
idempotency result

Partial success is forbidden.

### 15.4 Lock ordering

Exact SQL/lock ordering is Plan AI 2 scope, but it must:

- prevent lost updates;
- avoid a stale precheck/transition race;
- preserve existing Case primary-switch concurrency invariants;
- not introduce process-local locks as business truth.

---

## 16. Failure Semantics

At minimum, implementation must distinguish without leaking protected data:

- unauthenticated / unauthorized;
- Case not visible;
- Family mismatch;
- Case CLOSED;
- Case already SAFETY_HOLD;
- SAFETY_HOLD blocks ordinary progression;
- stale Case version / stale precheck;
- invalid/missing deterministic policy decision;
- invalid/missing review evidence;
- Safety resolution authority unavailable/denied;
- idempotency payload mismatch;
- transaction/internal failure.

Rules:

- failure never silently becomes ALLOW;
- missing Safety facts fail closed where Safety authority is required;
- infrastructure failure cannot be reported as “risk resolved”;
- no failure path mutates status without its required event/audit records.

Stable machine codes are Plan AI 2 scope, but semantics above are frozen.

---

## 17. Requirements

### FR-001 — Single Safety truth

The current hold state MUST be derived from cases.status. No safety_states current-state table/source is allowed.

### FR-002 — Deterministic precheck contract

A synchronous deterministic Safety precheck interface MUST exist and MUST NOT call an LLM, RAG, external Safety service or network resource.

### FR-003 — Current-state awareness

The precheck/guard MUST consider current SAFETY_HOLD before allowing ordinary progression.

### FR-004 — No invented professional thresholds

This Slice MUST NOT invent high-risk keyword lists, age thresholds, clinical scores, duration thresholds, emergency classifications or professional decision rules.

### FR-005 — Explicit hold command

Only EnterSafetyHold may perform the Phase 1 ordinary-to-SAFETY_HOLD transition.

### FR-006 — Hold transition semantics

A successful EnterSafetyHold preserves phase, advances Case version exactly once and atomically records Risk Event + case event + audit + idempotency result.

### FR-007 — CLOSED is immutable

EnterSafetyHold MUST NOT reopen or mutate CLOSED.

### FR-008 — Ordinary progression guard

A held Case MUST fail closed for ordinary progression.

### FR-009 — Existing primary-switch invariant

SwitchPrimaryCase MUST still reject both a SAFETY_HOLD current primary and a SAFETY_HOLD target. Refactoring to the shared guard MUST NOT weaken current behavior or error precedence.

### FR-010 — No global data blackout

Safety Hold MUST NOT by itself erase/block authorized evidence/message capture, Consent/Authorization operations or later data-rights operations unless their own authoritative contracts require a block.

### FR-011 — Unique release command

No command other than ResolveRisk may transition a Case out of SAFETY_HOLD.

### FR-012 — Resolution evidence

ResolveRisk requires explicit valid review evidence references. A boolean “resolved=true” is insufficient.

### FR-013 — Resolution authority

ResolveRisk requires separately verified authority. Current Family roles are not silently upgraded to Safety resolver.

### FR-014 — Current production fail-closed release

Until a future approved authority/operations contract exists, current production callers MUST NOT be able to successfully resolve Safety Hold.

### FR-015 — Resolve target

A legitimate ResolveRisk transitions SAFETY_HOLD to WAITING, preserves phase and does not auto-resume old tasks/plans/reminders/schedules.

### FR-016 — Risk Event

Every successful hold entry has a traceable Risk Event. Resolution, when legitimately performed, is auditable and linked to the relevant held Case/event/evidence.

### FR-017 — Audit minimization

Risk/hold audit metadata MUST NOT copy raw sensitive user content.

### FR-018 — RLS

Risk Event data MUST be Family-isolated with ENABLE + FORCE RLS and runtime-role least privilege.

### FR-019 — No second idempotency system

Use the existing idempotency store.

### FR-020 — Concurrency

Concurrent hold/resolve commands against the same revision cannot produce duplicate/contradictory state.

### FR-021 — Stale precheck protection

A precheck decision cannot be applied to a changed Case revision/policy without revalidation.

### FR-022 — AI has no Safety write authority

No AI/system model output can directly enter or resolve Safety.

### FR-023 — No public Safety mutation route

This Slice adds no public EnterSafetyHold/ResolveRisk endpoint.

### FR-024 — No Phase 5 scope

No support_resources, referrals, professional Safety content, operations queue, fake expert service or Guardrails runtime may be introduced.

### FR-025 — Slice 8 compatibility

The Safety guard contract MUST be consumable by Slice 8 without changing Slice 8 Problem Formulation product semantics.

### FR-026 — Digital Use neutrality

No Digital Use-specific device, age, duration, routing or intervention rule is hard-coded into Common Core Safety.

### FR-027 — Transactional integrity

Case state and all required Safety evidence/audit/idempotency writes are atomic.

### FR-028 — Real error state

No blocked/failed Safety operation may return a success state that did not persist.

---

## 18. Acceptance Scenarios

1. Given an OPEN Case and a valid deterministic ENTER_HOLD decision bound to its current revision, when EnterSafetyHold executes, then status becomes SAFETY_HOLD, phase is unchanged, version advances once, and Risk Event + case event + audit + idempotency result all exist.
2. Given a WAITING Case, the same valid hold command may enter SAFETY_HOLD while preserving its phase.
3. Given a LOST_CONTACT Case, a valid deterministic Safety hit may still enter SAFETY_HOLD because Safety overrides ordinary status flow.
4. Given a CLOSED Case, EnterSafetyHold fails and writes nothing.
5. Given a Case already SAFETY_HOLD, an ordinary progression guard denies.
6. Given a held current primary Case, SwitchPrimaryCase cannot switch away from it.
7. Given a target Case in SAFETY_HOLD, SwitchPrimaryCase cannot promote it.
8. Given an authorized evidence/message capture operation on a held Case, Safety guard alone does not create a blanket write ban; the operation remains governed by its existing contract.
9. Given the same EnterSafetyHold idempotency key and same request, replay returns the original result with no extra Case version/event/audit.
10. Given the same key with different canonical request data, the command fails with idempotency conflict.
11. Given two concurrent EnterSafetyHold commands against the same Case revision, at most one transition succeeds; there is no duplicate status advance.
12. Given a precheck decision for Case version N but the Case has changed to N+1 before transition, the stale decision cannot be blindly applied.
13. Given a held Case and an ordinary Family manager with no separately approved Safety-resolution authority, ResolveRisk is denied and the Case stays SAFETY_HOLD.
14. Given a held Case and AI/system principal, ResolveRisk is denied.
15. Given a held Case and missing/invalid review evidence, ResolveRisk is denied.
16. Given a held Case, valid review evidence and a separately verified resolver capability in a controlled domain test, ResolveRisk changes status to WAITING, preserves phase, advances version once and writes the required resolution evidence/event/audit atomically.
17. Given two concurrent legitimate ResolveRisk attempts against the same held revision, at most one succeeds.
18. Given any successful ResolveRisk, no old Plan/Task/Reminder/Schedule is auto-resumed or recreated by this Slice.
19. Given a database failure after any intermediate Safety write, the transaction rolls back completely.
20. Given Risk Event/audit rows, they do not contain copied raw user message/professional review text.
21. Given a different Family context, Risk Event read/write is denied by RLS and does not reveal protected row data.
22. Given the schema after this Slice, no safety_states, support_resources, referrals, AI run, Scene manifest, Goal/Plan/Task table is created by this Slice.
23. Given route enumeration, no public EnterSafetyHold/ResolveRisk route exists.
24. Given static/package inspection, no LLM/RAG/Guardrails/external Safety client is introduced.
25. Given post-PR #25 Digital Use Docs, no Safety Common Core code introduces a universal age gate, excludes computers, or uses total duration to decide Digital Use Problem/Intervention routing.

---

## 19. Acceptance Evidence

| Area | Verification | Required evidence |
|---|---|---|
| Safety state source | schema/static | cases.status remains the single current hold truth; no safety_states table |
| EnterSafetyHold | domain + integration + db | OPEN/WAITING/LOST_CONTACT → SAFETY_HOLD; phase preserved; version/event/audit/risk/idempotency atomic |
| CLOSED protection | integration | CLOSED rejected; zero writes |
| ordinary guard | domain + integration | held Case blocked; stable machine outcome |
| SwitchPrimary compatibility | regression + integration | current/target held both remain blocked; existing semantics not weakened |
| precheck determinism | unit/static | no model/network call; current state + versioned deterministic inputs |
| stale decision | concurrency/integration | changed revision cannot consume stale decision |
| Risk Event | db | Family/Case scoped, traceable, no raw sensitive content, RLS enforced |
| ResolveRisk unique exit | domain/static | no other command/status update path can release SAFETY_HOLD |
| ResolveRisk authority | domain/integration | current Family actors cannot gain release authority implicitly |
| ResolveRisk contract | controlled domain + db | valid verified authority/evidence produces SAFETY_HOLD → WAITING only, phase preserved |
| no auto-resume | integration/static | no Plan/Task/Schedule/Reminder activation by ResolveRisk |
| idempotency | integration/db | replay stable; mismatch conflict; no duplicate events |
| concurrency | db/integration | one winning state transition per revision |
| atomicity | failure injection | no partial Case/Risk/Event/Audit/idempotency state |
| RLS | db | ENABLE/FORCE; app role non-owner/NOBYPASSRLS; cross-family zero visibility/write denied |
| audit minimization | db | no raw high-risk text/review text copied to audit metadata |
| scope | route/schema/package enumeration | no Phase 2/3/5 objects/services/routes introduced |
| Digital Use neutrality | static/contract | no device/age/duration routing semantics in Common Core Safety |
| regression | verify-all / CI | all delivered Slice tests and OpenAPI checks remain green |

A successful controlled-domain ResolveRisk test validates the command semantics only. It MUST NOT be represented as evidence that a real production human Safety operation exists.

---

## 20. DFX

### 20.1 Security

- authorize-first + RLS remains mandatory.
- Runtime role remains non-owner and NOBYPASSRLS.
- No client can choose Safety status directly.
- No AI principal can release Safety.
- No raw sensitive risk content in generic audit metadata.
- Safety failure is fail-closed.

### 20.2 Reliability

- no process-local lock as truth;
- all state commands atomic;
- concurrency and idempotency are mandatory;
- stale precheck rejected/revalidated;
- DB/network/model failure can never be interpreted as “resolved”.

### 20.3 Privacy

- Risk Event stores minimal references/classification/version evidence, not duplicated conversation bodies.
- Cross-Family access is denied.
- Logs/errors do not expose risk content.

### 20.4 Performance

- current-state guard/precheck is synchronous and deterministic;
- no external call is on the Safety guard critical path;
- no numerical latency SLO is invented here.

### 20.5 Maintainability

- one reusable Safety guard, not per-command copy/paste.
- Case status remains single current truth.
- Safety event/error vocabularies are closed/tested.
- future Scene/Goal/Plan commands consume the same contract.
- no hard-coded Digital Use semantics in Common Core.

### 20.6 Observability

This Slice records business audit evidence for Safety transitions but does not build Phase 5 observability/operations dashboards.

---

## 21. Clarifications

### C1 — RESOLVED: “Safety State” does not require a new current-state table

V1技术设计 already defines SAFETY_HOLD as Case Status and §6.6 transitions the Case itself. §27.3 requires a Risk Event, not a second mutable current-state source.

Therefore:

- cases.status is the current hold truth;
- risk_events provides trace/audit evidence;
- no safety_states table is created.

### C2 — RESOLVED: Phase 1 Safety is not Phase 5 Safety Operations

§38 explicitly places Safety State / SAFETY_HOLD invariant / deterministic precheck interface / Domain Command guard in Phase 1, while Phase 5 contains professional Safety content, support resources and operational handling.

Therefore this Slice may and must build the control foundation now without inventing Phase 5 services.

### C3 — RESOLVED: no professional rule catalog is invented

§27.1 requires a deterministic precheck, but current authoritative Docs do not enumerate a complete high-risk keyword/pattern catalog.

Therefore this Slice freezes the deterministic interface/control contract only. Tests may use deterministic contract fixtures. Production may not claim a professional detection rule exists unless an approved/versioned rule asset actually exists.

### C4 — RESOLVED: no current actor is invented as Safety resolver

§6.6 requires “规定复核证据和有权角色”, while current Docs do not designate Family manager/guardian/participant as that resolver role. V1-C35 also forbids fake human service.

Therefore:

- ResolveRisk is the unique exit contract;
- current production authority remains fail-closed;
- no current Family role receives release power;
- a future approved operations/authority Slice may provide the real resolver source without changing ResolveRisk’s core transition semantics.

### C5 — RESOLVED: controlled test authority is not a fake service

A deterministic domain test may supply a verified-authority test capability to prove the ResolveRisk transition contract. That is test evidence for code semantics only.

It MUST NOT create:

- a production staff account;
- a fake expert;
- a fake queue;
- a fake support resource;
- a user-visible claim that human review exists.

### C6 — RESOLVED: Safety Hold is not a blanket data lock

The authoritative contract suppresses ordinary generation/progression/reminders and gives Safety priority. It does not say that evidence needed to understand the risk, Consent, Authorization or data-rights operations become impossible.

Therefore the shared guard targets ordinary progression commands, not every database write.

### C7 — RESOLVED: Slice 8 relationship

Slice 8 does not need to be implemented for this Safety foundation to exist.

The integration rule is directional:

Safety foundation
→ consumed by Slice 8 ordinary phase/formulation mutations
→ consumed by Phase 2 Scene progression

The Slice 8 frozen product semantics are not changed.

### C8 — RESOLVED: PR #25 semantics remain untouched

Common Core Safety must not reintroduce:

- phone-only Digital Use scope;
- a universal six-year Scene gate;
- duration-only A200x routing;
- duration-only Problem/Intervention decisions.

---

## 22. Open Questions

Open Product Decisions: NONE.

Technical implementation questions intentionally left to Plan AI 2 include:

- exact module/file layout;
- exact Risk Event DDL/column names;
- exact event/error machine-code names;
- exact lock order;
- exact Drizzle transaction/query implementation;
- exact representation of a verified Safety-resolution capability;
- exact migration number after rebasing with concurrent Slice 8 work;
- exact test file layout.

None of these may change the frozen product/domain semantics in this Spec.

---

## 23. Deferred Dependencies

Deferred, without changing this Spec:

- production professional deterministic Safety rule catalog/version;
- Scene-specific reviewed Safety rules;
- production user-input caller that invokes precheck/EnterSafetyHold after those rules exist;
- Phase 3 risk_review candidate producer;
- real Safety resolver role/authority source;
- staff assignments/operations workflow if later approved;
- Safety professional content;
- support_resources;
- Referral;
- Operations UI/queue;
- Guardrails;
- notification/task suppression integration when those runtimes exist;
- Slice 8 guard integration if Slice 8 is developed on a separate concurrent branch;
- Phase 2 Scene guard integration;
- Goal/Plan/Task/Review/Follow-up guard integration;
- broader dependency invalidation;
- Compliance feature-policy completion;
- full Drizzle data-layer remediation if Plan AI 2 proves the existing partial baseline cannot support a narrow compliant implementation.

A deferred producer/caller does not authorize a placeholder service or fake product behavior.

---

## 24. Implement Gate

Implementation may begin only after Plan AI 2 and pre-development audit prove all of the following:

1. Implementation base is reverified from current main; no input drift is hidden.
2. No newer authoritative Docs change invalidates this Spec.
3. PR #25 semantics remain authoritative.
4. Slice 8 frozen spec is not modified.
5. No Phase 5 Safety content/operations is pulled into this Slice.
6. No current Family actor is granted Safety-resolution authority by invention.
7. No public Safety mutation endpoint is introduced.
8. The plan identifies the single current-Safety truth and proves no second state source.
9. The plan defines the exact transactional Case/Risk/Event/Audit/Idempotency write set.
10. The plan defines idempotency and concurrency verification.
11. The plan defines RLS and least-privilege verification for Risk Event persistence.
12. The plan defines how SwitchPrimaryCase consumes/preserves the common Safety guard semantics.
13. The plan proves deterministic precheck has no model/network dependency.
14. The plan includes stale-decision/revision protection.
15. The plan proves no raw sensitive content enters generic audit/log metadata.
16. The plan addresses V1技术设计 §7.0 Drizzle compliance for all Slice 9-owned persistence.
17. If Slice 8 has merged, the plan rebases and wires its ordinary commands to the Safety guard without rewriting Slice 8 product semantics.
18. If Slice 8 is still unmerged, the plan defines a mechanically verifiable downstream integration contract and does not copy Slice 8 runtime into this branch.
19. CI/Spec Governance constraints are preserved.
20. No production code is written until the independent pre-development audit passes.

If §7.0 Drizzle compliance cannot be achieved narrowly, implementation status becomes BLOCKED pending a separate data-access remediation. The Spec itself remains frozen.

---

## 25. Success Criteria

This Slice is successful only when all are true:

- SAFETY_HOLD is enforced through a real domain control, not merely represented by an enum.
- deterministic precheck interface exists and is model/network independent.
- EnterSafetyHold performs a real atomic state transition.
- every successful hold entry is traceable through Risk Event + Case event + business audit.
- ordinary progression is centrally blocked while held.
- SwitchPrimaryCase cannot bypass a hold.
- no second current Safety truth exists.
- ResolveRisk is the only legal exit contract.
- current Family actors cannot release a hold without a separately approved authority.
- a legitimately authorized ResolveRisk contract produces WAITING, preserves phase and does not auto-resume old work.
- idempotency/concurrency/rollback tests prove no duplicate/partial Safety result.
- RLS and least privilege protect Risk Event data.
- audit/logging do not duplicate raw sensitive content.
- no fake expert/support/referral/human service exists.
- no AI/Scene/Goal/Plan scope is introduced.
- PR #25 Digital Use semantics remain unchanged.
- delivered Slice regression and CI remain green.

---

## Parallel Development Decision

Slice 8 + Slice 9 parallel development: PARTIALLY.

Semantic dependency:

- Slice 9 does NOT require Slice 8 runtime.
- Slice 8’s future runtime DOES require the Safety guard for its ordinary progression mutations.

Therefore:

- independent spec/plan work: fully parallel;
- Safety domain/state/Risk Event implementation: can proceed in parallel;
- Slice 8 Problem Formulation implementation: can proceed in parallel against the frozen Safety guard contract once available;
- final shared-file/migration integration and combined regression: must be rebased/verified after the first branch lands.

Potential physical conflicts such as migration numbering, authorize vocabulary, cases grants, case_events/business_audit_events constraints or shared error contracts are implementation coordination issues, not product dependencies.

---

## Frozen Spec Gate

Authority Gate: PASS  
Phase Completion Gate: COMPLETE AS AN AUDIT RESULT — Phase 1 is NOT COMPLETE  
Selection: PASS  
Specify: COMPLETE  
Clarify: COMPLETE  
Open Product Decisions: NONE  
Residual Product Blockers: NONE  
Traceability: COMPLETE  
Acceptance: MECHANICALLY VERIFIABLE  

Design Status: FROZEN

Implementation handoff status: READY FOR PLAN AI 2, subject to the Implement Gate above.

FINAL: SLICE 9 — FROZEN SPEC READY
