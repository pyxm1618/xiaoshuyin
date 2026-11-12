/**
 * AUD-II-003 — real Slice 1 + Slice 2 database upgrade path.
 *
 * T055 requires proof that `004_evidence_core.sql` is additive against a
 * database that already contains real Slice 1 + Slice 2 schema and data — not
 * only against an empty database.
 *
 * Flow:
 *   1. create a throw-away database owned by the migrator role
 *   2. apply only 001–003 and record them in schema_migrations
 *   3. insert representative Slice 1 + Slice 2 rows and capture invariants
 *   4. run the real migrator, which applies the additive post-003 migrations
 *   5. assert old data/invariants survive and the new Evidence schema exists
 *   6. run the migrator again and require a 0-new no-op
 *   7. drop the throw-away database
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL']!;
const ROOT = new URL('../..', import.meta.url).pathname;

const PRE_EVIDENCE_MIGRATIONS = [
  '001_initial_schema.sql',
  '002_case_core.sql',
  '003_case_idempotency_key_bytes.sql',
] as const;

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

interface SeedIds {
  accountId: string;
  personId: string;
  familyId: string;
  caseId: string;
  caseEventId: string;
  auditEventId: string;
  idempotencyId: string;
  profileValueId: string;
}

describe('Slice 1+2 -> Slice 3 migration upgrade (AUD-II-003)', () => {
  let admin: Client;
  let migrator: Client;
  let seedAdmin: Client;
  let database: string;
  let upgradeUrl: string;
  let ids: SeedIds;
  let beforeCounts: Record<string, number>;

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    database = `xiaoshuyin_evid_up_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await admin.query(`CREATE DATABASE "${database}" OWNER xiaoshuyin_migrator`);

    upgradeUrl = urlForDatabase(MIGRATION_URL, database);

    // Apply ONLY 001–003 through the real migration files and record them the
    // same way scripts/db-migrate.mjs does.
    migrator = new Client({ connectionString: upgradeUrl });
    await migrator.connect();
    await migrator.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    for (const filename of PRE_EVIDENCE_MIGRATIONS) {
      const sql = readFileSync(join(ROOT, 'db', 'migrations', filename), 'utf-8');
      await migrator.query('BEGIN');
      await migrator.query(sql);
      await migrator.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      await migrator.query('COMMIT');
    }

    // Representative Slice 1 + Slice 2 data, inserted with the admin role
    // (superuser bypasses RLS in this temporary database only).
    seedAdmin = new Client({ connectionString: urlForDatabase(ADMIN_URL, database) });
    await seedAdmin.connect();
    ids = await seed(seedAdmin);
    beforeCounts = await counts(seedAdmin);
  }, 120_000);

  afterAll(async () => {
    await seedAdmin?.end().catch(() => {});
    await migrator?.end().catch(() => {});
    if (admin && database) {
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

  it('applies 004 over Slice 1+2 data and preserves every original row', async () => {
    const output = runMigrator(upgradeUrl);
    expect(output).toContain('SKIP 001_initial_schema.sql');
    expect(output).toContain('SKIP 002_case_core.sql');
    expect(output).toContain('SKIP 003_case_idempotency_key_bytes.sql');
    expect(output).toContain('APPLY 004_evidence_core.sql');
    expect(output).toContain('APPLY 004_identity_binding_runtime.sql');
expect(output).toContain('APPLY 005_case_participant_core.sql');
    expect(output).toContain('APPLY 006_case_status_paused_removal.sql');
    // Slice 7 adds one reviewed migration; it must apply in the same upgrade.
    expect(output).toContain('APPLY 007_case_primary_switch.sql');
    // Slice 9 adds one reviewed migration; it must apply in the same upgrade.
    expect(output).toContain('APPLY 009_safety_hold_control_foundation.sql');
    expect(output).toMatch(/Migration complete: 9 new, 3 previously applied\./);

    // Data survival.
    expect(await counts(seedAdmin)).toEqual(beforeCounts);
    const { rows: caseRows } = await seedAdmin.query(
      'SELECT id, family_id, created_by_person_id, status, phase, is_primary, version FROM cases WHERE id = $1',
      [ids.caseId]
    );
    expect(caseRows).toHaveLength(1);
    expect(caseRows[0].family_id).toBe(ids.familyId);
    expect(caseRows[0].is_primary).toBe(true);

    const { rows: eventRows } = await seedAdmin.query(
      'SELECT case_id, family_id, event_type FROM case_events WHERE id = $1',
      [ids.caseEventId]
    );
    expect(eventRows[0]).toMatchObject({
      case_id: ids.caseId,
      family_id: ids.familyId,
      event_type: 'CASE_CREATED',
    });

    const { rows: auditRows } = await seedAdmin.query(
      'SELECT family_id, event_type, resource_type, resource_id FROM business_audit_events WHERE id = $1',
      [ids.auditEventId]
    );
    expect(auditRows[0]).toMatchObject({
      family_id: ids.familyId,
      event_type: 'CASE_CREATED',
      resource_type: 'CASE',
      resource_id: ids.caseId,
    });

    const { rows: idemRows } = await seedAdmin.query(
      'SELECT actor_account_id, command_type, idempotency_key, request_hash, response_status FROM idempotency_keys WHERE id = $1',
      [ids.idempotencyId]
    );
    expect(idemRows[0]).toMatchObject({
      actor_account_id: ids.accountId,
      command_type: 'CASE_CREATE',
      idempotency_key: 'upgrade-case-key-1',
      request_hash: 'a'.repeat(64),
      response_status: 201,
    });

    const { rows: profileRows } = await seedAdmin.query(
      'SELECT person_id, attribute, value_text FROM person_profile_values WHERE id = $1',
      [ids.profileValueId]
    );
    expect(profileRows[0]).toMatchObject({
      person_id: ids.personId,
      attribute: 'DISPLAY_NAME',
      value_text: 'upgrade-fixture',
    });

    const { rows: migrationRows } = await migrator.query(
      'SELECT filename FROM schema_migrations ORDER BY filename'
    );
    expect(migrationRows.map((r: any) => r.filename)).toEqual([
      '001_initial_schema.sql',
      '002_case_core.sql',
      '003_case_idempotency_key_bytes.sql',
      '004_evidence_core.sql',
      '004_identity_binding_runtime.sql',
      '005_case_participant_core.sql',
      '006_case_status_paused_removal.sql',
      '007_case_primary_switch.sql',
      '008_problem_formulation_core.sql',
      '009_safety_hold_control_foundation.sql',
      '010_problem_formulation_safety_vocabulary_reconcile.sql',
      '011_compliance_feature_policy_foundation.sql',
    ]);

    // New Evidence schema exists.
    const { rows: tableRows } = await migrator.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    const tables = tableRows.map((r: any) => r.tablename);
    for (const table of ['dialogue_messages', 'assertions', 'observations']) {
      expect(tables, table).toContain(table);
    }

    const { rows: enumRows } = await migrator.query(
      `SELECT t.typname, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
         FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
         JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname IN ('assertion_kind','observation_value_state',
                            'observation_value_type','evidence_time_state',
                            'evidence_confirmation_status')
        GROUP BY t.typname`
    );
    const enums = Object.fromEntries(enumRows.map((r: any) => [r.typname, r.labels]));
    expect(enums['assertion_kind']).toEqual(['STATEMENT', 'FACT', 'HYPOTHESIS']);
    expect(enums['observation_value_state']).toEqual([
      'KNOWN',
      'UNKNOWN',
      'NOT_COLLECTED',
      'DECLINED',
      'NOT_APPLICABLE',
    ]);
    expect(enums['observation_value_type']).toEqual(['TEXT', 'NUMBER', 'BOOLEAN']);
    expect(enums['evidence_time_state']).toEqual(['KNOWN', 'UNKNOWN']);
    expect(enums['evidence_confirmation_status']).toEqual([
      'UNCONFIRMED',
      'SOURCE_CONFIRMED',
      'DISPUTED',
    ]);

    const { rows: rlsRows } = await migrator.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity
         FROM pg_class
        WHERE relname IN ('dialogue_messages','assertions','observations')`
    );
    expect(rlsRows).toHaveLength(3);
    for (const row of rlsRows) {
      expect(row.relrowsecurity, row.relname).toBe(true);
      expect(row.relforcerowsecurity, row.relname).toBe(true);
    }

    const { rows: policyRows } = await migrator.query(
      `SELECT count(*)::int AS count FROM pg_policies WHERE schemaname = 'public'`
    );
    expect(policyRows[0].count).toBe(54); // + Slice 8 three + Slice 9 one + Slice 10 two

    // Runtime grants: SELECT/INSERT on all three, column UPDATE only, no DELETE.
    const { rows: grants } = await migrator.query(
      `SELECT table_name, privilege_type
         FROM information_schema.table_privileges
        WHERE grantee = 'xiaoshuyin_app'
          AND table_name IN ('dialogue_messages','assertions','observations')`
    );
    const tableGrants = grants.map((r: any) => `${r.table_name}:${r.privilege_type}`);
    for (const table of ['dialogue_messages', 'assertions', 'observations']) {
      expect(tableGrants, table).toContain(`${table}:SELECT`);
      expect(tableGrants, table).toContain(`${table}:INSERT`);
      expect(tableGrants, table).not.toContain(`${table}:DELETE`);
      expect(tableGrants, table).not.toContain(`${table}:UPDATE`);
    }
    const { rows: columnGrants } = await migrator.query(
      `SELECT table_name, column_name, privilege_type
         FROM information_schema.column_privileges
        WHERE grantee = 'xiaoshuyin_app'
          AND table_name IN ('assertions','observations')`
    );
    const columnKeys = columnGrants.map(
      (r: any) => `${r.table_name}:${r.column_name}:${r.privilege_type}`
    );
    expect(columnKeys).toContain('assertions:conflict_group_id:UPDATE');
    expect(columnKeys).toContain('observations:conflict_group_id:UPDATE');

    // CHECK whitelists were extended: the new vocabulary is admitted while the
    // already-existing rows above still satisfy the revalidated constraints.
    const { rows: newAudit } = await seedAdmin.query(
      `INSERT INTO business_audit_events
         (family_id, actor_account_id, event_type, resource_type, resource_id)
       VALUES ($1, $2, 'MESSAGE_RECORDED', 'DIALOGUE_MESSAGE', $3)
       RETURNING id`,
      [ids.familyId, ids.accountId, ids.caseId]
    );
    const { rows: newIdem } = await seedAdmin.query(
      `INSERT INTO idempotency_keys
         (actor_account_id, command_type, idempotency_key, request_hash,
          response_status, response_body)
       VALUES ($1, 'CASE_MESSAGE_CREATE', 'upgrade-message-key-1', $2, 201, '{}'::jsonb)
       RETURNING id`,
      [ids.accountId, 'b'.repeat(64)]
    );
    await seedAdmin.query('DELETE FROM business_audit_events WHERE id = $1', [
      newAudit[0].id,
    ]);
    await seedAdmin.query('DELETE FROM idempotency_keys WHERE id = $1', [
      newIdem[0].id,
    ]);
  }, 120_000);

  it('second application is a 0-new no-op with an unchanged object set', async () => {
    const before = await fingerprint(migrator);
    const output = runMigrator(upgradeUrl);
expect(output).toMatch(/Migration complete: 0 new, 12 previously applied\./);
    expect(output).not.toContain('APPLY 004_evidence_core.sql');
    expect(output).not.toContain('APPLY 004_identity_binding_runtime.sql');
    expect(output).not.toContain('APPLY 005_case_participant_core.sql');
    expect(output).not.toContain('APPLY 006_case_status_paused_removal.sql');
    expect(output).not.toContain('APPLY 007_case_primary_switch.sql');
    expect(await fingerprint(migrator)).toEqual(before);
  }, 120_000);
});

async function seed(client: Client): Promise<SeedIds> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const { rows: account } = await client.query(
    'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
    [`upgrade_${suffix}`]
  );
  const accountId = account[0].id;
  const { rows: person } = await client.query(
    'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
    [accountId]
  );
  const personId = person[0].id;
  const { rows: family } = await client.query(
    'INSERT INTO families (display_name, created_by_person_id) VALUES ($1, $2) RETURNING id',
    [`upgrade-${suffix}`, personId]
  );
  const familyId = family[0].id;
  await client.query(
    'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
    [familyId, personId]
  );
  await client.query(
    `INSERT INTO person_compliance_profiles
       (person_id, age_band, minor_mode, verified_source)
     VALUES ($1, 'ADULT', false, 'SELF_STATEMENT')`,
    [personId]
  );
  const { rows: profileValue } = await client.query(
    `INSERT INTO person_profile_values
       (person_id, attribute, value_text, source_kind, provided_by_person_id,
        recorded_by_account_id)
     VALUES ($1, 'DISPLAY_NAME', 'upgrade-fixture', 'SELF_STATEMENT', $1, $2)
     RETURNING id`,
    [personId, accountId]
  );
  const { rows: kase } = await client.query(
    `INSERT INTO cases
       (family_id, created_by_person_id, status, phase, is_primary, version)
     VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1)
     RETURNING id`,
    [familyId, personId]
  );
  const caseId = kase[0].id;
  const { rows: caseEvent } = await client.query(
    `INSERT INTO case_events (family_id, case_id, actor_account_id, event_type, metadata)
     VALUES ($1, $2, $3, 'CASE_CREATED', '{"primary":true,"version":1}'::jsonb)
     RETURNING id`,
    [familyId, caseId, accountId]
  );
  const { rows: auditEvent } = await client.query(
    `INSERT INTO business_audit_events
       (family_id, actor_account_id, event_type, resource_type, resource_id)
     VALUES ($1, $2, 'CASE_CREATED', 'CASE', $3)
     RETURNING id`,
    [familyId, accountId, caseId]
  );
  const { rows: idempotency } = await client.query(
    `INSERT INTO idempotency_keys
       (actor_account_id, command_type, idempotency_key, request_hash,
        response_status, response_body)
     VALUES ($1, 'CASE_CREATE', 'upgrade-case-key-1', $2, 201, '{}'::jsonb)
     RETURNING id`,
    [accountId, 'a'.repeat(64)]
  );
  return {
    accountId,
    personId,
    familyId,
    caseId,
    caseEventId: caseEvent[0].id,
    auditEventId: auditEvent[0].id,
    idempotencyId: idempotency[0].id,
    profileValueId: profileValue[0].id,
  };
}

async function counts(client: Client): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const [label, table] of [
    ['accounts', 'accounts'],
    ['persons', 'persons'],
    ['families', 'families'],
    ['familyMembers', 'family_members'],
    ['profileValues', 'person_profile_values'],
    ['complianceProfiles', 'person_compliance_profiles'],
    ['cases', 'cases'],
    ['caseEvents', 'case_events'],
    ['auditEvents', 'business_audit_events'],
    ['idempotencyKeys', 'idempotency_keys'],
  ] as const) {
    const { rows } = await client.query(`SELECT count(*)::int AS c FROM ${table}`);
    result[label] = rows[0].c;
  }
  return result;
}

async function fingerprint(client: Client): Promise<string> {
  const { rows } = await client.query(`
    SELECT kind || ':' || name AS entry FROM (
      SELECT 'enum' AS kind, t.typname AS name
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public' AND t.typtype = 'e'
      UNION ALL
      SELECT 'table', tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
      UNION ALL
      SELECT 'policy', policyname FROM pg_policies WHERE schemaname = 'public'
      UNION ALL
      SELECT 'trigger', tgname FROM pg_trigger WHERE NOT tgisinternal
    ) objects
    ORDER BY 1
  `);
  return rows.map((r: any) => r.entry).join('|');
}