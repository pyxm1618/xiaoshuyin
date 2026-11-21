# Phase 5 / Production Readiness E — Implementation Plan

## Upstream Traceability

Trace to Technical Design §40 (Infrastructure / Security and Platform production consistency principles) as the authoritative upstream basis, with V1-C24, V1-C25, and V1-X14 preserving existing AI/Safety boundaries and forbidding unverified runtime capability claims. Specific implementation mechanisms (Bun build tooling, Node.js 26.13.1 pinning, multi-stage Docker, non-root user, explicit IP/CIDR proxy trust, Fastify rate limiting, and 429 payload envelope) are designated as engineering controls rather than product authority, implemented across requirements E-01 to E-06 in [spec.md](spec.md). Preserve all existing domain, safety, compliance, consent, and role authorization contracts.

## Constitution Check

### Architectural Seams and Boundary Contracts

1. **Tooling vs. Runtime Boundary (E1)**:
   - Tooling engine: Bun is used strictly for dependency management, workspace orchestration, and bundling (`bun build`).
   - Production engine: Node.js is the sole production container server execution runtime. The compiled bundle must be a self-contained Node.js ESM distribution executable without Bun runtime dependencies.
2. **Deployment and Container Boundary (E2)**:
   - Multi-stage Docker build separating the build environment from the final execution environment.
   - Non-root user execution (`USER node`) enforced in the runner stage.
   - The `/healthz` endpoint is reserved strictly as an operational probe, returning static `{ "status": "ok" }` without database querying, authentication, or rate limiting.
3. **Network Ingress and Abuse Prevention Boundary (E3)**:
   - Reverse proxy trust (`trustProxy`) configuration is restricted to explicit CIDR/IP allowlists. Wildcards and raw integer hops are rejected fail-closed to prevent `X-Forwarded-For` spoofing.
   - Rate limiting is integrated directly into the Fastify pipeline with a global limit and a stricter limit for authentication routes (`/api/v1/auth/wechat`), emitting consistent 429 `RATE_LIMITED` error bodies.
4. **Data Typing and Time Boundary Audit-First Integrity (E4)**:
   - Fail-fast environment parsing via `loadRuntimeConfig` validating all required variables at process boot before listening on network sockets.
   - Audit-first discipline: systematically verify that Drizzle ORM schemas accurately reflect PostgreSQL database catalog definitions, and that ISO timestamp boundaries are preserved consistently in UTC. No speculative schema migrations or domain type changes are permitted unless a real bug or mismatch is established.
5. **Ownership and Scope Containment**:
   - Production changes are strictly confined to the minimal necessary registered paths:
     - `apps/server/api/src/app.ts` (shared composition)
     - `apps/server/api/Dockerfile`
     - `apps/server/api/package.json`
     - `apps/server/api/src/plugins/error-handler.ts`
     - `apps/server/api/src/routes/auth.ts`
     - `apps/server/api/src/runtime-env.ts`
   - No broad prefixes such as `apps/server/api/` are introduced.

## Verification Plan

The implementation must be verified via:
1. Containerization verification: building `apps/server/api/Dockerfile` and validating execution under user `node`;
2. Integration testing for `/healthz` unauthenticated response and rate-limit exemption;
3. Ingress tests asserting rejection of spoofed `X-Forwarded-For` headers under disabled/invalid `TRUST_PROXY`;
4. Rate limiting unit and integration tests confirming HTTP 429 `RATE_LIMITED` responses upon threshold exhaustion;
5. Runtime modes smoke tests ensuring fail-fast startup on missing or invalid environment variables;
6. Full regression gates: `typecheck`, `guard:static`, `openapi:check`, `test`, `verify-all`, and `validate-change-governance`.
