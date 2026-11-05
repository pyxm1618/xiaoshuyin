/**
 * T065: Six-command idempotency matrix — ONE parameterized framework.
 *
 *   FAMILY_CREATE / MEMBER_CREATE / MEMBER_UPDATE /
 *   GUARDIAN_CONSENT_REQUEST / GUARDIAN_CONSENT_GRANT / GUARDIAN_CONSENT_REVOKE
 *
 * For EVERY command the same three assertions are generated from the case data:
 *   1. same key + same payload   → replay of the ORIGINAL response
 *   2. same key + different payload → 409 IDEMPOTENCY_PAYLOAD_MISMATCH
 *   3. no duplicate business object (exactly +1 object, replays add nothing)
 *
 * Plus: 20 concurrent same-key requests, and GET never consumes a key.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import type pg from 'pg';

let verifyPool: pg.Pool;

interface ApiResult {
  statusCode: number;
  body: any;
}

interface CommandEnv {
  /** First request payload, WITHOUT idempotencyKey. */
  base: Record<string, unknown>;
  /** Different payload for the mismatch case, WITHOUT idempotencyKey. */
  variant: Record<string, unknown>;
  /** Optional URL target override for the mismatch case (e.g. another consent id). */
  variantTarget?: string;
  expectedStatus: number;
  call: (payload: Record<string, unknown>, target?: string) => Promise<ApiResult>;
  /** Count of the business objects this command is allowed to create. */
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

  function auth(token: string) {
    return { authorization: `Bearer ${token}` };
  }

  function keyFor(command: string, purpose: string) {
    return `t065-${command}-${purpose}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  }

  async function count(sql: string, params: unknown[]): Promise<number> {
    const { rows } = await verifyPool.query(sql, params);
    return Number(rows[0].cnt);
  }

  async function login(label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `t065_${label}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}` },
    });
    expect([200, 201]).toContain(res.statusCode);
    const { token, person } = res.json();
    return { token: token as string, personId: person.id as string };
  }

  async function setupFamily(label: string) {
    const { token, personId } = await login(label);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: auth(token),
      payload: {
        displayName: `幂等-${label}`,
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        idempotencyKey: keyFor('SETUP_FAMILY', label),
      },
    });
    expect(res.statusCode).toBe(201);
    return { token, personId, familyId: res.json().id as string };
  }

  async function getNoticeHash(token: string): Promise<string> {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/notices',
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    return res.json().notices[0].hash as string;
  }

  async function createRequest(token: string, label: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents/requests',
      headers: auth(token),
      payload: { noticeVersion: 'v1', idempotencyKey: keyFor('SETUP_REQ', label) },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function grant(token: string, requestId: string, label: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: auth(token),
      payload: {
        consentRequestId: requestId,
        accepted: true,
        noticeVersion: 'v1',
        noticeHash: await getNoticeHash(token),
        idempotencyKey: keyFor('SETUP_GRANT', label),
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function inject(
    method: 'POST' | 'PATCH',
    url: string,
    token: string,
    payload: Record<string, unknown>
  ): Promise<ApiResult> {
    const res = await app.inject({ method, url, headers: auth(token), payload });
    return { statusCode: res.statusCode, body: res.json() };
  }

  // ── Case data: six commands, one shared assertion framework ──

  const cases: CommandCase[] = [
    {
      command: 'FAMILY_CREATE',
      setup: async () => {
        const { token, personId } = await login('fc');
        return {
          base: { displayName: '幂等-A', ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
          variant: { displayName: '幂等-B', ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
          expectedStatus: 201,
          call: (payload) => inject('POST', '/api/v1/families', token, payload),
          count: () => count(
            'SELECT count(*)::int AS cnt FROM families WHERE created_by_person_id = $1',
            [personId]
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
          call: (payload) => inject('POST', `/api/v1/families/${familyId}/members`, token, payload),
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
        const created = await inject('POST', `/api/v1/families/${familyId}/members`, token, {
          ageBand: 'MINOR_14_17',
          ageBandSource: 'GUARDIAN_OBSERVATION',
          idempotencyKey: keyFor('SETUP_MEMBER', 'mu'),
        });
        expect(created.statusCode).toBe(201);
        const targetPersonId = created.body.personId as string;
        return {
          base: {
            profileValues: [{ attribute: 'DISPLAY_NAME', valueText: '名字A', sourceKind: 'GUARDIAN_OBSERVATION' }],
          },
          variant: {
            profileValues: [{ attribute: 'DISPLAY_NAME', valueText: '名字B', sourceKind: 'GUARDIAN_OBSERVATION' }],
          },
          expectedStatus: 200,
          call: (payload) => inject('PATCH', `/api/v1/families/${familyId}/members/${targetPersonId}`, token, payload),
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
        return {
          base: { noticeVersion: 'v1' },
          variant: { noticeVersion: 'v2' },
          expectedStatus: 201,
          call: (payload) => inject('POST', '/api/v1/compliance/guardian-consents/requests', token, payload),
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
        const hash = await getNoticeHash(token);
        return {
          base: { consentRequestId: requestA, accepted: true, noticeVersion: 'v1', noticeHash: hash },
          variant: { consentRequestId: requestB, accepted: true, noticeVersion: 'v1', noticeHash: hash },
          expectedStatus: 201,
          call: (payload) => inject('POST', '/api/v1/compliance/guardian-consents', token, payload),
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
          call: (payload, target) =>
            inject('POST', `/api/v1/consents/${target ?? consentA}/revoke`, token, payload),
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
        const first = await env.call({ ...env.base, idempotencyKey: key });
        expect(first.statusCode).toBe(env.expectedStatus);

        const replay = await env.call({ ...env.base, idempotencyKey: key });
        expect(replay.statusCode).toBe(first.statusCode);
        expect(replay.body).toEqual(first.body);
      });

      it('same key + different payload → 409 IDEMPOTENCY_PAYLOAD_MISMATCH', async () => {
        const env = await c.setup();
        const key = keyFor(c.command, 'mismatch');
        const first = await env.call({ ...env.base, idempotencyKey: key });
        expect(first.statusCode).toBe(env.expectedStatus);

        const mismatch = await env.call(
          { ...env.variant, idempotencyKey: key },
          env.variantTarget
        );
        expect(mismatch.statusCode).toBe(409);
        expect(mismatch.body.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
      });

      it('no duplicate business object across repeated replays', async () => {
        const env = await c.setup();
        const key = keyFor(c.command, 'nodup');
        const before = await env.count();

        const first = await env.call({ ...env.base, idempotencyKey: key });
        expect(first.statusCode).toBe(env.expectedStatus);
        const afterFirst = await env.count();
        expect(afterFirst - before).toBe(1);

        for (let i = 0; i < 3; i++) {
          const replay = await env.call({ ...env.base, idempotencyKey: key });
          expect(replay.statusCode).toBe(env.expectedStatus);
          expect(replay.body).toEqual(first.body);
        }
        expect(await env.count()).toBe(afterFirst);
      });
    });
  }

  it('concurrent 20 requests with same key → only 1 business object', async () => {
    const { token, familyId } = await setupFamily('conc');
    const key = keyFor('MEMBER_CREATE', 'concurrent');
    const payload = {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_OBSERVATION',
      idempotencyKey: key,
    };

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        app.inject({
          method: 'POST',
          url: `/api/v1/families/${familyId}/members`,
          headers: auth(token),
          payload,
        })
      )
    );

    for (const r of results) {
      expect([200, 201, 409]).toContain(r.statusCode);
    }

    // 1 manager + 1 created member — no 20 duplicate memberships.
    expect(await count(
      'SELECT count(*)::int AS cnt FROM family_members WHERE family_id = $1',
      [familyId]
    )).toBe(2);

    // Every successful response refers to the SAME original Person.
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
