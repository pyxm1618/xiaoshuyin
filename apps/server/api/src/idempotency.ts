/**
 * Unified idempotent command orchestration.
 *
 * All six mutating commands (FAMILY_CREATE, MEMBER_CREATE, MEMBER_UPDATE,
 * GUARDIAN_CONSENT_REQUEST, GUARDIAN_CONSENT_GRANT, GUARDIAN_CONSENT_REVOKE)
 * go through this single entry point so that:
 *   - a replay/mismatch is answered BEFORE any business validation runs,
 *   - the idempotency record is written in the SAME transaction as the
 *     business objects (no half-committed command),
 *   - concurrent same-key requests are serialized by a transaction-scoped
 *     advisory lock, so at most one business object can be created.
 *
 * Family context is NOT set here. Per contracts/authorization-and-rls.md §4.4
 * each command runs `resolve → authorize → set_family_context → read/write`
 * inside `fn`, in this same transaction.
 *
 * Data access stays in packages/** (guard R4); this module only orchestrates.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import pg from 'pg';
import {
  decideIdempotency,
  getIdempotencyKey,
  insertIdempotencyKey,
  lockIdempotencyKey,
  type IdempotencyCommandType,
} from '@xiaoshuyin/domain';
import { toHttpError } from './plugins/error-handler.js';

export interface CommandResponse {
  status: number;
  body: unknown;
}

export type CommandOutcome =
  | { action: 'REPLAY'; status: number; body: unknown }
  | { action: 'MISMATCH' }
  | { action: 'EXECUTED'; status: number; body: unknown };

export interface IdempotentCommandConfig {
  accountId: string;
  personId: string;
  purpose: string;
  commandType: IdempotencyCommandType;
  idempotencyKey: string;
  requestHash: string;
}

const MIN_IDEMPOTENCY_KEY_LENGTH = 8;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

/**
 * Frozen OpenAPI contract: `Idempotency-Key` is an HTTP header for all six
 * mutating commands, required, 8..128 characters.
 */
export function readIdempotencyKey(req: FastifyRequest): string {
  const raw = req.headers['idempotency-key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (
    typeof value !== 'string' ||
    value.length < MIN_IDEMPOTENCY_KEY_LENGTH ||
    value.length > MAX_IDEMPOTENCY_KEY_LENGTH
  ) {
    const err = toHttpError('VALIDATION_ERROR', 'Idempotency-Key header is required');
    throw Object.assign(new Error(err.message), err);
  }
  return value;
}

function decide(
  existing: { request_hash: string; response_status: number; response_body: unknown } | null,
  requestHash: string
): CommandOutcome | null {
  const result = decideIdempotency(
    existing
      ? {
          requestHash: existing.request_hash,
          responseStatus: existing.response_status,
          responseBody: existing.response_body,
        }
      : null,
    requestHash
  );

  if (result.action === 'REPLAY') {
    return { action: 'REPLAY', status: result.responseStatus, body: result.responseBody };
  }
  if (result.action === 'MISMATCH') {
    return { action: 'MISMATCH' };
  }
  return null;
}

/**
 * Fast path read-only lookup. Runs before any business validation so a replay
 * is never rejected by state that has changed since the original request
 * (e.g. an already-GRANTED consent request).
 */
async function peekIdempotency(
  pool: pg.Pool,
  cfg: IdempotentCommandConfig
): Promise<CommandOutcome | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT app.set_identity_context($1, $2)', [cfg.accountId, 'SELF_IDENTITY']);
    const existing = await getIdempotencyKey(
      client, cfg.accountId, cfg.commandType, cfg.idempotencyKey
    );
    await client.query('COMMIT');
    return decide(existing, cfg.requestHash);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function runIdempotentCommand(
  pool: pg.Pool,
  cfg: IdempotentCommandConfig,
  fn: (tx: pg.PoolClient) => Promise<CommandResponse>
): Promise<CommandOutcome> {
  const early = await peekIdempotency(pool, cfg);
  if (early) return early;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT app.set_identity_context($1, $2)', [cfg.accountId, cfg.purpose]);

    // Serialize same-key commands BEFORE the second lookup.
    await lockIdempotencyKey(client, cfg.accountId, cfg.commandType, cfg.idempotencyKey);

    // Re-check under the lock: a concurrent request may have committed already.
    const existing = await getIdempotencyKey(
      client, cfg.accountId, cfg.commandType, cfg.idempotencyKey
    );
    const decision = decide(existing, cfg.requestHash);
    if (decision) {
      await client.query('COMMIT');
      return decision;
    }

    const response = await fn(client);

    await insertIdempotencyKey(
      client,
      cfg.accountId,
      cfg.commandType,
      cfg.idempotencyKey,
      cfg.requestHash,
      response.status,
      JSON.stringify(response.body)
    );

    await client.query('COMMIT');
    return { action: 'EXECUTED', status: response.status, body: response.body };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export function sendCommandOutcome(reply: FastifyReply, outcome: CommandOutcome) {
  if (outcome.action === 'MISMATCH') {
    const err = toHttpError('IDEMPOTENCY_PAYLOAD_MISMATCH');
    return reply.status(err.statusCode).send(err);
  }
  return reply.status(outcome.status).send(outcome.body);
}