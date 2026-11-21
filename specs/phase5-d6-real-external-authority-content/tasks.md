# Phase 5 / D6 — Implementation Tasks

All tasks are pending implementation. Execution proceeds in dependency order after this governance prerequisite lands. Requirement IDs map to the frozen specifications in [spec.md](spec.md).

- [ ] T001 Reconcile main authority seams, external authority sources, and registered ownership paths. [REQ:D6-01,D6-03,D6-06,D6-07] [VERIFY:main baseline recorded, seam boundaries verified, zero unauthorized paths]
- [ ] T002 Implement verified Safety production authority provider with exact version binding and identity drift precheck. [REQ:D6-01,D6-02] [VERIFY:valid policy identity ALLOW/HOLD evaluation, missing asset UNAVAILABLE, and identity drift precheck stale failure]
- [ ] T003 Implement external professional qualification provider verification with scope and validity checking. [REQ:D6-03] [VERIFY:verified reviewer qualification resolves, unassigned reviewer returns UNAVAILABLE, and expired credential returns INVALID]
- [ ] T004 Implement external professional approval provider verification bound to immutable content and source hashes. [REQ:D6-04] [VERIFY:exact content hash match resolves proof, content drift returns INVALID, and revoked approval returns UNAVAILABLE]
- [ ] T005 Wire verified professional knowledge releases into Scene package bindings and validate consumption gates. [REQ:D6-04,D6-05] [VERIFY:published current knowledge consumable via existing Family/Case/Consent gates, empty binding fallback preserved]
- [ ] T006 Implement A4003 professional content authority and model/prompt authority resolution. [REQ:D6-06,D6-07] [VERIFY:approved content and model/prompt references verified, missing authority returns unavailable]
- [ ] T007 Implement narrow A4003 production roleplay adapter with availability gating and recoverable progression hold. [REQ:D6-07,D6-08] [VERIFY:isAvailable true when all authorities present, unavailable holds A4003 progression, minor actors blocked per Compliance]
- [ ] T008 Wire production composition in app builder and audit against test fixtures and fake authority shortcuts. [REQ:D6-01,D6-05,D6-08] [VERIFY:production buildApp binds verified seams, zero imports from tests/fixtures, zero approved=true bypasses]
- [ ] T009 Run targeted fail-closed security matrix and consumer regression suites. [REQ:D6-01,D6-02,D6-03,D6-04,D6-05,D6-06,D6-07,D6-08] [VERIFY:Safety C2, Staff C3, Slice 16, Slice 17, and Digital Use regression suites pass]
- [ ] T010 Execute full verification suite and Spec Governance gate closeout. [REQ:D6-01,D6-02,D6-03,D6-04,D6-05,D6-06,D6-07,D6-08] [VERIFY:Contract, Static Checks, DB Migration, Unit Tests, Integration Tests, Verify-All, and Spec Governance pass on candidate HEAD]
