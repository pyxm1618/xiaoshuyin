/**
 * T025 (integration half) / T048 — Message idempotency through the shared engine.
 *
 * RED before the route/command exists.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

let verifyPool: pg.Pool;
let app: Awaited<ReturnType<typeof buildApp>>;
let seq = 0;

async function setup(label: string) {
  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wechat',
    payload: { code: `t025_${label}_${Date.now()}_${seq++}` },
  });
  expect(login.statusCode).toBe(200);
  const actor = login.json();
  const family = await app.inject({
    method: 'POST',
    url: '/api/v1/families',
    headers: {
      authorization: `Bearer ${actor.sessionToken}`,
      'idempotency-key': `t025-fam-${label}-${Date.now()}-${seq++}`,
    },
    payload: {
      displayName: `T025-${label}`,
      creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
    },
  });
  expect(family.statusCode).toBe(201);
  const familyId = family.json().id as string;
  const kase = await app.inject({
    method: 'POST',
    url: '/api/v1/cases',
    headers: {
      authorization: `Bearer ${actor.sessionToken}`,
      'idempotency-key': `t025-case-${label}-${Date.now()}-${seq++}`,
    },
    payload: {},
  });
  expect(kase.statusCode).toBe(201);
  return {
    token: actor.sessionToken as string,
    accountId: actor.accountId as string,
    familyId,
    caseId: kase.json().id as string,
  };
}

function postMessage(token: string, caseId: string, key: string, content: string) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/cases/${caseId}/messages`,
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
    payload: { content },
  });
}

async function counts(familyId: string) {
  const { rows } = await verifyPool.query(
    `SELECT
       (SELECT count(*)::int FROM dialogue_messages WHERE family_id = $1) AS messages,
       (SELECT count(*)::int FROM business_audit_events
         WHERE family_id = $1 AND event_type = 'MESSAGE_RECORDED') AS audits`,
    [familyId]
  );
  return rows[0];
}

async function idempotencyRows(accountId: string, key: string) {
  const { rows } = await verifyPool.query(
    `SELECT request_hash, response_status, response_body
       FROM idempotency_keys
      WHERE actor_account_id = $1 AND command_type = 'CASE_MESSAGE_CREATE'
        AND idempotency_key = $2`,
    [accountId, key]
  );
  return rows;
}

describe('Message idempotency (T025/T048)', () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  it('same key + same content replays the original 201 body with no new writes', async () => {
    const owner = await setup('replay');
    const key = `t025-replay-${Date.now()}`;
    const first = await postMessage(owner.token, owner.caseId, key, 'same content');
    const second = await postMessage(owner.token, owner.caseId, key, 'same content');

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json()).toEqual(first.json());
    expect(await counts(owner.familyId)).toEqual({ messages: 1, audits: 1 });

    const rows = await idempotencyRows(owner.accountId, key);
    expect(rows).toHaveLength(1);
    expect(rows[0].response_status).toBe(201);
    expect(rows[0].response_body).toEqual(first.json());
    expect(JSON.stringify(rows[0].response_body)).not.toContain('same content');
  });

  it('same key + different content is 409 with zero new business writes', async () => {
    const owner = await setup('mismatch');
    const key = `t025-mismatch-${Date.now()}`;
    const first = await postMessage(owner.token, owner.caseId, key, 'first content');
    const second = await postMessage(owner.token, owner.caseId, key, 'second content');

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(409);
    expect(second.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    expect(await counts(owner.familyId)).toEqual({ messages: 1, audits: 1 });
    expect(await idempotencyRows(owner.accountId, key)).toHaveLength(1);

    const rows = await verifyPool.query(
      'SELECT content FROM dialogue_messages WHERE family_id = $1',
      [owner.familyId]
    );
    expect(rows.rows.map((r: any) => r.content)).toEqual(['first content']);
  });

  it('>=20 concurrent same-key requests produce exactly one message/audit/idempotency row', async () => {
    const owner = await setup('concurrent');
    const key = `t025-concurrent-${Date.now()}`;

    const responses = await Promise.all(
      Array.from({ length: 20 }, () => postMessage(owner.token, owner.caseId, key, 'burst'))
    );

    expect(responses.every((r) => r.statusCode === 201)).toBe(true);
    expect(new Set(responses.map((r) => r.json().id)).size).toBe(1);
    expect(await counts(owner.familyId)).toEqual({ messages: 1, audits: 1 });
    expect(await idempotencyRows(owner.accountId, key)).toHaveLength(1);
  });

  it('different key + same content produces two independent raw messages', async () => {
    const owner = await setup('distinct');
    const a = await postMessage(owner.token, owner.caseId, `t025-a-${Date.now()}`, 'identical');
    const b = await postMessage(owner.token, owner.caseId, `t025-b-${Date.now()}`, 'identical');

    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(201);
    expect(a.json().id).not.toBe(b.json().id);
    expect(await counts(owner.familyId)).toEqual({ messages: 2, audits: 2 });
  });
});