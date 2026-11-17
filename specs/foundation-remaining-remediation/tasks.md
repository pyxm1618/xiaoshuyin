# Tasks: Foundation Remaining Remediation

- [x] T001 Converge guardian Consent current-head revoke and chain concurrency. [REQ:V1-C39,V1-X06] [VERIFY:real PostgreSQL stale/supersede/race/rollback tests]
- [x] T002 Make Consent grant/revoke audit atomic with authoritative mutation. [REQ:V1-C39,V1-X06] [VERIFY:integration audit + rollback tests]
- [x] T003 Reuse the race-safe Account owner for concurrent first login. [REQ:V1-C44,V1-X06] [VERIFY:concurrent HTTP integration test]
- [x] T004 Fail closed on missing/conflicting Integrated Triage priority truth. [REQ:V1-D02,V1-X05] [VERIFY:routing truth-table tests]
- [x] T005 Converge NOT_APPLICABLE unknown-like semantics across Evidence projections. [REQ:V1-X05,V1-X09] [VERIFY:Evidence/Problem Formulation/routing tests]
- [x] T006 Converge WAITING ordinary-progression authority in Common Core consumers. [REQ:V1-X09] [VERIFY:Common Core DB guard + Problem Formulation domain regression]
- [x] T007 Verify Evidence invalidation/review lifecycle re-reads authoritative current Evidence. [REQ:V1-X05,V1-X06] [VERIFY:PostgreSQL review-state integration counterfactual]
- [x] T008 Bind governance directly to the four authoritative Docs without runtime Markdown parsing. [REQ:V1-X09] [VERIFY:governance drift self-test]
- [x] T009 Complete reproducibility and evidence-based HTTP hardening assessment. [REQ:V1-X09] [VERIFY:exact PR CI and dependency/config evidence]
- [x] T010 Run final exact-head gates and prepare the independent-audit PR report. [REQ:V1-X06,V1-X09] [VERIFY:CI + Spec Governance exact final head]
