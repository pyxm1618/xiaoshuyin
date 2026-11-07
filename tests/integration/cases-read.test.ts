/**
 * T055 / T058 — Case list and detail semantics.
 *
 * List: `{ items }`, ordering primary DESC → createdAt ASC → id ASC, no
 * pagination, real empty collection, Family isolation.
 * Detail: independent status/phase, unified 404 for missing / cross-Family,
 * no Case fields in the error body.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

let verifyPool: pg.Pool;

describe('Case read (T055)', () => {
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
      payload: { code: `t055_${label}_${Date.now()}_${seq++}` },
    });
    const body = res.json();
    return { token: body.sessionToken as string, personId: body.person.id as string };
  }

  async function createFamily(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `t055-fam-${label}-${Date.now()}-${seq++}`,
      },
      payload: {
        displayName: `T055-${label}`,
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function createCase(token: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `t055-case-${Date.now()}-${seq++}`,
      },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    return res.json();
  }

  function list(token: string) {
    return app.inject({
      method: 'GET',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}` },
    });
  }

  function detail(token: string, id: string) {
    return app.inject({
      method: 'GET',
      url: `/api/v1/cases/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
  }

  it('empty Family returns a real empty collection', async () => {
    const { token } = await login('empty');
    await createFamily(token, 'empty');
    const res = await list(token);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [] });
  });

  it('lists every Case with primary first and stable ordering', async () => {
    const { token } = await login('order');
    await createFamily(token, 'order');
    const primary = await createCase(token);
    const candidateA = await createCase(token);
    const candidateB = await createCase(token);

    const res = await list(token);
    expect(res.statusCode).toBe(200);
    const ids = res.json().items.map((c: any) => c.id);
    expect(ids).toEqual([primary.id, candidateA.id, candidateB.id]);

    const primaries = res.json().items.filter((c: any) => c.primary);
    expect(primaries.length).toBe(1);
    expect(primaries[0].id).toBe(primary.id);
  });

  it('orders deterministically by createdAt then id (no pagination)', async () => {
    const { token } = await login('stable');
    await createFamily(token, 'stable');
    await createCase(token);
    const first = (await list(token)).json().items;
    const second = (await list(token)).json().items;
    expect(second).toEqual(first);
    // No pagination parameters are honoured in this Slice.
    const withQuery = await app.inject({
      method: 'GET',
      url: '/api/v1/cases?limit=1&page=2',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(withQuery.statusCode).toBe(200);
    expect(withQuery.json().items.length).toBe(first.length);
  });

  it('detail returns status and phase as independent fields', async () => {
    const { token } = await login('detail');
    await createFamily(token, 'detail');
    const created = await createCase(token);

    const res = await detail(token, created.id);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('OPEN');
    expect(body.phase).toBe('INTAKE');
    expect(Object.keys(body).sort()).toEqual([
      'createdAt', 'id', 'phase', 'primary', 'status', 'updatedAt', 'version',
    ]);
  });

  it('unknown id returns the uniform 404 CASE_NOT_FOUND', async () => {
    const { token } = await login('unknown');
    await createFamily(token, 'unknown');
    const res = await detail(token, '00000000-0000-7000-8000-000000000000');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: 'CASE_NOT_FOUND', message: 'Case not found' });
  });

  it('cross-Family id is indistinguishable from a missing id', async () => {
    const a = await login('cross-a');
    await createFamily(a.token, 'cross-a');
    const caseA = await createCase(a.token);

    const b = await login('cross-b');
    await createFamily(b.token, 'cross-b');
    await createCase(b.token);

    const foreign = await detail(b.token, caseA.id);
    const missing = await detail(b.token, '00000000-0000-7000-8000-000000000000');

    expect(foreign.statusCode).toBe(404);
    expect(foreign.json()).toEqual(missing.json());
    expect(JSON.stringify(foreign.json())).not.toContain(caseA.id);
  });

  it('list never returns another Family\'s Cases', async () => {
    const a = await login('iso-a');
    await createFamily(a.token, 'iso-a');
    const caseA = await createCase(a.token);

    const b = await login('iso-b');
    await createFamily(b.token, 'iso-b');
    const listB = await list(b.token);

    expect(listB.json()).toEqual({ items: [] });
    expect(JSON.stringify(listB.json())).not.toContain(caseA.id);
  });
});
