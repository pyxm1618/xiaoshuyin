import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { sceneArtifacts, sceneNodeStates } from '@xiaoshuyin/domain';
import { createAdminPool } from '../setup/db.js';

describe('T1203 Digital Use Scene persistence', () => {
  let admin: pg.Pool;

  beforeAll(() => {
    admin = createAdminPool();
  });

  afterAll(async () => {
    await admin.end();
  });

  it('projects the migrated columns exactly', async () => {
    for (const [tableName, table] of [
      ['scene_node_states', sceneNodeStates],
      ['scene_artifacts', sceneArtifacts],
    ] as const) {
      const { rows } = await admin.query<{ name: string; sql_type: string; not_null: boolean }>(
        `SELECT a.attname AS name,
                format_type(a.atttypid, a.atttypmod) AS sql_type,
                a.attnotnull AS not_null
           FROM pg_attribute a
          WHERE a.attrelid = $1::regclass
            AND a.attnum > 0
            AND NOT a.attisdropped
          ORDER BY a.attnum`,
        [`public.${tableName}`]
      );
      const projected = getTableConfig(table).columns.map((column) => ({
        name: column.name,
        sql_type: column.getSQLType(),
        not_null: column.notNull,
      }));
      expect(rows).toEqual(projected);
    }
  });

  it('enables and forces family-scoped RLS on both tables', async () => {
    const { rows } = await admin.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `SELECT relname, relrowsecurity, relforcerowsecurity
         FROM pg_class
        WHERE relname IN ('scene_node_states','scene_artifacts')
        ORDER BY relname`
    );
    expect(rows).toEqual([
      { relname: 'scene_artifacts', relrowsecurity: true, relforcerowsecurity: true },
      { relname: 'scene_node_states', relrowsecurity: true, relforcerowsecurity: true },
    ]);

    const policies = await admin.query<{ tablename: string; policyname: string }>(
      `SELECT tablename, policyname FROM pg_policies
        WHERE schemaname='public'
          AND tablename IN ('scene_node_states','scene_artifacts')
        ORDER BY tablename`
    );
    expect(policies.rows).toEqual([
      { tablename: 'scene_artifacts', policyname: 'scene_artifacts_family_scope' },
      { tablename: 'scene_node_states', policyname: 'scene_node_states_family_scope' },
    ]);
  });

  it('keeps artifacts append-only and node updates column-limited', async () => {
    const { rows } = await admin.query<Record<string, boolean>>(
      `SELECT
        has_table_privilege('xiaoshuyin_app','scene_artifacts','SELECT') AS artifact_select,
        has_table_privilege('xiaoshuyin_app','scene_artifacts','INSERT') AS artifact_insert,
        has_table_privilege('xiaoshuyin_app','scene_artifacts','UPDATE') AS artifact_update,
        has_table_privilege('xiaoshuyin_app','scene_artifacts','DELETE') AS artifact_delete,
        has_table_privilege('xiaoshuyin_app','scene_node_states','SELECT') AS state_select,
        has_table_privilege('xiaoshuyin_app','scene_node_states','INSERT') AS state_insert,
        has_table_privilege('xiaoshuyin_app','scene_node_states','DELETE') AS state_delete,
        has_column_privilege('xiaoshuyin_app','scene_node_states','revision','UPDATE') AS state_revision_update,
        has_column_privilege('xiaoshuyin_app','scene_node_states','scene_package_version','UPDATE') AS state_package_update`
    );
    expect(rows[0]).toEqual({
      artifact_select: true,
      artifact_insert: true,
      artifact_update: false,
      artifact_delete: false,
      state_select: true,
      state_insert: true,
      state_delete: false,
      state_revision_update: true,
      state_package_update: false,
    });
  });

  it('has hard A200401, revision, refs, artifact-class and package-binding constraints', async () => {
    const { rows } = await admin.query<{ table_name: string; constraint_name: string }>(
      `SELECT table_name, constraint_name
         FROM information_schema.table_constraints
        WHERE table_schema='public'
          AND table_name IN ('scene_node_states','scene_artifacts')
        ORDER BY table_name, constraint_name`
    );
    const names = rows.map((row) => row.constraint_name);
    for (const expected of [
      'scene_node_states_case_family_fk',
      'scene_node_states_case_node_key',
      'scene_node_states_node_code_check',
      'scene_node_states_revision_check',
      'scene_node_states_refs_shape_check',
      'scene_artifacts_case_family_fk',
      'scene_artifacts_owner_family_fk',
      'scene_artifacts_type_check',
      'scene_artifacts_type_source_check',
      'scene_artifacts_refs_shape_check',
      'scene_artifacts_supersedes_same_case_fk',
    ]) {
      expect(names).toContain(expected);
    }

    const triggers = await admin.query<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger
        WHERE NOT tgisinternal
          AND tgname IN ('scene_node_states_guard','scene_artifacts_insert_guard')
        ORDER BY tgname`
    );
    expect(triggers.rows.map((row) => row.tgname)).toEqual([
      'scene_artifacts_insert_guard',
      'scene_node_states_guard',
    ]);
  });
});
