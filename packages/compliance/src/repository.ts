/**
 * Compliance repository — consent + compliance profile data access.
 * Routes must NOT hold direct SQL for these tables (guard R4).
 *
 * Every read that is used to make a "this consent is still valid" decision
 * validates `evidence` against the single `ConsentEvidence` schema and fails
 * closed on legacy / malformed rows (F6).
 */

import type { PoolClient } from 'pg';
import { ConsentEvidence, type ConsentEvidenceType } from '@xiaoshuyin/contracts';

export type Tx = PoolClient;

export interface ConsentRecordRow {
  id: string;
  family_id: string;
  guardian_person_id: string | null;
  guardian_account_id: string | null;
  purpose: string;
  decision: 'GRANTED' | 'DECLINED' | 'REVOKED';
  version: number;
  onboarding_request_id: string | null;
  bound_person_id: string | null;
  bound_at: Date | null;
  case_id: string | null;
  decision_actor_person_id: string | null;
  decision_actor_account_id: string | null;
  disclosure_reference: string | null;
  confirmation_statement_hash: string | null;
  notice_version: string;
  notice_hash: string;
  policy_version: string;
  evidence: unknown;
  decided_at: Date;
  supersedes_id: string | null;
}

function evidenceIsValid(evidence: unknown): boolean {
  return ConsentEvidence.safeParse(evidence).success;
}

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
     RETURNING id, status, notice_version, notice_hash, expires_at`,
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

export async function getConsentRequestForGate(tx: Tx, id: string) {
  const { rows } = await tx.query(
    `SELECT id, status, expires_at, notice_version, notice_hash, guardian_person_id,
            subject_person_id, family_id
     FROM guardian_consent_requests WHERE id = $1`,
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

const CONSENT_COLUMNS = `id, family_id, guardian_person_id, guardian_account_id, purpose,
  decision, version, onboarding_request_id, bound_person_id, bound_at,
  case_id, decision_actor_person_id, decision_actor_account_id,
  disclosure_reference, confirmation_statement_hash,
  notice_version, notice_hash, policy_version, evidence, decided_at, supersedes_id`;

// FR-004: every guardian gate / binding / revoke path must only ever consider
// the guardian purpose. Supplemental truth can never satisfy a guardian gate.
const GUARDIAN_PURPOSE = 'UNDER_14_GUARDIAN_CONSENT';

export async function getConsentRecordForUpdate(tx: Tx, id: string): Promise<ConsentRecordRow | null> {
  const { rows } = await tx.query(
    `SELECT ${CONSENT_COLUMNS} FROM consent_records
      WHERE id = $1 AND purpose = '${GUARDIAN_PURPOSE}' FOR UPDATE`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getConsentRecordById(tx: Tx, id: string): Promise<ConsentRecordRow | null> {
  const { rows } = await tx.query(
    `SELECT ${CONSENT_COLUMNS} FROM consent_records WHERE id = $1 FOR UPDATE`,
    [id]
  );
  return rows[0] ?? null;
}

export interface ValidConsentOptions {
  familyId: string;
  guardianPersonId: string;
  guardianAccountId: string;
  currentNoticeHash: string;
}

/**
 * F2 / F6: a consent may only be used for a first bind when it is the current,
 * still-valid chain head:
 *   - GRANTED, not yet bound;
 *   - same family + same guardian person/account;
 *   - notice still current;
 *   - its onboarding request still valid and not expired;
 *   - no other row supersedes it;
 *   - evidence passes the frozen `ConsentEvidence` schema.
 * Anything else returns null (fail closed, no legacy evidence repair).
 */
export async function getValidConsentForBinding(
  tx: Tx,
  id: string,
  opts: ValidConsentOptions
): Promise<ConsentRecordRow | null> {
  const { rows } = await tx.query(
    `SELECT ${CONSENT_COLUMNS},
            NOT EXISTS (SELECT 1 FROM consent_records s WHERE s.supersedes_id = c.id) AS is_chain_head,
            (SELECT (r.expires_at > now()
                     AND r.family_id = c.family_id
                     AND r.notice_hash = c.notice_hash
                     AND r.status NOT IN ('EXPIRED', 'ABANDONED'))
             FROM guardian_consent_requests r
             WHERE r.id = c.onboarding_request_id) AS request_valid
     FROM consent_records c
     WHERE c.id = $1
       AND c.purpose = '${GUARDIAN_PURPOSE}'
     FOR UPDATE`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;

  if (row.decision !== 'GRANTED') return null;
  if (row.bound_person_id !== null) return null;
  if (row.family_id !== opts.familyId) return null;
  if (row.guardian_person_id !== opts.guardianPersonId) return null;
  if (row.guardian_account_id !== opts.guardianAccountId) return null;
  if (row.notice_hash !== opts.currentNoticeHash) return null;
  if (row.is_chain_head !== true) return null;
  if (row.request_valid !== true) return null;
  if (!evidenceIsValid(row.evidence)) return null;

  return row;
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

/**
 * F6: the gate only sees a consent row whose evidence validates against the
 * frozen schema. Legacy `{accepted:true,timestamp}` rows are reported as
 * "no usable consent" → BLOCK, never silently repaired.
 */
export async function getConsentRecordForGate(tx: Tx, id: string) {
  const { rows } = await tx.query(
    `SELECT id, version, decision, bound_person_id, notice_hash, guardian_person_id, evidence
     FROM consent_records
      WHERE id = $1 AND purpose = '${GUARDIAN_PURPOSE}'`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  if (!evidenceIsValid(row.evidence)) return null;
  return row;
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
  evidence: ConsentEvidenceType,
  supersedesId: string | null = null
) {
  // The evidence column is never free-form jsonb: the single ConsentEvidence
  // schema validates the object before it is serialized for storage.
  const validatedEvidence = ConsentEvidence.parse(evidence);
  const { rows } = await tx.query(
    `INSERT INTO consent_records
       (family_id, guardian_person_id, guardian_account_id, purpose, decision,
        version, onboarding_request_id, bound_person_id, bound_at,
        notice_version, notice_hash, policy_version, evidence, supersedes_id)
     VALUES ($1, $2, $3, 'UNDER_14_GUARDIAN_CONSENT', $4, $5, $6, $7, $8,
             $9, $10, $11, $12, $13)
     RETURNING ${CONSENT_COLUMNS}`,
    [
      familyId, guardianPersonId, guardianAccountId, decision, version,
      onboardingRequestId, boundPersonId, boundAt,
      noticeVersion, noticeHash, policyVersion,
      JSON.stringify(validatedEvidence), supersedesId,
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
  // FR-060: the existing public read contract stays guardian-only. Supplemental
  // records are never exposed through this unapproved public projection.
  const { rows } = await tx.query(
    `SELECT ${CONSENT_COLUMNS} FROM consent_records
      WHERE family_id = $1 AND purpose = '${GUARDIAN_PURPOSE}'
      ORDER BY decided_at DESC`,
    [familyId]
  );
  return rows;
}

// ── Person Compliance Profiles ──────────────────────────────

export async function getComplianceProfile(tx: Tx, personId: string) {
  const { rows } = await tx.query(
    `SELECT person_id, age_band, minor_mode, verified_source,
            guardian_person_id, guardian_consent_record_id, guardian_consent_version, effective_at
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