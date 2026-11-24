import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = new URL('../..', import.meta.url).pathname;

function sha256Hex(str: string): string {
  return createHash('sha256').update(str).digest('hex');
}

const TEST_ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL'];
const BASE_MIGRATION_URL = process.env['MIGRATION_DATABASE_URL'];
const APP_DATABASE_URL = process.env['DATABASE_URL'];

function quoteIdent(name: string): string {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function getMigratorRole(url: string): string {
  const parsed = new URL(url);
  return decodeURIComponent(parsed.username);
}

function buildDbUrl(baseUrl: string, dbName: string): string {
  const u = new URL(baseUrl);
  u.pathname = `/${dbName}`;
  return u.toString();
}

describe('Finding #21: Real DB Verification for Professional Knowledge Effective Window', () => {
  let adminClient: Client;
  const createdDbs: string[] = [];

  beforeAll(async () => {
    if (!TEST_ADMIN_URL || !BASE_MIGRATION_URL || !APP_DATABASE_URL) {
      throw new Error('TEST_ADMIN_DATABASE_URL, MIGRATION_DATABASE_URL, and DATABASE_URL are required for this test');
    }
    adminClient = new Client({ connectionString: TEST_ADMIN_URL });
    await adminClient.connect();
  });

  afterAll(async () => {
    if (adminClient) {
      for (const db of createdDbs) {
        try {
          await adminClient.query(`
            SELECT pg_terminate_backend(pid) FROM pg_stat_activity
             WHERE datname = $1 AND pid <> pg_backend_pid()
          `, [db]);
          await adminClient.query(`DROP DATABASE IF EXISTS ${quoteIdent(db)}`);
        } catch {
          // ignore cleanup errors
        }
      }
      await adminClient.end();
    }
  });

  async function createTempDatabase(prefix: string): Promise<{ dbName: string; dbUrl: string; adminDbUrl: string; appDbUrl: string }> {
    const dbName = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const migratorRole = getMigratorRole(BASE_MIGRATION_URL!);
    await adminClient.query(`CREATE DATABASE ${quoteIdent(dbName)} OWNER ${quoteIdent(migratorRole)}`);
    createdDbs.push(dbName);
    return {
      dbName,
      dbUrl: buildDbUrl(BASE_MIGRATION_URL!, dbName),
      adminDbUrl: buildDbUrl(TEST_ADMIN_URL!, dbName),
      appDbUrl: buildDbUrl(APP_DATABASE_URL!, dbName),
    };
  }

  // ─── 1. Fresh DB Rebuild with Migration 031 ───
  it('1. Fresh DB: runs full migration chain, applies 031, registers ledger, verifies schema and policies', async () => {
    const { dbUrl, adminDbUrl } = await createTempDatabase('xsy_f21_fresh');

    const output = execFileSync('node', ['scripts/db-migrate.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, MIGRATION_DATABASE_URL: dbUrl },
    });

    expect(output).toContain('APPLY 031_professional_knowledge_effective_window_remediation.sql');
    expect(output).toContain('Migration complete:');

    const client = new Client({ connectionString: adminDbUrl });
    await client.connect();

    try {
      // Check migration ledger
      const { rows: ledgerRows } = await client.query(
        "SELECT filename, content_checksum FROM schema_migrations WHERE filename = '031_professional_knowledge_effective_window_remediation.sql'"
      );
      expect(ledgerRows.length).toBe(1);
      expect(ledgerRows[0].filename).toBe('031_professional_knowledge_effective_window_remediation.sql');
      expect(ledgerRows[0].content_checksum).toBeDefined();

      // Check column existence
      const { rows: colRows } = await client.query(`
        SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
         WHERE table_name = 'professional_knowledge_versions'
           AND column_name = 'effective_to'
      `);
      expect(colRows.length).toBe(1);
      expect(colRows[0].data_type).toBe('timestamp with time zone');

      // Check hardened search_path on app.commit_professional_knowledge_release
      const { rows: funcRows } = await client.query(`
        SELECT proconfig FROM pg_proc
         WHERE pronamespace = 'app'::regnamespace
           AND proname = 'commit_professional_knowledge_release'
      `);
      expect(funcRows.length).toBe(1);
      expect(funcRows[0].proconfig).toEqual(['search_path=pg_catalog, public, app, pg_temp']);

      // Check RLS policies on professional_knowledge_versions
      const { rows: policyRows } = await client.query(`
        SELECT policyname, qual FROM pg_policies
         WHERE tablename = 'professional_knowledge_versions'
           AND policyname = 'professional_knowledge_versions_family_read'
      `);
      expect(policyRows.length).toBe(1);
      expect(policyRows[0].qual).toContain('effective_from');
      expect(policyRows[0].qual).toContain('effective_to');
    } finally {
      await client.end();
    }
  });

  // ─── 2. Upgrade DB Backfill ───
  it('2. Upgrade DB: backfills effective_to from approval evidence when 031 is applied', async () => {
    const { dbUrl, adminDbUrl } = await createTempDatabase('xsy_f21_upgrade');

    // Prepare the current migration set, excluding only the pending F migration.
    const tempMigrationsDir = mkdtempSync(join(tmpdir(), 'xsy_test_migrations_'));
    try {
      const allMigrations = readdirSync(join(ROOT, 'db', 'migrations')).filter((f) => f.endsWith('.sql'));
      const file031 = '031_professional_knowledge_effective_window_remediation.sql';
      expect(allMigrations).toContain(file031);
      expect(allMigrations).toContain('031_common_core_goal_confirm_goal_package_dependency.sql');
      for (const file of allMigrations) {
        if (file === file031) continue;
        copyFileSync(join(ROOT, 'db', 'migrations', file), join(tempMigrationsDir, file));
      }

      // Step 1: Apply the complete existing main baseline, without F's migration.
      execFileSync('node', ['scripts/db-migrate.mjs'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          MIGRATION_DATABASE_URL: dbUrl,
          MIGRATIONS_DIR: tempMigrationsDir,
        },
      });

      const client = new Client({ connectionString: adminDbUrl });
      await client.connect();

      const expectedEffectiveTo = new Date('2028-12-31T23:59:59Z');
      let versionId: string;

      try {
        const beforeLedger = await client.query('SELECT filename FROM schema_migrations WHERE filename = $1', [file031]);
        expect(beforeLedger.rows).toEqual([]);
        const mainLedger = await client.query('SELECT filename FROM schema_migrations WHERE filename = $1', ['031_common_core_goal_confirm_goal_package_dependency.sql']);
        expect(mainLedger.rows).toHaveLength(1);

        // Create test account and person
        const accRes = await client.query(`
          INSERT INTO accounts (wechat_openid, status) VALUES ('openid_test_upgrade_1', 'ACTIVE') RETURNING id
        `);
        const accountId = accRes.rows[0].id;

        const personRes = await client.query(`
          INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id
        `, [accountId]);
        const personId = personRes.rows[0].id;

        // Create staff assignment
        const staffRes = await client.query(`
          INSERT INTO staff_assignments (account_id, person_id, capability, scope_type, granted_by_account_id)
          VALUES ($1, $2, 'PROFESSIONAL_REVIEW', 'GLOBAL', $1) RETURNING id
        `, [accountId, personId]);
        const staffId = staffRes.rows[0].id;

        // Create knowledge item
        const itemRes = await client.query(`
          INSERT INTO professional_knowledge_items (knowledge_key, created_by_account_id, created_by_person_id)
          VALUES ('UPGRADE_TEST_KEY', $1, $2) RETURNING id
        `, [accountId, personId]);
        const itemId = itemRes.rows[0].id;

        const dummyContent = { note: 'upgrade test' };
        const dummyContentHash = sha256Hex(JSON.stringify(dummyContent));
        const dummySourceHash = sha256Hex('sources');

        // Create version with NULL effective_to (pre-031 behavior)
        const versionRes = await client.query(`
          INSERT INTO professional_knowledge_versions (
            knowledge_id, semantic_version, lifecycle_status, review_state, validity_state,
            content, content_hash, source_set_hash, scope_metadata, locale, released_at, effective_from, effective_to,
            created_by_account_id, created_by_person_id
          ) VALUES (
            $1, '1.0.0', 'PUBLISHED', 'CURRENT', 'VALID',
            $2::jsonb, $3, $4, '{"sceneCode": "DIGITAL_USE", "scenePackageVersion": "1.0.0"}'::jsonb,
            'zh-CN', now() - interval '1 day', now() - interval '1 day', NULL,
            $5, $6
          ) RETURNING id
        `, [itemId, JSON.stringify(dummyContent), dummyContentHash, dummySourceHash, accountId, personId]);
        versionId = versionRes.rows[0].id;

        // Insert approval evidence containing effective_to
        await client.query(`
          INSERT INTO professional_knowledge_approval_evidence (
            knowledge_version_id, approval_proof_ref, content_hash, source_set_hash,
            approval_scope, reviewer_identity, reviewer_account_id, reviewer_person_id,
            staff_assignment_ref, qualification_ref, qualification_scope, reviewed_at,
            effective_from, effective_to, scene_binding_ref
          ) VALUES (
            $1, 'proof_upg_1', $2, $3,
            '{}'::jsonb, 'dr_test', $4, $5,
            $6, 'qual_1', '{}'::jsonb, now(),
            now() - interval '1 day', $7, '{"sceneCode": "DIGITAL_USE"}'::jsonb
          )
        `, [versionId, dummyContentHash, dummySourceHash, accountId, personId, staffId, expectedEffectiveTo.toISOString()]);

        // Verify effective_to is currently NULL
        const before = await client.query('SELECT effective_to FROM professional_knowledge_versions WHERE id = $1', [versionId]);
        expect(before.rows[0].effective_to).toBeNull();
      } finally {
        await client.end();
      }

      // Step 2: Now copy 031 into tempMigrationsDir and apply forward upgrade migration
      copyFileSync(join(ROOT, 'db', 'migrations', file031), join(tempMigrationsDir, file031));

      const upgradeOutput = execFileSync('node', ['scripts/db-migrate.mjs'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          MIGRATION_DATABASE_URL: dbUrl,
          MIGRATIONS_DIR: tempMigrationsDir,
        },
      });

      expect(upgradeOutput).toContain('APPLY 031_professional_knowledge_effective_window_remediation.sql');
      expect(upgradeOutput).toContain('Migration complete: 1 new, 38 previously applied.');

      // Step 3: Verify effective_to has been backfilled by 031 automatically
      const clientAfter = new Client({ connectionString: adminDbUrl });
      await clientAfter.connect();
      try {
        const afterLedger = await clientAfter.query('SELECT filename, content_checksum FROM schema_migrations WHERE filename = $1', [file031]);
        expect(afterLedger.rows).toHaveLength(1);
        expect(afterLedger.rows[0].content_checksum).toBeDefined();
        const after = await clientAfter.query('SELECT effective_to FROM professional_knowledge_versions WHERE id = $1', [versionId]);
        expect(new Date(after.rows[0].effective_to).toISOString()).toBe(expectedEffectiveTo.toISOString());
      } finally {
        await clientAfter.end();
      }
    } finally {
      rmSync(tempMigrationsDir, { recursive: true, force: true });
    }
  });

  // ─── 3. Runtime DB Behavior: RLS Visibility Against Authoritative Time ───
  it('3. Runtime DB: enforces RLS effective window for family consumption (CURRENT vs FUTURE vs EXPIRED vs OPEN-ENDED vs BOUNDARY)', async () => {
    const { dbUrl, adminDbUrl, appDbUrl } = await createTempDatabase('xsy_f21_runtime');

    execFileSync('node', ['scripts/db-migrate.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, MIGRATION_DATABASE_URL: dbUrl },
    });

    const admin = new Client({ connectionString: adminDbUrl });
    await admin.connect();

    try {
      // 1. Setup account, person, family via admin client
      const accRes = await admin.query(`
        INSERT INTO accounts (wechat_openid, status) VALUES ('openid_runtime_1', 'ACTIVE') RETURNING id
      `);
      const accountId = accRes.rows[0].id;
      const personRes = await admin.query(`
        INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id
      `, [accountId]);
      const personId = personRes.rows[0].id;

      const famRes = await admin.query(`
        INSERT INTO families (display_name, created_by_person_id) VALUES ('Family 1', $1) RETURNING id
      `, [personId]);
      const familyId = famRes.rows[0].id;

      // Notice: family_members table only has family_id and person_id (no role column)
      await admin.query(`
        INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)
      `, [familyId, personId]);

      // 2. Setup knowledge item
      const itemRes = await admin.query(`
        INSERT INTO professional_knowledge_items (knowledge_key, created_by_account_id, created_by_person_id)
        VALUES ('RUNTIME_TEST_KEY', $1, $2) RETURNING id
      `, [accountId, personId]);
      const itemId = itemRes.rows[0].id;

      // 3. Create versions testing different time windows
      const insertVersion = async (from: string, to: string | null, semver: string) => {
        const content = { semver };
        const contentHash = sha256Hex(JSON.stringify(content));
        const sourceHash = sha256Hex(semver);

        const res = await admin.query(`
          INSERT INTO professional_knowledge_versions (
            knowledge_id, semantic_version, lifecycle_status, review_state, validity_state,
            content, content_hash, source_set_hash, scope_metadata, locale, released_at, effective_from, effective_to,
            created_by_account_id, created_by_person_id
          ) VALUES (
            $1, $2, 'PUBLISHED', 'CURRENT', 'VALID',
            $3::jsonb, $4, $5,
            '{"sceneCode": "DIGITAL_USE", "scenePackageVersion": "1.0.0"}'::jsonb,
            'zh-CN', now() - interval '1 day', $6::timestamptz, $7::timestamptz,
            $8, $9
          ) RETURNING id
        `, [itemId, semver, JSON.stringify(content), contentHash, sourceHash, from, to, accountId, personId]);
        return res.rows[0].id;
      };

      const currentId = await insertVersion('2020-01-01T00:00:00Z', '2099-01-01T00:00:00Z', '1.0.0');
      const openEndedId = await insertVersion('2020-01-01T00:00:00Z', null, '1.1.0');
      const futureId = await insertVersion('2099-01-01T00:00:00Z', '2100-01-01T00:00:00Z', '2.0.0');
      const expiredId = await insertVersion('2020-01-01T00:00:00Z', '2021-01-01T00:00:00Z', '3.0.0');

      // Now query as app user with RLS under PROFESSIONAL_KNOWLEDGE_CONSUMPTION purpose
      const appClient = new Client({ connectionString: appDbUrl });
      await appClient.connect();

      try {
        await appClient.query('BEGIN');
        const { rows: [session] } = await appClient.query<{
          role: string;
          transaction_time: string;
        }>('SELECT current_user AS role, transaction_timestamp()::text AS transaction_time');
        expect(session!.role).toBe('xiaoshuyin_app');

        // Keep PostgreSQL's full timestamp precision to test exact equality.
        const boundaryEligibleId = await insertVersion(
          session!.transaction_time, '2099-01-01T00:00:00Z', '4.0.0'
        );
        const boundaryBlockedId = await insertVersion(
          '2020-01-01T00:00:00Z', session!.transaction_time, '5.0.0'
        );
        await appClient.query("SELECT app.set_family_context($1, $2, 'PROFESSIONAL_KNOWLEDGE_CONSUMPTION')", [
          familyId,
          personId,
        ]);

        const { rows: visibleVersions } = await appClient.query(`
          SELECT id, semantic_version FROM professional_knowledge_versions
        `);

        const visibleIds = new Set(visibleVersions.map((r) => r.id));

        // Assertions:
        // 1. Current version is visible
        expect(visibleIds.has(currentId)).toBe(true);

        // 2. Open-ended version (effective_to IS NULL) is visible
        expect(visibleIds.has(openEndedId)).toBe(true);

        // 3. Future-effective version is BLOCKED by RLS
        expect(visibleIds.has(futureId)).toBe(false);

        // 4. Expired version is BLOCKED by RLS
        expect(visibleIds.has(expiredId)).toBe(false);

        // 5. Boundary eligible (effective_from equals transaction time) is visible
        expect(visibleIds.has(boundaryEligibleId)).toBe(true);

        // 6. Boundary blocked (effective_to equals transaction time) is BLOCKED
        expect(visibleIds.has(boundaryBlockedId)).toBe(false);

        await appClient.query('ROLLBACK');
      } finally {
        await appClient.end();
      }
    } finally {
      await admin.end();
    }
  });
});
