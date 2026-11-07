# Requirements Quality Checklist: Case 主问题切换（007-case-primary-switch）

**Feature**: `specs/007-case-primary-switch/spec.md`（已冻结 · SPECIFY / CLARIFY FINAL PASS）
**Plan**: `plan.md`（D-1—D-13 + R-1—R-10）· **Tasks**: `tasks.md`
**Created**: 2026-11-07
**Review object**: Spec（只读）→ Plan → Checklist → Tasks。**不含任何实现代码、migration 或测试实现。**
**Status legend**: `[x] PASS` / `[ ] FAIL` / `[ ] NEEDS REVIEW`

> 本清单是**计划质量门禁**，不是开发任务清单。
> 它检查「Spec 是否被无漂移地投影成可实施的技术方案、并发是否真的收敛、负空间是否守得住、依赖是否诚实」，不检查代码是否已实现。
> 每条均可由评审人对 `spec.md` / `plan.md` / `tasks.md` 作出 PASS / FAIL / NEEDS REVIEW 判断。

> **`CHECKLIST PASS` ≠ `IMPLEMENT GATE OPEN`**
> 本清单全绿只证明计划质量达标。它**不能**替代 Slice 2 的审计二 PASS，也**不能**替代 Slice 2 合并 main。
> Gate 状态见 `plan.md` §0.3 与 §Blockers。

---

## 1. 追溯与范围

- [x] CHK001 每条 FR 是否都追溯到已批准上游 ID 或技术设计章节？[PASS] — `spec.md` Upstream Traceability + 每条 FR 的 `[UPSTREAM: …]` 标签；`plan.md` Upstream Traceability 表逐行对应]
- [x] CHK002 Plan 是否只作为正式文档的下游投影，没有建立第二产品 / 架构真相源？[PASS] — `plan.md` Constitution Check 第 1 条；全文无「本 Plan 决定产品语义」表述]
- [x] CHK003 本 Slice 的存在理由是否仍与 Spec §1 一致（V1-C01 的唯一性必须与可变更性成对）？[PASS] — `plan.md` Summary；D-3]
- [x] CHK004 是否没有把 V2—V5 / 后续 Slice 能力偷带进来？[PASS] — `plan.md` D-13；Tasks Phase 11 的负空间断言]
- [x] CHK005 「明确禁止的东西」是否被当作范围排除，而不是被误读为占位表 / 占位路由 / 空壳抽象？[PASS] — `plan.md` §2.1「new business tables = 0」、D-13；无任何 placeholder 设计]
- [x] CHK006 是否不存在孤儿需求（每条 requirement 都有 Acceptance 或 Acceptance Evidence 落点）？[PASS] — `plan.md` V-1（20 条 FR）与 V-2（23 条 Acceptance）]
- [x] CHK007 本 Slice 与 Slice 1 / Slice 2 的 ownership 边界是否明确？[PASS] — `plan.md` Existing Contracts Reused + Change Reconciliation]
- [x] CHK008 是否明确本 Slice **只**改变「谁是当前主线」，不改任何其他业务事实？[PASS] — `plan.md` D-1.3、D-2.2（只写三列）、D-13]

## 2. Spec → Plan 语义一致性

- [x] CHK009 Spec §6.2 的命令语义（目标 / reason / actor / idempotencyKey / 主线视图）是否在 Plan 中有完整对应输入？[PASS] — `plan.md` D-4 步骤 0—6、D-12.1]
- [x] CHK010 Spec §6.3 的 10 条前置是否逐条映射，且**顺序**被保留或在有冲突时给出显式推导？[PASS] — `plan.md` D-4 的 10—15 步与 §6.3 第 4—9 条一一对应；幂等位置偏移由 D-7.5 以 §9.1(2) + Acceptance 16 推导并显式记为 R-2]
- [x] CHK011 Spec §6.4 的 5 条效果是否全部落地（降级 / 升级 / 审计 / 幂等快照 / 同事务）？[PASS] — `plan.md` D-4 步骤 16—22]
- [x] CHK012 Spec §6.5 的 5 条后置不变量是否都有验证手段？[PASS] — V-2 #1/#15/#2；`count(*) ≤ 1` 断言；`status`/`phase` 前后快照比对]
- [x] CHK013 「无当前 primary → 晋升」边界是否被实现为合法分支而不是 500 / 409？[PASS] — `plan.md` D-5 第 6 行、D-6.3 第一行；V-2 #3]
- [x] CHK014 候选 Case 的业务位置（真实、可读、可审计、不进主线）是否未被本 Slice 改变？[PASS] — `plan.md` D-12.3（不新增读取端点）；D-13]
- [x] CHK015 是否明确「降级后不再满足只有 primary 可推进」的约束由**后续命令**在执行时读取，而不是本 Slice 代其实现？[PASS] — `plan.md` D-13；与 Spec §6「候选 Case 的业务位置」一致]
- [x] CHK016 Spec §22 的 A-1（字段命名 / 包装）是否被显式记录为技术选择？[PASS] — `plan.md` D-12.1 / D-12.2 / R-9]
- [x] CHK017 A-2（reason 长度上限）是否给出了有限上限并写入契约？[PASS] — 500；`plan.md` D-9.3（DB 侧同样约束）+ D-12.1]
- [x] CHK018 A-3（陈旧视图表达）是否被显式选择且强于最低要求？[PASS] — `plan.md` D-6.1（id + version 双字段）+ R-3]
- [x] CHK019 A-4（事件 / 审计枚举字面量）是否在 Slice 2 冻结词汇表内扩展，而不是新建第二套？[PASS] — `plan.md` D-2.3、D-9.2、R-6]
- [x] CHK020 是否出现任何 Spec 未授权的新业务语义？[PASS] — 逐条比对 FR-001—FR-020；无新增]
- [x] CHK021 Plan 是否明确「不处理重新分诊」——只负责「谁在主线」？[PASS] — `plan.md` D-13（无 Phase 转换）；与 Spec Q12 一致]
- [x] CHK022 Plan 是否明确「切换不是状态转换」，不进入 §6.6 状态表？[PASS] — `plan.md` D-1.3]

## 3. 数据模型与零扩张

- [x] CHK023 是否明确 `new business tables = 0`？[PASS] — `plan.md` §2.1 代码块]
- [x] CHK024 是否明确 `new columns = 0`，且逐项禁止 `switch_reason` / `previous_primary_id` / `primary_since` / `switched_at`？[PASS] — `plan.md` §2.1]
- [x] CHK025 是否明确 `new indexes = 0`、`new enums = 0`、`new RLS policies = 0`？[PASS] — `plan.md` §2.1、Data and Migration Impact]
- [x] CHK026 本 Slice 对 `cases` 的写集合是否被精确限定为 `is_primary` / `version` / `updated_at`？[PASS] — `plan.md` D-2.2]
- [x] CHK027 是否明确**不得**写 `status` / `phase` / `family_id` / `created_by_person_id` / `id` / `created_at`？[PASS] — `plan.md` D-2.2 末行]
- [x] CHK028 `updated_at` 是否被显式写入（注意到 `cases` 无自更新触发器）？[PASS] — `plan.md` D-2.2]
- [x] CHK029 `version` 的自增是否被要求写成 SQL 内 `version + 1` 而非读-改-写？[PASS] — `plan.md` D-3 细节 3、R-5]
- [x] CHK030 是否直接复用既有 partial unique index 而**不重建**？[PASS] — `plan.md` D-3.2 L3、Existing Contracts Reused]
- [x] CHK031 是否明确禁止修改 `001` / `002` / `003` migration？[PASS] — `plan.md` D-9.1、Project Structure 末段]
- [x] CHK032 是否没有把 primary 复制到第二张表或以列表排序伪装？[PASS] — `plan.md` D-12.3、D-13]
- [x] CHK033 「零 schema 扩张」是否有机器可验证的证据路径？[PASS] — `plan.md` V-3「迁移结构不变」行：`tests/db/migration-repro.test.ts` 的表 / policy / enum 计数必须不变]

## 4. 事务边界与原子性

- [x] CHK034 是否明确整个命令落在**一个** PostgreSQL 事务内？[PASS] — `plan.md` D-4（步骤 2 开放，步骤 22 COMMIT）]
- [x] CHK035 事务是否覆盖 resolve family / authorize / lock / 重读 / 五类校验 / 降级 / 升级 / 两侧事件 / 审计 / 幂等回填？[PASS] — `plan.md` D-4 全序列；无步骤在事务外]
- [x] CHK036 是否明确禁止「primary 已改变但 event / audit / idempotency 未成功」的部分成功？[PASS] — `plan.md` D-8「不得成功但无证据」；V-2 #22]
- [x] CHK037 是否明确每个 `UPDATE ... RETURNING` 必须断言恰好 1 行？[PASS] — `plan.md` D-4 细节 2（0 行 → `INTERNAL_ERROR` 回滚）]
- [x] CHK038 是否说明为什么必须先降级后升级（partial unique index 非延迟）？[PASS] — `plan.md` D-4 细节 1、R-4]
- [x] CHK039 是否说明降级后「零 primary 中间态」为何安全（未提交 + 索引允许 0）？[PASS] — `plan.md` D-4 细节 1]
- [x] CHK040 是否明确本 Slice 不引入异步任务 / 队列 / 跨事务补偿？[PASS] — `plan.md` Async 段]
- [x] CHK041 是否给出审计写入失败时的整体回滚验证手段（而非仅断言）？[PASS] — `plan.md` V-2 #22；Tasks 中的临时触发器注入方案]
- [x] CHK042 是否明确失败路径**不**留下幂等占位（避免永久毒化）？[PASS] — `plan.md` D-7.4 第 4 行、D-7.6]

## 5. 并发（专项）

- [x] CHK043 是否明确「同一 Family 最终最多一个 primary」的判定边界（`is_primary AND status<>'CLOSED'`）？[PASS] — `plan.md` D-3.1、D-4 步骤 8]
- [x] CHK044 是否逐层说明 lock order / Family 级串行化 / Case 行锁 / unique constraint / 乐观版本 / 冲突恢复各自负责什么？[PASS] — `plan.md` D-3.2 四层表]
- [x] CHK045 是否明确禁止「只靠唯一索引兜底」的写法？[PASS] — `plan.md` D-3.5（23505 = 500 + 回滚，不得当正常分支）]
- [x] CHK046 锁顺序是否被写成确定序列（① 幂等占位 → ② Family → ③ Case 按 id 升序）？[PASS] — `plan.md` D-3.3]
- [x] CHK047 是否证明不存在反向锁顺序？[PASS] — `plan.md` D-3.3（`CASE_CREATE` 只取 ②，不取 ③）]
- [x] CHK048 是否逐项排除死锁环路（switch/switch、switch/create、跨 Family、Case 对、idempotency）？[PASS] — `plan.md` D-3.4 五列表]
- [x] CHK049 是否说明隔离级别（READ COMMITTED）以及为何不升 SERIALIZABLE？[PASS] — `plan.md` D-3.6]
- [x] CHK050 是否明确应用层**不做**自动重试？[PASS] — `plan.md` D-3.6]
- [x] CHK051 并发双切换（不同目标）是否有确定性期望结果可断言？[PASS] — D-3 + 审计 D 表：后到者 409 `STALE_PRIMARY_VIEW`（非「任选一个」）]
- [x] CHK052 并发同目标是否有确定性期望结果？[PASS] — 后到者 409 `CASE_ALREADY_PRIMARY`（步骤 13 早于 14）]
- [x] CHK053 CreateCase vs SwitchPrimaryCase 是否被真正解决（而不是「理论上数据库会处理」）？[PASS] — `plan.md` D-3.4 + V-2 #19；两者共用 ② Family 锁]
- [x] CHK054 并发测试是否使用真实 PostgreSQL 多连接而非进程内锁 / mock？[PASS] — `plan.md` Technical Baseline「Testing」；V-3 并发行]
- [x] CHK055 是否明确 `23505` 必须映射 500 且并发测试必须断言「无 500」？[PASS] — `plan.md` D-3.5、V-3]
- [x] CHK056 是否把「切换与未来命令（关闭 / 暂停 / Safety）」的守卫设计成可扩展固定检查序列？[PASS] — `plan.md` D-5 表格（纯函数 + 固定顺序）+ D-3.3 ③ 排序理由]

## 6. 陈旧视图 / 乐观并发

- [x] CHK057 请求是否**必须**携带主线视图（缺失 → 422，不得退化为无条件覆盖）？[PASS] — `plan.md` D-6.2 第一行]
- [x] CHK058 视图字段是否足够拦 `A→B→A` 往返？[PASS] — `plan.md` D-6.1（id + version 双字段）]
- [x] CHK059 是否给出完整的视图比对真值表（6 种组合）？[PASS] — `plan.md` D-6.3]
- [x] CHK060 视图自相矛盾（一 null 一非 null）是否被拒绝？[PASS] — `plan.md` D-6.2 第 4 行]
- [x] CHK061 是否明确禁止「版本 >= 即可」或「缺失则跳过比较」？[PASS] — `plan.md` D-6.3 末段]
- [x] CHK062 陈旧视图是否被要求 409 且零写入（不得静默胜出）？[PASS] — `plan.md` D-8；V-2 #20]
- [x] CHK063 两个 Case 的 `version` 是否都前进且可被观察？[PASS] — `plan.md` D-2.2、D-12.2（响应返回两侧完整对象）]

## 7. 幂等

- [x] CHK064 是否复用既有 `idempotency_keys` 并明确**不建**第二张幂等表？[PASS] — `plan.md` D-7.1、Data and Migration Impact]
- [x] CHK065 是否新增 `CASE_SWITCH_PRIMARY` 并同步运行时白名单？[PASS] — `plan.md` D-7.1]
- [x] CHK066 canonical payload 是否覆盖所有改变业务结果的输入（familyId / targetCaseId / reason / 视图）？[PASS] — `plan.md` D-7.3]
- [x] CHK067 是否说明「同 key 换目标」为何必须进 hash（该 mismatch 分支**可达**）？[PASS] — `plan.md` D-7.3；与 `CASE_CREATE` 的差异已显式对比]
- [x] CHK068 同 key 同 payload 的 replay 语义是否明确（返回原结果、零重复写入、不递增版本）？[PASS] — `plan.md` D-7.4 第 1 行]
- [x] CHK069 同 key 不同 payload 是否明确 409 且原结果不变？[PASS] — `plan.md` D-7.4 第 2 行]
- [x] CHK070 并发同 key 是否被唯一索引占位串行化，而不是靠应用锁？[PASS] — `plan.md` D-7.4 第 3 行、D-3.3 ①]
- [x] CHK071 失败 / replay 是否都不产生新的 `case_events` / `business_audit_events` / 版本推进？[PASS] — `plan.md` D-7.4；V-2 #16、#22]
- [x] CHK072 幂等识别为何先于状态判定是否给出了可复核的推导（而不是随手改顺序）？[PASS] — `plan.md` D-7.5（引 §9.1(2) + Acceptance 16 + §6.3 注解三条硬约束）+ R-2]

## 8. 事件与审计

- [x] CHK073 是否复用 `case_events` 且明确写**两侧**事件？[PASS] — `plan.md` D-2.3、D-4 步骤 18—19]
- [x] CHK074 目标侧事件是否包含 actor / reason / 原 primary 标识 / 时间 / 版本？[PASS] — `plan.md` D-2.3（actor 在列，其余在 metadata；`occurred_at` 由 DB 默认）]
- [x] CHK075 原 primary 侧事件是否包含 actor / 新 primary 标识 / 时间？[PASS] — `plan.md` D-2.3]
- [x] CHK076 是否说明「为何不能只写一条 Family 级事件」？[PASS] — `plan.md` D-2.3「必须能按 Case 与按 Family 重建」]
- [x] CHK077 reason 是否被要求写入事件（而非只写 `cases` 当前行）？[PASS] — `plan.md` D-2.3、D-9.3]
- [x] CHK078 事件类型白名单是否只做**additive reviewed migration 扩展**，未放宽为任意字符串？[PASS] — `plan.md` D-9.2 #1、D-9.3]
- [x] CHK079 `metadata` 形状约束是否**逐 event_type 分支**保留「额外 key 一律拒绝」的性质？[PASS] — `plan.md` D-9.3]
- [x] CHK080 是否避免把事件 / 审计做成 access log？[PASS] — `plan.md` D-13；V-2 #23（`CASE_VIEWED` 等仍被拒）]
- [x] CHK081 是否沿用 `business_audit_events` 且明确不建第二套审计？[PASS] — `plan.md` D-2.3、D-9.2 #3]
- [x] CHK082 审计内容是否明确不含 token / openid / 证据正文 / 孩子原话？[PASS] — `plan.md` Authorization / Safety / Compliance Impact]
- [x] CHK083 审计与事件是否要求同事务（不允许异步补写）？[PASS] — `plan.md` D-4 步骤 18—21]
- [x] CHK084 是否明确 `case_events` 的 append-only 权限不被本 Slice 破坏？[PASS] — `plan.md` D-9.6 末行]

## 9. 授权 / RLS / 错误语义

- [x] CHK085 是否复用 `authorize()` + RLS，而不新建 `authorizeCase()` 或第二套授权？[PASS] — `plan.md` D-10.1、D-10.2]
- [x] CHK086 新增 action 是否只加一个 `CASE_SWITCH_PRIMARY` 且要求 case 维度？[PASS] — `plan.md` D-10.2]
- [x] CHK087 是否明确只有目标 Family 的管理主体可执行，guardian / 普通成员 / AI 不得升级？[PASS] — `plan.md` D-10.1、D-13；V-1 FR-003]
- [x] CHK088 case-scoped 拒绝是否统一 404 且响应体逐字节一致（含非法 UUID）？[PASS] — `plan.md` D-10.4]
- [x] CHK089 guardian 非成员是否沿用 Family 语义而**不**转换为 Case 错误？[PASS] — `plan.md` D-10.4 末行；V-2 #7]
- [x] CHK090 终态冲突（CLOSED / SAFETY_HOLD / ALREADY_PRIMARY / STALE）是否用 409 而不是 422 或 404？[PASS] — `plan.md` D-8]
- [x] CHK091 是否明确 404 / 403 / 409 / 422 / 500 的互相不可替代性？[PASS] — `plan.md` D-8 补充规则]
- [x] CHK092 RLS 是否仍为第二道防线且**不新增 policy**、不放宽既有 policy？[PASS] — `plan.md` D-9.6]
- [x] CHK093 无上下文 / 错误 Family 下 `UPDATE` 的行为是否被定义（0 行 → 500 回滚，而非静默成功）？[PASS] — `plan.md` D-9.6 第 2 条 + D-4 细节 2]
- [x] CHK094 是否明确授权判定不依赖 `authorize()` 读库推 Case 归属？[PASS] — `plan.md` D-10.3]
- [x] CHK095 错误码命名是否只覆盖 Spec 允许 Plan 命名的部分（已冻结者未改名）？[PASS] — `plan.md` API / Contract Impact（新增 4 个；`CASE_NOT_FOUND` / `CURRENT_FAMILY_*` 未动）]

## 10. Safety / status / phase / 副作用

- [x] CHK096 `SAFETY_HOLD` 是否被**双向**阻断（当前 primary 与目标）？[PASS] — `plan.md` D-5 第 2—3 行、D-11]
- [x] CHK097 谓词是否为真实 `status` 判定而非恒真 / 恒假占位？[PASS] — `plan.md` D-11 末段；R-10]
- [x] CHK098 是否明确不创建 `risk_events` / Safety service / 状态机 / 支持资源？[PASS] — `plan.md` D-11、D-13]
- [x] CHK099 是否禁止「通过切换绕过安全状态」？[PASS] — `plan.md` D-11 第 2 条]
- [x] CHK100 是否明确 `status` / `phase` 在成功切换中零变化，且目标状态不得自动恢复？[PASS] — `plan.md` D-1.3、D-2.2、V-2 #1]
- [x] CHK101 是否明确不 resume / restart / reset phase / close / pause / activate plan / 产生通知？[PASS] — `plan.md` D-13；V-2 #15]
- [x] CHK102 是否明确「降级 Case 不得保留仍会继续普通推进的语义」为**前向义务**而非本 Slice 实现？[PASS] — `plan.md` D-13 第 5 条、D-4 首段注解；与 Spec §13.7 一致]
- [x] CHK103 是否明确本 Slice 不消费 / 不产出 Consent？[PASS] — `plan.md` Authorization / Safety / Compliance Impact]

## 11. 负空间（实现后仍不得存在）

- [x] CHK104 `PauseCase` / `ResumeCase` / `CloseCase` / `CreateRecurrence` 是否被排除且**有断言**（不是「不写就算」）？[PASS] — `plan.md` D-13；Tasks 的 scope 守卫任务枚举禁止路由与禁止表]
- [x] CHK105 Problem Formulation / Evidence writer / Participant / Safety runtime / AI / Notification / Plan / Task 是否均被排除并断言？[PASS] — 同上；沿用 `scripts/guard-static.mjs` 的禁止表清单（不弱化）]
- [x] CHK106 `/cases/current` 与任何第二真相源端点是否被排除并断言？[PASS] — `plan.md` D-12.3；V-2 #23]
- [x] CHK107 是否明确不建第二套审计 / 第二套幂等 / 第二套授权？[PASS] — `plan.md` D-7.1、D-9.2、D-10]
- [x] CHK108 越界守卫是否被要求**精确收窄**而不是删除？[PASS] — `plan.md` Change Reconciliation 第 1 条；Tasks 中对应的守卫任务明确「保留全部其余禁止项」]
- [x] CHK109 是否明确 `cases` / `case_events` 的禁止列 / 禁止关系仍然成立？[PASS] — `plan.md` §2.1；沿用 `tests/db/cases-schema.test.ts` 的全等列断言]
- [x] CHK110 是否明确不新增 `/cases/:id/primary`、批量切换、AI 建议通道？[PASS] — `plan.md` D-12.3、D-13]

## 12. Migration 与回滚

- [x] CHK111 是否明确不需要新增表 / 列 / 索引 / enum / policy，并逐项列出实际变更（5 CHECK + 1 GRANT）？[PASS] — `plan.md` D-9.2]
- [x] CHK112 是否要求先实测真实约束名（不假设默认名）？[PASS] — `plan.md` D-9.2 注 + Gate G5]
- [x] CHK113 是否明确 `idempotency_keys_key_representation_check` 必须同步扩展（否则新命令被强制走 text）？[PASS] — `plan.md` D-9.4]
- [x] CHK114 是否明确 `cases` 的 UPDATE 授权必须是**列级**，且禁止升级为表级？[PASS] — `plan.md` D-9.5、R-7]
- [x] CHK115 是否给出回滚策略，并区分「尚未产生新词汇数据」与「已产生」？[PASS] — `plan.md` D-9.7]
- [x] CHK116 是否明确禁止以「前进方向无 backfill」声称「回滚无数据影响」？[PASS] — `plan.md` D-9.7 第 2、3 行]
- [x] CHK117 是否明确 migration 编号在 Implement 时以实测为准？[PASS] — `plan.md` D-9.1、Gate G7]
- [x] CHK118 是否明确迁移后表 / policy / enum 计数**不得**变化（零扩张的机器证据）？[PASS] — `plan.md` D-9.8、V-3]

## 13. Tasks 可执行性

- [x] CHK119 `tasks.md` 是否按「Phase 0 门禁 → 契约 → 域逻辑 → 持久化 → 授权/RLS → API → 事件/审计 → 幂等/并发 → 验收 → 回归 → 最终验证」组织？[PASS] — `tasks.md` Phase 0—12]
- [x] CHK120 每条任务是否含 Task ID / 目标 / 具体文件 / Depends / Acceptance / Verify / REQ？[PASS] — `tasks.md` 任务格式声明 + 逐条]
- [x] CHK121 任务顺序是否体现依赖且无前向依赖 / 无环？[PASS] — `tasks.md` Dependency Graph 段]
- [x] CHK122 开发 AI 是否能**不重新设计架构**直接执行（无「自行决定锁顺序」「自行选择视图字段」类描述）？[PASS] — 所有关键选择已冻结为 R-1—R-10，任务引用而非重述]
- [x] CHK123 是否包含 RED-first 的测试任务（先于实现）？[PASS] — `tasks.md` Phase 2]
- [x] CHK124 是否包含 Slice 2 守卫的**精确收窄**任务，且明确不得删除其余禁止项？[PASS] — `tasks.md` 对应任务 + CHK108]
- [x] CHK125 是否包含「迁移后既有测试不被削弱」的回归任务？[PASS] — `tasks.md` Phase 11]
- [x] CHK126 最终验证是否包含真实命令清单（typecheck / guard / vitest / openapi / migrate replay / roles / migration-repro）？[PASS] — `tasks.md` Phase 12]
- [x] CHK127 是否存在「无法验证」的 Acceptance 被诚实标注而不是伪造覆盖？[PASS] — Acceptance 10（目标 CLOSED）与 11/12（SAFETY_HOLD）按 Spec Q3a 走 domain 穷举；DB fixture 仅用于不可达的晋升分支，且明确不写 `status`]

## 14. 依赖诚实性

- [x] CHK128 是否明确当前结论是 `PLAN FROZEN` 而非 `READY FOR IMPLEMENTATION`？[PASS] — `plan.md` 审计一结论、§0.3 注]
- [x] CHK129 是否明确 Implement 硬阻断是「Slice 2 审计二 PASS + merge main」？[PASS] — `plan.md` Blockers]
- [x] CHK130 是否记录 Slice 2 当前落后 `origin/main` 4 个提交这一事实？[PASS] — `plan.md` §0.1 表格 + Blockers]
- [x] CHK131 是否区分「可基于冻结合同做 Plan」与「可进入 Implement」？[PASS] — `plan.md` §0.2 双列表]
- [x] CHK132 是否正确划分 hard / contract-only / late / non-dependency 四类？[PASS] — `plan.md` §0.3 + Existing Contracts Reused；Spec §14 四类在 Tasks Phase 0 中被逐项验证]

---

## Review Decision

- **Total CHK**: 132
- **PASS**: 132
- **FAIL**: 0
- **NEEDS REVIEW**: 0
- **Decision**: **PASS — ready for Tasks execution (Implement 门禁仍关闭)**

> 结论：Spec 的 20 条 FR、23 个 Acceptance Scenario、6 条 Success Criteria 已在 Plan 中获得可执行、可验证、无漂移的投影。
> 并发部分（CHK043—CHK056）不是「理论上数据库会处理」，而是四层机制 + 逐项死锁排除 + 确定性期望结果。
> 幂等与陈旧视图（CHK057—CHK072）不是「最后写入者获胜」，而是双字段视图 + 三态幂等 + 显式优先级推导。
> 负空间（CHK104—CHK110）不是「不写就算」，而是守卫断言。

> **再次强调：`CHECKLIST PASS` ≠ `IMPLEMENT GATE OPEN`。**
> 本轮结束状态是 `PLAN FROZEN` + `IMPLEMENT BLOCKED BY Slice 2`。

## Review Log

| 日期 | 事件 | 影响条目 |
|---|---|---|
| 2026-11-07 | Plan / Checklist / Tasks 生成；Spec → Plan → Tasks 三方交叉核对 | 全部 |
| 2026-11-07 | 发现 Spec §6.3 第 10 条（幂等）与 §9.1(2)（重放必须原结果）在字面顺序上冲突；以 R-2 显式冻结优先级并记录推导 | CHK010、CHK072 |
| 2026-11-07 | 发现 `case_events_metadata_shape_check` 为**全局**形状约束，新增事件类型必须逐类型分支而非放宽 | CHK078、CHK079 |
| 2026-11-07 | 发现 `idempotency_keys_key_representation_check` 会强制新命令走 text 列，必须同步扩展 | CHK113 |
| 2026-11-07 | 发现 Slice 2 `roles.test.ts` 断言 `cases` 无 UPDATE，与 007 需求冲突；冻结为**列级授权** + 断言收窄 | CHK114、CHK108 |
| 2026-11-07 | 发现 Slice 2 分支落后 `origin/main` 4 个提交（Slice 1 final remediation）；写入依赖诚实性 | CHK130 |
| 2026-11-07 | 重跑 132 项 Checklist：132 PASS / 0 FAIL / 0 NEEDS REVIEW | 全部 |
