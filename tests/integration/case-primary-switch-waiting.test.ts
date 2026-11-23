/**
 * Workline B / Finding #6 — SwitchPrimary must follow the domain switch
 * contract, not the ordinary-progression guard.
 *
 * Frozen contract (`decideSwitchPrimary`):
 *   - CLOSED target          -> DENY CASE_CLOSED
 *   - SAFETY_HOLD target or  -> DENY SAFETY_HOLD_BLOCKED
 *     SAFETY_HOLD current
 *   - WAITING target         -> ALLOW
 *
 * Becoming primary never rewrites `status` or `phase`; a WAITING Case stays
 * WAITING. The ordinary progression guard (`assertOrdinaryProgressionAllowedRaw`)
 * is not a SwitchPrimary precondition and must not be reintroduced.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

const PREFIX = 'f6switch_';

describe('Finding #6 SwitchPrimary status semantics', () => {
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
      await admin.query(
        `DELETE FROM business_audit_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'F6-%')`
      );
      await admin.query(
        `DELETE FROM case_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'F6-%')`
      );
      await admin.query(
        `DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'F6-%')`
      );
      await admin.query(
        `DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`
      );
      await admin.query(
        `DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'F6-%')`
      );
      await admin.query(
        `DELETE FROM families WHERE display_name LIKE 'F6-%'`
      );
      await admin.query(
        `DELETE FROM persons WHERE created_by_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`
      );
      await admin.query(
        `DELETE FROM accounts WHERE wechat_openid LIKE '${PREFIX}%'`
      );
    } catch {
      // best-effort cleanup
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
    const body = res.json();
    return {
      token: body.sessionToken as string,
      personId: body.person.id as string,
      accountId: body.accountId as string,
    };
  }

  async function createFamily(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `f6-fam-${label}-${Date.now()}-${seq++}`,
      },
      payload: {
        displayName: `F6-${label}`,
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function createCase(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `f6-case-${label}-${Date.now()}-${seq++}`,
      },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    return res.json() as {
      id: string;
      status: string;
      phase: string;
      primary: boolean;
      version: number;
    };
  }

  async function readCase(token: string, id: string) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode, res.body).toBe(200);
    return res.json() as {
      id: string;
      status: string;
      phase: string;
      primary: boolean;
      version: number;
    };
  }

  function switchPrimary(
    token: string,
    targetId: string,
    body: Record<string, unknown>
  ) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${targetId}/switch-primary`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `f6-sw-${Date.now()}-${seq++}`,
      },
      payload: body,
    });
  }

  async function setStatus(caseId: string, status: string) {
    await admin.query(
      `UPDATE cases SET status=$2::case_status WHERE id=$1`,
      [caseId, status]
    );
  }

  it('promotes a WAITING Case to primary without touching status or phase', async () => {
    const owner = await login('waiting');
    await createFamily(owner.token, 'waiting');
    const current = await createCase(owner.token, 'waiting-a');
    const target = await createCase(owner.token, 'waiting-b');

    await setStatus(target.id, 'WAITING');
    const waitingBefore = await readCase(owner.token, target.id);
    expect(waitingBefore.status).toBe('WAITING');
    const currentBefore = await readCase(owner.token, current.id);

    const res = await switchPrimary(owner.token, target.id, {
      reason: '等待中的主线也可以成为 Primary',
      expectedPrimaryCaseId: currentBefore.id,
      expectedPrimaryVersion: currentBefore.version,
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.primary.id).toBe(target.id);
    expect(body.primary.primary).toBe(true);

    // Finding #6: becoming primary is not a lifecycle transition.
    const after = await readCase(owner.token, target.id);
    expect(after.primary).toBe(true);
    expect(after.status).toBe('WAITING');
    expect(after.phase).toBe(waitingBefore.phase);

    // No CASE_PAUSED/status event is emitted by a switch.
    const { rows: statusEvents } = await admin.query(
      `SELECT count(*)::int AS n
         FROM case_events
        WHERE case_id=$1 AND event_type NOT IN ('CASE_CREATED','CASE_PRIMARY_REVOKED','CASE_PRIMARY_ASSIGNED')`,
      [target.id]
    );
    expect(statusEvents[0]!.n).toBe(0);
  });

  it('still denies SAFETY_HOLD and CLOSED targets', async () => {
    const owner = await login('denied');
    await createFamily(owner.token, 'denied');
    const current = await createCase(owner.token, 'denied-a');
    const holdTarget = await createCase(owner.token, 'denied-hold');
    const closedTarget = await createCase(owner.token, 'denied-closed');

    await setStatus(holdTarget.id, 'SAFETY_HOLD');
    await setStatus(closedTarget.id, 'CLOSED');
    const currentBefore = await readCase(owner.token, current.id);

    const hold = await switchPrimary(owner.token, holdTarget.id, {
      reason: '安全暂停不可成为 Primary',
      expectedPrimaryCaseId: currentBefore.id,
      expectedPrimaryVersion: currentBefore.version,
    });
    expect(hold.statusCode, hold.body).toBe(409);
    expect(hold.json().code).toBe('SAFETY_HOLD_BLOCKED');

    const closed = await switchPrimary(owner.token, closedTarget.id, {
      reason: '已关闭的 Case 不可成为 Primary',
      expectedPrimaryCaseId: currentBefore.id,
      expectedPrimaryVersion: currentBefore.version,
    });
    expect(closed.statusCode, closed.body).toBe(409);
    expect(closed.json().code).toBe('CASE_CLOSED');

    // The denied attempts leave the existing primary truth untouched.
    const currentAfter = await readCase(owner.token, current.id);
    expect(currentAfter.primary).toBe(true);
    expect(currentAfter.version).toBe(currentBefore.version);
  });
});
