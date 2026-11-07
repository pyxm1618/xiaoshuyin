# Quickstart — 003-evidence-core（Plan 验证指南）

**阶段**: Plan only。本文描述未来 Implement 完成后的验证路径；当前没有执行业务实现。

## 0. Hard Gate

写任何 Slice 3 code/migration/test 前必须验证：

```bash
git fetch origin
git merge-base --is-ancestor <slice1-final-sha> origin/main
git merge-base --is-ancestor <slice2-final-sha> origin/main
```

并确认 Slice 1/2 均 Implement complete + independent Converge PASS + merged main；检查 final Family/Person/guardian、Case authorization/RLS、shared idempotency、audit、OpenAPI、current Family、CI。

任一失败：

```text
BLOCKED — SLICE 3 IMPLEMENTATION DEPENDENCY
```

不得在 Slice 3 修补依赖 Slice。

## 1. Future migration verification

未来 migration 使用 main 上真实 next filename，reviewed SQL only。

验证：
- 三表存在；
- assertion kind 恰 STATEMENT/FACT/HYPOTHESIS；
- observations 独立；
- 三表 ENABLE+FORCE RLS；
- `assertions` runtime INSERT policy = current Family + `kind <> 'FACT'`；
- runtime role 非 owner / NOBYPASSRLS；
- Case/Family composite FKs；
- Family/Person composite FKs；
- source_message provenance FK；
- 只有 conflict_group_id 可 UPDATE；
- idempotency whitelist 含 CASE_MESSAGE_CREATE；
- audit whitelist 含三类新 write event/resource；
- empty PG18 replay + existing DB upgrade 都通过。

## 2. Public message happy path

```http
POST /api/v1/cases/{caseId}/messages
Authorization: Bearer <token>
Content-Type: application/json
Idempotency-Key: msg-test-0001

{
  "content": "孩子最近晚上总说还不想睡。"
}
```

期望：
- 201；
- response 只有 id/caseId/recordedAt；
- dialogue_messages +1；
- business_audit_events +1；
- assertions +0；
- observations +0；
- case_events +0；
- recorded_at server-owned；
- audit metadata 无 content。

## 3. Idempotency

### same key + same content
返回原 status/body；message/audit 不增加；assertion 仍 0。

### same key + different content
```text
409 IDEMPOTENCY_PAYLOAD_MISMATCH
```
零新业务写。

### concurrent duplicate
真实 DB 并发至少 20 个相同请求：
- 恰 1 message；
- 恰 1 audit；
- replay 指向同 message id；
- 无 in-memory/request-id dedupe。

## 4. Authorization / anti-enumeration

验证：
1. current Family 管理主体可写自己的 Case；
2. ordinary member 但不是 approved Case actor 不可写；
3. guardian + member 但不是 approved Case actor 不可写；
4. guardian 但不属于目标 Family时 Family layer fail closed；
5. 跨 Family已知 Case UUID 与不存在/无权 Case 的 external response 不泄露差异；
6. wrong RLS family context 查询三表 0 rows，写 denied。

## 5. Person reference security

internal/domain/DB tests：
- Family A member refs allowed only under authorized Case context；
- Family A → Family B-only Person rejected；
- guardian relationship alone 不改变结果；
- UUID 不存在与跨 Family-only 不向 public caller暴露可区分细节；
- Evidence Core 不创建 Person；
- source_message 与 evidence family/case/source person 必须一致。

## 6. Provenance admissibility

逐项验证现有 8 个 `provenance_source`：

- SELF_STATEMENT → `recordStatement`，source=subject；
- GUARDIAN_OBSERVATION → `recordObservation` only，guardian source→subject relation 必须真实；
- GUARDIAN_RELAY → `recordStatement` only，guardian source→subject relation 必须真实；
- OTHER_MEMBER_RELAY → `recordStatement` only，source/subject 都是当前 Family member 且 source≠subject；
- MANUAL_DEVICE_DATA / STAFF_RECORD / AI_HYPOTHESIS / SOURCE_CONFIRMED → current production fail closed；
- guardian relation 本身不能获得 Family/Case access；
- `recordHypothesis` 不构成当前 AI runtime path。

## 7. Observation states

逐一 round-trip：
- KNOWN text；
- KNOWN number 0；
- KNOWN boolean false；
- UNKNOWN；
- NOT_COLLECTED；
- DECLINED；
- NOT_APPLICABLE。

断言未知状态无 value；0/false 不被转换成 unknown。

## 8. Occurred / recorded time

- occurred KNOWN + timestamp 成功；
- occurred UNKNOWN + NULL 成功；
- KNOWN+NULL / UNKNOWN+timestamp 均失败；
- recorded_at caller 不可提交且由 server产生；
- 不用 recorded_at 代填 occurred_at。

## 9. Conflict

构造两个来源相冲突：
- 两条都保留；
- 同 conflict_group_id；
- no winner/confidence/rank；
- no FACT side effect；
- group 不可迁移；
- 可跨 Assertion/Observation。

## 10. Supersedes

- 新 row 指向旧 row；
- old row仍存在；
- self-reference拒绝；
- cross-Case/cross-Family supersedes拒绝；
- 旧 row 的 `supersedes_id` UPDATE 被拒绝；
- content/provenance 不原地覆盖；
- 仅靠 append-only `new → existing old` + no supersedes UPDATE 即证明 production path 无法形成 cycle；不要求 graph cycle detector。

## 11. FACT reachability

机械验证：
- DB enum包含 FACT；
- domain union包含 FACT；
- `xiaoshuyin_app` + 正确 Family RLS context + `INSERT assertions(kind='FACT')` → DB reject；
- 同一 runtime role 下 STATEMENT/HYPOTHESIS 在其它 validations 通过时 → allowed；
- production exports/routes 不含 recordFact/createFact/confirmFact/promoteToFact/createAssertion(kind)；
- test-only FACT fixture 只能使用隔离 privileged test/migrator context，且不被 production import graph 引用；
- public route list 无 assertions/observations/evidence；
- future Fact Confirmation Slice 若开放 FACT，必须显式变更 DB policy/contract。

## 12. OpenAPI

未来生成并检查：

```bash
bun run openapi:generate
bun run openapi:check
```

断言只新增 `POST /api/v1/cases/{id}/messages`；request strict；无 generic Evidence CRUD；response 不回显 content。

并对错误 schema 做机械校验：

- 401 → `UNAUTHENTICATED`
- 404 → `oneOf(CURRENT_FAMILY_NOT_FOUND, CASE_NOT_FOUND)`
- 409 → `IDEMPOTENCY_PAYLOAD_MISMATCH`
- 422 → `VALIDATION_ERROR`
- 500 → `INTERNAL_ERROR`

不得只靠 description/example 约定 code。

## 13. Final future verification

未来 Implement 完成后：

```bash
bun run typecheck
bun run guard:static
bunx vitest run tests/domain
bunx vitest run tests/db
bunx vitest run tests/integration
bun run openapi:check
node .specify/scripts/validate-governance.mjs
node .specify/scripts/tests/run-governance-tests.mjs
```

再跑真实 feature-branch CI；之后交给全新 AI 做 independent Converge。
