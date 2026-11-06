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
// Same table as Slice 1; no second idempotency store. Every call is expected
// to run inside withRlsTransaction so the identity context is active.

export interface ReservedIdempotency {
  response_status: number;
  response_body: unknown;
  request_hash: string;
}

/**
 * Reserve the scope key. Returns true when this transaction owns the
 * reservation, false when a concurrent/committed record already exists.
 * The placeholder is `response_status = 0` / `response_body = '{}'`.
 */
export async function reserveIdempotency(
  tx: Tx,
  input: {
    actorAccountId: string;
    commandType: string;
    idempotencyKey: string;
    requestHash: string;
  }
): Promise<boolean> {
  const { rows } = await tx.query(
    `INSERT INTO idempotency_keys
       (actor_account_id, command_type, idempotency_key, request_hash, response_status, response_body)
     VALUES ($1, $2, $3, $4, 0, '{}'::jsonb)
     ON CONFLICT (actor_account_id, command_type, idempotency_key) DO NOTHING
     RETURNING id`,
    [input.actorAccountId, input.commandType, input.idempotencyKey, input.requestHash]
  );
  return rows.length > 0;
}

/**
 * Read the reservation under a share lock so a concurrent transaction cannot
 * rewrite the row while this one decides replay vs mismatch.
 */
export async function getReservedIdempotency(
  tx: Tx,
  input: { actorAccountId: string; commandType: string; idempotencyKey: string }
): Promise<ReservedIdempotency | null> {
  const { rows } = await tx.query<ReservedIdempotency>(
    `SELECT response_status, response_body, request_hash
     FROM idempotency_keys
     WHERE actor_account_id = $1 AND command_type = $2 AND idempotency_key = $3
     FOR SHARE`,
    [input.actorAccountId, input.commandType, input.idempotencyKey]
  );
  return rows[0] ?? null;
}

/**
 * Fill the reserved row with the real response inside the same transaction.
 * A replay never reaches this function, so no business row is duplicated.
 */
export async function completeIdempotency(
  tx: Tx,
  input: {
    actorAccountId: string;
    commandType: string;
    idempotencyKey: string;
    status: number;
    body: unknown;
  }
): Promise<void> {
  await tx.query(
    `UPDATE idempotency_keys
     SET response_status = $4, response_body = $5::jsonb
     WHERE actor_account_id = $1 AND command_type = $2 AND idempotency_key = $3`,
    [
      input.actorAccountId,
      input.commandType,
      input.idempotencyKey,
      input.status,
      JSON.stringify(input.body),
    ]
  );
}
