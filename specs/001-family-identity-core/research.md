# Phase 0 Research — 001-family-identity-core

**Feature**: `specs/001-family-identity-core/spec.md`
**Date**: 2026-11-04
**Scope**: 只研究本 Slice 的实现未知项。产品语义不在本文重新讨论；任何与产品相关的疑点一律回到 `Docs/V1产品需求.md` / `Docs/V1技术设计.md` 或列为 Open Review Item。

本文的每一项都是 **Decision / Rationale / Alternatives considered** 三段式。凡涉及“上游已定”的，只引用不复述。

---

## R-01 RLS 下的“actor 是否属于该家庭”如何被数据库再确认

**Decision**

`family_members` 的 policy 只引用 GUC（`family_id = app_family_id() OR person_id = app_person_id()`），不引用自身或其它表；跨家庭成员资格由**家庭上下文入口** `app.set_family_context(family_id, person_id, purpose)` 在设置 GUC 之后用 `EXISTS(family_members …)` 校验，不成立即 `RAISE EXCEPTION`（SQLSTATE 42501）。另有三个窄入口：`app.set_account_context(account, purpose)`（首次登录建 Person 前）、`app.set_identity_context(account, purpose)`（无 family 上下文的自助读与幂等键）、`app.create_family(...)`（成立家庭时 membership 尚不存在）。

**Rationale**

- §9.1 要求 RLS 作为“防止查询遗漏导致跨家庭泄漏的第二道硬防线”，同时要求 `family_members` 上的策略“以当前 `family_id` 与 actor 在该家庭的 membership 为准”。
- 若把 `EXISTS(SELECT … FROM family_members …)` 直接写进 `family_members` 自己的 policy，PostgreSQL 会报 `infinite recursion detected in policy for relation "family_members"`。这是 RLS 的已知限制，不是实现偏好。
- 用 `SECURITY DEFINER` + `BYPASSRLS` 的辅助函数可以绕过递归，但那需要一个拥有 `BYPASSRLS` 的角色，直接违反 §9.1 对运行时角色的要求，也扩大了提权面。
- 把校验放在 `set_family_context()` 里，效果等价且更强：**上下文根本无法在非成员身份下建立**，后续任何查询都拿不到跨家庭行。它不是“应用层再检查一次”，而是数据库拒绝进入该上下文。

**Alternatives considered**

1. `family_members` policy 自引用 EXISTS → 递归错误，否决。
2. `SECURITY DEFINER` + `BYPASSRLS` 辅助函数 → 违反 NOBYPASSRLS 基线，否决。
3. 只在 `authorize()` 里判定，RLS 仅按 `family_id` 过滤 → 若应用层漏判，任意 `family_id` 都能读到该家庭全部行；比本方案弱，否决。
4. 用 `SET ROLE` 或临时视图 → 增加连接池状态复杂度，且 §9.1 明确要求参数化 `set_config(..., true)`，否决。
5. 所有 person 作用域策略只依赖 membership → `GET /me` 在首次登录（尚无 membership）时被挡成 0 行，把合法自助读误杀；因此补充 `app.account_id` / `app.person_id` 的列比对分支（只读），见 plan D-5.4。

---

## R-02 Person 的建立时机与 RLS / 外键下的插入顺序

**Decision**

Person 在**首次微信登录**时建立（`POST /auth/wechat` 同一事务内建 Account + 绑定该账号的 Person），`POST /families` 复用该 Person 不再新建。三条写入路径的顺序固定：

| 命令 | 顺序 |
|---|---|
| `POST /auth/wechat`（首次） | Account → `set_account_context` → Person（`account_id` 非空） |
| `POST /families` | Person 已存在 → `create_family` → membership → profile(ADULT) → values → audit |
| `POST /families/:id/members` | membership → Person（`account_id IS NULL`）→ 绑定 consent → profile → values → audit |

`family_members.person_id` 声明为 `DEFERRABLE INITIALLY DEFERRED`（提交时校验）；`families.created_by_person_id` 与 `consent_records.bound_person_id` 保持即时校验。

**Rationale**

- spec US1 原文是“微信登录时系统建立 Account 与对应 Person”，因此 Person 必须早于任何 Family 存在；把 Person 建在 `POST /families` 会直接违反该验收。
- 登录时 Person 的 `account_id` 非空，正好命中 `persons.WITH CHECK` 的唯一 self 分支 `account_id = app_account_id()`，无需 membership 即可写入。
- 建家庭时 `families.created_by_person_id` 是即时外键，Person 已存在，因此无需延迟该外键；profile 的 `WITH CHECK` 依赖 membership，所以 membership 必须先于 profile。
- 建成员时成员的 `account_id IS NULL`，无法走 self 分支，只能先插 membership 再插 Person；此时 Person 外键必须可延迟。
- 三条顺序各有唯一合理解，强行统一会让某条命令要么放弃 RLS 校验、要么放弃即时外键。
- 可延迟外键是 PostgreSQL 标准能力，不引入依赖、不改变表语义；`uuidv7()` 仍是唯一主键来源（§7.0）。
- 三条路径都不会留下“无 membership 的孤儿 Person”：建家庭要求 membership 先于 profile，建成员本身就是 membership 先行。

**Alternatives considered**

1. 登录只建 Account、在 `POST /families` 建 Person → 与 spec US1 冲突，且 `GET /me` 在首次登录后返回 null person，否决（本轮修正项）。
2. 统一“先 Person 后 membership” + 宽松 `WITH CHECK` → 可产生不可见孤儿行，否决。
3. 统一“先 membership 后 Person” → 登录时尚无 Family，无法先插 membership，否决。
4. 单条 CTE 同时插入两张表 → `WITH CHECK` 仍按语句顺序求值，且 `INSERT … RETURNING` 与 RLS 组合可读性差，否决。
5. 用 `BEFORE INSERT` 触发器代为插入 membership → 触发器内插入同样受 RLS 约束，且把业务写入藏进触发器，否决。
6. 给 `persons` 加 `family_id` → 直接违反 §7.1“不得单家庭绑定”，否决。

---

## R-03 UNDER_14 最小同意状态放在哪里

**Decision**

新建 `guardian_consent_requests` 表，只存：监护人 Person、`declared_age_band`（恒为 `UNDER_14`）、`notice_version` / `notice_hash`、`status`、`expires_at`、`family_id`，以及仅在“对已存在未成年人重新同意”时使用的 `subject_person_id`。**首次 onboarding 时 `subject_person_id` 为 NULL，且表中不存在任何孩子资料列**（姓名 / 生日 / 称呼 / 关系 / Assessment / Case / Digital Use / AI 数据）。表 id 同时作为客户端持有的不透明绑定 token。

**Rationale**

- §7.7A 明确把该表达交给 Plan：“该最小状态的技术表达（表、键、token / session 或等价形式）由后续实现 Plan 决定；本文不预先建表”。
- 需要“表”而不是纯客户端 token，因为：① 告知版本与 hash 必须由服务端留存，否则无法证明“告知了什么”；② 过期与状态必须服务端可判定；③ 绑定必须一次性且可审计。
- **PII 边界要分情形说**：首次同意的情形下不可能也不允许出现孩子资料，否则它就成了“正式 Person 档案”，FR-008(a) 立刻被违反；但重新同意必须能指向那个已存在的未成年人，因此 `subject_person_id` 是“完成重新同意所严格必要的关联”，不是资料载体。绝对化表述（“本表没有任何 child identifier 列”）会与这一列自相矛盾，故不使用。
- `expires_at = created_at + 24h` 且无后台清理任务：过期在读取时判定（`status='PENDING' AND now() > expires_at` → 视为 `EXPIRED`），不引入 pg-boss（Phase 1 本 Slice 无异步）。

**Alternatives considered**

1. 无状态签名 token（客户端持有全部状态）→ 无法证明告知版本已留存、无法做一次性绑定、无法审计，否决。
2. 先用 `age_band='UNKNOWN'` 建正式 Person，取得同意后再改 `UNDER_14` → 正是 Docs v3.3 / v3.8 否掉的“先建档再补同意”，且会绕过 profile CHECK，否决。
3. 复用 `consent_records` 存 pending 行 → 会把“未成立”与“已成立”混在同一证据表，削弱证据强度，否决。
4. 建 `consent_staging` + `consent_sessions` 两张表 → 超出“严格必要”，且 §7.7A 只允许“最小状态”，否决。

---

## R-04 同意证据如何不可抵赖

**Decision**

`consent_records` 的业务列（guardian / purpose / decision / version / notice / evidence / decided_at / supersedes / onboarding_request_id）**不可更新**；`(bound_person_id, bound_at)` 作为一对只允许 `(NULL,NULL) → (personId, serverTimestamp)` 一次，此后两者都不可变；由 `BEFORE UPDATE` 触发器 + `CHECK` 共同强制。撤回 = 追加 `decision='REVOKED'` 的新版本行，且该行 `onboarding_request_id IS NULL`。

**Rationale**

- V1-C39 要求“可验证的监护人同意证据”。可验证的前提是证据本身不可被静默改写。
- 撤回必须是新版本（FR-010），不能把原 GRANTED 行改成 REVOKED——否则“曾经同意过”这一事实就消失了。
- 绑定是必要例外：同意成立时孩子尚不存在（consent-first），只能事后把同意关联到 Person；把绑定限制为“成对写入、只能发生一次、不可改绑、不可改时间”即可在不改写决策的前提下完成关联。
- `bound_at` 必须与 `bound_person_id` 一起锁定：只保护 person 的话，事后改时间仍能伪造“何时绑定”的证据；只靠 `CHECK ((person IS NULL) = (at IS NULL))` 也不够，因为它对“两个都已非空后单独改时间”没有约束力。
- `onboarding_request_id` 必须可空且只对非 NULL 建唯一索引：撤回不是新的 onboarding，既不能复用原 request（撞唯一），也不能强行要求 request（NOT NULL violation）；否则撤回路径不可执行。
- 触发器而不是仅靠仓储层：证据完整性属于数据不变量，不应依赖某一条代码路径的自觉（§III 确定性、§VII 数据边界不可绕过）。

**Alternatives considered**

1. 全表 append-only，绑定也走新行 → 会产生“未绑定同意”与“绑定副本”两行，语义重复且版本号含义混乱，否决。
2. 允许 UPDATE 任意列 + 应用层保证 → 无法阻止直接 SQL 或未来 bug，否决。
3. `onboarding_request_id` 保持 `NOT NULL UNIQUE`，撤回时复用原 request → 第二条行撞唯一索引，撤回不可执行，否决。
4. 撤回时把原 GRANTED 行改成 REVOKED（不新增行）→ 丢失“曾经同意过”的事实，违反 FR-010，否决。
3. 用事件溯源（consent_events + 投影表）→ 属通用平台，spec 明确排除，否决。

---

## R-05 Account ↔ Person 1:1 的落点

**Decision**

只保留单向列 `persons.account_id uuid NULL UNIQUE REFERENCES accounts(id)`，不设 `accounts.person_id`。

**Rationale**

- 单列 + `UNIQUE` 同时约束两个方向：列本身保证 Person 最多一个 Account；唯一索引保证 Account 最多被一个 Person 引用。
- 双向列（两边各放一个 FK）会产生两个可独立写入的事实源，需要额外约束或触发器才能防止 A→B 与 B→A 不一致。
- 不构成循环外键，migration 顺序简单。
- 与登录流程契合：同一事务内先插 Account，再插带 `account_id` 的 Person，一次写入即可满足两个方向的约束，无需回填。

**Alternatives considered**

1. 双向 FK → 一致性靠约定，否决。
2. 独立 `account_person_links` 关联表 → 对 1:1 属过度建模，且 `UNIQUE` 双列仍需额外约束，否决。
3. 把 `person_id` 放 `accounts` → 需要先建 Account 再 UPDATE 回填 person_id（或先建 Person 再建 Account），多一条可失败路径，且构成与 `persons.created_by_account_id` 的循环外键；单列方案不需要，否决。

---

## R-06 管理权限放在哪里（不引入 RBAC）

**Decision**

`families.created_by_person_id` 是管理主体的唯一来源，`isFamilyManager(family, actorPersonId)` 是纯函数；`family_members` 不含任何授权列。

**Rationale**

- §7.1 明确 `family_members` 只表达“Person 属于哪个 Family”，并明确不引入 guardian/non-guardian 枚举与通用角色 DSL。
- §1.5 / §9 把管理主体定义为“创建 Family 的 adult”，这本身就是 Family 聚合的属性，而不是成员属性。
- 纯函数便于穷举测试（每个场景一次断言），也让 `isManager` 明确是投影而非持久状态。

**Alternatives considered**

1. `family_members.is_creator boolean` → 授权属性进成员行，等于绕道实现角色，否决。
2. `families.manager_membership_id` → 引入第二条 membership 事实源，且删除/重建成员时会悬空，否决。
3. 独立 `family_managers` 表 → 等价于角色表（多管理员），spec 明确排除，否决。

---

## R-07 Per-value provenance 的物理形态

**Decision**

单表 `person_profile_values`，追加写；同 `(person, attribute, source_kind)` 的新值把旧值置 `SUPERSEDED`，不同 `source_kind` 并存为 `RECORDED`。

**Rationale**

- §2.2 要求“谁提供 / 来源类型 / 记录时间 / 是否仍有效 / 是否冲突”，这些字段天然属于“一个资料值”，不属于 Person。
- 一条规则同时满足两个看似冲突的测试要求：同源替换（避免无限堆积同一来源的历史噪声）与异源并存（保留来源冲突）。若不做区分，要么冲突被覆盖（违反 §5 不变量 4），要么永远无法表达“当前值”。
- 不引入 Statement / Observation / Fact / Assertion：那会立刻把 Case 与证据体系拉进本 Slice。

**Alternatives considered**

1. `persons` 上 `source_kind` 单列 → spec 明令禁止，否决。
2. JSONB 列 `profile_values` 存在 `persons` 上 → 无法对单个资料值做约束、索引与来源校验；且来源仍会被写成一个整体，否决。
3. 直接复用 §7.2 的 `assertions` / `observations` → 属 Case 证据体系，本 Slice 明确排除，否决。
4. 每次写入无条件 `SUPERSEDED` 旧值 → 冲突被覆盖，违反 §5 不变量 4，否决。

---

## R-08 age_band 的来源放在哪里

**Decision**

age_band 只存 `person_compliance_profiles.age_band`，来源存同行 `verified_source`（复用 §2.2 来源枚举）；`person_profile_values.attribute` 的 enum 不含 `AGE_BAND`。

**Rationale**

- §7.7A 已把 age_band 与 `verified_source` 固定在同一行。再在另一张表存一份 age_band，等于两个事实源，必然漂移。
- 让 `person_profile_values` 的 enum 不含 `AGE_BAND`，是从结构上排除第二载体；测试可直接断言 enum 取值集合。
- 仍满足 FR-003：不同资料（称呼 / 关系描述 / 年龄段）各有独立来源。

**Alternatives considered**

1. age_band 也进 `person_profile_values`，profile 引用当前值行 → 增加一层间接，仍需同步，否决。
2. 只留 `person_profile_values`，profile 不存 age_band → 违反 §7.7A 字段定义，否决。

---

## R-09 登出必须真实生效，但不引入 JWT 库

**Decision**

`POST /auth/logout` 将 `accounts.session_epoch` 加 1；session token 是 `base64url(payload) + "." + HMAC-SHA256(secret, payload)`，payload 含 `accountId` / `epoch` / `exp`。epoch 不匹配即 401。

**Rationale**

- 若用无状态 JWT 且无吊销机制，登出只是客户端丢 token，服务端仍接受旧 token —— 那是伪造能力，违反 §VI / §VII。
- 引入 `jsonwebtoken` / `jose` 属未批准依赖（§2 未列），按 AGENTS.md 需上游审批；而本需求只需“自签 + 校验 + 可吊销”，`node:crypto` 足够。
- 一个整数列代替 `sessions` 表：零新表、零清理任务、语义清晰（登出 = 使该账号所有已签发 token 失效）。

**Alternatives considered**

1. 第三方 JWT 库 → 未批准依赖，需走审批，否决（本 Slice）。
2. `account_sessions` 表 → 需要清理、需要设备维度语义；本 Slice 无多设备需求，属过度建模，否决。
3. 不实现登出 → 与 §28.1 端点清单冲突，否决。

---

## R-10 幂等在并发下的正确性与隔离

**Decision**

`INSERT … ON CONFLICT (actor_account_id, command_type, idempotency_key) DO NOTHING RETURNING id`，未插入则 `SELECT … FOR SHARE` 既有行并比对 `request_hash`。`idempotency_keys` 同时启用 `ENABLE` + `FORCE` RLS，策略 `actor_account_id = app_account_id()`；lookup / insert / replay 全部在已建立 identity 上下文的事务内执行。

**Rationale**

- PostgreSQL 的唯一索引在并发插入时会阻塞后来者，直到先提交/回滚。因此“未插入”意味着**前者已提交**，此时读到的行是完整行（含 response 快照），不需要轮询或等待。
- 不需要 `outbox`、不需要分布式锁、不需要进程内缓存（§4.0A 禁止把进程内锁当业务真相）。
- 同 key 不同 payload 用 `request_hash` 判定，满足 §8.5 的 409 要求，而不是静默返回旧结果。
- **为什么必须加 RLS**：该表的 `response_body` 是完整响应快照，可能含 Family / Person / Member / Consent 字段。若只靠“仓储记得写 `WHERE actor_account_id`”，任何一次遗漏或新代码路径都会造成跨账号数据回放。GUC 型策略让这种遗漏变成 0 行，而不是泄漏。
- 为什么不是家庭级 RLS：幂等键属于**账号**动作（§8.5 的 `actor_id`），创建家庭时 family 尚不存在，家庭级策略会让首次写入无法完成。

**Alternatives considered**

1. 先查后插 → 并发窗口内会双写，否决。
2. `pg_advisory_lock` → 额外锁协议，且需连接级管理，否决。
3. 只靠业务唯一约束（如 `UNIQUE(created_by_person_id)`）→ 能防重复实体，但无法返回“原结果”，也无法区分“同 key 不同 payload”，否决。
4. 不加 RLS，仅靠仓储自律 → 一次漏写 WHERE 即跨账号回放，否决（本轮修正项）。
5. 加家庭级 RLS → 建家庭时无 family 上下文，首次写入不可能完成，否决。

---

## R-11 测试数据库策略（不引入 testcontainers）

**Decision**

用 §4 Stage A 已批准的 Docker Compose PostgreSQL 18；测试通过 `DATABASE_URL` 连接，每个测试文件在独立 schema 或独立数据库上跑 migration，结束后回滚/重建。

**Rationale**

- `testcontainers` 是未批准依赖；而 §4 已把 Docker Compose + PostgreSQL 18 定为 Stage A 基线，复用它零新增依赖。
- RLS / 角色 / `pg_class` 断言必须在**真实 PostgreSQL** 上跑，SQLite 或 mock 无法证明任何一条。
- 角色 bootstrap 需要超级用户：Compose init 脚本以 `POSTGRES_USER` 创建 `xiaoshuyin_migrator` / `xiaoshuyin_app`，CI 用同一脚本。

**Alternatives considered**

1. `testcontainers` → 未批准依赖，否决。
2. PGlite / SQLite → 无 RLS、无 `FORCE`、无 role，无法产出验收证据，否决。
3. 共享长生命周期数据库 + 事务回滚隔离 → 角色与 DDL 断言会互相污染；每个测试文件独立库更可靠（成本可接受，本地 PG 实例）。

---

## R-12 对外的“不存在 / 无权”语义（spec A-2）

**Decision**

统一 403 + 零字段泄漏；映射集中在 `toHttpError(reason)` 一处。

**Rationale**

- spec 明确 A-2 未决：“正式文档只要求失败，未规定 NOT_FOUND 与 DENIED 是否对外一致”。
- 选择 403 而不是 404：本 Slice 的拒绝原因需要可诊断（`NOT_FAMILY_MANAGER` 与 `NOT_FAMILY_MEMBER` 对客户端恢复路径不同），同时两者都**不携带目标对象字段**，因此不存在数据泄漏。
- 把映射收敛到一个函数，使 Owner 后续改判为 404 掩盖时是单点改动，不会污染业务代码。

**Alternatives considered**

1. 全部 404 → 掩盖存在性，但丢失可诊断性，且“无权但资源存在”会误导客户端重试，否决（保留为可选）。
2. 存在 → 403，不存在 → 404 → 形成存在性预言机，泄漏“某 family_id 是否存在”，否决。

---

## R-13 为什么把 `business_audit_events` 拉进本 Slice

**Decision**

只建最小列（`id / family_id / actor_account_id / event_type / resource_type / resource_id / metadata / occurred_at`），只记录本 Slice 产生的 6 类事件。

**Rationale**

- spec 的 Edge 条款写明撤回要实现“新 Consent version + 后续访问与处理禁止 + **audit**”，即 audit 在本 Slice 范围内。
- §7.9 已把 `business_audit_events` 列在 Phase 1 表组，本 Slice 只是提前落最小子集，不改变表的长期职责。
- 若不做，撤回只能靠 consent 版本链证明“发生过撤回”，但无法回答“谁在什么时候通过哪个入口撤回”，证据链不完整。

**Alternatives considered**

1. 不建，靠 consent 版本链 → 证据不完整，否决。
2. 建完整审计平台（含 case_events）→ Case 不在本 Slice，否决。

---

## R-14 微信登录的真实性边界

**Decision**

`WechatAuthProvider` 端口 + 测试用确定性 fake；真实 `code2session` 调用在本 Slice 标记 **NOT VERIFIED**。

**Rationale**

- §40 Platform 门槛把“微信登录”列为上线前真实平台验证项，不属于 Phase 1 第一刀的完成条件。
- 但 §28.1 的端点合同必须成立，否则后续客户端无法对接。因此实现端口与契约，验证“契约正确”，不宣称“平台已验证”。
- 这与 §VI“不得用信心替代证据”一致：明确写出哪一部分没有证据。

**Alternatives considered**

1. 真实调用微信接口 → 需要 appid/secret 与真实用户 code，本 Slice 无法在 CI 复现，且会把 secret 引入仓库风险，否决。
2. 不做登录端 → FR-002 无法满足，否决。

---

## 未解决项

无 NEEDS CLARIFICATION 残留。所有 Plan 层判断已收敛为 `plan.md` 的 D-1—D-6 与 Open Review Items R-1—R-8；无上游冲突需要回到 `Docs/**` 修订。
