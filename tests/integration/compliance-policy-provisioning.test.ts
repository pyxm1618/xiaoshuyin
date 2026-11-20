/**
 * Phase 5 / C1 — production-readiness evidence for controlled Compliance Policy
 * provisioning. These tests invoke the real deployment-time script against a
 * fresh migrated database; they do not call a test-only publication shortcut.
 */

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { hashPayload } from '@xiaoshuyin/domain';
import {
  createServerFeatureDescriptor,
  loadCompliancePolicySnapshot,
} from '@xiaoshuyin/compliance';

const { Client } = pg;
const ROOT = new URL('../..', import.meta.url).pathname;
const SCRIPT = join(ROOT, 'scripts', 'provision-compliance-policy.mjs');
const REVIEWED_FIXTURE = join(
  ROOT,
  'tests',
  'fixtures',
  'compliance',
  'c1-reviewed-policy-v1.json'
);

interface PolicyBundle {
  schemaVersion: 1;
  operationKey: string;
  expectedPreviousVersion: number | null;
  bundleDigest: string;
  policy: {
    featureCode: string;
    featureContractRevision: string;
    policyVersion: number;
    anthropomorphicApplicability: 'REQUIRED' | 'NOT_APPLICABLE' | 'UNKNOWN';
    minorAccessRule: 'BASELINE' | 'MINORS_BLOCKED';
    aiDisclosureRule: 'BASELINE' | 'REQUIRED';
    generatedContentLabelRule: 'BASELINE' | 'REQUIRED';
    usageReminderRule: 'BASELINE' | 'REQUIRED';
    decisionBasis: string;
    reviewEvidenceRef: string;
    effectiveFrom: string;
    publicationSourceRef: string;
  };
}

interface ProvisionReceipt {
  status: 'PASS';
  result: 'PROVISIONED' | 'REPLAYED';
  operationKey: string;
  bundleDigest: string;
  databaseRole: 'xiaoshuyin_migrator';
  readBackVerified: true;
  policyId: string;
  featureCode: string;
  featureContractRevision: string;
  policyVersion: number;
  previousPolicyVersion: number | null;
  publicationSourceRef: string;
  reviewEvidenceRef: string;
  effectiveFrom: string;
  createdAt: string;
  approvedAt: string;
}

interface ProvisionFailure {
  status: 'FAIL';
  code: string;
  message: string;
}

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

function digestBundle(
  bundle: Omit<PolicyBundle, 'bundleDigest'>
): PolicyBundle {
  return {
    ...bundle,
    bundleDigest: hashPayload(bundle),
  };
}

function bundleFor(input: {
  featureCode: string;
  operationKey: string;
  policyVersion?: number;
  expectedPreviousVersion?: number | null;
  effectiveFrom?: string;
  decisionBasis?: string;
}): PolicyBundle {
  const policyVersion = input.policyVersion ?? 1;
  const operationKey = input.operationKey;
  return digestBundle({
    schemaVersion: 1,
    operationKey,
    expectedPreviousVersion: input.expectedPreviousVersion ?? null,
    policy: {
      featureCode: input.featureCode,
      featureContractRevision: 'v1',
      policyVersion,
      anthropomorphicApplicability: 'NOT_APPLICABLE',
      minorAccessRule: 'BASELINE',
      aiDisclosureRule: 'BASELINE',
      generatedContentLabelRule: 'BASELINE',
      usageReminderRule: 'BASELINE',
      decisionBasis: input.decisionBasis ?? `reviewed C1 fixture for ${input.featureCode}`,
      reviewEvidenceRef: `test://c1/review/${input.featureCode.toLowerCase()}/v${policyVersion}`,
      effectiveFrom: input.effectiveFrom ?? '2026-01-01T00:00:00.000Z',
      publicationSourceRef: operationKey,
    },
  });
}

function parseLastJson<T>(output: string): T {
  const lines = output.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) throw new Error('provisioner produced no JSON output');
  return JSON.parse(lines[lines.length - 1]!) as T;
}

describe('Phase 5 / C1 Compliance Policy provisioning', () => {
  let admin: pg.Client;
  let migrator: pg.Client;
  let runtime: pg.Client;
  let database: string;
  let migrationUrl: string;
  let runtimeUrl: string;
  let tempDir: string;
  let bundleCounter = 0;

  function writeBundle(bundle: PolicyBundle | Record<string, unknown>): string {
    const path = join(tempDir, `bundle-${bundleCounter++}.json`);
    writeFileSync(path, `${JSON.stringify(bundle, null, 2)}\n`);
    return path;
  }

  function runProvision(bundlePath: string): ProvisionReceipt {
    const result = spawnSync('bun', [SCRIPT, bundlePath], {
      cwd: ROOT,
      env: { ...process.env, MIGRATION_DATABASE_URL: migrationUrl },
      encoding: 'utf8',
      timeout: 120_000,
    });
    if (result.status !== 0) {
      throw new Error(
        `provisioner failed unexpectedly: ${result.stderr || result.stdout}`
      );
    }
    return parseLastJson<ProvisionReceipt>(result.stdout);
  }

  function runProvisionFailure(bundlePath: string): ProvisionFailure {
    const result = spawnSync('bun', [SCRIPT, bundlePath], {
      cwd: ROOT,
      env: { ...process.env, MIGRATION_DATABASE_URL: migrationUrl },
      encoding: 'utf8',
      timeout: 120_000,
    });
    expect(result.status).not.toBe(0);
    return parseLastJson<ProvisionFailure>(result.stderr);
  }

  beforeAll(async () => {
    const adminUrl = process.env['TEST_ADMIN_DATABASE_URL'];
    const baseMigrationUrl = process.env['MIGRATION_DATABASE_URL'];
    const baseRuntimeUrl = process.env['DATABASE_URL'];
    if (!adminUrl || !baseMigrationUrl || !baseRuntimeUrl) {
      throw new Error('C1 integration test requires admin, migrator and runtime database URLs');
    }

    admin = new Client({ connectionString: adminUrl });
    await admin.connect();

    database = `xiaoshuyin_c1_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await admin.query(`CREATE DATABASE "${database}" OWNER xiaoshuyin_migrator`);

    migrationUrl = urlForDatabase(baseMigrationUrl, database);
    runtimeUrl = urlForDatabase(baseRuntimeUrl, database);
    tempDir = mkdtempSync(join(tmpdir(), 'xiaoshuyin-c1-'));

    // Clean install plus replay/no-op application of the complete current
    // migration inventory. C1 itself intentionally adds no migration.
    runMigrator(migrationUrl);
    runMigrator(migrationUrl);

    migrator = new Client({ connectionString: migrationUrl });
    runtime = new Client({ connectionString: runtimeUrl });
    await Promise.all([migrator.connect(), runtime.connect()]);
  }, 120_000);

  afterAll(async () => {
    await runtime?.end().catch(() => undefined);
    await migrator?.end().catch(() => undefined);
    await admin
      ?.query(`DROP DATABASE IF EXISTS "${database}"`)
      .catch(() => undefined);
    await admin?.end().catch(() => undefined);
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  }, 120_000);

  it('first provision + exact replay are stable, read back exactly, and runtime consumes the effective policy', async () => {
    const fixture = JSON.parse(readFileSync(REVIEWED_FIXTURE, 'utf8')) as PolicyBundle;

    const first = runProvision(REVIEWED_FIXTURE);
    expect(first).toMatchObject({
      status: 'PASS',
      result: 'PROVISIONED',
      operationKey: fixture.operationKey,
      bundleDigest: fixture.bundleDigest,
      databaseRole: 'xiaoshuyin_migrator',
      readBackVerified: true,
      featureCode: fixture.policy.featureCode,
      featureContractRevision: fixture.policy.featureContractRevision,
      policyVersion: fixture.policy.policyVersion,
      previousPolicyVersion: null,
      publicationSourceRef: fixture.policy.publicationSourceRef,
      reviewEvidenceRef: fixture.policy.reviewEvidenceRef,
      effectiveFrom: fixture.policy.effectiveFrom,
    });

    const replay = runProvision(REVIEWED_FIXTURE);
    expect(replay).toMatchObject({
      status: 'PASS',
      result: 'REPLAYED',
      policyId: first.policyId,
      bundleDigest: first.bundleDigest,
      createdAt: first.createdAt,
      approvedAt: first.approvedAt,
      previousPolicyVersion: null,
    });

    // The immutable policy row is the existing Slice 10 publication audit
    // history. Exact replay creates neither a second publication nor a second
    // audit/history row.
    const history = await migrator.query(
      `SELECT id::text AS id, policy_version, decision_basis, review_evidence_ref,
              publication_source_ref, created_at, approved_at
         FROM compliance_feature_policies
        WHERE publication_source_ref = $1`,
      [fixture.operationKey]
    );
    expect(history.rows).toHaveLength(1);
    expect(history.rows[0]).toMatchObject({
      id: first.policyId,
      policy_version: fixture.policy.policyVersion,
      decision_basis: fixture.policy.decisionBasis,
      review_evidence_ref: fixture.policy.reviewEvidenceRef,
      publication_source_ref: fixture.policy.publicationSourceRef,
    });

    // Exercise the actual runtime loader under xiaoshuyin_app RLS, rather than
    // treating a successful provisioning write as sufficient evidence.
    const runtimeDb = drizzle(runtime);
    const descriptor = createServerFeatureDescriptor({
      featureCode: fixture.policy.featureCode,
      featureContractRevision: fixture.policy.featureContractRevision,
      capabilityLabel: 'C1 provisioning CI fixture',
    });
    const snapshot = await loadCompliancePolicySnapshot(runtimeDb, descriptor);
    expect(snapshot.policies).toHaveLength(1);
    expect(snapshot.policies[0]).toMatchObject({
      policyId: first.policyId,
      featureCode: fixture.policy.featureCode,
      featureContractRevision: fixture.policy.featureContractRevision,
      policyVersion: fixture.policy.policyVersion,
      anthropomorphicApplicability: fixture.policy.anthropomorphicApplicability,
      minorAccessRule: fixture.policy.minorAccessRule,
      aiDisclosureRule: fixture.policy.aiDisclosureRule,
      generatedContentLabelRule: fixture.policy.generatedContentLabelRule,
      usageReminderRule: fixture.policy.usageReminderRule,
      effectiveFrom: fixture.policy.effectiveFrom,
      effectiveUntil: null,
    });
  }, 120_000);

  it('same operation key with a different effective payload fails closed', async () => {
    const fixture = JSON.parse(readFileSync(REVIEWED_FIXTURE, 'utf8')) as PolicyBundle;
    runProvision(REVIEWED_FIXTURE);

    const changed = digestBundle({
      schemaVersion: 1,
      operationKey: fixture.operationKey,
      expectedPreviousVersion: fixture.expectedPreviousVersion,
      policy: {
        ...fixture.policy,
        decisionBasis: 'different reviewed content under the same operation key',
      },
    });
    const failure = runProvisionFailure(writeBundle(changed));
    expect(failure.code).toBe('COMPLIANCE_POLICY_IDEMPOTENCY_PAYLOAD_MISMATCH');

    const count = await migrator.query(
      `SELECT count(*)::int AS n
         FROM compliance_feature_policies
        WHERE publication_source_ref = $1`,
      [fixture.operationKey]
    );
    expect(count.rows[0]).toEqual({ n: 1 });
  }, 120_000);

  it('stale expected previous version fails closed without publication', async () => {
    const code = 'C1_CI_STALE_PREVIOUS';
    const first = bundleFor({
      featureCode: code,
      operationKey: 'bundle://tests/c1/stale-previous-v1',
      effectiveFrom: '2026-02-01T00:00:00.000Z',
    });
    runProvision(writeBundle(first));

    const stale = bundleFor({
      featureCode: code,
      operationKey: 'bundle://tests/c1/stale-previous-v2',
      policyVersion: 2,
      expectedPreviousVersion: 999,
      effectiveFrom: '2026-03-01T00:00:00.000Z',
    });
    const failure = runProvisionFailure(writeBundle(stale));
    expect(failure.code).toBe('COMPLIANCE_POLICY_STALE');

    const rows = await migrator.query(
      `SELECT policy_version, effective_until
         FROM compliance_feature_policies
        WHERE feature_code = $1
        ORDER BY policy_version`,
      [code]
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({ policy_version: 1, effective_until: null });
  }, 120_000);

  it('same policy version with different content/provenance fails closed', async () => {
    const code = 'C1_CI_VERSION_MISMATCH';
    const first = bundleFor({
      featureCode: code,
      operationKey: 'bundle://tests/c1/version-mismatch-original',
    });
    runProvision(writeBundle(first));

    const collision = bundleFor({
      featureCode: code,
      operationKey: 'bundle://tests/c1/version-mismatch-collision',
      policyVersion: 1,
      decisionBasis: 'different reviewed content pretending to be policy version one',
    });
    const failure = runProvisionFailure(writeBundle(collision));
    expect(failure.code).toBe('COMPLIANCE_POLICY_VERSION_CONTENT_MISMATCH');

    const rows = await migrator.query(
      `SELECT count(*)::int AS n
         FROM compliance_feature_policies
        WHERE feature_code = $1`,
      [code]
    );
    expect(rows.rows[0]).toEqual({ n: 1 });
  }, 120_000);

  it('invalid or unreviewed bundles are rejected before any database mutation', async () => {
    const bundle = bundleFor({
      featureCode: 'C1_CI_UNREVIEWED',
      operationKey: 'bundle://tests/c1/unreviewed',
    });
    const invalid = {
      ...bundle,
      policy: {
        ...bundle.policy,
        reviewEvidenceRef: '',
      },
    };

    const failure = runProvisionFailure(writeBundle(invalid));
    expect(failure.code).toBe('COMPLIANCE_POLICY_BUNDLE_UNREVIEWED');

    const rows = await migrator.query(
      `SELECT count(*)::int AS n
         FROM compliance_feature_policies
        WHERE feature_code = 'C1_CI_UNREVIEWED'`
    );
    expect(rows.rows[0]).toEqual({ n: 0 });
  }, 120_000);

  it('database failure is atomic: no half-closed predecessor or half-published successor remains', async () => {
    const code = 'C1_CI_FAILURE_ATOMICITY';
    const first = bundleFor({
      featureCode: code,
      operationKey: 'bundle://tests/c1/atomic-v1',
      effectiveFrom: '2026-06-01T00:00:00.000Z',
    });
    runProvision(writeBundle(first));

    // The reviewed envelope is structurally valid and CAS-current, but this
    // successor starts before its predecessor. The DB publication primitive
    // rejects the invalid transition after entering its transaction path.
    const invalidSuccessor = bundleFor({
      featureCode: code,
      operationKey: 'bundle://tests/c1/atomic-v2-invalid-window',
      policyVersion: 2,
      expectedPreviousVersion: 1,
      effectiveFrom: '2026-05-01T00:00:00.000Z',
    });
    const failure = runProvisionFailure(writeBundle(invalidSuccessor));
    expect(['22000', '23514', '23P01']).toContain(failure.code);

    const rows = await migrator.query(
      `SELECT policy_version, effective_until, superseded_by_policy_id,
              publication_source_ref
         FROM compliance_feature_policies
        WHERE feature_code = $1
        ORDER BY policy_version`,
      [code]
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({
      policy_version: 1,
      effective_until: null,
      superseded_by_policy_id: null,
      publication_source_ref: first.operationKey,
    });
  }, 120_000);

  it('ordinary runtime cannot create equivalent production policy state through raw SQL or the publication function', async () => {
    await expect(
      runtime.query(
        `INSERT INTO compliance_feature_policies
           (feature_code, feature_contract_revision, policy_version,
            anthropomorphic_applicability, minor_access_rule, ai_disclosure_rule,
            generated_content_label_rule, usage_reminder_rule, decision_basis,
            review_evidence_ref, effective_from, publication_source_ref)
         VALUES
           ('C1_RUNTIME_BYPASS','v1',1,'NOT_APPLICABLE','BASELINE','BASELINE',
            'BASELINE','BASELINE','runtime bypass','test://runtime/bypass',
            now(),'bundle://runtime/bypass')`
      )
    ).rejects.toMatchObject({ code: '42501' });

    await expect(
      runtime.query(
        `SELECT app.publish_compliance_feature_policy(
           'C1_RUNTIME_BYPASS','v1',NULL,1,'NOT_APPLICABLE','BASELINE',
           'BASELINE','BASELINE','BASELINE','runtime bypass',
           'test://runtime/bypass',now(),'bundle://runtime/bypass'
         )`
      )
    ).rejects.toMatchObject({ code: '42501' });
  }, 120_000);
});
