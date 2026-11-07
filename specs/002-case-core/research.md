# Research — 002-case-core

**Feature**: `specs/002-case-core/spec.md`
**阶段**: Phase 0（Plan）
**结论**: 所有技术未知项已在 Plan 内解决；无 `NEEDS CLARIFICATION`，无产品级 Open Question。

> 本文只记录**技术选择**与理由。任何产品语义问题必须回到 `spec.md` / `Docs/**`，不得在此决定。
> 所有调研基于 **Slice 1 Final**（`origin/main` `ee9d07e`，PR #13 merged）的只读真实实现；Slice 1 已 CLOSED，不得重新打开。

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

## R-3 幂等键 transport：`Idempotency-Key` HTTP header（**Post-Slice1 Final UPDATED**）

**Decision**
`CASE_CREATE` 的幂等键由 **`Idempotency-Key` HTTP header** 承载（8–128 字符），复用 Slice 1 Final 的 `readIdempotencyKey(req)`；`POST /api/v1/cases` 的 JSON 请求体**不包含** `idempotencyKey`（business body 恒为 `{}`）。

**Rationale**
1. Slice 1 Final 已正式冻结 header transport：`apps/server/api/src/idempotency.ts` 的六个 mutating command 都使用 `Idempotency-Key`，并导出唯一 `readIdempotencyKey`。
2. Slice 1 Final 的 `packages/contracts/src/schemas.ts` 已移除六个命令的 body `idempotencyKey`；继续使用 body 会形成第二套 transport 与第二套事实源。
3. Spec A-2 明确「§8.5 未规定 header 还是 body；由 Plan 决定」；本次是 transport / implementation dependency 修正，不改变幂等语义。
4. 只有 header 是正式 contract；**不得**长期同时支持 body + header。

**冻结状态**：本决策为 Plan 的 Frozen Technical Decision **R1**，已从 body 正式更新为 **header**。Implement AI 不得临场重新选择，也不得保留 body fallback。

**Alternatives considered**
- body `idempotencyKey`：与 Slice 1 Final 冲突，已淘汰；不得作为 fallback。
- query 参数：不适合幂等语义，且易被日志/缓存污染。
- 第二套 header parser：重复 Slice 1 Final 基础设施，禁止。

---

## R-4 Canonical payload hash 的组成

**Decision**
```text
request_hash = sha256(canonicalJson({ familyId, body }))
body = Zod strict 解析后的业务请求体（当前恒为 {}；header 不进入 body）
```
**Rationale**
- `familyId` **必须**进入 hash：它不属于 idempotency scope，但决定业务结果归属；不进入会导致同一 key 跨 Family 回放，产生跨家庭数据泄漏（FR-010 / V1-C21）。
- `familyId` 是**服务端 canonical command context**，不是客户端提交字段；客户端提交 `familyId` 仍按 strict schema 返回 422。这样既保留 Family 归属的 hash 语义，又不允许伪造上下文。
- `Idempotency-Key` header **不进入** hash：它已在 logical scope 中，且位置是 transport，不是业务 payload。
- `actor_account_id` / `command_type` **不**进入 hash：它们已是 `idempotency_keys` 唯一键 `(actor_account_id, command_type, idempotency_key)` 的组成部分，重复混入没有额外区分力，只会把 scope 语义与 payload 语义耦合。
- `body` 进入 hash：保持「同 key 不同 payload → 409」的通用语义；当前 body 为空，但 hash 结构不因 body 为空而退化——`familyId` 仍保证不同 Family 的请求被区分。
- 使用 Zod strict 解析后的对象：未知字段直接 422，不进入 hash，避免「字段顺序不同 → hash 不同」的误判；`canonicalJson` 已按 key 排序。

**可达性澄清（Post-Slice1）**
在**当前 V1 管理语义 + 同一 actor + 同一 current Family canonical context** 下，本 Slice 的 public `POST /api/v1/cases` 的 business body 恒为 `{}`（幂等键在 header），`familyId` 又只能由服务端 current Family 解析唯一确定。因此 public HTTP API 在该 command shape 下**不存在第二种合法业务 payload**，`MISMATCH → 409` 在 HTTP 层不可达。
该分支仍在 shared idempotency domain / repository contract 层实现并验证；不得通过切换 actor（会改变 scope）、伪造 Family 上下文或新增无业务意义字段制造假场景。
canonical hash 仍保留 `{ familyId: verifiedCurrentFamilyId, body: {} }`。未来若正式语义允许同一 actor 在多个 Family 执行 `CASE_CREATE`，相同 scope key + 不同 `familyId` 会得到不同 hash 并正确进入 mismatch；这不是当前 public HTTP 测试场景，也不得删除 `familyId` hash。

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

## R-8 Authorization 增量扩展而非 `authorizeCase()`（**Post-Slice1 Final UPDATED**）

**Decision**
在 Slice 1 Final 的 `authorize()` 内扩展：
- `Action` 增加 `CASE_CREATE` / `CASE_LIST` / `CASE_READ`；
- `Resource` 增加结构化 `{ type: 'CASE'; familyId: string; caseId: string }`（**不是**扁平字符串 `'CASE'`）；
- `AuthInput.case` 从 `null` 扩为 `{ caseId } | null`；
- **不新增** `family.createdByPersonId`；manager 判定继续使用 Final 的 `facts.familyCreatedByPersonId`；
- Case 动作要求 `facts.membership === true`（fail-closed）；
- 新增 `CASE_CONTEXT_REQUIRED`；
- 保持 `basis = { membership, manager, purpose }` 完整形状；
- 路由层复用 Slice 1 Final `apps/server/api/src/authz.ts`，只增量支持 `caseId` 与 Case 错误映射。

**Rationale**
- Slice 1 Final 已把 `authorize()` 重构为结构化 `AuthorizeFacts` + 结构化 `Resource` 对象；恢复旧的 `family.createdByPersonId` / 扁平 `Resource` 会产生第二个授权形状。
- §9 只定义了一个统一 `authorize()` 输入；新建 `authorizeCase()` 会产生第二个权限入口。
- `authz.ts` 已在同一事务内读取 facts；Case 路由复用它可以避免第二套 facts 读取。
- Case 归属无法由纯函数判断；由 `withRlsTransaction` + RLS 保证，`case_id` 仅作待验证参数。
- 不引入 Case role / RBAC / Visibility Matrix / Permission DSL。

**Alternatives considered**
- `authorizeCase()` 独立函数：两个入口，容易出现一处漏判。
- 在路由里直接 if/else 判 manager：绕过统一判定，无法被 domain 测试覆盖。
- 恢复 `family.createdByPersonId` + 扁平 `Resource`：与 Slice 1 Final 冲突，已被淘汰。
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
- 部分索引只保证“当前未结 primary 不重复”；它不把历史 CLOSED 行解释为 API 的 current primary。
- `boolean` 与 enum 比较均为 immutable，可作为 partial index 谓词。

**当前 primary 语义（CHK034，冻结）**
`is_primary = true` 表示“当前 primary assignment”，不是“历史上曾经当过 primary”。本 Slice 所有 Case 只能 `OPEN`，因此最多一个 true；`GET /api/v1/cases` 中 `primary = true` 唯一表示当前 primary。
未来 `CloseCase` / `SwitchPrimaryCase` / recurrence / replacement 若使某 Case 不再是当前 primary，对应未来 Slice 必须在自己的事务合同内清除或转移旧 primary 的 `is_primary`；历史事实由 `case_events` / 历史记录表达，不靠长期保留 `is_primary = true`。本 Slice 不实现转换，只记录未来合同。

**Alternatives considered**
- `UNIQUE (family_id) WHERE is_primary`：会把“历史 CLOSED 行可保留 is_primary”变成硬冲突；本 Slice 的 API 语义要求未来转换清除旧 primary，partial predicate 仍是更稳妥的数据库安全网。
- 触发器维护单 primary：触发器更难审计，且并发下仍需锁；索引更简单可靠。

---

## R-11 `case_events` 与 `cases` 的复合外键

**Decision**
`cases` 增加 `UNIQUE (id, family_id)`；`case_events (case_id, family_id) REFERENCES cases (id, family_id)`。

**Rationale**
- 保证事件的 `family_id` 与 Case 归属一致，即使应用层写错参数也无法跨 Family 挂事件。
- 纯声明式约束，无触发器、无应用层约定。
- 与 RLS 形成两层：RLS 限制「只能看到 / 写当前 Family」，复合 FK 限制「事件必须与 Case 同 Family」。
- migration 必须先建立 `cases` 的 `UNIQUE (id, family_id)`，再创建该复合 FK；否则 PostgreSQL 找不到被引用唯一键。

**Alternatives considered**
- 只靠 RLS：应用层若传错 `family_id` 但 Case 属于另一 Family，RLS 会在当前 Family 上下文下拒绝 Case 查询，但事件仍可能被写入错误 Family；复合 FK 更硬。
- trigger 校验：需要额外函数与测试，声明式约束更简单。

**未采纳**：`cases (family_id, created_by_person_id) → family_members` 复合 FK。
理由：creator 已由认证 actor + `set_family_context` membership 校验 + `authorize()` 保证；再加该 FK 会把 Case 与 membership 生命周期耦合（未来数据权利删除 membership 时可能被 RESTRICT 阻塞），属于超出本 Slice 的耦合。

---

## R-12 迁移编号、顺序与既有 CHECK 扩展

**Decision**
- 不修改 `001_initial_schema.sql`。
- 新增 `db/migrations/<next-after-slice1-final>_case_core.sql`，序号在 Implement Gate 后按 Slice 1 final 实际 migration 解析。
- migration 内严格按「enum → `cases` → `cases` 自身约束（含 `UNIQUE (id, family_id)`）→ `cases` 索引 → `case_events` + 复合 FK / metadata CHECK → RLS / policy → GRANT → 既有 CHECK 扩展」顺序执行。
- 对 `business_audit_events.event_type` / `resource_type`、`idempotency_keys.command_type` 使用 `DROP CONSTRAINT` + `ADD CONSTRAINT` 扩展白名单；实现前读取 `pg_constraint` 确认真实约束名。

**Rationale**
- Slice 1 尚未合并，migration 序号可能变化；Plan 写死序号会与 Slice 1 final 实际编号脱节。
- 复合 FK `case_events (case_id, family_id) → cases (id, family_id)` 要求被引用唯一键 `cases UNIQUE (id, family_id)` **先存在**；若先建 `case_events`，migration 会失败。
- `case_events.metadata` 的 `case_events_metadata_shape_check` 必须与建表同批建立；`metadata` 不设默认值，避免空对象通过。
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

## R-16 Slice 1 偏差清单（**Post-Slice1 Final UPDATED**）

下列偏差在 Slice 1 Final 已**全部修复**；Slice 2 必须继承 Final 行为，**不得照抄旧偏差**。

| 旧偏差 | Slice 1 Final 状态 | 对本 Slice 的约束 |
|---|---|---|
| `families.ts` 幂等 lookup 在无 identity 上下文的 `pool.query` | **已修复**：`runIdempotentCommand` 在 identity 上下文事务内 peek / lock / recheck | Case 幂等必须在 `withRlsTransaction` 内 |
| 幂等响应写入在业务事务之外 | **已修复**：同一事务内 insert / 回填 | Case 必须同一事务原子写入 |
| OpenAPI 声明 `Idempotency-Key` header，runtime / Zod 用 body | **已修复**：runtime / Zod / OpenAPI 统一为 header；schemas 移除 body key | Case 必须使用 header（R1 / R3） |
| `/families/current` 多 Family 取 `rows[0]`、无确定性 | **已修复**：`CURRENT_FAMILY_AMBIGUOUS`（确定性拒绝） | Case 沿用 Final 语义，不定义第二套 Family 错误码 |
| `authorize()` 的 `MANAGER_ACTIONS` 为 placeholder `ALLOW` | **已修复**：结构化 `AuthorizeFacts` + 真实 manager 判定 + `authz.ts` | Case 必须在 Final 模型上增量扩展（R-8） |
| `package.json` 引用不存在脚本 | **已修复**：`db:evidence` / `openapi:generate` / `openapi:check` / `coverage:audit` / `verify-all` 均存在 | Verification Plan 使用真实命令 |

## R-17 OpenAPI 生成 / 检查架构（**Slice 1 Final**）

**Decision**
Slice 2 必须复用 Slice 1 Final 的：
- `apps/server/api/src/openapi-spec.ts` 的 `buildOpenApiDocument()`（从同一 Zod schemas 构建 generated JSON）；
- `scripts/openapi-generate.mjs` 调用该 builder；
- `scripts/openapi-check.mjs` 对 **frozen YAML ↔ runtime** 做语义等价（paths / methods / operationId / parameters / requestBody / response status / components.schemas 结构），不是只比较生成文件 diff。

Slice 2 的 frozen YAML 为 `specs/002-case-core/contracts/cases-api.openapi.yaml`；必须把 Case operations 纳入同一语义等价检查。

**禁止**：inline swagger 临时脚本、`node` vs `bun` 混用、只比较生成文件 hash 的弱检查、hand-edit generated artifact。

## R-18 Runtime env / logging / provider（**Slice 1 Final**）

**Decision**
Slice 2 `app.ts` 必须保留：
- `loadRuntimeConfig(env)` fail-fast（`SESSION_SECRET` / `EVIDENCE_HASH_PEPPER` / WeChat secrets，长度校验）；
- 生产不得 fallback 到 fake WeChat provider（`createWechatProvider`）；
- `requestLogSerializer` + logger redact（不记录 raw IP / UA / authorization）；
- `buildApp({ env, loggerStream })` 的测试注入能力。

Slice 2 只追加 `registerCaseRoutes(app, pool)`；不得恢复 `process.env['SESSION_SECRET'] ?? 'dev-secret-key-for-testing'` 或无条件 `new FakeWechatProvider()`。

---

## 结论

Phase 0 无未解决问题。所有决策均可追溯到 `Docs/**` 或 Slice 1 Final 冻结契约；没有新增产品语义，没有引入未批准依赖。

**Post-Slice1 Final dependency reconciliation（2026-11-07）**：
- R-3 / R1：transport 从 body `idempotencyKey` 正式更新为 **`Idempotency-Key` header**；body 无业务字段；
- R-4：header 不进入 hash；body 恒为 `{}`；
- R-8：authorization 基于 Final `AuthorizeFacts` + 结构化 `Resource` + `authz.ts`，不恢复旧扁平模型；
- R-16：Slice 1 旧偏差已全部由 Final 修复，Slice 2 必须继承；
- R-17：OpenAPI 必须复用 Final `openapi-spec.ts` + semantic equivalence；
- R-18：`app.ts` 必须保留 Final runtime-env / log privacy / provider。

Slice 2 closeout 已收口以下技术项（语义不变）：
- CHK043：`CASE_CREATE` 的 HTTP different-payload mismatch 在「同一 actor + 同一 current Family canonical context」下不可达；shared idempotency contract 保留 §8.5 MISMATCH→409，`familyId` hash 不删除。
- CHK034：`is_primary = true` 冻结为“当前 primary assignment”，未来 Close / switch-primary 必须在自身事务内清除 / 转移；历史由 `case_events` 表达。
- CHK068：`case_events.metadata` 由 `case_events_metadata_shape_check` 强制 key 集合恰为 `{primary, version}`，无默认值。
- CHK084：migration 顺序固定为 enum → `cases` → `cases` 自身约束（含 `UNIQUE (id, family_id)`）→ `cases` 索引 → `case_events` 复合 FK / metadata CHECK → RLS / policy → GRANT → 既有 CHECK 扩展。

进入 Phase 1 的产物：`data-model.md`、`contracts/**`、`quickstart.md`。