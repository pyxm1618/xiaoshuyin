import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto, { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL']!;
const ROOT = new URL('../..', import.meta.url).pathname;
const REMEDIATION =
  '025_slice16_post_merge_forensic_remediation.sql';

function urlForDatabase(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = '/' + database;
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

describe('Slice 16 post-merge forward migration upgrade', () => {
  let control: Client;
  let migrator: Client;
  let observer: Client;
  let database: string;
  let upgradeUrl: string;
  let definitionId: string;
  let replacementId: string;
  let preRemediationFiles: string[];

  beforeAll(async () => {
    control = new Client({ connectionString: ADMIN_URL });
    await control.connect();
    database =
      'xiaoshuyin_s16_postmerge_' +
      Date.now() +
      '_' +
      Math.floor(Math.random() * 1e6);
    await control.query(
      'CREATE DATABASE "' + database + '" OWNER xiaoshuyin_migrator'
    );

    upgradeUrl = urlForDatabase(MIGRATION_URL, database);
    migrator = new Client({ connectionString: upgradeUrl });
    await migrator.connect();

    await migrator.query(
      'CREATE TABLE schema_migrations (' +
        'filename text PRIMARY KEY,' +
        'applied_at timestamptz NOT NULL DEFAULT now()' +
      ')'
    );

    preRemediationFiles = readdirSync(join(ROOT, 'db', 'migrations'))
      .filter((name) => name.endsWith('.sql') && name !== REMEDIATION)
      .sort();
    expect(preRemediationFiles.at(-1)).toBe(
      '024_psychological_behavioral_intervention_contract.sql'
    );

    for (const filename of preRemediationFiles) {
      const sql = readFileSync(
        join(ROOT, 'db', 'migrations', filename),
        'utf8'
      );
      await migrator.query('BEGIN');
      try {
        await migrator.query(sql);
        await migrator.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await migrator.query('COMMIT');
      } catch (error) {
        await migrator.query('ROLLBACK');
        throw error;
      }
    }

    observer = new Client({
      connectionString: urlForDatabase(ADMIN_URL, database),
    });
    await observer.connect();

    const account = await observer.query<{ id: string }>(
      'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
      ['s16-postmerge-' + crypto.randomUUID()]
    );
    const accountId = account.rows[0]!.id;
    const person = await observer.query<{ id: string }>(
      'INSERT INTO persons (account_id,created_by_account_id) ' +
        'VALUES ($1,$1) RETURNING id',
      [accountId]
    );
    const personId = person.rows[0]!.id;
    await observer.query(
      "INSERT INTO staff_assignments " +
        "(account_id,person_id,capability,scope_type,granted_by_account_id) " +
        "VALUES ($1,$2,'PROFESSIONAL_REVIEW','GLOBAL',$1)",
      [accountId, personId]
    );

    const semanticHash = createHash('sha256')
      .update('slice16-post-merge-upgrade-fixture')
      .digest('hex');
    const inserted = await observer.query<{ id: string }>(
      "INSERT INTO intervention_definitions (" +
        "scene_id,intervention_code,version,content_hash,definition_state," +
        "target_problem_or_mechanism,formulation_dependencies," +
        "supporting_evidence_requirements,applicable_conditions," +
        "exclusion_or_contraindication_conditions,age_and_development_scope," +
        "rationale,intervention_steps,participation_and_consent_requirements," +
        "baseline_and_observation,expected_observable_change,burden_and_barriers," +
        "adverse_or_worsening_signals,review_window_and_criteria," +
        "stop_reassess_safety_referral_conditions,allowed_combinations," +
        "conflicting_interventions,professional_source_refs,created_by_person_id" +
      ") VALUES (" +
        "$1,$2,1,$3,'CANDIDATE'," +
        "$4,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb," +
        "$5::jsonb,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb," +
        "'[]'::jsonb,'[]'::jsonb,$11::jsonb,$12::jsonb," +
        "'[]'::jsonb,'[]'::jsonb,$13::jsonb,$14" +
      ") RETURNING id",
      [
        'DIGITAL_USE',
        'TEST_S16_POST_MERGE_UPGRADE',
        semanticHash,
        'Upgrade fixture',
        JSON.stringify({
          min_age_years: null,
          max_age_years: null,
          development_stages: [],
        }),
        'Upgrade rationale',
        JSON.stringify(['STEP:A']),
        JSON.stringify({
          required_participation_refs: [],
          required_consent_purposes: [],
        }),
        JSON.stringify({ baseline_refs: [], observation_refs: [] }),
        JSON.stringify(['Observable change']),
        JSON.stringify({
          min_days: 1,
          max_days: null,
          criteria: ['Review'],
        }),
        JSON.stringify(['Stop']),
        JSON.stringify(['SOURCE:UPGRADE']),
        personId,
      ]
    );
    definitionId = inserted.rows[0]!.id;
    replacementId = crypto.randomUUID();
  }, 120_000);

  afterAll(async () => {
    await observer?.end().catch(() => undefined);
    await migrator?.end().catch(() => undefined);
    if (control && database) {
      await control
        .query(
          'SELECT pg_terminate_backend(pid) FROM pg_stat_activity ' +
            'WHERE datname=$1 AND pid<>pg_backend_pid()',
          [database]
        )
        .catch(() => undefined);
      await control
        .query('DROP DATABASE IF EXISTS "' + database + '"')
        .catch(() => undefined);
    }
    await control?.end().catch(() => undefined);
  }, 120_000);

  it('upgrades the exact current-main 001-024 ledger with only the forward remediation migration', () => {
    const output = runMigrator(upgradeUrl);
    for (const filename of preRemediationFiles) {
      expect(output).toContain('SKIP ' + filename);
    }
    expect(output).toContain('APPLY ' + REMEDIATION);
    expect(output).toContain(
      'Migration complete: 1 new, ' +
        preRemediationFiles.length +
        ' previously applied.'
    );
    expect(output).toContain('Verified: app role has no DDL permissions.');
  }, 120_000);

  it('preserves existing rows and adds id to the immutable update guard without breaking legal terminal transition', async () => {
    const before = await observer.query<{
      id: string;
      definition_state: string;
      revision: number;
      intervention_code: string;
    }>(
      'SELECT id,definition_state,revision,intervention_code ' +
        'FROM intervention_definitions WHERE id=$1',
      [definitionId]
    );
    expect(before.rows[0]).toEqual({
      id: definitionId,
      definition_state: 'CANDIDATE',
      revision: 1,
      intervention_code: 'TEST_S16_POST_MERGE_UPGRADE',
    });

    await expect(
      observer.query(
        "UPDATE intervention_definitions " +
          "SET id=$2,definition_state='RETIRED',revision=revision+1," +
          "retired_at=clock_timestamp() WHERE id=$1",
        [definitionId, replacementId]
      )
    ).rejects.toMatchObject({ code: '23514' });

    const afterRejected = await observer.query<{
      id: string;
      definition_state: string;
      revision: number;
    }>(
      'SELECT id,definition_state,revision FROM intervention_definitions WHERE id=$1',
      [definitionId]
    );
    expect(afterRejected.rows[0]).toEqual({
      id: definitionId,
      definition_state: 'CANDIDATE',
      revision: 1,
    });

    const retired = await observer.query<{
      id: string;
      definition_state: string;
      revision: number;
    }>(
      "UPDATE intervention_definitions " +
        "SET definition_state='RETIRED',revision=revision+1," +
        "retired_at=clock_timestamp() WHERE id=$1 " +
        "RETURNING id,definition_state,revision",
      [definitionId]
    );
    expect(retired.rows[0]).toEqual({
      id: definitionId,
      definition_state: 'RETIRED',
      revision: 2,
    });
  });

  it('replay is a checksum-verified no-op with the complete ledger intact', async () => {
    const output = runMigrator(upgradeUrl);
    expect(output).not.toContain('APPLY ');
    expect(output).toContain(
      'Migration complete: 0 new, ' +
        (preRemediationFiles.length + 1) +
        ' previously applied.'
    );

    const ledger = await observer.query<{
      filename: string;
      content_checksum: string | null;
      checksum_origin: string | null;
    }>(
      'SELECT filename,content_checksum,checksum_origin ' +
        'FROM schema_migrations ORDER BY filename'
    );
    expect(ledger.rows).toHaveLength(preRemediationFiles.length + 1);
    expect(ledger.rows.every((row) =>
      row.content_checksum !== null &&
      /^[0-9a-f]{64}$/.test(row.content_checksum) &&
      (row.checksum_origin === 'APPLIED' ||
        row.checksum_origin === 'LEGACY_BASELINE')
    )).toBe(true);
    expect(ledger.rows.at(-1)?.filename).toBe(REMEDIATION);
  }, 120_000);
});
