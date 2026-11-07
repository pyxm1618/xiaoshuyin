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
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  auth,
  commandHeaders,
  createConsentRequest,
  createFamily,
  createMember,
  grantConsent,
  loginWithLabel,
  updateMember,
} from '../setup/api.js';

let verifyPool: pg.Pool;

describe('Provenance Provider Validation (T051)', () => {
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

  async function createFamilyFor(token: string, label: string) {
    const res = await createFamily(app, token, `pv_${label}`);
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function addMember(
    token: string,
    familyId: string,
    label: string,
    ageBand: 'ADULT' | 'MINOR_14_17' = 'MINOR_14_17'
  ) {
    const res = await createMember(app, token, familyId, `pv_${label}`, {
      ageBand,
      ageBandSource: 'GUARDIAN_OBSERVATION',
    });
    expect(res.statusCode).toBe(201);
    return res.json().personId as string;
  }

  function postFamilyWithValues(token: string, label: string, values: unknown[]) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: commandHeaders(token, `fam-pvv-${label}`),
      payload: {
        displayName: `家庭-${label}`,
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT', values },
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
      headers: commandHeaders(token, `mem-pvv-${label}`),
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_OBSERVATION',
        values,
        ...extra,
      },
    });
  }

  it('family creator SELF_STATEMENT + fake provider → 422', async () => {
    const { token } = await loginWithLabel(app, 'pv_creator-fake');
    const res = await postFamilyWithValues(token, 'creator-fake', [
      {
        attribute: 'DISPLAY_NAME',
        value: '家长 A',
        source: 'SELF_STATEMENT',
        providedByPersonId: '00000000-0000-4000-8000-000000000099',
      },
    ]);
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  it('family creator relay + non-family provider → 422', async () => {
    const { token } = await loginWithLabel(app, 'pv_creator-relay');
    const res = await postFamilyWithValues(token, 'creator-relay', [
      {
        attribute: 'DISPLAY_NAME',
        value: '家长 A',
        source: 'GUARDIAN_RELAY',
        providedByPersonId: '00000000-0000-4000-8000-000000000098',
      },
    ]);
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  it('family creator SELF_STATEMENT with self as provider → 201', async () => {
    const { token, personId } = await loginWithLabel(app, 'pv_creator-self');
    const res = await postFamilyWithValues(token, 'creator-self', [
      {
        attribute: 'DISPLAY_NAME',
        value: '家长 A',
        source: 'SELF_STATEMENT',
        providedByPersonId: personId,
      },
    ]);
    expect(res.statusCode).toBe(201);
  });

  it('member SELF_STATEMENT + fake provider → 422', async () => {
    const { token } = await loginWithLabel(app, 'pv_mem-self-fake');
    const familyId = await createFamilyFor(token, 'mem-self-fake');
    const res = await postMemberWithValues(token, familyId, 'mem-self-fake', [
      {
        attribute: 'DISPLAY_NAME',
        value: '小雨',
        source: 'SELF_STATEMENT',
        providedByPersonId: '00000000-0000-4000-8000-000000000097',
      },
    ]);
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  it('member relay + non-family provider → 422', async () => {
    const { token } = await loginWithLabel(app, 'pv_mem-relay-fake');
    const familyId = await createFamilyFor(token, 'mem-relay-fake');
    const outsider = await loginWithLabel(app, 'pv_mem-relay-outsider');
    const res = await postMemberWithValues(token, familyId, 'mem-relay-fake', [
      {
        attribute: 'DISPLAY_NAME',
        value: '小雨',
        source: 'GUARDIAN_RELAY',
        providedByPersonId: outsider.personId,
      },
    ]);
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  it('member relay + valid family provider → 201', async () => {
    const { token } = await loginWithLabel(app, 'pv_mem-relay-ok');
    const familyId = await createFamilyFor(token, 'mem-relay-ok');
    const siblingId = await addMember(token, familyId, 'mem-relay-ok');
    const res = await postMemberWithValues(token, familyId, 'mem-relay-ok', [
      {
        attribute: 'DISPLAY_NAME',
        value: '小雨',
        source: 'OTHER_MEMBER_RELAY',
        providedByPersonId: siblingId,
      },
    ]);
    expect(res.statusCode).toBe(201);
  });

  it('no-account ADULT SELF_STATEMENT about self → 201', async () => {
    const { token } = await loginWithLabel(app, 'pv_noacct-self');
    const familyId = await createFamilyFor(token, 'noacct-self');
    const memberPersonId = await addMember(token, familyId, 'noacct-self', 'ADULT');

    const { rows: personRows } = await verifyPool.query(
      'SELECT account_id FROM persons WHERE id = $1',
      [memberPersonId]
    );
    expect(personRows.length).toBe(1);
    expect(personRows[0].account_id).toBeNull();
    const { rows: profileRows } = await verifyPool.query(
      'SELECT age_band FROM person_compliance_profiles WHERE person_id = $1',
      [memberPersonId]
    );
    expect(profileRows[0].age_band).toBe('ADULT');

    const res = await updateMember(app, token, familyId, memberPersonId, 'pv-noacct', [
      {
        attribute: 'DISPLAY_NAME',
        value: '小雨',
        source: 'SELF_STATEMENT',
        providedByPersonId: memberPersonId,
      },
    ]);
    expect(res.statusCode).toBe(200);

    const { rows: valueRows } = await verifyPool.query(
      `SELECT value_text, provided_by_person_id FROM person_profile_values
       WHERE person_id = $1 AND status = 'RECORDED'`,
      [memberPersonId]
    );
    expect(valueRows.length).toBe(1);
    expect(valueRows[0].value_text).toBe('小雨');
    expect(valueRows[0].provided_by_person_id).toBe(memberPersonId);
  });

  // ── UNDER_14 create: per-value source is restricted to guardian origin ──

  async function grantConsentFor(token: string, label: string) {
    const reqRes = await createConsentRequest(app, token, `pv_${label}`);
    expect(reqRes.statusCode).toBe(201);
    const grantRes = await grantConsent(app, token, `pv_${label}`, reqRes.json().requestId);
    expect(grantRes.statusCode).toBe(201);
    return grantRes.json();
  }

  function postUnder14WithValues(
    token: string,
    familyId: string,
    label: string,
    consentId: string,
    values: unknown[]
  ) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: commandHeaders(token, `mem-u14-${label}`),
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        guardianConsentId: consentId,
        values,
      },
    });
  }

  async function countFamilyScoped(familyId: string) {
    const q = async (sql: string) => {
      const { rows } = await verifyPool.query(sql, [familyId]);
      return rows[0].cnt as number;
    };
    return {
      memberships: await q('SELECT count(*)::int AS cnt FROM family_members WHERE family_id = $1'),
      profiles: await q(
        `SELECT count(*)::int AS cnt FROM person_compliance_profiles cp
         JOIN family_members fm ON fm.person_id = cp.person_id WHERE fm.family_id = $1`
      ),
      values: await q(
        `SELECT count(*)::int AS cnt FROM person_profile_values v
         JOIN family_members fm ON fm.person_id = v.person_id WHERE fm.family_id = $1`
      ),
    };
  }

  async function expectUnder14Rejected(
    label: string,
    values: unknown[],
    expectedCode: string
  ) {
    const { token } = await loginWithLabel(app, `pv_u14-${label}`);
    const familyId = await createFamilyFor(token, `u14-${label}`);
    const consent = await grantConsentFor(token, `u14-${label}`);

    const before = await countFamilyScoped(familyId);

    const res = await postUnder14WithValues(token, familyId, label, consent.id, values);
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe(expectedCode);

    const after = await countFamilyScoped(familyId);
    expect(after.memberships).toBe(before.memberships);
    expect(after.profiles).toBe(before.profiles);
    expect(after.values).toBe(before.values);
    const { rows: boundRows } = await verifyPool.query(
      'SELECT bound_person_id FROM consent_records WHERE id = $1',
      [consent.id]
    );
    expect(boundRows[0].bound_person_id).toBeNull();
  }

  it('UNDER_14 create + GUARDIAN_RELAY + guardian provider → 201', async () => {
    const { token, personId } = await loginWithLabel(app, 'pv_u14-relay-ok');
    const familyId = await createFamilyFor(token, 'u14-relay-ok');
    const consent = await grantConsentFor(token, 'u14-relay-ok');
    const res = await postUnder14WithValues(token, familyId, 'relay-ok', consent.id, [
      {
        attribute: 'DISPLAY_NAME',
        value: '小树',
        source: 'GUARDIAN_RELAY',
        providedByPersonId: personId,
      },
    ]);
    expect(res.statusCode).toBe(201);
  });

  it('UNDER_14 create + GUARDIAN_OBSERVATION + guardian provider → 201', async () => {
    const { token, personId } = await loginWithLabel(app, 'pv_u14-obs-ok');
    const familyId = await createFamilyFor(token, 'u14-obs-ok');
    const consent = await grantConsentFor(token, 'u14-obs-ok');
    const res = await postUnder14WithValues(token, familyId, 'obs-ok', consent.id, [
      {
        attribute: 'DISPLAY_NAME',
        value: '小树',
        source: 'GUARDIAN_OBSERVATION',
        providedByPersonId: personId,
      },
    ]);
    expect(res.statusCode).toBe(201);
  });

  it('UNDER_14 create + SELF_STATEMENT + guardian provider → 422', async () => {
    const { token, personId } = await loginWithLabel(app, 'pv_u14-self');
    const familyId = await createFamilyFor(token, 'u14-self');
    const consent = await grantConsentFor(token, 'u14-self');
    const before = await countFamilyScoped(familyId);

    const res = await postUnder14WithValues(token, familyId, 'self', consent.id, [
      {
        attribute: 'DISPLAY_NAME',
        value: '小树',
        source: 'SELF_STATEMENT',
        providedByPersonId: personId,
      },
    ]);
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');

    const after = await countFamilyScoped(familyId);
    expect(after.memberships).toBe(before.memberships);
    expect(after.profiles).toBe(before.profiles);
    expect(after.values).toBe(before.values);
    const { rows: boundRows } = await verifyPool.query(
      'SELECT bound_person_id FROM consent_records WHERE id = $1',
      [consent.id]
    );
    expect(boundRows[0].bound_person_id).toBeNull();
  });

  it('UNDER_14 create + OTHER_MEMBER_RELAY + guardian provider → 422', async () => {
    const { token, personId } = await loginWithLabel(app, 'pv_u14-other');
    const familyId = await createFamilyFor(token, 'u14-other');
    const consent = await grantConsentFor(token, 'u14-other');
    const before = await countFamilyScoped(familyId);

    const res = await postUnder14WithValues(token, familyId, 'other', consent.id, [
      {
        attribute: 'DISPLAY_NAME',
        value: '小树',
        source: 'OTHER_MEMBER_RELAY',
        providedByPersonId: personId,
      },
    ]);
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');

    const after = await countFamilyScoped(familyId);
    expect(after.memberships).toBe(before.memberships);
    expect(after.profiles).toBe(before.profiles);
    expect(after.values).toBe(before.values);
    const { rows: boundRows } = await verifyPool.query(
      'SELECT bound_person_id FROM consent_records WHERE id = $1',
      [consent.id]
    );
    expect(boundRows[0].bound_person_id).toBeNull();
  });

  it('UNDER_14 create + guardian source + fake provider → 422', async () => {
    await loginWithLabel(app, 'pv_u14-fake-unused');
    await expectUnder14Rejected(
      'fake',
      [
        {
          attribute: 'DISPLAY_NAME',
          value: '小树',
          source: 'GUARDIAN_RELAY',
          providedByPersonId: '00000000-0000-4000-8000-000000000093',
        },
      ],
      'AGE_BAND_SOURCE_NOT_ALLOWED'
    );
  });
});