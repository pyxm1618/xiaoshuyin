/**
 * Binding attempt repository (Slice 006-owned table).
 */

import type pg from 'pg';
import type {
  BindingAttemptRow,
  BindingTerminalReason,
} from '@xiaoshuyin/domain';

function mapRow(row: any): BindingAttemptRow {
  return {
    id: row.id,
    targetPersonId: row.target_person_id,
    targetFamilyId: row.target_family_id,
    invitationParticipationId: row.invitation_participation_id,
    candidateIdentityDigest: row.candidate_identity_digest,
    state: row.state,
    terminalReason: row.terminal_reason ?? null,
    committedAccountId: row.committed_account_id ?? null,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    settledAt: row.settled_at ?? null,
  };
}

const COLUMNS = `id, target_person_id, target_family_id, invitation_participation_id,
  candidate_identity_digest, state, terminal_reason, committed_account_id,
  created_at, expires_at, settled_at`;

export interface CreateAttemptInput {
  targetPersonId: string;
  targetFamilyId: string;
  invitationParticipationId: string;
  candidateIdentityDigest: string;
  ttlSeconds: number;
}

export interface CreateAttemptResult {
  attempt: BindingAttemptRow;
  created: boolean;
  /**
   * Expired PENDING attempts transitioned by THIS transaction immediately
   * before creation/convergence. Only the transaction that actually flipped
   * `state` receives them, so the caller writes exactly one expiry audit and
   * one all-context scrub (F-07).
   */
  expired: BindingAttemptRow[];
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === '23505'
  );
}

/**
 * Conditional expiry materialization for one frozen triple. PostgreSQL
 * re-evaluates the WHERE clause after waiting on the row lock, so concurrent
 * bootstrap requests cannot both transition the same expired row.
 */
export async function materializeExpiredForTriple(
  tx: pg.PoolClient,
  input: {
    targetPersonId: string;
    candidateIdentityDigest: string;
    invitationParticipationId: string;
  }
): Promise<BindingAttemptRow[]> {
  const { rows } = await tx.query(
    `UPDATE binding_attempts
        SET state = 'TERMINAL', terminal_reason = 'ATTEMPT_EXPIRED', settled_at = now()
      WHERE target_person_id = $1
        AND candidate_identity_digest = $2
        AND invitation_participation_id = $3
        AND state = 'PENDING'
        AND expires_at <= now()
      RETURNING ${COLUMNS}`,
    [input.targetPersonId, input.candidateIdentityDigest, input.invitationParticipationId]
  );
  return rows.map(mapRow);
}

/**
 * Insert a new live attempt. A partial unique index on
 * `(target_person_id, identity_digest, invitation_id) WHERE state='PENDING'`
 * is the convergence point: a concurrent creator loses with 23505 and then
 * reads the existing live attempt, so exactly one live attempt exists.
 */
export async function createAttempt(
  tx: pg.PoolClient,
  input: CreateAttemptInput
): Promise<CreateAttemptResult> {
  // An expired PENDING row must leave the live state before a new attempt is
  // created; otherwise the partial unique index would converge the new
  // operation onto an already-expired attempt (F-07).
  const expired = await materializeExpiredForTriple(tx, {
    targetPersonId: input.targetPersonId,
    candidateIdentityDigest: input.candidateIdentityDigest,
    invitationParticipationId: input.invitationParticipationId,
  });

  // A unique violation aborts the enclosing transaction in PostgreSQL. The
  // convergence loser must roll back to a savepoint before re-reading the
  // authoritative live attempt, otherwise the second bootstrap dies with
  // "current transaction is aborted" instead of converging.
  await tx.query('SAVEPOINT binding_attempt_create');
  try {
    const { rows } = await tx.query(
      `INSERT INTO binding_attempts
         (target_person_id, target_family_id, invitation_participation_id,
          candidate_identity_digest, expires_at)
       VALUES ($1, $2, $3, $4, now() + ($5 * interval '1 second'))
       RETURNING ${COLUMNS}`,
      [
        input.targetPersonId,
        input.targetFamilyId,
        input.invitationParticipationId,
        input.candidateIdentityDigest,
        input.ttlSeconds,
      ]
    );
    await tx.query('RELEASE SAVEPOINT binding_attempt_create');
    return { attempt: mapRow(rows[0]), created: true, expired };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    await tx.query('ROLLBACK TO SAVEPOINT binding_attempt_create');
    await tx.query('RELEASE SAVEPOINT binding_attempt_create');
    const live = await findLiveByTriple(tx, {
      targetPersonId: input.targetPersonId,
      candidateIdentityDigest: input.candidateIdentityDigest,
      invitationParticipationId: input.invitationParticipationId,
    });
    if (!live) throw err;
    return { attempt: live, created: false, expired };
  }
}

export async function findLiveByTriple(
  tx: pg.PoolClient,
  input: {
    targetPersonId: string;
    candidateIdentityDigest: string;
    invitationParticipationId: string;
  }
): Promise<BindingAttemptRow | null> {
  const { rows } = await tx.query(
    `SELECT ${COLUMNS} FROM binding_attempts
     WHERE target_person_id = $1
       AND candidate_identity_digest = $2
       AND invitation_participation_id = $3
       AND state = 'PENDING'
       AND expires_at > now()`,
    [input.targetPersonId, input.candidateIdentityDigest, input.invitationParticipationId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Latest attempt for the frozen triple, regardless of state (replay linkage). */
export async function findLatestByTriple(
  tx: pg.PoolClient,
  input: {
    targetPersonId: string;
    candidateIdentityDigest: string;
    invitationParticipationId: string;
  }
): Promise<BindingAttemptRow | null> {
  const { rows } = await tx.query(
    `SELECT ${COLUMNS} FROM binding_attempts
     WHERE target_person_id = $1
       AND candidate_identity_digest = $2
       AND invitation_participation_id = $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.targetPersonId, input.candidateIdentityDigest, input.invitationParticipationId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function findByIdForUpdate(
  tx: pg.PoolClient,
  attemptId: string
): Promise<BindingAttemptRow | null> {
  const { rows } = await tx.query(
    `SELECT ${COLUMNS} FROM binding_attempts WHERE id = $1 FOR UPDATE`,
    [attemptId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function findById(
  tx: pg.PoolClient,
  attemptId: string
): Promise<BindingAttemptRow | null> {
  const { rows } = await tx.query(
    `SELECT ${COLUMNS} FROM binding_attempts WHERE id = $1`,
    [attemptId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listPendingByPerson(
  tx: pg.PoolClient,
  targetPersonId: string
): Promise<BindingAttemptRow[]> {
  const { rows } = await tx.query(
    `SELECT ${COLUMNS} FROM binding_attempts
     WHERE target_person_id = $1
       AND state = 'PENDING'
       AND expires_at > now()
     ORDER BY created_at ASC`,
    [targetPersonId]
  );
  return rows.map(mapRow);
}

/**
 * Conditional expiry materialization for the confirmer pending list. Only
 * rows actually transitioned by THIS transaction are returned, so an expired
 * attempt yields exactly one TERMINAL audit and then disappears from the list.
 */
export async function materializeExpiredForPerson(
  tx: pg.PoolClient,
  targetPersonId: string
): Promise<BindingAttemptRow[]> {
  const { rows } = await tx.query(
    `UPDATE binding_attempts
        SET state = 'TERMINAL', terminal_reason = 'ATTEMPT_EXPIRED', settled_at = now()
      WHERE target_person_id = $1
        AND state = 'PENDING'
        AND expires_at <= now()
      RETURNING ${COLUMNS}`,
    [targetPersonId]
  );
  return rows.map(mapRow);
}

export async function settleCommitted(
  tx: pg.PoolClient,
  attemptId: string,
  accountId: string
): Promise<BindingAttemptRow | null> {
  const { rows } = await tx.query(
    `UPDATE binding_attempts
     SET state = 'COMMITTED', committed_account_id = $2, settled_at = now()
     WHERE id = $1 AND state = 'PENDING'
     RETURNING ${COLUMNS}`,
    [attemptId, accountId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function settleTerminal(
  tx: pg.PoolClient,
  attemptId: string,
  reason: BindingTerminalReason
): Promise<BindingAttemptRow | null> {
  const { rows } = await tx.query(
    `UPDATE binding_attempts
     SET state = 'TERMINAL', terminal_reason = $2, settled_at = now()
     WHERE id = $1 AND state = 'PENDING'
     RETURNING ${COLUMNS}`,
    [attemptId, reason]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Access-time expiration materialization; no background job. */
export async function materializeExpired(
  tx: pg.PoolClient,
  attemptId: string
): Promise<BindingAttemptRow | null> {
  const { rows } = await tx.query(
    `UPDATE binding_attempts
     SET state = 'TERMINAL', terminal_reason = 'ATTEMPT_EXPIRED', settled_at = now()
     WHERE id = $1 AND state = 'PENDING' AND expires_at <= now()
     RETURNING ${COLUMNS}`,
    [attemptId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}