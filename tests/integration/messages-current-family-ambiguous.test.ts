/**
 * T073 — COLD-003 targeted remediation: the Message route's 409 contract must
 * structurally admit both frozen codes:
 *
 *   CURRENT_FAMILY_AMBIGUOUS         (current Family cannot be uniquely resolved)
 *   IDEMPOTENCY_PAYLOAD_MISMATCH     (same key, different canonical payload)
 *
 * The runtime already returns 409 CURRENT_FAMILY_AMBIGUOUS for a multi-Family
 * actor. It must never collapse ambiguity into 404, never guess a Family and
 * never convert it into an idempotency mismatch.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

let verifyPool: pg.Pool;
let app: Awaited<ReturnType<typeof buildApp>>;
let seq = 0;

async function login(label: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wechat',
    payload: { code: `t073_${label}_${Date.now()}_${seq++}` },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  return {
    token: body.sessionToken as string,
    personId: body.person.id as string,
    accountId: body.accountId as string,
  };
}

async function createFamilyFor(token: string, label: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/families',
    headers: {
      authorization: `Bearer ${token}`,
      'idempotency-key': `t073-fam-${label}-${Date.now()}-${seq++}`,
    },
    payload: {
      displayName: `T073-${label}`,
      creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function createCaseFor(token: string, label: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/cases',
    headers: {
      authorization: `Bearer ${token}`,
      'idempotency-key': `t073-case-${label}-${Date.now()}-${seq++}`,
    },
    payload: {},
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

function postMessage(token: string, caseId: string, key: string, content: string) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/cases/${caseId}/messages`,
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
    payload: { content },
  });
}

async function messageCount(familyId: string) {
  const { rows } = await verifyPool.query(
    'SELECT count(*)::int AS c FROM dialogue_messages WHERE family_id = $1',
    [familyId]
  );
  return rows[0].c as number;
}

describe('T073 — Message 409 contract (COLD-003)', () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  it('multi-Family actor → 409 CURRENT_FAMILY_AMBIGUOUS (never 404, never guessed)', async () => {
    // Two families owned by two other managers; the actor joins both without
    // owning either, so current-Family resolution is genuinely AMBIGUOUS.
    const ownerA = await login('owner-a');
    const ownerB = await login('owner-b');
    const familyA = await createFamilyFor(ownerA.token, 'owner-a');
    const familyB = await createFamilyFor(ownerB.token, 'owner-b');
    const caseA = await createCaseFor(ownerA.token, 'owner-a');

    const actor = await login('multi-family-actor');
    await verifyPool.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [familyA, actor.personId]
    );
    await verifyPool.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [familyB, actor.personId]
    );

    const beforeA = await messageCount(familyA);
    const beforeB = await messageCount(familyB);

    const res = await postMessage(
      actor.token,
      caseA,
      `t073-ambiguous-${Date.now()}-${seq++}`,
      'ambiguity probe'
    );

    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().code).toBe('CURRENT_FAMILY_AMBIGUOUS');
    expect(res.json().code).not.toBe('CASE_NOT_FOUND');
    expect(res.json().code).not.toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    // No Family was guessed and no message/audit was written anywhere.
    expect(await messageCount(familyA)).toBe(beforeA);
    expect(await messageCount(familyB)).toBe(beforeB);

    await verifyPool.query('DELETE FROM family_members WHERE person_id = $1', [actor.personId]);
  });

  it('same key + different canonical payload → 409 IDEMPOTENCY_PAYLOAD_MISMATCH', async () => {
    const owner = await login('mismatch');
    const familyId = await createFamilyFor(owner.token, 'mismatch');
    const caseId = await createCaseFor(owner.token, 'mismatch');
    const key = `t073-mismatch-${Date.now()}-${seq++}`;

    const first = await postMessage(owner.token, caseId, key, 'canonical payload one');
    expect(first.statusCode).toBe(201);

    const before = await messageCount(familyId);
    const second = await postMessage(owner.token, caseId, key, 'canonical payload two');
    expect(second.statusCode).toBe(409);
    expect(second.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    expect(await messageCount(familyId)).toBe(before);
  });
});