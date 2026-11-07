# Contract — Authorization, Person References, RLS, Idempotency & Transactions

**Feature**: `003-evidence-core`  
**阶段**: Plan

## 1. Authorization layers

### Application authorization

public Message 写入只复用 Slice 2 final 已批准的 Case management actor path。

以下均不能单独授予 Evidence 权限：
- Family membership；
- guardian relationship；
- 知道 caseId；
- 知道 personId。

Internal Evidence write 也必须携带已授权 Family/Case context；当前无 Participant，因此不能发明 Participant 权限。

### RLS

默认 RLS 负责 Family isolation：

```text
family_id = app_family_id()
```

但 `assertions INSERT` 还有 Q5 要求的数据库最后防线：

```text
WITH CHECK (
  family_id = app_family_id()
  AND kind <> 'FACT'
)
```

因此 `xiaoshuyin_app` 即使 Family context 正确也不能直接 INSERT FACT。这个 guard 不替代 manager/Case/Purpose/Person-reference business authorization，也不实现 Fact confirmation；future Fact Confirmation Slice 必须显式修改 policy/contract 才能开放。

## 2. Person reference validation

当 subject/source person 非空：

1. Case 已在 target Family context 中合法读取；
2. application authorization 已通过；
3. Person 必须存在于 target Family 的 `family_members`；
4. guardian relationship 不能替代 membership；
5. UNDER_14 Person 必须是 Slice 1 已合法存在的 Person；Evidence Core 不创建 Person；
6. source message存在时还要验证 same Family/Case/source person。

数据库用 composite FK 防止跨 Family-only Person 被引用。

对 caller 的失败语义不得暴露：
- Person UUID 是否全局存在；
- 其属于哪个其它 Family；
- guardian/compliance 私密细节。

统一 domain reason：`EVIDENCE_PERSON_REFERENCE_INVALID`，HTTP 如未来暴露由对应正式 route映射，不透传 raw FK/RLS 错误。

## 3. Message public command

唯一 route：

```text
POST /api/v1/cases/:id/messages
```

唯一 command type：

```text
CASE_MESSAGE_CREATE
```

HTTP transport：

```http
Idempotency-Key: <8..128 chars>
```

JSON body：

```json
{
  "content": "..."
}
```

body 不包含 `idempotencyKey`；不得双轨。该 transport 与 final main 冻结合同一致。

## 4. Idempotency scope

沿用 shared key：

```text
(actor_account_id, command_type, idempotency_key)
```

不得新增 message-specific table/cache/request-id。

Canonical hash：

```text
sha256(canonicalJson({
  familyId: verifiedFamilyId,
  caseId: verifiedCaseId,
  body: { content: exactRawStoredContent }
}))
```

- actor/command 不重复进 hash；
- `Idempotency-Key` header 值不进 hash；
- familyId/caseId 只来自 server-verified context；
- content 使用实际存储字符串，不做 trim 后存储。

## 5. Replay / mismatch / concurrency

| input | outcome |
|---|---|
| same scope key + same hash | replay stored status/body |
| same scope key + different hash | 409 IDEMPOTENCY_PAYLOAD_MISMATCH |
| concurrent same scope key | shared lock serializes；only one EXECUTE |
| different key + same content | separate messages |

Replay/Mismatch 不增加 message/audit/assertion/observation。

## 6. Authorization before replay

specific Case replay 不得绕过当前 authorization。

顺序：

```text
authenticate
→ strict validate
→ resolve current Family
→ RLS-scoped load Case
→ Case management authorize
→ compute hash
→ shared replay/mismatch/execute
```

EXECUTE transaction 内再次 load/authorize，防止 preflight 与写入间 context drift。

若 Slice 1 final helper强制在 authorization 前 peek，Slice 3 必须 Plan Review/refactor shared helper at approved seam；不得复制第二份 idempotency engine。

## 7. Message transaction

首次 EXECUTE：

```text
BEGIN
set identity/family RLS context
same-key shared lock
second idempotency lookup
re-read Case
re-authorize
INSERT dialogue_messages
INSERT business_audit_events
persist idempotency response snapshot
COMMIT
```

原子集合：
- message
- business audit
- idempotency response

不存在：
- automatic Assertion
- Observation
- case_event
- AI run
- background job

任一失败整体 rollback。

## 8. Internal Evidence transaction

```text
BEGIN in authorized family/case context
→ revalidate Case/Family
→ validate subject/source Person refs
→ validate provenance source against the frozen 8-row Slice 3 admissibility matrix
→ validate guardian/source/subject relationship where required
→ validate source message
→ validate time/value/validity/supersedes
→ optional conflict-group annotation
→ INSERT exact evidence row
→ INSERT business audit
→ COMMIT
```

当前没有 public caller，也没有 FACT caller。

## 9. Anti-enumeration

specific Case message：
- current Family无法合法解析：沿用 Slice 1 final Family error；
- Family 已合法解析但 Case 不存在/cross-family/Case actor无权：沿用 Slice 2 final indistinguishable `CASE_NOT_FOUND`；
- response 不含目标 Family/Case内部字段。

## 10. Audit

`case_events` 不扩展。

`business_audit_events`：
- MESSAGE_RECORDED / DIALOGUE_MESSAGE
- ASSERTION_RECORDED / ASSERTION
- OBSERVATION_RECORDED / OBSERVATION

metadata = `{}`；禁止 raw message/evidence content/value/PII。

## 11. Implement Gate

Slice 1/2 final contract未满足时固定：

```text
BLOCKED — SLICE 3 IMPLEMENTATION DEPENDENCY
```

不得临时改 Slice 1/2 schema/authorization/RLS/idempotency 来让 Slice 3继续。
