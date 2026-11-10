
 ## Provenance

- Classification: HISTORICAL
- Repository: pyxm1618/xiaoshuyin
- Branch: feat/007-case-primary-switch
- HEAD: NOT RECORDED（运行时 HEAD 未随文记录；仅可证引入 commit 7da1ace2a1cf75ff6cbc83f030da03885ba3e567）
- Base / Main: 2b07c5321b3b10873c503d8f8bb5db61fade096c
- Command: NOT RECORDED（正文仅保留 4 个测试文件的 vitest 输出，未记录完整命令行）
- Result: PASS
- Exit Code: NOT RECORDED
- Test Count: 4 files / 24 tests
- Source / Provenance: local canonical run（无 GITHUB_SHA / GITHUB_RUN_ID / clean-tree 记录）
- Provenance Status: HISTORICAL — PROVENANCE NOT FULLY VERIFIED

本文件仅为历史辅助材料，**不是** Current Final Head 的 authoritative evidence；final-head authoritative 见 `tests/evidence/007-remediation-iii-verify-all.md`。

---

 RUN  v3.2.7 <repo>

 ✓ tests/integration/case-primary-switch-scope.test.ts (4 tests) 66ms
 ✓ tests/integration/openapi-cases.test.ts (14 tests) 3ms
{"level":50,"time":1794304879967,"pid":<pid>,"hostname":"<host>","reqId":"req-5","requestId":"req-5","method":"POST","route":"/api/v1/cases/:id/switch-primary","sqlstate":"P0001","msg":"unhandled request error"}
{"level":50,"time":1794304879988,"pid":<pid>,"hostname":"<host>","reqId":"req-6","requestId":"req-6","method":"POST","route":"/api/v1/cases/:id/switch-primary","sqlstate":"P0001","msg":"unhandled request error"}
{"level":50,"time":1794304880021,"pid":<pid>,"hostname":"<host>","reqId":"req-7","requestId":"req-7","method":"POST","route":"/api/v1/cases/:id/switch-primary","sqlstate":"P0001","msg":"unhandled request error"}
{"level":50,"time":1794304880037,"pid":<pid>,"hostname":"<host>","reqId":"req-8","requestId":"req-8","method":"POST","route":"/api/v1/cases/:id/switch-primary","sqlstate":"23514","msg":"unhandled request error"}
 ✓ tests/integration/case-primary-switch-atomicity.test.ts (4 tests) 274ms
 ✓ tests/db/migration-case-primary-switch-upgrade.test.ts (2 tests) 699ms

 Test Files  4 passed (4)
      Tests  24 passed (24)
   Start at  18:01:19
   Duration  879ms (transform 229ms, setup 21ms, collect 472ms, tests 1.04s, environment 0ms, prepare 155ms)

