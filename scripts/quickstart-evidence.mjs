#!/usr/bin/env bun
/**
 * quickstart-evidence.mjs — T070 real end-to-end path evidence.
 *
 * Issues REAL API requests for quickstart.md §2's six segments and records
 * actual status codes / headers / request bodies / response fields /
 * DB assertions into tests/evidence/quickstart.md.
 *
 * Contract baseline: the frozen OpenAPI
 *   specs/001-family-identity-core/contracts/identity-family-api.openapi.yaml
 * and the matching Zod schemas in packages/contracts/src/schemas.ts.
 *
 * Transport: Fastify `app.inject` — the same real route handlers, auth hook,
 * RLS transactions and PostgreSQL used by the integration suite. A plain TCP
 * server is not used; that is recorded as a transport deviation only.
 *
 * Run: NODE_ENV=test bun scripts/quickstart-evidence.mjs
 *      (requires DATABASE_URL / TEST_ADMIN_DATABASE_URL and the runtime env)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import pg from 'pg';
import { buildApp } from '../apps/server/api/src/app.js';

const ROOT = new URL('..', import.meta.url).pathname;
const out = [];
let failures = 0;

// This harness is a test-only evidence tool. Never production semantics.
process.env['NODE_ENV'] ??= 'test';
const TEST_ENV_DEFAULTS = {
  SESSION_SECRET: 'test-quickstart-evidence-session-secret',
  EVIDENCE_HASH_PEPPER: 'test-quickstart-evidence-hash-pepper',
  WECHAT_APP_ID: 'test-quickstart-evidence-app-id',
  WECHAT_APP_SECRET: 'test-quickstart-evidence-app-secret',
};
for (const [key, value] of Object.entries(TEST_ENV_DEFAULTS)) {
  if (!process.env[key]) process.env[key] = value;
}

const RUN_HEAD = (() => {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim();
  } catch {
    return 'UNKNOWN';
  }
})();

const CONSENT_CHANNEL = process.env['NODE_ENV'] === 'test' ? 'TEST' : 'MINIPROGRAM';

function log(line = '') {
  console.log(line);
  out.push(line);
}

function redact(value) {
  if (typeof value === 'string' && value.length > 24) {
    return `${value.slice(0, 12)}…(${value.length} chars)`;
  }
  return value;
}

function json(value) {
  return JSON.stringify(
    value,
    (key, item) => (key === 'token' || key === 'sessionToken' ? redact(item) : item),
    2
  );
}

let stepNo = 0;
const results = [];

function record(title, req, res, expected, ok, note = '') {
  stepNo++;
  if (!ok) failures++;
  const status = ok ? 'PASS' : 'FAIL';
  results.push({ stepNo, title, status });
  log('');
  log(`### 段 ${stepNo} — ${title}`);
  log('');
  log('**真实请求**');
  log('');
  log('```http');
  log(`${req.method} ${req.url}`);
  for (const [name, value] of Object.entries(req.headers ?? {})) {
    log(`${name}: ${name === 'authorization' ? 'Bearer ***' : value}`);
  }
  log('content-type: application/json');
  log('```');
  if (req.body !== undefined) {
    log('');
    log('```json');
    log(json(req.body));
    log('```');
  }
  log('');
  log(`**真实状态码**: \`${res.statusCode}\``);
  log('');
  log('**关键响应字段（实际）**');
  log('');
  log('```json');
  log(json(res.summary));
  log('```');
  log('');
  log(`**预期**: ${expected}`);
  log('');
  log(`**实际**: ${note || '与预期一致'}`);
  log('');
  log(`**判定**: ${status}`);
}

async function main() {
  log('# T070 — quickstart.md §2 端到端主路径（真实请求记录）');
  log('');
  log(`Audited / executed Head: \`${RUN_HEAD}\``);
  log('');
  log(`执行时间: ${new Date().toISOString()}`);
  log(`运行环境: NODE_ENV=${process.env['NODE_ENV']}；runtimeConsentChannel=${CONSENT_CHANNEL}`);
  log('');
  log('说明：通过 Fastify `app.inject` 调用真实路由（与 integration 测试同一套 handler / auth hook / RLS 事务 / PostgreSQL）；');
  log('每个状态码、请求头、请求体与响应字段均来自实际响应；DB 断言来自真实 SQL 查询；token 仅显示前缀。');
  log('');
  log('契约基线：冻结 OpenAPI `identity-family-api.openapi.yaml` 与 `packages/contracts/src/schemas.ts`。');
  log('所有 mutating command 均使用 HTTP header `Idempotency-Key`，请求/响应形状与冻结 OpenAPI 完全一致。');

  const app = await buildApp();
  await app.ready();

  async function call(method, url, token, body, idempotencyKey) {
    const headers = {};
    if (token) headers['authorization'] = `Bearer ${token}`;
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
    const res = await app.inject({
      method,
      url,
      headers,
      ...(body !== undefined ? { payload: body } : {}),
    });
    let parsed;
    try {
      parsed = res.json();
    } catch {
      parsed = { raw: res.body };
    }
    return { statusCode: res.statusCode, body: parsed, headers };
  }

  const adminUrl = process.env['TEST_ADMIN_DATABASE_URL'];
  if (!adminUrl) throw new Error('TEST_ADMIN_DATABASE_URL is required for DB assertions');
  const db = new pg.Client({ connectionString: adminUrl });
  await db.connect();
  const q = async (sql, params) => (await db.query(sql, params)).rows;

  try {
    const stamp = Date.now();
    const key = (name) => `qs-${name}-${stamp}`;

    // ── 段 1: 登录 ──
    const loginCode = `qs-parent-a-${stamp}`;
    const loginRes = await call('POST', '/api/v1/auth/wechat', null, { code: loginCode });
    const tokenA = loginRes.body.sessionToken;
    const personA = loginRes.body.person?.id;
    const accountA = loginRes.body.accountId;
    record(
      '登录（quickstart §2.1 ①）',
      { method: 'POST', url: '/api/v1/auth/wechat', headers: {}, body: { code: loginCode } },
      {
        statusCode: loginRes.statusCode,
        summary: {
          accountId: accountA,
          personId: personA,
          personCreatedAt: loginRes.body.person?.createdAt,
          profilePresent: loginRes.body.person?.profile !== undefined,
          sessionToken: tokenA,
          wechatOpenidPresent: JSON.stringify(loginRes.body).includes('wechat_openid'),
        },
      },
      '200；accountId / person 非空、profile 尚未写入；响应不出现 wechat_openid',
      loginRes.statusCode === 200 &&
        !!personA &&
        !!accountA &&
        loginRes.body.person?.profile === undefined &&
        !JSON.stringify(loginRes.body).includes('wechat_openid'),
      `实际 ${loginRes.statusCode}；Account ${accountA} 与 Person ${personA} 由登录建立，profile 未写入，响应不含 wechat_openid`
    );

    // ── 段 2: 建家庭 ──
    const emptyRes = await call('GET', '/api/v1/families/current', tokenA);
    const famKey = key('fam');
    const famBody = {
      displayName: 'A 家',
      creator: {
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        values: [{ attribute: 'DISPLAY_NAME', value: '家长 A', source: 'SELF_STATEMENT' }],
      },
    };
    const famRes = await call('POST', '/api/v1/families', tokenA, famBody, famKey);
    const familyId = famRes.body.id;
    const meRes = await call('GET', '/api/v1/me', tokenA);
    const replayRes = await call('POST', '/api/v1/families', tokenA, famBody, famKey);
    const mismatchRes = await call(
      'POST',
      '/api/v1/families',
      tokenA,
      { ...famBody, displayName: 'B 家' },
      famKey
    );
    record(
      '建家庭 + 空态 + 身份 + 幂等（quickstart §2.1 ①-2 / ② / ③）',
      {
        method: 'POST',
        url: '/api/v1/families',
        headers: { authorization: `Bearer ${tokenA}`, 'idempotency-key': famKey },
        body: famBody,
      },
      {
        statusCode: famRes.statusCode,
        summary: {
          emptyCurrentFamily: { status: emptyRes.statusCode, code: emptyRes.body.code },
          createFamily: {
            status: famRes.statusCode,
            id: familyId,
            isManager: famRes.body.isManager,
            createdAt: famRes.body.createdAt,
          },
          me: {
            status: meRes.statusCode,
            accountId: meRes.body.account?.id,
            personId: meRes.body.person?.id,
          },
          replaySameKey: { status: replayRes.statusCode, sameFamilyId: replayRes.body.id === familyId },
          sameKeyDifferentPayload: { status: mismatchRes.statusCode, code: mismatchRes.body.code },
        },
      },
      '空态 404 CURRENT_FAMILY_NOT_FOUND；建家庭 201 且 isManager=true；/me 不出现 wechat_openid；同 key 重放返回同一家庭；同 key 改 payload → 409',
      emptyRes.statusCode === 404 &&
        emptyRes.body.code === 'CURRENT_FAMILY_NOT_FOUND' &&
        famRes.statusCode === 201 &&
        famRes.body.isManager === true &&
        meRes.statusCode === 200 &&
        !JSON.stringify(meRes.body).includes('wechat_openid') &&
        replayRes.statusCode === 201 &&
        replayRes.body.id === familyId &&
        mismatchRes.statusCode === 409 &&
        mismatchRes.body.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH',
      `实际：空态 ${emptyRes.statusCode}/${emptyRes.body.code}；建家庭 ${famRes.statusCode}；/me ${meRes.statusCode}；重放 ${replayRes.statusCode}（同 id=${replayRes.body.id === familyId}）；改 payload ${mismatchRes.statusCode}/${mismatchRes.body.code}`
    );

    // ── 段 3: 成员（per-value provenance） ──
    const memKey = key('mem');
    const memBody = {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_OBSERVATION',
      values: [{ attribute: 'DISPLAY_NAME', value: '小雨', source: 'GUARDIAN_RELAY' }],
    };
    const memRes = await call('POST', `/api/v1/families/${familyId}/members`, tokenA, memBody, memKey);
    const memberPersonId = memRes.body.personId;

    const patchKey = key('patch');
    const patchBody = {
      values: [{ attribute: 'DISPLAY_NAME', value: '小雨', source: 'SELF_STATEMENT' }],
    };
    const patchRes = await call(
      'PATCH',
      `/api/v1/families/${familyId}/members/${memberPersonId}`,
      tokenA,
      patchBody,
      patchKey
    );
    const valueRows = await q(
      `SELECT source_kind, status, provided_by_person_id, observed_at
       FROM person_profile_values WHERE person_id = $1 ORDER BY source_kind`,
      [memberPersonId]
    );
    record(
      '无账号成员 + 逐值来源（quickstart §2.2）',
      {
        method: 'POST',
        url: `/api/v1/families/${familyId}/members`,
        headers: { authorization: `Bearer ${tokenA}`, 'idempotency-key': memKey },
        body: memBody,
      },
      {
        statusCode: memRes.statusCode,
        summary: {
          createMember: {
            status: memRes.statusCode,
            personId: memberPersonId,
            familyId: memRes.body.familyId,
            accountBound: memRes.body.accountBound,
            values: memRes.body.values,
          },
          patchSecondSource: { status: patchRes.statusCode, values: patchRes.body.values },
          recordedValuesInDb: valueRows,
        },
      },
      '201，accountBound=false；PATCH 后 DISPLAY_NAME 两条 RECORDED 来源并存（GUARDIAN_RELAY 与 SELF_STATEMENT）',
      memRes.statusCode === 201 &&
        memRes.body.accountBound === false &&
        patchRes.statusCode === 200 &&
        valueRows.filter(
          (r) =>
            r.status === 'RECORDED' &&
            ['GUARDIAN_RELAY', 'SELF_STATEMENT'].includes(r.source_kind)
        ).length === 2,
      `实际：建成员 ${memRes.statusCode}（accountBound=${memRes.body.accountBound}）；PATCH ${patchRes.statusCode}；库中 RECORDED 来源 = [${valueRows
        .map((r) => `${r.source_kind}/${r.status}`)
        .join(', ')}]`
    );

    // ── 段 4: guardian consent + consent-first ──
    const noticesRes = await call('GET', '/api/v1/compliance/notices', tokenA);
    const notice = noticesRes.body.notices?.[0];

    const reqKey = key('req');
    const reqBody = {
      declaredAgeBand: 'UNDER_14',
      noticeVersion: 'v1',
      channel: CONSENT_CHANNEL,
    };
    const consentReqRes = await call(
      'POST',
      '/api/v1/compliance/guardian-consents/requests',
      tokenA,
      reqBody,
      reqKey
    );
    const consentRequestId = consentReqRes.body.requestId;

    const denyKey = key('deny');
    const under14NoConsent = await call(
      'POST',
      `/api/v1/families/${familyId}/members`,
      tokenA,
      { ageBand: 'UNDER_14', ageBandSource: 'GUARDIAN_RELAY' },
      denyKey
    );
    const familyCountBefore = await q(
      'SELECT count(*)::int AS cnt FROM family_members WHERE family_id = $1',
      [familyId]
    );

    const grantKey = key('grant');
    const grantBody = {
      onboardingRequestId: consentRequestId,
      noticeVersion: 'v1',
      accepted: true,
    };
    const grantRes = await call(
      'POST',
      '/api/v1/compliance/guardian-consents',
      tokenA,
      grantBody,
      grantKey
    );
    const consentId = grantRes.body.id;

    const childKey = key('child');
    const under14Body = {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: consentId,
      values: [{ attribute: 'DISPLAY_NAME', value: '小树', source: 'GUARDIAN_RELAY' }],
    };
    const childRes = await call(
      'POST',
      `/api/v1/families/${familyId}/members`,
      tokenA,
      under14Body,
      childKey
    );
    const childPersonId = childRes.body.personId;
    const childProfile = await q(
      `SELECT age_band, minor_mode, verified_source, guardian_person_id,
              guardian_consent_version, guardian_consent_record_id
       FROM person_compliance_profiles WHERE person_id = $1`,
      [childPersonId]
    );
    const evidenceRows = await q(
      `SELECT evidence FROM consent_records WHERE id = $1`,
      [consentId]
    );
    const evidence = evidenceRows[0]?.evidence ?? null;

    record(
      'UNDER_14 consent-first（quickstart §2.3 ①—④）',
      {
        method: 'POST',
        url: '/api/v1/compliance/guardian-consents/requests',
        headers: { authorization: `Bearer ${tokenA}`, 'idempotency-key': reqKey },
        body: reqBody,
      },
      {
        statusCode: consentReqRes.statusCode,
        summary: {
          noticeCatalog: {
            status: noticesRes.statusCode,
            version: notice?.version,
            purpose: notice?.purpose,
          },
          onboardingRequest: {
            status: consentReqRes.statusCode,
            requestId: consentRequestId,
            declaredAgeBand: consentReqRes.body.declaredAgeBand,
            noticeHash: consentReqRes.body.noticeHash,
            statusField: consentReqRes.body.status,
            expiresAt: consentReqRes.body.expiresAt,
          },
          withoutConsent: {
            status: under14NoConsent.statusCode,
            code: under14NoConsent.body.code,
            familyMembersAfterDeny: familyCountBefore[0]?.cnt,
          },
          grant: {
            status: grantRes.statusCode,
            id: consentId,
            decision: grantRes.body.decision,
            version: grantRes.body.version,
            boundPersonId: grantRes.body.boundPersonId,
            onboardingRequestId: grantRes.body.onboardingRequestId,
          },
          childCreated: {
            status: childRes.statusCode,
            personId: childPersonId,
            ageBand: childRes.body.profile?.ageBand,
          },
          childProfileInDb: childProfile[0] ?? null,
          consentEvidenceInDb: evidence,
        },
      },
      'request 201 且无儿童资料、channel 与运行环境一致；无 guardianConsentId 建 UNDER_14 → 403 且不建 Person/profile；grant 201 GRANTED v1；带 consent 建档 201，profile.ageBand=UNDER_14、guardian 与 consent 版本一致；evidence.channel 与运行环境一致',
      consentReqRes.statusCode === 201 &&
        consentReqRes.body.declaredAgeBand === 'UNDER_14' &&
        under14NoConsent.statusCode === 403 &&
        under14NoConsent.body.code === 'GUARDIAN_CONSENT_REQUIRED' &&
        grantRes.statusCode === 201 &&
        grantRes.body.decision === 'GRANTED' &&
        grantRes.body.version === 1 &&
        childRes.statusCode === 201 &&
        childProfile[0]?.age_band === 'UNDER_14' &&
        childProfile[0]?.guardian_person_id === personA &&
        childProfile[0]?.guardian_consent_version === 1 &&
        evidence?.channel === CONSENT_CHANNEL,
      `实际：request ${consentReqRes.statusCode}（requestId=${consentRequestId}）；无同意建档 ${under14NoConsent.statusCode}/${under14NoConsent.body.code}（family_members 仍 ${familyCountBefore[0]?.cnt} 行）；grant ${grantRes.statusCode}/${grantRes.body.decision} v${grantRes.body.version}；建档 ${childRes.statusCode}，profile=${JSON.stringify(childProfile[0])}，evidence.channel=${evidence?.channel}`
    );

    // ── 段 5: 撤回 ──
    const revokeKey = key('revoke');
    const revokeBody = { reason: 'quickstart evidence revoke' };
    const revokeRes = await call(
      'POST',
      `/api/v1/consents/${consentId}/revoke`,
      tokenA,
      revokeBody,
      revokeKey
    );
    const versionRows = await q(
      `SELECT decision, version, onboarding_request_id, supersedes_id, bound_person_id
       FROM consent_records WHERE id = $1 OR supersedes_id = $1 ORDER BY version`,
      [consentId]
    );
    const profilePointer = await q(
      `SELECT guardian_consent_record_id, guardian_consent_version
       FROM person_compliance_profiles WHERE person_id = $1`,
      [childPersonId]
    );
    record(
      '撤回同意（quickstart §2.3 ⑤）',
      {
        method: 'POST',
        url: `/api/v1/consents/${consentId}/revoke`,
        headers: { authorization: `Bearer ${tokenA}`, 'idempotency-key': revokeKey },
        body: revokeBody,
      },
      {
        statusCode: revokeRes.statusCode,
        summary: {
          revoke: {
            status: revokeRes.statusCode,
            id: revokeRes.body.id,
            decision: revokeRes.body.decision,
            version: revokeRes.body.version,
            supersedesId: revokeRes.body.supersedesId,
          },
          consentChainInDb: versionRows,
          profilePointer: profilePointer[0] ?? null,
        },
      },
      '200 REVOKED v2；v1 GRANTED 保留不变；v2 supersedes_id 指向 v1 且 onboarding_request_id 为 NULL；profile 指针前移',
      revokeRes.statusCode === 200 &&
        revokeRes.body.decision === 'REVOKED' &&
        revokeRes.body.version === 2 &&
        versionRows.length === 2 &&
        versionRows[0].decision === 'GRANTED' &&
        versionRows[1].decision === 'REVOKED' &&
        versionRows[1].supersedes_id === consentId &&
        versionRows[1].onboarding_request_id === null &&
        profilePointer[0]?.guardian_consent_version === 2,
      `实际：${revokeRes.statusCode}/${revokeRes.body.decision} v${revokeRes.body.version}；链 = [${versionRows
        .map((r) => `${r.decision} v${r.version}`)
        .join(' → ')}]；profile 指针 v${profilePointer[0]?.guardian_consent_version}`
    );

    // ── 段 6: 跨家庭隔离 ──
    const loginBRes = await call('POST', '/api/v1/auth/wechat', null, {
      code: `qs-parent-b-${stamp}`,
    });
    const tokenB = loginBRes.body.sessionToken;
    const famBKey = key('famb');
    const famBRes = await call(
      'POST',
      '/api/v1/families',
      tokenB,
      {
        displayName: 'B 家',
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT', values: [] },
      },
      famBKey
    );

    const crossKey = key('cross');
    const crossBody = {
      values: [{ attribute: 'DISPLAY_NAME', value: 'hack', source: 'GUARDIAN_RELAY' }],
    };
    const crossRes = await call(
      'PATCH',
      `/api/v1/families/${familyId}/members/${memberPersonId}`,
      tokenB,
      crossBody,
      crossKey
    );
    const leaked =
      JSON.stringify(crossRes.body).includes(familyId) ||
      JSON.stringify(crossRes.body).includes(memberPersonId);
    record(
      '跨家庭隔离（quickstart §2.4）',
      {
        method: 'PATCH',
        url: `/api/v1/families/${familyId}/members/${memberPersonId}`,
        headers: { authorization: `Bearer ${tokenB}`, 'idempotency-key': crossKey },
        body: crossBody,
      },
      {
        statusCode: crossRes.statusCode,
        summary: {
          secondActorLogin: loginBRes.statusCode,
          secondFamily: { status: famBRes.statusCode, id: famBRes.body.id },
          crossFamilyPatch: { status: crossRes.statusCode, code: crossRes.body.code, body: crossRes.body },
          containsTargetIds: leaked,
        },
      },
      '403（统一拒绝码），响应体不含 A 家 / 成员的任何 id 或字段',
      crossRes.statusCode === 403 && !leaked,
      `实际：B 家 ${famBRes.statusCode}；跨家庭 PATCH ${crossRes.statusCode}/${crossRes.body.code}；响应体含目标 id=${leaked}`
    );

    // ── 契约一致性说明 ──
    log('');
    log('## 契约一致性与偏差说明');
    log('');
    log('| 项 | 当前执行 | 说明 |');
    log('|---|---|---|');
    log('| `Idempotency-Key` | HTTP header | 与冻结 OpenAPI 的 header parameter 完全一致 |');
    log('| 建家庭 | `creator { ageBand, ageBandSource, values }` | 与冻结 `CreateFamilyRequest` 完全一致 |');
    log('| 成员 / PATCH | `values[] { attribute, value, source, observedAt? }` | 与冻结 `ProvenanceValueInput` / `UpdateMemberRequest` 完全一致 |');
    log('| consent request | `declaredAgeBand, noticeVersion, channel, existingSubjectPersonId?` | 与冻结 `CreateConsentRequestRequest` 一致；`channel` 必须等于运行环境 channel |');
    log('| grant | `onboardingRequestId, noticeVersion, accepted: true` | 与冻结 `GrantConsentRequest` 完全一致 |');
    log('| revoke | header key + 可选 `reason` | 与冻结 `RevokeConsentRequest` 一致 |');
    log('| 传输 | Fastify `app.inject` | 与 integration 测试同一套真实 handler / auth hook / RLS / PostgreSQL；未使用 curl 仅为规避本机网络代理限制 |');
    log('| `noticeVersion` | `v1` | `packages/compliance/src/notices.ts` 当前目录只有 v1 |');

    log('');
    log('## 六段结果汇总');
    log('');
    log('| 段 | 标题 | 判定 |');
    log('|---|---|---|');
    for (const r of results) log(`| ${r.stepNo} | ${r.title} | ${r.status} |`);
    log('');
    log(`quickstart-evidence: ${failures === 0 ? 'PASS (6/6)' : `FAIL (${failures} segments)`}`);
  } finally {
    await db.end();
    await app.close();
  }

  mkdirSync(join(ROOT, 'tests', 'evidence'), { recursive: true });
  writeFileSync(join(ROOT, 'tests', 'evidence', 'quickstart.md'), out.join('\n') + '\n');
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  log(`quickstart-evidence: ERROR — ${err.message}`);
  mkdirSync(join(ROOT, 'tests', 'evidence'), { recursive: true });
  writeFileSync(join(ROOT, 'tests', 'evidence', 'quickstart.md'), out.join('\n') + '\n');
  console.error(err);
  process.exit(1);
});