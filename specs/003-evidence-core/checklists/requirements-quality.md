# Requirements Quality Checklist: Evidence Core（003-evidence-core）

**Feature**: `specs/003-evidence-core/spec.md`  
**Plan Final Head**: `f85ab6ef4c5f6ee0d7eb0ea2dfe57098d0c3bea4`  
**Review stage**: Checklist only  
**Review object**: Specify + Clarify + Plan + Research + Data Model + Contracts + Quickstart（不含 Tasks / Analyze / Implement）  
**Status legend**: `[x] PASS` / `[ ] FAIL` / `[ ] NEEDS REVIEW`

> 本清单只审核冻结上游产物是否完整、明确、一致、可测试。  
> 它不是实现任务清单，也不证明代码、migration 或 runtime 已实现。  
> 如果任一真实 blocker 出现，应保持未勾选并退回对应上游阶段；Checklist 不自行修改冻结产物。

---

## 1. Governance / Authority / Scope

- [x] CHK001 **检查对象**：权威来源。**PASS 条件**：Spec/Plan 明确以 `Docs/V1产品需求.md` 为 V1 产品语义事实源、`Docs/V1技术设计.md` 为实现设计事实源，specs 仅为下游投影。**实际结果**：PASS — 与 AGENTS / Constitution 一致。
- [x] CHK002 **检查对象**：流程阶段。**PASS 条件**：当前只允许 Checklist，不进入 Tasks / Analyze / Implement。**实际结果**：PASS — Plan 明确“下一阶段只能进入 Checklist Review”，本清单不包含实现动作。
- [x] CHK003 **检查对象**：Slice 边界。**PASS 条件**：只覆盖 `dialogue_messages` / `assertions` / `observations` 与必要 enum/index/constraint/RLS/provenance。**实际结果**：PASS — 三表边界在 Spec/Plan/Data Model 一致。
- [x] CHK004 **检查对象**：禁止第二事实源。**PASS 条件**：不新增 `evidence_items`、知识图谱、第二套 provenance/idempotency/audit/event framework。**实际结果**：PASS — 明确列入 Non-Goals / Explicit Non-Goals。
- [x] CHK005 **检查对象**：Scene-agnostic。**PASS 条件**：Common Core 不含 Digital Use 节点号、手机专属字段、Scene business rule。**实际结果**：PASS — Observation 仅使用 generic `observation_code`，无 A/010xx 逻辑。
- [x] CHK006 **检查对象**：未来能力隔离。**PASS 条件**：Participant、Assessment、Problem Formulation、Scene、Goal、Plan、Task、Safety、AI/RAG/Memory/Notification 均不被预实现。**实际结果**：PASS — Spec Out of Scope、Plan Explicit Non-Goals、Data Model absent schema 一致。
- [x] CHK007 **检查对象**：冻结 Q1/Q2/Q3/Q4/Q5。**PASS 条件**：Checklist 不重新设计，只核对一致性。**实际结果**：PASS — 五组决策均已有唯一表达。
- [x] CHK008 **检查对象**：上游冲突。**PASS 条件**：不存在需要修改 Docs / Spec / Plan 才能解释的矛盾。**实际结果**：PASS — 未发现产品或架构 blocker。

---

## 2. FR-001 — FR-021 Coverage（21/21）

- [x] CHK009 **FR-001**：Statement / Observation / Fact / Hypothesis 可区分，Observation 不进入 assertion kind。**PASS 条件**：产品语义、技术落点、verification 均存在且无需猜测。**实际结果**：PASS — `assertion_kind` 恰 3 值，Observation 独立表，结构测试已规划。
- [x] CHK010 **FR-002**：Assertion provenance 字段完整。**PASS 条件**：source/subject/message/time/confirmation/validity/supersedes/conflict 全部有列级落点。**实际结果**：PASS — Data Model §4/§5、Domain Contract §4 一致。
- [x] CHK011 **FR-003**：occurred time 与 recorded time 分离。**PASS 条件**：unknown occurred 不用 recorded_at 代填；recorded_at server-owned；有机械 CHECK。**实际结果**：PASS。
- [x] CHK012 **FR-004**：真实来源保留。**PASS 条件**：guardian relay/observation 不得变 child self statement；source/subject 关系明确。**实际结果**：PASS — provenance matrix 固定 writer 与关系。
- [x] CHK013 **FR-005**：UNKNOWN / NOT_COLLECTED / DECLINED / N/A / CONFLICT 真实表达。**PASS 条件**：不以 null/0/false/default 文本伪造；不同语义分层表达。**实际结果**：PASS。
- [x] CHK014 **FR-006**：冲突保留。**PASS 条件**：至少两条来源、同 group、无 winner、无自动 Fact。**实际结果**：PASS — conflict_group contract 与 verification 明确。
- [x] CHK015 **FR-007**：validity / supersedes 历史。**PASS 条件**：新行不原地覆盖旧行；same type/Family/Case；旧记录可追溯。**实际结果**：PASS。
- [x] CHK016 **FR-008**：禁止自动 Fact promotion。**PASS 条件**：无 public/AI/arbitrary internal FACT path；FACT schema/domain 仍存在；数据库 runtime hard guard 存在。**实际结果**：PASS。
- [x] CHK017 **FR-009**：Message POST 保存 raw input only。**PASS 条件**：message write 自动 Assertions = 0，无 Assessment/Scene/Formulation 副作用。**实际结果**：PASS。
- [x] CHK018 **FR-010**：服务端 Authorization / Purpose。**PASS 条件**：public Message 复用已批准 Case management actor path；internal Evidence 必须携带授权 Family/Case/Purpose context，并在 writer 执行时机械复核 `actorAccountId↔actorPersonId`、Case 真实属于 Family、`authorize(CASE_READ + FAMILY_MANAGEMENT + specific Case)`；任何 DENY / 未知 purpose fail closed；不新增 authorization action；RLS 不替代业务授权。**实际结果**：PASS — Plan/Contract 已冻结该机械 seam；实现由 T068–T069 验证。
- [x] CHK019 **FR-011**：Family RLS 最后防线。**PASS 条件**：三表 ENABLE/FORCE RLS，错误 Family context 读 0 / 写拒绝，runtime 非 owner/NOBYPASSRLS。**实际结果**：PASS — Plan 明确 future DB introspection。
- [x] CHK020 **FR-012**：Scene-agnostic domain。**PASS 条件**：无 Digital Use field/routing hardcode。**实际结果**：PASS。
- [x] CHK021 **FR-013**：typed contract。**PASS 条件**：Zod/OpenAPI 流程、strict request、未声明字段拒绝。**实际结果**：PASS — OpenAPI `additionalProperties:false`。
- [x] CHK022 **FR-014**：correction propagation 不越界。**PASS 条件**：只建立 evidence-level dependency foundation，不宣称已传播到 Formulation/Plan/Memory。**实际结果**：PASS。
- [x] CHK023 **FR-015**：无 generic public Evidence CRUD / future endpoints。**PASS 条件**：route enumeration 可机械证明只有批准 Message POST。**实际结果**：PASS。
- [x] CHK024 **FR-016**：provenance regression。**PASS 条件**：guardian relay、conflict、UNKNOWN、superseded history 均有具名 verification。**实际结果**：PASS。
- [x] CHK025 **FR-017**：失败真实、事务原子、重试不重复。**PASS 条件**：当前可达 Message command 使用 shared idempotency；Message+audit+response snapshot 同事务；internal Evidence write 原子化且当前无 public caller。**实际结果**：PASS — 不建立第二幂等引擎。
- [x] CHK026 **FR-018**：Participant 权限不开放。**PASS 条件**：仅现有批准 Case actor path；不发明 child/participant access。**实际结果**：PASS。
- [x] CHK027 **FR-019**：message 是来源而非事实真相源。**PASS 条件**：message 不自动 Assertion；runtime message 无 UPDATE/DELETE；source_message 只做 provenance。**实际结果**：PASS。
- [x] CHK028 **FR-020**：Implementation dependency gate。**PASS 条件**：Slice 1/2 均 Implement complete + independent Converge PASS + merged main 才能 Implement；失败固定 BLOCKED。**实际结果**：PASS。
- [x] CHK029 **FR-021**：Person reference security。**PASS 条件**：Family A Evidence 无法引用 Family B-only Person；composite FK + application validation + Case auth + anti-enumeration 均定义。**实际结果**：PASS。

**FR Coverage: 21 / 21 PASS。**

---

## 3. Acceptance Scenarios（13/13）

- [x] CHK030 **Scenario 1**：合法 Case message 保存 raw message、source/actor/time，可验证 Assertions +0。**PASS 条件**：integration + DB + audit 路径完整。**实际结果**：PASS。
- [x] CHK031 **Scenario 2**：guardian→child Statement 保持 subject/source 分离且仍为 STATEMENT。**PASS 条件**：writer/provenance/person refs 可机械验证。**实际结果**：PASS。
- [x] CHK032 **Scenario 3**：两来源冲突均保留、同 conflict group、无 winner/Fact。**实际结果**：PASS。
- [x] CHK033 **Scenario 4**：UNKNOWN / NOT_COLLECTED / DECLINED / N/A round-trip 不补值。**实际结果**：PASS。
- [x] CHK034 **Scenario 5**：Hypothesis 无合法确认依据不能原地/等价变 FACT。**实际结果**：PASS — domain API + DB FACT guard 双层可验。
- [x] CHK035 **Scenario 6**：新 Evidence supersedes 旧 Evidence，旧行仍在、validity 可区分。**实际结果**：PASS。
- [x] CHK036 **Scenario 7**：Family A actor 对 Family B Case 被 application + RLS 双层拒绝。**实际结果**：PASS。
- [x] CHK037 **Scenario 8**：provenance 可追到 Case、subject、source、message/time/confirmation/validity/conflict（适用时）。**实际结果**：PASS。
- [x] CHK038 **Scenario 9**：仅新增 Message POST；无 generic CRUD/Assessment/Formulation/Scene/Participant route。**实际结果**：PASS。
- [x] CHK039 **Scenario 10**：Observation 与 Assertion 分表，assertion kind 无 OBSERVATION。**实际结果**：PASS。
- [x] CHK040 **Scenario 11**：未来 AI/extractor candidate 无确认动作时只能为候选/HYPOTHESIS 或被拒，不能 FACT。**实际结果**：PASS — 当前 Slice 实际 AI caller 为 none，fail closed。
- [x] CHK041 **Scenario 12**：Slice 1/2 未满足时设计阶段可继续、Implement 必须 BLOCK。**实际结果**：PASS。
- [x] CHK042 **Scenario 13**：Family A Evidence → Family B-only Person（subject 或 source）写入失败、0 Evidence、无泄漏。**实际结果**：PASS。

**Acceptance Coverage: 13 / 13 PASS。**

---

## 4. Success Criteria（10/10）

- [x] CHK043 **SC-001**：四类 Evidence 语义机械可区分。**PASS 条件**：DB/domain introspection，不靠人工阅读。**实际结果**：PASS。
- [x] CHK044 **SC-002**：guardian source 不冒充 child self-confirmed。**PASS 条件**：source/subject/writer relationship test。**实际结果**：PASS。
- [x] CHK045 **SC-003**：冲突测试自动 winner = 0。**PASS 条件**：两条来源 + group 均在。**实际结果**：PASS。
- [x] CHK046 **SC-004**：未知/拒绝/N/A/conflict 语义 round-trip。**PASS 条件**：value state 与 conflict relation 分开测试。**实际结果**：PASS。
- [x] CHK047 **SC-005**：supersedes/validity 旧记录仍存在且 currentness 可判断。**实际结果**：PASS。
- [x] CHK048 **SC-006**：HTTP 跨 Family + direct DB RLS 均无泄漏。**实际结果**：PASS。
- [x] CHK049 **SC-007**：message 自动 Assertions = 0，且无 Formulation/Scene/Plan/AI run。**实际结果**：PASS。
- [x] CHK050 **SC-008**：route/schema audit 无排除 endpoint / placeholder。**实际结果**：PASS。
- [x] CHK051 **SC-009**：provenance regression 覆盖 guardian/child conflict、relay、UNKNOWN、更正最小链路。**实际结果**：PASS。
- [x] CHK052 **SC-010**：Implement Gate 可机械判 BLOCKED，且不允许偷修依赖。**实际结果**：PASS。

**Success Criteria: 10 / 10 PASS；不存在“人工看起来对”作为唯一验收。**

---

## 5. Frozen Decisions Q1 / Q2 / Q3 / Q4 / Q5

- [x] CHK053 **Q1 Observation structure**。**PASS 条件**：Observation/Assertion 分表；共享 provenance 只复用 TS helper，不建 evidence supertable。**实际结果**：PASS。
- [x] CHK054 **Q2 value availability**。**PASS 条件**：KNOWN/UNKNOWN/NOT_COLLECTED/DECLINED/NOT_APPLICABLE 与 time/confirmation/conflict/validity 分层。**实际结果**：PASS。
- [x] CHK055 **Q2 scalar values**。**PASS 条件**：TEXT/NUMBER/BOOLEAN；0 与 false 保持 KNOWN；UNKNOWN 不靠 null 推断。**实际结果**：PASS。
- [x] CHK056 **Q3 command**。**PASS 条件**：`CASE_MESSAGE_CREATE`、`Idempotency-Key` HTTP header transport、shared idempotency 唯一。**实际结果**：PASS。
- [x] CHK057 **Q3 canonical hash**。**PASS 条件**：verified `familyId + caseId + body.content`；`Idempotency-Key` header 值不进 hash；content 使用 exact stored string。**实际结果**：PASS。
- [x] CHK058 **Q4 raw message only**。**PASS 条件**：message write → raw message only → automatic Assertions = 0；未来 1 message → 0..N Assertions。**实际结果**：PASS。
- [x] CHK059 **Q5 FACT semantic exists**。**PASS 条件**：FACT enum/domain union 存在但当前无正式创建/确认 flow。**实际结果**：PASS。
- [x] CHK060 **Q5 FACT reachability hard stop**。**PASS 条件**：public/AI/extractor/arbitrary runtime DB path 均不能写 FACT；future Slice 必须显式改 policy/contract。**实际结果**：PASS。

---

## 6. Provenance Source Admissibility Matrix（8/8）

- [x] CHK061 **SELF_STATEMENT**。**PASS 条件**：current Slice allowed；writer=`recordStatement`；source_person required；subject required；source=subject；Family/Case auth 必须通过。**实际结果**：PASS。
- [x] CHK062 **GUARDIAN_OBSERVATION**。**PASS 条件**：allowed；`recordObservation` only；source required；source≠subject；真实 guardian relation；guardian 不授予 Family access。**实际结果**：PASS。
- [x] CHK063 **GUARDIAN_RELAY**。**PASS 条件**：allowed；`recordStatement` only；source required；source≠subject；真实 guardian relation；Family/Case auth 独立。**实际结果**：PASS。
- [x] CHK064 **OTHER_MEMBER_RELAY**。**PASS 条件**：allowed；`recordStatement` only；source required；source≠subject；双方当前 Family member；不要求 guardian。**实际结果**：PASS。
- [x] CHK065 **MANUAL_DEVICE_DATA**。**PASS 条件**：当前 production disabled；writer none；source_person forbidden；fail closed。**实际结果**：PASS — 未实现 Digital Use/device ingestion。
- [x] CHK066 **STAFF_RECORD**。**PASS 条件**：当前 production disabled；writer none；source_person forbidden；fail closed。**实际结果**：PASS。
- [x] CHK067 **AI_HYPOTHESIS**。**PASS 条件**：当前 production disabled；无 AI runtime caller；`recordHypothesis` 仅 future-facing contract；不能伪造 AI provenance。**实际结果**：PASS。
- [x] CHK068 **SOURCE_CONFIRMED provenance source**。**PASS 条件**：当前 production disabled；无 confirmation/FACT workflow；fail closed。**实际结果**：PASS。

**Provenance ambiguity: 0。Slice 1 enum 不修改；未来扩展必须显式修改 Slice 3 admissibility。**

---

## 7. Person Reference / Authorization / Anti-enumeration

- [x] CHK069 **subject_person_id**。**PASS 条件**：non-null 必须是 target Family `family_members` 合法 ref，并通过 application authorization；同时必须通过当前 Slice 1 compliance gate（`ADULT` / `MINOR_14_17` / `UNDER_14` valid consent 允许，`UNDER_14` missing/revoked/stale/invalid、`UNKNOWN`、profile missing fail closed）。**实际结果**：PASS — Plan/Contract 已冻结；实现由 T071 验证。
- [x] CHK070 **source_person_id**。**PASS 条件**：同上，且按 source_kind relationship rule 验证；同时必须通过当前 Slice 1 compliance gate（source=UNDER_14 revoked/missing/stale/invalid、UNKNOWN、profile missing 均阻断；`subjectPersonId === sourcePersonId` 时允许只检查一次，语义不变）。**实际结果**：PASS — Plan/Contract 已冻结；实现由 T070–T071 验证。
- [x] CHK071 **Family A → Family B-only Person DB guard**。**PASS 条件**：`(family_id, person_id) -> family_members(family_id,person_id)` composite FK 拒绝。**实际结果**：PASS — subject/source 两处均规划。
- [x] CHK072 **Case ownership**。**PASS 条件**：Evidence 的 `(case_id,family_id)` 必须引用当前 Family Case；Case authorization 先行，且 internal writer 必须在读取任何 Person/provenance/supersedes 数据之前机械复核 `CASE_READ + FAMILY_MANAGEMENT + specific Case`；ordinary member 不能仅凭 RLS Family context 写入。**实际结果**：PASS — Plan/Contract 已冻结；实现由 T068–T069 验证。
- [x] CHK073 **guardian boundary**。**PASS 条件**：guardian relationship 只验证 provenance/compliance 关系，不替代 Family membership/Case permission。**实际结果**：PASS。
- [x] CHK074 **UNDER_14**。**PASS 条件**：只能引用 Slice 1 已合法建立的 child Person；Evidence Core 不创建 child Person、不绕过 consent-first；`subject_person_id` 与 `source_person_id` 两个非空引用都必须通过当前 consent/compliance gate，source=UNDER_14 revoked/missing/stale/invalid 必须阻断。**实际结果**：PASS — Plan/Contract 已冻结；实现由 T070–T071 验证。
- [x] CHK075 **source_message provenance**。**PASS 条件**：同 Family/Case/source person；message 不存在或不匹配时 fail closed。**实际结果**：PASS。
- [x] CHK076 **anti-enumeration**。**PASS 条件**：invalid Person ref 不暴露 UUID 是否存在/其它 Family/guardian 私密细节；specific Case 延续统一 404 语义。**实际结果**：PASS。

---

## 8. Observation / Unknown / Conflict / Supersedes

- [x] CHK077 **Observation independence**。**PASS 条件**：独立表，无 `assertions.kind=OBSERVATION`。**实际结果**：PASS。
- [x] CHK078 **Typed value CHECK**。**PASS 条件**：KNOWN 恰一个 typed value；TEXT/NUMBER/BOOLEAN 互斥；unit 仅 KNOWN NUMBER。**实际结果**：PASS。
- [x] CHK079 **Unknown-like CHECK**。**PASS 条件**：UNKNOWN/NOT_COLLECTED/DECLINED/NOT_APPLICABLE 时 type/value/unit 全 NULL，但 state 本身非 NULL。**实际结果**：PASS。
- [x] CHK080 **0 / false semantics**。**PASS 条件**：numeric 0 与 boolean false 可作为 KNOWN round-trip。**实际结果**：PASS。
- [x] CHK081 **N/A canonical**。**PASS 条件**：数据库/domain 固定 `NOT_APPLICABLE`，不用 null/false/empty string。**实际结果**：PASS。
- [x] CHK082 **Occurred unknown**。**PASS 条件**：`evidence_time_state=UNKNOWN + occurred_at=NULL`；recorded_at 不代填。**实际结果**：PASS。
- [x] CHK083 **Conflict representation**。**PASS 条件**：`conflict_group_id` 是关系，不进入 value_state；至少 2 refs、same Family/Case、可跨 Assertion/Observation。**实际结果**：PASS。
- [x] CHK084 **Conflict resolution prohibition**。**PASS 条件**：无 winner/confidence/rank/majority/latest/AI auto-resolution。**实际结果**：PASS。
- [x] CHK085 **Conflict mutation boundary**。**PASS 条件**：runtime UPDATE 只授予 `conflict_group_id`；group 不可迁移；其它 content/value/provenance 不可 UPDATE。**实际结果**：PASS。
- [x] CHK086 **Supersedes direction**。**PASS 条件**：new row → existing old row；Assertion→Assertion、Observation→Observation；same Family/Case。**实际结果**：PASS。
- [x] CHK087 **Supersedes immutability**。**PASS 条件**：old row 不删除、不改 content/provenance，不允许 UPDATE old `supersedes_id`。**实际结果**：PASS。
- [x] CHK088 **Cycle prevention**。**PASS 条件**：self-reference reject + append-only direction + no supersedes UPDATE 使正常 production path 无法成环；不要求 graph traversal engine。**实际结果**：PASS。

---

## 9. Message / Idempotency / Transaction / Audit / OpenAPI

- [x] CHK089 **Public route surface**。**PASS 条件**：唯一新增 `POST /api/v1/cases/{id}/messages`。**实际结果**：PASS。
- [x] CHK090 **Request schema**。**PASS 条件**：JSON body 只接受 `content` 且 `additionalProperties=false`；`idempotencyKey` body field 必须拒绝；required `Idempotency-Key` header 为 8..128 chars；content 1..8000 且 whitespace-only reject。**实际结果**：PASS。
- [x] CHK091 **Forbidden client fields**。**PASS 条件**：body 中 `idempotencyKey`/familyId/actorId/person IDs/recordedAt/assertionKind 均不可提交。**实际结果**：PASS。
- [x] CHK092 **Response privacy**。**PASS 条件**：201 只返回 id/caseId/recordedAt，不回显 raw content，避免 idempotency snapshot 复制正文。**实际结果**：PASS。
- [x] CHK093 **Idempotency scope**。**PASS 条件**：`(actor_account_id, CASE_MESSAGE_CREATE, idempotency_key)`，复用 existing table。**实际结果**：PASS。
- [x] CHK094 **Replay/mismatch**。**PASS 条件**：same key+same hash replay 原 status/body；same key+different hash 409；两者零业务新增。**实际结果**：PASS。
- [x] CHK095 **Concurrency**。**PASS 条件**：same-key advisory/shared lock + second lookup → one EXECUTE；different key+same content → 两条独立 raw messages。**实际结果**：PASS。
- [x] CHK096 **Authorization before replay**。**PASS 条件**：specific Case authorization preflight 必须先于 replay；EXECUTE 内 re-read/re-authorize。**实际结果**：PASS — 与 Slice 1 当前 helper 的 fast-peek 历史形状存在依赖差异，但 Plan 已明确 final helper 不支持时必须 Plan Review，不得复制第二 engine。
- [x] CHK097 **Message transaction order**。**PASS 条件**：authenticate → strict body validate → read/validate `Idempotency-Key` header → current Family → Case auth preflight → canonical hash → shared idempotency → BEGIN/RLS → lock → second lookup → re-read/re-authorize → message → audit → snapshot → COMMIT。**实际结果**：PASS。
- [x] CHK098 **Atomic set**。**PASS 条件**：message + business_audit_event + idempotency response 同事务；任一失败全回滚。**实际结果**：PASS。
- [x] CHK099 **Forbidden side effects**。**PASS 条件**：Message transaction 不含 Assertion、Observation、case_event、Formulation、Scene、AI job/background job。**实际结果**：PASS。
- [x] CHK100 **Audit vocabulary**。**PASS 条件**：`MESSAGE_RECORDED/DIALOGUE_MESSAGE`、`ASSERTION_RECORDED/ASSERTION`、`OBSERVATION_RECORDED/OBSERVATION`，不建第二 audit。**实际结果**：PASS。
- [x] CHK101 **Audit metadata**。**PASS 条件**：metadata 固定 `{}`，不得复制 raw message/assertion content/observation value/PII；不镜像 `case_events`。**实际结果**：PASS。
- [x] CHK102 **OpenAPI fixed errors**。**PASS 条件**：401=`UNAUTHENTICATED`；404=`oneOf(CURRENT_FAMILY_NOT_FOUND, CASE_NOT_FOUND)`；409=`oneOf(CURRENT_FAMILY_AMBIGUOUS, IDEMPOTENCY_PAYLOAD_MISMATCH)`；422=`VALIDATION_ERROR`；500=`INTERNAL_ERROR`；均由 schema enum/oneOf 机械限制。**实际结果**：PASS — Plan/Contract 已冻结；实现由 T073–T074 验证。

---

## 10. RLS / Grants / Migration / Dependencies / Testability

- [x] CHK103 **RLS enablement**。**PASS 条件**：三表均 ENABLE + FORCE RLS；runtime `xiaoshuyin_app` 非 owner、NOBYPASSRLS。**实际结果**：PASS — migration verification 已规划为 DB introspection。
- [x] CHK104 **Command-specific policies**。**PASS 条件**：policy 按 SELECT/UPDATE/INSERT 命令分开，不创建可对 INSERT 生效的 generic permissive `FOR ALL` family policy。**实际结果**：PASS — Data Model 只规划 command-specific policy；Implement verification 必须枚举实际 `pg_policies`。
- [x] CHK105 **FACT INSERT effective policy**。**PASS 条件**：对 `assertions INSERT` 唯一有效 runtime 路径必须同时满足 `family_id=app_family_id() AND kind<>'FACT'`；不存在第二 permissive INSERT policy 通过 OR 放宽。**实际结果**：PASS — Plan/Data Model/Security Contract 一致，Quickstart 已给 DB reject test。
- [x] CHK106 **Runtime grants**。**PASS 条件**：messages SELECT/INSERT；assertions SELECT/INSERT + column-level UPDATE(conflict_group_id)；observations 同；DELETE none。**实际结果**：PASS。
- [x] CHK107 **FACT privileged fixture**。**PASS 条件**：真实 FACT row 测试仅隔离 privileged test/migrator context；不复用 production runtime role/import graph/HTTP API。**实际结果**：PASS。
- [x] CHK108 **Migration executable order**。**PASS 条件**：enum → messages → assertions → observations → constraints/indexes/FKs/checks → ENABLE/FORCE RLS → policies → grants → audit CHECK → idempotency CHECK。**实际结果**：PASS。
- [x] CHK109 **Migration provenance**。**PASS 条件**：编号延迟到 Implement Gate 后；读取 main 真实 next migration；不修改旧 migration；先查 `pg_constraint`；禁止 `drizzle-kit push`。**实际结果**：PASS。
- [x] CHK110 **Migration replay/upgrade**。**PASS 条件**：empty PG18 replay + existing DB upgrade 均为 required verification。**实际结果**：PASS。
- [x] CHK111 **Slice 1 dependency**。**PASS 条件**：Implement 前必须 Implement complete + independent Converge PASS + merged main，并重验 Family/Person/guardian/current Family/authorize/RLS tx/idempotency/audit/OpenAPI/roles/CI。**实际结果**：PASS — 当前只读 reality check 不等于 Gate 通过。
- [x] CHK112 **Slice 2 dependency**。**PASS 条件**：同样要求 Implement complete + independent Converge PASS + merged main，并重验 Case schema/authorization/RLS/anti-enumeration/composite key/audit/OpenAPI。**实际结果**：PASS。
- [x] CHK113 **Dependency failure behavior**。**PASS 条件**：任一依赖不满足固定 `BLOCKED — SLICE 3 IMPLEMENTATION DEPENDENCY`；Slice 3 不偷修 Slice 1/2。**实际结果**：PASS。
- [x] CHK114 **Scope audit**。**PASS 条件**：没有 case_participants、Assessment、Problem Formulation、Scene State/Artifact、Goal/Plan/Task、Safety、AI/extractor/RAG/Memory/embeddings/notification、generic Evidence CRUD、FACT confirmation、conflict-resolution engine、correction propagation。**实际结果**：PASS。
- [x] CHK115 **Testability**。**PASS 条件**：每个关键 contract 都有 domain/DB/integration/OpenAPI/governance 可观察证据；无“人工看起来对”作为唯一验收。**实际结果**：PASS。

---

## Findings

**NONE**

没有发现：
- Product clarification blocker；
- Plan-level unresolved blocker；
- security ambiguity；
- provenance ambiguity；
- FACT shortcut；
- API ambiguity；
- dependency ambiguity；
- scope creep。

当前只存在一个**已被 Plan 明确吸收的 Implement-time dependency risk**，不构成 Checklist blocker：

> Slice 1 当前 shared idempotency helper 的 fast replay path 位于业务 validation 之前；Slice 3 已冻结 specific Case authorization 必须先于 replay，且 final helper 若不能安全支持，则 Implement Gate 必须触发 Plan Review，不得复制第二套 idempotency engine。

---

## Review Decision

- **Total CHK**: 115
- **PASS**: 115
- **FAIL**: 0
- **NEEDS REVIEW**: 0
- **FR**: 21 / 21
- **Acceptance Scenarios**: 13 / 13
- **Success Criteria**: 10 / 10
- **Product clarification blockers**: 0
- **Plan-level unresolved blockers**: 0
- **Security ambiguity**: 0
- **Provenance ambiguity**: 0
- **FACT shortcut**: 0
- **API ambiguity**: 0
- **Dependency ambiguity**: 0
- **Scope creep**: 0
- **Decision**: **CHECKLIST PASS**

> Checklist 阶段通过。下一阶段可以进入 Tasks，但本轮在此停止；不得进入 Tasks / Analyze / Implement。
