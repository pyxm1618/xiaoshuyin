# Contract — UNDER_14 Guardian Consent (consent-first)

**Slice**: 001-family-identity-core
**Upstream**: `Docs/V1产品需求.md` v3.3 §19A.2 / V1-C39；`Docs/V1技术设计.md` v3.8 §7.7A / §10 / §5 不变量 27 / §29.5（最小子集）
**Related**: `plan.md` D-3；`data-model.md` §6–§8；`identity-family-api.openapi.yaml`

---

## 1. 状态机

```text
                    ┌──────────────────────────────────────────────┐
                    │  A. consent onboarding（最小状态）            │
                    └──────────────────────────────────────────────┘
  (none) ──POST /compliance/guardian-consents/requests──▶ PENDING
                                                            │
                    ┌───────────────────────────────────────┘
                    │
        ┌───────────┼────────────┬──────────────────┐
        ▼           ▼            ▼                  ▼
   now > exp    accepted=true  abandoned        (超时无操作)
   → EXPIRED    → GRANTED      → ABANDONED      → EXPIRED
                    │
                    ▼
        ┌──────────────────────────────────────────────┐
        │  B. 正式 child 建档（唯一放行点）              │
        └──────────────────────────────────────────────┘
   POST /families/:id/members (ageBand=UNDER_14, guardianConsentId)
   → 事务内（FK 顺序固定）：
     ① 锁定并校验 consent（GRANTED / 未绑定 / guardian / family / notice / expiry）
     ② 预生成 personId = uuidv7()
     ③ INSERT membership（DEFERRABLE 的 person_id，Person 尚不存在）
     ④ INSERT Person（account_id = NULL）
     ⑤ UPDATE consent_records SET bound_person_id = personId, bound_at = now()
        （0 行 → 409 GUARDIAN_CONSENT_ALREADY_BOUND）
     ⑥ INSERT profile（UNDER_14 + guardian + consent 指针）
     ⑦ INSERT profile values
     ⑧ INSERT audit
                    │
                    ▼
        ┌──────────────────────────────────────────────┐
        │  C. 撤回（版本链）                            │
        └──────────────────────────────────────────────┘
   POST /consents/:id/revoke
   → 追加 REVOKED(version+1, onboarding_request_id=NULL, supersedes=当前)
   → profile 指针前移
   → assertMinorProcessingAllowed → BLOCK
                    │
                    ▼
        重新同意 = 新请求（existingSubjectPersonId 指向该未成年人）
        → 新 GRANTED 版本 → profile 指针前移 → 放行
```

**A 阶段不产生 Person、不产生 Profile，也不保存任何孩子资料。** 首次 onboarding 时 `subject_person_id = NULL`；只有“对已存在未成年人重新同意”才会使用该列做关联（见 §2）。这是 FR-008(a)/(b) 的执行方式。

**关键时序**：同意在 A 阶段成立（早于 Person）；但 `bound_person_id` 是即时外键，绑定只能在 B 阶段 Person 行插入之后执行。两个约束同时成立才是正确实现。

---

## 2. 允许 / 禁止的字段（A 阶段）

| 允许 | 适用情形 | 为什么严格必要 |
|---|---|---|
| `guardian_person_id` | 全部 | 同意必须可归属 |
| `declared_age_band = UNDER_14` | 全部 | 不判定适用流程就无法知道需要监护人同意 |
| `notice_version` + `notice_hash` | 全部 | 同意只能对已告知内容成立，必须可证明告知了什么 |
| `policy_version` | 全部 | 政策版本可追溯 |
| `status` / `expires_at` / 时间戳 | 全部 | 一次性、可过期、可审计 |
| `family_id` | 全部 | 隔离作用域 |
| `subject_person_id` | **仅重新同意** | 指向已完成同意的那个未成年人；是关联键，不是资料载体 |

| 禁止（两种情形都不允许） | 理由 |
|---|---|
| 孩子姓名 / 昵称 / 称呼 | 一旦出现，该行即成为正式档案，违反 consent-first |
| 出生日期 / 精确年龄 | 同上；只允许 band |
| 关系描述、性别、学校、年级 | 属后续业务资料，不得提前采集 |
| Assessment / Case / Digital Use / AI 输入 | §19A.2 明令禁止“为以后方便”预先采集 |
| 原始 IP / UA | 只存 HMAC 摘要 |

**精确边界（不得写成绝对表述）**：

- 首次 onboarding：`subject_person_id IS NULL`，表中不存在任何指向未成年人的列，也不存在任何孩子资料列。
- 重新同意：`subject_person_id` 是唯一指向未成年人的列；它只表达“对谁重新同意”，不得承载任何资料。
- 因此测试断言的对象是**列集合恰好等于上述清单**（且 `subject_person_id` 是唯一 child reference），而不是“本表没有任何 child identifier”。

**执行方式**：以上“禁止”不是规范条文，而是**列不存在**。`guardian_consent_requests` 的列集合被测试断言锁定；新增列必须改 migration 并通过 review。

---

## 3. 同意的成立条件（全部满足）

| # | 条件 | 校验位置 |
|---|---|---|
| C1 | 已认证 actor 的 Person = `guardian_person_id` | `authorize()` + SQL 条件 |
| C2 | actor 的 `age_band = ADULT` | profile 查询 |
| C3 | actor 是当前家庭成员 | `set_family_context` |
| C4 | request 属于该家庭且 `status = PENDING` | SQL 条件 |
| C5 | `now() <= expires_at` | SQL 条件 |
| C6 | 请求体 `noticeVersion` = request 的 `notice_version` = 当前生效告知版本 | 应用 + `notices.ts` |
| C7 | 请求体 `accepted` 严格等于 `true` | Zod（`const: true`） |
| C8 | `notice_hash` 与 `notices.ts` 计算值一致 | 应用校验 |
| C9 | 该 request 尚未产出过 GRANTED 行 | partial `UNIQUE(onboarding_request_id) WHERE onboarding_request_id IS NOT NULL` |

任一不满足 → 拒绝，且**不写入任何 consent 行**。

---

## 4. 证据内容（`consent_records`）

```json
{
  "channel": "MINIPROGRAM",
  "accepted_text_hash": "<sha256 of the accepted statement text>",
  "declared_age_band": "UNDER_14",
  "client_ip_hash": "<hmac-sha256 hex>",
  "user_agent_hash": "<hmac-sha256 hex>"
}
```

- `accepted_text_hash` 与 `notice_hash` 不同：前者是用户点击接受的那句确认语，后者是告知正文；两者都要能追溯到版本。
- 不存原始 IP / UA。哈希用部署期注入的 pepper（`EVIDENCE_HASH_PEPPER`），不落库、不进 repo。
- `evidence` 的 Zod schema 与 JSON 存储必须同源（`packages/contracts`），禁止自由 jsonb。

---

## 5. 绑定（同意 → 未成年 Person）

`bound_person_id` 是即时外键，因此**绑定必须发生在 Person 行插入之后**；而同意本身必须在 Person 之前就已成立。两者同时满足的唯一顺序：

```text
① SELECT … FROM consent_records WHERE id = $consentId FOR UPDATE
   前置：decision = GRANTED、guardian_person_id = actor.personId、family 匹配、
        notice 匹配、未过期、bound_person_id IS NULL
② personId := uuidv7()
③ INSERT family_members (family_id, person_id = personId)
   —— family_members.person_id 为 DEFERRABLE，Person 尚不存在也可先插
④ INSERT persons (id = personId, account_id = NULL, created_by_account_id = actor)
⑤ UPDATE consent_records SET bound_person_id = personId, bound_at = now()
   WHERE id = $consentId AND bound_person_id IS NULL
   —— 0 行受影响 → 409 GUARDIAN_CONSENT_ALREADY_BOUND
⑥ INSERT person_compliance_profiles（UNDER_14 + guardian + consent 指针）
```

**为什么不能先绑**：第 ⑤ 步在 ④ 之前会立即违反 `consent_records_bound_person_id_fkey`。
**为什么不能先建 profile**：第 ⑥ 步在 ⑤ 之前会违反 `pcp_under14_requires_consent`。
**为什么不能先建 profile 于 ③ 之前**：profile 的 `WITH CHECK` 依赖 membership 存在。

- 绑定是**原子对**：只允许 `(bound_person_id, bound_at) = (NULL,NULL) → (personId, serverTimestamp)` 一次。已绑定后两者都不可再改（含只改 `bound_at`、清空任一字段）；`CHECK` 保证不同时为空/非空，`BEFORE UPDATE` 触发器保证不可篡改。
- `person_compliance_profiles` 的 `guardian_person_id` 取自 consent 的 `guardian_person_id`，不接受请求体另行指定（防止“同意人 A、guardian 写 B”）。
- `guardian_consent_version` 取自 consent 的 `version`；`guardian_consent_record_id` 取其 `id`。
- **provider 与来源必须由服务端对齐**：`ageBandSource` 只允许 `GUARDIAN_RELAY` / `GUARDIAN_OBSERVATION`（否则 422 `AGE_BAND_SOURCE_NOT_ALLOWED`）；写入 `person_compliance_profiles.verified_source` 的就是该值，`person_profile_values.provided_by_person_id`（若有）固定为 `consent.guardian_person_id`。客户端声明为 `SELF_STATEMENT` 或 `OTHER_MEMBER_RELAY` 一律拒绝，不得改写。
- 因此 `verified_source` 与“这次 guardian 声明”一一对应，不需要新增字段记录声明类型。

**为什么绑定放在建档命令里而不是同意命令里**：同意成立时孩子还不存在（consent-first）。若在同意时预生成一个 Person id 并绑定，就等于在建档前创建了 Person 身份锚点，逼近“先建档”的边界。绑定与建档同事务是更窄的耦合。

---

## 6. 撤回

```text
前置：consent.decision = GRANTED 且是 profile 当前指向的版本
执行（单事务）：
  SELECT … FROM person_compliance_profiles WHERE person_id = $subject FOR UPDATE
  INSERT consent_records (decision='REVOKED', version = current+1,
                          onboarding_request_id = NULL,   -- 撤回不是新的 onboarding
                          supersedes_id = current, bound_person_id = subject,
                          bound_at = now(), notice_* = 当前告知, evidence = 撤回证据)
  UPDATE person_compliance_profiles
     SET guardian_consent_version = new.version,
         guardian_consent_record_id = new.id
  INSERT business_audit_events (event_type='CONSENT_REVOKED', …)
```

- 不删除任何历史行（证据保留优先于状态整洁）。

### 6.1 版本链在真实约束下的形态

```text
v1 GRANTED  onboarding_request_id = A     bound_person_id = P  bound_at = t1  supersedes = NULL
v2 REVOKED  onboarding_request_id = NULL  bound_person_id = P  bound_at = t2  supersedes = v1
v3 GRANTED  onboarding_request_id = B     bound_person_id = P  bound_at = t3  supersedes = v2
```

| 约束 | 作用 | v1 / v2 / v3 |
|---|---|---|
| `consent_request_binding` | GRANTED 必有 request；REVOKED 必无 | ✓ / ✓ / ✓ |
| `consent_granted_request_key`（partial unique，仅非 NULL） | 一个 request 只产出一条 GRANTED | ✓ / 不参与 / ✓ |
| `consent_subject_version_key`（`bound_person_id,purpose,version`） | 版本号不重复 | ✓ / ✓ / ✓ |

REVOKED 行**必须**在这里写成 `bound_person_id = P`：撤回针对的是已经存在的未成年人，`consent_binding_consistency` 要求两个字段同时非空。它不复用 request A，因此不会撞 partial unique。

v3（重新同意的 GRANTED）在 INSERT 时即可带 `bound_person_id = P` / `bound_at = t3`——未成年人已存在，不需要再 UPDATE 绑定；触发器只约束 UPDATE。
- 不回删 Person、Profile、Profile Values、membership。
- 撤回后 `assertMinorProcessingAllowed()` 立即 BLOCK；不存在“宽限期”。
- 重复撤回同一版本 → 409（新版本必须基于当前版本，`version` 唯一索引会拒绝重复）。
- **REVOKED 行不带 `onboarding_request_id`**：撤回不是新的 onboarding。见 §6.1。
- §29.5 的依赖传播（Derived Memory / AI run / Formulation / Plan / Task）在本 Slice 无对象可传播，**不实现也不声明**。

---

## 7. 门禁契约（供本 Slice 与后续 Slice 共用）

```ts
assertMinorProcessingAllowed(
  personId: string,
  feature: string,          // 本 Slice 无真实 feature；测试用 'IDENTITY_GATE_PROBE'
): { allowed: true; minorMode: boolean } | { allowed: false; reason: GateReason }
```

判定顺序（**短路，先拒绝**）：

| 顺序 | 条件 | 结果 |
|---|---|---|
| 1 | profile 不存在 | BLOCK / `PROFILE_MISSING` |
| 2 | `age_band = UNKNOWN` | BLOCK / `AGE_BAND_UNKNOWN` |
| 3 | `age_band = ADULT` | ALLOW |
| 4 | `age_band = MINOR_14_17` | ALLOW（`minorMode=true`） |
| 5 | `age_band = UNDER_14` 且 `guardian_person_id IS NULL` | BLOCK / `GUARDIAN_MISSING` |
| 6 | 无 `guardian_consent_record_id` | BLOCK / `GUARDIAN_CONSENT_REQUIRED` |
| 7 | 记录 `decision != GRANTED` | BLOCK / `GUARDIAN_CONSENT_REVOKED` |
| 8 | `bound_person_id != personId` | BLOCK / `CONSENT_SUBJECT_MISMATCH` |
| 9 | `guardian_person_id != profile.guardian_person_id` | BLOCK / `GUARDIAN_MISMATCH` |
| 10 | `notice_hash` 与当前生效版本不一致 | BLOCK / `NOTICE_VERSION_MISMATCH` |
| 11 | 其余 | ALLOW |

**约束**：

- 顺序不可重排。特别是 UNKNOWN 必须在第 2 步拦下，永不落到 ADULT 分支（FR-009、场景 10）。
- 门禁是**纯读**函数，无副作用；它不得触发写入，也不得成为“顺便修正状态”的入口。
- 未来任何依赖年龄 / 同意的处理都必须调用它，不得自行读 `age_band` 后判断。

---

## 8. 断言清单（实现阶段必须全部有测试）

| # | 断言 | 类型 |
|---|---|---|
| A-1 | 无有效同意时，`persons` 中不存在该未成年人 | integration |
| A-2 | 无有效同意时，`person_compliance_profiles` 中不存在该未成年人 | integration |
| A-3 | 无有效同意时，onboarding 请求本身可创建成功（门禁不自锁） | integration |
| A-4 | 直接 SQL 插入 `UNDER_14` 且 consent 为空的 profile → CHECK violation | database |
| A-5 | 同意成立后建档成功，profile 四个 consent 字段与 consent 行一致 | integration |
| A-6 | 同一 consent 二次绑定 → 409，且不产生第二个 Person | integration |
| A-7 | 撤回产生 version+1、`supersedes_id` 指向原版本、且 `onboarding_request_id IS NULL` | integration |
| A-8 | 撤回后门禁立即 BLOCK，Person / 历史行仍存在 | integration |
| A-9 | 撤回写入 `business_audit_events` | integration |
| A-10 | `UNKNOWN` 永不进入 ADULT 分支 | unit |
| A-11 | `NOT_COLLECTED` 无法写入 `age_band`（enum 拒绝） | database |
| A-12 | onboarding 表列集合**恰好等于**契约所列清单；`subject_person_id` 是唯一指向未成年人的列；不存在姓名/生日/称呼/关系等资料列（首次为 NULL，重新同意时为该 Person id） | database |
| A-13 | `consent_records` 业务列 UPDATE → 触发器拒绝 | database |
| A-14 | 过期 request 无法用于同意 | integration |
| A-15 | 重新同意（`existingSubjectPersonId`）后门禁恢复 ALLOW | integration |
| A-16 | 先绑定后建 Person 的事务（错误顺序）必须失败：直接把 `bound_person_id` 指向不存在的 Person → FK violation | database |
| A-17 | 绑定发生在 Person 插入之后、profile 之前：正确顺序的集成测试通过，且 profile 的 `guardian_consent_record_id` 指向已绑定行 | integration |
| A-18 | 同意 `decided_at` 早于 child Person 的 `created_at`（consent-first 的时间证据） | integration |
| A-19 | GRANTED→REVOKED→GRANTED 三行在真实约束下共存：GRANTED 缺 request → CHECK violation；REVOKED 带 request → CHECK violation；同一 request 第二条 GRANTED → unique violation | database |
| A-20 | 绑定对不可篡改：`(NULL,NULL)→(P,t)` 成功；改 person 失败；**只改 `bound_at` 失败**；清空任一字段失败；`(NULL,NULL)→(P,NULL)` 失败 | database |
| A-21 | 撤回端点只有 `POST /api/v1/consents/{id}/revoke`；`/compliance/guardian-consents/*` 不提供 revoke | contract |
| A-22 | UNDER_14 consent-first 建档只接受 `GUARDIAN_RELAY` / `GUARDIAN_OBSERVATION`；`SELF_STATEMENT` / `OTHER_MEMBER_RELAY` → 422 `AGE_BAND_SOURCE_NOT_ALLOWED` 且无写入；落库 `verified_source` 等于该值、provider 等于 consent.guardian_person_id | integration + database |
| A-23 | `POST /families` 的 `ageBandSource` 非 `SELF_STATEMENT` → 422，且不产生 Family / membership / profile | integration |
