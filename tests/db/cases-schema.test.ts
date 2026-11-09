/**
 * T021 — cases / case_events schema structure (data-model.md §1–§3).
 *
 * Asserts exact column sets, enum vocabulary/order, key constraints,
 * the single-primary partial unique index, and the absence of every
 * forbidden content column.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;

const CASES_COLUMNS = [
  'created_at',
  'created_by_person_id',
  'family_id',
  'id',
  'is_primary',
  'phase',
  'status',
  'updated_at',
  'version',
];

const CASE_EVENTS_COLUMNS = [
  'actor_account_id',
  'case_id',
  'event_type',
  'family_id',
  'id',
  'metadata',
  'occurred_at',
];

const FORBIDDEN_CASE_COLUMNS = [
  'title', 'summary', 'description', 'problem_description', 'problem_summary',
  'visibility', 'case_role', 'participant_id', 'deleted_at',
];

describe('cases / case_events schema (T021)', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: MIGRATION_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('cases has exactly the frozen column set', async () => {
    const { rows } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'cases'
    `);
    expect(rows.map((r: any) => r.column_name).sort()).toEqual(CASES_COLUMNS);
  });

  it('case_events has exactly the frozen column set', async () => {
    const { rows } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'case_events'
    `);
    expect(rows.map((r: any) => r.column_name).sort()).toEqual(CASE_EVENTS_COLUMNS);
  });

  it('neither table carries content / visibility / participation columns', async () => {
    const { rows } = await client.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name IN ('cases', 'case_events')`
    );
    const names = rows.map((r: any) => r.column_name);
    for (const forbidden of FORBIDDEN_CASE_COLUMNS) {
      expect(names, `forbidden column ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('both ids default to uuidv7()', async () => {
    const { rows } = await client.query(`
      SELECT table_name, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'id'
        AND table_name IN ('cases', 'case_events')
      ORDER BY table_name
    `);
    expect(rows.length).toBe(2);
    for (const r of rows as any[]) {
      expect(String(r.column_default)).toMatch(/uuidv7\(\)/);
    }
  });

  it('case_status and case_phase keep the frozen vocabulary and order', async () => {
    const { rows } = await client.query(`
      SELECT t.typname, e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = 'public' AND t.typname IN ('case_status', 'case_phase')
      ORDER BY t.typname, e.enumsortorder
    `);
    const map: Record<string, string[]> = {};
    for (const r of rows as any[]) {
      (map[r.typname] ??= []).push(r.enumlabel);
    }
    expect(map['case_status']).toEqual([
      'OPEN', 'WAITING', 'PAUSED', 'LOST_CONTACT', 'SAFETY_HOLD', 'CLOSED',
    ]);
    expect(map['case_phase']).toEqual([
      'INTAKE', 'ASSESSMENT', 'PROBLEM_FORMULATION', 'GOALS',
      'PLANNING', 'EXECUTION', 'REVIEW', 'MAINTENANCE', 'CLOSED',
    ]);
  });

  it('cases declares UNIQUE (id, family_id) for the composite FK target', async () => {
    const { rows } = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'cases'::regclass AND contype = 'u'
    `);
    const defs = rows.map((r: any) => r.def.replace(/\s+/g, ' '));
    expect(defs.some((d: string) => /UNIQUE \(id, family_id\)/.test(d))).toBe(true);
  });

  it('version >= 1 is enforced', async () => {
    const { rows } = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'cases'::regclass AND contype = 'c'
    `);
    const defs = rows.map((r: any) => r.def.replace(/\s+/g, ' '));
    expect(defs.some((d: string) => /version >= 1/.test(d))).toBe(true);
  });

  it('single-primary partial unique index has the frozen predicate', async () => {
    const { rows } = await client.query(`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'cases'
        AND indexname = 'cases_one_primary_open_per_family'
    `);
    expect(rows.length).toBe(1);
    const def = rows[0].indexdef.replace(/\s+/g, ' ');
    expect(def).toMatch(/UNIQUE INDEX/);
    expect(def).toMatch(/\(family_id\)/);
    expect(def).toMatch(/WHERE \(is_primary AND \(status <> 'CLOSED'::case_status\)\)|WHERE \(is_primary AND status <> 'CLOSED'::case_status\)/);
  });

  it('list and status indexes exist', async () => {
    const { rows } = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'cases'
      ORDER BY indexname
    `);
    const names = rows.map((r: any) => r.indexname);
    expect(names).toContain('cases_family_list_idx');
    expect(names).toContain('cases_family_status_idx');
  });

  it('case_events references cases by (case_id, family_id)', async () => {
    const { rows } = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'case_events'::regclass AND contype = 'f'
    `);
    const defs = rows.map((r: any) => r.def.replace(/\s+/g, ' '));
    expect(defs.some((d: string) =>
      /FOREIGN KEY \(case_id, family_id\) REFERENCES cases\(id, family_id\)/.test(d)
    )).toBe(true);
    expect(defs.some((d: string) => /REFERENCES accounts\(id\)/.test(d))).toBe(true);
  });
});
