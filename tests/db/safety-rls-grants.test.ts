/**
 * T912 — complete privilege / RLS matrix on the current main baseline plus
 * Slice 9, proving no legitimate pre-existing grant was lost.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type SafetyFixture } from '../setup/safety.js';

const PREFIX = 't912_';

async function privilege(
  admin: pg.Pool,
  kind: 'table' | 'column',
  table: string,
  privilege: string,
  column?: string
): Promise<boolean> {
  const { rows } =
    kind === 'table'
      ? await admin.query<{ has: boolean }>(
          `SELECT has_table_privilege('xiaoshuyin_app', $1, $2) AS has`,
          [table, privilege]
        )
      : await admin.query<{ has: boolean }>(
          `SELECT has_column_privilege('xiaoshuyin_app', $1, $2, $3) AS has`,
          [table, column, privilege]
        );
  return rows[0]!.has;
}

describe('T912 Safety RLS and privilege matrix', () => {
  let fixture: SafetyFixture;
  let admin: pg.Pool;
  let owner: { token: string; accountId: string; personId: string };
  let other: { token: string; accountId: string; personId: string };
  let familyId: string;
  let otherFamilyId: string;
  let caseId: string;

  beforeAll(async () => {
    const app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    fixture = createSafetyFixture({ app, admin, prefix: PREFIX });
    owner = await fixture.login('owner');
    other = await fixture.login('other');
    familyId = await fixture.createFamily(owner, 'main');
    otherFamilyId = await fixture.createFamily(other, 'other');
    caseId = (await fixture.createCase(owner)).id;
  });

  afterAll(async () => {
    await fixture.cleanup();
    await fixture.close();
    await admin.end();
    await fixture.app.close();
  });

  it('risk_events: ENABLE + FORCE RLS and exactly SELECT + INSERT', async () => {
    const { rows } = await admin.query<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
      owner: string;
    }>(
      `SELECT c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) AS owner
         FROM pg_class c WHERE c.oid = 'public.risk_events'::regclass`
    );
    expect(rows[0]).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true });
    expect(rows[0]!.owner).toBe('xiaoshuyin_migrator');

    expect(await privilege(admin, 'table', 'risk_events', 'SELECT')).toBe(true);
    expect(await privilege(admin, 'table', 'risk_events', 'INSERT')).toBe(true);
    for (const denied of ['UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      expect(await privilege(admin, 'table', 'risk_events', denied), denied).toBe(false);
    }
  });

  it('risk_events: no column-level UPDATE grant exists at all', async () => {
    const { rows } = await admin.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.column_privileges
        WHERE grantee = 'xiaoshuyin_app'
          AND table_name = 'risk_events'
          AND privilege_type = 'UPDATE'`
    );
    expect(rows).toHaveLength(0);
  });

  it('cases: table UPDATE denied, exactly the five legal columns granted', async () => {
    expect(await privilege(admin, 'table', 'cases', 'UPDATE')).toBe(false);

    const allowed = ['is_primary', 'phase', 'status', 'version', 'updated_at'];
    const denied = ['id', 'family_id', 'created_by_person_id', 'created_at'];
    for (const column of allowed) {
      expect(await privilege(admin, 'column', 'cases', 'UPDATE', column), column).toBe(true);
    }
    for (const column of denied) {
      expect(await privilege(admin, 'column', 'cases', 'UPDATE', column), column).toBe(false);
    }
  });

  it('case_events stays append-only for the runtime role', async () => {
    expect(await privilege(admin, 'table', 'case_events', 'SELECT')).toBe(true);
    expect(await privilege(admin, 'table', 'case_events', 'INSERT')).toBe(true);
    for (const denied of ['UPDATE', 'DELETE', 'TRUNCATE']) {
      expect(await privilege(admin, 'table', 'case_events', denied), denied).toBe(false);
    }
    const { rows } = await admin.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.column_privileges
        WHERE grantee = 'xiaoshuyin_app' AND table_name = 'case_events' AND privilege_type = 'UPDATE'`
    );
    expect(rows).toHaveLength(0);
  });

  it('preserves every legitimate pre-existing grant (no regression)', async () => {
    // Slice 3 column-level grants.
    expect(await privilege(admin, 'column', 'assertions', 'UPDATE', 'conflict_group_id')).toBe(true);
    expect(await privilege(admin, 'column', 'observations', 'UPDATE', 'conflict_group_id')).toBe(true);
    // Slice 4 participation table.
    expect(await privilege(admin, 'table', 'case_participants', 'UPDATE')).toBe(true);
    expect(await privilege(admin, 'table', 'case_participants', 'SELECT')).toBe(true);
    expect(await privilege(admin, 'table', 'case_participants', 'INSERT')).toBe(true);
    // Evidence carriers keep SELECT + INSERT and no DELETE.
    for (const table of ['dialogue_messages', 'assertions', 'observations']) {
      expect(await privilege(admin, 'table', table, 'SELECT'), table).toBe(true);
      expect(await privilege(admin, 'table', table, 'INSERT'), table).toBe(true);
      expect(await privilege(admin, 'table', table, 'DELETE'), table).toBe(false);
    }
  });

  it('runtime role is non-owner and NOBYPASSRLS', async () => {
    const { rows } = await admin.query<{ rolbypassrls: boolean; rolsuper: boolean; rolname: string }>(
      `SELECT rolbypassrls, rolsuper, rolname FROM pg_roles WHERE rolname IN ('xiaoshuyin_app','xiaoshuyin_migrator') ORDER BY rolname`
    );
    for (const row of rows) {
      expect(row.rolbypassrls, row.rolname).toBe(false);
      expect(row.rolsuper, row.rolname).toBe(false);
    }
  });

  it('no Family context: Risk Event invisible and write denied', async () => {
    const client = await fixture.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM risk_events'
      );
      expect(rows[0]!.count).toBe('0');
      await expect(
        client.query(
          `INSERT INTO risk_events
             (family_id, case_id, actor_account_id, event_kind, decision_case_version,
              policy_ref, policy_version, rule_ref, rule_version, risk_category_ref, evidence_refs)
           VALUES ($1,$2,$3,'HOLD_ENTERED',1,'p','1','r','1','c','[]'::jsonb)`,
          [familyId, caseId, owner.accountId]
        )
      ).rejects.toBeTruthy();
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('wrong Family context: invisible and refused', async () => {
    const client = await fixture.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT app.set_identity_context($1, $2)', [
        other.accountId,
        'FAMILY_MANAGEMENT',
      ]);
      await client.query('SELECT app.set_family_context($1, $2, $3)', [
        otherFamilyId,
        other.personId,
        'FAMILY_MANAGEMENT',
      ]);
      const { rows } = await client.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM risk_events'
      );
      expect(rows[0]!.count).toBe('0');
      await expect(
        client.query(
          `INSERT INTO risk_events
             (family_id, case_id, actor_account_id, event_kind, decision_case_version,
              policy_ref, policy_version, rule_ref, rule_version, risk_category_ref, evidence_refs)
           VALUES ($1,$2,$3,'HOLD_ENTERED',1,'p','1','r','1','c','[]'::jsonb)`,
          [familyId, caseId, owner.accountId]
        )
      ).rejects.toThrow(/row-level security/i);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('correct Family context: matching rows are permitted', async () => {
    const client = await fixture.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT app.set_identity_context($1, $2)', [
        owner.accountId,
        'FAMILY_MANAGEMENT',
      ]);
      await client.query('SELECT app.set_family_context($1, $2, $3)', [
        familyId,
        owner.personId,
        'FAMILY_MANAGEMENT',
      ]);
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO risk_events
           (family_id, case_id, actor_account_id, event_kind, decision_case_version,
            policy_ref, policy_version, rule_ref, rule_version, risk_category_ref, evidence_refs)
         VALUES ($1,$2,$3,'HOLD_ENTERED',1,'p','1','r','1','c','[]'::jsonb)
         RETURNING id`,
        [familyId, caseId, owner.accountId]
      );
      expect(rows[0]!.id).toBeTruthy();
      const visible = await client.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM risk_events WHERE case_id = $1',
        [caseId]
      );
      expect(visible.rows[0]!.count).toBe('1');
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('keeps the Family-scope policy free of role/purpose predicates', async () => {
    const { rows } = await admin.query<{ qual: string; with_check: string }>(
      `SELECT qual, with_check FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'risk_events'`
    );
    expect(rows).toHaveLength(1);
    const text = `${rows[0]!.qual} ${rows[0]!.with_check}`;
    expect(text).toContain('family_id');
    expect(text).not.toMatch(/manager|guardian|participant|purpose/i);
  });
});