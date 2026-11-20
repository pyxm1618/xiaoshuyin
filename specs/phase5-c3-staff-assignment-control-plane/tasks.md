# Phase 5 / C3 — Implementation Tasks

All tasks are pending. Execute in order after this governance prerequisite lands. Requirement IDs map to the frozen sources in [spec.md](spec.md).

- [ ] T001 Reconcile current main authority, consumers, migration numbering and ownership. [REQ:C3-01,C3-02,C3-07,C3-09] [VERIFY:main, DB roles, authority graph, consumers and ownership recorded]
- [ ] T002 Add narrowly executable DB primitives and preserve existing RLS, graph and trigger constraints. [REQ:C3-02,C3-03,C3-04,C3-05,C3-08,C3-09] [VERIFY:migration applies and direct runtime mutation is denied]
- [ ] T003 Compose internal commands with current SERVICE_CONTROL and enforce no self-escalation. [REQ:C3-01,C3-09] [VERIFY:operator, ordinary Staff, Family user, inactive actor and self-escalation cases]
- [ ] T004 Implement bounded grant with exact identity, capability, scope, validity and parent validation. [REQ:C3-02,C3-03] [VERIFY:GLOBAL and CASE grant read-back, duplicate policy and rejection cases]
- [ ] T005 Implement durable revoke with historical retention. [REQ:C3-04] [VERIFY:stable repeated revoke, expired target and parent revocation invalidates child]
- [ ] T006 Implement controlled current-state read. [REQ:C3-01,C3-05] [VERIFY:identity and Case queries, parent link, active, revoked, expired, future, disabled and invalid parent]
- [ ] T007 Couple grant/revoke to durable Business Audit within each command transaction. [REQ:C3-06,C3-08] [VERIFY:actor, target, scope, linkage and exactly-once audit evidence]
- [ ] T008 Verify Safety, Intervention and Professional Knowledge with production authority seams. [REQ:C3-07] [VERIFY:grant and revoke visibility and independent qualification and approval gates]
- [ ] T009 Verify replay, conflicts, rollback and concurrent consumer decisions. [REQ:C3-06,C3-08] [VERIFY:exact replay, payload mismatch, forced rollback and AUTH_ACCOUNT/AUTH_ROW order]
- [ ] T010 Run full regressions and governance closeout. [REQ:C3-01,C3-02,C3-03,C3-04,C3-05,C3-06,C3-07,C3-08,C3-09] [VERIFY:Contract, Static Checks, DB Migration, Unit Tests, Integration Tests, Verify-All and Spec Governance]
