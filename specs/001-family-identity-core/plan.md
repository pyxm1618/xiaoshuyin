# Implementation Plan: 家庭身份地基（Account / Person / Family / 成员关系 / UNDER_14 consent-first）

**Feature**: `specs/001-family-identity-core/spec.md`
**Date**: 2026-11-04
**V1 Phase**: Phase 1 — Common Core 地基（`Docs/V1技术设计.md` §38）
**Plan base (feature head)**: `5c361c3050439add7e0493bf9bf28de6a16116f4`
**Docs baseline**: `Docs/V1产品需求.md` v3.3、`Docs/V1技术设计.md` v3.8

> 本文件是 `Docs/V1技术设计.md` 的实现投影，不是第二次架构设计。所有技术选择均限定在已冻结的 V1 技术栈与已批准的表/API 面之内；任何超出批准范围的项都在 “Open Review Items” 显式列出，不静默生效。

---

## Upstream Traceability

本 Plan 只实现下列已批准上游对象，不改变其语义。

| Plan 决策 | 上游 ID / 章节 |
|---|---|
| Account / Person / Family / family_members 分离建模 | V1-C20、`V1技术设计.md` §5 不变量 1、§7.1 |
| Account ↔ Person = 1:1、Person → Account = 0..1 | `V1产品需求.md` §1.5、`V1技术设计.md` §7.1、spec FR-016 |
| Person ↔ Family 多对多、仅经 `family_members`、唯一 (family, person) | `V1产品需求.md` §1.5、`V1技术设计.md` §7.1、spec FR-017 |
| 创建 Family 的 adult 为 V1 当前管理主体，不引入角色枚举/RBAC | `V1产品需求.md` §1.5、`V1技术设计.md` §7.1 / §9、spec FR-005 / FR-006 |
| guardian 关系由 `person_compliance_profiles.guardian_person_id` 单值表达 | `V1技术设计.md` §7.7A / §10、V1-C39、spec FR-006 / FR-007 |
| UNDER_14 consent-first（同意先于正式 child Person / profile） | `V1产品需求.md` v3.3 §19A.2 / V1-C39、`V1技术设计.md` v3.8 §7.7A / §10 / §5 不变量 27、spec FR-008 (a)–(d) |
| 同意撤回产生新 Consent version + 后续阻断 + audit | `V1技术设计.md` §29.5（最小子集）、V1-C39、spec FR-010 |
| age_band = ADULT / MINOR_14_17 / UNDER_14 / UNKNOWN，UNKNOWN 不按 ADULT | `V1技术设计.md` §7.7A、`V1产品需求.md` §19A.2 / V1-C03、spec FR-009 |
| per-value provenance（来源属于资料值，不属于 Person） | `V1产品需求.md` §2.2（8 类来源）、`V1技术设计.md` §5 不变量 4、spec FR-003 / FR-004 |
| 统一 `authorize()`、客户端 ID 仅作待验证参数、按当前目标 Family 判定 | `V1技术设计.md` §9、V1-C21、spec FR-011 |
| `withRlsTransaction`、ENABLE/FORCE RLS、migrator/app 双角色 | `V1技术设计.md` §9.1 / §7.0 / §4.3、spec FR-012 / FR-013 |
| 关键命令幂等（同 key 不同 payload → 409） | `V1技术设计.md` §8.5、`V1产品需求.md` V1-C28、spec FR-014 |
| `uuidv7()` 主键、仅 reviewed migration 变更 | `V1技术设计.md` §7.0、spec FR-015 |
| 身份与家庭 API 面 | `V1技术设计.md` §28.1（auth / me / families / members） |
| Consent / Compliance API 面 | `V1技术设计.md` §28.2（consents / guardian-consents / compliance profile / notices） |
| Zod / OpenAPI / generated client 单事实源 | `V1技术设计.md` §27A |
| 技术栈冻结 | `V1技术设计.md` §2 / §4.1 |
| 切片边界（无 Participant、无 Case、无 AI） | `V1技术设计.md` §7.1 / §7.2 / §10 / §28.8 / §38、spec Clarifications Q1 |

**未在本 Plan 中出现的上游对象**（`cases`、`case_participants`、`assertions`、`observations`、Digital Use、AI/RAG、`staff_assignments`、`data_requests`、Notification）保持 spec 的 Out of Scope，不被本 Plan 的 schema、API 或抽象“预留”。

---

## Summary

本 Slice 是仓库第一次落代码，交付 Phase 1 身份地基的**最小可验证纵切**：

1. 模块化单体骨架（`apps/server/api` + `packages/{contracts,domain,authorization,compliance}` + `db/{schema,migrations,rls}` + `tests/*`），技术栈严格等于 §2 / §4.1 冻结版本。
2. 10 张表（9 张业务表 + 幂等表）、8 个 PG enum、9 个函数（4 个上下文 getter + 4 个上下文入口 + 1 个触发器函数）、1 个触发器、9 条 policy（每表一条 `FOR ALL`）、migrator / app 双角色、除 `accounts` 外全部 ENABLE + FORCE RLS，以及 `withRlsTransaction`。
3. 13 个 HTTP 端点（§28.1 / §28.2 契约面 + 由 §7.7A 显式委托 Plan 决定的 consent onboarding 端点；`POST /consents` 明确不实现，见 D-6.1）。
4. 单一 `authorize()`，判定输入是 §9 的形状，本 Slice 只实现两个互相独立的维度：**Family membership** 与 **Compliance guardian relationship**；未实现维度一律 fail-closed。
5. UNDER_14 consent-first 是**结构约束**而非流程约定：`person_compliance_profiles` 上的 CHECK 使“UNDER_14 profile 必须持有 guardian consent 记录”在数据库层无法违反，因此在有效同意成立前无法写出正式 child Person 的合规状态。
6. per-value provenance 只用一个 `person_profile_values` 追加表承载，`persons` 上不存在任何 Person 级来源列。

不做（与 spec 一致）：Case / Participant / Statement / Assertion / AI / RAG / Digital Use / UI / 多管理员 / 多监护人 / 跨家庭身份关联 API / 完整 Consent 矩阵。

---

## Technical Baseline

`Docs/V1技术设计.md` 是权威，以下只抄本 Slice 相关子集。**不新增任何未批准依赖。**

**Runtime / Language**: Node.js 26 LTS（development baseline `26.13.0`）+ ESM + TypeScript。CI、开发容器、后续 Stage B/C 使用同一 exact patch（§4.1）。

**Dependencies**（全部来自 §2 / §4.1，exact patch 由 lockfile 固定）:
- 服务端：`fastify@5.12.8`、`fastify-type-provider-zod@7`
- 契约：`zod@>=4.2`、`@fastify/swagger`、`openapi-typescript`、`openapi-fetch`
- 数据：`drizzle-orm@0.45` stable line、`drizzle-kit@0.31` stable line、`node-postgres`（`pg`）
- 测试：`vitest`
- 运行时内建：`node:crypto`（token 签名、payload hash、notice hash）、全局 `fetch`（微信 code2session）

**明确不引入**（属“未批准依赖即 BLOCKER”范畴，故主动排除）：
- 任何第三方鉴权 / JWT 库（session token 用 `node:crypto` HMAC-SHA256 自签，见 D-1）
- `testcontainers` 或其它测试容器库（用 §4 Stage A 已批准的 Docker Compose + `DATABASE_URL`）
- 任何 RBAC / 权限库、任何权限 DSL、任何额外 migration 框架
- 结构化日志第三方库（Fastify 内建 logger 足够）

**Storage / Migration**:
- PostgreSQL **18**（原生 `uuidv7()`）；Stage A 用 §4 已定义的 Docker Compose `PostgreSQL 18`。
- 双角色：`xiaoshuyin_migrator`（table owner，只跑 DDL）/ `xiaoshuyin_app`（非 owner、`NOBYPASSRLS`、最小 DML）。角色 bootstrap 由 Compose init + CI 完成，不写在业务 migration 里。
- 变更只经 `db/migrations/` 下 reviewed SQL；禁止 `drizzle-kit push` 进入任何环境（§7.0）。
- Drizzle 负责 schema 类型与事务；RLS、policy、索引、函数用显式 SQL（§7.0 允许）。

**Testing / Eval**:
- `vitest`：domain / authorization / RLS / transaction / integration（§32）。
- 本 Slice 无 AI / RAG / Promptfoo / Gold Dataset 需求（spec Out of Scope），故不建 `ai-eval`、不产生任何 eval 声明。
- 数据库级验证用**同一 PostgreSQL 18 实例**跑真实 SQL 断言，不是 mock。

**Deployment target**: Stage A（Local / CI）Docker Compose。本 Slice 不产出 Stage B/C 证据，也不声称任何平台能力。

---

## Constitution Check

*GATE: MUST PASS before implementation planning proceeds.*

- [x] **No new product semantics.** 只实现 spec FR-001—FR-017。列级 schema、路由、错误码、onboarding 表达属 §7.1 / §7.7A / §28.1 / §28.2 显式下放给 Plan 的决定。可疑缺口列在 Open Review Items，不静默补齐。
- [x] **No V2–V5 scope pulled into V1.** 无第二 Scene、无跨家庭能力、无多管理员、无多监护人、无通用 provenance 平台、无通用权限 DSL。
- [x] **No canonical A/010xx behavior reordered.** Digital Use 未被触及；本 Slice 无任何 A/010xx 节点、无 routing、无 manifest。
- [x] **Frozen technical stack and exclusions are respected.** 依赖清单严格等于 §2 / §4.1；主动排除 JWT 库与 testcontainers。
- [x] **Deterministic rules remain deterministic.** 管理权限、consent gate、age_band 判定、provenance 追加/替换、幂等全部是纯规则 + 数据库约束，无模型参与。
- [x] **Authorization / Consent / RLS / Safety / Compliance implications are addressed.** 双维度授权 + 双层隔离 + consent-first 结构约束 + age_band 门禁；Safety 本 Slice 无作用对象，显式 N/A（见 Authorization 影响节）。
- [x] **Data provenance/version/history requirements are preserved.** per-value 追加表 + 同源替换/异源共存规则 + consent 版本链 `supersedes_id`；历史只追加不回删。
- [x] **Failure/UNKNOWN/concurrency/idempotency behavior is designed where applicable.** 默认拒绝、UNKNOWN 不推断、`ON CONFLICT` 幂等重放、`FOR UPDATE` 串行化同意版本、唯一约束防并发重复；每个失败都有真实状态码与错误码。
- [x] **Verification path exists for every acceptance item.** 见 Verification Plan，逐条对应 spec 的 Acceptance Evidence 表。

**结论：PASS。无 Complexity Exception。**

---

## Design

### 决策索引

| # | 决策 | 章节 |
|---|---|---|
| D-1 | Account / Person / Family / family_members 基数与唯一约束 | §D-1 |
| D-2 | Family 创建者的最小管理权限（无 RBAC） | §D-2 |
| D-3 | UNDER_14 consent-first：最小同意状态、证据、关联、验证 | §D-3 |
| D-4 | Per-value provenance（无 `persons.source_kind`、无 Assertion 平台） | §D-4 |
| D-5 | Guardian relationship / 授权判定 / RLS / 角色 / 事务上下文 | §D-5 |
| D-6 | API 契约、命令幂等、迁移顺序、测试与证据 | §D-6 |

列级 schema 见 `data-model.md`；接口与错误码见 `contracts/`；可执行验证步骤见 `quickstart.md`。

---

### D-1 身份与家庭数据模型、基数、唯一约束

**本 Slice 的全部物理表**

| 表 | 作用 | 来源 |
|---|---|---|
| `accounts` | 登录身份 | §7.1 |
| `persons` | 人物 | §7.1 |
| `families` | 家庭容器 + 创建者（管理主体） | §7.1 + §9 |
| `family_members` | Person ↔ Family 成员关系 | §7.1 |
| `guardian_consent_requests` | consent onboarding 的最小前置状态 | §7.7A 显式下放 Plan |
| `consent_records` | 监护人同意 / 撤回的版本化证据 | §7.1 + §7.7A |
| `person_compliance_profiles` | age_band / minor_mode / guardian / consent version | §7.7A |
| `person_profile_values` | 每条资料的来源记录（per-value provenance） | §2.2 的物理投影 |
| `business_audit_events` | 领域审计（consent 撤回留痕等） | §7.9（Phase 1） |
| `idempotency_keys` | 关键命令幂等 | §8.5 的物理投影 |

#### Account ↔ Person = 1:1，Person → Account = 0..1

实现方式：`persons.account_id uuid NULL UNIQUE REFERENCES accounts(id) ON DELETE RESTRICT`。

- 一个 Person 只有一列 `account_id` → 最多绑定一个 Account（0..1）。
- `UNIQUE(account_id)` + 多行 NULL 不冲突 → 一个 Account 最多被一个 Person 引用（1:1）。
- 不设 `accounts.person_id` 反向列：避免双向可写的 1:1 不一致与循环外键。Account → Person 由该唯一索引保证 ≤1 行。
- spec 场景 14 的两个方向由**同一约束**同时拒绝：给第二个 Person 写同一 `account_id` → unique violation。

#### Person ↔ Family = 多对多，只经 `family_members`

- `persons` 上**不存在** `family_id` 或任何单家庭绑定列（FR-017 的结构断言测试）。
- `family_members(id, family_id, person_id, joined_at)`，`UNIQUE (family_id, person_id)`，`INDEX (person_id)`。
- **没有** `role` / `is_admin` / `is_creator` / `is_guardian` 列（§7.1 不引入角色枚举与 RBAC）。
- 多对多只在 schema / database fixture 级验证（spec 场景 11、12、SC-006）。

#### Family

- `families(id, display_name?, created_by_person_id NOT NULL REFERENCES persons, created_at, updated_at)`。
- `created_by_person_id` 是 §9“管理主体”的物理落点（见 D-2），不是成员角色。
- `UNIQUE (created_by_person_id)`：同一 Person 只能**拥有**一个 Family。该约束只作用于“拥有/创建”，**不限制一个 Person 作为 member 属于多个 Family**——那由 `family_members` 表达，并在 fixture 级验收（场景 11）。理由见 Open Review Item R-2。

#### Account

- `accounts(id, wechat_openid UNIQUE NOT NULL, session_epoch NOT NULL DEFAULT 0, status, created_at, last_login_at?)`。
- `wechat_openid` 是敏感标识，**永不出现在任何 API 响应**（测试断言）。
- 无 `person_id` 列；无 RLS（身份表不属于家庭作用域，见 D-5.4）。

**为什么没有 `sessions` 表**：`POST /auth/logout` 必须真实生效，否则等于伪造能力。本 Slice 用 `accounts.session_epoch` 实现真实吊销：token 内嵌 epoch，登出时 epoch +1，旧 token 全部失效。不引入新表、不引入第三方 JWT 库。

---

### D-2 Family 创建者的最小管理权限（不引入 RBAC）

**问题**：spec 场景 13 要求“非创建者成员不得新增成员或修改他人资料”，但 §7.1 禁止 `family_members` 带角色枚举。

**决策**：管理权限来自 Family 聚合上的创建者引用，而不是成员属性。

```text
管理主体(family, actor) := family.created_by_person_id = actor.personId
```

- 该判定是**纯函数**（`isFamilyManager(family, actorPersonId)`），不读 `family_members`、不读任何角色表。
- `GET /families/current` 返回 `isManager: boolean`，是即时计算结果，**不是**存储的角色值，也不得被下游当作角色持久化。
- 管理权限集合（本 Slice 全部）：`MEMBER_CREATE`、`MEMBER_UPDATE`。其余家庭级动作只要求 membership。
- 非创建者成员：可读本家庭（membership），不能新增 / 修改成员。

**为什么不用 `family_members.is_creator` 布尔位**：§7.1 规定 `family_members` 只表达“Person 属于哪个 Family”。把授权属性放进成员行，正是 spec FR-006 与 Clarifications Q3 / R-2a 否掉的“成员授权属性”。放在 Family 聚合上，语义是“这个家庭是谁建的”，不是“这个人在家里是什么角色”。

**为什么创建者必须是 ADULT**：§1.5 与 §9 把管理主体定义为“创建 Family 的登录 adult”。因此 `POST /families` 要求 `ageBand = ADULT`（连同 `ageBandSource` 一起显式提交，不由服务端推断）；`MINOR_14_17` / `UNDER_14` / `UNKNOWN` / 缺失一律 403 `FAMILY_MANAGER_MUST_BE_ADULT`。UNKNOWN 不得按成人放行（FR-009）。

**创建者 age_band 的来源固定为 `SELF_STATEMENT`**：这是登录 adult 对**自身**年龄的声明，提供者就是 actor 自己。请求若给出其它来源（`GUARDIAN_*` / `OTHER_MEMBER_RELAY`）→ 422 `AGE_BAND_SOURCE_NOT_ALLOWED`，不落任何写入。`persons` 侧不接受客户端传入的 provider，服务端固定为 `actor.personId`。

**该判定属于命令体，不属于 `authorize()`**：登录后 actor 只有 Person、**没有 compliance profile**，profile 是在 `POST /families` 事务内、membership 之后才写入的。若把 `profile.age_band = ADULT` 写进授权前置，所有首次建家庭都会被拒，并诱使实现提前插入一条无 membership 的 profile（违反 `person_compliance_profiles` 的 `WITH CHECK`）。因此 `FAMILY_CREATE` 的授权要求只有“已认证 actor + 已有 Person”，年龄校验在命令体内完成（详见 `contracts/authorization-and-rls.md` §2.3.1）。

**Person 生命周期：登录建立 Person，建家庭只补齐 adult 合规信息**（spec US1 原文：“微信登录时系统建立 Account 与对应 Person”）：

```text
POST /auth/wechat（首次）
  → 建立 Account
  → 在同一事务内建立该账号的 Person（persons.account_id = account.id）
  → 返回 account + person（不含 profile：年龄尚未声明）

POST /families
  → 使用**已存在**的 actor Person（不再新建 Person）
  → 显式确认 ageBand = ADULT + ageBandSource
  → 建立 Family（created_by_person_id = actor Person）
  → 建立 creator membership
  → 建立 ADULT compliance profile（verified_source = ageBandSource）
  → 写入 DISPLAY_NAME 等 profile values（逐值来源）
  → audit
```

因此“登录 + 建家庭两个动作即可完成”仍然成立，且 Person 在任何 Family 之前就已存在。`POST /families` **不创建任何第二个 Person**；若该账号已拥有 Family，`UNIQUE(created_by_person_id)` 会拒绝，返回 409 `FAMILY_ALREADY_OWNED`。

“建家庭”不推导 guardian：`families` 上没有 guardian 字段，创建者的 guardian 身份只能来自某未成年 Person 的 compliance profile（§7.7A）。

---

### D-3 UNDER_14 consent-first：最小同意状态、证据、关联、验证

本 Slice 的核心。目标是让“先建 Person 再补同意”在**结构上不可表达**，而不是靠流程纪律。

#### D-3.1 顺序（与 §10 完全一致）

```text
adult actor established（Account + Person + ADULT profile）
→ guardian / consent onboarding（只建最小前置状态）
→ valid guardian consent（consent_records 落 GRANTED，subject 尚未绑定）
→ create formal child Person           ← 门禁在此处放行
→ create child compliance state        ← DB CHECK 要求 consent 已存在
→ downstream processing
```

#### D-3.2 最小同意状态如何保存（`guardian_consent_requests`）

§7.7A 明确：“该最小状态的技术表达（表、键、token / session 或等价形式）由后续实现 Plan 决定。” 本 Plan 的决定：

```text
guardian_consent_requests
- id                 uuid  ← 同时作为客户端持有的不透明绑定 token
- family_id          当前目标家庭（隔离作用域）
- guardian_person_id 发起同意的成年 Person
- subject_person_id? 仅“对已存在未成年人重新同意”时指向该 Person（首次流程为 NULL）
- declared_age_band  只允许 UNDER_14（本流程专属）
- notice_version     已展示的告知版本
- notice_hash        已展示告知正文的 sha256
- status             PENDING / GRANTED / EXPIRED / ABANDONED
- expires_at         发起后 24h（确定性过期，无后台任务）
- created_at / completed_at?
```

**PII 边界必须分情形表述**（不能笼统说“没有任何孩子标识”）：

| 情形 | `subject_person_id` | 允许承载 | 禁止 |
|---|---|---|---|
| 首次 UNDER_14 onboarding，尚无 child Person | `NULL` | 监护人身份、声明 band、告知版本/hash、过期时间、状态 | 姓名、生日、称呼、关系描述、Assessment / Case / Digital Use / AI 数据 |
| 已存在未成年人的重新同意 | 该 Person id | 同一组最小状态 + **仅用于关联**的 subject id | 以重新同意为理由新增任何其它孩子资料；该列不是资料载体 |

`subject_person_id` 是完成重新同意所严格必要的关联，不构成“提前采集”。因此结构断言的对象不是“本表无 child identifier 列”，而是“列集合恰好等于上述清单；`subject_person_id` 是唯一指向未成年人的列；不存在任何孩子资料列”。

| 字段 | 为什么严格必要 |
|---|---|
| `guardian_person_id` | 同意必须可归属到具体监护人 |
| `declared_age_band` | 不判断适用流程就无法知道需要监护人同意（§19A.2 四分） |
| `notice_version` + `notice_hash` | 同意只能对“已告知的内容”成立，必须可证明告知了什么 |
| `expires_at` | 最小状态不应长期滞留；过期即不可用 |

**该表不是 Person 档案，也不是 Compliance Profile**，因此不违反 FR-008(a)/(b)。

#### D-3.3 有效同意的证据（`consent_records`）

一次同意 = 一行不可变证据；一次撤回 = 一行新版本。同一张表追加：

```text
consent_records
- id                    uuid
- family_id             隔离作用域
- guardian_person_id    监护人 Person
- guardian_account_id   监护人当时的登录身份（证据可归属）
- purpose               UNDER_14_GUARDIAN_CONSENT
- decision              GRANTED / REVOKED
- version               1,2,3…（同一 subject + purpose 单调递增）
- onboarding_request_id? GRANTED 必填（产生该同意的 onboarding 请求，partial UNIQUE）
                        REVOKED 必须为 NULL（撤回不是新的 onboarding）
- bound_person_id?      被同意的未成年人（同意成立时为空，建档时一次性绑定）
- bound_at?             绑定时间；与 bound_person_id 成对原子（见 D-3.3.1）
- notice_version / notice_hash / policy_version
- evidence              jsonb：{channel, accepted_text_hash, client_ip_hash?, user_agent_hash?, declared_age_band}
- decided_at            服务端时间
- supersedes_id?        版本链
```

**证据合法性要点**（对应 V1-C39“可验证的监护人同意证据”）：

1. **谁同意的**：`guardian_person_id` + `guardian_account_id`，必须等于当前已认证 actor（服务端从 session 取得，不接受客户端声明）。
2. **同意了什么**：`notice_version` + `notice_hash` + `policy_version`，告知正文由 `packages/compliance/notices.ts` 版本化持有；hash 不匹配即视为无效同意。
3. **确实是主动同意**：请求体必须显式 `accepted: true`；缺省、false、字段缺失都不构成同意（不是“未反对即同意”）。
4. **何时同意**：`decided_at` 用服务端时间，不接受客户端时间。
5. **对谁同意**：`purpose` 固定为 `UNDER_14_GUARDIAN_CONSENT`，范围只覆盖“该监护人所代表的这名未成年人”，不扩到 §28.2 完整 purpose/scope 矩阵。
6. **最小化**：不采集孩子任何资料；IP / UA 只存 HMAC 摘要，不存原值。
7. **不可抵赖**：`consent_records` 业务列不可更新；`bound_person_id` / `bound_at` 作为**一对**只允许 `(NULL,NULL) → (personId, serverTimestamp)` 一次（CHECK + 触发器共同强制），版本链只追加。

#### D-3.3.1 绑定对的原子性

绑定状态只有两个合法形态：`(NULL, NULL)` 与 `(personId, t)`。

| 更新 | 结果 |
|---|---|
| `(NULL,NULL) → (P,t)` | 允许（唯一一次绑定） |
| `(P,t) → (P,t)` | 允许（no-op） |
| `(P,t) → (Q,t)` | 拒绝 `CONSENT_BINDING_IS_IMMUTABLE` |
| `(P,t) → (P,t')` | 拒绝 `CONSENT_BINDING_IS_IMMUTABLE`（**只改时间也不行**） |
| `(P,t) → (NULL,NULL)` | 拒绝 `CONSENT_BINDING_IS_IMMUTABLE` |
| `(NULL,NULL) → (P,NULL)` | 拒绝 `CONSENT_BINDING_PARTIAL` |

`CHECK ((bound_person_id IS NULL) = (bound_at IS NULL))` 只保证“不同时为空/非空”，**不足以**阻止事后单独改时间；真正的不可篡改由 `BEFORE UPDATE` 触发器负责。

#### D-3.4 如何关联到未成年 Person（FK 顺序）

关联方向是“profile 指向 consent”，不是“consent 反向改写”。但 `bound_person_id` 是**即时外键**，所以不可能先把同意绑到一个还不存在的 Person：

```text
前置：consent 已 GRANTED 且 bound_person_id IS NULL（同意早于 Person 成立）

建档事务（POST /families/:id/members）：
1. 锁定并验证 consent（FOR UPDATE）：GRANTED / 未绑定 / guardian=actor /
   account / family / notice / expiry 全部有效；
   并校验 `ageBandSource ∈ {GUARDIAN_RELAY, GUARDIAN_OBSERVATION}`，否则 422
   `AGE_BAND_SOURCE_NOT_ALLOWED`（provider 由服务端固定为 consent.guardian_person_id）
2. 服务端预生成 personId = uuidv7()
3. INSERT family_members（利用 DEFERRABLE 的 person_id，Person 尚未存在）
4. INSERT persons（account_id = NULL）
5. UPDATE consent_records SET bound_person_id = personId, bound_at = now()
   WHERE id = $consentId AND bound_person_id IS NULL
   —— 0 行受影响 → 409 GUARDIAN_CONSENT_ALREADY_BOUND
6. INSERT person_compliance_profiles（UNDER_14 + guardian + consent 指针）
7. INSERT person_profile_values
8. INSERT business_audit_events
```

**必须同时成立的两件事**：① 同意的成立时间（`decided_at`）早于 Person 创建；② 绑定（写 `bound_person_id`）晚于 Person 行存在。任何“先绑定再建 Person”的写法都会违反外键，任何“先建 profile 再绑定”的写法都会违反 `pcp_under14_requires_consent`。

- `person_compliance_profiles.guardian_consent_record_id` + `guardian_consent_version` 指向当前有效那一版；`guardian_person_id` 取自 consent 行，不接受请求体另行指定。
- 若该 consent 已被绑定 → 409，不会产生第二个孩子。

#### D-3.5 结构约束（本 Plan 最关键的一条）

```sql
CHECK (age_band <> 'UNDER_14'
       OR (guardian_person_id IS NOT NULL
           AND guardian_consent_record_id IS NOT NULL
           AND guardian_consent_version IS NOT NULL))
```

含义：**不存在“UNDER_14 但无同意记录”的 profile 行**。profile 以 `person_id` 引用 Person，而正式 Child Person 的建立必须写入 UNDER_14 profile，所以“先建 Person 再补同意”在数据库层直接失败。这是 FR-008(a) 的结构化执行。

配套 CHECK：

```sql
CHECK (minor_mode = (age_band IN ('MINOR_14_17','UNDER_14')))
CHECK (guardian_person_id IS NULL OR guardian_person_id <> person_id)
CHECK (age_band = 'UNDER_14' OR guardian_consent_record_id IS NULL)
-- UNDER_14 的首个 age_band 只能来自 guardian 声明（CHK023 的结构兜底）
CHECK (age_band <> 'UNDER_14'
       OR verified_source IN ('GUARDIAN_RELAY','GUARDIAN_OBSERVATION'))
```

#### D-3.6 验证路径（gate）

单一函数 `assertMinorProcessingAllowed(personId, feature)`（`packages/compliance`）：

```text
读 profile（缺 profile → BLOCK / PROFILE_MISSING）
age_band = UNKNOWN            → BLOCK / AGE_BAND_UNKNOWN
age_band = ADULT              → ALLOW
age_band = MINOR_14_17        → ALLOW（minorMode = true）
age_band = UNDER_14           → 读 guardian_consent_record_id 指向的行
                                 decision != GRANTED          → BLOCK / GUARDIAN_CONSENT_REVOKED
                                 bound_person_id != personId  → BLOCK / CONSENT_SUBJECT_MISMATCH
                                 notice_hash 与当前版本不符   → BLOCK / NOTICE_VERSION_MISMATCH
                                 guardian 缺失或不等于 profile.guardian_person_id → BLOCK
                                 否则 ALLOW
```

本 Slice 没有 AI / Case / Digital Use，所以该 gate 只被端点级断言与单元测试调用；它是后续 Slice 的唯一入口，必须在本 Slice 提供并通过测试。

#### D-3.7 撤回

**唯一撤回端点**：`POST /api/v1/consents/:id/revoke`（与 OpenAPI 契约一致）。guardian-consent onboarding 的创建/授予仍走 `/api/v1/compliance/guardian-consents...`；两者职责不混用，不提供第二条 revoke 路由。

- 事务内：锁 profile 行（`FOR UPDATE`）→ 追加 `decision='REVOKED'`、`version = current+1`、`onboarding_request_id = NULL`、`bound_person_id = 该未成年人`、`bound_at = now()`、`supersedes_id = current record` → 把 `profile.guardian_consent_version/id` 指向新版本 → 写 audit。
- **REVOKED 不带 onboarding_request_id**：撤回不是一次新的 onboarding，不需要重新告知/重新取得同意。复用原 request id 会撞 `consent_granted_request_key`（partial unique），写成 NOT NULL 又会强迫撤回伪造一次 onboarding。
- 版本链必须能在真实约束下成立：

  ```text
  v1 GRANTED  request=A     bound=P  supersedes=NULL   ← 建档时绑定
  v2 REVOKED  request=NULL  bound=P  supersedes=v1
  v3 GRANTED  request=B     bound=P  supersedes=v2      ← 重新同意
  ```

- 不回删 Person、不回删历史 consent、不回删 profile；`assertMinorProcessingAllowed` 立即 BLOCK。
- 重新进入处理必须取新同意：新 onboarding 请求（`subject_person_id` 指向已存在的未成年人）→ 新 GRANTED 版本 → profile 指针前移。

---

### D-4 Per-value provenance

**决策**：一个追加表 `person_profile_values`，一条记录 = 一个资料值 + 它自己的来源。**没有** `persons.source_kind`，**没有** Statement / Observation / Fact / Assertion 体系，**没有**通用 provenance 平台。

```text
person_profile_values
- id                    uuid
- person_id             资料属于谁
- attribute             DISPLAY_NAME（PG enum，本 Slice 唯一属性）
- value_text            资料值
- source_kind           §2.2 的 8 类来源（PG enum）
- provided_by_person_id 谁提供（人物类来源必填）
- recorded_by_account_id 谁录入系统
- observed_at?          发生/观察时间（未知即 NULL，不补值）
- recorded_at           记录时间（服务端）
- status                RECORDED / SUPERSEDED / RETRACTED
- supersedes_id?        同源替换链
```

**来源枚举取 §2.2 的完整 8 类**（本人陈述 / 家长观察 / 家长转述 / 其他成员转述 / 手工录入设备数据 / 工作人员记录 / AI 假设 / 经确认信息）。本 Slice 的 API **写入白名单只有 4 类**：`SELF_STATEMENT`、`GUARDIAN_OBSERVATION`、`GUARDIAN_RELAY`、`OTHER_MEMBER_RELAY`；其余 4 个值存在于 enum 但在本 Slice 不可写（没有对应能力）。理由：spec 要求“至少区分”这 4 类，而来源类型集合本身是 §2.2 已批准内容；把 enum 裁成 4 值会在后续 Slice 造成一次无意义 migration。见 Open Review Item R-3。

**追加 / 替换规则（确定性）**：写入某 attribute 时，

- 仅把**同 `person_id` + 同 `attribute` + 同 `source_kind`** 的 `RECORDED` 行置为 `SUPERSEDED`；
- **不同来源的行保持 `RECORDED` 并存**。

这条规则直接实现 §5 不变量 4 与 §2.2 的“来源冲突保留”：家长转述不会被本人陈述覆盖，也不会顶掉本人陈述；两条同时存在即表示“当前存在来源冲突”，而不是被合并成一个值。它同时满足 spec 的“同一资料多来源不被覆盖”与“不同资料可携带不同来源”。

**为什么 `AGE_BAND` 不放进 `person_profile_values`**：§7.7A 已把 age_band 固定在 `person_compliance_profiles`，并同时给了 `verified_source`。同一事实存两处必然漂移。因此：

- age_band 的唯一载体是 `person_compliance_profiles`，来源载体是同行的 `verified_source`（同样使用 §2.2 枚举）。
- `person_profile_values.attribute` 的 enum **不含** `AGE_BAND`，从结构上排除第二载体（测试断言）。
- 结果仍满足 FR-003：称呼与年龄段各有独立来源、互不覆盖；`persons` 上没有任何来源列。

**来源可接受性按“路径”约束，而不是按“人”约束**（CHK023 收口）：

| 路径 | age_band | 允许的 `ageBandSource` | provider 由谁决定 |
|---|---|---|---|
| `POST /families`（actor 建自己的家庭） | 必须 `ADULT` | 仅 `SELF_STATEMENT` | 服务端固定 = actor.personId |
| `POST /families/:id/members`，`ageBand = UNDER_14` | `UNDER_14` | 仅 `GUARDIAN_RELAY` 或 `GUARDIAN_OBSERVATION` | 服务端固定 = 该 consent 的 `guardian_person_id`（必须等于 actor） |
| `POST /families/:id/members`，其它 band | `ADULT` / `MINOR_14_17` / `UNKNOWN` | 4 类白名单均可用，按真实提供方式选择 | 客户端可给，服务端校验其为本家庭成员 |

为什么 UNDER_14 的首个 band 只允许 guardian-origin：该 Person 尚未存在、流程由 adult / guardian 发起、`declared_age_band` 属于取得同意所严格必要的**成人/监护人声明**。因此正式 child profile 的初始 `age_band` 来源必须与这次 guardian 声明对应，客户端不得改写成 `SELF_STATEMENT`（孩子不在场）或 `OTHER_MEMBER_RELAY`（同意主体不是他）。

**该约束不推广成“人是某类就不能有某来源”**：除上述两条创建路径外，provenance 仍按每条信息真实的提供方式判定；无 Account 的 Person 仍可有 `SELF_STATEMENT`（FR-004 不变）。

**本 Slice 只有一个 attribute，且不为此新增字段**：U03 的最小人物资料只包含「称呼」。per-value provenance 由两组**真实事实**验证，而不是靠造一个只为测试存在的资料维度：

1. 同一 `DISPLAY_NAME` 的多来源并存 / 同源替换（同一张表内）；
2. `age_band` 的来源由 `person_compliance_profiles.verified_source` 独立承载（另一张表、另一个来源值）。

两者共同证明「来源属于具体资料值；不同资料载体可以拥有独立 provenance」。**禁止**为了证明模型成立而新增没有正式需求的业务字段；也不得用另一个新字段替代原来的 `RELATION_DESCRIPTOR`。

---

### D-5 Guardian relationship / 授权 / RLS / 角色 / 事务上下文

#### D-5.1 两个互相独立的判定输入

| 维度 | 数据来源 | 决定什么 | 不得用于 |
|---|---|---|---|
| Family membership | `family_members(family_id, actor.personId)` | 能否访问该家庭的家庭 / 成员数据；能否建立 `app.family_id` 上下文 | 不得用于判断某未成年人是否有 guardian |
| Compliance guardian relationship | `person_compliance_profiles.guardian_person_id` | 某未成年人的 guardian 是谁；同意 / 撤回的主体资格 | 不得替代 membership，不构成家庭访问权限 |

二者不得压成单一角色字段，也不得互相推导（§7.7A、FR-006）。

#### D-5.2 `authorize()` 契约

```ts
authorize({
  actor: { accountId, personId },
  product: 'V1',
  family: { familyId } | null,
  case: null,                       // 本 Slice 未实现该维度
  resource: ResourceRef,            // SELF | FAMILY | MEMBER | CONSENT
  action: Action,                   // 本 Slice 已注册动作表
  purpose: Purpose,
}) => { decision: 'ALLOW', basis } | { decision: 'DENY', reason }
```

**fail-closed 规则**（避免“传了但没判”）：

- `case !== null` → `DENY / UNSUPPORTED_DIMENSION`（Case participation 属未来 Slice，不得静默放行）。
- `action` 不在本 Slice 注册表 → `DENY / UNSUPPORTED_ACTION`。
- `purpose` 不在本 Slice 枚举 → `DENY / UNSUPPORTED_PURPOSE`。
- 家庭级 action 但 `family === null` → `DENY / FAMILY_CONTEXT_REQUIRED`。
- 任何内部异常 → `DENY / AUTHORIZATION_ERROR`（不允许异常冒泡成放行）。

**动作表（本 Slice 全部）**：`IDENTITY_SELF_READ`、`FAMILY_CREATE`、`FAMILY_READ`、`MEMBER_CREATE`、`MEMBER_UPDATE`、`GUARDIAN_CONSENT_REQUEST`、`GUARDIAN_CONSENT_GRANT`、`GUARDIAN_CONSENT_REVOKE`、`MINOR_PROCESSING`。

**Purpose 枚举（本 Slice 最小集）**：`SELF_IDENTITY`、`FAMILY_MANAGEMENT`、`GUARDIAN_CONSENT`。完整 purpose/scope 矩阵属 §29.5 完整 Consent 平台，不在本 Slice。

#### D-5.3 数据库角色

```text
xiaoshuyin_migrator  table owner；只跑 DDL；不是 runtime
xiaoshuyin_app       非 owner；NOBYPASSRLS；最小 DML 权限
```

- 角色由 Compose init / CI bootstrap 以超级用户创建；业务 migration 不创建角色。
- `xiaoshuyin_app` 对 10 张表（含 `idempotency_keys`）持有 `SELECT/INSERT/UPDATE/DELETE`，对 8 个 enum 持 `USAGE`；不持有 `CREATE` 与 `TRUNCATE`，不是 schema owner。
- 无 sequence 权限需求（主键全 `uuidv7()`）。
- **验证方式**：查询 `pg_roles.rolbypassrls`、`pg_class.relowner`、`has_table_privilege()` 的真实输出，而不是文档声明。

#### D-5.4 RLS

除 `accounts` 外，全部 9 张表 `ENABLE` + `FORCE ROW LEVEL SECURITY`（8 张家庭/人物作用域 + `idempotency_keys` 的身份级策略）。

先说明一个必须解决的约束，否则设计不成立：**`GET /me`、`GET /compliance/profile`、`GET /families/current` 必须能在“尚无可用家庭上下文”时读到自己的数据**。若所有 person 作用域策略只依赖 `app.family_id` + membership，这三个端点在首次登录后（尚无 membership）会返回 0 行，即 RLS 把合法自助读也挡掉。因此策略是 membership 与 self 的**并集**，两者都由数据库列比对得出，不由应用层声明。

| 表 | `USING`（读/改） | `WITH CHECK`（写） |
|---|---|---|
| `families` | `id = app_family_id()` **OR** actor 是该家庭成员 | `id = app_family_id()` AND `created_by_person_id = app_person_id()` |
| `family_members` | `family_id = app_family_id()` **OR** `person_id = app_person_id()` | `family_id = app_family_id()` |
| `guardian_consent_requests` | `family_id = app_family_id()` | 同左 |
| `consent_records` | `family_id = app_family_id()` | 同左 |
| `business_audit_events` | `family_id = app_family_id()` | 同左 |
| `persons` | `account_id = app_account_id()` **OR** `id = app_person_id()` **OR** membership(app_family_id()) | `account_id = app_account_id()` **OR** membership(app_family_id()) |
| `person_compliance_profiles` | `person_id = app_person_id()` **OR** membership(app_family_id()) | membership(app_family_id()) |
| `person_profile_values` | 同 `person_compliance_profiles` | membership(app_family_id()) |
| `idempotency_keys` | `actor_account_id = app_account_id()` | 同左 |

其中 `membership(x)` 一律展开为 `EXISTS (SELECT 1 FROM family_members fm WHERE fm.person_id = <本表主体> AND fm.family_id = x)`；`families` 的 OR 分支为 `EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id = families.id AND fm.person_id = app_person_id())`。

`app_family_id()` / `app_person_id()` / `app_account_id()` = `NULLIF(current_setting('app.<x>', true), '')::uuid`。无上下文 → 谓词为 NULL → 0 行（默认拒绝）。

**`idempotency_keys` 必须是身份级 RLS，不能靠仓储自律**：该表保存 `response_body` 重放快照，内容可能包含 Family / Person / Member / Consent 的响应字段。一条漏写 `WHERE actor_account_id = …` 的查询就会跨账号回放他人数据。因此 `ENABLE` + `FORCE`，策略 `actor_account_id = app_account_id()`；key 的 lookup / insert / replay 全部在已建立 identity 上下文的事务内执行；无 identity 上下文时读 0 行、写被拒。

**为什么 self 分支用列比对而不是 GUC 自证**：

- `persons.account_id = app_account_id()` 是**列与 GUC 的比较**，不是“调用方声明自己是谁”。GUC 由认证层在验签后写入，数据由数据库比对，两者必须一致才可见。
- `person_id = app_person_id()` 同理：只有该行的 person 恰好是当前身份的 person 才可见。
- 若只靠 membership，首次登录后无法读自身；若只靠 self，家庭成员之间无法互相读。取并集后两条路径都成立，且都不引入角色。

**递归风险处理**：`family_members` 的 `USING` 只引用 GUC，不引用自身；`families` 的 OR 分支引用 `family_members`，而 `family_members` 不引用 `families`，因此链条单向终止，不产生 `infinite recursion detected in policy`。任何“把 family_members 写进自身策略”的写法都属禁止实现。

**三条写入路径与各自的顺序**（`persons` 的 `WITH CHECK` 有唯一一个 self 分支 `account_id = app_account_id()`；其余表的写入只认 membership / family 上下文 / account）：

| 命令 | 上下文 | 顺序 | 原因 |
|---|---|---|---|
| `POST /auth/wechat`（首次） | identity（仅 account） | Account → `set_account_context` → Person（`account_id` 非空） | Person 只能凭 `account_id = app_account_id()` 写入；此时还没有 profile |
| `POST /families` | identity → family | Person 已存在 → `create_family` → membership → profile(ADULT) → values → audit | `families.created_by_person_id` 是即时外键；profile 的 `WITH CHECK` 要求 membership 先存在 |
| `POST /families/:id/members` | family | membership → Person（`account_id IS NULL`）→ 绑定 consent → profile → values → audit | 成员的 Person 无法走 self 分支，只能靠已存在 membership；consent 绑定必须在 Person 行存在之后 |

`family_members.person_id` 因此声明为 `DEFERRABLE INITIALLY DEFERRED`（提交时校验）；`families.created_by_person_id` 与 `consent_records.bound_person_id` 保持即时校验。这样三条路径都不会留下“无 membership 的孤儿 Person”；需要提前知道 id 的命令用 `SELECT uuidv7()` 预取（仍满足 §7.0 的 `uuidv7()` 基线）。

`accounts` **不加 RLS**：它不是家庭作用域，且登录必须在无任何上下文时可用。补偿控制：只允许经 `auth` 模块的窄查询访问（`WHERE wechat_openid = $1`），测试断言其不参与任何家庭响应序列化。见 Open Review Item R-4。

#### D-5.5 事务上下文

四个入口，各自只做一件窄事；业务代码不得直接 `set_config`。

```ts
// ① 登录：Account 之后、Person 之前只设账号上下文
withAccountTransaction({ accountId, purpose }, fn)
  → BEGIN → app.set_account_context(accountId, 'SELF_IDENTITY')
  → INSERT persons (account_id = accountId)      // 仅首次登录；Person 在登录时建立
  → COMMIT

// ② 家庭创建：Person 已存在，Family 与 membership 尚不存在
withFamilyCreationTransaction({ accountId, personId, newFamilyId, displayName }, fn)
  → BEGIN
  → app.set_identity_context(accountId, 'FAMILY_MANAGEMENT')
  → app.create_family(newFamilyId, personId, displayName)   // 设 family 上下文 + 插 Family
  → fn(tx)   // 插 membership → profile(ADULT) → values → audit
  → COMMIT

// ③ 家庭作用域：最常见路径
withRlsTransaction({ familyId, accountId, personId, purpose }, fn)
  → BEGIN
  → app.set_identity_context(accountId, purpose)             // 解析自身 person
  → app.set_family_context(familyId, personId, purpose)      // 校验 membership
  → fn(tx)
  → COMMIT
```

四个入口的职责边界：

| 入口 | 设置 | 数据库侧校验 |
|---|---|---|
| `app.set_account_context(account, purpose)` | `app.account_id`、`app.purpose` | 参数非空（否则 42501） |
| `app.set_identity_context(account, purpose)` | 账号上下文 + 命中时设 `app.person_id` | 无额外校验；可见性由策略的列比对决定 |
| `app.set_family_context(family, person, purpose)` | `app.family_id`、`app.person_id`、`app.purpose` | `EXISTS(family_members WHERE family_id=$1 AND person_id=$2)` 不成立 → `RAISE 42501 FAMILY_MEMBERSHIP_REQUIRED` |
| `app.create_family(familyId, creatorPersonId, displayName)` | 同上 + `app.family_id` | `INSERT INTO families` 受 `WITH CHECK (id = app_family_id() AND created_by_person_id = app_person_id())` 约束 |

- `set_identity_context` 内解析 person 的那条 SELECT 受 `persons` 策略约束（`account_id = app_account_id()` 分支），只能取到本账号绑定的那一行（`UNIQUE(account_id)` 保证 ≤1）。
- `set_family_context` 的 membership 校验发生在 `set_config` **之后**，因此该 EXISTS 查询本身受 RLS 约束，只能看到目标家庭的行，既不会跨家庭探测，也不会自我递归。
- `create_family` 是唯一没有 membership 前置的入口，因为新家庭尚无 membership。它不构成新的绕过面：`INSERT` 被 `created_by_person_id = app_person_id()` 锁死为“只能给自己建家庭”，且同事务内必须插 membership（`family_members.WITH CHECK` 强制 `family_id = app_family_id()`），否则后续 profile 写入失败。该例外记入 Open Review Item R-8。
- 关于信任边界（必须明确写在实现注释里）：**`set_config` 是内置函数，任何持有 app 角色的连接都能直接调用**。因此 GUC 型 RLS 的前提是“应用在 `authorize()` 之后诚实地设置上下文”；RLS 防的是**查询遗漏**（忘写 WHERE、JOIN 漏表），不是防恶意应用。§9.1 对这个定位的原文是“防止查询遗漏导致跨家庭泄漏的第二道硬防线”，本设计保持一致，不夸大。

§9.1 原文禁止项全部保留：事务外 `SET LOCAL` 后再从连接池查询、`sql.raw` 拼接 family/person/purpose、owner / BYPASSRLS 运行时角色、因 RLS 存在而跳过 `authorize()`。

---

### D-6 API 契约、幂等、迁移顺序、测试与证据

#### D-6.1 端点

§28.1 / §28.2 已列出（不改动语义）：
`POST /auth/wechat`、`POST /auth/logout`、`GET /me`、`POST /families`、`GET /families/current`、`PATCH /families/:id/members/:personId`、`GET /consents`、`POST /consents/:id/revoke`、`GET /compliance/profile`、`GET /compliance/notices`、`POST /compliance/guardian-consents`。

**故意不实现 `POST /api/v1/consents`**：它是 §28.2 的通用同意写入入口，属「完整 Consent 平台（purpose/scope 矩阵、单独同意分类）」，spec 明确 out of scope。本 Slice 的监护人同意只有一条写入路径 `POST /compliance/guardian-consents`；再开第二条写入路径会为同一事实制造两个真相源。`GET /consents` 与 `POST /consents/:id/revoke` 保留（读与撤回是本 Slice 范围内的能力）。

在已批准契约面内补齐具体路由（§28.1 的 `families/:id/members` 面、§28.2 的 guardian-consents 面；§7.7A 明确把 onboarding API 交由 Plan 决定）：

- `POST /api/v1/families/:id/members` —— 建成员（U03 需要，§28.1 未枚举路由）。
- `POST /api/v1/compliance/guardian-consents/requests` —— 最小 onboarding 请求。

`/families/current`、`/consents`、`/compliance/guardian-consents/requests` 的路径不含 `family_id`，因此单事务内先以 identity 上下文解析 actor 自己的 membership，再切到 family 上下文；多行时按 current-family 解析规则判定，无法唯一确定 → `409 CURRENT_FAMILY_AMBIGUOUS`，不静默取第一个（禁止 `rows[0]` / `ORDER BY ... LIMIT 1`）。**actor 尚无任何 Family 时**：`/families/current` 与 `/compliance/guardian-consents/requests` 返回 404 `CURRENT_FAMILY_NOT_FOUND`，`/consents` 返回 200 空列表（集合端点），均与 403 `NOT_FAMILY_MEMBER` 区分（细节见 `contracts/authorization-and-rls.md` §4.4）。

**`POST /auth/wechat` 的职责**：首次登录在同一事务内建立 Account **与** 当前登录者 Person（spec US1），响应同时返回 `account` 与 `person`；`person.profile` 此时为空（年龄尚未声明），在 `POST /families` 时补齐 ADULT profile。`POST /families` 不创建 Person。

完整路径、请求 / 响应 schema、状态码、错误码见 `contracts/identity-family-api.openapi.yaml`。

#### D-6.2 错误语义

- 统一错误体：`{ "code": string, "message": string, "details"?: object }`。
- 家庭 / 成员类拒绝**一律 403**，响应体不含目标对象任何字段；不存在与无权对外表现一致（避免存在性预言机）。
- 对应 spec A-2：正式文档未规定 NOT_FOUND / DENIED 是否统一。本 Plan 选择“统一 403 + 零字段泄漏”，映射集中在单一 `toHttpError(reason)`；若 Owner 后续决定改 404 掩盖，只改这一处，不构成新的产品语义。
- **“没有当前家庭”不等于“无权访问某个家庭”**（CHK045 收口）：已认证但 actor 尚无任何 Family → **404 `CURRENT_FAMILY_NOT_FOUND`**，响应不含任何 Family 字段；已解析到目标 Family 但 actor 无 membership → 仍 **403 `NOT_FAMILY_MEMBER`**，并继续零字段泄漏。跨家庭访问统一 403 的既有规则不变。
- 错误码：`UNAUTHENTICATED`(401)、`FORBIDDEN`/`NOT_FAMILY_MEMBER`/`NOT_FAMILY_MANAGER`/`FAMILY_MANAGER_MUST_BE_ADULT`/`AGE_BAND_UNKNOWN`/`GUARDIAN_CONSENT_REQUIRED`/`GUARDIAN_CONSENT_REVOKED`/`NOT_GUARDIAN`/`GUARDIAN_CONSENT_ALREADY_BOUND`/`GUARDIAN_CONSENT_EXPIRED`/`GUARDIAN_CONSENT_NOTICE_MISMATCH`(403)、`CURRENT_FAMILY_NOT_FOUND`(404)、`CURRENT_FAMILY_AMBIGUOUS`(409)、`VALIDATION_ERROR`/`AGE_BAND_SOURCE_NOT_ALLOWED`(422)、`IDEMPOTENCY_PAYLOAD_MISMATCH`/`FAMILY_ALREADY_OWNED`/`MEMBER_ALREADY_EXISTS`(409)。

#### D-6.3 关键命令与幂等

关键命令（§8.5 限定，不泛化到读操作）：`FAMILY_CREATE`、`MEMBER_CREATE`、`MEMBER_UPDATE`、`GUARDIAN_CONSENT_REQUEST`、`GUARDIAN_CONSENT_GRANT`、`GUARDIAN_CONSENT_REVOKE`。

```text
idempotency_keys(actor_account_id, command_type, idempotency_key) UNIQUE
+ request_hash = sha256(canonical_json(payload))
+ response_status / response_body
```

单事务内执行顺序：

1. `INSERT … ON CONFLICT (…) DO NOTHING RETURNING id`；
2. 未插入 → 已有记录：`SELECT … FOR SHARE`（唯一索引保证并发插入等待前者提交）→ 比对 `request_hash`；
3. hash 相同 → 返回已存 `response_status` + `response_body`（重放，不重复业务写入）；
4. hash 不同 → 409 `IDEMPOTENCY_PAYLOAD_MISMATCH`；
5. 首次插入 → 执行业务写入 → 回填 response 快照 → 提交。

并发 / 重试的等价结果由唯一索引 + 行锁保证，不依赖应用层缓存或内存锁（§4.0A 禁止进程内锁作为业务真相）。

#### D-6.4 迁移顺序（单次 reviewed migration，可重放）

```text
01 角色 bootstrap（Compose init / CI，非业务 migration）
02 CREATE TYPE：age_band / provenance_source / profile_attribute /
                profile_value_status / consent_decision /
                consent_request_status / consent_purpose / account_status
                （共 8 个，与 data-model §1 完全一致）
03 accounts
04 persons（account_id UNIQUE、created_by_account_id）
05 families（created_by_person_id UNIQUE）
06 family_members（UNIQUE(family_id,person_id)；person_id FK DEFERRABLE）
07 guardian_consent_requests
08 consent_records（CHECK: GRANTED→request 非空 / REVOKED→request 为空；
                 partial UNIQUE(onboarding_request_id) WHERE NOT NULL；
                 partial UNIQUE(bound_person_id,purpose,version)；绑定对 CHECK）
09 person_compliance_profiles（含 UNDER_14 consent CHECK）
10 person_profile_values
11 business_audit_events
12 idempotency_keys
13 其余索引与 CHECK
14 函数：app_family_id() / app_person_id() / app_account_id() / app_current_purpose()
        + app.set_account_context() / app.set_identity_context()
        + app.set_family_context() / app.create_family()
15 ENABLE + FORCE RLS + 每表 policy（USING + WITH CHECK）
16 触发器函数 consent_records_guard_update() + 触发器 consent_records 不可变列保护
17 GRANT 给 xiaoshuyin_app（最小 DML + enum USAGE）
```

顺序依据：外键只允许“被引用表先建”。`person_compliance_profiles → consent_records` 与 `consent_records → persons` 不构成环；`persons` 与 `family_members` 之间的唯一“环”由可延迟外键化解。

---

### Existing Contracts Reused

- §7.1 表组：`accounts` / `persons` / `families` / `family_members` / `consent_records`。
- §7.7A：`person_compliance_profiles` 的 age_band / minor_mode / guardian_person_id / guardian_consent_version / verified_source / effective_at。
- §9：`authorize({actor, product, family, case, resource, action, purpose})` 与“客户端 ID 仅作待验证参数”。
- §9.1：`withRlsTransaction`、`app.family_id / app.person_id / app.purpose`（本 Plan 追加 `app.account_id`，用于 self 读的列比对）、双角色、FORCE RLS、无上下文默认拒绝。
- §8.5：`actor_id + command_type + idempotency_key`。
- §27A：Zod → Fastify → OpenAPI → generated types → openapi-fetch 的单事实源链。
- §28.1 / §28.2：端点集合。
- §7.0：`uuidv7()`、reviewed migration file、migrator/runtime 分离。
- §7.9：`business_audit_events` 表名（只建本 Slice 事件所需最小列）。

### Data and Migration Impact

- 新增 10 张表、8 个 enum、9 个函数（含触发器函数）、1 个触发器、9 条 policy、若干唯一 / 部分唯一索引与 CHECK。
- 无数据迁移、无回填、无跨表复制；Greenfield，无停机窗口。
- 无 pgvector / pg_jieba / pg-boss 依赖（§4.2 RAG readiness 不在本 Slice）。

### Authorization / Safety / Compliance Impact

- **Authorization**：新增单一 `authorize()` 与两维判定；所有家庭级端点强制经 `withRlsTransaction`。
- **Consent**：consent-first 由 DB CHECK 结构化执行；同意 / 撤回是版本化证据链。
- **Compliance**：实现 `assertMinorProcessingAllowed` 门禁（V1-C39 / §5 不变量 27 的最小执行体）。不做 `compliance_feature_policies` 策略引擎、PIPIA、拟人化适用判断、连续使用计时（spec 明确排除）。
- **Safety**：本 Slice 无 Case / 无 Safety State / 无 AI，Safety Gate 无作用对象 → 显式 N/A，不建空壳。
- **RLS**：见 D-5.4。双层防线互相独立，任一层失效仍阻断跨家庭读取。

### API / Contract Impact

- 新增 `packages/contracts` Zod schema 作为唯一事实源；`@fastify/swagger` 生成 OpenAPI；`openapi-typescript` 生成类型；CI 断言 generated 文件无未预期 diff。
- 客户端（小程序 / 运营端）本 Slice 不实现，但类型链路必须可生成，否则 §27A 合同不成立。
- 无 breaking change（仓库此前无 API）。

### AI / RAG / Eval Impact

**N/A**。本 Slice 不含模型调用、嵌入、检索、Prompt、Gold Dataset 或 eval 断言。不创建 `ai-eval` 目录，不产生任何“AI 已就绪”的声明。

### Async / Notification / Side-Effect Impact

- 无 pg-boss、无 Job、无外部通知、无文件、无支付。
- 唯一外部依赖是微信 `code2session`，以 `WechatAuthProvider` 端口隔离，测试用确定性 fake；真实平台调用在本 Slice 标记 **NOT VERIFIED**（属 §40 Platform 门槛）。
- 副作用只有数据库写入，全部单事务；失败整体回滚，不存在半成功状态。

---

## Project Structure

只列 `Docs/V1技术设计.md` §3 已定义、且本 Slice 会真正触碰的路径。

```text
apps/
  server/
    api/
      src/
        app.ts                       Fastify 实例 + Zod type provider + swagger
        server.ts                    启动入口
        plugins/
          auth.ts                    session token 解析 → actor
          error-handler.ts           统一错误体 + toHttpError()
        routes/
          auth.ts                    POST /auth/wechat, /auth/logout
          me.ts                      GET /me
          families.ts                POST /families, GET /families/current
          members.ts                 POST /families/:id/members,
                                     PATCH /families/:id/members/:personId
          consents.ts                GET /consents, POST /consents/:id/revoke
          compliance.ts              GET /compliance/profile, GET /compliance/notices,
                                     POST /compliance/guardian-consents[/requests]

packages/
  contracts/                         Zod schema（唯一事实源）+ openapi 生成产物
  domain/                            实体、命令、不变量、错误类型
  authorization/                     authorize() + 两维判定 + fail-closed
  compliance/                        age_band 门禁 + notices（版本化告知正文）

db/
  schema/                            Drizzle schema（10 张表）
  migrations/                        reviewed SQL（单文件，见 D-6.4）
  rls/                               policy / 函数 / 触发器 / 角色校验 SQL

tests/
  domain/                            不变量、provenance 规则、age_band 判定
  integration/                       Fastify inject + 真实 PG18
  db/                                RLS / 角色 / 约束 / 列存在性断言
  fixtures/                          多家庭、非创建者成员、撤回等预置数据
```

不创建：`apps/miniprogram`、`apps/operations`、`packages/scenes`、`packages/ai`、`packages/rag`、`packages/memory`、`packages/notifications`。它们属于后续 Phase，本 Slice 不建空壳（避免“为未来架构预留”）。

---

## Verification Plan

`EVIDENCE` 一栏均为**真实命令输出**，不接受“应该通过”。

| Requirement / Acceptance | Test or evidence | Command / environment | Expected result |
|---|---|---|---|
| FR-001 / 场景 1（Account / Person 分离，`GET /me`） | integration | `bun run vitest run tests/integration/me.test.ts` | 200；返回 account 与自身 person（登录后必存在）；响应无其他成员字段；openid 不出现 |
| FR-002 / U01（微信登录建立 Account **与 Person**） | integration（fake provider） | `bun run vitest run tests/integration/auth.test.ts` | 首次登录同一事务内建 Account 与绑定该账号的 Person（`account_id` 非空、`profile` 为空）；同 openid 重复登录不产生第二个 Account / Person；logout 后旧 token 401 |
| FR-002 平台真实性 | **NOT VERIFIED（本 Slice）** | — | 明确记录：真实 code2session 属 §40 Platform 门槛，本 Slice 只验适配器契约 |
| FR-005 / 场景 2 / US1（建家庭 + 管理主体 + 幂等） | integration | `bun run vitest run tests/integration/families.test.ts` | **actor 登录后尚无 compliance profile，首次建家庭仍成功**（`FAMILY_CREATE` 不依赖 profile）；家庭建立；**复用登录时已存在的 Person，不新建 Person**（人数量不变）；创建者 Person 属于该家庭；ADULT profile 写入；`isManager=true`；同 key 重放不产生第二个家庭 / 成员；同 key 不同 payload → 409；`ageBand != ADULT` → 403 `FAMILY_MANAGER_MUST_BE_ADULT` 且无任何写入 |
| age_band 来源可接受性（CHK023） | unit + integration | `bun run vitest run tests/domain/age-band-source.test.ts tests/integration/members.test.ts` | `POST /families` 的 `ageBandSource` 只接受 `SELF_STATEMENT`，其它值 → 422 `AGE_BAND_SOURCE_NOT_ALLOWED` 且无写入；`POST /families/:id/members` 且 `ageBand=UNDER_14` 只接受 `GUARDIAN_RELAY`/`GUARDIAN_OBSERVATION`，`SELF_STATEMENT`/`OTHER_MEMBER_RELAY` → 422；落库的 `provided_by_person_id` 由服务端固定（creator=self；under-14=consent.guardian_person_id），客户端伪造值被忽略或拒绝 |
| “尚无家庭”空态（CHK045） | integration | `bun run vitest run tests/integration/families.test.ts` | 已认证且无任何 Family：`GET /families/current` → 404 `CURRENT_FAMILY_NOT_FOUND`、`POST /compliance/guardian-consents/requests` → 404，响应不含任何 Family 字段；已解析到某 Family 但非其成员 → 403 `NOT_FAMILY_MEMBER`（两者可区分） |
| FR-016 / 场景 14 / SC-007（Account ↔ Person 1:1） | database | `bun run vitest run tests/db/constraints.test.ts` | 两个方向写入均抛 unique violation，真实错误输出被断言 |
| FR-017 / 场景 11、12 / SC-006（多对多 + 唯一 membership） | database（fixture） | `bun run vitest run tests/db/cardinality.test.ts` | 同 Person 两条不同 family membership 成功；同 (family, person) 第二条被拒；`persons` 无 `family_id` 列 |
| FR-003 / FR-004 / 场景 3 / SC-008（per-value provenance） | unit + integration | `bun run vitest run tests/domain/provenance.test.ts tests/integration/members.test.ts` | 同一 `DISPLAY_NAME` 的多来源并存不被覆盖、同源替换产生 SUPERSEDED；`age_band` 来源独立记录在 `person_compliance_profiles.verified_source`（不同载体各有来源）；`persons` 无 `source_kind` 列；无 Account 的 Person 允许 `SELF_STATEMENT`；`profile_attribute` 枚举只含 `DISPLAY_NAME`（无任何为测试新造的字段） |
| FR-008 (a)(b) / 场景 4 / SC-003①（同意前不建正式 child） | integration + database | `bun run vitest run tests/integration/consent-first.test.ts` | 无 `guardianConsentId` 建 UNDER_14 成员 → 403 `GUARDIAN_CONSENT_REQUIRED`；`persons` 与 `person_compliance_profiles` 均无该未成年人行；onboarding 请求本身可创建（不自锁） |
| D-3.5（结构约束） | database | `bun run vitest run tests/db/consent-structure.test.ts` | 直接 SQL 插入 `age_band='UNDER_14'` 且 consent 为 NULL 的 profile → CHECK violation |
| FR-008 (c) / 场景 5 / SC-003③（同意后建档） | integration | `bun run vitest run tests/integration/consent-first.test.ts` | 同意成立后创建成功；profile 的 `age_band=UNDER_14`、`guardian_person_id`、`guardian_consent_version`、`guardian_consent_record_id` 与 consent 一致 |
| FR-010 / 场景 6 / SC-003④（撤回） | integration + database | `bun run vitest run tests/integration/consent-revoke.test.ts` | 新增 REVOKED 版本（version+1，`onboarding_request_id IS NULL`，supersedes 指向原版本）；profile 指针前移；`assertMinorProcessingAllowed` 立即 BLOCK；audit 行存在；历史行未被删除 |
| FR-010 / 版本链结构（GRANTED→REVOKED→GRANTED） | database | `bun run vitest run tests/db/consent-chain.test.ts` | v1 GRANTED(request A) / v2 REVOKED(NULL) / v3 GRANTED(request B) 三行可同时存在且满足 `consent_request_binding`、`consent_granted_request_key`、`consent_subject_version_key`；GRANTED 缺 request → CHECK violation；REVOKED 带 request → CHECK violation；同一 request 第二条 GRANTED → unique violation |
| 绑定对不可篡改（D-3.3.1） | database | `bun run vitest run tests/db/consent-binding.test.ts` | ① `(NULL,NULL)→(P,t)` 成功；② 改 `bound_person_id` → `CONSENT_BINDING_IS_IMMUTABLE`；③ **只改 `bound_at`** → 同错误；④ 清空任一字段 → 同错误；⑤ `(NULL,NULL)→(P,NULL)` → `CONSENT_BINDING_PARTIAL` |
| FR-009 / 场景 10 / SC-004（UNKNOWN 不按成人） | unit | `bun run vitest run tests/domain/age-band.test.ts` | UNKNOWN → BLOCK/`AGE_BAND_UNKNOWN`；永不进入 ADULT 分支；`NOT_COLLECTED` 不是 age_band 合法值 |
| FR-011 / 场景 7、8、9（授权与伪造 ID） | integration + database | `bun run vitest run tests/integration/authorization.test.ts tests/db/rls.test.ts` | 跨家庭读取 403 且响应无目标字段；伪造 `family_id` 不获得访问；非创建者成员新增成员 403 `NOT_FAMILY_MANAGER`；绕过应用以 app 角色直连查询返回 0 行 |
| FR-006a / guardian-but-not-member | integration（fixture） | `bun run vitest run tests/integration/authorization-dimensions.test.ts` | fixture 预置「某未成年 Person 的 guardian」但该 actor 不是目标 Family 成员：`GET /families/current`、家庭级读取、`POST /families/:id/members` 全部被拒（无 membership 时不获得家庭访问），证明 guardian 关系不构成家庭权限 |
| FR-006b / member-but-not-guardian | integration（fixture） | `bun run vitest run tests/integration/authorization-dimensions.test.ts` | fixture 预置「目标 Family 成员」但不是某未成年 Person 的 guardian：`POST /compliance/guardian-consents`（grant）与 revoke 被拒（`NOT_GUARDIAN` 语义），证明 membership 不产生 guardian 权限 |
| FR-007 / Compliance Profile（band × minor_mode × 来源） | integration + database | `bun run vitest run tests/integration/profiles.test.ts tests/db/consent-structure.test.ts` | ADULT → `minor_mode=false`；MINOR_14_17 → `minor_mode=true`；UNDER_14 → `minor_mode=true` 且 guardian 与 consent 版本非空；UNKNOWN → 门禁 BLOCK 且不进入 ADULT 分支；`verified_source` 实际落库且等于该路径允许的来源值（UNDER_14 为 guardian-origin）；`minor_mode` 与 band 不一致的写入被 CHECK 拒绝 |
| FR-012 / FR-015 / 验收最后一组（RLS 与主键） | database | `bun run vitest run tests/db/rls.test.ts` | `pg_class.relrowsecurity=true`、`relforcerowsecurity=true`；`rolbypassrls=false`；owner ≠ app；三个 GUC 全未设时查询 0 行；identity 上下文只返回自身 person；`uuidv7()` 为列默认值 |
| FR-013（事务上下文） | integration | `bun run vitest run tests/integration/rls-transaction.test.ts` | 事务外设置上下文后查询 0 行；`set_family_context` 对非成员抛 42501；连接池复用下上下文不泄漏到下一请求 |
| FR-014 / SC-005（幂等） | integration | `bun run vitest run tests/integration/idempotency.test.ts` | 并发 20 次同 key → 记录数不变；同 key 不同 payload → 409 |
| 幂等表跨账号隔离 | database | `bun run vitest run tests/db/idempotency-rls.test.ts` | `idempotency_keys` 的 `relrowsecurity/relforcerowsecurity = true`；账号 A 的 identity 上下文下 `SELECT count(*)` 只见 A 的行；以 B 的 key 回放 → 0 行且不返回 `response_body`；无 identity 上下文 → 0 行 / 写入被拒 |
| 全部 OpenAPI 合同 | contract | `bun run openapi:check` | OpenAPI 可生成；generated client 无未预期 diff |
| 治理（不修改受保护文件） | governance | `node .specify/scripts/validate-governance.mjs`；`node .specify/scripts/tests/run-governance-tests.mjs`；`git diff --name-only origin/main...HEAD` | 两者 PASS；diff 不含 `Docs/**`、`spec.md`、`.specify/memory/**` |

> 上表命令名是本 Plan 约定的验证入口，实现阶段落地为真实脚本。本 Plan 不预先声称任何命令已运行；tasks.md 必须为每条给出 `[VERIFY:...]` 与可观察结果。

---

## Rollback / Recovery

本 Slice 改变 schema、角色与 policy，需要明确回退路径。

- **代码**：feature branch 未合并前，回退即弃分支；无生产流量。
- **数据库（Stage A 本地 / CI）**：一次性环境，`docker compose down -v` 重建即可。
- **数据库（若已在共享环境应用）**：回退用一份显式 reviewed 的 down migration，顺序为 policy → 函数 / 触发器 → 表（先 `person_compliance_profiles`、`consent_records`、`guardian_consent_requests`，再 `family_members`、`families`、`persons`、`accounts` 等）→ enum → GRANT / 角色。不提供 `DROP DATABASE` 式“回退”。
- **角色**：`xiaoshuyin_app` 的 GRANT 可整体 `REVOKE`，无需删角色；角色删除只在确认无连接后执行。
- **不可逆点**：一旦产生真实家庭数据，consent 证据行**不得**因回退被删除（证据保留优先）。因此共享环境回退只允许在“无真实家庭数据”时执行，并由人工确认。
- **外部副作用**：无（无通知、无文件、无支付、无第三方写操作）。

---

## Complexity Exceptions

无。

本 Plan 未使用任何针对已批准设计的例外：技术栈未扩张、未引入未批准依赖、未引入 RBAC / 角色枚举、未建通用 provenance 平台、未建 Case / Participant 前置抽象、未建 UI。

---

## Open Review Items（非阻塞，需审核确认）

这些是 Plan 在已批准范围内做的具体选择，不是上游语义变更；列出以便审核聚焦。

| # | 事项 | 本 Plan 的选择 | 若不接受的影响 |
|---|---|---|---|
| R-1 | §28.1 未枚举 `POST /families/:id/members`，但 U03 / FR-005 要求建成员能力 | 在 `families/:id/members` 已批准契约面内补齐创建路由 | 需 Owner 指定替代路由；不影响数据模型 |
| R-2 | 同一 Person 只能**拥有**一个 Family（`UNIQUE(created_by_person_id)`） | 采纳；依据 §28.1 只有 `/families/current` 单数语义 + Out of Scope 排除多家庭切换。该约束**只限制“拥有/创建”**，不限制一个 Person 作为 member 属于多个 Family（多对多仍由 `family_members` 表达，并在 fixture 级验收） | 若允许多个自有家庭，需先定义“当前家庭”选择规则，否则数据不可达 |
| R-3 | 来源枚举取 §2.2 全 8 类，本 Slice 只允许写入 4 类 | 采纳，避免后续无意义 migration | 若要求 enum 只含 4 值，需新增一次 migration |
| R-4 | `accounts` 不加 RLS（`idempotency_keys` 已改为身份级 RLS，不再属此项） | 采纳；登录必须无任何上下文可用，用窄仓储 + 测试约束补偿 | 若要求 `accounts` 也 RLS，需设计登录前的账号上下文机制（会与 code2session 前置校验冲突） |
| R-5 | `business_audit_events` 进入本 Slice（spec 撤回条款明确含 audit） | 采纳，只为本 Slice 事件建最小列 | 若不建，FR-010“留痕”只能靠 consent 版本链，撤回审计缺失 |
| R-6 | 对外统一 403 + 零字段泄漏（A-2 仍未决） | 采纳；映射集中在 `toHttpError()` | Owner 若改 404 掩盖，只改一处，不触数据模型 |
| R-7 | §28.2 的 `POST /consents` 本 Slice 不实现 | 采纳；通用同意入口属「完整 Consent 平台」，out of scope；监护人同意只保留单一写入路径 | 若要求实现，需先定义 purpose/scope 矩阵，否则等于提前做完整 Consent 平台 |
| R-8 | `app.create_family()` 是唯一不校验 membership 的上下文入口（新家庭尚无 membership） | 采纳；INSERT 被 `created_by_person_id = app_person_id()` 锁死，且同事务必须插 membership，否则后续 profile 写入失败 | 若要彻底消除该入口，需要先有 membership 再建 family，会引入循环依赖 |

**Residual blockers: NONE。**

未发现必须回到 `Docs/**` 修订才能继续的冲突。上文 R-1—R-8 均为 Plan 层可逆选择，均有明确回退路径。

**本轮已撤销的旧条目**（记录以保持追溯，不再是 Open Item）：

- 原 R-4 `RELATION_DESCRIPTOR`：为证明 provenance 而新增无正式需求的资料字段，已按审核意见删除，且不设替代字段。
- 原 R-7（创建者 Person 的建立时机）：已撤销；Person 由首次登录建立，符合 spec US1「登录时建立 Account 与对应 Person」。
- 原 R-5 中 `idempotency_keys` 无 RLS：已改为身份级 RLS。
