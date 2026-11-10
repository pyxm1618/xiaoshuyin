
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

