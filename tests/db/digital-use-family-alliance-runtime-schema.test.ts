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

      const seed = await admin.query<{
        family_id: string;
        case_id: string;
        person_id: string;
      }>(
        `WITH account_row AS (
           INSERT INTO accounts (wechat_openid)
           VALUES ('slice13-rls-' || uuidv7()::text)
           RETURNING id
         ),
         person_row AS (
           INSERT INTO persons (account_id, created_by_account_id)
           SELECT id, id FROM account_row
           RETURNING id
         ),
         family_row AS (
           INSERT INTO families (created_by_person_id)
           SELECT id FROM person_row
           RETURNING id
         ),
         member_row AS (
           INSERT INTO family_members (family_id, person_id)
           SELECT family_row.id, person_row.id
             FROM family_row, person_row
           RETURNING family_id, person_id
         ),
         case_row AS (
           INSERT INTO cases
             (family_id, created_by_person_id, status, phase, is_primary, version)
           SELECT family_id, person_id, 'OPEN', 'GOALS', true, 1
             FROM member_row
           RETURNING id, family_id, created_by_person_id
         ),
         anchor_row AS (
           INSERT INTO scene_node_states
             (family_id, case_id, scene_package_version, node_code,
              source_node_code, status, branch_reason_codes, input_refs,
              output_refs, revision, completed_at)
           SELECT family_id, id, 'v1', 'A1001', 'A1001', 'COMPLETED',
                  ARRAY['RLS_FIXTURE'], '[]'::jsonb, '[]'::jsonb, 1, now()
             FROM case_row
           RETURNING case_id
         )
         SELECT case_row.family_id,
                case_row.id AS case_id,
                case_row.created_by_person_id AS person_id
           FROM case_row, anchor_row`
      );
      const valid = seed.rows[0]!;

      await expect(
        app.query(
          `INSERT INTO digital_use_target_items
             (family_id,case_id,scene_package_version,target_code,
              selection_revision,revision,selected,created_by_person_id)
           VALUES ($1,$2,'v1','SLEEP',1,1,true,$3)`,
          [valid.family_id, valid.case_id, valid.person_id]
        )
      ).rejects.toMatchObject({ code: '42501' });
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
