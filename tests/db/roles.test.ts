/**
 * T012: roles.test.ts — RED test (test-first).
 *
 * Defines the final expected state for database roles:
 * - App role has NOBYPASSRLS
 * - Business tables are owned by xiaoshuyin_migrator (not app)
 * - App has minimal DML on 10 tables, no CREATE/TRUNCATE
 * - 8 enum USAGE is correct
 *
 * This test is EXPECTED TO FAIL (RED) until T028 (GRANT) completes.
 * It turns GREEN when roles and grants are in place.
 * Final verification is by T067.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;

const TABLES = [
  'accounts',
  'business_audit_events',
  'consent_records',
  'families',
  'family_members',
  'guardian_consent_requests',
  'idempotency_keys',
  'person_compliance_profiles',
  'person_profile_values',
  'persons',
];

const ENUMS = [
  'account_status',
  'age_band',
  'consent_decision',
  'consent_purpose',
  'consent_request_status',
  'profile_attribute',
  'profile_value_status',
  'provenance_source',
];

describe('Database Roles (T012 RED)', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: MIGRATION_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('app role should have NOBYPASSRLS', async () => {
    const { rows } = await client.query(
      "SELECT rolbypassrls FROM pg_roles WHERE rolname = 'xiaoshuyin_app'"
    );
    expect(rows.length).toBe(1);
    expect(rows[0].rolbypassrls).toBe(false);
  });

  it('migrator role should exist and have NOBYPASSRLS', async () => {
    const { rows } = await client.query(
      "SELECT rolbypassrls FROM pg_roles WHERE rolname = 'xiaoshuyin_migrator'"
    );
    expect(rows.length).toBe(1);
    expect(rows[0].rolbypassrls).toBe(false);
  });

  it('business tables should be owned by xiaoshuyin_migrator', async () => {
    for (const table of TABLES) {
      const { rows } = await client.query(
        `SELECT relowner::regrole::text as owner FROM pg_class WHERE relname = $1 AND relkind = 'r'`,
        [table]
      );
      expect(rows.length, `table ${table} should exist`).toBe(1);
      expect(rows[0].owner, `table ${table} owner`).toBe('xiaoshuyin_migrator');
    }
  });

  it('app role should have DML privileges on all 10 tables', async () => {
    for (const table of TABLES) {
      for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const { rows } = await client.query(
          `SELECT has_table_privilege('xiaoshuyin_app', $1, $2) as has`,
          [table, priv]
        );
        expect(rows[0].has, `app should have ${priv} on ${table}`).toBe(true);
      }
    }
  });

  it('app role should NOT have CREATE or TRUNCATE on any table', async () => {
    for (const table of TABLES) {
      for (const priv of ['TRUNCATE']) {
        const { rows } = await client.query(
          `SELECT has_table_privilege('xiaoshuyin_app', $1, $2) as has`,
          [table, priv]
        );
        expect(rows[0].has, `app should NOT have ${priv} on ${table}`).toBe(false);
      }
    }
  });

  it('app role should have USAGE on all 8 enums', async () => {
    for (const enumName of ENUMS) {
      const { rows } = await client.query(
        `SELECT has_type_privilege('xiaoshuyin_app', $1, 'USAGE') as has`,
        [enumName]
      );
      expect(rows[0].has, `app should have USAGE on enum ${enumName}`).toBe(true);
    }
  });

  // ── Slice 2 (T025): Case Core tables ──────────────────────
  // Deliberately NOT merged into the 10-table DML loop above: the Case
  // tables are append-only for the runtime role and must never gain
  // UPDATE / DELETE in this Slice.

  it('Slice 2: cases / case_events exist and are owned by xiaoshuyin_migrator', async () => {
    for (const table of ['cases', 'case_events']) {
      const { rows } = await client.query(
        `SELECT relowner::regrole::text as owner FROM pg_class WHERE relname = $1 AND relkind = 'r'`,
        [table]
      );
      expect(rows.length, `table ${table} should exist`).toBe(1);
      expect(rows[0].owner, `table ${table} owner`).toBe('xiaoshuyin_migrator');
    }
  });

  it('Slice 2: app role has exactly SELECT + INSERT on cases / case_events', async () => {
    for (const table of ['cases', 'case_events']) {
      for (const priv of ['SELECT', 'INSERT']) {
        const { rows } = await client.query(
          `SELECT has_table_privilege('xiaoshuyin_app', $1, $2) as has`,
          [table, priv]
        );
        expect(rows[0].has, `app should have ${priv} on ${table}`).toBe(true);
      }
      for (const priv of ['UPDATE', 'DELETE', 'TRUNCATE']) {
        const { rows } = await client.query(
          `SELECT has_table_privilege('xiaoshuyin_app', $1, $2) as has`,
          [table, priv]
        );
        expect(rows[0].has, `app must NOT have ${priv} on ${table}`).toBe(false);
      }
    }
  });

  it('Slice 2: app role has USAGE on case_status / case_phase', async () => {
    for (const enumName of ['case_status', 'case_phase']) {
      const { rows } = await client.query(
        `SELECT has_type_privilege('xiaoshuyin_app', $1, 'USAGE') as has`,
        [enumName]
      );
      expect(rows[0].has, `app should have USAGE on enum ${enumName}`).toBe(true);
    }
  });
});
