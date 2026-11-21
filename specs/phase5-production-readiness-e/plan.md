# Phase 5 / Production Readiness E — Implementation Plan

## Upstream Traceability

Trace to Docs/总体技术架构.md §8.3, §18A (§18A.1, §18A.3, §18A.4) and Docs/V1技术设计.md §4, §4.0A, §4.1, §4.3, Phase 5, §31A, and §40 through requirements E-01 to E-06 in [spec.md](spec.md). Preserve all existing domain, safety, compliance, consent, and role authorization contracts.

## Constitution Check

### Architectural Seams and Boundary Contracts

1. **Tooling vs. Runtime Boundary (E1)**:
   - Frozen Authority: Production execution runtime is strictly Node.js 26 LTS under ESM, with Fastify 5 stable line, and locked exact dependency resolution.
   - Engineering Choice: Bun is the repository workspace package manager and build tooling engine (`bun build`). Build artifacts must be standalone ESM distributions executable by Node.js without runtime dependency on Bun.
2. **Deployment and Container Boundary (E2)**:
   - Frozen Authority: Controlled, portable Docker image adhering to §4.0A Migration Portability Contracts across Stage A, Stage B, and Stage C. Secrets must never be included in images. Existing unauthenticated `/healthz` endpoint returning static `{"status":"ok"}` is preserved for operational liveness probes.
   - Engineering Choice: Multi-stage Docker build separating build dependencies from runtime image, and non-root execution (`USER node`) are candidate engineering implementations to achieve least privilege and minimal image size.
3. **Production Ingress / Abuse Protection Reconciliation Boundary (E3, Topology-First)**:
   - Frozen Authority: Production ingress must prevent untrusted clients from spoofing authoritative client IP addresses via `X-Forwarded-For`. Abuse and brute-force mitigation must be adequate for the verified deployment topology. Operational controls must never weaken business authorization, compliance, or Safety gates, and health probes must remain operational.
   - Reconciliation Discipline: Prioritize topology verification (Stage B Lighthouse vs Stage C CloudBase Run, reverse proxy / ingress gateway behavior, existing platform/CDN protection). Respect the repository's deliberate prior decision deferring global application rate limiting until proxy/IP authority is verified.
   - Allowed Outcomes: E3 implementation must permit classifying outcomes as `ALREADY SUFFICIENT`, `DEPLOYMENT TOPOLOGY DECISION REQUIRED`, or `TARGETED APPLICATION REMEDIATION REQUIRED`. Neither a specific parser (e.g. CIDR-only) nor a mandatory Fastify rate limiting plugin is prematurely frozen as normative authority.
4. **Data Typing and Time Boundary Audit-First Integrity (E4)**:
   - Audit-first discipline: Systematically audit `loadRuntimeConfig` and startup sequence for fail-fast termination on missing critical parameters (such as `DATABASE_URL`).
   - Schema and Time Audit: Systematically audit Drizzle ORM schemas against PostgreSQL catalog definitions, and verify consistent UTC timestamp handling. No speculative schema migrations or domain type modifications are permitted without fresh proof of a concrete bug.
5. **Ownership and Scope Containment**:
   - Production path registrations for Phase 5 / E are strictly limited to:
     - `apps/server/api/src/app.ts` (EXACT / SHARED — added as participant; all existing owners preserved)
     - `apps/server/api/Dockerfile` (EXACT / FEATURE — owned by `phase5-production-readiness-e`)
   - Explicitly unowned historical paths (no pre-emptive E ownership granted):
     - `apps/server/api/package.json`
     - `apps/server/api/src/plugins/error-handler.ts`
     - `apps/server/api/src/routes/auth.ts`
     - `apps/server/api/src/runtime-env.ts`
   - No broad prefixes (e.g. `apps/server/api/`) are claimed.
   - **Future Unowned Path Rule**: If the E implementation audit proves that modifying any unowned file is strictly necessary, implementation must stop and an independent, minimal, governance-only prerequisite PR must be reviewed and merged before proceeding.

## Verification Plan

The implementation must be verified via:
1. Containerization verification: building `apps/server/api/Dockerfile` and validating execution under Node.js runtime with zero secret exposure;
2. Integration verification asserting `/healthz` returns unauthenticated 200 OK `{"status":"ok"}`;
3. E3 topology reconciliation verification: evaluating client IP derivation and `X-Forwarded-For` spoofing resistance against verified deployment topologies, documenting the outcome (`ALREADY SUFFICIENT`, `DEPLOYMENT TOPOLOGY DECISION REQUIRED`, or `TARGETED APPLICATION REMEDIATION REQUIRED`);
4. E4 audit-first verification: documenting startup config validation, Drizzle ORM to PostgreSQL catalog consistency, and UTC timestamp handling;
5. Targeted remediation verification: if and only if targeted remediations are approved by E3/E4 audit, verifying those specific fixes without collateral regressions;
6. Full regression gates: `typecheck`, `guard:static`, `openapi:check`, `test`, `verify-all`, and `validate-change-governance` pass on exact candidate HEAD.
