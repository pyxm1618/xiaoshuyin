/**
 * AUTH-006 forward-migration regression for Problem Formulation review state.
 *
 * Historical 008 remains immutable. This test applies the historical
 * Problem Formulation schema first, then exercises 020 directly so the two
 * governance cases are mechanical:
 *   - ambiguous legacy lifecycle=NEEDS_REVIEW rows fail closed atomically;
 *   - legal lifecycle rows retain their lifecycle and receive review=CURRENT.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL']!;
const ROOT = new URL('../..', import.meta.url).pathname;

const PRE_AUTH006_MIGRATIONS = [
  '001_initial_schema.sql',
  '002_case_core.sql',
  '003_case_idempotency_key_bytes.sql',
  '004_evidence_core.sql',
  '004_identity_binding_runtime.sql',
  '005_case_participant_core.sql',
  '006_case_status_paused_removal.sql',
  '007_case_primary_switch.sql',
  '008_problem_formulation_core.sql',
] as const;

const AUTH006_MIGRATION = '020_problem_formulation_review_state.sql';

function urlForDatabase(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

async function applySqlFile(client: Client, filename: string): Promise<void> {
  const sql = readFileSync(join(ROOT, 'db', 'migrations', filename), 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

async function enumLabels(client: Client, typeName: string): Promise<string[]> {
  const { rows } = await client.query(
    `SELECT e.enumlabel
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = $1
      ORDER BY e.enumsortorder`,
    [typeName]
  );
  return rows.map((row: any) => row.enumlabel);
}

async function seedProblemFormulation(
  client: Client,
  status: 'PRESENTED' | 'NEEDS_REVIEW'
): Promise<{ id: string; caseId: string }> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const { rows: account } = await client.query(
    'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
    [`auth006_migration_${suffix}`]
  );
  const accountId = account[0].id;
  const { rows: person } = await client.query(
    'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
    [accountId]
  );
  const personId = person[0].id;
  const { rows: family } = await client.query(
    'INSERT INTO families (display_name, created_by_person_id) VALUES ($1, $2) RETURNING id',
    [`AUTH006 migration ${suffix}`, personId]
  );
  const familyId = family[0].id;
  await client.query(
    'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
    [familyId, personId]
  );
  const { rows: kase } = await client.query(
    `INSERT INTO cases
       (family_id, created_by_person_id, status, phase, is_primary, version)
     VALUES ($1, $2, 'OPEN', 'PROBLEM_FORMULATION', true, 1)
     RETURNING id`,
    [familyId, personId]
  );
  const caseId = kase[0].id;
  const evidenceId = '11111111-1111-4111-8111-111111111111';
  const { rows: formulation } = await client.query(
    `INSERT INTO problem_formulations
       (family_id, case_id, version, status, primary_problem, key_factors,
        evidence_refs, unknowns, conflicts, scene_fit, alternative_explanations,
        reassessment_conditions, exit_conditions, user_response,
        confirmed_by_person_id, confirmed_at, dependency_refs, supersedes_version)
     VALUES
       ($1, $2, 1, $3,
        $4::jsonb, '[]'::jsonb, $5::jsonb, '[]'::jsonb, '[]'::jsonb,
        'AUTH006_MIGRATION', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
        NULL, NULL, NULL, $6::jsonb, NULL)
     RETURNING id`,
    [
      familyId,
      caseId,
      status,
      JSON.stringify({
        text: 'legacy formulation',
        evidenceRefs: [{ type: 'ASSERTION', id: evidenceId }],
      }),
      JSON.stringify([{ type: 'ASSERTION', id: evidenceId }]),
      JSON.stringify([
        {
          type: 'EVIDENCE',
          evidence: { type: 'ASSERTION', id: evidenceId },
        },
      ]),
    ]
  );
  return { id: formulation[0].id, caseId };
}

describe('AUTH-006 Problem Formulation review-state migration', () => {
  let admin: Client;
  const databases: string[] = [];

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
  }, 60_000);

  afterAll(async () => {
    for (const database of databases) {
      await admin.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
        [database]
      ).catch(() => {});
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`).catch(() => {});
    }
    await admin.end().catch(() => {});
  }, 120_000);

  async function prepare(prefix: string): Promise<{ database: string; migrator: Client; seed: Client }> {
    const database = `xiaoshuyin_auth006_${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await admin.query(`CREATE DATABASE "${database}" OWNER xiaoshuyin_migrator`);
    databases.push(database);

    const migrator = new Client({ connectionString: urlForDatabase(MIGRATION_URL, database) });
    const seed = new Client({ connectionString: urlForDatabase(ADMIN_URL, database) });
    await migrator.connect();
    await seed.connect();
    for (const filename of PRE_AUTH006_MIGRATIONS) {
      await applySqlFile(migrator, filename);
    }
    return { database, migrator, seed };
  }

  it('fails closed before schema mutation when a legacy NEEDS_REVIEW row cannot be reconstructed', async () => {
    const { migrator, seed } = await prepare('ambiguous');
    try {
      const legacy = await seedProblemFormulation(seed, 'NEEDS_REVIEW');
      const before = await seed.query(
        'SELECT status::text AS status FROM problem_formulations WHERE id = $1',
        [legacy.id]
      );
      expect(before.rows[0].status).toBe('NEEDS_REVIEW');

      const sql = readFileSync(join(ROOT, 'db', 'migrations', AUTH006_MIGRATION), 'utf8');
      await migrator.query('BEGIN');
      let error: unknown;
      try {
        await migrator.query(sql);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeDefined();
      expect(String((error as any)?.message ?? error)).toContain(
        'AUTH006_AMBIGUOUS_LEGACY_NEEDS_REVIEW rows=1'
      );
      await migrator.query('ROLLBACK');

      expect(await enumLabels(seed, 'problem_formulation_status')).toEqual([
        'DRAFT', 'PRESENTED', 'CONFIRMED', 'DISPUTED', 'NEEDS_REVIEW', 'SUPERSEDED',
      ]);
      expect(await enumLabels(seed, 'problem_formulation_review_state')).toEqual([]);
      const column = await seed.query(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_name = 'problem_formulations' AND column_name = 'review_state'`
      );
      expect(column.rows).toEqual([]);
      const after = await seed.query(
        'SELECT status::text AS status FROM problem_formulations WHERE id = $1',
        [legacy.id]
      );
      expect(after.rows[0].status).toBe('NEEDS_REVIEW');
    } finally {
      await migrator.end();
      await seed.end();
    }
  }, 180_000);

  it('preserves legal lifecycle and installs independent CURRENT / NEEDS_REVIEW storage', async () => {
    const { migrator, seed } = await prepare('upgrade');
    try {
      const current = await seedProblemFormulation(seed, 'PRESENTED');
      await applySqlFile(migrator, AUTH006_MIGRATION);

      expect(await enumLabels(seed, 'problem_formulation_status')).toEqual([
        'DRAFT', 'PRESENTED', 'CONFIRMED', 'DISPUTED', 'SUPERSEDED',
      ]);
      expect(await enumLabels(seed, 'problem_formulation_review_state')).toEqual([
        'CURRENT', 'NEEDS_REVIEW',
      ]);

      const { rows } = await seed.query(
        `SELECT status::text AS status, review_state::text AS review_state
           FROM problem_formulations WHERE id = $1`,
        [current.id]
      );
      expect(rows[0]).toEqual({
        status: 'PRESENTED',
        review_state: 'CURRENT',
      });

      const privilege = await seed.query(
        `SELECT
           has_type_privilege('xiaoshuyin_app', 'problem_formulation_review_state', 'USAGE') AS type_usage,
           has_column_privilege('xiaoshuyin_app', 'problem_formulations', 'review_state', 'UPDATE') AS review_update`
      );
      expect(privilege.rows[0]).toEqual({
        type_usage: true,
        review_update: true,
      });

      await expect(
        seed.query("SELECT 'NEEDS_REVIEW'::problem_formulation_status")
      ).rejects.toThrow(/invalid input value for enum problem_formulation_status/);
    } finally {
      await migrator.end();
      await seed.end();
    }
  }, 180_000);
});
