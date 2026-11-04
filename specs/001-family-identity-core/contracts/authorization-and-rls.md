# Contract — Authorization, RLS, Roles, Transaction Context

**Slice**: 001-family-identity-core
**Upstream**: `Docs/V1技术设计.md` §9、§9.1、§4.3、§40「Authorization / Data Rights」；`Docs/V1产品需求.md` §1.5、§18.1、V1-C21
**Related**: `plan.md` D-2 / D-5；`data-model.md` §13

---

## 1. 两个互相独立的判定输入

| 维度 | 读取位置 | 判定什么 | 明确禁止 |
|---|---|---|---|
| **Family membership** | `family_members(family_id, person_id)` | 能否读写该 Family 作用域的数据；能否建立 `app.family_id` 事务上下文 | 不得用来判断“谁是某未成年人的 guardian” |
| **Compliance guardian relationship** | `person_compliance_profiles.guardian_person_id` | 某未成年人的 guardian 是谁；同意 / 撤回的主体资格 | 不得替代 membership；不构成家庭访问权限 |

二者**不合并、不互相推导、不落成同一个字段**（FR-006）。`family_members` 无角色列；`persons` 无 guardian 列；`families` 只有 `created_by_person_id`（管理主体），它不是 guardian。

---

## 2. `authorize()` 契约

### 2.1 输入（形状 = §9）

```ts
type AuthorizeInput = {
  actor: { accountId: string; personId: string };
  product: 'V1';
  family: { familyId: string } | null;
  case: null;                          // 本 Slice 未实现该维度
  resource:
    | { type: 'SELF'; personId: string }
    | { type: 'FAMILY'; familyId: string }
    | { type: 'MEMBER'; familyId: string; personId: string }
    | { type: 'CONSENT'; familyId: string; consentId?: string };
  action: Action;
  purpose: Purpose;
};
```

`family.familyId` / `resource.*.familyId` / `personId` 全部来自请求，因此**都是待验证参数**（§9）：ID 存在不等于有权访问。

### 2.2 输出

```ts
type AuthorizeResult =
  | { decision: 'ALLOW'; basis: { membership: true; manager: boolean; purpose: Purpose } }
  | { decision: 'DENY'; reason: DenyReason };
```

`basis.manager` 是即时计算结果（`families.created_by_person_id == actor.personId`），不是持久角色。

### 2.3 动作表（本 Slice 封闭集合）

| Action | 最少要求 | 额外要求 |
|---|---|---|
| `IDENTITY_SELF_READ` | 已认证 actor | `resource.type = SELF` 且 `personId = actor.personId` |
| `FAMILY_CREATE` | 已认证 actor + 已有 Person | `profile.age_band = ADULT` |
| `FAMILY_READ` | membership | — |
| `MEMBER_CREATE` | membership + **manager** | — |
| `MEMBER_UPDATE` | membership + **manager** | 目标 person 属于该 family |
| `GUARDIAN_CONSENT_REQUEST` | membership + **manager** | actor 自身 `age_band = ADULT` |
| `GUARDIAN_CONSENT_GRANT` | membership | actor 是该请求的 `guardian_person_id` |
| `GUARDIAN_CONSENT_REVOKE` | membership | actor 等于该 consent 的 `guardian_person_id` |
| `MINOR_PROCESSING` | — | 由 `assertMinorProcessingAllowed()` 判定（见 `consent-onboarding.md`） |

### 2.4 DenyReason（封闭集合）

```text
NO_ACTOR                未认证
UNSUPPORTED_DIMENSION   case !== null（Case participation 属未来 Slice）
UNSUPPORTED_ACTION      action 不在动作表
UNSUPPORTED_PURPOSE     purpose 不在本 Slice 枚举
FAMILY_CONTEXT_REQUIRED 家庭级 action 但 family 为 null
NOT_FAMILY_MEMBER       membership 不存在
NOT_FAMILY_MANAGER      family.created_by_person_id != actor.personId
FAMILY_MANAGER_MUST_BE_ADULT  actor 的 age_band != ADULT
AGE_BAND_UNKNOWN        依赖年龄的判定遇到 UNKNOWN
GUARDIAN_CONSENT_REQUIRED / GUARDIAN_CONSENT_REVOKED
AUTHORIZATION_ERROR     内部异常（兜底，永不放行）
```

### 2.5 fail-closed 规则（强制）

1. `case !== null` → `UNSUPPORTED_DIMENSION`。**不得**接受后忽略。
2. 未注册 action / purpose → 拒绝。
3. 判定过程中抛出的任何异常 → `AUTHORIZATION_ERROR`，**不得**冒泡成 500 后被上层当作放行。
4. 默认分支必须是拒绝；`switch` 必须有 `default: DENY`。
5. 判定结果只允许 `ALLOW` 携带 `basis.manager`；下游不得自行重算 manager。

### 2.6 Purpose（本 Slice 最小集）

```text
SELF_IDENTITY      读取自己的身份 / profile / 同意列表
FAMILY_MANAGEMENT  家庭级读写、成员管理
GUARDIAN_CONSENT   同意 onboarding / 授予 / 撤回
```

完整 purpose/scope 矩阵属 §29.5 完整 Consent 平台，不在本 Slice。未知 purpose 一律拒绝。

---

## 3. 对外状态码映射（单点）

```ts
toHttpError(reason): { status, code }
```

| reason | status | code |
|---|---|---|
| `NO_ACTOR` | 401 | `UNAUTHENTICATED` |
| `NOT_FAMILY_MEMBER` | 403 | `NOT_FAMILY_MEMBER` |
| `NOT_FAMILY_MANAGER` | 403 | `NOT_FAMILY_MANAGER` |
| `FAMILY_MANAGER_MUST_BE_ADULT` | 403 | `FAMILY_MANAGER_MUST_BE_ADULT` |
| `AGE_BAND_UNKNOWN` | 403 | `AGE_BAND_UNKNOWN` |
| `GUARDIAN_CONSENT_REQUIRED` | 403 | `GUARDIAN_CONSENT_REQUIRED` |
| `GUARDIAN_CONSENT_REVOKED` | 403 | `GUARDIAN_CONSENT_REVOKED` |
| 其它 `DENY` | 403 | `FORBIDDEN` |
| 幂等 payload 不一致 | 409 | `IDEMPOTENCY_PAYLOAD_MISMATCH` |
| Zod 校验失败 | 422 | `VALIDATION_ERROR` |

**约束**：403 响应体**不得**包含目标对象的任何字段（无 `id`、无 `name`、无 `family_id` 回显）。不存在与无权对外表现一致；spec A-2 的最终语义仍归 Owner，本映射是唯一改动点。

---

## 4. RLS 契约

### 4.1 覆盖范围

| 表 | RLS | `USING`（读） | `WITH CHECK`（写） |
|---|---|---|---|
| `families` | ENABLE + FORCE | `id = app_family_id()` **OR** actor 已是该家庭成员 | `id = app_family_id()` AND `created_by_person_id = app_person_id()` |
| `family_members` | ENABLE + FORCE | `family_id = app_family_id()` **OR** `person_id = app_person_id()` | `family_id = app_family_id()` |
| `guardian_consent_requests` | ENABLE + FORCE | `family_id = app_family_id()` | 同左 |
| `consent_records` | ENABLE + FORCE | `family_id = app_family_id()` | 同左 |
| `business_audit_events` | ENABLE + FORCE | `family_id = app_family_id()` | 同左 |
| `persons` | ENABLE + FORCE | `account_id = app_account_id()` **OR** `id = app_person_id()` **OR** membership | `account_id = app_account_id()` **OR** membership |
| `person_compliance_profiles` | ENABLE + FORCE | `person_id = app_person_id()` **OR** membership | membership |
| `person_profile_values` | ENABLE + FORCE | 同上 | membership |
| `accounts` | 无 | 非家庭作用域（见 §4.5） | — |
| `idempotency_keys` | 无 | 非家庭作用域（见 §4.5） | — |

`membership` = `EXISTS (SELECT 1 FROM family_members fm WHERE fm.person_id = <本表主体> AND fm.family_id = app_family_id())`。

**为什么需要 self 分支**：`GET /me`、`GET /compliance/profile`、`GET /families/current` 必须在“尚未建立 family 上下文”时读到自己的数据。只有 membership 一个分支时，首次登录后这些合法自助读会被 RLS 挡成 0 行——那是误杀，不是隔离。self 分支是**列与已验签身份的比对**（`account_id = app_account_id()`、`id = app_person_id()`），不是应用层自证。

**写入的 self 分支只有一个**：`persons.WITH CHECK` 允许 `account_id = app_account_id()`，即只能创建绑定到当前账号的自己的 Person。它不能创建 `account_id IS NULL` 的成员（必须走 membership 分支），也不能把 Person 绑到别人的账号。`person_compliance_profiles` / `person_profile_values` / `family_members` 的 `WITH CHECK` 仍只认 membership 与 family 上下文——self 上下文对它们只读。

**两条插入顺序**（各有原因，不能统一）：

| 命令 | 顺序 | 原因 |
|---|---|---|
| `POST /families` | Person（自己）→ Family → membership → profile | `families.created_by_person_id` 是即时外键 |
| `POST /families/:id/members` | membership → Person（无账号）→ profile | 成员 `account_id IS NULL`，无法走 self 分支 |

因此 `family_members.person_id` 为 `DEFERRABLE INITIALLY DEFERRED`，`families.created_by_person_id` 为即时校验。

### 4.2 三条不可违反的性质

1. **无任何上下文即空集**：三个 GUC 全未设置时所有谓词求值为 `NULL` → 0 行。默认拒绝，不是默认放行。
2. **无自引用递归**：`family_members` 的 `USING` 只引用 GUC，不引用自身；`families` 引用 `family_members`，反向不存在。任何把 `family_members` 写进自身 policy 的写法都会触发 `infinite recursion detected in policy`，属禁止实现。
3. **`app.family_id` 是请求的目标家庭，不由 `app.person_id` 反推**：多 Family Person 在 fixture 下同时拥有两条 membership，两条互不共享上下文（spec 场景 11、Edge「多 Family 上下文」）。

### 4.3 上下文建立（三个入口）

```text
A. withIdentityTransaction({ accountId, purpose })
   BEGIN → app.set_identity_context(accountId, purpose) → fn → COMMIT
   用途：GET /me、GET /compliance/profile、登录后解析 self person
   设置：app.account_id、app.purpose（命中时另设 app.person_id）

B. withRlsTransaction({ familyId, accountId, personId, purpose })
   BEGIN → app.set_identity_context(accountId, purpose)
         → app.set_family_context(familyId, personId, purpose)   ← 校验 membership
         → fn → COMMIT
   用途：全部家庭级读写（除成立家庭本身）

C. withFamilyCreationTransaction({ accountId, personId, newFamilyId, displayName })
   BEGIN → app.set_identity_context(accountId, 'FAMILY_MANAGEMENT')
         → app.create_family(newFamilyId, personId, displayName)  ← 设上下文 + 插 families
         → fn  ← 插 membership → person → profile → values → audit
         → COMMIT
   用途：仅 POST /families
```

- `set_family_context` 的 membership 校验发生在 `set_config` **之后**，因此该 EXISTS 查询本身受 RLS 约束，只能看到目标家庭的行。
- `create_family` 是唯一没有 membership 前置的入口（新家庭尚无 membership）。它被 `families.WITH CHECK` 锁死为“只能给自己建家庭”，且同事务内必须插 membership，否则后续写入全部失败。记入 `plan.md` R-10。
- 禁止：事务外 `SET LOCAL` 后从连接池查询；`sql.raw` 拼接 family/person/purpose；在事务外缓存或复用上下文；连接用完不重置（依赖 `set_config(..., true)` 的事务级作用域，天然随事务结束失效）。

**信任边界（明确记录，不夸大）**：`set_config` 是内置函数，任何持有 app 角色的连接都能直接调用。GUC 型 RLS 的前提是“应用在 `authorize()` 之后诚实设置上下文”；它防的是查询遗漏，不是恶意应用。§9.1 的定位原文即“防止查询遗漏导致跨家庭泄漏的第二道硬防线”。

### 4.4 需要“先解析当前家庭”的端点

`/families/current`、`/consents`、`/compliance/guardian-consents/requests` 的路径里没有 `family_id`（§28.1 / §28.2 的契约就是这样），因此单事务内分两步：

```text
1. set_identity_context(accountId, 'FAMILY_MANAGEMENT' | 'GUARDIAN_CONSENT')
2. SELECT family_id FROM family_members WHERE person_id = app_person_id()   -- self 分支可见
   └ 0 行 → 403 NOT_FAMILY_MEMBER
   └ 多行 → V1 不提供多家庭切换，取 created_by_person_id = actor 的那一个；
            若仍多行则视为数据异常，返回 409 而不是猜测
3. authorize()（含 manager 判定）
4. set_family_context(familyId, personId, purpose)
5. 读取目标数据
```

第 2 步只暴露 actor **自己的** membership 行（策略 `person_id = app_person_id()`），不泄漏其他成员或其他家庭。多家庭场景在 V1 只存在于 fixture（spec 场景 11），产品层不提供选择能力，因此“多行”分支必须是显式失败，不能静默取第一个。

### 4.5 两张无 RLS 的表

`accounts` 与 `idempotency_keys` 不是家庭作用域对象，且登录必须在**无家庭上下文**时可用（否则 `POST /auth/wechat` 无法读 Account）。补偿控制：

- `accounts` 只允许经 `auth` 模块的窄查询访问（`WHERE wechat_openid = $1` / `WHERE id = $1`），无通用列表查询。
- `idempotency_keys` 只按 `(actor_account_id, command_type, idempotency_key)` 精确读写。
- 集成测试断言：任何家庭级响应都不包含 `wechat_openid` 或跨账号数据。
- 该边界记入 `plan.md` Open Review Item R-5，供审核显式接受或否决。

---

## 5. 角色与验证输出

```text
xiaoshuyin_migrator  table owner / DDL only / 非 runtime
xiaoshuyin_app       非 owner / NOBYPASSRLS / 最小 DML
```

必须由真实查询产出以下证据（不接受文档声明）：

| # | 查询 | 期望 |
|---|---|---|
| E-1 | `SELECT rolbypassrls FROM pg_roles WHERE rolname='xiaoshuyin_app'` | `false` |
| E-2 | `SELECT pg_get_userbyid(relowner) FROM pg_class WHERE relname='persons'` | `xiaoshuyin_migrator` |
| E-3 | `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN (…)` | 全部 `true, true` |
| E-4 | `SELECT has_table_privilege('xiaoshuyin_app','accounts','TRUNCATE')` | `false` |
| E-5 | 以 `xiaoshuyin_app` 直接 `SELECT count(*) FROM persons`（三个 GUC 全未设） | `0` |
| E-6 | 以 `xiaoshuyin_app` 设置 family A 上下文后查询 family B 的行 | `0` |
| E-7 | `SELECT app.set_family_context(<非成员 family>, <actor person>, 'FAMILY_MANAGEMENT')` | 抛 42501 |
| E-8 | 连接池连续两个请求，第二个不设上下文查询 | `0`（上下文未泄漏） |
| E-9 | `set_identity_context(accountA, …)` 后 `SELECT count(*) FROM persons` | `1`，且 `id` = accountA 绑定的 person |
| E-10 | `set_identity_context(accountA, …)` 后 `SELECT count(*) FROM persons WHERE id = <accountB 的 person>` | `0` |
| E-11 | 仅 identity 上下文尝试 `INSERT INTO person_profile_values` | 被 `WITH CHECK` 拒绝 |

---

## 6. 与 spec 场景的对应

| spec 场景 / 验收 | 本契约中的落点 |
|---|---|
| 7（跨家庭读取失败） | §4.1 + §4.2.1 + E-5/E-6 |
| 8（无家庭成员关系越权） | §2.3 `FAMILY_READ` / `MEMBER_*` + `NOT_FAMILY_MEMBER` |
| 9（伪造 family_id） | §2.1「待验证参数」+ `set_family_context` 二次确认 |
| 13（非创建者成员不得管理成员） | §2.3 manager 要求 + `NOT_FAMILY_MANAGER` |
| 场景 11（多 Family fixture） | §4.2.3 |
| SC-002（应用层与数据库层都失败） | §2 + §4 双层的独立测试 |
