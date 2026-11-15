/**
 * Single authoritative terminal settlement primitive (D-14 / M-03 / M-04).
 *
 * The conditional PENDING→TERMINAL update is the serialization point. Only the
 * transaction that actually transitions the row writes the terminal audit and
 * scrubs every attempt-scoped context, so repeated / concurrent settlement
 * attempts cannot produce a second audit or retain a decryptable OpenID.
 *
 * Callers MUST NOT materialize the state first and then call this helper.
 */

import type pg from 'pg';
import type { BindingAttemptRow, BindingTerminalReason } from '@xiaoshuyin/domain';
import { appendAudit, type BindingAuditEventType } from './audit-repository.js';
import {
  clearOpenidForAttempt,
  clearPairingForAttempt,
} from './pending-context-repository.js';

const COLUMNS = `id, target_person_id, target_family_id, invitation_participation_id,
  candidate_identity_digest, state, terminal_reason, committed_account_id,
  created_at, expires_at, settled_at`;

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

export type TerminalEventType =
  | 'BINDING_TERMINAL'
  | 'BINDING_CANDIDATE_REJECTED'
  | 'BINDING_CANDIDATE_CANCELLED'
  | 'BINDING_SECOND_PARTY_REJECTED';

function eventForReason(reason: BindingTerminalReason): TerminalEventType {
  if (reason === 'CANDIDATE_REJECTED') return 'BINDING_CANDIDATE_REJECTED';
  if (reason === 'CANDIDATE_CANCELLED') return 'BINDING_CANDIDATE_CANCELLED';
  if (reason === 'RECOGNITION_REJECTED' || reason === 'CONFIRMER_REJECTED') {
    return 'BINDING_SECOND_PARTY_REJECTED';
  }
  return 'BINDING_TERMINAL';
}

export interface SettleTerminalInput {
  attemptId: string;
  reason: BindingTerminalReason;
  correlationId: string;
  eventType?: TerminalEventType;
  actorAccountId?: string | null;
  actorPersonId?: string | null;
}

/**
 * Settle one PENDING attempt as TERMINAL. Returns the transitioned row, or null
 * when another transaction already settled it (caller must read authoritative
 * state; it MUST NOT write a second audit or cleanup).
 */
export async function settleTerminalAttempt(
  tx: pg.PoolClient,
  input: SettleTerminalInput
): Promise<BindingAttemptRow | null> {
  const { rows } = await tx.query(
    `UPDATE binding_attempts
        SET state = 'TERMINAL', terminal_reason = $2, settled_at = now()
      WHERE id = $1 AND state = 'PENDING'
      RETURNING ${COLUMNS}`,
    [input.attemptId, input.reason]
  );
  if (!rows[0]) return null;
  const settled = mapRow(rows[0]);
  await writeSettlement(tx, settled, input);
  return settled;
}

/**
 * Settle one expired PENDING attempt. The expiry predicate is part of the
 * transition, so a not-yet-expired row is never terminalized by this helper.
 */
export async function settleExpiredAttempt(
  tx: pg.PoolClient,
  input: { attemptId: string; correlationId: string; eventType?: TerminalEventType }
): Promise<BindingAttemptRow | null> {
  const { rows } = await tx.query(
    `UPDATE binding_attempts
        SET state = 'TERMINAL', terminal_reason = 'ATTEMPT_EXPIRED', settled_at = now()
      WHERE id = $1
        AND state = 'PENDING'
        AND expires_at <= now()
      RETURNING ${COLUMNS}`,
    [input.attemptId]
  );
  if (!rows[0]) return null;
  const settled = mapRow(rows[0]);
  await writeSettlement(tx, settled, {
    attemptId: settled.id,
    reason: 'ATTEMPT_EXPIRED',
    correlationId: input.correlationId,
    ...(input.eventType ? { eventType: input.eventType } : {}),
  });
  return settled;
}

/**
 * Settle every expired PENDING attempt for a target Person. Used by the
 * confirmer pending list; each row transitioned here receives exactly one
 * audit and an attempt-scope scrub inside the same transaction.
 */
export async function settleExpiredForPerson(
  tx: pg.PoolClient,
  input: {
    targetPersonId: string;
    correlationId: string;
    actorAccountId?: string | null;
    actorPersonId?: string | null;
  }
): Promise<BindingAttemptRow[]> {
  const { rows } = await tx.query(
    `UPDATE binding_attempts
        SET state = 'TERMINAL', terminal_reason = 'ATTEMPT_EXPIRED', settled_at = now()
      WHERE target_person_id = $1
        AND state = 'PENDING'
        AND expires_at <= now()
      RETURNING ${COLUMNS}`,
    [input.targetPersonId]
  );
  const settledRows = rows.map(mapRow);
  for (const settled of settledRows) {
    // The batch UPDATE does not establish the candidate identity GUC, but the
    // terminal audit WITH CHECK requires it to match the attempt digest.
    await tx.query('SELECT app.set_binding_attempt_context($1, $2, $3, $4, $5, $6)', [
      settled.id,
      settled.candidateIdentityDigest,
      settled.invitationParticipationId,
      settled.targetPersonId,
      settled.targetFamilyId,
      'IDENTITY_BINDING_GATE',
    ]);
    await writeSettlement(tx, settled, {
      attemptId: settled.id,
      reason: 'ATTEMPT_EXPIRED',
      correlationId: input.correlationId,
      actorAccountId: input.actorAccountId ?? null,
      actorPersonId: input.actorPersonId ?? null,
    });
  }
  return settledRows;
}

async function writeSettlement(
  tx: pg.PoolClient,
  settled: BindingAttemptRow,
  input: SettleTerminalInput
): Promise<void> {
  const eventType: BindingAuditEventType =
    input.eventType ?? eventForReason(input.reason);
  await appendAudit(tx, {
    correlationId: input.correlationId,
    attemptId: settled.id,
    targetPersonId: settled.targetPersonId,
    targetFamilyId: settled.targetFamilyId,
    invitationParticipationId: settled.invitationParticipationId,
    actorAccountId: input.actorAccountId ?? null,
    actorPersonId: input.actorPersonId ?? null,
    candidateIdentityDigest: settled.candidateIdentityDigest,
    eventType,
    result: 'TERMINAL',
    terminalReason: input.reason,
  });
  // Cleanup is part of settlement. A failure aborts the transaction, so no
  // state-only TERMINAL with a retained secret can commit.
  await clearOpenidForAttempt(tx, settled.id);
  await clearPairingForAttempt(tx, settled.id);
}