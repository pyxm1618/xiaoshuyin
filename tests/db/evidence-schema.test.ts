/**
 * T012 — Evidence Core structural schema (data-model.md §2–§6).
 *
 * RED before 004_evidence_core.sql exists: every assertion below must fail
 * because the three tables / five enums / frozen columns are absent.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const MIGRATION_URL =
  process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;

const DIALOGUE_MESSAGE_COLUMNS = [
  'actor_account_id',
  'case_id',
  'content',
  'family_id',
  'id',
  'recorded_at',
  'source_person_id',
];

const ASSERTION_COLUMNS = [
  'case_id',
  'confirmation_status',
  'conflict_group_id',
  'content',
  'family_id',
  'id',
  'kind',
  'occurred_at',
  'occurred_time_state',
  'recorded_at',
  'source_kind',
  'source_message_id',
  'source_person_id',
  'subject_person_id',
  'supersedes_id',
  'valid_from',
  'valid_until',
];

const OBSERVATION_COLUMNS = [
  'case_id',
  'confirmation_status',
  'conflict_group_id',
  'family_id',
  'id',
  'observation_code',
  'occurred_at',
  'occurred_time_state',
  'recorded_at',
  'source_kind',
  'source_message_id',
  'source_person_id',
  'subject_person_id',
  'supersedes_id',
  'unit',
  'valid_from',
  'valid_until',
  'value_boolean',
  'value_number',
  'value_state',
  'value_text',
  'value_type',
];

const SHARED_PROVENANCE_COLUMNS = [
  'family_id',
  'case_id',
  'subject_person_id',
  'source_kind',
  'source_person_id',
  'source_message_id',
  'occurred_time_state',
  'occurred_at',
  'recorded_at',
  'valid_from',
  'valid_until',
  'confirmation_status',
  'supersedes_id',
  'conflict_group_id',
];

async function enumLabels(client: Client, typeName: string): Promise<string[]> {
  const { rows } = await client.query(
    `SELECT e.enumlabel
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = $1
      ORDER BY e.enumsortorder`,
    [typeName]
  );
  return rows.map((r: any) => r.enumlabel);
}

async function columnsOf(client: Client, table: string): Promise<string[]> {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return rows.map((r: any) => r.column_name).sort();
}

describe('Evidence Core schema (T012)', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: MIGRATION_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('creates exactly the three approved Evidence tables and no evidence_items', async () => {
    const { rows } = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const names = rows.map((r: any) => r.tablename);
    for (const table of ['dialogue_messages', 'assertions', 'observations']) {
      expect(names, `missing table ${table}`).toContain(table);
    }
    expect(names).not.toContain('evidence_items');
  });

  it('assertion_kind is exactly STATEMENT/FACT/HYPOTHESIS (no OBSERVATION)', async () => {
    expect(await enumLabels(client, 'assertion_kind')).toEqual([
      'STATEMENT',
      'FACT',
      'HYPOTHESIS',
    ]);
  });

  it('observation enums keep the frozen vocabulary and order', async () => {
    expect(await enumLabels(client, 'observation_value_state')).toEqual([
      'KNOWN',
      'UNKNOWN',
      'NOT_COLLECTED',
      'DECLINED',
      'NOT_APPLICABLE',
    ]);
    expect(await enumLabels(client, 'observation_value_type')).toEqual([
      'TEXT',
      'NUMBER',
      'BOOLEAN',
    ]);
    expect(await enumLabels(client, 'evidence_time_state')).toEqual([
      'KNOWN',
      'UNKNOWN',
    ]);
    expect(await enumLabels(client, 'evidence_confirmation_status')).toEqual([
      'UNCONFIRMED',
      'SOURCE_CONFIRMED',
      'DISPUTED',
    ]);
  });

  it('dialogue_messages has exactly the frozen raw-message columns', async () => {
    expect(await columnsOf(client, 'dialogue_messages')).toEqual(
      DIALOGUE_MESSAGE_COLUMNS
    );
  });

  it('assertions has exactly the frozen assertion columns', async () => {
    expect(await columnsOf(client, 'assertions')).toEqual(ASSERTION_COLUMNS);
  });

  it('observations is a separate table with typed-value columns and no kind', async () => {
    expect(await columnsOf(client, 'observations')).toEqual(OBSERVATION_COLUMNS);
  });

  it('assertions and observations both carry the shared provenance columns', async () => {
    for (const table of ['assertions', 'observations']) {
      const cols = await columnsOf(client, table);
      for (const col of SHARED_PROVENANCE_COLUMNS) {
        expect(cols, `${table}.${col}`).toContain(col);
      }
    }
  });

  it('source_kind reuses the Slice 1 provenance_source enum (no second taxonomy)', async () => {
    const { rows } = await client.query(
      `SELECT table_name, data_type, udt_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('assertions', 'observations')
          AND column_name = 'source_kind'`
    );
    expect(rows.length).toBe(2);
    for (const row of rows as any[]) {
      expect(row.udt_name).toBe('provenance_source');
    }
    expect(await enumLabels(client, 'provenance_source')).toHaveLength(8);
  });

  it('recorded_at is server-owned (NOT NULL DEFAULT now) on all three tables', async () => {
    const { rows } = await client.query(
      `SELECT table_name, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('dialogue_messages', 'assertions', 'observations')
          AND column_name = 'recorded_at'
        ORDER BY table_name`
    );
    expect(rows.length).toBe(3);
    for (const row of rows as any[]) {
      expect(row.is_nullable).toBe('NO');
      expect(String(row.column_default)).toMatch(/now\(\)/);
    }
  });

  it('all three ids default to uuidv7()', async () => {
    const { rows } = await client.query(
      `SELECT table_name, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('dialogue_messages', 'assertions', 'observations')
          AND column_name = 'id'
        ORDER BY table_name`
    );
    expect(rows.length).toBe(3);
    for (const row of rows as any[]) {
      expect(String(row.column_default)).toMatch(/uuidv7\(\)/);
    }
  });

  it('content is 1..8000 and rejects pure whitespace on messages and assertions', async () => {
    const { rows } = await client.query(
      `SELECT conrelid::regclass::text AS table_name, pg_get_constraintdef(oid) AS def
         FROM pg_constraint
        WHERE contype = 'c'
          AND conrelid IN ('dialogue_messages'::regclass, 'assertions'::regclass)`
    );
    for (const table of ['dialogue_messages', 'assertions']) {
      const defs = rows
        .filter((r: any) => r.table_name === table)
        .map((r: any) => r.def.replace(/\s+/g, ' '));
      expect(
        defs.some((d: string) => /8000/.test(d) && /btrim/.test(d)),
        `${table} content CHECK`
      ).toBe(true);
    }
  });
});