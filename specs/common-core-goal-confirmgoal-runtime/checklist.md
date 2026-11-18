# Common Core Goal / ConfirmGoal Runtime — Pre-Development Checklist

## Authority / Scope

- [x] Current main Authority re-read: Goal Contract, §6.7, §7.3, §12.3B.6, §28.3.
- [x] `ConfirmGoal` is the only formal GOALS -> PLANNING command.
- [x] A2010 is eligibility only and not a phase writer.
- [x] Scene runtime is not a phase writer.
- [x] Plan / Intervention / Review runtime is out of scope.
- [x] Authority Docs remain unchanged.

## Governance

- [x] `.specify/implementation-ownership.json` currently has no Goal runtime owner.
- [x] Change-governance validator forbids ownership-registry + product implementation in the same PR.
- [x] Therefore production coding is blocked until this prerequisite lands.
- [ ] After this prerequisite merges, re-read latest main and open any required Authority Unit topology prerequisite separately; Authority Unit registry changes cannot coexist with a feature spec or production implementation.
- [ ] Only then create the runtime branch from the new latest main.

## Planned Runtime Evidence

- [ ] Goal persistence integrity / RLS / family isolation.
- [ ] Goal contract validation.
- [ ] current confirmed Problem Formulation binding.
- [ ] Authorization gate.
- [ ] Consent gate.
- [ ] Safety gate.
- [ ] Compliance gate.
- [ ] stale formulation rejection.
- [ ] wrong phase rejection.
- [ ] duplicate ConfirmGoal convergence.
- [ ] concurrent ConfirmGoal convergence.
- [ ] atomic confirmation + GOALS -> PLANNING.
- [ ] integration path without admin SQL phase write.
- [ ] Contract / Static / Migration / Unit / Integration / Spec Governance / verify-all PASS.
