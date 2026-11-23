import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { Client } from 'pg';

const IS_DEDICATED_EXECUTION = process.env['E2_ROLE_BOOTSTRAP_REPAIR_TEST'] === '1';
const describeOrSkip = IS_DEDICATED_EXECUTION ? describe : describe.skip;

function getAdminConnectionInfo() {
  const rawUrl = process.env['TEST_ADMIN_DATABASE_URL'];
  if (rawUrl) {
    const u = new URL(rawUrl);
    return {
      connectionString: rawUrl,
      host: u.hostname,
      port: parseInt(u.port || '5432', 10),
      user: u.username || 'postgres',
      password: u.password ? decodeURIComponent(u.password) : undefined,
      database: u.pathname.slice(1) || 'postgres',
    };
  }
  const host = process.env['PGHOST'] || '127.0.0.1';
  const port = parseInt(process.env['PGPORT'] || '54329', 10);
  const user = process.env['PGUSER'] || 'postgres';
  const password = process.env['PGPASSWORD'];
  const database = process.env['PGDATABASE'] || 'postgres';
  const connectionString = password
    ? `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`
    : `postgres://${encodeURIComponent(user)}@${host}:${port}/${database}`;
  return { connectionString, host, port, user, password, database };
}

describeOrSkip('Finding #29: Roles Bootstrap and Existing Role Repair (PostgreSQL 18)', () => {
  let adminClient: Client;
  const scriptPath = path.resolve(__dirname, '../../db/init/01-roles.sh');
  const conn = getAdminConnectionInfo();

  beforeAll(async () => {
    adminClient = new Client({ connectionString: conn.connectionString });
    await adminClient.connect();
  });

  afterAll(async () => {
    try {
      // Restore standard passwords and managed invariants on tear down
      runBootstrapScript({
        POSTGRES_APP_PASSWORD: process.env['POSTGRES_APP_PASSWORD'] || 'safe_app_pass_1',
        POSTGRES_MIGRATOR_PASSWORD: process.env['POSTGRES_MIGRATOR_PASSWORD'] || 'safe_migrator_pass_1',
      });
    } finally {
      await adminClient.end().catch(() => undefined);
    }
  });

  function runBootstrapScript(envOverrides: Record<string, string> = {}) {
    return spawnSync('bash', [scriptPath], {
      env: {
        ...process.env,
        PATH: process.env.PATH,
        POSTGRES_USER: conn.user,
        POSTGRES_DB: conn.database,
        PGHOST: conn.host,
        PGPORT: String(conn.port),
        PGUSER: conn.user,
        ...(conn.password ? { PGPASSWORD: conn.password } : {}),
        POSTGRES_MIGRATOR_PASSWORD: 'safe_migrator_pass_1',
        POSTGRES_APP_PASSWORD: 'safe_app_pass_1',
        ...envOverrides,
      },
      encoding: 'utf8',
    });
  }

  it('fresh execution creates roles with exact required invariants', async () => {
    // Drop roles if already present to simulate fresh install
    await adminClient.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'xiaoshuyin_migrator') THEN
          EXECUTE 'DROP OWNED BY xiaoshuyin_migrator CASCADE';
          DROP ROLE xiaoshuyin_migrator;
        END IF;
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'xiaoshuyin_app') THEN
          EXECUTE 'DROP OWNED BY xiaoshuyin_app CASCADE';
          DROP ROLE xiaoshuyin_app;
        END IF;
      END
      $$;
    `);

    const result = runBootstrapScript();
    expect(result.status, `stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('Roles bootstrapped and verified');

    // Verify invariants on pg_roles
    const rolesRes = await adminClient.query<{
      rolname: string;
      rolsuper: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
      rolcanlogin: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
    }>(`
      SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls
      FROM pg_roles
      WHERE rolname IN ('xiaoshuyin_migrator', 'xiaoshuyin_app')
    `);

    expect(rolesRes.rows.length).toBe(2);
    for (const role of rolesRes.rows) {
      expect(role.rolcanlogin).toBe(true);
      expect(role.rolsuper).toBe(false);
      expect(role.rolbypassrls).toBe(false);
      expect(role.rolcreaterole).toBe(false);
      expect(role.rolcreatedb).toBe(false);
      expect(role.rolreplication).toBe(false);
    }
  });

  it('second execution is completely idempotent with no destructive drift', async () => {
    const result = runBootstrapScript();
    expect(result.status, `stderr: ${result.stderr}`).toBe(0);

    const rolesRes = await adminClient.query<{ rolname: string; rolbypassrls: boolean }>(`
      SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname IN ('xiaoshuyin_migrator', 'xiaoshuyin_app')
    `);
    expect(rolesRes.rows.length).toBe(2);
    expect(rolesRes.rows.every((r) => r.rolbypassrls === false)).toBe(true);
  });

  it('existing misconfigured role is idempotently repaired to secure invariants', async () => {
    // Tamper roles: grant SUPERUSER and BYPASSRLS
    await adminClient.query(`
      ALTER ROLE xiaoshuyin_app WITH SUPERUSER BYPASSRLS;
      ALTER ROLE xiaoshuyin_migrator WITH CREATEROLE CREATEDB;
    `);

    // Verify tampering took effect
    const tampered = await adminClient.query<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>(`
      SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'xiaoshuyin_app'
    `);
    expect(tampered.rows[0]?.rolsuper).toBe(true);
    expect(tampered.rows[0]?.rolbypassrls).toBe(true);

    // Run repair
    const result = runBootstrapScript();
    expect(result.status, `stderr: ${result.stderr}`).toBe(0);

    // Verify roles were repaired back to safe invariants
    const repaired = await adminClient.query<{
      rolname: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
    }>(`
      SELECT rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
      FROM pg_roles
      WHERE rolname IN ('xiaoshuyin_migrator', 'xiaoshuyin_app')
    `);

    for (const r of repaired.rows) {
      expect(r.rolsuper).toBe(false);
      expect(r.rolbypassrls).toBe(false);
      expect(r.rolcreaterole).toBe(false);
      expect(r.rolcreatedb).toBe(false);
    }
  });

  it('safely handles passwords with quotes, backslashes, dollars, and shell characters', async () => {
    const complexAppPass = "test'pass\\word$with\"quotes;--and spaces";
    const complexMigratorPass = "migrator'pass\\$spec!al;--";

    const result = runBootstrapScript({
      POSTGRES_APP_PASSWORD: complexAppPass,
      POSTGRES_MIGRATOR_PASSWORD: complexMigratorPass,
    });
    expect(result.status, `stderr: ${result.stderr}`).toBe(0);

    // Verify that client can authenticate using the complex password with special characters
    const testAppClient = new Client({
      host: conn.host,
      port: conn.port,
      user: 'xiaoshuyin_app',
      password: complexAppPass,
      database: conn.database,
    });
    await testAppClient.connect();
    const appQueryRes = await testAppClient.query('SELECT current_user;');
    expect(appQueryRes.rows[0].current_user).toBe('xiaoshuyin_app');
    await testAppClient.end();

    const testMigratorClient = new Client({
      host: conn.host,
      port: conn.port,
      user: 'xiaoshuyin_migrator',
      password: complexMigratorPass,
      database: conn.database,
    });
    await testMigratorClient.connect();
    const migratorQueryRes = await testMigratorClient.query('SELECT current_user;');
    expect(migratorQueryRes.rows[0].current_user).toBe('xiaoshuyin_migrator');
    await testMigratorClient.end();
  });
});

