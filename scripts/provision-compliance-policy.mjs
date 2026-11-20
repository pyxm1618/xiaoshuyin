#!/usr/bin/env bun
/**
 * Phase 5 / C1 — controlled Compliance Policy provisioning.
 *
 * This is a deployment-time/internal command. It deliberately does not expose
 * an HTTP endpoint and it never accepts free-form SQL or an unvalidated policy
 * payload. The existing Slice 10 publication function remains the sole DB
 * transition primitive.
 *
 * Usage:
 *   MIGRATION_DATABASE_URL=... bun scripts/provision-compliance-policy.mjs <bundle.json>
 *
 * The connection MUST authenticate as xiaoshuyin_migrator. Production callers
 * are expected to point at an immutable, reviewed bundle checked into the
 * release being deployed.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { hashPayload } from '../packages/domain/src/idempotency.ts';

const { Client } = pg;

const TOP_LEVEL_KEYS = Object.freeze([
  'bundleDigest',
  'expectedPreviousVersion',
  'operationKey',
  'policy',
  'schemaVersion',
]);

const POLICY_KEYS = Object.freeze([
  'aiDisclosureRule',
  'anthropomorphicApplicability',
  'decisionBasis',
  'effectiveFrom',
  'featureCode',
  'featureContractRevision',
  'generatedContentLabelRule',
  'minorAccessRule',
  'policyVersion',
  'publicationSourceRef',
  'reviewEvidenceRef',
  'usageReminderRule',
]);

const APPLICABILITY = new Set(['REQUIRED', 'NOT_APPLICABLE', 'UNKNOWN']);
const MINOR_RULE = new Set(['BASELINE', 'MINORS_BLOCKED']);
const FEATURE_RULE = new Set(['BASELINE', 'REQUIRED']);
const SHA256_RE = /^[0-9a-f]{64}$/;

class ProvisioningError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'ProvisioningError';
    this.code = code;
  }
}

function fail(code, message = code) {
  throw new ProvisioningError(code, message);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertExactKeys(value, expected, label) {
  if (!isRecord(value)) {
    fail('COMPLIANCE_POLICY_BUNDLE_SCHEMA_INVALID', `${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    fail(
      'COMPLIANCE_POLICY_BUNDLE_SCHEMA_INVALID',
      `${label} keys must be exactly [${wanted.join(', ')}]`
    );
  }
}

function boundedTrimmedString(value, label, min, max) {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    value.length < min ||
    value.length > max
  ) {
    fail(
      'COMPLIANCE_POLICY_BUNDLE_SCHEMA_INVALID',
      `${label} must be a trimmed string of length ${min}..${max}`
    );
  }
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 2147483647) {
    fail(
      'COMPLIANCE_POLICY_BUNDLE_SCHEMA_INVALID',
      `${label} must be a positive PostgreSQL integer`
    );
  }
  return value;
}

function canonicalIso(value, label) {
  if (typeof value !== 'string') {
    fail('COMPLIANCE_POLICY_BUNDLE_SCHEMA_INVALID', `${label} must be an ISO timestamp`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) {
    fail(
      'COMPLIANCE_POLICY_BUNDLE_SCHEMA_INVALID',
      `${label} must use canonical ISO-8601 UTC form`
    );
  }
  return value;
}

function normalizePolicy(raw) {
  assertExactKeys(raw, POLICY_KEYS, 'policy');

  const featureCode = boundedTrimmedString(raw.featureCode, 'policy.featureCode', 1, 120);
  const featureContractRevision = boundedTrimmedString(
    raw.featureContractRevision,
    'policy.featureContractRevision',
    1,
    64
  );
  const policyVersion = positiveInteger(raw.policyVersion, 'policy.policyVersion');

  if (!APPLICABILITY.has(raw.anthropomorphicApplicability)) {
    fail('COMPLIANCE_POLICY_BUNDLE_SCHEMA_INVALID', 'invalid anthropomorphicApplicability');
  }
  if (!MINOR_RULE.has(raw.minorAccessRule)) {
    fail('COMPLIANCE_POLICY_BUNDLE_SCHEMA_INVALID', 'invalid minorAccessRule');
  }
  for (const [label, value] of [
    ['aiDisclosureRule', raw.aiDisclosureRule],
    ['generatedContentLabelRule', raw.generatedContentLabelRule],
    ['usageReminderRule', raw.usageReminderRule],
  ]) {
    if (!FEATURE_RULE.has(value)) {
      fail('COMPLIANCE_POLICY_BUNDLE_SCHEMA_INVALID', `invalid ${label}`);
    }
  }

  // C1 only provisions reviewed bundles. Slice 10's storage can represent an
  // unresolved UNKNOWN row with nullable review fields, but the production
  // provisioning path itself must carry explicit review provenance.
  const decisionBasis = boundedTrimmedString(
    raw.decisionBasis,
    'policy.decisionBasis',
    1,
    1000
  );
  const reviewEvidenceRef = boundedTrimmedString(
    raw.reviewEvidenceRef,
    'policy.reviewEvidenceRef',
    1,
    200
  );
  const publicationSourceRef = boundedTrimmedString(
    raw.publicationSourceRef,
    'policy.publicationSourceRef',
    8,
    200
  );
  const effectiveFrom = canonicalIso(raw.effectiveFrom, 'policy.effectiveFrom');

  if (
    raw.anthropomorphicApplicability === 'REQUIRED' &&
    (raw.aiDisclosureRule !== 'REQUIRED' || raw.usageReminderRule !== 'REQUIRED')
  ) {
    fail(
      'COMPLIANCE_POLICY_BUNDLE_SCHEMA_INVALID',
      'REQUIRED applicability requires AI disclosure and usage reminder'
    );
  }
  if (
    raw.anthropomorphicApplicability === 'NOT_APPLICABLE' &&
    raw.usageReminderRule !== 'BASELINE'
  ) {
    fail(
      'COMPLIANCE_POLICY_BUNDLE_SCHEMA_INVALID',
      'NOT_APPLICABLE applicability requires BASELINE usage reminder'
    );
  }

  return Object.freeze({
    featureCode,
    featureContractRevision,
    policyVersion,
    anthropomorphicApplicability: raw.anthropomorphicApplicability,
    minorAccessRule: raw.minorAccessRule,
    aiDisclosureRule: raw.aiDisclosureRule,
    generatedContentLabelRule: raw.generatedContentLabelRule,
    usageReminderRule: raw.usageReminderRule,
    decisionBasis,
    reviewEvidenceRef,
    effectiveFrom,
    publicationSourceRef,
  });
}

function normalizeBundle(raw) {
  assertExactKeys(raw, TOP_LEVEL_KEYS, 'bundle');

  if (raw.schemaVersion !== 1) {
    fail('COMPLIANCE_POLICY_BUNDLE_SCHEMA_INVALID', 'schemaVersion must be 1');
  }

  const operationKey = boundedTrimmedString(raw.operationKey, 'operationKey', 8, 200);
  const expectedPreviousVersion =
    raw.expectedPreviousVersion === null
      ? null
      : positiveInteger(raw.expectedPreviousVersion, 'expectedPreviousVersion');
  const policy = normalizePolicy(raw.policy);

  // Reuse the already-authoritative publication_source_ref as the durable
  // operation identity. This avoids a second idempotency store and makes exact
  // replay/mismatch decidable from immutable policy history.
  if (operationKey !== policy.publicationSourceRef) {
    fail(
      'COMPLIANCE_POLICY_BUNDLE_SCHEMA_INVALID',
      'operationKey must equal policy.publicationSourceRef'
    );
  }

  if (typeof raw.bundleDigest !== 'string' || !SHA256_RE.test(raw.bundleDigest)) {
    fail('COMPLIANCE_POLICY_BUNDLE_SCHEMA_INVALID', 'bundleDigest must be lowercase sha256');
  }

  const effectivePayload = Object.freeze({
    schemaVersion: 1,
    operationKey,
    expectedPreviousVersion,
    policy,
  });
  const computedDigest = hashPayload(effectivePayload);
  if (computedDigest !== raw.bundleDigest) {
    fail(
      'COMPLIANCE_POLICY_BUNDLE_DIGEST_MISMATCH',
      'bundleDigest does not match canonical reviewed payload'
    );
  }

  return Object.freeze({
    ...effectivePayload,
    bundleDigest: raw.bundleDigest,
  });
}

function toIso(value, label) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  fail('COMPLIANCE_POLICY_READBACK_MISMATCH', `invalid database timestamp for ${label}`);
}

function rowPolicy(row) {
  return {
    featureCode: row.feature_code,
    featureContractRevision: row.feature_contract_revision,
    policyVersion: Number(row.policy_version),
    anthropomorphicApplicability: row.anthropomorphic_applicability,
    minorAccessRule: row.minor_access_rule,
    aiDisclosureRule: row.ai_disclosure_rule,
    generatedContentLabelRule: row.generated_content_label_rule,
    usageReminderRule: row.usage_reminder_rule,
    decisionBasis: row.decision_basis,
    reviewEvidenceRef: row.review_evidence_ref,
    effectiveFrom: toIso(row.effective_from, 'effective_from'),
    publicationSourceRef: row.publication_source_ref,
  };
}

function samePolicy(row, policy) {
  const actual = rowPolicy(row);
  return POLICY_KEYS.every((key) => actual[key] === policy[key]);
}

async function readPolicyRowsBySource(client, operationKey) {
  const result = await client.query(
    `SELECT
       id::text AS id,
       feature_code,
       feature_contract_revision,
       policy_version,
       anthropomorphic_applicability,
       minor_access_rule,
       ai_disclosure_rule,
       generated_content_label_rule,
       usage_reminder_rule,
       decision_basis,
       review_evidence_ref,
       effective_from,
       effective_until,
       superseded_by_policy_id::text AS superseded_by_policy_id,
       created_at,
       approved_at,
       publication_source_ref
     FROM compliance_feature_policies
     WHERE publication_source_ref = $1
     ORDER BY created_at, id`,
    [operationKey]
  );
  return result.rows;
}

async function readPolicyRowsByVersion(client, policy) {
  const result = await client.query(
    `SELECT
       id::text AS id,
       feature_code,
       feature_contract_revision,
       policy_version,
       anthropomorphic_applicability,
       minor_access_rule,
       ai_disclosure_rule,
       generated_content_label_rule,
       usage_reminder_rule,
       decision_basis,
       review_evidence_ref,
       effective_from,
       effective_until,
       superseded_by_policy_id::text AS superseded_by_policy_id,
       created_at,
       approved_at,
       publication_source_ref
     FROM compliance_feature_policies
     WHERE feature_code = $1
       AND feature_contract_revision = $2
       AND policy_version = $3
     ORDER BY id`,
    [policy.featureCode, policy.featureContractRevision, policy.policyVersion]
  );
  return result.rows;
}

async function readPolicyById(client, id) {
  const result = await client.query(
    `SELECT
       id::text AS id,
       feature_code,
       feature_contract_revision,
       policy_version,
       anthropomorphic_applicability,
       minor_access_rule,
       ai_disclosure_rule,
       generated_content_label_rule,
       usage_reminder_rule,
       decision_basis,
       review_evidence_ref,
       effective_from,
       effective_until,
       superseded_by_policy_id::text AS superseded_by_policy_id,
       created_at,
       approved_at,
       publication_source_ref
     FROM compliance_feature_policies
     WHERE id = $1`,
    [id]
  );
  if (result.rows.length !== 1) {
    fail('COMPLIANCE_POLICY_READBACK_MISMATCH', 'published policy row missing on read-back');
  }
  return result.rows[0];
}

async function readPredecessor(client, id) {
  const result = await client.query(
    `SELECT id::text AS id, policy_version, effective_until,
            superseded_by_policy_id::text AS superseded_by_policy_id
       FROM compliance_feature_policies
      WHERE superseded_by_policy_id = $1
      ORDER BY id`,
    [id]
  );
  if (result.rows.length > 1) {
    fail(
      'COMPLIANCE_POLICY_READBACK_MISMATCH',
      'multiple predecessor rows point at one published policy'
    );
  }
  return result.rows[0] ?? null;
}

async function verifyReadBack(client, bundle, row, { requireCurrentOpen }) {
  if (!samePolicy(row, bundle.policy)) {
    fail('COMPLIANCE_POLICY_READBACK_MISMATCH', 'policy fields differ from reviewed bundle');
  }

  const predecessor = await readPredecessor(client, row.id);
  const previousPolicyVersion =
    predecessor === null ? null : Number(predecessor.policy_version);

  if (previousPolicyVersion !== bundle.expectedPreviousVersion) {
    fail(
      'COMPLIANCE_POLICY_READBACK_MISMATCH',
      'previous policy version differs from reviewed bundle'
    );
  }

  const readBackPayload = {
    schemaVersion: 1,
    operationKey: row.publication_source_ref,
    expectedPreviousVersion: previousPolicyVersion,
    policy: rowPolicy(row),
  };
  if (hashPayload(readBackPayload) !== bundle.bundleDigest) {
    fail(
      'COMPLIANCE_POLICY_READBACK_MISMATCH',
      'authoritative row digest differs from reviewed bundle'
    );
  }

  if (requireCurrentOpen) {
    if (row.effective_until !== null || row.superseded_by_policy_id !== null) {
      fail(
        'COMPLIANCE_POLICY_READBACK_MISMATCH',
        'newly provisioned policy is not the open publication'
      );
    }

    const current = await client.query(
      `SELECT id::text AS id, policy_version
         FROM compliance_feature_policies
        WHERE feature_code = $1
          AND feature_contract_revision = $2
          AND effective_until IS NULL
        ORDER BY policy_version DESC`,
      [bundle.policy.featureCode, bundle.policy.featureContractRevision]
    );
    if (current.rows.length !== 1 || current.rows[0].id !== row.id) {
      fail(
        'COMPLIANCE_POLICY_READBACK_MISMATCH',
        'authoritative current publication does not match new policy'
      );
    }

    if (predecessor !== null) {
      if (
        predecessor.superseded_by_policy_id !== row.id ||
        toIso(predecessor.effective_until, 'predecessor.effective_until') !==
          bundle.policy.effectiveFrom
      ) {
        fail(
          'COMPLIANCE_POLICY_READBACK_MISMATCH',
          'predecessor closure does not exactly match new effective boundary'
        );
      }
    }
  }

  return {
    policyId: row.id,
    featureCode: row.feature_code,
    featureContractRevision: row.feature_contract_revision,
    policyVersion: Number(row.policy_version),
    previousPolicyVersion,
    publicationSourceRef: row.publication_source_ref,
    reviewEvidenceRef: row.review_evidence_ref,
    effectiveFrom: toIso(row.effective_from, 'effective_from'),
    createdAt: toIso(row.created_at, 'created_at'),
    approvedAt: toIso(row.approved_at, 'approved_at'),
  };
}

async function provision(client, bundle) {
  await client.query('BEGIN');
  try {
    const roleResult = await client.query(
      'SELECT current_user AS current_user, session_user AS session_user'
    );
    const role = roleResult.rows[0];
    if (
      role?.current_user !== 'xiaoshuyin_migrator' ||
      role?.session_user !== 'xiaoshuyin_migrator'
    ) {
      fail(
        'COMPLIANCE_POLICY_PROVISIONING_ROLE_REQUIRED',
        'controlled provisioning requires the xiaoshuyin_migrator login'
      );
    }

    // Serialize operation identity first, then the exact feature identity. The
    // publication function takes the same feature lock again defensively.
    await client.query(
      `SELECT pg_advisory_xact_lock(
         hashtextextended('COMPLIANCE_POLICY_OPERATION:' || $1, 0)
       )`,
      [bundle.operationKey]
    );
    await client.query(
      `SELECT pg_advisory_xact_lock(
         hashtextextended($1 || chr(31) || $2, 0)
       )`,
      [bundle.policy.featureCode, bundle.policy.featureContractRevision]
    );

    const byOperation = await readPolicyRowsBySource(client, bundle.operationKey);
    if (byOperation.length > 1) {
      fail(
        'COMPLIANCE_POLICY_OPERATION_AMBIGUOUS',
        'operation key resolves to multiple policy rows'
      );
    }
    if (byOperation.length === 1) {
      const receipt = await verifyReadBack(client, bundle, byOperation[0], {
        requireCurrentOpen: false,
      });
      await client.query('COMMIT');
      return {
        status: 'PASS',
        result: 'REPLAYED',
        operationKey: bundle.operationKey,
        bundleDigest: bundle.bundleDigest,
        databaseRole: 'xiaoshuyin_migrator',
        readBackVerified: true,
        ...receipt,
      };
    }

    const byVersion = await readPolicyRowsByVersion(client, bundle.policy);
    if (byVersion.length > 1) {
      fail(
        'COMPLIANCE_POLICY_VERSION_AMBIGUOUS',
        'policy identity/version resolves to multiple rows'
      );
    }
    if (byVersion.length === 1) {
      if (!samePolicy(byVersion[0], bundle.policy)) {
        fail(
          'COMPLIANCE_POLICY_VERSION_CONTENT_MISMATCH',
          'same policy version already exists with different content/provenance'
        );
      }
      fail(
        'COMPLIANCE_POLICY_VERSION_ALREADY_PUBLISHED',
        'same policy version already exists under a different operation key'
      );
    }

    // Explicit CAS read-back before invoking the DB primitive. The function
    // repeats this check under the same feature lock, so this is both a stable
    // operator error and a defense-in-depth verification.
    const current = await client.query(
      `SELECT id::text AS id, policy_version
         FROM compliance_feature_policies
        WHERE feature_code = $1
          AND feature_contract_revision = $2
          AND effective_until IS NULL
        FOR UPDATE`,
      [bundle.policy.featureCode, bundle.policy.featureContractRevision]
    );
    if (current.rows.length > 1) {
      fail('COMPLIANCE_POLICY_CURRENT_AMBIGUOUS', 'multiple current policy rows exist');
    }
    const currentVersion =
      current.rows.length === 0 ? null : Number(current.rows[0].policy_version);
    if (currentVersion !== bundle.expectedPreviousVersion) {
      fail(
        'COMPLIANCE_POLICY_STALE',
        `expected previous version ${String(bundle.expectedPreviousVersion)}, found ${String(currentVersion)}`
      );
    }

    const published = await client.query(
      `SELECT app.publish_compliance_feature_policy(
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
       )::text AS id`,
      [
        bundle.policy.featureCode,
        bundle.policy.featureContractRevision,
        bundle.expectedPreviousVersion,
        bundle.policy.policyVersion,
        bundle.policy.anthropomorphicApplicability,
        bundle.policy.minorAccessRule,
        bundle.policy.aiDisclosureRule,
        bundle.policy.generatedContentLabelRule,
        bundle.policy.usageReminderRule,
        bundle.policy.decisionBasis,
        bundle.policy.reviewEvidenceRef,
        bundle.policy.effectiveFrom,
        bundle.policy.publicationSourceRef,
      ]
    );
    const id = published.rows[0]?.id;
    if (typeof id !== 'string') {
      fail('COMPLIANCE_POLICY_PROVISIONING_FAILED', 'publication returned no policy id');
    }

    const row = await readPolicyById(client, id);
    const receipt = await verifyReadBack(client, bundle, row, {
      requireCurrentOpen: true,
    });

    await client.query('COMMIT');
    return {
      status: 'PASS',
      result: 'PROVISIONED',
      operationKey: bundle.operationKey,
      bundleDigest: bundle.bundleDigest,
      databaseRole: 'xiaoshuyin_migrator',
      readBackVerified: true,
      ...receipt,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

function readBundle(path) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(
      'COMPLIANCE_POLICY_BUNDLE_INVALID_JSON',
      error instanceof Error ? error.message : String(error)
    );
  }
  return normalizeBundle(parsed);
}

function publicError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof ProvisioningError) {
    return { status: 'FAIL', code: error.code, message };
  }
  if (isRecord(error)) {
    if (typeof error.message === 'string' && /^COMPLIANCE_POLICY_[A-Z0-9_]+$/.test(error.message)) {
      return { status: 'FAIL', code: error.message, message: error.message };
    }
    if (typeof error.code === 'string') {
      return { status: 'FAIL', code: error.code, message };
    }
  }
  return { status: 'FAIL', code: 'COMPLIANCE_POLICY_PROVISIONING_FAILED', message };
}

async function main() {
  if (process.argv.length !== 3) {
    fail(
      'COMPLIANCE_POLICY_BUNDLE_PATH_REQUIRED',
      'usage: bun scripts/provision-compliance-policy.mjs <bundle.json>'
    );
  }
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  if (!connectionString) {
    fail(
      'COMPLIANCE_POLICY_DATABASE_URL_REQUIRED',
      'MIGRATION_DATABASE_URL is required'
    );
  }

  const bundlePath = resolve(process.argv[2]);
  const bundle = readBundle(bundlePath);
  const client = new Client({
    connectionString,
    application_name: 'xiaoshuyin-compliance-policy-provisioning',
  });
  await client.connect();
  try {
    const receipt = await provision(client, bundle);
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify(publicError(error))}\n`);
  process.exitCode = 1;
});
