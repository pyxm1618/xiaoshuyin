# Slice 9 Pre-Development Checklist — 009-safety-hold-control-foundation

Purpose: confirm that every contract is explicit enough for Development AI to execute without making a new product, architecture, data, Safety-authority or migration decision.

Status values: PASS / FAIL / N/A.

## A. Verified inputs and Spec integrity

| Check | Status | Evidence / Decision |
|---|---|---|
| authoritative main was re-read from GitHub | PASS | `8e393c990be53c888c2e68d881bd8b23f9c37638` |
| frozen Spec commit exists | PASS | `6737b90b7b0809fc12bdb2aae7fa46db45531403` |
| frozen Spec blob is verified | PASS | `9d11288aa063ae2a3b8e1942334083f9d82a804b` |
| frozen Spec parent equals current main | PASS | direct parent = `8e393c...` |
| frozen Spec branch points to the frozen commit | PASS | verified |
| input drift is classified | PASS | NONE |
| Selection must be reopened | N/A | no material drift |
| required authoritative Docs sections were re-read | PASS | product Safety + tech §6.6/6.7/7.0/23/27/38/39/41 |
| latest current-main CI was verified | PASS | run `42973063888` = success |
| latest merged main change was identified | PASS | PR #25 |

## B. Architecture baseline

| Check | Status | Evidence / Decision |
|---|---|---|
| Case status vocabulary is known | PASS | OPEN/WAITING/LOST_CONTACT/SAFETY_HOLD/CLOSED |
| current Safety runtime gap is explicit | PASS | vocabulary + local SwitchPrimary protection only |
| current main has no `risk_events` table | PASS | verified absence |
| current main has no `safety_states` current-state table | PASS | verified absence; static guard forbids it |
| single authorization entry is known | PASS | `authorize()` |
| RLS transaction/context substrate is known | PASS | app context functions + current tx helpers |
| canonical idempotency store is known | PASS | `idempotency_keys` |
| Case/Event/Audit persistence surfaces are known | PASS | `cases`, `case_events`, `business_audit_events` |
| SwitchPrimary lock order and Safety precedence are known | PASS | Family -> sorted Case locks; exact denial ordering recorded |
| current migration history is known | PASS | through 007; historical duplicate 004 filenames understood |

## C. Drizzle §7.0 Gate

| Check | Status | Evidence / Decision |
|---|---|---|
| authoritative requirement is explicit | PASS | Drizzle owns schema/query builder/transaction; SQL exceptions are narrow |
| current main is correctly classified as not yet compliant | PASS | no `db/schema`, no real Drizzle transaction/query path |
| missing `drizzle-kit` is explicitly owned | PASS | T902 must add a compatible dev dependency |
| missing `db/schema` is explicitly owned | PASS | T902 must create the minimum typed projection |
| missing Drizzle transaction path is explicitly owned | PASS | T902 must add a Drizzle-owned same-client RLS transaction |
| narrow remediation avoids whole-repo rewrite | PASS | Slice-9-owned path only; existing fact helpers may be reused on same client |
| raw-pg-only fallback is forbidden | PASS | T902 STOP condition |
| second schema truth is forbidden | PASS | runtime DB + reviewed migration + mechanically verified Drizzle projection |
| `drizzle-kit push` is forbidden | PASS | reviewed migration only |
| Drizzle Gate decision is explicit | PASS | **Option A — Narrowly compliant** |
| development-block condition is explicit | PASS | inability to satisfy T902 => separate Data Access Remediation |

## D. Single Safety truth and Risk Event

| Check | Status | Evidence / Decision |
|---|---|---|
| sole current Safety truth is fixed | PASS | `cases.status = SAFETY_HOLD` |
| no second current-status field/table is allowed | PASS | explicit scope guard |
| Risk Event is trace, not current state | PASS | append-only |
| Risk Event table shape is explicit | PASS | plan §4.2 |
| Family/Case structural scope is explicit | PASS | composite FK |
| server-generated identity/time is explicit | PASS | uuidv7 + created_at |
| event kinds are explicit | PASS | HOLD_ENTERED / RISK_RESOLVED |
| policy/rule/version/category refs are explicit | PASS | entry trace only |
| decision Case revision is explicit | PASS | `decision_case_version` |
| evidence refs are explicit | PASS | typed opaque refs |
| resolution link is explicit | PASS | same-Case self-FK |
| resolution authority ref is explicit | PASS | resolution trace only |
| RLS is explicit | PASS | ENABLE + FORCE, Family scope |
| runtime immutability is explicit | PASS | SELECT/INSERT only |
| raw sensitive text is forbidden | PASS | references/codes only |
| duplicate resolution is mechanically fenced | PASS | unique partial fence + Case lock |

## E. Domain commands and guard

| Check | Status | Evidence / Decision |
|---|---|---|
| RunSafetyPrecheck is deterministic/internal | PASS | pure, no mutation |
| network/LLM/RAG/external service is excluded | PASS | explicit |
| caller boolean cannot authorize a hold | PASS | approved typed rule-evaluation seam required |
| no professional rule catalog is invented | PASS | fixture-only tests; production makes no completeness claim |
| EnterSafetyHold is the only hold-entry command | PASS | explicit |
| Enter preserves phase and bumps version once | PASS | explicit transaction contract |
| CLOSED cannot enter hold | PASS | CASE_CLOSED |
| stale precheck cannot be blindly applied | PASS | Case + policy/rule identity revalidation |
| shared ordinary-progression guard exists in plan | PASS | transaction-backed re-read |
| guard cannot trust stale caller state | PASS | DB read inside caller transaction |
| guard is not a global write lock | PASS | only ordinary progression call sites |
| ResolveRisk is the unique exit | PASS | explicit |
| Resolve target/status semantics are fixed | PASS | WAITING; phase unchanged; no auto-resume |
| no public Safety mutation route is allowed | PASS | explicit negative surface |

## F. Authorization and resolver authority

| Check | Status | Evidence / Decision |
|---|---|---|
| existing `authorize()` remains canonical | PASS | additive action/facts only |
| parallel Safety RBAC is excluded | PASS | no second authorization system |
| family role cannot imply resolver authority | PASS | manager/guardian/member alone deny |
| current production resolver authority is correctly absent | PASS | authoritative contract respected |
| production Resolve is deny-by-default | PASS | production fact source returns no capability |
| controlled test authority is separated | PASS | test/support composition only |
| controlled test capability cannot reach production routes/exports | PASS | T906/T918 mechanical checks |
| AI/system/model cannot directly mutate Safety | PASS | no authority or route |
| authorization errors remain non-leaking | PASS | same anti-enumeration discipline |

## G. Transaction, locking and rollback

| Check | Status | Evidence / Decision |
|---|---|---|
| successful Enter write-set is one transaction | PASS | Case + Risk + Case Event + Audit + idempotency |
| successful Resolve write-set is one transaction | PASS | same atomic set |
| Drizzle owns Slice-9 transaction boundaries | PASS | T902 required |
| external I/O inside mutation transaction is excluded | PASS | explicit |
| canonical lock order is explicit | PASS | idempotency -> Family -> Case -> trace/evidence -> writes |
| lock order is compatible with SwitchPrimary | PASS | shared Family->Case serialization |
| Case update/Risk insert partial commit is impossible by contract | PASS | T915 failure injection |
| Risk insert/audit failure partial commit is impossible by contract | PASS | T915 failure injection |
| original infrastructure failure is preserved | PASS | DFX / tx helper requirement |
| broken checked-out client handling is explicitly tested | PASS | T902/T915 |

## H. Idempotency

| Check | Status | Evidence / Decision |
|---|---|---|
| existing store is reused | PASS | `idempotency_keys` |
| a second idempotency store/cache is excluded | PASS | explicit |
| Enter command type is specified | PASS | CASE_ENTER_SAFETY_HOLD |
| Resolve command type is specified | PASS | CASE_RESOLVE_RISK |
| same key/same payload replay is specified | PASS | no duplicate mutation |
| same key/different payload conflict is specified | PASS | existing mismatch semantic |
| concurrent same-key behavior is specified | PASS | one execution, peers replay |
| infrastructure failure cannot commit a success snapshot | PASS | transaction rollback |

## I. Concurrency and stale-decision protection

| Check | Status | Evidence / Decision |
|---|---|---|
| two concurrent Enter outcome is explicit | PASS | max one transition/version/event |
| two concurrent Resolve outcome is explicit | PASS | max one transition/version/event |
| Enter vs SwitchPrimary is serialized | PASS | Family->Case ordering |
| Enter vs Slice-8 ordinary progression is serialized | PASS | same aggregate ordering |
| opposite Case->Family lock order is prohibited | PASS | explicit |
| stale Case version cannot overwrite current state | PASS | optimistic revision check |
| precheck N -> Case N+1 scenario is mandatory | PASS | T916 |
| stale policy/rule version scenario is mandatory | PASS | T916 |

## J. RLS and privileges

| Check | Status | Evidence / Decision |
|---|---|---|
| Risk Event ENABLE/FORCE RLS is explicit | PASS | T903 |
| Family USING/WITH CHECK policy is explicit | PASS | T903 |
| app remains NOBYPASSRLS/non-owner | PASS | T912 |
| Risk Event UPDATE/DELETE is denied | PASS | runtime SELECT/INSERT only |
| cases table-level UPDATE remains denied | PASS | column grants only |
| Safety Case writable columns are minimal | PASS | status/version/updated_at |
| Case Event stays append-only | PASS | regression required |
| cross-Family Risk links are structurally impossible | PASS | composite FK + RLS |

## K. Event/Audit vocabulary and privacy

| Check | Status | Evidence / Decision |
|---|---|---|
| Risk Event responsibility is distinct | PASS | Safety trace identifiers/references |
| Case Event responsibility is distinct | PASS | lifecycle transition |
| Business Audit responsibility is distinct | PASS | actor/action/authority context |
| strict metadata keys are specified | PASS | plan §13 |
| sensitive/free-form payload duplication is forbidden | PASS | references only |
| Case Event event literals are specified | PASS | CASE_SAFETY_HOLD_ENTERED / CASE_RISK_RESOLVED |
| audit resource strategy is specified | PASS | CASE resource + riskEventId reference |

## L. Error semantics

| Check | Status | Evidence / Decision |
|---|---|---|
| unauthenticated | PASS | existing UNAUTHENTICATED |
| unauthorized/invisible/family mismatch | PASS | non-leaking Case semantics |
| case closed | PASS | CASE_CLOSED |
| already held | PASS | SAFETY_HOLD_ALREADY_ACTIVE |
| ordinary held block | PASS | existing SAFETY_HOLD_BLOCKED |
| stale Case revision | PASS | STALE_CASE_VERSION |
| stale precheck | PASS | SAFETY_PRECHECK_STALE |
| invalid precheck | PASS | SAFETY_PRECHECK_INVALID |
| invalid review evidence | PASS | SAFETY_REVIEW_EVIDENCE_INVALID |
| resolver denied/unavailable | PASS | stable separate semantics |
| Resolve while no longer held | PASS | SAFETY_HOLD_REQUIRED |
| idempotency mismatch | PASS | existing semantic |
| internal/transaction failure | PASS | existing generic INTERNAL_ERROR |

## M. Slice 8 integration

| Check | Status | Evidence / Decision |
|---|---|---|
| current Slice 8 branch/head is known | PASS | `31c03a2355fa8b5972d56ea26684fb7f8df7b8f4` |
| Slice 8 current implementation on main | N/A | not present; do not duplicate it |
| all six ordinary write commands are named exactly | PASS | Start/Present/Confirm/Dispute/Correct/Reassess |
| shared guard call point is fixed | PASS | after Family+Case lock/re-read, before progression writes |
| Safety block machine error is fixed | PASS | SAFETY_HOLD_BLOCKED |
| replay timing is reconciled | PASS | replay/mismatch before mutable-state guard per Slice 8 plan |
| Case revision timing is reconciled | PASS | same locked aggregate snapshot |
| read-only formulation is correctly excluded from ordinary progression | PASS | not blocked solely by Safety |
| Slice 8 Spec/plan is not modified by this Slice | PASS | explicit |
| Slice 8 runtime is not preimplemented here | PASS | explicit |

## N. Migration coordination

| Check | Status | Evidence / Decision |
|---|---|---|
| current main migration set is known | PASS | through 007 |
| Slice 8 provisional migration is known | PASS | 008_problem_formulation_core.sql |
| Slice 9 provisional migration name is non-frozen | PASS | 009_safety_hold_control_foundation.sql |
| migration number is treated as integration metadata, not product contract | PASS | explicit |
| shared CHECK/privilege collision is identified | PASS | events/audit/idempotency/grants |
| second merging branch must rebase/re-author shared whitelists | PASS | mechanical rule |
| stale pre-merge CHECK replacement is forbidden | PASS | explicit |
| fresh/upgrade/replay/failure evidence is required | PASS | T903/T919 |

## O. Testing and acceptance

| Check | Status | Evidence / Decision |
|---|---|---|
| Unit strategy is explicit | PASS | precheck/guard/transitions/errors/privacy |
| Integration strategy is explicit | PASS | Enter/block/Switch/Resolve/idempotency/stale |
| DB strategy is explicit | PASS | atomicity/RLS/concurrency/trace |
| Case-updated then Risk-insert-fails injection is mandatory | PASS | T915 |
| Risk-inserted then audit-fails injection is mandatory | PASS | T915 |
| concurrent Enter is mandatory | PASS | T916 |
| concurrent Resolve is mandatory | PASS | T916 |
| stale precheck N->N+1 is mandatory | PASS | T916 |
| unique-exit static/code search is mandatory | PASS | T918 |
| no-public-route verification is mandatory | PASS | T914/T918 |
| FR-001..FR-028 traceability is complete | PASS | plan Appendix A |
| acceptance can be mechanically verified | PASS | no critical manual-only item |

## P. Scope and governance

| Check | Status | Evidence / Decision |
|---|---|---|
| Phase 5 support content/resources are excluded | PASS | explicit |
| Referral/hotline/staff queue/ops UI are excluded | PASS | explicit |
| fake resolver/staff account is excluded | PASS | explicit |
| Guardrails/AI risk_review/RAG are excluded | PASS | explicit |
| Digital Use/Scene is excluded | PASS | explicit |
| Goal/Plan/Task is excluded | PASS | explicit |
| Problem Formulation runtime is excluded | PASS | integration seam only |
| existing `safety_states` static prohibition remains | PASS | must not be weakened |
| Docs change is required | N/A | no |
| frozen Spec change is required | N/A | no |
| CI/Spec Governance baseline is understood | PASS | exact workflows re-read |
| final full-regression closeout is explicit | PASS | T920 |

# Pre-Development Checklist Result

All planning-contract checks are **PASS** or correctly **N/A**. There is no unresolved FAIL.

The current-main Drizzle deficiencies are not waived: they are explicit implementation work owned by T902 with a hard STOP condition if narrow compliance proves impossible.

- CRITICAL findings: 0
- HIGH findings: 0
- MEDIUM findings: 0
- LOW findings: 0

**CHECKLIST: PASS**

**READY FOR DEVELOPMENT, subject to plan.md §24 and tasks.md T901 revalidation at development start.**
