# T072 — Implement Convergence Evidence

**Feature**: `specs/001-family-identity-core`
**Branch**: `feat/001-family-identity-core`
**阶段**: Implement AI 收敛检查（不进入 Independent Review）

本文件在 Implement 收口时重读冻结文档与实现，逐项对照 FR / SC / API / DB / RLS /
consent-first / provenance / authorization / idempotency / scope，并归档治理校验结果。
所有结论均指向真实测试文件、真实命令输出或真实数据库查询；不使用「理论上应该」。

---

## 0. 重读的输入

| 类别 | 文件 |
|---|---|
| 规格 | `specs/001-family-identity-core/spec.md`（17 FR / 8 SC / Acceptance Evidence） |
| 计划 | `specs/001-family-identity-core/plan.md`（D-2…D-6、Verification Plan 26 行） |
| 契约 | `contracts/authorization-and-rls.md`、`contracts/consent-onboarding.md`、`contracts/identity-family-api.openapi.yaml`、`contracts/provenance.md` |
| 数据模型 | `specs/001-family-identity-core/data-model.md` |
| 验证指南 | `specs/001-family-identity-core/quickstart.md` §1 / §2 / §4 |
| 任务 | `specs/001-family-identity-core/tasks.md`（T001–T072） |
| 实现 | `apps/server/api/src/**`、`packages/{domain,compliance,contracts,authorization}/src/**`、`db/migrations/001_initial_schema.sql`、`db/init/01-roles.sh`、`.github/workflows/ci.yml` |
| 测试 | `tests/domain/**`(7)、`tests/db/**`(7)、`tests/integration/**`(12)、`tests/setup/**` |
| 生成物 | `packages/generated/openapi.json` / `openapi.d.ts` |

---

## 1. Functional Requirements — 17/17

| FR | 结论 | 实现 / 证据 |
|---|---|---|
| FR-001 | 一致 | `accounts` / `persons` / `families` / `family_members` 四张独立表；`tests/db/schema-structure.test.ts`；`tests/integration/auth.test.ts` |
| FR-002 | 一致（平台真实性除外） | 登录在 `withAccountTransaction` 内同事务建 Account + Person；`tests/integration/auth.test.ts` 4/4；真实 `code2session` 按 Plan 明确 **NOT VERIFIED**（§40 Platform 门槛），不写入已通过 |
| FR-003 | 一致 | 来源附着于 `person_profile_values` 逐值；`packages/domain/src/provenance.ts`；`tests/domain/provenance.test.ts`、`tests/integration/members.test.ts` |
| FR-004 | 一致 | 成员 Person 的 `account_id IS NULL`；来源不由「有无 Account」推断；`tests/integration/members.test.ts` 断言 `accountBound=false` |
| FR-005 | 一致 | `POST /families` 复用登录 Person，不新建 Person；`families.created_by_person_id UNIQUE`；guardian 关系单独在 `person_compliance_profiles.guardian_person_id` |
| FR-006 | 一致 | membership 与 guardian 两维独立；`tests/integration/authorization-dimensions.test.ts` 显式断言 `NOT_GUARDIAN`；`family_members` 无 role 列 |
| FR-007 | 一致 | `person_compliance_profiles` 落库 `age_band` / `minor_mode` / `verified_source` / guardian 引用 / consent 版本；`tests/evidence/quickstart.md` 段 4 有真实 SQL 输出 |
| FR-008 | 一致 | consent-first 顺序见 §5；无同意时 403 `GUARDIAN_CONSENT_REQUIRED` 且不落库；`tests/integration/consent-first.test.ts`、quickstart 段 4 |
| FR-009 | 一致 | `age_band=UNKNOWN` → BLOCK / `AGE_BAND_UNKNOWN`；`NOT_COLLECTED` 不在 enum；`tests/domain/age-band.test.ts` |
| FR-010 | 一致 | revoke 新增 `REVOKED` v2（`supersedes_id=v1`、`onboarding_request_id NULL`），v1 `GRANTED` 不可变；profile 指针前移；quickstart 段 5 / `tests/integration/consent-revoke.test.ts` |
| FR-011 | 一致 | 所有家庭级读写经 `withRlsTransaction` / 统一幂等编排的 family context；伪造 `family_id` 由 `set_family_context` 42501 拒绝；`tests/integration/authorization.test.ts` |
| FR-012 | 一致 | 9 张表 `ENABLE + FORCE RLS`、`accounts` 无 RLS、`xiaoshuyin_app NOBYPASSRLS`、owner = migrator；`tests/evidence/db-evidence.log` |
| FR-013 | 一致 | 上下文由 `set_identity_context` / `set_family_context` 在事务内设置；`tests/db/rls.test.ts` 覆盖连接池复用不泄漏 |
| FR-014 | 一致 | 六命令统一 `runIdempotentCommand`（同事务写 key + 事务级 advisory lock）；同 key 重放 / 不同 payload 409 / 并发 20 不重复；`tests/integration/idempotency.test.ts` 20/20 |
| FR-015 | 一致 | 9 张表 `id DEFAULT uuidv7()`；迁移只经 `db/migrations/001_initial_schema.sql`；`guard-static` R1 禁止 `drizzle-kit push`；`tests/db/migration-repro.test.ts` |
| FR-016 | 一致 | `persons.account_id UNIQUE` + `accounts` 主键；双向写入 unique violation；`tests/db/constraints.test.ts` |
| FR-017 | 一致 | `family_members` 唯一 (family, person)、`persons` 无 `family_id`；无跨家庭查找/复用 API；`tests/db/constraints.test.ts` + `schema-structure.test.ts` |

覆盖审计：`bun run coverage:audit` → **FR 17/17**、missing = 0（`scripts/coverage-audit.mjs`）。

---

## 2. Success Criteria — 8/8

| SC | 结论 | 证据 |
|---|---|---|
| SC-001 | 一致 | quickstart 段 1–3：登录 → 建家庭 → 无账号成员（全程无需孩子注册） |
| SC-002 | 一致 | 跨家庭 403 且响应无目标字段；无 GUC 查询 0 行；`authorization.test.ts` + `rls.test.ts` |
| SC-003 | 一致 | 同意前无 Person/profile；最小 onboarding 不自锁；同意后建档；撤回写新版本并阻断；quickstart 段 4–5 |
| SC-004 | 一致 | 未知属性不补默认值；`UNKNOWN` 不按 ADULT；`tests/domain/age-band.test.ts` |
| SC-005 | 一致 | 六命令重复提交不产生第二条记录；`idempotency.test.ts` 的 `no duplicate business object` 断言（每类 exactly +1） |
| SC-006 | 一致 | 多 Family 基数只在 DB 层；`persons` 无单家庭绑定列；无跨 Family API |
| SC-007 | 一致 | `tests/db/constraints.test.ts` 双向 unique violation |
| SC-008 | 一致 | 同一 Person 的 `DISPLAY_NAME` 多来源并存（`GUARDIAN_RELAY` + `SELF_STATEMENT` 两条 RECORDED），无 Person 级来源列；quickstart 段 3 有真实 SQL 行 |

覆盖审计：`bun run coverage:audit` → **SC 8/8**、missing = 0。

---

## 3. API / Contract

`bun run openapi:generate` → `bun run openapi:check`：**PASS (no drift)**。
`tests/integration/openapi.test.ts` 5/5 断言 13 个正式业务 operation 齐备、无计划外 endpoint、
revoke 只有一条正式路径、generated artifact 无 drift。

正式 13 个业务 operation（另有 1 个 `GET /healthz`，不属于业务）：

| # | Method | Path |
|---|---|---|
| 1 | POST | `/api/v1/auth/wechat` |
| 2 | POST | `/api/v1/auth/logout` |
| 3 | GET | `/api/v1/me` |
| 4 | POST | `/api/v1/families` |
| 5 | GET | `/api/v1/families/current` |
| 6 | POST | `/api/v1/families/{id}/members` |
| 7 | PATCH | `/api/v1/families/{id}/members/{personId}` |
| 8 | POST | `/api/v1/compliance/guardian-consents/requests` |
| 9 | POST | `/api/v1/compliance/guardian-consents` |
| 10 | POST | `/api/v1/consents/{id}/revoke` |
| 11 | GET | `/api/v1/consents` |
| 12 | GET | `/api/v1/compliance/profile` |
| 13 | GET | `/api/v1/compliance/notices` |

错误码映射集中在 `apps/server/api/src/plugins/error-handler.ts`；403 响应体只有 `code` / `message`，
不回显目标 Family / Person 字段（`authorization.test.ts` 显式断言）。`wechat_openid` 不出现在 Family / `/me` 响应。

---

## 4. Database / RLS

`bun run db:evidence` → **PASS**，输出见 `tests/evidence/db-evidence.log`（真实 `pg_catalog` / `information_schema` 查询）：

- 9 张业务表 `relrowsecurity=true` / `relforcerowsecurity=true`；`accounts` 为 `false/false`（唯一无 RLS 的业务表）
- 业务表 owner 全部为 `xiaoshuyin_migrator`；`xiaoshuyin_app` / `xiaoshuyin_migrator` 均 `rolbypassrls=false`
- 9 张表的 `id` 默认为 `uuidv7()`（`person_compliance_profiles` 以 `person_id` 为主键，无独立 id）
- 8 enum：`account_status` / `age_band` / `consent_decision` / `consent_purpose` / `consent_request_status` / `profile_attribute` / `profile_value_status` / `provenance_source`
- 10 张业务表；9 条 policy；1 个 consent 不可变触发器 `consent_records_guard`
- `persons.account_id` UNIQUE；`persons` 无 `family_id` / `source_kind` / `role` 列；`family_members` 无 role/creator/guardian 列
- `profile_attribute` 恰为 `{DISPLAY_NAME}`；无 `RELATION_DESCRIPTOR` enum label；无 `assertions` / `observations` 表
- **空库重建**：真实 `CREATE DATABASE … OWNER xiaoshuyin_migrator` → 首次 `db:migrate` `APPLY 001_initial_schema.sql` → 结构逐项核对 PASS
- **migration replay**：第二次 `db:migrate` `SKIP … already applied` / `Migration complete: 0 new`，对象指纹前后完全一致
- T011 `tests/db/migration-repro.test.ts` 7/7 + T012 `tests/db/roles.test.ts` 6/6 = **13/13 GREEN**（输出已归档）

RLS 行为：`tests/db/rls.test.ts` 9/9 —— 无 GUC → 0 行 / 写入被拒；identity context 只见本人；
Family A context 查 B → 0 行；连接池复用上下文不泄漏；`accounts` 不启用 RLS，窄访问由
`bun run guard:static` 的 R5 规则证明（输出归档于 `tests/evidence/guard-static.log`）。
幂等表隔离：`tests/db/idempotency-rls.test.ts` 3/3（A 只见 A 的 key、B replay 0 行、无上下文写入被拒）。

---

## 5. consent-first / UNDER_14 不变量

冻结顺序（plan D-3 / quickstart §2.3 / Phase 7 约束）：

```text
lock consent → validate → pregenerate personId → membership → Person
→ bind consent → UNDER_14 profile → values → audit → commit
```

`apps/server/api/src/routes/members.ts` 的 UNDER_14 分支在**收敛阶段修正**为该顺序：
consent 以 `FOR UPDATE` 锁定并校验（含 `NOT_GUARDIAN`、已绑定检查）发生在任何
`family_members` / `persons` 写入之前；`bindConsentToPerson` 在 Person 落库之后执行以满足
`bound_person_id` 的即时外键。修正后 `tests/integration/consent-first.test.ts`、
`members.test.ts`、`authorization*.test.ts`、`idempotency.test.ts` 共 47/47 PASS，
`tests/evidence/quickstart.md` 段 4–5 六段 6/6 PASS。

不变量：`guardian identity → minimal onboarding → GRANTED consent → formal child Person → Compliance Profile`。
无同意建 UNDER_14 → 403 `GUARDIAN_CONSENT_REQUIRED` 且库中无该未成年人 Person/profile。
版本语义：v1 `GRANTED` 不可变；revoke 新增 v2 `REVOKED`（`supersedes_id=v1`、`onboarding_request_id NULL`）；
regrant 开启新 v1 chain。`tests/evidence/quickstart.md` 段 5 有真实 `consent_records` 两行输出。

---

## 6. Provenance

`packages/domain/src/provenance.ts` + `apps/server/api/src/routes/members.ts` 的 PATCH 路径：
同一 (person, attribute, sourceKind) 的新值使旧值 `SUPERSEDED`；不同 sourceKind 的值并存。
quickstart 段 3 的真实 SQL 输出显示 `GUARDIAN_RELAY/RECORDED` 与 `SELF_STATEMENT/RECORDED` 两条并存。
`age_band` 的来源独立记录在 `person_compliance_profiles.verified_source`；`persons` 无 `source_kind`。

---

## 7. Authorization

- `tests/integration/authorization.test.ts` 7/7：跨家庭读写 403、响应无目标字段、伪造 `family_id` 不获访问、非 manager 新增/修改被拒
- `tests/integration/authorization-dimensions.test.ts` 5/5：
  - guardian-but-not-member：A 持有真实 GRANTED consent 但非 Family B 成员 → 403 `NOT_FAMILY_MEMBER`，B 的 `family_members` 仍 1 行
  - member-but-not-guardian：fixture 把真实 Account-backed Person 加入 family_members 后，其 grant 与 revoke 均返回正式 **403 `NOT_GUARDIAN`**；两条用例各打印判定依据
- `packages/authorization/src/authorize.ts` 为 fail-closed 纯函数；`guard-static` R4 保证 `apps/**` 不直接持有 family-scoped SQL

---

## 8. Idempotency

`apps/server/api/src/idempotency.ts` 为六个命令提供**单一**编排：
解析请求 → 计算 `requestHash` → 只读快速路径（replay / `IDEMPOTENCY_PAYLOAD_MISMATCH` 409，
先于任何业务状态校验）→ 业务事务内 `pg_advisory_xact_lock` 串行化同 key → 二次检查 →
执行业务 → **同事务**写 `idempotency_keys` → commit。

`tests/integration/idempotency.test.ts` 20/20：一套参数化框架覆盖
`FAMILY_CREATE`、`MEMBER_CREATE`、`MEMBER_UPDATE`、`GUARDIAN_CONSENT_REQUEST`、
`GUARDIAN_CONSENT_GRANT`、`GUARDIAN_CONSENT_REVOKE`，每类三条断言
（replay 原响应 / 不同 payload 409 / 恰好 +1 业务对象且重放不新增）；
另覆盖并发 20 同 key（family_members 恒为 2、所有成功响应同一 personId）与 GET 不消耗 key。

---

## 9. Scope

`guard-static: PASS (0 violations)`（`tests/evidence/guard-static.log`）证明：
无 `drizzle-kit push`、无禁用的 `sql.raw` 拼接、无 secret literal、
`apps/**` 无 family-scoped 表访问、accounts 窄访问且 `wechat_openid` 不泄漏、
无 forbid 目录（`apps/miniprogram`、`packages/ai` / `rag` / `memory` / `scenes` / `notifications`）、
无 `case_participants` / `assertions` / `observations`。

---

## 10. Verification / Evidence

| 证据 | 位置 | 结果 |
|---|---|---|
| 26 条 Verification Plan 逐条真实输出 | `tests/evidence/verify-all.log` | **命令 PASS 36 / FAIL 0**；25 条执行 + 1 条按 Plan 标 NOT VERIFIED；逐条含 exit code / stdout / 耗时 |
| 静态守卫（accounts 窄访问 + 范围守卫） | `tests/evidence/guard-static.log` | PASS (0 violations) |
| DB / RLS / 空库重建 / replay / T011-T012 | `tests/evidence/db-evidence.log` | PASS |
| quickstart §2 六段真实请求 | `tests/evidence/quickstart.md` | PASS (6/6) |
| FR/SC 覆盖审计 | `bun run coverage:audit` | FR 17/17、SC 8/8、missing = 0 |
| OpenAPI 生成 / 漂移 | `bun run openapi:generate` / `openapi:check` | PASS (no drift)，14 paths |
| 全量测试 | `bun run vitest run`（verify-all G1 真实输出） | **26 files / 151 tests 全部 PASS** |

plan.md Verification Plan 中有 7 个 Plan 阶段设想的测试文件在实现阶段被合并/重命名
（`me.test.ts`、`age-band-source.test.ts`、`cardinality.test.ts`、`consent-chain.test.ts`、
`consent-binding.test.ts`、`profiles.test.ts`、`rls-transaction.test.ts`）。
`verify-all.log` 将这些行标为 **MAPPED**，逐条给出承接的真实测试文件并真实执行，未静默跳过。
FR-002 平台真实性按 Plan 明确标为 **NOT VERIFIED**，未伪造通过。

---

## 11. Governance

- `node .specify/scripts/validate-governance.mjs` → **PASS**（`Spec governance validation PASS`，feature 状态 `tasked`）
- `node .specify/scripts/tests/run-governance-tests.mjs` → **PASS：10/10 cases**（A–I + H2 全 PASS）
- `git diff --name-only origin/main...HEAD`：共 103 个文件，均为本 feature 的实现/测试/脚本/证据；
  受保护路径中仅出现 `specs/001-family-identity-core/spec.md`，无 `Docs/**`、无 `.specify/memory/**`
- **预期内修正**：commit `5f9da87`「analyze: close out F-01..F-09 before implement」对 `spec.md`
  只有 **1 行**修正（F-04）：验收场景 1 去掉过时的「若已建立」，改为「微信登录完成后 Person 必然已建立，见 US1」。
  这属于 Analyze closeout 的已知修正，Implement 阶段没有再改动 `spec.md` / `plan.md` / `contracts/**` / `data-model.md` 的语义，
  只按任务完成状态更新 `tasks.md` 的 `[x]` 标记。
- 治理结论：无预期外的 source-of-truth 改动。

---

## 12. Deviations（全部可解释，未修改冻结文档）

1. **Plan Verification Plan 的 7 个测试文件名未落地**：实现阶段把覆盖合并到真实测试文件，
   `verify-all.mjs` 以 MAPPED 逐条执行承接文件并写明原因。未跳过、未伪造通过。
2. **quickstart §2 文本使用早期字段名**：`Idempotency-Key` header vs body `idempotencyKey`、
   `values/value/source` vs `profileValues/valueText/sourceKind`、`noticeVersion "2026-11-v1"` vs `v1`、
   `onboardingRequestId` vs `consentRequestId`、revoke 无 `reason`。按冻结契约 `packages/contracts/src/schemas.ts`
   与已生成 OpenAPI 执行；逐条记录在 `tests/evidence/quickstart.md` 的偏差表。
3. **quickstart §2 用 curl :8787**：本机该端口被沙箱网络代理拦截（`502 upstream connect failed`），
   改用 Fastify `app.inject` 调用同一套真实 handler / auth hook / RLS / PostgreSQL；已在证据中标注。
4. **`.gitignore` 最小白名单调整**：原规则忽略全部 `tests/evidence/*.log` 与 `quickstart.md` / `converge.md`，
   为交付证据文件增加 3 个 `!` 白名单并移除 2 条 md 忽略；未改变任何忽略规则语义，未放行 `.env` 或 secret。
5. **收敛阶段顺序修正**：`members.ts` 的 UNDER_14 事务内语句顺序调整为冻结的
   `lock consent → validate → … → bind consent → profile`（见 §5）；不改 API / 响应体 / 错误码 / schema。
6. **FR-002 平台真实性**：按 Plan 与 quickstart §5 明确 **NOT VERIFIED**（真实 `code2session` 属 §40 Platform 门槛）。
7. **本地 `bun run typecheck` 的递归自调用**：根 `package.json` 的 `typecheck` 脚本调用 `bun run --recursive typecheck`，
   而 `--recursive` 会把根包自身也纳入遍历，形成自递归（本机 bun 1.3.14 下被 SIGTERM/137 终止）。
   **正式门禁不受影响**：CI Static Checks job 的 Typecheck 步骤在该命令上真实 PASS（run `41956158657` 五 job 全绿）；
   本地等价验证为 `tsc -p tsconfig.base.json --noEmit` + `apps/server/api` 下 `tsc --noEmit`，两者均 PASS
   （verify-all G3 / G4 真实输出）。本轮未改动根脚本，以免影响已绿的 CI 命令。

---

## 13. Remaining gaps

- 实现与冻结规格之间**无剩余 gap**；上述 6 项均为已记录、可解释的偏差或 Plan 明确排除项。
- `FR-002 平台真实性` 不属于本 Slice 验收范围，按 Plan 保留 NOT VERIFIED，不写成已通过。
- CI 五个 job 的最终状态由 T071 在 Final Head 上单独验收（最终交付报告给出 run 链接），
  本文件不引用旧 run 冒充最终结果。

**收敛结论：Implement 阶段可交付 Independent Converge。**
