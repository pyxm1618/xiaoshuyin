#!/usr/bin/env node
/**
 * Slice 19 — real PostgreSQL 18 + pgvector dense-vector readiness probe.
 *
 * The probe connects only through DATABASE_URL (xiaoshuyin_app). It never
 * creates/enables extensions and never creates permanent business objects.
 */

import { writeFileSync } from 'node:fs';
import pg from 'pg';
import {
  finalizePgvectorEvidence,
  PGVECTOR_READINESS_STATUS,
} from './lib/pgvector-readiness.mjs';

const REQUIRED_ENV = [
  'DATABASE_URL',
  'PGVECTOR_STAGE',
  'PGVECTOR_ENVIRONMENT_KIND',
  'PGVECTOR_ENVIRONMENT_ID',
  'PGVECTOR_REPOSITORY_COMMIT',
  'GITHUB_RUN_ID',
  'GITHUB_RUN_ATTEMPT',
  'PGVECTOR_IMAGE_REF',
  'PGVECTOR_EXPECTED_VERSION',
  'PGVECTOR_READINESS_EVIDENCE',
];

function requireEnvironment() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required readiness environment: ${missing.join(', ')}`);
  }
}

function expectedIdentity() {
  return {
    stage: process.env.PGVECTOR_STAGE,
    environment_kind: process.env.PGVECTOR_ENVIRONMENT_KIND,
    environment_id: process.env.PGVECTOR_ENVIRONMENT_ID,
    repository_commit: process.env.PGVECTOR_REPOSITORY_COMMIT,
    workflow_run_id: process.env.GITHUB_RUN_ID,
    workflow_run_attempt: process.env.GITHUB_RUN_ATTEMPT,
    image_ref: process.env.PGVECTOR_IMAGE_REF,
    pgvector_version: process.env.PGVECTOR_EXPECTED_VERSION,
  };
}

function evidenceBase() {
  return {
    schema_version: 1,
    evidence_kind: 'PGVECTOR_DENSE_VECTOR_READINESS',
    probe_mode: 'REAL_DATABASE',
    checked_at: new Date().toISOString(),
    evidence_ref: `github-actions:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}:pgvector-readiness`,
    stage: process.env.PGVECTOR_STAGE,
    environment_kind: process.env.PGVECTOR_ENVIRONMENT_KIND,
    environment_id: process.env.PGVECTOR_ENVIRONMENT_ID,
    repository_commit: process.env.PGVECTOR_REPOSITORY_COMMIT,
    workflow_run_id: process.env.GITHUB_RUN_ID,
    workflow_run_attempt: process.env.GITHUB_RUN_ATTEMPT,
    image_ref: process.env.PGVECTOR_IMAGE_REF,
    environment_reachable: true,
    postgres: {},
    pgvector: {
      extension_name: 'vector',
      available: null,
      installed: null,
      version: null,
      extension_owner: null,
      setup_result: 'UNKNOWN',
    },
    security: {
      runtime_role: null,
      runtime_superuser: null,
      runtime_bypassrls: null,
      runtime_public_schema_create: null,
      runtime_business_table_owner: null,
      extension_owner: null,
    },
    probe: {
      vector_type: false,
      insert: false,
      readback: false,
      distance_query: false,
      distance_order: false,
      distances: null,
      temporary_cleanup: false,
    },
  };
}

function writeEvidence(evidence) {
  const path = process.env.PGVECTOR_READINESS_EVIDENCE;
  if (path) {
    writeFileSync(path, JSON.stringify(evidence, null, 2) + '\n', { encoding: 'utf8' });
  }
}

function distanceClose(actual, expected) {
  return Math.abs(Number(actual) - expected) < 1e-9;
}

function vectorTextMatches(value, expected) {
  const numbers = String(value)
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((part) => Number(part.trim()));
  return numbers.length === expected.length && numbers.every((n, i) => distanceClose(n, expected[i]));
}

async function collectRealEvidence(client, evidence) {
  const version = await client.query(
    "SELECT current_setting('server_version') AS version, current_setting('server_version_num') AS version_num"
  );
  const versionNum = Number(version.rows[0].version_num);
  evidence.postgres = {
    version: String(version.rows[0].version),
    version_num: String(version.rows[0].version_num),
    major: Number.isFinite(versionNum) ? Math.floor(versionNum / 10000) : null,
  };

  const available = await client.query(
    "SELECT default_version, installed_version FROM pg_available_extensions WHERE name = 'vector'"
  );
  evidence.pgvector.available = available.rowCount === 1;
  if (available.rowCount === 1) {
    evidence.pgvector.available_version = available.rows[0].default_version ?? null;
  }

  const installed = await client.query(`
    SELECT e.extversion AS version, r.rolname AS owner
      FROM pg_extension e
      JOIN pg_roles r ON r.oid = e.extowner
     WHERE e.extname = 'vector'
  `);
  evidence.pgvector.installed = installed.rowCount === 1;
  if (installed.rowCount === 1) {
    evidence.pgvector.version = installed.rows[0].version;
    evidence.pgvector.extension_owner = installed.rows[0].owner;
    evidence.pgvector.setup_result = 'ENABLED';
  } else {
    evidence.pgvector.setup_result = 'NOT_ENABLED';
  }

  const role = await client.query(`
    SELECT current_user AS runtime_role,
           r.rolsuper AS runtime_superuser,
           r.rolbypassrls AS runtime_bypassrls,
           has_schema_privilege(current_user, 'public', 'CREATE') AS runtime_public_schema_create,
           EXISTS (
             SELECT 1
               FROM pg_class c
               JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public'
                AND c.relkind IN ('r','p')
                AND c.relowner = r.oid
                AND c.relname <> 'schema_migrations'
           ) AS runtime_business_table_owner
      FROM pg_roles r
     WHERE r.rolname = current_user
  `);
  if (role.rowCount === 1) {
    evidence.security = {
      runtime_role: role.rows[0].runtime_role,
      runtime_superuser: role.rows[0].runtime_superuser,
      runtime_bypassrls: role.rows[0].runtime_bypassrls,
      runtime_public_schema_create: role.rows[0].runtime_public_schema_create,
      runtime_business_table_owner: role.rows[0].runtime_business_table_owner,
      extension_owner: evidence.pgvector.extension_owner,
    };
  }

  if (!evidence.pgvector.installed) return;

  await client.query('BEGIN');

  try {
    await client.query(`
      CREATE TEMP TABLE pgvector_readiness_probe (
        label text PRIMARY KEY,
        embedding vector(3) NOT NULL
      ) ON COMMIT DROP
    `);
    evidence.probe.vector_type = true;
  } catch (error) {
    evidence.probe_error = `vector_type: ${error instanceof Error ? error.message.slice(0, 200) : 'unknown error'}`;
    await client.query('ROLLBACK').catch(() => {});
    return;
  }

  try {
    await client.query(`
      INSERT INTO pgvector_readiness_probe (label, embedding)
      VALUES
        ('origin', '[0,0,0]'::vector),
        ('near',   '[1,0,0]'::vector),
        ('far',    '[3,0,0]'::vector)
    `);
    evidence.probe.insert = true;
  } catch (error) {
    evidence.probe_error = `insert: ${error instanceof Error ? error.message.slice(0, 200) : 'unknown error'}`;
    await client.query('ROLLBACK').catch(() => {});
    return;
  }

  try {
    const readback = await client.query(
      "SELECT label, embedding::text AS embedding FROM pgvector_readiness_probe ORDER BY label"
    );
    const byLabel = Object.fromEntries(readback.rows.map((row) => [row.label, row.embedding]));
    evidence.probe.readback =
      vectorTextMatches(byLabel.origin, [0, 0, 0]) &&
      vectorTextMatches(byLabel.near, [1, 0, 0]) &&
      vectorTextMatches(byLabel.far, [3, 0, 0]);
  } catch (error) {
    evidence.probe_error = `readback: ${error instanceof Error ? error.message.slice(0, 200) : 'unknown error'}`;
    await client.query('ROLLBACK').catch(() => {});
    return;
  }

  try {
    const distance = await client.query(`
      SELECT label, embedding <-> '[0,0,0]'::vector AS distance
        FROM pgvector_readiness_probe
       ORDER BY distance ASC, label ASC
    `);
    evidence.probe.distance_query = true;
    const labels = distance.rows.map((row) => row.label);
    const distances = distance.rows.map((row) => Number(row.distance));
    evidence.probe.distances = distances;
    evidence.probe.distance_order =
      JSON.stringify(labels) === JSON.stringify(['origin', 'near', 'far']) &&
      distanceClose(distances[0], 0) &&
      distanceClose(distances[1], 1) &&
      distanceClose(distances[2], 3);
  } catch (error) {
    evidence.probe_error = `distance: ${error instanceof Error ? error.message.slice(0, 200) : 'unknown error'}`;
    await client.query('ROLLBACK').catch(() => {});
    return;
  }

  try {
    await client.query('COMMIT');
    const cleanup = await client.query(
      "SELECT to_regclass('pg_temp.pgvector_readiness_probe') IS NULL AS cleaned"
    );
    evidence.probe.temporary_cleanup = cleanup.rows[0].cleaned === true;
  } catch (error) {
    evidence.probe_error = `cleanup: ${error instanceof Error ? error.message.slice(0, 200) : 'unknown error'}`;
    await client.query('ROLLBACK').catch(() => {});
  }
}

async function main() {
  requireEnvironment();
  const expected = expectedIdentity();
  const evidence = evidenceBase();
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

  let connected = false;
  try {
    await client.connect();
    connected = true;
    await collectRealEvidence(client, evidence);
  } catch (error) {
    if (!connected) evidence.environment_reachable = false;
    evidence.probe_error = error instanceof Error ? error.message.slice(0, 240) : 'unknown database error';
  } finally {
    await client.end().catch(() => {});
  }

  const finalEvidence = finalizePgvectorEvidence(evidence, expected);
  writeEvidence(finalEvidence);

  console.log(
    JSON.stringify({
      readiness_status: finalEvidence.readiness_status,
      failure_reasons: finalEvidence.failure_reasons,
      postgres_version: finalEvidence.postgres?.version ?? null,
      pgvector_version: finalEvidence.pgvector?.version ?? null,
      runtime_role: finalEvidence.security?.runtime_role ?? null,
      stage: finalEvidence.stage,
      environment_kind: finalEvidence.environment_kind,
      environment_id: finalEvidence.environment_id,
      repository_commit: finalEvidence.repository_commit,
      image_ref: finalEvidence.image_ref,
      evidence_ref: finalEvidence.evidence_ref,
    })
  );

  if (finalEvidence.readiness_status !== PGVECTOR_READINESS_STATUS.READY) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`pgvector readiness probe: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
