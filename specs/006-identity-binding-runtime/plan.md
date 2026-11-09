# Implementation Plan: Identity Binding Runtime（受邀既有 Person 的身份绑定运行时）

**Feature**: `specs/006-identity-binding-runtime/spec.md`
**Date**: 2026-11-07
**V1 Phase**: Phase 1 — Common Core 地基（`Docs/V1技术设计.md` §38）
**Plan base (feature head)**: `f76adeea72291068e5b30559f541fe8d90644454`
**Docs baseline**: `Docs/V1产品需求.md` v3.7、`Docs/V1技术设计.md` v3.12
**Upstream frozen contract**: `specs/005-invited-identity-binding-contract/spec.md`（merged main，Contract only）
**Stage**: Plan only。本文件不实现代码、不写 migration、不建路由、不改测试。

> 本 Plan 是 `Docs/V1技术设计.md` §7.1 / §7.7A / §9 / §9.1 / §10 / §28.1 / §28.8、`Docs/V1产品需求.md` §1.2 / §1.5 / §19A.2 / V1-C44 与 005 冻结合同的 runtime 实现投影。它只回答「006 如何落地」，不新增、不重开、不削弱任何已冻结产品语义。
>
> **单一职责声明**：本轮只产出 Plan / Checklist / Tasks / 审计一。任何 `apps/**`、`packages/**`、`db/**`、`tests/**`、`Docs/**`、`specs/001~005/**` 的修改都不属于本轮。

---

## Upstream Traceability

| Plan 决策 | 上游 ID / 章节 |
|---|---|
| 独立 invitation-aware bootstrap，普通登录不变 | V1-C44、`V1技术设计.md` §28.1、005 IB-001 / IB-002 |
| Phase A → Gate 1 → Phase B → Gate 2 → Phase C 唯一顺序 | 005 §5.1 |
| Case B 复用 / 拒绝，Case C 只走 bootstrap | 005 §5.2、`V1技术设计.md` §10 |
| second-party confirmation = target confirmation + candidate recognition | 005 §5.3、`V1技术设计.md` §7.7A |
| 年龄 / 确认主体矩阵 | 005 §5.4、`V1产品需求.md` §19A.2 |
| 四类业务结果、PENDING 边界、settled replay、operation ≠ attempt | 005 §5.5 |
| 并发 commit ∈ {0,1}、binding increase ≤ 1、Person 增量 = 0 | 005 §5.5、spec FR-016 / FR-017 |
| binding 是独立身份事实、不授予授权、不自动解绑 | 005 §5.6.1、V1-C20 / V1-C21 |
| 内部结果 ≠ candidate-facing 结果 | 005 §5.6.2、spec FR-019 |
| 审计行为冻结、存储不冻结、不记录 secret | 005 §5.6.3、spec FR-023 |
| invitation 生命周期归 Slice 4 | 005 §5.6.4、Slice 4 `participant-lifecycle-and-identity-seam.md` §1 / §6 |
| P1 多 Family / 不属于目标 Family → BLOCK | 005 §5.7、`V1技术设计.md` §7.1 |
| Account ↔ Person 1:1、Person → Account 0..1 | `V1技术设计.md` §7.1、Slice 1 `db/migrations/001_initial_schema.sql` |
| 统一 `authorize()`、RLS、migrator/app 双角色 | `V1技术设计.md` §9 / §9.1、Slice 1 Plan D-5 |
| 关键命令 `actor + command_type + idempotency_key` | `V1技术设计.md` §8.5、Slice 1 Plan D-6.3 |
| 普通 `/auth/wechat` 回归不变 | 005 §5.2 第 5 条、`V1技术设计.md` §28.1 |

**Blocking rule**：本 Plan 的任何表、端点、命令、事件或授权动作都必须能追溯到上表或 006 Spec 的 FR / AS / SC。无法追溯的设计一律删除，不得以「以后可能有用」保留。

---

## Summary

006 交付一个**独立的身份绑定运行时**，把 005 的合同语义落成可持久化、可幂等、可并发收敛、可审计、可验证的服务端能力：

1. **5 张专用表**：pending authentication context、binding attempt、binding confirmation、binding operation key、identity binding audit event。它们属于 006，不重建 Person / Account / Family / Consent / audit / idempotency 基线。
2. **1 个数据库层并发收敛点**：`PENDING` 状态上的部分唯一索引 `(target_person_id, candidate_identity_digest, invitation_participation_id)`；它不是永久全局唯一，terminal / committed 后同三元组可创建 new attempt。
3. **1 个最终提交点**：`UPDATE persons SET account_id = ... WHERE id = P1 AND account_id IS NULL` + `persons.account_id UNIQUE` + `accounts.wechat_openid UNIQUE`，在同一事务内与 attempt settled、audit 一起完成。
4. **6 个端点**：bootstrap、candidate decision、candidate status、session exchange、confirmer pending list、confirmer decision。没有 participant、Case、UI、通知、KYC、后台任务。
5. **candidate-facing 统一 generic**：除 Case B 正确 Account 复用外，未绑定 candidate 的所有内部原因在 HTTP status、body keys、字段、下一步能力上不可区分。
6. **Gate 1 / Gate 2 复用现有事实源**：`person_compliance_profiles`、`consent_records`、`family_members`、`families.created_by_person_id`、Slice 1 `assertMinorProcessingAllowed`；不复制 guardian / consent / authorization 系统。
7. **审计专用 sink**：新建 `identity_binding_audit_events`，append-only、无 secret、无明文 openid、不为 audit FK 创建 Person / Account；`business_audit_events` 因 `actor_account_id` / `family_id` NOT NULL 与封闭 event_type 无法承载 Case C pre-account 结果，故不复用。

**不做**：普通登录改造、`mode=invite`、Person / Account / Family 重建、Case / Evidence / Participant、invitation lifecycle、Consent 平台扩展、UI、通知、后台 job、KYC、merge / unlink / rebind、V2–V5。

---

## Technical Baseline

| 维度 | 冻结选择 |
|---|---|
| Runtime | Node 26 / TypeScript / Fastify / `pg` / Zod |
| DB | PostgreSQL 18，`uuidv7()`，reviewed SQL migration，禁止 `drizzle-kit push` |
| 迁移角色 | `xiaoshuyin_migrator`（table owner，只跑 DDL）；`xiaoshuyin_app`（NOBYPASSRLS，最小 DML） |
| RLS | 新表全部 `ENABLE` + `FORCE ROW LEVEL SECURITY`；事务内 `set_config(..., true)` |
| 授权 | 单一 `authorize()`，新增动作 / purpose / resource 必须注册并 fail-closed |
| 幂等 | 新表 `binding_operation_keys`，与既有 `idempotency_keys` 分离；不复用 `actor_account_id` NOT NULL 表 |
| 契约 | Zod → Fastify schema → 手写 OpenAPI → generated types；generated 只由脚本生成 |
| 测试 | Vitest；domain / DB / integration / concurrency / security / contract / governance |

**不引入**：新框架、消息队列、worker、outbox、定时器、KMS、keyring、外部身份提供方、通用 attestation 平台。

---

## Constitution Check

- **Spec 治理**：本次 **Decision A upstream contract remediation** 被明确授权修改 `Docs/**`、005、006 Spec、Plan / Tasks / Checklist / handwritten OpenAPI，仅用于冻结 threat boundary 与已知 Plan findings；从本 remediation final head 起，后续 Implement 不得再自行改写这些上游语义。
- **切片刻度**：006 不实现 Slice 2 / 3 / 4 的业务；只消费 Slice 4 合同与 Slice 1 基线。
- **冻结语义**：Phase 顺序、Case B/C、Age Matrix、PENDING 边界、no-P2、anti-enumeration、invitation 生命周期归属全部原样保留。
- **验证证据**：每个 Task 必须有可执行验证；不能以「设计存在」代替「代码真实可用」。
- **依赖诚实**：Slice 1（`001-family-identity-core`）已于 2026-11-07 Final Independent Audit II PASS → PR #13 merge main → post-merge CI PASS → CLOSED；`origin/main`（`f4ef602`）的 `authorize()` 已是真实实现（`MINOR_PROCESSING` 为实分支），B1 已 SATISFIED。Slice 4 runtime 不是 core blocker：本 Slice（业务 Slice 5，repo feature 006）core 可基于冻结 contract + port + fixture 完成；Slice 4 runtime 只阻塞 `T121–T124` 的真实 adapter / E2E closeout。不得把 Slice 4 runtime 与本 Slice core 写成循环硬依赖。

---

## Ultimate Audit Targeted Plan / Contract Remediation（H-01 / H-02 / M-01—M-06）

本节是 failed Head f96bc94538212d74edcf46a53962114e8cfb88a5 的 Ultimate Final Independent Re-audit 之后的 authoritative remediation overlay，并已由上游产品负责人通过 **Security Decision A** 补充 threat model。它取代上一轮 F-01—F-08 overlay 中已被 Ultimate Audit 推翻的 pairing / concurrency / cleanup / verification 口径；本轮只做经授权的 Docs / 005 / 006 Spec / Plan / Tasks / Checklist / handwritten OpenAPI contract remediation，不扩展普通 Auth、Family、Invitation、Participant、Case、Evidence 或 UI，也不进入 production implementation。

| Finding | 冻结 contract | 主要 reopen tasks | Checklist | OpenAPI |
|---|---|---|---|---|
| H-01 recognition→identity pairing | D-3.5 / D-9.2 / D-10 / D-11 | T027—T032、T059—T066、T085、T091—T094、T112 | CHK191—CHK194 | YES |
| H-02 Gate2 locking / linearization | D-8.4 / D-13.5 / D-14 / D-19.4 | T013、T073、T074、T081、T103、T104、T110 | CHK195—CHK196 | NO |
| M-01 candidate dynamic eligibility | D-8.5 / D-10.2 / D-14 | T059、T060、T073、T074、T085 | CHK197 | H-01 response shape |
| M-02 bootstrap replay cleanup | D-3.4 / D-14 | T031、T032、T049、T050 | CHK198 | NO |
| M-03 status/context expiry cleanup | D-3.2 / D-14 | T031、T032、T061、T062、T080 | CHK199 | NO |
| M-04 Phase C expiry settlement | D-2.2 / D-14 / D-19.4 | T073、T074、T079—T081 | CHK200 | NO |
| M-05 substantive coverage fail-closed | D-19.5 / Verification Plan | T115 | CHK201 | NO |
| M-06 verify-all provenance | D-19.6 / Verification Plan | T118、T120 | CHK202 | NO |

### H-01 — root cause and replacement pairing contract

**Decision A threat boundary**：Slice 5 V1 不要求检测或阻断 authenticated candidate 主动与第三人串通实施的 intentional realtime relay / intentional challenge forwarding / collusive presenter substitution。该排除项不得被当作 pairing possession 即 identity proof；confirmer 仍必须独立认证、亲自辨认现场 candidate，并确认眼前被辨认的人正在使用 / 展示其本人当前 authenticated binding session 的 pairing material。pairingChallenge possession itself **IS NOT identity proof**。

上一轮 S0 → fresh bootstrap → S1 → |S1-S0|=1 机制废止。它只能证明时间窗口内出现了唯一新 attempt，不能证明该 attempt 的 authenticated candidate 就是 confirmer 现场辨认的人；pending-list delta、createdAt、attemptId、invitation possession 均不得作为 recognition→identity proof。

唯一冻结机制：server-generated candidate-presented one-time pairing challenge。

1. Candidate 先通过自己的 invitation-aware bootstrap、独立 WeChat authentication、Gate 1，并处于 exact Phase-B attempt / pending context。
2. Candidate 对 P1 执行 AFFIRM 时，服务端必须先执行 M-01 current dynamic eligibility re-evaluation。只有仍合法的 exact context/attempt 才能产生有效 pairing challenge。
3. Pairing challenge 由服务端生成，只返回 candidate 自己；candidate 在现场主动展示/传递给正在亲自辨认自己的 confirmer。系统不得根据 pending list、时间、昵称、displayName、Family membership、createdAt、IP、User-Agent、AI 或旁路去猜。
4. Challenge 必须是 opaque、短寿命、不可预测/不可伪造的 authenticated material，cryptographically bound 至少覆盖 candidate pending context、candidate authenticated identity digest、exact attempt、P1、invitation participation、pairing expiry。不得向 client 暴露明文 P1 / identity / invitation / OpenID；raw challenge 不写 audit / log。
5. Challenge 不是 identity proof 本身。合法确认必须同时具备：confirmer 独立认证 + confirmer 基于现实家庭关系亲自 human recognition + target confirmation + candidate 现场提供的 exact challenge + 服务端验证 challenge 对应的 authenticated candidate/context/attempt/P1/invitation。
6. Confirmer decision 不再用 attemptId path selector。服务端从 pairingChallenge 解析/验证 exact context/attempt；pending list 可以保留为 authorized operational view，但不得参与 recognition pairing 或 attempt selection。
7. Challenge expiry 必须不晚于 context 与 attempt expiry；pairing TTL 来自 required positive config，candidate/confirmer 不可覆盖或延长。同一 AFFIRM idempotent replay不得延长原 challenge；过期后只有 attempt/context 仍合法且再次通过 current eligibility 才可得到新 valid challenge。
8. Challenge 是 single-use semantic material：成功 second-party decision 与 confirmation / terminal decision 在同一 consistency boundary 内消费；same idempotency replay只回读 authoritative outcome，不产生第二 confirmation。different operation 使用 consumed challenge必须 fail closed。
9. Invalid / expired / consumed / wrong-P1 / wrong-invitation / wrong-candidate / wrong-attempt challenge 对 confirmer 统一 404 BINDING_NOT_FOUND，零 confirmation / state / binding mutation。existing operation-key mismatch仍为 409 IDEMPOTENCY_PAYLOAD_MISMATCH。
10. Candidate anti-enumeration：对语法合法且 binding context 仍可用的 AFFIRM，response shape 固定为 { binding: NOT_COMPLETED, pairingChallenge: opaque }。若 current eligibility 已失效、attempt settled 或其它 hidden business reason 不能发行 valid challenge，则返回同形状、不可解析到 live attempt 的 decoy challenge。REJECT/CANCEL 仍返回 { binding: NOT_COMPLETED }；该差异来自 candidate 自己的 decision，不来自 hidden fact。

H-01 的 V1 acceptance 只覆盖**非串通攻击**：攻击者不能仅凭 same invitation、timing、pending-list position、attemptId、createdAt、自己的 unrelated challenge、wrong P1、wrong identity、wrong invitation 或 replay 抢占 recognition / binding。服务端必须验证 exact challenge ↔ current issuance ↔ authenticated identity/context/attempt/P1/invitation；不匹配一律 fail closed。**authenticated candidate 主动把其当前 valid challenge 实时转发给另一现场 presenter 的 intentional realtime relay / collusion，不是 Slice 5 V1 required fail-closed acceptance case**；不得再用“attacker challenge 未由 onsite candidate 展示”作为 H-01 blocking test premise。

### H-02 — Gate2 authoritative concurrency / linearization contract

Gate 2 正确性以真实 runtime role 下的数据库行为为准，不以源码中出现 SELECT ... FOR UPDATE 为准。

- Gate2 check 与最终 Person binding mutation 必须共享可证明的 linearization / validation boundary，覆盖所有会改变 Gate2 结果的 authoritative facts。
- 至少覆盖 profile / age-band、guardian relationship、Consent、Family membership / confirmer authority、invitation current state、P1 binding conflict、candidate-account conflict。
- Implement 可以使用 row lock、version / optimistic check、advisory serialization、isolation 或其它 DB-safe 等价机制；Plan 不强制唯一 SQL。
- 必须在真实 runtime role（xiaoshuyin_app、NOBYPASSRLS / FORCE RLS）下证明锁/序列化/检测真实生效。FOR UPDATE 返回 0 行、只校验 SQL 字符串、或只做顺序测试都不算证明。
- barrier acceptance：Gate2 reads/PASS → pause → concurrent invalidating mutation authoritative commit/linearize → resume binding。若 invalidation 在线性化上先成立，最终必须 P1 binding 0、attempt 非 COMMITTED、无 partial Account/binding；terminal reason/audit/cleanup与对应业务原因一致。
- invitation production barrier 的最终 proof 等 Slice 4 runtime；core fixture/port proof不得冒充真实 adapter proof。

### M-01 — candidate AFFIRM current dynamic eligibility

在写 candidate confirmation 之前、在发行 valid pairing challenge 之前，必须 current-read 并重新评估：P1 still exists、target Family membership 唯一且匹配、profile / age-band、guardian relationship、required/applicable Consent + Compliance、invitation still valid、P1 Account仍满足 Case-C 前提、candidate identity/account conflict未出现。

仍合法 → 写/复用唯一 candidate confirmation并发行 valid challenge。任一 required eligibility失效 → attempt authoritative TERMINAL；不得写新的 candidate confirmation，不得发行 valid challenge；candidate仍收到 fixed AFFIRM shape + decoy challenge；settlement必须 exactly-one terminal audit + attempt-scope secret scrub。至少有 consent revoked after bootstrap before AFFIRM 的 direct regression，并覆盖 age/profile、guardian、membership、invitation、binding conflict矩阵。

### M-02 — bootstrap settled/pre-attempt replay cleanup

COMMITTED replay、TERMINAL replay、pre-attempt blocked replay、Case B REUSED replay中，任何 fresh transport context只要不再需要 OpenID完成 Phase C，response前必须满足 openid_ciphertext/openid_nonce/openid_tag 全部 NULL。不得因先 linkAttempt 后调用只匹配 attempt_id IS NULL 的 cleanup而漏掉 fresh replay context。验收必须直接读取新 context row。

### M-03 — status / context expiry cleanup

status materialize attempt expiry → TERMINAL / ATTEMPT_EXPIRED + exactly-one terminal audit + 该 attempt 所有 contexts secret scrub。context自身 expiry至少 scrub current context；若 attempt仍 live，不凭 context expiry伪造 terminal audit。若同时 materialize attempt expiry，则使用 attempt-scope settlement。必须有 multi-context regression及 state/reason/audit/secret/binding DB observables。

### M-04 — Phase C expiry authoritative settlement

ATTEMPT_EXPIRED 只有一个 authoritative settlement path负责 state transition + terminal reason + exactly-one terminal audit + attempt-scope cleanup。禁止先 materialize state 再二次 conditional terminalize导致 audit/cleanup跳过。验收：PENDING在 Phase C 到期 → TERMINAL/ATTEMPT_EXPIRED、audit=1、all contexts scrubbed、no binding、no orphan/partial Account；并发/replay仍只 settle once。

### M-05 — substantive coverage fail-closed

coverage:audit 必须升级为 required acceptance → stable proof identifier → exact executable proof。required set至少包括 historical F-01/F-02、H-01、H-02、M-01—M-04、HTTP confirmationVersion matrix、RLS negative writes、rollback matrix、两条 MINOR success、true Case B mismatch。删除、重命名、从执行集合移除 required proof，或替换成 unrelated passing proof，coverage audit必须 non-zero；coverage gate本身必须有 RED self-test覆盖这四种破坏。总体百分比不能替代 substantive proof。

### M-06 — canonical verify-all provenance

Canonical final invocation固定为仓库根目录 node scripts/verify-all.mjs。PASS要求：
1. 运行前记录 exact repo / branch / HEAD / origin/main；tracked working tree clean。
2. 记录 required toolchain/dependencies与 required env名称+存在性（不记录 secret value），至少含 DB test env、IDENTITY_BINDING_SECRET、context TTL、attempt TTL、pairing TTL。
3. 每个 required child command的 exact command + exit code进入 evidence；任一 required child non-zero → verify-all non-zero。
4. 只有 canonical invocation final exit 0才 PASS。
5. final evidence记录 cwd、timestamp、Head、origin/main、child exit matrix、final exit。
6. 历史 exit 1若无法复原，记录 historical provenance unresolved；不得编造归因。

Governance：以上均在 Docs → 005 → 006 Spec 留给 Plan/runtime的实现空间内。Docs、005、006 Spec保持只读。

---

## Design Decisions Index

| ID | 决策 |
|---|---|
| D-1 | 数据模型总览与业务 ownership |
| D-2 | Binding attempt 持久化与生命周期表达 |
| D-3 | Pending authentication context |
| D-4 | Confirmation 持久化 |
| D-5 | Operation-level idempotency |
| D-6 | Account ↔ Person Phase C commit |
| D-7 | 并发收敛与数据库层最终保证 |
| D-8 | Gate 1 / Gate 2 执行与 Age / Pre-gate Matrix |
| D-9 | Second-party authorization 与确认者发现 |
| D-10 | Runtime API / command surface |
| D-11 | Anti-enumeration response matrix |
| D-12 | Authorization 扩展 |
| D-13 | RLS 与事务上下文 |
| D-14 | Transaction boundary |
| D-15 | Audit / provenance |
| D-16 | Invitation seam 与 Slice 4 dependency |
| D-17 | Ordinary login boundary 与 client flow |
| D-18 | Migration sequencing / rollback |
| D-19 | Test plan 与 FR / AS / SC 映射 |
| D-20 | Explicit exclusions / structure checks |
| D-21 | Observability / logging |
| D-22 | Dependency gate 与 Implement Gate |

---

## D-1 数据模型总览与业务 ownership

### D-1.1 新增对象（全部 additive，全部 006-owned）

| 表 | 业务 ownership | 作用 | 不承载 |
|---|---|---|---|
| `binding_pending_contexts` | 006 | Phase A 的临时认证上下文；token hash、加密 openid、identity digest、attempt 关联 | Person、Account、session、family context、P1 关联（attempt 关联前） |
| `binding_attempts` | 006 | 一次 binding attempt 的语义标识、P1、invitation、lifecycle、settled outcome | membership、guardian、Consent、Case / Participant 权限、Evidence |
| `binding_confirmations` | 006 | candidate / second-party affirmative confirmation，append-only | Consent、membership、guardian relationship |
| `binding_operation_keys` | 006 | 006 命令的 operation-level 幂等记录 | attempt 生命周期结果快照 |
| `identity_binding_audit_events` | 006 | security-relevant binding outcome 的 append-only 审计 | 通用审计框架、PII、secret |

**为什么必须新增 attempt 表**：005 §5.5 要求 settled replay、并发 commit ∈ {0,1}、new attempt、attempt expiration 与 audit outcome 可回读；进程内存或日志不构成权威事实。Slice 4 合同 `N-24` 的「无 binding attempt 表」只是 Slice 4 自身结构枚举，不禁止 006 拥有 attempt runtime。

**为什么不复用 `business_audit_events`**：该表 `family_id`、`actor_account_id` 均 NOT NULL，`event_type` 是封闭 CHECK 列表；Case C 在 Gate 1 被阻断时可能没有正式 Account，`family_id` 也可能无法从 candidate 侧合法设置。为满足它而创建 Account / Person 或放宽 Slice 1 约束，直接违反 005 §5.6.3 与 spec FR-023。006 新建一张**单用途、append-only、write-only-to-runtime** 的审计表，不是第二套通用审计框架。

**为什么不复用 `idempotency_keys`**：该表 `actor_account_id` NOT NULL 且 RLS 由 `app.account_id` 限定；bootstrap / candidate decision 发生在正式 Account 存在之前。006 新建 `binding_operation_keys`，scope 可按 candidate identity 或 Account 区分。

### D-1.2 不新增 / 不修改的对象

- 不新增 `persons`、`accounts`、`families`、`family_members`、`consent_records`、`person_compliance_profiles` 的任何列。
- 不新增 Consent 类型、guardian policy、PIPIA、feature policy、Case / Participant / Evidence / Assessment / Notification 表。
- 不创建 `case_participants` 或任何 invitation 表；`invitation_participation_id` 只是 Slice 4 合同引用，**不建 FK**（见 D-16）。
- 不修改 `business_audit_events`、`idempotency_keys`、Slice 1 RLS 既有 policy 的语义；只追加 purpose-scoped 读 / 提交 policy（D-13）。

---

## D-2 Binding attempt 持久化与生命周期表达

### D-2.1 表定义（Plan 冻结）

```sql
CREATE TYPE binding_attempt_state AS ENUM ('PENDING', 'COMMITTED', 'TERMINAL');

CREATE TABLE binding_attempts (
  id                          uuid PRIMARY KEY DEFAULT uuidv7(),
  target_person_id            uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  target_family_id            uuid NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  invitation_participation_id uuid NOT NULL,
  candidate_identity_digest   text NOT NULL CHECK (candidate_identity_digest ~ '^[0-9a-f]{64}$'),
  state                       binding_attempt_state NOT NULL DEFAULT 'PENDING',
  terminal_reason             text,
  committed_account_id        uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  expires_at                  timestamptz NOT NULL,
  settled_at                  timestamptz,
  CONSTRAINT binding_attempt_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT binding_attempt_terminal_reason_closed CHECK (
    terminal_reason IS NULL OR terminal_reason IN (
      'IDENTITY_CONFLICT',
      'TARGET_ALREADY_BOUND',
      'CANDIDATE_ACCOUNT_BOUND_OTHER_PERSON',
      'MULTI_FAMILY_BLOCK',
      'AGE_BAND_ADULT_UNSUPPORTED',
      'AGE_BAND_UNKNOWN_BLOCKED',
      'GUARDIAN_MISSING',
      'GUARDIAN_CONSENT_INVALID',
      'COMPLIANCE_BLOCKED',
      'INVITATION_TERMINAL',
      'ATTEMPT_EXPIRED',
      'CANDIDATE_REJECTED',
      'CANDIDATE_CANCELLED',
      'WRONG_CONFIRMER',
      'RECOGNITION_REJECTED',
      'CONFIRMER_REJECTED',
      'CONCURRENCY_LOSER'
    )
  ),
  CONSTRAINT binding_attempt_state_consistency CHECK (
    (state = 'PENDING')
      = (terminal_reason IS NULL AND committed_account_id IS NULL AND settled_at IS NULL)
  ),
  CONSTRAINT binding_attempt_terminal_consistency CHECK (
    state <> 'TERMINAL'
      OR (terminal_reason IS NOT NULL AND committed_account_id IS NULL AND settled_at IS NOT NULL)
  ),
  CONSTRAINT binding_attempt_committed_consistency CHECK (
    state <> 'COMMITTED'
      OR (terminal_reason IS NULL AND committed_account_id IS NOT NULL AND settled_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX binding_attempts_live_key
  ON binding_attempts (target_person_id, candidate_identity_digest, invitation_participation_id)
  WHERE state = 'PENDING';

CREATE INDEX binding_attempts_target_idx
  ON binding_attempts (target_person_id, state, created_at DESC);

CREATE INDEX binding_attempts_invitation_idx
  ON binding_attempts (invitation_participation_id, created_at DESC);
```

### D-2.2 生命周期表达

| 维度 | 表达 | 说明 |
|---|---|---|
| `PENDING` | `state = 'PENDING'`，`settled_at IS NULL` | attempt 仍合法，仅缺可在同一 attempt 内补齐的合法确认 |
| `COMMITTED` | `state = 'COMMITTED'`，`committed_account_id` 非空，`settled_at` 非空 | binding 成功，`Account A ↔ P1` |
| `TERMINAL` | `state = 'TERMINAL'`，`terminal_reason` 非空，`settled_at` 非空 | attempt 永不能再成功 |
| `RETRYABLE` | **不落表、不是 attempt state** | 只存在于 operation 结果；由 response 表达，retry / read-back 解析回 authoritative attempt state |
| expiration | `expires_at` + 访问时条件物化 | commit / 确认 / fresh create-converge 前均先 materialize expiry；old expired PENDING 先 TERMINAL + `ATTEMPT_EXPIRED` + exactly-once audit + all-context cleanup，之后才允许 new attempt；不得继续 link expired PENDING。不是后台 job。 |

**为什么 RETRYABLE 不能成为 attempt settled state**：005 §5.5 明确 RETRYABLE 是 operation 维度；若落成 attempt 状态，会错误冻结 attempt，使 timeout 后的合法重试无法推进，并违反 `PENDING → COMMITTED` 的合法路径。

**为什么不用永久 `(P1, identity, invitation)` 唯一**：部分唯一索引的谓词 `WHERE state = 'PENDING'` 使 terminal / committed 行退出索引；old attempt terminal + invitation valid + 业务政策允许时，同三元组可以插入 new attempt。该设计满足「至多一个 live attempt」且不形成永久全局唯一。

### D-2.3 attempt identity ≠ operation idempotency

- `binding_attempts.id` 只标识 attempt 身份。
- operation idempotency 由 `binding_operation_keys` 表达（D-5）。
- 任何代码不得把 `binding_attempts.id` 作为幂等键，也不得把 operation key 的响应快照当成 attempt 的永久结果。

---

## D-3 Pending authentication context

### D-3.1 表定义（Plan 冻结）

```sql
CREATE TABLE binding_pending_contexts (
  id                          uuid PRIMARY KEY DEFAULT uuidv7(),
  token_hash                  text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  candidate_identity_digest   text NOT NULL CHECK (candidate_identity_digest ~ '^[0-9a-f]{64}$'),
  attempt_id                  uuid REFERENCES binding_attempts(id) ON DELETE RESTRICT,
  invitation_participation_id uuid,
  committed_account_id        uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  openid_ciphertext           bytea,
  openid_nonce                bytea,
  openid_tag                  bytea,
  pairing_issued_at           timestamptz,
  pairing_expires_at          timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  last_used_at                timestamptz,
  expires_at                  timestamptz NOT NULL,
  CONSTRAINT binding_context_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT binding_context_encryption_complete CHECK (
    (openid_ciphertext IS NULL AND openid_nonce IS NULL AND openid_tag IS NULL)
    OR (openid_ciphertext IS NOT NULL AND openid_nonce IS NOT NULL AND openid_tag IS NOT NULL)
  ),
  CONSTRAINT binding_context_invitation_requires_attempt CHECK (
    invitation_participation_id IS NULL OR attempt_id IS NOT NULL
  ),
  CONSTRAINT binding_context_committed_requires_attempt CHECK (
    committed_account_id IS NULL OR attempt_id IS NOT NULL
  ),
  CONSTRAINT binding_context_pairing_timestamps_complete CHECK (
    (pairing_issued_at IS NULL AND pairing_expires_at IS NULL)
    OR
    (pairing_issued_at IS NOT NULL AND pairing_expires_at IS NOT NULL
      AND pairing_expires_at > pairing_issued_at
      AND pairing_expires_at <= expires_at)
  )
);

CREATE INDEX binding_context_attempt_idx ON binding_pending_contexts (attempt_id);
```

### D-3.2 语义

| 问题 | 冻结决定 |
|---|---|
| 如何可信表达 | 32 字节随机 token（base64url）返回给 client；DB 只存 `sha256(token)`；每次请求用 `X-Binding-Context` 传递，正常 `Authorization: Bearer` 不能调用 |
| 生命周期 | `expires_at = created_at + IDENTITY_BINDING_CONTEXT_TTL_SECONDS`；过期后 token 无效，必须重新 bootstrap |
| 与 WeChat authentication result 的关系 | 在 Phase A 由服务端 `code2session` 得到 openid；identity digest = HMAC-SHA256(`IDENTITY_BINDING_SECRET`, `identity-binding:openid-digest:v1:` + openid) |
| 如何防篡改 | token 随机、不可预测；DB 只存 hash；context 行与 identity digest、attempt 绑定；客户端不能提交 digest / openid / personId |
| 是否持久化 | 是；短暂持久化是完成后续 Phase 与 commit 所必需；不是进程内存 |
| 是否使用 token / challenge | 使用 opaque bearer-like `X-Binding-Context`；不是 JWT，不是普通 session，不含 openid / person / attempt 明文 |
| secret 是否落库 | `IDENTITY_BINDING_SECRET` 不落库；openid 以 AES-256-GCM 加密落库，密钥由 `IDENTITY_BINDING_SECRET` HKDF 派生；commit / terminal / Gate 1 失败后清空 ciphertext |
| expiry | 由 required positive env `IDENTITY_BINDING_CONTEXT_TTL_SECONDS` 决定；caller 不可提交 / 覆盖 / 延长 |
| replay | 同一 token 可重复读取 status / 发起 decision；decision 由 operation key 与 attempt 条件更新收敛；不因 replay 产生第二份 confirmation / 第二次 commit。Bootstrap replay 的 transport credential 规则见 D-3.4 |
| 如何传到 Phase B | Gate 1 通过后，attempt 创建在同一事务内把 `attempt_id` 与 `invitation_participation_id` 写回 context；Phase B 的 candidate decision 从 context 读取 attempt |
| 如何保证不能当普通业务 session | 普通 `plugins/auth.ts` 只接受 `Authorization: Bearer`，并显式拒绝 `X-Binding-Context`；binding 路由使用独立 preHandler；context 不设置 `app.account_id` / `app.person_id` / `app.family_id`；不签发普通 session，只有 `POST /session` 在 COMMITTED 后签发 |

### D-3.3 Crypto / env

| Env | 要求 | 用途 |
|---|---|---|
| `IDENTITY_BINDING_SECRET` | required，>= 32 bytes，不记录 | HKDF 派生 identity pepper 与 AES key |
| `IDENTITY_BINDING_CONTEXT_TTL_SECONDS` | required，正整数，无默认值 | pending context TTL |
| `IDENTITY_BINDING_ATTEMPT_TTL_SECONDS` | required，正整数，无默认值 | attempt TTL |
| `IDENTITY_BINDING_PAIRING_TTL_SECONDS` | required，正整数，无默认值 | pairing challenge TTL；不得长于 context / attempt |

派生：

```text
identityPepper = HKDF-SHA256(secret, info="identity-binding:openid-digest:v1", len=32)
aesKey         = HKDF-SHA256(secret, info="identity-binding:pending-openid:v1", len=32)
token          = base64url(randomBytes(32))
tokenHash      = sha256hex(token)
```

- 加密：AES-256-GCM，12-byte random nonce，AAD = `context.id::text`。
- **ciphertext 清理按 F-05 scope contract**：attempt settled / expired 时 scrub 该 attempt 全部 contexts；pre-attempt blocked / no-attempt scrub 同 identity 全部 no-attempt decryptable contexts；保留 non-secret historical linkage。不得只清当前 context，也不得把 decryptable secret 留给未来 lifecycle cleanup。
- 不记录 key、token、openid、ciphertext 到日志 / audit / response。
- 不在本 Slice 设计 KMS / keyring / key rotation；secret 变更属 operational compatibility event，必须 fail-safe，不得静默产生不同 digest / 不可解密旧 context。

### D-3.4 Bootstrap replay 的 transport credential（Plan clarification）

冻结约束：token = 32 random bytes；DB 只存 `sha256(token)`；operation key 不保存 `response_body`；Bootstrap response 必须返回 `pendingContextToken`。因此旧 token 明文不可从数据库重建。

```text
new pending transport context on bootstrap replay
  ≠ new binding attempt
  ≠ duplicate business side effect
```

- same `BOOTSTRAP` operation key + same payload replay **MAY** 创建一条新的 `binding_pending_contexts` 行并返回新的随机 `pendingContextToken`；该行只是 transport credential，MUST 立即 link 到同一 authoritative attempt（`attempt_id` / `invitation_participation_id` 不变），受同一 `IDENTITY_BINDING_CONTEXT_TTL_SECONDS` 约束。
- MUST NOT 因 replay 创建第二个 attempt、第二份 confirmation、第二次 commit、第二条业务 audit 行、第二个 operation key。
- replay 必须读取 authoritative attempt state：`PENDING` / `TERMINAL` → candidate-facing generic；`COMMITTED` → `{ binding:"COMMITTED" }`（D-10.2）。
- 新 context 行是幂等记录的 transport 伴生事实，不是 attempt identity，也不是 operation outcome 快照；不得把首次 response body 当作 replay 结果。

---

### D-3.5 Candidate-presented pairing challenge

Pairing challenge是H-01最小authenticated binding material，不新增Person / Account / Family / invitation对象，也不是ordinary session。

- generator：server only。
- issuance：candidate AFFIRM经D-8.5 current eligibility PASS后。
- delivery：只返回candidate自己的candidate-decision response；candidate现场主动展示/传递给confirmer。
- cryptographic binding至少认证 context_id + candidate_identity_digest + attempt_id + target_person_id + invitation_participation_id + pairing_issued_at + pairing_expires_at；外部表示opaque，不可读出这些字段。
- construction使用IDENTITY_BINDING_SECRET的domain-separated authenticated construction，effective authentication security至少128 bits。domain separation string固定为 `xiaoshuyin:identity-binding:pairing:v1`（或密码学等价的固定 domain tag）；不得复用 pending-context token domain。
- **唯一 external representation**：un-padded base64url，alphabet 仅 `A-Z a-z 0-9 _ -`，**exact length = 192 ASCII characters**，regex `^[A-Za-z0-9_-]{192}$`。valid 与 decoy MUST 使用完全相同的 encoding、exact length、alphabet、response key、HTTP 200、`application/json` content type 与 structural validation；candidate response不得暴露 expiry metadata。
- 192-character representation 对应固定 144-byte authenticated envelope。具体 primitive 可由 Implement 选择等价的 AEAD / encrypt-then-MAC construction，但 envelope MUST fixed-width；若使用 nonce，nonce / equivalent issuance replay material 必须由 server 生成并作为**最小 replay material**随 issuance state 持久化或可确定性重建。raw challenge plaintext/string仍不得写 audit/log。
- pairing_expires_at = min(pairing_issued_at + IDENTITY_BINDING_PAIRING_TTL_SECONDS, context.expires_at, attempt.expires_at)；issuance state 必须能够唯一标识当前 issuance，rotation 时必须产生新的 issuance identity/material。
- **operation-authoritative replay output**：same candidate AFFIRM + same idempotency key + same issuance MUST return the **exact authoritative original pairingChallenge bytes**。不得重新随机生成“语义相同但 bytes 不同”的 challenge。当前 issuance 未过期且尚无 SECOND_PARTY confirmation 时，repeated AFFIRM 必须复用当前 issuance 并重建/返回同一 192-byte-string output，不延长 expiry、不重复 candidate confirmation。
- **rotation**：pairing_expires_at 已过期但 context/attempt仍live、无SECOND_PARTY confirmation且D-8.5重新PASS时，新的合法 AFFIRM operation原子创建 new issuance；new issuance MUST produce different pairingChallenge bytes。old challenge因不再等于 current issuance而失效；rotation不得延长context或attempt本身。
- valid only while：token-bound issuance identity/timestamps等于context current issuance，context/attempt/P1/invitation/identity mapping一致，candidate confirmation存在，attempt PENDING且未过期，且无SECOND_PARTY confirmation。
- single-use semantic：SECOND_PARTY confirmation存在或attempt settled后，challenge不能作为新的business operation再次使用；same idempotency replay只回读原operation authoritative outcome。
- **decoy**：hidden business failure MUST 使用同一 fixed-width serializer / authenticated-envelope shape 生成 192-char base64url material，但该 material不得解析到live attempt。valid/decoy不得有 intentionally designed fast/slow discriminator；不要求证明绝对 constant-time network behavior，但不得故意通过不同业务分支、不同serializer或人工 fast/slow path 创建明显 timing oracle。confirmer side统一404、零mutation。
- challenge possession不等于identity proof，必须与独立confirmer authentication + human recognition + target confirmation共同成立。
- Decision A：authenticated candidate 主动把 current valid challenge 实时 relay 给 collusive onsite presenter 的场景不在 V1 抵抗范围；这不改变上述 protocol integrity 与 confirmer responsibility。

---

## D-4 Confirmation 持久化

### D-4.1 表定义（Plan 冻结）

```sql
CREATE TYPE binding_confirmation_kind AS ENUM ('CANDIDATE', 'SECOND_PARTY');
CREATE TYPE binding_confirmer_authority AS ENUM ('GUARDIAN', 'FAMILY_MANAGER');

CREATE TABLE binding_confirmations (
  id                      uuid PRIMARY KEY DEFAULT uuidv7(),
  attempt_id              uuid NOT NULL REFERENCES binding_attempts(id) ON DELETE RESTRICT,
  kind                    binding_confirmation_kind NOT NULL,
  actor_pending_context_id uuid REFERENCES binding_pending_contexts(id) ON DELETE RESTRICT,
  actor_account_id        uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  actor_person_id         uuid REFERENCES persons(id) ON DELETE RESTRICT,
  authority               binding_confirmer_authority,
  target_confirmed        boolean NOT NULL,
  candidate_recognized    boolean NOT NULL,
  statement_version       text NOT NULL,
  recorded_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT binding_confirmation_one_per_kind UNIQUE (attempt_id, kind),
  CONSTRAINT binding_confirmation_candidate_shape CHECK (
    kind <> 'CANDIDATE'
    OR (
      actor_pending_context_id IS NOT NULL
      AND actor_account_id IS NULL
      AND actor_person_id IS NULL
      AND authority IS NULL
      AND target_confirmed = true
      AND candidate_recognized = false
      AND statement_version = 'candidate-binding-v1'
    )
  ),
  CONSTRAINT binding_confirmation_second_party_shape CHECK (
    kind <> 'SECOND_PARTY'
    OR (
      actor_pending_context_id IS NULL
      AND actor_account_id IS NOT NULL
      AND actor_person_id IS NOT NULL
      AND authority IS NOT NULL
      AND target_confirmed = true
      AND candidate_recognized = true
      AND statement_version = 'second-party-recognition-v1'
    )
  )
);
```

### D-4.2 为何单表

- candidate / second-party 共享同一 attempt、同一一致性约束、同一 append-only 语义；单表使 `UNIQUE(attempt_id, kind)` 直接阻止重复确认与跨 attempt 复用。
- 不为未来通用 attestation 平台预留 provider、credential、claim、policy 等抽象。
- 不为 rejection 建 confirmation 行：拒绝 / 取消是 attempt 的 `terminal_reason`，由 audit 记录 actor 与结果；`binding_confirmations` 只保存 affirmative 历史事实。

### D-4.3 可变性 / 历史 / replay

| 维度 | 决定 |
|---|---|
| append-only | `xiaoshuyin_app` 只授予 `SELECT, INSERT`；`BEFORE UPDATE OR DELETE` trigger 抛异常 |
| actor | candidate 用 `actor_pending_context_id`；second party 用 `actor_account_id` + `actor_person_id` + `authority` |
| confirmation authority | `GUARDIAN` / `FAMILY_MANAGER`；由 Gate 2 当前事实重新判定，不信任客户端 |
| timestamp | DB `now()`；不接受客户端时间 |
| attempt association | `attempt_id` FK + `UNIQUE(attempt_id, kind)`；跨 attempt 复用被结构阻止 |
| invalidation / historical state | confirmation 不删除、不覆盖；若 gate 失效，attempt 转 `TERMINAL`，confirmation 历史保留 |
| replay | 同一 attempt 同 kind 的 `INSERT ... ON CONFLICT DO NOTHING`；不追加第二行 audit；返回 authoritative state |

---

## D-5 Operation-level idempotency

### D-5.1 表定义（Plan 冻结）

```sql
CREATE TYPE binding_operation_scope AS ENUM ('CANDIDATE_CONTEXT', 'ACCOUNT');
CREATE TYPE binding_operation_command AS ENUM (
  'BOOTSTRAP', 'CANDIDATE_DECISION', 'SECOND_PARTY_DECISION'
);

CREATE TABLE binding_operation_keys (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  scope_kind      binding_operation_scope NOT NULL,
  scope_key       text NOT NULL CHECK (length(scope_key) BETWEEN 16 AND 128),
  command_type    binding_operation_command NOT NULL,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_hash    text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  attempt_id      uuid REFERENCES binding_attempts(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT binding_operation_unique
    UNIQUE (scope_kind, scope_key, command_type, idempotency_key)
);
```

### D-5.2 Scope

| 命令 | scope_kind | scope_key | 说明 |
|---|---|---|---|
| `BOOTSTRAP` | `CANDIDATE_CONTEXT` | `sha256hex("bootstrap:v1:" + (invitation_participation_id OR "unresolved:" + sha256hex(invitationToken)) + ":" + candidate_identity_digest)` | 在正式 Account 之前稳定；invalid invitation 用 token hash 代替 id，不存 token 明文 |
| `CANDIDATE_DECISION` | `CANDIDATE_CONTEXT` | `binding_pending_contexts.id` | 同一 context 的同一 key 收敛 |
| `SECOND_PARTY_DECISION` | `ACCOUNT` | `actor.accountId` | 已认证 confirmer account |

**不存储 `response_body` / `response_status`**：binding attempt 的 authoritative state 会合法推进（PENDING → COMMITTED / TERMINAL）。若冻结首次响应，会产生 `PENDING forever` / `RETRYABLE forever`，违反 005 §5.5 与 M4-M01。Replay 必须重新读取 attempt 的当前 authoritative outcome。

### D-5.3 幂等矩阵（冻结行为）

| 场景 | 行为 |
|---|---|
| same key + same payload（未 settled） | 返回当前 attempt 状态；无重复副作用；不创建第二 attempt / 第二 confirmation / 第二次 commit |
| same key + same payload（已 settled） | 返回历史 settled outcome；不重新执行 commit；不改 outcome |
| same key + different payload | 409 `IDEMPOTENCY_PAYLOAD_MISMATCH`；不改原 attempt / 原结果 |
| `SECOND_PARTY_DECISION` same key、pairing challenge A→B | canonical request hash MUST覆盖 `SHA-256(exact received pairingChallenge ASCII bytes)` 与全部 decision fields；192-char unpadded base64url 已是唯一 canonical external representation，禁止 decode→re-encode 或其它别名 canonicalization。key已map A而new issuance/challenge B产生不同bytes/digest → 409 fail-closed；B零mutation；existing operation.attempt_id仍authoritative A |
| same key concurrent | 事务级 advisory lock（`pg_advisory_xact_lock(hashtextextended(scope, key))`）+ 唯一约束；第二个等待后重读，只产生一个业务结果 |
| different key + same semantic operation，已有 PENDING attempt | 收敛到同一 attempt（部分唯一索引 + `SELECT ... FOR UPDATE`）；不创建第二个 live attempt |
| different key + same semantic operation，旧 attempt terminal 且 invitation valid | 允许 new attempt；new attempt 是 new identity；旧 attempt replay 仍返回旧结果 |
| replay after COMMITTED | 返回历史 COMMITTED；bootstrap replay 的 body 为 `{ binding:"COMMITTED" }`（D-10.2）；不 re-execute、不 revive invitation、不恢复 participation accept、不重建 authorization；不追加业务 audit 行 |
| replay while PENDING | exact duplicate 无重复副作用（D-3.4 允许的新 transport context 行不属于业务副作用）；新的合法 confirmation / gate re-evaluation 可推进同一 attempt；推进不是 replay |
| retry after RETRYABLE | retry / read-back 收敛到 authoritative outcome（PENDING / COMMITTED / TERMINAL）；不永久返回 RETRYABLE；不 double commit |
| retry after TERMINAL | 返回历史 TERMINAL；不重开同一 attempt；new attempt 需 invitation valid + 业务政策允许 |
| concurrent same-key | 只产生一个业务结果；其余 replay；不重复 confirmation / commit / audit |

### D-5.4 operation key 与 attempt identity 的边界

- `binding_operation_keys.attempt_id` 可以为 NULL（Gate 1 阻断 / invalid invitation 的 bootstrap）；一旦绑定 attempt，映射不可改。
- operation key 不表达 attempt 状态；attempt state 只在 `binding_attempts.state`。
- replay 的 attempt 选择来自 existing operation 的 **authoritative `attempt_id`**，不是当前 URL、latest attempt 或 same-triple lookup。
- `SECOND_PARTY_DECISION` canonical request hash MUST覆盖 `SHA-256(exact received pairingChallenge ASCII bytes)` 与全部decision fields。因为 external representation 唯一固定为 192-char unpadded base64url，same bytes → same digest；rotation/new issuance → different bytes → different digest。challenge解析出的exact attempt必须与existing operation.attempt_id一致。old key A + new challenge B = 409 `IDEMPOTENCY_PAYLOAD_MISMATCH`；B不得被读取后推进、确认、terminalize或commit。same-key / same-request replay A 始终只回读 A。

---

## D-6 Account ↔ Person Phase C commit

### D-6.1 冻结 SQL 顺序（同一事务）

```text
BEGIN
  SELECT attempt FROM binding_attempts WHERE id = $attempt FOR UPDATE
  SELECT context FROM binding_pending_contexts WHERE id = $context FOR UPDATE
  -- Gate 2 current-state check MUST 与最终 binding mutation 共享 concurrency-safe consistency boundary（D-8.4）
  -- 1. P1 仍存在且 account_id 仍为 NULL
  -- 2. P1 仅属于 target family
  -- 3. age / guardian / consent / compliance 当前值通过
  -- 4. invitation 仍 valid
  -- 5. 两份 affirmative confirmation 属于同一 attempt
  -- 6. confirmer authority 当前仍成立
  -- 7. candidate account 冲突检查
  INSERT INTO accounts (wechat_openid, session_epoch)
    VALUES ($openid, 0)
    ON CONFLICT (wechat_openid) DO NOTHING
    RETURNING id
  -- 若未插入：SELECT id FROM accounts WHERE wechat_openid = $openid FOR UPDATE
  -- 若该 account 已绑定 person：!= P1 → TERMINAL IDENTITY_CONFLICT；== P1 → 只可能已 committed，见 D-6.3
  UPDATE persons
    SET account_id = $accountId, updated_at = now()
    WHERE id = $p1 AND account_id IS NULL
  -- rowCount 必须 = 1
  UPDATE binding_attempts
    SET state = 'COMMITTED', committed_account_id = $accountId, settled_at = now()
    WHERE id = $attempt AND state = 'PENDING'
  -- rowCount 必须 = 1
  UPDATE binding_pending_contexts
    SET committed_account_id = $accountId,
        openid_ciphertext = NULL, openid_nonce = NULL, openid_tag = NULL
    WHERE attempt_id = $attempt
  -- scrub 该 attempt 全部 transport contexts，不只当前 context
  INSERT INTO identity_binding_audit_events (... event_type='BINDING_COMMITTED' ...)
COMMIT
```

### D-6.2 不允许出现的中途状态

- Account 创建成功但 `persons.account_id` 未更新：同一事务，失败即回滚。
- `persons.account_id` 已更新但 attempt 仍 PENDING：`UPDATE binding_attempts` 必须同事务且 rowCount = 1。
- attempt COMMITTED 但 audit 未写：audit 同事务，失败即回滚。
- 任何 `INSERT INTO persons`：006 代码中不存在；P1 已存在。
- 任何 `INSERT INTO accounts` 在 Phase A / Phase B：只在 Phase C commit 事务内。

### D-6.3 冲突处理

| 观察 | 结果 |
|---|---|
| `persons.account_id` 对 P1 已非空 | `TERMINAL` `TARGET_ALREADY_BOUND`（除非本 attempt 已 COMMITTED，则返回历史 COMMITTED） |
| 已存在 openid 的 Account 已绑定其他 Person | `TERMINAL` `IDENTITY_CONFLICT` |
| 已存在 openid 的 Account 未绑定 Person | 复用该 Account；继续 commit |
| `UPDATE persons ... WHERE account_id IS NULL` rowCount = 0 | `TERMINAL` `CONCURRENCY_LOSER` / `TARGET_ALREADY_BOUND`（按当前读取判定） |
| `UPDATE binding_attempts ... WHERE state='PENDING'` rowCount = 0 | 读取 authoritative state；若已 COMMITTED 返回历史；若 TERMINAL 返回历史 |

**Account status 边界**：`accounts.status` 属 Slice 1 事实；006 不新增 `DISABLED` 语义。existing account 按 openid 复用与普通登录一致；若 Slice 1 未来增加 status enforcement，006 跟随，不自行定义 disabled-account policy。

### D-6.4 exactly-once 的数据库保证

- `persons.account_id UNIQUE`：一个 Account 不能对应两个 Person；一个 Person 不能绑定两个 Account。
- `accounts.wechat_openid UNIQUE`：一个 openid 只有一个 Account。
- `UPDATE persons ... WHERE account_id IS NULL`：条件更新，影响行数 ≤ 1；第二个 attempt 不可能覆盖。
- `UPDATE binding_attempts ... WHERE state='PENDING'`：条件更新，影响行数 ≤ 1。
- P1 / attempt / account 行锁继续承担 binding / account 收敛；另按 F-01 建立 Gate2 authoritative facts 与 binding mutation 的 concurrency-safe consistency boundary。Plan 不预设唯一锁序 / SQL；不得用“先 SELECT current consent，稍后只锁 Person”声称满足 current-state。
- 事务隔离级别：`READ COMMITTED` + 上述行锁 / 条件更新 / 唯一约束即可；不使用 `SERIALIZABLE`，不依赖应用层锁。

---

## D-7 并发收敛与数据库层最终保证

### D-7.1 选定机制（只此一套）

1. **live attempt 唯一**：部分唯一索引 `binding_attempts_live_key`，`WHERE state='PENDING'`。
2. **行锁**：commit 事务对 attempt、P1、account 执行 `FOR UPDATE`。
3. **条件更新**：P1 `account_id IS NULL`、attempt `state='PENDING'`。
4. **唯一约束**：`persons.account_id UNIQUE`、`accounts.wechat_openid UNIQUE`。
5. **不采用**：advisory lock 作为业务收敛（只用于同 key 幂等串行化）、SERIALIZABLE、进程内锁、永久三元组唯一。

### D-7.2 必须证明的并发结果

| 竞争 | 结果 | 数据库落点 |
|---|---|---|
| 两个请求同时绑定同一 Account | 至多一个 commit；Account 不会对应两个 Person | `persons.account_id UNIQUE` + account 行锁 |
| 两个请求同时认领同一 P1 | 至多一个 commit；另一端 TERMINAL | P1 行锁 + `UPDATE ... WHERE account_id IS NULL` |
| 同一 invitation 被重复使用 | 同一 attempt 幂等收敛；不重复 commit | 部分唯一索引 + operation key |
| candidate / second-party confirmation 并发 | 两份确认可先后到达；只有全部成立 + Gate 2 通过才 commit | attempt 行锁 + `UNIQUE(attempt_id, kind)` |
| commit 与 retry 并发 | 只允许一个 commit；另一方收敛同一 settled outcome | attempt 行锁 + 条件更新 |
| 两个不同 Account 同时认领同一 P1 | `successful commits ∈ {0,1}`；另一个 TERMINAL | P1 行锁 + 条件更新 |
| 同一 Account 同时匹配两个 Person | 至多一个 binding；另一个 IDENTITY_CONFLICT | account 行锁 + `persons.account_id UNIQUE` |

### D-7.3 不变量证明

```text
successful commits ∈ {0, 1}
binding increase ≤ 1
Person increment = 0
no double commit
no duplicate confirmation side effect
settled replay stable
new attempt after terminal remains possible
```

- `Person increment = 0`：006 没有任何 `INSERT INTO persons`；P1 由 Slice 1 预先存在。
- `binding increase ≤ 1`：P1 的 `account_id` 条件更新只有一个事务能成功；`persons.account_id` 唯一。
- `new attempt after terminal`：部分唯一索引只约束 PENDING；terminal 行不阻塞插入。
- `settled replay stable`：`state` 只能从 PENDING 转出；COMMITTED / TERMINAL 没有反向更新路径。
- `no double commit`：attempt 条件更新 + P1 条件更新在同事务；第二个事务 rowCount = 0。

### D-7.4 明确不做

- 不声明 `(P1, identity, invitation)` 永久全局唯一。
- 不把「同一三元组至多一个 live attempt」写成产品语义；它只是 Plan 的并发收敛机制。
- 不用 advisory lock 作为跨 attempt 的业务锁；advisory lock 只用于同一 operation key 的并发串行化。

---

## D-8 Gate 1 / Gate 2 执行与 Age / Pre-gate Matrix

### D-8.1 复用现有事实源

| 判定输入 | 来源 | 复用方式 |
|---|---|---|
| P1 是否存在 | `persons` | `SELECT id FROM persons WHERE id = $p1` |
| P1 是否属于目标 Family 且只有一个 Family | `family_members` | `SELECT family_id FROM family_members WHERE person_id = $p1`；必须恰好 1 行且 `family_id = target_family_id` |
| age_band / minor_mode / guardian_person_id / guardian_consent_record_id / guardian_consent_version | `person_compliance_profiles` | 直接读取；不推断、不补值 |
| guardian consent 当前有效 | `consent_records` + `packages/compliance/src/age-gate.ts` | 复用 `assertMinorProcessingAllowed` 的完整判定（decision / bound_person_id / notice_hash / guardian_person_id） |
| current notice hash | `packages/compliance/src/notices.ts` | 复用；不新增 notice |
| Family management actor | `families.created_by_person_id` | Slice 1 D-2 的 V1 管理主体；不引入 manager 角色表 |
| applicant / candidate Account 冲突 | `accounts` + `persons.account_id` | 先按 openid 读取 candidate Account；再用 purpose-scoped policy `persons_binding_candidate_account_read`（D-13.3）只读取该 Account 绑定的 Person；绑定到非 P1 → Gate 1 `IDENTITY_CONFLICT`；candidate-facing 仍为 generic |

**不新增**：`compliance_feature_policies`、`privacy_impact_assessments`、`regulatory_release_evidence`、guardian policy、Consent 类型。V1 baseline 中不存在这些表；006 只执行现有事实能表达的「applicable Compliance gate」。若未来新增 feature policy，由对应 Slice 扩展 Gate，006 不预造。

### D-8.2 `evaluateBindingGate`

**包边界（防止 `domain ↔ compliance` 循环依赖）**：`packages/compliance` 依赖 `packages/domain`，因此 `packages/domain` MUST NOT 反向 import `@xiaoshuyin/compliance`。Gate 判定分两层：

1. **domain pure matrix**（`packages/domain/src/identity-binding-gate.ts`）：不读 DB、不 import compliance；输入是已读取的 facts + `minorGate` 结果。
2. **app composition**（`apps/server/api/src/identity-binding/gate.ts`）：读取 profile / consent，调用 Slice 1 `assertMinorProcessingAllowed`，再把结果传入 domain pure matrix。

```ts
type BindingGateInput = {
  stage: 'GATE_1' | 'GATE_2';
  targetPersonId: string | null;
  targetFamilyId: string | null;
  targetAgeBand: AgeBand | null;
  guardianPersonId: string | null;
  familyCreatedByPersonId: string | null;
  membershipFamilyIds: string[];       // P1 当前 membership；用于 multi-family BLOCK
  invitation: InvitationResolution;    // valid | terminal-unusable + P1 + target family
  candidateAccountId: string | null;
  confirmer: { accountId: string; personId: string } | null;
  minorGate: 'ALLOW' | 'BLOCK' | 'NOT_APPLICABLE'; // app 层调用 assertMinorProcessingAllowed 的结果
};

type BindingGateResult =
  | { decision: 'PASS'; ageBand: AgeBand; authority: 'GUARDIAN' | 'FAMILY_MANAGER' | null }
  | { decision: 'BLOCK'; reason: BindingTerminalReason };
```

执行顺序（两阶段完全相同，Gate 2 额外复核）：

1. invitation 必须 `valid`；否则 `INVITATION_TERMINAL`（Gate 1 / Gate 2 均适用）。
2. P1 必须存在；否则 `IDENTITY_CONFLICT`。
3. P1 membership 恰好 1 行且等于 target family；否则 `MULTI_FAMILY_BLOCK`。
4. 读取 current profile：
   - 无 profile → `COMPLIANCE_BLOCKED`
   - `ADULT` → `AGE_BAND_ADULT_UNSUPPORTED`
   - `UNKNOWN` → `AGE_BAND_UNKNOWN_BLOCKED`
   - `UNDER_14`：`guardian_person_id` 非空；`assertMinorProcessingAllowed` PASS；否则 `GUARDIAN_MISSING` / `GUARDIAN_CONSENT_INVALID` / `COMPLIANCE_BLOCKED`
   - `MINOR_14_17`：`assertMinorProcessingAllowed` PASS（不要求 UNDER_14 guardian consent）；否则 `COMPLIANCE_BLOCKED`
5. Gate 2 额外：
   - attempt 未过期；否则 `ATTEMPT_EXPIRED`
   - candidate confirmation 存在；否则不 commit（PENDING，不是 TERMINAL）
   - second-party confirmation 存在（commit 触发时）；否则不 commit（PENDING）
   - confirmer 当前 authority 仍成立；否则 `WRONG_CONFIRMER`
   - P1 `account_id IS NULL`；否则 `TARGET_ALREADY_BOUND`
   - candidate Account 若存在且已绑定其他 Person → `IDENTITY_CONFLICT`
6. `verified_source` 永不参与 guardian authority；`family_members` 永不用于推导 guardian。

### D-8.3 Gate 1 先于任何 P1-specific processing

- 在 Gate 1 PASS 前，bootstrap 不得创建 attempt、不得写 candidate confirmation、不得请求 second-party recognition、不得展示 P1 信息。
- Gate 1 失败时：pending context 仍可存在（无 attempt、无 invitation id、无 P1 id），审计记录 gate1 blocked；response 与 PENDING 完全一致。
- Gate 1 通过后、attempt 创建的同一事务内才写 `attempt_id` 与 `invitation_participation_id` 到 context。

### D-8.4 Gate 2 current-state + concurrency contract

- Gate 2 每次 commit 都重新读取 current profile / consent / guardian / membership / invitation / confirmer authority / P1 binding / candidate-account conflict；不复用 Gate 1 snapshot。
- fresh SELECT 本身不充分。Gate2 check 与最终 binding mutation必须共享 H-02 concurrency-safe linearization / validation boundary。
- boundary至少覆盖 profile / age-band、guardian relationship、Consent、Family membership / confirmer authority、invitation current state、P1 binding conflict、candidate-account conflict。
- Implement可用 row lock、version/optimistic validation、advisory serialization、isolation或其它 DB-safe等价机制；但必须在真实 xiaoshuyin_app runtime role下观察到锁/序列化/版本检测实际生效。SQL中出现 FOR UPDATE、或 SELECT FOR UPDATE得到0行，不构成验收。
- invalidating change在线性化上先成立 → binding mutation=0、attempt不得COMMITTED；terminal audit/cleanup必须完整。
- barrier matrix必须逐类覆盖 profile/age-band、consent、guardian、membership/authority、invitation、P1 binding conflict，并对 candidate-account conflict做同等并发/版本 proof。
- invitation production adapter barrier只有 Slice 4 runtime可用后才可最终 VERIFIED；fixture/port proof只能标 contract-level。

### D-8.5 Candidate AFFIRM dynamic eligibility

Candidate AFFIRM是Phase B推进点，不得沿用bootstrap时的eligibility snapshot。每次AFFIRM在写candidate confirmation、发行valid pairing challenge之前，必须current-read并re-evaluate：P1、唯一target Family membership、profile/age band、guardian、required/applicable Consent + Compliance、invitation、P1 binding conflict、candidate identity/account conflict。

- still eligible → candidate confirmation insert-or-reuse，然后发行D-3.5 valid pairing challenge。
- no longer eligible → attempt authoritative TERMINAL settlement；不得新增candidate confirmation；不得发行可解析valid challenge；candidate返回D-10.2 fixed AFFIRM shape + decoy challenge。
- terminal settlement = exactly-one audit + attempt-scope OpenID scrub；不得留下stale PENDING等待条件恢复。
- Gate2仍必须再次current re-evaluate；AFFIRM recheck不替代Gate2。

---

## D-9 Second-party authorization 与确认者发现

### D-9.1 确认主体（唯一矩阵投影）

| age_band | confirmer | 禁止 |
|---|---|---|
| `UNDER_14` | 当前 `guardian_person_id` 对应的已认证 Account / Person | Family manager fallback；membership 推导；`verified_source` 推导 |
| `MINOR_14_17` 有 guardian | 当前 `guardian_person_id` 对应的已认证 Account / Person | Family manager 替代 |
| `MINOR_14_17` 无 guardian | `families.created_by_person_id` 对应的已认证 Account / Person | 仅凭管理权限自动批准；membership 推导 |
| `ADULT` / `UNKNOWN` | 不存在 | 任何确认 |

### D-9.2 确认者发现与 exact pairing

- GET /api/v1/identity-bindings/pending?personId=P1可以保留为已授权confirmer的最小operational view，仅返回live PENDING attempts的 attemptId / createdAt / expiresAt；不返回candidate nickname、openid、age、guardian、consent、Family或Case信息。
- pending list不得用于recognition pairing、不得作为identity proof、不得作为second-party decision selector。S0/S1 delta、createdAt matching、唯一pending attempt默认选择全部禁止。
- pairing唯一入口：candidate在D-8.5合法AFFIRM后从自己的candidate response获得D-3.5 pairingChallenge，并在现场主动展示/传递给亲自辨认他的confirmer。
- confirmer独立登录后，把现场被辨认candidate所展示的challenge提交给 POST /api/v1/identity-bindings/pairing-decision。服务端验证challenge并解析 exact context / authenticated identity / attempt / P1 / invitation；caller不提交attemptId。
- pending list authorization仍使用 IDENTITY_BINDING_CONFIRMER_LIST；未授权 / P1不存在 / P1多Family / 非目标Family统一404。guardian不要求Family member；manager必须是families.created_by_person_id。
- attemptId、invitation token、pendingContextToken、pairingChallenge任一单独存在都不是identity proof。pendingContextToken仍只属于candidate，禁止分享给confirmer。

### D-9.3 独立认证

- confirmer 路由只接受 `Authorization: Bearer` 正常会话；显式拒绝 `X-Binding-Context`。
- candidate 会话不能调用 confirmer 路由；candidate 不能代持。
- AI / 系统不得代确认；confirmation 只能由已认证 actor 的显式 request 产生。

### D-9.4 确认命题

- AFFIRM 只有一个合法语义：`targetConfirmed=true` AND `candidateRecognized=true` AND `confirmationVersion=second-party-recognition-v1`；三者全部 required。
- REJECT 也只有一个合法语义：`targetConfirmed=false` AND `candidateRecognized=false` AND `confirmationVersion=second-party-recognition-v1`；三者全部 required。REJECT + true/true、true/false、false/true 均为 schema/semantic invalid → 422，不得产生 attempt mutation。
- 无法独立辨认、无法确认眼前 candidate 正在使用/展示其本人当前 authenticated binding session material、或不愿作出完整 affirmative proposition → confirmer 必须选择上述 canonical REJECT；不得以 Family membership / manager role / verified_source / 昵称自动 confirm。
- **不允许 second-party 在 affirmative 后撤销**：一旦 `binding_confirmations (SECOND_PARTY)` 已存在，后续 REJECT → `409 BINDING_STATE_CONFLICT`，不改变 attempt，不删除 / 覆盖 confirmation。Candidate 在 PENDING 期间仍可 REJECT / CANCEL；attempt 转 TERMINAL，但已记录的 candidate confirmation 不被删除。该决定不使用 Spec 保留给 Plan 的「commit 前明确撤销」选项，保持 affirmative 为历史事实。
- confirmation 不等于 Consent；不写 `consent_records`。

---

## D-10 Runtime API / command surface

### D-10.1 端点（恰好 6 条）

| # | Method / Path | 使用方 | Auth | 幂等 |
|---|---|---|---|---|
| 1 | POST /api/v1/identity-bindings/bootstrap | candidate | no session；WeChat code + invitationToken | BOOTSTRAP |
| 2 | POST /api/v1/identity-bindings/candidate-decision | candidate | X-Binding-Context | CANDIDATE_DECISION |
| 3 | GET /api/v1/identity-bindings/status | candidate | X-Binding-Context | read |
| 4 | POST /api/v1/identity-bindings/session | candidate | X-Binding-Context | read + session exchange |
| 5 | GET /api/v1/identity-bindings/pending?personId=P1 | authorized confirmer | Bearer | read；not pairing selector |
| 6 | POST /api/v1/identity-bindings/pairing-decision | authorized confirmer | Bearer | SECOND_PARTY_DECISION |

不增加第7个API。原 POST /api/v1/identity-bindings/:attemptId/decision 被 pairing-decision 取代；attemptId不再由confirmer client选择。

明确不实现 participant / invitation creation / Case / Evidence / UI / notification端点。

### D-10.2 请求 / 响应

#### 1. Bootstrap

Bootstrap request、Case B REUSED、COMMITTED replay语义保持不变。generic仍为 { binding: NOT_COMPLETED, pendingContextToken: opaque }。不得返回attemptId / P1 / Family / gate reason。普通POST /api/v1/auth/wechat完全不改。

#### 2. Candidate decision

AFFIRM request：decision=AFFIRM、confirmationVersion=candidate-binding-v1、idempotencyKey required。

AFFIRM response：所有hidden business outcomes使用固定shape { binding: NOT_COMPLETED, pairingChallenge: opaque }。

- eligible live attempt → pairingChallenge是D-3.5 valid candidate-presented challenge。
- dynamic ineligible / terminal / hidden business failure → 同格式decoy challenge；不得解析到live attempt。
- AFFIRM omitted/null/wrong confirmationVersion → 422。
- REJECT/CANCEL必须omit confirmationVersion；显式null或present value → 422；response仍为 { binding: NOT_COMPLETED }。
- valid challenge只能在D-8.5 current eligibility PASS后发行；不得泄露P1 / identity / attempt / invitation。
- same candidate AFFIRM + same idempotency key + same issuance MUST replay the exact original 192-character pairingChallenge bytes；不得重新随机生成。challenge replay不得延长expiry；expired后只有仍合法attempt/context并重新current eligibility PASS才可创建new issuance并取得different bytes的新valid challenge。
- 401只用于binding context credential本身无效/过期；hidden business eligibility仍是200 fixed shape。

#### 3. Status

返回 { binding: NOT_COMPLETED }，或committed后 { binding: COMMITTED }。status如果访问时materialize context/attempt expiry，必须执行M-03 / D-14 cleanup + audit，不再被定义为纯read。

#### 4. Session exchange

保持原合同：只有attempt COMMITTED且context identity一致才返回ordinary session；否则200 generic。不得在此创建或改变binding。

#### 5. Confirmer pending list

返回minimal attempts，仅operational visibility；不得用于pairing target selection。authorized无pending → 200空数组；unauthorized/invalid target → 404 generic。

#### 6. Pairing decision

Request 是 decision-discriminated strict union：

- **AFFIRM**：personId、pairingChallenge、decision=AFFIRM、targetConfirmed=true、candidateRecognized=true、confirmationVersion=second-party-recognition-v1、idempotencyKey；全部 required，additional fields forbidden。
- **REJECT**：personId、pairingChallenge、decision=REJECT、targetConfirmed=false、candidateRecognized=false、confirmationVersion=second-party-recognition-v1、idempotencyKey；全部 required，additional fields forbidden。
- pairingChallenge 必须是 exact 192-character unpadded base64url representation；其它长度、padding、alphabet或格式 → 422 structural validation。

Contract：
- server在authenticated confirmer context下解析personId authority，再验证challenge，并从challenge解析 exact context/identity/attempt/P1/invitation/current issuance；personId必须等于challenge-bound P1。
- AFFIRM / REJECT semantic booleans 由上述 strict union唯一表达；REJECT不能携带 true/true 或任何 mixed boolean combination。
- valid challenge + authority + current attempt consistency才允许写second-party confirmation或terminal decision。
- invalid / expired / consumed / mismatched challenge、wrong P1/invitation/candidate/attempt、unauthorized confirmer统一404 BINDING_NOT_FOUND，零mutation。
- same operation key + exact same request replay读取mapped authoritative attempt outcome；same key + different challenge/payload → 409 IDEMPOTENCY_PAYLOAD_MISMATCH。
- valid authorized operation response仍为 state=PENDING | COMMITTED | TERMINAL。
- same challenge concurrent different-key最多一个business effect；不得第二confirmation或double commit。

### D-10.3 Error envelope

沿用Slice 1 error envelope。candidate business failure统一200 generic；confirmer pairing invalidity统一404。409只用于idempotency mismatch或authorized state conflict；422只用于schema/semantic validation。

WECHAT_AUTH_FAILED 401只表示真实code2session failure；BINDING_CONTEXT_INVALID 401只表示candidate context credential无效/过期。

### D-10.4 Auth plugin 修改边界

- bootstrap无ordinary session。
- candidate-decision / status / session只接受binding-context semantics；普通Bearer不能替代。
- pending / pairing-decision只接受独立ordinary Bearer confirmer session；同时带candidate X-Binding-Context必须拒绝。
- 普通 /api/v1/auth/wechat schema、path、behavior不变；不得新增mode或hidden invite switch。

---

## D-11 Anti-enumeration response matrix

### D-11.1 Candidate-facing matrix（冻结）

| surface / internal fact | HTTP | Body |
|---|---|---|
| bootstrap hidden failure / Gate1 blocked / Case C PENDING | 200 | NOT_COMPLETED + pendingContextToken |
| candidate AFFIRM + eligible live attempt | 200 | NOT_COMPLETED + pairingChallenge（valid） |
| candidate AFFIRM + dynamic ineligible / terminal / hidden failure | 200 | 同shape NOT_COMPLETED + pairingChallenge（decoy） |
| candidate REJECT / CANCEL | 200 | NOT_COMPLETED |
| status / session before commit | 200 | generic NOT_COMPLETED |
| Case B correct account | 200 | REUSED success |
| committed candidate | 200 | COMMITTED / session success |

对同一个candidate-selected AFFIRM action，valid与decoy的HTTP status、key set、格式/长度类别、headers、next-action不得成为hidden eligibility oracle。challenge不得含可读P1/attempt/identity/invitation。

### D-11.2 Confirmer-facing matrix

| internal fact | HTTP | Body |
|---|---|---|
| unauthenticated | 401 | generic auth error |
| unauthorized confirmer / P1 unavailable | 404 | BINDING_NOT_FOUND |
| invalid / expired / consumed / mismatched pairing challenge | 404 | same BINDING_NOT_FOUND |
| authorized pending-list | 200 | minimal attempts；not pairing selector |
| valid pairing AFFIRM / REJECT | 200 | { state } |
| same idempotency key + different request/challenge | 409 | IDEMPOTENCY_PAYLOAD_MISMATCH |

404不得包含person/family/age/guardian/consent/attempt/challenge-validity reason。

### D-11.3 Timing / side-channel 边界

Bootstrap继续normalized pipeline，不得因invalid invitation/gate reason形成observable early-return差异。Candidate AFFIRM valid/decoy challenge generation也必须共享serializer与response shape。不得fake-query不可信P1、不得人为delay/padding；不宣称密码学constant-time。

---

## D-12 Authorization 扩展

### D-12.1 `authorize()` 目标形状

在 Slice 1 最终 `authorize()`（含 `facts` / object `Resource` 的 remediated 版本）基础上增量扩展：

```ts
export type Action =
  | ...existing
  | 'IDENTITY_BINDING_BOOTSTRAP'
  | 'IDENTITY_BINDING_CANDIDATE_DECIDE'
  | 'IDENTITY_BINDING_STATUS_SELF'
  | 'IDENTITY_BINDING_SESSION_EXCHANGE'
  | 'IDENTITY_BINDING_CONFIRMER_LIST'
  | 'IDENTITY_BINDING_SECOND_PARTY_DECIDE';

export type Purpose = ...existing | 'IDENTITY_BINDING';

export type Resource =
  | ...existing
  | { type: 'BINDING'; attemptId: string | null; personId: string | null };

export type Actor =
  | { kind: 'ACCOUNT'; accountId: string; personId: string }
  | { kind: 'BINDING_CONTEXT'; contextId: string; candidateIdentityDigest: string }
  | { kind: 'WECHAT_CANDIDATE'; candidateIdentityDigest: string };

export interface AuthorizeFacts {
  ...existing;
  targetPersonId: string | null;
  targetFamilyId: string | null;
  targetAgeBand: AgeBand | null;
  guardianPersonId: string | null;
  familyCreatedByPersonId: string | null;
  targetIsFamilyMember: boolean;
}
```

### D-12.2 动作判定

| Action | Actor | 规则 |
|---|---|---|
| `IDENTITY_BINDING_BOOTSTRAP` | `WECHAT_CANDIDATE` | 仅 purpose `IDENTITY_BINDING`；无 Account / Person；否则 DENY |
| `IDENTITY_BINDING_CANDIDATE_DECIDE` | `BINDING_CONTEXT` | resource `BINDING`；context 有效；否则 DENY |
| `IDENTITY_BINDING_STATUS_SELF` | `BINDING_CONTEXT` | 同上 |
| `IDENTITY_BINDING_SESSION_EXCHANGE` | `BINDING_CONTEXT` | 同上；committed 由 domain 再判（authorize 不读 attempt） |
| `IDENTITY_BINDING_CONFIRMER_LIST` | `ACCOUNT` | facts 必须齐全；UNDER_14 → `actor.personId === guardianPersonId`；MINOR 有 guardian → 同上；MINOR 无 guardian → `actor.personId === familyCreatedByPersonId`；ADULT / UNKNOWN → DENY；`targetIsFamilyMember` 必须 true |
| `IDENTITY_BINDING_SECOND_PARTY_DECIDE` | `ACCOUNT` | 同 confirmer list；resource attemptId 由服务端验证 pairingChallenge 后解析，caller不得声明/选择 attemptId |

新增 deny reasons：`BINDING_CONTEXT_INVALID`、`NOT_BINDING_AUTHORIZED_CONFIRMER`、`BINDING_AGE_UNSUPPORTED`、`BINDING_TARGET_INVALID`。

- `authorize()` 仍是纯函数；不读 DB；facts 由 Gate 上下文读取后传入。
- 所有分支 fail-closed：facts 缺失 / null → DENY。
- 不引入 `authorizeBinding()` 第二入口；不引入 generic RBAC / participant role / guardian 自动授权。

### D-12.3 兼容性

- 既有 action / purpose / resource 行为不变；Slice 1 的真实 `authorize()` 已 merge main（`f4ef602`，见 D-22），新增枚举值按其现任 shape（object Resource + facts）增量扩展。
- 普通登录、Family、Consent、Compliance 端点不传 binding facts，行为不变。
- 新增动作必须有 allow / deny 双分支测试。

---

## D-13 RLS 与事务上下文

### D-13.1 新 GUC 与 purpose

| GUC | 设置者 | 用途 |
|---|---|---|
| `app.binding_context_hash` | `withBindingContextTransaction` | pending context 查找 |
| `app.binding_context_id` | `withBindingCommitTransaction` | context 更新（清 ciphertext / 记 committed account） |
| `app.binding_identity_digest` | `withBindingBootstrapTransaction` | candidate identity 过滤 |
| `app.binding_invitation_id` | `withBindingBootstrapTransaction` | invitation 过滤 |
| `app.binding_attempt_id` | `withBindingAttemptTransaction` / commit | attempt 精确过滤 |
| `app.binding_target_person_id` | `withBindingGateTransaction` / commit | P1 过滤 |
| `app.binding_target_family_id` | `withBindingGateTransaction` / commit | target Family 过滤 |
| `app.binding_commit_account_id` | `withBindingCommitTransaction` | `persons.account_id` 提交值校验 |
| `app.binding_candidate_account_id` | `withBindingGateTransaction` / `withBindingCommitTransaction` | 当前 authenticated candidate Account（若 openid 已解析出 Account）；**只**用于 `persons_binding_candidate_account_read` 判定 candidate 是否已绑定其它 Person，不用于任意 person 查询 |
| `app.binding_operation_scope` | operation key 读写 | operation scope 过滤 |

Purpose：`IDENTITY_BINDING_PENDING`、`IDENTITY_BINDING_GATE`、`IDENTITY_BINDING_COMMIT`。

### D-13.2 新表 policy

| 表 | `USING` / `WITH CHECK` |
|---|---|
| `binding_pending_contexts` | `token_hash = app_binding_context_hash()`；commit context：`id = app_binding_context_id()`；attempt-scoped：`attempt_id = app_binding_attempt_id()`，仅 `IDENTITY_BINDING_GATE` / `IDENTITY_BINDING_COMMIT`（供 commit 在不重放 token 的情况下锁定 / 清理该 attempt 的 context） |
| `binding_attempts` | PENDING：`candidate_identity_digest = app_binding_identity_digest() AND invitation_participation_id = app_binding_invitation_id() AND (app_binding_attempt_id() IS NULL OR id = app_binding_attempt_id())`；GATE：`target_person_id = app_binding_target_person_id() AND target_family_id = app_binding_target_family_id()`；COMMIT：`id = app_binding_attempt_id() AND target_person_id = app_binding_target_person_id() AND target_family_id = app_binding_target_family_id()` |
| `binding_confirmations` | 与 attempt 相同的 attempt 可见性；PENDING 通过 `attempt_id = app_binding_attempt_id()`；GATE 通过 target person join；COMMIT 精确 attempt |
| `binding_operation_keys` | `(scope_kind = 'CANDIDATE_CONTEXT' AND app.purpose = 'IDENTITY_BINDING_PENDING' AND scope_key = app_binding_operation_scope()) OR (scope_kind = 'ACCOUNT' AND scope_key = app_account_id()::text)` |
| `identity_binding_audit_events` | `USING (false)`（runtime 不可读）；`WITH CHECK` 要求 purpose ∈ binding purposes 且 target person 为空或匹配 GUC / candidate digest 匹配 |

所有新表 `ENABLE` + `FORCE ROW LEVEL SECURITY`；`xiaoshuyin_app` 非 owner、NOBYPASSRLS。

### D-13.3 对 Slice 1 表的增量 policy（只读 / 精确提交）

| 表 | 新 policy | 语义 |
|---|---|---|
| `persons` | `persons_binding_target_read` | **`FOR SELECT`**；`USING (id = app_binding_target_person_id())`，仅 GATE / COMMIT |
| `persons` | `persons_binding_candidate_account_read` | **`FOR SELECT`**；`USING (account_id = app_binding_candidate_account_id())`，仅 GATE / COMMIT；只用于 authenticated candidate Account 的 `IDENTITY_CONFLICT` 判定 |
| `persons` | `persons_binding_commit_update` | **`FOR UPDATE`**；`USING (id = app_binding_target_person_id() AND account_id IS NULL)`；`WITH CHECK (id = app_binding_target_person_id() AND account_id = app_binding_commit_account_id())`，仅 COMMIT |
| `families` | `families_binding_read` | **`FOR SELECT`**；`USING (id = app_binding_target_family_id())`，仅 GATE / COMMIT |
| `family_members` | `family_members_binding_read` | **`FOR SELECT`**；`USING (person_id = app_binding_target_person_id())`，仅 GATE / COMMIT |
| `person_compliance_profiles` | `pcp_binding_read` | **`FOR SELECT`**；`USING (person_id = app_binding_target_person_id())`，仅 GATE / COMMIT |
| `consent_records` | `consent_binding_read` | **`FOR SELECT`**；`USING (family_id = app_binding_target_family_id() AND bound_person_id = app_binding_target_person_id())`，仅 GATE / COMMIT |

- 新 policy 均为 **permissive append**，不改变既有 policy 语义；只在 binding purpose + 对应 GUC 下生效。所有 intended read-only policy 必须显式 `FOR SELECT`，唯一 Person binding write policy 必须显式 `FOR UPDATE`。
- `family_members` 的 `person_id = target_person_id` 允许读取 P1 的全部 membership，用于 multi-family BLOCK；这些 Family 名称不返回 candidate。
- `persons_binding_commit_update` 需要新增 GUC `app.binding_commit_account_id`。
- 不通过 `app.family_id` / `app.person_id` 建立 binding 上下文；不冒充 P1；pending context 不设置 family scope。
- 不关闭 RLS；不使用 owner / BYPASSRLS 运行时。

### D-13.4 事务 adapter（扩展 `apps/server/api/src/db/tx.ts`）

新增 6 个 thin wrapper（其中 `withBindingTargetTransaction` 是 D-9.2 解析 P1 唯一 Family 所需的最小 target-person-only context），全部复用 `BEGIN/COMMIT/ROLLBACK` + `set_config(..., true)`，不新建 context framework：

1. `withBindingContextTransaction({ tokenHash }, fn)`：`app.binding_context_hash`、purpose `IDENTITY_BINDING_PENDING`。
2. `withBindingBootstrapTransaction({ contextHash, identityDigest, invitationId }, fn)`：上述 + identity / invitation；invitation resolution 后在同一事务内调用 `app.set_binding_gate_context(targetPersonId, targetFamilyId, actorAccountId)` 设置 Gate GUC，再执行 Gate 1 + attempt 创建 + context 关联；不另开事务。
3. `withBindingGateTransaction({ targetFamilyId?, targetPersonId, actorAccountId, candidateAccountId? }, fn)`：target GUCs + `app.account_id = actorAccountId`（**仅已认证 actor**：confirmer；用于 operation key ACCOUNT scope 与 audit actor）；若本次 authenticated candidate 的 Account 已由 openid 解析，则额外设置 `app.binding_candidate_account_id = candidateAccountId`（**仅**用于 D-13.3 的 candidate-account read policy 判定 `IDENTITY_CONFLICT`，不得用于读取 P1 以外任何 Person，不设置 family scope）；purpose `IDENTITY_BINDING_GATE`。`actorAccountId` 与 `candidateAccountId` 语义不同，不得混用：前者是操作者，后者是被认证的 candidate。`targetFamilyId` 未知时由 `withBindingTargetTransaction` 先完成 P1 membership 解析，再在同一事务内设置 family GUC。
3b. `withBindingTargetTransaction({ targetPersonId, actorAccountId }, fn)`：只设置 `app.binding_target_person_id` + `app.account_id` + purpose `IDENTITY_BINDING_GATE`，用于在 `targetFamilyId` 未知时读取 P1 唯一 `family_members`；MUST NOT 读取 profile / consent，不设置 family / person business scope；不得变成任意 person lookup。
4. `withBindingCommitTransaction({ attemptId, targetPersonId, targetFamilyId, contextId, actorAccountId, candidateAccountId?, commitAccountId? }, fn)`：attempt / target / context GUCs；`app.account_id = actorAccountId`（confirmer 审计归因 + account-scope operation key）；若 candidate Account 已知则设置 `app.binding_candidate_account_id`（同一 candidate read policy，只用于 Gate 2 冲突复核）；若 `commitAccountId` 在事务开始前已知则设置 `app.binding_commit_account_id`；若 Account 在事务内创建 / 复用，调用 `app.set_binding_commit_account_id(accountId)` 后再执行 `UPDATE persons`。purpose `IDENTITY_BINDING_COMMIT`。
5. `withBindingAttemptTransaction({ attemptId, identityDigest, invitationId }, fn)`：candidate decision / status 读取。

- 业务代码不得直接 `set_config`；所有上下文通过上述 wrapper。
- `binding_operation_keys` 的 lookup / insert MUST 先调用 `app.set_binding_operation_scope(scopeKey)`；ACCOUNT scope 由调用上下文提供 `app.account_id`，CANDIDATE_CONTEXT scope 要求 purpose `IDENTITY_BINDING_PENDING`。
- `actorAccountId` 为空时不设置 `app.account_id`；不设置 `app.person_id` / `app.family_id`。
- Case B 正确 Account 的 session 签发复用既有 `withAccountTransaction`，不新增 wrapper。

### D-13.5 RLS 验证

- 无上下文：新表 0 行 / 写拒绝；Slice 1 表既有行为不变。
- 错误 Family / 错误 account / 错误 attempt：0 行。
- `persons_binding_candidate_account_read` 只在该 candidate Account GUC 下返回该 Account 绑定的单个 Person；未设置 GUC / 非 binding purpose / 其它 Account → 0 行；不得成为任意 person lookup。
- RLS DB proof 必须 introspect `pg_policy.polcmd`，并用真实 `xiaoshuyin_app` 做 GATE/exact-GUC SELECT positive + UPDATE/INSERT/DELETE negative；只有 COMMIT + exact target / commit-account GUC 下的 `persons_binding_commit_update FOR UPDATE` 可合法 bind。
- H-02额外要求behavioral concurrency proof：read policy为FOR SELECT本身不等于可锁。若chosen implementation依赖row lock，必须证明xiaoshuyin_app实际取得目标lockable rows且并发authoritative mutation按预期等待/冲突；若采用version/optimistic/advisory/isolation，则必须证明对应检测/serialization在runtime role下生效。SELECT FOR UPDATE=0 rows不得被当作linearization success。
- `pg_class.relrowsecurity` / `relforcerowsecurity` = true；`pg_roles.rolbypassrls` = false；owner ≠ app。
- 审计表 runtime `SELECT` 被拒绝；migrator / test admin 可读。

---

## D-14 Transaction / settlement boundary

| 操作 | authoritative transaction requirement |
|---|---|
| Bootstrap | context → invitation/Gate1 → create/converge attempt → link context → audit；settled/pre-attempt replay fresh-context cleanup在response前完成 |
| Candidate AFFIRM | lock/validate context+attempt → D-8.5 current eligibility → candidate confirmation insert/reuse → valid challenge issuance facts；失效则同事务terminal settle + audit + attempt-scope cleanup |
| Candidate REJECT / CANCEL | conditional PENDING→TERMINAL + reason + exactly-one audit + attempt-scope cleanup |
| Pairing decision AFFIRM | verify independent actor + exact challenge + current authority → SECOND_PARTY confirmation → Phase C Gate2/commit；challenge single-use与attempt/confirmation uniqueness共享consistency boundary |
| Pairing decision REJECT | verify exact challenge + authority → authoritative terminal settlement + audit + attempt-scope cleanup |
| Status / context access | 不是永远只读：context expiry至少scrub current context；attempt expiry必须调用唯一terminal settlement path，all-context scrub + audit exactly once |
| Phase C | Gate2 H-02 linearization boundary → Account create/reuse → Person binding → attempt COMMITTED → all-context scrub → committed audit；不得partial success |
| ATTEMPT_EXPIRED | 只有一个settlement primitive/path拥有 PENDING→TERMINAL/ATTEMPT_EXPIRED + reason + exactly-one terminal audit + all-context scrub；caller不得先materialize state再二次terminalize |
| Session exchange | 只读committed facts；事务外签session token；不写binding |

General rules：
- core audit属于settlement transaction；audit write失败 → 业务回滚。
- cleanup失败 → settlement/commit不得报告成功；rollback/failure-injection必须证明无partial binding与无terminal-with-retained-secret。
- repeated/concurrent terminalization通过conditional transition/unique proof收敛：最终一个authoritative terminal audit，cleanup达成。
- M-02 fresh replay context cleanup不得依赖 attempt_id IS NULL 的调用顺序；caller按authoritative outcome选择cleanup scope。
- H-02 Gate2保护以真实runtime-role DB behavior为验收，不以repository helper名或SQL文本为证。

---

## D-15 Audit / provenance

### D-15.1 表定义（Plan 冻结）

```sql
CREATE TABLE identity_binding_audit_events (
  id                          uuid PRIMARY KEY DEFAULT uuidv7(),
  correlation_id              uuid NOT NULL,
  attempt_id                  uuid REFERENCES binding_attempts(id) ON DELETE RESTRICT,
  target_person_id            uuid REFERENCES persons(id) ON DELETE RESTRICT,
  target_family_id            uuid REFERENCES families(id) ON DELETE RESTRICT,
  invitation_participation_id uuid,
  actor_account_id            uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  actor_person_id             uuid REFERENCES persons(id) ON DELETE RESTRICT,
  candidate_identity_digest   text CHECK (candidate_identity_digest IS NULL OR candidate_identity_digest ~ '^[0-9a-f]{64}$'),
  event_type                  text NOT NULL CHECK (event_type IN (
                                'BINDING_BOOTSTRAP_AUTHENTICATED',
                                'BINDING_GATE1_BLOCKED',
                                'BINDING_ATTEMPT_CREATED',
                                'BINDING_CANDIDATE_CONFIRMED',
                                'BINDING_CANDIDATE_REJECTED',
                                'BINDING_CANDIDATE_CANCELLED',
                                'BINDING_SECOND_PARTY_CONFIRMED',
                                'BINDING_SECOND_PARTY_REJECTED',
                                'BINDING_COMMITTED',
                                'BINDING_TERMINAL',
                                'BINDING_OPERATION_RETRYABLE'
                              )),
  result                      text NOT NULL CHECK (result IN ('PENDING','COMMITTED','TERMINAL','RETRYABLE')),
  terminal_reason             text,
  metadata                    jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  occurred_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX identity_binding_audit_attempt_idx
  ON identity_binding_audit_events (attempt_id, occurred_at DESC);
CREATE INDEX identity_binding_audit_person_idx
  ON identity_binding_audit_events (target_person_id, occurred_at DESC);
CREATE INDEX identity_binding_audit_correlation_idx
  ON identity_binding_audit_events (correlation_id, occurred_at DESC);
```

### D-15.2 记录规则

- `BINDING_GATE1_BLOCKED` 是所有 **Phase B attempt 创建之前**的阻断事件（invalid invitation、Case B mismatch、Gate 1 fail）的统一 security outcome；`terminal_reason` 区分具体原因。
- 成功 / pending / terminal / retryable 的 security-relevant outcome 均写 audit；PENDING 的重复 replay 不写第二条。
- `RETRYABLE` 只写 operation-level 事件：`event_type='BINDING_OPERATION_RETRYABLE'` + `result='RETRYABLE'`；MUST NOT 使用 `BINDING_TERMINAL` 冒充，MUST NOT 改变 attempt state，MUST NOT 把 RETRYABLE 变成 settled outcome；D-14 的 best-effort 例外适用。
- actor 真实：candidate 用 identity digest + context id（不存 openid）；confirmer 用 `actor_account_id` + `actor_person_id`。
- target Person / Family / attempt / result / reason 可追溯；但 **Gate 1 阻断 / Case B mismatch / invalid invitation 发生在 Phase B 之前，audit MUST NOT 记录 `target_person_id` / `target_family_id` / `invitation_participation_id`**，只记录 `correlation_id` + `candidate_identity_digest` + `event_type` + `result` + `terminal_reason`，避免形成 candidate↔P1 business association。Phase B attempt 已存在后的 Gate 2 / terminal / commit audit 才记录 target person / family / attempt。
- 不记录 token、token hash、openid、ciphertext、consent 原文、家长原话、PII。
- 不为 audit FK 创建 Person / Account；`actor_account_id`、`target_person_id` 可空；invalid invitation 时 target 为空。
- append-only：app 只 `INSERT`；无 `SELECT` / `UPDATE` / `DELETE`；`BEFORE UPDATE OR DELETE` trigger 抛异常；migrator / test admin 可读。
- RLS：`WITH CHECK` 要求 purpose ∈ binding purposes；`USING (false)` 阻止 runtime 读取；不削弱其它表 privacy。
- 合法推进（PENDING → COMMITTED / TERMINAL）是新增行，不是改写旧行。

### D-15.3 为什么不是第二套审计框架

- 只有一张表、一组封闭 event_type、一个写入路径（binding runtime）、一个读取路径（migrator / forensic / tests）。
- 没有通用 event bus、subscription、handler、outbox、replay engine。
- 不替代 `business_audit_events`；Slice 1 的 Family / Consent / Member 审计不变。

---

## D-16 Invitation seam 与 Slice 4 dependency

### D-16.1 合同接口

006 定义 consumer port（在 `packages/domain` 或 `apps/server/api/src/identity-binding/invitation-port.ts`）：

```ts
export type InvitationResolution =
  | {
      status: 'VALID';
      participationId: string;
      targetPersonId: string;
      targetFamilyId: string;
      expiresAt: string;
    }
  | { status: 'TERMINAL_UNUSABLE' };

export interface InvitationResolutionPort {
  resolveByToken(tx: pg.PoolClient, invitationToken: string): Promise<InvitationResolution>;
}
```

- `VALID` 只表示 Slice 4 定义的 `pending` 且未过期、token 可用；`TERMINAL_UNUSABLE` 覆盖 not found / expired / declined / withdrawn / accepted（已消费）/ unauthorized invalidation。
- 006 不读取 Case 内容、不读 Case ownership、不写 participation、不创建 invitation。
- 006 不新增 `invitations` 表、不定义 invitation state / token / expiry / cancel / manager revoke。
- `invitation_participation_id` 在 006 表上只是 uuid 引用，**无 FK**；避免对 Slice 4 表存在性、migration 顺序、table ownership 的硬耦合。
- 生产 adapter 必须使用与 006 bootstrap 相同的 DB transaction / `tx` client；不得另开事务或快照缓存。
- 在 Slice 4 runtime 未 merge 时，只提供 **contract-level test double**（内存 fixture），仅用于 domain / runtime 测试；不得写 fake invitation 表 / fake token service / 第二套 lifecycle。

### D-16.2 验证分层

| 层 | 当前可做 | 依赖 |
|---|---|---|
| Contract-level | port 接口、VALID / TERMINAL_UNUSABLE 分支、Gate 1 / Phase B / commit、Case B / C、invitation terminal between gates | 006 自身 + fixture |
| True runtime E2E | 真实 invitation token → bootstrap → binding → Slice 4 accept；active participation 与 binding 联合验收 | **BLOCKED BY SLICE 4 RUNTIME** |

- Tasks 必须把 blocked 项显式标注；不得删除、mock 后宣称 PASS、或修改 Slice 4。
- Slice 4 contract 当前在 `origin/feat/004-case-participant-core`（`a2d82c73b5d134f6559ea9247ee19eda15cb0f16`），**not merged main**；Implement 前必须重新读取当时 merged main。

---

## D-17 Ordinary login boundary 与 client flow

### D-17.1 普通登录不变

- `POST /api/v1/auth/wechat` 只接收 `{ code }`；new openid → Account + Person；existing openid → reuse。
- 不新增 `mode=invite`、`inviteMode`、`binding=true`、特殊 header、隐藏 query、`invitationToken` 字段。
- 普通登录内部不猜测 / 解析 / 阻断 Case C；不承担 no-P2 保证。
- `WechatLoginRequest` schema 不变；`auth.ts` 的登录事务不变。
- 回归测试：new / existing openid、response shape、P2 行为不变。
- **并发首次登录为 pre-existing 限制**：同一 openid 的两个并发普通登录本身已存在 `accounts.wechat_openid UNIQUE` 竞争；006 不修改、不扩大、也不宣称修复该并发行为。006 的 Phase C Account 创建使用 `ON CONFLICT (wechat_openid) DO NOTHING`，顺序语义不变。若 Owner 要求并发 auth robustness，属独立 auth hardening，不在 006 修改普通登录。

### D-17.2 产品 / client flow（不设计 UI）

```text
participation invitation 打开
→ 若目标 Person 已有 Account（Case B）：
   ordinary authenticated path 复用；不进入双确认
   （客户端误调 POST /identity-bindings/bootstrap 时，服务端在 WeChat authentication 后识别
     authenticated Account == P1 existing Account，直接返回 REUSED；「endpoint 被调用」
     ≠「进入 Case C identity bootstrap state machine」，见 D-10.2）
→ 若目标 Person 无 Account（Case C）：
   在调用普通 /auth/wechat 之前调用 POST /identity-bindings/bootstrap
   → 得到 pendingContextToken + binding:NOT_COMPLETED
   → candidate AFFIRM；服务端current eligibility recheck
   → candidate得到server-generated short-lived pairingChallenge（hidden failure同shape decoy）
   → candidate现场把challenge展示/传递给亲自辨认自己的authorized confirmer
   → confirmer独立登录并调用 /pairing-decision；服务端由challenge绑定exact authenticated candidate/attempt
   → candidate 轮询 status
   → COMMITTED 后 POST /session 换取普通 session
   → 继续 Slice 4 的 accept / decline
```

- 该 flow 是产品 / client 责任；006 只提供 capability。
- 不允许普通登录先行创建 P2 后再绑定；若已发生，identity conflict。
- 不设计页面、组件、通知、二维码、PIN、电话、视频、KYC。

---

## D-18 Migration sequencing / rollback

### D-18.1 顺序（单个 reviewed additive migration）

```text
01 CREATE TYPE binding_attempt_state / binding_confirmation_kind /
            binding_confirmer_authority / binding_operation_scope /
            binding_operation_command
02 binding_pending_contexts
03 binding_attempts
04 binding_confirmations
05 binding_operation_keys
06 identity_binding_audit_events
07 indexes（partial unique live key + query indexes）
08 context getter functions（app_binding_context_hash / identity_digest /
   invitation_id / attempt_id / target_person_id / target_family_id /
   operation_scope / commit_account_id / candidate_account_id）
09 set_binding_context functions（SECURITY INVOKER，只 set_config + 参数校验；
   含 set_binding_target_context / set_binding_candidate_account_id）
10 ENABLE + FORCE RLS + 新表 policies（含 context attempt-scope policy）
11 Slice 1 表追加 purpose-scoped binding policies（D-13.3，含
   persons_binding_candidate_account_read）
12 append-only / immutable triggers（confirmations / audit）
13 GRANT 到 xiaoshuyin_app（最小 DML；audit 仅 INSERT）
```

- 文件：`db/migrations/00X_identity_binding_runtime.sql`；编号在 Implement 时读取最新 merged main 后分配，不硬编码。
- 不修改 `001_initial_schema.sql`；不修改 Slice 1 表列 / 约束 / enum。
- 追加 policy 使用新名字，避免与既有 policy 冲突；不改既有 policy 定义。
- 迁移必须可重复执行？沿用 `scripts/db-migrate.mjs` 的 migration tracking；不写 `DROP ... IF EXISTS` 破坏历史。
- 所有新表主键 `uuidv7()`；时间使用 DB `now()`。
- **Slice 5 最终只允许一个 006-owned additive migration。** 若开发过程中出现第二个 006-owned migration（例如 `005_identity_binding_candidate_account_gate.sql`）且相关 migration 均尚未 merge main：把后者中经批准的内容 fold 回 `00X_identity_binding_runtime.sql`，删除该额外文件，用普通 commit 记录；禁止 rebase、禁止 force push、禁止修改任何已 merge migration；随后重跑 fresh / upgrade / second-apply / DB evidence。不得将第二个 migration 合法化。

### D-18.2 Rollback

- 反向顺序：DROP triggers → DROP 追加 policies → DROP 新表 policies → DROP functions → DROP tables → DROP types。
- 不删除 Slice 1 表 / 列 / 既有 policy。
- Rollback 只在未产生业务数据的 migration 验证环境执行；生产回滚策略属于发布流程，不在本 Slice 设计数据迁移。
- Rollback 脚本不得被用于删除已产生的 binding / audit 历史。

---

## D-19 Test plan 与 FR / AS / SC 映射

### D-19.1 测试分层

| 层 | 文件（Implement 创建） | 覆盖 |
|---|---|---|
| Domain / Unit | `tests/domain/identity-binding-state.test.ts` | 状态机、禁止转换、settled、expiration、RETRYABLE 不是 state |
| Domain / Unit | `tests/domain/identity-binding-gate.test.ts` | UNDER_14 / MINOR 有 / 无 guardian / ADULT / UNKNOWN、consent revoked、multi-family、verified_source 不用 |
| Domain / Unit | `tests/domain/identity-binding-idempotency.test.ts` | operation key scope、same/different payload、replay、new attempt |
| Domain / Unit | `tests/domain/identity-binding-crypto.test.ts` | token hash、HKDF、AES-GCM、无明文 openid |
| Domain / Unit | `tests/domain/identity-binding-anti-enumeration.test.ts` | generic serializer、body keys、无 attemptId / reason |
| Database | `tests/db/identity-binding-schema.test.ts` | 表 / enum / CHECK / 部分唯一索引 / 无永久唯一 / audit `event_type` 闭集含 `BINDING_OPERATION_RETRYABLE` |
| Database | `tests/db/identity-binding-facts.test.ts` | app-layer gate facts builder（DB 读取 P1 / family / profile / consent / membership + `assertMinorProcessingAllowed`）；纯 facts shape / `evaluateBindingGate` 留在 `tests/domain/identity-binding-gate.test.ts` |
| Database | `tests/db/identity-binding-rls.test.ts` | 新表 FORCE RLS、无上下文 0 行、错误 family / attempt 0 行、audit runtime 不可读、candidate-account read policy 只返回该 Account 绑定的 Person |
| Database | `tests/db/identity-binding-concurrency.test.ts` | 并发 commit ∈ {0,1}、double confirmation、account / person conflict、0 commit |
| Integration | `tests/integration/identity-binding-bootstrap.test.ts` | Case B / C、Gate 1、invalid invitation、pending context、no session |
| Integration | `tests/integration/identity-binding-candidate.test.ts` | AFFIRM / REJECT / CANCEL、跨 attempt / identity、replay |
| Integration | `tests/integration/identity-binding-confirmer.test.ts` | 授权、list、AFFIRM / REJECT、candidate 代持拒绝、独立认证 |
| Integration | `tests/integration/identity-binding-commit.test.ts` | happy path、Account at commit、Gate 2 recheck、consent revoked between gates、invitation terminal between gates |
| Integration | `tests/integration/identity-binding-idempotency.test.ts` | 全幂等矩阵、concurrent same-key、different-key same semantic、bootstrap replay PENDING / COMMITTED / TERMINAL |
| Integration | `tests/integration/identity-binding-anti-enumeration.test.ts` | 6 类内部原因 response matrix、status / body / headers 不可区分 |
| Integration | `tests/integration/identity-binding-ordinary-login-regression.test.ts` | 普通 `/auth/wechat` new / existing、无 mode / hidden switch、无 P2 |
| Integration | `tests/integration/identity-binding-invitation-contract.test.ts` | port VALID / TERMINAL_UNUSABLE、no second invitation model |
| Integration | `tests/integration/identity-binding-audit.test.ts` | outcome 可追溯、`BINDING_OPERATION_RETRYABLE` 独立 event、无 secret / openid、append-only、不为 audit 建对象 |
| Integration | `tests/integration/identity-binding-rollback.test.ts` | 注入 commit 中途失败 → 全回滚、无孤立 Account / partial binding / settled attempt |
| Contract | `tests/integration/identity-binding-openapi.test.ts` | 6 条 route、schema、错误 envelope；无 participant route |
| Governance | `node scripts/validate-governance.mjs` / `run-governance-tests.mjs` / `guard-static` / `typecheck` / `openapi:check` / `coverage:audit` | 治理 / 静态 / 类型 / 契约 / 覆盖 |
| **BLOCKED** | `tests/integration/identity-binding-slice4-e2e.test.ts` | 真实 Slice 4 invitation → bootstrap → binding → accept；**BLOCKED BY SLICE 4 RUNTIME** |

- **Domain suite 约束（冻结）**：`tests/domain/**` MUST 为纯 domain / unit，MUST NOT 依赖 `DATABASE_URL`、MUST NOT 访问真实 PostgreSQL；DB-backed 行为（repository、facts builder、RLS、concurrency、migration、route integration）只放 `tests/db/**` / `tests/integration/**`。禁止在 domain suite 中 silent skip 或靠环境变量条件跳过。`bun run vitest run tests/domain` MUST 能在无 DB 环境下作为真正 domain suite 执行。

### D-19.2 FR / AS / SC 映射

| Spec 项 | 测试 |
|---|---|
| FR-001 / SC-013 / AS-01 | ordinary-login-regression + bootstrap |
| FR-002 | bootstrap + invitation-contract + client flow docs |
| FR-003 / SC-002 / AS-09 | bootstrap Case B + commit |
| FR-004 / SC-001 / AS-01 / AS-21 | commit + schema |
| FR-005 / AS-20 | bootstrap + RLS + no-session |
| FR-006 / FR-010 / SC-009 / AS-02 / AS-03 / AS-14 | gate domain + commit |
| FR-007 / FR-008 / AS-23 | candidate + state |
| FR-009 / AS-05 / AS-17 | confirmer + authorization |
| FR-011 / SC-001 / AS-21 | commit |
| FR-012 / AS-19 | schema + persistence |
| FR-013 / SC-003 / AS-14 / AS-15 | state + replay |
| FR-014 / AS-13 | retry / read-back |
| FR-015 / AS-07 / AS-04 / AS-05 | invitation seam + terminal |
| FR-016 / FR-021 / SC-004 / SC-008 / AS-08 / AS-16 / AS-22 | no-P2 + ordinary-login-first / account-bound conflict + rollback |
| FR-017 / SC-005 / AS-10 | concurrency |
| FR-018 / SC-010 | binding independent fact |
| FR-019 / SC-007 / AS-06 / AS-18 | anti-enumeration |
| FR-020 / AS-18 | multi-family |
| FR-022 / SC-006 / AS-11 / AS-12 | idempotency |
| FR-023 / SC-011 / AS-24 | audit |
| FR-024 / AS-20 / AS-24 | authz / RLS |
| FR-025 / SC-012 | downstream contract (contract-level) |
| FR-026 | dependency gate / blocked E2E |
| FR-027 / SC-014 | structure / exclusions |
| FR-028 | failure / retry / no partial |

**Acceptance 全量**：AS-01—AS-24 均在上表或对应测试文件中；没有 orphan acceptance。

### D-19.3 必测反例（不可省略）

- no-P2：ordinary-login-first、concurrent attempts、retry after timeout、commit rollback、invitation terminal 后重试 → `persons` 增量 = 0、P2 = 0、partial binding = 0。
- concurrent commit：N 个 attempt 并发 → successful commits ∈ {0,1}；全部失败 → 0 commit。
- retry / read-back：RETRYABLE 不落 attempt state；read-back 收敛 PENDING / COMMITTED / TERMINAL。
- Account conflict：openid 已绑定 P2 → TERMINAL；不 merge / rebind。
- Person conflict：P1 已绑 Account → TERMINAL；不替换。
- Gate 2 race：Gate 1 后 consent revoke / guardian change / invitation terminal → commit blocked，TERMINAL。
- duplicate confirmation：same key / different key → 一份 confirmation、无重复 audit。
- cross-attempt confirmation：confirmation 不能复用到 new attempt。
- anti-enumeration matrix：所有内部原因 response 不可区分。
- RLS wrong family：Gate / commit / audit 0 行或拒绝。
- ordinary `/auth/wechat` regression：new / existing openid 行为不变。

---

### D-19.4 Ultimate targeted remediation verification matrix

不得降级为unit mock：

1. H-01 non-collusive attacker matrix：攻击者不能仅凭 same invitation、timing、pending-list position、attemptId、createdAt 或自己的 unrelated challenge 赢得 pairing；wrong P1 / wrong identity / wrong invitation / wrong attempt / replay 全部 404/0 mutation，pending list不得自动选择 attempt。**intentional realtime relay / collusion by the authenticated candidate is explicitly out of scope and MUST NOT be used as a required fail-closed test premise。**
2. H-01 exact binding：challenge A用于B attempt/P1/invitation/candidate identity/current issuance全部fail closed；attemptId/pending-list不能替代challenge；pairingChallenge possession alone不是identity proof，confirmer responsibility仍包含independent auth + personal recognition + target confirmation。
3. H-01 replay/expiry/concurrency：same candidate AFFIRM + same key + same issuance exact bytes相等；rotation bytes/digest不同；old challenge失效；expired/consumed challenge 0 mutation；old key + rotated challenge → 409 IDEMPOTENCY_PAYLOAD_MISMATCH；two confirmer race最多一份SECOND_PARTY confirmation/一次commit；two candidates挑战不串线。
4. H-02 runtime-role barrier matrix：profile/age-band、consent、guardian、membership/authority、invitation、P1 binding conflict及candidate-account conflict逐类barrier；invalidating mutation在线性化上先成立 → no commit。必须证明xiaoshuyin_app下锁/版本/serialization真实生效。
5. M-01：至少 consent revoked after bootstrap before candidate AFFIRM → TERMINAL、candidate confirmation +0、valid pairing +0、terminal audit=1、all contexts scrub、candidate fixed AFFIRM shape；其余dynamic facts按同一矩阵。
6. M-02：COMMITTED replay、TERMINAL replay、pre-attempt replay、Case B REUSED replay的fresh context三secret columns全部NULL。
7. M-03：status materializes expired attempt with >=2 contexts → terminal audit=1、all contexts scrub；context-only expiry至少current scrub。
8. M-04：Phase C expiry barrier → ATTEMPT_EXPIRED、audit exactly1、all contexts scrub、binding0、no orphan Account。
9. historical F-02：operation key map A；new challenge resolves B + same key → 409/B零mutation；same replay只读A。
10. confirmationVersion / decision schema：second-party AFFIRM required literal + targetConfirmed=true + candidateRecognized=true；second-party REJECT required literal + targetConfirmed=false + candidateRecognized=false；mixed / true+true REJECT invalid 422；candidate REJECT/CANCEL仍按candidate schema omit confirmationVersion；handwritten/runtime/generated semantic equivalence。
11. RLS negative writes：runtime role intended SELECT与UPDATE/INSERT/DELETE boundary真实验证。
12. rollback matrix：Gate2 / Account / Person update / attempt settlement / cleanup / audit failure injection均无partial success。
13. MINOR success：MINOR_14_17 + guardian；MINOR_14_17 no guardian + Family manager。
14. true Case B mismatch：P1 bound A，candidate authenticates different identity/account B；与generic matrix逐字段/status/header/readback比较。

### D-19.5 Substantive coverage audit

维护machine-readable required-proof mapping：required acceptance ID → stable proof ID → exact test name/verification command → executed PASS evidence。

coverage gate必须验证proof被执行且对应assertion仍在，不能只检查文件存在、it/test/describe字符串、suite存在或总体百分比。required set至少含D-19.4的H-01、H-02、M-01—M-04、confirmationVersion、RLS、rollback、MINOR、Case B。

coverage:audit自身必须有RED self-test：删除required proof、重命名required proof、从execution set移除proof、把mapping替换成unrelated passing proof，四种均必须使audit non-zero；真实mapping恢复后GREEN。

### D-19.6 verify-all provenance

Canonical closeout command = node scripts/verify-all.mjs from repo root。final evidence必须记录branch / HEAD / origin/main / clean tracked tree、required env names+presence、每个required child exact command+exit、final exit。任何required child non-zero → verify-all non-zero；只有final exit 0可PASS。历史失败无法还原时记录 historical provenance unresolved。

---

## D-20 Explicit exclusions / structure checks

Implement 必须能机械证明以下不存在（CI / guard / grep / schema introspection）：

1. 普通登录改造、`mode=invite`、`inviteMode`、`binding=true`、隐藏 invitation 参数。
2. KYC / government-ID / 人脸 / 视频 / 电话 / 外部身份证明 / 敏感数据源。
3. `INSERT INTO persons`（006 代码 / migration 均不得出现）。
4. Person / Account / Family merge / unlink / rebind / duplicate recovery / 批量 reconciliation。
5. AI / fuzzy matching / 邮箱 / 手机 / 昵称自动匹配。
6. Profile / Account Settings / 身份中心 UI / 小程序页面 / 运营后台 UI。
7. Case Participant implementation、accept / decline / withdraw / participant API / participant capability。
8. `cases` / `case_participants` / Case ownership / visibility / 权限解析修改。
9. Evidence 写入（`assertions` / `observations` / STATEMENT / FACT / HYPOTHESIS / OBSERVATION）。
10. Invitation 创建 / 取消 / 撤回 / 过期 / token 生成 / 通知 / 第二套 invitation 模型。
11. Consent / Compliance 平台扩展、新 Consent 类型、新 guardian policy、PIPIA、feature policy。
12. 多家庭产品能力（switching / linking / search / discovery / merge / shared identity）。
13. 后台 job / 定时器 / 通用 workflow engine / 第二套通用审计框架。
14. V2–V5 capabilities。

**结构枚举**：006新表仍只有5张；binding HTTP surface仍为6条（原attemptId decision被pairing-decision取代，不新增第7条）；新enum仍只有5个；没有case/evidence/assessment/intervention/notification/ai表。

---

## D-21 Observability / logging

- 结构化日志字段：`correlationId`、`attemptId`（可空）、`event`、`result`、`terminalReason`（server-internal）、`durationMs`。
- 禁止日志：openid、token、token hash、ciphertext、consent 原文、家长原话、candidate / P1 姓名、Family 名称、微信凭据。
- candidate-facing 不展示 internal reason；日志可记录 internal reason，但只用于运维 / 安全排查。
- 不新增 metrics / tracing 平台；使用现有 Fastify logger。
- `RETRYABLE` 的 best-effort audit / log 不得伪造成功或终态。

---

## D-22 Dependency gate 与 Implement Gate

### D-22.1 Dependency classification

| # | 类别 | 依赖 | 当前事实 | 对本 Slice（业务 Slice 5，repo feature 006）的影响 |
|---|---|---|---|---|
| H1 | **Hard core Implement blocker → SATISFIED** | Slice 1 runtime：真实 `authorize()`（fail-closed、facts、manager / guardian 判定）、RLS helper、幂等、审计基线 | 已解除：Slice 1 于 2026-11-07 Final Independent Audit II PASS → PR #13 merge main → post-merge CI PASS → CLOSED；`origin/main` = `f4ef60265e1bc4aec7a458ccf924af85eef7debe`；`packages/authorization/src/authorize.ts` 的 `MINOR_PROCESSING` 已是真实分支（非占位 `return ALLOW`）；`tests/evidence/converge.md` 归档 36 PASS / 0 FAIL | **SATISFIED**：不再阻塞 core implementation；当前状态为 `READY FOR CORE IMPLEMENTATION`，仅 `T121–T124` 继续 `BLOCKED BY SLICE 4 RUNTIME` |
| H2 | **Hard core contract** | 005 Identity Binding Contract | merged main（Slice 2 merge 后 main = `f4ef602`） | SATISFIED（语义） |
| H3 | **Contract-only dependency + late E2E blocker** | Slice 4 participant contract（invitation valid / terminal-unusable + P1 + target Family） | `origin/feat/004-case-participant-core` = `a2d82c73b5d134f6559ea9247ee19eda15cb0f16`，**not merged main**；Slice 4 runtime 未实现 | **不阻塞 core implementation**：本 Slice 以冻结 contract + `InvitationResolutionPort` + contract fixture / test double 完成 schema / domain / pending auth / attempt / confirmation / Gate / idempotency / concurrency / authorization / RLS / audit / API / transaction / retry / contract-level tests；**只阻塞**真实 production adapter 与真实 Case C E2E，即 `T121–T124 = BLOCKED BY SLICE 4 RUNTIME` |

### D-22.2 Non-dependencies

- Slice 2 `002-case-core`：不依赖；不读 Case 内容。已由 PR #14 merge main（`origin/main` = `f4ef602`；`specs/002-case-core` 已在 main），不影响本 Slice domain / schema。
- Slice 3 `003-evidence-core`：明确不写 Evidence；不是依赖（当前未 merge main，`specs/003` 不在 main）。

### D-22.3 Implement Gate 状态机与循环依赖排除

```text
当前（2026-11-09，Security Decision A upstream contract remediation 后）：
DECISION A / THREAT MODEL / PAIRING CONTRACT REMEDIATED
READY FOR TARGETED PLAN RE-AUDIT
T001–T120 当前真实 checkbox：58 checked / 62 reopened；不得再使用旧“26 tasks reopened”
T121–T124 继续 BLOCKED BY SLICE 4 RUNTIME
Targeted Audit I PASS 之前不得进入 development remediation

Slice 4 runtime available 后：
执行 T121–T124 → real adapter / real Slice 4 integration / full Case C E2E
→ 本 Slice（业务 Slice 5，repo feature 006）Implement complete → 审计二
```

> 历史状态（不得再作为当前事实）：B1 未解除时为 `IMPLEMENT BLOCKED — ONLY BY SLICE 1 HARD DEPENDENCY`；Slice 1 CLOSED 后该状态已失效。

**B1 / B2 的精确定义**

1. **B1 — Slice 1 真实 `authorize()` 未合并 / 未 Converge PASS**：曾是本 Slice **core implementation 的唯一 hard blocker**；现已解除（Slice 1 CLOSED，`origin/main` = `f4ef602`，`MINOR_PROCESSING` 实分支，converge 36 PASS / 0 FAIL）。
2. **B2 — Slice 4 runtime 未 merge**：这是 **Slice 4 runtime 的 late E2E blocker**，不是本 Slice core implementation 的 hard blocker。B2 只冻结 `T121–T124`，不得冻结 Phase 1–14。

**为什么不存在循环硬依赖**

```text
本 Slice（业务 Slice 5，repo feature 006）core implementation ← 只依赖 Slice 1（B1，已 SATISFIED）
Slice 4 implementation                                       ← 依赖本 Slice core runtime available
本 Slice T121–T124 closeout                                  ← 依赖 Slice 4 runtime
```

这是**分阶段交接**，不是循环：

- 本 Slice core **不等待** Slice 4 runtime；
- Slice 4 等待的是本 Slice **core runtime available**，不是本 Slice 的 `T121–T124` full closeout；
- 本 Slice 只在 **late closeout** 阶段等待 Slice 4 runtime；
- 本 Slice core 与 Slice 4 runtime 之间不存在互相等待的边。

**直接回答「本 Slice 是否必须等待 Slice 2 / Slice 3 / Slice 4 实现后才能开始开发？」**

- 不需要等待 Slice 2、Slice 3。
- **不需要等待 Slice 4 runtime 才能开始本 Slice core implementation**。core 使用冻结 contract + port + fixture 完成；禁止私建第二套 invitation runtime，禁止伪造 Slice 4 production implementation。
- Slice 1 的 hard dependency 已 SATISFIED（PR #13 merged main）。
- `T121–T124` 必须等待 Slice 4 runtime；这是 B2，只影响 late E2E closeout。

---

## Existing Contracts Reused

- `Docs/V1技术设计.md` §7.1 身份基数；§7.7A Compliance；§9 / §9.1 授权 / RLS；§10 孩子参与；§28.1 / §28.8 API 边界；§8.5 幂等；§7.0 migration / uuidv7。
- `specs/005-invited-identity-binding-contract/spec.md` §5.1—§5.7、§6、IB-001—IB-028、Acceptance 1—26。
- Slice 1：`accounts` / `persons` / `families` / `family_members` / `guardian_consent_requests` / `consent_records` / `person_compliance_profiles` / `business_audit_events` / `idempotency_keys`；`authorize()`；`withRlsTransaction`；`app.set_*_context`；`assertMinorProcessingAllowed`；`notices`。
- Slice 4 contract：`participant-lifecycle-and-identity-seam.md` §1 / §2 / §3 / §4 / §6 / §7 / §9。

---

## Data and Migration Impact

- 新增5张表、5个enum、若干索引/部分唯一索引/CHECK、context getter/setter functions、新表policy、Slice1增量policy、append-only triggers与GRANT。H-01仅在既有 binding_pending_contexts 增加 nullable pairing_issued_at / pairing_expires_at 两列及完整性CHECK；不新增第6张表。
- 全部 006-owned schema 只通过**一个** reviewed additive migration 落地（D-18.1）。
- 不修改 Slice 1 表结构、列、既有约束、既有 policy、既有 enum、既有 audit / idempotency 数据。
- 新增 6 条 HTTP route、新增 OpenAPI 文件、generated 产物由脚本生成。
- 新增 3 个 required env（`IDENTITY_BINDING_SECRET`、两个 TTL）；env schema 变更属于 Implement，不在 Plan 写代码。

## Authorization / Safety / Compliance Impact

- 新增 6 个 authorization action、1 个 purpose、1 个 resource type、若干 deny reason；既有 action 行为不变。
- Gate 1 / Gate 2 复用 Slice 1 Compliance / Consent 事实；不新增 Consent 类型、不新增 guardian policy。
- `verified_source` 不参与 guardian authority；`family_members` 不推导 guardian。
- 不削弱 RLS；新增 policy 只在 binding purpose 下生效。

## API / Contract Impact

- H-01明确改变handwritten HTTP contract：candidate AFFIRM 200 response增加required pairingChallenge；原 POST /identity-bindings/{attemptId}/decision 改为 POST /identity-bindings/pairing-decision，request增加candidate-presented pairingChallenge且不再接受attemptId path selector。
- GET /pending保留，但明确not pairing selector。
- AFFIRM hidden outcomes使用valid/decoy challenge同shape维持anti-enumeration；confirmer invalid/expired/consumed/mismatched challenge统一404。
- candidate decision confirmationVersion仍为decision-discriminated oneOf；runtime Zod/generated OpenAPI由开发同步，generated不得hand-edit。
- 普通 /auth/wechat schema/behavior不变。

## AI / RAG / Eval Impact

- 无。006 不调用 AI、不做身份判断、不做 fuzzy matching、不写 Memory / Evidence。

## Async / Notification / Side-Effect Impact

- 无后台 job / 定时器 / 通知 / outbox。Attempt expiration 通过访问时条件物化，不依赖后台任务。

---

## Project Structure（Implement 目标）

```text
apps/server/api/src/
  identity-binding/
    gate.ts                      # app-layer Gate facts + assertMinorProcessingAllowed composition
    bootstrap.ts                 # Phase A / Gate 1 / attempt creation
    candidate-decision.ts        # candidate AFFIRM / REJECT / CANCEL
    confirmer.ts                 # pending operational view / pairing-decision + authority
    commit.ts                    # Gate 2 + Phase C
    session-exchange.ts          # COMMITTED → ordinary session
    anti-enumeration.ts          # generic serializer
    crypto.ts                    # HKDF / AES-GCM / context token + pairing challenge authentication
    invitation-port.ts           # Slice 4 consumer port
    errors.ts                    # binding error codes
  routes/identity-bindings.ts    # 6 routes
  db/tx.ts                       # + 5 binding wrappers（extend existing）
  plugins/auth.ts                # binding auth exemption / rejection
  plugins/error-handler.ts       # + binding error codes
packages/domain/src/
  identity-binding.ts            # state machine / idempotency types
  identity-binding-gate.ts       # pure Age / Pre-gate matrix（不 import compliance）
  identity-binding-repository.ts # SQL access（no direct SQL in routes）
packages/authorization/src/
  authorize.ts                   # + binding actions / purpose / resource / facts
packages/contracts/src/
  identity-binding-schemas.ts    # Zod request / response / error
db/migrations/
  00X_identity_binding_runtime.sql
tests/
  domain/identity-binding-*.test.ts
  db/identity-binding-*.test.ts
  integration/identity-binding-*.test.ts
```

- 业务 SQL 在 `packages/domain` / repository；route 只做 schema / auth / orchestration。
- 不新增 `packages/identity-binding` 大平台；006 代码集中在现有 app / domain / authorization / contracts。

---

## Verification Plan

| 验证 | Canonical requirement | 证据 |
|---|---|---|
| TypeScript | bun run typecheck | 0 error |
| Unit / integration / DB | targeted required suites + aggregate | 全PASS，0 skipped（除explicit BLOCKED） |
| H-01 | original attack + exact binding + replay/expiry/concurrency | D-19.4 #1—#3 |
| H-02 | real PostgreSQL runtime-role barrier matrix | D-19.4 #4；source-text lock不算 |
| M-01—M-04 | direct regression + DB observable + audit/cleanup | D-19.4 #5—#8 |
| OpenAPI | handwritten/runtime/generated semantic comparison | pairing shape + confirmationVersion matrix |
| Migration/RLS | migrate + db evidence + runtime-role behavior | replayable + FORCE RLS + actual behavior |
| Coverage | coverage:audit | required proof mapping + RED self-test；missing/renamed/unexecuted/unrelated proof → non-zero |
| Governance | governance validators | Docs/005/006 Spec diff=0 |
| Full | node scripts/verify-all.mjs from repo root | exact HEAD/env-presence/child-exit/final-exit provenance；final 0才PASS |
| Blocked E2E | Slice4 runtime unavailable | T121–T124 = BLOCKED，不得伪造PASS |

Canonical verify-all final run前tracked working tree必须clean；required env只记录name/presence，不得记录secret value。历史non-zero provenance无法复原时如实写unresolved。

---

## Rollback / Recovery

- Migration additive；回滚顺序见 D-18.2。
- 业务回滚：commit 事务失败 → 全回滚；attempt 可保持 PENDING 或已 TERMINAL；不得删除历史 confirmation / audit。
- Pending context / attempt无后台cleanup job；访问时物化expiry。单context expiry scrub自身；attempt settled/expired使用D-14唯一authoritative settlement完成all-context scrub + exactly-one audit；pre-attempt/settled replay fresh context在response前scrub。不得保留decryptable secret等待未来lifecycle。
- 不实现数据删除 / unlink / merge / rebind。

---

## Complexity Exceptions

| 例外 | 理由 | 边界 |
|---|---|---|
| 新增 5 张表 | 005 要求 attempt 持久化、confirmation 关联、operation 幂等、audit outcome；现有表无法承载 | 单用途、无通用平台 |
| 新增审计表 | `business_audit_events` NOT NULL / 封闭 event_type 无法承载 pre-account 结果 | 单表、append-only、write-only runtime |
| 新增 5 个 binding 事务 wrapper | 需要 purpose-scoped RLS 上下文，且不得冒充 P1 / 设置 family scope | 复用 `tx.ts`，不新建 framework |
| AES-GCM 加密 openid | pending context 需要原始 openid 在 Phase C 创建 Account；明文短期落库不符合最小暴露 | 只加密 pending context；commit 后清零；不引入 KMS |
| 6 条端点 | 不增加surface；H-01仅把confirmer attemptId-path decision替换为candidate-presented pairing-decision | 无participant/UI/notification；pending list不是pairing selector |

---

## Open Review Items（非阻塞，需审核确认）

1. **Slice 1 真实 `authorize()` 形状**：本 Plan 按 remediated 版本（object Resource + facts）设计；若最终合并版本不同，Implement 前必须回 Plan 对齐，不得临场发明第二套授权入口。
2. **Slice 4 production adapter 的最终文件位置**：由 Slice 4 实现决定；006 只冻结 port 接口，不在本 Slice 写 adapter。
3. **TTL 数值**：context / attempt / pairing TTL均属RELEASE / POLICY GATE；Plan只要求required positive env，不写具体秒数；pairing TTL必须被context/attempt expiry上界夹住。
4. **`IDENTITY_BINDING_SECRET` 轮换**：属 operational compatibility；本 Slice 只要求 fail-safe，不设计 KMS / keyring。