/**
 * S8-FINAL-01 — real current-main → PR upgrade path.
 *
 * Current main may already have applied 009 (Slice 9 Safety) while 008 and 010
 * are still absent. The official migrator sorts by filename, skips applied
 * files, and applies the rest. It therefore applies 008 directly on top of a
 * database that already contains legal Slice 9 Safety rows.
 *
 * This suite builds exactly that pre-state (001–007 + 009), inserts real Safety
 * rows covered by the shared CHECKs, and then runs the OFFICIAL
 * `scripts/db-migrate.mjs` against the checked-in migration directory. It also
 * proves 008 is immediately legal on its own, so 010 cannot mask a broken 008.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL']!;
const ROOT = new URL('../..', import.meta.url).pathname;
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations');

const PRE_009_FILES = [
  '001_initial_schema.sql',
  '002_case_core.sql',
  '003_case_idempotency_key_bytes.sql',
  '004_evidence_core.sql',
  '004_identity_binding_runtime.sql',
  '005_case_participant_core.sql',
  '006_case_status_paused_removal.sql',
  '007_case_primary_switch.sql',
  '009_safety_hold_control_foundation.sql',
];

const SLICE8_CASE_EVENT_TYPES = [
  'CASE_ASSESSMENT_STARTED',
  'CASE_PROBLEM_FORMULATION_PRESENTED',
  'CASE_PROBLEM_FORMULATION_CONFIRMED',
  'CASE_PROBLEM_FORMULATION_DISPUTED',
  'CASE_PROBLEM_FORMULATION_CORRECTED',
  'CASE_REASSESSMENT_STARTED',
];
const SLICE9_CASE_EVENT_TYPES = ['CASE_SAFETY_HOLD_ENTERED', 'CASE_RISK_RESOLVED'];

const SLICE8_AUDIT_EVENT_TYPES = [
  'CASE_ASSESSMENT_STARTED',
  'CASE_PROBLEM_FORMULATION_PRESENTED',
  'CASE_PROBLEM_FORMULATION_CONFIRMED',
  'CASE_PROBLEM_FORMULATION_DISPUTED',
  'CASE_PROBLEM_FORMULATION_CORRECTED',
  'CASE_REASSESSMENT_STARTED',
];
const SLICE9_AUDIT_EVENT_TYPES = ['CASE_SAFETY_HOLD_ENTERED', 'CASE_RISK_RESOLVED'];

const SLICE8_COMMANDS = [
  'CASE_START_ASSESSMENT',
  'PROBLEM_FORMULATION_PRESENT',
  'PROBLEM_FORMULATION_CONFIRM',
  'PROBLEM_FORMULATION_DISPUTE',
  'PROBLEM_FORMULATION_CORRECT',
  'CASE_REASSESS_FROM_FORMULATION',
];
const SLICE9_COMMANDS = ['CASE_ENTER_SAFETY_HOLD', 'CASE_RESOLVE_RISK'];

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

function literalsOf(definition: string): string[] {
  return [...definition.matchAll(/'([A-Z][A-Z0-9_]*)'/g)].map((match) => match[1]!);
}

interface SafetyFixture {
  accountId: string;
  personId: string;
  familyId: string;
  caseId: string;
  holdRiskEventId: string;
  resolvedRiskEventId: string;
}

/**
 * Apply the exact pre-PR current-main state (001–007 + 009) as the migrator
 * owner, then insert real Safety rows as the superuser (RLS bypass for fixture
 * construction only). Returns the created database name and row identities.
 */
async function buildPreState(database: string): Promise<{
  dbUrl: string;
  fixture: SafetyFixture;
  migrationRecords: Map<string, number>;
  safetyRows: unknown;
}> {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${database}" OWNER xiaoshuyin_migrator`);
  } finally {
    await admin.end();
  }

  const migrator = new Client({ connectionString: urlForDatabase(MIGRATION_URL, database) });
  await migrator.connect();
  try {
    await migrator.query(`
      CREATE TABLE schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    for (const file of PRE_009_FILES) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
      await migrator.query('BEGIN');
      await migrator.query(sql);
      await migrator.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await migrator.query('COMMIT');
    }
  } finally {
    await migrator.end();
  }

  const fixtureClient = new Client({ connectionString: urlForDatabase(ADMIN_URL, database) });
  await fixtureClient.connect();
  try {
    const accountId = (
      await fixtureClient.query(
        'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
        [`t8final01_${Date.now()}_${Math.floor(Math.random() * 1e6)}`]
      )
    ).rows[0].id as string;
    const personId = (
      await fixtureClient.query(
        'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
        [accountId]
      )
    ).rows[0].id as string;
    const familyId = (await fixtureClient.query('SELECT uuidv7() AS id')).rows[0].id as string;
    await fixtureClient.query('SELECT app.create_family($1, $2, $3)', [
      familyId,
      personId,
      'T8FINAL01',
    ]);
    await fixtureClient.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [familyId, personId]
    );
    const caseId = (
      await fixtureClient.query(
        `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
         VALUES ($1, $2, 'SAFETY_HOLD', 'ASSESSMENT', true, 2) RETURNING id`,
        [familyId, personId]
      )
    ).rows[0].id as string;

    const holdRiskEventId = (await fixtureClient.query('SELECT uuidv7() AS id')).rows[0].id as string;
    const resolvedRiskEventId = (await fixtureClient.query('SELECT uuidv7() AS id')).rows[0].id as string;

    // Legal Slice 9 Case Event rows under 009's exact metadata shape.
    await fixtureClient.query(
      `INSERT INTO case_events (family_id, case_id, actor_account_id, event_type, metadata)
       VALUES ($1, $2, $3, 'CASE_SAFETY_HOLD_ENTERED', $4::jsonb)`,
      [
        familyId,
        caseId,
        accountId,
        JSON.stringify({
          fromStatus: 'OPEN',
          toStatus: 'SAFETY_HOLD',
          fromVersion: 1,
          toVersion: 2,
          riskEventId: holdRiskEventId,
        }),
      ]
    );
    await fixtureClient.query(
      `INSERT INTO case_events (family_id, case_id, actor_account_id, event_type, metadata)
       VALUES ($1, $2, $3, 'CASE_RISK_RESOLVED', $4::jsonb)`,
      [
        familyId,
        caseId,
        accountId,
        JSON.stringify({
          fromStatus: 'SAFETY_HOLD',
          toStatus: 'OPEN',
          fromVersion: 2,
          toVersion: 3,
          riskEventId: resolvedRiskEventId,
        }),
      ]
    );

    // Legal Slice 9 Business Audit rows.
    await fixtureClient.query(
      `INSERT INTO business_audit_events
         (family_id, actor_account_id, event_type, resource_type, resource_id, metadata)
       VALUES ($1, $2, 'CASE_SAFETY_HOLD_ENTERED', 'CASE', $3, $4::jsonb)`,
      [
        familyId,
        accountId,
        caseId,
        JSON.stringify({ riskEventId: holdRiskEventId }),
      ]
    );
    await fixtureClient.query(
      `INSERT INTO business_audit_events
         (family_id, actor_account_id, event_type, resource_type, resource_id, metadata)
       VALUES ($1, $2, 'CASE_RISK_RESOLVED', 'CASE', $3, $4::jsonb)`,
      [
        familyId,
        accountId,
        caseId,
        JSON.stringify({ riskEventId: resolvedRiskEventId }),
      ]
    );

    // Legal Slice 9 idempotency rows: modern bytea exact-key representation.
    for (const commandType of SLICE9_COMMANDS) {
      await fixtureClient.query(
        `INSERT INTO idempotency_keys
           (actor_account_id, command_type, idempotency_key, idempotency_key_bytes,
            request_hash, response_status, response_body)
         VALUES ($1, $2, NULL, $3, $4, 200, '{}'::jsonb)`,
        [
          accountId,
          commandType,
          Buffer.from(`t8final01-${commandType}-${Date.now()}`, 'utf16le'),
          'a'.repeat(64),
        ]
      );
    }

    const safetyRows = await readSafetyRows(fixtureClient, caseId);
    const records = await fixtureClient.query(
      'SELECT filename, applied_at FROM schema_migrations ORDER BY filename'
    );
    const migrationRecords = new Map<string, number>(
      records.rows.map((row) => [row.filename as string, new Date(row.applied_at).getTime()])
    );

    return {
      dbUrl: urlForDatabase(MIGRATION_URL, database),
      fixture: {
        accountId,
        personId,
        familyId,
        caseId,
        holdRiskEventId,
        resolvedRiskEventId,
      },
      migrationRecords,
      safetyRows,
    };
  } finally {
    await fixtureClient.end();
  }
}

async function readSafetyRows(client: Client, caseId: string): Promise<unknown> {
  const events = await client.query(
    `SELECT event_type, metadata FROM case_events WHERE case_id = $1 ORDER BY event_type`,
    [caseId]
  );
  const audits = await client.query(
    `SELECT event_type, metadata FROM business_audit_events WHERE resource_id = $1 ORDER BY event_type`,
    [caseId]
  );
  const idempotency = await client.query(
    `SELECT command_type, idempotency_key, idempotency_key_bytes, request_hash, response_status
       FROM idempotency_keys WHERE command_type IN ('CASE_ENTER_SAFETY_HOLD', 'CASE_RESOLVE_RISK')
      ORDER BY command_type`
  );
  return {
    events: events.rows,
    audits: audits.rows,
    idempotency: idempotency.rows,
  };
}

const createdDatabases: string[] = [];

afterAll(async () => {
  if (createdDatabases.length === 0) return;
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  try {
    for (const database of createdDatabases) {
      await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    }
  } finally {
    await admin.end();
  }
}, 120_000);

describe('S8-FINAL-01 current-main(009) → 008 → 010 upgrade', () => {
  it('official migrator SKIPs 009, APPLYs 008 then 010, and preserves Safety rows', async () => {
    const database = `xiaoshuyin_s8final01_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    createdDatabases.push(database);
    const pre = await buildPreState(database);

    const output = runMigrator(pre.dbUrl);
    expect(output).toContain('SKIP 009_safety_hold_control_foundation.sql');
    expect(output).toContain('APPLY 008_problem_formulation_core.sql');
    expect(output).toContain('APPLY 010_problem_formulation_safety_vocabulary_reconcile.sql');
    expect(output).not.toContain('APPLY 009_safety_hold_control_foundation.sql');
    expect(output).toMatch(/Migration complete: 8 new, 9 previously applied\./);

    const client = new Client({ connectionString: urlForDatabase(ADMIN_URL, database) });
    await client.connect();
    try {
      // Existing Safety rows are byte-for-byte unchanged and still present.
      expect(await readSafetyRows(client, pre.fixture.caseId)).toEqual(pre.safetyRows);
      const eventCount = await client.query(
        'SELECT count(*)::int AS n FROM case_events WHERE case_id = $1',
        [pre.fixture.caseId]
      );
      expect(eventCount.rows[0].n).toBe(2);

      // 008 and 010 recorded; pre-existing timestamps untouched.
      const records = await client.query(
        'SELECT filename, applied_at FROM schema_migrations ORDER BY filename'
      );
      const recordMap = new Map<string, number>(
        records.rows.map((row) => [row.filename as string, new Date(row.applied_at).getTime()])
      );
      for (const [filename, appliedAt] of pre.migrationRecords) {
        expect(recordMap.get(filename), filename).toBe(appliedAt);
      }
      expect(recordMap.has('008_problem_formulation_core.sql')).toBe(true);
      expect(recordMap.has('010_problem_formulation_safety_vocabulary_reconcile.sql')).toBe(true);

      await assertUnionConstraints(client);

      // A second migrator run is a real no-op.
      const second = runMigrator(pre.dbUrl);
      expect(second).toMatch(/Migration complete: 0 new, \d+ previously applied\./);
      expect(second).not.toContain('APPLY ');
    } finally {
      await client.end();
    }
  }, 180_000);

  it('008 alone is immediately legal on a Slice 9 database and yields the union', async () => {
    const database = `xiaoshuyin_s8final01_alone_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    createdDatabases.push(database);
    const pre = await buildPreState(database);

    const migrator = new Client({ connectionString: pre.dbUrl });
    await migrator.connect();
    try {
      const sql = readFileSync(join(MIGRATIONS_DIR, '008_problem_formulation_core.sql'), 'utf-8');
      await migrator.query('BEGIN');
      await migrator.query(sql);
      await migrator.query('COMMIT');
    } finally {
      await migrator.end();
    }

    const client = new Client({ connectionString: urlForDatabase(ADMIN_URL, database) });
    await client.connect();
    try {
      expect(await readSafetyRows(client, pre.fixture.caseId)).toEqual(pre.safetyRows);
      await assertUnionConstraints(client, false);
    } finally {
      await client.end();
    }
  }, 180_000);
});

async function assertUnionConstraints(
  client: Client,
  includeSupplementalConsentAudit = true,
  includeSlice12 = includeSupplementalConsentAudit,
  includeSlice14 = includeSlice12
): Promise<void> {
  const definitions = new Map<string, string>(
    (
      await client.query<{ conname: string; definition: string }>(
        `SELECT conname, pg_get_constraintdef(oid) AS definition
           FROM pg_constraint
          WHERE conname IN (
            'case_events_event_type_check',
            'case_events_metadata_shape_check',
            'business_audit_events_event_type_check',
            'business_audit_events_resource_type_check',
            'idempotency_keys_command_type_check',
            'idempotency_keys_key_representation_check'
          )`
      )
    ).rows.map((row) => [row.conname, row.definition])
  );

  const expectAll = (name: string, literals: string[]) => {
    const definition = definitions.get(name);
    expect(definition, name).toBeTruthy();
    for (const literal of literals) {
      expect(definition, `${name} must keep ${literal}`).toContain(`'${literal}'`);
    }
  };

  // Union means both sides are present *and* the pre-existing main side never
  // disappears. The exact Slice 8 + Slice 9 sets below are asserted as sets so
  // an accidental extra literal is also caught.
  const caseEventSet = new Set([
    'CASE_CREATED',
    'CASE_PRIMARY_ASSIGNED',
    'CASE_PRIMARY_REVOKED',
    ...SLICE8_CASE_EVENT_TYPES,
    ...SLICE9_CASE_EVENT_TYPES,
    ...(includeSlice12 ? ['CASE_DIGITAL_USE_NODE_COMPLETED'] : []),
  ]);
  const caseEventLiterals = literalsOf(definitions.get('case_events_event_type_check')!);
  expect(new Set(caseEventLiterals)).toEqual(caseEventSet);

  expectAll('case_events_metadata_shape_check', [
    ...SLICE8_CASE_EVENT_TYPES,
    ...SLICE9_CASE_EVENT_TYPES,
    ...(includeSlice12 ? ['CASE_DIGITAL_USE_NODE_COMPLETED'] : []),
  ]);
  const metadataShape = definitions.get('case_events_metadata_shape_check')!;
  for (const marker of ['riskEventId', 'fromVersion', 'toVersion', 'fromStatus', 'toStatus']) {
    expect(metadataShape).toContain(marker);
  }

  const auditEventSet = new Set([
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
    'CASE_PRIMARY_SWITCHED',
    ...SLICE8_AUDIT_EVENT_TYPES,
    ...SLICE9_AUDIT_EVENT_TYPES,
    ...(includeSupplementalConsentAudit
      ? [
          'CONSENT_SUPPLEMENTAL_ASSESSMENT_GRANTED',
          'CONSENT_SUPPLEMENTAL_ASSESSMENT_DECLINED',
          'CONSENT_SUPPLEMENTAL_ASSESSMENT_REVOKED',
        ]
      : []),
    ...(includeSlice12 ? ['DIGITAL_USE_NODE_COMPLETED'] : []),
    ...(includeSlice14
      ? [
          'PHONE_USE_CONTRACT_DRAFT_SAVED',
          'PHONE_USE_CONTRACT_CONFIRMED',
          'PHONE_USE_CONTRACT_ACTIVATED',
          'PHONE_USE_CONTRACT_SUPERSEDED',
          'PHONE_USE_ROLEPLAY_RECORDED',
        ]
      : []),
  ]);
  const auditLiterals = literalsOf(definitions.get('business_audit_events_event_type_check')!);
  expect(new Set(auditLiterals)).toEqual(auditEventSet);

  const resourceSet = new Set([
    'FAMILY',
    'PERSON',
    'CONSENT',
    'CASE',
    'DIALOGUE_MESSAGE',
    'ASSERTION',
    'OBSERVATION',
    'CASE_PARTICIPANT',
    'PROBLEM_FORMULATION',
  ]);
  const resourceLiterals = literalsOf(
    definitions.get('business_audit_events_resource_type_check')!
  );
  expect(new Set(resourceLiterals)).toEqual(resourceSet);

  const commandSet = new Set([
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
    'CASE_SWITCH_PRIMARY',
    ...SLICE8_COMMANDS,
    ...SLICE9_COMMANDS,
    ...(includeSlice12
      ? ['DIGITAL_USE_ASSESSMENT_RESUME', 'DIGITAL_USE_NODE_RESPONSE']
      : []),
    ...(includeSlice14
      ? [
          'PHONE_USE_CONTRACT_DRAFT_SAVE',
          'PHONE_USE_CONTRACT_CONFIRM',
          'PHONE_USE_CONTRACT_REVISE',
          'PHONE_USE_ROLEPLAY_CREATE',
          'PHONE_USE_ROLEPLAY_TURN',
          'PHONE_USE_ROLEPLAY_RATE',
          'PHONE_USE_ROLEPLAY_SELECT',
        ]
      : []),
  ]);
  const commandLiterals = literalsOf(definitions.get('idempotency_keys_command_type_check')!);
  expect(new Set(commandLiterals)).toEqual(commandSet);

  const keyRepresentation = definitions.get('idempotency_keys_key_representation_check')!;
  for (const literal of [
    'CASE_CREATE',
    'CASE_SWITCH_PRIMARY',
    'PROBLEM_FORMULATION_PRESENT',
    ...SLICE9_COMMANDS,
  ]) {
    expect(keyRepresentation, `key representation must keep ${literal}`).toContain(`'${literal}'`);
  }
  if (includeSlice12) {
    // Slice 12 reuses the existing text-key runIdempotentCommandInTransaction
    // owner path. Its commands belong to the command vocabulary but must not
    // be misclassified into the bytea-only switch/Safety branch.
    expect(keyRepresentation).not.toContain("'DIGITAL_USE_ASSESSMENT_RESUME'");
    expect(keyRepresentation).not.toContain("'DIGITAL_USE_NODE_RESPONSE'");
  }
  expect(keyRepresentation).toContain('idempotency_key_bytes IS NOT NULL');
}

// Keep the checked-in migration directory stable while the test runs.
void readdirSync;