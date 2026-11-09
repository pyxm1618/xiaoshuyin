/**
 * T017 — audit / idempotency whitelist extensions.
 *
 * RED before the migration: the existing CHECK definitions do not admit the
 * three Slice 3 event/resource pairs nor CASE_MESSAGE_CREATE.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL =
  process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;

const AUDIT_COLUMNS = [
  'actor_account_id',
  'event_type',
  'family_id',
  'id',
  'metadata',
  'occurred_at',
  'resource_id',
  'resource_type',
];

const IDEMPOTENCY_COLUMNS = [
  'actor_account_id',
  'command_type',
  'created_at',
  'id',
  'idempotency_key',
  'idempotency_key_bytes',
  'request_hash',
  'response_body',
  'response_status',
];

interface Fixture {
  familyId: string;
  accountId: string;
}

describe('Audit / idempotency extension (T017)', () => {
  let admin: pg.Client;
  let catalog: pg.Client;
  let fx: Fixture;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    catalog = new pg.Client({ connectionString: MIGRATION_URL });
    await catalog.connect();
    fx = await seed(admin);
  });

  afterAll(async () => {
    await cleanup(admin);
    await catalog.end();
    await admin.end();
  });

  async function constraintDef(table: string, name: string): Promise<string> {
    const { rows } = await catalog.query(
      `SELECT pg_get_constraintdef(oid) AS def
         FROM pg_constraint
        WHERE conrelid = $1::regclass AND conname = $2`,
      [table, name]
    );
    expect(rows.length, `${table}.${name}`).toBe(1);
    return rows[0].def.replace(/\s+/g, ' ');
  }

  it('business_audit_events event_type admits exactly the approved Slice 3 vocabulary', async () => {
    const def = await constraintDef(
      'business_audit_events',
      'business_audit_events_event_type_check'
    );
    for (const value of [
      'FAMILY_CREATED',
      'MEMBER_CREATED',
      'MEMBER_PROFILE_VALUE_RECORDED',
      'CONSENT_REQUEST_CREATED',
      'CONSENT_GRANTED',
      'CONSENT_REVOKED',
      'CASE_CREATED',
      'MESSAGE_RECORDED',
      'ASSERTION_RECORDED',
      'OBSERVATION_RECORDED',
    ]) {
      expect(def, `missing event ${value}`).toContain(`'${value}'`);
    }
    for (const forbidden of ['CASE_VIEWED', 'EVIDENCE_CREATED', 'MESSAGE_VIEWED']) {
      expect(def, `forbidden event ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('business_audit_events resource_type admits exactly the approved Slice 3 vocabulary', async () => {
    const def = await constraintDef(
      'business_audit_events',
      'business_audit_events_resource_type_check'
    );
    for (const value of [
      'FAMILY',
      'PERSON',
      'CONSENT',
      'CASE',
      'DIALOGUE_MESSAGE',
      'ASSERTION',
      'OBSERVATION',
    ]) {
      expect(def, `missing resource ${value}`).toContain(`'${value}'`);
    }
    expect(def).not.toContain('EVIDENCE');
  });

  it('idempotency_keys command_type admits CASE_MESSAGE_CREATE only once', async () => {
    const def = await constraintDef(
      'idempotency_keys',
      'idempotency_keys_command_type_check'
    );
    expect(def).toContain("'CASE_MESSAGE_CREATE'");
    expect(def).not.toContain('EVIDENCE_WRITE');
    expect(def).not.toContain('ASSERTION_CREATE');
  });

  it('the three approved audit pairs are insertable with metadata {}', async () => {
    const pairs: Array<[string, string]> = [
      ['MESSAGE_RECORDED', 'DIALOGUE_MESSAGE'],
      ['ASSERTION_RECORDED', 'ASSERTION'],
      ['OBSERVATION_RECORDED', 'OBSERVATION'],
    ];
    for (const [eventType, resourceType] of pairs) {
      const { rows } = await admin.query(
        `INSERT INTO business_audit_events
           (family_id, actor_account_id, event_type, resource_type, resource_id)
         VALUES ($1, $2, $3, $4, uuidv7())
         RETURNING metadata`,
        [fx.familyId, fx.accountId, eventType, resourceType]
      );
      expect(rows[0].metadata, `${eventType}/${resourceType}`).toEqual({});
    }
  });

  it('rejects unapproved audit vocabulary', async () => {
    await expect(
      admin.query(
        `INSERT INTO business_audit_events
           (family_id, actor_account_id, event_type, resource_type, resource_id)
         VALUES ($1, $2, 'MESSAGE_VIEWED', 'DIALOGUE_MESSAGE', uuidv7())`,
        [fx.familyId, fx.accountId]
      )
    ).rejects.toThrow(/check constraint/i);
  });

  it('idempotency_keys accepts a text-representation CASE_MESSAGE_CREATE row', async () => {
    const key = `t017-key-${Date.now()}`;
    const { rows } = await admin.query(
      `INSERT INTO idempotency_keys
         (actor_account_id, command_type, idempotency_key, request_hash, response_status, response_body)
       VALUES ($1, 'CASE_MESSAGE_CREATE', $2, repeat('a', 64), 201, '{"ok":true}'::jsonb)
       RETURNING idempotency_key, idempotency_key_bytes`,
      [fx.accountId, key]
    );
    expect(rows[0].idempotency_key).toBe(key);
    expect(rows[0].idempotency_key_bytes).toBeNull();
  });

  it('does not introduce new audit/idempotency tables or columns', async () => {
    const tables = await catalog.query(
      `SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND (tablename LIKE '%audit%' OR tablename LIKE '%idempotency%')
        ORDER BY tablename`
    );
    expect(tables.rows.map((r: any) => r.tablename)).toEqual([
      'business_audit_events',
      'idempotency_keys',
    ]);

    for (const [table, expected] of [
      ['business_audit_events', AUDIT_COLUMNS],
      ['idempotency_keys', IDEMPOTENCY_COLUMNS],
    ] as const) {
      const cols = await catalog.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      );
      expect(cols.rows.map((r: any) => r.column_name).sort(), table).toEqual(expected);
    }
  });
});

async function seed(admin: pg.Client): Promise<Fixture> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const { rows: acc } = await admin.query(
    `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
    [`t017_${suffix}`]
  );
  const accountId = acc[0].id;
  const { rows: person } = await admin.query(
    `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
    [accountId]
  );
  const { rows: fam } = await admin.query(
    `INSERT INTO families (display_name, created_by_person_id) VALUES ('t017', $1) RETURNING id`,
    [person[0].id]
  );
  await admin.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`, [
    fam[0].id,
    person[0].id,
  ]);
  return { familyId: fam[0].id, accountId };
}

async function cleanup(admin: pg.Client) {
  try {
    await admin.query(
      `DELETE FROM business_audit_events WHERE family_id IN (
         SELECT id FROM families WHERE display_name = 't017')`
    );
    await admin.query(
      `DELETE FROM idempotency_keys WHERE actor_account_id IN (
         SELECT id FROM accounts WHERE wechat_openid LIKE 't017\\_%')`
    );
    await admin.query(
      `DELETE FROM family_members WHERE family_id IN (
         SELECT id FROM families WHERE display_name = 't017')`
    );
    await admin.query(`DELETE FROM families WHERE display_name = 't017'`);
    await admin.query(
      `DELETE FROM persons WHERE created_by_account_id IN (
         SELECT id FROM accounts WHERE wechat_openid LIKE 't017\\_%')`
    );
    await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE 't017\\_%'`);
  } catch {
    // best-effort cleanup
  }
}