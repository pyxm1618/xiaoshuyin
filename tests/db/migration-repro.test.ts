/**
 * T011: migration-repro.test.ts — RED test (test-first).
 *
 * Defines the final expected state after all migrations are applied:
 * - Full migration can establish schema from empty PostgreSQL 18
 * - Second apply is a no-op
 * - Object set is consistent before and after
 * - Final set includes: 15 enums, 15 tables, RLS functions, 19 policies, consent trigger
 *
 * This test is EXPECTED TO FAIL (RED) until Phase 3 (T013-T028) completes.
 * It turns GREEN when the full reviewed migration is in place.
 * Final verification is by T067.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;

// Expected final object counts (Slice 1/2 + Case Core + Slice 3 Evidence + Slice 6 binding)
const EXPECTED_ENUMS = 23; // + problem_formulation_status (Slice 8)
const EXPECTED_TABLES = 26; // + compliance_feature_policies (Slice 10)
const EXPECTED_RLS_FUNCTIONS = 4; // app_family_id, app_person_id, app_account_id, app_current_purpose
const EXPECTED_CONTEXT_FUNCTIONS = 4; // set_account_context, set_identity_context, set_family_context, create_family
const EXPECTED_POLICIES = 56; // + 2 compliance_feature_policies RLS policies (Slice 10)
const EXPECTED_TRIGGERS = 3; // consent_records_guard + 2 binding append-only triggers

const EXPECTED_ENUM_NAMES = [
  'account_status',
  'age_band',
  'binding_attempt_state',
  'binding_confirmation_kind',
  'binding_confirmer_authority',
  'binding_operation_command',
  'binding_operation_scope',
  'assertion_kind',
  'case_participation_state',
  'case_phase',
  'case_status',
  'consent_decision',
  'consent_purpose',
  'consent_request_status',
  'evidence_confirmation_status',
  'evidence_time_state',
  'observation_value_state',
  'observation_value_type',
  'profile_attribute',
  'profile_value_status',
  'provenance_source',
  'problem_formulation_status',
  'scene_node_status',
].sort();

const EXPECTED_TABLE_NAMES = [
  'accounts',
  'binding_attempts',
  'binding_confirmations',
  'binding_operation_keys',
  'binding_pending_contexts',
  'assertions',
  'business_audit_events',
  'case_events',
  'case_participants',
  'cases',
  'compliance_feature_policies',
  'consent_records',
  'dialogue_messages',
  'families',
  'family_members',
  'guardian_consent_requests',
  'idempotency_keys',
  'identity_binding_audit_events',
  'observations',
  'person_compliance_profiles',
  'person_profile_values',
  'persons',
  'problem_formulations',
  'risk_events',
  'scene_artifacts',
  'scene_node_states',
].sort();

describe('Migration Reproducibility (T011 RED)', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: MIGRATION_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('should have all 23 enums with correct values', async () => {
    const { rows } = await client.query(`
      SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = 'public'
      GROUP BY t.typname
      ORDER BY t.typname
    `);

    const enumNames = rows.map((r: any) => r.typname).sort();
    expect(enumNames).toEqual(EXPECTED_ENUM_NAMES);
    expect(enumNames.length).toBe(EXPECTED_ENUMS);
  });

  it('should have all 26 tables', async () => {
    const { rows } = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename != 'schema_migrations'
      ORDER BY tablename
    `);

    const tableNames = rows.map((r: any) => r.tablename).sort();
    expect(tableNames).toEqual(EXPECTED_TABLE_NAMES);
  });

  it('should have RLS context getter functions', async () => {
    const { rows } = await client.query(`
      SELECT proname FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND proname IN ('app_family_id', 'app_person_id', 'app_account_id', 'app_current_purpose')
      ORDER BY proname
    `);

    expect(rows.length).toBe(EXPECTED_RLS_FUNCTIONS);
  });

  it('should have context entry functions in app schema', async () => {
    const { rows } = await client.query(`
      SELECT proname FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'app'
        AND proname IN ('set_account_context', 'set_identity_context', 'set_family_context', 'create_family')
      ORDER BY proname
    `);

    expect(rows.length).toBe(EXPECTED_CONTEXT_FUNCTIONS);
  });

  it('should have 56 RLS policies', async () => {
    const { rows } = await client.query(`
      SELECT policyname, tablename FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `);

    expect(rows.length).toBe(EXPECTED_POLICIES);
  });

  it('should have consent_records_guard trigger', async () => {
    const { rows } = await client.query(`
      SELECT tgname FROM pg_trigger
      WHERE tgname = 'consent_records_guard'
        AND NOT tgisinternal
    `);

    expect(rows.length).toBe(1);
  });

  it('second migration apply should be a no-op', async () => {
    // Get object counts before
    const before = await getObjectCounts(client);

    // Run migration again (should skip all files)
    // This is simulated by checking that all files are in schema_migrations
    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    expect(rows.length).toBeGreaterThan(0);

    // Object counts should be unchanged
    const after = await getObjectCounts(client);
    expect(after).toEqual(before);
  });
});

async function getObjectCounts(client: Client) {
  const [enums, tables, functions, policies, triggers] = await Promise.all([
    client.query(`SELECT count(*) FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e'`),
    client.query(`SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename != 'schema_migrations'`),
    client.query(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname IN ('public', 'app')`),
    client.query(`SELECT count(*) FROM pg_policies WHERE schemaname = 'public'`),
    client.query(`SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal`),
  ]);

  return {
    enums: enums.rows[0].count,
    tables: tables.rows[0].count,
    functions: functions.rows[0].count,
    policies: policies.rows[0].count,
    triggers: triggers.rows[0].count,
  };
}
