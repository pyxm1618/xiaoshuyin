/**
 * MEDIUM-01 — CURRENT_FAMILY_AMBIGUOUS is a real runtime path for all three
 * Case operations, not only a contract declaration.
 *
 * The actor is a member of two Families but owns neither, so the current
 * Family cannot be resolved uniquely. No source-level mock of
 * `requireCurrentFamily` is used: the request goes through the real app.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

let verifyPool: pg.Pool;

describe('Case current-family ambiguity (MEDIUM-01)', () => {
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
      payload: { code: `med01_${label}_${Date.now()}_${seq++}` },
    });
    expect(res.statusCode).toBe(200);
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
        'idempotency-key': `med01-fam-${label}-${Date.now()}-${seq++}`,
      },
      payload: {
        displayName: `MED01-${label}`,
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function addMembership(personId: string, familyId: string) {
    await verifyPool.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [familyId, personId]
    );
  }

  async function ambiguousActor(label: string) {
    const actor = await login(label);
    const b = await login(`${label}-b`);
    const c = await login(`${label}-c`);
    const familyB = await createFamily(b.token, `${label}-b`);
    const familyC = await createFamily(c.token, `${label}-c`);
    await addMembership(actor.personId, familyB);
    await addMembership(actor.personId, familyC);
    return { actor, familyB, familyC };
  }

  function auth(token: string) {
    return { authorization: `Bearer ${token}` };
  }

  it('GET /api/v1/cases → real 409 CURRENT_FAMILY_AMBIGUOUS', async () => {
    const { actor, familyB, familyC } = await ambiguousActor('list');

    for (let i = 0; i < 3; i += 1) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/cases',
        headers: auth(actor.token),
      });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({
        code: 'CURRENT_FAMILY_AMBIGUOUS',
        message: 'Current family is ambiguous',
      });
      expect(res.json()).not.toHaveProperty('items');
      expect(JSON.stringify(res.json())).not.toContain(familyB);
      expect(JSON.stringify(res.json())).not.toContain(familyC);
    }
  });

  it('GET /api/v1/cases/:id → real 409 CURRENT_FAMILY_AMBIGUOUS (not 404)', async () => {
    const { actor } = await ambiguousActor('detail');

    for (let i = 0; i < 3; i += 1) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/cases/00000000-0000-7000-8000-000000000000',
        headers: auth(actor.token),
      });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({
        code: 'CURRENT_FAMILY_AMBIGUOUS',
        message: 'Current family is ambiguous',
      });
      for (const field of ['id', 'status', 'phase', 'primary', 'version', 'createdAt']) {
        expect(res.json()).not.toHaveProperty(field);
      }
    }
  });

  it('POST /api/v1/cases → real 409 and zero business writes', async () => {
    const { actor, familyB } = await ambiguousActor('create');

    const before = await counts(familyB, actor.accountId);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: {
        ...auth(actor.token),
        'idempotency-key': `med01-case-${Date.now()}`,
      },
      payload: {},
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      code: 'CURRENT_FAMILY_AMBIGUOUS',
      message: 'Current family is ambiguous',
    });
    expect(await counts(familyB, actor.accountId)).toEqual(before);
  });

  async function counts(familyId: string, accountId: string) {
    const { rows } = await verifyPool.query(
      `SELECT
         (SELECT count(*)::int FROM cases WHERE family_id = $1) AS cases,
         (SELECT count(*)::int FROM case_events WHERE family_id = $1) AS case_events,
         (SELECT count(*)::int FROM business_audit_events WHERE family_id = $1) AS business_audit_events,
         (SELECT count(*)::int FROM idempotency_keys
           WHERE actor_account_id = $2 AND command_type = 'CASE_CREATE') AS idempotency_keys`,
      [familyId, accountId]
    );
    return rows[0];
  }
});