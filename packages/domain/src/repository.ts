/**
 * Domain repository — all family-scoped data access lives here.
 * Routes must NOT hold direct SQL for family tables (guard R4).
 */

import type { PoolClient } from 'pg';
import {
  assertMinorProcessingAllowed,
  getComplianceProfileForUpdate,
  getConsentRecordForGate,
  getCurrentNoticeHash,
} from '@xiaoshuyin/compliance';
import {
  validateEvidenceProvenance,
  validateEvidenceSourceMessage,
  type EvidenceProvenanceWriter,
  type ProvenanceSource,
} from './provenance.js';

export type Tx = PoolClient;

export interface TransactionIdentityContext {
  accountId: string | null;
  personId: string | null;
  familyId: string | null;
  purpose: string | null;
}

/**
 * Read the authoritative RLS identity bound to the current PostgreSQL
 * transaction. This is package-internal state: callers must compare it before
 * any family/person/Evidence business read rather than trusting a supplied
 * TypeScript context object.
 */
export async function getCurrentTransactionIdentityContext(
  tx: Tx
): Promise<TransactionIdentityContext> {
  const { rows } = await tx.query(
    `SELECT
       app_account_id()::text AS account_id,
       app_person_id()::text AS person_id,
       app_family_id()::text AS family_id,
       app_current_purpose() AS purpose`
  );
  const row = rows[0] ?? {};
  return {
    accountId: row.account_id ?? null,
    personId: row.person_id ?? null,
    familyId: row.family_id ?? null,
    purpose: row.purpose ?? null,
  };
}

// ── Person ──────────────────────────────────────────────────

export interface PersonRow {
  id: string;
  account_id: string | null;
  created_at: Date;
}

export async function getPersonByAccountId(tx: Tx, accountId: string): Promise<PersonRow | null> {
  const { rows } = await tx.query(
    'SELECT id, account_id, created_at FROM persons WHERE account_id = $1',
    [accountId]
  );
  return rows[0] ?? null;
}

export async function insertPerson(
  tx: Tx,
  id: string | null,
  accountId: string | null,
  createdByAccountId: string
): Promise<string> {
  const { rows } = await tx.query(
    'INSERT INTO persons (id, account_id, created_by_account_id) VALUES ($1, $2, $3) RETURNING id',
    [id, accountId, createdByAccountId]
  );
  return rows[0].id;
}

// ── Account (narrow access, R5) ─────────────────────────────

export async function getAccountById(tx: Tx, accountId: string) {
  const { rows } = await tx.query(
    'SELECT id, created_at, last_login_at, status FROM accounts WHERE id = $1',
    [accountId]
  );
  return rows[0] ?? null;
}

// ── Family ──────────────────────────────────────────────────

export interface CurrentFamilyRow {
  id: string;
  display_name: string | null;
  created_by_person_id: string;
  created_at: Date;
}

export type CurrentFamilyResolution =
  | { status: 'NONE' }
  | { status: 'RESOLVED'; family: CurrentFamilyRow }
  | { status: 'AMBIGUOUS' };

/**
 * Deterministic current-family resolution (contracts/authorization-and-rls.md §4.4).
 *
 *   membership = 0                          → NONE
 *   membership = 1                          → that family (ownership is irrelevant)
 *   membership > 1 + exactly 1 actor-owned  → that owned family
 *   membership > 1 + otherwise              → AMBIGUOUS (caller must return 409)
 *
 * Selection is rule-based only. There is deliberately no ORDER BY / LIMIT:
 * row order must never manufacture "current family" semantics.
 */
export async function resolveCurrentFamily(
  tx: Tx,
  personId: string
): Promise<CurrentFamilyResolution> {
  const { rows } = await tx.query<CurrentFamilyRow>(
    `SELECT f.id, f.display_name, f.created_by_person_id, f.created_at
     FROM families f
     JOIN family_members fm ON fm.family_id = f.id
     WHERE fm.person_id = $1`,
    [personId]
  );

  const [first] = rows;
  if (!first) return { status: 'NONE' };
  if (rows.length === 1) return { status: 'RESOLVED', family: first };

  const owned = rows.filter((row) => row.created_by_person_id === personId);
  const [ownedFamily] = owned;
  if (owned.length === 1 && ownedFamily) {
    return { status: 'RESOLVED', family: ownedFamily };
  }

  return { status: 'AMBIGUOUS' };
}

export async function getFamilyById(tx: Tx, familyId: string) {
  const { rows } = await tx.query(
    'SELECT created_by_person_id FROM families WHERE id = $1',
    [familyId]
  );
  return rows[0] ?? null;
}

export async function getFamilyByIdFull(tx: Tx, familyId: string) {
  const { rows } = await tx.query(
    `SELECT id, display_name, created_by_person_id, created_at
     FROM families WHERE id = $1`,
    [familyId]
  );
  return rows[0] ?? null;
}

/** Persist a brand-new family through the frozen `app.create_family` entry. */
export async function createFamily(
  tx: Tx,
  familyId: string,
  creatorPersonId: string,
  displayName: string | null
): Promise<void> {
  await tx.query('SELECT app.create_family($1, $2, $3)', [
    familyId,
    creatorPersonId,
    displayName,
  ]);
}

/** PostgreSQL 18 native UUIDv7 generator (never `crypto.randomUUID()`). */
export async function generateUuidv7(tx: Tx): Promise<string> {
  const { rows } = await tx.query('SELECT uuidv7() AS id');
  return rows[0].id;
}


// ── Family Member ───────────────────────────────────────────

export async function insertFamilyMember(tx: Tx, familyId: string, personId: string): Promise<void> {
  await tx.query(
    'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
    [familyId, personId]
  );
}

export async function isFamilyMember(tx: Tx, familyId: string, personId: string): Promise<boolean> {
  const { rows } = await tx.query(
    'SELECT 1 FROM family_members WHERE family_id = $1 AND person_id = $2',
    [familyId, personId]
  );
  return rows.length > 0;
}

export async function countFamilyMembers(tx: Tx, familyId: string): Promise<number> {
  const { rows } = await tx.query(
    'SELECT count(*) as cnt FROM family_members WHERE family_id = $1',
    [familyId]
  );
  return Number(rows[0].cnt);
}

// ── Person Profile Values ───────────────────────────────────

export async function getProfileValues(tx: Tx, personId: string) {
  const { rows } = await tx.query(
    `SELECT attribute, value_text, source_kind, status
     FROM person_profile_values WHERE person_id = $1 AND status = 'RECORDED'`,
    [personId]
  );
  return rows;
}

export async function getProfileValuesWithId(tx: Tx, personId: string) {
  const { rows } = await tx.query(
    `SELECT id, value_text, status, supersedes_id
     FROM person_profile_values
     WHERE person_id = $1 AND status = 'RECORDED'`,
    [personId]
  );
  return rows;
}

/** Frozen `ProfileValue` projection: only RECORDED values, full provenance. */
export async function getProfileValuesFull(tx: Tx, personId: string) {
  const { rows } = await tx.query(
    `SELECT id, attribute, value_text, source_kind, provided_by_person_id,
            observed_at, recorded_at, status, supersedes_id
     FROM person_profile_values
     WHERE person_id = $1 AND status = 'RECORDED'
     ORDER BY recorded_at`,
    [personId]
  );
  return rows;
}

export async function getProfileValuesBySource(tx: Tx, personId: string, attribute: string, sourceKind: string) {
  const { rows } = await tx.query(
    `SELECT id, value_text, status, supersedes_id
     FROM person_profile_values
     WHERE person_id = $1 AND attribute = $2 AND source_kind = $3 AND status = 'RECORDED'`,
    [personId, attribute, sourceKind]
  );
  return rows;
}

export async function insertProfileValue(
  tx: Tx,
  personId: string,
  attribute: string,
  valueText: string,
  sourceKind: string,
  providedByPersonId: string | null,
  recordedByAccountId: string,
  supersedesId: string | null = null,
  observedAt: Date | null = null
): Promise<void> {
  await tx.query(
    `INSERT INTO person_profile_values (person_id, attribute, value_text, source_kind, provided_by_person_id, recorded_by_account_id, supersedes_id, observed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [personId, attribute, valueText, sourceKind, providedByPersonId, recordedByAccountId, supersedesId, observedAt]
  );
}

export async function supersedeProfileValue(tx: Tx, id: string): Promise<void> {
  await tx.query(
    "UPDATE person_profile_values SET status = 'SUPERSEDED' WHERE id = $1",
    [id]
  );
}

// ── Business Audit Events ───────────────────────────────────

export async function insertAuditEvent(
  tx: Tx,
  familyId: string,
  actorAccountId: string,
  eventType: string,
  resourceType: string,
  resourceId: string
): Promise<void> {
  await tx.query(
    `INSERT INTO business_audit_events (family_id, actor_account_id, event_type, resource_type, resource_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [familyId, actorAccountId, eventType, resourceType, resourceId]
  );
}

// ── Idempotency Keys ────────────────────────────────────────

/**
 * Transaction-scoped advisory lock over (actor, command, key).
 * Serializes concurrent same-key requests BEFORE the idempotency lookup,
 * so at most one transaction can create business objects for a given key.
 * Released automatically at COMMIT / ROLLBACK.
 */
export async function lockIdempotencyKey(
  tx: Tx,
  actorAccountId: string,
  commandType: string,
  idempotencyKey: string
): Promise<void> {
  await tx.query(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0::bigint))',
    [`${actorAccountId}:${commandType}:${idempotencyKey}`]
  );
}

export async function getIdempotencyKey(
  tx: Tx,
  actorAccountId: string,
  commandType: string,
  idempotencyKey: string
) {
  const { rows } = await tx.query(
    `SELECT response_status, response_body, request_hash FROM idempotency_keys
     WHERE actor_account_id = $1 AND command_type = $2 AND idempotency_key = $3`,
    [actorAccountId, commandType, idempotencyKey]
  );
  return rows[0] ?? null;
}

export async function insertIdempotencyKey(
  tx: Tx,
  actorAccountId: string,
  commandType: string,
  idempotencyKey: string,
  requestHash: string,
  responseStatus: number,
  responseBody: string
): Promise<void> {
  await tx.query(
    `INSERT INTO idempotency_keys (actor_account_id, command_type, idempotency_key, request_hash, response_status, response_body)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actorAccountId, commandType, idempotencyKey, requestHash, responseStatus, responseBody]
  );
}

// ── Person + Compliance Profile join (for /me) ─────────────

export async function getPersonWithProfile(tx: Tx, accountId: string) {
  const { rows } = await tx.query(
    `SELECT p.id, p.created_at,
            cp.age_band, cp.minor_mode, cp.verified_source,
            cp.guardian_person_id, cp.guardian_consent_version, cp.effective_at
     FROM persons p
     LEFT JOIN person_compliance_profiles cp ON cp.person_id = p.id
     WHERE p.account_id = $1`,
    [accountId]
  );
  return rows[0] ?? null;
}

// ── Evidence Core: dialogue_messages ────────────────────────

export interface DialogueMessageRow {
  id: string;
  family_id: string;
  case_id: string;
  actor_account_id: string;
  source_person_id: string;
  content: string;
  recorded_at: Date;
}

/** Insert one raw Case message. `recorded_at` is server-owned by DEFAULT now(). */
export async function insertDialogueMessage(
  tx: Tx,
  args: {
    familyId: string;
    caseId: string;
    actorAccountId: string;
    sourcePersonId: string;
    content: string;
  }
): Promise<DialogueMessageRow> {
  const { rows } = await tx.query<DialogueMessageRow>(
    `INSERT INTO dialogue_messages
       (family_id, case_id, actor_account_id, source_person_id, content)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, family_id, case_id, actor_account_id, source_person_id, content, recorded_at`,
    [args.familyId, args.caseId, args.actorAccountId, args.sourcePersonId, args.content]
  );
  return rows[0]!;
}

export async function getDialogueMessageById(
  tx: Tx,
  id: string
): Promise<DialogueMessageRow | null> {
  const { rows } = await tx.query<DialogueMessageRow>(
    `SELECT id, family_id, case_id, actor_account_id, source_person_id, content, recorded_at
       FROM dialogue_messages WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

// ── Evidence Core: assertions / observations ────────────────

export interface EvidenceRefRow {
  id: string;
  family_id: string;
  case_id: string;
  conflict_group_id: string | null;
}

export interface EvidenceInsertResult {
  id: string;
  recorded_at: Date;
}

/**
 * ULT-001 defence-in-depth.
 *
 * Closing the package subpaths is not enough: a relative source import, an
 * in-package caller or a test could still reach these raw writers. They
 * therefore refuse the frozen-disabled provenance sources and writer
 * compositions themselves, using the same single-source provenance matrix as
 * the controlled writers. FACT is intentionally not judged here — it stays
 * rejected by the database hard guard (`assertions` INSERT policy).
 */
function refuseEvidenceWrite(
  code: 'EVIDENCE_PROVENANCE_INVALID' | 'EVIDENCE_HYPOTHESIS_SOURCE_UNAVAILABLE'
): never {
  throw Object.assign(new Error('Evidence provenance is not admissible'), {
    name: 'EvidenceDomainError',
    code,
  });
}

async function validateRawEvidenceProvenance(
  tx: Tx,
  row: {
    familyId: string;
    subjectPersonId: string | null;
    sourceKind: string;
    sourcePersonId: string | null;
  },
  writer: EvidenceProvenanceWriter
): Promise<void> {
  const subjectPersonId = row.subjectPersonId ?? null;
  const sourcePersonId = row.sourcePersonId ?? null;

  const subjectIsFamilyMember = subjectPersonId
    ? await isFamilyMember(tx, row.familyId, subjectPersonId)
    : false;
  const sourceIsFamilyMember = sourcePersonId
    ? await isFamilyMember(tx, row.familyId, sourcePersonId)
    : false;

  let sourceIsGuardianOfSubject = false;
  if (subjectPersonId && sourcePersonId) {
    const guardianPersonId = await getGuardianPersonId(tx, subjectPersonId);
    sourceIsGuardianOfSubject =
      guardianPersonId !== null && guardianPersonId === sourcePersonId;
  }

  const validation = validateEvidenceProvenance({
    writer,
    sourceKind: row.sourceKind as ProvenanceSource,
    subjectPersonId,
    sourcePersonId,
    subjectIsFamilyMember,
    sourceIsFamilyMember,
    sourceIsGuardianOfSubject,
  });

  if (!validation.ok) refuseEvidenceWrite(validation.code);
}

function refuseEvidencePersonReference(): never {
  throw Object.assign(new Error('Evidence person reference is invalid'), {
    name: 'EvidenceDomainError',
    code: 'EVIDENCE_PERSON_REFERENCE_INVALID',
  });
}

function refuseMinorProcessing(reason: string): never {
  throw Object.assign(new Error(reason), {
    name: 'ComplianceError',
    code: reason,
  });
}

export async function verifyEvidenceSourceMessage(
  tx: Tx,
  row: {
    familyId: string;
    caseId: string;
    sourcePersonId: string | null;
    sourceMessageId: string | null;
  }
): Promise<void> {
  if (row.sourceMessageId === null) return;

  const message = await getDialogueMessageById(tx, row.sourceMessageId);
  const validation = validateEvidenceSourceMessage({
    sourceMessageId: row.sourceMessageId,
    sourcePersonId: row.sourcePersonId,
    message: message
      ? {
          id: message.id,
          familyId: message.family_id,
          caseId: message.case_id,
          sourcePersonId: message.source_person_id,
        }
      : null,
    familyId: row.familyId,
    caseId: row.caseId,
  });

  if (!validation.ok) refuseEvidencePersonReference();
}

/**
 * COLD-002: every non-null Person reference processed by the write must pass
 * the existing compliance gate, not just the subject.
 *
 * `subjectPersonId === sourcePersonId` is deduped to a single check without
 * changing semantics. The person ids are sorted before any `FOR UPDATE` read
 * so cross-subject/source writes always take row locks in one stable order.
 */
function processingPersonIds(
  subjectPersonId: string | null,
  sourcePersonId: string | null
): string[] {
  const ids: string[] = [];
  if (subjectPersonId !== null) ids.push(subjectPersonId);
  if (sourcePersonId !== null) ids.push(sourcePersonId);
  return [...new Set(ids)].sort();
}

async function assertEvidencePersonProcessingAllowedForPerson(
  tx: Tx,
  personId: string
): Promise<void> {
  const row = await getComplianceProfileForUpdate(tx, personId);
  const profile = row
    ? {
        ageBand: row.age_band as 'ADULT' | 'MINOR_14_17' | 'UNDER_14' | 'UNKNOWN',
        minorMode: row.minor_mode as boolean,
        guardianPersonId: (row.guardian_person_id ?? null) as string | null,
        guardianConsentRecordId: (row.guardian_consent_record_id ?? null) as string | null,
        guardianConsentVersion: (row.guardian_consent_version ?? null) as number | null,
        verifiedSource: row.verified_source as string,
      }
    : null;

  let consent: {
    id: string;
    decision: 'GRANTED' | 'REVOKED';
    boundPersonId: string | null;
    noticeHash: string;
    guardianPersonId: string;
  } | null = null;

  if (profile?.guardianConsentRecordId) {
    const c = await getConsentRecordForGate(tx, profile.guardianConsentRecordId);
    consent = c
      ? {
          id: c.id,
          decision: c.decision,
          boundPersonId: c.bound_person_id,
          noticeHash: c.notice_hash,
          guardianPersonId: c.guardian_person_id,
        }
      : null;
  }

  const result = assertMinorProcessingAllowed(personId, {
    getProfile: () => profile,
    getConsentRecord: () => consent,
    getCurrentNoticeHash,
  });

  if (result.decision === 'BLOCK') refuseMinorProcessing(result.reason);
}

/** Runs the existing compliance gate over every processed Person reference. */
async function assertEvidencePersonProcessingAllowed(
  tx: Tx,
  subjectPersonId: string | null,
  sourcePersonId: string | null
): Promise<void> {
  for (const personId of processingPersonIds(subjectPersonId, sourcePersonId)) {
    await assertEvidencePersonProcessingAllowedForPerson(tx, personId);
  }
}

/** Guardian relationship of a subject Person (Slice 1 frozen semantics). */
export async function getGuardianPersonId(
  tx: Tx,
  subjectPersonId: string
): Promise<string | null> {
  const { rows } = await tx.query(
    `SELECT guardian_person_id FROM person_compliance_profiles WHERE person_id = $1`,
    [subjectPersonId]
  );
  return rows[0]?.guardian_person_id ?? null;
}

export async function getAssertionRef(tx: Tx, id: string): Promise<EvidenceRefRow | null> {
  const { rows } = await tx.query<EvidenceRefRow>(
    `SELECT id, family_id, case_id, conflict_group_id FROM assertions WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getObservationRef(tx: Tx, id: string): Promise<EvidenceRefRow | null> {
  const { rows } = await tx.query<EvidenceRefRow>(
    `SELECT id, family_id, case_id, conflict_group_id FROM observations WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getAssertionSupersedeTarget(
  tx: Tx,
  id: string
): Promise<{ id: string; family_id: string; case_id: string } | null> {
  const { rows } = await tx.query(
    `SELECT id, family_id, case_id FROM assertions WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getObservationSupersedeTarget(
  tx: Tx,
  id: string
): Promise<{ id: string; family_id: string; case_id: string } | null> {
  const { rows } = await tx.query(
    `SELECT id, family_id, case_id FROM observations WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export interface AssertionInsertRow {
  familyId: string;
  caseId: string;
  subjectPersonId: string | null;
  sourceKind: string;
  sourcePersonId: string | null;
  sourceMessageId: string | null;
  occurredTimeState: string;
  occurredAt: Date | null;
  validFrom: Date | null;
  validUntil: Date | null;
  confirmationStatus: string;
  supersedesId: string | null;
  kind: 'STATEMENT' | 'HYPOTHESIS';
  content: string;
}

export async function insertEvidenceAssertion(
  tx: Tx,
  row: AssertionInsertRow
): Promise<EvidenceInsertResult> {
  // Execute the same frozen provenance matrix as the controlled writer.
  // FACT still reaches the database hard guard when its provenance is otherwise
  // admissible; HYPOTHESIS fails closed in the shared seam.
  await validateRawEvidenceProvenance(
    tx,
    row,
    row.kind === 'HYPOTHESIS' ? 'RECORD_HYPOTHESIS' : 'RECORD_STATEMENT'
  );
  await verifyEvidenceSourceMessage(tx, row);
  await assertEvidencePersonProcessingAllowed(tx, row.subjectPersonId, row.sourcePersonId);

  const { rows } = await tx.query(
    `INSERT INTO assertions
       (family_id, case_id, subject_person_id, source_kind, source_person_id,
        source_message_id, occurred_time_state, occurred_at, valid_from, valid_until,
        confirmation_status, supersedes_id, kind, content)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id, recorded_at`,
    [
      row.familyId,
      row.caseId,
      row.subjectPersonId,
      row.sourceKind,
      row.sourcePersonId,
      row.sourceMessageId,
      row.occurredTimeState,
      row.occurredAt,
      row.validFrom,
      row.validUntil,
      row.confirmationStatus,
      row.supersedesId,
      row.kind,
      row.content,
    ]
  );
  return rows[0]!;
}

export interface ObservationInsertRow {
  familyId: string;
  caseId: string;
  subjectPersonId: string | null;
  sourceKind: string;
  sourcePersonId: string | null;
  sourceMessageId: string | null;
  occurredTimeState: string;
  occurredAt: Date | null;
  validFrom: Date | null;
  validUntil: Date | null;
  confirmationStatus: string;
  supersedesId: string | null;
  observationCode: string;
  valueState: string;
  valueType: string | null;
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  unit: string | null;
}

export async function insertEvidenceObservation(
  tx: Tx,
  row: ObservationInsertRow
): Promise<EvidenceInsertResult> {
  // Execute the same frozen provenance matrix as recordObservation().
  await validateRawEvidenceProvenance(tx, row, 'RECORD_OBSERVATION');
  await verifyEvidenceSourceMessage(tx, row);
  await assertEvidencePersonProcessingAllowed(tx, row.subjectPersonId, row.sourcePersonId);

  const { rows } = await tx.query(
    `INSERT INTO observations
       (family_id, case_id, subject_person_id, source_kind, source_person_id,
        source_message_id, occurred_time_state, occurred_at, valid_from, valid_until,
        confirmation_status, supersedes_id, observation_code,
        value_state, value_type, value_text, value_number, value_boolean, unit)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     RETURNING id, recorded_at`,
    [
      row.familyId,
      row.caseId,
      row.subjectPersonId,
      row.sourceKind,
      row.sourcePersonId,
      row.sourceMessageId,
      row.occurredTimeState,
      row.occurredAt,
      row.validFrom,
      row.validUntil,
      row.confirmationStatus,
      row.supersedesId,
      row.observationCode,
      row.valueState,
      row.valueType,
      row.valueText,
      row.valueNumber,
      row.valueBoolean,
      row.unit,
    ]
  );
  return rows[0]!;
}

/**
 * AUD-II-002: conflict_group_id is immutable once assigned.
 *
 * The conditional WHERE makes NULL -> group and same -> same the only
 * transitions a concurrent transaction can win. A transaction that read NULL
 * before another committed gets rowCount = 0 once the row lock is released
 * (READ COMMITTED re-evaluates the predicate) and must fail closed, so a
 * G1 -> G2 migration can never happen.
 */
export async function setAssertionConflictGroup(
  tx: Tx,
  id: string,
  conflictGroupId: string
): Promise<boolean> {
  const { rowCount } = await tx.query(
    `UPDATE assertions
        SET conflict_group_id = $1
      WHERE id = $2
        AND (conflict_group_id IS NULL OR conflict_group_id = $1)`,
    [conflictGroupId, id]
  );
  return rowCount === 1;
}

export async function setObservationConflictGroup(
  tx: Tx,
  id: string,
  conflictGroupId: string
): Promise<boolean> {
  const { rowCount } = await tx.query(
    `UPDATE observations
        SET conflict_group_id = $1
      WHERE id = $2
        AND (conflict_group_id IS NULL OR conflict_group_id = $1)`,
    [conflictGroupId, id]
  );
  return rowCount === 1;
}
