/**
 * T725 — SwitchPrimaryCase happy paths (Acceptance 1–4, FR-001/002/006/007/008).
 *
 * Frozen semantics: the switch only moves `is_primary`; `status` and `phase`
 * are never touched. `previousPrimary` is null when the Family had no current
 * primary (promotion). The response is built from committed rows.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

const PREFIX = 't725_';

describe('case primary switch happy paths (T725)', () => {
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
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T725-%')`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T725-%')`);
      await admin.query(`DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T725-%')`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T725-%')`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T725-%'`);
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
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': `t725-fam-${label}-${Date.now()}-${seq++}` },
      payload: { displayName: `T725-${label}`, creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' } },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function createCase(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': `t725-case-${label}-${Date.now()}-${seq++}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; status: string; phase: string; primary: boolean; version: number };
  }

  function switchPrimary(
    token: string,
    targetId: string,
    body: Record<string, unknown>,
    key: string | null = `t725-sw-${Date.now()}-${seq++}`
  ) {
    const headers: Record<string, string> = { authorization: `Bearer ${token}` };
    if (key !== null) headers['idempotency-key'] = key;
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${targetId}/switch-primary`,
      headers,
      payload: body,
    });
  }

  async function list(token: string) {
    return app.inject({ method: 'GET', url: '/api/v1/cases', headers: { authorization: `Bearer ${token}` } });
  }

  async function getCase(token: string, id: string) {
    return app.inject({ method: 'GET', url: `/api/v1/cases/${id}`, headers: { authorization: `Bearer ${token}` } });
  }

  it('first switch moves primary and preserves status/phase', async () => {
    const owner = await login('happy');
    const famId = await family(owner.token, 'happy');
    const a = await createCase(owner.token, 'happy-a');
    const b = await createCase(owner.token, 'happy-b');
    expect(a.primary).toBe(true);
    expect(b.primary).toBe(false);

    const res = await switchPrimary(owner.token, b.id, {
      reason: '转到新主线',
      expectedPrimaryCaseId: a.id,
      expectedPrimaryVersion: a.version,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.primary.id).toBe(b.id);
    expect(body.primary.primary).toBe(true);
    expect(body.primary.status).toBe(b.status);
    expect(body.primary.phase).toBe(b.phase);
    expect(body.previousPrimary.id).toBe(a.id);
    expect(body.previousPrimary.primary).toBe(false);
    expect(body.previousPrimary.status).toBe(a.status);
    expect(body.previousPrimary.phase).toBe(a.phase);
    expect(body.previousPrimary.version).toBe(a.version + 1);
    expect(body.primary.version).toBe(b.version + 1);
    expect(typeof body.switchedAt).toBe('string');

    // T762: exactly two domain events, one per side, with the frozen key
    // sets (plan D-9.3).
    const { rows: events } = await admin.query(
      `SELECT event_type, metadata
         FROM case_events
        WHERE family_id = $1 AND event_type <> 'CASE_CREATED'
        ORDER BY occurred_at, id`,
      [famId]
    );
    expect(events.map((row: any) => row.event_type)).toEqual([
      'CASE_PRIMARY_REVOKED',
      'CASE_PRIMARY_ASSIGNED',
    ]);
    expect(events[0].metadata).toEqual({
      primary: false,
      version: a.version + 1,
      newPrimaryCaseId: b.id,
      reason: '转到新主线',
    });
    expect(events[1].metadata).toEqual({
      primary: true,
      version: b.version + 1,
      previousPrimaryCaseId: a.id,
      reason: '转到新主线',
    });

    // H02-B: the business audit is the cross-resource record of the switch.
    // Read the real row and assert every frozen field, one row only.
    const { rows: audits } = await admin.query(
      `SELECT family_id, actor_account_id, event_type, resource_type,
              resource_id, metadata, occurred_at
         FROM business_audit_events
        WHERE family_id = $1
        ORDER BY occurred_at, id`,
      [famId]
    );
    const switchAudits = audits.filter(
      (row: any) => row.event_type === 'CASE_PRIMARY_SWITCHED'
    );
    expect(switchAudits).toHaveLength(1);
    const audit = switchAudits[0];
    expect(audit.family_id).toBe(famId);
    expect(audit.actor_account_id).toBe(owner.accountId);
    expect(audit.event_type).toBe('CASE_PRIMARY_SWITCHED');
    expect(audit.resource_type).toBe('CASE');
    expect(audit.resource_id).toBe(b.id);
    expect(audit.occurred_at).toBeInstanceOf(Date);
    // Six frozen metadata fields. Versions are the real post-UPDATE
    // `RETURNING` values, never the request's expected version.
    expect(audit.metadata).toEqual({
      targetCaseId: b.id,
      previousPrimaryCaseId: a.id,
      newPrimaryCaseId: b.id,
      previousVersion: a.version + 1,
      newVersion: b.version + 1,
      reason: '转到新主线',
    });
    expect(audit.metadata.previousVersion).not.toBe(a.version);
    expect(body.previousPrimary.version).toBe(audit.metadata.previousVersion);
    expect(body.primary.version).toBe(audit.metadata.newVersion);

    const listRes = await list(owner.token);
    const items = listRes.json().items as Array<{ id: string; primary: boolean }>;
    expect(items.filter((i) => i.primary).map((i) => i.id)).toEqual([b.id]);
  });

  it('supports a round trip and keeps both reasons in events', async () => {
    const owner = await login('roundtrip');
    await family(owner.token, 'roundtrip');
    const a = await createCase(owner.token, 'roundtrip-a');
    const b = await createCase(owner.token, 'roundtrip-b');

    const first = await switchPrimary(owner.token, b.id, {
      reason: '第一次理由',
      expectedPrimaryCaseId: a.id,
      expectedPrimaryVersion: a.version,
    });
    expect(first.statusCode).toBe(200);
    const second = await switchPrimary(owner.token, a.id, {
      reason: '第二次理由',
      expectedPrimaryCaseId: b.id,
      expectedPrimaryVersion: first.json().primary.version,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().primary.id).toBe(a.id);

    const { rows } = await admin.query(
      `SELECT event_type, metadata->>'reason' AS reason
         FROM case_events
        WHERE family_id = (SELECT id FROM families WHERE display_name = 'T725-roundtrip')
          AND event_type <> 'CASE_CREATED'
        ORDER BY occurred_at, id`
    );
    expect(rows.map((r: any) => [r.event_type, r.reason])).toEqual([
      ['CASE_PRIMARY_REVOKED', '第一次理由'],
      ['CASE_PRIMARY_ASSIGNED', '第一次理由'],
      ['CASE_PRIMARY_REVOKED', '第二次理由'],
      ['CASE_PRIMARY_ASSIGNED', '第二次理由'],
    ]);
  });

  it('promotes when there is no current primary (previousPrimary null)', async () => {
    const owner = await login('promote');
    const famId = await family(owner.token, 'promote');
    const a = await createCase(owner.token, 'promote-a');
    // Admin fixture: clear every is_primary without touching status.
    await admin.query('UPDATE cases SET is_primary = false WHERE family_id = $1', [famId]);

    const res = await switchPrimary(owner.token, a.id, {
      reason: '推进主线',
      expectedPrimaryCaseId: null,
      expectedPrimaryVersion: null,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().previousPrimary).toBeNull();
    expect(res.json().primary.id).toBe(a.id);
    expect(res.json().primary.status).toBe(a.status);
    expect(res.json().primary.phase).toBe(a.phase);

    // H01 requirement 3: the promotion branch keeps nullable old-primary
    // semantics. No fabricated previous Case, no fabricated old version.
    const { rows } = await admin.query(
      `SELECT metadata FROM business_audit_events
        WHERE family_id = $1 AND event_type = 'CASE_PRIMARY_SWITCHED'`,
      [famId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].metadata).toEqual({
      targetCaseId: a.id,
      previousPrimaryCaseId: null,
      newPrimaryCaseId: a.id,
      previousVersion: null,
      newVersion: a.version + 1,
      reason: '推进主线',
    });
    expect(res.json().primary.version).toBe(rows[0].metadata.newVersion);
  });

  it('does not expose /cases/current', async () => {
    const owner = await login('current');
    await family(owner.token, 'current');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/current',
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});