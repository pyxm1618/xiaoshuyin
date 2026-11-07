/**
 * T063 / T064 — CASE_CREATE HTTP idempotency.
 *
 * Replay returns the original 201 body and the original Case id; concurrent
 * same-key requests (real connections) produce exactly one Case, one
 * case_event, one business_audit_event and one idempotency row.
 *
 * The public HTTP contract has no second legal business payload, so a
 * different-payload 409 is verified in the shared idempotency contract
 * (tests/domain/idempotency-hash.test.ts), not fabricated here.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

let verifyPool: pg.Pool;

describe('Case idempotency (T063)', () => {
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
      payload: { code: `t063_${label}_${Date.now()}_${seq++}` },
    });
    const body = res.json();
    return { token: body.sessionToken as string, personId: body.person.id as string };
  }

  async function setupFamily(label: string) {
    const { token, personId } = await login(label);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `t063-fam-${label}-${Date.now()}-${seq++}`,
      },
      payload: {
        displayName: `T063-${label}`,
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
      },
    });
    expect(res.statusCode).toBe(201);
    return { token, personId, familyId: res.json().id as string };
  }

  function postCase(token: string, key: string) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': key,
      },
      payload: {},
    });
  }

  async function counts(familyId: string) {
    const { rows } = await verifyPool.query(
      `SELECT
         (SELECT count(*)::int FROM cases WHERE family_id = $1) AS cases,
         (SELECT count(*)::int FROM case_events WHERE family_id = $1) AS events,
         (SELECT count(*)::int FROM business_audit_events
           WHERE family_id = $1 AND event_type = 'CASE_CREATED') AS audits`,
      [familyId]
    );
    return rows[0];
  }

  it('replays the original response without duplicating rows', async () => {
    const { token, familyId } = await setupFamily('replay');
    const key = `t063-replay-${Date.now()}`;

    const first = await postCase(token, key);
    const second = await postCase(token, key);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json()).toEqual(first.json());
    expect(second.json().id).toBe(first.json().id);
    expect(await counts(familyId)).toEqual({ cases: 1, events: 1, audits: 1 });

    const keys = await verifyPool.query(
      `SELECT count(*)::int AS c FROM idempotency_keys
       WHERE command_type = 'CASE_CREATE' AND idempotency_key_bytes = $1`,
      [Buffer.from(key, 'utf16le')]
    );
    expect(keys.rows[0].c).toBe(1);
  });

  it('concurrent same key produces exactly one business result', async () => {
    const { token, familyId } = await setupFamily('concurrent');
    const key = `t063-concurrent-${Date.now()}`;

    const responses = await Promise.all(Array.from({ length: 8 }, () => postCase(token, key)));
    expect(responses.every((r) => r.statusCode === 201)).toBe(true);

    const ids = new Set(responses.map((r) => r.json().id));
    expect(ids.size).toBe(1);
    expect(await counts(familyId)).toEqual({ cases: 1, events: 1, audits: 1 });
  });

  it('different keys still create distinct Cases', async () => {
    const { token, familyId } = await setupFamily('distinct');
    const a = await postCase(token, `t063-distinct-a-${Date.now()}`);
    const b = await postCase(token, `t063-distinct-b-${Date.now()}`);
    expect(a.json().id).not.toBe(b.json().id);
    expect(await counts(familyId)).toEqual({ cases: 2, events: 2, audits: 2 });
  });
});
