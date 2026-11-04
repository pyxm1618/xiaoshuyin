/**
 * Domain repository — all family-scoped data access lives here.
 * Routes must NOT hold direct SQL for family tables (guard R4).
 */

import type { PoolClient } from 'pg';

export type Tx = PoolClient;

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
    'SELECT id, created_at, last_login_at FROM accounts WHERE id = $1',
    [accountId]
  );
  return rows[0] ?? null;
}

// ── Family ──────────────────────────────────────────────────

export async function getFamilyIdByPersonId(tx: Tx, personId: string): Promise<string | null> {
  const { rows } = await tx.query(
    `SELECT f.id FROM families f
     JOIN family_members fm ON fm.family_id = f.id
     WHERE fm.person_id = $1`,
    [personId]
  );
  return rows[0]?.id ?? null;
}

export async function getFamilyById(tx: Tx, familyId: string) {
  const { rows } = await tx.query(
    'SELECT created_by_person_id FROM families WHERE id = $1',
    [familyId]
  );
  return rows[0] ?? null;
}

export async function getCurrentFamily(tx: Tx, personId: string) {
  const { rows } = await tx.query(
    `SELECT f.id, f.display_name, f.created_by_person_id, f.created_at
     FROM families f
     JOIN family_members fm ON fm.family_id = f.id
     WHERE fm.person_id = $1`,
    [personId]
  );
  return rows[0] ?? null;
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
    `SELECT p.id, p.created_at, cp.age_band, cp.minor_mode, cp.verified_source
     FROM persons p
     LEFT JOIN person_compliance_profiles cp ON cp.person_id = p.id
     WHERE p.account_id = $1`,
    [accountId]
  );
  return rows[0] ?? null;
}
