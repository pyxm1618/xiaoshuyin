/**
 * S7-II-H02 — switch-primary JSON boundary regression.
 *
 * Frozen contract: undeclared fields are 422 VALIDATION_ERROR with zero writes,
 * and unauthenticated requests stay 401. Fastify's secure JSON parser rejects a
 * valid-JSON body carrying an own `__proto__` key before the route schema runs,
 * so the switch endpoint must map that parser error to 422 as well. The parser
 * error is indistinguishable from malformed JSON; both become 422 for this
 * endpoint only. This test records that fact instead of inventing a product
 * semantics for malformed JSON beyond the frozen contract.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

const PREFIX = 't7json_';

describe('switch-primary JSON boundary (S7-II-H02)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let seq = 0;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
  });

  afterAll(async () => {
    try {
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T7JSON-%')`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T7JSON-%')`);
      await admin.query(`DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T7JSON-%')`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T7JSON-%')`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T7JSON-%'`);
      await admin.query(`DELETE FROM persons WHERE created_by_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE '${PREFIX}%'`);
    } catch {
      // best-effort
    }
    await admin.end();
    await app.close();
  });

  async function login(label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `${PREFIX}${label}_${Date.now()}_${seq++}` },
    });
    expect(res.statusCode).toBe(200);
    const b = res.json();
    return {
      token: b.sessionToken as string,
      personId: b.person.id as string,
      accountId: b.accountId as string,
    };
  }

  async function family(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `t7json-fam-${label}-${Date.now()}-${seq++}`,
      },
      payload: {
        displayName: `T7JSON-${label}`,
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function createCase(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `t7json-case-${label}-${Date.now()}-${seq++}`,
      },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    return res.json() as {
      id: string;
      status: string;
      phase: string;
      primary: boolean;
      version: number;
    };
  }

  async function counts(familyId: string, accountId: string) {
    const { rows } = await admin.query(
      `SELECT
         (SELECT count(*)::int FROM cases WHERE family_id = $1) AS cases,
         (SELECT count(*)::int FROM case_events WHERE family_id = $1) AS events,
         (SELECT count(*)::int FROM business_audit_events WHERE family_id = $1) AS audits,
         (SELECT count(*)::int FROM idempotency_keys WHERE actor_account_id = $2) AS idem`,
      [familyId, accountId]
    );
    return rows[0] as { cases: number; events: number; audits: number; idem: number };
  }

  function postRaw(
    url: string,
    payload: string,
    token: string | null,
    key: string | null
  ) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (key) headers['idempotency-key'] = key;
    return app.inject({ method: 'POST', url, headers, payload });
  }

  it('valid JSON with an own __proto__ key -> 422 VALIDATION_ERROR and zero writes', async () => {
    const owner = await login('proto');
    const famId = await family(owner.token, 'proto');
    const a = await createCase(owner.token, 'proto-a');
    const b = await createCase(owner.token, 'proto-b');
    const before = await counts(famId, owner.accountId);

    const payload = JSON.stringify({
      reason: 'switch',
      expectedPrimaryCaseId: a.id,
      expectedPrimaryVersion: a.version,
      ['__proto__']: { polluted: true },
    });

    const res = await postRaw(
      `/api/v1/cases/${b.id}/switch-primary`,
      payload,
      owner.token,
      `t7json-proto-${Date.now()}-${seq++}`
    );

    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('VALIDATION_ERROR');
    expect(await counts(famId, owner.accountId)).toEqual(before);
  });

  it('malformed JSON -> 422 on the switch endpoint (shared parser error, documented)', async () => {
    const owner = await login('malformed');
    const famId = await family(owner.token, 'malformed');
    const a = await createCase(owner.token, 'malformed-a');
    const b = await createCase(owner.token, 'malformed-b');
    const before = await counts(famId, owner.accountId);

    const res = await postRaw(
      `/api/v1/cases/${b.id}/switch-primary`,
      '{"reason":"switch",',
      owner.token,
      `t7json-malformed-${Date.now()}-${seq++}`
    );

    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('VALIDATION_ERROR');
    expect(await counts(famId, owner.accountId)).toEqual(before);
  });

  it('unauthenticated stays 401 for both boundary cases', async () => {
    const world = await login('unauth');
    const famId = await family(world.token, 'unauth');
    const a = await createCase(world.token, 'unauth-a');
    const b = await createCase(world.token, 'unauth-b');

    const proto = await postRaw(
      `/api/v1/cases/${b.id}/switch-primary`,
      JSON.stringify({
        reason: 'switch',
        expectedPrimaryCaseId: a.id,
        expectedPrimaryVersion: a.version,
        ['__proto__']: {},
      }),
      null,
      `t7json-unauth-proto-${Date.now()}-${seq++}`
    );
    expect(proto.statusCode).toBe(401);

    const malformed = await postRaw(
      `/api/v1/cases/${b.id}/switch-primary`,
      '{"reason":',
      null,
      `t7json-unauth-malformed-${Date.now()}-${seq++}`
    );
    expect(malformed.statusCode).toBe(401);
  });

  it('does not change the existing create/message endpoint boundary semantics', async () => {
    const owner = await login('upstream');
    await family(owner.token, 'upstream');
    const c = await createCase(owner.token, 'upstream-c');

    const createRes = await postRaw(
      '/api/v1/cases',
      JSON.stringify({ ['__proto__']: {} }),
      owner.token,
      `t7json-create-proto-${Date.now()}-${seq++}`
    );
    expect(createRes.statusCode).toBe(422);
    expect(createRes.json().code).toBe('VALIDATION_ERROR');

    const messageRes = await postRaw(
      `/api/v1/cases/${c.id}/messages`,
      JSON.stringify({ content: 'hello', ['__proto__']: {} }),
      owner.token,
      `t7json-message-proto-${Date.now()}-${seq++}`
    );
    expect(messageRes.statusCode).toBe(422);
    expect(messageRes.json().code).toBe('VALIDATION_ERROR');
  });
});