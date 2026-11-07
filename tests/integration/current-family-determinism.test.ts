/**
 * Current-family determinism — Slice 2 Implement Gate G11 hotfix.
 *
 * Restores the already-frozen Slice 1 semantics
 * (contracts/authorization-and-rls.md §4.4):
 *   0 memberships                     → NONE
 *   1 membership                      → that family
 *   >1 + exactly 1 actor-owned family → that family
 *   >1 + otherwise                    → 409 CURRENT_FAMILY_AMBIGUOUS
 *
 * Selection is rule-based. These tests prove that unordered `rows[0]`,
 * insertion order, and repeated resolution cannot change the outcome.
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
  loginWithLabel,
} from '../setup/api.js';

let verifyPool: pg.Pool;

const AMBIGUOUS_FAMILY_FIELDS = ['id', 'displayName', 'createdAt', 'isManager', 'familyId'];

describe('Current Family Determinism (G11)', () => {
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

  async function createFamilyAs(token: string, label: string): Promise<string> {
    const res = await createFamily(app, token, label);
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function addMembership(personId: string, familyId: string): Promise<void> {
    await verifyPool.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [familyId, personId]
    );
  }

  async function getCurrent(token: string) {
    return app.inject({
      method: 'GET',
      url: '/api/v1/families/current',
      headers: auth(token),
    });
  }

  function expectNoFamilyFields(body: Record<string, unknown>): void {
    for (const field of AMBIGUOUS_FAMILY_FIELDS) {
      expect(body).not.toHaveProperty(field);
    }
  }

  it('0 membership → NONE (404 CURRENT_FAMILY_NOT_FOUND), no Family fields', async () => {
    const { token } = await loginWithLabel(app, 'g11_none');
    const res = await getCurrent(token);
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.code).toBe('CURRENT_FAMILY_NOT_FOUND');
    expectNoFamilyFields(body);
  });

  it('1 membership (not actor-owned) → that family, isManager=false', async () => {
    const actor = await loginWithLabel(app, 'g11_single_member');
    const owner = await loginWithLabel(app, 'g11_single_owner');
    const ownerFamily = await createFamilyAs(owner.token, 'g11-single');
    await addMembership(actor.personId, ownerFamily);

    const res = await getCurrent(actor.token);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(ownerFamily);
    expect(body.isManager).toBe(false);
  });

  it('1 membership (actor-owned) → that family, isManager=true', async () => {
    const actor = await loginWithLabel(app, 'g11_single_own');
    const familyId = await createFamilyAs(actor.token, 'g11-own');

    const res = await getCurrent(actor.token);
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(familyId);
    expect(res.json().isManager).toBe(true);
  });

  it('>1 membership + exactly one actor-owned → same owned family across 5 calls', async () => {
    const actor = await loginWithLabel(app, 'g11_multi_owned');
    const other = await loginWithLabel(app, 'g11_multi_owned_other');
    const ownedFamily = await createFamilyAs(actor.token, 'g11-owned');
    const otherFamily = await createFamilyAs(other.token, 'g11-other');
    await addMembership(actor.personId, otherFamily);

    const seen: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await getCurrent(actor.token);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(ownedFamily);
      expect(body.isManager).toBe(true);
      seen.push(body.id);
    }
    expect(new Set(seen).size).toBe(1);
    expect(seen[0]).toBe(ownedFamily);
    expect(seen).not.toContain(otherFamily);
  });

  it('>1 membership + no actor-owned family → stable 409 across 5 calls', async () => {
    const actor = await loginWithLabel(app, 'g11_multi_none');
    const b = await loginWithLabel(app, 'g11_multi_none_b');
    const c = await loginWithLabel(app, 'g11_multi_none_c');
    const familyB = await createFamilyAs(b.token, 'g11-none_b');
    const familyC = await createFamilyAs(c.token, 'g11-none_c');
    await addMembership(actor.personId, familyB);
    await addMembership(actor.personId, familyC);

    for (let i = 0; i < 5; i += 1) {
      const res = await getCurrent(actor.token);
      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.code).toBe('CURRENT_FAMILY_AMBIGUOUS');
      expectNoFamilyFields(body);
      expect(JSON.stringify(body)).not.toContain(familyB);
      expect(JSON.stringify(body)).not.toContain(familyC);
    }
  });

  it('fixture insertion order reversal does not change the owned-family result', async () => {
    const actorA = await loginWithLabel(app, 'g11_order_a');
    const otherA = await loginWithLabel(app, 'g11_order_a_other');
    const ownedA = await createFamilyAs(actorA.token, 'g11-order_a_owned');
    const otherFamilyA = await createFamilyAs(otherA.token, 'g11-order_a_other');
    await addMembership(actorA.personId, otherFamilyA);

    const actorB = await loginWithLabel(app, 'g11_order_b');
    const otherB = await loginWithLabel(app, 'g11_order_b_other');
    const otherFamilyB = await createFamilyAs(otherB.token, 'g11-order_b_other');
    await addMembership(actorB.personId, otherFamilyB);
    const ownedB = await createFamilyAs(actorB.token, 'g11-order_b_owned');

    for (let i = 0; i < 5; i += 1) {
      const resA = await getCurrent(actorA.token);
      const resB = await getCurrent(actorB.token);
      expect(resA.statusCode).toBe(200);
      expect(resB.statusCode).toBe(200);
      expect(resA.json().id).toBe(ownedA);
      expect(resB.json().id).toBe(ownedB);
    }
  });

  it('GET /consents → 409 on ambiguity (not an empty list, no family fields)', async () => {
    const actor = await loginWithLabel(app, 'g11_consents_ambiguous');
    const b = await loginWithLabel(app, 'g11_consents_ambiguous_b');
    const c = await loginWithLabel(app, 'g11_consents_ambiguous_c');
    const familyB = await createFamilyAs(b.token, 'g11-consents_b');
    const familyC = await createFamilyAs(c.token, 'g11-consents_c');
    await addMembership(actor.personId, familyB);
    await addMembership(actor.personId, familyC);

    for (let i = 0; i < 5; i += 1) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/consents',
        headers: auth(actor.token),
      });
      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.code).toBe('CURRENT_FAMILY_AMBIGUOUS');
      expect(body).not.toHaveProperty('items');
      expectNoFamilyFields(body);
    }
  });

  it('guardian consent request → 409 on ambiguity', async () => {
    const actor = await loginWithLabel(app, 'g11_gr_ambiguous');
    const b = await loginWithLabel(app, 'g11_gr_ambiguous_b');
    const c = await loginWithLabel(app, 'g11_gr_ambiguous_c');
    const familyB = await createFamilyAs(b.token, 'g11-gr_b');
    const familyC = await createFamilyAs(c.token, 'g11-gr_c');
    await addMembership(actor.personId, familyB);
    await addMembership(actor.personId, familyC);

    for (let i = 0; i < 5; i += 1) {
      const res = await createConsentRequest(app, actor.token, `g11-gr-${i}`);
      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.code).toBe('CURRENT_FAMILY_AMBIGUOUS');
      expectNoFamilyFields(body);
    }
  });

  it('guardian consent grant → 409 on ambiguity', async () => {
    const actor = await loginWithLabel(app, 'g11_ga_ambiguous');
    const b = await loginWithLabel(app, 'g11_ga_ambiguous_b');
    const c = await loginWithLabel(app, 'g11_ga_ambiguous_c');
    const familyB = await createFamilyAs(b.token, 'g11-ga_b');
    const familyC = await createFamilyAs(c.token, 'g11-ga_c');
    await addMembership(actor.personId, familyB);
    await addMembership(actor.personId, familyC);

    for (let i = 0; i < 5; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/compliance/guardian-consents',
        headers: commandHeaders(actor.token, `g11-ga-${i}`),
        payload: {
          onboardingRequestId: crypto.randomUUID(),
          accepted: true,
          noticeVersion: 'v1',
        },
      });
      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.code).toBe('CURRENT_FAMILY_AMBIGUOUS');
      expectNoFamilyFields(body);
    }
  });

  it('consent revoke → 409 on ambiguity', async () => {
    const actor = await loginWithLabel(app, 'g11_ra_ambiguous');
    const b = await loginWithLabel(app, 'g11_ra_ambiguous_b');
    const c = await loginWithLabel(app, 'g11_ra_ambiguous_c');
    const familyB = await createFamilyAs(b.token, 'g11-ra_b');
    const familyC = await createFamilyAs(c.token, 'g11-ra_c');
    await addMembership(actor.personId, familyB);
    await addMembership(actor.personId, familyC);

    for (let i = 0; i < 5; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/consents/${crypto.randomUUID()}/revoke`,
        headers: commandHeaders(actor.token, `g11-ra-${i}`),
        payload: {},
      });
      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.code).toBe('CURRENT_FAMILY_AMBIGUOUS');
      expectNoFamilyFields(body);
    }
  });

  it('GET /consents with 0 membership still returns 200 { items: [] }', async () => {
    const { token } = await loginWithLabel(app, 'g11_consents_empty');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/consents',
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [] });
  });
});