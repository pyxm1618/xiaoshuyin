/**
 * Slice 10 — Policy snapshot loading over the authoritative Drizzle seam.
 *
 * The loader performs *I/O only*. It reuses the caller's already-established
 * transaction (one checked-out PoolClient, Drizzle-owned BEGIN/COMMIT, identity
 * verification and Family RLS context) and never opens a second transaction or
 * a second checked-out client.
 *
 * Person / guardian-consent facts are read through the same checked-out client
 * so the policy row and the person facts come from one consistent snapshot.
 * The raw statements below are reads of the existing truth sources; they add no
 * second truth and no raw-pg-only policy write path.
 */

import { sql, type SQL } from 'drizzle-orm';
import type { AgeBand } from './age-gate.js';
import type { ComplianceFeatureDescriptor } from './feature-identity.js';
import {
  type ComplianceFeaturePolicyRecord,
  type ComplianceGuardianConsentSnapshot,
  type CompliancePersonSnapshot,
  type AnthropomorphicApplicability,
  type FeatureRule,
  type MinorAccessRule,
} from './feature-policy.js';

/**
 * Structural subset of a Drizzle transaction. `withDrizzleRlsTransaction`
 * passes its real transaction handle, which satisfies this interface; the
 * compliance package does not depend on the app module.
 */
export interface CompliancePolicyQueryExecutor {
  execute(query: SQL): Promise<{ rows: readonly unknown[] }>;
}

/** Structural subset of `pg.PoolClient` for the same-transaction raw reads. */
export interface CompliancePersonQueryExecutor {
  query(text: string, values?: unknown[]): Promise<{ rows: readonly unknown[] }>;
}

export interface CompliancePolicySnapshot {
  readonly evaluatedAt: string;
  readonly policies: readonly ComplianceFeaturePolicyRecord[];
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  throw new TypeError('COMPLIANCE_EVALUATION_TIME_INVALID');
}

function asString(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('COMPLIANCE_POLICY_ROW_INVALID');
  return value;
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  throw new TypeError('COMPLIANCE_POLICY_ROW_INVALID');
}

function mapPolicyRow(row: Record<string, unknown>): ComplianceFeaturePolicyRecord {
  return {
    policyId: asString(row['policy_id']),
    featureCode: asString(row['feature_code']),
    featureContractRevision: asString(row['feature_contract_revision']),
    policyVersion: asNumber(row['policy_version']),
    anthropomorphicApplicability: asString(
      row['anthropomorphic_applicability']
    ) as AnthropomorphicApplicability,
    minorAccessRule: asString(row['minor_access_rule']) as MinorAccessRule,
    aiDisclosureRule: asString(row['ai_disclosure_rule']) as FeatureRule,
    generatedContentLabelRule: asString(
      row['generated_content_label_rule']
    ) as FeatureRule,
    usageReminderRule: asString(row['usage_reminder_rule']) as FeatureRule,
    effectiveFrom: toIsoString(row['effective_from']),
    effectiveUntil:
      row['effective_until'] === null || row['effective_until'] === undefined
        ? null
        : toIsoString(row['effective_until']),
  };
}

/**
 * Read current effective policy candidates for one exact server-owned feature
 * identity. Runtime RLS already limits visibility to rows effective at
 * `transaction_timestamp()`; the query keeps the same rule explicit.
 *
 * The runtime is deliberately not granted historical visibility, so
 * missing / future-only / expired-only all arrive here as zero rows and fail
 * closed as `COMPLIANCE_POLICY_MISSING`.
 */
export async function loadCompliancePolicySnapshot(
  executor: CompliancePolicyQueryExecutor,
  feature: ComplianceFeatureDescriptor
): Promise<CompliancePolicySnapshot> {
  const timeResult = await executor.execute(
    sql`SELECT transaction_timestamp() AS evaluated_at`
  );
  const evaluatedAt = toIsoString(
    (timeResult.rows[0] as Record<string, unknown> | undefined)?.['evaluated_at']
  );

  const policyResult = await executor.execute(sql`
    SELECT
      id::text                        AS policy_id,
      feature_code                    AS feature_code,
      feature_contract_revision       AS feature_contract_revision,
      policy_version                  AS policy_version,
      anthropomorphic_applicability   AS anthropomorphic_applicability,
      minor_access_rule               AS minor_access_rule,
      ai_disclosure_rule              AS ai_disclosure_rule,
      generated_content_label_rule    AS generated_content_label_rule,
      usage_reminder_rule             AS usage_reminder_rule,
      effective_from                  AS effective_from,
      effective_until                 AS effective_until
    FROM compliance_feature_policies
    WHERE feature_code = ${feature.featureCode}
      AND feature_contract_revision = ${feature.featureContractRevision}
      AND effective_from <= transaction_timestamp()
      AND (effective_until IS NULL OR transaction_timestamp() < effective_until)
    ORDER BY policy_version DESC
  `);

  const policies = policyResult.rows.map((row) =>
    mapPolicyRow(row as Record<string, unknown>)
  );

  return { evaluatedAt, policies };
}

function parseAgeBand(value: unknown): AgeBand {
  if (
    value === 'ADULT' ||
    value === 'MINOR_14_17' ||
    value === 'UNDER_14' ||
    value === 'UNKNOWN'
  ) {
    return value;
  }
  throw new TypeError('COMPLIANCE_PROFILE_ROW_INVALID');
}

/**
 * Read the existing Person Compliance Profile and current guardian-consent
 * record through the caller's checked-out client. No duplicate age, minor-mode,
 * guardian or consent truth is created.
 */
export async function loadCompliancePersonSnapshot(
  executor: CompliancePersonQueryExecutor,
  personId: string
): Promise<CompliancePersonSnapshot | null> {
  const result = await executor.query(
    `SELECT
       pcp.person_id::text                AS person_id,
       pcp.age_band::text                 AS age_band,
       pcp.minor_mode                     AS minor_mode,
       pcp.guardian_person_id::text       AS guardian_person_id,
       pcp.verified_source::text          AS verified_source,
       cr.id::text                        AS consent_id,
       cr.decision::text                  AS consent_decision,
       cr.bound_person_id::text           AS consent_bound_person_id,
       cr.notice_hash                     AS consent_notice_hash,
       cr.guardian_person_id::text        AS consent_guardian_person_id,
       cr.version                         AS consent_version
     FROM person_compliance_profiles pcp
     LEFT JOIN consent_records cr ON cr.id = pcp.guardian_consent_record_id
     WHERE pcp.person_id = $1`,
    [personId]
  );

  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (row === undefined) return null;

  let guardianConsent: ComplianceGuardianConsentSnapshot | null = null;
  if (row['consent_id'] !== null && row['consent_id'] !== undefined) {
    const decision = row['consent_decision'];
    if (decision !== 'GRANTED' && decision !== 'REVOKED') {
      throw new TypeError('COMPLIANCE_CONSENT_ROW_INVALID');
    }
    guardianConsent = {
      id: asString(row['consent_id']),
      decision,
      boundPersonId:
        row['consent_bound_person_id'] === null || row['consent_bound_person_id'] === undefined
          ? null
          : asString(row['consent_bound_person_id']),
      noticeHash: asString(row['consent_notice_hash']),
      guardianPersonId: asString(row['consent_guardian_person_id']),
      version: asNumber(row['consent_version']),
    };
  }

  return {
    personId: asString(row['person_id']),
    ageBand: parseAgeBand(row['age_band']),
    minorMode: row['minor_mode'] === true,
    guardianPersonId:
      row['guardian_person_id'] === null || row['guardian_person_id'] === undefined
        ? null
        : asString(row['guardian_person_id']),
    guardianConsent,
    verifiedSource: asString(row['verified_source']),
  };
}