/**
 * T051 / T054 — Case create semantics.
 *
 * First Case is the current primary (OPEN + INTAKE + version 1); the second is
 * a real candidate (primary = false). The request body is strict: any
 * undeclared field is 422 with zero writes in every business table.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

let verifyPool: pg.Pool;

describe('Case create (T051)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  let seq = 0;
  async function login(label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `t051_${label}_${Date.now()}_${seq++}` },
    });
    const body = res.json();
    return {
      token: body.sessionToken as string,
      personId: body.person.id as string,
      accountId: body.accountId as string,
    };
  }

  async function createFamily(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `t051-fam-${label}-${Date.now()}-${seq++}`,
      },
      payload: {
        displayName: `T051-${label}`,
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  function postCase(token: string, key: string | null, body: Record<string, unknown> = {}) {
    const headers: Record<string, string> = { authorization: `Bearer ${token}` };
    if (key !== null) headers['idempotency-key'] = key;
    return app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers,
      payload: body,
    });
  }

  // Counts are scoped to this Family / actor so parallel suites cannot
  // perturb the "zero writes" assertion.
  async function counts(familyId: string, accountId: string) {
    const { rows } = await verifyPool.query(
      `SELECT
         (SELECT count(*)::int FROM cases WHERE family_id = $1) AS cases,
         (SELECT count(*)::int FROM case_events WHERE family_id = $1) AS case_events,
         (SELECT count(*)::int FROM business_audit_events WHERE family_id = $1) AS business_audit_events,
         (SELECT count(*)::int FROM idempotency_keys WHERE actor_account_id = $2) AS idempotency_keys`,
      [familyId, accountId]
    );
    return rows[0];
  }

  it('first Case: OPEN + INTAKE + primary + version 1, no content fields', async () => {
    const { token, personId } = await login('first');
    const familyId = await createFamily(token, 'first');

    const res = await postCase(token, `t051-first-${Date.now()}`);
    expect(res.statusCode).toBe(201);
    const body = res.json();

    expect(Object.keys(body).sort()).toEqual([
      'createdAt', 'id', 'phase', 'primary', 'status', 'updatedAt', 'version',
    ]);
    expect(body.status).toBe('OPEN');
    expect(body.phase).toBe('INTAKE');
    expect(body.primary).toBe(true);
    expect(body.version).toBe(1);
    expect(body.createdAt).toEqual(body.updatedAt);
    expect(JSON.stringify(body)).not.toMatch(/familyId|createdByPersonId|title|summary|description/);

    const row = await verifyPool.query(
      `SELECT family_id, created_by_person_id, status, phase, is_primary, version
       FROM cases WHERE id = $1`,
      [body.id]
    );
    expect(row.rows[0]).toEqual({
      family_id: familyId,
      created_by_person_id: personId,
      status: 'OPEN',
      phase: 'INTAKE',
      is_primary: true,
      version: 1,
    });
  });

  it('second Case is a real candidate (primary = false, same status/phase)', async () => {
    const { token } = await login('second');
    await createFamily(token, 'second');

    const first = await postCase(token, `t051-a-${Date.now()}`);
    const second = await postCase(token, `t051-b-${Date.now()}`);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(first.json().primary).toBe(true);
    expect(second.json().primary).toBe(false);
    expect(second.json().status).toBe('OPEN');
    expect(second.json().phase).toBe('INTAKE');
    expect(second.json().version).toBe(1);

    const rows = await verifyPool.query(
      'SELECT id FROM cases WHERE family_id = (SELECT family_id FROM cases WHERE id = $1)',
      [first.json().id]
    );
    expect(rows.rows.map((r: any) => r.id).sort()).toEqual(
      [first.json().id, second.json().id].sort()
    );
  });

  const forbiddenPayloads: Record<string, unknown>[] = [
    { familyId: '11111111-1111-7111-8111-111111111111' },
    { createdByPersonId: '11111111-1111-7111-8111-111111111111' },
    { creator: 'someone' },
    { status: 'OPEN' },
    { phase: 'INTAKE' },
    { primary: true },
    { isPrimary: true },
    { version: 1 },
    { title: 'x' },
    { summary: 'x' },
    { description: 'x' },
    { problemDescription: 'x' },
    { problem_description: 'x' },
    { visibility: 'PRIVATE' },
    { participantId: '11111111-1111-7111-8111-111111111111' },
  ];

  for (const extra of forbiddenPayloads) {
    const field = Object.keys(extra)[0]!;
    it(`rejects undeclared field ${field} with 422 and zero writes`, async () => {
      const { token, accountId } = await login(`reject-${field.toLowerCase()}`);
      const familyId = await createFamily(token, `reject-${field}`);

      const before = await counts(familyId, accountId);
      const res = await postCase(token, `t051-reject-${field}-${Date.now()}`, extra);
      const after = await counts(familyId, accountId);

      expect(res.statusCode).toBe(422);
      expect(res.json()).toEqual({ code: 'VALIDATION_ERROR', message: 'Invalid request body' });
      expect(after).toEqual(before);
    });
  }

  it('missing Idempotency-Key header is 422 and writes nothing', async () => {
    const { token, accountId } = await login('missing-key');
    const familyId = await createFamily(token, 'missing-key');
    const before = await counts(familyId, accountId);
    const res = await postCase(token, null, {});
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('VALIDATION_ERROR');
    expect(await counts(familyId, accountId)).toEqual(before);
  });
});
