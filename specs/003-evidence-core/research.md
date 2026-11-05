# Research / Technical Decisions — Slice 3 Evidence Core

**Status**: Plan support only  
**Authority**: Docs > this file

## R1 — Slice 3 为什么是 Evidence Core

Slice 1 交付身份/家庭/Consent/Authorization，Slice 2 交付 Case 容器。Phase 1 紧接的通用依赖是 V1-C02/C03 的 Evidence 分层；Problem Formulation、Digital Use Assessment、AI 都依赖真实 Evidence，因此先建立 Evidence Core，避免后续每个场景重新发明来源/冲突/未知语义。

**Decision**: Slice 3 = Evidence Core。  
**Rejected**: 直接进入 Problem Formulation / Digital Use / AI。

## R2 — message 不自动等于 Statement

自然语言 message 可能包含多个陈述、问题、请求、情绪表达，甚至没有可结构化陈述。

**Decision**: message只保存原始输入；Assertion由后续明确 caller引用 source_message_id 创建。  
**Rejected**: 一 message 自动一 Statement；自动 Fact extraction。

## R3 — 不做万能 Evidence superclass

§7.2 已明确 dialogue_messages / assertions / observations 分开；V1-C02要求 Observation 与 Statement/Fact/Hypothesis 可区分。

**Decision**: 三表/三领域类型。  
**Rejected**: `evidence_items(type,jsonb)` 单表。

## R4 — 复用 provenance_source

Slice 1 已按产品 §2.2 建完整 8 类 `provenance_source`。

**Decision**: 直接复用。  
**Rejected**: 新建 `evidence_source`、缩成 self/other 二值、按 Account 推断来源。

## R5 — FACT 无 public write path

当前 §28.3 没有 generic Fact endpoint，且 Problem Formulation / Participant confirmation 尚未交付。

**Decision**: schema/domain可表达 FACT，但 Slice 3 不开放 public Fact create/confirm。  
**Rejected**: 为了测试方便新建 /facts；AI confidence→FACT。

## R6 — HYPOTHESIS 无 AI runtime

Phase 3 才进入 AI runtime。

**Decision**: HYPOTHESIS 只作为 domain/schema contract存在，用 deterministic fixture验证。  
**Rejected**: Slice 3 接模型。

## R7 — Unknown states 不做万能列

UNKNOWN / NOT_COLLECTED / DECLINED / N/A / CONFLICT / EXPIRED 跨不同实体含义不同。

**Decision**:
- Assertion：confirmation/conflict/validity；
- Observation：value_state + conflict/validity；
- future Scene/Assessment：后续按 node semantics设计。

**Rejected**: universal epistemic_state enum。

## R8 — Conflict 是多记录关系

冲突的本质是多个真实来源并存。

**Decision**: `conflict_group_id` 关联，全部记录保留。  
**Rejected**: latest wins、可信度排序、winner_id、把 conflict 变成一个合成 Fact。

## R9 — Supersession 使用 insert-new-history

为了不抹掉原 content/source/time：

**Decision**: 新行 `supersedes_id` 指向旧行；旧行不DELETE、不改正文/source。  
**Rejected**: UPDATE 原记录 content/source。

## R10 — message 幂等复用 shared contract

V1-C28要求网络重试不重复业务结果。

**Decision**: `CASE_MESSAGE_CREATE` 复用 `idempotency_keys`。  
**Rejected**: content hash dedupe、第二张 message_dedup 表、按文本相同去重（会误杀用户真实重复表达）。

## R11 — 当前 HTTP actor 边界

Participant未实现，不能猜 child permission。

**Decision**: Slice 3 message route沿用 Slice 2 current Family manager Case access。  
**Rejected**: membership即Case内容权限；guardian即Case内容权限；已知caseId即权限。

## R12 — Observation 最小表达

Observation需要能表达“已知内容”以及“不知道/未收集/拒绝/不适用”，且保持来源/时间。

**Decision**: `content nullable + value_state`，CONFLICT由group表达、EXPIRED由validity表达。  
**Rejected**: content='0' / 'false' / 'unknown'字符串冒充状态；为未来场景提前建复杂 metric/value union。

## R13 — Audit metadata 不复制正文

Evidence正文敏感，audit/event只需证明动作发生。

**Decision**: metadata只存资源ID/版本标记，不复制content。  
**Rejected**: 把message/assertion正文写入case_events/business_audit_events。
