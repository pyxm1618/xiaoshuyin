#!/usr/bin/env node
/**
 * db-evidence.mjs — T067 final database / RLS / migration evidence.
 *
 * Prints REAL query output (never "should be") for every row of quickstart §1,
 * verifies an empty-database rebuild and a migration replay, and archives the
 * T011 / T012 green test output into tests/evidence/db-evidence.log.
 *
 * Connections (three distinct roles, unchanged):
 *   DATABASE_URL             → xiaoshuyin_app     (runtime, not used here)
 *   MIGRATION_DATABASE_URL   → xiaoshuyin_migrator (schema inspection + rebuild)
 *   TEST_ADMIN_DATABASE_URL  → superuser           (CREATE/DROP temp database)
 *
 * Never uses drizzle-kit push. Never prints secret values.
 */

import pg from 'pg';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const lines = [];
let failures = 0;

function sanitize(value) {
  const home = process.env['HOME'] ?? '';
  const host = os.hostname();
  let out = String(value);
  if (ROOT) out = out.split(ROOT).join('<repo>');
  if (home) out = out.split(home).join('~');
  if (host) out = out.split(host).join('<host>');
  out = out.replace(/"pid":\d+/g, '"pid":<pid>');
  out = out.replace(/xiaoshuyin_evidence_\d+/g, 'xiaoshuyin_evidence_<tmp>');
  return out;
}

function log(line = '') {
  const clean = sanitize(line);
  console.log(clean);
  lines.push(clean);
}

function norm(v) {
  if (Array.isArray(v)) return JSON.stringify(v);
  if (v === null || v === undefined) return String(v);
  return String(v);
}

function check(name, expected, actual, predicate) {
  const ok = predicate ? predicate(actual) : norm(actual) === norm(expected);
  if (!ok) failures++;
  log(`| ${name} | ${norm(expected)} | ${norm(actual)} | ${ok ? 'PASS' : 'FAIL'} |`);
  return ok;
}

/** pg returns name[] as the literal "{A,B}" when no array parser is registered. */
function labelsOf(row) {
  const v = row?.labels;
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string' && v.startsWith('{') && v.endsWith('}')) {
    return v.slice(1, -1).split(',').filter(Boolean);
  }
  return [];
}

function quoteIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

const RLS_TABLES = [
  'business_audit_events', 'case_events', 'cases', 'consent_records', 'families',
  'family_members', 'guardian_consent_requests', 'idempotency_keys',
  'person_compliance_profiles', 'person_profile_values', 'persons',
];

// Slice 006 (repo feature 006 / business Slice 5) additive objects. Evidence
// must cover them without weakening the Slice 1 baseline checks below.
const SLICE5_TABLES = [
  'binding_pending_contexts', 'binding_attempts', 'binding_confirmations',
  'binding_operation_keys', 'identity_binding_audit_events',
].sort();
const SLICE5_ENUMS = [
  'binding_attempt_state', 'binding_confirmation_kind', 'binding_confirmer_authority',
  'binding_operation_command', 'binding_operation_scope',
].sort();
const SLICE5_POLICIES = [
  'binding_context_token_scope', 'binding_context_attempt_scope',
  'binding_context_no_attempt_identity_scope',
  'binding_attempts_identity_scope', 'binding_attempts_operation_replay',
  'binding_attempts_target_scope', 'binding_attempts_commit_scope',
  'binding_confirmations_attempt_scope', 'binding_confirmations_target_scope',
  'binding_operation_keys_scope', 'binding_operation_keys_bootstrap_fingerprint',
  'identity_binding_audit_insert_scope', 'persons_binding_target_read',
  'persons_binding_candidate_account_read', 'persons_binding_commit_update',
  'families_binding_read', 'family_members_binding_read', 'pcp_binding_read',
  'consent_binding_read',
];
const SLICE5_TRIGGERS = [
  'binding_confirmations_no_update_delete', 'identity_binding_audit_no_update_delete',
];

const EXPECTED_TABLES = [
  'accounts', 'business_audit_events', 'case_events', 'cases', 'consent_records',
  'families', 'family_members', 'guardian_consent_requests', 'idempotency_keys',
  'person_compliance_profiles', 'person_profile_values', 'persons',
].sort();

const EXPECTED_ENUMS = [
  'account_status', 'age_band', 'case_phase', 'case_status', 'consent_decision',
  'consent_purpose', 'consent_request_status', 'profile_attribute',
  'profile_value_status', 'provenance_source',
].sort();

const EXPECTED_UUIDV7_TABLES = [
  'accounts', 'business_audit_events', 'case_events', 'cases', 'consent_records',
  'families', 'family_members', 'guardian_consent_requests', 'idempotency_keys',
  'person_profile_values', 'persons',
].sort();

async function q(client, sql) {
  return (await client.query(sql)).rows;
}

/** Object fingerprint used to prove replay is a no-op. */
async function objectFingerprint(client) {
  const rows = await q(client, `
    SELECT 'enum' AS kind, t.typname AS name
      FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public' GROUP BY t.typname
    UNION ALL
    SELECT 'table', tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
    UNION ALL
    SELECT 'policy', policyname FROM pg_policies WHERE schemaname = 'public'
    UNION ALL
    SELECT 'trigger', tgname FROM pg_trigger WHERE NOT tgisinternal
    ORDER BY kind, name
  `);
  return rows.map((r) => `${r.kind}:${r.name}`).join('|');
}

async function collect(client) {
  return {
    rls: await q(client, `
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
             pg_get_userbyid(c.relowner) AS owner
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname
    `),
    uuidv7: await q(client, `
      SELECT table_name, column_name, column_default
        FROM information_schema.columns
       WHERE table_schema = 'public' AND column_default LIKE '%uuidv7%'
       ORDER BY table_name
    `),
    enums: await q(client, `
      SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
        FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
        JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public' GROUP BY t.typname ORDER BY t.typname
    `),
    tables: await q(client, `
      SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
       ORDER BY tablename
    `),
    policies: await q(client, `
      SELECT tablename, policyname FROM pg_policies
       WHERE schemaname = 'public' ORDER BY tablename, policyname
    `),
    triggers: await q(client, `
      SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname
    `),
    roles: await q(client, `
      SELECT rolname, rolbypassrls FROM pg_roles
       WHERE rolname IN ('xiaoshuyin_app','xiaoshuyin_migrator') ORDER BY rolname
    `),
    personsCols: await q(client, `
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'persons'
    `),
    familyMemberCols: await q(client, `
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'family_members'
    `),
    personsIdx: await q(client, `
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'persons'
    `),
    enumLabels: await q(client, `
      SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'profile_attribute'
    `),
  };
}

function verifyStructure(label, d) {
  log('');
  log(`## ${label} — quickstart §1 期望表逐项核对（真实查询输出）`);
  log('');
  log('| 检查 | 期望 | 实际 | 结果 |');
  log('|---|---|---|---|');

  const rlsMap = Object.fromEntries(d.rls.map((r) => [r.relname, r]));
  const rlsFlags = RLS_TABLES.map((t) => `${t}=${rlsMap[t]?.relrowsecurity}/${rlsMap[t]?.relforcerowsecurity}`);
  check('11 张业务表 relrowsecurity/relforcerowsecurity', 'true/true × 11',
    rlsFlags,
    (a) => a.length === 11 && a.every((s) => s.endsWith('=true/true')));
  const slice5RlsFlags = SLICE5_TABLES.map(
    (t) => `${t}=${rlsMap[t]?.relrowsecurity}/${rlsMap[t]?.relforcerowsecurity}`
  );
  check('5 张 006 binding 表 relrowsecurity/relforcerowsecurity', 'true/true × 5',
    slice5RlsFlags,
    (a) => a.length === 5 && a.every((s) => s.endsWith('=true/true')));
  check('accounts 无 RLS', 'false/false',
    `${rlsMap['accounts']?.relrowsecurity}/${rlsMap['accounts']?.relforcerowsecurity}`);

  const owners = [...new Set(EXPECTED_TABLES.map((t) => rlsMap[t]?.owner))];
  check('业务表 owner', 'xiaoshuyin_migrator', owners,
    (a) => a.length === 1 && a[0] === 'xiaoshuyin_migrator');

  const appRole = d.roles.find((r) => r.rolname === 'xiaoshuyin_app');
  check('xiaoshuyin_app rolbypassrls', 'false', appRole?.rolbypassrls);
  const migratorRole = d.roles.find((r) => r.rolname === 'xiaoshuyin_migrator');
  check('xiaoshuyin_migrator rolbypassrls', 'false', migratorRole?.rolbypassrls);

  const uuidTables = d.uuidv7.map((r) => r.table_name).sort();
  const expectedUuidTables = [...EXPECTED_UUIDV7_TABLES, ...SLICE5_TABLES].sort();
  check('uuidv7() 默认值表覆盖 Slice 1 + 006', JSON.stringify(expectedUuidTables), uuidTables,
    (a) => expectedUuidTables.every((t) => a.includes(t)));
  check('uuidv7 默认值表达式', 'uuidv7() × 11',
    [...new Set(d.uuidv7.map((r) => r.column_default))],
    (a) => a.length === 1 && a[0] === 'uuidv7()');

  const actualEnums = d.enums.map((r) => r.typname).sort();
  const expectedEnums = [...EXPECTED_ENUMS, ...SLICE5_ENUMS].sort();
  check('枚举覆盖 Slice 1 + 006（15）', JSON.stringify(expectedEnums),
    actualEnums,
    (a) => expectedEnums.every((e) => a.includes(e)));
  const ageBand = d.enums.find((r) => r.typname === 'age_band');
  check('age_band enum', 'ADULT,MINOR_14_17,UNDER_14,UNKNOWN', labelsOf(ageBand).join(','));
  const profileAttr = d.enums.find((r) => r.typname === 'profile_attribute');
  check('profile_attribute enum', 'DISPLAY_NAME', labelsOf(profileAttr).join(','));
  check('不存在 RELATION_DESCRIPTOR enum label', 0,
    d.enums.flatMap(labelsOf).filter((l) => l === 'RELATION_DESCRIPTOR').length);

  const actualTables = d.tables.map((r) => r.tablename).sort();
  check('业务表覆盖 Slice 1（12）+ 006（5）', JSON.stringify([...EXPECTED_TABLES, ...SLICE5_TABLES].sort()),
    actualTables,
    (a) => [...EXPECTED_TABLES, ...SLICE5_TABLES].every((t) => a.includes(t)));
  check('不存在 assertions / observations 表', '0',
    d.tables.filter((r) => ['assertions', 'observations'].includes(r.tablename)).length);
  const actualPolicies = d.policies.map((r) => r.policyname);
  check('RLS policy 覆盖 006 追加策略', JSON.stringify(SLICE5_POLICIES),
    actualPolicies.filter((p) => SLICE5_POLICIES.includes(p)).sort(),
    (a) => SLICE5_POLICIES.every((p) => a.includes(p)));
  check('RLS policy 总数 >= Slice 1 基线（11）', '>= 11', d.policies.length,
    (n) => Number(n) >= 11);
  const actualTriggers = d.triggers.map((r) => r.tgname);
  check('consent + binding 不可变触发器', JSON.stringify(['consent_records_guard', ...SLICE5_TRIGGERS]),
    actualTriggers,
    (a) => ['consent_records_guard', ...SLICE5_TRIGGERS].every((t) => a.includes(t)));

  const personCols = d.personsCols.map((r) => r.column_name);
  check('persons 无 family_id / source_kind / role', '0',
    personCols.filter((c) => ['family_id', 'source_kind', 'source', 'role', 'is_guardian'].includes(c)).length);
  check('persons.account_id UNIQUE', 'true',
    d.personsIdx.some((r) => r.indexname === 'persons_account_id_key' && r.indexdef.includes('UNIQUE')));

  const fmCols = d.familyMemberCols.map((r) => r.column_name);
  check('family_members 无 role/creator/guardian 列', '0',
    fmCols.filter((c) => /role|creator|guardian|is_admin|is_owner/i.test(c)).length);
}

async function rebuildFromEmpty() {
  log('');
  log('## 空库重建 + migration replay（真实执行）');

  const adminUrl = process.env['TEST_ADMIN_DATABASE_URL'];
  const migrationUrl = process.env['MIGRATION_DATABASE_URL'];
  if (!adminUrl || !migrationUrl) {
    throw new Error('TEST_ADMIN_DATABASE_URL and MIGRATION_DATABASE_URL are required for empty-DB rebuild');
  }

  const tmpDb = `xiaoshuyin_evidence_${Date.now()}`;
  const migrationParsed = new URL(migrationUrl);
  const migratorRole = decodeURIComponent(migrationParsed.username);
  const tmpUrl = new URL(migrationUrl);
  tmpUrl.pathname = `/${tmpDb}`;

  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${quoteIdent(tmpDb)} OWNER ${quoteIdent(migratorRole)}`);
  await admin.end();
  log(`  CREATE DATABASE ${tmpDb} OWNER ${migratorRole} — OK`);

  let tmpClient;
  try {
    const first = execFileSync('node', ['scripts/db-migrate.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, MIGRATION_DATABASE_URL: tmpUrl.toString() },
    });
    log('  第一次 db:migrate (空库):');
    first.trim().split('\n').forEach((l) => log(`    ${l}`));

    tmpClient = new pg.Client({ connectionString: tmpUrl.toString() });
    await tmpClient.connect();
    const before = await objectFingerprint(tmpClient);
    const d = await collect(tmpClient);
    verifyStructure('空库重建结果', d);

    const replay = execFileSync('node', ['scripts/db-migrate.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, MIGRATION_DATABASE_URL: tmpUrl.toString() },
    });
    log('  第二次 db:migrate (replay):');
    replay.trim().split('\n').forEach((l) => log(`    ${l}`));

    const after = await objectFingerprint(tmpClient);
    check('migration replay 为 no-op（对象集合不变）', before, after);
    check('replay 输出声明 0 new', 'true',
      /Migration complete: 0 new/.test(replay));
    await tmpClient.end();
    tmpClient = undefined;
  } finally {
    if (tmpClient) { try { await tmpClient.end(); } catch { /* ignore */ } }
    const cleanup = new pg.Client({ connectionString: adminUrl });
    await cleanup.connect();
    await cleanup.query(`DROP DATABASE IF EXISTS ${quoteIdent(tmpDb)} WITH (FORCE)`);
    await cleanup.end();
    log(`  DROP DATABASE ${tmpDb} — OK`);
  }
}

async function upgradeFrom003() {
  log('');
  log('## 001–003 基线库 → 004 upgrade（真实 db:migrate，非手工执行 004）');

  const adminUrl = process.env['TEST_ADMIN_DATABASE_URL'];
  const migrationUrl = process.env['MIGRATION_DATABASE_URL'];
  if (!adminUrl || !migrationUrl) {
    throw new Error('TEST_ADMIN_DATABASE_URL and MIGRATION_DATABASE_URL are required for upgrade evidence');
  }

  const tmpDb = `xiaoshuyin_evidence_${Date.now()}`;
  const parsed = new URL(migrationUrl);
  const migratorRole = decodeURIComponent(parsed.username);
  const tmpUrl = new URL(migrationUrl);
  tmpUrl.pathname = `/${tmpDb}`;

  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${quoteIdent(tmpDb)} OWNER ${quoteIdent(migratorRole)}`);
  await admin.end();
  log(`  CREATE DATABASE ${tmpDb} OWNER ${migratorRole} — OK`);

  let client;
  try {
    // Construct the real pre-004 state from the reviewed 001–003 files using
    // the same BEGIN → apply → record sequence as the runner. 004 is NOT
    // applied here: the normal db:migrate runner below must apply it, which
    // is exactly the upgrade path under test.
    client = new pg.Client({ connectionString: tmpUrl.toString() });
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    for (const file of ['001_initial_schema.sql', '002_case_core.sql', '003_case_idempotency_key_bytes.sql']) {
      const sql = readFileSync(join(ROOT, 'db', 'migrations', file), 'utf-8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      log(`  PRE-004 APPLY ${file}`);
    }
    const beforeRecords = await client.query(
      'SELECT filename, applied_at FROM schema_migrations ORDER BY filename'
    );
    const beforeFingerprint = await objectFingerprint(client);
    const beforeRoles = await client.query(
      "SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname IN ('xiaoshuyin_app','xiaoshuyin_migrator') ORDER BY rolname"
    );
    await client.end();
    client = undefined;

    const output = execFileSync('node', ['scripts/db-migrate.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, MIGRATION_DATABASE_URL: tmpUrl.toString() },
    });
    log('  第一次 db:migrate（数据库状态 = 001–003 applied、004 未应用）:');
    output.trim().split('\n').forEach((l) => log(`    ${l}`));
    check(
      'upgrade 前三条 migration 被 SKIP（未重新执行）',
      true,
      /SKIP 001_initial_schema\.sql/.test(output) &&
        /SKIP 002_case_core\.sql/.test(output) &&
        /SKIP 003_case_idempotency_key_bytes\.sql/.test(output)
    );
    check('upgrade 仅 APPLY 004', true, /APPLY 004_identity_binding_runtime\.sql/.test(output));
    check(
      'upgrade 结果为 1 new / 3 previously applied',
      true,
      /Migration complete: 1 new, 3 previously applied\./.test(output)
    );

    client = new pg.Client({ connectionString: tmpUrl.toString() });
    await client.connect();
    const afterRecords = await client.query(
      'SELECT filename, applied_at FROM schema_migrations ORDER BY filename'
    );
    check('schema_migrations 追加 004 记录', [
      '001_initial_schema.sql',
      '002_case_core.sql',
      '003_case_idempotency_key_bytes.sql',
      '004_identity_binding_runtime.sql',
    ], afterRecords.rows.map((r) => r.filename));
    check(
      '001–003 历史记录时间戳未被改写',
      true,
      beforeRecords.rows.every(
        (r) => afterRecords.rows.find((a) => a.filename === r.filename)?.applied_at?.getTime() === r.applied_at.getTime()
      )
    );

    const d = await collect(client);
    verifyStructure('001–003 → 004 upgrade 结果', d);

    const afterFingerprint = await objectFingerprint(client);
    const afterSet = new Set(afterFingerprint.split('|'));
    check(
      '001–003 既有对象无破坏性重写',
      true,
      beforeFingerprint.split('|').every((entry) => afterSet.has(entry))
    );
    const afterRoles = await client.query(
      "SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname IN ('xiaoshuyin_app','xiaoshuyin_migrator') ORDER BY rolname"
    );
    check(
      'roles 与 upgrade 前一致',
      beforeRoles.rows.map((r) => `${r.rolname}=${r.rolbypassrls}`).join(','),
      afterRoles.rows.map((r) => `${r.rolname}=${r.rolbypassrls}`).join(',')
    );
  } finally {
    if (client) { try { await client.end(); } catch { /* ignore */ } }
    const cleanup = new pg.Client({ connectionString: adminUrl });
    await cleanup.connect();
    await cleanup.query(`DROP DATABASE IF EXISTS ${quoteIdent(tmpDb)} WITH (FORCE)`);
    await cleanup.end();
    log(`  DROP DATABASE ${tmpDb} — OK`);
  }
}

async function archiveT011T012() {
  log('');
  log('## T011 / T012 红灯测试转绿（真实命令输出归档）');
  const cmd = 'bunx vitest run tests/db/migration-repro.test.ts tests/db/roles.test.ts';
  log(`  $ ${cmd}`);
  const result = spawnSync('bunx', ['vitest', 'run', 'tests/db/migration-repro.test.ts', 'tests/db/roles.test.ts'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  output.trim().split('\n').forEach((l) => log(`    ${l}`));
  check('T011 migration-repro + T012 roles exit code', 0, result.status);
  check('T011/T012 测试全绿', 'true', /Test Files\s+2 passed/.test(output));
}

async function main() {
  log('# T067 — Database / RLS / Migration Evidence');
  log(`生成时间: ${new Date().toISOString()}`);
  log('');
  log('说明：以下每个数值均来自 pg_catalog / information_schema 的真实查询输出；');
  log('空库重建与 replay 为真实执行的 db:migrate，不是描述性声明。');

  const migrationUrl = process.env['MIGRATION_DATABASE_URL'];
  if (!migrationUrl) throw new Error('MIGRATION_DATABASE_URL is required');

  const client = new pg.Client({ connectionString: migrationUrl });
  await client.connect();
  try {
    const d = await collect(client);
    verifyStructure('当前主库（已迁移）', d);
  } finally {
    await client.end();
  }

  await rebuildFromEmpty();
  await upgradeFrom003();
  await archiveT011T012();

  log('');
  log(`db-evidence: ${failures === 0 ? 'PASS' : `FAIL (${failures} checks failed)`}`);

  mkdirSync(join(ROOT, 'tests', 'evidence'), { recursive: true });
  writeFileSync(join(ROOT, 'tests', 'evidence', 'db-evidence.log'), lines.join('\n') + '\n');

  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  log(`db-evidence: ERROR — ${err.message}`);
  mkdirSync(join(ROOT, 'tests', 'evidence'), { recursive: true });
  writeFileSync(join(ROOT, 'tests', 'evidence', 'db-evidence.log'), lines.join('\n') + '\n');
  console.error(err);
  process.exit(1);
});
