# Slice 4 — Case Participant Core — Implementation Evidence

Status: **IMPLEMENTATION IN PROGRESS — FINAL VERIFICATION BLOCKED BY EXECUTION INFRASTRUCTURE**

This file is implementation self-evidence only. It is **not** Independent Converge evidence and does **not** declare MERGE SAFE.

## Provenance

- Repository: `pyxm1618/xiaoshuyin`
- Feature: `004-case-participant-core`
- Branch: `feat/004-case-participant-core`
- IMPLEMENT_BASE_SHA: `70b49dea973ccac88b6ca3e5fe2cf1f51cffd8f1`
- Base main at implementation start: `e4ca91cbdda14d14c7d245068cfcbf22b68cd080`
- Evidence snapshot Head: `a6f6080f098db7718d59d4668b1565821894d0d8`
- Current branch relationship at snapshot: behind main = 0

## Implement Gate

The implementation started only after the real repository state showed:
- Slice 1 merged and independently closed.
- Slice 2 merged and independently closed.
- the invited identity contract present on main.
- Slice 5 identity-binding runtime present on main.
- Slice 3 is not an implementation dependency for Slice 4; Slice 4 writes no Evidence.

The stale historical `BLOCKED` text in the frozen Slice 4 planning documents was not treated as current repository state.

## Frozen-input integrity

Diff from IMPLEMENT_BASE_SHA to the evidence snapshot shows:
- `Docs/**`: 0 changes
- Slice 4 `spec.md`: 0 changes
- Slice 4 `plan.md`: 0 changes
- Slice 4 `research.md`: 0 changes
- Slice 4 `data-model.md`: 0 changes
- Slice 4 `quickstart.md`: 0 changes
- Slice 4 frozen `contracts/**`: 0 changes
- Slice 4 frozen `checklists/**`: 0 changes
- protected Slice 1/2/3/5/6 spec files: 0 changes

## Implemented runtime surface

Exactly six participation operations are implemented:
1. `POST /api/v1/cases/:id/participation-invites`
2. `GET /api/v1/participation-invites/:token`
3. `POST /api/v1/participation-invites/:token/accept`
4. `POST /api/v1/participations/:id/decline`
5. `POST /api/v1/participations/:id/withdraw`
6. `GET /api/v1/participations/:id`

No generic participant response, role/RBAC, Case-wide participant read, Evidence writer, second audit table, or notification domain was added.

## Database

Added reviewed additive migration:
- `db/migrations/005_case_participant_core.sql`

It contains:
- frozen participation state enum
- `case_participants` single resource table
- composite Case/Family and Person/Family integrity
- state/timestamp CHECKs
- token-hash integrity
- one-live-participation partial unique index
- ENABLE + FORCE RLS
- family/self/token policies
- `security_invoker` public safe view
- least-privilege runtime grants
- shared audit/idempotency CHECK extensions

Earlier GitHub Actions runs executed this migration successfully before the current Actions execution-layer outage.

## Token / privacy

- bearer token is deterministic HMAC-SHA256 over the frozen domain separator
- DB stores only SHA-256(token) hex
- idempotency snapshot for successful create is redacted
- same-key create replay rehydrates the same token from participationId + server secret
- non-201 create outcomes are replayed unchanged
- request-log serializer redacts the bearer token embedded in participation-invite URLs
- audit metadata does not include bearer token or OpenID

## Lifecycle / concurrency

Implemented:
- PENDING → ACTIVE
- PENDING → DECLINED
- PENDING → EXPIRED
- ACTIVE → WITHDRAWN
- terminal states do not reactivate
- exact expiry boundary uses DB time
- row locking + conditional updates
- exactly-once expiry audit
- partial-unique live participation protection
- shared idempotency framework for create / accept / decline / withdraw
- transaction rollback coverage for audit/idempotency failures

## Authorization / RLS / Compliance

- participation decisions extend the single existing `authorize()`
- no `authorizeParticipation()`
- self actions require exact `actor.personId === participation.person_id`
- manager actions require current Family creator/manager fact
- ordinary membership / guardian relation does not grant participant authority
- active participation does not grant Case-wide read
- public token lookup uses the safe view
- accept uses the frozen token-context adapter before target authorization
- invite create and accept re-read current Compliance state
- Compliance profile row is locked to serialize current-consent decisions
- decline / withdraw remain available when Compliance later changes
- Slice 4 production code does not read or write the Person↔Account binding column

## Slice 5 boundary

A production Slice 5 `InvitationResolutionPort` adapter was deliberately **not** implemented here.

Frozen Slice 5 T121 states that production adapter wiring is post-merge late-closeout work after Slice 4 runtime is merged to main. A premature production adapter was removed after this ownership check.

Slice 4 Case C tests instead inject a test-only DB-backed authoritative port that:
- reads the real `case_participants` runtime under real RLS
- drives the real Slice 5 bootstrap / binding runtime
- performs no direct Person↔Account binding write
- does not change production wiring

Therefore this branch does not claim Slice 5 T121–T124 closed.

## TDD evidence already observed before the Actions outage

RED evidence:
- Commit `f7ea6beda22e03580b4336c70f099d73cbdee43b`
- participation contract/env/domain/OpenAPI tests were added before implementation
- GitHub Actions Unit Tests failed as expected while DB Migration / Contract / Static remained successful

Intermediate GREEN evidence:
- later intermediate runs showed Unit Tests PASS
- Static Checks PASS
- DB Migration PASS
- subsequent failures exposed contract/baseline issues and were remediated

No current full-suite PASS is claimed.

## Current verification blocker

Latest GitHub Actions run at the evidence snapshot:
- CI run: `42615041963`
- Spec Governance run: `42615041960`

The primary CI jobs terminate before any workflow step begins:
- `steps = null`
- `logs_url = null`
- Unit / Static / Contract / DB jobs therefore did not execute
- Integration is skipped because its prerequisites never started

Repeated failed-job reruns show the same zero-step behavior.

The isolated local execution environment cannot replace this evidence:
- GitHub/network access is unavailable there
- Bun/project dependencies are not installed
- therefore canonical project generation/full test commands cannot honestly be executed locally

## Generated OpenAPI blocker

The tracked generated artifacts are still stale:
- `packages/generated/openapi.json` contains no participation paths
- `packages/generated/openapi.d.ts` contains no participation paths

They must be regenerated by the repository's real `openapi:generate` command. They must **not** be hand-authored.

Until a real execution environment can run:
- OpenAPI generation/check
- typecheck/static guard
- DB suites
- integration/full Vitest suite
- governance

this implementation must remain **not ready for Independent Converge**.

## Current self-decision

`BLOCKED — FINAL EXECUTION / GENERATED-ARTIFACT VERIFICATION UNAVAILABLE`

This is an infrastructure/verification block, not a claim that the implementation is correct or merge-ready.
