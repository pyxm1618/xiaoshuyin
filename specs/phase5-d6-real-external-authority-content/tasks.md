# Phase 5 / D6 — Implementation Tasks

All tasks are pending implementation. Execution proceeds in dependency order after this governance prerequisite lands. Requirement IDs map to the frozen specifications in [spec.md](spec.md).

> **Real Authority Semantic Contract**:
> Tasks T002–T007 must resolve the external authoritative source first.
> - If a real, verified, approved authoritative source exists: integrate it into the existing frozen seam.
> - If the authoritative source does not exist: preserve `UNAVAILABLE / MISSING / HOLD / FAIL-CLOSED`.
> AI developers must not create a second authority store, invent a reviewer, manufacture credentials, forge approval records, synthesize safety rules, or invent professional roleplay content.
> If code integration is complete but real-world authority remains missing, the final outcome `CODE INTEGRATION: READY` with `REAL EXTERNAL AUTHORITY: MISSING` and `D6 NOT CLOSED` is the expected, correct, and authoritative result—not an implementation failure.

- [ ] T001 Reconcile main authority seams, external authority sources, and registered ownership paths. [REQ:D6-01,D6-03,D6-06,D6-07] [VERIFY:main baseline recorded, seam boundaries verified, zero unauthorized paths]
- [ ] T002 Resolve authoritative Safety source first; if present wire deterministic evaluation into SafetyProductionAuthorityProvider, and if absent preserve UNAVAILABLE fail-closed without inventing safety rules. [REQ:D6-01,D6-02] [VERIFY:deterministic evaluation when asset present, UNAVAILABLE when missing, identity drift triggers SAFETY_PRECHECK_STALE]
- [ ] T003 Resolve authoritative professional qualification source first; if present verify scope and validity window, and if absent preserve UNASSIGNED fail-closed without manufacturing reviewer credentials. [REQ:D6-03] [VERIFY:verified qualification resolves, unassigned reviewer returns UNAVAILABLE, expired credential returns INVALID]
- [ ] T004 Resolve authoritative professional approval source first; if present bind to immutable content/source hashes, and if absent preserve MISSING fail-closed without forging approval records or second ledgers. [REQ:D6-04] [VERIFY:exact content hash match resolves proof, content drift returns INVALID, missing approval returns UNAVAILABLE]
- [ ] T005 Resolve published approved professional knowledge first; if present wire into Scene package bindings, and if absent preserve empty baseline fail-closed without binding unapproved or synthetic content. [REQ:D6-04,D6-05] [VERIFY:published approved knowledge consumable via existing Family/Case/Consent gates, empty baseline preserved when absent]
- [ ] T006 Resolve approved A4003 professional content and model/prompt authorities first; if present bind to seams, and if absent preserve MISSING unavailable state without inventing roleplay content. [REQ:D6-06,D6-07] [VERIFY:approved content and model/prompt references verified when present, missing authority returns unavailable]
- [ ] T007 Wire narrow A4003 production roleplay adapter ensuring unavailable dependencies hold progression and minor actors are blocked without canned AI responses. [REQ:D6-07,D6-08] [VERIFY:isAvailable true only when all authorities present, unavailable dependencies hold progression, minor actors blocked per Compliance]
- [ ] T008 Wire production composition in app builder and audit against test fixtures and fake authority shortcuts. [REQ:D6-01,D6-05,D6-08] [VERIFY:production buildApp binds verified seams, zero imports from tests/fixtures, zero approved=true bypasses]
- [ ] T009 Run targeted fail-closed security matrix and consumer regression suites. [REQ:D6-01,D6-02,D6-03,D6-04,D6-05,D6-06,D6-07,D6-08] [VERIFY:Safety C2, Staff C3, Slice 16, Slice 17, and Digital Use regression suites pass]
- [ ] T010 Execute full verification suite and Spec Governance gate closeout documenting exact real-world authority status. [REQ:D6-01,D6-02,D6-03,D6-04,D6-05,D6-06,D6-07,D6-08] [VERIFY:Contract, Static Checks, DB Migration, Unit Tests, Integration Tests, Verify-All, and Spec Governance pass on candidate HEAD]
