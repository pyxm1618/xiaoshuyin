/**
 * T023 — POST /api/v1/cases/{id}/messages happy path, strictness, privacy.
 *
 * RED before the route/table exist (unregistered route -> 404).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

let verifyPool: pg.Pool;
let app: Awaited<ReturnType<typeof buildApp>>;
let seq = 0;

const FORBIDDEN_BODY_FIELDS: Record<string, unknown> = {
  idempotencyKey: 'body-key-0001',
  familyId: '11111111-1111-7111-8111-111111111111',
  actorId: '22222222-2222-7222-8222-222222222222',
  sourcePersonId: '33333333-3333-7333-8333-333333333333',
  subjectPersonId: '44444444-4444-7444-8444-444444444444',
  recordedAt: '2026-01-01T00:00:00.000Z',
  assertionKind: 'STATEMENT',
};

async function login(label: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wechat',
    payload: { code: `t023_${label}_${Date.now()}_${seq++}` },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  return {
    token: body.sessionToken as string,
    personId: body.person.id as string,
    accountId: body.accountId as string,
  };
}

async function setup(label: string) {
  const actor = await login(label);
  const family = await app.inject({
    method: 'POST',
    url: '/api/v1/families',
    headers: {
      authorization: `Bearer ${actor.token}`,
      'idempotency-key': `t023-fam-${label}-${Date.now()}-${seq++}`,
    },
    payload: {
      displayName: `T023-${label}`,
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
      'idempotency-key': `t023-case-${label}-${Date.now()}-${seq++}`,
    },
    payload: {},
  });
  expect(kase.statusCode).toBe(201);
  return { ...actor, familyId, caseId: kase.json().id as string };
}

function postMessage(
  token: string,
  caseId: string,
  key: string | null,
  payload: unknown
) {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (key !== null) headers['idempotency-key'] = key;
  return app.inject({
    method: 'POST',
    url: `/api/v1/cases/${caseId}/messages`,
    headers,
    payload: payload as any,
  });
}

async function counts(familyId: string) {
  const { rows } = await verifyPool.query(
    `SELECT
       (SELECT count(*)::int FROM dialogue_messages WHERE family_id = $1) AS messages,
       (SELECT count(*)::int FROM business_audit_events
         WHERE family_id = $1 AND event_type = 'MESSAGE_RECORDED') AS audits,
       (SELECT count(*)::int FROM assertions WHERE family_id = $1) AS assertions,
       (SELECT count(*)::int FROM observations WHERE family_id = $1) AS observations,
       (SELECT count(*)::int FROM case_events WHERE family_id = $1) AS case_events`,
    [familyId]
  );
  return rows[0];
}

describe('Message create (T023)', () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  it('records the exact raw message and returns only id/caseId/recordedAt', async () => {
    const actor = await setup('happy');
    const content = '  孩子最近晚上总说还不想睡。  ';
    const before = await counts(actor.familyId);

    const res = await postMessage(actor.token, actor.caseId, `t023-happy-${Date.now()}`, {
      content,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(Object.keys(body).sort()).toEqual(['caseId', 'id', 'recordedAt']);
    expect(body.caseId).toBe(actor.caseId);
    expect(Number.isNaN(Date.parse(body.recordedAt))).toBe(false);
    expect(JSON.stringify(body)).not.toContain(content);

    const after = await counts(actor.familyId);
    expect(after.messages).toBe(before.messages + 1);
    expect(after.audits).toBe(before.audits + 1);
    expect(after.assertions).toBe(before.assertions);
    expect(after.observations).toBe(before.observations);
    expect(after.case_events).toBe(before.case_events);

    const { rows } = await verifyPool.query(
      `SELECT family_id, case_id, actor_account_id, source_person_id, content, recorded_at
         FROM dialogue_messages WHERE id = $1`,
      [body.id]
    );
    expect(rows[0]).toMatchObject({
      family_id: actor.familyId,
      case_id: actor.caseId,
      actor_account_id: actor.accountId,
      source_person_id: actor.personId,
      content,
    });
    expect(rows[0].recorded_at).toBeInstanceOf(Date);

    const audit = await verifyPool.query(
      `SELECT event_type, resource_type, resource_id, metadata
         FROM business_audit_events
        WHERE resource_id = $1`,
      [body.id]
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({
      event_type: 'MESSAGE_RECORDED',
      resource_type: 'DIALOGUE_MESSAGE',
      metadata: {},
    });
  });

  it('rejects whitespace-only content with 422 and zero writes', async () => {
    const actor = await setup('blank');
    const before = await counts(actor.familyId);
    const res = await postMessage(actor.token, actor.caseId, `t023-blank-${Date.now()}`, {
      content: '   \n\t  ',
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ code: 'VALIDATION_ERROR', message: 'Invalid request body' });
    expect(await counts(actor.familyId)).toEqual(before);
  });

  it('rejects missing / too short / too long Idempotency-Key with 422 and zero writes', async () => {
    const actor = await setup('key');
    const before = await counts(actor.familyId);
    for (const key of [null, 'short', 'k'.repeat(129)]) {
      const res = await postMessage(actor.token, actor.caseId, key, { content: 'hello' });
      expect(res.statusCode, String(key)).toBe(422);
      expect(res.json().code).toBe('VALIDATION_ERROR');
    }
    expect(await counts(actor.familyId)).toEqual(before);
  });

  it('rejects every forbidden extra body field with 422 and zero writes', async () => {
    const actor = await setup('extra');
    const before = await counts(actor.familyId);
    for (const [field, value] of Object.entries(FORBIDDEN_BODY_FIELDS)) {
      const res = await postMessage(
        actor.token,
        actor.caseId,
        `t023-extra-${field}-${Date.now()}`,
        { content: 'hello', [field]: value }
      );
      expect(res.statusCode, field).toBe(422);
      expect(res.json().code, field).toBe('VALIDATION_ERROR');
    }
    expect(await counts(actor.familyId)).toEqual(before);
  });

  it('rejects an empty body and out-of-range content with 422', async () => {
    const actor = await setup('content');
    const before = await counts(actor.familyId);
    for (const payload of [{}, { content: '' }, { content: 'x'.repeat(8001) }]) {
      const res = await postMessage(actor.token, actor.caseId, `t023-content-${Date.now()}`, payload);
      expect(res.statusCode).toBe(422);
    }
    expect(await counts(actor.familyId)).toEqual(before);
  });

  it('requires authentication before anything else', async () => {
    const actor = await setup('auth');
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${actor.caseId}/messages`,
      headers: { 'idempotency-key': `t023-noauth-${Date.now()}` },
      payload: { content: 'hello' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('UNAUTHENTICATED');
  });
});