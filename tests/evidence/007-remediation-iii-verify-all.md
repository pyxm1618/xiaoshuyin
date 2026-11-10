# T068 — Verification Plan 26 条逐条执行归档

执行时间: 2026-11-10T10:09:05.341Z
archive=false

说明：每条均真实启动命令并捕获 stdout/stderr、退出码与耗时。
plan.md 中未落地的测试文件名以 MAPPED 标注并给出承接文件，不静默跳过；
本 runner 只证明 Verification Plan 中的命令被真实执行、输出被捕获且失败会传播；
T001–T120 的逐任务 acceptance 由各自 designated tests / evidence 证明，不由本 runner 推导。
T121–T124 按冻结 Tasks 标注 BLOCKED（Slice 4 runtime / 真实平台），不计入 verified，也不伪装为 PASS。

## Provenance
- cwd: /Users/milushangdi/Projects/xiaoshuyin-slice7-remediation-iii/
- branch: feat/007-case-primary-switch
- HEAD: 7da1ace2a1cf75ff6cbc83f030da03885ba3e567
- origin/main: 2b07c5321b3b10873c503d8f8bb5db61fade096c
- DECISION_A_REMEDIATION_BASELINE_SHA: d74813333449376e48c071abba8103f4aac92b39
- tracked working tree (start): clean
- archive mode: no (canonical)
- GITHUB_SHA: <absent>
- GITHUB_REF: <absent>
- GITHUB_HEAD_REF: <absent>
- GITHUB_RUN_ID: <absent>
- GITHUB_RUN_ATTEMPT: <absent>
- 归档性质: **HISTORICAL** — 本文件正文为 HEAD `7da1ace2a1cf75ff6cbc83f030da03885ba3e567` 的 canonical 本地运行，不代表最终 Head

### Historical / Start Head

- 正文 HEAD（上方 `HEAD:` 行，runner 原始输出）: `7da1ace2a1cf75ff6cbc83f030da03885ba3e567`（运行时点未记录；以引入提交为唯一可证锚点）
- 轮次 Start Head: `3a2acb1c62a544d559e77f35fb05e416ed282f4c`
- Base / Main: `2b07c5321b3b10873c503d8f8bb5db61fade096c`
- Classification: HISTORICAL
- Repository: pyxm1618/xiaoshuyin
- Branch: feat/007-case-primary-switch
- Command: node scripts/verify-all.mjs（canonical，archive=false）
- Result: PASS
- Exit Code: NOT RECORDED（正文仅记录子命令 exit 与汇总行）
- Test Count: 26 条 Verification Plan 命令 / `command PASS: 36`
- Source / Provenance: 正文 local canonical run；轮次 Start Head 时点 CI run `42797206415` attempt 2（workflow `CI`，event `push`，conclusion `success`）/ artifact `verify-all-3a2acb1c62a544d559e77f35fb05e416ed282f4c-2`（id `13754657976`，77529 bytes，digest `sha256:5f9fcad96c01d5970e1ba2b2292a34599354835c91ac821f6e8c4ff336ce5c6e`）
- Provenance Status: HISTORICAL — PROVENANCE NOT FULLY VERIFIED
- `3a2acb1c…` 仅作为轮次起点记录，本段不被用作最终 Head 的权威证据

### Current / Final Head

- Classification: CURRENT
- Repository: pyxm1618/xiaoshuyin
- Branch: feat/007-case-primary-switch
- HEAD: 7003e65c9ac520107061b40cdf99329e48259cc8
- Main: 2b07c5321b3b10873c503d8f8bb5db61fade096c
- Merge Base: 2b07c5321b3b10873c503d8f8bb5db61fade096c
- Ahead: 22
- Behind: 0
- Command: node scripts/verify-all.mjs（canonical，archive=false）
- Result: PASS
- Exit Code: 0
- Test Count: 26 条 Verification Plan 命令 / `command PASS: 36`
- CI Run: 42801880607
- Artifact: verify-all-7003e65c9ac520107061b40cdf99329e48259cc8-1
- Artifact ID: 13756312927
- Artifact Digest: sha256:59ddc95b1ad60b89555b86c7a3607387a51b05bce95b90b952f96bc090b2d7f5
- Source / Provenance: CI run `42801880607` attempt 1（workflow `CI`，event `push`，conclusion `success`，headSha = Final Head）；artifact 78592 bytes
- Provenance Status: CURRENT — EXACT-HEAD VERIFIED
- 汇总（artifact 内 `verify-all.log`）: `command PASS: 36` / `command FAIL: 0` / `NOT VERIFIED: 0` / `provenance: PASS` / `verify-all: PASS` / `tracked working tree (end): clean`
- **authoritative**：final-head 证据只能是上述 CI run + artifact + digest；本文件正文 `7da1ace` 段与 Start Head 段均为历史辅助材料
- env DATABASE_URL: present
- env MIGRATION_DATABASE_URL: present
- env TEST_ADMIN_DATABASE_URL: present
- env IDENTITY_BINDING_SECRET: present
- env IDENTITY_BINDING_CONTEXT_TTL_SECONDS: present
- env IDENTITY_BINDING_ATTEMPT_TTL_SECONDS: present
- env IDENTITY_BINDING_PAIRING_TTL_SECONDS: present
- env PARTICIPATION_INVITE_TTL_SECONDS: present
- env PARTICIPATION_INVITE_TOKEN_SECRET: present

## [01/26] FR-001 / 场景 1（Account / Person 分离，GET /me）

- Plan 命令: `bun run vitest run tests/integration/me.test.ts`
- 实际命令: `bunx vitest run tests/integration/auth.test.ts tests/db/schema-structure.test.ts`
- 映射: MAPPED — me.test.ts 未落地；登录响应契约与 Account/Person 列结构由 auth.test.ts + schema-structure.test.ts 覆盖
- 期望: 200；account 与自身 person 存在；openid 不出现
  [01] $ bunx vitest run tests/integration/auth.test.ts tests/db/schema-structure.test.ts
  [01] exit=0 duration=0.9s
  [01] --- real output begin ---
  [01] | 
  [01] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [01] | 
  [01] |  ✓ tests/db/schema-structure.test.ts (6 tests) 45ms
  [01] |  ✓ tests/integration/auth.test.ts (4 tests) 135ms
  [01] | 
  [01] |  Test Files  2 passed (2)
  [01] |       Tests  10 passed (10)
  [01] |    Start at  18:09:05
  [01] |    Duration  572ms (transform 178ms, setup 13ms, collect 333ms, tests 180ms, environment 0ms, prepare 76ms)
  [01] --- real output end ---
- 结果: PASS

## [02/26] FR-002 / U01（微信登录建立 Account 与 Person）

- Plan 命令: `bun run vitest run tests/integration/auth.test.ts`
- 实际命令: `bunx vitest run tests/integration/auth.test.ts`
- 映射: EXACT
- 期望: 首次登录建 Account+Person；重复登录不新增；logout 后 401
  [02] $ bunx vitest run tests/integration/auth.test.ts
  [02] exit=0 duration=0.7s
  [02] --- real output begin ---
  [02] | 
  [02] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [02] | 
  [02] |  ✓ tests/integration/auth.test.ts (4 tests) 98ms
  [02] | 
  [02] |  Test Files  1 passed (1)
  [02] |       Tests  4 passed (4)
  [02] |    Start at  18:09:06
  [02] |    Duration  444ms (transform 138ms, setup 6ms, collect 235ms, tests 98ms, environment 0ms, prepare 26ms)
  [02] --- real output end ---
- 结果: PASS

## [03/26] FR-002 平台真实性

- Plan 命令: `—（BLOCKED BY T121–T124：真实平台 / Slice 4 runtime）`
- 状态: BLOCKED BY T121–T124（不执行命令）
- 原因: 真实 code2session 属 §40 Platform 门槛，本 Slice 只验适配器契约；按冻结 Tasks 明确 BLOCKED，不伪造通过
- 期望: 明确记录 BLOCKED（不属于 T001–T120 verified 范围）
- 结果: BLOCKED（明确归属 T121–T124，不属于 T001–T120 verified 范围）

## [04/26] FR-005 / 场景 2 / US1（建家庭 + 管理主体 + 幂等）

- Plan 命令: `bun run vitest run tests/integration/families.test.ts`
- 实际命令: `bunx vitest run tests/integration/families.test.ts tests/integration/idempotency.test.ts`
- 映射: MAPPED — 幂等重放/409 断言实现阶段落在 idempotency.test.ts 的 FAMILY_CREATE 参数化用例
- 期望: 首次建家庭成功；复用登录 Person；同 key 重放不新增；不同 payload → 409
  [04] $ bunx vitest run tests/integration/families.test.ts tests/integration/idempotency.test.ts
  [04] exit=0 duration=1.3s
  [04] --- real output begin ---
  [04] | 
  [04] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [04] | 
  [04] |  ✓ tests/integration/families.test.ts (6 tests) 152ms
  [04] |  ✓ tests/integration/idempotency.test.ts (21 tests) 714ms
  [04] | 
  [04] |  Test Files  2 passed (2)
  [04] |       Tests  27 passed (27)
  [04] |    Start at  18:09:07
  [04] |    Duration  1.08s (transform 156ms, setup 12ms, collect 508ms, tests 866ms, environment 0ms, prepare 58ms)
  [04] --- real output end ---
- 结果: PASS

## [05/26] age_band 来源可接受性（CHK023）

- Plan 命令: `bun run vitest run tests/domain/age-band-source.test.ts tests/integration/members.test.ts`
- 实际命令: `bunx vitest run tests/domain/provenance.test.ts tests/integration/members.test.ts tests/integration/families.test.ts`
- 映射: MAPPED — age-band-source.test.ts 未落地；来源白名单/逐值来源由 provenance + members + families 覆盖
- 期望: ageBandSource 白名单；UNDER_14 只接受 guardian-origin；伪造 providedByPersonId 被忽略
  [05] $ bunx vitest run tests/domain/provenance.test.ts tests/integration/members.test.ts tests/integration/families.test.ts
  [05] exit=0 duration=1.0s
  [05] --- real output begin ---
  [05] | 
  [05] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [05] | 
  [05] |  ✓ tests/domain/provenance.test.ts (5 tests) 1ms
  [05] |  ✓ tests/integration/families.test.ts (6 tests) 144ms
  [05] |  ✓ tests/integration/members.test.ts (15 tests) 434ms
  [05] | 
  [05] |  Test Files  3 passed (3)
  [05] |       Tests  26 passed (26)
  [05] |    Start at  18:09:08
  [05] |    Duration  811ms (transform 172ms, setup 20ms, collect 545ms, tests 580ms, environment 0ms, prepare 88ms)
  [05] --- real output end ---
- 结果: PASS

## [06/26] “尚无家庭”空态（CHK045）

- Plan 命令: `bun run vitest run tests/integration/families.test.ts`
- 实际命令: `bunx vitest run tests/integration/families.test.ts tests/integration/consent-request.test.ts`
- 映射: MAPPED — 空态的第二个端点（consent request 404）由 consent-request.test.ts 覆盖
- 期望: GET /families/current 404；POST /compliance/guardian-consents/requests 404；非成员 403
  [06] $ bunx vitest run tests/integration/families.test.ts tests/integration/consent-request.test.ts
  [06] exit=0 duration=0.8s
  [06] --- real output begin ---
  [06] | 
  [06] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [06] | 
  [06] |  ✓ tests/integration/families.test.ts (6 tests) 143ms
  [06] |  ✓ tests/integration/consent-request.test.ts (5 tests) 172ms
  [06] | 
  [06] |  Test Files  2 passed (2)
  [06] |       Tests  11 passed (11)
  [06] |    Start at  18:09:09
  [06] |    Duration  539ms (transform 155ms, setup 12ms, collect 505ms, tests 315ms, environment 0ms, prepare 55ms)
  [06] --- real output end ---
- 结果: PASS

## [07/26] FR-016 / 场景 14 / SC-007（Account ↔ Person 1:1）

- Plan 命令: `bun run vitest run tests/db/constraints.test.ts`
- 实际命令: `bunx vitest run tests/db/constraints.test.ts`
- 映射: EXACT
- 期望: 两个方向写入均抛 unique violation
  [07] $ bunx vitest run tests/db/constraints.test.ts
  [07] exit=0 duration=0.4s
  [07] --- real output begin ---
  [07] | 
  [07] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [07] | 
  [07] |  ✓ tests/db/constraints.test.ts (3 tests) 42ms
  [07] | 
  [07] |  Test Files  1 passed (1)
  [07] |       Tests  3 passed (3)
  [07] |    Start at  18:09:10
  [07] |    Duration  168ms (transform 15ms, setup 6ms, collect 15ms, tests 42ms, environment 0ms, prepare 28ms)
  [07] --- real output end ---
- 结果: PASS

## [08/26] FR-017 / 场景 11、12 / SC-006（多对多 + 唯一 membership）

- Plan 命令: `bun run vitest run tests/db/cardinality.test.ts`
- 实际命令: `bunx vitest run tests/db/constraints.test.ts tests/db/schema-structure.test.ts`
- 映射: MAPPED — cardinality.test.ts 未落地；基数与 persons 无 family_id 由 constraints + schema-structure 覆盖
- 期望: 唯一 membership；persons 无 family_id 列；同 Person 可属于多 Family
  [08] $ bunx vitest run tests/db/constraints.test.ts tests/db/schema-structure.test.ts
  [08] exit=0 duration=0.4s
  [08] --- real output begin ---
  [08] | 
  [08] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [08] | 
  [08] |  ✓ tests/db/schema-structure.test.ts (6 tests) 41ms
  [08] |  ✓ tests/db/constraints.test.ts (3 tests) 46ms
  [08] | 
  [08] |  Test Files  2 passed (2)
  [08] |       Tests  9 passed (9)
  [08] |    Start at  18:09:10
  [08] |    Duration  177ms (transform 20ms, setup 11ms, collect 34ms, tests 87ms, environment 0ms, prepare 58ms)
  [08] --- real output end ---
- 结果: PASS

## [09/26] FR-003 / FR-004 / 场景 3 / SC-008（per-value provenance）

- Plan 命令: `bun run vitest run tests/domain/provenance.test.ts tests/integration/members.test.ts`
- 实际命令: `bunx vitest run tests/domain/provenance.test.ts tests/integration/members.test.ts`
- 映射: EXACT
- 期望: 多来源并存；同源 SUPERSEDED；persons 无 source_kind
  [09] $ bunx vitest run tests/domain/provenance.test.ts tests/integration/members.test.ts
  [09] exit=0 duration=1.0s
  [09] --- real output begin ---
  [09] | 
  [09] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [09] | 
  [09] |  ✓ tests/domain/provenance.test.ts (5 tests) 2ms
  [09] |  ✓ tests/integration/members.test.ts (15 tests) 451ms
  [09] | 
  [09] |  Test Files  2 passed (2)
  [09] |       Tests  20 passed (20)
  [09] |    Start at  18:09:10
  [09] |    Duration  818ms (transform 157ms, setup 11ms, collect 270ms, tests 453ms, environment 0ms, prepare 63ms)
  [09] --- real output end ---
- 结果: PASS

## [10/26] FR-008 (a)(b) / 场景 4 / SC-003①（同意前不建正式 child）

- Plan 命令: `bun run vitest run tests/integration/consent-first.test.ts`
- 实际命令: `bunx vitest run tests/integration/consent-first.test.ts`
- 映射: EXACT
- 期望: 403 GUARDIAN_CONSENT_REQUIRED；无 person / profile 落库
  [10] $ bunx vitest run tests/integration/consent-first.test.ts
  [10] exit=0 duration=0.8s
  [10] --- real output begin ---
  [10] | 
  [10] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [10] | 
  [10] |  ✓ tests/integration/consent-first.test.ts (3 tests) 182ms
  [10] | 
  [10] |  Test Files  1 passed (1)
  [10] |       Tests  3 passed (3)
  [10] |    Start at  18:09:11
  [10] |    Duration  539ms (transform 144ms, setup 6ms, collect 243ms, tests 182ms, environment 0ms, prepare 28ms)
  [10] --- real output end ---
- 结果: PASS

## [11/26] D-3.5（结构约束）

- Plan 命令: `bun run vitest run tests/db/consent-structure.test.ts`
- 实际命令: `bunx vitest run tests/db/consent-structure.test.ts`
- 映射: EXACT
- 期望: UNDER_14 + consent NULL 的 profile 写入被 CHECK 拒绝
  [11] $ bunx vitest run tests/db/consent-structure.test.ts
  [11] exit=0 duration=0.4s
  [11] --- real output begin ---
  [11] | 
  [11] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [11] | 
  [11] |  ✓ tests/db/consent-structure.test.ts (3 tests) 51ms
  [11] | 
  [11] |  Test Files  1 passed (1)
  [11] |       Tests  3 passed (3)
  [11] |    Start at  18:09:12
  [11] |    Duration  177ms (transform 14ms, setup 6ms, collect 13ms, tests 51ms, environment 0ms, prepare 26ms)
  [11] --- real output end ---
- 结果: PASS

## [12/26] FR-008 (c) / 场景 5 / SC-003③（同意后建档）

- Plan 命令: `bun run vitest run tests/integration/consent-first.test.ts`
- 实际命令: `bunx vitest run tests/integration/consent-first.test.ts tests/integration/consent-grant.test.ts`
- 映射: MAPPED — grant 响应契约由 consent-grant.test.ts 覆盖，与 consent-first 建档顺序合并验证
- 期望: GRANTED 后建档成功；profile 的 guardian/consent 版本一致
  [12] $ bunx vitest run tests/integration/consent-first.test.ts tests/integration/consent-grant.test.ts
  [12] exit=0 duration=0.8s
  [12] --- real output begin ---
  [12] | 
  [12] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [12] | 
  [12] |  ✓ tests/integration/consent-first.test.ts (3 tests) 174ms
  [12] |  ✓ tests/integration/consent-grant.test.ts (5 tests) 224ms
  [12] | 
  [12] |  Test Files  2 passed (2)
  [12] |       Tests  8 passed (8)
  [12] |    Start at  18:09:13
  [12] |    Duration  588ms (transform 152ms, setup 10ms, collect 502ms, tests 398ms, environment 0ms, prepare 57ms)
  [12] --- real output end ---
- 结果: PASS

## [13/26] FR-010 / 场景 6 / SC-003④（撤回）

- Plan 命令: `bun run vitest run tests/integration/consent-revoke.test.ts`
- 实际命令: `bunx vitest run tests/integration/consent-revoke.test.ts`
- 映射: EXACT
- 期望: REVOKED v2、supersedes 指向 v1、profile 指针前移、audit 存在
  [13] $ bunx vitest run tests/integration/consent-revoke.test.ts
  [13] exit=0 duration=0.8s
  [13] --- real output begin ---
  [13] | 
  [13] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [13] | 
  [13] |  ✓ tests/integration/consent-revoke.test.ts (3 tests) 252ms
  [13] | 
  [13] |  Test Files  1 passed (1)
  [13] |       Tests  3 passed (3)
  [13] |    Start at  18:09:13
  [13] |    Duration  605ms (transform 141ms, setup 6ms, collect 241ms, tests 252ms, environment 0ms, prepare 27ms)
  [13] --- real output end ---
- 结果: PASS

## [14/26] FR-010 / 版本链结构（GRANTED→REVOKED→GRANTED）

- Plan 命令: `bun run vitest run tests/db/consent-chain.test.ts`
- 实际命令: `bunx vitest run tests/integration/consent-revoke.test.ts tests/db/consent-structure.test.ts`
- 映射: MAPPED — consent-chain.test.ts 未落地；版本链与 CHECK 约束由 revoke integration + consent-structure 覆盖
- 期望: v1 GRANTED / v2 REVOKED 可共存；GRANTED 缺 request、REVOKED 带 request 被拒
  [14] $ bunx vitest run tests/integration/consent-revoke.test.ts tests/db/consent-structure.test.ts
  [14] exit=0 duration=0.8s
  [14] --- real output begin ---
  [14] | 
  [14] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [14] | 
  [14] |  ✓ tests/db/consent-structure.test.ts (3 tests) 42ms
  [14] |  ✓ tests/integration/consent-revoke.test.ts (3 tests) 253ms
  [14] | 
  [14] |  Test Files  2 passed (2)
  [14] |       Tests  6 passed (6)
  [14] |    Start at  18:09:14
  [14] |    Duration  620ms (transform 153ms, setup 11ms, collect 271ms, tests 295ms, environment 0ms, prepare 59ms)
  [14] --- real output end ---
- 结果: PASS

## [15/26] 绑定对不可篡改（D-3.3.1）

- Plan 命令: `bun run vitest run tests/db/consent-binding.test.ts`
- 实际命令: `bunx vitest run tests/db/consent-structure.test.ts`
- 映射: MAPPED — consent-binding.test.ts 未落地；consent_records_guard 触发器约束由 consent-structure.test.ts 覆盖
- 期望: bound_person_id / bound_at 绑定对只能由 (NULL,NULL) 变一次
  [15] $ bunx vitest run tests/db/consent-structure.test.ts
  [15] exit=0 duration=0.4s
  [15] --- real output begin ---
  [15] | 
  [15] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [15] | 
  [15] |  ✓ tests/db/consent-structure.test.ts (3 tests) 46ms
  [15] | 
  [15] |  Test Files  1 passed (1)
  [15] |       Tests  3 passed (3)
  [15] |    Start at  18:09:15
  [15] |    Duration  171ms (transform 14ms, setup 6ms, collect 14ms, tests 46ms, environment 0ms, prepare 27ms)
  [15] --- real output end ---
- 结果: PASS

## [16/26] FR-009 / 场景 10 / SC-004（UNKNOWN 不按成人）

- Plan 命令: `bun run vitest run tests/domain/age-band.test.ts`
- 实际命令: `bunx vitest run tests/domain/age-band.test.ts`
- 映射: EXACT
- 期望: UNKNOWN → BLOCK / AGE_BAND_UNKNOWN；NOT_COLLECTED 不是合法 age_band
  [16] $ bunx vitest run tests/domain/age-band.test.ts
  [16] exit=0 duration=0.3s
  [16] --- real output begin ---
  [16] | 
  [16] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [16] | 
  [16] |  ✓ tests/domain/age-band.test.ts (8 tests) 1ms
  [16] | 
  [16] |  Test Files  1 passed (1)
  [16] |       Tests  8 passed (8)
  [16] |    Start at  18:09:16
  [16] |    Duration  125ms (transform 18ms, setup 6ms, collect 12ms, tests 1ms, environment 0ms, prepare 27ms)
  [16] --- real output end ---
- 结果: PASS

## [17/26] FR-011 / 场景 7、8、9（授权与伪造 ID）

- Plan 命令: `bun run vitest run tests/integration/authorization.test.ts tests/db/rls.test.ts`
- 实际命令: `bunx vitest run tests/integration/authorization.test.ts tests/db/rls.test.ts`
- 映射: EXACT
- 期望: 跨家庭 403 无目标字段；伪造 family_id 无效；非 manager 403；无上下文 0 行
  [17] $ bunx vitest run tests/integration/authorization.test.ts tests/db/rls.test.ts
  [17] exit=0 duration=0.9s
  [17] --- real output begin ---
  [17] | 
  [17] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [17] | 
  [17] |  ✓ tests/db/rls.test.ts (10 tests) 101ms
  [17] |  ✓ tests/integration/authorization.test.ts (7 tests) 281ms
  [17] | 
  [17] |  Test Files  2 passed (2)
  [17] |       Tests  17 passed (17)
  [17] |    Start at  18:09:16
  [17] |    Duration  656ms (transform 161ms, setup 11ms, collect 283ms, tests 382ms, environment 0ms, prepare 57ms)
  [17] --- real output end ---
- 结果: PASS

## [18/26] FR-006a / guardian-but-not-member

- Plan 命令: `bun run vitest run tests/integration/authorization-dimensions.test.ts`
- 实际命令: `bunx vitest run tests/integration/authorization-dimensions.test.ts`
- 映射: EXACT
- 期望: guardian 关系不构成 Family 访问权限；403 且响应无目标字段
  [18] $ bunx vitest run tests/integration/authorization-dimensions.test.ts
  [18] exit=0 duration=0.9s
  [18] --- real output begin ---
  [18] | 
  [18] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [18] | 
  [18] |  ✓ tests/integration/authorization-dimensions.test.ts (5 tests) 271ms
  [18] | 
  [18] |  Test Files  1 passed (1)
  [18] |       Tests  5 passed (5)
  [18] |    Start at  18:09:17
  [18] |    Duration  634ms (transform 147ms, setup 6ms, collect 249ms, tests 271ms, environment 0ms, prepare 27ms)
  [18] --- real output end ---
- 结果: PASS

## [19/26] FR-006b / member-but-not-guardian

- Plan 命令: `bun run vitest run tests/integration/authorization-dimensions.test.ts`
- 实际命令: `bunx vitest run tests/integration/authorization-dimensions.test.ts`
- 映射: EXACT
- 期望: grant 与 revoke 被拒，正式错误码 NOT_GUARDIAN
  [19] $ bunx vitest run tests/integration/authorization-dimensions.test.ts
  [19] exit=0 duration=0.8s
  [19] --- real output begin ---
  [19] | 
  [19] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [19] | 
  [19] |  ✓ tests/integration/authorization-dimensions.test.ts (5 tests) 252ms
  [19] | 
  [19] |  Test Files  1 passed (1)
  [19] |       Tests  5 passed (5)
  [19] |    Start at  18:09:18
  [19] |    Duration  609ms (transform 141ms, setup 6ms, collect 240ms, tests 252ms, environment 0ms, prepare 27ms)
  [19] --- real output end ---
- 结果: PASS

## [20/26] FR-007 / Compliance Profile（band × minor_mode × 来源）

- Plan 命令: `bun run vitest run tests/integration/profiles.test.ts tests/db/consent-structure.test.ts`
- 实际命令: `bunx vitest run tests/integration/members.test.ts tests/integration/consent-first.test.ts tests/db/consent-structure.test.ts`
- 映射: MAPPED — profiles.test.ts 未落地；profile 的 band/minor_mode/verified_source 由 members + consent-first + consent-structure 覆盖
- 期望: ADULT minor_mode=false；MINOR/UNDER_14 minor_mode=true；verified_source 实际落库
  [20] $ bunx vitest run tests/integration/members.test.ts tests/integration/consent-first.test.ts tests/db/consent-structure.test.ts
  [20] exit=0 duration=1.1s
  [20] --- real output begin ---
  [20] | 
  [20] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [20] | 
  [20] |  ✓ tests/db/consent-structure.test.ts (3 tests) 43ms
  [20] |  ✓ tests/integration/consent-first.test.ts (3 tests) 180ms
  [20] |  ✓ tests/integration/members.test.ts (15 tests) 454ms
  [20] | 
  [20] |  Test Files  3 passed (3)
  [20] |       Tests  21 passed (21)
  [20] |    Start at  18:09:18
  [20] |    Duration  837ms (transform 171ms, setup 17ms, collect 557ms, tests 678ms, environment 0ms, prepare 91ms)
  [20] --- real output end ---
- 结果: PASS

## [21/26] FR-012 / FR-015 / 验收最后一组（RLS 与主键）

- Plan 命令: `bun run vitest run tests/db/rls.test.ts`
- 实际命令: `bunx vitest run tests/db/rls.test.ts tests/db/roles.test.ts`
- 映射: MAPPED — owner ≠ app / NOBYPASSRLS 由 roles.test.ts 覆盖，与 rls.test.ts 合并验证
- 期望: relrowsecurity/relforcerowsecurity=true；rolbypassrls=false；uuidv7 默认值
  [21] $ bunx vitest run tests/db/rls.test.ts tests/db/roles.test.ts
  [21] exit=0 duration=0.4s
  [21] --- real output begin ---
  [21] | 
  [21] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [21] | 
  [21] |  ✓ tests/db/roles.test.ts (12 tests) 75ms
  [21] |  ✓ tests/db/rls.test.ts (10 tests) 90ms
  [21] | 
  [21] |  Test Files  2 passed (2)
  [21] |       Tests  22 passed (22)
  [21] |    Start at  18:09:19
  [21] |    Duration  225ms (transform 25ms, setup 12ms, collect 41ms, tests 165ms, environment 0ms, prepare 58ms)
  [21] --- real output end ---
- 结果: PASS

## [22/26] FR-013（事务上下文）

- Plan 命令: `bun run vitest run tests/integration/rls-transaction.test.ts`
- 实际命令: `bunx vitest run tests/db/rls.test.ts tests/integration/authorization.test.ts`
- 映射: MAPPED — rls-transaction.test.ts 未落地；连接池上下文不泄漏 / set_family_context 42501 由 rls.test.ts 与 authorization.test.ts 覆盖
- 期望: 事务外上下文查询 0 行；非成员 set_family_context 抛 42501；连接池不泄漏
  [22] $ bunx vitest run tests/db/rls.test.ts tests/integration/authorization.test.ts
  [22] exit=0 duration=0.9s
  [22] --- real output begin ---
  [22] | 
  [22] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [22] | 
  [22] |  ✓ tests/db/rls.test.ts (10 tests) 107ms
  [22] |  ✓ tests/integration/authorization.test.ts (7 tests) 279ms
  [22] | 
  [22] |  Test Files  2 passed (2)
  [22] |       Tests  17 passed (17)
  [22] |    Start at  18:09:20
  [22] |    Duration  655ms (transform 162ms, setup 13ms, collect 283ms, tests 387ms, environment 0ms, prepare 54ms)
  [22] --- real output end ---
- 结果: PASS

## [23/26] FR-014 / SC-005（幂等）

- Plan 命令: `bun run vitest run tests/integration/idempotency.test.ts`
- 实际命令: `bunx vitest run tests/integration/idempotency.test.ts`
- 映射: EXACT
- 期望: 六命令参数化矩阵；并发 20 次同 key 记录数不变；不同 payload → 409
  [23] $ bunx vitest run tests/integration/idempotency.test.ts
  [23] exit=0 duration=1.3s
  [23] --- real output begin ---
  [23] | 
  [23] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [23] | 
  [23] |  ✓ tests/integration/idempotency.test.ts (21 tests) 724ms
  [23] | 
  [23] |  Test Files  1 passed (1)
  [23] |       Tests  21 passed (21)
  [23] |    Start at  18:09:21
  [23] |    Duration  1.08s (transform 147ms, setup 6ms, collect 246ms, tests 724ms, environment 0ms, prepare 27ms)
  [23] --- real output end ---
- 结果: PASS

## [24/26] 幂等表跨账号隔离

- Plan 命令: `bun run vitest run tests/db/idempotency-rls.test.ts`
- 实际命令: `bunx vitest run tests/db/idempotency-rls.test.ts`
- 映射: EXACT
- 期望: A 只见 A 的 key；B 的 key 回放 0 行；无上下文写入被拒
  [24] $ bunx vitest run tests/db/idempotency-rls.test.ts
  [24] exit=0 duration=0.4s
  [24] --- real output begin ---
  [24] | 
  [24] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [24] | 
  [24] |  ✓ tests/db/idempotency-rls.test.ts (3 tests) 64ms
  [24] | 
  [24] |  Test Files  1 passed (1)
  [24] |       Tests  3 passed (3)
  [24] |    Start at  18:09:22
  [24] |    Duration  191ms (transform 14ms, setup 6ms, collect 13ms, tests 64ms, environment 0ms, prepare 26ms)
  [24] --- real output end ---
- 结果: PASS

## [25/26] 全部 OpenAPI 合同

- Plan 命令: `bun run openapi:check`
- 实际命令: `bun run openapi:check`
- 映射: EXACT
- 期望: OpenAPI 可生成；generated client 无未预期 diff
  [25] $ bun run openapi:check
  [25] exit=0 duration=0.5s
  [25] --- real output begin ---
  [25] | openapi-check: PASS (semantic equivalence with frozen contracts)
  [25] | $ bun scripts/openapi-check.mjs
  [25] --- real output end ---
- 结果: PASS

## [26/26] 治理（不修改受保护文件）

- Plan 命令: `node .specify/scripts/validate-governance.mjs；node .specify/scripts/tests/run-governance-tests.mjs；git diff --name-only origin/main...HEAD`
- 实际命令: `bunx vitest run tests/integration/openapi.test.ts`
- 映射: MAPPED — 原三条命令移至下方 GOVERNANCE 段原样执行；此处同时跑 contract 测试覆盖 §27A
- 期望: 治理两命令 PASS；diff 不含 Docs/** / spec.md / .specify/memory/**
  [26] $ bunx vitest run tests/integration/openapi.test.ts
  [26] exit=0 duration=0.8s
  [26] --- real output begin ---
  [26] | 
  [26] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [26] | 
  [26] |  ✓ tests/integration/openapi.test.ts (7 tests) 175ms
  [26] | 
  [26] |  Test Files  1 passed (1)
  [26] |       Tests  7 passed (7)
  [26] |    Start at  18:09:23
  [26] |    Duration  533ms (transform 146ms, setup 6ms, collect 244ms, tests 175ms, environment 0ms, prepare 27ms)
  [26] --- real output end ---
- 结果: PASS

## GOVERNANCE（Plan 第 26 条的三条原始命令，原样执行）

  [validate-governance] $ node .specify/scripts/validate-governance.mjs
  [validate-governance] exit=0 duration=0.1s
  [validate-governance] --- real output begin ---
  [validate-governance] | Feature lifecycle:
  [validate-governance] | - specs/001-family-identity-core [tasked]
  [validate-governance] | - specs/002-case-core [tasked]
  [validate-governance] | - specs/003-evidence-core [tasked]
  [validate-governance] | - specs/004-case-participant-core [tasked]
  [validate-governance] | - specs/005-invited-identity-binding-contract [spec-only]
  [validate-governance] | - specs/006-identity-binding-runtime [tasked]
  [validate-governance] | - specs/007-case-primary-switch [tasked]
  [validate-governance] | Spec governance validation PASS
  [validate-governance] --- real output end ---
  [validate-governance] 结果: PASS

  [governance self-test] $ node .specify/scripts/tests/run-governance-tests.mjs
  [governance self-test] exit=0 duration=0.5s
  [governance self-test] --- real output begin ---
  [governance self-test] | PASS  A spec-only feature passes — expected exit 0, got 0
  [governance self-test] | PASS  B plan.md without spec.md fails — expected exit 1, got 1
  [governance self-test] | PASS  C tasks.md without plan.md fails — expected exit 1, got 1
  [governance self-test] | PASS  D spec+plan+tasks with REQ and VERIFY passes — expected exit 0, got 0
  [governance self-test] | PASS  E task without [REQ:...] fails — expected exit 1, got 1
  [governance self-test] | PASS  F task without [VERIFY:...] fails — expected exit 1, got 1
  [governance self-test] | PASS  completed lowercase task passes — expected exit 0, got 0
  [governance self-test] | PASS  completed uppercase task passes — expected exit 0, got 0
  [governance self-test] | PASS  mixed completed and pending tasks pass — expected exit 0, got 0
  [governance self-test] | PASS  completed task without REQ fails — expected exit 1, got 1
  [governance self-test] | PASS  completed task without VERIFY fails — expected exit 1, got 1
  [governance self-test] | PASS  G Docs change without approval fails — expected exit 1, got 1
  [governance self-test] | PASS  H approved Docs override passes the Docs gate — expected exit 0, got 0
  [governance self-test] | PASS  I no Docs change passes without a label — expected exit 0, got 0
  [governance self-test] | PASS  H2 override does not disable other governance checks — expected exit 1, got 1 (docs gate=0)
  [governance self-test] | 
  [governance self-test] | Governance self-test PASS: 15/15 cases.
  [governance self-test] --- real output end ---
  [governance self-test] 结果: PASS

  [protected-file diff] $ git diff --name-only origin/main...HEAD
  [protected-file diff] exit=0 duration=0.0s
  [protected-file diff] --- real output begin ---
  [protected-file diff] | apps/server/api/src/openapi-spec.ts
  [protected-file diff] | apps/server/api/src/plugins/error-handler.ts
  [protected-file diff] | apps/server/api/src/routes/cases.ts
  [protected-file diff] | db/migrations/007_case_primary_switch.sql
  [protected-file diff] | packages/authorization/src/authorize.ts
  [protected-file diff] | packages/contracts/src/schemas.ts
  [protected-file diff] | packages/domain/src/case-primary-switch.ts
  [protected-file diff] | packages/domain/src/cases.ts
  [protected-file diff] | packages/domain/src/idempotency.ts
  [protected-file diff] | packages/domain/src/index.ts
  [protected-file diff] | packages/generated/openapi.d.ts
  [protected-file diff] | packages/generated/openapi.json
  [protected-file diff] | scripts/db-evidence.mjs
  [protected-file diff] | scripts/lib/openapi-normalize.mjs
  [protected-file diff] | scripts/openapi-check.mjs
  [protected-file diff] | specs/007-case-primary-switch/checklists/requirements-quality.md
  [protected-file diff] | specs/007-case-primary-switch/contracts/case-primary-switch-api.openapi.yaml
  [protected-file diff] | specs/007-case-primary-switch/plan.md
  [protected-file diff] | specs/007-case-primary-switch/spec.md
  [protected-file diff] | specs/007-case-primary-switch/tasks.md
  [protected-file diff] | tests/db/case-primary-switch-concurrency.test.ts
  [protected-file diff] | tests/db/case-primary-switch-rls.test.ts
  [protected-file diff] | tests/db/case-primary-switch-schema.test.ts
  [protected-file diff] | tests/db/case-primary-switch-shared-vocabulary.test.ts
  [protected-file diff] | tests/db/cases-rls.test.ts
  [protected-file diff] | tests/db/migration-case-primary-switch-upgrade.test.ts
  [protected-file diff] | tests/db/migration-case-status-paused-removal.test.ts
  [protected-file diff] | tests/db/migration-upgrade-evidence.test.ts
  [protected-file diff] | tests/db/roles.test.ts
  [protected-file diff] | tests/domain/case-primary-switch-authorization.test.ts
  [protected-file diff] | tests/domain/case-primary-switch-contracts.test.ts
  [protected-file diff] | tests/domain/case-primary-switch-decision.test.ts
  [protected-file diff] | tests/domain/case-primary-switch-idempotency.test.ts
  [protected-file diff] | tests/domain/case-primary-switch-lock-order.test.ts
  [protected-file diff] | tests/domain/case-primary-switch-reason-unicode.test.ts
  [protected-file diff] | tests/evidence/007-remediation-iii-db-evidence.md
  [protected-file diff] | tests/evidence/007-remediation-iii-full-regression.md
  [protected-file diff] | tests/evidence/007-remediation-iii-slice7-suite.md
  [protected-file diff] | tests/evidence/007-remediation-iii-targeted.md
  [protected-file diff] | tests/evidence/db-evidence.log
  [protected-file diff] | tests/integration/case-primary-switch-atomicity.test.ts
  [protected-file diff] | tests/integration/case-primary-switch-authorization-fault.test.ts
  [protected-file diff] | tests/integration/case-primary-switch-authorization.test.ts
  [protected-file diff] | tests/integration/case-primary-switch-conflicts.test.ts
  [protected-file diff] | tests/integration/case-primary-switch-happy.test.ts
  [protected-file diff] | tests/integration/case-primary-switch-idempotency.test.ts
  [protected-file diff] | tests/integration/case-primary-switch-json-boundary.test.ts
  [protected-file diff] | tests/integration/case-primary-switch-reason-persistence.test.ts
  [protected-file diff] | tests/integration/case-primary-switch-scope.test.ts
  [protected-file diff] | tests/integration/cases-scope.test.ts
  [protected-file diff] | tests/integration/openapi-case-primary-switch.test.ts
  [protected-file diff] | tests/integration/openapi-cases.test.ts
  [protected-file diff] | tests/integration/openapi-runtime-drift.test.ts
  [protected-file diff] | tests/integration/openapi-semantic-equivalence.test.ts
  [protected-file diff] | tests/integration/openapi.test.ts
  [protected-file diff] --- real output end ---
  [protected-file diff] 结果: PASS

## FINAL GATES

  [G1 全量测试套件] $ bunx vitest run --reporter=default --reporter=json --outputFile.json=/var/folders/fl/3drhw1k154zct4qrgjlqbn_r0000gn/T/xiaoshuyin-vitest-results-7754.json
  [G1 全量测试套件] exit=0 duration=45.0s
  [G1 全量测试套件] --- real output begin ---
  [G1 全量测试套件] | 
  [G1 全量测试套件] |  RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [G1 全量测试套件] | 
  [G1 全量测试套件] |  ✓ tests/db/participants-history.test.ts (3 tests) 191ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-gate2-barrier-matrix.test.ts (14 tests) 5778ms
  [G1 全量测试套件] |    ✓ H-02 Gate 2 barrier matrix (MEDIUM-02) > profile / age-band: Gate lock blocks the concurrent profile UPDATE  674ms
  [G1 全量测试套件] |    ✓ H-02 Gate 2 barrier matrix (MEDIUM-02) > missing compliance profile: Gate lock blocks the concurrent profile DELETE  650ms
  [G1 全量测试套件] |    ✓ H-02 Gate 2 barrier matrix (MEDIUM-02) > consent: Gate lock blocks the concurrent runtime-role consent UPDATE  674ms
  [G1 全量测试套件] |    ✓ H-02 Gate 2 barrier matrix (MEDIUM-02) > guardian relationship: Gate lock blocks the concurrent guardian UPDATE  666ms
  [G1 全量测试套件] |    ✓ H-02 Gate 2 barrier matrix (MEDIUM-02) > membership: Gate lock blocks the concurrent membership DELETE  631ms
  [G1 全量测试套件] |    ✓ H-02 Gate 2 barrier matrix (MEDIUM-02) > P1 binding conflict: Gate lock blocks the concurrent P1 binding UPDATE  636ms
  [G1 全量测试套件] |    ✓ H-02 Gate 2 barrier matrix (MEDIUM-02) > membership insert: binding-first second-family INSERT cannot cross the linearization point  600ms
  [G1 全量测试套件] |    ✓ H-02 Gate 2 barrier matrix (MEDIUM-02) > family manager authority: binding-first family creator UPDATE cannot cross the linearization point  580ms
  [G1 全量测试套件] |  ✓ tests/integration/cases-authorization-error-classification.test.ts (5 tests) 6427ms
  [G1 全量测试套件] |    ✓ Slice 2 authz error classification > a real 57014 at requireFamilyAction -> readFacts is NOT a known denial  1494ms
  [G1 全量测试套件] |    ✓ Slice 2 authz error classification > POST /api/v1/cases propagates authorization-fact 57014 to generic 500, not 403  1587ms
  [G1 全量测试套件] |    ✓ Slice 2 authz error classification > GET /api/v1/cases propagates authorization-fact 57014 to generic 500, not 403  1574ms
  [G1 全量测试套件] |    ✓ Slice 2 authz error classification > GET /api/v1/cases/:id propagates authorization-fact 57014 to generic 500, not 404  1601ms
  [G1 全量测试套件] |  ✓ tests/integration/messages-authorization-error-classification.test.ts (4 tests) 3666ms
  [G1 全量测试套件] |    ✓ ULT-002 authorization error classification > injects real 57014 at requireFamilyAction -> readFacts, not current-family resolution  1516ms
  [G1 全量测试套件] |    ✓ ULT-002 authorization error classification > maps authorization-fact 57014 to 500, rolls back, then the same request succeeds after fault removal  1864ms
  [G1 全量测试套件] |  ✓ tests/integration/error-log-redaction.test.ts (1 test) 10334ms
  [G1 全量测试套件] |    ✓ unexpected error logging is redacted > logs SQLSTATE and request metadata without request-derived values  10277ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-create-authorization-order.test.ts (3 tests) 5196ms
  [G1 全量测试套件] |    ✓ Slice 4 H-01 create-invite authorization → idempotency ordering > H-01 Case 1 — exact replay still executes the CURRENT Family authorization first  1597ms
  [G1 全量测试套件] |    ✓ Slice 4 H-01 create-invite authorization → idempotency ordering > H-01 Case 2 — unexpected authorization-fact 57014 cannot be bypassed by an exact replay  3428ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-failure-injection.test.ts (6 tests) 1266ms
  [G1 全量测试套件] |    ✓ Phase C rollback failure-injection matrix (F-08) > Person binding update failure rolls back and returns RETRYABLE  562ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-anti-enumeration.test.ts (5 tests) 1329ms
  [G1 全量测试套件] |    ✓ candidate-facing anti-enumeration > bootstrap generic branches are observationally identical (T101 matrix)  803ms
  [G1 全量测试套件] |  ✓ tests/integration/case-primary-switch-authorization-fault.test.ts (2 tests) 1792ms
  [G1 全量测试套件] |    ✓ S7-H02-C switch-primary authorization error classification > a real 57014 at the authorization fact read propagates to 500, never 404  1603ms
  [G1 全量测试套件] |  ✓ tests/integration/guard-scope.test.ts (28 tests) 3674ms
  [G1 全量测试套件] | {"level":50,"time":1794305379847,"pid":<pid>,"hostname":"<host>","reqId":"req-23","requestId":"req-23","method":"POST","route":"/api/v1/identity-bindings/pairing-decision","msg":"unhandled request error"}
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-idempotency.test.ts (9 tests) 1074ms
  [G1 全量测试套件] |  ✓ tests/db/migration-case-status-paused-removal.test.ts (3 tests) 963ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-commit-gate2.test.ts (5 tests) 903ms
  [G1 全量测试套件] |    ✓ Gate 2 commit-time recheck (T073) > concurrent consent revoke committed before the linearization point blocks the commit (F-01)  355ms
  [G1 全量测试套件] |  ✓ tests/db/identity-binding-rls.test.ts (9 tests) 794ms
  [G1 全量测试套件] |    ✓ binding RLS isolation > H-02: runtime role locks authoritative Gate rows and blocks concurrent invalidation  371ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-context-cleanup.test.ts (7 tests) 778ms
  [G1 全量测试套件] | {"level":50,"time":1794305381965,"pid":<pid>,"hostname":"<host>","reqId":"req-17","requestId":"req-17","method":"POST","route":"/api/v1/identity-bindings/pairing-decision","msg":"unhandled request error"}
  [G1 全量测试套件] |  ✓ tests/integration/idempotency.test.ts (21 tests) 1327ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-no-p2.test.ts (6 tests) 969ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-candidate.test.ts (7 tests) 1032ms
  [G1 全量测试套件] | {"level":50,"time":1794305382895,"pid":<pid>,"hostname":"<host>","reqId":"req-11","requestId":"req-11","method":"POST","route":"/api/v1/identity-bindings/pairing-decision","msg":"unhandled request error"}
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-slice4-e2e.test.ts (5 tests) 612ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-pairing-rotation.test.ts (5 tests) 705ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-confirmer.test.ts (5 tests) 723ms
  [G1 全量测试套件] | {"level":50,"time":1794305383758,"pid":<pid>,"hostname":"<host>","reqId":"req-10","requestId":"req-10","method":"POST","route":"/api/v1/identity-bindings/pairing-decision","msg":"unhandled request error"}
  [G1 全量测试套件] |  ✓ tests/db/identity-binding-concurrency.test.ts (4 tests) 653ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-confirmer-replay.test.ts (4 tests) 729ms
  [G1 全量测试套件] |  ✓ tests/db/identity-binding-operation-key-repository.test.ts (7 tests) 649ms
  [G1 全量测试套件] |  ✓ tests/integration/processing-gate.test.ts (5 tests) 659ms
  [G1 全量测试套件] |  ✓ tests/integration/current-family-determinism.test.ts (11 tests) 820ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-candidate-eligibility.test.ts (8 tests) 860ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-invitation-contract.test.ts (6 tests) 333ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-compliance.test.ts (7 tests) 639ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-commit.test.ts (4 tests) 660ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-status.test.ts (4 tests) 846ms
  [G1 全量测试套件] |    ✓ candidate status (T061) > M-03: status expiry settles once and scrubs every attempt context  308ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-context-commit-selection.test.ts (3 tests) 876ms
  [G1 全量测试套件] |    ✓ Phase C context selection (PR #16 review Finding 2) > uses the fresh usable context B after historical context A has expired and been scrubbed  454ms
  [G1 全量测试套件] | {"level":50,"time":1794305386977,"pid":<pid>,"hostname":"<host>","reqId":"req-8","requestId":"req-8","method":"POST","route":"/api/v1/identity-bindings/pairing-decision","msg":"unhandled request error"}
  [G1 全量测试套件] |  ✓ tests/integration/participations-identity-seam.test.ts (5 tests) 873ms
  [G1 全量测试套件] |    ✓ Slice 4 ↔ Slice 5 identity seam > Case C: real Slice 4 invitation drives Slice 5 binding, but explicit participation accept is still required  549ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-audit.test.ts (3 tests) 489ms
  [G1 全量测试套件] |  ✓ tests/db/case-primary-switch-concurrency.test.ts (5 tests) 428ms
  [G1 全量测试套件] | {"level":50,"time":1794305387661,"pid":<pid>,"hostname":"<host>","reqId":"req-1","requestId":"req-1","method":"POST","route":"/api/v1/cases/:id/participation-invites","msg":"unhandled request error"}
  [G1 全量测试套件] |  ✓ tests/integration/members.test.ts (15 tests) 546ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-idempotency.test.ts (6 tests) 471ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-bootstrap.test.ts (5 tests) 470ms
  [G1 全量测试套件] |  ✓ tests/integration/age-band-source.test.ts (12 tests) 474ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-account.test.ts (4 tests) 453ms
  [G1 全量测试套件] |  ✓ tests/db/identity-binding-context.test.ts (5 tests) 524ms
  [G1 全量测试套件] | {"level":50,"time":1794305389104,"pid":<pid>,"hostname":"<host>","reqId":"req-m","requestId":"req-m","method":"POST","route":"/api/v1/cases","msg":"unhandled request error"}
  [G1 全量测试套件] | {"level":50,"time":1794305389131,"pid":<pid>,"hostname":"<host>","reqId":"req-p","requestId":"req-p","method":"POST","route":"/api/v1/cases","msg":"unhandled request error"}
  [G1 全量测试套件] |  ✓ tests/integration/cases-create.test.ts (18 tests) 490ms
  [G1 全量测试套件] | {"level":50,"time":1794305389156,"pid":<pid>,"hostname":"<host>","reqId":"req-s","requestId":"req-s","method":"POST","route":"/api/v1/cases","msg":"unhandled request error"}
  [G1 全量测试套件] | {"level":50,"time":1794305389186,"pid":<pid>,"hostname":"<host>","reqId":"req-v","requestId":"req-v","method":"POST","route":"/api/v1/cases","msg":"unhandled request error"}
  [G1 全量测试套件] |  ✓ tests/integration/cases-idempotency-identity.test.ts (9 tests) 1137ms
  [G1 全量测试套件] |    ✓ CASE_CREATE exact identity (round 2) > serializes concurrent identical byte keys into one business result  360ms
  [G1 全量测试套件] |    ✓ CASE_CREATE exact identity (round 2) > does not merge distinct byte keys under concurrency  360ms
  [G1 全量测试套件] |  ✓ tests/integration/messages-idempotency.test.ts (5 tests) 1153ms
  [G1 全量测试套件] |    ✓ Message idempotency (T025/T048) > same key + same content replays the original 201 body with no new writes  778ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-attempt-create.test.ts (3 tests) 431ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-pairing.test.ts (3 tests) 514ms
  [G1 全量测试套件] |  ✓ tests/integration/case-primary-switch-idempotency.test.ts (5 tests) 404ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-commit-settle.test.ts (3 tests) 375ms
  [G1 全量测试套件] |  ✓ tests/db/identity-binding-attempt-repository.test.ts (4 tests) 399ms
  [G1 全量测试套件] |  ✓ tests/db/identity-binding-p1-commit.test.ts (3 tests) 368ms
  [G1 全量测试套件] |  ✓ tests/integration/messages-connection-loss.test.ts (2 tests) 398ms
  [G1 全量测试套件] |  ✓ tests/integration/cases-read.test.ts (7 tests) 392ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-expiry.test.ts (3 tests) 252ms
  [G1 全量测试套件] |  ✓ tests/integration/case-primary-switch-conflicts.test.ts (6 tests) 347ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-withdraw.test.ts (2 tests) 202ms
  [G1 全量测试套件] |  ✓ tests/integration/consent-validity.test.ts (5 tests) 321ms
  [G1 全量测试套件] |  ✓ tests/integration/cases-http-boundary.test.ts (10 tests) 354ms
  [G1 全量测试套件] |  ✓ tests/db/migration-case-primary-switch-upgrade.test.ts (2 tests) 369ms
  [G1 全量测试套件] |  ✓ tests/integration/messages-create.test.ts (7 tests) 358ms
  [G1 全量测试套件] |  ✓ tests/db/identity-binding-confirmation-repository.test.ts (3 tests) 405ms
  [G1 全量测试套件] |  ✓ tests/db/participants-rls.test.ts (7 tests) 325ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-confirmer-list.test.ts (3 tests) 375ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-candidate-auth.test.ts (3 tests) 374ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-audit.test.ts (3 tests) 330ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-error-envelope.test.ts (5 tests) 329ms
  [G1 全量测试套件] |  ✓ tests/integration/consent-request-candidate.test.ts (4 tests) 336ms
  [G1 全量测试套件] |  ✓ tests/db/migration-upgrade-evidence.test.ts (2 tests) 298ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-confirmer-reject.test.ts (2 tests) 418ms
  [G1 全量测试套件] |  ✓ tests/integration/consent-grant-authz.test.ts (6 tests) 293ms
  [G1 全量测试套件] |  ✓ tests/integration/consent-reconsent.test.ts (5 tests) 324ms
  [G1 全量测试套件] |  ✓ tests/integration/messages-authorization.test.ts (6 tests) 334ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-anti-enumeration.test.ts (3 tests) 280ms
  [G1 全量测试套件] |  ✓ tests/integration/authorization.test.ts (7 tests) 346ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-bootstrap-route.test.ts (5 tests) 351ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-gate1.test.ts (4 tests) 314ms
  [G1 全量测试套件] |  ✓ tests/integration/cases-authorization.test.ts (7 tests) 311ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-accept-concurrency.test.ts (3 tests) 288ms
  [G1 全量测试套件] |  ✓ tests/integration/case-primary-switch-happy.test.ts (4 tests) 259ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-authorization-surfaces.test.ts (3 tests) 277ms
  [G1 全量测试套件] |  ✓ tests/integration/evidence-write.test.ts (14 tests) 434ms
  [G1 全量测试套件] |  ✓ tests/integration/consent-revoke.test.ts (3 tests) 352ms
  [G1 全量测试套件] |  ✓ tests/integration/authorization-dimensions.test.ts (5 tests) 316ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-read.test.ts (2 tests) 241ms
  [G1 全量测试套件] |  ✓ tests/db/identity-binding-audit-repository.test.ts (5 tests) 286ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-invite-lookup.test.ts (2 tests) 264ms
  [G1 全量测试套件] |  ✓ tests/integration/evidence-person-processing-gate.test.ts (18 tests) 261ms
  [G1 全量测试套件] |  ✓ tests/integration/case-primary-switch-json-boundary.test.ts (4 tests) 227ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-authorization.test.ts (2 tests) 184ms
  [G1 全量测试套件] |  ✓ tests/domain/package-boundary.test.ts (8 tests) 245ms
  [G1 全量测试套件] |  ✓ tests/db/cases-primary-concurrency.test.ts (3 tests) 264ms
  [G1 全量测试套件] |  ✓ tests/integration/consent-grant.test.ts (5 tests) 276ms
  [G1 全量测试套件] |  ✓ tests/integration/case-primary-switch-authorization.test.ts (3 tests) 245ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-replay.test.ts (1 test) 289ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-cross-family.test.ts (3 tests) 340ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-accept.test.ts (2 tests) 336ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-rollback.test.ts (1 test) 537ms
  [G1 全量测试套件] |    ✓ Phase C concurrency loser leaves no orphan Account (H4) > rolls back the newly created Account when the P1 binding update loses  474ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-confirmer-independent.test.ts (2 tests) 543ms
  [G1 全量测试套件] |    ✓ independent confirmer authentication > candidate context cannot call confirmer routes  414ms
  [G1 全量测试套件] |  ✓ tests/integration/transaction-boundary.test.ts (5 tests) 573ms
  [G1 全量测试套件] |  ✓ tests/integration/cases-current-family-ambiguous.test.ts (3 tests) 350ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-session.test.ts (1 test) 384ms
  [G1 全量测试套件] |    ✓ session exchange > is generic before commit and issues the ordinary session after commit  336ms
  [G1 全量测试套件] |  ✓ tests/integration/consent-request-authz.test.ts (6 tests) 308ms
  [G1 全量测试套件] |  ✓ tests/integration/consent-evidence.test.ts (3 tests) 200ms
  [G1 全量测试套件] |  ✓ tests/integration/messages-authorization-before-replay.test.ts (2 tests) 217ms
  [G1 全量测试套件] |  ✓ tests/integration/case-primary-switch-reason-persistence.test.ts (2 tests) 198ms
  [G1 全量测试套件] | {"level":50,"time":1794305401274,"pid":<pid>,"hostname":"<host>","reqId":"req-5","requestId":"req-5","method":"POST","route":"/api/v1/cases/:id/switch-primary","sqlstate":"P0001","msg":"unhandled request error"}
  [G1 全量测试套件] | {"level":50,"time":1794305401292,"pid":<pid>,"hostname":"<host>","reqId":"req-6","requestId":"req-6","method":"POST","route":"/api/v1/cases/:id/switch-primary","sqlstate":"P0001","msg":"unhandled request error"}
  [G1 全量测试套件] | {"level":50,"time":1794305401309,"pid":<pid>,"hostname":"<host>","reqId":"req-7","requestId":"req-7","method":"POST","route":"/api/v1/cases/:id/switch-primary","sqlstate":"P0001","msg":"unhandled request error"}
  [G1 全量测试套件] | {"level":50,"time":1794305401325,"pid":<pid>,"hostname":"<host>","reqId":"req-8","requestId":"req-8","method":"POST","route":"/api/v1/cases/:id/switch-primary","sqlstate":"23514","msg":"unhandled request error"}
  [G1 全量测试套件] |  ✓ tests/integration/case-primary-switch-atomicity.test.ts (4 tests) 199ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-case-b.test.ts (2 tests) 208ms
  [G1 全量测试套件] |  ✓ tests/db/evidence-raw-writer-guard.test.ts (5 tests) 188ms
  [G1 全量测试套件] |  ✓ tests/integration/coverage-audit.test.ts (17 tests) 209ms
  [G1 全量测试套件] |  ✓ tests/integration/consent-first.test.ts (3 tests) 287ms
  [G1 全量测试套件] |  ✓ tests/integration/cases-idempotency.test.ts (3 tests) 276ms
  [G1 全量测试套件] |  ✓ tests/integration/openapi.test.ts (7 tests) 187ms
  [G1 全量测试套件] |  ✓ tests/db/participants-evidence-boundary.test.ts (2 tests) 193ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-confirmer-ordering.test.ts (1 test) 174ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-rollback.test.ts (2 tests) 219ms
  [G1 全量测试套件] |  ✓ tests/integration/consent-request.test.ts (5 tests) 245ms
  [G1 全量测试套件] |  ✓ tests/integration/messages-current-family-ambiguous.test.ts (2 tests) 215ms
  [G1 全量测试套件] | {"level":50,"time":1794305403072,"pid":<pid>,"hostname":"<host>","reqId":"req-3","requestId":"req-3","method":"POST","route":"/api/v1/cases","sqlstate":"P0001","msg":"unhandled request error"}
  [G1 全量测试套件] |  ✓ tests/db/evidence-conflict-concurrency.test.ts (3 tests) 200ms
  [G1 全量测试套件] | {"level":50,"time":1794305403141,"pid":<pid>,"hostname":"<host>","reqId":"req-7","requestId":"req-7","method":"POST","route":"/api/v1/cases","sqlstate":"P0001","msg":"unhandled request error"}
  [G1 全量测试套件] |  ✓ tests/integration/cases-rollback.test.ts (2 tests) 234ms
  [G1 全量测试套件] |  ✓ tests/integration/cases-read-no-audit.test.ts (2 tests) 259ms
  [G1 全量测试套件] |  ✓ tests/integration/evidence-writer-authorization.test.ts (16 tests) 221ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-http-boundary.test.ts (9 tests) 164ms
  [G1 全量测试套件] |  ✓ tests/db/identity-binding-facts.test.ts (3 tests) 189ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-decline.test.ts (1 test) 157ms
  [G1 全量测试套件] |  ✓ tests/integration/families.test.ts (6 tests) 152ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-scope.test.ts (2 tests) 133ms
  [G1 全量测试套件] |  ✓ tests/integration/cases-idempotency-mismatch.test.ts (2 tests) 165ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-invite.test.ts (1 test) 135ms
  [G1 全量测试套件] |  ✓ tests/integration/consent-read.test.ts (4 tests) 128ms
  [G1 全量测试套件] |  ✓ tests/integration/cases-audit.test.ts (2 tests) 136ms
  [G1 全量测试套件] |  ✓ tests/integration/log-privacy.test.ts (1 test) 118ms
  [G1 全量测试套件] |  ✓ tests/integration/uuid-v7.test.ts (3 tests) 112ms
  [G1 全量测试套件] |  ✓ tests/db/rls.test.ts (10 tests) 102ms
  [G1 全量测试套件] |  ✓ tests/integration/cases-scope.test.ts (8 tests) 104ms
  [G1 全量测试套件] |  ✓ tests/integration/auth.test.ts (4 tests) 87ms
  [G1 全量测试套件] |  ✓ tests/db/evidence-rls-grants.test.ts (8 tests) 107ms
  [G1 全量测试套件] |  ✓ tests/db/evidence-fks-supersedes.test.ts (10 tests) 67ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-ordinary-login-regression.test.ts (2 tests) 72ms
  [G1 全量测试套件] |  ✓ tests/db/roles.test.ts (12 tests) 66ms
  [G1 全量测试套件] |  ✓ tests/db/cases-rls.test.ts (10 tests) 72ms
  [G1 全量测试套件] |  ✓ tests/db/idempotency-rls.test.ts (3 tests) 47ms
  [G1 全量测试套件] |  ✓ tests/integration/runtime-env.test.ts (7 tests) 64ms
  [G1 全量测试套件] |  ✓ tests/db/cases-events-metadata.test.ts (8 tests) 67ms
  [G1 全量测试套件] |  ✓ tests/integration/evidence-scope.test.ts (5 tests) 54ms
  [G1 全量测试套件] |  ✓ tests/db/evidence-observation-storage.test.ts (12 tests) 72ms
  [G1 全量测试套件] |  ✓ tests/db/participants-structure.test.ts (3 tests) 50ms
  [G1 全量测试套件] |  ✓ tests/db/evidence-schema.test.ts (11 tests) 39ms
  [G1 全量测试套件] |  ✓ tests/db/case-primary-switch-rls.test.ts (5 tests) 74ms
  [G1 全量测试套件] |  ✓ tests/db/case-primary-switch-schema.test.ts (7 tests) 43ms
  [G1 全量测试套件] |  ✓ tests/db/constraints.test.ts (3 tests) 32ms
  [G1 全量测试套件] |  ✓ tests/db/participants-live-uniqueness.test.ts (2 tests) 31ms
  [G1 全量测试套件] |  ✓ tests/db/evidence-audit-idempotency.test.ts (7 tests) 60ms
  [G1 全量测试套件] |  ✓ tests/db/consent-structure.test.ts (3 tests) 31ms
  [G1 全量测试套件] |  ✓ tests/db/evidence-fact-guard.test.ts (4 tests) 50ms
  [G1 全量测试套件] |  ✓ tests/db/migration-repro.test.ts (7 tests) 39ms
  [G1 全量测试套件] |  ✓ tests/db/identity-binding-tx.test.ts (7 tests) 42ms
  [G1 全量测试套件] |  ✓ tests/db/schema-structure.test.ts (6 tests) 30ms
  [G1 全量测试套件] |  ✓ tests/db/participants-schema.test.ts (4 tests) 38ms
  [G1 全量测试套件] |  ✓ tests/db/participants-token-view.test.ts (3 tests) 37ms
  [G1 全量测试套件] |  ✓ tests/db/case-idempotency-representation.test.ts (7 tests) 57ms
  [G1 全量测试套件] |  ✓ tests/db/cases-schema.test.ts (10 tests) 47ms
  [G1 全量测试套件] |  ✓ tests/db/identity-binding-schema.test.ts (12 tests) 50ms
  [G1 全量测试套件] |  ✓ tests/integration/identity-binding-routes.test.ts (2 tests) 41ms
  [G1 全量测试套件] |  ✓ tests/integration/case-primary-switch-scope.test.ts (4 tests) 23ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-route-surface.test.ts (2 tests) 37ms
  [G1 全量测试套件] |  ✓ tests/integration/openapi-runtime-drift.test.ts (1 test) 38ms
  [G1 全量测试套件] |  ✓ tests/domain/identity-binding-crypto.test.ts (16 tests) 7ms
  [G1 全量测试套件] |  ✓ tests/db/participants-constraints.test.ts (3 tests) 19ms
  [G1 全量测试套件] |  ✓ tests/db/case-primary-switch-shared-vocabulary.test.ts (5 tests) 19ms
  [G1 全量测试套件] |  ✓ tests/integration/openapi-semantic-equivalence.test.ts (13 tests) 7ms
  [G1 全量测试套件] |  ✓ tests/domain/case-primary-switch-authorization.test.ts (10 tests) 3ms
  [G1 全量测试套件] |  ✓ tests/domain/env.test.ts (6 tests) 4ms
  [G1 全量测试套件] |  ✓ tests/domain/participation-env.test.ts (9 tests) 5ms
  [G1 全量测试套件] |  ✓ tests/domain/authorization.test.ts (36 tests) 5ms
  [G1 全量测试套件] |  ✓ tests/domain/case-contracts.test.ts (24 tests) 6ms
  [G1 全量测试套件] |  ✓ tests/domain/case-primary-switch-contracts.test.ts (10 tests) 4ms
  [G1 全量测试套件] |  ✓ tests/domain/participation-contracts.test.ts (5 tests) 4ms
  [G1 全量测试套件] |  ✓ tests/domain/consent-evidence.test.ts (10 tests) 4ms
  [G1 全量测试套件] |  ✓ tests/domain/identity-binding-anti-enumeration.test.ts (5 tests) 4ms
  [G1 全量测试套件] |  ✓ tests/domain/case-primary-switch-reason-unicode.test.ts (5 tests) 5ms
  [G1 全量测试套件] |  ✓ tests/domain/evidence-capabilities.test.ts (11 tests) 7ms
  [G1 全量测试套件] |  ✓ tests/domain/identity-binding-env.test.ts (3 tests) 4ms
  [G1 全量测试套件] |  ✓ tests/integration/openapi-cases.test.ts (14 tests) 4ms
  [G1 全量测试套件] |  ✓ tests/domain/participants-token.test.ts (5 tests) 4ms
  [G1 全量测试套件] |  ✓ tests/integration/openapi-evidence.test.ts (6 tests) 3ms
  [G1 全量测试套件] |  ✓ tests/domain/participants-authorization.test.ts (5 tests) 3ms
  [G1 全量测试套件] |  ✓ tests/domain/evidence-observation.test.ts (13 tests) 4ms
  [G1 全量测试套件] |  ✓ tests/domain/participation-types.test.ts (2 tests) 2ms
  [G1 全量测试套件] |  ✓ tests/domain/idempotency-hash.test.ts (11 tests) 3ms
  [G1 全量测试套件] |  ✓ tests/domain/case-primary-switch-idempotency.test.ts (7 tests) 3ms
  [G1 全量测试套件] |  ✓ tests/domain/case-primary-switch-decision.test.ts (9 tests) 4ms
  [G1 全量测试套件] |  ✓ tests/domain/case-authorization.test.ts (19 tests) 6ms
  [G1 全量测试套件] |  ✓ tests/domain/provenance.test.ts (5 tests) 2ms
  [G1 全量测试套件] |  ✓ tests/domain/message-idempotency-hash.test.ts (5 tests) 2ms
  [G1 全量测试套件] |  ✓ tests/domain/identity-binding-gate.test.ts (16 tests) 4ms
  [G1 全量测试套件] |  ✓ tests/domain/identity-binding-idempotency.test.ts (6 tests) 2ms
  [G1 全量测试套件] |  ✓ tests/domain/identity-binding-invitation-port.test.ts (4 tests) 4ms
  [G1 全量测试套件] |  ✓ tests/domain/evidence-conflict-supersedes.test.ts (10 tests) 2ms
  [G1 全量测试套件] |  ✓ tests/domain/participation-lifecycle.test.ts (5 tests) 2ms
  [G1 全量测试套件] |  ✓ tests/domain/identity-binding-state.test.ts (5 tests) 2ms
  [G1 全量测试套件] |  ✓ tests/integration/openapi-case-primary-switch.test.ts (5 tests) 4ms
  [G1 全量测试套件] |  ✓ tests/domain/identity-binding-authorization.test.ts (7 tests) 2ms
  [G1 全量测试套件] |  ✓ tests/domain/notices.test.ts (3 tests) 3ms
  [G1 全量测试套件] |  ✓ tests/domain/participation-authorization.test.ts (5 tests) 2ms
  [G1 全量测试套件] |  ✓ tests/domain/participation-token.test.ts (3 tests) 3ms
  [G1 全量测试套件] |  ✓ tests/domain/case-primary-switch-lock-order.test.ts (3 tests) 2ms
  [G1 全量测试套件] |  ✓ tests/domain/participants-domain.test.ts (5 tests) 2ms
  [G1 全量测试套件] |  ✓ tests/domain/evidence-person-reference.test.ts (8 tests) 3ms
  [G1 全量测试套件] |  ✓ tests/domain/session-token.test.ts (4 tests) 2ms
  [G1 全量测试套件] |  ✓ tests/integration/openapi-participations.test.ts (5 tests) 4ms
  [G1 全量测试套件] |  ✓ tests/domain/evidence-provenance.test.ts (7 tests) 9ms
  [G1 全量测试套件] |  ✓ tests/domain/age-band.test.ts (8 tests) 2ms
  [G1 全量测试套件] |  ✓ tests/integration/participations-log-privacy.test.ts (3 tests) 1ms
  [G1 全量测试套件] | 
  [G1 全量测试套件] |  Test Files  212 passed (212)
  [G1 全量测试套件] |       Tests  1266 passed (1266)
  [G1 全量测试套件] |    Start at  18:09:24
  [G1 全量测试套件] |    Duration  44.69s (transform 899ms, setup 138ms, collect 16.80s, tests 91.86s, environment 16ms, prepare 6.41s)
  [G1 全量测试套件] | 
  [G1 全量测试套件] | JSON report written to /var/folders/fl/3drhw1k154zct4qrgjlqbn_r0000gn/T/xiaoshuyin-vitest-results-7754.json
  [G1 全量测试套件] |   FAIL 006_case_status_paused_removal.sql: S3M01_CASE_PAUSED_ROWS_EXIST:1 row(s)
  [G1 全量测试套件] | Migration failed: S3M01_CASE_PAUSED_ROWS_EXIST:1 row(s)
  [G1 全量测试套件] | (node:9968) DeprecationWarning: Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead.
  [G1 全量测试套件] | (Use `node --trace-deprecation ...` to show where the warning was created)
  [G1 全量测试套件] --- real output end ---
  [G1 全量测试套件] 结果: PASS

  [G2 静态守卫] $ bun run guard:static
  [G2 静态守卫] exit=0 duration=0.2s
  [G2 静态守卫] --- real output begin ---
  [G2 静态守卫] | guard-static: PASS (0 violations)
  [G2 静态守卫] | $ node scripts/guard-static.mjs
  [G2 静态守卫] --- real output end ---
  [G2 静态守卫] 结果: PASS

  [G3 typecheck（base 工程）] $ bunx tsc -p tsconfig.base.json --noEmit
  [G3 typecheck（base 工程）] exit=0 duration=0.5s
  [G3 typecheck（base 工程）] --- real output begin ---
  [G3 typecheck（base 工程）] | 
  [G3 typecheck（base 工程）] --- real output end ---
  [G3 typecheck（base 工程）] 结果: PASS

  [G4 typecheck（api 工程）] $ bunx tsc --noEmit
  [G4 typecheck（api 工程）] exit=0 duration=1.3s
  [G4 typecheck（api 工程）] --- real output begin ---
  [G4 typecheck（api 工程）] | 
  [G4 typecheck（api 工程）] --- real output end ---
  [G4 typecheck（api 工程）] 结果: PASS

  [G5 OpenAPI 生成] $ bun run openapi:generate
  [G5 OpenAPI 生成] exit=0 duration=0.5s
  [G5 OpenAPI 生成] --- real output begin ---
  [G5 OpenAPI 生成] |   Detected 29 paths
  [G5 OpenAPI 生成] | Generated: <repo>packages/generated/openapi.json
  [G5 OpenAPI 生成] | Generated: <repo>packages/generated/openapi.d.ts
  [G5 OpenAPI 生成] | openapi-generate: OK
  [G5 OpenAPI 生成] | $ bun scripts/openapi-generate.mjs
  [G5 OpenAPI 生成] --- real output end ---
  [G5 OpenAPI 生成] 结果: PASS

  [G6 OpenAPI 漂移检查] $ bun run openapi:check
  [G6 OpenAPI 漂移检查] exit=0 duration=0.3s
  [G6 OpenAPI 漂移检查] --- real output begin ---
  [G6 OpenAPI 漂移检查] | openapi-check: PASS (semantic equivalence with frozen contracts)
  [G6 OpenAPI 漂移检查] | $ bun scripts/openapi-check.mjs
  [G6 OpenAPI 漂移检查] --- real output end ---
  [G6 OpenAPI 漂移检查] 结果: PASS

  [G7 DB 结构证据] $ node scripts/db-evidence.mjs --no-archive
  [G7 DB 结构证据] exit=0 duration=1.1s
  [G7 DB 结构证据] --- real output begin ---
  [G7 DB 结构证据] | # T067 — Database / RLS / Migration Evidence
  [G7 DB 结构证据] | 生成时间: 2026-11-10T10:10:12.561Z
  [G7 DB 结构证据] | 
  [G7 DB 结构证据] | 说明：以下每个数值均来自 pg_catalog / information_schema 的真实查询输出；
  [G7 DB 结构证据] | 空库重建与 replay 为真实执行的 db:migrate，不是描述性声明。
  [G7 DB 结构证据] | 
  [G7 DB 结构证据] | ## 当前主库（已迁移） — quickstart §1 期望表逐项核对（真实查询输出）
  [G7 DB 结构证据] | 
  [G7 DB 结构证据] | | 检查 | 期望 | 实际 | 结果 |
  [G7 DB 结构证据] | |---|---|---|---|
  [G7 DB 结构证据] | | 14 张业务表 relrowsecurity/relforcerowsecurity | true/true × 14 | ["assertions=true/true","business_audit_events=true/true","case_events=true/true","cases=true/true","consent_records=true/true","dialogue_messages=true/true","families=true/true","family_members=true/true","guardian_consent_requests=true/true","idempotency_keys=true/true","observations=true/true","person_compliance_profiles=true/true","person_profile_values=true/true","persons=true/true"] | PASS |
  [G7 DB 结构证据] | | 5 张 006 binding 表 relrowsecurity/relforcerowsecurity | true/true × 5 | ["binding_attempts=true/true","binding_confirmations=true/true","binding_operation_keys=true/true","binding_pending_contexts=true/true","identity_binding_audit_events=true/true"] | PASS |
  [G7 DB 结构证据] | | accounts 无 RLS | false/false | false/false | PASS |
  [G7 DB 结构证据] | | 业务表 owner | xiaoshuyin_migrator | ["xiaoshuyin_migrator"] | PASS |
  [G7 DB 结构证据] | | xiaoshuyin_app rolbypassrls | false | false | PASS |
  [G7 DB 结构证据] | | xiaoshuyin_migrator rolbypassrls | false | false | PASS |
  [G7 DB 结构证据] | | uuidv7() 默认值的 19 张 id 表 | ["accounts","assertions","binding_attempts","binding_confirmations","binding_operation_keys","binding_pending_contexts","business_audit_events","case_events","cases","consent_records","dialogue_messages","families","family_members","guardian_consent_requests","idempotency_keys","identity_binding_audit_events","observations","person_profile_values","persons"] | ["accounts","assertions","binding_attempts","binding_confirmations","binding_operation_keys","binding_pending_contexts","business_audit_events","case_events","case_participants","cases","consent_records","dialogue_messages","families","family_members","guardian_consent_requests","idempotency_keys","identity_binding_audit_events","observations","person_profile_values","persons"] | PASS |
  [G7 DB 结构证据] | | uuidv7 默认值表达式 | uuidv7() × 19 | ["uuidv7()"] | PASS |
  [G7 DB 结构证据] | | 枚举覆盖 Slice 1 + 3 + 006（20） | ["account_status","age_band","assertion_kind","binding_attempt_state","binding_confirmation_kind","binding_confirmer_authority","binding_operation_command","binding_operation_scope","case_phase","case_status","consent_decision","consent_purpose","consent_request_status","evidence_confirmation_status","evidence_time_state","observation_value_state","observation_value_type","profile_attribute","profile_value_status","provenance_source"] | ["account_status","age_band","assertion_kind","binding_attempt_state","binding_confirmation_kind","binding_confirmer_authority","binding_operation_command","binding_operation_scope","case_participation_state","case_phase","case_status","consent_decision","consent_purpose","consent_request_status","evidence_confirmation_status","evidence_time_state","observation_value_state","observation_value_type","profile_attribute","profile_value_status","provenance_source"] | PASS |
  [G7 DB 结构证据] | | age_band enum | ADULT,MINOR_14_17,UNDER_14,UNKNOWN | ADULT,MINOR_14_17,UNDER_14,UNKNOWN | PASS |
  [G7 DB 结构证据] | | profile_attribute enum | DISPLAY_NAME | DISPLAY_NAME | PASS |
  [G7 DB 结构证据] | | 不存在 RELATION_DESCRIPTOR enum label | 0 | 0 | PASS |
  [G7 DB 结构证据] | | 业务表覆盖 Slice 1 + 3 + 006（20） | ["accounts","assertions","binding_attempts","binding_confirmations","binding_operation_keys","binding_pending_contexts","business_audit_events","case_events","cases","consent_records","dialogue_messages","families","family_members","guardian_consent_requests","idempotency_keys","identity_binding_audit_events","observations","person_compliance_profiles","person_profile_values","persons"] | ["accounts","assertions","binding_attempts","binding_confirmations","binding_operation_keys","binding_pending_contexts","business_audit_events","case_events","case_participants","cases","consent_records","dialogue_messages","families","family_members","guardian_consent_requests","idempotency_keys","identity_binding_audit_events","observations","person_compliance_profiles","person_profile_values","persons"] | PASS |
  [G7 DB 结构证据] | | RLS policy 覆盖 006 追加策略 | ["binding_context_token_scope","binding_context_attempt_scope","binding_context_no_attempt_identity_scope","binding_attempts_identity_scope","binding_attempts_operation_replay","binding_attempts_target_scope","binding_attempts_commit_scope","binding_attempts_confirmer_replay","binding_confirmations_attempt_scope","binding_confirmations_target_scope","binding_operation_keys_scope","binding_operation_keys_bootstrap_fingerprint","identity_binding_audit_insert_scope","persons_binding_target_read","persons_binding_candidate_account_read","persons_binding_commit_update","families_binding_read","family_members_binding_read","pcp_binding_read","consent_binding_read","persons_binding_lock","persons_binding_candidate_lock","families_binding_lock","family_members_binding_lock","pcp_binding_lock","consent_binding_lock"] | ["binding_attempts_commit_scope","binding_attempts_confirmer_replay","binding_attempts_identity_scope","binding_attempts_operation_replay","binding_attempts_target_scope","binding_confirmations_attempt_scope","binding_confirmations_target_scope","binding_context_attempt_scope","binding_context_no_attempt_identity_scope","binding_context_token_scope","binding_operation_keys_bootstrap_fingerprint","binding_operation_keys_scope","consent_binding_lock","consent_binding_read","families_binding_lock","families_binding_read","family_members_binding_lock","family_members_binding_read","identity_binding_audit_insert_scope","pcp_binding_lock","pcp_binding_read","persons_binding_candidate_account_read","persons_binding_candidate_lock","persons_binding_commit_update","persons_binding_lock","persons_binding_target_read"] | PASS |
  [G7 DB 结构证据] | | RLS policy 总数 >= Slice 1/3 基线 + 006（45） | >= 45 | 48 | PASS |
  [G7 DB 结构证据] | | H-01 pairing issuance columns | pairing_expires_at,pairing_issued_at,pairing_issuance_id | ["pairing_expires_at","pairing_issuance_id","pairing_issued_at"] | PASS |
  [G7 DB 结构证据] | | consent + binding 不可变触发器 | ["consent_records_guard","binding_confirmations_no_update_delete","identity_binding_audit_no_update_delete"] | ["binding_confirmations_no_update_delete","consent_records_guard","identity_binding_audit_no_update_delete"] | PASS |
  [G7 DB 结构证据] | | persons 无 family_id / source_kind / role | 0 | 0 | PASS |
  [G7 DB 结构证据] | | persons.account_id UNIQUE | true | true | PASS |
  [G7 DB 结构证据] | | family_members 无 role/creator/guardian 列 | 0 | 0 | PASS |
  [G7 DB 结构证据] | 
  [G7 DB 结构证据] | ## 空库重建 + migration replay（真实执行）
  [G7 DB 结构证据] |   CREATE DATABASE xiaoshuyin_evidence_<tmp> OWNER xiaoshuyin_migrator — OK
  [G7 DB 结构证据] |   第一次 db:migrate (空库):
  [G7 DB 结构证据] |     APPLY 001_initial_schema.sql
  [G7 DB 结构证据] |       APPLY 002_case_core.sql
  [G7 DB 结构证据] |       APPLY 003_case_idempotency_key_bytes.sql
  [G7 DB 结构证据] |       APPLY 004_evidence_core.sql
  [G7 DB 结构证据] |       APPLY 004_identity_binding_runtime.sql
  [G7 DB 结构证据] |       APPLY 005_case_participant_core.sql
  [G7 DB 结构证据] |       APPLY 006_case_status_paused_removal.sql
  [G7 DB 结构证据] |       APPLY 007_case_primary_switch.sql
  [G7 DB 结构证据] |     
  [G7 DB 结构证据] |     Migration complete: 8 new, 0 previously applied.
  [G7 DB 结构证据] |     Verified: app role has no DDL permissions.
  [G7 DB 结构证据] | 
  [G7 DB 结构证据] | ## 空库重建结果 — quickstart §1 期望表逐项核对（真实查询输出）
  [G7 DB 结构证据] | 
  [G7 DB 结构证据] | | 检查 | 期望 | 实际 | 结果 |
  [G7 DB 结构证据] | |---|---|---|---|
  [G7 DB 结构证据] | | 14 张业务表 relrowsecurity/relforcerowsecurity | true/true × 14 | ["assertions=true/true","business_audit_events=true/true","case_events=true/true","cases=true/true","consent_records=true/true","dialogue_messages=true/true","families=true/true","family_members=true/true","guardian_consent_requests=true/true","idempotency_keys=true/true","observations=true/true","person_compliance_profiles=true/true","person_profile_values=true/true","persons=true/true"] | PASS |
  [G7 DB 结构证据] | | 5 张 006 binding 表 relrowsecurity/relforcerowsecurity | true/true × 5 | ["binding_attempts=true/true","binding_confirmations=true/true","binding_operation_keys=true/true","binding_pending_contexts=true/true","identity_binding_audit_events=true/true"] | PASS |
  [G7 DB 结构证据] | | accounts 无 RLS | false/false | false/false | PASS |
  [G7 DB 结构证据] | | 业务表 owner | xiaoshuyin_migrator | ["xiaoshuyin_migrator"] | PASS |
  [G7 DB 结构证据] | | xiaoshuyin_app rolbypassrls | false | false | PASS |
  [G7 DB 结构证据] | | xiaoshuyin_migrator rolbypassrls | false | false | PASS |
  [G7 DB 结构证据] | | uuidv7() 默认值的 19 张 id 表 | ["accounts","assertions","binding_attempts","binding_confirmations","binding_operation_keys","binding_pending_contexts","business_audit_events","case_events","cases","consent_records","dialogue_messages","families","family_members","guardian_consent_requests","idempotency_keys","identity_binding_audit_events","observations","person_profile_values","persons"] | ["accounts","assertions","binding_attempts","binding_confirmations","binding_operation_keys","binding_pending_contexts","business_audit_events","case_events","case_participants","cases","consent_records","dialogue_messages","families","family_members","guardian_consent_requests","idempotency_keys","identity_binding_audit_events","observations","person_profile_values","persons"] | PASS |
  [G7 DB 结构证据] | | uuidv7 默认值表达式 | uuidv7() × 19 | ["uuidv7()"] | PASS |
  [G7 DB 结构证据] | | 枚举覆盖 Slice 1 + 3 + 006（20） | ["account_status","age_band","assertion_kind","binding_attempt_state","binding_confirmation_kind","binding_confirmer_authority","binding_operation_command","binding_operation_scope","case_phase","case_status","consent_decision","consent_purpose","consent_request_status","evidence_confirmation_status","evidence_time_state","observation_value_state","observation_value_type","profile_attribute","profile_value_status","provenance_source"] | ["account_status","age_band","assertion_kind","binding_attempt_state","binding_confirmation_kind","binding_confirmer_authority","binding_operation_command","binding_operation_scope","case_participation_state","case_phase","case_status","consent_decision","consent_purpose","consent_request_status","evidence_confirmation_status","evidence_time_state","observation_value_state","observation_value_type","profile_attribute","profile_value_status","provenance_source"] | PASS |
  [G7 DB 结构证据] | | age_band enum | ADULT,MINOR_14_17,UNDER_14,UNKNOWN | ADULT,MINOR_14_17,UNDER_14,UNKNOWN | PASS |
  [G7 DB 结构证据] | | profile_attribute enum | DISPLAY_NAME | DISPLAY_NAME | PASS |
  [G7 DB 结构证据] | | 不存在 RELATION_DESCRIPTOR enum label | 0 | 0 | PASS |
  [G7 DB 结构证据] | | 业务表覆盖 Slice 1 + 3 + 006（20） | ["accounts","assertions","binding_attempts","binding_confirmations","binding_operation_keys","binding_pending_contexts","business_audit_events","case_events","cases","consent_records","dialogue_messages","families","family_members","guardian_consent_requests","idempotency_keys","identity_binding_audit_events","observations","person_compliance_profiles","person_profile_values","persons"] | ["accounts","assertions","binding_attempts","binding_confirmations","binding_operation_keys","binding_pending_contexts","business_audit_events","case_events","case_participants","cases","consent_records","dialogue_messages","families","family_members","guardian_consent_requests","idempotency_keys","identity_binding_audit_events","observations","person_compliance_profiles","person_profile_values","persons"] | PASS |
  [G7 DB 结构证据] | | RLS policy 覆盖 006 追加策略 | ["binding_context_token_scope","binding_context_attempt_scope","binding_context_no_attempt_identity_scope","binding_attempts_identity_scope","binding_attempts_operation_replay","binding_attempts_target_scope","binding_attempts_commit_scope","binding_attempts_confirmer_replay","binding_confirmations_attempt_scope","binding_confirmations_target_scope","binding_operation_keys_scope","binding_operation_keys_bootstrap_fingerprint","identity_binding_audit_insert_scope","persons_binding_target_read","persons_binding_candidate_account_read","persons_binding_commit_update","families_binding_read","family_members_binding_read","pcp_binding_read","consent_binding_read","persons_binding_lock","persons_binding_candidate_lock","families_binding_lock","family_members_binding_lock","pcp_binding_lock","consent_binding_lock"] | ["binding_attempts_commit_scope","binding_attempts_confirmer_replay","binding_attempts_identity_scope","binding_attempts_operation_replay","binding_attempts_target_scope","binding_confirmations_attempt_scope","binding_confirmations_target_scope","binding_context_attempt_scope","binding_context_no_attempt_identity_scope","binding_context_token_scope","binding_operation_keys_bootstrap_fingerprint","binding_operation_keys_scope","consent_binding_lock","consent_binding_read","families_binding_lock","families_binding_read","family_members_binding_lock","family_members_binding_read","identity_binding_audit_insert_scope","pcp_binding_lock","pcp_binding_read","persons_binding_candidate_account_read","persons_binding_candidate_lock","persons_binding_commit_update","persons_binding_lock","persons_binding_target_read"] | PASS |
  [G7 DB 结构证据] | | RLS policy 总数 >= Slice 1/3 基线 + 006（45） | >= 45 | 48 | PASS |
  [G7 DB 结构证据] | | H-01 pairing issuance columns | pairing_expires_at,pairing_issued_at,pairing_issuance_id | ["pairing_expires_at","pairing_issuance_id","pairing_issued_at"] | PASS |
  [G7 DB 结构证据] | | consent + binding 不可变触发器 | ["consent_records_guard","binding_confirmations_no_update_delete","identity_binding_audit_no_update_delete"] | ["binding_confirmations_no_update_delete","consent_records_guard","identity_binding_audit_no_update_delete"] | PASS |
  [G7 DB 结构证据] | | persons 无 family_id / source_kind / role | 0 | 0 | PASS |
  [G7 DB 结构证据] | | persons.account_id UNIQUE | true | true | PASS |
  [G7 DB 结构证据] | | family_members 无 role/creator/guardian 列 | 0 | 0 | PASS |
  [G7 DB 结构证据] |   第二次 db:migrate (replay):
  [G7 DB 结构证据] |     SKIP 001_initial_schema.sql (already applied)
  [G7 DB 结构证据] |       SKIP 002_case_core.sql (already applied)
  [G7 DB 结构证据] |       SKIP 003_case_idempotency_key_bytes.sql (already applied)
  [G7 DB 结构证据] |       SKIP 004_evidence_core.sql (already applied)
  [G7 DB 结构证据] |       SKIP 004_identity_binding_runtime.sql (already applied)
  [G7 DB 结构证据] |       SKIP 005_case_participant_core.sql (already applied)
  [G7 DB 结构证据] |       SKIP 006_case_status_paused_removal.sql (already applied)
  [G7 DB 结构证据] |       SKIP 007_case_primary_switch.sql (already applied)
  [G7 DB 结构证据] |     
  [G7 DB 结构证据] |     Migration complete: 0 new, 8 previously applied.
  [G7 DB 结构证据] |     Verified: app role has no DDL permissions.
  [G7 DB 结构证据] | | migration replay 为 no-op（对象集合不变） | enum:account_status|enum:age_band|enum:assertion_kind|enum:binding_attempt_state|enum:binding_confirmation_kind|enum:binding_confirmer_authority|enum:binding_operation_command|enum:binding_operation_scope|enum:case_participation_state|enum:case_phase|enum:case_status|enum:consent_decision|enum:consent_purpose|enum:consent_request_status|enum:evidence_confirmation_status|enum:evidence_time_state|enum:observation_value_state|enum:observation_value_type|enum:profile_attribute|enum:profile_value_status|enum:provenance_source|policy:assertions_insert|policy:assertions_select|policy:assertions_update|policy:audit_scope|policy:binding_attempts_commit_scope|policy:binding_attempts_confirmer_replay|policy:binding_attempts_identity_scope|policy:binding_attempts_operation_replay|policy:binding_attempts_target_scope|policy:binding_confirmations_attempt_scope|policy:binding_confirmations_target_scope|policy:binding_context_attempt_scope|policy:binding_context_no_attempt_identity_scope|policy:binding_context_token_scope|policy:binding_operation_keys_bootstrap_fingerprint|policy:binding_operation_keys_scope|policy:case_events_family_scope|policy:case_participants_family_scope|policy:case_participants_invite_token_read|policy:case_participants_self_read|policy:cases_family_scope|policy:consent_binding_lock|policy:consent_binding_read|policy:consent_scope|policy:dialogue_messages_insert|policy:dialogue_messages_select|policy:families_binding_lock|policy:families_binding_read|policy:families_scope|policy:family_members_binding_lock|policy:family_members_binding_read|policy:family_members_scope|policy:gcr_scope|policy:idempotency_scope|policy:identity_binding_audit_insert_scope|policy:observations_insert|policy:observations_select|policy:observations_update|policy:pcp_binding_lock|policy:pcp_binding_read|policy:pcp_scope|policy:persons_binding_candidate_account_read|policy:persons_binding_candidate_lock|policy:persons_binding_commit_update|policy:persons_binding_lock|policy:persons_binding_target_read|policy:persons_scope|policy:ppv_scope|table:accounts|table:assertions|table:binding_attempts|table:binding_confirmations|table:binding_operation_keys|table:binding_pending_contexts|table:business_audit_events|table:case_events|table:case_participants|table:cases|table:consent_records|table:dialogue_messages|table:families|table:family_members|table:guardian_consent_requests|table:idempotency_keys|table:identity_binding_audit_events|table:observations|table:person_compliance_profiles|table:person_profile_values|table:persons|trigger:binding_confirmations_no_update_delete|trigger:consent_records_guard|trigger:identity_binding_audit_no_update_delete | enum:account_status|enum:age_band|enum:assertion_kind|enum:binding_attempt_state|enum:binding_confirmation_kind|enum:binding_confirmer_authority|enum:binding_operation_command|enum:binding_operation_scope|enum:case_participation_state|enum:case_phase|enum:case_status|enum:consent_decision|enum:consent_purpose|enum:consent_request_status|enum:evidence_confirmation_status|enum:evidence_time_state|enum:observation_value_state|enum:observation_value_type|enum:profile_attribute|enum:profile_value_status|enum:provenance_source|policy:assertions_insert|policy:assertions_select|policy:assertions_update|policy:audit_scope|policy:binding_attempts_commit_scope|policy:binding_attempts_confirmer_replay|policy:binding_attempts_identity_scope|policy:binding_attempts_operation_replay|policy:binding_attempts_target_scope|policy:binding_confirmations_attempt_scope|policy:binding_confirmations_target_scope|policy:binding_context_attempt_scope|policy:binding_context_no_attempt_identity_scope|policy:binding_context_token_scope|policy:binding_operation_keys_bootstrap_fingerprint|policy:binding_operation_keys_scope|policy:case_events_family_scope|policy:case_participants_family_scope|policy:case_participants_invite_token_read|policy:case_participants_self_read|policy:cases_family_scope|policy:consent_binding_lock|policy:consent_binding_read|policy:consent_scope|policy:dialogue_messages_insert|policy:dialogue_messages_select|policy:families_binding_lock|policy:families_binding_read|policy:families_scope|policy:family_members_binding_lock|policy:family_members_binding_read|policy:family_members_scope|policy:gcr_scope|policy:idempotency_scope|policy:identity_binding_audit_insert_scope|policy:observations_insert|policy:observations_select|policy:observations_update|policy:pcp_binding_lock|policy:pcp_binding_read|policy:pcp_scope|policy:persons_binding_candidate_account_read|policy:persons_binding_candidate_lock|policy:persons_binding_commit_update|policy:persons_binding_lock|policy:persons_binding_target_read|policy:persons_scope|policy:ppv_scope|table:accounts|table:assertions|table:binding_attempts|table:binding_confirmations|table:binding_operation_keys|table:binding_pending_contexts|table:business_audit_events|table:case_events|table:case_participants|table:cases|table:consent_records|table:dialogue_messages|table:families|table:family_members|table:guardian_consent_requests|table:idempotency_keys|table:identity_binding_audit_events|table:observations|table:person_compliance_profiles|table:person_profile_values|table:persons|trigger:binding_confirmations_no_update_delete|trigger:consent_records_guard|trigger:identity_binding_audit_no_update_delete | PASS |
  [G7 DB 结构证据] | | replay 输出声明 0 new | true | true | PASS |
  [G7 DB 结构证据] |   DROP DATABASE xiaoshuyin_evidence_<tmp> — OK
  [G7 DB 结构证据] | 
  [G7 DB 结构证据] | ## 001–003 基线库 → 004 upgrade（真实 db:migrate，非手工执行 004）
  [G7 DB 结构证据] |   CREATE DATABASE xiaoshuyin_evidence_<tmp> OWNER xiaoshuyin_migrator — OK
  [G7 DB 结构证据] |   PRE-004 APPLY 001_initial_schema.sql
  [G7 DB 结构证据] |   PRE-004 APPLY 002_case_core.sql
  [G7 DB 结构证据] |   PRE-004 APPLY 003_case_idempotency_key_bytes.sql
  [G7 DB 结构证据] |   第一次 db:migrate（数据库状态 = 001–003 applied、004 未应用）:
  [G7 DB 结构证据] |     SKIP 001_initial_schema.sql (already applied)
  [G7 DB 结构证据] |       SKIP 002_case_core.sql (already applied)
  [G7 DB 结构证据] |       SKIP 003_case_idempotency_key_bytes.sql (already applied)
  [G7 DB 结构证据] |       APPLY 004_evidence_core.sql
  [G7 DB 结构证据] |       APPLY 004_identity_binding_runtime.sql
  [G7 DB 结构证据] |       APPLY 005_case_participant_core.sql
  [G7 DB 结构证据] |       APPLY 006_case_status_paused_removal.sql
  [G7 DB 结构证据] |       APPLY 007_case_primary_switch.sql
  [G7 DB 结构证据] |     
  [G7 DB 结构证据] |     Migration complete: 5 new, 3 previously applied.
  [G7 DB 结构证据] |     Verified: app role has no DDL permissions.
  [G7 DB 结构证据] | | upgrade 前三条 migration 被 SKIP（未重新执行） | true | true | PASS |
  [G7 DB 结构证据] | | upgrade 仅 APPLY 004_evidence_core + 004_identity_binding + 005_case_participant + 006_case_status_paused_removal + 007_case_primary_switch | true | true | PASS |
  [G7 DB 结构证据] | | upgrade 结果为 5 new / 3 previously applied | true | true | PASS |
  [G7 DB 结构证据] | | schema_migrations records added for 004 and 005 | ["001_initial_schema.sql","002_case_core.sql","003_case_idempotency_key_bytes.sql","004_evidence_core.sql","004_identity_binding_runtime.sql","005_case_participant_core.sql","006_case_status_paused_removal.sql","007_case_primary_switch.sql"] | ["001_initial_schema.sql","002_case_core.sql","003_case_idempotency_key_bytes.sql","004_evidence_core.sql","004_identity_binding_runtime.sql","005_case_participant_core.sql","006_case_status_paused_removal.sql","007_case_primary_switch.sql"] | PASS |
  [G7 DB 结构证据] | | 001–003 历史记录时间戳未被改写 | true | true | PASS |
  [G7 DB 结构证据] | 
  [G7 DB 结构证据] | ## 001–003 → 004/005 upgrade 结果 — quickstart §1 期望表逐项核对（真实查询输出）
  [G7 DB 结构证据] | 
  [G7 DB 结构证据] | | 检查 | 期望 | 实际 | 结果 |
  [G7 DB 结构证据] | |---|---|---|---|
  [G7 DB 结构证据] | | 14 张业务表 relrowsecurity/relforcerowsecurity | true/true × 14 | ["assertions=true/true","business_audit_events=true/true","case_events=true/true","cases=true/true","consent_records=true/true","dialogue_messages=true/true","families=true/true","family_members=true/true","guardian_consent_requests=true/true","idempotency_keys=true/true","observations=true/true","person_compliance_profiles=true/true","person_profile_values=true/true","persons=true/true"] | PASS |
  [G7 DB 结构证据] | | 5 张 006 binding 表 relrowsecurity/relforcerowsecurity | true/true × 5 | ["binding_attempts=true/true","binding_confirmations=true/true","binding_operation_keys=true/true","binding_pending_contexts=true/true","identity_binding_audit_events=true/true"] | PASS |
  [G7 DB 结构证据] | | accounts 无 RLS | false/false | false/false | PASS |
  [G7 DB 结构证据] | | 业务表 owner | xiaoshuyin_migrator | ["xiaoshuyin_migrator"] | PASS |
  [G7 DB 结构证据] | | xiaoshuyin_app rolbypassrls | false | false | PASS |
  [G7 DB 结构证据] | | xiaoshuyin_migrator rolbypassrls | false | false | PASS |
  [G7 DB 结构证据] | | uuidv7() 默认值的 19 张 id 表 | ["accounts","assertions","binding_attempts","binding_confirmations","binding_operation_keys","binding_pending_contexts","business_audit_events","case_events","cases","consent_records","dialogue_messages","families","family_members","guardian_consent_requests","idempotency_keys","identity_binding_audit_events","observations","person_profile_values","persons"] | ["accounts","assertions","binding_attempts","binding_confirmations","binding_operation_keys","binding_pending_contexts","business_audit_events","case_events","case_participants","cases","consent_records","dialogue_messages","families","family_members","guardian_consent_requests","idempotency_keys","identity_binding_audit_events","observations","person_profile_values","persons"] | PASS |
  [G7 DB 结构证据] | | uuidv7 默认值表达式 | uuidv7() × 19 | ["uuidv7()"] | PASS |
  [G7 DB 结构证据] | | 枚举覆盖 Slice 1 + 3 + 006（20） | ["account_status","age_band","assertion_kind","binding_attempt_state","binding_confirmation_kind","binding_confirmer_authority","binding_operation_command","binding_operation_scope","case_phase","case_status","consent_decision","consent_purpose","consent_request_status","evidence_confirmation_status","evidence_time_state","observation_value_state","observation_value_type","profile_attribute","profile_value_status","provenance_source"] | ["account_status","age_band","assertion_kind","binding_attempt_state","binding_confirmation_kind","binding_confirmer_authority","binding_operation_command","binding_operation_scope","case_participation_state","case_phase","case_status","consent_decision","consent_purpose","consent_request_status","evidence_confirmation_status","evidence_time_state","observation_value_state","observation_value_type","profile_attribute","profile_value_status","provenance_source"] | PASS |
  [G7 DB 结构证据] | | age_band enum | ADULT,MINOR_14_17,UNDER_14,UNKNOWN | ADULT,MINOR_14_17,UNDER_14,UNKNOWN | PASS |
  [G7 DB 结构证据] | | profile_attribute enum | DISPLAY_NAME | DISPLAY_NAME | PASS |
  [G7 DB 结构证据] | | 不存在 RELATION_DESCRIPTOR enum label | 0 | 0 | PASS |
  [G7 DB 结构证据] | | 业务表覆盖 Slice 1 + 3 + 006（20） | ["accounts","assertions","binding_attempts","binding_confirmations","binding_operation_keys","binding_pending_contexts","business_audit_events","case_events","cases","consent_records","dialogue_messages","families","family_members","guardian_consent_requests","idempotency_keys","identity_binding_audit_events","observations","person_compliance_profiles","person_profile_values","persons"] | ["accounts","assertions","binding_attempts","binding_confirmations","binding_operation_keys","binding_pending_contexts","business_audit_events","case_events","case_participants","cases","consent_records","dialogue_messages","families","family_members","guardian_consent_requests","idempotency_keys","identity_binding_audit_events","observations","person_compliance_profiles","person_profile_values","persons"] | PASS |
  [G7 DB 结构证据] | | RLS policy 覆盖 006 追加策略 | ["binding_context_token_scope","binding_context_attempt_scope","binding_context_no_attempt_identity_scope","binding_attempts_identity_scope","binding_attempts_operation_replay","binding_attempts_target_scope","binding_attempts_commit_scope","binding_attempts_confirmer_replay","binding_confirmations_attempt_scope","binding_confirmations_target_scope","binding_operation_keys_scope","binding_operation_keys_bootstrap_fingerprint","identity_binding_audit_insert_scope","persons_binding_target_read","persons_binding_candidate_account_read","persons_binding_commit_update","families_binding_read","family_members_binding_read","pcp_binding_read","consent_binding_read","persons_binding_lock","persons_binding_candidate_lock","families_binding_lock","family_members_binding_lock","pcp_binding_lock","consent_binding_lock"] | ["binding_attempts_commit_scope","binding_attempts_confirmer_replay","binding_attempts_identity_scope","binding_attempts_operation_replay","binding_attempts_target_scope","binding_confirmations_attempt_scope","binding_confirmations_target_scope","binding_context_attempt_scope","binding_context_no_attempt_identity_scope","binding_context_token_scope","binding_operation_keys_bootstrap_fingerprint","binding_operation_keys_scope","consent_binding_lock","consent_binding_read","families_binding_lock","families_binding_read","family_members_binding_lock","family_members_binding_read","identity_binding_audit_insert_scope","pcp_binding_lock","pcp_binding_read","persons_binding_candidate_account_read","persons_binding_candidate_lock","persons_binding_commit_update","persons_binding_lock","persons_binding_target_read"] | PASS |
  [G7 DB 结构证据] | | RLS policy 总数 >= Slice 1/3 基线 + 006（45） | >= 45 | 48 | PASS |
  [G7 DB 结构证据] | | H-01 pairing issuance columns | pairing_expires_at,pairing_issued_at,pairing_issuance_id | ["pairing_expires_at","pairing_issuance_id","pairing_issued_at"] | PASS |
  [G7 DB 结构证据] | | consent + binding 不可变触发器 | ["consent_records_guard","binding_confirmations_no_update_delete","identity_binding_audit_no_update_delete"] | ["binding_confirmations_no_update_delete","consent_records_guard","identity_binding_audit_no_update_delete"] | PASS |
  [G7 DB 结构证据] | | persons 无 family_id / source_kind / role | 0 | 0 | PASS |
  [G7 DB 结构证据] | | persons.account_id UNIQUE | true | true | PASS |
  [G7 DB 结构证据] | | family_members 无 role/creator/guardian 列 | 0 | 0 | PASS |
  [G7 DB 结构证据] | | 001–003 既有对象无破坏性重写 | true | true | PASS |
  [G7 DB 结构证据] | | roles 与 upgrade 前一致 | xiaoshuyin_app=false,xiaoshuyin_migrator=false | xiaoshuyin_app=false,xiaoshuyin_migrator=false | PASS |
  [G7 DB 结构证据] |   DROP DATABASE xiaoshuyin_evidence_<tmp> — OK
  [G7 DB 结构证据] | 
  [G7 DB 结构证据] | ## T011 / T012 红灯测试转绿（真实命令输出归档）
  [G7 DB 结构证据] |   $ bunx vitest run tests/db/migration-repro.test.ts tests/db/roles.test.ts
  [G7 DB 结构证据] |     RUN  v3.2.7 ~/Projects/xiaoshuyin-slice7-remediation-iii
  [G7 DB 结构证据] |     
  [G7 DB 结构证据] |      ✓ tests/db/migration-repro.test.ts (7 tests) 42ms
  [G7 DB 结构证据] |      ✓ tests/db/roles.test.ts (12 tests) 73ms
  [G7 DB 结构证据] |     
  [G7 DB 结构证据] |      Test Files  2 passed (2)
  [G7 DB 结构证据] |           Tests  19 passed (19)
  [G7 DB 结构证据] |        Start at  18:10:13
  [G7 DB 结构证据] |        Duration  221ms (transform 27ms, setup 12ms, collect 39ms, tests 114ms, environment 0ms, prepare 69ms)
  [G7 DB 结构证据] |     
  [G7 DB 结构证据] |     (node:10274) DeprecationWarning: Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead.
  [G7 DB 结构证据] |     (Use `node --trace-deprecation ...` to show where the warning was created)
  [G7 DB 结构证据] | | T011 migration-repro + T012 roles exit code | 0 | 0 | PASS |
  [G7 DB 结构证据] | | T011/T012 测试全绿 | true | true | PASS |
  [G7 DB 结构证据] | 
  [G7 DB 结构证据] | db-evidence: PASS
  [G7 DB 结构证据] --- real output end ---
  [G7 DB 结构证据] 结果: PASS

  [G8 FR/SC 覆盖审计] $ bun run coverage:audit
  [G8 FR/SC 覆盖审计] exit=0 duration=0.2s
  [G8 FR/SC 覆盖审计] --- real output begin ---
  [G8 FR/SC 覆盖审计] | # FR / SC / Acceptance substantive coverage audit
  [G8 FR/SC 覆盖审计] | 
  [G8 FR/SC 覆盖审计] | execution evidence: /var/folders/fl/3drhw1k154zct4qrgjlqbn_r0000gn/T/xiaoshuyin-vitest-results-7754.json
  [G8 FR/SC 覆盖审计] | 
  [G8 FR/SC 覆盖审计] | Slice 1 FR: 17/17 (structural, not substantive)
  [G8 FR/SC 覆盖审计] | Slice 1 SC: 8/8 (structural, not substantive)
  [G8 FR/SC 覆盖审计] | Slice 2 FR: 25/25 (structural, not substantive)
  [G8 FR/SC 覆盖审计] | Slice 2 SC: 11/11 (structural, not substantive)
  [G8 FR/SC 覆盖审计] | Slice 2 Acceptance: 18/18 (structural, not substantive)
  [G8 FR/SC 覆盖审计] | Slice 5 FR: 28/28 (structural, not substantive)
  [G8 FR/SC 覆盖审计] | Slice 5 SC: 14/14 (structural, not substantive)
  [G8 FR/SC 覆盖审计] | Slice 5 Acceptance: 24/24 (structural, not substantive)
  [G8 FR/SC 覆盖审计] | Slice 5 Findings: 8/8 (structural, not substantive)
  [G8 FR/SC 覆盖审计] | Slice 5 Reopened Tasks: 26/26 (structural, not substantive)
  [G8 FR/SC 覆盖审计] | Slice 3 FR: 21/21 (structural, not substantive)
  [G8 FR/SC 覆盖审计] | Slice 3 SC: 10/10 (structural, not substantive)
  [G8 FR/SC 覆盖审计] | Slice 3 Acceptance: 13/13 (structural, not substantive)
  [G8 FR/SC 覆盖审计] | Slice 5 Substantive Proofs: 41/41 (substantive)
  [G8 FR/SC 覆盖审计] | 
  [G8 FR/SC 覆盖审计] | # 003-evidence-core — FR / SC / Acceptance / Checklist Coverage Audit
  [G8 FR/SC 覆盖审计] | 
  [G8 FR/SC 覆盖审计] | ## Functional Requirements (21)
  [G8 FR/SC 覆盖审计] | 
  [G8 FR/SC 覆盖审计] | | Item | Test files | Status |
  [G8 FR/SC 覆盖审计] | |---|---|---|
  [G8 FR/SC 覆盖审计] | | FR-001 | tests/db/evidence-schema.test.ts, tests/domain/evidence-capabilities.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-002 | tests/db/evidence-schema.test.ts, tests/db/evidence-fks-supersedes.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-003 | tests/db/evidence-observation-storage.test.ts, tests/domain/evidence-observation.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-004 | tests/domain/evidence-provenance.test.ts, tests/integration/evidence-write.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-005 | tests/db/evidence-observation-storage.test.ts, tests/domain/evidence-observation.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-006 | tests/domain/evidence-conflict-supersedes.test.ts, tests/integration/evidence-write.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-007 | tests/db/evidence-fks-supersedes.test.ts, tests/domain/evidence-conflict-supersedes.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-008 | tests/db/evidence-fact-guard.test.ts, tests/domain/evidence-capabilities.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-009 | tests/integration/messages-create.test.ts, tests/integration/openapi-evidence.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-010 | tests/integration/messages-authorization.test.ts, tests/integration/messages-authorization-before-replay.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-011 | tests/db/evidence-rls-grants.test.ts, tests/db/evidence-fact-guard.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-012 | tests/integration/evidence-scope.test.ts, tests/domain/evidence-capabilities.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-013 | tests/integration/openapi-evidence.test.ts, tests/integration/messages-create.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-014 | tests/integration/evidence-scope.test.ts, tests/domain/evidence-conflict-supersedes.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-015 | tests/integration/openapi-evidence.test.ts, tests/integration/evidence-scope.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-016 | tests/domain/evidence-provenance.test.ts, tests/domain/evidence-person-reference.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-017 | tests/integration/messages-idempotency.test.ts, tests/db/evidence-audit-idempotency.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-018 | tests/integration/messages-authorization.test.ts, tests/integration/evidence-scope.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-019 | tests/integration/messages-create.test.ts, tests/domain/evidence-person-reference.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-020 | tests/integration/evidence-scope.test.ts, tests/db/migration-repro.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | FR-021 | tests/db/evidence-fks-supersedes.test.ts, tests/domain/evidence-person-reference.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | 
  [G8 FR/SC 覆盖审计] | ## Success Criteria (10)
  [G8 FR/SC 覆盖审计] | 
  [G8 FR/SC 覆盖审计] | | Item | Test files | Status |
  [G8 FR/SC 覆盖审计] | |---|---|---|
  [G8 FR/SC 覆盖审计] | | SC-001 | tests/db/evidence-schema.test.ts, tests/domain/evidence-capabilities.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | SC-002 | tests/domain/evidence-provenance.test.ts, tests/integration/evidence-write.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | SC-003 | tests/domain/evidence-conflict-supersedes.test.ts, tests/integration/evidence-write.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | SC-004 | tests/db/evidence-observation-storage.test.ts, tests/domain/evidence-observation.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | SC-005 | tests/db/evidence-fks-supersedes.test.ts, tests/domain/evidence-conflict-supersedes.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | SC-006 | tests/db/evidence-rls-grants.test.ts, tests/integration/messages-authorization.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | SC-007 | tests/integration/messages-create.test.ts, tests/integration/evidence-scope.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | SC-008 | tests/integration/evidence-scope.test.ts, tests/integration/openapi-evidence.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | SC-009 | tests/domain/evidence-provenance.test.ts, tests/domain/evidence-conflict-supersedes.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | SC-010 | tests/integration/evidence-scope.test.ts, tests/db/migration-repro.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | 
  [G8 FR/SC 覆盖审计] | ## Acceptance Scenarios (13)
  [G8 FR/SC 覆盖审计] | 
  [G8 FR/SC 覆盖审计] | | Item | Test files | Status |
  [G8 FR/SC 覆盖审计] | |---|---|---|
  [G8 FR/SC 覆盖审计] | | A01-message-raw-only-zero-assertion | tests/integration/messages-create.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | A02-guardian-relay-stays-statement | tests/integration/evidence-write.test.ts, tests/domain/evidence-provenance.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | A03-conflict-no-winner | tests/integration/evidence-write.test.ts, tests/domain/evidence-conflict-supersedes.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | A04-unknown-states-roundtrip | tests/db/evidence-observation-storage.test.ts, tests/domain/evidence-observation.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | A05-hypothesis-cannot-become-fact | tests/domain/evidence-capabilities.test.ts, tests/db/evidence-fact-guard.test.ts, tests/db/evidence-rls-grants.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | A06-supersedes-keeps-old-history | tests/db/evidence-fks-supersedes.test.ts, tests/integration/evidence-write.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | A07-cross-family-isolation | tests/integration/messages-authorization.test.ts, tests/db/evidence-rls-grants.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | A08-provenance-traceability | tests/db/evidence-schema.test.ts, tests/domain/evidence-provenance.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | A09-only-approved-message-post | tests/integration/openapi-evidence.test.ts, tests/integration/evidence-scope.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | A10-observation-separate-from-assertion | tests/db/evidence-schema.test.ts, tests/db/evidence-observation-storage.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | A11-ai-extractor-cannot-confirm-fact | tests/domain/evidence-capabilities.test.ts, tests/domain/evidence-provenance.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | A12-dependency-gate-blocked | tests/integration/evidence-scope.test.ts, tests/db/migration-repro.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | | A13-family-a-cannot-reference-family-b-person | tests/domain/evidence-person-reference.test.ts, tests/db/evidence-fks-supersedes.test.ts | COVERED |
  [G8 FR/SC 覆盖审计] | 
  [G8 FR/SC 覆盖审计] | FR 21/21
  [G8 FR/SC 覆盖审计] | SC 10/10
  [G8 FR/SC 覆盖审计] | Acceptance 13/13
  [G8 FR/SC 覆盖审计] | Checklist 115/115
  [G8 FR/SC 覆盖审计] | missing = 0
  [G8 FR/SC 覆盖审计] | coverage-audit (003): PASS
  [G8 FR/SC 覆盖审计] | 
  [G8 FR/SC 覆盖审计] | missing = 0
  [G8 FR/SC 覆盖审计] | coverage-audit: PASS (264/264, missing = 0)
  [G8 FR/SC 覆盖审计] | $ node scripts/coverage-audit.mjs
  [G8 FR/SC 覆盖审计] --- real output end ---
  [G8 FR/SC 覆盖审计] 结果: PASS

## 汇总

- Verification Plan 行数: 26（执行 25 条，BLOCKED 1 条）
- Full regression command: PASS
- Task-specific acceptance (T001–T120): proven by designated tests/evidence, not derived by this runner
- T121–T124 explicit BLOCKED: 1 条（Slice 4 runtime / 真实平台）
- NOT VERIFIED: 0 条（冻结 T118 要求 0 条）
- provenance: PASS
- tracked working tree (end): clean
- command PASS: 36
- command FAIL: 0
- verify-all: PASS

注：MAPPED 行使用承接测试文件，原因逐条列于上文；未修改任何冻结文档。
注：本日志在归档前已将本机绝对路径归一化为 <repo> / ~。
注：canonical execution evidence: /var/folders/fl/3drhw1k154zct4qrgjlqbn_r0000gn/T/xiaoshuyin-vitest-results-7754.json
