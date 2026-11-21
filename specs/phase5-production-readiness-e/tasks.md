# Phase 5 / Production Readiness E — Tasks

All tasks are pending implementation. Execution proceeds in dependency order following the approval of this governance prerequisite. Requirement IDs map to [spec.md](spec.md).

- [ ] T001 Implement runtime config parsing and fail-fast environment validation at process boot. [REQ:E-05] [VERIFY:loadRuntimeConfig throws RUNTIME_ENV_INVALID on missing/invalid vars before route registration]
- [ ] T002 Implement proxy trust allowlist parser and fail-closed ingress validation. [REQ:E-03] [VERIFY:parseTrustProxy rejects wildcard true and numeric hops, accepts explicit CIDR/IP allowlist]
- [ ] T003 Wire Fastify rate limiting plugin baseline with dedicated auth tier and healthz exemption. [REQ:E-04] [VERIFY:global rate limit applies, auth route enforces stricter tier, healthz remains unconstrained]
- [ ] T004 Update API error handler to map 429 rate limit exceptions to standard RATE_LIMITED response. [REQ:E-04] [VERIFY:errorHandler emits 429 status with code RATE_LIMITED and expected error envelope]
- [ ] T005 Create multi-stage production Dockerfile decoupling Bun builder from Node.js unprivileged runner. [REQ:E-01,E-02] [VERIFY:container builds, executes under user node, and healthcheck succeeds on /healthz]
- [ ] T006 Conduct audit-first reconciliation across Drizzle ORM schemas, database catalog, and time boundaries. [REQ:E-06] [VERIFY:typecheck and schema tests pass, zero speculative migrations, UTC timestamp consistency verified]
- [ ] T007 Execute targeted HTTP security boundary and runtime modes smoke integration test suites. [REQ:E-01,E-02,E-03,E-04,E-05,E-06] [VERIFY:http-security-boundary and runtime-modes-smoke integration tests pass without regression]
- [ ] T008 Execute full repository verification gates and Spec Governance on candidate HEAD. [REQ:E-01,E-02,E-03,E-04,E-05,E-06] [VERIFY:Contract, Static Checks, DB Migration, Unit Tests, Integration Tests, Verify-All, and Spec Governance pass]
