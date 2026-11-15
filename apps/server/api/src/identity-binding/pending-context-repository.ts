/**
 * Pending authentication context repository (Slice 006-owned table).
 * RLS is driven by `withBindingContextTransaction` / commit context.
 */

import type pg from 'pg';

export interface PendingContextRow {
  id: string;
  tokenHash: string;
  candidateIdentityDigest: string;
  attemptId: string | null;
  invitationParticipationId: string | null;
  committedAccountId: string | null;
  openidCiphertext: Buffer | null;
  openidNonce: Buffer | null;
  openidTag: Buffer | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  pairingIssuedAt: Date | null;
  pairingExpiresAt: Date | null;
  pairingIssuanceId: string | null;
}

function mapRow(row: any): PendingContextRow {
  return {
    id: row.id,
    tokenHash: row.token_hash,
    candidateIdentityDigest: row.candidate_identity_digest,
    attemptId: row.attempt_id ?? null,
    invitationParticipationId: row.invitation_participation_id ?? null,
    committedAccountId: row.committed_account_id ?? null,
    openidCiphertext: row.openid_ciphertext ?? null,
    openidNonce: row.openid_nonce ?? null,
    openidTag: row.openid_tag ?? null,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at ?? null,
    expiresAt: row.expires_at,
    pairingIssuedAt: row.pairing_issued_at ?? null,
    pairingExpiresAt: row.pairing_expires_at ?? null,
    pairingIssuanceId: row.pairing_issuance_id ?? null,
  };
}

const COLUMNS = `id, token_hash, candidate_identity_digest, attempt_id,
  invitation_participation_id, committed_account_id, openid_ciphertext,
  openid_nonce, openid_tag, created_at, last_used_at, expires_at,
  pairing_issued_at, pairing_expires_at, pairing_issuance_id`;

export interface CreateContextInput {
  id: string;
  tokenHash: string;
  identityDigest: string;
  ttlSeconds: number;
  ciphertext: Buffer;
  nonce: Buffer;
  tag: Buffer;
}

export async function createContext(
  tx: pg.PoolClient,
  input: CreateContextInput
): Promise<PendingContextRow> {
  const { rows } = await tx.query(
    `INSERT INTO binding_pending_contexts
       (id, token_hash, candidate_identity_digest, openid_ciphertext, openid_nonce,
        openid_tag, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, now() + ($7 * interval '1 second'))
     RETURNING ${COLUMNS}`,
    [
      input.id,
      input.tokenHash,
      input.identityDigest,
      input.ciphertext,
      input.nonce,
      input.tag,
      input.ttlSeconds,
    ]
  );
  return mapRow(rows[0]);
}

export async function findByTokenHash(
  tx: pg.PoolClient,
  tokenHash: string
): Promise<PendingContextRow | null> {
  const { rows } = await tx.query(
    `SELECT ${COLUMNS} FROM binding_pending_contexts WHERE token_hash = $1`,
    [tokenHash]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function findByIdForUpdate(
  tx: pg.PoolClient,
  id: string
): Promise<PendingContextRow | null> {
  const { rows } = await tx.query(
    `SELECT ${COLUMNS} FROM binding_pending_contexts WHERE id = $1 FOR UPDATE`,
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Visible under the attempt-scoped policy (confirmer Gate / commit). */
export async function findByAttemptIdForUpdate(
  tx: pg.PoolClient,
  attemptId: string
): Promise<PendingContextRow | null> {
  const { rows } = await tx.query(
    `SELECT ${COLUMNS} FROM binding_pending_contexts WHERE attempt_id = $1 FOR UPDATE`,
    [attemptId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * Deterministic authoritative context for a Phase C replay that does not
 * re-verify a challenge.
 *
 * A bootstrap replay may legitimately create a fresh transport context for the
 * same live attempt while older contexts are already scrubbed (expired). Phase
 * C must therefore never rely on PostgreSQL heap order: it selects the newest
 * context of THIS exact attempt that is still usable (decryptable openid and
 * not expired), ordered by the immutable creation facts. If none exists the
 * commit fails closed.
 */
export async function findCurrentUsableContextForAttemptForUpdate(
  tx: pg.PoolClient,
  attemptId: string
): Promise<PendingContextRow | null> {
  const { rows } = await tx.query(
    `SELECT ${COLUMNS} FROM binding_pending_contexts
      WHERE attempt_id = $1
        AND openid_ciphertext IS NOT NULL
        AND openid_nonce IS NOT NULL
        AND openid_tag IS NOT NULL
        AND expires_at > now()
      ORDER BY created_at DESC, id DESC
      LIMIT 1
      FOR UPDATE`,
    [attemptId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function touch(tx: pg.PoolClient, id: string): Promise<void> {
  await tx.query('UPDATE binding_pending_contexts SET last_used_at = now() WHERE id = $1', [id]);
}

export async function linkAttempt(
  tx: pg.PoolClient,
  contextId: string,
  attemptId: string,
  invitationParticipationId: string
): Promise<void> {
  const result = await tx.query(
    `UPDATE binding_pending_contexts
     SET attempt_id = $2, invitation_participation_id = $3
     WHERE id = $1`,
    [contextId, attemptId, invitationParticipationId]
  );
  if ((result.rowCount ?? 0) !== 1) {
    throw new Error('BINDING_CONTEXT_LINK_FAILED');
  }
}

export async function markCommitted(
  tx: pg.PoolClient,
  contextId: string,
  accountId: string
): Promise<void> {
  await tx.query(
    `UPDATE binding_pending_contexts
     SET committed_account_id = $2,
         openid_ciphertext = NULL, openid_nonce = NULL, openid_tag = NULL
     WHERE id = $1`,
    [contextId, accountId]
  );
}

/**
 * Mark every transport context linked to the same authoritative attempt.
 *
 * Bootstrap replay may create a fresh pending context for the same attempt
 * (plan D-3.4); after Phase C commit all of those tokens must be able to
 * exchange an ordinary session without re-executing the commit, and none may
 * retain a decryptable openid.
 */
export async function markCommittedForAttempt(
  tx: pg.PoolClient,
  attemptId: string,
  accountId: string
): Promise<void> {
  await tx.query(
    `UPDATE binding_pending_contexts
     SET committed_account_id = $2,
         openid_ciphertext = NULL, openid_nonce = NULL, openid_tag = NULL
     WHERE attempt_id = $1`,
    [attemptId, accountId]
  );
}

/** Clear decryptable openid on every pre-attempt block / settled attempt. */
export async function clearOpenid(tx: pg.PoolClient, contextId: string): Promise<void> {
  await tx.query(
    `UPDATE binding_pending_contexts
     SET openid_ciphertext = NULL, openid_nonce = NULL, openid_tag = NULL
     WHERE id = $1`,
    [contextId]
  );
}

/** Scrub every transport context linked to one authoritative attempt (F-05). */
export async function clearOpenidForAttempt(
  tx: pg.PoolClient,
  attemptId: string
): Promise<void> {
  await tx.query(
    `UPDATE binding_pending_contexts
     SET openid_ciphertext = NULL, openid_nonce = NULL, openid_tag = NULL
     WHERE attempt_id = $1`,
    [attemptId]
  );
}

/**
 * Scrub every pre-attempt transport context for the candidate identity scope
 * (F-05). Invalid invitation / authorize DENY / Case B mismatch / Gate 1 fail
 * never link an attempt, so scoping by attempt alone would leak decryptable
 * OpenIDs across repeated bootstrap replays.
 */
export async function clearOpenidForNoAttemptIdentity(
  tx: pg.PoolClient,
  identityDigest: string
): Promise<void> {
  await tx.query(
    `UPDATE binding_pending_contexts
     SET openid_ciphertext = NULL, openid_nonce = NULL, openid_tag = NULL
     WHERE attempt_id IS NULL
       AND candidate_identity_digest = $1`,
    [identityDigest]
  );
}

/** Persist / rotate the current pairing issuance (non-secret replay material). */
export async function setPairingIssuance(
  tx: pg.PoolClient,
  contextId: string,
  input: { pairingIssuanceId: string; pairingIssuedAt: Date; pairingExpiresAt: Date }
): Promise<PendingContextRow | null> {
  const { rows } = await tx.query(
    `UPDATE binding_pending_contexts
        SET pairing_issuance_id = $2,
            pairing_issued_at = $3,
            pairing_expires_at = $4
      WHERE id = $1
      RETURNING ${COLUMNS}`,
    [contextId, input.pairingIssuanceId, input.pairingIssuedAt, input.pairingExpiresAt]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Consume / invalidate the current issuance without touching secrets. */
export async function clearPairingIssuance(
  tx: pg.PoolClient,
  contextId: string
): Promise<void> {
  await tx.query(
    `UPDATE binding_pending_contexts
        SET pairing_issuance_id = NULL,
            pairing_issued_at = NULL,
            pairing_expires_at = NULL
      WHERE id = $1`,
    [contextId]
  );
}

/** Consume every issuance belonging to one settled attempt. */
export async function clearPairingForAttempt(
  tx: pg.PoolClient,
  attemptId: string
): Promise<void> {
  await tx.query(
    `UPDATE binding_pending_contexts
        SET pairing_issuance_id = NULL,
            pairing_issued_at = NULL,
            pairing_expires_at = NULL
      WHERE attempt_id = $1`,
    [attemptId]
  );
}

/**
 * H-01 rotation: when a NEW valid issuance is minted for one attempt (e.g. a
 * fresh bootstrap replay transport context), every older issuance of the same
 * attempt becomes invalid. Only the new context keeps its issuance.
 */
export async function clearPairingForAttemptExcept(
  tx: pg.PoolClient,
  attemptId: string,
  keepContextId: string
): Promise<void> {
  await tx.query(
    `UPDATE binding_pending_contexts
        SET pairing_issuance_id = NULL,
            pairing_issued_at = NULL,
            pairing_expires_at = NULL
      WHERE attempt_id = $1 AND id <> $2`,
    [attemptId, keepContextId]
  );
}

/**
 * M-02: scrub the freshly-minted replay context by exact id, regardless of
 * whether it was linked to an attempt before cleanup. This is deliberately
 * independent of the attempt_id IS NULL scope used for older replay contexts.
 */
export async function clearOpenidForFreshContext(
  tx: pg.PoolClient,
  contextId: string
): Promise<void> {
  await clearOpenid(tx, contextId);
}

export function isExpired(row: PendingContextRow, now: Date = new Date()): boolean {
  return now.getTime() >= row.expiresAt.getTime();
}