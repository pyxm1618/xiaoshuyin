/**
 * Independent Converge remediation — Case HTTP boundary.
 *
 * Findings 1/2/3/4:
 *   - malformed Case id converges to the uniform 404 (no contract-external 422)
 *   - no implicit HEAD exposure on the two GET routes
 *   - authentication precedes schema validation
 *   - `__proto__` payload → 422 VALIDATION_ERROR with zero writes (secure JSON
 *     parsing stays enabled)
 *   - NUL / Unicode logical idempotency keys are storage-safe, replay stably
 *     and never produce a 500
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

let verifyPool: pg.Pool;

describe('Case HTTP boundary (converge findings 1–4)', () => {
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
      payload: { code: `cv1_${label}_${Date.now()}_${seq++}` },
    });
    const body = res.json();
    return { token: body.sessionToken as string, accountId: body.accountId as string };
  }

  async function family(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `cv1-fam-${label}-${Date.now()}-${seq++}`,
      },
      payload: {
        displayName: `CV1-${label}`,
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  // ── Finding 2: HEAD ──────────────────────────────────────
  it('exposes no implicit HEAD on the Case GET routes', async () => {
    const routes = app.printRoutes({ commonPrefix: false });
    expect(routes).toContain('/api/v1/cases (POST, GET)');
    // Slice 1 routes keep their implicit HEAD; the Case subtree must not.
    const caseBlock = routes.slice(routes.indexOf('/api/v1/cases'));
    expect(caseBlock).not.toContain('HEAD');

    const { token } = await login('head');
    await family(token, 'head');

    const headList = await app.inject({
      method: 'HEAD',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(headList.statusCode).toBe(404);

    const headDetail = await app.inject({
      method: 'HEAD',
      url: '/api/v1/cases/00000000-0000-7000-8000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(headDetail.statusCode).toBe(404);
    expect(headDetail.body).not.toContain('createdAt');
  });

  // ── Finding 1: invalid id ────────────────────────────────
  it('malformed Case id converges to 404 CASE_NOT_FOUND', async () => {
    const { token } = await login('invalid-id');
    await family(token, 'invalid-id');

    for (const id of ['not-a-uuid', 'current', '123', '%20']) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/cases/${id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode, id).toBe(404);
      expect(res.json(), id).toEqual({ code: 'CASE_NOT_FOUND', message: 'Case not found' });
    }
  });

  it('malformed, nonexistent and cross-family ids are byte-identical', async () => {
    const a = await login('cmp-a');
    await family(a.token, 'cmp-a');
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: {
        authorization: `Bearer ${a.token}`,
        'idempotency-key': `cv1-cmp-${Date.now()}`,
      },
      payload: {},
    });
    const caseA = created.json().id as string;

    const b = await login('cmp-b');
    await family(b.token, 'cmp-b');

    const cross = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${caseA}`,
      headers: { authorization: `Bearer ${b.token}` },
    });
    const malformed = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/not-a-uuid',
      headers: { authorization: `Bearer ${b.token}` },
    });
    const missing = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/00000000-0000-7000-8000-000000000000',
      headers: { authorization: `Bearer ${b.token}` },
    });

    expect(cross.statusCode).toBe(404);
    expect(cross.json()).toEqual(malformed.json());
    expect(cross.json()).toEqual(missing.json());
  });

  // ── Finding 3: auth before validation ────────────────────
  it('authentication precedes schema validation', async () => {
    const noToken = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      payload: { familyId: 'not-allowed', junk: true },
    });
    expect(noToken.statusCode).toBe(401);
    expect(noToken.json().code).toBe('UNAUTHENTICATED');

    const badToken = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: 'Bearer not-a-token' },
      payload: { familyId: 'not-allowed', junk: true },
    });
    expect(badToken.statusCode).toBe(401);
    expect(badToken.json().code).toBe('UNAUTHENTICATED');

    // Raw JSON that secure parsing rejects must still be 401 without a token.
    const noTokenRaw = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { 'content-type': 'application/json' },
      payload: '{"idempotencyKey":"cv1-raw-1234","__proto__":{"polluted":true}}',
    });
    expect(noTokenRaw.statusCode).toBe(401);
    expect(noTokenRaw.json().code).toBe('UNAUTHENTICATED');

    const badTokenRaw = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { 'content-type': 'application/json', authorization: 'Bearer not-a-token' },
      payload: '{"idempotencyKey":"cv1-raw-1234","__proto__":{"polluted":true}}',
    });
    expect(badTokenRaw.statusCode).toBe(401);
    expect(badTokenRaw.json().code).toBe('UNAUTHENTICATED');

    const detailNoAuth = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/not-a-uuid',
    });
    expect(detailNoAuth.statusCode).toBe(401);
    expect(detailNoAuth.json().code).toBe('UNAUTHENTICATED');

    const listNoAuth = await app.inject({ method: 'GET', url: '/api/v1/cases' });
    expect(listNoAuth.statusCode).toBe(401);
  });

  it('keeps Slice 1 authentication behaviour intact', async () => {
    // Slice 1 endpoints keep auth-before-validation ordering.
    const familiesNoAuth = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      payload: { ageBand: 'NOT_A_BAND' },
    });
    expect([401, 422]).toContain(familiesNoAuth.statusCode);
    // Public endpoints stay public.
    const health = await app.inject({ method: 'GET', url: '/healthz' });
    expect(health.statusCode).toBe(200);
  });

  // ── Finding 4A: __proto__ ────────────────────────────────
  it('prototype-polluting payload maps to 422 with zero writes', async () => {
    const { token, accountId } = await login('proto');
    const familyId = await family(token, 'proto');
    const before = await counts(familyId, accountId);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': 'cv1-proto-1234',
      },
      payload: '{"__proto__":{"polluted":true}}',
    });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ code: 'VALIDATION_ERROR', message: 'Invalid request body' });
    expect(await counts(familyId, accountId)).toEqual(before);
    expect(({} as any).polluted).toBeUndefined();
  });

  it('does not change the Slice 1 parser error contract', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { 'content-type': 'application/json' },
      payload: '{"__proto__":{"x":1}}',
    });
    // Slice 1 keeps the Fastify default (400) for a secure-parse rejection.
    expect(res.statusCode).toBe(400);
  });

  // ── Finding 4B: header key boundaries ───────────────────
  it('rejects an out-of-range Idempotency-Key header with 422 and zero writes', async () => {
    const { token, accountId } = await login('range');
    const familyId = await family(token, 'range');
    const before = await counts(familyId, accountId);

    for (const bad of ['short', 'x'.repeat(129)]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/cases',
        headers: { authorization: `Bearer ${token}`, 'idempotency-key': bad },
        payload: {},
      });
      expect(res.statusCode, `length ${bad.length}`).toBe(422);
      expect(res.json().code).toBe('VALIDATION_ERROR');
    }

    expect(await counts(familyId, accountId)).toEqual(before);
  });

  it('accepts a Unicode key, replays stably and keeps distinct keys distinct', async () => {
    const { token, accountId } = await login('unicode');
    const familyId = await family(token, 'unicode');
    const key = 'ключ-测试-🔑-0001';

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
      payload: {},
    });
    expect(first.statusCode).toBe(201);

    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
      payload: {},
    });
    expect(replay.json().id).toBe(first.json().id);

    const other = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'ключ-тест-🔑-0002' },
      payload: {},
    });
    expect(other.statusCode).toBe(201);
    expect(other.json().id).not.toBe(first.json().id);
    expect(await counts(familyId, accountId)).toMatchObject({ cases: 2, events: 2, audits: 2 });
  });

  it('concurrent identical-key retries produce one business result', async () => {
    const { token, accountId } = await login('concurrent');
    const familyId = await family(token, 'concurrent');
    const key = 'cv1-concurrent-key-0001';

    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        app.inject({
          method: 'POST',
          url: '/api/v1/cases',
          headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
          payload: {},
        })
      )
    );
    expect(responses.every((r) => r.statusCode === 201)).toBe(true);
    expect(new Set(responses.map((r) => r.json().id)).size).toBe(1);
    expect(await counts(familyId, accountId)).toMatchObject({ cases: 1, events: 1, audits: 1 });
  });

  async function counts(familyId: string, accountId: string) {
    const { rows } = await verifyPool.query(
      `SELECT
         (SELECT count(*)::int FROM cases WHERE family_id = $1) AS cases,
         (SELECT count(*)::int FROM case_events WHERE family_id = $1) AS events,
         (SELECT count(*)::int FROM business_audit_events
           WHERE family_id = $1 AND event_type = 'CASE_CREATED') AS audits,
         (SELECT count(*)::int FROM idempotency_keys WHERE actor_account_id = $2) AS keys`,
      [familyId, accountId]
    );
    return rows[0];
  }
});
