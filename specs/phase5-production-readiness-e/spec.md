# Phase 5 / Production Readiness E — Specification

## Upstream Traceability

- [Docs/总体技术架构.md §8.3 (当前 V1 调用层)](../../Docs/总体技术架构.md) establishes the frozen runtime baseline for V1 production: Node.js 26 LTS (frozen patch 26.13.0), pure ESM server architecture, Fastify 5 stable line (initial patch 5.12.8), and locked package resolution.
- [Docs/总体技术架构.md §18A (V1 分阶段部署与基础设施安全)](../../Docs/总体技术架构.md):
  - **§18A.1 部署阶段**: Establishes deployment stage progression from Stage A (Local/CI Docker Compose), Stage B (Early Pilot Lighthouse with private Docker network and isolated PostgreSQL 18), to Stage C (Managed Production CloudBase Run API/Worker with TencentDB for PostgreSQL 18);
  - **§18A.3 迁移友好开发合同**: Mandates the same controlled Docker build and portable Docker image across deployment stages, uniform `DATABASE_URL` and unified data layer access, zero dependency on single-machine private state (no local cron, shared memory, or in-process locks), and infrastructure-adapter abstraction for secrets, logging, and backups;
  - **§18A.4 Managed Production Secrets 与数据库加密**: Mandates secret injection boundaries (secrets never committed to repository, image, or documentation) and database least-privilege runtime roles.
- [Docs/V1技术设计.md §4 (部署形态) & §4.0A (Migration Portability Contract)](../../Docs/V1技术设计.md) freezes the modular monolith deployment architecture, portable Docker container images, uniform database access via `DATABASE_URL`, and clear separation between infrastructure configuration and application domain contracts.
- [Docs/V1技术设计.md §4.1 (Runtime baseline)](../../Docs/V1技术设计.md) freezes Node.js 26 LTS (26.13.0 baseline), ESM, Fastify 5 stable line (5.12.8 baseline), and exact lockfile resolution across CI, container images, Early Pilot, and Managed Production.
- [Docs/V1技术设计.md §4.3 (Phase-specific Security Baseline)](../../Docs/V1技术设计.md) defines security boundaries for Early Pilot (private Docker network, no public database port, secrets not in repo/image, runtime role `NOBYPASSRLS` and non-owner) and Managed Production (SSM/KMS secret injection, SSL/TLS, TDE).
- [Docs/V1技术设计.md Phase 5 (长期资料、安全运营与权利) & §31A (System Observability)](../../Docs/V1技术设计.md) define the Phase 5 infrastructure reconciliation scope and operational observability/probe requirements.
- [Docs/V1技术设计.md §40 (V1 上线门槛)](../../Docs/V1技术设计.md) defines pre-release production readiness criteria across platform consistency, security, and runtime integrity before real-family onboarding.

All previous erroneous references to unrelated product requirements (such as V1-C10, V1-C11, V1-C24, V1-C25, V1-X14, or technical design §6.6) are explicitly revoked and removed.

## Distinction Between Frozen Authority and Engineering Choices

This specification explicitly separates upstream normative Authority from repository-level engineering choices:

1. **Frozen Upstream Authority / Required Outcomes**:
   - Production runtime engine is strictly Node.js 26 LTS under ESM;
   - Web framework baseline is Fastify 5 stable line;
   - Controlled, portable Docker image deployable across Stage A, Stage B, and Stage C without domain code rewrites;
   - Secrets are strictly excluded from repository code, committed files, and Docker images;
   - Production ingress must prevent untrusted clients from spoofing authoritative client IP addresses;
   - Abuse and brute-force protection must be effective for verified deployment topologies, without weakening business authorization or Safety gates;
   - Process startup must fail fast on missing or invalid critical runtime configuration;
   - Preserved `/healthz` compatibility endpoint returning `{"status":"ok"}` for container liveness and orchestration;
   - Data typing and UTC time boundaries must remain consistent across application and database layers (audit-first: zero modification without proven defect evidence).

2. **Current Engineering Choices / Candidate Remediations**:
   - Bun is the current workspace package manager and build engine used in this repository to compile distribution bundles for Node.js execution; Bun is a tooling choice, not a product or architecture authority;
   - Multi-stage container build structure, non-root execution (`USER node`), and specific layer architectures are engineering implementation candidates, not upstream normative mandates;
   - The `/healthz` route is an existing compatibility contract to preserve; whether it requires rate-limit exemption depends on the verified orchestrator and ingress topology;
   - Specific reverse proxy trust algorithms (e.g. CIDR allowlist vs platform hop configuration) and specific abuse mitigation mechanisms (e.g. cloud gateway vs Fastify rate-limit plugin) are candidate engineering remediations to be decided by topology audit, not frozen authority.

## Scope

### In Scope

- **E1: Runtime and Tooling Boundary Reconciliation**:
  - Enforce Node.js 26 LTS as the production execution runtime;
  - Document and maintain Bun as the repository workspace tooling and build engine compiling Node.js-compatible distribution bundles;
  - Preserve exact lockfile resolution.
- **E2: Controlled Container Delivery & Health Check**:
  - Provide a controlled, portable production Docker image for `apps/server/api` meeting §4.0A portability contracts;
  - Ensure zero secret leakage in container build artifacts;
  - Preserve existing unauthenticated `/healthz` liveness probe endpoint returning `{"status":"ok"}`.
- **E3: Production Ingress / Abuse Protection Reconciliation (Topology-First)**:
  - Reconcile verified deployment ingress topology (Early Pilot Lighthouse vs Managed Production CloudBase Run);
  - Determine authoritative client-IP extraction rules and prevent `X-Forwarded-For` spoofing boundaries;
  - Audit existing infrastructure/platform protections (CDN, load balancer, API gateway) and existing application-level protections;
  - Respect the repository's prior deliberate decision to defer global rate limiting until proxy/IP authority is verified;
  - Classify E3 outcome into one of: `ALREADY SUFFICIENT`, `DEPLOYMENT TOPOLOGY DECISION REQUIRED`, or `TARGETED APPLICATION REMEDIATION REQUIRED`.
- **E4: Runtime Configuration, Typed Data & Time Boundary Reconciliation (Audit-First)**:
  - Audit existing `loadRuntimeConfig` and startup sequence for fail-fast validation of required parameters (e.g. `DATABASE_URL`);
  - Audit typed schemas across Drizzle ORM, domain models, and PostgreSQL catalog;
  - Audit UTC timestamp handling across client ISO strings, Fastify routing, and database storage;
  - Classify findings into: `ALREADY SUFFICIENT`, `TARGETED REMEDIATION REQUIRED`, or `NO CHANGE REQUIRED`.

### Out of Scope

- Modifying existing product semantics, business rules, canonical user flows, or authority boundaries;
- Committing or inventing deployment architecture outside the approved Stage A / Stage B / Stage C boundaries;
- Claiming ownership over shared historical infrastructure files (`apps/server/api/package.json`, `apps/server/api/src/plugins/error-handler.ts`, `apps/server/api/src/routes/auth.ts`, `apps/server/api/src/runtime-env.ts`);
- Forcing application-level rate limiting or pre-selecting a specific rate-limiting plugin prior to topology audit confirmation;
- Speculative database schema migrations or domain type modernizations without confirmed bug evidence.

### Future Unowned Path Rule

If the subsequent E implementation audit proves with fresh evidence that modifying unowned historical files (`runtime-env.ts`, `auth.ts`, `error-handler.ts`, or `package.json`) is strictly required:
1. Implementation MUST STOP immediately;
2. A separate, minimal, governance-only prerequisite change MUST be submitted;
3. The prerequisite must demonstrate why the path is required, what exact finding mandates it, and why no narrower solution exists;
4. Implementation may only proceed after the governance change is independently audited and merged.

## Requirements

| Requirement | Contract |
| :--- | :--- |
| **E-01** | **Runtime and Tooling Boundary (E1)**: The production server execution runtime must be Node.js 26 LTS under ESM. Tooling choices (such as Bun build) must output standalone distributions executable under Node.js without requiring Bun runtime in production containers. |
| **E-02** | **Controlled Container & Health Contract (E2)**: The server container build must produce a portable, controlled Docker image adhering to §4.0A portability contracts, with zero secret leakage. The existing `/healthz` route must be preserved, returning HTTP 200 with `{"status":"ok"}`. |
| **E-03** | **Production Ingress & Client-IP Boundary Reconciliation (E3)**: Ingress configuration must be reconciled against verified deployment topologies (Lighthouse and CloudBase Run) to ensure untrusted clients cannot spoof authoritative client IP addresses. Outcome must be classified as `ALREADY SUFFICIENT`, `DEPLOYMENT TOPOLOGY DECISION REQUIRED`, or `TARGETED APPLICATION REMEDIATION REQUIRED`. |
| **E-04** | **Abuse & Brute-Force Protection Reconciliation (E3)**: Existing abuse protections across platform and application layers must be audited against the verified ingress topology and the prior rate-limit deferral rationale. Application-level rate limiting is permitted only if proven necessary after topology confirmation; otherwise `NO CHANGE REQUIRED` or platform-level reconciliation applies. |
| **E-05** | **Runtime Configuration Fail-Fast Audit & Reconciliation (E4)**: `loadRuntimeConfig` and startup boot sequences must be audited to verify that missing or invalid critical environment variables (such as `DATABASE_URL`) trigger fail-fast termination before accepting traffic. Remediations are applied only upon proven defect. |
| **E-06** | **Typed Data and Time Boundary Integrity (E4, Audit-First)**: Drizzle ORM models, domain interfaces, and PostgreSQL catalog columns must be systematically audited for typing consistency and UTC timestamp integrity. Zero modification to database schemas or domain mappings is permitted without fresh evidence of a concrete mismatch. |

## Acceptance Scenarios

- **E1 Runtime Consistency**: The production server bundle executes successfully under Node.js 26 LTS ESM without dependency on the Bun binary.
- **E2 Container Delivery and Liveness**: The container build succeeds from `apps/server/api/Dockerfile`, runs cleanly without secrets in the image, and querying `/healthz` returns HTTP 200 `{"status":"ok"}`.
- **E3 Ingress Client-IP Verification**: Ingress evaluation proves that client IP derivation is deterministic and resistant to untrusted `X-Forwarded-For` spoofing under the verified deployment topology.
- **E3 Abuse Protection Decision**: Abuse protection review completes with documented outcome: either existing protections are deemed `ALREADY SUFFICIENT`, an external `DEPLOYMENT TOPOLOGY DECISION REQUIRED` is filed, or a `TARGETED APPLICATION REMEDIATION REQUIRED` is established.
- **E4 Runtime Config Fail-Fast**: Configuration audit confirms that critical environment configuration is validated fail-fast during startup before listening on network sockets.
- **E4 Audit-First Type and Time Integrity**: Static type checking and catalog reflection confirm consistent typing and UTC time boundaries across application and database layers without unverified schema alterations.

## Acceptance Evidence

Implementation PRs must provide verifiable evidence:
1. Docker build log proving successful generation and execution of `apps/server/api/Dockerfile`;
2. Runtime execution evidence proving Node.js 26 ESM execution;
3. HTTP verification proving `/healthz` returns 200 `{"status":"ok"}`;
4. Documented E3 topology reconciliation report with explicit finding classification (`ALREADY SUFFICIENT`, `DEPLOYMENT TOPOLOGY DECISION REQUIRED`, or `TARGETED APPLICATION REMEDIATION REQUIRED`);
5. Documented E4 audit findings for runtime config, data types, and timestamps;
6. Full regression gates: `typecheck`, `guard:static`, `openapi:check`, `test`, `verify-all`, and `validate-change-governance` pass on exact candidate HEAD.
