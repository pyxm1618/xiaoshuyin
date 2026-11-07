/**
 * T065: Six-command idempotency matrix — ONE parameterized framework.
 *
 * Frozen OpenAPI: `Idempotency-Key` is an HTTP header for every mutating
 * command. Same key + same payload → replay; same key + different payload → 409.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import type pg from 'pg';
import {
  auth,
  createConsentRequest,
  createFamily,
  createMember,
  grantConsent,
  loginWithLabel,
} from '../setup/api.js';

let verifyPool: pg.Pool;

interface ApiResult {
  statusCode: number;
  body: any;
}

interface CommandEnv {
  base: Record<string, unknown>;
  variant: Record<string, unknown>;
  variantTarget?: string;
  expectedStatus: number;
  call: (key: string, payload: Record<string, unknown>, target?: string) => Promise<ApiResult>;
  count: () => Promise<number>;
}

interface CommandCase {
  command: string;
  setup: () => Promise<CommandEnv>;
}

describe('Idempotency Matrix (T065)', () => {
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

  function keyFor(command: string, purpose: string) {
    return `t065-${command}-${purpose}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  }

  async function count(sql: string, params: unknown[]): Promise<number> {
    const { rows } = await verifyPool.query(sql, params);
    return Number(rows[0].cnt);
  }

  async function setupFamily(label: string) {
    const actor = await loginWithLabel(app, `t065_${label}`);
    const res = await createFamily(app, actor.token, `t065-${label}`);
    expect(res.statusCode).toBe(201);
    return { token: actor.token, personId: actor.personId, familyId: res.json().id as string };
  }

  async function createRequest(token: string, label: string): Promise<string> {
    const res = await createConsentRequest(app, token, `t065-${label}`);
    expect(res.statusCode).toBe(201);
    return res.json().requestId as string;
  }

  async function grant(token: string, requestId: string, label: string): Promise<string> {
    const res = await grantConsent(app, token, `t065-${label}`, requestId);
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  function inject(
    method: 'POST' | 'PATCH',
    url: string,
    token: string,
    payload: Record<string, unknown>,
    key: string
  ): Promise<ApiResult> {
    return app.inject({
      method,
      url,
      headers: { ...auth(token), 'idempotency-key': key },
      payload,
    }).then((res) => ({ statusCode: res.statusCode, body: res.json() }));
  }

  const cases: CommandCase[] = [
    {
      command: 'FAMILY_CREATE',
      setup: async () => {
        const actor = await loginWithLabel(app, 't065_fc');
        return {
          base: {
            displayName: '幂等-A',
            creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
          },
          variant: {
            displayName: '幂等-B',
            creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
          },
          expectedStatus: 201,
          call: (key, payload) => inject('POST', '/api/v1/families', actor.token, payload, key),
          count: () => count(
            'SELECT count(*)::int AS cnt FROM families WHERE created_by_person_id = $1',
            [actor.personId]
          ),
        };
      },
    },
    {
      command: 'MEMBER_CREATE',
      setup: async () => {
        const { token, familyId } = await setupFamily('mc');
        return {
          base: { ageBand: 'MINOR_14_17', ageBandSource: 'GUARDIAN_OBSERVATION' },
          variant: { ageBand: 'MINOR_14_17', ageBandSource: 'GUARDIAN_RELAY' },
          expectedStatus: 201,
          call: (key, payload) => inject('POST', `/api/v1/families/${familyId}/members`, token, payload, key),
          count: () => count(
            'SELECT count(*)::int AS cnt FROM family_members WHERE family_id = $1',
            [familyId]
          ),
        };
      },
    },
    {
      command: 'MEMBER_UPDATE',
      setup: async () => {
        const { token, familyId } = await setupFamily('mu');
        const created = await createMember(app, token, familyId, 't065-mu', {
          ageBand: 'MINOR_14_17',
          ageBandSource: 'GUARDIAN_OBSERVATION',
        });
        expect(created.statusCode).toBe(201);
        const targetPersonId = created.json().personId as string;
        return {
          base: { values: [{ attribute: 'DISPLAY_NAME', value: '名字A', source: 'GUARDIAN_OBSERVATION' }] },
          variant: { values: [{ attribute: 'DISPLAY_NAME', value: '名字B', source: 'GUARDIAN_OBSERVATION' }] },
          expectedStatus: 200,
          call: (key, payload) =>
            inject('PATCH', `/api/v1/families/${familyId}/members/${targetPersonId}`, token, payload, key),
          count: () => count(
            "SELECT count(*)::int AS cnt FROM person_profile_values WHERE person_id = $1 AND status = 'RECORDED'",
            [targetPersonId]
          ),
        };
      },
    },
    {
      command: 'GUARDIAN_CONSENT_REQUEST',
      setup: async () => {
        const { token, familyId } = await setupFamily('gcr');
        const channel = process.env['NODE_ENV'] === 'test' ? 'TEST' : 'MINIPROGRAM';
        return {
          base: { declaredAgeBand: 'UNDER_14', noticeVersion: 'v1', channel },
          variant: { declaredAgeBand: 'UNDER_14', noticeVersion: 'v999', channel },
          expectedStatus: 201,
          call: (key, payload) => inject('POST', '/api/v1/compliance/guardian-consents/requests', token, payload, key),
          count: () => count(
            'SELECT count(*)::int AS cnt FROM guardian_consent_requests WHERE family_id = $1',
            [familyId]
          ),
        };
      },
    },
    {
      command: 'GUARDIAN_CONSENT_GRANT',
      setup: async () => {
        const { token, familyId } = await setupFamily('gcg');
        const requestA = await createRequest(token, 'gcg-a');
        const requestB = await createRequest(token, 'gcg-b');
        return {
          base: { onboardingRequestId: requestA, noticeVersion: 'v1', accepted: true },
          variant: { onboardingRequestId: requestB, noticeVersion: 'v1', accepted: true },
          expectedStatus: 201,
          call: (key, payload) => inject('POST', '/api/v1/compliance/guardian-consents', token, payload, key),
          count: () => count(
            'SELECT count(*)::int AS cnt FROM consent_records WHERE family_id = $1',
            [familyId]
          ),
        };
      },
    },
    {
      command: 'GUARDIAN_CONSENT_REVOKE',
      setup: async () => {
        const { token, familyId } = await setupFamily('gcv');
        const consentA = await grant(token, await createRequest(token, 'gcv-a'), 'gcv-a');
        const consentB = await grant(token, await createRequest(token, 'gcv-b'), 'gcv-b');
        return {
          base: {},
          variant: {},
          variantTarget: consentB,
          expectedStatus: 200,
          call: (key, payload, target) =>
            inject('POST', `/api/v1/consents/${target ?? consentA}/revoke`, token, payload, key),
          count: () => count(
            'SELECT count(*)::int AS cnt FROM consent_records WHERE family_id = $1',
            [familyId]
          ),
        };
      },
    },
  ];

  for (const c of cases) {
    describe(`${c.command}`, () => {
      it('same key + same payload → replay original response', async () => {
        const env = await c.setup();
        const key = keyFor(c.command, 'replay');
        const first = await env.call(key, env.base);
        expect(first.statusCode).toBe(env.expectedStatus);

        const replay = await env.call(key, env.base);
        expect(replay.statusCode).toBe(first.statusCode);
        expect(replay.body).toEqual(first.body);
      });

      it('same key + different payload → 409 IDEMPOTENCY_PAYLOAD_MISMATCH', async () => {
        const env = await c.setup();
        const key = keyFor(c.command, 'mismatch');
        const first = await env.call(key, env.base);
        expect(first.statusCode).toBe(env.expectedStatus);

        const mismatch = await env.call(key, env.variant, env.variantTarget);
        expect(mismatch.statusCode).toBe(409);
        expect(mismatch.body.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
      });

      it('no duplicate business object across repeated replays', async () => {
        const env = await c.setup();
        const key = keyFor(c.command, 'nodup');
        const before = await env.count();

        const first = await env.call(key, env.base);
        expect(first.statusCode).toBe(env.expectedStatus);
        const afterFirst = await env.count();
        expect(afterFirst - before).toBe(1);

        for (let i = 0; i < 3; i++) {
          const replay = await env.call(key, env.base);
          expect(replay.statusCode).toBe(env.expectedStatus);
          expect(replay.body).toEqual(first.body);
        }
        expect(await env.count()).toBe(afterFirst);
      });
    });
  }

  it('missing Idempotency-Key header → 422', async () => {
    const { token } = await setupFamily('nokey');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: auth(token),
      payload: {
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('concurrent 20 requests with same key → only 1 business object', async () => {
    const { token, familyId } = await setupFamily('conc');
    const key = keyFor('MEMBER_CREATE', 'concurrent');
    const payload = { ageBand: 'MINOR_14_17', ageBandSource: 'GUARDIAN_OBSERVATION' };

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        app.inject({
          method: 'POST',
          url: `/api/v1/families/${familyId}/members`,
          headers: { ...auth(token), 'idempotency-key': key },
          payload,
        })
      )
    );

    for (const r of results) {
      expect([200, 201, 409]).toContain(r.statusCode);
    }

    expect(await count(
      'SELECT count(*)::int AS cnt FROM family_members WHERE family_id = $1',
      [familyId]
    )).toBe(2);

    const personIds = new Set(
      results.map((r) => r.json().personId).filter((id) => typeof id === 'string')
    );
    expect(personIds.size).toBe(1);
  });

  it('GET requests do not consume idempotency keys', async () => {
    const { token, personId } = await setupFamily('get');

    const { rows: accountRows } = await verifyPool.query(
      'SELECT a.id FROM accounts a JOIN persons p ON p.account_id = a.id WHERE p.id = $1',
      [personId]
    );
    const accountId = accountRows[0].id;

    const before = await count(
      'SELECT count(*)::int AS cnt FROM idempotency_keys WHERE actor_account_id = $1',
      [accountId]
    );

    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/families/current',
        headers: auth(token),
      });
      expect(res.statusCode).toBe(200);
    }

    const after = await count(
      'SELECT count(*)::int AS cnt FROM idempotency_keys WHERE actor_account_id = $1',
      [accountId]
    );
    expect(after).toBe(before);
  });
});