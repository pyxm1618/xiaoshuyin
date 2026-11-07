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