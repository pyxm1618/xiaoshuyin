/**
 * Schema structure tests: verify column sets match data-model.md exactly.
 * Covers: enum values, persons columns (no family_id/source_kind),
 * profile_attribute only DISPLAY_NAME, accounts columns.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;

describe('Schema Structure', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: MIGRATION_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('21 enums exist with exact values (Slice 1 + Case Core + Slice 3 + Slice 4 + Slice 6)', async () => {
    const { rows } = await client.query(`
      SELECT t.typname, e.enumlabel
      FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder
    `);

    const enumMap: Record<string, string[]> = {};
    for (const r of rows as any[]) {
      if (!enumMap[r.typname]) enumMap[r.typname] = [];
      enumMap[r.typname].push(r.enumlabel);
    }

    expect(Object.keys(enumMap).sort()).toEqual([
      'account_status', 'age_band', 'assertion_kind',
      'binding_attempt_state', 'binding_confirmation_kind',
      'binding_confirmer_authority', 'binding_operation_command',
      'binding_operation_scope',
      'case_participation_state', 'case_phase', 'case_status',
      'consent_decision', 'consent_purpose', 'consent_request_status',
      'evidence_confirmation_status', 'evidence_time_state',
      'observation_value_state', 'observation_value_type',
      'profile_attribute', 'profile_value_status', 'provenance_source',
    ]);
    expect(enumMap['case_status']).toEqual([
      'OPEN', 'WAITING', 'PAUSED', 'LOST_CONTACT', 'SAFETY_HOLD', 'CLOSED',
    ]);
    expect(enumMap['case_phase']).toEqual([
      'INTAKE', 'ASSESSMENT', 'PROBLEM_FORMULATION', 'GOALS',
      'PLANNING', 'EXECUTION', 'REVIEW', 'MAINTENANCE', 'CLOSED',
    ]);
    expect(enumMap['age_band']).toEqual(['ADULT', 'MINOR_14_17', 'UNDER_14', 'UNKNOWN']);
    expect(enumMap['profile_attribute']).toEqual(['DISPLAY_NAME']);
    expect(enumMap['provenance_source']).toEqual([
      'SELF_STATEMENT', 'GUARDIAN_OBSERVATION', 'GUARDIAN_RELAY', 'OTHER_MEMBER_RELAY',
      'MANUAL_DEVICE_DATA', 'STAFF_RECORD', 'AI_HYPOTHESIS', 'SOURCE_CONFIRMED',
    ]);
  });

  it('persons has no family_id or source_kind columns', async () => {
    const { rows } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'persons' AND table_schema = 'public'
    `);
    const cols = rows.map((r: any) => r.column_name);
    expect(cols).not.toContain('family_id');
    expect(cols).not.toContain('source_kind');
    expect(cols).not.toContain('source');
    expect(cols).not.toContain('role');
    expect(cols).not.toContain('is_guardian');
  });

  it('family_members has no role/creator/guardian columns', async () => {
    const { rows } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'family_members' AND table_schema = 'public'
    `);
    const cols = rows.map((r: any) => r.column_name);
    expect(cols).not.toContain('role');
    expect(cols).not.toContain('is_admin');
    expect(cols).not.toContain('is_owner');
    expect(cols).not.toContain('is_creator');
    expect(cols).not.toContain('is_guardian');
  });

  it('accounts has expected columns', async () => {
    const { rows } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'accounts' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    const cols = rows.map((r: any) => r.column_name);
    expect(cols).toEqual(['id', 'wechat_openid', 'session_epoch', 'status', 'created_at', 'last_login_at']);
  });

  it('persons.account_id is UNIQUE', async () => {
    const { rows } = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'persons' AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%account_id%'
    `);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('9 tables with id column use uuidv7() as default', async () => {
    // person_compliance_profiles uses person_id as PK (no separate id column)
    const { rows } = await client.query(`
      SELECT table_name, column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'id'
        AND table_name IN ('accounts','persons','families','family_members',
          'guardian_consent_requests','consent_records',
          'person_profile_values','business_audit_events','idempotency_keys')
    `);
    for (const row of rows) {
      expect(row.column_default, `${row.table_name}.id default`).toContain('uuidv7');
    }
    expect(rows.length).toBe(9);
  });
});
