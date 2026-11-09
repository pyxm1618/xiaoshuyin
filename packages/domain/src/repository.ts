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

export async function getPersonById(tx: Tx, personId: string): Promise<PersonRow | null> {
  const { rows } = await tx.query(
    'SELECT id, account_id, created_at FROM persons WHERE id = $1',
    [personId]
  );
  return rows[0] ?? null;
}

/**
 * Identity-binding Gate / Phase C read: the target Person row is locked so a
 * concurrent binding cannot interleave between Gate 2 and the conditional
 * update. RLS visibility comes from `persons_binding_target_read`.
 */
export async function lockPersonForBinding(tx: Tx, personId: string): Promise<PersonRow | null> {
  const { rows } = await tx.query(
    'SELECT id, account_id, created_at FROM persons WHERE id = $1 FOR UPDATE',
    [personId]
  );
  return rows[0] ?? null;
}

/**
 * Conditional Phase C binding. `account_id IS NULL` and the database unique
 * constraint are the final convergence point; the returned row count is the
 * authoritative outcome (1 = this transaction bound P1, 0 = lost the race).
 */
export async function bindPersonAccountIfUnbound(
  tx: Tx,
  personId: string,
  accountId: string
): Promise<number> {
  const result = await tx.query(
    `UPDATE persons
     SET account_id = $2, updated_at = now()
     WHERE id = $1 AND account_id IS NULL`,
    [personId, accountId]
  );
  return result.rowCount ?? 0;
}

/** Every current Family membership of P1 (used for the multi-family BLOCK). */
export async function getMembershipFamilyIds(tx: Tx, personId: string): Promise<string[]> {
  const { rows } = await tx.query(
    'SELECT family_id FROM family_members WHERE person_id = $1',
    [personId]
  );
  return rows.map((row: { family_id: string }) => row.family_id);
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

// ── Identity binding Gate 2 concurrency boundary (F-01) ─────

/**
 * Lock the authoritative rows Gate 2 reads, in the canonical fixed order that
 * every caller uses: persons → families → family_members →
 * person_compliance_profiles → consent_records. A concurrent invalidating
 * change either commits before this point (and is observed by the Gate) or
 * waits until the binding transaction ends.
 */
export async function lockBindingGateRows(
  tx: Tx,
  targetPersonId: string,
  targetFamilyId: string
): Promise<void> {
  // Every SELECT ... FOR UPDATE below runs under the runtime role and the
  // additive FOR UPDATE lock policies. A zero-row result is NEVER treated as a
  // successful lock: if a required fact row is not lockable, the caller fails
  // closed instead of evaluating a stale snapshot (H-02).
  const person = await tx.query('SELECT id FROM persons WHERE id = $1 FOR UPDATE', [
    targetPersonId,
  ]);
  if ((person.rowCount ?? 0) !== 1) throw new Error('BINDING_GATE_LOCK_UNVERIFIED');

  const family = await tx.query('SELECT id FROM families WHERE id = $1 FOR UPDATE', [
    targetFamilyId,
  ]);
  if ((family.rowCount ?? 0) !== 1) throw new Error('BINDING_GATE_LOCK_UNVERIFIED');

  const memberships = await tx.query(
    'SELECT person_id FROM family_members WHERE person_id = $1 FOR UPDATE',
    [targetPersonId]
  );
  if ((memberships.rowCount ?? 0) === 0) throw new Error('BINDING_GATE_LOCK_UNVERIFIED');

  // Profile / consent are optional fact rows: their absence is a Gate 2
  // business block (COMPLIANCE_BLOCKED), not an infrastructure failure. If the
  // row exists, however, it must be lockable.
  const profile = await tx.query(
    'SELECT person_id FROM person_compliance_profiles WHERE person_id = $1 FOR UPDATE',
    [targetPersonId]
  );
  if ((profile.rowCount ?? 0) > 1) throw new Error('BINDING_GATE_LOCK_UNVERIFIED');

  const consent = await tx.query(
    `SELECT id FROM consent_records
      WHERE id = (
        SELECT guardian_consent_record_id
          FROM person_compliance_profiles
         WHERE person_id = $1
      )
      FOR UPDATE`,
    [targetPersonId]
  );
  if ((consent.rowCount ?? 0) > 1) throw new Error('BINDING_GATE_LOCK_UNVERIFIED');
}
