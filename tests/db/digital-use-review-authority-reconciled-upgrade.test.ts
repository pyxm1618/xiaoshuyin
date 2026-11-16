import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL']!;
const ROOT = new URL('../..', import.meta.url).pathname;
const TARGET = '023_digital_use_review_runtime_authority_reconciled.sql';

function urlForDatabase(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

async function applySql(client: Client, filename: string): Promise<void> {
  const sql = readFileSync(join(ROOT, 'db', 'migrations', filename), 'utf8');
  await client.query(sql);
}

async function constraintDefinitions(client: Client) {
  const { rows } = await client.query<{ conname: string; definition: string }>(
    `SELECT conname,pg_get_constraintdef(oid,true) AS definition
       FROM pg_constraint
      WHERE conrelid='scene_artifacts'::regclass
        AND conname = ANY($1::text[])
      ORDER BY conname`,
    [[
      'scene_artifacts_type_check',
      'scene_artifacts_source_node_check',
      'scene_artifacts_type_source_check',
    ]]
  );
  return Object.fromEntries(rows.map((row) => [row.conname, row.definition]));
}

describe('Slice 15 022 -> 023 review runtime migration upgrade', () => {
  let admin: Client;
  const databases: string[] = [];

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
  }, 60_000);

  afterAll(async () => {
    for (const database of databases) {
      await admin.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',
        [database]
      ).catch(() => undefined);
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`).catch(() => undefined);
    }
    await admin.end().catch(() => undefined);
  }, 120_000);

  it('upgrades the then-current migration head additively without a second Review owner', async () => {
    const database =
      `xiaoshuyin_slice15_upgrade_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    databases.push(database);
    await admin.query(`CREATE DATABASE "${database}" OWNER xiaoshuyin_migrator`);

    const client = new Client({
      connectionString: urlForDatabase(MIGRATION_URL, database),
    });
    await client.connect();
    try {
      const files = readdirSync(join(ROOT, 'db', 'migrations'))
        .filter((filename) => filename.endsWith('.sql'))
        .sort();
      expect(files).toContain(TARGET);
      const targetIndex = files.indexOf(TARGET);
      expect(targetIndex).toBeGreaterThan(0);
      const before = files.slice(0, targetIndex);
      expect(before.at(-1)).toBe(
        '022_foundation_remaining_consent_chain_integrity.sql'
      );

      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename   text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      for (const filename of before) {
        await client.query('BEGIN');
        try {
          await applySql(client, filename);
          await client.query(
            'INSERT INTO schema_migrations (filename) VALUES ($1)',
            [filename]
          );
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }

      const prior = await constraintDefinitions(client);
      expect(Object.keys(prior)).toHaveLength(3);
      expect(prior['scene_artifacts_type_check'])
        .not.toContain('DIGITAL_USE_A5001_EFFECT_EVALUATION');
      expect(prior['scene_artifacts_type_check'])
        .not.toContain('DIGITAL_USE_A5002_EFFECT_EVALUATION');
      expect(prior['scene_artifacts_source_node_check']).not.toMatch(/A500[12]/);

      const existingTables = await client.query<{ relname: string }>(
        `SELECT c.relname
           FROM pg_class c
           JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r'
          ORDER BY c.relname`
      );
      const tableNamesBefore = existingTables.rows.map((row) => row.relname);

      await applySql(client, TARGET);

      const after = await constraintDefinitions(client);
      expect(after['scene_artifacts_type_check'])
        .toContain('DIGITAL_USE_A5001_EFFECT_EVALUATION');
      expect(after['scene_artifacts_type_check'])
        .toContain('DIGITAL_USE_A5002_EFFECT_EVALUATION');
      expect(after['scene_artifacts_source_node_check']).toContain('A5001');
      expect(after['scene_artifacts_source_node_check']).toContain('A5002');
      expect(after['scene_artifacts_type_source_check'])
        .toContain('DIGITAL_USE_A5001_EFFECT_EVALUATION');
      expect(after['scene_artifacts_type_source_check'])
        .toContain('DIGITAL_USE_A5002_EFFECT_EVALUATION');

      const upgradedTables = await client.query<{ relname: string }>(
        `SELECT c.relname
           FROM pg_class c
           JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r'
          ORDER BY c.relname`
      );
      expect(upgradedTables.rows.map((row) => row.relname)).toEqual(
        tableNamesBefore
      );
      expect(tableNamesBefore).not.toEqual(
        expect.arrayContaining([
          'reviews',
          'professional_packages',
          'reviewers',
          'scheduled_reviews',
        ])
      );
    } finally {
      await client.end();
    }
  }, 180_000);
});
