/**
 * 006_case_status_paused_removal.sql — forward-migration regression.
 *
 * Proves the only database-side change of the Case-level PAUSED removal:
 *   1. the final `case_status` vocabulary is exactly the five frozen labels;
 *   2. a direct `PAUSED` value is no longer accepted by the type;
 *   3. a pre-existing `cases.status = 'PAUSED'` row FAILS the migration and
 *      rolls back with no data reinterpretation and no schema drift;
 *   4. legal five-state data keeps its original value, and the direct
 *      dependencies (primary-uniqueness index, status index, RLS FORCE,
 *      app type privilege) are restored verbatim;
 *   5. a second application is a 0-new no-op.
 *
 * Each scenario uses its own throw-away database owned by the migrator role.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL']!;
const ROOT = new URL('../..', import.meta.url).pathname;

const PRE_REMEDIATION_MIGRATIONS = [
  '001_initial_schema.sql',
  '002_case_core.sql',
  '003_case_idempotency_key_bytes.sql',
  '004_evidence_core.sql',
  '004_identity_binding_runtime.sql',
  '005_case_participant_core.sql',
] as const;

const FIVE_LABELS = ['OPEN', 'WAITING', 'LOST_CONTACT', 'SAFETY_HOLD', 'CLOSED'];

function urlForDatabase(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

function runMigrator(connectionString: string): string {
  return execFileSync(process.execPath, [join(ROOT, 'scripts', 'db-migrate.mjs')], {
    cwd: ROOT,
    env: { ...process.env, MIGRATION_DATABASE_URL: connectionString },
    encoding: 'utf8',
    timeout: 120_000,
  });
}

interface MigratorFailure {
  status: number;
  stdout: string;
  stderr: string;
}

function runMigratorExpectingFailure(connectionString: string): MigratorFailure {
  try {
    const stdout = runMigrator(connectionString);
    return { status: 0, stdout, stderr: '' };
  } catch (error: any) {
    return {
      status: typeof error?.status === 'number' ? error.status : 1,
      stdout: String(error?.stdout ?? ''),
      stderr: String(error?.stderr ?? ''),
    };
  }
}

async function applyMigrations(client: Client, database: string): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  for (const filename of PRE_REMEDIATION_MIGRATIONS) {
    const sql = readFileSync(join(ROOT, 'db', 'migrations', filename), 'utf-8');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
    await client.query('COMMIT');
  }
}

async function seedFamilyAndCases(
  client: Client,
  rows: Array<{ status: string; isPrimary: boolean }>
): Promise<{ familyId: string; caseIds: string[] }> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const { rows: account } = await client.query(
    'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
    [`rem_${suffix}`]
  );
  const accountId = account[0].id;
  const { rows: person } = await client.query(
    'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
    [accountId]
  );
  const personId = person[0].id;
  const { rows: family } = await client.query(
    'INSERT INTO families (display_name, created_by_person_id) VALUES ($1, $2) RETURNING id',
    [`rem-${suffix}`, personId]
  );
  const familyId = family[0].id;
  const caseIds: string[] = [];
  for (const row of rows) {
    const { rows: kase } = await client.query(
      `INSERT INTO cases
         (family_id, created_by_person_id, status, phase, is_primary, version)
       VALUES ($1, $2, $3, 'INTAKE', $4, 1)
       RETURNING id`,
      [familyId, personId, row.status, row.isPrimary]
    );
    caseIds.push(kase[0].id);
  }
  return { familyId, caseIds };
}

async function caseStatusOf(client: Client, caseIds: string[]): Promise<string[]> {
  const { rows } = await client.query(
    'SELECT id, status::text AS status FROM cases WHERE id = ANY($1::uuid[]) ORDER BY id',
    [caseIds]
  );
  return rows.map((r: any) => r.status);
}

async function enumLabels(client: Client): Promise<string[]> {
  const { rows } = await client.query(
    `SELECT e.enumlabel
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = 'case_status'
      ORDER BY e.enumsortorder`
  );
  return rows.map((r: any) => r.enumlabel);
}

async function casesIndexes(client: Client): Promise<Record<string, string>> {
  const { rows } = await client.query(
    `SELECT indexname, indexdef
       FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'cases'
        AND indexname IN ('cases_one_primary_open_per_family', 'cases_family_status_idx')`
  );
  return Object.fromEntries(
    rows.map((r: any) => [r.indexname, String(r.indexdef).replace(/\s+/g, ' ')])
  );
}

describe('006 case_status PAUSED removal', () => {
  let admin: Client;
  const createdDatabases: string[] = [];

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
  }, 60_000);

  afterAll(async () => {
    for (const database of createdDatabases) {
      await admin
        .query(
          'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
          [database]
        )
        .catch(() => {});
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`).catch(() => {});
    }
    await admin?.end().catch(() => {});
  }, 120_000);

  async function prepareDatabase(prefix: string): Promise<string> {
    const database = `xiaoshuyin_rem_${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await admin.query(`CREATE DATABASE "${database}" OWNER xiaoshuyin_migrator`);
    createdDatabases.push(database);
    const client = new Client({ connectionString: urlForDatabase(MIGRATION_URL, database) });
    await client.connect();
    try {
      await applyMigrations(client, database);
    } finally {
      await client.end();
    }
    return database;
  }

  it('fails atomically when a PAUSED Case row exists, without reinterpreting data', async () => {
    const database = await prepareDatabase('blocked');
    const upgradeUrl = urlForDatabase(MIGRATION_URL, database);
    const seed = new Client({ connectionString: urlForDatabase(ADMIN_URL, database) });
    await seed.connect();

    try {
      const { caseIds } = await seedFamilyAndCases(seed, [
        { status: 'PAUSED', isPrimary: false },
        { status: 'WAITING', isPrimary: true },
      ]);
      const before = await caseStatusOf(seed, caseIds);
      expect([...before].sort()).toEqual(['PAUSED', 'WAITING']);
      expect(await enumLabels(seed)).toEqual([
        'OPEN', 'WAITING', 'PAUSED', 'LOST_CONTACT', 'SAFETY_HOLD', 'CLOSED',
      ]);

      const failure = runMigratorExpectingFailure(upgradeUrl);
      expect(failure.status).not.toBe(0);
      expect(failure.stdout).toContain('APPLY 006_case_status_paused_removal.sql');
      expect(failure.stderr).toContain('S3M01_CASE_PAUSED_ROWS_EXIST:1 row(s)');
      expect(failure.stderr).not.toContain('S3M03_CASE_STATUS_POSTCONDITION_FAILED');

      // Rollback left the pre-remediation six-state schema fully usable.
      expect(await enumLabels(seed)).toEqual([
        'OPEN', 'WAITING', 'PAUSED', 'LOST_CONTACT', 'SAFETY_HOLD', 'CLOSED',
      ]);
      expect((await caseStatusOf(seed, caseIds)).sort()).toEqual(['PAUSED', 'WAITING']);
      expect(Object.keys(await casesIndexes(seed)).sort()).toEqual([
        'cases_family_status_idx',
        'cases_one_primary_open_per_family',
      ]);

      const { rows: rls } = await seed.query(
        'SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = $1::regclass',
        ['cases']
      );
      expect(rls[0].relrowsecurity).toBe(true);
      expect(rls[0].relforcerowsecurity).toBe(true);

      const { rows: applied } = await seed.query(
        "SELECT filename FROM schema_migrations WHERE filename = '006_case_status_paused_removal.sql'"
      );
      expect(applied).toEqual([]);

      const { rows: leftover } = await seed.query(
        `SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' AND t.typname = 'case_status_v2'`
      );
      expect(leftover).toEqual([]);
    } finally {
      await seed.end();
    }
  }, 180_000);

  it('narrows to five labels, preserves legal rows and restores dependencies', async () => {
    const database = await prepareDatabase('upgrade');
    const upgradeUrl = urlForDatabase(MIGRATION_URL, database);
    const seed = new Client({ connectionString: urlForDatabase(ADMIN_URL, database) });
    await seed.connect();

    try {
      const { familyId, caseIds } = await seedFamilyAndCases(seed, [
        { status: 'OPEN', isPrimary: true },
        { status: 'WAITING', isPrimary: false },
        { status: 'LOST_CONTACT', isPrimary: false },
        { status: 'SAFETY_HOLD', isPrimary: false },
        { status: 'CLOSED', isPrimary: false },
      ]);
      const beforeRows = await caseStatusOf(seed, caseIds);
      expect([...beforeRows].sort()).toEqual([...FIVE_LABELS].sort());

      const output = runMigrator(upgradeUrl);
      expect(output).toContain('APPLY 006_case_status_paused_removal.sql');
      expect(output).toContain('APPLY 007_case_primary_switch.sql');
      expect(output).toMatch(/Migration complete: 3 new, 6 previously applied\./);

      expect(await enumLabels(seed)).toEqual(FIVE_LABELS);

      // T4 — every legal value keeps its original label (delta = 0).
      expect(await caseStatusOf(seed, caseIds)).toEqual(beforeRows);

      // T2 — PAUSED is no longer a legal value of the final type.
      await expect(seed.query("SELECT 'PAUSED'::case_status")).rejects.toThrow(
        /invalid input value for enum case_status/
      );
      await expect(
        seed.query(
          `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
           SELECT $1, created_by_person_id, 'PAUSED', 'INTAKE', false, 2 FROM cases WHERE id = $2`,
          [familyId, caseIds[0]]
        )
      ).rejects.toThrow(/invalid input value for enum case_status/);

      // Dependency restoration is definition-equivalent, not merely present.
      const indexes = await casesIndexes(seed);
      expect(indexes['cases_one_primary_open_per_family']).toMatch(
        /UNIQUE INDEX.*\(family_id\).*WHERE \(is_primary AND \(status <> 'CLOSED'::case_status\)\)/
      );
      expect(indexes['cases_family_status_idx']).toMatch(
        /CREATE INDEX cases_family_status_idx .*\(family_id, status\)/
      );

      const { rows: rls } = await seed.query(
        'SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = $1::regclass',
        ['cases']
      );
      expect(rls[0].relrowsecurity).toBe(true);
      expect(rls[0].relforcerowsecurity).toBe(true);

      const { rows: privilege } = await seed.query(
        "SELECT has_type_privilege('xiaoshuyin_app', 'public.case_status', 'USAGE') AS ok"
      );
      expect(privilege[0].ok).toBe(true);

      // No intermediate type survives.
      const { rows: leftover } = await seed.query(
        `SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' AND t.typname = 'case_status_v2'`
      );
      expect(leftover).toEqual([]);

      const { rows: applied } = await seed.query(
        "SELECT filename FROM schema_migrations WHERE filename = '006_case_status_paused_removal.sql'"
      );
      expect(applied).toHaveLength(1);
    } finally {
      await seed.end();
    }
  }, 180_000);

  it('second application is a 0-new no-op with an unchanged object set', async () => {
    const database = await prepareDatabase('replay');
    const upgradeUrl = urlForDatabase(MIGRATION_URL, database);
    const seed = new Client({ connectionString: urlForDatabase(ADMIN_URL, database) });
    await seed.connect();

    try {
      runMigrator(upgradeUrl);
      const beforeEnums = await enumLabels(seed);
      const beforeIndexes = await casesIndexes(seed);

      const output = runMigrator(upgradeUrl);
      expect(output).toMatch(/Migration complete: 0 new, 9 previously applied\./);
      expect(output).not.toContain('APPLY 006_case_status_paused_removal.sql');
      expect(output).not.toContain('APPLY 007_case_primary_switch.sql');

      expect(await enumLabels(seed)).toEqual(beforeEnums);
      expect(await casesIndexes(seed)).toEqual(beforeIndexes);
    } finally {
      await seed.end();
    }
  }, 180_000);
});