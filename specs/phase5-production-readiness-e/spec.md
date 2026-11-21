# Phase 5 / Production Readiness E — Specification

## Upstream Traceability

- [V1 Product Requirements V1-C10 and V1-C11](../../Docs/V1产品需求.md) define the non-functional production integrity, high availability, fail-closed operational baseline, secure environment configuration, and strict isolation preventing test pollution or synthetic bypasses from contaminating production execution.
- [V1 Product Requirements V1-C24 and V1-C25](../../Docs/V1产品需求.md) mandate deterministic, fail-closed boundary enforcement, separation of authority, and strict resistance to identity or context spoofing at ingress and network boundaries.
- [V1 Product Requirements V1-X14](../../Docs/V1产品需求.md) require operational runtime checks to verify only real, verified production capabilities, forbidding unverified runtime assumptions or silent defaults.
- [V1 Technical Design §6.6 and §40](../../Docs/V1技术设计.md) establish the frozen technical baseline for runtime environment validation (fail-fast on missing/invalid configuration), production containerization hygiene (non-root execution, explicit `/healthz` probe), reverse proxy trust boundaries, and request rate-limiting protection against denial-of-service and brute-force abuse.

## Scope

This specification establishes the production readiness governance baseline for Phase 5 / E across four core engineering dimensions (E1–E4). Engineering implementation details (specific compiler binaries, base image tags, database engine releases, or numerical rate limit thresholds) are deployment choices governed by technical design and operational requirements, not fabricated as product authority.

### In Scope

- **E1: Runtime and Tooling Boundary**: Clear decoupling between workspace tooling and production runtime:
  - Bun is designated exclusively as the workspace package management and build tooling engine;
  - Node.js is designated as the production server runtime engine executing compiled distribution bundles;
  - Frozen package lockfile and deterministic build artifact generation.
- **E2: Deployment Containerization and Health Check**:
  - Multi-stage container build cleanly separating build tooling/devDependencies from the lean runtime container;
  - Least-privilege container execution enforcing non-root user (`USER node`);
  - Unauthenticated `/healthz` liveness probe endpoint exempt from rate limits and authentication for container orchestrator health checks.
- **E3: Rate Limiting and Proxy Trust Hardening**:
  - Explicit reverse proxy trust configuration: fail-safe parsing accepting only explicit CIDR/IP allowlists, strictly rejecting wildcard (`true`) or arbitrary integer hop-count bypasses to prevent client IP spoofing;
  - Global tiered rate-limiting baseline across standard API endpoints;
  - Stricter dedicated rate-limiting tier on sensitive unauthenticated entry points (e.g. WeChat login `/api/v1/auth/wechat`);
  - Standardized RFC-compliant 429 `RATE_LIMITED` error envelope with deterministic error code and message.
- **E4: Runtime / Typed Data / Time Boundary Reconciliation**:
  - Runtime environment fail-fast contract (`loadRuntimeConfig`) validating required configuration, secrets, and integer boundaries prior to HTTP server binding;
  - **Audit-first** reconciliation: systematically auditing typed schemas between Drizzle ORM models, domain interfaces, and PostgreSQL catalog definitions;
  - **Audit-first** time-boundary reconciliation across client ISO strings, server UTC handling, and database `timestamptz` storage;
  - Strict preservation: zero code modification to database schemas or domain mappings unless a concrete type mismatch or runtime bug is proven by fresh evidence.

### Out of Scope

- Modifying existing product semantics, business rules, canonical user flows, or authority boundaries (e.g. C2, C3, D6);
- Introducing external reverse proxies, API gateways, CDN edge workers, or cloud load-balancer configs into the application codebase;
- Creating new database tables, enum types, or migrations unless directly required to fix a proven E4 typed data mismatch;
- Weakening authorization, consent, safety prechecks, or role verification for operational convenience.

## Requirements

| Requirement | Contract |
| :--- | :--- |
| **E-01** | **Runtime and Tooling Decoupling (E1)**: The build pipeline must enforce Bun as the package manager and bundler, while Node.js remains the sole production container server execution runtime. Compiled server artifacts must run cleanly in the Node.js runtime without dependency on Bun at container execution time. |
| **E-02** | **Container Security & Health Contract (E2)**: Container images must execute under an unprivileged user (`node`). The `/healthz` route must remain unauthenticated, return 200 OK with `{"status":"ok"}`, and be exempt from rate limiting to satisfy orchestrator health monitoring. |
| **E-03** | **Proxy Trust Ingress Boundary (E3)**: `TRUST_PROXY` configuration must resolve only to explicit IP or CIDR allowlists. Wildcard trust (`true`), missing configuration, or arbitrary numeric hop counts must resolve to `false` (untrusted), preventing `X-Forwarded-For` header spoofing. |
| **E-04** | **Tiered Rate Limiting and 429 Contract (E3)**: The API server must enforce Fastify-level request rate limiting with a global threshold and a dedicated stricter threshold for authentication endpoints. Rate limit exhaustion must deterministically emit HTTP 429 with `{ "code": "RATE_LIMITED", "message": "Rate limit exceeded" }`. |
| **E-05** | **Runtime Configuration Fail-Fast Validation (E4)**: `loadRuntimeConfig` must strictly validate all required environment variables, secrets, and timing parameters at process boot. Any invalid or missing variable must abort startup before route registration. |
| **E-06** | **Typed Data and Time Boundary Integrity (E4)**: The codebase must maintain strict consistency across Drizzle ORM typed schemas, domain types, and PostgreSQL catalog columns/enums, and ensure deterministic UTC time boundaries. Changes to existing types or schemas are permitted only upon audit-first demonstration of a real bug or mismatch. |

## Acceptance Scenarios

- **E1 Tooling and Runtime Separation**: A compiled build of the server distribution executes successfully on pure Node.js in the runner container without invoking or bundling the Bun runtime binary.
- **E2 Container Security and Liveness**: The container image runs as user `node` (UID 1000). Querying `/healthz` returns HTTP 200 OK with `{"status":"ok"}` without requiring authentication or consuming rate limit tokens.
- **E3 Proxy Trust Ingress Enforcement**: When `TRUST_PROXY` is empty, `"false"`, `"true"`, or numeric, untrusted `X-Forwarded-For` headers are ignored and the immediate socket address is used. Only valid CIDR/IP allowlists permit forwarding client IP.
- **E3 Tiered Rate Limiting**: Sending requests exceeding the global or auth limit triggers an immediate HTTP 429 `RATE_LIMITED` response with appropriate headers, while `/healthz` remains unblocked.
- **E4 Runtime Config Fail-Fast**: Omitting any required environment variable (e.g. `SESSION_SECRET`, `DATABASE_URL`) causes immediate process termination with a descriptive error code before listening on the port.
- **E4 Audit-First Type and Time Boundary**: Full static typechecks and schema reflection tests pass without unverified modifications to existing database schemas or domain contracts.

## Acceptance Evidence

Implementation PRs must provide automated test execution and logs proving:
1. Dockerfile builds cleanly and runs in containerized environments;
2. HTTP security boundary tests verifying `/healthz` unauthenticated 200 responses and exemption from rate limits;
3. Ingress tests proving rejection of spoofed `X-Forwarded-For` headers when `TRUST_PROXY` is disabled or malformed;
4. Rate limit threshold exhaustion tests verifying HTTP 429 `RATE_LIMITED` response body and headers;
5. Runtime modes smoke tests demonstrating fail-fast boot behavior on invalid configurations;
6. Full regression gates: `typecheck`, `guard:static`, `openapi:check`, `test`, `verify-all`, and `validate-change-governance` pass on exact candidate HEAD.
