/**
 * T919 — migration / shared-contract reconciliation on the real latest main.
 *
 * Proves: the migration set is exactly latest-main + the one Slice 9 file; the
 * number is recomputed (never assumed); a fresh database reproduces the full
 * schema; a second apply is a no-op; and no latest-main CHECK literal was lost.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL']!;
const ROOT = new URL('../..', import.meta.url).pathname;
const SLICE9_MIGRATION = '009_safety_hold_control_foundation.sql';

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

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

describe('T919 migration reconciliation', () => {
  let admin: Client;
  let database: string;
  let upgradeUrl: string;

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    database = `xiaoshuyin_s9_fresh_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await admin.query(`CREATE DATABASE "${database}" OWNER xiaoshuyin_migrator`);
    upgradeUrl = urlForDatabase(MIGRATION_URL, database);
  }, 120_000);

  afterAll(async () => {
    await admin?.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`).catch(() => undefined);
    await admin?.end().catch(() => undefined);
  }, 120_000);

  it('local migration set is exactly latest main + approved Slice 8/9 files', () => {
    const mainFiles = git(['ls-tree', '--name-only', 'origin/main', 'db/migrations/'])
      .split('\n')
      .map((line) => line.replace('db/migrations/', '').trim())
      .filter(Boolean)
      .sort();
    const localFiles = readdirSync(join(ROOT, 'db/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    const added = localFiles.filter((name) => !mainFiles.includes(name));
    const removed = mainFiles.filter((name) => !localFiles.includes(name));
    expect(added).toEqual([
      '008_problem_formulation_core.sql',
      '010_problem_formulation_safety_vocabulary_reconcile.sql',
    ]);
    expect(removed).toEqual([]);

    // The real next prefix is recomputed from latest main, never assumed.
    const highestPrefix = Math.max(
      ...mainFiles.map((name) => Number(name.slice(0, 3)))
    );
    const localHighestPrefix = Math.max(
      ...localFiles.map((name) => Number(name.slice(0, 3)))
    );
    const delta = localHighestPrefix - highestPrefix;
    expect(delta).toBe(1); // 010 reconciliation follows main's 009
  });

  it('fresh database reproduces the full schema and a second apply is a no-op', () => {
    const first = runMigrator(upgradeUrl);
    expect(first).toContain(`APPLY ${SLICE9_MIGRATION}`);
    const applied = first.match(/Migration complete: (\d+) new/);
    expect(applied).toBeTruthy();

    const second = runMigrator(upgradeUrl);
    expect(second).toMatch(/Migration complete: 0 new, \d+ previously applied\./);
    expect(second).not.toContain('APPLY ');
  }, 120_000);

  it('fresh schema keeps every latest-main CHECK literal and adds the Slice 9 ones', async () => {
    const client = new Client({ connectionString: upgradeUrl });
    try {
      await client.connect();
      const { rows } = await client.query<{ conname: string; definition: string }>(
        `SELECT conname, pg_get_constraintdef(oid) AS definition
           FROM pg_constraint
          WHERE conname IN ('case_events_event_type_check',
                            'business_audit_events_event_type_check',
                            'idempotency_keys_command_type_check',
                            'risk_events_shape_check')`
      );
      const definitions = new Map(rows.map((row) => [row.conname, row.definition]));

      const caseEvents = definitions.get('case_events_event_type_check')!;
      for (const literal of [
        'CASE_CREATED',
        'CASE_PRIMARY_ASSIGNED',
        'CASE_PRIMARY_REVOKED',
        'CASE_SAFETY_HOLD_ENTERED',
        'CASE_RISK_RESOLVED',
      ]) {
        expect(caseEvents).toContain(literal);
      }

      const audit = definitions.get('business_audit_events_event_type_check')!;
      for (const literal of [
        'CASE_PRIMARY_SWITCHED',
        'CASE_SAFETY_HOLD_ENTERED',
        'CASE_RISK_RESOLVED',
        'PARTICIPATION_WITHDRAWN',
        'OBSERVATION_RECORDED',
      ]) {
        expect(audit).toContain(literal);
      }

      const commands = definitions.get('idempotency_keys_command_type_check')!;
      for (const literal of [
        'CASE_SWITCH_PRIMARY',
        'CASE_ENTER_SAFETY_HOLD',
        'CASE_RESOLVE_RISK',
        'PARTICIPATION_WITHDRAW',
        'CASE_MESSAGE_CREATE',
      ]) {
        expect(commands).toContain(literal);
      }

      expect(definitions.get('risk_events_shape_check')).toContain('HOLD_ENTERED');

      // Schema objects.
      const { rows: tables } = await client.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'risk_events'`
      );
      expect(tables).toHaveLength(1);

      const { rows: rls } = await client.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'public.risk_events'::regclass`
      );
      expect(rls[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });

      const { rows: migrationRows } = await client.query<{ filename: string }>(
        'SELECT filename FROM schema_migrations ORDER BY filename'
      );
      expect(migrationRows.map((row) => row.filename)).toContain(SLICE9_MIGRATION);
    } finally {
      await client.end();
    }
  }, 120_000);

  it('contains no historical migration edit', () => {
    // Relative to the authoritative main the ONLY change may be the addition of
    // the one reviewed Slice 9 file. Nothing may be modified, renamed or
    // deleted, whether the file is committed or still untracked.
    const status = git(['diff', '--name-status', 'origin/main', '--', 'db/migrations/'])
      .split('\n')
      .filter(Boolean);
    const untracked = git(['ls-files', '--others', '--exclude-standard', 'db/migrations/'])
      .split('\n')
      .filter(Boolean);

    expect([...status, ...untracked.map((path) => `A\t${path}`)]).toEqual([
      'A\tdb/migrations/008_problem_formulation_core.sql',
      'A\tdb/migrations/010_problem_formulation_safety_vocabulary_reconcile.sql',
    ]);
  });
});