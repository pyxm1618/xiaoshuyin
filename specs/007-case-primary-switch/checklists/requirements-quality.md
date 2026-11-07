# Requirements Quality Checklist: Case 主问题切换（007-case-primary-switch）

**Feature**: `specs/007-case-primary-switch/spec.md`（冻结 · SPECIFY / CLARIFY FINAL PASS @ `00db327`）
**Plan**: `plan.md`（Round 2 — post-refreeze；D-1—D-14 + R-1—R-16）
**Tasks**: `tasks.md`（Phase 0—12）
**Created**: 2026-11-07
**Review object**: Spec（只读）→ Plan → Checklist → Tasks。**不含任何实现代码、migration 或测试实现。**
**Status legend**: `[x] PASS` / `[ ] FAIL` / `[ ] NEEDS REVIEW`

> 本清单是**计划质量门禁**，不是开发任务清单。
> 它检查"Spec 是否被无漂移地投影成可实施的技术方案、并发是否真的收敛、负空间是否守得住、依赖是否诚实"，不检查代码是否已实现。
> 每条均可由评审人对 `spec.md` / `plan.md` / `tasks.md` 作出 PASS / FAIL / NEEDS REVIEW 判断。

> **`CHECKLIST PASS` ≠ `IMPLEMENT GATE OPEN`**
> 本清单全绿只证明计划质量达标。它**不能**替代 Slice 2 的审计二 PASS，也**不能**替代 Slice 2 合并 main。
> Gate 状态见 `plan.md` §0.3 与 §Blockers。

---

## 1. Scope（范围与切片边界）

- [x] CHK001 本 Slice 是否只交付"把已存在 Case 设为唯一 primary 并把原 primary 降级"这一个能力？[PASS] — `plan.md` Summary 1—6；D-1.3 只画一条状态变化；无第二条命令
- [x] CHK002 是否明确不实现 Case `status` 的任何变化？[PASS] — `plan.md` D-2.2「不得写 status」；D-13 第一条
- [x] CHK003 是否明确不实现 Case `phase` 的任何变化？[PASS] — `plan.md` D-2.2；D-13 第二条
- [x] CHK004 是否明确不做关闭 / Outcome / Referral / 复发？[PASS] — `plan.md` D-13 第四条
- [x] CHK005 是否明确不做 Follow-up Schedule / Task / Notification 的创建或迁移？[PASS] — `plan.md` D-13 第五条；FR-019 的前向义务保留在 Spec §13.7
- [x] CHK006 是否明确不做 Participant / 邀请 / 身份绑定 / 孩子参与？[PASS] — `plan.md` D-13 全文无此类对象；§D-14 无相关触碰
- [x] CHK007 是否明确不做 Evidence / Problem Formulation / Goal / Plan / AI / RAG / Memory？[PASS] — `plan.md` D-13；V-2 #23 结构断言
- [x] CHK008 是否明确不做 UI / 运营后台 / 数据权利？[PASS] — `plan.md` D-13 末两条
- [x] CHK009 是否明确不把 V3 的多问题排序 / 优先级建议 / 跨问题视图带进来？[PASS] — `plan.md` D-13 最后一条；无候选评分设计
- [x] CHK010 是否没有把"明确禁止的东西"设计成占位表 / 占位路由 / 空壳抽象？[PASS] — `plan.md` §2.1「new business tables = 0」；D-13；全文无 placeholder
- [x] CHK011 是否仍与 Spec §1 的存在理由一致（V1-C01 的唯一性必须与可变更性成对）？[PASS] — `plan.md` Summary；D-3
- [x] CHK012 是否只在 Phase 1 范围内补控制面，不越入 Phase 2—6？[PASS] — `plan.md` Technical Baseline；Constitution Check 第 2 条

## 2. Ownership（与 Slice 1 / 2 的归属边界）

- [x] CHK013 是否明确本 Slice 拥有"哪个 Case 是 primary"的**变更**语义？[PASS] — `plan.md` Summary；D-1.3
- [x] CHK014 是否明确创建时的自动 primary 判定仍归 Slice 2，本 Slice 不改？[PASS] — `plan.md` D-3.3 注；D-7.7；D-14.1
- [x] CHK015 是否明确 `cases` / `status` / `phase` / `version` / `created_by_person_id` 归 Slice 2，本 Slice 只写三列？[PASS] — `plan.md` D-2.2；Existing Contracts Reused
- [x] CHK016 是否明确 `cases_one_primary_open_per_family` 只依赖、不重建、不弱化？[PASS] — `plan.md` D-3.2 L3；D-14（未列入变更清单）
- [x] CHK017 是否明确 Case 管理主体语义归 Slice 1 / 2，本 Slice 只复用？[PASS] — `plan.md` D-10.1
- [x] CHK018 是否明确 `authorize()` / `withRlsTransaction` / RLS 基线归 Slice 1，本 Slice 只增量？[PASS] — `plan.md` D-10.2；D-9.6
- [x] CHK019 是否明确 `Idempotency-Key` header 合同与重放快照归 Slice 1，本 Slice 只加一个 command_type？[PASS] — `plan.md` D-7.1；R-11
- [x] CHK020 是否明确"哪些对象本 Slice **不拥有**"（PF / Safety State / Closure / Schedule / Participant）？[PASS] — `plan.md` D-13 逐条；D-11 明确不建 Safety 对象
- [x] CHK021 是否明确不修复 Slice 2 自己的文档不一致（`spec.md` 仍标 Draft）？[PASS] — `plan.md` D-14.10 显式"不修复"

## 3. FR Traceability（20 条全覆盖）

- [x] CHK022 FR-001（唯一 primary + 原 primary 降级 + DB 约束兜底）是否有设计落点？[PASS] — `plan.md` D-3.2 L3、D-4 步骤 10—11；V-1 FR-001
- [x] CHK023 FR-002（唯一新增端点，`:id` 是目标，无第二真相源）是否有设计落点？[PASS] — `plan.md` D-12.1 / D-12.3；V-1 FR-002
- [x] CHK024 FR-003（管理主体；case-scoped 统一 404；guardian 非成员走 Family 语义）是否有设计落点？[PASS] — `plan.md` D-10.4；V-1 FR-003
- [x] CHK025 FR-004（目标 CLOSED 拒绝，不隐式重开）是否有设计落点？[PASS] — `plan.md` D-5 第 1 行；D-4 步骤 9
- [x] CHK026 FR-005（当前 primary 与目标双向 SAFETY_HOLD 阻断，真实谓词）是否有设计落点？[PASS] — `plan.md` D-5 第 2—3 行；D-11
- [x] CHK027 FR-006（不改 status/phase；目标不自动恢复；降级 Case 不得继续推进）是否有设计落点？[PASS] — `plan.md` D-2.2；D-1.3；D-13
- [x] CHK028 FR-007（不删除 / 归档 / 覆盖原 primary 数据）是否有设计落点？[PASS] — `plan.md` D-2 只写三列；D-13
- [x] CHK029 FR-008（reason 必填、随历史保留、不被覆盖、不由模型代写）是否有设计落点？[PASS] — `plan.md` D-2.3（两侧事件各存 reason）；R-15；D-13 AI 排除
- [x] CHK030 FR-009（本人显式命令；AI 不得调用 / 代确认；无建议通道）是否有设计落点？[PASS] — `plan.md` D-13；Constitution Check 第 5 条
- [x] CHK031 FR-010（`actor + command_type + key` 幂等；**header** 8—128；mismatch 送达 HTTP）是否有设计落点？[PASS] — `plan.md` D-7.2 / D-7.4 / D-7.5；V-2 #17
- [x] CHK032 FR-011（视图 = id + version；缺失 → 422；不一致 → 409；两侧版本前进）是否有设计落点？[PASS] — `plan.md` D-6.1 / D-6.2 / D-6.3；D-2.2
- [x] CHK033 FR-012（两侧事件 + 一条审计同事务；重放与失败零追加）是否有设计落点？[PASS] — `plan.md` D-2.3；D-4 步骤 12—15；D-8
- [x] CHK034 FR-013（不引入 Case role / RBAC / Visibility Matrix / 管理员抽象）是否有设计落点？[PASS] — `plan.md` D-10.1；D-13
- [x] CHK035 FR-014（不创建 / 空壳化越界对象与路由）是否有设计落点？[PASS] — `plan.md` D-13；V-2 #23
- [x] CHK036 FR-015（单事务；并发不产生两个结果；唯一约束冲突 = 500 回滚）是否有设计落点？[PASS] — `plan.md` D-3.5；D-4；D-8
- [x] CHK037 FR-016（RLS 继续强制；无上下文零行/拒写；不放宽 policy）是否有设计落点？[PASS] — `plan.md` D-9.6；V-2 #21
- [x] CHK038 FR-017（真实失败；无 200 伪装；422 不被 409 掩盖）是否有设计落点？[PASS] — `plan.md` D-8 补充规则；D-4 步骤 0b/0c 早于一切 DB 读取
- [x] CHK039 FR-018（不补默认值 / 默认理由 / 默认目标）是否有设计落点？[PASS] — `plan.md` D-6.2（视图必填，不得退化为无条件覆盖）；D-2 无默认值设计
- [x] CHK040 FR-019（不伪造 Schedule 迁移；冻结前向义务）是否有设计落点？[PASS] — `plan.md` D-13 第五条（显式指向 Spec §13.7）
- [x] CHK041 FR-020（Slice 2 越界守卫**精确收窄**，不整体删除）是否有设计落点？[PASS] — `plan.md` D-14.1 / D-14.2；V-1 FR-020
- [x] CHK042 是否存在无法追溯到 Spec 的"孤儿设计"？[PASS] — 否；Upstream Traceability 表覆盖全部设计段
- [x] CHK043 是否存在 Spec 有、Plan 无落点的 FR？[PASS] — 否；上述 CHK022—CHK041 为 20/20

## 4. Acceptance Traceability（23 个场景全覆盖）

- [x] CHK044 Acceptance 1（首次切换）是否有测试文件与关键断言？[PASS] — V-2 #1（`happy`）
- [x] CHK045 Acceptance 2（往返切换、两条 reason 并存）是否有落点？[PASS] — V-2 #2
- [x] CHK046 Acceptance 3（晋升、`previousPrimary=null`、非 500）是否有落点？[PASS] — V-2 #3；D-5 第 6 行
- [x] CHK047 Acceptance 4（读取一致、无第二真相源）是否有落点？[PASS] — V-2 #4
- [x] CHK048 Acceptance 5（非管理主体 → 404 同体）是否有落点？[PASS] — V-2 #5；D-10.4
- [x] CHK049 Acceptance 6（跨家庭 → 404 + RLS 直查 0 行）是否有落点？[PASS] — V-2 #6
- [x] CHK050 Acceptance 7（guardian 非成员 → Family 语义）是否有落点？[PASS] — V-2 #7；D-10.4 末行
- [x] CHK051 Acceptance 8（目标不存在 / 非法 UUID → 404，非 422）是否有落点？[PASS] — V-2 #8；D-4 细节 4（`UUID_PATTERN` 守卫）
- [x] CHK052 Acceptance 9（已是 primary → 409、版本不变、无事件）是否有落点？[PASS] — V-2 #9；D-5 第 4 行
- [x] CHK053 Acceptance 10（目标 CLOSED → 409、不隐式重开）是否有落点？[PASS] — V-2 #10
- [x] CHK054 Acceptance 11（当前 primary SAFETY_HOLD）是否有落点？[PASS] — V-2 #11；D-5 第 3 行
- [x] CHK055 Acceptance 12（目标 SAFETY_HOLD）是否有落点？[PASS] — V-2 #12；D-5 第 2 行
- [x] CHK056 Acceptance 13（空 / 缺 / 超长 reason、缺视图、视图自相矛盾 → 422）是否有落点？[PASS] — V-2 #13；D-6.2 六种组合表
- [x] CHK057 Acceptance 13 的附加要求"即使同时存在陈旧视图也必须 422 而非 409"是否被显式覆盖？[PASS] — V-2 #13 关键断言列；D-4 步骤 0c 在 0a/1 之后、任何 DB 读取之前
- [x] CHK058 Acceptance 14（未声明字段 → 422 零写入）是否有落点？[PASS] — V-2 #14；D-6.2 末段
- [x] CHK059 Acceptance 14 是否覆盖 `idempotencyKey` 出现在 body 的非法情形？[PASS] — D-6.2 末段明确把它列入禁止清单（R-11 的必然推论）
- [x] CHK060 Acceptance 15（无副作用）是否有落点？[PASS] — V-2 #15
- [x] CHK061 Acceptance 16（同 key 重放，含并发、含世界已变化）是否有落点？[PASS] — V-2 #16；D-7.5
- [x] CHK062 Acceptance 17（同 key 不同目标 / 不同 reason → 409 mismatch）是否有落点？[PASS] — V-2 #17；D-7.4
- [x] CHK063 Acceptance 18（并发双切换 → 1 成功 + 1 冲突）是否有落点？[PASS] — V-2 #18
- [x] CHK064 Acceptance 19（并发切换与创建）是否有落点？[PASS] — V-2 #19
- [x] CHK065 Acceptance 20（陈旧视图 → 409 零写入）是否有落点？[PASS] — V-2 #20；D-6.3
- [x] CHK066 Acceptance 21（RLS 无上下文 → 0 行 / 拒写）是否有落点？[PASS] — V-2 #21
- [x] CHK067 Acceptance 22（审计原子性 → 整体回滚）是否有落点？[PASS] — V-2 #22
- [x] CHK068 Acceptance 23（结构越界、Case operation = 4）是否有落点？[PASS] — V-2 #23；D-12.4
- [x] CHK069 是否存在只有 Acceptance 编号、没有验证手段的场景？[PASS] — 否；V-2 每行都有测试文件 + 关键断言
- [x] CHK070 是否存在无法在真实环境验证却被写成"已覆盖"的场景？[PASS] — 否；Acceptance 10—12 按 Spec Q3a 明确标注"domain 穷举为证据，不伪造 status"

## 5. Transaction（事务边界与原子性）

- [x] CHK071 是否明确整个命令落在**一个** PostgreSQL 事务内？[PASS] — `plan.md` D-4 步骤 2 开启、16 COMMIT
- [x] CHK072 事务是否覆盖 Family 解析 / 授权 / 幂等 / 锁 / 重读 / 冲突 / 降级 / 升级 / 两侧事件 / 审计 / 幂等回填？[PASS] — D-4 全序列；唯一在事务外的是 `requireCurrentFamily` 的只读解析（沿用 Slice 2 既有形状）
- [x] CHK073 是否明确禁止"primary 已改变但 event / audit / idempotency 未成功"的部分成功？[PASS] — D-8「不得成功但无证据」；V-2 #22
- [x] CHK074 是否明确每个 `UPDATE ... RETURNING` 必须断言恰好 1 行？[PASS] — D-4 细节 2
- [x] CHK075 是否说明为什么必须先降级后升级？[PASS] — D-4 细节 1、R-4
- [x] CHK076 是否说明"零 primary 中间态"为何安全？[PASS] — D-4 细节 1（未提交 + 索引允许 0 条）
- [x] CHK077 是否明确不引入异步任务 / 队列 / 跨事务补偿？[PASS] — Async 段「N/A」
- [x] CHK078 是否给出审计写入失败时的整体回滚验证手段（而非仅断言）？[PASS] — V-2 #22；tasks 的临时 trigger 注入方案
- [x] CHK079 是否明确失败路径**不**留下幂等占位？[PASS] — D-7.5 第四行；Spec §9.3 引用
- [x] CHK080 是否明确事务由 `withRlsTransaction` **唯一**持有，不嵌套第二个事务包装器？[PASS] — D-7.6；R-16
- [x] CHK081 是否说明为何不采用 `runIdempotentCommand()`（自持事务 + 无 family 上下文）？[PASS] — D-7.6 逐条理由

## 6. Idempotency（幂等专项）

- [x] CHK082 是否复用既有 `idempotency_keys` 并明确不建第二张表？[PASS] — D-7.1；Data and Migration Impact
- [x] CHK083 是否新增 `CASE_SWITCH_PRIMARY` 到运行时白名单并有一致性测试？[PASS] — D-7.1；V-3「幂等占位」行
- [x] CHK084 幂等传输是否**只**使用 `Idempotency-Key` header？[PASS] — D-7.2 表；R-11
- [x] CHK085 是否明确 body 中出现 `idempotencyKey` 必须 422 而不是被忽略？[PASS] — D-6.2 末段
- [x] CHK086 是否明确 header 解析复用 main 上已存在的 `readIdempotencyKey()`，而非新写？[PASS] — D-7.2；Existing Contracts Reused
- [x] CHK087 canonical payload 是否覆盖 familyId / targetCaseId / reason / 视图两项？[PASS] — D-7.4
- [x] CHK088 是否说明"同 key 换目标"为何必须进 hash（该 mismatch 分支可达）？[PASS] — D-7.4 第二条
- [x] CHK089 是否说明 `actor` / `command_type` 为何不重复进 hash？[PASS] — D-7.4 第四条
- [x] CHK090 同 key 同 payload 的 replay 语义是否明确（原结果、零重复写入、不推进版本）？[PASS] — D-7.5 第一行
- [x] CHK091 同 key 不同 payload 是否明确 409 且原结果不变？[PASS] — D-7.5 第二行
- [x] CHK092 并发同 key 是否被唯一索引占位串行化，而不是靠应用锁？[PASS] — D-7.5 第三行；D-3.3 ①
- [x] CHK093 是否处理"占位已提交但未回填"（`response_status = 0`）的病态行？[PASS] — D-7.5 `POISONED` → 500，不当作 REPLAY
- [x] CHK094 是否处理"占位冲突但对端已回滚、查不到行"的边界？[PASS] — D-7.5 有界重试 ≤2 → `CONTENTION` → 500；R-14
- [x] CHK095 是否说明占位为何必须早于状态判定（并发重放要求）？[PASS] — D-7.5「为什么占位必须早于状态判定」
- [x] CHK096 是否明确幂等识别在**授权之后**（不把旧结果返回给无权请求）？[PASS] — D-4 步骤 4 前于 5a；R-2
- [x] CHK097 是否明确 `CASE_SWITCH_PRIMARY` 走 bytea-only 精确身份？[PASS] — D-7.3；R-13
- [x] CHK098 是否说明为何不需要 legacy text 回退？[PASS] — D-7.3（无 pre-003 历史 + 结构上排除 text-only）
- [x] CHK099 是否明确不修改 `CASE_CREATE` 的幂等语义？[PASS] — D-7.7；D-9.4（`CASE_CREATE` 分支保持原样）

## 7. Concurrency（并发专项）

- [x] CHK100 是否明确"同一 Family 最多一个未结 primary"的判定边界（`is_primary AND status <> 'CLOSED'`）？[PASS] — D-3.1；D-4 步骤 7
- [x] CHK101 是否逐层说明 application serialization / row lock / unique index / optimistic version 各自负责什么？[PASS] — D-3.2 四层表
- [x] CHK102 是否明确禁止"只靠唯一索引兜底"？[PASS] — D-3.5
- [x] CHK103 锁顺序是否写成确定序列（幂等占位 → Family → Case 按 id 升序）？[PASS] — D-3.3
- [x] CHK104 是否证明不存在反向锁顺序？[PASS] — D-3.3（`CASE_CREATE` 只取 ②）
- [x] CHK105 是否逐项排除死锁环路（switch/switch、switch/create、跨 Family、Case 对、幂等）？[PASS] — D-3.4 五列表
- [x] CHK106 是否说明隔离级别（READ COMMITTED）以及为何不升 SERIALIZABLE？[PASS] — D-3.6
- [x] CHK107 是否明确应用层不做业务自动重试，且说明唯一例外（占位有界重试）？[PASS] — D-3.6；D-7.5
- [x] CHK108 并发双切换（不同目标）是否有确定性期望结果？[PASS] — 后到者 409 `STALE_PRIMARY_VIEW`（V-2 #18）
- [x] CHK109 并发同目标是否有确定性期望结果？[PASS] — 后到者 409 `CASE_ALREADY_PRIMARY`（D-5 第 4 行早于第 5 行）
- [x] CHK110 `CreateCase` vs `SwitchPrimaryCase` 是否被真正解决（而非"数据库会处理"）？[PASS] — D-3.4 + V-2 #19；两者共用 Family 锁
- [x] CHK111 并发测试是否使用真实 PostgreSQL 多连接？[PASS] — Technical Baseline「Testing」；V-3「并发」行
- [x] CHK112 是否明确 `23505` 必须映射 500 且并发测试断言"无 500"？[PASS] — D-3.5；V-3
- [x] CHK113 是否把"切换与未来命令（关闭 / 暂停 / Safety）"的守卫设计成可扩展的固定检查序列？[PASS] — D-5 表格 + D-3.3 ③ 排序理由

## 8. RLS

- [x] CHK114 是否明确不新增 RLS policy？[PASS] — `plan.md` §2.1 `new RLS policies = 0`；D-9.6
- [x] CHK115 是否明确 `cases` 的 UPDATE 由既有 `cases_family_scope` 自动约束？[PASS] — D-9.6 第一条
- [x] CHK116 无上下文 / 错误 Family 下 `UPDATE` 的行为是否被定义（0 行 → 500 回滚，而非静默成功）？[PASS] — D-9.6 第二条 + D-4 细节 2
- [x] CHK117 是否明确 `case_events` 仍不可 UPDATE / DELETE？[PASS] — D-9.6 末条
- [x] CHK118 是否确认 `idempotency_keys` 的 identity 级 policy 在本命令的事务上下文下可用？[PASS] — D-9.6 末条（`withRlsTransaction` 同时设置 identity 与 family 上下文）
- [x] CHK119 是否明确不放宽任何既有 policy？[PASS] — D-9.6；FR-016

## 9. Authorization

- [x] CHK120 是否复用 `authorize()` + RLS，而不新建 `authorizeCase()` 或第二套授权？[PASS] — D-10.1 / D-10.2；G6
- [x] CHK121 新增 action 是否只加一个 `CASE_SWITCH_PRIMARY`，且要求 case 维度？[PASS] — D-10.2 表
- [x] CHK122 是否明确 `MANAGER_ACTIONS` / `Purpose` 集合不变？[PASS] — D-10.2「明确不做」行
- [x] CHK123 是否明确只有目标 Family 的管理主体可执行；guardian / 普通成员 / AI 不得升级？[PASS] — D-10.1；D-13
- [x] CHK124 是否明确路由必须**就地覆盖** `ERROR_MAP` 的 `NOT_FAMILY_MANAGER → 403`？[PASS] — D-10.4 末段（Spec §16.11 的陷阱）
- [x] CHK125 终态冲突（CLOSED / SAFETY_HOLD / ALREADY_PRIMARY / STALE）是否用 409 而非 422 / 404？[PASS] — D-8
- [x] CHK126 是否明确 404 / 409 / 422 / 500 的互相不可替代性？[PASS] — D-8 补充规则
- [x] CHK127 是否明确授权判定不依赖 `authorize()` 读库推 Case 归属？[PASS] — D-10.3
- [x] CHK128 是否明确新增错误码只覆盖 Spec 允许 Plan 命名的部分（已冻结者未改名）？[PASS] — API / Contract Impact（新增 4 个；`CASE_NOT_FOUND` / `CURRENT_FAMILY_*` / `CASE_ACCESS_DENIED` 未动）
- [x] CHK129 是否说明授权为何必须先于状态判定（否则 409 泄露安全状态）？[PASS] — §Change Reconciliation 的 REC-05 段

## 10. Privacy / Anti-leak

- [x] CHK130 case-scoped 拒绝是否统一 404，且响应体与 Case 详情 404 逐字节一致？[PASS] — D-10.4 前两行
- [x] CHK131 非法 UUID 是否收敛到 404 而不是 422？[PASS] — D-4 细节 4；D-10.4 第三行
- [x] CHK132 guardian 非成员是否沿用 Family 语义而**不**转成 Case 错误码？[PASS] — D-10.4 末行
- [x] CHK133 是否明确 404 响应不得包含 status / phase / primary / creator / Family / 是否存在？[PASS] — D-10.4；V-2 #5
- [x] CHK134 审计与事件是否明确不含 token / openid / 证据正文 / 孩子原话？[PASS] — Authorization / Safety / Compliance Impact
- [x] CHK135 是否明确 reason 是唯一的用户文本，且只进事件 / 审计、不进响应与日志面？[PASS] — D-12.2「为什么不返回 reason」；D-2.3
- [x] CHK136 是否明确 `500` 不泄露 SQLSTATE / SQL / 参数？[PASS] — D-8 末条

## 11. Events / Audit

- [x] CHK137 是否复用 `case_events` 并明确写**两侧**事件？[PASS] — D-2.3；D-4 步骤 12—13
- [x] CHK138 目标侧 metadata 是否含 primary / version / previousPrimaryCaseId / reason？[PASS] — D-2.3 第二行
- [x] CHK139 原侧 metadata 是否含 primary / version / newPrimaryCaseId / reason？[PASS] — D-2.3 第三行
- [x] CHK140 actor 与时间是否落在既有列（`actor_account_id` / `occurred_at`）而非塞进 metadata？[PASS] — D-2.3 只列 4 个 key，与既有列不重复
- [x] CHK141 是否说明为什么不能只写一条 Family 级事件？[PASS] — D-2.3「必须能按 Case 与按 Family 重建」
- [x] CHK142 是否说明 reason 为何进事件而不是 `cases` 行？[PASS] — D-2.3
- [x] CHK143 是否沿用 `business_audit_events` 且明确不建第二套审计？[PASS] — D-2.3；D-9.2 #3
- [x] CHK144 事件 / 审计是否要求同事务（不允许异步补写）？[PASS] — D-4 步骤 12—14
- [x] CHK145 是否避免把事件 / 审计做成 access log？[PASS] — D-13；V-2 #23（`CASE_VIEWED` 仍被拒）
- [x] CHK146 是否明确重放与失败零追加？[PASS] — D-7.5；V-2 #16 / #22

## 12. Migration

- [x] CHK147 是否明确不需要新增表 / 列 / 索引 / enum / policy？[PASS] — §2.1 代码块；Data and Migration Impact
- [x] CHK148 变更项数量是否自洽（5 个 CHECK + 1 条 GRANT = 6）？[PASS] — D-9.2 标题与表格一致；`replaced CHECK constraints = 5` 与 `new column-level GRANT = 1` 分别计数
- [x] CHK149 是否要求先实测真实约束名（不假设默认名）？[PASS] — D-9.2 注 + G7
- [x] CHK150 是否把 `idempotency_keys_key_representation_check` 列为必改项，并说明不改的后果？[PASS] — D-9.4；D-14.12
- [x] CHK151 `CASE_SWITCH_PRIMARY` 的表示是否收紧为 bytea-only？[PASS] — D-9.4 第三分支；R-13
- [x] CHK152 是否明确 `cases` 的 UPDATE 必须是列级、且禁止升级为表级？[PASS] — D-9.5；R-7
- [x] CHK153 是否明确列级授权下 `has_table_privilege` 仍为 false，因此 Slice 2 断言不需要放宽？[PASS] — D-9.5 第二条
- [x] CHK154 若实测与 CHK153 预期相反，处理方向是否唯一（改 migration，不改测试）？[PASS] — D-9.5 末句
- [x] CHK155 `case_events_metadata_shape_check` 是否逐 event_type 分支，且 `CASE_CREATED` 分支与原定义等价？[PASS] — D-9.3
- [x] CHK156 数值子句是否要求 `CASE WHEN` 守护以避免 cast 错误？[PASS] — D-9.3「数值子句必须用 CASE WHEN 守护」
- [x] CHK157 reason 长度上限的 API/DB 方向是否一致（code unit ≥ 字符数）？[PASS] — D-9.3 末段；R-15
- [x] CHK158 是否说明 `resource_type` CHECK 不需修改（`CASE` 已存在）？[PASS] — D-9.2 注；D-14.7
- [x] CHK159 migration 编号是否明确"Implement 时实测取 max+1"？[PASS] — D-9.1；G8
- [x] CHK160 是否给出回滚策略并区分"尚未产生新词汇数据"与"已产生"？[PASS] — D-9.7
- [x] CHK161 是否明确禁止以"前进无 backfill"声称"回滚无数据影响"？[PASS] — D-9.7 第三条
- [x] CHK162 是否明确迁移后表 / policy / enum 计数不得变化？[PASS] — D-9.8；V-3
- [x] CHK163 是否明确不修改 `001` / `002` / `003`？[PASS] — D-9.1；Project Structure 末段

## 13. OpenAPI

- [x] CHK164 是否明确只新增 1 个 path 与 1 个 operation？[PASS] — D-12.4 预期结果
- [x] CHK165 Case path 集合是否明确由 2 项变 3 项、operation 由 3 变 4？[PASS] — D-12.4；V-2 #23
- [x] CHK166 既有 3 个 operation 的 operationId / security / tags 是否要求逐条保留？[PASS] — D-12.4 末条；D-14.2
- [x] CHK167 `Idempotency-Key` 是否以 header parameter 出现，并复用既有组件而非内联新造？[PASS] — D-12.4 末条
- [x] CHK168 是否明确 `packages/contracts/src/schemas.ts` 是唯一事实源、生成物不得手改？[PASS] — D-12.4 前两条
- [x] CHK169 是否确认 `scripts/openapi-generate.mjs` 无需修改？[PASS] — D-12.4 第三条
- [x] CHK170 `openapi-cases.test.ts` 中"把 `switch-primary` 当禁止片段"的那条断言是否被显式处置（而非假设它会自然通过）？[PASS] — D-14.2 明确"检查串不匹配新路径，必须改为正向断言"
- [x] CHK171 是否明确新增 operation 的错误响应集合与既有三操作风格一致？[PASS] — D-12.1 错误列表

## 14. Regression

- [x] CHK172 `cases-scope.test.ts` 是否只减 1 项禁止片段、其余 13 项逐条保留？[PASS] — D-14.1
- [x] CHK173 是否要求 `printRoutes` 相关断言**实测后**再改，而不是假设渲染不变？[PASS] — D-14.1 括注
- [x] CHK174 `cases-schema.test.ts` 的 9 列全等断言是否要求原样保留？[PASS] — D-14.4
- [x] CHK175 `cases-events-metadata.test.ts` 是否只改用例标题、断言体保留？[PASS] — Project Structure 末段
- [x] CHK176 `roles.test.ts` 的表级断言是否保留并新增列级正向断言？[PASS] — D-9.5；D-14.3
- [x] CHK177 是否包含"迁移后既有测试不被削弱"的回归任务？[PASS] — tasks Phase 11
- [x] CHK178 是否明确禁止"改测试让实现通过"？[PASS] — D-9.5；D-14.1 / 2 / 4 / 5 / 6 / 7 / 8 均写明"不得"
- [x] CHK179 `migration-repro.test.ts` 的计数断言是否被要求保持不变？[PASS] — D-9.8

## 15. Negative-space（实现后仍不得存在）

- [x] CHK180 `PauseCase` / `ResumeCase` / `CloseCase` / `CreateRecurrence` 是否被排除且**有断言**？[PASS] — D-13；tasks 的 scope 守卫任务枚举禁止路由与禁止表
- [x] CHK181 Problem Formulation / Evidence writer / Participant / Safety runtime / AI / Notification / Plan / Task 是否均被排除并断言？[PASS] — 同上
- [x] CHK182 `/cases/current` 与任何第二真相源端点是否被排除并断言？[PASS] — D-12.3；V-2 #23
- [x] CHK183 是否明确不建第二套审计 / 第二套幂等 / 第二套授权？[PASS] — D-7.1；D-9.2；D-10；D-7.6 末段
- [x] CHK184 是否明确不新增 `/cases/:id/primary`、批量切换、AI 建议通道？[PASS] — D-12.3；D-13
- [x] CHK185 是否明确 `cases` 的禁止列与禁止关系仍成立？[PASS] — §2.1；D-14.4
- [x] CHK186 是否明确 `case_events` 词汇恰为 3 值而不是开放集合？[PASS] — D-9.2 #1；V-2 #23
- [x] CHK187 是否明确 `scripts/guard-static.mjs` 不修改且其真实规则（`FORBIDDEN_PATHS` + `R6-scope-guard`）不被放宽？[PASS] — Project Structure「不得触碰」；tasks 对应任务使用真实常量名

## 16. Implement Gate

- [x] CHK188 是否建立 G1（Slice 2 审计二 PASS）？[PASS] — §0.3
- [x] CHK189 是否建立 G2（Slice 2 merge main）？[PASS] — §0.3
- [x] CHK190 是否建立 G3（main 真实包含 Case runtime）？[PASS] — §0.3
- [x] CHK191 是否建立 G4（锁语义未 drift）？[PASS] — §0.3
- [x] CHK192 是否建立 G5（幂等语义未 drift）？[PASS] — §0.3
- [x] CHK193 是否建立 G6（授权未 drift）？[PASS] — §0.3
- [x] CHK194 是否建立 G7（约束名与谓词实测一致）？[PASS] — §0.3
- [x] CHK195 是否建立 G8（migration 编号未冲突）？[PASS] — §0.3
- [x] CHK196 是否建立 G9（current main 全量基线绿）？[PASS] — §0.3
- [x] CHK197 是否建立 G10（Case 命令族单一幂等传输）？[PASS] — §0.3
- [x] CHK198 每个 Gate 是否都有固定失败文案且文案可区分？[PASS] — §0.3 六条文案
- [x] CHK199 是否明确"任一失败即停止、不得开始 Implement"？[PASS] — §0.3 表头；tasks Phase 0 门禁
- [x] CHK200 是否明确 Gate 全绿 ≠ 007 通过审计二？[PASS] — §0.3 末段

## 17. Dependency Honesty

- [x] CHK201 结论是否为 `PLAN FROZEN` 而非 `READY FOR IMPLEMENTATION`？[PASS] — 审计一结论；§0.3 末段
- [x] CHK202 是否明确 Implement 硬阻断是"Slice 2 审计二 PASS + merge main"？[PASS] — `## Blockers`
- [x] CHK203 是否记录 Slice 2 落后 `origin/main` 4 个提交？[PASS] — §0.1 表；`## Blockers` 第 2 条
- [x] CHK204 是否记录真实 ahead/behind 为 **41 / 4**（而非旧版的 38/4 或 Spec 的 40/4）？[PASS] — §0.1；Change Reconciliation 第 1 条
- [x] CHK205 是否记录 `origin/main` 只有 `001_initial_schema.sql`？[PASS] — §0.1
- [x] CHK206 是否区分"可基于冻结合同做 Plan"与"可进入 Implement"？[PASS] — §0.2 双列表
- [x] CHK207 是否把 Implement blocker 与 Planning blocker 分开表述？[PASS] — `## Blockers` 写 `NONE`，Implement 阻断单列
- [x] CHK208 是否记录 Slice 2 分支仍是 body 传输这一真实事实，并说明它不是 007 的缺陷但会继续阻断 007？[PASS] — §0.1 第 2 点；`## Blockers` 第 3 条
- [x] CHK209 是否明确 007 **不得**代替 Slice 2 完成 merge / reconciliation？[PASS] — `## Blockers` 第 4 条；D-7.7
- [x] CHK210 是否正确划分 hard / contract-only / late / non-dependency？[PASS] — §0.2；Upstream Traceability 末两行

## 18. Tasks 可执行性

- [x] CHK211 `tasks.md` 是否按 Phase 0—12 组织且顺序合理？[PASS] — `tasks.md` 目录结构
- [x] CHK212 每条任务是否含 Task ID / REQ / 目标 / 文件 / 依赖 / VERIFY 六元组？[PASS] — 任务格式声明 + 逐条
- [x] CHK213 任务顺序是否体现依赖且无前向依赖 / 无环？[PASS] — Dependency Graph 段
- [x] CHK214 是否存在"完善一下 / 视情况 / 必要时 / 确保正确"类不可执行措辞？[PASS] — 全文 0 处（审计时逐条 grep）
- [x] CHK215 是否包含 RED-first 的测试任务（先于实现）？[PASS] — Phase 2
- [x] CHK216 是否包含 Slice 2 守卫的精确收窄任务，且明确不得删除其余禁止项？[PASS] — Phase 11
- [x] CHK217 是否包含"迁移后既有测试不被削弱"的复核任务？[PASS] — Phase 11
- [x] CHK218 最终验证是否包含真实命令清单？[PASS] — Phase 12
- [x] CHK219 开发 AI 是否能不重新设计架构直接执行（无"自行决定锁顺序 / 自行选择视图字段"）？[PASS] — 关键选择已冻结为 R-1—R-16
- [x] CHK220 每条 VERIFY 是否是可运行的命令或可归档的证据，而不是"确认无误"？[PASS] — 逐条为命令 / SQL / 输出比对
- [x] CHK221 tasks 引用的测试文件是否全部出现在 Plan 的 Project Structure 中？[PASS] — 14 个新增测试文件一一对应（含 `case-primary-switch-scope` 与 `case-primary-switch-idempotency`）

## 19. Docs diff = 0

- [x] CHK222 本轮是否承诺 `Docs/**` diff 为 0？[PASS] — Project Structure「不得触碰」；`tasks.md` 语境界定
- [x] CHK223 是否明确 `specs/001-006/**` 不被修改？[PASS] — 同上
- [x] CHK224 是否明确 `spec.md` 不被修改？[PASS] — `tasks.md` 语境界定；本轮实际只改 plan / checklist / tasks
- [x] CHK225 是否明确 `db/migrations/001|002|003` 不被修改？[PASS] — D-9.1
- [x] CHK226 是否明确治理验证命令（`validate-governance.mjs`）与 `Docs` 保护的关系？[PASS] — V-3「治理」行；D-9 前向影响

---

## 20. 审计一补充检查（重读 Spec 与既有测试后回填）

> 本节 7 项由审计一在重读 Spec §6.3A / §13.1 / §14.4 / §17.1 与既有测试文件时发现"Plan 上一稿未显式化"，已回填 Plan 后逐项复核。

- [x] CHK227 Spec §6.3A 第 9 步（理由的业务复核，标注为"冗余防线"）是否被显式处理，而不是被静默省略？[PASS] — `plan.md` D-4 步骤 9b：明确它是**可证明不可达的域内断言**，只允许 assert，不得产出新的 422，也不得覆盖第 9 步的 409
- [x] CHK228 是否说明"guardian 非成员"为何天然落到 Family 语义，而不需要 Case 层分支？[PASS] — `plan.md` D-10.4 补充段：`resolveCurrentFamily` 的 SQL 以 `family_members` 为 JOIN 条件，非成员只能得到 `NONE` / `AMBIGUOUS`
- [x] CHK229 是否明确 `app.set_family_context` 的 `42501`（`FAMILY_MEMBERSHIP_REQUIRED`）在本命令中不可达，且若出现必须 500 而非静默转 404？[PASS] — `plan.md` D-10.4 补充段第 2 条
- [x] CHK230 是否明确 `getFamilyById` 返回 `null` 时按 fail-closed 处理为 404，而不是 500 或泄露 Family？[PASS] — `plan.md` D-10.4 补充段第 3 条
- [x] CHK231 `is_primary` 的写入路径是否被显式约束为"封闭可枚举"（Spec §13.1），且 `updated_at` 明确不参与业务判断（Spec §17.1.3）？[PASS] — `plan.md` D-2.2 两段补充
- [x] CHK232 是否把 Late E2E 依赖（Spec §14.4）与 Implement 阻断分开，且禁止在完成报告里写成"已验证"？[PASS] — `plan.md` §Blockers 的「Late E2E dependency」段
- [x] CHK233 是否识别出"触碰被改约束但无需修改"的既有测试，并明确其断言为何仍然成立？[PASS] — `plan.md` D-14.14：`case-idempotency-representation.test.ts` 只按名断言约束存在、只覆盖 `FAMILY_CREATE` / `CASE_CREATE`；新命令的覆盖放在新文件，且该文件不得被放宽

## Review Decision

- **Total CHK**: 233
- **PASS**: 233
- **FAIL**: 0
- **NEEDS REVIEW**: 0
- **Decision**: **PASS — 计划可冻结（Implement 门禁仍关闭）**

> 结论：Spec 的 20 条 FR、23 个 Acceptance Scenario、6 条 Success Criteria 已在 Plan 中获得可执行、可验证、无漂移的投影。
> 并发（CHK100—CHK113）不是"数据库会处理"，而是四层机制 + 逐项死锁排除 + 确定性期望结果。
> 幂等（CHK082—CHK099）不是"最后写入者获胜"，而是 header 传输 + bytea 精确身份 + 五态判定 + 有界重试。
> 负空间（CHK180—CHK187）不是"不写就算"，而是守卫断言。

> **再次强调：`CHECKLIST PASS` ≠ `IMPLEMENT GATE OPEN`。**
> 本轮结束状态是 `PLAN FROZEN` + `IMPLEMENT BLOCKED BY Slice 2`。

## Review Log

| 日期 | 事件 | 影响条目 |
|---|---|---|
| 2026-11-07 | 首版 Plan / Checklist / Tasks 生成（基线 `69cfe6f`） | 全部（已被本轮取代） |
| 2026-11-07 | Spec 重冻结到 `00db327`：写入 §6.3A 求值顺序、把幂等传输冻结为 header、补记 11 条代码收窄点 | CHK031、CHK084、CHK193 |
| 2026-11-07 | **本轮**逐项 reconciliation：以 `00db327` 为准重新核对 Plan / Checklist / Tasks | 全部 |
| 2026-11-07 | 发现旧 Plan 的 `body.idempotencyKey` 与冻结 Spec §9.1.2 直接冲突；改为 header + `readIdempotencyKey()` | CHK084—CHK086 |
| 2026-11-07 | 发现 `runIdempotentCommand()` 自持事务且无 family 上下文，无法嵌入 `withRlsTransaction`；冻结为只复用三个 domain 函数 | CHK080、CHK081 |
| 2026-11-07 | 发现"占位冲突但对端已回滚"会让 `ON CONFLICT DO NOTHING` 返回 0 行且留空；补有界重试与 `POISONED`/`CONTENTION` | CHK093、CHK094 |
| 2026-11-07 | 发现 `CASE_SWITCH_PRIMARY` 若沿用"恰有其一"会留下 text-only 歧义；收紧为 bytea-only | CHK097、CHK098、CHK151 |
| 2026-11-07 | 现场实测 Slice 2 = `fb30f28`，相对 main **41 / 4**（非 38/4 也非 40/4） | CHK204 |
| 2026-11-07 | 发现列级 GRANT 下 `has_table_privilege` 仍为 false，Slice 2 的 `roles.test.ts` 断言无需放宽 | CHK153、CHK154、CHK176 |
| 2026-11-07 | 发现 `guard-static.mjs` 无 `FORBIDDEN_TABLE_PATTERNS`；真实为 `FORBIDDEN_PATHS` + `R6-scope-guard` | CHK187 |
| 2026-11-07 | 补记 `Docs/V1技术设计.md` §29.4 与 Spec §6.3A 的编号/顺序差异，说明 §29.4 是前置清单 | CHK129 |
| 2026-11-07 | 发现 `R-05`（reconciliation 说明）与冻结决策 `R-5` 编号冲突，改名为 `REC-05` | CHK129 |
| 2026-11-07 | 审计一重读 §6.3A / §13.1 / §14.4 / §17.1，回填 6 处未显式化的语义细节 | CHK227—CHK232 |
| 2026-11-07 | 审计一比对既有测试文件，补第 14 条 reconciliation（`case-idempotency-representation.test.ts`） | CHK233 |
| 2026-11-07 | 重跑 233 项 Checklist：233 PASS / 0 FAIL / 0 NEEDS REVIEW | 全部 |
