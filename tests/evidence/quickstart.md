# T070 — quickstart.md §2 端到端主路径（真实请求记录）

Audited / executed Head: `0480e38bae411348214ec911e64a18bbeb7c8bfb`

执行时间: 2026-11-07T05:55:07.696Z
运行环境: NODE_ENV=test；runtimeConsentChannel=TEST

说明：通过 Fastify `app.inject` 调用真实路由（与 integration 测试同一套 handler / auth hook / RLS 事务 / PostgreSQL）；
每个状态码、请求头、请求体与响应字段均来自实际响应；DB 断言来自真实 SQL 查询；token 仅显示前缀。

契约基线：冻结 OpenAPI `identity-family-api.openapi.yaml` 与 `packages/contracts/src/schemas.ts`。
所有 mutating command 均使用 HTTP header `Idempotency-Key`，请求/响应形状与冻结 OpenAPI 完全一致。

### 段 1 — 登录（quickstart §2.1 ①）

**真实请求**

```http
POST /api/v1/auth/wechat
content-type: application/json
```

```json
{
  "code": "qs-parent-a-1794030907833"
}
```

**真实状态码**: `200`

**关键响应字段（实际）**

```json
{
  "accountId": "01a1b493-31e5-743a-bafa-2f3db6df70ad",
  "personId": "01a1b493-31ec-74b0-a9e2-3b500c78476e",
  "personCreatedAt": "2026-11-07T05:55:07.870Z",
  "profilePresent": false,
  "sessionToken": "eyJhY2NvdW50…(150 chars)",
  "wechatOpenidPresent": false
}
```

**预期**: 200；accountId / person 非空、profile 尚未写入；响应不出现 wechat_openid

**实际**: 实际 200；Account 01a1b493-31e5-743a-bafa-2f3db6df70ad 与 Person 01a1b493-31ec-74b0-a9e2-3b500c78476e 由登录建立，profile 未写入，响应不含 wechat_openid

**判定**: PASS

### 段 2 — 建家庭 + 空态 + 身份 + 幂等（quickstart §2.1 ①-2 / ② / ③）

**真实请求**

```http
POST /api/v1/families
authorization: Bearer ***
idempotency-key: qs-fam-1794030907833
content-type: application/json
```

```json
{
  "displayName": "A 家",
  "creator": {
    "ageBand": "ADULT",
    "ageBandSource": "SELF_STATEMENT",
    "values": [
      {
        "attribute": "DISPLAY_NAME",
        "value": "家长 A",
        "source": "SELF_STATEMENT"
      }
    ]
  }
}
```

**真实状态码**: `201`

**关键响应字段（实际）**

```json
{
  "emptyCurrentFamily": {
    "status": 404,
    "code": "CURRENT_FAMILY_NOT_FOUND"
  },
  "createFamily": {
    "status": 201,
    "id": "01a1b493-320c-7957-8940-cd41f42acb15",
    "isManager": true,
    "createdAt": "2026-11-07T05:55:07.914Z"
  },
  "me": {
    "status": 200,
    "accountId": "01a1b493-31e5-743a-bafa-2f3db6df70ad",
    "personId": "01a1b493-31ec-74b0-a9e2-3b500c78476e"
  },
  "replaySameKey": {
    "status": 201,
    "sameFamilyId": true
  },
  "sameKeyDifferentPayload": {
    "status": 409,
    "code": "IDEMPOTENCY_PAYLOAD_MISMATCH"
  }
}
```

**预期**: 空态 404 CURRENT_FAMILY_NOT_FOUND；建家庭 201 且 isManager=true；/me 不出现 wechat_openid；同 key 重放返回同一家庭；同 key 改 payload → 409

**实际**: 实际：空态 404/CURRENT_FAMILY_NOT_FOUND；建家庭 201；/me 200；重放 201（同 id=true）；改 payload 409/IDEMPOTENCY_PAYLOAD_MISMATCH

**判定**: PASS

### 段 3 — 无账号成员 + 逐值来源（quickstart §2.2）

**真实请求**

```http
POST /api/v1/families/01a1b493-320c-7957-8940-cd41f42acb15/members
authorization: Bearer ***
idempotency-key: qs-mem-1794030907833
content-type: application/json
```

```json
{
  "ageBand": "MINOR_14_17",
  "ageBandSource": "GUARDIAN_OBSERVATION",
  "values": [
    {
      "attribute": "DISPLAY_NAME",
      "value": "小雨",
      "source": "GUARDIAN_RELAY"
    }
  ]
}
```

**真实状态码**: `201`

**关键响应字段（实际）**

```json
{
  "createMember": {
    "status": 201,
    "personId": "01a1b493-3230-7396-b05e-9a84108218b6",
    "familyId": "01a1b493-320c-7957-8940-cd41f42acb15",
    "accountBound": false,
    "values": [
      {
        "id": "01a1b493-3232-7348-acb7-722855465a80",
        "attribute": "DISPLAY_NAME",
        "value": "小雨",
        "source": "GUARDIAN_RELAY",
        "providedByPersonId": "01a1b493-31ec-74b0-a9e2-3b500c78476e",
        "observedAt": null,
        "recordedAt": "2026-11-07T05:55:07.949Z",
        "status": "RECORDED",
        "supersedesId": null
      }
    ]
  },
  "patchSecondSource": {
    "status": 200,
    "values": [
      {
        "id": "01a1b493-3232-7348-acb7-722855465a80",
        "attribute": "DISPLAY_NAME",
        "value": "小雨",
        "source": "GUARDIAN_RELAY",
        "providedByPersonId": "01a1b493-31ec-74b0-a9e2-3b500c78476e",
        "observedAt": null,
        "recordedAt": "2026-11-07T05:55:07.949Z",
        "status": "RECORDED",
        "supersedesId": null
      },
      {
        "id": "01a1b493-323f-7306-811c-6d04c21ac604",
        "attribute": "DISPLAY_NAME",
        "value": "小雨",
        "source": "SELF_STATEMENT",
        "providedByPersonId": "01a1b493-3230-7396-b05e-9a84108218b6",
        "observedAt": null,
        "recordedAt": "2026-11-07T05:55:07.962Z",
        "status": "RECORDED",
        "supersedesId": null
      }
    ]
  },
  "recordedValuesInDb": [
    {
      "source_kind": "SELF_STATEMENT",
      "status": "RECORDED",
      "provided_by_person_id": "01a1b493-3230-7396-b05e-9a84108218b6",
      "observed_at": null
    },
    {
      "source_kind": "GUARDIAN_RELAY",
      "status": "RECORDED",
      "provided_by_person_id": "01a1b493-31ec-74b0-a9e2-3b500c78476e",
      "observed_at": null
    }
  ]
}
```

**预期**: 201，accountBound=false；PATCH 后 DISPLAY_NAME 两条 RECORDED 来源并存（GUARDIAN_RELAY 与 SELF_STATEMENT）

**实际**: 实际：建成员 201（accountBound=false）；PATCH 200；库中 RECORDED 来源 = [SELF_STATEMENT/RECORDED, GUARDIAN_RELAY/RECORDED]

**判定**: PASS

### 段 4 — UNDER_14 consent-first（quickstart §2.3 ①—④）

**真实请求**

```http
POST /api/v1/compliance/guardian-consents/requests
authorization: Bearer ***
idempotency-key: qs-req-1794030907833
content-type: application/json
```

```json
{
  "declaredAgeBand": "UNDER_14",
  "noticeVersion": "v1",
  "channel": "TEST"
}
```

**真实状态码**: `201`

**关键响应字段（实际）**

```json
{
  "noticeCatalog": {
    "status": 200,
    "version": "v1",
    "purpose": "UNDER_14_GUARDIAN_CONSENT"
  },
  "onboardingRequest": {
    "status": 201,
    "requestId": "01a1b493-324d-7075-9b90-e6837c253eb0",
    "declaredAgeBand": "UNDER_14",
    "noticeHash": "2f8bf14402d5a32ba9e399477567fe763a859a64af416fa68c7784485e2246bf",
    "statusField": "PENDING",
    "expiresAt": "2026-11-08T05:55:07.977Z"
  },
  "withoutConsent": {
    "status": 403,
    "code": "GUARDIAN_CONSENT_REQUIRED",
    "familyMembersAfterDeny": 2
  },
  "grant": {
    "status": 201,
    "id": "01a1b493-3260-71ee-97dc-d0761e0fff11",
    "decision": "GRANTED",
    "version": 1,
    "boundPersonId": null,
    "onboardingRequestId": "01a1b493-324d-7075-9b90-e6837c253eb0"
  },
  "childCreated": {
    "status": 201,
    "personId": "01a1b493-3272-7c4b-a082-63d28f975353",
    "ageBand": "UNDER_14"
  },
  "childProfileInDb": {
    "age_band": "UNDER_14",
    "minor_mode": true,
    "verified_source": "GUARDIAN_RELAY",
    "guardian_person_id": "01a1b493-31ec-74b0-a9e2-3b500c78476e",
    "guardian_consent_version": 1,
    "guardian_consent_record_id": "01a1b493-3260-71ee-97dc-d0761e0fff11"
  },
  "consentEvidenceInDb": {
    "channel": "TEST",
    "client_ip_hash": "15e7a0019709781c2804a7a600dea7967d094d6594a1337e738301578cb82862",
    "user_agent_hash": "6d2df5793997843cb3c32465d1845c434c029fb4bebfa90b743bd514bba66ccf",
    "declared_age_band": "UNDER_14",
    "accepted_text_hash": "86a9679a0d9f135ddf3d2485fab6906c0f7d5450d177d324d216024bc1cc3bdb"
  }
}
```

**预期**: request 201 且无儿童资料、channel 与运行环境一致；无 guardianConsentId 建 UNDER_14 → 403 且不建 Person/profile；grant 201 GRANTED v1；带 consent 建档 201，profile.ageBand=UNDER_14、guardian 与 consent 版本一致；evidence.channel 与运行环境一致

**实际**: 实际：request 201（requestId=01a1b493-324d-7075-9b90-e6837c253eb0）；无同意建档 403/GUARDIAN_CONSENT_REQUIRED（family_members 仍 2 行）；grant 201/GRANTED v1；建档 201，profile={"age_band":"UNDER_14","minor_mode":true,"verified_source":"GUARDIAN_RELAY","guardian_person_id":"01a1b493-31ec-74b0-a9e2-3b500c78476e","guardian_consent_version":1,"guardian_consent_record_id":"01a1b493-3260-71ee-97dc-d0761e0fff11"}，evidence.channel=TEST

**判定**: PASS

### 段 5 — 撤回同意（quickstart §2.3 ⑤）

**真实请求**

```http
POST /api/v1/consents/01a1b493-3260-71ee-97dc-d0761e0fff11/revoke
authorization: Bearer ***
idempotency-key: qs-revoke-1794030907833
content-type: application/json
```

```json
{
  "reason": "quickstart evidence revoke"
}
```

**真实状态码**: `200`

**关键响应字段（实际）**

```json
{
  "revoke": {
    "status": 200,
    "id": "01a1b493-3284-7def-95e7-8ad3bea86a83",
    "decision": "REVOKED",
    "version": 2,
    "supersedesId": "01a1b493-3260-71ee-97dc-d0761e0fff11"
  },
  "consentChainInDb": [
    {
      "decision": "GRANTED",
      "version": 1,
      "onboarding_request_id": "01a1b493-324d-7075-9b90-e6837c253eb0",
      "supersedes_id": null,
      "bound_person_id": "01a1b493-3272-7c4b-a082-63d28f975353"
    },
    {
      "decision": "REVOKED",
      "version": 2,
      "onboarding_request_id": null,
      "supersedes_id": "01a1b493-3260-71ee-97dc-d0761e0fff11",
      "bound_person_id": "01a1b493-3272-7c4b-a082-63d28f975353"
    }
  ],
  "profilePointer": {
    "guardian_consent_record_id": "01a1b493-3284-7def-95e7-8ad3bea86a83",
    "guardian_consent_version": 2
  }
}
```

**预期**: 200 REVOKED v2；v1 GRANTED 保留不变；v2 supersedes_id 指向 v1 且 onboarding_request_id 为 NULL；profile 指针前移

**实际**: 实际：200/REVOKED v2；链 = [GRANTED v1 → REVOKED v2]；profile 指针 v2

**判定**: PASS

### 段 6 — 跨家庭隔离（quickstart §2.4）

**真实请求**

```http
PATCH /api/v1/families/01a1b493-320c-7957-8940-cd41f42acb15/members/01a1b493-3230-7396-b05e-9a84108218b6
authorization: Bearer ***
idempotency-key: qs-cross-1794030907833
content-type: application/json
```

```json
{
  "values": [
    {
      "attribute": "DISPLAY_NAME",
      "value": "hack",
      "source": "GUARDIAN_RELAY"
    }
  ]
}
```

**真实状态码**: `403`

**关键响应字段（实际）**

```json
{
  "secondActorLogin": 200,
  "secondFamily": {
    "status": 201,
    "id": "01a1b493-3291-7349-babe-629f40bed0c6"
  },
  "crossFamilyPatch": {
    "status": 403,
    "code": "NOT_FAMILY_MEMBER",
    "body": {
      "code": "NOT_FAMILY_MEMBER",
      "message": "NOT_FAMILY_MEMBER"
    }
  },
  "containsTargetIds": false
}
```

**预期**: 403（统一拒绝码），响应体不含 A 家 / 成员的任何 id 或字段

**实际**: 实际：B 家 201；跨家庭 PATCH 403/NOT_FAMILY_MEMBER；响应体含目标 id=false

**判定**: PASS

## 契约一致性与偏差说明

| 项 | 当前执行 | 说明 |
|---|---|---|
| `Idempotency-Key` | HTTP header | 与冻结 OpenAPI 的 header parameter 完全一致 |
| 建家庭 | `creator { ageBand, ageBandSource, values }` | 与冻结 `CreateFamilyRequest` 完全一致 |
| 成员 / PATCH | `values[] { attribute, value, source, observedAt? }` | 与冻结 `ProvenanceValueInput` / `UpdateMemberRequest` 完全一致 |
| consent request | `declaredAgeBand, noticeVersion, channel, existingSubjectPersonId?` | 与冻结 `CreateConsentRequestRequest` 一致；`channel` 必须等于运行环境 channel |
| grant | `onboardingRequestId, noticeVersion, accepted: true` | 与冻结 `GrantConsentRequest` 完全一致 |
| revoke | header key + 可选 `reason` | 与冻结 `RevokeConsentRequest` 一致 |
| 传输 | Fastify `app.inject` | 与 integration 测试同一套真实 handler / auth hook / RLS / PostgreSQL；未使用 curl 仅为规避本机网络代理限制 |
| `noticeVersion` | `v1` | `packages/compliance/src/notices.ts` 当前目录只有 v1 |

## 六段结果汇总

| 段 | 标题 | 判定 |
|---|---|---|
| 1 | 登录（quickstart §2.1 ①） | PASS |
| 2 | 建家庭 + 空态 + 身份 + 幂等（quickstart §2.1 ①-2 / ② / ③） | PASS |
| 3 | 无账号成员 + 逐值来源（quickstart §2.2） | PASS |
| 4 | UNDER_14 consent-first（quickstart §2.3 ①—④） | PASS |
| 5 | 撤回同意（quickstart §2.3 ⑤） | PASS |
| 6 | 跨家庭隔离（quickstart §2.4） | PASS |

quickstart-evidence: PASS (6/6)
