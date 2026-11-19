# Common Core Goal / ConfirmGoal Runtime — Pre-Development Checklist

## Authority / Scope

- [x] Current main Authority re-read: Goal Contract, §6.7, §7.3, §12.3B.6, §28.3 and Phase 4.
- [x] Authority Phase identified as `Phase 4 — Execution Closure / 执行闭环`.
- [x] Early prerequisite is limited to enabling the current Phase 3 T1 canonical deterministic E2E to use the real `GOALS -> ConfirmGoal -> PLANNING` path; it does not start full Phase 4.
- [x] `ConfirmGoal` is the only formal GOALS -> PLANNING command.
- [x] A2010 solution-stage prerequisite must be COMPLETED before `ConfirmGoal`.
- [x] A2010 is eligibility only and not a phase writer.
- [x] `ConfirmGoal` must re-check current primary / advancement authority even when Goal creation previously passed primary.
- [x] Scene runtime is not a phase writer.
- [x] Plan / Intervention / Review runtime is out of scope.
- [x] Authority Docs remain unchanged.

## Governance

- [x] `.specify/implementation-ownership.json` currently has no Goal runtime owner on main.
- [x] Change-governance validator forbids ownership-registry + product implementation in the same PR.
- [x] Therefore production coding is blocked until this prerequisite lands.
- [x] `packages/authorization/src/authorize.ts` is registered as SHARED composition with a finite feature allowlist.
- [x] `packages/domain/src/index.ts` is registered as SHARED composition with a finite feature allowlist.
- [x] `packages/generated/openapi.json` and `packages/generated/openapi.d.ts` are registered as SHARED generated outputs consistent with the OpenAPI composition allowlist.
- [x] No error-handler/contracts ownership is pre-authorized; runtime must reuse existing public error contracts or stop for a separate minimal prerequisite if they prove insufficient.
- [ ] After this prerequisite merges, re-read latest main and open any required Authority Unit topology prerequisite separately; Authority Unit registry changes cannot coexist with a feature spec or production implementation.
- [ ] Only then create the runtime branch from the new latest main.

## Planned Runtime Evidence

- [ ] Goal persistence integrity / RLS / family isolation.
- [ ] Goal contract validation.
- [ ] current confirmed Problem Formulation binding.
- [ ] A2010 COMPLETED prerequisite.
- [ ] A2010 incomplete rejection with Case remaining GOALS.
- [ ] primary/advancement eligibility re-check at ConfirmGoal and changed-primary rejection.
- [ ] Authorization gate.
- [ ] Consent gate.
- [ ] Safety gate.
- [ ] Compliance gate.
- [ ] stale formulation rejection.
- [ ] wrong phase rejection.
- [ ] duplicate ConfirmGoal convergence.
- [ ] concurrent ConfirmGoal convergence.
- [ ] atomic confirmation + GOALS -> PLANNING.
- [ ] static proof that A2010 cannot directly write PLANNING.
- [ ] integration path through A2003-A2010 without administrator SQL phase write.
- [ ] generated OpenAPI artifacts synchronized with the source projection.
- [ ] Contract / Static / Migration / Unit / Integration / Spec Governance / verify-all PASS.
