/**
 * T727 — SwitchPrimaryCase anti-enumeration authorization (FR-003, Acceptance 5–7).
 *
 * A non-manager member, a cross-family actor and a missing target must all
 * receive the byte-identical 404 body used by GET /api/v1/cases/:id. A guardian
 * who is not a Family member never reaches the Case layer: the Frozen Family
 * resolution error (CURRENT_FAMILY_NOT_FOUND) is preserved.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

const PREFIX = 't727_';

describe('case primary switch authorization (T727)', () => {
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
      const fams = `SELECT id FROM families WHERE display_name LIKE 'T727-%'`;
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN (${fams})`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN (${fams})`);
      await admin.query(`DELETE FROM cases WHERE family_id IN (${fams})`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN (${fams})`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T727-%'`);
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
    return { token: b.sessionToken as string, personId: b.person.id as string, accountId: b.accountId as string };
  }

  async function family(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': `t727-fam-${label}-${Date.now()}-${seq++}` },
      payload: { displayName: `T727-${label}`, creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' } },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function createCase(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': `t727-case-${label}-${Date.now()}-${seq++}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number };
  }

  function switchPrimary(token: string, targetId: string, body: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${targetId}/switch-primary`,
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': `t727-sw-${Date.now()}-${seq++}` },
      payload: body,
    });
  }

  async function getCase(token: string, id: string) {
    return app.inject({ method: 'GET', url: `/api/v1/cases/${id}`, headers: { authorization: `Bearer ${token}` } });
  }

  it('a plain member gets the byte-identical CASE_NOT_FOUND body', async () => {
    const owner = await login('member-owner');
    const famId = await family(owner.token, 'member');
    const a = await createCase(owner.token, 'member-a');
    const b = await createCase(owner.token, 'member-b');

    const member = await login('member-plain');
    await admin.query('INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)', [
      famId,
      member.personId,
    ]);

    const detail = await getCase(member.token, b.id);
    expect(detail.statusCode).toBe(404);
    const denied = await switchPrimary(member.token, b.id, {
      reason: 'x',
      expectedPrimaryCaseId: a.id,
      expectedPrimaryVersion: a.version,
    });
    expect(denied.statusCode).toBe(404);
    expect(denied.body).toBe(detail.body);
    expect(JSON.stringify(denied.json())).not.toContain('NOT_FAMILY_MANAGER');
    expect(denied.json()).not.toHaveProperty('status');
    expect(denied.json()).not.toHaveProperty('phase');
    expect(denied.json()).not.toHaveProperty('primary');
    expect(denied.json()).not.toHaveProperty('version');
  });

  it('a cross-family actor gets 404 and sees zero rows in the victim Family', async () => {
    const owner = await login('cross-owner');
    await family(owner.token, 'cross');
    const a = await createCase(owner.token, 'cross-a');

    const other = await login('cross-other');
    await family(other.token, 'cross-other');
    const foreign = await createCase(other.token, 'cross-foreign');

    const res = await switchPrimary(owner.token, foreign.id, {
      reason: 'x',
      expectedPrimaryCaseId: a.id,
      expectedPrimaryVersion: a.version,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('CASE_NOT_FOUND');

    const { rows } = await admin.query(
      `SELECT count(*)::int c FROM cases WHERE id = $1 AND family_id = (SELECT id FROM families WHERE display_name = 'T727-cross')`,
      [foreign.id]
    );
    expect(rows[0].c).toBe(0);
  });

  it('a guardian who is not a member never reaches the Case layer', async () => {
    // No Family of their own and no membership in the target Family: the
    // Slice 1 current-Family resolution fails before the Case layer.
    const guardian = await login('guardian');

    const owner = await login('guardian-target');
    await family(owner.token, 'guardian-target');
    const a = await createCase(owner.token, 'guardian-a');

    const res = await switchPrimary(guardian.token, a.id, {
      reason: 'x',
      expectedPrimaryCaseId: null,
      expectedPrimaryVersion: null,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('CURRENT_FAMILY_NOT_FOUND');
    expect(JSON.stringify(res.json())).not.toContain('NOT_FAMILY_MANAGER');
  });
});