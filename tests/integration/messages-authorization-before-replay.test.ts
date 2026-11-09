/**
 * T026 / T049 — authorization must precede any idempotent replay.
 *
 * A stored 201 snapshot may never be returned for a request whose *current*
 * specific Case is not authorized. RED before the message route exists.
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
    payload: { code: `t026_${label}_${Date.now()}_${seq++}` },
  });
  expect(login.statusCode).toBe(200);
  const actor = login.json();
  const family = await app.inject({
    method: 'POST',
    url: '/api/v1/families',
    headers: {
      authorization: `Bearer ${actor.sessionToken}`,
      'idempotency-key': `t026-fam-${label}-${Date.now()}-${seq++}`,
    },
    payload: {
      displayName: `T026-${label}`,
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
      'idempotency-key': `t026-case-${label}-${Date.now()}-${seq++}`,
    },
    payload: {},
  });
  expect(kase.statusCode).toBe(201);
  return {
    token: actor.sessionToken as string,
    personId: actor.person.id as string,
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

async function messageCount(familyId: string) {
  const { rows } = await verifyPool.query(
    'SELECT count(*)::int AS c FROM dialogue_messages WHERE family_id = $1',
    [familyId]
  );
  return rows[0].c;
}

describe('Authorization before replay (T026/T049)', () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  it('never replays a stored message snapshot for a Case outside the current authorized context', async () => {
    const ownerA = await setup('cross-a');
    const ownerB = await setup('cross-b');
    const key = `t026-cross-${Date.now()}`;

    const stored = await postMessage(ownerA.token, ownerA.caseId, key, 'family A secret');
    expect(stored.statusCode).toBe(201);
    const storedId = stored.json().id as string;
    expect(await messageCount(ownerA.familyId)).toBe(1);

    // Reuse the *same actor + command + key* against Family B's Case.
    const replayAttempt = await postMessage(ownerB.token, ownerA.caseId, key, 'family A secret');
    expect(replayAttempt.statusCode).toBe(404);
    expect(replayAttempt.json()).toEqual({ code: 'CASE_NOT_FOUND', message: 'Case not found' });
    const text = JSON.stringify(replayAttempt.json());
    expect(text).not.toContain(storedId);
    expect(text).not.toContain(ownerA.caseId);
    expect(text).not.toContain(ownerA.familyId);
    expect(text).not.toContain('recordedAt');

    // And reusing A's key on B's Case must not replay A's snapshot either.
    const crossReplay = await postMessage(ownerA.token, ownerB.caseId, key, 'family A secret');
    expect(crossReplay.statusCode).toBe(404);
    expect(JSON.stringify(crossReplay.json())).not.toContain(storedId);
    expect(await messageCount(ownerB.familyId)).toBe(0);
    expect(await messageCount(ownerA.familyId)).toBe(1);
  });

  it('removing current Family access stops replay before it can happen', async () => {
    const owner = await setup('removed');
    const key = `t026-removed-${Date.now()}`;
    const stored = await postMessage(owner.token, owner.caseId, key, 'before removal');
    expect(stored.statusCode).toBe(201);
    const storedId = stored.json().id as string;

    // Test-only setup: simulate that the sender no longer has current access.
    // The append-only FK (dialogue_messages.source_person_id -> family_members)
    // deliberately prevents deleting the membership while the raw message still
    // exists, so the fixture removes the business row first. The idempotency
    // snapshot is intentionally left behind to prove it is never replayed.
    await verifyPool.query('DELETE FROM dialogue_messages WHERE id = $1', [storedId]);
    await verifyPool.query(
      'DELETE FROM family_members WHERE family_id = $1 AND person_id = $2',
      [owner.familyId, owner.personId]
    );

    const replayAttempt = await postMessage(owner.token, owner.caseId, key, 'before removal');
    expect(replayAttempt.statusCode).toBe(404);
    expect(replayAttempt.json().code).toBe('CURRENT_FAMILY_NOT_FOUND');
    expect(JSON.stringify(replayAttempt.json())).not.toContain(storedId);
    expect(await messageCount(owner.familyId)).toBe(0);
  });
});