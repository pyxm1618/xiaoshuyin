# Slice 19 — Current-Main Governance Planning Reconciliation

> Feature: `019-professional-retrieval-pgvector-readiness`  
> Repository: `pyxm1618/xiaoshuyin`  
> Reconciled baseline: `main@d4a01d88366b43f99778980623714b1b6099c4c8`  
> Historical Spec: `9c02823268c564bde15bc7cd7caf76fa43164ca2` / blob `5bba922dbf93ed4f376d21f1a30124247b33f7fb`  
> Historical Planning Freeze: `a46cb8a9170bcfc253a6ad0d447ebc7dd5f31a05`  
> Status: GOVERNANCE PREREQUISITE ONLY / NO PRODUCT IMPLEMENTATION

## Upstream Traceability

- Authoritative: `Docs/总产品需求.md`, `Docs/V1产品需求.md`, `Docs/总体技术架构.md`, `Docs/V1技术设计.md` (unchanged).
- Technical V1 scope: PostgreSQL major 18, actual pgvector dense `vector` extension capability, synthetic insert/read/distance probes and exact environment-scoped evidence.
- Historical Frozen Spec FR-001–FR-040, AS-001–AS-030 and NS-01–NS-22 are preserved verbatim in the current canonical `spec.md`. This planning reconciliation does not change their responsibility.
- Historical plan/checklist/tasks from planning freeze `a46cb8a9170bcfc253a6ad0d447ebc7dd5f31a05` remain historical execution design evidence. They must be reconciled against this main before use; they are not mechanically copied into current `specs/`.

## Constitution Check

- **PASS — scope**: DB capability readiness only, not RAG, embedding, sparsevec, pg_jieba, Gold Dataset, Context Builder, AI Task Runtime or user-visible functionality.
- **PASS — owner separation**: no mutation to Slices 16/17/18, Professional Knowledge, professional-review authority or the four Authority Docs.
- **PASS — security boundary**: `db/init/01-roles.sh` is the current privileged initialization seam. Existing `xiaoshuyin_app` NOBYPASSRLS, schema-grant and RLS policies remain unchanged. Any future extension bootstrap must preserve least privilege.
- **PASS — repository rule**: `.specify/implementation-ownership.json` uses EXACT/PREFIX matchers and fail-closed lookup. The only newly registered production path is EXACT `db/init/02-pgvector.sh`.
- **PASS — PR separation**: registry governance plus spec/plan is allowed; registry governance plus product implementation or changed `.specify/change-bindings/*.json` is forbidden by current `validate-change-governance.mjs`.
- **NOT IMPLEMENTED**: this PR makes no runtime/CI pgvector changes and makes no readiness claim for Stage A/B/C.

## Current Repository Seams

| Concern | Current canonical location | This governance PR |
| --- | --- | --- |
| PostgreSQL 18 CI | `.github/workflows/ci.yml` | Read only; no image modification |
| Privileged role/bootstrap | `db/init/01-roles.sh` | Read only |
| New optional bootstrap | `db/init/02-pgvector.sh` | EXACT ownership only; file not created |
| Database roles / RLS | existing `db/` and tests | No grants, schema or migrations modified |
| Canonical verification | `scripts/verify-all.mjs` | Read only |
| Canonical static gate | `scripts/guard-static.mjs` | Read only |
| Change governance | `.specify/scripts/validate-change-governance.mjs` | Read only |
| Spec governance | `.specify/scripts/validate-governance.mjs` | Read only |
| Adversarial self-test | `.specify/scripts/tests/run-change-governance-tests.mjs` | Governance-only focused coverage |
| Spec Governance CI | `.github/workflows/spec-governance.yml` | Unchanged |

The historical PR #43 is donor-only: its code, assumptions and historical workflow are not authoritative current implementation or a merge candidate.

## Verification Plan

1. Check `main`, feature absence, registry rule uniqueness and exact historical Frozen Spec blob again before writing.
2. Verify canonical spec contains every preserved historical FR/AS/NS entry, recognized upstream/scope/acceptance/evidence sections, and no new technology decision.
3. Confirm registry `schemaVersion=1`, `resolution=LONGEST_MATCH`, exactly one `FEATURE` rule for `019-professional-retrieval-pgvector-readiness` on EXACT `db/init/02-pgvector.sh`.
4. Require positive authorization for `db/init/02-pgvector.sh` **after** registry merge and a correct future `FEATURE_IMPLEMENTATION` binding; require negative rejection of `db/init/unknown.sh`, unowned migrations and unrelated production paths.
5. Run `node .specify/scripts/validate-change-governance.mjs --base <base> --head HEAD`, `node .specify/scripts/validate-governance.mjs`, `node .specify/scripts/tests/run-governance-tests.mjs`, and `node .specify/scripts/tests/run-change-governance-tests.mjs` via existing Spec Governance CI.
6. Inspect PR exact-head CI and changed-file scope, then STOP at `READY FOR INDEPENDENT GOVERNANCE AUDIT`; final independent audit and merge are not part of this task.

## Developer Handoff Boundary

Only after this governance PR is independently audited and merged should a new developer PR, re-bound to then-current main, create `db/init/02-pgvector.sh` and any separately authorized exempt tooling/tests/CI changes. It must establish its own consuming binding, verify the current DB role/RLS contract, use real PostgreSQL 18 + pgvector, run canonical `verify-all`, and produce exact-head evidence. A historical plan entry does not override current ownership restrictions.

**GOVERNANCE PREREQUISITE != PRODUCT IMPLEMENTATION AUTHORIZATION IN THIS PR.**
