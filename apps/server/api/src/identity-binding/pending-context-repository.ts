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
  };
}

const COLUMNS = `id, token_hash, candidate_identity_digest, attempt_id,
  invitation_participation_id, committed_account_id, openid_ciphertext,
  openid_nonce, openid_tag, created_at, last_used_at, expires_at`;

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

/** Clear decryptable openid on every pre-attempt block / settled attempt. */
export async function clearOpenid(tx: pg.PoolClient, contextId: string): Promise<void> {
  await tx.query(
    `UPDATE binding_pending_contexts
     SET openid_ciphertext = NULL, openid_nonce = NULL, openid_tag = NULL
     WHERE id = $1`,
    [contextId]
  );
}

export function isExpired(row: PendingContextRow, now: Date = new Date()): boolean {
  return now.getTime() >= row.expiresAt.getTime();
}