# Slice 10 Pre-Development Checklist — 010-compliance-feature-policy-foundation

Purpose: reviewer-owned mechanical gate proving the Frozen Spec has been converted into an executable implementation contract without changing product semantics.

Status values: **PASS / FAIL / N/A**.

## A. Authority / provenance

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK001 | current authoritative main was re-read | PASS | `8e393c990be53c888c2e68d881bd8b23f9c37638` |
| CHK002 | Frozen Spec commit exists | PASS | `20b6eaecf7a1ac24904409f805042759631f5cf0` |
| CHK003 | Frozen Spec blob matches freeze record | PASS | `a911bcc0c168e00efa015d53d5c120bece28c5a7` |
| CHK004 | Frozen Spec is one commit ahead / zero behind current main | PASS | remote compare |
| CHK005 | Frozen Spec commit changes only its `spec.md` | PASS | remote compare |
| CHK006 | Input Drift is classified | PASS | NONE |
| CHK007 | four authoritative Docs were re-read for Slice 10 semantics | PASS | Compliance / data / auth / Safety / Drizzle sections |
| CHK008 | V1 product semantics remain owned by `V1产品需求.md` | PASS | no planning override |
| CHK009 | Frozen Spec was not edited | PASS | planning branch starts from frozen commit |
| CHK010 | Docs change is required | N/A | no Docs change |

## B. Governance format

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK011 | current Constitution was read | PASS | `.specify/memory/constitution.md` |
| CHK012 | current plan/tasks/checklist templates were read | PASS | `.specify/templates/**` |
| CHK013 | current governance validator was read | PASS | `.specify/scripts/validate-governance.mjs` |
| CHK014 | governance self-test was read | PASS | `.specify/scripts/tests/run-governance-tests.mjs` |
| CHK015 | Docs guard was read | PASS | `.specify/scripts/check-docs-guard.mjs` |
| CHK016 | latest canonical Slice 9 planning artifacts were reviewed | PASS | plan/checklist/tasks on `plan/009-...` |
| CHK017 | Plan contains required `## Upstream Traceability` heading | PASS | plan.md |
| CHK018 | Plan contains required `## Constitution Check` heading | PASS | plan.md |
| CHK019 | Plan contains required `## Verification Plan` heading | PASS | plan.md |
| CHK020 | every task line uses checkbox + T-ID + REQ + VERIFY | PASS | tasks.md contract |
| CHK021 | checklist items are mechanically decidable | PASS | CHK001+ PASS/FAIL/N/A |
| CHK022 | later artifact exists only with predecessors | PASS | spec → plan → tasks |

## C. Scope

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK023 | Slice remains Phase 1 Common Core foundation | PASS | no Scene/runtime expansion |
| CHK024 | feature-policy truth is in scope | PASS | plan §5 |
| CHK025 | deterministic evaluator is in scope | PASS | plan §6 |
| CHK026 | existing profile/consent consumption is in scope | PASS | plan §7 |
| CHK027 | continuous-use session/timer is absent | PASS | explicit negative scope |
| CHK028 | actual two-hour timer/reminder dispatch is absent | PASS | explicit negative scope |
| CHK029 | Notification / pg-boss implementation is absent | PASS | explicit negative scope |
| CHK030 | generated-content artifact/export runtime is absent | PASS | explicit negative scope |
| CHK031 | PIPIA/regulatory workflow is absent | PASS | explicit negative scope |
| CHK032 | AI/RAG/model runtime is absent | PASS | evaluator model-free |
| CHK033 | A4003 runtime/Scene branch is absent | PASS | generic fixture only |
| CHK034 | Safety implementation is absent | PASS | Slice 9 remains owner |
| CHK035 | fake staff/reviewer/Human Ops is absent | PASS | publication uses reviewed migration/provisioning |
| CHK036 | no public compliance admin/browse API is planned | PASS | plan §9 |

## D. Feature identity

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK037 | feature identity is server-owned | PASS | descriptor/registry contract |
| CHK038 | UI page name is not business truth | PASS | featureCode identifies capability |
| CHK039 | arbitrary client feature string cannot authorize evaluation | PASS | request boundary does not create descriptors |
| CHK040 | feature identity includes separate contract revision | PASS | `featureCode + featureContractRevision` |
| CHK041 | feature contract revision is distinct from policy version | PASS | explicit plan invariant |
| CHK042 | Common Core supports Scene-owned registration without Scene-specific if/else | PASS | plan §4.3 |
| CHK043 | changed capability semantics require a new reviewed policy before release | PASS | exact revision lookup fails closed |

## E. Policy truth / lifecycle

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK044 | exactly one feature-level policy truth table is planned | PASS | `compliance_feature_policies` |
| CHK045 | applicability values are exactly REQUIRED / NOT_APPLICABLE / UNKNOWN | PASS | no extra applicability state |
| CHK046 | NULL/missing cannot mean NOT_APPLICABLE | PASS | missing fails closed |
| CHK047 | REQUIRED carries basis/evidence | PASS | DB constraint/validation |
| CHK048 | NOT_APPLICABLE carries basis/evidence | PASS | DB constraint/validation |
| CHK049 | UNKNOWN does not become NOT_APPLICABLE | PASS | evaluator blocks |
| CHK050 | policy judgment fields are immutable after publication | PASS | lifecycle-only supersession mutation |
| CHK051 | new judgment requires new policy version row | PASS | plan §5.3 |
| CHK052 | policy history retains effective period and supersession | PASS | planned columns |
| CHK053 | zero active policies fails closed | PASS | selection classification |
| CHK054 | multiple active policies fail closed | PASS | no “latest wins” fallback |
| CHK055 | future policy is not selected early | PASS | captured evaluation time |
| CHK056 | expired policy does not remain effective | PASS | exclusive effective_until |
| CHK057 | controlled publication serializes exact feature identity | PASS | advisory lock + recheck |
| CHK058 | storage overlap is rejected | PASS | same-feature advisory-lock + BEFORE INSERT/UPDATE overlap trigger |
| CHK059 | evaluator still detects corrupt overlap defensively | PASS | ambiguity path |
| CHK060 | no fake production applicability seed is required | PASS | test fixtures only unless approved evidence exists |

## F. Policy rule semantics / obligations

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK061 | feature-level minor rule can express MINORS_BLOCKED | PASS | generic rule |
| CHK062 | feature policy cannot weaken baseline person/consent rules | PASS | baseline applied before stricter rule |
| CHK063 | AI disclosure obligation is expressible | PASS | REQUIRE_AI_DISCLOSURE |
| CHK064 | generated-content label obligation is expressible | PASS | REQUIRE_GENERATED_CONTENT_LABEL |
| CHK065 | usage-reminder obligation is expressible | PASS | REQUIRE_USAGE_REMINDER |
| CHK066 | unresolved applicability can express regulatory/evidence obligation | PASS | REQUIRE_REGULATORY_EVIDENCE + block |
| CHK067 | BASELINE never disables an upstream/global requirement | PASS | explicit rule semantics |
| CHK068 | anthropomorphic REQUIRED cannot silently omit AI disclosure | PASS | policy invariant |
| CHK069 | anthropomorphic REQUIRED cannot silently omit usage-reminder obligation | PASS | policy invariant |
| CHK070 | actual obligation execution remains downstream | PASS | no timer/export/notification implementation |

## G. Existing age / guardian / consent truth

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK071 | existing `person_compliance_profiles` is reused | PASS | no duplicate profile table |
| CHK072 | existing age-band enum is reused | PASS | ADULT/MINOR_14_17/UNDER_14/UNKNOWN |
| CHK073 | GUARDIAN is not invented as an age band | PASS | guardian remains relationship fact |
| CHK074 | existing `minor_mode` is reused | PASS | no second minor state |
| CHK075 | existing `guardian_person_id` is reused | PASS | no guardian-role table |
| CHK076 | Family membership does not imply guardian | PASS | existing semantics preserved |
| CHK077 | `verified_source` does not prove guardian identity | PASS | existing semantics preserved |
| CHK078 | existing guardian-consent chain/evidence is reused | PASS | no boolean placeholder |
| CHK079 | existing `assertMinorProcessingAllowed` is reused/composed | PASS | no duplicate age gate |
| CHK080 | UNDER_14 invalid/missing/revoked consent blocks | PASS | evaluator order |
| CHK081 | MINOR_14_17 does not inherit UNDER_14 consent solely due to age | PASS | explicit plan rule |
| CHK082 | age UNKNOWN blocks | PASS | no adult fallback |

## H. Deterministic evaluator

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK083 | snapshot loading and pure evaluation are separated | PASS | plan §6.1 |
| CHK084 | evaluator has no model call | PASS | explicit |
| CHK085 | evaluator has no network call | PASS | explicit |
| CHK086 | evaluator has no notification/export/timer side effect | PASS | explicit |
| CHK087 | production evaluation time is server-owned | PASS | captured once |
| CHK088 | tests can inject fixed time | PASS | deterministic |
| CHK089 | evaluator returns exact policy provenance | PASS | feature/revision/policy/time |
| CHK090 | same snapshot/time yields same logical result | PASS | required test |
| CHK091 | malformed policy fails closed | PASS | validation before result |
| CHK092 | infrastructure failure is not converted to business denial | PASS | exception propagation |

## I. Authorization / RLS / privacy

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK093 | existing `authorize()` remains the sole authorization entry | PASS | no second RBAC |
| CHK094 | Compliance ALLOW does not authorize access | PASS | explicit |
| CHK095 | unauthorized/cross-family target is rejected before detail exposure | PASS | anti-enumeration |
| CHK096 | global feature policy table is not misclassified as Family-owned data | PASS | no family_id |
| CHK097 | global policy runtime grant is SELECT-only | PASS | planned privilege contract |
| CHK098 | policy runtime INSERT/UPDATE/DELETE/TRUNCATE are denied | PASS | DB verification |
| CHK099 | existing Person/consent reads remain under Family/identity RLS | PASS | same transaction seam |
| CHK100 | no RLS weakening is planned | PASS | existing policies unchanged |
| CHK101 | policy evidence/raw sensitive content is not client-exposed | PASS | no public route |
| CHK102 | runtime logs exclude raw child/family/consent content | PASS | bounded provenance only |
| CHK103 | policy table browsing is not exposed to end users | PASS | internal-only service |

## J. Safety / gate precedence

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK104 | Safety remains independent | PASS | no Safety state/write |
| CHK105 | Compliance ALLOW cannot clear SAFETY_HOLD | PASS | explicit |
| CHK106 | Safety ALLOW cannot convert UNKNOWN Compliance to ALLOW | PASS | explicit |
| CHK107 | policy-only evaluation is allowed while held | PASS | read-only evaluation does not progress Case |
| CHK108 | ordinary progression preserves existing Safety guard before effect | PASS | auth → Safety → Compliance → domain effect |
| CHK109 | response release preserves existing Safety-before-Compliance validation order | PASS | authority architecture |
| CHK110 | existing command-specific denial precedence is not rewritten | PASS | Slice 10 does not own it |

## K. Drizzle / data architecture

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK111 | current main Drizzle gap is recognized | PASS | no `db/schema` / no real runtime seam on main |
| CHK112 | Slice 9 technical dependency is explicit | PASS | Implement Gate BLOCKED |
| CHK113 | Slice 10 does not build a second transaction abstraction | PASS | consume Slice 9 seam |
| CHK114 | raw-pg-only fallback is forbidden | PASS | hard STOP |
| CHK115 | reviewed SQL migration remains production schema-change truth | PASS | no push |
| CHK116 | Drizzle schema is typed projection, not second truth | PASS | parity tests |
| CHK117 | same-client identity/RLS invariants must survive | PASS | T1002 gate |
| CHK118 | missing Slice 9 Drizzle on future main causes STOP | PASS | T1001 |
| CHK119 | failed narrow Drizzle outcome causes Data Access Remediation STOP | PASS | T1001/T1002 |
| CHK120 | migration number is not frozen now | PASS | T1001 reconciles |

## L. Migration / database

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK121 | policy PK uses repository uuidv7 baseline | PASS | plan §5 |
| CHK122 | policy version uniqueness is explicit | PASS | feature/revision/version |
| CHK123 | effective interval validity is explicit | PASS | end > start |
| CHK124 | supersession FK is explicit | PASS | self-reference |
| CHK125 | lookup indexes are explicit | PASS | feature/revision/time |
| CHK126 | runtime owner is not application role | PASS | migrator owns |
| CHK127 | fresh migration test is required | PASS | verification plan |
| CHK128 | upgrade migration test is required | PASS | verification plan |
| CHK129 | second apply/replay test is required | PASS | verification plan |
| CHK130 | failed migration rollback is required | PASS | verification plan |
| CHK131 | no destructive unrelated DDL is allowed | PASS | scope verification |
| CHK132 | exact Drizzle/schema parity is required | PASS | database verification |

## M. Idempotency / concurrency

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK133 | evaluation has no idempotency key | PASS | read-only decision |
| CHK134 | no second idempotency store is introduced | PASS | explicit |
| CHK135 | no runtime publication command is required | PASS | reviewed deployment publication |
| CHK136 | existing idempotency is reused if a future internal command is later approved | PASS | no parallel truth |
| CHK137 | concurrent publication invariant is explicit | PASS | per-feature serialization |
| CHK138 | evaluation records exact version used | PASS | provenance |
| CHK139 | evaluation/supersession race has defined snapshot semantics | PASS | caller/shared transaction snapshot |
| CHK140 | evaluation/person-consent race has defined command integration boundary | PASS | same caller transaction / lock discipline |
| CHK141 | long-running downstream recheck remains downstream responsibility | PASS | no scope leakage |

## N. Failure semantics

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK142 | unknown feature has distinct internal code | PASS | COMPLIANCE_FEATURE_UNKNOWN |
| CHK143 | stale feature revision has distinct code | PASS | COMPLIANCE_FEATURE_REVISION_STALE |
| CHK144 | missing policy has distinct code | PASS | COMPLIANCE_POLICY_MISSING |
| CHK145 | ambiguous policy has distinct code | PASS | COMPLIANCE_POLICY_AMBIGUOUS |
| CHK146 | invalid policy has distinct code | PASS | COMPLIANCE_POLICY_INVALID |
| CHK147 | applicability UNKNOWN has distinct code | PASS | COMPLIANCE_APPLICABILITY_UNKNOWN |
| CHK148 | profile missing has distinct code | PASS | COMPLIANCE_PROFILE_MISSING |
| CHK149 | age UNKNOWN has distinct code | PASS | COMPLIANCE_AGE_UNKNOWN |
| CHK150 | guardian consent required/invalid remains distinguishable internally | PASS | two internal codes |
| CHK151 | stricter policy access block is distinct | PASS | COMPLIANCE_FEATURE_BLOCKED |
| CHK152 | downstream capability unavailable is fail-closed | PASS | server-owned obligation-support guard → COMPLIANCE_CAPABILITY_UNAVAILABLE |
| CHK153 | unauthorized/cross-family uses existing external semantics | PASS | no enumeration oracle |
| CHK154 | infrastructure failure propagates truthfully | PASS | never ordinary allow/block conversion |

## O. Audit / traceability

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK155 | policy definition history is versioned | PASS | immutable judgment rows |
| CHK156 | publication provenance is stored without fake staff workflow | PASS | approved_at/evidence/source ref |
| CHK157 | every evaluation result carries policy provenance | PASS | required result fields |
| CHK158 | every evaluation does not mechanically write a DB audit row | PASS | avoids unnecessary sensitive logging |
| CHK159 | downstream business effects can persist exact policy provenance | PASS | contract requirement |
| CHK160 | generic audit metadata excludes raw sensitive content | PASS | explicit |

## P. Testing / acceptance

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK161 | REQUIRED/NOT_APPLICABLE/UNKNOWN tests are planned | PASS | domain matrix |
| CHK162 | missing/future/expired/overlap tests are planned | PASS | domain + DB |
| CHK163 | ADULT/MINOR_14_17/UNDER_14/UNKNOWN tests are planned | PASS | real age enum |
| CHK164 | guardian scenario uses existing relationship, not a new age state | PASS | fixture rule |
| CHK165 | valid/missing/revoked/invalid consent tests are planned | PASS | real model |
| CHK166 | client feature spoofing test is planned | PASS | server mapping |
| CHK167 | deterministic/no-network/no-model proof is planned | PASS | focused tests/static checks |
| CHK168 | authorization/RLS/cross-family tests are planned | PASS | integration |
| CHK169 | infrastructure-error propagation test is planned | PASS | fault injection |
| CHK170 | fresh/upgrade/replay/rollback DB tests are planned | PASS | DB matrix |
| CHK171 | exact schema/grant parity test is planned | PASS | DB introspection |
| CHK172 | full Slice 1–7 regression is planned | PASS | closeout |
| CHK173 | Slice 8 regression is conditional on merge | PASS | T1001/T1012 |
| CHK174 | Slice 9 regression is conditional on merge and mandatory before Slice 10 implement | PASS | dependency gate |
| CHK175 | all 16 Frozen acceptance scenarios map to evidence | PASS | plan §18.9 |

## Q. Development-start dependency gate

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK176 | T1001 re-fetches latest main | PASS | mandatory first task |
| CHK177 | T1001 rechecks clean branch/worktree where local git exists | PASS | development preflight |
| CHK178 | T1001 rechecks Slice 8 merge state | PASS | migration/shared vocabulary |
| CHK179 | T1001 rechecks Slice 9 merge state | PASS | hard dependency |
| CHK180 | T1001 verifies actual Slice 9 Drizzle files/versions/seam | PASS | no planning assumption accepted |
| CHK181 | T1001 rechecks migration numbering | PASS | non-frozen |
| CHK182 | T1001 rechecks compliance/profile/consent schema | PASS | no stale assumptions |
| CHK183 | T1001 rechecks authorization/RLS/grants | PASS | security baseline |
| CHK184 | T1001 rechecks CI baseline | PASS | exact-head evidence |
| CHK185 | absent Slice 9 Drizzle causes STOP before production edits | PASS | Implement Gate BLOCKED |
| CHK186 | no Development AI waiver exists for the Drizzle dependency | PASS | explicit STOP |

## R. Audit 1 remediation closure

| ID | Check | Status | Evidence / Decision |
|---|---|---|---|
| CHK187 | NOT_APPLICABLE cannot simultaneously assert the anthropomorphic usage-reminder rule | PASS | usage_reminder_rule must be BASELINE |
| CHK188 | UNKNOWN remains BLOCK regardless of other rule values | PASS | cross-field coherence |
| CHK189 | two concurrent first-publish attempts serialize even when no current row exists | PASS | DB trigger obtains exact-feature advisory lock |
| CHK190 | expired matching policy history is not collapsed into NOT_APPLICABLE/ALLOW | PASS | COMPLIANCE_POLICY_EXPIRED |

# Audit 1 Remediation Check

Audit 1 planning findings S10-P01..S10-P04 were applied only to Plan / Checklist / Tasks:

- exact FR identifiers replace task-range shorthand;
- policy cross-field coherence is frozen;
- overlap enforcement is frozen to the advisory-lock + DB-trigger mechanism;
- expired-policy and unsupported-obligation error semantics are explicit.

Spec changed: **NO**  
Docs changed: **NO**  
Production code changed: **NO**

# Pre-Development Checklist Result

Planning-contract review after remediation contains no FAIL item.

- CRITICAL planning blockers discovered by checklist: 0
- HIGH planning blockers discovered by checklist: 0
- MEDIUM planning blockers discovered by checklist: 0
- LOW planning blockers discovered by checklist: 0

**CHECKLIST: PASS**

This checklist does **not** open implementation. Slice 10 remains technically blocked until the Slice 9 Drizzle foundation is actually merged or a separate Data Access Remediation closes the dependency.
