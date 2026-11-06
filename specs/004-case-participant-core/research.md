# Research — 004-case-participant-core

**Feature**: `specs/004-case-participant-core/spec.md`
**阶段**: Plan（Phase 1）
**权威**: `Docs/V1产品需求.md` v3.7 / `Docs/V1技术设计.md` v3.12 / `specs/005-invited-identity-binding-contract/spec.md`（已 merge main）。
**边界**: 本文只记录 Plan 阶段需要决定、且不能从已冻结文档直接抄出的技术选择；不重新决定产品语义。

---

## R-1 单一参与资源 vs 独立 invite 领域表

**决定**：只建一张 `case_participants`。`invite_token_hash` 是同一行的传输载体列；不建 `participation_invites` 第二领域表。

**理由**：
- spec OQ-1 已冻结“领域上只有一个 Case 参与资源”；token 只是传输 / 呈现入口。
- `POST /api/v1/participations/:id/decline` 要求 accept 前存在一个可被 decline 的 participation 资源；若把 invite 独立成表，会形成两个生命周期、两个真相源。
- 一张表可让 `(case_id, person_id)` 唯一性、状态时间戳、RLS、审计都落在同一行。

**否决的替代**：
- `participation_invites` + `case_participants` 双表：会造成 pending 资源与 active participation 的跨表状态同步，且与 OQ-1 冲突。
- token 直接作为 participation id：token 会进入 URL / 日志 / 审计，且无法轮换 / hash-only 存储；拒绝。

---

## R-2 Identity prerequisite 只比较 `actor.personId`，不直接读 `persons.account_id`

**决定**：accept 的身份前置是：

```text
actor.personId === participation.person_id
```

`actor.personId` 由现有 auth plugin 从 authenticated Account 解析。Slice 4 不读、不写、不复制 `persons.account_id`。

**理由**：
- Account↔Person 是已在 Slice 1 冻结的独立身份事实；auth plugin 已经把“当前 Account 绑定到谁”解析为 `personId`。再读 `persons.account_id` 会把同一事实复制到参与逻辑，并制造第二判断点。
- 该比较天然覆盖 Case B / Case C：
  - Case B 正确 Account → `personId = P1` → 通过；
  - Case B 错误 Account → `personId != P1` → generic 失败；
  - Case C 未 COMMITTED → `personId` 为 null / 其它 Person → generic 失败；
  - Case C 已 COMMITTED → `personId = P1` → 通过，但仍需显式 accept。
- 不需要区分 Case B / Case C 的内部结果，因此不会把“是否需要 binding”做成 candidate-facing oracle。

**否决的替代**：
- accept 时读 `persons.account_id` 并比较：可以工作，但把 binding 事实复制进 participation 命令，且容易在日志 / 错误中泄露 Case B / C 差异。
- accept 时读 005 binding attempt 状态：Slice 4 不应依赖 005 内部 attempt 表，且 PENDING / TERMINAL 都应表现为“未绑定”；读 attempt 反而扩大耦合面。

---

## R-3 Case B / Case C 在 accept 层不可区分

**决定**：accept 端点只暴露一个 generic 结果：identity prerequisite 满足 → 允许 pending → active；否则 → `404 PARTICIPATION_NOT_FOUND`。不返回 `IDENTITY_BINDING_REQUIRED`、`ACCOUNT_MISMATCH`、`CASE_C` 等区分性错误。

**理由**：
- 005 §5.6.2 要求未绑定 candidate 的内外结果分离；Slice 4 不重新定义该语义，但必须不破坏它。
- 若 Slice 4 对 Case B wrong Account 返回 A、对 Case C unbound 返回 B，就会形成“P1 是否有 Account / 是否已绑定”的 oracle。
- 客户端始终从 invitation 进入 005 invitation-aware bootstrap；Slice 4 的 accept 只是最终状态转换。Case B 的短路由 005 runtime 负责。

**否决的替代**：
- 在 accept 响应中返回 `requiresIdentityBootstrap: true`：直接泄露 Case C。
- 在 accept 前增加 `GET /invite/:token/identity-status`：新增 oracle 端点，超出最小 surface。

---

## R-4 过期采用惰性有效状态 + 首次授权访问物化

**决定**：
- `PENDING` 且 `now() >= invite_expires_at` 在业务上等价于 `EXPIRED`；
- 未认证 invite lookup 只返回 `UNAVAILABLE`，不改写行；
- 有授权的 accept / decline / GET participation 观察到过期时，用条件 UPDATE 物化 `EXPIRED` + `expired_at` + audit；commit 后再返回真实失败 / 状态；
- 不引入 pg-boss / 后台定时器 / Temporal。

**理由**：
- spec OQ-4 只要求“有限、服务端强制、caller 不可自定义、到期不可接受、历史保留”；没有要求定时 job。
- 惰性物化保证：任何 accept 路径都必须检查 `expires_at`，因此过期资源不可能被接受；同时避免本 Slice 引入 worker / notification 依赖。
- 审计物化只在有授权上下文时发生，避免无 family 上下文时绕过 RLS 写 audit。

**否决的替代**：
- 后台 job 定时扫过期：引入 pg-boss / worker，超出本 Slice 且无正式通知需求。
- DB trigger 在 `now()` 到时自动改状态：PostgreSQL 没有时间触发器；需要 job。
- 不物化、只算有效状态：无法在 DB / audit 中留下 EXPIRED 终态；不满足可审计性。

**审计诚实性**：`PARTICIPATION_EXPIRED` 的 `occurred_at` 是物化时间，metadata 写真实 `expiresAt` 与 `materializedOnAccess: true`；不伪造成到期瞬间。

---

## R-5 TTL 只定义配置接口，不冻结数字

**决定**：
- `packages/contracts/src/env.ts` 新增 `PARTICIPATION_INVITE_TTL_SECONDS`，必须为正整数，无默认值；
- 缺失 / 非法 → 启动配置校验失败（fail-closed）；
- 创建 invite 时 `invite_expires_at = created_at + TTL`；
- caller 不得提交 / 覆盖 / 延长；
- Plan 不写 `7d` / `24h` / `72h` / `30d` 等任何生产值；
- 测试 / CI 使用显式 test-only 值，不构成产品 TTL。

**理由**：
- spec OQ-4 / FR-015 明确 TTL 数值属 RELEASE / POLICY GATE，依据 §34.1 在上线前按真实服务目的、法规、供应商条款锁定。
- 配置化允许 release gate 批准具体值，而无需改代码 / migration。
- 启动失败比“请求时 fallback 永久”更安全。

**否决的替代**：
- DB `DEFAULT now() + interval '24 hours'`：把未批准数字写进 schema，违反 release gate。
- 请求体 `expiresIn`：caller-defined TTL，明确禁止。
- 缺配置时 fallback 永久：明确禁止。

---

## R-6 invite token：随机 32 字节、hash-only 存储、全局唯一

**决定**：
- token = 32 字节 CSPRNG，base64url 编码，作为不透明 bearer secret；
- DB 只存 `sha256(token)` hex（64 chars），不存明文；
- `invite_token_hash` 全局 UNIQUE；
- 明文只在建邀请响应返回一次；后续读取 / 日志 / 审计不再出现。

**理由**：
- spec FR-006 要求 token 不可猜测 / 枚举；32 字节随机提供足够熵。
- hash-only 存储避免 DB 泄露直接获得可用 token。
- 全局唯一允许按 token 精确定位一条 participation，不暴露其它行。

**否决的替代**：
- JWT / 自签 token：引入额外密钥轮换 / 过期语义，且与 005 identity token 混淆；拒绝。
- 明文存储 token：DB 泄露即邀请泄露；拒绝。
- token = participation id：可枚举 / 可猜测；拒绝。

---

## R-7 invite lookup 使用 GUC + RLS token policy，而非 SECURITY DEFINER

**决定**：
- 新增 `app.invite_token_hash` GUC、`app_invite_token_hash()` getter、`app.set_invite_token_context(text)` setter；
- `case_participants` 增加 `FOR SELECT` policy：`invite_token_hash = app_invite_token_hash()`；
- 未认证 invite lookup 在只设置 token 上下文的事务内执行；
- repository 专用 safe-column 查询只 SELECT `id, state, expires_at, created_at`；不 SELECT `person_id` / `case_id` / `family_id`。

**理由**：
- `SECURITY DEFINER` 函数会绕过 RLS，把“不泄露”责任完全交给函数实现；与“RLS 是第二道防线”不一致。
- GUC + policy 仍是数据库层可审计的访问路径；safe-column 查询限制返回面。
- 无 family / person 上下文时，token policy 只允许精确 token 行，不会跨家庭扫描。

**否决的替代**：
- `SECURITY DEFINER` 返回 generic 视图：可行但绕过 RLS；拒绝。
- 未认证 lookup 先按 token 在应用层查全表：需要 BYPASSRLS / owner；拒绝。
- 把 token 查询放进 `withRlsTransaction`：未认证没有 family / person，无法建立上下文；拒绝。

---

## R-8 同一 (case, person) 最多一个 live participation

**决定**：partial unique index：

```sql
UNIQUE (case_id, person_id) WHERE state IN ('PENDING', 'ACTIVE')
```

**理由**：
- spec FR-029 / SC-002 要求同一 Person 同一 Case 不得有重复 active participation；重复 / 并发只能收敛到一个业务结果。
- 允许多个 PENDING 会让 accept 出现“接受哪一个”的歧义，也会让 decline 语义不唯一。
- terminal 行不受约束，因此 decline / expire / withdraw 后可以 new invitation（新资源），符合“terminal 不可复活、未来参与需新邀请”。

**否决的替代**：
- 允许无限 pending：需要额外“选择当前 invite”规则，属新业务语义。
- 只约束 ACTIVE：并发建邀请会产生多个 pending，accept 时无法确定唯一目标。

---

## R-9 审计只复用 `business_audit_events`，不写 `case_events`

**决定**：
- 5 类 participation 事件写入 `business_audit_events`；
- `resource_type = CASE_PARTICIPANT`；
- 不扩展 / 不写入 `case_events`；
- 不建第二张 audit 表。

**理由**：
- spec FR-023 明确“复用既有 `business_audit_events`；MUST NOT 创建第二套 audit framework”。
- `case_events` 在 Slice 2 有严格的 `event_type = CASE_CREATED` 与 metadata shape `{primary, version}`；为 participation 扩展它会把 Case 领域历史与参与历史耦合，且需要改 Slice 2 冻结形状。
- participation 行自身已有完整状态时间戳；audit 提供“谁在何时做了什么”。

**否决的替代**：
- `case_events` + `business_audit_events` 双写：重复且需改 Slice 2 约束。
- 新建 `participation_audit_events`：第二套 audit，明确禁止。

---

## R-10 `越权作废` 不是新状态，而是授权失败

**决定**：
- 不新增 `REVOKED` / `CANCELLED` 状态；
- `越权作废` 映射为：未授权 actor 的操作被拒绝，**不改变** invitation 状态；
- 邀请的正式终态只有 `DECLINED` / `EXPIRED`；active 的终态只有 `WITHDRAWN`；
- 不实现 manager cancel / creator cancel / family manager cancel。

**理由**：
- spec 冻结生命周期（OQ-1—OQ-3 / 用户冻结语义）明确只有 `pending → accepted / declined / expired` 与 `active → withdrawn`。
- 005 §5.6.4 明确 invitation lifecycle 由 Slice 4 拥有，但当前 Slice 4 正式合同**没有**批准 manager cancel；不得发明。
- 若未授权 actor 能触发“作废”，会形成拒绝服务 / 枚举攻击面；安全上应保持邀请对 target 仍有效。
- FR-015 的“越权作废”在本 Plan 中解释为“越权操作被拒绝、邀请不被越权者改变”，与 anti-enumeration / 无 manager cancel 一致。

**否决的替代**：
- 新增 `REVOKED` 状态：违反“不得新增状态”。
- 让 Family manager 可 cancel：005 明确禁止在无 Slice 4 正式授权时出现；本轮不补该授权。
- 让错误 candidate 触发 invite 作废：等于把 token possession 升级为破坏能力；拒绝。

> 若未来正式需要“有权主体主动撤销邀请”，必须先改上游 `Docs/**` / 合同并新增正式授权语义；本 Plan 不预造。

---

## R-11 幂等复用既有表；新 command 用 text key

**决定**：
- 复用 `idempotency_keys` 与 `runIdempotentCommand()`；
- 新 command types 使用 `idempotency_key text`（非 CASE_CREATE），不引入 bytea；
- canonical payload 包含 path / token hash / participation id，确保同 key 不同请求 → 409。

**理由**：
- Slice 1 的 `idempotency_keys_key_representation_check` 已规定“非 CASE_CREATE → text only”，新 command 天然适用。
- CASE_CREATE 的 bytea 表示是为 UTF-16LE exact identity 引入的特殊修正，不需要扩散到其它 command。
- 不建第二套幂等框架。

**否决的替代**：
- 为所有 command 改用 bytea：无必要，且会扩大 Slice 2 amendment 影响面。
- 新建 participation idempotency 表：第二套框架，禁止。

---

## R-12 复合 FK 保证 target Person 属于目标 Family

**决定**：
- 在 `family_members` 上增加 `UNIQUE (person_id, family_id)`（若 final merged main 尚无）；
- `case_participants (person_id, family_id) REFERENCES family_members (person_id, family_id)`；
- `case_participants (case_id, family_id) REFERENCES cases (id, family_id)`。

**理由**：
- spec SC-001 要求 cross-Family participant writes = 0；应用校验 + RLS 是两层，但复合 FK 是结构防线，防止应用 bug 写入跨 Family 关系。
- Family membership 仍是唯一真相源；FK 只是引用，不复制 membership 事实。
- Case 归属同理，复用 Slice 2 的 `cases(id, family_id)` 唯一键。

**否决的替代**：
- 只靠应用校验 + RLS：RLS 是行级可见性，不是“Person 属于 Family”的引用完整性；应用 bug 仍可能插入。
- 在 `case_participants` 存 `family_id` 副本但不加 FK：会漂移。

**注意**：若 final merged `family_members` 已有复合唯一键或 FK 结构不同，Implement 必须读取真实 `pg_constraint` 后等价实现，不得假设默认约束名。

---

## R-13 decline / withdraw 不做 Compliance gate

**决定**：
- decline 只要求 `actor.personId === participation.person_id` 且 `state = PENDING`；
- withdraw 只要求 `actor.personId === participation.person_id` 且 `state = ACTIVE`；
- 二者不重新检查 guardian / consent / Compliance。

**理由**：
- spec FR-011 / FR-013 把 decline / withdraw 定义为合法用户结果；若用 Compliance gate 阻断退出 / 拒绝，会强迫未成年人留在参与关系中，违反产品语义与安全原则。
- FR-010 的 gate 明确针对“参与邀请与接受”，不针对 decline / withdraw。
- 退出 / 拒绝不产生新的处理能力，不需要新的 consent。

**否决的替代**：
- withdraw 前重检 consent：会把退出变成不可用；拒绝。
- decline 前重检 consent：同上；且 decline 是“拒绝”，应当始终可用。

---

## R-14 不创建 Case 读取 / Evidence / 通用 response

**决定**：
- participation 行不修改 Slice 2 的 Case 读取规则；
- accept / decline / withdraw 不写 `assertions` / `observations` / 任何 Evidence；
- 不建 `POST /participations/:id/responses`；
- 不建 participant-to-participant 可见性 / 共享内容。

**理由**：
- spec FR-017 / FR-018 / FR-025、Out of Scope、Slice 3 边界明确。
- 参与是关系事实，不是 Case 内容授权；未来具体对象仍需独立 Visibility / Purpose / feature authorization。
- 通用 response 会变成万能 blob，与后续 Assessment / Formulation / Goal / Plan 的对象边界冲突。

**否决的替代**：
- accept 时自动给 Case read：违反 FR-018。
- accept 写 Statement / Observation：违反 FR-019。
- 通用 response endpoint：违反 FR-028。

---

## R-15 005 runtime 是独立依赖，不在 Slice 4 重造

**决定**：
- Slice 4 只消费 005 的最终身份事实（`actor.personId` 已绑定 P1）；
- 不建 binding attempt 表、不实现 candidate recognition、不实现 no-P2 bootstrap、不实现 Age Gate 1/2；
- Case C 端到端验收要求 005 runtime 可用；在不可用时明确 `BLOCKED`，不得用“直接写 persons.account_id”伪装 Case C。

**理由**：
- spec OQ-6 / FR-009 / FR-024 明确 Slice 4 只消费 merged 005 contract，不重新定义 identity proof。
- 005 contract 是合同，不是 runtime；`main` 当前没有 invitation-aware bootstrap 实现。
- 把 005 runtime 塞进 Slice 4 会扩大 scope、重复身份证明、违反“Slice 4 不重新设计 identity binding”。

**否决的替代**：
- Slice 4 自己实现 Case C bootstrap：违反 OQ-6 / 005 边界。
- 用普通登录 + 手工 `persons.account_id` 更新：会创建 P2 或伪造绑定；拒绝。
- 在测试中直接写 `persons.account_id` 并声称覆盖 Case C：只能作为 Case B fixture，不得冒充 005 端到端。

---

## R-16 错误映射与防枚举

**决定**：
- 建邀请：Case 不存在 / 跨 Family / 非 manager → 统一 `404 CASE_NOT_FOUND`；
- invite lookup：无效 / 过期 / terminate → 统一 `404 INVITATION_NOT_AVAILABLE`；
- accept / decline / withdraw / GET：未授权 / 不存在 / 非 target → 统一 `404 PARTICIPATION_NOT_FOUND`；
- 授权 target 的非法状态 → `409 PARTICIPATION_STATE_CONFLICT`（仅 currentState）；
- strict schema → `422 VALIDATION_ERROR`，零写入。

**理由**：
- spec FR-022 / SC-006 / SC-011 要求不泄露存在性与私密细节。
- 统一 404 避免“403 vs 404”差异成为存在性 oracle。
- 对已授权 target 返回 409 currentState 是必要的真实状态，不泄露 Case / Family / guardian / consent。

**否决的替代**：
- 建邀请复刻 Slice 2 的 `403 CASE_ACCESS_DENIED` + `404 CASE_NOT_FOUND` 二分：会泄露 Case 是否存在 / actor 是否 manager；spec 明确要求三类一致。
- 所有错误都 404：会把真实的授权 target 状态冲突伪装成不存在，不利于用户理解；且 spec 要求真实状态。

---

## R-17 测试使用真实 DB，不 mock；Case C 必须真实经过 005 runtime

**决定**：
- DB / RLS / 并发测试使用真实 PostgreSQL 18；
- 不 mock 数据库；
- Case C 场景必须经过 005 runtime，或在 005 runtime 缺失时明确 `BLOCKED`；
- 不伪造不可达 HTTP 场景（与 Slice 2 的 CASE_CREATE mismatch 不同，本 Slice 的 mismatch 可达）。

**理由**：
- AGENTS §5 验证契约要求真实证据；mock 无法证明 RLS / FK / 并发。
- 005 runtime 缺失时，直接写 `persons.account_id` 只能证明 Slice 4 的“已绑定”分支，不能证明 Case C bootstrap / no-P2 / candidate recognition；不得把 fixture 当端到端证据。

---

## R-18 Plan-level interpretation 清单（需 Owner 可见）

以下不是产品变更，而是 Plan 对冻结语义的技术映射：

1. `越权作废` = 授权失败，不新增状态（R-10）。
2. 未认证 invite lookup 返回 `participationId`，以便 target 之后调用 `POST /participations/:id/decline`；不返回 Person / Family / Case。
3. 过期惰性物化（R-4），无后台 job。
4. TTL 通过必需配置表达，具体数值仍属 release gate（R-5）。
5. 同一 (case, person) 只允许一个 live participation（R-8），terminal 后可新邀请。
6. 审计只写 `business_audit_events`，不写 `case_events`（R-9）。
7. decline / withdraw 不做 Compliance gate（R-13）。
8. Case C 依赖 005 runtime；未实现前 Implement Gate BLOCKED（R-15 / D-17）。

若 Owner 认为任一映射需要回到 Clarify / 上游文档，必须先停止 Implement，不得由 Plan 静默改写。