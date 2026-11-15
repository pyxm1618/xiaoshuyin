import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations');

function urlForDatabase(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

describe('AUTH-006 Problem Formulation review-state upgrade', () => {
  it('fails closed on ambiguous legacy NEEDS_REVIEW rows, then reconciles only after explicit lifecycle remediation', async () => {
    const dbName = `xiaoshuyin_auth006_upgrade_${Date.now()}`;
    const admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    await admin.end();

    const dbUrl = urlForDatabase(ADMIN_URL, dbName);
    const client = new Client({ connectionString: dbUrl });
    await client.connect();

    try {
      await client.query(`
        CREATE TABLE schema_migrations (
          filename text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now(),
          content_checksum text,
          checksum_origin text,
          checksum_bound_at timestamptz
        )
      `);

      const preAuth006 = readdirSync(MIGRATIONS_DIR)
        .filter((name) => name.endsWith('.sql') && name < '020_problem_formulation_review_state.sql')
        .sort();
      expect(preAuth006.at(-1)).toBe('019_auth_disabled_hard_disable.sql');

      for (const name of preAuth006) {
        await client.query(readFileSync(join(MIGRATIONS_DIR, name), 'utf8'));
      }

      const accountId = (
        await client.query(
          'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
          [`auth006_upgrade_${Date.now()}`]
        )
      ).rows[0].id;
      const personId = (
        await client.query(
          'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
          [accountId]
        )
      ).rows[0].id;
      const familyId = (await client.query('SELECT uuidv7() AS id')).rows[0].id;
      await client.query('SELECT app.create_family($1, $2, $3)', [
        familyId,
        personId,
        'AUTH006-UPGRADE',
      ]);
      await client.query(
        'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
        [familyId, personId]
      );
      const caseId = (
        await client.query(
          `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
           VALUES ($1, $2, 'OPEN', 'PROBLEM_FORMULATION', true, 1)
           RETURNING id`,
          [familyId, personId]
        )
      ).rows[0].id;

      await client.query(
        `INSERT INTO problem_formulations
           (family_id, case_id, version, status, primary_problem, key_factors,
            evidence_refs, unknowns, conflicts, scene_fit, alternative_explanations,
            reassessment_conditions, exit_conditions, user_response,
            confirmed_by_person_id, confirmed_at, dependency_refs, supersedes_version)
         VALUES
           ($1,$2,1,'NEEDS_REVIEW',
            '{"text":"legacy ambiguous"}'::jsonb,'[]'::jsonb,
            '[{"type":"ASSERTION","id":"11111111-1111-4111-8111-111111111111"}]'::jsonb,
            '[]'::jsonb,'[]'::jsonb,'AUTH006','[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
            NULL,NULL,NULL,'[]'::jsonb,NULL)`,
        [familyId, caseId]
      );

      const migration = readFileSync(
        join(MIGRATIONS_DIR, '020_problem_formulation_review_state.sql'),
        'utf8'
      );

      await expect(client.query(migration)).rejects.toThrow(
        /AUTH006_AMBIGUOUS_LEGACY_NEEDS_REVIEW/
      );

      const afterRefusal = await client.query(
        `SELECT
           EXISTS (
             SELECT 1 FROM information_schema.columns
              WHERE table_schema='public'
                AND table_name='problem_formulations'
                AND column_name='review_state'
           ) AS has_review_state,
           (SELECT status::text FROM problem_formulations WHERE case_id=$1) AS status`,
        [caseId]
      );
      expect(afterRefusal.rows[0]).toEqual({
        has_review_state: false,
        status: 'NEEDS_REVIEW',
      });

      // This is an explicit operator/data-governance remediation in the test,
      // not an automatic inference performed by migration 020.
      await client.query(
        `UPDATE problem_formulations SET status='PRESENTED' WHERE case_id=$1 AND version=1`,
        [caseId]
      );
      await client.query(migration);

      const row = await client.query(
        'SELECT status::text AS status, review_state::text AS review_state FROM problem_formulations WHERE case_id=$1',
        [caseId]
      );
      expect(row.rows[0]).toEqual({
        status: 'PRESENTED',
        review_state: 'CURRENT',
      });

      const enums = await client.query(
        `SELECT t.typname, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
           FROM pg_type t
           JOIN pg_enum e ON e.enumtypid=t.oid
          WHERE t.typname IN ('problem_formulation_status','problem_formulation_review_state')
          GROUP BY t.typname
          ORDER BY t.typname`
      );
      expect(Object.fromEntries(enums.rows.map((r: any) => [r.typname, r.labels]))).toEqual({
        problem_formulation_review_state: ['CURRENT', 'NEEDS_REVIEW'],
        problem_formulation_status: ['DRAFT', 'PRESENTED', 'CONFIRMED', 'DISPUTED', 'SUPERSEDED'],
      });
    } finally {
      await client.end();
      const cleanup = new Client({ connectionString: ADMIN_URL });
      await cleanup.connect();
      await cleanup.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1',
        [dbName]
      );
      await cleanup.query(`DROP DATABASE IF EXISTS ${dbName}`);
      await cleanup.end();
    }
  }, 180_000);
});
