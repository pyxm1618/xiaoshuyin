/**
 * T015 — Evidence Core RLS / grants (data-model.md §9–§10).
 *
 * RED before the migration: no policies/grants/RLS flags exist for the three
 * tables, and the correct-Family INSERT fixtures have nowhere to go.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const APP_URL = process.env['DATABASE_URL']!;
const MIGRATION_URL =
  process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;

const NEW_TABLES = ['assertions', 'dialogue_messages', 'observations'];

interface Fixture {
  familyA: string;
  caseA: string;
  managerA: string;
  subjectA: string;
  guardianA: string;
  familyB: string;
  caseB: string;
  managerB: string;
  accountA: string;
  accountB: string;
}

describe('Evidence RLS / grants (T015)', () => {
  let admin: pg.Client;
  let catalog: pg.Client;
  let app: pg.Pool;
  let fx: Fixture;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    catalog = new pg.Client({ connectionString: MIGRATION_URL });
    await catalog.connect();
    app = new pg.Pool({ connectionString: APP_URL, max: 4 });
    fx = await seed(admin);
  });

  afterAll(async () => {
    await cleanup(admin);
    await catalog.end();
    await app.end();
    await admin.end();
  });

  async function inAppFamily<T>(
    client: pg.PoolClient,
    familyId: string,
    personId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    await client.query('BEGIN');
    await client.query('SELECT app.set_identity_context($1, $2)', [
      fx.accountA,
      'FAMILY_MANAGEMENT',
    ]);
    await client.query('SELECT app.set_family_context($1, $2, $3)', [
      familyId,
      personId,
      'FAMILY_MANAGEMENT',
    ]);
    try {
      return await fn();
    } finally {
      await client.query('ROLLBACK').catch(() => {});
    }
  }

  function assertionInsertSql(familyId: string, caseId: string, personId: string, kind: string) {
    return {
      sql: `INSERT INTO assertions
              (family_id, case_id, subject_person_id, source_kind, source_person_id,
               occurred_time_state, occurred_at, confirmation_status, kind, content)
            VALUES ($1, $2, $3, 'SELF_STATEMENT', $3, 'UNKNOWN', NULL, 'UNCONFIRMED', $4, 'probe')`,
      params: [familyId, caseId, personId, kind],
    };
  }

  it('ENABLE + FORCE row level security on all three tables', async () => {
    const { rows } = await catalog.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity
         FROM pg_class
        WHERE relnamespace = 'public'::regnamespace
          AND relname = ANY($1::text[])
        ORDER BY relname`,
      [NEW_TABLES]
    );
    expect(rows.map((r: any) => r.relname)).toEqual(NEW_TABLES);
    for (const row of rows as any[]) {
      expect(row.relrowsecurity, `${row.relname} ENABLE`).toBe(true);
      expect(row.relforcerowsecurity, `${row.relname} FORCE`).toBe(true);
    }
  });

  it('runtime role is non-owner and NOBYPASSRLS', async () => {
    const { rows } = await catalog.query(
      `SELECT c.relname, pg_get_userbyid(c.relowner) AS owner, r.rolbypassrls
         FROM pg_class c, pg_roles r
        WHERE c.relnamespace = 'public'::regnamespace
          AND c.relname = ANY($1::text[])
          AND r.rolname = 'xiaoshuyin_app'
        ORDER BY c.relname`,
      [NEW_TABLES]
    );
    expect(rows.length).toBe(3);
    for (const row of rows as any[]) {
      expect(row.owner).toBe('xiaoshuyin_migrator');
      expect(row.rolbypassrls).toBe(false);
    }
  });

  it('policies are command-specific and never FOR ALL / DELETE', async () => {
    const { rows } = await catalog.query(
      `SELECT tablename, policyname, cmd, qual, with_check
         FROM pg_policies
        WHERE schemaname = 'public' AND tablename = ANY($1::text[])
        ORDER BY tablename, policyname`,
      [NEW_TABLES]
    );
    const byTable = new Map<string, any[]>();
    for (const row of rows as any[]) {
      byTable.set(row.tablename, [...(byTable.get(row.tablename) ?? []), row]);
    }

    expect(byTable.get('dialogue_messages')?.map((r) => r.cmd)).toEqual([
      'INSERT',
      'SELECT',
    ]);
    expect(byTable.get('assertions')?.map((r) => r.cmd)).toEqual([
      'INSERT',
      'SELECT',
      'UPDATE',
    ]);
    expect(byTable.get('observations')?.map((r) => r.cmd)).toEqual([
      'INSERT',
      'SELECT',
      'UPDATE',
    ]);
    for (const row of rows as any[]) {
      expect(row.cmd).not.toBe('ALL');
      expect(row.cmd).not.toBe('DELETE');
    }
  });

  it('grants are SELECT/INSERT only at table level, with column-level conflict_group_id UPDATE', async () => {
    const tableGrants = await catalog.query(
      `SELECT table_name, privilege_type
         FROM information_schema.role_table_grants
        WHERE grantee = 'xiaoshuyin_app' AND table_name = ANY($1::text[])
        ORDER BY table_name, privilege_type`,
      [NEW_TABLES]
    );
    const perTable = new Map<string, string[]>();
    for (const row of tableGrants.rows as any[]) {
      perTable.set(row.table_name, [...(perTable.get(row.table_name) ?? []), row.privilege_type]);
    }
    for (const table of NEW_TABLES) {
      expect(perTable.get(table), table).toEqual(['INSERT', 'SELECT']);
    }

    const columnGrants = await catalog.query(
      `SELECT table_name, column_name, privilege_type
         FROM information_schema.column_privileges
        WHERE grantee = 'xiaoshuyin_app'
          AND table_name = ANY($1::text[])
          AND privilege_type = 'UPDATE'
        ORDER BY table_name, column_name`,
      [NEW_TABLES]
    );
    expect(columnGrants.rows.map((r: any) => `${r.table_name}.${r.column_name}`)).toEqual([
      'assertions.conflict_group_id',
      'observations.conflict_group_id',
    ]);
  });

  it('without app.family_id: SELECT returns 0 and INSERT is denied', async () => {
    const client = await app.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT app.set_identity_context($1, $2)', [
        fx.accountA,
        'FAMILY_MANAGEMENT',
      ]);
      for (const table of NEW_TABLES) {
        const sel = await client.query(`SELECT count(*)::int AS c FROM ${table}`);
        expect(sel.rows[0].c, table).toBe(0);
      }
      const insert = assertionInsertSql(fx.familyA, fx.caseA, fx.managerA, 'STATEMENT');
      await expect(client.query(insert.sql, insert.params)).rejects.toThrow(
        /row-level security|42501/i
      );
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  });

  it('wrong Family context: SELECT 0 rows and write denied', async () => {
    const client = await app.connect();
    try {
      await inAppFamily(client, fx.familyA, fx.managerA, async () => {
        for (const table of NEW_TABLES) {
          const sel = await client.query(
            `SELECT count(*)::int AS c FROM ${table} WHERE family_id = $1`,
            [fx.familyB]
          );
          expect(sel.rows[0].c, table).toBe(0);
        }
        const insert = assertionInsertSql(fx.familyB, fx.caseB, fx.managerB, 'STATEMENT');
        await expect(client.query(insert.sql, insert.params)).rejects.toThrow(
          /row-level security|42501/i
        );
      });
    } finally {
      client.release();
    }
  });

  it('correct Family context allows the legal operations granted to runtime', async () => {
    const client = await app.connect();
    try {
      await inAppFamily(client, fx.familyA, fx.managerA, async () => {
        const statement = assertionInsertSql(fx.familyA, fx.caseA, fx.managerA, 'STATEMENT');
        const inserted = await client.query(
          `${statement.sql} RETURNING id, conflict_group_id`,
          statement.params
        );
        expect(inserted.rows[0].id).toBeDefined();

        const hypothesis = assertionInsertSql(fx.familyA, fx.caseA, fx.managerA, 'HYPOTHESIS');
        await expect(client.query(hypothesis.sql, hypothesis.params)).resolves.toBeDefined();

        const groupId = (await client.query('SELECT uuidv7() AS id')).rows[0].id;
        const updated = await client.query(
          'UPDATE assertions SET conflict_group_id = $1 WHERE id = $2',
          [groupId, inserted.rows[0].id]
        );
        expect(updated.rowCount).toBe(1);

        const selected = await client.query('SELECT id FROM assertions WHERE family_id = $1', [
          fx.familyA,
        ]);
        expect(selected.rows.length).toBeGreaterThanOrEqual(1);
      });
    } finally {
      client.release();
    }
  });

  it('runtime cannot DELETE any Evidence row', async () => {
    for (const table of NEW_TABLES) {
      const client = await app.connect();
      try {
        await inAppFamily(client, fx.familyA, fx.managerA, async () => {
          await expect(client.query(`DELETE FROM ${table}`)).rejects.toThrow();
        });
      } finally {
        client.release();
      }
    }
  });
});

async function seed(admin: pg.Client): Promise<Fixture> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const out: Record<string, string> = {};
  for (const key of ['A', 'B']) {
    const { rows: acc } = await admin.query(
      `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
      [`t015_${key}_${suffix}`]
    );
    out[`account${key}`] = acc[0].id;
    const { rows: person } = await admin.query(
      `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
      [acc[0].id]
    );
    out[`manager${key}`] = person[0].id;
    const { rows: fam } = await admin.query(
      `INSERT INTO families (display_name, created_by_person_id) VALUES ($1, $2) RETURNING id`,
      [`t015-${key}`, person[0].id]
    );
    out[`family${key}`] = fam[0].id;
    await admin.query(
      `INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`,
      [fam[0].id, person[0].id]
    );
    const { rows: c } = await admin.query(
      `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
       VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1) RETURNING id`,
      [fam[0].id, person[0].id]
    );
    out[`case${key}`] = c[0].id;
  }
  const { rows: subject } = await admin.query(
    `INSERT INTO persons (created_by_account_id) VALUES ($1) RETURNING id`,
    [out['accountA']]
  );
  out['subjectA'] = subject[0].id;
  await admin.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`, [
    out['familyA'],
    subject[0].id,
  ]);
  const { rows: guardian } = await admin.query(
    `INSERT INTO persons (created_by_account_id) VALUES ($1) RETURNING id`,
    [out['accountA']]
  );
  out['guardianA'] = guardian[0].id;
  await admin.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`, [
    out['familyA'],
    guardian[0].id,
  ]);
  return out as unknown as Fixture;
}

async function cleanup(admin: pg.Client) {
  try {
    await admin.query(
      `DELETE FROM assertions WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't015%')`
    );
    await admin.query(
      `DELETE FROM observations WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't015%')`
    );
    await admin.query(
      `DELETE FROM dialogue_messages WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't015%')`
    );
    await admin.query(
      `DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't015%')`
    );
    await admin.query(
      `DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't015%')`
    );
    await admin.query(`DELETE FROM families WHERE display_name LIKE 't015%'`);
    await admin.query(
      `DELETE FROM persons WHERE created_by_account_id IN (
         SELECT id FROM accounts WHERE wechat_openid LIKE 't015\\_%')`
    );
    await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE 't015\\_%'`);
  } catch {
    // best-effort cleanup
  }
}