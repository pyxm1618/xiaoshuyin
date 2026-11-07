/**
 * Binding confirmation repository (append-only; no update / delete API).
 */

import type pg from 'pg';
import type {
  BindingConfirmationKind,
  BindingConfirmationRecord,
  BindingConfirmerAuthority,
} from '@xiaoshuyin/domain';

const COLUMNS = `id, attempt_id, kind, actor_pending_context_id, actor_account_id,
  actor_person_id, authority, target_confirmed, candidate_recognized,
  statement_version, recorded_at`;

function mapRow(row: any): BindingConfirmationRecord {
  return {
    id: row.id,
    attemptId: row.attempt_id,
    kind: row.kind,
    actorPendingContextId: row.actor_pending_context_id ?? null,
    actorAccountId: row.actor_account_id ?? null,
    actorPersonId: row.actor_person_id ?? null,
    authority: row.authority ?? null,
    recordedAt: row.recorded_at,
  };
}

export async function appendCandidate(
  tx: pg.PoolClient,
  attemptId: string,
  contextId: string
): Promise<BindingConfirmationRecord | null> {
  const { rows } = await tx.query(
    `INSERT INTO binding_confirmations
       (attempt_id, kind, actor_pending_context_id, target_confirmed,
        candidate_recognized, statement_version)
     VALUES ($1, 'CANDIDATE', $2, true, false, 'candidate-binding-v1')
     ON CONFLICT (attempt_id, kind) DO NOTHING
     RETURNING ${COLUMNS}`,
    [attemptId, contextId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function appendSecondParty(
  tx: pg.PoolClient,
  input: {
    attemptId: string;
    actorAccountId: string;
    actorPersonId: string;
    authority: BindingConfirmerAuthority;
  }
): Promise<BindingConfirmationRecord | null> {
  const { rows } = await tx.query(
    `INSERT INTO binding_confirmations
       (attempt_id, kind, actor_account_id, actor_person_id, authority,
        target_confirmed, candidate_recognized, statement_version)
     VALUES ($1, 'SECOND_PARTY', $2, $3, $4, true, true, 'second-party-recognition-v1')
     ON CONFLICT (attempt_id, kind) DO NOTHING
     RETURNING ${COLUMNS}`,
    [input.attemptId, input.actorAccountId, input.actorPersonId, input.authority]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listByAttempt(
  tx: pg.PoolClient,
  attemptId: string
): Promise<BindingConfirmationRecord[]> {
  const { rows } = await tx.query(
    `SELECT ${COLUMNS} FROM binding_confirmations WHERE attempt_id = $1 ORDER BY recorded_at`,
    [attemptId]
  );
  return rows.map(mapRow);
}

export async function hasKind(
  tx: pg.PoolClient,
  attemptId: string,
  kind: BindingConfirmationKind
): Promise<boolean> {
  const { rows } = await tx.query(
    'SELECT 1 FROM binding_confirmations WHERE attempt_id = $1 AND kind = $2 LIMIT 1',
    [attemptId, kind]
  );
  return rows.length > 0;
}