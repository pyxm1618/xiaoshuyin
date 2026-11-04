# Tasks: 家庭身份地基（Account / Person / Family / 成员关系 / UNDER_14 consent-first）

**Feature**: `specs/001-family-identity-core/spec.md`
**Input**: `spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/**`、`quickstart.md`、`checklists/requirements-quality.md`
**Branch**: `feat/001-family-identity-core`
**Frozen Plan**: `plan.md`（Analyze closeout 仅补齐 D-6.4 的 CREATE TYPE 清单为 8 个 enum；其余决策不变）
**Docs baseline**: `Docs/V1产品需求.md` v3.3、`Docs/V1技术设计.md` v3.8

> **Gate**: Checklist 61/61 PASS、Residual blockers NONE。实现前 MUST 先通过 `/analyze`；本文件只把已冻结方案拆成可执行任务，不引入任何新表、新 API、新字段、新错误语义、新 consent 流程、新 provenance、新 RLS 模型或新技术栈。
>
> 任务格式：`- [ ] T### [REQ:<上游/章节>] <动作与路径>（依赖 T###） [VERIFY:<证据>]`；`[P]` 表示与同批次其它任务无文件冲突且无未完成依赖；`[US1]`–`[US4]` 标注主要服务的故事。

## Execution Batches（并行设计）

| Batch | 内容 | 可并行性 |
|---|---|---|
| A | Phase 1 工程基础 | 多任务 `[P]`（不同文件） |
| B | Phase 2 角色 + 迁移基础 | 串行（同一 Compose / 同一 migration 入口） |
| C | Phase 3 核心 schema | **串行**（同一份 reviewed migration，禁止并行改同一文件） |
| D | Phase 4 契约 + 纯逻辑 | 多任务 `[P]`（contracts / domain / authorization / compliance 分属不同包） |
| E | Phase 5–7 命令与 API（按 US1→US3） | 同一 Story 内串行；不同 Story 仅在依赖满足后可并行 |
| F | Phase 8–9 边界验证与回归 | 测试文件互不冲突，可部分 `[P]` |

---

## Phase 1 — Repository / Runtime Foundation

目标：只建立本 Slice 真正需要的工程底座（Node 26 / TS / ESM / Fastify 5 / PG18 / Drizzle / Zod / Vitest / OpenAPI）。不创建 AI、RAG、memory、scenes、Case、小程序、运营端、Notification 任何目录或空壳。

- [ ] T001 [P] [REQ:§4.1;plan:Technical-Baseline] 建立 bun workspace 根工程：`package.json`（workspaces: apps/*、packages/*）、`tsconfig.base.json`（ESM + NodeNext + strict）、`.gitignore`、`engines.node=26.13.0`（无依赖） [VERIFY:`bun install` 成功且 `bunx tsc -p tsconfig.base.json --noEmit` 通过]
- [ ] T002 [P] [REQ:§4.1;§3] 建立服务端骨架 `apps/server/api/src/app.ts`、`server.ts`、`plugins/config.ts`（Fastify 5 + ESM + 结构化 logger），仅暴露 `GET /healthz`（依赖 T001） [VERIFY:`bun run dev:api` 启动后 `curl -s localhost:8787/healthz` 返回 200]
- [ ] T003 [P] [REQ:plan:Project-Structure] 建立四个包骨架 `packages/contracts`、`packages/domain`、`packages/authorization`、`packages/compliance`（各含 `src/index.ts` + tsconfig，无业务实现）（依赖 T001） [VERIFY:`bun run typecheck` 通过且四包可被 apps 引用]
- [ ] T004 [P] [REQ:§32;plan:Technical-Baseline] 配置 Vitest：`vitest.config.ts`、`tests/setup/env.ts`（读取 `DATABASE_URL` / 不接受缺失）、测试目录 `tests/{domain,integration,db,fixtures}`（依赖 T001） [VERIFY:`bun run test -- --run` 执行 0 个用例且退出码 0]
- [ ] T005 [P] [REQ:§7.0;FR-015] 配置 Drizzle：`db/drizzle.config.ts`（schema=`db/schema`、out=`db/migrations`）、`db/migrations/` 目录约定、`bun run db:migrate` 走 `MIGRATION_DATABASE_URL`（依赖 T001） [VERIFY:`bun run db:migrate -- --help` 可用且脚本中不含 `drizzle-kit push`]
- [ ] T006 [P] [REQ:§7.0;§9.1;§4.3] 写零依赖静态守卫 `scripts/guard-static.mjs`：① 禁止 `drizzle-kit push`；② 禁止 `sql.raw` 拼接 family/person/purpose；③ 禁止仓库内出现口令字面量；④ 禁止 `packages/**` 之外的模块直接持有 family 作用域表访问；⑤ **accounts 窄访问**：除 DB schema/migration、test fixture、明确的 auth repository/module 外，family / member / consent / compliance 命令不得直接访问 `accounts` 表，任意 Family 响应序列化不得携带 `wechat_openid`；⑥ **范围守卫**（只扫实现目录与迁移，不扫 Docs 文本）：禁止创建 `apps/miniprogram`、`apps/operations`、`packages/{scenes,ai,rag,memory,notifications}`、Case schema/module、`case_participants`、multi-admin / family role enum、multi-guardian schema、跨家庭身份 discovery / link / share API、通用 Assertion / Observation 平台（依赖 T001） [VERIFY:`bun run guard:static` 在干净仓库退出 0；对上述每类违规样例各注入一次均退出 1]
- [ ] T007 [P] [REQ:§4.3;plan:Technical-Baseline] 环境变量契约：`packages/contracts/src/env.ts`（zod 校验 `DATABASE_URL`、`MIGRATION_DATABASE_URL`、`SESSION_SECRET`、`EVIDENCE_HASH_PEPPER`、`WECHAT_APP_ID`、`WECHAT_APP_SECRET`）+ 仓库根 `.env.example`（只含变量名与说明，不含任何值）（依赖 T003） [VERIFY:`bun run vitest run tests/domain/env.test.ts` 通过：缺失变量报错、`.env.example` 无口令字面量]
- [ ] T008 [REQ:§40;plan:Technical-Baseline] 建立 CI `.github/workflows/ci.yml` 的四个可运行 job：`static`（guard + typecheck）、`unit`、`db-migrate`（PG18 service）、`integration`，全部 Node 26.13.0；`contract` job 由 T030 在 `openapi:check` 真实就绪后加入，**不得 placeholder / 假成功**（依赖 T001–T007） [VERIFY:CI 首次运行出现且通过 `static`；`contract` job 此阶段不存在而非空跑]
---

## Phase 2 — Database Roles + Migration Foundation

目标：migrator / app 双角色物理分离、口令只经环境注入、reviewed migration、空库可重复建立。**不得**读取或记录真实口令。

- [ ] T009 [REQ:§4.3;§9.1;plan:D-5.3] 建 `docker-compose.stage-a.yml`（PostgreSQL 18 + api）与 `db/init/01-roles.sql`：以超级用户创建 `xiaoshuyin_migrator`（owner）与 `xiaoshuyin_app`（NOBYPASSRLS），口令从 `POSTGRES_MIGRATOR_PASSWORD` / `POSTGRES_APP_PASSWORD` 环境注入，SQL 中不出现任何口令值（依赖 T001） [VERIFY:`docker compose -f docker-compose.stage-a.yml up -d postgres` 后 `psql` 查询到两角色且 `rolbypassrls=false`]
- [ ] T010 [REQ:§9.1;FR-012] 迁移执行入口 `scripts/db-migrate.mjs`：以 migrator 连接、按文件名顺序应用 `db/migrations/*.sql`、记录 `schema_migrations`，并在结束时校验 app 角色无 DDL 权限（依赖 T009） [VERIFY:`bun run db:migrate` 成功；app 角色执行 `CREATE TABLE` 被拒（权限错误输出被断言）]
- [ ] T011 [REQ:§7.0;plan:Rollback] **test-first 红灯**：写失败契约测试 `tests/db/migration-repro.test.ts`，定义最终期望——完整 migration 可从空 PostgreSQL 18 建立、第二次 apply 为 no-op、前后对象集合一致、最终集合含 8 enum / 10 tables / RLS 函数 / 9 policy / consent 触发器（依赖 T010） [VERIFY:测试文件成功建立；`bun run vitest run tests/db/migration-repro.test.ts` 运行并**按预期失败（RED）**，失败原因是业务 schema 尚未完成；保留失败输出；**不得把 RED 冒充 PASS**；转绿时点为 Phase 3 完成后，最终由 T067 复核]
- [ ] T012 [REQ:FR-012;§9.1] **test-first 红灯**：写失败契约测试 `tests/db/roles.test.ts`，定义最终要求——app role `NOBYPASSRLS`、业务表 owner = `xiaoshuyin_migrator`、app 对最终 10 张表只有最小 DML、无 `CREATE`/`TRUNCATE`、8 enum `USAGE` 正确（依赖 T010） [VERIFY:测试文件成功建立；`bun run vitest run tests/db/roles.test.ts` 运行并**按预期失败（RED）**，失败原因是表尚未建立；保留失败输出；**不得把 RED 冒充 PASS**；转绿时点为 T028（GRANT）之后，最终由 T067 复核]
---

## Phase 3 — Core Schema（同一份 reviewed migration，串行）

目标：严格按 `plan.md` D-6.4 顺序落 10 张表、8 个 enum、9 个函数、1 个触发器、9 条 policy。**本 Phase 的任务全部串行**：它们改同一份 migration 与同一份 Drizzle schema，标 `[P]` 会制造冲突。

- [ ] T013 [REQ:§7.7A;§2.2;plan:D-6.4 step 02] 定义 8 个 enum（与 `data-model.md` §1 完全一致）：`age_band`、`provenance_source`（§2.2 八类）、`profile_attribute`（仅 `DISPLAY_NAME`）、`profile_value_status`、`consent_decision`、`consent_request_status`、`consent_purpose`、`account_status`（依赖 T010） [VERIFY:`bun run db:migrate` 通过；`tests/db/schema-structure.test.ts` 建立并断言 `pg_enum` 取值集合完全相等]
- [ ] T014 [REQ:§7.1;FR-016;plan:D-6.4 step 03] 建 `accounts`：`id uuidv7()`、`wechat_openid UNIQUE NOT NULL`、`session_epoch>=0`、`status`、`created_at`、`last_login_at`（依赖 T013） [VERIFY:migrate 后 `\d accounts` 输出与 `data-model.md` §2 一致；`tests/db/schema-structure.test.ts` 断言 accounts 列集合]
- [ ] T015 [REQ:§1.5;§7.1;FR-016;FR-017;plan:D-6.4 step 04] 建 `persons`：`account_id NULL UNIQUE` → accounts、`created_by_account_id NOT NULL`、无 `family_id`、无任何来源列（依赖 T014） [VERIFY:`tests/db/schema-structure.test.ts` 断言 `persons` 列集合不含 `family_id`/`source_kind`]
- [ ] T016 [REQ:§1.5;§9;FR-005;plan:D-6.4 step 05] 建 `families`：`created_by_person_id NOT NULL UNIQUE` → persons、`display_name` ≤60（依赖 T015） [VERIFY:`tests/db/constraints.test.ts` 断言同一 person 建第二个 family 被拒]
- [ ] T017 [REQ:§7.1;FR-017;plan:D-6.4 step 06] 建 `family_members`：`UNIQUE(family_id,person_id)`、`person_id` FK `DEFERRABLE INITIALLY DEFERRED`、**无**任何角色列（本步不建二级索引，见 T024）（依赖 T016）（依赖 T016） [VERIFY:`tests/db/constraints.test.ts` 断言重复 membership 被拒、`\d family_members` 无 role/creator/guardian 列]
- [ ] T018 [REQ:§7.7A;FR-008(b);plan:D-6.4 step 07] 建 `guardian_consent_requests`：`subject_person_id?`、`declared_age_band='UNDER_14'` CHECK、`notice_version/hash`、`status`、`expires_at>created_at`、`status=GRANTED ⇔ completed_at NOT NULL`（依赖 T017） [VERIFY:`tests/db/consent-structure.test.ts` 断言列集合恰等于契约清单且无姓名/生日/称呼列]
- [ ] T019 [REQ:§7.1;§7.7A;FR-010;plan:D-6.4 step 08] 建 `consent_records`：`onboarding_request_id` **可空**、`consent_request_binding`（GRANTED→非空 / REVOKED→为空）、`consent_granted_request_key`（partial unique，仅非空）、`consent_subject_version_key`（`bound_person_id,purpose,version`）、`consent_binding_consistency`、`consent_no_self_supersede`、`consent_subject_not_guardian`（依赖 T018）、`consent_granted_request_key`（partial unique，仅非空）、`consent_subject_version_key`（`bound_person_id,purpose,version`）、`consent_binding_consistency`、`consent_no_self_supersede`、`consent_subject_not_guardian`（依赖 T018） [VERIFY:`tests/db/consent-chain.test.ts` 建 v1/v2/v3 三行成功，违反任一 CHECK 的插入被拒]
- [ ] T020 [REQ:§7.7A;FR-007;FR-008;plan:D-6.4 step 09] 建 `person_compliance_profiles`：`minor_mode` 与 band 一致 CHECK、`pcp_guardian_not_self`、`pcp_under14_requires_consent`、`pcp_non_under14_no_consent`、`pcp_consent_version_pair`、`pcp_under14_guardian_source`（依赖 T019） [VERIFY:`tests/db/consent-structure.test.ts` 断言 UNDER_14 无 consent 的 profile 插入被拒、`verified_source=SELF_STATEMENT` 的 UNDER_14 profile 被拒]
- [ ] T021 [REQ:§2.2;FR-003;FR-004;plan:D-6.4 step 10] 建 `person_profile_values`：`attribute`、`value_text 1..120`、`source_kind`、`provided_by_person_id`、`recorded_by_account_id`、`observed_at?`、`status`、`supersedes_id`、`ppv_no_self_supersede`、`ppv_provider_required_for_person_sources`（本步不建二级索引，见 T024）（依赖 T020）（依赖 T020） [VERIFY:`tests/db/schema-structure.test.ts` 断言 `persons` 无来源列且 `profile_attribute` 仅 `DISPLAY_NAME`]
- [ ] T022 [REQ:§7.9;FR-010;plan:D-6.4 step 11] 建 `business_audit_events`：`family_id`、`actor_account_id`、`event_type` 封闭 CHECK 六类、`resource_type`、`resource_id`、`metadata`、`occurred_at`（本步不建二级索引，见 T024）（依赖 T021）（依赖 T016） [VERIFY:`tests/db/schema-structure.test.ts` 断言未定义 `event_type` 被拒]
- [ ] T023 [REQ:§8.5;FR-014;plan:D-6.4 step 12] 建 `idempotency_keys`：`actor_account_id`、`command_type` 六类 CHECK、`idempotency_key 8..128`、`request_hash 64hex`、`response_status/body`、`idempotency_scope_key UNIQUE`（依赖 T022） [VERIFY:`tests/db/constraints.test.ts` 断言同 (actor,command,key) 第二条插入被拒]
- [ ] T024 [REQ:plan:D-6.4 step 13] 其余索引与 CHECK 收口：`family_members_person_idx`、`gcr_guardian_idx`、`consent_guardian_idx`、`bae_family_time_idx`、`ppv_current_idx`，以及各表遗漏 CHECK 的补全（依赖 T023） [VERIFY:`pg_indexes` 查询输出与 `data-model.md` 的 5 个二级索引集合一致；逐表 CHECK 与 data-model 对照无遗漏]
- [ ] T025 [REQ:§9.1;plan:D-5.5/D-6.4 step 14] RLS 上下文函数：`app_family_id()`、`app_person_id()`、`app_account_id()`、`app_current_purpose()`，以及 `app.set_account_context()`、`app.set_identity_context()`、`app.set_family_context()`（校验 membership，失败 42501）、`app.create_family()`（依赖 T024）、`app.create_family()`（依赖 T017） [VERIFY:`tests/db/rls.test.ts` 断言非成员调用 `set_family_context` 抛 42501、参数缺失抛 42501]
- [ ] T026 [REQ:FR-012;§9.1;plan:D-5.4/D-6.4 step 15] 对 9 张表 `ENABLE`+`FORCE ROW LEVEL SECURITY` 并建 9 条 policy（families / family_members / gcr / consent / audit / persons / pcp / ppv / idempotency），逐表照抄 `plan.md` D-5.4 的 `USING`/`WITH CHECK`（依赖 T025），逐表照抄 `plan.md` D-5.4 的 `USING`/`WITH CHECK`（依赖 T025） [VERIFY:`tests/db/rls.test.ts` 断言 9 张表 `relrowsecurity=true` 且 `relforcerowsecurity=true`，`accounts` 不在其列]
- [ ] T027 [REQ:FR-010;V1-C39;plan:D-6.4 step 16] 建 `consent_records_guard_update()` 与 `BEFORE UPDATE` 触发器（**statement 必须在 RLS/policy 之后、GRANT 之前**）：业务列不可变；`(bound_person_id,bound_at)` 只允许 `(NULL,NULL)→(P,t)` 一次，半写 `CONSENT_BINDING_PARTIAL`、事后改任一项 `CONSENT_BINDING_IS_IMMUTABLE`（依赖 T026）：业务列不可变；`(bound_person_id,bound_at)` 只允许 `(NULL,NULL)→(P,t)` 一次，半写 `CONSENT_BINDING_PARTIAL`、事后改任一项 `CONSENT_BINDING_IS_IMMUTABLE`（依赖 T026） [VERIFY:`tests/db/consent-binding.test.ts` 覆盖 5 种变更：通过 / 改人失败 / 只改时间失败 / 清空失败 / 半写失败]
- [ ] T028 [REQ:§9.1;plan:D-5.3/D-6.4 step 17] `GRANT` 给 `xiaoshuyin_app`：10 张表 `SELECT/INSERT/UPDATE/DELETE`、8 个 enum `USAGE`，不授予 `CREATE`/`TRUNCATE`（依赖 T027） [VERIFY:`tests/db/roles.test.ts` 中 owner / GRANT / enum USAGE 断言转绿（T012 的红灯在此转绿，完整复核在 T067）]
---

## Phase 4 — Contracts & Pure Logic（可并行，Batch D）

目标：Zod 契约、OpenAPI 生成、纯规则（不含 I/O）。本 Phase 的 `[P]` 任务分属不同包，互不改同一文件。

- [ ] T029 [P] [REQ:§27A;§28.1;§28.2] 在 `packages/contracts/src/` 定义全部请求/响应/错误 Zod schema（13 个 operation 的 payload、`Error{code,message,details?}`、`ProvenanceValueInput`、`AgeBand`、`WritableSource`、`ProfileAttribute`），作为唯一事实源（依赖 T003） [VERIFY:`bun run typecheck` 通过；`tests/domain/contracts.test.ts` 断言 `ProfileAttribute` 仅 `DISPLAY_NAME`、`WritableSource` 仅四类]
- [ ] T030 [REQ:§27A] 搭建 OpenAPI 生成链（**不在此验证 13 operations**）：`@fastify/swagger` 输出 OpenAPI、`openapi-typescript` 生成 `packages/generated/openapi.d.ts`、新增 `bun run openapi:generate` 与 `bun run openapi:check`（比对无漂移机制）；生成产物可重复生成、无非确定性漂移；并在 `openapi:check` 真实就绪后把 `contract` job 加入 `.github/workflows/ci.yml`（依赖 T029、T008） [VERIFY:`bun run openapi:generate` 与 `bun run openapi:check` 可执行且二次生成无 diff，当前已注册路由（含 `/healthz`）能生成；CI 出现真实 `contract` job；**13 operations 由 T066 验证**]
- [ ] T031 [P] [REQ:FR-009;§7.7A] 先写失败单测 `tests/domain/age-band.test.ts`：`PROFILE_MISSING`→BLOCK、`UNKNOWN`→BLOCK、`ADULT`→ALLOW、`MINOR_14_17`→ALLOW+minorMode、`UNDER_14` 有/无有效 consent 的放行与阻断、`NOT_COLLECTED` 非法（依赖 T004） [VERIFY:测试先红，记录失败输出作为证据]
- [ ] T032 [REQ:FR-007;FR-009;plan:D-3.6] 实现 `packages/compliance/src/age-gate.ts`：`assertMinorProcessingAllowed(personId)` 按 D-3.6 顺序短路，纯读、无副作用（依赖 T031） [VERIFY:`bun run vitest run tests/domain/age-band.test.ts` 转绿]
- [ ] T033 [P] [REQ:FR-003;FR-004;plan:D-4] 先写失败单测 `tests/domain/provenance.test.ts`：同源替换→`SUPERSEDED`+`supersedes_id`、异源并存、`observed_at` 缺省 NULL、来源可接受性（creator 仅 SELF_STATEMENT；UNDER_14 仅 guardian-origin）（依赖 T004） [VERIFY:测试先红，记录失败输出]
- [ ] T034 [REQ:FR-003;FR-004;plan:D-4] 实现 `packages/domain/src/provenance.ts`：追加/替换纯函数 + 路径级来源校验（返回 `AGE_BAND_SOURCE_NOT_ALLOWED` 判定），不引入新字段（依赖 T033） [VERIFY:`bun run vitest run tests/domain/provenance.test.ts` 转绿]
- [ ] T035 [P] [REQ:FR-006;FR-011;plan:D-5.2] 先写失败单测 `tests/domain/authorization.test.ts`：动作/purpose 封闭、未知输入 DENY、`case!==null`→`UNSUPPORTED_DIMENSION`、manager 纯函数、guardian 与 membership 互不替代（依赖 T004） [VERIFY:测试先红，记录失败输出]
- [ ] T036 [REQ:FR-006;FR-011;plan:D-5.2] 实现 `packages/authorization/src/authorize.ts`：闭集动作表 + fail-closed + `basis.manager` 计算，异常兜底 `AUTHORIZATION_ERROR`（依赖 T035） [VERIFY:`bun run vitest run tests/domain/authorization.test.ts` 转绿]
- [ ] T037 [P] [REQ:FR-008(b);§28.2] 实现 `packages/compliance/src/notices.ts`：版本化告知正文 + `notice_version` + `notice_hash`（sha256），并提供 `GET /compliance/notices` 所需目录（依赖 T003） [VERIFY:`tests/domain/notices.test.ts` 断言同一版本 hash 稳定、未知版本报错]
- [ ] T038 [REQ:plan:D-6.2;contracts:§3] 实现 `apps/server/api/src/plugins/error-handler.ts` 的 `toHttpError()` 单一映射（401/403/404/409/422），拒绝体永不含目标对象字段（依赖 T029） [VERIFY:`tests/domain/error-map.test.ts` 断言每个 code→status 唯一映射]
- [ ] T039 [P] [REQ:U01;plan:D-1] 实现 `apps/server/api/src/auth/session-token.ts`：`node:crypto` HMAC-SHA256 自签/验签，payload 含 `accountId`/`epoch`/`exp`，与 `accounts.session_epoch` 对齐（依赖 T007） [VERIFY:`tests/domain/session-token.test.ts` 断言篡改、过期、epoch 失效均被拒]
- [ ] T040 [P] [REQ:§8.5;FR-014] 实现 `packages/domain/src/idempotency.ts`：`canonical_json` + `sha256` + 三态决策（replay / 409 / execute），纯函数（依赖 T003） [VERIFY:`tests/domain/idempotency-hash.test.ts` 断言键序无关、同 payload 同 hash、异 payload 不同 hash]

---

## Phase 5 — US1：家长登录并建立自己的家庭

**Story goal**: 登录即得 Account + Person；建家庭复用该 Person，写入 ADULT profile 与管理主体关系。
**Independent test**: 仅用登录 + 建家庭两个动作即可断言身份可取回、家庭存在、`isManager=true`、Person 数量不变。

- [ ] T041 [REQ:FR-013;plan:D-5.5] 实现事务封装 `apps/server/api/src/db/tx.ts`：`withAccountTransaction` / `withIdentityTransaction` / `withRlsTransaction` / `withFamilyCreationTransaction`，全部经参数化 `set_config(..., true)`，禁止事务外设上下文（依赖 T025） [VERIFY:`tests/integration/rls-transaction.test.ts` 断言事务外设上下文后查询 0 行、连接池复用不串上下文]
- [ ] T042 [US1] [REQ:U01;FR-002;plan:D-2] 先写失败集成测试 `tests/integration/auth.test.ts`：首次登录同事务建 Account + Person（`account_id` 非空、`profile` 为空）、重复登录不新增、logout 后旧 token 401（依赖 T041、T039） [VERIFY:测试先红，记录失败输出]
- [ ] T043 [US1] [REQ:U01;FR-002;plan:D-2] 实现登录/登出于 `apps/server/api/src/routes/auth.ts` + `apps/server/api/src/auth/wechat-provider.ts`：`POST /api/v1/auth/wechat`（code→openid→Account→Person）、`POST /api/v1/auth/logout`（`session_epoch+1`），`WechatAuthProvider` 端口 + 确定性 fake（依赖 T042） [VERIFY:`bun run vitest run tests/integration/auth.test.ts` 转绿]
- [ ] T044 [US1] [REQ:U01;FR-001;§28.1] 在 `apps/server/api/src/routes/me.ts` 实现 `GET /api/v1/me`：identity 上下文返回 account + 自身 person（含 profile/values，无则不返回），响应不含 `wechat_openid` 与他人字段（依赖 T043） [VERIFY:`tests/integration/me.test.ts` 断言 200 结构与敏感字段缺席]
- [ ] T045 [US1] [REQ:U03;FR-005;plan:D-2] 先写失败集成测试 `tests/integration/families.test.ts`：登录后无家庭时 `GET /families/current`→404 `CURRENT_FAMILY_NOT_FOUND`；建家庭后 201 且 `isManager=true`、Person 数量不变、ADULT profile 写入；`ageBand≠ADULT`→403 无写入；`ageBandSource≠SELF_STATEMENT`→422 无写入（依赖 T042） [VERIFY:测试先红，记录失败输出]
- [ ] T046 [US1] [REQ:FR-005;plan:D-2;D-6.2] 在 `apps/server/api/src/routes/families.ts` + `src/commands/family-create.ts` 实现建家庭与当前家庭：`POST /api/v1/families`（现有 Person → Family → membership → ADULT profile → values → audit，幂等）、`GET /api/v1/families/current`（404 空态 vs 403 非成员）（依赖 T045） [VERIFY:`bun run vitest run tests/integration/families.test.ts` 转绿]

---

## Phase 6 — US2：记录无账号成员与逐值来源

**Story goal**: 管理主体可新增无 Account 成员，每条资料值各自带来源，未知保持未知。
**Independent test**: 新建成员后 `accountBound=false`、逐值来源可追溯、异源并存、`persons` 无来源列。

- [ ] T047 [US2] [REQ:U03;FR-003;FR-004] 先写失败集成测试 `tests/integration/members.test.ts`：新增成员（`ageBand=MINOR_14_17`）成功且 `account_id IS NULL`、只写白名单内来源、异源并存不被覆盖、同源替换写 `supersedes_id`、`observedAt` 缺省为 NULL（依赖 T046） [VERIFY:测试先红，记录失败输出]
- [ ] T048 [US2] [REQ:FR-003;plan:D-4] 在 `apps/server/api/src/routes/members.ts` + `src/commands/member-create.ts` 实现 `POST /api/v1/families/:id/members`（非 UNDER_14 路径）：membership → Person → profile → values → audit，逐值写来源并校验 provider 为本家庭成员（依赖 T047、T034） [VERIFY:`bun run vitest run tests/integration/members.test.ts` 中转绿（成员创建相关用例）]
- [ ] T049 [US2] [REQ:FR-003;plan:D-4] 先写失败集成测试 `tests/integration/members.test.ts`：`PATCH /api/v1/families/:id/members/:personId` 同源替换 vs 异源并存、跨家庭/非 manager 被拒（依赖 T048） [VERIFY:测试先红，记录失败输出]
- [ ] T050 [US2] [REQ:FR-003;FR-005] 在 `apps/server/api/src/routes/members.ts` + `src/commands/member-update.ts` 实现 `PATCH /api/v1/families/:id/members/:personId`：仅 `DISPLAY_NAME`，manager-only，追加式写入（依赖 T049） [VERIFY:`bun run vitest run tests/integration/members.test.ts` 全绿]
- [ ] T051 [US2] [REQ:FR-003;FR-004;plan:D-4] 在 `apps/server/api/src/commands/family-create.ts` 与 `src/commands/member-create.ts` 中强制执行来源规则（覆盖 `POST /families` 与非 UNDER_14 成员创建）：creator 仅 `SELF_STATEMENT`、provider 固定为 actor；成员按真实提供方式取白名单来源且 provider 须为本家庭成员；违反 → 422 `AGE_BAND_SOURCE_NOT_ALLOWED`（UNDER_14 分支由 T057 强制）（依赖 T046、T048） [VERIFY:`tests/integration/age-band-source.test.ts` 断言 creator 与普通成员的非法来源组合均 422 且无写入]

---

## Phase 7 — US3：UNDER_14 consent-first

**Story goal**: 同意先成立、正式 Person 后创建、绑定只能发生在 Person 之后；撤回产生新版本并立即阻断。
**Independent test**: 无同意时无 child Person/profile；同意后建档成功；撤回后 gate BLOCK；重新同意恢复。

- [ ] T052 [US3] [REQ:V1-C39;FR-008(b)] 先写失败集成测试 `tests/integration/consent-request.test.ts`：无家庭→404、创建 request 201 且 `subject_person_id IS NULL`、响应与库中无孩子姓名/生日/称呼、过期不可用（依赖 T046） [VERIFY:测试先红，记录失败输出]
- [ ] T053 [US3] [REQ:FR-008(b);plan:D-3.2] 在 `apps/server/api/src/routes/compliance.ts` + `src/commands/consent-request.ts` 实现 `POST /api/v1/compliance/guardian-consents/requests`：写最小状态（guardian、declared band、notice 版本+hash、24h 过期），不写任何孩子资料（依赖 T052、T037） [VERIFY:`bun run vitest run tests/integration/consent-request.test.ts` 转绿]
- [ ] T054 [US3] [REQ:V1-C39;plan:D-3.3] 先写失败集成测试 `tests/integration/consent-grant.test.ts`：`accepted=true` 才成立、notice 不匹配→403、过期→403、重复 grant→409、成功写 GRANTED v1 且 `bound_person_id IS NULL`（依赖 T053） [VERIFY:测试先红，记录失败输出]
- [ ] T055 [US3] [REQ:FR-008;plan:D-3.3] 在 `apps/server/api/src/routes/compliance.ts` + `src/commands/consent-grant.ts` 实现 `POST /api/v1/compliance/guardian-consents`：单条写入路径，落不可变 GRANTED 证据（`guardian_account_id`、notice、policy、evidence 哈希）（依赖 T054） [VERIFY:`bun run vitest run tests/integration/consent-grant.test.ts` 转绿]
- [ ] T056 [US3] [REQ:FR-008(a);§10] 先写失败集成测试 `tests/integration/consent-first.test.ts`：无 `guardianConsentId` 建 UNDER_14 → 403 `GUARDIAN_CONSENT_REQUIRED` 且 `persons`/`profiles` 无该未成年人；`ageBandSource` 仅 `GUARDIAN_RELAY`/`GUARDIAN_OBSERVATION`（其余→422 且无写入）；同意成立后按固定顺序建档成功（依赖 T055） [VERIFY:测试先红，记录失败输出]
- [ ] T057 [US3] [REQ:FR-008(c);plan:D-3.4] 在 `apps/server/api/src/commands/member-create-consent-first.ts` 实现 consent-first 建档分支：锁 consent → 校验 `ageBandSource` 仅 guardian-origin 且 provider 固定为 `consent.guardian_person_id`（否则 422 `AGE_BAND_SOURCE_NOT_ALLOWED`）→ 预生成 personId → 插 membership（deferrable）→ 插 Person → 一次性绑定 → 插 UNDER_14 profile → values → audit；已绑定→409（依赖 T056） [VERIFY:`bun run vitest run tests/integration/consent-first.test.ts` 转绿，且断言 `decided_at < person.created_at`]
- [ ] T058 [US3] [REQ:FR-010;plan:D-3.7] 先写失败集成测试 `tests/integration/consent-revoke.test.ts`：撤回写 REVOKED v2（`onboarding_request_id IS NULL`、`supersedes_id=v1`）、profile 指针前移、gate 立即 BLOCK、audit 行存在；重新同意 v3 恢复（依赖 T057） [VERIFY:测试先红，记录失败输出]
- [ ] T059 [US3] [REQ:FR-010] 在 `apps/server/api/src/routes/consents.ts` + `src/commands/consent-revoke.ts` 实现 `POST /api/v1/consents/{id}/revoke`（唯一撤回端点）：锁 profile → 追加版本 → 指针前移 → audit（依赖 T058） [VERIFY:`bun run vitest run tests/integration/consent-revoke.test.ts` 转绿]
- [ ] T060 [US3] [REQ:§28.2;plan:D-6.1] 在 `apps/server/api/src/routes/consents.ts` 与 `src/routes/compliance.ts` 实现读端点：`GET /api/v1/consents`（无家庭→200 空列表）、`GET /api/v1/compliance/profile`、`GET /api/v1/compliance/notices`（依赖 T059、T038） [VERIFY:`tests/integration/consent-read.test.ts` 断言三端点的正常/空态/无权分支]

---

## Phase 8 — US4：跨家庭隔离与两维授权

**Story goal**: 任何跨家庭读取在应用层与数据库层都失败；membership 与 guardian 互不替代。
**Independent test**: 家庭 A 身份读 B 被拒且零字段；绕过应用以 app 角色查询返回 0 行。

- [ ] T061 [US4] [REQ:FR-011;V1-C21] 集成测试 `tests/integration/authorization.test.ts`：跨家庭读/写 403 且响应无目标字段、伪造 `family_id` 不获访问、非 manager 成员新增/修改被拒（依赖 T060） [VERIFY:`bun run vitest run tests/integration/authorization.test.ts` 通过]
- [ ] T062 [US4] [REQ:FR-006;plan:D-5.1] 具名维度测试 `tests/integration/authorization-dimensions.test.ts`：guardian-but-not-member 无家庭访问；member-but-not-guardian 无 consent/guardian 权限（`NOT_GUARDIAN`）（依赖 T061） [VERIFY:`bun run vitest run tests/integration/authorization-dimensions.test.ts` 通过，两条用例各打印判定依据]
- [ ] T063 [US4] [REQ:FR-012;§9.1] RLS 绕过测试 `tests/db/rls.test.ts`：三个 GUC 全未设→0 行；仅 identity 上下文只见本人；family A 上下文查 B→0 行；`accounts` 无 RLS 但仅窄仓储访问（依赖 T028） [VERIFY:`bun run vitest run tests/db/rls.test.ts` 通过；并归档 `bun run guard:static` 输出作为 accounts 窄访问的运行证据]
- [ ] T064 [US4] [REQ:FR-014;plan:D-5.4] 幂等隔离测试 `tests/db/idempotency-rls.test.ts`：表 `relrowsecurity/relforcerowsecurity=true`、账号 A 只见 A 的 key、按 B 的 key 回放 0 行且无 `response_body`、无 identity 上下文写入被拒（依赖 T023、T026） [VERIFY:`bun run vitest run tests/db/idempotency-rls.test.ts` 通过]

---

## Phase 9 — Idempotency 行为、回归与收敛

- [ ] T065 [REQ:FR-014;SC-005] 幂等行为测试 `tests/integration/idempotency.test.ts`（参数化覆盖六类关键命令：`FAMILY_CREATE`、`MEMBER_CREATE`、`MEMBER_UPDATE`、`GUARDIAN_CONSENT_REQUEST`、`GUARDIAN_CONSENT_GRANT`、`GUARDIAN_CONSENT_REVOKE`，不复制六套框架）：每类各验证 same key + same payload → replay 原响应、same key + different payload → 409 `IDEMPOTENCY_PAYLOAD_MISMATCH`、不产生重复业务对象；另覆盖并发 20 次同 key 记录数不变、GET 不使用幂等键（跨账号隔离由 T064 DB test 承担）（依赖 T046、T050、T053、T055、T059） [VERIFY:`bun run vitest run tests/integration/idempotency.test.ts` 通过，输出按六类命令分组，每类 ≥3 条断言]
- [ ] T066 [REQ:§27A;§40] 契约测试 `tests/integration/openapi.test.ts`：OpenAPI 可生成、13 个 operation 齐备、generated client 无未预期 diff（依赖 T030、T060） [VERIFY:`bun run openapi:check` 通过]
- [ ] T067 [REQ:§9.1;plan:D-6.4;FR-016;FR-017] 迁移与 RLS 证据脚本 `scripts/db-evidence.mjs` + 最终结构验证：输出 `pg_class.relrowsecurity/relforcerowsecurity`、`rolbypassrls`、owner、`uuidv7()` 默认值、空库重建结果；并完成原 schema-structure 收口（`persons.account_id` UNIQUE、`persons` 无 `family_id`、`family_members` 无角色列、`profile_attribute={DISPLAY_NAME}`、不存在 `RELATION_DESCRIPTOR`、不存在 `assertions`/`observations` 表、9 张 `id` 默认 `uuidv7()`）；确认 T011/T012 的红灯测试已转绿（依赖 T011、T012、T063） [VERIFY:`bun run db:evidence` 输出与 quickstart §1 期望表逐项一致；`tests/db/migration-repro.test.ts` 与 `tests/db/roles.test.ts` 全绿并归档输出]
- [ ] T068 [REQ:plan:Verification-Plan] 全量回归：用 `scripts/verify-all.mjs` 按 plan §Verification Plan 的 26 条命令逐条运行，输出归档到 `tests/evidence/verify-all.log`（依赖 T061–T067） [VERIFY:`bun run test -- --run` 全绿；`bun run guard:static` 输出归档（含 accounts 窄访问与范围守卫）；逐条命令输出归档为证据]
- [ ] T069 [REQ:FR-001—FR-017;SC-001—SC-008] 覆盖审计 `scripts/coverage-audit.mjs`：把 17 条 FR / 8 条 SC 映射到测试文件，缺任一条即失败（依赖 T068） [VERIFY:`bun run coverage:audit` 输出 17/17 与 8/8，无 missing]
- [ ] T070 [REQ:quickstart:§2] 手工路径验证：按 `quickstart.md` §2 跑登录→建家庭→成员→consent→撤回→跨家庭六段，真实响应记录到 `tests/evidence/quickstart.md`（依赖 T068） [VERIFY:六段状态码与响应字段与 quickstart 期望一致，记录归档]
- [ ] T071 [REQ:§40;plan:Verification-Plan] 在 `.github/workflows/ci.yml` 上使 `static`、`unit`、`db-migrate`、`integration`、`contract` 五个 job 在 feature branch 全部真实通过（`contract` job 必须真实存在，**不得 placeholder / 假成功**）（依赖 T008、T030、T068） [VERIFY:GitHub Actions run 五 job 全 success，链接归档]
- [ ] T072 [REQ:constitution:VI;§41] 收敛检查：重读 `spec.md` FR/SC 与 `contracts/**`，逐条对照实现与测试，记录到 `tests/evidence/converge.md`；并运行治理 `node .specify/scripts/validate-governance.mjs`、`node .specify/scripts/tests/run-governance-tests.mjs` 与 `git diff --name-only origin/main...HEAD`，记录受保护 source-of-truth 是否有预期外改动（本轮 Analyze closeout 对 `spec.md` 的 1 行修正属预期内，须在证据中可解释）（依赖 T069–T071） [VERIFY:converge 记录含 governance PASS、self-test 10/10、受保护文件 diff 说明，且 no remaining gap 或列出缺口转回上游]

---

## Dependencies & Execution Order

下表是**逐任务依赖边**（`T### ← 依赖`），与每个任务正文的 `（依赖 T###）` 逐条一致，用于校验无前向依赖、无环、无不可能前置。

| Phase | 边 |
|---|---|
| 1 | T001 ← ∅；T002 ← T001；T003 ← T001；T004 ← T001；T005 ← T001；T006 ← T001；T007 ← T003；T008 ← T001–T007 |
| 2 | T009 ← T001；T010 ← T009；T011 ← T010；T012 ← T010 |
| 3 | T013 ← T010；T014 ← T013；T015 ← T014；T016 ← T015；T017 ← T016；T018 ← T017；T019 ← T018；T020 ← T019；T021 ← T020；T022 ← T021；T023 ← T022；T024 ← T023；T025 ← T024；T026 ← T025；T027 ← T026；T028 ← T027 |
| 4 | T029 ← T003；T030 ← T029、T008；T031 ← T004；T032 ← T031；T033 ← T004；T034 ← T033；T035 ← T004；T036 ← T035；T037 ← T003；T038 ← T029；T039 ← T007；T040 ← T003 |
| 5 | T041 ← T025；T042 ← T041、T039；T043 ← T042；T044 ← T043；T045 ← T042；T046 ← T045 |
| 6 | T047 ← T046；T048 ← T047、T034；T049 ← T048；T050 ← T049；T051 ← T046、T048 |
| 7 | T052 ← T046；T053 ← T052、T037；T054 ← T053；T055 ← T054；T056 ← T055；T057 ← T056；T058 ← T057；T059 ← T058；T060 ← T059、T038 |
| 8 | T061 ← T060；T062 ← T061；T063 ← T028；T064 ← T023、T026 |
| 9 | T065 ← T046、T050、T053、T055、T059；T066 ← T030、T060；T067 ← T011、T012、T063；T068 ← T061–T067；T069 ← T068；T070 ← T068；T071 ← T008、T030、T068；T072 ← T069–T071 |

**一致性结论**：72 条边全部 `依赖 id < 任务 id`（无前向依赖）；边集构成 DAG（无环）；Phase 3 按 statement 顺序链式依赖（T014 依赖 T013，依此类推到 T028 依赖 T027），保证每个任务的可达闭包包含它引用的全部 DB 对象；触发器（T027）位于 RLS/policy（T026）之后、GRANT（T028）之前；T051 只依赖 T046 与 T048，**不依赖 T064**；UNDER_14 guardian-origin 来源规则由 **T057** 承担。

关键约束：

- Phase 3 全串行由**同一份 reviewed migration** 决定，statement 顺序严格等于 `plan.md` D-6.4 的 02→17。
- 同一路由 / 同一测试文件 / 同一命令文件的任务不并行（US1–US3 各自链内串行）。
- `[P]` 含义：**前置依赖全部完成后**，与当前同批次其它 `[P]` 任务（不同文件、无互依赖）可并行；`[P]` 不表示可以忽略自身依赖。本轮 14 个 `[P]`：T001–T007、T029、T031、T033、T035、T037、T039、T040。
- 未标 `[P]` 的任务不作并行声明：即便文件不冲突，本表也按串行调度；Implement 若要并发它们，须先补 `[P]` 并复核依赖。
- T011 / T012 是 test-first 红灯任务：完成标准是「测试文件存在且按预期 RED」，转绿由 T028（roles）与 T067（repro + 最终复核）完成。

## Parallelization（供 Implement 使用）

| 批次 | 任务 | 前置 |
|---|---|---|
| A0 | T001 | 无 |
| A1 | T002 ∥ T003 ∥ T004 ∥ T005 ∥ T006（均 `[P]`） | T001 |
| A2 | T007（`[P]`） | T003 |
| A3 | T008 | T001–T007 |
| B0 | T009（串行；未标 `[P]`，文件与 A 批不冲突） | T001 |
| B1 | T010 | T009 |
| B2 | T011、T012（串行调度，test-first 红灯） | T010 |
| C | T013 → T028（**全串行**，单 migration，statement 顺序 = D-6.4） | T010 |
| D0 | T029 ∥ T031 ∥ T033 ∥ T035 ∥ T037 ∥ T039 ∥ T040（均 `[P]`） | C 完成 |
| D1 | T030（← T029、T008）→ T032 → T034 → T036 → T038 | D0 |
| E0 | T041 → T042 → T043 → T044 | T025、T039 |
| E1 | T045 → T046 | T042 |
| E2（US2 链） | T047 → T048 → T049 → T050；T051（← T046、T048） | T046、T034 |
| E3（US3 链） | T052 → T053 → T054 → T055 → T056 → T057 → T058 → T059 → T060 | T046、T037、T038 |
| F0 | T063（← T028）、T064（← T023、T026）（串行；未标 `[P]`） | C 完成 |
| F1 | T061 → T062 | T060 |
| F2 | T065（← T046/T050/T053/T055/T059）、T066（← T030/T060） | E2/E3 相关端点 |
| G | T067（← T011、T012、T063）→ T068 → T069、T070 → T071（← T008、T030、T068）→ T072 | F 全部 |

- **US2 与 US3**：共同前置（T046、D 批）满足后，两条链的文件不冲突，允许并发推进；但两链内各任务互为前置，必须按链内串行。因链内任务未标 `[P]`，本表不作并行声明。
- **T051 与 T064**：两者无依赖关系（T051 只依赖 T046、T048；T064 只依赖 T023、T026），分属 E2 与 F0，可独立调度。
- **T011 / T012**：红灯任务，不与 Phase 3 并行；其转绿在 T028 / T067。

## Coverage

**FR → Tasks**

| FR | Tasks |
|---|---|
| FR-001 | T044、T067 |
| FR-002 | T042、T043 |
| FR-003 | T021、T033、T034、T047、T048、T050 |
| FR-004 | T021、T033、T051、T057 |
| FR-005 | T016、T045、T046 |
| FR-006 | T035、T036、T062 |
| FR-007 | T020、T032、T068 |
| FR-008 | T018–T020、T027、T052–T059 |
| FR-009 | T031、T032 |
| FR-010 | T019、T027、T058、T059 |
| FR-011 | T036、T061 |
| FR-012 | T012、T026、T063 |
| FR-013 | T041、T063 |
| FR-014 | T023、T040、T064、T065 |
| FR-015 | T005、T010、T067 |
| FR-016 | T014、T015、T067 |
| FR-017 | T017、T063、T067 |

**SC → Tasks**

| SC | Tasks |
|---|---|
| SC-001 | T045、T046、T047、T048、T070 |
| SC-002 | T061、T063 |
| SC-003 | T052–T059、T068 |
| SC-004 | T021、T031、T032 |
| SC-005 | T065 |
| SC-006 | T017、T063 |
| SC-007 | T015、T063、T067 |
| SC-008 | T021、T033、T034、T047、T050、T067 |

**Contracts → Tasks**

| 契约 | Tasks |
|---|---|
| `identity-family-api.openapi.yaml`（13 ops） | T029、T030、T043–T060、T066 |
| `authorization-and-rls.md` §2（动作/DenyReason） | T035、T036、T038 |
| 同上 §4（RLS + 上下文 + 空态/无权） | T025、T026、T028、T041、T046、T053、T060、T063 |
| `consent-onboarding.md`（状态机/绑定/撤回/门禁） | T018–T020、T027、T052–T059 |
| `provenance.md`（逐值/替换/路径来源） | T021、T033、T034、T051 |

**Checklist（61 条）→ 阶段映射**

| 类别 | 条目 | 主要任务 |
|---|---|---|
| Scope & Boundaries | CHK001–CHK005 | T006（范围守卫）、T071、T072 |
| Identity & Cardinality | CHK006–CHK011 | T014–T017、T042–T046 |
| UNDER_14 | CHK012–CHK023 | T018–T020、T027、T031–T032、T052–T060 |
| Provenance | CHK024–CHK029 | T021、T033、T034、T047–T051 |
| Authorization & RLS | CHK030–CHK039 | T025、T026、T028、T035、T036、T041、T061–T063 |
| API Surface | CHK040–CHK045 | T029、T030、T043–T060、T066 |
| Idempotency | CHK046–CHK048 | T023、T040、T064、T065 |
| Migration & Database | CHK049–CHK053 | T005、T009–T013、T024、T067 |
| Verification & Traceability | CHK054–CHK058 | T068–T072 |
| Review Decision | CHK059–CHK061 | T072（converge + 治理证据） |

## Notes / Deviations

- **Lint**：`Docs/V1技术设计.md` §2 / §4.1 的冻结依赖里没有 ESLint / Biome / Prettier。为不引入未批准依赖，`static` job 由 `tsc --noEmit` + `scripts/guard-static.mjs`（零依赖）承担；若 Owner 要求第三方 linter，须先改上游文档，不在本 Slice 私自添加。
- **测试数据库**：使用 §4 Stage A 已批准的 Docker Compose PostgreSQL 18，不引入 testcontainers。
- **微信登录**：使用确定性 fake provider；真实 `code2session` 属 §40 Platform 门槛，本 Slice 标 NOT VERIFIED。
- **不创建**：`apps/miniprogram`、`apps/operations`、`packages/scenes`、`packages/ai`、`packages/rag`、`packages/memory`、`packages/notifications`，也不建空壳。

## Completion Contract

一个任务只有满足下列全部条件才算完成：

1. 其声明的实现/测试产物存在；
2. `[VERIFY:...]` 指定的命令**实际执行**并保留输出；
3. 观察到的结果与 Expected 一致；
4. 没有为了变绿而削弱测试、fixture 或需求；
5. 偏离已记录，且若改变意图必须先回到上游文档。

Feature 未完成，直到 `/analyze` 通过、CI 全绿、且 converge 报告无剩余缺口。
