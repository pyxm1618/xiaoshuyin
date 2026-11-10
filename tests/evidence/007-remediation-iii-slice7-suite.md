
 ## Provenance

- Classification: HISTORICAL
- Repository: pyxm1618/xiaoshuyin
- Branch: feat/007-case-primary-switch
- HEAD: NOT RECORDED（运行时 HEAD 未随文记录；仅可证引入 commit 7da1ace2a1cf75ff6cbc83f030da03885ba3e567）
- Base / Main: 2b07c5321b3b10873c503d8f8bb5db61fade096c
- Command: NOT RECORDED（正文仅保留 21 个测试文件的 vitest 输出，未记录完整命令行）
- Result: PASS
- Exit Code: NOT RECORDED
- Test Count: 21 files / 116 tests
- Source / Provenance: local canonical run（无 GITHUB_SHA / GITHUB_RUN_ID / clean-tree 记录）
- Provenance Status: HISTORICAL — PROVENANCE NOT FULLY VERIFIED

本文件仅为历史辅助材料，**不是** Current Final Head 的 authoritative evidence；final-head authoritative 见 `tests/evidence/007-remediation-iii-verify-all.md`。

---

 RUN  v3.2.7 <repo>

 ✓ tests/db/case-primary-switch-shared-vocabulary.test.ts (5 tests) 30ms
 ✓ tests/integration/case-primary-switch-idempotency.test.ts (5 tests) 468ms
 ✓ tests/db/case-primary-switch-concurrency.test.ts (5 tests) 554ms
 ✓ tests/db/migration-case-primary-switch-upgrade.test.ts (2 tests) 482ms
 ✓ tests/integration/case-primary-switch-conflicts.test.ts (6 tests) 332ms
 ✓ tests/integration/case-primary-switch-json-boundary.test.ts (4 tests) 205ms
 ✓ tests/integration/case-primary-switch-happy.test.ts (4 tests) 235ms
{"level":50,"time":1794304945650,"pid":<pid>,"hostname":"<host>","reqId":"req-5","requestId":"req-5","method":"POST","route":"/api/v1/cases/:id/switch-primary","sqlstate":"P0001","msg":"unhandled request error"}
{"level":50,"time":1794304945665,"pid":<pid>,"hostname":"<host>","reqId":"req-6","requestId":"req-6","method":"POST","route":"/api/v1/cases/:id/switch-primary","sqlstate":"P0001","msg":"unhandled request error"}
{"level":50,"time":1794304945678,"pid":<pid>,"hostname":"<host>","reqId":"req-7","requestId":"req-7","method":"POST","route":"/api/v1/cases/:id/switch-primary","sqlstate":"P0001","msg":"unhandled request error"}
{"level":50,"time":1794304945691,"pid":<pid>,"hostname":"<host>","reqId":"req-8","requestId":"req-8","method":"POST","route":"/api/v1/cases/:id/switch-primary","sqlstate":"23514","msg":"unhandled request error"}
 ✓ tests/integration/case-primary-switch-atomicity.test.ts (4 tests) 160ms
 ✓ tests/integration/case-primary-switch-authorization.test.ts (3 tests) 221ms
 ✓ tests/integration/case-primary-switch-authorization-fault.test.ts (2 tests) 1866ms
   ✓ S7-H02-C switch-primary authorization error classification > a real 57014 at the authorization fact read propagates to 500, never 404  1642ms
 ✓ tests/db/case-primary-switch-schema.test.ts (7 tests) 46ms
 ✓ tests/db/case-primary-switch-rls.test.ts (5 tests) 54ms
 ✓ tests/integration/openapi-cases.test.ts (14 tests) 4ms
 ✓ tests/integration/case-primary-switch-scope.test.ts (4 tests) 18ms
 ✓ tests/integration/case-primary-switch-reason-persistence.test.ts (2 tests) 191ms
 ✓ tests/domain/case-primary-switch-decision.test.ts (9 tests) 4ms
 ✓ tests/domain/case-primary-switch-contracts.test.ts (10 tests) 5ms
 ✓ tests/domain/case-primary-switch-authorization.test.ts (10 tests) 6ms
 ✓ tests/domain/case-primary-switch-idempotency.test.ts (7 tests) 2ms
 ✓ tests/domain/case-primary-switch-reason-unicode.test.ts (5 tests) 2ms
 ✓ tests/domain/case-primary-switch-lock-order.test.ts (3 tests) 2ms

 Test Files  21 passed (21)
      Tests  116 passed (116)
   Start at  18:02:23
   Duration  2.94s (transform 255ms, setup 31ms, collect 1.54s, tests 4.89s, environment 1ms, prepare 600ms)

