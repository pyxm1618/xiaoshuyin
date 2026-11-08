/**
 * Operation-level idempotency repository (Slice 006-owned table).
 *
 * The key records identity + request fingerprint only. It never stores a
 * response body: the authoritative attempt state is re-read on replay.
 */

import type pg from 'pg';
import type {
  BindingOperationCommand,
  BindingOperationScopeKind,
} from '@xiaoshuyin/domain';

export interface BindingOperationKeyRow {
  id: string;
  scopeKind: BindingOperationScopeKind;
  scopeKey: string;
  commandType: BindingOperationCommand;
  idempotencyKey: string;
  requestHash: string;
  attemptId: string | null;
  createdAt: Date;
}

const COLUMNS = `id, scope_kind, scope_key, command_type, idempotency_key,
  request_hash, attempt_id, created_at`;

function mapRow(row: any): BindingOperationKeyRow {
  return {
    id: row.id,
    scopeKind: row.scope_kind,
    scopeKey: row.scope_key,
    commandType: row.command_type,
    idempotencyKey: row.idempotency_key,
    requestHash: row.request_hash,
    attemptId: row.attempt_id ?? null,
    createdAt: row.created_at,
  };
}

export async function setScope(tx: pg.PoolClient, scopeKey: string): Promise<void> {
  await tx.query('SELECT app.set_binding_operation_scope($1)', [scopeKey]);
}

/** Serialize concurrent same-key requests before lookup / insert. */
export async function lockScope(
  tx: pg.PoolClient,
  input: {
    scopeKind: BindingOperationScopeKind;
    scopeKey: string;
    commandType: BindingOperationCommand;
    idempotencyKey: string;
  }
): Promise<void> {
  await tx.query(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0::bigint))',
    [`${input.scopeKind}:${input.scopeKey}:${input.commandType}:${input.idempotencyKey}`]
  );
}

export async function find(
  tx: pg.PoolClient,
  input: {
    scopeKind: BindingOperationScopeKind;
    scopeKey: string;
    commandType: BindingOperationCommand;
    idempotencyKey: string;
  }
): Promise<BindingOperationKeyRow | null> {
  const { rows } = await tx.query(
    `SELECT ${COLUMNS} FROM binding_operation_keys
     WHERE scope_kind = $1 AND scope_key = $2 AND command_type = $3
       AND idempotency_key = $4`,
    [input.scopeKind, input.scopeKey, input.commandType, input.idempotencyKey]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function insert(
  tx: pg.PoolClient,
  input: {
    scopeKind: BindingOperationScopeKind;
    scopeKey: string;
    commandType: BindingOperationCommand;
    idempotencyKey: string;
    requestHash: string;
    attemptId: string | null;
  }
): Promise<BindingOperationKeyRow | null> {
  const { rows } = await tx.query(
    `INSERT INTO binding_operation_keys
       (scope_kind, scope_key, command_type, idempotency_key, request_hash, attempt_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (scope_kind, scope_key, command_type, idempotency_key) DO NOTHING
     RETURNING ${COLUMNS}`,
    [
      input.scopeKind,
      input.scopeKey,
      input.commandType,
      input.idempotencyKey,
      input.requestHash,
      input.attemptId,
    ]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * Bootstrap replay lookup that survives an invitation becoming terminal.
 *
 * The frozen scope key is derived from the resolved participation id while the
 * invitation is VALID, but from the token hash once it is TERMINAL_UNUSABLE.
 * An exact replay therefore cannot always recompute the original scope key.
 * The request fingerprint (invitation token + candidate identity) is invariant
 * across that transition and is used here, still paired with the idempotency
 * key and restricted to BOOTSTRAP / CANDIDATE_CONTEXT. Read-only.
 */
export async function findBootstrapByRequestHash(
  tx: pg.PoolClient,
  input: { idempotencyKey: string; requestHash: string }
): Promise<BindingOperationKeyRow | null> {
  await tx.query('SELECT app.set_binding_bootstrap_request_hash($1)', [input.requestHash]);
  const { rows } = await tx.query(
    `SELECT ${COLUMNS} FROM binding_operation_keys
     WHERE scope_kind = 'CANDIDATE_CONTEXT'
       AND command_type = 'BOOTSTRAP'
       AND idempotency_key = $1
       AND request_hash = $2
     ORDER BY (attempt_id IS NOT NULL) DESC, created_at ASC
     LIMIT 1`,
    [input.idempotencyKey, input.requestHash]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * Bind an operation key to its authoritative attempt. This is the ONLY way an
 * operation key acquires attempt identity, and it is monotonic: an unbound key
 * may be bound once, a key already bound to the same attempt is a read-back
 * no-op, and a key bound to a different attempt fails closed.
 *
 * The binding is never a lifecycle state and never stores a response.
 */
export async function mapAttempt(
  tx: pg.PoolClient,
  input: { operationKeyId: string; attemptId: string }
): Promise<BindingOperationKeyRow> {
  const current = await tx.query(
    `SELECT ${COLUMNS} FROM binding_operation_keys WHERE id = $1 FOR UPDATE`,
    [input.operationKeyId]
  );
  if (!current.rows[0]) throw new Error('BINDING_OPERATION_KEY_NOT_FOUND');
  const row = mapRow(current.rows[0]);

  if (row.attemptId === input.attemptId) return row;
  if (row.attemptId !== null) {
    throw new Error('BINDING_OPERATION_ATTEMPT_CONFLICT');
  }

  const updated = await tx.query(
    `UPDATE binding_operation_keys
        SET attempt_id = $2
      WHERE id = $1 AND attempt_id IS NULL
      RETURNING ${COLUMNS}`,
    [input.operationKeyId, input.attemptId]
  );
  if (updated.rows[0]) return mapRow(updated.rows[0]);

  // A concurrent mapper won the conditional update; converge only if it chose
  // the same attempt, otherwise fail closed.
  const reread = await tx.query(
    `SELECT ${COLUMNS} FROM binding_operation_keys WHERE id = $1`,
    [input.operationKeyId]
  );
  if (!reread.rows[0]) throw new Error('BINDING_OPERATION_KEY_NOT_FOUND');
  const settled = mapRow(reread.rows[0]);
  if (settled.attemptId === input.attemptId) return settled;
  throw new Error('BINDING_OPERATION_ATTEMPT_CONFLICT');
}