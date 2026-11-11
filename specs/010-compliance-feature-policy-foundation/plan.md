# Slice 10 Implementation Plan — 010-compliance-feature-policy-foundation

Status: **PLAN AI 2 COMPLETE / AUDIT 1 REMEDIATED / FINAL PRE-DEVELOPMENT RE-AUDIT PENDING**

This file is planning only. It does not authorize implementation, does not modify the Frozen Spec, and does not open the Slice 10 Implement Gate.

## Upstream Traceability

### Authoritative sources

- `Docs/总产品需求.md`
- `Docs/V1产品需求.md` — final V1 product semantics authority
- `Docs/总体技术架构.md`
- `Docs/V1技术设计.md` — final V1 implementation architecture authority
- Frozen Slice 10 Spec:
  - branch: `spec/010-compliance-feature-policy-foundation`
  - commit: `20b6eaecf7a1ac24904409f805042759631f5cf0`
  - blob: `a911bcc0c168e00efa015d53d5c120bece28c5a7`

### Canonical requirements

Primary requirement namespace:

- V1-C38 — AI identity / generated-content disclosure baseline
- V1-C39 — server-owned age/minor/guardian/guardian-consent facts
- V1-C43 — feature-level anthropomorphic applicability and downstream continuous-use obligations
- V1-C20 / V1-C21 — authorization, family/person/consent isolation
- V1-C25 / V1-C26 — Safety remains an independent blocking control
- V1-C27 / V1-C28 — failures and concurrency must remain truthful
- V1-C30 — Common Core must not be Digital Use hard-coded

Frozen Slice requirements:

- FR-001..FR-030
- Acceptance Scenarios 1..16

Implementation-only authority:

- V1 Technical Design §7.0 — Drizzle / migration contract
- §7.7A — Compliance data
- §9 / §9.1 — `authorize()` + RLS
- §27B — `evaluateCompliance`
- §32.5A — Compliance regression
- §38 — Phase 1 order
- §39 — requirement mapping

### Requirement-to-plan map

| Requirement | Plan contract |
|---|---|
| FR-001 | §5 single `compliance_feature_policies` truth |
| FR-002..003 | §4 server-owned feature identity + contract revision |
| FR-004 | §5.3 immutable policy judgment / version lifecycle |
| FR-005..010 | §5.2, §6 policy selection / fail-closed |
| FR-011..015 | §7 existing Compliance Profile / guardian consent composition |
| FR-016..019 | §6.4 obligations and unresolved-policy blocking |
| FR-020..021 | §6 deterministic evaluator + provenance |
| FR-022 | §8 independent gate precedence |
| FR-023 | §4.3 Common Core / Scene boundary |
| FR-024..027 | §3 scope guards / §9 no public API |
| FR-028 | §10 Slice 9 Drizzle dependency |
| FR-029 | §9.3 least privilege |
| FR-030 | §6.5 / §11 failure semantics |

## Summary

Slice 10 establishes only the Phase 1 **Feature Compliance Policy Foundation**:

1. a stable server-owned feature identity contract;
2. one versioned feature-policy truth in PostgreSQL;
3. exact effective-version selection with missing/UNKNOWN/ambiguous fail-closed behavior;
4. a deterministic, model-free evaluator that composes the existing age/minor/guardian-consent truth;
5. explicit obligation results and policy provenance;
6. least-privilege, no-public-mutation policy access;
7. mechanically testable concurrency, migration, privacy and regression contracts.

Slice 10 does **not** implement continuous-use sessions/timers, reminder dispatch, generated-content artifact persistence/export, Digital Use runtime, A4003 runtime, PIPIA/regulatory workflows, Safety, or a compliance operations/admin product.

## Technical Baseline

### Verified repository baseline at planning time

Remote truth was re-read because this environment cannot execute local `git` commands.

- current `main`: `8e393c990be53c888c2e68d881bd8b23f9c37638`
- Frozen Spec commit is one commit ahead / zero behind current main.
- Frozen Spec commit changes only `specs/010-compliance-feature-policy-foundation/spec.md`.
- Input Drift: **NONE**.
- Slice 8 implementation exists on `feat/008-problem-formulation-core` / PR #26 but is not in main.
- Slice 9 remains on `plan/009-safety-hold-control-foundation`, ahead of main with planning artifacts only; no Slice 9 implementation is on main.
- Therefore Slice 10 Implement Gate remains **BLOCKED** by the Slice 9 Drizzle dependency.

### Current compliance truth already present

Current main already contains:

- `packages/compliance`;
- `person_compliance_profiles`;
- existing age values:
  - `ADULT`
  - `MINOR_14_17`
  - `UNDER_14`
  - `UNKNOWN`;
- existing `guardian_person_id`;
- existing guardian-consent chain and evidence validation;
- existing pure `assertMinorProcessingAllowed(...)`;
- existing `authorize()`;
- existing Family RLS context and `withRlsTransaction(...)`.

Important semantic note:

- **GUARDIAN is not an age-band value.**
- A guardian is an adult Person related to the target minor through the existing `guardian_person_id` fact.
- Slice 10 must not invent a second `GUARDIAN` age state.

### Current data-access gap

Current main has:

- `drizzle-orm` declared in the API workspace;
- `db/drizzle.config.ts`;
- no authoritative `db/schema` implementation yet;
- no locked `drizzle-kit` implementation path;
- raw node-postgres transaction helpers.

Slice 9 planning owns the narrow Drizzle §7.0 foundation. Slice 10 may consume it only after it is actually merged or a separate Data Access Remediation closes that blocker.

## Constitution Check

| Rule | Status | Planning decision |
|---|---|---|
| authority documents remain unchanged | PASS | no Docs edits allowed |
| Frozen Spec remains downstream authority for this Slice | PASS | no Spec rewrite |
| Phase 1 scope is preserved | PASS | no Phase 2–5 runtime |
| one truth source per business fact | PASS | feature policy only in `compliance_feature_policies`; person/consent reused |
| deterministic gate before AI | PASS | evaluator is pure/model-free |
| Authorization / Safety / Compliance stay independent | PASS | §8 |
| UNKNOWN is explicit and fail-closed | PASS | §6 |
| RLS remains a hard family-data boundary | PASS | policy is global; person/consent reads remain existing RLS |
| version/history/provenance are preserved | PASS | §5 / §12 |
| failures are not converted to success | PASS | §11 |
| concurrency/idempotency are explicit | PASS | §13 |
| verification is mechanical | PASS | §15 |
| no fake external capability | PASS | no fake reviewer, policy conclusion, notification, filing or legal workflow |
| no second workflow/state engine | PASS | no new RBAC, Safety state, consent state, timer state |
| Drizzle architecture is not bypassed | PASS / IMPLEMENT-BLOCKED | §10 consumes Slice 9 or stops |

**Constitution Check: PASS for planning.**

This does not change the Future Implement Gate.

## Design

## 1. Scope contract

### 1.1 In scope

- feature identity;
- feature contract revision;
- policy identity/version/effective period;
- REQUIRED / NOT_APPLICABLE / UNKNOWN applicability;
- feature-level rules for minor access, AI disclosure, generated-content label, usage reminder;
- review basis/evidence reference;
- deterministic policy selection/evaluation;
- existing profile/guardian-consent composition;
- provenance;
- controlled publication representation;
- least-privilege persistence;
- concurrency / stale-selection safety;
- tests and static governance.

### 1.2 Explicitly out of scope

No Slice 10 implementation may create:

- interaction/usage sessions;
- cross-device timer state;
- two-hour counters;
- reminder dispatch or notification jobs;
- `generated_content_labels` runtime;
- export/watermark/metadata pipeline;
- PIPIA workflow;
- regulatory filing/release workflow;
- Digital Use scene runtime or node routing;
- A4003 roleplay/session/persona runtime;
- AI/model/RAG/prompt decisions;
- Safety state/risk events/EnterSafetyHold/ResolveRisk;
- new guardian relationship or consent model;
- public policy browse/admin/mutation endpoints;
- compliance officer/reviewer accounts or fake Human Ops.

## 2. Architectural split

Slice 10 is split into four layers:

1. **Feature identity contract** — server-owned descriptor, not client input.
2. **Policy persistence/query** — PostgreSQL truth, typed through the authoritative Drizzle seam.
3. **Snapshot loader** — reads exact effective policy plus existing Person/consent facts inside caller transaction / controlled read transaction.
4. **Pure evaluator** — deterministic transformation from a validated snapshot to a compliance gate result.

The pure evaluator never:

- opens a transaction;
- calls a model/network;
- reads request/client feature strings;
- writes audit rows;
- calls a notification/timer/export service.

## 3. Common Core boundary

Common Core owns generic policy semantics only.

A consuming Scene or server capability may provide a canonical descriptor, but Common Core must not contain logic such as:

`if feature === DIGITAL_USE_ROLEPLAY_A4003 ...`

No production Slice 10 seed may fabricate an A4003 applicability decision merely to make tests pass. Tests use fixture-only generic feature identities.

## 4. Feature Identity contract

### 4.1 Stable identity

A canonical feature identity is:

`{ featureCode, featureContractRevision }`

Semantics:

- `featureCode` identifies a logical server capability and is stable across UI/page changes.
- `featureContractRevision` changes when the capability semantics change enough that prior compliance applicability cannot safely be assumed.
- `policyVersion` is separate and versions the Compliance Policy decision itself.

### 4.2 Server ownership

The compliance package must expose a server-only descriptor/registry mechanism, conceptually:

`ComplianceFeatureDescriptor`

A client/request contract does **not** receive arbitrary `featureCode` as authority.

Application/Scene code maps a server command/capability to a descriptor constant, then passes that resolved descriptor to the compliance service.

A raw request value such as a page name, route name, prompt value, node ID or arbitrary string cannot create a descriptor at the request boundary.

### 4.3 Scene registration

Future Scene packages may register/map their own descriptor constants.

The Common Core registry validates identity shape and uniqueness but does not own Scene-specific behavioral branches.

Tests must prove:

- same code cannot be registered with two conflicting current revisions in one registry snapshot;
- unknown/unregistered client strings cannot be evaluated as canonical features;
- a descriptor revision mismatch fails closed rather than falling back to a policy for another revision.

## 5. Policy truth model

### 5.1 Table

The future migration adds one policy-truth table:

`compliance_feature_policies`

Planned logical columns:

| Column | Contract |
|---|---|
| `id` | uuid PK, PostgreSQL `uuidv7()` |
| `feature_code` | stable canonical feature code |
| `feature_contract_revision` | server-owned semantic revision |
| `policy_version` | positive monotonic integer within exact feature identity/revision |
| `anthropomorphic_applicability` | REQUIRED / NOT_APPLICABLE / UNKNOWN only |
| `minor_access_rule` | BASELINE / MINORS_BLOCKED |
| `ai_disclosure_rule` | BASELINE / REQUIRED |
| `generated_content_label_rule` | BASELINE / REQUIRED |
| `usage_reminder_rule` | BASELINE / REQUIRED |
| `decision_basis` | bounded, non-sensitive review rationale |
| `review_evidence_ref` | opaque reference; never raw child/family content |
| `effective_from` | inclusive server time |
| `effective_until` | nullable exclusive end; null means open-ended |
| `superseded_by_policy_id` | nullable self-reference |
| `created_at` | server timestamp |
| `approved_at` | reviewed publication timestamp |
| `publication_source_ref` | checked-in migration/provisioning provenance |

Exact SQL names may be reconciled at implementation only if they preserve these semantics.

### 5.2 Applicability

Exact values are frozen:

- REQUIRED
- NOT_APPLICABLE
- UNKNOWN

No NULL/default value may mean NOT_APPLICABLE.

REQUIRED and NOT_APPLICABLE require non-empty `decision_basis` and `review_evidence_ref`.

UNKNOWN remains a real row only when an unresolved reviewed state must be represented; it still fails closed.

### 5.3 Version immutability

Published policy judgment is immutable.

Runtime role has no INSERT/UPDATE/DELETE.

Controlled publication may change only lifecycle closure metadata of the immediately superseded row:

- `effective_until`
- `superseded_by_policy_id`

It may not rewrite:

- feature identity/revision;
- policy version;
- applicability;
- rules;
- decision basis;
- review evidence;
- approval provenance.

A new judgment always requires a new row / policy version.

### 5.4 Rule semantics

`BASELINE` means:

> this feature policy adds no stricter feature-level requirement for this dimension.

It **never** means “disable an upstream/global requirement”.

Therefore a feature policy cannot use BASELINE to downgrade V1-C38 or any other already-applicable upstream gate.

Cross-field coherence is mandatory:

If `anthropomorphic_applicability = REQUIRED`:

- `ai_disclosure_rule` must be REQUIRED;
- `usage_reminder_rule` must be REQUIRED;
- minor users still require server-side minor mode through the existing profile baseline;
- generated-content labeling remains independently governed by content type / policy and is not silently inferred away.

If `anthropomorphic_applicability = NOT_APPLICABLE`:

- `usage_reminder_rule` must be BASELINE because that rule is the anthropomorphic continuous-use obligation in this Slice;
- the evaluator must not emit REQUIRE_USAGE_REMINDER solely from the anthropomorphic contract;
- `ai_disclosure_rule` and `generated_content_label_rule` may still be REQUIRED when an independently applicable upstream/content rule requires them;
- NOT_APPLICABLE never means “disable global AI disclosure/label requirements”.

If `anthropomorphic_applicability = UNKNOWN`:

- release is blocked regardless of the remaining feature-rule fields;
- the result includes REQUIRE_REGULATORY_EVIDENCE/equivalent unresolved-review obligation;
- other stored rule values cannot turn UNKNOWN into ALLOW.

### 5.5 Effective-period invariant

An exact feature identity + evaluation time may resolve to:

- zero active policies → fail closed;
- exactly one active policy → evaluate it;
- more than one active policy → fail closed as data integrity ambiguity.

Active means:

`effective_from <= evaluationTime < effective_until`

with null `effective_until` treated as infinity.

Future DDL must prevent ordinary controlled publication from creating overlaps. The enforcement mechanism is frozen as follows:

1. a PostgreSQL BEFORE INSERT / BEFORE UPDATE-of-effective-period trigger obtains `pg_advisory_xact_lock(hashtextextended(feature_code || separator || feature_contract_revision, 0))` for the exact feature identity;
2. after the lock, the trigger queries existing rows for the same feature/revision and rejects any interval intersection using the half-open `[effective_from, effective_until)` rule, excluding the row being lifecycle-closed;
3. the controlled publication transaction explicitly takes the same per-feature advisory lock before it locks/rechecks the current open row;
4. it validates the next monotonic policy version and effective start;
5. it changes only the current row’s `effective_until` / `superseded_by_policy_id` lifecycle metadata and inserts the new immutable judgment in the same transaction;
6. the trigger makes the overlap rule defensive even if a future internal provisioning path forgets its application-side precheck;
7. evaluator still queries defensively for multiple candidates and fails closed if corrupted data somehow exists.

This design needs no `btree_gist` or other new extension solely for Slice 10.

## 6. Deterministic evaluator

### 6.1 Two-stage contract

Stage A — load a validated snapshot:

`loadComplianceEvaluationSnapshot(tx, authorizedContext, canonicalFeature, evaluationTime)`

Stage B — pure decision:

`evaluateCompliance(snapshot)`

The pure function has no I/O.

### 6.2 Evaluation time

- Production evaluation time comes from trusted server/database time, captured once.
- Tests inject a fixed evaluation time.
- The pure evaluator does not call `Date.now()`.

### 6.3 Policy selection

The snapshot loader:

1. accepts only a resolved server feature descriptor;
2. queries exact `feature_code + feature_contract_revision`;
3. applies the captured evaluation time;
4. returns zero/one/multiple candidate classification without “latest wins” fallback;
5. validates the row against typed policy schema;
6. loads existing Person/compliance/consent facts as required.

### 6.4 Result shape

The internal result is conceptually:

`ComplianceEvaluationResult`

with:

- `gate: ALLOW | BLOCK`;
- `obligations: ComplianceObligation[]`;
- `reasonCode` when blocked;
- `featureCode`;
- `featureContractRevision`;
- `policyId`;
- `policyVersion`;
- `applicability`;
- `evaluatedAt`;
- effective-period identity.

The internal service also exposes a pure consumer-boundary guard conceptually named `assertComplianceObligationsSupported(result, supportedObligations)`. The supported-obligation set is server-owned consumer configuration, never client input. If the evaluator returns a required obligation that the current consumer cannot actually satisfy, the guard fails closed with `COMPLIANCE_CAPABILITY_UNAVAILABLE` before downstream execution/release.

Slice 10 policy fields currently originate guardian/minor, AI-disclosure, generated-label, usage-reminder and unresolved-review obligations. `REQUIRE_SEPARATE_CONSENT` remains part of the approved architecture vocabulary but is not fabricated by Slice 10 when no approved feature-policy field/source requires it.

Allowed obligations come from the approved architecture vocabulary:

- REQUIRE_GUARDIAN_CONSENT
- REQUIRE_SEPARATE_CONSENT
- REQUIRE_MINOR_MODE
- REQUIRE_AI_DISCLOSURE
- REQUIRE_GENERATED_CONTENT_LABEL
- REQUIRE_USAGE_REMINDER
- REQUIRE_REGULATORY_EVIDENCE

No new product obligation is invented by Slice 10.

### 6.5 Fail-closed algorithm

Order inside the compliance decision:

1. invalid/unresolved canonical feature → BLOCK/error;
2. no effective policy → BLOCK;
3. multiple effective policies → BLOCK;
4. malformed/invalid policy row → BLOCK;
5. applicability UNKNOWN → BLOCK + REQUIRE_REGULATORY_EVIDENCE;
6. load/validate existing person profile if person processing is required;
7. missing profile / age UNKNOWN → BLOCK;
8. apply existing `assertMinorProcessingAllowed` semantics;
9. UNDER_14 missing/revoked/invalid guardian consent → BLOCK + REQUIRE_GUARDIAN_CONSENT;
10. MINOR_14_17 is not assigned the UNDER_14 consent rule merely because of age;
11. apply stricter `MINORS_BLOCKED` if configured;
12. add required policy obligations;
13. return ALLOW only if no blocking condition remains.

Infrastructure/database failures are **not** step 1–13 business results. They propagate as infrastructure/internal failures and are never translated to an ordinary `BLOCK` or `ALLOW`.

## 7. Existing Compliance Profile / guardian consent composition

Slice 10 reuses:

- `person_compliance_profiles`;
- `guardian_person_id`;
- `guardian_consent_record_id/version`;
- existing consent chain/evidence validation;
- existing `assertMinorProcessingAllowed`.

It does not create:

- `age_band_2`;
- guardian-role tables;
- duplicate minor-mode columns;
- a policy-local consent boolean;
- a duplicate consent ledger.

A guardian test fixture must model:

- target minor has `guardian_person_id = adultPersonId`;
- the guardian is represented by the existing adult Person / consent facts.

It must not introduce `age_band = GUARDIAN`.

## 8. Authorization / Safety / business precedence

### 8.1 General rule

Compliance does not authorize access.

The caller must first resolve and authorize actor / target Family / target Person using existing `authorize()` and existing anti-enumeration semantics.

### 8.2 Read-only policy evaluation

For a policy-only internal evaluation with no progression side effect:

`Authentication/Authorization/Consent context → Compliance evaluation`

Safety is not a prerequisite to *reading/evaluating* the compliance decision itself; evaluating Compliance must remain possible while a Case is held.

### 8.3 Ordinary progression / response release

For an ordinary Case/AI/business progression that already uses the Slice 9 guard:

`Authentication → Authorization/Consent → existing Safety guard → Compliance → business/domain preconditions → downstream execution/release`

Rationale:

- Safety is preemptive and must stop ordinary progression.
- Compliance is independently mandatory before the effect/release.
- an ALLOW from either gate cannot override the other.
- existing command-specific error precedence remains authoritative; Slice 10 does not rewrite it.

For existing response-generation/release flows, the architecture’s Safety-before-Compliance release validation ordering is preserved.

### 8.4 Onboarding / identity paths

Where an existing UNDER_14 identity/onboarding gate already checks guardian/consent before a later feature use, Slice 10 does not reorder or duplicate that gate.

A later feature evaluation still reuses current facts at its own decision point.

## 9. Authorization, API and privacy

### 9.1 No public policy API

Slice 10 adds no:

- GET policy catalog endpoint;
- policy lookup endpoint;
- POST/PUT/PATCH policy mutation endpoint;
- admin/compliance-review API.

OpenAPI should remain unchanged unless implementation needs a purely internal type not represented in OpenAPI.

### 9.2 Policy publication

Current Slice 10 publication mechanism is:

> reviewed migration / checked-in internal provisioning during deployment, with explicit policy provenance.

There is no runtime end-user publication command.

No fake staff identity or compliance-review workflow is created.

### 9.3 Grants

`compliance_feature_policies` is global server-owned policy truth, not Family-owned user data.

Planned DB privilege contract:

- owner: migrator;
- runtime: SELECT only;
- runtime: no INSERT / UPDATE / DELETE / TRUNCATE;
- no public role grant;
- no client route exposes table browsing.

Because the table contains no tenant/family data, Family RLS is **not** used as a fake tenant boundary for this global table.

The RLS requirement applies to the existing Person/consent facts consumed during evaluation; those reads remain inside the existing Family/identity RLS transaction and must not be weakened.

Database tests must mechanically verify both facts:

1. global policy table has least-privilege SELECT-only runtime access;
2. target Person/consent reads still require valid existing RLS context and cannot cross Family boundaries.

### 9.4 Anti-enumeration

No compliance error detail may allow an unauthorized caller to infer:

- Person existence;
- age band;
- guardian presence;
- consent state;
- another Family;
- policy evidence content.

The business endpoint’s existing not-found/unauthorized generic behavior wins before compliance-detail mapping.

Internal structured reason codes may be logged/tested only within authorized server boundaries.

## 10. Drizzle / Data Access Gate

### 10.1 Planning dependency

Slice 10 has no semantic dependency on Slice 9, but it has a technical data-access dependency.

**Implement Gate: BLOCKED at planning time.**

### 10.2 Required development-start behavior

Future T1001 must re-read latest main.

If Slice 9 Drizzle foundation is merged and proves:

- real `db/schema`;
- locked compatible drizzle-orm/drizzle-kit;
- same-client Drizzle transaction path;
- identity consistency assertion;
- Family RLS context;
- query-builder writes/typed reads;
- reviewed SQL migrations remain production truth;

then Slice 10 consumes that exact foundation.

If it is absent:

`STOP — IMPLEMENT GATE BLOCKED`

If Slice 9 proves narrow Drizzle cannot safely exist:

`STOP — SEPARATE DATA ACCESS REMEDIATION REQUIRED`

No Development AI may:

- build a second Drizzle transaction abstraction;
- fall back to raw-pg-only Slice 10 architecture;
- create a second schema truth;
- use `drizzle-kit push`.

### 10.3 Slice 10 transaction use

The evaluator must use the caller’s existing authoritative transaction where part of a business command.

New Slice 10 feature-policy reads/writes must use the verified Slice 9 Drizzle path. Existing canonical Compliance Profile / consent repository helpers may be reused only through the same checked-out client / transaction while their owning slice remains authoritative; Slice 10 does not perform a broad unrelated repository rewrite and does not add new raw-pg-only policy access.

For standalone internal evaluation, it may use the same shared Drizzle/RLS transaction seam in read mode.

No nested transaction and no second checked-out client.

Where a consistent multi-read snapshot is required, use the shared transaction seam with a supported repeatable-read snapshot rather than inventing a new transaction manager.

## 11. Error semantics

Internal machine semantics must distinguish:

| Condition | Required meaning |
|---|---|
| unknown/unregistered feature | COMPLIANCE_FEATURE_UNKNOWN |
| stale/wrong feature revision | COMPLIANCE_FEATURE_REVISION_STALE |
| no policy row or only future rows for evaluation time | COMPLIANCE_POLICY_MISSING |
| policy history exists but all matching rows are expired at evaluation time | COMPLIANCE_POLICY_EXPIRED |
| more than one effective policy | COMPLIANCE_POLICY_AMBIGUOUS |
| malformed/invalid policy version | COMPLIANCE_POLICY_INVALID |
| applicability UNKNOWN | COMPLIANCE_APPLICABILITY_UNKNOWN |
| profile missing | COMPLIANCE_PROFILE_MISSING |
| age UNKNOWN | COMPLIANCE_AGE_UNKNOWN |
| guardian consent missing | COMPLIANCE_GUARDIAN_CONSENT_REQUIRED |
| guardian consent revoked/invalid | COMPLIANCE_GUARDIAN_CONSENT_INVALID |
| stricter feature access block | COMPLIANCE_FEATURE_BLOCKED |
| required downstream capability unavailable | COMPLIANCE_CAPABILITY_UNAVAILABLE |
| stale controlled publication revision | COMPLIANCE_POLICY_STALE |
| unauthorized/cross-family target | existing authorization / anti-enumeration semantic |
| idempotency mismatch | existing semantic only if a future internal command exists |
| database/transaction/infrastructure failure | existing INTERNAL/infrastructure propagation; never converted to compliance denial |

Exact HTTP mapping is owned by the consuming business endpoint because Slice 10 introduces no public compliance endpoint.

## 12. Auditability / traceability

### 12.1 Policy definition history

The version rows plus:

- decision basis;
- review evidence ref;
- approved_at;
- publication source ref;
- effective period;
- supersession link;

are the policy history.

### 12.2 Runtime evaluation

A successful or fail-closed deterministic evaluation returns provenance.

Slice 10 does **not** write a new database audit row for every evaluation.

### 12.3 Business audit

A downstream command that creates a real business effect must be able to persist:

- feature identity;
- feature contract revision;
- policy ID/version;
- evaluation time or equivalent decision provenance.

It must not copy:

- family dialogue;
- raw child content;
- consent evidence payload;
- review-evidence document content.

### 12.4 Operational logging

Operational logs may include bounded IDs/version/result/error class.

They must not log sensitive raw Person/guardian/consent material merely because the evaluator inspected it.

## 13. Idempotency and concurrency

### 13.1 Evaluation

Evaluation is read-only and deterministic.

It has no idempotency key and creates no second idempotency system.

Same validated snapshot + evaluation time must produce the same logical result.

### 13.2 Publication

Slice 10 has no runtime publication command.

Reviewed migrations/provisioning are serialized by the existing migration process.

Therefore the existing `idempotency_keys` store is **not** extended solely for Slice 10 publication.

If a future runtime internal publisher is approved later, it must reuse existing idempotency/audit infrastructure and the per-feature serialization contract.

### 13.3 Concurrent publication invariant

Controlled publication uses exact feature-identity serialization and overlap checks.

Invariant:

> For one `feature_code + feature_contract_revision + evaluation_time`, storage must not intentionally publish two authoritative effective versions.

Defensive evaluator behavior remains fail closed even if storage is corrupt.

### 13.4 Evaluation vs supersession

The captured transaction/snapshot determines the exact policy used.

Result provenance records that version.

A later concurrent policy publication does not mutate the already-returned result.

A downstream long-running consumer spanning transactions must recheck before release/commit according to its own Slice; Slice 10 does not implement that runtime.

### 13.5 Evaluation vs profile/consent change

When Compliance is a gate for a side-effecting command, snapshot loading runs inside that command’s existing transaction after authorization and before the effect.

The caller must use its existing lock/re-read discipline for mutable Person/consent facts; Slice 10 does not add a second lock order.

Standalone read-only evaluation uses a consistent snapshot but authorizes no subsequent side effect.

## 14. Migration plan

The implementation migration number is **provisional only**.

At T1001, Development AI must:

1. fetch latest main;
2. list all migrations;
3. account for merged Slice 8/9 migrations;
4. choose the next non-conflicting number;
5. re-read shared enums/CHECKs/grants before editing.

The reviewed migration must add:

- `compliance_feature_policies`;
- exact CHECKs for applicability and rule vocabularies;
- version uniqueness;
- effective-period validity;
- supersession referential integrity;
- overlap/publication protection;
- indexes for exact feature/revision/effective-time lookup;
- migrator ownership;
- runtime SELECT-only grant;
- no unrelated destructive DDL.

No production policy decision is seeded unless an already-approved feature-specific review record actually exists at implementation time.

Test fixtures may insert synthetic policies only in test databases.

Migration verification must cover:

- fresh DB;
- upgrade DB;
- migration replay / second apply;
- rollback on failed migration;
- exact schema / constraints / indexes / grants;
- no unrelated object deletion;
- Drizzle projection parity.

## 15. Static and architecture guards

Future implementation should add/extend mechanical guards for:

- no public policy route;
- no client schema that grants arbitrary feature-code authority;
- no scene-specific A4003/Digital Use branch inside Common Core compliance evaluator;
- no `safety_states` or duplicate compliance-profile/guardian tables;
- no timer/session/notification/PIPIA/regulatory workflow artifacts in the Slice 10 diff;
- no raw-pg-only new Slice 10 data path after the Drizzle dependency is satisfied.

Guards must be narrow enough not to forbid legitimate later Scene-owned registration.

## 16. OpenAPI / contracts

Because Slice 10 exposes no public endpoint, no new public OpenAPI operation is expected.

If implementation changes generated/public OpenAPI without a separately approved consumer contract, that is scope drift and must stop.

Internal TypeScript schemas/types live in the compliance/domain/server packages as appropriate; they are not client-controlled policy inputs.

## 17. Project Structure

Expected future implementation areas, subject to T1001 reconciliation:

```text
packages/compliance/src/
  feature-identity.ts            # server-owned feature descriptor/registry
  feature-policy.ts              # policy types + pure evaluator
  feature-policy-repository.ts   # Drizzle reads / snapshot loader
  index.ts                       # approved internal exports

db/schema/
  ...                            # exact projection from Slice 9 foundation

db/migrations/
  <reconciled>_compliance_feature_policy_foundation.sql

apps/server/api/src/
  ...                            # only internal composition if needed; no public policy route

tests/domain/
  ...feature-policy...

tests/integration/
  ...compliance-feature-policy...

tests/db/
  ...feature-policy schema / migration / RLS-grant...

scripts/
  guard-static.mjs               # only if a narrow static guard is required
  db-evidence.mjs                # update exact expected schema only if current canonical harness requires it
```

No new `apps/operations`, notification package, AI runtime, Scene package, or policy-admin service is created by Slice 10.

## Verification Plan

### 18.1 Domain matrix

Mechanically test:

- applicability REQUIRED;
- NOT_APPLICABLE;
- UNKNOWN;
- missing policy;
- future policy;
- expired policy;
- two overlapping/effective policies;
- policy revision mismatch;
- malformed policy;
- same snapshot deterministic result.

### 18.2 Age / minor matrix

Use the real current model:

- ADULT;
- MINOR_14_17;
- UNDER_14;
- UNKNOWN;
- guardian represented as an ADULT Person referenced by the target’s existing `guardian_person_id`.

Do not create a GUARDIAN age enum.

### 18.3 Guardian consent

Cover the current consent truth:

- valid;
- missing;
- revoked;
- subject mismatch;
- guardian mismatch;
- current notice mismatch;
- malformed/invalid evidence.

If latest main later introduces explicit consent expiry, T1001 must add that case. Do not invent expiry in planning against a model that lacks it.

### 18.4 Server enforcement

Prove:

- raw client feature string cannot select policy;
- client cannot override policy version/applicability/rules;
- UNKNOWN is not NOT_APPLICABLE;
- missing is not NOT_APPLICABLE;
- ambiguous does not pick one;
- REQUIRED emits configured obligations;
- evaluator makes no model/network calls;
- policy-specific stricter access cannot weaken baseline age/consent checks.

### 18.5 Authorization / RLS / privacy

Prove:

- unauthorized/cross-family caller cannot use evaluator to inspect another Person;
- Person/profile/consent reads remain under existing RLS;
- policy table being global does not bypass target Person authorization;
- policy review evidence is not exposed to clients;
- candidate/unauthorized response differences do not reveal age/guardian/consent;
- infrastructure failures propagate, not become ordinary BLOCK/ALLOW.

### 18.6 Concurrency

Prove:

- controlled concurrent publication cannot publish overlapping active periods;
- evaluator fails closed on injected overlap/corruption;
- evaluation snapshot returns exactly the policy it read;
- policy supersession after snapshot does not mutate provenance;
- command-integrated evaluation does not mix policy/profile snapshots;
- stale publication revision is rejected if controlled publication helper exists.

### 18.7 Database

Required evidence:

- fresh migration;
- upgrade migration;
- second apply;
- failure rollback;
- exact columns/types/nullability/defaults;
- exact CHECKs/FKs/indexes;
- runtime SELECT allowed;
- runtime INSERT/UPDATE/DELETE/TRUNCATE denied;
- migrator ownership;
- Drizzle typed projection parity;
- no unrelated destructive DDL.

### 18.8 Regression

At development closeout, run the real current commands from latest main, at minimum:

```bash
bun run typecheck
bun run test -- --run
bun run guard:static
bun run openapi:check
bun run db:evidence -- --no-archive
node .specify/scripts/validate-governance.mjs
node .specify/scripts/tests/run-governance-tests.mjs
```

If repository command syntax has changed at T1001, use the current canonical equivalent and record exact output.

Regression must include:

- Slice 1–7 current main;
- Slice 8 if merged;
- Slice 9 if merged;
- combined migration/RLS/shared-vocabulary tests.

### 18.9 Acceptance mapping

| Frozen scenario | Required evidence |
|---|---|
| 1 | NOT_APPLICABLE domain/integration test with exact provenance |
| 2 | REQUIRED obligations test |
| 3 | UNKNOWN fail-closed test |
| 4 | missing policy test |
| 5 | overlap ambiguity test |
| 6 | raw client feature spoof test/static guard |
| 7 | age UNKNOWN block |
| 8 | UNDER_14 missing/revoked/invalid consent |
| 9 | MINOR_14_17 no automatic UNDER_14 consent |
| 10 | generic MINORS_BLOCKED fixture |
| 11 | disclosure/label obligation test |
| 12 | usage-reminder obligation test with no timer artifacts |
| 13 | independent Safety/Authorization gate integration/static proof |
| 14 | supersession/version-history test |
| 15 | provenance capture contract test |
| 16 | exact diff/static scope guard |

## Rollback / Recovery

Implementation rollback must never erase historical policy meaning.

If a Slice 10 deployment fails before merge/release:

- revert the implementation commit/PR;
- do not rewrite already-applied historical migrations;
- for a deployed migration, use the repository’s normal forward-remediation process;
- do not delete policy history to “fix” an active decision;
- a bad published policy judgment is corrected by a new policy version;
- a broken data-access foundation blocks release rather than falling back to raw pg.

A policy data anomaly remains fail closed until repaired.

## Complexity Exceptions

No new framework or external service is approved.

The following are deliberate, bounded complexity:

1. per-feature publication serialization / overlap protection — justified by the Frozen Spec’s “at most one effective policy” invariant;
2. server-owned feature descriptor revision — required to prevent client/UI strings from becoming compliance truth;
3. separation of snapshot loading from pure evaluation — required for deterministic testing and transaction consistency.

No large Compliance Control Plane, admin UI, workflow engine, external policy engine, timer runtime, Safety duplication or data-access rewrite is authorized.

## Development Dependency Gate

Planning result:

- Slice 8 semantic dependency: **NO**
- Slice 9 semantic dependency: **NO**
- Slice 9 technical Drizzle dependency: **YES**
- Slice 9 Drizzle implementation currently on main: **NO**
- Implement Gate: **BLOCKED**

Future development may begin only after T1001 proves the dependency has become real.

## Planning Audit 1

Initial result: **FAIL — planning remediation required**

Independent re-read covered the Frozen Spec, four authority Docs, Constitution/templates/validators, current main, Slice 8 interface assumptions, Slice 9 Drizzle assumptions, Plan, Checklist and Tasks.

Findings:

| ID | Severity | Finding | Remediation |
|---|---|---|---|
| S10-P01 | MEDIUM | task-index requirement ranges such as `FR-004..FR-010` were human-readable but not mechanically exact requirement references | expand task REQ fields to exact FR identifiers |
| S10-P02 | MEDIUM | cross-field semantics did not explicitly forbid a NOT_APPLICABLE policy from simultaneously emitting the anthropomorphic usage-reminder rule | freeze REQUIRED / NOT_APPLICABLE / UNKNOWN cross-field coherence |
| S10-P03 | MEDIUM | effective-period overlap prevention was conceptually specified but left the DB enforcement mechanism open | freeze same-feature advisory-lock + DB trigger overlap guard, no new extension |
| S10-P04 | LOW | expired-policy and required-but-unsupported downstream obligation mappings were not explicit enough | add COMPLIANCE_POLICY_EXPIRED and server-owned obligation-support guard |

Spec change required: **NO**

Docs change required: **NO**

Planning remediation status: **COMPLETE in planning artifacts; final full re-audit required**
