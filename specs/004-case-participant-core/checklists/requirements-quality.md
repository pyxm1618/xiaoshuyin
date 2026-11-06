# Requirements Quality Checklist — 004-case-participant-core

**Feature**: `specs/004-case-participant-core/spec.md`
**Phase**: Phase 1（`Docs/V1技术设计.md` §38）
**Stage**: Checklist
**Source of truth**:
- `specs/004-case-participant-core/spec.md`（31 FR / 19 Acceptance / 15 SC，已冻结）
- `specs/004-case-participant-core/plan.md`（D-1—D-17）
- `specs/004-case-participant-core/research.md`
- `specs/004-case-participant-core/data-model.md`
- `specs/004-case-participant-core/contracts/participation-api.openapi.yaml`
- `specs/004-case-participant-core/contracts/authorization-rls-and-idempotency.md`
- `specs/004-case-participant-core/contracts/participant-lifecycle-and-identity-seam.md`
- `specs/004-case-participant-core/quickstart.md`
- 上游只读：`Docs/V1产品需求.md` v3.7、`Docs/V1技术设计.md` v3.12、`specs/001-family-identity-core/**`、`specs/002-case-core/**`、`specs/005-invited-identity-binding-contract/spec.md`

> **Checklist 语义**：`[x]` 只表示“对应的需求质量问题已经在文档层得到明确、可判定、可验证的答案”，**不表示代码已实现**。本阶段不创建 `tasks.md`、不写测试、不写 migration、不执行 Implement / Converge。

---

## 1. 审核结论摘要

```text
Checklist total: 130
PASS:           130
FAIL:           0
GAP:            0
```

**Plan closeout findings**（初检存在 Gap，经最小 Plan closeout 关闭；不改变冻结 spec / Docs / 产品合同）：

| Finding | 类型 | 初检问题 | 关闭方式 | 涉及 artifact |
|---|---|---|---|---|
| F-01 | Idempotency / Security | invite create replay 必须返回原结果，但 token 明文只存 hash，导致 replay 无法返回 token；若把 token 写入 `idempotency_keys.response_body` 则违反“token 明文不落库” | token 改为确定性 HMAC 派生；C-01 create 先 `SELECT uuidv7()` 预分配 `participationId`，token 派生先于 INSERT，INSERT 显式 `id`，`created_at` / `expires_at` 用 DB server time；idempotency snapshot 只存 redacted body；replay 由 `participationId` + token secret 重新派生同一 token | plan D-1/D-2/D-5/D-9/D-14/D-15；research R-6/R-19；data-model §2.1/§6.1/§9；auth contract §5.4；OpenAPI inviteToken description；quickstart §3 |
| F-02 | Privacy / RLS | token RLS 仅按 hash 匹配，未限定 `PENDING`；且只靠“route 记得 select 安全列”不足以防列泄露 | token policy 加 `state='PENDING'`；新增 `security_invoker` safe view `case_participant_invite_public`，只含安全列，predicate 为 `state='PENDING' AND invite_expires_at > now()`；repository + guard test + OpenAPI 三层边界；effective-expired PENDING 不返回 200 | plan D-5/D-11/D-14；research R-7；data-model §3.2/§3.3/§3.5；auth contract §4.1/§4.4；quickstart §2 |
| F-03 | Concurrency / Lifecycle | GET/read 会物化 expiry，但未明确 `FOR UPDATE` / 条件 UPDATE / exactly-once audit；并发 GET 可能重复 audit 或状态不一致 | 明确 GET / accept / decline 均 `SELECT FOR UPDATE` + 条件 UPDATE；GET self 先 `authorize(PARTICIPATION_READ_SELF)` + 用 server-trusted `participation.family_id` 建立 family write context；只有 UPDATE 影响 1 行才写 audit；0 行不写 audit；不新增 self UPDATE policy | plan D-4/D-6/D-10/D-14；research R-4；data-model §3.2/§6.5；auth contract §6.4；lifecycle contract §6 |
| F-04 | Concurrency | 部分表述写成“恰好一个合法结果”，可能在 0 个满足条件时错误地要求 1 个成功 | 统一为“至多一个成功状态转换（0 或 1）；无满足条件时 0 合法” | plan D-10 / Verification；lifecycle contract N-11；quickstart §4 |
| F-05 | Compliance | `MINOR_14_17` 写“其它 applicable consent 仍执行”，但当前 Slice 1 consent taxonomy 只有 `UNDER_14_GUARDIAN_CONSENT`；未说明未来 consent 类型归属 | 明确当前 taxonomy 只有该类型；未来新增 consent 类型必须在对应 Slice 扩展 gate；Slice 4 不发明、不忽略 | plan D-8；lifecycle contract §4 |
| F-06 | Lifecycle / Audit | 到期后从未被访问的 PENDING 行是否必须产生 `PARTICIPATION_EXPIRED` audit 未说明 | 明确 never-accessed 为 derived EXPIRED，不自动写 audit；事实可由 `invite_expires_at` + state + time 追溯；未来无访问持久化事件由独立 data-lifecycle Slice 增加 | plan D-14；research R-4；data-model §6.5；auth contract §6.4；lifecycle contract §6 |

> 以上均为 Plan-artifact 内部一致性 / 可执行性缺口，**不涉及** frozen spec、Docs、005 contract 或 Slice 1 / 2 业务语义变更。`spec.md` / `Docs/**` diff = 0。

---

## 2. Scope & Boundary

- [x] **CHK001** [Scope, spec FR-001 / plan D-2] Participant 被明确定义为 **Case-scoped relationship**；文档明确它不等于 Family membership、guardian relationship、Account ownership、site role 或 generic RBAC role。
- [x] **CHK002** [Scope, spec Out of Scope / plan D-17] Assessment、Problem Formulation、Scene、Evidence、Assertion、Observation、Goal、Intervention、Plan execution、Task、AI、RAG、Memory、Safety framework、actual notification sending、frontend UI 全部不在本 Slice；Plan / Contracts 没有偷偷拉回。
- [x] **CHK003** [Scope, spec FR-026 / FR-028 / OpenAPI] `POST /api/v1/participations/:id/responses` 明确 DEFER；OpenAPI 不存在该 path，Plan 明确说明它属于未来具体业务对象，不是 Slice 4。
- [x] **CHK004** [Scope, spec FR-026 / FR-027 / OpenAPI] 不存在 generic participant response、participant 管理、列表、批量、delete、restore、manager cancel 路由。
- [x] **CHK005** [Scope, spec FR-001 / FR-018 / plan D-6] 不存在 generic RBAC、Case role、Participant role、Visibility Matrix、Permission DSL、role enum。
- [x] **CHK006** [Scope, spec FR-004 / Out of Scope / plan D-2] 不存在 cross-Family participant、multi-family chooser、family switcher、identity merge；target Person 必须属于目标 Family。
- [x] **CHK007** [Scope, spec OQ-7 / plan D-6] 不存在 participant-to-participant 协作、共享内容、相互发现或跨 Participant 可见性。
- [x] **CHK008** [Dependency, spec FR-030 / plan D-17] Slice 3 / `003-evidence-core` 没有被自动列为 Slice 4 Implement dependency；Plan 明确本 Slice 不写 Evidence。

---

## 3. Lifecycle

- [x] **CHK009** [Lifecycle, spec OQ-1—OQ-3 / plan D-4 / data-model §1] participation domain state 恰为 `PENDING` / `ACTIVE` / `DECLINED` / `EXPIRED` / `WITHDRAWN`；没有新增业务状态。
- [x] **CHK010** [Lifecycle, spec OQ-1 / plan D-4] `PENDING` 参与资源存在但 **active participant capability = 0**；`PENDING` 不等于 active Participant。
- [x] **CHK011** [Lifecycle, spec FR-007 / plan D-4] `ACTIVE` 只能来自显式有效 accept；不存在隐式 accept 或绑定成功自动 accept。
- [x] **CHK012** [Lifecycle, spec OQ-2 / OQ-4 / plan D-4] `DECLINED ≠ EXPIRED`：时间戳、审计事件、外部语义分开。
- [x] **CHK013** [Lifecycle, spec OQ-2 / OQ-3 / plan D-4] `DECLINED ≠ WITHDRAWN`：decline 是 accept 前 pending 的终态；withdraw 是 accept 后 active 的终态。
- [x] **CHK014** [Lifecycle, spec OQ-3 / OQ-4 / plan D-4] `EXPIRED ≠ WITHDRAWN`：archived / historical inactive 与 expired pending 不互相替代。
- [x] **CHK015** [Lifecycle, spec FR-011 / FR-013 / plan D-4 / D-10] decline 永不创建 ACTIVE；expiry 永不创建 ACTIVE；withdraw 要求 prior ACTIVE。
- [x] **CHK016** [Lifecycle, spec FR-015 / SC-005 / plan D-4] terminal 资源不可 accept、不可重新激活、不可复活；`WITHDRAWN` 保留 `accepted_at`，历史不删除。
- [x] **CHK017** [Lifecycle, spec FR-015 / research R-10] `越权作废` 被映射为授权失败，**不是**新的 participation state；没有 `REVOKED` / `CANCELLED` / `INVITED` / `ACCEPTED` 重复状态。
- [x] **CHK018** [Lifecycle, spec FR-014 / data-model §2.3] state / timestamp CHECK 可数据库验证：WITHDRAWN 必有 `accepted_at` + `withdrawn_at`；DECLINED / EXPIRED 不得有 `accepted_at`；EXPIRED `expired_at >= invite_expires_at`。

---

## 4. Identity ≠ Participation

- [x] **CHK019** [Identity, spec FR-009 / FR-024 / plan D-7] 文档明确 `Account↔P1 binding ≠ participation acceptance`；binding success 只建立身份，不改变 participation state。
- [x] **CHK020** [Identity, spec FR-005 / FR-009 / plan D-7] Case B：correct Account → reuse existing binding；wrong Account → reject；MUST NOT rebind / replace / merge。
- [x] **CHK021** [Identity, spec FR-005 / FR-009 / plan D-7] Case C：P1 exists + Account none → 只消费 005 invitation-aware bootstrap；Slice 4 不创建 Person、不写 `persons.account_id`、不实现 candidate recognition / binding attempts。
- [x] **CHK022** [Identity, spec FR-007 / FR-009 / plan D-7] Case C binding COMMITTED 只是 accept 的 prerequisite；仍必须显式 accept 才得到 active capability。
- [x] **CHK023** [Identity, spec FR-009 / FR-024 / plan D-7] binding PENDING / blocked / terminal / retryable → `active participation = 0`；accept 必须失败。
- [x] **CHK024** [Identity, spec FR-009 / plan D-7] 不存在 no-P2 违规路径：Slice 4 不调用普通 `/auth/wechat` 创建 P2、不 merge、不 rename、不 delete、不 rebind。
- [x] **CHK025** [Identity, spec FR-006 / SC-006 / plan D-7 / D-13] forwarded invite + wrong candidate：不能成为 P1、不能 accept、不能 decline、不能产生 active participation、不泄露 target 信息。
- [x] **CHK026** [Identity, spec FR-005 / research R-3] accept 层不对外区分 Case B / Case C；错误 Account、未绑定、binding PENDING / terminal 统一 generic 失败。
- [x] **CHK027** [Dependency, spec OQ-6 / plan D-17 / quickstart §6] 文档明确 005 contract 已 MERGED，但 005 runtime NOT IMPLEMENTED；Case C 端到端验收 BLOCKED，禁止用直接写 `persons.account_id` 冒充。

---

## 5. UNDER_14 / Compliance

- [x] **CHK028** [Compliance, spec FR-010 / plan D-8] 建邀请时读取 target 当前 Compliance Profile / guardian / consent / applicable gate；不满足 → `403 PARTICIPATION_TARGET_INELIGIBLE`，零邀请写入。
- [x] **CHK029** [Compliance, spec FR-010 / FR-024 / plan D-8] accept 时**重新读取** current Profile / guardian / consent / Compliance；不得使用 stale snapshot / cached invitation-time consent。
- [x] **CHK030** [Compliance, data-model §2.1] `case_participants` 不存 age_band / guardian / consent 快照；guardian / consent 事实只在 `person_compliance_profiles` / `consent_records`。
- [x] **CHK031** [Compliance, spec FR-011 / FR-013 / plan D-8] decline 与 withdraw 不被 Compliance gate 阻断；用户始终可以拒绝 / 退出。
- [x] **CHK032** [Compliance, spec §7.7A / plan D-6 / D-8] guardian relationship ≠ Family access ≠ Case Participant capability；guardian 不自动获得 Case read / participant read / participant management。
- [x] **CHK033** [Compliance, spec FR-010 / plan D-8] `UNKNOWN` 被 BLOCK，不按 ADULT 或未成年人任一分类放行。
- [x] **CHK034** [Compliance, 005 §5.4 / plan D-8 / lifecycle contract §4] `MINOR_14_17` 只豁免 UNDER_14 guardian consent，不是豁免全部 consent；当前 Slice 1 taxonomy 只有 `UNDER_14_GUARDIAN_CONSENT`，未来新增 consent 类型由对应 Slice 扩展。
- [x] **CHK035** [Compliance, 005 §5.4 / plan D-8] ADULT 的 invited identity binding 是 NOT SUPPORTED；Slice 4 不为 ADULT 发明新的绑定路径。Case B ADULT 已有 Account 的 accept 仍按 identity + participation 规则处理。

---

## 6. TTL / Expiry

- [x] **CHK036** [TTL, spec FR-015 / plan D-14] TTL 是有限、服务端强制、caller 不可自定义、不可延长；不存在 per-request arbitrary extension。
- [x] **CHK037** [TTL, spec OQ-4 / plan D-14] Plan 没有冻结任何具体 TTL 数值（24h / 72h / 7d / 30d 等）；具体值仍是 RELEASE / POLICY GATE。
- [x] **CHK038** [TTL, plan D-14 / research R-5] `PARTICIPATION_INVITE_TTL_SECONDS` 是必需配置、正整数、无默认值；缺失 / 非法 → 启动失败（fail-closed）。
- [x] **CHK039** [TTL, plan D-14] 不存在 permanent fallback、`expires_at = infinity`、`interval '24 hours'` 硬编码或 caller `expiresAt` 输入。
- [x] **CHK040** [Expiry, plan D-4 / D-14 / data-model §6.5] 明确区分 **effective expired state** 与 **persisted EXPIRED state**：PENDING + now >= expires_at 业务上等价 EXPIRED；物化是单独动作。
- [x] **CHK041** [Expiry, plan D-14 / data-model §6.5] 未认证 invite lookup 只返回 `UNAVAILABLE`，不改写行、不写 audit；token lookup 只使用 safe view。
- [x] **CHK042** [Expiry, plan D-4 / D-6 / D-10 / D-14] GET / accept / decline 的 expiry 物化必须 `SELECT ... FOR UPDATE` + 条件 `UPDATE ... WHERE state='PENDING' AND now() >= invite_expires_at`；GET self 先 `authorize(PARTICIPATION_READ_SELF)` + `setFamilyContext(participation.family_id, actor.personId, 'PARTICIPATION')`；不新增 self UPDATE policy。
- [x] **CHK043** [Expiry, plan D-14 / lifecycle contract §6] exactly-once audit：只有 UPDATE 影响 1 行才写 `PARTICIPATION_EXPIRED`；0 行不写；并发两个 GET 只有一个写 audit。
- [x] **CHK044** [Concurrency, plan D-10 / lifecycle contract N-12] expiry 与 accept / decline 并发时有唯一合法赢家；若所有请求都不满足条件，0 个成功状态转换是合法结果。
- [x] **CHK045** [Expiry, research R-4 / plan D-14] never-accessed 到期 PENDING 行被明确为 derived EXPIRED，不自动写 audit；可由 `invite_expires_at` + state + time 追溯；未来无访问持久化事件由独立 data-lifecycle Slice 增加。

---

## 7. Data Model

- [x] **CHK046** [Data model, spec OQ-1 / data-model §1/§8] 只有一张 `case_participants` 参与资源；不存在 `participation_invites` / `case_invites` / `participant_memberships` 等第二真相表。
- [x] **CHK047** [Data model, data-model §2.1] 列集合恰为设计清单；不存 `role` / `account_id` / `age_band` / `guardian_person_id` / `consent_*` / `binding_state` / `visibility` / `deleted_at`。
- [x] **CHK048** [Data model, data-model §2.3] state / timestamp CHECK 覆盖 PENDING / ACTIVE / DECLINED / EXPIRED / WITHDRAWN 全部合法组合，并拒绝非法组合。
- [x] **CHK049** [Data model, data-model §2.2] `(case_id, family_id)` 复合 FK 引用 `cases(id, family_id)`；Case 必须与 Family 一致。
- [x] **CHK050** [Data model, data-model §2.2] `(person_id, family_id)` 复合 FK 引用 `family_members(person_id, family_id)`；为支持该 FK 增加的 `UNIQUE (person_id, family_id)` 是冗余、非破坏性、不新增业务语义。
- [x] **CHK051** [Data model, data-model §2.1 / §6.1] `invite_token_hash` NOT NULL / UNIQUE / 64 hex；token 明文不落库；token 由确定性 HMAC 派生；create 先 `SELECT uuidv7()` 预分配 `participationId`；INSERT 显式 `id`；`created_at` / `expires_at` 用 DB server time。
- [x] **CHK052** [Data model, data-model §2.1] `invite_expires_at` NOT NULL、无 DB 默认值；`CHECK (invite_expires_at > created_at)`。
- [x] **CHK053** [Data model, data-model §2.2] partial unique `(case_id, person_id) WHERE state IN ('PENDING','ACTIVE')` 可由 PostgreSQL 表达。
- [x] **CHK054** [Data model, research R-8 / data-model §2.2] terminal 历史可多条；DECLINED / EXPIRED / WITHDRAWN 后可创建新 invitation；terminal resource 不可 reactivate 与新 resource 创建被明确区分。
- [x] **CHK055** [Data model, spec FR-019 / FR-023 / plan D-12] participation 生命周期不写 `case_events`、不写 Evidence、不建第二张 audit 表。

---

## 8. Invite Token Security

- [x] **CHK056** [Security, spec FR-006 / plan D-2 / research R-6] token 不可猜测 / 枚举；使用 HMAC-SHA256 + server-only secret，32-byte output，base64url。
- [x] **CHK057** [Security, plan D-2 / D-9 / research R-19] token 明文不在 `case_participants`、`idempotency_keys`、audit、日志中；DB 只存 `sha256(token)`。
- [x] **CHK058** [Security, spec FR-006 / plan D-7] token possession ≠ identity proof；仅持有 / 转发 token 不能变成 P1、不能 accept / decline、不能获得 participant capability。
- [x] **CHK059** [Security, plan D-11 / data-model §3.2] `case_participants_invite_token_read` 只用于 SELECT，且 `state='PENDING'`；terminal 行不通过 token context 可见。
- [x] **CHK060** [Security, plan D-11 / data-model §3.4] token context 使用 transaction-local `set_config(..., true)`；不跨连接泄漏；`set_invite_token_context` 不设置 family / person / account。
- [x] **CHK061** [Security, plan D-11 / data-model §3.3] `case_participant_invite_public` 使用 `security_invoker = true`；只含 `participation_id` / `state` / `expires_at` / `created_at`；predicate 为 `state='PENDING' AND invite_expires_at > now()`；effective-expired PENDING 不返回 200。
- [x] **CHK062** [Security, plan D-11 / auth contract §4.4] token lookup repository 只查询 safe view；guard test 断言不使用 `SELECT *` / base table；DB view + repository + OpenAPI response 形成三层边界。
- [x] **CHK063** [Security, OpenAPI / data-model] OpenAPI `ParticipationInvitePublicView` 不包含 personId / caseId / familyId / guardian / age / consent / compliance。
- [x] **CHK064** [Security, research R-7 / auth contract §4.6] 不使用 `SECURITY DEFINER` 绕过 RLS；若未来使用，必须明确 search_path / privileges。当前方案使用 SECURITY INVOKER + RLS。
- [x] **CHK065** [Security, plan D-9 / research R-19] invite create 先 `SELECT uuidv7()` 预分配 `participationId`；snapshot 保存 `participationId` + redacted metadata；same-key replay 由 `participationId` + token secret 重新派生同一 token；不得把 token 明文写入 idempotency snapshot。
- [x] **CHK066** [Security, plan D-2 / D-5] token 只在 create 响应与 same-key replay 返回；其他读取 / 审计 / 日志不返回；这一语义在 OpenAPI 描述中明确。

---

## 9. API Surface

- [x] **CHK067** [API, spec FR-026 / plan D-5 / OpenAPI] public API 恰为 6 条 route：create invite / read invite / accept / decline / withdraw / get participation。
- [x] **CHK068** [API, spec FR-003 / OpenAPI] `POST /cases/:id/participation-invites` 需要认证；请求体 strict 仅 `personId` + `idempotencyKey`。
- [x] **CHK069** [API, spec FR-005 / FR-006 / OpenAPI] `GET /participation-invites/:token` 未认证；只返回 `participationId` / `state` / `expiresAt` / generic notice。
- [x] **CHK070** [API, spec FR-005 / OpenAPI] `POST /participation-invites/:token/accept` 需要认证；请求体 strict 仅 `idempotencyKey`。
- [x] **CHK071** [API, spec FR-011 / FR-013 / OpenAPI] `POST /participations/:id/decline` 与 `/withdraw` 需要认证；请求体 strict 仅 `idempotencyKey`。
- [x] **CHK072** [API, spec FR-027 / OpenAPI] `GET /participations/:id` 需要认证；只返回 participation 最小状态，不返回 Case 内容 / Family 详情 / Evidence / 其他 Participant。
- [x] **CHK073** [API, spec FR-026 / FR-028 / OpenAPI] 不存在 generic participant update / response / delete / restore / manager cancel / Evidence 端点；不存在未文档化 route。
- [x] **CHK074** [API, plan D-13 / OpenAPI] 错误码完整：`CASE_NOT_FOUND` / `CURRENT_FAMILY_NOT_FOUND` / `CURRENT_FAMILY_AMBIGUOUS` / `PARTICIPATION_TARGET_INELIGIBLE` / `PARTICIPATION_ALREADY_EXISTS` / `INVITATION_NOT_AVAILABLE` / `PARTICIPATION_NOT_FOUND` / `PARTICIPATION_STATE_CONFLICT` / `IDEMPOTENCY_PAYLOAD_MISMATCH` / `VALIDATION_ERROR` / `INTERNAL_ERROR`。
- [x] **CHK075** [API, spec FR-015 / OpenAPI] strict schema 拒绝客户端提交 familyId / caseId / state / primary / person identity override / expiresAt / role / token 等越权字段；422 零写入。
- [x] **CHK076** [API, spec FR-016 / auth contract §5] 同 key + 不同 canonical payload → 409 `IDEMPOTENCY_PAYLOAD_MISMATCH`；该分支在本 Slice 是 HTTP 可达的，必须真实验证。

---

## 10. Authorization

- [x] **CHK077** [Authorization, spec FR-020 / plan D-6] 所有 participation action 只经过单一 `authorize()`；不存在 `authorizeParticipation()` 第二套权限入口。
- [x] **CHK078** [Authorization, spec FR-003 / plan D-6] Case manager = 创建 Family 的 adult Person；完全来自 Slice 1 / 2 冻结语义；没有新建 Case role / Family member role / manager enum。
- [x] **CHK079** [Authorization, spec FR-020 / plan D-6] target / participant 判定 = `actor.personId === participation.person_id`；不读 / 不写 `persons.account_id`。
- [x] **CHK080** [Authorization, plan D-6] manager actions 使用 `FAMILY_MANAGEMENT`；self actions 使用 `PARTICIPATION`；resource 使用 `PARTICIPATION`。
- [x] **CHK081** [Authorization, plan D-6 / lifecycle contract] `actor.personId === participation.person_id` 只解决 self identity；不能单独替代 Case / Family / state / purpose / Compliance 判断；GET self 在返回前必须调用 `authorize(PARTICIPATION_READ_SELF)`；self RLS match 不是 authorization success。
- [x] **CHK082** [Authorization, spec §7.7A / plan D-6] guardian 不是 manager，也不是 participant；guardian relationship 不自动授予 Case read / participant read / participant management。
- [x] **CHK083** [Authorization, spec FR-018 / plan D-6] 活跃 Participant 不继承 Case manager 能力；不能调用 manager-only Case 命令。
- [x] **CHK084** [Authorization, spec FR-025 / plan D-6] participation row 只是 authorization substrate；不构成 Case / Evidence / Formulation / Plan 的读取授权。

---

## 11. Idempotency & Concurrency

- [x] **CHK085** [Idempotency, spec FR-016 / plan D-9] 复用 `idempotency_keys` + `runIdempotentCommand`；新增 4 个 command type：`PARTICIPATION_INVITE_CREATE` / `PARTICIPATION_ACCEPT` / `PARTICIPATION_DECLINE` / `PARTICIPATION_WITHDRAW`。
- [x] **CHK086** [Idempotency, spec FR-016 / plan D-9] same key + same payload → replay 原结果；different payload → 409；concurrent same key → 只有一个业务结果。
- [x] **CHK087** [Idempotency, plan D-9 / research R-19] invite create replay 返回同一 `participationId` + 同一 `inviteToken`；snapshot 不含 token 明文；token 由 `participationId` + secret 重新派生。
- [x] **CHK088** [Concurrency, plan D-10] double accept：同 key replay；不同 key 幂等收敛到当前 ACTIVE；active 至多一个。
- [x] **CHK089** [Concurrency, plan D-10] double decline：第一个 PENDING→DECLINED；第二个返回当前 DECLINED；不复活。
- [x] **CHK090** [Concurrency, plan D-10] double withdraw / withdraw replay：第一个 ACTIVE→WITHDRAWN；第二个返回当前 WITHDRAWN；不复活。
- [x] **CHK091** [Concurrency, plan D-10] accept vs decline：行锁；至多一个成功；失败方 409 或 404；不产生矛盾结果。
- [x] **CHK092** [Concurrency, plan D-10] accept vs expiry：过期者先物化 EXPIRED + audit；不产生 active；另一个看到 EXPIRED。
- [x] **CHK093** [Concurrency, plan D-10] decline vs expiry：只有一个 terminal（DECLINED 或 EXPIRED）；不互相覆盖。
- [x] **CHK094** [Concurrency, plan D-10] concurrent invitation creation：partial unique index 兜底；一个成功，另一个 409 `PARTICIPATION_ALREADY_EXISTS`；无重复 live resource。
- [x] **CHK095** [Concurrency, plan D-10] identity / compliance changes during accept：行锁 + 重新读取 current gate；不再满足 → 404 generic；不产生 active；不部分写入。
- [x] **CHK096** [Concurrency, plan D-10 / lifecycle contract N-11] 统一为“至多一个成功状态转换（0 或 1）”；无满足条件时 0 合法；不重复 005 的 `at most one → exactly one` 错误。

---

## 12. RLS

- [x] **CHK097** [RLS, data-model §3.1] `case_participants` ENABLE + FORCE ROW LEVEL SECURITY。
- [x] **CHK098** [RLS, data-model §3.5] `xiaoshuyin_app` 非 table owner、`NOBYPASSRLS`；最小 grants：`case_participants` SELECT / INSERT / UPDATE（无 DELETE），safe view SELECT，enum USAGE，function EXECUTE。
- [x] **CHK099** [RLS, data-model §3.2] family scope `family_id = app_family_id()` 覆盖合法 family context 的读写。
- [x] **CHK100** [RLS, data-model §3.2] self read `person_id = app_person_id()` 只允许 participant 本人读取自己的 participation / terminal history。
- [x] **CHK101** [RLS, data-model §3.2] token read `state='PENDING' AND invite_token_hash = app_invite_token_hash()`；terminal 行不通过 token context 可见。
- [x] **CHK102** [RLS, data-model §3.2] 无任何上下文 → 谓词 NULL → SELECT 0 行 / 写入拒绝；不是默认放行。
- [x] **CHK103** [RLS, data-model §3.2] token / self policy 不授予 INSERT / UPDATE / DELETE；只有 family scope 允许写。
- [x] **CHK104** [RLS, plan D-11 / auth contract §4] family / self / token policy 的 OR 组合不会意外扩大跨家庭访问；RLS 是 defense-in-depth，业务边界仍由 `authorize()` 判定；self expiry 物化使用 server-trusted `participation.family_id` 建立 family write context；不新增 self UPDATE policy。

---

## 13. Audit

- [x] **CHK105** [Audit, spec FR-023 / plan D-12] 5 类 participation 事件存在：invite created / accepted / declined / expired / withdrawn；`resource_type = CASE_PARTICIPANT`。
- [x] **CHK106** [Audit, plan D-12] actor attribution 真实：invite 由 manager account；accept / decline / withdraw 由 target account；expiry 由触发物化的已认证 account。
- [x] **CHK107** [Audit, plan D-12 / D-14] 每个成功状态转换与 business 写入同一事务；replay 不追加第二组 audit；expiry 物化 exactly-once；GET self expiry audit 依赖合法 family write context；0 行不重复 audit。
- [x] **CHK108** [Audit, plan D-12] 不记录 token / token hash / wechat_openid / 家长原话 / 不必要 PII；不为 audit 创建 Person / Account。
- [x] **CHK109** [Audit, spec FR-023 / plan D-12] 不写 `case_events` 作为第二套 audit；不建 `participation_audit_events` 等第二张 audit 表。
- [x] **CHK110** [Audit, plan D-12 / lifecycle contract §5] expiry 的 `occurred_at` 是物化时间，metadata 中的 `expiresAt` 是真实到期时间；不伪造成到期瞬间。

---

## 14. Anti-enumeration

- [x] **CHK111** [Anti-enumeration, spec FR-022 / plan D-13] 建邀请：Case 不存在 / 属于其它 Family / actor 非 manager → 统一 `404 CASE_NOT_FOUND`；不泄露 Case 是否存在。
- [x] **CHK112** [Anti-enumeration, spec FR-006 / plan D-13] invite lookup：无效 / 过期 / 已拒绝 / 已退出 / 不存在 → 统一 `404 INVITATION_NOT_AVAILABLE`；不区分原因。
- [x] **CHK113** [Anti-enumeration, spec FR-006 / FR-022 / plan D-13] accept / decline / withdraw / GET：未授权 / 非 target / 非 manager / 不存在 → 统一 `404 PARTICIPATION_NOT_FOUND`。
- [x] **CHK114** [Anti-enumeration, plan D-13] `409 PARTICIPATION_STATE_CONFLICT` 只在 actor 已经证明自己有权知道该 resource 后出现；只返回 `currentState`，不含 Case / Family / guardian / consent。
- [x] **CHK115** [Anti-enumeration, spec FR-006 / FR-022 / OpenAPI] 404 / 403 / 409 响应体不含 target Person / Family / Case / guardian / age / consent / compliance 字段。
- [x] **CHK116** [Anti-enumeration, spec FR-006 / research R-3] “下一步可继续动作”不成为 Case C / guardian / consent 的 oracle；accept 层不区分 Case B / C。

---

## 15. Migration / OpenAPI / Verification / Dependency

- [x] **CHK117** [Migration, plan D-3] migration 编号不硬编码未来状态；基于 final merged main 的最新编号（预期 `004_case_participant_core.sql`）；不修改历史 migration。
- [x] **CHK118** [Migration, data-model §7] enum / table / FK / index / RLS / GRANT 顺序成立；被引用唯一键在复合 FK 前存在。
- [x] **CHK119** [Migration, data-model §7] 第 2 步 `(person_id, family_id)` 唯一键先于第 4 步复合 FK；否则 PostgreSQL 无法建立 FK。
- [x] **CHK120** [Migration, data-model §4] 扩展 `business_audit_events.event_type` / `resource_type` 与 `idempotency_keys.command_type` 时保留所有既有允许值；不删除历史值。
- [x] **CHK121** [Migration, data-model §3.3/§3.5] RLS function / safe view / GRANT 可重放；空库 migration 可重建。
- [x] **CHK122** [Migration, plan D-3 / Rollback] 失败整体回滚；不手工部分应用；rollback / forward-fix 策略与仓库规范一致。
- [x] **CHK123** [OpenAPI, validation] OpenAPI 实际 parse 通过：6 paths / 22 schemas。
- [x] **CHK124** [OpenAPI, data-model §1] state enum 与 data model 一致：PENDING / ACTIVE / DECLINED / EXPIRED / WITHDRAWN。
- [x] **CHK125** [OpenAPI, plan D-5] OpenAPI 与 Plan route table 一致；无未文档化 route；无 `/responses`。
- [x] **CHK126** [Verification, plan Verification / quickstart] Quickstart 覆盖 31 FR / 19 Acceptance / 15 SC 的验证路径；不依赖 UI / AI / Evidence。
- [x] **CHK127** [Verification, quickstart §6] Case C E2E 必须真实经过 005 runtime；005 runtime 不存在时明确 `BLOCKED`，禁止用直接写 `persons.account_id` 冒充。
- [x] **CHK128** [Dependency, plan D-17] Slice 1 已 MERGED 到 main；Slice 2 仍 NOT MERGED；005 contract MERGED；005 runtime NOT IMPLEMENTED。
- [x] **CHK129** [Dependency, plan D-17] Slice 3 不是 Slice 4 Implement dependency；不因编号自动要求 merge。
- [x] **CHK130** [Dependency, plan D-17] IMPLEMENT GATE = BLOCKED；Checklist PASS 不得打开 Implement Gate。

---

## 16. Traceability Matrix

### FR 31 / 31 covered

| FR | 主要 CHK | 技术落点 |
|---|---|---|
| FR-001 | CHK001 / CHK046 | plan D-2 / D-6；data-model §1/§2 |
| FR-002 | CHK046 / CHK049 / CHK050 | plan D-2/D-3；data-model §2.2 |
| FR-003 | CHK068 / CHK078 | plan D-6；OpenAPI create invite |
| FR-004 | CHK006 / CHK050 | plan D-2/D-8；composite FK |
| FR-005 | CHK020 / CHK021 / CHK069 / CHK070 | plan D-7；OpenAPI |
| FR-006 | CHK025 / CHK056 / CHK059 / CHK112 | plan D-11/D-13；OpenAPI |
| FR-007 | CHK011 / CHK022 / CHK088 | plan D-4/D-10 |
| FR-008 | CHK083 / CHK084 | plan D-6 |
| FR-009 | CHK019—CHK024 | plan D-7 |
| FR-010 | CHK028 / CHK029 / CHK034 | plan D-8 |
| FR-011 | CHK013 / CHK031 / CHK089 | plan D-4/D-8/D-10 |
| FR-012 | CHK016 / CHK105 / CHK107 | plan D-4/D-12 |
| FR-013 | CHK015 / CHK031 / CHK090 | plan D-4/D-8/D-10 |
| FR-014 | CHK018 / CHK105 / CHK109 | plan D-4/D-12 |
| FR-015 | CHK016 / CHK036—CHK045 | plan D-4/D-14 |
| FR-016 | CHK085—CHK087 | plan D-9 |
| FR-017 | CHK084 | plan D-6 |
| FR-018 | CHK083 | plan D-6 |
| FR-019 | CHK055 / CHK109 | plan D-12 |
| FR-020 | CHK077—CHK084 | plan D-6 |
| FR-021 | CHK097—CHK104 | plan D-11 |
| FR-022 | CHK111—CHK115 | plan D-13 |
| FR-023 | CHK105—CHK110 | plan D-12 |
| FR-024 | CHK019 / CHK027 / CHK034 | plan D-7/D-8 |
| FR-025 | CHK084 | plan D-6 |
| FR-026 | CHK067—CHK075 | plan D-5；OpenAPI |
| FR-027 | CHK072 | plan D-5；OpenAPI |
| FR-028 | CHK003 / CHK073 | plan D-5；OpenAPI |
| FR-029 | CHK050 / CHK053 / CHK054 | data-model §2.2 |
| FR-030 | CHK008 / CHK027 / CHK128 / CHK130 | plan D-17 |
| FR-031 | CHK107 / CHK122 | plan D-9/D-10/D-12 |

### Acceptance 19 / 19 covered

| Acceptance | 主要 CHK |
|---|---|
| 1 Happy path | CHK019—CHK024 / CHK070 |
| 2 Decline | CHK013 / CHK031 / CHK089 |
| 3 Withdraw | CHK014 / CHK031 / CHK090 |
| 4 Duplicate / concurrent accept | CHK088 |
| 5 Wrong user token | CHK025 / CHK058 / CHK113 |
| 6 Cross Family | CHK006 / CHK050 / CHK111 |
| 7 UNDER_14 illegal path | CHK028 / CHK029 / CHK033 |
| 8 Non-manager cannot invite | CHK068 / CHK078 / CHK111 |
| 9 Invite create anti-enumeration | CHK111 |
| 10 Unauthorized token lookup | CHK063 / CHK112 / CHK115 |
| 11 Terminal invite cannot reactivate | CHK016 / CHK114 |
| 12 No Case-wide access on accept | CHK083 / CHK084 |
| 13 No Evidence side effect | CHK055 |
| 14 No duplicate Person / binding | CHK020—CHK024 |
| 15 Auditability | CHK105—CHK110 |
| 16 Idempotent command outcome | CHK085—CHK087 |
| 17 Route surface enumeration | CHK067 / CHK073 / CHK125 |
| 18 RLS / cross-family hard block | CHK097—CHK104 |
| 19 Implement gate | CHK128—CHK130 |

### SC 15 / 15 covered

| SC | 主要 CHK |
|---|---|
| SC-001 | CHK006 / CHK049 / CHK050 / CHK104 |
| SC-002 | CHK088 / CHK096 |
| SC-003 | CHK083 |
| SC-004 | CHK055 |
| SC-005 | CHK016 |
| SC-006 | CHK063 / CHK112 / CHK115 |
| SC-007 | CHK067 / CHK073 / CHK125 |
| SC-008 | CHK020—CHK024 |
| SC-009 | CHK013 / CHK031 / CHK089 |
| SC-010 | CHK014 / CHK031 / CHK090 |
| SC-011 | CHK111 |
| SC-012 | CHK028 / CHK029 / CHK033 |
| SC-013 | CHK105—CHK110 |
| SC-014 | CHK085—CHK087 / CHK096 |
| SC-015 | CHK003 / CHK073 / CHK117—CHK125 |

### D-1 — D-17 covered

| Decision | CHK |
|---|---|
| D-1 module ownership | CHK056 / CHK065 / CHK067 |
| D-2 data model | CHK046—CHK055 |
| D-3 migration | CHK117—CHK122 |
| D-4 state model | CHK009—CHK018 / CHK042 |
| D-5 API | CHK067—CHK076 |
| D-6 authorization | CHK077—CHK084 |
| D-7 identity prerequisite | CHK019—CHK027 |
| D-8 Compliance / Consent | CHK028—CHK035 |
| D-9 idempotency | CHK085—CHK087 |
| D-10 concurrency | CHK088—CHK096 |
| D-11 RLS | CHK097—CHK104 / CHK059—CHK064 |
| D-12 audit | CHK105—CHK110 |
| D-13 anti-enumeration / failure | CHK111—CHK116 |
| D-14 TTL / expiry | CHK036—CHK045 |
| D-15 testing | CHK126 / CHK127 |
| D-16 observability | CHK108 |
| D-17 dependencies / Implement gate | CHK008 / CHK027 / CHK128—CHK130 |

---

## 17. Validation

本阶段实际执行：

```bash
node .specify/scripts/validate-governance.mjs
node .specify/scripts/tests/run-governance-tests.mjs
ruby -ryaml -e 'YAML.load_file("specs/004-case-participant-core/contracts/participation-api.openapi.yaml")'
git diff --name-only 3bc422506049761cb714cb9628622509e41e37b0..HEAD -- Docs specs/004-case-participant-core/spec.md
git diff --name-only 3bc422506049761cb714cb9628622509e41e37b0..HEAD -- apps packages db tests
git status --porcelain=v1
```

期望 / 实际：

| 检查 | 结果 |
|---|---|
| Spec governance | PASS |
| Governance self-test | 15 / 15 PASS |
| OpenAPI YAML parse | PASS（6 paths / 22 schemas） |
| `spec.md` diff | 0 |
| `Docs/**` diff | 0 |
| runtime / migration / tests diff | 0 |
| `tasks.md` | absent at original Checklist stage；targeted re-validation base has tasks.md（read-only，unchanged） |
| working tree | clean（checklist commit 后） |

---

## 18. Final Status

```text
Checklist total: 130
PASS: 130
FAIL: 0
GAP: 0
```

```text
SLICE 4 CHECKLIST FINAL PASS
TARGETED CHECKLIST RE-VALIDATION PASS
READY FOR TASKS REMEDIATION
```

**边界**：Checklist PASS 不代表 Implement Gate OPEN。当前：

```text
Slice 1: MERGED + convergence evidence
Slice 2: IMPLEMENTATION IN PROGRESS — NOT MERGED
005 contract: MERGED
005 runtime: REQUIRED FOR CASE C — NOT IMPLEMENTED
IMPLEMENT GATE = BLOCKED
```

Original Checklist 阶段未创建 `tasks.md`；targeted re-validation 中 `tasks.md` 为只读输入，未修改。未执行 Analyze / Implement / Converge，未修改 `spec.md` / `Docs/**` / runtime / migration / tests。

---

## 19. Targeted Re-Validation Log — 2026-11-06

**Base**: `eb3ea23e7a3f4f4ec2fe89be45725cc614326367`

**Scope**: verify Plan Remediation findings C-01 / H-01 / H-02 / L-02 / L-05 and re-check F-01 / F-02 / F-03 / F-06 consistency. No full Checklist regeneration.

**Re-validated entries**:

```text
CHK042  expiry materialization + GET self family context
CHK051  token hash / preallocated participationId / DB server time
CHK061  safe view security_invoker + expiry predicate
CHK065  invite create replay / redacted snapshot
CHK077  single authorize()
CHK079  self identity
CHK081  GET self must authorize READ_SELF
CHK104  RLS OR composition / no self UPDATE policy
CHK107  audit exactly-once / family write context
CHK112  invite lookup expired -> 404
CHK130  Implement Gate still BLOCKED
```

**Targeted results**:

```text
C-01 RESOLVED
H-01 RESOLVED
H-02 RESOLVED
L-02 RESOLVED
L-05 RESOLVED

F-01 PASS
F-02 PASS
F-03 PASS
F-06 PASS
```

**Evidence**:

- C-01: Plan D-2/D-9/D-14、data-model §2.1/§6.1、auth contract §6.1、research R-5/R-6/R-19、quickstart §3 均冻结 `SELECT uuidv7()` 预分配、token 先于 INSERT、explicit `id`、DB server time。
- H-01: data-model §3.2/§6.5、auth contract §6.4、lifecycle contract §6、research R-4、quickstart §4 均要求 `setFamilyContext(participation.family_id, actor.personId, 'PARTICIPATION')`；不新增 self UPDATE policy，不接收 client `familyId`。
- H-02: Plan D-6、data-model §6.5、auth contract §6.4、CHK077/CHK081 均要求 `authorize(PARTICIPATION_READ_SELF)`；self RLS match 不是 authorization success。
- L-02: Plan D-1 / Project Structure、auth contract §4.3 明确 `withInviteTokenTransaction` / `setInviteTokenContext` / `setFamilyContext` 三个 thin adapters；无 “if needed / 按需”。
- L-05: Plan D-5/D-11/D-14、data-model §3.3、auth contract §4.4、lifecycle contract §6、quickstart §2 均冻结 view predicate `state='PENDING' AND invite_expires_at > now()`；token RLS 仍为 `state='PENDING'` 仅供已认证 accept/decline 物化。

**No new Plan gap**: C-01/H-01/H-02/L-02/L-05 未引入 new state / new route / new RBAC / Evidence / AI / notification / identity runtime / cross-Family participation。

**Deferred to Tasks Remediation**: M-01 Evidence boundary test、M-02 rollback test、M-03 participants-structure test、M-04 decline Case-status assertion、L-01 parallel test DB、L-03 traceability table、L-04 cross-family named test。These are not Plan-quality FAIL.

**Validation**:

```bash
node .specify/scripts/validate-governance.mjs
node .specify/scripts/tests/run-governance-tests.mjs
ruby -ryaml -e 'YAML.load_file("specs/004-case-participant-core/contracts/participation-api.openapi.yaml")'
```

```text
Spec governance validation PASS
Governance self-test PASS: 15/15 cases
OpenAPI YAML parse PASS: 6 paths / 22 schemas
working tree: clean
changed files: checklists/requirements-quality.md only
spec.md / plan.md / research.md / data-model.md / quickstart.md / contracts/** / tasks.md / Docs/** / runtime / migration / tests: unchanged
```

```text
TARGETED CHECKLIST RE-VALIDATION PASS
READY FOR TASKS REMEDIATION
```