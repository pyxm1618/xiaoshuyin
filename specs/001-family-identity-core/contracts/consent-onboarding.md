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
   → 事务内：校验 consent → 绑定 bound_person_id → 建 Person
              → 建 membership → 建 profile（UNDER_14 + consent 指针）
              → 写 profile values → 写 audit
                    │
                    ▼
        ┌──────────────────────────────────────────────┐
        │  C. 撤回（版本链）                            │
        └──────────────────────────────────────────────┘
   POST /consents/:id/revoke
   → 追加 REVOKED(version+1, supersedes=当前)
   → profile 指针前移
   → assertMinorProcessingAllowed → BLOCK
                    │
                    ▼
        重新同意 = 新请求（existingSubjectPersonId 指向该未成年人）
        → 新 GRANTED 版本 → profile 指针前移 → 放行
```

**A 阶段不产生 Person、不产生 Profile、不产生任何孩子 PII。** 这是 FR-008(a)/(b) 的执行方式。

---

## 2. 允许 / 禁止的字段（A 阶段）

| 允许 | 为什么严格必要 |
|---|---|
| `guardian_person_id` | 同意必须可归属 |
| `declared_age_band = UNDER_14` | 不判定适用流程就无法知道需要监护人同意 |
| `notice_version` + `notice_hash` | 同意只能对已告知内容成立，必须可证明告知了什么 |
| `policy_version` | 政策版本可追溯 |
| `status` / `expires_at` / 时间戳 | 一次性、可过期、可审计 |
| `family_id` | 隔离作用域 |

| 禁止 | 理由 |
|---|---|
| 孩子姓名 / 昵称 / 称呼 | 一旦出现，该行即成为正式档案，违反 consent-first |
| 出生日期 / 精确年龄 | 同上；只允许 band |
| 关系描述、性别、学校、年级 | 属后续业务资料，不得提前采集 |
| Assessment / Case / Digital Use / AI 输入 | §19A.2 明令禁止“为以后方便”预先采集 |
| 原始 IP / UA | 只存 HMAC 摘要 |

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
| C9 | 该 request 尚无 consent 行 | `UNIQUE(onboarding_request_id)` |

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

```text
前置：consent.decision = GRANTED
      consent.guardian_person_id = actor.personId
      consent.family_id = 目标家庭
      consent.bound_person_id IS NULL
执行：UPDATE consent_records SET bound_person_id = <new person>, bound_at = now()
      WHERE id = $consentId AND bound_person_id IS NULL
      （0 行受影响 → 409 GUARDIAN_CONSENT_ALREADY_BOUND）
```

- 绑定一次性：触发器拒绝 `bound_person_id` 从非空改为其它值。
- `person_compliance_profiles` 的 `guardian_person_id` 取自 consent 的 `guardian_person_id`，不接受请求体另行指定（防止“同意人 A、guardian 写 B”）。
- `guardian_consent_version` 取自 consent 的 `version`；`guardian_consent_record_id` 取其 `id`。

**为什么绑定放在建档命令里而不是同意命令里**：同意成立时孩子还不存在（consent-first）。若在同意时预生成一个 Person id 并绑定，就等于在建档前创建了 Person 身份锚点，逼近“先建档”的边界。绑定与建档同事务是更窄的耦合。

---

## 6. 撤回

```text
前置：consent.decision = GRANTED 且是 profile 当前指向的版本
执行（单事务）：
  SELECT … FROM person_compliance_profiles WHERE person_id = $subject FOR UPDATE
  INSERT consent_records (decision='REVOKED', version = current+1,
                          supersedes_id = current, bound_person_id = subject,
                          bound_at = now(), notice_* = 当前告知, evidence = 撤回证据)
  UPDATE person_compliance_profiles
     SET guardian_consent_version = new.version,
         guardian_consent_record_id = new.id
  INSERT business_audit_events (event_type='CONSENT_REVOKED', …)
```

- 不删除任何历史行（证据保留优先于状态整洁）。
- 不回删 Person、Profile、Profile Values、membership。
- 撤回后 `assertMinorProcessingAllowed()` 立即 BLOCK；不存在“宽限期”。
- 重复撤回同一版本 → 409（新版本必须基于当前版本，`version` 唯一索引会拒绝重复）。
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
| A-7 | 撤回产生 version+1 且 `supersedes_id` 指向原版本 | integration |
| A-8 | 撤回后门禁立即 BLOCK，Person / 历史行仍存在 | integration |
| A-9 | 撤回写入 `business_audit_events` | integration |
| A-10 | `UNKNOWN` 永不进入 ADULT 分支 | unit |
| A-11 | `NOT_COLLECTED` 无法写入 `age_band`（enum 拒绝） | database |
| A-12 | onboarding 表无任何孩子 PII 列（列集合断言） | database |
| A-13 | `consent_records` 业务列 UPDATE → 触发器拒绝 | database |
| A-14 | 过期 request 无法用于同意 | integration |
| A-15 | 重新同意（`existingSubjectPersonId`）后门禁恢复 ALLOW | integration |
