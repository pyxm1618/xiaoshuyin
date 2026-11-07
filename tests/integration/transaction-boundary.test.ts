/**
 * F7: family-level transaction boundary.
 *
 * contract §4.4 requires
 *   resolve → authorize → set_family_context → read/write
 * inside ONE transaction.
 *
 * The only way to observe that from outside is the number of pooled
 * connections a request uses:
 *   authenticated request = 1 auth-prehandler connection + 1 route transaction.
 *   mutating command       = +1 idempotency peek connection.
 * A split implementation (identity tx + second RLS tx) would use one more.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  auth,
  commandHeaders,
  createConsentRequest,
  createFamily,
  grantConsent,
  loginWithLabel,
} from '../setup/api.js';

let verifyPool: pg.Pool;
const originalConnect = pg.Pool.prototype.connect;
let connects = 0;

function instrumentPool() {
  connects = 0;
  (pg.Pool.prototype as any).connect = function (...args: any[]) {
    connects += 1;
    return (originalConnect as any).apply(this, args);
  };
}

function restorePool() {
  (pg.Pool.prototype as any).connect = originalConnect;
}

describe('Family transaction boundary (F7)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    restorePool();
    await verifyPool.end();
    await app.close();
  });

  async function measure<T>(fn: () => Promise<T>): Promise<{ result: T; connections: number }> {
    instrumentPool();
    try {
      const result = await fn();
      return { result, connections: connects };
    } finally {
      restorePool();
    }
  }

  it('GET /families/current: resolve + authorize + set context + read in one transaction', async () => {
    const actor = await loginWithLabel(app, 'f7_current');
    const fam = await createFamily(app, actor.token, 'f7-current');
    expect(fam.statusCode).toBe(201);

    const { result, connections } = await measure(() =>
      app.inject({
        method: 'GET',
        url: '/api/v1/families/current',
        headers: auth(actor.token),
      })
    );
    expect(result.statusCode).toBe(200);
    expect(connections).toBe(2);
  });

  it('GET /consents: one transaction (no second RLS transaction)', async () => {
    const actor = await loginWithLabel(app, 'f7_consents');
    const fam = await createFamily(app, actor.token, 'f7-consents');
    expect(fam.statusCode).toBe(201);

    const { result, connections } = await measure(() =>
      app.inject({
        method: 'GET',
        url: '/api/v1/consents',
        headers: auth(actor.token),
      })
    );
    expect(result.statusCode).toBe(200);
    expect(connections).toBe(2);
  });

  it('POST guardian consent request: one business transaction', async () => {
    const actor = await loginWithLabel(app, 'f7_request');
    const fam = await createFamily(app, actor.token, 'f7-request');
    expect(fam.statusCode).toBe(201);

    const { result, connections } = await measure(() =>
      createConsentRequest(app, actor.token, 'f7-request')
    );
    expect(result.statusCode).toBe(201);
    // auth prehandler + idempotency peek + business transaction.
    expect(connections).toBe(3);
  });

  it('POST guardian consent grant: one business transaction', async () => {
    const actor = await loginWithLabel(app, 'f7_grant');
    const fam = await createFamily(app, actor.token, 'f7-grant');
    expect(fam.statusCode).toBe(201);
    const req = await createConsentRequest(app, actor.token, 'f7-grant');
    expect(req.statusCode).toBe(201);

    const { result, connections } = await measure(() =>
      grantConsent(app, actor.token, 'f7-grant', req.json().requestId)
    );
    expect(result.statusCode).toBe(201);
    expect(connections).toBe(3);
  });

  it('POST consent revoke: one business transaction', async () => {
    const actor = await loginWithLabel(app, 'f7_revoke');
    const fam = await createFamily(app, actor.token, 'f7-revoke');
    expect(fam.statusCode).toBe(201);
    const req = await createConsentRequest(app, actor.token, 'f7-revoke');
    const grant = await grantConsent(app, actor.token, 'f7-revoke', req.json().requestId);
    expect(grant.statusCode).toBe(201);

    const { result, connections } = await measure(() =>
      app.inject({
        method: 'POST',
        url: `/api/v1/consents/${grant.json().id}/revoke`,
        headers: commandHeaders(actor.token, 'f7-revoke-rv'),
        payload: {},
      })
    );
    expect(result.statusCode).toBe(200);
    expect(connections).toBe(3);
  });
});