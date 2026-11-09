# Requirements Quality Checklist: Identity Binding Runtime（006-identity-binding-runtime）

**Feature**: `specs/006-identity-binding-runtime/spec.md`
**Plan**: `plan.md`
**Created**: 2026-11-07
**Scope**: 检查 Plan 是否完整、明确、一致、可验证地覆盖已冻结 Spec 与 005 合同；不检查实现。
**Checklist PASS ≠ Implement Gate OPEN**。

> 每条格式：`- [x] CHK### <需求质量问题> [质量维度, 追溯引用]`。
> `[x]` 只表示该质量问题在 Plan / Spec / 上游材料层已得到答案，不表示代码已实现。

---

## 1. Scope & Upstream Alignment

- [x] CHK001 Is 006 的 In Scope 全部映射到 005 合同或 Docs 的明确条款，没有新增产品能力？[Completeness, spec §Scope / plan Upstream Traceability]
- [x] CHK002 Are Out of Scope 的 13 类对象（普通登录、KYC、merge/unlink、AI、UI、Participant、Case、Evidence、invitation、Consent 平台、多家庭、后台任务、V2–V5）逐项在 Plan 中被排除，而非只列名字？[Completeness, spec §Out of Scope / plan D-20]
- [x] CHK003 Does Plan 明确拒绝把 `business_audit_events`、`idempotency_keys`、`case_participants` 或任何 Slice 1–4 表当作 006 的业务真相源？[Consistency, plan D-1 / D-15 / D-16]
- [x] CHK004 Is 「binding 是独立身份事实、不授予业务授权」在数据模型、API、RLS、audit、downstream contract 五处一致，而非只出现在一句声明？[Consistency, spec FR-018 / plan D-1 / D-10 / D-13 / D-15]
- [x] CHK005 Is 「Slice 2 / Slice 3 不是依赖」明确写为 non-dependency，而不是含糊的「暂不涉及」？[Clarity, spec FR-026 / plan D-22.2]
- [x] CHK006 Is 「Slice 4 runtime 未实现」与「Slice 4 contract 已冻结」被区分，且 contract-level 与 E2E 的验证边界明确？[Clarity, spec §Dependencies / plan D-16.2]
- [x] CHK007 Does Plan 明确禁止修改 `Docs/**`、`specs/001~005/**`、Slice 4 文件，而不是把它留给 Implement 自行判断？[Consistency, AGENTS §7 / plan D-20 / D-22]
- [x] CHK008 Is 每个 Plan 决策都能追溯到至少一个 spec FR / AS / SC 或上游章节，没有 orphan 设计？[Traceability, plan Upstream Traceability / D-19.2]

## 2. Phase Order, Case B / Case C, Ordinary Login

- [x] CHK009 Is Phase A → Gate 1 → Phase B → Gate 2 → Phase C 的唯一顺序在 Plan 中被保留，且没有任何「可交换 / 可跳过 / 可合并」的表述？[Consistency, 005 §5.1 / spec FR-005—FR-011]
- [x] CHK010 Is Phase A 的禁止清单（P1 关联、P1-specific confirmation、P1 信息、second-party recognition request、Person、Account、session、active participation、family context）逐项实现为可检查约束？[Completeness, spec FR-005 / plan D-8.3 / D-13]
- [x] CHK011 Is Gate 1 被明确放在任何 P1-specific processing 之前，而不是只放在「Phase B 之前」？[Consistency, 005 §5.1 / plan D-8.3]
- [x] CHK012 Is Phase B 的 temporary association 被明确允许存在，且不等于 binding / ordinary identity / participation / authorization？[Clarity, 005 §5.1 第 12 条 / spec FR-007]
- [x] CHK013 Is Gate 2 明确使用 current state，而不是 Gate 1 快照；且 Gate 1 PASS 不豁免 Gate 2？[Consistency, spec FR-010 / plan D-8.4]
- [x] CHK014 Is Phase C 被明确为唯一产生 `Account A ↔ P1` 的时点，且 Phase A / B 不创建正式 Account？[Consistency, spec FR-011 / plan D-6]
- [x] CHK015 Is Case B 正确 Account 的复用路径写明「不进入 Case C identity bootstrap state machine、不要求重新双确认、不创建新 binding」，且明确「bootstrap endpoint 被调用」≠「进入 Case C state machine」的防御性 endpoint fallback？[Completeness, spec FR-003 / plan D-10.2 / D-17.2]
- [x] CHK016 Is Case B 错误 Account 的路径写明「拒绝、不 rebind、不替换、不创建 active participation」？[Completeness, spec FR-003 / plan D-6.3]
- [x] CHK017 Is Case C 被限定为 P1 Account = NULL 的唯一 bootstrap 路径，且没有第二条创建 Account / binding 的路径？[Consistency, spec FR-004 / plan D-6 / D-20]
- [x] CHK018 Is ordinary-login-first（A↔P2 后打开 P1 邀请）明确判定为 identity conflict，且 A↔P2 与 P1 均保持不变？[Completeness, 005 §5.2 第 4 条 / spec AS-08]
- [x] CHK019 Is 「invite possession ≠ identity proof」在 bootstrap、candidate decision、confirmer decision 三处都没有被弱化为 token 即证明？[Consistency, 005 §4.1 / spec FR-001 / plan D-10]
- [x] CHK020 Is invitation lifecycle 与 attempt lifecycle 的分离在 attempt 表、terminal reason、new attempt、replay 四处一致？[Consistency, spec FR-015 / plan D-2 / D-5]
- [x] CHK021 Is 「candidate cancel / reject / expiration 不改变 invitation」写成明确的禁止项，而不是隐含结果？[Clarity, spec FR-015 / plan D-10.2]
- [x] CHK022 Is 「binding 成功后才允许 ordinary authenticated identity」与「binding success 本身不产生 active participation」同时成立且无矛盾？[Consistency, spec FR-011 / plan D-10.2 / D-17.2]

## 3. Age / Pre-gate Matrix, Consent, Compliance

- [x] CHK023 Is UNDER_14 的 Gate 1 四项（P1 存在、current guardian、current valid guardian consent、applicable Compliance）逐项可判定？[Completeness, 005 §5.4 / plan D-8.2]
- [x] CHK024 Is UNDER_14 明确禁止 Family manager fallback，且只允许 current guardian 作为 second party？[Consistency, 005 §5.4 注 2 / plan D-9.1]
- [x] CHK025 Is MINOR_14_17 有 guardian 时确认者必须是该 guardian，而不是 manager？[Consistency, 005 §5.4 注 3 / plan D-9.1]
- [x] CHK026 Is MINOR_14_17 无 guardian 时才允许目标 Family V1 管理主体，且 manager 必须独立辨认？[Clarity, 005 §5.4 注 4 / plan D-9.1 / D-9.4]
- [x] CHK027 Is MINOR_14_17 的 consent 豁免被收窄为「不因年龄要求 UNDER_14 guardian consent」，而不是「不需要任何 consent」？[Precision, 005 §5.4 注 5 / spec FR-006]
- [x] CHK028 Is ADULT 明确 NOT SUPPORTED（TERMINAL），而不是复用 `assertMinorProcessingAllowed` 的 ADULT ALLOW？[Consistency, spec FR-006 / plan D-8.2]
- [x] CHK029 Is UNKNOWN 明确 BLOCK，且不得按 ADULT 或未成年任一类放行？[Consistency, spec FR-006 / plan D-8.2]
- [x] CHK030 Is attempt 期间 age_band / guardian / consent / Compliance 变化明确触发重估，且失效转 TERMINAL 而非 PENDING？[Completeness, 005 §5.4 注 7 / plan D-8.4]
- [x] CHK031 Is `verified_source` 被明确排除在 guardian authority 之外，且没有被用来发明 guardian verification？[Consistency, 005 §5.4 注 8 / plan D-8.2]
- [x] CHK032 Is guardian relationship 只来自 `person_compliance_profiles.guardian_person_id`，不从 `family_members` 推导？[Consistency, 005 §6.3 / plan D-8.1]
- [x] CHK033 Is guardian consent 只来自 `consent_records` 当前有效版本，且复用 `assertMinorProcessingAllowed` 的 notice / bound person / guardian 校验？[Completeness, plan D-8.1]
- [x] CHK034 Is 「applicable Compliance gate」被限定为 V1 baseline 真实存在的 profile + consent 事实，而不是偷偷新建 `compliance_feature_policies` 等平台？[Clarity, plan D-8.1]
- [x] CHK035 Is Gate 1 失败时「不记录 P1-specific candidate confirmation、不请求 P1-specific recognition、不建立 P1 关联」三项都可执行？[Completeness, spec FR-006 / plan D-8.3]
- [x] CHK036 Is Gate 2 失败或失效明确不得 PENDING 掩盖，且 commit blocked？[Consistency, spec FR-010 / plan D-8.4]

## 4. Binding Attempt Data Model

- [x] CHK037 Is 新增 `binding_attempts` 的必要性由 settled replay / concurrency / audit 三个上游要求共同证明，而不是「方便」？[Justification, plan D-1 / D-2]
- [x] CHK038 Does attempt 表明确拥有 attempt 身份、P1、target Family、invitation ref、candidate identity digest、lifecycle、settled outcome？[Completeness, plan D-2.1]
- [x] CHK039 Is attempt lifecycle 封闭为 `PENDING / COMMITTED / TERMINAL`，没有第四种 attempt state？[Consistency, spec FR-013 / plan D-2.2]
- [x] CHK040 Is `RETRYABLE` 明确为 operation outcome、绝不落 attempt state？[Consistency, 005 §5.5 / plan D-2.2]
- [x] CHK041 Is PENDING 边界（只表示仍合法且缺可补齐步骤）在数据库 CHECK、状态机、API response 三处一致？[Consistency, spec FR-013 / plan D-2 / D-10]
- [x] CHK042 Is COMMITTED / TERMINAL 的 settled 语义明确为不可逆，且没有反向 UPDATE 路径？[Consistency, spec FR-013 / plan D-2.2]
- [x] CHK043 Is attempt expiration 明确记录为 `expires_at` + 访问时条件物化，而不是后台 job 或隐式推断？[Clarity, plan D-2.2 / D-14]
- [x] CHK044 Is live attempt 唯一性明确为「仅 PENDING 的部分唯一索引」，不是永久 `(P1, identity, invitation)` 全局唯一？[Precision, spec FR-017 / plan D-2.1 / D-7.1]
- [x] CHK045 Is terminal / committed 后允许同三元组 new attempt 的路径可执行，不被部分唯一索引阻塞？[Consistency, 005 §5.5 第 6 条 / plan D-7.3]
- [x] CHK046 Is `binding_attempt_id` 与 operation idempotency key 明确分离，且没有任何代码路径混用？[Consistency, 005 §5.5 第 1 条 / plan D-2.3 / D-5.4]
- [x] CHK047 Is attempt history / confirmation / audit 在 terminal 后允许保留，而不是被删除或覆盖？[Completeness, 005 §5.5 / plan D-2.2 / D-15]
- [x] CHK048 Is attempt 表明确不承载 membership、guardian、Consent、Case / Participant 权限、Evidence？[Consistency, spec Key Entities / plan D-1.1]
- [x] CHK049 Is `target_person_id` / `target_family_id` 使用真实 FK，而 `invitation_participation_id` 明确不建 FK，避免耦合 Slice 4？[Clarity, plan D-2.1 / D-16.1]
- [x] CHK050 Is attempt 可回读性（重启后状态 / outcome / confirmation / audit）有明确的持久化落点？[Completeness, spec AS-19 / plan D-2 / D-15]

## 5. Pending Authentication Context

- [x] CHK051 Is pending context 明确不是 Person、不是正式 Account、不是普通 session、不是 family-scoped identity？[Consistency, spec FR-005 / plan D-3.2]
- [x] CHK052 Is token 明确为 opaque 随机值，不是 JWT，不含 openid / person / attempt 明文？[Security, plan D-3.2]
- [x] CHK053 Is DB 只存 token hash，不存 token 明文？[Security, plan D-3.2]
- [x] CHK054 Is openid 明确以 AES-256-GCM 加密存储，commit / terminal / Gate 1 失败后清空 ciphertext？[Security, plan D-3.2 / D-3.3]
- [x] CHK055 Is context TTL 由 required positive env 决定，caller 不可提交 / 覆盖 / 延长？[Precision, plan D-3.2 / D-3.3]
- [x] CHK056 Is context replay 明确不产生第二份 confirmation / 第二次 commit，且 status / decision 可重复读取？Bootstrap replay 允许新 transport context，但必须 link 同一 authoritative attempt 且不重复业务副作用（plan D-3.4）。[Consistency, plan D-3.2 / D-3.4 / D-5.3]
- [x] CHK057 Is context 防篡改由 token 随机性、hash 存储、identity digest、attempt 绑定共同保证，而不是客户端声明？[Security, plan D-3.2]
- [x] CHK058 Is Phase A 明确不设置 `app.family_id` / `app.person_id`，不读取家庭业务数据？[Security, spec AS-20 / plan D-13.2]
- [x] CHK059 Is Phase B 通过同一事务把 `attempt_id` + `invitation_participation_id` 写回 context，且 Gate 1 前不写？[Consistency, plan D-8.3]
- [x] CHK060 Is context expiry 后重新 bootstrap 的路径明确，且不会创建第二个 live attempt？[Clarity, plan D-3.2 / D-7]

## 6. Confirmation Model

- [x] CHK061 Is candidate confirmation 的命题、actor、attempt / P1 / identity / invitation 四要素一致性明确？[Completeness, spec FR-008 / plan D-4]
- [x] CHK062 Is candidate confirmation 明确是 Phase B 必要条件但非 commit 充分条件？[Clarity, spec Candidate Confirmation 第 3 条 / plan D-4]
- [x] CHK063 Is candidate confirmation 在无正式 Account 时使用 `actor_pending_context_id`，而不是伪造 Account？[Consistency, plan D-4.1]
- [x] CHK064 Is 跨 attempt / 跨 P1 / 跨 identity / 跨 invitation 的 confirmation 明确被结构阻止（`UNIQUE(attempt_id, kind)` + endpoint 校验）？[Consistency, spec AS-23 / plan D-4.3]
- [x] CHK065 Is candidate REJECT / CANCEL 明确只终止 attempt、不写 affirmative confirmation、不改变 invitation？[Completeness, spec FR-008 / plan D-10.2]
- [x] CHK066 Is second-party confirmation 明确等于 `target confirmation + candidate recognition`，不可拆分为只批准邀请？[Consistency, 005 §5.3 / plan D-9.4]
- [x] CHK067 Is second-party 必须独立认证，candidate session 不能代持，AI / 系统不能代替？[Security, spec AS-17 / plan D-9.3]
- [x] CHK068 Is second-party actor 明确用 `actor_account_id` + `actor_person_id` + authority，且 authority 由 Gate 2 当前事实判定？[Completeness, plan D-4.1 / D-9.1]
- [x] CHK069 Is confirmation 表 append-only（无 UPDATE / DELETE、trigger 拒绝）、不保存 Consent，且 second-party affirmative 后 REJECT 明确 409 不改状态？[Consistency, plan D-4.3 / D-9.4]
- [x] CHK070 Is `UNIQUE(attempt_id, kind)` 明确使同一 attempt 只有一份 candidate / second-party affirmative，且 replay 不追加 audit？[Consistency, plan D-4.3]

## 7. Operation Idempotency

- [x] CHK071 Is 新建 `binding_operation_keys` 的理由（既有 `idempotency_keys.actor_account_id NOT NULL`）明确且不可被误读为重复造基础设施？[Justification, plan D-1.1 / D-5.1]
- [x] CHK072 Is 每个命令的 scope_kind / scope_key 明确（bootstrap 含 invalid invitation 的 token-hash 分支、candidate context、second-party account），没有未冻结的选择？[Precision, plan D-5.2]
- [x] CHK073 Is Plan 明确不保存 frozen `response_body` / `response_status`，避免 PENDING / RETRYABLE 永久冻结？[Consistency, 005 M4-M01 / plan D-5.2]
- [x] CHK074 Is same key + same payload（未 settled）明确返回当前 attempt 状态且无重复副作用？[Consistency, spec FR-022 / plan D-5.3]
- [x] CHK075 Is same key + different payload 明确 409 且不修改原 attempt / 原结果？[Completeness, plan D-5.3 / D-10.3]
- [x] CHK076 Is concurrent same-key 明确由 advisory lock + 唯一约束串行化，而不是内存锁？[Security, plan D-5.3]
- [x] CHK077 Is different key + same semantic operation 明确收敛到同一 PENDING attempt，不创建第二个 live attempt？[Consistency, spec FR-022 / plan D-5.3]
- [x] CHK078 Is old attempt terminal + invitation valid 时 new attempt 明确允许，且 old attempt replay 仍返回旧结果？[Completeness, 005 §5.5 第 6 条 / plan D-5.3]
- [x] CHK079 Is replay after COMMITTED 明确不 re-execute commit、不 revive invitation、不重建 authorization？Bootstrap settled replay 明确返回 `{ binding:"COMMITTED" }`，不写成 REUSED。[Consistency, spec FR-015 / plan D-5.3 / D-10.2]
- [x] CHK080 Is replay while PENDING 明确「exact duplicate 无重复副作用，但合法新事件可推进同一 attempt」？[Precision, spec FR-013 / plan D-5.3]
- [x] CHK081 Is retry after RETRYABLE 明确收敛到 authoritative outcome，不永久 RETRYABLE？[Consistency, spec FR-014 / plan D-5.3]
- [x] CHK082 Is retry after TERMINAL 明确返回历史 TERMINAL，不重开同一 attempt？[Consistency, plan D-5.3]

## 8. Concurrency and Database Convergence

- [x] CHK083 Is 并发收敛明确要求数据库层最终保证，而不是应用层先查再写？[Consistency, spec FR-017 / plan D-7.1]
- [x] CHK084 Is 选定机制只有一套（live partial unique + row lock + conditional update + unique constraints），没有同时堆多套业务锁？[Clarity, plan D-7.1]
- [x] CHK085 Is partial unique index 明确只约束 `PENDING`，不形成永久全局唯一？[Precision, plan D-2.1 / D-7.1]
- [x] CHK086 Is commit 事务对 attempt / P1 / account 的 `FOR UPDATE` + 条件更新顺序明确？[Completeness, plan D-6.1 / D-7.1]
- [x] CHK087 Is `persons.account_id UNIQUE` 与 `accounts.wechat_openid UNIQUE` 被明确列为最终防线？[Consistency, plan D-6.4]
- [x] CHK088 Is 两个 attempt 同时认领同一 P1 的结果明确为 ≤1 commit、另一端 TERMINAL？[Completeness, spec AS-10 / plan D-7.2]
- [x] CHK089 Is 两个不同 Account 同时认领同一 P1 的结果明确为 ≤1 commit？[Completeness, plan D-7.2]
- [x] CHK090 Is 同一 Account 同时匹配两个 Person 的结果明确为至多一个 binding、另一个 IDENTITY_CONFLICT？[Completeness, plan D-7.2]
- [x] CHK091 Is 全部 attempt 失败时 0 commit 被明确为合法结果，而不是异常？[Clarity, spec FR-016 / plan D-7.3]
- [x] CHK092 Is `Person increment = 0` 的证明明确为「006 代码没有 INSERT INTO persons」，而不是只靠流程声明？[Measurability, spec SC-004 / plan D-7.3 / D-20]

## 9. Phase C Commit and Transaction Boundary

- [x] CHK093 Is Account 创建时机明确为 Phase C，且 Phase A / B 不创建 Account？[Consistency, spec FR-011 / plan D-6]
- [x] CHK094 Is 「不存在孤立 Account」明确由同一事务 + 回滚保证，而不是事后清理？[Completeness, spec AS-21 / plan D-6.2]
- [x] CHK095 Is Gate 2 复核、Account 创建 / 复用、binding、attempt settled、audit 明确在同一事务？[Consistency, spec Transaction Boundary / plan D-6.1 / D-14]
- [x] CHK096 Is commit SQL 顺序明确，且每一步 rowCount 要求可观察？[Measurability, plan D-6.1]
- [x] CHK097 Is Gate 2 明确在 commit 事务内执行，而不是在事务外缓存结果？[Consistency, plan D-6.1 / D-8.4]
- [x] CHK098 Is audit 写入明确与核心事务同事务，失败整体回滚？[Consistency, spec FR-023 / plan D-14]
- [x] CHK099 Is 幂等记录明确与业务写入同一事务？[Consistency, spec Transaction Boundary 第 4 条 / plan D-14]
- [x] CHK100 Is commit 中途失败明确整体回滚，不留下 partial Account / binding / COMMITTED attempt / session？[Completeness, spec AS-22 / plan D-14]
- [x] CHK101 Is P1 已绑定其他 Account / candidate Account 已绑其他 Person 的冲突处理明确，不 rebind / 不 merge？[Completeness, plan D-6.3]
- [x] CHK102 Is Case C 的「commit 前 P1 Account 必须仍为 NULL」明确为 Gate 2 条件？[Consistency, spec FR-011 / plan D-8.2]
- [x] CHK103 Is 成功 binding 明确不创建 Person / Family / membership / guardian / Consent / Case / Participant 权限？[Completeness, spec FR-011 / plan D-6.2]
- [x] CHK104 Is 下游变化（decline / withdraw / Case close / consent revoke）明确不自动解绑，且本 Slice 不设计 unlink？[Consistency, spec FR-018 / plan D-20]

## 10. Anti-Enumeration

- [x] CHK105 Is `internal result ≠ candidate-observable result` 明确落到 response 构造层，而不是仅一句原则？[Consistency, spec FR-019 / plan D-11]
- [x] CHK106 Is candidate bootstrap 的 generic body key 集合明确，且不含 `attemptId` / `personId` / `familyId` / reason？[Precision, plan D-11.1]
- [x] CHK107 Is HTTP status 在所有 generic 内部分支上一致为 200（除真实 WeChat `code2session` authentication failure），且 `authorize()` DENY 明确不映射为 401 `WECHAT_AUTH_FAILED`（bootstrap DENY → 200 generic）？[Consistency, plan D-11.1 / D-10.3]
- [x] CHK108 Is candidate decision / status / session 未 committed 时都返回统一 generic，不泄露 attempt 是否存在？[Completeness, plan D-11.1]
- [x] CHK109 Is 「下一步可继续动作」明确不得成为 oracle，且未绑定阶段唯一可区分成功分支是 Case B 正确 Account、COMMITTED 后 status/session 属授权成功？[Consistency, plan D-11.1]
- [x] CHK110 Is confirmer 可见性明确为最小必要字段，且不扩散给 candidate？[Security, plan D-11.2 / D-9.2]
- [x] CHK111 Is forwarded invite + wrong candidate 明确无法绑 P1、无法获知 P1 门禁、且 confirmer 无法辨认时不得确认？[Completeness, spec AS-18 / plan D-9.4 / D-11]
- [x] CHK112 Is invalid / expired / consumed invitation 对外与 PENDING 不可区分，且 invalid invitation 走 pre-attempt blocked classification + audit + 同一 serializer（不 fake query 不存在的 P1、无 immediate early return）？[Consistency, spec AS-06 / AS-07 / plan D-11.1 / D-11.3]
- [x] CHK113 Is wrong Account / P1 已绑其他 Account / P1 多 Family 等分支均落入同一 generic matrix？[Completeness, plan D-11.1]
- [x] CHK114 Is error envelope 明确无 P1 / Family / guardian / consent / age / attempt 细节，且无 redirect / `Set-Cookie` / 业务 header？[Security, plan D-10.3 / D-11.1]

## 11. Authorization

- [x] CHK115 Is 所有 binding 业务读写明确先经统一 `authorize()`，再接 RLS，而不是以 RLS 替代 authorization？[Consistency, spec FR-024 / plan D-12]
- [x] CHK116 Is 新增 6 个 action、1 个 purpose、1 个 resource type、若干 deny reason 明确注册并 fail-closed？[Completeness, plan D-12.1 / D-12.2]
- [x] CHK117 Is actor 的三种形态（Account / BindingContext / WeChatCandidate）明确，且 bootstrap 不伪造 Account / Person？[Precision, plan D-12.1]
- [x] CHK118 Is `facts` 明确承载 target person / family / age band / guardian / manager / membership，且缺失即 DENY？[Security, plan D-12.1 / D-12.2]
- [x] CHK119 Is guardian confirmer 判定明确为 `actor.personId === guardianPersonId`，不读 membership / verified_source？[Consistency, plan D-9.1 / D-12.2]
- [x] CHK120 Is MINOR_14_17 无 guardian 的 manager 判定明确为 `families.created_by_person_id`，不引入角色表？[Consistency, plan D-9.1 / D-12.2]
- [x] CHK121 Is candidate 不能调用 confirmer 路由，confirmer 不能复用 candidate binding token？[Security, plan D-9.3 / D-10.4]
- [x] CHK122 Is binding 成功明确不创建 membership / guardian / Consent / Case / Participant / Visibility / Purpose？[Consistency, spec FR-018 / plan D-6.2]
- [x] CHK123 Is 客户端传入的 invitation / attempt / identity / personId 明确只作待验证参数，不作授权依据？[Security, plan D-12 / D-13]
- [x] CHK124 Is 明确没有 `authorizeBinding()` 第二入口、generic RBAC、participant role enum、guardian 自动授权？[Consistency, spec FR-024 / plan D-12.2]

## 12. RLS

- [x] CHK125 Are 5 张新表明确 `ENABLE` + `FORCE ROW LEVEL SECURITY`？[Completeness, plan D-13.2]
- [x] CHK126 Is 运行角色明确为非 owner、`rolbypassrls = false`，且不通过关闭 RLS 解决问题？[Security, plan D-13.2 / D-13.5]
- [x] CHK127 Is pending context 明确不拥有 family context，不设置 `app.family_id` / `app.person_id`？[Security, spec AS-20 / plan D-13.2]
- [x] CHK128 Is Gate 上下文明确可安全读取 P1 Compliance / consent / membership，且不冒充 P1 / 不设置 family scope？[Security, plan D-13.3]
- [x] CHK129 Is commit 上下文明确只允许更新 target P1 的 `account_id`，不能更新其他 family member？[Security, plan D-13.3]
- [x] CHK130 Is 对 Slice 1 表的增量 policy 明确为 additive、purpose-scoped、只读 / 精确提交，不改既有 policy？`persons_binding_candidate_account_read` 只在 GATE / COMMIT purpose 下按 candidate Account 读取其已绑定 Person，仅用于 `IDENTITY_CONFLICT`。[Consistency, plan D-13.3 / D-8.1]
- [x] CHK131 Is audit 表明确 runtime 不可读（`USING (false)`），只可 INSERT，不削弱 privacy？[Security, plan D-13.2 / D-15.2]
- [x] CHK132 Is 无上下文 / 错误 Family / 错误 attempt 直连查询明确返回 0 行 / 拒绝？[Completeness, spec AS-24 / plan D-13.5]
- [x] CHK133 Is candidate 明确不能直接读取 P1 Compliance / consent / 其他 Family 数据？candidate-account read policy 只允许读取该 candidate Account 自身绑定的 Person，不返回 P1 门禁或 P2 信息。[Security, plan D-13.3 / D-11]
- [x] CHK134 Is RLS 验证明确要求 `pg_class.relrowsecurity` / `relforcerowsecurity` / `rolbypassrls` 真实输出，而不是文档声明？[Measurability, plan D-13.5]

## 13. Audit / Provenance

- [x] CHK135 Is 审计存储明确为 006 专用 `identity_binding_audit_events`，并证明不是第二套通用审计框架？[Justification, plan D-15.3]
- [x] CHK136 Is 不复用 `business_audit_events` 的原因（NOT NULL actor/family + 封闭 event_type + pre-account）明确？[Clarity, plan D-1.1 / D-15.3]
- [x] CHK137 Is actor / target Person / attempt / result / reason 的可追溯性明确，且 Gate 1 阻断可审计但不记录 target person / family / invitation id（不形成 candidate↔P1 关联）？[Completeness, spec FR-023 / plan D-15.2]
- [x] CHK138 Is 明确不记录 token / token hash / openid / ciphertext / consent 原文 / PII？[Security, plan D-15.2]
- [x] CHK139 Is 明确不为 audit FK 创建 Person / Account，且 actor / target 可空？[Consistency, 005 §5.6.3 / plan D-15.2]
- [x] CHK140 Is audit 明确 append-only、无 UPDATE / DELETE、trigger 拒绝改写？[Consistency, plan D-15.2]
- [x] CHK141 Is replay 明确不追加第二组 audit，合法推进（PENDING→COMMITTED / TERMINAL）不算改写？[Consistency, spec FR-023 / plan D-15.2]
- [x] CHK142 Is RETRYABLE 的审计策略明确为 best-effort、不伪造成功 / 终态，且失败不改变 retryable 结果？使用独立 `BINDING_OPERATION_RETRYABLE` + `result='RETRYABLE'`，不用 `BINDING_TERMINAL` 冒充。[Clarity, plan D-14 / D-15.2 / D-21]

## 14. Invitation Seam & Dependencies

- [x] CHK143 Is 006 明确只消费 Slice 4 contract 的 `VALID` / `TERMINAL_UNUSABLE`，不建第二套 invitation 模型？[Consistency, spec FR-026 / plan D-16.1]
- [x] CHK144 Is `InvitationResolutionPort` 明确为 consumer port，且 production adapter 必须使用同一 `tx` client？[Precision, plan D-16.1]
- [x] CHK145 Is 006 明确不创建 invitations 表、不定义 invitation state / token / expiry / cancel / manager revoke？[Consistency, 005 §5.6.4 / plan D-16.1]
- [x] CHK146 Is `invitation_participation_id` 明确不建 FK，避免与 Slice 4 表存在性 / migration 顺序耦合？[Clarity, plan D-2.1 / D-16.1]
- [x] CHK147 Is Contract-level 验证与 true runtime E2E 明确分开，后者标注 `BLOCKED BY SLICE 4 RUNTIME`？[Completeness, plan D-16.2]
- [x] CHK148 Is 明确禁止用 fake invitation table / fake token service / mock 后宣称 PASS？[Consistency, plan D-16.2 / D-20]
- [x] CHK149 Is Slice 1 真实 `authorize()` 的当前状态被如实更新为 **SATISFIED**（Final Independent Audit II PASS → PR #13 merge main → post-merge CI PASS → CLOSED；`origin/main` = `f4ef602`；`MINOR_PROCESSING` 已是真实分支；`converge.md` 36 PASS / 0 FAIL），且不再被称为当前 hard blocker？[Honesty, plan D-22.1 / D-22.3]
- [x] CHK150 Is 「本 Slice 是否必须等待 Slice 2 / 3 / 4」给出明确分层答案：core 不等待 Slice 4 runtime、late E2E 才等待、且本 Slice core 与 Slice 4 runtime 不存在循环硬依赖？[Clarity, plan D-22.3]
- [x] CHK151 Is Slice 2 / Slice 3 明确为 non-dependency，且 006 不读 Case / 不写 Evidence？[Consistency, plan D-22.2]
- [x] CHK152 Is Gate 状态机明确记录当前为 `PLAN FROZEN / READY FOR CORE IMPLEMENTATION`（`T121–T124` 仍 blocked），并把已失效的 `IMPLEMENT BLOCKED — ONLY BY SLICE 1 HARD DEPENDENCY` 标为历史，不把 Plan PASS 等同于 full Implement Gate OPEN 或 Slice 4 runtime available？[Clarity, plan D-22.3]

## 15. API / Contract Surface

- [x] CHK153 Is 端点数明确为 6，且没有 participant / Case / Evidence / UI / 通知端点？[Completeness, plan D-10.1]
- [x] CHK154 Is bootstrap 请求 / 响应 schema 明确，且没有 `mode=invite` / hidden switch？响应 union 含 generic / REUSED / settled replay `{ binding:"COMMITTED" }`。[Precision, plan D-10.2 / D-17.1]
- [x] CHK155 Is candidate decision 的 AFFIRM / REJECT / CANCEL 语义明确，且 response 始终 generic？[Completeness, plan D-10.2]
- [x] CHK156 Is confirmer list / decision 的授权、最小字段、状态码明确？[Completeness, plan D-10.2 / D-11.2]
- [x] CHK157 Is status / session exchange 明确为 candidate 的 read-back 与 ordinary identity 桥接，且不创建 Account / Person？[Clarity, plan D-10.2]
- [x] CHK158 Is 错误 envelope 沿用 Slice 1，并明确新增 code / status？[Consistency, plan D-10.3]
- [x] CHK159 Is 普通 `/auth/wechat` 的 schema / 顺序行为明确不变、auth plugin 只做最小 exemption，且并发首次登录的 pre-existing race 不被 006 宣称修复？[Consistency, plan D-10.4 / D-17.1]
- [x] CHK160 Is 手写 OpenAPI 是契约源、generated 只由脚本生成，且 `openapi:check` 必须 PASS？[Consistency, plan D-19.1 / API Contract Impact]
- [x] CHK161 Is 明确不 hand-edit generated OpenAPI，也不为 generated 重构既有 route schema？[Consistency, plan Technical Baseline]
- [x] CHK162 Is 端点 availability / redirect / session 行为明确不成为 oracle？[Security, plan D-11.1]

## 16. Migration & Rollback

- [x] CHK163 Is migration 明确 additive、不修改 `001_initial_schema.sql`、不改 Slice 1 列 / 约束 / enum？[Completeness, plan D-18.1]
- [x] CHK164 Is migration 顺序明确（enum → tables → indexes → functions → RLS → Slice 1 policies → triggers → grants）？且 Slice 5 最终只允许一个 006-owned additive migration（第二个未 merge migration 必须 fold 回唯一文件并删除）。[Clarity, plan D-18.1]
- [x] CHK165 Is migration 编号明确为 Implement 时读取最新 merged main 后分配，不硬编码？[Precision, plan D-18.1]
- [x] CHK166 Is 新表主键 / 时间 / uuidv7 基线明确？[Consistency, plan D-18.1]
- [x] CHK167 Is GRANT 明确为最小 DML，audit 仅 INSERT，且 app 非 owner？[Security, plan D-18.1 / D-13.2]
- [x] CHK168 Is rollback 明确为反向 DROP，且不删除 Slice 1 表 / 列 / 既有 policy / 历史业务数据？[Completeness, plan D-18.2]

## 17. Tests & Traceability

- [x] CHK169 Is 测试分层明确覆盖 Domain / Integration / Database / RLS / Concurrency / Idempotency / Security / Contract / Regression / Governance，且 `tests/domain/**` 明确为纯 domain（不依赖 `DATABASE_URL` / 不访问真实 PostgreSQL）、DB-backed facts builder 位于 `tests/db/**`？[Completeness, plan D-19.1]
- [x] CHK170 Are FR-001—FR-028 全部映射到具体测试，而不是只写「有测试」？[Traceability, plan D-19.2]
- [x] CHK171 Are AS-01—AS-24 全部映射到测试或 contract-level 验证，没有 orphan acceptance？[Traceability, plan D-19.2]
- [x] CHK172 Are SC-001—SC-014 全部有可验证落点？[Traceability, plan D-19.2]
- [x] CHK173 Are 必测反例（no-P2、concurrent commit、retry/read-back、Account conflict、Person conflict、Gate 2 race、consent revoked、invitation terminal between gates、duplicate confirmation、cross-attempt、anti-enum、RLS wrong family、ordinary login regression）逐项列出？[Completeness, plan D-19.3]
- [x] CHK174 Is no-P2 明确要求对象计数可观察（Person increment / P2 / partial binding / session / authz / participant）？[Measurability, spec SC-004 / plan D-19.3]
- [x] CHK175 Is concurrency 测试明确要求真实数据库并发输出，而不是应用层 mock？[Measurability, plan D-19.1 / D-7]
- [x] CHK176 Is idempotency 测试明确覆盖全表（same/different payload、concurrent same-key、different-key same semantic、settled replay、PENDING replay、RETRYABLE retry）？含 bootstrap replay PENDING / COMMITTED / TERMINAL。[Completeness, plan D-5.3 / D-3.4 / D-19.1]
- [x] CHK177 Is anti-enumeration 测试明确比较 status / body keys / headers / read-back，而不只是文案？[Measurability, plan D-11.1 / D-19.1]
- [x] CHK178 Is RLS 测试明确覆盖无上下文 / 错误 family / 错误 attempt / audit runtime 不可读？[Completeness, plan D-13.5 / D-19.1]
- [x] CHK179 Is ordinary `/auth/wechat` regression 测试明确覆盖 new / existing openid 与无 hidden switch？[Completeness, plan D-17.1 / D-19.1]
- [x] CHK180 Is `BLOCKED BY SLICE 4 RUNTIME` 测试明确与 contract-level 测试分开，且不得删除 / mock 后宣称 PASS？[Clarity, plan D-16.2 / D-19.1]

## 18. Governance, Exclusions, Observability

- [x] CHK181 Is 本轮只改 `specs/006-identity-binding-runtime/**`，且 `Docs/**` / `specs/001~005/**` / `apps/**` / `packages/**` / `db/**` / `tests/**` diff = 0？[Governance, plan Constitution Check]
- [x] CHK182 Is Explicit Exclusions 的 14 类可机械证明（route / schema / capability enumeration），而不是原则声明？[Completeness, plan D-20]
- [x] CHK183 Is 明确没有 KYC / government-ID / 人脸 / 视频 / 电话 / 外部身份证明？[Security, plan D-20]
- [x] CHK184 Is 明确没有后台 job / 定时器 / workflow engine / 第二套 audit？[Consistency, plan D-20 / Async Impact]
- [x] CHK185 Is 明确没有 `INSERT INTO persons`、没有 Person merge / unlink / rebind / duplicate recovery？[Consistency, plan D-7.3 / D-20]
- [x] CHK186 Is 明确没有 Case / Evidence / Participant / Assessment / Intervention / Notification / AI / RAG 表或路由？[Consistency, plan D-20]
- [x] CHK187 Is observability 明确记录 correlation / attempt / result，且禁止 openid / token / consent / PII？[Security, plan D-21]
- [x] CHK188 Is RETRYABLE 的日志 / audit 明确不伪造成功 / 终态？event_type 使用 `BINDING_OPERATION_RETRYABLE`，attempt state 不变。[Consistency, plan D-15.2 / D-21]
- [x] CHK189 Is 审计一的 20 项检查（Spec→Plan 漂移、语义改变、FR/SC/AS 漏项、负向场景、不可执行 Task、并发证明、RETRYABLE、幂等、永久唯一、P2、Account orphan、RLS、authorization/recognition 混淆、candidate 泄露、invitation 侵入、Slice 4 侵入、runtime 依赖未标 BLOCKED、Task 顺序、测试映射、开发 AI 可直接实施）逐项在 Plan / Checklist 中有落点？[Auditability, plan D-1—D-22 / checklist CHK001—CHK188]
- [x] CHK190 Is Checklist 自身明确「PASS 不等于 Implement Gate OPEN」，且 dependency blocker 不会被误记为 Plan FAIL？[Clarity, checklist header / plan D-22.3]

- [x] CHK191 Is H-01 root cause explicitly frozen: S0/S1 delta、createdAt、unique-pending、attemptId、invitation possession均不能证明现场recognized human = authenticated candidate？[Security, H-01 / plan H-01]

- [x] CHK192 Is pairing generator唯一明确为server，challenge只在candidate自己的AFFIRM surface获得，并由candidate现场主动展示/传递给confirmer，而不是系统猜测？[Executability, plan D-3.5 / D-9.2]

- [x] CHK193 Is valid pairingChallenge cryptographically bound to exact candidate context + authenticated identity + attempt + P1 + invitation + expiry，且challenge possession本身仍不是identity proof？[Security, 005 §5.3 / plan D-3.5]

- [x] CHK194 Are pairing replay / expiry / consumption / wrong-P1 / wrong-invitation / wrong-candidate / wrong-attempt / two-candidate / two-confirmer concurrency all fail-closed or exactly-once，且original attacker race有direct acceptance？[Security/Concurrency, H-01 / plan D-19.4]

- [x] CHK195 Is H-02 Gate2 boundary明确保护所有会改变Gate2结果的authoritative facts，至少profile/age-band、Consent、guardian、membership/authority、invitation、P1 binding conflict、candidate-account conflict？[Completeness, H-02 / plan D-8.4]

- [x] CHK196 Does H-02 acceptance require real xiaoshuyin_app runtime-role barrier behavior，explicitly reject “FOR UPDATE exists in source” or “FOR UPDATE returns 0 rows” as proof？[Measurability, H-02 / plan D-8.4 / D-19.4]

- [x] CHK197 Is candidate AFFIRM required to re-evaluate current dynamic eligibility before confirmation and before valid challenge issuance，with stale consent/age/guardian/membership/invitation/binding conflicts terminalizing rather than remaining PENDING？[Consistency, M-01 / plan D-8.5]

- [x] CHK198 Does bootstrap replay cleanup explicitly cover COMMITTED、TERMINAL、pre-attempt、Case B REUSED fresh transport contexts and directly require ciphertext/nonce/tag NULL independent of linkAttempt order？[Security, M-02 / plan D-14]

- [x] CHK199 Does expiry cleanup distinguish context-only expiry from attempt expiry，and require status-materialized attempt expiry to scrub all sibling contexts with exactly-one terminal audit？[Security, M-03 / plan D-14]

- [x] CHK200 Is Phase C ATTEMPT_EXPIRED owned by one authoritative settlement path that atomically reaches TERMINAL + reason + exactly-one audit + all-context scrub + no binding/orphan Account？[Atomicity, M-04 / plan D-14 / D-19.4]

- [x] CHK201 Is coverage:audit substantive fail-closed: required acceptance→stable proof ID→exact executable proof，with RED self-tests for delete、rename、unexecute、unrelated-test substitution causing non-zero？[Measurability, M-05 / plan D-19.5]

- [x] CHK202 Is canonical verify-all provenance frozen to repo-root node scripts/verify-all.mjs with exact branch/HEAD/origin-main/clean tree/env-presence/child exits/final exit，and historical unexplained failure allowed only as unresolved rather than invented explanation？[Reproducibility, M-06 / plan D-19.6]

---

## Review Log

- 2026-11-07：Plan 完成后首次 Checklist authoring。全部条目按 Spec / 005 / Docs / Slice 1 schema / Slice 4 contract 独立核对；未发现需要修改冻结 Spec 的缺口。
- 已知非 Checklist FAIL 的真实 blocker（历史记录，已失效）：`plan.md` D-22.1 H1（Slice 1 `authorize()` 占位 / 无最终 Converge PASS）曾是本 Slice（业务 Slice 5，repo feature 006）core implementation 的 hard blocker；H3（Slice 4 runtime 未 merge）只阻塞 `T121–T124` 的真实 adapter / E2E closeout，不阻塞 core implementation，也不构成循环依赖。当时状态为 `IMPLEMENT BLOCKED — ONLY BY SLICE 1 HARD DEPENDENCY`，不影响 Plan 冻结。
- 2026-11-07 Dependency Gate correction：将 Slice 4 runtime 从「core Implement blocker」降级为「late E2E blocker」；明确 `本 Slice core ← Slice 1`、`Slice 4 implementation ← 本 Slice core runtime`、`本 Slice T121–T124 ← Slice 4 runtime` 的分阶段交接，不存在循环硬依赖。当时条目总数为 190，未新增/删除。- 2026-11-07 Targeted Plan Remediation（实施中发现冻结 Plan 内部缺口，仅最小定点修正）：
  - **M3 candidate-account RLS**：D-8.1 要求 ordinary-login-first / candidate Account conflict，而 D-13.3 / D-13.4 原无合法读取路径且明确 `actorAccountId` 不用于读取 candidate Person。已冻结最小 purpose-scoped 读取：GUC `app.binding_candidate_account_id` + policy `persons_binding_candidate_account_read`（仅 GATE / COMMIT，只读该 authenticated candidate Account 已绑定的 Person，仅用于 `IDENTITY_CONFLICT`，不返回 candidate-facing P2 信息）。复核 CHK018 / CHK128 / CHK130 / CHK133 / CHK178。
  - **M3 其余额外对象裁定**：`binding_context_attempt_scope`、`app.set_binding_target_context` / `withBindingTargetTransaction` 经判定为冻结 D-6.1（commit 必须在同一事务锁定 context）与 D-9.2（targetFamilyId 需先由 P1 membership 解析）所必需，已最小写入 Plan：前者仅 GATE / COMMIT purpose + `attempt_id = app_binding_attempt_id()`，后者仅 target-person GUC、purpose GATE、Family 解析前不得读 profile / consent；两者均不扩大 Family scope、不构成第二 authorization engine。复核 CHK127 / CHK128 / CHK130 / CHK164。
  - **M3 single migration**：D-18.1 保持「单个 reviewed additive migration」；开发分支现有 004 + 005 且均未 merge 时，必须把 005 批准内容 fold 回唯一 006 migration、删除 005、普通 commit，不 rebase / force push / 改已 merge migration，并重跑 fresh / upgrade / second-apply / DB evidence。复核 CHK163–CHK168。
  - **M6 COMMITTED bootstrap replay**：D-10.2 / D-11.1 / D-5.3 明确同一 BOOTSTRAP operation key 在 attempt 已 COMMITTED 后返回 historical `{ binding:"COMMITTED" }`；不写成 `REUSED`，不重新 commit、不 revive invitation、不自动 accept、不重建 authorization；OpenAPI / schema 增加 strict `BindingBootstrapCommittedResponse`。复核 CHK079 / CHK154 / CHK176。
  - **M13 RETRYABLE audit**：D-15.1 event_type 闭集新增 `BINDING_OPERATION_RETRYABLE`，D-15.2 要求 `result='RETRYABLE'` 且不改变 attempt state、不用 `BINDING_TERMINAL` 冒充、不扩展 `business_audit_events`。复核 CHK142 / CHK188。
  - **M5 bootstrap replay context clarification**：在 token 明文不落库、operation key 不存 response body 的冻结约束下，D-3.4 明确 same-key bootstrap replay 允许新建 transport context / token，但必须 link 同一 authoritative attempt；`new transport context ≠ new attempt ≠ duplicate business side effect`。复核 CHK056 / CHK176。
  - 当时条目总数为 190（未新增/删除）；`spec.md`、`Docs/**`、`specs/005/**`、`apps/**`、`packages/**`、`db/**`、`tests/**` 只读。- 2026-11-07 Final Plan/Tasks Closeout（C1–C5，仅 `plan.md` / `tasks.md` / 本 Checklist；`spec.md` 未改）：
  - **C1 Case B 口径**：D-10.2 / D-17.2 明确「bootstrap endpoint 被调用」≠「进入 Case C identity bootstrap state machine」；Case B 误调 bootstrap 时在 WeChat authentication 后直接 `REUSED`，不建 attempt / confirmation、不进 Gate 1→Phase C、不要求双确认；canonical flow 仍为 Case B → ordinary authenticated path、Case C → invitation-aware bootstrap。复核 CHK015。
  - **C2 authorize DENY 映射**：D-10.3 冻结 `401 WECHAT_AUTH_FAILED` 只用于真实 `code2session` 失败；`IDENTITY_BINDING_BOOTSTRAP` 的 `authorize()` DENY → 200 generic（冻结 bootstrap response shape），不暴露 authorization reason / P1 / Family / guardian / consent / age / invitation state，不新增 candidate-facing authorization error code；D-11.1 增加对应 matrix 行；D-12 同步；T095 / T096 增加断言与实现边界。复核 CHK107 / CHK149 邻近项。
  - **C3 invalid invitation pipeline**：D-11.3 改为两条 normalized pipeline（invitation 可解析 → 真实 Gate 1；不可解析 / 无可信 P1 → pre-attempt blocked classification + audit + 同一 serializer），禁止 immediate early return，禁止 fake query 不存在的 P1，禁止人为 delay / padding；T101 / T102 同步。复核 CHK112。
  - **C4 test layering**：D-19.1 将 app-layer DB-backed facts builder 落到 `tests/db/identity-binding-facts.test.ts`，`tests/domain/**` 明确为纯 domain（不依赖 `DATABASE_URL`、不访问真实 PostgreSQL、禁止 silent skip），`bun run vitest run tests/domain` 必须在无 DB 环境可执行；T047 / T048 / T107 / T108 同步文件与 `[VERIFY]`。复核 CHK169。
  - **C5 stale facts**：D-22.1 H1 更新为 SATISFIED（Slice 1 Final Independent Audit II PASS → PR #13 merge main → post-merge CI PASS → CLOSED，`origin/main` = `f4ef602`，`MINOR_PROCESSING` 实分支，converge 36 PASS / 0 FAIL）；D-22.2 记录 Slice 2 已经 PR #14 merge main；D-22.3 当前状态改为 `PLAN FROZEN / READY FOR CORE IMPLEMENTATION`（`T121–T124` 仍 blocked）；repo feature 006 的业务称呼统一为「本 Slice（业务 Slice 5，repo feature 006）」。复核 CHK149 / CHK150 / CHK152。
  - 当时条目总数为 190（未新增/删除）；`spec.md`、`Docs/**`、`specs/005/**`、`apps/**`、`packages/**`、`db/**`、`tests/**` diff = 0。
- 2026-11-08 Ultimate Audit Targeted Remediation（历史，已被下一条SUPERSEDED）：当时CHK191—CHK200采用S0/S1 exact-delta pairing；Ultimate Final Independent Re-audit随后证明该机制不安全，因此该历史口径不得再作为当前acceptance。
- 2026-11-09 Ultimate Audit Targeted Plan/Contract Remediation：CHK191—CHK202重写为H-01/H-02/M-01—M-06；H-01冻结server-generated candidate-presented one-time pairing challenge，S0/S1 pairing正式废止；H-02要求真实runtime-role barrier；M-01—M-06均有direct observable contract。Checklist当前202条。Checklist PASS只表示Plan/Contract可审，不表示reopened Tasks已实现；T121–T124仍BLOCKED。
