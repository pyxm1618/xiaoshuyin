/**
 * T1008 / T1009 — Controlled reviewed publication, supersession, concurrency,
 * overlap protection and runtime least privilege.
 *
 * Publication is deployment/provisioning only: the migrator calls the reviewed
 * `app.publish_compliance_feature_policy(...)` representation. The runtime role
 * has no publication command and no mutation privilege.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL']!;
const ROOT = new URL('../..', import.meta.url).pathname;

const PREFIX = `S10PUB_${Date.now()}_`;

function urlForDatabase(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

function runMigrator(connectionString: string): void {
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'db-migrate.mjs')], {
    cwd: ROOT,
    env: { ...process.env, MIGRATION_DATABASE_URL: connectionString },
    encoding: 'utf8',
    timeout: 120_000,
  });
}

function featureCode(suffix: string): string {
  return `${PREFIX}${suffix}`.toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 120);
}

const FUNCTION_SQL = `
  SELECT app.publish_compliance_feature_policy(
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
  ) AS id`;

interface PublishInput {
  code: string;
  revision?: string;
  expectedVersion: number | null;
  version: number;
  applicability?: 'REQUIRED' | 'NOT_APPLICABLE' | 'UNKNOWN';
  minorRule?: 'BASELINE' | 'MINORS_BLOCKED';
  aiRule?: 'BASELINE' | 'REQUIRED';
  labelRule?: 'BASELINE' | 'REQUIRED';
  usageRule?: 'BASELINE' | 'REQUIRED';
  basis?: string | null;
  evidence?: string | null;
  effectiveFrom: Date;
}

function args(input: PublishInput): unknown[] {
  const applicability = input.applicability ?? 'NOT_APPLICABLE';
  return [
    input.code,
    input.revision ?? 'v1',
    input.expectedVersion,
    input.version,
    applicability,
    input.minorRule ?? 'BASELINE',
    input.aiRule ?? 'BASELINE',
    input.labelRule ?? 'BASELINE',
    input.usageRule ?? 'BASELINE',
    input.basis ?? (applicability === 'UNKNOWN' ? null : 'reviewed decision basis'),
    input.evidence ?? (applicability === 'UNKNOWN' ? null : 'evidence://review/1'),
    input.effectiveFrom,
    `migration:${PREFIX}`,
  ];
}

async function publish(client: Client, input: PublishInput): Promise<string> {
  const result = await client.query<{ id: string }>(FUNCTION_SQL, args(input));
  return result.rows[0]!.id;
}

describe('compliance feature-policy publication and concurrency', () => {
  let admin: Client;
  let migrator: Client;
  let app: Client;
  let database: string;
  let freshMigrationUrl: string;

  beforeAll(async () => {
    // Hermetic: apply the reviewed migration file to a fresh database so the
    // suite proves exactly the checked-in privilege/RLS contract.
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    database = `xiaoshuyin_s10_pub_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await admin.query(`CREATE DATABASE "${database}" OWNER xiaoshuyin_migrator`);

    const migrationUrl = urlForDatabase(MIGRATION_URL, database);
    freshMigrationUrl = migrationUrl;
    runMigrator(migrationUrl);

    migrator = new Client({ connectionString: migrationUrl });
    app = new Client({ connectionString: urlForDatabase(ADMIN_URL, database) });
    await Promise.all([migrator.connect(), app.connect()]);
    // A dropped throwaway database must never surface as an uncaught pg error.
    app.on('error', () => undefined);
    migrator.on('error', () => undefined);
    // Exercise the runtime privilege boundary with the real runtime role.
    await app.query('SET ROLE xiaoshuyin_app');
  }, 120_000);

  afterAll(async () => {
    // Close the runtime/migrator clients BEFORE dropping the throwaway database:
    // force-terminating a live connection surfaces as an unhandled 57P01 and
    // can race neighbouring DB suites in the same worker.
    await app?.end().catch(() => undefined);
    await migrator?.end().catch(() => undefined);
    await admin?.query(`DROP DATABASE IF EXISTS "${database}"`).catch(() => undefined);
    await admin?.end().catch(() => undefined);
  }, 120_000);

  it('publishes the first reviewed version and runtime sees only it', async () => {
    const code = featureCode('FIRST');
    const id = await publish(migrator, {
      code,
      expectedVersion: null,
      version: 1,
      effectiveFrom: new Date(Date.now() - 60_000),
    });

    const runtime = await app.query<{ id: string; policy_version: number }>(
      `SELECT id::text AS id, policy_version
         FROM compliance_feature_policies
        WHERE feature_code = $1`,
      [code]
    );
    expect(runtime.rows).toEqual([{ id, policy_version: 1 }]);
  });

  it('supersedes atomically: new version is effective, old version stays traceable', async () => {
    const code = featureCode('SUPERSEDE');
    const start = new Date(Date.now() - 120_000);
    const nextStart = new Date(Date.now() - 60_000);

    const v1 = await publish(migrator, {
      code,
      expectedVersion: null,
      version: 1,
      effectiveFrom: start,
    });

    const v2 = await publish(migrator, {
      code,
      expectedVersion: 1,
      version: 2,
      applicability: 'REQUIRED',
      aiRule: 'REQUIRED',
      usageRule: 'REQUIRED',
      effectiveFrom: nextStart,
    });

    const history = await migrator.query<{
      id: string;
      policy_version: number;
      effective_from: Date;
      effective_until: Date | null;
      superseded_by_policy_id: string | null;
      decision_basis: string | null;
    }>(
      `SELECT id::text AS id, policy_version, effective_from, effective_until,
              superseded_by_policy_id::text AS superseded_by_policy_id, decision_basis
         FROM compliance_feature_policies
        WHERE feature_code = $1 ORDER BY policy_version`,
      [code]
    );

    expect(history.rows).toHaveLength(2);
    expect(history.rows[0]).toMatchObject({
      id: v1,
      policy_version: 1,
      superseded_by_policy_id: v2,
    });
    expect(history.rows[0]!.effective_until!.toISOString()).toBe(nextStart.toISOString());
    // The old judgment is preserved verbatim, including its review basis.
    expect(history.rows[0]!.decision_basis).toBe('reviewed decision basis');
    expect(history.rows[1]).toMatchObject({
      id: v2,
      policy_version: 2,
      effective_until: null,
      superseded_by_policy_id: null,
    });

    const runtime = await app.query<{ policy_version: number }>(
      `SELECT policy_version FROM compliance_feature_policies WHERE feature_code = $1`,
      [code]
    );
    expect(runtime.rows).toEqual([{ policy_version: 2 }]);
  });

  it('rejects a version below the historical maximum after the open row was explicitly expired', async () => {
    const code = featureCode('EXPIRED_HISTORY');

    await publish(migrator, {
      code,
      expectedVersion: null,
      version: 1,
      effectiveFrom: new Date(Date.now() - 180_000),
    });

    const v2 = await publish(migrator, {
      code,
      expectedVersion: 1,
      version: 2,
      effectiveFrom: new Date(Date.now() - 120_000),
    });

    // Legal lifecycle closure without a successor: the feature now has history
    // but no open row.
    await migrator.query(
      `UPDATE compliance_feature_policies SET effective_until = now() WHERE id = $1`,
      [v2]
    );
    const openRows = await migrator.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM compliance_feature_policies
        WHERE feature_code = $1 AND effective_until IS NULL`,
      [code]
    );
    expect(openRows.rows[0]).toEqual({ n: 0 });

    // Neither v1 nor v2 may be re-published as a "first publication".
    for (const version of [1, 2]) {
      await expect(
        publish(migrator, {
          code,
          expectedVersion: null,
          version,
          effectiveFrom: new Date(Date.now() + 1000),
        })
      ).rejects.toMatchObject({ code: '23514' });
    }

    const v3 = await publish(migrator, {
      code,
      expectedVersion: null,
      version: 3,
      effectiveFrom: new Date(Date.now() + 1000),
    });

    const versions = await migrator.query<{ policy_version: number }>(
      `SELECT policy_version FROM compliance_feature_policies
        WHERE feature_code = $1 ORDER BY policy_version`,
      [code]
    );
    expect(versions.rows.map((row) => row.policy_version)).toEqual([1, 2, 3]);
    expect(v3).toBeTruthy();
  });

  it('rejects a stale expected current version without changing history', async () => {
    const code = featureCode('STALE');
    await publish(migrator, {
      code,
      expectedVersion: null,
      version: 1,
      effectiveFrom: new Date(Date.now() - 60_000),
    });

    await expect(
      publish(migrator, {
        code,
        expectedVersion: null,
        version: 2,
        effectiveFrom: new Date(),
      })
    ).rejects.toMatchObject({ code: '40001' });

    const rows = await migrator.query(
      `SELECT policy_version FROM compliance_feature_policies WHERE feature_code = $1`,
      [code]
    );
    expect(rows.rows).toEqual([{ policy_version: 1 }]);
  });

  it('rejects a non-monotonic policy version', async () => {
    const code = featureCode('MONOTONIC');
    await publish(migrator, {
      code,
      expectedVersion: null,
      version: 2,
      effectiveFrom: new Date(Date.now() - 60_000),
    });

    await expect(
      publish(migrator, {
        code,
        expectedVersion: 2,
        version: 2,
        effectiveFrom: new Date(),
      })
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('DB trigger rejects overlapping intervals even when the publication helper is bypassed', async () => {
    const code = featureCode('OVERLAP');
    await publish(migrator, {
      code,
      expectedVersion: null,
      version: 1,
      effectiveFrom: new Date(Date.now() - 60_000),
    });

    await expect(
      migrator.query(
        `INSERT INTO compliance_feature_policies
           (feature_code, feature_contract_revision, policy_version,
            anthropomorphic_applicability, minor_access_rule, ai_disclosure_rule,
            generated_content_label_rule, usage_reminder_rule, decision_basis,
            review_evidence_ref, effective_from, publication_source_ref)
         VALUES ($1,'v1',2,'REQUIRED','BASELINE','REQUIRED','BASELINE','REQUIRED',
                 'basis','evidence://2',now(),'migration:bypass')`,
        [code]
      )
    ).rejects.toMatchObject({ code: '23P01' });
  });

  it('two concurrent first-publish attempts serialize: exactly one succeeds', async () => {
    const code = featureCode('RACE_FIRST');
    const first = new Client({ connectionString: freshMigrationUrl });
    const second = new Client({ connectionString: freshMigrationUrl });
    await Promise.all([first.connect(), second.connect()]);

    try {
      const start = new Date(Date.now() - 60_000);
      const results = await Promise.allSettled([
        publish(first, {
          code,
          expectedVersion: null,
          version: 1,
          effectiveFrom: start,
        }),
        publish(second, {
          code,
          expectedVersion: null,
          version: 1,
          effectiveFrom: start,
        }),
      ]);

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: '40001' });

      const rows = await migrator.query(
        `SELECT count(*)::int AS n FROM compliance_feature_policies WHERE feature_code = $1`,
        [code]
      );
      expect(rows.rows[0]).toEqual({ n: 1 });
    } finally {
      await first.end();
      await second.end();
    }
  });

  it('two concurrent supersessions with the same expected version serialize', async () => {
    const code = featureCode('RACE_SUPERSEDE');
    await publish(migrator, {
      code,
      expectedVersion: null,
      version: 1,
      effectiveFrom: new Date(Date.now() - 120_000),
    });

    const first = new Client({ connectionString: freshMigrationUrl });
    const second = new Client({ connectionString: freshMigrationUrl });
    await Promise.all([first.connect(), second.connect()]);

    try {
      const effectiveFrom = new Date(Date.now() - 60_000);
      const results = await Promise.allSettled([
        publish(first, {
          code,
          expectedVersion: 1,
          version: 2,
          effectiveFrom,
        }),
        publish(second, {
          code,
          expectedVersion: 1,
          version: 3,
          effectiveFrom: new Date(Date.now() - 30_000),
        }),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);

      const rows = await migrator.query(
        `SELECT count(*)::int AS n FROM compliance_feature_policies WHERE feature_code = $1`,
        [code]
      );
      // v1 closed + exactly one successful successor.
      expect(rows.rows[0]).toEqual({ n: 2 });
    } finally {
      await first.end();
      await second.end();
    }
  });

  it('runtime cannot publish or mutate policy data', async () => {
    const code = featureCode('RUNTIME');
    await expect(
      app.query(FUNCTION_SQL, args({
        code,
        expectedVersion: null,
        version: 1,
        effectiveFrom: new Date(),
      }))
    ).rejects.toMatchObject({ code: '42501' });

    await expect(
      app.query(
        `UPDATE compliance_feature_policies SET minor_access_rule = 'MINORS_BLOCKED' WHERE feature_code = $1`,
        [code]
      )
    ).rejects.toMatchObject({ code: '42501' });
  });
});