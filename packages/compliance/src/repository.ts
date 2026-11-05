/**
 * Compliance repository — consent + compliance profile data access.
 * Routes must NOT hold direct SQL for these tables (guard R4).
 */

import type { PoolClient } from 'pg';

export type Tx = PoolClient;

// ── Guardian Consent Requests ───────────────────────────────

export async function insertConsentRequest(
  tx: Tx,
  familyId: string,
  guardianPersonId: string,
  subjectPersonId: string | null,
  noticeVersion: string,
  noticeHash: string
) {
  const { rows } = await tx.query(
    `INSERT INTO guardian_consent_requests
       (family_id, guardian_person_id, subject_person_id, declared_age_band,
        notice_version, notice_hash, status, expires_at)
     VALUES ($1, $2, $3, 'UNDER_14', $4, $5, 'PENDING', now() + interval '24 hours')
     RETURNING id, status, notice_version, expires_at`,
    [familyId, guardianPersonId, subjectPersonId, noticeVersion, noticeHash]
  );
  return rows[0];
}

export async function getConsentRequestForUpdate(tx: Tx, id: string) {
  const { rows } = await tx.query(
    `SELECT id, status, expires_at, notice_version, notice_hash, guardian_person_id,
            subject_person_id, family_id
     FROM guardian_consent_requests WHERE id = $1 FOR UPDATE`,
    [id]
  );
  return rows[0] ?? null;
}

export async function updateConsentRequestGranted(tx: Tx, id: string): Promise<void> {
  await tx.query(
    `UPDATE guardian_consent_requests SET status = 'GRANTED', completed_at = now() WHERE id = $1`,
    [id]
  );
}

// ── Consent Records ─────────────────────────────────────────

export async function getConsentRecordForUpdate(tx: Tx, id: string) {
  const { rows } = await tx.query(
    `SELECT id, decision, version, bound_person_id, notice_version, notice_hash,
            guardian_person_id, guardian_account_id, family_id, bound_at
     FROM consent_records WHERE id = $1 FOR UPDATE`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getConsentRecordById(tx: Tx, id: string) {
  const { rows } = await tx.query(
    `SELECT id, guardian_person_id, decision, bound_person_id, notice_hash
     FROM consent_records WHERE id = $1 FOR UPDATE`,
    [id]
  );
  return rows[0] ?? null;
}

// ── Processing gate (read-only, contracts/consent-onboarding.md §7) ──

export async function getComplianceProfileForGate(tx: Tx, personId: string) {
  const { rows } = await tx.query(
    `SELECT age_band, minor_mode, verified_source,
            guardian_person_id, guardian_consent_record_id, guardian_consent_version
     FROM person_compliance_profiles WHERE person_id = $1`,
    [personId]
  );
  return rows[0] ?? null;
}

/** Same read, but takes a row lock — used when advancing the consent pointer. */
export async function getComplianceProfileForUpdate(tx: Tx, personId: string) {
  const { rows } = await tx.query(
    `SELECT age_band, minor_mode, verified_source,
            guardian_person_id, guardian_consent_record_id, guardian_consent_version
     FROM person_compliance_profiles WHERE person_id = $1 FOR UPDATE`,
    [personId]
  );
  return rows[0] ?? null;
}

export async function getConsentRecordForGate(tx: Tx, id: string) {
  const { rows } = await tx.query(
    `SELECT id, decision, bound_person_id, notice_hash, guardian_person_id
     FROM consent_records WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function insertConsentRecord(
  tx: Tx,
  familyId: string,
  guardianPersonId: string,
  guardianAccountId: string,
  decision: string,
  version: number,
  onboardingRequestId: string | null,
  boundPersonId: string | null,
  boundAt: Date | null,
  noticeVersion: string,
  noticeHash: string,
  policyVersion: string,
  evidence: string,
  supersedesId: string | null = null
) {
  const { rows } = await tx.query(
    `INSERT INTO consent_records
       (family_id, guardian_person_id, guardian_account_id, purpose, decision,
        version, onboarding_request_id, bound_person_id, bound_at,
        notice_version, notice_hash, policy_version, evidence, supersedes_id)
     VALUES ($1, $2, $3, 'UNDER_14_GUARDIAN_CONSENT', $4, $5, $6, $7, $8,
             $9, $10, $11, $12, $13)
     RETURNING id, decision, version, notice_version, decided_at, bound_person_id`,
    [
      familyId, guardianPersonId, guardianAccountId, decision, version,
      onboardingRequestId, boundPersonId, boundAt,
      noticeVersion, noticeHash, policyVersion, evidence, supersedesId,
    ]
  );
  return rows[0];
}

export async function bindConsentToPerson(
  tx: Tx,
  consentId: string,
  personId: string
): Promise<void> {
  await tx.query(
    `UPDATE consent_records SET bound_person_id = $1, bound_at = now()
     WHERE id = $2 AND bound_person_id IS NULL`,
    [personId, consentId]
  );
}

export async function getConsentsByFamily(tx: Tx, familyId: string) {
  const { rows } = await tx.query(
    `SELECT id, decision, version, notice_version, decided_at, bound_person_id
     FROM consent_records WHERE family_id = $1
     ORDER BY decided_at DESC`,
    [familyId]
  );
  return rows;
}

// ── Person Compliance Profiles ──────────────────────────────

export async function getComplianceProfile(tx: Tx, personId: string) {
  const { rows } = await tx.query(
    `SELECT age_band, minor_mode, verified_source, guardian_consent_version, effective_at
     FROM person_compliance_profiles WHERE person_id = $1`,
    [personId]
  );
  return rows[0] ?? null;
}

export async function insertComplianceProfile(
  tx: Tx,
  personId: string,
  ageBand: string,
  minorMode: boolean,
  verifiedSource: string,
  guardianPersonId: string | null = null,
  guardianConsentRecordId: string | null = null,
  guardianConsentVersion: number | null = null
): Promise<void> {
  await tx.query(
    `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source, guardian_person_id, guardian_consent_record_id, guardian_consent_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [personId, ageBand, minorMode, verifiedSource, guardianPersonId, guardianConsentRecordId, guardianConsentVersion]
  );
}

export async function updateComplianceProfileConsent(
  tx: Tx,
  personId: string,
  consentRecordId: string,
  consentVersion: number
): Promise<void> {
  await tx.query(
    `UPDATE person_compliance_profiles
     SET guardian_consent_record_id = $1, guardian_consent_version = $2, updated_at = now()
     WHERE person_id = $3`,
    [consentRecordId, consentVersion, personId]
  );
}
