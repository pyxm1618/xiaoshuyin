# Checklist: Common Core Goal / ConfirmGoal Runtime Prerequisite

## Authority and scope

- [x] Current Product Goal Contract identified.
- [x] Current Technical `GOALS --ConfirmGoal--> PLANNING` contract identified.
- [x] A2010 confirmed as eligibility-only, not a phase writer.
- [x] Scene runtime confirmed as non-owner of Case phase.
- [x] Plan / Intervention / Review runtime excluded.
- [x] PR #70 remains downstream and untouched.
- [x] Authority Docs remain unchanged.

## Ownership and governance

- [x] Current implementation ownership registry inspected.
- [x] No existing Goal production owner exists.
- [x] Repository validator forbids ownership self-authorization in an implementation PR.
- [x] Planned Goal domain/service/route/authorization/composition/migration paths are finite and pre-registered in this prerequisite.
- [ ] Authority Unit registry topology, if required, must be registered in a separate governance-only PR after this spec exists on main.
- [ ] Production implementation may start only from then-current main after topology prerequisites merge.

## Runtime contract to prove later

- [ ] Goal persistence integrity.
- [ ] Goal completeness validation.
- [ ] current confirmed/current Problem Formulation binding.
- [ ] Authorization gate.
- [ ] Consent gate.
- [ ] Safety gate.
- [ ] Compliance gate.
- [ ] stale formulation protection.
- [ ] duplicate ConfirmGoal protection.
- [ ] concurrent ConfirmGoal convergence.
- [ ] atomic Goal confirmation + GOALS → PLANNING.
- [ ] family/case RLS isolation.
- [ ] no admin SQL phase fabrication.
