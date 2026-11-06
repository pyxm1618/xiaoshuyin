/**
 * T024 / T066 — single-primary invariant under real PostgreSQL concurrency.
 *
 * Two concurrent CASE_CREATE commands with different idempotency keys, same
 * Family, real connections (no mocks, no in-process lock). Exactly one row may
 * satisfy `is_primary AND status <> 'CLOSED'`.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

let verifyPool: pg.Pool;

describe('Case primary concurrency (T024)', () => {
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

  async function login(label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `t024_${label}_${Date.now()}_${Math.random().toString(36).slice(2)}` },
    });
    const body = res.json();
    return { token: body.token as string, personId: body.person.id as string };
  }

  async function createFamily(token: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: 'T024 Family',
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        idempotencyKey: `t024-fam-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    });
    expect(res.statusCode, `body: ${res.body}`).toBe(201);
    return res.json().id as string;
  }

  function postCase(token: string, key: string) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}` },
      payload: { idempotencyKey: key },
    });
  }

  it('two concurrent creates produce one primary and one candidate', async () => {
    const { token } = await login('pair');
    const familyId = await createFamily(token);

    const [r1, r2] = await Promise.all([
      postCase(token, `t024-key-a-${Date.now()}`),
      postCase(token, `t024-key-b-${Date.now()}`),
    ]);

    expect(
      [r1.statusCode, r2.statusCode],
      `bodies: ${r1.body} | ${r2.body}`
    ).toEqual([201, 201]);

    const aggregate = await verifyPool.query(
      `SELECT count(*)::int AS c FROM cases
       WHERE family_id = $1 AND is_primary AND status <> 'CLOSED'`,
      [familyId]
    );
    expect(aggregate.rows[0].c).toBe(1);

    const all = await verifyPool.query(
      'SELECT id, is_primary FROM cases WHERE family_id = $1 ORDER BY created_at',
      [familyId]
    );
    expect(all.rows.length).toBe(2);
    expect(all.rows.filter((r: any) => r.is_primary).length).toBe(1);

    const events = await verifyPool.query(
      'SELECT count(*)::int AS c FROM case_events WHERE family_id = $1',
      [familyId]
    );
    expect(events.rows[0].c).toBe(2);

    const audits = await verifyPool.query(
      `SELECT count(*)::int AS c FROM business_audit_events
       WHERE family_id = $1 AND event_type = 'CASE_CREATED'`,
      [familyId]
    );
    expect(audits.rows[0].c).toBe(2);
  });

  it('a second primary row is rejected by the partial unique index (23505)', async () => {
    const { token, personId } = await login('dup');
    const familyId = await createFamily(token);
    const first = await postCase(token, `t024-dup-${Date.now()}`);
    expect(first.statusCode).toBe(201);

    const admin = createAdminPool();
    try {
      const client = await admin.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT app.set_family_context($1, $2, $3)', [
          familyId,
          personId,
          'FAMILY_MANAGEMENT',
        ]);
        await expect(
          client.query(
            `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
             VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1)`,
            [familyId, personId]
          )
        ).rejects.toMatchObject({ code: '23505' });
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    } finally {
      await admin.end();
    }
  });

  it('keeps the invariant across repeated runs', async () => {
    for (let round = 0; round < 3; round++) {
      const { token } = await login(`loop${round}`);
      const familyId = await createFamily(token);
      await Promise.all([
        postCase(token, `t024-loop-${round}-a-${Date.now()}`),
        postCase(token, `t024-loop-${round}-b-${Date.now()}`),
      ]);
      const { rows } = await verifyPool.query(
        `SELECT count(*)::int AS c FROM cases
         WHERE family_id = $1 AND is_primary AND status <> 'CLOSED'`,
        [familyId]
      );
      expect(rows[0].c, `round ${round}`).toBe(1);
    }
  });
});
