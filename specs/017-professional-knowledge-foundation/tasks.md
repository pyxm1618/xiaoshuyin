# Tasks — Slice 17 Current-Main Reconciliation and Final Closure

## Execution Rules

These are current closure/audit tasks, not a redesign backlog. No task authorizes RAG, later Slice work, Production Enablement, or merge.

## Frozen Spec Authority Map

| Task | Authority |
|---|---|
| T1701 | Current-main reconciliation / historical Frozen Spec provenance |
| T1702 | Professional Knowledge lifecycle and DB authority |
| T1703 | Reviewer / approval / release authority |
| T1704 | Family consumption / RLS / grants |
| T1705 | Reliability / idempotency / concurrency / audit |
| T1706 | Migration / Spec Governance / exact-head composition |

## Acceptance Evidence Contract

Every task is verified only by concrete repository tests, migration evidence, governance checks, or GitHub exact-head workflow evidence. Narrative completion alone is insufficient.

## T1701 — Current-Main Reconciliation

**Frozen Spec Authority:** Historical Slice 17 Frozen Spec + current Phase 2 main.

**Acceptance / Evidence Ownership:** Git merge-base/ahead-behind truth; exact PR delta; shared-vocabulary and migration-upgrade tests.

### Verification

Verify latest main is an ancestor of the exact PR head, behind=0, shared files retain Phase 2 and Slice 17 authority, and no unrelated domain is modified.

## T1702 — Lifecycle and Direct INSERT Authority

**Frozen Spec Authority:** lifecycle/publication separation; candidate-first fail-closed semantics.

**Acceptance / Evidence Ownership:** `db/migrations/027_professional_knowledge_insert_lifecycle_guard.sql`, `tests/professional-knowledge-audit2-remediation.integration.test.ts`, lifecycle/release DB tests.

### Verification

Direct runtime INSERT cannot create PUBLISHED/CURRENT/VALID, cannot preload Candidate as CURRENT/VALID, cannot start at non-initial revision, and the normal Candidate path remains usable.

## T1703 — Reviewer / Approval / Release Authority

**Frozen Spec Authority:** exact external approval + Staff Authority + qualification separation.

**Acceptance / Evidence Ownership:** `tests/professional-knowledge-phase2-authority.test.ts`, `tests/professional-knowledge-audit2-remediation.integration.test.ts`, release/reliability suites.

### Verification

Re-prove exact semantic approval binding, fail-closed time/qualification validation, reviewer Staff revoke/disable/expiry serialization, Scene exact binding, and distinct INVALID/UNAVAILABLE outcomes.

## T1704 — Family Consumption / RLS / Grants

**Frozen Spec Authority:** family consumption is downstream and purpose-bound; never Professional asset administration.

**Acceptance / Evidence Ownership:** `tests/professional-knowledge-consumption.integration.test.ts`, `tests/professional-knowledge-foundation-db.integration.test.ts`, `tests/db/rls.test.ts`.

### Verification

Only PUBLISHED/CURRENT/VALID assets can enter family consumption; wrong family/case/purpose remains non-enumerating; FORCE RLS and least-privilege grants remain intact.

## T1705 — Reliability / Idempotency / Concurrency / Audit

**Frozen Spec Authority:** exact replay, stale-writer rejection, atomicity, durable bounded audit.

**Acceptance / Evidence Ownership:** reliability, mutation, audit-readback, dependency-propagation, and audit2 remediation suites.

### Verification

Same-key replay is stable, mismatched replay conflicts, concurrent authority/lifecycle mutation cannot last-write-win, success and denial audit semantics remain bounded and deterministic.

## T1706 — Migration / Governance / Final Composition

**Frozen Spec Authority:** forward-only migrations, current repository governance, independent final audit boundary.

**Acceptance / Evidence Ownership:** `tests/db/migration-repro.test.ts`, upgrade suites, Spec Governance, GitHub exact-head CI, final remote read-back.

### Verification

Prove complete-filename migration identity/order/checksum, clean + upgrade equivalence, exactly one current change-binding, registered implementation ownership, exact-head CI PASS, current-main composition PASS, no Phase 2 regression, and Head Drift NO.
