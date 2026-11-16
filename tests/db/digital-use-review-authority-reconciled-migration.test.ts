import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { createAdminPool } from '../setup/db.js';

describe('Slice 15 authority-reconciled Scene Artifact migration', () => {
  let admin: pg.Pool;

  beforeAll(() => {
    admin = createAdminPool();
  });

  afterAll(async () => {
    await admin.end();
  });

  it('extends only the authoritative Scene Artifact vocabulary for A5001/A5002', async () => {
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
    expect(defs['scene_artifacts_type_check']).toContain(
      'DIGITAL_USE_A5002_EFFECT_EVALUATION'
    );
    expect(defs['scene_artifacts_source_node_check']).toContain('A5001');
    expect(defs['scene_artifacts_source_node_check']).toContain('A5002');
    expect(defs['scene_artifacts_type_source_check']).toContain(
      'DIGITAL_USE_A5001_EFFECT_EVALUATION'
    );
    expect(defs['scene_artifacts_type_source_check']).toContain(
      'DIGITAL_USE_A5002_EFFECT_EVALUATION'
    );
  });

  it('adds no Review/Professional/Reviewer/scheduler table or second policy owner', async () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'db/migrations/023_digital_use_review_runtime_authority_reconciled.sql'
      ),
      'utf8'
    );
    const ddl = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    expect(ddl).not.toMatch(/CREATE\s+TABLE|CREATE\s+POLICY|\bGRANT\b/i);
    expect(ddl).not.toMatch(
      /professional_packages|reviewers\b|scheduler|digital_use_contract_versions/i
    );

    const { rows } = await admin.query(
      `SELECT
         to_regclass('public.reviews')::text AS reviews,
         to_regclass('public.professional_packages')::text AS professional_packages,
         to_regclass('public.reviewers')::text AS reviewers,
         to_regclass('public.scheduled_reviews')::text AS scheduled_reviews`
    );
    expect(rows[0]).toEqual({
      reviews: null,
      professional_packages: null,
      reviewers: null,
      scheduled_reviews: null,
    });
  });

  it('preserves Scene Artifact FORCE RLS and existing CRUD privileges', async () => {
    const { rows: rlsRows } = await admin.query(
      `SELECT relrowsecurity, relforcerowsecurity
         FROM pg_class
        WHERE oid='scene_artifacts'::regclass`
    );
    expect(rlsRows[0]).toEqual({
      relrowsecurity: true,
      relforcerowsecurity: true,
    });

    const { rows: grants } = await admin.query(
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
