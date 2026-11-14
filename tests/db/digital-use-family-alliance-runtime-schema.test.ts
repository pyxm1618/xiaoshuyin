import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { digitalUseTargetItems } from '@xiaoshuyin/domain';
import { createAdminPool } from '../setup/db.js';

const APP_URL = process.env['DATABASE_URL']!;

describe('T1303/T1305 Digital Use Family Alliance target persistence', () => {
  let admin: pg.Pool;

  beforeAll(() => {
    admin = createAdminPool();
  });

  afterAll(async () => {
    await admin.end();
  });

  it('projects migrated target columns exactly', async () => {
    const { rows } = await admin.query<{
      name: string;
      sql_type: string;
      not_null: boolean;
    }>(
      `SELECT a.attname AS name,
              format_type(a.atttypid, a.atttypmod) AS sql_type,
              a.attnotnull AS not_null
         FROM pg_attribute a
        WHERE a.attrelid = 'public.digital_use_target_items'::regclass
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY a.attnum`
    );
    const projected = getTableConfig(digitalUseTargetItems).columns.map((column) => ({
      name: column.name,
      sql_type: column.getSQLType(),
      not_null: column.notNull,
    }));
    expect(rows).toEqual(projected);
  });

  it('enables and forces RLS with exactly one family-scope policy', async () => {
    const { rows } = await admin.query<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `SELECT relrowsecurity, relforcerowsecurity
         FROM pg_class
        WHERE relname='digital_use_target_items'
          AND relnamespace='public'::regnamespace`
    );
    expect(rows).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }]);

    const policies = await admin.query<{ policyname: string; qual: string; with_check: string }>(
      `SELECT policyname, qual, with_check
         FROM pg_policies
        WHERE schemaname='public'
          AND tablename='digital_use_target_items'`
    );
    expect(policies.rows).toHaveLength(1);
    expect(policies.rows[0]!.policyname).toBe('digital_use_target_items_family_scope');
    expect(policies.rows[0]!.qual).toMatch(/family_id = app_family_id\(\)/);
    expect(policies.rows[0]!.with_check).toMatch(/family_id = app_family_id\(\)/);
  });

  it('grants only SELECT/INSERT and superseded_at lifecycle UPDATE; never DELETE/TRUNCATE', async () => {
    const { rows } = await admin.query<Record<string, boolean>>(
      `SELECT
        has_table_privilege('xiaoshuyin_app','digital_use_target_items','SELECT') AS can_select,
        has_table_privilege('xiaoshuyin_app','digital_use_target_items','INSERT') AS can_insert,
        has_table_privilege('xiaoshuyin_app','digital_use_target_items','UPDATE') AS can_update_table,
        has_table_privilege('xiaoshuyin_app','digital_use_target_items','DELETE') AS can_delete,
        has_table_privilege('xiaoshuyin_app','digital_use_target_items','TRUNCATE') AS can_truncate,
        has_column_privilege('xiaoshuyin_app','digital_use_target_items','superseded_at','UPDATE') AS can_supersede,
        has_column_privilege('xiaoshuyin_app','digital_use_target_items','selected','UPDATE') AS can_rewrite_selected`
    );
    expect(rows[0]).toEqual({
      can_select: true,
      can_insert: true,
      can_update_table: false,
      can_delete: false,
      can_truncate: false,
      can_supersede: true,
      can_rewrite_selected: false,
    });
  });

  it('owns the partial current key, immutable revision guards and package anchor guard', async () => {
    const indexes = await admin.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef
         FROM pg_indexes
        WHERE schemaname='public'
          AND tablename='digital_use_target_items'`
    );
    const current = indexes.rows.find(
      (row) => row.indexname === 'digital_use_target_items_current_key'
    );
    expect(current?.indexdef).toMatch(/UNIQUE/);
    expect(current?.indexdef).toMatch(/WHERE \(superseded_at IS NULL\)/);

    const triggers = await admin.query<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger
        WHERE NOT tgisinternal
          AND tgrelid='digital_use_target_items'::regclass
        ORDER BY tgname`
    );
    expect(triggers.rows.map((row) => row.tgname)).toEqual([
      'digital_use_target_items_insert_guard',
      'digital_use_target_items_update_guard',
    ]);
  });

  it('app role remains NOBYPASSRLS and no context can neither see nor write targets', async () => {
    const role = await admin.query<{ rolbypassrls: boolean }>(
      `SELECT rolbypassrls FROM pg_roles WHERE rolname='xiaoshuyin_app'`
    );
    expect(role.rows).toEqual([{ rolbypassrls: false }]);

    const app = new pg.Client({ connectionString: APP_URL });
    await app.connect();
    try {
      const visible = await app.query(
        'SELECT count(*)::int AS n FROM digital_use_target_items'
      );
      expect(visible.rows[0]!.n).toBe(0);

      await expect(
        app.query(
          `INSERT INTO digital_use_target_items
             (family_id,case_id,scene_package_version,target_code,
              selection_revision,revision,selected,created_by_person_id)
           VALUES (uuidv7(),uuidv7(),'v1','SLEEP',1,1,true,uuidv7())`
        )
      ).rejects.toThrow();
    } finally {
      await app.end();
    }
  });

  it('does not create forbidden Family Alliance or Phase-4 persistence', async () => {
    const { rows } = await admin.query<{ relname: string }>(
      `SELECT relname FROM pg_class
        WHERE relnamespace='public'::regnamespace
          AND relkind='r'
          AND relname = ANY($1::text[])`,
      [['family_alliance_answers','goals','tasks','checkins','outcomes','plan_versions']]
    );
    expect(rows).toEqual([]);
  });
});
