/**
 * T723 — SwitchPrimaryCase RLS behaviour (plan D-9.6 / FR-016).
 *
 * RLS is the second line of defence and must already cover UPDATE:
 *   - no app.family_id: SELECT 0 rows, UPDATE ... RETURNING 0 rows, INSERT denied
 *   - wrong Family context: same
 *   - correct Family context: UPDATE ... RETURNING exactly 1 row
 *   - case_events remains INSERT/SELECT only (no UPDATE/DELETE)
 *
 * No new policy is expected; the migration only grants the three writable
 * columns on `cases`.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Pool } from 'pg';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const APP_URL = process.env['DATABASE_URL']!;
const PREFIX = 't723_';

describe('case primary switch RLS (T723)', () => {
  let admin: Client;
  let app: Pool;
  let accountA: string;
  let accountB: string;
  let personA: string;
  let personB: string;
  let familyA: string;
  let familyB: string;
  let caseA: string;

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    app = new Pool({ connectionString: APP_URL, max: 4 });

    accountA = (
      await admin.query('INSERT INTO accounts (wechat_openid) VALUES ($1 || uuidv7()) RETURNING id', [
        PREFIX + 'a_',
      ])
    ).rows[0].id;
    accountB = (
      await admin.query('INSERT INTO accounts (wechat_openid) VALUES ($1 || uuidv7()) RETURNING id', [
        PREFIX + 'b_',
      ])
    ).rows[0].id;
    personA = (
      await admin.query(
        'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
        [accountA]
      )
    ).rows[0].id;
    personB = (
      await admin.query(
        'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
        [accountB]
      )
    ).rows[0].id;
    familyA = (await admin.query('SELECT uuidv7() AS id')).rows[0].id;
    familyB = (await admin.query('SELECT uuidv7() AS id')).rows[0].id;
    await admin.query('SELECT app.create_family($1, $2, $3)', [familyA, personA, 'T723-A']);
    await admin.query('SELECT app.create_family($1, $2, $3)', [familyB, personB, 'T723-B']);
    await admin.query('INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)', [
      familyA,
      personA,
    ]);
    await admin.query('INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)', [
      familyB,
      personB,
    ]);
    caseA = (
      await admin.query(
        `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
         VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1) RETURNING id`,
        [familyA, personA]
      )
    ).rows[0].id;
  });

  afterAll(async () => {
    try {
      await admin.query('DELETE FROM case_events WHERE family_id = ANY($1)', [[familyA, familyB]]);
      await admin.query('DELETE FROM cases WHERE family_id = ANY($1)', [[familyA, familyB]]);
      await admin.query('DELETE FROM family_members WHERE family_id = ANY($1)', [[familyA, familyB]]);
      await admin.query('DELETE FROM families WHERE id = ANY($1)', [[familyA, familyB]]);
      await admin.query('DELETE FROM persons WHERE account_id = ANY($1)', [[accountA, accountB]]);
      await admin.query('DELETE FROM accounts WHERE id = ANY($1)', [[accountA, accountB]]);
    } catch {
      // best-effort cleanup
    }
    await admin.end();
    await app.end();
  });

  async function withContext(
    accountId: string,
    personId: string,
    familyId: string | null,
    fn: (client: any) => Promise<void>
  ) {
    const client = await app.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT app.set_identity_context($1, $2)', [accountId, 'FAMILY_MANAGEMENT']);
      if (familyId) {
        await client.query('SELECT app.set_family_context($1, $2, $3)', [
          familyId,
          personId,
          'FAMILY_MANAGEMENT',
        ]);
      }
      await fn(client);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }

  it('without a Family context: SELECT 0, UPDATE 0, INSERT denied', async () => {
    await withContext(accountA, personA, null, async (client) => {
      const sel = await client.query('SELECT count(*)::int c FROM cases');
      expect(sel.rows[0].c).toBe(0);
      const upd = await client.query(
        `UPDATE cases SET is_primary = false, version = version + 1 WHERE id = $1 RETURNING id`,
        [caseA]
      );
      expect(upd.rows.length).toBe(0);
      await expect(
        client.query(
          `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
           VALUES ($1, $2, 'OPEN', 'INTAKE', false, 1)`,
          [familyA, personA]
        )
      ).rejects.toThrow();
    });
  });

  it('wrong Family context: SELECT 0 and UPDATE 0', async () => {
    await withContext(accountB, personB, familyB, async (client) => {
      const sel = await client.query('SELECT count(*)::int c FROM cases WHERE id = $1', [caseA]);
      expect(sel.rows[0].c).toBe(0);
      const upd = await client.query(
        `UPDATE cases SET is_primary = false, version = version + 1 WHERE id = $1 RETURNING id`,
        [caseA]
      );
      expect(upd.rows.length).toBe(0);
    });
  });

  it('correct Family context: UPDATE ... RETURNING exactly one row', async () => {
    await withContext(accountA, personA, familyA, async (client) => {
      const upd = await client.query(
        `UPDATE cases SET is_primary = false, version = version + 1, updated_at = now()
         WHERE id = $1 RETURNING id, version`,
        [caseA]
      );
      expect(upd.rows.length).toBe(1);
      expect(upd.rows[0].version).toBe(2);
    });
  });

  it('case_events remains INSERT/SELECT only for the runtime role', async () => {
    await withContext(accountA, personA, familyA, async (client) => {
      await client.query(
        `INSERT INTO case_events (family_id, case_id, actor_account_id, event_type, metadata)
         VALUES ($1, $2, $3, 'CASE_CREATED', '{"primary":true,"version":1}'::jsonb)`,
        [familyA, caseA, accountA]
      );
      await expect(
        client.query(`UPDATE case_events SET metadata = '{}'::jsonb WHERE family_id = $1`, [familyA])
      ).rejects.toThrow();
      await expect(
        client.query('DELETE FROM case_events WHERE family_id = $1', [familyA])
      ).rejects.toThrow();
    });
  });

  it('does not add a new policy beyond the frozen baseline', async () => {
    const { rows } = await admin.query(
      `SELECT count(*)::int c FROM pg_policies WHERE tablename IN ('cases', 'case_events')`
    );
    expect(rows[0].c).toBe(2);
  });
});