/**
 * S7-III-M03 — current-main populated upgrade regression.
 *
 * The audit proved this outside the repository. This test makes it repeatable
 * inside the repository for the REAL authoritative baseline:
 *
 *   1. create a throw-away database owned by the migrator role
 *   2. apply ONLY current-main 001–006 (7 reviewed SQL files; 004 has two)
 *   3. insert representative legal upstream data and snapshot rows/constraints
 *   4. run the real migrator, which APPLYs ONLY 007
 *   5. assert rows preserved, literals only appended, case_status still five-state
 *   6. replay and require 0 unexpected migrations + a stable schema fingerprint
 *
 * This is a different regression contract from
 * `tests/db/migration-upgrade-evidence.test.ts`, whose starting point is
 * 001–003. Neither test is rewritten to fit the other.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL']!;
const ROOT = new URL('../..', import.meta.url).pathname;

/** Current authoritative main = 001–006. 004 contributes two reviewed files. */
const CURRENT_MAIN_MIGRATIONS = [
  '001_initial_schema.sql',
  '002_case_core.sql',
  '003_case_idempotency_key_bytes.sql',
  '004_evidence_core.sql',
  '004_identity_binding_runtime.sql',
  '005_case_participant_core.sql',
  '006_case_status_paused_removal.sql',
] as const;

const FIVE_CASE_STATUSES = ['OPEN', 'WAITING', 'LOST_CONTACT', 'SAFETY_HOLD', 'CLOSED'];

const EXPECTED_MAIN_AUDIT_LITERALS = [
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
  'PARTICIPATION_INVITE_CREATED',
  'PARTICIPATION_ACCEPTED',
  'PARTICIPATION_DECLINED',
  'PARTICIPATION_EXPIRED',
  'PARTICIPATION_WITHDRAWN',
];

const EXPECTED_MAIN_IDEMPOTENCY_COMMANDS = [
  'FAMILY_CREATE',
  'MEMBER_CREATE',
  'MEMBER_UPDATE',
  'GUARDIAN_CONSENT_REQUEST',
  'GUARDIAN_CONSENT_GRANT',
  'GUARDIAN_CONSENT_REVOKE',
  'CASE_CREATE',
  'CASE_MESSAGE_CREATE',
  'PARTICIPATION_INVITE_CREATE',
  'PARTICIPATION_ACCEPT',
  'PARTICIPATION_DECLINE',
  'PARTICIPATION_WITHDRAW',
];

const SLICE7_APPROVED_LITERALS = {
  case_events_event_type_check: ['CASE_PRIMARY_ASSIGNED', 'CASE_PRIMARY_REVOKED'],
  business_audit_events_event_type_check: ['CASE_PRIMARY_SWITCHED'],
  idempotency_keys_command_type_check: ['CASE_SWITCH_PRIMARY'],
};

/** Constraints whose definitions 007 is authorized to rewrite. */
const SLICE7_CONSTRAINT_CHANGES = [
  'case_events_event_type_check',
  'case_events_metadata_shape_check',
  'business_audit_events_event_type_check',
  'idempotency_keys_command_type_check',
  'idempotency_keys_key_representation_check',
];

function urlForDatabase(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

function runMigrator(connectionString: string): string {
  return execFileSync(process.execPath, [join(ROOT, 'scripts', 'db-migrate.mjs')], {
    cwd: ROOT,
    env: { ...process.env, MIGRATION_DATABASE_URL: connectionString },
    encoding: 'utf8',
    timeout: 120_000,
  });
}

function dedupeSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

/** Extract every quoted literal from a CHECK expression. */
function constraintLiterals(definition: string): string[] {
  return dedupeSorted([...definition.matchAll(/'([^']*)'/g)].map((match) => match[1]!));
}

function normalizeDefinition(definition: string): string {
  return definition.replace(/\s+/g, ' ').trim();
}

interface SeedIds {
  accountId: string;
  secondAccountId: string;
  personId: string;
  secondPersonId: string;
  familyId: string;
  caseId: string;
  messageId: string;
  participationId: string;
}

describe('current-main 001–006 -> Slice 7 007 populated upgrade (S7-III-M03)', () => {
  let admin: Client;
  let seed: Client;
  let database: string;
  let upgradeUrl: string;
  let ids: SeedIds;
  let beforeRows: Record<string, unknown>;
  let beforeConstraints: Record<string, string>;
  let beforeObjects: string;
  let beforeAuditLiterals: string[];
  let beforeIdempotencyLiterals: string[];
  let beforeCaseEventLiterals: string[];

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    database = `xiaoshuyin_s7iii_up_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await admin.query(`CREATE DATABASE "${database}" OWNER xiaoshuyin_migrator`);
    upgradeUrl = urlForDatabase(MIGRATION_URL, database);

    // Apply ONLY current-main 001–006 through the real reviewed SQL files and
    // record them exactly the way scripts/db-migrate.mjs does.
    const migrator = new Client({ connectionString: upgradeUrl });
    await migrator.connect();
    try {
      await migrator.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename   text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      for (const filename of CURRENT_MAIN_MIGRATIONS) {
        const sql = readFileSync(join(ROOT, 'db', 'migrations', filename), 'utf-8');
        await migrator.query('BEGIN');
        await migrator.query(sql);
        await migrator.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
        await migrator.query('COMMIT');
      }
      const { rows } = await migrator.query('SELECT count(*)::int AS c FROM schema_migrations');
      expect(rows[0].c).toBe(7);
    } finally {
      await migrator.end();
    }

    seed = new Client({ connectionString: urlForDatabase(ADMIN_URL, database) });
    await seed.connect();
    ids = await seedCurrentMainData(seed);

    beforeRows = await rowSnapshot(seed);
    beforeConstraints = await constraintDefinitions(seed);
    beforeObjects = await objectFingerprint(seed);
    beforeCaseEventLiterals = constraintLiterals(
      beforeConstraints['case_events_event_type_check']!
    );
    beforeAuditLiterals = constraintLiterals(
      beforeConstraints['business_audit_events_event_type_check']!
    );
    beforeIdempotencyLiterals = constraintLiterals(
      beforeConstraints['idempotency_keys_command_type_check']!
    );

    // Baseline sanity: the populated database really is the current-main shape.
    expect(beforeCaseEventLiterals).toEqual(['CASE_CREATED']);
    expect(beforeAuditLiterals).toEqual(dedupeSorted(EXPECTED_MAIN_AUDIT_LITERALS));
    expect(beforeIdempotencyLiterals).toEqual(
      dedupeSorted(EXPECTED_MAIN_IDEMPOTENCY_COMMANDS)
    );
  }, 180_000);

  afterAll(async () => {
    await seed?.end().catch(() => {});
    if (admin && database) {
      await admin
        .query(
          'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
          [database]
        )
        .catch(() => {});
      await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`).catch(() => {});
      const { rows } = await admin
        .query('SELECT count(*)::int AS c FROM pg_database WHERE datname = $1', [database])
        .catch(() => ({ rows: [{ c: NaN }] }));
      expect(rows[0].c).toBe(0);
    }
    await admin?.end().catch(() => {});
  }, 180_000);

  it('applies only 007 over populated current-main data and preserves every row', async () => {
    const output = runMigrator(upgradeUrl);
    for (const filename of CURRENT_MAIN_MIGRATIONS) {
      expect(output).toContain(`SKIP ${filename}`);
    }
    expect(output).toContain('APPLY 007_case_primary_switch.sql');
    expect(output).not.toContain('APPLY 001_initial_schema.sql');
    expect(output).not.toContain('APPLY 006_case_status_paused_removal.sql');
    expect(output).toMatch(/Migration complete: 1 new, 7 previously applied\./);

    // Rows preserved verbatim, table by table.
    expect(await rowSnapshot(seed)).toEqual(beforeRows);

    // case_status remains exactly the five frozen states, no PAUSED.
    const { rows: enumRows } = await seed.query(
      `SELECT e.enumlabel::text AS label
         FROM pg_enum e
         JOIN pg_type t ON t.oid = e.enumtypid
         JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'case_status'
        ORDER BY e.enumsortorder`
    );
    expect(enumRows.map((row: any) => row.label)).toEqual(FIVE_CASE_STATUSES);

    const { rows: caseRows } = await seed.query(
      'SELECT id, status::text AS status FROM cases WHERE family_id = $1 ORDER BY id',
      [ids.familyId]
    );
    expect(caseRows).toHaveLength(5);
    expect(dedupeSorted(caseRows.map((row: any) => row.status))).toEqual(
      dedupeSorted(FIVE_CASE_STATUSES)
    );

    // Main literals ⊆ Post-007 literals.
    const afterConstraints = await constraintDefinitions(seed);
    const afterCaseEventLiterals = constraintLiterals(
      afterConstraints['case_events_event_type_check']!
    );
    const afterAuditLiterals = constraintLiterals(
      afterConstraints['business_audit_events_event_type_check']!
    );
    const afterIdempotencyLiterals = constraintLiterals(
      afterConstraints['idempotency_keys_command_type_check']!
    );

    for (const literal of beforeCaseEventLiterals) {
      expect(afterCaseEventLiterals).toContain(literal);
    }
    for (const literal of beforeAuditLiterals) {
      expect(afterAuditLiterals).toContain(literal);
    }
    for (const literal of beforeIdempotencyLiterals) {
      expect(afterIdempotencyLiterals).toContain(literal);
    }

    // Only the approved Slice 7 literals were added — exactly, not more.
    const added = (after: string[], before: string[]) => after.filter((v) => !before.includes(v));
    expect(added(afterCaseEventLiterals, beforeCaseEventLiterals)).toEqual(
      SLICE7_APPROVED_LITERALS.case_events_event_type_check
    );
    expect(added(afterAuditLiterals, beforeAuditLiterals)).toEqual(
      SLICE7_APPROVED_LITERALS.business_audit_events_event_type_check
    );
    expect(added(afterIdempotencyLiterals, beforeIdempotencyLiterals)).toEqual(
      SLICE7_APPROVED_LITERALS.idempotency_keys_command_type_check
    );

    // Existing data still satisfies the revalidated constraints (inserts pass).
    await seed.query(
      `INSERT INTO business_audit_events
         (family_id, actor_account_id, event_type, resource_type, resource_id)
       VALUES ($1, $2, 'CASE_PRIMARY_SWITCHED', 'CASE', $3)`,
      [ids.familyId, ids.accountId, ids.caseId]
    );

    // Constraint layer change is controlled: exactly the five reviewed names.
    const afterConstraintNames = Object.keys(afterConstraints).sort();
    expect(afterConstraintNames).toEqual(Object.keys(beforeConstraints).sort());
    const changedConstraints = afterConstraintNames.filter(
      (name) => afterConstraints[name] !== beforeConstraints[name]
    );
    expect(changedConstraints.sort()).toEqual([...SLICE7_CONSTRAINT_CHANGES].sort());

    // No new table / enum / policy / trigger beyond schema_migrations.
    expect(await objectFingerprint(seed)).toEqual(beforeObjects);

    // Column-level UPDATE grant, never table-level.
    const { rows: columnGrants } = await seed.query(
      `SELECT column_name FROM information_schema.column_privileges
        WHERE grantee = 'xiaoshuyin_app' AND table_name = 'cases' AND privilege_type = 'UPDATE'
        ORDER BY column_name`
    );
    expect(columnGrants.map((row: any) => row.column_name)).toEqual([
      'is_primary',
      'updated_at',
      'version',
    ]);
    const { rows: tableGrant } = await seed.query(
      "SELECT has_table_privilege('xiaoshuyin_app', 'public.cases', 'UPDATE') AS ok"
    );
    expect(tableGrant[0].ok).toBe(false);
  }, 180_000);

  it('replay applies 0 unexpected migrations and leaves the schema stable', async () => {
    const beforeReplayRows = await rowSnapshot(seed);
    const beforeReplayConstraints = await constraintDefinitions(seed);
    const beforeReplayObjects = await objectFingerprint(seed);

    const output = runMigrator(upgradeUrl);
    expect(output).toMatch(/Migration complete: 0 new, 8 previously applied\./);
    expect(output).not.toContain('APPLY 007_case_primary_switch.sql');

    expect(await rowSnapshot(seed)).toEqual(beforeReplayRows);
    expect(await constraintDefinitions(seed)).toEqual(beforeReplayConstraints);
    expect(await objectFingerprint(seed)).toEqual(beforeReplayObjects);

    const { rows: applied } = await seed.query(
      'SELECT filename FROM schema_migrations ORDER BY filename'
    );
    expect(applied.map((row: any) => row.filename)).toEqual([
      ...CURRENT_MAIN_MIGRATIONS,
      '007_case_primary_switch.sql',
    ]);
  }, 180_000);
});

async function seedCurrentMainData(client: Client): Promise<SeedIds> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const { rows: firstAccount } = await client.query(
    'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
    [`s7iii_a_${suffix}`]
  );
  const accountId = firstAccount[0].id;
  const { rows: secondAccount } = await client.query(
    'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
    [`s7iii_b_${suffix}`]
  );
  const secondAccountId = secondAccount[0].id;

  const { rows: firstPerson } = await client.query(
    'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
    [accountId]
  );
  const personId = firstPerson[0].id;
  const { rows: secondPerson } = await client.query(
    'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
    [secondAccountId]
  );
  const secondPersonId = secondPerson[0].id;

  await client.query(
    `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source)
     VALUES ($1, 'ADULT', false, 'SELF_STATEMENT'), ($2, 'ADULT', false, 'SELF_STATEMENT')`,
    [personId, secondPersonId]
  );

  const { rows: family } = await client.query(
    'INSERT INTO families (display_name, created_by_person_id) VALUES ($1, $2) RETURNING id',
    [`s7iii-${suffix}`, personId]
  );
  const familyId = family[0].id;
  await client.query(
    `INSERT INTO family_members (family_id, person_id) VALUES ($1, $2), ($1, $3)`,
    [familyId, personId, secondPersonId]
  );

  // Five-state Case data: exactly one primary/open row.
  const caseIds: string[] = [];
  for (const [index, status] of FIVE_CASE_STATUSES.entries()) {
    const { rows } = await client.query(
      `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
       VALUES ($1, $2, $3, 'INTAKE', $4, 1) RETURNING id`,
      [familyId, personId, status, index === 0]
    );
    caseIds.push(rows[0].id);
  }
  const caseId = caseIds[0]!;

  await client.query(
    `INSERT INTO case_events (family_id, case_id, actor_account_id, event_type, metadata)
     VALUES ($1, $2, $3, 'CASE_CREATED', '{"primary":true,"version":1}'::jsonb)`,
    [familyId, caseId, accountId]
  );

  const { rows: message } = await client.query(
    `INSERT INTO dialogue_messages (family_id, case_id, actor_account_id, source_person_id, content)
     VALUES ($1, $2, $3, $4, 'seed message') RETURNING id`,
    [familyId, caseId, accountId, personId]
  );
  const messageId = message[0].id;

  await client.query(
    `INSERT INTO assertions
       (family_id, case_id, subject_person_id, source_kind, source_person_id,
        source_message_id, occurred_time_state, confirmation_status, kind, content)
     VALUES ($1, $2, $3, 'SELF_STATEMENT', $3, $4, 'UNKNOWN', 'UNCONFIRMED', 'STATEMENT',
             'seed assertion')`,
    [familyId, caseId, personId, messageId]
  );

  await client.query(
    `INSERT INTO observations
       (family_id, case_id, subject_person_id, source_kind, source_person_id,
        source_message_id, occurred_time_state, confirmation_status,
        observation_code, value_state)
     VALUES ($1, $2, $3, 'SELF_STATEMENT', $3, $4, 'UNKNOWN', 'UNCONFIRMED',
             'sleep_hours', 'UNKNOWN')`,
    [familyId, caseId, personId, messageId]
  );

  const { rows: participation } = await client.query(
    `INSERT INTO case_participants
       (family_id, case_id, person_id, state, invite_token_hash, invite_expires_at,
        created_by_person_id)
     VALUES ($1, $2, $3, 'PENDING', $4, now() + interval '1 day', $5)
     RETURNING id`,
    [familyId, caseId, secondPersonId, 'c'.repeat(64), personId]
  );

  // Existing audit literals from the Evidence and Participant eras.
  const auditRows: Array<[string, string, string]> = [
    ['FAMILY_CREATED', 'FAMILY', familyId],
    ['MEMBER_CREATED', 'PERSON', secondPersonId],
    ['CASE_CREATED', 'CASE', caseId],
    ['MESSAGE_RECORDED', 'DIALOGUE_MESSAGE', messageId],
    ['ASSERTION_RECORDED', 'ASSERTION', caseId],
    ['OBSERVATION_RECORDED', 'OBSERVATION', caseId],
    ['PARTICIPATION_INVITE_CREATED', 'CASE_PARTICIPANT', participation[0].id],
  ];
  for (const [eventType, resourceType, resourceId] of auditRows) {
    await client.query(
      `INSERT INTO business_audit_events
         (family_id, actor_account_id, event_type, resource_type, resource_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [familyId, accountId, eventType, resourceType, resourceId]
    );
  }

  // Existing idempotency command literals (text representation).
  const idempotencyRows: Array<[string, string]> = [
    ['CASE_CREATE', 's7iii-case-create'],
    ['CASE_MESSAGE_CREATE', 's7iii-message-create'],
    ['PARTICIPATION_INVITE_CREATE', 's7iii-invite-create'],
  ];
  for (const [commandType, key] of idempotencyRows) {
    await client.query(
      `INSERT INTO idempotency_keys
         (actor_account_id, command_type, idempotency_key, request_hash, response_status, response_body)
       VALUES ($1, $2, $3, $4, 201, '{}'::jsonb)`,
      [accountId, commandType, key, 'd'.repeat(64)]
    );
  }

  return {
    accountId,
    secondAccountId,
    personId,
    secondPersonId,
    familyId,
    caseId,
    messageId,
    participationId: participation[0].id,
  };
}

const SEEDED_TABLES = [
  'accounts',
  'persons',
  'families',
  'family_members',
  'person_compliance_profiles',
  'cases',
  'case_events',
  'dialogue_messages',
  'assertions',
  'observations',
  'case_participants',
  'business_audit_events',
  'idempotency_keys',
] as const;

async function rowSnapshot(client: Client): Promise<Record<string, unknown>> {
  const snapshot: Record<string, unknown> = {};
  for (const table of SEEDED_TABLES) {
    // `person_compliance_profiles` is keyed by person_id, so order by the
    // canonical row text instead of assuming an `id` column on every table.
    const { rows } = await client.query(
      `SELECT count(*)::int AS c,
              coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) AS rows
         FROM ${table} t`
    );
    snapshot[table] = rows[0];
  }
  return snapshot;
}

async function constraintDefinitions(client: Client): Promise<Record<string, string>> {
  const { rows } = await client.query(`
    SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
     ORDER BY c.conname
  `);
  return Object.fromEntries(
    rows.map((row: any) => [row.conname, normalizeDefinition(row.definition)])
  );
}

async function objectFingerprint(client: Client): Promise<string> {
  const { rows } = await client.query(`
    SELECT kind || ':' || name AS entry FROM (
      SELECT 'enum' AS kind, t.typname AS name
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public' AND t.typtype = 'e'
      UNION ALL
      SELECT 'table', tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
      UNION ALL
      SELECT 'policy', policyname FROM pg_policies WHERE schemaname = 'public'
      UNION ALL
      SELECT 'trigger', tgname FROM pg_trigger WHERE NOT tgisinternal
    ) objects
    ORDER BY 1
  `);
  return rows.map((row: any) => row.entry).join('|');
}