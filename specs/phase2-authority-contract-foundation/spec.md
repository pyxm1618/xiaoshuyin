# Feature Specification: Phase 2 Authority Contract Foundation

## Upstream Traceability

This feature is a **downstream projection only** of the four formal Authority Docs. It never creates product, technical, professional, legal, or runtime authority.

Phase 2 Authority convergence is reflected here for the registered D3/D7/D8 units. Product and Technical D3 now converge through the registered `011-digital-use-node-manifest-routing-foundation` downstream; D4/D5 continue through their registered Compliance / Participant downstream owners.

Status: **PARTIAL_AUTHORITY_CONVERGENCE**

- D3 status: **CLOSED**. Product Authority and Technical Authority use the same mechanical rule: conflict is dimension-local; same-dimension credible true + false makes only that dimension `CONFLICT` and neutral; an independent valid direct-impact true still establishes aggregate positive; without any positive, route-driving direct-impact conflict → BLOCKED; Missing / Unknown without positive → INSUFFICIENT; 01002 / 01003 priority conflict always → BLOCKED.
- D4 status: **CLOSED**.
- D5 status: **EXTERNAL_DEPENDENCY** for the exact Legal / Compliance coverage, final notice text, and any required consent-expiry / renewal rule for subsequent child-data processing.
- D7 status: **CLOSED**.
- D8 status: **CLOSED** at Authority-contract level; the formal V1 Technical Authority owns invitation / participation lifecycle semantics and Slice 4 is downstream projection only.

## Scope

In scope:

- mechanically project the Phase 2 Authority contracts registered to this feature;
- provide non-runtime verification evidence for those contracts;
- expose unresolved Legal / Compliance dependencies as fail-closed dependencies rather than inventing runtime semantics.

Out of scope:

- production runtime remediation (C4-C7 / T1-T2);
- database/schema/migration changes;
- PR #58 / Slice 17;
- C1-C3, C8-C12, D6, E1-E4;
- claiming runtime implementation completion.

## Requirements

- **P2-AUTH-001 — D3 source convergence:** this feature MUST NOT manufacture an alternative Product Authority for D3. The registered Product and Technical D3 units converge on the same dimension-local evaluator semantics through `011-digital-use-node-manifest-routing-foundation`; cross-dimension cancellation of an established positive is forbidden, while 01002 / 01003 priority conflict remains fail-closed BLOCKED.
- **P2-AUTH-002 — D7 frontend governance:** `Docs/frontend/*` is a downstream projection of the four Authority Docs, never a fifth Authority and never able to override them.
- **P2-AUTH-003 — GOALS→PLANNING:** `ConfirmGoal` is the one formal advancement command; A2010 completion is only a server-side eligibility prerequisite and never a second phase writer. The only public Goal mutation endpoint is `POST /api/v1/cases/:id/goals`, with an explicit required `operation = SAVE | CONFIRM` discriminator. `SAVE` persists an unconfirmed Goal/version and never advances phase; only `CONFIRM` maps to the formal `ConfirmGoal`, must target an exact already-persisted Goal/version, and `ConfirmGoal` remains the unique `GOALS -> PLANNING` phase writer. No implicit auto-confirm or second public Goal confirm endpoint is permitted.
- **P2-AUTH-004 — Closure:** `CloseCase` carries closure reason, independent outcome, basis references, actor/source, server closure time, previous phase, version guard and conditional referral reference; it atomically closes status+phase and preserves immutable history.
- **P2-AUTH-005 — Review mapping:** every Review `next_action` maps to one explicit command/state effect; `PAUSE` pauses the Plan without inventing a PAUSED Case status or closing the Case.
- **P2-AUTH-006 — Review-state consistency:** Goal, InterventionInstance, PlanVersion, DigitalUseContractVersion and Task use `CURRENT / NEEDS_REVIEW` independently from lifecycle status; stale objects cannot remain an unchecked execution basis.
- **P2-AUTH-007 — Invitation lifecycle:** the formal V1 Technical Authority owns `PENDING / ACTIVE / DECLINED / EXPIRED / WITHDRAWN`; downstream Slice specs may project but never define or expand that lifecycle.
- **P2-AUTH-008 — INSUFFICIENT recovery:** recovery returns real missing requirements and a reachable A1001/01002/01003 collection/correction target; it never uses A2001/A2002 outcome pages as a substitute collection route.
- **P2-AUTH-009 — U19 Safety/Referral:** Safety entry is internal `EnterSafetyHold` from an approved Safety decision; resolution is Staff-only with `SAFETY_RESOLVE` + valid assignment/evidence; Referral uses the existing six-state lifecycle and explicit transition commands/APIs.
- **P2-AUTH-010 — Staff:** existing Account/session authentication resolves a server-owned StaffPrincipal; capability/assignment authorization is explicit, scoped, revocable and audited; existing `SERVICE_CONTROL` governs staff capability/scope administration with no-self-escalation and without implying business capabilities.
- **P2-AUTH-011 — No runtime claim:** these contracts close Authority ambiguity only. Production/runtime drift is intentionally deferred to Phase 3 and MUST NOT be represented here as already remediated.
- **P2-AUTH-012 — Single generated client contract:** 运营端与小程序端消费同一份 generated TypeScript types。运营端使用 openapi-fetch typed client；小程序端使用 wx.request + 薄类型适配层，仅约束 method/path/params/body/response/error 类型，不维护第二套 DTO/schema，不引入通用 Fetch polyfill、全局重试或拦截器框架、自建打包体系。两端生成的客户端/适配层均不得与服务端 contract 漂移。小程序端适配层必须在目标基础库真机验证普通 HTTP 请求、参数与头部、成功与错误响应、网络失败、取消、响应读取及运行时限制，未实测通过不得进入正式 Transport 实现。

## Acceptance Scenarios

1. The four formal Authority Docs remain the only Authority layer; this spec is downstream-only.
2. Registry-bound Phase 2 units have concrete, mechanically testable downstream statements instead of a pending placeholder.
3. No production source, migration or runtime behavior is changed by this convergence.
4. Any unresolved legal/compliance scope remains explicit and fail-closed rather than being silently interpreted by code.

## Acceptance Evidence

- `tests/architecture/phase2-authority-contract-foundation.test.ts` verifies D3 source convergence, the continuing D5 external dependency, and the D7/D8 contracts.
- Repository Spec Governance and all required CI checks must pass on the exact PR head.
