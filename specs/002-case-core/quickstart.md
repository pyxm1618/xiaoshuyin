# Quickstart — 002-case-core（Plan 验证指南）

**Slice**: `specs/002-case-core`
**Phase**: Phase 1（`Docs/V1技术设计.md` §38）
**状态**: Slice 2 已存在旧 Slice 1 基线上的 Case implementation；该 implementation 在 **Post-Slice1 Final reconciliation 完成前不得视为最终验证状态**。本文命令在 reconciliation 完成前**未执行**，不得作为已通过的证据。

> 本指南只给验证路径，不给实现代码、migration 内容或完整测试套件。
> 契约细节见 `contracts/cases-api.openapi.yaml`、`contracts/authorization-rls-and-idempotency.md`、`contracts/case-events-and-business-audit.md`。
> 列级设计见 `data-model.md`。

---

## 0. 前置条件

| 项 | 要求 | 来源 |
|---|---|---|
| Node.js | `26.13.0`（exact） | §4.1 |
| 包管理器 | 仓库约定 `bun` | 项目约定 |
| PostgreSQL | `18`，原生 `uuidv7()` | §2 / §7.0 |
| Docker | Stage A Compose（PG18 + api） | §4 Stage A |
| 环境变量 | `DATABASE_URL`（app 角色）、`MIGRATION_DATABASE_URL`（migrator 角色）、`SESSION_SECRET`、`EVIDENCE_HASH_PEPPER`、`WECHAT_APP_ID`、`WECHAT_APP_SECRET` | Slice 1 Final `runtime-env.ts` |
| Slice 1 | 已 CLOSED（Final Audit II PASS、PR #13 merged main、post-merge CI PASS）；final schema / RLS / 幂等 / 审计 green；current Family 解析具备确定性语义（G11） | Plan §0.2 G1—G11 |

```bash
# 角色与数据库由 Compose init 建立，Stage A 使用 PostgreSQL 18
docker compose -f docker-compose.stage-a.yml up -d postgres
```

**禁止**：把 secret 写进 repo、镜像或文档；`docker compose down -v` 会销毁本地数据，仅用于一次性环境。

---

## 1. 发布前 Gate（Implement Gate）

> **Post-Slice1 Final（2026-11-07）**：Slice 1 已 CLOSED。第 1–3 项已满足；第 4–8 项是下一阶段开发 AI 的硬前置。

| # | Gate | 状态 |
|---|---|---|
| 1 | Slice 1 Final Audit II PASS | 已满足 |
| 2 | Slice 1 merged `main`（`ee9d07e`） | 已满足 |
| 3 | Slice 1 post-merge CI PASS | 已满足 |
| 4 | merge latest `main` into `feat/002-case-core` | 下一阶段 |
| 5 | resolve shared-infrastructure conflicts | 下一阶段 |
| 6 | preserve Slice 1 Final guarantees | 下一阶段 |
| 7 | adapt Slice 2 idempotency contract to header | 下一阶段 |
| 8 | full regression | 下一阶段 |

在写任何 Case 代码前，先逐项现场验证 Slice 1 Final：

```bash
# G1/G2/G4：Slice 1 已合并；Slice 2 与最终 main 正常 merge（禁止 rebase / force push）
git fetch origin
git checkout feat/002-case-core
git merge origin/main
git merge-base --is-ancestor origin/main HEAD   # 必须成功

# G3：真实 schema
psql "$MIGRATION_DATABASE_URL" -c "\d families" -c "\d family_members" \
  -c "\d business_audit_events" -c "\d idempotency_keys"

# G6—G8：Slice 1 Final 测试
bunx vitest run tests/domain tests/db tests/integration

# G9：OpenAPI frozen YAML ↔ runtime semantic equivalence
bun run openapi:check

# G10：CI 与 converge（以真实 workflow / report 为准）

# G11：current Family 解析具备确定性（Final 含 CURRENT_FAMILY_AMBIGUOUS）
# 构造属于 >=2 Family 的 actor，重复调用 GET /api/v1/families/current，
# 断言返回确定性的 CURRENT_FAMILY_AMBIGUOUS，不得依赖无 ORDER BY 的 rows[0]。
```

> **G2 冲突处理**：正常解决冲突后重跑 governance / tests，然后**普通 push**；不得 rebase，不得 force push。
> **G11 失败**：报告 `BLOCKED — SLICE 1 CURRENT FAMILY SEMANTICS NOT STABLE`，由 Slice 1 修复；Slice 2 不实现 Family switching。

任一其它失败：`BLOCKED — SLICE 1 IMPLEMENTATION DEPENDENCY`；不得私建替代基础设施。

---

## 2. 迁移与结构验证

```bash
# 2.1 应用 reviewed migration（migrator 角色）
bun run db:migrate

# 2.2 结构 / RLS / 并发
bunx vitest run tests/db/cases-schema.test.ts
bunx vitest run tests/db/cases-rls.test.ts
bunx vitest run tests/db/cases-primary-concurrency.test.ts
```

期望（每条都必须是真实查询输出）：

| 检查 | 期望 |
|---|---|
| `cases` / `case_events` 存在 | 两表均由 `xiaoshuyin_migrator` 拥有 |
| `pg_class.relrowsecurity` / `relforcerowsecurity` | 两表均为 `true` / `true` |
| `pg_roles.rolbypassrls`（`xiaoshuyin_app`） | `false` |
| `case_status` enum 取值与顺序 | `OPEN, WAITING, PAUSED, LOST_CONTACT, SAFETY_HOLD, CLOSED` |
| `case_phase` enum 取值与顺序 | `INTAKE, ASSESSMENT, PROBLEM_FORMULATION, GOALS, PLANNING, EXECUTION, REVIEW, MAINTENANCE, CLOSED` |
| `cases` 列集合 | 恰为 `id, family_id, created_by_person_id, status, phase, is_primary, version, created_at, updated_at`；不含 title / summary / description / problem_description |
| `cases_one_primary_open_per_family` | partial unique index 存在，谓词为 `is_primary AND status <> 'CLOSED'` |
| `case_events` 列集合 | 恰为 `id, family_id, case_id, actor_account_id, event_type, metadata, occurred_at` |
| `cases` 唯一键 | `UNIQUE (id, family_id)` 存在（复合 FK 的被引用唯一键，必须先于 `case_events` 创建） |
| `case_events` 复合 FK | 指向 `cases (id, family_id)` |
| `case_events.metadata` CHECK | `case_events_metadata_shape_check` 存在；key 集合恰为 `{primary, version}`；额外 key / 正文 / PII 写入被拒绝 |
| `case_events` 权限 | `xiaoshuyin_app` 只有 `SELECT, INSERT`（无 UPDATE / DELETE） |
| `business_audit_events` CHECK | 含 `CASE_CREATED` / `CASE` |
| `idempotency_keys` CHECK | 含 `CASE_CREATE` |
| 无上下文直连 | `SELECT count(*) FROM cases` = 0；`INSERT` 被拒 |
| Family A 上下文查 Family B Case | 0 行 |
| 越界表 / 路由 | 不存在 `case_participants` / `assertions` / `observations` / `problem_formulations` / `scene_*` / Safety / Plan / Task / Notification |

---

## 3. 端到端主路径（手工 / curl）

启动：

```bash
bun run dev:api     # 默认 http://localhost:8787
```

### 3.1 准备：登录并建立 Family

```bash
# 登录（测试环境 fake provider）
curl -sX POST localhost:8787/api/v1/auth/wechat \
  -H 'content-type: application/json' \
  -d '{"code":"test-parent-a"}' | tee /tmp/login.json

TOKEN=$(jq -r .sessionToken /tmp/login.json)

# 建立 Family（Slice 1 Final；header 幂等键 + creator）
curl -sX POST localhost:8787/api/v1/families \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: family-create-001' \
  -d '{"displayName":"A家","creator":{"ageBand":"ADULT","ageBandSource":"SELF_STATEMENT"}}'
```

### 3.2 创建第一个 Case（primary = true）

```bash
curl -s -D /tmp/create1.headers -o /tmp/create1.json \
  -X POST localhost:8787/api/v1/cases \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: case-create-0001' \
  -d '{}'

jq . /tmp/create1.json
```

期望：

```json
{
  "id": "<uuid>",
  "status": "OPEN",
  "phase": "INTAKE",
  "primary": true,
  "version": 1,
  "createdAt": "<ISO-8601>",
  "updatedAt": "<ISO-8601>"
}
```

HTTP `201`；响应中不含 `familyId`、creator、title、description、任何内容字段。

### 3.3 创建第二个 Case（候选）

```bash
curl -s -X POST localhost:8787/api/v1/cases \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: case-create-0002' \
  -d '{}' | jq .
```

期望：`primary = false`，`status = OPEN`，`phase = INTAKE`，`version = 1`；旧 Case 不变。

### 3.4 列表

```bash
curl -s localhost:8787/api/v1/cases -H "authorization: Bearer $TOKEN" | jq .
```

期望：

```json
{
  "items": [
    { "id": "<case-1>", "status": "OPEN", "phase": "INTAKE", "primary": true,  "version": 1, "createdAt": "...", "updatedAt": "..." },
    { "id": "<case-2>", "status": "OPEN", "phase": "INTAKE", "primary": false, "version": 1, "createdAt": "...", "updatedAt": "..." }
  ]
}
```

- primary 唯一可识别；
- 排序 `primary DESC, createdAt ASC, id ASC`；
- 不返回其他 Family 的 Case。

### 3.5 详情

```bash
CASE_ID=$(jq -r .id /tmp/create1.json)
curl -s localhost:8787/api/v1/cases/$CASE_ID -H "authorization: Bearer $TOKEN" | jq .
```

期望：`status` 与 `phase` 两个独立字段，不合并、不互相推导。

### 3.6 空 Family

对一个尚未创建 Case 的 Family 调用列表：

```bash
curl -s localhost:8787/api/v1/cases -H "authorization: Bearer $TOKEN" | jq .
```

期望：`{ "items": [] }`，HTTP 200；不存在 placeholder / 默认 Case。

---

## 4. 负路径

### 4.1 客户端越权字段

```bash
curl -s -o /tmp/bad.json -w '%{http_code}\n' \
  -X POST localhost:8787/api/v1/cases \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: case-create-bad-1' \
  -d '{"status":"CLOSED","primary":true}'

# body 里出现 idempotencyKey 也必须是 422（正式 transport 只有 header）
curl -s -o /tmp/bad2.json -w '%{http_code}\n' \
  -X POST localhost:8787/api/v1/cases \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: case-create-bad-2' \
  -d '{"idempotencyKey":"case-create-bad-2"}'
```

期望：`422`，`code = VALIDATION_ERROR`；**零业务写入**：`cases`、`case_events`、`business_audit_events`、`idempotency_keys` 均无新增，不得忽略非法字段后用服务端值创建。

### 4.2 详情反枚举（跨 Family / 不存在）

用 Family B 的 `case_id`、或用不存在的 UUID，分别请求：

```bash
curl -s -o /tmp/notfound.json -w '%{http_code}\n' \
  localhost:8787/api/v1/cases/$FAMILY_B_CASE_ID -H "authorization: Bearer $TOKEN"
curl -s -o /tmp/notfound2.json -w '%{http_code}\n' \
  localhost:8787/api/v1/cases/00000000-0000-7000-8000-000000000000 -H "authorization: Bearer $TOKEN"
```

期望：均为 `404`，响应体均为：

```json
{ "code": "CASE_NOT_FOUND", "message": "Case not found" }
```

两者逐字节一致；不含 Family ID、status、phase、primary、creator 或任何 Case 字段。

### 4.3 非管理主体（场景 9A / 9B 分开验证）

#### 4.3.1 场景 9A — guardian + Family 成员，但不是管理主体

actor 必须是目标 Family 的合法 `family_member`，current Family 已成功解析为该 Family；同时具备 guardian relationship，但不是 `families.created_by_person_id`。

用该身份：

```bash
# 创建
curl -s -o /tmp/deny-create.json -w '%{http_code}\n' \
  -X POST localhost:8787/api/v1/cases \
  -H "authorization: Bearer $GUARDIAN_MEMBER_TOKEN" \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: case-create-deny-1' \
  -d '{}'

# 列表
curl -s -o /tmp/deny-list.json -w '%{http_code}\n' \
  localhost:8787/api/v1/cases -H "authorization: Bearer $GUARDIAN_MEMBER_TOKEN"

# 详情
curl -s -o /tmp/deny-detail.json -w '%{http_code}\n' \
  localhost:8787/api/v1/cases/$CASE_ID -H "authorization: Bearer $GUARDIAN_MEMBER_TOKEN"
```

期望：
- 创建 / 列表：`403` + `CASE_ACCESS_DENIED`，无 Case 数据、无 Case 写入；
- 详情：`404` + `CASE_NOT_FOUND`，无 Case 字段。

guardian relationship 不因叠加 Family membership 而获得 Case 管理权。

#### 4.3.2 场景 9B — guardian 但不是目标 Family 成员

actor 仅有 guardian relationship，不是目标 Family 的 `family_member`。此时 current Family 未合法解析为目标 Family，**不得**调用 Case 层 403 / 404 断言。

期望：
- 沿用 Slice 1 Family 授权 / current-family 语义（如 `CURRENT_FAMILY_NOT_FOUND`）；
- 响应不含任何 Case 字段；
- 不出现 `CASE_ACCESS_DENIED` / `CASE_NOT_FOUND` 映射；
- 该场景不用于验证 Case manager 权限，也不得新增第二套 Family 错误码。

普通 membership 与 guardian relationship 均不授予 Case 访问。

---

## 5. 幂等

### 5.1 同 key 同 payload：重放

```bash
curl -s -X POST localhost:8787/api/v1/cases \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: case-create-0001' \
  -d '{}' | jq -r .id
```

期望：返回**原 Case ID**；再查 `cases` / `case_events` / `business_audit_events` 行数不变。
并发同 key（见第 6 节）也必须只有一个业务结果，其余为 replay。

### 5.2 同 key 不同 payload：shared contract，非 HTTP

本 Slice 的 `POST /api/v1/cases` 的幂等键由 `Idempotency-Key` header 承载，business body 恒为 `{}`；
在**当前 V1 管理语义 + 同一 actor + 同一 current Family canonical context** 下，
`familyId` 又由服务端 current Family 唯一解析，因此
**不存在第二种合法业务 payload**，public HTTP API 无法真实触发 `409 IDEMPOTENCY_PAYLOAD_MISMATCH`。

canonical hash 仍保留 `{ familyId: verifiedCurrentFamilyId, body: {} }`。
未来若正式语义允许同一 actor 在多个 Family 执行 `CASE_CREATE`，相同 scope key + 不同 `familyId`
会得到不同 hash 并正确进入 mismatch；这不是当前 public HTTP 测试场景，不得删除 `familyId` hash。

**禁止的测试写法**：
- 用另一个 Family 的 manager token 复用相同 key 制造 “mismatch”——actor 变化导致 scope 变化，这不是 payload mismatch；
- 为了测试可达而新增无业务意义字段或放开 strict schema。

**正确验证位置**：shared idempotency domain / repository contract 测试
（`tests/domain/idempotency-hash.test.ts` 与 repository/service contract 用例）。

断言：同一 scope key + 不同 `request_hash` → `MISMATCH` → 映射 `409 IDEMPOTENCY_PAYLOAD_MISMATCH`；
不修改原 Case、不写新事件 / 审计。

> 实现必须保证：幂等 lookup / 占位 / 回填都在 `withRlsTransaction` 内，不得照抄 Slice 1 `families.ts` 的无上下文 `pool.query`。

---

## 6. 并发（真实数据库连接）

用测试而非 curl 验证（`tests/db/cases-primary-concurrency.test.ts`）：

- 同一 Family、两个不同幂等键、两个并发连接；
- 断言：
  - 两条 Case 都落库；
  - `SELECT count(*) FROM cases WHERE family_id=$1 AND is_primary AND status <> 'CLOSED'` = 1；
  - 一行为 `primary=true`，另一行为 `false`；
  - `case_events` / `business_audit_events` 各 2 条（两个 Case 各 1 条）；
  - 重复运行仍成立。

---

## 7. 读不写审计（D7）

```bash
# 记录读取前行数
BEFORE_EVENTS=$(psql "$MIGRATION_DATABASE_URL" -tAc "SELECT count(*) FROM case_events")
BEFORE_AUDITS=$(psql "$MIGRATION_DATABASE_URL" -tAc "SELECT count(*) FROM business_audit_events")

# 读取
curl -s localhost:8787/api/v1/cases -H "authorization: Bearer $TOKEN" > /dev/null
curl -s localhost:8787/api/v1/cases/$CASE_ID -H "authorization: Bearer $TOKEN" > /dev/null

# 记录读取后行数
AFTER_EVENTS=$(psql "$MIGRATION_DATABASE_URL" -tAc "SELECT count(*) FROM case_events")
AFTER_AUDITS=$(psql "$MIGRATION_DATABASE_URL" -tAc "SELECT count(*) FROM business_audit_events")

echo "$BEFORE_EVENTS/$AFTER_EVENTS $BEFORE_AUDITS/$AFTER_AUDITS"
```

期望：前后相等；不存在 `CASE_VIEWED` / `CASE_LISTED` 事件类型。

---

## 8. 静态守卫与回归

Post-Slice1 Final 的强制回归顺序：

```bash
bun run typecheck
bun run guard:static

bunx vitest run tests/domain
bunx vitest run tests/db
bunx vitest run tests/integration
bunx vitest run

bun run db:migrate
bun run db:migrate

bun run db:evidence

bun run openapi:generate
bun run openapi:check

bun run coverage:audit

node scripts/verify-all.mjs --archive

node .specify/scripts/validate-governance.mjs
node .specify/scripts/tests/run-governance-tests.mjs
```

期望：
- `guard-static: PASS (0 violations)`；Slice 1 Final 全部 guard 保留；
- 无 `drizzle-kit push`、无 secret literal、无越界目录；
- Slice 1 Final 既有测试仍 green（只允许按新增表做「增量对齐」，不得削弱断言）；
- `db:migrate` 两次：首次 APPLY，第二次全 SKIP；
- `openapi:generate` 两次 hash 一致；`openapi:check` 执行 semantic equivalence；
- `db:evidence` / `coverage:audit` / `verify-all --archive` / governance 全部 PASS；
- `0 failed` / `0 skipped`。

---

## 9. 完整证据清单

| 证据 | 产出 |
|---|---|
| 迁移输出 | `db:migrate` 的 APPLY / SKIP 与 “Migration complete” |
| 结构 / RLS | `cases-schema` / `cases-rls` 测试的真实断言输出 |
| 并发不变量 | `cases-primary-concurrency` 的聚合查询结果 |
| 授权 / 反枚举 | `cases-authorization` / `cases-read` 的 HTTP 状态与响应体 |
| 幂等（HTTP 可达） | `cases-idempotency` 的 **header replay** / 并发同 key 行数前后对比 |
| 幂等 mismatch（shared contract） | domain / repository contract 用例：same scope + different `request_hash` → MISMATCH → 409 映射；**不声称 HTTP 可达** |
| 事件 / 审计 | `case_events` / `business_audit_events` 按 `case_id` / `resource_id` 的计数 |
| metadata 形状 | `case_events.metadata` key 集合恰为 `{primary, version}`；无 title / description / 正文 / 用户输入 / PII；额外 key 的直连 DB 写入被 `case_events_metadata_shape_check` 拒绝（23514） |
| 读不写审计 | 第 7 节前后计数 |
| Scope | 表 / 路由 / 列 introspection 输出 |
| Slice 1 regression | `bunx vitest run tests/domain tests/db tests/integration` 全绿，Final 断言未削弱 |
| OpenAPI semantic equivalence | `bun run openapi:check`：frozen YAML ↔ runtime，不是仅比较生成文件 |
| DB evidence | `bun run db:evidence` PASS |
| Coverage | `bun run coverage:audit`：001 + 002 均无 missing |
| Governance | `validate-governance.mjs` + self-test PASS |
| CI | `.github/workflows/ci.yml` 全 job green |
| Converge | 新 Head 的 converge 报告无未解决 gap；旧 Head 结果作废 |

任一证据缺失或环境不可运行：报告 `BLOCKED` / `NOT VERIFIED`，不得以“设计已完成”代替证据。