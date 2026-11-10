
 ## Provenance

- Classification: HISTORICAL
- Repository: pyxm1618/xiaoshuyin
- Branch: feat/007-case-primary-switch
- HEAD: NOT RECORDED（运行时 HEAD 未随文记录；仅可证引入 commit 7da1ace2a1cf75ff6cbc83f030da03885ba3e567）
- Base / Main: 2b07c5321b3b10873c503d8f8bb5db61fade096c
- Command: NOT RECORDED（正文仅保留全量 vitest 输出，未记录完整命令行）
- Result: PASS
- Exit Code: NOT RECORDED
- Test Count: 212 files / 1266 tests
- Source / Provenance: local canonical run（无 GITHUB_SHA / GITHUB_RUN_ID / clean-tree 记录）
- Provenance Status: HISTORICAL — PROVENANCE NOT FULLY VERIFIED

本文件仅为历史辅助材料，**不是** Current Final Head 的 authoritative evidence；final-head authoritative 见 `tests/evidence/007-remediation-iii-verify-all.md`。

---

 RUN  v3.2.7 <repo>

 ✓ tests/integration/identity-binding-gate2-barrier-matrix.test.ts (14 tests) 6049ms
   ✓ H-02 Gate 2 barrier matrix (MEDIUM-02) > profile / age-band: Gate lock blocks the concurrent profile UPDATE  668ms
   ✓ H-02 Gate 2 barrier matrix (MEDIUM-02) > missing compliance profile: Gate lock blocks the concurrent profile DELETE  702ms
   ✓ H-02 Gate 2 barrier matrix (MEDIUM-02) > consent: Gate lock blocks the concurrent runtime-role consent UPDATE  738ms
   ✓ H-02 Gate 2 barrier matrix (MEDIUM-02) > guardian relationship: Gate lock blocks the concurrent guardian UPDATE  781ms
   ✓ H-02 Gate 2 barrier matrix (MEDIUM-02) > membership: Gate lock blocks the concurrent membership DELETE  645ms
   ✓ H-02 Gate 2 barrier matrix (MEDIUM-02) > P1 binding conflict: Gate lock blocks the concurrent P1 binding UPDATE  593ms
   ✓ H-02 Gate 2 barrier matrix (MEDIUM-02) > membership insert: binding-first second-family INSERT cannot cross the linearization point  600ms
   ✓ H-02 Gate 2 barrier matrix (MEDIUM-02) > family manager authority: binding-first family creator UPDATE cannot cross the linearization point  583ms
 ✓ tests/integration/cases-authorization-error-classification.test.ts (5 tests) 6795ms
   ✓ Slice 2 authz error classification > a real 57014 at requireFamilyAction -> readFacts is NOT a known denial  1516ms
   ✓ Slice 2 authz error classification > POST /api/v1/cases propagates authorization-fact 57014 to generic 500, not 403  1860ms
   ✓ Slice 2 authz error classification > GET /api/v1/cases propagates authorization-fact 57014 to generic 500, not 403  1589ms
   ✓ Slice 2 authz error classification > GET /api/v1/cases/:id propagates authorization-fact 57014 to generic 500, not 404  1599ms
 ✓ tests/integration/error-log-redaction.test.ts (1 test) 10458ms
   ✓ unexpected error logging is redacted > logs SQLSTATE and request metadata without request-derived values  10363ms
 ✓ tests/integration/messages-authorization-error-classification.test.ts (4 tests) 3547ms
   ✓ ULT-002 authorization error classification > injects real 57014 at requireFamilyAction -> readFacts, not current-family resolution  1520ms
   ✓ ULT-002 authorization error classification > maps authorization-fact 57014 to 500, rolls back, then the same request succeeds after fault removal  1738ms
 ✓ tests/integration/participations-create-authorization-order.test.ts (3 tests) 5069ms
   ✓ Slice 4 H-01 create-invite authorization → idempotency ordering > H-01 Case 1 — exact replay still executes the CURRENT Family authorization first  1669ms
   ✓ Slice 4 H-01 create-invite authorization → idempotency ordering > H-01 Case 2 — unexpected authorization-fact 57014 cannot be bypassed by an exact replay  3164ms
 ✓ tests/integration/identity-binding-anti-enumeration.test.ts (5 tests) 973ms
   ✓ candidate-facing anti-enumeration > bootstrap generic branches are observationally identical (T101 matrix)  501ms
 ✓ tests/integration/idempotency.test.ts (21 tests) 935ms
{"level":50,"time":1794305025514,"pid":<pid>,"hostname":"<host>","reqId":"req-23","requestId":"req-23","method":"POST","route":"/api/v1/identity-bindings/pairing-decision","msg":"unhandled request error"}
 ✓ tests/integration/identity-binding-idempotency.test.ts (9 tests) 968ms
 ✓ tests/integration/identity-binding-commit-gate2.test.ts (5 tests) 917ms
   ✓ Gate 2 commit-time recheck (T073) > concurrent consent revoke committed before the linearization point blocks the commit (F-01)  385ms
{"level":50,"time":1794305026549,"pid":<pid>,"hostname":"<host>","reqId":"req-11","requestId":"req-11","method":"POST","route":"/api/v1/identity-bindings/pairing-decision","msg":"unhandled request error"}
 ✓ tests/integration/guard-scope.test.ts (28 tests) 3484ms
 ✓ tests/integration/identity-binding-pairing-rotation.test.ts (5 tests) 943ms
   ✓ H-01 pairing challenge direct proofs (MEDIUM-03) > H-01 rotation: a new issuance returns new challenge bytes  312ms
 ✓ tests/db/identity-binding-rls.test.ts (9 tests) 956ms
   ✓ binding RLS isolation > H-02: runtime role locks authoritative Gate rows and blocks concurrent invalidation  314ms
{"level":50,"time":1794305027373,"pid":<pid>,"hostname":"<host>","reqId":"req-17","requestId":"req-17","method":"POST","route":"/api/v1/identity-bindings/pairing-decision","msg":"unhandled request error"}
 ✓ tests/integration/identity-binding-no-p2.test.ts (6 tests) 661ms
 ✓ tests/integration/case-primary-switch-authorization-fault.test.ts (2 tests) 1748ms
   ✓ S7-H02-C switch-primary authorization error classification > a real 57014 at the authorization fact read propagates to 500, never 404  1592ms
 ✓ tests/integration/identity-binding-failure-injection.test.ts (6 tests) 1634ms
   ✓ Phase C rollback failure-injection matrix (F-08) > Person binding update failure rolls back and returns RETRYABLE  988ms
  FAIL 006_case_status_paused_removal.sql: S3M01_CASE_PAUSED_ROWS_EXIST:1 row(s)
Migration failed: S3M01_CASE_PAUSED_ROWS_EXIST:1 row(s)
 ✓ tests/integration/identity-binding-confirmer.test.ts (5 tests) 1764ms
   ✓ confirmer authority > guardian can confirm an UNDER_14 attempt and writes one second-party confirmation  1025ms
   ✓ confirmer authority > H-01: wrong challenge bindings fail closed with zero mutation  303ms
 ✓ tests/db/migration-case-status-paused-removal.test.ts (3 tests) 1232ms
   ✓ 006 case_status PAUSED removal > second application is a 0-new no-op with an unchanged object set  439ms
 ✓ tests/integration/identity-binding-candidate-eligibility.test.ts (8 tests) 913ms
 ✓ tests/integration/identity-binding-context-cleanup.test.ts (7 tests) 1167ms
   ✓ F-05 sensitive context cleanup > confirmer REJECT scrubs every context of the attempt  391ms
{"level":50,"time":1794305031060,"pid":<pid>,"hostname":"<host>","reqId":"req-10","requestId":"req-10","method":"POST","route":"/api/v1/identity-bindings/pairing-decision","msg":"unhandled request error"}
 ✓ tests/integration/identity-binding-confirmer-replay.test.ts (4 tests) 662ms
 ✓ tests/integration/identity-binding-candidate.test.ts (7 tests) 808ms
 ✓ tests/integration/current-family-determinism.test.ts (11 tests) 648ms
 ✓ tests/db/identity-binding-concurrency.test.ts (4 tests) 674ms
 ✓ tests/integration/identity-binding-status.test.ts (4 tests) 616ms
 ✓ tests/db/identity-binding-operation-key-repository.test.ts (7 tests) 644ms
{"level":50,"time":1794305032562,"pid":<pid>,"hostname":"<host>","reqId":"req-1","requestId":"req-1","method":"POST","route":"/api/v1/cases/:id/participation-invites","msg":"unhandled request error"}
 ✓ tests/integration/identity-binding-context-commit-selection.test.ts (3 tests) 508ms
 ✓ tests/integration/participations-idempotency.test.ts (6 tests) 530ms
{"level":50,"time":1794305033182,"pid":<pid>,"hostname":"<host>","reqId":"req-8","requestId":"req-8","method":"POST","route":"/api/v1/identity-bindings/pairing-decision","msg":"unhandled request error"}
 ✓ tests/integration/identity-binding-commit.test.ts (4 tests) 774ms
   ✓ Identity binding happy path (AS-01) > H-01: candidate-presented challenge binds the exact attempt and cannot cross candidates  380ms
 ✓ tests/integration/identity-binding-audit.test.ts (3 tests) 668ms
   ✓ identity binding audit (T099) > RETRYABLE uses BINDING_OPERATION_RETRYABLE, keeps the attempt PENDING, then converges  330ms
 ✓ tests/integration/members.test.ts (15 tests) 791ms
 ✓ tests/integration/participations-identity-seam.test.ts (5 tests) 666ms
 ✓ tests/integration/processing-gate.test.ts (5 tests) 680ms
 ✓ tests/integration/identity-binding-slice4-e2e.test.ts (5 tests) 715ms
 ✓ tests/integration/messages-connection-loss.test.ts (2 tests) 393ms
 ✓ tests/db/identity-binding-context.test.ts (5 tests) 420ms
 ✓ tests/integration/participations-compliance.test.ts (7 tests) 491ms
 ✓ tests/integration/identity-binding-account.test.ts (4 tests) 413ms
 ✓ tests/db/identity-binding-p1-commit.test.ts (3 tests) 386ms
 ✓ tests/integration/age-band-source.test.ts (12 tests) 518ms
 ✓ tests/integration/identity-binding-bootstrap.test.ts (5 tests) 468ms
{"level":50,"time":1794305036207,"pid":<pid>,"hostname":"<host>","reqId":"req-m","requestId":"req-m","method":"POST","route":"/api/v1/cases","msg":"unhandled request error"}
{"level":50,"time":1794305036225,"pid":<pid>,"hostname":"<host>","reqId":"req-p","requestId":"req-p","method":"POST","route":"/api/v1/cases","msg":"unhandled request error"}
{"level":50,"time":1794305036245,"pid":<pid>,"hostname":"<host>","reqId":"req-s","requestId":"req-s","method":"POST","route":"/api/v1/cases","msg":"unhandled request error"}
{"level":50,"time":1794305036266,"pid":<pid>,"hostname":"<host>","reqId":"req-v","requestId":"req-v","method":"POST","route":"/api/v1/cases","msg":"unhandled request error"}
 ✓ tests/integration/cases-idempotency-identity.test.ts (9 tests) 418ms
 ✓ tests/integration/identity-binding-error-envelope.test.ts (5 tests) 403ms
 ✓ tests/integration/messages-idempotency.test.ts (5 tests) 436ms
 ✓ tests/integration/identity-binding-commit-settle.test.ts (3 tests) 914ms
   ✓ attempt settle + audit (T079) > COMMITTED settles once and replay does not duplicate the business audit  302ms
   ✓ attempt settle + audit (T079) > candidate REJECT settles TERMINAL exactly once and clears ciphertext  448ms
 ✓ tests/db/identity-binding-attempt-repository.test.ts (4 tests) 509ms
 ✓ tests/integration/identity-binding-pairing.test.ts (3 tests) 546ms
 ✓ tests/integration/participations-audit.test.ts (3 tests) 390ms
 ✓ tests/integration/cases-http-boundary.test.ts (10 tests) 347ms
 ✓ tests/integration/cases-create.test.ts (18 tests) 487ms
 ✓ tests/integration/identity-binding-attempt-create.test.ts (3 tests) 439ms
 ✓ tests/integration/authorization.test.ts (7 tests) 428ms
 ✓ tests/integration/identity-binding-candidate-auth.test.ts (3 tests) 431ms
 ✓ tests/integration/cases-read.test.ts (7 tests) 465ms
 ✓ tests/integration/identity-binding-confirmer-list.test.ts (3 tests) 313ms
 ✓ tests/db/participants-rls.test.ts (7 tests) 284ms
 ✓ tests/integration/participations-anti-enumeration.test.ts (3 tests) 272ms
 ✓ tests/integration/identity-binding-gate1.test.ts (4 tests) 263ms
 ✓ tests/integration/messages-create.test.ts (7 tests) 303ms
 ✓ tests/integration/identity-binding-confirmer-reject.test.ts (2 tests) 282ms
 ✓ tests/integration/consent-revoke.test.ts (3 tests) 330ms
 ✓ tests/integration/consent-reconsent.test.ts (5 tests) 328ms
 ✓ tests/integration/cases-authorization.test.ts (7 tests) 270ms
 ✓ tests/integration/consent-grant-authz.test.ts (6 tests) 285ms
 ✓ tests/db/identity-binding-confirmation-repository.test.ts (3 tests) 313ms
 ✓ tests/integration/identity-binding-invitation-contract.test.ts (6 tests) 264ms
 ✓ tests/integration/authorization-dimensions.test.ts (5 tests) 319ms
 ✓ tests/integration/consent-validity.test.ts (5 tests) 342ms
 ✓ tests/db/case-primary-switch-concurrency.test.ts (5 tests) 434ms
 ✓ tests/integration/consent-request-candidate.test.ts (4 tests) 318ms
 ✓ tests/integration/participations-accept-concurrency.test.ts (3 tests) 278ms
 ✓ tests/integration/evidence-person-processing-gate.test.ts (18 tests) 305ms
 ✓ tests/integration/identity-binding-bootstrap-route.test.ts (5 tests) 319ms
 ✓ tests/integration/messages-authorization.test.ts (6 tests) 314ms
 ✓ tests/integration/participations-cross-family.test.ts (3 tests) 251ms
 ✓ tests/db/migration-upgrade-evidence.test.ts (2 tests) 373ms
 ✓ tests/db/migration-case-primary-switch-upgrade.test.ts (2 tests) 331ms
 ✓ tests/integration/evidence-write.test.ts (14 tests) 337ms
 ✓ tests/integration/cases-read-no-audit.test.ts (2 tests) 184ms
 ✓ tests/integration/participations-accept.test.ts (2 tests) 213ms
 ✓ tests/integration/case-primary-switch-idempotency.test.ts (5 tests) 407ms
 ✓ tests/integration/identity-binding-authorization-surfaces.test.ts (3 tests) 286ms
 ✓ tests/db/identity-binding-audit-repository.test.ts (5 tests) 253ms
 ✓ tests/integration/participations-invite-lookup.test.ts (2 tests) 258ms
 ✓ tests/integration/identity-binding-replay.test.ts (1 test) 238ms
 ✓ tests/integration/consent-request-authz.test.ts (6 tests) 204ms
 ✓ tests/integration/participations-expiry.test.ts (3 tests) 269ms
 ✓ tests/db/cases-primary-concurrency.test.ts (3 tests) 245ms
 ✓ tests/integration/identity-binding-confirmer-independent.test.ts (2 tests) 208ms
 ✓ tests/integration/consent-grant.test.ts (5 tests) 242ms
 ✓ tests/db/evidence-raw-writer-guard.test.ts (5 tests) 212ms
 ✓ tests/integration/transaction-boundary.test.ts (5 tests) 225ms
 ✓ tests/integration/cases-idempotency.test.ts (3 tests) 195ms
 ✓ tests/integration/participations-read.test.ts (2 tests) 236ms
 ✓ tests/integration/identity-binding-case-b.test.ts (2 tests) 237ms
 ✓ tests/integration/participations-withdraw.test.ts (2 tests) 264ms
 ✓ tests/integration/identity-binding-session.test.ts (1 test) 231ms
 ✓ tests/integration/cases-current-family-ambiguous.test.ts (3 tests) 196ms
 ✓ tests/integration/messages-authorization-before-replay.test.ts (2 tests) 198ms
 ✓ tests/integration/consent-first.test.ts (3 tests) 183ms
 ✓ tests/integration/consent-request.test.ts (5 tests) 175ms
 ✓ tests/integration/case-primary-switch-conflicts.test.ts (6 tests) 396ms
 ✓ tests/integration/participations-authorization.test.ts (2 tests) 189ms
 ✓ tests/integration/evidence-writer-authorization.test.ts (16 tests) 204ms
 ✓ tests/integration/participations-rollback.test.ts (2 tests) 170ms
 ✓ tests/db/participants-evidence-boundary.test.ts (2 tests) 181ms
 ✓ tests/integration/identity-binding-rollback.test.ts (1 test) 188ms
 ✓ tests/integration/consent-evidence.test.ts (3 tests) 180ms
 ✓ tests/integration/openapi.test.ts (7 tests) 164ms
 ✓ tests/domain/package-boundary.test.ts (8 tests) 423ms
 ✓ tests/integration/identity-binding-confirmer-ordering.test.ts (1 test) 186ms
 ✓ tests/db/participants-history.test.ts (3 tests) 187ms
 ✓ tests/db/identity-binding-facts.test.ts (3 tests) 159ms
 ✓ tests/integration/messages-current-family-ambiguous.test.ts (2 tests) 168ms
 ✓ tests/integration/families.test.ts (6 tests) 138ms
{"level":50,"time":1794305048583,"pid":<pid>,"hostname":"<host>","reqId":"req-3","requestId":"req-3","method":"POST","route":"/api/v1/cases","sqlstate":"P0001","msg":"unhandled request error"}
{"level":50,"time":1794305048631,"pid":<pid>,"hostname":"<host>","reqId":"req-7","requestId":"req-7","method":"POST","route":"/api/v1/cases","sqlstate":"P0001","msg":"unhandled request error"}
 ✓ tests/integration/cases-rollback.test.ts (2 tests) 160ms
 ✓ tests/db/evidence-rls-grants.test.ts (8 tests) 136ms
 ✓ tests/integration/participations-http-boundary.test.ts (9 tests) 185ms
 ✓ tests/integration/coverage-audit.test.ts (17 tests) 191ms
 ✓ tests/integration/participations-decline.test.ts (1 test) 153ms
 ✓ tests/db/rls.test.ts (10 tests) 94ms
 ✓ tests/integration/consent-read.test.ts (4 tests) 136ms
 ✓ tests/db/evidence-conflict-concurrency.test.ts (3 tests) 191ms
 ✓ tests/integration/participations-invite.test.ts (1 test) 124ms
 ✓ tests/integration/case-primary-switch-happy.test.ts (4 tests) 278ms
 ✓ tests/integration/cases-idempotency-mismatch.test.ts (2 tests) 142ms
 ✓ tests/integration/case-primary-switch-authorization.test.ts (3 tests) 260ms
 ✓ tests/integration/case-primary-switch-json-boundary.test.ts (4 tests) 259ms
 ✓ tests/integration/participations-scope.test.ts (2 tests) 124ms
 ✓ tests/integration/log-privacy.test.ts (1 test) 118ms
 ✓ tests/integration/uuid-v7.test.ts (3 tests) 105ms
 ✓ tests/integration/case-primary-switch-reason-persistence.test.ts (2 tests) 205ms
 ✓ tests/integration/cases-audit.test.ts (2 tests) 121ms
{"level":50,"time":1794305050782,"pid":<pid>,"hostname":"<host>","reqId":"req-5","requestId":"req-5","method":"POST","route":"/api/v1/cases/:id/switch-primary","sqlstate":"P0001","msg":"unhandled request error"}
{"level":50,"time":1794305050801,"pid":<pid>,"hostname":"<host>","reqId":"req-6","requestId":"req-6","method":"POST","route":"/api/v1/cases/:id/switch-primary","sqlstate":"P0001","msg":"unhandled request error"}
{"level":50,"time":1794305050827,"pid":<pid>,"hostname":"<host>","reqId":"req-7","requestId":"req-7","method":"POST","route":"/api/v1/cases/:id/switch-primary","sqlstate":"P0001","msg":"unhandled request error"}
{"level":50,"time":1794305050859,"pid":<pid>,"hostname":"<host>","reqId":"req-8","requestId":"req-8","method":"POST","route":"/api/v1/cases/:id/switch-primary","sqlstate":"23514","msg":"unhandled request error"}
 ✓ tests/integration/cases-scope.test.ts (8 tests) 120ms
 ✓ tests/integration/case-primary-switch-atomicity.test.ts (4 tests) 220ms
 ✓ tests/db/evidence-fks-supersedes.test.ts (10 tests) 172ms
 ✓ tests/db/evidence-audit-idempotency.test.ts (7 tests) 69ms
 ✓ tests/integration/auth.test.ts (4 tests) 96ms
 ✓ tests/db/evidence-fact-guard.test.ts (4 tests) 73ms
 ✓ tests/integration/identity-binding-ordinary-login-regression.test.ts (2 tests) 68ms
 ✓ tests/db/evidence-observation-storage.test.ts (12 tests) 102ms
 ✓ tests/db/evidence-schema.test.ts (11 tests) 38ms
 ✓ tests/db/cases-rls.test.ts (10 tests) 70ms
 ✓ tests/db/roles.test.ts (12 tests) 64ms
 ✓ tests/integration/runtime-env.test.ts (7 tests) 62ms
 ✓ tests/db/cases-events-metadata.test.ts (8 tests) 61ms
 ✓ tests/db/identity-binding-schema.test.ts (12 tests) 37ms
 ✓ tests/db/case-idempotency-representation.test.ts (7 tests) 40ms
 ✓ tests/db/participants-structure.test.ts (3 tests) 50ms
 ✓ tests/db/participants-live-uniqueness.test.ts (2 tests) 30ms
 ✓ tests/db/idempotency-rls.test.ts (3 tests) 50ms
 ✓ tests/db/case-primary-switch-rls.test.ts (5 tests) 56ms
 ✓ tests/integration/evidence-scope.test.ts (5 tests) 54ms
 ✓ tests/db/constraints.test.ts (3 tests) 33ms
 ✓ tests/integration/identity-binding-routes.test.ts (2 tests) 36ms
 ✓ tests/integration/openapi-runtime-drift.test.ts (1 test) 33ms
 ✓ tests/db/identity-binding-tx.test.ts (7 tests) 48ms
 ✓ tests/db/cases-schema.test.ts (10 tests) 42ms
 ✓ tests/db/consent-structure.test.ts (3 tests) 33ms
(node:3694) DeprecationWarning: Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
 ✓ tests/db/participants-token-view.test.ts (3 tests) 35ms
 ✓ tests/db/migration-repro.test.ts (7 tests) 35ms
 ✓ tests/db/case-primary-switch-schema.test.ts (7 tests) 56ms
 ✓ tests/db/schema-structure.test.ts (6 tests) 41ms
 ✓ tests/db/participants-schema.test.ts (4 tests) 30ms
 ✓ tests/integration/participations-route-surface.test.ts (2 tests) 39ms
 ✓ tests/db/participants-constraints.test.ts (3 tests) 26ms
 ✓ tests/db/case-primary-switch-shared-vocabulary.test.ts (5 tests) 30ms
 ✓ tests/integration/case-primary-switch-scope.test.ts (4 tests) 35ms
 ✓ tests/domain/identity-binding-crypto.test.ts (16 tests) 9ms
 ✓ tests/domain/env.test.ts (6 tests) 4ms
 ✓ tests/domain/case-contracts.test.ts (24 tests) 5ms
 ✓ tests/integration/openapi-semantic-equivalence.test.ts (13 tests) 6ms
 ✓ tests/domain/evidence-capabilities.test.ts (11 tests) 4ms
 ✓ tests/domain/consent-evidence.test.ts (10 tests) 6ms
 ✓ tests/domain/participation-contracts.test.ts (5 tests) 5ms
 ✓ tests/domain/participants-token.test.ts (5 tests) 3ms
 ✓ tests/domain/case-primary-switch-authorization.test.ts (10 tests) 2ms
 ✓ tests/domain/participation-env.test.ts (9 tests) 4ms
 ✓ tests/domain/case-primary-switch-contracts.test.ts (10 tests) 5ms
 ✓ tests/domain/authorization.test.ts (36 tests) 5ms
 ✓ tests/domain/identity-binding-invitation-port.test.ts (4 tests) 2ms
 ✓ tests/domain/identity-binding-gate.test.ts (16 tests) 4ms
 ✓ tests/domain/identity-binding-env.test.ts (3 tests) 4ms
 ✓ tests/domain/participation-token.test.ts (3 tests) 2ms
 ✓ tests/integration/openapi-cases.test.ts (14 tests) 4ms
 ✓ tests/domain/identity-binding-authorization.test.ts (7 tests) 3ms
 ✓ tests/integration/openapi-evidence.test.ts (6 tests) 3ms
 ✓ tests/domain/case-primary-switch-decision.test.ts (9 tests) 5ms
 ✓ tests/domain/evidence-observation.test.ts (13 tests) 5ms
 ✓ tests/integration/openapi-participations.test.ts (5 tests) 2ms
 ✓ tests/domain/message-idempotency-hash.test.ts (5 tests) 2ms
 ✓ tests/domain/provenance.test.ts (5 tests) 4ms
 ✓ tests/domain/idempotency-hash.test.ts (11 tests) 6ms
 ✓ tests/domain/notices.test.ts (3 tests) 3ms
 ✓ tests/domain/identity-binding-state.test.ts (5 tests) 5ms
 ✓ tests/domain/participation-authorization.test.ts (5 tests) 5ms
 ✓ tests/domain/identity-binding-anti-enumeration.test.ts (5 tests) 3ms
 ✓ tests/domain/identity-binding-idempotency.test.ts (6 tests) 4ms
 ✓ tests/integration/openapi-case-primary-switch.test.ts (5 tests) 4ms
 ✓ tests/domain/evidence-provenance.test.ts (7 tests) 2ms
 ✓ tests/domain/case-primary-switch-lock-order.test.ts (3 tests) 2ms
 ✓ tests/domain/case-primary-switch-reason-unicode.test.ts (5 tests) 3ms
 ✓ tests/domain/case-primary-switch-idempotency.test.ts (7 tests) 2ms
 ✓ tests/domain/case-authorization.test.ts (19 tests) 4ms
 ✓ tests/domain/participation-types.test.ts (2 tests) 2ms
 ✓ tests/domain/participants-authorization.test.ts (5 tests) 2ms
 ✓ tests/domain/evidence-conflict-supersedes.test.ts (10 tests) 2ms
 ✓ tests/domain/age-band.test.ts (8 tests) 3ms
 ✓ tests/domain/evidence-person-reference.test.ts (8 tests) 2ms
 ✓ tests/domain/session-token.test.ts (4 tests) 2ms
 ✓ tests/domain/participation-lifecycle.test.ts (5 tests) 2ms
 ✓ tests/domain/participants-domain.test.ts (5 tests) 2ms
 ✓ tests/integration/participations-log-privacy.test.ts (3 tests) 1ms

 Test Files  212 passed (212)
      Tests  1266 passed (1266)
   Start at  18:03:31
   Duration  43.31s (transform 885ms, setup 132ms, collect 15.32s, tests 89.84s, environment 16ms, prepare 6.11s)

