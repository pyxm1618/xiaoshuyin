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
**版本语义（当前唯一最终语义）**：

```text
v1 GRANTED   (request A, bound_person_id → P, supersedes NULL)
→ v2 REVOKED (supersedes v1, onboarding_request_id NULL, bound P)
→ v3 GRANTED (request B, bound P, supersedes v2, pointer → v3)
```

三条链的 `bound_person_id` 最终都指向同一 Person P；compliance pointer 推进到 v3；Person 数不增加；
processing gate 恢复 ALLOW。证据：`tests/integration/consent-revoke.test.ts`、
`tests/integration/consent-reconsent.test.ts`、`tests/integration/processing-gate.test.ts`、
`tests/evidence/quickstart.md` 段 5。

> **Historical — superseded by Independent Review remediation**
> 本文件早期正文曾写「regrant 开启新 v1 chain」。那是 Round 1 之前实现的**当时状态**
> （grant 固定 `version = 1`、`supersedes_id = NULL`），已被 Independent Converge Round 1 判为缺口，
> 并在 remediation 中改为上述冻结 v1→v2→v3 链。该旧结论**不再是当前事实**，保留仅为审计历史。

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
7. **本地 `bun run typecheck` 的递归自调用 — Historical — superseded by Independent Review remediation**
   - **当时状态**：根 `package.json` 的 `typecheck` 脚本是
     `tsc -p tsconfig.base.json --noEmit && bun run --recursive typecheck`；`--recursive` 会把根包自身
     也纳入遍历，形成自递归（本机 bun 1.3.14 下被 SIGTERM/137 终止）。当时以 CI Static Checks
     （run `41956158657` 五 job 全绿）与分步 `tsc` 等价验证作为门禁。
   - **后续 remediation**：Round 1 remediation 已把根脚本改为 `node scripts/typecheck-all.mjs`
     （先 root tsbase，再遍历 `apps/server/*` + `packages/*` 各跑一次、不回调 root、确定性 exit、
     不引入新依赖）。CI `Static Checks` 继续直接调用同一个正式命令。
   - **当前状态**：`bun run typecheck` **单次完成、exit 0、无递归**（见 §14 与本轮验证表）。
     上面「未改动根脚本 / 本地无法完整执行」的说法是历史描述，不再是当前事实。

---

## 13. Remaining gaps

- 实现与冻结规格之间**无剩余 gap**；上述 6 项均为已记录、可解释的偏差或 Plan 明确排除项。
- `FR-002 平台真实性` 不属于本 Slice 验收范围，按 Plan 保留 NOT VERIFIED，不写成已通过。

---

## 14. Independent Converge Round 1 FAIL → Implement Remediation

**Round 1 判定（保留，不抹除）**：`INDEPENDENT CONVERGE FAIL — RETURN TO IMPLEMENT`
基线 `bb400eb2455437591d2644e729e11854491cc03e`。Review 确认 6 个缺口（1 CRITICAL / 4 HIGH / 1 MEDIUM）：

| # | 级别 | Round 1 缺口 | 违反 |
|---|---|---|---|
| 1 | CRITICAL | revoke consent 后仍可写 UNDER_14 profile values（PATCH 无 processing gate） | V1-C39、FR-010、T058/T059、consent-onboarding §7 门禁 |
| 2 | HIGH | re-consent 新开 v1，而非接续 v3 版本链 | consent-onboarding §6.1 |
| 3 | HIGH | provenance provider 可由客户端伪造（`pv.providedByPersonId ?? personId`） | contracts/provenance.md、T051/T057 |
| 4 | HIGH | Family creator 未强制 `ageBand=ADULT`（request 与 DB 不一致） | T046、plan D-2、CHK023 |
| 5 | HIGH | root `typecheck` 自递归（`--recursive` 含 root 自身） | 本地无法完整执行 typecheck |
| 6 | MEDIUM | `GET /consents` 返回裸数组，非冻结 OpenAPI 的 `{ "items": [...] }` | identity-family-api.openapi.yaml |

**修复证据（本轮）**

| # | 修复 | 验证 |
|---|---|---|
| 1 | `routes/members.ts` PATCH 在任何 profile-value 写入前调用冻结门禁 `assertMinorProcessingAllowed`（读 profile + consent pointer 后纯函数判定）；BLOCK 时直接抛出冻结 GateReason，不 supersede / 不 insert / 不写成功 audit。`error-handler.ts` 补入冻结 GateReason 的 403 映射 | `tests/integration/processing-gate.test.ts` 3/3：GRANTED→PATCH 成功；revoke→PATCH 403 `GUARDIAN_CONSENT_REVOKED` 且 values/audit 行完全不变；re-consent v3 后恢复 200 |
| 2 | `routes/compliance.ts` grant 分支按 §6.1 接续版本链：request 带 `subject_person_id` 且该 Person 为 UNDER_14 且存在 consent pointer 时，锁 profile + 当前 consent，校验当前版本必须是 `REVOKED`、actor 是当前 guardian，`newVersion = current.version + 1`、`supersedes_id = current.id`、INSERT 即带 `bound_person_id=P` / `bound_at=now`，并推进 profile pointer；subject 不存在则走首次 v1。`getConsentRequestForUpdate` 增取 `subject_person_id`/`family_id`，新增 `getComplianceProfileForUpdate` | `tests/integration/consent-revoke.test.ts` 3/3：v1 GRANTED(supersedes NULL) / v2 REVOKED(supersedes v1, request NULL) / v3 GRANTED(supersedes v2, request B, bound P)；三行 `bound_person_id` 同一 P；pointer=v3；本家庭成员数不变；gate 恢复 ALLOW |
| 3 | `packages/domain/src/provenance.ts` 新增纯函数 `resolveProvenanceProvider`：SELF_STATEMENT→provider 必须等于 subject；relay/observation→显式 provider 必须是本家庭成员；UNDER_14 创建→固定 `consent.guardian_person_id` 且拒绝显式不同值；默认 actor 仅用于 relay 且 actor 本身是成员。三个入口（POST member / PATCH member / family creator）统一走该解析器，违规 → 422 `AGE_BAND_SOURCE_NOT_ALLOWED`（T051/T057 任务正文指定的正式错误码） | `tests/integration/age-band-source.test.ts` 7/7（creator 伪造/越界 provider 422、member 伪造 SELF_STATEMENT 与越界 relay 422、合法家庭 provider 201、无 Account 成人 SELF_STATEMENT 201）+ `tests/integration/members.test.ts` 14/14（UNDER_14 provider≠guardian 422、=guardian 201） |
| 4 | `routes/families.ts` 改用 `checkSourceAcceptability('FAMILY_CREATE', ageBand, ageBandSource)`，`ageBand !== 'ADULT'` → 403 `FAMILY_MANAGER_MUST_BE_ADULT`，与 request/DB 一致；失败事务零残留 | `tests/integration/families.test.ts` 6/6：MINOR_14_17 / UNDER_14 creator → 403 `FAMILY_MANAGER_MUST_BE_ADULT`，且 family / family_members / profile / value / audit 计数均无新增；ADULT+SELF_STATEMENT → 201 |
| 5 | root `package.json` 的 `typecheck` 改为 `node scripts/typecheck-all.mjs`：先跑 root tsbase，再遍历 `apps/server/*` + `packages/*` 中带 `typecheck` script 的 workspace 各跑一次，不回调 root，确定性 exit；不引入新依赖 | `bun run typecheck` **单次完成 exit 0**（root + 5 个 workspace 逐个执行，无递归） |
| 6 | `routes/consents.ts` `GET /api/v1/consents` 统一返回 `{ "items": [...] }`（无家庭 → `{ "items": [] }`），与冻结 OpenAPI 一致；冻结契约未修改 | `tests/integration/consent-read.test.ts` 4/4：`toEqual({ items: [] })`、`body.items` 为数组 |

**本轮全量验证**

| 命令 | 结果 |
|---|---|
| `bun run typecheck` | PASS（exit 0，单次完成） |
| `bun run guard:static` | PASS (0 violations) |
| `bun run openapi:generate` / `openapi:check` | PASS（14 paths，no drift；`packages/generated/*` 无变化） |
| `bun run vitest run` | **28 files / 166 tests 全部 PASS** |
| `bun run db:evidence` | PASS（结构/RLS/空库重建/replay/T011-T012 13/13） |
| `bun run coverage:audit` | PASS（FR 17/17、SC 8/8、missing = 0） |
| `bun run verify-all` | 见 `tests/evidence/verify-all.log` 汇总段 |
| `node .specify/scripts/validate-governance.mjs` | PASS |
| `node .specify/scripts/tests/run-governance-tests.mjs` | PASS 15/15 |
| 重点专项（7 个 suite 独立执行） | consent-revoke 3/3、consent-first 3/3、members 14/14、families 6/6、consent-read 4/4、age-band-source 7/7、processing-gate 3/3 |

**TDD 记录**：先改 `consent-revoke.test.ts` 的错误断言 `new chain starts at v1` 为冻结 v3 预期并跑出 RED（`expected 1 to be 3`），再实现版本链接续；其余 5 项同样先写冻结预期跑出 RED（共 10 个失败：4 provider / 2 GET consents / 2 ADULT / 2 gate），最小实现后转 GREEN。

**任务状态**：T046、T051、T057、T058、T059、T060、T068、T072 已按 Review 要求重置为 `[ ]` 后逐项重验并重新 `[x]`，当前 `tasks.md` = **72/72**。

---

> **Historical — superseded by Independent Converge Round 2**
> 上一行「Implement Remediation 已修复 Round 1 全部 6 项缺口，可交付 Round 2」是 §14 结尾的**当时结论**。
> Independent Converge Round 2 随后判定 `FAIL — RETURN TO IMPLEMENT`（2 OPEN + 1 新 HIGH + 1 evidence MEDIUM
> + 1 workspace artifact），因此该结论不再是最终事实。保留仅为审计历史，见 §15。

---

## 15. Independent Converge Round 2 FAIL → Implement Remediation（历史记录）

**Round 2 判定（保留，不抹除）**：`INDEPENDENT CONVERGE FAIL — RETURN TO IMPLEMENT`
基线 `e60213f708b6e350c351ccaece207a209f3301f3`。本轮只处理 Reviewer 确认的 2 OPEN + 1 新 HIGH + 1 evidence MEDIUM + 1 本地 artifact，未扩散、未修改任何冻结 Source of Truth。

| # | 级别 | Round 2 缺口 | 违反 |
|---|---|---|---|
| 1 | CRITICAL（OPEN） | processing gate 用无锁 `getComplianceProfileForGate`，TOCTOU：revoke 200 返回后旧 GRANTED PATCH 仍可提交 | V1-C39 / FR-010 / consent-onboarding §7 |
| 2 | HIGH（OPEN） | `resolveProvenanceProvider` 的 pinned 分支绕过 source 校验：UNDER_14 创建接受 `SELF_STATEMENT` / `OTHER_MEMBER_RELAY` | contracts/provenance.md |
| 3 | HIGH（新） | `subject_person_id != NULL` 时预条件不全满足却回退 Mode A，偷偷创建未绑定 v1 | consent-onboarding §6.1 |
| 4 | MEDIUM（evidence） | `converge.md` 旧正文仍写「regrant 开启新 v1 chain」与「typecheck 自递归未修」，与本文件 remediation 结论自相矛盾 | §VI 证据真实性 |
| 5 | workspace artifact | `.arts/settings.json`（`{"clawMode.mode":"claw"}`）为 Round 2 审计工具产生的 untracked 本地 artifact | 工作区清洁 |

**修复证据（本轮）**

| # | 修复 | 验证 |
|---|---|---|
| 1 | `routes/members.ts` 的 `runProcessingGate` 改用 `getComplianceProfileForUpdate`（`FOR UPDATE`），锁保持到命令事务 commit；consent row 仍为无锁读。**锁顺序一致性**：`person_compliance_profiles` 是唯一序列化原语，processing 命令只持该行锁、绝不阻塞在 `consent_records` 上；revoke 是唯一同时持两锁的命令（先 consent 后 profile），因此不可能形成等待环。未给 PATCH 增加 consent `FOR UPDATE`，未调整 revoke，未引入分布式锁/新依赖 | `tests/integration/processing-gate.test.ts` 新增确定性并发回归：用 `person_profile_values` 行锁作 barrier 把真实 PATCH 停在事务中，`pg_stat_activity.wait_event_type='Lock'` 断言 revoke 确实阻塞；Scenario A（revoke 等待 in-flight PATCH，PATCH 写入先于 revoke 返回）+ Scenario B（revoke 先行 → PATCH 重读 pointer → 403 `GUARDIAN_CONSENT_REVOKED`，无新 value / 无 supersede / 无成功 audit）。明确断言「revoke 不得在 PATCH in-flight 时返回 200」 |
| 2 | `packages/domain/src/provenance.ts` 的 pinned 分支改为：先判断 `sourceKind ∈ {GUARDIAN_RELAY, GUARDIAN_OBSERVATION}`（否则 `INVALID`），再校验显式 `providedByPersonId === pinnedProvider`，最后才 `FIXED provider = pinnedProvider`；不静默改写非法来源 | `tests/integration/age-band-source.test.ts` 12/12：GUARDIAN_RELAY / GUARDIAN_OBSERVATION + **真 guardian** provider → 201；SELF_STATEMENT / OTHER_MEMBER_RELAY + 真 guardian → 422 `AGE_BAND_SOURCE_NOT_ALLOWED`；guardian source + fake provider → 422；失败时按 family 作用域断言 no Person / no membership / no profile / no value / consent 未被误绑定 |
| 3 | `routes/compliance.ts` 明确区分 Mode A（`subject_person_id IS NULL`）与 Mode B（非 NULL）。Mode B 依次校验 10 项：family scope、profile 存在、UNDER_14、pointer 存在、current record 存在、`decision=REVOKED`、current `bound_person_id=subject`、current guardian=actor、profile guardian=actor、request guardian=actor。任一不满足即抛错（用现有 `VALIDATION_ERROR` / `NOT_GUARDIAN` / `GUARDIAN_CONSENT_ALREADY_GRANTED`，未造新 code），**绝不回退 Mode A**；错误发生在 `updateConsentRequestGranted` 之前，故不建 record / 不完成 request / 不动 pointer。consent 读改用无锁 `getConsentRecordForGate` 以保持锁顺序一致 | 新增 `tests/integration/consent-reconsent.test.ts` 5/5：成人 creator 作 subject → 422、幽灵 subject 被 FK 拒绝且无泄漏、越 family subject → 422、current 仍 GRANTED → 409 且无新版本、Mode A 未绑定 v1 → revoke v2 → Mode B v3（1/2/3 版本链、supersedes、bound 同一 P）。三者均断言 request 保持 `PENDING`、无新 consent record、响应不回显 subject id |
| 4 | §5 与 §12 的旧结论分别加上 `Historical — superseded by Independent Review remediation` 标记，写明**当时状态 / 后续 remediation / 当前状态**；§5 当前唯一版本语义改为 `v1 GRANTED → v2 REVOKED → v3 GRANTED`；typecheck 当前状态改为「`bun run typecheck` 单次完成 exit 0」 | 本文件 §5 / §12 / §14 历史均保留，未删除任何 Round 1 或 Round 2 失败记录 |
| 5 | 确认 `.arts/settings.json` 非 git tracked、无项目代码引用（`clawMode` 无命中）、为本地工具产物后直接删除；未 commit、未因此改业务代码、未给整个 `.arts` 新增 gitignore | `git status --short` 删除后为空 |

**TDD 记录（本轮）**：先写 5 组冻结预期并跑出真实 RED —— ① 并发 stale-read（`expected false to be true`，revoke 在 PATCH in-flight 时未被阻塞）② UNDER_14 SELF_STATEMENT + 真 guardian（`expected 201 to be 422`）③ UNDER_14 OTHER_MEMBER_RELAY + 真 guardian（`expected 201 to be 422`）④ 真 no-account ADULT fixture（原测试误用 `MINOR_14_17`，改为 `ADULT` 并断言 `account_id IS NULL` / `age_band=ADULT` / provider=subject）⑤ 成人 subject re-consent（`expected 201 to be 422`）。实现后 22/22 → GREEN；修复期间另定位并解决 `getConsentRecordForGate` 未取 `version` 导致 `NaN` → 500 的真实缺陷。

**专项验证（6 个 suite 独立执行）**：processing-gate 5/5、age-band-source 12/12、consent-revoke 3/3、consent-grant 5/5、members 14/14、consent-reconsent 5/5。

**本轮全量验证（当前 Head 真实执行）**

| 命令 | 结果 |
|---|---|
| `bun run typecheck` | PASS（exit 0，单次完成、无递归） |
| `bun run guard:static` | PASS (0 violations) |
| `bun run openapi:check` | PASS (no drift，14 paths；冻结契约未改) |
| `bun run vitest run` | **29 files / 178 tests 全部 PASS，exit 0，零 skipped** |
| `bun run db:evidence` | PASS（结构/RLS/空库重建/replay/T011-T012 13/13） |
| `bun run coverage:audit` | PASS（FR 17/17、SC 8/8、missing = 0） |
| `bun run verify-all` | **未收口**：见下方「验证阻塞」；单独执行 `validate-governance` PASS、`run-governance-tests` PASS 15/15、`bun run vitest run` 29/178 PASS，但归档脚本内该治理子命令被宿主沙箱拦截 |
| `node .specify/scripts/validate-governance.mjs` | PASS |
| `node .specify/scripts/tests/run-governance-tests.mjs` | PASS 15/15（单独执行） |

**验证基础设施调整（非业务修复、非扩散）**：本机 10 核下 vitest 无界 fork 会同时创建
10 个 Fastify app + 各自 `pg.Pool(max:10)`，打满本地 PostgreSQL 18 的 `max_connections=100`，
三次复现 `beforeAll` hook timeout / `ECONNREFUSED 127.0.0.1:5433` / 大量 skipped suites
（并曾使 `xiaoshuyin-pg18` 容器退出，已恢复）。为让官方命令 `bun run vitest run` 确定性跑完
且**不把任何 timeout 当 PASS**，在 `vitest.config.ts` 增加 `maxWorkers: 3`
（CI runner 核数本就低于此值，行为一致）。该改动只限制并行 fork 数：
**未改任何测试断言、预期输出、fixture、业务实现或冻结文档**；调整后所有 29 个 suite / 178 个用例
真实执行并全部通过，collect 由 1338s 降至 448s。
配套的 `scripts/verify-all.mjs` 单命令超时由 300000ms 调到 600000ms：受限并发下 G1 全量约需 320s，
原上限会以 `spawnSync ETIMEDOUT / exit 143` 中途杀掉（首次归档因此出现 1 条 FAIL）。
**未把该 timeout 当作 PASS**：调整上限后重新完整执行，G1 全量 `exit=0 / 29 files / 178 tests` 已通过。
但该次归档仍有 1 条 FAIL：见下方「验证阻塞」。
这两处都只影响验证运行参数，不改任何测试断言、预期输出或业务语义。

**验证阻塞（如实记录，未抹除）**：`node scripts/verify-all.mjs --archive` 的 GOVERNANCE 段中
`run-governance-tests.mjs` 子进程返回 `exit=1`，真实错误为宿主安全 shim 的
`EPERM: operation not permitted, unlink '/var/folders/.../xiaoshuyin-gov-*/ .specify/memory/constitution.md'`
（临时 fixture 清理被 `node-safe-delete-shim` 拦截），**与仓库代码/测试断言无关**；同一命令在
Bash 中单独执行为 PASS 15/15。随后 Bash 通道本身被宿主
`sandbox-exec: data object length 67229 exceeds maximum (65535)` 完全阻塞
（主会话 / 子代理 / 沙箱与非沙箱均同一错误），因此无法重跑归档、执行两批 commit / push 或确认 Final Head CI。
`tests/evidence/verify-all.log` 当前为 `35 PASS / 1 FAIL`，**不得当作已通过证据**。

**任务状态（当前，未收口）**：T057、T058、T059、T068、T072 仍为 `[ ]`（`tasks.md` = **67 / 72**）。
按 Review §19，只有上表全部验证真正 PASS 后才逐项设回 `[x]`；当前 `verify-all` 未收口，
故保持开放，不制造 72/72 假完成。

---

## 16. 原环境阻塞时的结论（历史记录，已由 §17 取代）

**代码状态**：Independent Converge Round 2 的 4 个 code/evidence finding 已全部修复并 RED→GREEN，
workspace artifact 已清理；冻结 Source of Truth 未改动；Round 1 / Round 2 失败历史完整保留在 §14 / §15。
`bun run vitest run` 29/178、typecheck、guard、openapi、db-evidence、coverage、governance 均真实 PASS。

**但本轮尚未收口**：`verify-all` 归档仍为 35 PASS / 1 FAIL（宿主安全 shim 拦截，见上文），
Bash 通道被宿主 `sandbox-exec` 错误完全阻塞，无法重跑归档 / commit / push / 确认 Final Head CI，
5 个 Task 仍为 `[ ]`。按 §23 条件，**不得输出 `IMPLEMENT REMEDIATION COMPLETE`**，状态为 **BLOCKED**。

**下一步（环境恢复后执行）**：重跑 `node scripts/verify-all.mjs --archive` 得到 36 PASS / 0 FAIL →
逐项把 T057/T058/T059/T068/T072 设回 `[x]` → 两批 commit → `git push origin feat/001-family-identity-core`
→ 确认同一 Final Head 六项 checks 全 SUCCESS → 再宣布完成。



## 17. Final Closeout 本地验证（2026-11-05）

保留 §15–16 的当时失败和阻塞历史；其 35/1、67/72 与阻塞结论不再描述本次本地验证状态。
本地 PostgreSQL 18.6 的测试数据库可用，迁移检查通过；原首条失败命令重新执行为 10/10 PASS。
T057 的时间顺序断言由 `<=` 收紧为要求的 `<`，专项测试 3/3 PASS。
之后重新执行 `node scripts/verify-all.mjs --archive`：36 PASS / 0 FAIL，完整套件 29 files / 178 tests，0 skipped；详细输出见 `verify-all.log`。其中真实微信平台验证仍为 NOT VERIFIED。
逐项核对 T057（严格顺序及专项 PASS）、T058（§14 的 RED 记录）、T059（撤回专项 PASS）、T068（完整归档 PASS）、T072（收敛记录、治理验证及受保护文件说明），任务状态为 72/72。
Final Head CI 是独立外部证据，须以提交后的 GitHub Actions 结果为准；此处不预先声明通过。
