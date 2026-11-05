/**
 * Provenance provider validation tests (Independent Review HIGH, T051).
 *
 * contracts/provenance.md:
 *  - SELF_STATEMENT: providedByPersonId must equal the subject Person
 *  - GUARDIAN_* / OTHER_MEMBER_RELAY: providedByPersonId must be a Person
 *    with membership in that family (anti-impersonation)
 * Violations → 422 AGE_BAND_SOURCE_NOT_ALLOWED.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/api/src/app.js';

describe('Provenance Provider Validation (T051)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `pv_${label}_${Date.now()}` },
    });
    const { token, person } = res.json();
    return { token, personId: person.id as string };
  }

  async function createFamily(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: `家庭-${label}`,
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        idempotencyKey: `fam-pv-${label}-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function addMember(token: string, familyId: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_OBSERVATION',
        idempotencyKey: `mem-pv-${label}-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().personId as string;
  }

  function postFamilyWithValues(token: string, label: string, values: unknown[]) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: `家庭-${label}`,
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        profileValues: values,
        idempotencyKey: `fam-pvv-${label}-${Date.now()}`,
      },
    });
  }

  function postMemberWithValues(
    token: string,
    familyId: string,
    label: string,
    values: unknown[],
    extra: Record<string, unknown> = {}
  ) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_OBSERVATION',
        profileValues: values,
        idempotencyKey: `mem-pvv-${label}-${Date.now()}`,
        ...extra,
      },
    });
  }

  it('family creator SELF_STATEMENT + fake provider → 422', async () => {
    const { token } = await login('creator-fake');
    const res = await postFamilyWithValues(token, 'creator-fake', [
      {
        attribute: 'DISPLAY_NAME',
        valueText: '家长 A',
        sourceKind: 'SELF_STATEMENT',
        providedByPersonId: '00000000-0000-4000-8000-000000000099',
      },
    ]);
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  it('family creator relay + non-family provider → 422', async () => {
    const { token } = await login('creator-relay');
    const res = await postFamilyWithValues(token, 'creator-relay', [
      {
        attribute: 'DISPLAY_NAME',
        valueText: '家长 A',
        sourceKind: 'GUARDIAN_RELAY',
        providedByPersonId: '00000000-0000-4000-8000-000000000098',
      },
    ]);
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  it('family creator SELF_STATEMENT with self as provider → 201', async () => {
    const { token, personId } = await login('creator-self');
    const res = await postFamilyWithValues(token, 'creator-self', [
      {
        attribute: 'DISPLAY_NAME',
        valueText: '家长 A',
        sourceKind: 'SELF_STATEMENT',
        providedByPersonId: personId,
      },
    ]);
    expect(res.statusCode).toBe(201);
  });

  it('member SELF_STATEMENT + fake provider → 422', async () => {
    const { token } = await login('mem-self-fake');
    const familyId = await createFamily(token, 'mem-self-fake');
    const res = await postMemberWithValues(token, familyId, 'mem-self-fake', [
      {
        attribute: 'DISPLAY_NAME',
        valueText: '小雨',
        sourceKind: 'SELF_STATEMENT',
        providedByPersonId: '00000000-0000-4000-8000-000000000097',
      },
    ]);
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  it('member relay + non-family provider → 422', async () => {
    const { token } = await login('mem-relay-fake');
    const familyId = await createFamily(token, 'mem-relay-fake');
    const outsider = await login('mem-relay-outsider');
    const res = await postMemberWithValues(token, familyId, 'mem-relay-fake', [
      {
        attribute: 'DISPLAY_NAME',
        valueText: '小雨',
        sourceKind: 'GUARDIAN_RELAY',
        providedByPersonId: outsider.personId,
      },
    ]);
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  it('member relay + valid family provider → 201', async () => {
    const { token } = await login('mem-relay-ok');
    const familyId = await createFamily(token, 'mem-relay-ok');
    const siblingId = await addMember(token, familyId, 'mem-relay-ok');
    const res = await postMemberWithValues(token, familyId, 'mem-relay-ok', [
      {
        attribute: 'DISPLAY_NAME',
        valueText: '小雨',
        sourceKind: 'OTHER_MEMBER_RELAY',
        providedByPersonId: siblingId,
      },
    ]);
    expect(res.statusCode).toBe(201);
  });

  it('no-account adult SELF_STATEMENT about self → 201', async () => {
    // A member without an account may still record SELF_STATEMENT about themself.
    const { token } = await login('noacct-self');
    const familyId = await createFamily(token, 'noacct-self');
    const memberPersonId = await addMember(token, familyId, 'noacct-self');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${memberPersonId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        profileValues: [
          {
            attribute: 'DISPLAY_NAME',
            valueText: '小雨',
            sourceKind: 'SELF_STATEMENT',
            providedByPersonId: memberPersonId,
          },
        ],
        idempotencyKey: `mem-noacct-${Date.now()}`,
      },
    });
    expect(res.statusCode).toBe(200);
  });
});
