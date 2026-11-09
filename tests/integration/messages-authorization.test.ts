/**
 * T024 — Message authorization / anti-enumeration.
 *
 * RED before the message route exists.
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
    payload: { code: `t024_${label}_${Date.now()}_${seq++}` },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  return {
    token: body.sessionToken as string,
    personId: body.person.id as string,
    accountId: body.accountId as string,
  };
}

async function setupFamily(label: string) {
  const actor = await login(label);
  const family = await app.inject({
    method: 'POST',
    url: '/api/v1/families',
    headers: {
      authorization: `Bearer ${actor.token}`,
      'idempotency-key': `t024-fam-${label}-${Date.now()}-${seq++}`,
    },
    payload: {
      displayName: `T024-${label}`,
      creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
    },
  });
  expect(family.statusCode).toBe(201);
  const familyId = family.json().id as string;
  const kase = await app.inject({
    method: 'POST',
    url: '/api/v1/cases',
    headers: {
      authorization: `Bearer ${actor.token}`,
      'idempotency-key': `t024-case-${label}-${Date.now()}-${seq++}`,
    },
    payload: {},
  });
  expect(kase.statusCode).toBe(201);
  return { ...actor, familyId, caseId: kase.json().id as string };
}

function postMessage(token: string, caseId: string, key: string) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/cases/${caseId}/messages`,
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
    payload: { content: 'authorization probe' },
  });
}

async function messageCount(familyId: string) {
  const { rows } = await verifyPool.query(
    'SELECT count(*)::int AS c FROM dialogue_messages WHERE family_id = $1',
    [familyId]
  );
  return rows[0].c;
}

describe('Message authorization (T024)', () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  it('allows the current-Family management subject', async () => {
    const owner = await setupFamily('owner');
    const res = await postMessage(owner.token, owner.caseId, `t024-owner-${Date.now()}`);
    expect(res.statusCode).toBe(201);
    expect(res.json().caseId).toBe(owner.caseId);
  });

  it('rejects an ordinary member (not the approved Case actor) with the uniform 404', async () => {
    const owner = await setupFamily('member');
    const member = await login('member-actor');
    await verifyPool.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [owner.familyId, member.personId]
    );
    const before = await messageCount(owner.familyId);

    const res = await postMessage(member.token, owner.caseId, `t024-member-${Date.now()}`);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: 'CASE_NOT_FOUND', message: 'Case not found' });
    expect(await messageCount(owner.familyId)).toBe(before);
  });

  it('a guardian relationship does not upgrade an ordinary member into the Case actor', async () => {
    const owner = await setupFamily('guardian');
    const guardian = await login('guardian-actor');

    const { rows: child } = await verifyPool.query(
      `INSERT INTO persons (created_by_account_id) VALUES ($1) RETURNING id`,
      [owner.accountId]
    );
    const childPersonId = child[0].id;
    await verifyPool.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [owner.familyId, guardian.personId]
    );
    await verifyPool.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [owner.familyId, childPersonId]
    );
    await verifyPool.query(
      `INSERT INTO person_compliance_profiles
         (person_id, age_band, minor_mode, guardian_person_id, verified_source)
       VALUES ($1, 'MINOR_14_17', true, $2, 'GUARDIAN_OBSERVATION')`,
      [childPersonId, guardian.personId]
    );

    const before = await messageCount(owner.familyId);
    const res = await postMessage(guardian.token, owner.caseId, `t024-guardian-${Date.now()}`);
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('CASE_NOT_FOUND');
    expect(await messageCount(owner.familyId)).toBe(before);
  });

  it('a known cross-Family Case id is indistinguishable from a nonexistent Case', async () => {
    const familyA = await setupFamily('cross-a');
    const familyB = await setupFamily('cross-b');
    const nonexistent = '99999999-9999-7999-8999-999999999999';

    const cross = await postMessage(familyA.token, familyB.caseId, `t024-cross-${Date.now()}`);
    const missing = await postMessage(familyA.token, nonexistent, `t024-missing-${Date.now()}`);

    expect(cross.statusCode).toBe(404);
    expect(missing.statusCode).toBe(404);
    expect(cross.json()).toEqual(missing.json());
    expect(await messageCount(familyB.familyId)).toBe(0);
    expect(await messageCount(familyA.familyId)).toBe(0);
  });

  it('a malformed Case id converges to the same uniform 404', async () => {
    const owner = await setupFamily('malformed');
    const res = await postMessage(owner.token, 'not-a-uuid', `t024-malformed-${Date.now()}`);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: 'CASE_NOT_FOUND', message: 'Case not found' });
  });

  it('no Family at all keeps Slice 1 CURRENT_FAMILY_NOT_FOUND semantics', async () => {
    const lonely = await login('no-family');
    const res = await postMessage(
      lonely.token,
      '99999999-9999-7999-8999-999999999999',
      `t024-lonely-${Date.now()}`
    );
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('CURRENT_FAMILY_NOT_FOUND');
  });
});