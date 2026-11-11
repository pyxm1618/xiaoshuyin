/**
 * T919 — migration / shared-contract reconciliation over the immutable Slice 9
 * audit range.
 *
 * Proves: Slice 9's own historical delta is exactly the one Slice 9 file and it
 * edited no pre-Slice-9 migration; the number is recomputed from the pre-merge
 * base (never assumed); a fresh database reproduces the full schema; a second
 * apply is a no-op; and no inherited CHECK literal was lost.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL']!;
const ROOT = new URL('../..', import.meta.url).pathname;
const SLICE9_MIGRATION = '009_safety_hold_control_foundation.sql';
// Slice 9 is audited over its immutable historical change range. A mutable
// "current main" reference cannot express it: after the merge the branch head
// and main are identical, so every main-relative delta is empty by construction.
const SLICE9_PRE_MERGE_BASE_SHA = '8e393c990be53c888c2e68d881bd8b23f9c37638';
const SLICE9_AUDITED_FEATURE_HEAD_SHA = '7b4f5796ef1c6ac1126f9b7bb687293df8a8ceef';
const SLICE9_HISTORICAL_RANGE = `${SLICE9_PRE_MERGE_BASE_SHA}..${SLICE9_AUDITED_FEATURE_HEAD_SHA}`;

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function isHistoricalMigrationEdit(record: string): boolean {
  return /^[MDRT]\t/.test(record);
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

  it('Slice 9 historical range 8e393c99..7b4f5796 adds exactly the one Slice 9 migration', () => {
    const baseFiles = git(['ls-tree', '--name-only', SLICE9_PRE_MERGE_BASE_SHA, 'db/migrations/'])
      .split('\n')
      .map((line) => line.replace('db/migrations/', '').trim())
      .filter(Boolean)
      .sort();
    const localFiles = readdirSync(join(ROOT, 'db/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    // The historical delta is the authoritative statement of what Slice 9 added.
    const historicalDelta = git([
      'diff',
      '--name-status',
      SLICE9_HISTORICAL_RANGE,
      '--',
      'db/migrations/',
    ])
      .split('\n')
      .filter(Boolean);
    expect(historicalDelta).toEqual([`A\tdb/migrations/${SLICE9_MIGRATION}`]);

    // The audited migration is present in the final repository and was not
    // silently edited after the audit.
    expect(existsSync(join(ROOT, 'db/migrations', SLICE9_MIGRATION))).toBe(true);
    expect(localFiles).toContain(SLICE9_MIGRATION);
    expect(git(['rev-parse', `HEAD:db/migrations/${SLICE9_MIGRATION}`])).toBe(
      git(['rev-parse', `${SLICE9_AUDITED_FEATURE_HEAD_SHA}:db/migrations/${SLICE9_MIGRATION}`])
    );

    // Nothing that existed before Slice 9 may disappear from the working tree.
    const removed = baseFiles.filter((name) => !localFiles.includes(name));
    expect(removed).toEqual([]);

    // The real next prefix is recomputed from the pre-merge base, never from the
    // mutable current main, so a later slice adding 010_*.sql cannot invalidate it.
    expect(baseFiles).not.toContain(SLICE9_MIGRATION);
    const highestPrefix = Math.max(
      ...baseFiles.map((name) => Number(name.slice(0, 3)))
    );
    const delta = Number(SLICE9_MIGRATION.slice(0, 3)) - highestPrefix;
    expect(delta).toBeGreaterThanOrEqual(1);
    expect(delta).toBeLessThanOrEqual(2); // at most one unused prefix (Slice 8)
    expect(baseFiles.map((name) => Number(name.slice(0, 3)))).not.toContain(
      Number(SLICE9_MIGRATION.slice(0, 3))
    );
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

  it('contains no historical migration edit in the audited range or the working tree', () => {
    // Inside the immutable range the ONLY permitted record is the addition of the
    // one reviewed Slice 9 file; no pre-Slice-9 migration may be modified,
    // renamed or deleted.
    const historicalDelta = git([
      'diff',
      '--name-status',
      SLICE9_HISTORICAL_RANGE,
      '--',
      'db/migrations/',
    ])
      .split('\n')
      .filter(Boolean);
    const rangeEdits = historicalDelta.filter(isHistoricalMigrationEdit);
    expect(rangeEdits, `historical migration edited inside ${SLICE9_HISTORICAL_RANGE}`).toEqual([]);
    expect(historicalDelta).toEqual([`A\tdb/migrations/${SLICE9_MIGRATION}`]);

    const baseFiles = git(['ls-tree', '--name-only', SLICE9_PRE_MERGE_BASE_SHA, 'db/migrations/'])
      .split('\n')
      .map((line) => line.replace('db/migrations/', '').trim())
      .filter(Boolean);

    // The working tree is measured against the pre-merge base, not against the
    // mutable current main, so a later slice's new migration is not a regression.
    const workingTreeDelta = git([
      'diff',
      '--name-status',
      SLICE9_PRE_MERGE_BASE_SHA,
      '--',
      'db/migrations/',
    ])
      .split('\n')
      .filter(Boolean);
    const workingTreeEdits = workingTreeDelta.filter((record) => {
      if (!isHistoricalMigrationEdit(record)) return false;
      const path = record.split('\t')[1] ?? '';
      return baseFiles.includes(path.replace('db/migrations/', ''));
    });
    expect(workingTreeEdits).toEqual([]);

    // An untracked migration is legal only as a later slice's new file; a
    // shadowing copy of a pre-Slice-9 filename is an edit attempt.
    const untracked = git(['ls-files', '--others', '--exclude-standard', 'db/migrations/'])
      .split('\n')
      .filter(Boolean);
    const shadowing = untracked.filter((path) =>
      baseFiles.includes(path.replace('db/migrations/', ''))
    );
    expect(shadowing).toEqual([]);

    // Future-slice tolerance control: the same predicate accepts a later addition
    // and still rejects an edit of a pre-Slice-9 migration.
    expect(isHistoricalMigrationEdit(`A\tdb/migrations/010_example.sql`)).toBe(false);
    expect(isHistoricalMigrationEdit('M\tdb/migrations/007_case_primary_switch.sql')).toBe(true);
  });
});