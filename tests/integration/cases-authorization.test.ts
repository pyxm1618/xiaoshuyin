/**
 * T050 / T060 / T061 — Case authorization scenarios.
 *
 * Scenario A: actor is a legal Family member + guardian, but NOT the Family
 * creator (management subject): create/list → 403 CASE_ACCESS_DENIED,
 * detail → 404 CASE_NOT_FOUND, no Case data in any response.
 *
 * Scenario B: actor has a guardian relationship but is not a member of the
 * target Family and has no Family of their own: the current Family is not
 * resolved, so Slice 1 Family semantics apply (CURRENT_FAMILY_NOT_FOUND) and
 * no Case-level 403 / 404 is produced.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

let verifyPool: pg.Pool;

describe('Case authorization (T050)', () => {
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
      payload: { code: `t050_${label}_${Date.now()}_${seq++}` },
    });
    expect([200, 201]).toContain(res.statusCode);
    const body = res.json();
    return { token: body.token as string, personId: body.person.id as string };
  }

  async function createFamily(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: `T050-${label}`,
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        idempotencyKey: `t050-fam-${label}-${Date.now()}-${seq++}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function joinFamily(familyId: string, personId: string) {
    await verifyPool.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [familyId, personId]
    );
  }

  async function grantGuardianship(familyId: string, guardianPersonId: string) {
    // A child Person in the Family whose guardian is the actor.
    const childId = (await verifyPool.query(
      `INSERT INTO persons (account_id, created_by_account_id)
       VALUES (NULL, (SELECT account_id FROM persons WHERE id = $1)) RETURNING id`,
      [guardianPersonId]
    )).rows[0].id;
    await verifyPool.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [familyId, childId]
    );
    await verifyPool.query(
      `INSERT INTO person_compliance_profiles
         (person_id, age_band, minor_mode, verified_source, guardian_person_id)
       VALUES ($1, 'MINOR_14_17', true, 'GUARDIAN_OBSERVATION', $2)`,
      [childId, guardianPersonId]
    );
    return childId;
  }

  function createCase(token: string) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}` },
      payload: { idempotencyKey: `t050-case-${Date.now()}-${seq++}` },
    });
  }

  function listCases(token: string) {
    return app.inject({
      method: 'GET',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}` },
    });
  }

  function getCase(token: string, id: string) {
    return app.inject({
      method: 'GET',
      url: `/api/v1/cases/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
  }

  describe('manager allow', () => {
    it('the Family creator can create, list and read', async () => {
      const manager = await login('manager');
      await createFamily(manager.token, 'manager');

      const created = await createCase(manager.token);
      expect(created.statusCode).toBe(201);
      const caseId = created.json().id;
      expect(created.json().primary).toBe(true);

      const list = await listCases(manager.token);
      expect(list.statusCode).toBe(200);
      expect(list.json().items.map((c: any) => c.id)).toEqual([caseId]);

      const detail = await getCase(manager.token, caseId);
      expect(detail.statusCode).toBe(200);
      expect(detail.json().id).toBe(caseId);
    });
  });

  describe('场景 A — guardian + Family 成员 + 非 manager', () => {
    let memberToken: string;
    let managerToken: string;
    let existingCaseId: string;

    beforeAll(async () => {
      const manager = await login('a-manager');
      const familyId = await createFamily(manager.token, 'scenario-a');
      managerToken = manager.token;

      const created = await createCase(manager.token);
      existingCaseId = created.json().id;

      const member = await login('a-member');
      await joinFamily(familyId, member.personId);
      await grantGuardianship(familyId, member.personId);
      memberToken = member.token;
    });

    it('POST /cases → 403 CASE_ACCESS_DENIED with zero writes', async () => {
      const before = await verifyPool.query('SELECT count(*)::int AS c FROM cases');
      const res = await createCase(memberToken);
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ code: 'CASE_ACCESS_DENIED', message: 'CASE_ACCESS_DENIED' });
      const after = await verifyPool.query('SELECT count(*)::int AS c FROM cases');
      expect(after.rows[0].c).toBe(before.rows[0].c);
    });

    it('GET /cases → 403 CASE_ACCESS_DENIED with no Case data', async () => {
      const res = await listCases(memberToken);
      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body).toEqual({ code: 'CASE_ACCESS_DENIED', message: 'CASE_ACCESS_DENIED' });
      expect(JSON.stringify(body)).not.toContain(existingCaseId);
    });

    it('GET /cases/:id → 404 CASE_NOT_FOUND (same body as a missing id)', async () => {
      const denied = await getCase(memberToken, existingCaseId);
      const missing = await getCase(memberToken, '00000000-0000-7000-8000-000000000000');

      expect(denied.statusCode).toBe(404);
      expect(missing.statusCode).toBe(404);
      expect(denied.json()).toEqual({ code: 'CASE_NOT_FOUND', message: 'Case not found' });
      expect(missing.json()).toEqual(denied.json());
      expect(JSON.stringify(denied.json())).not.toContain(existingCaseId);
    });

    it('manager still sees the Case after the denied attempts', async () => {
      const res = await listCases(managerToken);
      expect(res.statusCode).toBe(200);
      expect(res.json().items.map((c: any) => c.id)).toEqual([existingCaseId]);
    });
  });

  describe('A07 — 普通 Family member（非 guardian、非 manager）', () => {
    it('create/list 403 and detail 404 without Case data', async () => {
      const manager = await login('a07-manager');
      const familyId = await createFamily(manager.token, 'a07');
      const created = await createCase(manager.token);
      const caseId = created.json().id as string;

      const member = await login('a07-member');
      // Plain membership only: no guardian relationship, not the creator.
      await joinFamily(familyId, member.personId);

      const post = await createCase(member.token);
      expect(post.statusCode).toBe(403);
      expect(post.json().code).toBe('CASE_ACCESS_DENIED');

      const list = await listCases(member.token);
      expect(list.statusCode).toBe(403);
      expect(list.json().code).toBe('CASE_ACCESS_DENIED');
      expect(JSON.stringify(list.json())).not.toContain(caseId);

      const detail = await getCase(member.token, caseId);
      expect(detail.statusCode).toBe(404);
      expect(detail.json()).toEqual({ code: 'CASE_NOT_FOUND', message: 'Case not found' });
      expect(JSON.stringify(detail.json())).not.toContain(caseId);

      // The ordinary member is a legal Family member: the Family resolves, so
      // this is the Case-level 403/404 branch, not CURRENT_FAMILY_NOT_FOUND.
      expect(post.json().code).not.toBe('CURRENT_FAMILY_NOT_FOUND');
    });
  });

  describe('场景 B — guardian 但不是目标 Family 成员', () => {
    it('current Family is unresolved → Slice 1 semantics, no Case error codes', async () => {
      // A Family owned by someone else, where the actor is only a guardian.
      const owner = await login('b-owner');
      const familyId = await createFamily(owner.token, 'scenario-b');
      await createCase(owner.token);

      const guardian = await login('b-guardian');
      await grantGuardianship(familyId, guardian.personId);

      const post = await createCase(guardian.token);
      expect(post.statusCode).toBe(404);
      expect(post.json().code).toBe('CURRENT_FAMILY_NOT_FOUND');

      const list = await listCases(guardian.token);
      expect(list.statusCode).toBe(404);
      expect(list.json().code).toBe('CURRENT_FAMILY_NOT_FOUND');

      const detail = await getCase(guardian.token, '00000000-0000-7000-8000-000000000000');
      expect(detail.statusCode).toBe(404);
      expect(detail.json().code).toBe('CURRENT_FAMILY_NOT_FOUND');

      for (const body of [post.json(), list.json(), detail.json()]) {
        expect(body.code).not.toBe('CASE_ACCESS_DENIED');
        expect(body.code).not.toBe('CASE_NOT_FOUND');
        expect(Object.keys(body).sort()).toEqual(['code', 'message']);
      }
    });
  });
});
