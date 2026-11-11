/** S8-M06/T817 direct RLS + T843 forced migration rollback. */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { createAdminPool } from '../setup/db.js';
import { withIdentityTransaction, withRlsTransaction } from '../../apps/server/api/src/db/tx.js';

const PREFIX = 't8rls_';
const APP_URL = process.env['DATABASE_URL']!;
const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;

describe('S8 direct RLS and migration rollback', () => {
  it('problem_formulations obeys family context and least privilege', async () => {
    const admin = createAdminPool();
    const app = new (await import('pg')).default.Pool({ connectionString: APP_URL });
    const account = await admin.query('INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id', [`${PREFIX}${Date.now()}`]);
    const accountId = account.rows[0].id as string;
    const person = await admin.query('INSERT INTO persons (account_id, created_by_account_id) VALUES ($1,$1) RETURNING id', [accountId]);
    const personId = person.rows[0].id as string;
    const accountB = await admin.query('INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id', [`${PREFIX}b_${Date.now()}`]);
    const accountBId = accountB.rows[0].id as string;
    const personB = await admin.query('INSERT INTO persons (account_id, created_by_account_id) VALUES ($1,$1) RETURNING id', [accountBId]);
    const personBId = personB.rows[0].id as string;

    const makeFamily = async (label: string, creatorPersonId: string) => {
      const id = (await admin.query('SELECT uuidv7() AS id')).rows[0].id as string;
      await admin.query('SELECT app.create_family($1,$2,$3)', [id, creatorPersonId, label]);
      await admin.query('INSERT INTO family_members (family_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, creatorPersonId]);
      await admin.query('INSERT INTO family_members (family_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, personId]);
      await admin.query('INSERT INTO family_members (family_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, personBId]);
      const c = await admin.query(
        `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
         VALUES ($1,$2,'OPEN','PROBLEM_FORMULATION',true,1) RETURNING id`,
        [id, personId]
      );
      return { familyId: id, caseId: c.rows[0].id as string };
    };
    const a = await makeFamily('T8RLS-A', personId);
    const b = await makeFamily('T8RLS-B', personBId);

    const evidence = { type: 'ASSERTION', id: '11111111-1111-4111-8111-111111111111' };
    const insert = (familyId: string, caseId: string, version: number) =>
      admin.query(
        `INSERT INTO problem_formulations
          (family_id, case_id, version, status, primary_problem, key_factors, evidence_refs,
           unknowns, conflicts, scene_fit, alternative_explanations, reassessment_conditions,
           exit_conditions, dependency_refs)
         VALUES ($1,$2,$3,'PRESENTED',jsonb_build_object('text','x','evidenceRefs',$4::jsonb),
          '[]'::jsonb,$4::jsonb,'[]'::jsonb,'[]'::jsonb,'scene','[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb)`,
        [familyId, caseId, version, JSON.stringify([evidence])]
      );
    await insert(a.familyId, a.caseId, 1);
    await insert(b.familyId, b.caseId, 1);

    // no family context: RLS returns nothing
    const noContext = await withIdentityTransaction(
      app,
      { accountId, purpose: 'FAMILY_MANAGEMENT' },
      (tx) => tx.query('SELECT count(*)::int AS n FROM problem_formulations')
    );
    expect(noContext.rows[0].n).toBe(0);

    // correct family sees only its row
    const own = await withRlsTransaction(
      app,
      { familyId: a.familyId, accountId, personId, purpose: 'FAMILY_MANAGEMENT' },
      (tx) => tx.query('SELECT family_id FROM problem_formulations')
    );
    expect(own.rows).toEqual([{ family_id: a.familyId }]);

    // wrong family sees nothing
    const other = await withRlsTransaction(
      app,
      { familyId: b.familyId, accountId, personId, purpose: 'FAMILY_MANAGEMENT' },
      (tx) => tx.query('SELECT family_id FROM problem_formulations WHERE family_id=$1', [a.familyId])
    );
    expect(other.rows).toHaveLength(0);

    const direct = new Client({ connectionString: APP_URL });
    await direct.connect();
    try {
      await direct.query('BEGIN');
      await direct.query('SELECT app.set_identity_context($1,$2)', [accountId, 'FAMILY_MANAGEMENT']);
      await direct.query('SELECT app.set_family_context($1,$2,$3)', [a.familyId, personId, 'FAMILY_MANAGEMENT']);
      await direct.query('SAVEPOINT denied_delete');
      await expect(direct.query('DELETE FROM problem_formulations')).rejects.toMatchObject({ code: '42501' });
      await direct.query('ROLLBACK TO SAVEPOINT denied_delete');
      await direct.query('SAVEPOINT denied_update');
      await expect(
        direct.query(`UPDATE problem_formulations SET primary_problem='{}'::jsonb`)
      ).rejects.toMatchObject({ code: '42501' });
      await direct.query('ROLLBACK TO SAVEPOINT denied_update');
      const lifecycle = await direct.query(
        `UPDATE problem_formulations SET status='DISPUTED', updated_at=now() RETURNING status`
      );
      expect(lifecycle.rows[0].status).toBe('DISPUTED');
      await direct.query('ROLLBACK');
    } finally {
      await direct.end();
      await admin.query('DELETE FROM problem_formulations WHERE family_id = ANY($1)', [[a.familyId, b.familyId]]);
      await admin.query('DELETE FROM cases WHERE family_id = ANY($1)', [[a.familyId, b.familyId]]);
      await admin.query('DELETE FROM family_members WHERE family_id = ANY($1)', [[a.familyId, b.familyId]]);
      await admin.query('DELETE FROM families WHERE id = ANY($1)', [[a.familyId, b.familyId]]);
      await admin.query('DELETE FROM persons WHERE account_id = ANY($1)', [[accountId, accountBId]]);
      await admin.query('DELETE FROM accounts WHERE id = ANY($1)', [[accountId, accountBId]]);
      await app.end();
      await admin.end();
    }
  }, 60000);

  it('forced 008 failure leaves no partial enum/table object', async () => {
    const admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    const dbName = `xiaoshuyin_s8_rollback_${Date.now()}`;
    await admin.query(`CREATE DATABASE ${dbName}`);
    await admin.end();
    const dbUrl = ADMIN_URL.replace(/\/[^/?]+(\?.*)?$/, `/${dbName}$1`);
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    const dir = join(process.cwd(), 'db', 'migrations');
    try {
      for (const name of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
        if (name >= '008_problem_formulation_core.sql') break;
        await client.query(readFileSync(join(dir, name), 'utf-8'));
      }
      // Force CREATE TABLE to fail after the enum was created in the same file.
      await client.query('CREATE TABLE problem_formulations (id uuid)');
      const eight = new Client({ connectionString: dbUrl });
      await eight.connect();
      let failed = false;
      try {
        await eight.query('BEGIN');
        await eight.query(readFileSync(join(dir, '008_problem_formulation_core.sql'), 'utf-8'));
        await eight.query('COMMIT');
      } catch {
        failed = true;
        await eight.query('ROLLBACK').catch(() => {});
      } finally {
        await eight.end();
      }
      expect(failed).toBe(true);
      const enums = await client.query(
        `SELECT count(*)::int AS n FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
         WHERE n.nspname='public' AND t.typname='problem_formulation_status'`
      );
      const policies = await client.query(
        `SELECT count(*)::int AS n FROM pg_policies WHERE tablename='problem_formulations'`
      );
      expect(enums.rows[0].n).toBe(0);
      expect(policies.rows[0].n).toBe(0);
    } finally {
      await client.end().catch(() => {});
      const cleanup = new Client({ connectionString: ADMIN_URL });
      await cleanup.connect();
      await cleanup.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [dbName]);
      await cleanup.query(`DROP DATABASE IF EXISTS ${dbName}`);
      await cleanup.end();
    }
  }, 60000);
});