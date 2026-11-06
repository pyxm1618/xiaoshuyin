# Contract — Participant Lifecycle, Identity Seam, Compliance & Audit

**Feature**: `specs/004-case-participant-core/spec.md`
**阶段**: Plan（Phase 1）
**权威**: `Docs/V1技术设计.md` §5 不变量 1 / 3 / 4 / 5 / 17 / 27 / 29、§7.1 / §7.7A / §7.9 / §10 / §28.8；`Docs/V1产品需求.md` §1.2 / §1.5 / §17.1 / §19A.2 / V1-C03 / V1-C20 / V1-C21 / V1-C39 / V1-C44 / U11；`specs/005-invited-identity-binding-contract/spec.md`。
**状态**: 契约基线。实现必须遵守；不得扩张本 Slice 的业务语义。

---

## 1. 参与资源生命周期（唯一权威）

```text
Case participation resource created
→ PENDING（无 active participant capability）
   ├─ accepted  → ACTIVE（limited participant capability）
   ├─ declined  → DECLINED（terminal）
   └─ expired   → EXPIRED（terminal）

ACTIVE
└─ withdrawn → WITHDRAWN（historical inactive participation）
```

**不变量**：

1. `PENDING` 参与资源存在，但 **不是** active Participant；`active participant capability = 0`。
2. `ACTIVE` 必须来自**显式有效 accept**；不存在隐式 accept。
3. `DECLINED` / `EXPIRED` / `WITHDRAWN` 是 terminal；不可 accept、不可重新激活、不可复活。
4. `DECLINED ≠ WITHDRAWN ≠ EXPIRED`：
   - decline 是 accept 前 pending 的终态；
   - expired 是 accept 前 pending 的终态；
   - withdraw 是 accept 后 active 的终态。
5. `WITHDRAWN` 保留 `accepted_at`；表示“曾经合法参与后退出”，不是“从未参与”。
6. terminal 历史只追加、不删除、不伪造。
7. 同一 `(case_id, person_id)` 最多一个 PENDING / ACTIVE；terminal 历史可多条。
8. 不存在 manager cancel / Family manager cancel / creator cancel / `REVOKED` / `CANCELLED` 状态。

**`越权作废` 的 Plan 映射**：
- 未授权 actor 的操作被拒绝，**不改变** invitation 状态；不新增终态。
- 邀请对 target 仍然有效；错误 candidate 不能通过越权尝试 cancel / expire / decline 邀请。
- 若未来正式需要“有权主体主动撤销邀请”，必须先改上游 Docs / 合同并新增正式授权；本 Plan 不预造。

---

## 2. 状态转换表

| from | event | to | 前置 | 时间戳 | 允许 actor |
|---|---|---|---|---|---|
| — | create invite | `PENDING` | Case manager；target ∈ Family；Compliance gate 通过；无 live participation | `created_at` / `invite_expires_at` | Case manager |
| `PENDING` | accept | `ACTIVE` | identity prerequisite 满足；未过期；Compliance gate 通过 | `accepted_at` | target Person |
| `PENDING` | decline | `DECLINED` | identity prerequisite 满足；未过期 | `declined_at` | target Person |
| `PENDING` | expire | `EXPIRED` | `now() >= invite_expires_at`；物化 | `expired_at` | system on authorized access |
| `ACTIVE` | withdraw | `WITHDRAWN` | identity prerequisite 满足 | `withdrawn_at`（保留 `accepted_at`） | active Participant |
| terminal | any | 不变 | 拒绝 | — | — |

**非法转换**：
- `accept` on `ACTIVE`：幂等收敛到当前 `ACTIVE`（200），不新增行。
- `accept` on `DECLINED` / `EXPIRED` / `WITHDRAWN`：`409 PARTICIPATION_STATE_CONFLICT`。
- `decline` on `DECLINED`：幂等收敛到当前 `DECLINED`（200）。
- `decline` on `ACTIVE` / `WITHDRAWN` / `EXPIRED`：`409`。
- `withdraw` on `WITHDRAWN`：幂等收敛到当前 `WITHDRAWN`（200）。
- `withdraw` on `PENDING` / `DECLINED` / `EXPIRED`：`409`。

---

## 3. Identity Seam（Slice 4 只消费 005）

### 3.1 唯一身份前置

```text
authenticated actor → persons.account_id → actor.personId
accept precondition: actor.personId === participation.person_id
```

- `actor.personId` 由现有 auth plugin 解析；Slice 4 **不读、不写、不复制** `persons.account_id`。
- Slice 4 不创建 Person、不重绑、不 merge、不自动 accept。
- binding success 只让 `actor.personId = P1`；不会改变 participation 状态。

### 3.2 Case B / Case C

| 情形 | 事实 | accept | 外部结果 |
|---|---|---|---|
| Case B：P1 已有 Account B，当前 Account == B | `actor.personId = P1` | 允许 | 200；PENDING → ACTIVE |
| Case B：P1 已有 Account B，当前 Account != B | `actor.personId != P1` | 拒绝 | 404 generic；无 rebind |
| Case C：P1 无 Account，binding 未 COMMITTED | `actor.personId` 为 null 或其它 Person | 拒绝；active = 0 | 404 generic |
| Case C：binding 已 COMMITTED | `actor.personId = P1` | 允许；仍需显式 accept | 200 |
| 普通登录先行：A↔P2 已成立 | `actor.personId = P2 != P1` | 拒绝 | 404 generic；A↔P2 / P1 不变 |
| forwarded invite：B 不是 P1 | `actor.personId != P1` | 拒绝；不能代 P1 decline | 404 generic |

### 3.3 不可区分性

- accept 端点不返回 `IDENTITY_BINDING_REQUIRED` / `ACCOUNT_MISMATCH` / `CASE_C` 等区分性错误。
- Case B wrong Account、Case C unbound、Case C binding pending/terminal 统一为 `404 PARTICIPATION_NOT_FOUND`。
- “下一步可继续动作”也不得成为 oracle：不在 accept 前暴露 Case C / guardian / consent 状态。
- 已授权 second-party / manager 的可见性由 005 runtime 拥有，不在 Slice 4 扩散。

### 3.4 Invitation flow routing invariant

- 从 participation invitation 进入 Case C 时，客户端 / 产品流程必须在调用普通 `/api/v1/auth/wechat` 之前 route 到 005 invitation-aware bootstrap。
- Slice 4 不实现 bootstrap、candidate recognition、binding attempt、no-P2、Age Gate 1/2。
- Case B 的短路由 005 runtime 负责；Slice 4 只消费最终 `actor.personId`。
- 005 runtime 未实现时，Case C 端到端验收必须报告 `BLOCKED`；不得用直接写 `persons.account_id` 冒充。

### 3.5 不自动 unlink

- participation decline / withdraw、Case close、guardian consent revoke、downstream authorization revoke **不**自动解除 Account↔Person binding。
- 本 Slice 不设计 unlink；binding 生命周期由 005 / 未来 Slice 拥有。

---

## 4. Compliance / Consent Gate

复用 Slice 1 `assertMinorProcessingAllowed(personId, deps)`；不复制 Age Matrix，不新增 consent 类型。

| 时点 | gate | 失败 |
|---|---|---|
| 建邀请 | 读 target 当前 `person_compliance_profiles` + 当前 consent；`UNKNOWN` / `PROFILE_MISSING` / UNDER_14 缺 current guardian 或 current valid guardian consent / applicable gate 失败 → BLOCK | `403 PARTICIPATION_TARGET_INELIGIBLE`；零邀请写入；无 age / guardian / consent 细节 |
| accept | **重新读取** current Profile / guardian / consent / Compliance；不得用 stale snapshot | `404 PARTICIPATION_NOT_FOUND`（generic）；active = 0；无部分写入 |
| decline | 不做 Compliance gate | 保证拒绝始终可用 |
| withdraw | 不做 Compliance gate | 保证退出始终可用 |

**年龄边界**（引用 005，不复制矩阵）：
- `UNDER_14`：current guardian + current valid guardian consent + applicable Compliance；
- `MINOR_14_17`：applicable Compliance；不因年龄要求 UNDER_14 guardian consent；其它适用 Consent 仍执行。Slice 1 当前 consent taxonomy 只定义 `UNDER_14_GUARDIAN_CONSENT`；目前没有其它 applicable consent 类型。若未来正式新增 consent 类型，必须在对应 Slice 扩展 gate；Slice 4 不发明、不忽略；
- `ADULT`：不因年龄要求 UNDER_14 consent；Case C invited binding NOT SUPPORTED（005），无 Account 时 accept 只能 generic 失败；
- `UNKNOWN`：BLOCK。

**不变量**：
- guardian relationship 只来自 `person_compliance_profiles.guardian_person_id`；
- guardian consent 只来自 `consent_records` 当前有效版本；
- `case_participants` 不存 age / guardian / consent 快照；
- invite / accept 不倒置为「invite → create child Person → consent later」；
- guardian consent ≠ identity-binding confirmation ≠ participation acceptance。

---

## 5. 审计

只复用 `business_audit_events`；不写 `case_events`；不建第二套 audit。

| event_type | 触发 | actor | resource_type | metadata |
|---|---|---|---|---|
| `PARTICIPATION_INVITE_CREATED` | invite 创建 | manager account | `CASE_PARTICIPANT` | `{ caseId, personId, state: 'PENDING', expiresAt }` |
| `PARTICIPATION_ACCEPTED` | PENDING → ACTIVE | target account | `CASE_PARTICIPANT` | `{ caseId, personId, fromState: 'PENDING', toState: 'ACTIVE' }` |
| `PARTICIPATION_DECLINED` | PENDING → DECLINED | target account | `CASE_PARTICIPANT` | `{ caseId, personId, fromState: 'PENDING', toState: 'DECLINED' }` |
| `PARTICIPATION_EXPIRED` | PENDING → EXPIRED（物化） | 触发物化的已认证 account | `CASE_PARTICIPANT` | `{ caseId, personId, fromState: 'PENDING', toState: 'EXPIRED', expiresAt, materializedOnAccess: true }` |
| `PARTICIPATION_WITHDRAWN` | ACTIVE → WITHDRAWN | participant account | `CASE_PARTICIPANT` | `{ caseId, personId, fromState: 'ACTIVE', toState: 'WITHDRAWN' }` |

**规则**：
- 与 business 写入同一事务；任一失败整体回滚；
- replay 不追加第二组 audit；
- 不记录 token / token hash / wechat_openid / 家长原话 / PII；
- 不为 audit 创建 Person / Account；
- 未授权尝试不写 audit（避免噪声与 oracle）；若未来安全审计要求，另行设计；
- expiry 的 `occurred_at` 是物化时间，metadata 的 `expiresAt` 是真实到期时间；不伪造成到期瞬间；
- `actor_account_id` 对 expiry 是“触发物化的已认证 account”，不是“造成到期的原因”。

---

## 6. 过期语义

**TTL / server time**：
- `PARTICIPATION_INVITE_TTL_SECONDS` 为必需服务端配置，正整数，无默认值；
- `PARTICIPATION_INVITE_TOKEN_SECRET` 为 token 确定性派生 secret，必需、≥32 bytes、不记录；在 invitation lifetime / idempotency replay retention window 内必须稳定，不得静默产生不同 token；
- create 在同一 transaction 内先 `SELECT uuidv7()` 预分配 id；`created_at` / `updated_at` 使用 DB server `now()`，`invite_expires_at = now() + configured TTL`；`invite_expires_at > created_at` 由 positive TTL 保证；
- 生产值属 RELEASE / POLICY GATE（§34.1）；Plan 不写具体数字；
- caller 不得提交 / 覆盖 / 延长；
- 无配置 / 非法 → 启动失败；请求层不得 fallback 为永久。

**有效状态**：
```text
effectiveState(participation) =
  state = 'PENDING' AND now() >= invite_expires_at
    ? 'EXPIRED'
    : state
```

**物化**：
- 未认证 invite lookup：只查询 `case_participant_invite_public` safe view；view 的 `state='PENDING' AND invite_expires_at > now()` 是 public availability 的 authoritative enforcement；effective-expired PENDING 只返回 `UNAVAILABLE`，不改写行、不写 audit；
- 有授权的 accept / decline / GET：先 `SELECT ... FOR UPDATE`，观察到过期 → 条件 UPDATE `EXPIRED` + `expired_at`；**只有 UPDATE 影响 1 行才写 audit**，0 行不写 audit（exactly-once）→ commit → 真实失败 / 状态；
- GET self path：self SELECT 后必须 `authorize(PARTICIPATION_READ_SELF)`；若需物化，必须用 server-trusted `participation.family_id` 调用既有 `setFamilyContext(..., actor.personId, 'PARTICIPATION')` 建立 family write context；manager path 已有 family context；不新增 self UPDATE policy，不接收 client `familyId`；
- 条件 UPDATE `WHERE state='PENDING' AND now() >= invite_expires_at` 是幂等；0 行表示已被其它事务处理；
- 若 PENDING 行到期后从未被访问，不自动写 `PARTICIPATION_EXPIRED` audit；有效状态仍为 EXPIRED，可由 `invite_expires_at` + state + 当前时间追溯。本 Slice 不引入后台 job；若未来要求无访问也持久化 expiry 事件，由独立 data-lifecycle Slice 增加；
- 不引入后台 job / pg-boss / Temporal；
- 清理 / 归档属未来数据生命周期 Slice；本 Slice 不删除历史。

---

## 6.1 参与说明 notice（版本化静态文案）

未认证 invite lookup 返回的 `notice` 使用版本化静态文案，不含 P1 / Case / Family 具体信息：

```text
version: participation-notice-v1
title:   参与邀请
body:    你被邀请参与一个已经存在的 Case。参与是有限的：你可以查看本次参与说明，
         选择接受或拒绝。拒绝不是失败，也不会关闭 Case。接受后你只能访问明确允许给你的内容。
```

- 该文案只表达 spec 已冻结的参与语义（有限参与、accept / decline、decline 合法、非全量访问）。
- 不包含年龄、guardian、consent、Case 名称、Family 名称、Person 名称、token 或任何私密字段。
- 文案版本 / hash 由实现常量持有；变更必须走版本化与评审，不得静默改写。
- 不接受客户端传入 notice body；不把 notice 变成通用内容载体。

---

## 7. 防枚举

| 场景 | 外部结果 |
|---|---|
| 建邀请：Case 不存在 / 跨 Family / 非 manager | `404 CASE_NOT_FOUND`（统一） |
| 建邀请：target 不合规 | `403 PARTICIPATION_TARGET_INELIGIBLE`（无细节） |
| invite token：无效 / 过期 / 已拒绝 / 已退出 | `404 INVITATION_NOT_AVAILABLE`（统一） |
| invite token：有效 PENDING | 200；仅 `participationId` / `state` / `expiresAt` / generic notice |
| accept：非 target / 未绑定 / 不可用 | `404 PARTICIPATION_NOT_FOUND`（统一） |
| decline / withdraw / GET：非 target / 非 manager / 不存在 | `404 PARTICIPATION_NOT_FOUND`（统一） |
| 授权 target 的非法状态 | `409 PARTICIPATION_STATE_CONFLICT`（仅 currentState） |

**禁止**：
- 在 404 / 403 / 409 中放入 Person / Family / Case / guardian / age / consent / compliance；
- 通过状态码 / 文案 / “可继续动作”差异泄露 Case B / C、guardian、consent、multi-family；
- 用错误的 token 或错误 Account 探测 P1 是否存在；
- 用 403 / 404 差异泄露 Case 是否存在。

---

## 8. 边界（明确不做）

- **无 Evidence**：accept / decline / withdraw 不写 `assertions` / `observations` / STATEMENT / FACT / HYPOTHESIS；`accept ≠ Fact`、`decline ≠ Statement`、`withdraw ≠ Evidence`。
- **无 Case-wide read**：participation 行不构成 Case 全量可见；Participant 不能读取家长私人原话、其他成员私人内容、Evidence、全部 Formulation / Plan。
- **无 manager 能力**：Participant 不继承 Case manager；不能调用 manager-only Case 命令。
- **无 generic response**：不建 `POST /participations/:id/responses`；未来本人反馈归具体业务对象。
- **无 guardian 自动授权**：guardian relationship ≠ Family access ≠ Case Participant capability。
- **无跨 Family**：target 必须属于目标 Family；不建 cross-family participant / multi-family chooser / family switcher / identity merge。
- **无 Evidence / Assessment / Formulation / Scene / Goals / Plan / Task / AI / RAG / Memory / Safety / 通知 / UI**。
- **无 manager cancel**：不实现 Family manager / Case manager / creator 随意 cancel invitation。
- **无后台任务**：不建 pg-boss / worker / outbox / 定时器。
- **无 KYC**：不引入 government-ID / 人脸 / 电话 / 视频 / 其它外部身份证明；005 已冻结 family-attested scope。

---

## 9. 必测反例

| # | 场景 | 期望 |
|---|---|---|
| N-01 | Case B 正确 Account | 复用 binding；accept 成功；Person 数不变 |
| N-02 | Case B 错误 Account | 拒绝；不 rebind；无 active |
| N-03 | Case C binding COMMITTED | 仍需显式 accept；binding 本身不产生 active |
| N-04 | Case C binding PENDING | accept 失败；active = 0；generic |
| N-05 | Case C binding terminal | accept 失败；active = 0；generic |
| N-06 | forwarded invite + wrong candidate | 不能成为 P1；不能 accept / decline；不泄露 target 信息 |
| N-07 | 普通登录先行 A↔P2 | invited binding 拒绝；A↔P2 / P1 不变；无 merge / rebind |
| N-08 | UNDER_14 current consent 失效 | 建邀请 403 / accept generic；无 active；不用 stale snapshot |
| N-09 | MINOR_14_17 有 guardian / 无 guardian | 按 005 矩阵；不因年龄要求 UNDER_14 consent；其它 applicable consent 仍执行 |
| N-10 | UNKNOWN | BLOCK；不按 ADULT / 未成年放行 |
| N-11 | accept vs decline 并发 | 至多一个成功状态转换（0 或 1）；另一个 409；无矛盾 |
| N-12 | accept vs expiry 并发 | 到期后不可 active；EXPIRED 物化 + audit；无复活 |
| N-13 | double accept | 一个 active；同 key replay；不同 key 幂等收敛到 ACTIVE |
| N-14 | withdraw replay | 不复活；WITHDRAWN 历史保留 |
| N-15 | withdraw before accept | 409；不改为 WITHDRAWN |
| N-16 | terminal reactivation | DECLINED / EXPIRED / WITHDRAWN 再 accept 失败 |
| N-17 | decline 不关 Case | Case 状态不变；家长可独立工作 |
| N-18 | Participant 调 Case manager route | 404 / 403 按 Slice 2 语义；无 Case 数据 |
| N-19 | accept / decline / withdraw 后 Evidence 计数 | `assertions` / `observations` +0 |
| N-20 | unauthorized token lookup | 无 Person / Family / Case / guardian / age / consent / compliance 字段 |
| N-21 | wrong Family / wrong Case / wrong Person / wrong Account | 统一 generic；零写入 |
| N-22 | 审计事件 | 5 类事件存在；无第二套 audit；无 token / openid |
| N-23 | 路由枚举 | 恰好 6 条；无 `/responses` / 越界 route |
| N-24 | 结构枚举 | 无第二张 participant 表 / binding attempt 表 / evidence 表 / audit 表 |
| N-25 | invite create same-key replay（token 语义） | 同一 participationId + 同一 inviteToken；token 明文不落库；不同 payload → 409 |
| N-26 | token safe view | view 只含 participation_id / state / expires_at / created_at；terminal 行不通过 token context 可见 |

---

## 10. 验证映射

| 契约 | 测试 |
|---|---|
| 生命周期 1—2 | `tests/domain/participants-domain.test.ts` |
| Identity seam 3 | `tests/integration/participations-identity-seam.test.ts` |
| Compliance 4 | `tests/integration/participations-compliance.test.ts` |
| Audit 5 | `tests/integration/participations-audit.test.ts` |
| Expiry 6 | `tests/integration/participations-expiry.test.ts`（含 GET exactly-once 物化、never-accessed derived state） |
| GET self READ_SELF / family context | `tests/integration/participations-read.test.ts`、`tests/integration/participations-expiry.test.ts`、`tests/db/participants-rls.test.ts` |
| invite token replay / safe view | `tests/integration/participations-idempotency.test.ts`、`tests/db/participants-rls.test.ts`、`tests/integration/participations-invite-lookup.test.ts`（expired PENDING 404；view PENDING + unexpired） |
| Anti-enumeration 7 | `tests/integration/participations-anti-enumeration.test.ts` |
| 边界 8 | `tests/integration/participations-scope.test.ts`、`tests/db/participants-evidence-boundary.test.ts` |
| 必测反例 9 | 对应 integration / db / domain 测试文件 |