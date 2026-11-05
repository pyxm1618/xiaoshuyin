# T070 — quickstart.md §2 端到端主路径（真实请求记录）

执行时间: 2026-11-05T07:11:50.972Z

说明：通过 Fastify `app.inject` 调用真实路由（与 integration 测试同一套 handler / auth hook / RLS 事务 / PostgreSQL）；
每个状态码与响应字段均来自实际响应，数据库断言来自真实 SQL 查询；token 仅显示前缀。

> 传输方式偏差：本机 :8787 被沙箱网络代理拦截（curl 返回 `502 upstream connect failed`），
> 因此未使用 quickstart §2 的 curl，改用进程内真实 HTTP 语义注入。见文末偏差表。

### 段 1 — 登录（quickstart §2.1 ①）

**真实请求**

```http
POST /api/v1/auth/wechat
content-type: application/json
```

```json
{
  "code": "qs-parent-a-1793862711082"
}
```

**真实状态码**: `201`

**关键响应字段（实际）**

```json
{
  "statusCode": 201,
  "accountId": "01a1aa8c-b77f-7519-ac05-1f7d4c76a9a2",
  "personId": "01a1aa8c-b780-7d9c-8715-7637fcc327c0",
  "personProfile": null,
  "token": "eyJhY2NvdW50…(150 chars)",
  "wechatOpenidPresent": false
}
```

**quickstart 预期**: 200/201；person 非空、profile 尚未写入；响应不出现 wechat_openid

**实际**: 实际 201；Account 01a1aa8c-b77f-7519-ac05-1f7d4c76a9a2 与 Person 01a1aa8c-b780-7d9c-8715-7637fcc327c0 由登录建立，profile=null，响应不含 wechat_openid

**判定**: PASS

### 段 2 — 建家庭 + 空态 + 身份 + 幂等（quickstart §2.1 ①-2 / ② / ③）

**真实请求**

```http
POST /api/v1/families
content-type: application/json
```

```json
{
  "displayName": "A 家",
  "ageBand": "ADULT",
  "ageBandSource": "SELF_STATEMENT",
  "idempotencyKey": "qs-fam-1793862711082"
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
    "id": "a076974f-de00-4251-92ad-266b76c422cf",
    "isManager": true
  },
  "me": {
    "status": 200,
    "body": {
      "account": {
        "id": "01a1aa8c-b77f-7519-ac05-1f7d4c76a9a2",
        "createdAt": "2026-11-05T07:11:51.165Z",
        "lastLoginAt": null
      },
      "person": {
        "id": "01a1aa8c-b780-7d9c-8715-7637fcc327c0",
        "profile": {
          "ageBand": "ADULT",
          "minorMode": false,
          "verifiedSource": "SELF_STATEMENT"
        },
        "values": []
      }
    }
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

**quickstart 预期**: 空态 404 CURRENT_FAMILY_NOT_FOUND；建家庭 201 且 isManager=true；/me 不出现 wechat_openid；同 key 重放返回同一家庭；同 key 改 payload → 409

**实际**: 实际：空态 404/CURRENT_FAMILY_NOT_FOUND；建家庭 201；/me 200；重放 201（同 id=true）；改 payload 409/IDEMPOTENCY_PAYLOAD_MISMATCH

**判定**: PASS

### 段 3 — 无账号成员 + 逐值来源（quickstart §2.2）

**真实请求**

```http
POST /api/v1/families/a076974f-de00-4251-92ad-266b76c422cf/members
content-type: application/json
```

```json
{
  "ageBand": "MINOR_14_17",
  "ageBandSource": "GUARDIAN_OBSERVATION",
  "profileValues": [
    {
      "attribute": "DISPLAY_NAME",
      "valueText": "小雨",
      "sourceKind": "GUARDIAN_RELAY"
    }
  ],
  "idempotencyKey": "qs-mem-1793862711082"
}
```

**真实状态码**: `201`

**关键响应字段（实际）**

```json
{
  "createMember": {
    "status": 201,
    "personId": "6984b8a6-eb51-47a6-a1f6-80a75490f1f9",
    "accountBound": false
  },
  "patchSecondSource": {
    "status": 200
  },
  "recordedValuesInDb": [
    {
      "source_kind": "SELF_STATEMENT",
      "status": "RECORDED"
    },
    {
      "source_kind": "GUARDIAN_RELAY",
      "status": "RECORDED"
    }
  ]
}
```

**quickstart 预期**: 201，accountBound=false；PATCH 后 DISPLAY_NAME 两条 RECORDED 来源并存（GUARDIAN_RELAY 与 SELF_STATEMENT）

**实际**: 实际：建成员 201（accountBound=false）；PATCH 200；库中 RECORDED 来源 = [SELF_STATEMENT/RECORDED, GUARDIAN_RELAY/RECORDED]

**判定**: PASS

### 段 4 — UNDER_14 consent-first（quickstart §2.3 ①—④）

**真实请求**

```http
POST /api/v1/compliance/guardian-consents/requests
content-type: application/json
```

```json
{
  "noticeVersion": "v1",
  "idempotencyKey": "qs-req-1793862711082"
}
```

**真实状态码**: `201`

**关键响应字段（实际）**

```json
{
  "noticeCatalog": {
    "status": 200,
    "version": "v1"
  },
  "onboardingRequest": {
    "status": 201,
    "id": "01a1aa8c-b7b6-731b-9089-9f48424b503e",
    "statusField": "PENDING",
    "expiresAt": "2026-11-06T07:11:51.219Z"
  },
  "withoutConsent": {
    "status": 403,
    "code": "GUARDIAN_CONSENT_REQUIRED",
    "familyMembersAfterDeny": 2
  },
  "grant": {
    "status": 201,
    "id": "01a1aa8c-b7c2-7404-9f02-fa2c79709e10",
    "decision": "GRANTED",
    "version": 1,
    "boundPersonId": null
  },
  "childCreated": {
    "status": 201,
    "personId": "b1b912f0-fa93-4992-940f-6f74258b5873",
    "ageBand": "UNDER_14"
  },
  "childProfileInDb": {
    "age_band": "UNDER_14",
    "minor_mode": true,
    "verified_source": "GUARDIAN_RELAY",
    "guardian_person_id": "01a1aa8c-b780-7d9c-8715-7637fcc327c0",
    "guardian_consent_version": 1,
    "guardian_consent_record_id": "01a1aa8c-b7c2-7404-9f02-fa2c79709e10"
  }
}
```

**quickstart 预期**: request 201 且无儿童资料；无 guardianConsentId 建 UNDER_14 → 403 且不建 Person/profile；grant 201 GRANTED v1；带 consent 建档 201，profile.ageBand=UNDER_14、guardian 与 consent 版本一致

**实际**: 实际：request 201；无同意建档 403/GUARDIAN_CONSENT_REQUIRED（family_members 仍 2 行）；grant 201/GRANTED v1；建档 201，profile={"age_band":"UNDER_14","minor_mode":true,"verified_source":"GUARDIAN_RELAY","guardian_person_id":"01a1aa8c-b780-7d9c-8715-7637fcc327c0","guardian_consent_version":1,"guardian_consent_record_id":"01a1aa8c-b7c2-7404-9f02-fa2c79709e10"}

**判定**: PASS

### 段 5 — 撤回同意（quickstart §2.3 ⑤）

**真实请求**

```http
POST /api/v1/consents/01a1aa8c-b7c2-7404-9f02-fa2c79709e10/revoke
content-type: application/json
```

```json
{
  "idempotencyKey": "qs-revoke-1793862711082"
}
```

**真实状态码**: `200`

**关键响应字段（实际）**

```json
{
  "revoke": {
    "status": 200,
    "id": "01a1aa8c-b7d3-7807-8d49-ea3544da128e",
    "decision": "REVOKED",
    "version": 2
  },
  "consentChainInDb": [
    {
      "decision": "GRANTED",
      "version": 1,
      "onboarding_request_id": "01a1aa8c-b7b6-731b-9089-9f48424b503e",
      "supersedes_id": null,
      "bound_person_id": "b1b912f0-fa93-4992-940f-6f74258b5873"
    },
    {
      "decision": "REVOKED",
      "version": 2,
      "onboarding_request_id": null,
      "supersedes_id": "01a1aa8c-b7c2-7404-9f02-fa2c79709e10",
      "bound_person_id": "b1b912f0-fa93-4992-940f-6f74258b5873"
    }
  ],
  "profilePointer": {
    "guardian_consent_record_id": "01a1aa8c-b7d3-7807-8d49-ea3544da128e",
    "guardian_consent_version": 2
  }
}
```

**quickstart 预期**: 200 REVOKED v2；v1 GRANTED 保留不变；v2 supersedes_id 指向 v1 且 onboarding_request_id 为 NULL；profile 指针前移

**实际**: 实际：200/REVOKED v2；链 = [GRANTED v1 → REVOKED v2]；profile 指针 v2

**判定**: PASS

### 段 6 — 跨家庭隔离（quickstart §2.4）

**真实请求**

```http
PATCH /api/v1/families/a076974f-de00-4251-92ad-266b76c422cf/members/6984b8a6-eb51-47a6-a1f6-80a75490f1f9
content-type: application/json
```

```json
{
  "profileValues": [
    {
      "attribute": "DISPLAY_NAME",
      "valueText": "hack",
      "sourceKind": "GUARDIAN_RELAY"
    }
  ],
  "idempotencyKey": "qs-cross-1793862711082"
}
```

**真实状态码**: `403`

**关键响应字段（实际）**

```json
{
  "secondActorLogin": 201,
  "secondFamily": {
    "status": 201,
    "id": "d012953c-7a61-4f93-939b-5c4b9d497140"
  },
  "crossFamilyPatch": {
    "status": 403,
    "code": "NOT_FAMILY_MEMBER",
    "body": {
      "statusCode": 403,
      "code": "NOT_FAMILY_MEMBER",
      "message": "NOT_FAMILY_MEMBER"
    }
  },
  "containsTargetIds": false
}
```

**quickstart 预期**: 403（统一拒绝码），响应体不含 A 家 / 成员的任何 id 或字段

**实际**: 实际：B 家 201；跨家庭 PATCH 403/NOT_FAMILY_MEMBER；响应体含目标 id=false

**判定**: PASS

## 与 quickstart.md §2 文本的偏差（真实观察）

quickstart.md 是 Plan 阶段产物，其 curl 示例使用早期字段名；本轮按**冻结契约** `packages/contracts/src/schemas.ts` 与已生成的 OpenAPI 发起请求。以下均为实际请求/响应中观察到的事实，未修改任何冻结文档：

| quickstart §2 写法 | 实际 | 说明 |
|---|---|---|
| `curl localhost:8787` | `app.inject` 进程内真实路由 | 本机 :8787 被沙箱网络代理拦截（`502 upstream connect failed`），改用与 integration 测试同一套真实 handler / RLS / PG |
| `Idempotency-Key` HTTP header | body 字段 `idempotencyKey` | 六类命令的 Zod schema 均要求 body 内必填 |
| `values` / `value` / `source` | `profileValues` / `valueText` / `sourceKind` | `ProvenanceValueInput` 的字段名 |
| `noticeVersion: "2026-11-v1"` | `noticeVersion: "v1"` | `packages/compliance/src/notices.ts` 目录当前只有 v1 |
| `declaredAgeBand` / `channel` / `requestId` | 请求仅 `noticeVersion` / `subjectPersonId`；响应为 `id` | 最小 onboarding 不采集儿童资料 |
| `onboardingRequestId` | `consentRequestId` | `GrantConsentRequest` 字段名 |
| `reason` (revoke) | 仅 `idempotencyKey` | `RevokeConsentRequest` 无 reason 字段 |
| 响应含 `supersedesId` / `guardianPersonId` | 响应不含；在 `consent_records` / `person_compliance_profiles` 表中 | 已用真实 SQL 查询证明（见段 4、段 5） |

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
