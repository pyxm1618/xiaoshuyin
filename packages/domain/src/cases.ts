/**
 * Case Core repository — every `cases` / `case_events` statement lives here.
 * Routes must not hold SQL for Case tables (guard R4).
 *
 * Concurrency contract (plan.md D-3):
 *   Family row FOR UPDATE → independent EXISTS(primary) → INSERT case
 * The partial unique index `cases_one_primary_open_per_family` is the last
 * line of defence; a 23505 there is a real failure, never a normal branch.
 */

import type { PoolClient } from 'pg';
import { buildSwitchAuditMetadata } from './case-primary-switch.js';

type Tx = PoolClient;

export type CaseStatusValue =
  | 'OPEN' | 'WAITING' | 'PAUSED' | 'LOST_CONTACT' | 'SAFETY_HOLD' | 'CLOSED';

export type CasePhaseValue =
  | 'INTAKE' | 'ASSESSMENT' | 'PROBLEM_FORMULATION' | 'GOALS'
  | 'PLANNING' | 'EXECUTION' | 'REVIEW' | 'MAINTENANCE' | 'CLOSED';

export interface CaseRow {
  id: string;
  family_id: string;
  created_by_person_id: string;
  status: CaseStatusValue;
  phase: CasePhaseValue;
  is_primary: boolean;
  version: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Serialization point for primary assignment. Every Case write command must
 * take this lock first, so two concurrent creates in the same Family are
 * ordered before the primary existence decision.
 */
export async function lockFamilyForPrimaryDecision(tx: Tx, familyId: string): Promise<boolean> {
  const { rows } = await tx.query('SELECT id FROM families WHERE id = $1 FOR UPDATE', [familyId]);
  return rows.length > 0;
}

/**
 * Independent statement (fresh snapshot after the lock) — never folded into
 * the INSERT, so the decision cannot be evaluated against a stale read.
 */
export async function existsCurrentPrimary(tx: Tx, familyId: string): Promise<boolean> {
  const { rows } = await tx.query(
    `SELECT EXISTS (
       SELECT 1 FROM cases
       WHERE family_id = $1 AND is_primary AND status <> 'CLOSED'
     ) AS exists`,
    [familyId]
  );
  return rows[0].exists === true;
}

export async function insertCase(
  tx: Tx,
  input: { familyId: string; createdByPersonId: string; isPrimary: boolean }
): Promise<CaseRow> {
  const { rows } = await tx.query<CaseRow>(
    `INSERT INTO cases
       (family_id, created_by_person_id, status, phase, is_primary, version)
     VALUES ($1, $2, 'OPEN', 'INTAKE', $3, 1)
     RETURNING id, family_id, created_by_person_id, status, phase,
               is_primary, version, created_at, updated_at`,
    [input.familyId, input.createdByPersonId, input.isPrimary]
  );
  const inserted = rows[0];
  if (!inserted) throw new Error('CASE_INSERT_RETURNED_NO_ROW');
  return inserted;
}

export async function getCaseById(tx: Tx, caseId: string): Promise<CaseRow | null> {
  const { rows } = await tx.query<CaseRow>(
    `SELECT id, family_id, created_by_person_id, status, phase,
            is_primary, version, created_at, updated_at
     FROM cases
     WHERE id = $1`,
    [caseId]
  );
  return rows[0] ?? null;
}

/**
 * Frozen ordering: primary first, then oldest, then id — the only stable
 * presentation of the collection. `primary = true` remains the single source
 * of truth for the current primary Case; ordering is not a second one.
 */
export async function listCases(tx: Tx, familyId: string): Promise<CaseRow[]> {
  const { rows } = await tx.query<CaseRow>(
    `SELECT id, family_id, created_by_person_id, status, phase,
            is_primary, version, created_at, updated_at
     FROM cases
     WHERE family_id = $1
     ORDER BY is_primary DESC, created_at ASC, id ASC`,
    [familyId]
  );
  return rows;
}

/**
 * Domain history: exactly one CASE_CREATED row per successful creation.
 * metadata is written explicitly as { primary, version } — the shape CHECK
 * rejects any additional key (content / PII).
 */
export async function insertCaseEvent(
  tx: Tx,
  input: {
    familyId: string;
    caseId: string;
    actorAccountId: string;
    primary: boolean;
    version: number;
  }
): Promise<void> {
  await tx.query(
    `INSERT INTO case_events (family_id, case_id, actor_account_id, event_type, metadata)
     VALUES ($1, $2, $3, 'CASE_CREATED', $4::jsonb)`,
    [
      input.familyId,
      input.caseId,
      input.actorAccountId,
      JSON.stringify({ primary: input.primary, version: input.version }),
    ]
  );
}

/**
 * Cross-resource business audit. Separate responsibility from the domain
 * event above — they are never merged and neither is written on reads.
 */
export async function insertCaseAudit(
  tx: Tx,
  input: {
    familyId: string;
    caseId: string;
    actorAccountId: string;
    primary: boolean;
    version: number;
  }
): Promise<void> {
  await tx.query(
    `INSERT INTO business_audit_events
       (family_id, actor_account_id, event_type, resource_type, resource_id, metadata)
     VALUES ($1, $2, 'CASE_CREATED', 'CASE', $3, $4::jsonb)`,
    [
      input.familyId,
      input.actorAccountId,
      input.caseId,
      JSON.stringify({ primary: input.primary, version: input.version }),
    ]
  );
}

// ── Idempotency (CASE_CREATE) ───────────────────────────────

/**
 * Exact physical identity for the logical CASE_CREATE idempotency key.
 *
 * Owner-approved technical storage amendment (Round 2, Finding 4):
 *   * the frozen logical scope stays (actor_account_id, command_type, logical
 *     idempotencyKey) — exact identity, never a digest;
 *   * the logical key is a JS string of 8–128 UTF-16 code units, which may
 *     contain U+0000 or lone surrogates and therefore cannot always live in a
 *     PostgreSQL `text` column;
 *   * new CASE_CREATE rows store the UTF-16LE bytes in `idempotency_key_bytes`
 *     (bytea). The mapping is deterministic, reversible and injective for every
 *     legal input, so distinct logical keys always produce distinct bytes.
 *
 * No reserved prefixes, no base64 text, no SHA fallback, no truncation.
 */
export function caseIdempotencyKeyBytes(logicalKey: string): Buffer {
  return Buffer.from(logicalKey, 'utf16le');
}

/**
 * Legacy compatibility: CASE_CREATE rows written before 003 stored the raw
 * logical key in the `text` column. That column cannot hold U+0000 or lone
 * surrogates, so the legacy lookup is only attempted for keys PostgreSQL can
 * actually receive as text.
 */
export function isLegacyTextLookupSafe(logicalKey: string): boolean {
  if (logicalKey.includes('\u0000')) return false;
  if (typeof logicalKey.isWellFormed === 'function' && !logicalKey.isWellFormed()) return false;
  return true;
}

// ── Idempotency (CASE_CREATE) ───────────────────────────────
// Same table as Slice 1; no second idempotency store. Every call is expected
// to run inside withRlsTransaction so the identity context is active.

export interface ReservedIdempotency {
  response_status: number;
  response_body: unknown;
  request_hash: string;
}

/**
 * Read the reservation under a share lock so a concurrent transaction cannot
 * rewrite the row while this one decides replay vs mismatch.
 *
 * New rows are matched on the exact byte representation. If that misses and
 * the logical key is text-safe, the legacy raw-text row (bytes IS NULL) is
 * consulted so pre-003 data keeps replaying under its own raw identity.
 * `u:` / `h:` have no reserved meaning.
 */
export async function getReservedIdempotency(
  tx: Tx,
  input: {
    actorAccountId: string;
    commandType: string;
    keyBytes: Buffer;
    legacyKeyText: string | null;
  }
): Promise<ReservedIdempotency | null> {
  const byBytes = await tx.query<ReservedIdempotency>(
    `SELECT response_status, response_body, request_hash
     FROM idempotency_keys
     WHERE actor_account_id = $1 AND command_type = $2 AND idempotency_key_bytes = $3
     FOR SHARE`,
    [input.actorAccountId, input.commandType, input.keyBytes]
  );
  if (byBytes.rows[0]) return byBytes.rows[0];

  if (input.legacyKeyText === null) return null;

  const legacy = await tx.query<ReservedIdempotency>(
    `SELECT response_status, response_body, request_hash
     FROM idempotency_keys
     WHERE actor_account_id = $1
       AND command_type = $2
       AND idempotency_key = $3
       AND idempotency_key_bytes IS NULL
     FOR SHARE`,
    [input.actorAccountId, input.commandType, input.legacyKeyText]
  );
  return legacy.rows[0] ?? null;
}

/**
 * Reserve the exact byte scope key. Returns true when this transaction owns
 * the reservation, false when a concurrent transaction already inserted it.
 * `ON CONFLICT DO NOTHING` without a target covers both unique constraints
 * (text for Slice 1 / legacy rows, bytea for new CASE_CREATE rows).
 * The placeholder is `response_status = 0` / `response_body = '{}'`.
 */
export async function reserveIdempotency(
  tx: Tx,
  input: {
    actorAccountId: string;
    commandType: string;
    keyBytes: Buffer;
    requestHash: string;
  }
): Promise<boolean> {
  const { rows } = await tx.query(
    `INSERT INTO idempotency_keys
       (actor_account_id, command_type, idempotency_key, idempotency_key_bytes,
        request_hash, response_status, response_body)
     VALUES ($1, $2, NULL, $3, $4, 0, '{}'::jsonb)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [input.actorAccountId, input.commandType, input.keyBytes, input.requestHash]
  );
  return rows.length > 0;
}

/**
 * Fill the reserved bytea row with the real response inside the same
 * transaction. A replay never reaches this function, so no business row is
 * duplicated.
 */
export async function completeIdempotency(
  tx: Tx,
  input: {
    actorAccountId: string;
    commandType: string;
    keyBytes: Buffer;
    status: number;
    body: unknown;
  }
): Promise<void> {
  await tx.query(
    `UPDATE idempotency_keys
     SET response_status = $4, response_body = $5::jsonb
     WHERE actor_account_id = $1 AND command_type = $2 AND idempotency_key_bytes = $3`,
    [
      input.actorAccountId,
      input.commandType,
      input.keyBytes,
      input.status,
      JSON.stringify(input.body),
    ]
  );
}
// ── SwitchPrimaryCase persistence (Slice 7, plan D-3 / D-4) ──

/**
 * Re-read the current un-closed primary after the Family lock. At most one row
 * is expected (partial unique index); the caller turns >1 into INTERNAL_ERROR.
 */
export async function getCurrentPrimaryForUpdate(
  tx: Tx,
  familyId: string
): Promise<CaseRow[]> {
  const { rows } = await tx.query<CaseRow>(
    `SELECT id, family_id, created_by_person_id, status, phase,
            is_primary, version, created_at, updated_at
     FROM cases
     WHERE family_id = $1 AND is_primary AND status <> 'CLOSED'
     ORDER BY id
     FOR UPDATE`,
    [familyId]
  );
  return rows;
}

export interface SwitchPrimaryLockSnapshot {
  /** The locked current un-closed primary, or null (promotion branch). */
  current: CaseRow | null;
  /** The locked requested target, or null (missing / hidden by RLS). */
  target: CaseRow | null;
  /** Number of un-closed primary rows observed; >1 is INTERNAL_ERROR. */
  currentCount: number;
}

/**
 * Lock the current primary and the requested target in ONE deterministic
 * order (plan D-3.3).
 *
 * Steps, frozen:
 *   1. collect the current un-closed primary id(s) for the Family;
 *   2. collect the target id;
 *   3. de-duplicate;
 *   4. sort Case ids ascending;
 *   5. lock every row with a single `WHERE id = ANY(...) ORDER BY id
 *      FOR UPDATE` statement (PostgreSQL acquires the row locks in the sorted
 *      order, so two transactions can never build a lock cycle);
 *   6. re-map the rows back to `current` / `target`.
 *
 * The Family row lock is already held by the caller, and every primary write
 * command takes it first (`CASE_CREATE` and `SwitchPrimaryCase`), so the set
 * collected in step 1 cannot change before step 5.
 *
 * `current` / `target` may be the same row when the target already is the
 * primary; the decision function then reports `CASE_ALREADY_PRIMARY`.
 * A target of another Family is hidden by RLS and yields `target === null`.
 */
export async function lockCasesForSwitchPrimary(
  tx: Tx,
  input: { familyId: string; targetCaseId: string }
): Promise<SwitchPrimaryLockSnapshot> {
  const { rows: primaryRows } = await tx.query<{ id: string }>(
    `SELECT id
       FROM cases
      WHERE family_id = $1 AND is_primary AND status <> 'CLOSED'`,
    [input.familyId]
  );

  const ids = Array.from(
    new Set([...primaryRows.map((row) => row.id), input.targetCaseId])
  ).sort();

  const { rows } = await tx.query<CaseRow>(
    `SELECT id, family_id, created_by_person_id, status, phase,
            is_primary, version, created_at, updated_at
       FROM cases
      WHERE id = ANY($1::uuid[])
      ORDER BY id
      FOR UPDATE`,
    [ids]
  );

  const target = rows.find((row) => row.id === input.targetCaseId) ?? null;
  const primaries = rows.filter(
    (row) =>
      row.family_id === input.familyId && row.is_primary && row.status !== 'CLOSED'
  );

  return {
    current: primaries[0] ?? null,
    target,
    currentCount: primaries.length,
  };
}

/** Lock the requested target Case. RLS hides rows of another Family. */
export async function getCaseForUpdate(tx: Tx, caseId: string): Promise<CaseRow | null> {
  const { rows } = await tx.query<CaseRow>(
    `SELECT id, family_id, created_by_person_id, status, phase,
            is_primary, version, created_at, updated_at
     FROM cases
     WHERE id = $1
     FOR UPDATE`,
    [caseId]
  );
  return rows[0] ?? null;
}

/**
 * Demote first, then promote: the zero-primary intermediate state is not
 * visible to other transactions and the partial unique index allows 0 rows.
 * `version` increments in SQL; `status` / `phase` are never written.
 */
export async function demotePrimaryCase(tx: Tx, caseId: string): Promise<CaseRow> {
  const { rows } = await tx.query<CaseRow>(
    `UPDATE cases
        SET is_primary = false, version = version + 1, updated_at = now()
      WHERE id = $1
      RETURNING id, family_id, created_by_person_id, status, phase,
                is_primary, version, created_at, updated_at`,
    [caseId]
  );
  const row = rows[0];
  if (!row) throw new Error('CASE_DEMOTE_RETURNED_NO_ROW');
  return row;
}

export async function promotePrimaryCase(tx: Tx, caseId: string): Promise<CaseRow> {
  const { rows } = await tx.query<CaseRow>(
    `UPDATE cases
        SET is_primary = true, version = version + 1, updated_at = now()
      WHERE id = $1
      RETURNING id, family_id, created_by_person_id, status, phase,
                is_primary, version, created_at, updated_at`,
    [caseId]
  );
  const row = rows[0];
  if (!row) throw new Error('CASE_PROMOTE_RETURNED_NO_ROW');
  return row;
}

export async function insertPrimaryAssignedEvent(
  tx: Tx,
  input: {
    familyId: string;
    caseId: string;
    actorAccountId: string;
    version: number;
    previousPrimaryCaseId: string | null;
    reason: string;
  }
): Promise<void> {
  await tx.query(
    `INSERT INTO case_events (family_id, case_id, actor_account_id, event_type, metadata)
     VALUES ($1, $2, $3, 'CASE_PRIMARY_ASSIGNED', $4::jsonb)`,
    [
      input.familyId,
      input.caseId,
      input.actorAccountId,
      JSON.stringify({
        primary: true,
        version: input.version,
        previousPrimaryCaseId: input.previousPrimaryCaseId,
        reason: input.reason,
      }),
    ]
  );
}

export async function insertPrimaryRevokedEvent(
  tx: Tx,
  input: {
    familyId: string;
    caseId: string;
    actorAccountId: string;
    version: number;
    newPrimaryCaseId: string;
    reason: string;
  }
): Promise<void> {
  await tx.query(
    `INSERT INTO case_events (family_id, case_id, actor_account_id, event_type, metadata)
     VALUES ($1, $2, $3, 'CASE_PRIMARY_REVOKED', $4::jsonb)`,
    [
      input.familyId,
      input.caseId,
      input.actorAccountId,
      JSON.stringify({
        primary: false,
        version: input.version,
        newPrimaryCaseId: input.newPrimaryCaseId,
        reason: input.reason,
      }),
    ]
  );
}

export async function insertPrimarySwitchAudit(
  tx: Tx,
  input: {
    familyId: string;
    targetCaseId: string;
    actorAccountId: string;
    previousPrimaryCaseId: string | null;
    newPrimaryCaseId: string;
    previousVersion: number | null;
    newVersion: number;
    reason: string;
  }
): Promise<void> {
  // Frozen metadata (plan D-2.3): all six fields are required. Versions come
  // from the `UPDATE ... RETURNING` rows, never from a client view or +1 math.
  const metadata = buildSwitchAuditMetadata({
    targetCaseId: input.targetCaseId,
    previousPrimaryCaseId: input.previousPrimaryCaseId,
    newPrimaryCaseId: input.newPrimaryCaseId,
    previousVersion: input.previousVersion,
    newVersion: input.newVersion,
    reason: input.reason,
  });
  await tx.query(
    `INSERT INTO business_audit_events
       (family_id, actor_account_id, event_type, resource_type, resource_id, metadata)
     VALUES ($1, $2, 'CASE_PRIMARY_SWITCHED', 'CASE', $3, $4::jsonb)`,
    [input.familyId, input.actorAccountId, input.targetCaseId, JSON.stringify(metadata)]
  );
}

export type IdempotencySlot =
  | { kind: 'OWNED' }
  | { kind: 'REPLAY'; status: number; body: unknown }
  | { kind: 'MISMATCH' }
  | { kind: 'POISONED' }
  | { kind: 'CONTENTION' };

/**
 * Bounded two-attempt slot acquisition (plan D-7.5). A 23505 from the reserve
 * insert is never swallowed here: reserve uses ON CONFLICT DO NOTHING, so a
 * real unique violation is an infrastructure failure that must propagate.
 */
export async function acquireIdempotencySlot(
  tx: Tx,
  input: {
    actorAccountId: string;
    commandType: string;
    keyBytes: Buffer;
    requestHash: string;
  }
): Promise<IdempotencySlot> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const owned = await reserveIdempotency(tx, {
      actorAccountId: input.actorAccountId,
      commandType: input.commandType,
      keyBytes: input.keyBytes,
      requestHash: input.requestHash,
    });
    if (owned) return { kind: 'OWNED' };

    const row = await getReservedIdempotency(tx, {
      actorAccountId: input.actorAccountId,
      commandType: input.commandType,
      keyBytes: input.keyBytes,
      legacyKeyText: null,
    });
    if (row === null) continue;
    if (row.response_status === 0) return { kind: 'POISONED' };
    if (row.request_hash === input.requestHash) {
      return { kind: 'REPLAY', status: row.response_status, body: row.response_body };
    }
    return { kind: 'MISMATCH' };
  }
  return { kind: 'CONTENTION' };
}
