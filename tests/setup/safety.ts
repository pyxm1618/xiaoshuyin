/**
 * Slice 9 test-only fixture helper.
 *
 * TEST-ONLY. This module is imported exclusively from `tests/**`. It is not
 * exported by any package entry point and cannot be imported by production
 * code (production entry points never re-export it). It constructs fixture
 * state (including a direct Case status set) purely to exercise real domain
 * commands; it is never a production bypass.
 */

import type { FastifyInstance } from 'fastify';
import pg from 'pg';

export interface ActorSession {
  token: string;
  accountId: string;
  personId: string;
}

export interface SafetyFixture {
  app: FastifyInstance;
  admin: pg.Pool;
  pool: pg.Pool;
  prefix: string;
  login(label: string): Promise<ActorSession>;
  createFamily(session: ActorSession, label: string): Promise<string>;
  createCase(session: ActorSession, label?: string): Promise<CaseSummary>;
  getCase(caseId: string): Promise<CaseSummary>;
  setCaseStatus(caseId: string, status: string): Promise<void>;
  countRiskEvents(caseId: string): Promise<number>;
  countCaseEvents(caseId: string): Promise<number>;
  countAuditEvents(resourceId: string): Promise<number>;
  cleanup(): Promise<void>;
  close(): Promise<void>;
}

export interface CaseSummary {
  id: string;
  familyId: string;
  status: string;
  phase: string;
  version: number;
  isPrimary: boolean;
}

export function createSafetyFixture(options: {
  app: FastifyInstance;
  admin: pg.Pool;
  prefix: string;
  displayLabel?: string;
}): SafetyFixture {
  const { app, admin, prefix } = options;
  const label = options.displayLabel ?? prefix;
  // Modest pool: the full suite runs 3 workers against one database, and the
  // Safety concurrency tests need at most two simultaneous commands.
  const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'], max: 3 });
  let seq = 0;

  async function login(name: string): Promise<ActorSession> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `${prefix}${name}_${Date.now()}_${seq++}` },
    });
    if (res.statusCode !== 200) {
      throw new Error(`fixture login failed: ${res.statusCode} ${res.body}`);
    }
    const body = res.json();
    return {
      token: body.sessionToken as string,
      accountId: body.accountId as string,
      personId: body.person.id as string,
    };
  }

  async function createFamily(session: ActorSession, name: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: {
        authorization: `Bearer ${session.token}`,
        'idempotency-key': `${prefix}fam-${name}-${Date.now()}-${seq++}`,
      },
      payload: {
        displayName: `${label}-${name}`,
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
      },
    });
    if (res.statusCode !== 201) {
      throw new Error(`fixture family failed: ${res.statusCode} ${res.body}`);
    }
    return res.json().id as string;
  }

  async function createCase(session: ActorSession, _name = 'case'): Promise<CaseSummary> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: {
        authorization: `Bearer ${session.token}`,
        'idempotency-key': `${prefix}case-${Date.now()}-${seq++}`,
      },
      payload: {},
    });
    if (res.statusCode !== 201) {
      throw new Error(`fixture case failed: ${res.statusCode} ${res.body}`);
    }
    return getCase(res.json().id as string);
  }

  async function getCase(caseId: string): Promise<CaseSummary> {
    const { rows } = await admin.query<{
      id: string;
      family_id: string;
      status: string;
      phase: string;
      version: number;
      is_primary: boolean;
    }>(
      `SELECT id, family_id, status, phase, version, is_primary
         FROM cases WHERE id = $1`,
      [caseId]
    );
    const row = rows[0];
    if (!row) throw new Error(`fixture case not found: ${caseId}`);
    return {
      id: row.id,
      familyId: row.family_id,
      status: row.status,
      phase: row.phase,
      version: row.version,
      isPrimary: row.is_primary,
    };
  }

  /**
   * TEST-ONLY fixture state construction. Production code must never do this:
   * only `EnterSafetyHold` / `ResolveRisk` may transition Safety state.
   */
  async function setCaseStatus(caseId: string, status: string): Promise<void> {
    await admin.query(`UPDATE cases SET status = $2, version = version + 1 WHERE id = $1`, [
      caseId,
      status,
    ]);
  }

  async function countRiskEvents(caseId: string): Promise<number> {
    const { rows } = await admin.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM risk_events WHERE case_id = $1',
      [caseId]
    );
    return Number(rows[0]!.count);
  }

  async function countCaseEvents(caseId: string): Promise<number> {
    const { rows } = await admin.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM case_events WHERE case_id = $1',
      [caseId]
    );
    return Number(rows[0]!.count);
  }

  async function countAuditEvents(resourceId: string): Promise<number> {
    const { rows } = await admin.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM business_audit_events WHERE resource_id = $1',
      [resourceId]
    );
    return Number(rows[0]!.count);
  }

  async function cleanup(): Promise<void> {
    const familyIds = `SELECT id FROM families WHERE display_name LIKE '${label}-%'`;
    try {
      await admin.query(`DELETE FROM risk_events WHERE family_id IN (${familyIds})`);
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN (${familyIds})`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN (${familyIds})`);
      await admin.query(`DELETE FROM cases WHERE family_id IN (${familyIds})`);
      await admin.query(
        `DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${prefix}%')`
      );
      await admin.query(`DELETE FROM family_members WHERE family_id IN (${familyIds})`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE '${label}-%'`);
      await admin.query(
        `DELETE FROM persons WHERE created_by_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${prefix}%')`
      );
      await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE '${prefix}%'`);
    } catch {
      // best-effort cleanup
    }
  }

  async function close(): Promise<void> {
    await pool.end();
  }

  return {
    app,
    admin,
    pool,
    prefix,
    login,
    createFamily,
    createCase,
    getCase,
    setCaseStatus,
    countRiskEvents,
    countCaseEvents,
    countAuditEvents,
    cleanup,
    close,
  };
}