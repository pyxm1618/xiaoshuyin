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

      // No family context: INSERT / UPDATE denied.
      const noCtx = new Client({ connectionString: APP_URL });
      await noCtx.connect();
      try {
        await noCtx.query('BEGIN');
        await noCtx.query('SELECT app.set_identity_context($1,$2)', [accountId, 'FAMILY_MANAGEMENT']);
        await noCtx.query('SAVEPOINT n1');
        await expect(
          noCtx.query(
            `INSERT INTO problem_formulations (family_id, case_id, version, status, primary_problem, key_factors, evidence_refs, unknowns, conflicts, scene_fit, alternative_explanations, reassessment_conditions, exit_conditions, dependency_refs)
             VALUES ($1,$2,2,'DISPUTED','{}'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'x','[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb)`,
            [a.familyId, a.caseId]
          )
        ).rejects.toMatchObject({ code: '42501' });
        await noCtx.query('ROLLBACK TO SAVEPOINT n1');
        await noCtx.query('SAVEPOINT n2');
        const noCtxUpdate = await noCtx.query(`UPDATE problem_formulations SET status='DISPUTED'`);
        expect(noCtxUpdate.rowCount).toBe(0);
        await noCtx.query('ROLLBACK');
      } finally {
        await noCtx.end();
      }

      // Wrong-family INSERT denied; wrong-family UPDATE affects nothing.
      const wrong = new Client({ connectionString: APP_URL });
      await wrong.connect();
      try {
        await wrong.query('BEGIN');
        await wrong.query('SELECT app.set_identity_context($1,$2)', [accountId, 'FAMILY_MANAGEMENT']);
        await wrong.query('SELECT app.set_family_context($1,$2,$3)', [b.familyId, personId, 'FAMILY_MANAGEMENT']);
        await wrong.query('SAVEPOINT w1');
        await expect(
          wrong.query(
            `INSERT INTO problem_formulations (family_id, case_id, version, status, primary_problem, key_factors, evidence_refs, unknowns, conflicts, scene_fit, alternative_explanations, reassessment_conditions, exit_conditions, dependency_refs)
             VALUES ($1,$2,3,'DISPUTED','{}'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'x','[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb)`,
            [a.familyId, a.caseId]
          )
        ).rejects.toMatchObject({ code: '42501' });
        await wrong.query('ROLLBACK TO SAVEPOINT w1');
        const wrongUpdate = await wrong.query(
          `UPDATE problem_formulations SET status='NEEDS_REVIEW' WHERE family_id=$1`,
          [a.familyId]
        );
        expect(wrongUpdate.rowCount).toBe(0);
        await wrong.query('ROLLBACK');
      } finally {
        await wrong.end();
      }

      // Forbidden column UPDATEs are rejected by column privileges.
      const cols = new Client({ connectionString: APP_URL });
      await cols.connect();
      try {
        await cols.query('BEGIN');
        await cols.query('SELECT app.set_identity_context($1,$2)', [accountId, 'FAMILY_MANAGEMENT']);
        await cols.query('SELECT app.set_family_context($1,$2,$3)', [a.familyId, personId, 'FAMILY_MANAGEMENT']);
        for (const [idx, sql] of [
          'UPDATE problem_formulations SET version=2',
          'UPDATE problem_formulations SET case_id=case_id',
          'UPDATE problem_formulations SET family_id=family_id',
          'UPDATE problem_formulations SET supersedes_version=1',
          'UPDATE problem_formulations SET primary_problem=primary_problem',
          'UPDATE problem_formulations SET dependency_refs=dependency_refs',
        ].entries()) {
          await cols.query(`SAVEPOINT c${idx}`);
          await expect(cols.query(sql)).rejects.toMatchObject({ code: '42501' });
          await cols.query(`ROLLBACK TO SAVEPOINT c${idx}`);
        }
        await cols.query('ROLLBACK');
      } finally {
        await cols.end();
      }

      // cases keeps least privilege: only phase/version/updated_at columns.
      const caseCols = new Client({ connectionString: APP_URL });
      await caseCols.connect();
      try {
        await caseCols.query('BEGIN');
        await caseCols.query('SELECT app.set_identity_context($1,$2)', [accountId, 'FAMILY_MANAGEMENT']);
        await caseCols.query('SELECT app.set_family_context($1,$2,$3)', [a.familyId, personId, 'FAMILY_MANAGEMENT']);
        for (const [idx, sql] of [
          `UPDATE cases SET status='OPEN'`,
          `UPDATE cases SET created_by_person_id=created_by_person_id`,
          `UPDATE cases SET family_id=family_id`,
        ].entries()) {
          await caseCols.query(`SAVEPOINT k${idx}`);
          await expect(caseCols.query(sql)).rejects.toMatchObject({ code: '42501' });
          await caseCols.query(`ROLLBACK TO SAVEPOINT k${idx}`);
        }
        const primary = await caseCols.query(
          `UPDATE cases SET is_primary=is_primary WHERE id=$1 RETURNING is_primary`,
          [a.caseId]
        );
        expect(primary.rows).toHaveLength(1);
        const phase = await caseCols.query(
          `UPDATE cases SET phase='GOALS', version=version+1, updated_at=now() WHERE id=$1 RETURNING phase`,
          [a.caseId]
        );
        expect(phase.rows[0].phase).toBe('GOALS');
        await caseCols.query('ROLLBACK');
      } finally {
        await caseCols.end();
      }

      const meta = await admin.query(
        `SELECT c.relowner::regrole::text AS owner, r.rolbypassrls
           FROM pg_class c, pg_roles r
          WHERE c.relname='problem_formulations' AND r.rolname='xiaoshuyin_app'`
      );
      expect(meta.rows[0].owner).toBe('xiaoshuyin_migrator');
      expect(meta.rows[0].rolbypassrls).toBe(false);
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

  it('forced 008 failure leaves no partial enum/table/policy/grant/CHECK object', async () => {
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
      const before = await client.query(
        `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
          WHERE conname IN ('business_audit_events_resource_type_check','business_audit_events_event_type_check','idempotency_keys_command_type_check','case_events_event_type_check')`
      );
      const eight = new Client({ connectionString: dbUrl });
      await eight.connect();
      let failed = false;
      try {
        await eight.query('BEGIN');
        await eight.query(
          readFileSync(join(dir, '008_problem_formulation_core.sql'), 'utf-8') +
            "\nDO $$ BEGIN RAISE EXCEPTION 'T843_FORCED_FAILURE'; END $$;"
        );
        await eight.query('COMMIT');
      } catch {
        failed = true;
        await eight.query('ROLLBACK').catch(() => {});
      } finally {
        await eight.end();
      }
      expect(failed).toBe(true);

      const residue = await client.query(
        `SELECT
          (SELECT count(*)::int FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
            WHERE n.nspname='public' AND t.typname='problem_formulation_status') AS enums,
          (SELECT count(*)::int FROM pg_tables
            WHERE schemaname='public' AND tablename='problem_formulations') AS tables,
          (SELECT count(*)::int FROM pg_policies WHERE tablename='problem_formulations') AS policies,
          (SELECT count(*)::int FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid
            WHERE cl.relname='problem_formulations') AS constraints`
      );
      expect(residue.rows[0]).toEqual({ enums: 0, tables: 0, policies: 0, constraints: 0 });

      const grants = await client.query(
        `SELECT
           CASE WHEN to_regclass('public.problem_formulations') IS NULL THEN false
                ELSE has_table_privilege('xiaoshuyin_app','problem_formulations','SELECT') END AS s,
           CASE WHEN to_regclass('public.problem_formulations') IS NULL THEN false
                ELSE has_table_privilege('xiaoshuyin_app','problem_formulations','INSERT') END AS i,
           CASE WHEN to_regclass('public.problem_formulations') IS NULL THEN false
                ELSE has_table_privilege('xiaoshuyin_app','problem_formulations','UPDATE') END AS u,
           CASE WHEN to_regclass('public.problem_formulations') IS NULL THEN false
                ELSE has_table_privilege('xiaoshuyin_app','problem_formulations','DELETE') END AS d`
      );
      expect(grants.rows[0]).toEqual({ s: false, i: false, u: false, d: false });
      const leakingGrants = await client.query(
        `SELECT count(*)::int AS n FROM information_schema.column_privileges
          WHERE grantee='xiaoshuyin_app' AND table_name='cases' AND column_name='phase' AND privilege_type='UPDATE'`
      );
      expect(leakingGrants.rows[0].n).toBe(0);
      const after = await client.query(
        `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
          WHERE conname IN ('business_audit_events_resource_type_check','business_audit_events_event_type_check','idempotency_keys_command_type_check','case_events_event_type_check')`
      );
      expect(after.rows.sort()).toEqual(before.rows.sort());
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