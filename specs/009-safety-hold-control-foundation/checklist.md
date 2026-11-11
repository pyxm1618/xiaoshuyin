# Slice 9 Pre-Development Checklist — 009-safety-hold-control-foundation

Purpose: verify that the contracts are sufficiently explicit **before development starts**. This is not an implementation progress checklist.

Status values: PASS / FAIL / N/A.

## A. Verified inputs and Spec integrity

| Check | Status | Evidence / Decision |
|---|---|---|
| authoritative main re-read from GitHub | PASS | `8e393c990be53c888c2e68d881bd8b23f9c37638` |
| frozen Spec commit exists | PASS | `6737b90b7b0809fc12bdb2aae7fa46db45531403` |
| frozen Spec blob verified | PASS | `9d11288aa063ae2a3b8e1942334083f9d82a804b` |
| frozen Spec parent equals current main | PASS | parent = `8e393c...` |
| frozen Spec branch points to frozen commit | PASS | `spec/009-safety-hold-control-foundation` |
| input drift classified | PASS | NONE |
| selection needs reopening | N/A | no material drift; selection remains frozen |
| required authoritative Docs sections re-read | PASS | product Safety + tech §6.6/6.7/7.0/23/27/38/39/41 |
| latest main CI verified | PASS | run `42973063888` = success |
| latest merged main change identified | PASS | PR #25 |

## B. Architecture baseline

| Check | Status | Evidence / Decision |
|---|---|---|
| current Case status vocabulary confirmed | PASS | OPEN/WAITING/LOST_CONTACT/SAFETY_HOLD/CLOSED |
| current Safety runtime confirmed incomplete | PASS | only vocabulary + SwitchPrimary local guard |
| no existing `risk_events` current implementation | PASS | absent on main |
| no existing `safety_states` current-state table | PASS | absent; static guard forbids it |
| current authorization entry identified | PASS | single `authorize()` |
| current RLS entry identified | PASS | `withRlsTransaction` + app context functions |
| current idempotency store identified | PASS | `idempotency_keys` |
| current Case/event/audit persistence identified | PASS | Case repositories + case_events + business_audit_events |
| current SwitchPrimary lock/precedence identified | PASS | Family lock + sorted Case locks; frozen denial precedence |
| current migration set identified | PASS | 001..007 with two historical 004 files |

## C. Drizzle Gate

| Check | Status | Evidence / Decision |
|---|---|---|
| §7.0 requires Drizzle schema/query/transaction | PASS | authoritative technical design |
| current architecture already compliant | N/A | Option C rejected |
| `drizzle-orm` present | PASS | API dependency / lockfile |
| `drizzle-kit` usable today | FAIL | missing from current lockfile — **planned remediation in T902; not accepted as current compliance** |
| `db/schema` exists today | FAIL | absent — **planned remediation in T902** |
| real Drizzle transaction path exists today | FAIL | absent — **planned remediation in T902** |
| narrow Slice-9 remediation is feasible without whole-repo rewrite | PASS | new typed projection + Drizzle-owned transaction + existing RLS/fact helpers |
| raw-only fallback permitted | FAIL | explicitly prohibited |
| second schema truth permitted | FAIL | prohibited; parity must be mechanically verified |
| production `drizzle-kit push` permitted | FAIL | prohibited |
| Drizzle Gate planning decision | PASS | **Option A — Narrowly compliant** |
| T902 has a STOP condition if narrow compliance fails | PASS | development must block, not weaken §7.0 |

Note: FAIL rows in this section describe **current-main deficiencies that the Plan explicitly owns as implementation work**, not unresolved planning ambiguity. The gate passes because the remediation path is fully specified and bounded. If T902 cannot make them green in development, implementation stops.

## D. Safety current-state truth

| Check | Status | Evidence / Decision |
|---|---|---|
| unique current Safety fact chosen | PASS | `cases.status` |
| `risk_events` contains current_status | FAIL | explicitly forbidden |
| active Safety boolean/pointer added elsewhere | FAIL | explicitly forbidden |
| Risk Event role is trace only | PASS | append-only event trace |
| Risk Event can independently override Case state | FAIL | structurally/semantically forbidden |
| Resolve changes entry event in place | FAIL | resolution is a new append-only event |

## E. Risk Event persistence

| Check | Status | Evidence / Decision |
|---|---|---|
| table/artifact shape specified | PASS | plan §4.2 |
| Family scope | PASS | `family_id` + composite Case FK |
| Case scope | PASS | `case_id` |
| server ID/time | PASS | uuidv7 + server created_at |
| event kind | PASS | HOLD_ENTERED / RISK_RESOLVED |
| policy/rule version refs | PASS | opaque refs + versions on entry |
| case revision | PASS | `decision_case_version` |
| evidence refs | PASS | strict typed reference array |
| resolution link | PASS | same-Case self-FK |
| resolver authority reference | PASS | required on resolution event |
| RLS | PASS | ENABLE + FORCE, Family scoped |
| immutability | PASS | runtime SELECT/INSERT only |
| raw sensitive text stored | FAIL | prohibited |
| duplicate resolution per hold event | FAIL | unique partial fence planned |

## F. Domain contracts

| Check | Status | Evidence / Decision |
|---|---|---|
| RunSafetyPrecheck is deterministic | PASS | pure/internal |
| RunSafetyPrecheck uses network/LLM/RAG | FAIL | prohibited |
| caller boolean can authorize hold | FAIL | prohibited |
| full professional rule catalog invented | FAIL | prohibited |
| test deterministic fixtures allowed | PASS | approved-input fixture seam only |
| EnterSafetyHold is the only entry command | PASS | explicit |
| Enter preserves phase | PASS | explicit |
| Enter increments Case version exactly once | PASS | explicit |
| CLOSED can enter hold | FAIL | rejected |
| stale precheck can be applied | FAIL | rejected |
| ordinary progression guard is reusable | PASS | transaction-backed guard |
| guard trusts caller status snapshot | FAIL | prohibited |
| guard globally blocks Evidence/Consent/Data Rights | FAIL | prohibited |
| ResolveRisk is unique exit | PASS | explicit |
| Resolve target is WAITING | PASS | explicit |
| Resolve auto-resumes old phase/task | FAIL | prohibited |
| public Safety mutation route exists/planned | FAIL | prohibited |

## G. Authorization

| Check | Status | Evidence / Decision |
|---|---|---|
| single `authorize()` remains canonical | PASS | additive action/facts only |
| separate Safety RBAC invented | FAIL | prohibited |
| manager/guardian automatically becomes resolver | FAIL | prohibited |
| production resolver role currently exists | FAIL | authoritative absence respected |
| production Resolve authority fails closed | PASS | deny-all fact source |
| controlled test resolver capability defined | PASS | test-only fact source |
| test resolver exposed by production app/routes | FAIL | prohibited |
| AI/model has direct mutation authority | FAIL | prohibited |
| unauthorized/cross-Family error leaks target facts | FAIL | prohibited |

## H. Transactions and locking

| Check | Status | Evidence / Decision |
|---|---|---|
| one transaction covers all successful Enter writes | PASS | plan §9 |
| one transaction covers all successful Resolve writes | PASS | plan §9 |
| Drizzle owns Slice-9 BEGIN/COMMIT/ROLLBACK | PASS | required implementation contract |
| external call inside mutation transaction | FAIL | prohibited |
| canonical lock order specified | PASS | idem -> Family -> Case -> trace/evidence -> writes |
| lock order compatible with SwitchPrimary | PASS | same Family->Case aggregate order |
| Case update + Risk Event can partially commit | FAIL | failure injection forbids |
| Risk Event + missing audit can partially commit | FAIL | failure injection forbids |
| rollback preserves original internal error semantics | PASS | required |
| broken client may be silently returned healthy | FAIL | DFX test forbids |

## I. Idempotency

| Check | Status | Evidence / Decision |
|---|---|---|
| existing store reused | PASS | `idempotency_keys` |
| second idempotency store/cache added | FAIL | prohibited |
| Enter command type planned | PASS | CASE_ENTER_SAFETY_HOLD |
| Resolve command type planned | PASS | CASE_RESOLVE_RISK |
| same key/same payload replays | PASS | explicit |
| same key/different payload conflicts | PASS | existing mismatch semantic |
| replay can duplicate Risk Event | FAIL | prohibited |
| internal failure commits idempotency success | FAIL | prohibited |

## J. Concurrency

| Check | Status | Evidence / Decision |
|---|---|---|
| concurrent Enter outcome specified | PASS | at most one transition/version/event |
| concurrent Resolve outcome specified | PASS | at most one transition/version/event |
| same-key concurrent replay specified | PASS | one execution |
| Enter vs SwitchPrimary serialized | PASS | Family->Case locking |
| Enter vs Slice 8 progression serialized | PASS | same aggregate order |
| opposite Case->Family locking allowed | FAIL | prohibited |
| stale Case revision can overwrite | FAIL | prohibited |

## K. RLS and privileges

| Check | Status | Evidence / Decision |
|---|---|---|
| `risk_events` ENABLE RLS | PASS | planned |
| `risk_events` FORCE RLS | PASS | planned |
| Family USING/WITH CHECK policy | PASS | planned |
| app role NOBYPASSRLS remains required | PASS | planned regression |
| app owns Risk Event table | FAIL | migrator ownership required |
| app may UPDATE/DELETE Risk Events | FAIL | prohibited |
| cases table-level UPDATE granted | FAIL | must remain false |
| cases status/version/updated_at column grant specified | PASS | narrow grant |
| cross-Family Risk Event link possible | FAIL | composite FK + RLS prohibit |

## L. Event / Audit separation and privacy

| Check | Status | Evidence / Decision |
|---|---|---|
| Risk Event role defined | PASS | Safety-specific detailed reference trace |
| Case Event role defined | PASS | lifecycle transition history |
| Business Audit role defined | PASS | actor/action/authority context |
| same sensitive body copied to all three | FAIL | prohibited |
| raw user text stored in event/audit | FAIL | prohibited |
| strict metadata shapes planned | PASS | exact minimal keys |
| Risk Event references rather than copies evidence content | PASS | explicit |

## M. Error semantics

| Check | Status | Evidence / Decision |
|---|---|---|
| unauthenticated | PASS | existing UNAUTHENTICATED |
| unauthorized / invisible | PASS | non-leaking |
| family mismatch | PASS | converges to non-leaking Case not found/access semantics |
| Case closed | PASS | CASE_CLOSED |
| already held | PASS | SAFETY_HOLD_ALREADY_ACTIVE |
| ordinary Safety blocked | PASS | existing SAFETY_HOLD_BLOCKED |
| stale Case version | PASS | STALE_CASE_VERSION |
| stale precheck | PASS | SAFETY_PRECHECK_STALE |
| invalid precheck | PASS | SAFETY_PRECHECK_INVALID |
| invalid review evidence | PASS | SAFETY_REVIEW_EVIDENCE_INVALID |
| resolver denied/unavailable | PASS | distinct stable semantics |
| idempotency mismatch | PASS | existing semantic |
| internal failure | PASS | generic INTERNAL_ERROR |

## N. Slice 8 integration

| Check | Status | Evidence / Decision |
|---|---|---|
| Slice 8 frozen/current planning state re-read | PASS | head `31c03a...` |
| Slice 8 implementation already on main | FAIL | no; therefore no runtime copied |
| exact ordinary commands identified | PASS | six commands listed in plan §15 |
| guard call location fixed | PASS | after Family+Case lock/re-read, before business progression write |
| machine error fixed | PASS | SAFETY_HOLD_BLOCKED |
| replay timing reconciled | PASS | replay/mismatch precedes mutable-state guard per Slice 8 plan |
| Case-version semantics reconciled | PASS | locked current revision; Safety winner makes later write held/stale |
| read-only formulation blocked solely by Safety | FAIL | not ordinary progression |
| Slice 8 spec modified by Slice 9 | FAIL | prohibited |
| Slice 8 runtime duplicated in Slice 9 | FAIL | prohibited |

## O. Migration coordination

| Check | Status | Evidence / Decision |
|---|---|---|
| main latest migration set re-read | PASS | through 007 |
| Slice 8 provisional migration identified | PASS | 008_problem_formulation_core.sql |
| Slice 9 provisional filename fixed only as planning hint | PASS | 009_safety_hold_control_foundation.sql |
| migration number treated as frozen product contract | FAIL | prohibited |
| shared CHECK rewrite collision recognized | PASS | case events/audit/idempotency |
| second merging branch must rebase/re-author whitelist | PASS | explicit mechanical rule |
| stale 007 whitelist may overwrite first merged Slice | FAIL | prohibited |
| fresh/upgrade/replay evidence required | PASS | explicit |

## P. Testing and acceptance

| Check | Status | Evidence / Decision |
|---|---|---|
| Unit test plan complete | PASS | determinism/guard/transitions/errors |
| Integration plan complete | PASS | Enter/block/Switch/Resolve/idempotency/stale |
| DB plan complete | PASS | atomicity/RLS/concurrency/trace |
| Case-updated then Risk-insert-fails injection | PASS | required |
| Risk-inserted then audit-fails injection | PASS | required |
| two concurrent Enter | PASS | required |
| two concurrent Resolve | PASS | required |
| stale precheck N -> N+1 | PASS | required |
| static unique-exit verification | PASS | required |
| no-public-route verification | PASS | required |
| acceptance scenarios mechanically mapped | PASS | plan §23 + Appendix A |

## Q. Scope and governance

| Check | Status | Evidence / Decision |
|---|---|---|
| professional Safety content planned | FAIL | prohibited |
| support resources/hotline planned | FAIL | prohibited |
| Referral planned | FAIL | prohibited |
| staff queue/operations UI planned | FAIL | prohibited |
| Alibaba Guardrails planned | FAIL | prohibited |
| AI risk_review runtime planned | FAIL | prohibited |
| Digital Use/Scene planned | FAIL | prohibited |
| Goal/Plan/Task planned | FAIL | prohibited |
| Problem Formulation runtime planned here | FAIL | prohibited |
| static `safety_states` guard retained | PASS | must stay |
| Docs modification required | N/A | none |
| frozen spec modification required | N/A | none |
| CI/spec governance baseline understood | PASS | CI + Spec Governance re-read |
| full-regression closeout defined | PASS | T920 |

---

# Audit 1 readiness result

The current-main deficiencies in Drizzle implementation are explicitly owned by T902 and have a bounded implementation path; they are not hidden or waived.

All product, state, authorization, transaction, migration, parallel-Slice and test decisions needed by a Development AI are explicit.

- CRITICAL findings: 0
- HIGH findings: 0
- MEDIUM findings: 0
- LOW findings: 0

**PRE-DEVELOPMENT CHECKLIST: PASS**

**READY FOR DEVELOPMENT, subject to the development-start revalidation gates in plan.md §24 and tasks.md T901.**
