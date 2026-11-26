import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL']!;
const ROOT = new URL('../..', import.meta.url).pathname;
const TARGET = '039_final_bounded_remediation.sql';

function urlForDatabase(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

async function applySql(client: Client, filename: string): Promise<void> {
  await client.query(readFileSync(join(ROOT, 'db', 'migrations', filename), 'utf8'));
}

describe('Final bounded remediation 038 -> 039 upgrade', () => {
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

  it('upgrades the exact 038 schema to 039 without rewriting migration history', async () => {
    const database = `xiaoshuyin_039_upgrade_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    databases.push(database);
    await admin.query(`CREATE DATABASE "${database}" OWNER xiaoshuyin_migrator`);

    const client = new Client({ connectionString: urlForDatabase(MIGRATION_URL, database) });
    await client.connect();
    try {
      const files = readdirSync(join(ROOT, 'db', 'migrations'))
        .filter((filename) => filename.endsWith('.sql'))
        .sort();
      expect(files.at(-1)).toBe('040_consent_dependency_canonical_matching.sql');
      const before = files.filter((filename) => filename < TARGET);
      expect(before.at(-1)).toBe('038_phone_contract_child_participation_deferred_binding.sql');
      expect(before).toHaveLength(41);

      await client.query(`
        CREATE TABLE schema_migrations (
          filename text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      for (const filename of before) {
        await client.query('BEGIN');
        try {
          await applySql(client, filename);
          await client.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [filename]);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }

      const pre = await client.query<{ definition: string }>(
        `SELECT pg_get_functiondef('app.propagate_downstream_dependency_review(uuid,uuid,jsonb)'::regprocedure) AS definition`
      );
      expect(pre.rows[0]!.definition).toContain(
        "set_config('app.dependency_review_propagation', 'on', true)"
      );
      expect((await client.query(
        `SELECT to_regclass('app.dependency_review_propagation_authority') AS relation`
      )).rows[0].relation).toBeNull();

      await client.query('BEGIN');
      try {
        await applySql(client, TARGET);
        await client.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [TARGET]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }

      const migrated = await client.query<{ definition: string }>(
        `SELECT pg_get_functiondef('app.propagate_downstream_dependency_review(uuid,uuid,jsonb)'::regprocedure) AS definition`
      );
      expect(migrated.rows[0]!.definition).not.toContain(
        "set_config('app.dependency_review_propagation', 'on', true)"
      );
      expect(migrated.rows[0]!.definition).toContain(
        'dependency_review_propagation_authority'
      );
      expect(migrated.rows[0]!.definition).toContain('v_version_str IS NOT NULL');

      const family = await client.query<{ definition: string }>(
        `SELECT pg_get_functiondef('app.create_family(uuid,uuid,text)'::regprocedure) AS definition`
      );
      expect(family.rows[0]!.definition).toContain(
        'p_creator_person_id IS DISTINCT FROM v_person_id'
      );

      const privilege = await client.query<{ can_insert: boolean; can_update: boolean }>(
        `SELECT
           has_table_privilege('xiaoshuyin_app','app.dependency_review_propagation_authority','INSERT') AS can_insert,
           has_table_privilege('xiaoshuyin_app','app.dependency_review_propagation_authority','UPDATE') AS can_update`
      );
      expect(privilege.rows[0]).toEqual({ can_insert: false, can_update: false });

      const ledger = await client.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM schema_migrations'
      );
      expect(ledger.rows[0]!.count).toBe(42);

      // The new forward migration must also apply over the verified 039 state.
      const forward = '040_consent_dependency_canonical_matching.sql';
      await client.query('BEGIN');
      try {
        await applySql(client, forward);
        await client.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [forward]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      const canonical = await client.query<{ definition: string }>(
        `SELECT pg_get_functiondef('app.propagate_downstream_dependency_review(uuid,uuid,jsonb)'::regprocedure) AS definition`
      );
      expect(canonical.rows[0]!.definition).toContain('app.consent_dependency_matches');
      expect((await client.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count).toBe(43);
    } finally {
      await client.end();
    }
  }, 240_000);
});
