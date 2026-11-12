/**
 * Slice 1 Consent Owner — 01004 narrow post-merge remediation migration proof.
 *
 * Real upgrade path, not just an empty bootstrap:
 *   1. create a throw-away database owned by the migrator role
 *   2. apply only 001–011 and record them in schema_migrations
 *   3. insert a representative existing guardian consent row
 *   4. run the real migrator (applies 012 + 013 only)
 *   5. assert old guardian data / invariants survive, supplemental rows are
 *      legal without fabricated guardian facts, and the new enum labels exist
 *   6. run the migrator again and require a zero-new no-op
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL']!;
const ROOT = new URL('../..', import.meta.url).pathname;

const PRE_REMEDIATION_MIGRATIONS = [
  '001_initial_schema.sql',
  '002_case_core.sql',
  '003_case_idempotency_key_bytes.sql',
  '004_evidence_core.sql',
  '004_identity_binding_runtime.sql',
  '005_case_participant_core.sql',
  '006_case_status_paused_removal.sql',
  '007_case_primary_switch.sql',
  '008_problem_formulation_core.sql',
  '009_safety_hold_control_foundation.sql',
  '010_problem_formulation_safety_vocabulary_reconcile.sql',
  '011_compliance_feature_policy_foundation.sql',
] as const;

const NEW_MIGRATIONS = [
  '012_consent_01004_supplemental_enums.sql',
  '013_consent_01004_supplemental_assessment.sql',
] as const;

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

interface GuardianSeed {
  accountId: string;
  personId: string;
  familyId: string;
  requestId: string;
  consentId: string;
}

const sha = (char: string) => char.repeat(64);

function supplementalEvidence(
  scope: {
    personId: string;
    caseId: string;
    actorAccountId: string;
  },
  decision = 'GRANTED'
) {
  return {
    evidence_kind: 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT',
    purpose: 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT',
    disclosure_reference: 'test-only-01004-disclosure-fixture',
    disclosure_version: 'v1',
    disclosure_hash: sha('a'),
    confirmation_statement_hash: sha('b'),
    decision,
    decision_actor_person_id: scope.personId,
    case_id: scope.caseId,
    decided_at: new Date().toISOString(),
    client_ip_hash: sha('c'),
    user_agent_hash: sha('d'),
  };
}

describe('Consent 01004 supplemental migration upgrade', () => {
  let admin: Client;
  let migrator: Client;
  let seedAdmin: Client;
  let database: string;
  let upgradeUrl: string;
  let guardian: GuardianSeed;

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    database = `xiaoshuyin_consent_up_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await admin.query(`CREATE DATABASE "${database}" OWNER xiaoshuyin_migrator`);

    upgradeUrl = urlForDatabase(MIGRATION_URL, database);

    migrator = new Client({ connectionString: upgradeUrl });
    await migrator.connect();
    await migrator.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    for (const filename of PRE_REMEDIATION_MIGRATIONS) {
      const sql = readFileSync(join(ROOT, 'db', 'migrations', filename), 'utf-8');
      await migrator.query('BEGIN');
      await migrator.query(sql);
      await migrator.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      await migrator.query('COMMIT');
    }

    seedAdmin = new Client({ connectionString: urlForDatabase(ADMIN_URL, database) });
    await seedAdmin.connect();

    const account = await seedAdmin.query(
      `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
      [`consent_up_${crypto.randomUUID()}`]
    );
    const accountId = account.rows[0].id;
    const person = await seedAdmin.query(
      `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
      [accountId]
    );
    const personId = person.rows[0].id;
    const family = await seedAdmin.query(
      `INSERT INTO families (created_by_person_id) VALUES ($1) RETURNING id`,
      [personId]
    );
    const familyId = family.rows[0].id;
    await seedAdmin.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`, [
      familyId,
      personId,
    ]);

    const request = await seedAdmin.query(
      `INSERT INTO guardian_consent_requests
         (family_id, guardian_person_id, declared_age_band, notice_version, notice_hash,
          status, expires_at, completed_at)
       VALUES ($1, $2, 'UNDER_14', 'v1', $3, 'GRANTED', now() + interval '24 hours', now())
       RETURNING id`,
      [familyId, personId, sha('a')]
    );
    const requestId = request.rows[0].id;
    const consent = await seedAdmin.query(
      `INSERT INTO consent_records (
         family_id, guardian_person_id, guardian_account_id, purpose, decision, version,
         onboarding_request_id, notice_version, notice_hash, policy_version, evidence
       ) VALUES ($1, $2, $3, 'UNDER_14_GUARDIAN_CONSENT', 'GRANTED', 1, $4, 'v1', $5, 'v1', '{}')
       RETURNING id`,
      [familyId, personId, accountId, requestId, sha('a')]
    );
    guardian = {
      accountId,
      personId,
      familyId,
      requestId,
      consentId: consent.rows[0].id,
    };
  }, 120_000);

  afterAll(async () => {
    await seedAdmin?.end().catch(() => {});
    await migrator?.end().catch(() => {});
    if (admin && database) {
      await admin
        .query(
          'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
          [database]
        )
        .catch(() => {});
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`).catch(() => {});
    }
    await admin?.end().catch(() => {});
  }, 120_000);

  it('applies the two new forward migrations over existing guardian data', async () => {
    const output = runMigrator(upgradeUrl);
    for (const filename of PRE_REMEDIATION_MIGRATIONS) {
      expect(output).toContain(`SKIP ${filename}`);
    }
    for (const filename of NEW_MIGRATIONS) {
      expect(output).toContain(`APPLY ${filename}`);
    }
    expect(output).toMatch(/Migration complete: 2 new, 12 previously applied\./);
    expect(output).toContain('Verified: app role has no DDL permissions.');
  });

  it('preserves every existing guardian row and guardian invariant', async () => {
    const { rows } = await seedAdmin.query(
      `SELECT family_id, guardian_person_id, guardian_account_id, purpose, decision,
              version, onboarding_request_id, notice_version, notice_hash, evidence
         FROM consent_records WHERE id = $1`,
      [guardian.consentId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      family_id: guardian.familyId,
      guardian_person_id: guardian.personId,
      guardian_account_id: guardian.accountId,
      purpose: 'UNDER_14_GUARDIAN_CONSENT',
      decision: 'GRANTED',
      version: 1,
      onboarding_request_id: guardian.requestId,
      notice_version: 'v1',
      notice_hash: sha('a'),
    });

    // Guardian branch keeps exactly GRANTED / REVOKED after the upgrade.
    await expect(
      seedAdmin.query(
        `INSERT INTO consent_records (
           family_id, guardian_person_id, guardian_account_id, purpose, decision, version,
           onboarding_request_id, notice_version, notice_hash, policy_version, evidence
         ) VALUES ($1, $2, $3, 'UNDER_14_GUARDIAN_CONSENT', 'DECLINED', 2, NULL, 'v1', $4, 'v1', '{}')`,
        [guardian.familyId, guardian.personId, guardian.accountId, sha('a')]
      )
    ).rejects.toThrow();
  });

  it('accepts supplemental rows without guardian / onboarding facts after the upgrade', async () => {
    const kase = await seedAdmin.query(
      `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
       VALUES ($1, $2, 'OPEN', 'INTAKE', false, 1) RETURNING id`,
      [guardian.familyId, guardian.personId]
    );
    const caseId = kase.rows[0].id;
    const evidence = supplementalEvidence({
      personId: guardian.personId,
      caseId,
      actorAccountId: guardian.accountId,
    });
    const { rows } = await seedAdmin.query(
      `INSERT INTO consent_records (
         family_id, guardian_person_id, guardian_account_id, purpose, decision, version,
         onboarding_request_id, bound_person_id, bound_at,
         case_id, decision_actor_person_id, decision_actor_account_id,
         disclosure_reference, confirmation_statement_hash,
         notice_version, notice_hash, policy_version, evidence, decided_at
       ) VALUES (
         $1, NULL, NULL, 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT', 'GRANTED', 1,
         NULL, NULL, NULL,
         $2, $3, $4,
         $5, $6,
         'v1', $7, 'v1', $8, now()
       ) RETURNING id, decision, version`,
      [
        guardian.familyId,
        caseId,
        guardian.personId,
        guardian.accountId,
        evidence.disclosure_reference,
        evidence.confirmation_statement_hash,
        evidence.disclosure_hash,
        JSON.stringify(evidence),
      ]
    );
    expect(rows[0]).toMatchObject({ decision: 'GRANTED', version: 1 });
  });

  it('exposes the exact new enum labels without reordering the existing ones', async () => {
    const { rows } = await migrator.query(
      `SELECT t.typname, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
         FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
         JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname IN ('consent_decision','consent_purpose')
        GROUP BY t.typname`
    );
    const enums = Object.fromEntries(rows.map((r: any) => [r.typname, r.labels]));
    expect(enums['consent_decision']).toEqual(['GRANTED', 'REVOKED', 'DECLINED']);
    expect(enums['consent_purpose']).toEqual([
      'UNDER_14_GUARDIAN_CONSENT',
      'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT',
    ]);
  });

  it('records both new migrations and a second apply is a zero-new no-op', async () => {
    const before = await schemaFingerprint(migrator);
    const output = runMigrator(upgradeUrl);
    expect(output).toMatch(/Migration complete: 0 new, 14 previously applied\./);
    const after = await schemaFingerprint(migrator);
    expect(after).toEqual(before);

    const { rows } = await migrator.query('SELECT filename FROM schema_migrations ORDER BY filename');
    expect(rows.map((r: any) => r.filename)).toEqual([
      ...PRE_REMEDIATION_MIGRATIONS,
      ...NEW_MIGRATIONS,
    ]);
  });
it('bootstraps the full schema from an empty database', async () => {
    const freshDatabase = `xiaoshuyin_consent_fresh_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await admin.query(`CREATE DATABASE "${freshDatabase}" OWNER xiaoshuyin_migrator`);
    const freshUrl = urlForDatabase(MIGRATION_URL, freshDatabase);
    let fresh: Client | null = null;
    try {
      const output = runMigrator(freshUrl);
      expect(output).toMatch(/Migration complete: 14 new, 0 previously applied\./);

      fresh = new Client({ connectionString: urlForDatabase(ADMIN_URL, freshDatabase) });
      await fresh.connect();

      const enumRows = await fresh.query(
        `SELECT t.typname, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
           FROM pg_type t
           JOIN pg_enum e ON e.enumtypid = t.oid
           JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' AND t.typname IN ('consent_decision','consent_purpose')
          GROUP BY t.typname`
      );
      const enums = Object.fromEntries(enumRows.rows.map((r: any) => [r.typname, r.labels]));
      expect(enums['consent_decision']).toEqual(['GRANTED', 'REVOKED', 'DECLINED']);
      expect(enums['consent_purpose']).toEqual([
        'UNDER_14_GUARDIAN_CONSENT',
        'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT',
      ]);

      const triggerRows = await fresh.query(
        `SELECT tgname FROM pg_trigger
          WHERE NOT tgisinternal
            AND tgname IN ('consent_records_guard',
                           'consent_records_supplemental_insert_guard',
                           'consent_records_supplemental_update_guard')
          ORDER BY tgname`
      );
      expect(triggerRows.rows.map((r: any) => r.tgname)).toEqual([
        'consent_records_guard',
        'consent_records_supplemental_insert_guard',
        'consent_records_supplemental_update_guard',
      ]);

      const columnRows = await fresh.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'consent_records'`
      );
      const columns = columnRows.rows.map((r: any) => r.column_name);
      for (const column of [
        'case_id',
        'decision_actor_person_id',
        'decision_actor_account_id',
        'disclosure_reference',
        'confirmation_statement_hash',
      ]) {
        expect(columns).toContain(column);
      }

      // A supplemental row is legal on a pristine database with no guardian
      // request / guardian identity / onboarding facts.
      const account = await fresh.query(
        `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
        [`consent_fresh_${crypto.randomUUID()}`]
      );
      const accountId = account.rows[0].id;
      const person = await fresh.query(
        `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
        [accountId]
      );
      const personId = person.rows[0].id;
      const family = await fresh.query(
        `INSERT INTO families (created_by_person_id) VALUES ($1) RETURNING id`,
        [personId]
      );
      const familyId = family.rows[0].id;
      await fresh.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`, [
        familyId,
        personId,
      ]);
      const kase = await fresh.query(
        `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
         VALUES ($1, $2, 'OPEN', 'INTAKE', false, 1) RETURNING id`,
        [familyId, personId]
      );
      const caseId = kase.rows[0].id;
      const evidence = supplementalEvidence(
        { personId, caseId, actorAccountId: accountId },
        'DECLINED'
      );
      const inserted = await fresh.query(
        `INSERT INTO consent_records (
           family_id, guardian_person_id, guardian_account_id, purpose, decision, version,
           onboarding_request_id, bound_person_id, bound_at,
           case_id, decision_actor_person_id, decision_actor_account_id,
           disclosure_reference, confirmation_statement_hash,
           notice_version, notice_hash, policy_version, evidence, decided_at
         ) VALUES (
           $1, NULL, NULL, 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT', 'DECLINED', 1,
           NULL, NULL, NULL,
           $2, $3, $4,
           $5, $6,
           'v1', $7, 'v1', $8, now()
         ) RETURNING id, decision`,
        [
          familyId,
          caseId,
          personId,
          accountId,
          evidence.disclosure_reference,
          evidence.confirmation_statement_hash,
          evidence.disclosure_hash,
          JSON.stringify(evidence),
        ]
      );
      expect(inserted.rows[0].decision).toBe('DECLINED');
    } finally {
      if (fresh) await fresh.end().catch(() => {});
      await admin
        .query(
          'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
          [freshDatabase]
        )
        .catch(() => {});
      await admin.query(`DROP DATABASE IF EXISTS "${freshDatabase}"`).catch(() => {});
    }
  }, 120_000);
});

async function schemaFingerprint(client: Client): Promise<string> {
  const [enums, tables, policies, triggers] = await Promise.all([
    client.query(`SELECT t.typname FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
                   JOIN pg_namespace n ON n.oid = t.typnamespace
                  WHERE n.nspname = 'public' GROUP BY t.typname ORDER BY t.typname`),
    client.query(`SELECT tablename FROM pg_tables
                   WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
                   ORDER BY tablename`),
    client.query(`SELECT policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY policyname`),
    client.query(`SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname`),
  ]);
  return [
    enums.rows.map((r: any) => r.typname).join(','),
    tables.rows.map((r: any) => r.tablename).join(','),
    policies.rows.map((r: any) => r.policyname).join(','),
    triggers.rows.map((r: any) => r.tgname).join(','),
  ].join('|');
}