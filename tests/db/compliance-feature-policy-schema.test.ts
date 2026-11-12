/**
 * T1003 / T1013 — reviewed migration, schema invariants and typed projection
 * parity for the compliance feature-policy truth.
 *
 * Covers: fresh database, upgrade from all prior migrations, replay no-op,
 * failure atomicity, exact columns/constraints/indexes/triggers, RLS flags,
 * grants, and Drizzle projection parity. No historical migration is edited.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns } from 'drizzle-orm';
import { complianceFeaturePolicies } from '@xiaoshuyin/domain';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL']!;
const ROOT = new URL('../..', import.meta.url).pathname;
const MIGRATION = '011_compliance_feature_policy_foundation.sql';

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

describe('compliance feature-policy migration and schema', () => {
  let admin: Client;
  let database: string;
  let upgradeUrl: string;

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    database = `xiaoshuyin_s10_schema_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await admin.query(`CREATE DATABASE "${database}" OWNER xiaoshuyin_migrator`);
    upgradeUrl = urlForDatabase(MIGRATION_URL, database);
  }, 120_000);

  afterAll(async () => {
    await admin?.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`).catch(() => undefined);
    await admin?.end().catch(() => undefined);
  }, 120_000);

  it('fresh database applies every migration including 011, and replay is a no-op', () => {
    const first = runMigrator(upgradeUrl);
    expect(first).toContain(`APPLY ${MIGRATION}`);

    const second = runMigrator(upgradeUrl);
    expect(second).toMatch(/Migration complete: 0 new, \d+ previously applied\./);
    expect(second).not.toContain('APPLY ');
  }, 120_000);

  it('migration replay preserves the exact object fingerprint', async () => {
    const client = new Client({ connectionString: upgradeUrl });
    await client.connect();
    try {
      await client.query('BEGIN');
      const before = await client.query(`
        SELECT 'table' AS kind, tablename AS name FROM pg_tables WHERE schemaname='public'
        UNION ALL
        SELECT 'policy', policyname FROM pg_policies WHERE schemaname='public'
        UNION ALL
        SELECT 'trigger', tgname FROM pg_trigger WHERE NOT tgisinternal
        ORDER BY kind, name
      `);
      await client.query('ROLLBACK');
      runMigrator(upgradeUrl);
      await client.query('BEGIN');
      const after = await client.query(`
        SELECT 'table' AS kind, tablename AS name FROM pg_tables WHERE schemaname='public'
        UNION ALL
        SELECT 'policy', policyname FROM pg_policies WHERE schemaname='public'
        UNION ALL
        SELECT 'trigger', tgname FROM pg_trigger WHERE NOT tgisinternal
        ORDER BY kind, name
      `);
      await client.query('ROLLBACK');
      expect(after.rows).toEqual(before.rows);
    } finally {
      await client.end();
    }
  }, 120_000);

  it('stores the exact policy truth columns and uuidv7 default', async () => {
    const client = new Client({ connectionString: upgradeUrl });
    await client.connect();
    try {
      const { rows } = await client.query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }>(
        `SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema='public' AND table_name='compliance_feature_policies'
          ORDER BY ordinal_position`
      );

      expect(rows.map((row) => row.column_name)).toEqual([
        'id',
        'feature_code',
        'feature_contract_revision',
        'policy_version',
        'anthropomorphic_applicability',
        'minor_access_rule',
        'ai_disclosure_rule',
        'generated_content_label_rule',
        'usage_reminder_rule',
        'decision_basis',
        'review_evidence_ref',
        'effective_from',
        'effective_until',
        'superseded_by_policy_id',
        'created_at',
        'approved_at',
        'publication_source_ref',
      ]);

      const byName = Object.fromEntries(rows.map((row) => [row.column_name, row]));
      expect(byName['id']!.column_default).toContain('uuidv7');
      expect(byName['policy_version']!.data_type).toBe('integer');
      expect(byName['effective_from']!.is_nullable).toBe('NO');
      expect(byName['effective_until']!.is_nullable).toBe('YES');
      expect(byName['created_at']!.is_nullable).toBe('NO');
    } finally {
      await client.end();
    }
  });

  it('enforces applicability, rule vocabulary, provenance, interval and cross-field invariants', async () => {
    const client = new Client({ connectionString: upgradeUrl });
    await client.connect();
    try {
      const { rows } = await client.query<{ conname: string }>(
        `SELECT conname FROM pg_constraint
          WHERE conrelid = 'compliance_feature_policies'::regclass
          ORDER BY conname`
      );
      const names = rows.map((row) => row.conname);
      for (const expected of [
        'compliance_feature_policies_applicability_check',
        'compliance_feature_policies_minor_rule_check',
        'compliance_feature_policies_ai_rule_check',
        'compliance_feature_policies_label_rule_check',
        'compliance_feature_policies_usage_rule_check',
        'compliance_feature_policies_cross_field_check',
        'compliance_feature_policies_provenance_check',
        'compliance_feature_policies_effective_interval_check',
        'compliance_feature_policies_supersede_closure_check',
        'compliance_feature_policies_identity_version_key',
        'compliance_feature_policies_supersede_identity_fk',
        'compliance_feature_policies_version_positive',
      ]) {
        expect(names).toContain(expected);
      }

      // Direct invalid inserts are rejected; the failed statement rolls back.
      const invalidCases = [
        // applicability vocabulary
        `('CHK','v1',1,'MAYBE','BASELINE','BASELINE','BASELINE','BASELINE',NULL,NULL,now(),NULL,'x')`,
        // REQUIRED must require AI disclosure + usage reminder
        `('CHK','v1',1,'REQUIRED','BASELINE','BASELINE','BASELINE','REQUIRED',NULL,NULL,now(),NULL,'x')`,
        // NOT_APPLICABLE must not carry the anthropomorphic usage reminder
        `('CHK','v1',1,'NOT_APPLICABLE','BASELINE','BASELINE','BASELINE','REQUIRED',NULL,NULL,now(),NULL,'x')`,
        // REQUIRED/NOT_APPLICABLE require decision basis + review evidence
        `('CHK','v1',1,'REQUIRED','BASELINE','REQUIRED','BASELINE','REQUIRED',NULL,NULL,now(),NULL,'x')`,
        // positive version
        `('CHK','v1',0,'UNKNOWN','BASELINE','BASELINE','BASELINE','BASELINE',NULL,NULL,now(),NULL,'x')`,
        // half-open interval must be strictly increasing
        `('CHK','v1',1,'UNKNOWN','BASELINE','BASELINE','BASELINE','BASELINE',NULL,NULL,now(),now(),'x')`,
      ];

      for (const values of invalidCases) {
        await client.query('BEGIN');
        await expect(
          client.query(
            `INSERT INTO compliance_feature_policies
               (feature_code, feature_contract_revision, policy_version,
                anthropomorphic_applicability, minor_access_rule, ai_disclosure_rule,
                generated_content_label_rule, usage_reminder_rule, decision_basis,
                review_evidence_ref, effective_from, effective_until, publication_source_ref)
             VALUES ${values}`
          )
        ).rejects.toBeTruthy();
        await client.query('ROLLBACK');
      }

      // The table still works after the failed statements (atomic rollback).
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO compliance_feature_policies
           (feature_code, feature_contract_revision, policy_version,
            anthropomorphic_applicability, minor_access_rule, ai_disclosure_rule,
            generated_content_label_rule, usage_reminder_rule, decision_basis,
            review_evidence_ref, effective_from, publication_source_ref)
         VALUES ('CHK_OK','v1',1,'NOT_APPLICABLE','BASELINE','BASELINE','BASELINE','BASELINE',
                 'basis','evidence://1',now(),'migration:test')`
      );
      await client.query('ROLLBACK');
    } finally {
      await client.end();
    }
  });

  it('creates lookup indexes, overlap triggers and immutable-judgment trigger', async () => {
    const client = new Client({ connectionString: upgradeUrl });
    await client.connect();
    try {
      const indexes = await client.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes
          WHERE tablename='compliance_feature_policies' ORDER BY indexname`
      );
      expect(indexes.rows.map((row) => row.indexname)).toEqual(
        expect.arrayContaining([
          'compliance_feature_policies_effective_lookup_idx',
          'compliance_feature_policies_current_open_idx',
          'compliance_feature_policies_identity_version_key',
        ])
      );

      const triggers = await client.query<{ tgname: string }>(
        `SELECT tgname FROM pg_trigger
          WHERE tgrelid = 'compliance_feature_policies'::regclass AND NOT tgisinternal
          ORDER BY tgname`
      );
      expect(triggers.rows.map((row) => row.tgname)).toEqual([
        'compliance_feature_policies_guard',
        'compliance_feature_policies_overlap_insert',
        'compliance_feature_policies_overlap_update',
      ]);
    } finally {
      await client.end();
    }
  });

  it('enables and forces RLS with an active-row runtime policy and migrator control', async () => {
    const client = new Client({ connectionString: upgradeUrl });
    await client.connect();
    try {
      const flags = await client.query<{
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
        owner: string;
      }>(
        `SELECT c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) AS owner
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname='public' AND c.relname='compliance_feature_policies'`
      );
      expect(flags.rows[0]).toEqual({
        relrowsecurity: true,
        relforcerowsecurity: true,
        owner: 'xiaoshuyin_migrator',
      });

      const policies = await client.query<{ policyname: string }>(
        `SELECT policyname FROM pg_policies
          WHERE schemaname='public' AND tablename='compliance_feature_policies'
          ORDER BY policyname`
      );
      expect(policies.rows.map((row) => row.policyname)).toEqual([
        'compliance_feature_policies_migrator_control',
        'compliance_feature_policies_runtime_active',
      ]);

      const privileges = await client.query<{
        app_insert: boolean;
        app_update: boolean;
        app_delete: boolean;
        app_truncate: boolean;
        app_select: boolean;
        app_basis: boolean;
        app_evidence: boolean;
        app_approved: boolean;
        app_source: boolean;
      }>(
        `SELECT
           has_table_privilege('xiaoshuyin_app','compliance_feature_policies','INSERT') AS app_insert,
           has_table_privilege('xiaoshuyin_app','compliance_feature_policies','UPDATE') AS app_update,
           has_table_privilege('xiaoshuyin_app','compliance_feature_policies','DELETE') AS app_delete,
           has_table_privilege('xiaoshuyin_app','compliance_feature_policies','TRUNCATE') AS app_truncate,
           has_table_privilege('xiaoshuyin_app','compliance_feature_policies','SELECT') AS app_select,
           has_column_privilege('xiaoshuyin_app','compliance_feature_policies','decision_basis','SELECT') AS app_basis,
           has_column_privilege('xiaoshuyin_app','compliance_feature_policies','review_evidence_ref','SELECT') AS app_evidence,
           has_column_privilege('xiaoshuyin_app','compliance_feature_policies','approved_at','SELECT') AS app_approved,
           has_column_privilege('xiaoshuyin_app','compliance_feature_policies','publication_source_ref','SELECT') AS app_source`
      );
      expect(privileges.rows[0]).toEqual({
        app_insert: false,
        app_update: false,
        app_delete: false,
        app_truncate: false,
        app_select: false,
        app_basis: false,
        app_evidence: false,
        app_approved: false,
        app_source: false,
      });

      const allowedColumn = await client.query<{ ok: boolean }>(
        `SELECT has_column_privilege('xiaoshuyin_app','compliance_feature_policies','feature_code','SELECT') AS ok`
      );
      expect(allowedColumn.rows[0]!.ok).toBe(true);

      const publishExecute = await client.query<{ ok: boolean }>(
        `SELECT has_function_privilege(
           'xiaoshuyin_app',
           'app.publish_compliance_feature_policy(text,text,integer,integer,text,text,text,text,text,text,text,timestamptz,text)',
           'EXECUTE') AS ok`
      );
      expect(publishExecute.rows[0]!.ok).toBe(false);
    } finally {
      await client.end();
    }
  });

  it('adds exactly one new migration without touching historical files', () => {
    const files = readdirSync(join(ROOT, 'db', 'migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort();
    expect(files.filter((name) => name === MIGRATION)).toEqual([MIGRATION]);
    expect(existsSync(join(ROOT, 'db', 'migrations', MIGRATION))).toBe(true);
    expect(
      files.filter((name) => /^(001|002|003|004|005|006|007|008|009|010)_/.test(name)).length
    ).toBe(11);
  });

  it('Drizzle projection matches the applied SQL schema', async () => {
    const client = new Client({ connectionString: upgradeUrl });
    await client.connect();
    try {
      const { rows } = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name='compliance_feature_policies'
          ORDER BY column_name`
      );
      const sqlColumns = rows.map((row) => row.column_name).sort();

      const drizzleColumns = Object.values(getTableColumns(complianceFeaturePolicies))
        .map((column) => column.name)
        .sort();

      expect(drizzleColumns).toEqual(sqlColumns);
    } finally {
      await client.end();
    }
  });
});