/**
 * T022 — RLS on cases / case_events (data-model.md §6, contracts §4).
 *
 * Proves: ENABLE + FORCE on both tables, runtime role is non-owner and
 * NOBYPASSRLS, default deny without app.family_id, Family isolation,
 * and that policies carry no manager / participant / purpose predicate.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Pool } from 'pg';

const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;
const APP_URL = process.env['DATABASE_URL']!;

describe('cases RLS (T022)', () => {
  let admin: Client;
  let app: Pool;
  let familyA: string;
  let familyB: string;
  let personA: string;
  let personB: string;
  let accountA: string;
  let accountB: string;
  let caseA: string;
  let caseB: string;

  beforeAll(async () => {
    admin = new Client({ connectionString: MIGRATION_URL });
    await admin.connect();
    app = new Pool({ connectionString: APP_URL, max: 4 });

    const seeded = await seedTwoFamilies(admin);
    familyA = seeded.familyA;
    familyB = seeded.familyB;
    personA = seeded.personA;
    personB = seeded.personB;
    accountA = seeded.accountA;
    accountB = seeded.accountB;
    caseA = seeded.caseA;
    caseB = seeded.caseB;
  });

  afterAll(async () => {
    await cleanup(admin);
    await admin.end();
    await app.end();
  });

  it('both tables have ENABLE + FORCE row level security', async () => {
    const { rows } = await admin.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relname IN ('cases', 'case_events')
      ORDER BY relname
    `);
    expect(rows.map((r: any) => r.relname)).toEqual(['case_events', 'cases']);
    for (const r of rows as any[]) {
      expect(r.relrowsecurity, `${r.relname} ENABLE`).toBe(true);
      expect(r.relforcerowsecurity, `${r.relname} FORCE`).toBe(true);
    }
  });

  it('runtime role is non-owner and NOBYPASSRLS', async () => {
    const { rows } = await admin.query(`
      SELECT c.relname, pg_get_userbyid(c.relowner) AS owner, rolbypassrls
      FROM pg_class c, pg_roles r
      WHERE c.relnamespace = 'public'::regnamespace
        AND c.relname IN ('cases', 'case_events')
        AND r.rolname = 'xiaoshuyin_app'
      ORDER BY c.relname
    `);
    expect(rows.length).toBe(2);
    for (const r of rows as any[]) {
      expect(r.owner).not.toBe('xiaoshuyin_app');
      expect(r.rolbypassrls).toBe(false);
    }
  });

  it('without app.family_id: SELECT returns 0 rows and INSERT is denied', async () => {
    const client = await app.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT app.set_identity_context($1, $2)', [accountA, 'FAMILY_MANAGEMENT']);
      const sel = await client.query('SELECT count(*)::int AS c FROM cases');
      expect(sel.rows[0].c).toBe(0);
      const evSel = await client.query('SELECT count(*)::int AS c FROM case_events');
      expect(evSel.rows[0].c).toBe(0);

      await expect(client.query(
        `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
         VALUES ($1, $2, 'OPEN', 'INTAKE', false, 1)`,
        [familyA, personA]
      )).rejects.toThrow(/row-level security|42501/i);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('Family A context sees only Family A cases', async () => {
    const client = await app.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT app.set_identity_context($1, $2)', [accountA, 'FAMILY_MANAGEMENT']);
      await client.query('SELECT app.set_family_context($1, $2, $3)', [familyA, personA, 'FAMILY_MANAGEMENT']);
      const { rows } = await client.query('SELECT id FROM cases ORDER BY id');
      expect(rows.map((r: any) => r.id)).toEqual([caseA]);
      const evs = await client.query('SELECT case_id FROM case_events');
      expect(evs.rows.every((r: any) => r.case_id === caseA)).toBe(true);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('Family A context cannot read or write Family B rows', async () => {
    const client = await app.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT app.set_identity_context($1, $2)', [accountA, 'FAMILY_MANAGEMENT']);
      await client.query('SELECT app.set_family_context($1, $2, $3)', [familyA, personA, 'FAMILY_MANAGEMENT']);

      const sel = await client.query('SELECT id FROM cases WHERE id = $1', [caseB]);
      expect(sel.rows).toEqual([]);

      await expect(client.query(
        `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
         VALUES ($1, $2, 'OPEN', 'INTAKE', false, 1)`,
        [familyB, personA]
      )).rejects.toThrow(/row-level security|42501/i);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('policies are Family-scope only (no manager / participant / purpose predicate)', async () => {
    const { rows } = await admin.query(`
      SELECT policyname, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename IN ('cases', 'case_events')
      ORDER BY policyname
    `);
    expect(rows.map((r: any) => r.policyname)).toEqual([
      'case_events_family_scope', 'cases_family_scope',
    ]);
    for (const r of rows as any[]) {
      const text = `${r.qual ?? ''} ${r.with_check ?? ''}`.toLowerCase();
      expect(text).toMatch(/family_id\s*=\s*app_family_id\(\)/);
      expect(text).not.toMatch(/manager|guardian|participant|purpose|created_by/);
    }
  });

  it('runtime role cannot UPDATE cases or DELETE case_events', async () => {
    // Each attempt runs in its own transaction: a privilege error aborts the
    // transaction, so they cannot share one.
    for (const statement of [
      "UPDATE cases SET version = 2 WHERE id = '" + caseA + "'",
      "DELETE FROM case_events WHERE case_id = '" + caseA + "'",
    ]) {
      const client = await app.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT app.set_identity_context($1, $2)', [accountA, 'FAMILY_MANAGEMENT']);
        await client.query('SELECT app.set_family_context($1, $2, $3)', [familyA, personA, 'FAMILY_MANAGEMENT']);
        await expect(client.query(statement)).rejects.toThrow();
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    }
  });

  it('case_events keeps append-only posture for the runtime role', async () => {
    const { rows } = await admin.query(`
      SELECT privilege_type FROM information_schema.role_table_grants
      WHERE grantee = 'xiaoshuyin_app' AND table_name IN ('cases', 'case_events')
      ORDER BY privilege_type
    `);
    const privs = [...new Set(rows.map((r: any) => r.privilege_type))].sort();
    expect(privs).toEqual(['INSERT', 'SELECT']);
  });
});

// ── fixtures ────────────────────────────────────────────────

export async function seedTwoFamilies(admin: Client) {
  await admin.query("BEGIN");
  const out: any = {};
  for (const key of ['A', 'B']) {
    const { rows: acc } = await admin.query(
      "INSERT INTO accounts (wechat_openid) VALUES ('t022_' || uuidv7()) RETURNING id"
    );
    const accountId = acc[0].id;
    await admin.query('SELECT app.set_account_context($1, $2)', [accountId, 'FAMILY_MANAGEMENT']);
    const { rows: per } = await admin.query(
      'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
      [accountId]
    );
    const personId = per[0].id;
    const familyId = (await admin.query('SELECT uuidv7() AS id')).rows[0].id;
    await admin.query('SELECT app.create_family($1, $2, $3)', [familyId, personId, `T022-${key}`]);
    await admin.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [familyId, personId]
    );
    out[`account${key}`] = accountId;
    out[`family${key}`] = familyId;
    out[`person${key}`] = personId;
  }

  // Case per family (owner context already points at the last family; reset per insert)
  for (const key of ['A', 'B']) {
    const familyId = out[`family${key}`];
    const personId = out[`person${key}`];
    await admin.query('SELECT app.set_family_context($1, $2, $3)', [familyId, personId, 'FAMILY_MANAGEMENT']);
    const { rows } = await admin.query(
      `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
       VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1) RETURNING id`,
      [familyId, personId]
    );
    const caseId = rows[0].id;
    await admin.query(
      `INSERT INTO case_events (family_id, case_id, actor_account_id, event_type, metadata)
       VALUES ($1, $2, $3, 'CASE_CREATED', '{"primary": true, "version": 1}'::jsonb)`,
      [familyId, caseId, out[`account${key}`]]
    );
    out[`case${key}`] = caseId;
  }

  await admin.query('COMMIT');
  return out;
}

export async function cleanup(admin: Client) {
  try {
    await admin.query('ROLLBACK');
    await admin.query(`
      DELETE FROM case_events WHERE case_id IN (SELECT id FROM cases WHERE created_by_person_id IN (
        SELECT id FROM persons WHERE account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE 't022_%')
      ))
    `);
    await admin.query(`
      DELETE FROM cases WHERE created_by_person_id IN (
        SELECT id FROM persons WHERE account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE 't022_%')
      )
    `);
    await admin.query(`
      DELETE FROM family_members WHERE person_id IN (
        SELECT id FROM persons WHERE account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE 't022_%')
      )
    `);
    await admin.query(`
      DELETE FROM families WHERE created_by_person_id IN (
        SELECT id FROM persons WHERE account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE 't022_%')
      )
    `);
    await admin.query(`
      DELETE FROM persons WHERE account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE 't022_%')
    `);
    await admin.query("DELETE FROM accounts WHERE wechat_openid LIKE 't022_%'");
  } catch {
    // best-effort cleanup; the suite's assertions already ran
  }
}
