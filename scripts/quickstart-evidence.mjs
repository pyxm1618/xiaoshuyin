#!/usr/bin/env node
/**
 * quickstart-evidence.mjs — T070 real end-to-end path evidence.
 *
 * Issues REAL API requests for quickstart.md §2's six segments and records
 * actual status codes / response fields / expected-vs-actual into
 * tests/evidence/quickstart.md. Database assertions are real SQL queries.
 *
 * Transport: Fastify `app.inject` — the same real route handlers, auth hook,
 * RLS transactions and PostgreSQL used by the integration suite. A plain TCP
 * server on :8787 is not usable in this environment (the sandbox network proxy
 * answers with "502 upstream connect failed"), so inject is used instead of
 * curl. This is recorded as a deviation, not hidden.
 *
 * Run: bun scripts/quickstart-evidence.mjs   (requires .env variables exported)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { buildApp } from '../apps/server/api/src/app.js';

const ROOT = new URL('..', import.meta.url).pathname;
const out = [];
let failures = 0;

function log(line = '') {
  console.log(line);
  out.push(line);
}

function redact(v) {
  if (typeof v === 'string' && v.length > 24) return `${v.slice(0, 12)}…(${v.length} chars)`;
  return v;
}

function json(v) {
  return JSON.stringify(v, (k, x) => (k === 'token' ? redact(x) : x), 2);
}

let stepNo = 0;
const results = [];

function record(title, req, res, expected, ok, note = '') {
  stepNo++;
  if (!ok) failures++;
  const status = ok ? 'PASS' : 'DEVIATION / FAIL';
  results.push({ stepNo, title, status });
  log('');
  log(`### 段 ${stepNo} — ${title}`);
  log('');
  log('**真实请求**');
  log('');
  log('```http');
  log(`${req.method} ${req.url}`);
  log('content-type: application/json');
  log('```');
  if (req.body) {
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
  log(`**quickstart 预期**: ${expected}`);
  log('');
  log(`**实际**: ${note || '与预期一致'}`);
  log('');
  log(`**判定**: ${status}`);
}

async function main() {
  log('# T070 — quickstart.md §2 端到端主路径（真实请求记录）');
  log('');
  log(`执行时间: ${new Date().toISOString()}`);
  log('');
  log('说明：通过 Fastify `app.inject` 调用真实路由（与 integration 测试同一套 handler / auth hook / RLS 事务 / PostgreSQL）；');
  log('每个状态码与响应字段均来自实际响应，数据库断言来自真实 SQL 查询；token 仅显示前缀。');
  log('');
  log('> 传输方式偏差：本机 :8787 被沙箱网络代理拦截（curl 返回 `502 upstream connect failed`），');
  log('> 因此未使用 quickstart §2 的 curl，改用进程内真实 HTTP 语义注入。见文末偏差表。');

  const app = await buildApp();
  await app.ready();

  async function call(method, url, token, body) {
    const headers = {};
    if (token) headers['authorization'] = `Bearer ${token}`;
    const res = await app.inject({
      method, url, headers,
      ...(body ? { payload: body } : {}),
    });
    let parsed;
    try { parsed = res.json(); } catch { parsed = { raw: res.body }; }
    return { statusCode: res.statusCode, body: parsed };
  }

  const adminUrl = process.env['TEST_ADMIN_DATABASE_URL'];
  if (!adminUrl) throw new Error('TEST_ADMIN_DATABASE_URL is required for DB assertions');
  const db = new pg.Client({ connectionString: adminUrl });
  await db.connect();
  const q = async (sql, params) => (await db.query(sql, params)).rows;

  try {
    const stamp = Date.now();
    const key = (n) => `qs-${n}-${stamp}`;

    // ── 段 1: 登录 ──
    const loginRes = await call('POST', '/api/v1/auth/wechat', null, { code: `qs-parent-a-${stamp}` });
    const token = loginRes.body.token;
    const personA = loginRes.body.person?.id;
    const accountA = loginRes.body.account?.id;
    record(
      '登录（quickstart §2.1 ①）',
      { method: 'POST', url: '/api/v1/auth/wechat', body: { code: `qs-parent-a-${stamp}` } },
      {
        statusCode: loginRes.statusCode,
        summary: {
          statusCode: loginRes.statusCode,
          accountId: accountA,
          personId: personA,
          personProfile: loginRes.body.person?.profile ?? null,
          token: token,
          wechatOpenidPresent: JSON.stringify(loginRes.body).includes('wechat_openid'),
        },
      },
      '200/201；person 非空、profile 尚未写入；响应不出现 wechat_openid',
      [200, 201].includes(loginRes.statusCode) && !!personA && !!accountA &&
        loginRes.body.person?.profile === null &&
        !JSON.stringify(loginRes.body).includes('wechat_openid'),
      `实际 ${loginRes.statusCode}；Account ${accountA} 与 Person ${personA} 由登录建立，profile=${JSON.stringify(loginRes.body.person?.profile)}，响应不含 wechat_openid`
    );

    // ── 段 2: 建家庭 ──
    const emptyRes = await call('GET', '/api/v1/families/current', token);
    const famBody = {
      displayName: 'A 家', ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT',
      idempotencyKey: key('fam'),
    };
    const famRes = await call('POST', '/api/v1/families', token, famBody);
    const familyId = famRes.body.id;
    const meRes = await call('GET', '/api/v1/me', token);
    const replayRes = await call('POST', '/api/v1/families', token, famBody);
    const mismatchRes = await call('POST', '/api/v1/families', token, { ...famBody, displayName: 'B 家' });
    record(
      '建家庭 + 空态 + 身份 + 幂等（quickstart §2.1 ①-2 / ② / ③）',
      { method: 'POST', url: '/api/v1/families', body: famBody },
      {
        statusCode: famRes.statusCode,
        summary: {
          emptyCurrentFamily: { status: emptyRes.statusCode, code: emptyRes.body.code },
          createFamily: { status: famRes.statusCode, id: familyId, isManager: famRes.body.isManager },
          me: { status: meRes.statusCode, body: meRes.body },
          replaySameKey: { status: replayRes.statusCode, sameFamilyId: replayRes.body.id === familyId },
          sameKeyDifferentPayload: { status: mismatchRes.statusCode, code: mismatchRes.body.code },
        },
      },
      '空态 404 CURRENT_FAMILY_NOT_FOUND；建家庭 201 且 isManager=true；/me 不出现 wechat_openid；同 key 重放返回同一家庭；同 key 改 payload → 409',
      emptyRes.statusCode === 404 && emptyRes.body.code === 'CURRENT_FAMILY_NOT_FOUND' &&
        famRes.statusCode === 201 && famRes.body.isManager === true &&
        meRes.statusCode === 200 && !JSON.stringify(meRes.body).includes('wechat_openid') &&
        replayRes.statusCode === 201 && replayRes.body.id === familyId &&
        mismatchRes.statusCode === 409 && mismatchRes.body.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH',
      `实际：空态 ${emptyRes.statusCode}/${emptyRes.body.code}；建家庭 ${famRes.statusCode}；/me ${meRes.statusCode}；重放 ${replayRes.statusCode}（同 id=${replayRes.body.id === familyId}）；改 payload ${mismatchRes.statusCode}/${mismatchRes.body.code}`
    );

    // ── 段 3: 成员（per-value provenance） ──
    const memBody = {
      ageBand: 'MINOR_14_17', ageBandSource: 'GUARDIAN_OBSERVATION',
      profileValues: [{ attribute: 'DISPLAY_NAME', valueText: '小雨', sourceKind: 'GUARDIAN_RELAY' }],
      idempotencyKey: key('mem'),
    };
    const memRes = await call('POST', `/api/v1/families/${familyId}/members`, token, memBody);
    const memberPersonId = memRes.body.personId;
    const patchBody = {
      profileValues: [{ attribute: 'DISPLAY_NAME', valueText: '小雨', sourceKind: 'SELF_STATEMENT' }],
      idempotencyKey: key('patch'),
    };
    const patchRes = await call('PATCH', `/api/v1/families/${familyId}/members/${memberPersonId}`, token, patchBody);
    const valueRows = await q(
      `SELECT source_kind, status FROM person_profile_values WHERE person_id = $1 ORDER BY source_kind`,
      [memberPersonId]
    );
    record(
      '无账号成员 + 逐值来源（quickstart §2.2）',
      { method: 'POST', url: `/api/v1/families/${familyId}/members`, body: memBody },
      {
        statusCode: memRes.statusCode,
        summary: {
          createMember: { status: memRes.statusCode, personId: memberPersonId, accountBound: memRes.body.accountBound },
          patchSecondSource: { status: patchRes.statusCode },
          recordedValuesInDb: valueRows,
        },
      },
      '201，accountBound=false；PATCH 后 DISPLAY_NAME 两条 RECORDED 来源并存（GUARDIAN_RELAY 与 SELF_STATEMENT）',
      memRes.statusCode === 201 && memRes.body.accountBound === false && patchRes.statusCode === 200 &&
        valueRows.filter((r) => r.status === 'RECORDED' && ['GUARDIAN_RELAY', 'SELF_STATEMENT'].includes(r.source_kind)).length === 2,
      `实际：建成员 ${memRes.statusCode}（accountBound=${memRes.body.accountBound}）；PATCH ${patchRes.statusCode}；库中 RECORDED 来源 = [${valueRows.map((r) => `${r.source_kind}/${r.status}`).join(', ')}]`
    );

    // ── 段 4: guardian consent + consent-first ──
    const noticesRes = await call('GET', '/api/v1/compliance/notices', token);
    const noticeHash = noticesRes.body.notices?.[0]?.hash;
    const reqBody = { noticeVersion: 'v1', idempotencyKey: key('req') };
    const consentReqRes = await call('POST', '/api/v1/compliance/guardian-consents/requests', token, reqBody);
    const consentRequestId = consentReqRes.body.id;

    const under14NoConsent = await call('POST', `/api/v1/families/${familyId}/members`, token, {
      ageBand: 'UNDER_14', ageBandSource: 'GUARDIAN_RELAY', idempotencyKey: key('deny'),
    });
    const familyCountBefore = await q(
      `SELECT count(*)::int AS cnt FROM family_members WHERE family_id = $1`, [familyId]
    );

    const grantBody = {
      consentRequestId, accepted: true, noticeVersion: 'v1', noticeHash,
      idempotencyKey: key('grant'),
    };
    const grantRes = await call('POST', '/api/v1/compliance/guardian-consents', token, grantBody);
    const consentId = grantRes.body.id;

    const under14Body = {
      ageBand: 'UNDER_14', ageBandSource: 'GUARDIAN_RELAY', guardianConsentId: consentId,
      profileValues: [{ attribute: 'DISPLAY_NAME', valueText: '小树', sourceKind: 'GUARDIAN_RELAY' }],
      idempotencyKey: key('child'),
    };
    const childRes = await call('POST', `/api/v1/families/${familyId}/members`, token, under14Body);
    const childPersonId = childRes.body.personId;
    const childProfile = await q(
      `SELECT age_band, minor_mode, verified_source, guardian_person_id, guardian_consent_version, guardian_consent_record_id
         FROM person_compliance_profiles WHERE person_id = $1`, [childPersonId]
    );
    record(
      'UNDER_14 consent-first（quickstart §2.3 ①—④）',
      { method: 'POST', url: '/api/v1/compliance/guardian-consents/requests', body: reqBody },
      {
        statusCode: consentReqRes.statusCode,
        summary: {
          noticeCatalog: { status: noticesRes.statusCode, version: noticesRes.body.notices?.[0]?.version },
          onboardingRequest: {
            status: consentReqRes.statusCode, id: consentRequestId,
            statusField: consentReqRes.body.status, expiresAt: consentReqRes.body.expiresAt,
          },
          withoutConsent: { status: under14NoConsent.statusCode, code: under14NoConsent.body.code,
            familyMembersAfterDeny: familyCountBefore[0]?.cnt },
          grant: { status: grantRes.statusCode, id: consentId, decision: grantRes.body.decision,
            version: grantRes.body.version, boundPersonId: grantRes.body.boundPersonId },
          childCreated: { status: childRes.statusCode, personId: childPersonId,
            ageBand: childRes.body.profile?.ageBand },
          childProfileInDb: childProfile[0] ?? null,
        },
      },
      'request 201 且无儿童资料；无 guardianConsentId 建 UNDER_14 → 403 且不建 Person/profile；grant 201 GRANTED v1；带 consent 建档 201，profile.ageBand=UNDER_14、guardian 与 consent 版本一致',
      consentReqRes.statusCode === 201 && under14NoConsent.statusCode === 403 &&
        under14NoConsent.body.code === 'GUARDIAN_CONSENT_REQUIRED' &&
        grantRes.statusCode === 201 && grantRes.body.decision === 'GRANTED' && grantRes.body.version === 1 &&
        childRes.statusCode === 201 && childProfile[0]?.age_band === 'UNDER_14' &&
        childProfile[0]?.guardian_person_id === personA && childProfile[0]?.guardian_consent_version === 1,
      `实际：request ${consentReqRes.statusCode}；无同意建档 ${under14NoConsent.statusCode}/${under14NoConsent.body.code}（family_members 仍 ${familyCountBefore[0]?.cnt} 行）；grant ${grantRes.statusCode}/${grantRes.body.decision} v${grantRes.body.version}；建档 ${childRes.statusCode}，profile=${JSON.stringify(childProfile[0])}`
    );

    // ── 段 5: 撤回 ──
    const revokeBody = { idempotencyKey: key('revoke') };
    const revokeRes = await call('POST', `/api/v1/consents/${consentId}/revoke`, token, revokeBody);
    const versionRows = await q(
      `SELECT decision, version, onboarding_request_id, supersedes_id, bound_person_id
         FROM consent_records WHERE id = $1 OR supersedes_id = $1 ORDER BY version`, [consentId]
    );
    const profilePointer = await q(
      `SELECT guardian_consent_record_id, guardian_consent_version FROM person_compliance_profiles WHERE person_id = $1`,
      [childPersonId]
    );
    record(
      '撤回同意（quickstart §2.3 ⑤）',
      { method: 'POST', url: `/api/v1/consents/${consentId}/revoke`, body: revokeBody },
      {
        statusCode: revokeRes.statusCode,
        summary: {
          revoke: { status: revokeRes.statusCode, id: revokeRes.body.id,
            decision: revokeRes.body.decision, version: revokeRes.body.version },
          consentChainInDb: versionRows,
          profilePointer: profilePointer[0] ?? null,
        },
      },
      '200 REVOKED v2；v1 GRANTED 保留不变；v2 supersedes_id 指向 v1 且 onboarding_request_id 为 NULL；profile 指针前移',
      revokeRes.statusCode === 200 && revokeRes.body.decision === 'REVOKED' && revokeRes.body.version === 2 &&
        versionRows.length === 2 && versionRows[0].decision === 'GRANTED' && versionRows[1].decision === 'REVOKED' &&
        versionRows[1].supersedes_id === consentId && versionRows[1].onboarding_request_id === null &&
        profilePointer[0]?.guardian_consent_version === 2,
      `实际：${revokeRes.statusCode}/${revokeRes.body.decision} v${revokeRes.body.version}；链 = [${versionRows.map((r) => `${r.decision} v${r.version}`).join(' → ')}]；profile 指针 v${profilePointer[0]?.guardian_consent_version}`
    );

    // ── 段 6: 跨家庭隔离 ──
    const loginBRes = await call('POST', '/api/v1/auth/wechat', null, { code: `qs-parent-b-${stamp}` });
    const tokenB = loginBRes.body.token;
    const famBRes = await call('POST', '/api/v1/families', tokenB, {
      displayName: 'B 家', ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT', idempotencyKey: key('famb'),
    });
    const crossBody = {
      profileValues: [{ attribute: 'DISPLAY_NAME', valueText: 'hack', sourceKind: 'GUARDIAN_RELAY' }],
      idempotencyKey: key('cross'),
    };
    const crossRes = await call('PATCH', `/api/v1/families/${familyId}/members/${memberPersonId}`, tokenB, crossBody);
    const leaked = JSON.stringify(crossRes.body).includes(familyId) || JSON.stringify(crossRes.body).includes(memberPersonId);
    record(
      '跨家庭隔离（quickstart §2.4）',
      { method: 'PATCH', url: `/api/v1/families/${familyId}/members/${memberPersonId}`, body: crossBody },
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

    // ── 与 quickstart 文本的字段名差异（真实观察） ──
    log('');
    log('## 与 quickstart.md §2 文本的偏差（真实观察）');
    log('');
    log('quickstart.md 是 Plan 阶段产物，其 curl 示例使用早期字段名；本轮按**冻结契约** `packages/contracts/src/schemas.ts` 与已生成的 OpenAPI 发起请求。以下均为实际请求/响应中观察到的事实，未修改任何冻结文档：');
    log('');
    log('| quickstart §2 写法 | 实际 | 说明 |');
    log('|---|---|---|');
    log('| `curl localhost:8787` | `app.inject` 进程内真实路由 | 本机 :8787 被沙箱网络代理拦截（`502 upstream connect failed`），改用与 integration 测试同一套真实 handler / RLS / PG |');
    log('| `Idempotency-Key` HTTP header | body 字段 `idempotencyKey` | 六类命令的 Zod schema 均要求 body 内必填 |');
    log('| `values` / `value` / `source` | `profileValues` / `valueText` / `sourceKind` | `ProvenanceValueInput` 的字段名 |');
    log('| `noticeVersion: "2026-11-v1"` | `noticeVersion: "v1"` | `packages/compliance/src/notices.ts` 目录当前只有 v1 |');
    log('| `declaredAgeBand` / `channel` / `requestId` | 请求仅 `noticeVersion` / `subjectPersonId`；响应为 `id` | 最小 onboarding 不采集儿童资料 |');
    log('| `onboardingRequestId` | `consentRequestId` | `GrantConsentRequest` 字段名 |');
    log('| `reason` (revoke) | 仅 `idempotencyKey` | `RevokeConsentRequest` 无 reason 字段 |');
    log('| 响应含 `supersedesId` / `guardianPersonId` | 响应不含；在 `consent_records` / `person_compliance_profiles` 表中 | 已用真实 SQL 查询证明（见段 4、段 5） |');

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
