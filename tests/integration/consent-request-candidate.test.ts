/**
 * F4: re-consent request subject validation happens BEFORE the onboarding row
 * is written, is scoped to the current family, and never forms an existence
 * oracle (ghost / cross-family share the same response).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  createConsentRequest,
  createFamily,
  createMember,
  grantConsent,
  loginWithLabel,
  revokeConsent,
} from '../setup/api.js';

let adminPool: pg.Pool;

async function countRequests(familyId: string) {
  const { rows } = await adminPool.query(
    'SELECT count(*)::int AS cnt FROM guardian_consent_requests WHERE family_id = $1',
    [familyId]
  );
  return rows[0].cnt as number;
}

describe('Re-consent request candidate validation (F4)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    adminPool = createAdminPool();
  });

  afterAll(async () => {
    await adminPool.end();
    await app.close();
  });

  async function setup(label: string) {
    const actor = await loginWithLabel(app, `f4_${label}`);
    const fam = await createFamily(app, actor.token, `f4_${label}`);
    expect(fam.statusCode).toBe(201);
    return { ...actor, familyId: fam.json().id as string };
  }

  async function createBoundChild(actor: { token: string; familyId: string }, label: string) {
    const req = await createConsentRequest(app, actor.token, `${label}_req`);
    expect(req.statusCode).toBe(201);
    const grant = await grantConsent(app, actor.token, `${label}_grant`, req.json().requestId);
    expect(grant.statusCode).toBe(201);

    const child = await createMember(app, actor.token, actor.familyId, label, {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: grant.json().id,
    });
    expect(child.statusCode).toBe(201);
    return {
      childPersonId: child.json().personId as string,
      consentId: grant.json().id as string,
    };
  }

  it('same-family valid child after revoke → 201', async () => {
    const actor = await setup('valid');
    const { childPersonId, consentId } = await createBoundChild(actor, 'f4_valid');

    const revoke = await revokeConsent(app, actor.token, 'f4_valid', consentId);
    expect(revoke.statusCode).toBe(200);

    const before = await countRequests(actor.familyId);
    const res = await createConsentRequest(app, actor.token, 'f4_valid_re', {
      existingSubjectPersonId: childPersonId,
    });
    expect(res.statusCode).toBe(201);
    expect(await countRequests(actor.familyId)).toBe(before + 1);
  });

  it('cross-family child → 403 and no onboarding row', async () => {
    const famA = await setup('cross_a');
    const child = await createBoundChild(famA, 'f4_cross_a');
    await revokeConsent(app, famA.token, 'f4_cross_a', child.consentId);

    const famB = await setup('cross_b');
    const before = await countRequests(famB.familyId);

    const res = await createConsentRequest(app, famB.token, 'f4_cross_b', {
      existingSubjectPersonId: child.childPersonId,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
    expect(await countRequests(famB.familyId)).toBe(before);
    expect(JSON.stringify(res.json())).not.toContain(child.childPersonId);
  });

  it('ghost UUID → 403 (not 500), no row, same shape as cross-family', async () => {
    const actor = await setup('ghost');
    const before = await countRequests(actor.familyId);

    const ghostId = '00000000-0000-4000-8000-0000000000aa';
    const res = await createConsentRequest(app, actor.token, 'f4_ghost', {
      existingSubjectPersonId: ghostId,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
    expect(await countRequests(actor.familyId)).toBe(before);
    expect(JSON.stringify(res.json())).not.toContain(ghostId);

    // Nothing but the fixed error code/message shape is observable.
    expect(Object.keys(res.json()).sort()).toEqual(['code', 'message']);
  });

  it('still-GRANTED subject → 409 GUARDIAN_CONSENT_ALREADY_GRANTED', async () => {
    const actor = await setup('stillgranted');
    const { childPersonId } = await createBoundChild(actor, 'f4_sg');

    const before = await countRequests(actor.familyId);
    const res = await createConsentRequest(app, actor.token, 'f4_sg_re', {
      existingSubjectPersonId: childPersonId,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('GUARDIAN_CONSENT_ALREADY_GRANTED');
    expect(await countRequests(actor.familyId)).toBe(before);
  });
});