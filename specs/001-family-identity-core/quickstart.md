# Quickstart — 001-family-identity-core（Plan 验证指南）

**Slice**: `specs/001-family-identity-core`
**Phase**: Phase 1（`Docs/V1技术设计.md` §38）
**状态**: Plan 阶段产物。此文档描述**实现完成后**如何验证本 Slice 成立；当前仓库尚无实现代码，因此本文所有命令在 Plan 阶段**均未执行**，不得作为已通过的证据。

---

## 0. 前置条件

| 项 | 要求 | 来源 |
|---|---|---|
| Node.js | `26.13.0`（exact） | §4.1 |
| 包管理器 | 仓库约定 `bun` | 项目约定 |
| PostgreSQL | `18`，原生 `uuidv7()` | §2 / §7.0 |
| Docker | 用于 Stage A Compose（PG18 + api） | §4 Stage A |
| 环境变量 | `DATABASE_URL`（app 角色）、`MIGRATION_DATABASE_URL`（migrator 角色）、`SESSION_SECRET`、`EVIDENCE_HASH_PEPPER` | 本 Plan |

```bash
# 角色与数据库由 Compose init 建立；Stage A 使用 §4 已定义的 PostgreSQL 18
docker compose -f docker-compose.stage-a.yml up -d postgres
```

**禁止**：把上述 secret 写进 repo、镜像或文档；`docker compose down -v` 会销毁本地数据，仅用于一次性环境。

---

## 1. 迁移与结构验证

```bash
# 1.1 应用 reviewed migration（以 migrator 角色）
bun run db:migrate

# 1.2 结构与 RLS 断言
bun run vitest run tests/db/rls.test.ts
bun run vitest run tests/db/constraints.test.ts
bun run vitest run tests/db/consent-structure.test.ts
bun run vitest run tests/db/cardinality.test.ts
```

期望（每条都是真实查询输出，不是描述）：

| 检查 | 期望 |
|---|---|
| `pg_class.relrowsecurity` / `relforcerowsecurity`（8 张作用域表） | 全部 `true` / `true` |
| `pg_roles.rolbypassrls`（`xiaoshuyin_app`） | `false` |
| 业务表 owner | `xiaoshuyin_migrator` |
| `persons` 列集合 | 不含 `family_id`、`source_kind` |
| `family_members` 列集合 | 不含任何 role/creator/guardian 列 |
| `profile_attribute` enum | 恰为 `{DISPLAY_NAME, RELATION_DESCRIPTOR}` |
| `age_band` enum | 恰为 `{ADULT, MINOR_14_17, UNDER_14, UNKNOWN}` |
| `guardian_consent_requests` 列集合 | 不含任何孩子 PII 列 |
| `uuidv7()` | 是 9 张表的 `id` 默认值（`person_compliance_profiles` 以 `person_id` 为主键，无独立 `id`） |
| 越权直连查询（三个 GUC 全未设） | `0` 行 |
| identity 上下文（仅 `app.account_id`）查询 `persons` | 只返回本账号绑定的那 1 行；查他人 person 为 `0` 行 |

---

## 2. 端到端主路径（手工 / curl）

启动：

```bash
bun run dev:api     # 默认 http://localhost:8787
```

### 2.1 登录 → 建家庭 → 取回身份

```bash
# ① 登录（测试环境用 fake provider：code 直接映射 openid）
curl -sX POST localhost:8787/api/v1/auth/wechat \
  -H 'content-type: application/json' \
  -d '{"code":"test-parent-a"}' | tee /tmp/login.json

TOKEN=$(jq -r .sessionToken /tmp/login.json)

# ② 建家庭（创建者 Person 同时建立）
curl -sX POST localhost:8787/api/v1/families \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -H "idempotency-key: fam-a-0001" \
  -d '{
        "displayName":"A 家",
        "creator":{
          "ageBand":"ADULT",
          "ageBandSource":"SELF_STATEMENT",
          "values":[{"attribute":"DISPLAY_NAME","value":"家长 A","source":"SELF_STATEMENT"}]
        }
      }' | tee /tmp/family.json

# ③ 当前身份
curl -s localhost:8787/api/v1/me -H "authorization: Bearer $TOKEN" | jq
```

**期望**：

- ① `person: null`（登录只建 Account）。
- ② 201，`isManager: true`。
- ③ account 有值，person 非空，`profile.ageBand = ADULT`，`values` 含一条 `DISPLAY_NAME`；响应中**不出现** `wechat_openid`。
- 重复 ② 同一 `Idempotency-Key` → 返回同一家庭，`memberCount` 不增加；同 key 改 payload → 409 `IDEMPOTENCY_PAYLOAD_MISMATCH`。

### 2.2 记录无账号成员（per-value provenance）

```bash
curl -sX POST localhost:8787/api/v1/families/$FAMILY_ID/members \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H "idempotency-key: mem-a-0001" \
  -d '{
        "ageBand":"MINOR_14_17",
        "ageBandSource":"GUARDIAN_OBSERVATION",
        "values":[
          {"attribute":"DISPLAY_NAME","value":"小雨","source":"GUARDIAN_RELAY"},
          {"attribute":"RELATION_DESCRIPTOR","value":"大女儿","source":"GUARDIAN_OBSERVATION"}
        ]
      }' | jq
```

**期望**：201；`accountBound: false`；两条资料的 `source` 不同且各自可追溯。

再补一条同属性不同来源：

```bash
curl -sX PATCH localhost:8787/api/v1/families/$FAMILY_ID/members/$PERSON_ID \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H "idempotency-key: mem-a-0002" \
  -d '{"values":[{"attribute":"DISPLAY_NAME","value":"小雨","source":"SELF_STATEMENT"}]}' | jq
```

**期望**：`values` 中 `DISPLAY_NAME` 出现**两条** `RECORDED`（`GUARDIAN_RELAY` 与 `SELF_STATEMENT` 并存），旧的未被覆盖。

### 2.3 UNDER_14 consent-first（核心路径）

```bash
# ① 发起最小 onboarding（不含孩子任何资料）
curl -sX POST localhost:8787/api/v1/compliance/guardian-consents/requests \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H "idempotency-key: req-a-0001" \
  -d '{"declaredAgeBand":"UNDER_14","noticeVersion":"2026-11-v1","channel":"TEST"}' \
  | tee /tmp/req.json

# ② 先验证：没有同意就建 UNDER_14 成员 → 必须失败
curl -s -o /tmp/deny.json -w '%{http_code}\n' \
  -X POST localhost:8787/api/v1/families/$FAMILY_ID/members \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H "idempotency-key: mem-a-0003" \
  -d '{"ageBand":"UNDER_14","ageBandSource":"GUARDIAN_OBSERVATION",
       "values":[{"attribute":"DISPLAY_NAME","value":"小树","source":"GUARDIAN_RELAY"}]}'
# 期望：403，code=GUARDIAN_CONSENT_REQUIRED

# ③ 成立同意
curl -sX POST localhost:8787/api/v1/compliance/guardian-consents \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H "idempotency-key: cons-a-0001" \
  -d "{\"onboardingRequestId\":\"$(jq -r .requestId /tmp/req.json)\",
       \"noticeVersion\":\"2026-11-v1\",\"accepted\":true}" | tee /tmp/consent.json

# ④ 再次建档（带 guardianConsentId）→ 应成功
curl -sX POST localhost:8787/api/v1/families/$FAMILY_ID/members \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H "idempotency-key: mem-a-0004" \
  -d "{\"ageBand\":\"UNDER_14\",\"ageBandSource\":\"GUARDIAN_OBSERVATION\",
       \"guardianConsentId\":\"$(jq -r .id /tmp/consent.json)\",
       \"values\":[{\"attribute\":\"DISPLAY_NAME\",\"value\":\"小树\",\"source\":\"GUARDIAN_RELAY\"}]}" \
  | tee /tmp/child.json

# ⑤ 撤回
curl -sX POST localhost:8787/api/v1/consents/$(jq -r .id /tmp/consent.json)/revoke \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H "idempotency-key: rev-a-0001" -d '{"reason":"测试撤回"}' | jq
```

**期望**：

- ① 201，返回 `requestId` / `noticeVersion` / `noticeHash` / `expiresAt`；**响应与库中都没有孩子姓名**。
- ② 403 `GUARDIAN_CONSENT_REQUIRED`，且之后查库：`persons` 与 `person_compliance_profiles` 中不存在该未成年人。
- ③ 201，`decision: GRANTED`，`version: 1`，`boundPersonId: null`。
- ④ 201，`profile.ageBand = UNDER_14`，`guardianConsentVersion = 1`，`guardianPersonId` = 家长本人。
- ⑤ 200，`decision: REVOKED`，`version: 2`，`supersedesId` = ①③ 的记录；此后 `assertMinorProcessingAllowed(childPersonId)` 返回 BLOCK。

### 2.4 跨家庭隔离

```bash
# 用第二个账号（另一家庭）的 token 访问 A 家
curl -s -o /tmp/x.json -w '%{http_code}\n' \
  localhost:8787/api/v1/families/$FAMILY_A_ID/members/$PERSON_A_ID \
  -H "authorization: Bearer $TOKEN_B" -X PATCH \
  -H 'content-type: application/json' -H "idempotency-key: x-0001" \
  -d '{"values":[{"attribute":"DISPLAY_NAME","value":"hack","source":"GUARDIAN_RELAY"}]}'
```

**期望**：403（或统一拒绝码），且 `/tmp/x.json` 中**不含** A 家的任何 id / 名称 / 成员字段。

---

## 3. 自动化验证

```bash
# 单元：不变量与纯规则
bun run vitest run tests/domain

# 集成：端点 + 真实 PostgreSQL 18
bun run vitest run tests/integration

# 数据库：RLS / 角色 / 约束 / 列存在性
bun run vitest run tests/db

# 契约：OpenAPI 可生成且无漂移
bun run openapi:check
```

映射到 spec 的 Acceptance Evidence：

| spec 验收项 | 命令 |
|---|---|
| 登录→身份→建家庭→成员关系 | `tests/integration/{auth,me,families}.test.ts` |
| 无账号成员与逐值来源 | `tests/domain/provenance.test.ts` + `tests/integration/members.test.ts` |
| 未成年人 consent-first | `tests/integration/consent-first.test.ts` + `tests/db/consent-structure.test.ts` |
| 跨家庭隔离 | `tests/integration/authorization.test.ts` + `tests/db/rls.test.ts` |
| 无家庭关系越权 | `tests/integration/authorization.test.ts` |
| 多 Family 基数 | `tests/db/cardinality.test.ts` |
| Account ↔ Person 1:1 | `tests/db/constraints.test.ts` |
| age_band UNKNOWN | `tests/domain/age-band.test.ts` |
| 幂等 | `tests/integration/idempotency.test.ts` |
| Migration 与 RLS 状态 | `tests/db/rls.test.ts` |
| uuidv7 主键 | `tests/db/rls.test.ts` |

---

## 4. 治理校验（每个 PR 必跑）

```bash
node .specify/scripts/validate-governance.mjs
node .specify/scripts/tests/run-governance-tests.mjs
node .specify/scripts/check-docs-guard.mjs --mode enforce --base origin/main --head HEAD
```

**期望**：三者 PASS。`Docs/**`、`spec.md`、`.specify/memory/**` 均无 diff。

---

## 5. 已知未验证项（不得当作已通过）

| 项 | 状态 | 说明 |
|---|---|---|
| 微信 `code2session` 真实调用 | **NOT VERIFIED** | 本 Slice 只验证适配器契约与 fake provider；真实平台验证属 §40 Platform 门槛 |
| Stage B（Lighthouse）/ Stage C（CloudBase Run + TencentDB） | **NOT VERIFIED** | 本 Slice 只覆盖 Stage A |
| pg-boss / 通知 / AI / RAG / RLS 性能压测 | **N/A** | 本 Slice 无对应能力 |
| 真实合规备案 / PIPIA 证据 | **N/A** | 属 §40 Compliance 门槛，spec 明确排除 |

任何一条若被写成「已通过」，即为违反 §VI 的虚假完成声明。

---

## 6. 失败排查顺序

1. **403 / 0 行**：先查是否走了 `withRlsTransaction`；再查 `app.set_family_context` 是否成功（非成员会抛 42501）。
2. **建成员 500**：多为 `persons` INSERT 的 `WITH CHECK` 失败——检查是否先插 membership（可延迟外键要求顺序）。
3. **同意 403 `NOTICE_VERSION_MISMATCH`**：`notices.ts` 与请求的 `noticeVersion` 不一致；hash 由代码计算，不是库里的历史值。
4. **撤回 409**：说明该 consent 不是 profile 当前指向的版本；必须撤回当前版本。
5. **幂等 409 `IDEMPOTENCY_PAYLOAD_MISMATCH`**：同 key 复用了不同 payload；换 key 或复原 payload。
6. **连接池串上下文**：99% 是事务外 `SET LOCAL`；改为 `withRlsTransaction`。
