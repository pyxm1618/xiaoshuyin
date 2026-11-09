/**
 * T016 — FACT capability hard guard.
 *
 * FACT must remain structurally expressible, while the runtime app role can
 * never INSERT kind='FACT': no second permissive INSERT policy may OR-open it.
 *
 * RED before the migration: the assertions policy/table do not exist.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const APP_URL = process.env['DATABASE_URL']!;

interface Fixture {
  familyId: string;
  caseId: string;
  managerPersonId: string;
  accountId: string;
}

describe('FACT hard guard (T016)', () => {
  let admin: pg.Client;
  let app: pg.Pool;
  let fx: Fixture;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    app = new pg.Pool({ connectionString: APP_URL, max: 4 });
    fx = await seed(admin);
  });

  afterAll(async () => {
    await cleanup(admin);
    await app.end();
    await admin.end();
  });

  function insertSql(kind: string) {
    return {
      sql: `INSERT INTO assertions
              (family_id, case_id, subject_person_id, source_kind, source_person_id,
               occurred_time_state, occurred_at, confirmation_status, kind, content)
            VALUES ($1, $2, $3, 'SELF_STATEMENT', $3, 'UNKNOWN', NULL, 'UNCONFIRMED', $4, 'fact guard probe')`,
      params: [fx.familyId, fx.caseId, fx.managerPersonId, kind],
    };
  }

  it('the only INSERT-capable assertions policy is family-scoped AND kind <> FACT', async () => {
    const { rows } = await admin.query(
      `SELECT policyname, cmd, with_check
         FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'assertions'
          AND (cmd = 'INSERT' OR cmd = 'ALL')
        ORDER BY policyname`
    );
    expect(rows.map((r: any) => r.policyname)).toEqual(['assertions_insert']);
    const policy = rows[0];
    expect(policy.cmd).toBe('INSERT');
    expect(policy.with_check).toMatch(/family_id\s*=\s*app_family_id\(\)/);
    expect(policy.with_check).toMatch(/kind\s*<>\s*'FACT'/);
  });

  it('runtime app role with the correct Family context cannot INSERT FACT', async () => {
    const client = await app.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT app.set_identity_context($1, $2)', [
        fx.accountId,
        'FAMILY_MANAGEMENT',
      ]);
      await client.query('SELECT app.set_family_context($1, $2, $3)', [
        fx.familyId,
        fx.managerPersonId,
        'FAMILY_MANAGEMENT',
      ]);
      const fact = insertSql('FACT');
      await expect(client.query(fact.sql, fact.params)).rejects.toThrow(
        /row-level security|42501/i
      );
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  });

  it('runtime app role can still INSERT otherwise-valid STATEMENT / HYPOTHESIS', async () => {
    for (const kind of ['STATEMENT', 'HYPOTHESIS']) {
      const client = await app.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT app.set_identity_context($1, $2)', [
          fx.accountId,
          'FAMILY_MANAGEMENT',
        ]);
        await client.query('SELECT app.set_family_context($1, $2, $3)', [
          fx.familyId,
          fx.managerPersonId,
          'FAMILY_MANAGEMENT',
        ]);
        const stmt = insertSql(kind);
        await expect(client.query(stmt.sql, stmt.params), kind).resolves.toBeDefined();
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    }
  });

  it('FACT stays expressible through an isolated privileged fixture only', async () => {
    const stmt = insertSql('FACT');
    const inserted = await admin.query(`${stmt.sql} RETURNING id, kind`, stmt.params);
    expect(inserted.rows[0].kind).toBe('FACT');
    await admin.query('DELETE FROM assertions WHERE id = $1', [inserted.rows[0].id]);
  });
});

async function seed(admin: pg.Client): Promise<Fixture> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const { rows: acc } = await admin.query(
    `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
    [`t016_${suffix}`]
  );
  const accountId = acc[0].id;
  const { rows: person } = await admin.query(
    `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
    [accountId]
  );
  const managerPersonId = person[0].id;
  const { rows: fam } = await admin.query(
    `INSERT INTO families (display_name, created_by_person_id) VALUES ('t016', $1) RETURNING id`,
    [managerPersonId]
  );
  const familyId = fam[0].id;
  await admin.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`, [
    familyId,
    managerPersonId,
  ]);
  const { rows: c } = await admin.query(
    `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
     VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1) RETURNING id`,
    [familyId, managerPersonId]
  );
  return { familyId, caseId: c[0].id, managerPersonId, accountId };
}

async function cleanup(admin: pg.Client) {
  try {
    await admin.query(
      `DELETE FROM assertions WHERE family_id IN (SELECT id FROM families WHERE display_name = 't016')`
    );
    await admin.query(
      `DELETE FROM observations WHERE family_id IN (SELECT id FROM families WHERE display_name = 't016')`
    );
    await admin.query(
      `DELETE FROM dialogue_messages WHERE family_id IN (SELECT id FROM families WHERE display_name = 't016')`
    );
    await admin.query(
      `DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name = 't016')`
    );
    await admin.query(
      `DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name = 't016')`
    );
    await admin.query(`DELETE FROM families WHERE display_name = 't016'`);
    await admin.query(
      `DELETE FROM persons WHERE created_by_account_id IN (
         SELECT id FROM accounts WHERE wechat_openid LIKE 't016\\_%')`
    );
    await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE 't016\\_%'`);
  } catch {
    // best-effort cleanup
  }
}