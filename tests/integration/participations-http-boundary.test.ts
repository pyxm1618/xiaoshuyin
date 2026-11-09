import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  commandHeaders,
  createFamily,
  createMember,
  loginWithLabel,
  memberPayload,
} from '../setup/api.js';

describe('Slice 4 participation HTTP boundary', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let token: string;
  let accountId: string;
  let familyId: string;
  let caseId: string;
  let targetPersonId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();

    const actor = await loginWithLabel(app, 's4-boundary-manager');
    token = actor.token;
    accountId = actor.accountId;

    const family = await createFamily(app, token, 's4-boundary');
    expect(family.statusCode).toBe(201);
    familyId = family.json().id;

    const member = await createMember(
      app,
      token,
      familyId,
      's4-boundary-target',
      memberPayload('ADULT', 'GUARDIAN_RELAY')
    );
    expect(member.statusCode).toBe(201);
    targetPersonId = member.json().personId;

    const c = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: commandHeaders(token, 's4-boundary-case'),
      payload: {},
    });
    expect(c.statusCode).toBe(201);
    caseId = c.json().id;
  });

  afterAll(async () => {
    await admin.end();
    await app.close();
  });

  async function counts() {
    const { rows } = await admin.query(
      `SELECT
        (SELECT count(*)::int FROM case_participants WHERE family_id=$1) AS participations,
        (SELECT count(*)::int FROM business_audit_events
          WHERE family_id=$1 AND resource_type='CASE_PARTICIPANT') AS audits,
        (SELECT count(*)::int FROM idempotency_keys
          WHERE actor_account_id=$2
            AND command_type IN (
              'PARTICIPATION_INVITE_CREATE','PARTICIPATION_ACCEPT',
              'PARTICIPATION_DECLINE','PARTICIPATION_WITHDRAW'
            )) AS idempotency`,
      [familyId, accountId]
    );
    return rows[0];
  }

  const forbidden: Record<string, unknown>[] = [
    { familyId: '11111111-1111-7111-8111-111111111111' },
    { caseId: '22222222-2222-7222-8222-222222222222' },
    { state: 'PENDING' },
    { expiresAt: '2099-01-01T00:00:00.000Z' },
    { inviteToken: 'client-controlled' },
    { guardianPersonId: '33333333-3333-7333-8333-333333333333' },
    { consentId: '44444444-4444-7444-8444-444444444444' },
    { role: 'CHILD' },
  ];

  for (const extra of forbidden) {
    const field = Object.keys(extra)[0]!;
    it(`rejects client-controlled ${field} with 422 and zero writes`, async () => {
      const before = await counts();
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/cases/${caseId}/participation-invites`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          personId: targetPersonId,
          idempotencyKey: `s4-${field}-${Date.now()}`,
          ...extra,
        },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json()).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
      });
      expect(await counts()).toEqual(before);
    });
  }

  it('accept/decline/withdraw bodies reject undeclared fields before any write', async () => {
    const before = await counts();
    for (const request of [
      { method:'POST' as const, url:'/api/v1/participation-invites/not-a-real-token/accept' },
      { method:'POST' as const, url:'/api/v1/participations/00000000-0000-7000-8000-000000000000/decline' },
      { method:'POST' as const, url:'/api/v1/participations/00000000-0000-7000-8000-000000000000/withdraw' },
    ]) {
      const res = await app.inject({
        ...request,
        headers: { authorization: `Bearer ${token}` },
        payload: { idempotencyKey: 's4-strict-body-0001', familyId },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json()).toEqual({
        code:'VALIDATION_ERROR',
        message:'Invalid request body',
      });
    }
    expect(await counts()).toEqual(before);
  });
});
