# Quickstart — 004-case-participant-core（Plan 验证指南）

**Slice**: `specs/004-case-participant-core`
**Phase**: Phase 1（`Docs/V1技术设计.md` §38）
**状态**: Plan 阶段产物。本文描述**实现完成后**如何验证本 Slice；当前分支尚无参与实现代码，因此所有命令在 Plan 阶段**均未执行**，不得作为已通过的证据。

> 本指南只给验证路径，不给实现代码、migration 内容或完整测试套件。
> 契约细节见 `contracts/participation-api.openapi.yaml`、`contracts/authorization-rls-and-idempotency.md`、`contracts/participant-lifecycle-and-identity-seam.md`。
> 列级设计见 `data-model.md`。

---

## 0. 前置条件

| 项 | 要求 | 来源 |
|---|---|---|
| Node.js | `26.13.0`（exact） | §4.1 |
| 包管理器 | 仓库约定 `bun` | 项目约定 |
| PostgreSQL | `18`，原生 `uuidv7()` | §2 / §7.0 |
| Docker | Stage A Compose（PG18 + api） | §4 Stage A |
| 环境变量 | `DATABASE_URL`（app 角色）、`MIGRATION_DATABASE_URL`（migrator 角色）、`SESSION_SECRET`、`EVIDENCE_HASH_PEPPER`、`PARTICIPATION_INVITE_TTL_SECONDS`、`PARTICIPATION_INVITE_TOKEN_SECRET` | Slice 1 Plan + 本 Plan |
| Slice 1 | 已 merge `main`，final schema / RLS / 幂等 / 审计 green | Plan §D-17 |
| Slice 2 | `Implement complete → Independent Converge PASS → merged main` | Plan §D-17 |
| 005 contract | 已 merge `main`（PR #11） | Plan §D-17 |
| 005 runtime | Case C 端到端验收前必须可用；否则明确 `BLOCKED` | Plan §D-7 / §D-17 |

```bash
docker compose -f docker-compose.stage-a.yml up -d postgres
```

**禁止**：把 secret 写进 repo、镜像或文档；`docker compose down -v` 会销毁本地数据，仅用于一次性环境。

---

## 1. 发布前 Gate（Implement Gate）

在写任何 participation 代码前，先逐项现场验证：

```bash
git fetch origin

# G1: Slice 1 已在 main
git merge-base --is-ancestor origin/main HEAD

# G2: Slice 2 已 merge main（必须先满足；未满足 → BLOCKED）
git log --oneline origin/main | head -20
test -d specs/002-case-core

# G3: 005 contract 已 merge main
test -f specs/005-invited-identity-binding-contract/spec.md

# G4: 005 runtime 是否可用（invitation-aware bootstrap 端点 / attempt 存储）
#     若不存在 → 明确 BLOCKED，不得用直接写 persons.account_id 冒充 Case C
rg -n "invitation-aware|binding_attempt|participation-invites" apps packages db
```

**任一项失败**：
- Slice 2 未 merge → `BLOCKED — SLICE 2 IMPLEMENTATION DEPENDENCY`；
- 005 runtime 不可用 → `BLOCKED — 005 IDENTITY RUNTIME NOT AVAILABLE`；
- 不得私建替代 Case / Consent / RLS / 幂等 / 审计 / identity binding 基础设施。

---

## 2. 迁移与结构验证

```bash
# 2.1 应用 reviewed migration（migrator 角色）
bun run db:migrate

# 2.2 结构与 RLS 断言
bunx vitest run tests/db/participants-schema.test.ts
bunx vitest run tests/db/participants-constraints.test.ts
bunx vitest run tests/db/participants-rls.test.ts
bunx vitest run tests/db/participants-structure.test.ts
```

期望（每条都是真实查询输出，不是描述）：

| 检查 | 期望 |
|---|---|
| `case_participants` 列集合 | 恰为 `data-model.md` §2.1 清单；无 `role` / `account_id` / `age_band` / `guardian_person_id` / `consent_*` / `binding_state` |
| `case_participation_state` enum | 恰为 `{PENDING, ACTIVE, DECLINED, EXPIRED, WITHDRAWN}` |
| `case_participants` `relrowsecurity` / `relforcerowsecurity` | 全部 `true` |
| `xiaoshuyin_app` `rolbypassrls` | `false`；非 table owner |
| `case_participants_token_key` | `UNIQUE (invite_token_hash)` |
| `case_participants_one_live_per_case_person` | partial unique `(case_id, person_id) WHERE state IN ('PENDING','ACTIVE')` |
| 复合 FK | `(case_id, family_id) → cases(id, family_id)`；`(person_id, family_id) → family_members(person_id, family_id)` |
| state / timestamp CHECK | 每个 state 只允许对应时间戳组合；WITHDRAWN 必有 `accepted_at` |
| `id` 默认值 | `uuidv7()` |
| 无上下文直连查询 | `case_participants` 0 行；写入被拒 |
| token 上下文 | 只可见精确 PENDING token 行；`case_participant_invite_public` view 只含 `participation_id` / `state` / `expires_at` / `created_at` |
| token safe view | terminal 行不通过 token context 可见；view 不含 person_id / case_id / family_id / invite_token_hash |
| app role grants | `case_participants` SELECT/INSERT/UPDATE；`case_participant_invite_public` SELECT；无 DELETE |
| 越界表 | 不存在 `participation_invites` / `binding_attempts` / `participation_audit_events` / evidence writer 表 |
| 越界列 | 不存在 `role` / `visibility` / `deleted_at` / `account_id` / `binding_state` |
| 越界 CHECK 值 | `business_audit_events` 无 participation 以外的越界事件；`idempotency_keys.command_type` 只多 4 个 participation command |

---

## 3. API 主路径（手工 / curl）

> 以下只给路径；具体请求体 / 响应以 `contracts/participation-api.openapi.yaml` 为准。

```bash
# 3.1 建邀请（Case manager）
curl -sS -X POST "$API/api/v1/cases/$CASE_ID/participation-invites" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"personId":"'"$TARGET_PERSON_ID"'","idempotencyKey":"invite-0001"}'

# 3.2 建邀请 same-key replay（token 语义）
# 重复 3.1 的同一 idempotencyKey / body；期望同一 participationId + 同一 inviteToken
curl -sS -X POST "$API/api/v1/cases/$CASE_ID/participation-invites" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"personId":"'"$TARGET_PERSON_ID"'","idempotencyKey":"invite-0001"}'

# 3.3 目标查看邀请（未认证）
curl -sS "$API/api/v1/participation-invites/$INVITE_TOKEN"

# 3.3 接受（target；Case B 正确 Account / Case C binding 已 COMMITTED）
curl -sS -X POST "$API/api/v1/participation-invites/$INVITE_TOKEN/accept" \
  -H "Authorization: Bearer $TARGET_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"idempotencyKey":"accept-0001"}'

# 3.4 拒绝（target；pending）
curl -sS -X POST "$API/api/v1/participations/$PARTICIPATION_ID/decline" \
  -H "Authorization: Bearer $TARGET_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"idempotencyKey":"decline-0001"}'

# 3.5 退出（active participant）
curl -sS -X POST "$API/api/v1/participations/$PARTICIPATION_ID/withdraw" \
  -H "Authorization: Bearer $TARGET_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"idempotencyKey":"withdraw-0001"}'

# 3.6 读取最小状态（participant 或 manager）
curl -sS "$API/api/v1/participations/$PARTICIPATION_ID" \
  -H "Authorization: Bearer $TARGET_TOKEN"
```

**期望**：
- 建邀请 201；same-key replay 返回同一 `participationId` + 同一 `inviteToken`；其他读取不返回 token；token 明文不落库；
- GET invite 200 只含 `participationId` / `state` / `expiresAt` / `notice`；
- accept 200 → `state = ACTIVE`；重复同 key → 原结果；不同 key → 200 当前 ACTIVE；
- decline 200 → `state = DECLINED`；Case 不被自动关闭；
- withdraw 200 → `state = WITHDRAWN`；`acceptedAt` 保留；
- GET 200 只含最小字段；无 Case / Family / Evidence 字段；
- 无效 token / 非 target / 跨 Family → 统一 404，无敏感字段。

---

## 4. 关键反向路径

```bash
# Case B wrong Account
# → accept 404 PARTICIPATION_NOT_FOUND；无 active；无 rebind

# Case C binding PENDING / terminal
# → accept 404 PARTICIPATION_NOT_FOUND；active = 0；generic

# forwarded invite + wrong candidate
# → 不能 become P1；不能 accept / decline；无 target 信息

# 普通登录先行 A↔P2，再打开 P1 邀请
# → accept 404；A↔P2 / P1 不变；无 merge / rebind

# UNDER_14 current consent 失效
# → 建邀请 403 PARTICIPATION_TARGET_INELIGIBLE；accept generic 404；无 active

# accept vs decline 并发
# → 至多一个合法结果（0 或 1）；失败方 409 PARTICIPATION_STATE_CONFLICT

# accept vs expiry
# → 到期后无 ACTIVE；EXPIRED 物化 + audit
# → 并发两个 GET：只有 1 个 PARTICIPATION_EXPIRED audit；另一个看到已物化状态
# → 到期后从未访问：状态可派生为 EXPIRED，但不自动写 audit

# withdraw before accept
# → 409；状态仍 PENDING

# terminal reactivation
# → DECLINED / EXPIRED / WITHDRAWN 再 accept 失败；无复活

# Participant 调 GET /api/v1/cases/:id
# → 按 Slice 2 manager-only 语义失败；无 Case 数据

# accept / decline / withdraw 后 Evidence 计数
# → assertions / observations +0
```

---

## 5. 测试命令

```bash
# 5.1 domain / authorization
bunx vitest run tests/domain/participants-domain.test.ts
bunx vitest run tests/domain/participants-authorization.test.ts

# 5.2 integration
bunx vitest run tests/integration/participations-invite.test.ts
bunx vitest run tests/integration/participations-invite-lookup.test.ts
bunx vitest run tests/integration/participations-accept.test.ts
bunx vitest run tests/integration/participations-accept-concurrency.test.ts
bunx vitest run tests/integration/participations-decline.test.ts
bunx vitest run tests/integration/participations-withdraw.test.ts
bunx vitest run tests/integration/participations-expiry.test.ts
bunx vitest run tests/integration/participations-read.test.ts
bunx vitest run tests/integration/participations-authorization.test.ts
bunx vitest run tests/integration/participations-identity-seam.test.ts
bunx vitest run tests/integration/participations-compliance.test.ts
bunx vitest run tests/integration/participations-audit.test.ts
bunx vitest run tests/integration/participations-idempotency.test.ts
bunx vitest run tests/integration/participations-anti-enumeration.test.ts
bunx vitest run tests/integration/participations-scope.test.ts
bunx vitest run tests/integration/participations-route-surface.test.ts

# 5.3 DB / RLS / 并发
bunx vitest run tests/db/participants-schema.test.ts
bunx vitest run tests/db/participants-constraints.test.ts
bunx vitest run tests/db/participants-rls.test.ts
bunx vitest run tests/db/participants-evidence-boundary.test.ts
bunx vitest run tests/db/participants-structure.test.ts

# 5.4 API contract
bun run openapi:generate
bun run openapi:check

# 5.5 全量
bun run typecheck
bun run guard:static
bunx vitest run
bun run db:evidence

# 5.6 治理
node .specify/scripts/validate-governance.mjs
node .specify/scripts/tests/run-governance-tests.mjs
```

**期望**：
- 所有测试 0 failed / 0 skipped；
- `openapi:check` PASS，participation operations 恰为 6；
- `typecheck` / `guard:static` PASS；
- `db:evidence` PASS（RLS / role / uuidv7 / 结构输出真实）；
- governance PASS；self-test 全 PASS；
- `Docs/**` diff = 0。

---

## 6. 005 runtime 集成检查（Case C）

```bash
# 必须在 005 runtime 已实现的基线执行；否则 BLOCKED
# 1) P1 存在、Account = none
# 2) 从 participation invitation 进入 005 invitation-aware bootstrap
# 3) candidate 认证 → Gate 1 → Phase B → 双确认 → Gate 2 → COMMITTED
# 4) binding COMMITTED 后：
#    - active participation 仍为 0
#    - Actor 的 personId = P1
#    - 调用 accept 才 PENDING → ACTIVE
# 5) binding PENDING / terminal：
#    - accept 404 generic
#    - active = 0
#    - 不产生 P2 / 普通会话 / active participation
```

**禁止**：
- 用直接写 `persons.account_id` 冒充 Case C 端到端；
- 用普通 `/api/v1/auth/wechat` 先创建 P2；
- 在没有 005 runtime 的情况下声称 Case C PASS。

---

## 7. 证据归档

Implement / Converge 必须保留：
- 迁移前后 `pg_class` / `pg_policies` / `pg_constraint` / `information_schema.columns` 真实输出；
- RLS 无上下文 / 错误 Family / token 上下文的真实查询结果；
- 并发测试真实输出（double accept / accept vs decline / accept vs expiry）；
- OpenAPI 两次生成 hash 一致性 + operation 数量；
- governance / self-test 输出；
- `Docs/**` / `spec.md` diff = 0 的命令输出；
- 005 runtime 集成结果（或明确 `BLOCKED`）。

**不得**：
- 用文档描述代替命令输出；
- 用 mock 代替真实 DB / RLS / 并发；
- 为了让测试变绿而削弱断言或修改冻结期望。