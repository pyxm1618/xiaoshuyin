import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;
const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL']!;
const REMEDIATION =
  '025_slice16_post_merge_forensic_remediation.sql';

function quoteIdent(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"';
}

function urlForDatabase(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = '/' + database;
  return url.toString();
}

function runMigrator(root: string, databaseUrl: string): string {
  return execFileSync(process.execPath, [join(root, 'scripts', 'db-migrate.mjs')], {
    cwd: root,
    env: { ...process.env, MIGRATION_DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    timeout: 120_000,
  });
}

async function definitionInvariant(client: Client, id: string) {
  const row = await client.query(
    `SELECT id,scene_id,intervention_code,version,content_hash,
            definition_state,revision,target_problem_or_mechanism,
            rationale,created_by_person_id,created_at
       FROM intervention_definitions WHERE id=$1`,
    [id]
  );
  return row.rows[0];
}

async function policyFingerprint(client: Client): Promise<string> {
  const result = await client.query(`
    SELECT policyname,cmd,qual,with_check
      FROM pg_policies
     WHERE schemaname='public'
       AND tablename='intervention_definitions'
     ORDER BY policyname
  `);
  return JSON.stringify(result.rows);
}

async function constraintFingerprint(client: Client): Promise<string> {
  const result = await client.query(`
    SELECT conname,pg_get_constraintdef(oid,true) AS definition
      FROM pg_constraint
     WHERE conrelid='public.intervention_definitions'::regclass
     ORDER BY conname
  `);
  return JSON.stringify(result.rows);
}

describe('Slice 16 current-main 024 -> forensic remediation 025 upgrade', () => {
  let admin: Client;
  let database = '';
  let databaseUrl = '';
  let mainOnlyRoot = '';
  let existingDefinitionId = '';
  let beforeDefinition: unknown;
  let beforePolicies = '';
  let beforeConstraints = '';
  let beforeHistoricalChecksums: Array<Record<string, unknown>> = [];

  beforeAll(async () => {
    if (!ADMIN_URL || !MIGRATION_URL) {
      throw new Error('TEST_ADMIN_DATABASE_URL and MIGRATION_DATABASE_URL are required');
    }
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();

    database =
      'xiaoshuyin_s16_024_to_025_' +
      Date.now() +
      '_' +
      Math.floor(Math.random() * 1e6);
    const migrationUrl = new URL(MIGRATION_URL);
    const migrationOwner = decodeURIComponent(migrationUrl.username);
    await admin.query(
      `CREATE DATABASE ${quoteIdent(database)} OWNER ${quoteIdent(migrationOwner)}`
    );
    databaseUrl = urlForDatabase(MIGRATION_URL, database);

    mainOnlyRoot = mkdtempSync(join(ROOT, 'tests', '.tmp-s16-main-migrations-'));
    mkdirSync(join(mainOnlyRoot, 'scripts'), { recursive: true });
    mkdirSync(join(mainOnlyRoot, 'db', 'migrations'), { recursive: true });
    copyFileSync(
      join(ROOT, 'scripts', 'db-migrate.mjs'),
      join(mainOnlyRoot, 'scripts', 'db-migrate.mjs')
    );
    for (const name of readdirSync(join(ROOT, 'db', 'migrations')).sort()) {
      if (!name.endsWith('.sql') || name === REMEDIATION) continue;
      copyFileSync(
        join(ROOT, 'db', 'migrations', name),
        join(mainOnlyRoot, 'db', 'migrations', name)
      );
    }

    const mainOutput = runMigrator(mainOnlyRoot, databaseUrl);
    expect(mainOutput).toContain('APPLY 024_psychological_behavioral_intervention_contract.sql');
    expect(mainOutput).not.toContain(REMEDIATION);

    const db = new Client({
      connectionString: urlForDatabase(ADMIN_URL, database),
    });
    await db.connect();
    try {
      const account = await db.query(
        "INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id",
        ['s16-upgrade-' + database]
      );
      const person = await db.query(
        "INSERT INTO persons (account_id,created_by_account_id) VALUES ($1,$1) RETURNING id",
        [account.rows[0]!.id]
      );
      const inserted = await db.query(
        `INSERT INTO intervention_definitions (
           scene_id,intervention_code,version,content_hash,definition_state,revision,
           target_problem_or_mechanism,formulation_dependencies,
           supporting_evidence_requirements,applicable_conditions,
           exclusion_or_contraindication_conditions,age_and_development_scope,
           rationale,intervention_steps,participation_and_consent_requirements,
           baseline_and_observation,expected_observable_change,burden_and_barriers,
           adverse_or_worsening_signals,review_window_and_criteria,
           stop_reassess_safety_referral_conditions,allowed_combinations,
           conflicting_interventions,professional_source_refs,created_by_person_id
         ) VALUES (
           'DIGITAL_USE','UPGRADE_PRESERVE',1,$1,'CANDIDATE',1,
           'upgrade-preserve','[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
           '{"development_stages":[]}'::jsonb,'upgrade-preserve','[]'::jsonb,
           '{"required_participation_refs":[],"required_consent_purposes":[]}'::jsonb,
           '{}'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb,
           '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,$2
         ) RETURNING id`,
        ['a'.repeat(64), person.rows[0]!.id]
      );
      existingDefinitionId = inserted.rows[0]!.id;
      beforeDefinition = await definitionInvariant(db, existingDefinitionId);
      beforePolicies = await policyFingerprint(db);
      beforeConstraints = await constraintFingerprint(db);
      const checksums = await db.query(
        `SELECT filename,content_checksum,checksum_origin
           FROM schema_migrations
          WHERE filename <> $1
          ORDER BY filename`,
        [REMEDIATION]
      );
      beforeHistoricalChecksums = checksums.rows;
      expect(beforeHistoricalChecksums).toHaveLength(27);
    } finally {
      await db.end();
    }
  }, 120_000);

  afterAll(async () => {
    if (admin && database) {
      await admin
        .query(
          'SELECT pg_terminate_backend(pid) FROM pg_stat_activity ' +
            'WHERE datname=$1 AND pid<>pg_backend_pid()',
          [database]
        )
        .catch(() => undefined);
      await admin
        .query(`DROP DATABASE IF EXISTS ${quoteIdent(database)}`)
        .catch(() => undefined);
    }
    await admin?.end().catch(() => undefined);
    if (mainOnlyRoot) {
      rmSync(mainOnlyRoot, { recursive: true, force: true });
    }
  }, 120_000);

  it('applies only 025 over exact current-main migrations and preserves rows, policies, constraints and historical checksums', async () => {
    const output = runMigrator(ROOT, databaseUrl);
    expect(output).toContain('SKIP 024_psychological_behavioral_intervention_contract.sql');
    expect(output).toContain('APPLY ' + REMEDIATION);
    expect(output).toMatch(/Migration complete: 1 new, 27 previously applied\./);

    const db = new Client({
      connectionString: urlForDatabase(ADMIN_URL, database),
    });
    await db.connect();
    try {
      expect(await definitionInvariant(db, existingDefinitionId)).toEqual(
        beforeDefinition
      );
      expect(await policyFingerprint(db)).toBe(beforePolicies);
      expect(await constraintFingerprint(db)).toBe(beforeConstraints);

      const historical = await db.query(
        `SELECT filename,content_checksum,checksum_origin
           FROM schema_migrations
          WHERE filename <> $1
          ORDER BY filename`,
        [REMEDIATION]
      );
      expect(historical.rows).toEqual(beforeHistoricalChecksums);

      const rls = await db.query(
        `SELECT relrowsecurity,relforcerowsecurity
           FROM pg_class
          WHERE oid='public.intervention_definitions'::regclass`
      );
      expect(rls.rows[0]).toEqual({
        relrowsecurity: true,
        relforcerowsecurity: true,
      });

      await expect(
        db.query(
          `UPDATE intervention_definitions
              SET id=uuidv7(),definition_state='RETIRED',
                  revision=revision+1,retired_at=clock_timestamp()
            WHERE id=$1`,
          [existingDefinitionId]
        )
      ).rejects.toMatchObject({ code: '23514' });

      expect(await definitionInvariant(db, existingDefinitionId)).toEqual(
        beforeDefinition
      );

      const retired = await db.query(
        `UPDATE intervention_definitions
            SET definition_state='RETIRED',
                revision=revision+1,
                retired_at=clock_timestamp()
          WHERE id=$1
          RETURNING id,definition_state,revision`,
        [existingDefinitionId]
      );
      expect(retired.rows[0]).toEqual({
        id: existingDefinitionId,
        definition_state: 'RETIRED',
        revision: 2,
      });
    } finally {
      await db.end();
    }
  }, 120_000);

  it('replays as a zero-new no-op with the upgraded schema unchanged', async () => {
    const db = new Client({
      connectionString: urlForDatabase(ADMIN_URL, database),
    });
    await db.connect();
    try {
      const before = {
        definition: await definitionInvariant(db, existingDefinitionId),
        policies: await policyFingerprint(db),
        constraints: await constraintFingerprint(db),
      };
      const output = runMigrator(ROOT, databaseUrl);
      expect(output).toMatch(/Migration complete: 0 new, 28 previously applied\./);
      expect(output).not.toContain('APPLY ' + REMEDIATION);
      expect({
        definition: await definitionInvariant(db, existingDefinitionId),
        policies: await policyFingerprint(db),
        constraints: await constraintFingerprint(db),
      }).toEqual(before);
    } finally {
      await db.end();
    }
  }, 120_000);
});
