# Research — 002-case-core

**Feature**: `specs/002-case-core/spec.md`
**阶段**: Phase 0（Plan）
**结论**: 所有技术未知项已在 Plan 内解决；无 `NEEDS CLARIFICATION`，无产品级 Open Question。

> 本文只记录**技术选择**与理由。任何产品语义问题必须回到 `spec.md` / `Docs/**`，不得在此决定。
> 所有调研基于 Slice 1 `feat/001-family-identity-core` 的只读真实实现（closeout 复核 Head `74a31eb`，60/72 tasks）；不代表 Slice 1 已最终冻结。

---

## R-1 Primary Case 并发：Family 行锁 + partial unique index

**Decision**
在同一业务事务内，用 `SELECT id FROM families WHERE id = $1 FOR UPDATE` 串行化同一 Family 的 primary 判定；随后用**独立的** `SELECT EXISTS(...)` 读取当前是否存在 primary 未结 Case；数据库另建 `UNIQUE (family_id) WHERE is_primary AND status <> 'CLOSED'` 的 partial unique index 作为最后防线。

**Rationale**
1. `FOR UPDATE` 把「检查是否有 primary」与「插入 primary」变成一个串行临界区，消除 check-then-insert 竞态。
2. PostgreSQL 默认 READ COMMITTED 下，每条语句取独立快照；把「锁语句」与「判定语句」拆开，第二个事务在拿到锁后的判定语句才能看到前一个事务已提交的 Case。合并成一条 CTE / SELECT 会共享同一快照，判定不可靠。
3. partial unique index 是数据库不变量，防止未来任何绕过应用路径的写入（例如脚本、未来 command 实现错误）产生两个 primary。
4. 两个不同幂等键的合法请求都会成功：第一个 primary、第二个 candidate。这符合 spec 场景 3 与 SC-002，也避免把唯一冲突暴露成产品失败。

**Alternatives considered**
- **只靠 partial unique index**：第二个并发请求会因唯一冲突失败，违反「两个合法请求应确定性完成一个 primary + 一个 candidate」。
- **SERIALIZABLE**：理论上可行，但引入可重试的序列化失败，需要应用重试策略；本场景用行锁更小、更可预测。
- **advisory lock**：粒度与生命周期不在业务表内，审计与故障排查更差；Family 行锁已足够。
- **应用层内存锁**：被 §4.0A 明确禁止作为业务真相（多实例 / 重启失效）。
- **先 SELECT 再 INSERT 无锁**：典型竞态，被 spec 明确禁止。

**验证**
真实 PostgreSQL 多连接并发测试：两个事务各持不同 key，同一 Family，同时创建；结束后断言 `primary=true AND status<>'CLOSED'` 计数 = 1，两个 Case 均存在。

---

## R-2 唯一冲突（23505）不是正常业务流程

**Decision**
正常并发由 Family 行锁串行化处理，第二个请求读到已有 primary 后写 candidate。
若仍出现 `cases_one_primary_open_per_family` 唯一冲突，视为**数据库不变量被绕过 / 代码缺陷**：事务整体回滚，返回 `500 INTERNAL_ERROR`。

**Rationale**
- spec 要求真实状态，不能把「不变量被破坏」伪装成 201 或 409 正常分支。
- 若把 unique violation 映射成「自动转 candidate」，会掩盖锁顺序错误，并可能把已写入的 event/audit 留在不一致状态（即使回滚，也说明代码路径不可信）。
- 唯一冲突是「不应发生」的信号，应暴露给监控与测试，而不是产品层。

**Alternatives considered**
- 捕获 23505 后重试 / 改 primary=false 再插入：会让缺陷静默通过，且重试可能产生第二个 event/audit 组合。
- 映射为 409 `CASE_CONFLICT`：产品语义未定义该错误码，属于新增产品语义，禁止。

---

## R-3 幂等键 transport：请求体字段 `idempotencyKey`

**Decision**
`POST /api/v1/cases` 的 `idempotencyKey` 放在 JSON 请求体（8–128 字符），与 Slice 1 的 `CreateFamilyRequest` / `CreateMemberRequest` / `CreateConsentRequestRequest` 一致。

**Rationale**
1. §27A 要求「Schema 只能有一个代码侧事实源」；Slice 1 的 Zod `packages/contracts/src/schemas.ts` 已经把幂等键定义为 body 字段，runtime 也按 body 读取。
2. 沿用既有 runtime 行为，不创造第二套 transport 机制。
3. Slice 1 手写 OpenAPI 中的 `Idempotency-Key` header 与 runtime / Zod 不一致，是 Slice 1 final closeout 的待收敛项（Implement Gate G9）；Slice 2 不复制该偏差。
4. 若 Slice 1 final 统一改为 header，Slice 2 在 Implement Gate 重新对齐本 Plan 与 OpenAPI；不允许两套并存。

**冻结状态**：本决策为 Plan 的 Frozen Technical Decision **R1**。Implement AI 不得临场重新选择；若 Slice 1 final G9 最终改为 header，Slice 2 必须先返回 Plan Review 更新契约。

**Alternatives considered**
- header `Idempotency-Key`：更符合 HTTP 惯例，但与 Slice 1 代码侧事实源不一致，会造成同一仓库两套机制。
- query 参数：不适合幂等语义，且易被日志/缓存污染。

---

## R-4 Canonical payload hash 的组成

**Decision**
```text
request_hash = sha256(canonicalJson({ familyId, body }))
body = Zod strict 解析后的请求体去掉 idempotencyKey（当前恒为 {}）
```

**Rationale**
- `familyId` **必须**进入 hash：它不属于 idempotency scope，但决定业务结果归属；不进入会导致同一 key 跨 Family 回放，产生跨家庭数据泄漏（FR-010 / V1-C21）。
- `familyId` 是**服务端 canonical command context**，不是客户端提交字段；客户端提交 `familyId` 仍按 strict schema 返回 422。这样既保留 Family 归属的 hash 语义，又不允许伪造上下文。
- `actor_account_id` / `command_type` **不**进入 hash：它们已是 `idempotency_keys` 唯一键 `(actor_account_id, command_type, idempotency_key)` 的组成部分，重复混入没有额外区分力，只会把 scope 语义与 payload 语义耦合。
- `body` 进入 hash：保持「同 key 不同 payload → 409」的通用语义；当前 body 为空，但 hash 结构不因 body 为空而退化——`familyId` 仍保证不同 Family 的请求被区分。
- 使用 Zod strict 解析后的对象：未知字段直接 422，不进入 hash，避免「字段顺序不同 → hash 不同」的误判；`canonicalJson` 已按 key 排序。

**可达性澄清（closeout）**
本 Slice 的 public `POST /api/v1/cases` 只接受 `{idempotencyKey}`；去掉幂等键后 `body = {}`，`familyId` 又只能由服务端上下文提供。因此 public HTTP API **不存在第二种合法业务 payload**，`MISMATCH → 409` 在 HTTP 层不可达。
该分支仍在 shared idempotency domain / repository contract 层实现并验证；不得通过切换 actor（会改变 scope）、伪造 Family 上下文或新增无业务意义字段制造假场景。

**Alternatives considered**
- 只 hash `{}`：同 key 可跨 Family 回放，禁止。
- hash 整个原始 body（含 idempotencyKey）：key 已在 scope 中，重复且会让同一语义的换 key 重试产生不同 hash，无意义。
- hash `{actor, familyId, commandType, body}`：actor/command 重复，违反「不无意义重复混入」的要求。

---

## R-5 幂等占位（placeholder）模式

**Decision**
在业务事务内先 `INSERT INTO idempotency_keys (...) VALUES (..., response_status=0, response_body='{}') ON CONFLICT (scope) DO NOTHING RETURNING id`：
- 返回行 → 首次执行，继续业务，最后 `UPDATE` 回填真实 response。
- 无返回行 → 已有记录，`SELECT ... FOR SHARE` 读取并比对 hash；相同 REPLAY，不同 409。

**Rationale**
- `response_status` / `response_body` 是 NOT NULL，不能先插 NULL 再回填；用 `0` / `{}` 作为事务内占位即可，事务外不可见。
- `ON CONFLICT DO NOTHING` 在并发同 key 时会让第二个事务等待唯一索引冲突判定：第一个提交 → 第二个跳过插入并读到已提交行；第一个回滚 → 第二个插入成功。
- 占位与业务写入在同一事务，失败一起回滚，不会留下半条幂等记录。
- 不依赖应用缓存 / 进程锁。

**Alternatives considered**
- 先 SELECT 再在业务后 INSERT：同 key 并发时两个事务都执行业务，最后一个 INSERT 失败，产生重复 event/audit。
- 先 INSERT 完整 response（预生成 ID 与时间）：需要在业务前伪造响应，且业务失败时要回滚响应，语义更绕。
- 单独事务写幂等：违反「Case + event + audit + idempotency 同一事务原子」（Slice 1 `families.ts` 的现状就是反例，Slice 2 明确不照抄）。

---

## R-6 `case_events` append-only 的实现方式

**Decision**
`xiaoshuyin_app` 对 `case_events` 只授予 `SELECT, INSERT`，不授予 `UPDATE, DELETE`；不新增 trigger。

**Rationale**
- 权限层阻断比 trigger 更早、更彻底：runtime 根本没有修改能力。
- §7.8 要求「不得覆盖或删除历史事件」；只授予读与追加即可满足。
- Slice 1 对 `consent_records` 用 trigger 是因为它必须授予 `UPDATE` 用于绑定 `bound_person_id`；`case_events` 没有这种合法更新需求。

**Alternatives considered**
- `BEFORE UPDATE/DELETE` trigger：可防御 owner 误操作，但 owner 是 migrator / DDL 角色，不属于 runtime；增加复杂度。
- 只靠应用层约定：不满足「数据库最后防线」的定位。

---

## R-7 `case_events` 与 `business_audit_events` 不合并

**Decision**
Case 创建同时写两张表：`case_events`（领域历史）与 `business_audit_events`（业务审计），同一事务。

**Rationale**
- `Docs/V1技术设计.md` §7.8 明确 `case_events` 是领域历史；§7.9 明确 `business_audit_events` 是审计。二者定位不同。
- 领域历史按 Case 追溯状态/阶段演化；业务审计按资源类型跨领域检索「谁做了什么」。
- 合并会迫使一方牺牲语义（例如审计表需要通用 resource_type，领域事件需要 Case scope 复合 FK）。
- 两张表都在同一事务写入，不会出现「Case 存在但无证据」的中间态。

**Alternatives considered**
- 只写 `case_events`：缺少跨资源统一审计视图，违反 §7.9。
- 只写 `business_audit_events`：丢失 Case 领域历史定位，违反 §7.8。
- 新建第三张「case audit」表：复制第二套 audit platform，被 spec 明确禁止。

---

## R-8 Authorization 增量扩展而非 `authorizeCase()`

**Decision**
在现有 `authorize()` 内扩展：
- `Action` 增加 `CASE_CREATE` / `CASE_LIST` / `CASE_READ`；
- `Resource` 增加 `CASE`；
- `AuthInput.case` 从 `null` 扩为 `{ caseId } | null`；
- `AuthInput.family` 增加可选 `createdByPersonId`，用于纯函数 manager 判定；
- 新增 `CASE_CONTEXT_REQUIRED`。

**Rationale**
- §9 只定义了一个统一 `authorize()` 输入；新建 `authorizeCase()` 会产生第二个权限入口，违反「统一判定」。
- manager 判定本来就是 `isFamilyManager(family, actorPersonId)` 纯函数；把它纳入 `authorize()` 对 Case 动作是增量，不改变 Family / Consent 行为。
- Case 归属无法由纯函数判断；由 `withRlsTransaction` + RLS 保证，`case_id` 仅作待验证参数。
- 不引入 Case role / RBAC / Visibility Matrix / Permission DSL。

**Alternatives considered**
- `authorizeCase()` 独立函数：两个入口，容易出现一处漏判。
- 在路由里直接 if/else 判 manager：绕过统一判定，无法被 domain 测试覆盖。
- 把 Case 归属查询放进 `authorize()`：纯函数被破坏，且引入数据库依赖。

---

## R-9 `cases` 用 PostgreSQL enum 承载 Status / Phase

**Decision**
`case_status` 与 `case_phase` 使用 PostgreSQL enum，取值与顺序严格照 `Docs/V1技术设计.md` §6.1 / §6.2。

**Rationale**
- enum 在数据库层拒绝未定义值，满足 FR-003「不得新增、改名或重排」。
- 顺序即文档顺序，便于结构断言直接比对。
- 未来新增状态必须 reviewed migration，符合「事件类型 / 枚举扩展需迁移」。

**Alternatives considered**
- `text + CHECK`：可行，但枚举值集合会散落在 CHECK 字符串里，查询与断言更脆弱；Slice 1 已采用 enum 风格。
- 单一组合枚举：违反 §2.4「status 与 phase 不得合并」。

**注意**
`primary` 是 SQL 保留字，因此 DB 列名为 `is_primary`；API 字段仍为 `primary`。

---

## R-10 Partial unique index 的谓词

**Decision**
```text
CREATE UNIQUE INDEX cases_one_primary_open_per_family
  ON cases (family_id)
  WHERE is_primary AND status <> 'CLOSED'
```

**Rationale**
- 直接表达 spec 的「当前 primary 未结 Case」定义（`未结 = status != CLOSED`）。
- 允许未来 CLOSED 的 primary 保留（历史），不阻止 recurrence / 历史读取。
- `boolean` 与 enum 比较均为 immutable，可作为 partial index 谓词。

**Alternatives considered**
- `UNIQUE (family_id) WHERE is_primary`：会禁止未来 CLOSED 的 primary 与新的 primary 并存，与「历史保留」冲突。
- 触发器维护单 primary：触发器更难审计，且并发下仍需锁；索引更简单可靠。

---

## R-11 `case_events` 与 `cases` 的复合外键

**Decision**
`cases` 增加 `UNIQUE (id, family_id)`；`case_events (case_id, family_id) REFERENCES cases (id, family_id)`。

**Rationale**
- 保证事件的 `family_id` 与 Case 归属一致，即使应用层写错参数也无法跨 Family 挂事件。
- 纯声明式约束，无触发器、无应用层约定。
- 与 RLS 形成两层：RLS 限制「只能看到 / 写当前 Family」，复合 FK 限制「事件必须与 Case 同 Family」。

**Alternatives considered**
- 只靠 RLS：应用层若传错 `family_id` 但 Case 属于另一 Family，RLS 会在当前 Family 上下文下拒绝 Case 查询，但事件仍可能被写入错误 Family；复合 FK 更硬。
- trigger 校验：需要额外函数与测试，声明式约束更简单。

**未采纳**：`cases (family_id, created_by_person_id) → family_members` 复合 FK。
理由：creator 已由认证 actor + `set_family_context` membership 校验 + `authorize()` 保证；再加该 FK 会把 Case 与 membership 生命周期耦合（未来数据权利删除 membership 时可能被 RESTRICT 阻塞），属于超出本 Slice 的耦合。

---

## R-12 迁移编号与既有 CHECK 扩展

**Decision**
- 不修改 `001_initial_schema.sql`。
- 新增 `db/migrations/<next-after-slice1-final>_case_core.sql`，序号在 Implement Gate 后按 Slice 1 final 实际 migration 解析。
- 对 `business_audit_events.event_type` / `resource_type`、`idempotency_keys.command_type` 使用 `DROP CONSTRAINT` + `ADD CONSTRAINT` 扩展白名单；实现前读取 `pg_constraint` 确认真实约束名。

**Rationale**
- Slice 1 尚未合并，migration 序号可能变化；Plan 写死序号会与 Slice 1 final 实际编号脱节。
- Slice 1 的 CHECK 是内联匿名约束，PostgreSQL 默认命名为 `<table>_<column>_check`，但若 Slice 1 final 调整列定义或重复约束，名称可能不同；因此必须现场确认。
- reviewed migration 是唯一变更路径；`drizzle-kit push` 禁止。

**Alternatives considered**
- 修改 001：违反「不修改 Slice 1 已提交 migration」。
- 新建独立表保存 Case 审计类型：复制审计平台，禁止。
- 运行时接受任意 `event_type`：违反「未定义值不得进入运行时」。

---

## R-13 Case 详情 404 与 Family 未解析的边界

**Decision**
- `GET /api/v1/cases/:id`：Family 已解析后，「Case 不存在 / 跨 Family / 非管理主体」统一 `404 CASE_NOT_FOUND`，响应体逐字节一致。
- Family 本身未解析（actor 尚无 Family / 多 Family 未收敛 / Family 授权失败）：沿用 Slice 1 语义（`404 CURRENT_FAMILY_NOT_FOUND` 或 Slice 1 final 对应错误），**不定义第二套 Family 错误码**。

**Rationale**
- D6 / FR-023 要求详情不泄露 Case 存在性；Family 未解析不是「Case 存在性」信息，而是上下文缺失，属于 FR-024 明确要求的 Slice 1 语义。
- 两个 404 的响应体都不含 Case 字段，因此不构成 Case 枚举预言机。
- 不新增 Family 错误码，避免第二真相源。

**Alternatives considered**
- Family 未解析也返回 `CASE_NOT_FOUND`：会让「尚未建立家庭」与「Case 不存在」不可区分，客户端无法进入正确的空态引导；且违反 FR-024。
- 详情对非管理主体返回 403：违反 D6。

---

## R-14 列表 envelope / ordering / pagination

**Decision**
- 响应 `200 { "items": CaseResponse[] }`，沿用 Slice 1 `/consents` 的 `items` 命名。
- 排序 `primary DESC, created_at ASC, id ASC`。
- 不实现分页。

**Rationale**
- 与 Slice 1 集合端点风格一致，减少客户端分叉。
- `primary DESC` 让当前主要 Case 稳定出现在首位，同时仍以 `primary` 字段作为唯一识别依据（不靠排序伪造）。
- 正式需求（U04 / §28.3）未给分页约束；单 Family Case 数量小；返回全部才能无条件保证 primary 可见。过度设计分页会引入未批准契约。

**Alternatives considered**
- `{ data: [...] }`：与 Slice 1 不一致。
- 按 `created_at DESC`：候选与 primary 混排，U04 体验差，但不影响正确性。
- 立即实现 cursor 分页：超出正式需求。

---

## R-15 响应字段最小化

**Decision**
`CaseResponse` 只含 `id / status / phase / primary / version / createdAt / updatedAt`。

**Rationale**
- U04 需要 primary + phase；列表需要 status / phase / primary / version 以区分候选与主要。
- 不返回 `familyId`：当前 Family 由请求上下文确定，重复返回无消费价值。
- 不返回 `createdByPersonId`：本 Slice 无消费方，减少 PII 暴露面。
- 不返回任何内容字段（D4）。

**Alternatives considered**
- 返回 `familyId` / `createdByPersonId`：增加响应面，无正式需求支撑。
- 返回 `isPrimary`：与存储列名一致，但与 spec / 上游术语 `primary` 不一致；列为 Plan Frozen Technical Decision **R3**。

---

## R-16 Slice 1 偏差清单（Implement Gate 必读）

以下偏差在 Plan 阶段**只记录、不修复**；它们是 G6 / G9 / G10 的验证对象：

| 偏差 | 证据 | 对本 Slice 的影响 |
|---|---|---|
| `families.ts` 的幂等 lookup 在无 identity 上下文的 `pool.query` 中执行 | `apps/server/api/src/routes/families.ts:36` | Case 幂等禁止照抄；必须在 `withRlsTransaction` 内 |
| 幂等响应写入在业务事务**之外**的独立 `withIdentityTransaction` | `families.ts:106`、`members.ts:173` | 违反「同一业务事务原子」；Case 不照抄 |
| OpenAPI 声明 `Idempotency-Key` header，runtime / Zod 用 body `idempotencyKey` | `contracts/identity-family-api.openapi.yaml:411` vs `packages/contracts/src/schemas.ts:77` | G9 需收敛；Case 选择 body（Plan R1 / research R-3） |
| `/families/current` 对多 Family actor 取 `rows[0]`，无 `ORDER BY`，未实现确定性的多 Family 选择语义 | `families.ts:137-150` vs Slice 1 plan D-6.1 | Case 的 current family 解析沿用 final 实现；**G11 必须证明确定性**。若 final 仍存在未定义行为 → `BLOCKED — SLICE 1 CURRENT FAMILY SEMANTICS NOT STABLE`；Slice 2 不实现 Family switching |
| `authorize()` 的 MANAGER_ACTIONS 分支为 placeholder `ALLOW` | `authorize.ts:94-101` | Case 动作必须传 `createdByPersonId` 并真实判定 |
| `package.json` 引用不存在脚本（`db:evidence` / `openapi:generate` / `openapi:check` / `coverage:audit` / `verify-all`） | `package.json` vs `scripts/` | Verification Plan 只用真实命令；G10 补齐 |

---

## 结论

Phase 0 无未解决问题。所有决策均可追溯到 `Docs/**` 或 Slice 1 冻结契约；没有新增产品语义，没有引入未批准依赖。
closeout 仅澄清了「`CASE_CREATE` 的 HTTP different-payload mismatch 在当前命令形状下不可达」，并在 shared idempotency contract 层保留 §8.5 的 MISMATCH→409 合同；这属于验证可达性收口，不取消 §8.5。
进入 Phase 1 的产物：`data-model.md`、`contracts/**`、`quickstart.md`。