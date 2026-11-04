# Contract — Per-value Provenance

**Slice**: 001-family-identity-core
**Upstream**: `Docs/V1产品需求.md` §2.2（8 类来源）、§5 不变量 4；`Docs/V1技术设计.md` §5 不变量 4 / 5
**Related**: `plan.md` D-4；`data-model.md` §9

---

## 1. 不变量

1. **来源属于一个资料值，不属于一个 Person。** 不存在 Person 级来源字段。
2. **来源类型取 §2.2 的 8 类**，不压缩为「本人 / 转述」二值。
3. **转述不得升级为本人确认。** 没有任何代码路径能把 `GUARDIAN_RELAY` 改成 `SELF_STATEMENT`；来源只在插入时确定，之后不可变更。
4. **同一 Person 的不同资料可以有不同来源。**
5. **同一资料的不同来源可以并存。** 并存即表示来源冲突，不得择优合并。
6. **未知保持未知。** `observed_at` / `provided_by_person_id` 未提供即 NULL，不填默认值。

---

## 2. 来源类型（写入白名单 vs 枚举全集）

| 枚举值 | 中文 | 本 Slice 可写 | 说明 |
|---|---|---|---|
| `SELF_STATEMENT` | 本人陈述 | ✅ | 与「是否有 Account」**无关**（FR-004） |
| `GUARDIAN_OBSERVATION` | 家长观察 | ✅ | 监护人自己的观察 |
| `GUARDIAN_RELAY` | 家长转述 | ✅ | 监护人转述第三方/孩子的话 |
| `OTHER_MEMBER_RELAY` | 其他成员转述 | ✅ | |
| `MANUAL_DEVICE_DATA` | 手工录入的设备数据 | ❌ | 无对应能力（无 Digital Use） |
| `STAFF_RECORD` | 工作人员记录 | ❌ | 无后台（§28.10 out of scope） |
| `AI_HYPOTHESIS` | AI 假设 | ❌ | 无 AI |
| `SOURCE_CONFIRMED` | 经确认信息 | ❌ | 无确认流程（Statement 体系 out of scope） |

**为什么枚举含 8 值但只允许写 4 值**：枚举是 §2.2 已批准的来源类型集合；裁剪成 4 值会在后续 Slice 造成一次纯噪声 migration。写入白名单由 API 层收紧，DB 层靠 `ppv_provider_required_for_person_sources` 与仓储校验保证。

---

## 3. 写入规则（确定性）

对每个 `(personId, attribute, source)` 的写入：

```text
1. 找到同 (person_id, attribute, source_kind) 且 status='RECORDED' 的行（可能 0..1 条）
2. 若存在：UPDATE 该行 SET status='SUPERSEDED'
3. INSERT 新行 status='RECORDED', supersedes_id = 被替换行 id（若无则 NULL）
4. 不同 source_kind 的行完全不触碰
```

**结果语义**：

| 情形 | 结果 |
|---|---|
| 家长转述后再次家长转述 | 第二条 SUPERSEDES 第一条（同一来源的更新） |
| 家长转述后本人陈述 | 两条都 `RECORDED` 并存 → 来源冲突可见 |
| 本人陈述后家长转述 | 两条都 `RECORDED` 并存（顺序无关） |
| 同来源第三次写入 | 只保留最新一条 `RECORDED`，前两条 `SUPERSEDED` |

**禁止的实现**：

- 「取最新一条作为唯一当前值」（会掩盖冲突，违反 §5 不变量 4）
- 「按可信度排序后取最高」（系统没有可信度排序权，AI 更不能用模型挑一个）
- 「用 UPDATE 原地改 value」（会抹掉历史来源）

---

## 4. 属性集合

| 属性 | 中文 | 载体 | 说明 |
|---|---|---|---|
| `DISPLAY_NAME` | 称呼 | `person_profile_values` | 自由文本，≤120 字符 |
| `RELATION_DESCRIPTOR` | 与家庭的关系描述 | `person_profile_values` | 自由文本，≤120 字符；**不是角色** |
| （`AGE_BAND`） | 年龄段 | `person_compliance_profiles.age_band` | **不在** `person_profile_values`；来源为同行 `verified_source` |

**`RELATION_DESCRIPTOR` 的边界**（必须由测试保证）：

- 它是描述性文本（如「大女儿」「配偶」），不参与 `authorize()` 的任何分支。
- 它不参与 guardian 判定。
- 它不是 `family_members` 的角色，也不得被用来推导成员管理权限。
- 它可以是自由文本，因此无法成为权限判定的稳定输入——这正是它安全的原因。

**为什么 `AGE_BAND` 不在值表里**：§7.7A 已把 `age_band` 与 `verified_source` 固定在同一行；两处存同一事实必然漂移。`profile_attribute` enum 不含 `AGE_BAND`，使第二载体在类型层不存在。

---

## 5. 读取语义（API 层）

返回 `ProfileValue[]`，只含 `status='RECORDED'` 的行（历史可通过后续数据权利接口读取，本 Slice 不提供）。

```json
[
  { "attribute": "DISPLAY_NAME", "value": "小雨", "source": "GUARDIAN_RELAY",  "recordedAt": "…", "status": "RECORDED" },
  { "attribute": "DISPLAY_NAME", "value": "小雨", "source": "SELF_STATEMENT",  "recordedAt": "…", "status": "RECORDED" }
]
```

- 同一 attribute 多条 `RECORDED` 时**全部返回**，不合并、不择优、不额外添加 `conflict: true` 之类的推断字段。
- 客户端若需要「展示一个称呼」，必须自己决定展示策略；本 Slice 不提供「当前值」概念，因为那等于替系统做择优判断。

---

## 6. 与「是否有 Account」的关系（FR-004）

| 场景 | 允许 | 不允许 |
|---|---|---|
| 无 Account 的孩子，监护人转述孩子说过的话 | `GUARDIAN_RELAY`，`provided_by_person_id` = 监护人 | 标成 `SELF_STATEMENT` |
| 无 Account 的成人（如另一位家长）自己说明 | `SELF_STATEMENT`，`provided_by_person_id` = 该 Person | 因为「没有 Account」而降级为转述 |
| 有 Account 的孩子由监护人代填 | `GUARDIAN_RELAY` | 因为「有 Account」就标成 `SELF_STATEMENT` |

**规则**：来源依据**每条信息真实的提供方式**判定，由调用方显式给出；服务端只做两件事：

1. `SELF_STATEMENT` 时，若提供了 `providedByPersonId`，必须等于 subject person；
2. `GUARDIAN_*` / `OTHER_MEMBER_RELAY` 时，若提供 `providedByPersonId`，必须是对该家庭有 membership 的 Person（防伪造）。

「是否存在 Account」**不参与**任何来源推断。

---

## 7. 断言清单

| # | 断言 | 类型 |
|---|---|---|
| P-1 | 两条不同来源的 `DISPLAY_NAME` 同时为 `RECORDED`，互不覆盖 | unit + integration |
| P-2 | 同来源二次写入 → 第一条变 `SUPERSEDED`，`supersedes_id` 指向它 | unit |
| P-3 | `persons` 表无 `source_kind` / `source` 列 | database（information_schema） |
| P-4 | `profile_attribute` enum 不含 `AGE_BAND` | database（pg_enum） |
| P-5 | 8 类来源写入 4 类允许、4 类拒绝 | integration |
| P-6 | 无 Account 的 Person 允许 `SELF_STATEMENT` | integration |
| P-7 | `provided_by_person_id` 指向非本家庭成员 → 拒绝 | integration |
| P-8 | `observed_at` 缺省存 NULL，不被补成 `now()` | database |
| P-9 | `RELATION_DESCRIPTOR` 不参与 `authorize()`：把值改成任意文本后授权结果不变 | unit |
