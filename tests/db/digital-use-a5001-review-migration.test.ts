import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { createAdminPool } from '../setup/db.js';

describe('Slice 15 A5001 additive Scene Artifact migration', () => {
  let admin: pg.Pool;

  beforeAll(() => {
    admin = createAdminPool();
  });

  afterAll(async () => {
    await admin.end();
  });

  it('extends only the authoritative Scene Artifact vocabulary for A5001', async () => {
    const { rows } = await admin.query<{ conname: string; definition: string }>(
      `SELECT conname, pg_get_constraintdef(oid, true) AS definition
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
    expect(rows).toHaveLength(3);
    const defs = Object.fromEntries(rows.map((row) => [row.conname, row.definition]));
    expect(defs['scene_artifacts_type_check']).toContain(
      'DIGITAL_USE_A5001_EFFECT_EVALUATION'
    );
    expect(defs['scene_artifacts_source_node_check']).toContain('A5001');
    expect(defs['scene_artifacts_type_source_check']).toContain(
      'DIGITAL_USE_A5001_EFFECT_EVALUATION'
    );
    expect(defs['scene_artifacts_type_source_check']).toContain('A5001');

    // Existing authoritative Slice 12/13 vocabulary remains valid.
    for (const token of [
      'SUPPLEMENTAL_ASSESSMENT_BOUNDARY',
      'TIMELINE',
      'SOLUTION_SUMMARY',
      'FAMILY_ALLIANCE_SELF_ASSESSMENT',
      'A3000',
    ]) {
      expect(Object.values(defs).join('\n')).toContain(token);
    }
  });

  it('adds no Review table, policy, grant, A5002 or Slice 14 business vocabulary', async () => {
    const sql = readFileSync(
      join(process.cwd(), 'db/migrations/018_digital_use_review_runtime.sql'),
      'utf8'
    );
    expect(sql).not.toMatch(/CREATE\s+TABLE|CREATE\s+POLICY|\bGRANT\b/i);
    expect(sql).not.toMatch(/A5002|PHONE_USE_CONTRACT|A4001/i);

    const { rows } = await admin.query<{
      reviews: string | null;
      a5001_reviews: string | null;
      review_results: string | null;
    }>(
      `SELECT
        to_regclass('public.reviews')::text AS reviews,
        to_regclass('public.a5001_reviews')::text AS a5001_reviews,
        to_regclass('public.review_results')::text AS review_results`
    );
    expect(rows[0]).toEqual({
      reviews: null,
      a5001_reviews: null,
      review_results: null,
    });
  });

  it('preserves FORCE RLS and the existing runtime INSERT/SELECT owner on scene_artifacts', async () => {
    const { rows: rlsRows } = await admin.query<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `SELECT relrowsecurity, relforcerowsecurity
         FROM pg_class
        WHERE oid='scene_artifacts'::regclass`
    );
    expect(rlsRows[0]).toEqual({
      relrowsecurity: true,
      relforcerowsecurity: true,
    });

    const { rows: grants } = await admin.query<{
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(
      `SELECT
        has_table_privilege('xiaoshuyin_app','scene_artifacts','SELECT') AS can_select,
        has_table_privilege('xiaoshuyin_app','scene_artifacts','INSERT') AS can_insert,
        has_table_privilege('xiaoshuyin_app','scene_artifacts','UPDATE') AS can_update,
        has_table_privilege('xiaoshuyin_app','scene_artifacts','DELETE') AS can_delete`
    );
    expect(grants[0]).toEqual({
      can_select: true,
      can_insert: true,
      can_update: false,
      can_delete: false,
    });
  });
});
